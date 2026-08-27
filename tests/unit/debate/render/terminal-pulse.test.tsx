// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-2 — the terminal pulse (design-canon §10 `C-CHART-2` clauses 1 and 7,
// founder-ruled 2026-08-27).
//
// ⛔ THE RULE HAS TWO HALVES AND THE SECOND IS THE EASY ONE TO LOSE. An `Open`
// market's line ends breathe, so the chart reads as live. Every other state —
// `Closed`, `Resolving`, `Resolved`, `Voided` — renders **the static dot,
// unchanged in every other respect**. Not "no pulse and also no dot": freezing
// to blankness would delete the line's terminal marker for exactly the readers
// least able to lose it, and would take the HTML label's visual anchor with it.
// A pulse on a frozen market is the INV-4 failure; a vanished dot is the
// accessibility one. Both are asserted below.
//
// ⚠ WHAT jsdom CAN AND CANNOT SEE. It renders no CSS, so no assertion here can
// observe an animation running or a media query applying. What it CAN observe is
// which elements exist and what they carry, which is where both failure modes
// live: the pulse is an ELEMENT that is present or absent by `isOpen`, and the
// reduced-motion posture is a RULE in `globals.css`. The rendered-pixel half —
// that the ring actually animates, and actually stops under
// `prefers-reduced-motion` while the dot stays — is measured in the CHART-2
// contact sheet, in a real browser, because that is the only place it exists.

afterEach(cleanup);

const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.650000000000000000" },
];

const MODES = ["collapsed", "expanded", "hero"] as const;

function renderChart(mode: (typeof MODES)[number], isOpen: boolean) {
	return render(
		<MarketPriceChart series={SERIES} mode={mode} isOpen={isOpen} />,
	);
}

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("C-CHART-2 clause 1 — the pulse is gated on Open", () => {
	for (const mode of MODES) {
		it(`${mode}: an Open market pulses on BOTH poles`, () => {
			const { container } = renderChart(mode, true);
			expect(
				container.querySelector('[data-testid="terminal-pulse-yes"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-pulse-no"]'),
			).not.toBeNull();
		});

		it(`${mode}: a FROZEN market renders no pulse — INV-4`, () => {
			const { container } = renderChart(mode, false);
			expect(
				container.querySelector('[data-testid="terminal-pulse-yes"]'),
			).toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-pulse-no"]'),
			).toBeNull();

			// ⛔ POSITIVE CONTROL, AND WITHOUT IT THE TWO NULLS ABOVE ARE WORTHLESS.
			// A build that rendered no chart at all — a crashed component, a renamed
			// testid, an empty series — satisfies "no pulse" perfectly. Prove the
			// chart is here and drawing before reading anything as an absence.
			expect(
				container.querySelector('[data-testid="market-price-chart"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="line-yes"]'),
			).not.toBeNull();
		});
	}

	it("the frozen market KEEPS its terminal dots — the pulse stops, the mark does not", () => {
		// ⛔ THE HALF THAT IS EASY TO GET WRONG BY BEING TIDY. Gating the whole
		// `TerminalMarkers` subtree on `isOpen` would satisfy every "no pulse on a
		// frozen market" assertion in this file and would delete the line's
		// terminal marker from every `Resolved` market in the product — along with
		// the thing the HTML label is positioned against.
		for (const mode of MODES) {
			const { container } = renderChart(mode, false);
			expect(
				container.querySelector('[data-testid="terminal-dot-yes"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="terminal-dot-no"]'),
			).not.toBeNull();
			// …and the labels that hang off them.
			expect(
				container.querySelector('[data-testid="terminal-label-yes"]'),
			).not.toBeNull();
			cleanup();
		}
	});

	it("Open and frozen differ in EXACTLY the pulse — nothing else moves", () => {
		// The dots must be identical in position and token across the two states.
		// A build that also shifted, resized or recoloured the dot when a market
		// froze would be making a second statement nobody ruled on.
		const open = renderChart("collapsed", true).container;
		const dotOpen = open.querySelector('[data-testid="terminal-dot-yes"]');
		const openAttrs = {
			cx: dotOpen?.getAttribute("cx"),
			cy: dotOpen?.getAttribute("cy"),
			r: dotOpen?.getAttribute("r"),
			fill: dotOpen?.getAttribute("fill"),
		};
		cleanup();

		const frozen = renderChart("collapsed", false).container;
		const dotFrozen = frozen.querySelector('[data-testid="terminal-dot-yes"]');
		expect({
			cx: dotFrozen?.getAttribute("cx"),
			cy: dotFrozen?.getAttribute("cy"),
			r: dotFrozen?.getAttribute("r"),
			fill: dotFrozen?.getAttribute("fill"),
		}).toEqual(openAttrs);

		// POSITIVE CONTROL — the attributes read are real, not four undefineds
		// comparing equal to four undefineds.
		expect(openAttrs.fill).toBe("var(--graph-yes)");
		expect(Number(openAttrs.r)).toBeGreaterThan(0);
	});
});

