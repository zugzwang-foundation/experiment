import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// I-IDEM-NOMASK-001 (MINTED by S-7, plan §1). THE RULE, SCOPED PRECISELY: a
// SINGLE REQUEST's own cached non-2xx response never coexists with THAT SAME
// REQUEST's own committed transaction. Read the scope narrowly — it is not the
// general "a cached non-2xx never coexists with any committed transaction under
// the key," which is FALSE (see below).
//
// ⚠ READ THIS BEFORE JUDGING ITS COLOUR: this spec is GREEN on the day it is
// written, and that is correct. It is a REGRESSION GUARD (the AGENTS.md §9
// `_probe-*` posture, applied to an invariant rather than a vendor shape), NOT a
// TDD driver. Nobody should later read it as a broken red-first test.
//
// ⚠ THIS IS NOT THE ONLY CONTROL ON THE DOUBLE-CHARGE HAZARD, AND ITS PASSING
// DOES NOT MEAN DC-a IS DEAD CODE. This file's five cases are each a single
// request end to end — each proves that request's own error paths (rate-limit,
// validation, moderation, durable-mismatch, post-tx-mismatch) cannot coexist
// with that same request's own commit. That is real, and it is what R-D
// (`docs/adr/0044-*.md`, "DC" section) actually established. It does NOT cover
// — and an earlier version of this file's comment wrongly claimed it did cover
// — a CROSS-request case: an earlier request commits and writes a receipt,
// Redis later loses that entry, a LATER, different request under the same key
// has its own durable pre-check blind at that exact moment (a fail-open,
// `endpoint.ts` step 3.5), and terminates in a genuinely-cached rejection sitting
// beside the earlier request's real receipt. `case "hit"`'s own durable consult
// on a cached non-2xx ("DC-a", reinstated at ADR-0044 after this exact gap was
// found by security audit) is what catches that — see
// `tests/integration/cross-user-idempotency.integration.test.ts`'s
// `case-hit-consults-receipt-before-trusting-a-stale-cached-rejection`, which
// constructs precisely this pair (a cached 429 sitting beside a real receipt
// under the same key) and would fail red if DC-a were removed. If you are
// reading this file to decide whether that block in `endpoint.ts` is safe to
// delete: it is not. This file does not prove that.
//
// Why THIS file exists, given DC-a already exists. S-7 opened by hunting a
// double-charge: a cached error masking a transaction that HAD committed, so
// the participant is told "that failed" while the money moved, and every retry
// is answered out of the cache with the same lie. This file guards the
// single-request half of that question — a regression that made some FUTURE
// error path cache a non-2xx AFTER that same request's own commit (which
// nothing today does; the five classes here are exhaustive over the request's
// own error arms) would go red here, at CI, before DC-a would ever need to
// intervene at runtime. It is deliberately NOT written against the TTL-nesting
// argument (idem sentinel 30s outliving the mod-reserve 10s), because a TTL is a
// number someone may retune; it is written against the arms themselves.
//
// The five reachable classes, per plan §1:
//   1. 429 rate-limit                       → CACHED  → and no receipt exists.
//   2. 409 durable-receipt mismatch         → NEVER CACHED (poison guard).
//   3. the 4xx validation/floor/comment/reply/image family → CACHED → no receipt.
//   4. 409 ModerationInFlightError          → CACHED  → and no receipt exists.
//   5. 409 23505 receipt-mismatch           → NEVER CACHED (`noCache: true`).
//
// ⚠ TWO OF THE FIVE CANNOT ASSERT "ZERO RECEIPTS", AND MUST NOT. Classes 2 and 5
// are only REACHABLE when a receipt already exists under the key — that is what
// the word "mismatch" means in both of their names. Demanding zero receipts
// there would be demanding they be unreachable. What holds for them is the
// stronger half of the same rule: their 409 is never written to the cache at
// all, so the invariant's antecedent is false. Pinning that non-caching is
// load-bearing rather than pedantic — a regression that started caching either
// one would manufacture the exact (cached non-2xx, committed transaction) pair
// this file forbids, under a key whose rightful owner has already paid.
//
// Substrate: the REAL `@/server/idempotency/cache` over a file-local in-memory
// Redis, so "cached" means what it means in production — a completed response
// persisted under the idempotency key — rather than "release was called with an
// argument". The store is read SHAPE-AGNOSTICALLY (any `:idem:` key ending in
// `:{K}`), so this spec reads identically before and after S-7's G2 re-keying.
// Route-backed against local Postgres.

