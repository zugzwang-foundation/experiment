// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	FIELD_FIGURE_COUNT,
	GROUND_MARK_COUNT,
	MOTIF_COUNT,
	MOTIF_RENDERERS,
} from "@/components/art/warli/field-layer";
import {
	ALL_FIGURES,
	FACED_SCALE,
	FIELD_FIGURES,
	FIGURE_BOX,
	INNER_FIGURES,
	OPPOSED_PAIRS,
	OUTER_FIGURES,
} from "@/components/art/warli/figures";
import {
	FIELD_ASSET_HREF,
	R_INNER,
	R_OUTER,
	WarliHero,
} from "@/components/art/warli/hero";
import {
	BORDER_DEPTH,
	ORNAMENT_COMBINATIONS,
} from "@/components/art/warli/primitives";
import {
	BORDER_INSET,
	buildFieldScene,
	CENTRE,
	FRAME,
	groundAcceptanceByColumn,
	inkByColumn,
	meridian,
	RING_CLEAR,
	SCENE_MOTIFS,
} from "@/components/art/warli/scene";

import { WarliComposition } from "./_composition";

/**
 * WARLI-2 §5 — the four semantic guards, G1 to G4.
 *
 * ⚠ AND THE HONEST LIMIT, STATED WHERE IT WILL BE READ RATHER THAN IN A REPORT
 * NOBODY OPENS AGAIN: none of these prove the picture LOOKS like a debate. They
 * prove it is STRUCTURED like one. Whether that adds up to a composition worth
 * looking at is a question only the standalone preview can answer, and only a
 * person can answer it. Green here must never be reported as "the composition
 * works".
 *
 * ⚠ EVERY SCENE ASSERTION BUILDS THE SCENE THROUGH `buildFieldScene`, THE SAME
 * FUNCTION THE COMPONENT CALLS, and that is not a stylistic preference — it is a
 * defect this file already committed once. The guards used to re-derive their own
 * population from literal counts, which meant the entire motif layer, the entire
 * ground layer and the whole border stack could be deleted from the render with
 * every assertion still green: the guard was grading a scene the component was
 * under no obligation to draw. Anything asserted about the drawing is therefore
 * read from the DOM, and anything asserted about the placement comes from the
 * shared builder.
 */

const clockAngle = (x: number, y: number) =>
	(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) % 360;

