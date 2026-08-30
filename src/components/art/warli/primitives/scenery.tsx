import { Dab, Disc, Run, Shape } from "./stroke";
import {
	type PrimitiveProps,
	type PrimitiveSpec,
	WEIGHT_DENSE,
	WEIGHT_SPARE,
} from "./types";

/**
 * The world the figures are standing in, and the objects lying about in it.
 *
 * ⚠ THESE ARE THE MARKS THAT MAKE THE FRAME A PLACE RATHER THAN A BACKGROUND.
 * A ring of people on empty ground is a diagram; the same ring among granaries,
 * ladders, ploughed fields and a moon is a wall painting of somewhere. The
 * difference is not quantity — it is that these say the argument is happening
 * IN a world that has work going on in it, which is the piece's whole reason for
 * having a static field at all.
 *
 * Everything stands on its baseline at local `(0, 0)` and grows upward in `−y`,
 * except `Hills` and `Moon`, which are centred marks and say so.
 */

export const PALM: PrimitiveSpec = {
	id: "warli-palm",
	box: { x: -14, y: -38, width: 28, height: 38 },
	origin: { x: 0, y: 0 },
};

/**
 * A palm: a bare trunk with fronds thrown off the top.
 *
 * The counterweight to `Tree`, whose branches pair symmetrically up a trunk. A
 * field of one tree shape repeats visibly; two tree shapes with genuinely
 * different silhouettes do not, and the palm is the cheapest second silhouette
 * available — all the mass at the top, nothing on the way up.
 */
export function Palm({
	height = 34,
	fronds = 7,
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps & { readonly height?: number; readonly fronds?: number }) {
	return (
		<g data-warli-id={PALM.id} transform={transform} className={className}>
			<Run x1={0} y1={0} x2={0} y2={-height} seed={seed} weight={weight} />
			{/* ⚠ THE FRONDS REACH 20, NOT 13, AND DROOP HARD AT THE TIP. At the
			    shorter reach the palm read on the plate as a bare pole with a
			    smudge on top — the crown simply was not wide enough to register
			    against a 34-unit trunk, and the whole point of having a palm beside
			    a `Tree` is that the two silhouettes differ. A palm is all mass at
			    the top; if the top is not visibly wider than the trunk it is not a
			    palm, it is a stick. */}
			{Array.from({ length: fronds }, (_, i) => {
				const spread = -78 + (156 * i) / Math.max(fronds - 1, 1);
				const rad = ((spread - 90) * Math.PI) / 180;
				return (
					<Shape
						key={spread}
						points={[
							{ x: 0, y: -height },
							{ x: Math.cos(rad) * 10, y: -height + Math.sin(rad) * 10 },
							{
								x: Math.cos(rad) * 20,
								y: -height + Math.sin(rad) * 20 + 6.5,
							},
						]}
						seed={seed + i * 7}
						weight={weight}
						close={false}
					/>
				);
			})}
		</g>
	);
}

export const GRANARY: PrimitiveSpec = {
	id: "warli-granary",
	box: { x: -12, y: -28, width: 24, height: 28 },
	origin: { x: 0, y: 0 },
};

/** A raised grain store: a thatched drum standing off the ground on legs. */
export function Granary({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={GRANARY.id} transform={transform} className={className}>
			<Run x1={-7} y1={-6} x2={-7} y2={0} seed={seed} weight={weight} />
			<Run x1={7} y1={-6} x2={7} y2={0} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -9, y: -6 },
					{ x: 9, y: -6 },
					{ x: 7.5, y: -19 },
					{ x: -7.5, y: -19 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: -11, y: -19 },
					{ x: 0, y: -28 },
					{ x: 11, y: -19 },
				]}
				seed={seed + 3}
				weight={weight}
			/>
			<Run x1={-7} y1={-12} x2={7} y2={-12} seed={seed} weight={weight * 0.8} />
		</g>
	);
}

export const HILLS: PrimitiveSpec = {
	id: "warli-hills",
	box: { x: -34, y: -16, width: 68, height: 16 },
	origin: { x: 0, y: 0 },
};

/**
 * A range of hills — a single run of peaks, the horizon of the whole piece.
 *
 * ⚠ IT IS ONE RUN, NOT THREE TRIANGLES. Overlapping triangles would give the
 * outline a seam at every valley where two strokes cross, and the eye reads a
 * seam as a mistake. A single polyline across the peaks is what a brush actually
 * does and what a horizon actually looks like.
 */
