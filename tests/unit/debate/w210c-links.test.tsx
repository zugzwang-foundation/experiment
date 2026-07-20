// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { PositionStrip } from "@/components/debate/composer/PositionStrip";
import { SlotHeader } from "@/components/debate/composer/SlotHeader";
import type { ViewerMarketContext } from "@/components/debate/types";

/**
 * UI.A5 Slice 7 (plan §2 row 7 / §13 item 14 / §16 OQ-5 B) — the W2.10-C
 * click-through activation, RED-FIRST: `SlotHeader` / `PositionStrip` still
 * render the A3-era NON-INTERACTIVE affordance ("NON-INTERACTIVE until A5,
 * F-4") and take no `ownPseudonym`/`slug` props, so the `w210c-sell-link`
 * asserts below MUST fail until the Slice-7 surgical link-wrapping lands
 * (CLAUDE.md §5.6).
 *
 * Law under test (SPEC.1 §23 "Sell on profile", 1.0.18): "The debate-view
 * position-strip and slot-header click-throughs (W2.10-C) activate into
 * this surface at the A5 build." Target shape per OQ-5 B (ratified):
 * `/u/<ownPseudonym>?market=<slug>` — the positions market-filter preselect.
 * Signed-out (`ownPseudonym === null`): the affordance stays non-interactive
 * — NO link.
 *
 * Minimal props built inline (the composer `_harness` fixture posture —
 * `tests/unit/composer/render/_harness.tsx`; the held viewer is constructed
 * here because the harness VIEWER holds no position). The held-side branch
 * requires `viewer.position.side === side` (SlotHeader/PositionStrip law).
 */

afterEach(cleanup);

/** Held viewer on the rendered side (YES) — the "Your position" branch. */
const HELD_VIEWER: ViewerMarketContext = {
	position: {
		side: "YES",
		quantity: "10.000000000000000000",
		currentValue: "31.000000000000000000",
	},
	balance: "100",
	spendableToday: "100",
};

/** The full SlotHeader prop set (minimal values; entry live, un-suspended). */
function slotHeaderProps(ownPseudonym: string | null) {
	return {
		side: "YES" as const,
		pricing: null,
		unitToWin: null,
		viewer: HELD_VIEWER,
		marketOpen: true,
		suspended: false,
		composerOpen: false,
		onToggleEntry: vi.fn(),
		ownPseudonym,
		slug: "m-alpha",
	};
}

describe("UI.A5 Slice 7 — W2.10-C click-through activation (OQ-5 B)", () => {
	it("slot-header-sell-links-to-own-profile", () => {
		render(<SlotHeader {...slotHeaderProps("RedFox001")} />);
		const link = screen.getByTestId("w210c-sell-link");
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe("/u/RedFox001?market=m-alpha");
	});

	it("position-strip-links-to-own-profile", () => {
		render(
			<PositionStrip
				side="YES"
				pricing={null}
				unitToWin={null}
				viewer={HELD_VIEWER}
				ownPseudonym="RedFox001"
				slug="m-alpha"
			/>,
		);
		const link = screen.getByTestId("w210c-sell-link");
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe("/u/RedFox001?market=m-alpha");
	});

	it("signed-out-no-link", () => {
		// SlotHeader: NO link; the Sell affordance stays non-interactive.
		const header = render(<SlotHeader {...slotHeaderProps(null)} />);
		expect(screen.queryByTestId("w210c-sell-link")).toBeNull();
		expect(header.container.querySelector('a[href^="/u/"]')).toBeNull();
		// Non-vacuity: the held-side Sell affordance rendered.
		expect(header.container.textContent ?? "").toContain(COMPOSER_COPY.sell);
		header.unmount();

		// PositionStrip: NO link; the held readout stays non-interactive.
		const strip = render(
			<PositionStrip
				side="YES"
				pricing={null}
				unitToWin={null}
				viewer={HELD_VIEWER}
				ownPseudonym={null}
				slug="m-alpha"
			/>,
		);
		expect(screen.queryByTestId("w210c-sell-link")).toBeNull();
		expect(strip.container.querySelector('a[href^="/u/"]')).toBeNull();
		// Non-vacuity: the held-position readout rendered.
		expect(strip.container.textContent ?? "").toContain("Your position");
	});
});
