import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

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
import { runBetTransaction } from "@/server/bets/transaction";
import { computeBuy } from "@/server/cpmm/calculate";
import { appendLedgerRow } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";
import { upsertPositionDelta } from "@/server/positions/persist";

import { testClient, testDb } from "../db/_fixtures/db";

// I-ATOMICITY-001 — INV-1 (bet ↔ comment atomicity), wrapper-level. ENGINE.7
// MINTS the canonical test (plan ruling (d); thesis-invariants §INV-1). The W-1
// wrapper IS the mechanism (SPEC.2 §14.1/§14.4): one SERIALIZABLE tx wraps the
// full spine — if ANY write throws, EVERY write rolls back.
//
// DB-BACKED: cannot RED locally (local Postgres :54322 DOWN; ECONNREFUSED is
// infra, not an assertion red — the whole-suite-needs-Postgres convention).
// First true run is CI on the PR. Written type-correct + behaviorally complete
// so CI goes GREEN once `runBetTransaction` lands. The greenfield value import
// (`runBetTransaction`) keeps this from resolving until ENGINE.7 lands.
//
// The canonical assertion (plan §"Test plan" / §"Edge cases") is the MID-SPINE
// abort: a representative callback writes pools (UPDATE reserves) + positions +
// dharma_ledger, then THROWS PARTWAY — after dharma_ledger, BEFORE the
// comments/bets/events writes — and we assert ZERO rows persisted across ALL
// tables (a partial chain unwinds COMPLETELY, the strong proof). Variants:
//   (a) happy path — the full spine commits iff no throw (comments carries BOTH
//       side_at_post_time AND stake_at_post_time per the S3 trap; bets.comment_id
//       links the comment; bets.bet_id stays null on disk — NOT asserted).
//   (b) edge throw-BEFORE-events (after bets) — same zero-rows assertion
//       (terminal-step abort).
//
// The abort cases throw a NON-RETRYABLE plain `Error` (no `.code`) so the
// wrapper bubbles it WITHOUT retrying — the retry path is concurrency.test.ts's.
//
// All money/share values cross boundaries as exact 18-dp canonical strings; no
// float ever crosses a boundary (CLAUDE.md §2). Sign/equality are string checks.

const META = {
	request_id: "test",
	flow_id: "F-BET-1",
	user_id: null,
	actor_id: "test",
	idempotency_key: null,
	ip: "test",
	user_agent: "test",
};

const SEED_RESERVES = "100.000000000000000000";

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Atomicity User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Atomicity Market",
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

