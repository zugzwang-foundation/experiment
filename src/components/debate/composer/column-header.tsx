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
 *     header can't fit", the price steps to 16px, then the buttons to 6px padding.
 *   · <860px — the header STACKS: the price centred on its own row, the action
 *     left and Sell right on a row beneath it, at full size.
 * ⚠ UIR-3 item 1 — EVERY SIZE IN THE ROW IS FEED-3's × 0.8, rounded to whole
 * pixels, in all three regimes: buttons 100px (90px stepped), padding 11px × 6px
 * (6px stepped), first line 12px, price 21px (16px stepped), thumb 13px. The
 * second line is 10px, its ruled floor, not 8.8. The lift is unchanged.
 * ⚠ THE STEPS ARE CONTAINER QUERIES, BECAUSE "IF IT CAN'T FIT" IS ABOUT THE
 * HEADER'S OWN WIDTH, NOT THE WINDOW'S — a breakpoint would step a header that
 * still fits. Thresholds are the measured worst case (Geist, live staging,
 * 2026-09-28) against this container's content box (column interior − `px-3`),
 * for the header at its FEED-3 sizes:
 *   · unstepped needs 2 × 125 (buttons) + 140 (`Yes 100%` at 26px) + 2 × 8 = 406
 *     → below that the price steps (`Yes 100%` = 114 at 20px);
 *   · 2 × 125 + 114 + 16 = 380 → below that the buttons step (113px);
 *   · 2 × 113 + 114 + 16 = 356 — which an 860px window (container 368) clears.
 * ⚠ UIR-3 KEEPS THE THRESHOLDS WHERE THEY WERE, because the ruling is "× 0.8 at
 * every window width": each step still starts at the window width it did, and
 * every size on either side of it is 0.8 × the size it had there. The scaled
 * header needs only 2 × 100 + 112 + 16 = 328, so it now steps with room to spare.
 * ⛔ THE HEADER IS A SIZE CONTAINER ONLY FROM 860px, AND THAT IS WHAT SCOPES THE
 * STEPS TO THEIR RANGE. Below 860 there is no `colhead` container, so no step
 * query can match, and the stack keeps full sizes — it needs none of them: at the
 * 640px floor the container is 258px and the button row is 100 + 8 + 100 = 208.
 * ⚠ The stack is a VIEWPORT rule (`max-[860px]:`), because that is how it was
 * ruled; `max-[860px]:` and `min-[860px]:` are `width < 860` / `width >= 860`, so
 * the two regimes meet without a gap or an overlap.
 */
const LANES =
	"grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 max-[860px]:grid-cols-2";

/**
 * Each side lane holds one control and keeps the control's full height when it
 * is empty — 6 + 14.4 + 12 + 6 padding/lines + 2 border + 4 reserve = 44.4px —
 * so a hosting column's header, whose lanes are empty, is exactly as tall as its
 * neighbour's and the two hairlines stay level. In the stack the lanes are the
 * second row.
 */
const LANE = "flex min-h-[44.4px] items-center";

/**
 * The lifted header control. Applied over `buttonVariants({ variant: "outline" })`
 * so the fill, hairline, hover fill and the open (`aria-expanded`) fill are the
 * shipped button's, and only the geometry and the lift are this header's.
 *
 * ⚠ ONE SHARED WIDTH for Bet, Sell, Support and Counter. FEED-3 fitted it to the
 * widest line either page renders — a 13-character to-win figure in 11px Geist
 * Mono (`Đ 1 → Đ 12.34`, 94.0px measured), wider than the widest word
 * (`COUNTER`, 77.97px): 95 content + 2 × 14 padding + 2 border = 125; at the 8px
 * step, 113. UIR-3 item 1 scales all of it by 0.8: 100 (76 content + 2 × 11 +
 * 2), and 90 at the 6px step. ⚠ The second line's 10px floor keeps that widest
 * figure at ~85.5px, so it runs ~5px into each side's padding; it stays inside
 * the border.
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
	"mb-1 h-auto w-[100px] flex-col gap-0 px-[11px] py-[6px] @max-[380px]/colhead:w-[90px] @max-[380px]/colhead:px-1.5 shadow-[0_3px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] hover:-translate-y-px hover:shadow-[0_4px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] active:not-aria-[haspopup]:translate-y-0.5 active:shadow-[0_1px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] focus-visible:shadow-[var(--state-focus-ring),0_3px_0_var(--color-n2),inset_0_1px_0_rgb(255_255_255/0.08)] disabled:translate-y-0 disabled:shadow-none";

/**
 * The control's first line — 12px / 600 (UIR-3 item 1: FEED-3's 15px × 0.8),
 * with the shipped `.tradebtn` case and tracking (uppercase, 0.06em). ⚠ The
 * leading is stated because the size is arbitrary (AGENTS.md §8): 1.2 is the CSS
 * `normal` a mockup that leaves it unset is drawn at, and 12 × 1.2 = 14.4px.
 */
