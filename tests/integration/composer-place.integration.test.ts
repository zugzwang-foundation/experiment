import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A3 §5.6 tests-first, slice 2 — the composer place-wiring integration
// (plan §7 Integration row, slice-2 subset; §9 slice 2). THE point of this
// file: the composer's OWN client modules drive the REAL /api/bets/place
// route handler against the REAL local Postgres — payload composition
// (`composeWireBody`), the key lifecycle (`initialKeyState`/`reduceKey`),
// cache-semantics classification (`keyOutcomeFor`), the §4.4 envelope parser
// (`parseWireResponse`), and the greenfield wiring builder
// (`buildPlaceRequest` — DOES NOT EXIST yet: this file collection-FAILS NOW
// on that import, the verified RED, and GREENs when the module lands).
//
// PINNED PUBLIC-API CONTRACT (shared verbatim with
// tests/unit/composer/requests.test.ts — the implementer matches exactly):
//   export type PlaceBody = {
//     marketId: string; side: "YES" | "NO"; stake: string; body: string;
//     parentCommentId?: string; imageUploadsId?: string;
//   };
//   export function buildPlaceRequest(args: {
//     body: PlaceBody; idempotencyKey: string;
//   }): { url: string; init: RequestInit };
//
// Scenarios → plan-§1 rows:
//   1. happy-post → INV-1 (the composer-built payload IS the write path's
//      caller: one bet + one comment, atomically paired; body byte-identical;
//      side frozen as sent).
//   2. replay-same-key-same-body → I-IDEM replay direction (held key → the
//      ORIGINAL 200 answered from the durable receipt, ADR-0031 — a manual
//      retry NEVER executes twice).
//   3. track-b block → fresh-key revise → I-IDEM re-mint direction (terminal
//      4xx is CACHED per key: an edit mints a FRESH key — the F-1/F-2-
//      corrected law) + the ADR-0014 abort-before-tx moderation narrative
//      (the blocked attempt writes NO bet, NO comment).
//   4. edit-after-invisible-commit → the §1 F-2 row VERBATIM: held-key
//      resubmit of an EDITED body → 409 `error_idempotency_key_reused` →
//      protective landing (key held through refresh) → the DB shows the
//      committed ORIGINAL bet and row-count proves NO second bet; the durable
//      `bet_receipts` row is the refresh's re-render source of truth.
//
// Harness (mirrors tests/server/bets/place-replay-durable.test.ts): the
// always-miss idempotency mock IS the Redis-lost simulation (release no-ops,
// the fast path never repopulates) — every request walks the DURABLE
// `bet_receipts` pre-check, the ADR-0031 layer scenarios 2/4 pin. Moderation
// runs the REAL `precommitModerate` with the vendor `moderate` mocked (the
// precommit-moderate fixture pattern named by plan §7) over a permissive
// reservation-Redis mock; `recordGateBlock` writes REAL mod_actions/events
// rows. Sell + reply flows are LATER slices — one subject per file.

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
// Redis-lost simulation: the durable pre-check must distinguish the happy
// replay (fingerprint match → original 200) from the edited-body resubmit
// (mismatch → 409 reused).
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
	initialKeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";
import { composeWireBody } from "@/components/debate/composer/payload";
import {
	buildPlaceRequest,
	type PlaceBody,
} from "@/components/debate/composer/requests";
import { keyOutcomeFor } from "@/components/debate/composer/state-map";
import {
	betReceipts,
	bets,
	comments,
	markets,
	pools,
	users,
} from "@/db/schema";
import { BET_MIN_STAKE_POST } from "@/server/config/limits";

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

