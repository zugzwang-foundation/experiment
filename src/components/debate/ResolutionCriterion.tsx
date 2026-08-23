"use client";

import { useState } from "react";

import { ResolutionPopup } from "./dialogs";
import { KnowMore } from "./KnowMore";

/**
 * UI-QUICK change set 1 item 1 — the RESOLUTION criterion block (`d5:974-977`,
 * `.criterion` + `.overline`), lifted out of `MarketHeader` because it now holds
 * STATE and `MarketHeader` is a server component.
 *
 * ⚠ THE MOVE IS A BOUNDARY MOVE, NOT A REDESIGN. Every class below — the
 * `[border-top:var(--hairline)]` top rule, `pt-2.5`, the `.overline` recipe
 * (`text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase`) and
 * `.crittext`'s `mt-[5px] text-[11px] leading-[1.5]` — is carried BYTE FOR BYTE
 * off the block that shipped inside `MarketHeader.tsx`. The client boundary is
 * the only new thing here.
 *
 * ⚠⚠ THE CLAMP GOES 2 → 1, AND THE `NO AFFORDANCE` RULING IS REVERSED WITH IT.
 * The superseded block read "⛔ STILL NO AFFORDANCE, and that half did NOT
 * reverse. 'Criterion length treatment' remains docketed to HEADER-3ZONE, so an
 * expander here would decide a question that is explicitly deferred." The
 * kickoff of 2026-08-23 decides it: one line at rest, and a `Know more` that
 * opens the whole thing. Recorded in place rather than appended (O-5) — the
 * previous ruling's own reason for existing was that a clamp without an
 * affordance truncates the terms of the bet with no way to read the rest, and
 * this is that objection being ANSWERED, not overruled.
 *
 * ⚠⚠ THE EXPANSION IS A DIALOG, AND THE IN-PLACE VERSION IT REPLACES LASTED ONE
 * COMMIT. Change set 1 toggled `line-clamp-1` ↔ `whitespace-pre-wrap` on the
 * paragraph below. That was measured wrong in a way the clamp itself hid: this
 * stack has no scroller any more (deliberately — the scrollbar collided with the
 * sticky header), so an expanded criterion had nowhere to go and PAINTED DOWN
 * OVER THE ARENA. Founder ruling R3 = c: it opens in a dialog instead.
 * ⇒ The at-rest render is therefore UNCHANGED and ratified — one line, no
 * overflow, no scroll container. Only what `Know more` does moved.
 *
 * ⛔ ZERO WRITES AND ZERO TRUNCATION. `markets.description` is untouched, the
 * full string is in the DOM at rest as well as in the dialog, and the clamp is a
 * VISUAL bound — so find-in-page, a screen reader and the ADR-0025 `.md` export
 * all still see the whole criterion whether or not the control has been pressed.
 */
export function ResolutionCriterion({ description }: { description: string }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="pt-2.5 [border-top:var(--hairline)]">
			<div className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
				Resolution
			</div>
			{/* ⛔ RATIFIED AT REST — `line-clamp-1`, and nothing else. Do not add an
			    overflow or a scroller here; that pair is what R3 = c removed. */}
			<p className="mt-[5px] line-clamp-1 text-[11px] leading-[1.5] text-muted-foreground">
				{description}
			</p>
			{/* ⚠ The name EXTENDS `Know more` rather than replacing it — WCAG 2.5.3.
			    See `KnowMore.tsx`, which states the rule its call sites obey. */}
			<KnowMore
				label="Know more about the resolution criterion"
				onClick={() => setOpen(true)}
			/>
			{/* Focus trap, focus restore and scroll lock all arrive with the
			    primitive — see `ResolutionPopup`. Nothing is hand-rolled. */}
			<ResolutionPopup
				description={open ? description : null}
				onClose={() => setOpen(false)}
			/>
		</div>
	);
}
