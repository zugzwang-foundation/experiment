import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { productionConfig } from "../../../infra/config/production";

/**
 * Readiness item 17 — `scripts/aws-migration/prod-restore.cjs`. Its guards and
 * argument builders are pure exported functions (the tunnel, Docker and AWS calls
 * run only when executed directly), so this exercises the real logic.
 *
 * ── LAUNCH-DB-COPY-1 (2026-10-05) ────────────────────────────────────────────
 * The last three `describe` blocks are new and cover the one-time
 * `--source=staging` mode (`docs/plans/LAUNCH-DB-COPY-1.md` §4, runbook steps
 * 6–7): the same tool, pointed at the same production database, loading a
 * STAGING dump. Everything above them is the pre-existing prod-dump path and is
 * unchanged — that path is the ROLLBACK (§7), so it must keep working exactly as
 * it does today, and after the launch mode expires.
 *
 * ⛔ THE CLOCK IS INJECTED, AND THIS IS THE EXACT SHAPE THE IMPLEMENTER FOLLOWS:
 *
 *     assertArgs(args, { now = new Date(), env = process.env } = {})
 *
 * `now` is a `Date`; `env` is a record read for `ZZ_LAUNCH_COPY_ACK`. Both
 * default, so every existing call site — `assertArgs(args)` in `main()` and in
 * the tests above — keeps its meaning. The expiry comparison is `<=`, so the
 * instant named by `LAUNCH_COPY_EXPIRES_AT` is still inside the window and the
 * next second is not. Injected rather than read from `Date.now()` because a
 * test that cannot move the clock can only assert the guard today, and a window
 * that is still open today is exactly the state in which an expiry check that
 * does nothing looks correct.
 *
 * ⛔ AND THE EXPIRY MUST NOT REACH THE PROD PATH. The rollback is the one thing
 * that has to work on 26 October and every day after it. An expiry test placed
 * before the source branch disables it, which is a failure mode with no symptom
 * until the day it is needed.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

const PROD_URL =
	"postgresql://zugzwang:secret@zugzwang-production-database-postgresab12.cpiuei4au2fa.ap-south-1.rds.amazonaws.com:5432/zugzwang?sslmode=require";
const SHA = "a".repeat(64);
/** A placeholder: the new production account id is supplied at run time. */
const ACCOUNT = "111122223333";
const DUMP = "zugzwang-prod-2026-10-01T10-00-00Z.dump";

describe("target", () => {
	it("reads the production secret the ECS task uses", () => {
		expect(tool.SECRET).toBe(productionConfig.secretName);
	});

	it("accepts the production RDS database", () => {
		expect(() => tool.assertProductionTarget(PROD_URL)).not.toThrow();
	});

	it.each([
		["the staging RDS", PROD_URL.replace("production", "staging")],
		[
			"Supabase",
			"postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
		],
		["another database name", PROD_URL.replace("/zugzwang?", "/postgres?")],
		["another region", PROD_URL.replace("ap-south-1", "us-east-1")],
	])("refuses %s", (_label, url) => {
		expect(() => tool.assertProductionTarget(url)).toThrow(/refusing/);
	});
});

