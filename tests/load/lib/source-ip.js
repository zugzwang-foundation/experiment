// Per-VU `x-forwarded-for` header.
//
// ⚠ THIS DOES NOT SPREAD LOAD ACROSS IPs, and the staging campaign first
// assumed it did. The app's limiter reads `x-forwarded-for`, but Vercel's
// edge replaces a client-supplied value before the app sees it, so every
// request from the rig machine lands in ONE rate-limit bucket (staging
// correction C-02). It is kept only so staging and production requests are
// byte-for-byte the shape the staging numbers were measured with.
//
// Consequence for every write test: the per-IP bet cap is what limits successes
// from a single machine, not the app's capacity.
//
// ⚠ THAT CAP MOVED AT ADR-0054 (#553) and this comment said 30/min until then.
// The write budget is now counted against the signed-in ACCOUNT at 30/min, with
// the per-IP cap demoted to a looser 300/min backstop. For a single-machine run
// signed in as ONE participant, the binding limit is therefore the per-ACCOUNT
// 30/min — the address no longer matters, which is the whole point of that
// change. Budget write tests against 30/min per account, not 30/min per rig.

export function sourceIpForVu(vuId) {
	const b = (vuId >> 16) & 0xff;
	const c = (vuId >> 8) & 0xff;
	const d = vuId & 0xff;
	return `10.${b}.${c}.${d}`;
}

// ⛔ `accept-encoding: gzip` IS THE LOAD-BEARING HEADER IN THIS FILE, AND ITS
// ABSENCE INVALIDATED HALF THE 2026-09-15 CAMPAIGN. k6 sends no
// `Accept-Encoding` unless told to, so every run before this measured RAW HTML
// off the wire and concluded the rig was bandwidth-bound. Measured against
// production 2026-09-17, raw vs gzip:
//
//   /                     93.9 KB -> 16.9 KB   (5.6x)
//   clean market page    120.3 KB -> 17.5 KB   (6.9x)
//   /sign-in             144.2 KB -> 18.6 KB   (7.8x)
//   a seeded market      723.2 KB -> 39.3 KB  (18.4x)
//
// At ~15 MB/s aggregate that moves the rig's honest ceiling from ~50-70 req/s
// to several hundred on every page, and the seeded markets stop being
// untestable. The binding limit becomes Vercel's abuse protection (~600-700
// req/s) and `PRODUCTION_MAX_RATE`, not the DGX.
//
// ⚠ IT ALSO MEASURES WHAT A READER ACTUALLY RECEIVES. Every real browser sends
// this header, so a run without it was never modelling a visitor — it was
// modelling a client nobody uses, and paying for bytes Vercel never sends.
//
// ⛔ THE FIX PREVIOUSLY EXISTED ONLY ON THE DGX AND WAS LOST ON EVERY REFRESH.
// It was patched into the rig's working copy during the last campaign and never
// committed, while the runbook tells you to overwrite that copy with
// `scp -r tests/load ...`. So the repair deleted itself the next time anyone
// followed the instructions. It lives here now, in the one helper every page
// script already routes through, so a refresh CARRIES it instead of reverting
// it.
export function withSourceIpHeaders(vuId, extraHeaders) {
	return Object.assign(
		{
			"x-forwarded-for": sourceIpForVu(vuId),
			"accept-encoding": "gzip",
		},
		extraHeaders || {},
	);
}
