import "server-only";

import { after } from "next/server";

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
//
// ⛔⛔ AND FAIL-OPEN IS NOT THE SAME PROPERTY AS NON-BLOCKING — THIS MODULE HAD
// THE FIRST AND NOT THE SECOND, AND IT COST MORE THAN IT MEASURED.
// Every one of these was an `await`ed Upstash REST round trip on the RENDER
// PATH. `DiscoveryContent` calls `recordCacheAttempt` once per market inside
// its loop, so at `DISCOVERY_GRID_SIZE = 8` that was NINE serial network hops
// added to every Discovery render, and `/m/[slug]` paid one more on every
// poll tick per open tab (15 s then; 30 s since POLL-IDLE). Measured at CACHE-KEY-1: ~135 ms per round trip,
// i.e. ~1.2 s added to a surface whose whole post-PERF-1 p50 is 0.692 s.
// ⇒ An instrument that costs more than the effect it is measuring does not
// report the system's latency; it reports its own. The counters were also the
// reason `tests/server/discovery/page-wiring.test.ts` timed out — a unit-ish
// suite doing real network IO, which is the same defect wearing a test's
// clothes.
//
// ⇒ EVERY COUNTER NOW RUNS AFTER THE RESPONSE, and the functions return `void`
// rather than `Promise<void>` SO THAT A CALLER CANNOT AWAIT ONE BY REFLEX.
// That is the structural half (**O-1**): the old signatures made `await` the
// natural thing to type and nothing objected. These make it a type error.

/**
 * Run a counter write outside the render path.
 *
 * `after()` (next/server) defers to once the response has been sent, which is
 * what keeps the count durable on a serverless runtime — a bare floating
 * promise can be frozen with the function before the REST call lands.
 *
 * ⚠ THE CATCH IS NOT DEFENSIVE PADDING. `after()` throws when there is no
 * request scope, and a `'use cache'` body genuinely can run without one: a
 * background revalidation fills an entry outside any request. Both miss
 * counters live inside such bodies. Falling back to fire-and-forget there
 * trades a small chance of a lost count for never throwing out of a cached
 * derivation — the right way round for diagnostics.
 */
function schedule(task: () => Promise<void>): void {
	try {
		after(task);
	} catch {
		void task();
	}
}

function incr(key: string): void {
	schedule(async () => {
		try {
			await redis.incr(key);
		} catch (err) {
			safeCaptureException(err, { tags: { kind: "cache-metrics-incr" } });
		}
	});
}

/**
 * POLL-IDLE 1c — the attempt counter is SAMPLED: one render in this many writes,
 * and that write adds this many, so the stored count stays an unbiased estimate
 * of every attempt and `1 - misses/attempts` reads exactly as before.
 *
 * ⚠ ONLY THE ATTEMPT COUNTER. It is the one that fires on EVERY render — every
 * `/m/[slug]` poll tick per tab, and nine times per Discovery render — so it was
 * the per-render Upstash write. The miss counters fire only when a cached body
 * runs (bounded by the cache windows, not by traffic) and stay exact.
 *
 * ⚠ The coin is flipped INSIDE the deferred task, never during render: a
 * `Math.random()` in a render is a dynamic read under `cacheComponents`, and the
 * sampling must not be able to change what a page renders or how it caches.
 */
export const CACHE_ATTEMPT_SAMPLE_RATE = 10;

/** Call-site counter — records (sampled, see above) every attempt to read a cached block, hit or miss. */
export function recordCacheAttempt(
	block: string,
	marketId: string | null,
): void {
	const key = getRedisKey(
		"cache-metric",
		block,
		"attempts",
		marketId ?? "global",
	);
	schedule(async () => {
		if (Math.random() >= 1 / CACHE_ATTEMPT_SAMPLE_RATE) {
			return;
		}
		try {
			await redis.incrby(key, CACHE_ATTEMPT_SAMPLE_RATE);
		} catch (err) {
			safeCaptureException(err, { tags: { kind: "cache-metrics-incr" } });
		}
	});
}

/** Body counter — fires only when the cached function's body actually runs, i.e. only on a miss. */
export function recordCacheMiss(block: string, marketId: string | null): void {
	incr(getRedisKey("cache-metric", block, "misses", marketId ?? "global"));
}

/** `getCachedReserveWalk`'s derivation counter — what the DATABASE paid. Since CACHE-COALESCE-2 it is `reserve-walk-render`, the same `<block>-render` split every block uses; `reserve-walk` counts the per-instance L1 miss. (R-16/R-17 were read under the old name, where `reserve-walk` meant this.) */
export function recordReserveWalkDerivation(marketId: string): void {
	incr(getRedisKey("cache-metric", "reserve-walk-render", "misses", marketId));
}

/** CM-10 — a timestamp, keyed by the invalidated tag, for the invalidation-latency join at analysis time. */
export function recordInvalidation(tag: string): void {
	schedule(async () => {
		try {
			// `automaticDeserialization: false` on the shared singleton means a raw
			// string, never a number — same constraint the idempotency cache works
			// around, per that module's own docblock.
			await redis.set(
				getRedisKey("cache-metric", "invalidations", tag),
				String(Date.now()),
			);
		} catch (err) {
			safeCaptureException(err, {
				tags: { kind: "cache-metrics-invalidation" },
			});
		}
	});
}
