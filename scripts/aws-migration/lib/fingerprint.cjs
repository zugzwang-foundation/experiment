// LAUNCH-DB-COPY-1 — the census a launch copy is judged against: per table, how
// many rows and what they contain (docs/plans/LAUNCH-DB-COPY-1.md §4). Pure.
//
// A row count cannot see a column that loaded as NULL, a numeric that lost
// scale, or one row duplicated while another vanished. So each table also gets
// an md5 over its rows' text form, ORDERED BY THAT SAME TEXT: a data-only
// pg_restore writes rows in archive order, not the source's physical order,
// and any other ordering would make two identical databases fingerprint
// differently — the one failure that would make this useless when it matters.

/** One schema-qualified name per row; events partitions are counted via `events`. */
const TABLE_LIST_SQL =
	"select format('%I.%I', schemaname, tablename) from pg_tables where schemaname in ('public','drizzle') and tablename not like 'events_%' order by 1";

const QUALIFIED_RE = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/;

/** One read-only statement returning "count|md5" for a schema-qualified table. */
function countAndFingerprintSql(qualifiedTable) {
	const m = QUALIFIED_RE.exec(String(qualifiedTable));
	if (!m) {
		throw new Error(
			`refusing: ${JSON.stringify(qualifiedTable)} is not a schema-qualified table name`,
		);
	}
	const [, schema, table] = m;
	return `select count(*) || '|' || coalesce(md5(string_agg(t::text, E'\\n' order by t::text collate "C" )), '') from "${schema}"."${table}" as t`;
}

/** Emptied inside the load transaction: staging sessions must not survive. */
const CLEARED_TABLES = [
	"public.sessions",
	"public.verifications",
	"public.admin_sessions",
];

/** Written by pg_cron behind the copy: drift is reported, never failed. */
const VOLATILE_TABLES = [
	"public.liquidity_heartbeat",
	"public.watermark_state",
	"public.cron_alarms",
];

/**
 * Columns nulled inside the load transaction (the OAuth tokens), so the content
 * fingerprint differs from staging's BY DESIGN. The row COUNT must still
 * match; launch-verify's accountTokensPresent invariant proves the nulling.
 */
const SCRUBBED_TABLES = ["public.accounts"];

const FAILING = new Set(["mismatch", "missing", "extra", "cleared-not-empty"]);

/**
 * Compares two manifests ({ "schema.table": { count, md5 } }). Every table in
 * either appears exactly once. Classification is by table name first.
 */
function compareManifests(expected, actual) {
	const tables = [
		...new Set([...Object.keys(expected), ...Object.keys(actual)]),
	].sort();
	const rows = tables.map((table) => {
		const e = Object.hasOwn(expected, table) ? expected[table] : null;
		const a = Object.hasOwn(actual, table) ? actual[table] : null;
		let status;
		if (CLEARED_TABLES.includes(table)) {
			if (a === null) status = "missing";
			else status = Number(a.count) === 0 ? "cleared-ok" : "cleared-not-empty";
		} else if (a === null) {
			status = "missing";
		} else if (e === null) {
			status = "extra";
		} else if (SCRUBBED_TABLES.includes(table)) {
			status =
				Number(e.count) === Number(a.count) ? "scrubbed-count-ok" : "mismatch";
		} else if (Number(e.count) === Number(a.count) && e.md5 === a.md5) {
			status = "match";
		} else {
			status = VOLATILE_TABLES.includes(table) ? "volatile" : "mismatch";
		}
		return { table, status, expected: e, actual: a };
	});
	return { pass: rows.every((r) => !FAILING.has(r.status)), rows };
}

module.exports = {
	TABLE_LIST_SQL,
	countAndFingerprintSql,
	CLEARED_TABLES,
	VOLATILE_TABLES,
	SCRUBBED_TABLES,
	compareManifests,
};
