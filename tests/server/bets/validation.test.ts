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
//   comment_track_b_under_review R2→ 423   (moderation track_b aborts the entry — F-MOD-4)
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
import { dharmaLedger, markets, pools, positions, users } from "@/db/schema";
// ENGINE.12 (RC9): greenfield constant import — the insufficient_dharma
// fixture must clear the POST-credit pre-check (balance + credit < stake),
// derived from the live constant so HARDEN.5 retunes keep it honest.
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient, testDb } from "../../db/_fixtures/db";

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
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
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

	it("bet-place::comment-track-b-under-review-423 [R2]", async () => {
		// Moderation verdict track_b → 423 comment_track_b_under_review (the
		// deliberate, spec-locked 423 — NOT normalized to 400). Both tracks abort
		// the entry per F-MOD-4.
		const userId = await seedUser("track-b", "track-b");
		const marketId = await seedMarketWithPool("track-b-market", "Open");
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["harassment"],
		});

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "under review content" },
				"track-b-key",
			),
		);
		expect(res.status).toBe(423);
		expect((await errorBody(res)).code).toBe("comment_track_b_under_review");

		// Aborted before the tx — no position written.
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionRows.length).toBe(0);
	});
});
