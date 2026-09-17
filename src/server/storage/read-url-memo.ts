import "server-only";

import {
	DISCOVERY_PRICE_EXPIRE_SEC,
	DISCOVERY_PRICE_MIN_WINDOW_MS,
	MARKET_SERIES_MIN_WINDOW_MS,
	READ_URL_TTL_SECONDS_MODERATION,
} from "@/server/config/limits";
import type { R2Bucket } from "@/server/storage/r2";

/**
 * R2-MEMO — presigned READ URLs, held instead of re-minted.
 *
 * THE DEFECT. `mintReadUrl` produces a fresh presigned URL on every call: the
 * signature embeds a timestamp, so the same object yields a *different* URL
 * each time it is asked for. A browser keys its cache on the URL, so every one
 * of those is a cache MISS and a full re-download of bytes the client already
 * has. The signing itself is a local HMAC and costs nothing; the cost is
 * entirely the re-downloads and the storage reads behind them.
 *
 * ⚠ WHAT THE MEMO IS ACTUALLY WORTH, stated precisely because the obvious
 * answer is wrong. The three render call sites now sit INSIDE `"use cache"`
 * blocks, and a cached entry already embeds one URL and serves it for the
 * entry's whole life — so within a single entry the browser was never being
 * shown a new URL, with or without this module. The value is ACROSS
 * INVALIDATIONS: those blocks are keyed on pool reserves, so every bet busts
 * every reader's entry, and without the memo one bet costs every open tab a
 * full re-download of an image nobody touched. On a busy market that is the
 * common case, not the edge.
 *
 * THE FIX, and the thing that makes it safe:
 *
 *     hold = max(0, floor((ttl − downstream) × 5/6))
 *
 * ⚠ THE RATIO DIVIDES THE USABLE WINDOW, NOT THE WHOLE TTL. The first version
 * of this module divided the TTL, which is correct only if the URL is consumed
 * as soon as it is produced. It is not: a caller inside a cache hands the URL
 * to a response that goes on being served long after the call returned, and the
 * two windows ADD. `hold + downstream` is the real age of a URL when a browser
 * finally asks R2 for it, and at 7200 s that came to 6000 + 3900 = 9900 against
 * a 7200 s signature — dead for the last forty minutes of the serve window,
 * silently, because the mint had succeeded and nothing threw. That is the class
 * ADR-0041 D-6 closed by moving the render TTL to 7200, and this module
 * re-opened it by removing the premise D-6 rested on: that the URL inside a
 * cache entry was minted when the entry was generated.
 *
 * ⚠ `downstream` IS A PARAMETER RATHER THAN A CONSTANT, and the reason is not
 * generality. `DOWNSTREAM_CACHED_SERIES` is derived from
 * `MARKET_SERIES_MIN_WINDOW_MS`, whose own docblock advertises a HARDEN.6 tune
 * — the ceiling is not merely movable, it is SCHEDULED to move. A ratio chosen
 * today against `expire = 3600` would go quietly wrong on the day someone tunes
 * a constant they have no reason to connect to image URLs. As a parameter, the
 * invariant `hold + downstream < ttl` is a theorem about the formula (see
 * `holdWindowMs`) that no pair of values can break, and the budget test
 * re-derives it from whatever the constants say at the time.
 *
 * ┌─ THE SHIPPED BUDGET ─────────────────────────────────────────────────────┐
 * │ call site                          ttl  downstream   hold   Σ    < ttl?  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ debate-view/load-debate-view.ts   7200        3900   2750  6650    ✓     │
 * │ discovery/hero.ts                 7200        3900   2750  6650    ✓     │
 * │ discovery/media.ts                7200        3900   2750  6650    ✓     │
 * │ admin/moderation/review-feed.ts     60          30     25    55    ✓     │
 * │ moderation/precommit.ts             60           —      —     —   n/a    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `precommit.ts` does not appear because it no longer reaches this module at
 * all — it calls `signReadSingleUse`. Its consumer is OpenAI's fetcher, not a
 * browser, so there is no cache to key and nothing whatsoever to gain; holding
 * there only spent the budget of a fail-closed CSAM gate. Removing it beats
 * tuning it to be safe.
 *
 * The table above is `SHIPPED_HOLD_BUDGET`, asserted row by row by
 * `tests/unit/storage/read-url-hold-budget.test.ts`, and the boundaries it
 * reads are held in parity with the source tree by
 * `tests/server/storage/cache-boundary-parity.test.ts`. **Someone adding a
 * fifth cache boundary meets this table before they meet the bug.**
 *
 * ⛔ NOT A SECURITY CHANGE. The TTLs themselves are untouched, the buckets stay
 * private, and nothing here widens who can read an object. A held URL is one
 * this process had already minted and served; holding it grants no access that
 * re-minting would not have granted a moment later. It STRICTLY NARROWS the
 * window in one place worth naming: after a moderator removes content, the last
 * URL handed out was minted earlier than it would have been without the memo,
 * so it dies sooner.
 *
 * ⛔ PER-INSTANCE AND IN-MEMORY, deliberately. This is a render-cost
 * optimisation, not a source of truth: an instance restart or a deploy simply
 * re-mints, which is exactly the behaviour before this module existed. No new
 * service, no dependency, nothing to operate.
 */

