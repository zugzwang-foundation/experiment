import { eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SEED-STAGING-1 §8 (how each row is executed), §7 (idempotency and re-runs),
// §6 step 5 (a failure stops ITS market only) and §16 `run.ts` /
// `tos-record.ts` — against the real local Postgres on :54322.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE ONE RULE THIS FILE EXISTS TO HOLD, borrowed verbatim from the staging
// generator (ADR-0036 primitive 1, manifest §1.1): EVERY ROW IS PRODUCED BY
// DRIVING THE REAL ENGINE. Staging once carried 37 of 39 `bets` rows with no
// matching event because a fixture script wrote both halves itself. This tool
// is the same hazard wearing an admin page: it creates accounts and places
// bets at volume, so if it ever grows its own INSERT it will manufacture
// states the product cannot reach — and a replica whose whole purpose is to
// look like production stops being evidence of anything.
//
// So the assertions below are not "rows appeared". They are the properties
// only the engine can produce:
//   · the pseudonym came from the identity pool, because no caller may write
//     one (ADR-0011 · §16 participants.ts: "Never writes a pseudonym itself");
//   · exactly ONE `initial_grant` per created participant, EVER
//     (I-GRANT-ONCE-001, and the partial unique index behind it);
//   · every bet carries its comment (INV-1) and every comment froze the side
//     it was posted on (INV-3);
//   · the pool MOVED, which is the CPMM actually running rather than a
//     `bets` row being written beside a static price;
//   · every event carries `metadata.request_id = seed-staging:<batchId>`
//     (§8 Provenance) — the only thing that makes seeded activity
//     distinguishable in an append-only log with no schema change.
//
// ── WHAT IS MOCKED, AND WHAT IS DELIBERATELY NOT ───────────────────────────
// Mocked: `@sentry/nextjs` (telemetry, not a writer), `next/cache` (no request
// scope in Vitest), `@/server/upstash/redis` (the cache-invalidation counters
// `openMarket` fires; nothing on the seed path reads it).
//
// ⛔ `next/headers`, `next/navigation` and `verifyOnboardingRef` are NOT mocked,
// and that absence is an ASSERTION. §8's whole reason for extracting
// `recordTosAcceptance` is that `acceptTosAction` reads `cookies()` and
// `headers()`, which do not exist for a synthetic participant. An
// implementation that reached for the Server Action anyway would pass a test
// that had mocked the shell for it. Here it fails, loudly, on the first
// participant.
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { mockRedis } = vi.hoisted(() => ({
	mockRedis: {
		set: vi.fn(async () => "OK"),
		get: vi.fn(async () => null),
		del: vi.fn(async () => 1),
		eval: vi.fn(async () => null),
		incr: vi.fn(async () => 1),
		incrby: vi.fn(async () => 1),
	},
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));

// The conclusion freeze is a one-shot, append-only flip on `system_state`
// (Bucket B) — flipping it in the shared test database would freeze every
// other suite. The seed path's freeze check is therefore exercised through
// this mock, defaulting to "not frozen" so every other test is unaffected.
const { mockIsFrozen } = vi.hoisted(() => ({
	mockIsFrozen: vi.fn(async () => false),
}));
vi.mock("@/server/system/is-frozen", () => ({ isFrozen: mockIsFrozen }));

import {
	betReceipts,
	bets,
	comments,
	dharmaLedger,
	events,
	identityPool,
	markets,
	pools,
	users,
} from "@/db/schema";
import { recordTosAcceptance } from "@/server/auth/tos-record";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
	INITIAL_USER_DHARMA,
} from "@/server/config/limits";
import { closeMarket } from "@/server/markets/close";
import { createMarket } from "@/server/markets/create";
import { openMarket } from "@/server/markets/open";
import { SeedToolsDisabledError } from "@/server/seed/gate";
import { SEED_LABELS } from "@/server/seed/plan";
import { runSeedChunk } from "@/server/seed/run";
import type { RawSeedRow, SeedRowResult } from "@/server/seed/types";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED_REQUEST_ID_PREFIX = SEED_LABELS.staging.requestIdPrefix;

// ── Fixtures ────────────────────────────────────────────────────────────────

const MARKET_A = "seed-run-market-a";
const MARKET_B = "seed-run-market-b";
const NOW = new Date("2026-10-01T00:00:00.000Z");
const DEADLINE = new Date("2026-10-15T00:00:00.000Z");
const SEED_DOMAIN = "@seed.staging.invalid";

/** Enough tuples for every participant any test here creates, plus slack. */
const TUPLES = Array.from({ length: 16 }, (_, i) => {
	const suffix = String(i).padStart(3, "0");
	return {
		colour: "Red",
		animal: "Fox",
		number: i,
		pseudonym: `RedFox${suffix}`,
		pfpFilename: `redfox${suffix}.png`,
	};
});

function adminMetadata(flowId: string) {
	return {
		request_id: "test-seed-staging-1",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

/** A row that passes validation, so each fixture varies only what it means to. */
function row(rowNumber: number, over: Partial<RawSeedRow>): RawSeedRow {
	return {
		rowNumber,
		market: MARKET_A,
		user: "",
		side: "YES",
		stake: BET_MIN_STAKE_POST,
		argument: `seed row ${rowNumber}`,
		replyTo: "",
		...over,
	};
}

/**
 * The six-row batch the happy path, the re-run and the chunked resume all
 * share. Shaped so each of §6's rules has something to prove:
 *   · two markets, interleaved in sheet order (A, A, A, B, B, A) — so grouping
 *     is observable and is NOT the sheet's own order;
 *   · `alpha` posts in BOTH markets on OPPOSITE sides — legal, because
 *     I-SINGLE-SIDE is per (user, market) and nothing weaker;
 *   · one Counter reply (row 2, NO under a YES parent) and one Support reply
 *     (row 6, YES under the same parent), both at the reply floor;
 *   · row 6 is the LAST planned row of market A while its parent is the first,
 *     which is what makes the chunked run resolve a parent from an earlier
 *     chunk rather than from memory;
 *   · one blank label (row 3) — a brand-new participant for that row alone.
 */
const BATCH: readonly RawSeedRow[] = [
	row(1, {
		market: MARKET_A,
		user: "alpha",
		side: "YES",
		stake: BET_MIN_STAKE_POST,
		argument: "alpha opens YES on A",
	}),
	row(2, {
		market: MARKET_A,
		user: "beta",
		side: "NO",
		stake: BET_MIN_STAKE_REPLY,
		argument: "beta counters alpha on A",
		replyTo: "1",
	}),
	row(3, {
		market: MARKET_A,
		user: "",
		side: "YES",
		stake: BET_MIN_STAKE_POST,
		argument: "an unlabelled participant posts on A",
	}),
	row(4, {
		market: MARKET_B,
		user: "alpha",
		side: "NO",
		stake: BET_MIN_STAKE_POST,
		argument: "alpha opens NO on B",
	}),
	row(5, {
		market: MARKET_B,
		user: "beta",
		side: "NO",
		stake: BET_MIN_STAKE_POST,
		argument: "beta joins NO on B",
	}),
	row(6, {
		market: MARKET_A,
		user: "gamma",
		side: "YES",
		stake: BET_MIN_STAKE_REPLY,
		argument: "gamma supports alpha on A",
		replyTo: "1",
	}),
];

/** Market A's group runs to its end before market B's — §6 steps 3 and 5. */
const PLANNED_ROW_ORDER = [1, 2, 3, 6, 4, 5];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"events",
		"dharma_ledger",
		"lots",
		"bets",
		"comments",
		"positions",
		"bet_receipts",
		"pools",
		"market_media",
		"markets",
		"users",
		"accounts",
		"sessions",
		"verifications",
		"identity_pool",
	]);
}

