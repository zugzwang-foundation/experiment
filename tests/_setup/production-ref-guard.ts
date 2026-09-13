// P-17 — the production refusal for EVERY Vitest run, registered as
// `globalSetup` in all three configs (vitest.config.ts, vitest.scale.config.ts,
// vitest.staging.config.ts). NEVER import this from src/**.
//
// WHY A GLOBAL SETUP AND NOT THE FIXTURE. `tests/db/_fixtures/db.ts` refuses
// only an UNSET `DATABASE_URL`, and `tests/_setup/env.ts` defaults it with
// `??=`, which keeps any URL already in the environment. So a run launched
// under the wrong Doppler config reaches whatever that URL names — and several
// files build their own client straight from `process.env.DATABASE_URL`
// without the fixture at all (`tests/db/liquidity-contention.spec.ts`,
// `tests/db/liquidity-injector.spec.ts`,
// `tests/integration/staging-reset-mechanism.integration.test.ts`, among
// others). A check inside any one module protects only that module's readers.
// `globalSetup` runs once in the main process BEFORE any worker is forked and
// before any test file is imported, and every worker inherits the environment
// it inspected — so one check covers every reader, whichever way it reads.
//
// THE PATTERN IS THE STAGING TARGET GUARD'S, NOT A NEW ONE.
// `tests/staging/_lib/target.ts` refuses the production project ref FIRST and
// unconditionally (`:96-97`), then refuses any host it cannot recognise
// (`:193-196`). This file applies the same two rules, with the same constants
// (`PRODUCTION_PROJECT_REF`, `isAllowedStagingHost`, `LOOPBACK_HOSTS`), so the
// production refusal still has exactly one place to be corrected. It widens
// only WHERE the rules look: every environment variable for the ref, and every
// `DATABASE_URL*` variable for the host — because a test can read
// `DATABASE_URL_TXN` as easily as `DATABASE_URL`.
//
// FAILS CLOSED. There is no warning mode and no fallback: an unrecognised host
// is refused rather than assumed safe, because a host this guard cannot name is
// exactly where a production ref could hide.

import {
	isAllowedStagingHost,
	PRODUCTION_PROJECT_REF,
} from "../staging/_lib/guards";
import { LOOPBACK_HOSTS } from "../staging/_lib/target";

export type TestTargetVerdict =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string };

/** `DATABASE_URL`, `DATABASE_URL_TXN`, `DATABASE_URL_STAGING`, `DATABASE_URL_PROD`, … */
const DATABASE_URL_NAME = /^DATABASE_URL(_[A-Z0-9]+)*$/;

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * Decide whether a test process may start.
 *
 * Pure: takes an env record rather than reading `process.env`, the
 * `resolveRunnerTarget` / `resolveStagingTarget` shape, so every branch is
 * unit-testable with no connection and no global mutation. `productionRef` is
 * a parameter only so the empty-deny-list branch can be exercised; callers use
 * the default.
 */
export function checkTestTargetNotProduction(
	env: Readonly<Record<string, string | undefined>>,
	productionRef: string = PRODUCTION_PROJECT_REF,
): TestTargetVerdict {
	// The deny list must not be empty. A blanked ref makes `value.includes(ref)`
	// vacuously true, the refusal meaningless, and the obvious "fix" deleting it.
	// Same guard as `resolveStagingTarget` and `resolveRunnerTarget`.
	if (!productionRef) {
		return {
			ok: false,
			reason:
				"PRODUCTION_PROJECT_REF is empty; the production deny list is not configured. Refusing.",
		};
	}

	// Sorted so the variable a refusal names is stable across platforms.
	const entries = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));

	// ── THE PRODUCTION REFUSAL, FIRST AND UNCONDITIONALLY ────────────────────
	// target.ts `:96-97`, widened from two names to every name. It runs ahead of
	// the host check on purpose (ADR-0035 driver 4): a production URL on an
	// unrecognised host must be reported as the wrong-target case, not as
	// "unrecognised host" — the operator has to be told WHICH failure it was.
	for (const [name, value] of entries) {
		if (value?.includes(productionRef)) {
			return {
				ok: false,
				reason: `${name} contains the PRODUCTION project ref; refusing. A test process must never be pointed at production — check the Doppler config (stg or none, never prd).`,
			};
		}
	}

	// ── EVERY DATABASE URL MUST DIAL A HOST THIS GUARD CAN NAME ──────────────
	// target.ts `:193-196`, plus the loopback set its local mode accepts (`:44`).
	// Positive match only: loopback (local Supabase, CI's service container) or
	// a Supabase host (staging runners). Anything else refuses.
	for (const [name, value] of entries) {
		if (!DATABASE_URL_NAME.test(name) || !value) continue;
		const host = hostOf(value);
		if (host === null) {
			return {
				ok: false,
				reason: `${name} is not a parseable URL; refusing`,
			};
		}
		if (!LOOPBACK_HOSTS.has(host) && !isAllowedStagingHost(host)) {
			return {
				ok: false,
				reason: `${name} dials ${JSON.stringify(host)}, which is neither loopback nor a Supabase host; refusing — the production ref cannot be ruled out on a host this guard does not recognise`,
			};
		}
	}

	return { ok: true };
}

/** Vitest `globalSetup` entry point. Throws, which aborts the run before any test file loads. */
export default function setup(): void {
	const verdict = checkTestTargetNotProduction(process.env);
	if (!verdict.ok) {
		throw new Error(`[production-ref-guard] ${verdict.reason}`);
	}
}
