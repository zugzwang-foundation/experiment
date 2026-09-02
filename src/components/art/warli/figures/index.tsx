import {
	FACE_SETS,
	type FaceSet,
	type OrnamentSet,
	ornamentFor,
	type PrimitiveBox,
} from "../primitives";
import {
	Body,
	type BodyPose,
	DEFAULT_POSE,
	type Density,
	FIGURE_BOX,
	HAND_X,
	HAND_Y,
	type Point,
	type PropName,
} from "./body";

/**
 * The roster: eight faced positions, a crowd of twelve, and a field of
 * twenty-eight people getting on with their work.
 *
 * ⚠ EVERY FIGURE IS THE SAME DRAWING, AND THE SAME SIZE OF DRAWING. Only four
 * things vary: what is in the hand, how the limbs are angled, what ornament is
 * reserved out of the body, and whether there is a face. That is the argument
 * the piece is making, put into the code rather than into a caption — the ring
 * is not one kind of person against another kind, it is forty-eight identical
 * bodies holding different things. If a later change makes one of these
 * structurally distinct — a different build, a longer reach — it will have
 * quietly reversed the thesis while looking like a styling tweak.
 *
 * ⚠ AND THAT IS WHY THE POSES VARY IN HEIGHT AND NEVER IN REACH. A figure
 * stooping over a plough or carrying a pot on its head is a real change of pose,
 * and the obvious way to draw it is to bring the hands in. Doing so would break
 * the hand chain on the rings and would move the anchor the equal-reach guard
 * exists to pin. So every hand in this file stays at |x| ≥ 19 and moves in `y`
 * instead: raised, level or lowered, with the head carried high or bowed. It
 * turns out to be enough — a bowed head and two lowered hands reads as stooping
 * without the arms shortening by a unit.
 */

export type FigureSpec = {
	/** Stable, unique, `warli-` prefixed. */
	readonly id: string;
	/** The name this figure goes by. */
	readonly label: string;
	/** Extent in figure-local units, origin at the feet. */
	readonly box: PrimitiveBox;
	/** Left hand, in figure-local units — the ring engine's chain anchor. */
	readonly handLeft: Point;
	/** Right hand, in figure-local units. */
	readonly handRight: Point;
	/** Limb and head arrangement. */
	readonly pose: BodyPose;
	/** What this figure carries, if anything. */
	readonly prop: PropName;
	/** The four ornament dials. */
	readonly ornament: OrnamentSet;
	/** Present only on the eight faced positions. */
	readonly face?: FaceSet;
	/** This figure's wobble seed. */
	readonly seed: number;
};

const scaleBox = (box: PrimitiveBox, k: number): PrimitiveBox => ({
	x: box.x * k,
	y: box.y * k,
	width: box.width * k,
	height: box.height * k,
});

const scalePoint = (point: Point, k: number): Point => ({
	x: point.x * k,
	y: point.y * k,
});

/** The faced positions are drawn larger, so the argument has the loudest voice. */
export const FACED_SCALE = 1.2;

/** The child is the one figure drawn smaller. */
const CHILD_SCALE = 0.62;

/* ------------------------------------------------------------------ *
 * The pose library. Every entry keeps |hand.x| ≥ 19; only `y` moves.
 * ------------------------------------------------------------------ */

/**
 * A raised arm has to STAY LINKED. The obvious way to draw a speaker is to free
 * one hand and lift it, which breaks the chain at exactly the figure whose whole
 * meaning is that they are addressing the others. Instead the hand rises and the
 * link rises with it, so the chord to the neighbour simply tilts. The chain
 * survives and the gesture still reads.
 */
const SPEAK: BodyPose = {
	...DEFAULT_POSE,
	handRight: { x: HAND_X - 1, y: -53 },
};

/** A bowed head: lower, and carried slightly forward of the spine. */
const LISTEN: BodyPose = {
	...DEFAULT_POSE,
	headCentre: { x: 2.5, y: -46.5 },
};

