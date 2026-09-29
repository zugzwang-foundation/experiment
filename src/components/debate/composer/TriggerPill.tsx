"use client";

import { buttonVariants } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

import type { Side } from "../types";
import {
	BET_TONE,
	BET_TONE_TEXT,
	HEADER_CONTROL,
	HEADER_WORD,
	ToWinLine,
} from "./column-header";
import { c3OppositeSide, OWN_POST_COPY } from "./copy";
import { deriveReplySide, isEntryDisabled } from "./gating";

/**
 * One Support/Counter trigger — the focused post's reply entry.
 *
 * ⚠⚠ FEED-3 MOVED IT, IT DID NOT REWRITE IT. It lived file-private in
 * `ReplySplitBar` as the bar's two pills; it now sits in the left lane of the
 * post arm's column headers (Support on the post's side, Counter on the other),
 * and the bar is a display. EVERY RULE BELOW IS THE ONE IT SHIPPED WITH — the
 * resulting side, the F-3 gate, the own-post refusal and its precedence over C3,
 * market-open, suspension, toggle-to-close, the accessible name and the gloss.
 * Only the shell changed: it takes the market header's lifted control
 * (`HEADER_CONTROL`) and, as its second line, the to-win of the side the reply
 * LANDS on — computed from the same `resultingSide` that gates it, so the figure
 * and the gate cannot describe two different bets.
 *
 * ⚠ THE POLE FILL IS GONE WITH THE PILL. It was coded by the resulting side
 * (never by the relation), and the header now says the side in its centre lane,
 * beside the thumb, exactly as the market header's Bet does. `aria-expanded`
 * drives the shipped open fill in place of the old `ring-2`.
 */
export function TriggerPill({
	relation,
	postSide,
	heldSide,
	marketOpen,
	suspended,
	active,
	onToggle,
	isOwnPost,
	unitToWin,
}: {
	relation: "support" | "counter";
	postSide: Side;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	active: boolean;
	onToggle: (relation: "support" | "counter") => void;
	isOwnPost: boolean;
	/** FEED-3 — the market's per-side `Đ 1 → Đ x`; the line shows the RESULTING side's. */
	unitToWin: { yes: string; no: string } | null;
}) {
	const resultingSide = deriveReplySide({ parentSide: postSide, relation });
	const oppositeHeld = isEntryDisabled({ resultingSide, heldSide });
	const disabled = !marketOpen || suspended || oppositeHeld || isOwnPost;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: resultingSide })
			: null;
	// D-52 R1 — the own-post refusal takes C3's slot and wins over it: on the
	// viewer's own post both triggers are foreclosed, whatever is held.
	const refusal = isOwnPost ? OWN_POST_COPY : c3;
	// C3 precedence (INFO-1 §3.4): a viewer blocked by the single-side rule is
	// told why they are blocked, not given the relation's definition. The
	// glossary gloss fills the null branch only — c3 still wins outright.
	const gloss =
		refusal ?? (relation === "support" ? GLOSSARY.support : GLOSSARY.counter);
	return (
		<InfoTip content={gloss} asChild>
			<button
				type="button"
				disabled={disabled}
				aria-disabled={disabled}
				aria-expanded={active}
				aria-label={
					refusal ??
					`${relation === "support" ? "Support" : "Counter"} — bet ${resultingSide}`
				}
				onClick={() => onToggle(relation)}
				className={cn(
					buttonVariants({ variant: "outline" }),
					HEADER_CONTROL,
					BET_TONE_TEXT,
					BET_TONE[resultingSide],
				)}
			>
				<span className={HEADER_WORD}>
					{relation === "support" ? "Support" : "Counter"}
				</span>
				<ToWinLine
					unit={
						unitToWin === null
							? null
							: unitToWin[resultingSide === "YES" ? "yes" : "no"]
					}
				/>
			</button>
		</InfoTip>
	);
}
