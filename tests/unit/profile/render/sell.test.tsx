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
		expect(screen.queryByTestId(`sell-trigger-${M2}`)).toBeNull();
		expect(
			(screen.getByTestId(`position-status-${M2}`).textContent ?? "").trim(),
		).toContain("Closed");
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

		// Non-vacuity: both rows render with their status cells.
		expect(
			(screen.getByTestId(`position-status-${M1}`).textContent ?? "").trim(),
		).toContain("Open");
		expect(
			(screen.getByTestId(`position-status-${M2}`).textContent ?? "").trim(),
		).toContain("Closed");
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
		const filter = screen.getByTestId<HTMLSelectElement>(
			"positions-market-filter",
		);
		expect(filter.value).toBe(M2);
		// Only the preselected market's row is visible.
		expect(screen.queryByTestId(`position-row-${M1}`)).toBeNull();
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();

		// An UNKNOWN slug falls back to "all" (never rendered raw).
		cleanup();
		render(
			<PositionsTable
				payload={{ owner: false, rows: [ROW_OPEN, ROW_SETTLED] }}
				initialMarketSlug="does-not-exist"
			/>,
		);
		expect(
			screen.getByTestId<HTMLSelectElement>("positions-market-filter").value,
		).toBe("all");
	});
});
