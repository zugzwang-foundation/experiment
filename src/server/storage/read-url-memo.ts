import "server-only";

/**
 * R2-MEMO — presigned READ URLs, held instead of re-minted.
 *
 * THE DEFECT. `mintReadUrl` produces a fresh presigned URL on every call: the
 * signature embeds a timestamp, so the same object yields a *different* URL
 * each render. `/m/[slug]` re-renders every `POLL_INTERVAL_MS_DEBATE_VIEW`
 * (15 s), so an unchanged image is handed out under a new URL four times a
 * minute — 240 an hour, per open tab. A browser keys its cache on the URL, so
 * every one of those is a cache MISS and a full re-download of bytes the
 * client already has. The signing itself is a local HMAC and costs nothing;
 * the cost is entirely the re-downloads and the storage reads behind them.
 *
 * THE FIX. Hold each minted URL for a FRACTION of its own TTL and return it
 * again while that hold lasts. Same URL ⇒ the browser reuses its cached copy.
 *
 * ⚠ THE HOLD IS A CALCULATION, NEVER A SECOND CONSTANT — and that is the whole
 * safety argument. Two TTLs exist in this codebase:
 *
 *   - `READ_URL_TTL_SECONDS` = 3600 (render paths)
 *   - `READ_URL_TTL_SECONDS_MODERATION` = 60 (`admin/moderation/review-feed.ts`)
 *
 * A hardcoded "hold for 50 minutes" would be correct for the first and
 * catastrophic for the second: it would hand out a 60-second URL that expired
 * forty-nine minutes ago, and admin moderation images would silently stop
 * loading. Deriving the hold from the TTL makes that class of mistake
 * unrepresentable — a shorter TTL automatically gets a shorter hold, with no
 * second number for anyone to forget to update.
 *
 * `5/6` leaves a sixth of the lifetime as margin: 3600 s → held 3000 s (50 min,
 * 10 min spare); 60 s → held 50 s (10 s spare). The margin covers clock skew
 * between this process and R2, and the in-flight time of a response already
 * being streamed when the hold lapses.
 *
 * ⛔ NOT A SECURITY CHANGE. The TTLs themselves are untouched, the buckets stay
 * private, and nothing here widens who can read an object. A held URL is one
 * this process had already minted and served; holding it grants no access that
 * re-minting would not have granted a moment later.
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

type MemoEntry = { url: string; holdUntilMs: number };

const memo = new Map<string, MemoEntry>();

/**
 * How long a URL minted with `ttlSeconds` may be re-served. Exported because
 * the guarantee "the hold always expires strictly before the URL does" is a
 * property worth asserting directly, at both TTLs, rather than inferring from
 * behaviour.
 */
export function holdWindowMs(ttlSeconds: number): number {
	return Math.floor(ttlSeconds * HOLD_FRACTION * 1000);
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
 * Return a held URL for `memoKey`, or mint one via `mint()` and hold it.
 *
 * ⚠ `memoKey` MUST identify the object AND its TTL. Two callers asking for the
 * same object at different TTLs are asking different questions — serving the
 * 60-second moderation URL to a render path expecting an hour would break the
 * render at the fifty-first second. The callers build this key; see
 * `sign-read.ts` and `discovery/media.ts`.
 *
 * A throwing `mint()` stores NOTHING — the `set` happens only after the await
 * resolves — so a transient R2 failure is retried on the next call rather than
 * cached as a failure.
 */
export async function memoizedReadUrl(
	memoKey: string,
	ttlSeconds: number,
	mint: () => Promise<string>,
): Promise<string> {
	const nowMs = Date.now();

	const hit = memo.get(memoKey);
	if (hit !== undefined && hit.holdUntilMs > nowMs) {
		return hit.url;
	}

	const url = await mint();

	evictIfFull(nowMs);
	memo.set(memoKey, { url, holdUntilMs: nowMs + holdWindowMs(ttlSeconds) });
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