async function seedIdentityPool(): Promise<void> {
	// Row by row: `consume.ts` orders FIFO by (created_at, id), and one
	// multi-row INSERT would stamp every tuple with the same `now()`.
	for (const tuple of TUPLES) {
		await testDb.insert(identityPool).values({ ...tuple, assignedAt: null });
	}
}

/** Draft → Open through the real W-4 flows. Never a hand-inserted pool row. */
async function createOpenMarket(slug: string): Promise<{
	marketId: string;
	yesReserves: string;
	noReserves: string;
}> {
	const marketId = uuidv7();
	const mediaId = uuidv7();
	await createMarket({
		marketId,
		slug,
		title: "PLACEHOLDER — not a real market",
		description: "PLACEHOLDER criterion — not a real criterion",
		resolutionDeadline: DEADLINE,
		media: [
			{
				mediaId,
				key: `m/${marketId}/${mediaId}.png`,
				displayOrder: 0,
				isDefault: true,
			},
		],
		mediaVideoUrl: null,
		now: NOW,
		metadata: adminMetadata("F-ADMIN-1"),
	});
	const opened = await openMarket({
		marketId,
		openingPriceYes: "0.5",
		tank: "1000",
		now: NOW,
		metadata: adminMetadata("F-ADMIN-2"),
	});
	return {
		marketId,
		yesReserves: opened.yesReserves,
		noReserves: opened.noReserves,
	};
}

async function countRows(): Promise<{
	users: number;
	bets: number;
	comments: number;
	ledger: number;
	receipts: number;
}> {
	const [counts] = await testDb
		.select({
			users: sql<number>`(SELECT count(*) FROM users)::int`,
			bets: sql<number>`(SELECT count(*) FROM bets)::int`,
			comments: sql<number>`(SELECT count(*) FROM comments)::int`,
			ledger: sql<number>`(SELECT count(*) FROM dharma_ledger)::int`,
			receipts: sql<number>`(SELECT count(*) FROM bet_receipts)::int`,
		})
		.from(sql`(SELECT 1) AS one`);
	return counts ?? { users: 0, bets: 0, comments: 0, ledger: 0, receipts: 0 };
}