describe("arguments", () => {
	it("is check-only unless --execute is passed; reload of a non-empty target is opt-in", () => {
		const a = tool.parseArgs(["i-0123456789abcdef0", DUMP, SHA]);
		expect(a.execute).toBe(false);
		expect(a.reloadNonEmpty).toBe(false);
		expect(a.account).toBeUndefined();
		const b = tool.parseArgs([
			"i-0123456789abcdef0",
			"x.dump",
			SHA,
			"--execute",
			"--reload-nonempty",
		]);
		expect(b.execute).toBe(true);
		expect(b.reloadNonEmpty).toBe(true);
	});

	it("reads the production account from --account=", () => {
		const a = tool.parseArgs([
			"i-0123456789abcdef0",
			DUMP,
			SHA,
			`--account=${ACCOUNT}`,
		]);
		expect(a.account).toBe(ACCOUNT);
		expect(a.instanceId).toBe("i-0123456789abcdef0");
		expect(a.dumpFile).toBe(DUMP);
	});

	it("accepts a production backup file, a 64-hex SHA-256 and an account", () => {
		expect(() =>
			tool.assertArgs({
				instanceId: "i-0123456789abcdef0",
				dumpFile: `C:\\backups\\${DUMP}`,
				sha256: SHA,
				account: ACCOUNT,
			}),
		).not.toThrow();
	});

	it.each([
		["a non-instance target", { instanceId: "prod-db" }],
		["a staging-named dump", { dumpFile: "zugzwang-staging-2026.dump" }],
		["a short hash", { sha256: "abc" }],
		["no --account (wrong-profile protection)", { account: undefined }],
		["a short account id", { account: "12345" }],
		["a non-numeric account id", { account: "abcdefghijkl" }],
	])("refuses %s", (_label, override) => {
		expect(() =>
			tool.assertArgs({
				instanceId: "i-0123456789abcdef0",
				dumpFile: DUMP,
				sha256: SHA,
				account: ACCOUNT,
				...override,
			}),
		).toThrow(/refusing/);
	});
});

describe("the target must hold no participant data", () => {
	it("passes an empty (freshly migrated) target", () => {
		expect(
			tool.targetEmptyVerdict(
				{
					users: "0",
					markets: "0",
					bets: "0",
					comments: "0",
					dharma_ledger: "0",
				},
				false,
			),
		).toEqual({ pass: true, nonEmpty: [] });
	});

	it("REFUSES a target with any participant rows — after cutover this RDS is live production", () => {
		const v = tool.targetEmptyVerdict(
			{
				users: "12",
				markets: "6",
				bets: "0",
				comments: "0",
				dharma_ledger: "0",
			},
			false,
		);
		expect(v.pass).toBe(false);
		expect(v.nonEmpty).toEqual(["users", "markets"]);
	});

	it("allows a reload only when explicitly requested", () => {
		expect(tool.targetEmptyVerdict({ users: "12" }, true).pass).toBe(true);
	});
});

describe("the dump and the target must be at the same migration head", () => {
	const archive = (rows: number) =>
		[
			"SET statement_timeout = 0;",
			"COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;",
			...Array.from({ length: rows }, (_, i) => `${i + 1}\thash${i}\t1700${i}`),
			"\\.",
			"",
		].join("\n");

	it("counts the journal rows in the rendered archive", () => {
		expect(tool.countJournalRows(archive(32))).toBe(32);
		expect(tool.countJournalRows(archive(32).replace(/\n/g, "\r\n"))).toBe(32);
		expect(tool.countJournalRows(archive(0))).toBe(0);
	});

	it("reports -1 when the archive has no complete journal (wrong or cut-off dump)", () => {
		expect(tool.countJournalRows("SET statement_timeout = 0;\n")).toBe(-1);
		expect(
			tool.countJournalRows(
				"COPY drizzle.__drizzle_migrations (id) FROM stdin;\n1\n",
			),
		).toBe(-1);
	});

	it("passes only when both heads are equal and non-empty", () => {
		expect(tool.journalVerdict(32, "32").pass).toBe(true);
		expect(tool.journalVerdict(30, "32").pass).toBe(false);
		expect(tool.journalVerdict(32, "31").pass).toBe(false);
		expect(tool.journalVerdict(-1, "32").pass).toBe(false);
		expect(tool.journalVerdict(0, "0").pass).toBe(false);
	});

	it("reads the journal from the archive alone, with no connection", () => {
		const a = tool.dumpJournalArgs(DUMP);
		expect(a).toContain("--schema=drizzle");
		expect(a).toContain("--table=__drizzle_migrations");
		expect(a.join(" ")).toContain("-f -");
		expect(a.join(" ")).not.toContain("--dbname");
		expect(a.at(-1)).toBe(`/backup/${DUMP}`);
	});
});

