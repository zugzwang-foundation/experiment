import { describe, expect, it } from "vitest";
import {
	PRODUCTION_PROJECT_REF,
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
