/**
 * The art layer's public surface.
 *
 * ⚠ NOTHING IN THE APP IMPORTS THIS YET, AND THAT IS DELIBERATE. The mount
 * point is the auth surface, which is a named critical path and is under an
 * active lock in another session; mounting here would be a three-line diff and
 * a collision that costs a full plan → execute → review → gate cycle to
 * untangle. The recipe is in the PR body so that mounting stays a decision
 * somebody makes on purpose.
 */

export {
	PHASE_DEG,
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WarliHero,
	type WarliHeroProps,
} from "./hero";
