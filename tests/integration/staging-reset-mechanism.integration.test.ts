import { describe, expect, it } from "vitest";
import { testClient } from "../db/_fixtures/db";
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
	TRUNCATE_EXCLUSIONS,
	TRUNCATE_SET,
} from "../staging/_lib/guards";
import {
	readGuardCatalog,
	runGuardedReset,
	verifyPostReset,
} from "../staging/_lib/reset";

// STAGING-PARITY Slice A §5.6 tests-first — the reset MECHANISM against LOCAL
// Postgres (:54322). Slice A's exit gate is "the reset runs green against
// local Postgres and has NOT been run against staging", so this file is where
// the disable → TRUNCATE → enable → verify loop is actually proven.
//
// It exercises runGuardedReset/verifyPostReset directly with a locally-built
// client. It does NOT go through resolveStagingTarget — that predicate refuses
// a localhost URL by construction, and proving it does is the job of
// tests/unit/staging/reset-guard.test.ts. Splitting the guard from the
// mechanism is what makes both testable; nothing here weakens the guard, and
// nothing here can reach staging (the URL comes from DATABASE_URL, which
// tests/_setup points at :54322).
//
// This file truncates the whole fixture surface, as every teardown in the repo
// already does. fileParallelism: false keeps the catalog-level trigger toggle
// race-free.

async function guardStates(): Promise<Map<string, string>> {
	const rows = await readGuardCatalog(testClient);
	return new Map(rows.map((r) => [`${r.table}.${r.trigger}`, r.enabled]));
}

async function allGuardsEnabled(): Promise<boolean> {
	const rows = await readGuardCatalog(testClient);
	return rows.length > 0 && rows.every((r) => r.enabled === "O");
}

async function migrationRowCount(): Promise<number> {
	const [row] = await testClient<{ n: number }[]>`
		SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
	`;
	return row?.n ?? 0;
}

describe("guard catalog — the shape the reset verifies against", () => {
	it("returns the full guard set, every row enabled, at rest", async () => {
		const rows = await readGuardCatalog(testClient);
		expect(rows).toHaveLength(EXPECTED_GUARD_CATALOG_ROWS);
		expect(rows.every((r) => r.enabled === "O")).toBe(true);
	});

	it("covers every pair the reset intends to disable", async () => {
		const states = await guardStates();
		for (const [table, trigger] of DISABLED_TRUNCATE_GUARDS) {
			expect(states.get(`${table}.${trigger}`)).toBe("O");
		}
	});

	it("includes system_state's truncate guard, which the reset leaves alone", async () => {
		const states = await guardStates();
		expect(states.get("system_state.bucket_b_no_truncate")).toBe("O");
	});
});

describe("runGuardedReset — the disable → truncate → enable loop", () => {
	it("empties the truncate set and leaves every guard enabled", async () => {
		await runGuardedReset(testClient, TRUNCATE_SET);

		expect(await allGuardsEnabled()).toBe(true);

		for (const table of TRUNCATE_SET) {
			const [row] = await testClient<{ n: number }[]>`
				SELECT count(*)::int AS n FROM ${testClient(table)}
			`;
			expect({ table, n: row?.n }).toEqual({ table, n: 0 });
		}
	});

	it("is re-runnable — a second pass over an already-empty DB is green", async () => {
		await runGuardedReset(testClient, TRUNCATE_SET);
		await runGuardedReset(testClient, TRUNCATE_SET);
		expect(await allGuardsEnabled()).toBe(true);
	});

	it("preserves system_state's singleton row with frozen_at NULL", async () => {
		await runGuardedReset(testClient, TRUNCATE_SET);

		const rows = await testClient<{ id: string; frozen_at: Date | null }[]>`
			SELECT id, frozen_at FROM system_state
		`;
		expect(rows).toHaveLength(1);
		expect(rows[0]?.frozen_at).toBeNull();
	});

	it("preserves drizzle.__drizzle_migrations", async () => {
		const before = await migrationRowCount();
		expect(before).toBeGreaterThan(0);

		await runGuardedReset(testClient, TRUNCATE_SET);

		expect(await migrationRowCount()).toBe(before);
	});

	it("refuses an empty truncate set rather than issuing a bare disable/enable", async () => {
		await expect(runGuardedReset(testClient, [])).rejects.toThrow();
		expect(await allGuardsEnabled()).toBe(true);
	});

	it("names no excluded table in the shipped truncate set", () => {
		// A property of the constant, asserted rather than enforced at runtime:
		// runGuardedReset deliberately has no exclusion bypass to test around,
		// because the storage layer is the enforcement (see the atomicity block).
		for (const excluded of TRUNCATE_EXCLUSIONS) {
			expect(TRUNCATE_SET).not.toContain(excluded);
		}
	});
});

