"use client";

import { MarketThumb } from "@/components/discovery/MarketThumb";

import { formatDharma } from "./format";
import { PriceBar } from "./PriceBar";

/**
 * HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`), the post arm's
 * rail: the market the reader is inside, rendered as a card so the market
 * context survives post-focus. It replaces the `Back to market` button.
 *
 * ⛔⛔ IT IS THE EXIT, AND BUILDING IT INERT WOULD MAKE POST-FOCUS A TRAP.
 * `DebateView` syncs `?post=` with `history.replaceState`, never `pushState`,
 * and says so in terms — so browser Back does NOT leave post view. The only
 * other exit was the button this card replaces. d5 contradicts itself here: its
 * comment at `:1020` says "context only — no click, exit lives on the ↙ arrows"
 * while `:1021` is `<div class="mcard vp" onclick="exitPost()">`, and there are
 * no ↙ arrows in this build. ⇒ Interactive, keyboard-reachable, and carrying
 * the accessible name the button already had.
 *
 * ⛔ THE ACCESSIBLE NAME IS BYTE-CARRIED, NOT AUTHORED — "Back to the market",
 * lifted from the `PostFocusHeader` button this card supersedes, so the exit
 * announces identically before and after the change.
 *
 * ⛔ NO SPARKLINE, AND THAT IS THE SPEC OVERRULING THE MOCKUP. d5's `.mcard`
 * carries a `.spark` between the title block and the price bar. The market
 * card's LOCKED composition is "image thumb + question · YES/NO split bar ·
 * `Đ volume · posts · replies`" (design-language §3.2), from which the two-line
 * sparkline was STRUCK at HTML-FINISH · DISCOVERY with the paired SPEC.1 1.0.30
 * amendment — and that amendment deliberately RETAINED "must be identical
 * everywhere" as its load-bearing half, so the surfaces stay one composition
 * rather than being freed to diverge. A sparkline here would re-open exactly
 * what that ruling closed. This is an existing ruling applied, not a new one.
 */
export function FocusMarketCard({
	title,
	imageUrl,
	pricing,
	totals,
	onExit,
}: {
	title: string;
	imageUrl: string | null;
	pricing: { yes: string; no: string } | null;
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	onExit: () => void;
}) {
	return (
		<button
			type="button"
			data-testid="focus-market-card"
			onClick={onExit}
			aria-label="Back to the market"
			// ⚠ `.mcard{flex:1 1 auto;min-height:0}` (`d5:802`) — the card FILLS the
			// post arm's rail, exactly as the market arm's chart fills its own.
			// Measured on staging at eaafd86: 134px in a 188px rail (17.2% vs d5's
			// 24.2%, −7.0pp), because the card was content-sized and this build
			// carries no sparkline to pad it out. Filling closes the delta without
			// re-opening the sparkline ruling (SPEC.1 1.0.30), which stays struck.
			className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-(--r) p-3 text-left [border:var(--hairline)]"
		>
			{/* `.qrow` — thumb + question. The locked composition's first element. */}
			<span className="flex items-center gap-3">
				<MarketThumb
					src={imageUrl}
					// Decorative — the question is right beside it and carries the
					// meaning. `discovery/MarketCard.tsx` makes the same call.
					alt=""
					className="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover"
					fallback={
						<span
							aria-hidden="true"
							className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
						>
							IMG
						</span>
					}
				/>
				<span className="line-clamp-2 min-w-0 text-[13.5px] leading-[1.32] font-semibold">
					{title}
				</span>
			</span>

			{/* ⚠ `size="card"` — the geometry the LOCKED composition already uses at
			    its other two sites, so this card's bar is the same bar. ⛔ Not
			    `detail`: that preset is the header's full-width rail bar, and this
			    is a card. */}
			<PriceBar pricing={pricing} size="card" />

			{/* `Đ volume · posts · replies` — the locked composition's third element. */}
			<span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span>Đ {formatDharma(totals.dharmaStaked)} staked</span>
				<span>
					{totals.postCount} {noun(totals.postCount, "post", "posts")}
				</span>
				<span>
					{totals.replyCount} {noun(totals.replyCount, "reply", "replies")}
				</span>
			</span>
		</button>
	);
}

/**
 * PD-3-08 — the count and its noun agree: `1 post`, never `1 posts`. Zero is
 * PLURAL.
 *
 * ⚠ THE THIRD COPY OF THIS THREE-LINE RULE, and it is a copy because the two
 * existing homes are both unreachable: `discovery/StatLine.tsx` is file-private
 * (which `MarketHeader.tsx` already records as its own reason for duplicating
 * it), and the shared `debate/format.ts` is outside this task's ratified
 * allow-list. ⇒ Docketed rather than smuggled: giving this rule ONE home is a
 * follow-up whose fence has to include `format.ts`.
 */
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);
