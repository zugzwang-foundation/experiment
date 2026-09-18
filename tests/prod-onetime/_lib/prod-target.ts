// MKT-ROSTER-1 · ONE-TIME. The PRODUCTION target guard — the inverse of
// `tests/staging/_lib/target.ts`, and the only file in the repository that
// asserts a connection IS production rather than that it is not.
//
// ⛔⛔ THIS BRANCH IS NEVER MERGED. D-49 (`docs/decisions/RECORD-v2.8-amendment.md`)
// authorises ONE pre-launch production run each of the wipe and the restore,
// while every production account is a test account, from a branch that is
// closed unmerged afterwards. ADR-0035 and ADR-0036 carry callouts saying so.
// Everything below exists to make that single run verifiable; none of it is a
// capability the repository keeps.
//
// ⚠ NOTHING HERE IMPORTS FROM, OR EDITS, `tests/staging/_lib/**`. Those files
// are the shipped staging guards and the one thing this lane must not touch —
// a widened refusal on `main` is exactly the outcome the never-merged branch
// exists to avoid. The two constants below are therefore re-declared here, and
// that duplication is deliberate: it keeps the staging refusal single-sourced
// on `main` and lets this whole directory be deleted in one `rm`.
//
// ⚠⚠ THE POLARITY IS DOUBLE-ENDED, AND THAT IS THE POINT. Staging refuses a URL
// that CONTAINS the production ref. This refuses a URL that does NOT contain it
// AND one that DOES contain the staging ref. A mis-set Doppler config therefore
// fails in both directions rather than silently pointing the production tooling
// at staging — which would look like success and destroy the wrong database.

/** Production's Supabase project ref. Re-declared, not imported — see above. */
export const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";

/** Staging's. Present so the guard can refuse it POSITIVELY, not by omission. */
export const STAGING_PROJECT_REF = "rwfdoqzsghqhhdapxafg";

/** The database name every Supabase project reports. */
export const EXPECTED_DATABASE = "postgres";

/** `ZUGZWANG_ENV` as the prd Doppler config sets it. */
export const EXPECTED_ZUGZWANG_ENV = "prod";

export type ProdTargetVerdict =
	| { readonly ok: true; readonly url: string }
	| { readonly ok: false; readonly reason: string };

/**
 * ⛔⛔ A COMMA IN THE AUTHORITY IS REFUSED OUTRIGHT, AND THAT IS A MEASURED
 * BYPASS RATHER THAN A THEORETICAL ONE (`@security-auditor`, MEDIUM).
 * postgres-js treats a comma-separated authority as MULTIHOST and dials the
 * hosts in order, while `new URL(dsn).hostname` returns the WHOLE comma-joined
 * string — so
 * `"evil.example.net,aws-1-…pooler.supabase.com".endsWith(".supabase.com")` is
 * `true` and the driver connects to `evil.example.net`. Nothing downstream would
 * catch it: `current_database()` and `session_replication_role` are trivially
 * satisfiable by any Postgres.
 *
 * ⚠ Refusing the comma is deliberately blunter than parsing the list. This lane
 * has exactly one legitimate DSN and it has no commas, so a multihost URL here is
 * a mistake or an attack either way, and the blunt rule cannot be got round by an
 * ordering the parser did not anticipate.
 *
 * ⚠ The same shape exists on `main` in the shipped staging guard. It is NOT fixed
 * there by this branch — editing those files is the one thing this lane must not
 * do — and is reported as a separate finding.
 */
function isSupabaseHost(host: string): boolean {
	const h = host.toLowerCase();
	if (h.includes(",")) return false;
	return h.endsWith(".supabase.com") || h.endsWith(".supabase.co");
}

/**
 * G-2' · target, from the environment — the mirror of staging's G-2.
 *
 * Reads `DATABASE_URL_PROD` and `ZUGZWANG_ENV`. Refuses unless the URL carries
 * production's ref, does NOT carry staging's, and dials a Supabase host; and
 * unless `ZUGZWANG_ENV` reads exactly `prod`.
 *
 * ⚠ It never falls back to `DATABASE_URL`. The staging guard's own note says
 * why and it applies with more force here: a fallback is a path on which the
 * tool runs against whatever happens to be in the ambient shell.
 */
export function resolveProdTarget(env: NodeJS.ProcessEnv): ProdTargetVerdict {
	const url = env.DATABASE_URL_PROD;
	if (!url) {
		return { ok: false, reason: "DATABASE_URL_PROD is not set; refusing" };
	}
	if (!url.includes(PRODUCTION_PROJECT_REF)) {
		return {
			ok: false,
			reason: `DATABASE_URL_PROD does not contain the production project ref "${PRODUCTION_PROJECT_REF}"; refusing`,
		};
	}
	if (url.includes(STAGING_PROJECT_REF)) {
		return {
			ok: false,
			reason: `DATABASE_URL_PROD contains the STAGING project ref "${STAGING_PROJECT_REF}" — the Doppler config is wrong and this tool would destroy the wrong database; refusing`,
		};
	}
	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		return {
			ok: false,
			reason: "DATABASE_URL_PROD is not a parseable URL; refusing",
		};
	}
	if (!isSupabaseHost(host)) {
		return {
			ok: false,
			reason: `DATABASE_URL_PROD dials "${host}", which is not a Supabase host; refusing`,
		};
	}
	if (env.ZUGZWANG_ENV !== EXPECTED_ZUGZWANG_ENV) {
		return {
			ok: false,
			reason: `ZUGZWANG_ENV is ${JSON.stringify(env.ZUGZWANG_ENV ?? null)}, expected "${EXPECTED_ZUGZWANG_ENV}" — this is not the prd Doppler config; refusing`,
		};
	}
	return { ok: true, url };
}

/** Host only, never the credential. Safe to log. */
export function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}
