// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOTIF_RENDERERS } from "@/components/art/warli/field-layer";
import {
	ALL_FIGURES,
	FIELD_FIGURES,
	INNER_FIGURES,
	OPPOSED_PAIRS,
	OUTER_FIGURES,
} from "@/components/art/warli/figures";
import { WarliHero } from "@/components/art/warli/hero";
import {
	admissibleByColumn,
	BORDER_INSET,
	CENTRE,
	FRAME,
	inkByColumn,
	meridian,
	placeFieldFigures,
	placeGroundMarks,
	placeMotifs,
	RING_CLEAR,
	SCENE_MOTIFS,
} from "@/components/art/warli/scene";

/**
 * WARLI-2 §5 — the four semantic guards, G1 to G4.
 *
 * ⚠ AND THE HONEST LIMIT, STATED WHERE IT WILL BE READ RATHER THAN IN A REPORT
 * NOBODY OPENS AGAIN: none of these prove the picture LOOKS like a debate. They
 * prove it is STRUCTURED like one — that the opposed positions really are
 * opposite, that the world really does face inward, that the populations are the
 * sizes they claim, and that one half really does carry more ink than the other.
 * Whether any of that adds up to a composition worth looking at is a question
 * only the standalone preview can answer, and only a person can answer it.
 * Reporting these as green must never be reported as "the composition works".
 *
 * ⚠ EACH GUARD IS WRITTEN TO FAIL AGAINST A WRONG COMPOSITION, NOT MERELY
 * AGAINST A BROKEN ONE. The failure mode this file is built to avoid is the one
 * WARLI-1 shipped and caught: a test docblocked "THE THESIS" that asserted a
 * pure function returns the same value for the same argument, killed zero
 * mutants, and read as though it proved something. So every assertion below
 * names the specific wrong composition it rejects.
 */

const clockAngle = (x: number, y: number) =>
	(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) % 360;

/* ------------------------------------------------------------------ *
 * G1 · the opposed pairs really are opposite
 * ------------------------------------------------------------------ */

