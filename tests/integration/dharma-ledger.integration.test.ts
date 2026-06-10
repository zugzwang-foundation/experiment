import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { bets, comments, dharmaLedger, markets, users } from "@/db/schema";
import { checkMarketConservation } from "@/server/dharma/conservation";
import { appendLedgerRow } from "@/server/dharma/persist";
import { testClient, testDb } from "../db/_fixtures/db";

// ENGINE.5 §5.6 tests-first — INV-2 persistence (running-total guarantee +
// conservation reconciliation). DB-BACKED: cannot RED locally (PROBE-3 —
// local Postgres :54322 DOWN; ECONNREFUSED is infra, not an assertion red).
// First true run is CI on the PR. Written type-correct + behaviorally complete
// so CI is green. The greenfield value imports (`appendLedgerRow`,
// `checkMarketConservation`) keep this from resolving until ENGINE.5 lands.
//
// `appendLedgerRow(tx, …)` is exercised through real `testDb.transaction`:
//   (a) first-row grant: no previousBalance → reads latest "0…0" → balanceAfter
//       = amount; the persisted row is read back.
//   (b) running total across a SEQUENCE of single appends in SEPARATE txns.
//   (c) multi-row-same-user in ONE tx via explicit previousBalance chaining
//       (the ENGINE.9 reverse+uncollectable shape — created_at ties inside one
//       tx, so the auto-read would mis-order; chaining is the contract, A3).
//   (d) DB-backed conservation reconciliation: insert bet-tied flow rows,
//       gather them, assert checkMarketConservation { ok: true }.

