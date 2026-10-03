"use client";

import type { ReactNode } from "react";
import { FriendlyFireHatch } from "../FriendlyFireHatch";
import { formatDharma } from "../format";
import type { ReplyAggregate, Side } from "../types";
import {
	computeSplitBar,
	displaySplitTotal,
	friendlyFireOfSupport,
} from "./split-bar";

/**
 * UI.A3 slice 3 — the focused post's designed split bar (canon §6:
 * `SUPPORT Đ 3,800 ─ Đ 10,000 STAKED ─ Đ 6,200 COUNTER`). Renders on the
 * removed variant too — the aggregate survives (§6 edge).
 *
 * ⚠⚠ FEED-3 — A DISPLAY NOW. Its two Support/Counter trigger pills MOVED, with
 * their props and every rule they carry, to the post arm's column headers
 * (`TriggerPill.tsx`); `Support` and `Counter` here are plain labels beside
 * their Đ figures, which is canon §6's own string. The track, its poles and its
 * hairline are untouched.
 * ⚠ UIR-4 item 5 — each label now stands ABOVE its figure (`EndLabel`), not
 * beside it.
 * ⚠ UIR-5 item 4 — and the whole bar is two lines: the words and the track on
 * line 1, the three Đ figures on line 2 (`EndCell`).
 */
