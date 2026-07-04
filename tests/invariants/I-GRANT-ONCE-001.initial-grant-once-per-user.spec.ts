import { afterEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// I-GRANT-ONCE-001 canonical (MINTED by ENGINE.13, plan P1): at most ONE
// `initial_grant` ledger row per user, EVER. Two mechanisms:
//   (i)  PRIMARY — the F-AUTH-4 users-row `FOR UPDATE` lock + the tab-race
//        no-op branch in `acceptTosAction` (tos-accept.ts): the grant call
//        is unreachable twice (exercised end-to-end by
//        tests/server/auth/tos-accept-grant.test.ts T2/T3).
//   (ii) STORAGE BACKSTOP — this spec: the UNIQUE partial index
//        `dharma_ledger_initial_grant_user_uq` ON dharma_ledger (user_id)
//        WHERE entry_type = 'initial_grant' (migration 0013, plan P2). It
//        can only fire on a future logic bug — it fails LOUDLY (23505)
//        rather than ever double-granting (ENGINE.12 R3 mirror: never catch
//        23505 to "recover").
//
// Fixture-bypass posture (SPEC.2 §6.6, the I-DAILY-ONCE-001 mirror): raw
// `testClient.unsafe` INSERTs go straight past the application layer so the
// INDEX is the only enforcement under test. NO greenfield src import — this
// spec RUNS today and REDs on the missing index (the same-user duplicate
// INSERT currently succeeds, so the `rejects` assertion fails). Distinct
// `created_at` values — different UTC days, even — pin the EVER semantics:
// unlike I-DAILY-ONCE-001 the index has no day expression.
//
// DB-BACKED: cannot RED locally with Postgres :54322 down (ECONNREFUSED is
// infra, not an assertion red).

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Grant-Once User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

function insertGrantRow(
	userId: string,
	balanceAfter: string,
	createdAt: string,
) {
	return testClient.unsafe(
		`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
		 VALUES ($1, 'initial_grant', '1000', $2, $3)`,
		[userId, balanceAfter, createdAt],
	);
}

describe("I-GRANT-ONCE-001: at most one initial_grant row per user, ever", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["dharma_ledger", "users"]);
	});

	it("initial-grant-once::backstop-rejects-second-grant-same-user", async () => {
		const userId = await seedUser("grant-dup", "grant-dup");

		// First grant — allowed (the genesis row).
		await insertGrantRow(userId, "1000", "2026-06-10T04:00:00+00:00");

		// Second grant, SAME user, distinct created_at on a LATER UTC day →
		// the backstop index rejects with unique_violation. No day scoping:
		// the rule is once per user EVER.
		await expect(
			insertGrantRow(userId, "2000", "2026-09-01T12:00:00+00:00"),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "dharma_ledger_initial_grant_user_uq",
		});
	});

	it("initial-grant-once::index-is-scoped-per-user-per-entry-type", async () => {
		// Negative space: the backstop must NOT be over-broad. (Vacuously green
		// pre-index — the load-bearing RED lives in the rejection test above;
		// this guards the index's scope once it lands.)
		const userA = await seedUser("grant-a", "grant-a");
		const userB = await seedUser("grant-b", "grant-b");

		await insertGrantRow(userA, "1000", "2026-06-10T12:00:00+00:00");

		// (a) A DIFFERENT user's grant is allowed — same timestamp, even.
		await insertGrantRow(userB, "1000", "2026-06-10T12:00:00+00:00");

		// (b) The partial WHERE scopes the index to initial_grant only — a
		// daily_allowance row for the granted user is unconstrained by it.
		await testClient.unsafe(
			`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
			 VALUES ($1, 'daily_allowance', '10', '1010', '2026-06-11T09:00:00+00:00')`,
			[userA],
		);

		const rows = await testClient.unsafe(
			`SELECT entry_type FROM dharma_ledger WHERE user_id = $1`,
			[userA],
		);
		expect(rows.length).toBe(2);
	});
});