// Mirrors the I-APPEND-ONLY-001 FK-ancestor shapes. comments.bet_id is
// nullable (built reality, AGENTS.md specs-ahead) → comment inserted first with
// bet_id NULL, then the bet with comment_id = comment.id (bets.comment_id NOT
// NULL — the built half of INV-1). comments.stake_at_post_time is the
// vestigial NOT NULL column still on disk.
async function seedBetChain(args: {
	emailTag: string;
	pseudonym: string;
	slug: string;
}): Promise<{ userId: string; marketId: string; betId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Ledger User",
			email: `${args.emailTag}@example.com`,
			pseudonym: args.pseudonym,
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";

	const [market] = await testDb
		.insert(markets)
		.values({
			slug: args.slug,
			title: "Ledger Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";

	const [comment] = await testDb
		.insert(comments)
		.values({
			userId,
			marketId,
			body: "ledger",
			sideAtPostTime: "YES",
			stakeAtPostTime: "10",
		})
		.returning({ id: comments.id });

	const [bet] = await testDb
		.insert(bets)
		.values({
			userId,
			marketId,
			side: "YES",
			stake: "10",
			shareQuantity: "10",
			priceAtBet: "0.5",
			commentId: comment?.id ?? "",
		})
		.returning({ id: bets.id });

	return { userId, marketId, betId: bet?.id ?? "" };
}

async function seedUser(args: {
	emailTag: string;
	pseudonym: string;
}): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Ledger User",
			email: `${args.emailTag}@example.com`,
			pseudonym: args.pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

describe("INV-2: dharma_ledger persistence (appendLedgerRow)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE dharma_ledger, bets, comments, markets, users CASCADE`,
		);
	});

	it("dharma-ledger-persist::first-row-grant", async () => {
		const userId = await seedUser({
			emailTag: "persist-grant",
			pseudonym: "persist-grant",
		});

		const result = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "100",
				entryType: "initial_grant",
			}),
		);

		// No previous row → previousBalance reads "0…0" → balanceAfter = amount.
		expect(result.balanceAfter).toBe("100.000000000000000000");

		const rows = await testDb
			.select()
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(rows.length).toBe(1);
		expect(rows[0]?.entryType).toBe("initial_grant");
		expect(rows[0]?.balanceAfter).toBe("100.000000000000000000");
		expect(rows[0]?.amount).toBe("100.000000000000000000");
	});

	it("dharma-ledger-persist::running-total-across-separate-txns", async () => {
		const userId = await seedUser({
			emailTag: "persist-seq",
			pseudonym: "persist-seq",
		});

		const grant = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "100",
				entryType: "initial_grant",
			}),
		);
		expect(grant.balanceAfter).toBe("100.000000000000000000");

		// core is value-agnostic (D-4); per-tag sign policy is producer-owned
		// (A9 considered-and-declined); ENGINE.12 will only ever write positive
		// allowances; the negative here solely exercises downward running-total
		// arithmetic without bet fixtures.
		const debit = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "-10",
				entryType: "daily_allowance",
			}),
		);
		expect(debit.balanceAfter).toBe("90.000000000000000000");

		// bet_payout (not a second daily_allowance): I-DAILY-ONCE-001's backstop
		// index (ENGINE.12, 0012) permits at most ONE daily_allowance row per
		// user per UTC day — the running-total intent is tag-agnostic.
		const credit = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "25",
				entryType: "bet_payout",
			}),
		);
		expect(credit.balanceAfter).toBe("115.000000000000000000");

		// Latest row (read by the next append) is the final running total.
		const rows = await testDb
			.select()
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(rows.length).toBe(3);
		const balances = rows.map((r) => r.balanceAfter).sort();
		expect(balances).toEqual(
			[
				"100.000000000000000000",
				"115.000000000000000000",
				"90.000000000000000000",
			].sort(),
		);
	});

	it("dharma-ledger-persist::multi-row-same-user-one-tx-chains-previousBalance", async () => {
		// ENGINE.9 reverse+uncollectable shape: two appends in ONE tx. now() is
		// tx-frozen → created_at ties → the auto-read latest would mis-order, so
		// the second call MUST pass the first's returned balanceAfter as
		// previousBalance (the A3 chaining contract).
		const { userId, betId } = await seedBetChain({
			emailTag: "persist-chain",
			pseudonym: "persist-chain",
			slug: "persist-chain-market",
		});

		// Seed a balance the reverse can draw against (separate prior tx).
		await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "100",
				entryType: "initial_grant",
			}),
		);

		const { reverse, uncollectable } = await testDb.transaction(async (tx) => {
			const reverse = await appendLedgerRow(tx, {
				userId,
				betId,
				amount: "-5",
				entryType: "correction_reverse",
			});
			// Chain: the second row uses the first row's balanceAfter — NOT a
			// fresh latest-read (which would tie on created_at).
			const uncollectable = await appendLedgerRow(tx, {
				userId,
				betId,
				amount: "-20",
				entryType: "uncollectable",
				previousBalance: reverse.balanceAfter,
			});
			return { reverse, uncollectable };
		});

		expect(reverse.balanceAfter).toBe("95.000000000000000000");
		// uncollectable special case: balanceAfter = previousBalance (unchanged).
		expect(uncollectable.balanceAfter).toBe("95.000000000000000000");

		const rows = await testDb
			.select()
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(rows.length).toBe(3);
	});

	it("dharma-ledger-persist::conservation-reconciliation-ok", async () => {
		// Insert a small set of bet-tied flow rows, gather them, and assert the
		// conservation checker balances against a matching netAdminPoolInjection.
		const { userId, betId } = await seedBetChain({
			emailTag: "persist-cons",
			pseudonym: "persist-cons",
			slug: "persist-cons-market",
		});

		// Grant first so the stake does not overdraw.
		await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "100",
				entryType: "initial_grant",
			}),
		);
		await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				betId,
				amount: "-10",
				entryType: "bet_stake",
			}),
		);
		await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				betId,
				amount: "25",
				entryType: "bet_payout",
			}),
		);

		// Gather the bet-tied flow rows (the gathering query the checker consumes).
		const flowRows = await testDb
			.select({
				amount: dharmaLedger.amount,
				entryType: dharmaLedger.entryType,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.betId, betId));

		// Σ(flow tags) = (-10) + 25 = 15 == injection 15.
		expect(
			checkMarketConservation({
				ledgerFlows: flowRows,
				netAdminPoolInjection: "15",
			}),
		).toEqual({ ok: true });
	});
});
