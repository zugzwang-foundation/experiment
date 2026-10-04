import { describe, expect, it } from "vitest";

import {
	expectedDatabaseFor,
	isAllowedStagingHost,
	isValidRefFragment,
	RESET_INTENT_ENV,
	RESET_INTENT_VALUE,
	resolveStagingTarget,
} from "../../staging/_lib/guards";
import { resolveRunnerTarget } from "../../staging/_lib/target";

/**
 * STAGING-RESET-AWS-1 (ONE-OFF, removed after the run) — the staging guards
 * learn the AWS RDS staging host (ADR-0059) without loosening the production
 * refusal. Supabase behaviour is unchanged.
 */

const STAGING_RDS =
	"zugzwang-staging-database-postgres1a2b3c4d.c9abcdefghij.ap-south-1.rds.amazonaws.com";
const PROD_RDS =
	"zugzwang-production-database-postgres9f8e7d6c.c9abcdefghij.ap-south-1.rds.amazonaws.com";
const FRAGMENT = "database-postgres1a2b3c4d";
const url = (host: string, db = "zugzwang") =>
	`postgres://zugzwang:secret@${host}:5432/${db}`;

describe("isAllowedStagingHost — RDS", () => {
	it("accepts the staging RDS endpoint", () => {
		expect(isAllowedStagingHost(STAGING_RDS)).toBe(true);
	});

	it("refuses the production RDS endpoint", () => {
		expect(isAllowedStagingHost(PROD_RDS)).toBe(false);
	});

	it("refuses an RDS host that does not say staging, or another region", () => {
		expect(
			isAllowedStagingHost(
				"zugzwang-database-postgres1a2b3c4d.c9abcdefghij.ap-south-1.rds.amazonaws.com",
			),
		).toBe(false);
		expect(
			isAllowedStagingHost(STAGING_RDS.replace("ap-south-1", "us-east-1")),
		).toBe(false);
	});

	it("still accepts the Supabase pooler and still refuses loopback", () => {
		expect(isAllowedStagingHost("aws-1-ap-south-1.pooler.supabase.com")).toBe(
			true,
		);
		expect(isAllowedStagingHost("localhost")).toBe(false);
	});
});

describe("isValidRefFragment", () => {
	const supabase =
		"postgres://postgres.abcdefghijklmnopqrst:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

	it("accepts a Supabase ref on Supabase, and an identifier slice of the HOST on RDS", () => {
		expect(isValidRefFragment("abcdefghijklmnopqrst", supabase)).toBe(true);
		expect(isValidRefFragment(FRAGMENT, url(STAGING_RDS))).toBe(true);
	});

	it("keeps Supabase strict — no hyphen or dot slice of the DSN", () => {
		expect(isValidRefFragment("postgres.abcdefghijklmnopqrst", supabase)).toBe(
			false,
		);
	});

	it("on RDS refuses short, provider-wide, or credential-only fragments", () => {
		expect(isValidRefFragment("short", url(STAGING_RDS))).toBe(false);
		expect(
			isValidRefFragment("ap-south-1.rds.amazonaws.com", url(STAGING_RDS)),
		).toBe(false);
		// In the password, not the host — says nothing about where we dial.
		expect(
			isValidRefFragment(
				"secretsecretsecret",
				`postgres://zugzwang:secretsecretsecret@${STAGING_RDS}:5432/zugzwang`,
			),
		).toBe(false);
	});
});

describe("the account-wide parts of an RDS host are never a fragment", () => {
	it("refuses the account hash, the region, and anything outside the instance id", () => {
		for (const f of [
			"c9abcdefghij.ap-south-1",
			"ap-south-1.rds.a",
			"south-1.rds.amaz",
			"c9abcdefghijklmnop",
		]) {
			expect(isValidRefFragment(f, url(STAGING_RDS))).toBe(false);
		}
	});
});

describe("the production RDS instance is refused by NAME, first", () => {
	it("resolveStagingTarget refuses a zugzwang-production URL", () => {
		const r = resolveStagingTarget({
			DATABASE_URL_STAGING: url(PROD_RDS),
			STAGING_PROJECT_REF_FRAGMENT: "database-postgres9f8e7d6c",
			ZUGZWANG_ENV: "staging",
			[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toMatch(/PRODUCTION/);
	});
});

describe("expectedDatabaseFor", () => {
	it("is `zugzwang` on RDS and `postgres` on Supabase", () => {
		expect(expectedDatabaseFor(STAGING_RDS)).toBe("zugzwang");
		expect(expectedDatabaseFor("aws-1-ap-south-1.pooler.supabase.com")).toBe(
			"postgres",
		);
	});
});

describe("resolveStagingTarget (the reset, G-1/G-2) — RDS", () => {
	const env = (over: Record<string, string | undefined> = {}) => ({
		DATABASE_URL_STAGING: url(STAGING_RDS),
		STAGING_PROJECT_REF_FRAGMENT: FRAGMENT,
		ZUGZWANG_ENV: "staging",
		[RESET_INTENT_ENV]: RESET_INTENT_VALUE,
		...over,
	});

	it("accepts the staging RDS URL with its fragment", () => {
		expect(resolveStagingTarget(env()).ok).toBe(true);
	});

	it("refuses a fragment the URL does not carry", () => {
		expect(
			resolveStagingTarget(env({ DATABASE_URL_STAGING: url(PROD_RDS) })).ok,
		).toBe(false);
	});

	it("refuses a provider-wide fragment that would match production too", () => {
		expect(
			resolveStagingTarget(
				env({ STAGING_PROJECT_REF_FRAGMENT: "ap-south-1.rds.amazonaws.com" }),
			).ok,
		).toBe(false);
	});
});

describe("resolveRunnerTarget (the seeders) — RDS", () => {
	const env = (host: string) => ({
		ZUGZWANG_STAGING_TARGET: "staging",
		ZUGZWANG_STAGING_WRITE_ACK: "generate-staging-fixtures",
		DATABASE_URL_STAGING: url(host),
		STAGING_PROJECT_REF_FRAGMENT: FRAGMENT,
		ZUGZWANG_ENV: "staging",
	});

	it("accepts the staging RDS host", () => {
		expect(
			resolveRunnerTarget(env(STAGING_RDS), { requireWriteIntent: true }).ok,
		).toBe(true);
	});

	it("refuses the production RDS host even if it somehow carries the fragment", () => {
		const prodWithFragment = `zugzwang-production-${FRAGMENT}.c9abcdefghij.ap-south-1.rds.amazonaws.com`;
		expect(
			resolveRunnerTarget(env(prodWithFragment), { requireWriteIntent: true })
				.ok,
		).toBe(false);
	});
});
