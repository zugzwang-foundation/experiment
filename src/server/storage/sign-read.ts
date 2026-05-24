import "server-only";
import { mintReadUrl } from "@/server/storage/r2";

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

export async function signRead(
	key: string,
	ttlSeconds: number,
): Promise<string> {
	return mintReadUrl("uploads", key, ttlSeconds);
}
