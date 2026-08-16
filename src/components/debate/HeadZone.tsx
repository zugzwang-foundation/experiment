import type { ReactNode } from "react";

/**
 * HTML-FINISH · MARKET DETAIL row 1 — the header zone's two-column FRAME, and
 * nothing else. One frame, two consumers.
 *
 * ⛔ THE FRAME PERSISTS; THE CONTENTS SWAP. This is the finding (plan §2, F-1)
 * that makes row 1 "the spine" rather than a layout tweak. Every element inside
 * the mockup's `.headzone` carries an ARM class — `vm` (market view) or `vp`
 * (post view) — and the two sets are disjoint:
 *
 *   .hleft   vm: .mmedia · .question · .attrs · .criterion · .rescards
 *            vp: .hpimg · .pauthor · .ptitle · .tease · .pfoot
 *   .hright  vm: .graph · .barrow f
 *            vp: .mcard
 *
 * The build did the opposite: `MarketHeader` rendered OUTSIDE the market↔post
 * ternary and `PostFocusHeader` stacked underneath it, so the header was
 * arm-BLIND and no `vp` element could land inside a header column. Hence this
 * component plus the ternary move in `DebateView` — `MarketHeader` renders the
 * market arm through it, `PostFocusHeader` the post arm.
 *
 * ⛔ `DebatePoll` DELIBERATELY STAYS OUTSIDE THE TERNARY. Its mount site is
 * load-bearing for the reason `DebateView.tsx` states in terms: inside the
 * ternary, entering or leaving a post would remount it and reset its `stopped`
 * and `wasSuspended` refs, so "stopped permanently" would last only until the
 * reader opened a post. Nothing here changes that.
 *
 * ⛔ TOPOLOGY ONLY — NO VALUE IS TAKEN FROM THE MOCKUP. The mockup's own
 * declarations are `.headzone{flex:0 0 188px;display:flex;gap:20px;
 * min-height:0}` · `.hleft{flex:1 1 auto;min-width:0}` · `.hright{flex:0 0
 * 340px;min-width:0}`. What is carried is the SHAPE — a row that does not grow,
 * a left column that does, `min-w-0` on both so they may shrink below their
 * content — and NOT the three lengths. The rail is a FRACTION (`lg:w-1/4`), a
 * topology declaration, never `340px`: the mockup is a fixed-desktop light-mode
 * prototype that declares no breakpoint at all, and a fixed track is precisely
 * the defect `shell/page-container.test.ts` records for the profile ("two 356px
 * columns at 1440 — IDENTICAL to its 768 rendering").
 *
 * ⚠ `min-h-0` IS A CHAIN LINK, and dropping it is invisible: a flex item's
 * automatic minimum size is its CONTENT, so without it a node refuses to shrink
 * below what it holds and the band silently reverts to content height. Pinned by
 * name in `tests/unit/design/debate-height-chain.test.ts`.
 *
 * ⚠ THE RIGHT RAIL IS NOT RENDERED WHEN IT HAS NOTHING TO HOLD. An empty 25%
 * column is visible empty chrome, which is `PD-3-09` / `OD-6` — the ruling that
 * deleted the deferred-work placeholder box from `MarketHeader` for rendering a
 * build-time note to every participant. A consumer with no rail content passes
 * `null` and the surface is one column, exactly as it ships today.
 */
export function HeadZone({
	left,
	right,
}: {
	left: ReactNode;
	/** `null` ⇒ no rail is rendered at all (see the docblock's last paragraph). */
	right: ReactNode | null;
}) {
	return (
		<section
			data-testid="headzone"
			className="flex min-h-0 shrink-0 flex-col gap-4 lg:flex-row"
		>
			<div
				data-testid="headzone-left"
				className="flex min-w-0 flex-1 flex-col gap-3"
			>
				{left}
			</div>
			{right === null ? null : (
				<div
					data-testid="headzone-right"
					className="flex min-w-0 flex-col gap-3 lg:w-1/4 lg:shrink-0"
				>
					{right}
				</div>
			)}
		</section>
	);
}
