import { constants } from "node:buffer";
import type { SourceRow } from "./strip";

/**
 * RFC 8785 (JCS) canonical JSON, for the value subset this pipeline emits.
 *
 * ## Why this is hand-written and not the `canonicalize` dependency
 *
 * ⚠ **It WAS the dependency, and that broke the one code path nobody runs.**
 * `canonicalize@3.0.0` declares `"exports"` with `"import"` and `"types"`
 * conditions and **no `"require"`**. This repo has no `"type": "module"`, so
 * `tsx` loads `scripts/build-dataset.ts` and its whole import graph as
 * CommonJS — and the release entry point died at module resolution, before a
 * line of the pipeline ran:
 *
 * ```
 * Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in
 *   node_modules/canonicalize/package.json
 * ```
 *
 * **Nothing caught it, and the reason is the interesting part.** `tsc
 * --noEmit` exits 0 (type resolution uses `"types"`, which exists); biome is
 * clean; the full vitest suite is green (Vite resolves `"import"`). CI runs
 * Biome → tsc → drizzle-kit → migrate → vitest, and **nothing in CI, in
 * `tests/`, or in the `justfile` invokes `build-dataset.ts`**. So the single
 * path that produces the release artifact was the only one not covered, and
 * it was broken (`@security-auditor` H-1). `tests/integration/dataset-build-script.integration.test.ts`
 * now runs the real script, because a build that happens once should not be
 * the build that has never been run.
 *
 * ## What it has to handle, and what it deliberately does not
 *
 * These columns are Postgres `jsonb`: objects, arrays, strings, booleans,
 * `null`, and numbers.
 *
 * ⚠ **This docblock claimed "there are no floats", and that is FALSE**
 * (`@security-auditor` F-11 M-1). `mod_actions.categories` is `jsonb NOT NULL`,
 * ships `SHIP` per Appendix B.10, routes through here, and holds **the raw
 * OpenAI `category_scores` map** — `moderation/consequences.ts` says so
 * verbatim, and the fixture carries `{ harassment: 0.91 }`. So floats are not
 * merely reachable: that is the one float-bearing shipped column, and RFC
 * 8785's number serialization is exactly the part governing it.
 *
 * **The code was right and the argument licensing it was wrong**, which is the
 * more dangerous combination — it is the argument a future author reads before
 * deciding whether the number path needs a test. It does, and it now has one.
 *
 * The number path is correct because `JSON.stringify` IS ECMAScript
 * `Number::toString`, which is what RFC 8785 §3.2.2.3 mandates — verified
 * differentially against `canonicalize@3.0.0` across `5e-324`, `1/3`, `1e21`,
 * `0.30000000000000004`, `-0` and `2^53`: byte-identical.
 *
 * Every monetary and Dharma quantity is separately safe for a different
 * reason: it is `NUMERIC(38,18)` and arrives as a STRING (CLAUDE.md §2), so it
 * never enters the number path at all.
 *
 * Key ordering is RFC 8785's: ascending by UTF-16 code unit, which is exactly
 * what `Array.prototype.sort()` does by default on strings.
 *
 * ⚠ `undefined` and non-finite numbers are not representable in JSON and
 * cannot occur in a value read from a `jsonb` column; they would throw from
 * `JSON.stringify` anyway rather than serialise wrongly.
 */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) {
		// Array order is DATA, never sorted — JCS preserves it.
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return `{${entries
		.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
		.join(",")}}`;
}

/**
 * DATASET.1 Slice 6 — the per-table CSV writer (brief D1).
 *
 * RFC 4180. Per-table CSV was ratified over Parquet because it adds no
 * dependency and the manifest carries the checksums and row counts, so
 * integrity does not ride on the container format.
 *
 * ## Two things this must not do to the numbers
 *
 * Every monetary and Dharma column is `NUMERIC(38,18)`. `postgres` hands
 * those to JS as **strings**, and they are written through as strings —
 * never parsed, never re-formatted, never rounded. A `Number()` anywhere on
 * this path would silently truncate an 18-decimal balance to float precision
 * (CLAUDE.md §2), and the resulting CSV would look completely normal.
 *
 * Likewise `null` is written as an EMPTY field, not the four characters
 * `null`. A researcher loading this into pandas gets `NaN` for the first and
 * the literal string `"null"` for the second, and the second silently
 * corrupts every aggregate computed over the column.
 */

/** The exact bytes written for one table, plus what was actually in them. */
export interface CsvArtifact {
	readonly filename: string;
	readonly text: string;
	/** Column order, as written. */
	readonly columns: readonly string[];
	/**
	 * ⚠ **Counted from the emitted lines, not from `rows.length`.**
	 * Brief §4 Slice 6's wrong answer is *"manifest row counts computed from a
	 * different read than the one that wrote the files"*. This count is
	 * derived by the writer as it writes, so the manifest cannot disagree
	 * with the file even if a later refactor changes what gets filtered.
	 */
	readonly rowCount: number;
}