export function ReplySplitBar({
	postSide,
	aggregate,
}: {
	postSide: Side;
	aggregate: ReplyAggregate;
}) {
	const { supportPct, hasStake } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	// Founder ruling 2026-10-04 — the friendly-fire share, hatched in the fill.
	const friendlyFirePct = friendlyFireOfSupport({
		friendlyFireDharma: aggregate.friendlyFireDharma,
		supportDharma: aggregate.supportDharma,
	});
	// DROUND R2: the DISPLAYED total sums the DISPLAYED parts, so Support / Total
	// / Counter are always arithmetically consistent on screen (SPEC.1 §10.8).
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	const support = formatDharma(aggregate.supportDharma);
	const counter = formatDharma(aggregate.counterDharma);
	return (
		/* ⚠⚠ RPLY-1 · R5 — THE FOCUSED POST'S BAR CATCHES UP TO THE CARD'S.
		   `AggregateFooter` (the market-view card) and this component were two
		   files with two file-private `TriggerPill`s (FEED-3 moved this file's out
		   to the column headers, `TriggerPill.tsx`), and the card's geometry was
		   corrected at CS6/CS10/CS11 while this one was left behind — not by
		   oversight, but because this file was allow-list-EXCLUDED for writing at
		   the time, which is stated in its own guard
		   (`reply-split-bar.test.tsx`). The exclusion is lifted for this task and
		   the geometry is PORTED; the two are NOT unified, which stays docketed on
		   `AggregateFooter` — that would be a refactor across two surfaces, one of
		   which this task does not touch.

		   ⛔⛔ `items-start`, NOT `items-center`, AND THIS IS THE ONE THING THE PORT
		   LIST DID NOT NAME. The `h-6` box below only aligns the track under
		   `items-start`, and `AggregateFooter`'s own comment records that
		   `items-center` was tried and lands ~2px off. MEASURED HERE on the real
		   compiled CSS at 1440×900: the track sat **11.99px ABOVE** the pill
		   centres before this change; keeping `items-center` while adding the box
		   would have left −2.0px, and `items-start` leaves −0.6px, inside the
		   bar's own thickness. Shipping the box without the row change would have
		   been the alignment fix that does not align.

		   ⚠ `gap-2` matches the card too. The pole logic below is UNTOUCHED — RR-3
		   corrected which SIDE each span paints, and this row moves only where the
		   spans sit.

		   ⚠⚠ UIR-5 item 4 — THE ROW ABOVE IS NOW A GRID OF TWO LINES, and the
		   `items-start` paragraph describes a one-line row that no longer exists.
		   Line 1 is `SUPPORT` · track · `COUNTER`, all centred on the track's 18px;
		   line 2 is each end's Đ figure under its word and `Đ N STAKED` under the
		   track, on one baseline. The columns are placed by name
		   (`col-start-*`/`row-start-*`), so the DOM keeps each word beside its own
		   figure — a reader hears "Support, Đ 3,800", never two words and then two
		   numbers. `gap-2` survives as the columns' gap. The block is 34px: the
		   44px it was at UIR-3 and the 52px at UIR-4 are what the fixed top
		   section (`PostFocusHeader`) could not hold beside a wrapped author row. */
		/* ⚠ `data-testid` so the parity guard can ANCHOR on this row rather than
		   matching the first `flex items-* gap-*` div in the file — the card half
		   already anchors on `aggregate-footer`, and an unanchored generic pattern
		   silently re-points the moment any earlier div takes that extremely common
		   shape (OVN-V5: never select the thing under test by a styling class). */
		<div
			data-testid="reply-split-bar"
			className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 text-xs"
		>
			{/* FEED-3 — label BESIDE its figure, outward-in, on a pill-height (`h-6`)
			    line so it stays centred on the track as the pill it replaces was. The
			    figure keeps its shipped class; the label takes the bar's own overline
			    (`staked` below).
			    ⚠⚠ UIR-4 item 5 — TWO LINES NOW, AND BOTH ENDS ONE WIDTH. Each end is
			    `EndLabel`: the word in `--color-ink` #fafafa at the label's 12px, weight
			    and 0.1em tracking, over its Đ figure in mono at the same size in the
			    label's grey, centred under it. Each end's grid cell also holds the
			    OTHER end's pair, invisible, so both cells take the wider pair's width
			    and the track between them — and `Đ N STAKED` under it — is centred in
			    the row. (That row sat on the page's centre line until UIR-7 item 2
			    dropped the rule; see `PostFocusHeader`.)
			    ⚠⚠ UIR-5 item 4 — AND EACH LINE IS NOW A ROW OF THE BAR'S GRID. A word is
			    one `EndCell` on line 1 and its figure another on line 2, centred under
			    it; each cell holds the OTHER end's text for its line, invisible, so both
			    end columns still take the wider pair's width, and the track and
			    `Đ N STAKED` between them stay centred in the row.
			    ⚠ UIR-7 item 2 — THE ROW IS THE WHOLE CONTENT COLUMN NOW, which grows
			    and shrinks with the picture beside it. Nothing here changes for it:
			    the track's `minmax(0,1fr)` takes whatever the two ends leave, so the
			    bar spans the column between its labels, and `Đ N STAKED` stays
			    centred under it on the figures' baseline. */}
			<EndCell
				className="col-start-1 row-start-1 tracking-[0.1em] text-ink uppercase"
				show="Support"
				size="Counter"
			/>
			<EndCell
				className="col-start-1 row-start-2 self-baseline font-mono text-gold"
				show={<>Đ {support}</>}
				size={<>Đ {counter}</>}
			/>
			{/* RR-3 — THE POLES NAME THE SIDE, NEVER THE RELATION.
			    The fill is the SUPPORT share and the track is the counter
			    remainder, and both resolve to a SIDE: Support inherits the post's
			    side, Counter opposes it — `deriveReplySide`'s rule, the same one
			    `TriggerPill` resolves its bet by. (Its pole fill, which was this
			    row's positive control, left with it at FEED-3; `AggregateFooter`'s
			    pills still carry one.)
			    Both were FIXED (`bg-no` track over a `bg-yes` fill), so on every NO
			    post the NO-side share was painted in the YES pole — a lie about
			    which side an argument backs.

			    ⛔ THE MOCKUP DOES **NOT** VINDICATE THIS BAR, AND AN EARLIER DRAFT OF
			    THIS COMMENT CLAIMED IT DID. Measured in `surface_d5_v1_0.html`:
			    `:1247`/`:1249` are the Support/Counter BUTTONS (`.rbtn2 n` / `.rbtn2
			    y`), and the bar between them at `:1248` carries NO side class at all.
			    `.barrow .bar` is a fixed `--n0` and `.bar .fill` a fixed `--ink`
			    (`:510-512`); `.bar .fill.right` exists at `:513` and is NEVER
			    applied; and the JS at `:1591-1592` sets only the two buttons'
			    classNames while `:1596` sets only the fill's WIDTH. The annotated
			    post is `side:'no'` with `sPct:69`, so d5 paints a NO post's SUPPORT
			    share in the YES pole.
			    ⇒ d5's BAR is itself a Route-3 instance. The mockup demonstrates the
			    rule at its TRIGGERS and fails to apply it at its BAR; this build
			    applies it in both places. So C13 is a DELIBERATE DIVERGENCE from the
			    artifact on the design-language rule (`design-language.md` §1
			    "Binding resolved" — and AGENTS.md §8's "the poles name the SIDE
			    (YES/NO), never the Support/Counter relation"), NOT a return to
			    it — recorded because §3 ratifies "mimic the mockup", and a later
			    fidelity pass reading `d5:1248` without this note would revert
			    the fix.
			    ⚠ BOTH POINTERS WERE WRONG UNTIL @code-reviewer RE-MEASURED THEM,
			    and they are named here so the wrong pair is not restored:
			    `design-language.md:268` is a CHANGELOG entry, not the rule (the
			    locked binding is §1, `:62`; `:269` merely records the axis
			    correction), and CLAUDE.md §8 is O-space — the poles sentence is
			    AGENTS.md §8. A note whose pointers do not resolve leaves the
			    reader with `d5:1248` alone, which is the revert this paragraph
			    exists to prevent. Cited by SYMBOL now, per O-8.

			    ⚠ Written as `postSide === "YES"` rather than as a
			    `deriveReplySide(...)` call, and THE FENCE IS THE REASON. §10 permits
			    exactly one `composer/**` exception, symbol-fenced to these two
			    spans, and any work resolving outside them is `H-COMPOSER`, a HALT —
			    so a hoisted `const` above the return was not available.
			    ⚠ Guard visibility alone does NOT select this form, and saying so
			    would mislead: `SIDE_COMPARISON` matches an IDENTIFIER before the
			    comparison, so a hoisted const would ALSO be visible while a bare
			    call expression would not. Both facts hold; only the fence decides.
			    (Inlining the ternary is also the shape of both ruled precedents —
			    `HeroPanels` entry 7 and `AggregateFooter` entry 9.)

			    ⛔ THE HAIRLINE IS LOAD-BEARING, AND THE FIRST DRAFT OF THIS FIX
			    OMITTED IT. Side-keying the track means it takes `bg-yes` #181818 on
			    a NO post, against a `bg-card` → `--color-n0` #212121 surface — about
			    1.10:1, i.e. GONE. The fill would then have no visible extent to be a
			    proportion OF. ⇒ Correcting the pole without adding the edge would
			    have traded an INVERSION for an ERASURE, on exactly the post side
			    this row exists to fix.
			    Both sibling bars already carry it — `HeroPanels` (this genus's ruled
			    precedent) and `AggregateFooter` — and so does the mockup, whose
			    `.barrow .bar` is an OUTLINE (`d5:510`, `border:1px solid var(--ink)`
			    over an `--n0` ground). The trigger pills this bar used to carry had
			    the same idea as their "black-pill exception" 0.5px n2 edge; they are
			    outline header controls since FEED-3, and the edge rule stays here.
			    ⛔ NOT `--border-strong` — `emphasis-ladder-tokens.test.ts` pins that
			    token at zero consumers. */}
			{/* ⚠⚠ RPLY-1 · R5 — THE TRACK SITS IN A PILL-HEIGHT BOX AND CENTRES
			    IN IT. `h-6` is the pill's own specified box (`text-xs` 16px line +
			    `py-1` 8px), so the track's CENTRE is that box's centre at any
			    thickness — which is why growing it 6 → 14 → 18px each time moves
			    what fills the box and not where the middle of it sits. A bare
			    offset would hit today's number and drift the first time the
			    pill's size changes.
			    ⛔ `h-[18px]` and `rounded-[var(--r)]` are READ OFF `PriceBar`'s
			    `detail` size, not chosen — the card's bar was matched to it at
			    CS10/CS11 because two split bars on one screen must not read as a
			    bar and a hairline, and at 14px a 3px radius reads as a rectangle
			    beside a market bar that is a pill. Same reasoning, same source,
			    now on both surfaces.
			    ⚠⚠ BLOCK-3 §2 — 14px → 18px, THE THIRD SURFACE IN THE SAME CHAIN.
			    `PriceBar.tsx`'s `detail` moved first (its own docblock has the
			    layout-budget reasoning), `AggregateFooter.tsx`'s track followed to
			    keep the market-view card in parity, and this file is the one
			    `split-bar-parity.test.ts` exists to keep from drifting behind
			    both: `the-reply-track-is-14px-with-the-card-radius-and-clip` reads
			    the thickness straight off this literal, and a re-size of the other
			    two that left this one behind is exactly the silent drift that
			    guard is for.
			    ⚠ THE HAIRLINE STAYS AND IS STILL LOAD-BEARING: side-keying the
			    track means it takes `bg-yes` #181818 on a NO post against a
			    #212121 card — ~1.10:1, i.e. gone — leaving the fill no visible
			    extent to be a proportion OF. `reply-split-bar.test.tsx` asserts it
			    on BOTH poles.
			    ⚠ UIR-4 item 5 — THE BOX IS `h-8` NOW, the two-line end labels'
			    height (two 16px `text-xs` lines), so the track centres on those
			    labels by the same mechanism it centred on the pill's box.
			    ⚠ UIR-5 item 4 — THE BOX IS LINE 1's GRID CELL NOW. The track sets
			    that row at 18px and the words centre on it (`items-center`), so the
			    track is centred on its line by the grid, not by a box of the labels'
			    height. */}
			<span className="col-start-2 row-start-1 flex">
				<span
					className={`h-[18px] w-full overflow-hidden rounded-[var(--r)] [border:var(--hairline)] ${hasStake ? (postSide === "YES" ? "bg-bar-no" : "bg-bar-yes") : "bg-n2"}`}
					aria-hidden="true"
				>
					<span
						className={`relative block h-full transition-[width] duration-300 ${postSide === "YES" ? "bg-bar-yes" : "bg-bar-no"}`}
						style={{ width: supportPct }}
					>
						<FriendlyFireHatch pct={friendlyFirePct} />
					</span>
				</span>
			</span>
			{/* ⚠ UIR-5 item 4 — line 2's middle cell: centred under the track and
			    on the figures' baseline (`self-baseline`, as they are). It does not
			    wrap: a second line here would be height the fixed top section does
			    not have. */}
			<span className="col-start-2 row-start-2 self-baseline text-center whitespace-nowrap text-n5">
				<b className="text-xs text-gold font-mono">
					Đ {formatDharma(displayedTotal)}
				</b>{" "}
				{/* `.sb2.mid` (`d5:620`) — the figure stays cased; the WORD is the
				    overline. Ported from the card so the two bars read alike. */}
				<span className="tracking-[0.1em] uppercase">staked</span>
			</span>
			<EndCell
				className="col-start-3 row-start-1 tracking-[0.1em] text-ink uppercase"
				show="Counter"
				size="Support"
			/>
			<EndCell
				className="col-start-3 row-start-2 self-baseline font-mono text-gold"
				show={<>Đ {counter}</>}
				size={<>Đ {support}</>}
			/>
		</div>
	);
}

/**
 * UIR-5 item 4 — one end of one line of the bar: its word (line 1) or its Đ
 * figure (line 2), centred in its column. `size` is the OTHER end's text for
 * the same line, laid invisibly in the same cell, so both end columns take the
 * wider pair's width without anything measuring it — UIR-4 item 5's `EndLabel`
 * sizer, one per line now. It is hidden from assistive technology, and
 * `invisible` keeps it out of the paint.
 */
function EndCell({
	show,
	size,
	className,
}: {
	show: ReactNode;
	size: ReactNode;
	className: string;
}) {
	return (
		<span
			className={`grid justify-items-center whitespace-nowrap ${className}`}
		>
			<span className="col-start-1 row-start-1">{show}</span>
			<span aria-hidden="true" className="invisible col-start-1 row-start-1">
				{size}
			</span>
		</span>
	);
}
