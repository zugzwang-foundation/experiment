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
			className="flex flex-col gap-3 rounded-[var(--r)] bg-n0 p-4 [border:var(--hairline)]"
		>
			<div className="flex items-start gap-3">
				{card.imageUrl === null ? (
					<div
						aria-hidden="true"
						className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[10px] text-muted-foreground"
					>
						IMG
					</div>
				) : (
					// biome-ignore lint/performance/noImgElement: presigned R2 GET URLs are short-lived and per-load — next/image optimization would re-fetch through the loader and break the signed query (the CommentImage precedent).
					<img
						src={card.imageUrl}
						alt={card.title}
						className="h-12 w-12 shrink-0 rounded-[var(--imgr)] object-cover"
					/>
				)}
				<div className="flex min-w-0 flex-col gap-1">
					<h3 className="text-sm font-medium leading-snug">{card.title}</h3>
					<StatLine totals={card.totals} />
				</div>
			</div>
			<div className="h-10">
				<PriceSparkline series={series} size="card" />
			</div>
			<PriceBar pricing={card.pricing} />
		</Link>
	);
}
