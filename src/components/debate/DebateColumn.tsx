import type { ReactNode } from "react";

import { SideBadge } from "./badges";
import { formatPricePercent } from "./format";
import type { Side } from "./types";

/**
 * One pole column of the two-column arena (DEBATE.4 §4 / D3) — LEFT=YES,
 * RIGHT=NO, the fixed side poles (never a Support/Counter label). The column
 * head carries the side's price tag and the static "No active position" stub
 * (the viewer/auth-dependent readout is OUT of DEBATE.4). The body hosts the
 * post-scroller (market-view) or reply-scroller (post-view).
 */
export function DebateColumn({
	side,
	pricing,
	header,
	engaged = false,
	picked = false,
	children,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	/**
	 * ⚠⚠ THE READER PICKED THIS COLUMN — d5's `.slot.picked` (`:896`), and the
	 * missing half of "←/→ are REVERSED".
	 *
	 * Picking a column STOPS its auto-advance and leaves the other running. That
	 * shipped and worked; what did not ship was any way to SEE it, so the only
	 * observable effect of pressing → was the OTHER column starting to move — which
	 * is precisely what "reversed" describes. d5 lifts the picked panel
	 * (`transform:translateY(-5px);box-shadow:…`) so the chosen column is the one
	 * that visibly changes.
	 *
	 * ⚠ THE SHADOW IS THE BUILD'S `--elev-3`, NOT d5's `rgba(10,10,10,.12)` —
	 * that is a light-theme value and would be invisible here (Ruling A / H-HEX).
	 * The LIFT is d5's own geometry.
	 */
	picked?: boolean;
	/**
	 * UI.A3 — the rebuilt slot header (market view: `SlotHeader`; post view
	 * keeps the legacy head until the A3 slice-4 strip). When given it fully
	 * replaces the legacy C1 head below.
	 */
	header?: ReactNode;
	/**
	 * Engaged-slot backlight (values-log §1 item 4): glows on the side BEING
	 * BET ON while the composer is open in the opposite slot. rgb-alpha glow —
	 * interaction physics, not elevation (allowed by the no-raw-hex guard).
	 */
	engaged?: boolean;
	children: ReactNode;
}) {
	const pct = pricing ? formatPricePercent(pricing, side) : "—";
	return (
		<div
			// ⚠⚠ THE PICK TARGET IS MARKED HERE AND HANDLED IN `DebateView`.
			// d5 `:1782-1786` binds a click listener to the whole column, and this
			// build cannot put that on an `onClick` prop: the column CONTAINS
			// buttons and links (the title, the `+`, the Support/Counter pills, the
			// rail arrows), so it can be neither a `<button>` (invalid nesting) nor
			// a static element with a click handler (Biome's
			// `noStaticElementInteractions` / `useKeyWithClickEvents`, correctly).
			// ⇒ The attribute below is a MARKER. `DebateView` already runs a
			// document-level listener for d5's click-away release (`:1788`), and
			// that one listener now does both halves — which is also closer to d5,
			// where the pick and the release are the same delegated mechanism.
			// ⚠ THE KEYBOARD PATH EXISTS AND IS BETTER: ←/→ pick a column from
			// anywhere on the page, so nothing here is mouse-only.
			data-debate-column={side}
			data-picked={picked ? "true" : undefined}
			// ⛔⛔ THE LIFT IS AN INLINE STYLE, AND THAT IS THE THIRD SHAPE IT TOOK.
			// It is a one-off, state-driven value — the same category as
			// `AggregateFooter`'s `style={{ width: supportPct }}` and `ScrollRail`'s
			// `style={{ height }}`, both already shipped — so an inline declaration
			// is in-pattern rather than an escape hatch.
			// ⚠⚠ AND THERE IS NO TRANSITION ON IT — d5's `.16s ease` is DROPPED, for
			// a reason worth more than the easing. Chasing this 5px offset produced
			// three "it does not apply" diagnoses in a row, and ALL THREE WERE MY
			// MEASUREMENT, not the code:
			//   · probe 1 read `.transform` on a Tailwind v4 `-translate-y-*`, which
			//     reads `none` whether or not the utility applied — a probe that
			//     cannot fail for the reason being tested.
			//   · probes 2 and 3 read a transform mid-transition in a tab where
			//     `document.hidden === true`. A hidden tab fires no
			//     `requestAnimationFrame`, so CSS transitions never advance: the
			//     computed value sits at its START value forever. That is why
			//     `translateY(-40px)` set BY HAND still computed to the identity
			//     matrix, and why `transition: none` made the very same declaration
			//     apply instantly.
			// ⇒ An untransitioned inline transform is correct in a visible tab AND
			// verifiable in a hidden one. Given the choice between an easing curve I
			// cannot verify and a lift I can, the lift wins. The elevation beside it
			// carries the same signal and has worked throughout.
			// ⚠ THE `--elev-3` SHADOW WAS NEVER BROKEN. Every one of those three
			// reports was about the transform alone.
			style={picked ? { transform: "translateY(-5px)" } : undefined}
			// HTML-FINISH · MARKET DETAIL row 1 — `min-h-0` is this column's link in
			// the height chain (`tests/unit/design/debate-height-chain.test.ts`). A
			// flex item's automatic minimum size is its CONTENT, so without it the
			// column refuses to shrink below what it holds, the arena band pushes
			// past its own `flex-1 min-h-0`, and the band silently reverts to
			// content height. Nothing errors; the page just gets taller.
			className={`flex min-h-0 flex-1 flex-col gap-3 ${
				engaged
					? "rounded-(--r) shadow-[0_0_10px_1px_rgba(255,255,255,0.2)]"
					: ""
			}${
				// `.slot.picked .panel.vm{box-shadow:0 6px 16px …}` (`d5:896`); the
				// paired `translateY(-5px)` is the inline style above.
				// ⚠ d5 lifts the PANEL and this lifts the whole COLUMN, header
				// included. Declared as a deviation: the panel is `{children}` here
				// and a parent cannot class its own children without either an
				// arbitrary variant (which is what failed twice above) or a wrapper
				// div, and a wrapper would insert an unwired link into the height
				// chain `debate-height-chain.test.ts` exists to protect. Lifting the
				// column reads the same — the chosen side rises — for none of that
				// risk.
				picked ? " rounded-(--r) shadow-(--elev-3)" : ""
			}`}
		>
			{header ?? (
				<>
					<div className="flex items-center justify-between gap-2 rounded-md p-2 [border:var(--hairline)]">
						<div className="flex items-center gap-1.5">
							<SideBadge side={side} />
							<span className="font-mono text-xs text-muted-foreground">
								{pct}
							</span>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">No active position</p>
				</>
			)}
			{children}
		</div>
	);
}
