/**
 * The primitive vocabulary — fifty-five named marks, and nothing in this
 * directory may be drawn out of anything else.
 *
 * The constraint is the point. Warli-inspired geometric figuration is built from
 * four things: the circle, the triangle, the straight line and the dot. Every
 * primitive below resolves into those four — by construction since WARLI-2,
 * because they are all drawn through the three verbs in `./stroke.tsx` and there
 * is no fourth verb offering a gradient or an arc. The figures in `../figures/`
 * inherit the constraint for free: they cannot reach for something outside the
 * idiom because nothing here can express it. A vocabulary that CANNOT express
 * the wrong thing is worth more than a style guide that asks you not to.
 *
 * `PRIMITIVE_SPECS` exists so a test can assert the set is complete, its ids are
 * unique and its boxes are well-formed, without importing fifty-five symbols by
 * hand and quietly missing the fifty-sixth.
 */

import {
	BULLOCK,
	CRAB,
	DOG,
	FISH,
	HORSE,
	MONKEY,
	PEACOCK,
	ROOSTER,
	SCORPION,
	SNAKE,
	TIGER,
} from "./bestiary";
import { BORDER_BAND } from "./border";
import { FACE } from "./face";
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
import { ORNAMENT } from "./ornament";
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
import {
	BASKET,
	CART,
	DRUM,
	FIELDS,
	GRANARY,
	HILLS,
	LADDER,
	MOON,
	PALM,
	PLOUGH,
	POT,
	WINNOW,
} from "./scenery";
import type { PrimitiveSpec } from "./types";

export * from "./bestiary";
export * from "./border";
export * from "./face";
export * from "./field";
export * from "./figure-parts";
export * from "./marks";
export * from "./ornament";
export * from "./props";
export * from "./scenery";
export * from "./stroke";
export * from "./types";
export * from "./wobble";

/** Every primitive's declared spec, grouped as the source files are. */
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
	// ornament + face (2)
	ORNAMENT,
	FACE,
	// bestiary (11)
	BULLOCK,
	DOG,
	HORSE,
	TIGER,
	MONKEY,
	SCORPION,
	SNAKE,
	CRAB,
	ROOSTER,
	PEACOCK,
	FISH,
	// scenery (12)
	PALM,
	GRANARY,
	HILLS,
	FIELDS,
	MOON,
	LADDER,
	CART,
	POT,
	DRUM,
	BASKET,
	PLOUGH,
	WINNOW,
	// border (1)
	BORDER_BAND,
];
