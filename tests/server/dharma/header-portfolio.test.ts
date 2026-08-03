import {
	and,
	eq,
	getTableName,
	inArray,
	type SQL,
	type Table,
} from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/db";
import { payoutEvents, pools, positions } from "@/db/schema";
import { computeSell, getPrices } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { getHeaderPortfolio } from "@/server/dharma/header-portfolio";

/**
 * T1 + T2 (HEADER-PORTFOLIO §7) — the header Portfolio read.
 *
 * NOT DB-BACKED. The subject here is the STATEMENT SHAPE and the in-memory
 * semantics, and both are invisible to a real-Postgres run: a query issued
 * against the wrong table with the wrong predicate still returns rows. So the
 * client is a hand-rolled recorder (the `header-balance.integration.test.ts:260`
 * `clientFailingOnSelect` idiom, widened to record as well as respond) and the
 * FI-2 value identity is locked separately, against real data, by T3
 * (`tests/integration/header-portfolio.integration.test.ts`).
 *
 * T1 pins R3 — the same-source mandate. `getHeaderPortfolio`'s three statements
 * MUST mirror `loadProfilePositions` statements 1 · 2 · 4 (`positions.ts:139`,
 * `:163`, `:189`) in table, columns and predicate. The mirror is asserted by
 * CONSTRUCTING the expected predicate with drizzle's own `eq`/`and`/`inArray`
 * over the real schema columns and comparing the rendered SQL + bind params, so
 * the assertion tracks drizzle's renderer rather than a hand-typed string. The
 * table name comes from `getTableName(table)` — the actual object the module
 * passed to `.from(...)`, never a literal.
 *
 * T1 also pins SG4 (no transaction) and R12's accepted budget: three statements
 * on the populated path, exactly ONE on the empty path.
 *
 * T2 pins the semantics: R9 (zero is a value, absence is `null`), R5 (a
 * `payout_events` ROW — not a non-zero amount — is the settled discriminant),
 * R1/R2 (Đb is `computeSell(...).proceeds`, never a spot-price product), and R8
 * (a read failure degrades to `null` and REPORTS).
 */

// The fail-safe reports through `safeCaptureException`; mocked so the test can
// assert it FIRED. A catch that silently fails to report is the worst of the
// three outcomes and would otherwise be indistinguishable from one that works.
// The spy lives in `vi.hoisted` because `vi.mock` factories are hoisted above
// imports and module-scope consts are in TDZ inside them (the
// `tests/unit/rate-limit-prefix.test.ts:17-19` note).
const { captureSpy } = vi.hoisted(() => ({
	captureSpy: vi.fn(() => true),
}));

vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: captureSpy,
}));

// ───────────────────────────── the recorder ─────────────────────────────

/** One `.select(...).from(...).where(...)` chain, as the module issued it. */
type RecordedStatement = {
	/** The REAL table name, read off the drizzle table object the module passed. */
	table: string;
	/** The select map's keys, in declaration order (the returned row shape). */
	fields: string[];
	/** The underlying DB column names those keys project. */
	columns: string[];
	/** The predicate rendered by the pg dialect — SQL text + bind params. */
	sql: string;
	params: unknown[];
};

const dialect = new PgDialect();

/** Render a drizzle predicate the same way both sides of a mirror assertion do. */
function renderPredicate(predicate: SQL): { sql: string; params: unknown[] } {
	const query = dialect.sqlToQuery(predicate);
	return { sql: query.sql, params: [...query.params] };
}

/** The DB column name behind a select-map value (a drizzle `Column`). */
function columnNameOf(value: unknown): string {
	if (
		typeof value === "object" &&
		value !== null &&
		"name" in value &&
		typeof (value as { name: unknown }).name === "string"
	) {
		return (value as { name: string }).name;
	}
	return "<not-a-column>";
}

/** Fixture rows keyed by REAL table name — every column value is a decimal/enum string. */
type FixtureRows = Record<string, ReadonlyArray<Record<string, string>>>;

