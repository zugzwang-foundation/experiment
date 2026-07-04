import { eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, dharmaLedger, pools, positions } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	type ConservationResult,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { FLOW_TAGS } from "@/server/dharma/tags";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import { SYNTHETIC_SEED_RESERVES } from "./_fixtures/markets";
import {
	seedAllSyntheticMarkets,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { assertDocumentedRejections } from "./_harness/asserts";
import { collide } from "./_harness/collide";
import { walkLedgerChain } from "./_harness/reconcile";

// ENGINE.10 — hot-row contention (axes 1, 2, 3). A barrier-released collision
// storm of N concurrent `place()` calls onto the 8 hot pool rows drives the
// worst-case SERIALIZABLE + FOR NO KEY UPDATE + full-jitter retry path
// (ADR-0013). The schedule is nondeterministic; the asserted END STATE is
// deterministic (plan §7 methodology — NEVER assert retry counts / interleaving).
//
// HARD assertions (plan §7):
//  - INV-1: every committed bet has a non-null comment_id + exactly one matching
//    comments row (1:1, no orphans); count parity scoped to commented POSTS
//    (Amendment D — sells excluded; this storm is `place()`-only). Asserts the
//    BUILT half (`bets.comment_id NOT NULL`), NOT `comments.bet_id NOT NULL`
//    (nullable v1 — specs-ahead, DEBATE.8/9).
//  - INV-2: per-user `walkLedgerChain` ok, balance_after >= 0 everywhere.
//  - End-state per-market conservation closes via the shipped (★) checker.
//
// DB-BACKED (local Postgres :54322). Writes-under-test flow through the real
// `@/db` singleton pool (max:10) via `runBetTransaction` → `place`; end state is
// read back through testDb/testClient (same DATABASE_URL).

const FLOW_SET = new Set<DharmaEntryType>(FLOW_TAGS);

/** Drive one top-level commented bet through the REAL W-1 spine (ids minted
 *  ONCE at task entry, closed over — retry-purity; parentCommentId ALWAYS null
 *  — the INV fence, never a reply branch). */
function placeTask(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): () => Promise<string> {
	const idempotencyKey = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	const body = `scale argument ${uuidv7()}`;
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body,
				parentCommentId: null,
				idempotencyKey,
				bodyFingerprint: uuidv7(),
				betEventId,
				commentEventId,
				creditEventId,
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
		).then((r) => r.betId);
}

/** Gather a market's bet-tied FLOW rows (betId-keyed), excluding non-flow tags. */
async function gatherBetTiedFlows(
	marketId: string,
): Promise<{ amount: string; entryType: DharmaEntryType }[]> {
	const betRows = await testDb
		.select({ id: bets.id })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const betIds = betRows.map((b) => b.id);
	if (betIds.length === 0) return [];
	const rows = await testDb
		.select({ amount: dharmaLedger.amount, entryType: dharmaLedger.entryType })
		.from(dharmaLedger)
		.where(inArray(dharmaLedger.betId, betIds));
	return rows.filter((r) => FLOW_SET.has(r.entryType));
}

