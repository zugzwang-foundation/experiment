import { randomUUID } from "node:crypto";
import { redis } from "@/server/upstash/redis";

// Distributed lock helper for cron-style single-runner guarantees per
// SCAFFOLD.15 plan §5.4. Bootstrapped by the orphan-sweep cron; reusable by
// any future cron job that needs at-most-one-runner semantics across the
// "Vercel Cron fires twice in rare cases + multi-region warm Lambda" matrix.
//
// State machine:
//   - acquireLock(key, ttlSeconds):
//       token = randomUUID()
//       SET NX EX → "OK" returns { token }; null returns null (contention)
//       Rethrows on Upstash unreachable — caller decides posture.
//   - releaseLock(key, token):
//       Lua-script CHECK-AND-DELETE: if stored value == caller's token then
//       DEL else return 0. Prevents a stuck-lock-from-prior-run from being
//       released by the current run after the prior's TTL expires.
//
// Lua script body is local (not registered via SCRIPT LOAD) — Upstash
// supports EVAL inline and the script is short enough that the per-call
// transmission cost is negligible. Cache-load semantics differ across
// Upstash plans; staying with inline EVAL keeps the contract portable.

const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

/**
 * Attempt to acquire a distributed lock under `key` with `ttlSeconds` TTL.
 * Returns `{ token }` on success — caller MUST pass `token` back to
 * `releaseLock` in a `finally` block. Returns `null` on contention (another
 * holder has the lock). Rethrows on Upstash unreachable; caller decides
 * posture (the orphan-sweep cron rethrows; a future caller could
 * fail-OPEN if appropriate).
 */
export async function acquireLock(
	key: string,
	ttlSeconds: number,
): Promise<{ token: string } | null> {
	const token = randomUUID();
	const result = await redis.set(key, token, { nx: true, ex: ttlSeconds });
	if (result === "OK") {
		return { token };
	}
	return null;
}

/**
 * Release a distributed lock under `key` IFF the stored value matches
 * `token`. Returns `true` if the lock was released (token matched), `false`
 * otherwise (token mismatch — typically means our lock TTL'd out and was
 * re-acquired by another runner; we MUST NOT delete the new holder's lock).
 * Rethrows on Upstash unreachable.
 */
export async function releaseLock(
	key: string,
	token: string,
): Promise<boolean> {
	const result = await redis.eval(RELEASE_LOCK_LUA, [key], [token]);
	return result === 1;
}