describe("atomicity — a failed truncate leaves every guard ENABLED", () => {
	// ADR-0035 primitive 2: "The guards cannot be left off, because they are
	// never committed off." This is the most important assertion in the slice.
	//
	// The injected failure is real, not simulated: system_state's
	// bucket_b_no_truncate is NEVER disabled (primitive 4), so naming it in the
	// truncate list raises inside the batch — at EXECUTION time, after every
	// DISABLE has already run. A parse-time failure would prove nothing,
	// because the disables would never have executed.
	//
	// This is also the reason runGuardedReset carries no exclusion bypass: the
	// still-enabled guard is what refuses, so the refusal survives any caller.

	it("rolls the DISABLE back when the batch aborts mid-transaction", async () => {
		const before = await guardStates();
		expect([...before.values()].every((e) => e === "O")).toBe(true);

		await expect(runGuardedReset(testClient, ["system_state"])).rejects.toThrow(
			/append-only violation|TRUNCATE not permitted/i,
		);

		const after = await guardStates();
		expect(after.size).toBe(before.size);
		for (const [k, v] of after) {
			expect({ guard: k, enabled: v }).toEqual({ guard: k, enabled: "O" });
		}
	});

	it("leaves the truncate set untouched when the batch aborts", async () => {
		await testClient`
			INSERT INTO identity_pool (colour, animal, number, pseudonym, pfp_filename)
			VALUES ('Red', 'Otter', 999, 'RedOtter999', 'redotter999.webp')
			ON CONFLICT DO NOTHING
		`;
		const [seeded] = await testClient<{ n: number }[]>`
			SELECT count(*)::int AS n FROM identity_pool
		`;
		expect(seeded?.n).toBeGreaterThan(0);

		await expect(
			runGuardedReset(testClient, ["identity_pool", "system_state"]),
		).rejects.toThrow();

		const [after] = await testClient<{ n: number }[]>`
			SELECT count(*)::int AS n FROM identity_pool
		`;
		expect(after?.n).toBe(seeded?.n);
		expect(await allGuardsEnabled()).toBe(true);
	});
});

describe("verifyPostReset — G-4", () => {
	it("passes on a healthy database", async () => {
		await runGuardedReset(testClient, TRUNCATE_SET);
		await expect(verifyPostReset(testClient)).resolves.toBeUndefined();
	});

	it("fails, naming the offending rows, when a guard is left disabled", async () => {
		await testClient.unsafe(
			"ALTER TABLE bets DISABLE TRIGGER bucket_a_no_truncate",
		);
		try {
			// [\s\S] rather than the /s dotAll flag — tsconfig targets ES2017,
			// where /s is a TS1501 error.
			await expect(verifyPostReset(testClient)).rejects.toThrow(
				/bets[\s\S]*bucket_a_no_truncate/,
			);
		} finally {
			await testClient.unsafe(
				"ALTER TABLE bets ENABLE TRIGGER bucket_a_no_truncate",
			);
		}
		expect(await allGuardsEnabled()).toBe(true);
	});

	it("fails when system_state's singleton row is missing", async () => {
		// The silent fail-open ADR-0035 primitive 4 exists to catch: isFrozen()
		// reads `row?.frozenAt != null`, so a missing row reports "not frozen"
		// with nothing reporting the absence. Removing the row needs BOTH the
		// delete and truncate guards down, which is itself the proof that the
		// reset cannot reach this state.
		await testClient.unsafe(
			"ALTER TABLE system_state DISABLE TRIGGER bucket_b_no_delete",
		);
		try {
			await testClient`DELETE FROM system_state`;
			await expect(verifyPostReset(testClient)).rejects.toThrow(
				/system_state/i,
			);
		} finally {
			await testClient`
				INSERT INTO system_state (id) VALUES ('system')
				ON CONFLICT (id) DO NOTHING
			`;
			await testClient.unsafe(
				"ALTER TABLE system_state ENABLE TRIGGER bucket_b_no_delete",
			);
		}
		await expect(verifyPostReset(testClient)).resolves.toBeUndefined();
	});

	it("fails when the migrations table has been emptied", async () => {
		// __drizzle_migrations is in no guard list, so nothing at the storage
		// layer stops this — the post-run check is the only thing that notices.
		await testClient.unsafe("BEGIN");
		try {
			await testClient.unsafe("DELETE FROM drizzle.__drizzle_migrations");
			await expect(verifyPostReset(testClient)).rejects.toThrow(
				/__drizzle_migrations/,
			);
		} finally {
			await testClient.unsafe("ROLLBACK");
		}
		expect(await migrationRowCount()).toBeGreaterThan(0);
	});
});
