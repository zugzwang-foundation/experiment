import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";

// SEED-STAGING-1 §4 (sheet format) + §16 `parse.ts` — the file boundary.
//
// THE POINT OF THIS FILE: the content being uploaded is ARGUMENTS, and an
// argument is prose. It contains commas, quotation marks and line breaks, which
// is exactly the material a hand-rolled `split(",")` destroys — quietly, by
// truncating a sentence at its first comma and shifting every later column one
// place left. The row still parses, the stake becomes the tail of a sentence,
// and the operator finds out when validation reports something unrelated. §13
// names `exceljs` as the dependency precisely so this layer is not a regex.
//
// The other half is the row NUMBER. §7 derives every idempotency key from it
// (`seed-<batchId>-r<row>`) and §4 lets `reply_to` name it, so a blank row that
// consumed a number would re-point every reply below it at the wrong parent and
// change every key — which is to say a re-upload would duplicate the whole
// sheet instead of skipping it. "Fully blank rows are skipped and do not
// consume a rowNumber" is a correctness rule, not a convenience.

import { parseSeedFile } from "@/server/seed/parse";

const MARKET_A = "seed-market-a";
const MARKET_B = "seed-market-b";

function bytesOf(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function csv(lines: readonly string[]): Uint8Array {
	return bytesOf(lines.join("\n"));
}

/** An `.xlsx` built in-test — no binary fixture is committed. */
async function xlsx(
	sheets: readonly { name: string; rows: readonly unknown[][] }[],
): Promise<Uint8Array> {
	const workbook = new Workbook();
	for (const sheet of sheets) {
		const worksheet = workbook.addWorksheet(sheet.name);
		for (const row of sheet.rows) {
			worksheet.addRow([...row]);
		}
	}
	const buffer = await workbook.xlsx.writeBuffer();
	return new Uint8Array(buffer);
}

describe("seed-parse — CSV", () => {
	it("seed-parse::csv-keeps-quoted-commas-quotes-and-newlines-intact", async () => {
		// THE reason `exceljs` is a dependency rather than a `split(",")`. All
		// three hazards ride one field: a comma that is prose, an escaped pair of
		// quotes that is punctuation, and a newline that is a paragraph break.
		const argument = 'One, two, and "three" — then\na second line';
		const file = csv([
			"market,user,side,stake,argument,reply_to",
			`${MARKET_A},alpha,YES,10,"One, two, and ""three"" — then`,
			'a second line",',
		]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]).toEqual({
			rowNumber: 1,
			market: MARKET_A,
			user: "alpha",
			side: "YES",
			stake: "10",
			argument,
			replyTo: "",
		});
	});

	it("seed-parse::csv-headers-are-case-and-whitespace-insensitive", async () => {
		// An operator's own spreadsheet export capitalises and pads. Refusing it
		// would send them to fix a header instead of their data.
		const file = csv([
			"  MARKET , User ,Side, STAKE ,Argument, Reply To ",
			`${MARKET_A},alpha,yes,10,hello,`,
		]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows[0]?.market).toBe(MARKET_A);
		expect(result.rows[0]?.user).toBe("alpha");
		// Side is NOT normalised here — `parse.ts` reads, `validate.ts` judges.
		expect(result.rows[0]?.side).toBe("yes");
		expect(result.rows[0]?.stake).toBe("10");
		expect(result.rows[0]?.argument).toBe("hello");
	});

	it("seed-parse::csv-accepts-reply_to-replyto-and-reply-space-to", async () => {
		// §16: the three spellings are equivalent. Three separate files, because
		// a single file could not tell a working alias from a column that
		// happened to land in the right position.
		for (const header of ["reply_to", "replyto", "reply to"]) {
			const file = csv([
				`market,user,side,stake,argument,${header}`,
				`${MARKET_A},alpha,YES,10,parent,`,
				`${MARKET_A},beta,NO,50,child,1`,
			]);

			const result = await parseSeedFile({ fileName: "s.csv", bytes: file });

			expect(result.errors).toEqual([]);
			expect(result.rows.map((r) => r.replyTo)).toEqual(["", "1"]);
		}
	});

	it("seed-parse::csv-missing-a-required-header-is-a-file-level-error", async () => {
		// rowNumber 0 is the file-level channel (§16 `SeedRowError`). It has to be
		// distinguishable from row 1, because the report is per row and "your
		// header is wrong" is not something the first row did.
		const file = csv([
			"market,user,side,argument,reply_to",
			`${MARKET_A},alpha,YES,hello,`,
		]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.rows).toEqual([]);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.every((e) => e.rowNumber === 0)).toBe(true);
		expect(result.errors.map((e) => e.message).join(" ")).toContain("stake");
	});

	it("seed-parse::csv-single-sheet-requires-the-market-header", async () => {
		// The `market` column is required in the SINGLE-SHEET layout only (§4) —
		// a CSV has no tabs to take the slug from, so without it no row can be
		// placed anywhere.
		const file = csv(["user,side,stake,argument", "alpha,YES,10,hello"]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.rows).toEqual([]);
		expect(result.errors.map((e) => e.rowNumber)).toEqual([0]);
		expect(result.errors[0]?.message).toContain("market");
	});

	it("seed-parse::blank-rows-are-skipped-and-consume-no-row-number", async () => {
		// The load-bearing half is the NUMBERS, not the count: §7 keys every bet
		// on the row number and §4 lets `reply_to` name it, so a blank row that
		// consumed one would silently re-point replies and change every
		// idempotency key in the file.
		const file = csv([
			"market,user,side,stake,argument,reply_to",
			`${MARKET_A},,YES,10,first,`,
			",,,,,",
			"",
			"   ",
			`${MARKET_A},,YES,10,second,`,
		]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2]);
		expect(result.rows.map((r) => r.argument)).toEqual(["first", "second"]);
	});

	it("seed-parse::csv-does-not-trim-the-argument", async () => {
		// Every other field is trimmed; this one is the author's text. The
		// contract says so in `types.ts` and `validate.ts` depends on it (it
		// judges the TRIMMED form and stores the raw one).
		const file = csv([
			"market,user,side,stake,argument,reply_to",
			`${MARKET_A}, alpha ,YES, 10 ,"  spaced out  ",`,
		]);

		const result = await parseSeedFile({ fileName: "sheet.csv", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows[0]?.argument).toBe("  spaced out  ");
		expect(result.rows[0]?.user).toBe("alpha");
		expect(result.rows[0]?.stake).toBe("10");
	});
});

