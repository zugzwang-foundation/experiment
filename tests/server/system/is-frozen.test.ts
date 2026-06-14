import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { testClient } from "../../db/_fixtures/db";

// ENGINE.16 §5.6 tests-first (charter "helper" row) — the §20.2 conclusion-
// freeze read-guard `isFrozen()`. The helper is GREENFIELD
// (`src/server/system/is-frozen.ts` does NOT exist until S2), so it is imported
// via a DYNAMIC import INSIDE each test body — never a top-level static import.
// That keeps the missing module a RUNTIME failure (RED), not a collection-time
// module-resolution error: every test below COLLECTS cleanly and fails on the
// `await import(...)` throw until S2 lands.
//
// DB-BACKED (local Postgres :54322). The helper reads the singleton
// system_state ('system') row through the production `db` connection; this file
// drives the seed/freeze flip through the raw test client so the cross-
// connection visibility (the real flag the helper reads) is what is asserted.
//
// FIX-1 reset (the §6.3 once-only trigger): the Bucket-B trigger rejects BOTH
// `frozen_at timestamp→NULL` (un-freeze) AND `timestamp→timestamp` (re-fire)
// — so a freeze test can NEVER reset via `UPDATE … SET frozen_at = NULL`. The
// triggers are BEFORE UPDATE + BEFORE DELETE only (no BEFORE TRUNCATE), so the
// reset is `TRUNCATE system_state; INSERT … ('system', NULL)` in afterEach.

const HELPER_PATH = fileURLToPath(
	new URL("../../../src/server/system/is-frozen.ts", import.meta.url),
);

async function resetSystemState(): Promise<void> {
	// FIX-1: TRUNCATE bypasses the UPDATE/DELETE once-only trigger; the reseed
	// restores the pre-freeze singleton ('system', frozen_at NULL).
	await testClient.unsafe(`TRUNCATE system_state`);
	await testClient.unsafe(
		`INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)`,
	);
}

describe("ENGINE.16 — isFrozen() conclusion-freeze read-guard (§20.2)", () => {
	afterEach(async () => {
		await resetSystemState();
	});

	it("freeze-guard::reports-false-pre-freeze (frozen_at NULL)", async () => {
		// The seeded singleton row has frozen_at NULL → the freeze has not fired.
		const { isFrozen } = await import("@/server/system/is-frozen");
		await expect(isFrozen()).resolves.toBe(false);
	});

	it("freeze-guard::reports-true-after-frozen_at-set (NULL→timestamp)", async () => {
		// A single committed NULL→timestamp UPDATE on the live 'system' row — the
		// one transition the once-only trigger permits — is visible cross-
		// connection to the production `db` the helper reads.
		await testClient.unsafe(
			`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`,
		);

		const { isFrozen } = await import("@/server/system/is-frozen");
		await expect(isFrozen()).resolves.toBe(true);
	});

	it("freeze-guard::query-is-non-locking (no FOR-UPDATE clause; §20.4 lock-order)", async () => {
		// system_state MUST NOT enter the W-1/W-3/W-4 lock order (markets → pools
		// → positions → dharma_ledger → events). The helper is a PLAIN, non-
		// locking SELECT — never `.for(...)`. Structural guard: the helper source
		// carries no lock clause (`.for(`) and no raw `FOR UPDATE`/`FOR NO KEY
		// UPDATE`/`FOR SHARE`. Reading the source as TEXT (not importing) keeps
		// this assertion independent of the runtime IO.
		const source = readFileSync(HELPER_PATH, "utf8");
		expect(source).not.toMatch(/\.for\s*\(/);
		expect(source).not.toMatch(/FOR\s+(NO\s+KEY\s+)?UPDATE/i);
		expect(source).not.toMatch(/FOR\s+SHARE/i);
	});
});
