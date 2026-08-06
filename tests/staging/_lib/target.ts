// STAGING-PARITY Slice B — the target resolver shared by the generator and the
// gates runner. Ratified by ADR-0035 (guard contract shape) and ADR-0036
// (Vitest-context operational runners). NEVER import this from src/**.
//
// WHY A SECOND RESOLVER AND NOT `resolveStagingTarget`. The reset has exactly
// one legal target — staging — and `resolveStagingTarget` is written to admit
// nothing else. The generator has TWO: staging, and the LOCAL Postgres it must
// be proved against before staging is ever touched (Slice B STEPs 2/3/5).
// Widening the reset's guard to admit localhost would weaken the artifact whose
// whole job is refusing every target but one. So this is a separate resolver
// with its own contract, and it REUSES the reset's constants —
// PRODUCTION_PROJECT_REF, MIN_FRAGMENT_LENGTH, isAllowedStagingHost — so the
// production refusal still has exactly one place to be corrected.
//
// FAILS CLOSED EVERYWHERE. There is no default mode: an unset
// ZUGZWANG_STAGING_TARGET refuses rather than picking one. `local` refuses
// anything that is not loopback; `staging` refuses anything that is not the
// configured staging ref on a Supabase host. Both refuse the production ref
// unconditionally and first.

import {
	isAllowedStagingHost,
	MIN_FRAGMENT_LENGTH,
	PRODUCTION_PROJECT_REF,
} from "./guards";

/**
 * G-5 analogue for the WRITING runner. `pnpm staging:generate` sets it and
 * nothing else in the repo does.
 *
 * The gates runner deliberately does NOT require it: gates only read, and
 * demanding a destructive-intent token for a read-only run trains the operator
 * to export the token into their shell — which is the exact decay ADR-0035
 * Addendum A.1 describes. A token that is only ever needed for writes keeps
 * meaning "I meant to write".
 */
export const GENERATE_INTENT_ENV = "ZUGZWANG_STAGING_WRITE_ACK";
export const GENERATE_INTENT_VALUE = "generate-staging-fixtures";

/** Which database an operational runner is pointed at. Never defaulted. */
export const TARGET_MODE_ENV = "ZUGZWANG_STAGING_TARGET";

/** Hosts `local` mode will accept. Anything else refuses. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type RunnerTarget =
	| {
			readonly ok: true;
			readonly mode: "local" | "staging";
			readonly url: string;
	  }
	| { readonly ok: false; readonly reason: string };

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * Resolve the database an operational runner may use.
 *
 * `requireWriteIntent` is set by the GENERATOR and cleared by the GATES.
 * Pure: takes an env record rather than reading `process.env`, so it is
 * exhaustively unit-testable with no global mutation — the
 * `resolveStagingTarget` shape.
 */
export function resolveRunnerTarget(
	env: Readonly<Record<string, string | undefined>>,
	opts: { readonly requireWriteIntent: boolean },
): RunnerTarget {
	// Same non-empty deny-list guard as the reset: a blanked constant makes
	// `url.includes(ref)` vacuously true and the refusal below meaningless.
	if (!PRODUCTION_PROJECT_REF) {
		return {
			ok: false,
			reason:
				"PRODUCTION_PROJECT_REF is empty; the production deny list is not configured. Refusing.",
		};
	}

	const mode = env[TARGET_MODE_ENV];
	if (mode !== "local" && mode !== "staging") {
		return {
			ok: false,
			reason: `${TARGET_MODE_ENV} must be "local" or "staging" (saw ${
				mode === undefined ? "unset" : JSON.stringify(mode)
			}); refusing. There is deliberately no default.`,
		};
	}

	if (
		opts.requireWriteIntent &&
		env[GENERATE_INTENT_ENV] !== GENERATE_INTENT_VALUE
	) {
		return {
			ok: false,
			reason: `${GENERATE_INTENT_ENV} is not set to the acknowledgement value. This run WRITES fixture data. Invoke it as: pnpm staging:generate`,
		};
	}

	if (mode === "local") {
		const url = env.DATABASE_URL;
		if (!url) {
			return {
				ok: false,
				reason:
					"DATABASE_URL is not set; local mode has no target. Start the local Supabase stack.",
			};
		}
		// Checked FIRST and unconditionally, ahead of every lesser check — the
		// ADR-0035 ordering. A prod URL smuggled into DATABASE_URL must be
		// reported as the wrong-target case, not as "not loopback".
		if (url.includes(PRODUCTION_PROJECT_REF)) {
			return {
				ok: false,
				reason:
					"DATABASE_URL contains the PRODUCTION project ref; refusing. This is the wrong-target case.",
			};
		}
		const host = hostOf(url);
		if (host === null) {
			return {
				ok: false,
				reason: "DATABASE_URL is not a parseable URL; refusing",
			};
		}
		// Positive match, not a negation: only loopback passes. A remote host
		// that merely fails to look like production still refuses here.
		if (!LOOPBACK_HOSTS.has(host)) {
			return {
				ok: false,
				reason: `local mode requires a loopback DATABASE_URL (saw host ${JSON.stringify(host)}); refusing`,
			};
		}
		// Belt: loopback already excludes it, but a hosts-file entry or an SSH
		// tunnel could map a Supabase name onto 127.0.0.1. Say no twice.
		if (isAllowedStagingHost(host)) {
			return {
				ok: false,
				reason: `local mode refuses a Supabase host (${host})`,
			};
		}
		return { ok: true, mode: "local", url };
	}

	// mode === "staging" — the ADR-0035 G-1 + G-2 contract, unchanged.
	const url = env.DATABASE_URL_STAGING;
	const fragment = env.STAGING_PROJECT_REF_FRAGMENT;
	if (!url) {
		return {
			ok: false,
			reason:
				"DATABASE_URL_STAGING is not set. Run under: doppler run --project zugzwang-experiment --config stg -- …",
		};
	}
	if (url.includes(PRODUCTION_PROJECT_REF)) {
		return {
			ok: false,
			reason:
				"DATABASE_URL_STAGING contains the PRODUCTION project ref; refusing. Check the Doppler config (stg, never prd).",
		};
	}
	if (!fragment) {
		return {
			ok: false,
			reason:
				"STAGING_PROJECT_REF_FRAGMENT is not set; cannot verify the URL is staging",
		};
	}
	if (fragment.length < MIN_FRAGMENT_LENGTH || !/^[a-z0-9]+$/.test(fragment)) {
		return {
			ok: false,
			reason: `STAGING_PROJECT_REF_FRAGMENT must be at least ${MIN_FRAGMENT_LENGTH} lowercase alphanumeric characters; a short or generic fragment matches every Postgres DSN. Refusing.`,
		};
	}
	if (!url.includes(fragment)) {
		return {
			ok: false,
			reason: `DATABASE_URL_STAGING does not contain STAGING_PROJECT_REF_FRAGMENT ("${fragment}"); refusing`,
		};
	}
	if (env.ZUGZWANG_ENV !== "staging") {
		return {
			ok: false,
			reason: `ZUGZWANG_ENV must equal "staging" (saw ${
				env.ZUGZWANG_ENV === undefined ? "unset" : `"${env.ZUGZWANG_ENV}"`
			}); refusing`,
		};
	}
	return { ok: true, mode: "staging", url };
}