/**
 * Fraction of an object URL's TTL for which a minted URL may be re-served.
 * See the module docblock for why this is a ratio and not a duration.
 */
const HOLD_FRACTION = 5 / 6;

/**
 * Bound on distinct held URLs. A market's comment list carries no `LIMIT`
 * (`list-comments.ts`), so image count per render is bounded only by how many
 * image-bearing arguments a market has — this cap is what keeps an unbounded
 * read from becoming unbounded memory. Sized to comfortably cover the seeded
 * fixture set with headroom; eviction below is what makes overflow safe rather
 * than fatal.
 */
const MAX_ENTRIES = 2048;

/* ------------------------------------------------------------------ *
 * DOWNSTREAM CEILINGS — how long a URL can still be SERVED after the
 * call that minted it returned.
 *
 * These are READ, never set. Every value below MIRRORS a number owned
 * somewhere else; changing one here would not change the cache, it would
 * only make this module lie about it.
 * ------------------------------------------------------------------ */

/**
 * Next's own `cacheLife("minutes")` profile. Not a project choice — ADR-0041
 * §28/§138 consumes Next's named-profile defaults as given, and this is a
 * mirror of them so the arithmetic below has something to read.
 */
const CACHE_MINUTES_EXPIRE_SECONDS = 3600;
const CACHE_MINUTES_STALE_SECONDS = 300;

/** `MARKET_SERIES_MIN_WINDOW_MS` in the seconds `cacheLife` speaks. */
const SERIES_WINDOW_SECONDS = MARKET_SERIES_MIN_WINDOW_MS / 1000;

/**
 * A URL embedded in a `cacheLife("minutes")` entry can still be served
 * `expire` seconds after that entry was generated, plus the `stale` window in
 * which the client router will keep showing it. Both are counted: the question
 * is not when the server stops storing the URL, it is when the last browser
 * can still be handed it.
 */
export const DOWNSTREAM_CACHED_MINUTES =
	CACHE_MINUTES_EXPIRE_SECONDS + CACHE_MINUTES_STALE_SECONDS;

/**
 * The CHART-1 series boundary (`discovery/cached-series.ts`), DERIVED from
 * `MARKET_SERIES_MIN_WINDOW_MS` rather than copied from it — that constant's
 * own docblock advertises a HARDEN.6 tune, so this ceiling is not merely
 * movable, it is scheduled to move. Deriving it means the tune arrives here by
 * itself and the budget test re-checks the invariant against the new number.
 *
 * ⚠ No presigned URL rides this boundary today. It is declared anyway, because
 * the parity test requires every cache boundary to have a ceiling on record —
 * the point is that the FIFTH boundary cannot be added silently.
 */
export const DOWNSTREAM_CACHED_SERIES =
	SERIES_WINDOW_SECONDS * 60 + SERIES_WINDOW_SECONDS;

/**
 * The ADR-0055 Discovery pricing boundary (`discovery/cached-pricing.ts`),
 * DERIVED from its two constants rather than copied from them — the same rule
 * as `DOWNSTREAM_CACHED_SERIES` above, and for the same reason: both are
 * advertised as tunable, so deriving means a tune arrives here by itself and
 * the budget test re-checks the invariant against the new number.
 *
 * ⚠ No presigned URL rides this boundary, and none can: the entry holds pricing,
 * reserves and `unitToWin` — decimal STRINGS, no media, no URL of any kind. It
 * is declared anyway because this registry's whole mechanism is that a boundary
 * cannot appear without someone writing its ceiling down. A boundary that
 * carries no URL today is one refactor away from carrying one.
 */
export const DOWNSTREAM_CACHED_DISCOVERY_PRICE =
	DISCOVERY_PRICE_EXPIRE_SEC + DISCOVERY_PRICE_MIN_WINDOW_MS / 1000;

/** No cache between the mint and the consumer. */
export const DOWNSTREAM_NONE = 0;

