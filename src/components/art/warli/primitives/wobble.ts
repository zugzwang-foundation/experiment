/**
 * The hand in the line.
 *
 * Warli-inspired geometric figuration is painted with a chewed bamboo stick on a
 * mud-and-dung wall. The line wanders, thickens where the stick loaded, and does
 * not close cleanly. A drawing of the same forms in perfectly straight SVG
 * segments reads as a diagram OF that tradition rather than as a thing made in
 * it — and it is the single largest gap between what WARLI-1 shipped and what it
 * was trying to be. This module closes it, and it is applied to every primitive
 * rather than to a chosen few, because a wall where half the marks are true and
 * half wander looks like a mistake instead of a hand.
 *
 * ⚠ NOTHING HERE IS RANDOM, AND NOTHING MAY BECOME RANDOM. Every varying
 * quantity is a pure function of an integer seed derived from the element's own
 * index. `Math.random` and `Date.now` are forbidden anywhere in this layer: the
 * ring engine carries a determinism guard, and a random wobble would turn that
 * guard into a coin flip that reddens on an unrelated night and costs somebody a
 * morning chasing noise that was never a defect.
 *
 * ⚠ AND THE PERTURBATION MOVES THE MIDDLE OF A SEGMENT, NEVER ITS ENDPOINTS.
 * This is the load-bearing decision of the whole slice. A figure's hands are the
 * ring engine's chain anchors; its joints are where the next part attaches. Bow
 * the endpoints and every hand link terminates in mid-air beside a hand that is
 * somewhere else — the exact defect WARLI-1 records having made once with the
 * child's scale, reproduced at sixteen times the scale. Bowing only the control
 * point leaves every anchor bit-identical to the straight version, so the equal-
 * reach guard, the hand chain and the pair geometry are all untouched by
 * construction rather than by care.
 *
 * It is also what a hand actually does. A painter putting a line between two
 * places hits both places; what wanders is the bit in between.
 */

/** A point in whatever local space the caller is drawing in. */
export type WobblePoint = { readonly x: number; readonly y: number };

/**
 * An integer hash, `[0, 1)`.
 *
 * The two `Math.imul` rounds are the standard 32-bit avalanche step: without
 * them, consecutive seeds — which is exactly how this is called, once per index
 * — produce consecutive outputs, and a "wobble" that increases monotonically
 * around a ring is a spiral, not a tremor. Mixing is not decoration here; it is
 * the difference between noise and a visible gradient nobody asked for.
 */
export function hash01(seed: number): number {
	let x = seed | 0;
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x = x ^ (x >>> 16);
	return (x >>> 0) / 4294967296;
}

/** The same hash, mapped to `[-1, 1)`. */
export function noise(seed: number): number {
	return hash01(seed) * 2 - 1;
}

/**
 * A deterministic pick from a list.
 *
 * Exported because ornament, motif choice and mirroring all need "choose one of
 * these, always the same one for the same index", and each of them writing its
 * own modulo is how two of them end up subtly different.
 */
export function pick<T>(items: readonly T[], seed: number): T {
	const item = items[Math.floor(hash01(seed) * items.length) % items.length];
	if (item === undefined) {
		throw new Error("WARLI: pick from an empty list");
	}
	return item;
}

/**
 * Fold an instance seed together with the numbers describing one mark.
 *
 * ⚠ THIS IS WHAT KEEPS THE CALL SITES CLEAN, and the alternative is worth
 * naming. Every part of a figure needs its OWN wobble — sixteen limbs that all
 * bow by the same amount in the same direction is not a hand, it is a shear. The
 * obvious way to get that is to thread a distinct seed into every part from the
 * figure that owns it, which means a dozen hand-assigned offsets per figure and
 * a silent collision the first time somebody adds a part and reuses a number.
 *
 * Folding the mark's own coordinates in instead means two different limbs are
 * different BECAUSE THEY ARE IN DIFFERENT PLACES, automatically and without
 * anybody maintaining a table. Two marks that genuinely coincide get the same
 * wobble, which is correct: they are the same stroke.
 */
export function seedFrom(
	instance: number,
	...parts: readonly number[]
): number {
	let h = Math.imul(instance | 0, 0x9e3779b1) | 0;
	for (const part of parts) {
		// Quantised to a tenth of a unit before mixing: a coordinate that differs
		// only in float noise must not produce a different wobble, or the same
		// drawing computed two ways would disagree and the determinism guard would
		// be measuring float formatting rather than determinism.
		h = (Math.imul(h ^ Math.round(part * 10), 0x85ebca6b) | 0) >>> 0;
		h = h ^ (h >>> 13);
	}
	return h | 0;
}

/** Rounds to 2 decimals so identical input yields byte-identical path strings. */
const q = (n: number): number => {
	const r = Math.round(n * 100) / 100;
	return r === 0 ? 0 : r;
};

