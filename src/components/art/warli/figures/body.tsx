import {
	Adze,
	Basket,
	BodyOrnament,
	Book,
	bangleAt,
	DotField,
	Drum,
	Face,
	type FaceSet,
	HatchFill,
	Head,
	HeadOrnament,
	Lens,
	Limb,
	Loom,
	type OrnamentSet,
	ornamentFor,
	Plough,
	Post,
	type PrimitiveBox,
	Run,
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
	Winnow,
} from "../primitives";

/**
 * The body every figure shares, and the dials that make fifty people out of one
 * drawing.
 *
 * ⚠ THE FIGURE'S OWN ORIGIN IS ITS FEET, AT LOCAL `(0, 0)`, and the body is
 * drawn upward in `−y` from there. That is not the natural origin for drawing —
 * the waist is, because it is where the two triangles meet and the one point
 * that does not move between poses — so the body is built about the waist and
 * then shifted down by `WAIST_Y`. The extra indirection buys the thing that
 * matters: the ring engine places a figure by putting its FEET on a circle, and
 * it should not have to know how tall the figure is to do that. A tree, a
 * scholar and a child all answer the same call.
 *
 * ⚠ THREE REGISTERS, AND THEY ARE THE PIECE'S ONLY DEPTH CUE. `solid` fills the
 * two triangles with ink and cuts the ornament back OUT of them in ground;
 * `dense` leaves them open and beds them in hatch and a dotted ground; `spare`
 * leaves them open and bare. All three are the same drawing at the same line
 * weight — what separates them is how much ink is on the paper. Value is
 * unavailable here on purpose (one colour, §3 of the plan), so density does the
 * work value normally would. Two registers in two greys would read as two
 * materials; three registers in one ink read as loud, ordinary and quiet.
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

/** The head's radius in body space, mirrored from `primitives/figure-parts`. */
const HEAD_R = 6;

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

/** Which register a figure is drawn in. See the docblock above. */
export type Density = "solid" | "dense" | "spare";

/** The carried objects, by name. `none` is a figure told apart by pose. */
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
	| "tarpa"
	| "drum"
	| "basket"
	| "plough"
	| "winnow";

export type BodyPose = {
	/** Where the left hand ends up, for the neighbour's link to reach. */
	readonly handLeft: Point;
	/** Where the right hand ends up. */
	readonly handRight: Point;
	/** Head centre. Lowering it reads as a bowed head. */
	readonly headCentre: Point;
	/** Elbows raised into the dance carriage rather than arms held straight. */
	readonly bentArms?: boolean;
	/** Uniform scale about the feet. */
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
	seed,
}: {
	readonly name: PropName;
	readonly weight: number;
	readonly seed: number;
}) {
	if (name === "none") {
		return null;
	}
	const at = `translate(${HOLD.x} ${HOLD.y})`;
	const held = {
		book: <Book transform={at} weight={weight} seed={seed} />,
		adze: <Adze transform={at} weight={weight} seed={seed} />,
		spear: <Spear transform={at} weight={weight} seed={seed} />,
		slate: <Slate transform={at} weight={weight} seed={seed} />,
		vessel: <Vessel transform={at} weight={weight} seed={seed} />,
		lens: <Lens transform={at} weight={weight} seed={seed} />,
		scales: <Scales transform={at} weight={weight} seed={seed} />,
		sickle: <Sickle transform={at} weight={weight} seed={seed} />,
		staff: <Staff transform={at} weight={weight} seed={seed} />,
		loom: <Loom transform={at} weight={weight} seed={seed} />,
		post: <Post transform={at} weight={weight} seed={seed} />,
		tarpa: <Tarpa transform={at} weight={weight} seed={seed} />,
		drum: <Drum transform={at} weight={weight} seed={seed} />,
		basket: <Basket transform={at} weight={weight} seed={seed} />,
		plough: <Plough transform={at} weight={weight} seed={seed} />,
		winnow: <Winnow transform={at} weight={weight} seed={seed} />,
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
				seed={seed}
			/>
			{held}
		</g>
	);
}

/** Two ticks across a limb near its far end — a wrist or an ankle ring. */
function Bangle({
	from,
	to,
	weight,
	seed,
}: {
	readonly from: Point;
	readonly to: Point;
	readonly weight: number;
	readonly seed: number;
}) {
	return (
		<>
			{[0.76, 0.87].map((at) => {
				const p = bangleAt(from.x, from.y, to.x, to.y, at);
				return (
					<Run
						key={at}
						x1={p.x - p.nx * 2.1}
						y1={p.y - p.ny * 2.1}
						x2={p.x + p.nx * 2.1}
						y2={p.y + p.ny * 2.1}
						seed={seed + at * 100}
						weight={weight}
					/>
				);
			})}
		</>
	);
}

/**
 * The shared body.
 *
 * Everything here is drawn from `../primitives` and nothing is drawn twice: the
 * fifty figures differ only in pose, prop, ornament, face and register, so a
 * change to how a person is BUILT lands on all fifty at once and cannot land on
 * forty-nine.
 */
