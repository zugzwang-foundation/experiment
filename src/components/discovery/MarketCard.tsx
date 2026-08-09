import Link from "next/link";

import { PriceBar } from "@/components/debate/PriceBar";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { PriceSparkline } from "./PriceSparkline";
import { StatLine } from "./StatLine";

/**
 * The design-language §3.2 LOCKED card composition (Slot 1): image thumb +
 * question · two-line sparkline · YES/NO split bar · `Đ staked·posts·replies`
 * — built identical for Discovery and Profile (pure presentational,
 * DTO-driven). The YES/NO bar is the REUSED debate `PriceBar` (F-6 — no
 * fresh MarketBar). The whole card is ONE link → `/m/[slug]` (§22 F-DISC-1).
 * Image alt = the market question (the OQ-6 dynamic-alt rule); a null
 * `imageUrl` (defensive arm) renders the canon-§6 `IMG` placeholder box.
 * `active` marks the carousel's ringed card via `data-active` — the ring
 * styling itself is the grid/carousel's concern (Slice 5).
 */
export function MarketCard({
	card,
	series,
	active = false,
}: {
	card: DiscoveryCard;
	series: PricePoint[];
	active?: boolean;
}) {
	return (
		<Link
			href={`/m/${card.slug}`}
			data-testid="market-card"
			{...(active ? { "data-active": "true" } : {})}
			// V40 — `.mcard` is 13px padding with `justify-content:space-between`
			// (:150-151): the price bar is pinned to the card floor so a 1-line
			// and a 2-line title produce the same card, rather than floating up
			// behind a short title.
			className="flex flex-col justify-between rounded-[var(--r)] bg-n0 p-[13px] [border:var(--hairline)]"
		>
			<div className="flex items-start gap-3">
				{card.imageUrl === null ? (
					<div
						aria-hidden="true"
						className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
					>
						IMG
					</div>
				) : (
					// biome-ignore lint/performance/noImgElement: presigned R2 GET URLs are short-lived and per-load — next/image optimization would re-fetch through the loader and break the signed query (the CommentImage precedent).
					<img
						src={card.imageUrl}
						alt={card.title}
						className="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover"
					/>
				)}
				<div className="flex min-w-0 flex-col gap-1">
					<h3 className="line-clamp-2 text-[13.5px] leading-[1.32] font-semibold">
						{card.title}
					</h3>
					<StatLine totals={card.totals} size="card" />
				</div>
			</div>
			<div className="mt-[9px] h-10 rounded-[var(--imgr)] [border:var(--hairline)]">
				<PriceSparkline series={series} size="card" />
			</div>
			<div className="mt-[9px]">
				<PriceBar pricing={card.pricing} />
			</div>
		</Link>
	);
}