const {
	mockGetSession,
	mockCheckRateLimit,
	mockPrecommit,
	redisStore,
	mockRedis,
	replayControl,
} = vi.hoisted(() => {
	const store = new Map<string, string>();
	return {
		mockGetSession: vi.fn(),
		mockCheckRateLimit: vi.fn(),
		mockPrecommit: vi.fn(),
		redisStore: store,
		mockRedis: {
			set: vi.fn(
				async (
					key: string,
					value: string,
					opts?: { nx?: boolean; ex?: number },
				) => {
					if (opts?.nx === true && store.has(key)) return null;
					store.set(key, value);
					return "OK";
				},
			),
			get: vi.fn(async (key: string) => store.get(key) ?? null),
			del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
			eval: vi.fn(async (script: string, keys: string[], argv: string[]) => {
				const key = keys[0] ?? "";
				const owner = argv[0] ?? "";
				if (store.get(key) !== owner) return 0;
				if (script.includes("DEL")) {
					store.delete(key);
					return 1;
				}
				store.set(key, argv[1] ?? "");
				return "OK";
			}),
		},
		// Class 5 only: suppress ONE `loadDurableReplay` call (the step-3.5
		// pre-check) so execution reaches the transaction and the route's post-tx
		// 23505 catch is the arm that answers. It is the only route to that arm.
		replayControl: { suppressNextPrecheck: false },
	};
});

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));
vi.mock("@/server/bets/replay", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/server/bets/replay")>();
	return {
		...actual,
		loadDurableReplay: (
			...args: Parameters<typeof actual.loadDurableReplay>
		): ReturnType<typeof actual.loadDurableReplay> => {
			if (replayControl.suppressNextPrecheck) {
				replayControl.suppressNextPrecheck = false;
				return Promise.resolve(null);
			}
			return actual.loadDurableReplay(...args);
		},
	};
});

import { POST as placePOST } from "@/app/api/bets/place/route";
import { betReceipts, bets, markets, pools, users } from "@/db/schema";
import { ModerationInFlightError } from "@/lib/errors";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED_RESERVES = "1000.000000000000000000";
const PHANTOM_UUID = "01920000-0000-7000-8000-0000000000ff";

