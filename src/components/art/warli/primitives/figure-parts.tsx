import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The body. Warli-inspired geometric figuration builds a person out of exactly
 * three things — a circle, two triangles meeting point to point, and straight
 * lines for the limbs — and the whole expressive range comes from the ANGLE of
 * those lines rather than from any added detail. So these six primitives are
 * deliberately the least interesting file in the directory: the character
 * arrives later, in `../figures/`, out of arrangement alone.
 *
 * ⚠ EVERY PART IS DRAWN AROUND THE WAIST, at local `(0, 0)`, and `−y` is UP.
 * The waist is where the two triangles meet, so it is the one point that does
 * not move when a figure changes pose, which makes it the only sane thing to
 * rotate a figure about. A figure's FEET sit at `y = +29` and its head crown at
 * `y = −29`; the 58-unit total is the figure height the ring geometry derives
 * from the auth card (see `docs/plans/WARLI-1.md` §3).
 */

const STROKE = "currentColor";

/** Radius of the head circle. */
export const HEAD_RADIUS = 6;

/** Half-width of the shoulder line, where the upper triangle's base sits. */
export const SHOULDER_HALF = 9;

/** Height of the upper triangle: shoulders to waist. */
export const TORSO_UPPER_HEIGHT = 15;

/** Half-width of the hip line, where the lower triangle's base sits. */
export const HIP_HALF = 7.5;

/** Height of the lower triangle: waist to hips. */
export const TORSO_LOWER_HEIGHT = 11;

export const HEAD: PrimitiveSpec = {
	id: "warli-head",
	box: { x: -6, y: -6, width: 12, height: 12 },
	origin: { x: 0, y: 0 },
};

/**
 * The head, drawn about its own centre — so a caller places it by translating
 * to where the head goes, not by knowing how tall it is.
 *
 * `filled` is the whole dense/spare distinction in one boolean: the inner ring
 * carries solid heads and the outer ring open ones. Same colour, different
 * amount of it, which is the only depth cue a one-colour piece is allowed.
 */
export function Head({
	filled = false,
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps & { readonly filled?: boolean }) {
	return (
		<g data-warli-id={HEAD.id} transform={transform} className={className}>
			<circle
				cx={0}
				cy={0}
				r={HEAD_RADIUS}
				fill={filled ? STROKE : "none"}
				stroke={STROKE}
				strokeWidth={weight}
			/>
		</g>
	);
}

export const TORSO_UPPER: PrimitiveSpec = {
	id: "warli-torso-upper",
	box: { x: -9, y: -15, width: 18, height: 15 },
	origin: { x: 0, y: 0 },
};

/** Chest: base at the shoulders, apex down at the waist. */
export function TorsoUpper({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g
			data-warli-id={TORSO_UPPER.id}
			transform={transform}
			className={className}
		>
			<polygon
				points={`${-SHOULDER_HALF},${-TORSO_UPPER_HEIGHT} ${SHOULDER_HALF},${-TORSO_UPPER_HEIGHT} 0,0`}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
		</g>
	);
}

export const TORSO_LOWER: PrimitiveSpec = {
	id: "warli-torso-lower",
	box: { x: -7.5, y: 0, width: 15, height: 11 },
	origin: { x: 0, y: 0 },
};

/** Hips: apex up at the waist, base at the hip line. */
export function TorsoLower({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g
			data-warli-id={TORSO_LOWER.id}
			transform={transform}
			className={className}
		>
			<polygon
				points={`0,0 ${-HIP_HALF},${TORSO_LOWER_HEIGHT} ${HIP_HALF},${TORSO_LOWER_HEIGHT}`}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
		</g>
	);
}

export const TORSO: PrimitiveSpec = {
	id: "warli-torso",
	box: { x: -9, y: -15, width: 18, height: 26 },
	origin: { x: 0, y: 0 },
};

/**
 * Both triangles as one part, because they are never drawn apart — the
 * point-to-point join at the waist IS the figure, and offering it as two
 * separate calls would invite someone to drift them apart by a unit and lose
 * the only silhouette that reads as this tradition at all.
 */
export function Torso({
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps) {
	return (
		<g data-warli-id={TORSO.id} transform={transform} className={className}>
			<TorsoUpper weight={weight} />
			<TorsoLower weight={weight} />
		</g>
	);
}

export const LIMB: PrimitiveSpec = {
	id: "warli-limb",
	// Canonical: the default arm — waist-relative shoulder out to a hand.
	box: { x: 0, y: -14, width: 9, height: 4 },
	origin: { x: 0, y: 0 },
};

/**
 * An arm or a leg: one straight line, and nothing else. Parametric, so its
 * declared `box` is the canonical instance (see `PrimitiveSpec`).
 */
export function Limb({
	x1 = 0,
	y1 = -14,
	x2 = 9,
	y2 = -10,
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps & {
	readonly x1?: number;
	readonly y1?: number;
	readonly x2?: number;
	readonly y2?: number;
}) {
	return (
		<g data-warli-id={LIMB.id} transform={transform} className={className}>
			<line
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
		</g>
	);
}

export const HAND_LINK: PrimitiveSpec = {
	id: "warli-hand-link",
	// Canonical: a unit chord between two neighbouring hands.
	box: { x: 0, y: 0, width: 100, height: 0 },
	origin: { x: 0, y: 0 },
};

/**
 * The line joining one figure's hand to the next figure's hand.
 *
 * It is a primitive rather than a detail of the ring engine because the link is
 * the thing that turns eight separate people into one body: in the dance this
 * form comes from, the chain is unbroken, and a ring of figures standing near
 * each other is a crowd while a ring of figures HOLDING each other is a
 * position. The whole piece argues that opposed camps are internally joined,
 * and this one line is where that is said.
 *
 * Drawn in RING space, not figure space — the caller passes two already-placed
 * hand points, so the link is a straight chord across the gap between them.
 */
export function HandLink({
	x1,
	y1,
	x2,
	y2,
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps & {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
}) {
	return (
		<g data-warli-id={HAND_LINK.id} transform={transform} className={className}>
			<line
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinecap="round"
			/>
		</g>
	);
}