// Scripted vendor verdicts (the precommit-moderate `modResult` shape:
// { flagged, categories, scores }). `harassment` — a non-minors category —
// maps to track_b through the REAL precommitModerate A2 ordering. Never a
// sexual/minors fixture (keeps the CSAM seam + carve-out rows out of play).
function passVerdict() {
	return {
		flagged: false,
		categories: { harassment: false },
		scores: { harassment: 0.01 },
	};
}
function trackBVerdict() {
	return {
		flagged: true,
		categories: { harassment: true },
		scores: { harassment: 0.9 },
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
// re-mint assertions in scenarios 3/4 need EXACT before/after key values.
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

describe("UI.A3 slice 2 — composer client modules drive POST /api/bets/place", () => {
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

	it("composer-place::happy-post-one-bet-one-comment [INV-1]", async () => {
		const userId = await seedUser("ui-a3-happy", "ui-a3-happy");
		const marketId = await seedOpenMarketWithPool("ui-a3-happy-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// The client's own modules drive everything: key mint → two-field body
		// composition → request build.
		const mint = mintSequence("ui-a3-happy");
		let key = initialKeyState(mint);
		const wireBody = composeWireBody({
			title: "durable replay argument",
			extended: "this is fine",
		});
		expect(wireBody).toBe("durable replay argument\n\nthis is fine");
		const placeBody: PlaceBody = {
			marketId,
			side: "YES",
			stake: BET_MIN_STAKE_POST,
			body: wireBody,
		};

		key = reduceKey(key, { type: "SUBMIT" }, mint);
		expect(key.inFlight).toBe(true);
		const res = await placePOST(composerRequest(placeBody, key.key));
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "success" }) },
			mint,
		);
		expect(key).toEqual({
			key: "ui-a3-happy-1",
			inFlight: false,
			pending: "none",
		});

		// F-BET-1 response contract: { betId, commentId, side, sharesBought,
		// newPrice } — the money figures as decimal STRINGS.
		expect(typeof data.betId).toBe("string");
		expect(typeof data.commentId).toBe("string");
		expect(data.side).toBe("YES");
		expect(typeof data.sharesBought).toBe("string");
		expect(typeof data.newPrice).toBe("string");

		// INV-1: exactly ONE bets row + ONE comments row, atomically paired via
		// bets.comment_id (the built half of the invariant).
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(1);
		expect(commentRows.length).toBe(1);
		expect(betRows[0]?.commentId).toBe(commentRows[0]?.id);
		expect(betRows[0]?.id).toBe(data.betId);
		expect(commentRows[0]?.id).toBe(data.commentId);
		// The composed wire body lands byte-identical; the side freezes exactly
		// as the composer sent it (INV-3 adjacency).
		expect(commentRows[0]?.body).toBe(wireBody);
		expect(commentRows[0]?.sideAtPostTime).toBe("YES");
	});

	it("composer-place::replay-same-key-same-body-returns-original-200 [I-IDEM replay direction · ADR-0031]", async () => {
		const userId = await seedUser("ui-a3-replay", "ui-a3-replay");
		const marketId = await seedOpenMarketWithPool("ui-a3-replay-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const mint = mintSequence("ui-a3-replay");
		let key = initialKeyState(mint);
		const wireBody = composeWireBody({
			title: "replay-test argument",
			extended: "",
		});
		const placeBody: PlaceBody = {
			marketId,
			side: "NO",
			stake: BET_MIN_STAKE_POST,
			body: wireBody,
		};

		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const first = await placePOST(composerRequest(placeBody, key.key));
		expect(first.status).toBe(200);
		const firstData = successData(await parseWireResponse(first));
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "success" }) },
			mint,
		);
		// The key is HELD post-outcome (rotation only ever happens at a later
		// enabling event) — the held-key manual retry is the legitimate path.
		expect(key).toEqual({
			key: "ui-a3-replay-1",
			inFlight: false,
			pending: "none",
		});

		// The manual retry: IDENTICAL body, SAME key, a FRESH Request built by
		// the same wiring builder.
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const second = await placePOST(composerRequest(placeBody, key.key));
		expect(second.status).toBe(200);
		const secondData = successData(await parseWireResponse(second));

		// ADR-0031: the durable receipt answers the ORIGINAL 200 — same betId,
		// same result object; the bet executed exactly once.
		expect(secondData.betId).toBe(firstData.betId);
		expect(secondData).toEqual(firstData);

		// Row-count: still exactly ONE bet (+ its one comment) — the replay
		// never re-executed the transaction.
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(1);
		expect(commentRows.length).toBe(1);
	});

	it("composer-place::track-b-block-fresh-key-revise-lands-clean [I-IDEM re-mint direction · ADR-0014]", async () => {
		const userId = await seedUser("ui-a3-revise", "ui-a3-revise");
		const marketId = await seedOpenMarketWithPool("ui-a3-revise-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Force the FIRST vendor verdict to Track B; the base implementation
		// (beforeEach) stays pass for the revised resubmit — the verdict flip.
		mockOpenAiModerate.mockResolvedValueOnce(trackBVerdict());

		const mint = mintSequence("ui-a3-revise");
		let key = initialKeyState(mint);
		const blockedBody = composeWireBody({
			title: "original body A",
			extended: "",
		});

		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const blocked = await placePOST(
			composerRequest(
				{
					marketId,
					side: "YES",
					stake: BET_MIN_STAKE_POST,
					body: blockedBody,
				},
				key.key,
			),
		);
		expect(blocked.status).toBe(400);
		const blockedError = errorOutcome(await parseWireResponse(blocked));
		expect(blockedError.code).toBe("comment_track_b_blocked");

		// The state map classifies the block as cache-semantics TERMINAL (the
		// 4xx is cached per key), and the reducer parks fresh_on_edit.
		const outcome = keyOutcomeFor({ kind: "error", code: blockedError.code });
		expect(outcome).toBe("terminal");
		key = reduceKey(key, { type: "OUTCOME", outcome }, mint);
		expect(key.pending).toBe("fresh_on_edit");

		// ADR-0014: the block aborted BEFORE the tx opened — the blocked
		// attempt wrote NO bet and NO comment.
		const afterBlock = await betAndCommentRows(marketId);
		expect(afterBlock.betRows.length).toBe(0);
		expect(afterBlock.commentRows.length).toBe(0);

		// The revise: an EDIT after the terminal 4xx mints a FRESH key
		// (deterministic mint — the key CHANGED).
		const heldKey = key.key;
		expect(heldKey).toBe("ui-a3-revise-1");
		key = reduceKey(key, { type: "EDIT" }, mint);
		expect(key.key).toBe("ui-a3-revise-2");
		expect(key.key).not.toBe(heldKey);
		expect(key.pending).toBe("none");

		// The REVISED body under the FRESH key → clean place.
		const revisedBody = composeWireBody({
			title: "mutated body B",
			extended: "",
		});
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const placed = await placePOST(
			composerRequest(
				{
					marketId,
					side: "YES",
					stake: BET_MIN_STAKE_POST,
					body: revisedBody,
				},
				key.key,
			),
		);
		expect(placed.status).toBe(200);
		successData(await parseWireResponse(placed));

		// Exactly ONE bet + ONE comment exist, and the comment is the REVISED
		// text — the blocked draft never landed anywhere.
		const afterRevise = await betAndCommentRows(marketId);
		expect(afterRevise.betRows.length).toBe(1);
		expect(afterRevise.commentRows.length).toBe(1);
		expect(afterRevise.commentRows[0]?.body).toBe(revisedBody);
	});

	it("composer-place::edit-after-invisible-commit-held-key-409-refresh-shows-committed-bet [F-2 · I-IDEM]", async () => {
		const userId = await seedUser("ui-a3-f2", "ui-a3-f2");
		const marketId = await seedOpenMarketWithPool("ui-a3-f2-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const mint = mintSequence("ui-a3-f2");
		let key = initialKeyState(mint);
		const originalBody = composeWireBody({
			title: "durable replay argument",
			extended: "",
		});
		const originalPlace: PlaceBody = {
			marketId,
			side: "YES",
			stake: BET_MIN_STAKE_POST,
			body: originalBody,
		};

		// The place COMMITS server-side — but the client never sees the 200
		// (the "response dropped"): its transport surfaces a network outcome,
		// so the lifecycle HOLDS the key with pending "none".
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const committed = await placePOST(composerRequest(originalPlace, key.key));
		expect(committed.status).toBe(200);
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "network" }) },
			mint,
		);
		expect(key).toEqual({
			key: "ui-a3-f2-1",
			inFlight: false,
			pending: "none",
		});

		// The user EDITS the draft. Pending is "none" (never saw a terminal),
		// so the edit does NOT rotate — the SAME key now rides an EDITED body:
		// exactly the F-2 edit-after-invisible-commit shape.
		key = reduceKey(key, { type: "EDIT" }, mint);
		expect(key.key).toBe("ui-a3-f2-1");

		const editedBody = composeWireBody({
			title: "mutated body B",
			extended: "",
		});
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const reused = await placePOST(
			composerRequest({ ...originalPlace, body: editedBody }, key.key),
		);
		expect(reused.status).toBe(409);
		const reusedError = errorOutcome(await parseWireResponse(reused));
		expect(reusedError.code).toBe("error_idempotency_key_reused");

		// F-2: classified as the protective key_reused signal — the reducer
		// walks the protective landing (refresh first, fresh key only on the
		// NEXT edit after refresh; never an auto-resubmit).
		const outcome = keyOutcomeFor({ kind: "error", code: reusedError.code });
		expect(outcome).toBe("key_reused");
		key = reduceKey(key, { type: "OUTCOME", outcome }, mint);
		expect(key.pending).toBe("refresh_then_edit");
		key = reduceKey(key, { type: "REFRESHED" }, mint);
		expect(key.pending).toBe("edit_after_refresh");
		// The key is STILL HELD through the protective landing.
		expect(key.key).toBe("ui-a3-f2-1");

		// The DB shows the COMMITTED bet: exactly ONE bet + ONE comment, the
		// ORIGINAL body — the edited text never landed (no second bet).
		const { betRows, commentRows } = await betAndCommentRows(marketId);
		expect(betRows.length).toBe(1);
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.body).toBe(originalBody);

		// The durable receipt for the held key EXISTS (bet_receipts) — the
		// refresh's re-render source of truth (ADR-0031).
		const receiptRows = await testDb
			.select({ id: betReceipts.id })
			.from(betReceipts)
			.where(eq(betReceipts.idempotencyKey, key.key));
		expect(receiptRows.length).toBe(1);
	});
});
