import { describe, expect, it } from "vitest";

import { generateTable } from "../../prod-seed/_lib/generate";
import {
	rowDepths,
	type SeedRow,
	type SeedTable,
	validateTable,
} from "../../prod-seed/_lib/table";

// SEED-1-DUMMY — ADR-0053. One broken fixture per rule, each asserting the
// SPECIFIC message, plus positive controls: a hand-built table, a hand-built
// depth-2 table and a generated 100-user / 200-row one (SEED-DEPTH2; the
// 1000-user positive control was replaced with the run spec it describes). A validator that returned [] for everything would
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
				key: "seed.testrun1.0.1",
				market: "mkt-a",
				seq: 1,
				author: "A0001",
			}),
			row({
				key: "seed.testrun1.0.2",
				market: "mkt-a",
				seq: 2,
				postNo: 2,
				side: "NO",
				author: "A0002",
			}),
			row({
				key: "seed.testrun1.0.3",
				market: "mkt-a",
				seq: 3,
				kind: "support",
				stake: "60",
				author: "A0003",
				parentKey: "seed.testrun1.0.1",
			}),
			row({
				key: "seed.testrun1.0.4",
				market: "mkt-a",
				seq: 4,
				kind: "counter",
				side: "NO",
				stake: "60",
				author: "A0004",
				parentKey: "seed.testrun1.0.1",
			}),
			row({
				key: "seed.testrun1.1.1",
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

	it("accepts a generated 100-user, 200-row, 8-market depth-2 table with exact counts, even spacing, no images, and determinism", () => {
		const opts = {
			runId: "genrun01",
			markets: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"],
			users: 100,
			postsPerMarket: 8,
			repliesPerMarket: 10,
			depth2PerMarket: 7,
			yesRatio: 0.4,
			imageRatio: 0,
			imageExt: "png",
			windowMs: 14 * 60_000,
			spacing: "even" as const,
			seed: 7,
		};
		const a = generateTable(opts);
		expect(validateTable(a)).toEqual([]);
		expect(a.rows.length).toBe(200);
		expect(new Set(a.rows.map((r) => r.author)).size).toBe(100);

		const depths = rowDepths(a.rows);
		const count = (d: number, market?: string) =>
			a.rows.filter(
				(r) =>
					depths.get(r.key) === d &&
					(market === undefined || r.market === market),
			).length;
		expect([count(0), count(1), count(2)]).toEqual([64, 80, 56]);
		for (const m of opts.markets)
			expect([count(0, m), count(1, m), count(2, m)]).toEqual([8, 10, 7]);

		expect(a.rows.every((r) => r.image === null)).toBe(true);
		expect(a.rows.every((r) => r.body.startsWith("[DUMMY]"))).toBe(true);

		// Even: row i is due at floor(i * window / rows) — a constant gap.
		a.rows.forEach((r, i) => {
			expect(r.dueOffsetMs).toBe(Math.floor((i * opts.windowMs) / 200));
		});

		expect(JSON.stringify(generateTable(opts))).toBe(JSON.stringify(a));
		// Even spacing draws nothing from the RNG, so the window moves ONLY the
		// offsets: keys, authors and stakes (hence fingerprints) are unchanged.
		const noWindow = generateTable({ ...opts, windowMs: 0 });
		expect(noWindow.rows.map((r) => ({ ...r, dueOffsetMs: 0 }))).toEqual(
			a.rows.map((r) => ({ ...r, dueOffsetMs: 0 })),
		);
	});
});

/** A valid hand-built depth-2 chain: post → counter (d1) → support (d2). */
const depth2 = (): SeedTable => {
	const row = (
		r: Partial<SeedRow> & Pick<SeedRow, "key" | "seq">,
	): SeedRow => ({
		market: "mkt-a",
		postNo: 1,
		kind: "post",
		side: "YES",
		stake: "10",
		author: "A0001",
		body: "[DUMMY] Post",
		parentKey: null,
		image: null,
		dueOffsetMs: 0,
		...r,
	});
	return {
		runId: "testrun1",
		markets: ["mkt-a", "mkt-b"],
		rows: [
			row({ key: "seed.testrun1.0.1", seq: 1 }),
			row({
				key: "seed.testrun1.0.2",
				seq: 2,
				kind: "counter",
				side: "NO",
				stake: "60",
				author: "A0002",
				body: "[DUMMY] Counter",
				parentKey: "seed.testrun1.0.1",
			}),
			// Support on the NO counter → NO. Its author is the ROOT post's author,
			// which is allowed: self-reply is judged against the immediate parent.
			// A0001 then holds NO on mkt-a, though, so a separate author is used
			// here and the root-author case has its own test below.
			row({
				key: "seed.testrun1.0.3",
				seq: 3,
				kind: "support",
				side: "NO",
				stake: "60",
				author: "A0003",
				body: "[DUMMY] Support",
				parentKey: "seed.testrun1.0.2",
			}),
			row({
				key: "seed.testrun1.1.1",
				market: "mkt-b",
				seq: 1,
				author: "A0004",
			}),
		],
	};
};

