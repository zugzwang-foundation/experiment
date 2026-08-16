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
			// ⚠⚠ THE BAND IS A FRACTION OF THE VIEWPORT — not d5's literal `188px`,
			// and NOT a percentage of the container. `.headzone{flex:0 0 188px}`
			// (`d5:447`) is 188/777 = **24.2%** of the viewport at the pinned
			// 1440×777.
			// ⛔ A CONTAINER PERCENTAGE WAS TRIED FIRST AND IS WRONG, MEASURED: at
			// 1800×971 the container's content box is 877px, so d5's band is 21.4%
			// of it; at 1440×777 that box is 683px and the SAME 188px band is 27.5%.
			// One number cannot be both — a container percentage drifts with the
			// container's own padding and chrome, while a viewport percentage is the
			// ratio the mockup's fixed px actually encodes. Shipping 21.4% measured
			// the band at 146px on staging: a −5.4pp miss that dragged the media
			// panel (−5.2pp) and the arena (+5.1pp) with it.
			// ⚠ `dvh`, not `vh` — same reason as the container's own band.
			// `shrink-0` is the `0 0` half of `flex:0 0`.
			// ⚠ `gap-5` = 20px is d5's `.headzone{gap:20px}` (`:447`), the gap
			// between the text column and the chart rail.
			data-testid="headzone"
			className="flex min-h-0 shrink-0 basis-[24.2dvh] flex-col gap-5 lg:flex-row"
		>
			<div
				// `.hleft{flex:1 1 auto;min-width:0;display:flex;gap:16px}` (`d5:448`)
				// — a ROW, not a stack. Its two children are the media panel and the
				// text stack; `MarketHeader`/`PostFocusHeader` supply that row.
				data-testid="headzone-left"
				className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
			>
				{left}
			</div>
			{right === null ? null : (
				<div
					// ⛔⛔ THE RAIL IS d5's LITERAL `340px`, AND THE PREVIOUS RULING IS
					// REVERSED. This read `lg:w-1/4` under a rule that a fixed track
					// was the defect; the founder's 2026-08-17 parity ruling names
					// rail width as one of the literals to copy, and the measurement
					// agrees: at the pinned 1800×971 d5's `.hright{flex:0 0 340px}` is
					// 18.9% of the viewport while `w-1/4` of the headzone gave 19.3% —
					// close in the rail itself, but it took its width from a container
					// that was ALSO wrong, and the two errors were cancelling. With
					// the container corrected to full-bleed, `w-1/4` of 1744px would
					// be 436px — 5.7pp too wide, squeezing the text stack.
					// ⚠ `shrink-0` unconditionally now, not `lg:shrink-0`: a fixed
					// basis that is allowed to shrink is not a fixed basis.
					data-testid="headzone-right"
					className="flex w-[340px] min-w-0 shrink-0 flex-col gap-3"
				>
					{right}
				</div>
			)}
		</section>
	);
}
