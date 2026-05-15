import { describe, expect, it, vi } from "vitest";

// `computeBodyFingerprint` is pure (no Redis), but its containing module
// imports the singleton Redis client at top-level — which calls
// `Redis.fromEnv()` and prints stderr warnings if Upstash env vars are
// unset. Mock the wrapper to suppress noise; the real client isn't used
// by any test in this file.
vi.mock("@/server/upstash/redis", () => ({
	redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
}));

import { computeBodyFingerprint } from "@/server/idempotency/cache";

// Per SCAFFOLD.4 plan §7.2 — body-fingerprint pure-function tests.
//
// `computeBodyFingerprint` pipeline per plan §F2 line 292:
//   createHash('sha256').update(canonicalize(body), 'utf-8').digest('hex')
//
// The RFC 8785 (JSON Canonicalization Scheme) library guarantees:
//   - lexicographic key sort at every nesting level
//   - UTF-8 byte encoding
//   - ECMA-262 §7.1.12.1 number formatting
//
// These tests assert the externally-observable invariants — caller-shape
// stability is what bet/comment endpoints rely on for cache-hit semantics
// (per plan §1: a cache hit must replay the cached payload verbatim and
// MUST NOT cause re-execution). Fingerprint drift would break INV-1 / INV-2
// indirectly by surfacing false `mismatch` (HTTP 409) on retries.
//
// Pure function — no Redis, no IO. SCAFFOLD.4 substrate-only mocking
// discipline (plan §7 ¶"Mocking discipline") doesn't apply here; this
// file does not import any Upstash module.

describe("body-fingerprint", () => {
	it("body-fingerprint::canonical-key-order-stable", async () => {
		// RFC 8785 §3.2.3: object members sorted by code-point order. Two
		// JSON objects with identical (key, value) pairs in different source
		// orders MUST produce the same canonical encoding, hence the same
		// SHA-256 fingerprint.
		const fpA = await computeBodyFingerprint({ a: 1, b: 2 });
		const fpB = await computeBodyFingerprint({ b: 2, a: 1 });
		expect(fpA).toBe(fpB);
		// Sanity: hex-encoded SHA-256 is 64 lowercase chars.
		expect(fpA).toMatch(/^[0-9a-f]{64}$/);
	});

	it("body-fingerprint::utf-8-encoding", async () => {
		// Non-ASCII content. RFC 8785 §3.2.2.1 requires UTF-8 byte encoding;
		// a wrong-encoding library bug would surface here as fingerprint
		// drift across runs (or as a non-hex digest).
		const fp1 = await computeBodyFingerprint({ comment: "नमस्ते" });
		const fp2 = await computeBodyFingerprint({ comment: "नमस्ते" });
		expect(fp1).toBe(fp2);
		expect(fp1).toMatch(/^[0-9a-f]{64}$/);
		// And distinct from an ASCII variant — proves the bytes feed in.
		const fpAscii = await computeBodyFingerprint({ comment: "hello" });
		expect(fp1).not.toBe(fpAscii);
	});

	it("body-fingerprint::nested-object-canonical", async () => {
		// RFC 8785 §3.2.3 sort applies recursively to every object level.
		// Plan §6 edge-case enumeration makes this load-bearing for
		// nested-payload betting endpoints (e.g. comment body with a media
		// attachment subobject).
		const fp1 = await computeBodyFingerprint({ a: { x: 1, y: 2 } });
		const fp2 = await computeBodyFingerprint({ a: { y: 2, x: 1 } });
		expect(fp1).toBe(fp2);
	});

	it("body-fingerprint::distinct-bodies-distinct-fingerprints", async () => {
		// Sanity floor: structurally distinct values MUST produce distinct
		// fingerprints. A bug that reduced everything to a single hash (e.g.
		// canonicalize returning empty string) would silently corrupt the
		// cache by treating every request as a cache hit — INV-1 / INV-2
		// breach surface.
		const fp1 = await computeBodyFingerprint({ a: 1 });
		const fp2 = await computeBodyFingerprint({ a: 2 });
		expect(fp1).not.toBe(fp2);
	});
});
