import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import { cn } from "@/lib/utils";
import { formatDharma } from "../format";
import type { Side } from "../types";
import { COMPOSER_COPY, formatMultiplier } from "./copy";

/**
 * FEED-3 — THE COLUMN HEADER BOTH ARMS SHARE. The market arm (`SlotHeader`) and
 * the post arm (`PositionStrip`) render the SAME three lanes, so they are built
 * from the same pieces here rather than from two copies that agree today:
 *
 *   `minmax(0,1fr)` · `auto` · `minmax(0,1fr)` — the action (Bet, or the
 *   Support/Counter trigger) left · the side and its price centred · Sell right,
 *   and only on the side the viewer holds. ONE order in both columns; the NO
 *   column is not mirrored.
 *
 * ⚠ THE HEADER IS THE CARD'S FIRST ROW, NOT A BOX OF ITS OWN. `DebateColumn`
 * draws the one rectangle and the hairline under this row, so nothing here
 * carries a border, a radius or an elevation.
 *
 * ⛔ THREE REGIMES, RULED (FEED-3 N-2):
 *   · ≥1024px — the full header, one row.
 *   · 860–1023px — one row, with the two steps kept as first ruled: "if the
 *     header can't fit", the price steps to 20px, then the buttons to 8px padding.
 *   · <860px — the header STACKS: the price centred on its own row, the action
 *     left and Sell right on a row beneath it, at full size.
 * ⚠ THE STEPS ARE CONTAINER QUERIES, BECAUSE "IF IT CAN'T FIT" IS ABOUT THE
 * HEADER'S OWN WIDTH, NOT THE WINDOW'S — a breakpoint would step a header that
 * still fits. Thresholds are the measured worst case (Geist, live staging,
 * 2026-09-28) against this container's content box (column interior − `px-3`):
 *   · unstepped needs 2 × 125 (buttons) + 140 (`Yes 100%` at 26px) + 2 × 8 = 406
 *     → below that the price steps to 20px (`Yes 100%` = 114);
 *   · 2 × 125 + 114 + 16 = 380 → below that the buttons step to 8px (113px);
 *   · 2 × 113 + 114 + 16 = 356 — which an 860px window (container 368) clears.
 * ⛔ THE HEADER IS A SIZE CONTAINER ONLY FROM 860px, AND THAT IS WHAT SCOPES THE
 * STEPS TO THEIR RANGE. Below 860 there is no `colhead` container, so no step
 * query can match, and the stack keeps full sizes — it needs none of them: at the
 * 640px floor the container is 258px and the button row is exactly
 * 125 + 8 + 125 = 258.
 * ⚠ The stack is a VIEWPORT rule (`max-[860px]:`), because that is how it was
 * ruled; `max-[860px]:` and `min-[860px]:` are `width < 860` / `width >= 860`, so
 * the two regimes meet without a gap or an overlap.
 */
const LANES =
	"grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 max-[860px]:grid-cols-2";

/**
 * Each side lane holds one control and keeps the control's full height when it
 * is empty — 7 + 18 + 13.2 + 7 padding/lines + 2 border + 4 reserve = 51.2px —
 * so a hosting column's header, whose lanes are empty, is exactly as tall as its
 * neighbour's and the two hairlines stay level. In the stack the lanes are the
 * second row.
 */
const LANE = "flex min-h-[51.2px] items-center";

/**
 * The lifted header control. Applied over `buttonVariants({ variant: "outline" })`
 * so the fill, hairline, hover fill and the open (`aria-expanded`) fill are the
 * shipped button's, and only the geometry and the lift are this header's.
 *
 * ⚠ ONE SHARED WIDTH for Bet, Sell, Support and Counter, fitted to the widest line
 * either page renders: a 13-character to-win figure in 11px Geist Mono
 * (`Đ 1 → Đ 12.34`, 94.0px measured) — wider than the widest word (`COUNTER`,
 * 77.97px). 95 content + 2 × 14 padding + 2 border = 125; at the 8px step, 113.
 *
 * ⚠ THE LEDGE IS A SHADOW, SO IT MOVES NOTHING: rest `0 3px 0` n2, hover lifts
 * 1px onto a 4px ledge, pressed sinks 2px onto a 1px ledge — the ledge's bottom
 * edge stays put in all three, like a key. `mb-1` is the reserved 4px it paints
 * into. Disabled keeps the shipped look (opacity, no pointer) and loses the ledge.
 * ⛔ `active:not-aria-[haspopup]:` rather than `active:`, because the base variant
 * already carries `active:not-aria-[haspopup]:translate-y-px` and only the SAME
 * variant chain is merged away by `cn`; a bare `active:` would lose to it on
 * specificity and press 1px instead of 2.
 * ⚠ The focus ring is composed WITH the ledge, not instead of it, so a keyboard
 * reader does not see the control go flat when it takes focus.
 */
export const HEADER_CONTROL =
	"mb-1 h-auto w-[125px] flex-col gap-0 px-3.5 py-[7px] @max-[380px]/colhead:w-[113px] @max-[380px]/colhead:px-2 shadow-[0_3px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] hover:-translate-y-px hover:shadow-[0_4px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] active:not-aria-[haspopup]:translate-y-0.5 active:shadow-[0_1px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] focus-visible:shadow-[var(--state-focus-ring),0_3px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] disabled:translate-y-0 disabled:shadow-none";

