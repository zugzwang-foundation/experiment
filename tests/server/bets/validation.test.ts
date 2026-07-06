import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 F-BET acceptance — the rejection matrix (SPEC.1 §7 paths). Each test
// drives a precondition that should make the place/sell Route Handler reject
// with the spec-locked status + §4.4 wire code:
//   insufficient_dharma   F-BET-4  → 400 (INV-2 friendly seam; payload balance+required)
//   opposite_side_held    F-BET-10 → 400
//   position_not_held     (sell)   → 400
//   banned_user           F-BET-7  → 403
//   market_resolving      Q3       → 409   (NOT normalized to 400 — spec-locked)
//   error_market_closed_at         → 400
//   comment_too_long               → 400
//   below_post_floor      ADR-0018 → 400   (place route exercises the POST floor)
//   comment_track_a_blocked   R2   → 400   (moderation track_a aborts the entry)
//   comment_track_b_blocked  R2   → 400   (moderation track_b aborts the entry — F-MOD-4; DEBATE.7)
//
// Invariants exercised: INV-2 (insufficient_dharma friendly pre-check, F-BET-4).
//
// CI-RED (DB/route-backed): Postgres :54322 DOWN + greenfield place/sell-route
// imports. REAL DB tx; externals mocked. `precommitModerate` + `checkRateLimit`
// are SETTABLE per test (track_a/track_b outcomes). The §4.4 error envelope is
// { ok:false, error:{ code, message, retry_after? } } — `retry_after` present
// IFF status ∈ {429,503}; assert the CODE + status. Money values are decimal
// STRINGS (CLAUDE.md §2).

const { mockGetSession, mockPrecommit } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(),
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
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	bets,
	comments,
	dharmaLedger,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
// ENGINE.12 (RC9): greenfield constant import — the insufficient_dharma
// fixture must clear the POST-credit pre-check (balance + credit < stake),
// derived from the live constant so HARDEN.5 retunes keep it honest.
// AUDIT-FIX-B7a: COMMENT_MAX_LENGTH pins the A24 upper-bound-on-raw boundary.
import {
	COMMENT_MAX_LENGTH,
	DAILY_CREDIT_DHARMA,
} from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.23",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(
	emailTag: string,
	pseudonym: string,
	opts?: { banned?: boolean },
): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Validation User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: opts?.banned ? new Date("2026-02-01T00:00:00Z") : null,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarketWithPool(
	slug: string,
	status: "Open" | "Closed" | "Resolving",
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Validation Market",
			status,
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

async function seedDharmaGrant(userId: string, amount: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount, entryType: "initial_grant" }),
	);
}

async function errorBody(res: Response): Promise<{
	code: string;
	retry_after?: number;
}> {
	const payload = await res.json();
	// §4.4 envelope: { ok:false, error:{ code, message, retry_after? } }.
	return payload.error ?? payload;
}