async function commentsByBody(): Promise<
	Map<
		string,
		{
			id: string;
			userId: string;
			marketId: string;
			side: "YES" | "NO";
			parentCommentId: string | null;
		}
	>
> {
	const rows = await testDb
		.select({
			id: comments.id,
			userId: comments.userId,
			marketId: comments.marketId,
			body: comments.body,
			side: comments.sideAtPostTime,
			parentCommentId: comments.parentCommentId,
		})
		.from(comments);
	return new Map(rows.map((r) => [r.body, r]));
}

async function poolFor(marketId: string): Promise<{
	yesReserves: string;
	noReserves: string;
}> {
	const [pool] = await testDb
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId));
	return pool ?? { yesReserves: "", noReserves: "" };
}

function statusOf(results: readonly SeedRowResult[]): string[] {
	return results.map((r) => r.status);
}

// ── Environment ─────────────────────────────────────────────────────────────
// `tests/_setup/env.ts` defaults the suite to `prod` — the value that REFUSES.
// Every test that needs the tool to run says so, and the original is restored
// afterwards, so a test that forgets exercises a refusal rather than inheriting
// permission from whichever file ran before it.

let savedEnv: string | undefined;
let savedSeedFlag: string | undefined;

/**
 * "staging" means the staging DEPLOYMENT: ZUGZWANG_ENV=staging AND the
 * ZUGZWANG_SEED_TOOLS flag its task definition carries (ADR-0064, C-1). Any
 * other value sets the environment and CLEARS the flag — a deployment whose
 * task does not carry it.
 */
function setEnv(value: string | undefined): void {
	if (value === undefined) delete process.env.ZUGZWANG_ENV;
	else process.env.ZUGZWANG_ENV = value;
	if (value === "staging") process.env.ZUGZWANG_SEED_TOOLS = "enabled";
	else delete process.env.ZUGZWANG_SEED_TOOLS;
}

function restoreEnv(): void {
	setEnv(savedEnv);
	if (savedSeedFlag === undefined) delete process.env.ZUGZWANG_SEED_TOOLS;
	else process.env.ZUGZWANG_SEED_TOOLS = savedSeedFlag;
}

beforeEach(async () => {
	savedEnv = process.env.ZUGZWANG_ENV;
	savedSeedFlag = process.env.ZUGZWANG_SEED_TOOLS;
	setEnv("staging");
	await truncateAll();
	await seedIdentityPool();
});

afterEach(async () => {
	restoreEnv();
	await truncateAll();
});

