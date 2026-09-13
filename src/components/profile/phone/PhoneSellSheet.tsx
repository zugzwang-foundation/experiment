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
					{/* ⛔ CLAMPED, because an unbounded string in a title block on a
					    BOUNDED shell is a denial of view — the class `@security-auditor`
					    named at MOBILE-2d and left live. The debate side is safe by a
					    server-side 125-character cap on its teaser; this text comes from
					    the PROFILE's read model, which has no such cap, and a market
					    question long enough to fill the sheet would push `Confirm` below
					    the fold on the one surface where the reader has already decided
					    to act. Two lines here rather than the row's one: the sheet has
					    the width, and the question is the thing telling the reader WHICH
					    of five positions this is. */}
					<span className="line-clamp-2 text-[11px] leading-[1.35] font-semibold text-n5">
						{props.marketTitle}
					</span>
				</div>
				<div className="flex items-center justify-between gap-3">
					{/* ⚠ `Current` IS THE OPEN TAB'S OWN COLUMN HEADER, byte-for-byte
					    (`PositionsTable.tsx`'s `<th>`), not a phrase written for this
					    sheet. The sheet covers the row it came from, so the column head
					    the figure sat under has to come with it — and no new string
					    crosses into the product to do that. ⚠ It is also the header the
					    phone LOSES when `<thead>` goes hidden below 640px, so this is the
					    one place on the phone where that word is still said. */}
					<span className="text-[10px] leading-[1.2] font-extrabold tracking-[0.12em] text-n4 uppercase">
						Current
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
				{/* ⛔⛔ THERE IS NO CANCEL BUTTON HERE, AND ITS ABSENCE IS A CORRECTION
				    RATHER THAN AN OMISSION. A draft of this file shipped one, and it was
				    wrong twice over. It invented a visible string the product does not
				    have — the desktop's own cancel is an ICON with
				    `aria-label="Cancel sell"` — and it put a SECOND close control on a
				    sheet whose frame already draws one, which is exactly the defect
				    `phone-sheet-single-close.test.tsx` exists to catch: two controls,
				    51px apart, both meaning Close.
				    ⇒ The frame's `×` is the visible exit. It is disabled while a request
				    is in flight, like everything else here, and it lands on the same
				    `onClose` the backdrop, the handle and Escape do — which cancels the
				    arm, because a sheet that closes while the controller stays armed
				    strands a controller nothing on screen can reach. */}
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={props.busy || !props.canSubmit}
						data-testid={`phone-sell-confirm-${props.tileKey}`}
						className="h-11 w-full font-extrabold tracking-[0.06em] uppercase [border:var(--ring-active)]"
						onClick={props.onSubmit}
					>
						{props.busy ? "…" : props.failed ? "Retry" : "Confirm"}
					</Button>
				</div>
			</div>
		</PhoneSheet>
	);
}
