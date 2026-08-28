import type { SourceRow } from "./strip";

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
	// Latent while the only source is the fixture (all ISO strings), and live
	// on the first row a drizzle reader returns: every shipped table has a
	// `created_at`, and `timestamp({ withTimezone: true })` hands back a JS
	// `Date`. So this fires on the release task's very first real read.
	const s =
		value instanceof Date
			? value.toISOString()
			: typeof value === "object"
				? JSON.stringify(value)
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