describe("ENGINE.8 F-BET — rejection matrix", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
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
		]);
	});

	it("bet-place::rejects-insufficient-dharma (F-BET-4 → 400, INV-2)", async () => {
		// ENGINE.12: the pre-check now runs against the POST-credit balance (R4
		// — the day's first commented bet accrues before the check), so the
		// fixture must satisfy balance + credit < stake. Seed 5; stake =
		// 5 + DAILY_CREDIT_DHARMA + 1 (still ≥ BET_MIN_STAKE_POST today) → the
		// in-snapshot pre-check rejects with 400 insufficient_dharma. INV-2
		// friendly seam (the authoritative backstop is DharmaOverdraftError +
		// CHECK; this is the user-facing pre-check).
		const stake = new CpmmDecimal("5")
			.plus(DAILY_CREDIT_DHARMA)
			.plus("1")
			.toFixed(0);
		const userId = await seedUser("insuff", "insuff");
		const marketId = await seedMarketWithPool("insuff-market", "Open");
		await seedDharmaGrant(userId, "5");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake, body: "cannot afford this" },
				"insuff-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("insufficient_dharma");

		// ENGINE.12 (ADR-0018 conditionality by rollback): the rejection throws
		// INSIDE the tx, AFTER the accrual step — the whole tx rolls back, so
		// no credit row persists and the cursor stays NULL (the failed attempt
		// did not consume the day's credit).
		const ledgerRows = await testDb
			.select({ entryType: dharmaLedger.entryType })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(
			ledgerRows.filter((r) => r.entryType === "daily_allowance").length,
		).toBe(0);
		const userRows = await testDb
			.select({ lastAllowanceAccruedAt: users.lastAllowanceAccruedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(userRows[0]?.lastAllowanceAccruedAt).toBeNull();
	});

	it("bet-place::rejects-opposite-side-held (F-BET-10 → 400)", async () => {
		// User holds YES; a NO entry is rejected 400 opposite_side_held (the
		// held-side read predicate — single-side guarantee).
		const userId = await seedUser("opp", "opp");
		const marketId = await seedMarketWithPool("opp-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const entry = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "I hold YES" },
				"opp-key-1",
			),
		);
		expect(entry.status).toBe(200);

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "NO", stake: "10", body: "now I try NO" },
				"opp-key-2",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("opposite_side_held");
	});

	it("bet-sell::rejects-position-not-held (→ 400)", async () => {
		// Sell against a market the user holds NO position in → 400
		// position_not_held.
		const userId = await seedUser("nopos", "nopos");
		const marketId = await seedMarketWithPool("nopos-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await sellPOST(
			req("/api/bets/sell", { marketId, shares: "5" }, "nopos-key"),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("position_not_held");
	});

	it("bet-place::rejects-banned-user (F-BET-7 → 403)", async () => {
		// users.banned_at IS NOT NULL → 403 banned_user (auth+ban gate, step 1).
		const userId = await seedUser("banned", "banned", { banned: true });
		const marketId = await seedMarketWithPool("banned-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "I am banned" },
				"banned-key",
			),
		);
		expect(res.status).toBe(403);
		expect((await errorBody(res)).code).toBe("banned_user");
	});

	it("bet-place::rejects-market-resolving-409 [Q3]", async () => {
		// Resolving → 409 market_resolving (coarse gate; the 400/409 asymmetry is
		// spec-locked, NOT normalized to 400). 409 ∉ {429,503} → no retry_after.
		const userId = await seedUser("resolving", "resolving");
		const marketId = await seedMarketWithPool("resolving-market", "Resolving");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "market is resolving" },
				"resolving-key",
			),
		);
		expect(res.status).toBe(409);
		const body = await errorBody(res);
		expect(body.code).toBe("market_resolving");
		expect(body.retry_after).toBeUndefined();
	});

	it("bet-place::rejects-market-closed-400", async () => {
		// Closed → 400 error_market_closed_at (coarse gate).
		const userId = await seedUser("closed", "closed");
		const marketId = await seedMarketWithPool("closed-market", "Closed");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "market is closed" },
				"closed-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("error_market_closed_at");
	});

	it("bet-place::rejects-comment-too-long-400", async () => {
		// Body length > COMMENT_MAX_LENGTH → 400 comment_too_long (step-5
		// validation). 50_000 chars is unambiguously over any placeholder cap.
		const userId = await seedUser("toolong", "toolong");
		const marketId = await seedMarketWithPool("toolong-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "x".repeat(50_000) },
				"toolong-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("comment_too_long");
	});

	it("bet-place::rejects-below-post-floor-400 (ADR-0018)", async () => {
		// A stake below BET_MIN_STAKE_POST → 400 below_post_floor (the place route
		// exercises the POST floor; parentCommentId null). Stake "0" is below any
		// positive placeholder floor; the zod stake>0 gate may also reject — but the
		// floor code is the spec-named rejection. Use a tiny positive sub-floor
		// stake derived from the live constant to target the floor branch precisely.
		const { BET_MIN_STAKE_POST } = await import("@/server/config/limits");
		// BigInt(1), not `1n` (ES2017 target — TS2737 on bigint literals).
		const subFloor = String(
			BigInt(BET_MIN_STAKE_POST.split(".")[0] ?? BET_MIN_STAKE_POST) -
				BigInt(1),
		);
		const userId = await seedUser("floor", "floor");
		const marketId = await seedMarketWithPool("floor-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: subFloor,
					body: "below the post floor",
				},
				"floor-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("below_post_floor");
	});

	it("bet-place::comment-track-a-blocked-400 [R2]", async () => {
		// Moderation verdict track_a → 400 comment_track_a_blocked; both tracks
		// ABORT the entry (F-MOD-4), so NO position is written.
		const userId = await seedUser("track-a", "track-a");
		const marketId = await seedMarketWithPool("track-a-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual/minors"],
			categoryScores: { "sexual/minors": 0.99 },
		});

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "blocked content" },
				"track-a-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("comment_track_a_blocked");

		// The entry aborted BEFORE the tx — no position written.
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionRows.length).toBe(0);
	});

	it("bet-place::comment-track-b-blocked-400 [R2]", async () => {
		// Moderation verdict track_b → 400 comment_track_b_blocked (DEBATE.7 /
		// ADR-0021 — the held queue is removed; the old 423 under-review code is
		// superseded). Both tracks abort the entry per F-MOD-4.
		const userId = await seedUser("track-b", "track-b");
		const marketId = await seedMarketWithPool("track-b-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["harassment"],
			categoryScores: { harassment: 0.95 },
		});

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "blocked content" },
				"track-b-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("comment_track_b_blocked");

		// Aborted before the tx — no position written.
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionRows.length).toBe(0);
	});
});

