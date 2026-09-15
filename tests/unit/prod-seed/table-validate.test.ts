import { describe, expect, it } from "vitest";

import { generateTable } from "../../prod-seed/_lib/generate";
import {
	type SeedRow,
	type SeedTable,
	validateTable,
} from "../../prod-seed/_lib/table";

// SEED-1-DUMMY — ADR-0053. One broken fixture per rule, each asserting the
// SPECIFIC message, plus two positive controls: a hand-built table and a full
// 1000-user generated one. A validator that returned [] for everything would
// pass every negative case's "not empty" check only if the message is asserted,
// which is why each case names its message.

const base = (): SeedTable => {
	const row = (
		r: Partial<SeedRow> & Pick<SeedRow, "key" | "market" | "seq">,
	): SeedRow => ({
		postNo: 1,
		kind: "post",
		side: "YES",
		stake: "10",
		author: "A0001",
		body: "[DUMMY SEED] body",
		parentKey: null,
		image: null,
		dueOffsetMs: 0,
		...r,
	});
	return {
		runId: "testrun1",
		markets: ["mkt-a", "mkt-b"],
		rows: [
			row({
				key: "seed-testrun1-0-1",
				market: "mkt-a",
				seq: 1,
				author: "A0001",
			}),
			row({
				key: "seed-testrun1-0-2",
				market: "mkt-a",
				seq: 2,
				postNo: 2,
				side: "NO",
				author: "A0002",
			}),
			row({
				key: "seed-testrun1-0-3",
				market: "mkt-a",
				seq: 3,
				kind: "support",
				stake: "60",
				author: "A0003",
				parentKey: "seed-testrun1-0-1",
			}),
			row({
				key: "seed-testrun1-0-4",
				market: "mkt-a",
				seq: 4,
				kind: "counter",
				side: "NO",
				stake: "60",
				author: "A0004",
				parentKey: "seed-testrun1-0-1",
			}),
			row({
				key: "seed-testrun1-1-1",
				market: "mkt-b",
				seq: 1,
				author: "A0001",
			}),
		],
	};
};

function broken(mutate: (rows: SeedRow[]) => SeedRow[] | undefined): string[] {
	const table = base();
	const rows = table.rows.map((r) => ({ ...r }));
	return validateTable({ ...table, rows: mutate(rows) ?? rows });
}

describe("validateTable — positive controls", () => {
	it("accepts the hand-built table", () => {
		expect(validateTable(base())).toEqual([]);
	});

	it("accepts a generated 1000-user, 8-market table, and generation is deterministic", () => {
		const opts = {
			runId: "genrun01",
			markets: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"],
			users: 1000,
			postsPerMarket: 100,
			coverage: 0.5,
			yesRatio: 0.4,
			imageRatio: 0.5,
			imageExt: "png",
			windowMs: 24 * 3_600_000,
			seed: 7,
		};
		const a = generateTable(opts);
		expect(validateTable(a)).toEqual([]);
		expect(a.rows.length).toBe(8 * (100 + 50 * 2));
		expect(new Set(a.rows.map((r) => r.author)).size).toBe(1000);
		expect(JSON.stringify(generateTable(opts))).toBe(JSON.stringify(a));
	});
});

describe("validateTable — every rule refuses", () => {
	const cases: [string, (rows: SeedRow[]) => SeedRow[] | undefined, RegExp][] =
		[
			[
				"post floor",
				(r) => void Object.assign(r[0] as SeedRow, { stake: "5" }),
				/post stake 5 outside 10-250/,
			],
			[
				"reply floor",
				(r) => void Object.assign(r[2] as SeedRow, { stake: "20" }),
				/support stake 20 outside 50-250/,
			],
			[
				"ceiling",
				(r) => void Object.assign(r[1] as SeedRow, { stake: "300" }),
				/post stake 300 outside/,
			],
			[
				"whole-number stake",
				(r) => void Object.assign(r[0] as SeedRow, { stake: "12.5" }),
				/not a whole number/,
			],
			[
				"reply parent must precede",
				(r) =>
					void Object.assign(r[2] as SeedRow, {
						parentKey: "seed-testrun1-0-9",
					}),
				/does not precede/,
			],
			[
				"no self-reply",
				(r) => void Object.assign(r[2] as SeedRow, { author: "A0001" }),
				/reply author is the post author/,
			],
			[
				"counter takes the opposite side",
				(r) => void Object.assign(r[3] as SeedRow, { side: "YES" }),
				/counter side YES, expected NO/,
			],
			[
				"one held side per market",
				(r) => void Object.assign(r[2] as SeedRow, { author: "A0002" }),
				/A0002 already holds NO on mkt-a/,
			],
			[
				"spend cap",
				(r) => {
					Object.assign(r[0] as SeedRow, { stake: "250" });
					Object.assign(r[4] as SeedRow, { stake: "250" });
					return [
						...r,
						{
							...(r[4] as SeedRow),
							key: "seed-testrun1-1-2",
							seq: 2,
							postNo: 2,
							stake: "10",
							author: "A0005",
						},
						{
							...(r[4] as SeedRow),
							key: "seed-testrun1-1-3",
							seq: 3,
							postNo: 3,
							stake: "10",
							author: "A0001",
						},
					];
				},
				/A0001 spend 510 > 500/,
			],
			[
				"no consecutive author",
				(r) => void Object.assign(r[4] as SeedRow, { author: "A0004" }),
				/same author as previous row/,
			],
			[
				"no image on a reply",
				(r) => void Object.assign(r[2] as SeedRow, { image: "x.png" }),
				/reply carries an image/,
			],
			[
				"image used once",
				(r) => {
					Object.assign(r[0] as SeedRow, { image: "a.png" });
					Object.assign(r[1] as SeedRow, { image: "a.png" });
					return undefined;
				},
				/image a\.png used twice/,
			],
			[
				"accepted image type",
				(r) => void Object.assign(r[0] as SeedRow, { image: "a.svg" }),
				/image type a\.svg/,
			],
			[
				"key matches run/market/seq",
				(r) =>
					void Object.assign(r[1] as SeedRow, { key: "seed-testrun1-0-99" }),
				/key does not match/,
			],
			[
				"non-empty body",
				(r) => void Object.assign(r[0] as SeedRow, { body: "   " }),
				/empty body/,
			],
			[
				"body length",
				(r) => void Object.assign(r[0] as SeedRow, { body: "x".repeat(5001) }),
				/body too long/,
			],
			[
				"due offsets never decrease",
				(r) => {
					Object.assign(r[0] as SeedRow, { dueOffsetMs: 100 });
					return undefined;
				},
				/dueOffsetMs decreases/,
			],
			[
				"market listed in the table",
				(r) => void Object.assign(r[4] as SeedRow, { market: "zzz" }),
				/market zzz is not in the table/,
			],
		];

	for (const [name, mutate, message] of cases) {
		it(name, () => {
			const errors = broken(mutate);
			expect(errors.some((e) => message.test(e))).toBe(true);
		});
	}
});
