import type { DebateMarketHeader } from "./types";

/**
 * HTML-FINISH · MARKET DETAIL row 3 — the resolver-card slot: `.rescards`
 * (`d5:986`), the last `vm` child of the market arm's `.hstack`, after the
 * resolution criterion.
 *
 * ⛔⛔ IT RENDERS `null`, AND THAT IS THE ROW — not an unfinished implementation.
 * OD-2, founder-ruled to the plan default. The `markets` table carries
 * `id · slug · title · description · status · resolution_deadline · resolved_at ·
 * resolution_outcome · media_video_url · created_by · created_at` and NOTHING
 * ELSE: no resolver name, no logo, no source, no X handle. There is no migration
 * in this task, so there is no data to render.
 *
 * ⛔ RENDERING THE TWO CARD SHELLS WITH EMPTY FIELDS WOULD REPRODUCE `PD-3-09` /
 * `OD-6` EXACTLY — the ruling `MarketHeader.tsx` records, where a placeholder box
 * "rendered a build-time note about unbuilt work to every participant" and was
 * deleted for it. The mockup's own `.rescard` content ("LOGO", "Brihanmumbai
 * Municipal Corporation", "@mybmc") is DEMO COPY describing a market this build
 * does not have; shipping it would be inventing market content, which CLAUDE.md
 * §3 refuses outright.
 *
 * ⇒ WHAT THIS FILE BUYS, since it draws nothing: the slot is real in the
 * COMPOSITION and in the component graph. Its position in the stack is settled
 * and guarded now, so the commit that finally has resolver data changes one
 * return statement instead of re-litigating where the block goes — and a reader
 * of `MarketHeader` can see that the slot was considered rather than forgotten.
 * Row 3 produces ZERO visual change today, deliberately.
 *
 * ⚠ Its coverage is a STRUCTURAL render test, never a visual one. Asserting "it
 * looks right" would require the visual this row is ruled not to draw.
 */
export function ResolverCards({
	market,
}: {
	/**
	 * Accepted so the slot's data dependency is DECLARED at the boundary rather
	 * than discovered later. Nothing on `DebateMarketHeader` can populate a
	 * resolver card today — that is the point, and the type is what will make it
	 * a compile-time question the day a column exists.
	 */
	market: DebateMarketHeader;
}) {
	// Deliberately unread until the schema carries resolver data (F-6 / OD-2).
	void market;
	return null;
}
