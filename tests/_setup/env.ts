// Default env vars for unit tests under tests/server/* + tests/integration/*.
// Production reads real values from .env.local + Vercel; tests just need
// non-empty values so module-load env validation in src/server/auth/index.ts +
// src/server/upstash/redis.ts doesn't throw before vi.mock replaces the
// IO surfaces. Conditional assignment (`??=`) so a real .env.local or a
// per-test override still wins.

process.env.BETTER_AUTH_SECRET ??=
	"test-better-auth-secret-64char-hex-placeholder-do-not-use-prod-x";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ??=
	"test-google-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.RESEND_API_KEY ??= "re_test_resend_api_key_placeholder";
// AUTH-OTP-DELIVERY: must be NON-SANDBOX. The extended fix-(a) guard rejects a
// resend.dev sender when ZUGZWANG_ENV ∈ {prod, staging} (the suite default env
// below is "prod"), so a sandbox default would throw across the whole suite.
process.env.RESEND_FROM_EMAIL ??= "no-reply@zugzwang.world";
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??= "1x00000000000000000000AA";
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";
process.env.ADMIN_PASSWORD ??=
	"test-admin-password-64char-hex-placeholder-do-not-use-prod-xxxx";
process.env.DATABASE_URL ??=
	"postgresql://postgres:postgres@localhost:54322/postgres";
process.env.UPSTASH_REDIS_REST_URL ??= "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-upstash-token-placeholder";
// SCAFFOLD.8 LD-10: getRedisKey() reads ZUGZWANG_ENV at module-load
// (rate-limit.ts constructs 7 Ratelimit instances at top-level after
// C4 refactor). Tests use "prod" as the default; tests that need to
// observe other-env behaviour override locally per Test 2 / unit-test
// pattern at tests/unit/upstash-keys.test.ts.
process.env.ZUGZWANG_ENV ??= "prod";
// SCAFFOLD.8 C4b: r2.ts resolveBucketEnv() now reads R2_BUCKET_*
// alongside the credential pair. Tests that go through that resolver
// (storage / sweep-orphans / sign-upload) need non-empty defaults.
// Mirrors the prod bucket names per .env.example.
process.env.R2_BUCKET_UPLOADS ??= "zugzwang-uploads";
process.env.R2_BUCKET_PFP ??= "zugzwang-pfp";

// Node test environment shim: better-fetch (under better-auth's client)
// synchronously throws when constructing URLs from relative paths if
// `window.location` is undefined. Per SCAFFOLD.3-FOLLOWUP-1 §15 Amendment
// 1.3 SURPRISE 2 resolution: provide a stable `window.location.origin` so
// the SDK can build absolute URLs against this base in the Node runtime.
if (typeof globalThis.window === "undefined") {
	Object.defineProperty(globalThis, "window", {
		value: { location: { origin: "http://localhost:3000" } },
		writable: true,
	});
}