describe("the load", () => {
	const [sh, flag, script] = tool.loadCommand(DUMP);
	const lines: string[] = script.split("\n");
	const render = lines.findIndex((l) => l.startsWith("pg_restore "));
	const apply = lines.findIndex((l) => l.startsWith("psql "));

	it("stops at the first failed step, so psql never runs on a bad render", () => {
		expect([sh, flag]).toEqual(["sh", "-c"]);
		expect(lines[0]).toBe("set -eu");
		expect(render).toBeGreaterThan(0);
		expect(apply).toBeGreaterThan(render);
	});

	it("renders only public + drizzle data, to a file, without a connection", () => {
		for (const f of [
			"--data-only",
			"--exit-on-error",
			"--no-owner",
			"--no-acl",
			"--schema=public",
			"--schema=drizzle",
			"-f /tmp/data.sql",
			`/backup/${DUMP}`,
		]) {
			expect(lines[render]).toContain(f);
		}
		expect(lines[render]).not.toContain("--dbname");
	});

	it("truncates and loads in ONE transaction, truncate first", () => {
		expect(lines[apply]).toContain("--single-transaction");
		expect(lines[apply]).toContain("ON_ERROR_STOP=1");
		const pre = lines[apply].indexOf('-c "$ZZ_PRE_SQL"');
		expect(pre).toBeGreaterThan(-1);
		expect(pre).toBeLessThan(lines[apply].indexOf("-f /tmp/data.sql"));
	});

	it("lists public + drizzle tables, emptying events partitions through the parent", () => {
		for (const q of Object.values(tool.TARGET_SQL) as string[]) {
			expect(q).toMatch(/^select /);
			expect(q).toContain("schemaname in ('public','drizzle')");
		}
		expect(tool.TARGET_SQL.tables).toContain("not like 'events_%'");
		expect(tool.TARGET_SQL.disable).toContain("DISABLE TRIGGER USER");
		expect(tool.TARGET_SQL.enable).toContain("ENABLE TRIGGER USER");
	});

	it("builds the truncate statements and refuses an empty table list", () => {
		expect(
			tool.preSql({
				disable: "ALTER TABLE public.a DISABLE TRIGGER USER",
				tables: "public.a,public.b",
				enable: "ALTER TABLE public.a ENABLE TRIGGER USER",
			}),
		).toBe(
			"ALTER TABLE public.a DISABLE TRIGGER USER; TRUNCATE public.a,public.b CASCADE; ALTER TABLE public.a ENABLE TRIGGER USER;",
		);
		expect(() => tool.preSql({ disable: "", tables: "", enable: "" })).toThrow(
			/refusing/,
		);
	});

	it("hashes the dump in Node and matches a known SHA-256", async () => {
		const dir = mkdtempSync(join(tmpdir(), "zz-restore-test-"));
		try {
			const f = join(dir, DUMP);
			writeFileSync(f, "abc");
			expect(await tool.sha256File(f)).toBe(
				"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("redacts connection URLs from any printed or saved output", () => {
		expect(tool.redact(`error at ${PROD_URL} end`)).toBe("error at <url> end");
	});
});

describe("execution safety (source)", () => {
	const source = readFileSync(SCRIPT, "utf8");
	it("checks the caller's AWS account before reading any secret", () => {
		const sts = source.indexOf('"get-caller-identity"');
		expect(sts).toBeGreaterThan(-1);
		expect(source.indexOf('"get-secret-value"')).toBeGreaterThan(sts);
	});
	it("only touches AWS / Docker when executed directly", () => {
		expect(source).toContain("if (require.main === module)");
	});
	it("writes credentials only to mode-0600 env files, never argv", () => {
		expect(source).toMatch(/mode: 0o600/);
		expect(source).not.toMatch(/console\.log\([^)]*PGPASSWORD/);
		/**
		 * The SQL reaches the container as NAMED ENV VARS, not argv — both of
		 * them. ⚠ This assertion read `toContain("{ ZZ_PRE_SQL: pre }")` until
		 * LAUNCH-DB-COPY-1; the literal cannot survive a second variable in the
		 * same object, so it is replaced by the two-sided form rather than
		 * dropped. Strictly stronger: it now pins both passthroughs, and that the
		 * post-load SQL is DERIVED FROM THE PARSED SOURCE rather than being a
		 * constant the tool always runs.
		 */
		expect(source).toMatch(/ZZ_PRE_SQL:\s*pre/);
		expect(source).toMatch(/ZZ_POST_SQL:\s*post/);
		expect(source).toMatch(/postSql\(\s*args\.source,\s*provenProd\s*\)/);
		expect(source).not.toMatch(/console\.log\([^)]*ZZ_POST_SQL/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH-DB-COPY-1 — the one-time staging→production copy mode. Everything
// above this line is the pre-existing prod-dump path and is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const STAGING_DUMP = "zugzwang-staging-2026-10-05T12-34-56Z.dump";
const ACK = "replace-production-with-staging";
const INSIDE_WINDOW = new Date("2026-10-05T12:00:00Z");

/** The launch-mode argument set, with one field overridden per case. */
const launchArgs = (over: Record<string, unknown> = {}) => ({
	instanceId: "i-0123456789abcdef0",
	dumpFile: STAGING_DUMP,
	sha256: SHA,
	account: ACCOUNT,
	source: "staging",
	...over,
});
/** The injected clock and environment; see the file header for the shape. */
const launchOpts = (over: Record<string, unknown> = {}) => ({
	now: INSIDE_WINDOW,
	env: { ZZ_LAUNCH_COPY_ACK: ACK },
	...over,
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("launch-copy::source", () => {
	it("is the production dump path unless --source=staging is given", () => {
		expect(tool.parseArgs(["i-0123456789abcdef0", DUMP, SHA]).source).toBe(
			"prod",
		);
		expect(
			tool.parseArgs(["i-0123456789abcdef0", DUMP, SHA, "--source=prod"])
				.source,
		).toBe("prod");
	});

	it("reads --source=staging without consuming a positional", () => {
		const a = tool.parseArgs([
			"i-0123456789abcdef0",
			STAGING_DUMP,
			SHA,
			"--source=staging",
			`--account=${ACCOUNT}`,
			"--reload-nonempty",
		]);
		expect(a.source).toBe("staging");
		expect(a.instanceId).toBe("i-0123456789abcdef0");
		expect(a.dumpFile).toBe(STAGING_DUMP);
		expect(a.sha256).toBe(SHA);
		expect(a.reloadNonEmpty).toBe(true);
		expect(a.execute).toBe(false);
	});

	it("passes an unrecognised source through for assertArgs to refuse", () => {
		expect(tool.parseArgs(["i-0", DUMP, SHA, "--source=whatever"]).source).toBe(
			"whatever",
		);
		expect(() =>
			tool.assertArgs(launchArgs({ source: "whatever" }), launchOpts()),
		).toThrow(/refusing/);
	});
});

describe("launch-copy::acknowledgement-and-expiry", () => {
	it("expires at the stated instant", () => {
		expect(tool.LAUNCH_COPY_EXPIRES_AT).toBe("2026-10-25T23:59:59Z");
		expect(Number.isFinite(Date.parse(tool.LAUNCH_COPY_EXPIRES_AT))).toBe(true);
	});

	it("accepts a staging dump with the acknowledgement, inside the window", () => {
		expect(() => tool.assertArgs(launchArgs(), launchOpts())).not.toThrow();
	});

	it("accepts a staging dump given with its directory", () => {
		expect(() =>
			tool.assertArgs(
				launchArgs({
					dumpFile: `C:\\Users\\Lenovo\\zugzwang-backups\\prod\\${STAGING_DUMP}`,
				}),
				launchOpts(),
			),
		).not.toThrow();
	});

	it("is still open at the closing instant, and shut one second later", () => {
		const at = new Date(Date.parse(tool.LAUNCH_COPY_EXPIRES_AT));
		expect(() =>
			tool.assertArgs(launchArgs(), launchOpts({ now: at })),
		).not.toThrow();
		expect(() =>
			tool.assertArgs(
				launchArgs(),
				launchOpts({ now: new Date(at.getTime() + 1000) }),
			),
		).toThrow(/refusing[\s\S]*(expir|2026-10-25)/i);
	});

	it("⛔ refuses a staging dump when the mode was not asked for", () => {
		// Without the flag the dump-name rule is the production one, which is what
		// stops a staging archive being loaded by a command that reads as routine.
		// ⚠ GREEN ON THE DAY IT WAS WRITTEN, and correctly so: today's dump-name
		// rule already refuses this. A `_probe-*`-posture regression guard, not a
		// TDD driver — it is here so that adding the staging branch cannot widen
		// the prod branch by accident.
		expect(() =>
			tool.assertArgs(launchArgs({ source: "prod" }), launchOpts()),
		).toThrow(/refusing/);
		expect(() =>
			tool.assertArgs(launchArgs({ source: undefined }), launchOpts()),
		).toThrow(/refusing/);
	});

	it("⛔ refuses the mode with a production dump", () => {
		// The mode clears the session tables after the load. Running it over a
		// production dump would silently sign every real participant out.
		expect(() =>
			tool.assertArgs(launchArgs({ dumpFile: DUMP }), launchOpts()),
		).toThrow(/refusing/);
	});

	/**
	 * ⛔ THE REFUSAL MUST NAME THE ACKNOWLEDGEMENT (O-3: a true refusal reported
	 * with a misleading cause is a defect). Without that, every row below passes
	 * TODAY and vacuously — the current dump-name rule already throws on a
	 * `zugzwang-staging-*.dump`, so an `assertArgs` with no acknowledgement check
	 * at all satisfies a bare `/refusing/`. Pinning the variable's name is what
	 * makes these tests about the guard they are named for, and it is what the
	 * operator needs to read at 2 a.m. anyway.
	 */
	it.each([
		["no acknowledgement at all", {}],
		["an empty acknowledgement", { ZZ_LAUNCH_COPY_ACK: "" }],
		["a casual one", { ZZ_LAUNCH_COPY_ACK: "yes" }],
		["the wrong case", { ZZ_LAUNCH_COPY_ACK: ACK.toUpperCase() }],
		[
			"the sentence the other way round",
			{ ZZ_LAUNCH_COPY_ACK: "replace-staging-with-production" },
		],
		["the plan's own prose", { ZZ_LAUNCH_COPY_ACK: "include-content-markets" }],
	])("refuses %s", (_label, env) => {
		expect(() => tool.assertArgs(launchArgs(), launchOpts({ env }))).toThrow(
			/refusing[\s\S]*ZZ_LAUNCH_COPY_ACK/,
		);
	});

	it("reads the acknowledgement from the process environment by default", () => {
		// `main()` passes no options, so the default has to be the real thing —
		// and it has to be the ABSENCE that refuses, not the presence that is
		// assumed.
		vi.stubEnv("ZZ_LAUNCH_COPY_ACK", undefined);
		expect(() => tool.assertArgs(launchArgs(), { now: INSIDE_WINDOW })).toThrow(
			/refusing[\s\S]*ZZ_LAUNCH_COPY_ACK/,
		);
		vi.stubEnv("ZZ_LAUNCH_COPY_ACK", ACK);
		expect(() =>
			tool.assertArgs(launchArgs(), { now: INSIDE_WINDOW }),
		).not.toThrow();
	});

	/**
	 * Each row names the message it must provoke, for the same reason as above:
	 * with a bare `/refusing/` the short-hash row passes today on the dump-name
	 * rule, which is a different guard entirely.
	 */
	it.each([
		["a non-instance target", { instanceId: "prod-db" }, /instance id/i],
		[
			"a stampless staging dump",
			{ dumpFile: "zugzwang-staging-nonsense.dump" },
			/dump/i,
		],
		["a short hash", { sha256: "abc" }, /SHA-256/i],
		["no --account", { account: undefined }, /account/i],
	])("still applies every other rule in the launch mode: %s", (_l, over, msg) => {
		expect(() => tool.assertArgs(launchArgs(over), launchOpts())).toThrow(msg);
	});

	it("⛔ leaves the ROLLBACK path open forever — no ack, no window", () => {
		/**
		 * ⚠ GREEN ON THE DAY IT WAS WRITTEN — there is no expiry yet to get this
		 * wrong. It is a regression guard against the implementation that is about
		 * to be written, and it is the one that would otherwise be discovered in
		 * the worst possible hour.
		 *
		 * §7: when verification fails, the repair is this same tool loading the
		 * production dump taken at step 3b. That path must not acquire the launch
		 * mode's acknowledgement, and must not expire — an expiry check placed
		 * before the source branch takes the rollback away on 26 October, and
		 * nothing would show it until the day it was needed.
		 */
		expect(() =>
			tool.assertArgs(
				{
					instanceId: "i-0123456789abcdef0",
					dumpFile: DUMP,
					sha256: SHA,
					account: ACCOUNT,
					source: "prod",
				},
				{ now: new Date("2027-06-01T00:00:00Z"), env: {} },
			),
		).not.toThrow();
	});
});

describe("launch-copy::post-load-session-clear", () => {
	it("clears the three session tables and the OAuth tokens after a staging load", () => {
		expect(tool.postSql("staging")).toBe(
			"DELETE FROM public.sessions; DELETE FROM public.verifications; DELETE FROM public.admin_sessions; UPDATE public.accounts SET access_token = NULL, refresh_token = NULL, id_token = NULL;",
		);
		// A manifest cannot switch the clear off in the launch mode.
		expect(tool.postSql("staging", true)).toBe(tool.CLEAR_SQL);
	});

	it("nulls only the three token columns of accounts, and updates nothing else", () => {
		/**
		 * @security-auditor M-4. Staging-issued Google tokens must not sit in
		 * production's database; nothing in src/ reads them. The provider link
		 * (provider_id, account_id) is what signs a user in, so it is untouched.
		 */
		const sql: string = tool.CLEAR_SQL;
		const updates = [...sql.matchAll(/UPDATE ([a-z_.]+) SET ([^;]+);/g)];
		expect(updates.map((m) => m[1])).toEqual(["public.accounts"]);
		expect(updates[0][2]).toBe(
			"access_token = NULL, refresh_token = NULL, id_token = NULL",
		);
		expect(sql).not.toMatch(/\bWHERE\b/i);
	});

	it("names exactly those three tables and no other", () => {
		/**
		 * ⛔ THE SECURITY STATEMENT OF THIS WHOLE PR. An admin cookie is a bare
		 * session id checked by a database lookup, so a surviving staging
		 * `admin_sessions` row is a valid PRODUCTION admin session. A fourth table
		 * here would be collateral damage inside a transaction that cannot be
		 * inspected before it commits; a missing one is an open door.
		 */
		const sql: string = tool.postSql("staging");
		const tables = [...sql.matchAll(/DELETE FROM ([a-z_.]+)/g)].map(
			(m) => m[1],
		);
		expect(tables).toEqual([
			"public.sessions",
			"public.verifications",
			"public.admin_sessions",
		]);
		expect(sql).not.toMatch(/TRUNCATE|CASCADE|DROP/i);
		expect(sql.trim().endsWith(";")).toBe(true);
	});

	it("⛔ clears on the production-dump path UNLESS a manifest proves a production dump", () => {
		/**
		 * @security-auditor M-2. The polarity is clear-unless-proven: a staging
		 * archive renamed zugzwang-prod-*.dump WITHOUT its manifest used to load
		 * with staging's admin_sessions intact. Only `provenProd === true` keeps
		 * the sessions; a truthy non-boolean does not.
		 */
		expect(tool.postSql("prod", true)).toBe("");
		expect(tool.postSql("prod")).toBe(tool.CLEAR_SQL);
		expect(tool.postSql("prod", false)).toBe(tool.CLEAR_SQL);
		expect(tool.postSql("prod", "yes")).toBe(tool.CLEAR_SQL);
		expect(tool.postSql(undefined)).toBe(tool.CLEAR_SQL);
	});

	it("proves a production dump only from a manifest naming the production RDS with this SHA", () => {
		const source = readFileSync(SCRIPT, "utf8");
		expect(source).toMatch(/m\.env === "prod"/);
		expect(source).toMatch(/\/production\/\.test\(String\(m\.host\)\)/);
		expect(source).toMatch(/!\/staging\/\.test\(String\(m\.host\)\)/);
		expect(source).toMatch(/m\.sha256 === args\.sha256/);
		expect(source).toMatch(/let provenProd = false;/);
	});

	it("deletes the same three tables the manifest expects to find empty", () => {
		/**
		 * Coherence with `lib/fingerprint.cjs`: `CLEARED_TABLES` is what
		 * `launch-verify.cjs` requires to be at zero. If the two lists ever
		 * disagree, one tool clears a table the other does not check — and the
		 * direction that matters leaves staging's admin sessions live in
		 * production with a green verification beside them. Required lazily so
		 * this coupling fails on its own line rather than taking the file down.
		 */
		// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
		const fp: any = require(
			join(REPO_ROOT, "scripts/aws-migration/lib/fingerprint.cjs"),
		);
		const cleared: string[] = [
			...(tool.postSql("staging") as string).matchAll(
				/DELETE FROM ([a-z_.]+)/g,
			),
		].map((m) => m[1]);
		expect([...cleared].sort()).toEqual([...fp.CLEARED_TABLES].sort());
	});
});

/**
 * ⚠ Three of the four tests here are regression-posture and were GREEN on the
 * day they were written: the shipped command already runs exactly one psql,
 * already carries no SQL of its own, and already takes only a base name. They
 * are written down because the change about to be made is "add one more `-c` to
 * that invocation", and the way that goes wrong is a SECOND invocation — which
 * is a second transaction, which is a load that can commit without its session
 * clear. The ordering test below is the one that is red.
 */
describe("launch-copy::one-transaction", () => {
	const [sh, flag, script] = tool.loadCommand(STAGING_DUMP) as [
		string,
		string,
		string,
	];
	const lines = script.split("\n");
	const apply = lines.findIndex((l) => l.startsWith("psql "));

	it("keeps the two-step shape: render first, then one psql", () => {
		expect([sh, flag]).toEqual(["sh", "-c"]);
		expect(lines[0]).toBe("set -eu");
		expect(lines.filter((l) => l.startsWith("psql ")).length).toBe(1);
		expect((script.match(/--single-transaction/g) ?? []).length).toBe(1);
	});

	it("⛔ truncates, loads and clears inside ONE transaction, in that order", () => {
		/**
		 * The session clear has to be in the same transaction as the load. Run
		 * afterwards, a failure between the two leaves production holding
		 * staging's rows AND staging's admin sessions; and the plan's own fallback
		 * wording ("or immediately after") is exactly the version this pins
		 * against.
		 */
		const line = lines[apply];
		const pre = line.indexOf('-c "$ZZ_PRE_SQL"');
		const data = line.indexOf("-f /tmp/data.sql");
		const post = line.indexOf('"$@"');
		expect(pre).toBeGreaterThan(-1);
		expect(data).toBeGreaterThan(pre);
		expect(post).toBeGreaterThan(data);
		expect(line).toContain("ON_ERROR_STOP=1");
		// "$@" carries the post-SQL, and only when there is some — so the
		// prod-dump mode passes psql no extra -c at all.
		const before = lines.slice(0, apply);
		expect(before).toContain(
			'set --; if [ -n "$ZZ_POST_SQL" ]; then set -- -c "$ZZ_POST_SQL"; fi',
		);
	});

	it("carries no SQL in the command itself", () => {
		// Both statements arrive as env vars, so neither the truncate list nor the
		// session clear can be read off a process list.
		expect(script).not.toMatch(/DELETE FROM/i);
		expect(script).not.toMatch(/TRUNCATE/i);
	});

	it("still takes only the dump's base name", () => {
		expect(tool.loadCommand.length).toBe(1);
		expect(script).toContain(`/backup/${STAGING_DUMP}`);
	});
});
