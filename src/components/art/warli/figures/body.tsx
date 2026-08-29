import {
	Adze,
	Book,
	DotField,
	HatchFill,
	Head,
	Lens,
	Limb,
	Loom,
	Post,
	type PrimitiveBox,
	Scales,
	Sickle,
	Slate,
	Spear,
	Staff,
	Tarpa,
	Torso,
	Vessel,
	WEIGHT_DENSE,
	WEIGHT_SPARE,
} from "../primitives";

/**
 * The body every figure shares, and the four dials that make sixteen people out
 * of one drawing.
 *
 * ⚠ THE FIGURE'S OWN ORIGIN IS ITS FEET, AT LOCAL `(0, 0)`, and the body is
 * drawn upward in `−y` from there. That is not the natural origin for drawing —
 * the waist is, because it is where the two triangles meet and the one point
 * that does not move between poses — so the body is built about the waist and
 * then shifted down by `WAIST_Y`. The extra indirection buys the thing that
 * matters: the ring engine places a figure by putting its FEET on a circle, and
 * it should not have to know how tall the figure is to do that. A tree, a
 * scholar and a child all answer the same call.
 */

/** How much of the drawing sits above the feet. Total figure height. */
export const FIGURE_HEIGHT = 58;

/** The waist, in feet-relative coordinates — where the two triangles meet. */
export const WAIST_Y = -29;

/** The shoulder line. */
export const SHOULDER_Y = -44;

/** The hip line, where the legs start. */
export const HIP_Y = -18;

/** Where an unmodified hand sits, measured from the feet. */
export const HAND_Y = -40;

/** How far out an unmodified hand reaches. */
export const HAND_X = 20;

/**
 * The declared extent of a figure. ASYMMETRIC ON PURPOSE — every held object
 * hangs on the right, so the box reaches further that way. Rounding it to a
 * symmetric box would be tidier and would describe a figure that does not
 * exist.
 */
export const FIGURE_BOX: PrimitiveBox = {
	x: -22,
	y: -FIGURE_HEIGHT,
	width: 52,
	height: FIGURE_HEIGHT,
};

export type Point = { readonly x: number; readonly y: number };

/**
 * Which register a figure is drawn in.
 *
 * `dense` and `spare` are the SAME figure at the SAME line weight — the
 * difference is hatch inside the triangles, a filled head, and a lattice of
 * dots for ground. Depth in a one-colour piece has to come from how much ink is
 * on the paper, because the alternative — two greys — would read as two
 * materials and quietly reintroduce a value scale the brand does not have.
 */
export type Density = "dense" | "spare";

/** The twelve carried objects, by name. `none` is a figure told apart by pose. */
export type PropName =
	| "none"
	| "book"
	| "adze"
	| "spear"
	| "slate"
	| "vessel"
	| "lens"
	| "scales"
	| "sickle"
	| "staff"
	| "loom"
	| "post"
	| "tarpa";

export type BodyPose = {
	/** Where the left hand ends up, for the neighbour's link to reach. */
	readonly handLeft: Point;
	/** Where the right hand ends up. */
	readonly handRight: Point;
	/** Head centre. Lowering it reads as a bowed head. */
	readonly headCentre: Point;
	/** Elbows raised into the dance carriage rather than arms held straight. */
	readonly bentArms?: boolean;
	/** Uniform scale about the feet. Only the child uses it. */
	readonly scale?: number;
};

export const DEFAULT_POSE: BodyPose = {
	handLeft: { x: -HAND_X, y: HAND_Y },
	handRight: { x: HAND_X, y: HAND_Y },
	headCentre: { x: 0, y: -52 },
};

/** Where a carried object is gripped — just under the right forearm. */
const HOLD: Point = { x: 16, y: -37 };

/** The point on the right forearm the object's stem hangs from. */
const HOLD_STEM_TOP = -41.1;