describe("scale — hot-row contention (axes 1,2,3)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("hot-row-contention::inv1-bet-comment-1to1-no-orphans-under-storm", async () => {
		// Storm: each of D users places ONE commented bet, distributed round-robin
		// across the 8 hot markets — concurrent writers pile onto the same pool rows.
		const marketIds = await seedAllSyntheticMarkets();
		const degree = 32;
		const users: string[] = [];
		const factories: Array<() => Promise<string>> = [];
		for (let i = 0; i < degree; i++) {
			const userId = await seedUser(`hot-inv1-${i}`, "1000");
			users.push(userId);
			factories.push(
				placeTask({
					userId,
					marketId: marketIds[i % marketIds.length] ?? "",
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				}),
			);
		}

		const results = await collide(factories, { degree });
		const committed = results.filter((r) => r.status === "fulfilled").length;
		expect(committed).toBeGreaterThan(0);
		// §5 taxonomy: any non-committed writer surfaced a DOCUMENTED terminal error.
		assertDocumentedRejections(results);

		// INV-1: EVERY bet row has a non-null comment_id (the BUILT half) and a
		// matching comments row — 1:1, no orphans. `NOT NULL` is schema-enforced,
		// so the count parity is the live assertion.
		const betRows = await testDb
			.select({ id: bets.id, commentId: bets.commentId })
			.from(bets);
		expect(betRows.length).toBe(committed);
		for (const row of betRows) {
			expect(row.commentId).not.toBeNull();
		}
		const commentRows = await testDb.select({ id: comments.id }).from(comments);
		// Count parity (scoped to commented POSTS — `place()`-only storm).
		expect(commentRows.length).toBe(committed);
		// 1:1 — every bet's comment_id resolves to a distinct existing comment.
		const commentIds = new Set(commentRows.map((c) => c.id));
		const betCommentIds = betRows.map((b) => b.commentId);
		expect(new Set(betCommentIds).size).toBe(betRows.length);
		for (const cid of betCommentIds) {
			expect(commentIds.has(cid ?? "")).toBe(true);
		}
	});

	it("hot-row-contention::inv2-ledger-chain-intact-and-non-negative-per-user", async () => {
		// Each user places SEVERAL near-balance bets so the per-user ledger chain
		// has multiple links to walk; the storm interleaves their appends.
		const marketIds = await seedAllSyntheticMarkets();
		const userCount = 16;
		const betsPerUser = 3;
		const userIds: string[] = [];
		const factories: Array<() => Promise<string>> = [];
		for (let u = 0; u < userCount; u++) {
			const userId = await seedUser(`hot-inv2-${u}`, "1000");
			userIds.push(userId);
			for (let b = 0; b < betsPerUser; b++) {
				factories.push(
					placeTask({
						userId,
						marketId: marketIds[(u + b) % marketIds.length] ?? "",
						side: b % 2 === 0 ? "YES" : "NO",
						stake: "10",
					}),
				);
			}
		}

		await collide(factories, { degree: 48 });

		// INV-2: for every user, the seq-ordered chain (ADR-0029 total order)
		// satisfies balance_after[i] == balance_after[i-1] + amount[i] and >= 0
		// everywhere. The former (created_at, id) walk was a latent flake: a
		// same-ms tie could invert two rows and fail a CORRECT ledger.
		for (const userId of userIds) {
			const rows = await testDb
				.select({
					amount: dharmaLedger.amount,
					balanceAfter: dharmaLedger.balanceAfter,
				})
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userId))
				.orderBy(dharmaLedger.seq);
			const walk = walkLedgerChain(rows);
			expect(walk.ok).toBe(true);
			for (const row of rows) {
				expect(new CpmmDecimal(row.balanceAfter).greaterThanOrEqualTo(0)).toBe(
					true,
				);
			}
		}

		// Storage backstop is not bypassed: no row violates the CHECK.
		const negative = await testClient.unsafe(
			`SELECT count(*)::int AS n FROM dharma_ledger WHERE balance_after < 0`,
		);
		expect((negative[0] as unknown as { n: number }).n).toBe(0);
	});

	it("hot-row-contention::per-market-conservation-closes-after-storm", async () => {
		// After a pure-buy storm (no resolution), each market's bet-tied FLOW sum
		// must equal its net admin pool injection (★). No market is resolved, so
		// netAdminPoolInjection = seed − cash, where the pool's CASH backing =
		// Y + Σ(YES positions) (the void.ts:178-187 cash measure) = seed + Σstakes
		// − Σproceeds. A constant-product buy barely moves Y+N (Δ(Y+N) ≈ 0.099 per
		// stake-10 bet — the reserve-SUM delta is NOT the Dharma absorbed; the
		// cash value is). Σ FLOW (all bet_stake debits, negative) then reconciles
		// EXACTLY to seed − cash, proving no Dharma leaked per market.
		const marketIds = await seedAllSyntheticMarkets();
		const factories: Array<() => Promise<string>> = [];
		for (let i = 0; i < 24; i++) {
			const userId = await seedUser(`hot-cons-${i}`, "1000");
			factories.push(
				placeTask({
					userId,
					marketId: marketIds[i % marketIds.length] ?? "",
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				}),
			);
		}

		await collide(factories, { degree: 32 });

		for (const marketId of marketIds) {
			const ledgerFlows = await gatherBetTiedFlows(marketId);
			// Pool cash backing = Y + Σ(YES positions); injection = seed − cash.
			const poolRow = await testDb
				.select({ yesReserves: pools.yesReserves })
				.from(pools)
				.where(eq(pools.marketId, marketId));
			const positionRows = await testDb
				.select({ side: positions.side, quantity: positions.quantity })
				.from(positions)
				.where(eq(positions.marketId, marketId));
			const yesHeld = positionRows
				.filter((p) => p.side === "YES")
				.reduce((acc, p) => acc.plus(p.quantity), new CpmmDecimal(0));
			const cash = new CpmmDecimal(
				poolRow[0]?.yesReserves ?? SYNTHETIC_SEED_RESERVES,
			).plus(yesHeld);
			const netAdminPoolInjection = new CpmmDecimal(SYNTHETIC_SEED_RESERVES)
				.minus(cash)
				.toFixed(18);
			const result: ConservationResult = checkMarketConservation({
				ledgerFlows,
				netAdminPoolInjection,
			});
			expect(result).toEqual({ ok: true });
		}
	});

	// ── Negative control: the chain walker must FLAG a broken chain ──────────
	// Feeds `walkLedgerChain` a SYNTHETIC broken chain (a balance_after that is
	// not prev+amount). At GREEN the walker returns { ok:false } with the broken
	// index; at RED it is red because the walker throws "not implemented". This
	// proves the INV-2 assertion above is non-vacuous — a lost-update under
	// collision that nets to a plausible balance would be caught.
	describe("negative control — broken ledger chain is flagged", () => {
		it("hot-row-contention::walk-flags-synthetic-broken-chain", () => {
			const brokenChain = [
				{
					amount: "1000.000000000000000000",
					balanceAfter: "1000.000000000000000000",
				},
				{
					amount: "-10.000000000000000000",
					balanceAfter: "990.000000000000000000",
				},
				// LOST UPDATE: this row claims 990 but prev(990) + (-10) = 980.
				{
					amount: "-10.000000000000000000",
					balanceAfter: "990.000000000000000000",
				},
			];
			const walk = walkLedgerChain(brokenChain);
			expect(walk.ok).toBe(false);
			expect(walk.brokenAtIndex).toBe(2);

			// A genuinely intact chain stays ok (control's control).
			const intact = [
				{
					amount: "1000.000000000000000000",
					balanceAfter: "1000.000000000000000000",
				},
				{
					amount: "-10.000000000000000000",
					balanceAfter: "990.000000000000000000",
				},
				{
					amount: "-10.000000000000000000",
					balanceAfter: "980.000000000000000000",
				},
			];
			expect(walkLedgerChain(intact)).toEqual({ ok: true });
		});
	});
});
