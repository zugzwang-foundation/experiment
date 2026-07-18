import type { DiscoveryMarketView } from "./DiscoveryCarousel";
import { MarketCard } from "./MarketCard";

/**
 * The ≤8-card market grid (SPEC.1 §22 F-DISC-1; design-canon §2): one
 * locked-composition `MarketCard` per available market — sparse renders
 * ONLY the available cards, never a placeholder (§22 sparse rule). The
 * active carousel index rings its card (`active` → `data-active`; one
 * shared index with the hero + dot, owned by the importing carousel).
 * No directive — client via the carousel's graph.
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
			className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		>
			{markets.map((m, i) => {
				const active = i === activeIndex;
				return (
					// The grid OWNS the active ring visual (plan §4: "the ≤8-card
					// grid + the active ring"); the card itself carries only the
					// data-active state hook (Slice 4). JS-toggled class — no
					// :has() (canon §3.10).
					<div
						key={m.card.id}
						data-testid="grid-ring"
						{...(active ? { "data-active": "true" } : {})}
						className={
							active
								? "rounded-[var(--r)] [outline:2px_solid_var(--border-strong)] outline-offset-2"
								: undefined
						}
					>
						<MarketCard card={m.card} series={m.series} active={active} />
					</div>
				);
			})}
		</div>
	);
}