// Seed a positive Dharma balance so the in-spine `bet_stake -10` debit does not
// trip DharmaOverdraftError (a fresh user reads canonical-zero). Committed
// BEFORE runBetTransaction so the wrapper's tx observes balance 1000.
async function seedDharmaGrant(userId: string): Promise<void> {
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

describe("I-ATOMICITY-001: bet+comment atomic under the W-1 wrapper", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("bet-comment-atomicity::mid-spine-abort-rolls-back-all-tables", async () => {
		// CANONICAL INV-1 proof. The callback writes pools+positions+dharma_ledger,
		// then throws BEFORE comments/bets/events. Assert: pool reserves UNCHANGED
		// at the seeded values, and positions/dharma_ledger(bet_stake)/comments/
		// bets/events all empty for this user+market. A partial chain unwinds
		// completely.
		const userId = await seedUser("atom-mid", "atom-mid");
		const marketId = await seedOpenMarketWithPool("atom-mid-market");
		await seedDharmaGrant(userId);

		await expect(
			runBetTransaction({ marketId, flow: "F-BET-1" }, async ({ tx, pool }) => {
				// pools UPDATE (CPMM-derived reserves on the locked row).
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				await tx
					.update(pools)
					.set({
						yesReserves: buy.reserves.yes,
						noReserves: buy.reserves.no,
					})
					.where(eq(pools.id, pool.id));
				// positions delta.
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				// dharma_ledger bet_stake debit (1000 → 990).
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				// THROW PARTWAY — after dharma_ledger, BEFORE comments/bets/events.
				// Plain Error, no `.code` → NOT retried, bubbles immediately.
				throw new Error("synthetic mid-spine abort");
			}),
		).rejects.toThrow("synthetic mid-spine abort");

		// pools reserves UNCHANGED (the UPDATE rolled back).
		const [poolRow] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe(SEED_RESERVES);
		expect(poolRow?.noReserves).toBe(SEED_RESERVES);

		// positions: no row for this user+market.
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(0);

		// dharma_ledger: ONLY the committed initial_grant survives; the bet_stake
		// row rolled back. Balance is still 1000.
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.length).toBe(1);
		expect(ledgerRows[0]?.entryType).toBe("initial_grant");
		expect(ledgerRows.some((r) => r.entryType === "bet_stake")).toBe(false);

		// comments / bets / events: empty for this market.
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
		const eventRows = await testDb
			.select()
			.from(events)
			.where(eq(events.aggregateId, marketId));
		expect(eventRows.length).toBe(0);
	});

	it("bet-comment-atomicity::happy-path-commits-full-spine", async () => {
		// The full spine commits iff no throw. All rows present; comments carries
		// BOTH side_at_post_time AND stake_at_post_time (S3); bets.comment_id links
		// the comment (FK order: comment first then bet); events present.
		const userId = await seedUser("atom-happy", "atom-happy");
		const marketId = await seedOpenMarketWithPool("atom-happy-market");
		await seedDharmaGrant(userId);

		// Handler-entry IDs, generated ONCE, closed over (retry-purity contract).
		const eventId = uuidv7();

		const result = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async ({ tx, pool }) => {
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				await tx
					.update(pools)
					.set({
						yesReserves: buy.reserves.yes,
						noReserves: buy.reserves.no,
					})
					.where(eq(pools.id, pool.id));
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				// comment FIRST (bet_id null on disk; side_at_post_time +
				// stake_at_post_time both NOT NULL → both set — S3).
				const [comment] = await tx
					.insert(comments)
					.values({
						userId,
						marketId,
						body: "atomicity happy-path argument",
						sideAtPostTime: "YES",
						stakeAtPostTime: "10",
					})
					.returning({ id: comments.id });
				const commentId = comment?.id ?? "";
				// bet SECOND (comment_id = the comment's id).
				const [bet] = await tx
					.insert(bets)
					.values({
						userId,
						marketId,
						side: "YES",
						stake: "10",
						shareQuantity: buy.shares,
						priceAtBet: buy.pEff,
						commentId,
					})
					.returning({ id: bets.id });
				const betId = bet?.id ?? "";
				// events TERMINAL — caller-supplied UUIDv7 eventId (closed over).
				await insertEvent(tx, {
					eventId,
					eventType: "bet.placed",
					aggregateType: "market",
					aggregateId: marketId,
					payload: {
						betId,
						marketId,
						userId,
						side: "YES",
						stake: "10",
						shares: buy.shares,
						price: buy.pEff,
						commentId,
						parentCommentId: null,
					},
					metadata: META,
				});
				return { commentId, betId };
			},
		);

		// pools reserves UPDATED off the seed.
		const [poolRow] = await testDb
			.select({ yesReserves: pools.yesReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).not.toBe(SEED_RESERVES);

		// positions row present.
		const positionRows = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);

		// dharma_ledger: initial_grant + bet_stake (990).
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.length).toBe(2);
		const stakeRow = ledgerRows.find((r) => r.entryType === "bet_stake");
		expect(stakeRow?.balanceAfter).toBe("990.000000000000000000");

		// comments: present, side_at_post_time + stake_at_post_time both populated.
		const commentRows = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				stakeAtPostTime: comments.stakeAtPostTime,
				betId: comments.betId,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.sideAtPostTime).toBe("YES");
		expect(commentRows[0]?.stakeAtPostTime).toBe("10.000000000000000000");

		// bets: present, comment_id links the comment.
		const betRows = await testDb
			.select({ id: bets.id, commentId: bets.commentId })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.commentId).toBe(commentRows[0]?.id);
		expect(betRows[0]?.id).toBe(result.betId);

		// events: exactly one bet.placed for this market.
		const eventRows = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(eq(events.aggregateId, marketId));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventType).toBe("bet.placed");
	});

	it("bet-comment-atomicity::every-comment-has-a-referencing-bet-construction", async () => {
		// DEBATE.1 — the comment→bet CONSTRUCTION direction of INV-1. comments are
		// only ever inserted inside the W-1 tx, always paired with a bet whose
		// `comment_id` references the comment (the schema half — `bets.comment_id`
		// NOT NULL FK → comments.id). `comments.bet_id` stays NULL on disk (DEBATE.8/9
		// reconciliation) and is NOT relied on here. There is no comment-only write
		// path. After a committed spine, the persisted comment is referenced by a
		// bet's comment_id.
		const userId = await seedUser("atom-ctor", "atom-ctor");
		const marketId = await seedOpenMarketWithPool("atom-ctor-market");
		await seedDharmaGrant(userId);

		const eventId = uuidv7();
		await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async ({ tx, pool }) => {
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				await tx
					.update(pools)
					.set({ yesReserves: buy.reserves.yes, noReserves: buy.reserves.no })
					.where(eq(pools.id, pool.id));
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				// comment FIRST (bet_id null on disk — the construction bind is the
				// bet's comment_id FK, not comments.bet_id).
				const [comment] = await tx
					.insert(comments)
					.values({
						userId,
						marketId,
						body: "construction-direction argument",
						sideAtPostTime: "YES",
						stakeAtPostTime: "10",
					})
					.returning({ id: comments.id });
				const commentId = comment?.id ?? "";
				// bet SECOND — comment_id references the comment (NOT NULL).
				const [bet] = await tx
					.insert(bets)
					.values({
						userId,
						marketId,
						side: "YES",
						stake: "10",
						shareQuantity: buy.shares,
						priceAtBet: buy.pEff,
						commentId,
					})
					.returning({ id: bets.id });
				const betId = bet?.id ?? "";
				await insertEvent(tx, {
					eventId,
					eventType: "bet.placed",
					aggregateType: "market",
					aggregateId: marketId,
					payload: {
						betId,
						marketId,
						userId,
						side: "YES",
						stake: "10",
						shares: buy.shares,
						price: buy.pEff,
						commentId,
						parentCommentId: null,
					},
					metadata: META,
				});
				return { commentId, betId };
			},
		);

		// CONSTRUCTION assertion: every persisted comment is referenced by exactly
		// one bet's comment_id — no comment without a bet pointing at it.
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		const betRows = await testDb
			.select({ commentId: bets.commentId })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(commentRows.length).toBe(1);
		const referenced = new Set(betRows.map((r) => r.commentId));
		for (const c of commentRows) {
			expect(referenced.has(c.id)).toBe(true);
		}
	});

	it("bet-comment-atomicity::throw-before-events-rolls-back-all-tables", async () => {
		// EDGE (terminal-step abort): the callback writes the FULL spine THROUGH
		// bets, then throws BEFORE events. Same zero-rows assertion — even a
		// throw at the last hop before the terminal write unwinds everything.
		const userId = await seedUser("atom-pre-ev", "atom-pre-ev");
		const marketId = await seedOpenMarketWithPool("atom-pre-ev-market");
		await seedDharmaGrant(userId);

		await expect(
			runBetTransaction({ marketId, flow: "F-BET-1" }, async ({ tx, pool }) => {
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				await tx
					.update(pools)
					.set({
						yesReserves: buy.reserves.yes,
						noReserves: buy.reserves.no,
					})
					.where(eq(pools.id, pool.id));
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				const [comment] = await tx
					.insert(comments)
					.values({
						userId,
						marketId,
						body: "atomicity pre-events argument",
						sideAtPostTime: "YES",
						stakeAtPostTime: "10",
					})
					.returning({ id: comments.id });
				const commentId = comment?.id ?? "";
				await tx.insert(bets).values({
					userId,
					marketId,
					side: "YES",
					stake: "10",
					shareQuantity: buy.shares,
					priceAtBet: buy.pEff,
					commentId,
				});
				// THROW BEFORE events (terminal step). Plain Error → not retried.
				throw new Error("synthetic pre-events abort");
			}),
		).rejects.toThrow("synthetic pre-events abort");

		// Zero rows across the whole spine for this market (pool reserves intact).
		const [poolRow] = await testDb
			.select({ yesReserves: pools.yesReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe(SEED_RESERVES);

		const positionRows = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(0);

		const ledgerRows = await testDb
			.select({ entryType: dharmaLedger.entryType })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.some((r) => r.entryType === "bet_stake")).toBe(false);

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
		const eventRows = await testDb
			.select()
			.from(events)
			.where(eq(events.aggregateId, marketId));
		expect(eventRows.length).toBe(0);
	});
});
