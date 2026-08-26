import { defineConfig, devices } from "@playwright/test";

// Loads .env.local into process.env for the test runner itself (the
// webServer's `pnpm dev` already loads it for the app; tests that need
// vars like ADMIN_PASSWORD need it loaded here too).
try {
	process.loadEnvFile(".env.local");
} catch {}

// The E2E environment fence, applied to THIS process too — globalSetup runs
// in-process (not the spawned webServer children), so .env.local's real
// UPSTASH_REDIS_REST_URL must be overridden here as well, not only in
// webServer.env below.
//
// Points at a REAL local Redis, not an unreachable address — see
// tests/e2e/_fixtures/local-upstash-bridge.ts for why. Rate-limiting fails
// open when Redis is unreachable (safe), but idempotency-key checking fails
// CLOSED by design (ADR-0015 — it's what stops a double-charge on a retried
// request), so an unreachable Redis silently 503s every real bet placement,
// not just protects the shared rate-limit budget. The bridge is a thin
// protocol translator to a real LOCAL Redis (started via `redis-server`, not
// Docker) — it only ever talks to 127.0.0.1, never the shared instance.
const LOCAL_UPSTASH_BRIDGE_URL = "http://127.0.0.1:8079";
process.env.UPSTASH_REDIS_REST_URL = LOCAL_UPSTASH_BRIDGE_URL;
process.env.UPSTASH_REDIS_REST_TOKEN = "unused-local-token";

// .env.local intentionally carries real R2 credentials for normal `pnpm dev`
// browsing (image uploads work when testing by hand) — but E2E runs must
// never see them (env-guard.ts P2). Unset for this process only; .env.local
// itself is untouched.
for (const key of [
	"R2_BUCKET_UPLOADS",
	"R2_ACCESS_KEY_ID_UPLOADS",
	"R2_SECRET_ACCESS_KEY_UPLOADS",
	"R2_ENDPOINT_UPLOADS",
	"R2_BUCKET_PFP",
	"R2_ACCESS_KEY_ID_PFP",
	"R2_SECRET_ACCESS_KEY_PFP",
	"R2_ENDPOINT_PFP",
	"R2_BUCKET_MARKET_MEDIA",
	"R2_ACCESS_KEY_ID_MARKET_MEDIA",
	"R2_SECRET_ACCESS_KEY_MARKET_MEDIA",
	"R2_ENDPOINT_MARKET_MEDIA",
]) {
	delete process.env[key];
}

export default defineConfig({
	testDir: "./tests/e2e",
	globalSetup: "./tests/e2e/global-setup.ts",

	// Serial. globalSetup seeds one shared market and the E2E-1 handover's
	// participant tests mutate its CPMM price — parallel workers would race
	// the pool and make every price assertion non-deterministic.
	fullyParallel: false,
	workers: 1,

	retries: 0, // retries mask flake; flake should be visible, not hidden
	reporter: "html",

	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Two servers: the local Upstash bridge (must be up before the app boots,
	// since Redis.fromEnv() is constructed at module load) and the app itself.
	webServer: [
		{
			command: "pnpm exec tsx tests/e2e/_fixtures/local-upstash-bridge.ts",
			url: LOCAL_UPSTASH_BRIDGE_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 15_000,
		},
		{
			command: "pnpm dev",
			url: "http://localhost:3000",
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
			env: {
				UPSTASH_REDIS_REST_URL: LOCAL_UPSTASH_BRIDGE_URL,
				UPSTASH_REDIS_REST_TOKEN: "unused-local-token",
			},
		},
	],
});
