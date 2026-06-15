import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// ENGINE.10 Q-2 — the dedicated config for the correctness-at-scale battery
// (`pnpm test:scale`). Same plugins / resolve / setup / pool spine as the
// default `vitest.config.ts`, but it INCLUDES only `tests/scale/**/*.scale.test.ts`
// and carries NO scale exclude. The default run excludes `tests/scale/**`
// (vitest.config.ts), so the two configs partition the suite cleanly: the fast
// gate stays fast, the heavy collision storms run as their own named REQUIRED
// CI step (Q-2 — both the default suite AND test:scale must be green for the
// ENGINE.10 exit gate).
//
// `fileParallelism: false` + `pool: "forks"` mirror the default: the scale
// files share one local Postgres (:54322) and reach into overlapping FK
// ancestors (users, markets, pools), and the in-test collision drivers already
// engineer concurrency THROUGH the real `@/db` pool — cross-file parallelism
// would only race the TRUNCATE … CASCADE in each afterEach.

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
		// The collision storms barrier-release tens of writers onto the hot pool
		// rows and walk the full-jitter retry ladder — generous per-test budget so
		// a worst-case retry path is not a false timeout (still bounded, deterministic
		// end-state assertions; never asserts retry counts).
		testTimeout: 120_000,
		hookTimeout: 60_000,
		isolate: true,
		pool: "forks",
		fileParallelism: false,
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: {
			enabled: false,
		},
		include: ["tests/scale/**/*.scale.test.ts"],
	},
});