function CarriedProp({
	name,
	weight,
}: {
	readonly name: PropName;
	readonly weight: number;
}) {
	if (name === "none") {
		return null;
	}
	const at = `translate(${HOLD.x} ${HOLD.y})`;
	const held = {
		book: <Book transform={at} weight={weight} />,
		adze: <Adze transform={at} weight={weight} />,
		spear: <Spear transform={at} weight={weight} />,
		slate: <Slate transform={at} weight={weight} />,
		vessel: <Vessel transform={at} weight={weight} />,
		lens: <Lens transform={at} weight={weight} />,
		scales: <Scales transform={at} weight={weight} />,
		sickle: <Sickle transform={at} weight={weight} />,
		staff: <Staff transform={at} weight={weight} />,
		loom: <Loom transform={at} weight={weight} />,
		post: <Post transform={at} weight={weight} />,
		tarpa: <Tarpa transform={at} weight={weight} />,
	}[name];
	return (
		<g data-warli-hold={name}>
			{/* The stem is what makes the object READ as carried rather than as a
			    second thing standing nearby. Four units of line, doing the work of
			    a hand nobody can draw at this size. */}
			<Limb
				x1={HOLD.x}
				y1={HOLD_STEM_TOP}
				x2={HOLD.x}
				y2={HOLD.y}
				weight={weight}
			/>
			{held}
		</g>
	);
}

/**
 * The shared body.
 *
 * Everything here is drawn from `../primitives` and nothing is drawn twice: the
 * sixteen figures differ only in `pose` and `prop`, so a change to how a person
 * is built lands on all sixteen at once and cannot land on fifteen.
 */
export function Body({
	density,
	pose = DEFAULT_POSE,
	prop = "none",
}: {
	readonly density: Density;
	readonly pose?: BodyPose;
	readonly prop?: PropName;
}) {
	const weight = WEIGHT_SPARE;
	const dense = density === "dense";
	const scale = pose.scale ?? 1;
	// Elbows sit outboard and ABOVE the shoulder line, so a bent arm reads as
	// lifted rather than merely crooked.
	const elbowLeft: Point = { x: -15, y: -48 };
	const elbowRight: Point = { x: 15, y: -48 };

	return (
		<g
			data-warli-figure-body=""
			transform={scale === 1 ? undefined : `scale(${scale})`}
		>
			{dense ? (
				<DotField
					transform="translate(0 4)"
					cols={5}
					rows={2}
					step={7}
					r={1.1}
				/>
			) : null}

			{/* legs */}
			<Limb x1={-3} y1={HIP_Y} x2={-7} y2={0} weight={weight} />
			<Limb x1={3} y1={HIP_Y} x2={7} y2={0} weight={weight} />

			{/* torso — the two triangles, about the waist */}
			<Torso transform={`translate(0 ${WAIST_Y})`} weight={weight} />
			{dense ? (
				<g data-warli-density="hatch">
					<HatchFill
						transform={`translate(0 ${WAIST_Y})`}
						halfWidth={9}
						height={15}
						apex="down"
						step={3.2}
						weight={WEIGHT_DENSE}
					/>
					<HatchFill
						transform={`translate(0 ${WAIST_Y})`}
						halfWidth={7.5}
						height={11}
						apex="up"
						step={3.2}
						weight={WEIGHT_DENSE}
					/>
				</g>
			) : null}

			{/* arms — straight to the hands, or lifted through an elbow */}
			{pose.bentArms ? (
				<g data-warli-arms="bent">
					<Limb
						x1={-9}
						y1={SHOULDER_Y + 1}
						x2={elbowLeft.x}
						y2={elbowLeft.y}
						weight={weight}
					/>
					<Limb
						x1={elbowLeft.x}
						y1={elbowLeft.y}
						x2={pose.handLeft.x}
						y2={pose.handLeft.y}
						weight={weight}
					/>
					<Limb
						x1={9}
						y1={SHOULDER_Y + 1}
						x2={elbowRight.x}
						y2={elbowRight.y}
						weight={weight}
					/>
					<Limb
						x1={elbowRight.x}
						y1={elbowRight.y}
						x2={pose.handRight.x}
						y2={pose.handRight.y}
						weight={weight}
					/>
				</g>
			) : (
				<g data-warli-arms="straight">
					<Limb
						x1={-9}
						y1={SHOULDER_Y + 1}
						x2={pose.handLeft.x}
						y2={pose.handLeft.y}
						weight={weight}
					/>
					<Limb
						x1={9}
						y1={SHOULDER_Y + 1}
						x2={pose.handRight.x}
						y2={pose.handRight.y}
						weight={weight}
					/>
				</g>
			)}

			{/* neck and head */}
			<Limb
				x1={0}
				y1={SHOULDER_Y}
				x2={pose.headCentre.x}
				y2={pose.headCentre.y + 6}
				weight={weight}
			/>
			<Head
				transform={`translate(${pose.headCentre.x} ${pose.headCentre.y})`}
				filled={dense}
				weight={weight}
			/>

			<CarriedProp name={prop} weight={weight} />
		</g>
	);
}
