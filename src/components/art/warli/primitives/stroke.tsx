import { WEIGHT_SPARE } from "./types";
import {
	bowedCircle,
	bowedLine,
	bowedPath,
	seedFrom,
	type WobblePoint,
} from "./wobble";

/**
 * Three drawing verbs, and every mark in this layer is made of them.
 *
 * ⚠ THEY EXIST BECAUSE THE ALTERNATIVE WAS A HUNDRED CALL SITES EACH DECIDING
 * WHETHER TO WOBBLE. Before this file, a straight run was `<line x1 y1 x2 y2
 * stroke strokeWidth>` written out wherever it was needed — thirty-one times in
 * the held objects alone, and about to be several hundred more across the
 * bestiary, the scenery, the border stack and the worked ground. Adding the hand
 * to each of those individually is not merely tedious; it is a guarantee that
 * some of them will be missed, and a wall where nine marks in ten wander and the
 * tenth is machine-true looks like a bug rather than like a hand.
 *
 * Routing every mark through three verbs makes the wobble a property of the
 * VOCABULARY rather than of the discipline of whoever is drawing. A new motif
 * cannot forget to be hand-drawn, because there is nothing available to draw it
 * with that is not.
 *
 * ⚠ AND THE VERBS ARE DELIBERATELY POOR. There is no arc, no cubic, no gradient,
 * no dash. Warli-inspired geometric figuration is circle, triangle, line and dot,
 * and a vocabulary that CANNOT express a swash is worth more than a note asking
 * nobody to write one.
 */

const STROKE = "currentColor";

export type StrokeProps = {
	readonly seed?: number;
	readonly weight?: number;
	readonly className?: string;
	readonly transform?: string;
};

/** One straight run, bowed in the middle, exact at both ends. */
export function Run({
	x1,
	y1,
	x2,
	y2,
	seed = 0,
	weight = WEIGHT_SPARE,
	cap = "round",
	amplitude,
	className,
	transform,
}: StrokeProps & {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
	readonly cap?: "round" | "butt";
	readonly amplitude?: number;
}) {
	return (
		<path
			d={bowedLine(x1, y1, x2, y2, seedFrom(seed, x1, y1, x2, y2), amplitude)}
			fill="none"
			stroke={STROKE}
			strokeWidth={weight}
			strokeLinecap={cap}
			className={className}
			transform={transform}
		/>
	);
}

/**
 * A run of points, every edge bowed and every vertex exact.
 *
 * `fill` takes `currentColor` for a solid, which is how ornament gets reserved
 * out of a body: the solid is drawn in ink, the ornament over it in ground.
 */
export function Shape({
	points,
	seed = 0,
	weight = WEIGHT_SPARE,
	fill = "none",
	close = true,
	amplitude,
	className,
	transform,
}: StrokeProps & {
	readonly points: readonly WobblePoint[];
	readonly fill?: string;
	readonly close?: boolean;
	readonly amplitude?: number;
}) {
	return (
		<path
			d={bowedPath(points, seed, {
				close,
				...(amplitude === undefined ? {} : { amplitude }),
			})}
			fill={fill}
			stroke={STROKE}
			strokeWidth={weight}
			strokeLinejoin="round"
			strokeLinecap="round"
			className={className}
			transform={transform}
		/>
	);
}

/** A circle drawn by hand: centre exact, rim wandering. */
export function Disc({
	cx = 0,
	cy = 0,
	r,
	seed = 0,
	weight = WEIGHT_SPARE,
	fill = "none",
	samples,
	className,
	transform,
}: StrokeProps & {
	readonly cx?: number;
	readonly cy?: number;
	readonly r: number;
	readonly fill?: string;
	readonly samples?: number;
}) {
	return (
		<path
			d={bowedCircle(cx, cy, r, seedFrom(seed, cx, cy, r), {
				...(samples === undefined ? {} : { samples }),
			})}
			fill={fill}
			stroke={STROKE}
			strokeWidth={weight}
			strokeLinejoin="round"
			className={className}
			transform={transform}
		/>
	);
}

/**
 * A true dot. The one mark that is NOT bowed, and the exception is the point:
 * a dot has no length for a hand to wander across, and a wobbled two-unit circle
 * is not a hand-made dot, it is a blob with a defect.
 */
export function Dab({
	cx = 0,
	cy = 0,
	r = 1.4,
	className,
	transform,
}: {
	readonly cx?: number;
	readonly cy?: number;
	readonly r?: number;
	readonly className?: string;
	readonly transform?: string;
}) {
	return (
		<circle
			cx={cx}
			cy={cy}
			r={r}
			fill={STROKE}
			className={className}
			transform={transform}
		/>
	);
}
