// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfilePositionRow } from "@/server/profile/positions";

/**
 * UI.A5 Slice 7 (plan §2 row 7 / §4 "SellMount" / §13 item 2) — the
 * owner-only Sell mount on the positions arena, RED-FIRST: `PositionsTable`
 * still takes the Slice-6 `{ rows, owner }` props and mounts no Sell, so the
 * `payload` renders below MUST fail until the Slice-7 prop change + mount
 * land (CLAUDE.md §5.6).
 *
 * Laws under test (SPEC.1 §23, 1.0.18):
 * - F-PROF-3: Sell affordances mount on the owner's open, held rows ONLY
 *   (`payload.owner` ∧ `row.sellEligible`); a visitor payload never renders
 *   a trigger; a Closed/settled owner row renders its status cell, no Sell.
 * - "Sell on profile": the mounted module is the shipped `SellModule` —
 *   mocked here to a stub (it is HEAVY: wire fetch/quote-reader/router);
 *   mount/unmount is the law under test, not the module internals. The
 *   row expansion is JS-toggled (canon §5 — `:has()` is banned); its
 *   `onClose` collapses the expansion.
 *
 * Fixtures are inline plain objects on the shipped DTOs (type-only imports —
 * no server code executes; NO DB). Neutral `Market <slug>` titles — no
 * invented market content (CLAUDE.md §3). Render asserts key `data-testid`,
 * never final strings (plan §6/OQ-7).
 */

vi.mock("@/components/debate/composer/SellModule", () => ({
	SellModule: (props: { onClose: () => void }) => (
		<div data-testid="sell-module">
			<button
				data-testid="sell-module-close"
				onClick={props.onClose}
				type="button"
			>
				x
			</button>
		</div>
	),
}));

afterEach(cleanup);

/**
 * HTML-FINISH row 7 — THE FILTER DRIVERS MOVED WITH THE CONTROLS, AND ONLY THE
 * DRIVERS. The market `<select>` became a labelled button that opens a popover
 * list, and the status `<select>` became a two-button segmented pair (canon §6:
 * `filters `Select market ▾`, `Open`/`Closed``), so `fireEvent.change` against
 * either is meaningless — jsdom reports "the given element does not have a
 * value setter".
 *
 * ⛔ EVERY ASSERTION IN THIS FILE IS UNCHANGED. These helpers translate HOW the
 * state is driven and HOW the selection is read; they assert nothing themselves,
 * so no test's subject moved with its mechanism. `selectedStatus` reads
 * `aria-pressed` and `selectedMarketCount` reads `role="option"` — the state a
 * `<select>` carried in `.value`/`.options` and a hand-rolled control must
 * declare explicitly.
 */
function setStatusFilter(label: "Open" | "Closed"): void {
	fireEvent.click(
		screen.getByTestId(`positions-status-${label.toLowerCase()}`),
	);
}

/** The chosen market, read off `aria-selected` inside the popover — the
 * `<select>`'s `.value`. Returns `"all"` for the sentinel option. Opens the
 * popover to read, then closes it again so the caller's state is unchanged. */
function selectedMarket(): string | null {
	const trigger = screen.getByTestId("positions-market-filter");
	fireEvent.click(trigger);
	const chosen = screen
		.getByTestId("positions-market-popover")
		.querySelector('[role="option"][aria-selected="true"]');
	const testid = chosen?.getAttribute("data-testid") ?? null;
	fireEvent.click(trigger);
	return testid === null
		? null
		: testid.replace("positions-market-option-", "");
}

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market — sellable
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // Resolved — settled
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

const ROW_OPEN: ProfilePositionRow = {
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: "10.000000000000000000",
	staked: "25.000000000000000000",
	current: "31.000000000000000000",
	argument: {
		removed: false,
		commentId: C_OPENER,
		title: "Opener argument alpha",
		isReply: false,
		postOrdinal: 1,
		marketSlug: "fixture-alpha",
		repliedToTitle: null,
	},
};

const ROW_SETTLED: ProfilePositionRow = {
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	quantity: "4.000000000000000000",
	staked: "8.000000000000000000",
	current: "12.000000000000000000",
	argument: { removed: true, marketSlug: "fixture-beta" },
};

/** The owner arm's rows carry `sellEligible` (`SellablePositionRow`). */
const OPEN_SELLABLE = { ...ROW_OPEN, sellEligible: true };
const SETTLED_UNSELLABLE = { ...ROW_SETTLED, sellEligible: false };

