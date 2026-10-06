// SEED-STAGING-1 — reads an uploaded .csv or .xlsx into raw rows.
//
// Nothing is interpreted here beyond locating columns: every value comes out
// as a string and `validate.ts` decides what it means. The one trap worth
// naming: exceljs's CSV reader converts values by default (numbers, and
// anything that parses as a date), which would turn an argument reading
// "May 5" into a Date. The identity `map` below keeps every cell as written.

import "server-only";

import { Readable } from "node:stream";

// TYPE-only at module scope; the library itself is loaded inside
// `parseSeedFile` (security audit M-1). A static import would be evaluated
// when the route module loads — before `guardSeedRequest` runs — so an
// anonymous request to the production URL would make the server load the
// whole zip/XML stack (75 packages, ~1 s) just to answer 404.
import type ExcelJS from "exceljs";

import type { RawSeedRow, SeedRowError } from "./types";

/** Upload ceilings — a seeding sheet is hundreds of rows, not a data dump. */
export const SEED_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SEED_FILE_MAX_ROWS = 5000;
/** One tab per market, with generous headroom; a workbook of hundreds is not a seeding sheet. */
export const SEED_FILE_MAX_SHEETS = 50;
// ⚠ Residual, stated: `workbook.xlsx.load` decompresses and parses the whole
// workbook before any check below runs, so the 5 MB upload cap bounds the
// INPUT, not the memory a pathologically compressible file expands to. The
// surface is admin-authenticated, so the worst case is the operator stalling
// their own task — ⚠ on production since SEED-PROD-1, that is the single task
// serving participants. A streaming reader
// (`ExcelJS.stream.xlsx.WorkbookReader`) would bound it, at the cost of a
// second code path; not taken for v1 (ADR-0064).

type Field = "market" | "user" | "side" | "stake" | "argument" | "replyTo";

const HEADER_ALIASES: Record<string, Field> = {
	market: "market",
	user: "user",
	side: "side",
	stake: "stake",
	argument: "argument",
	replyto: "replyTo",
};

/** "Reply To", "reply_to", " replyto " → "replyto". */
function normalizeHeader(raw: string): string {
	return raw
		.replace(/^﻿/, "")
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "");
}

function cellText(cell: ExcelJS.Cell): string {
	const v = cell.value;
	if (v === null || v === undefined) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return cell.text ?? "";
}

function fileError(message: string): { rows: []; errors: SeedRowError[] } {
	return { rows: [], errors: [{ rowNumber: 0, message }] };
}

/** Column index (1-based) per field, from a sheet's first row. */
function readHeader(sheet: ExcelJS.Worksheet): Map<Field, number> {
	const columns = new Map<Field, number>();
	sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
		// Own keys only: a header named "__proto__" or "constructor" must not
		// resolve to an Object.prototype member (security audit, LOW).
		const key = normalizeHeader(cellText(cell));
		const field = Object.hasOwn(HEADER_ALIASES, key)
			? HEADER_ALIASES[key]
			: undefined;
		if (field && !columns.has(field)) columns.set(field, col);
	});
	return columns;
}

function missingHeaders(
	columns: Map<Field, number>,
	required: readonly Field[],
): Field[] {
	return required.filter((f) => !columns.has(f));
}

function displayHeader(f: Field): string {
	return f === "replyTo" ? "reply_to" : f;
}

