import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FF-1 · CLOSE-3 — **nobody replies to their own post, on either side**
// (founder ruling D-52 R1).
//
// A reply is a Support/Counter bet ON somebody's argument (ADR-0017). An author
// replying to themselves is not a second voice — it is the same voice buying a
// second slot in its own thread, and the lane, the aggregates and the reader all
// read it as contest or endorsement that never happened. So the refusal is a
// property of the WRITE PATH, not of the UI that hides the button.
//
//   T1 self-reply::author-reply-rejected-no-rows
//        The REAL route. The author posts (through the route, so they genuinely
//        hold the post's side, exactly as in production), then sends a PLAIN
//        Support reply to their own post: 400 `self_reply_forbidden`, ZERO new
//        rows in comments / bets / dharma_ledger / events, and precommitModerate
//        NOT called — the front-stop rides the route's EXISTING pre-transaction
//        parent read (step 5b), ahead of image resolution and moderation, so a
//        request that can never commit spends no vendor call and no Redis
//        reservation.
//        POSITIVE CONTROL in the same test: the SECOND user sends the
//        byte-identical reply shape under its own key and lands 200, the
//        comment/bet counts move +1 each, and the moderation counter moves — so
//        "zero rows" and "not called" above are MEASUREMENTS, not an inert mock.
//        ⛔ REJECTS: a check placed after moderation. ⚠ It does NOT reject a
//        check written on the side: both cases here are SAME-side (a YES reply
//        to a YES post), so `parent.userId === userId && side === parent side`
//        would pass them. The shipped comparison reads no side; the Counter arm
//        (an author who sold out, then Counters their own post) is reachable and
//        is not separately pinned — owed, outside this round's test budget.
//   T2 self-reply::author-reply-rejected-in-transaction
//        `place()` handed the same illegal combination DIRECTLY, bypassing the
//        route's front-stop entirely. There is no storage backstop for this by
//        construction — refusing it needs the parent row's `user_id`, which no
//        CHECK can see — so a non-route caller is the exact path the in-tx guard
//        exists for. The refusal is asserted by its WIRE MAPPING (`toWireError`
//        → 400 / `self_reply_forbidden`) rather than by class identity, so the
//        test pins the contract a participant observes and not an import.
//        ⛔ REJECTS: a guard that lives ONLY on the route (delete the in-tx half
//        and T1 stays green).
//
// Invariants. INV-1 — the bet and its comment commit together or not at all: a
// refusal leaves NEITHER, which is what the zero comments/bets deltas assert.
// INV-2 — no Dharma moves on a refusal: the zero `dharma_ledger` delta (and the
// zero `events` delta, which would otherwise carry the `bet.placed` /
// `comment.placed` pair the ledger row rides beside).
//
// HARNESS (modelled on tests/server/comments/friendly-fire.test.ts for T1 and on
// the in-tx-guard block of tests/server/debate-view/friendly-fire-substrate.
// integration.test.ts for T2): the REAL route, REAL runBetTransaction, REAL
// place() against local Postgres. Only the HTTP/cookie shell is mocked;
// idempotency always MISSES so every request is real work, and `mockPrecommit`
// is a COUNTED spy. Decimal STRINGS at the ADR-0018 floors (CLAUDE.md §2).
// Seeded users carry `lastAllowanceAccruedAt` so the daily accrual never fires
// and the event delta is exactly the request's own writes.
//
// RED posture today: NEITHER the route NOR place() refuses a self-reply. T1's
// request lands 200 (so it fails on the 400 assertion); T2's place() RESOLVES
// and commits (so it fails on the "must reject" assertion). Neither may fail on
// an import, a type, a fixture or the database — `SelfReplyForbiddenError` is
// deliberately NOT imported here, since a test that dies on a missing import is
// red for the wrong reason.

