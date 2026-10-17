import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LAUNCH-DB-COPY-1 — `scripts/aws-migration/lib/fingerprint.cjs`
 * (`docs/plans/LAUNCH-DB-COPY-1.md` §4). The census the whole copy is judged
 * against: per table, how many rows and what they contain.
 *
 * ⛔ WRITTEN BEFORE THE MODULE EXISTS; the intended RED is `Cannot find module
 * …/lib/fingerprint.cjs`.
 *
 * WHY A FINGERPRINT AND NOT A ROW COUNT. The 27 Sep cutover compared counts and
 * reported "0 differences" — a count cannot see a column that loaded as NULL, a
 * numeric that lost scale, or a row that arrived twice while another vanished.
 * The manifest therefore carries `md5` over the rows' own text form, and the
 * ordering is BY THAT TEXT: a data-only `pg_restore` writes rows in archive
 * order, which is not the source's physical order, so an `order by id` or an
 * unordered `string_agg` makes the fingerprint differ for two databases holding
 * identical data. That is the one failure mode that would make this tool
 * useless exactly when it matters, and it is what the structural assertions
 * below are for.
 *
 * Resolutions this file makes where §4 is silent (the implementer follows
 * these):
 *   1. MANIFEST SHAPE: a plain object keyed by the schema-qualified table name,
 *      each value `{ count, md5 }` — `compareManifests` takes those two maps
 *      directly. If `launch-dump.cjs` writes a wrapper (`{ env, stamp, tables }`)
 *      its caller passes `.tables`.
 *   2. `count` IS COMPARED NUMERICALLY. It arrives as text from `psql -tA` and
 *      as a number from `JSON.parse`, so `"0"` and `0` must compare equal or
 *      every table reads as a mismatch at launch.
 *   3. CLASSIFICATION IS BY TABLE NAME FIRST. A table in `CLEARED_TABLES` is
 *      judged only on its actual count (`cleared-ok` / `cleared-not-empty`); a
 *      table in `VOLATILE_TABLES` reports `volatile` only when it actually
 *      differs, so an identical manifest still reads "match" everywhere.
 *   4. `TABLE_LIST_SQL` returns ONE ROW PER TABLE, the qualified name as its
 *      single column — not a `string_agg` list. `prod-restore.cjs`'s
 *      `TARGET_SQL.tables` aggregates because it builds one TRUNCATE statement;
 *      this one is iterated.
 *   5. An UNQUALIFIED table name is REFUSED by `countAndFingerprintSql` — the
 *      qualification is what keeps `search_path` out of the census.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: a CommonJS script without types.
const fp: any = require(
	join(REPO_ROOT, "scripts/aws-migration/lib/fingerprint.cjs"),
);

/** Every keyword that would make a census statement a write. */
const WRITE_SQL =
	/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|vacuum|copy)\b/i;
/** A statement is one statement: no `;` except a trailing one. */
const oneStatement = (sql: string) => !sql.replace(/;\s*$/, "").includes(";");

const cell = (count: number, md5: string) => ({ count, md5 });

