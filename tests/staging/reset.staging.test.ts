import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
	EXPECTED_GUARD_CATALOG_ROWS,
	resolveStagingTarget,
	TRUNCATE_EXCLUSIONS,
	TRUNCATE_SET,
} from "./_lib/guards";
import {
	assertLiveConnection,
	describeTarget,
	readGuardCatalog,
	reEnableGuards,
	runGuardedReset,
	verifyPostReset,
} from "./_lib/reset";

// ═══════════════════════════════════════════════════════════════════════════
// THE GUARDED STAGING RESET — STAGING-PARITY Slice A
//
// ADR-0035 (guarded staging reset) + ADR-0036 (Vitest-context operational
// runners). READ BOTH BEFORE CHANGING ANYTHING IN THIS FILE.
//
// THIS IS NOT A TEST. It is an operational artifact that borrows the Vitest
// harness for module resolution (ADR-0036 primitive 1). Running it DESTROYS
// every row in the staging fixture surface. It is named, located and
// configured so that distinction is visible:
//
//   - it lives under tests/staging/, which vitest.config.ts EXCLUDES, so no
//     bare `vitest run` — local, CI, or a subagent's — can reach it;
//   - it runs only through vitest.staging.config.ts;
//   - it refuses to run at all unless four guards pass.
//
// Invocation:  pnpm staging:reset
//   (which is `doppler run --project zugzwang-experiment --config stg -- …`,
//    then re-seeds identity_pool — see package.json)
//
// THE GUARD CONTRACT (ADR-0035 primitive 6, hardened by Ratification Record
// §5 W-B):
//   G-1 target      — DATABASE_URL_STAGING set AND containing
//                     STAGING_PROJECT_REF_FRAGMENT AND not the production ref.
//                     Fails closed on absence. NEVER falls back to DATABASE_URL.
//   G-2 environment — ZUGZWANG_ENV must EQUAL "staging". Positive match.
//   G-3 connection  — current_database() and the ref fragment asserted from
//                     the SOCKET, not from config.
//   G-4 post-run    — every bucket_% guard back at tgenabled='O';
//                     system_state's singleton row present with frozen_at
//                     NULL; drizzle.__drizzle_migrations non-empty.
//
// NEVER DISABLED: bucket_a_no_update · bucket_a_no_delete · bucket_b_no_delete
// · bucket_b_update_check. Only the *_no_truncate guards, only for the one
// transaction. The reset removes rows wholesale; it never acquires the ability
// to edit one.
//
// NEVER TRUNCATED: drizzle.__drizzle_migrations · system_state.
// ═══════════════════════════════════════════════════════════════════════════

const target = resolveStagingTarget(process.env);

if (!target.ok) {
	// Fail closed, loudly, before a client is ever constructed. Throwing at
	// module scope makes the whole file fail collection — there is no path
	// from here to a connection.
	throw new Error(
		`REFUSED — the staging reset guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm staging:reset",
	);
}

const client = postgres(target.url, { max: 1, prepare: false });

afterAll(async () => {
	await client.end({ timeout: 10 });
});

describe("guarded staging reset", () => {
	it("G-3 · the live connection is the staging database", async () => {
		const live = await assertLiveConnection(client, target.fragment);
		console.log(
			`[staging:reset] target ${describeTarget(target.url)} · db=${live.database} · user=${live.user}`,
		);
		expect(live.database).toBeTruthy();
	});

	it("every guard is enabled before we start", async () => {
		// If a previous run left a guard off, that is the news — surface it
		// here rather than discovering it in G-4 after a destructive batch.
		const catalog = await readGuardCatalog(client);
		const off = catalog.filter((r) => r.enabled !== "O");
		expect(off).toEqual([]);
		expect(catalog).toHaveLength(EXPECTED_GUARD_CATALOG_ROWS);
	});

	it("the truncate set names no excluded table", () => {
		for (const excluded of TRUNCATE_EXCLUSIONS) {
			expect(TRUNCATE_SET).not.toContain(excluded);
		}
	});

	it("truncates the fixture surface in one transaction", async () => {
		try {
			await runGuardedReset(client, TRUNCATE_SET);
		} finally {
			// BELT — the weaker mechanism, retained and demoted (ADR-0035
			// primitive 2). It does not run on SIGKILL, OOM, or a dropped
			// socket; the single-transaction batch is what covers those,
			// because the DISABLE is never committed. G-4 below is what
			// notices if both ever fail.
			await reEnableGuards(client).catch((err) => {
				console.error("[staging:reset] belt re-enable failed:", err);
			});
		}

		for (const table of TRUNCATE_SET) {
			const [row] = await client<{ n: number }[]>`
				SELECT count(*)::int AS n FROM ${client(table)}
			`;
			expect({ table, rows: row?.n }).toEqual({ table, rows: 0 });
		}
	});

	it("G-4 · post-run verification", async () => {
		await verifyPostReset(client);
	});

	it("reports what the operator must do next", async () => {
		// identity_pool was truncated and MUST be re-seeded before anything
		// consumes a tuple (ADR-0035 primitive 5). `pnpm staging:reset` chains
		// db:seed:staging immediately after this file, so the operator only
		// sees this if they ran the config directly.
		const [pool] = await client<{ n: number }[]>`
			SELECT count(*)::int AS n FROM identity_pool
		`;
		expect(pool?.n).toBe(0);
		console.log(
			"[staging:reset] done. identity_pool is EMPTY — re-seed before generating:\n" +
				"  doppler run --project zugzwang-experiment --config stg -- pnpm db:seed:staging",
		);
	});
});
