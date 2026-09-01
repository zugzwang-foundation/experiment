/**
 * The art layer's public surface.
 *
 * ⚠ EXACTLY ONE THING IN THE APP IMPORTS THIS: `src/app/(auth)/layout.tsx`,
 * where the piece hangs as a `fixed inset-0 -z-10` underlay behind the three
 * auth routes (WARLI-MOUNT). This docblock used to say nothing imported it,
 * which was true and was the point — the mount was deferred while the auth
 * surface was under a lock in another session.
 *
 * ⚠ THE COUNT IS STILL PINNED, and that has not become less important now that
 * it is one rather than zero. `tests/unit/art/art-layer-guards.test.ts` asserts
 * the importer list equals exactly that one file, so a second mount reddens.
 * The reason is the payload: this drawing serialises to ~790 KB of markup
 * (82 KB gzipped) per render, which is a deliberate trade on a signed-out auth
 * route and would be an accident anywhere else.
 */

export {
	PHASE_DEG,
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WARLI_CSS,
	WarliHero,
	type WarliHeroProps,
} from "./hero";
