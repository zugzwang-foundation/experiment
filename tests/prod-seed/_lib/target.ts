// SEED-1-DUMMY — which database the seed runner may write to.
// NEVER import this from src/**. ADR-0053.
//
// ── WHY THIS IS NOT A WIDENING OF THE STAGING GUARDS ────────────────────────
// `resolveRunnerTarget`, `resolveStagingTarget` and P-17 all refuse the
// production ref first and unconditionally, and they are left exactly as they
// are. This is a SEPARATE resolver for a SEPARATE runner family, and its prod
// mode is a POSITIVE match: the URL must name the production ref, on a Supabase
// host, under `ZUGZWANG_ENV=prod`, with an acknowledgement nothing else in the
// repo sets. Every other combination refuses.
//
// The local and staging modes delegate to the staging resolver AND to P-17's
// check, so a production ref can reach this runner through exactly one door —
// the one that says so out loud.
//
// FAILS CLOSED. No default mode; an unset or unknown mode refuses.

import { checkTestTargetNotProduction } from "../../_setup/production-ref-guard";
import {
	isAllowedStagingHost,
	PRODUCTION_PROJECT_REF,
} from "../../staging/_lib/guards";
import { resolveRunnerTarget } from "../../staging/_lib/target";

export const SEED_TARGET_ENV = "ZUGZWANG_SEED_TARGET";
export const PROD_SEED_ACK_ENV = "ZUGZWANG_PROD_SEED_ACK";
export const PROD_SEED_ACK_VALUE = "seed-dummy-content-on-production";

export type SeedMode = "local" | "staging" | "prod";

export type SeedTarget =
	| {
			readonly ok: true;
			readonly mode: SeedMode;
			readonly url: string;
			/** The project ref the live socket must carry; null for local. */
			readonly ref: string | null;
	  }
	| { readonly ok: false; readonly reason: string };

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/** Pure: takes an env record, never reads `process.env`. */
export function resolveSeedTarget(
	env: Readonly<Record<string, string | undefined>>,
	productionRef: string = PRODUCTION_PROJECT_REF,
): SeedTarget {
	if (!productionRef) {
		return {
			ok: false,
			reason:
				"PRODUCTION_PROJECT_REF is empty; the production match cannot be made. Refusing.",
		};
	}

	const mode = env[SEED_TARGET_ENV];

	if (mode === "local" || mode === "staging") {
		// P-17 first: in these modes a production ref anywhere in the env is the
		// wrong-target case, named as such.
		const p17 = checkTestTargetNotProduction(env, productionRef);
		if (!p17.ok) return p17;
		const staged = resolveRunnerTarget(
			{ ...env, ZUGZWANG_STAGING_TARGET: mode },
			{ requireWriteIntent: true },
		);
		if (!staged.ok) return staged;
		return {
			ok: true,
			mode,
			url: staged.url,
			ref:
				mode === "staging" ? (env.STAGING_PROJECT_REF_FRAGMENT ?? null) : null,
		};
	}

	if (mode !== "prod") {
		return {
			ok: false,
			reason: `${SEED_TARGET_ENV} must be "local", "staging" or "prod" (saw ${
				mode === undefined ? "unset" : JSON.stringify(mode)
			}); refusing. There is deliberately no default.`,
		};
	}

	// ── PROD: every condition, positively ────────────────────────────────────
	if (env[PROD_SEED_ACK_ENV] !== PROD_SEED_ACK_VALUE) {
		return {
			ok: false,
			reason: `${PROD_SEED_ACK_ENV} is not set to the acknowledgement value. This run WRITES PRODUCTION. Invoke it through scripts/seed-prod.ts.`,
		};
	}
	if (env.ZUGZWANG_ENV !== "prod") {
		return {
			ok: false,
			reason: `prod mode requires ZUGZWANG_ENV=prod (saw ${JSON.stringify(env.ZUGZWANG_ENV)}); check the Doppler config is prd.`,
		};
	}
	const url = env.DATABASE_URL;
	if (!url) {
		return {
			ok: false,
			reason: "DATABASE_URL is not set; prod mode has no target.",
		};
	}
	if (!url.includes(productionRef)) {
		return {
			ok: false,
			reason:
				"DATABASE_URL does not name the PRODUCTION project ref; prod mode refuses any other database.",
		};
	}
	const host = hostOf(url);
	if (host === null)
		return {
			ok: false,
			reason: "DATABASE_URL is not a parseable URL; refusing",
		};
	if (!isAllowedStagingHost(host)) {
		return {
			ok: false,
			reason: `DATABASE_URL dials ${JSON.stringify(host)}, which is not a Supabase host; refusing`,
		};
	}
	return { ok: true, mode: "prod", url, ref: productionRef };
}
