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

type Row = {
	marketId: string;
	marketSlug: string;
	marketTitle: string;
	statusLabel: "Open" | "Closed";
	argument: { removed: boolean; commentId?: string };
};

const row = (n: number, over: Partial<Row> = {}): Row => ({
	marketId: `m${n}`,
	marketSlug: `slug-${n}`,
	marketTitle: `Market ${n}`,
	statusLabel: "Open",
	argument: { removed: false, commentId: `c${n}` },
	...over,
});

describe("R3 SSR seed — the initial status filter is DERIVED", () => {
	it("seed::open-when-any-scoped-row-is-open", () => {
		expect(
			initialStatusFilter([row(1), row(2, { statusLabel: "Closed" })], "all"),
		).toBe("Open");
	});

	it("seed::closed-when-NO-scoped-row-is-open", () => {
		// ⚠ THE CASE GATE C S-1 MINTED: after the freeze every holding is non-Open,
		// and a fixed `Open` default would show four column headers and nothing else,
		// forever.
		expect(
			initialStatusFilter(
				[row(1, { statusLabel: "Closed" }), row(2, { statusLabel: "Closed" })],
				"all",
			),
		).toBe("Closed");
	});

	it("seed::the-status-default-is-SCOPED-to-the-preselected-market", () => {
		// ⛔ THE HALF THAT IS EASY TO GET WRONG. A `?market=` deep link to a market
		// whose only holding is Closed must land on `Closed`, even though ANOTHER
		// market in the set is Open. Scoping to all rows would land on `Open` and
		// show a blank table — the defect S-1 records.
		const rows = [row(1), row(2, { statusLabel: "Closed" })];
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
		const rows = [row(1, { statusLabel: "Closed" }), row(2)];
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
		const rows = [row(1, { argument: { removed: true } })];
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