type Recorder = {
	client: DbClient;
	statements: RecordedStatement[];
	/** `.select()` invocations — counted separately so a chain that never reaches
	 *  `.where()` still shows up in the statement budget. */
	calls: { select: number };
	transaction: ReturnType<typeof vi.fn>;
};

/**
 * A fake `DbClient` that records each statement and answers it from `rows`,
 * keyed by TABLE (not by call index) so the semantic tests do not silently
 * depend on the ordering T1 pins separately.
 *
 * Deliberately minimal: only `.select().from().where()` resolves. A module that
 * bolts on `.orderBy()` / `.limit()` / a join blows up here rather than passing
 * quietly — that is a divergence from the `positions.ts` mirror (R3) and should
 * be loud.
 */
function recordingClient(rows: FixtureRows): Recorder {
	const statements: RecordedStatement[] = [];
	const calls = { select: 0 };
	const transaction = vi.fn();
	const client = {
		transaction,
		select(fields: Record<string, unknown>) {
			calls.select += 1;
			return {
				from(table: Table) {
					return {
						where(predicate: SQL) {
							const rendered = renderPredicate(predicate);
							statements.push({
								table: getTableName(table),
								fields: Object.keys(fields),
								columns: Object.values(fields).map(columnNameOf),
								sql: rendered.sql,
								params: rendered.params,
							});
							return Promise.resolve(rows[getTableName(table)] ?? []);
						},
					};
				},
			};
		},
	} as unknown as DbClient;
	return { client, statements, calls, transaction };
}

const BOOM = "simulated postgres failure";

/**
 * A recorder whose `nth` `.select()` throws; every other call answers from
 * `rows`. No DB — the point is the throw, and routing the good calls through a
 * real client would make WHICH statement failed depend on fixture state rather
 * than on the parameter (`header-balance.integration.test.ts:260`).
 */
function clientFailingOnSelect(nth: number, rows: FixtureRows): DbClient {
	const base = recordingClient(rows);
	let calls = 0;
	return {
		transaction: base.transaction,
		select(fields: Record<string, unknown>) {
			calls += 1;
			if (calls === nth) {
				throw new Error(BOOM);
			}
			// Delegate to the recorder so the surviving calls behave normally and
			// the module can actually REACH a later statement.
			const inner = base.client as unknown as {
				select: (f: Record<string, unknown>) => unknown;
			};
			return inner.select(fields);
		},
	} as unknown as DbClient;
}

// ───────────────────────────── fixtures ─────────────────────────────

// Ids are opaque here — nothing reaches Postgres, so readable strings beat
// UUIDs for failure output. Both sides of every predicate assertion are built
// from these same constants.
const USER_ID = "viewer-user-id";
const M_OPEN_1 = "market-open-1";
const M_SETTLED = "market-settled";
const M_OPEN_2 = "market-open-2";

/** The canonical 18-dp zero, through the SHIPPED quantizer (never a literal). */
const CANONICAL_ZERO = toFixed18(new CpmmDecimal(0));

function positionRow(
	marketId: string,
	side: "YES" | "NO",
	quantity: string,
): Record<string, string> {
	return { marketId, side, quantity };
}

function poolRow(
	marketId: string,
	yesReserves: string,
	noReserves: string,
): Record<string, string> {
	return { marketId, yesReserves, noReserves };
}

/**
 * THREE held markets, ONE of them settled — the shape T1's pool-list trap and
 * T2's mixed sum both need. Reserves are ASYMMETRIC and differ per market, so an
 * implementation that pairs a holding with the wrong pool produces a different
 * number instead of an accidentally-equal one.
 */
const MIXED: FixtureRows = {
	[getTableName(positions)]: [
		positionRow(M_OPEN_1, "YES", "30.000000000000000000"),
		positionRow(M_SETTLED, "NO", "40.000000000000000000"),
		positionRow(M_OPEN_2, "NO", "25.000000000000000000"),
	],
	// R5's sharp edge: the ONLY payout leg for M_SETTLED is a ZERO amount, and it
	// still marks the market settled. `settle.ts:126–137` writes a zero-amount row
	// per bet, so amount-nonzero is not a sound discriminant; row EXISTENCE is.
	[getTableName(payoutEvents)]: [
		{ marketId: M_SETTLED, amount: CANONICAL_ZERO },
	],
	[getTableName(pools)]: [
		poolRow(M_OPEN_1, "120.000000000000000000", "80.000000000000000000"),
		poolRow(M_SETTLED, "90.000000000000000000", "150.000000000000000000"),
		poolRow(M_OPEN_2, "200.000000000000000000", "50.000000000000000000"),
	],
};

