import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { RUNTIME_SECRET_KEYS } from "../../../infra/config/types";

/**
 * Readiness item 12 — `scripts/aws-migration/prod-secret.cjs`. The script's
 * guards and payload are pure exported functions (its AWS calls run only when
 * executed directly), so this exercises the real logic without touching AWS.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/prod-secret.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

const PROD_HOST =
	"zugzwang-production-database-postgresab12cd34-xyz.cpiuei4au2fa.ap-south-1.rds.amazonaws.com";
const CREDS = { username: "zugzwang", password: "p@ss/wo:rd" };

function fullEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const k of tool.RUNTIME_KEYS) env[k] = `value-of-${k}`;
	env.DATABASE_URL =
		"postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
	env.CRON_SECRET = "cron-secret";
	return env;
}

describe("key lists cannot drift from the infrastructure", () => {
	it("RUNTIME_KEYS equals infra RUNTIME_SECRET_KEYS", () => {
		expect([...tool.RUNTIME_KEYS].sort()).toEqual(
			[...RUNTIME_SECRET_KEYS].sort(),
		);
	});

	it("writes the production task's migration keys and the configured secret name", () => {
		for (const k of productionConfig.migrationSecretKeys) {
			expect(tool.DERIVED_KEYS).toContain(k);
		}
		expect(tool.SECRET_NAME).toBe(productionConfig.secretName);
	});
});

describe("guards", () => {
	it("accepts a production RDS host", () => {
		expect(() => tool.assertProductionRdsHost(PROD_HOST)).not.toThrow();
	});

	it.each([
		[
			"the staging RDS",
			"zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo.cpiuei4au2fa.ap-south-1.rds.amazonaws.com",
		],
		["Supabase", "aws-1-ap-south-1.pooler.supabase.com"],
		[
			"another region",
			"zugzwang-production-db.abc.us-east-1.rds.amazonaws.com",
		],
		["no 'production' in the name", "some-db.abc.ap-south-1.rds.amazonaws.com"],
		["empty", ""],
	])("refuses %s", (_label, host) => {
		expect(() => tool.assertProductionRdsHost(host)).toThrow(/refusing/);
	});

	it("refuses unless Doppler injected project zugzwang-experiment / config prd", () => {
		expect(() =>
			tool.assertDopplerProduction({
				DOPPLER_PROJECT: "zugzwang-experiment",
				DOPPLER_CONFIG: "prd",
			}),
		).not.toThrow();
		expect(() =>
			tool.assertDopplerProduction({
				DOPPLER_PROJECT: "zugzwang-experiment",
				DOPPLER_CONFIG: "stg",
			}),
		).toThrow(/refusing/);
		expect(() => tool.assertDopplerProduction({})).toThrow(/refusing/);
	});

	it("refuses a non-numeric port and a non-identifier database name", () => {
		expect(() => tool.assertPort("5432")).not.toThrow();
		expect(() => tool.assertPort("5432; rm -rf")).toThrow(/refusing/);
		expect(() => tool.assertDbName("zugzwang")).not.toThrow();
		expect(() => tool.assertDbName("zugzwang; drop")).toThrow(/refusing/);
	});
});

describe("composeSecret", () => {
	it("points DATABASE_URL and DATABASE_URL_PROD at the production RDS, URL-encoded, with TLS", () => {
		const { payload, missing } = tool.composeSecret(
			fullEnv(),
			CREDS,
			PROD_HOST,
			"5432",
			"zugzwang",
		);
		expect(missing).toEqual([]);
		const expected = `postgresql://zugzwang:p%40ss%2Fwo%3Ard@${PROD_HOST}:5432/zugzwang?sslmode=require`;
		expect(payload.DATABASE_URL).toBe(expected);
		expect(payload.DATABASE_URL_PROD).toBe(expected);
		expect(payload.DATABASE_URL).not.toMatch(/supabase/);
		expect(payload.PROD_PROJECT_REF_FRAGMENT).toBe(PROD_HOST);
		expect(payload.DATABASE_URL_PROD).toContain(
			payload.PROD_PROJECT_REF_FRAGMENT,
		);
		expect(payload.CRON_AUTH_HEADER).toBe("Bearer cron-secret");
	});

	it("reports every missing runtime key — the script refuses to write on any", () => {
		const env = fullEnv();
		delete env.NEXT_PUBLIC_SENTRY_DSN;
		env.BETTER_AUTH_TRUSTED_ORIGINS = "";
		const { missing } = tool.composeSecret(
			env,
			CREDS,
			PROD_HOST,
			"5432",
			"zugzwang",
		);
		expect(missing.sort()).toEqual([
			"BETTER_AUTH_TRUSTED_ORIGINS",
			"NEXT_PUBLIC_SENTRY_DSN",
		]);
	});
});

describe("execution safety (source)", () => {
	const source = readFileSync(SCRIPT, "utf8");

	it("is a dry-run unless --execute is passed", () => {
		expect(tool.parseArgs(["a", "b", "5432", "db"]).execute).toBe(false);
		expect(tool.parseArgs(["a", "b", "5432", "db", "--execute"]).execute).toBe(
			true,
		);
	});

	it("never passes the secret JSON on the command line", () => {
		expect(source).toContain('"--secret-string",\n\t\t\t\tref,');
		expect(source).not.toMatch(/"--secret-string",\s*\n\s*json/);
		expect(source).toMatch(/mode: 0o600/);
	});

	it("only runs AWS calls when executed directly", () => {
		expect(source).toContain("if (require.main === module)");
	});
});
