import "server-only";

import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";
import { safeCaptureException } from "./safe-capture";

// RELAY C2 — cache hit/miss instrumentation.
//
// A `'use cache'` function's body never runs on a hit (traced in the shipped
// next@16.3.2 `use-cache-wrapper.js` — the miss branch calls the function,
// the hit branch reads the stored entry and never touches it). So an
// unconditional counter INSIDE the body only ever fires on a miss; paired
// with an unconditional counter at the CALL SITE (fires every attempt), hit
// rate is `1 - misses/attempts`, computed at read time from two plain
// counts. No hit-detection code path exists or is needed.
//
// Fail-open, mirroring `safe-capture.ts`'s posture (not `counter.ts`'s,
// which is deliberately fail-loud for its one founder-pinned key) — this is
// diagnostic infra and must never break a real render if Redis hiccups.
// Reuses the shared `@/server/upstash/redis` singleton rather than
// constructing a second client (that module's own docblock names itself
// the one env-read site).

async function incr(key: string): Promise<void> {
	try {
		await redis.incr(key);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "cache-metrics-incr" } });
	}
}

/** Call-site counter — fires on every attempt to read a cached block, hit or miss. */
export async function recordCacheAttempt(
	block: string,
	marketId: string | null,
): Promise<void> {
	await incr(
		getRedisKey("cache-metric", block, "attempts", marketId ?? "global"),
	);
}

/** Body counter — fires only when the cached function's body actually runs, i.e. only on a miss. */
export async function recordCacheMiss(
	block: string,
	marketId: string | null,
): Promise<void> {
	await incr(
		getRedisKey("cache-metric", block, "misses", marketId ?? "global"),
	);
}

/** `getCachedReserveWalk`'s own miss counter — the "derivations per minute" figure, since it has no reachable call site of its own. */
export async function recordReserveWalkDerivation(
	marketId: string,
): Promise<void> {
	await incr(getRedisKey("cache-metric", "reserve-walk", "misses", marketId));
}

/** CM-10 — a timestamp, keyed by the invalidated tag, for the invalidation-latency join at analysis time. */
export async function recordInvalidation(tag: string): Promise<void> {
	try {
		// `automaticDeserialization: false` on the shared singleton means a raw
		// string, never a number — same constraint the idempotency cache works
		// around, per that module's own docblock.
		await redis.set(
			getRedisKey("cache-metric", "invalidations", tag),
			String(Date.now()),
		);
	} catch (err) {
		safeCaptureException(err, { tags: { kind: "cache-metrics-invalidation" } });
	}
}
