import type { DiscoveryMarketView } from "./DiscoveryCarousel";
import { MarketCard } from "./MarketCard";

/**
 * MKT-ROSTER-1-P3 — THE DESKTOP GRID IS 3 COLUMNS, AND BOTH CANDIDATE SHAPES
 * SHIP BEHIND THIS ONE CONST SO A SINGLE COMMIT CAN BE PHOTOGRAPHED TWICE.
 *
 * The roster is six markets (D-49), and four columns render them 4 + 2 — a
 * full row and a stub. Three columns render them 3 × 2. What is NOT settled is
 * what the third column does with the width the fourth gave up:
 *
 *   `centred`   — each tile keeps the pixel width it has today (the 4-column
 *                 width), and the shorter row is centred under the hero. Type,
 *                 image and wrapping are all untouched, so the tiles are the
 *                 same objects in a narrower block.
 *   `stretched` — three equal columns take the full content width. Nothing is
 *                 left over, and every tile is ~116px wider than it was.
 *
 * ⛔ FLIP THE CONST, DO NOT EDIT THE CLASSES. Both strings are literal on their
 * own JSX node for two reasons: Tailwind's scanner only emits utilities it can
 * read as literals, and `discovery-mobile-reflow.test.ts` reads the shipped
 * `className="…"` out of this file rather than re-deriving it. A template
 * literal or a lookup table would compile to a grid with no columns at all and
 * nothing would say so.
 *
 * ⚠ THE PHASE-2 EXIT IS TO DELETE THE LOSER, not to leave the switch. A flag
 * with one live arm is dead code wearing a decision.
 */
type GridVariant = "centred" | "stretched";
const GRID_VARIANT: GridVariant = "centred";

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
 * ⚠ ONLY THE ≥`lg` COLUMN COUNT MOVES AT MKT-ROSTER-1-P3. `sm:grid-cols-2`
 * and the absence of any unprefixed `grid-cols-*` are both load-bearing and
 * both untouched — the second is what leaves the phone tier a single column,
 * and it is a property of an ABSENCE, which is why it has its own guard.
 */
export function DiscoveryGrid({
	markets,
	activeIndex,
}: {
	markets: DiscoveryMarketView[];
	activeIndex: number;
}) {
	const cards = markets.map((m, i) => (
		<MarketCard key={m.card.id} card={m.card} active={i === activeIndex} />
	));

	// HTML-FINISH row 8 — the grid is CONTENT-HEIGHT and REFUSES the slack: the
	// mockup's `.grid` is `flex:0 0 auto` with `align-content:start` (`:148-149`).
	// Everything left over belongs to the hero, which is what makes the hero the
	// focal panel rather than a wall of tiles stretching to fill the window.
	//
	// ⛔ THE TRACK IS `calc((100%-36px)/4)` AND THE `36px` IS NOT A MAGIC NUMBER:
	// it is the FOUR-column grid's three `gap-3`s. Sizing the three tracks by the
	// width a fourth would have had is what makes "the tile does not change size"
	// true at every viewport rather than only at the one it was measured on.
	// `justify-center` then spends the remainder as equal side margin.
	if (GRID_VARIANT === "stretched") {
		return (
			<div
				data-testid="discovery-grid"
				className="grid flex-none gap-3 sm:grid-cols-2 lg:grid-cols-3"
			>
				{cards}
			</div>
		);
	}

	return (
		<div
			data-testid="discovery-grid"
			className="grid flex-none gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,calc((100%-36px)/4))] lg:justify-center"
		>
			{cards}
		</div>
	);
}
