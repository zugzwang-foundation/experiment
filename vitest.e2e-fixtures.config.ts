import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// E2E-1 — the dedicated opt-in config for the local Playwright world-seeder
// (tests/e2e/_fixtures/generate-local-world.vitest.ts), mirroring
// vitest.staging.config.ts's isolation shape (ADR-0036 primitive 2).
//
// NOT a test suite — a Vitest-context operational script. It exists only
// because acceptTosAction reads next/headers' cookies()/headers(), which
// only resolve inside a real Next.js request or a mocked module; borrowing
// the Vitest harness for module resolution is the same trick ADR-0036 uses
// for the staging runners.
//
// Isolation is structural: the default vitest.config.ts's include glob
// (tests/**/*.{test,spec}.{ts,tsx}) never matches this file's .vitest.ts
// suffix, so a bare `vitest run` can never reach it. This config is the only
// path that can invoke it, and it is only ever invoked from
// tests/e2e/global-setup.ts against a DATABASE_URL already proven local by
// assertIsolatedEnvironment().

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
		testTimeout: 60_000,
		hookTimeout: 30_000,
		isolate: true,
		pool: "forks",
		fileParallelism: false,
		setupFiles: ["./tests/_setup/env.ts"],
		coverage: { enabled: false },
		include: ["tests/e2e/_fixtures/*.vitest.ts"],
	},
});
