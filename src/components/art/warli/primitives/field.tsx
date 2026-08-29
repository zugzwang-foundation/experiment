import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The field: what stands between the figures.
 *
 * Eight figures on a ring of circumference 2073 sit 259 units apart, and a
 * 58-unit figure leaves a great deal of nothing in between. That emptiness is a
 * real compositional problem and these four are the answer — not as decoration
 * added to fill space, but because the tradition this borrows from never draws
 * people alone. A dance is drawn with the trees, animals and houses it happens
 * among, and a ring of figures on blank ground would be a diagram of the idea
 * rather than a picture of it.
 *
 * ⚠ ALL FOUR STAND ON THEIR BASELINE at local `(0, 0)` and grow UPWARD in `−y`,
 * exactly as a figure does. That shared convention is what lets the ring engine
 * place a tree and a scholar with the same call.
 */

const STROKE = "currentColor";

export const TREE: PrimitiveSpec = {
	id: "warli-tree",
	box: { x: -11, y: -30, width: 22, height: 30 },
	origin: { x: 0, y: 0 },
};

/**
 * A trunk with branches paired off it, each pair shorter than the one below.
 *
 * The taper is computed rather than drawn by hand — branch `i` reaches
 * `spread · (1 − i/branches · 0.55)` — because hand-picked branch lengths on a
 * shape that repeats eight times around a ring produce eight trees that are
 * subtly, distractingly different, and the eye finds the irregularity before it
 * finds the figures.
 */
export function Tree({
	height = 30,
	branches = 4,
	spread = 11,
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps & {
	readonly height?: number;
	readonly branches?: number;
	readonly spread?: number;
}) {
	const rungs = Array.from({ length: branches }, (_, i) => {
		// Branches start above the bare trunk and climb to just under the crown.
		const y = -height * (0.42 + (0.5 * i) / Math.max(branches - 1, 1));
		const reach = spread * (1 - (i / branches) * 0.55);
		return { y, reach };
	});
	return (
		<g data-warli-id={TREE.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={-height}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			{rungs.map((rung) => (
				<g key={rung.y}>
					<line
						x1={0}
						y1={rung.y}
						x2={-rung.reach}
						y2={rung.y - rung.reach * 0.55}
						stroke={STROKE}
						strokeWidth={weight}
						strokeLinecap="round"
					/>
					<line
						x1={0}
						y1={rung.y}
						x2={rung.reach}
						y2={rung.y - rung.reach * 0.55}
						stroke={STROKE}
						strokeWidth={weight}
						strokeLinecap="round"
					/>
				</g>
			))}
		</g>
	);
}

export const DEER: PrimitiveSpec = {
	id: "warli-deer",
	box: { x: -13, y: -24, width: 26, height: 24 },
	origin: { x: 0, y: 0 },
};

/** A deer: a body bar on four legs, a raised neck, a head, two antlers. */
export function Deer({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={DEER.id} transform={transform} className={className}>
			{/* body */}
			<line
				x1={-9}
				y1={-11}
				x2={7}
				y2={-11}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			{/* four legs */}
			{[-8, -4.5, 3, 6.5].map((x) => (
				<line
					key={x}
					x1={x}
					y1={-11}
					x2={x}
					y2={0}
					stroke={STROKE}
					strokeWidth={weight}
					strokeLinecap="round"
				/>
			))}
			{/* neck, head, antlers */}
			<line
				x1={7}
				y1={-11}
				x2={11}
				y2={-18}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<circle cx={11.5} cy={-19.5} r={2.4} fill={STROKE} />
			<line
				x1={11}
				y1={-21.5}
				x2={8.5}
				y2={-24}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<line
				x1={12.5}
				y1={-21.5}
				x2={13}
				y2={-24}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			{/* tail */}
			<line
				x1={-9}
				y1={-11}
				x2={-12}
				y2={-14}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
		</g>
	);
}

export const BIRD: PrimitiveSpec = {
	id: "warli-bird",
	box: { x: -10, y: -12, width: 20, height: 12 },
	origin: { x: 0, y: 0 },
};

/**
 * A bird: a body dot between two swept wings and a beak.
 *
 * Its baseline is the TAIL rather than a pair of feet, so a bird placed on the
 * ring sits in the air above it instead of standing on it — which is the point
 * of having a bird in a composition whose every other element is planted.
 */
export function Bird({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={BIRD.id} transform={transform} className={className}>
			<polyline
				points="-10,-4 -3,-9 0,-6"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<polyline
				points="0,-6 3,-9 10,-4"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<circle cx={0} cy={-5} r={2} fill={STROKE} />
			<line
				x1={0}
				y1={-5}
				x2={0}
				y2={0}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
		</g>
	);
}

export const HUT: PrimitiveSpec = {
	id: "warli-hut",
	box: { x: -13, y: -26, width: 26, height: 26 },
	origin: { x: 0, y: 0 },
};

/** A house: a pitched roof over a wall, with a doorway. */
export function Hut({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={HUT.id} transform={transform} className={className}>
			<polygon
				points="-13,-14 0,-26 13,-14"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
			<polygon
				points="-10,-14 10,-14 10,0 -10,0"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
			<polygon
				points="-3.5,0 -3.5,-8 3.5,-8 3.5,0"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
		</g>
	);
}
