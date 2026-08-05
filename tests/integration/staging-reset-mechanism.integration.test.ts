import { describe, expect, it } from "vitest";
import { testClient } from "../db/_fixtures/db";
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
	NOT_TRUNCATED_UNRATIFIED,
	TRUNCATE_EXCLUSIONS,
	TRUNCATE_SET,
} from "../staging/_lib/guards";
import {
	countMigrations,
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
//
// ── WHY THIS FILE CARRIES ITS OWN TARGET REFUSAL ────────────────────────────
// It runs under the DEFAULT config, so `pnpm vitest run`, `pnpm
// test:integration`, CI and any subagent collect it — and it connects through
// `testClient`, which reads ambient DATABASE_URL with no target check. It then
// performs, unguarded, exactly what ADR-0035's four guards exist to gate: the
// full 21-relation wipe, and (in the G-4 negative cases) a disabled
// _no_delete guard over a deleted freeze sentinel.
//
// The attack needs no attacker. Through Slices B–D the operator lives in
// `doppler run --project zugzwang-experiment --config stg -- …` shells, where
// DATABASE_URL IS staging and `tests/_setup/env.ts` only `??=`-defaults it, so
// the ambient value wins. One `doppler run --config stg -- pnpm vitest run`
// while debugging a staging runner would wipe staging with zero guards, no
// pre-flight, no G-4 and no production refusal. "The guard exists in the file
// next door" is not a control. @security-auditor, Slice A.
const DB_URL = process.env.DATABASE_URL ?? "";
const DB_HOST = (() => {
	try {
		return new URL(DB_URL).hostname.toLowerCase();
	} catch {
		return "";
	}
})();
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "db"]);

if (!LOOPBACK.has(DB_HOST)) {
	throw new Error(
		`REFUSED — staging-reset-mechanism runs its wipe against DATABASE_URL, which must be a LOCAL Postgres. ` +
			`Saw host "${DB_HOST || "(unparseable)"}". This suite is destructive and carries none of ADR-0035's four guards.`,
	);
}

async function guardStates(): Promise<Map<string, string>> {
	const rows = await readGuardCatalog(testClient);
	return new Map(rows.map((r) => [`${r.table}.${r.trigger}`, r.enabled]));
}

async function allGuardsEnabled(): Promise<boolean> {
	const rows = await readGuardCatalog(testClient);
	return rows.length > 0 && rows.every((r) => r.enabled === "O");
}