describe("seed-run — one upload, through the real engine (§8)", () => {
	it("seed-run::posts-every-row-through-the-engine", async () => {
		const a = await createOpenMarket(MARKET_A);
		const b = await createOpenMarket(MARKET_B);
		// Cleared AFTER setup so the Sentry assertion below is about the SEED RUN
		// and not about two market opens.
		vi.clearAllMocks();

		const run = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});

		// ── the chunk contract ────────────────────────────────────────────────
		expect(run.errors).toEqual([]);
		expect(statusOf(run.results)).toEqual(Array(6).fill("posted"));
		expect(run.nextIndex).toBe(6);
		expect(run.done).toBe(true);
		expect(run.haltedMarkets).toEqual([]);
		// §6 steps 3–5: market A's group runs to its end, THEN market B's. The
		// sheet order is A,A,A,B,B,A — so a results list in sheet order would
		// mean the groups were never formed, and "a failure in one market stops
		// that market only" would have nothing to stop.
		expect(run.results.map((r) => r.rowNumber)).toEqual(PLANNED_ROW_ORDER);
		expect(run.results.map((r) => r.marketSlug)).toEqual([
			MARKET_A,
			MARKET_A,
			MARKET_A,
			MARKET_A,
			MARKET_B,
			MARKET_B,
		]);

		// ── participants came from the identity pool ──────────────────────────
		// Four, not six: `alpha` and `beta` each post twice under one label, and
		// the blank row is its own person (§4).
		const userRows = await testDb
			.select({
				id: users.id,
				email: users.email,
				pseudonym: users.pseudonym,
				pfpFilename: users.pfpFilename,
				tosAcceptedAt: users.tosAcceptedAt,
			})
			.from(users);
		expect(userRows.length).toBe(4);
		for (const user of userRows) {
			// G4 — the reserved `.invalid` domain. A seeded account can never
			// belong to a real person and is greppable in one query.
			expect(user.email.endsWith(SEED_DOMAIN)).toBe(true);
			// The pool assigned these. No caller may write a pseudonym, so a
			// non-null value here IS the evidence that `user.create.before` →
			// `consumeIdentityPoolTuple` ran (ADR-0011).
			expect(user.pseudonym).toBeTruthy();
			expect(user.pfpFilename).toBeTruthy();
			expect(user.tosAcceptedAt).not.toBeNull();
		}
		expect(new Set(userRows.map((u) => u.pseudonym)).size).toBe(4);
		expect(
			new Set(userRows.map((u) => u.email).map((e) => e.toLowerCase())).size,
		).toBe(4);
		// The pool gave up exactly four tuples — the count on the other side of
		// the same fact, so a hand-written pseudonym could not satisfy both.
		const [assigned] = await testDb
			.select({ n: sql<number>`count(*)::int` })
			.from(identityPool)
			.where(sql`${identityPool.assignedAt} IS NOT NULL`);
		expect(assigned?.n).toBe(4);
		// Every posted row reports the pseudonym its participant was given.
		expect(run.results.every((r) => (r.pseudonym ?? "") !== "")).toBe(true);

		// ── I-GRANT-ONCE-001: exactly one initial_grant per participant ───────
		const grants = await testDb
			.select({ userId: dharmaLedger.userId, amount: dharmaLedger.amount })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "initial_grant"));
		expect(grants.length).toBe(4);
		expect(new Set(grants.map((g) => g.userId)).size).toBe(4);
		for (const grant of grants) {
			expect(Number(grant.amount)).toBe(Number(INITIAL_USER_DHARMA));
		}

		// ── INV-1 / INV-3: the bet-comment spine ──────────────────────────────
		const betRows = await testDb
			.select({
				id: bets.id,
				commentId: bets.commentId,
				side: bets.side,
				marketId: bets.marketId,
			})
			.from(bets);
		expect(betRows.length).toBe(6);
		// INV-1's built half: not one bet without its comment.
		expect(betRows.filter((row) => row.commentId === null)).toEqual([]);
		const byBody = await commentsByBody();
		expect(byBody.size).toBe(6);

		const parent = byBody.get("alpha opens YES on A");
		expect(parent).toBeDefined();
		// INV-3 — the side each comment froze is the side its row named, and the
		// reply's own side rather than its parent's (ADR-0017 Support/Counter is
		// DERIVED at read time from these two, never stored).
		expect(parent?.side).toBe("YES");
		expect(byBody.get("beta counters alpha on A")?.side).toBe("NO");
		expect(byBody.get("gamma supports alpha on A")?.side).toBe("YES");
		expect(byBody.get("an unlabelled participant posts on A")?.side).toBe(
			"YES",
		);
		expect(byBody.get("alpha opens NO on B")?.side).toBe("NO");
		expect(byBody.get("beta joins NO on B")?.side).toBe("NO");

		// Both replies hang off row 1's comment, and nothing else does — flat,
		// REPLY_DEPTH_MAX = 1.
		expect(byBody.get("beta counters alpha on A")?.parentCommentId).toBe(
			parent?.id,
		);
		expect(byBody.get("gamma supports alpha on A")?.parentCommentId).toBe(
			parent?.id,
		);
		expect(
			[...byBody.values()].filter((c) => c.parentCommentId !== null).length,
		).toBe(2);
		// Markets did not bleed into one another: four comments in A, two in B.
		expect(
			[...byBody.values()].filter((c) => c.marketId === a.marketId).length,
		).toBe(4);
		expect(
			[...byBody.values()].filter((c) => c.marketId === b.marketId).length,
		).toBe(2);

		// `alpha` is ONE participant across both markets — the label column's
		// entire purpose (§4).
		const alphaIds = new Set([
			byBody.get("alpha opens YES on A")?.userId,
			byBody.get("alpha opens NO on B")?.userId,
		]);
		expect(alphaIds.size).toBe(1);

		// ── §8 Provenance: every event this tool caused is tagged ─────────────
		const expectedRequestId = `${SEED_REQUEST_ID_PREFIX}${run.batchId.slice(0, 16)}`;
		const eventRows = await testDb
			.select({ eventType: events.eventType, metadata: events.metadata })
			.from(events)
			.where(inArray(events.eventType, ["bet.placed", "comment.placed"]));
		expect(eventRows.length).toBe(12);
		for (const event of eventRows) {
			// `metadata` is jsonb — cast at the trust boundary, as every reader of
			// this column does.
			const requestId = (event.metadata as { request_id?: unknown }).request_id;
			expect(requestId).toBe(expectedRequestId);
			expect(String(requestId).startsWith(SEED_REQUEST_ID_PREFIX)).toBe(true);
		}

		// ── the CPMM actually ran ─────────────────────────────────────────────
		// Both pools moved off their opening reserves. A `bets` row beside a
		// static pool is precisely the shape a hand-written fixture produces.
		const poolA = await poolFor(a.marketId);
		const poolB = await poolFor(b.marketId);
		expect(poolA).not.toEqual({
			yesReserves: a.yesReserves,
			noReserves: a.noReserves,
		});
		expect(poolB).not.toEqual({
			yesReserves: b.yesReserves,
			noReserves: b.noReserves,
		});
		// Every posted row reports the price it left behind, strictly inside
		// (0,1) — a decimal string, never a float (CLAUDE.md §2).
		for (const result of run.results) {
			const price = Number(result.newPrice);
			expect(result.newPrice).toMatch(/^\d+\.\d+$/);
			expect(price).toBeGreaterThan(0);
			expect(price).toBeLessThan(1);
		}

		// The engine's fail-open channels report through Sentry and then
		// CONTINUE, so a stubbed client nobody reads back is a blind spot for the
		// whole run rather than noise suppression (the staging generator's
		// lesson). Reading it back turns the stub into evidence.
		const Sentry = await import("@sentry/nextjs");
		expect(vi.mocked(Sentry.captureException).mock.calls).toEqual([]);
	}, 60_000);

	it("seed-run::re-running-the-same-batch-changes-nothing", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);

		const first = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});
		expect(statusOf(first.results)).toEqual(Array(6).fill("posted"));
		const before = await countRows();
		expect(before).toEqual({
			users: 4,
			bets: 6,
			comments: 6,
			ledger: before.ledger,
			receipts: 6,
		});

		// The §12 verification step 2, as a test: the operator uploads the same
		// file again. The batch id is derived from the content, so the keys are
		// the same keys, and the `bet_receipts` unique (ADR-0031 /
		// I-IDEM-ONCE-001) is what makes the second attempt a no-op.
		const second = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});

		expect(second.errors).toEqual([]);
		expect(second.batchId).toBe(first.batchId);
		expect(statusOf(second.results)).toEqual(Array(6).fill("skipped"));
		expect(second.done).toBe(true);
		// NOT ONE new row, on any of the five tables a row touches. The ledger is
		// included because the bet stake, the daily credit and the grant all land
		// there — a re-run that re-charged a participant would show up here first.
		expect(await countRows()).toEqual(before);
		// And no second participant was minted under a new email, which is what
		// a non-deterministic blank-label address would have produced.
		const emails = await testDb.select({ email: users.email }).from(users);
		expect(emails.length).toBe(4);
	}, 90_000);

	it("seed-run::resumes-across-chunks-including-a-reply-whose-parent-ran-earlier", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);

		// §5: there is no stored job state — the browser holds the rows and sends
		// the WHOLE batch every call with a moving window. Chunks of two, so the
		// six rows take three calls and `haltedMarkets` is threaded through all
		// of them exactly as the client loop does.
		const seen: SeedRowResult[] = [];
		let fromIndex = 0;
		let halted: readonly string[] = [];
		let batchId = "";
		let guard = 0;
		for (;;) {
			guard += 1;
			if (guard > 10) throw new Error("chunk loop did not terminate");
			const chunk = await runSeedChunk({
				rows: BATCH,
				fromIndex,
				count: 2,
				haltedMarkets: halted,
			});
			expect(chunk.errors).toEqual([]);
			// The id is content-derived, so it cannot move between chunks — if it
			// did, every chunk would mint its own keys and a resume would
			// duplicate instead of skipping.
			if (batchId === "") batchId = chunk.batchId;
			expect(chunk.batchId).toBe(batchId);
			expect(chunk.results.length).toBeLessThanOrEqual(2);
			expect(chunk.nextIndex).toBe(fromIndex + chunk.results.length);
			seen.push(...chunk.results);
			fromIndex = chunk.nextIndex;
			halted = chunk.haltedMarkets;
			if (chunk.done) break;
		}

		expect(guard).toBe(3);
		expect(statusOf(seen)).toEqual(Array(6).fill("posted"));
		expect(seen.map((r) => r.rowNumber)).toEqual(PLANNED_ROW_ORDER);

		// THE POINT OF THE CHUNKING TEST. Row 6 replies to row 1, and the planned
		// order puts them in DIFFERENT chunks — so the parent's `comments.id`
		// cannot come from anything the second call held in memory. §7 says it is
		// resolved from row 1's bet receipt, and this is the assertion that the
		// resolution happened rather than the reply being quietly posted flat.
		const byBody = await commentsByBody();
		const parent = byBody.get("alpha opens YES on A");
		expect(parent).toBeDefined();
		expect(byBody.get("gamma supports alpha on A")?.parentCommentId).toBe(
			parent?.id,
		);
		expect(byBody.get("beta counters alpha on A")?.parentCommentId).toBe(
			parent?.id,
		);

		const counts = await countRows();
		expect(counts.bets).toBe(6);
		expect(counts.comments).toBe(6);
		expect(counts.users).toBe(4);
	}, 90_000);
});

