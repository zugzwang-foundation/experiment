"use client";

import { Button } from "@/components/ui/button";
import { formatPricePercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import {
	HEADER_CONTROL,
	HEADER_WORD,
	HeaderLanes,
	HeaderNoPosition,
	HeaderSell,
	ToWinLine,
} from "./column-header";
import { c3OppositeSide } from "./copy";
import { isEntryDisabled } from "./gating";

/**
 * The market-view column header — FEED-3's three lanes (`column-header.tsx`):
 * Bet left · the side and its price centred · Sell right, on the held side only.
 *
 * ⚠⚠ FEED-3 SUPERSEDES THE BAND THIS DOCBLOCK DESCRIBED, AND THE PARTS THAT ARE
 * NOW FALSE ARE CORRECTED HERE RATHER THAN LEFT ABOVE AN AMENDMENT (O-5):
 *   · the header is no longer a bordered, elevated band — it is the first row of
 *     the column's one rectangle, and `DebateColumn` draws the hairline under it;
 *   · the entry reads `BET YES` / `BET NO` (it read `Buy`, HTML-FINISH row 20)
 *     and carries today's to-win figure as its second line — `Đ 1 → Đ 8.77`, no
 *     `TO WIN` label, no trailing `x`;
 *   · Sell reads `SELL` over the position figure, and `YOUR POSITION` is gone.
 *     With no position the right lane reads `NO ACTIVE POSITION`, main's
 *     one-line label, flush right (UIR-1 item 2 — FEED-3 had left it empty;
 *     UIR-3 item 2 — one line again).
 * ⚠ The composer's own `COMPOSER_COPY.header` / `.submit` say `Đ BET`, so the
 * header and the composer it opens agree on the verb again.
 *
 * The entry is LIVE for everyone: signed-out opens the auth-gate slot variant;
 * the F-3 predicate disables the opposite pole for a holder (RESULTING side ≠
 * held side — the tooltip and the accessible name carry the C3 batch string); a
 * non-Open market renders the W2.8 disabled treatment (INV-4).
 */
export function SlotHeader({
	side,
	pricing,
	unitToWin,
	viewer,
	marketOpen,
	suspended,
	composerOpen,
	onToggleEntry,
	ownPseudonym,
	slug,
	showControls = true,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	unitToWin: { yes: string; no: string } | null;
	viewer: ViewerMarketContext | null;
	marketOpen: boolean;
	/** P2 terminal (Track A / banned): all entry controls disabled for the session render. */
	suspended: boolean;
	composerOpen: boolean;
	onToggleEntry: () => void;
	/** W2.10-C — the viewer's own pseudonym (null = signed-out → no link). */
	ownPseudonym: string | null;
	/** The market slug — the `/u/<own>?market=<slug>` preselect (OQ-5 B). */
	slug: string;
	/**
	 * ⚠⚠ change set 12 §1 — FALSE ON THE COLUMN THAT IS HOSTING A COMPOSER.
	 * Founder ruling: the mirrored header keeps the composing side's label and
	 * percent, and loses its Bet and its Sell.
	 * ⚠ FEED-3 — the ruling also kept the odds and the position readout, and
	 * both now live INSIDE the two controls (their second lines), so they leave
	 * with them: the hosting header is the side being bet and nothing else. The
	 * composer below it shows its own to-win.
	 * ⛔ SCOPED TO THE HOSTING STATE, NEVER PERSISTENT. It is derived per render
	 * from `openSide`/`openReply`, so closing the composer restores the controls
	 * with no reset step to forget.
	 * ⛔ THE REAL HEADER IS UNTOUCHED — the column whose own side IS the
	 * composing side keeps both. Its Bet is the toggle-closed affordance, and
	 * removing it would leave the × as the only way out.
	 */
	showControls?: boolean;
}) {
	const pct = pricing ? formatPricePercent(pricing, side) : "—";
	const unit = unitToWin ? unitToWin[side === "YES" ? "yes" : "no"] : null;
	const heldSide = viewer?.position?.side ?? null;
	const oppositeHeld = isEntryDisabled({ resultingSide: side, heldSide });
	const entryDisabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: side })
			: null;

	return (
		<HeaderLanes
			side={side}
			pct={pct}
			action={
				showControls ? (
					<Button
						variant="outline"
						disabled={entryDisabled}
						aria-disabled={entryDisabled}
						aria-expanded={composerOpen}
						// The shipped naming pattern with the ratified verb: the name is
						// the visible word (`Bet YES`, WCAG 2.5.3), or the C3 refusal.
						aria-label={c3 ?? `Bet ${side}`}
						title={c3 ?? undefined}
						onClick={onToggleEntry}
						className={HEADER_CONTROL}
					>
						<span className={HEADER_WORD}>Bet {side}</span>
						<ToWinLine unit={unit} />
					</Button>
				) : null
			}
			sell={
				// The Sell gate is the shipped one — `side` is the pole this header
				// speaks for — and it is only reached when this header is not hosting.
				// The hosting header keeps its empty lane (change set 12 §1).
				!showControls ? null : viewer?.position &&
					viewer.position.side === side ? (
					<HeaderSell
						value={viewer.position.currentValue}
						ownPseudonym={ownPseudonym}
						slug={slug}
					/>
				) : (
					<HeaderNoPosition />
				)
			}
		/>
	);
}
