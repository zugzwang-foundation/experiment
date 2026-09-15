import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// SEED-1-DUMMY — ADR-0053: the opt-in config for the SEED RUNNER, which can
// write to production. Same spine as vitest.staging.config.ts (read its header:
// the `server-only` alias and tsconfig paths are why a Vitest harness at all).
//
// It INCLUDES only `tests/prod-seed/**/*.prod-seed.test.ts`, and the default
// vitest.config.ts EXCLUDES `tests/prod-seed/**`, so no bare `vitest run` can
// reach it. Asserted by tests/unit/staging/runner-isolation.test.ts.
//
// `globalSetup` is the seed target guard instead of P-17. That guard runs P-17's
// own check in local and staging modes; only its prod mode admits the
// production ref, and only with the acknowledgement `scripts/seed-prod.ts` sets.

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
		// Never watch a runner that writes a live database.
		watch: false,
		// The run's own `it` carries its timeout (up to a 24h window + slack).
		testTimeout: 120_000,
		hookTimeout: 300_000,
		isolate: true,
		pool: "forks",
		fileParallelism: false,
		globalSetup: ["./tests/prod-seed/_lib/guard-setup.ts"],
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: {
			enabled: false,
		},
		include: ["tests/prod-seed/**/*.prod-seed.test.ts"],
	},
});
