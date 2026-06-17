import { eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.2 — SPEC.1 §8 F-COMMENT-3 ("Bet+comment with image attachment").
// `media.test.ts::image-moderation-routes` (VERDICT MOCKED — ruling 3). DEBATE.2
// only ROUTES the resolved image key into the already-image-capable
// precommitModerate seam and RESPECTS the verdict; it does NOT exercise the real
// classifier (the multimodal primitive is built; consequences are DEBATE.7).
//
// Three asserts (plan §7 mock contract):
//   (a) when imageUploadsId is set, the route resolves it (image-attach) and
//       calls precommitModerate with the resolved imageR2Key → the image is
//       ROUTED to the seam (assert the mock received the key).
//   (b) a MOCKED track_a / track_b verdict ⇒ the bet+comment tx NEVER opens — no
//       bet row, no comment row, no `image_upload.committed` event (F-MOD-4 by
//       construction; moderation is pre-tx).
//   (c) a MOCKED pass ⇒ the image links into the comment (comments.image_uploads_id),
//       the upload terminalizes `committed` (SPEC.2 §12.2 step 6 — keeps the orphan
//       sweep from reaping it), + an `image_upload.committed` event is emitted.
//
// IMAGE RETRY-PURITY (plan hard requirement):
//   `image_upload.committed` is emitted in-tx with a caller-generated event_id
//   minted ONCE at handler entry + closed over (like betEventId/commentEventId/
//   creditEventId). A FORCED SERIALIZABLE retry must NOT double-emit it (exactly
//   ONE row — the ON CONFLICT (event_id, created_at) dedupe holds because the id
//   is stable across attempts). A per-attempt-regenerated id would fail this.
//
// `image_upload.committed` is ALREADY in EVENT_TYPES with payload
// { uploadId, userId, commentId, key } (schemas.ts) — no new event type.
//
// Mirrors atomicity.test.ts + events-idempotency.test.ts. REAL place route +
// REAL runBetTransaction against test Postgres; only externals mocked. The
// precommit verdict + the resolved image key are observed via a configurable
// hoisted mock. TRUNCATE in afterEach.

const { mockGetSession, mockPrecommit, precommitState, positionFault } =
	vi.hoisted(() => ({
		mockGetSession: vi.fn(),
		// Configurable per-test: the verdict it returns. Records the LAST args it
		// was called with so the test can assert the resolved imageR2Key routed in.
		precommitState: {
			outcome: "pass" as "pass" | "track_a" | "track_b",
			lastArgs: null as { imageR2Key?: string } | null,
		},
		positionFault: { remaining: 0 },
		mockPrecommit: vi.fn(),
	}));

mockPrecommit.mockImplementation(async (args: { imageR2Key?: string }) => {
	precommitState.lastArgs = args;
	return { outcome: precommitState.outcome, categories: [] };
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
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

// Partial-mock positions persist: throw ONE synthetic 40001 on the first spine
// write (consuming positionFault.remaining), then delegate to the real impl — the
// retry-forcing pattern from events-idempotency.test.ts / concurrency.test.ts.
vi.mock("@/server/positions/persist", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/positions/persist")>();
	return {
		...actual,
		upsertPositionDelta: vi.fn(
			async (...args: Parameters<typeof actual.upsertPositionDelta>) => {
				if (positionFault.remaining > 0) {
					positionFault.remaining -= 1;
					throw Object.assign(new Error("serialization_failure"), {
						code: "40001",
					});
				}
				return actual.upsertPositionDelta(...args);
			},
		),
	};
});

// Wrap the REAL runBetTransaction in a spy: the other tests still execute the
// real W-1 tx (retry loop intact), while reply-moderation-block-aborts-no-tx
// asserts the runner is NEVER ENTERED on a moderation block — proving "the tx
// never opened" (distinct from "opened then rolled back", which row-absence
// alone cannot disprove).
vi.mock("@/server/bets/transaction", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/bets/transaction")>();
	return {
		...actual,
		runBetTransaction: vi.fn(actual.runBetTransaction),
	};
});

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	bets,
	comments,
	events,
	imageUploads,
	markets,
	pools,
	users,
} from "@/db/schema";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.35",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Media User",
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
			title: "Media Market",
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

