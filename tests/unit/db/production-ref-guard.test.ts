import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import defaultConfig from "../../../vitest.config";
import scaleConfig from "../../../vitest.scale.config";
import stagingConfig from "../../../vitest.staging.config";
import setup, {
	checkTestTargetNotProduction,
} from "../../_setup/production-ref-guard";
import { PRODUCTION_PROJECT_REF } from "../../staging/_lib/guards";

// P-17 — the global production refusal. Pure-function cases plus the wiring
// that makes them matter. Nothing here connects to a database: every URL is a
// string handed to a pure function, and the refused production-shaped URLs
// point at a loopback port nothing listens on.
//
// The production ref is IMPORTED, never retyped, so this file cannot drift from
// the one constant the guard uses.

const LOCAL = "postgresql://postgres:postgres@localhost:54322/postgres";
const CI = "postgresql://postgres:postgres@localhost:5432/postgres";
const STAGING_REF = "rwfdoqzsghqhhdapxafg";
const STAGING_POOLER = `postgresql://postgres.${STAGING_REF}:not-a-password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
const STAGING_TXN = `postgresql://postgres.${STAGING_REF}:not-a-password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`;
const PROD_POOLER = `postgresql://postgres.${PRODUCTION_PROJECT_REF}:not-a-password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
const PROD_DIRECT = `postgresql://postgres:not-a-password@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`;

function reasonOf(env: Record<string, string | undefined>): string {
	const verdict = checkTestTargetNotProduction(env);
	return verdict.ok ? "(ok)" : verdict.reason;
}

describe("checkTestTargetNotProduction — what passes", () => {
	it("admits the local Supabase default that tests/_setup/env.ts supplies", () => {
		expect(checkTestTargetNotProduction({ DATABASE_URL: LOCAL })).toEqual({
			ok: true,
		});
	});

	it("admits CI's service container and every loopback spelling", () => {
		for (const url of [
			CI,
			"postgresql://u:p@127.0.0.1:54322/postgres",
			"postgresql://u:p@[::1]:54322/postgres",
		]) {
			expect(checkTestTargetNotProduction({ DATABASE_URL: url })).toEqual({
				ok: true,
			});
		}
	});

	it("admits the staging runner environment (stg Doppler shape)", () => {
		expect(
			checkTestTargetNotProduction({
				DATABASE_URL: STAGING_POOLER,
				DATABASE_URL_STAGING: STAGING_POOLER,
				DATABASE_URL_TXN: STAGING_TXN,
				STAGING_PROJECT_REF_FRAGMENT: STAGING_REF,
			}),
		).toEqual({ ok: true });
	});

	it("admits an environment with no database URL at all", () => {
		expect(checkTestTargetNotProduction({})).toEqual({ ok: true });
		expect(checkTestTargetNotProduction({ DATABASE_URL: "" })).toEqual({
			ok: true,
		});
	});
});

