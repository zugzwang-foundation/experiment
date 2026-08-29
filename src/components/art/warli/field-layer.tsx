import { FIELD_FIGURES, Figure } from "./figures";
import {
	Basket,
	Bird,
	BorderStack,
	Bullock,
	Cart,
	Chauk,
	Crab,
	Deer,
	Dog,
	DotField,
	Drum,
	Fields,
	Fish,
	Granary,
	HatchFill,
	Hills,
	Horse,
	Hut,
	Ladder,
	Monkey,
	Moon,
	Palm,
	Peacock,
	Plough,
	Pot,
	Rooster,
	Scorpion,
	Snake,
	Spiral,
	Sun,
	Tiger,
	Tree,
	WaterLine,
	WEIGHT_DENSE,
	WEIGHT_SPARE,
	Winnow,
} from "./primitives";
import {
	FRAME,
	type GroundMark,
	type PlacedMotif,
	placeFieldFigures,
	placeGroundMarks,
	placeMotifs,
} from "./scene";

/**
 * Everything in the frame that does not turn.
 *
 * ⚠ THIS LAYER IS THE ANSWER TO BOTH OF THE PIECE'S PROBLEMS AT ONCE, which is
 * why it is one component rather than three.
 *
 * The compositional problem: two rings on a 1440 × 1000 field leave most of the
 * frame empty, and the piece read as two thin circles with specks on them. The
 * fix is not a bigger ring — it is a world for the ring to be happening in.
 *
 * The performance problem: before this, every drawn shape in the composition sat
 * inside a rotating group, so the whole drawing was in the animated layer.
 * Putting the population HERE means the frame budget is spent on twenty figures
 * that actually move, while a hundred and thirty items and several hundred
 * ground marks are painted once and never touched again.
 *
 * The two answers agreeing is not a coincidence. The things that should be dense
 * are the things that are standing still.
 */

/** How many of each population the composition carries. */
export const FIELD_FIGURE_COUNT = 28;
export const MOTIF_COUNT = 104;
export const GROUND_MARK_COUNT = 330;

/**
 * One motif, by name.
 *
 * ⚠ A LOOKUP RATHER THAN A SWITCH, because the scene engine picks a `kind`
 * string and the two lists must not be able to drift. A name in `SCENE_MOTIFS`
 * with no entry here renders nothing — silently, and looking exactly like a
 * sparse patch of composition rather than like a bug — so a guard asserts the
 * two sets match exactly.
 */
export const MOTIF_RENDERERS: Record<
	string,
	(seed: number, weight: number) => React.ReactNode
> = {
	tree: (s, w) => <Tree seed={s} weight={w} height={30} />,
	palm: (s, w) => <Palm seed={s} weight={w} />,
	hut: (s, w) => <Hut seed={s} weight={w} />,
	granary: (s, w) => <Granary seed={s} weight={w} />,
	deer: (s, w) => <Deer seed={s} weight={w} />,
	bird: (s, w) => <Bird seed={s} weight={w} />,
	bullock: (s, w) => <Bullock seed={s} weight={w} />,
	dog: (s, w) => <Dog seed={s} weight={w} />,
	horse: (s, w) => <Horse seed={s} weight={w} />,
	tiger: (s, w) => <Tiger seed={s} weight={w} />,
	monkey: (s, w) => <Monkey seed={s} weight={w} />,
	scorpion: (s, w) => <Scorpion seed={s} weight={w} />,
	snake: (s, w) => <Snake seed={s} weight={w} />,
	crab: (s, w) => <Crab seed={s} weight={w} />,
	rooster: (s, w) => <Rooster seed={s} weight={w} />,
	peacock: (s, w) => <Peacock seed={s} weight={w} />,
	fish: (s, w) => <Fish seed={s} weight={w} />,
	pot: (s, w) => <Pot seed={s} weight={w} />,
	drum: (s, w) => <Drum seed={s} weight={w} />,
	basket: (s, w) => <Basket seed={s} weight={w} />,
	plough: (s, w) => <Plough seed={s} weight={w} />,
	winnow: (s, w) => <Winnow seed={s} weight={w} />,
	ladder: (s, w) => <Ladder seed={s} weight={w} />,
	cart: (s, w) => <Cart seed={s} weight={w} />,
	fields: (s, w) => <Fields seed={s} weight={w} />,
	hills: (s, w) => <Hills seed={s} weight={w} />,
	chauk: (s, w) => <Chauk seed={s} weight={w} size={16} />,
	spiral: (s, w) => <Spiral seed={s} weight={w} radius={8} turns={2.4} />,
	sun: (s, w) => <Sun seed={s} weight={w} radius={5} rayLength={5} rays={10} />,
	moon: (s, w) => <Moon seed={s} weight={w} />,
	water: (s, w) => <WaterLine seed={s} weight={w} length={26} periods={4} />,
};