// Seed an image_uploads row owned by `userId` with the canonical
// `u/<userId>/<uploadId>.<ext>` key shape (matches signUploadAndInsert). The
// uploadId is minted client-side so the final r2_object_key is written at INSERT
// time — `r2_object_key` is immutable post-INSERT (Bucket-B trigger), so it must
// NOT be UPDATEd afterward.
async function seedImageUpload(userId: string): Promise<{
	uploadId: string;
	key: string;
}> {
	const uploadId = uuidv7();
	const key = `u/${userId}/${uploadId}.png`;
	await testDb.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey: key,
		contentType: "image/png",
		byteSize: 1024,
	});
	return { uploadId, key };
}

describe("F-COMMENT-3 — image attachment moderation routing (verdict mocked)", () => {
	beforeEach(() => {
		precommitState.outcome = "pass";
		precommitState.lastArgs = null;
		positionFault.remaining = 0;
		vi.clearAllMocks();
		// clearAllMocks resets the implementation registration — re-attach it.
		mockPrecommit.mockImplementation(async (args: { imageR2Key?: string }) => {
			precommitState.lastArgs = args;
			return { outcome: precommitState.outcome, categories: [] };
		});
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, image_uploads, pools, markets, users CASCADE`,
		);
	});

	it("image-moderation-routes", async () => {
		// (a) + (c): a PASS verdict — the resolved image key is routed into the
		// seam, the image links into the comment, and `image_upload.committed` fires.
		const userId = await seedUser("media-pass");
		const marketId = await seedOpenMarketWithPool("media-pass-market");
		await seedDharmaGrant(userId);
		const { uploadId, key } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "pass";

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "argument with an image",
					imageUploadsId: uploadId,
				},
				"media-pass-key",
			),
		);
		expect(res.status).toBe(200);

		// (a) the RESOLVED image key was routed to precommitModerate.
		expect(precommitState.lastArgs?.imageR2Key).toBe(key);

		// (c) the image links into the comment.
		const [commentRow] = await testDb
			.select({ imageUploadsId: comments.imageUploadsId })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRow?.imageUploadsId).toBe(uploadId);

		// (c) `image_upload.committed` event emitted (aggregate "image_upload").
		const committedEvents = await testDb
			.select({ eventType: events.eventType, aggregateId: events.aggregateId })
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(1);
		expect(committedEvents[0]?.aggregateId).toBe(uploadId);

		// (c) SPEC.2 §12.2 step-6 terminalization — the resulting PERSISTED state:
		// the upload row is now `committed` with terminal_at set. This is the half
		// of the pass branch that keeps the orphan sweep (which reaps
		// `terminal_state IS NULL`) from deleting a committed image's R2 object.
		// A route-wire test that asserts the event/link but NOT the resulting
		// persisted terminal state is half a test — this assertion is what would
		// have caught the orphan-sweep CRITICAL.
		const [uploadRow] = await testDb
			.select({
				terminalState: imageUploads.terminalState,
				terminalAt: imageUploads.terminalAt,
			})
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(uploadRow?.terminalState).toBe("committed");
		expect(uploadRow?.terminalAt).not.toBeNull();
	});

	it("image-track-a-aborts-no-tx", async () => {
		// (b) track_a: the tx NEVER opens — no bet, no comment, no committed event.
		const userId = await seedUser("media-track-a");
		const marketId = await seedOpenMarketWithPool("media-track-a-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "track_a";

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "blocked image argument",
					imageUploadsId: uploadId,
				},
				"media-track-a-key",
			),
		);
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("comment_track_a_blocked");

		// No bet, no comment, no committed event.
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const committedEvents = await testDb
			.select()
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(0);
	});

	it("image-track-b-aborts-no-tx", async () => {
		// (b) track_b: the tx NEVER opens — 423, no bet/comment/committed event.
		const userId = await seedUser("media-track-b");
		const marketId = await seedOpenMarketWithPool("media-track-b-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "track_b";

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "under-review image argument",
					imageUploadsId: uploadId,
				},
				"media-track-b-key",
			),
		);
		expect(res.status).toBe(423);
		const payload = await res.json();
		expect(payload.error.code).toBe("comment_track_b_under_review");

		// No bet, no comment, no committed event (mirror image-track-a).
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const committedEvents = await testDb
			.select()
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(0);
	});

	it("image-committed-event-stable-across-retry", async () => {
		// RETRY-PURITY: force ONE 40001 → the wrapper retries; the whole attempt-1
		// tx (incl. the image_upload.committed insert) rolls back; attempt 2 re-runs
		// with the SAME closed-over event_id. Exactly ONE committed event survives
		// (the ON CONFLICT (event_id, created_at) dedupe holds iff the id is stable).
		const userId = await seedUser("media-retry");
		const marketId = await seedOpenMarketWithPool("media-retry-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "pass";

		positionFault.remaining = 1;

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "retry-purity image argument",
					imageUploadsId: uploadId,
				},
				"media-retry-key",
			),
		);
		expect(res.status).toBe(200);

		// EXACTLY ONE image_upload.committed — no leaked duplicate from attempt 1.
		const committedEvents = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(1);

		// The retry actually fired (positions is the first spine write → a 2nd
		// invocation = a genuine top-of-callback re-run), and the fault was consumed.
		const { upsertPositionDelta } = await import("@/server/positions/persist");
		expect(vi.mocked(upsertPositionDelta)).toHaveBeenCalledTimes(2);
		expect(positionFault.remaining).toBe(0);
	});

	it("reply-moderation-block-aborts-no-tx", async () => {
		// GAP 1 (Q3): a BLOCKED REPLY leaves NOTHING persisted. A place request with
		// `parentCommentId` set + a MOCKED block verdict (track_a) ⇒ the bet+comment
		// tx NEVER opens for the reply — no new reply comment, no bet, no event
		// (F-MOD-4 by construction; moderation is pre-tx, ADR-0014).
		//
		// REGRESSION GUARD: the reply branch is un-fenced — the route validates
		// `parentCommentId` (reply-validate), then precommit runs PRE-tx and a
		// track_a block throws CommentTrackABlockedError BEFORE runBetTransaction is
		// entered → 400 / zero rows. This GENUINELY traverses the reply path (the
		// sibling reply.test.ts depth/floor/parent checks prove parentCommentId is
		// honored, not stripped) and asserts below that the W-1 runner is never
		// entered on the block.
		const parentAuthor = await seedUser("reply-block-parent");
		const replier = await seedUser("reply-block-replier");
		const marketId = await seedOpenMarketWithPool("reply-block-market");
		await seedDharmaGrant(replier);

		// Seed a real depth-0 PARENT comment DIRECTLY (its own rows don't pollute
		// counts — no bet, no event). side_at_post_time + stake_at_post_time are
		// NOT NULL — supply both.
		const [parent] = await testDb
			.insert(comments)
			.values({
				userId: parentAuthor,
				marketId,
				body: "parent",
				sideAtPostTime: "YES",
				stakeAtPostTime: "0",
				parentCommentId: null,
				betId: null,
			})
			.returning({ id: comments.id });
		const parentCommentId = parent?.id ?? "";

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		precommitState.outcome = "track_a";

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "50", // reply floor
					body: "blocked reply argument",
					parentCommentId,
				},
				"reply-block-key",
			),
		);
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("comment_track_a_blocked");

		// Negative DB state for the REPLY: only the seeded parent comment exists (no
		// reply comment), no bet at all (the parent had none; the blocked reply
		// created none), and the reply attempt emitted NOTHING.
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const emittedEvents = await testDb
			.select()
			.from(events)
			.where(
				inArray(events.eventType, [
					"bet.placed",
					"comment.placed",
					"image_upload.committed",
				]),
			);
		expect(emittedEvents.length).toBe(0);

		// Q3 hardening: the W-1 runner was NEVER ENTERED — the block aborts pre-tx
		// (distinct from "tx opened then rolled back", which row-absence can't show).
		expect(vi.mocked(runBetTransaction)).not.toHaveBeenCalled();
	});

	// === Image-attach terminal_state guard (the MEDIUM ruling) ================
	// resolveImageAttachment now rejects any non-un-attached upload (sequential
	// reuse + dangling), and place()'s CAS asserts it claimed exactly one row
	// (the concurrent TOCTOU race). All three reject UNIFORMLY (no oracle) and
	// fail CLOSED — nothing persists, no phantom image_upload.committed.

	it("image-attach-rejects-reuse-of-already-committed-upload", async () => {
		// SEQUENTIAL REUSE: a first place COMMITS the upload (terminal_state →
		// committed, one committed event). A second place re-attaching the SAME
		// uploadId the user owns → uniform generic 400 (no second committed event,
		// the reuse comment never persists / never links the image).
		const userId = await seedUser("media-reuse");
		const marketId = await seedOpenMarketWithPool("media-reuse-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "pass";

		const first = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "first argument with image",
					imageUploadsId: uploadId,
				},
				"media-reuse-key-1",
			),
		);
		expect(first.status).toBe(200);

		const second = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "second argument reusing the same image",
					imageUploadsId: uploadId,
				},
				"media-reuse-key-2",
			),
		);
		expect(second.status).toBe(400);
		const payload = await second.json();
		expect(payload.error.code).toBe("error_invalid_request_body");

		// Exactly ONE image_upload.committed — no phantom from the reuse attempt.
		const committedEvents = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(1);

		// Only the FIRST comment exists and links the image; the reuse never persisted.
		const commentRows = await testDb
			.select({ id: comments.id, imageUploadsId: comments.imageUploadsId })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.imageUploadsId).toBe(uploadId);
	});

	it("image-attach-rejects-swept-orphan-upload", async () => {
		// DANGLING REFERENCE: an upload the user owns that the orphan sweep already
		// terminalized (terminal_state='orphan', R2 object deleted) → uniform generic
		// 400. Nothing persists; no dangling comment→deleted-image reference.
		const userId = await seedUser("media-orphan");
		const marketId = await seedOpenMarketWithPool("media-orphan-market");
		await seedDharmaGrant(userId);
		// Direct INSERT with the terminal columns set — the Bucket-B trigger guards
		// UPDATE/DELETE, not INSERT, so seeding a pre-terminalized row is legal.
		const uploadId = uuidv7();
		await testDb.insert(imageUploads).values({
			id: uploadId,
			userId,
			r2ObjectKey: `u/${userId}/${uploadId}.png`,
			contentType: "image/png",
			byteSize: 1024,
			terminalState: "orphan",
			terminalAt: new Date("2026-01-01T00:00:00Z"),
		});
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		precommitState.outcome = "pass";

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "argument attaching a swept image",
					imageUploadsId: uploadId,
				},
				"media-orphan-key",
			),
		);
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("error_invalid_request_body");

		// Nothing persisted: no comment, no bet, no committed event.
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const committedEvents = await testDb
			.select()
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(0);
	});

	it("image-attach-cas-rolls-back-on-concurrent-terminalization", async () => {
		// CONCURRENT TOCTOU RACE (the CAS assertion): the upload passes the pre-tx
		// un-attached validation (terminal_state NULL), then a CONCURRENT writer
		// terminalizes it BEFORE place()'s in-tx CAS. Simulated by flipping the row
		// to 'committed' inside the precommit mock — which runs AFTER
		// resolveImageAttachment and BEFORE runBetTransaction (route step 5c → 6 → 7).
		// place()'s CAS then claims ZERO rows and must FAIL CLOSED: the whole W-1 tx
		// rolls back (bet + comment unwind), no phantom image_upload.committed event.
		const userId = await seedUser("media-race");
		const marketId = await seedOpenMarketWithPool("media-race-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId); // terminal_state NULL
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// The race: terminalize between the validation SELECT and the in-tx CAS.
		mockPrecommit.mockImplementation(async (args: { imageR2Key?: string }) => {
			precommitState.lastArgs = args;
			await testDb
				.update(imageUploads)
				.set({ terminalState: "committed", terminalAt: new Date() })
				.where(eq(imageUploads.id, uploadId));
			return { outcome: "pass", categories: [] };
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "argument that loses the image race",
					imageUploadsId: uploadId,
				},
				"media-race-key",
			),
		);
		// Fails closed — a should-never-fire-under-the-guard internal invariant →
		// 500 error_internal (toWireError fallback; no new wire code), non-retryable.
		expect(res.status).toBe(500);
		const payload = await res.json();
		expect(payload.error.code).toBe("error_internal");

		// No phantom committed event from place() (the mock's flip is a direct write,
		// not an event); the bet + comment rolled back — nothing persisted.
		const committedEvents = await testDb
			.select()
			.from(events)
			.where(eq(events.eventType, "image_upload.committed"));
		expect(committedEvents.length).toBe(0);
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
	});
});
