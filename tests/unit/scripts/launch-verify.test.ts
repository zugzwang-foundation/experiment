import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";

/**
 * LAUNCH-DB-COPY-1 — `scripts/aws-migration/launch-verify.cjs`
 * (`docs/plans/LAUNCH-DB-COPY-1.md` §4/§6, runbook step 11).
 *
 * ⛔ WRITTEN BEFORE THE TOOL EXISTS; the intended RED is `Cannot find module
 * …/launch-verify.cjs`.
 *
 * WHAT IT IS FOR. It is the last reading taken before writes are opened, and it
 * is the ONLY tool here that runs against production with real participants
 * about to arrive. It therefore writes nothing at all — not a cron pause, not a
 * trigger toggle, not a temporary table — and the scan at the bottom of this
 * file is what keeps that true as it grows.
 *
 * WHY THE INVARIANTS ARE RE-CHECKED AFTER A COPY THAT "WORKED". A data-only
 * restore suspends FK checks and user triggers for the load. Every append-only
 * guard and every CHECK on the ledger is therefore stood down for the duration,
 * which is exactly the window in which a half-loaded `lots` table or a negative
 * `balance_after` can land without the database objecting. Each statement below
 * returns 0 when its invariant holds, so the verdict is arithmetic rather than
 * interpretation.
 *
 * Resolutions this file makes where §4 is silent (the implementer follows
 * these):
 *   1. `INVARIANT_SQL` is an OBJECT keyed by the seven camelCase names asserted
 *      below. The names reach the operator's report, so they are pinned rather
 *      than left to the writer.
 *   2. Every entry RETURNS A COUNT, one row, one column, and holds at 0. An
 *      entry returning the offending rows instead would read as a failure
 *      whenever it found anything, including nothing.
 *   3. `IDENTITY_POOL_SQL` is a SEPARATE export and is NOT an invariant — see
 *      the test that says so. It reports headroom, where 0 is the BAD answer.
 *   4. `httpChecks(baseUrl, slugs)` yields `{ url, expect }` where `expect` is
 *      the expected HTTP STATUS (the number 200). Health's body assertions
 *      (`env`, `db`, `migrations`, `writesPaused`) are the tool's own, not this
 *      list's. Order is health, ready, home, then one entry per slug in the
 *      order given; a trailing slash on the base URL is trimmed.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/aws-migration/launch-verify.cjs");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const tool: any = require(SCRIPT);

/** Comment-stripped before every negative scan; see launch-dump.test.ts. */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SOURCE = readFileSync(SCRIPT, "utf8");
const CODE = code(SOURCE);

/** Every keyword that would make this tool something other than read-only. */
const WRITE_SQL =
	/\b(insert|update|delete|truncate|drop|alter|grant|revoke|vacuum)\b/i;
const oneStatement = (sql: string) => !sql.replace(/;\s*$/, "").includes(";");

const INVARIANTS: [name: string, mustMention: RegExp[]][] = [
	// INV-2 — the one invariant with a CHECK behind it, which the load suspends.
	["negativeBalance", [/dharma_ledger/i, /balance_after/i]],
	// I-NO-OVERSELL-001.
	["negativePosition", [/positions/i, /quantity/i]],
	// I-SINGLE-SIDE-001 — at most one held side per (user, market).
	["twoHeldSides", [/positions/i, /group\s+by/i]],
	// I-LOT-SUM-001 — Σ lots.surviving_shares == positions.quantity.
	["lotSumNotPosition", [/lots/i, /surviving_shares/i, /positions/i]],
	// I-GENESIS-001 — an Open market with no market.opened event renders a blank
	// chart and nothing else, so nothing else would report it.
	[
		"openMarketWithoutGenesisEvent",
		[/markets/i, /'Open'/, /market\.opened/i, /events/i],
	],
	// The conclusion freeze must still be in the future at launch.
	["frozenAtSet", [/system_state/i, /frozen_at/i]],
	// Added with the identity-pool scope: a data-only load runs with user
	// triggers stood down, and two users holding one pseudonym is the shape that
	// makes two participants the same person on every surface.
	["duplicatePseudonym", [/users/i, /pseudonym/i, /group\s+by/i]],
	// `@code-reviewer` H-5: the two singleton/seed rows a data-only load could
	// leave absent without any constraint noticing.
	["systemStateNotSingleton", [/system_state/i]],
	["liquidityPolicyMissing", [/liquidity_policy/i]],
	// @security-auditor M-1 / L-4 / M-4 / L-5: the catalog proof that the
	// append-only guards came back, INV-1's referential half, the token scrub,
	// and the ledger identity's high-water mark.
	["triggersDisabled", [/pg_trigger/i, /tgenabled = 'D'/, /tgisinternal/i]],
	["betWithoutComment", [/bets/i, /comments/i, /comment_id/i]],
	[
		"accountTokensPresent",
		[/accounts/i, /access_token/i, /refresh_token/i, /id_token/i],
	],
	[
		"ledgerSequenceBehind",
		[/dharma_ledger/i, /pg_get_serial_sequence/i, /coalesce/i],
	],
];

