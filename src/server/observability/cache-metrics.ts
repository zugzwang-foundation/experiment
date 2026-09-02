import "server-only";

import { safeCaptureException } from "@/server/observability/safe-capture";
import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";

/**
 * RELAY C2 — cache hit/miss instrumentation for the four Next.js Cache
 * Components (`'use cache'`) blocks in this repo.
 *
 * ⚠ THE GOVERNING FACT THIS MODULE IS BUILT AROUND, verified directly in the
 * installed `next@16.3.2` runtime (`use-cache-wrapper.js`), not inferred: on
 * a cache HIT, a `'use cache'` function's body never executes — zero lines
 * run. The miss branch is the only branch that calls the wrapped function.
 * So there is no code path inside a cached function that can distinguish
 * "this ran because of a hit" — a hit is invisible from inside.
 *
 * The design this makes possible: an unconditional counter placed INSIDE a
 * cached function body only ever fires on a miss (nothing else ever reaches
 * it). Paired with an unconditional counter at the CALL SITE (fires every
 * attempt, hit or miss), hit rate is `1 - misses/attempts`, computed at
 * read time — no hit-detection trickery needed, and nothing about this
 * requires reading the cached function's own return value.
 *
 * DIAGNOSTIC ONLY. Every function here fails open on any Redis error —
 * captured via `safeCaptureException`, never thrown, never allowed to
 * affect a real render. This module cannot change what gets cached, when,
 * or for how long; it only counts.
 *
 * SC-1 (CLAUDE.md §5.14) does not fire on this file: nothing here reads
 * `comments.body` or any cached DTO's contents — every call site passes
 * only a market ID (or null) and a block/tag name, values the call site
 * already has for its own reasons.
 */

function metricKey(
	block: string,
	kind: "attempts" | "misses" | "derivations" | "invalidated-at",
	marketId: string | null,
): string {
	return getRedisKey("cache-metric", block, kind, marketId ?? "global");
}

async function safeIncr(key: string): Promise<void> {
	try {
		await redis.incr(key);
	} catch (err) {
		safeCaptureException(err, {
			tags: { kind: "cache_metric_write_failed" },
		});
	}
}

/** Call at the CALL SITE of a `'use cache'` function, wrapping the existing
 * `await getCachedX(...)` call — fires on every attempt, hit or miss. */
export async function recordCacheAttempt(
	block: string,
	marketId: string | null,
): Promise<void> {
	await safeIncr(metricKey(block, "attempts", marketId));
}

/** Call INSIDE a `'use cache'` function body, before its `return` — fires
 * only on a miss, since a hit never reaches this line at all. */
export async function recordCacheMiss(
	block: string,
	marketId: string | null,
): Promise<void> {
	await safeIncr(metricKey(block, "misses", marketId));
}

/** `getCachedReserveWalk` is only reachable from inside two OTHER cached
 * function bodies, so a call-site counter for it is structurally
 * impossible — that call site is itself skipped on the outer cache's hit.
 * This internal-miss counter is the right and sufficient instrument: it
 * directly produces "derivations per minute", the coalescing figure the
 * tracker asks for (fifty bets in thirty seconds should cost one
 * derivation, not fifty). */
export async function recordReserveWalkDerivation(
	marketId: string,
): Promise<void> {
	await safeIncr(metricKey("reserve-walk", "derivations", marketId));
}

/** Call beside an existing `revalidateTag`/`updateTag` call — timestamp
 * only, for the invalidation-latency measurement (CM-10). Latency itself
 * (first-evicted-serve minus this timestamp) is computed at analysis time
 * by joining this against the next miss-counter increment for the same
 * market — not stored as a derived value here. */
export async function recordInvalidation(tag: string): Promise<void> {
	try {
		await redis.set(
			metricKey("invalidation", "invalidated-at", tag),
			Date.now(),
		);
	} catch (err) {
		safeCaptureException(err, {
			tags: { kind: "cache_metric_write_failed" },
		});
	}
}
