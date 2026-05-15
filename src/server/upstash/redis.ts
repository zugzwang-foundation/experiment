import { Redis } from "@upstash/redis";

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
 */
export const redis = Redis.fromEnv({ automaticDeserialization: false });
