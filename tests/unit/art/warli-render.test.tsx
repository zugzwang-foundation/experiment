// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	ALL_FIGURES,
	DEFAULT_POSE,
	FIELD_FIGURES,
	HAND_X,
	INNER_FIGURES,
	OPPOSED_PAIRS,
	OUTER_FIGURES,
} from "@/components/art/warli/figures";
import { ringPlacements } from "@/components/art/warli/geometry";
import {
	currentRotationDeg,
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
	it("draws both rings, the static field, and every figure once", () => {
		const { container } = render(<WarliHero />);

		expect(container.querySelectorAll("[data-warli-ring]")).toHaveLength(2);
		expect(
			container
				.querySelector('[data-warli-ring="inner"]')
				?.getAttribute("data-warli-density"),
		).toBe("solid");
		expect(
			container
				.querySelector('[data-warli-ring="outer"]')
				?.getAttribute("data-warli-density"),
		).toBe("spare");

		// ⚠ IDS, NOT LABELS. Ring figures have unique labels; the static field
		// deliberately does not — it holds two elders, two pupils, two mourners
		// and three dancers, because a field of twenty-eight people in which no
		// two do the same job is not a village, it is a catalogue. Asserting label
		// uniqueness would therefore forbid the correct composition. Ids stay
		// unique, and that is the property worth pinning: a duplicate id means a
		// figure was registered twice.
		const ids = [...container.querySelectorAll("[data-warli-id^='warli-']")]
			.map((node) => node.getAttribute("data-warli-id"))
			.filter((id) => ALL_FIGURES.some((f) => f.id === id));
		expect(new Set(ids).size).toBe(ALL_FIGURES.length);

		expect(
			container.querySelectorAll(
				'[data-warli-ring="inner"] [data-warli-label]',
			),
		).toHaveLength(INNER_FIGURES.length);
		expect(
			container.querySelectorAll(
				'[data-warli-ring="outer"] [data-warli-label]',
			),
		).toHaveLength(OUTER_FIGURES.length);
		expect(
			container.querySelectorAll("[data-warli-field-figure]"),
		).toHaveLength(FIELD_FIGURES.length);
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
	it("stands each opposed pair at 180° across the inner ring, READ OFF THE DOM", () => {
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
		// ⚠ WARLI-2 RE-HOMED THE PAIRS. In WARLI-1 each opposition straddled the
		// two rings, so "facing its opposite" meant "across the gap". Now both
		// members stand on the SAME ring, four indices apart on a ring of eight —
		// which is what makes "at 180° across the ring" a literally true sentence
		// and G1 a checkable one. The assertion below is therefore about BEARING,
		// not about radius: the two must sit at opposite points of one circle.
		const { container } = render(<WarliHero />);

		for (const [i, pair] of OPPOSED_PAIRS.entries()) {
			const [a, b] = pair;
			const first = readTransform(
				container.querySelector(
					`[data-warli-ring="inner"] [data-warli-id="${a.id}"]`,
				),
			);
			const second = readTransform(
				container.querySelector(
					`[data-warli-ring="inner"] [data-warli-id="${b.id}"]`,
				),
			);
			if (first === null || second === null) {
				throw new Error(`pair ${i} did not render a parsable transform`);
			}

			// Diametrically opposite, to within a degree (G1).
			//
			// ⚠ I WROTE THIS ARITHMETIC WRONG FIRST TIME and it reddened against a
			// correct composition: `((b − a + 540) % 360) − 180` maps a perfect
			// 180° separation to −180, so `Math.abs` gave 180 and the assertion
			// read "expected 180 to be less than 1". Normalise the separation into
			// [0, 360) FIRST, then measure its distance from 180. Worth keeping,
			// because a hand-computed expectation disagreeing with the code is
			// supposed to fail in exactly this direction — it does not care which
			// of the two is wrong, and this time it was me.
			const separation =
				(((clockAngle(second.x, second.y) - clockAngle(first.x, first.y)) %
					360) +
					360) %
				360;
			expect(Math.abs(separation - 180)).toBeLessThan(1);
			// Both on the inner ring's own radius.
			expect(Math.hypot(first.x, first.y)).toBeCloseTo(R_INNER, 3);
			expect(Math.hypot(second.x, second.y)).toBeCloseTo(R_INNER, 3);
			// And both faced — these eight are the only faces in the piece.
			expect(a.face).toBeDefined();
			expect(b.face).toBeDefined();
		}

		// The outer ring still faces the inner one across the gap, which is the
		// half-turn relationship WARLI-1 pinned and WARLI-2 keeps.
		const innerFirst = readTransform(
			container.querySelector(
				`[data-warli-ring="inner"] [data-warli-id="${INNER_FIGURES[0]?.id}"]`,
			),
		);
		const outerFirst = readTransform(
			container.querySelector(
				`[data-warli-ring="outer"] [data-warli-id="${OUTER_FIGURES[0]?.id}"]`,
			),
		);
		expect(outerFirst?.rotate ?? 0).toBe((innerFirst?.rotate ?? 0) + 180);
		expect(Math.hypot(outerFirst?.x ?? 0, outerFirst?.y ?? 0)).toBeCloseTo(
			R_OUTER,
			3,
		);
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
		// ⚠ THE OUTER RING'S FIRST FIGURE IS NOW `speaker`, NOT `labourer`.
		// WARLI-2 moved labourer to the inner ring so it could sit opposite the
		// scholar at 180°. The transform literal is unchanged — index 0 at phase
		// 22.5 on radius 470 is the same point whoever is standing there — which
		// is exactly why this selector had to be corrected by hand rather than
		// caught by the number: the assertion would have kept passing if the outer
		// ring had twelve figures and this one happened to still be at index 0.
		expect(
			container
				.querySelector(
					'[data-warli-ring="outer"] [data-warli-id="warli-speaker"]',
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
		//
		// ⚠ ASSERTED INSIDE ITS RULE, not as a count. A bare count over the whole
		// stylesheet is positionally blind: it stays green if both declarations are
		// moved into a rule where they do nothing. Same for the pause, which has to
		// be inside the engaged selector to mean anything.
		expect(css).toContain(".warli-spin {\n\ttransform-origin: 0 0;");
		expect(css).toContain(".warli-nudge {\n\ttransform-origin: 0 0;");
		expect(css).toContain(
			'.warli-root[data-warli-engaged="true"] .warli-spin { animation-play-state: paused; }',
		);
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

	it("pairs the four oppositions across the inner ring, without drift", () => {
		expect(OPPOSED_PAIRS).toHaveLength(4);
		expect(OPPOSED_PAIRS.map(([a, b]) => `${a.label}/${b.label}`)).toEqual([
			"scholar/labourer",
			"soldier/student",
			"priest/scientist",
			"merchant/farmer",
		]);
	});
});

describe("warli hero — the registers", () => {
	it("declares fifty-six primitives with unique ids and real boxes", () => {
		expect(PRIMITIVE_SPECS).toHaveLength(56);
		expect(new Set(PRIMITIVE_SPECS.map((s) => s.id)).size).toBe(56);
		for (const spec of PRIMITIVE_SPECS) {
			expect(spec.id.startsWith("warli-")).toBe(true);
			expect(spec.box.width).toBeGreaterThan(0);
			expect(spec.box.height).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(spec.origin.x)).toBe(true);
			expect(Number.isFinite(spec.origin.y)).toBe(true);
		}
	});

	it("gives the loud ring a solid body and a ground the quiet one lacks", () => {
		// ⚠ THE REGISTERS WENT FROM TWO TO THREE AT WARLI-2, and the inner ring
		// moved from `dense` to `solid` — its torsos are filled with ink and the
		// ornament is cut back out of them in ground, rather than being hatched.
		// So the inner ring now carries ZERO hatch, which reads like a regression
		// unless you know that. The property that actually distinguishes the rings
		// is unchanged: the loud one stands on a drawn ground and is filled, the
		// quiet one is bare outline on nothing.
		const { container } = render(<WarliHero />);
		const innerRing = container.querySelector('[data-warli-ring="inner"]');
		const outerRing = container.querySelector('[data-warli-ring="outer"]');

		expect(
			innerRing?.querySelectorAll('[data-warli-register="solid"]'),
		).toHaveLength(INNER_FIGURES.length);
		expect(
			outerRing?.querySelectorAll('[data-warli-register="spare"]'),
		).toHaveLength(OUTER_FIGURES.length);
		expect(innerRing?.querySelector("[data-warli-ring-ground]")).not.toBeNull();
		expect(outerRing?.querySelector("[data-warli-ring-ground]")).toBeNull();

		// The ornament on a solid body must be RESERVED — drawn in ground colour,
		// not ink. Without the class it is ink on ink and silently invisible: the
		// figures would render as plain solids and nothing would fail.
		const reserved = innerRing?.querySelectorAll(
			'[data-warli-id="warli-ornament"].warli-reserve',
		);
		expect(reserved).toHaveLength(INNER_FIGURES.length);
		// …and on an open body it must NOT be, or it would vanish into the ground.
		expect(
			outerRing?.querySelectorAll(
				'[data-warli-id="warli-ornament"].warli-reserve',
			),
		).toHaveLength(0);
	});

	it("attaches the hand chain where the hand is actually DRAWN", () => {
		// ⚠ MINTED BY A REAL DEFECT, and it is worth stating what it looked like,
		// because it was invisible to every other assertion in this file.
		//
		// A figure's `pose` is BODY space — it is consumed inside the body's own
		// `<g transform="scale(k)">`. A figure's declared hand anchors are FIGURE
		// space, because the ring engine consumes them after that group. For the
		// fifteen figures at k = 1 the two are identical, so nothing distinguishes
		// them. For the child at k = 0.62 they are not, and its anchors were
		// pre-scaled in the pose AND scaled again by the group: hands DRAWN at
		// (±7.688, −15.376) while the chain attached at (±12.4, −24.8). A gap of
		// 10.536 units — 29% of the child's height — with both link arcs ending in
		// mid-air beside a hand that was somewhere else.
		//
		// Counting `<g>` elements cannot see this. Reading the drawn endpoint can.
		const { container } = render(<WarliHero />);

		for (const spec of ALL_FIGURES) {
			const node = container.querySelector(`[data-warli-id="${spec.id}"]`);
			const arms = node?.querySelector(
				'[data-warli-arms="straight"], [data-warli-arms="bent"]',
			);
			// ⚠ READS A `<path>`, NOT A `<line>`, SINCE WARLI-2 SLICE 2. Every
			// straight run in this layer is now a bowed quadratic
			// (`primitives/wobble.ts`), so the arm is `M x1 y1 Q cx cy x2 y2` and
			// there is no `x2` attribute left to read.
			//
			// ⛔ THE ASSERTION IS NOT WEAKENED BY THAT, AND IT MATTERS THAT IT IS NOT:
			// the wobble was built to move the MIDDLE of a segment and never its
			// endpoints, precisely so this guard keeps meaning what it meant. The
			// last coordinate pair of the `d` string is the same number the old `x2`
			// carried, exactly — not approximately — and if a later change ever bows
			// an endpoint, this reads the moved one and reds. Loosening it to a
			// tolerance would have hidden the one defect it exists to catch.
			const runs = [...(arms?.querySelectorAll("path") ?? [])];
			if (runs.length === 0) {
				throw new Error(`${spec.id} drew no arms`);
			}
			const k = spec.pose.scale ?? 1;
			// The hand is the far end of the LAST segment of each arm: one segment
			// per arm when straight, two when bent through an elbow.
			const perArm = runs.length / 2;
			const leftHand = runs[perArm - 1];
			const rightHand = runs[runs.length - 1];
			const endpointOf = (run: Element | undefined) => {
				const nums = (run?.getAttribute("d") ?? "")
					.match(/-?\d+(?:\.\d+)?/g)
					?.map(Number);
				if (nums === undefined || nums.length < 2) {
					throw new Error(`${spec.id}: unparsable arm path`);
				}
				return {
					x: (nums[nums.length - 2] as number) * k,
					y: (nums[nums.length - 1] as number) * k,
				};
			};
			const drawn = endpointOf;

			expect(drawn(leftHand).x).toBeCloseTo(spec.handLeft.x, 6);
			expect(drawn(leftHand).y).toBeCloseTo(spec.handLeft.y, 6);
			expect(drawn(rightHand).x).toBeCloseTo(spec.handRight.x, 6);
			expect(drawn(rightHand).y).toBeCloseTo(spec.handRight.y, 6);

			// ⚠ CONSISTENCY IS NOT ENOUGH, and finding that out cost a surviving
			// mutant. Pre-scaling the pose AND scaling the anchor keeps the two in
			// perfect agreement — both land on −7.688 — while the arm is drawn 38%
			// too short and the child stops being the same drawing as everyone
			// else. The assertions above cannot see that, because they only ask
			// whether the chain finds the hand.
			//
			// So: in BODY space every figure reaches the same distance out. That is
			// the "sixteen bodies, one build" thesis expressed as a number, and it
			// is what a scale applied in the wrong place destroys.
			expect(Math.abs(spec.pose.handLeft.x)).toBeGreaterThanOrEqual(HAND_X - 1);
			expect(Math.abs(spec.pose.handRight.x)).toBeGreaterThanOrEqual(
				HAND_X - 1,
			);
		}

		// And the child's FIGURE-space anchors are exactly the shared reach taken
		// down by its own scale — stated once, so the relationship is pinned rather
		// than inferred from the loop above.
		const child = ALL_FIGURES.find((f) => f.label === "child");
		const k = child?.pose.scale ?? 1;
		expect(k).toBeLessThan(1);
		expect(child?.handLeft.x).toBeCloseTo(DEFAULT_POSE.handLeft.x * k, 9);
		expect(child?.handLeft.y).toBeCloseTo(DEFAULT_POSE.handLeft.y * k, 9);
	});

	it("places the field motifs where each register needs them", () => {
		// ⚠ THE ONE MEASURED HOLE LEFT AFTER THE FIRST REVIEW. Flipping the dense
		// lift's sign, or rotating the spare field by a half turn, both passed the
		// entire suite — and the second of those is the exact defect `ring.tsx`
		// records as having been made once already: the outer ring's landscape
		// inherited the figures' facing and grew INTO the confrontation band, so
		// the one place the eye should go was the busiest place in the drawing.
		// A defect the source describes as previously made deserves a guard, not a
		// paragraph.
		//
		// First interstitial angle is 45° (half a step past the 22.5° phase).
		//   dense: lifted OUTWARD to 330 + 26 = 356 → (356·sin45, −356·cos45)
		//   spare: on its baseline at 470          → (470·sin45, −470·cos45)
		// and BOTH rotate by the bare angle — the spare field turns away from the
		// gap, not with its figures.
		const { container } = render(<WarliHero />);
		const first = (ring: string) =>
			container
				.querySelector(
					`[data-warli-ring="${ring}"] [data-warli-ring-field] > g`,
				)
				?.firstElementChild?.getAttribute("transform");

		expect(first("inner")).toBe("translate(251.73 -251.73) rotate(45)");

		// ⚠ THE OUTER RING NO LONGER HAS A FIELD AT ALL, and that is a fix rather
		// than a loss. Its motifs grew OUTWARD from a baseline at radius 470 in a
		// frame whose half-height is 500, so the fringe reached 496 and drew
		// straight through the border stack. It existed because the area outside
		// the rings was empty; the static field now fills that with actual scenery.
		expect(first("outer")).toBeUndefined();
	});

	it("keeps every figure the same drawing — forty-eight bodies, one build", () => {
		// If a later change gives one figure its own construction, this reddens.
		// The thesis is that everyone here is the same shape and differs only in
		// what they carry and how they are dressed, so a bespoke body would
		// reverse the argument while looking like a styling tweak.
		const { container } = render(<WarliHero />);
		expect(container.querySelectorAll("[data-warli-figure-body]")).toHaveLength(
			ALL_FIGURES.length,
		);
		expect(
			container.querySelectorAll('[data-warli-id="warli-torso"]'),
		).toHaveLength(ALL_FIGURES.length);
		// Everyone who carries something renders exactly one held object.
		expect(container.querySelectorAll("[data-warli-hold]")).toHaveLength(
			ALL_FIGURES.filter((f) => f.prop !== "none").length,
		);
		// And a real minority are told apart by pose and ornament alone — if this
		// ever reached zero, identity would rest entirely on objects, which is a
		// smaller idea than the one the piece is making.
		expect(
			ALL_FIGURES.filter((f) => f.prop === "none").length,
		).toBeGreaterThanOrEqual(8);
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

		// Centre (720, 500); pointer straight UP, so the angle is exactly 0° with no
		// trigonometry and therefore no floating-point error at all. The nearest
		// pair rests at 22.5°, so both rings turn −22.5° to bring it under the
		// pointer.
		//
		// ⚠ AN EARLIER VERSION USED 30° VIA (920, 153.5898), which computes to
		// 29.999997° and lands 5e-4 below the `"7.499"` rounding boundary — about
		// 0.0035 px of headroom on `clientY`. It passed, and it would have broken
		// on any tidy-up of that literal. A test whose correctness depends on the
		// fourth decimal of an input nobody thinks of as precise is a trap.
		svg.dispatchEvent(
			new MouseEvent("pointermove", { clientX: 720, clientY: 100 }),
		);
		expect(
			[...container.querySelectorAll(".warli-nudge")].map((n) =>
				(n as SVGGElement).style.getPropertyValue("--warli-nudge"),
			),
		).toEqual(["-22.500deg", "-22.500deg"]);

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
		// ⚠ I FIRST WROTE 45 AND 22.5 HERE, and the test reddened. At settledAt = 0
		// the figures rest at 22.5 / 67.5 / 112.5, so a pointer at 90° is EXACTLY
		// 22.5° from both neighbours — a tie, broken by `Math.round`'s half-up rule
		// (toward +∞, so `Math.round(-1.5)` is −1). It is not a snap past a nearer
		// figure; there is no nearer figure. The code was right and my arithmetic
		// was wrong, which is the direction a hand-computed expectation is supposed
		// to fail in: it disagrees with the implementation until one of them is
		// fixed, and it does not care which.
		expect(
			nudgeFor({ innerPhase: 40, outerPhase: -40, pointerDeg: 90 }),
		).toEqual({ inner: -62.5, outer: 17.5 });

		// Aligned rings need no split at all — only the turn to the pointer.
		expect(
			nudgeFor({ innerPhase: 12, outerPhase: 12, pointerDeg: 34.5 }),
		).toEqual({ inner: 0, outer: 0 });

		// The nudges always differ by exactly the misalignment. ⚠ BE HONEST ABOUT
		// WHAT THIS CATCHES: `toPointer`, `nearest`, `phaseDeg` and `stepDeg` all
		// cancel in the subtraction, so this is an algebraic identity of the two
		// return lines and it can only fail if the ± symmetry itself breaks. It
		// caught the split being made one-sided; it is blind to everything else in
		// the function. The three literal cases above catch the rest, and removing
		// `nearest` entirely reddens case 2, not this loop.
		for (const [i, o, p] of [
			[0, 0, 0],
			[130, -130, 200],
			[-17.5, 91.25, 305],
		] as const) {
			const n = nudgeFor({ innerPhase: i, outerPhase: o, pointerDeg: p });
			expect(n.inner - n.outer).toBeCloseTo(wrapSigned(o - i), 9);
		}
	});

	it("reads a rotation back out of a computed matrix, and fails safe", () => {
		// THE LAST UNTESTED LINK IN THE POINTER CHAIN. `nudgeFor` covers what
		// happens after the ring phases are known; this is how they become known.
		// Its regex, its `atan2(b, a)` and its three early returns could every one
		// of them yield garbage in a real browser with the whole suite green,
		// because nothing else exercises them.
		const el = document.createElement("div");
		document.body.appendChild(el);

		// A CSS `rotate(θ)` serialises as matrix(cos, sin, −sin, cos, 0, 0), so a
		// quarter turn is matrix(0, 1, −1, 0, 0, 0) — read back as +90°.
		el.style.transform = "matrix(0, 1, -1, 0, 0, 0)";
		expect(currentRotationDeg(el)).toBeCloseTo(90, 9);

		el.style.transform = "matrix(-1, 0, 0, -1, 0, 0)";
		expect(currentRotationDeg(el)).toBeCloseTo(180, 9);

		// √2/2 both terms — an eighth turn, and a value with no exact float.
		el.style.transform =
			"matrix(0.7071067811865476, 0.7071067811865476, -0.7071067811865476, 0.7071067811865476, 0, 0)";
		expect(currentRotationDeg(el)).toBeCloseTo(45, 9);

		// FAILS SAFE, in all four ways it can be asked something meaningless. Zero
		// is the right answer for every one: an unrotated ring.
		expect(currentRotationDeg(null)).toBe(0);
		el.style.transform = "none";
		expect(currentRotationDeg(el)).toBe(0);
		el.style.transform = "";
		expect(currentRotationDeg(el)).toBe(0);
		el.style.transform = "translate(3px, 4px)";
		expect(currentRotationDeg(el)).toBe(0);

		el.remove();
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
