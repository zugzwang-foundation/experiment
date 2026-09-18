import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// MKT-ROSTER-1 · ONE-TIME — the guards that constrain the production tooling
// WITHOUT touching a database. This file is an ordinary unit test and is
// collected by the default suite, deliberately: it is the only thing in the lane
// that runs in CI, and the claims it pins are the ones a reader would otherwise
// have to take on trust.
//
// ⛔⛔ THE LANE'S ISOLATION IS BY FILENAME, NOT BY AN EXCLUDE. The staging
// runners are isolated because `vitest.config.ts` EXCLUDES `tests/staging/**`.
// Copying that would mean editing a file on `main` from a branch whose whole
// safety property is that it never merges. So the production runner is named
// `*.prod-runner.ts`, which matches no shipped include pattern — and THAT is
// what these tests check, because "a name that does not match" is exactly the
// kind of claim that reads as obviously true and stops being true the moment
// somebody renames a file to `.test.ts` for convenience.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/**
 * ⛔⛔ EVERY NEGATIVE SCAN BELOW READS `code()`, NEVER `read()`, AND THAT IS NOT
 * TIDINESS. Two of these assertions went red on their FIRST run against the
 * COMMENT EXPLAINING THE ABSENCE — `not.toContain("staging-markets-snapshot.json")`
 * matched a docblock warning never to read that file. AGENTS.md §9 records six
 * prior instances of exactly this shape in this repository, which is how a real
 * guard gets "fixed" by being weakened. Strip the comments, then scan.
 *
 * ⛔⛔ AND THE OBVIOUS STRIPPER IS WRONG HERE, WHICH IS WORTH THE FOUR LINES IT
 * COSTS TO SAY. A general `/\*[\s\S]*?\*\/` ate the config files whole, because
 * a VITEST GLOB CONTAINS BOTH DELIMITERS: `"tests/**\/*.{test,spec}.{ts,tsx}"`
 * opens with `/*` and the next `*\/` is several rules later. Three assertions
 * went red reporting that a config did not contain its own `include` line — a
 * true failure with a completely misleading cause (§8 O-3).
 *
 * ⇒ Block comments are stripped only when the opener is LINE-ANCHORED, which is
 * what a docblock is and what a glob never is. Line comments likewise. Crude on
 * purpose — a scanner for source this lane owns, not a parser — and every
 * negative use is preceded by a `toContain` POSITIVE CONTROL, so a stripper that
 * ate too much reds rather than passes. That control is what caught this.
 */
const code = (p: string): string =>
	read(p)
		.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
		.replace(/^[ \t]*\/\/.*$/gm, "");

