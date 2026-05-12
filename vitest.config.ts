import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Per SPEC.2 §6.6 + AGENTS.md §9. Minimal config — no coverage (HARDEN.*
// owns coverage thresholds), no globals (explicit imports per AGENTS.md §4),
// forks pool for process-isolation between test files (matches integration-
// test orthodoxy; one DB connection per file under the testClient { max: 1 }
// setting in tests/db/_fixtures/db.ts).

export default defineConfig({
	plugins: [tsconfigPaths()], // resolves @/db/schema → ./src/db/schema
	test: {
		globals: false,
		testTimeout: 10_000,
		hookTimeout: 10_000,
		isolate: true,
		pool: "forks",
		// fileParallelism: false — DB tests share a single local Postgres and
		// reach into overlapping FK ancestors (users, markets, comments). With
		// concurrent forks issuing TRUNCATE … CASCADE in afterEach against an
		// overlapping set of tables, races produce deadlocks (40P01) and stale
		// FK references. Run one file at a time. Within a file, tests run
		// sequentially by default. Plan CAT 5 missed this; documented as a
		// deviation in the @test-writer return.
		fileParallelism: false,
		coverage: {
			enabled: false,
		},
		include: ["tests/**/*.{test,spec}.ts"],
	},
});