/** Every number in a path `d`, in order. */
const numbersIn = (d: string): number[] =>
	(d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/* ------------------------------------------------------------------ *
 * G0 · the drawing is actually drawn by hand
 * ------------------------------------------------------------------ */

describe("G0 · the RENDERED drawing carries the wobble", () => {
	/**
	 * ⚠ THIS BLOCK EXISTS BECAUSE `wobble.test.ts` PROVED THE MODULE AND NOTHING
	 * PROVED THE PICTURE. Its docblock names the two likeliest failures — a clamp
	 * returning zero, and a seed threaded as a constant — and kills the first
	 * inside the module. The second, and a third nobody had considered (the three
	 * drawing verbs simply not CALLING the module), were live: `Run` could emit
	 * `M x1 y1 L x2 y2`, all three verbs could go machine-true, and the entire
	 * suite stayed green. 2,880 of 2,971 rendered paths carry a `Q` and no
	 * assertion in the repository read one.
	 *
	 * A module can be perfectly tested and reach nothing. These assertions read
	 * the drawing.
	 */
	const rendered = () => {
		const { container } = render(<WarliComposition />);
		const ds = [...container.querySelectorAll("path")]
			.map((p) => p.getAttribute("d") ?? "")
			.filter((d) => d.length > 0);
		return { container, ds };
	};

	/** Signed perpendicular departure of a one-`Q` path, or `null`. */
	const departureOf = (d: string): number | null => {
		const m = d.match(
			/^M (-?[\d.]+) (-?[\d.]+) Q (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/,
		);
		if (m === null) {
			return null;
		}
		const [x1, y1, cx, cy, x2, y2] = m.slice(1).map(Number) as number[];
		const len = Math.hypot((x2 ?? 0) - (x1 ?? 0), (y2 ?? 0) - (y1 ?? 0));
		if (len === 0) {
			return null;
		}
		const nx = -((y2 ?? 0) - (y1 ?? 0)) / len;
		const ny = ((x2 ?? 0) - (x1 ?? 0)) / len;
		return (
			((cx ?? 0) - ((x1 ?? 0) + (x2 ?? 0)) / 2) * nx +
			((cy ?? 0) - ((y1 ?? 0) + (y2 ?? 0)) / 2) * ny
		);
	};

	const departuresIn = (root: HTMLElement, selector: string): number[] =>
		[...root.querySelectorAll(selector)]
			.map((p) => departureOf(p.getAttribute("d") ?? ""))
			.filter((v): v is number => v !== null);

	it("draws the overwhelming majority of its runs as CURVES, not lines", () => {
		const { ds } = rendered();
		expect(ds.length).toBeGreaterThan(2000);
		const curved = ds.filter((d) => d.includes("Q"));
		// Straight `L`/`A` output from any of the three verbs collapses this.
		expect(curved.length / ds.length).toBeGreaterThan(0.8);
	});

	it("gives different marks DIFFERENT hands, not one bow repeated", () => {
		// The signed perpendicular departure of each quadratic's control point from
		// its own chord midpoint. A dead wobble makes every one of these 0; a
		// constant seed makes them all equal. Both are caught here and neither is
		// caught anywhere else.
		const departures: number[] = [];
		/** Departures grouped by chord length, rounded to the unit. */
		const byLength = new Map<number, number[]>();
		const { container, ds: allDs } = rendered();
		for (const d of allDs) {
			const m = d.match(
				/^M (-?[\d.]+) (-?[\d.]+) Q (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/,
			);
			if (m === null) {
				continue;
			}
			const [x1, y1, cx, cy, x2, y2] = m.slice(1).map(Number) as [
				number,
				number,
				number,
				number,
				number,
				number,
			];
			const len = Math.hypot(x2 - x1, y2 - y1);
			if (len === 0) {
				continue;
			}
			// Perpendicular component of (control − midpoint) about the chord.
			const nx = -(y2 - y1) / len;
			const ny = (x2 - x1) / len;
			const dev = (cx - (x1 + x2) / 2) * nx + (cy - (y1 + y2) / 2) * ny;
			departures.push(dev);
			const bucket = Math.round(len);
			byLength.set(bucket, [...(byLength.get(bucket) ?? []), dev]);
		}

		expect(departures.length).toBeGreaterThan(500);
		// Actually bowed, not merely curve-shaped.
		const moved = departures.filter((v) => Math.abs(v) > 0.05);
		expect(moved.length / departures.length).toBeGreaterThan(0.9);
		// Bowing BOTH ways — a constant offset would be one-signed.
		expect(departures.some((v) => v > 0.05)).toBe(true);
		expect(departures.some((v) => v < -0.05)).toBe(true);
		// And genuinely various, which one shared seed is not.
		expect(new Set(departures.map((v) => v.toFixed(2))).size).toBeGreaterThan(
			80,
		);

		// ⚠ THE ASSERTION ABOVE IS NOT ENOUGH, AND A MUTANT PROVED IT. Threading a
		// CONSTANT seed into `Run` survived every check to this point, because the
		// bow is `amplitudeFor(length) × noise(seed)` — with the seed pinned, the
		// departures still vary, purely because the runs have different lengths. The
		// distribution looked healthy and every mark was in fact drawn by the same
		// hand in the same direction.
		//
		// ⚠ AND WHERE IT IS ASSERTED MATTERS AS MUCH AS WHAT, WHICH A SECOND MUTANT
		// TAUGHT ME. Whole-drawing spread does NOT catch a pinned seed: `Limb`,
		// `Head` and `Torso` call `bowedLine`/`bowedPath` DIRECTLY rather than
		// through the three verbs, so pinning `Run`'s seed leaves every FIGURE
		// correctly drawn while the border, the ornament and the field motifs all go
		// dead-handed — and the figures' healthy distribution masks the half of the
		// drawing that stopped varying. Bucketing by rounded length does not help
		// either, because `amplitudeFor` is continuous in length, so a bucket spans
		// many amplitudes even at one seed.
		//
		// The border's hatch bar is the discriminator. Every one of its diagonals is
		// drawn through `Run`, and they are all EXACTLY the same length — so under
		// real seeding they bow by different amounts in both directions, and under
		// ANY constant seed they collapse to a single value.
		const hatch = departuresIn(
			container,
			'[data-warli-border-row="hatch"] path',
		);
		expect(hatch.length).toBeGreaterThan(100);
		expect(new Set(hatch.map((v) => v.toFixed(3))).size).toBeGreaterThan(20);
		expect(hatch.some((v) => v > 0)).toBe(true);
		expect(hatch.some((v) => v < 0)).toBe(true);
		expect(byLength.size).toBeGreaterThan(5);
	});
});

/* ------------------------------------------------------------------ *
 * G1 · the opposed pairs really are opposite
 * ------------------------------------------------------------------ */

describe("G1 · each faced figure's opposite sits at 180° across the ring", () => {
	const bearingOf = (container: HTMLElement, id: string) => {
		const t = container
			.querySelector(`[data-warli-ring="inner"] [data-warli-id="${id}"]`)
			?.getAttribute("transform");
		const m = t?.match(/^translate\((-?[\d.]+) (-?[\d.]+)\)/);
		if (m?.[1] === undefined || m[2] === undefined) {
			throw new Error(`${id} is not on the inner ring`);
		}
		return clockAngle(Number(m[1]), Number(m[2]));
	};

	it("puts every pair within 1° of a half turn apart", () => {
		// REJECTS: a pairing that walks adjacent indices instead of opposite ones.
		// Proven by reversal — `INNER_FIGURES[i + 1]` reddens this and two
		// assertions in `warli-render.test.tsx`.
		//
		// ⚠ AND HERE IS WHAT IT CANNOT CATCH, WHICH MATTERS MORE THAN WHAT IT CAN.
		// Both the pairing and the placement derive from the SAME index, so on an
		// evenly-spaced ring of eight, entry `i` and entry `i + 4` are 180° apart no
		// matter WHO is standing there. Swap two labels in `INNER_FIGURES` and the
		// scholar ends up opposite the student — the argument is now between the
		// wrong people — and every assertion in this block stays green.
		//
		// That hole is closed elsewhere, deliberately: the literal label list in
		// `warli-render.test.tsx` is what pins WHO faces WHOM, and it is the SOLE
		// guard on it. This test pins the GEOMETRY. Neither is sufficient alone.
		const { container } = render(<WarliHero />);
		expect(OPPOSED_PAIRS.length).toBeGreaterThanOrEqual(4);
		for (const [a, b] of OPPOSED_PAIRS) {
			const sep =
				(((bearingOf(container, b.id) - bearingOf(container, a.id)) % 360) +
					360) %
				360;
			expect(Math.abs(sep - 180)).toBeLessThan(1);
		}
	});

	it("positive control: a same-ring NON-pair is not 180° apart", () => {
		// Without this, the assertion above would pass just as happily against a
		// ring on which EVERY figure is 180° from every other.
		const { container } = render(<WarliHero />);
		const a = INNER_FIGURES[0];
		const notItsOpposite = INNER_FIGURES[1];
		if (a === undefined || notItsOpposite === undefined) {
			throw new Error("inner ring is too short to test");
		}
		const sep =
			(((bearingOf(container, notItsOpposite.id) - bearingOf(container, a.id)) %
				360) +
				360) %
			360;
		expect(Math.abs(sep - 180)).toBeGreaterThan(10);
	});
});

/* ------------------------------------------------------------------ *
 * G2 · the static field faces the centre
 * ------------------------------------------------------------------ */

describe("G2 · every static-field figure faces the centre", () => {
	/**
	 * ⚠ THE LIMIT OF THIS GUARD, STATED PLAINLY. The field's figures stand
	 * UPRIGHT — they are people at work, not a compass rose — so "facing" here is
	 * the horizontal mirror plus a few degrees of lean, not a full bearing. A
	 * figure standing directly above the centre is unconstrained in the way a
	 * bearing test would constrain it, and nothing below pretends otherwise. What
	 * this DOES catch is the defect that would actually happen: a figure in the
	 * left wing turned to face left, out of the picture, in a composition about an
	 * argument nobody leaves.
	 */
	const scene = buildFieldScene({
		figures: FIELD_FIGURE_COUNT,
		motifs: MOTIF_COUNT,
		ground: GROUND_MARK_COUNT,
	});

	it("mirrors every figure toward the centre", () => {
		expect(scene.figures.length).toBe(FIELD_FIGURES.length);
		for (const p of scene.figures) {
			expect(p.mirror * (CENTRE.x - p.x)).toBeGreaterThan(0);
		}
	});

	it("leans every figure the same way it faces", () => {
		// Two independent properties. A composition that got the mirror right and
		// the lean backwards would have every figure facing inward while tipping
		// out of frame, which reads as a crowd being blown away from the subject.
		for (const p of scene.figures) {
			expect(Math.sign(p.leanDeg)).toBe(p.mirror);
			expect(Math.abs(p.leanDeg)).toBeLessThan(6);
		}
	});

	it("puts figures in BOTH wings, so the rule is doing work", () => {
		// ⚠ THIS REPLACES A POSITIVE CONTROL THAT WAS TRUE BY CONSTRUCTION. The old
		// one flipped every mirror and asserted none still pointed inward — which
		// cannot fail unless the assertion above has already failed, and killed
		// exactly zero additional mutants. Its docblock even named an impossible
		// escape (a figure exactly on the centre line), where the product is 0 and
		// the earlier assertion reds first. A control that cannot fire is not a
		// control; what it was reaching for is this: the population must actually
		// straddle the centre, or "faces the centre" is satisfied by everyone
		// standing on one side.
		const left = scene.figures.filter((p) => p.mirror === 1);
		const right = scene.figures.filter((p) => p.mirror === -1);
		expect(left.length).toBeGreaterThanOrEqual(8);
		expect(right.length).toBeGreaterThanOrEqual(8);
	});

	it("renders the mirror AND the lean it computed, all the way to the DOM", () => {
		// ⚠ THE LEAN IS READ HERE NOW. The old regex skipped over `rotate(...)`
		// with `.*`, so zeroing every lean — or giving every figure the same lean
		// regardless of which side it stood on — passed untouched. The placement
		// being right is worth nothing if the renderer drops it.
		const { container } = render(<WarliComposition />);
		const nodes = [...container.querySelectorAll("[data-warli-field-figure]")];
		expect(nodes).toHaveLength(FIELD_FIGURES.length);
		let leaned = 0;
		for (const node of nodes) {
			const t = node.getAttribute("transform") ?? "";
			const m = t.match(
				/^translate\((-?[\d.]+) (-?[\d.]+)\) rotate\((-?[\d.]+)\) scale\((-?[\d.]+)/,
			);
			if (m?.[1] === undefined || m[3] === undefined || m[4] === undefined) {
				throw new Error(`unparsable field-figure transform: ${t}`);
			}
			const x = Number(m[1]);
			const lean = Number(m[3]);
			const signedScale = Number(m[4]);
			expect(Math.sign(signedScale) * (CENTRE.x - x)).toBeGreaterThan(0);
			// The lean leans the same way the figure faces.
			expect(Math.sign(lean)).toBe(Math.sign(signedScale));
			if (Math.abs(lean) > 0.5) {
				leaned++;
			}
		}
		// …and it is a real lean, not a rounded-away zero.
		expect(leaned).toBe(nodes.length);
	});
});

/* ------------------------------------------------------------------ *
 * G3 · the populations are the sizes the piece claims
 * ------------------------------------------------------------------ */

describe("G3 · exactly eight faces, and 45–55 characters in all", () => {
	it("gives a face to the inner ring and to nobody else", () => {
		// REJECTS: faces leaking onto the crowd. The scarcity IS the mechanism.
		expect(ALL_FIGURES.filter((f) => f.face !== undefined)).toHaveLength(8);
		for (const f of INNER_FIGURES) {
			expect(f.face).toBeDefined();
		}
		for (const f of [...OUTER_FIGURES, ...FIELD_FIGURES]) {
			expect(f.face).toBeUndefined();
		}
	});

	it("gives the eight faced figures eight DISTINCT faces", () => {
		const faces = INNER_FIGURES.map((f) => `${f.face?.brow}/${f.face?.mouth}`);
		expect(new Set(faces).size).toBe(8);
	});

	it("draws the faced ring LARGER — the third cue, with count and faces", () => {
		// The plan specifies 1.2×. Count and faces were pinned; scale was not, so
		// flattening it to 1.0 passed. Three cues make the inner ring read as the
		// speaking positions and all three should be held.
		expect(FACED_SCALE).toBeGreaterThan(1.1);
		for (const f of INNER_FIGURES) {
			expect(f.pose.scale).toBeCloseTo(FACED_SCALE, 6);
		}
		for (const f of OUTER_FIGURES) {
			expect(f.pose.scale ?? 1).toBeLessThanOrEqual(1);
		}
	});

	it("draws exactly eight faces in the DOM, on open heads, INSIDE the head", () => {
		const { container } = render(<WarliHero />);
		const faces = [...container.querySelectorAll("[data-warli-face]")];
		expect(faces).toHaveLength(8);
		const headRadius = 6;
		for (const face of faces) {
			// ⚠ ON AN UNFILLED HEAD. A face inside an ink-filled circle is ink on
			// ink: invisible, with every count above still green.
			const head = face.parentElement?.querySelector(
				'[data-warli-id="warli-head"] path',
			);
			expect(head?.getAttribute("fill")).toBe("none");

			// ⚠ AND ACTUALLY IN THE HEAD. Counting faces and checking the head's
			// fill says nothing about WHERE the face was drawn — translating it
			// forty units down the body passed both.
			const coords: number[] = [];
			for (const dot of face.querySelectorAll("circle")) {
				coords.push(
					Math.hypot(
						Number(dot.getAttribute("cx")),
						Number(dot.getAttribute("cy")),
					),
				);
			}
			for (const p of face.querySelectorAll("path")) {
				const n = numbersIn(p.getAttribute("d") ?? "");
				for (let i = 0; i + 1 < n.length; i += 2) {
					coords.push(Math.hypot(n[i] as number, n[i + 1] as number));
				}
			}
			expect(coords.length).toBeGreaterThan(3);
			expect(Math.max(...coords)).toBeLessThan(headRadius * 1.15);
		}
	});

	it("dresses the figures in at least sixteen distinguishable costumes", () => {
		// ⚠ SLICE 3'S EXIT CONDITION, WHICH NOTHING ASSERTED. `ORNAMENT_COMBINATIONS`
		// was an exported constant referenced nowhere in `src/`, `tests/` or
		// `scripts/` — the brief asked for "at least 16 distinguishable
		// combinations" and the only evidence was that the arithmetic looked right.
		// The number that matters is not how many the dials CAN express but how many
		// the roster actually WEARS, so this counts the costumes on the figures.
		expect(ORNAMENT_COMBINATIONS).toBeGreaterThanOrEqual(16);
		const worn = ALL_FIGURES.map(
			(f) =>
				`${f.ornament.skirt}/${f.ornament.torso}/${f.ornament.headdress}/${f.ornament.bangles}`,
		);
		expect(new Set(worn).size).toBeGreaterThanOrEqual(16);
		// …and no single costume dominates, which 16 distinct sets would still allow
		// if thirty figures shared one of them.
		const counts = new Map<string, number>();
		for (const w of worn) {
			counts.set(w, (counts.get(w) ?? 0) + 1);
		}
		expect(Math.max(...counts.values())).toBeLessThanOrEqual(5);
	});

	it("holds the total character count inside the stated band", () => {
		expect(ALL_FIGURES.length).toBeGreaterThanOrEqual(45);
		expect(ALL_FIGURES.length).toBeLessThanOrEqual(55);
		expect(INNER_FIGURES).toHaveLength(8);
		expect(OUTER_FIGURES).toHaveLength(12);
		expect(FIELD_FIGURES).toHaveLength(28);
	});

	it("renders every declared character, not merely declares them", () => {
		const { container } = render(<WarliComposition />);
		expect(container.querySelectorAll("[data-warli-figure-body]")).toHaveLength(
			ALL_FIGURES.length,
		);
	});
});

/* ------------------------------------------------------------------ *
 * G4 · the density meridian exists, and is a gradient
 * ------------------------------------------------------------------ */

describe("G4 · ink falls from left to right, as a gradient and not a step", () => {
	const scene = buildFieldScene({
		figures: FIELD_FIGURE_COUNT,
		motifs: MOTIF_COUNT,
		ground: GROUND_MARK_COUNT,
	});

	it("carries more ink on the left half than the right, inside a measured band", () => {
		// ⚠ THE FIELD FIGURES ARE COUNTED HERE TOO. They were omitted, which left
		// the heaviest marks in the field outside the only measure of it — and
		// inverting their spacing meridian, so people crowd the OPEN half, passed.
		const halves = inkByColumn(2, [
			...scene.ground,
			...scene.motifs,
			...scene.figures,
		]);
		const [left, right] = halves;
		if (left === undefined || right === undefined) {
			throw new Error("expected two halves");
		}
		const ratio = left / right;
		// MEASURED. The band is set around the measurement rather than picked and
		// hoped for. ⚠ The UPPER bound does real work: the first build ran the
		// accept probability 0.93 → 0.07 and measured 4.7 : 1, which is not a
		// gradient but a wall with a populated side. Too STRONG fails this brief as
		// surely as absent.
		expect(ratio).toBeGreaterThan(1.35);
		expect(ratio).toBeLessThan(2.2);
	});

	it("accepts far fewer marks on the open side — measured on the engine's own stream", () => {
		// ⚠ THIS REPLACES A NORMALISED-INK MEASURE THAT WAS OVER-FITTED TO THE SCAN
		// SEED, and a mutation review caught it by RESEEDING rather than by reading.
		// Binning placed marks by x and dividing by a separately-sampled estimate of
		// admissible area put ~5 % of the ink in each of the two middle buckets —
		// fifteen to twenty marks — so moving two motifs flipped the verdict, and
		// changing the lattice stride from 439 to 443, which touches no meridian
		// coefficient at all, reddened it. A guard a pure reordering can flip is
		// measuring the seed, not the gradient.
		//
		// This asks the engine's own question: of the candidates ADMISSIBLE in this
		// column, what fraction did the meridian accept? Numerator and denominator
		// come from one walk of one stream, so there is no sampling mismatch, and
		// the answer is a property of `meridian()` rather than of visit order.
		// ⚠ TWO COLUMNS, AND THE REASON IS STRUCTURAL RATHER THAN A CLIMBDOWN FROM
		// FOUR. Measured at every granularity from 3 to 12, the acceptance rate is
		// FLAT inside each wing — about 0.89 on the left, about 0.48 on the right —
		// and falls between them. That is not a broken meridian; it is a smoothstep
		// doing exactly what a smoothstep does. Its slope is ZERO at both ends and
		// maximal in the middle, and the middle of this frame is the ring, where
		// nothing is placed. **The meridian's whole transition is occluded by the
		// artwork.**
		//
		// So the placed marks CANNOT demonstrate gradient-versus-step, and a
		// partition that pretends otherwise just measures whichever few dozen cells
		// squeeze past the ring at top and bottom — at four columns the middle
		// buckets hold 62 and 65 cells against 902 in the wings. The honest split is
		// this assertion for what the marks DO show, and the separate test below for
		// the gradient property, which lives in the function and is checked there.
		const cols = groundAcceptanceByColumn(2);
		for (const c of cols) {
			expect(c.admissible).toBeGreaterThan(400);
		}
		const rate = cols.map((c) => c.accepted / c.admissible);
		// MEASURED: 0.8859 → 0.4804.
		expect(rate[0] ?? 0).toBeGreaterThan(rate[1] ?? 1);
		expect((rate[0] ?? 0) - (rate[1] ?? 0)).toBeGreaterThan(0.2);
		// …and neither side is degenerate: the open half is thinned, not emptied,
		// and the dense half is not simply everything.
		expect(rate[1] ?? 0).toBeGreaterThan(0.25);
		expect(rate[0] ?? 1).toBeLessThan(0.98);
	});

	it("is a GRADIENT and not a step — asserted on the function, where the transition lives", () => {
		// ⚠ THIS IS THE "not a step" HALF OF G4, AND IT HAD TO MOVE HERE. It used to
		// be asserted over binned marks, which cannot see it: the marks sit in two
		// wings and the ramp between them is behind the rings. Asserting it on the
		// function is not a weaker claim — it is the same claim, checked where the
		// property actually exists, and it is what decides the density of every one
		// of the 330 ground marks.
		//
		// A step function concentrates its whole fall into one narrow band of x. A
		// smoothstep spreads it: across the middle 10 % of the frame it gives up
		// about 15 % of its total range. Asserting that no 10 % band takes more than
		// 40 % is comfortably true of a gradient and impossible for a step.
		const samples = 200;
		const at = (i: number) => meridian((i / samples) * FRAME.width);
		const total = at(0) - at(samples);
		expect(total).toBeGreaterThan(0.9);

		const band = Math.round(samples * 0.1);
		let worst = 0;
		for (let i = 0; i + band <= samples; i++) {
			worst = Math.max(worst, at(i) - at(i + band));
		}
		expect(worst / total).toBeLessThan(0.4);

		// POSITIVE CONTROL: a step at the midline fails the very same measurement,
		// so the bound above is discriminating rather than merely satisfiable.
		const step = (x: number) => (x < FRAME.width / 2 ? 1 : 0);
		const stepAt = (i: number) => step((i / samples) * FRAME.width);
		let stepWorst = 0;
		for (let i = 0; i + band <= samples; i++) {
			stepWorst = Math.max(stepWorst, stepAt(i) - stepAt(i + band));
		}
		expect(stepWorst / (stepAt(0) - stepAt(samples))).toBeGreaterThan(0.9);
	});

	it("positive control: a flat composition fails the ratio assertion", () => {
		const flat = Array.from({ length: 400 }, (_, i) => ({
			x: (i / 400) * FRAME.width,
			scale: 1,
		}));
		const halves = inkByColumn(2, flat);
		expect((halves[0] ?? 0) / (halves[1] ?? 1)).toBeLessThan(1.35);
	});

	it("keeps the meridian smooth at both edges", () => {
		// A smoothstep has zero slope at 0 and 1, which is what stops the ramp
		// being visible AS a ramp at the frame's edges.
		expect(meridian(0)).toBeCloseTo(1, 6);
		expect(meridian(FRAME.width)).toBeCloseTo(0, 6);
		expect(meridian(FRAME.width / 2)).toBeCloseTo(0.5, 6);
		let prev = Number.POSITIVE_INFINITY;
		for (let x = 0; x <= FRAME.width; x += 40) {
			const m = meridian(x);
			expect(m).toBeLessThanOrEqual(prev);
			prev = m;
		}
	});
});

/* ------------------------------------------------------------------ *
 * The scene engine's contract, and the drawing's obligation to it
 * ------------------------------------------------------------------ */

describe("the scene engine places without collisions or overruns", () => {
	const scene = buildFieldScene({
		figures: FIELD_FIGURE_COUNT,
		motifs: MOTIF_COUNT,
		ground: GROUND_MARK_COUNT,
	});

	it("places the counts it was asked for", () => {
		expect(scene.figures).toHaveLength(FIELD_FIGURE_COUNT);
		expect(scene.motifs).toHaveLength(MOTIF_COUNT);
		expect(scene.ground).toHaveLength(GROUND_MARK_COUNT);
		// The figure count is DERIVED from the roster, so it cannot exceed it and
		// silently render `null` for the surplus while still claiming their ground.
		expect(FIELD_FIGURE_COUNT).toBe(FIELD_FIGURES.length);
	});

	it("keeps every figure clear of the ring the CROWD actually walks", () => {
		// ⚠ ASSERTED AGAINST `R_OUTER`, NOT AGAINST `RING_CLEAR`. The old version
		// compared the placement engine's own margin to itself: shrinking
		// `RING_CLEAR` from 478 to 400 moved the constant and the assertion
		// together and survived. The number that carries meaning lives in
		// `hero.tsx` — it is where the outer ring's feet are.
		expect(RING_CLEAR).toBeGreaterThan(R_OUTER);
		for (const p of scene.figures) {
			expect(Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y)).toBeGreaterThan(
				R_OUTER,
			);
		}
	});

	it("keeps every placed item clear of the border's DRAWN depth", () => {
		// ⚠ AGAINST `BORDER_DEPTH` (what the border actually draws), NOT
		// `BORDER_INSET` (what the placer reserves). Drawing the border 90 units
		// deep while leaving the inset at 26 used to pass — the two numbers are
		// allowed to disagree and nothing said so.
		expect(BORDER_INSET).toBeGreaterThanOrEqual(BORDER_DEPTH);
		for (const p of [...scene.figures, ...scene.motifs]) {
			expect(p.x).toBeGreaterThan(BORDER_DEPTH);
			expect(p.x).toBeLessThan(FRAME.width - BORDER_DEPTH);
			expect(p.y).toBeGreaterThan(BORDER_DEPTH);
			expect(p.y).toBeLessThan(FRAME.height - BORDER_DEPTH);
		}
	});

	it("keeps the BORDER clear of the outer ring — the collision only looking found", () => {
		// ⚠ MINTED FROM A REAL DEFECT THAT NO TEST COULD SEE. The border shipped at
		// depth 62 while the outer ring's feet sit at radius 470 in a frame whose
		// half-height is 500 — so at twelve and six o'clock the ring reached y = 30,
		// thirty-two units INSIDE the band, and the two drew straight through each
		// other. Measured overlap: 58 units once the ring's own fringe was counted.
		// Every assertion in the suite was green, because none of them knew the
		// frame has a height. It was found by opening the picture.
		const halfHeight = FRAME.height / 2;
		expect(R_OUTER).toBeLessThan(halfHeight - BORDER_DEPTH);
		// The inner ring's faced figures grow OUTWARD and must not reach the crowd.
		const innerReach = R_INNER + FIGURE_BOX.height * FACED_SCALE;
		expect(innerReach).toBeLessThan(R_OUTER - FIGURE_BOX.height);
	});

	it("never puts two figures on top of each other", () => {
		for (let i = 0; i < scene.figures.length; i++) {
			for (let j = i + 1; j < scene.figures.length; j++) {
				const a = scene.figures[i];
				const b = scene.figures[j];
				if (a === undefined || b === undefined) {
					continue;
				}
				expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(48);
			}
		}
	});

	it("never puts a MOTIF on top of a figure — the shared occupancy list", () => {
		// ⚠ THE COMPONENT USED TO BE FREE TO STOP THREADING THE OCCUPANCY LIST, and
		// this test's own docblock had already recorded finding that bug in the
		// TEST and fixing it there. Fixing it in the test guarded nothing, because
		// the test built its own scene. Measured consequence of the untreaded
		// version: 29 of 104 motifs land inside a figure's footprint.
		for (const m of scene.motifs) {
			for (const f of scene.figures) {
				expect(Math.hypot(m.x - f.x, m.y - f.y)).toBeGreaterThan(20);
			}
		}
	});

	it("is deterministic — two builds of the same scene are deep-equal", () => {
		const counts = {
			figures: FIELD_FIGURE_COUNT,
			motifs: MOTIF_COUNT,
			ground: GROUND_MARK_COUNT,
		};
		expect(buildFieldScene(counts)).toEqual(buildFieldScene(counts));
	});

	it("can draw every motif kind it is willing to place", () => {
		for (const kind of new Set(SCENE_MOTIFS)) {
			expect(MOTIF_RENDERERS[kind]).toBeTypeOf("function");
		}
		for (const kind of Object.keys(MOTIF_RENDERERS)) {
			expect(SCENE_MOTIFS).toContain(kind);
		}
	});

	it("uses most of its motif vocabulary rather than a favourite few", () => {
		const used = new Set(scene.motifs.map((m) => m.kind));
		expect(used.size).toBeGreaterThanOrEqual(24);
	});

	it("varies mirror and scale, so repeats are not identical copies", () => {
		expect(scene.motifs.some((m) => m.mirror === 1)).toBe(true);
		expect(scene.motifs.some((m) => m.mirror === -1)).toBe(true);
		expect(
			new Set(scene.motifs.map((m) => m.scale.toFixed(2))).size,
		).toBeGreaterThan(20);
	});
});

/* ------------------------------------------------------------------ *
 * The drawing must actually contain the scene, and must not animate it
 * ------------------------------------------------------------------ */

describe("the static field reaches the DOM, and does not rotate", () => {
	it("renders every population, at the count the component declares", () => {
		// ⚠ WITHOUT THIS, THE WHOLE STATIC FIELD IS OPTIONAL. Deleting the motif
		// layer, the ground layer or the border stack from the render left the
		// entire suite green, because nothing read them and the composition guard
		// built its own scene from literals.
		const { container } = render(<WarliComposition />);
		expect(container.querySelectorAll("[data-warli-motif]")).toHaveLength(
			MOTIF_COUNT,
		);
		expect(container.querySelectorAll("[data-warli-ground]")).toHaveLength(
			GROUND_MARK_COUNT,
		);
		expect(
			container.querySelectorAll("[data-warli-field-figure]"),
		).toHaveLength(FIELD_FIGURE_COUNT);
		// Four edges of border, each carrying its rows.
		expect(container.querySelectorAll("[data-warli-border-edge]")).toHaveLength(
			4,
		);
		expect(
			container.querySelectorAll('[data-warli-border-row="teeth"]'),
		).toHaveLength(4);
	});

	it("draws each motif kind as the motif it names", () => {
		// ⚠ SET EQUALITY CANNOT SEE IDENTITY. The kind→renderer map was asserted
		// only as two matching SETS, so swapping the tiger and dog renderers — or
		// pointing four different animals at `Tree` — passed. The second is exactly
		// the "visible wallpaper" failure the vocabulary-variety test is docblocked
		// against, measured from placement objects where a collapse at the renderer
		// is invisible.
		const { container } = render(<WarliComposition />);
		const seen = new Set<string>();
		for (const node of container.querySelectorAll("[data-warli-motif]")) {
			const kind = node.getAttribute("data-warli-motif");
			const drawn = node.firstElementChild?.getAttribute("data-warli-id");
			if (kind === null || drawn == null) {
				throw new Error(`motif ${kind} drew nothing`);
			}
			// `water` is drawn by `WaterLine`; every other kind's id is its own name.
			const expected = kind === "water" ? "warli-water-line" : `warli-${kind}`;
			expect(drawn).toBe(expected);
			seen.add(kind);
		}
		expect(seen.size).toBeGreaterThanOrEqual(24);
	});

	it("keeps the static field OUT of the rotating groups", () => {
		// ⚠ BOTH CLAIMS THE THIRD POPULATION MAKES WERE UNGUARDED. `figures/index`
		// is emphatic that the field does not rotate — semantically, because a
		// world that turned with the rings would say the work is part of the
		// debate; and practically, because it would put every figure in the frame
		// into the animated layer. Wrapping `<FieldLayer/>` in `warli-spin` passed
		// the entire suite.
		// ⚠ MATCHED ON THE CLASS, NOT ONLY THE DATA ATTRIBUTE, AND A MUTANT PROVED
		// WHY. `[data-warli-spin]` marks the two ring groups for the pointer
		// handler; `.warli-spin` is what actually ANIMATES. Wrapping the field in a
		// bare `<g className="warli-spin">` carries no data attribute, so the
		// attribute selector walked straight past a field that was now rotating.
		// Assert the property that has the consequence.
		//
		// ⚠ WARLI-FIELD-ASSET MOVED THE FIELD INTO A FILE, SO THE THING THAT MUST
		// NOT ROTATE IS NOW THE ELEMENT WHOSE BACKGROUND DRAWS IT. Inverted rather
		// than deleted: the claim is unchanged, only its carrier moved. It must be
		// the hero ROOT — a background on anything inside a spin group turns with it.
		const { container } = render(<WarliHero />);
		const carriers = container.querySelectorAll("[data-warli-field-image]");
		expect(carriers).toHaveLength(1);
		const root = container.querySelector("[data-warli-hero]");
		expect(carriers[0]).toBe(root);
		expect((root as SVGSVGElement | null)?.style.backgroundImage).toContain(
			FIELD_ASSET_HREF,
		);
		for (const spinning of [".warli-spin", "[data-warli-spin]"]) {
			expect(
				container.querySelector(`${spinning} [data-warli-field-image]`),
			).toBeNull();
		}
		// …and the field is NOT ALSO inline. This is the byte budget: the inline
		// field was ~682 KB of every auth page, and a hero that both loads the file
		// and still renders the component would pay twice and look identical.
		for (const inline of [
			"[data-warli-field-layer]",
			"[data-warli-motif]",
			"[data-warli-ground]",
			"[data-warli-field-figure]",
			"[data-warli-border]",
		]) {
			expect(container.querySelector(inline)).toBeNull();
		}
	});
});
