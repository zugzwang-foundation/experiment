/**
 * The contract every Warli-inspired primitive satisfies.
 *
 * A primitive is a pure function of its props returning a `<g>`. It draws in its
 * OWN local coordinate space around its declared `origin`, and it never
 * positions itself — placement is the caller's job, done with a `transform`.
 * That split is what lets the ring engine (`../geometry.ts`) treat a figure as a
 * rigid body it can rotate about a known point without measuring anything at
 * render time.
 *
 * ⚠ THE `id` IS ON THE SPEC, AND ON THE `<g>` IT IS `data-warli-id`, NOT `id`.
 * A primitive is rendered many times in one document — sixteen figures, each
 * composed of a dozen parts — so a literal `id=` attribute would emit hundreds
 * of duplicates. Duplicate ids are invalid markup, they break
 * `getElementById`, and they break `url(#…)` references, which is the exact
 * mechanism an SVG would otherwise reach for. The identifier stays stable and
 * addressable; only the attribute carrying it changes.
 *
 * ⚠ NO COLOUR APPEARS IN ANY PRIMITIVE. Every stroke and fill is
 * `currentColor`, resolved once at the root `<svg>` from `text-ink`
 * (`color: var(--color-ink)`). One colour source, inherited down — which is
 * also why `tests/unit/design/no-raw-hex-view-layer.test.ts` has nothing to
 * find here, and why the pole tokens `--color-yes` / `--color-no` are absent by
 * construction rather than by discipline.
 */

/** An axis-aligned bounding box in the primitive's own local units. */
export type PrimitiveBox = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

/** The point a caller rotates and scales the primitive about. */
export type PrimitiveOrigin = {
	readonly x: number;
	readonly y: number;
};

/**
 * The declared shape of a primitive.
 *
 * ⚠ For a PARAMETRIC primitive — one whose props change its extent, such as
 * `Limb`, `HatchFill` or `Spiral` — `box` describes the CANONICAL instance: the
 * one drawn with every prop left at its default. It is a documented reference
 * shape, not a runtime guarantee about an arbitrary instance, and callers that
 * need an exact extent for a non-default instance compute it themselves. Saying
 * so here is cheaper than a `box` that is quietly wrong for half the set.
 */
export type PrimitiveSpec = {
	/** Stable, unique, `warli-` prefixed. Emitted as `data-warli-id`. */
	readonly id: string;
	/** Canonical extent, in local units, relative to `origin`. */
	readonly box: PrimitiveBox;
	/** The transform origin, in the same local units. */
	readonly origin: PrimitiveOrigin;
};

/** Props every primitive accepts, so any of them can be placed identically. */
export type PrimitiveProps = {
	/** SVG transform applied to the primitive's root `<g>`. */
	readonly transform?: string;
	/** Extra classes on the root `<g>`. */
	readonly className?: string;
	/** Stroke width override, in local units. */
	readonly weight?: number;
};

/** The single line weight the spare register is drawn at. */
export const WEIGHT_SPARE = 1.6;

/** The secondary weight the dense register uses for hatch, dots and combs. */
export const WEIGHT_DENSE = 0.9;