describe("seed-run — failure modes (§6 step 5)", () => {
	it("seed-run::a-failed-row-halts-its-market-and-leaves-the-others-alone", async () => {
		const a = await createOpenMarket(MARKET_A);
		const b = await createOpenMarket(MARKET_B);

		// ARRANGE a failure the SHEET cannot be blamed for. `delta` already holds
		// NO in market A from an earlier run, so a later batch that puts them on
		// YES is refused by `place()` with `OppositeSideHeldError` (F-BET-10 /
		// I-SINGLE-SIDE). Cross-row validation only sees ONE sheet, so this row
		// is perfectly valid on paper and fails inside the engine — which is the
		// only way to reach the `failed` / `halted` arms at all.
		const warmUp = await runSeedChunk({
			rows: [
				row(1, {
					market: MARKET_A,
					user: "delta",
					side: "NO",
					argument: "delta takes NO on A first",
				}),
			],
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});
		expect(statusOf(warmUp.results)).toEqual(["posted"]);

		const target: readonly RawSeedRow[] = [
			row(1, {
				market: MARKET_A,
				user: "delta",
				side: "YES",
				argument: "delta tries to flip to YES on A",
			}),
			row(2, {
				market: MARKET_A,
				user: "epsilon",
				side: "YES",
				argument: "epsilon posts on A behind the failure",
			}),
			row(3, {
				market: MARKET_B,
				user: "zeta",
				side: "YES",
				argument: "zeta posts on B",
			}),
		];

		const run = await runSeedChunk({
			rows: target,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});

		// The sheet itself is valid — this is an ENGINE refusal, not a
		// validation one, and the two are reported through different channels.
		expect(run.errors).toEqual([]);
		expect(statusOf(run.results)).toEqual(["failed", "halted", "posted"]);
		expect(run.results.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
		// The report says exactly where market A stopped (§6 step 5) …
		expect(run.results[0]?.message).toBeTruthy();
		expect(run.haltedMarkets).toEqual([MARKET_A]);
		// … and market B, which shares nothing with it, completed.
		expect(run.results[2]?.marketSlug).toBe(MARKET_B);

		// Market A holds ONLY the warm-up bet: the failed row rolled back whole
		// (the W-1 transaction is all-or-nothing) and the halted row was never
		// attempted.
		const aBets = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, a.marketId));
		expect(aBets.length).toBe(1);
		const bBets = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, b.marketId));
		expect(bBets.length).toBe(1);

		// A halted row is not executed, so it mints no participant either — the
		// identity pool is a finite resource on staging (§13) and a halted row
		// that consumed a tuple would spend it on an argument nobody posted.
		const emails = await testDb.select({ email: users.email }).from(users);
		expect(
			emails.filter((u) => u.email.includes("epsilon")).map((u) => u.email),
		).toEqual([]);
		// delta (reused) and zeta (new) only.
		expect(emails.length).toBe(2);

		// The failed row left no receipt, so a corrected re-upload can retry it
		// rather than reporting it `skipped` forever.
		const receipts = await testDb
			.select({ key: betReceipts.idempotencyKey })
			.from(betReceipts);
		expect(receipts.length).toBe(2);
	}, 90_000);

	it("seed-run::a-market-that-left-Open-mid-run-halts-alone-and-receives-nothing [plan §6.1 ruling]", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);
		// A market closes AFTER the preview passed — its deadline arriving while
		// a sheet is seeding is the realistic case, since a run takes minutes.
		// Plan §6.1 (ruled at implementation, superseding the first draft's "the
		// whole batch refuses"): the PREVIEW validates against Open markets only,
		// so a market that is already shut is caught before anything runs. At
		// RUN time a market leaving Open halts ITS rows and no others — refusing
		// five healthy markets for one market's state change would make every
		// close deadline a whole-sheet failure.
		//
		// What must still hold, and what this test pins:
		//   - NOTHING is written into the closed market (no bet, no comment).
		//   - Its rows mint NO participant: the status is checked before the
		//     participant is created, so a row that cannot post spends no
		//     identity-pool tuple.
		//   - The halt is reported per row, so the operator sees exactly which
		//     rows did not run.
		//   - The other market posts normally.
		await closeMarket({
			marketId: (
				await testDb
					.select({ id: markets.id })
					.from(markets)
					.where(eq(markets.slug, MARKET_A))
			)[0]?.id as string,
			now: new Date(DEADLINE.getTime() + 1),
			metadata: adminMetadata("W-4-CLOSE"),
		});

		const run = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});

		// Asserted as ONE object so the diff shows what the run actually did:
		// "A's rows reported failed/halted" and "A's rows posted into a Closed
		// market" are opposite defects a count alone cannot tell apart.
		expect({
			errors: run.errors,
			results: run.results.map((r) => `${r.rowNumber}:${r.status}`),
			halted: run.haltedMarkets,
		}).toEqual({
			errors: [],
			// Planned order is market A's group, then B's.
			results: [
				"1:failed",
				"2:halted",
				"3:halted",
				"6:halted",
				"4:posted",
				"5:posted",
			],
			halted: [MARKET_A],
		});
		expect(run.results[0]?.message).toMatch(/Closed, not Open/);

		const marketId = async (slug: string) =>
			(
				await testDb
					.select({ id: markets.id })
					.from(markets)
					.where(eq(markets.slug, slug))
			)[0]?.id as string;
		const betsIn = async (slug: string) =>
			(
				await testDb
					.select({ id: bets.id })
					.from(bets)
					.where(eq(bets.marketId, await marketId(slug)))
			).length;
		expect(await betsIn(MARKET_A)).toBe(0);
		expect(await betsIn(MARKET_B)).toBe(2);

		// Only B's two participants exist: A's rows minted nobody, including the
		// unlabelled row 3 and gamma, who appear nowhere else in the batch.
		const emails = (await testDb.select({ email: users.email }).from(users))
			.map((u) => u.email)
			.sort();
		expect(emails).toEqual([
			"seed-alpha@seed.staging.invalid",
			"seed-beta@seed.staging.invalid",
		]);
	}, 60_000);

	it("seed-run::refuses-after-the-conclusion-freeze-and-writes-nothing [@code-reviewer H-1]", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);
		const before = await countRows();
		// The bet route refuses with 410 once `frozen_at` is set, and neither
		// `place()` nor `runBetTransaction` re-checks it — so a path that skips
		// the route must carry the check, and must refuse the WHOLE batch rather
		// than fail rows (nothing is wrong with the sheet).
		mockIsFrozen.mockResolvedValueOnce(true);
		const run = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});
		expect(run.results).toEqual([]);
		expect(run.errors.map((e) => e.rowNumber)).toEqual([0]);
		expect(run.errors[0]?.message).toMatch(/concluded/);
		expect(await countRows()).toEqual(before);
	}, 60_000);

	it("seed-run::a-concurrent-run-is-refused-before-any-write [@code-reviewer H-2]", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);
		const before = await countRows();
		// Another chunk holds the deployment-wide lock: SET NX answers null. Two
		// overlapping runs could otherwise both miss one email and strand an
		// identity-pool tuple, so the loser must refuse before minting anyone.
		mockRedis.set.mockResolvedValueOnce(null as never);
		const run = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});
		expect(run.results).toEqual([]);
		expect(run.errors.map((e) => e.rowNumber)).toEqual([0]);
		expect(run.errors[0]?.message).toMatch(/in progress/);
		expect(await countRows()).toEqual(before);

		// Positive control: the next call (lock free) proceeds and posts.
		const next = await runSeedChunk({
			rows: BATCH,
			fromIndex: 0,
			count: 25,
			haltedMarkets: [],
		});
		expect(next.errors).toEqual([]);
		expect(next.results.every((r) => r.status === "posted")).toBe(true);
	}, 90_000);

	it("seed-run::refuses-without-the-flag-and-writes-nothing [plan §3 G2]", async () => {
		await createOpenMarket(MARKET_A);
		await createOpenMarket(MARKET_B);
		const before = await countRows();

		// G2. The gate is the FIRST thing `runSeedChunk` does — before the
		// validation read, before any participant is looked up — so a deployment
		// whose task does not carry ZUGZWANG_SEED_TOOLS cannot run this even if
		// every other guard were edited away. `setEnv("prod")` clears the flag:
		// production WITH the flag is allowed since SEED-PROD-1 (gate.test.ts).
		setEnv("prod");
		await expect(
			runSeedChunk({
				rows: BATCH,
				fromIndex: 0,
				count: 25,
				haltedMarkets: [],
			}),
		).rejects.toBeInstanceOf(SeedToolsDisabledError);

		// It THROWS rather than returning an error list: a refusal that came back
		// in the `errors` array would be indistinguishable from a bad sheet, and
		// an operator would set about fixing their file.
		expect(await countRows()).toEqual(before);
	}, 60_000);
});

