// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketTotalDharma } from "@/components/debate/DharmaFigure";
import { contentHashId } from "@/components/ui/info-tip";

/**
 * UI-FOLLOWUP A — the market stat line's staked TOTAL, rendered once and shared
 * by the three surfaces that carry that line: `discovery/StatLine` (the grid
 * tile AND the carousel/hero panel, one component), `debate/FocusMarketCard`
 * (the post arm's rail) and — through the merged-gloss variant — the market
 * page's own header.
 *
 * ⚠⚠ THE ELEMENT-OR-NOT BEHAVIOUR IS THE SUBJECT HERE, not the number. The
 * number is `formatDharmaCompact`'s and is pinned in `format.test.ts` against
 * the brief's five values; what only a RENDER can see is that below the
 * threshold this component emits a bare text node and above it emits a tooltip
 * host. That difference is load-bearing twice over: it keeps `Đ 150 staked` one
 * contiguous text run for the DOM-walk anchors in `market-header.test.tsx` and
 * `focus-market-card.test.tsx`, and it is what stops an exact-value tooltip
 * appearing on a figure that already renders exactly.
 *
 * ⚠ `aria-describedby`, not a hover: `InfoTip` picks its branch on
 * `(hover: hover) and (pointer: fine)`, and jsdom implements no `matchMedia` at
 * all — so the TOUCH branch runs here, and that is the branch which stamps the
 * describedby. Asserting the id against `contentHashId` is the established
 * idiom (`aggregate-footer.test.tsx`), and it pins the tooltip's CONTENT, which
 * a bare "an attribute exists" assertion would not.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

describe("MarketTotalDharma — abbreviate, and reveal only what is hidden", () => {
	it("market-total::below-the-threshold-renders-a-bare-text-node", () => {
		const { container } = render(<MarketTotalDharma value="435" />);

		expect(container.textContent).toBe("435");
		// ⛔ THE LOAD-BEARING HALF. A wrapper here would split every surrounding
		// `Đ … staked` phrase into three text runs, which is what `getByText` and
		// the `innerHTML` ordering assertions on those surfaces match on.
		expect(container.querySelector("span")).toBeNull();
		expect(container.innerHTML).toBe("435");
	});

	it("market-total::above-the-threshold-abbreviates-and-hosts-the-exact-figure", () => {
		render(<MarketTotalDharma value="34365.000000000000000000" />);

		const figure = screen.getByText("34.4k");
		expect(figure.tagName).toBe("SPAN");
		// The exact value, grouped, on the tooltip — the whole reason the short
		// form is allowed to hide anything.
		expect(figure.getAttribute("aria-describedby")).toBe(
			contentHashId("Đ 34,365"),
		);
	});

	it("market-total::a-figure-that-already-renders-exactly-gets-NO-tooltip", () => {
		// The four-digit case that sits between the two thresholds: abbreviated
		// here, and the hint is owed BECAUSE it is abbreviated…
		cleanup();
		render(<MarketTotalDharma value="1830" />);
		expect(screen.getByText("1.8k").getAttribute("aria-describedby")).toBe(
			contentHashId("Đ 1,830"),
		);

		// …while a value below the threshold renders exactly and carries nothing,
		// which is the pair that proves the tooltip is CONDITIONAL rather than
		// merely present.
		cleanup();
		const { container } = render(<MarketTotalDharma value="999.4" />);
		expect(container.textContent).toBe("999");
		expect(container.querySelector("[aria-describedby]")).toBeNull();
	});

	it("market-total::a-malformed-value-renders-honestly-and-silently", () => {
		// A bad value must not crash a render (the formatter degrades), and it is
		// not dressed in a tooltip it cannot support.
		const { container } = render(<MarketTotalDharma value="not-a-number" />);

		expect(container.textContent).toBe("not-a-number");
		expect(container.querySelector("[aria-describedby]")).toBeNull();
	});
});
