import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	initialMarketIdOf,
	initialProfileSelection,
	initialStatusFilter,
} from "@/components/profile/selection";

/**
 * PROFILE REFINEMENT · R3, THE SSR HALF — the initial selection, guarded.
 *
 * ⚠⚠ WHY THIS FILE EXISTS AND WHY THE RENDER SUITE IS NOT ENOUGH. R3's
 * first-visible-row fallback lives in `PositionsTable`'s render and is reported
 * upward by an EFFECT. jsdom RUNS effects, so `panel-filter.test.tsx` went green
 * on the fallback alone and could not see that the SERVER paint had no selection
 * at all — the served HTML carried `argument-list` and the header word
 * `Arguments`, and the replica appeared only after hydration. A rail of stubs on
 * load is exactly the defect R3 removes, and one frame of it is still it.
 *
 * ⇒ SO THE THING UNDER TEST IS THE SEED, not the fallback: the PURE derivation the
 * arenas initialise their state from, plus a source pin that they actually do.
 * A render test structurally cannot distinguish "seeded correctly" from "an effect
 * fixed it a tick later"; these two checks can.
 *
 * ⚠ AND THE DERIVATION IS THE PART THAT CAN GO SUBTLY WRONG. "The first visible
 * row" is not "the first row": it depends on the `?market=<slug>` preselect and on
 * the status default, which is itself derived (Gate C S-1 — scoped to the initial
 * market, `Open` if any scoped row is open else `Closed`, because a fixed `Open` is
 * permanently empty after the freeze). Those are the cases below.
 */

/**
 * ⚠⚠ POSREV-1 RF-13 — **THE FIXTURE'S SHAPE CHANGED BECAUSE THE QUESTION DID.**
 * These rows used to carry a `statusLabel`, because the Open/Closed toggle
 * filtered MARKET STATE. It now filters HOLDING state: an argument with
 * surviving shares is Open, one with none is Closed. So a row is no longer
 * open or closed — its individual ARGUMENTS are, and a market with some of each
 * appears in BOTH tabs. The fixture carries lots for exactly that reason.
 */
type Lot = {
	lotId: string;
	survivingShares: string;
	argument: { removed: boolean; commentId?: string };
};
type Row = {
	marketId: string;
	marketSlug: string;
	marketTitle: string;
	/** The whole-holding fallback's two inputs — see `usesWholeHoldingFallback`. */
	quantity: string;
	argument: { removed: boolean; commentId?: string };
	lots: Lot[];
};

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

/** An argument with shares still in it (Open tab) or none left (Closed tab). */
const lot = (n: number, held: boolean, removed = false): Lot => ({
	lotId: `l${n}`,
	survivingShares: held ? dp18("40") : dp18("0"),
	argument: removed
		? { removed: true }
		: { removed: false, commentId: `c${n}` },
});

const row = (n: number, over: Partial<Row> = {}): Row => ({
	marketId: `m${n}`,
	marketSlug: `slug-${n}`,
	marketTitle: `Market ${n}`,
	quantity: dp18("40"),
	argument: { removed: false, commentId: `c${n}-opener` },
	lots: [lot(n, true)],
	...over,
});

/** The same row with its single argument fully exited. */
const closedRow = (n: number): Row =>
	row(n, { quantity: dp18("0"), lots: [lot(n, false)] });

describe("R3 SSR seed — the initial status filter is DERIVED", () => {
	it("seed::open-when-any-scoped-row-is-open", () => {
		expect(initialStatusFilter([row(1), closedRow(2)], "all")).toBe("Open");
	});

	it("seed::closed-when-NO-scoped-row-is-open", () => {
		// ⚠ THE CASE GATE C S-1 MINTED: after the freeze every holding is non-Open,
		// and a fixed `Open` default would show four column headers and nothing else,
		// forever.
		expect(initialStatusFilter([closedRow(1), closedRow(2)], "all")).toBe(
			"Closed",
		);
	});

	it("seed::the-status-default-is-SCOPED-to-the-preselected-market", () => {
		// ⛔ THE HALF THAT IS EASY TO GET WRONG. A `?market=` deep link to a market
		// whose only holding is Closed must land on `Closed`, even though ANOTHER
		// market in the set is Open. Scoping to all rows would land on `Open` and
		// show a blank table — the defect S-1 records.
		const rows = [row(1), closedRow(2)];
		expect(initialStatusFilter(rows, "m2")).toBe("Closed");
		expect(initialStatusFilter(rows, "all")).toBe("Open");
	});
});