export function Body({
	density,
	pose = DEFAULT_POSE,
	prop = "none",
	seed = 0,
	ornament,
	face,
}: {
	readonly density: Density;
	readonly pose?: BodyPose;
	readonly prop?: PropName;
	readonly seed?: number;
	readonly ornament?: OrnamentSet;
	readonly face?: FaceSet;
}) {
	const weight = WEIGHT_SPARE;
	const solid = density === "solid";
	const dense = density === "dense";
	const scale = pose.scale ?? 1;
	const dress = ornament ?? ornamentFor(seed);
	// Elbows sit outboard and ABOVE the shoulder line, so a bent arm reads as
	// lifted rather than merely crooked.
	const elbowLeft: Point = { x: -15, y: -48 };
	const elbowRight: Point = { x: 15, y: -48 };
	const shoulderLeft: Point = { x: -9, y: SHOULDER_Y + 1 };
	const shoulderRight: Point = { x: 9, y: SHOULDER_Y + 1 };

	return (
		<g
			data-warli-figure-body=""
			data-warli-register={density}
			transform={scale === 1 ? undefined : `scale(${scale})`}
		>
			{dense || solid ? (
				<DotField
					transform="translate(0 4)"
					cols={5}
					rows={2}
					step={7}
					r={1.1}
				/>
			) : null}

			{/* legs */}
			<Limb x1={-3} y1={HIP_Y} x2={-7} y2={0} weight={weight} seed={seed} />
			<Limb x1={3} y1={HIP_Y} x2={7} y2={0} weight={weight} seed={seed} />

			{/* torso — the two triangles, about the waist */}
			<Torso
				transform={`translate(0 ${WAIST_Y})`}
				weight={weight}
				seed={seed}
				solid={solid}
			/>
			{dense ? (
				<g data-warli-density="hatch">
					<HatchFill
						transform={`translate(0 ${WAIST_Y})`}
						halfWidth={9}
						height={15}
						apex="down"
						step={3.2}
						weight={WEIGHT_DENSE}
						seed={seed}
					/>
					<HatchFill
						transform={`translate(0 ${WAIST_Y})`}
						halfWidth={7.5}
						height={11}
						apex="up"
						step={3.2}
						weight={WEIGHT_DENSE}
						seed={seed}
					/>
				</g>
			) : null}

			{/* Ornament: reserved OUT of a solid body, laid ON an open one. This is
			    the one dial that makes fifty identical skeletons read as fifty
			    dressed people. */}
			<g transform={`translate(0 ${WAIST_Y})`}>
				<BodyOrnament set={dress} seed={seed} reserved={solid} />
			</g>

			{/* arms — straight to the hands, or lifted through an elbow */}
			{pose.bentArms ? (
				<g data-warli-arms="bent">
					<Limb
						x1={shoulderLeft.x}
						y1={shoulderLeft.y}
						x2={elbowLeft.x}
						y2={elbowLeft.y}
						weight={weight}
						seed={seed}
					/>
					<Limb
						x1={elbowLeft.x}
						y1={elbowLeft.y}
						x2={pose.handLeft.x}
						y2={pose.handLeft.y}
						weight={weight}
						seed={seed}
					/>
					<Limb
						x1={shoulderRight.x}
						y1={shoulderRight.y}
						x2={elbowRight.x}
						y2={elbowRight.y}
						weight={weight}
						seed={seed}
					/>
					<Limb
						x1={elbowRight.x}
						y1={elbowRight.y}
						x2={pose.handRight.x}
						y2={pose.handRight.y}
						weight={weight}
						seed={seed}
					/>
				</g>
			) : (
				<g data-warli-arms="straight">
					<Limb
						x1={shoulderLeft.x}
						y1={shoulderLeft.y}
						x2={pose.handLeft.x}
						y2={pose.handLeft.y}
						weight={weight}
						seed={seed}
					/>
					<Limb
						x1={shoulderRight.x}
						y1={shoulderRight.y}
						x2={pose.handRight.x}
						y2={pose.handRight.y}
						weight={weight}
						seed={seed}
					/>
				</g>
			)}

			{dress.bangles === "rings" ? (
				<g data-warli-bangles="">
					<Bangle
						from={pose.bentArms ? elbowLeft : shoulderLeft}
						to={pose.handLeft}
						weight={WEIGHT_DENSE}
						seed={seed + 3}
					/>
					<Bangle
						from={pose.bentArms ? elbowRight : shoulderRight}
						to={pose.handRight}
						weight={WEIGHT_DENSE}
						seed={seed + 5}
					/>
					<Bangle
						from={{ x: -3, y: HIP_Y }}
						to={{ x: -7, y: 0 }}
						weight={WEIGHT_DENSE}
						seed={seed + 7}
					/>
					<Bangle
						from={{ x: 3, y: HIP_Y }}
						to={{ x: 7, y: 0 }}
						weight={WEIGHT_DENSE}
						seed={seed + 11}
					/>
				</g>
			) : null}

			{/* neck and head */}
			<Limb
				x1={0}
				y1={SHOULDER_Y}
				x2={pose.headCentre.x}
				y2={pose.headCentre.y + 6}
				weight={weight}
				seed={seed}
			/>
			<g transform={`translate(${pose.headCentre.x} ${pose.headCentre.y})`}>
				{/* ⚠ A FACED HEAD IS NEVER FILLED. Ink over ink is invisible, so a face
				    inside a solid head would silently not exist — green everywhere,
				    absent on screen. The faced figures carry their weight in the body
				    instead, which is why `solid` fills the TRIANGLES and not the head. */}
				<Head
					filled={dense && face === undefined}
					weight={weight}
					seed={seed}
				/>
				{face === undefined ? null : (
					<Face set={face} radius={HEAD_R} seed={seed} />
				)}
				<HeadOrnament set={dress.headdress} radius={HEAD_R} seed={seed} />
			</g>

			<CarriedProp name={prop} weight={weight} seed={seed} />
		</g>
	);
}
