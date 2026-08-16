import { Badge } from "@/components/ui/badge";
import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketPriceChartHost } from "./chart/MarketPriceChartHost";
import { formatDharma } from "./format";
import { HeadZone } from "./HeadZone";
import { PriceBar } from "./PriceBar";
import type { DebateMarketHeader } from "./types";

const TERMINAL: ReadonlySet<string> = new Set([
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
]);

/**
 * PD-3-08 — the count and its noun agree: `1 post`, never `1 posts`. Zero is
 * PLURAL (`0 replies`). Mirrors the shipped reference implementation in
 * `src/components/discovery/StatLine.tsx`, which is file-private there and so
 * cannot be imported without widening that module's surface.
 */
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The market lifecycle / resolution marker (INV-4 / design-language §3.1). A
 * terminal market (Closed/Resolving/Resolved/Voided/Frozen) reads as locked —
 * "read-only" — paired with the literal status (never colour alone, §8).
 */
function LifecycleBadge({ status }: { status: DebateMarketHeader["status"] }) {
	const terminal = TERMINAL.has(status);
	return (
		<Badge
			variant={terminal ? "secondary" : "outline"}
			aria-label={`Market ${status}${terminal ? ", read-only" : ""}`}
		>
			{status}
			{terminal ? " · read-only" : ""}
		</Badge>
	);
}

/**
 * The market-view header (DEBATE.4 §4): question = `markets.title`, resolution
 * criterion = `markets.description` (R-14.4) · lifecycle marker · the price bar
 * (`getPrices`) · the attrs (Đ staked · posts · replies). Composes into the
 * SHELL `(public)/layout.tsx` shell; the placeholder global header is left
 * untouched (superseded at UI.13). ⚠ The deferred D1 placeholder box was
 * REMOVED at POLISH.3 (PD-3-09 / OD-6) — it rendered a build-time note about
 * unbuilt work to every participant. The record that market media and resolver
 * cards are still unbuilt survives at `docs/polish/POLISH-0.md` §3 and
 * `docs/parked.md`'s `MEDIA.2-GOLIVE`; the carousel itself is MEDIA.2's.
 *
 * HTML-FINISH · MARKET DETAIL row 1 — THIS IS THE HEADZONE'S MARKET ARM, and it
 * is now rendered INSIDE the market↔post ternary rather than above it. Every
 * element below is a `vm` element in the mockup (`.question` · `.attrs` ·
 * `.criterion` · `.graph` · `.barrow f`); the post arm's `vp` set is
 * `PostFocusHeader`'s. The two are disjoint and they SWAP — see `HeadZone.tsx`.
 *
 * ⇒ CONSEQUENCE, DECLARED: the lifecycle marker and `Download .md` become
 * MARKET-ARM ONLY, exactly like every other `vm` element beside them. ⛔ Neither
 * is DELETED — row 9 is a reverse delta the founder has not ruled, and OD-3
 * keeps all five. The ADR-0025 export stays reachable and the INV-4 read-only
 * marker stays rendered wherever the market itself is the subject; in post-focus
 * the reader's market context is the row-17 market card, one click from exit.
 */
export function MarketHeader({
	market,
	priceChart,
}: {
	market: DebateMarketHeader;
	priceChart: { series: PricePoint[]; nodes: ChartNode[] } | null;
}) {
	return (
		<HeadZone
			// The rail lands at C4 (the chart) and C6 (the price bar). Until then
			// this arm is one column and the surface does not move — `null` renders
			// no rail at all rather than an empty 25% box (PD-3-09).
			right={null}
			left={
				<>
					<div className="flex items-start justify-between gap-3">
						<h1 className="text-xl font-semibold tracking-tight">
							{market.title}
						</h1>
						<div className="flex shrink-0 items-center gap-2">
							<LifecycleBadge status={market.status} />
							{/* EXPORT.1 — native download of the debate `.md` (server-mediated GET);
					    plain anchor, no client boundary, works signed-out. */}
							<a
								download
								href={`/m/${market.slug}/export`}
								aria-label="Download this debate as Markdown"
								className="text-muted-foreground text-xs underline-offset-2 hover:underline"
							>
								Download .md
							</a>
						</div>
					</div>
					{/* T1 — the RESOLUTION criterion block (`d5:974-977`, `.criterion` +
			    `.overline`). The container is a TOP HAIRLINE RULE + padding
			    (`d5:467` `margin-top:12px; border-top:var(--hairline);
			    padding-top:10px`), NOT a boxed card; the 12px margin is already
			    carried by this section's `gap-3`.

			    ⛔ NO CLAMP, AND THAT IS A RULING, NOT AN OMISSION (§17 H-T1(c)).
			    The mockup's `.crittext` carries `-webkit-line-clamp:2` (`d5:470-471`)
			    and it is filed BUCKET D. `market.description` is the RESOLUTION
			    CRITERION — the terms of the bet: (i) a bare clamp with no affordance
			    is the exact defect class PD-0-01/R4 is REMOVING from post cards in
			    this same PR, so introducing it on the most consequential text on the
			    surface would be incoherent; (ii) U3 makes criteria long BY DESIGN
			    and the mockup's demo criterion is a short stand-in; (iii) unclamped
			    IS the status quo, so the mockup would be INTRODUCING a truncation of
			    the bet terms. ⛔ No affordance either — "Criterion length treatment"
			    is docketed to HEADER-3ZONE.

			    ⚠ LOCAL STYLES, NOT A PRESET (§17 H-T1(b)). `git grep -i
			    "overline|eyebrow" -- src/` is clean, and within PR 2's fence there is
			    exactly ONE consumer; every existing micro-label consumer is out of
			    fence (`discovery/HeroPanels`, `composer/BetComposer` — deny-listed,
			    `shell/IdentityCluster`, `shell/DharmaCluster`), and §5 forbids a
			    batch spanning surfaces. The docket row carries the census.

			    ⚠ The recipe is `.overline`'s (`d5:468-469`) and ONLY `.overline`'s.
			    The family shares weight/transform/colour and NOTHING else — `.poslab`
			    and `.colstk .lab` are 8px/.12em, `.reslabel` is 8px/.14em. Reading
			    any of those and generalising across ROLES is how the earlier
			    8px/.12em recipe was wrong. Ported BY TOKEN (`text-n4`), never the
			    hex — Ruling A / H-HEX. */}
					{market.description ? (
						<div className="pt-2.5 [border-top:var(--hairline)]">
							<div className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
								Resolution
							</div>
							<p className="mt-[5px] text-sm text-muted-foreground">
								{market.description}
							</p>
						</div>
					) : null}
					{/* UI.19 §9 — the market-detail price chart, above PriceBar. Rendered
			    ONLY when non-null: a null series read is non-fatal (web Gate-C
			    error-state), the rest of the header stands. */}
					{priceChart ? (
						<MarketPriceChartHost
							series={priceChart.series}
							nodes={priceChart.nodes}
						/>
					) : null}
					<PriceBar pricing={market.pricing} size="detail" />
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>Đ {formatDharma(market.totals.dharmaStaked)} staked</span>
						<span>
							{market.totals.postCount}{" "}
							{noun(market.totals.postCount, "post", "posts")}
						</span>
						<span>
							{market.totals.replyCount}{" "}
							{noun(market.totals.replyCount, "reply", "replies")}
						</span>
					</div>
				</>
			}
		/>
	);
}