export function Hills({
	peaks = 3,
	width = 68,
	height = 16,
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps & {
	readonly peaks?: number;
	readonly width?: number;
	readonly height?: number;
}) {
	const points: Array<{ x: number; y: number }> = [{ x: -width / 2, y: 0 }];
	for (let i = 0; i < peaks; i++) {
		const span = width / peaks;
		const left = -width / 2 + span * i;
		// Peaks alternate height so a range does not read as a repeated tooth.
		const h = height * (i % 2 === 0 ? 1 : 0.68);
		points.push({ x: left + span / 2, y: -h });
		points.push({ x: left + span, y: 0 });
	}
	return (
		<g data-warli-id={HILLS.id} transform={transform} className={className}>
			<Shape points={points} seed={seed} weight={weight} close={false} />
		</g>
	);
}

export const FIELDS: PrimitiveSpec = {
	id: "warli-fields",
	box: { x: -22, y: -10, width: 44, height: 10 },
	origin: { x: 0, y: 0 },
};

/** A ploughed plot: a slanted lozenge ruled with furrows. */
export function Fields({
	width = 44,
	depth = 10,
	furrows = 5,
	transform,
	className,
	weight = WEIGHT_DENSE,
	seed = 0,
}: PrimitiveProps & {
	readonly width?: number;
	readonly depth?: number;
	readonly furrows?: number;
}) {
	const w = width / 2;
	return (
		<g data-warli-id={FIELDS.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -w, y: 0 },
					{ x: -w + 6, y: -depth },
					{ x: w, y: -depth },
					{ x: w - 6, y: 0 },
				]}
				seed={seed}
				weight={weight}
			/>
			{Array.from({ length: furrows }, (_, i) => {
				const t = (i + 1) / (furrows + 1);
				return (
					<Run
						key={t}
						x1={-w + t * (width - 6)}
						y1={0}
						x2={-w + 6 + t * (width - 6)}
						y2={-depth}
						seed={seed + i * 5}
						weight={weight * 0.8}
					/>
				);
			})}
		</g>
	);
}

export const MOON: PrimitiveSpec = {
	id: "warli-moon",
	box: { x: -9, y: -9, width: 18, height: 18 },
	origin: { x: 0, y: 0 },
};

/**
 * A crescent, drawn about its own centre.
 *
 * The counterpart to `Sun`, and the reason both exist: a wall painting is not a
 * snapshot. Sun and moon in the same frame say the work goes on and the argument
 * goes on, which is a thing this composition wants to say and cannot say with a
 * ring alone.
 */