/**
 * Worst-case delay between an admin's moderation feed rendering and that
 * admin's browser actually issuing the image GET — a feed of up to
 * `REVIEW_FEED_CAP` rows carrying up to `IMAGE_UPLOADS_MAX_BYTES` each, on
 * whatever connection the moderator happens to have.
 */
export const DOWNSTREAM_ADMIN_FEED_FETCH = 30;

/**
 * Every `"use cache"` function in `src/server/**` and the serve window it
 * imposes on any presigned URL embedded in its return value.
 *
 * ⚠ THIS TABLE IS LOAD-BEARING AND IS ASSERTED AGAINST THE SOURCE TREE by
 * `tests/server/storage/cache-boundary-parity.test.ts`. Adding a `"use cache"`
 * function anywhere under `src/server/` without adding it here turns that test
 * RED. That is the whole mechanism: C-1 shipped because a cache boundary and a
 * URL lifetime were related by nothing a test could read.
 */
export const CACHE_BOUNDARY_CEILINGS: Readonly<Record<string, number>> = {
	"src/server/debate-view/cached-view.ts": DOWNSTREAM_CACHED_MINUTES,
	"src/server/discovery/cached-pricing.ts": DOWNSTREAM_CACHED_DISCOVERY_PRICE,
	"src/server/discovery/cached-series.ts": DOWNSTREAM_CACHED_SERIES,
	"src/server/discovery/list.ts": DOWNSTREAM_CACHED_MINUTES,
};

/**
 * The render-path presigned-GET TTL, declared module-locally in each of the
 * three render readers (`load-debate-view.ts`, `discovery/hero.ts`,
 * `discovery/media.ts`) per ADR-0041 D-6. Mirrored here so the budget table has
 * a value to read; the parity test asserts all three still agree with it.
 */
export const RENDER_TTL_SECONDS = 7200;

/**
 * Every (call site, ttl, downstream) triple this codebase actually ships.
 *
 * The invariant `hold + downstream < ttl` is asserted over exactly this table
 * by `tests/unit/storage/read-url-hold-budget.test.ts`. Keeping the table in
 * the module rather than in the test is deliberate: someone adding a fifth
 * boundary should find it here, next to the arithmetic, before they find the
 * bug.
 */
export const SHIPPED_HOLD_BUDGET: ReadonlyArray<{
	readonly site: string;
	readonly ttlSeconds: number;
	readonly downstreamSeconds: number;
	/**
	 * ⚠ The NAME, not just the value — and it is here because a table that
	 * records only the number cannot notice a call site passing a different one.
	 * The parity test greps each site for this identifier, so swapping
	 * `DOWNSTREAM_CACHED_MINUTES` for `DOWNSTREAM_NONE` at a call site turns it
	 * RED instead of leaving a green suite over a reopened C-1.
	 */
	readonly downstreamIdentifier: string;
}> = [
	{
		site: "src/server/debate-view/load-debate-view.ts",
		ttlSeconds: RENDER_TTL_SECONDS,
		downstreamSeconds: DOWNSTREAM_CACHED_MINUTES,
		downstreamIdentifier: "DOWNSTREAM_CACHED_MINUTES",
	},
	{
		site: "src/server/discovery/hero.ts",
		ttlSeconds: RENDER_TTL_SECONDS,
		downstreamSeconds: DOWNSTREAM_CACHED_MINUTES,
		downstreamIdentifier: "DOWNSTREAM_CACHED_MINUTES",
	},
	{
		site: "src/server/discovery/media.ts",
		ttlSeconds: RENDER_TTL_SECONDS,
		downstreamSeconds: DOWNSTREAM_CACHED_MINUTES,
		downstreamIdentifier: "DOWNSTREAM_CACHED_MINUTES",
	},
	{
		site: "src/server/admin/moderation/review-feed.ts",
		ttlSeconds: READ_URL_TTL_SECONDS_MODERATION,
		downstreamSeconds: DOWNSTREAM_ADMIN_FEED_FETCH,
		downstreamIdentifier: "DOWNSTREAM_ADMIN_FEED_FETCH",
	},
];

/**
 * How many `"use cache"` directives the tree carries in total.
 *
 * ⚠ NOT redundant with `CACHE_BOUNDARY_CEILINGS`, which is keyed by FILE.
 * `discovery/list.ts` already holds two cached functions, so a third added to a
 * file already in the registry would change nothing there and declare no
 * ceiling of its own. Pinning the count is what makes that visible. A boundary
 * added to an existing file is exactly as capable of re-opening C-1 as one in a
 * new file, and considerably easier to miss.
 *
 * ⚠ 4 → 5 at ADR-0055 (`discovery/cached-pricing.ts`). ⛔ THE MECHANISM WORKED
 * EXACTLY AS WRITTEN AND IS WORTH RECORDING: that change was developed with the
 * discovery and unit suites green and this guard never run, and CI is what
 * refused it — which is the whole argument for a registry asserted against the
 * source tree rather than a convention about remembering.
 */
