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
 * ⛔ THE TWO NARROW-WIDTH STEPS ARE CONTAINER QUERIES, BECAUSE THE RULING IS "IF
 * THE HEADER CAN'T FIT", NOT "BELOW A VIEWPORT WIDTH". The header knows its own
 * width; a breakpoint would only know the window's, and would step a header that
 * still fits. The thresholds are the measured worst case (Geist, live staging,
 * 2026-09-28), against this container's content box (the column interior minus
 * `px-3`):
 *   · unstepped needs 2 × 125 (buttons) + 140 (`Yes 100%` at 26px) + 2 × 8 = 406
 *     → below that the centre price steps to 20px (`Yes 100%` = 114);
 *   · 2 × 125 + 114 + 16 = 380 → below that the buttons step to 8px padding
 *     (113px each);
 *   · 2 × 113 + 114 + 16 = 356 is the narrowest header that fits at all.
 * ⚠ AT A 640px VIEWPORT THE CONTAINER IS 258px, SO THE HEADER DOES NOT FIT THERE
 * AFTER BOTH STEPS. That is reported, not absorbed: no third step was ruled.
 */
const LANES =
	"grid min-h-[51.2px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2";

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
		// `@container/colhead` — the header measures ITSELF for the two steps; see
		// the thresholds above. `px-3` lines its lanes up with the card body below.
		<div className="@container/colhead px-3 py-2">
			<div className={LANES}>
				<div className="flex justify-self-start">{action}</div>
				{/* Today's price cluster at 26px — word 600, percent 800, the 16px thumb
				    and 5px gaps unchanged — stepping to 20px when the header can't fit. */}
				<span className="flex items-center gap-[5px] text-[26px] leading-[1.2] font-semibold whitespace-nowrap text-ink @max-[406px]/colhead:text-[20px]">
					{side === "YES" ? "Yes" : "No"}
					<ThumbGlyph side={side} />
					<b className="font-extrabold">{pct}</b>
				</span>
				<div className="flex justify-self-end">{sell}</div>
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
