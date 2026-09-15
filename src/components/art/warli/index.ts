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
 * The reason was the payload: this drawing serialised to ~790 KB of markup
 * (82 KB gzipped) per render. WARLI-FIELD-ASSET moved the static field — 86% of
 * it — into a cached file, so a render is now ~110 KB of rings; a second mount
 * is still a decision, not an edit.
 */

export {
	FIELD_ASSET_HREF,
	PHASE_DEG,
	R_INNER,
	R_OUTER,
	VIEW_HEIGHT,
	VIEW_WIDTH,
	WARLI_CSS,
	WarliHero,
	type WarliHeroProps,
} from "./hero";