describe("fingerprint::table-list-sql", () => {
	const sql: string = fp.TABLE_LIST_SQL;

	it("is a single read-only SELECT", () => {
		expect(sql).toMatch(/^\s*select\b/i);
		expect(oneStatement(sql)).toBe(true);
		expect(sql.replace(/^\s*select\b/i, "")).not.toMatch(WRITE_SQL);
	});

	it("covers exactly the two schemas the dump carries", () => {
		expect(sql).toContain("'public'");
		expect(sql).toContain("'drizzle'");
		expect(sql).not.toContain("'cron'");
		expect(sql).not.toContain("information_schema");
	});

	it("restricts itself to base and partitioned tables, never a view", () => {
		// `pg_tables` lists only base/partitioned tables; the catalog route has to
		// say `relkind in ('r','p')`. Either is fine — reading a view into the
		// census is not.
		expect(sql).toMatch(/pg_tables|relkind/);
		expect(sql).not.toMatch(/pg_views|pg_matviews/);
	});

	it("names each table with its schema, so the census keys are qualified", () => {
		expect(sql).toMatch(/schemaname[\s\S]*tablename|nspname[\s\S]*relname/);
	});

	it("excludes the events PARTITIONS and keeps the parent", () => {
		// The partitions' rows are counted through `events` itself; counting both
		// would double every event in the manifest.
		expect(sql).toContain("events_%");
		expect(sql).toMatch(/not\s+like/i);
		expect(sql).not.toMatch(/(<>|!=)\s*'events'/);
		expect(sql).not.toMatch(/not\s+in\s*\(\s*'events'/i);
	});

	it("returns one qualified name per row, not an aggregated list", () => {
		// Resolution 4. The caller iterates the result and calls
		// countAndFingerprintSql once per name.
		expect(sql).not.toMatch(/string_agg|array_agg/i);
	});
});

describe("fingerprint::count-and-fingerprint-sql", () => {
	const sql: string = fp.countAndFingerprintSql("public.image_uploads");

	it("quotes both halves of the identifier", () => {
		expect(sql).toContain('"public"."image_uploads"');
		expect(sql).not.toContain("from public.image_uploads");
		expect(fp.countAndFingerprintSql("drizzle.__drizzle_migrations")).toContain(
			'"drizzle"."__drizzle_migrations"',
		);
	});

	it("is one statement, and reads", () => {
		expect(oneStatement(sql)).toBe(true);
		expect(sql).toMatch(/^\s*select\b/i);
		expect(sql.replace(/^\s*select\b/i, "")).not.toMatch(WRITE_SQL);
	});

	it("returns the count and the md5 in one cell, separated by a pipe", () => {
		expect(sql).toMatch(/count\s*\(/i);
		expect(sql).toMatch(/md5\s*\(/i);
		expect(sql).toContain("|");
	});

	it("fingerprints the ROWS' TEXT FORM, not a column", () => {
		expect(sql).toMatch(/::text/i);
	});

	it("orders by the very expression it aggregates — the order-independence", () => {
		/**
		 * ⛔ THE ASSERTION THAT CARRIES THIS FILE. A fingerprint ordered by
		 * anything other than the aggregated value is order-DEPENDENT, and a
		 * data-only restore re-orders rows. The check is structural: whatever
		 * `order by` names must appear at least twice in the statement — once
		 * inside the aggregate, once in the ordering — and must not be a physical
		 * or arbitrary column.
		 */
		const m = sql.match(/order\s+by\s+([a-zA-Z0-9_."():]+)/i);
		expect(m).not.toBeNull();
		const expr = (m as RegExpMatchArray)[1];
		expect(expr).not.toMatch(/^(id|ctid|seq|created_at|1)$/i);
		expect(sql.split(expr).length - 1).toBeGreaterThanOrEqual(2);
	});

	it("refuses an unqualified table name", () => {
		expect(() => fp.countAndFingerprintSql("users")).toThrow(/refusing/);
		expect(() => fp.countAndFingerprintSql("")).toThrow(/refusing/);
	});

	it("cannot be made to carry a second statement", () => {
		// The names come from TABLE_LIST_SQL, so this is defence in depth rather
		// than a live route — but the statement is interpolated, and an
		// interpolated identifier that is not quoted or rejected is how a census
		// tool becomes a write tool.
		const evil = 'public.x"; DROP TABLE public.users; --';
		let out: string | null = null;
		try {
			out = fp.countAndFingerprintSql(evil);
		} catch (e) {
			expect(String((e as Error).message)).toMatch(/refusing/);
		}
		if (out !== null) {
			expect(oneStatement(out)).toBe(true);
			expect(out).not.toContain('x"; DROP');
		}
	});
});

describe("fingerprint::table-classes", () => {
	it("names the three tables cleared inside the load transaction", () => {
		expect(fp.CLEARED_TABLES).toEqual([
			"public.sessions",
			"public.verifications",
			"public.admin_sessions",
		]);
	});

	it("names the three tables pg_cron writes behind the copy", () => {
		expect(fp.VOLATILE_TABLES).toEqual([
			"public.liquidity_heartbeat",
			"public.watermark_state",
			"public.cron_alarms",
		]);
	});

	it("keeps the two classes disjoint and qualified", () => {
		const all: string[] = [...fp.CLEARED_TABLES, ...fp.VOLATILE_TABLES];
		expect(new Set(all).size).toBe(all.length);
		for (const t of all) expect(t).toMatch(/^public\.[a-z_]+$/);
	});
});

describe("fingerprint::compare-manifests", () => {
	const byTable = (
		// biome-ignore lint/suspicious/noExplicitAny: the tool is untyped.
		result: any,
		table: string,
		// biome-ignore lint/suspicious/noExplicitAny: the tool is untyped.
	): any => result.rows.find((r: { table: string }) => r.table === table);

	const ORDINARY = {
		"public.users": cell(621, "u1"),
		"public.bets": cell(3168, "b1"),
		"drizzle.__drizzle_migrations": cell(32, "j1"),
	};

	it("passes identical manifests with every row match", () => {
		// POSITIVE CONTROL. Ordinary tables only — cleared and volatile tables are
		// classified by name (resolution 3) and are exercised separately below.
		const v = fp.compareManifests(ORDINARY, { ...ORDINARY });
		expect(v.pass).toBe(true);
		expect(v.rows.map((r: { status: string }) => r.status)).toEqual([
			"match",
			"match",
			"match",
		]);
		expect(v.rows.map((r: { table: string }) => r.table).sort()).toEqual(
			Object.keys(ORDINARY).sort(),
		);
	});

	it("compares the count numerically, however it was serialised", () => {
		// Resolution 2: psql hands back text, JSON hands back a number.
		const v = fp.compareManifests(
			{ "public.users": cell(621, "u1") },
			{ "public.users": { count: "621", md5: "u1" } },
		);
		expect(byTable(v, "public.users").status).toBe("match");
		expect(v.pass).toBe(true);
	});

	it("fails a count mismatch", () => {
		const v = fp.compareManifests(ORDINARY, {
			...ORDINARY,
			"public.bets": cell(3167, "b1"),
		});
		expect(byTable(v, "public.bets").status).toBe("mismatch");
		expect(v.pass).toBe(false);
	});

	it("fails the same count with a different fingerprint", () => {
		// The case a row count cannot see: the right number of rows, different
		// contents.
		const v = fp.compareManifests(ORDINARY, {
			...ORDINARY,
			"public.bets": cell(3168, "b2"),
		});
		const row = byTable(v, "public.bets");
		expect(row.status).toBe("mismatch");
		expect(row.expected).toEqual(cell(3168, "b1"));
		expect(row.actual).toEqual(cell(3168, "b2"));
		expect(v.pass).toBe(false);
	});

	it("expects a cleared table to be EMPTY in the target, whatever the source held", () => {
		const v = fp.compareManifests(
			{ ...ORDINARY, "public.sessions": cell(725, "s1") },
			{ ...ORDINARY, "public.sessions": cell(0, "") },
		);
		expect(byTable(v, "public.sessions").status).toBe("cleared-ok");
		expect(v.pass).toBe(true);
	});

	it("FAILS a cleared table that still holds rows", () => {
		/**
		 * ⛔ THE SECURITY ROW. An admin cookie is a bare session id checked by a
		 * database lookup, so one surviving `admin_sessions` row from staging is a
		 * valid production admin session. This must fail the comparison, not warn.
		 */
		const v = fp.compareManifests(
			{ ...ORDINARY, "public.admin_sessions": cell(2, "a1") },
			{ ...ORDINARY, "public.admin_sessions": cell(2, "a1") },
		);
		expect(byTable(v, "public.admin_sessions").status).toBe(
			"cleared-not-empty",
		);
		expect(v.pass).toBe(false);
	});

	it("classifies a cleared table by name even when both sides are already empty", () => {
		const v = fp.compareManifests(
			{ "public.verifications": cell(0, "") },
			{ "public.verifications": cell(0, "") },
		);
		expect(byTable(v, "public.verifications").status).toBe("cleared-ok");
		expect(v.pass).toBe(true);
	});

	it("reports a volatile table's drift and still passes", () => {
		// pg_cron writes these every few minutes; the copy cannot be judged on
		// them, and they must not be silently ignored either.
		const v = fp.compareManifests(
			{ ...ORDINARY, "public.liquidity_heartbeat": cell(16228, "h1") },
			{ ...ORDINARY, "public.liquidity_heartbeat": cell(16231, "h2") },
		);
		expect(byTable(v, "public.liquidity_heartbeat").status).toBe("volatile");
		expect(v.pass).toBe(true);
	});

	it("calls an identical volatile table a match, not a warning", () => {
		const v = fp.compareManifests(
			{ "public.watermark_state": cell(2, "w1") },
			{ "public.watermark_state": cell(2, "w1") },
		);
		expect(byTable(v, "public.watermark_state").status).toBe("match");
		expect(v.pass).toBe(true);
	});

	it("fails a table missing from the target", () => {
		const { "public.bets": _dropped, ...actual } = ORDINARY;
		const v = fp.compareManifests(ORDINARY, actual);
		const row = byTable(v, "public.bets");
		expect(row.status).toBe("missing");
		expect(row.actual ?? null).toBeNull();
		expect(v.pass).toBe(false);
	});

	it("fails a table the target has and the source does not", () => {
		// A table nobody copied into is as wrong as one nobody copied out of: it
		// means production is not the database the manifest describes.
		const v = fp.compareManifests(ORDINARY, {
			...ORDINARY,
			"public.leftover": cell(4, "x1"),
		});
		const row = byTable(v, "public.leftover");
		expect(row.status).toBe("extra");
		expect(row.expected ?? null).toBeNull();
		expect(v.pass).toBe(false);
	});

	it("reports every table exactly once, over the union of both manifests", () => {
		const v = fp.compareManifests(
			{ ...ORDINARY, "public.sessions": cell(725, "s1") },
			{
				"public.users": cell(621, "u1"),
				"drizzle.__drizzle_migrations": cell(32, "j1"),
				"public.sessions": cell(0, ""),
				"public.leftover": cell(1, "z"),
			},
		);
		const tables = v.rows.map((r: { table: string }) => r.table);
		expect(new Set(tables).size).toBe(tables.length);
		expect(tables.sort()).toEqual(
			[
				"drizzle.__drizzle_migrations",
				"public.bets",
				"public.leftover",
				"public.sessions",
				"public.users",
			].sort(),
		);
		expect(v.pass).toBe(false);
	});

	it("passes only when nothing is mismatched, missing, extra or uncleared", () => {
		const statuses = (
			// biome-ignore lint/suspicious/noExplicitAny: the tool is untyped.
			r: any,
		): string[] => r.rows.map((x: { status: string }) => x.status);
		const good = fp.compareManifests(ORDINARY, { ...ORDINARY });
		expect(statuses(good).every((s) => s === "match")).toBe(true);
		expect(good.pass).toBe(true);

		// One bad row among three good ones still fails the whole comparison.
		const bad = fp.compareManifests(ORDINARY, {
			...ORDINARY,
			"public.users": cell(620, "u1"),
		});
		expect(statuses(bad).filter((s) => s === "match").length).toBe(2);
		expect(bad.pass).toBe(false);
	});

	it("passes two empty manifests, and says so with no rows", () => {
		const v = fp.compareManifests({}, {});
		expect(v.rows).toEqual([]);
		expect(v.pass).toBe(true);
	});
});

describe("fingerprint::the two sides render rows identically", () => {
	/**
	 * `@code-reviewer` MEDIUM. A fingerprint is an md5 of each row's TEXT, and a
	 * row's text depends on session settings: a timestamptz prints in the
	 * session's timezone, a float with the session's digits, and string order
	 * follows the database collation. Staging computes the expected side and
	 * production the actual side, so any default that differs between the two
	 * instances would fail every table while the data was identical — so both
	 * sessions pin the settings, and the ordering is byte-wise.
	 */
	const PINS = [
		"timezone=UTC",
		"datestyle=ISO,MDY",
		"intervalstyle=postgres",
		"extra_float_digits=3",
		"bytea_output=hex",
	];
	const read = (f: string) =>
		readFileSync(join(REPO_ROOT, "scripts/aws-migration", f), "utf8");

	it("orders rows byte-wise, whatever the database collation", () => {
		expect(fp.countAndFingerprintSql("public.users")).toContain(
			'order by t::text collate "C"',
		);
	});

	it.each([
		["launch-dump.cjs"],
		["launch-verify.cjs"],
	])("%s pins every text-rendering setting", (file) => {
		const line = read(file)
			.split("\n")
			.find((l) => l.includes("PGOPTIONS="));
		expect(line).toBeDefined();
		for (const pin of PINS) expect(line).toContain(`-c ${pin}`);
		expect(line).toContain("default_transaction_read_only=on");
	});
});

describe("fingerprint::scrubbed-tables", () => {
	/**
	 * @security-auditor M-4. The restore nulls the OAuth tokens in `accounts`,
	 * so its fingerprint differs from staging's by design. The count must still
	 * match; launch-verify's accountTokensPresent proves the nulling itself.
	 */
	it("is exactly public.accounts", () => {
		expect(fp.SCRUBBED_TABLES).toEqual(["public.accounts"]);
	});

	it("passes a differing fingerprint when the count matches", () => {
		const r = fp.compareManifests(
			{ "public.accounts": { count: 5, md5: "a" } },
			{ "public.accounts": { count: "5", md5: "b" } },
		);
		expect(r.pass).toBe(true);
		expect(r.rows[0].status).toBe("scrubbed-count-ok");
	});

	it("fails a differing count", () => {
		const r = fp.compareManifests(
			{ "public.accounts": { count: 5, md5: "a" } },
			{ "public.accounts": { count: 4, md5: "a" } },
		);
		expect(r.pass).toBe(false);
		expect(r.rows[0].status).toBe("mismatch");
	});

	it("fails a missing accounts table", () => {
		const r = fp.compareManifests(
			{ "public.accounts": { count: 5, md5: "a" } },
			{},
		);
		expect(r.pass).toBe(false);
		expect(r.rows[0].status).toBe("missing");
	});
});
