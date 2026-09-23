import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FF-1 · G3–G8 — the friendly-fire toggle on the WRITE PATH (ADR-0058 / D-51).
//
// A same-side critic must be able to say so without leaving their side. The
// mechanism is one boolean on the reply's comment row, carried on the request
// and set in the SAME INSERT as `side_at_post_time`; the bet underneath it is an
// ORDINARY OWN-SIDE BUY through the unchanged W-1 spine. That is the whole
// design, and it is why this file's centre of gravity is *where the stake
// lands*, not *what the flag says*.
//
//   G3 support-with-flag-buys-held-side  — a YES holder flags a YES post: 200,
//        comments.friendly_fire true, the reply's bets.side YES, the position
//        still YES, exactly one new comment + one new bet paired by
//        bets.comment_id, and `data.friendlyFire` true.
//        ⛔ REJECTS: the stake landing on NO (the design that breaks the
//        single-side rule while looking like a stance feature — ADR-0058
//        Driver 2), the position flipping, the flag being dropped.
//   G4 flag-on-counter-rejected-no-rows  — the flag on an OPPOSITE-side reply:
//        400 `friendly_fire_requires_support`, ZERO new rows in comments /
//        bets / dharma_ledger / events, and precommitModerate NOT called (the
//        check is ahead of step-6 moderation, so a rejected flag never spends a
//        vendor call or a Redis reservation).
//        POSITIVE CONTROL in the same test: the byte-identical request with the
//        flag OFF lands 200 as an ordinary Counter, and the moderation counter
//        moves — so "not called" is a measurement, not an empty mock.
//   G5 flag-on-top-level-rejected        — the flag with no parentCommentId:
//        400 `friendly_fire_requires_reply`, zero rows, moderation not called,
//        same positive control.
//   G6 entry-reply-support-with-flag     — a user holding NOTHING replies to a
//        YES post choosing YES with the flag: 200, the entry bet on YES, the
//        flag stored, a positions row on YES.
//        ⛔ REJECTS: the entrant landing on NO.
//   G7 replay-with-flag-flipped-409      — same Idempotency-Key, the flag
//        flipped: 409 `error_idempotency_key_reused`; then a byte-identical
//        third request returns the ORIGINAL 200 receipt with the flag intact
//        and writes nothing.
//        ⛔ REJECTS: a replay silently changing a recorded stance.
//   G8 comment.placed carries the key    — the event payload's `friendlyFire`
//        equals the stored column, on a flagged reply AND on a plain one.
//        ⛔ REJECTS: an event log from which the stance cannot be reconstructed.
//
// Invariants: INV-1 (one SERIALIZABLE tx wraps both inserts — G3's paired
// rows, G4/G5's zero rows), INV-2 (no Dharma moves on a rejection — the zero
// `dharma_ledger` delta), INV-3 (the flag never changes which side the comment
// binds to — G3's side/position assertions, G6's entry side).
//
// HARNESS (modelled on tests/server/bets/place-replay-durable.test.ts): the
// REAL route + REAL runBetTransaction against local Postgres; only the HTTP
// shell is mocked. The fingerprint mock is BODY-SENSITIVE so G7's flag flip is
// a genuine mismatch; idempotency always MISSES so every request is real work;
// `mockPrecommit` is a counted spy. Decimal STRINGS (CLAUDE.md §2). TRUNCATE in
// afterEach over reply.test.ts's list PLUS bet_receipts and lots.
//
// RED posture today: `friendlyFire` is not in `placeBodySchema`, so zod STRIPS
// it — G4/G5 land 200 instead of 400, and every flag/echo assertion reads
// `undefined`/`false`.

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
// BODY-SENSITIVE by design (the place-replay-durable pattern): G7's whole
// subject is that flipping `friendlyFire` changes the fingerprint, so a
// constant stub would make that test pass for the wrong reason.
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
import { BET_MIN_STAKE_REPLY } from "@/server/config/limits";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "1000.000000000000000000";
const REPLY_STAKE = BET_MIN_STAKE_REPLY;
const POST_STAKE = "10";

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
			name: "Friendly Fire User",
			email: `${tag}@example.com`,
			pseudonym: tag,
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
			title: "Friendly Fire Market",
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
 * Row counts across the four tables a rejected request must not touch. Taken
 * BEFORE and AFTER, because a post-state count alone cannot distinguish "the
 * request wrote nothing" from "the fixture never wrote anything" (OVN-V3 — a
 * control that cannot fire is not a control).
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
	const eventRows = await testDb
		.select({ id: events.eventId })
		.from(events)
		.where(inArray(events.eventType, ["bet.placed", "comment.placed"]));
	return {
		comments: commentRows.length,
		bets: betRows.length,
		ledger: ledgerRows.length,
		events: eventRows.length,
	};
}