// === AUDIT-FIX-B7a / A24 — whitespace-only comment bodies =================
//
// SPEC.1 F-BET-1 C.length rider (2026-07-06): the LOWER bound is evaluated on
// the whitespace-TRIMMED comment text — a whitespace-only body is an absent
// argument and rejects `comment_requires_bet` per F-COMMENT-5 (INV-1: no bet
// whose argument is visually absent). The UPPER bound (`comment_too_long`) and
// the STORED value are the submitted (RAW) text, byte-identical to the text
// moderated (moderated ≡ stored). Trim is JS String.prototype.trim() (Unicode
// WhiteSpace + LineTerminator).
//
// RED (pre-impl — route.ts step-5 gates only `body.length === 0`): cases 1–3
// pass the gate today → moderation runs + a bet/comment/ledger triple mints, so
// the 400 / no-writes / moderation-not-called assertions FAIL. Cases 4–6 + the
// raw-storage pins are regression GREEN against current code (the emptiness gate
// already lets a padded-non-empty body through, the upper bound already runs on
// raw, and the comment is already stored raw) — they guard against an over-trim
// "fix" that trims the moderated/stored body or moves the upper bound onto the
// trimmed length.
describe("AUDIT-FIX-B7a A24 — whitespace comment semantics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
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
		]);
	});

	// The W-1 tx never opens: zero bet / comment / dharma_ledger rows for the
	// user (NO seedDharmaGrant on these cases → an empty ledger means "no
	// daily_allowance accrual either", not just "no stake row").
	async function assertNoWrites(userId: string): Promise<void> {
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.userId, userId));
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.userId, userId));
		const ledgerRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(betRows.length).toBe(0);
		expect(commentRows.length).toBe(0);
		expect(ledgerRows.length).toBe(0);
	}

	// Cases 1–3: whitespace-only bodies (ASCII / mixed ASCII / Unicode) all
	// trim to "" → 400 comment_requires_bet, before moderation, before the tx.
	it.each([
		["whitespace-only-ascii", "   "],
		["mixed-ascii-whitespace", " \t\n "],
		// NBSP (U+00A0) + EM SPACE (U+2003): JS trim() strips Unicode WhiteSpace.
		["unicode-nbsp-em-space", "\u00A0\u2003"],
	])("comment-requires-bet::%s → 400 + no W-1 tx", async (tag, body) => {
		// NO seedDharmaGrant: the rejection is at step 5 (pre-tx), so the user
		// needs no balance; an empty ledger post-request proves the tx never
		// opened (no accrual).
		const userId = await seedUser(`ws-${tag}`, `ws-${tag}`);
		const marketId = await seedMarketWithPool(`ws-${tag}-market`, "Open");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body },
				`ws-${tag}-key`,
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("comment_requires_bet");
		// Rejection precedes moderation (step 5 < step 6) — the emptiness gate
		// throws before precommitModerate is reached.
		expect(mockPrecommit).not.toHaveBeenCalled();
		await assertNoWrites(userId);
	});

	it("comment-raw-preserved::single-char-padded → 200, stored + moderated RAW", async () => {
		// " a " trims to "a" (non-empty) → passes the emptiness gate. The stored
		// comment body and the moderated text are the RAW " a " byte-identically
		// (moderated ≡ stored); trim is used ONLY for the emptiness gate.
		const raw = " a ";
		const userId = await seedUser("ws-raw", "ws-raw");
		const marketId = await seedMarketWithPool("ws-raw-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: raw },
				"ws-raw-key",
			),
		);
		expect(res.status).toBe(200);

		// Moderation saw the RAW text (not the trimmed "a").
		expect(mockPrecommit).toHaveBeenCalledWith(
			expect.objectContaining({ text: raw }),
		);

		// The stored comment body is the RAW " a ", byte-identical.
		const commentRows = await testDb
			.select({ body: comments.body })
			.from(comments)
			.where(eq(comments.userId, userId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.body).toBe(raw);
	});

	it("comment-length::raw-exactly-max → 200 (upper bound is inclusive on raw)", async () => {
		// RAW length exactly COMMENT_MAX_LENGTH, whitespace-padded (1 + (MAX-2) +
		// 1). Upper bound is `> MAX`, so exactly-MAX passes; the body is stored raw
		// at full COMMENT_MAX_LENGTH.
		const raw = ` ${"x".repeat(COMMENT_MAX_LENGTH - 2)} `;
		expect(raw.length).toBe(COMMENT_MAX_LENGTH);
		const userId = await seedUser("ws-max", "ws-max");
		const marketId = await seedMarketWithPool("ws-max-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: raw },
				"ws-max-key",
			),
		);
		expect(res.status).toBe(200);
		const commentRows = await testDb
			.select({ body: comments.body })
			.from(comments)
			.where(eq(comments.userId, userId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.body).toBe(raw);
	});

	it("comment-too-long::padded-past-max → 400 (upper bound on RAW, not trimmed)", async () => {
		// The discriminating case: trimmed length < MAX (4999) but RAW length > MAX
		// (5001). The upper bound is evaluated on the RAW text, so this rejects
		// `comment_too_long` — an over-trim "fix" that measured the trimmed length
		// would wrongly ACCEPT this, so this pin guards the raw upper bound.
		const raw = `${"x".repeat(COMMENT_MAX_LENGTH - 1)}  `;
		expect(raw.trim().length).toBeLessThan(COMMENT_MAX_LENGTH);
		expect(raw.length).toBeGreaterThan(COMMENT_MAX_LENGTH);
		const userId = await seedUser("ws-over", "ws-over");
		const marketId = await seedMarketWithPool("ws-over-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: raw },
				"ws-over-key",
			),
		);
		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe("comment_too_long");
	});
});
