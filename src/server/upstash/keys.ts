// Environment-scoped Redis key construction per SCAFFOLD.8 LD-10.
//
// Single source of truth for Redis key prefixes across rate-limit,
// idempotency, moderation reservation, and cron-lock surfaces. The shared
// Upstash instance carries traffic from prod, staging, and preview; the
// leftmost segment of every key is the environment name, so a staging
// rate-limiter cannot read or evict a prod entry.
//
// Two lines of defense:
//   1. instrumentation.ts::register() fails the server boot if ZUGZWANG_ENV
//      is missing or invalid (Next.js guarantees register() completes
//      before request serving — see SCAFFOLD.8 plan §4.2 "Module-load
//      ordering").
//   2. This helper validates again at key-construction time so the
//      Ratelimit ctors at module-load (rate-limit.ts) and the runtime
//      key-builders (cache.ts, precommit.ts, r2-orphan-sweep route) fail
//      loudly if the env shape ever drifts.
//
// Examples:
//   ZUGZWANG_ENV=prod    → getRedisKey("ratelimit", "otp-email")
//                          → "prod:ratelimit:otp-email"
//   ZUGZWANG_ENV=staging → getRedisKey("idem", "abc123")
//                          → "staging:idem:abc123"

const VALID_ENVS = ["prod", "staging", "preview"] as const;
type ZugzwangEnv = (typeof VALID_ENVS)[number];

export function getRedisKey(...parts: string[]): string {
	const env = process.env.ZUGZWANG_ENV;
	if (!env || !VALID_ENVS.includes(env as ZugzwangEnv)) {
		throw new Error(
			`getRedisKey: invalid ZUGZWANG_ENV ("${env}"); expected one of ${VALID_ENVS.join(", ")}`,
		);
	}
	return [env, ...parts].join(":");
}
