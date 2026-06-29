import { Badge } from "@/components/ui/badge";

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
 * Explicit deferred placeholders (D1 / SHELL placeholder discipline) — resolver
 * cards, market media, and the price-graph history are UNBACKED by the current
 * schema and arrive with a future market-content slice / ledger-replay
 * read-model. Rendered as labelled stubs, never invented copy (§3 refusals).
 */
function DeferredPlaceholders() {
	return (
		<div className="flex flex-col gap-1 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
			<span>Resolver cards — arrive with the market-content slice</span>
			<span>Market media — arrive with the market-content slice</span>
			<span>Price history — arrives with the ledger-replay read-model</span>
		</div>
	);
}

/**
 * The market-view header (DEBATE.4 §4): question = `markets.title`, resolution
 * criterion = `markets.description` (R-14.4) · lifecycle marker · the price bar
 * (`getPrices`) · the attrs (Đ staked · posts · replies) · the deferred D1
 * placeholders. Composes into the SHELL `(public)/layout.tsx` shell; the
 * placeholder global header is left untouched (superseded at UI.13).
 */
export function MarketHeader({ market }: { market: DebateMarketHeader }) {
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
			<PriceBar pricing={market.pricing} />
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span>Đ{formatDharma(market.totals.dharmaStaked)} staked</span>
				<span>{market.totals.postCount} posts</span>
				<span>{market.totals.replyCount} replies</span>
			</div>
			<DeferredPlaceholders />
		</section>
	);
}
