import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

// Per SPEC.2 §6.6 + AGENTS.md §9. Minimal config — no coverage (HARDEN.*
// owns coverage thresholds), no globals (explicit imports per AGENTS.md §4),
// forks pool for process-isolation between test files (matches integration-
// test orthodoxy; one DB connection per file under the testClient { max: 1 }
// setting in tests/db/_fixtures/db.ts).
//
// SCAFFOLD.3 additions:
//   - setupFiles: tests/_setup/env.ts seeds non-empty values for the
//     module-load env validation in src/server/auth/index.ts +
//     src/server/upstash/redis.ts (vi.mock replaces the IO surfaces, but the
//     env reads happen at module-load before the mocks attach).
//   - resolve.alias: "server-only" → noop shim. The real npm package throws
//     when a server module is bundled into a client component (Next.js
//     build-time guard); tests run in Node without that split.

export default defineConfig({
	plugins: [tsconfigPaths()], // resolves @/db/schema → ./src/db/schema
	resolve: {
		alias: {
			"server-only": fileURLToPath(
				new URL("./tests/_setup/server-only-shim.ts", import.meta.url),
			),
		},
	},
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
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: {
			enabled: false,
		},
		include: ["tests/**/*.{test,spec}.ts"],
		// ENGINE.10 Q-2: the correctness-at-scale battery (`tests/scale/`) is a
		// SEPARATE, gated `test:scale` CI step (vitest.scale.config.ts) — a named
		// required gate component, NOT part of the fast default `vitest run`,
		// `test:invariants`, or `test:integration` sweeps. Exclude it here so those
		// runs never pick up the heavy `*.scale.test.ts` collision storms.
		exclude: [...configDefaults.exclude, "tests/scale/**"],
	},
});