const ALL_HELD_IDS = [M_OPEN_1, M_SETTLED, M_OPEN_2];

/** Đb for one holding, through the SHIPPED `computeSell` — the single R1 authority. */
function db(
	marketId: string,
	side: "YES" | "NO",
	shares: string,
): InstanceType<typeof CpmmDecimal> {
	const pool = MIXED[getTableName(pools)]?.find((p) => p.marketId === marketId);
	return new CpmmDecimal(
		computeSell({
			reserves: { yes: pool?.yesReserves ?? "", no: pool?.noReserves ?? "" },
			side: side === "YES" ? "yes" : "no",
			shares,
		}).proceeds,
	);
}

beforeEach(() => {
	captureSpy.mockClear();
});

// ───────────────────────────── T1 ─────────────────────────────

describe("T1 — statement shape and count (R3 mirror · SG4 no transaction)", () => {
	it("issues-exactly-three-statements-in-positions-payouts-pools-order", async () => {
		const rec = recordingClient(MIXED);

		await getHeaderPortfolio(rec.client, USER_ID);

		// R12's accepted budget is +3 statements — no more, and no N+1 per market.
		expect(rec.calls.select).toBe(3);
		expect(rec.statements.map((s) => s.table)).toEqual([
			getTableName(positions),
			getTableName(payoutEvents),
			getTableName(pools),
		]);
	});

	it("never-opens-a-transaction", async () => {
		// SG4: zero writes, so a BEGIN/COMMIT on every render of every
		// layout-bearing route buys nothing. `header-balance.ts:34–45` states the
		// same rationale for its own two statements.
		const rec = recordingClient(MIXED);

		await getHeaderPortfolio(rec.client, USER_ID);

		expect(rec.transaction).not.toHaveBeenCalled();
	});

	it("mirrors-positions-statement-1-table-columns-and-predicate", async () => {
		const rec = recordingClient(MIXED);

		await getHeaderPortfolio(rec.client, USER_ID);

		const stmt = rec.statements[0];
		expect(stmt?.table).toBe(getTableName(positions));
		// `positions.ts:140–144`, in declaration order — R3 says byte-for-byte in
		// columns, and the key names are also the row shape the module then reads.
		expect(stmt?.fields).toEqual(["marketId", "side", "quantity"]);
		expect(stmt?.columns).toEqual(["market_id", "side", "quantity"]);

		const mirror = renderPredicate(eq(positions.userId, USER_ID));
		expect(stmt?.sql).toBe(mirror.sql);
		expect(stmt?.params).toEqual(mirror.params);
	});

	it("mirrors-positions-statement-2-table-columns-and-predicate", async () => {
		const rec = recordingClient(MIXED);

		await getHeaderPortfolio(rec.client, USER_ID);

		const stmt = rec.statements[1];
		expect(stmt?.table).toBe(getTableName(payoutEvents));
		// `positions.ts:164` — `amount` is SELECTED (mirror parity) even though R5
		// makes row existence, not the amount, the discriminant.
		expect(stmt?.fields).toEqual(["marketId", "amount"]);
		expect(stmt?.columns).toEqual(["market_id", "amount"]);

		const mirror = renderPredicate(
			and(
				eq(payoutEvents.userId, USER_ID),
				inArray(payoutEvents.marketId, ALL_HELD_IDS),
			) as SQL,
		);
		expect(stmt?.sql).toBe(mirror.sql);
		expect(stmt?.params).toEqual(mirror.params);
	});

	it("passes-the-FULL-market-id-list-to-the-pools-statement", async () => {
		// THE NAMED TRAP (plan §6.1). It is tempting to narrow the pools read to
		// the UNSETTLED markets, since the settled pool rows are discarded. Two
		// reasons not to: (i) it is a predicate divergence from the `positions.ts`
		// mirror, so R3's sourcing diff would flag a false positive; (ii) if every
		// held market is settled, the narrowed list is EMPTY and `inArray(x, [])`
		// becomes reachable. The settled pool rows are read and dropped in memory
		// at zero statement cost.
		const rec = recordingClient(MIXED);

		await getHeaderPortfolio(rec.client, USER_ID);

		const stmt = rec.statements[2];
		expect(stmt?.table).toBe(getTableName(pools));
		// `positions.ts:190–194`.
		expect(stmt?.fields).toEqual(["marketId", "yesReserves", "noReserves"]);
		expect(stmt?.columns).toEqual(["market_id", "yes_reserves", "no_reserves"]);

		const mirror = renderPredicate(inArray(pools.marketId, ALL_HELD_IDS));
		expect(stmt?.sql).toBe(mirror.sql);
		expect(stmt?.params).toEqual(mirror.params);

		// Said again, unmissably: the SETTLED market's id is in the pools list.
		expect(stmt?.params).toContain(M_SETTLED);
		expect(stmt?.params).toHaveLength(3);
	});

	it("issues-exactly-one-statement-when-the-viewer-holds-nothing", async () => {
		// The early return between S1 and S2 (`positions.ts:156–158`) is a CONTROL
		// step, not a statement: S2 and S3 must never issue. Payout and pool rows
		// are seeded anyway, so an implementation that skipped the early return
		// would find data and the miss would be a count failure, not a crash.
		const rec = recordingClient({
			[getTableName(positions)]: [],
			[getTableName(payoutEvents)]: MIXED[getTableName(payoutEvents)] ?? [],
			[getTableName(pools)]: MIXED[getTableName(pools)] ?? [],
		});

		await getHeaderPortfolio(rec.client, USER_ID);

		expect(rec.calls.select).toBe(1);
		expect(rec.statements.map((s) => s.table)).toEqual([
			getTableName(positions),
		]);
	});
});

