import "server-only";
import { mintReadUrl } from "@/server/storage/r2";
import { memoizedReadUrl } from "@/server/storage/read-url-memo";

// Thin wrapper around `mintReadUrl("uploads", key, ttlSeconds)` per
// SCAFFOLD.15 plan §5.1. Two consumers share this seam:
//   - precommitModerate (SCAFFOLD.15) — 60s TTL via READ_URL_TTL_SECONDS_MODERATION
//   - DEBATE.4 render path (future) — 3600s TTL
// Wrapper exists to (i) hide the bucket-id literal at the call site and
// (ii) give DEBATE.4 a stable import for the render path without
// re-deriving the R2 client.
//
// No validation, no DB hit, no fallback — pure forward. R2 unavailability
// throws raw from `mintReadUrl`; caller decides posture (precommit wraps
// into ModerationUnavailableError).
//
// R2-MEMO — the mint is now HELD for a fraction of its own TTL
// (`read-url-memo.ts`). Every call previously produced a fresh signature, so
// the same image arrived under a new URL each render; a browser keys its cache
// on the URL, so each one was a cache MISS and a full re-download of bytes the
// client already had. On `/m/[slug]` that is four times a minute, per tab.
//
// ⚠ THE TTL IS PART OF THE MEMO KEY, and that is load-bearing rather than
// tidy. The TWO consumers named above share this function at DIFFERENT TTLs —
// moderation at 60 s, the render path at 3600 s. Keyed on the object alone, a
// render could be served the 60-second URL and break a minute later, or
// moderation could be served an hour-long one. Keyed on `(key, ttl)` the two
// can never meet.
//
// ⛔ NOT `'use cache'`, and the reason is the safety rule. `cacheLife` is fixed
// per function, so expressing "hold for 5/6 of whatever TTL was passed" would
// need one cached function per TTL — reintroducing exactly the two-numbers-to
// -mistype hazard the fraction rule exists to remove.
//
// Failure posture UNCHANGED: a throwing mint stores nothing, so R2
// unavailability still propagates raw on this and every subsequent call.

export async function signRead(
	key: string,
	ttlSeconds: number,
): Promise<string> {
	return memoizedReadUrl(`uploads:${key}:${ttlSeconds}`, ttlSeconds, () =>
		mintReadUrl("uploads", key, ttlSeconds),
	);
}
