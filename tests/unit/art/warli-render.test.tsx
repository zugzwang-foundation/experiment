// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	ALL_FIGURES,
	INNER_FIGURES,
	OPPOSED_PAIRS,
	OUTER_FIGURES,
} from "@/components/art/warli/figures";
import { ringPlacements } from "@/components/art/warli/geometry";
import {
	PHASE_DEG,
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WarliHero,
} from "@/components/art/warli/hero";
import { PRIMITIVE_SPECS } from "@/components/art/warli/primitives";

/**
 * WARLI-1 — the hero renders, and it renders the thing that was argued for.
 *
 * ⚠ THE ASSERTIONS THAT MATTER HERE ARE ABOUT MEANING, NOT ABOUT MARKUP. A test
 * that only counted `<g>` elements would pass against a ring whose pairs never
 * meet, whose figures face the wrong way, or whose colours were smuggled in as
 * literals — every one of which is a defect that looks like a working drawing.
 * So the load-bearing checks are: that every pair shares a radius at rest, that
 * the two rings face each other rather than the same way, and that the sixteen
 * bodies stay one build.
 *
 * There is no `jest-dom` in this repo (AGENTS.md §9), so everything below is
 * plain DOM: `querySelectorAll`, `getAttribute`.
 */

const CENTRE = { x: 0, y: 0 } as const;