describe("seed-parse — XLSX", () => {
	it("seed-parse::xlsx-reads-the-first-sheet-when-it-carries-a-market-column", async () => {
		// §16: "if the FIRST sheet has a `market` header, rows come from that
		// sheet". The second sheet here is a decoy — an operator's workbook
		// routinely carries notes or a template tab beside the data, and reading
		// it as a market would invent rows nobody wrote.
		const file = await xlsx([
			{
				name: "data",
				rows: [
					["market", "user", "side", "stake", "argument", "reply_to"],
					[MARKET_A, "alpha", "YES", 10, "from the data sheet", null],
				],
			},
			{ name: "notes", rows: [["ignore me entirely"]] },
		]);

		const result = await parseSeedFile({ fileName: "book.xlsx", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]?.market).toBe(MARKET_A);
		expect(result.rows[0]?.argument).toBe("from the data sheet");
		// A NUMERIC cell becomes the string the contract promises — an operator
		// types 10 into Excel and gets a number, not text.
		expect(result.rows[0]?.stake).toBe("10");
	});

	it("seed-parse::xlsx-takes-the-market-from-the-tab-name-with-continuous-row-numbers", async () => {
		// The second §4 layout. The continuity across tabs is what `reply_to`
		// and the idempotency keys depend on: the numbers are a single sequence
		// over the whole FILE, in tab order, not per sheet.
		const file = await xlsx([
			{
				name: MARKET_A,
				rows: [
					["user", "side", "stake", "argument", "reply_to"],
					["alpha", "YES", 10, "a-one", null],
					["beta", "NO", 50, "a-two", 1],
				],
			},
			{
				name: MARKET_B,
				rows: [
					["user", "side", "stake", "argument", "reply_to"],
					["gamma", "NO", 10, "b-one", null],
					["delta", "YES", 50, "b-two", 3],
				],
			},
		]);

		const result = await parseSeedFile({ fileName: "book.xlsx", bytes: file });

		expect(result.errors).toEqual([]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4]);
		expect(result.rows.map((r) => r.market)).toEqual([
			MARKET_A,
			MARKET_A,
			MARKET_B,
			MARKET_B,
		]);
		expect(result.rows.map((r) => r.argument)).toEqual([
			"a-one",
			"a-two",
			"b-one",
			"b-two",
		]);
		// Row 4 names row 3 — the reply reference is in FILE coordinates, which
		// is the only reading under which it can be resolved at all.
		expect(result.rows.map((r) => r.replyTo)).toEqual(["", "1", "", "3"]);
	});

	it("seed-parse::xlsx-without-a-market-column-still-requires-side-stake-and-argument", async () => {
		const file = await xlsx([
			{
				name: MARKET_A,
				rows: [
					["user", "side", "argument"],
					["alpha", "YES", "no stake column"],
				],
			},
		]);

		const result = await parseSeedFile({ fileName: "book.xlsx", bytes: file });

		expect(result.rows).toEqual([]);
		expect(result.errors.map((e) => e.rowNumber)).toEqual([0]);
		expect(result.errors[0]?.message).toContain("stake");
	});

	it("seed-parse::unsupported-extension-is-a-file-level-error", async () => {
		// Fail CLOSED on an unrecognised file. The alternative — guessing the
		// format from the bytes — produces a half-read sheet that validates, and
		// the operator has no way to tell that from a sheet they wrote wrong.
		for (const fileName of [
			"notes.txt",
			"legacy.xls",
			"data.numbers",
			"data",
		]) {
			const result = await parseSeedFile({
				fileName,
				bytes: bytesOf("market,side,stake,argument\na,YES,10,hi"),
			});
			expect(result.rows).toEqual([]);
			expect(result.errors.map((e) => e.rowNumber)).toEqual([0]);
		}
	});

	it("seed-parse::a-header-only-file-yields-no-rows-and-no-errors", async () => {
		// The empty-but-well-formed case: nothing to run, nothing to report. It
		// must not be an error, or an operator clearing a sheet to retry sees a
		// failure instead of a no-op.
		const result = await parseSeedFile({
			fileName: "sheet.csv",
			bytes: csv(["market,user,side,stake,argument,reply_to"]),
		});
		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([]);
	});
});
