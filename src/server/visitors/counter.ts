import "server-only";

import { redis } from "@/server/upstash/redis";

// UI.13 — the visitor counter's entire persisted state (SPEC.1 §21.1). ONE
// Upstash integer key: `INCR` on a real visit, `GET` to read. This holds no
// user, session, or device representation of any kind — the anti-conflation
// guarantee is enforced by the mechanism, not only by placement: the number
// reads nothing from the ledger / bets / positions / comments / events and
// feeds nothing into the engine. It is explicitly NOT `n`.
//
// Key `visits:total:${ZUGZWANG_ENV}` — founder-pinned (2026-07-23), env-LAST
// and non-negotiable, so staging traffic can never land in the production
// number. NOTE the ordering: `getRedisKey` (rate-limit / idempotency / mod-
// reserve) namespaces env-FIRST; this counter is a distinct keyspace and keeps
// the pinned env-last shape. Env is read + validated at call time (mirroring
// getRedisKey's fail-loud posture) so an invalid ZUGZWANG_ENV throws rather
// than writing an unnamespaced key. Errors throw; the /api/visits route maps a
// Redis outage to the P5 silent fallback.

const VALID_ENVS = ["prod", "staging", "preview"] as const;

function visitsKey(): string {
	const env = process.env.ZUGZWANG_ENV;
	if (!env || !(VALID_ENVS as readonly string[]).includes(env)) {
		throw new Error(
			`visitor counter: invalid ZUGZWANG_ENV ("${env}"); expected one of ${VALID_ENVS.join(", ")}`,
		);
	}
	return `visits:total:${env}`;
}

/** INCR the total on a visit, returning the new value on the same round-trip. */
export async function incrementAndRead(): Promise<number> {
	return Number(await redis.incr(visitsKey()));
}

/** GET the current total. Unset or unparseable → 0. */
export async function read(): Promise<number> {
	// `automaticDeserialization: false` on the singleton → GET returns the raw
	// string (or null); parse it ourselves.
	const raw = await redis.get<string>(visitsKey());
	if (raw === null) {
		return 0;
	}
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : 0;
}
