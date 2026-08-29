import { hash01, pick } from "./primitives";

/**
 * Where everything that does not rotate is put.
 *
 * ⚠ GENERATED FROM LOOPS, NOT HAND-PLACED, AND THE REASON IS NOT LAZINESS. At
 * roughly a hundred and thirty placed items, a hand-authored coordinate table
 * would be about four thousand numbers in the shipped chunk — most of the
 * payload budget spent on data — and it could not be varied, re-balanced or
 * re-seeded without editing every one of them. Worse, it could not be CHECKED:
 * a table is only as collision-free as whoever typed it, whereas a placement
 * rule can be asserted over its whole output.
 *
 * ⚠ AND IT IS DETERMINISTIC ALL THE WAY DOWN. There is no `Math.random` and no
 * clock anywhere in this file; every varying quantity is a pure function of an
 * item's own index. Two renders of the same scene are byte-identical, which is
 * what lets the composition be asserted at all — and what stops an unrelated
 * snapshot flapping on some future night for reasons nobody can reproduce.
 */

/** The design frame. */
export const FRAME = { width: 1440, height: 1000 } as const;
export const CENTRE = { x: FRAME.width / 2, y: FRAME.height / 2 } as const;

/**
 * How far from the centre the static field must stay.
 *
 * The outer ring's feet are at 470 and its figures stand 58 tall pointing
 * INWARD, so the ring's drawing occupies 412 → 470 and reaches no further out
 * than its own baseline. A static figure inside this radius would be walked
 * through by the crowd once per turn, and because the crowd is the only thing
 * that moves, the collision would appear and disappear rather than being
 * visible in any single frame — the worst kind to find later.
 *
 * ⚠ 470 IS ALSO THE FRAME'S VERTICAL LIMIT, which is why the static field is a
 * pair of WINGS rather than a surround. Half the frame height is 500, so above
 * and below the rings there are thirty units, and the border takes twenty-six of
 * them. Everything the field does, it does to the left and right — and that is
 * a property of putting a circle in a 1440 × 1000 rectangle, not a shortfall.
 */
export const RING_CLEAR = 478;

/** The border stack's depth. Nothing but border may cross into it. */
export const BORDER_INSET = 26;

/**
 * A field figure's true ink extent about its FEET.
 *
 * `up` is 58 body-units at the largest scale the placer hands out (1.08), plus a
 * little for a raised hand and the head's own radius. `down` is small: almost
 * nothing is drawn below the feet but the dotted ground.
 */
const FIGURE_EXTENT: Extent = { side: 26, up: 66, down: 8 };

/** A motif's extent. Symmetric enough that one number serves, unlike a figure. */
const MOTIF_EXTENT: Extent = { side: 20, up: 40, down: 6 };

/** A ground mark is a small centred smudge. */
const GROUND_EXTENT: Extent = { side: 14, up: 14, down: 14 };

/**
 * The density meridian: 1 at the left edge, 0 at the right.
 *
 * ⚠ A SMOOTHSTEP, NEVER A THRESHOLD. The brief for this piece is two
 * territories FELT rather than stated, and the difference between a gradient and
 * a step is the difference between a painting and a diagram — a visible seam
 * down the middle of a wall painting reads as two pictures badly joined. The
 * cubic is the cheapest curve with zero slope at both ends, so the density stops
 * changing before it reaches either edge and no edge shows a ramp either.
 */
export function meridian(x: number): number {
	const t = Math.min(1, Math.max(0, x / FRAME.width));
	const s = t * t * (3 - 2 * t); // smoothstep 0→1 left→right
	return 1 - s;
}

export type PlacedFigure = {
	readonly index: number;
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	/** +1 faces screen-right, −1 faces screen-left. */
	readonly mirror: 1 | -1;
	/** A few degrees of lean, toward the centre. */
	readonly leanDeg: number;
	readonly seed: number;
};

export type PlacedMotif = {
	readonly index: number;
	readonly kind: string;
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	readonly mirror: 1 | -1;
	readonly seed: number;
};

