import Link from "next/link";

import { PriceBar } from "@/components/debate/PriceBar";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketThumb } from "./MarketThumb";
import { PriceSparkline } from "./PriceSparkline";
import { StatLine } from "./StatLine";

/**
 * The design-language §3.2 LOCKED card composition (Slot 1): image thumb +
 * question · two-line sparkline · YES/NO split bar · `Đ staked·posts·replies`
 * — built identical for Discovery and Profile (pure presentational,
 * DTO-driven). The YES/NO bar is the REUSED debate `PriceBar` (F-6 — no
 * fresh MarketBar). The whole card is ONE link → `/m/[slug]` (§22 F-DISC-1).
 * The thumb is the shared `MarketThumb` (PRIMITIVES-2 D2), which renders the
 * canon-§6 `IMG` placeholder box for BOTH a null `imageUrl` (defensive arm)
 * and a presigned URL that 404s. Its `alt` is `""`: the same title renders in
 * the adjacent `<h3>` two lines below, so the thumb is decorative here, and a
 * duplicated announcement is also what overflowed the metadata row on a broken
 * load (D4 / PD-2-33 — this supersedes the OQ-6 dynamic-alt rule AT THIS SITE;
 * the WCAG 1.1.1 half remains A11Y.0's row).
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
				<MarketThumb
					src={card.imageUrl}
					alt=""
					className="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover"
					fallback={
						<div
							aria-hidden="true"
							className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
						>
							IMG
						</div>
					}
				/>
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
				<PriceBar pricing={card.pricing} size="card" />
			</div>
		</Link>
	);
}
