import {
	type PrimitiveProps,
	type PrimitiveSpec,
	WEIGHT_DENSE,
	WEIGHT_SPARE,
} from "./types";

/**
 * The non-figurative grammar: the marks that fill a ground, edge a border, or
 * stand for sun and water.
 *
 * These eight carry the entire dense/spare distinction. The figures on both
 * rings are the SAME drawings at the SAME weight — what separates the inner
 * ring from the outer one is that the inner ring is bedded into hatch, dots and
 * comb borders and the outer ring stands on bare ground. That is deliberate and
 * it is the only honest way to get depth out of one colour: value is
 * unavailable, so density does the work value normally would. Two rings drawn
 * in two greys would read as near and far; two rings drawn in one ink at two
 * densities read as loud and quiet, which is the distinction the piece actually
 * wants.
 */

const STROKE = "currentColor";

export const DOT: PrimitiveSpec = {
	id: "warli-dot",
	box: { x: -1.4, y: -1.4, width: 2.8, height: 2.8 },
	origin: { x: 0, y: 0 },
};

/** One filled dot, about its own centre. */
export function Dot({
	r = 1.4,
	transform,
	className,
}: PrimitiveProps & { readonly r?: number }) {
	return (
		<g data-warli-id={DOT.id} transform={transform} className={className}>
			<circle cx={0} cy={0} r={r} fill={STROKE} />
		</g>
	);
}

export const DOT_FIELD: PrimitiveSpec = {
	id: "warli-dot-field",
	// Canonical: 5 columns × 2 rows at a 7-unit step, centred on x.
	box: { x: -14, y: 0, width: 28, height: 7 },
	origin: { x: 0, y: 0 },
};

/**
 * A lattice of dots — the ground a figure stands on.
 *
 * Rows are OFFSET by half a step on alternate lines rather than stacked square,
 * because a square lattice reads as a printed halftone and a staggered one
 * reads as scattered grain. The difference is one `% 2` and it decides whether
 * the ground looks made or manufactured.
 */
export function DotField({
	cols = 5,
	rows = 2,
	step = 7,
	r = 1.1,
	transform,
	className,
}: PrimitiveProps & {
	readonly cols?: number;
	readonly rows?: number;
	readonly step?: number;
	readonly r?: number;
}) {
	const dots: Array<{ readonly x: number; readonly y: number }> = [];
	const halfSpan = ((cols - 1) * step) / 2;
	for (let row = 0; row < rows; row++) {
		const stagger = row % 2 === 0 ? 0 : step / 2;
		for (let col = 0; col < cols; col++) {
			dots.push({ x: col * step - halfSpan + stagger, y: row * step });
		}
	}
	return (
		<g data-warli-id={DOT_FIELD.id} transform={transform} className={className}>
			{dots.map((dot) => (
				<circle
					key={`${dot.x}:${dot.y}`}
					cx={dot.x}
					cy={dot.y}
					r={r}
					fill={STROKE}
				/>
			))}
		</g>
	);
}

export const HATCH_FILL: PrimitiveSpec = {
	id: "warli-hatch-fill",
	// Canonical: the upper torso triangle, apex down.
	box: { x: -9, y: -15, width: 18, height: 15 },
	origin: { x: 0, y: 0 },
};

/**
 * Horizontal rules filling an isoceles triangle, each rule trimmed to the
 * triangle's own width at that height.
 *
 * ⚠ NO `clipPath`, DELIBERATELY. Clipping would be the obvious way to fill a
 * triangle with hatch, and it needs a `<clipPath id="…">` plus a `url(#…)`
 * reference — which is precisely the duplicate-id problem `PrimitiveSpec`
 * documents, multiplied by every hatched part of every figure. Interpolating
 * each rule's half-width from the triangle's own geometry costs one line of
 * arithmetic, is exact rather than approximate, and leaves the markup free of
 * document-scoped references entirely.
 */
export function HatchFill({
	halfWidth = 9,
	height = 15,
	apex = "down",
	step = 3.2,
	transform,
	className,
	weight = WEIGHT_DENSE,
}: PrimitiveProps & {
	readonly halfWidth?: number;
	readonly height?: number;
	readonly apex?: "up" | "down";
	readonly step?: number;
}) {
	const rules: Array<{ readonly y: number; readonly half: number }> = [];
	for (let t = step; t < height; t += step) {
		// `t` is the distance from the APEX, so the triangle's half-width there
		// is a straight proportion of the distance travelled toward the base.
		const half = (halfWidth * t) / height;
		rules.push({ y: apex === "down" ? -t : t, half });
	}
	return (
		<g
			data-warli-id={HATCH_FILL.id}
			transform={transform}
			className={className}
		>
			{rules.map((rule) => (
				<line
					key={rule.y}
					x1={-rule.half}
					y1={rule.y}
					x2={rule.half}
					y2={rule.y}
					stroke={STROKE}
					strokeWidth={weight}
				/>
			))}
		</g>
	);
}

export const COMB_BORDER_SEGMENT: PrimitiveSpec = {
	id: "warli-comb-border-segment",
	// Canonical: a 28-unit run of teeth hanging below the baseline.
	box: { x: 0, y: 0, width: 28, height: 4 },
	origin: { x: 0, y: 0 },
};

/**
 * A run of border comb — a baseline with regular teeth. The edging that turns a
 * bare line into an edge somebody made.
 */
