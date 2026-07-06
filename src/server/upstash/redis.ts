import { Redis } from "@upstash/redis";

import {
	REDIS_COMMAND_TIMEOUT_MS,
	REDIS_MAX_RETRIES,
	REDIS_RETRY_BACKOFF_MS,
} from "@/server/config/limits";

/**
 * Singleton Upstash Redis REST client. Additive utility — SPEC.2 §11.6
 * names three "single source of truth" files (rate-limit.ts, cache.ts,
 * types.ts); this wrapper is an internal testability helper, not a
 * contract surface and not a load-bearing module per Q3 ratification
 * (Web Claude sign-off 2026-05-15). One env-read site, one mock surface
 * for `vi.mock("@/server/upstash/redis")` in the SCAFFOLD.4 substrate
 * tests.
 *
 * Module-load construction is acceptable per SCAFFOLD.4 plan §6 edge
 * cases and risk #4 — same posture as SCAFFOLD.14's `BETTER_AUTH_SECRET`
 * (the app refuses to boot without the env vars). If a developer runs
 * `pnpm dev` without `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`,
 * `Redis.fromEnv` throws with a message pointing at .env.example.
 *
 * `automaticDeserialization: false` keeps GET returning raw strings.
 * The idempotency cache state machine (`cache.ts`) owns its own JSON
 * pipeline because the sentinel-vs-completed-payload discrimination needs
 * a raw-string `startsWith(PENDING_SENTINEL_PREFIX)` BEFORE the JSON.parse.
 * With auto-deserialization on, `redis.get(idemKey)` would auto-parse a
 * stored JSON payload into an object and the sentinel-string check would
 * throw on `.startsWith` against a non-string — so this flag is load-
 * bearing for the cache state machine, not stylistic.
 *
 * Transport bounds (AUDIT-FIX-B7a, finding A14 / ADR-0015 Patch
 * 2026-07-06): the vendor default is `retries ?? 5` (6 fetch attempts,
 * exponential backoff ≈4.3s of sleep) with NO timeout of any kind — a
 * hung socket rides undici defaults up to the platform function timeout,
 * silently contradicting ADR-0015's no-auto-retry posture on every call
 * from this singleton (idempotency, rate-limit, moderation
 * reserve/release). Two vendor subtleties are load-bearing (verified
 * against the installed 1.38.0 request loop):
 *
 * 1. The FUNCTION form of `signal` is MANDATORY — with a static
 *    AbortSignal the SDK fabricates a 200 response with body
 *    `{result: "Aborted"}` on abort (garbage into SETNX results); the
 *    function form rethrows the abort as a throw into the existing
 *    fail-open (rate-limit) / fail-closed (idempotency, mod-reserve)
 *    catch arms — never fabricated success.
 * 2. The signal is minted once per command execution (`signal()` at
 *    request-options build) and covers the vendor's WHOLE internal retry
 *    loop — a hard REDIS_COMMAND_TIMEOUT_MS ceiling per command
 *    regardless of retry count.
 */
export const redis = Redis.fromEnv({
	automaticDeserialization: false,
	retry: {
		retries: REDIS_MAX_RETRIES,
		backoff: () => REDIS_RETRY_BACKOFF_MS,
	},
	signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS),
});
