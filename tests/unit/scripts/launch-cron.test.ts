import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LAUNCH-DB-COPY-1, `@code-reviewer` C-2 — production's pg_cron jobs around the
 * launch restore.
 *
 * The copied `liquidity_policy` is staging's, and its injector is ENABLED. The
 * restore used to pause every job and then re-arm every job the moment the
 * load committed — so the injector would rewrite production's pools within a
 * minute, before the code promote and before verification (whose census would
 * then fail on `pools` and `events` every time). Now:
 *   - the restore snapshots WHICH jobs were active, pauses them, and restores
 *     exactly that snapshot — except after a SUCCESSFUL launch load, when it
 *     leaves them paused and saves the ids beside the dump;
 *   - `launch-cron.cjs` re-arms exactly those ids after writes are open.
 *
 * Written with the fix (not before it): these are regression guards, proven by
 * the source scans' positive controls rather than by having been red.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: CommonJS scripts without types.
const restore: any = require(
	join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs"),
);
// biome-ignore lint/suspicious/noExplicitAny: CommonJS scripts without types.
const cron: any = require(
	join(REPO_ROOT, "scripts/aws-migration/launch-cron.cjs"),
);

function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const RESTORE = code(
	readFileSync(
		join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs"),
		"utf8",
	),
);
const CRON_SOURCE = readFileSync(
	join(REPO_ROOT, "scripts/aws-migration/launch-cron.cjs"),
	"utf8",
);
const CRON = code(CRON_SOURCE);

describe("launch-cron::job-ids", () => {
	it("parses the active-job list the restore snapshots", () => {
		expect(restore.parseJobIds("1,3,5")).toEqual([1, 3, 5]);
		expect(restore.parseJobIds("")).toEqual([]);
		expect(restore.parseJobIds(" ")).toEqual([]);
	});

	it.each([["1,x"], ["1;2"], ["-1"], ["1.5"]])("refuses %s", (text) => {
		expect(() => restore.parseJobIds(text)).toThrow(/refusing/);
	});

	it("re-arms exactly the given jobs, and nothing when there are none", () => {
		expect(restore.rearmSql([2, 7])).toBe(
			"update cron.job set active = true where jobid in (2,7)",
		);
		expect(restore.rearmSql([])).toBe("");
		expect(() => restore.rearmSql([1, -2])).toThrow(/refusing/);
		expect(() => restore.rearmSql(["1); drop"])).toThrow(/refusing/);
	});

	it("reads the saved list and refuses a malformed one", () => {
		expect(
			cron.readSavedJobIds({ env: "prod", activeBefore: [1, 4] }, "prod"),
		).toEqual([1, 4]);
		expect(
			cron.readSavedJobIds({ env: "staging", activeBefore: [] }, "staging"),
		).toEqual([]);
		for (const bad of [
			{ env: "prod" },
			{ env: "prod", activeBefore: "1,4" },
			{ env: "prod", activeBefore: [1, "x"] },
			null,
		]) {
			expect(() => cron.readSavedJobIds(bad, "prod")).toThrow(/refusing/);
		}
	});

	it("refuses a record written for the other environment, or for none", () => {
		// @security-auditor L-6: one environment's job ids applied to the other's
		// cron.job would switch the wrong jobs.
		expect(() =>
			cron.readSavedJobIds({ env: "staging", activeBefore: [1] }, "prod"),
		).toThrow(/env="staging"/);
		expect(() => cron.readSavedJobIds({ activeBefore: [1] }, "prod")).toThrow(
			/refusing/,
		);
	});
});

