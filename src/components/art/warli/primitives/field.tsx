import { Dab, Run, Shape } from "./stroke";
import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The field: what stands between the figures.
 *
 * A ring of figures on blank ground is a diagram of the idea rather than a
 * picture of it — the tradition this borrows from never draws people alone. A
 * dance is drawn with the trees, animals and houses it happens among, and the
 * emptiness between figures is a real compositional problem rather than a place
 * to put decoration.
 *
 * ⚠ ALL OF THESE STAND ON THEIR BASELINE at local `(0, 0)` and grow UPWARD in
 * `−y`, exactly as a figure does. That shared convention is what lets the scene
 * engine place a tree and a scholar with the same call. The one exception is
 * `Bird`, whose baseline is its TAIL rather than a pair of feet, so a bird placed
 * on a line sits in the air above it instead of standing on it — which is the
 * point of having a bird in a composition whose every other element is planted.
 */

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
 * shape that repeats dozens of times around a frame produce dozens of trees that
 * are subtly, distractingly different, and the eye finds the irregularity before
 * it finds the figures. What varies between trees is the SEED, which moves the
 * hand rather than the botany.
 */
export function Tree({
	height = 30,
	branches = 4,
	spread = 11,
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
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
			<Run x1={0} y1={0} x2={0} y2={-height} seed={seed} weight={weight} />
			{rungs.map((rung) => (
				<g key={rung.y}>
					<Run
						x1={0}
						y1={rung.y}
						x2={-rung.reach}
						y2={rung.y - rung.reach * 0.55}
						seed={seed}
						weight={weight}
					/>
					<Run
						x1={0}
						y1={rung.y}
						x2={rung.reach}
						y2={rung.y - rung.reach * 0.55}
						seed={seed}
						weight={weight}
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
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={DEER.id} transform={transform} className={className}>
			<Run x1={-9} y1={-11} x2={7} y2={-11} seed={seed} weight={weight} />
			{[-8, -4.5, 3, 6.5].map((x) => (
				<Run
					key={x}
					x1={x}
					y1={-11}
					x2={x}
					y2={0}
					seed={seed}
					weight={weight}
				/>
			))}
			<Run x1={7} y1={-11} x2={11} y2={-18} seed={seed} weight={weight} />
			<Dab cx={11.5} cy={-19.5} r={2.4} />
			<Run x1={11} y1={-21.5} x2={8.5} y2={-24} seed={seed} weight={weight} />
			<Run x1={12.5} y1={-21.5} x2={13} y2={-24} seed={seed} weight={weight} />
			<Run x1={-9} y1={-11} x2={-12} y2={-14} seed={seed} weight={weight} />
		</g>
	);
}

export const BIRD: PrimitiveSpec = {
	id: "warli-bird",
	box: { x: -10, y: -12, width: 20, height: 12 },
	origin: { x: 0, y: 0 },
};

/** A bird: a body dot between two swept wings and a tail. */
export function Bird({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={BIRD.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -10, y: -4 },
					{ x: -3, y: -9 },
					{ x: 0, y: -6 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
			<Shape
				points={[
					{ x: 0, y: -6 },
					{ x: 3, y: -9 },
					{ x: 10, y: -4 },
				]}
				seed={seed + 1}
				weight={weight}
				close={false}
			/>
			<Dab cx={0} cy={-5} r={2} />
			<Run x1={0} y1={-5} x2={0} y2={0} seed={seed} weight={weight} />
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
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={HUT.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -13, y: -14 },
					{ x: 0, y: -26 },
					{ x: 13, y: -14 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: -10, y: -14 },
					{ x: 10, y: -14 },
					{ x: 10, y: 0 },
					{ x: -10, y: 0 },
				]}
				seed={seed + 2}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: -3.5, y: 0 },
					{ x: -3.5, y: -8 },
					{ x: 3.5, y: -8 },
					{ x: 3.5, y: 0 },
				]}
				seed={seed + 4}
				weight={weight}
			/>
		</g>
	);
}