/**
 * How far a placed item's INK reaches from its anchor point.
 *
 * ⚠ THIS IS NOT A RADIUS, AND MODELLING IT AS ONE WAS A REAL DEFECT. A figure is
 * anchored at its FEET and drawn upward from them: 58 body-units tall, scaled up
 * to ~1.08, so its ink reaches about 62 units ABOVE the anchor and only a few
 * below. Treating that as a 34-unit disc understated the upward extent by nearly
 * a factor of two and got the asymmetry backwards.
 *
 * Measured consequences before the fix, both of them exactly the collisions the
 * two constants below exist to prevent: **two of twenty-eight field figures had
 * ink inside the counter-rotating crowd's annulus** (nearest ink at r = 450.1
 * against an outer ring whose figures sweep inward to 412) and **three had head
 * crowns inside the border band** (y = 13.75, 13.95, 22.20 against a 26-unit
 * reserve). Both were invisible: every guard measured the ANCHOR, which sat
 * comfortably clear at r = 492.7. That is CLAUDE.md §5.14 SC-1 transposed onto
 * geometry — assert the ink's absence, not the anchor's.
 */
type Extent = {
	readonly side: number;
	readonly up: number;
	readonly down: number;
};

/** Is this item's INK inside the frame, clear of the border and of the rings? */
function admissible(x: number, y: number, extent: Extent): boolean {
	if (
		x - extent.side < BORDER_INSET ||
		x + extent.side > FRAME.width - BORDER_INSET ||
		y - extent.up < BORDER_INSET ||
		y + extent.down > FRAME.height - BORDER_INSET
	) {
		return false;
	}
	// Every corner of the item's own box has to clear the ring, not just its
	// anchor. The crown is the far corner for a figure, and the crown is what the
	// crowd walks through.
	const corners = [
		{ x: x - extent.side, y: y - extent.up },
		{ x: x + extent.side, y: y - extent.up },
		{ x: x - extent.side, y: y + extent.down },
		{ x: x + extent.side, y: y + extent.down },
		{ x, y },
	];
	return corners.every(
		(c) => Math.hypot(c.x - CENTRE.x, c.y - CENTRE.y) > RING_CLEAR,
	);
}

/**
 * A deterministic scan of candidate points.
 *
 * ⚠ A JITTERED LATTICE RATHER THAN A SPIRAL OR PURE NOISE, and the choice shows
 * on screen. Pure hashed points cluster and leave holes — the eye reads a
 * cluster as a signal and goes looking for what it means. A plain lattice reads
 * as a printed grid. A lattice whose every cell is nudged by a hash of its own
 * index has neither failure: locally irregular, globally even.
 */
function* candidates(salt: number): Generator<{ x: number; y: number }> {
	// ⚠ 16, NOT 26. At the coarser step the lattice offered about a thousand
	// admissible cells, and after the figures' own spacing had claimed theirs the
	// motif pass ran out of candidates at 56 of the 104 it was asked for — while
	// the docblock below confidently said the count "comes out where it was asked
	// to". It did not. Caught by asserting the requested count rather than
	// trusting the sentence.
	const step = 16;
	const cols = Math.ceil(FRAME.width / step);
	const rows = Math.ceil(FRAME.height / step);
	// Column-major with an odd stride, so successive candidates are far apart and
	// the greedy accept below does not fill the left edge before it reaches the
	// right. A row-major scan would place every item it could in reading order
	// and then run out of budget, which looks exactly like a broken meridian.
	const total = cols * rows;
	const stride = 439; // coprime with any realistic total
	for (let n = 0; n < total; n++) {
		const cell = (n * stride) % total;
		const col = cell % cols;
		const row = Math.floor(cell / cols);
		yield {
			x: col * step + step / 2 + (hash01(cell * 7 + salt) - 0.5) * step * 1.6,
			y: row * step + step / 2 + (hash01(cell * 13 + salt) - 0.5) * step * 1.6,
		};
	}
}

/**
 * Greedy placement with a meridian-dependent spacing.
 *
 * The meridian is carried by SPACING rather than by a rejection probability,
 * which matters: a probability leaves the count at the mercy of the seed, so a
 * scene asked for 28 figures might return 19 and the guard that counts them
 * would be asserting a coin flip. Spacing is a hard geometric rule — the dense
 * half simply admits more items into the same area.
 *
 * ⚠ IT IS STILL BOUNDED BY THE LATTICE, AND SAYING SO IS THE HONEST VERSION.
 * This returns AT MOST `count`; if the admissible area cannot hold that many at
 * the required spacing it returns fewer, and silently. That is not hypothetical
 * — the first build returned 56 of 104 while this docblock claimed the count
 * "comes out where it was asked to". The guard now asserts the REQUESTED count
 * rather than trusting the sentence, which is the only reason it was found.
 */