/** RFC 4180 field escaping. */
export function escapeField(value: unknown): string {
	if (value === null || value === undefined) return "";

	// ⚠ `Date` BEFORE the generic object branch. `JSON.stringify(new Date())`
	// returns a string that already CONTAINS double quotes, which then trips
	// the quote-escaping path below and doubles them — `2026-11-06T00:00:00Z`
	// ships as `"""2026-11-06T00:00:00Z"""` and parses back with literal
	// quotes inside the value.
	//
	// ⚠ **That justification WAS true and is now false** (`@code-reviewer`
	// M-3). It read: *"live on the first row a drizzle reader returns … this
	// fires on the release task's very first real read."* Since ruling S6 the
	// reader projects every `timestamp with time zone` through `to_char` and
	// returns `string | null`, and the schema has no other temporal column
	// type — so this branch is unreachable from both shipped sources.
	//
	// ⚠⚠ **And it would be WRONG if it ever fired.** `Date.toISOString()`
	// emits THREE fractional digits, so a value reaching here would silently
	// restore exactly the microsecond loss S6 exists to prevent, with nothing
	// between it and the artifact. Kept as a backstop for a future
	// `Date`-producing source, with the cost stated rather than implied —
	// this file's own project has been bitten twice by a docblock describing
	// the file it used to be.
	const s =
		value instanceof Date
			? value.toISOString()
			: typeof value === "object"
				? // ⚠ **CANONICAL JSON (RFC 8785 JCS), not `JSON.stringify`.**
					//
					// `JSON.stringify` emits keys in the object's own iteration
					// order, which makes the published bytes a function of where
					// the row came from. A JS fixture literal yields authoring
					// order; a row read from Postgres yields **jsonb's** order,
					// which is normalized by key length then bytewise. The same
					// data therefore serializes two different ways, and the
					// manifest's `content_sha256` — which §19.1 relies on for a
					// v2 rebuild "against the same source state" — moves with the
					// source rather than with the data.
					//
					// Measured: seeding the identical fixture into Postgres and
					// reading it back produced
					// `{"ip":…,"flow_id":…,"user_id":…,"actor_id":…}` against the
					// fixture's `{"request_id":…,"flow_id":…,"user_id":…}` — same
					// object, different bytes, different archive hash.
					//
					// Key order carries no meaning here: `events/insert.ts:217`
					// already records that "jsonb key-order is irrelevant — a raw
					// string compare would false-mismatch". Sorting makes the
					// bytes depend on the data alone, which is what a published,
					// checksummed, non-withdrawable artifact needs.
					//
					// ⚠ **This CHANGES the emitted bytes and therefore every
					// published checksum** versus DATASET.1. Nothing has been
					// released (the release is 2026-11-06), so the cost is zero
					// today — but it is a format decision and it is flagged for
					// ratification rather than slipped in.
					canonicalJson(value)
				: // ⚠ String(), never Number(). NUMERIC(38,18) arrives as a
					// string and must leave as the same string.
					String(value);

	// Quote if the field contains a delimiter, a quote, or any newline.
	// `\r` matters as much as `\n`: a bare CR inside an unquoted field
	// splits the record in several parsers and in none of the others, so the
	// same file reads with different row counts depending on the reader.
	if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
	return s;
}

/**
 * Serialize rows to CSV.
 *
 * The column set is taken from the FIRST row and then applied uniformly. A
 * per-row key union would let a row with an extra key silently widen the
 * table, and a row missing one silently shift every field after it — both of
 * which produce a file that parses cleanly and means something else.
 * Explicit `columns` should be passed whenever the caller knows the schema.
 */
/**
 * V8's maximum string length, read from Node rather than hardcoded.
 *
 * ⚠ **UTF-16 CODE UNITS, not bytes** (`@code-reviewer` LOW). The comparison is
 * correct — `String.prototype.length` is the same unit — but the name and the
 * figures below say "bytes", and for a CSV carrying non-ASCII comment bodies
 * the file is LARGER in bytes than this ceiling suggests. Stated rather than
 * renamed, because the projection arithmetic is what a reader checks.
 *
 * ⚠ Read at module load from `buffer.constants` because it is a property of
 * the RUNTIME, not of this project: it differs between 32- and 64-bit builds
 * and has changed across V8 versions. A literal here would be a second
 * declaration of someone else's constant, and the failure of a stale one is
 * that the guard stops firing exactly when the real limit moved down.
 */
export const MAX_CSV_TEXT_BYTES = constants.MAX_STRING_LENGTH;