describe("the production lane cannot be reached by a bare vitest run", () => {
	it("prod-onetime::the-default-config-does-not-exclude-this-directory", () => {
		// ⛔ THE CONTROL, AND IT ASSERTS THE UNCOMFORTABLE FACT RATHER THAN THE
		// comfortable one. If a future edit DID add `tests/prod-onetime/**` to the
		// exclude list, the filename argument below would become belt-and-braces
		// rather than load-bearing — and this test would red, which is the right
		// moment to reconsider which mechanism the lane is relying on.
		const cfg = code("vitest.config.ts");
		expect(cfg).toContain('"tests/staging/**"');
		expect(cfg).not.toContain("tests/prod-onetime");
	});

	it("prod-onetime::no-runner-file-matches-the-default-include-pattern", () => {
		// `vitest.config.ts` includes `tests/**/*.{test,spec}.{ts,tsx}`. The runner
		// is `content-markets.prod-runner.ts`, which matches none of those endings.
		// Asserted against the shipped name, so a rename to `.test.ts` reds here.
		const cfg = code("vitest.config.ts");
		expect(cfg).toContain('"tests/**/*.{test,spec}.{ts,tsx}"');
		const runner = "tests/prod-onetime/content-markets.prod-runner.ts";
		expect(() => read(runner)).not.toThrow();
		for (const ending of [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]) {
			expect(runner.endsWith(ending)).toBe(false);
		}
	});

	it("prod-onetime::its-own-config-includes-only-that-pattern", () => {
		const cfg = code("vitest.prod-onetime.config.ts");
		expect(cfg).toContain(
			'include: ["tests/prod-onetime/**/*.prod-runner.ts"]',
		);
		// Watch mode on a destructive operational artifact is the first of the
		// three plausible keystrokes ADR-0035's Addendum names.
		expect(cfg).toContain("watch: false");
	});

	it("prod-onetime::it-does-NOT-use-the-shipped-production-ref-guard", () => {
		// The shipped guard REFUSES a production ref and would refuse this run
		// before a worker forked, so the lane carries its own INVERTED setup. The
		// point of pinning it is that "we removed the guard" and "we inverted it"
		// look identical in a diff stat and are completely different in effect.
		const cfg = code("vitest.prod-onetime.config.ts");
		expect(cfg).toContain("./tests/prod-onetime/_setup/prod-ref-allow.ts");
		expect(cfg).not.toContain("production-ref-guard");

		const setup = code("tests/prod-onetime/_setup/prod-ref-allow.ts");
		// It must still REFUSE something, or it is not a guard.
		expect(setup).toContain("rwfdoqzsghqhhdapxafg"); // staging, refused
		expect(setup).toContain("zbvprdcyxhlguxbostdj"); // production, required
	});

	it("prod-onetime::the-shipped-staging-guards-are-byte-identical-to-main", () => {
		// ⛔⛔ THE WALL, AND IT IS A TREE HASH BECAUSE NOTHING WEAKER WORKS.
		//
		// This assertion used to read `expect(target).toContain("PRODUCTION_PROJECT_REF")`
		// while its docblock claimed "every sentence the staging target guard turns
		// on must still be there." `@security-auditor` caught the gap: an
		// identifier-presence check survives a ONE-CHARACTER INVERSION of the
		// refusal it is meant to protect — `if (!url.includes(PRODUCTION_PROJECT_REF))`
		// contains the identifier and means the opposite. The one thing this lane
		// must never do is widen a refusal that lives on `main`, and a substring
		// cannot see that happen.
		//
		// A tree hash can. `git rev-parse <ref>:<dir>` is the hash of the whole
		// subtree, so any change to any byte of any file under `_lib/` moves it.
		// It is also a POSITIVE receipt — a value to quote — rather than the
		// silence of an empty diff, which is indistinguishable from a command that
		// never ran (§8 O-13).
		const git = (...args: string[]): string =>
			execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
		const rev = (ref: string): string =>
			git("rev-parse", `${ref}:tests/staging/_lib`);

		/**
		 * ⛔⛔ `origin/main` DOES NOT EXIST IN CI, AND THIS TEST WOULD HAVE THROWN
		 * THERE RATHER THAN PASSED. Measured, not assumed: `ci.yml:69` is
		 * `actions/checkout@v5` with no `fetch-depth`, the workflow issues
		 * `git fetch` ZERO times, and a depth-1 clone of this repository cannot
		 * resolve `origin/main` (`fatal: ambiguous argument 'origin/main'`).
		 *
		 * ⚠ The failure mode is the inverted one and is worth naming: not a false
		 * pass, but a RED on the one PR that touches production — and reviewers
		 * trained to expect that red are reviewers who stop reading it.
		 *
		 * So the base is resolved in order: the local remote-tracking ref, else a
		 * shallow fetch of the branch CI is merging into (`GITHUB_BASE_REF` when
		 * set, `main` otherwise). If NEITHER resolves it still throws — an
		 * unverifiable wall is reported as unverifiable, never as intact (§8 O-13).
		 */
		const baseTree = (): string => {
			try {
				return rev("origin/main");
			} catch {
				const branch = process.env.GITHUB_BASE_REF || "main";
				git("fetch", "--depth=1", "origin", branch);
				return rev("FETCH_HEAD");
			}
		};

		// ⛔ NO try/catch AROUND THE FIRST READ. If `origin/main` is not fetched,
		// this throws and the wall is reported as UNVERIFIABLE rather than as
		// intact — which is the whole of O-13: an answer that could not be
		// obtained is not a passing answer.
		const onMain = baseTree();
		const onBranch = rev("HEAD");
		expect(onMain).toMatch(/^[0-9a-f]{40}$/);
		expect(
			onBranch,
			`tests/staging/_lib differs from origin/main (${onMain} vs ${onBranch})`,
		).toBe(onMain);

		// ⛔⛔ AND THE WORKING TREE, WHICH THE TREE HASH CANNOT SEE. A tree hash is
		// a property of a COMMIT, so an uncommitted edit to a shipped guard is
		// invisible to the two reads above. Found by mutation: appending one
		// newline to `tests/staging/_lib/target.ts` left this test green. For a
		// merged PR the committed comparison is the whole question; for a run
		// happening NOW, on a machine, against a live database, the file on disk
		// is what executes.
		const dirty = execFileSync(
			"git",
			["status", "--porcelain", "--", "tests/staging/_lib"],
			{ cwd: ROOT, encoding: "utf8" },
		).trim();
		expect(dirty, `tests/staging/_lib has uncommitted changes:\n${dirty}`).toBe(
			"",
		);

		// The staging seeder's `--env prod` refusal stays a refusal — a separate
		// file, so a separate check.
		expect(code("scripts/seed-content-markets.ts")).toContain(
			"REFUSED — there is no production path, by design.",
		);
	});
});