describe("C-CHART-2 clause 1 — the ring stays on its own pole's token (INV-3)", () => {
	it("binds YES→--graph-yes and NO→--graph-no, and never the opposite", () => {
		const { container } = renderChart("collapsed", true);
		const pairs = [
			["terminal-pulse-yes", "--graph-yes", "--graph-no"],
			["terminal-pulse-no", "--graph-no", "--graph-yes"],
		] as const;

		for (const [id, own, opposite] of pairs) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			const fill = el?.getAttribute("fill") ?? "";
			expect(fill).toBe(`var(${own})`);
			expect(fill).not.toContain(opposite);
			// ⚠ THE RULING SAID "GREY" AND THE CODE MUST NOT. A neutral ring on the
			// NO line is a pole rendered off its own token — the INV-3 violation
			// this repo has already shipped twice by value-copying `--color-*`. The
			// grey arrives from the token itself: `--graph-yes` IS grey, and a
			// `--graph-no` ring at low alpha over `--color-ground` reads grey.
			expect(fill).not.toContain("--color-");
			expect(fill).not.toContain("n5");
			// The ring is faint by fill-opacity, not by a second colour.
			expect(Number(el?.getAttribute("fill-opacity"))).toBeGreaterThan(0);
			expect(Number(el?.getAttribute("fill-opacity"))).toBeLessThan(1);
		}
	});

	it("the ring shares its dot's centre, so it expands FROM the dot", () => {
		const { container } = renderChart("collapsed", true);
		for (const side of ["yes", "no"] as const) {
			const ring = container.querySelector(
				`[data-testid="terminal-pulse-${side}"]`,
			);
			const dot = container.querySelector(
				`[data-testid="terminal-dot-${side}"]`,
			);
			expect(ring?.getAttribute("cx")).toBe(dot?.getAttribute("cx"));
			expect(ring?.getAttribute("cy")).toBe(dot?.getAttribute("cy"));
		}
	});
});

describe("C-CHART-2 clause 7 — motion is CSS, at canon's values, and freezes", () => {
	it("the pulse is a CSS class and adds no JavaScript to the chart tree", () => {
		const src = readFileSync(
			join(process.cwd(), "src/components/debate/chart/MarketPriceChart.tsx"),
			"utf8",
		);
		const code = src
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\/\/[^\n]*/g, "");

		// Clause 6 is not relaxed by animating something. A `useEffect` interval
		// or a rAF loop would put a runtime into a tree that has none, for a
		// decoration.
		for (const banned of [
			"useEffect",
			"useState",
			"requestAnimationFrame",
			"setInterval",
			"setTimeout",
			"<animate",
			"<animateTransform",
		]) {
			expect(code).not.toContain(banned);
		}

		// ⛔ POSITIVE CONTROL FOR THE SEVEN NEGATIVES ABOVE. The same read, the
		// same comment-stripping, against a file that genuinely does use React
		// state — so "not found" above means absent, not "my scan is broken".
		const host = readFileSync(
			join(
				process.cwd(),
				"src/components/debate/chart/MarketPriceChartHost.tsx",
			),
			"utf8",
		);
		expect(host).toContain("useState");

		// And the mechanism that IS used.
		const { container } = renderChart("collapsed", true);
		expect(
			container
				.querySelector('[data-testid="terminal-pulse-yes"]')
				?.getAttribute("class"),
		).toContain("chart-terminal-pulse");
	});

	it("globals.css carries the keyframes at canon's ratified values", () => {
		// 1.4s / ease-in-out / opacity 1 → 0.2 are the radio "On Air" dot's, reused
		// rather than re-minted so the product's live indicators breathe at one
		// rate. Pinned here so a later "tidy" retiming has to argue with canon.
		expect(CSS).toContain("@keyframes chart-terminal-pulse");
		expect(CSS).toMatch(
			/animation:\s*chart-terminal-pulse\s+1\.4s\s+ease-in-out\s+infinite/,
		);
		expect(CSS).toMatch(/opacity:\s*0\.2/);
		// Growing out of its own centre rather than sliding off it.
		expect(CSS).toContain("transform-box: fill-box");
	});

	it("prefers-reduced-motion freezes the pulse — and the branch is PROVEN entered", () => {
		// ⛔ THE TRAP THIS CASE IS WRITTEN AGAINST. "Assert the reduced-motion rule
		// exists" passes trivially if the extraction silently matches nothing and
		// the assertion runs against an empty string, or against the whole file —
		// in which case it would be satisfied by the ordinary `animation:` a few
		// lines above the media query. So: isolate the block FIRST, prove it is a
		// real non-empty block that does not contain the unconditional rule, and
		// only then assert what is inside it.
		const m = CSS.match(
			/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/,
		);
		expect(m).not.toBeNull();
		const block = m?.[1] ?? "";

		// The branch is real and was entered.
		expect(block.length).toBeGreaterThan(20);
		expect(block).toContain(".chart-terminal-pulse");
		expect(block).toContain("animation: none");
		// …and it is genuinely a SUBSET of the file, not the file itself — the
		// control that would catch a regex which swallowed everything.
		expect(block.length).toBeLessThan(CSS.length / 2);
		expect(block).not.toContain("@keyframes");

		// ⛔ THE DOT MUST SURVIVE THE FREEZE. The reduced-motion rule may stop the
		// animation; it must never hide anything. `display:none` / `visibility` /
		// `opacity: 0` here would delete the terminal marker for the readers this
		// media query exists to serve.
		expect(block).not.toContain("display: none");
		expect(block).not.toContain("visibility");
		expect(block).not.toMatch(/opacity:\s*0\s*;/);
	});
});

