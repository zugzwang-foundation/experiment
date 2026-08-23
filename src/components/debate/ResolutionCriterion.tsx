"use client";

import { useState } from "react";

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
 * ⚠ `whitespace-pre-wrap` ON THE EXPANDED ARM ONLY. `markets.description` is
 * authored prose with real paragraph breaks; the default `white-space:normal`
 * collapses them, so the expansion would render one undifferentiated wall of
 * text and the reader would have gained length without gaining structure. The
 * clamped arm does not take it — a single line has no breaks to survive, and
 * `line-clamp-1` and `pre-wrap` fight over the same overflow.
 *
 * ⛔ ZERO WRITES AND ZERO TRUNCATION. `markets.description` is untouched, the
 * full string is in the DOM in BOTH states, and the clamp is a VISUAL bound —
 * so find-in-page, a screen reader and the ADR-0025 `.md` export all still see
 * the whole criterion whether or not the control has been pressed.
 */
export function ResolutionCriterion({ description }: { description: string }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="pt-2.5 [border-top:var(--hairline)]">
			<div className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
				Resolution
			</div>
			<p
				className={`mt-[5px] text-[11px] leading-[1.5] text-muted-foreground ${
					expanded ? "whitespace-pre-wrap" : "line-clamp-1"
				}`}
			>
				{description}
			</p>
			{/* ⚠ The name EXTENDS `Know more` rather than replacing it — WCAG 2.5.3.
			    See `KnowMore.tsx`, which states the rule its call sites obey. */}
			<KnowMore
				label="Know more about the resolution criterion"
				expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
			/>
		</div>
	);
}
