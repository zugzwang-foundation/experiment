// Per-VU `x-forwarded-for` header.
//
// ⚠ THIS DOES NOT SPREAD LOAD ACROSS IPs, and the staging campaign first
// assumed it did. The app's limiter reads `x-forwarded-for`, but Vercel's
// edge replaces a client-supplied value before the app sees it, so every
// request from the rig machine lands in ONE rate-limit bucket (staging
// correction C-02). It is kept only so staging and production requests are
// byte-for-byte the shape the staging numbers were measured with.
//
// Consequence for every write test: `betPerIp` (30 requests/minute per IP) is
// what caps successes from a single machine, not the app's capacity.

export function sourceIpForVu(vuId) {
	const b = (vuId >> 16) & 0xff;
	const c = (vuId >> 8) & 0xff;
	const d = vuId & 0xff;
	return `10.${b}.${c}.${d}`;
}

export function withSourceIpHeaders(vuId, extraHeaders) {
	return Object.assign(
		{ "x-forwarded-for": sourceIpForVu(vuId) },
		extraHeaders || {},
	);
}
