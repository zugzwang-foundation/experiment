import type { ReactNode } from "react";
import { type Density, Figure, type FigureSpec } from "./figures";
import {
	type Facing,
	interstitialAngles,
	type Point,
	pointOnRing,
	ringLinks,
	ringPlacements,
} from "./geometry";
import {
	Bird,
	bowedCircle,
	Chauk,
	CombBorderSegment,
	Deer,
	HandLink,
	Hut,
	Spiral,
	Sun,
	Tree,
	WaterLine,
	WEIGHT_DENSE,
	WEIGHT_SPARE,
} from "./primitives";

/**
 * One ring: figures stood evenly around a circle, joined hand to hand, with the
 * field motifs filling what is left between them.
 *
 * ⚠ THIS COMPONENT DOES NOT ANIMATE AND MUST NOT LEARN HOW. Everything here is
 * a deterministic function of its props — same inputs, byte-identical output —
 * which is what makes the geometry testable at all and what lets `hero.tsx`
 * take the whole ring and turn it with a single CSS transform on a wrapping
 * `<g>`. The moment placement depended on time, the snapshot guard would be
 * asserting against a moving target and the animation would be re-laying out
 * sixteen figures a frame instead of compositing two groups.
 *
 * The dense/spare split is expressed twice, and both are deliberate. Inside a
 * figure it is hatch, filled heads and dotted ground (`figures/body.tsx`).
 * Around the ring it is the ground itself: the dense ring stands on a drawn
 * baseline edged with comb, the spare ring stands on nothing at all. That
 * second difference does more work than the first at a distance, because at
 * hero scale an individual figure's hatch reads as weight long before it reads
 * as texture.
 */

export type RingProps = {
	readonly centre: Point;
	/** The circle the figures' feet stand on. */
	readonly radius: number;
	readonly figures: readonly FigureSpec[];
	readonly density: Density;
	readonly facing: Facing;
	/** Angle of the first figure, clockwise from twelve o'clock. */
	readonly phaseDeg: number;
	/** Marks this ring in the DOM, for tests and for the pointer handler. */
	readonly name: string;
	/**
	 * Draw the interstitial field motifs between this ring's figures.
	 *
	 * ⚠ THE OUTER RING TURNS THIS OFF, AND THE REASON IS THE FRAME, NOT TASTE.
	 * The spare field grows OUTWARD from the ring's baseline by up to 26 units,
	 * and the outer ring's baseline is at 470 in a frame whose half-height is
	 * 500 — so the fringe reached 496 and drew straight through the border. It
	 * existed in the first place because the area outside the rings was empty;
	 * WARLI-2's static field fills that far better and with actual scenery, so
	 * the fringe is now solving a problem that no longer exists at the cost of
	 * one that does.
	 */
	readonly showField?: boolean;
};

/**
 * The field motifs, in a fixed order per register.
 *
 * A CYCLE RATHER THAN A RANDOM PICK, and the reason is not determinism for its
 * own sake: eight motifs chosen at random around a ring cluster and leave gaps,
 * and the eye reads clustering as meaning. A fixed cycle distributes them
 * evenly, so the field stays field and never accidentally becomes a signal.
 *
 * ⚠ THE TWO REGISTERS DO NOT SHARE AN ORIGIN CONVENTION, which is why each
 * entry carries its own placement rather than all of them taking one rule.
 * `Tree`, `Deer`, `Hut` and `Bird` stand on a baseline exactly as a figure does,
 * so they take the figures' own transform untouched. `Chauk`, `Spiral` and
 * `WaterLine` are centred marks with no feet — they belong ON the line rather
 * than on top of it, and `WaterLine` additionally runs from its left end rather
 * than its middle. Writing "the field shares the figures' convention" would have
 * been a tidier sentence and false for three of the seven.
 */
type FieldMotif = (transform: string, weight: number) => ReactNode;

/** Mid-band of the dense ring, so the marks sit among the figures, not under. */
const DENSE_FIELD_LIFT = 26;

