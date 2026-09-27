import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";

/**
 * Readiness item 17 — `scripts/aws-migration/prod-restore.cjs`. Its guards and
 * argument builders are pure exported functions (the tunnel, Docker and AWS calls
 * run only when executed directly), so this exercises the real logic.
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
		// the truncate SQL reaches the container as a named env var, not argv
		expect(source).toContain("{ ZZ_PRE_SQL: pre }");
	});
});