function placeGreedy(
	count: number,
	extent: Extent,
	spacingDense: number,
	spacingOpen: number,
	salt: number,
	taken: Array<{ x: number; y: number; r: number }>,
): Array<{ x: number; y: number }> {
	const out: Array<{ x: number; y: number }> = [];
	for (const point of candidates(salt)) {
		if (out.length >= count) {
			break;
		}
		if (!admissible(point.x, point.y, extent)) {
			continue;
		}
		const spacing =
			spacingOpen + (spacingDense - spacingOpen) * meridian(point.x);
		const clash = taken.some(
			(t) => Math.hypot(t.x - point.x, t.y - point.y) < spacing + t.r,
		);
		if (clash) {
			continue;
		}
		out.push(point);
		taken.push({ x: point.x, y: point.y, r: extent.side });
	}
	return out;
}

/**
 * The static field's people.
 *
 * ⚠ EVERY ONE OF THEM FACES THE CENTRE, and that is a semantic property rather
 * than a compositional one. The field is the world being argued ABOUT; a figure
 * in it turned away would read as a figure leaving, and one turned away in the
 * corner of a composition about an unresolved argument reads as somebody who has
 * resolved it. They stand upright and face inward by mirror, with a couple of
 * degrees of lean the same way — the lean is what stops the inward facing
 * looking like a rule and starts it looking like attention.
 */
export function placeFieldFigures(
	count: number,
	taken: Array<{ x: number; y: number; r: number }> = [],
): readonly PlacedFigure[] {
	const points = placeGreedy(count, FIGURE_EXTENT, 58, 88, 1_009, taken);
	return points.map((p, index) => {
		const mirror: 1 | -1 = p.x <= CENTRE.x ? 1 : -1;
		return {
			index,
			x: Math.round(p.x * 100) / 100,
			// Feet sit on the candidate point; the body grows up from there.
			y: Math.round(p.y * 100) / 100,
			scale: 0.78 + hash01(index * 17 + 3) * 0.3,
			mirror,
			leanDeg: mirror * (1.5 + hash01(index * 23) * 3.5),
			seed: 900 + index,
		};
	});
}

/** The motifs the scene engine may place in the open ground. */
export const SCENE_MOTIFS: readonly string[] = [
	"tree",
	"tree",
	"palm",
	"hut",
	"granary",
	"deer",
	"bird",
	"bird",
	"bullock",
	"dog",
	"horse",
	"tiger",
	"monkey",
	"scorpion",
	"snake",
	"crab",
	"rooster",
	"peacock",
	"fish",
	"pot",
	"drum",
	"basket",
	"plough",
	"winnow",
	"ladder",
	"cart",
	"fields",
	"hills",
	"chauk",
	"spiral",
	"sun",
	"moon",
	"water",
];

/**
 * The animals, scenery and objects lying between the figures.
 *
 * ⚠ THE KIND IS PICKED PER-INDEX, NOT CYCLED. A cycle over thirty-three motifs
 * across a hundred placements draws each one almost exactly three times in the
 * same rotational order, and the eye finds a repeated sequence faster than it
 * finds a repeated shape. Hashing the index breaks the order while keeping the
 * whole thing reproducible.
 *
 * Mirror and scale are hashed for the same reason: thirty-three motif types
 * across a hundred instances is three of each, and three identical copies of a
 * tiger is visible wallpaper. Three tigers at different sizes facing different
 * ways is a place with tigers in it.
 */
export function placeMotifs(
	count: number,
	taken: Array<{ x: number; y: number; r: number }> = [],
): readonly PlacedMotif[] {
	const points = placeGreedy(count, MOTIF_EXTENT, 21, 34, 7_919, taken);
	return points.map((p, index) => ({
		index,
		kind: pick(SCENE_MOTIFS, index * 31 + 5),
		x: Math.round(p.x * 100) / 100,
		y: Math.round(p.y * 100) / 100,
		scale: 0.62 + hash01(index * 29 + 11) * 0.62,
		mirror: hash01(index * 41 + 2) > 0.5 ? 1 : -1,
		seed: 400 + index,
	}));
}