function placeReq(body: unknown, key: string, userId: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": key,
			"x-forwarded-for": "203.0.113.78",
			"x-test-user": userId,
			"user-agent": "vitest-nomask",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "NoMask User",
			email: `nomask-${tag}@example.com`,
			pseudonym: `nomask-${tag}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "5000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "NoMask Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

/**
 * The completed response cached under `key`, located WITHOUT constructing the
 * Redis key — `{env}:idem:{K}` today, `{env}:idem:{U}:{K}` after S-7's G2, and
 * this spec must read the same on both sides. `null` = nothing cached.
 */
function cachedFor(key: string): { status: number; body: unknown } | null {
	for (const [redisKey, value] of redisStore) {
		if (!redisKey.includes(":idem:") || !redisKey.endsWith(`:${key}`)) continue;
		if (value.startsWith("PENDING:")) continue;
		return JSON.parse(value) as { status: number; body: unknown };
	}
	return null;
}

function receiptsFor(key: string) {
	return testDb
		.select({
			id: betReceipts.id,
			bodyFingerprint: betReceipts.bodyFingerprint,
			userId: betReceipts.userId,
			result: betReceipts.result,
			createdAt: betReceipts.createdAt,
		})
		.from(betReceipts)
		.where(eq(betReceipts.idempotencyKey, key));
}

/**
 * THE SINGLE-REQUEST INVARIANT, written once and applied to every class: if
 * THIS REQUEST's own attempt left a NON-2xx response sitting in the cache under
 * `key`, then THIS SAME REQUEST's own transaction did not commit. Every caller
 * additionally pins whether the antecedent is true or false, so this can never
 * hold vacuously by accident.
 *
 * Does NOT claim (and cannot prove, from a single request) that no OTHER,
 * earlier request's receipt exists under this key — the reinstated DC-a
 * (`case "hit"` in `endpoint.ts`) is the control for that; see the header
 * comment above and ADR-0044's DC section.
 */
async function assertNoCachedErrorMasksACommit(key: string): Promise<void> {
	const cached = cachedFor(key);
	if (cached === null || cached.status < 300) return;
	expect(await receiptsFor(key)).toHaveLength(0);
}

interface WireBody {
	ok: boolean;
	error?: { code: string; message: string; retry_after?: number };
}

describe("I-IDEM-NOMASK-001: a request's own cached non-2xx never masks that same request's own committed transaction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		redisStore.clear();
		replayControl.suppressNextPrecheck = false;
		mockGetSession.mockImplementation(async (args: { headers: Headers }) => {
			const id = args.headers.get("x-test-user");
			return id === null ? null : { user: { id } };
		});
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 99,
			reset: 0,
		});
		mockPrecommit.mockResolvedValue({
			outcome: "pass",
			categories: [],
			categoryScores: {},
		});
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
			"bet_receipts",
		]);
	});

	// ── class 1 · 429 rate-limit — CACHED, and the transaction never opened ──
	it("cached-non-2xx-never-masks-a-commit::rate-limit-429", async () => {
		const userId = await seedUser("rl");
		const marketId = await seedOpenMarketWithPool("nomask-rl-market");
		const KEY = "nomask-rl-key";

		mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 4 });
		const res = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "50", body: "throttled argument" },
				KEY,
				userId,
			),
		);
		expect(res.status).toBe(429);
		expect(((await res.json()) as WireBody).error?.code).toBe(
			"error_rate_limit_exceeded",
		);

		// The antecedent is TRUE — this 429 really is in the cache (SPEC.2 §11
		// ¶"Cached error responses include 429s").
		expect(cachedFor(KEY)?.status).toBe(429);
		// …and the rate-limit gate is step 4, upstream of the step-7 transaction.
		expect(await receiptsFor(KEY)).toHaveLength(0);
		await assertNoCachedErrorMasksACommit(KEY);
	});

	// ── class 3 · the terminal 4xx family — CACHED, all upstream of the tx ──
	const terminalFamily: ReadonlyArray<{
		label: string;
		status: number;
		code: string;
		body: (marketId: string) => Record<string, unknown>;
	}> = [
		{
			label: "invalid-request-body",
			status: 400,
			code: "error_invalid_request_body",
			body: (marketId) => ({
				marketId,
				side: "YES",
				stake: "not-a-number",
				body: "malformed",
			}),
		},
		{
			label: "comment-requires-bet",
			status: 400,
			code: "comment_requires_bet",
			body: (marketId) => ({
				marketId,
				side: "YES",
				stake: "50",
				body: "   ",
			}),
		},
		{
			label: "below-post-floor",
			status: 400,
			code: "below_post_floor",
			body: (marketId) => ({
				marketId,
				side: "YES",
				stake: "1",
				body: "under the post floor",
			}),
		},
		{
			label: "parent-comment-not-found",
			status: 404,
			code: "parent_comment_not_found",
			body: (marketId) => ({
				marketId,
				side: "YES",
				stake: "50",
				body: "a reply to nothing",
				parentCommentId: PHANTOM_UUID,
			}),
		},
		{
			label: "image-attachment-invalid",
			status: 400,
			code: "error_invalid_request_body",
			body: (marketId) => ({
				marketId,
				side: "YES",
				stake: "50",
				body: "with a phantom image",
				imageUploadsId: PHANTOM_UUID,
			}),
		},
	];

	it.each(
		terminalFamily,
	)("cached-non-2xx-never-masks-a-commit::terminal-4xx-$label", async ({
		label,
		status,
		code,
		body,
	}) => {
		const userId = await seedUser(`f-${label}`);
		const marketId = await seedOpenMarketWithPool(`nomask-${label}-market`);
		const KEY = `nomask-${label}-key`;

		const res = await placePOST(placeReq(body(marketId), KEY, userId));
		expect(res.status).toBe(status);
		expect(((await res.json()) as WireBody).error?.code).toBe(code);

		expect(cachedFor(KEY)?.status).toBe(status);
		expect(await receiptsFor(KEY)).toHaveLength(0);
		// Nothing was written at all — the W-1 transaction never opened.
		expect(
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId)),
		).toHaveLength(0);
		await assertNoCachedErrorMasksACommit(KEY);
	});

	it("cached-non-2xx-never-masks-a-commit::terminal-4xx-moderation-track-b", async () => {
		// The moderation BLOCK arm (ADR-0014/0021): the verdict aborts before the
		// transaction opens, and the 400 is cached so a retry is not re-moderated.
		const userId = await seedUser("trackb");
		const marketId = await seedOpenMarketWithPool("nomask-trackb-market");
		const KEY = "nomask-trackb-key";

		mockPrecommit.mockResolvedValueOnce({
			outcome: "track_b",
			categories: ["harassment"],
			categoryScores: { harassment: 0.97 },
		});
		const res = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "50", body: "blocked argument" },
				KEY,
				userId,
			),
		);
		expect(res.status).toBe(400);
		expect(((await res.json()) as WireBody).error?.code).toBe(
			"comment_track_b_blocked",
		);

		expect(cachedFor(KEY)?.status).toBe(400);
		expect(await receiptsFor(KEY)).toHaveLength(0);
		await assertNoCachedErrorMasksACommit(KEY);
	});

	// ── class 4 · 409 ModerationInFlightError — CACHED, tx never opened ──
	it("cached-non-2xx-never-masks-a-commit::moderation-in-flight-409", async () => {
		// The one class the plan's DC hunt cared about most: a 409 that IS cached
		// (`toWireError` maps it to 409, and 409 < 500 so `runBetEndpoint` caches
		// it). It stays sound because `precommitModerate` throws it at its OWN
		// reservation gate — step 6, outside and upstream of the tx (ADR-0014) — so
		// there is nothing committed for the cached error to mask. The DC chain
		// would have needed the opposite: this error raised AFTER a commit.
		const userId = await seedUser("modflight");
		const marketId = await seedOpenMarketWithPool("nomask-modflight-market");
		const KEY = "nomask-modflight-key";

		mockPrecommit.mockRejectedValueOnce(new ModerationInFlightError());
		const res = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "50", body: "in-flight argument" },
				KEY,
				userId,
			),
		);
		expect(res.status).toBe(409);
		expect(((await res.json()) as WireBody).error?.code).toBe(
			"error_moderation_in_flight",
		);

		expect(cachedFor(KEY)?.status).toBe(409);
		expect(await receiptsFor(KEY)).toHaveLength(0);
		expect(
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId)),
		).toHaveLength(0);
		await assertNoCachedErrorMasksACommit(KEY);
	});

	// ── class 2 · 409 durable-receipt mismatch — NEVER CACHED ──
	it("cached-non-2xx-never-masks-a-commit::durable-precheck-mismatch-409-is-never-cached", async () => {
		const userId = await seedUser("durmis");
		const marketId = await seedOpenMarketWithPool("nomask-durmis-market");
		const KEY = "nomask-durmis-key";

		const first = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "50", body: "original argument A" },
				KEY,
				userId,
			),
		);
		expect(first.status).toBe(200);
		const committed = await receiptsFor(KEY);
		expect(committed).toHaveLength(1);

		// Drop the cache so the SECOND request is a genuine miss and the DURABLE
		// pre-check (step 3.5) is what refuses it — not the Redis `mismatch` arm.
		redisStore.clear();
		const second = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "80", body: "mutated argument B" },
				KEY,
				userId,
			),
		);
		expect(second.status).toBe(409);
		expect(((await second.json()) as WireBody).error?.code).toBe(
			"error_idempotency_key_reused",
		);

		// THE LOAD-BEARING HALF: the antecedent is FALSE by construction. This 409
		// is never cached, because caching it would poison the original body's
		// rightful replay — the very "cached error over a committed tx" shape.
		expect(cachedFor(KEY)).toBeNull();
		// The commit it refused to mask is intact, bit for bit.
		expect(await receiptsFor(KEY)).toEqual(committed);
		await assertNoCachedErrorMasksACommit(KEY);
	});

	// ── class 5 · 409 23505 receipt-mismatch — NEVER CACHED (`noCache: true`) ──
	it("cached-non-2xx-never-masks-a-commit::post-tx-23505-mismatch-409-is-never-cached", async () => {
		const userId = await seedUser("txmis");
		const marketId = await seedOpenMarketWithPool("nomask-txmis-market");
		const KEY = "nomask-txmis-key";

		const first = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "50", body: "original argument A" },
				KEY,
				userId,
			),
		);
		expect(first.status).toBe(200);
		const committed = await receiptsFor(KEY);
		expect(committed).toHaveLength(1);

		// Cache dropped AND the step-3.5 pre-check suppressed for one call, so
		// execution enters the transaction under a key that is already spent: the
		// `bets_idempotency_key_idx` 23505 fires, the tx rolls back, and the route's
		// catch resolves it against a receipt whose fingerprint does not match.
		redisStore.clear();
		replayControl.suppressNextPrecheck = true;
		const second = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "80", body: "mutated argument B" },
				KEY,
				userId,
			),
		);
		expect(second.status).toBe(409);
		expect(((await second.json()) as WireBody).error?.code).toBe(
			"error_idempotency_key_reused",
		);
		expect(replayControl.suppressNextPrecheck).toBe(false); // consumed

		// `noCache: true` on the inner result — the antecedent is FALSE.
		expect(cachedFor(KEY)).toBeNull();
		// Exactly one commit under the key, unchanged; the rollback left nothing.
		expect(await receiptsFor(KEY)).toEqual(committed);
		expect(
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId)),
		).toHaveLength(1);
		await assertNoCachedErrorMasksACommit(KEY);
	});
});
