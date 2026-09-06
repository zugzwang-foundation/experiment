import "server-only";
import { mintReadUrl } from "@/server/storage/r2";
import { memoizedReadUrl } from "@/server/storage/read-url-memo";

// Thin wrapper around `mintReadUrl("uploads", key, ttlSeconds)` per
// SCAFFOLD.15 plan §5.1. Wrapper exists to (i) hide the bucket-id literal at
// the call site and (ii) give the render paths a stable import without
// re-deriving the R2 client.
//
// FOUR consumers share this seam, at two lifetimes:
//   - precommitModerate            — 60 s, via signReadSingleUse (see below)
//   - admin/moderation/review-feed — 60 s, to an admin's browser
//   - debate-view/load-debate-view — 7200 s, render path
//   - discovery/hero               — 7200 s, render path
//
// No validation, no DB hit, no fallback — pure forward. R2 unavailability
// throws raw from `mintReadUrl`; caller decides posture (precommit wraps into
// ModerationUnavailableError).
//
// R2-MEMO — the mint is HELD for a fraction of the window left AFTER whatever
// cache the caller sits inside has finished serving it (`read-url-memo.ts`).
//
// ⚠ THE CALLER STATES ITS OWN DOWNSTREAM WINDOW, and there is no default. That
// is deliberate: a default would be a guess about someone else's cache, and the
// guess would be silent. Omitting it is a compile error instead, which is the
// only version of this rule that survives a new call site being added by
// someone who has never read this file.
//
// ⛔ NOT `'use cache'` for the hold itself, and the reason is the safety rule.
// `cacheLife` is fixed per function, so expressing "hold for 5/6 of whatever
// window is left" would need one cached function per (ttl, downstream) pair —
// reintroducing exactly the numbers-to-mistype hazard the formula removes.
// Note this says nothing about the CALLERS, three of which are already inside
// such a block; that composition is what `downstreamMaxAgeSeconds` exists to
// account for, and missing it was the whole of C-1.
//
// Failure posture UNCHANGED: a throwing mint stores nothing, so R2
// unavailability still propagates raw on this and every subsequent call.

// ⚠ `cacheControl` IS REQUIRED AND NULLABLE, for the same reason
// `downstreamMaxAgeSeconds` is required: a default would be a guess about
// someone else's surface, and the guess would be silent.
//
// The guess was very nearly made. A first version applied
// `RENDER_IMAGE_CACHE_CONTROL` inside this function to every caller, which
// silently handed the ADMIN MODERATION FEED a year-long browser cache for
// images it signs with a deliberate SIXTY-SECOND TTL (`review-feed.ts`: "Short-
// TTL admin-viewable signed URL"). The signature would still have died on
// schedule, so nothing would have looked wrong — while the reviewing admin's
// browser retained a copy of content it was reviewing precisely because it may
// be harmful. Two of the three callers wanted the directive and the third
// wanted its absence, and no default expresses that.
//
// So the parameter is required, `null` is a statement rather than an omission,
// and a new call site is a compile error until its author decides.
export async function signRead(
	key: string,
	ttlSeconds: number,
	downstreamMaxAgeSeconds: number,
	cacheControl: string | null,
): Promise<string> {
	return memoizedReadUrl(
		"uploads",
		key,
		ttlSeconds,
		downstreamMaxAgeSeconds,
		(signingDate) =>
			mintReadUrl(
				"uploads",
				key,
				ttlSeconds,
				cacheControl ?? undefined,
				signingDate,
			),
	);
}

/**
 * Sign a READ URL that is used ONCE, by a server, and never held.
 *
 * ⛔ THE MODERATION HOP MUST NOT BE MEMOISED, and this function exists so that
 * it cannot be by accident. `precommitModerate` hands the URL to OpenAI for
 * OpenAI's own fetcher to retrieve. There is no browser anywhere on that path,
 * so the memo's entire rationale — a browser keying its cache on the URL — does
 * not apply, and a hold there is pure cost: it spends the 60-second budget
 * `limits.ts` sized for *"OpenAI's 3s call + 1 retry + slack"* before the call
 * is even made, on a gate that fails CLOSED and therefore refuses a
 * participant's bet when it goes wrong.
 *
 * Routing it through the memo with a downstream large enough to zero the hold
 * would have been equivalent arithmetic and a worse rule — it would leave the
 * moderation path one edited argument away from being held again. A separate
 * function states the decision where it cannot be undone by a number.
 *
 * ⚠ FOR THE SAME REASON IT PASSES NO `cacheControl`. `signRead` serves
 * `RENDER_IMAGE_CACHE_CONTROL` so a browser can reuse an image for a year;
 * there is no browser on this path, so the directive would instruct nobody. The
 * omission is the decision, not a gap — if a caching header ever appears here,
 * something has confused a server fetch for a render.
 */
export async function signReadSingleUse(
	key: string,
	ttlSeconds: number,
): Promise<string> {
	return mintReadUrl("uploads", key, ttlSeconds);
}
