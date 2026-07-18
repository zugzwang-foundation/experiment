// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceSparkline } from "@/components/discovery/PriceSparkline";
import type { PricePoint } from "@/server/discovery/price-series";

/**
 * UI.A4 Slice 4 (plan §2 row 4 / §4) — the design-language §3.2 two-line
 * price graph, rendered from ONE YES series (NO = 1 − YES at render): an
 * `viewBox="0 0 100 40"` svg carrying EXACTLY two polylines stroked with the
 * `--graph-yes` / `--graph-no` tokens (never hex literals), one coordinate
 * pair per series point across x 0→100. A seed-only (single-point) series
 * renders a flat full-width line; an empty series renders nothing. Display
 * geometry only — the canonical prices are server-computed (CLAUDE.md §2).
 */

afterEach(cleanup);

function seriesOf(...yes: string[]): PricePoint[] {
	return yes.map((y, i) => ({
		at: new Date(Date.UTC(2026, 6, 1, 0, i)).toISOString(),
		yes: y,
	}));
}

/** Parse an SVG polyline `points` attr ("x,y x,y …") into numeric pairs. */
function pairsOf(line: Element): Array<{ x: number; y: number }> {
	return (line.getAttribute("points") ?? "")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 0)
		.map((token) => {
			const [x, y] = token.split(",");
			return { x: Number(x), y: Number(y) };
		});
}

/** The two token-stroked lines — throws when either is missing. */
function linesOf(container: HTMLElement): { yes: Element; no: Element } {
	const yes = container.querySelector('polyline[stroke="var(--graph-yes)"]');
	const no = container.querySelector('polyline[stroke="var(--graph-no)"]');
	if (!yes || !no) {
		throw new Error("expected a --graph-yes and a --graph-no polyline");
	}
	return { yes, no };
}

describe("UI.A4 §4 — PriceSparkline (two-line graph)", () => {
	it("render::two-complementary-lines-from-one-yes-series", () => {
		const { container } = render(
			<PriceSparkline
				series={seriesOf(
					"0.500000000000000000",
					"0.700000000000000000",
					"0.400000000000000000",
				)}
			/>,
		);
		const svg = screen.getByTestId("price-sparkline");
		expect(svg.tagName.toLowerCase()).toBe("svg");
		expect(svg.getAttribute("viewBox")).toBe("0 0 100 40");
		expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
		expect(svg.getAttribute("aria-hidden")).toBe("true");
		// EXACTLY two lines — the YES line and its complement, never more.
		expect(container.querySelectorAll("polyline")).toHaveLength(2);
		const { yes, no } = linesOf(container);
		const yesPairs = pairsOf(yes);
		const noPairs = pairsOf(no);
		// One coordinate pair per series point.
		expect(yesPairs).toHaveLength(3);
		expect(noPairs).toHaveLength(3);
		// x spans 0 → 100; the NO line rides the SAME x positions.
		expect(yesPairs[0].x).toBe(0);
		expect(yesPairs[2].x).toBe(100);
		expect(noPairs.map((p) => p.x)).toEqual(yesPairs.map((p) => p.x));
		// NO = 1 − YES (design-language §3.2): inside the 0..40 viewBox the two
		// lines mirror about the horizontal midline — y_yes + y_no = 40 at
		// every x (tolerance absorbs per-coordinate rounding only).
		for (let i = 0; i < yesPairs.length; i++) {
			expect(yesPairs[i].y + noPairs[i].y).toBeCloseTo(40, 1);
		}
		// The line actually moves (0.5 → 0.7 → 0.4) — not a flat degenerate.
		expect(yesPairs[0].y).not.toBe(yesPairs[1].y);
	});

	it("render::single-point-series-flat-line", () => {
		const { container } = render(
			<PriceSparkline series={seriesOf("0.500000000000000000")} />,
		);
		const { yes, no } = linesOf(container);
		for (const line of [yes, no]) {
			const pairs = pairsOf(line);
			// The seed-only point is duplicated across x=0 and x=100 — a flat
			// full-width line, never a single dot.
			expect(pairs).toHaveLength(2);
			expect(pairs[0].x).toBe(0);
			expect(pairs[1].x).toBe(100);
			expect(pairs[0].y).toBe(pairs[1].y);
		}
	});

	it("render::empty-series-renders-nothing", () => {
		const { container } = render(<PriceSparkline series={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("render::size-prop-marks-card-vs-hero", () => {
		const card = render(
			<PriceSparkline series={seriesOf("0.500000000000000000")} />,
		);
		expect(card.getByTestId("price-sparkline").getAttribute("data-size")).toBe(
			"card",
		);
		card.unmount();
		render(
			<PriceSparkline series={seriesOf("0.500000000000000000")} size="hero" />,
		);
		expect(
			screen.getByTestId("price-sparkline").getAttribute("data-size"),
		).toBe("hero");
	});
});