describe("launch-cron::the restore no longer re-arms everything", () => {
	it("the scanner sees a blanket statement when one is there (positive control)", () => {
		const blanket = /set active = true["'`]\s*\)/;
		expect(blanket.test('q("update cron.job set active = true")')).toBe(true);
	});

	it("⛔ has no blanket 'set active = true' — the resume is the snapshot", () => {
		expect(RESTORE).not.toMatch(/set active = true["'`]\s*\)/);
		expect(RESTORE).toMatch(/rearmSql\(activeJobs\)/);
		expect(RESTORE).toMatch(/where active/);
	});

	it("⛔ leaves the jobs paused only after a SUCCESSFUL launch load", () => {
		expect(RESTORE).toMatch(/args\.source === "staging" && r\?\.status === 0/);
		expect(RESTORE).toContain(".cron-jobs.json");
	});

	it("⛔ never overwrites the resume record — a re-run's snapshot is empty", () => {
		/**
		 * @security-auditor H-1. A sanctioned re-run (--reload-nonempty) finds
		 * every job already paused; written over the first run's record, its
		 * empty snapshot made the resume re-arm nothing and report DONE, leaving
		 * the injector and the alarm that watches it off. The record is written
		 * exclusively, an existing one is kept, and it names its environment.
		 */
		const keep = RESTORE.slice(RESTORE.indexOf("if (keepPaused)"));
		expect(keep).toMatch(/fs\.existsSync\(record\)/);
		expect(keep).toMatch(/flag:\s*"wx"/);
		expect(keep).toMatch(/env:\s*"prod"/);
		const write = keep.search(/fs\.writeFileSync\(\s*record/);
		expect(write).toBeGreaterThan(-1);
		expect(keep.indexOf("fs.existsSync(record)")).toBeLessThan(write);
	});
});

describe("launch-cron::the pause/resume tool", () => {
	const ARGS = [
		"pause",
		"staging",
		"i-0123456789abcdef0",
		"stg-cron.json",
		"--account=849076101704",
	];

	it("parses mode, environment, instance, state file and account", () => {
		expect(cron.assertArgs(cron.parseArgs(ARGS))).toMatchObject({
			mode: "pause",
			env: "staging",
			stateFile: "stg-cron.json",
			execute: false,
		});
		expect(cron.parseArgs([...ARGS, "--execute"]).execute).toBe(true);
	});

	it.each([
		["a mode other than pause/resume", 0, "rearm"],
		["an unknown environment", 1, "production"],
		["a non-instance id", 2, "zugzwang-prod"],
		["a state path that is not .json", 3, "stg-cron.txt"],
		["a missing account", 4, "--account="],
	])("refuses %s", (_label, i, value) => {
		const argv = [...ARGS];
		argv[i as number] = value as string;
		expect(() => cron.assertArgs(cron.parseArgs(argv))).toThrow(/refusing/);
	});

	it("pauses exactly the given jobs, and nothing when there are none", () => {
		expect(cron.pauseSql([1, 3])).toBe(
			"update cron.job set active = false where jobid in (1,3)",
		);
		expect(cron.pauseSql([])).toBe("");
		expect(() => cron.pauseSql([1, "2; drop"])).toThrow(/refusing/);
	});

	it("pauses only inside the launch window; resumes always", () => {
		expect(CRON).toMatch(
			/if\s*\(args\.execute && args\.mode === "pause"\)\s*assertLaunchWindow\(\)/,
		);
		expect(CRON).toMatch(/readSavedJobIds\(\s*JSON\.parse[\s\S]*?args\.env,/);
	});

	it("is check-only until --execute is given", () => {
		expect(CRON).toContain("--execute");
		expect(CRON).toMatch(/if\s*\(\s*!\s*args\.execute\b/);
	});

	it("changes only cron.job's active flag", () => {
		expect(CRON).toMatch(/rearmSql\(ids\)/);
		expect(CRON).toMatch(/pauseSql\(ids\)/);
		expect(CRON).not.toMatch(/\b(truncate|delete|insert|drop|alter)\b/i);
	});

	it("⛔ never overwrites the record of what to resume", () => {
		expect(CRON).toMatch(/flag:\s*"wx"/);
		expect(CRON).toMatch(/already exists/);
	});

	it("checks the database is the environment named, and the account before the secret", () => {
		expect(CRON).toContain("assertEnvTarget(args.env");
		const sts = CRON.indexOf("get-caller-identity");
		expect(sts).toBeGreaterThan(-1);
		expect(CRON.indexOf("get-secret-value")).toBeGreaterThan(sts);
	});

	it("only reaches AWS or a database when executed directly", () => {
		expect(CRON_SOURCE).toContain("if (require.main === module)");
	});
});
