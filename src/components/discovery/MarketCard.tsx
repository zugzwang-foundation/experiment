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
			// ⛔⛔ MKT-ROSTER-1-P3 · THE xl (>=1280) ANATOMY, AND IT IS A GRID RATHER
			// THAN THE FLEX COLUMN BELOW IT. Three columns of six markets gave every
			// tile ~116px it did not have, and the founder spent it on the picture:
			// a 96x96 image on the left with the title, stats and price bar stacked
			// beside it, instead of a 52px thumb above a full-width bar.
			//
			// ⚠ WHY GRID, WHEN THE TARGET IS DESCRIBED AS "a row with a column in
			// it". The bar and the title block are SIBLINGS in this DOM — the bar is
			// full-card-width below xl and must sit INSIDE the right column above it,
			// and one node cannot have two parents. `xl:contents` on the title row
			// dissolves it, which makes the thumb and the text block direct children
			// here; auto-placement then puts the thumb at (1,1) spanning both rows,
			// the text block at (1,2) and the bar at (2,2). No DOM moved.
			//
			// ⛔ `content-between`, NOT `grid-rows-[1fr_auto]`, AND THE DIFFERENCE IS
			// THE 96px FLOOR. An item spanning a FLEXIBLE track is excluded from that
			// track's intrinsic sizing, so with a `1fr` first row the 96px image
			// contributes nothing to the height and overflows its own area when the
			// text is short. Two AUTO rows size to content — the spanning image is
			// counted, which is what makes "tile height = max(96, column)" true by
			// construction — and `align-content: space-between` then hands every
			// spare pixel to the gap BETWEEN them, which is what pins the bar to the
			// floor when a taller row-mate stretches the tile.
			//
			// ⚠ `justify-between` above is INERT at xl, not contradictory: on a grid
			// it distributes TRACKS along the inline axis, and `1fr` already consumes
			// the free space there. Left unprefixed so the sub-xl render takes zero
			// diff, which is the whole of ADR-0045's override-never-replace rule.
			className={`flex flex-col justify-between rounded-[var(--r)] bg-n0 p-[13px] [border:var(--hairline)] xl:grid xl:grid-cols-[96px_1fr] xl:content-between xl:gap-x-3${
				active
					? " [outline:var(--ring-active)] outline-offset-[3px] max-mobile:outline-none"
					: ""
			}`}
		>
			{/* HTML-FINISH row 5 — the picture is CENTRED against the title block,
			    not top-aligned. The mockup uses ONE `.qrow` class for the tile and
			    the hero alike (`align-items:center`, :122) and the hero already
			    shipped `items-center`; the tile was the odd one out. */}
			{/* ⛔ `xl:contents` DISSOLVES THIS ROW ABOVE 1280 — see the root. Its
			    `items-center` and `gap-3` go inert with it, which is correct: the
			    picture is `self-start` at xl and the column gap is the grid's. */}
			<div className="flex items-center gap-3 xl:contents">
				<MarketThumb
					src={card.imageUrl}
					alt=""
					// ⛔ `xl:object-contain` REVERSES THIS SITE'S `object-cover` ABOVE
					// 1280, and only above it. `cover` is right for a 52px thumb, where
					// a crop reads as a detail; at 96px the picture is the tile's
					// subject and a crop is a decision nobody made — the same founder
					// wall `HeroPanels`' post image already carries. `xl:self-start`
					// because the image spans both grid rows and is a fixed 96, so it
					// aligns with the title's cap rather than floating in the slack.
					className="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover xl:row-span-2 xl:h-24 xl:w-24 xl:self-start xl:object-contain"
					fallback={
						<div
							aria-hidden="true"
							// Tracks the image's geometry exactly — it stands in the same
							// grid area. No `object-*`: this is a div with a word in it.
							className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4 xl:row-span-2 xl:h-24 xl:w-24 xl:self-start"
						>
							IMG
						</div>
					}
				/>
				<div className="flex min-w-0 flex-col gap-1">
					{/* ⛔ THE CLAMP IS RELEASED AT xl, FOUNDER-RULED — no clamp, no
					    truncation. Measured at 1440 on the deployed branch: the widest
					    of the six titles wraps to TWO lines inside the 319px the right
					    column gives it, so releasing the clamp changes nothing the
					    reader sees today. What it changes is the failure mode: a
					    seventh market with a longer question grows its tile instead of
					    silently losing the end of its own sentence. Below 1280 the
					    clamp stands — there the column is too narrow to take the risk. */}
					<h3 className="line-clamp-2 text-[13.5px] leading-[1.32] font-semibold xl:line-clamp-none">
						{card.title}
					</h3>
					<StatLine totals={card.totals} size="card" />
				</div>
			</div>
			<div className="mt-[9px]">
				<PriceBar pricing={card.pricing} size="card" />
			</div>
		</Link>
	);
}
