// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SVG_W, VIEWBOX_H } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-2 — the container/viewBox lock (design-canon §10 `C-CHART-1` clause 4,
// as amended 2026-08-27).
//
// ⛔ THIS IS THE GUARD WHOSE ABSENCE CAUSED A LIVE REGRESSION, AND THE STORY IS
// SHORT ENOUGH TO TELL IN FULL. At `83cf6fb` the chart's viewBox was
// `0 0 640 320` and the expanded overlay's container was `aspect-[2/1]`. Those
// two numbers had to agree and did: 640/320 = 2/1, so `preserveAspectRatio=
// "none"` scaled x and y by exactly the same factor and the expanded overlay was
// the one surface where a declared 10px label rendered undistorted.
//
// CHART-1 then widened the viewBox to `0 0 678 320` to make room for the end
// labels. That was correct in itself and it moved no plotted coordinate. But
// nothing changed `aspect-[2/1]`, and nothing in the repository noticed, so the
// expanded overlay's anisotropy fell from 1.0000 to 0.94395 — measurable on any
// rendered page, invisible to every test.
//
// ⛔ WHY EVERY EXISTING GUARD MISSED IT. They all assert in USER UNITS — that
// `xPx(end)` is 640, that a dot's `cy` is `yYesPx(p)`, that the polyline's last
// point matches its dot. All of those were still true. The defect existed only
// in CSS pixels, in the RELATIONSHIP between two values that live in different
// files and had no reason to be compared.
//
// ⛔ SO THIS FILE ASSERTS THE RELATIONSHIP, NEVER A NUMBER. It reads the
// container's declared aspect and the `<svg>`'s own viewBox off the rendered
// tree and compares them to each other. `expect(ratio).toBe(2.0125)` would be
// the same defect with a newer number: it would go stale the next time the
// viewBox moves, exactly as `aspect-[2/1]` did. Nothing below hard-codes 644,
// 320 or their quotient.

afterEach(cleanup);

const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.650000000000000000" },
];

/** `"644 / 320"` → 2.0125. Returns `null` when the property is absent, which is
 * the state the two flex-driven modes must be in. */
function parseAspect(raw: string): number | null {
	const m = raw.match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/);
	if (m === null) {
		return null;
	}
	return Number(m[1]) / Number(m[2]);
}

/** The `<svg>`'s own declared shape, read off the rendered attribute. */
function viewBoxAspect(container: HTMLElement): number {
	const vb =
		container
			.querySelector('[data-testid="market-price-chart"]')
			?.getAttribute("viewBox") ?? "";
	const [, , w, h] = vb.split(/\s+/).map(Number);
	return w / h;
}

function plotAspect(container: HTMLElement): number | null {
	const plot = container.querySelector(
		'[data-testid="market-price-chart-plot"]',
	) as HTMLElement | null;
	return parseAspect(plot?.style.aspectRatio ?? "");
}

function renderMode(mode: "collapsed" | "expanded" | "hero") {
	return render(<MarketPriceChart series={SERIES} mode={mode} isOpen={true} />);
}

describe("C-CHART-1 clause 4 — the container's aspect equals the viewBox's", () => {
	it("expanded: the plot container's declared aspect IS the viewBox's aspect", () => {
		const { container } = renderMode("expanded");

		const declared = plotAspect(container);
		const viewBox = viewBoxAspect(container);

		// ⛔ THE ASSERTION THE REGRESSION NEEDED. Both sides are read from the
		// rendered tree; neither is a literal. At `9d2a920` this compared 2.0000
		// (the container) against 2.11875 (the viewBox) and would have been RED.
		expect(declared).not.toBeNull();
		expect(declared as number).toBeCloseTo(viewBox, 6);

		// POSITIVE CONTROL — the comparator can actually fail. Without this, a
		// build where BOTH reads returned `NaN` (a renamed testid, a dropped
		// attribute) would satisfy the line above by accident, and this file would
		// certify a lock it never measured.
		expect(Number.isFinite(viewBox)).toBe(true);
		expect(Number.isFinite(declared as number)).toBe(true);
		expect(() => expect(viewBox).toBeCloseTo(viewBox * 1.05, 6)).toThrow();
	});

	it("the locked aspect tracks the geometry module, not a copy of it", () => {
		// The other direction of the same relationship: the container follows
		// `SVG_W`/`VIEWBOX_H` themselves, so a future change to either — the dot
		// allowance, the plot width, the height — carries the container with it
		// instead of leaving it behind.
		const { container } = renderMode("expanded");
		expect(plotAspect(container) as number).toBeCloseTo(SVG_W / VIEWBOX_H, 6);
	});

	for (const mode of ["collapsed", "hero"] as const) {
		it(`${mode}: declares NO aspect — its box is inherited, not stated`, () => {
			// ⚠ THE OTHER HALF OF THE RULE, AND IT IS NOT SYMMETRY FOR ITS OWN SAKE.
			// `collapsed` is `flex-1 min-h-0` inside the header rail and `hero` is
			// `min-h-24 flex-1` inside a carousel panel: both are functions of
			// viewport AND of neighbouring content, and the hero's was observed at
			// two different sizes in one session because the carousel advances.
			// Pinning an aspect to either would invent a constraint the layout does
			// not have and would fight the rail for height. What makes those two
			// modes correct is that their text left the stretched space (clause 2),
			// not a lock. A well-meaning "consistency" fix that adds one here should
			// redden.
			const { container } = renderMode(mode);
			expect(plotAspect(container)).toBeNull();
		});
	}

	it("no Tailwind aspect literal survives anywhere in the chart", () => {
		// ⛔ THE LITERAL IS THE DEFECT, NOT ITS VALUE. `aspect-[644/320]` would
		// pass every assertion above today and go stale the next time `SVG_W`
		// moves — which is precisely what `aspect-[2/1]` did. This scans the four
		// chart components for the class form itself.
		const dir = join(process.cwd(), "src/components/debate/chart");
		const files = [
			"MarketPriceChart.tsx",
			"MarketPriceChartCard.tsx",
			"MarketPriceChartHost.tsx",
			"MarketPriceChartOverlay.tsx",
		];

		let scanned = 0;
		for (const f of files) {
			const src = readFileSync(join(dir, f), "utf8");
			scanned += src.length;
			// Strip block and line comments first: this file's own explanation of
			// why the literal is banned CONTAINS the literal, and a naive scan
			// would match the prose that documents the ban. That exact shape — a
			// negative guard catching the comment explaining the absence — has
			// bitten this repo repeatedly.
			const code = src
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/\/\/[^\n]*/g, "");
			expect(code).not.toMatch(/className=[^\n]*aspect-\[/);
		}

		// POSITIVE CONTROL — the files were actually read and are not empty, so
		// the four `not.toMatch` above mean "absent", not "nothing scanned".
		expect(scanned).toBeGreaterThan(10_000);
		expect(files).toHaveLength(4);
	});
});