// ───────────────────────────── T2 ─────────────────────────────

describe("T2 — semantics (R1 Đb basis · R5 discriminant · R8 fail-safe · R9 zero≠absence)", () => {
	it("returns-canonical-zero-not-null-when-there-are-no-positions-rows", async () => {
		// R9. `null` is reserved for a READ FAILURE — it hides the whole cluster.
		// A viewer who simply holds nothing has a true, renderable figure: Đ 0.
		const rec = recordingClient({ [getTableName(positions)]: [] });

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(CANONICAL_ZERO);
		expect(CANONICAL_ZERO).toBe("0.000000000000000000");
	});

	it("filters-a-zero-quantity-row-in-memory-and-still-issues-one-statement", async () => {
		// The subtle one. The empty check happens AFTER the in-memory
		// `quantity > 0` filter (`positions.ts:151–158`), not on the raw row count
		// — a fully-exited market keeps its `positions` row at zero. An
		// implementation that tests the RAW row count would issue all three
		// statements here and then hand `shares: "0"` to `computeSell`, whose
		// `requirePositive` throws.
		const rec = recordingClient({
			[getTableName(positions)]: [positionRow(M_OPEN_1, "YES", CANONICAL_ZERO)],
			[getTableName(payoutEvents)]: [],
			[getTableName(pools)]: MIXED[getTableName(pools)] ?? [],
		});

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(CANONICAL_ZERO);
		expect(rec.calls.select).toBe(1);
	});

	it("returns-canonical-zero-when-every-holding-is-settled", async () => {
		// Settled value already lives in the ledger (and therefore in Balance);
		// counting it here would double-count it against the other stat.
		const rec = recordingClient({
			[getTableName(positions)]: [
				positionRow(M_OPEN_1, "YES", "30.000000000000000000"),
				positionRow(M_SETTLED, "NO", "40.000000000000000000"),
			],
			[getTableName(payoutEvents)]: [
				{ marketId: M_OPEN_1, amount: "12.000000000000000000" },
				{ marketId: M_SETTLED, amount: CANONICAL_ZERO },
			],
			[getTableName(pools)]: MIXED[getTableName(pools)] ?? [],
		});

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(CANONICAL_ZERO);
		// All three statements still issue — the emptiness is discovered in
		// memory, after the pools read, not by a narrowed query.
		expect(rec.calls.select).toBe(3);
	});

	it("sums-only-the-unsettled-holdings-through-the-shipped-computeSell", async () => {
		const rec = recordingClient(MIXED);

		const expected = toFixed18(
			db(M_OPEN_1, "YES", "30.000000000000000000").plus(
				db(M_OPEN_2, "NO", "25.000000000000000000"),
			),
		);

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(expected);

		// And the settled market is genuinely excluded, not zero by luck: adding it
		// in would produce a DIFFERENT string.
		const settledInclusive = toFixed18(
			new CpmmDecimal(expected).plus(
				db(M_SETTLED, "NO", "40.000000000000000000"),
			),
		);
		expect(settledInclusive).not.toBe(expected);
		expect(await getHeaderPortfolio(rec.client, USER_ID)).not.toBe(
			settledInclusive,
		);
	});

	it("is-not-a-spot-price-mark-to-market-product", async () => {
		// R1: SPEC.1 §10.8 explicitly REJECTS mark-to-market as a display basis.
		// Đb is impact-inclusive execution value, so Σ(shares × spot price) is the
		// wrong number — strictly larger here, and the gap is the price impact.
		// Without this assertion an implementation could pass every other test in
		// this file with `quantity × getPrices(...)`.
		const rec = recordingClient(MIXED);

		const markToMarket = toFixed18(
			new CpmmDecimal("30.000000000000000000")
				.times(
					getPrices({
						yes: "120.000000000000000000",
						no: "80.000000000000000000",
					}).yes,
				)
				.plus(
					new CpmmDecimal("25.000000000000000000").times(
						getPrices({
							yes: "200.000000000000000000",
							no: "50.000000000000000000",
						}).no,
					),
				),
		);

		const actual = await getHeaderPortfolio(rec.client, USER_ID);
		expect(actual).not.toBe(markToMarket);
		// Guard the guard: the two bases must actually differ for this fixture,
		// or the assertion above proves nothing.
		expect(markToMarket).not.toBe(
			toFixed18(
				db(M_OPEN_1, "YES", "30.000000000000000000").plus(
					db(M_OPEN_2, "NO", "25.000000000000000000"),
				),
			),
		);
	});

	it("treats-a-zero-amount-payout-row-as-settled", async () => {
		// R5's sharp edge, isolated. TWO held markets, identical in every way that
		// matters except that one carries a single ZERO-amount payout leg. If the
		// discriminant were "amount ≠ 0" the zero-leg market would be summed in and
		// the two expectations below would swap.
		const rec = recordingClient({
			[getTableName(positions)]: [
				positionRow(M_OPEN_1, "YES", "30.000000000000000000"),
				positionRow(M_SETTLED, "NO", "40.000000000000000000"),
			],
			[getTableName(payoutEvents)]: [
				{ marketId: M_SETTLED, amount: CANONICAL_ZERO },
			],
			[getTableName(pools)]: MIXED[getTableName(pools)] ?? [],
		});

		const openOnly = toFixed18(db(M_OPEN_1, "YES", "30.000000000000000000"));
		const bothMarkets = toFixed18(
			db(M_OPEN_1, "YES", "30.000000000000000000").plus(
				db(M_SETTLED, "NO", "40.000000000000000000"),
			),
		);

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(openOnly);
		expect(await getHeaderPortfolio(rec.client, USER_ID)).not.toBe(bothMarkets);
	});

	it("fails-closed-on-a-held-market-with-no-pool-row", async () => {
		// FAIL CLOSED, NOT QUIETLY SHORT. An earlier cut SKIPPED the poolless
		// holding — which dropped it from the Σ and returned a perfectly
		// ordinary-looking number. That is a PLAUSIBLE WRONG FIGURE, and DROUND R1
		// ruled that class strictly worse than an obviously-broken one: a viewer
		// cannot tell an understated net worth from a true one, and would act on
		// it. The module therefore throws, the catch converts it to `null`, and
		// the cluster degrades to Balance-only — Portfolio reads as unavailable
		// instead of silently wrong. Failing closed also restores parity with the
		// mirror this read follows, `positions.ts::reservesOf` (`:416–426`).
		//
		// Structurally impossible in production (a held position mints only inside
		// the pool-locked W-1 tx), which is precisely why it needs a test: nothing
		// else in T1/T2/T3 exercises this branch (@code-reviewer MEDIUM-1).
		const rec = recordingClient({
			[getTableName(positions)]: [
				positionRow(M_OPEN_1, "YES", "30.000000000000000000"),
				positionRow(M_OPEN_2, "NO", "25.000000000000000000"),
			],
			[getTableName(payoutEvents)]: [],
			// M_OPEN_2 holds a position with NO pool row.
			[getTableName(pools)]: [
				poolRow(M_OPEN_1, "120.000000000000000000", "80.000000000000000000"),
			],
		});

		const result = await getHeaderPortfolio(rec.client, USER_ID);

		// `null`, never a partial sum. Spelled out against the sound holding's own
		// value so a regression to the skip is caught by name, not by inference.
		expect(result).toBeNull();
		expect(result).not.toBe(
			toFixed18(db(M_OPEN_1, "YES", "30.000000000000000000")),
		);

		// And it REPORTS. The load-bearing half: `null` alone is what an empty
		// portfolio would look like at the Sentry layer, so without this a
		// structurally-impossible state could recur forever unobserved.
		expect(captureSpy).toHaveBeenCalledTimes(1);
		const [err, ctx] = captureSpy.mock.calls[0] as unknown as [
			Error,
			{ tags: { kind: string } },
		];
		expect(err.message).toContain("held position with no pool row");
		expect(ctx.tags.kind).toBe("header_portfolio_read_failed");
	});

	it("returns-null-and-reports-when-the-first-statement-throws", async () => {
		// R8. Without the catch this REJECTS, and in `(public)/layout.tsx` a
		// rejection replaces every participant route with `global-error.tsx` — a
		// same-segment `error.tsx` cannot catch its own layout's throw.
		await expect(
			getHeaderPortfolio(clientFailingOnSelect(1, MIXED), USER_ID),
		).resolves.toBeNull();

		expect(captureSpy).toHaveBeenCalledTimes(1);
		const [err, ctx] = captureSpy.mock.calls[0] as unknown as [
			Error,
			{ tags: { kind: string } },
		];
		expect(err.message).toBe(BOOM);
		expect(ctx.tags.kind).toBe("header_portfolio_read_failed");
	});

	it("also-catches-a-failure-in-a-LATER-statement", async () => {
		// The load-bearing half: a `try` around only the first statement would pass
		// the test above and still take the app down here
		// (`header-balance.integration.test.ts:292–298`).
		await expect(
			getHeaderPortfolio(clientFailingOnSelect(3, MIXED), USER_ID),
		).resolves.toBeNull();

		expect(captureSpy).toHaveBeenCalledTimes(1);
		const [, ctx] = captureSpy.mock.calls[0] as unknown as [
			Error,
			{ tags: { kind: string } },
		];
		expect(ctx.tags.kind).toBe("header_portfolio_read_failed");
	});

	it("does-not-report-on-the-ordinary-no-open-positions-path", async () => {
		// Zero is a legitimate state, not a failure. If the empty path were ever
		// collapsed into the catch, every holding-nothing page load would emit a
		// Sentry event (`header-balance.integration.test.ts:312–323`).
		const rec = recordingClient({ [getTableName(positions)]: [] });

		expect(await getHeaderPortfolio(rec.client, USER_ID)).toBe(CANONICAL_ZERO);
		expect(captureSpy).not.toHaveBeenCalled();
	});
});