describe("R3 SSR seed — the initial market id", () => {
	it("seed::a-matching-slug-preselects-its-market", () => {
		expect(initialMarketIdOf([row(1), row(2)], "slug-2")).toBe("m2");
	});

	it("seed::an-unknown-or-absent-slug-falls-back-to-all", () => {
		// The route law: an unknown `?market=` is never rendered raw and never
		// narrows to nothing.
		expect(initialMarketIdOf([row(1)], "no-such-slug")).toBe("all");
		expect(initialMarketIdOf([row(1)], undefined)).toBe("all");
	});
});

describe("R3 SSR seed — the profile selection", () => {
	it("seed::picks-the-first-VISIBLE-row-not-the-first-row", () => {
		// Row 1 is Closed and row 2 is Open, so the derived status is `Open` and the
		// first VISIBLE row is row 2 — not row 1.
		const rows = [closedRow(1), row(2)];
		expect(initialProfileSelection(rows, undefined)).toEqual({
			marketId: "m2",
			marketTitle: "Market 2",
			commentId: "c2",
		});
	});

	it("seed::honours-the-market-preselect", () => {
		const rows = [row(1), row(2)];
		expect(initialProfileSelection(rows, "slug-2")?.marketId).toBe("m2");
	});

	it("seed::a-removed-opener-yields-a-NULL-commentId-not-a-guess", () => {
		// The removed cell variant carries `{removed: true, marketSlug}` and no id.
		// The panel renders its removed stub for that case; inventing an id would
		// point it at someone else's argument.
		const rows = [row(1, { lots: [lot(1, true, true)] })];
		expect(initialProfileSelection(rows, undefined)).toEqual({
			marketId: "m1",
			marketTitle: "Market 1",
			commentId: null,
		});
	});

	it("seed::an-EMPTY-row-set-selects-nothing", () => {
		// ⚠ R3's own warning: select nothing and let the empty state render. No
		// phantom row, no crash.
		expect(initialProfileSelection([], undefined)).toBeNull();
	});
});

