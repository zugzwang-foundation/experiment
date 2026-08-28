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
	nudgeFor,
	PHASE_DEG,
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WarliHero,
	wrapSigned,
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

/** `translate(x y) rotate(r)` → the three numbers, or `null`. */
function readTransform(
	node: Element | null | undefined,
): { readonly x: number; readonly y: number; readonly rotate: number } | null {
	const m = node
		?.getAttribute("transform")
		?.match(/^translate\((-?[\d.]+) (-?[\d.]+)\) rotate\((-?[\d.]+)\)$/);
	return m?.[1] === undefined || m[2] === undefined || m[3] === undefined
		? null
		: { x: Number(m[1]), y: Number(m[2]), rotate: Number(m[3]) };
}

const clockAngle = (x: number, y: number) =>
	((((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) + 360) % 360;

describe("warli hero — the argument, asserted", () => {
	it("stands every pair on a shared radius at rest, READ OFF THE DOM", () => {
		// THE THESIS: "every figure faces its social opposite across the gap".
		//
		// ⚠ THIS TEST USED TO PROVE NOTHING, and the way it failed is worth keeping
		// written down. It called `ringPlacements` twice with `phaseDeg: PHASE_DEG`
		// hard-coded in BOTH calls, varying only `radius` and `facing` — and
		// `angleDeg` depends on neither. So it asserted that a pure function of its
		// arguments returns the same thing for the same argument, which is true of
		// every implementation there has ever been. It killed zero mutants,
		// including the one where the outer ring is given a different phase and the
		// pairs never meet. It carried the docblock "THE THESIS" throughout.
		//
		// The fix is to read what actually reaches the DOM. Facing, radius and
		// phase reach it in exactly one place — the figure's `transform` — so
		// nothing that does not read that attribute can see any of the three.
		const { container } = render(<WarliHero />);

		for (const [i, pair] of OPPOSED_PAIRS.entries()) {
			const [innerSpec, outerSpec] = pair;
			const inner = readTransform(
				container.querySelector(
					`[data-warli-ring="inner"] [data-warli-id="${innerSpec.id}"]`,
				),
			);
			const outer = readTransform(
				container.querySelector(
					`[data-warli-ring="outer"] [data-warli-id="${outerSpec.id}"]`,
				),
			);
			if (inner === null || outer === null) {
				throw new Error(`pair ${i} did not render a parsable transform`);
			}

			// Same bearing from the centre — the pair shares a radius.
			expect(clockAngle(outer.x, outer.y)).toBeCloseTo(
				clockAngle(inner.x, inner.y),
				6,
			);
			// Facing each other, not the same way: exactly a half turn apart.
			expect(outer.rotate - inner.rotate).toBe(180);
			// And on the two DIFFERENT rings they were assigned to, or the pairing
			// holds while the composition has collapsed to one radius.
			expect(Math.hypot(inner.x, inner.y)).toBeCloseTo(R_INNER, 3);
			expect(Math.hypot(outer.x, outer.y)).toBeCloseTo(R_OUTER, 3);
		}
	});

	it("wires each ring to its own radius, phase and facing — exact transforms", () => {
		// Both literals derived from the convention, not from the engine:
		//   sin 22.5° = √((1 − √2/2)/2) = 0.38268343
		//   cos 22.5° = √((1 + √2/2)/2) = 0.92387953
		//   inner: r=330, outward → (330·sin, −330·cos), rotate 22.5
		//   outer: r=470, inward  → (470·sin, −470·cos), rotate 22.5 + 180
		// This is also the only assertion that pins the transform's APPLY ORDER.
		// SVG composes left to right, so `rotate(90) translate(100 0)` puts a
		// three-o'clock figure at six o'clock — while the hand chain, computed in
		// JS as rotate-then-translate, keeps drawing its chord at three.
		const { container } = render(<WarliHero />);
		expect(
			container
				.querySelector(
					'[data-warli-ring="inner"] [data-warli-id="warli-scholar"]',
				)
				?.getAttribute("transform"),
		).toBe("translate(126.2855 -304.8802) rotate(22.5)");
		expect(
			container
				.querySelector(
					'[data-warli-ring="outer"] [data-warli-id="warli-labourer"]',
				)
				?.getAttribute("transform"),
		).toBe("translate(179.8612 -434.2234) rotate(202.5)");
	});

	it("counter-rotates the two rings about the composition centre", () => {
		// The entire behavioural claim of the piece. Equal AND OPPOSITE — drop the
		// `--ccw` and both rings turn the same way, so the pairs never separate and
		// never re-converge, and nothing else in the suite would notice.
		const { container } = render(<WarliHero />);
		expect(
			container
				.querySelector('[data-warli-spin="inner"]')
				?.getAttribute("class"),
		).toBe("warli-spin");
		expect(
			container
				.querySelector('[data-warli-spin="outer"]')
				?.getAttribute("class"),
		).toBe("warli-spin warli-spin--ccw");

		const css = container.querySelector("style")?.textContent ?? "";
		expect(css).toContain(
			"@keyframes warli-turn { to { transform: rotate(360deg); } }",
		);
		expect(css).toContain(
			"@keyframes warli-turn-ccw { to { transform: rotate(-360deg); } }",
		);
		// Without this the rings orbit their own bounding boxes rather than the
		// composition's centre — CSS defaults a transform origin to the box centre,
		// and for a `<g>` that is wherever the drawing happens to sit.
		expect(css.match(/transform-origin: 0 0;/g)).toHaveLength(2);
		expect(css).toContain("animation-play-state: paused");
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

	it("nudges both rings toward the pointer, and releases", () => {
		// FIRST COVERAGE OF THE POINTER PATH. Its limit is stated rather than
		// implied: jsdom runs no animation, so `getComputedStyle(g).transform` is
		// `none`, both ring phases read as 0, and `misalign` is therefore always 0
		// here. The equal-and-opposite split — the half that decides where the
		// rings actually go — is NOT exercised by this test. It is exercised by the
		// `nudgeFor` cases below, which is why that function is exported.
		const { container } = render(<WarliHero />);
		const svg = container.querySelector("[data-warli-hero]");
		if (svg === null) {
			throw new Error("no hero root");
		}
		Object.defineProperty(svg, "getBoundingClientRect", {
			value: () => ({
				left: 0,
				top: 0,
				width: 1440,
				height: 1000,
				right: 1440,
				bottom: 1000,
				x: 0,
				y: 0,
			}),
		});

		svg.dispatchEvent(new MouseEvent("pointerenter"));
		// POSITIVE CONTROL: without this the two assertions below would pass just
		// as happily against handlers that were never attached at all.
		expect(svg.getAttribute("data-warli-engaged")).toBe("true");

		// Centre (720, 500); pointer at 30° clockwise from twelve, r = 400:
		//   (720 + 400·sin30, 500 − 400·cos30) = (920, 153.5898).
		// The nearest pair rests at 22.5°, so both rings turn +7.5° to bring it
		// under the pointer.
		svg.dispatchEvent(
			new MouseEvent("pointermove", { clientX: 920, clientY: 153.5898 }),
		);
		expect(
			[...container.querySelectorAll(".warli-nudge")].map((n) =>
				(n as SVGGElement).style.getPropertyValue("--warli-nudge"),
			),
		).toEqual(["7.500deg", "7.500deg"]);

		svg.dispatchEvent(new MouseEvent("pointerleave"));
		expect(svg.getAttribute("data-warli-engaged")).toBeNull();
		expect(
			[...container.querySelectorAll(".warli-nudge")].map((n) =>
				(n as SVGGElement).style.getPropertyValue("--warli-nudge"),
			),
		).toEqual(["0deg", "0deg"]);
	});

	it("splits a real misalignment equally and oppositely between the rings", () => {
		// THE CASE jsdom CANNOT REACH, and the one that matters: both rings already
		// turned, and turned opposite ways. Hand-computed throughout.
		//
		// inner at +40°, outer at −40° → misalign = wrapSigned(−80) = −80.
		// Each ring travels half: inner −40, outer +40, meeting at 0°.
		// Pointer at 22.5° is exactly where pair 0 then rests, so nothing extra:
		//   settledAt = 40 + (−40) = 0; nearest = round((22.5−22.5−0)/45)·45 = 0;
		//   toPointer = 0.
		expect(
			nudgeFor({ innerPhase: 40, outerPhase: -40, pointerDeg: 22.5 }),
		).toEqual({ inner: -40, outer: 40 });

		// Same misalignment, pointer moved to 90°. Both rings take the same extra
		// turn on top of the split:
		//   nearest = round((90 − 22.5 − 0)/45)·45 = round(1.5)·45 = 2·45 = 90
		//   toPointer = wrapSigned(90 − (22.5 + 0 + 90)) = −22.5
		//   inner = −40 + (−22.5) = −62.5   outer = +40 + (−22.5) = 17.5
		//
		// ⚠ I FIRST WROTE 45 AND 22.5 HERE, and the test reddened. `Math.round(1.5)`
		// is 2, not 1 — JavaScript rounds a half AWAY from zero for positives — so
		// the snap goes to the NEXT figure, not the nearer-looking one. The code was
		// right and my arithmetic was wrong, which is the direction a hand-computed
		// expectation is supposed to fail in: it disagrees with the implementation
		// until one of them is fixed, and it does not care which.
		expect(
			nudgeFor({ innerPhase: 40, outerPhase: -40, pointerDeg: 90 }),
		).toEqual({ inner: -62.5, outer: 17.5 });

		// Aligned rings need no split at all — only the turn to the pointer.
		expect(
			nudgeFor({ innerPhase: 12, outerPhase: 12, pointerDeg: 34.5 }),
		).toEqual({ inner: 0, outer: 0 });

		// The nudges always differ by exactly the misalignment, whatever else
		// happens — that is what "equal and opposite" means, and it is the property
		// a future change is most likely to break.
		for (const [i, o, p] of [
			[0, 0, 0],
			[130, -130, 200],
			[-17.5, 91.25, 305],
		] as const) {
			const n = nudgeFor({ innerPhase: i, outerPhase: o, pointerDeg: p });
			expect(n.inner - n.outer).toBeCloseTo(wrapSigned(o - i), 9);
		}
	});

	it("wraps a half turn to the LOWER end of the range", () => {
		// The docblock claimed (−180, 180]; it is [−180, 180). Pinned so the
		// correction cannot be undone by someone trusting the old sentence.
		expect(wrapSigned(180)).toBe(-180);
		expect(wrapSigned(-180)).toBe(-180);
		expect(wrapSigned(190)).toBe(-170);
		expect(wrapSigned(-190)).toBe(170);
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
