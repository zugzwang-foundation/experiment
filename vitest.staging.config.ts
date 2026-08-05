import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// STAGING-PARITY Slice A — ADR-0036: the dedicated opt-in config for
// OPERATIONAL STAGING RUNNERS (`pnpm staging:reset`, and the generator/gates
// that land in Slices B–D). Same plugins / resolve / setup / pool spine as
// vitest.config.ts, but it INCLUDES only `tests/staging/**/*.staging.test.ts`
// and carries no staging exclude.
//
// THESE ARE NOT TESTS. They are operational artifacts that borrow the Vitest
// harness for module resolution — the three blockers that make a plain `tsx`
// script unable to reach the engine (`server-only`'s react-server-only exports
// map, `canonicalize@3.0.0` being ESM-only against a repo tsx transpiles to
// CJS, and `@fastify/otel` shipping an invalid package.json) are all cleared at
// once by the `server-only` alias + vite-tsconfig-paths below, which twenty
// integration suites already exercise daily.
//
// ISOLATION IS STRUCTURAL, NOT PROCEDURAL (ADR-0036 primitive 2). The default
// `vitest.config.ts` EXCLUDES `tests/staging/**`, mirroring the `tests/scale/**`
// precedent, so a bare `vitest run` — local, CI, or a subagent's — can never
// reach a live database. "Remember not to run these in CI" is not a control;
// the exclusion is, and tests/unit/staging/runner-isolation.test.ts asserts it.
//
// This config carries NO connection string of its own. Every runner reads
// DATABASE_URL_STAGING and refuses to run without the full guard contract
// (ADR-0035 primitive 6) — pointing this config at a database is not something
// a config flag can do.
//
// `fileParallelism: false` + `pool: "forks"` mirror both other configs. The
// reset toggles triggers at the CATALOG level, which is global to the
// database — cross-file parallelism would race it against anything else here.

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
		// Operational runs cross the public internet to Supabase ap-south-1 and
		// truncate ~21 relations in one transaction; the generator in Slice B
		// will drive ~150 engine calls. Generous, still bounded.
		testTimeout: 120_000,
		hookTimeout: 60_000,
		isolate: true,
		pool: "forks",
		fileParallelism: false,
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: {
			enabled: false,
		},
		include: ["tests/staging/**/*.staging.test.ts"],
	},
});