async function migrationRowCount(): Promise<number> {
	return countMigrations(testClient);
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

	it("sets a transaction-scoped lock_timeout that does not leak (ruling 2)", async () => {
		// SET LOCAL is transaction-scoped, so it must revert when the implicit
		// transaction ends. That matters on the Supabase session pooler, where
		// the connection is REUSED — a leaked lock_timeout would silently apply
		// to every later query on that session.
		const [before] = await testClient<{ v: string }[]>`
			SELECT current_setting('lock_timeout') AS v
		`;

		await runGuardedReset(testClient, TRUNCATE_SET);

		const [after] = await testClient<{ v: string }[]>`
			SELECT current_setting('lock_timeout') AS v
		`;
		expect(after?.v).toBe(before?.v);
	});

	it("bounds lock WAIT, not execution — no statement_timeout is set", async () => {
		// Deliberate: a legitimate TRUNCATE ... CASCADE over 21 relations has no
		// principled upper bound, so capping EXECUTION would abort correct work.
		// Lock wait is the contended resource; execution is not.
		const [before] = await testClient<{ v: string }[]>`
			SELECT current_setting('statement_timeout') AS v
		`;
		await runGuardedReset(testClient, TRUNCATE_SET);
		const [after] = await testClient<{ v: string }[]>`
			SELECT current_setting('statement_timeout') AS v
		`;
		expect(after?.v).toBe(before?.v);
	});

	it("names no excluded table in the shipped truncate set", () => {
		// A property of the constant, asserted rather than enforced at runtime:
		// runGuardedReset deliberately has no exclusion bypass to test around,
		// because the storage layer is the enforcement (see the atomicity block).
		for (const excluded of TRUNCATE_EXCLUSIONS) {
			expect(TRUNCATE_SET).not.toContain(excluded);
		}
	});

	it("accounts for every public base table — truncated, excluded, or recorded", async () => {
		// A table that is in none of the three lists is FORGOTTEN, not
		// deliberate. This turns "we listed 21 tables" into "we know where all
		// 25 went", so a future migration adding a table fails here rather than
		// silently surviving every reset.
		const rows = await testClient<{ tablename: string }[]>`
			SELECT tablename FROM pg_tables
			WHERE schemaname = 'public' AND tablename NOT LIKE 'events\\_%'
			ORDER BY tablename
		`;
		const accounted = new Set([
			...TRUNCATE_SET,
			...TRUNCATE_EXCLUSIONS,
			...NOT_TRUNCATED_UNRATIFIED,
		]);
		const unaccounted = rows
			.map((r) => r.tablename)
			.filter((t) => !accounted.has(t));
		expect(unaccounted).toEqual([]);
	});

	it("confirms the unratified survivors are unreachable by CASCADE", async () => {
		// They survive structurally, not merely by absence from a list: a table
		// with an outbound FK into the truncate set would be emptied by CASCADE
		// regardless of what any constant says.
		const rows = await testClient<{ n: number }[]>`
			SELECT count(*)::int AS n
			FROM pg_constraint
			WHERE contype = 'f'
			  AND conrelid::regclass::text = ANY(${testClient.array([
					...NOT_TRUNCATED_UNRATIFIED,
					...TRUNCATE_EXCLUSIONS,
				])})
		`;
		expect(rows[0]?.n).toBe(0);
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

	// The three negative cases below each need a guard temporarily off, which is
	// the one shape ADR-0035 primitive 3 forbids for the reset itself. They run
	// inside an explicit BEGIN/ROLLBACK on the `max: 1` pinned client, so the
	// DISABLE is transactional DDL that is never committed — the same property
	// the reset relies on. A sequential disable → mutate → re-enable would leave
	// a window where a throw or a process kill strands a guard OFF in the local
	// database; @code-reviewer flagged exactly that at Slice A.

	it("fails, naming the offending rows, when a guard is left disabled", async () => {
		await testClient.unsafe("BEGIN");
		try {
			await testClient.unsafe(
				"ALTER TABLE bets DISABLE TRIGGER bucket_a_no_truncate",
			);
			// [\s\S] rather than the /s dotAll flag — tsconfig targets ES2017,
			// where /s is a TS1501 error.
			await expect(verifyPostReset(testClient)).rejects.toThrow(
				/bets[\s\S]*bucket_a_no_truncate/,
			);
		} finally {
			await testClient.unsafe("ROLLBACK");
		}
		expect(await allGuardsEnabled()).toBe(true);
	});

	it("fails when system_state's singleton row is missing", async () => {
		// The silent fail-open ADR-0035 primitive 4 exists to catch: isFrozen()
		// reads `row?.frozenAt != null`, so a missing row reports "not frozen"
		// with nothing reporting the absence. Removing the row needs the delete
		// guard down, which is itself the proof that the reset cannot reach
		// this state — the reset never disables a _no_delete guard.
		await testClient.unsafe("BEGIN");
		try {
			await testClient.unsafe(
				"ALTER TABLE system_state DISABLE TRIGGER bucket_b_no_delete",
			);
			await testClient`DELETE FROM system_state`;
			await expect(verifyPostReset(testClient)).rejects.toThrow(
				/system_state/i,
			);
		} finally {
			await testClient.unsafe("ROLLBACK");
		}
		await expect(verifyPostReset(testClient)).resolves.toBeUndefined();
		expect(await allGuardsEnabled()).toBe(true);
	});

	it("fails when the migrations ledger has been emptied", async () => {
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

	it("fails when the ledger loses SOME rows, not just all of them", async () => {
		// ADR-0035 G-4 requires the ledger to RETAIN its row count. A bare
		// non-empty check passes a partial deletion, which is the realistic
		// corruption — @code-reviewer flagged the weaker form at Slice A.
		const before = await migrationRowCount();
		expect(before).toBeGreaterThan(1);

		await testClient.unsafe("BEGIN");
		try {
			await testClient.unsafe(
				"DELETE FROM drizzle.__drizzle_migrations WHERE id IN (SELECT id FROM drizzle.__drizzle_migrations LIMIT 1)",
			);
			// Non-empty, so the old check would have passed.
			expect(await migrationRowCount()).toBe(before - 1);
			await expect(verifyPostReset(testClient, before)).rejects.toThrow(
				/__drizzle_migrations/,
			);
		} finally {
			await testClient.unsafe("ROLLBACK");
		}
		expect(await migrationRowCount()).toBe(before);
	});

	it("passes when the baseline matches", async () => {
		const before = await migrationRowCount();
		await runGuardedReset(testClient, TRUNCATE_SET);
		await expect(verifyPostReset(testClient, before)).resolves.toBeUndefined();
	});
});
