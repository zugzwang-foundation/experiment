import Link from "next/link";

import { PriceBar } from "@/components/debate/PriceBar";
import type { DiscoveryCard } from "@/server/discovery/list";

import { MarketThumb } from "./MarketThumb";
import { StatLine } from "./StatLine";

/**
 * The design-language §3.2 LOCKED card composition (Slot 1): image thumb +
 * question · YES/NO split bar · `Đ staked·posts·replies` — built identical for
 * Discovery and Profile (pure presentational, DTO-driven). The YES/NO bar is
 * the REUSED debate `PriceBar` (F-6 — no fresh MarketBar). The whole card is
 * ONE link → `/m/[slug]` (§22 F-DISC-1).
 *
 * HTML-FINISH row 1 — THE TILE CARRIES NO PRICE CHART. The mockup's `.mcard`
 * is `.qrow` + `.barrow m` with nothing between (`:269-282`), and its `.spark`
 * rule (`:155`) styles NO ELEMENT IN THE DOCUMENT — a dead rule is the tell
 * that the chart was removed from the tile and its CSS left behind. The
 * sparkline box and the `series` prop that fed it are gone from this
 * composition. ⚠ THE TILE STILL CARRIES NO CHART, AND CHART-1 DID NOT CHANGE
 * THAT — the ratified mockup governs the tile and this paragraph stands. What
 * changed is the sentence that used to follow it: `PriceSparkline` was kept
 * alive because the hero rendered it, and at CHART-1 the hero moved onto the
 * `/m/[slug]` chart component, so the sparkline had no caller left and was
 * deleted. `DiscoveryMarketView.series` still carries the series to the hero,
 * so no read model changed here either (removing the FETCH remains PERF-1's,
 * not this task's).
 * The thumb is the shared `MarketThumb` (PRIMITIVES-2 D2), which renders the
 * canon-§6 `IMG` placeholder box for BOTH a null `imageUrl` (defensive arm)
 * and a presigned URL that 404s. Its `alt` is `""`: the same title renders in
 * the adjacent `<h3>` two lines below, so the thumb is decorative here, and a
 * duplicated announcement is also what overflowed the metadata row on a broken
 * load (D4 / PD-2-33 — this supersedes the OQ-6 dynamic-alt rule AT THIS SITE;
 * the WCAG 1.1.1 half remains A11Y.0's row).
 * `active` marks the carousel's ringed card via `data-active` AND carries the
 * ring itself (HTML-FINISH row 4 — see below).
 */
export function MarketCard({
	card,
	active = false,
}: {
	card: DiscoveryCard;
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
			//
			// HTML-FINISH row 4 — THE RING IS ON THE TILE, and the wrapper box
			// that used to carry it is gone. The mockup rings `.mcard` itself
			// (`.mcard.athero`, :152) and `.grid`'s children ARE the cards
			// (:267-282), so the extra `<div>` around every tile had no mockup
			// counterpart: it made the tile a child of the grid cell rather than
			// the cell it fills. Moved here FROM `DiscoveryGrid.tsx` with its
			// geometry unchanged — 1.5px at 3px offset, via the `--ring-active`
			// ladder token.
			//
			// V42 + the colour call, carried verbatim from the grid because it
			// documents THIS line: the mockup rings in `--ink`, but BRIDGE retired
			// ink-emphasis borders and `--border-strong` was aliased to n2 — the
			// exact value of every card's own hairline, so the "active" ring
			// differed from a resting card by 2px of width and nothing else.
			// Mapping `--ink` by name is forbidden (it is #fafafa on the dark
			// ramp, far louder than the mockup's #0A0A0A-on-white), so the ring
			// takes n4: one step brighter than the hero panel's n3 (V7), which is
			// one step brighter than the grid's n2 hairline. Three legible steps,
			// all inside the ratified ramp. Founder ruling requested at Gate C.
			//
			// JS-toggled class — no `:has()` (canon §3.10).
			//
			// ⛔⛔ MOBILE-1 Phase A — THE RING IS SUPPRESSED BELOW 640px, and the
			// reason is that it stops meaning anything there. The ring marks the
			// card whose hero is currently featured; the founder ruled the hero
			// hidden at phone width (`HeroPanels.tsx`), so the ring would point
			// at a panel that is not on screen. Worse, it MOVES: the carousel's
			// 10s auto-advance keeps running behind the hidden hero, so a card
			// highlights itself and the highlight wanders down the list every
			// ten seconds with nothing on screen explaining it. MEASURED in a
			// browser at 375px — this was visible, not theoretical, and it is
			// the user-facing half of the "CSS hide leaves the timer running"
			// cost that this task first recorded as invisible.
			// ⚠ `max-mobile:outline-none` rather than stopping the timer: killing
			// the timer needs a client viewport read, which plan §4 rules against
			// (hydration). Suppressing the only thing it renders is the
			// pure-CSS answer, and it leaves >=640px byte-identical.
			className={`flex min-h-0 flex-col justify-between overflow-hidden rounded-[var(--r)] bg-n0 p-2.5 [border:var(--hairline)]${
				active
					? " [outline:var(--ring-active)] outline-offset-[3px] max-mobile:outline-none"
					: ""
			}`}
		>
			{/* HTML-FINISH row 5 — the picture is CENTRED against the title block,
			    not top-aligned. The mockup uses ONE `.qrow` class for the tile and
			    the hero alike (`align-items:center`, :122) and the hero already
			    shipped `items-center`; the tile was the odd one out. */}
			<div className="flex items-center gap-3">
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
				<div className="flex min-w-0 flex-col gap-0.5">
					<h3 className="line-clamp-1 text-[13.5px] leading-[1.32] font-semibold">
						{card.title}
					</h3>
					<StatLine totals={card.totals} size="card" />
				</div>
			</div>
			<div className="mt-1">
				<PriceBar pricing={card.pricing} size="card" />
			</div>
		</Link>
	);
}