/**
 * The colour of the Support / Counter triggers, keyed by the side the reply
 * bet LANDS on (its resulting side, never its relation). `Bet YES` / `Bet NO`
 * keep the plain header-control look. A soft tint with coloured text at
 * rest; the solid colour on hover, press and while its composer is open.
 */
export const BET_TONE: Record<Side, string> = {
	YES: "bg-bet-yes-soft text-bet-yes hover:bg-bet-yes active:bg-bet-yes aria-expanded:bg-bet-yes",
	NO: "bg-bet-no-soft text-bet-no hover:bg-bet-no active:bg-bet-no aria-expanded:bg-bet-no",
};

/** Goes with `BET_TONE`: white text on the solid fill. Only the word line
 * follows the control; the Đ line under it keeps `HEADER_DETAIL`'s gold. */
export const BET_TONE_TEXT =
	"hover:text-ink active:text-ink aria-expanded:text-ink [&>span:first-child]:text-inherit";

export const HEADER_WORD =
	"text-[12px] leading-[1.2] font-semibold tracking-[0.06em] uppercase";

/**
 * The control's second line — 10px / 400, muted (UIR-3 item 1: FEED-3's 11px ×
 * 0.8 is 8.8, and this line is ruled never to go below 10px). ⚠ STILL MONO: it
 * is today's to-win / position figure moved into the button, and the ruling
 * restates its size, weight and colour but not its family.
 */
export const HEADER_DETAIL =
	"font-mono text-[10px] leading-[1.2] font-normal tracking-normal normal-case text-gold";

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
	/**
	 * The right lane: Sell on the held side, `HeaderNoPosition` elsewhere, `null`
	 * on the hosting column.
	 */
	sell: ReactNode;
}) {
	return (
		// `min-[860px]:@container/colhead` — from 860px the header measures ITSELF
		// for the two steps; below it there is no container to measure (see the
		// regimes above). `px-3` lines its lanes up with the card body below.
		// ⚠ UIR-3 item 1 — `py-1`, not `py-2`: scaled, the row was 8 + 44.4 + 8 +
		// the 1px hairline = 61.4px, against 53.5px for main's (7314ab4c) market-page
		// column-header box, measured. The ruled lever is this padding, never the
		// type: 4px each way makes the row 53.4px.
		<div className="px-3 py-1 min-[860px]:@container/colhead">
			<div className={LANES}>
				<div
					className={`${LANE} justify-self-start max-[860px]:col-start-1 max-[860px]:row-start-2`}
				>
					{action}
				</div>
				{/* The price cluster at FEED-3's sizes × 0.8 (UIR-3 item 1) — 21px, word
				    600, percent 800, a 13px thumb and 4px gaps — stepping to 16px when
				    the header can't fit, and taking a row of its own, centred, below
				    860px. */}
				<span className="flex items-center gap-1 text-[21px] leading-[1.2] font-semibold whitespace-nowrap text-ink @max-[406px]/colhead:text-[16px] max-[860px]:col-span-2 max-[860px]:row-start-1 max-[860px]:justify-self-center">
					{side === "YES" ? "Yes" : "No"}
					<ThumbGlyph side={side} size={13} />
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
 * UIR-1 item 2 — `NO ACTIVE POSITION`, the right lane when the viewer holds
 * nothing on this side and the header is not hosting a composer. Plain text: no
 * border, fill, ledge or handler.
 * ⚠ UIR-3 item 2 — BACK TO `main`'s ONE-LINER; UIR-2 item 1's two-line 14px
 * block is withdrawn. The label is main's (7314ab4c) exactly: Geist (inherited),
 * 10px / 700, 0.1em, uppercase, `n4`, on main's 13.33px line (the `text-xs`
 * ratio main's parent gave it). Flush right on the header row's right inset —
 * the lane is `justify-self-end` and the text right-aligned — and centred on
 * the row by the lane's `items-center`.
 * ⚠ IT NEVER COMES WITHIN 12px OF THE PRICE. The grid gap gives 8px, and `pl-1`
 * makes the label's box 4px wider than its line, so a lane too narrow for both
 * shrinks the box below the line and the line wraps — at one place only, since
 * the first space is non-breaking: `NO ACTIVE` / `POSITION`, still flush right.
 * From 860px only: below it the price has a row of its own.
 * ⚠ Read once. FEED-3 had removed the words rather than hiding them, so there
 * is no `sr-only` copy to reconcile with.
 */
export function HeaderNoPosition() {
	// The shipped string with its first space non-breaking, so the one break
	// left falls before `position`.
	const words = COMPOSER_COPY.noPosition.replace(" ", " ");
	return (
		<span className="text-right text-[10px] leading-[calc(1/0.75)] font-bold tracking-[0.1em] text-n4 uppercase min-[860px]:pl-1">
			{words}
		</span>
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