describe("warli hero — it renders", () => {
	it("draws both rings and all sixteen figures", () => {
		const { container } = render(<WarliHero />);

		expect(container.querySelectorAll("[data-warli-ring]")).toHaveLength(2);
		expect(
			container
				.querySelector('[data-warli-ring="inner"]')
				?.getAttribute("data-warli-density"),
		).toBe("dense");
		expect(
			container
				.querySelector('[data-warli-ring="outer"]')
				?.getAttribute("data-warli-density"),
		).toBe("spare");

		const labels = [...container.querySelectorAll("[data-warli-label]")].map(
			(node) => node.getAttribute("data-warli-label"),
		);
		expect(labels).toHaveLength(16);
		expect(new Set(labels).size).toBe(16);
		expect(labels).toContain("scholar");
		expect(labels).toContain("labourer");
	});

	it("closes both hand chains — one link per figure, both rings", () => {
		const { container } = render(<WarliHero />);
		const links = container.querySelectorAll(
			'[data-warli-id="warli-hand-link"]',
		);
		expect(links).toHaveLength(INNER_FIGURES.length + OUTER_FIGURES.length);
	});

	it("carries the accessible name on the root, once", () => {
		const { container } = render(<WarliHero label="a ring of figures" />);
		const svg = container.querySelector("[data-warli-hero]");
		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe("a ring of figures");
		expect(svg?.getAttribute("viewBox")).toBe(
			`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
		);
	});
});

describe("warli hero — the argument, asserted", () => {
	it("stands every pair on a shared radius at rest", () => {
		// THE THESIS. "Every figure faces its social opposite across the gap" is
		// only true if inner figure k and outer figure k sit at the SAME angle when
		// nothing is turning. Computed from the two rings' own parameters rather
		// than read back out of the DOM, because the DOM would happily show two
		// rings whose phases had drifted apart and look fine doing it.
		const inner = ringPlacements({
			centre: CENTRE,
			radius: R_INNER,
			count: INNER_FIGURES.length,
			phaseDeg: PHASE_DEG,
			facing: "outward",
		});
		const outer = ringPlacements({
			centre: CENTRE,
			radius: R_OUTER,
			count: OUTER_FIGURES.length,
			phaseDeg: PHASE_DEG,
			facing: "inward",
		});

		expect(inner).toHaveLength(outer.length);
		for (const [i, innerPlacement] of inner.entries()) {
			expect(innerPlacement.angleDeg).toBe(outer[i]?.angleDeg);
		}
	});

	it("faces the two rings at each other, not the same way", () => {
		// A half turn apart at every index. If both rings ever face outward the
		// piece still draws two rings of people — it just stops being about
		// confrontation, which is the only thing it is about.
		const shared = { centre: CENTRE, count: 8, phaseDeg: PHASE_DEG } as const;
		const inner = ringPlacements({
			...shared,
			radius: R_INNER,
			facing: "outward",
		});
		const outer = ringPlacements({
			...shared,
			radius: R_OUTER,
			facing: "inward",
		});
		for (const [i, innerPlacement] of inner.entries()) {
			const opposite = outer[i];
			if (opposite === undefined) {
				throw new Error(`no outer placement at ${i}`);
			}
			expect(opposite.rotationDeg - innerPlacement.rotationDeg).toBe(180);
		}
	});

	it("leaves the auth card's corners outside the inner ring", () => {
		// The card is 416 × ~480, so its half-diagonal is the radius the artwork
		// must clear. This is the number R_INNER exists to be larger than.
		expect(R_INNER).toBeGreaterThan(Math.hypot(416 / 2, 480 / 2));
		// And the outer ring must not touch the frame at any phase.
		expect(R_OUTER).toBeLessThan(VIEW_HEIGHT / 2);
		// The gap the pairs confront across: inner heads at R_INNER + 58, outer
		// heads at R_OUTER − 58.
		expect(R_OUTER - 58 - (R_INNER + 58)).toBe(24);
	});

	it("pairs the eight oppositions, inner to outer, without drift", () => {
		expect(OPPOSED_PAIRS).toHaveLength(8);
		expect(OPPOSED_PAIRS.map(([a, b]) => `${a.label}/${b.label}`)).toEqual([
			"scholar/labourer",
			"soldier/student",
			"priest/scientist",
			"merchant/farmer",
			"speaker/listener",
			"elder/child",
			"weaver/builder",
			"musician/dancer",
		]);
	});
});

describe("warli hero — the registers", () => {
	it("declares thirty primitives with unique ids and real boxes", () => {
		expect(PRIMITIVE_SPECS).toHaveLength(30);
		expect(new Set(PRIMITIVE_SPECS.map((s) => s.id)).size).toBe(30);
		for (const spec of PRIMITIVE_SPECS) {
			expect(spec.id.startsWith("warli-")).toBe(true);
			expect(spec.box.width).toBeGreaterThan(0);
			expect(spec.box.height).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(spec.origin.x)).toBe(true);
			expect(Number.isFinite(spec.origin.y)).toBe(true);
		}
	});

	it("gives the dense ring hatch and ground the spare ring does not have", () => {
		const { container } = render(<WarliHero />);
		const innerRing = container.querySelector('[data-warli-ring="inner"]');
		const outerRing = container.querySelector('[data-warli-ring="outer"]');

		expect(
			innerRing?.querySelectorAll('[data-warli-density="hatch"]'),
		).toHaveLength(INNER_FIGURES.length);
		expect(
			outerRing?.querySelectorAll('[data-warli-density="hatch"]'),
		).toHaveLength(0);
		expect(innerRing?.querySelector("[data-warli-ring-ground]")).not.toBeNull();
		expect(outerRing?.querySelector("[data-warli-ring-ground]")).toBeNull();
	});

	it("keeps every figure the same drawing — sixteen bodies, one build", () => {
		// If a later change gives one figure its own construction, this reddens.
		// The thesis is that everyone in the ring is the same shape and differs
		// only in what they carry, so a bespoke body would reverse the argument
		// while looking like a styling tweak.
		const { container } = render(<WarliHero />);
		expect(container.querySelectorAll("[data-warli-figure-body]")).toHaveLength(
			16,
		);
		expect(
			container.querySelectorAll('[data-warli-id="warli-torso"]'),
		).toHaveLength(16);
		// Twelve carry an object; four are told apart by pose alone.
		expect(container.querySelectorAll("[data-warli-hold]")).toHaveLength(12);
		expect(ALL_FIGURES.filter((f) => f.prop === "none")).toHaveLength(4);
	});

	it("halts every rotation under prefers-reduced-motion", () => {
		// jsdom performs no layout and evaluates no media query, so this is a
		// SOURCE-SHAPED assertion over the emitted stylesheet, not a behavioural
		// one — and saying so matters, because a reader could otherwise take it as
		// proof the reduced-motion state was observed. It was not; it is observed
		// in the standalone preview, which has a toggle for exactly this.
		const { container } = render(<WarliHero />);
		const css = container.querySelector("style")?.textContent ?? "";
		expect(css).toContain("@media (prefers-reduced-motion: reduce)");
		const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion"));
		expect(reduced).toContain("animation: none");
		expect(reduced).toContain("transform: none");
	});
});