/**
 * How far a segment of this length is allowed to wander.
 *
 * Proportional, with both ends clamped, because a single absolute amplitude
 * cannot serve this drawing: the same 1-unit bow that is a pleasant tremor on a
 * 20-unit forearm is invisible on a 400-unit border run and destroys a 4-unit
 * facial mark. Length-proportional wobble is also simply what a longer stroke
 * does — there is more line for the hand to drift across.
 */
export function amplitudeFor(length: number): number {
	return Math.min(3.2, Math.max(0.28, length * 0.045));
}

/**
 * One straight run, bowed.
 *
 * Returns a quadratic path whose two ENDPOINTS are exactly the ones passed in
 * and whose control point is displaced perpendicular to the run. A quadratic
 * rather than a cubic because one control point is one decision: a cubic would
 * let the line take an S, and an S reads as a deliberate flourish rather than as
 * an unsteady hand.
 */
export function bowedLine(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	seed: number,
	amplitude?: number,
): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const length = Math.hypot(dx, dy);
	if (length === 0) {
		return `M ${q(x1)} ${q(y1)} L ${q(x2)} ${q(y2)}`;
	}
	const amp = (amplitude ?? amplitudeFor(length)) * noise(seed);
	// Unit normal to the run. The control point sits at the midpoint pushed out
	// along it — and because a quadratic only reaches HALF way to its control
	// point, the drawn bow is amp/2. Doubling here keeps `amplitude` meaning the
	// distance the line actually departs, which is the number a caller is
	// thinking in.
	const nx = -dy / length;
	const ny = dx / length;
	const cx = (x1 + x2) / 2 + nx * amp * 2;
	const cy = (y1 + y2) / 2 + ny * amp * 2;
	return `M ${q(x1)} ${q(y1)} Q ${q(cx)} ${q(cy)} ${q(x2)} ${q(y2)}`;
}

/**
 * A run of points, every edge bowed, every vertex exact.
 *
 * `close` appends the wrap edge back to the first point — so a triangle is three
 * bowed edges meeting at three unmoved corners, which is what a hand-painted
 * triangle looks like. A polygon whose CORNERS moved would be a different
 * triangle; the corners are where the meaning is.
 */
export function bowedPath(
	points: readonly WobblePoint[],
	seed: number,
	options?: { readonly close?: boolean; readonly amplitude?: number },
): string {
	if (points.length === 0) {
		return "";
	}
	const first = points[0];
	if (first === undefined) {
		return "";
	}
	const close = options?.close ?? false;
	const run = close ? [...points, first] : points;
	let d = `M ${q(first.x)} ${q(first.y)}`;
	for (let i = 1; i < run.length; i++) {
		const a = run[i - 1];
		const b = run[i];
		if (a === undefined || b === undefined) {
			continue;
		}
		const length = Math.hypot(b.x - a.x, b.y - a.y);
		const amp =
			(options?.amplitude ?? amplitudeFor(length)) * noise(seed + i * 7);
		if (length === 0) {
			d += ` L ${q(b.x)} ${q(b.y)}`;
			continue;
		}
		const nx = -(b.y - a.y) / length;
		const ny = (b.x - a.x) / length;
		d += ` Q ${q((a.x + b.x) / 2 + nx * amp * 2)} ${q((a.y + b.y) / 2 + ny * amp * 2)} ${q(b.x)} ${q(b.y)}`;
	}
	return close ? `${d} Z` : d;
}

/**
 * A circle that was drawn by hand: sampled, with each sample's radius nudged.
 *
 * ⚠ THE CENTRE IS EXACT AND THE RADIUS IS NOT, which is the opposite of the
 * endpoint rule above and is deliberate. Nothing in this drawing attaches to a
 * circle's circumference — a head is joined at its centre by the neck — so the
 * rim is free to wander, and the rim is the only part of a circle that shows a
 * hand at all. Applying the endpoint rule here would produce a perfect circle
 * and no wobble whatsoever.
 */
export function bowedCircle(
	cx: number,
	cy: number,
	r: number,
	seed: number,
	options?: { readonly samples?: number; readonly amplitude?: number },
): string {
	const samples = options?.samples ?? 14;
	const amp = options?.amplitude ?? Math.max(0.2, r * 0.06);
	const pts: WobblePoint[] = [];
	for (let i = 0; i < samples; i++) {
		const a = (Math.PI * 2 * i) / samples;
		const rr = r + amp * noise(seed + i * 13);
		pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
	}
	// Closed, and drawn as straight chords between samples: at fourteen samples
	// the chord error is under 2.5% of the radius, well inside the wobble itself,
	// and a polygon of this many sides is indistinguishable from a curve at any
	// size this drawing uses. Curves here would cost path arithmetic to hide a
	// difference smaller than the noise deliberately added on top of it.
	const first = pts[0];
	if (first === undefined) {
		return "";
	}
	let d = `M ${q(first.x)} ${q(first.y)}`;
	for (let i = 1; i < pts.length; i++) {
		const p = pts[i];
		if (p !== undefined) {
			d += ` L ${q(p.x)} ${q(p.y)}`;
		}
	}
	return `${d} Z`;
}
