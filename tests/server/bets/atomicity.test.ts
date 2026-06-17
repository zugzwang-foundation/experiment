import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 F-BET acceptance — `atomicity.test.ts::happy-path-entry` (F-BET-1;
// INV-1 + INV-3 acceptance-level). The full place flow writes the spine
// atomically — positions → comments → bets → dharma_ledger → events×2 → pools
// [R1] — all in ONE SERIALIZABLE tx. ENGINE.7 minted I-ATOMICITY-001 at the
// wrapper level; THIS is the acceptance-level exercise through the real Route
// Handler + real `place.ts` + real `runBetTransaction` hitting test Postgres.
//
// Invariants exercised: INV-1 (bet ↔ comment atomicity — every write present
// together), INV-3 (comments.side_at_post_time bound to the bet's side).
//
// CI-RED (DB/route-backed): local Postgres :54322 is DOWN → ECONNREFUSED (infra,
// not an assertion-red); plus the greenfield VALUE import of the place Route
// Handler. Written behaviorally complete so CI goes GREEN once ENGINE.8 lands.
// The REAL DB transaction hits test Postgres; only the externals are mocked
// (auth/origin/rate-limit/idempotency/moderation) per the plan kickoff.
//
// Assert POST-CONDITIONS (row existence/values), NOT positional write order
// (mirrors the merged `canonical-lock-order` precedent — the place spine order
// is FK-driven [R1] but the test reads the committed end-state). Money/share
// values cross as decimal STRINGS (CLAUDE.md §2).

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

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
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
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
// ENGINE.12 (RC9): greenfield constant import — the credit amount is never a
// literal so the suite tracks HARDEN.5 retuning.
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.20",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Atomicity Acceptance User",
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
			title: "Atomicity Acceptance Market",
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

describe("ENGINE.8 F-BET-1 — place happy-path entry (INV-1 + INV-3)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("bet-place::happy-path-entry", async () => {
		const userId = await seedUser("atom-acc", "atom-acc");
		const marketId = await seedOpenMarketWithPool("atom-acc-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "F-BET-1 entry argument, bound to YES.",
				},
				"atom-acc-key",
			),
		);

		// 200 + the §4.4 success envelope: { ok:true, data:<flow-specific-shape> }.
		// Assert the envelope STRICTLY; the contents/shape of `data` are the
		// implementer's open contract (plan §4.4 wire shape) — not pinned here. The
		// `data.betId` field is READ below only to drive the persisted-row lookup.
		expect(res.status).toBe(200);
		const payload = await res.json();
		expect(payload.ok).toBe(true);
		expect(payload.data).toBeDefined();
		const data = payload.data;

		// ── INV-1: ALL spine rows present TOGETHER (atomic) ────────────────────
		// positions: one held YES row.
		const positionRows = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.side).toBe("YES");

		// comments: one row; INV-3 → side_at_post_time = YES (the bet's side).
		const commentRows = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				betId: comments.betId,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.sideAtPostTime).toBe("YES");

		// bets: one row; comment_id links the comment (INV-1 schema half), and the
		// response betId matches the persisted row.
		const betRows = await testDb
			.select({ id: bets.id, commentId: bets.commentId, side: bets.side })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.commentId).toBe(commentRows[0]?.id);
		expect(betRows[0]?.id).toBe(data.betId);
		expect(betRows[0]?.side).toBe("YES");

		// dharma_ledger: initial_grant + ENGINE.12 daily_allowance credit (the
		// first commented bet of the UTC day pays it INSIDE this same tx) +
		// bet_stake debit; the stake links the bet (bet_id = bet.id) [R1].
		// Balance 1000 → +credit → −stake.
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.length).toBe(3);
		const creditRow = ledgerRows.find((r) => r.entryType === "daily_allowance");
		expect(creditRow).toBeDefined();
		expect(creditRow?.betId).toBeNull();
		expect(creditRow?.amount).toBe(
			new CpmmDecimal(DAILY_CREDIT_DHARMA).toFixed(18),
		);
		expect(creditRow?.balanceAfter).toBe(
			new CpmmDecimal("1000").plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);
		const stakeRow = ledgerRows.find((r) => r.entryType === "bet_stake");
		expect(stakeRow).toBeDefined();
		expect(stakeRow?.betId).toBe(betRows[0]?.id);
		expect(stakeRow?.balanceAfter).toBe(
			new CpmmDecimal("1000").plus(DAILY_CREDIT_DHARMA).minus("10").toFixed(18),
		);
		// The debit CHAINS off the credit (persist.ts:58-62): its implied
		// previous balance (balance_after − amount) equals the credit's
		// balance_after exactly.
		expect(
			new CpmmDecimal(stakeRow?.balanceAfter ?? "0")
				.minus(stakeRow?.amount ?? "0")
				.toFixed(18),
		).toBe(creditRow?.balanceAfter);

		// events ×2 [R3]: bet.placed (aggregate "bet", aggregateId = bet.id) +
		// comment.placed (aggregate "comment", aggregateId = comment.id).
		const eventRows = await testDb
			.select({
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.aggregateType, "bet"));
		const commentEventRows = await testDb
			.select({
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.aggregateType, "comment"));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventType).toBe("bet.placed");
		expect(eventRows[0]?.aggregateId).toBe(betRows[0]?.id);
		expect(commentEventRows.length).toBe(1);
		expect(commentEventRows[0]?.eventType).toBe("comment.placed");
		expect(commentEventRows[0]?.aggregateId).toBe(commentRows[0]?.id);

		// ENGINE.12: the credit's event rides the SAME atomic tx — exactly one
		// dharma.credited (aggregate "dharma_account", aggregateId = userId).
		const dharmaEventRows = await testDb
			.select({
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.aggregateType, "dharma_account"));
		expect(dharmaEventRows.length).toBe(1);
		expect(dharmaEventRows[0]?.eventType).toBe("dharma.credited");
		expect(dharmaEventRows[0]?.aggregateId).toBe(userId);

		// pools: reserves UPDATED off the seed (the CPMM buy moved them).
		const [poolRow] = await testDb
			.select({ yesReserves: pools.yesReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).not.toBe(SEED_RESERVES);
	});

	// ── DEBATE.1 — INV-1 API frontstop (bet→comment) ──────────────────────────
	it("bet-place::rejects-bet-without-comment-400-comment-requires-bet", async () => {
		// The bet→comment half of INV-1, at the API layer: a place request with an
		// EMPTY comment body is not a valid atomic bet+comment pair → 400
		// `comment_requires_bet` (the NAMED code, NOT the generic
		// `error_invalid_request_body`). No bet, no comment, no position persists —
		// there is no way to land a stake without an argument.
		const userId = await seedUser("atom-nocomment", "atom-nocomment");
		const marketId = await seedOpenMarketWithPool("atom-nocomment-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "" },
				"atom-nocomment-key",
			),
		);

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_requires_bet");

		// Nothing wrote — no orphan bet without its argument.
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
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(0);
	});

	// ── DEBATE.1 — INV-1 construction (comment→bet) ───────────────────────────
	it("bet-place::every-persisted-comment-has-a-bet-referencing-it", async () => {
		// The comment→bet half of INV-1, BY CONSTRUCTION: comments are only ever
		// inserted inside place()'s single SERIALIZABLE tx, always paired with a
		// bet whose `comment_id` references the comment (`comments.bet_id` stays
		// NULLABLE — DEBATE.8/9 — and is NOT relied on here). There is NO
		// comment-only write path (no `/api/comments` route). After several places,
		// EVERY persisted comment is referenced by exactly one bet's `comment_id`.
		const userA = await seedUser("atom-ctor-a", "atom-ctor-a");
		const userB = await seedUser("atom-ctor-b", "atom-ctor-b");
		const marketId = await seedOpenMarketWithPool("atom-ctor-market");
		await seedDharmaGrant(userA);
		await seedDharmaGrant(userB);

		mockGetSession.mockResolvedValue({ user: { id: userA } });
		const r1 = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "A's argument" },
				"atom-ctor-a-key",
			),
		);
		expect(r1.status).toBe(200);

		mockGetSession.mockResolvedValue({ user: { id: userB } });
		const r2 = await placePOST(
			placeRequest(
				{ marketId, side: "NO", stake: "10", body: "B's argument" },
				"atom-ctor-b-key",
			),
		);
		expect(r2.status).toBe(200);

		// Every comment row is referenced by a bet's comment_id (the INV-1 schema
		// half, NOT NULL). No comment exists without a bet pointing at it.
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		const betRows = await testDb
			.select({ commentId: bets.commentId })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(commentRows.length).toBe(2);
		expect(betRows.length).toBe(2);
		const referencedCommentIds = new Set(betRows.map((r) => r.commentId));
		for (const c of commentRows) {
			expect(referencedCommentIds.has(c.id)).toBe(true);
		}
	});
});
