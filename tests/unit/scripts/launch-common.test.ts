import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";

/**
 * LAUNCH-DB-COPY-1 — `scripts/aws-migration/lib/launch-common.cjs`
 * (`docs/plans/LAUNCH-DB-COPY-1.md` §4). The shared, pure helpers behind every
 * launch-copy tool: which database a tool is allowed to touch, what a dump file
 * is called, and how a connection URL is kept out of every printed line.
 *
 * ⛔ WRITTEN BEFORE THE MODULE EXISTS. Until `launch-common.cjs` lands this file
 * fails at load with `Cannot find module …/lib/launch-common.cjs` — that is the
 * intended RED, and it is the whole file at once because the `require` is
 * top-level (the house shape, as in `prod-restore.test.ts` and
 * `check-destructive-migrations.test.ts`).
 *
 * WHY THE TARGET GUARD IS THE FIRST THING TESTED. `assertEnvTarget` is the only
 * thing standing between `launch-dump.cjs staging` and a pg_dump of PRODUCTION,
 * and — the direction that actually destroys data — between a tool told "prod"
 * and the staging database. The two RDS hostnames differ by one word in the
 * middle of a 90-character string, both end `.cpiuei4au2fa.ap-south-1.rds
 * .amazonaws.com`, and both databases are called `zugzwang` with the same master
 * user. A substring test is therefore the entire guard, which is why the cases
 * below include a host carrying BOTH words: that is the one input a naive
 * `includes()` pair passes in both directions.
 *
 * Resolutions this file makes where §4 is silent (the implementer follows
 * these):
 *   1. `assertEnvTarget` returns a `URL` instance — the precedent is
 *      `prod-restore.cjs`'s `assertProductionTarget`, which returns `new
 *      URL(...)` so its caller can read `hostname`/`username`/`password` without
 *      parsing twice. "returns the URL" is read as that.
 *   2. An `env` outside `ENVS` is REFUSED by name, with a `/refusing/` message —
 *      not a `TypeError` from indexing `ENVS` with an unknown key. `"production"`
 *      (the CDK stack's name for the same environment) is the plausible typo and
 *      must not fall through to a permissive branch.
 *   3. `parseDumpFileName` takes a BASE name, as §4 names its parameter. It is
 *      not tested with a path; stripping a directory stays the caller's job
 *      (`prod-restore.cjs` does it with `.split(/[\\/]/).pop()`).
 *   4. The stamp is UTC and carries no milliseconds — pinned by passing a fixed
 *      `Date` and expecting the Z-form, so a local-time implementation fails on
 *      any machine that is not at UTC+0 (this one is at +05:30).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const lib: any = require(
	join(REPO_ROOT, "scripts/aws-migration/lib/launch-common.cjs"),
);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const restore: any = require(
	join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs"),
);

/** The live hostnames, measured 2026-10-05 (PROD-LAUNCH-DB-COPY §A.1). */
const PROD_HOST =
	"zugzwang-production-database-postgres9dc8bb04-rysnutic4cy5.cpiuei4au2fa.ap-south-1.rds.amazonaws.com";
const STAGING_HOST =
	"zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo.cpiuei4au2fa.ap-south-1.rds.amazonaws.com";
const url = (host: string, path = "/zugzwang") =>
	`postgresql://zugzwang:s3cr3t-pw@${host}:5432${path}?sslmode=require`;

const PROD_URL = url(PROD_HOST);
const STAGING_URL = url(STAGING_HOST);

describe("launch-common::constants", () => {
	it("pins the region and the one database name both environments use", () => {
		expect(lib.REGION).toBe("ap-south-1");
		expect(lib.DB_NAME).toBe("zugzwang");
	});

	it("reads each environment's secret through the name its ECS task uses", () => {
		expect(Object.keys(lib.ENVS).sort()).toEqual(["prod", "staging"]);
		expect(lib.ENVS.prod.secret).toBe(productionConfig.secretName);
		expect(lib.ENVS.staging.secret).toBe(stagingConfig.secretName);
		// Spelled out as well as compared: the comparison above would also pass if
		// both config files were wrong in the same way.
		expect(lib.ENVS.prod.secret).toBe("zugzwang/production");
		expect(lib.ENVS.staging.secret).toBe("zugzwang/staging");
	});
});

