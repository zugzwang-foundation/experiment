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
 * HTML-FINISH · MARKET DETAIL row 7 — `detail` IS ONE ROW.
 *
 * d5's `.barrow` is LABEL — BAR — LABEL on a single flex row (`:505`, labels
 * flanking the bar). The build shipped `detail` as two rows — bar above, labels
 * below — and `PriceBar.tsx` recorded that divergence as *"recorded and NOT
 * actioned (D-J)"*, naming the mechanism adoption would take: move `detail`
 * into the `ROW` map and delete the early return. Row 7 does exactly that, so
 * `detail` now shares ONE render with `hero` and `card`.
 *
 * ⚠ THE ASSERTION IS ON STRUCTURE, NOT ON A CLASS STRING. "One row" is a claim
 * about SIBLINGS — the two labels and the bar are children of the same node —
 * and a `flex-row` class assertion would pass on a render that still stacked a
 * label row underneath. O-7: `innerHTML`, never `textContent`.
 */
describe("HTML-FINISH · MARKET DETAIL — row 7, detail collapses to one row", () => {
	it("the labels FLANK the bar as siblings, not a row beneath it", () => {
		const { container } = render(<PriceBar pricing={TIE} size="detail" />);

		const row = container.firstElementChild;
		const children = Array.from(row?.children ?? []);

		// Exactly three children, in d5's order: label · bar · label.
		expect(children).toHaveLength(3);
		expect(children[0]?.tagName).toBe("SPAN");
		expect(children[0]?.innerHTML).toContain("YES 53%");
		expect(children[1]?.getAttribute("role")).toBe("img");
		expect(children[2]?.tagName).toBe("SPAN");
		expect(children[2]?.innerHTML).toContain("NO 47%");

		// The superseded two-row form, pinned as gone: a wrapper whose bar was a
		// CHILD rather than a sibling of the labels.
		expect(children[1]?.innerHTML).not.toContain("YES 53%");
	});

	it("detail shares the ONE render with hero and card", () => {
		// `data-size` was emitted only by the shared render, so its presence on
		// `detail` is the structural proof that the early return is gone — not a
		// restatement of the assertion above.
		const { container } = render(<PriceBar pricing={TIE} size="detail" />);
		expect(container.firstElementChild?.getAttribute("data-size")).toBe(
			"detail",
		);

		// Positive control: the two presets that were ALREADY on that render are
		// unmoved, so "detail joined them" is not "they joined detail".
		cleanup();
		const hero = render(<PriceBar pricing={TIE} size="hero" />);
		expect(hero.container.firstElementChild?.getAttribute("data-size")).toBe(
			"hero",
		);
	});
});