describe("FF-1 — the friendly-fire toggle on the write path", () => {
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

	it("friendly-fire::support-with-flag-buys-held-side", async () => {
		// G3. The load-bearing claim of the whole feature: a flagged reply is an
		// ORDINARY OWN-SIDE BUY. The replier holds YES, flags a YES post, and the
		// stake must land on YES with their position untouched — the stance is a
		// label on the comment, never a redirection of the money.
		const parentAuthor = await seedUser("ff-g3-parent");
		const replier = await seedUser("ff-g3-replier");
		const marketId = await seedOpenMarketWithPool("ff-g3-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "ff-g3-parent-key",
		});

		// The replier ENTERS on YES first, so they are a genuine holder of the
		// side they are about to friendly-fire.
		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const entry = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: POST_STAKE,
					body: "replier entry on YES",
				},
				"ff-g3-entry-key",
			),
		);
		expect(entry.status).toBe(200);

		const before = await writeCounts(marketId, replier);

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "I hold YES and this argument for YES is wrong",
					parentCommentId,
					friendlyFire: true,
				},
				"ff-g3-flag-key",
			),
		);
		expect(res.status).toBe(200);
		const payload = await res.json();
		const replyCommentId = payload.data.commentId as string;

		// (1) The response ECHOES the stored stance — the client renders the tag
		// from this, so a dropped key is a reply that silently posted as plain
		// Support.
		expect(payload.data.friendlyFire).toBe(true);

		// (2) The flag is STORED, on the reply and only on the reply.
		const [replyRow] = await testDb
			.select({
				friendlyFire: comments.friendlyFire,
				sideAtPostTime: comments.sideAtPostTime,
				parentCommentId: comments.parentCommentId,
			})
			.from(comments)
			.where(eq(comments.id, replyCommentId));
		expect(replyRow?.friendlyFire).toBe(true);
		expect(replyRow?.sideAtPostTime).toBe("YES");
		expect(replyRow?.parentCommentId).toBe(parentCommentId);

		// (3) ⛔ THE WALL. The stake bought the HELD side. A "friendly fire" that
		// bought NO here would break the single-side rule while looking like a
		// stance feature (ADR-0058 Driver 2).
		const [replyBet] = await testDb
			.select({ side: bets.side, commentId: bets.commentId })
			.from(bets)
			.where(eq(bets.commentId, replyCommentId));
		expect(replyBet?.side).toBe("YES");
		// INV-1's schema half: the bet points at the comment it rides.
		expect(replyBet?.commentId).toBe(replyCommentId);

		// (4) The position did not flip and did not split: ONE row, still YES.
		const positionRows = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.userId, replier));
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.side).toBe("YES");

		// (5) EXACTLY one new comment and one new bet — the W-1 pair, nothing else.
		const after = await writeCounts(marketId, replier);
		expect(after.comments - before.comments).toBe(1);
		expect(after.bets - before.bets).toBe(1);
		// INV-2: the flag changes nothing about the money — one bet_stake debit.
		expect(after.ledger - before.ledger).toBe(1);
	});

	it("friendly-fire::flag-on-counter-rejected-no-rows", async () => {
		// G4. The flag declares "same side, opposed argument". On an OPPOSITE-side
		// reply it is a contradiction, and the write path — not the CHECK, which
		// cannot see the parent — is what refuses it. Nothing may persist, and the
		// refusal must come BEFORE moderation: a request that can never commit
		// should not spend an OpenAI call or a Redis reservation.
		const parentAuthor = await seedUser("ff-g4-parent");
		const replier = await seedUser("ff-g4-replier");
		const marketId = await seedOpenMarketWithPool("ff-g4-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "ff-g4-parent-key",
		});

		const before = await writeCounts(marketId, replier);
		const moderationCallsBefore = mockPrecommit.mock.calls.length;

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const rejected = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: REPLY_STAKE,
					body: "countering on NO while claiming friendly fire",
					parentCommentId,
					friendlyFire: true,
				},
				"ff-g4-flagged-key",
			),
		);
		expect(rejected.status).toBe(400);
		const rejectedBody = await rejected.json();
		expect(rejectedBody.ok).toBe(false);
		expect(rejectedBody.error.code).toBe("friendly_fire_requires_support");

		// ZERO new rows anywhere the W-1 spine writes. INV-1: no half-written
		// bet+comment pair; INV-2: no Dharma moved.
		const afterRejection = await writeCounts(marketId, replier);
		expect(afterRejection).toEqual(before);

		// The check is AHEAD of step-6 moderation.
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore);

		// ── POSITIVE CONTROL (OVN-V1) ────────────────────────────────────────
		// The byte-identical request with the flag OFF is an ordinary Counter and
		// lands. Without this the assertions above would also pass against a route
		// that rejected every NO reply, or a moderation mock that is never wired
		// at all.
		const control = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: REPLY_STAKE,
					body: "countering on NO while claiming friendly fire",
					parentCommentId,
					friendlyFire: false,
				},
				"ff-g4-control-key",
			),
		);
		expect(control.status).toBe(200);
		const controlBody = await control.json();
		const controlCommentId = controlBody.data.commentId as string;
		expect(controlBody.data.friendlyFire).toBe(false);

		const [controlRow] = await testDb
			.select({
				friendlyFire: comments.friendlyFire,
				sideAtPostTime: comments.sideAtPostTime,
			})
			.from(comments)
			.where(eq(comments.id, controlCommentId));
		expect(controlRow?.friendlyFire).toBe(false);
		expect(controlRow?.sideAtPostTime).toBe("NO");

		// …and the moderation counter MOVES on the control — which is what makes
		// "not called" above a measurement rather than an inert spy.
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore + 1);
		const afterControl = await writeCounts(marketId, replier);
		expect(afterControl.comments - before.comments).toBe(1);
		expect(afterControl.bets - before.bets).toBe(1);
	});

	it("friendly-fire::flag-on-top-level-rejected", async () => {
		// G5. A post has nothing to be friendly toward. The DB CHECK
		// `comments_friendly_fire_requires_parent` is the storage backstop; this
		// asserts the route refuses it FIRST, with a named code and before
		// moderation, so the participant gets an answer rather than a 500.
		const author = await seedUser("ff-g5-author");
		const marketId = await seedOpenMarketWithPool("ff-g5-market");
		await seedDharmaGrant(author);

		const before = await writeCounts(marketId, author);
		const moderationCallsBefore = mockPrecommit.mock.calls.length;

		mockGetSession.mockResolvedValue({ user: { id: author } });
		const rejected = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: POST_STAKE,
					body: "a top-level post claiming friendly fire",
					friendlyFire: true,
				},
				"ff-g5-flagged-key",
			),
		);
		expect(rejected.status).toBe(400);
		const rejectedBody = await rejected.json();
		expect(rejectedBody.ok).toBe(false);
		expect(rejectedBody.error.code).toBe("friendly_fire_requires_reply");

		const afterRejection = await writeCounts(marketId, author);
		expect(afterRejection).toEqual(before);
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore);

		// ── POSITIVE CONTROL ────────────────────────────────────────────────
		// The same post WITHOUT the flag lands, and moderation runs — proving the
		// zero-delta above is the flag's doing and not a broken fixture.
		const control = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: POST_STAKE,
					body: "a top-level post claiming friendly fire",
					friendlyFire: false,
				},
				"ff-g5-control-key",
			),
		);
		expect(control.status).toBe(200);
		const controlBody = await control.json();
		expect(controlBody.data.friendlyFire).toBe(false);
		expect(mockPrecommit.mock.calls.length).toBe(moderationCallsBefore + 1);
		const afterControl = await writeCounts(marketId, author);
		expect(afterControl.comments - before.comments).toBe(1);
		expect(afterControl.bets - before.bets).toBe(1);
	});

	it("friendly-fire::entry-reply-support-with-flag", async () => {
		// G6. Eligibility is decided by the side being BOUGHT, not by a held
		// position (D-51 R2) — so someone with no stake at all may enter AS a
		// friendly-fire Support. ⛔ REJECTS the entrant landing on NO.
		const parentAuthor = await seedUser("ff-g6-parent");
		const entrant = await seedUser("ff-g6-entrant");
		const marketId = await seedOpenMarketWithPool("ff-g6-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(entrant);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "ff-g6-parent-key",
		});

		// The entrant holds NOTHING before this request.
		const positionsBefore = await testDb
			.select({ id: positions.id })
			.from(positions)
			.where(eq(positions.userId, entrant));
		expect(positionsBefore.length).toBe(0);

		mockGetSession.mockResolvedValue({ user: { id: entrant } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "entering on YES to contest this YES argument",
					parentCommentId,
					friendlyFire: true,
				},
				"ff-g6-entry-key",
			),
		);
		expect(res.status).toBe(200);
		const payload = await res.json();
		const replyCommentId = payload.data.commentId as string;
		expect(payload.data.friendlyFire).toBe(true);
		expect(payload.data.side).toBe("YES");

		const [replyRow] = await testDb
			.select({
				friendlyFire: comments.friendlyFire,
				sideAtPostTime: comments.sideAtPostTime,
			})
			.from(comments)
			.where(eq(comments.id, replyCommentId));
		expect(replyRow?.friendlyFire).toBe(true);
		expect(replyRow?.sideAtPostTime).toBe("YES");

		// The entry bet is on the PARENT'S side, and the new position is there.
		const [replyBet] = await testDb
			.select({ side: bets.side })
			.from(bets)
			.where(eq(bets.commentId, replyCommentId));
		expect(replyBet?.side).toBe("YES");

		const positionsAfter = await testDb
			.select({ side: positions.side })
			.from(positions)
			.where(eq(positions.userId, entrant));
		expect(positionsAfter.length).toBe(1);
		expect(positionsAfter[0]?.side).toBe("YES");
	});

	it("friendly-fire::replay-with-flag-flipped-409", async () => {
		// G7. The stance is part of what was committed, so it is part of what the
		// key promises. A retry that flips the flag is a DIFFERENT request wearing
		// the same key, and answering it 200 would let a replay rewrite a stored
		// stance that Bucket A can never correct.
		const parentAuthor = await seedUser("ff-g7-parent");
		const replier = await seedUser("ff-g7-replier");
		const marketId = await seedOpenMarketWithPool("ff-g7-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "ff-g7-parent-key",
		});

		// ONE object literal, reused verbatim, so request 3 is byte-identical to
		// request 1 under the JSON.stringify fingerprint (key ORDER matters).
		const flaggedBody = {
			marketId,
			side: "YES",
			stake: REPLY_STAKE,
			body: "same body, the stance is the only difference",
			parentCommentId,
			friendlyFire: true,
		};
		const flippedBody = { ...flaggedBody, friendlyFire: false };

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const first = await placePOST(placeRequest(flaggedBody, "ff-g7-key"));
		expect(first.status).toBe(200);
		const firstBody = await first.json();
		expect(firstBody.data.friendlyFire).toBe(true);

		const afterFirst = await writeCounts(marketId, replier);

		// Same key, flag flipped → a fingerprint mismatch, never a quiet success.
		const flipped = await placePOST(placeRequest(flippedBody, "ff-g7-key"));
		expect(flipped.status).toBe(409);
		const flippedBodyJson = await flipped.json();
		expect(flippedBodyJson.ok).toBe(false);
		expect(flippedBodyJson.error.code).toBe("error_idempotency_key_reused");
		// The 409 is never cached (the poison guard) — the ORIGINAL body keeps its
		// right to replay, which is what request 3 exercises.
		expect(mockRelease).toHaveBeenLastCalledWith(null);

		// The rightful replay: byte-identical, returns the stored receipt with the
		// stance intact, and writes nothing.
		const replay = await placePOST(placeRequest(flaggedBody, "ff-g7-key"));
		expect(replay.status).toBe(200);
		const replayBody = await replay.json();
		expect(replayBody).toEqual(firstBody);
		expect(replayBody.data.friendlyFire).toBe(true);

		const afterReplay = await writeCounts(marketId, replier);
		expect(afterReplay).toEqual(afterFirst);
	});

	it("friendly-fire::comment-placed-event-carries-the-flag", async () => {
		// G8. The dataset is the point of the experiment, and the event log is
		// what it is rebuilt from. A stance recorded in a column but absent from
		// `comment.placed` is a stance a replay cannot reconstruct.
		const parentAuthor = await seedUser("ff-g8-parent");
		const flagger = await seedUser("ff-g8-flagger");
		const plain = await seedUser("ff-g8-plain");
		const marketId = await seedOpenMarketWithPool("ff-g8-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(flagger);
		await seedDharmaGrant(plain);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "ff-g8-parent-key",
		});

		mockGetSession.mockResolvedValue({ user: { id: flagger } });
		const flagged = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "flagged same-side critique",
					parentCommentId,
					friendlyFire: true,
				},
				"ff-g8-flagged-key",
			),
		);
		expect(flagged.status).toBe(200);
		const flaggedCommentId = (await flagged.json()).data.commentId as string;

		mockGetSession.mockResolvedValue({ user: { id: plain } });
		const unflagged = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "plain same-side support",
					parentCommentId,
				},
				"ff-g8-plain-key",
			),
		);
		expect(unflagged.status).toBe(200);
		const plainCommentId = (await unflagged.json()).data.commentId as string;

		const commentEvents = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "comment.placed"));
		const payloadFor = (commentId: string) =>
			commentEvents
				.map((e) => e.payload as { commentId: string; friendlyFire?: boolean })
				.find((p) => p.commentId === commentId);

		// The flagged reply's event says so…
		expect(payloadFor(flaggedCommentId)?.friendlyFire).toBe(true);
		// …and the plain one says the opposite EXPLICITLY. `undefined` is not
		// `false`: a payload that simply omits the key on the common path would
		// satisfy a truthiness check while leaving the dataset unable to tell an
		// unflagged reply from a pre-ADR one.
		expect(payloadFor(plainCommentId)?.friendlyFire).toBe(false);

		// …and each matches the column it is supposed to mirror.
		const rows = await testDb
			.select({ id: comments.id, friendlyFire: comments.friendlyFire })
			.from(comments)
			.where(inArray(comments.id, [flaggedCommentId, plainCommentId]));
		const columnFor = (id: string) =>
			rows.find((r) => r.id === id)?.friendlyFire;
		expect(payloadFor(flaggedCommentId)?.friendlyFire).toBe(
			columnFor(flaggedCommentId),
		);
		expect(payloadFor(plainCommentId)?.friendlyFire).toBe(
			columnFor(plainCommentId),
		);
	});
});
