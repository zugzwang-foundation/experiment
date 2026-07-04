import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

// DEBATE.7 §10 — `moderation::reactive-remove-ban-positions-ride`. FOUNDATION
// ONLY (the explicit scope fence): DEBATE.7 lays the DATA the reactive admin
// dashboard later reads — it does NOT build the Remove/Ban action handlers or a
// behavioural test for them (that is the dashboard stratum). This test asserts:
//   - the `mod_reason` pgEnum carries `content_removed` + `user_banned` (the two
//     reactive-admin values, forward-compat per §4 so the dashboard needs no
//     further migration);
//   - the schema SUPPORTS an admin-action `mod_actions` row: `verdict` NULL
//     (no gate verdict for a reactive admin action), `actor_id` =
//     'admin-singleton';
//   - inserting such a row leaves positions + dharma_ledger UNTOUCHED (INV-2 —
//     "ban removes voice, not balance; positions ride to resolution").
//
// FAILING-FIRST (DEBATE.7 — schema lands at implement): RED because
//   - the `mod_reason` pgEnum + `mod_actions.reason` column do NOT exist (the
//     raw INSERT of a `reason = 'user_banned'` row + the enumlabel query fail);
//   - `verdict` is currently `NOT NULL` (the migration relaxes it) — a NULL
//     `verdict` INSERT violates the NOT NULL constraint on the pre-migration
//     schema; the schema does NOT yet support an admin-action row shape.
//
// Fixture-bypass raw inserts (the mod-actions-append-only.spec.ts pattern) — no
// app-layer writer is exercised (there is none for reactive admin rows yet). NO
// Remove/Ban handler is imported or built here.

import {
	dharmaLedger,
	markets,
	modActions,
	positions,
	users,
} from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const ADMIN_ACTION_REASONS = ["content_removed", "user_banned"] as const;

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "DEBATE.7 Reactive-Foundation User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "DEBATE.7 Reactive-Foundation Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

describe("DEBATE.7 moderation::reactive-remove-ban-positions-ride (foundation)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"dharma_ledger",
			"positions",
			"markets",
			"users",
		]);
	});

	it("reactive-foundation::mod-reason-enum-carries-content-removed-and-user-banned", async () => {
		// The mod_reason pgEnum must carry BOTH reactive-admin values (forward-compat
		// per §4). Read the labels straight from pg_catalog (fixture-bypass).
		const rows = await testClient.unsafe<{ enumlabel: string }[]>(
			`SELECT e.enumlabel
			   FROM pg_enum e
			   JOIN pg_type t ON t.oid = e.enumtypid
			  WHERE t.typname = 'mod_reason'`,
		);
		const labels = rows.map((r) => r.enumlabel);
		for (const value of ADMIN_ACTION_REASONS) {
			expect(labels).toContain(value);
		}
		// And the three GATE reasons too (the full 5-value set, ADR-0021 §78 ∪ §84).
		expect(labels).toContain("track_a_autoban");
		expect(labels).toContain("track_b_blocked");
		expect(labels).toContain("sexual_minors_text_blocked");
	});

	it("reactive-foundation::admin-action-row-verdict-null-actor-singleton-positions-ride", async () => {
		// A user with a clean held position + a clean ledger — the state a reactive
		// admin Remove/Ban must NOT disturb (INV-2).
		const userId = await seedUser("reactive-fnd", "reactive-fnd");
		const marketId = await seedMarket("reactive-fnd-market");
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "7.000000000000000000",
		});
		await testDb.insert(dharmaLedger).values({
			userId,
			entryType: "initial_grant",
			amount: "0",
			balanceAfter: "500",
		});

		const positionsBefore = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.userId, userId));
		const ledgerBefore = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));

		// The schema must SUPPORT a reactive admin-action row: verdict NULL, actor
		// 'admin-singleton', reason 'user_banned'. Raw INSERT (fixture-bypass) — no
		// app-layer writer exists yet (that is the dashboard stratum).
		await testClient.unsafe(
			`INSERT INTO mod_actions (reason, verdict, categories, actor_id, target_user_id)
			 VALUES ('user_banned', NULL, '{}'::jsonb, 'admin-singleton', $1)`,
			[userId],
		);

		const [action] = await testDb
			.select({
				reason: modActions.reason,
				verdict: modActions.verdict,
				actorId: modActions.actorId,
				targetUserId: modActions.targetUserId,
			})
			.from(modActions);
		expect(action?.reason).toBe("user_banned");
		expect(action?.verdict).toBeNull();
		expect(action?.actorId).toBe("admin-singleton");
		expect(action?.targetUserId).toBe(userId);

		// INV-2: positions + dharma_ledger UNTOUCHED by the admin-action row.
		const positionsAfter = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.userId, userId));
		expect(positionsAfter.length).toBe(positionsBefore.length);
		expect(positionsAfter[0]?.quantity).toBe(positionsBefore[0]?.quantity);
		const ledgerAfter = await testDb
			.select({ id: dharmaLedger.id, balanceAfter: dharmaLedger.balanceAfter })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerAfter.length).toBe(ledgerBefore.length);
		// No clawback row appended — balance unchanged.
		expect(
			await testDb
				.select({ c: sql<number>`count(*)::int` })
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userId)),
		).toEqual([{ c: ledgerBefore.length }]);
	});
});