export type GroundMark = {
	readonly index: number;
	readonly kind: "hatch" | "dots" | "water";
	readonly x: number;
	readonly y: number;
	readonly rotationDeg: number;
	readonly scale: number;
	readonly seed: number;
};

/**
 * The worked ground: hatch, dot fields and water lines, behind everything.
 *
 * ⚠ THIS IS WHERE THE MERIDIAN ACTUALLY BECOMES VISIBLE. Figures and motifs
 * carry it a little, but they are discrete — thirty-eight items cannot express a
 * smooth gradient across 1440 units, and trying to make them do it just makes
 * the right-hand side look under-populated. Several hundred small marks CAN, and
 * because they sit behind everything they change the WEIGHT of a region without
 * competing with anything in it. Density as tone, which is the only tone a
 * one-colour piece gets.
 */
export function placeGroundMarks(count: number): readonly GroundMark[] {
	const kinds = ["hatch", "dots", "water"] as const;
	const out: GroundMark[] = [];
	let index = 0;
	for (const point of candidates(3_331)) {
		if (out.length >= count) {
			break;
		}
		index++;
		if (!admissible(point.x, point.y, GROUND_EXTENT)) {
			continue;
		}
		// The meridian as a straight accept test. Ground marks are the one
		// population where a probabilistic rule is right: they are numerous enough
		// that the law of large numbers gives a smooth ramp, and no guard counts
		// them individually.
		//
		// ⚠ THE COEFFICIENTS ARE THE MERIDIAN'S ACTUAL STRENGTH, AND THEY WERE
		// MEASURED RATHER THAN CHOSEN. The first pass used `× 0.86 + 0.07`, which
		// runs the accept probability from 0.93 at the left edge to 0.07 at the
		// right — a thirteen-to-one ratio. That is not a gradient, it is a wall
		// with a populated side, and the G4 guard measured the whole composition
		// at 4.7 : 1 and reddened. Narrowing the range to 0.90 → 0.48 gives just
		// under two-to-one, which is felt rather than stated — the thing the brief
		// actually asked for and the thing "one half worked dense, the other more
		// open" means when it is a painting and not a diagram.
		if (hash01(index * 97 + 13) > meridian(point.x) * 0.42 + 0.48) {
			continue;
		}
		out.push({
			index: out.length,
			kind: kinds[Math.floor(hash01(index * 53) * 3)] ?? "hatch",
			x: Math.round(point.x * 100) / 100,
			y: Math.round(point.y * 100) / 100,
			rotationDeg: Math.round((hash01(index * 59) * 40 - 20) * 100) / 100,
			scale: 0.5 + hash01(index * 61) * 0.7,
			seed: 5_000 + out.length,
		});
	}
	return out;
}

/**
 * The ground marks' ACCEPTANCE RATE per column, measured on the same candidate
 * stream that produced them.
 *
 * ⚠ THIS REPLACES A NORMALISED PROXY THAT WAS OVER-FITTED TO THE SCAN SEED, and
 * the review that caught it did so by reseeding rather than by reading. Binning
 * placed marks by x and dividing by a SEPARATELY-sampled estimate of admissible
 * area gave four buckets whose middle two carried about 5 % of the ink each —
 * fifteen to twenty marks — so a change of two motifs flipped the verdict.
 * Changing the lattice stride from 439 to 443, which touches no meridian
 * coefficient at all, reddened the guard. A guard that a pure reordering can
 * flip is measuring the seed, not the gradient.
 *
 * This asks the engine's own question instead: **of the candidates admissible in
 * this column, what fraction did the meridian accept?** Numerator and
 * denominator come from ONE walk of ONE stream, so there is no sampling mismatch
 * to average out, and the answer is a property of `meridian()` and its
 * coefficients rather than of the order the lattice happened to be visited in.
 */
export function groundAcceptanceByColumn(
	columns: number,
): readonly { readonly admissible: number; readonly accepted: number }[] {
	const out = Array.from({ length: columns }, () => ({
		admissible: 0,
		accepted: 0,
	}));
	let index = 0;
	for (const point of candidates(3_331)) {
		index++;
		if (!admissible(point.x, point.y, GROUND_EXTENT)) {
			continue;
		}
		const col = Math.min(
			columns - 1,
			Math.max(0, Math.floor((point.x / FRAME.width) * columns)),
		);
		const bucket = out[col];
		if (bucket === undefined) {
			continue;
		}
		bucket.admissible++;
		if (hash01(index * 97 + 13) <= meridian(point.x) * 0.42 + 0.48) {
			bucket.accepted++;
		}
	}
	return out;
}