/** Both hands up — the carrying pose, a load taken on the head. */
const CARRY: BodyPose = {
	handLeft: { x: -HAND_X, y: -51 },
	handRight: { x: HAND_X, y: -51 },
	headCentre: { x: 0, y: -52 },
};

/** Both hands down and the head forward: bent to the ground. */
const STOOP: BodyPose = {
	handLeft: { x: -HAND_X - 1, y: -31 },
	handRight: { x: HAND_X + 1, y: -31 },
	headCentre: { x: 3, y: -47 },
};

/** One hand high, one low — hauling, or working a tool. */
const HAUL: BodyPose = {
	handLeft: { x: -HAND_X, y: -52 },
	handRight: { x: HAND_X, y: -33 },
	headCentre: { x: 0, y: -52 },
};

/** The mirror of `HAUL`, so a crowd does not lean uniformly one way. */
const HAUL_REVERSED: BodyPose = {
	handLeft: { x: -HAND_X, y: -33 },
	handRight: { x: HAND_X, y: -52 },
	headCentre: { x: 0, y: -52 },
};

/** Hands raised beside a lowered head. */
const MOURN: BodyPose = {
	handLeft: { x: -HAND_X, y: -49 },
	handRight: { x: HAND_X, y: -49 },
	headCentre: { x: 0, y: -46 },
};

/** Elbows lifted into the dance carriage. */
const DANCE: BodyPose = { ...DEFAULT_POSE, bentArms: true };

/**
 * ⚠ THE CHILD'S HANDS ARE UNSCALED HERE, AND THAT IS THE WHOLE POINT.
 *
 * `BodyPose` is consumed INSIDE `<g transform="scale(k)">` (`body.tsx`), so
 * every coordinate in it is in BODY space and the group scales it. `headCentre`
 * was always left alone for exactly this reason; the hands were not, and the
 * scale therefore landed on them twice.
 *
 * Measured on the rendered output before the fix: the child's hands were DRAWN
 * at `(±7.688, −15.376)` while the ring engine attached the hand chain at
 * `(±12.4, −24.8)` — a gap of **10.536 units, 29% of the child's own height**.
 * Two visible consequences: its arms hung nearly straight down instead of
 * reaching out like the others, and both link arcs terminated in mid-air beside
 * a hand that was somewhere else.
 *
 * ⛔ AND THE COMMENT IN `figure()` BELOW USED TO ASSERT THE OPPOSITE — that
 * scaling there "would apply it twice". It was the missing scale, not a second
 * one. A confident comment pointing the wrong way is worse than none, because it
 * tells the next reader the question has already been settled.
 */
const CHILD: BodyPose = { ...DEFAULT_POSE, scale: CHILD_SCALE };

function figure(
	id: string,
	label: string,
	prop: PropName,
	seed: number,
	pose: BodyPose = DEFAULT_POSE,
	face?: FaceSet,
): FigureSpec {
	const k = pose.scale ?? 1;
	return {
		id: `warli-${id}`,
		label,
		// `box` and the hand anchors are FIGURE-space: what the ring engine sees
		// after the body's own `<g transform="scale(k)">` has been applied. The
		// pose is BODY-space. Both conversions therefore happen here, together,
		// and a figure that scales its body without scaling its anchors hangs the
		// chain off a point no hand occupies. See CHILD.
		box: k === 1 ? FIGURE_BOX : scaleBox(FIGURE_BOX, k),
		handLeft: k === 1 ? pose.handLeft : scalePoint(pose.handLeft, k),
		handRight: k === 1 ? pose.handRight : scalePoint(pose.handRight, k),
		pose,
		prop,
		ornament: ornamentFor(seed),
		...(face === undefined ? {} : { face }),
		seed,
	};
}

/** The `i`th face, or a loud failure rather than a silent `undefined`. */
function faceAt(i: number): FaceSet {
	const set = FACE_SETS[i];
	if (set === undefined) {
		throw new Error(
			`WARLI: no face at index ${i} — FACE_SETS holds ${FACE_SETS.length}`,
		);
	}
	return set;
}

