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
		const a = tool.parseArgs([
			"i-0123456789abcdef0",
			"zugzwang-prod-2026-10-01T10-00-00Z.dump",
			SHA,
		]);
		expect(a.execute).toBe(false);
		expect(a.reloadNonEmpty).toBe(false);
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

	it("accepts a production backup file and a 64-hex SHA-256", () => {
		expect(() =>
			tool.assertArgs({
				instanceId: "i-0123456789abcdef0",
				dumpFile: "C:\\backups\\zugzwang-prod-2026-10-01T10-00-00Z.dump",
				sha256: SHA,
			}),
		).not.toThrow();
	});

	it.each([
		[
			"a non-instance target",
			{
				instanceId: "prod-db",
				dumpFile: "zugzwang-prod-2026-10-01T10-00-00Z.dump",
				sha256: SHA,
			},
		],
		[
			"a staging-named dump",
			{
				instanceId: "i-0123456789abcdef0",
				dumpFile: "zugzwang-staging-2026.dump",
				sha256: SHA,
			},
		],
		[
			"a short hash",
			{
				instanceId: "i-0123456789abcdef0",
				dumpFile: "zugzwang-prod-2026-10-01T10-00-00Z.dump",
				sha256: "abc",
			},
		],
	])("refuses %s", (_label, a) => {
		expect(() => tool.assertArgs(a)).toThrow(/refusing/);
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

describe("the load", () => {
	it("is all-or-nothing: --single-transaction, --exit-on-error, data only, public + drizzle", () => {
		const args = tool.pgRestoreArgs("zugzwang-prod-2026-10-01T10-00-00Z.dump");
		for (const flag of [
			"--data-only",
			"--single-transaction",
			"--exit-on-error",
			"--no-owner",
			"--no-acl",
			"--schema=public",
			"--schema=drizzle",
			"--dbname=zugzwang",
		]) {
			expect(args).toContain(flag);
		}
		expect(args.at(-1)).toBe("/backup/zugzwang-prod-2026-10-01T10-00-00Z.dump");
	});

	it("hashes the dump in Node and matches a known SHA-256", async () => {
		const dir = mkdtempSync(join(tmpdir(), "zz-restore-test-"));
		try {
			const f = join(dir, "zugzwang-prod-2026-10-01T10-00-00Z.dump");
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
	it("only touches AWS / Docker when executed directly", () => {
		expect(source).toContain("if (require.main === module)");
	});
	it("writes credentials only to mode-0600 env files", () => {
		expect(source).toMatch(/mode: 0o600/);
		expect(source).not.toMatch(/console\.log\([^)]*PGPASSWORD/);
	});
});