/**
 * The control's first line — 15px / 600, with the shipped `.tradebtn` case and
 * tracking (uppercase, 0.06em). ⚠ The leading is stated because the size is
 * arbitrary (AGENTS.md §8): 1.2 is the CSS `normal` a mockup that leaves it unset
 * is drawn at, and 15 × 1.2 = 18px exactly.
 */
export const HEADER_WORD =
	"text-[15px] leading-[1.2] font-semibold tracking-[0.06em] uppercase";

/**
 * The control's second line — 11px / 400, muted. ⚠ STILL MONO: it is today's
 * to-win / position figure moved into the button, and the ruling restates its
 * size, weight and colour but not its family.
 */
export const HEADER_DETAIL =
	"font-mono text-[11px] leading-[1.2] font-normal tracking-normal normal-case text-muted-foreground";

/**
 * `Đ 1 → Đ 8.77` — today's to-win figure without its `TO WIN` label and without
 * `formatMultiplier`'s trailing `x`. ⚠ The label stays for a screen reader
 * (`sr-only`): the visible label was removed for the layout, not because the
 * figure stopped needing one, and `→` is decorative.
 */
export function ToWinLine({ unit }: { unit: string | null }) {
	return (
		<span className={HEADER_DETAIL}>
			<span className="sr-only">{COMPOSER_COPY.toWinLabel} </span>Đ 1{" "}
			<span aria-hidden="true">→</span> Đ{" "}
			{unit === null ? "—" : formatMultiplier(unit).replace(/x$/, "")}
		</span>
	);
}

export function HeaderLanes({
	action,
	side,
	pct,
	sell,
}: {
	/** The left lane. `null` leaves it empty — the hosting column's header. */
	action: ReactNode;
	/** The pole the header speaks for (the composing side while a composer is open). */
	side: Side;
	pct: string;
	/** The right lane. `null` when the viewer holds nothing on this side. */
	sell: ReactNode;
}) {
	return (
		// `min-[860px]:@container/colhead` — from 860px the header measures ITSELF
		// for the two steps; below it there is no container to measure (see the
		// regimes above). `px-3` lines its lanes up with the card body below.
		<div className="px-3 py-2 min-[860px]:@container/colhead">
			<div className={LANES}>
				<div
					className={`${LANE} justify-self-start max-[860px]:col-start-1 max-[860px]:row-start-2`}
				>
					{action}
				</div>
				{/* Today's price cluster at 26px — word 600, percent 800, the 16px thumb
				    and 5px gaps unchanged — stepping to 20px when the header can't fit,
				    and taking a row of its own, centred, below 860px. */}
				<span className="flex items-center gap-[5px] text-[26px] leading-[1.2] font-semibold whitespace-nowrap text-ink @max-[406px]/colhead:text-[20px] max-[860px]:col-span-2 max-[860px]:row-start-1 max-[860px]:justify-self-center">
					{side === "YES" ? "Yes" : "No"}
					<ThumbGlyph side={side} />
					<b className="font-extrabold">{pct}</b>
				</span>
				<div
					className={`${LANE} justify-self-end max-[860px]:col-start-2 max-[860px]:row-start-2`}
				>
					{sell}
				</div>
			</div>
		</div>
	);
}

/**
 * Sell — `SELL` over the viewer's position figure. ⛔⛔ STILL AN ANCHOR: the W2.10-C
 * click-through to the viewer's own profile with this market preselected (OQ-5 B)
 * is the whole control, and `buttonVariants` supplies only its shape. Signed out
 * there is nobody to link to, so the same words render non-interactive.
 */
export function HeaderSell({
	value,
	ownPseudonym,
	slug,
}: {
	value: string;
	ownPseudonym: string | null;
	slug: string;
}) {
	const body = (
		<>
			<span className={HEADER_WORD}>{COMPOSER_COPY.sell}</span>
			<span className={HEADER_DETAIL}>
				<span className="sr-only">{COMPOSER_COPY.yourPositionLabel} </span>Đ{" "}
				{formatDharma(value)}
			</span>
		</>
	);
	return ownPseudonym !== null ? (
		<Link
			data-testid="w210c-sell-link"
			href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
			// POLL-IDLE 1b — no prefetch: every DebatePoll refresh invalidates the
			// prefetch cache and re-prefetches every visible link (Next 16.3.2
			// `pingVisibleLinks`), so this link cost a request per tick, per viewer.
			prefetch={false}
			className={cn(buttonVariants({ variant: "outline" }), HEADER_CONTROL)}
		>
			{body}
		</Link>
	) : (
		<span
			aria-disabled="true"
			className={cn(
				buttonVariants({ variant: "outline" }),
				HEADER_CONTROL,
				"cursor-default opacity-(--state-disabled-opacity) shadow-none select-none hover:translate-y-0 hover:shadow-none",
			)}
		>
			{body}
		</span>
	);
}
