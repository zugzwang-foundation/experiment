import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { dharmaLedger, users } from "@/db/schema";
import { appendLedgerRow } from "@/server/dharma/persist";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// INV-2 canonical (no-overdraft). Naming per SPEC.2 §14.2:1375 — slug
// NO-OVERDRAFT, seed 001, canonical slug dharma-ledger-monotone.
//
// DB-BACKED: cannot RED locally (PROBE-3 — local Postgres :54322 DOWN;
// ECONNREFUSED is infra, not an assertion red). First true run is CI on the
// PR, post-implementation. The greenfield value import (`appendLedgerRow`)
// keeps this from resolving until ENGINE.5 lands.
//
// Two mechanisms, both load-bearing for INV-2:
//   (i)  the application-layer guarantee: balance_after ≥ 0 holds across a
//        write sequence driven by appendLedgerRow (DharmaOverdraftError is the
//        advisory mirror; SPEC.2 §14.1 mech iii→iv).
//   (ii) the storage-layer ground truth: a FORCED-negative raw insert
//        (bypassing the app layer via testClient.unsafe) is rejected by the
//        CHECK `dharma_ledger_balance_non_negative` — Postgres 23514. This is
//        the per-row INV-2 storage floor (0001:157, the lone storage CHECK).
//
// Concurrent-bet composition (I-NO-OVERDRAFT-002, single-user concurrent
// stakes) is DEFERRED to ENGINE.7 (§14.2:1380) — out of ENGINE.5 scope.

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Overdraft User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

describe("I-NO-OVERDRAFT-001: dharma_ledger balance_after ≥ 0", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["dharma_ledger", "users"]);
	});

	it("dharma-no-overdraft::balance-stays-non-negative-across-sequence", async () => {
		const userId = await seedUser("od-seq", "od-seq");

		const grant = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "100",
				entryType: "initial_grant",
			}),
		);
		expect(grant.balanceAfter).toBe("100.000000000000000000");

		const drain = await testDb.transaction((tx) =>
			appendLedgerRow(tx, {
				userId,
				amount: "-100",
				entryType: "bet_stake",
			}),
		);
		// Drained exactly to the floor — allowed, still ≥ 0.
		expect(drain.balanceAfter).toBe("0.000000000000000000");

		// Every persisted balance_after is ≥ 0.
		const rows = await testDb
			.select({ balanceAfter: dharmaLedger.balanceAfter })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(rows.length).toBe(2);
		for (const r of rows) {
			// String sign check — exact, float-free (CLAUDE.md §2); also rejects
			// a non-canonical "-0…" that Number(x) >= 0 would accept.
			expect(r.balanceAfter.startsWith("-")).toBe(false);
		}
	});

	it("dharma-no-overdraft::storage-CHECK-rejects-forced-negative", async () => {
		const userId = await seedUser("od-check", "od-check");

		// Bypass the app layer entirely (testClient.unsafe) and force a negative
		// balance_after — the storage CHECK is the only enforcement under test
		// here (SPEC.2 §6.6 fixture-bypass posture).
		await expect(
			testClient.unsafe(
				`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after)
				 VALUES ($1, 'bet_stake', '-1', '-1')`,
				[userId],
			),
		).rejects.toMatchObject({
			code: "23514",
			constraint_name: "dharma_ledger_balance_non_negative",
		});
	});
});