/**
 * The whole static population, built once.
 *
 * ⚠ THIS EXISTS SO THE GUARD AND THE COMPONENT CANNOT DISAGREE, and it was added
 * because they did. The composition guard used to re-derive its own scene from
 * literal counts, which meant the entire motif layer, the entire ground layer and
 * the whole border could be deleted from the render while every assertion stayed
 * green — the guard was grading a scene the component was under no obligation to
 * draw. It also meant the occupancy list could stop being threaded in the
 * component (dropping 29 of 104 motifs on top of figures) while the test, which
 * threaded it correctly, saw nothing.
 *
 * The test's own docblock had already named this failure — "a guard on the
 * composition has to build the composition the same way the component does, or it
 * is grading its own homework with a different question paper" — and then
 * committed it with the counts. One builder is the fix that makes the sentence
 * structurally true instead of aspirational.
 */
export function buildFieldScene(counts: {
	readonly figures: number;
	readonly motifs: number;
	readonly ground: number;
}): {
	readonly figures: readonly PlacedFigure[];
	readonly motifs: readonly PlacedMotif[];
	readonly ground: readonly GroundMark[];
} {
	// ⚠ ORDER AND SHARED OCCUPANCY ARE BOTH LOAD-BEARING. Figures claim their
	// ground first; motifs are then placed against a list that already contains
	// them. Placing the two independently and hoping is how a hundred items
	// produce a few dozen collisions.
	const taken: Array<{ x: number; y: number; r: number }> = [];
	const figures = placeFieldFigures(counts.figures, taken);
	const motifs = placeMotifs(counts.motifs, taken);
	const ground = placeGroundMarks(counts.ground);
	return { figures, motifs, ground };
}

/**
 * Ink weight per half-frame, in arbitrary but consistent units.
 *
 * ⚠ IT COUNTS MARKS, WEIGHTED BY SIZE, RATHER THAN MEASURING COVERAGE. Real ink
 * coverage would mean rasterising the drawing and counting pixels, which is not
 * available in a jsdom test and would be measuring the renderer as much as the
 * composition. A size-weighted mark count is a PROXY, and saying so matters:
 * it tracks the thing the meridian is supposed to do — more marks on one side —
 * and it would not notice a change that made the right-hand marks individually
 * much heavier. That limit is stated in the guard that consumes it.
 */
export function inkByColumn(
	columns: number,
	items: readonly {
		readonly x: number;
		readonly scale: number;
	}[],
): readonly number[] {
	const out = new Array<number>(columns).fill(0);
	for (const item of items) {
		const col = Math.min(
			columns - 1,
			Math.max(0, Math.floor((item.x / FRAME.width) * columns)),
		);
		out[col] = (out[col] ?? 0) + item.scale;
	}
	return out;
}

/**
 * How much PLACEABLE ground each column has, in admissible lattice cells.
 *
 * ⚠ THIS EXISTS BECAUSE RAW INK PER COLUMN IS THE WRONG MEASURE FOR THIS
 * COMPOSITION, AND MEASURING IT PROVED SO. Split into four, the placed marks
 * came out 204.8 | 21.5 | 13.7 | 122.4 — nowhere near the monotonic fall a
 * meridian should give. The reason is not the meridian; it is that the middle
 * two columns ARE THE RINGS, and the static field is excluded from them by
 * construction. A raw column count was measuring the hole in the doughnut.
 *
 * Normalising ink by the admissible area underneath it asks the question that
 * was actually meant: **of the ground a mark COULD have been placed on, how much
 * of it was used?** That is the density gradient, and it is a property of the
 * meridian rather than of where the rings happen to sit.
 */
export function admissibleByColumn(columns: number): readonly number[] {
	const out = new Array<number>(columns).fill(0);
	for (const point of candidates(0)) {
		if (!admissible(point.x, point.y, GROUND_EXTENT)) {
			continue;
		}
		const col = Math.min(
			columns - 1,
			Math.max(0, Math.floor((point.x / FRAME.width) * columns)),
		);
		out[col] = (out[col] ?? 0) + 1;
	}
	return out;
}
