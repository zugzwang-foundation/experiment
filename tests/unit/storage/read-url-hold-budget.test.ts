import { describe, expect, it } from "vitest";

import {
	DOWNSTREAM_CACHED_MINUTES,
	DOWNSTREAM_CACHED_SERIES,
	DOWNSTREAM_NONE,
	holdWindowMs,
	RENDER_TTL_SECONDS,
	SHIPPED_HOLD_BUDGET,
} from "@/server/storage/read-url-memo";

/**
 * R2-MEMO · the hold budget — `hold + downstream < ttl`, at every call site.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE SUITE IT REPLACES WAS GREEN ON A REAL DEFECT.
 * The original memo suite looped `[60, 300, 3600, 86400]`. Of those, exactly
 * one (60) is a TTL this codebase passes; `3600` was superseded by ADR-0041 D-6
 * and `300`/`86400` are reachable from nowhere. The value that actually
 * shipped — 7200 — was asserted by nothing, which is precisely why a hold of
 * 6000 s could sit inside a cache that serves for another 3600 s and no test
 * noticed the URL had been dead for forty minutes.
 *
 * So the table below is NOT a list of interesting numbers. It is
 * `SHIPPED_HOLD_BUDGET`, imported from the module, derived from the constants
 * the call sites actually read. A TTL that no longer ships cannot be tested
 * here by accident, and one that starts shipping cannot be missed.
 *
 * WHAT THE INVARIANT MEANS. A presigned URL is valid for `ttl` seconds from
 * the moment it is signed. Two things then spend that budget before a browser
 * ever asks R2 for the bytes:
 *
 *   1. the HOLD — this module may re-serve the URL for `hold` seconds; and
 *   2. the DOWNSTREAM window — whatever cache the caller sits inside may keep
 *      serving the response carrying that URL for `downstream` seconds more.
 *
 * They compose. `hold + downstream` is the worst-case age of a URL at the
 * instant a browser finally requests it, and it must stay under `ttl` or the
 * request 403s. Silently: the mint succeeded, so nothing throws and nothing is
 * captured.
 *
 * Pure arithmetic. No DB, no R2, no Next runtime — see
 * `tests/server/storage/cache-boundary-parity.test.ts` for why the cached
 * boundary itself can only be checked statically.
 */

describe("the shipped hold budget", () => {
	/**
	 * ⛔ THE ONE THAT WOULD HAVE CAUGHT C-1. Against the pre-fix formula
	 * (`ttl × 5/6`, downstream ignored) the three render rows evaluate to
	 * `6000 + 3900 = 9900` against a 7200 s signature and this test is RED.
	 */
	it.each(
		SHIPPED_HOLD_BUDGET,
	)("$site — hold + downstream stays inside the signature", ({
		ttlSeconds,
		downstreamSeconds,
	}) => {
		const holdSeconds = holdWindowMs(ttlSeconds, downstreamSeconds) / 1000;

		expect(holdSeconds + downstreamSeconds).toBeLessThan(ttlSeconds);
	});

	it("covers every call site that reaches the memo — four, not three", () => {
		// A budget table missing a row is the same defect as a wrong number in
		// one, and it is harder to see. Pinning the count makes a silent
		// deletion fail here rather than pass quietly with less coverage.
		expect(SHIPPED_HOLD_BUDGET).toHaveLength(4);
		expect(SHIPPED_HOLD_BUDGET.map((r) => r.site)).toContain(
			"src/server/admin/moderation/review-feed.ts",
		);
	});

	it("passes 7200 through the memo — the value that actually ships", () => {
		// Stated on its own because the superseded suite's failure was not a
		// wrong assertion, it was an absent one.
		const renderRows = SHIPPED_HOLD_BUDGET.filter(
			(r) => r.ttlSeconds === RENDER_TTL_SECONDS,
		);
		expect(renderRows).toHaveLength(3);

		for (const row of renderRows) {
			expect(row.ttlSeconds).toBe(7200);
			expect(holdWindowMs(7200, row.downstreamSeconds) / 1000).toBe(2750);
		}
	});
});

describe("the formula itself — the invariant is a theorem, not a tuning", () => {
	/**
	 * The property that makes this safe against numbers nobody has thought of
	 * yet. With `hold = (ttl − downstream) × 5/6`, the total spend is
	 * `ttl − (ttl − downstream)/6`, which is below `ttl` for EVERY pair where
	 * `ttl > downstream`. There is no value of either that breaks it, so the
	 * next person to add a cache boundary cannot pick a bad one.
	 */
	it("holds for every pair where the TTL outlives the cache", () => {
		const ttls = [60, 120, 900, 3600, 7200, 86_400];
		const downstreams = [0, 30, 60, 300, 3660, 3900];

		for (const ttl of ttls) {
			for (const downstream of downstreams) {
				if (downstream >= ttl) continue;
				const hold = holdWindowMs(ttl, downstream) / 1000;

				expect(hold + downstream).toBeLessThan(ttl);
				// And the margin is a sixth of the USABLE window, never a sixth
				// of the whole TTL — that difference is the entire fix.
				expect(ttl - (hold + downstream)).toBeCloseTo(
					(ttl - downstream) / 6,
					0,
				);
			}
		}
	});

	it("refuses to hold at all when the cache outlives the signature", () => {
		// The degenerate arm, and the one that keeps the invariant total. A
		// non-positive usable window must not produce a negative hold or a
		// clamped-but-nonzero one — it must switch memoisation OFF, falling
		// back to a mint per call, which is what this module's absence did.
		expect(holdWindowMs(60, 60)).toBe(0);
		expect(holdWindowMs(60, 3900)).toBe(0);
		expect(holdWindowMs(3600, 3600)).toBe(0);
	});

	it("gives a shorter TTL a shorter hold, downstream held equal", () => {
		// The original safety argument, preserved. It was never wrong — it was
		// incomplete, because it reasoned about the signature and not about who
		// was still holding the response.
		expect(holdWindowMs(60, DOWNSTREAM_NONE)).toBe(50_000);
		expect(holdWindowMs(7200, DOWNSTREAM_NONE)).toBe(6_000_000);
		expect(holdWindowMs(60, DOWNSTREAM_NONE)).toBeLessThan(
			holdWindowMs(7200, DOWNSTREAM_NONE),
		);
	});
});

describe("the downstream ceilings themselves", () => {
	it("counts both the server's expire and the client's stale window", () => {
		// 3600 + 300. Counting `expire` alone would be the tighter, wronger
		// number: the server stops STORING the entry at expire, but the client
		// router can still be showing the response it already received.
		expect(DOWNSTREAM_CACHED_MINUTES).toBe(3900);
	});

	it("DERIVES the series ceiling so a HARDEN.6 tune arrives by itself", () => {
		// ⚠ The reason downstream is a parameter at all. `cached-series.ts`
		// computes its own expire from MARKET_SERIES_MIN_WINDOW_MS, whose
		// docblock advertises that tune explicitly. A hold ratio frozen against
		// today's 3600 would go quietly wrong the day that constant moves; a
		// derived ceiling re-checks itself here instead.
		expect(DOWNSTREAM_CACHED_SERIES).toBe(3660);
	});
});