export const CACHE_BOUNDARY_DIRECTIVE_COUNT = 5;

type MemoEntry = { url: string; holdUntilMs: number };

const memo = new Map<string, MemoEntry>();

/**
 * How long a URL minted with `ttlSeconds` may be re-served, given that whatever
 * receives it may go on serving it for `downstreamMaxAgeSeconds` afterwards.
 *
 * ⚠ THE RATIO APPLIES TO THE USABLE WINDOW, NOT TO THE WHOLE TTL. That single
 * word is the fix. `ttl × 5/6` reasons about when the signature dies and stops
 * there; it cannot see that the caller's response is still being handed out an
 * hour later, so the two windows overlap and the sum runs past the signature
 * with nothing to notice. Subtracting the downstream window first makes the
 * budget the thing being divided.
 *
 * The invariant `hold + downstream < ttl` is then a THEOREM rather than a
 * tuning. For any `ttl > downstream`:
 *
 *     hold + downstream = (ttl − downstream)·5/6 + downstream
 *                       = ttl − (ttl − downstream)/6
 *                       < ttl                                          ∎
 *
 * No pair of values breaks it, which is the property a fixed ratio could never
 * have. That matters concretely and not just tidily: `DOWNSTREAM_CACHED_SERIES`
 * is derived from `MARKET_SERIES_MIN_WINDOW_MS`, whose own docblock advertises
 * a HARDEN.6 tune — so the ceiling here is not merely movable, it is scheduled
 * to move, and a ratio frozen against today's number would go quietly wrong on
 * the day it does.
 *
 * Returns 0 — memoise NOTHING — when the downstream window meets or exceeds the
 * TTL. Falling back to a mint per call is exactly what this module's absence
 * did, so the degenerate arm is safe by construction rather than by clamping.
 */
export function holdWindowMs(
	ttlSeconds: number,
	downstreamMaxAgeSeconds: number,
): number {
	const usableSeconds = ttlSeconds - downstreamMaxAgeSeconds;
	if (usableSeconds <= 0) {
		return 0;
	}
	return Math.floor(usableSeconds * HOLD_FRACTION * 1000);
}

/**
 * Make room for one more entry. Expired holds go first (they are dead weight
 * either way); if that frees nothing, the oldest insertion is dropped — `Map`
 * iterates in insertion order, so `keys().next()` is the least recently added.
 *
 * Evicting is always SAFE, never a correctness event: a miss re-mints, which is
 * precisely what this module's absence would do on every call.
 */
function evictIfFull(nowMs: number): void {
	if (memo.size < MAX_ENTRIES) {
		return;
	}
	for (const [k, v] of memo) {
		if (v.holdUntilMs <= nowMs) {
			memo.delete(k);
		}
	}
	if (memo.size >= MAX_ENTRIES) {
		const oldest = memo.keys().next();
		if (!oldest.done) {
			memo.delete(oldest.value);
		}
	}
}

/**
 * Return a held URL for `(bucket, key, ttlSeconds, downstreamMaxAgeSeconds)`,
 * or mint one and hold it for as long as that downstream window leaves room
 * for. All four are in the key; see the note at its construction for why the
 * last one has to be.
 *
 * ⚠ THE KEY IS BUILT HERE, NOT BY THE CALLER, and that is a safety property
 * rather than tidiness. Both things the key must separate are rules with
 * consequences, and neither survives being a caller's convention:
 *
 *   - THE TTL. One helper serves a 60-second lifetime and a 7200-second one.
 *     Keyed on the object alone, a render could be handed the short URL and
 *     break a minute later.
 *   - THE BUCKET. `uploads` (participant) and `market-media` (admin-set) are
 *     deliberately separate arms — ADR-0026 and the §1e rule about which
 *     objects an admin path may serve, not a naming convention. Keyed on the
 *     object alone, one arm's URL answers for the other's identically-named
 *     key and quietly defeats it.
 *
 * When the caller passed the key in as a string, both rules were held by a
 * `⚠ MUST` comment and by two independent literals agreeing — the bucket in the
 * prefix and the bucket in the `mint` closure. A one-character edit to either
 * broke the separation silently. Building it here makes both unrepresentable
 * (O-1: structural beats procedural).
 *
 * ⚠ `downstreamMaxAgeSeconds` IS THE WORST CASE OVER EVERY CALLER, not over the
 * nearest one. `loadDebateView` is reached both through `getCachedDebateView`
 * (cached) and directly from the uncached export route; the cached path is what
 * the number has to survive.
 *
 * A throwing `mint()` stores NOTHING — the `set` happens only after the await
 * resolves — so a transient R2 failure is retried on the next call rather than
 * cached as a failure.
 */
