import { describe, expect, it } from "vitest";

import { resolveSeedTarget } from "../../prod-seed/_lib/target";
import { PRODUCTION_PROJECT_REF } from "../../staging/_lib/guards";

// SEED-1-DUMMY — ADR-0053. The prod mode is a POSITIVE match; every other
// combination refuses, and the local/staging modes keep P-17's refusal.

const REF = PRODUCTION_PROJECT_REF;
const PROD_URL = `postgresql://postgres.${REF}:not-a-password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
const STAGING_REF = "abcdefghijklmnopqrst";
const STAGING_URL = `postgresql://postgres.${STAGING_REF}:not-a-password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;

const prodEnv = {
	ZUGZWANG_SEED_TARGET: "prod",
	ZUGZWANG_PROD_SEED_ACK: "seed-dummy-content-on-production",
	ZUGZWANG_ENV: "prod",
	DATABASE_URL: PROD_URL,
};

function reason(env: Record<string, string | undefined>, ref?: string): string {
	const t = resolveSeedTarget(env, ref);
	return t.ok ? "" : t.reason;
}

describe("prod mode", () => {
	it("admits the production ref with every condition met (positive control)", () => {
		const t = resolveSeedTarget(prodEnv);
		expect(t).toEqual({ ok: true, mode: "prod", url: PROD_URL, ref: REF });
	});

	it("refuses without the acknowledgement", () => {
		expect(reason({ ...prodEnv, ZUGZWANG_PROD_SEED_ACK: undefined })).toMatch(
			/acknowledgement/,
		);
		expect(reason({ ...prodEnv, ZUGZWANG_PROD_SEED_ACK: "yes" })).toMatch(
			/acknowledgement/,
		);
	});

	it("refuses unless ZUGZWANG_ENV is prod", () => {
		expect(reason({ ...prodEnv, ZUGZWANG_ENV: "staging" })).toMatch(
			/ZUGZWANG_ENV=prod/,
		);
	});

	it("refuses any database that is not production", () => {
		expect(reason({ ...prodEnv, DATABASE_URL: STAGING_URL })).toMatch(
			/does not name the PRODUCTION/,
		);
		expect(reason({ ...prodEnv, DATABASE_URL: undefined })).toMatch(/not set/);
	});

	it("refuses the production ref on a non-Supabase host", () => {
		expect(
			reason({
				...prodEnv,
				DATABASE_URL: `postgresql://postgres.${REF}:x@203.0.113.10:5432/postgres`,
			}),
		).toMatch(/not a Supabase host/);
	});
});

describe("mode selection", () => {
	it("has no default", () => {
		expect(reason({ ...prodEnv, ZUGZWANG_SEED_TARGET: undefined })).toMatch(
			/no default/,
		);
		expect(reason({ ...prodEnv, ZUGZWANG_SEED_TARGET: "production" })).toMatch(
			/must be "local", "staging" or "prod"/,
		);
	});

	it("refuses when the production ref constant is empty", () => {
		expect(reason(prodEnv, "")).toMatch(/PRODUCTION_PROJECT_REF is empty/);
	});
});

describe("local and staging modes keep P-17", () => {
	it("local refuses a production ref anywhere in the environment", () => {
		expect(
			reason({
				ZUGZWANG_SEED_TARGET: "local",
				ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
				DATABASE_URL: PROD_URL,
			}),
		).toMatch(/PRODUCTION project ref/);
	});

	it("staging refuses a production ref in DATABASE_URL_STAGING", () => {
		expect(
			reason({
				ZUGZWANG_SEED_TARGET: "staging",
				ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
				DATABASE_URL_STAGING: PROD_URL,
			}),
		).toMatch(/PRODUCTION project ref/);
	});

	it("local admits a loopback database (positive control)", () => {
		const url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
		const t = resolveSeedTarget({
			ZUGZWANG_SEED_TARGET: "local",
			ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
			DATABASE_URL: url,
		});
		expect(t).toEqual({ ok: true, mode: "local", url, ref: null });
	});
});
