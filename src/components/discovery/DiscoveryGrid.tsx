import type { DiscoveryMarketView } from "./DiscoveryCarousel";
import { MarketCard } from "./MarketCard";

/**
 * The ≤8-card market grid (SPEC.1 §22 F-DISC-1; design-canon §2): one
 * locked-composition `MarketCard` per available market — sparse renders
 * ONLY the available cards, never a placeholder (§22 sparse rule). The
 * active carousel index rings its card (`active` → `data-active`; one
 * shared index with the hero + dot, owned by the importing carousel).
 * No directive — client via the carousel's graph.
 *
 * HTML-FINISH row 4 — THE CARDS ARE THE GRID'S DIRECT CHILDREN. Each used to
 * be wrapped in an extra `<div data-testid="grid-ring">` that carried the
 * active outline. The mockup has no such element: `.grid`'s children ARE the
 * `.mcard`s (`:267-282`) and the ring is on the card itself (`.mcard.athero`,
 * `:152`). The wrapper made every tile a child of its grid cell rather than
 * the cell it fills, so it is gone and the ring — geometry, colour call and
 * rationale intact — now lives on `MarketCard`'s own root.
 */
export function DiscoveryGrid({
	markets,
	activeIndex,
}: {
	markets: DiscoveryMarketView[];
	activeIndex: number;
}) {
	return (
		<div
			data-testid="discovery-grid"
			// HTML-FINISH row 8 — with the hero on screen the grid is
			// CONTENT-HEIGHT and REFUSES the slack: the mockup's `.grid` is
			// `flex:0 0 auto` with `align-content:start` (`:148-149`). Everything
			// left over belongs to the hero, which is what makes the hero the
			// focal panel rather than eight tiles stretching to fill the window.
			//
			// DISC-FIT (founder-ruled 2026-09-11) — ALL ≤8 CARDS ON SCREEN AT
			// EVERY SIZE, NO PAGE SCROLL, AND THE HERO NEVER CUT OFF. The page is
			// a fixed viewport band now, so `flex-none` became `shrink min-h-0`:
			// the grid still never GROWS while the hero is on screen, but when
			// the column is shorter than hero + rail + grid it gives height up
			// in proportion to its size, the same way the hero does (its basis is
			// `auto` for exactly this reason) — neither one is sacrificed whole.
			// `auto-rows-fr` makes every row an equal `minmax(0,1fr)` share of
			// the grid's height, however many rows the column count yields, so
			// cards SHRINK to fit rather than push the last row off screen.
			// Where the hero is NOT on screen (phones under 640px wide, landscape
			// phones — the `short:` variant) the grid is the only thing in the
			// column and takes the whole height (`flex-1`). Columns: 2 on phones
			// (`max-mobile:`, four rows), 2 at 640-767px (`sm:`, beside the
			// hero's centre panel alone), 4 from `md` (768px, two rows), and 4
			// on landscape phones (two rows of usable height beat four of 60px).
			// ⛔ No UNPREFIXED `grid-cols-*` — discovery-mobile-reflow.test.ts
			// pins why; `max-mobile:grid-cols-2` is the phone column count.
			// `auto-rows-fr` is harmless while the grid is content-height
			// (rows are then just equal to the tallest card's natural height).
			className="grid min-h-0 shrink auto-rows-fr gap-2 max-mobile:flex-1 max-mobile:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 short:flex-1 short:grid-cols-4"
		>
			{markets.map((m, i) => (
				<MarketCard key={m.card.id} card={m.card} active={i === activeIndex} />
			))}
		</div>
	);
}