/**
 * ⚠ FOUR, NOT THREE, AND THE COUNT IS THE POINT. Three motifs over eight slots
 * is not a cycle that distributes evenly — it runs Chauk·Spiral·Water twice and
 * then stops mid-phrase, so Chauk appears three times, WaterLine twice, and the
 * sequence breaks at the wrap. That is precisely the clustering the docblock
 * above says a fixed cycle exists to prevent, committed by the fixed cycle.
 * Four divides eight.
 */
const FIELD_DENSE: readonly FieldMotif[] = [
	(t, w) => <Chauk transform={t} size={16} weight={w} />,
	(t, w) => <Spiral transform={t} turns={2.5} radius={9} weight={w} />,
	(t, w) => <Sun transform={t} radius={4} rayLength={4} rays={10} weight={w} />,
	(t, w) => (
		<WaterLine
			transform={`${t} translate(-13 0)`}
			length={26}
			amplitude={3}
			periods={4}
			weight={w}
		/>
	),
];

/**
 * ⚠ THE SPARE FIELD GROWS AWAY FROM THE GAP, not with the figures.
 *
 * The outer ring's figures are turned a half turn so they face inward, at the
 * band where the two rings confront each other. Applying that same half turn to
 * the landscape put the trees and houses INSIDE that band, growing toward the
 * centre — so the one place the eye is supposed to go was the most crowded
 * place in the drawing, and the confrontation had to compete with a hut.
 *
 * Turning the field outward instead puts it in a clean fringe beyond the
 * figures' feet and leaves the gap empty, which is what makes the gap read as a
 * gap. Their heights are capped so that fringe never reaches the frame edge at
 * any rotation phase: 470 + 26 = 496, inside 500.
 */
const FIELD_SPARE: readonly FieldMotif[] = [
	(t, w) => <Tree transform={t} height={26} spread={9} weight={w} />,
	(t, w) => <Deer transform={t} weight={w} />,
	(t, w) => <Hut transform={t} weight={w} />,
	(t, w) => <Bird transform={t} weight={w} />,
];