describe("the wipe never weakens a guard it is not authorised to weaken", () => {
	it("prod-onetime::the-batch-is-generated-not-transcribed", async () => {
		// ⛔ ZERO TRANSCRIPTION IS THE SAFETY PROPERTY, so it is asserted rather
		// than described: the production tool must build its batch from the SAME
		// function the shipped staging reset calls. A hand-typed batch is the
		// cheapest possible way to disable a guard nobody meant to disable.
		const wipe = code("scripts/_onetime/mkt-roster-1-prod-wipe.ts");
		expect(wipe).toContain('from "../../tests/staging/_lib/reset"');
		expect(wipe).toContain("buildResetBatch(TRUNCATE_SET)");
		// No literal ALTER/TRUNCATE anywhere in the tool.
		expect(wipe).not.toMatch(/ALTER TABLE \w+ DISABLE TRIGGER/);
		expect(wipe).not.toMatch(/TRUNCATE \w+/);
	});

	it("prod-onetime::the-generated-batch-touches-no-NEVER-disabled-guard", async () => {
		const { buildResetBatch } = await import("../../staging/_lib/reset");
		const { TRUNCATE_SET, NEVER_DISABLED_GUARD_NAMES, TRUNCATE_EXCLUSIONS } =
			await import("../../staging/_lib/guards");
		const batch = buildResetBatch(TRUNCATE_SET);

		// POSITIVE CONTROL FIRST — prove the batch is the thing we think it is
		// before reading anything out of it. An empty string satisfies every
		// `not.toContain` below.
		expect(batch).toContain("bucket_a_no_truncate");
		expect(batch.split("\n").length).toBeGreaterThan(40);

		for (const guard of NEVER_DISABLED_GUARD_NAMES) {
			expect(batch).not.toContain(guard);
		}
		// `lots_no_delete` sits deliberately outside the `bucket_%` family, so it
		// is in no list — assert it directly rather than trusting the loop above.
		expect(batch).not.toContain("lots_no_delete");
		for (const excluded of TRUNCATE_EXCLUSIONS) {
			expect(batch).not.toMatch(new RegExp(`TRUNCATE[^;]*\\b${excluded}\\b`));
		}
	});

	it("prod-onetime::every-resolved-host-is-checked-not-the-joined-string", () => {
		// ⛔⛔ A MEASURED BYPASS (`@security-auditor`, MEDIUM). postgres-js dials a
		// comma-separated authority as MULTIHOST, in order, while
		// `[evil, x.supabase.com].join(",").endsWith(".supabase.com")` is true — so
		// a joined-string check is satisfied by the LAST host while the driver
		// connects to the FIRST. Both guard files must refuse a comma outright and
		// must filter the host ARRAY rather than its join.
		const target = code("tests/prod-onetime/_lib/prod-target.ts");
		expect(target).toContain('h.includes(",")');
		const client = code("tests/prod-onetime/_lib/prod-client.ts");
		expect(client).toContain("hosts.filter(");
		expect(client).not.toContain(
			'host.toLowerCase().endsWith(".supabase.com")',
		);
		const wipe = code("scripts/_onetime/mkt-roster-1-prod-wipe.ts");
		expect(wipe).toContain("assertEveryHostIsSupabase(hosts)");
		// ⛔ AND THE SETUP MUST SCAN EVERY VARIABLE FOR THE STAGING REF, NOT ONLY
		// `DATABASE_URL*`. ⚠ Asserted as a PROPERTY, not a substring: the file has
		// two loops with a byte-identical header, so
		// `toContain("for (const [name, value] of Object.entries(env)) {")` was
		// already true BEFORE the fix and pinned nothing. What distinguishes the
		// two states is whether the ref scan is guarded by the name filter.
		const setup = code("tests/prod-onetime/_setup/prod-ref-allow.ts");
		const refScan = setup.slice(setup.indexOf("STAGING_PROJECT_REF)"));
		const firstLoop = setup.slice(
			setup.indexOf("Object.entries(env)"),
			setup.indexOf("STAGING_PROJECT_REF)"),
		);
		expect(refScan.length).toBeGreaterThan(0);
		expect(
			firstLoop,
			"the staging-ref scan must NOT be narrowed to DATABASE_URL* — the guard it mirrors scans every variable",
		).not.toContain("DATABASE_URL_NAME.test(name)");
	});

	it("prod-onetime::the-ratified-state-gates-run-at-the-DESTRUCTIVE-moment", () => {
		// ⛔⛔ THE CRITICAL FINDING, PINNED. `--preflight` and `--wipe` are separate
		// process invocations with 30–90 minutes of §B3.3 between them, during
		// which production is live and accepting sign-ins. A signup moves `users`
		// and NOT `markets`, so the acknowledgement token still matches — and G-4
		// cannot see an extra user. Both phases must call the same gate function.
		const wipe = code("scripts/_onetime/mkt-roster-1-prod-wipe.ts");
		const calls = wipe.split("assertRatifiedState(sql)").length - 1;
		expect(
			calls,
			"assertRatifiedState must be called by BOTH --preflight and --wipe",
		).toBe(2);
		// ⛔⛔ AND THE GATES MUST BE INSIDE IT, NOT MERELY SOMEWHERE IN THE FILE.
		// A first version sliced from the declaration to EOF, which swept in
		// `preflight`, `assertSnapshotFidelity`, `capture`, `wipe`, `verify` and
		// `main` — so `toContain("assertSnapshotFidelity")` was satisfied by that
		// function's own DECLARATION, and moving the A5 call back into
		// `preflight()` alone would have left this green while reopening the
		// CRITICAL it exists to pin. Bound the slice at the next top-level
		// function instead.
		const start = wipe.indexOf("async function assertRatifiedState");
		expect(start, "assertRatifiedState must exist").toBeGreaterThan(-1);
		const after = wipe.slice(start + 1);
		const endRel = after.search(/\n(?:async )?function /);
		const body = endRel === -1 ? after : after.slice(0, endRel);
		expect(body.length, "the sliced body must be non-empty").toBeGreaterThan(
			200,
		);
		for (const gate of [
			"STOP-P0",
			"assertSnapshotFidelity",
			"EXPECTED_SLUGS",
			"assertOwnership",
		]) {
			expect(body, `${gate} must be INSIDE assertRatifiedState`).toContain(
				gate,
			);
		}
	});

	it("prod-onetime::the-restore-reads-PRODUCTION's-own-snapshot", () => {
		// ⛔⛔ THE SINGLE MOST CONSEQUENTIAL LINE IN THE LANE. Production and
		// staging hold the same slugs with DIFFERENT ids and DIFFERENT copy, so
		// seeding production from the staging snapshot would replace the founder's
		// production text and orphan every surviving R2 object — and every other
		// assertion in the restore would still pass.
		const loader = code("tests/prod-onetime/prod-content-markets.ts");
		expect(loader).toContain("prod-markets-snapshot.json");
		expect(loader).not.toContain("staging-markets-snapshot.json");
		// And it re-checks provenance at RUNTIME, not just by path.
		// ⚠ Asserted as the IMPORTED CONSTANT rather than a literal: the ref had
		// been hardcoded here as a third copy, against `guards.ts`'s own rule that
		// anything in code needing it imports the one constant
		// (`@security-auditor`, LOW). A literal assertion would have quietly
		// rewarded keeping the duplicate.
		expect(loader).toContain("PRODUCTION_PROJECT_REF");
		expect(loader).toContain('from "./_lib/prod-target"');
		expect(loader).not.toContain('"zbvprdcyxhlguxbostdj"');
	});
});
