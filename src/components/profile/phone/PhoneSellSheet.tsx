"use client";

import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";
import { Button } from "@/components/ui/button";

import { InlineSellAmount } from "../InlineSell";

/**
 * MOBILE-2e · R-P3 / ADR-0051 A4 D-2 — WHERE THE PHONE SELLS.
 *
 * Sell is the one comment-free action this product has, and on the desktop it
 * happens IN the position row: the value cell becomes an amount field and the
 * trailing cell becomes `Confirm ✕`. That works because the desktop row is
 * 104px of trailing column wide. The phone row is the same four columns inside
 * ~278px, and an editable figure plus two controls does not fit in the 64px the
 * value column has there — it would either overflow the row or shrink `Confirm`
 * below a target a finger can hit.
 *
 * So the phone takes the sheet it already has. This is the same `PhoneSheet`
 * the bet composer opens on `/m/[slug]`, which is the point rather than a
 * convenience: a phone reader who has placed one bet has already learned this
 * shell — the handle, the backdrop, the way it refuses to close mid-request.
 *
 * ⛔⛔ THREE THINGS MAKE THIS WORK WITHOUT EDITING `InlineSell.tsx`, AND ALL
 * THREE ARE LOAD-BEARING.
 *
 * **1 · It is mounted INSIDE the armed row's `<td>`.** `useInlineSell` arms a
 * document-level `pointerdown` listener whose predicate is
 * `armedRowRef.current?.contains(event.target)` — and `armedRowRef` is the
 * `<tr>`. A sheet rendered anywhere else in the tree is not contained by that
 * row, so the FIRST tap inside it — including the tap on `Confirm` — cancels
 * the arm and closes the sheet. Rendering it inside the cell is valid HTML and
 * `position: fixed` lifts it out of the cell visually, so the DOM position
 * costs nothing and buys the containment. ⚠ It also means a tap on the
 * BACKDROP does not cancel the arm by that route; it closes the sheet through
 * `onClose`, which cancels deliberately.
 *
 * **2 · The host gates it on the tier**, so this component does not exist at or
 * above 640px, or in jsdom. That is what keeps the desktop render byte-identical
 * and leaves all forty-three shipped sell tests observing the unchanged in-row
 * arm — they never see this file.
 *
 * **3 · `busy` is wired straight through.** `PhoneSheet` already takes
 * `busy: boolean` and shuts every door on it: `beginClose` returns early, the
 * deferred close re-checks and ABORTS rather than committing, the drag handle
 * stands down, Escape is ignored and the `×` is disabled. `sell.busy` is that
 * value, so a sell in flight cannot be dismissed out from under itself and no
 * new mechanism was invented for a hazard that already had one.
 *
 * ⚠ **This leaf holds no write path** (ADR-0051 A4 D-2). It renders a field and
 * two buttons and calls the callbacks it is handed; the `fetch`, the
 * idempotency key and the unsettled-key law all stay in `useInlineSell`, one
 * directory up, where the desktop's own Confirm reaches them too. There is
 * exactly one controller per table, and this is a second set of controls on it
 * — never a second controller.
 */
export function PhoneSellSheet(props: {
	/** The sell controller's own key for this tile — the Sold dwell is keyed on it. */
	tileKey: string;
	/** The ROUNDED figure the field shows (`tile.valueDisplay`). */
	seedDisplay: string;
	/**
	 * The EXACT figure an untouched field submits. ⛔ Not the displayed one:
	 * submitting the rounded figure strands unsellable dust, which
	 * `sell.test.tsx`'s own control test exists to prove.
	 */
	seedExact: string;
	/** The argument's own title, so the sheet says what is being sold. */
	argumentTitle: string;
	/** The market it sits in. */
	marketTitle: string;
	draft: string | null;
	busy: boolean;
	failed: boolean;
	canSubmit: boolean;
	onEdit: (value: string, seedExact: string) => void;
	onSubmit: () => void;
	onClose: () => void;
}) {
	return (
		<PhoneSheet open title="Sell" busy={props.busy} onClose={props.onClose}>
			<div className="flex flex-col gap-3 pt-1 pb-2">
				{/* ⚠ WHAT IS BEING SOLD, IN WORDS, BEFORE THE FIGURE. The desktop never
				    needs this: its field opens inside the row, so the row IS the
				    context. A sheet covers the row it came from, so without these two
				    lines the reader is asked to confirm a number with nothing on screen
				    saying which of five positions it belongs to.
				    ⚠ No new strings — both are data the row already renders. */}
				<div className="flex flex-col gap-0.5">
					<span className="line-clamp-2 text-[15px] leading-[1.35] font-bold text-ink">
						{props.argumentTitle}
					</span>
					<span className="text-[11px] leading-[1.35] font-semibold text-n5">
						{props.marketTitle}
					</span>
				</div>
				<div className="flex items-center justify-between gap-3">
					<span className="text-[10px] leading-[1.2] font-extrabold tracking-[0.12em] text-n4 uppercase">
						Current value
					</span>
					{/* The SAME field the desktop row arms — not a copy of it. */}
					<InlineSellAmount
						tileKey={props.tileKey}
						seedDisplay={props.seedDisplay}
						seedExact={props.seedExact}
						draft={props.draft}
						disabled={props.busy}
						onEdit={props.onEdit}
						onSubmit={props.onSubmit}
					/>
				</div>
				{/* ⛔ THE CANCEL IS NOT OPTIONAL AND IT IS NOT THE BACKDROP. A two-step
				    cushion with no visible exit is a trap; the backdrop and the handle
				    are gestures a reader has to already know. Both routes land on the
				    same `onClose`. */}
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={props.busy}
						data-testid={`phone-sell-cancel-${props.tileKey}`}
						className="h-11 flex-1 font-extrabold tracking-[0.06em] uppercase"
						onClick={props.onClose}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={props.busy || !props.canSubmit}
						data-testid={`phone-sell-confirm-${props.tileKey}`}
						className="h-11 flex-1 font-extrabold tracking-[0.06em] uppercase [border:var(--ring-active)]"
						onClick={props.onSubmit}
					>
						{props.busy ? "…" : props.failed ? "Retry" : "Confirm"}
					</Button>
				</div>
			</div>
		</PhoneSheet>
	);
}