const faced = (
	id: string,
	label: string,
	prop: PropName,
	seed: number,
	i: number,
	pose: BodyPose = DEFAULT_POSE,
): FigureSpec =>
	figure(
		id,
		label,
		prop,
		seed,
		{ ...pose, scale: (pose.scale ?? 1) * FACED_SCALE },
		// ⚠ CHECKED, NOT CAST. `FACE_SETS` holds exactly eight entries and the ring
		// takes exactly eight, so `as FaceSet` held — until a ninth faced figure,
		// where it would hand `undefined` to a component that dereferences
		// `set.brow` and throw at RENDER time, far from the array that caused it.
		// AGENTS.md §4 allows `as` at trust boundaries; a local index is not one.
		faceAt(i),
	);

/**
 * THE INNER RING — eight faced positions, in four opposed pairs.
 *
 * ⚠ THE ORDER IS THE ARGUMENT AND IT IS LOAD-BEARING. Index `i` and index `i+4`
 * sit at exactly 180° on an eight-figure ring, so listing the four pairs as
 * `0,1,2,3` and then their opposites as `4,5,6,7` is what puts each position
 * physically across the ring from the one it is arguing with. Reorder this array
 * and the pairs stop facing each other while every other test still passes —
 * which is why `OPPOSED_PAIRS` is derived from the offset rather than written
 * out a second time, and why a guard checks the 180° directly.
 *
 * ⚠ THIS RE-HOMES THE PAIRS RELATIVE TO WARLI-1, where each pair straddled the
 * two rings. Both members now stand on the SAME ring. That is what makes "at
 * 180° across the ring" a true sentence, and it frees the outer ring to be what
 * it should always have been: a crowd, not a second team.
 */
export const INNER_FIGURES: readonly FigureSpec[] = [
	faced("scholar", "scholar", "book", 101, 0),
	faced("soldier", "soldier", "spear", 102, 1),
	faced("priest", "priest", "vessel", 103, 2),
	faced("merchant", "merchant", "scales", 104, 3),
	faced("labourer", "labourer", "adze", 105, 4),
	faced("student", "student", "slate", 106, 5),
	faced("scientist", "scientist", "lens", 107, 6),
	faced("farmer", "farmer", "sickle", 108, 7),
];

/**
 * THE OUTER RING — twelve faceless figures, counter-rotating.
 *
 * The crowd, continuously passing between the named positions. Nobody arrives,
 * nobody wins. Twelve rather than eight so the two rings do not share a period:
 * with equal and opposite speeds, 8 against 12 means a given outer figure meets
 * a given inner one only every third convergence, and the ring never settles
 * into a repeating pairing the eye can memorise.
 */
export const OUTER_FIGURES: readonly FigureSpec[] = [
	figure("speaker", "speaker", "none", 201, SPEAK),
	figure("elder", "elder", "staff", 202),
	figure("weaver", "weaver", "loom", 203),
	figure("musician", "musician", "tarpa", 204),
	figure("listener", "listener", "none", 205, LISTEN),
	figure("child", "child", "none", 206, CHILD),
	figure("builder", "builder", "post", 207),
	figure("dancer", "dancer", "none", 208, DANCE),
	figure("carrier", "carrier", "basket", 209, CARRY),
	figure("herder", "herder", "staff", 210, HAUL),
	figure("potter", "potter", "vessel", 211),
	figure("drummer", "drummer", "drum", 212, DANCE),
];

/**
 * THE STATIC FIELD — twenty-eight people, absorbed in their own work.
 *
 * ⚠ THEY DO NOT ROTATE, AND THAT IS THE POINT OF THEM. The two rings turn
 * because the argument turns; the world does not. A field that rotated with the
 * rings would say the work is part of the debate, when the whole claim is that
 * it carries on regardless of it — and it would also put every figure in the
 * frame into the animated layer, which is the composition's entire frame budget
 * spent on people who are not moving.
 */
