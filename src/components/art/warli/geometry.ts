/**
 * Ring placement. Pure arithmetic — no JSX, no DOM, no React — so the geometry
 * can be checked against numbers worked out by hand rather than against a
 * snapshot of itself.
 *
 * ⚠ THE ANGLE CONVENTION IS CLOCK, NOT MATHS. `0°` is straight UP and angles
 * increase CLOCKWISE, which is not the mathematical convention and is chosen
 * deliberately: every expected value in the accompanying test then has to be
 * derivable by pointing at a clock face, and an assertion a reader can check in
 * their head is worth more than one that is merely correct. In SVG's
 * y-grows-down space that makes the position
 *
 *     x = cx + R·sin θ        y = cy − R·cos θ
 *
 * so `θ = 90°` lands at three o'clock and `θ = 180°` at six.
 */

export type Point = { readonly x: number; readonly y: number };

/** Which way a figure's body points, relative to the ring's centre. */
export type Facing = "outward" | "inward";

export type RingParams = {
	readonly centre: Point;
	/** The circle the figures' FEET stand on. */
	readonly radius: number;
	readonly count: number;
	/** Angle of the first figure, in degrees clockwise from twelve o'clock. */
	readonly phaseDeg: number;
	readonly facing: Facing;
};

export type Placement = {
	readonly index: number;
	/** Clockwise from twelve o'clock. */
	readonly angleDeg: number;
	/** Where the figure's feet land, in ring space. */
	readonly foot: Point;
	/** Rotation applied to the figure, in degrees. */
	readonly rotationDeg: number;
	/** The composed SVG transform, ready for a `<g>`. */
	readonly transform: string;
};

/** A straight run of line between two already-placed hands. */
export type Chord = {
	readonly from: Point;
	readonly to: Point;
};

const DEG = Math.PI / 180;

/**
 * Rounds to 4 decimals, so two runs of the same input produce equal strings.
 *
 * ⚠ AND NORMALISES NEGATIVE ZERO, which is not a tidiness measure. `cos(90°)`
 * evaluates to 6.1e-17 rather than to zero, so `cy − R·cos θ` at three o'clock
 * lands on −6.1e-16, and `Math.round` PRESERVES THE SIGN OF ZERO — the ring's
 * three-o'clock position comes back as `{ x: 10, y: -0 }`. That renders
 * identically, because `${-0}` stringifies to `"0"`, so nothing on screen would
 * ever show it. What it breaks is comparison: `Object.is(-0, 0)` is false, so
 * every deep-equality assertion over placements becomes a coin flip on which
 * quadrant the caller asked about, and the determinism guard would eventually
 * fail for a reason that has nothing to do with determinism.
 *
 * Found by the hand-computed expectations in `tests/unit/art/ring-geometry.test.ts`
 * reddening on the first run — which is the entire argument for writing
 * expectations by hand rather than snapshotting the engine against itself. A
 * snapshot would have recorded `-0` as the correct answer and stayed green.
 */
const q = (n: number): number => {
	const rounded = Math.round(n * 1e4) / 1e4;
	return rounded === 0 ? 0 : rounded;
};

/** The point on a circle at `angleDeg` clockwise from twelve o'clock. */
export function pointOnRing(
	centre: Point,
	radius: number,
	angleDeg: number,
): Point {
	const a = angleDeg * DEG;
	return {
		x: q(centre.x + radius * Math.sin(a)),
		y: q(centre.y - radius * Math.cos(a)),
	};
}

/**
 * Applies a rotation about the origin, then a translation — the same order the
 * emitted `transform` string applies them, so a caller can compute where a
 * figure-local point ends up without parsing SVG.
 */
export function placeLocalPoint(
	local: Point,
	rotationDeg: number,
	translate: Point,
): Point {
	const a = rotationDeg * DEG;
	const cos = Math.cos(a);
	const sin = Math.sin(a);
	return {
		x: q(local.x * cos - local.y * sin + translate.x),
		y: q(local.x * sin + local.y * cos + translate.y),
	};
}

/**
 * Where each figure stands, and which way it points.
 *
 * A figure is drawn with its feet at local `(0, 0)` and its body running up the
 * `−y` axis, so at twelve o'clock an OUTWARD-facing figure needs no rotation at
 * all — its natural up IS the outward radius there. Every other position is that
 * same figure turned by its own angle, and an INWARD-facing ring is the same
 * again plus a half turn. Two lines of arithmetic, and no per-position special
 * cases to get wrong.
 */
export function ringPlacements(params: RingParams): readonly Placement[] {
	const { centre, radius, count, phaseDeg, facing } = params;
	const step = 360 / count;
	return Array.from({ length: count }, (_, index) => {
		const angleDeg = q(phaseDeg + step * index);
		const foot = pointOnRing(centre, radius, angleDeg);
		const rotationDeg = q(facing === "outward" ? angleDeg : angleDeg + 180);
		return {
			index,
			angleDeg,
			foot,
			rotationDeg,
			transform: `translate(${foot.x} ${foot.y}) rotate(${rotationDeg})`,
		};
	});
}

/**
 * The chain of hand links around a closed ring.
 *
 * ⚠ WHICH HAND REACHES WHICH NEIGHBOUR DEPENDS ON THE FACING, and getting it
 * wrong produces a ring that still looks linked while every figure is holding
 * the hand of the person behind them across the front of the person in front.
 * The reason is one sign: at twelve o'clock an outward-facing figure's local
 * `+x` points screen-right, which is CLOCKWISE — toward the next index. Turn
 * that figure to face inward and its local `+x` now points counter-clockwise,
 * toward the PREVIOUS index. So an outward ring joins right-hand-to-next-left,
 * and an inward ring joins left-hand-to-next-right. Both are computed here so
 * no caller has to remember it.
 */
export function ringLinks(
	placements: readonly Placement[],
	handLeftOf: (index: number) => Point,
	handRightOf: (index: number) => Point,
	facing: Facing,
): readonly Chord[] {
	const n = placements.length;
	if (n < 2) {
		return [];
	}
	return placements.map((placement, i) => {
		const nextIndex = (i + 1) % n;
		const next = placements[nextIndex];
		if (next === undefined) {
			throw new Error(`WARLI: ring index ${nextIndex} is missing`);
		}
		const fromLocal = facing === "outward" ? handRightOf(i) : handLeftOf(i);
		const toLocal =
			facing === "outward" ? handLeftOf(nextIndex) : handRightOf(nextIndex);
		return {
			from: placeLocalPoint(fromLocal, placement.rotationDeg, placement.foot),
			to: placeLocalPoint(toLocal, next.rotationDeg, next.foot),
		};
	});
}

/**
 * The angles halfway between neighbouring figures — where the field motifs go.
 *
 * Eight figures on a ring of radius 330 sit 259 units apart, and the tree,
 * deer, bird and house exist to occupy that. Deriving their angles from the
 * figures' own step, rather than declaring a second list of angles, means the
 * field cannot drift out of register with the ring when the count changes.
 */
export function interstitialAngles(
	count: number,
	phaseDeg: number,
): readonly number[] {
	const step = 360 / count;
	return Array.from({ length: count }, (_, i) =>
		q(phaseDeg + step * i + step / 2),
	);
}