export async function memoizedReadUrl(
	bucket: R2Bucket,
	key: string,
	ttlSeconds: number,
	downstreamMaxAgeSeconds: number,
	mint: (signingDate?: Date) => Promise<string>,
): Promise<string> {
	const holdMs = holdWindowMs(ttlSeconds, downstreamMaxAgeSeconds);
	if (holdMs === 0) {
		// The downstream window swallows the whole signature. Holding anything
		// would hand out a URL that is already dead by the time it is read, so
		// this path deliberately becomes a plain mint — no read, no write, no
		// entry occupying a slot that a memoisable object could use.
		//
		// ⚠ AND NO PINNED DATE EITHER. Aligning a signature to a window is only
		// safe while something bounds how long that window's URL may be served,
		// and this arm is the one where nothing does. Signing at a window start
		// here would hand out a URL already partway through its life with no hold
		// to cap it — strictly worse than "now". The degenerate arm stays exactly
		// what this module's absence was.
		return mint();
	}

	// ⚠ THE DOWNSTREAM WINDOW IS PART OF THE KEY, and leaving it out is a subtle
	// version of the bug this whole module was fixed for. An entry stores the
	// hold that was computed when it MISSED. Two call sites sharing an object at
	// one TTL but declaring different downstream windows would share the entry,
	// so whichever missed first would set the hold for both — and a caller
	// sitting behind a long cache could be handed a URL held on the assumption
	// that nobody was caching at all. Keying on it means an entry's
	// `holdUntilMs` is always the one its reader asked for.
	//
	// Not reachable today: every (bucket, key, ttl) in `SHIPPED_HOLD_BUDGET`
	// carries exactly one downstream. It is in the key so that stops being a
	// fact somebody has to re-check.
	const memoKey = `${bucket}:${key}:${ttlSeconds}:${downstreamMaxAgeSeconds}`;
	const nowMs = Date.now();

	// ⚠ THE WINDOW IS `holdMs` WIDE, AND REUSING THAT NUMBER IS THE SAFETY
	// ARGUMENT, not a convenience. `holdWindowMs` is the quantity the theorem
	// above was proved about; aligning signatures to a window of any OTHER size
	// would need its own proof, and would silently not have one.
	const windowStartMs = Math.floor(nowMs / holdMs) * holdMs;

	const hit = memo.get(memoKey);
	if (hit !== undefined && hit.holdUntilMs > nowMs) {
		return hit.url;
	}

	const url = await mint(new Date(windowStartMs));

	evictIfFull(nowMs);
	// ⛔ THE HOLD ENDS AT THE WINDOW'S END, NOT AT `nowMs + holdMs`, AND THE
	// DIFFERENCE IS THE WHOLE CORRECTNESS OF PINNING THE DATE.
	//
	// The signature no longer starts its life when we mint; it starts at
	// `windowStartMs`, which may be almost a full window in the past. Keeping the
	// old `nowMs + holdMs` would therefore let a URL be served for up to TWO
	// windows after it was signed — at the shipped numbers, 2·2750 + 3900 = 9400
	// against a 7200 s signature, i.e. dead for the last thirty-seven minutes,
	// silently, with the mint having succeeded and nothing throwing. That is
	// exactly the C-1 shape this module exists to have closed, re-opened by the
	// change meant to improve it.
	//
	// Ending the hold at the window boundary restores the original theorem
	// verbatim: a URL signed at `windowStartMs` is last served at
	// `windowStartMs + holdMs`, and whatever cache received it serves for
	// `downstreamMaxAgeSeconds` more — so the worst-case age at last read is
	// `hold + downstream < ttl`, unchanged. It also means the entry expires at
	// the same instant the next window begins, which is the moment the URL would
	// change anyway.
	memo.set(memoKey, { url, holdUntilMs: windowStartMs + holdMs });
	return url;
}

/**
 * Drop every held URL. TEST SEAM ONLY — module state outlives a single test
 * file's cases, so without this a test that mints would leak its URL into the
 * next test's assertions and make ordering load-bearing.
 */
export function __resetReadUrlMemo(): void {
	memo.clear();
}