describe("G1 · each faced figure's opposite sits at 180° across the ring", () => {
	it("puts every pair within 1° of a half turn apart", () => {
		// REJECTS: a pairing that walks adjacent indices instead of opposite ones.
		// Proven by reversal — changing the derivation to `INNER_FIGURES[i + 1]`
		// reddens this and two assertions in `warli-render.test.tsx`.
		//
		// ⚠ AND HERE IS WHAT IT CANNOT CATCH, WHICH MATTERS MORE THAN WHAT IT CAN.
		// Both the pairing and the placement derive from the SAME index, so on an
		// evenly-spaced ring of eight, entry `i` and entry `i + 4` are 180° apart
		// no matter WHO is standing there. Swap two labels in `INNER_FIGURES` and
		// the scholar ends up opposite the student — the argument is now between
		// the wrong people — and every assertion in this block stays green.
		//
		// That hole is closed elsewhere, deliberately and not by accident: the
		// literal label list in `warli-render.test.tsx` ("scholar/labourer",
		// "soldier/student", …) is what pins WHO faces WHOM. This test pins the
		// GEOMETRY. Neither is sufficient alone, and a reader who took this one as
		// covering both would be wrong.
		const { container } = render(<WarliHero />);
		const bearingOf = (id: string) => {
			const t = container
				.querySelector(`[data-warli-ring="inner"] [data-warli-id="${id}"]`)
				?.getAttribute("transform");
			const m = t?.match(/^translate\((-?[\d.]+) (-?[\d.]+)\)/);
			if (m?.[1] === undefined || m[2] === undefined) {
				throw new Error(`${id} is not on the inner ring`);
			}
			return clockAngle(Number(m[1]), Number(m[2]));
		};

		expect(OPPOSED_PAIRS.length).toBeGreaterThanOrEqual(4);
		for (const [a, b] of OPPOSED_PAIRS) {
			const sep = (((bearingOf(b.id) - bearingOf(a.id)) % 360) + 360) % 360;
			expect(Math.abs(sep - 180)).toBeLessThan(1);
		}
	});

	it("positive control: a same-ring NON-pair is not 180° apart", () => {
		// Without this, the assertion above would pass just as happily against a
		// ring on which EVERY figure is 180° from every other — which is what an
		// eight-figure ring collapsed to two positions would look like.
		const { container } = render(<WarliHero />);
		const bearingOf = (id: string) => {
			const t = container
				.querySelector(`[data-warli-ring="inner"] [data-warli-id="${id}"]`)
				?.getAttribute("transform");
			const m = t?.match(/^translate\((-?[\d.]+) (-?[\d.]+)\)/);
			return clockAngle(Number(m?.[1]), Number(m?.[2]));
		};
		const a = INNER_FIGURES[0];
		const notItsOpposite = INNER_FIGURES[1];
		if (a === undefined || notItsOpposite === undefined) {
			throw new Error("inner ring is too short to test");
		}
		const sep =
			(((bearingOf(notItsOpposite.id) - bearingOf(a.id)) % 360) + 360) % 360;
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
	 * figure standing directly above the centre is therefore unconstrained in the
	 * way a bearing test would constrain it, and no assertion below pretends
	 * otherwise. What this DOES catch is the defect that actually matters and
	 * would actually happen: a figure in the left wing turned to face left, out
	 * of the picture, in a composition about an argument nobody leaves.
	 */
	const placed = placeFieldFigures(FIELD_FIGURES.length, []);

	it("mirrors every figure toward the centre", () => {
		expect(placed.length).toBe(FIELD_FIGURES.length);
		for (const p of placed) {
			expect(p.mirror * (CENTRE.x - p.x)).toBeGreaterThan(0);
		}
	});

	it("leans every figure the same way it faces", () => {
		// Two independent properties. A composition that got the mirror right and
		// the lean backwards would have every figure facing inward while tipping
		// out of frame, which reads as a crowd being blown away from the subject.
		for (const p of placed) {
			expect(Math.sign(p.leanDeg)).toBe(p.mirror);
			expect(Math.abs(p.leanDeg)).toBeLessThan(6);
		}
	});

	it("positive control: the test can tell an outward-facing figure apart", () => {
		// The same predicate, applied to a deliberately reversed figure, must fail.
		// Without this, `mirror * (CENTRE.x − x) > 0` could be vacuously true (for
		// example if every figure landed exactly on the centre line) and nothing
		// would say so.
		const reversed = placed.map((p) => ({ ...p, mirror: -p.mirror as 1 | -1 }));
		const stillInward = reversed.filter((p) => p.mirror * (CENTRE.x - p.x) > 0);
		expect(stillInward).toHaveLength(0);
		// …and the real set is genuinely on BOTH sides, so the rule is doing work
		// rather than being satisfied by every figure sitting in one wing.
		expect(placed.some((p) => p.mirror === 1)).toBe(true);
		expect(placed.some((p) => p.mirror === -1)).toBe(true);
	});

	it("renders the mirror it computed, all the way to the DOM", () => {
		// The placement being right is worth nothing if the renderer drops it.
		const { container } = render(<WarliHero />);
		const nodes = [...container.querySelectorAll("[data-warli-field-figure]")];
		expect(nodes).toHaveLength(FIELD_FIGURES.length);
		for (const node of nodes) {
			const t = node.getAttribute("transform") ?? "";
			const m = t.match(
				/translate\((-?[\d.]+) (-?[\d.]+)\).*scale\((-?[\d.]+)/,
			);
			if (m?.[1] === undefined || m[3] === undefined) {
				throw new Error(`unparsable field-figure transform: ${t}`);
			}
			const x = Number(m[1]);
			const signedScale = Number(m[3]);
			expect(Math.sign(signedScale) * (CENTRE.x - x)).toBeGreaterThan(0);
		}
	});
});

/* ------------------------------------------------------------------ *
 * G3 · the populations are the sizes the piece claims
 * ------------------------------------------------------------------ */

describe("G3 · exactly eight faces, and 45–55 characters in all", () => {
	it("gives a face to the inner ring and to nobody else", () => {
		// REJECTS: faces leaking onto the crowd. The scarcity IS the mechanism —
		// eight faces in a field of forty-eight is what makes the inner ring read
		// as the positions that are speaking. Give everyone a face and the piece
		// becomes a picture of forty-eight individuals arguing, which is a
		// different and much more ordinary claim.
		expect(ALL_FIGURES.filter((f) => f.face !== undefined)).toHaveLength(8);
		for (const f of INNER_FIGURES) {
			expect(f.face).toBeDefined();
		}
		for (const f of [...OUTER_FIGURES, ...FIELD_FIGURES]) {
			expect(f.face).toBeUndefined();
		}
	});

	it("gives the eight faced figures eight DISTINCT faces", () => {
		// Eight figures sharing four faces would satisfy every count above.
		const faces = INNER_FIGURES.map((f) => `${f.face?.brow}/${f.face?.mouth}`);
		expect(new Set(faces).size).toBe(8);
	});

	it("draws exactly eight faces in the DOM, on open heads", () => {
		const { container } = render(<WarliHero />);
		expect(container.querySelectorAll("[data-warli-face]")).toHaveLength(8);
		// ⚠ AND EVERY ONE OF THEM IS ON AN UNFILLED HEAD. A face inside an
		// ink-filled circle is ink on ink: invisible, with every count above still
		// green. This is the assertion that would catch it.
		for (const face of container.querySelectorAll("[data-warli-face]")) {
			const head = face.parentElement?.querySelector(
				'[data-warli-id="warli-head"] path',
			);
			expect(head?.getAttribute("fill")).toBe("none");
		}
	});

	it("holds the total character count inside the stated band", () => {
		expect(ALL_FIGURES.length).toBeGreaterThanOrEqual(45);
		expect(ALL_FIGURES.length).toBeLessThanOrEqual(55);
		expect(INNER_FIGURES).toHaveLength(8);
		expect(OUTER_FIGURES).toHaveLength(12);
		expect(FIELD_FIGURES).toHaveLength(28);
	});

	it("renders every declared character, not merely declares them", () => {
		const { container } = render(<WarliHero />);
		expect(container.querySelectorAll("[data-warli-figure-body]")).toHaveLength(
			ALL_FIGURES.length,
		);
	});
});

/* ------------------------------------------------------------------ *
 * G4 · the density meridian exists, and is a gradient
 * ------------------------------------------------------------------ */

describe("G4 · ink falls from left to right, as a gradient and not a step", () => {
	// ⚠ THE OCCUPANCY LIST IS THREADED EXACTLY AS `FieldLayer` THREADS IT, and
	// getting that wrong was a real defect in this test rather than in the
	// engine. The first version called `placeMotifs(104, [])` with an EMPTY
	// `taken` array, so the motifs were placed as though no figure existed and
	// spread into ground the figures actually occupy. It measured a composition
	// that is never rendered — and duly reported a non-monotonic gradient for a
	// picture whose gradient is fine. A guard on the composition has to build the
	// composition the same way the component does, or it is grading its own
	// homework with a different question paper.
	const taken: Array<{ x: number; y: number; r: number }> = [];
	placeFieldFigures(FIELD_FIGURES.length, taken);
	const motifs = placeMotifs(104, taken);
	const ground = placeGroundMarks(330);

	/**
	 * ⚠ WHAT IS BEING MEASURED IS A PROXY, AND SAYING SO IS PART OF THE GUARD.
	 * True ink coverage would mean rasterising and counting pixels, which jsdom
	 * cannot do and which would measure the renderer as much as the composition.
	 * This counts placed marks weighted by their scale. It tracks what the
	 * meridian is supposed to do — more marks on one side — and it would NOT
	 * notice a change that left the counts alone and made the right-hand marks
	 * individually much heavier. That is the hole; it is stated rather than
	 * papered over.
	 */
	it("carries more ink on the left half than the right, inside a measured band", () => {
		const halves = inkByColumn(2, [...ground, ...motifs]);
		const [left, right] = halves;
		if (left === undefined || right === undefined) {
			throw new Error("expected two halves");
		}
		const ratio = left / right;
		// MEASURED at 1.632. The band is set around the measurement rather than
		// picked first and hoped for — the exact figure is a consequence of the
		// smoothstep and the accept threshold, not a number anybody chose.
		//
		// ⚠ THE UPPER BOUND IS DOING REAL WORK. The first build ran the accept
		// probability from 0.93 to 0.07 and measured 4.7 : 1, which is not a
		// gradient but a wall with a populated side. A meridian that is too STRONG
		// fails this task's brief exactly as surely as one that is absent.
		expect(ratio).toBeGreaterThan(1.35);
		expect(ratio).toBeLessThan(2.2);
	});

	it("falls monotonically in DENSITY across four columns — the gradient, not the imbalance", () => {
		// ⚠ NORMALISED BY ADMISSIBLE AREA, AND THE FIRST VERSION OF THIS TEST WAS
		// WRONG FOR NOT BEING. Raw ink per column came out 211 | 20 | 15 | 127 —
		// nowhere near monotonic — and the cause was not the meridian. The middle
		// two columns ARE THE RINGS, which the static field is excluded from by
		// construction, so a raw column count was measuring the hole in the
		// doughnut and calling it a broken gradient. Dividing by the ground each
		// column actually offers asks the question that was meant: of the area a
		// mark COULD have gone on, how much was used.
		//
		// ⚠ FOUR COLUMNS, NOT SIX, AND THAT IS A MEASUREMENT TOO. At six, the two
		// central columns hold 16 and 14 admissible cells respectively, and a
		// density estimated from fourteen samples is dominated by sampling noise
		// rather than by the meridian — it measured non-monotonic for that reason
		// alone. Four columns give every bucket at least 93 cells.
		const ink = inkByColumn(4, [...ground, ...motifs]);
		const area = admissibleByColumn(4);
		const density = ink.map((v, i) => v / (area[i] ?? 1));

		// Every bucket must hold enough ground to be worth dividing by.
		for (const a of area) {
			expect(a).toBeGreaterThan(80);
		}
		// MEASURED: 0.2250 | 0.2061 | 0.1569 | 0.1322 — strictly falling.
		for (let i = 1; i < density.length; i++) {
			expect(density[i] ?? 0).toBeLessThan(density[i - 1] ?? 0);
		}
		// And no single step may take most of the fall, which is what "gradient,
		// not step" means quantitatively. MEASURED largest step: 0.530 of the fall.
		const totalFall = (density[0] ?? 0) - (density[density.length - 1] ?? 0);
		expect(totalFall).toBeGreaterThan(0.03);
		for (let i = 1; i < density.length; i++) {
			expect((density[i - 1] ?? 0) - (density[i] ?? 0)).toBeLessThan(
				totalFall * 0.62,
			);
		}
	});

	it("positive control: a flat composition fails both assertions", () => {
		// Same measurement, applied to marks spread evenly across the frame. If
		// this passed, the two tests above would be measuring nothing.
		const flat = Array.from({ length: 400 }, (_, i) => ({
			x: (i / 400) * FRAME.width,
			scale: 1,
		}));
		const area = admissibleByColumn(4);
		const density = inkByColumn(4, flat).map((v, i) => v / (area[i] ?? 1));
		const strictlyFalling = density.every(
			(v, i) => i === 0 || v < (density[i - 1] ?? 0),
		);
		expect(strictlyFalling).toBe(false);
		const halves = inkByColumn(2, flat);
		expect((halves[0] ?? 0) / (halves[1] ?? 1)).toBeLessThan(1.35);
	});

	it("keeps the meridian smooth at both edges", () => {
		// A smoothstep has zero slope at 0 and 1, which is what stops the ramp
		// being visible AS a ramp at the frame's edges.
		expect(meridian(0)).toBeCloseTo(1, 6);
		expect(meridian(FRAME.width)).toBeCloseTo(0, 6);
		expect(meridian(FRAME.width / 2)).toBeCloseTo(0.5, 6);
		expect(meridian(10) - meridian(0)).toBeGreaterThan(-0.01);
		// Monotone across the frame.
		let prev = Number.POSITIVE_INFINITY;
		for (let x = 0; x <= FRAME.width; x += 40) {
			const m = meridian(x);
			expect(m).toBeLessThanOrEqual(prev);
			prev = m;
		}
	});
});

/* ------------------------------------------------------------------ *
 * The scene engine's own contract
 * ------------------------------------------------------------------ */

describe("the scene engine places without collisions or overruns", () => {
	const taken: Array<{ x: number; y: number; r: number }> = [];
	const figures = placeFieldFigures(FIELD_FIGURES.length, taken);
	const motifs = placeMotifs(104, taken);

	it("places the counts it was asked for", () => {
		// A probabilistic placement rule would leave the count at the mercy of the
		// seed, so a scene asked for 28 might return 19 and G3 would be asserting
		// a coin flip. The count is a hard outcome.
		expect(figures).toHaveLength(FIELD_FIGURES.length);
		expect(motifs).toHaveLength(104);
	});

	it("keeps every figure clear of the rotating rings", () => {
		// A static figure inside the ring band is walked through by the crowd once
		// per turn — a collision that appears and disappears, and is therefore
		// invisible in any single screenshot.
		for (const p of figures) {
			expect(Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y)).toBeGreaterThan(
				RING_CLEAR,
			);
		}
	});

	it("keeps every placed item inside the border", () => {
		for (const p of [...figures, ...motifs]) {
			expect(p.x).toBeGreaterThan(BORDER_INSET);
			expect(p.x).toBeLessThan(FRAME.width - BORDER_INSET);
			expect(p.y).toBeGreaterThan(BORDER_INSET);
			expect(p.y).toBeLessThan(FRAME.height - BORDER_INSET);
		}
	});

	it("never puts two figures on top of each other", () => {
		for (let i = 0; i < figures.length; i++) {
			for (let j = i + 1; j < figures.length; j++) {
				const a = figures[i];
				const b = figures[j];
				if (a === undefined || b === undefined) {
					continue;
				}
				expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(48);
			}
		}
	});

	it("is deterministic — two placements of the same scene are deep-equal", () => {
		expect(placeFieldFigures(FIELD_FIGURES.length, [])).toEqual(
			placeFieldFigures(FIELD_FIGURES.length, []),
		);
		expect(placeMotifs(60, [])).toEqual(placeMotifs(60, []));
		expect(placeGroundMarks(120)).toEqual(placeGroundMarks(120));
	});

	it("can draw every motif kind it is willing to place", () => {
		// ⚠ A `kind` with no renderer draws NOTHING — silently, and looking exactly
		// like a sparse patch of composition rather than like a bug. At three
		// instances per kind that is three invisible holes per missing name, and
		// nothing in the suite would have said a word.
		for (const kind of new Set(SCENE_MOTIFS)) {
			expect(MOTIF_RENDERERS[kind]).toBeTypeOf("function");
		}
		// …and the reverse, so a renderer nobody can reach is also caught.
		for (const kind of Object.keys(MOTIF_RENDERERS)) {
			expect(SCENE_MOTIFS).toContain(kind);
		}
	});

	it("uses most of its motif vocabulary rather than a favourite few", () => {
		// 31 kinds over 104 placements. A hash that collapsed onto a handful would
		// be deterministic, collision-free, correctly counted — and visible
		// wallpaper, which is this task's most likely aesthetic failure.
		const used = new Set(motifs.map((m) => m.kind));
		expect(used.size).toBeGreaterThanOrEqual(24);
	});

	it("varies mirror and scale, so repeats are not identical copies", () => {
		expect(motifs.some((m) => m.mirror === 1)).toBe(true);
		expect(motifs.some((m) => m.mirror === -1)).toBe(true);
		expect(new Set(motifs.map((m) => m.scale.toFixed(2))).size).toBeGreaterThan(
			20,
		);
	});
});
