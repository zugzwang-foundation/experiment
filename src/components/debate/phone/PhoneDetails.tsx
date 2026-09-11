import { Download } from "lucide-react";
import {
	COMPACT_FROM_MARKET_TOTAL,
	formatDharmaCompact,
} from "@/components/debate/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CriterionDisclosure } from "../CriterionDisclosure";
import { MarketPriceChartHost } from "../chart/MarketPriceChartHost";
import { AttrSep, LifecycleBadge, noun } from "../MarketHeader";
import { MarketMediaPanel } from "../MarketMediaPanel";
import { PriceBar } from "../PriceBar";
import type { DebateViewModel } from "../types";
import { PhoneResolverRows } from "./PhoneResolverRows";

/**
 * RF-7 — everything the phone's title strip opens: the market's own page, as a
 * sheet.
 *
 * ⛔⛔ A SERVER COMPONENT, PASSED DOWN AS `children`. `PhoneDebateView` is a
 * client boundary and this content is not: the media panel, the price bar, the
 * resolver rows and the criterion disclosure are all server components today and
 * there is no reason for any of them to cross. So the page renders this tree and
 * hands it to the client shell as a `ReactNode` — the standard RSC pattern, and
 * the reason the sheet costs a phone almost nothing it was not already paying.
 *
 * ⛔ THE CRITERION IS HERE BY PLACEMENT, NOT BY REVERSAL. `DebateView.tsx`
 * records that the disclosure is deliberately unrendered on the desktop
 * (RESO-3 · change 6) and, in the same block, that the ruling "is a placement
 * decision rather than a verdict on the component". This is a new placement: on
 * a phone the market's binding terms have nowhere else to live — the desktop's
 * answer, that they reach a participant through the `.md` export, is a desktop
 * answer.
 *
 * ⚠ THE CHART MOUNTS WITH THIS TREE, AND THIS TREE MOUNTS ON FIRST OPEN. The
 * host owns its own collapsed-card / overlay state and returns `null` when the
 * series is empty — `hasRenderableSeries`, the ONE place that decides whether
 * there is a chart to draw. Asking that question a second time here is how
 * `RESO-1 · R-4` drew an empty 340px column, so it is not asked again.
 */
export function PhoneDetails({ model }: { model: DebateViewModel }) {
	const { market, priceChart } = model;
	return (
		<div data-testid="phone-details" className="flex flex-col gap-3 pb-3">
			<MarketMediaPanel
				imageUrl={market.mediaImageUrl}
				videoUrl={market.mediaVideoUrl}
				title={market.title}
			/>

			{/* ⚠ THE FULL QUESTION, UNCLIPPED — the same promise the strip makes, and
			    the defect this whole tier exists to fix. No `truncate`, ever. */}
			<h2 className="text-[17px] leading-[1.25] font-bold tracking-tight text-ink">
				{market.title}
			</h2>

			<CriterionDisclosure description={market.description} />

			<PhoneResolverRows market={market} />

			<PriceBar pricing={market.pricing} size="detail" />

			{/* The stats line, with the lifecycle pill and the export affordance
			    sharing its right edge (R2 · S3). */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
					<span className="font-semibold text-ink">
						Đ{" "}
						{formatDharmaCompact(
							market.totals.dharmaStaked,
							COMPACT_FROM_MARKET_TOTAL,
						)}{" "}
						staked
					</span>
					<AttrSep />
					<span>
						{market.totals.postCount}{" "}
						{noun(market.totals.postCount, "post", "posts")}
					</span>
					<AttrSep />
					<span>
						{market.totals.replyCount}{" "}
						{noun(market.totals.replyCount, "reply", "replies")}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<LifecycleBadge status={market.status} />
					{/* ⚠ THE EXPORT AFFORDANCE, REUSED BY ITS href AND ITS ACCESSIBLE
					    NAME — the two things that ARE the affordance — and deliberately
					    WITHOUT `MarketHeader`'s `InfoTip` wrapper. A hover gloss has no
					    hover on a phone, and `asChild` across the RSC boundary is the
					    documented hazard that silently deletes a deferred child
					    (AGENTS.md §5); there is nothing to gain by re-entering it here. */}
					<a
						download
						href={`/m/${market.slug}/export`}
						aria-label="AI mode — download this debate as Markdown"
						data-testid="phone-ai-mode"
						className={cn(
							buttonVariants({ variant: "outline", size: "xs" }),
							"h-5 gap-1 rounded-4xl px-2.5 text-[11px] text-muted-foreground",
						)}
					>
						<Download />
						AI mode
					</a>
				</div>
			</div>

			<MarketPriceChartHost
				series={priceChart?.series ?? []}
				isOpen={market.status === "Open"}
			/>
		</div>
	);
}
