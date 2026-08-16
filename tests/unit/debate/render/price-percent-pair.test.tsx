// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PositionStrip } from "@/components/debate/composer/PositionStrip";
import { SlotHeader } from "@/components/debate/composer/SlotHeader";
import { DebateColumn } from "@/components/debate/DebateColumn";
import { PriceBar } from "@/components/debate/PriceBar";

/**
 * PCT.ROUND (SPEC.1 §10.8) — the complement rule AT THE RENDER, on the paired
 * surfaces where the defect was actually visible.
 *
 * `DebateView` renders `(["YES","NO"] as const).map(...)`, so `DebateColumn`,
 * `SlotHeader` and `PositionStrip` each MOUNT TWICE, side by side. Before this
 * fix, an exact `.525 / .475` tie put `53%` in one mount and `48%` in the other
 * — 101% on screen, in the column headlines, again in the slot headers, again
 * in the position strips, and again in the price bar.
 *
 * The `PriceBar` `aria-label` is the sharpest case: a screen reader announces
 * the pair as ONE utterance ("YES 53%, NO 48%"), which is where the arithmetic
 * read worst.
 */

afterEach(cleanup);

// The exact tie. Every fixture elsewhere in the tree is a 2-dp probability with
// no tie, which is precisely why no existing test caught this.
const TIE = { yes: "0.525000000000000000", no: "0.475000000000000000" };

const SIDES = ["YES", "NO"] as const;

describe("PriceBar — the paired price readout", () => {
	it("announces the pair as one utterance summing to 100", () => {
		render(<PriceBar pricing={TIE} size="detail" />);
		const bar = screen.getByRole("img");
		expect(bar.getAttribute("aria-label")).toBe("YES 53%, NO 47%");
	});

	it("renders the same pair in the visible labels", () => {
		const { container } = render(<PriceBar pricing={TIE} size="detail" />);
		const text = container.textContent ?? "";
		expect(text).toContain("YES 53%");
		expect(text).toContain("NO 47%");
		// The pre-fix render. If this ever comes back, the pair sums to 101.
		expect(text).not.toContain("48%");
	});

	it("gives the YES segment the rounded percent as its CSS width (geometry unchanged)", () => {
		const { container } = render(<PriceBar pricing={TIE} size="detail" />);
		const yesSegment = container.querySelector<HTMLElement>(".bg-yes");
		// Unchanged by PCT.ROUND, and now AGREEING with the labels above it: the
		// bar was already 53/47 while the labels read 53/48.
		expect(yesSegment?.style.width).toBe("53%");
	});
});

describe("the paired mounts — both sides rendered side by side", () => {
	it("DebateColumn: the two column headlines sum to 100", () => {
		const { container } = render(
			<>
				{SIDES.map((side) => (
					<DebateColumn key={side} side={side} pricing={TIE}>
						<div />
					</DebateColumn>
				))}
			</>,
		);
		const text = container.textContent ?? "";
		expect(text).toContain("53%");
		expect(text).toContain("47%");
		expect(text).not.toContain("48%");
	});

	it("SlotHeader: the two slot headers sum to 100", () => {
		const { container } = render(
			<>
				{SIDES.map((side) => (
					<SlotHeader
						key={side}
						side={side}
						pricing={TIE}
						unitToWin={null}
						viewer={null}
						marketOpen={true}
						suspended={false}
						composerOpen={false}
						onToggleEntry={() => {}}
						ownPseudonym={null}
						slug="m-test"
					/>
				))}
			</>,
		);
		const text = container.textContent ?? "";
		expect(text).toContain("53%");
		expect(text).toContain("47%");
		expect(text).not.toContain("48%");
	});

	it("PositionStrip: the two position strips sum to 100", () => {
		const { container } = render(
			<>
				{SIDES.map((side) => (
					<PositionStrip
						key={side}
						side={side}
						pricing={TIE}
						unitToWin={null}
						viewer={null}
						ownPseudonym={null}
						slug="m-test"
					/>
				))}
			</>,
		);
		const text = container.textContent ?? "";
		expect(text).toContain("53%");
		expect(text).toContain("47%");
		expect(text).not.toContain("48%");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL rows 20 + 21 — the slot header's two affordances.
 *
 * Row 20: the entry reads `Buy`, the MOCKUP'S OWN string (`d5:1052`, `:1221`),
 * reversing the bucket-D strike that kept `Đ BET`.
 * Row 21: `Sell ↗` takes BUTTON SHAPE while KEEPING navigation. ⛔ A button that
 * did not navigate would be a regression, not a port — d5 itself navigates
 * (`:1909-1911` → `nav('profile')`), and H3-d makes losing the navigation a halt
 * rather than an acceptable simplification.
 */
describe("HTML-FINISH · MARKET DETAIL — rows 20 + 21, the slot header", () => {
	const VIEWER_HOLDING = {
		position: {
			side: "YES" as const,
			quantity: "10.000000000000000000",
			currentValue: "12.000000000000000000",
		},
		balance: "100.000000000000000000",
		spendableToday: "100.000000000000000000",
		bookmarkedCommentIds: [],
		ownCommentIds: [],
	};

	it("row-20::the-entry-reads-Buy-and-its-aria-label-agrees", () => {
		render(
			<SlotHeader
				side="YES"
				pricing={TIE}
				unitToWin={null}
				viewer={null}
				marketOpen={true}
				suspended={false}
				composerOpen={false}
				onToggleEntry={() => {}}
				ownPseudonym={null}
				slug="m-test"
			/>,
		);

		const entry = screen.getByRole("button", { name: "Buy YES" });
		// The VISIBLE label and the accessible name still agree — WCAG 2.5.3
		// (Label in Name) survives the relabel because both moved together.
		expect(entry.innerHTML).toContain("Buy");
		// The superseded brand string, pinned as gone from this control.
		expect(entry.innerHTML).not.toContain("Đ BET");
	});

	it("row-21::Sell-takes-button-shape-and-STILL-NAVIGATES", () => {
		const { container } = render(
			<SlotHeader
				side="YES"
				pricing={TIE}
				unitToWin={null}
				viewer={VIEWER_HOLDING}
				marketOpen={true}
				suspended={false}
				composerOpen={false}
				onToggleEntry={() => {}}
				ownPseudonym="own-pseudonym"
				slug="m-test"
			/>,
		);

		const sell = container.querySelector<HTMLAnchorElement>(
			'[data-testid="w210c-sell-link"]',
		);
		expect(sell).not.toBeNull();
		// ⛔ STILL AN ANCHOR WITH ITS HREF. This is the H3-d assertion: button
		// SHAPE, never button semantics — the W2.10-C click-through to the
		// viewer's own profile with this market preselected is the whole point of
		// the control, and a `<button>` would have silently dropped it.
		expect(sell?.tagName).toBe("A");
		expect(sell?.getAttribute("href")).toBe("/u/own-pseudonym?market=m-test");
		// …and it now carries the button geometry rather than bare text styling.
		const className = sell?.getAttribute("class") ?? "";
		expect(className).toContain("inline-flex");
		expect(className).toContain("rounded");
	});
});