function brokenDepth2(
	mutate: (rows: SeedRow[]) => SeedRow[] | undefined,
): string[] {
	const table = depth2();
	const rows = table.rows.map((r) => ({ ...r }));
	return validateTable({ ...table, rows: mutate(rows) ?? rows });
}

describe("validateTable — depth 2 (SEED-DEPTH2)", () => {
	it("accepts a valid depth-2 chain, and derives depths 0/1/2", () => {
		const t = depth2();
		expect(validateTable(t)).toEqual([]);
		const d = rowDepths(t.rows);
		expect(t.rows.map((r) => d.get(r.key))).toEqual([0, 1, 2, 0]);
	});

	it("accepts a depth-2 reply by the ROOT post's author (only the immediate parent is excluded)", () => {
		// A counter on the NO counter is YES — the side A0001 already holds.
		const errors = brokenDepth2(
			(r) =>
				void Object.assign(r[2] as SeedRow, {
					kind: "counter",
					side: "YES",
					author: "A0001",
				}),
		);
		expect(errors).toEqual([]);
	});

	it("refuses depth 3", () => {
		const errors = brokenDepth2((r) => {
			const d3: SeedRow = {
				...(r[2] as SeedRow),
				key: "seed.testrun1.0.4",
				seq: 4,
				kind: "support",
				side: "NO",
				author: "A0005",
				parentKey: "seed.testrun1.0.3",
			};
			return [r[0], r[1], r[2], d3, r[3]] as SeedRow[];
		});
		expect(errors.some((e) => /reply depth 3 exceeds 2/.test(e))).toBe(true);
	});

	it("refuses a stance side that is not relative to the IMMEDIATE parent", () => {
		// Support on a NO counter must be NO; YES would be "support of the post".
		const errors = brokenDepth2(
			(r) => void Object.assign(r[2] as SeedRow, { side: "YES" }),
		);
		expect(errors.some((e) => /support side YES, expected NO/.test(e))).toBe(
			true,
		);
	});

	it("refuses a self-reply to the immediate parent", () => {
		const errors = brokenDepth2(
			(r) => void Object.assign(r[2] as SeedRow, { author: "A0002" }),
		);
		expect(
			errors.some((e) => /reply author is the parent author/.test(e)),
		).toBe(true);
	});

	it("refuses a depth-2 parent in another market", () => {
		const errors = brokenDepth2((r) => {
			// Move the depth-2 row to mkt-b (keeping its key shape valid there).
			const moved: SeedRow = {
				...(r[2] as SeedRow),
				key: "seed.testrun1.1.2",
				market: "mkt-b",
				seq: 2,
			};
			return [r[0], r[1], r[3], moved] as SeedRow[];
		});
		expect(
			errors.some((e) => /reply parent is in another market/.test(e)),
		).toBe(true);
	});

	it("refuses a depth-2 row whose postNo differs from its parent", () => {
		const errors = brokenDepth2(
			(r) => void Object.assign(r[2] as SeedRow, { postNo: 2 }),
		);
		expect(errors.some((e) => /postNo differs from parent/.test(e))).toBe(true);
	});

	it("refuses a depth-2 child placed before its parent", () => {
		const errors = brokenDepth2((r) => {
			const [p, d1, d2, other] = r as [SeedRow, SeedRow, SeedRow, SeedRow];
			return [
				p,
				{
					...d2,
					key: "seed.testrun1.0.2",
					seq: 2,
					parentKey: "seed.testrun1.0.3",
				},
				{ ...d1, key: "seed.testrun1.0.3", seq: 3 },
				other,
			];
		});
		expect(errors.some((e) => /does not precede/.test(e))).toBe(true);
	});

	it("refuses a depth-2 reply below the reply floor", () => {
		const errors = brokenDepth2(
			(r) => void Object.assign(r[2] as SeedRow, { stake: "40" }),
		);
		expect(errors.some((e) => /support stake 40 outside 50-250/.test(e))).toBe(
			true,
		);
	});

	it("refuses an image on a depth-2 reply", () => {
		const errors = brokenDepth2(
			(r) => void Object.assign(r[2] as SeedRow, { image: "x.png" }),
		);
		expect(errors.some((e) => /reply carries an image/.test(e))).toBe(true);
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
						parentKey: "seed.testrun1.0.9",
					}),
				/does not precede/,
			],
			[
				"no self-reply",
				(r) => void Object.assign(r[2] as SeedRow, { author: "A0001" }),
				/reply author is the parent author/,
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
							key: "seed.testrun1.1.2",
							seq: 2,
							postNo: 2,
							stake: "10",
							author: "A0005",
						},
						{
							...(r[4] as SeedRow),
							key: "seed.testrun1.1.3",
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
					void Object.assign(r[1] as SeedRow, { key: "seed.testrun1.0.99" }),
				/key does not match/,
			],
			[
				"key outside the route's idempotency alphabet (security-auditor M-2)",
				(r) =>
					void Object.assign(r[1] as SeedRow, { key: "seed-testrun1-0-2" }),
				/key shape/,
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
