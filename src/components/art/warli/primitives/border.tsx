import { Dab, Run, Shape } from "./stroke";
import { type PrimitiveSpec, WEIGHT_DENSE, WEIGHT_SPARE } from "./types";
import type { WobblePoint } from "./wobble";

/**
 * The border stack — four stacked bands running the whole way round the frame.
 *
 * ⚠ THIS IS WHERE "FILL THE PAGE" IS ACTUALLY SOLVED, and the reason is
 * geometric rather than decorative. The composition's subject is two concentric
 * rings, and **a circle cannot fill a rectangle**. Whatever radius the rings
 * take, the four corners of a 1440 × 1000 frame are left over — and corners are
 * exactly where an empty area is most visible, because two straight edges meet
 * there and the eye follows both of them into the gap. Adding more figures does
 * not fix it; they would have to stand in a ring too. A border eats the corners
 * by construction: it is the one element whose shape is the frame's own.
 *
 * It also does the second thing a wall painting needs and a diagram never has —
 * it declares an EDGE. The tradition this borrows from paints inside a bordered
 * field, and a composition that fades out at its margins reads as a crop of
 * something larger, which is the opposite of what a self-contained argument
 * should look like.
 *
 * ⚠ ONE BAND IS AUTHORED AND PLACED FOUR TIMES. Every mark below is drawn in a
 * band-local space that runs along `+x` with depth growing in `+y` (inward), and
 * the four edges are that same band under four transforms. Authoring the corners
 * separately would be four times the code and four chances for the corner to
 * disagree with the edge it meets.
 *
 * It is entirely STATIC — none of this rotates — so it is allowed to be as dense
 * as it likes. It is the cheapest ink in the composition per unit of page filled.
 */

export const BORDER_BAND: PrimitiveSpec = {
	id: "warli-border-band",
	box: { x: 0, y: 0, width: 1440, height: 26 },
	origin: { x: 0, y: 0 },
};

/**
 * Total depth of the stack, measured inward from the frame edge.
 *
 * ⚠ TWENTY-SIX, AND IT IS A MEASURED CEILING RATHER THAN A TASTE. The first
 * build used 62, which looked right in isolation and was drawing straight
 * through the artwork: the outer ring's feet sit at radius 470 in a frame only
 * 500 units tall from the centre, so at twelve and six o'clock the ring reaches
 * y = 30 — thirty-two units INSIDE a 62-deep band. Measured overlap: 58 units
 * once the ring's own outward fringe was counted.
 *
 * The vertical budget is fixed by things that cannot move. The auth card's
 * half-diagonal is 317.6, so the inner ring cannot come in past ~330; the faced
 * figures stand 1.2 × 58 tall pointing outward, reaching 399.6; the outer ring's
 * figures point inward and need 58 of their own. That leaves
 * 500 − 470 = 30 units at top and bottom for everything else, and a border has
 * to fit inside it with clearance.
 *
 * ⚠ SO THE BORDER IS THIN AT THE TOP FOR A REASON, and the reason is that a
 * circle in a 1440 × 1000 rectangle has spare room at the SIDES and none above.
 * The composition fills the page from the left and right wings — which is where
 * the static field lives — not from a thick frame it has no room for.
 */
export const BORDER_DEPTH = 26;

/** A run of semicircular bumps, sampled as points because there is no arc verb. */
function scallopPoints(
	length: number,
	radius: number,
	baseline: number,
	facing: 1 | -1,
): WobblePoint[] {
	// `radius === 0` makes this `Infinity` and the loop below never returns. The
	// sole call site passes 4.5; the clamp keeps that a property of the code.
	const bumps = Math.max(1, Math.round(length / (Math.max(0.5, radius) * 2)));
	const span = length / bumps;
	const points: WobblePoint[] = [{ x: 0, y: baseline }];
	for (let i = 0; i < bumps; i++) {
		const left = i * span;
		// Five samples per bump: enough that a semicircle reads as one, few enough
		// that a border of ~55 bumps per edge stays under a few hundred points.
		for (let s = 1; s <= 4; s++) {
			const t = s / 4;
			const a = Math.PI * t;
			points.push({
				x: left + span * t,
				y: baseline - facing * Math.sin(a) * radius,
			});
		}
	}
	return points;
}

/**
 * One edge of the stack, in band-local space.
 *
 * The order outward-to-inward is deliberate and is the order a painter would
 * work in: the hard toothed edge first, then the heavy hatched bar that gives
 * the border its weight, then the softer scalloped lip facing the picture. A
 * border that put its softest element outermost would have no edge at all.
 */
