// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReplySplitBar } from "@/components/debate/composer/ReplySplitBar";
import type { ReplyAggregate, Side } from "@/components/debate/types";

/**
 * FF-1 / ADR-0058 — G12, the METER half (D-51 R5): the post-focus Support-lane
 * header carries a one-sided friendly-fire meter — friendly-fire Đ ABOVE the
 * Support pill, a single-fill bar with the label `Friendly fire · N % of
 * Support Đ` BENEATH it, the total Support Đ below that — and NOTHING of it
 * while Support Đ is zero. The Counter flank never carries one.
 *
 * ⚠ Order is asserted on the DOM (compareDocumentPosition), never inferred from
 * class names (OVN-V5); figures are asserted on `innerHTML` (O-7). The
 * `hidden-at-zero` negative has its positive control in the `partial` case.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const noop = () => {};

function agg(over: Partial<ReplyAggregate>): ReplyAggregate {
	return {
		supportCount: 2,
		counterCount: 1,
		supportDharma: "0.000000000000000000",
		counterDharma: "0.000000000000000000",
		...over,
	};
}

function renderBar(aggregate: ReplyAggregate, postSide: Side = "YES") {
	return render(
		<ReplySplitBar
			postSide={postSide}
			aggregate={aggregate}
			heldSide={null}
			marketOpen={true}
			suspended={false}
			activeRelation={null}
			onToggleRelation={noop}
		/>,
	);
}

function precedes(a: Element, b: Element): boolean {
	return (
		(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
	);
}

describe("friendly-fire meter — the Support-lane header", () => {
	it("ff-meter::partial — figure above the pill, bar + label beneath, Support Đ last", () => {
		const { container } = renderBar(
			agg({
				supportDharma: "100.000000000000000000",
				counterDharma: "50.000000000000000000",
				friendlyFireDharma: "50.000000000000000000",
			}),
		);
		const meter = container.querySelector('[data-testid="ff-meter"]');
		const figure = container.querySelector('[data-testid="ff-meter-figure"]');
		expect(meter).not.toBeNull();
		expect(figure).not.toBeNull();
		// The label, verbatim, with the integer percent.
		expect(meter?.innerHTML).toContain("Friendly fire · 50 % of Support Đ");
		// Both Đ figures: friendly-fire Đ (above the pill) and Support Đ (below).
		expect(figure?.innerHTML).toContain("Đ 50");
		const flank = figure?.parentElement as HTMLElement;
		expect(flank.innerHTML).toContain("Đ 100");
		// Order inside the Support flank: figure → pill → meter → Support Đ.
		const pill = flank.querySelector('button[aria-label="Support — bet YES"]');
		expect(pill).not.toBeNull();
		expect(precedes(figure as Element, pill as Element)).toBe(true);
		expect(precedes(pill as Element, meter as Element)).toBe(true);
		const supportFigure = Array.from(flank.querySelectorAll("span")).find((s) =>
			s.innerHTML.includes("Đ 100"),
		);
		expect(supportFigure).toBeDefined();
		expect(precedes(meter as Element, supportFigure as Element)).toBe(true);
		// The fill is half the track, in the post's pole (a same-side bet).
		const fill = meter?.querySelector("span[style]");
		expect(fill?.getAttribute("style")).toContain("width: 50%");
		expect(fill?.getAttribute("class")).toContain("bg-yes");
		// Never a count.
		expect(container.innerHTML).not.toMatch(/\d+\s+friendly/i);
	});

	it("ff-meter::full — 100 % when every Support Đ is friendly fire", () => {
		const { container } = renderBar(
			agg({
				supportDharma: "80.000000000000000000",
				friendlyFireDharma: "80.000000000000000000",
			}),
			"NO",
		);
		const meter = container.querySelector('[data-testid="ff-meter"]');
		expect(meter?.innerHTML).toContain("Friendly fire · 100 % of Support Đ");
		const fill = meter?.querySelector("span[style]");
		expect(fill?.getAttribute("style")).toContain("width: 100%");
		// A NO post's fill is the NO pole — the side rule, never the relation.
		expect(fill?.getAttribute("class")).toContain("bg-no");
	});

	it("ff-meter::zero-numerator — 0 % is a real reading and IS rendered", () => {
		const { container } = renderBar(
			agg({
				supportDharma: "100.000000000000000000",
				friendlyFireDharma: "0.000000000000000000",
			}),
		);
		const meter = container.querySelector('[data-testid="ff-meter"]');
		expect(meter?.innerHTML).toContain("Friendly fire · 0 % of Support Đ");
		expect(
			container.querySelector('[data-testid="ff-meter-figure"]')?.innerHTML,
		).toContain("Đ 0");
	});

	it("ff-meter::hidden-entirely-while-Support-Đ-is-zero", () => {
		const { container } = renderBar(
			agg({
				supportDharma: "0.000000000000000000",
				counterDharma: "70.000000000000000000",
				friendlyFireDharma: "0.000000000000000000",
			}),
		);
		expect(container.querySelector('[data-testid="ff-meter"]')).toBeNull();
		expect(
			container.querySelector('[data-testid="ff-meter-figure"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("Friendly fire");
		// …and the flank still renders its pill and its (zero) Support figure.
		expect(
			container.querySelector('button[aria-label="Support — bet YES"]'),
		).not.toBeNull();
	});

	it("ff-meter::absent-when-the-DTO-carries-no-friendlyFireDharma (pre-ADR shape reads as 0 %)", () => {
		// A cached view-model from before the field existed: the meter reads the
		// absent numerator as zero rather than crashing or hiding the lane.
		const { container } = renderBar(
			agg({ supportDharma: "100.000000000000000000" }),
		);
		const meter = container.querySelector('[data-testid="ff-meter"]');
		expect(meter?.innerHTML).toContain("Friendly fire · 0 % of Support Đ");
	});

	it("ff-meter::the-Counter-flank-never-carries-a-meter", () => {
		const { container } = renderBar(
			agg({
				supportDharma: "100.000000000000000000",
				counterDharma: "100.000000000000000000",
				friendlyFireDharma: "25.000000000000000000",
			}),
		);
		const counterPill = container.querySelector(
			'button[aria-label="Counter — bet NO"]',
		) as HTMLElement;
		const counterFlank = counterPill.parentElement as HTMLElement;
		expect(counterFlank.querySelector('[data-testid="ff-meter"]')).toBeNull();
		expect(counterFlank.innerHTML).not.toContain("Friendly fire");
		// One meter on the whole bar.
		expect(container.querySelectorAll('[data-testid="ff-meter"]')).toHaveLength(
			1,
		);
	});
});
