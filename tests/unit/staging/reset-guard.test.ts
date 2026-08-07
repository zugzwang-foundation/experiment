import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	isAllowedStagingHost,
	MIN_FRAGMENT_LENGTH,
	PRODUCTION_PROJECT_REF,
	RESET_INTENT_ENV,
	RESET_INTENT_VALUE,
	resolveStagingTarget,
} from "../../staging/_lib/guards";

// STAGING-PARITY Slice A §5.6 tests-first — the G-1 (target) + G-2
// (environment) halves of ADR-0035 primitive 6, which are pure and therefore
// unit-testable. G-3 (live connection) and G-4 (post-run verification) need a
// socket and are exercised by tests/integration/staging-reset-mechanism.
//
// Ratification Record §5 W-B is what this file is built to, not Q3's single
// row: "The wrong-target case deserves the same weight as the guard-list
// constant: a unit-tested predicate with its own assertions, not one row in a
// failure table." Three W-B additions are asserted here — fail-closed on
// absence, never fall back to DATABASE_URL, positive `"staging"` match.
//
// The predicate takes an env RECORD rather than reading process.env, so every
// case below is a pure call with no global mutation and no cleanup ordering.

// The REAL staging shape: a Supabase SESSION POOLER DSN. The project ref is a
// bare 20-character string that appears in the USERNAME (`postgres.<ref>`) and
// NOT in the pooler hostname — verified read-only against the live staging
// target on 2026-08-05. An earlier fixture here used a `?host=<ref>.supabase.co`
// query parameter, which postgres-js ignores entirely (it takes the host from
// `url.hostname`); that fixture made a host-only G-3 check look satisfiable
// when against the real target it would have refused every legitimate run.
// @code-reviewer flagged it at Slice A. Keep unit fixtures and the live target
// in the same shape.
const STAGING_FRAGMENT = "abcdefghijklmnopqrst";
const STAGING_URL = `postgresql://postgres.${STAGING_FRAGMENT}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;

function stagingEnv(
	overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
	return {
		DATABASE_URL_STAGING: STAGING_URL,
		STAGING_PROJECT_REF_FRAGMENT: STAGING_FRAGMENT,
		ZUGZWANG_ENV: "staging",
		[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		...overrides,
	};
}

describe("resolveStagingTarget — G-1 target", () => {
	it("accepts a correct staging pair", () => {
		const result = resolveStagingTarget(stagingEnv());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.url).toBe(STAGING_URL);
			expect(result.fragment).toBe(STAGING_FRAGMENT);
		}
	});

	it("refuses when DATABASE_URL_STAGING is unset", () => {
		const result = resolveStagingTarget(
			stagingEnv({ DATABASE_URL_STAGING: undefined }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/DATABASE_URL_STAGING/);
	});

	it("refuses when DATABASE_URL_STAGING is set but empty", () => {
		const result = resolveStagingTarget(
			stagingEnv({ DATABASE_URL_STAGING: "" }),
		);
		expect(result.ok).toBe(false);
		// MUTATION-DERIVED (G1-a, 2026-08-06). Asserting only `ok === false` let
		// this pass with the `!url` refusal deleted: an empty string reaches the
		// fragment check and is refused as "does not contain" instead. A true
		// verdict for the wrong reason is the silent-weakening shape Q-I closed
		// everywhere else. Pin the reason, so the empty case is owned by the
		// check that names it.
		if (!result.ok) expect(result.reason).toMatch(/is not set/);
	});

	it("refuses when STAGING_PROJECT_REF_FRAGMENT is unset", () => {
		const result = resolveStagingTarget(
			stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: undefined }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.reason).toMatch(/STAGING_PROJECT_REF_FRAGMENT/);
	});

	it("refuses when STAGING_PROJECT_REF_FRAGMENT is set but empty", () => {
		// An empty fragment would make `url.includes(fragment)` vacuously true —
		// the one input that turns the target guard into a no-op.
		const result = resolveStagingTarget(
			stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "" }),
		);
		expect(result.ok).toBe(false);
		// MUTATION-DERIVED (G1-b): with the `!fragment` refusal deleted, "" is
		// refused by the length check instead — same verdict, different owner.
		// Both reasons name the variable, so match the phrase, not the name.
		if (!result.ok) expect(result.reason).toMatch(/is not set/);
	});

	it("refuses a URL that does not contain the fragment", () => {
		const result = resolveStagingTarget(
			stagingEnv({
				DATABASE_URL_STAGING:
					"postgresql://postgres:pw@someotherhost.supabase.com:5432/postgres",
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/does not contain/i);
	});

	it("refuses a URL containing the production project ref", () => {
		const result = resolveStagingTarget(
			stagingEnv({
				DATABASE_URL_STAGING: `postgresql://postgres:pw@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`,
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});

	it("reports production even when nothing else is configured", () => {
		// Ordering property, not a duplicate: the production check runs ahead of
		// every lesser check, so a prod URL is never reported as merely
		// "fragment unset" or "fragment mismatch". A true refusal with a
		// misleading reason is a wrong-target run the operator retries.
		const result = resolveStagingTarget({
			DATABASE_URL_STAGING: `postgresql://postgres:pw@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`,
			[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});

	it("refuses the production ref even when the staging fragment is also present", () => {
		// The belt-and-braces case: a URL that satisfies the fragment check but
		// still names prod must lose. Prod refusal is not conditional on the
		// fragment check failing first.
		const result = resolveStagingTarget(
			stagingEnv({
				DATABASE_URL_STAGING: `${STAGING_URL}&other=db.${PRODUCTION_PROJECT_REF}.supabase.co`,
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});
});

describe("resolveStagingTarget — G-2 environment", () => {
	it('refuses when ZUGZWANG_ENV is unset (positive match, not "is not prod")', () => {
		const result = resolveStagingTarget(
			stagingEnv({ ZUGZWANG_ENV: undefined }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/ZUGZWANG_ENV/);
	});

	it('refuses ZUGZWANG_ENV="unknown"', () => {
		const result = resolveStagingTarget(
			stagingEnv({ ZUGZWANG_ENV: "unknown" }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/ZUGZWANG_ENV/);
	});

	it('refuses ZUGZWANG_ENV="prod"', () => {
		const result = resolveStagingTarget(stagingEnv({ ZUGZWANG_ENV: "prod" }));
		expect(result.ok).toBe(false);
	});

	it('refuses ZUGZWANG_ENV="preview"', () => {
		const result = resolveStagingTarget(
			stagingEnv({ ZUGZWANG_ENV: "preview" }),
		);
		expect(result.ok).toBe(false);
	});

	it('refuses a case-variant "STAGING" — the match is exact', () => {
		const result = resolveStagingTarget(
			stagingEnv({ ZUGZWANG_ENV: "STAGING" }),
		);
		expect(result.ok).toBe(false);
	});
});

describe("resolveStagingTarget — never falls back to DATABASE_URL", () => {
	it("refuses when only DATABASE_URL is set, even if it looks like staging", () => {
		// W-B addition 1: "the reset must not be able to inherit a connection
		// string from ambient environment." DATABASE_URL is what every other
		// tool in the repo reads, so the ambient value is nearly always present.
		const result = resolveStagingTarget({
			DATABASE_URL: STAGING_URL,
			STAGING_PROJECT_REF_FRAGMENT: STAGING_FRAGMENT,
			ZUGZWANG_ENV: "staging",
			[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/DATABASE_URL_STAGING/);
	});

	it("never returns the DATABASE_URL value as the resolved target", () => {
		const localUrl = "postgresql://postgres:postgres@localhost:54322/postgres";
		const result = resolveStagingTarget({
			...stagingEnv(),
			DATABASE_URL: localUrl,
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.url).not.toBe(localUrl);
	});

	it("refuses a local Postgres URL outright", () => {
		const result = resolveStagingTarget(
			stagingEnv({
				DATABASE_URL_STAGING:
					"postgresql://postgres:postgres@localhost:54322/postgres",
			}),
		);
		expect(result.ok).toBe(false);
	});
});

describe("resolveStagingTarget — fragment shape (anti-vacuity)", () => {
	// A free-substring match is only as strong as the substring. The natural
	// operator remedy for a refusing fragment is to SHORTEN it until it passes,
	// which walks straight to a guard that matches everything.
	// @security-auditor, Slice A.

	it('refuses "postgres" — true of every Postgres DSN ever written', () => {
		const result = resolveStagingTarget(
			stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "postgres" }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/fragment/i);
	});

	it('refuses "supabase"', () => {
		const result = resolveStagingTarget(
			stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: "supabase" }),
		);
		expect(result.ok).toBe(false);
	});

	it("refuses anything shorter than the minimum", () => {
		const short = "a".repeat(MIN_FRAGMENT_LENGTH - 1);
		const result = resolveStagingTarget({
			...stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: short }),
			DATABASE_URL_STAGING: `postgresql://postgres.${short}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
		});
		expect(result.ok).toBe(false);
	});

	it("refuses a hostname-shaped fragment — the shape .env.example used to document", () => {
		// "<ref>.supabase.co" cannot appear in a pooler DSN at all, so an
		// operator following the old example got a refusal and would then
		// shorten it. Rejected on the dot.
		const result = resolveStagingTarget(
			stagingEnv({
				STAGING_PROJECT_REF_FRAGMENT: `${STAGING_FRAGMENT}.supabase.co`,
			}),
		);
		expect(result.ok).toBe(false);
	});

	// MUTATION-DERIVED (G1-f, 2026-08-06). Deleting `/^[a-z0-9]+$/` from the
	// guard left all 32 cases in this file GREEN — the alphanumeric half of the
	// shape check was asserted by NOTHING.
	//
	// Why the case above did not catch it: `<ref>.supabase.co` is not a
	// substring of a pooler DSN, so with the regex gone it is still refused, by
	// `url.includes(fragment)` instead. Every existing non-alphanumeric fixture
	// had that same property. To reach the regex, the fragment must be
	// long enough, non-alphanumeric, AND genuinely present in the URL — which is
	// exactly what an operator produces by pasting a chunk of the DSN.
	it.each([
		["a DSN slice carrying the user prefix", `postgres.${STAGING_FRAGMENT}`],
		["the pooler hostname itself", "aws-1-ap-south-1.pooler.supabase.com"],
	])("refuses a non-alphanumeric fragment that IS present in the URL — %s", (_label, fragment) => {
		// Precondition: only the alphanumeric rule can refuse these.
		expect(fragment.length).toBeGreaterThanOrEqual(MIN_FRAGMENT_LENGTH);
		expect(STAGING_URL).toContain(fragment);

		const result = resolveStagingTarget(
			stagingEnv({ STAGING_PROJECT_REF_FRAGMENT: fragment }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/alphanumeric/i);
	});

	it("accepts a real 20-character project ref", () => {
		expect(STAGING_FRAGMENT).toHaveLength(20);
		expect(resolveStagingTarget(stagingEnv()).ok).toBe(true);
	});
});

describe("resolveStagingTarget — G-5 intent / watch-mode refusal", () => {
	// Every other guard proves WHERE the connection goes; none proves the
	// operator meant to run a destructive wipe right now. In a doppler stg
	// shell — where the operator lives for Slices B-D — a bare
	// `vitest --config vitest.staging.config.ts` is watch mode: wipe, then
	// re-wipe on every file save.

	it("refuses when the acknowledgement is unset", () => {
		const result = resolveStagingTarget(
			stagingEnv({ [RESET_INTENT_ENV]: undefined }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(new RegExp(RESET_INTENT_ENV));
	});

	it("refuses a wrong acknowledgement value", () => {
		const result = resolveStagingTarget(
			stagingEnv({ [RESET_INTENT_ENV]: "yes" }),
		);
		expect(result.ok).toBe(false);
	});

	it("accepts only the exact value", () => {
		expect(resolveStagingTarget(stagingEnv()).ok).toBe(true);
	});
});

describe("isAllowedStagingHost", () => {
	// The fragment lives in the USERNAME on the pooler, so it constrains the
	// user, not the destination: a localhost DSN carrying the staging ref as
	// its user satisfies the fragment match. G-3 constrains the host too.

	it("accepts the session pooler and the direct host", () => {
		expect(isAllowedStagingHost("aws-1-ap-south-1.pooler.supabase.com")).toBe(
			true,
		);
		expect(isAllowedStagingHost(`db.${STAGING_FRAGMENT}.supabase.co`)).toBe(
			true,
		);
	});

	it("refuses loopback and arbitrary hosts", () => {
		for (const host of [
			"localhost",
			"127.0.0.1",
			"::1",
			"evil.example.com",
			"supabase.co.attacker.net",
		]) {
			expect({ host, allowed: isAllowedStagingHost(host) }).toEqual({
				host,
				allowed: false,
			});
		}
	});
});

describe("PRODUCTION_PROJECT_REF — the refusal path (ruling 3)", () => {
	// WHAT THESE TESTS PROVE, precisely — the earlier framing called this "the
	// liveness check", which overstated it (Q-A, 2026-08-06):
	//
	//   THEY DO prove the refusal PATH works, and they catch a constant that
	//   has been blanked, truncated, or replaced with placeholder text.
	//   THEY DO NOT detect ROTATION. The synthetic URLs below INTERPOLATE
	//   PRODUCTION_PROJECT_REF, so they are satisfied by whatever value the
	//   constant holds — including a stale one left behind by a Supabase
	//   project restore. A test cannot close that gap without a second copy of
	//   the literal, which would not detect rotation either and would cost the
	//   single-constant property the docblock relies on.
	//
	// Rotation is a PROCESS control, not a test: the runbook docket row
	// "Supabase project restore or ref change -> update PRODUCTION_PROJECT_REF
	// and re-verify the guard" owns it. And the name-based refusal is the
	// SECOND net regardless — G-1's positive fragment match is the primary
	// protection, and it is not name-based.

	it("has the shape of a Supabase project ref", () => {
		// Catches blanking, truncation and placeholder text without duplicating
		// the value.
		expect(PRODUCTION_PROJECT_REF).toMatch(/^[a-z0-9]{20}$/);
	});

	it("is the SINGLE code constant — the guard interpolates it, never a literal", () => {
		// If a second copy of the ref were ever pasted into the guard, rotating
		// the constant would leave the copy behind, silently un-protecting.
		const guardSource = readFileSync(
			fileURLToPath(new URL("../../staging/_lib/guards.ts", import.meta.url)),
			"utf8",
		);
		const occurrences = guardSource.split(PRODUCTION_PROJECT_REF).length - 1;
		expect(occurrences).toBe(1);
	});

	it("refuses a synthetic PRODUCTION session-pooler URL", () => {
		// The real shape a mis-set Doppler config would produce: `prd` instead
		// of `stg`, so the pooler username carries the PRODUCTION ref.
		const prodUrl = `postgresql://postgres.${PRODUCTION_PROJECT_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
		const result = resolveStagingTarget(
			stagingEnv({ DATABASE_URL_STAGING: prodUrl }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});

	it("refuses a synthetic PRODUCTION direct-host URL", () => {
		const prodUrl = `postgresql://postgres:pw@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`;
		const result = resolveStagingTarget(
			stagingEnv({ DATABASE_URL_STAGING: prodUrl }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});

	it("refuses the production URL even with a valid staging fragment configured", () => {
		// The wrong-target case that matters most: everything else is correct,
		// only the URL is prod.
		const prodUrl = `postgresql://postgres.${PRODUCTION_PROJECT_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
		const result = resolveStagingTarget({
			DATABASE_URL_STAGING: prodUrl,
			STAGING_PROJECT_REF_FRAGMENT: STAGING_FRAGMENT,
			ZUGZWANG_ENV: "staging",
			[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toMatch(/production/i);
	});
});
