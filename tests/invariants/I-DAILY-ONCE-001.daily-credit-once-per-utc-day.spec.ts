import { afterEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// I-DAILY-ONCE-001 canonical (MINTED by ENGINE.12, plan P5): at most ONE
// `daily_allowance` ledger row per user per UTC calendar day. Two mechanisms:
//   (i)  PRIMARY — the SSI cursor conflict on `users.last_allowance_accrued_at`
//        inside the W-1 SERIALIZABLE tx (R3/D-N1; exercised end-to-end by
//        tests/server/bets/daily-credit.test.ts T3, THE RACE).
//   (ii) STORAGE BACKSTOP — this spec: the UNIQUE partial expression index
//        `dharma_ledger_daily_allowance_day_uq` ON
//        `(user_id, ((timezone('UTC', created_at))::date)) WHERE entry_type =
//        'daily_allowance'`. It can only fire on a future logic bug — it
//        fails LOUDLY (23505) rather than ever double-paying.
//
// Fixture-bypass posture (SPEC.2 §6.6, the I-NO-OVERDRAFT-001 precedent):
// raw `testClient.unsafe` INSERTs go straight past the application layer so
// the INDEX is the only enforcement under test. Explicit `created_at` values
// keep the same-UTC-day property deterministic (a wall-clock midnight
// crossing mid-test could otherwise legitimize two rows).
//
// RED today: the backstop index does not exist yet (lands with the ENGINE.12
// migration) — the duplicate insert SUCCEEDS and the `rejects` assertion
// fails. DB-BACKED: cannot RED locally with Postgres :54322 down
// (ECONNREFUSED is infra, not an assertion red); first true run is CI.

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Daily-Once User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

function insertCreditRow(
	userId: string,
	balanceAfter: string,
	createdAt: string,
) {
	return testClient.unsafe(
		`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
		 VALUES ($1, 'daily_allowance', '10', $2, $3)`,
		[userId, balanceAfter, createdAt],
	);
}

describe("I-DAILY-ONCE-001: one daily_allowance row per user per UTC day", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["dharma_ledger", "users"]);
	});

	it("daily-credit-once::backstop-rejects-second-same-utc-day-credit", async () => {
		const userId = await seedUser("once-dup", "once-dup");

		// First credit of the day — allowed.
		await insertCreditRow(userId, "10", "2026-06-10T04:00:00+00:00");

		// Second credit, SAME user, SAME UTC day (different time) → the
		// backstop index rejects with unique_violation.
		await expect(
			insertCreditRow(userId, "20", "2026-06-10T21:30:00+00:00"),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "dharma_ledger_daily_allowance_day_uq",
		});

		// Offset-notation timestamp that lands on the SAME UTC day
		// (2026-06-11T01:30+05:30 = 2026-06-10T20:00Z) → still rejected. Pins
		// the `timezone('UTC', created_at)` expression: the accrual key is the
		// UTC day, never a server-local-tz day.
		await expect(
			insertCreditRow(userId, "20", "2026-06-11T01:30:00+05:30"),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "dharma_ledger_daily_allowance_day_uq",
		});
	});

	it("daily-credit-once::index-is-scoped-per-user-per-day-per-type", async () => {
		// Negative space: the backstop must NOT be over-broad. (Vacuously green
		// pre-index — the load-bearing RED lives in the rejection test above;
		// this guards the index's scope once it lands.)
		const userA = await seedUser("once-a", "once-a");
		const userB = await seedUser("once-b", "once-b");

		await insertCreditRow(userA, "10", "2026-06-10T12:00:00+00:00");

		// (a) The NEXT UTC day for the same user is allowed — including the
		// midnight boundary instant.
		await insertCreditRow(userA, "20", "2026-06-11T00:00:00+00:00");

		// (b) A DIFFERENT user on the same UTC day is allowed.
		await insertCreditRow(userB, "10", "2026-06-10T12:00:00+00:00");

		// (c) The partial WHERE scopes the index to daily_allowance only —
		// other same-user same-day entry types are unconstrained.
		await testClient.unsafe(
			`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
			 VALUES ($1, 'bet_payout', '5', '15', '2026-06-10T13:00:00+00:00'),
			        ($1, 'bet_payout', '5', '20', '2026-06-10T14:00:00+00:00')`,
			[userA],
		);

		const rows = await testClient.unsafe(
			`SELECT entry_type FROM dharma_ledger WHERE user_id = $1`,
			[userA],
		);
		expect(rows.length).toBe(4);
	});
});