export async function parseSeedFile(args: {
	fileName: string;
	bytes: Uint8Array;
}): Promise<{ rows: RawSeedRow[]; errors: SeedRowError[] }> {
	if (args.bytes.byteLength > SEED_FILE_MAX_BYTES) {
		return fileError(
			`file is ${args.bytes.byteLength} bytes; the limit is ${SEED_FILE_MAX_BYTES}`,
		);
	}
	const ext = args.fileName.toLowerCase().split(".").pop() ?? "";
	const { default: Excel } = await import("exceljs");
	const workbook = new Excel.Workbook();
	try {
		if (ext === "csv") {
			await workbook.csv.read(Readable.from(Buffer.from(args.bytes)), {
				map: (value: unknown) => value,
			});
		} else if (ext === "xlsx") {
			await workbook.xlsx.load(
				Buffer.from(args.bytes) as unknown as ExcelJS.Buffer,
			);
		} else {
			return fileError(
				`unsupported file type ".${ext}" — upload a .csv or .xlsx`,
			);
		}
	} catch (err) {
		return fileError(
			`could not read the file: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const sheets = workbook.worksheets;
	if (sheets.length === 0) return fileError("the file has no sheets");
	if (sheets.length > SEED_FILE_MAX_SHEETS) {
		return fileError(
			`the file has ${sheets.length} sheets; the limit is ${SEED_FILE_MAX_SHEETS}`,
		);
	}

	// Layout: a `market` column on the first sheet means one sheet holds every
	// market. Without it, each tab is a market and its name is the slug.
	const firstColumns = readHeader(sheets[0]);
	// A CSV has no tabs, so it is ALWAYS the single-sheet layout and must name
	// its markets in a column. Falling through to the tab layout would make
	// the CSV reader's synthetic sheet name ("sheet1") every row's market.
	const singleSheet = ext === "csv" || firstColumns.has("market");
	const plan: Array<{
		sheet: ExcelJS.Worksheet;
		columns: Map<Field, number>;
		slug: string | null;
	}> = singleSheet
		? [{ sheet: sheets[0], columns: firstColumns, slug: null }]
		: sheets.map((sheet) => ({
				sheet,
				columns: readHeader(sheet),
				slug: sheet.name.trim(),
			}));

	const errors: SeedRowError[] = [];
	const required: readonly Field[] = singleSheet
		? ["market", "side", "stake", "argument"]
		: ["side", "stake", "argument"];
	for (const { sheet, columns } of plan) {
		const missing = missingHeaders(columns, required);
		if (missing.length > 0) {
			errors.push({
				rowNumber: 0,
				message: `sheet "${sheet.name}" is missing column(s): ${missing.map(displayHeader).join(", ")}`,
			});
		}
	}
	if (errors.length > 0) return { rows: [], errors };

	const rows: RawSeedRow[] = [];
	let rowNumber = 0;
	let tooMany = false;
	for (const { sheet, columns, slug } of plan) {
		const get = (row: ExcelJS.Row, field: Field): string => {
			const col = columns.get(field);
			return col === undefined ? "" : cellText(row.getCell(col));
		};
		// `eachRow` visits only rows that hold a value. The obvious
		// `for (r = 2; r <= sheet.rowCount; r++) sheet.getRow(r)` would CREATE a
		// Row for every empty index (exceljs's getRow materialises on read), so
		// a sheet merely formatted down to row 100 000 became 100 000 objects.
		sheet.eachRow({ includeEmpty: false }, (row, r) => {
			if (tooMany || r === 1) return;
			const values = {
				market: slug ?? get(row, "market").trim(),
				user: get(row, "user").trim(),
				side: get(row, "side").trim(),
				stake: get(row, "stake").trim(),
				argument: get(row, "argument"),
				replyTo: get(row, "replyTo").trim(),
			};
			// A blank row is skipped without taking a number, so the numbers
			// the operator sees in the preview stay dense.
			const blank =
				(slug !== null || values.market === "") &&
				values.user === "" &&
				values.side === "" &&
				values.stake === "" &&
				values.argument.trim() === "" &&
				values.replyTo === "";
			if (blank) return;
			rowNumber += 1;
			if (rowNumber > SEED_FILE_MAX_ROWS) {
				tooMany = true;
				return;
			}
			rows.push({ rowNumber, ...values });
		});
		if (tooMany) {
			return fileError(
				`the file has more than ${SEED_FILE_MAX_ROWS} rows — split it`,
			);
		}
	}
	return { rows, errors: [] };
}
