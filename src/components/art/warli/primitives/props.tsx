import { Dab, Disc, Run, Shape } from "./stroke";
import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The twelve held objects — and, on the outer ring and in the static field, the
 * main thing that tells one faceless figure from another.
 *
 * ⚠ THIS IS THE LOAD-BEARING DECISION OF THE WHOLE PIECE, so it is worth being
 * explicit about. A figure in this idiom is two triangles, a circle and four
 * lines; outside the eight faced positions it has no face, no build and no
 * gesture vocabulary beyond the angle of its limbs. There is therefore NO WAY to
 * draw "a scholar" as distinct from "a labourer" in the body itself without
 * abandoning the form and drawing a person instead — which is the failure mode
 * this file exists to avoid. So identity is carried by the object in the hand
 * and by the ornament reserved out of the body, and the skeletons stay identical
 * underneath. That is not a compromise forced by the medium; it is the argument.
 * Everyone in the ring is the same shape. What differs is what they are holding.
 *
 * ⚠ EACH OBJECT IS DRAWN ABOUT ITS HOLD POINT at local `(0, 0)` — the place the
 * hand grips it — not about its centre or its corner. A figure's arm ends at a
 * known point, so hanging an object off it must not require knowing how big the
 * object is.
 *
 * ⚠ AND EVERY MARK GOES THROUGH `./stroke`, which is what applies the hand
 * (`./wobble.ts`). Before that existed this file wrote out thirty-one raw
 * `<line>` / `<polygon>` elements, and adding the wobble to each individually
 * would have been thirty-one chances to miss one. A held object drawn machine-
 * true beside a bowed body does not read as a clean object; it reads as a
 * different drawing that wandered into this one.
 */

const STROKE = "currentColor";

export const BOOK: PrimitiveSpec = {
	id: "warli-book",
	box: { x: -8, y: 0, width: 16, height: 11 },
	origin: { x: 0, y: 0 },
};

/** An open book: two pages falling away from a spine at the hold point. */
export function Book({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={BOOK.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: 0, y: 1 },
					{ x: -8, y: 3 },
					{ x: -8, y: 11 },
					{ x: 0, y: 9 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: 0, y: 1 },
					{ x: 8, y: 3 },
					{ x: 8, y: 11 },
					{ x: 0, y: 9 },
				]}
				seed={seed + 1}
				weight={weight}
			/>
			<Run x1={0} y1={1} x2={0} y2={9} seed={seed} weight={weight} />
		</g>
	);
}

export const ADZE: PrimitiveSpec = {
	id: "warli-adze",
	box: { x: -5, y: 0, width: 10, height: 14 },
	origin: { x: 0, y: 0 },
};

/** A hafted cutting tool: a shaft with the blade set across its foot. */
export function Adze({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={ADZE.id} transform={transform} className={className}>
			<Run x1={0} y1={0} x2={0} y2={11} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -5, y: 11 },
					{ x: 5, y: 11 },
					{ x: 2, y: 14 },
					{ x: -2, y: 14 },
				]}
				seed={seed}
				weight={weight}
				fill={STROKE}
			/>
		</g>
	);
}

export const SPEAR: PrimitiveSpec = {
	id: "warli-spear",
	box: { x: -3, y: -16, width: 6, height: 30 },
	origin: { x: 0, y: 0 },
};

/** A shaft gripped at its middle, head uppermost. */
export function Spear({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SPEAR.id} transform={transform} className={className}>
			<Run x1={0} y1={-12} x2={0} y2={14} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: 0, y: -16 },
					{ x: 3, y: -10 },
					{ x: 0, y: -8 },
					{ x: -3, y: -10 },
				]}
				seed={seed}
				weight={weight}
				fill={STROKE}
			/>
		</g>
	);
}

export const SLATE: PrimitiveSpec = {
	id: "warli-slate",
	box: { x: -6.5, y: 0, width: 13, height: 16 },
	origin: { x: 0, y: 0 },
};

/** A writing tablet, hung from its top edge, with two ruled lines. */
export function Slate({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SLATE.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -6.5, y: 1 },
					{ x: 6.5, y: 1 },
					{ x: 6.5, y: 16 },
					{ x: -6.5, y: 16 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Run x1={-4} y1={6} x2={4} y2={6} seed={seed} weight={weight} />
			<Run x1={-4} y1={10.5} x2={2} y2={10.5} seed={seed} weight={weight} />
		</g>
	);
}

export const VESSEL: PrimitiveSpec = {
	id: "warli-vessel",
	box: { x: -7, y: 0, width: 14, height: 15 },
	origin: { x: 0, y: 0 },
};

/**
 * A water pot: a narrow mouth over a wide belly.
 *
 * Drawn as a bowed polygon rather than as the cubic it used to be. The cubic was
 * the only true CURVE in the vocabulary, and it read as a different hand — a
 * confident sweep among marks that all wander. Six points bowed by the same
 * function as everything else give the same silhouette in the same voice.
 */
export function Vessel({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={VESSEL.id} transform={transform} className={className}>
			<Run x1={-4} y1={2} x2={4} y2={2} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -4, y: 2 },
					{ x: -7, y: 7 },
					{ x: -5, y: 13 },
					{ x: 0, y: 14.5 },
					{ x: 5, y: 13 },
					{ x: 7, y: 7 },
					{ x: 4, y: 2 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
		</g>
	);
}

export const LENS: PrimitiveSpec = {
	id: "warli-lens",
	box: { x: -5, y: 0, width: 10, height: 17 },
	origin: { x: 0, y: 0 },
};

