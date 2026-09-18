import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// MKT-ROSTER-1 · ONE-TIME — the opt-in config for the single authorised
// PRODUCTION restore (D-49; ADR-0036 carries the callout).
//
// ⛔⛔ THIS FILE IS NEVER MERGED. It exists so that the one production run has
// the same structural isolation the staging runners have, rather than being a
// flag on a shipped config that somebody could set by accident later.
//
// ⛔⛔ ISOLATION IS BY FILENAME, AND THAT IS A CORRECTION TO THE OBVIOUS DESIGN.
// The staging runners are isolated because `vitest.config.ts` EXCLUDES
// `tests/staging/**`. Copying that shape would mean adding
// `tests/prod-onetime/**` to the default config's exclude list — an edit to a
// file that lives on `main`, made by a branch whose whole safety property is
// that it never merges.
//
// Measured instead of assumed: `vitest.config.ts:52` includes
// `tests/**/*.{test,spec}.{ts,tsx}` and `:66` excludes only `tests/scale/**` and
// `tests/staging/**`. So a file here named `*.prod.test.ts` WOULD be collected
// by a bare `pnpm vitest run` — it would then throw at module scope for want of
// DATABASE_URL_PROD and redden the whole suite for anyone on this branch.
//
// ⇒ The runner is named `*.prod-runner.ts`, which matches NO shipped include
// pattern. The default suite cannot collect it because it cannot see it, and
// nothing on `main` had to change for that to be true. Structural, not
// procedural (§8 O-1): a filename that does not match is a stronger guarantee
// than a guard that fires after collection.
//
// `watch: false`, for the reason vitest.staging.config.ts gives: a bare
// invocation in an operator's shell would otherwise be WATCH MODE, and
// re-running a destructive operational artifact on every file save is the first
// of the three plausible keystrokes ADR-0035's Addendum names.
//
// This config carries NO connection string. Pointing it at a database is not
// something a config flag can do — the runner reads DATABASE_URL_PROD and
// refuses without the full inverted guard contract.

export default defineConfig({
	plugins: [tsconfigPaths()],
	resolve: {
		alias: {
			"server-only": fileURLToPath(
				new URL("./tests/_setup/server-only-shim.ts", import.meta.url),
			),
		},
	},
	test: {
		globals: false,
		watch: false,
		testTimeout: 120_000,
		hookTimeout: 60_000,
		isolate: true,
		pool: "forks",
		fileParallelism: false,
		// ⛔ NOT `tests/_setup/production-ref-guard.ts` — that one refuses a
		// production ref and would refuse this run before a worker forked. This
		// is its INVERSE, which refuses staging and refuses any host it cannot
		// name. The shipped guard is untouched and still protects all three
		// shipped configs.
		globalSetup: ["./tests/prod-onetime/_setup/prod-ref-allow.ts"],
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: { enabled: false },
		include: ["tests/prod-onetime/**/*.prod-runner.ts"],
	},
});