describe("UI.A5 Slice 7 — owner-only Sell mount (SPEC.1 §23 F-PROF-3)", () => {
	it("owner-sell-mount", () => {
		render(
			<PositionsTable
				payload={{ owner: true, rows: [OPEN_SELLABLE, SETTLED_UNSELLABLE] }}
			/>,
		);

		// The sellable Open row carries the trigger; nothing is mounted yet.
		const trigger = screen.getByTestId(`sell-trigger-${M1}`);
		expect(screen.queryByTestId("sell-module")).toBeNull();

		// Click-through mounts the (mocked) SellModule in the row expansion.
		fireEvent.click(trigger);
		expect(screen.getByTestId("sell-module")).toBeTruthy();

		// The settled/Closed row: NO trigger; its status cell shows Closed.
		// ⚠ The status filter's `All` is gone (item 11) and its default is now
		// DERIVED (Gate C S-1). This fixture passes no `initialMarketSlug`, so
		// the derivation scopes to ALL rows, finds an Open one and selects
		// `Open` — the Closed row is off-screen at mount. The filter must be
		// switched to reach it, and the switch must come BEFORE the negative
		// assertion, or "no trigger" would pass on a row that simply is not
		// rendered. ⛔ Unlike `market-preselect-from-searchparam`, this switch is
		// NOT a no-op: the derivation genuinely yields `Open` for this fixture.
		setStatusFilter("Closed");
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();
		expect(screen.queryByTestId(`sell-trigger-${M2}`)).toBeNull();
		expect(
			(screen.getByTestId(`position-status-${M2}`).textContent ?? "").trim(),
		).toContain("Closed");
	});

	it("sell-host-is-canon-s-50px-box-and-is-ABSENT-until-opened", () => {
		// Canon §5 (Profile), as amended at PROFILE OVERLAP R1: "on Sell a 50 px
		// host mounts under the row and the sell module fades into it over .26 s;
		// the host is present ONLY WHILE THE MODULE IS IN IT."
		//
		// ⛔⛔ THIS TEST REPLACES `sell-host-is-fixed-height-and-does-not-reflow`,
		// WHICH ASSERTED THE OPPOSITE LAW — that the box is "reserved whether or
		// not the module is open" and that the row inventory is IDENTICAL either
		// side of the toggle. That law is REVERSED, not relaxed: the reservation
		// spent 51px per sellable row inside a region the three-row window divides
		// by the DATA rows only, so the owner arm overflowed its own panel by
		// 150px at a pinned 1440×777 while every row height measured equal. The
		// old test could not see that, because it asserted an inventory rather
		// than a fit — which is why the new assertions below are about PRESENCE
		// and the guard on FIT lives in `profile-height-chain`.
		// ⚠ WHAT IS GIVEN UP IS ASSERTED, not left implicit: the row inventory now
		// GROWS on open. That is the reflow canon used to forbid, and it is here on
		// purpose.
		render(
			<PositionsTable
				payload={{ owner: true, rows: [OPEN_SELLABLE, SETTLED_UNSELLABLE] }}
			/>,
		);

		// ⛔ NOTHING IS RESERVED. No host, no host row, no module — on a row that
		// IS sellable, which is the case the old law rendered a blank band into.
		expect(screen.queryByTestId(`sell-host-${M1}`)).toBeNull();
		expect(screen.queryByTestId(`sell-row-${M1}`)).toBeNull();
		expect(screen.queryByTestId("sell-module")).toBeNull();
		const rowsBefore = document.querySelectorAll("tbody tr").length;

		fireEvent.click(screen.getByTestId(`sell-trigger-${M1}`));

		// The module arrives, inside canon's 50px box…
		expect(screen.getByTestId("sell-module")).toBeTruthy();
		expect(
			screen.getByTestId(`sell-host-${M1}`).getAttribute("class") ?? "",
		).toContain("h-[50px]");
		// …and the host row takes NO border, which is item 6's predicate, MOVED
		// here from `selection.test.tsx` because this is the only suite that can
		// reach the open state (it stubs the heavy `SellModule`). A bordered host
		// would read as a row of its own, and the module already carries edges.
		expect(screen.getByTestId(`sell-row-${M1}`).className).not.toContain(
			"[border:",
		);
		// …and the table is exactly ONE row longer. The literal statement of what
		// the reversal costs: the rows below move down by that host.
		expect(document.querySelectorAll("tbody tr").length).toBe(rowsBefore + 1);

		// …and closing it takes the host back out, so the band cannot persist.
		fireEvent.click(screen.getByTestId(`sell-trigger-${M1}`));
		expect(screen.queryByTestId(`sell-row-${M1}`)).toBeNull();
		expect(document.querySelectorAll("tbody tr").length).toBe(rowsBefore);

		// ⛔ NO host on a non-sellable row either — the row must be RENDERED for
		// that to mean anything, so the filter is switched first. ⚠ Without this
		// switch the assertion would pass because `M2` is Closed and this
		// fixture's derived default (Gate C S-1) is `Open`, i.e. the row is not
		// on screen at all — a green test proving nothing.
		setStatusFilter("Closed");
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();
		expect(screen.queryByTestId(`sell-host-${M2}`)).toBeNull();
	});

	it("visitor-excludes-sell-render", () => {
		const view = render(
			<PositionsTable
				payload={{ owner: false, rows: [ROW_OPEN, ROW_SETTLED] }}
			/>,
		);

		// NO sell trigger anywhere; NO module (F-PROF-3 at render).
		expect(
			view.container.querySelectorAll('[data-testid^="sell-trigger-"]'),
		).toHaveLength(0);
		expect(screen.queryByTestId("sell-module")).toBeNull();

		// Non-vacuity: the rows render with their status cells — an EMPTY table
		// would satisfy the trigger census above.
		// ⚠ Item 11 removed the status filter's `All`, so the two rows are never
		// on screen together. Each is reached in its own filter state, AND the
		// trigger census is re-run in the Closed state — otherwise that arm
		// would go unchecked, which is the vacuity this case exists to prevent.
		expect(
			(screen.getByTestId(`position-status-${M1}`).textContent ?? "").trim(),
		).toContain("Open");

		setStatusFilter("Closed");
		expect(
			(screen.getByTestId(`position-status-${M2}`).textContent ?? "").trim(),
		).toContain("Closed");
		expect(
			view.container.querySelectorAll('[data-testid^="sell-trigger-"]'),
		).toHaveLength(0);
	});

	it("sell-close-collapses", () => {
		render(<PositionsTable payload={{ owner: true, rows: [OPEN_SELLABLE] }} />);
		fireEvent.click(screen.getByTestId(`sell-trigger-${M1}`));
		expect(screen.getByTestId("sell-module")).toBeTruthy();

		// The module's onClose collapses the row expansion (unmount).
		fireEvent.click(screen.getByTestId("sell-module-close"));
		expect(screen.queryByTestId("sell-module")).toBeNull();
	});

	it("market-preselect-from-searchparam", () => {
		// OQ-5 B: `?market=<slug>` seeds the market filter to the matching row's
		// marketId — the W2.10-C click-through preserves the clicked market.
		render(
			<PositionsTable
				payload={{ owner: false, rows: [ROW_OPEN, ROW_SETTLED] }}
				initialMarketSlug="fixture-beta"
			/>,
		);
		expect(selectedMarket()).toBe(M2);
		// ⚠ B7 added a status switch here because item 11 defaulted the filter
		// to a FIXED `Open` and `fixture-beta` is the Closed market. Gate C S-1
		// made the default DERIVED **and scoped to the initial market** — this
		// preselect IS that market, and it is all-Closed — so the switch became
		// a no-op. REMOVED rather than left: a redundant step under a comment
		// describing a default that no longer exists is the lying-docblock
		// class, and it would mask a regression in the derivation behind a
		// manual override. ⚠ This case's own subject is the MARKET preselect,
		// which `selectedMarket()` above proves and S-1 does not touch.
		// The preselected market's row renders. ⚠ THE MATCHING NEGATIVE IS
		// DELIBERATELY NOT ASSERTED HERE: under `status=Closed`, `M1` (Open) is
		// excluded by the STATUS predicate whatever the market filter does, so
		// `queryByTestId(M1) === null` would pass with the market filter
		// entirely broken. Market isolation keeps its own attributable proof in
		// `surface.test.tsx`'s `positions-filters`, where the status filter is
		// held constant and the market selection is what moves.
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();

		// An UNKNOWN slug falls back to "all" (never rendered raw).
		cleanup();
		render(
			<PositionsTable
				payload={{ owner: false, rows: [ROW_OPEN, ROW_SETTLED] }}
				initialMarketSlug="does-not-exist"
			/>,
		);
		expect(selectedMarket()).toBe("all");
	});
});
