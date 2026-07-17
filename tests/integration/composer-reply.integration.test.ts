import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A3 §5.6 tests-first, slice 3 — the reply-composer wire flows (plan §7
// Integration row, slice-3 subset; §9 slice 3; §4 post-focus view; §6
// edges). THE point of this file: the composer's OWN client modules drive
// the REAL /api/bets/place route handler against the REAL local Postgres
// for the REPLY (Support/Counter) vertical — side derivation
// (`deriveReplySide`) + the F-3 predicate (`isEntryDisabled`), payload
// composition (`composeWireBody`), the wiring builder (`buildPlaceRequest`,
// the parentCommentId arm), the key lifecycle (`initialKeyState` /
// `reduceKey` + `keyOutcomeFor`), the §4.4 envelope parser
// (`parseWireResponse`), and the §4 state map (`mapWireError`).
//
// NOT a RED file: every module imported here EXISTS (slices 1–2 landed) —
// this suite verifies flows the server already implements through the
// landed client modules, so it is EXPECTED GREEN on first run. The slice-3
// verified-RED seam is tests/unit/composer/split-bar.test.ts (which
// collection-fails on its unresolvable greenfield import).
//
// Scenarios → plan-§1 rows:
//   1. reply-happy → INV-1 (exactly ONE new bet+comment pair, atomically
//      paired) + INV-3 derivation (Support on a YES post → wire side YES;
//      `comments.side_at_post_time` freezes as the DERIVED side) + floors /
//      ADR-0018 (stake EXACTLY at BET_MIN_STAKE_REPLY accepted — the
//      boundary is inclusive; belt: a reply at BET_MIN_STAKE_POST → 400
//      `below_reply_floor` — the floor-selection matrix at the wire,
//      defensively skipped unless POST < REPLY holds).
//   2. removed-parent reply stays legal → the §6 edge verbatim: removal
//      (ADR-0021) is a read-layer mask over an append-only row — the thread
//      stays intact, the server validates the parent ROW (not its masking),
//      and the reply lands 200 with parent_comment_id = the removed parent.
//   3. F-3 both directions → I-SINGLE-SIDE / F-3: the client predicate
//      matrix row re-pinned at the integration seam (YES-holder on a NO
//      post: Support(→NO) DISABLED, Counter(→YES) ENABLED — the predicate
//      runs on the RESULTING side, never the render slot); the ENABLED
//      direction executes 200 (same-side add — single-side holds); the
//      preempted direction's SERVER belt 400 `opposite_side_held` stays
//      authoritative (keyOutcomeFor → "terminal"; mapWireError →
//      "p3_generic"); the belt attempt writes NO new bet.
//
// Harness: mirrors tests/integration/composer-place.integration.test.ts
// EXACTLY — same mocks (session, origin, permissive rate-limit, always-miss
// idempotency so every request walks the DURABLE bet_receipts pre-check,
// mocked-OpenAI moderation base-pass over a permissive reservation-Redis
// mock, R2 sign-read stub), same fixtures + truncate pattern. The
// content-removal fixture reuses the `removeComment` writer from
// tests/integration/post-param.integration.test.ts (the masking suites'
// mod_actions row shape) — reused, never invented. Fixture prose reuses the
// existing corpus (plan §8): "durable replay argument", "replay-test
// argument", "original body A", "mutated body B", "Durable Replay Market".

const {
	mockGetSession,
	mockRelease,
	mockRedis,
	mockOpenAiModerate,
	mockSignRead,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockRelease: vi.fn(async (_response: unknown) => {}),
	// The REAL precommitModerate's reservation lifecycle: SET NX → "OK"
	// (always acquired), DEL in its finally. Permissive by design — the
	// reservation machine has its own suite (precommit-moderate).
	mockRedis: {
		set: vi.fn(async () => "OK"),
		get: vi.fn(async () => null),
		del: vi.fn(async () => 1),
		eval: vi.fn(async () => null),
	},
	mockOpenAiModerate: vi.fn(),
	// Text-only flows — never called; mocked so the real precommit's module
	// graph loads without R2 env (the precommit-moderate fixture pattern).
	mockSignRead: vi.fn(async () => "https://signed.example/unused"),
}));

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
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
// Body-sensitive fingerprint (JSON.stringify) + always-miss lookup — the
// Redis-lost simulation: every request walks the durable pre-check under
// its own key; distinct keys never collide.
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));
vi.mock("@/server/moderation/openai", () => ({
	moderate: mockOpenAiModerate,
}));
vi.mock("@/server/storage/sign-read", () => ({ signRead: mockSignRead }));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	parseWireResponse,
	type WireOutcome,
} from "@/components/debate/composer/envelope";
import {
	deriveReplySide,
	isEntryDisabled,
	type Side,
} from "@/components/debate/composer/gating";
import {
	initialKeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";
import { composeWireBody } from "@/components/debate/composer/payload";
import {
	buildPlaceRequest,
	type PlaceBody,
} from "@/components/debate/composer/requests";
import { ComposerDecimal } from "@/components/debate/composer/sell-convert";
import {
	keyOutcomeFor,
	mapWireError,
} from "@/components/debate/composer/state-map";
import { bets, comments, markets, modActions, pools, users } from "@/db/schema";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";
const HARNESS_ORIGIN = "https://prd.example.com";

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Durable Replay User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Durable Replay Market",
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

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

/**
 * Record a `content_removed` mod_action against a target comment — the
 * reactive-removal row shape reused verbatim from the post-param masking
 * suite (never invented).
 */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

// Scripted vendor verdict (the precommit-moderate `modResult` shape) — this
// suite runs moderation base-PASS throughout; block paths live in slice 2.
function passVerdict() {
	return {
		flagged: false,
		categories: { harassment: false },
		scores: { harassment: 0.01 },
	};
}

// EVERY request in this file is built by the composer's OWN wiring builder —
// never a hand-rolled fetch init. Harness-only headers (origin is
// mock-allowed; x-forwarded-for feeds the endpoint's ip identity) are merged
// AFTER the builder, so they can never mask a builder omission of the
// content-type / Idempotency-Key headers.
function composerRequest(body: PlaceBody, idempotencyKey: string): Request {
	const { url, init } = buildPlaceRequest({ body, idempotencyKey });
	expect(url).toBe("/api/bets/place");
	const headers = new Headers(init.headers);
	headers.set("origin", HARNESS_ORIGIN);
	headers.set("x-forwarded-for", "203.0.113.77");
	return new Request(`http://localhost${url}`, { ...init, headers });
}

// Deterministic key mint (injected — never crypto.randomUUID here): the
// fresh-key assertions need EXACT, distinct key values per intent.
function mintSequence(prefix: string): () => string {
	let n = 0;
	return () => {
		n += 1;
		return `${prefix}-${n}`;
	};
}

function successData(outcome: WireOutcome): Record<string, unknown> {
	if (outcome.kind !== "success") {
		throw new Error(`expected success envelope, got ${outcome.kind}`);
	}
	if (typeof outcome.data !== "object" || outcome.data === null) {
		throw new Error("success data must be an object");
	}
	return outcome.data as Record<string, unknown>;
}

function errorOutcome(outcome: WireOutcome) {
	if (outcome.kind !== "error") {
		throw new Error(`expected error envelope, got ${outcome.kind}`);
	}
	return outcome;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string") {
		throw new Error(`expected ${label} to be a string`);
	}
	return value;
}

