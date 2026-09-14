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
 * ⚠ ABOVE ~600-700 req/s FROM ONE MACHINE, VERCEL'S ABUSE PROTECTION RESETS
 * CONNECTIONS (staging correction C-03). Past that point a run measures the
 * platform's defence, not the app, and on production it also risks the rig's
 * IP being challenged while real visitors are arriving. The default cap keeps
 * a production ladder under that line; raise it deliberately, never by default.
 */
export const PRODUCTION_MAX_RATE = Number(__ENV.PRODUCTION_MAX_RATE || "600");

export function assertRateAllowed(rate) {
	if (TARGET_ENV === "production" && rate > PRODUCTION_MAX_RATE) {
		throw new Error(
			`REFUSED — rate ${rate} req/s exceeds PRODUCTION_MAX_RATE=${PRODUCTION_MAX_RATE}. ` +
				"Above ~600-700 req/s from one machine Vercel's abuse protection answers, not the app. " +
				"Set PRODUCTION_MAX_RATE higher only on purpose.",
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
