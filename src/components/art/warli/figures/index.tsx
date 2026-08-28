import type { PrimitiveBox } from "../primitives";
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
 * The sixteen, in eight opposed pairs.
 *
 * ⚠ EVERY FIGURE IS THE SAME DRAWING. Only two things vary: what is in the hand,
 * and how the limbs are angled. That is the argument the piece is making, put
 * into the code rather than into a caption — the ring is not eight kinds of
 * person against eight other kinds of person, it is sixteen identical bodies
 * holding different things, and the difference is entirely in what they carry.
 * If a later change makes one of these figures structurally distinct from the
 * others — a different build, a different height, a face — it will have quietly
 * reversed the thesis while looking like a styling tweak.
 *
 * Four of the sixteen carry nothing, and are told apart by pose alone: the
 * speaker's raised arm, the listener's lowered head, the child's scale, the
 * dancer's lifted elbows. They are the harder half to draw and the more
 * important half to keep, because a ring where identity is ONLY ever an object
 * would say that people are what they hold, which is a smaller idea.
 */

export type FigureSpec = {
	/** Stable, unique, `warli-` prefixed. */
	readonly id: string;
	/** The name this figure goes by in the pair table. */
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

/** The child is the one figure drawn at another size. */
const CHILD_SCALE = 0.62;

/**
 * A raised arm has to STAY LINKED. The obvious way to draw a speaker is to free
 * one hand and lift it, which breaks the chain at exactly the figure whose whole
 * meaning is that they are addressing the others. Instead the hand rises and the
 * link rises with it, so the chord to the neighbour simply tilts. The chain
 * survives and the gesture still reads.
 */
const SPEAKER_POSE: BodyPose = {
	...DEFAULT_POSE,
	handRight: { x: HAND_X - 1, y: -53 },
};

/** A bowed head: lower, and carried slightly forward of the spine. */
const LISTENER_POSE: BodyPose = {
	...DEFAULT_POSE,
	headCentre: { x: 2.5, y: -46.5 },
};

const CHILD_POSE: BodyPose = {
	handLeft: scalePoint(DEFAULT_POSE.handLeft, CHILD_SCALE),
	handRight: scalePoint(DEFAULT_POSE.handRight, CHILD_SCALE),
	headCentre: DEFAULT_POSE.headCentre,
	scale: CHILD_SCALE,
};

const DANCER_POSE: BodyPose = { ...DEFAULT_POSE, bentArms: true };

function figure(
	id: string,
	label: string,
	prop: PropName,
	pose: BodyPose = DEFAULT_POSE,
): FigureSpec {
	const k = pose.scale ?? 1;
	return {
		id: `warli-${id}`,
		label,
		box: k === 1 ? FIGURE_BOX : scaleBox(FIGURE_BOX, k),
		// The child's declared hands are ALREADY scaled in its pose, because the
		// scale is applied inside the body's own `<g>`; re-scaling here would
		// apply it twice and hang the chain off a point no hand occupies.
		handLeft: pose.handLeft,
		handRight: pose.handRight,
		pose,
		prop,
	};
}

/** The inner ring — drawn dense. */
export const INNER_FIGURES: readonly FigureSpec[] = [
	figure("scholar", "scholar", "book"),
	figure("soldier", "soldier", "spear"),
	figure("priest", "priest", "vessel"),
	figure("merchant", "merchant", "scales"),
	figure("speaker", "speaker", "none", SPEAKER_POSE),
	figure("elder", "elder", "staff"),
	figure("weaver", "weaver", "loom"),
	figure("musician", "musician", "tarpa"),
];

/** The outer ring — drawn spare. Index `i` faces `INNER_FIGURES[i]`. */
export const OUTER_FIGURES: readonly FigureSpec[] = [
	figure("labourer", "labourer", "adze"),
	figure("student", "student", "slate"),
	figure("scientist", "scientist", "lens"),
	figure("farmer", "farmer", "sickle"),
	figure("listener", "listener", "none", LISTENER_POSE),
	figure("child", "child", "none", CHILD_POSE),
	figure("builder", "builder", "post"),
	figure("dancer", "dancer", "none", DANCER_POSE),
];

/**
 * The eight oppositions, stated once so nothing has to re-derive them from two
 * array literals that could drift apart.
 */
export const OPPOSED_PAIRS: readonly (readonly [FigureSpec, FigureSpec])[] =
	INNER_FIGURES.map((inner, i) => {
		const outer = OUTER_FIGURES[i];
		if (outer === undefined) {
			throw new Error(`WARLI: inner figure ${inner.id} has no opposite`);
		}
		return [inner, outer] as const;
	});

/** Every figure, in one list, for registry-shaped assertions. */
export const ALL_FIGURES: readonly FigureSpec[] = [
	...INNER_FIGURES,
	...OUTER_FIGURES,
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
			<Body density={density} pose={spec.pose} prop={spec.prop} />
		</g>
	);
}

export type { BodyPose, Density, Point, PropName };
export { DEFAULT_POSE, FIGURE_BOX, HAND_X, HAND_Y };
