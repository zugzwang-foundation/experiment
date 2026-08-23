// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type {
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";

/**
 * POSREV-1 RF-8 + RF-10 — **THE KEYBOARD AND THE THREE-TILE WINDOW.**
 *
 * RF-8 asks for two things that pull against each other, which is why they are
 * tested together: the first tile is SELECTED on load, so the right-hand panel
 * is populated and the arrows have somewhere to start — and nothing takes FOCUS
 * on load, because a page that moves the caret out from under a screen reader on
 * arrival is disorienting even when the destination is correct.
 *
 * RF-10 sizes the scroll container at exactly three ARGUMENT tiles, with the
 * market group headers sticky and NOT consuming a slot.
 *
 * ⚠ jsdom performs no layout, so nothing here can see a height. What it CAN see
 * is the SHAPE of the mechanism — which node is tabbable, where focus is, that
 * headers are excluded from the tile count — and those are the parts that break
 * silently.
 */

afterEach(cleanup);

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const M2 = "0190c0de-aaaa-7000-8000-000000000002";
const L = (n: number) => `0190c0de-2222-7000-8000-00000000000${n}`;

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

function lot(n: number): ProfilePositionLot {
	return {
		lotId: L(n),
		betId: `bet-${n}`,
		side: "YES",
		originalBasis: dp18("25"),
		survivingBasis: dp18("25"),
		survivingShares: dp18("10"),
		sold: false,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument: {
			removed: false,
			commentId: `0190c0de-1111-7000-8000-00000000000${n}`,
			title: `Argument number ${n}`,
			isReply: false,
			postOrdinal: n,
			marketSlug: "fixture-alpha",
			repliedToTitle: null,
		},
	};
}

function row(marketId: string, lots: ProfilePositionLot[]): ProfilePositionRow {
	return {
		marketId,
		marketSlug: `slug-${marketId.slice(-1)}`,
		marketTitle: `Market ${marketId.slice(-1)}`,
		marketStatus: "Open",
		statusLabel: "Open",
		settled: false,
		side: "YES",
		quantity: dp18(String(10 * lots.length)),
		staked: dp18(String(25 * lots.length)),
		current: dp18(String(31 * lots.length)),
		argument: lots[0]?.argument ?? { removed: true, marketSlug: "x" },
		lots,
	};
}

/** Two markets, four arguments — more than the three-tile window, and split
 *  across two group headers so the header/tile distinction is exercised. */
const PAYLOAD: ProfilePositionsPayload = {
	owner: false,
	rows: [row(M1, [lot(1), lot(2)]), row(M2, [lot(3), lot(4)])],
};

const tile = (n: number) => screen.getByTestId(`position-tile-${L(n)}`);

describe("RF-8 — the first tile is selected, and NOTHING is focused", () => {
	it("kb::the-first-tile-is-selected-on-load", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		expect(tile(1).getAttribute("aria-current")).toBe("true");
		for (const n of [2, 3, 4]) {
			expect(tile(n).getAttribute("aria-current")).toBeNull();
		}
	});

	it("kb::NOTHING-IS-FOCUSED-on-load", () => {
		// ⛔⛔ THE HALF THAT IS EASY TO GET WRONG BY BEING HELPFUL. "Select the
		// first tile so the arrows work" invites a `.focus()` on mount, and that
		// moves the caret out from under a screen-reader user the moment the page
		// arrives — announcing a table row nobody asked for. Selection is a
		// rendering fact; focus is the reader's.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(document.activeElement).toBe(document.body);
	});

	it("kb::ROVING-TABINDEX-exactly-one-tile-is-in-the-tab-order", () => {
		// One tab stop for the whole region, on the selected tile. Four separate
		// stops would make Tab walk the list instead of leaving it.
		render(<PositionsTable payload={PAYLOAD} />);
		const tabbable = [
			...document.querySelectorAll('[data-testid^="position-tile-"]'),
		].filter((el) => el.getAttribute("tabindex") === "0");
		expect(tabbable.length).toBe(1);
		expect(tabbable[0]).toBe(tile(1));
	});

	it("kb::the-roving-stop-FOLLOWS-the-selection", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(tile(3));
		expect(tile(3).getAttribute("tabindex")).toBe("0");
		expect(tile(1).getAttribute("tabindex")).toBe("-1");
	});

	it("kb::arrows-step-ACROSS-group-boundaries", () => {
		// ⚠ THE GROUPS ARE A RENDERING DEVICE, NOT A NAVIGATION ONE. Stepping is
		// over the visible TILES in order; a reader pressing Down at the last
		// argument of one market arrives at the first of the next, not at a wall.
		render(<PositionsTable payload={PAYLOAD} />);
		const table = screen.getByTestId("positions-table");
		fireEvent.keyDown(table, { key: "ArrowDown" });
		expect(tile(2).getAttribute("aria-current")).toBe("true");
		fireEvent.keyDown(table, { key: "ArrowDown" });
		expect(tile(3).getAttribute("aria-current")).toBe("true");
	});

	it("kb::arrows-WRAP-at-the-end", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const table = screen.getByTestId("positions-table");
		fireEvent.keyDown(table, { key: "ArrowUp" });
		expect(tile(4).getAttribute("aria-current")).toBe("true");
	});
});

describe("RF-10 — the window counts TILES; group headers are chrome", () => {
	it("win::group-headers-carry-a-different-testid-prefix-from-tiles", () => {
		// ⛔ THIS IS WHAT KEEPS THE HEADERS OUT OF THE COUNT, and it is asserted
		// rather than assumed because both the window's row selector and the
		// equal-thirds hook key on the prefix. A header that answered to
		// `position-tile-` would silently consume one of the three slots.
		render(<PositionsTable payload={PAYLOAD} />);
		const tiles = document.querySelectorAll('[data-testid^="position-tile-"]');
		const headers = document.querySelectorAll(
			'[data-testid^="positions-group-"]',
		);
		expect(tiles.length).toBe(4);
		// Two group rows, each with a title node and a figures node inside it.
		expect([...headers].filter((el) => el.tagName === "TR").length).toBe(2);
		for (const h of headers) {
			expect(h.getAttribute("data-testid")).not.toMatch(/^position-tile-/);
		}
	});

	it("win::the-header-row-is-STICKY-and-offset-below-the-column-header", () => {
		// The column-header row is `sticky top-0`; a group header has to stick
		// BELOW it or the two overlap on scroll. The offset is a CSS variable the
		// measuring effect writes, never a literal — a typed `top-[19px]` would go
		// stale from the very edit that changed the overline's type size.
		render(<PositionsTable payload={PAYLOAD} />);
		const header = screen.getByTestId(`positions-group-${M1}`);
		expect(header.className.split(/\s+/)).toContain("sticky");
		expect(header.getAttribute("style") ?? "").toContain("--zz-thead-h");
	});

	it("win::NO-scroll-snap-anywhere-in-the-scroll-container", () => {
		// ⚠ RF-10 rules it out for two reasons, and the second is the one a
		// stylesheet cannot see: snap fights the ARROW KEYS about what "next"
		// means. The stepper moves the selection and scrolls it to `block:
		// "nearest"`; snap would then override that with its own resting position.
		render(<PositionsTable payload={PAYLOAD} />);
		const body = screen.getByTestId("positions-panel-body");
		expect(body.className).not.toContain("snap");
		expect(screen.getByTestId("positions-table").className).not.toContain(
			"snap",
		);
	});
});