async function betAndCommentRows(marketId: string) {
	const betRows = await testDb
		.select({ id: bets.id, commentId: bets.commentId })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const commentRows = await testDb
		.select({
			id: comments.id,
			body: comments.body,
			sideAtPostTime: comments.sideAtPostTime,
		})
		.from(comments)
		.where(eq(comments.marketId, marketId));
	return { betRows, commentRows };
}

async function repliesTo(parentCommentId: string) {
	return testDb
		.select({
			id: comments.id,
			parentCommentId: comments.parentCommentId,
			sideAtPostTime: comments.sideAtPostTime,
		})
		.from(comments)
		.where(eq(comments.parentCommentId, parentCommentId));
}

/**
 * Scaffolding: a top-level post-bet placed through the SAME wiring builder
 * (session set to the given user; deterministic literal key). Returns the
 * F-BET-1 ids — `commentId` is the reply scenarios' parent.
 */
async function placeTopLevel(args: {
	userId: string;
	marketId: string;
	side: Side;
	title: string;
	key: string;
}): Promise<{ betId: string; commentId: string }> {
	mockGetSession.mockResolvedValue({ user: { id: args.userId } });
	const res = await placePOST(
		composerRequest(
			{
				marketId: args.marketId,
				side: args.side,
				stake: BET_MIN_STAKE_POST,
				body: composeWireBody({ title: args.title, extended: "" }),
			},
			args.key,
		),
	);
	expect(res.status).toBe(200);
	const data = successData(await parseWireResponse(res));
	return {
		betId: requireString(data.betId, "betId"),
		commentId: requireString(data.commentId, "commentId"),
	};
}

