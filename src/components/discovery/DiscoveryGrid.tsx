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
			className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
		>
			{markets.map((m, i) => {
				const active = i === activeIndex;
				return (
					// The grid OWNS the active ring visual (plan §4: "the ≤8-card
					// grid + the active ring"); the card itself carries only the
					// data-active state hook (Slice 4). JS-toggled class — no
					// :has() (canon §3.10).
					//
					// V42 — geometry to the mockup (`.mcard.athero`, :152): 1.5px
					// outline at 3px offset, was 2px at 2px.
					//
					// The COLOUR is a call, logged: the mockup rings in `--ink`,
					// but BRIDGE retired ink-emphasis borders and
					// `--border-strong` was aliased to n2 — the exact value of
					// every card's own hairline. So the "active" ring differed
					// from a resting card by 2px of width and nothing else.
					// Mapping `--ink` by name is forbidden (it is #fafafa on the
					// dark ramp, far louder than the mockup's #0A0A0A-on-white),
					// so the ring takes n4: one step brighter than the hero
					// panel's n3 (V7), which is one step brighter than the grid's
					// n2 hairline. Three legible steps, all inside the ratified
					// ramp. Founder ruling requested at Gate C.
					<div
						key={m.card.id}
						data-testid="grid-ring"
						{...(active ? { "data-active": "true" } : {})}
						className={
							active
								? "rounded-[var(--r)] [outline:1.5px_solid_var(--color-n4)] outline-offset-[3px]"
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
