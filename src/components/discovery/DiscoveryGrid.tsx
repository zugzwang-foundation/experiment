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
			className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
		>
			{markets.map((m, i) => (
				<MarketCard key={m.card.id} card={m.card} active={i === activeIndex} />
			))}
		</div>
	);
}