describe("launch-common::assert-env-target", () => {
	it("accepts each environment's real RDS host", () => {
		expect(() => lib.assertEnvTarget("prod", PROD_URL)).not.toThrow();
		expect(() => lib.assertEnvTarget("staging", STAGING_URL)).not.toThrow();
	});

	it("returns the parsed URL, so the caller never re-parses it", () => {
		const u = lib.assertEnvTarget("prod", PROD_URL);
		expect(u.hostname).toBe(PROD_HOST);
		expect(u.pathname).toBe("/zugzwang");
		expect(decodeURIComponent(u.username)).toBe("zugzwang");
	});

	it.each([
		// ⛔ The two that would destroy or leak data, and they are the whole point.
		["prod given the STAGING host", "prod", STAGING_URL],
		["staging given the PRODUCTION host", "staging", PROD_URL],
		// A host carrying both words: the single input a pair of naive
		// `includes()` checks accepts for BOTH environments.
		[
			"prod given a host carrying both words",
			"prod",
			url(
				"zugzwang-production-staging-database-postgres9dc8bb04-aaaaaaaaaaaa.cpiuei4au2fa.ap-south-1.rds.amazonaws.com",
			),
		],
		[
			"staging given a host carrying both words",
			"staging",
			url(
				"zugzwang-production-staging-database-postgres9dc8bb04-aaaaaaaaaaaa.cpiuei4au2fa.ap-south-1.rds.amazonaws.com",
			),
		],
		// Supabase — the pre-cutover home of this data, and still reachable from
		// this machine's environment files.
		[
			"prod given the Supabase pooler",
			"prod",
			"postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
		],
		[
			"staging given a Supabase host that carries the word staging",
			"staging",
			"postgresql://u:p@zugzwang-staging.pooler.supabase.com:5432/zugzwang",
		],
		// Not RDS at all: the suffix must be anchored, or any domain ending in
		// something longer passes.
		[
			"prod given a non-RDS host",
			"prod",
			url(`${PROD_HOST}.attacker.example.com`),
		],
		["staging given a non-RDS host", "staging", url("localhost")],
		[
			"prod given another region",
			"prod",
			PROD_URL.replace("ap-south-1", "us-east-1"),
		],
		// The database inside the right instance.
		["prod given another database", "prod", url(PROD_HOST, "/postgres")],
		[
			"staging given another database",
			"staging",
			url(STAGING_HOST, "/postgres"),
		],
		["prod given no database path", "prod", url(PROD_HOST, "")],
		// Resolution 2: an unrecognised environment is refused by name.
		[
			"the CDK's name for production instead of the tool's",
			"production",
			PROD_URL,
		],
		["an empty environment", "", PROD_URL],
	])("refuses %s", (_label, env, databaseUrl) => {
		expect(() => lib.assertEnvTarget(env, databaseUrl)).toThrow(/refusing/);
	});

	it("never returns for something that is not a URL", () => {
		expect(() => lib.assertEnvTarget("prod", "zugzwang-production")).toThrow();
		expect(() => lib.assertEnvTarget("prod", undefined)).toThrow();
	});
});

