import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The twelve held objects — one per figure, and the ONLY thing that tells the
 * sixteen figures apart.
 *
 * ⚠ THIS IS THE LOAD-BEARING DECISION OF THE WHOLE PIECE, so it is worth being
 * explicit about. A figure in this idiom is two triangles, a circle and four
 * lines; it has no face, no clothing, no build and no gesture vocabulary beyond
 * the angle of its limbs. There is therefore NO WAY to draw "a scholar" as
 * distinct from "a labourer" in the body itself without abandoning the form and
 * drawing a person instead — which is the failure mode this file exists to
 * avoid. So identity is carried entirely by the object in the hand, and the
 * figures stay identical underneath. That is not a compromise forced by the
 * medium; it is the argument. Everyone in the ring is the same shape. What
 * differs is what they are holding, and that is the whole of what divides them.
 *
 * ⚠ EACH OBJECT IS DRAWN ABOUT ITS HOLD POINT at local `(0, 0)` — the place the
 * hand grips it — not about its centre or its corner. A figure's arm ends at a
 * known point, so hanging an object off it must not require knowing how big the
 * object is.
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={BOOK.id} transform={transform} className={className}>
			<polygon
				points="0,1 -8,3 -8,11 0,9"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
			<polygon
				points="0,1 8,3 8,11 0,9"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
			<line x1={0} y1={1} x2={0} y2={9} stroke={STROKE} strokeWidth={weight} />
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={ADZE.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={11}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<polygon
				points="-5,11 5,11 2,14 -2,14"
				fill={STROKE}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={SPEAR.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={-12}
				x2={0}
				y2={14}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<polygon
				points="0,-16 3,-10 0,-8 -3,-10"
				fill={STROKE}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={SLATE.id} transform={transform} className={className}>
			<rect
				x={-6.5}
				y={1}
				width={13}
				height={15}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			<line x1={-4} y1={6} x2={4} y2={6} stroke={STROKE} strokeWidth={weight} />
			<line
				x1={-4}
				y1={10.5}
				x2={2}
				y2={10.5}
				stroke={STROKE}
				strokeWidth={weight}
			/>
		</g>
	);
}

export const VESSEL: PrimitiveSpec = {
	id: "warli-vessel",
	box: { x: -7, y: 0, width: 14, height: 15 },
	origin: { x: 0, y: 0 },
};

/** A water pot: a narrow mouth over a wide belly. */
export function Vessel({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={VESSEL.id} transform={transform} className={className}>
			<line
				x1={-4}
				y1={2}
				x2={4}
				y2={2}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<path
				d="M -4 2 C -8 6, -7 13, 0 14 C 7 13, 8 6, 4 2"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={LENS.id} transform={transform} className={className}>
			<circle
				cx={0}
				cy={5.5}
				r={5}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			<line
				x1={0}
				y1={10.5}
				x2={0}
				y2={17}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={SCALES.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={3}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<line
				x1={-9}
				y1={3}
				x2={9}
				y2={3}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			{[-9, 9].map((x) => (
				<g key={x}>
					<line
						x1={x}
						y1={3}
						x2={x}
						y2={8}
						stroke={STROKE}
						strokeWidth={weight}
					/>
					<polyline
						points={`${x - 4},8 ${x},13 ${x + 4},8`}
						fill="none"
						stroke={STROKE}
						strokeWidth={weight}
						strokeLinejoin="round"
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={SICKLE.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={6}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<path
				d="M 0 6 C 10 6, 13 10, 10 15"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={STAFF.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={-11}
				x2={0}
				y2={18}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<circle cx={0} cy={-13} r={2.4} fill={STROKE} />
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={LOOM.id} transform={transform} className={className}>
			<rect
				x={-8}
				y={1}
				width={16}
				height={15}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			{[-4.5, -1.5, 1.5, 4.5].map((x) => (
				<line
					key={x}
					x1={x}
					y1={1}
					x2={x}
					y2={16}
					stroke={STROKE}
					strokeWidth={weight * 0.7}
				/>
			))}
			<line
				x1={-8}
				y1={9.5}
				x2={8}
				y2={9.5}
				stroke={STROKE}
				strokeWidth={weight}
			/>
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
}: PrimitiveProps) {
	return (
		<g data-warli-id={POST.id} transform={transform} className={className}>
			<line
				x1={0}
				y1={0}
				x2={0}
				y2={20}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<line
				x1={-7}
				y1={4}
				x2={7}
				y2={4}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<line x1={0} y1={4} x2={-5} y2={9} stroke={STROKE} strokeWidth={weight} />
			<line x1={0} y1={4} x2={5} y2={9} stroke={STROKE} strokeWidth={weight} />
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
 * It is the one prop that is also a `field`-scale motif in its own right, and it
 * is the reason the musician stands where it does — the dance forms AROUND the
 * player, so the instrument is the only object here that the ring is arranged
 * with respect to rather than merely carrying.
 */
export function Tarpa({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={TARPA.id} transform={transform} className={className}>
			<circle
				cx={0}
				cy={2}
				r={5.5}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			<line
				x1={3}
				y1={6}
				x2={9}
				y2={14}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
			<polyline
				points="6,17 9,14 14,16"
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
			<line
				x1={0}
				y1={-3.5}
				x2={0}
				y2={0}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
		</g>
	);
}