describe("launch-verify::invariant-sql", () => {
	it("names exactly the thirteen invariants the launch is judged on", () => {
		expect(Object.keys(tool.INVARIANT_SQL).sort()).toEqual(
			INVARIANTS.map(([n]) => n).sort(),
		);
	});

	it.each(INVARIANTS)("%s asks about the rows it names", (name, mentions) => {
		const sql: string = tool.INVARIANT_SQL[name];
		for (const re of mentions) expect(sql).toMatch(re);
	});

	it.each(INVARIANTS)("%s is a single read-only SELECT", (name) => {
		const sql: string = tool.INVARIANT_SQL[name];
		expect(sql).toMatch(/^\s*select\b/i);
		expect(oneStatement(sql)).toBe(true);
		expect(sql.replace(/^\s*select\b/i, "")).not.toMatch(WRITE_SQL);
	});

	it.each(INVARIANTS)("%s returns a count that holds at 0", (name) => {
		// Resolution 2. A statement that returns the offending ROWS cannot be
		// compared to zero, and the report would then be a human reading a table.
		const sql: string = tool.INVARIANT_SQL[name];
		expect(sql).toMatch(/count\s*\(/i);
	});
});

describe("launch-verify::identity-pool-headroom", () => {
	it("reports the unassigned headroom, read-only", () => {
		const sql: string = tool.IDENTITY_POOL_SQL;
		expect(sql).toMatch(/^\s*select\b/i);
		expect(sql).toMatch(/identity_pool/i);
		expect(sql).toMatch(/assigned_at/i);
		expect(sql).toMatch(/is\s+null/i);
		expect(sql).toMatch(/count\s*\(/i);
		expect(oneStatement(sql)).toBe(true);
		expect(sql.replace(/^\s*select\b/i, "")).not.toMatch(WRITE_SQL);
	});

	it("⛔ is NOT an invariant — zero is the bad answer here", () => {
		/**
		 * The pool is copied with the dump so that production's pool stays
		 * consistent with the copied users' pseudonyms. What it then has to carry
		 * is HEADROOM: every signup after launch consumes an unassigned row, and a
		 * pool at zero fails `createOAuthUser` for every new participant. Filed
		 * under INVARIANT_SQL — where every statement holds at 0 — a healthy pool
		 * would read as a failure and an exhausted one as a pass. Exactly
		 * backwards, and in the direction that opens the doors on a broken signup.
		 */
		expect(Object.keys(tool.INVARIANT_SQL)).not.toContain("IDENTITY_POOL_SQL");
		expect(Object.values(tool.INVARIANT_SQL)).not.toContain(
			tool.IDENTITY_POOL_SQL,
		);
	});
});

describe("launch-verify::http-checks", () => {
	const BASE = productionConfig.appBaseUrl;
	const SLUGS = ["will-x-happen", "another-market"];

	it("checks health, readiness, the home page and every market page", () => {
		const checks = tool.httpChecks(BASE, SLUGS);
		expect(checks.map((c: { url: string }) => c.url)).toEqual([
			`${BASE}/api/health`,
			`${BASE}/api/ready`,
			`${BASE}/`,
			`${BASE}/m/will-x-happen`,
			`${BASE}/m/another-market`,
		]);
	});

	it("expects 200 from every one of them", () => {
		for (const c of tool.httpChecks(BASE, SLUGS)) {
			expect(c.expect).toBe(200);
			expect(typeof c.url).toBe("string");
		}
	});

	it("keeps one entry per slug, in the order given", () => {
		const checks = tool.httpChecks(BASE, SLUGS);
		expect(checks).toHaveLength(3 + SLUGS.length);
		expect(tool.httpChecks(BASE, [])).toHaveLength(3);
	});

	it("tolerates a trailing slash on the base URL", () => {
		// The operator pastes this from a browser as often as from the config.
		const checks = tool.httpChecks(`${BASE}/`, ["m1"]);
		expect(checks.map((c: { url: string }) => c.url)).toEqual([
			`${BASE}/api/health`,
			`${BASE}/api/ready`,
			`${BASE}/`,
			`${BASE}/m/m1`,
		]);
		for (const c of checks) expect(c.url).not.toContain("//api");
	});

	it("is pointed at production only by its argument, never by a default", () => {
		// The base URL is a parameter so the same tool can read staging before the
		// copy; nothing in it should hard-code the production host.
		const checks = tool.httpChecks("https://staging.zugzwangworld.com", []);
		for (const c of checks)
			expect(c.url).toContain("staging.zugzwangworld.com");
	});
});

describe("launch-verify::read-only (source)", () => {
	it("the scanner can see a write keyword in real code of this family", () => {
		// POSITIVE CONTROL: `prod-restore.cjs` genuinely updates `cron.job` and
		// TRUNCATEs in code, not only in comments. A clean scan below therefore
		// means this tool writes nothing, not that the regex never worked.
		expect(WRITE_SQL.test("update cron.job set active = false")).toBe(true);
		const restoreCode = code(
			readFileSync(
				join(REPO_ROOT, "scripts/aws-migration/prod-restore.cjs"),
				"utf8",
			),
		);
		expect(WRITE_SQL.test(restoreCode)).toBe(true);
	});

	it("⛔ carries no write SQL keyword anywhere", () => {
		expect(CODE).not.toMatch(WRITE_SQL);
	});

	it("never pauses cron or stands a trigger down", () => {
		expect(CODE).not.toMatch(/cron\.job/);
		expect(CODE).not.toMatch(/session_replication_role|TRIGGER USER/i);
	});

	it("touches R2 only to look", () => {
		expect(CODE).not.toMatch(/PutObject|CopyObject|DeleteObject/);
		expect(CODE).not.toMatch(/method:\s*"(POST|PUT|PATCH)"/i);
	});

	it("only reaches the network when executed directly", () => {
		// This file requires the module; without the guard, collecting it would
		// open an SSM session to production.
		expect(SOURCE).toContain("if (require.main === module)");
	});
});

describe("launch-verify::storage-is-derived-from-production", () => {
	/**
	 * @security-auditor M-5. The storage check used to HEAD the keys listed in
	 * the storage tool's own report, so a report that parsed nothing vouched for
	 * itself. The keys now come from production's restored rows.
	 */
	it("reads each family from the restored database, read-only", () => {
		expect(Object.keys(tool.STORAGE_ROWS_SQL).sort()).toEqual([
			"identityPool",
			"imageUploads",
			"marketMedia",
			"users",
		]);
		for (const sql of Object.values(tool.STORAGE_ROWS_SQL) as string[]) {
			expect(sql).toMatch(/^select coalesce\(json_agg\(/);
			expect(oneStatement(sql)).toBe(true);
			expect(sql.replace(/^\s*select\b/i, "")).not.toMatch(WRITE_SQL);
		}
		expect(tool.STORAGE_ROWS_SQL.imageUploads).toContain("r2_object_key");
		expect(tool.STORAGE_ROWS_SQL.users).toContain("pfp_filename");
	});

	it("builds the key list with launch-storage's own referencedObjects", () => {
		expect(CODE).toMatch(/require\("\.\/launch-storage\.cjs"\)/);
		expect(CODE).toMatch(/referencedObjects\(/);
		expect(CODE).not.toMatch(/storage\.refs/);
	});

	it("asserts writes are still paused when it runs", () => {
		expect(CODE).toMatch(/h\.writesPaused === true/);
	});
});