const { mockGetSession, mockPrecommit, mockRelease } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(),
	mockRelease: vi.fn(async (_response: unknown) => {}),
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
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
import { toWireError } from "@/server/bets/errors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "1000.000000000000000000";
const POST_STAKE = BET_MIN_STAKE_POST;
const REPLY_STAKE = BET_MIN_STAKE_REPLY;

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.41",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Self Reply User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// Already accrued today, so `accrueDailyCredit` is a no-op and the
			// four deltas below are the REQUEST's writes and nothing else.
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Self Reply Market",
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

function meta(userId: string, flowId: string) {
	return {
		request_id: "test-self-reply",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

/** Place a top-level post-bet through the REAL route → the parent comment id. */
async function placeParentPost(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	idempotencyKey: string;
}): Promise<string> {
	mockGetSession.mockResolvedValue({ user: { id: args.userId } });
	const res = await placePOST(
		placeRequest(
			{
				marketId: args.marketId,
				side: args.side,
				stake: POST_STAKE,
				body: `parent argument on ${args.side}`,
			},
			args.idempotencyKey,
		),
	);
	expect(res.status).toBe(200);
	const payload = await res.json();
	return payload.data.commentId as string;
}

/**
 * The REAL W-1 write with NO route above it — T2's whole subject. Every
 * retry-purity id is minted OUTSIDE the callback, as the substrate fixture does:
 * the wrapper re-runs the callback per attempt, so an id minted inside would
 * drift `created_at` and defeat the `ON CONFLICT (event_id, created_at)` dedupe.
 * `friendlyFire` is deliberately omitted — this is a PLAIN Support reply, so the
 * only thing wrong with it is who wrote the parent.
 */
async function placeDirect(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId: string | null;
}): Promise<{ betId: string; commentId: string }> {
	const flow = args.parentCommentId === null ? "F-BET-1" : "F-COMMENT-2";
	const idempotencyKey = uuidv7();
	const bodyFingerprint = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `self-reply fixture argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId,
				idempotencyKey,
				bodyFingerprint,
				betEventId,
				commentEventId,
				creditEventId,
				metadata: meta(args.userId, flow),
			}),
	);
	return { betId: result.betId, commentId: result.commentId };
}

/**
 * Row counts across the four tables a refused request must not touch, taken
 * BEFORE and AFTER — a post-state count alone cannot tell "the request wrote
 * nothing" from "the fixture never wrote anything". `events` is counted whole
 * rather than filtered by type, so an accrual row or any other append the
 * refused path might make is inside the measurement too.
 */
async function writeCounts(marketId: string, userId: string) {
	const commentRows = await testDb
		.select({ id: comments.id })
		.from(comments)
		.where(eq(comments.marketId, marketId));
	const betRows = await testDb
		.select({ id: bets.id })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const ledgerRows = await testDb
		.select({ id: dharmaLedger.id })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
	const eventRows = await testDb.select({ id: events.eventId }).from(events);
	return {
		comments: commentRows.length,
		bets: betRows.length,
		ledger: ledgerRows.length,
		events: eventRows.length,
	};
}

describe("FF-1 · CLOSE-3 — nobody replies to their own post (D-52 R1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
	});
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"lots",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
			"bet_receipts",
		]);
	});

	it("self-reply::author-reply-rejected-no-rows", async () => {
		const author = await seedUser("sr-t1-author");
		const other = await seedUser("sr-t1-other");
		const marketId = await seedOpenMarketWithPool("sr-t1-market");
		await seedDharmaGrant(author);
		await seedDharmaGrant(other);

		const postCommentId = await placeParentPost({
			userId: author,
			marketId,
			side: "YES",
			idempotencyKey: "sr-t1-post-key",
		});

		// The author genuinely HOLDS the post's side, exactly as in production —
		// so nothing else in the write path has grounds to refuse the reply below
		// and the 400 can only be the self-reply rule.
		const heldRows = await testDb
			.select({ side: positions.side })
			.from(positions)
			.where(eq(positions.userId, author));
		expect(heldRows.length).toBe(1);
		expect(heldRows[0]?.side).toBe("YES");

		const before = await writeCounts(marketId, author);
		const moderationCallsBefore = mockPrecommit.mock.calls.length;

		// A PLAIN Support reply — same side as the post, `friendlyFire` omitted.
		// The ONLY thing wrong with it is that the author wrote the parent.
		const replyBody = {
			marketId,
			side: "YES",
			stake: REPLY_STAKE,
			body: "agreeing with myself, at length",
			parentCommentId: postCommentId,
		};

		mockGetSession.mockResolvedValue({ user: { id: author } });
		const refused = await placePOST(placeRequest(replyBody, "sr-t1-self-key"));
		expect(refused.status).toBe(400);
		const refusedBody = await refused.json();
		expect(refusedBody.ok).toBe(false);
		expect(refusedBody.error.code).toBe("self_reply_forbidden");

		// INV-1 (no half-written bet+comment pair) and INV-2 (no Dharma moved).
		const afterRefusal = await writeCounts(marketId, author);
		expect(afterRefusal).toEqual(before);

		// The front-stop is AHEAD of step-6 moderation.
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore);

		// ── POSITIVE CONTROL ────────────────────────────────────────────────
		// The SECOND user sends the byte-identical reply shape under its own key
		// and lands. Without this, every assertion above would also pass against
		// a route that refused EVERY reply to this post, or against a moderation
		// spy that was never wired to anything.
		mockGetSession.mockResolvedValue({ user: { id: other } });
		const control = await placePOST(
			placeRequest(replyBody, "sr-t1-control-key"),
		);
		expect(control.status).toBe(200);
		const controlBody = await control.json();
		const controlCommentId = controlBody.data.commentId as string;

		const [controlRow] = await testDb
			.select({
				userId: comments.userId,
				parentCommentId: comments.parentCommentId,
			})
			.from(comments)
			.where(eq(comments.id, controlCommentId));
		expect(controlRow?.userId).toBe(other);
		expect(controlRow?.parentCommentId).toBe(postCommentId);

		const afterControl = await writeCounts(marketId, other);
		expect(afterControl.comments - afterRefusal.comments).toBe(1);
		expect(afterControl.bets - afterRefusal.bets).toBe(1);
		// …and the moderation counter MOVES, which is what makes "not called"
		// above a measurement rather than an inert spy.
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore + 1);
	});

	it("self-reply::author-reply-rejected-in-transaction", async () => {
		const author = await seedUser("sr-t2-author");
		const marketId = await seedOpenMarketWithPool("sr-t2-market");
		await seedDharmaGrant(author);

		// The post goes through the REAL W-1 spine, so the author holds YES.
		const post = await placeDirect({
			userId: author,
			marketId,
			side: "YES",
			stake: POST_STAKE,
			parentCommentId: null,
		});
		const heldRows = await testDb
			.select({ side: positions.side })
			.from(positions)
			.where(eq(positions.userId, author));
		expect(heldRows.length).toBe(1);
		expect(heldRows[0]?.side).toBe("YES");

		const before = await writeCounts(marketId, author);

		// `place()` handed the illegal combination with NO route above it. The
		// refusal is read off `toWireError` — the contract a participant observes
		// — rather than off a class identity this test could import.
		const refusal: unknown = await placeDirect({
			userId: author,
			marketId,
			side: "YES",
			stake: REPLY_STAKE,
			parentCommentId: post.commentId,
		}).then(
			() => null,
			(err: unknown) => err,
		);

		expect(
			refusal,
			"place() must REJECT a self-reply; it resolved, so the reply committed inside W-1",
		).not.toBeNull();
		const wire = toWireError(refusal);
		expect(wire.status).toBe(400);
		expect(wire.body.error.code).toBe("self_reply_forbidden");

		// INV-1 + INV-2 again, on the path that has no storage backstop: the
		// whole W-1 transaction rolled back, so nothing of the reply survives.
		const after = await writeCounts(marketId, author);
		expect(after).toEqual(before);
	});
});