/** A glass on a handle. */
export function Lens({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={LENS.id} transform={transform} className={className}>
			<Disc cx={0} cy={5.5} r={5} seed={seed} weight={weight} />
			<Run x1={0} y1={10.5} x2={0} y2={17} seed={seed} weight={weight} />
		</g>
	);
}

export const SCALES: PrimitiveSpec = {
	id: "warli-scales",
	box: { x: -9, y: 0, width: 18, height: 13 },
	origin: { x: 0, y: 0 },
};

/**
 * A balance beam with two pans.
 *
 * ⚠ THE PANS HANG LEVEL, and that is a decision rather than an oversight. A
 * tilted balance says one side is heavier — a verdict — and this piece is about
 * an argument that does not resolve. The merchant holds the question, not the
 * answer.
 */
export function Scales({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SCALES.id} transform={transform} className={className}>
			<Run x1={0} y1={0} x2={0} y2={3} seed={seed} weight={weight} />
			<Run x1={-9} y1={3} x2={9} y2={3} seed={seed} weight={weight} />
			{[-9, 9].map((x) => (
				<g key={x}>
					<Run x1={x} y1={3} x2={x} y2={7} seed={seed} weight={weight} />
					{/* ⚠ THE PANS ARE SHALLOW BOWLS, NOT DEEP VEES. The first version
					    dropped them five units to a point, and on the plate the beam
					    plus two sharp vees read as an arrow or a zigzag rather than as
					    a balance. A pan is wider than it is deep — that ratio is the
					    whole difference between a bowl and an arrowhead at twelve
					    units, and it is the only cue available at this size. */}
					<Shape
						points={[
							{ x: x - 4.6, y: 7 },
							{ x: x - 3, y: 11 },
							{ x: x + 3, y: 11 },
							{ x: x + 4.6, y: 7 },
						]}
						seed={seed + x}
						weight={weight}
						close={false}
					/>
				</g>
			))}
		</g>
	);
}

export const SICKLE: PrimitiveSpec = {
	id: "warli-sickle",
	box: { x: -3, y: 0, width: 16, height: 15 },
	origin: { x: 0, y: 0 },
};

/** A curved blade on a straight grip. */
export function Sickle({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SICKLE.id} transform={transform} className={className}>
			<Run x1={0} y1={0} x2={0} y2={6} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: 0, y: 6 },
					{ x: 7, y: 6.5 },
					{ x: 12, y: 10 },
					{ x: 10, y: 15 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
		</g>
	);
}

export const STAFF: PrimitiveSpec = {
	id: "warli-staff",
	box: { x: -3, y: -14, width: 6, height: 32 },
	origin: { x: 0, y: 0 },
};

/** A long walking staff, knobbed at the head, gripped above its middle. */
export function Staff({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={STAFF.id} transform={transform} className={className}>
			<Run x1={0} y1={-11} x2={0} y2={18} seed={seed} weight={weight} />
			<Dab cx={0} cy={-13} r={2.4} />
		</g>
	);
}

export const LOOM: PrimitiveSpec = {
	id: "warli-loom",
	box: { x: -8, y: 0, width: 16, height: 16 },
	origin: { x: 0, y: 0 },
};

/** A frame strung with warp threads and crossed once by the weft. */
export function Loom({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={LOOM.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -8, y: 1 },
					{ x: 8, y: 1 },
					{ x: 8, y: 16 },
					{ x: -8, y: 16 },
				]}
				seed={seed}
				weight={weight}
			/>
			{[-4.5, -1.5, 1.5, 4.5].map((x) => (
				<Run
					key={x}
					x1={x}
					y1={1}
					x2={x}
					y2={16}
					seed={seed}
					weight={weight * 0.7}
				/>
			))}
			<Run x1={-8} y1={9.5} x2={8} y2={9.5} seed={seed} weight={weight} />
		</g>
	);
}

export const POST: PrimitiveSpec = {
	id: "warli-post",
	box: { x: -7, y: 0, width: 14, height: 20 },
	origin: { x: 0, y: 0 },
};

/** An upright with a crossbeam — the first thing built on a site. */
export function Post({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={POST.id} transform={transform} className={className}>
			<Run x1={0} y1={0} x2={0} y2={20} seed={seed} weight={weight} />
			<Run x1={-7} y1={4} x2={7} y2={4} seed={seed} weight={weight} />
			<Run x1={0} y1={4} x2={-5} y2={9} seed={seed} weight={weight} />
			<Run x1={0} y1={4} x2={5} y2={9} seed={seed} weight={weight} />
		</g>
	);
}

export const TARPA: PrimitiveSpec = {
	id: "warli-tarpa",
	box: { x: -6, y: -4, width: 20, height: 22 },
	origin: { x: 0, y: 0 },
};

/**
 * The wind instrument the circle dance is named for: a gourd resonator with a
 * pipe leading to a flared bell.
 *
 * It is the one prop that is also a field-scale motif in its own right, and it
 * is the reason the musician stands where it does — the dance forms AROUND the
 * player, so the instrument is the only object here that the ring is arranged
 * with respect to rather than merely carrying.
 */
export function Tarpa({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={TARPA.id} transform={transform} className={className}>
			<Disc cx={0} cy={2} r={5.5} seed={seed} weight={weight} />
			<Run x1={3} y1={6} x2={9} y2={14} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: 6, y: 17 },
					{ x: 9, y: 14 },
					{ x: 14, y: 16 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
			<Run x1={0} y1={-3.5} x2={0} y2={0} seed={seed} weight={weight} />
		</g>
	);
}