export function toCsv(
	filename: string,
	rows: readonly SourceRow[],
	columns?: readonly string[],
): CsvArtifact {
	const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);

	const lines: string[] = [cols.map(escapeField).join(",")];
	let rowCount = 0;
	for (const row of rows) {
		lines.push(cols.map((c) => escapeField(row[c])).join(","));
		rowCount++;
	}

	// ⚠⚠ **THE V8 STRING CEILING — measured at DATASET.3 (C7), and it is a
	// HARD limit this pipeline reaches at release scale.**
	//
	// The join below builds the WHOLE file as one JavaScript string, and V8
	// caps a string at `buffer.constants.MAX_STRING_LENGTH` — measured on Node
	// 24 as **536,870,888 bytes (0.54 GB)**. That is not a memory pressure that
	// degrades; it is a `RangeError: Invalid string length` thrown from
	// `Array.prototype.join`, on a job that gets one attempt on a conference
	// morning.
	//
	// Measured cost per emitted `events` row on the dirty fixture: **342
	// bytes**. So `events.csv` throws at about **1.57 MILLION rows** — and a
	// central projection for 100k users over the 51-day experiment puts
	// `events` at roughly 7.3 million (≈2.5 GB, 4.7× over). `bets` and
	// `comments` clear the same ceiling around 2.4M and 3.1M rows.
	//
	// ⇒ **The release build cannot produce this archive at 100k users**, and
	// the fix is the `AsyncIterable` seam DATASET.2 declined to build (C7,
	// carried): the reader pages the QUERY but the pipeline still materialises
	// every table three times and then joins it into one string. That is a
	// piece of work with its own reviewer pass, not something to improvise.
	//
	// What IS built here is the check. A `RangeError` from `join` names
	// nothing — not the table, not the limit, not the remedy — and an operator
	// meeting it at 06:00 has a stack trace pointing at a standard library
	// method. This throws first, with all three.
	const projected = lines.reduce((n, l) => n + l.length + 1, 0);
	if (projected > MAX_CSV_TEXT_BYTES) {
		throw new Error(
			`${filename} would serialize to ${projected.toLocaleString()} ` +
				`characters, over V8's ${MAX_CSV_TEXT_BYTES.toLocaleString()} ` +
				`string limit (${rowCount.toLocaleString()} rows). The CSV writer ` +
				"builds each file as ONE string, so this is a hard ceiling rather " +
				"than memory pressure — `Array.prototype.join` throws " +
				"`RangeError: Invalid string length` a moment after this point, " +
				"naming neither the table nor the cause. Streaming the export " +
				"(an AsyncIterable seam through strip → pseudonymize → csv → the " +
				"guards) is the fix; it is DATASET.2's carried item C7 and needs " +
				"its own reviewer pass.",
		);
	}

	// Trailing newline: a POSIX text file ends with one, and its absence
	// makes the last record vanish in a few line-oriented tools.
	return {
		filename,
		text: `${lines.join("\n")}\n`,
		columns: cols,
		rowCount,
	};
}

/**
 * Count data rows in emitted CSV text — the independent recount.
 *
 * ⚠ Exists so the manifest's number can be checked against the FILE rather
 * than against the writer's own bookkeeping. `toCsv` counting its own loop is
 * honest but self-reported; this parses the bytes that will actually ship. If
 * the two ever disagree, the file is what shipped and the counter is wrong.
 *
 * Quote-aware, because a `comments.body` containing a newline is not
 * hypothetical — it is the normal case for the dataset's thesis-core column,
 * and a naive `split("\n").length` would report several rows for one comment.
 */
export function countCsvRows(text: string): number {
	if (text === "") return 0;

	// ⚠ Counts RECORD TERMINATORS, not content. The obvious implementation —
	// "did this line contain a non-empty character?" — under-counts a data
	// line whose fields are all empty, which for a one-column table is the
	// literal empty string between two newlines. That is a real row, and it
	// is indistinguishable from a blank line by inspection; what distinguishes
	// it is that a terminator preceded it.
	//
	// Unreachable through `buildDataset` today (every shipped table has five
	// or more columns, so every data line contains commas) and it failed
	// CLOSED through the row-count gate — but on a confusing error rather
	// than the truth.
	let terminators = 0;
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"') {
			// A doubled quote inside a quoted field is an escaped quote.
			if (inQuotes && text[i + 1] === '"') {
				i++;
				continue;
			}
			inQuotes = !inQuotes;
			continue;
		}
		if (ch === "\n" && !inQuotes) terminators++;
	}

	// A final record with no trailing newline still counts.
	const unterminated = text.endsWith("\n") ? 0 : 1;

	// Minus the header line.
	return Math.max(0, terminators + unterminated - 1);
}
