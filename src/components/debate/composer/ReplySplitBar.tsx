"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";

import { formatDharma } from "../format";
import type { ReplyAggregate, Side } from "../types";
import { c3OppositeSide } from "./copy";
import { deriveReplySide, isEntryDisabled } from "./gating";
import { computeSplitBar, displaySplitTotal } from "./split-bar";

/**
 * UI.A3 slice 3 — the focused post's designed split bar (canon §6:
 * `SUPPORT Đ 3,800 ─ Đ 10,000 STAKED ─ Đ 6,200 COUNTER`) carrying the
 * Support/Counter TRIGGER pills (v0.9: pole-coded by the RESULTING bet side
 * — Support inherits the post's side, Counter the opposite; never a column
 * label — SG-8). A trigger whose resulting side ≠ the viewer's held side
 * renders DISABLED (F-3; tooltip + aria carry the C3 batch string). Triggers
 * toggle-to-close (v0.10). Renders on the removed variant too — the
 * aggregate survives and replying to a removed argument is legal (§6 edge).
 */
export function ReplySplitBar({
	postSide,
	aggregate,
	heldSide,
	marketOpen,
	suspended,
	activeRelation,
	onToggleRelation,
}: {
	postSide: Side;
	aggregate: ReplyAggregate;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	activeRelation: "support" | "counter" | null;
	onToggleRelation: (relation: "support" | "counter") => void;
}) {
	const { supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	// DROUND R2: the DISPLAYED total sums the DISPLAYED parts, so Support / Total
	// / Counter are always arithmetically consistent on screen (SPEC.1 §10.8).
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	return (
		/* ⚠⚠ RPLY-1 · R5 — THE FOCUSED POST'S BAR CATCHES UP TO THE CARD'S.
		   `AggregateFooter` (the market-view card) and this component are two
		   files with two file-private `TriggerPill`s, and the card's geometry was
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
		   spans sit. */
		/* ⚠ `data-testid` so the parity guard can ANCHOR on this row rather than
		   matching the first `flex items-* gap-*` div in the file — the card half
		   already anchors on `aggregate-footer`, and an unanchored generic pattern
		   silently re-points the moment any earlier div takes that extremely common
		   shape (OVN-V5: never select the thing under test by a styling class). */
		<div
			data-testid="reply-split-bar"
			className="flex items-start gap-2 text-xs"
		>
			{/* `.sidewrap` (`d5:585-586`) — the Đ figure is CENTRED UNDER its own
			    pill rather than inline beside it, on both flanks. */}
			<span className="flex shrink-0 flex-col items-center gap-1">
				<TriggerPill
					relation="support"
					postSide={postSide}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
					active={activeRelation === "support"}
					onToggle={onToggleRelation}
				/>
				<span className="text-n5">
					Đ {formatDharma(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				{/* RR-3 — THE POLES NAME THE SIDE, NEVER THE RELATION.
				    The fill is the SUPPORT share and the track is the counter
				    remainder, and both resolve to a SIDE: Support inherits the post's
				    side, Counter opposes it — `deriveReplySide`'s rule, the same one
				    `TriggerPill (→ the pole const)` applies below: this component's own
				    correct sibling, and this row's positive control.
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
				    over an `--n0` ground). This component's own `TriggerPill` carries the
				    same idea as its "black-pill exception" 0.5px n2 edge: the sibling
				    that is this row's positive control for the POLE rule is also its
				    positive control for the EDGE rule.
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
				    on BOTH poles. */}
				<span className="flex h-6 w-full items-center">
					<span
						className={`h-[18px] w-full overflow-hidden rounded-[var(--r)] [border:var(--hairline)] ${postSide === "YES" ? "bg-no" : "bg-yes"}`}
						aria-hidden="true"
					>
						<span
							className={`block h-full ${postSide === "YES" ? "bg-yes" : "bg-no"}`}
							style={{ width: supportPct }}
						/>
					</span>
				</span>
				<span className="text-n5">
					<b className="text-sm text-ink">Đ {formatDharma(displayedTotal)}</b>{" "}
					{/* `.sb2.mid` (`d5:620`) — the figure stays cased; the WORD is the
					    overline. Ported from the card so the two bars read alike. */}
					<span className="tracking-[0.1em] uppercase">staked</span>
				</span>
			</span>
			{/* ⚠ PILL FIRST ON THIS FLANK TOO. It used to be figure-then-pill so the
			    row read outward-in; stacked, both flanks lead with their pill and the
			    figure sits under it, which is what makes the two Đ amounts land on
			    one baseline instead of on opposite sides of the row. */}
			<span className="flex shrink-0 flex-col items-center gap-1">
				<TriggerPill
					relation="counter"
					postSide={postSide}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
					active={activeRelation === "counter"}
					onToggle={onToggleRelation}
				/>
				<span className="text-n5">
					Đ {formatDharma(aggregate.counterDharma)}
				</span>
			</span>
		</div>
	);
}

/** One Support/Counter trigger — pole fill/text/border NEVER change with state
 * (values-log §3: glow-only hover/pressed; disabled = opacity, no pointer). */
function TriggerPill({
	relation,
	postSide,
	heldSide,
	marketOpen,
	suspended,
	active,
	onToggle,
}: {
	relation: "support" | "counter";
	postSide: Side;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	active: boolean;
	onToggle: (relation: "support" | "counter") => void;
}) {
	const resultingSide = deriveReplySide({ parentSide: postSide, relation });
	const oppositeHeld = isEntryDisabled({ resultingSide, heldSide });
	const disabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: resultingSide })
			: null;
	const pole =
		resultingSide === "YES"
			? // Black-pill exception: 0.5px n2 edge (values-log §1 item 8).
				"bg-yes text-no border-[0.5px] border-n2"
			: "bg-no text-yes [border:var(--hairline)]";
	// C3 precedence (INFO-1 §3.4): a viewer blocked by the single-side rule is
	// told why they are blocked, not given the relation's definition. The
	// glossary gloss fills the null branch only — c3 still wins outright.
	const gloss =
		c3 ?? (relation === "support" ? GLOSSARY.support : GLOSSARY.counter);
	return (
		<InfoTip content={gloss} asChild>
			<button
				type="button"
				disabled={disabled}
				aria-disabled={disabled}
				aria-expanded={active}
				aria-label={
					c3 ??
					`${relation === "support" ? "Support" : "Counter"} — bet ${resultingSide}`
				}
				onClick={() => onToggle(relation)}
				className={`rounded-(--r-chip) px-3 py-1 text-xs font-bold transition-all hover:shadow-(--state-hover-glow-pole) focus-visible:shadow-(--state-focus-ring) active:shadow-(--state-pressed-glow-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) ${pole}`}
			>
				{relation === "support" ? "Support" : "Counter"}
			</button>
		</InfoTip>
	);
}