describe("C-CHART-2 clauses 1 and 7 — CHART-2 audit: two documented properties nothing asserted", () => {
	for (const mode of MODES) {
		it(`${mode}: the ring is painted BEFORE the dot, so the dot stays crisp`, () => {
			// ⛔ `TerminalMarkers`' own docblock states this as a requirement — "THE
			// RING IS DRAWN BEFORE THE DOT so the solid dot paints over it and stays
			// crisp at its own radius" — and nothing asserted it. SVG paints in
			// document order, so swapping the two JSX blocks puts a ring that grows
			// to 2.4× radius at 0.35 fill-opacity ON TOP of the mark it is meant to
			// halo: the terminal dot, the one element on this chart that states a
			// price, washes out twice a second on every Open market. Nothing else in
			// the suite reads order, and a reorder changes no attribute, no
			// coordinate and no token.
			//
			// ⚠ O-7 — `innerHTML`, never `textContent`. Order is a property of the
			// markup, and `textContent` flattens exactly the thing being asserted.
			const { container } = renderChart(mode, true);
			const svg = container.querySelector('[data-testid="market-price-chart"]');
			const html = svg?.innerHTML ?? "";

			for (const side of ["yes", "no"] as const) {
				const ring = html.indexOf(`data-testid="terminal-pulse-${side}"`);
				const dot = html.indexOf(`data-testid="terminal-dot-${side}"`);
				// Both present — an absent marker indexes to -1 and would satisfy the
				// ordering below by accident, which is the whole failure shape of an
				// index comparison.
				expect(ring).toBeGreaterThan(-1);
				expect(dot).toBeGreaterThan(-1);
				expect(ring).toBeLessThan(dot);
			}
		});
	}

	it("EVERY reduced-motion rule that touches the pulse freezes it and hides nothing", () => {
		// ⛔ THE CASE ABOVE READS THE FIRST BLOCK ONLY, AND ONE BLOCK IS NOT THE
		// RULE. `CSS.match(/@media \(prefers-reduced-motion: reduce\)…/)` without
		// `/g` returns the first match and stops, so a SECOND reduce block added
		// later — `.chart-terminal-pulse { display: none }`, the tidy way to
		// "respect" the preference — would sit in the file unread while the
		// existing assertions stayed green on the block above it. Clause 7's rule
		// is that the pulse freezes and **the dot REMAINS**; deleting the marker
		// for the readers this media query exists to serve is the failure it names
		// in terms.
		const blocks = [
			...CSS.matchAll(
				/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g,
			),
		].map((m) => m[1]);

		// The collector found real blocks — without this, "every block satisfies X"
		// is vacuously true over an empty list, which is the single most common way
		// a for-all assertion certifies nothing.
		expect(blocks.length).toBeGreaterThanOrEqual(1);
		expect(blocks.every((b) => b.length > 20)).toBe(true);

		const HIDES = /display:\s*none|visibility:\s*hidden|opacity:\s*0\s*;/;
		const touching = blocks.filter((b) => b.includes(".chart-terminal-pulse"));
		// At least one block governs the pulse — the reduced-motion posture exists
		// at all, rather than every block being about something else.
		expect(touching.length).toBeGreaterThanOrEqual(1);
		for (const block of touching) {
			expect(block).toContain("animation: none");
			expect(HIDES.test(block)).toBe(false);
		}

		// …and no rule ANYWHERE in the stylesheet hides the ring, reduce-scoped or
		// not. The freeze is the only thing this class may ever receive.
		expect(
			/chart-terminal-pulse[^}]*(display:\s*none|visibility:\s*hidden)/.test(
				CSS,
			),
		).toBe(false);

		// POSITIVE CONTROL — the hiding matcher fires on every form it is written
		// against, so the `false`s above are readings rather than a dead regex.
		for (const hidden of [
			"\t.chart-terminal-pulse { display: none; }",
			"\t.chart-terminal-pulse { visibility: hidden; }",
			"\t.chart-terminal-pulse { opacity: 0; }",
		]) {
			expect(HIDES.test(hidden)).toBe(true);
		}
		expect(HIDES.test("\t.chart-terminal-pulse { animation: none; }")).toBe(
			false,
		);
	});
});
