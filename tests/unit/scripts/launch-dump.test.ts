import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LAUNCH-DB-COPY-1 — `scripts/aws-migration/launch-dump.cjs`
 * (`docs/plans/LAUNCH-DB-COPY-1.md` §4, runbook steps 3b and 5).
 *
 * ⛔ WRITTEN BEFORE THE TOOL EXISTS; the intended RED is `Cannot find module
 * …/launch-dump.cjs`.
 *
 * WHAT THIS TOOL IS. It takes a `pg_dump` of one named environment and writes a
 * manifest beside it. It is the only launch tool that is pointed at PRODUCTION
 * and at STAGING by the same operator in the same hour (step 3b, then step 5),
 * which is why the environment is a positional argument that must be stated and
 * cannot be defaulted — and why `stableVerdict` exists at all: a dump taken
 * while the source was being written is a dump of no single state, and the
 * manifest would then describe a database that never existed.
 *
 * Resolutions this file makes where §4 is silent (the implementer follows
 * these):
 *   1. `parseArgs(argv)` reads `process.argv.slice(2)`: positionals are
 *      `[env, instanceId]` in that order, `--account=<id>` by prefix, and
 *      `--execute` as a flag defaulting to FALSE.
 *   2. The instance-id rule is `prod-restore.cjs`'s, character for character:
 *      `/^i-[0-9a-f]{8,}$/`. Hex, because that is what an EC2 id is.
 *   3. `stableVerdict(before, after)` returns an object with a boolean `pass`
 *      and NAMES the tables that moved somewhere in its payload. The shape is
 *      otherwise free (a `compareManifests`-style row list satisfies it), but a
 *      bare boolean does not: the operator has to be told WHICH table was
 *      written mid-dump.
 *   4. ⛔ `stableVerdict` EXCUSES ONLY `VOLATILE_TABLES` — not `CLEARED_TABLES`.
 *      It is NOT `compareManifests` under another name: that function forgives a
 *      session table by design, and a session written during the dump is
 *      evidence the source was live, which is exactly what this verdict exists
 *      to catch.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/launch-dump.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

const ACCOUNT = "849076101704";
const INSTANCE = "i-0123456789abcdef0";
const BASE = "zugzwang-staging-2026-10-05T12-34-56Z.dump";

const cell = (count: number, md5: string) => ({ count, md5 });

/**
 * ⛔ COMMENTS STRIPPED BEFORE EVERY NEGATIVE SCAN, line count preserved. This
 * tool's own docblock has to be free to say the words TRUNCATE and pg_restore —
 * explaining that it never runs them is most of what its header is for — and
 * six recorded instances in this repository have a textual guard matching the
 * comment that explains the absence. Borrowed from
 * `tests/unit/design/phone-touch-handlers.test.ts`.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SOURCE = readFileSync(SCRIPT, "utf8");
const CODE = code(SOURCE);

/**
 * Anything that would make this a tool that can change a database. `psql` is
 * absent from the list deliberately: the manifest needs read queries, so the
 * line is drawn at what the SQL DOES, not at the client that sends it.
 */
const FORBIDDEN =
	/pg_restore|\bTRUNCATE\b|\bDELETE\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bALTER\b|\bGRANT\b|\bREVOKE\b|VACUUM/i;

describe("launch-dump::arguments", () => {
	it("reads the environment, the instance and the account, and is check-only", () => {
		const a = tool.parseArgs(["staging", INSTANCE, `--account=${ACCOUNT}`]);
		expect(a.env).toBe("staging");
		expect(a.instanceId).toBe(INSTANCE);
		expect(a.account).toBe(ACCOUNT);
		expect(a.execute).toBe(false);
	});

	it("writes only when --execute is passed, wherever the flag sits", () => {
		const a = tool.parseArgs([
			"--execute",
			"prod",
			INSTANCE,
			`--account=${ACCOUNT}`,
		]);
		expect(a.execute).toBe(true);
		expect(a.env).toBe("prod");
		expect(a.instanceId).toBe(INSTANCE);
	});

	it.each([["prod"], ["staging"]])("accepts the %s environment", (env) => {
		expect(() =>
			tool.assertArgs({ env, instanceId: INSTANCE, account: ACCOUNT }),
		).not.toThrow();
	});

	it.each([
		["the CDK's name for the environment", { env: "production" }],
		["an environment that is neither", { env: "dev" }],
		["no environment at all", { env: undefined }],
		["an empty environment", { env: "" }],
		["a capitalised environment", { env: "Prod" }],
		["a database host instead of an instance", { instanceId: "prod-db" }],
		["a short instance id", { instanceId: "i-0123456" }],
		["a non-hex instance id", { instanceId: "i-zzzzzzzzzzzzzzzz" }],
		["no --account (wrong-profile protection)", { account: undefined }],
		["a short account id", { account: "12345" }],
		["a 13-digit account id", { account: "8490761017040" }],
		["a non-numeric account id", { account: "abcdefghijkl" }],
	])("refuses %s", (_label, override) => {
		expect(() =>
			tool.assertArgs({
				env: "prod",
				instanceId: INSTANCE,
				account: ACCOUNT,
				...override,
			}),
		).toThrow(/refusing/);
	});
});

