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
 *
 * ⛔ MKT-ROSTER-1-P3 — THREE COLUMNS AT `lg`, NOT FOUR. The D-49 roster is six
 * markets, and four columns render six as 4 + 2: the eye finishes the first row
 * and then finds two stragglers, which says the slate is incomplete when it is
 * exactly what was intended. Three gives the six a shape — two even rows,
 * nothing trailing.
 *
 * ⚠ THE COLUMNS TAKE THE FULL CONTENT WIDTH, which was a founder ruling between
 * two candidates rather than the obvious reading of "three columns". The other
 * was to hold each tile at the width the four-column grid gave it and centre the
 * shorter row — every wrapping decision preserved, at the cost of ~174px of air
 * down each side. Both shipped behind one const for one commit so the two could
 * be photographed from the same build; `stretched` won and the loser is DELETED
 * rather than left behind a flag, because a flag with one live arm is dead code
 * wearing a decision.
 *
 * ⚠ ONLY THE ≥`lg` COLUMN COUNT MOVED. `sm:grid-cols-2` and the absence of any
 * unprefixed `grid-cols-*` are both load-bearing and both untouched — the second
 * is what leaves the phone tier a single column, and it is a property of an
 * ABSENCE, which is why it has its own guard.
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
			// HTML-FINISH row 8 — the grid is CONTENT-HEIGHT and REFUSES the
			// slack: the mockup's `.grid` is `flex:0 0 auto` with
			// `align-content:start` (`:148-149`). Everything left over belongs to
			// the hero, which is what makes the hero the focal panel rather than
			// a wall of tiles stretching to fill the window.
			className="grid flex-none gap-3 sm:grid-cols-2 lg:grid-cols-3"
		>
			{markets.map((m, i) => (
				<MarketCard key={m.card.id} card={m.card} active={i === activeIndex} />
			))}
		</div>
	);
}