describe("launch-common::dump-file-name", () => {
	const AT = new Date("2026-10-05T12:34:56.789Z");

	it("names a dump for its environment and the UTC second it was taken", () => {
		expect(lib.dumpFileName("prod", AT)).toBe(
			"zugzwang-prod-2026-10-05T12-34-56Z.dump",
		);
		expect(lib.dumpFileName("staging", AT)).toBe(
			"zugzwang-staging-2026-10-05T12-34-56Z.dump",
		);
	});

	it("carries no character Windows refuses in a file name", () => {
		// The dumps land in C:\Users\…\zugzwang-backups\; a colon from an ISO
		// timestamp makes the file unopenable there and nowhere else.
		const name = lib.dumpFileName("prod", AT);
		expect(name).not.toMatch(/[:*?"<>|]/);
		expect(name).not.toContain(".789");
	});

	it("round-trips through parseDumpFileName", () => {
		for (const env of ["prod", "staging"]) {
			const base = lib.dumpFileName(env, AT);
			expect(lib.parseDumpFileName(base)).toEqual({
				env,
				stamp: "2026-10-05T12-34-56Z",
			});
		}
	});

	it.each([
		["a name with no stamp", "zugzwang-prod.dump"],
		["an empty stamp", "zugzwang-prod-.dump"],
		["a half stamp", "zugzwang-prod-2026-10-05.dump"],
		["an unknown environment", "zugzwang-dev-2026-10-05T12-34-56Z.dump"],
		["another product", "pgdump-prod-2026-10-05T12-34-56Z.dump"],
		["another extension", "zugzwang-prod-2026-10-05T12-34-56Z.sql"],
		["a trailing suffix", "zugzwang-prod-2026-10-05T12-34-56Z.dump.bak"],
		["nothing", ""],
	])("reads %s as not a launch dump", (_label, base) => {
		expect(lib.parseDumpFileName(base)).toBeNull();
	});
});

describe("launch-common::prod-name-feeds-the-rollback-path", () => {
	/**
	 * ⛔ LOAD-BEARING COUPLING. Step 3b of the runbook takes the production dump
	 * that step 7 of the ROLLBACK table feeds back through `prod-restore.cjs`,
	 * whose `assertArgs` accepts only `/^zugzwang-prod-[0-9TZ-]+\.dump$/`. If
	 * `dumpFileName("prod", …)` ever produces a name that regex rejects, the
	 * rollback is unavailable at the one moment it is needed — and nothing else
	 * in the repository would notice, because the two tools are never run
	 * together until then.
	 */
	const PROD_DUMP_RE = /^zugzwang-prod-[0-9TZ-]+\.dump$/;
	const name = () => lib.dumpFileName("prod", new Date("2026-10-05T12:34:56Z"));

	it("matches the regex prod-restore.cjs already enforces", () => {
		expect(PROD_DUMP_RE.test(name())).toBe(true);
	});

	it("is accepted by the real prod-restore pre-flight", () => {
		expect(() =>
			restore.assertArgs({
				instanceId: "i-0123456789abcdef0",
				dumpFile: `C:\\Users\\Lenovo\\zugzwang-backups\\prod\\${name()}`,
				sha256: "a".repeat(64),
				account: "111122223333",
			}),
		).not.toThrow();
	});

	it("keeps a staging dump OUTSIDE that regex, so the rollback path cannot take one", () => {
		const staging = lib.dumpFileName(
			"staging",
			new Date("2026-10-05T12:34:56Z"),
		);
		expect(PROD_DUMP_RE.test(staging)).toBe(false);
	});
});

describe("launch-common::redact", () => {
	it("removes a connection URL of either scheme", () => {
		expect(lib.redact(`error at ${PROD_URL} end`)).toBe("error at <url> end");
		expect(
			lib.redact(
				`error at ${PROD_URL.replace("postgresql:", "postgres:")} end`,
			),
		).toBe("error at <url> end");
	});

	it("removes every URL in the text, not the first", () => {
		const out = lib.redact(`a ${PROD_URL} b ${STAGING_URL} c`);
		expect(out).toBe("a <url> b <url> c");
	});

	it("leaves no password behind, wherever it sits in the line", () => {
		for (const text of [
			PROD_URL,
			`psql: connection to ${STAGING_URL} failed`,
			`${PROD_URL}\n${STAGING_URL}`,
		]) {
			expect(lib.redact(text)).not.toContain("s3cr3t-pw");
		}
	});

	it("leaves ordinary output alone and never throws on a non-string", () => {
		expect(lib.redact("pg_dump: 12 tables, 0 errors")).toBe(
			"pg_dump: 12 tables, 0 errors",
		);
		expect(() => lib.redact(undefined)).not.toThrow();
	});

	it("behaves exactly as prod-restore's redact, which the launch tools reuse", () => {
		for (const text of [
			`a ${PROD_URL} b`,
			`${STAGING_URL}`,
			"no url here",
			"postgres://u:p@h/db?x=1 trailing",
		]) {
			expect(lib.redact(text)).toBe(restore.redact(text));
		}
	});
});

describe("launch-common::launch-window", () => {
	/**
	 * @security-auditor M-3. The cache, storage and cron-pause tools write to
	 * production; after launch they must not be one keystroke from a live
	 * delete. They share the restore's acknowledgement and expiry.
	 */
	const ACK = { ZZ_LAUNCH_COPY_ACK: "replace-production-with-staging" };
	const inside = new Date("2026-10-25T23:59:59Z");
	const after = new Date("2026-10-26T00:00:00Z");

	it("uses the same acknowledgement and expiry as the restore's launch mode", () => {
		expect(lib.LAUNCH_COPY_ACK).toBe(restore.LAUNCH_COPY_ACK);
		expect(lib.LAUNCH_COPY_EXPIRES_AT).toBe(restore.LAUNCH_COPY_EXPIRES_AT);
	});

	it("passes with the acknowledgement, up to and including the named second", () => {
		expect(() =>
			lib.assertLaunchWindow({ now: inside, env: ACK }),
		).not.toThrow();
	});

	it.each([
		["absent", {}],
		["empty", { ZZ_LAUNCH_COPY_ACK: "" }],
		["yes", { ZZ_LAUNCH_COPY_ACK: "yes" }],
		["upper-case", { ZZ_LAUNCH_COPY_ACK: "REPLACE-PRODUCTION-WITH-STAGING" }],
	])("refuses an acknowledgement that is %s, naming the variable", (_l, env) => {
		expect(() => lib.assertLaunchWindow({ now: inside, env })).toThrow(
			/ZZ_LAUNCH_COPY_ACK/,
		);
	});

	it("refuses after the window closes, even acknowledged", () => {
		expect(() => lib.assertLaunchWindow({ now: after, env: ACK })).toThrow(
			/closed at 2026-10-25T23:59:59Z/,
		);
	});
});

describe("launch-common::parse-secret", () => {
	it("parses a secret value", () => {
		expect(lib.parseSecret('{"A":"b"}')).toEqual({ A: "b" });
	});

	it("never quotes the secret in its error (@security-auditor L-3)", () => {
		const bad = '{"ADMIN_PASSWORD":"hunter2-very-secret"';
		let message = "";
		try {
			lib.parseSecret(bad);
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).toBe("refusing: the secret value is not valid JSON");
		expect(message).not.toContain("hunter2");
	});
});
