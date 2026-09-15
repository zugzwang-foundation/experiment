"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import { MarketThumb } from "@/components/discovery/MarketThumb";

import { MarketTotalDharma } from "./DharmaFigure";
import { PriceBar } from "./PriceBar";

/**
 * HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`), the post arm's
 * rail: the market the reader is inside, rendered as a card so the market
 * context survives post-focus. It replaces the `Back to market` button.
 *
 * ⛔⛔ IT IS THE EXIT, AND BUILDING IT INERT WOULD MAKE POST-FOCUS A TRAP. d5
 * contradicts itself here: its comment at `:1020` says "context only — no
 * click, exit lives on the ↙ arrows" while `:1021` is
 * `<div class="mcard vp" onclick="exitPost()">`, and there are no ↙ arrows in
 * this build. ⇒ Interactive, keyboard-reachable, and carrying the accessible
 * name the button already had.
 *
 * ⚠ THE PARAGRAPH ABOVE USED TO SAY IT WAS THE **ONLY** EXIT, on the grounds
 * that `?post=` synced with `replaceState` so browser Back did not leave post
 * view. RPLY-1 · R2 reversed that: entering PUSHES a rung, so Back leaves post
 * focus too. The card is no longer the only way out — it is still the visible
 * one, which is why it is not allowed to be inert.
 *
 * ⚠⚠ UI-FOLLOWUP B — IT IS AN `<a>` NOW, AND THE PLAIN CLICK STILL UNWINDS.
 * The two are not in tension; they answer different questions. The `href` is
 * what makes it a place rather than a gesture: it can be middle-clicked into a
 * tab, ⌘-clicked, copied, and read by anything that inventories a page's links —
 * none of which a `<button>` can offer, and all of which are true of the market
 * card on every other surface. The plain left click is intercepted because
 * RPLY-1 · R2 owns that transition: `enterPost` pushed one rung and `exitPost`
 * pops it, so entering and leaving is depth-neutral. Navigating instead would
 * push a SECOND rung and grow the stack by two per visit — the history pollution
 * R2's comment argues against at length, arriving through the fix for it.
 * ⇒ Modified clicks (⌘/ctrl/shift/alt, middle button) are NOT intercepted and
 * take the href, because those gestures mean "somewhere else", and unwinding
 * this tab's history is not that.
 * ⚠ THE VISIBLE CONSEQUENCE, stated because it is the one thing a reader can
 * notice: after leaving, the reply view is FORWARD, not Back. Back-returns-to-
 * the-reply-view and depth-neutral are mutually exclusive — to have the reply
 * view behind you, you must have pushed past it. R2's ruling is the one in the
 * repository, so it governs until it is reversed; dropping the
 * `preventDefault()` below is the whole of the switch if it is.
 *
 * ⛔ THE ACCESSIBLE NAME IS BYTE-CARRIED, NOT AUTHORED — "Back to the market",
 * lifted from the `PostFocusHeader` button this card supersedes, so the exit
 * announces identically before and after the change. It is NOT re-worded to
 * match the new return line: the name is pinned by test and by provenance, and
 * both strings describe the same action in the same direction.
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
	slug,
	imageUrl,
	pricing,
	totals,
	onExit,
	compact = false,
}: {
	title: string;
	/** UI-FOLLOWUP B — the market's public slug, so the card has a real address. */
	slug: string;
	imageUrl: string | null;
	pricing: { yes: string; no: string } | null;
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	onExit: () => void;
	compact?: boolean;
}) {
	/**
	 * ⛔ THE MODIFIER GUARD IS WHAT KEEPS THE `href` HONEST. Without it a
	 * ⌘-click would be swallowed by `preventDefault()` and quietly unwind this
	 * tab instead of opening a new one — an address that exists but cannot be
	 * used the way an address is used. `next/link` skips its own navigation when
	 * the handler has already prevented the default, so this is the whole of the
	 * arbitration.
	 */
	const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		event.preventDefault();
		onExit();
	};
	return (
		<Link
			href={`/m/${slug}`}
			// POLL-IDLE 1b — no prefetch: every DebatePoll refresh invalidates the
			// prefetch cache and re-prefetches every visible link (Next 16.3.2
			// `pingVisibleLinks`), so this link cost a request per tick, per viewer.
			prefetch={false}
			data-testid="focus-market-card"
			onClick={onClick}
			aria-label="Back to the market"
			// ⚠ `.mcard{flex:1 1 auto;min-height:0}` (`d5:802`) — the card FILLS the
			// post arm's rail, exactly as the market arm's chart fills its own.
			// Measured on staging at eaafd86: 134px in a 188px rail (17.2% vs d5's
			// 24.2%, −7.0pp), because the card was content-sized and this build
			// carries no sparkline to pad it out. Filling closes the delta without
			// re-opening the sparkline ruling (SPEC.1 1.0.30), which stays struck.
			// ⚠⚠ UI-FOLLOWUP B — `flex-1` NOW ACTUALLY FILLS SOMETHING. It has been
			// on this card since row 17, but entry 3 gave the post arm's band
			// `lg:items-start`, so the rail was content-height and there was no
			// spare height for the card to claim. That top-alignment is gone (see
			// `HeadZone`), the rail stretches to the reading column again, and the
			// height this declaration takes is spent on the return line pinned to
			// the card's floor rather than on empty border.
			//
			// ⚠ THE HOVER AND FOCUS TREATMENTS ARE THE SHIPPED IDIOMS, NOT NEW
			// APPEARANCES. `hover:bg-n1` is the card-highlight `PostCard` already
			// carries on the debate surface, and `outline-none` +
			// `focus-visible:shadow-(--state-focus-ring)` is the pair every
			// focusable in the participant tree uses (the header controls, both
			// route boundaries, `discovery/ErrorState`, the hero panel's own link).
			// ⛔ THE FOCUS RING IS NOT COSMETIC HERE. As a `<button>` this card had
			// no focus treatment at all, so a keyboard reader Tabbed an invisible
			// cursor onto the one control that leaves post focus — CS13 §4's finding
			// on the hero panel, in the same shape, on a more consequential control.
			className={`flex min-h-0 w-full flex-1 flex-col ${
				compact ? "gap-1 p-2" : "gap-3 p-3"
			} rounded-(--r) text-left outline-none [border:var(--hairline)] [transition:background-color_var(--dur-hover)] hover:bg-n1 focus-visible:shadow-(--state-focus-ring)`}
		>
			{/* `.qrow` — thumb + question. The locked composition's first element. */}
			<span className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
				<MarketThumb
					src={imageUrl}
					// Decorative — the question is right beside it and carries the
					// meaning. `discovery/MarketCard.tsx` makes the same call.
					alt=""
					className={`${
						compact ? "h-8 w-8" : "h-[52px] w-[52px]"
					} shrink-0 rounded-[var(--imgr)] object-cover`}
					fallback={
						<span
							aria-hidden="true"
							className={`flex ${
								compact
									? "h-8 w-8 text-[7px]"
									: "h-[52px] w-[52px] text-[8.5px]"
							} shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono tracking-[0.16em] text-n4`}
						>
							IMG
						</span>
					}
				/>
				<span
					className={`line-clamp-${compact ? "1" : "2"} min-w-0 ${
						compact ? "text-[12px]" : "text-[13.5px]"
					} leading-[1.32] font-semibold`}
				>
					{title}
				</span>
			</span>

			{/* ⚠ `size="card"` — the geometry the LOCKED composition already uses at
			    its other two sites, so this card's bar is the same bar. ⛔ Not
			    `detail`: that preset is the header's full-width rail bar, and this
			    is a card. */}
			<PriceBar pricing={pricing} size="card" />

			{/* `Đ volume · posts · replies` — the locked composition's third element. */}
			<span
				className={`flex flex-wrap ${compact ? "gap-x-2.5 text-[11px]" : "gap-x-4 text-xs"} gap-y-1 text-muted-foreground`}
			>
				{/* ⚠ UI-FOLLOWUP A — the same abbreviating figure the discovery tiles
				    render (`MarketTotalDharma`), because this IS that card: the locked
				    §3.2 composition, whose third element must be identical everywhere.
				    A total that reads `Đ 34.4k` on Discovery and `Đ 34,365` here would
				    be the same defect entry 4 closed for the thumbnail, in the other
				    field of the same row. */}
				<span>
					Đ <MarketTotalDharma value={totals.dharmaStaked} /> staked
				</span>
				<span>
					{totals.postCount} {noun(totals.postCount, "post", "posts")}
				</span>
				<span>
					{totals.replyCount} {noun(totals.replyCount, "reply", "replies")}
				</span>
			</span>

			{/* ⚠⚠ UI-FOLLOWUP B — THE CARD SAYS WHAT IT DOES. Row 17 built the exit
			    and gave it no label: the only cue that this card was clickable was
			    the cursor, which is nothing at all on a touch device and nothing on
			    a first read anywhere. The accessible name has always said "Back to
			    the market" — this is that sentence made visible, which is the half
			    a sighted reader was missing.
			    ⚠ `mt-auto` PINS IT TO THE FLOOR, and that is what makes this line
			    the reason the card is allowed to stretch at all: the free height
			    the rail reclaims collects ABOVE this line rather than below the
			    stat line, so a tall rail reads as a card with its footer at the
			    bottom instead of a card with a hole under it. Same `mt-auto`
			    `PostFocusHeader` uses to pin its own split bar, for the same reason.
			    ⚠ THE GLYPH IS THE PLAIN `↩` (U+21A9) — no icon package, no SVG. The
			    tree ships Lucide, but a one-character mark inside a text line is
			    text, and giving it a component would put a sized, coloured, stroked
			    element on a baseline that the surrounding muted type already sets.
			    ⚠ IT INHERITS THE STAT LINE'S TIER (`text-xs text-muted-foreground`,
			    the sibling above) rather than declaring its own: it is chrome about
			    the card, not a field of the market, and it must not compete with the
			    figures it sits under. */}
			<span
				className={`mt-auto ${compact ? "text-[10px]" : "text-xs"} text-muted-foreground`}
			>
				↩ Click to return to market page
			</span>
		</Link>
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