describe("checkTestTargetNotProduction — the production refusal", () => {
	it("refuses a production pooler URL in DATABASE_URL", () => {
		expect(reasonOf({ DATABASE_URL: PROD_POOLER })).toMatch(
			/^DATABASE_URL contains the PRODUCTION project ref; refusing/,
		);
	});

	it("refuses the production direct host form", () => {
		expect(reasonOf({ DATABASE_URL: PROD_DIRECT })).toMatch(
			/^DATABASE_URL contains the PRODUCTION project ref/,
		);
	});

	it("refuses production in a DATABASE_URL_* variable the fixture never reads", () => {
		expect(
			reasonOf({ DATABASE_URL: LOCAL, DATABASE_URL_TXN: PROD_POOLER }),
		).toMatch(/^DATABASE_URL_TXN contains the PRODUCTION project ref/);
		expect(
			reasonOf({ DATABASE_URL: LOCAL, DATABASE_URL_STAGING: PROD_POOLER }),
		).toMatch(/^DATABASE_URL_STAGING contains the PRODUCTION project ref/);
	});

	it("refuses the production ref in ANY variable — a prd Doppler config is refused wholesale", () => {
		expect(
			reasonOf({ DATABASE_URL: LOCAL, DATABASE_URL_PROD: PROD_POOLER }),
		).toMatch(/^DATABASE_URL_PROD contains the PRODUCTION project ref/);
		expect(
			reasonOf({ DATABASE_URL: LOCAL, SOME_OTHER_VAR: PRODUCTION_PROJECT_REF }),
		).toMatch(/^SOME_OTHER_VAR contains the PRODUCTION project ref/);
	});

	it("reports the production case FIRST, ahead of the unrecognised-host case", () => {
		// A production ref on a host the guard cannot name must still be reported
		// as the wrong-target case (ADR-0035 driver 4 ordering).
		expect(
			reasonOf({
				DATABASE_URL: `postgresql://postgres.${PRODUCTION_PROJECT_REF}:x@203.0.113.10:5432/postgres`,
			}),
		).toMatch(/PRODUCTION project ref/);
	});

	it("refuses when the deny list is empty rather than passing everything", () => {
		const verdict = checkTestTargetNotProduction({ DATABASE_URL: LOCAL }, "");
		expect(verdict.ok).toBe(false);
		expect(verdict.ok ? "" : verdict.reason).toMatch(
			/PRODUCTION_PROJECT_REF is empty/,
		);
	});
});

describe("checkTestTargetNotProduction — hosts it cannot name", () => {
	it("refuses a remote non-Supabase host (where a production ref could hide)", () => {
		expect(
			reasonOf({ DATABASE_URL: "postgresql://u:p@203.0.113.10:5432/postgres" }),
		).toMatch(
			/^DATABASE_URL dials "203\.0\.113\.10", which is neither loopback nor a Supabase host; refusing/,
		);
		expect(
			reasonOf({
				DATABASE_URL: LOCAL,
				DATABASE_URL_TXN: "postgresql://u:p@db.example.com:6543/postgres",
			}),
		).toMatch(/^DATABASE_URL_TXN dials "db\.example\.com"/);
	});

	it("refuses an unparseable database URL", () => {
		expect(reasonOf({ DATABASE_URL: "not a url" })).toBe(
			"DATABASE_URL is not a parseable URL; refusing",
		);
	});

	it("ignores non-database variables that merely look like URLs", () => {
		expect(
			checkTestTargetNotProduction({
				DATABASE_URL: LOCAL,
				BETTER_AUTH_URL: "http://localhost:3000",
				UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
			}),
		).toEqual({ ok: true });
	});
});

describe("the default export is the globalSetup entry point", () => {
	const saved = { ...process.env };
	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			if (!(key in saved)) delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("passes under this run's own (local) environment", () => {
		expect(() => setup()).not.toThrow();
	});

	it("throws on a production URL placed in process.env — the abort a real run gets", () => {
		process.env.DATABASE_URL_TXN = PROD_POOLER;
		expect(() => setup()).toThrow(
			/^\[production-ref-guard\] DATABASE_URL_TXN contains the PRODUCTION project ref/,
		);
	});
});

describe("all three Vitest configs register the guard", () => {
	const GUARD = "./tests/_setup/production-ref-guard.ts";

	it("the guard module exists at the registered path", () => {
		expect(
			existsSync(
				fileURLToPath(
					new URL(
						"../../../tests/_setup/production-ref-guard.ts",
						import.meta.url,
					),
				),
			),
		).toBe(true);
	});

	for (const [name, config] of [
		["vitest.config.ts", defaultConfig],
		["vitest.scale.config.ts", scaleConfig],
		["vitest.staging.config.ts", stagingConfig],
	] as const) {
		it(`${name} lists it as globalSetup`, () => {
			const test = (config as { test?: { globalSetup?: unknown } }).test;
			expect(test?.globalSetup).toEqual([GUARD]);
		});
	}
});
