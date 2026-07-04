import { createHash, randomUUID } from "node:crypto";
import canonicalize from "canonicalize";

import {
	COMPLETED_TTL_SECONDS,
	type CompletedResponse,
	type IdempotencyResult,
	PENDING_SENTINEL_PREFIX,
	PENDING_TTL_SECONDS,
} from "@/server/idempotency/types";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { getRedisKey } from "@/server/upstash/keys";
import { redis } from "@/server/upstash/redis";

// AUDIT-FIX-B3 A4 — the ownership-checked release Lua (the upstash/lock.ts:24-30
// compare-and-* precedent, inline EVAL). Each compares the stored value against
// the caller's OWN pending sentinel (ARGV[1]) before acting, so a >30s straggler
// can neither delete a successor's sentinel/completed response nor clobber a
// successor's state. A mismatch returns 0 (no-op).
const RELEASE_DELETE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

// Promote pending → completed: compare-and-SET the completed JSON (ARGV[2]) with
// the 24h TTL (ARGV[3]). Same ownership guard as the delete.
const RELEASE_PROMOTE_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
else
  return 0
end
`;

/*
 * Body-fingerprint uses RFC 8785 (JSON Canonicalization Scheme) via the
 * `canonicalize` npm package. Hand-rolling RFC 8785 gets number-formatting
 * (ECMA-262 §7.1.12.1) and UTF-8 escape edge cases wrong; the library is
 * 49 LOC, Apache-2.0-licensed, RFC 8785 §3.2.2.3 compliant. Per ADR-0015
 * D5. Apache-2.0 is GPL-compatible per FSF, so no AGPL-3.0 clearance
 * issue with the project's outer license.
 *
 * Pipeline: `canonicalize(body) → SHA-256 over UTF-8 bytes → lowercase
 * hex`. The fingerprint is the disambiguator between a legitimate cache
 * hit (same key, same body) and a body-mismatch attack (same key, mutated
 * body) on cross-endpoint key reuse.
 */

/**
 * Compute the RFC 8785 canonical-JSON SHA-256 hex fingerprint of a
 * request body. Caller passes the JSON-serializable body as-is; the
 * canonicalize library sorts keys at every nesting level, normalizes
 * numbers per ECMA-262, and emits UTF-8 bytes. Fingerprint stability
 * across object key-order, runtime version, and serialization library
 * version is the load-bearing invariant.
 *
 * Throws if `body` is not JSON-serializable (functions, undefined,
 * Symbol, BigInt without a toJSON hook, NaN, Infinity, circular
 * references) — these cases would silently corrupt the fingerprint
 * stability invariant otherwise. canonicalize@3.x throws on NaN /
 * Infinity by design; circular refs throw too.
 */
export async function computeBodyFingerprint(body: unknown): Promise<string> {
	const canonical = canonicalize(body);
	if (canonical === undefined) {
		throw new Error(
			"computeBodyFingerprint: input is not JSON-serializable (returned undefined from canonicalize)",
		);
	}
	return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

/**
 * Single-key-encoding-both-states lookup-or-reserve per SPEC.2 §11
 * ¶"Single-key-encoding-both-states pattern" + ADR-0015 D1/D2/D3 +
 * Q4 ratification (2026-05-15: pending body-mismatch returns the in-
 * flight shape, NOT the completed-mismatch shape).
 *
 * Five-arm tagged union — see `IdempotencyResult` in types.ts for arm
 * semantics. Caller MUST exhaustively discriminate on `kind`.
 *
 * Failure-mode posture: fail-CLOSED on Upstash unreachable per ADR-0006
 * §"Failure-mode profile" + SPEC.2 §11. Any exception in the try block
 * is mapped to `{ kind: 'unavailable' }` and invokes Sentry's
 * `captureException` with tag `upstash_unavailable_idempotency` (verbatim
 * per SPEC.2 §17.3 alarm-6b).
 */
export async function idempotencyLookupOrReserve(
	key: string,
	bodyFingerprint: string,
): Promise<IdempotencyResult> {
	const redisKey = getRedisKey("idem", key);
	try {
		return await tryReserveOrLookup(redisKey, bodyFingerprint, true);
	} catch (err) {
		// Tag `upstash_unavailable_idempotency` per SPEC.2 §17.3 alarm-6b. AUDIT-FIX-B3
		// (B1 ruling #8): route through the fail-open safeCaptureException — this sits
		// OUTSIDE the endpoint's try (endpoint.ts), so a raw captureException throw
		// here would escape idempotencyLookupOrReserve and 500 a request the
		// fail-closed contract means to surface as a clean 503.
		safeCaptureException(err, {
			tags: { kind: "upstash_unavailable_idempotency" },
		});
		return { kind: "unavailable", error: err };
	}
}

async function tryReserveOrLookup(
	redisKey: string,
	bodyFingerprint: string,
	allowRaceRetry: boolean,
): Promise<IdempotencyResult> {
	// AUDIT-FIX-B3 A4 — the reservation sentinel gains an owner token
	// (`PENDING:{fingerprint}:{token}`, token = randomUUID per lock.ts) so the
	// ownership-checked release can only ever touch OUR OWN sentinel.
	const token = randomUUID();
	const pendingValue = `${PENDING_SENTINEL_PREFIX}${bodyFingerprint}:${token}`;
	const reservation = await redis.set(redisKey, pendingValue, {
		nx: true,
		ex: PENDING_TTL_SECONDS,
	});
	if (reservation === "OK") {
		return {
			kind: "miss",
			release: async (response) => {
				// AUDIT-FIX-B3 A4 — ownership-checked (the lock.ts compare-and-* Lua)
				// + NEVER throws. release(null) compare-and-DELETEs; release(completed)
				// compare-and-SETs the completed JSON with the 24h TTL. If our sentinel
				// already expired and was re-reserved, the GET != pendingValue → the
				// guarded op no-ops (lost cache optimization only — the durable receipt
				// answers the replay). Any Redis error routes through the fail-open
				// safeCaptureException (the ADR-0015 §3 completion-write alarm half,
				// `site: release`) and RETURNS: a completion-write failure must never
				// supersede the already-built (committed) response. Post-failure the
				// sentinel dangles ≤ PENDING_TTL_SECONDS (a retry gets 409 in-flight);
				// after expiry it re-executes and the durable layer resolves it.
				try {
					if (response === null) {
						await redis.eval(RELEASE_DELETE_LUA, [redisKey], [pendingValue]);
						return;
					}
					await redis.eval(
						RELEASE_PROMOTE_LUA,
						[redisKey],
						[
							pendingValue,
							JSON.stringify(response),
							String(COMPLETED_TTL_SECONDS),
						],
					);
				} catch (err) {
					safeCaptureException(err, {
						tags: {
							kind: "upstash_unavailable_idempotency",
							site: "release",
						},
					});
				}
			},
		};
	}

	// SET NX returned null → key already exists. Inspect it.
	const existing = await redis.get<string>(redisKey);
	if (existing === null || existing === undefined) {
		// Race: key expired between our SET NX and our GET. Retry the
		// reserve-or-lookup once. SETNX wins-or-losses converge.
		if (allowRaceRetry) {
			return tryReserveOrLookup(redisKey, bodyFingerprint, false);
		}
		// Two-attempt convergence failed. Treat as unreachable so the
		// caller surfaces a clean 503 rather than fabricating a 'miss'
		// arm (which would be unsound — we couldn't observe the cache
		// state). Outer catch maps this to `{ kind: 'unavailable' }`.
		throw new Error(
			"idempotencyLookupOrReserve: SETNX race-retry exhausted; cache state unobservable",
		);
	}

	if (existing.startsWith(PENDING_SENTINEL_PREFIX)) {
		// AUDIT-FIX-B3 A4 — the value is now `${PREFIX}${fingerprint}:${token}`;
		// extract the fingerprint as the segment between the prefix and the LAST
		// colon (the fingerprint is hex and the token is a UUID — neither carries a
		// colon, so there is exactly one separator; `lastIndexOf` is robust anyway).
		const rest = existing.slice(PENDING_SENTINEL_PREFIX.length);
		const lastColon = rest.lastIndexOf(":");
		const heldFingerprint = lastColon === -1 ? rest : rest.slice(0, lastColon);
		// Per Q4 (2026-05-15): pending arm returns 'pending' regardless of
		// whether `bodyFingerprint` matches `heldFingerprint`. Body-mismatch
		// on a pending sentinel maps to the in-flight collision shape (HTTP
		// 409 `error_idempotency_in_flight + Retry-After: 2`), NOT the
		// completed-mismatch shape — the still-pending request may yet
		// complete with a body that matches the eventual retry, and
		// surfacing two different errors mid-flight would confuse client
		// retry policy.
		return { kind: "pending", heldFingerprint };
	}

	const cached = JSON.parse(existing) as CompletedResponse;
	if (cached.bodyFingerprint === bodyFingerprint) {
		return { kind: "hit", cachedResponse: cached };
	}
	return { kind: "mismatch", cachedFingerprint: cached.bodyFingerprint };
}