export function Moon({
	radius = 8,
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps & { readonly radius?: number }) {
	const pts: Array<{ x: number; y: number }> = [];
	// Outer arc, then an inner arc back — the gap between them is the crescent.
	for (let i = 0; i <= 9; i++) {
		const a = -Math.PI / 2 + (Math.PI * i) / 9;
		pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
	}
	for (let i = 9; i >= 0; i--) {
		const a = -Math.PI / 2 + (Math.PI * i) / 9;
		pts.push({ x: Math.cos(a) * radius * 0.45, y: Math.sin(a) * radius });
	}
	return (
		<g data-warli-id={MOON.id} transform={transform} className={className}>
			<Shape points={pts} seed={seed} weight={weight} />
		</g>
	);
}

export const LADDER: PrimitiveSpec = {
	id: "warli-ladder",
	box: { x: -6, y: -30, width: 12, height: 30 },
	origin: { x: 0, y: 0 },
};

/** A ladder, leaning. Rails and rungs, and nothing else. */
export function Ladder({
	height = 30,
	rungs = 5,
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps & { readonly height?: number; readonly rungs?: number }) {
	const lean = 5;
	return (
		<g data-warli-id={LADDER.id} transform={transform} className={className}>
			<Run
				x1={-4}
				y1={0}
				x2={-4 + lean}
				y2={-height}
				seed={seed}
				weight={weight}
			/>
			<Run
				x1={4}
				y1={0}
				x2={4 + lean}
				y2={-height}
				seed={seed}
				weight={weight}
			/>
			{Array.from({ length: rungs }, (_, i) => {
				const t = (i + 0.5) / rungs;
				return (
					<Run
						key={t}
						x1={-4 + lean * t}
						y1={-height * t}
						x2={4 + lean * t}
						y2={-height * t}
						seed={seed + i * 3}
						weight={weight * 0.85}
					/>
				);
			})}
		</g>
	);
}

export const CART: PrimitiveSpec = {
	id: "warli-cart",
	box: { x: -16, y: -16, width: 32, height: 16 },
	origin: { x: 0, y: 0 },
};

/** A bullock cart: a bed on two spoked wheels, with a shaft running forward. */
export function Cart({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={CART.id} transform={transform} className={className}>
			{[-7, 6].map((x) => (
				<g key={x}>
					<Disc cx={x} cy={-4.5} r={4.5} seed={seed + x} weight={weight} />
					<Run
						x1={x - 3.2}
						y1={-4.5}
						x2={x + 3.2}
						y2={-4.5}
						seed={seed + x}
						weight={weight * 0.7}
					/>
					<Run
						x1={x}
						y1={-7.7}
						x2={x}
						y2={-1.3}
						seed={seed + x + 1}
						weight={weight * 0.7}
					/>
				</g>
			))}
			<Shape
				points={[
					{ x: -11, y: -9 },
					{ x: 10, y: -9 },
					{ x: 10, y: -15 },
					{ x: -11, y: -15 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Run x1={10} y1={-11} x2={16} y2={-13} seed={seed} weight={weight} />
		</g>
	);
}

export const POT: PrimitiveSpec = {
	id: "warli-pot",
	box: { x: -8, y: -14, width: 16, height: 14 },
	origin: { x: 0, y: 0 },
};

/** A standing water pot — the same vessel as the held one, but on the ground. */
export function Pot({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={POT.id} transform={transform} className={className}>
			{/* ⚠ THE MOUTH IS NARROW AND THE RIM STANDS CLEAR OF THE SHOULDER. The
			    first version put the rim at y = −13.4 across a body whose top edge
			    was already at −13, so the two merged into one flat line and the pot
			    read on the plate as a plain heptagon. A pot is a WIDE BELLY UNDER A
			    NARROW NECK; if the neck is as wide as the belly there is no pot,
			    only a shape. */}
			<Shape
				points={[
					{ x: -2.6, y: -11 },
					{ x: -6.5, y: -7.5 },
					{ x: -6, y: -2 },
					{ x: 0, y: 0 },
					{ x: 6, y: -2 },
					{ x: 6.5, y: -7.5 },
					{ x: 2.6, y: -11 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
			<Run x1={-2.6} y1={-11} x2={-4.2} y2={-14} seed={seed} weight={weight} />
			<Run x1={2.6} y1={-11} x2={4.2} y2={-14} seed={seed} weight={weight} />
			<Run
				x1={-4.4}
				y1={-14}
				x2={4.4}
				y2={-14}
				seed={seed + 3}
				weight={weight}
			/>
		</g>
	);
}

/* ------------------------------------------------------------------ *
 * Four more held objects, for the outer ring and the static field.
 * They live here rather than in `props.tsx` because each is ALSO a
 * standalone motif the scene engine places on the ground — a drum leaning
 * against a hut, a basket set down beside a field. Splitting them by whether
 * a hand happens to be on them would put the same drawing in two files.
 * ------------------------------------------------------------------ */

export const DRUM: PrimitiveSpec = {
	id: "warli-drum",
	box: { x: -7, y: 0, width: 14, height: 14 },
	origin: { x: 0, y: 0 },
};

/** A barrel drum, laced along its side. */
export function Drum({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={DRUM.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -6, y: 1 },
					{ x: 6, y: 1 },
					{ x: 5, y: 13 },
					{ x: -5, y: 13 },
				]}
				seed={seed}
				weight={weight}
			/>
			{[-3, 0, 3].map((x) => (
				<Run
					key={x}
					x1={x - 1.5}
					y1={2}
					x2={x + 1.5}
					y2={12}
					seed={seed + x}
					weight={weight * 0.7}
				/>
			))}
		</g>
	);
}

export const BASKET: PrimitiveSpec = {
	id: "warli-basket",
	box: { x: -8, y: 0, width: 16, height: 12 },
	origin: { x: 0, y: 0 },
};

/** A carrying basket: a tapered bowl, woven across. */
export function Basket({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={BASKET.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -7.5, y: 2 },
					{ x: 7.5, y: 2 },
					{ x: 5, y: 12 },
					{ x: -5, y: 12 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Run x1={-6.4} y1={6} x2={6.4} y2={6} seed={seed} weight={weight * 0.7} />
			<Run x1={-7.5} y1={2} x2={7.5} y2={2} seed={seed + 1} weight={weight} />
		</g>
	);
}

export const PLOUGH: PrimitiveSpec = {
	id: "warli-plough",
	box: { x: -4, y: 0, width: 22, height: 18 },
	origin: { x: 0, y: 0 },
};

/** An ard plough: a beam, a share dropped from it, and a handle. */
export function Plough({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={PLOUGH.id} transform={transform} className={className}>
			{/* ⚠ THE SHARE IS THE BIGGEST MARK, AND THAT IS WHAT MAKES IT A PLOUGH.
			    The first version drew a long beam with a small triangle hung off it,
			    and at twenty units it read as a bent hook — the beam dominated and
			    the share, the only part that says "plough", was a speck. Same
			    lesson as the bestiary: at this scale a silhouette is one thing with
			    one thing sticking out of it, and the identifying feature has to BE
			    the silhouette rather than an attachment to it. */}
			<Run x1={-3} y1={1} x2={16} y2={7} seed={seed} weight={weight} />
			<Run x1={16} y1={7} x2={18} y2={3} seed={seed} weight={weight} />
			<Run x1={-3} y1={1} x2={-2} y2={11} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -2, y: 11 },
					{ x: 8, y: 15 },
					{ x: 1, y: 18 },
				]}
				seed={seed + 2}
				weight={weight}
				fill="currentColor"
			/>
		</g>
	);
}

export const WINNOW: PrimitiveSpec = {
	id: "warli-winnow",
	box: { x: -9, y: 0, width: 18, height: 14 },
	origin: { x: 0, y: 0 },
};

/** A winnowing fan: a flat scoop, open at the front, with grain falling. */
export function Winnow({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={WINNOW.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -4, y: 2 },
					{ x: 4, y: 2 },
					{ x: 8.5, y: 10 },
					{ x: -8.5, y: 10 },
				]}
				seed={seed}
				weight={weight}
			/>
			{[-4, 0, 4].map((x) => (
				<Dab key={x} cx={x} cy={13} r={0.9} />
			))}
		</g>
	);
}
