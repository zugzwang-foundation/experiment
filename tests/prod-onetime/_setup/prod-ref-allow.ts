// MKT-ROSTER-1 · ONE-TIME. The `globalSetup` for `vitest.prod-onetime.config.ts`.
//
// ⛔⛔ THIS FILE IS THE REASON THE CONFIG IS SEPARATE, AND IT IS THE SINGLE MOST
// DANGEROUS LINE IN THE LANE. `tests/_setup/production-ref-guard.ts` is
// registered as `globalSetup` in ALL THREE shipped configs and refuses to start
// when ANY environment variable carries the production project ref. That is
// exactly right, and it is why the restore cannot borrow any shipped config: the
// run would be refused before a worker forked.
//
// So this config gets its own setup, and that setup is NOT "the guard, removed".
// Removing a refusal leaves nothing in its place; this INVERTS it, so the same
// class of mistake still fails closed. The shipped guard refuses production;
// this one refuses STAGING and refuses anything it cannot name.
//
// ⚠ The shipped guard is untouched and keeps protecting all three shipped
// configs. When this branch is closed unmerged, `main` has one production-ref
// rule and it is the refusing one.

const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";
const STAGING_PROJECT_REF = "rwfdoqzsghqhhdapxafg";

/** `DATABASE_URL`, `DATABASE_URL_PROD`, `DATABASE_URL_TXN`, … */
const DATABASE_URL_NAME = /^DATABASE_URL(_[A-Z0-9]+)*$/;

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

export default function setup(): void {
	const env = process.env;

	if (env.ZUGZWANG_ENV !== "prod") {
		throw new Error(
			`REFUSED — ZUGZWANG_ENV is ${JSON.stringify(env.ZUGZWANG_ENV ?? null)}, expected "prod". ` +
				"This config exists to run ONE authorised production restore (D-49) and nothing else.",
		);
	}

	// ⛔⛔ THE INVERSION, AND IT SCANS EVERY VARIABLE FOR THE REF — NOT ONLY
	// `DATABASE_URL*`. The shipped guard it mirrors checks EVERY environment
	// variable for the production ref and only then narrows to `DATABASE_URL*`
	// for the host. A first draft here narrowed both, which made the inversion
	// strictly weaker than the original while claiming to be its mirror: a
	// staging DSN under `POSTGRES_URL` or `SUPABASE_DB_URL` would have passed.
	// `@security-auditor`, LOW. Nothing in this lane reads those names, so this
	// is defence-in-depth — but a file that says it inverts a guard should invert
	// the whole of it.
	for (const [name, value] of Object.entries(env)) {
		if (!value) continue;
		if (value.includes(STAGING_PROJECT_REF)) {
			throw new Error(
				`REFUSED — ${name} carries the STAGING project ref. The production tooling must not be ` +
					"able to reach staging; the Doppler config is wrong.",
			);
		}
	}

	for (const [name, value] of Object.entries(env)) {
		if (!value || !DATABASE_URL_NAME.test(name)) continue;
		// ⚠ NO staging-ref check here — the loop above already throws for ANY
		// variable carrying it, including every `DATABASE_URL*`. A second,
		// near-identical refusal that can never print is an O-3 hazard for whoever
		// debugs a refusal: two messages, only one reachable. Removed
		// (`@code-reviewer`, MEDIUM — introduced by the fix that added loop 1).
		const host = hostOf(value);
		if (host === null) {
			throw new Error(
				`REFUSED — ${name} is not a parseable URL; a host this guard cannot name is refused.`,
			);
		}
		// ⛔ A comma means postgres-js multihost; `endsWith` on the joined string
		// is satisfied by the LAST host while the driver dials the FIRST.
		if (host.includes(",")) {
			throw new Error(
				`REFUSED — ${name} carries a multihost authority ("${host}"); this lane has one legitimate DSN and it has no commas.`,
			);
		}
		if (!host.endsWith(".supabase.com") && !host.endsWith(".supabase.co")) {
			throw new Error(
				`REFUSED — ${name} dials "${host}", which is not a Supabase host.`,
			);
		}
	}

	const prod = env.DATABASE_URL_PROD;
	if (!prod?.includes(PRODUCTION_PROJECT_REF)) {
		throw new Error(
			"REFUSED — DATABASE_URL_PROD is unset or does not carry the production project ref. " +
				"This config has exactly one legitimate target and it must be named positively.",
		);
	}
}
