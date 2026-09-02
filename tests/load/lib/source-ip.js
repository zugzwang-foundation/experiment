// Source-IP strategy per RELAY A2 Part 2 Step 5 and RECON item 13.
//
// CONFIRMED this session (zz_S5-RECON_2026-09-01T1625.md): checkRateLimit's
// identifier is derived from `x-forwarded-for` at the call site
// (src/server/bets/endpoint.ts:extractIp), taken verbatim, first
// comma-separated value, ZERO validation of a trusted-proxy origin. This is
// the favorable branch A2 anticipated — not the HALT branch (a socket-keyed
// limiter would have required stopping here for a founder ruling).
//
// ⚠ RECORD THIS IN EVERY RUN'S PROVENANCE BLOCK — per A2's own instruction —
// because varying this header is ALSO the open go-live finding (S-2):
// anyone can set it, which means this rig's ability to route around
// betPerIp/otpRequestPerIpBurst is the SAME weakness a real abusive client
// could exploit. A run that uses this to avoid tripping the app's own
// limiters has NOT proven the limiters hold against a real distributed
// attacker — it has simply not tested them. State that sentence in every
// report this generates, per A2's own requirement.
//
// ⚠ WHETHER VERCEL'S OWN EDGE PRESERVES, OVERWRITES, OR APPENDS TO A
// CLIENT-SUPPLIED x-forwarded-for BEFORE THE APP CODE SEES IT IS NOT
// ESTABLISHED FROM THIS REPO ALONE — that's a platform-level question this
// session could not verify end-to-end. If a real run shows every request
// landing on the SAME rate-limit bucket despite varying this header per VU,
// that is the answer (Vercel is overriding it), and the finding is more
// urgent than the code-level answer above, not less.

/** Deterministic-but-distinct fake IP per VU, so a given virtual user's own
 * requests share one identity all run long (matching a real client) while
 * different VUs get different identities (simulating distributed source
 * traffic) — never a fresh IP per REQUEST, which would be a different and
 * less realistic thing to test. */
export function sourceIpForVu(vuId) {
	const a = 10;
	const b = (vuId >> 16) & 0xff;
	const c = (vuId >> 8) & 0xff;
	const d = vuId & 0xff;
	return `${a}.${b}.${c}.${d}`;
}

export function withSourceIpHeaders(vuId, extraHeaders) {
	return Object.assign(
		{ "x-forwarded-for": sourceIpForVu(vuId) },
		extraHeaders || {},
	);
}
