"use client";

import type { ReactNode } from "react";

import { formatPricePercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import { HeaderLanes, HeaderNoPosition, HeaderSell } from "./column-header";

/**
 * The post-view (reply page) column header.
 *
 * ⚠⚠ FEED-3 — IT TAKES THE MARKET PAGE'S HEADER. It was the ruling-1 position
 * strip, "the market grammar MINUS action buttons" (`TO WIN Đ1 → Đx` · price ·
 * `YOUR POSITION` / `NO ACTIVE POSITION`); it is now the same three lanes
 * `SlotHeader` renders (`column-header.tsx`), with the reply entry in the left
 * lane where the market page has Bet:
 *   · `action` — the moved `TriggerPill`: Support in the column of the post's
 *     side, Counter in the other (a NO post flips them), its second line the
 *     to-win of the side the reply lands on. The caller builds it, because the
 *     caller holds the relation state and its handler;
 *   · centre — the side and its price;
 *   · Sell — `SELL` over the position figure, only on the side the viewer holds;
 *     elsewhere `NO ACTIVE POSITION`, main's one-line label, flush right
 *     (UIR-1 item 2; one line again at UIR-3 item 2).
 * The `TO WIN` and `YOUR POSITION` labels are gone, as on the market page.
 *
 * ⛔ THE HOSTING COLUMN SHOWS THE SIDE BEING BET AND NOTHING ELSE — change set
 * 12 §1, the market page's ruling, now that this header has controls to lose.
 * RPLY-1 · R4b removed `showControls` from this strip because it then had no
 * Buy and no Sell to suppress; FEED-3 gives it both, so the hosting state hides
 * them again, keyed off `composingSide` (set only on the hosting column).
 * ⚠ R4b's arithmetic still holds and is why Sell never needed the gate in
 * practice: F-3 only opens a relation whose resulting side IS the held side, and
 * the hosting column is the pole OPPOSITE the bet, so it is never the held one.
 */
export function PositionStrip({
	side,
	composingSide = null,
	pricing,
	viewer,
	ownPseudonym,
	slug,
	action,
}: {
	side: Side;
	/**
	 * RPLY-2 · R2 — set by the caller ONLY on the column hosting an open composer,
	 * to the bet's own resulting side; `null` everywhere else.
	 *
	 * ⚠ THE GOVERNING RULE IS `design-canon.md` §2's **composer-open exception**:
	 * "when a composer opens, the headers must be the same as the side bet being
	 * taken." The label and percent follow the side being bet; the position
	 * readout is excluded from the mirroring because it is a fact about the
	 * viewer's holding on THIS column's true pole, and mirroring it prints a
	 * falsehood.
	 */
	composingSide?: Side | null;
	pricing: { yes: string; no: string } | null;
	viewer: ViewerMarketContext | null;
	/** W2.10-C — the viewer's own pseudonym (null = signed-out → no link). */
	ownPseudonym: string | null;
	/** The market slug — the `/u/<own>?market=<slug>` preselect (OQ-5 B). */
	slug: string;
	/** FEED-3 — the left lane: the moved Support/Counter trigger. Omitted = empty. */
	action?: ReactNode;
}) {
	const displaySide = composingSide ?? side;
	const pct = pricing ? formatPricePercent(pricing, displaySide) : "—";
	const hosting = composingSide !== null;
	// ⛔ NOT `displaySide`. The position readout is a fact about the VIEWER'S OWN
	// holding on THIS column's true pole — see `composingSide`.
	const held = viewer?.position && viewer.position.side === side;
	return (
		<HeaderLanes
			side={displaySide}
			pct={pct}
			action={hosting ? null : (action ?? null)}
			sell={
				hosting ? null : held && viewer?.position ? (
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
