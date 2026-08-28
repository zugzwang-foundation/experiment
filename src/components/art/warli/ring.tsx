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
	Chauk,
	CombBorderSegment,
	Deer,
	HandLink,
	Hut,
	Spiral,
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

const FIELD_DENSE: readonly FieldMotif[] = [
	(t, w) => <Chauk transform={t} size={16} weight={w} />,
	(t, w) => <Spiral transform={t} turns={2.5} radius={9} weight={w} />,
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

const FIELD_SPARE: readonly FieldMotif[] = [
	(t, w) => <Tree transform={t} weight={w} />,
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
	const dense = density === "dense";
	const cycle = dense ? FIELD_DENSE : FIELD_SPARE;
	const weight = dense ? WEIGHT_DENSE : WEIGHT_SPARE;

	// The comb run is a straight chord standing in for an arc. At this radius a
	// 64-unit chord departs from the circle by under a third of a unit, which is
	// a fifth of a line width — so bending it would cost path arithmetic to
	// produce a difference nothing can see.
	const combLength = 64;

	return (
		<g data-warli-ring={name} data-warli-density={density}>
			{dense ? (
				<g data-warli-ring-ground="">
					<circle
						cx={centre.x}
						cy={centre.y}
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={WEIGHT_DENSE}
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
				{links.map((chord) => (
					<HandLink
						key={`${chord.from.x}:${chord.from.y}:${chord.to.x}:${chord.to.y}`}
						x1={chord.from.x}
						y1={chord.from.y}
						x2={chord.to.x}
						y2={chord.to.y}
						weight={WEIGHT_SPARE}
					/>
				))}
			</g>

			<g data-warli-ring-field="">
				{fieldAngles.map((angle, i) => {
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
					const rotation = facing === "outward" ? angle : angle + 180;
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
