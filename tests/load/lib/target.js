// Where a run points, and what it is allowed to do there.
//
// ⛔ THERE IS NO DEFAULT TARGET. Every staging-era script defaulted to
// staging.zugzwangworld.com, which was harmless while staging was the only
// environment. With production live, a forgotten variable would silently aim
// a ramp at whichever host the default names. So TARGET_URL is required, and a
// host this file does not recognise is refused unless explicitly allowed (for
// a Vercel preview URL, say).

const KNOWN_HOSTS = {
	"staging.zugzwangworld.com": "staging",
	"zugzwangworld.com": "production",
	"www.zugzwangworld.com": "production",
};

function required(name) {
	const value = __ENV[name];
	if (!value) {
		throw new Error(`REFUSED — ${name} is not set`);
	}
	return value;
}

export const TARGET_URL = required("TARGET_URL").replace(/\/+$/, "");

const host = TARGET_URL.replace(/^https?:\/\//, "").split("/")[0];

export const TARGET_ENV = (() => {
	const known = KNOWN_HOSTS[host];
	if (known) {
		return known;
	}
	if (__ENV.ALLOW_UNKNOWN_HOST === "yes") {
		return "other";
	}
	throw new Error(
		`REFUSED — unknown host ${host}. Set ALLOW_UNKNOWN_HOST=yes to target it anyway.`,
	);
})();

/**
 * Production read-rate ceiling.
 *
 * ⛔ THE OLD FIGURE WAS WRONG BY 5x AND THE DEFAULT SAT ON THE WRONG SIDE OF
 * THE LINE. This block read "above ~600-700 req/s from one machine Vercel's
 * abuse protection resets connections (staging correction C-03)" and capped at
 * 600 as though that were safe.
 *
 * Measured against production 2026-09-17: 24 concurrent readers from ONE ip —
 * ~127 req/s — served 300 requests and were then challenged. 12,390 of 12,690
 * requests came back HTTP 403 carrying Vercel's `Security Checkpoint` page, and
 * the IP stayed blocked for the rest of the session, /api/health included.
 *
 * ⚠ IT IS A BURST DETECTOR, NOT A SUSTAINED-RATE THRESHOLD. It fired 2.4
 * seconds in. What matters is how many requests arrive at once from one
 * address, so a ramp that looks gentle in req/s still arrives as a burst and
 * this cap cannot see that shape at all — it only bounds the rate you ask for.
 *
 * ⚠ AND THE FAILURE IS DISGUISED: a challenged request returns in ~300 ms, so
 * it reads as a fast rejection by the app unless something inspects the body.
 * That is very likely what `read/11-ceiling.js` recorded — 2,500 req/s offered,
 * ~59 achieved, 267,184 "dropped iterations", cause never identified. It was
 * the platform, and a checkpoint page is neither a dropped iteration nor an app
 * failure.
 *
 * 100 is chosen to sit well under the measured trip point rather than just
 * below an unmeasured one. Raising it needs a reason, and "the old default was
 * 600" is not one. Real capacity testing needs several machines AND an email to
 * Vercel support naming the window and the source IPs.
 */
export const PRODUCTION_MAX_RATE = Number(__ENV.PRODUCTION_MAX_RATE || "100");

export function assertRateAllowed(rate) {
	if (TARGET_ENV === "production" && rate > PRODUCTION_MAX_RATE) {
		throw new Error(
			`REFUSED — rate ${rate} req/s exceeds PRODUCTION_MAX_RATE=${PRODUCTION_MAX_RATE}. ` +
				"Measured 2026-09-17: ~127 req/s from one IP was challenged after 300 requests, " +
				"and the IP stayed blocked for the session. Above this you measure Vercel's " +
				"Security Checkpoint, not the app. Several machines + an email to Vercel support " +
				"is the supported path. Set PRODUCTION_MAX_RATE higher only on purpose.",
		);
	}
}

/**
 * Write scripts run against staging only. There is no override.
 *
 * ⛔ A WRITE AGAINST PRODUCTION IS PERMANENT. Bets, replies and sells append
 * rows to Bucket-A tables (`bets`, `comments`, `dharma_ledger`, `events`)
 * whose triggers reject UPDATE and DELETE, and those rows ship in the public
 * dataset. Signups consume `identity_pool` tuples, which never return. The
 * session pools these scripts need are minted straight into the database by
 * `tests/staging/mint-bet-sessions.staging.test.ts`, which refuses any
 * database but staging. Staging runs the same code as production, so the
 * write half is re-run there after each production deploy.
 */
export function assertWritesAllowed(script) {
	if (TARGET_ENV !== "staging") {
		throw new Error(
			`REFUSED — ${script} writes permanent data and runs against staging only (target is ${TARGET_ENV}).`,
		);
	}
}