export const FIELD_FIGURES: readonly FigureSpec[] = [
	figure("field-plougher", "plougher", "plough", 301, STOOP),
	figure("field-sower", "sower", "basket", 302, STOOP),
	figure("field-reaper", "reaper", "sickle", 303, HAUL),
	figure("field-winnower", "winnower", "winnow", 304, CARRY),
	figure("field-thresher", "thresher", "staff", 305, HAUL_REVERSED),
	figure("field-carrier-a", "water carrier", "vessel", 306, CARRY),
	figure("field-carrier-b", "load carrier", "basket", 307, CARRY),
	figure("field-drawer", "well drawer", "vessel", 308, STOOP),
	figure("field-builder-a", "post setter", "post", 309, HAUL),
	figure("field-builder-b", "thatcher", "none", 310, CARRY),
	figure("field-carpenter", "carpenter", "adze", 311, STOOP),
	figure("field-potter", "potter", "vessel", 312, STOOP),
	figure("field-weaver", "weaver", "loom", 313),
	figure("field-teacher", "teacher", "slate", 314, SPEAK),
	figure("field-pupil-a", "pupil", "none", 315, CHILD),
	figure("field-pupil-b", "pupil", "slate", 316, CHILD),
	figure("field-elder-a", "elder", "staff", 317),
	figure("field-elder-b", "elder", "staff", 318, LISTEN),
	figure("field-mourner-a", "mourner", "none", 319, MOURN),
	figure("field-mourner-b", "mourner", "none", 320, MOURN),
	figure("field-dancer-a", "dancer", "none", 321, DANCE),
	figure("field-dancer-b", "dancer", "none", 322, DANCE),
	figure("field-dancer-c", "dancer", "none", 323, DANCE),
	figure("field-drummer", "drummer", "drum", 324, DANCE),
	figure("field-piper", "piper", "tarpa", 325, HAUL_REVERSED),
	figure("field-herder", "herder", "staff", 326, HAUL),
	figure("field-hunter", "hunter", "spear", 327, HAUL_REVERSED),
	figure("field-child", "child", "none", 328, CHILD),
];

/**
 * The four oppositions, derived from the ring's own half-turn rather than
 * written out — so the table cannot drift from the geometry it describes.
 */
export const OPPOSED_PAIRS: readonly (readonly [FigureSpec, FigureSpec])[] =
	INNER_FIGURES.slice(0, INNER_FIGURES.length / 2).map((inner, i) => {
		const opposite = INNER_FIGURES[i + INNER_FIGURES.length / 2];
		if (opposite === undefined) {
			throw new Error(`WARLI: inner figure ${inner.id} has no opposite`);
		}
		return [inner, opposite] as const;
	});

/** Every figure that stands on a ring. */
export const RING_FIGURES: readonly FigureSpec[] = [
	...INNER_FIGURES,
	...OUTER_FIGURES,
];

/** Every figure in the piece, for registry-shaped assertions. */
export const ALL_FIGURES: readonly FigureSpec[] = [
	...INNER_FIGURES,
	...OUTER_FIGURES,
	...FIELD_FIGURES,
];

/** Renders one figure in the requested register, about its own feet. */
export function Figure({
	spec,
	density,
	transform,
}: {
	readonly spec: FigureSpec;
	readonly density: Density;
	readonly transform?: string;
}) {
	return (
		<g
			data-warli-id={spec.id}
			data-warli-label={spec.label}
			transform={transform}
		>
			<Body
				density={density}
				pose={spec.pose}
				prop={spec.prop}
				seed={spec.seed}
				ornament={spec.ornament}
				{...(spec.face === undefined ? {} : { face: spec.face })}
			/>
		</g>
	);
}

export type { BodyPose, Density, Point, PropName };
export { DEFAULT_POSE, FIGURE_BOX, HAND_X, HAND_Y };