describe("POSREV-1 RF-13 — Open/Closed is HOLDING status, per argument", () => {
	it("rf13::a-SPLIT-market-is-open-AND-closed-at-once", () => {
		// ⚠⚠ THE CASE THE OLD MODEL COULD NOT EXPRESS. Under market-status filtering
		// a row was in exactly one tab; under holding status a market with one
		// argument still held and one fully exited belongs in BOTH — its header in
		// each, showing only that tab's arguments. So the derived tab is `Open` (an
		// argument survives) and the seeded selection is the OPEN one, not merely
		// the first lot in the array.
		const split: Row = {
			marketId: "m9",
			marketSlug: "slug-9",
			marketTitle: "Market 9",
			quantity: dp18("40"),
			argument: { removed: false, commentId: "c9-opener" },
			// ⛔ THE EXITED ONE IS FIRST, deliberately. If the derivation returned
			// `lots[0]` it would pass a test whose fixture happened to list the held
			// argument first, and this ordering is what distinguishes "picked the
			// first VISIBLE argument" from "picked the first argument".
			lots: [lot(91, false), lot(92, true)],
		};
		expect(initialStatusFilter([split], "all")).toBe("Open");
		expect(initialProfileSelection([split], undefined)).toEqual({
			marketId: "m9",
			marketTitle: "Market 9",
			commentId: "c92",
		});
	});

	it("rf13::a-DUST-argument-is-still-OPEN-zero-basis-is-not-zero-shares", () => {
		// ⛔⛔ THE PREDICATE IS `surviving_shares = 0`, EXACTLY — NEVER ZERO BASIS.
		// `lots_sold_zeroes_basis` (db/schema/lots.ts) is deliberately
		// ONE-DIRECTIONAL: shares imply basis, the converse is NOT enforced, because
		// an 18-dp quantization of a pro-rata reduction can in principle round a
		// basis to zero while dust shares remain. Retiring such an argument to the
		// Closed tab would take a still-sellable holding away from the only tab that
		// has a Sell control in it.
		// ⚠ THIS IS THE POSITIVE CONTROL for the row below: same zero basis, and the
		// two land in DIFFERENT tabs, so the predicate is provably reading shares.
		const dust: Row = {
			marketId: "m10",
			marketSlug: "slug-10",
			marketTitle: "Market 10",
			quantity: "0.000000000000000001",
			argument: { removed: false, commentId: "c10-opener" },
			lots: [
				{
					lotId: "l-dust",
					survivingShares: "0.000000000000000001",
					argument: { removed: false, commentId: "c-dust" },
				},
			],
		};
		expect(initialStatusFilter([dust], "all")).toBe("Open");
		expect(initialProfileSelection([dust], undefined)?.commentId).toBe(
			"c-dust",
		);
	});

	it("rf13::the-CONTROL-a-truly-sold-argument-IS-closed", () => {
		// The other arm. Exactly zero shares — the only spelling `sellFromLot` ever
		// writes on a full sale, since it sets the canonical zero rather than
		// dividing down to it.
		const soldOut: Row = {
			marketId: "m11",
			marketSlug: "slug-11",
			marketTitle: "Market 11",
			quantity: dp18("0"),
			argument: { removed: false, commentId: "c11-opener" },
			lots: [
				{
					lotId: "l-sold",
					survivingShares: "0.000000000000000000",
					argument: { removed: false, commentId: "c-sold" },
				},
			],
		};
		expect(initialStatusFilter([soldOut], "all")).toBe("Closed");
	});
});

// UNWIRE-1 — "R3 SSR seed — the bookmark selection" removed whole:
// initialBookmarkSelection and its module (components/bookmarks/selection.ts)
// are deleted along with the rest of the bookmark module.

describe("R3 SSR seed — the arenas actually USE the seed", () => {
	const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

	/**
	 * ⚠ A SOURCE SCAN, AND THE LIMIT IS STATED. What must be true is that the
	 * arena's state is SEEDED rather than starting at `null` — and that is a
	 * property of the first render on the SERVER, which jsdom cannot produce
	 * (it runs effects, so a `null` seed self-heals a tick later and every render
	 * assertion passes either way). The declarations are checked here; the pure
	 * derivation they call is checked above; the composed result was verified by
	 * reading the served markup on staging.
	 */
	it("seed::ProfileArena-seeds-from-the-shared-derivation", () => {
		const src = read("src/components/profile/ProfileArena.tsx");
		expect(src).toContain("initialProfileSelection(");
		// ⛔ NEVER BACK TO A BARE NULL SEED — the exact regression this guards.
		expect(src).not.toContain("useState<ProfileSelection | null>(null)");
	});

	// UNWIRE-1 — "seed::BookmarksArena-seeds-from-the-shared-derivation"
	// removed whole: BookmarksArena.tsx is deleted along with the /bookmarks
	// route.

	it("seed::PositionsTable-initialises-its-FILTERS-from-the-same-helpers", () => {
		// ⛔ THE ANTI-DRIFT CHECK, and the reason the helpers were extracted at all.
		// If the table computed its own market/status defaults while the arena seeded
		// from `selection.ts`, the two could disagree — the table highlighting one row
		// while the panel showed another. Same definitions, one source.
		const src = read("src/components/profile/PositionsTable.tsx");
		expect(src).toContain("initialMarketIdOf(");
		expect(src).toContain("initialStatusFilter(");
	});
});