export function CombBorderSegment({
	length = 28,
	teeth = 5,
	toothHeight = 4,
	transform,
	className,
	weight = WEIGHT_DENSE,
}: PrimitiveProps & {
	readonly length?: number;
	readonly teeth?: number;
	readonly toothHeight?: number;
}) {
	const gap = teeth > 1 ? length / (teeth - 1) : length;
	const positions = Array.from({ length: teeth }, (_, i) => i * gap);
	return (
		<g
			data-warli-id={COMB_BORDER_SEGMENT.id}
			transform={transform}
			className={className}
		>
			<line
				x1={0}
				y1={0}
				x2={length}
				y2={0}
				stroke={STROKE}
				strokeWidth={weight}
			/>
			{positions.map((x) => (
				<line
					key={x}
					x1={x}
					y1={0}
					x2={x}
					y2={toothHeight}
					stroke={STROKE}
					strokeWidth={weight}
				/>
			))}
		</g>
	);
}

export const CHAUK: PrimitiveSpec = {
	id: "warli-chauk",
	box: { x: -9, y: -9, width: 18, height: 18 },
	origin: { x: 0, y: 0 },
};

/**
 * The square motif — an outer square, an inscribed diamond, a dot at the
 * centre. The one mark in this vocabulary that is purely ceremonial rather than
 * descriptive: it depicts nothing, and it is here because a field of only
 * descriptive marks reads as an illustration rather than as a wall.
 */
export function Chauk({
	size = 18,
	transform,
	className,
	weight = WEIGHT_DENSE,
}: PrimitiveProps & { readonly size?: number }) {
	const h = size / 2;
	return (
		<g data-warli-id={CHAUK.id} transform={transform} className={className}>
			<rect
				x={-h}
				y={-h}
				width={size}
				height={size}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			<polygon
				points={`0,${-h} ${h},0 0,${h} ${-h},0`}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			<circle cx={0} cy={0} r={1.3} fill={STROKE} />
		</g>
	);
}

export const SPIRAL: PrimitiveSpec = {
	id: "warli-spiral",
	box: { x: -10, y: -10, width: 20, height: 20 },
	origin: { x: 0, y: 0 },
};

/**
 * An Archimedean spiral, sampled as a polyline. `r = radius · θ / (2π · turns)`
 * — the radius grows in exact proportion to the angle, which is what makes the
 * gap between successive coils constant and the whole thing read as one
 * continuous gesture rather than a stack of circles.
 */
export function Spiral({
	turns = 2.5,
	radius = 10,
	samples = 96,
	transform,
	className,
	weight = WEIGHT_DENSE,
}: PrimitiveProps & {
	readonly turns?: number;
	readonly radius?: number;
	readonly samples?: number;
}) {
	const total = Math.PI * 2 * turns;
	const points = Array.from({ length: samples + 1 }, (_, i) => {
		const theta = (total * i) / samples;
		const r = (radius * theta) / total;
		return `${(r * Math.cos(theta)).toFixed(2)},${(r * Math.sin(theta)).toFixed(2)}`;
	}).join(" ");
	return (
		<g data-warli-id={SPIRAL.id} transform={transform} className={className}>
			<polyline
				points={points}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</g>
	);
}

export const WATER_LINE: PrimitiveSpec = {
	id: "warli-water-line",
	box: { x: 0, y: -3, width: 28, height: 6 },
	origin: { x: 0, y: 0 },
};

/** A zigzag run — water, or the ground falling away. */
export function WaterLine({
	length = 28,
	amplitude = 3,
	periods = 4,
	transform,
	className,
	weight = WEIGHT_DENSE,
}: PrimitiveProps & {
	readonly length?: number;
	readonly amplitude?: number;
	readonly periods?: number;
}) {
	const steps = periods * 2;
	const points = Array.from({ length: steps + 1 }, (_, i) => {
		const x = (length * i) / steps;
		const y = i % 2 === 0 ? -amplitude : amplitude;
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	}).join(" ");
	return (
		<g
			data-warli-id={WATER_LINE.id}
			transform={transform}
			className={className}
		>
			<polyline
				points={points}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
				strokeLinejoin="round"
			/>
		</g>
	);
}

export const SUN: PrimitiveSpec = {
	id: "warli-sun",
	box: { x: -11, y: -11, width: 22, height: 22 },
	origin: { x: 0, y: 0 },
};

/** A disc with radiating rays. */
export function Sun({
	radius = 5,
	rayLength = 5,
	rays = 12,
	transform,
	className,
	weight = WEIGHT_SPARE,
}: PrimitiveProps & {
	readonly radius?: number;
	readonly rayLength?: number;
	readonly rays?: number;
}) {
	const spokes = Array.from({ length: rays }, (_, i) => (360 * i) / rays);
	return (
		<g data-warli-id={SUN.id} transform={transform} className={className}>
			<circle
				cx={0}
				cy={0}
				r={radius}
				fill="none"
				stroke={STROKE}
				strokeWidth={weight}
			/>
			{spokes.map((deg) => {
				const rad = (deg * Math.PI) / 180;
				return (
					<line
						key={deg}
						x1={Math.cos(rad) * (radius + 1.5)}
						y1={Math.sin(rad) * (radius + 1.5)}
						x2={Math.cos(rad) * (radius + 1.5 + rayLength)}
						y2={Math.sin(rad) * (radius + 1.5 + rayLength)}
						stroke={STROKE}
						strokeWidth={weight}
						strokeLinecap="round"
					/>
				);
			})}
		</g>
	);
}
