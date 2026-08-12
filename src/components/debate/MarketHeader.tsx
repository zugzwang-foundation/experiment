import { Badge } from "@/components/ui/badge";
import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketPriceChartHost } from "./chart/MarketPriceChartHost";
import { formatDharma } from "./format";
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
 * (`getPrices`) · the attrs (Đ staked · posts · replies) · the deferred D1
 * placeholders. Composes into the SHELL `(public)/layout.tsx` shell; the
 * placeholder global header is left untouched (superseded at UI.13).
 */
export function MarketHeader({
	market,
	priceChart,
}: {
	market: DebateMarketHeader;
	priceChart: { series: PricePoint[]; nodes: ChartNode[] } | null;
}) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-start justify-between gap-3">
				<h1 className="text-xl font-semibold tracking-tight">{market.title}</h1>
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
			{market.description ? (
				<p className="text-sm text-muted-foreground">{market.description}</p>
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
		</section>
	);
}