describe("seed-run — recordTosAcceptance, the extraction §8 requires", () => {
	/** A user row with no ToS evidence yet — the state a fresh signup is in. */
	async function seedUnacceptedUser(tag: string): Promise<string> {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Seed ToS User",
				email: `${tag}${SEED_DOMAIN}`,
				pseudonym: `SeedToS-${tag}`,
			})
			.returning({ id: users.id });
		return user?.id ?? "";
	}

	function tosMetadata(userId: string) {
		return {
			request_id: `${SEED_REQUEST_ID_PREFIX}0123456789abcdef`,
			flow_id: "F-AUTH-4",
			user_id: userId,
			actor_id: userId,
			idempotency_key: null,
			ip: "0.0.0.0",
			user_agent: "zugzwang-seed-staging",
		};
	}

	async function grantsFor(userId: string): Promise<number> {
		const rows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(
				sql`${dharmaLedger.userId} = ${userId} AND ${dharmaLedger.entryType} = 'initial_grant'`,
			);
		return rows.length;
	}

	it("seed-run::records-tos-and-grants-once-for-a-synthetic-user", async () => {
		const userId = await seedUnacceptedUser("tos-first");

		// No cookies, no headers, no `onboarding_ref` — and none mocked. That is
		// the whole reason this function exists apart from `acceptTosAction`.
		const accepted = await recordTosAcceptance({
			userId,
			ip: "0.0.0.0",
			userAgent: "zugzwang-seed-staging",
			metadata: tosMetadata(userId),
		});

		expect(accepted).toBe(true);
		const [user] = await testDb
			.select({
				tosAcceptedAt: users.tosAcceptedAt,
				ip: users.tosAcceptanceIp,
				ua: users.tosAcceptanceUserAgent,
				tosHash: users.tosVersionHash,
				privacyHash: users.privacyVersionHash,
			})
			.from(users)
			.where(eq(users.id, userId));
		// All five acceptance-evidence columns, because behaviour-preserving
		// means the evidence a seeded account carries is the same evidence a real
		// one does (SPEC.2 §3.5).
		expect(user?.tosAcceptedAt).not.toBeNull();
		expect(user?.ip).toBe("0.0.0.0");
		expect(user?.ua).toBe("zugzwang-seed-staging");
		expect(user?.tosHash).toBeTruthy();
		expect(user?.privacyHash).toBeTruthy();

		expect(await grantsFor(userId)).toBe(1);
		// Both halves of the first-acceptance branch emitted, in ONE transaction:
		// the acceptance and the grant that rides it (ENGINE.13 R1a). `events` is
		// Bucket A, so these are the permanent record of a seeded account's
		// provenance — which is why the metadata carries the seed request id.
		const emitted = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(eq(events.aggregateId, userId));
		expect(emitted.map((e) => e.eventType).sort()).toEqual([
			"dharma.granted",
			"user.tos_accepted",
		]);
	}, 30_000);

	it("seed-run::a-second-acceptance-returns-true-and-grants-nothing-again", async () => {
		// I-GRANT-ONCE-001. The tool is re-run by design, so this path is taken
		// on every repeat upload — and the grant is the one write that must never
		// happen twice (the partial unique index `dharma_ledger_initial_grant_
		// user_uq` is the loud backstop; this is the quiet correct path).
		const userId = await seedUnacceptedUser("tos-twice");

		expect(
			await recordTosAcceptance({
				userId,
				ip: "0.0.0.0",
				userAgent: "zugzwang-seed-staging",
				metadata: tosMetadata(userId),
			}),
		).toBe(true);
		const [afterFirst] = await testDb
			.select({ tosAcceptedAt: users.tosAcceptedAt })
			.from(users)
			.where(eq(users.id, userId));

		// `true` on the second call, not `false`: the return distinguishes "there
		// is no such user" from "already accepted", and a re-run must read the
		// second as success or it would report a working participant as broken.
		expect(
			await recordTosAcceptance({
				userId,
				ip: "9.9.9.9",
				userAgent: "a-different-agent",
				metadata: tosMetadata(userId),
			}),
		).toBe(true);

		expect(await grantsFor(userId)).toBe(1);
		const [afterSecond] = await testDb
			.select({
				tosAcceptedAt: users.tosAcceptedAt,
				ip: users.tosAcceptanceIp,
				ua: users.tosAcceptanceUserAgent,
			})
			.from(users)
			.where(eq(users.id, userId));
		// The original evidence is untouched — the second call is a no-op, not an
		// overwrite. Acceptance is a historical fact and the later IP is not it.
		expect(afterSecond?.tosAcceptedAt?.toISOString()).toBe(
			afterFirst?.tosAcceptedAt?.toISOString(),
		);
		expect(afterSecond?.ip).toBe("0.0.0.0");
		expect(afterSecond?.ua).toBe("zugzwang-seed-staging");
		// Still ONE acceptance and ONE grant, not two of each — `events` is
		// Bucket A, so a duplicate emitted here could never be taken back.
		const emitted = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(eq(events.aggregateId, userId));
		expect(emitted.map((e) => e.eventType).sort()).toEqual([
			"dharma.granted",
			"user.tos_accepted",
		]);
	}, 30_000);

	it("seed-run::returns-false-for-a-user-that-does-not-exist", async () => {
		// §16: "false = user row missing". It must not throw and must not write
		// — a missing row is the seeding loop's signal to report the row, not a
		// 500 that strands whatever came before it.
		const missing = uuidv7();

		expect(
			await recordTosAcceptance({
				userId: missing,
				ip: "0.0.0.0",
				userAgent: "zugzwang-seed-staging",
				metadata: tosMetadata(missing),
			}),
		).toBe(false);

		expect(await grantsFor(missing)).toBe(0);
		const ledger = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger);
		expect(ledger).toEqual([]);
		const emitted = await testDb
			.select({ id: events.eventId })
			.from(events)
			.where(eq(events.aggregateId, missing));
		expect(emitted).toEqual([]);
	}, 30_000);
});