export function Ring({
	centre,
	radius,
	figures,
	density,
	facing,
	phaseDeg,
	name,
	showField = true,
}: RingProps) {
	const count = figures.length;
	const placements = ringPlacements({
		centre,
		radius,
		count,
		phaseDeg,
		facing,
	});

	const handLeftOf = (index: number): Point => {
		const spec = figures[index];
		if (spec === undefined) {
			throw new Error(`WARLI: no figure at index ${index} on ring ${name}`);
		}
		return spec.handLeft;
	};
	const handRightOf = (index: number): Point => {
		const spec = figures[index];
		if (spec === undefined) {
			throw new Error(`WARLI: no figure at index ${index} on ring ${name}`);
		}
		return spec.handRight;
	};

	const links = ringLinks(placements, handLeftOf, handRightOf, facing);
	const fieldAngles = interstitialAngles(count, phaseDeg);
	// ⚠ `solid` COUNTS AS DENSE HERE. WARLI-2 split the old two-value register
	// into three, and this line is the one place the ring cares: the ground
	// treatment — the drawn baseline and its comb — belongs to the LOUD ring,
	// whichever of the two loud registers it happens to be drawn in. Written as
	// `=== "dense"` it silently dropped the inner ring's entire ground the moment
	// the faced figures moved to `solid`, which reads as a missing circle rather
	// than as a register change.
	const dense = density === "dense" || density === "solid";
	const cycle = dense ? FIELD_DENSE : FIELD_SPARE;
	const weight = dense ? WEIGHT_DENSE : WEIGHT_SPARE;

	// The comb run is a straight tangent standing in for an arc.
	//
	// ⚠ THIS COMMENT USED TO CITE THE WRONG NUMBERS, and the way it went wrong is
	// worth keeping: it computed the departure from `CombBorderSegment`'s DEFAULT
	// length (28) at the DEFAULT weight (1.6) — "under a third of a unit, a fifth
	// of a line width" — while the call site overrides BOTH. At the values
	// actually passed the departure was 330 − √(330² − 32²) = 1.555 units, or
	// 1.7× the 0.9 line weight: five times the claimed figure, and a visible
	// sliver at each end of every run.
	//
	// Shortened to 44, which is the honest fix rather than a corrected sentence:
	//   330 − √(330² − 22²) = 0.734 units = 0.8× the line weight, sub-pixel at
	// 1440. Bending it would cost path arithmetic for a difference below the
	// stroke width.
	const combLength = 44;

	return (
		<g data-warli-ring={name} data-warli-density={density}>
			{dense ? (
				<g data-warli-ring-ground="">
					{/* ⚠ A BOWED PATH, NOT A `<circle>`. This is the single longest
					    continuous mark in the composition — about 2,073 units of arc —
					    and it was the one thing slice 2 missed: a machine-true circle
					    running behind fifty hand-drawn figures. `stroke.tsx` argues the
					    verbs exist so a mark CANNOT forget to be hand-drawn; this was
					    drawn without them. Sampled densely, because at this radius a
					    coarse polygon would read as a polygon. */}
					<path
						d={bowedCircle(centre.x, centre.y, radius, 4_099, {
							samples: 96,
							amplitude: 1.4,
						})}
						fill="none"
						stroke="currentColor"
						strokeWidth={WEIGHT_DENSE}
						strokeLinejoin="round"
					/>
					{fieldAngles.map((angle) => {
						const at = pointOnRing(centre, radius, angle);
						return (
							<CombBorderSegment
								key={`comb-${angle}`}
								transform={`translate(${at.x} ${at.y}) rotate(${angle}) translate(${-combLength / 2} 0)`}
								length={combLength}
								teeth={9}
								toothHeight={4}
								weight={WEIGHT_DENSE}
							/>
						);
					})}
				</g>
			) : null}

			<g data-warli-ring-links="">
				{links.map((chord) => {
					// The link bends along the circle the two hands sit on. Their radii
					// can differ — the speaker's hand is raised, the child's are low —
					// so the arc takes the mean, which is exact when they match and a
					// gentle sweep when they do not.
					const r1 = Math.hypot(
						chord.from.x - centre.x,
						chord.from.y - centre.y,
					);
					const r2 = Math.hypot(chord.to.x - centre.x, chord.to.y - centre.y);
					return (
						<HandLink
							key={`${chord.from.x}:${chord.from.y}:${chord.to.x}:${chord.to.y}`}
							x1={chord.from.x}
							y1={chord.from.y}
							x2={chord.to.x}
							y2={chord.to.y}
							arcRadius={Number(((r1 + r2) / 2).toFixed(2))}
							sweep={1}
							weight={WEIGHT_SPARE}
						/>
					);
				})}
			</g>

			<g data-warli-ring-field="">
				{(showField ? fieldAngles : []).map((angle, i) => {
					const motif = cycle[i % cycle.length];
					if (motif === undefined) {
						return null;
					}
					// The dense marks are centred, so they are lifted into the middle of
					// the band the figures occupy; the spare motifs have feet and stand
					// on the baseline itself.
					const at = pointOnRing(
						centre,
						dense
							? radius +
									(facing === "outward" ? DENSE_FIELD_LIFT : -DENSE_FIELD_LIFT)
							: radius,
						angle,
					);
					// The field turns AWAY from the gap: the dense ring's marks stay with
					// its figures (they are centred ornaments and carry no up), while
					// the spare ring's landscape grows outward into a fringe rather than
					// inward into the confrontation band. See FIELD_SPARE.
					const rotation = dense
						? facing === "outward"
							? angle
							: angle + 180
						: angle;
					return (
						<g key={`field-${angle}`}>
							{motif(`translate(${at.x} ${at.y}) rotate(${rotation})`, weight)}
						</g>
					);
				})}
			</g>

			<g data-warli-ring-figures="">
				{placements.map((placement) => {
					const spec = figures[placement.index];
					if (spec === undefined) {
						return null;
					}
					return (
						<Figure
							key={spec.id}
							spec={spec}
							density={density}
							transform={placement.transform}
						/>
					);
				})}
			</g>
		</g>
	);
}