export function BorderBand({
	length,
	seed = 0,
	weight = WEIGHT_DENSE,
}: {
	readonly length: number;
	readonly seed?: number;
	readonly weight?: number;
}) {
	const teeth = Math.max(1, Math.round(length / 16));
	const toothSpan = length / teeth;
	const dots = Math.max(1, Math.round(length / 18));

	// ⚠ POSITIONS, NOT INDICES. Each row below maps over the x-coordinates it is
	// going to draw at rather than over a count, so every React key is the mark's
	// own place on the band. Keying by index is what `noArrayIndexKey` objects to
	// and it is the wrong key here on the merits too: these rows are regenerated
	// whenever `length` changes, and an index key would let React reconcile the
	// third tooth of a 1440-run onto the third tooth of a 1000-run, which are
	// different marks in different places.
	const toothXs = Array.from({ length: teeth }, (_, i) => i * toothSpan);
	const hatchXs = Array.from(
		{ length: Math.round(length / 9) },
		(_, i) => i * 9,
	);
	const dotXs = Array.from({ length: dots }, (_, i) => i * (length / dots));

	return (
		<g data-warli-id={BORDER_BAND.id}>
			{/* 1 · the outermost rule, hard against the frame edge */}
			<Run
				x1={0}
				y1={2}
				x2={length}
				y2={2}
				seed={seed + 1}
				weight={weight}
				cap="butt"
			/>

			{/* 2 · a triangle-tooth row hanging inward off it */}
			<g data-warli-border-row="teeth">
				{toothXs.map((x) => (
					<Shape
						key={x}
						points={[
							{ x, y: 2 },
							{ x: x + toothSpan / 2, y: 8.5 },
							{ x: x + toothSpan, y: 2 },
						]}
						seed={seed + x}
						weight={weight}
						close={false}
					/>
				))}
			</g>

			{/* 3 · the hatched bar — the band's weight */}
			<g data-warli-border-row="hatch">
				<Run
					x1={0}
					y1={11.5}
					x2={length}
					y2={11.5}
					seed={seed + 5}
					weight={weight}
					cap="butt"
				/>
				<Run
					x1={0}
					y1={19}
					x2={length}
					y2={19}
					seed={seed + 7}
					weight={weight}
					cap="butt"
				/>
				{hatchXs.map((x) => (
					<Run
						key={x}
						x1={x}
						y1={19}
						x2={x + 5.5}
						y2={11.5}
						seed={seed + x}
						weight={weight * 0.7}
						cap="butt"
					/>
				))}
			</g>

			{/* 4 · a dotted rule */}
			<g data-warli-border-row="dots">
				{dotXs.map((x) => (
					<Dab key={x} cx={x + 5} cy={22.5} r={0.95} />
				))}
			</g>

			{/* 5 · the scalloped lip, facing the picture */}
			<g data-warli-border-row="scallop">
				{/* ⚠ BASELINE 21.5, NOT 26, BECAUSE THE BUMPS RISE INWARD FROM IT.
				    `scallopPoints(…, radius 4.5, baseline b, facing −1)` peaks at
				    `b + 4.5`, so a baseline equal to BORDER_DEPTH put the lip 4.5
				    units PAST the depth this file declares — plus half a stroke, a
				    true drawn depth of 31.3 against a declared 26. Everything that
				    reserves space against `BORDER_DEPTH` was reserving against a
				    number the border did not honour. Setting the baseline so the
				    PEAK lands on 26 makes the constant true rather than aspirational. */}
				<Shape
					points={scallopPoints(length, 4.5, BORDER_DEPTH - 4.5, -1)}
					seed={seed + 11}
					weight={weight}
					close={false}
				/>
			</g>
		</g>
	);
}

/**
 * The stack on all four edges.
 *
 * ⚠ THE FOUR TRANSFORMS ARE THE WHOLE TRICK AND THEY ARE EASY TO GET WRONG.
 * SVG composes left to right, so each is read as "move to this corner, then turn
 * so the band runs along the edge with its depth pointing inward":
 *
 *   top    · translate(0 0)         rotate(0)    → (t,d) ↦ (t, d)
 *   right  · translate(W 0)         rotate(90)   → (t,d) ↦ (W−d, t)
 *   bottom · translate(W H)         rotate(180)  → (t,d) ↦ (W−t, H−d)
 *   left   · translate(0 H)         rotate(270)  → (t,d) ↦ (d, H−t)
 *
 * Each maps depth `d` to the inward direction for its own edge.
 *
 * ⚠ THEY OVERLAP AT THE CORNERS RATHER THAN MEETING, and this sentence used to
 * claim otherwise. Top spans x∈[0,W]×y∈[0,26] and right spans x∈[W−26,W]×y∈[0,H],
 * so each corner is inked twice, in a 26 × 26 square. The OUTCOME is good — a
 * double-inked corner reads as woven, which is what a real border does where two
 * runs cross — but a docblock that names a mechanism the code does not implement
 * is how the next reader debugs the wrong thing.
 * Each edge also takes its own seed, so the same band drawn four times is four
 * different hands rather than one stamp rotated — a rotated stamp is visible at
 * the corners, where the identical wobble appears twice at ninety degrees.
 */
export function BorderStack({
	width,
	height,
	seed = 0,
	weight = WEIGHT_SPARE,
}: {
	readonly width: number;
	readonly height: number;
	readonly seed?: number;
	readonly weight?: number;
}) {
	const edges = [
		{ name: "top", transform: "translate(0 0) rotate(0)", length: width },
		{
			name: "right",
			transform: `translate(${width} 0) rotate(90)`,
			length: height,
		},
		{
			name: "bottom",
			transform: `translate(${width} ${height}) rotate(180)`,
			length: width,
		},
		{
			name: "left",
			transform: `translate(0 ${height}) rotate(270)`,
			length: height,
		},
	] as const;

	return (
		<g data-warli-border="">
			{edges.map((edge, i) => (
				<g
					key={edge.name}
					data-warli-border-edge={edge.name}
					transform={edge.transform}
				>
					<BorderBand
						length={edge.length}
						seed={seed + i * 977}
						weight={weight}
					/>
				</g>
			))}
		</g>
	);
}