describe("UI.A3 slice 3 — reply composer drives POST /api/bets/place", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOpenAiModerate.mockResolvedValue(passVerdict());
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
			"mod_actions",
		]);
	});

	it("composer-reply::happy-support-derives-side-honors-reply-floor [INV-1 · INV-3 derivation]", async () => {
		const authorId = await seedUser("ui-a3-reply-author", "ui-a3-reply-author");
		const viewerId = await seedUser("ui-a3-reply-viewer", "ui-a3-reply-viewer");
		const marketId = await seedOpenMarketWithPool("ui-a3-reply-happy-market");
		await seedDharmaGrant(authorId);
		await seedDharmaGrant(viewerId);

		// The parent: A's top-level YES post, placed through the same wiring.
		const parent = await placeTopLevel({
			userId: authorId,
			marketId,
			side: "YES",
			title: "durable replay argument",
			key: "ui-a3-reply-happy-parent-1",
		});

		// B is the actor from here on.
		mockGetSession.mockResolvedValue({ user: { id: viewerId } });

		// INV-3 derivation (plan §1 row 3): Support on a YES post INHERITS YES.
		const derivedSide = deriveReplySide({
			parentSide: "YES",
			relation: "support",
		});
		expect(derivedSide).toBe("YES");

		const mint = mintSequence("ui-a3-reply-happy");
		let key = initialKeyState(mint);
		const replyBody = composeWireBody({
			title: "replay-test argument",
			extended: "",
		});
		const replyPlace: PlaceBody = {
			marketId,
			side: derivedSide,
			stake: BET_MIN_STAKE_REPLY,
			body: replyBody,
			parentCommentId: parent.commentId,
		};

		// Stake EXACTLY at the reply floor — the ADR-0018 boundary is
		// inclusive: at-floor is ACCEPTED.
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const res = await placePOST(composerRequest(replyPlace, key.key));
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "success" }) },
			mint,
		);
		// The wire echoes the DERIVED side.
		expect(data.side).toBe(derivedSide);

		// INV-1: exactly ONE new bet+comment pair beyond the parent's.
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(2);
		expect(commentRows.length).toBe(2);
		const replies = await repliesTo(parent.commentId);
		expect(replies.length).toBe(1);
		expect(replies[0]?.parentCommentId).toBe(parent.commentId);
		expect(replies[0]?.id).toBe(requireString(data.commentId, "commentId"));
		// INV-3: side_at_post_time froze as the DERIVED side.
		expect(replies[0]?.sideAtPostTime).toBe(derivedSide);
		// The atomic pair: the reply bet references the reply comment.
		const replyBet = betRows.find((b) => b.commentId === replies[0]?.id);
		expect(replyBet?.id).toBe(requireString(data.betId, "betId"));

		// The below-floor BELT (the floor-selection matrix at the wire): a
		// reply at the POST floor is below the REPLY floor → 400
		// `below_reply_floor`. Defensive skip — the arm is meaningful only
		// while POST < REPLY holds (true today: "10" < "50").
		if (new ComposerDecimal(BET_MIN_STAKE_POST).lessThan(BET_MIN_STAKE_REPLY)) {
			// A NEW intent → a FRESH key (new composer open).
			let beltKey = initialKeyState(mint);
			beltKey = reduceKey(beltKey, { type: "SUBMIT" }, mint);
			const belt = await placePOST(
				composerRequest(
					{ ...replyPlace, stake: BET_MIN_STAKE_POST },
					beltKey.key,
				),
			);
			expect(belt.status).toBe(400);
			const beltError = errorOutcome(await parseWireResponse(belt));
			expect(beltError.code).toBe("below_reply_floor");
			// The rejected attempt wrote nothing.
			const after = await betAndCommentRows(marketId);
			expect(after.betRows.length).toBe(2);
			expect(after.commentRows.length).toBe(2);
		}
	});

	it("composer-reply::removed-parent-reply-stays-legal [§6 edge · INV-1]", async () => {
		const authorId = await seedUser(
			"ui-a3-removed-author",
			"ui-a3-removed-author",
		);
		const viewerId = await seedUser(
			"ui-a3-removed-viewer",
			"ui-a3-removed-viewer",
		);
		const marketId = await seedOpenMarketWithPool("ui-a3-removed-market");
		await seedDharmaGrant(authorId);
		await seedDharmaGrant(viewerId);

		const parent = await placeTopLevel({
			userId: authorId,
			marketId,
			side: "YES",
			title: "durable replay argument",
			key: "ui-a3-removed-parent-1",
		});

		// The parent is REMOVED (reactive moderation, ADR-0021). Removal is a
		// read-layer mask; the append-only comments row SURVIVES — replying to
		// a removed argument is LEGAL (§6 edge: the server validates the
		// parent ROW, not its masking).
		await removeComment(parent.commentId);

		mockGetSession.mockResolvedValue({ user: { id: viewerId } });
		const derivedSide = deriveReplySide({
			parentSide: "YES",
			relation: "support",
		});
		const mint = mintSequence("ui-a3-removed");
		let key = initialKeyState(mint);
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const res = await placePOST(
			composerRequest(
				{
					marketId,
					side: derivedSide,
					stake: BET_MIN_STAKE_REPLY,
					body: composeWireBody({
						title: "replay-test argument",
						extended: "",
					}),
					parentCommentId: parent.commentId,
				},
				key.key,
			),
		);
		expect(res.status).toBe(200);
		successData(await parseWireResponse(res));

		// The thread is INTACT: the reply row exists with parent_comment_id =
		// the removed parent.
		const replies = await repliesTo(parent.commentId);
		expect(replies.length).toBe(1);
		expect(replies[0]?.parentCommentId).toBe(parent.commentId);
		// The parent row itself still exists (append-only — removal never
		// deletes; the mod_actions row is the only removal artifact).
		const parentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.id, parent.commentId));
		expect(parentRows.length).toBe(1);
		// INV-1 belt: one NEW pair beyond the parent's.
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(2);
		expect(commentRows.length).toBe(2);
	});

	it("composer-reply::f3-predicate-and-server-belt-both-directions [I-SINGLE-SIDE / F-3]", async () => {
		const authorId = await seedUser("ui-a3-f3-author", "ui-a3-f3-author");
		const viewerId = await seedUser("ui-a3-f3-viewer", "ui-a3-f3-viewer");
		const marketId = await seedOpenMarketWithPool("ui-a3-f3-market");
		await seedDharmaGrant(authorId);
		await seedDharmaGrant(viewerId);

		// B first HOLDS YES (a placed YES bet on the market)…
		await placeTopLevel({
			userId: viewerId,
			marketId,
			side: "YES",
			title: "durable replay argument",
			key: "ui-a3-f3-held-1",
		});
		// …and the parent post by A is NO-side.
		const parent = await placeTopLevel({
			userId: authorId,
			marketId,
			side: "NO",
			title: "replay-test argument",
			key: "ui-a3-f3-parent-1",
		});

		// (a) The F-3 CLIENT predicate — the named matrix row re-pinned at the
		// integration seam. The predicate runs on the RESULTING side (slot ≠
		// side): YES-holder on a NO post → Support(→NO) DISABLED, Counter
		// (→YES) ENABLED.
		const supportSide = deriveReplySide({
			parentSide: "NO",
			relation: "support",
		});
		expect(supportSide).toBe("NO");
		expect(
			isEntryDisabled({ resultingSide: supportSide, heldSide: "YES" }),
		).toBe(true);
		const counterSide = deriveReplySide({
			parentSide: "NO",
			relation: "counter",
		});
		expect(counterSide).toBe("YES");
		expect(
			isEntryDisabled({ resultingSide: counterSide, heldSide: "YES" }),
		).toBe(false);

		// (b) The ENABLED direction EXECUTES: B counters the NO post → a YES
		// reply-bet (same-side add; single-side holds).
		mockGetSession.mockResolvedValue({ user: { id: viewerId } });
		const mint = mintSequence("ui-a3-f3");
		let key = initialKeyState(mint);
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const counter = await placePOST(
			composerRequest(
				{
					marketId,
					side: counterSide,
					stake: BET_MIN_STAKE_REPLY,
					body: composeWireBody({ title: "original body A", extended: "" }),
					parentCommentId: parent.commentId,
				},
				key.key,
			),
		);
		expect(counter.status).toBe(200);
		const counterData = successData(await parseWireResponse(counter));
		expect(counterData.side).toBe(counterSide);
		const afterCounter = await betAndCommentRows(marketId);
		expect(afterCounter.betRows.length).toBe(3);

		// (c) The preempted direction's SERVER belt: B submits Support(→NO)
		// anyway under a FRESH key — bypassing the client predicate — and the
		// server 400 stays authoritative.
		let beltKey = initialKeyState(mint);
		beltKey = reduceKey(beltKey, { type: "SUBMIT" }, mint);
		const belt = await placePOST(
			composerRequest(
				{
					marketId,
					side: supportSide,
					stake: BET_MIN_STAKE_REPLY,
					body: composeWireBody({ title: "mutated body B", extended: "" }),
					parentCommentId: parent.commentId,
				},
				beltKey.key,
			),
		);
		expect(belt.status).toBe(400);
		const beltError = errorOutcome(await parseWireResponse(belt));
		expect(beltError.code).toBe("opposite_side_held");
		// Cache-semantics: a cached terminal 4xx — the reducer parks
		// fresh_on_edit (the F-1/F-2-corrected lifecycle law).
		const outcome = keyOutcomeFor({ kind: "error", code: beltError.code });
		expect(outcome).toBe("terminal");
		beltKey = reduceKey(beltKey, { type: "OUTCOME", outcome }, mint);
		expect(beltKey.pending).toBe("fresh_on_edit");
		// The §4 render contract: opposite_side_held is the generic P3 belt.
		expect(mapWireError({ code: beltError.code }).state).toBe("p3_generic");

		// DB: NO new bet from (c) — counts hold at (b)'s; the single reply on
		// the parent is the COUNTER (side frozen YES).
		const after = await betAndCommentRows(marketId);
		expect(after.betRows.length).toBe(3);
		expect(after.commentRows.length).toBe(3);
		const replies = await repliesTo(parent.commentId);
		expect(replies.length).toBe(1);
		expect(replies[0]?.sideAtPostTime).toBe(counterSide);
	});
});