describe("launch-dump::dump-command", () => {
	it("is exactly the argv the plan pins", () => {
		expect(tool.dumpCommand(BASE)).toEqual([
			"pg_dump",
			"--format=custom",
			"--no-owner",
			"--no-acl",
			"--schema=public",
			"--schema=drizzle",
			"-f",
			`/backup/${BASE}`,
		]);
	});

	it("writes inside the mounted backup directory and nowhere else", () => {
		const argv: string[] = tool.dumpCommand(BASE);
		expect(argv.at(-1)).toBe(`/backup/${BASE}`);
		expect(argv.filter((a) => a.includes(BASE))).toHaveLength(1);
	});

	it("is pg_dump only — no restore, no write, no DDL", () => {
		const argv: string[] = tool.dumpCommand(BASE);
		expect(argv[0]).toBe("pg_dump");
		expect(FORBIDDEN.test(argv.join(" "))).toBe(false);
		expect(argv.join(" ")).not.toContain("--clean");
		expect(argv.join(" ")).not.toContain("--create");
		expect(argv.join(" ")).not.toContain("--dbname");
	});

	it("carries nothing a shell could expand, if one ever sees it", () => {
		for (const a of tool.dumpCommand(BASE) as string[]) {
			expect(a).not.toContain("$");
			expect(a).not.toContain(";");
			expect(a).not.toContain("&");
		}
	});
});

describe("launch-dump::stable-verdict", () => {
	const BEFORE = {
		"public.users": cell(621, "u1"),
		"public.bets": cell(3168, "b1"),
		"public.sessions": cell(725, "s1"),
		"public.liquidity_heartbeat": cell(16228, "h1"),
	};

	it("passes when the source did not move", () => {
		expect(tool.stableVerdict(BEFORE, { ...BEFORE }).pass).toBe(true);
	});

	it("passes when only the pg_cron tables moved", () => {
		// `liquidity_heartbeat` gains a row every few minutes on both databases;
		// refusing on it would make every dump unrepeatable.
		const v = tool.stableVerdict(BEFORE, {
			...BEFORE,
			"public.liquidity_heartbeat": cell(16231, "h2"),
			"public.watermark_state": undefined,
		});
		expect(v.pass).toBe(true);
	});

	it("REFUSES when any other table moved, and names it", () => {
		const v = tool.stableVerdict(BEFORE, {
			...BEFORE,
			"public.bets": cell(3169, "b2"),
		});
		expect(v.pass).toBe(false);
		expect(JSON.stringify(v)).toContain("public.bets");
	});

	it("REFUSES on a fingerprint change at an unchanged count", () => {
		const v = tool.stableVerdict(BEFORE, {
			...BEFORE,
			"public.users": cell(621, "u2"),
		});
		expect(v.pass).toBe(false);
		expect(JSON.stringify(v)).toContain("public.users");
	});

	it("REFUSES on a SESSION written mid-dump — a cleared table is not a volatile one", () => {
		/**
		 * ⛔ THE DELEGATION TRAP. `compareManifests` reports a session table as
		 * `cleared-ok` and passes, because at verification time it is supposed to
		 * be empty. Here the same row means the source was SERVING REQUESTS while
		 * being dumped, which is the one thing this verdict exists to detect. A
		 * `stableVerdict` that simply forwards to `compareManifests` passes this
		 * test's input and ships the defect.
		 */
		const v = tool.stableVerdict(BEFORE, {
			...BEFORE,
			"public.sessions": cell(726, "s2"),
		});
		expect(v.pass).toBe(false);
		expect(JSON.stringify(v)).toContain("public.sessions");
	});

	it("REFUSES when a table appears or disappears between the two censuses", () => {
		const { "public.bets": _gone, ...without } = BEFORE;
		expect(tool.stableVerdict(BEFORE, without).pass).toBe(false);
		expect(
			tool.stableVerdict(without, {
				...without,
				"public.bets": cell(3168, "b1"),
			}).pass,
		).toBe(false);
	});
});

describe("launch-dump::execution-safety", () => {
	it("the scanner can see a forbidden token in real code of this family", () => {
		/**
		 * POSITIVE CONTROL, and it is two-part. (1) The regex fires on a synthetic
		 * line. (2) It fires on `prod-restore.cjs` — a real file in this directory
		 * that genuinely runs TRUNCATE and pg_restore in CODE, not only in its
		 * header — so a clean scan of `launch-dump.cjs` means "this tool does not
		 * do those things" rather than "the scanner never worked".
		 */
		expect(FORBIDDEN.test("TRUNCATE public.users CASCADE;")).toBe(true);
		expect(FORBIDDEN.test("pg_restore --data-only")).toBe(true);
		const restoreCode = code(
			readFileSync(
				join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs"),
				"utf8",
			),
		);
		expect(FORBIDDEN.test(restoreCode)).toBe(true);
	});

	it("runs pg_dump and read queries only — no restore, no write, anywhere", () => {
		expect(FORBIDDEN.test(CODE)).toBe(false);
		expect(CODE).toContain("pg_dump");
	});

	it("never asks a database to pause cron or disable a trigger", () => {
		expect(CODE).not.toMatch(/cron\.job/);
		expect(CODE).not.toMatch(/DISABLE TRIGGER|session_replication_role/i);
	});

	it("checks the caller's AWS account before reading any secret", () => {
		const sts = CODE.indexOf("get-caller-identity");
		const secret = CODE.indexOf("get-secret-value");
		expect(sts).toBeGreaterThan(-1);
		expect(secret).toBeGreaterThan(sts);
	});

	it("hands credentials to Docker through a mode-0600 env file, never argv", () => {
		expect(CODE).toMatch(/mode:\s*0o600/);
		expect(CODE).toContain("--env-file");
		expect(CODE).not.toMatch(/console\.log\([^)]*PGPASSWORD/);
		expect(CODE).not.toMatch(/"-e",\s*`?PGPASSWORD/);
	});

	it("only touches AWS or Docker when executed directly", () => {
		// This test file requires the module. Without the guard, collecting it
		// would open an SSM session.
		expect(SOURCE).toContain("if (require.main === module)");
	});

	it("is check-only until --execute is given", () => {
		expect(CODE).toContain("--execute");
		expect(CODE).toMatch(/if\s*\(\s*!\s*[\w.]*execute\b/i);
	});
});