function Motif({ placed }: { readonly placed: PlacedMotif }) {
	const render = MOTIF_RENDERERS[placed.kind];
	if (render === undefined) {
		return null;
	}
	return (
		<g
			data-warli-motif={placed.kind}
			transform={`translate(${placed.x} ${placed.y}) scale(${(placed.mirror * placed.scale).toFixed(3)} ${placed.scale.toFixed(3)})`}
		>
			{render(placed.seed, WEIGHT_SPARE)}
		</g>
	);
}

function Ground({ mark }: { readonly mark: GroundMark }) {
	return (
		<g
			data-warli-ground={mark.kind}
			transform={`translate(${mark.x} ${mark.y}) rotate(${mark.rotationDeg}) scale(${mark.scale.toFixed(3)})`}
		>
			{mark.kind === "hatch" ? (
				<HatchFill
					halfWidth={9}
					height={13}
					apex="down"
					step={3.4}
					weight={WEIGHT_DENSE * 0.8}
					seed={mark.seed}
				/>
			) : null}
			{mark.kind === "dots" ? (
				<DotField cols={4} rows={2} step={6} r={0.9} />
			) : null}
			{mark.kind === "water" ? (
				<WaterLine
					length={22}
					amplitude={2.4}
					periods={3}
					weight={WEIGHT_DENSE * 0.8}
					seed={mark.seed}
				/>
			) : null}
		</g>
	);
}

/**
 * The static field, drawn back to front.
 *
 * ⚠ THE ORDER IS THE DEPTH. There is no z-index in SVG and no value scale in
 * this palette, so the ONLY way one thing sits behind another is that it was
 * drawn first. Ground, then motifs, then people, then the border last of all —
 * because the border must overlap anything that strays toward the edge rather
 * than be overlapped by it, or the frame stops reading as a frame.
 */
export function FieldLayer() {
	// One shared occupancy list, threaded through both placements in order, so
	// motifs cannot land on top of figures. Placing them independently and hoping
	// is how a hundred items produce a dozen collisions.
	const taken: Array<{ x: number; y: number; r: number }> = [];
	const figures = placeFieldFigures(FIELD_FIGURE_COUNT, taken);
	const motifs = placeMotifs(MOTIF_COUNT, taken);
	const ground = placeGroundMarks(GROUND_MARK_COUNT);

	return (
		<g data-warli-field-layer="">
			<g data-warli-ground-layer="">
				{ground.map((mark) => (
					<Ground key={mark.index} mark={mark} />
				))}
			</g>

			<g data-warli-motif-layer="">
				{motifs.map((placed) => (
					<Motif key={placed.index} placed={placed} />
				))}
			</g>

			<g data-warli-field-figures="">
				{figures.map((placed, i) => {
					const spec = FIELD_FIGURES[i];
					if (spec === undefined) {
						return null;
					}
					return (
						<g
							key={spec.id}
							data-warli-field-figure={spec.label}
							data-warli-mirror={placed.mirror}
							transform={`translate(${placed.x} ${placed.y}) rotate(${placed.leanDeg.toFixed(2)}) scale(${(placed.mirror * placed.scale).toFixed(3)} ${placed.scale.toFixed(3)})`}
						>
							<Figure
								spec={spec}
								density={placed.x <= FRAME.width / 2 ? "dense" : "spare"}
							/>
						</g>
					);
				})}
			</g>

			<BorderStack width={FRAME.width} height={FRAME.height} seed={31} />
		</g>
	);
}
