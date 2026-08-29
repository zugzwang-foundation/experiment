/**
 * The primitive vocabulary — thirty named marks, and nothing in this directory
 * may be drawn out of anything else.
 *
 * The constraint is the point. Warli-inspired geometric figuration is built from
 * four things: the circle, the triangle, the straight line and the dot. Every
 * primitive below resolves into those four, so the sixteen figures in
 * `../figures/` inherit the constraint for free — they cannot reach for a curve
 * or a gradient or a fill because there is nothing here that offers one. A
 * vocabulary that CANNOT express the wrong thing is worth more than a style
 * guide that asks you not to.
 *
 * `PRIMITIVE_SPECS` exists so a test can assert the set is complete, its ids are
 * unique and its boxes are well-formed, without importing thirty symbols by
 * hand and quietly missing the thirty-first.
 */

import { BIRD, DEER, HUT, TREE } from "./field";
import {
	HAND_LINK,
	HEAD,
	LIMB,
	TORSO,
	TORSO_LOWER,
	TORSO_UPPER,
} from "./figure-parts";
import {
	CHAUK,
	COMB_BORDER_SEGMENT,
	DOT,
	DOT_FIELD,
	HATCH_FILL,
	SPIRAL,
	SUN,
	WATER_LINE,
} from "./marks";
import {
	ADZE,
	BOOK,
	LENS,
	LOOM,
	POST,
	SCALES,
	SICKLE,
	SLATE,
	SPEAR,
	STAFF,
	TARPA,
	VESSEL,
} from "./props";
import type { PrimitiveSpec } from "./types";

export * from "./field";
export * from "./figure-parts";
export * from "./marks";
export * from "./props";
export * from "./stroke";
export * from "./types";
export * from "./wobble";

/** Every primitive's declared spec, grouped as the four source files are. */
export const PRIMITIVE_SPECS: readonly PrimitiveSpec[] = [
	// figure-parts (6)
	HEAD,
	TORSO_UPPER,
	TORSO_LOWER,
	TORSO,
	LIMB,
	HAND_LINK,
	// marks (8)
	DOT,
	DOT_FIELD,
	HATCH_FILL,
	COMB_BORDER_SEGMENT,
	CHAUK,
	SPIRAL,
	WATER_LINE,
	SUN,
	// field (4)
	TREE,
	DEER,
	BIRD,
	HUT,
	// props (12)
	BOOK,
	ADZE,
	SPEAR,
	SLATE,
	VESSEL,
	LENS,
	SCALES,
	SICKLE,
	STAFF,
	LOOM,
	POST,
	TARPA,
];
