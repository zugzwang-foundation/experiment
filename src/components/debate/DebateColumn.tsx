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
			} [&>*:last-child]:transition [&>*:last-child]:duration-150${
				// `.slot.picked .panel.vm{transform:translateY(-5px);
				// box-shadow:0 6px 16px …}` (`d5:896`) with its own `.16s ease`.
				// ⚠ `transition`, NOT `transition-transform`: Tailwind v4 emits
				// `-translate-y-*` on the `translate` PROPERTY, not on `transform`, so
				// `transition-transform` animates nothing and the lift snaps. Verified
				// in the browser — `getComputedStyle(el).transform` reads `none` while
				// `.translate` reads `0px -5px`.
				// The LIFT rides the column's body (the scroller, this node's last
				// child, which is the card); the ELEVATION rides the column box,
				// because the body has no surface of its own to cast from.
				picked
					? " rounded-(--r) shadow-(--elev-3) [&>*:last-child]:-translate-y-[5px]"
					: ""
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
