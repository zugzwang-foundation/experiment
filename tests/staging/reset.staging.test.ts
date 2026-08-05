import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	EXPECTED_GUARD_CATALOG_ROWS,
	resolveStagingTarget,
	TRUNCATE_EXCLUSIONS,
	TRUNCATE_SET,
} from "./_lib/guards";
import {
	assertLiveConnection,
	countMigrations,
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
// ── WHY THE GUARDS ARE NOT `it()` BLOCKS ────────────────────────────────────
// Vitest does not stop a file when a test fails, and no `bail` is set. A guard
// written as an `it()` would therefore REFUSE and then be followed by the
// destructive step anyway — the runner would report the refusal and wipe the
// database in the same run. G-1/G-2 evaluate at MODULE SCOPE (before a client
// exists) and G-3 plus the pre-flight run in `beforeAll`, because a throwing
// `beforeAll` fails every test in the suite WITHOUT executing any of them.
// The destructive batch and its G-4 verification are ONE `it`, so no ordering
// change can separate the wipe from the check that follows it.
// Caught by @code-reviewer at Slice A; the gating property is itself asserted
// by tests/unit/staging/runner-gating.test.ts.
//
// THE GUARD CONTRACT (ADR-0035 primitive 6, hardened by Ratification Record
// §5 W-B):
//   G-1 target      — DATABASE_URL_STAGING set AND containing
//                     STAGING_PROJECT_REF_FRAGMENT AND not the production ref.
//                     Fails closed on absence. NEVER falls back to DATABASE_URL.
//   G-2 environment — ZUGZWANG_ENV must EQUAL "staging". Positive match.
//   G-3 connection  — the fragment matched against the DRIVER-RESOLVED
//                     `user@host` (the session pooler carries the ref in the
//                     USERNAME, not the host), plus current_database().
//   G-4 post-run    — every bucket_% guard back at tgenabled='O';
//                     system_state's singleton row present with frozen_at
//                     NULL; drizzle.__drizzle_migrations RETAINS its row count.
//
// NEVER DISABLED: bucket_a_no_update · bucket_a_no_delete · bucket_b_no_delete
// · bucket_b_update_check. Only the *_no_truncate guards, only for the one
// transaction. The reset removes rows wholesale; it never acquires the ability
// to edit one.
//
// NEVER TRUNCATED: drizzle.__drizzle_migrations · system_state.
// ═══════════════════════════════════════════════════════════════════════════

// G-1 + G-2 — at module scope, before any client exists. A failure here throws
// during collection: there is no path from here to a connection.
const target = resolveStagingTarget(process.env);

if (!target.ok) {
	throw new Error(
		`REFUSED — the staging reset guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm staging:reset",
	);
}

const client = postgres(target.url, { max: 1, prepare: false });

/** Captured pre-batch so G-4 can prove the ledger RETAINED its rows. */
let migrationsBefore = 0;

beforeAll(async () => {
	// G-3 — the live connection. Throwing here aborts the suite without
	// running a single test, so the destructive step below is unreachable.
	const live = await assertLiveConnection(client, target.fragment);

	// Pre-flight — if a previous run left a guard off, that is the news.
	// Surface it BEFORE a destructive batch, not after it in G-4.
	const catalog = await readGuardCatalog(client);
	const off = catalog.filter((r) => r.enabled !== "O");
	if (off.length > 0) {
		throw new Error(
			`REFUSED — guards are already disabled before we started:\n${off
				.map((r) => `  (${r.table}, ${r.trigger}, tgenabled=${r.enabled})`)
				.join("\n")}`,
		);
	}
	if (catalog.length !== EXPECTED_GUARD_CATALOG_ROWS) {
		throw new Error(
			`REFUSED — guard catalog returned ${catalog.length} rows, expected ${EXPECTED_GUARD_CATALOG_ROWS}. A protected relation may have been added without its triggers (ADR-0030 forward obligation), which would leave it un-truncatable or unguarded.`,
		);
	}

	// The shipped truncate set must never name an excluded table.
	for (const excluded of TRUNCATE_EXCLUSIONS) {
		if (TRUNCATE_SET.includes(excluded)) {
			throw new Error(
				`REFUSED — TRUNCATE_SET names the excluded table "${excluded}"`,
			);
		}
	}

	migrationsBefore = await countMigrations(client);

	console.log(
		`[staging:reset] target ${describeTarget(target.url)} · db=${live.database} · user=${live.user} · guards=${catalog.length} all enabled · migrations=${migrationsBefore}`,
	);
});

afterAll(async () => {
	// G-4 ALSO runs here, because the in-`it` call at the end of the batch is
	// skipped on exactly the path it exists for: if runGuardedReset throws, the
	// `finally` belt runs and the exception re-throws, so the verification
	// below the batch never executes. A split-batch regression only strands a
	// guard OFF when it fails mid-way — the very case that would have skipped
	// the check. afterAll always runs. @security-auditor, Slice A.
	try {
		await verifyPostReset(client, migrationsBefore || undefined);
	} catch (err) {
		console.error(`[staging:reset] G-4 FAILED after the run:\n${String(err)}`);
		throw err;
	} finally {
		await client.end({ timeout: 10 });
	}
});

describe("guarded staging reset", () => {
	it("truncates the fixture surface in one transaction, then verifies (G-4)", async () => {
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

		// G-4 runs in the SAME `it` as the batch it verifies — no ordering
		// change can separate them.
		await verifyPostReset(client, migrationsBefore);

		// identity_pool was truncated and MUST be re-seeded before anything
		// consumes a tuple (ADR-0035 primitive 5). `pnpm staging:reset` chains
		// db:seed:staging on success. If this run failed ANYWHERE after the
		// batch committed, that chain does not fire — re-seed by hand.
		console.log(
			"[staging:reset] done. identity_pool is EMPTY — re-seed before generating:\n" +
				"  doppler run --project zugzwang-experiment --config stg -- pnpm db:seed:staging",
		);
	});
});
