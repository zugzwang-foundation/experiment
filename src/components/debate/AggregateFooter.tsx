import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

import { c3OppositeSide } from "./composer/copy";
import { deriveReplySide, isEntryDisabled } from "./composer/gating";
import { computeSplitBar, displaySplitTotal } from "./composer/split-bar";
import { formatDharma } from "./format";
import type { ReplyAggregate, Side } from "./types";

/**
 * The read-time Support/Counter aggregate footer (design-language §3.1 / D12),
 * rendered as the market-view SPLIT BAR (`d5:1099-1102 (.barrow.f2)`; plan §6
 * row T3, Tier B-3). A READ-ONLY aggregate over a post's reply-bets — there is
 * NO vote control (no up/down, no friendly-fire); Support/Counter are computed,
 * never cast (INV / design-language §4.3).
 *
 * ✅ THE MOCKUP'S TRIGGERS ARE BACK (HTML-FINISH · MARKET DETAIL row 22), and
 * `R1` IS SUPERSEDED IN PLACE RATHER THAN DELETED (O-4). This block used to
 * read: "⛔ THE MOCKUP'S TRIGGERS ARE DELIBERATELY ABSENT … `POLISH-3.md` R1
 * removed those controls from `PostCard` on THESIS grounds — 'entering
 * post-focus to argue means reading the post first, and mandatory commentary is
 * meant to make argument deliberate, not reflexive'." The founder ruling of
 * 2026-08-16 reverses that strike.
 *
 * ⚠ AND THE THESIS GROUND IS HONOURED RATHER THAN OVERRIDDEN, which is the
 * shape of the reversal. A card pill does NOT open a composer on the card.
 * `onReply` enters that post's focus AND opens the relation there — so the
 * reader still lands on the argument before writing about it, exactly as R1
 * required, while the mockup's one-click affordance is restored. What R1
 * actually forbade was arguing WITHOUT reading; that is still forbidden.
 *
 * ⚠ THE PILLS ARE OPTIONAL. Without `triggers` this renders read-only, exactly
 * as it did before row 22 — so the component keeps working for any consumer
 * that has no viewer state to gate them with.
 *
 * ⛔⛔ THE POLES ARE KEYED TO THE POST'S SIDE, AND THAT IS THE WHOLE POINT.
 * Support inherits the post's side; Counter takes the opposite. So the pole a
 * given share is painted in DEPENDS ON THE POST, and a bar with FIXED poles
 * renders the NO-side share in the YES pole on every NO post.
 *
 * ⚠ `tests/unit/design/side-pole-binding.test.ts` CANNOT CATCH THAT. Its own
 * docstring names the case as "Route 3 — a FIXED pole colour on a PER-SIDE
 * element ... no side value appears in the expression at all", records that
 * "V17's Support/Counter split bar lived in exactly this hole for the length of
 * this PR", and notes the file "stayed green throughout". `RR-3` — the same
 * defect on `ReplySplitBar`'s own track and fill spans — was corrected at
 * POLISH.3 PR 2 C13; cited here as the worked example of the genus, not as a
 * live defect.
 * ⇒ The side value is resolved to a pole token AT the call site below, which is
 * the shape that cannot invert silently, and the control is the render guard
 * `tests/unit/debate/render/aggregate-footer.test.tsx` (four assertions: two
 * poles × two post sides).
 *
 * ⚠ Ruling A — structure is copied from the mockup, tokens are NOT. `.bar`'s
 * `border:1px solid var(--ink)` and `.fill`'s `background:var(--ink)` are
 * LIGHT-theme values; ported by name they would render both poles near-white.
 * The poles are `--color-yes`/`--color-no` via `bg-yes`/`bg-no`.
 *
 * ⚠ The split math is REUSED, not re-implemented: `computeSplitBar` /
 * `displaySplitTotal` are the ratified exact-decimal (never JS float, CLAUDE.md
 * §2) implementations already backing the focused-post bar, so the two bars
 * cannot disagree about one market. A second copy here would be
 * `PLURAL-NOUN-DUP`'s genus. Read-only reuse — no `composer/**` file is
 * written (§10).
 */
export function AggregateFooter({
	aggregate,
	postSide,
	triggers,
	band = false,
}: {
	aggregate: ReplyAggregate;
	/** The post's frozen side (INV-3) — the bar's pole basis, never a relation. */
	postSide: Side;
	/**
	 * HTML-FINISH · MARKET DETAIL row 22 — the `.rbtn2` Support/Counter trigger
	 * pills (`d5:1100`, `:1102`). OMIT to render the read-only footer.
	 *
	 * ⛔ THE VIEWER STATE IS REQUIRED TOGETHER WITH THE HANDLER, deliberately as
	 * one object: a trigger without its F-3 gate is a control that invites a bet
	 * the viewer cannot place. Making them separable would make that mistake
	 * expressible.
	 */
	triggers?: {
		heldSide: Side | null;
		marketOpen: boolean;
		suspended: boolean;
		onReply: (relation: "support" | "counter") => void;
	};
	/**
	 * MOBILE-2m · R-1 / ADR-0051 A9 D-1 — this footer is a BAND below 640px when
	 * its card has been unboxed, not a strip floating on the card's ground.
	 *
	 * ⚠ IT IS THE CARD'S DECISION, NOT THIS COMPONENT'S, WHICH IS WHY IT ARRIVES
	 * AS A PROP. The band only reads as a band because the card around it lost its
	 * border and its radius; on a boxed card the same ground would be a lighter
	 * rectangle inside a darker one — the "stray box" A9 D-1 names as the thing to
	 * avoid. So the two decisions travel together, from the one mount that makes
	 * them (`PhoneDebateView`'s `feedPane`), and cannot be set apart.
	 *
	 * ⛔ DEFAULT `false`, AND EVERY TOKEN IT ADDS IS `max-mobile:`. The read-only
	 * consumers, the parent-post sheet and every desktop mount are unchanged by
	 * omission and unchanged above 640px by construction.
	 */
	band?: boolean;
}) {
	const { supportPct, hasStake } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	// DROUND R2: the DISPLAYED total sums the DISPLAYED parts, so Support /
	// Total / Counter are always arithmetically consistent on screen (§10.8).
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	// Support resolves to the post's own side; Counter to the opposite.
	const supportPole = postSide === "YES" ? "bg-yes" : "bg-no";
	const counterPole = postSide === "YES" ? "bg-no" : "bg-yes";

	return (
		<div
			data-testid="aggregate-footer"
			className={cn(
				"flex items-start gap-2 text-xs text-muted-foreground",
				// ⛔⛔ MOBILE-2m · R-1 / A9 D-1 — THE BAND, AND THE NEGATIVE MARGIN IS
				// WHAT MAKES IT ONE. `-mx-3` cancels the card's own `p-3` so the
				// ground reaches the card's edges — which, on an unboxed card, are the
				// SCREEN's edges — and `px-3` puts the content back where it was, so
				// not one of the three columns moves horizontally. The band is drawn
				// behind the row rather than around it.
				// ⚠ SAFE UNDER THE CARD'S `overflow-hidden`: the ground is clipped at
				// exactly the card's edge, which is the extent wanted. Nothing
				// hit-testable lives in the bled region — `TriggerPill`'s tap
				// extension is `inset-x-0` on the pill and vertical only, so the rule
				// that extension records (a clipped region is not hit-testable) is not
				// in play here.
				// ⚠ `bg-n1` IS ONE STEP UP FROM THE CARD GROUND, read off the ramp and
				// not chosen: `Card` is `bg-card` → `--color-n0` #212121, and `n1` is
				// #2a2a2a, the next rung. The ramp runs dark → bright (AGENTS.md §8),
				// so "one step up" is n0 → n1 and never the reverse.
				band &&
					"max-mobile:-mx-3 max-mobile:bg-n1 max-mobile:px-3 max-mobile:py-2.5",
			)}
		>
			{/* `.sidewrap` (`d5:585`) — `align-items:center`, on BOTH sides
			    (`.sidewrap.r{align-items:center}`, `:586`). d5's own comment says it
			    in terms: "v1.8: Đ centred under its pill". The shipped render flushed
			    the figures to the OUTER edges, so each amount sat under the card's
			    corner instead of under the pill it belongs to. */}
			<span className="flex shrink-0 flex-col items-center gap-1">
				{triggers ? (
					<TriggerPill relation="support" postSide={postSide} {...triggers} />
				) : null}
				{/* HTML-FINISH · MARKET DETAIL round 2 · R5 — `Support (0) : Đ 0`
				    becomes `Đ 0`. d5's `.sb2` under each pill is the bare figure
				    (`d5:981`/`:983`, `Đ 3,800` / `Đ 6,200`) and nothing else.
				    ⚠ NOTHING IS LOST FROM THE ROW. The word "Support" is the PILL
				    directly above this figure, so the prefix restated a label that is
				    already on screen an inch away; and the count `(N)` is carried by
				    the author row's `Replies · N`, which sums the same two fields
				    (`PostCard.tsx` builds `replyCount` from `supportCount +
				    counterCount`). The prefix was pure duplication in both halves.
				    ⚠ THE POST ARM ALREADY READS THIS WAY. `composer/ReplySplitBar.tsx`
				    renders the bare `Đ {formatDharma(...)}` on both sides and always
				    has, so this row makes the two bars AGREE rather than moving one of
				    them — which is also why the post arm needs no edit, and why the
				    allow-list-excluded `ReplySplitBar.tsx` is untouched (H1-f clear).
				    ⚠ THE ACCESSIBLE READING IS PRESERVED BY THE PILL, not by this
				    span: the trigger's `aria-label` names the resulting bet side in
				    words. A screen reader meets "Support — bet YES" and then the
				    figure, which is the same information in the same order. */}
				<span>Đ {formatDharma(aggregate.supportDharma)}</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				{/* Decorative: the figures either side carry the meaning, and colour
				    is never the only channel (§8 a11y). */}
				{/* ⚠ THE HAIRLINE IS LOAD-BEARING, NOT TRIM. `--color-yes` is #181818
				    and the card surface is `bg-card` → `--color-n0` #212121, so on a
				    NO post the track (the YES pole) sits at ~1.09:1 against its own
				    card and DISAPPEARS — leaving the fill no visible extent to be a
				    proportion of. The zero-reply case is the same defect from the
				    other side: `computeSplitBar` returns "0%", so a YES post would
				    render a solid full-width white bar reading as "100% Counter"
				    beside two figures that both read `Đ 0`.
				    ⚠ THAT SENTENCE USED TO SAY "Support (0) / Counter (0)" and round
				    2's R5 dropped those prefixes, so it is corrected here in the same
				    commit rather than left describing a render that no longer exists.
				    ⛔ THE HAIRLINE MATTERS MORE NOW, NOT LESS: the two flanking
				    figures are shorter, so the bar carries proportionally more of the
				    row's meaning.
				    The mockup does not have this problem because `.bar` is an
				    OUTLINE — `d5:510` `border:1px solid var(--ink)` — and the port
				    dropped it. Ruling A forbids porting the VALUE, not the
				    STRUCTURE, so the border returns via the build's own token.
				    ⛔ NOT `--border-strong`: `emphasis-ladder-tokens.test.ts:216`
				    pins that token at zero consumers.
				    ⚠⚠ MOBILE-2m · R-2 — THE HAIRLINE SURVIVES THE CHANNEL, AND IT WAS
				    RE-CHECKED RATHER THAN ASSUMED. The reasoning above is a CONTRAST
				    argument, so it has to be re-run whenever the surface it is measured
				    against moves — and it has moved twice.
				    ⛔ MOBILE-2m · R-1 put the figures on a band's n1 #2a2a2a instead of
				    the card's n0 #212121, taking the track's worst case against its own
				    ground from ~1.09:1 to ~1.3:1. ⚠ THAT SENTENCE IS NOW HISTORY, AND
				    IT IS CORRECTED HERE RATHER THAN LEFT STANDING (`O-5`): MOBILE-2n ·
				    R-3 / A10 D-3 takes the band away, so the figures are back on the
				    card's own n0 and the ~1.09:1 worst case is back with them.
				    ⇒ THE BORDER STAYS, AND NOW IT IS LOAD-BEARING IN BOTH DIRECTIONS.
				    Below 640 the track's ground is the channel rather than a pole, and
				    #2a2a2a against the card's #212121 is ~1.14:1 — so on the phone the
				    hairline is most of what says where the bar IS. At and above 640 the
				    original argument is untouched: a NO post's track is `--color-yes`
				    #181818 on #212121 and would disappear without it. */}
				{/* ⚠⚠ UI-QUICK change set 6 §1 — THE TRACK NOW OCCUPIES THE PILL'S OWN
				    BOX, so its centre lands on the Support/Counter centres.
				    MEASURED before: track centre 696.00 against Support 705.50 and
				    Counter 706.00 — the bar sat 9.5px HIGH, because `items-start` on
				    the row (`:106`) top-aligns all three columns and the 6px track is
				    the first child of its column while a 25px pill is the first child
				    of each neighbour. Two different first-child heights, one shared
				    top edge.
				    ⛔ `items-start` → `items-center` WAS TRIED ON PAPER AND DOES NOT
				    SOLVE IT. That centres the COLUMNS, not the track: the track stays
				    the first child of its own column, so it would land ~2px off — the
				    arithmetic is columns 45/30/45 tall, centring the 30 inside 45
				    moves the track by 7.5px against a 12.5px target. Better than 9.5,
				    still outside the 1px bar. So the row's alignment is UNCHANGED.
				    ⇒ The fix is declarative instead: the track sits in a box the same
				    height as the control it aligns to (`h-6` = the pill's own
				    specified box — `text-xs` 16px line + `py-1` 8px) and centres
				    inside it. A bare offset like `mt-[9.5px]` would hit the same
				    number today and drift silently the first time the pill's size
				    variant changes; this expression stays true because it names the
				    pill's box rather than a difference measured against it.
				    ⚠ COST, MEASURED AND REPORTED: the centre column grows, so the
				    strip grows a few px. Reported in the change-set file with the
				    height-chain check.
				    ⚠ The `items-center` cited in the comment below belongs to d5's
				    INNER `.sidewrap` columns (`:585-586`) and is NOT authority for
				    the outer row — it is not read as such here in either direction. */}
				{/* ⚠ MOBILE-2e · R-M2 — `max-mobile:h-8` TRACKS THE PILL, and it has to
				    move with it or the CS6 fix above stops being true below 640px. The
				    box exists to put the track's centre on the pill's centre; the pill
				    is 32px on a phone now, so a box frozen at 24 would put the track 4px
				    high — the same class of defect CS6 measured at 9.5px, one third the
				    size and just as invisible in a source scan. */}
				<span className="flex h-6 w-full items-center max-mobile:h-8">
					<span
						data-testid="aggregate-split-track"
						aria-hidden="true"
						className={cn(
							// ⚠⚠ change set 10 §6a — THE TRACK MATCHES THE MARKET-LEVEL BAR.
							// It was `h-1.5` (6px) beside a `PriceBar` whose `detail` size —
							// the one on this very surface — was `h-[14px]`. Two split bars,
							// one screen, and one of them read as a hairline next to the
							// other. MEASURED before changing: 6px vs 14px.
							// ⚠ `detail`, not `hero` (22px) or `card` (16px): those render on
							// the Discovery surfaces, and the comparison a reader actually
							// makes is against the bar in the same viewport.
							// ⚠⚠ change set 11 §2 — AND THE RADIUS COMES WITH IT. At 6px the
							// corner was invisible; at 14px `rounded-(--r-dot)` (3px) read as
							// a RECTANGLE beside a market bar that is a pill.
							// ⛔ READ OFF `PriceBar`, not chosen: its track is
							// `rounded-[var(--r)]` + `overflow-hidden` + the hairline, and
							// its two fill segments carry NO radius of their own — the
							// track's `overflow-hidden` clips them. This mirrors all three:
							// same radius token, same clip, and the fill below stays plain.
							// ⚠ design-language names these ONE split-bar family, two
							// variants of one construction; they should not diverge in shape.
							// ⛔ THIS DOES NOT MOVE THE ALIGNMENT, and that is a property of
							// the CS6 fix rather than luck: the track is centred inside a
							// fixed `h-6` box, so its CENTRE is the box's centre at any
							// thickness. Growing it 6 → 14 changed what fills the box, not
							// where the middle of it sits — the same is true of 14 → 18 below.
							// ⚠⚠ BLOCK-3 §2 — 14px → 18px, TRACKING `PriceBar`'S `detail` BAR
							// (`h-[14px]` → `h-[18px]`, `PriceBar.tsx`'s own docblock on `ROW`).
							// `aggregate-footer-alignment.test.ts`'s
							// `the-track-matches-the-market-level-bar-thickness` guard reads
							// `detail`'s thickness FROM `PriceBar.tsx` rather than a copied
							// literal specifically so a re-size like this one reddens and has
							// to move both together — this edit is that guard doing its job,
							// not scope creep: §2's brief names "the YES/NO bar" as one of the
							// three things to redistribute freed height into, and this track
							// is design-language's other half of that same bar family. 18px
							// still clears the fixed `h-6` (24px) wrapper with 3px to spare on
							// each side, so the CS6 centring is untouched.
							// ⚠⚠ MOBILE-2e · R-M2 — 6px BELOW 640px, ruled. The 18px literal
							// stays exactly where it is: `split-bar-parity` and
							// `aggregate-footer-alignment` both re-derive it from
							// `PriceBar.tsx`'s `detail.bar` and read it out of THIS string,
							// so the three-way desktop parity is untouched by an additive
							// phone token. The reason the phone wants a thinner bar is not
							// taste: at 360px the row is a third of the width it has at
							// 1440, so an 18px track stops reading as a proportion and
							// starts reading as a block of colour.
							// ⚠⚠ MOBILE-2n · R-2 / ADR-0051 A10 D-2 — 8px → 14px. THE PARAGRAPH
							// BELOW IS A9's AND ITS NUMBER IS HISTORY; the token on the string is
							// `h-[14px]`. Its two arguments both survive the change and that is
							// why it is corrected rather than deleted: the 18px desktop literal
							// is still untouched, and the ends are still DECLARED round rather
							// than inherited round — at 14px an 8px `--r` would clamp to 7 and
							// look almost right, which is the same coincidence A9 refused.
							// ⚠⚠ MOBILE-2m · R-2 / ADR-0051 A9 D-2 — 6px → 8px AND TRUE ROUNDED
							// ENDS BELOW 640px. The 18px desktop literal is untouched, so
							// `split-bar-parity` and `aggregate-footer-alignment` — which
							// both re-derive it from `PriceBar.tsx`'s `detail.bar` and read
							// it out of THIS string — are undisturbed.
							// ⚠ `rounded-full` RATHER THAN LEANING ON `--r`. At 8px tall an
							// 8px radius already clamps to 4px and looks identical today,
							// which is exactly the problem: the shape would then be a
							// coincidence of two numbers that are free to move apart. A9 D-2
							// rules ENDS, so the declaration says ends.
							"h-[18px] max-mobile:h-[14px] w-full overflow-hidden rounded-[var(--r)] max-mobile:rounded-full [border:var(--hairline)]",
							counterPole,
							// ⛔⛔ THE RECESSED CHANNEL — AND SINCE ADR-0051 A10 D-2 IT IS
							// UNCONDITIONAL BELOW 640px, WHICH REVERSES THE PARAGRAPH THIS
							// ONE REPLACES. A9 D-2 painted the groove only at Đ 0 / Đ 0 and
							// this block argued, in bold, that it "IS CONDITIONAL, AND IT HAS
							// TO BE", because the counter share WAS the track's own ground and
							// a groove that stayed would erase the counter pole. A10 D-2 rules
							// exactly that erasure: the channel spans the full track, the fill
							// is the Support share drawn over it, and the Counter share IS the
							// exposed channel. So the `hasStake` gate is gone from this token
							// and the phone bar no longer carries a pole on its remainder.
							// ⚠ THE COST, STATED RATHER THAN DISCOVERED LATER: below 640 the
							// Counter side is no longer colour-coded. The two Đ figures either
							// side still carry the fact — which is the same reason this track
							// is `aria-hidden` and has always been decorative.
							//
							// ⛔⛔⛔ THE TOKEN IS `--surface-inset` (n1 #2a2a2a) AND THE RULING
							// SAYS "one step below the card ground". THOSE ARE NOT THE SAME
							// COLOUR, AND THE DIFFERENCE IS MEASURED, NOT PREFERRED.
							// R-3 above takes the band away, so the card ground below this row
							// is `--color-n0` #212121. One step BELOW it on the ramp is
							// `--color-ground` #181818 — and `--color-ground` and `--color-yes`
							// are the SAME SIX DIGITS (`globals.css`: `--color-ground: #181818`,
							// `--color-yes: #181818`). The fill is the Support pole, so on
							// every YES post the fill would be drawn in the channel's own
							// colour: a 51% bar and a 0% bar would render identically, and
							// half the cards in a market are YES posts. MEASURED at ground on
							// `/m/sp-m2-active` at 390 — a real 51% YES post reads
							// `fill rgb(24, 24, 24)`, which is #181818 exactly.
							// ⇒ A10's own acceptance line is "channel colour ≠ fill colour",
							// and #181818 fails it. `--surface-inset` is the design language's
							// own name for a recessed surface (`globals.css` "Applied
							// surfaces"), is muted, and differs from BOTH poles — so it
							// satisfies every clause of the ruling except the direction of one
							// step. ⚠ FLAGGED FOR THE FOUNDER rather than settled here: the
							// second-order consequence is that a #181818 fill on a #2a2a2a
							// channel is ~1.15:1, so on a YES post the Support share is legible
							// as a boundary rather than as a colour. The design language has
							// already solved this exact problem once, for the debate graph —
							// `--graph-yes: #737373`, "the black pole cannot render on the dark
							// ground" — and that is the shape of the answer if the founder
							// wants one; it is a pole change and this round may not make it.
							// ⛔⛔ THE PARAGRAPH BELOW IS A9's AND ITS STATE DESCRIPTION IS NOW
							// WRONG IN THREE PLACES — corrected here, at the top, because this is
							// what a reader reaches first (`O-5`). Since A10 D-2 the token is
							// `bg-(--surface-inset)` rather than `bg-n0`; it is UNCONDITIONAL
							// below 640 rather than gated on `!hasStake`; and the track computes
							// `rgb(42, 42, 42)` at EVERY stake level rather than two different
							// values either side of Đ 0.
							// ⚠⚠ WHAT SURVIVES UNCHANGED IS THE HAZARD AND ITS WARNING, and the
							// blast radius has WIDENED: the stack now occurs on every feed card
							// at every stake level rather than only at Đ 0, so if the emission
							// order ever flips, every phone track reverts to the A9 pole
							// appearance with NO RED anywhere. Read the ⚠ at the end of the
							// paragraph below — it is still live and still the thing to check.
							// `docs/parked.md` **2m-5**. Found by `@code-reviewer`.
							// ⛔⛔ THIS COMMENT SAID THE TWO BACKGROUNDS WERE MUTUALLY
							// EXCLUSIVE AND THAT WAS FLATLY FALSE. It read: "NO SECOND `bg-*`
							// IS STACKED ON A SINGLE ELEMENT AT ONE WIDTH … so nothing here
							// resolves by stylesheet emission order". `counterPole` is
							// UNCONDITIONAL — it is passed to `cn()` on every render — and the
							// `!hasStake` gate decides only whether this token is added BESIDE
							// it. So below 640 with no stake the element really does carry both
							// `bg-no` and `max-mobile:bg-n0`, both match, both are
							// single-class selectors, a media query adds no specificity, and
							// `twMerge` keeps both because their modifiers differ.
							// ⇒ THE GROOVE WINS ON EMISSION ORDER, which is the very trap
							// `PositionsTable.tsx` records in terms. It is CORRECT today
							// because Tailwind v4 sorts variant-bearing candidates after bare
							// ones, so `max-mobile:bg-n0` is emitted later — verified on the
							// live build: the track computes `rgb(33, 33, 33)` at Đ 0 and
							// `rgb(250, 250, 250)` with stake.
							// ⚠ WHAT WOULD BREAK IT: giving `counterPole` a `max-mobile:` arm
							// for any reason. The two would then land in the same variant
							// bucket, where order is decided by theme-key position rather than
							// by variant class, and the white wire A9 D-2 exists to kill comes
							// back with NO RED — every guard here checks token PRESENCE, and
							// jsdom resolves no cascade. The durable fix (pairing the variants
							// so the exclusivity is real) is docketed at `docs/parked.md`
							// **2m-5** rather than taken at the end of an unattended round,
							// because it changes the desktop class string and the desktop
							// non-regression wall had already been measured. Found by
							// `@code-reviewer`, HIGH — and it is exactly the shape this repo
							// calls out: a wrong reassurance is what stops the next reader
							// checking.
							band && "max-mobile:bg-(--surface-inset)",
						)}
					>
						<span
							data-testid="aggregate-split-fill"
							className={cn(
								"block h-full",
								supportPole,
								// ⛔⛔ MOBILE-2n · R-2 / ADR-0051 A10 D-2 — THE EVEN SPLIT AT
								// Đ 0 / Đ 0, AND THE `!` IS THE WHOLE MECHANISM RATHER THAN A
								// shortcut. The width below is an INLINE style, and an inline
								// declaration outranks every selector in the stylesheet — so a
								// plain `max-mobile:w-1​/2` here would be authored, compiled,
								// present in the class attribute and completely inert, which is
								// the worst shape a phone token can have (it looks applied in
								// the source and does nothing in the browser). An `!important`
								// author rule is the one thing that outranks a non-important
								// inline one.
								// ⚠ WHY NOT MOVE THE WIDTH TO A CUSTOM PROPERTY, which would
								// let two ordinary utilities decide it: that rewrites the
								// DESKTOP element's class string and inline style, and this
								// round's wall is a desktop diff of exactly nothing. The
								// override is additive; the base is untouched.
								// ⚠ 50% IS A PRESENTATION FACT, NOT A SHARE. `computeSplitBar`
								// still returns `"0%"` here and the figures either side still
								// read `Đ 0` — nothing is being claimed about stake. A9 D-2
								// solved the same zero state by recolouring the track; A10 D-2
								// solves it by filling half of it, so the bar has presence and
								// the channel is visible on both sides of the midpoint.
								band && !hasStake && "max-mobile:w-1/2!",
							)}
							style={{ width: supportPct }}
						/>
					</span>
				</span>
				<span>
					{/* ⚠ MOBILE-2e · R-M2 — the three amounts are ONE LINE at 12px on a
					    phone. The two flanks already inherit the row's `text-xs`; only
					    this one was a step up, and a 14px centre between two 12px flanks
					    is what made the line read as three separate readouts rather than
					    one. Desktop keeps the emphasis. */}
					<b className="text-sm text-ink max-mobile:text-xs">
						Đ {formatDharma(displayedTotal)}
					</b>{" "}
					{/* `.sb2.mid` (`d5:620`) — `letter-spacing:.1em;
					    text-transform:uppercase`. The figure stays cased; the WORD is
					    the overline. */}
					<span className="tracking-[0.1em] uppercase">staked</span>
				</span>
			</span>
			<span className="flex shrink-0 flex-col items-center gap-1">
				{triggers ? (
					<TriggerPill relation="counter" postSide={postSide} {...triggers} />
				) : null}
				{/* Row 5's other half — see the Support span above for the whole
				    reasoning. Both sides, one change. */}
				<span>Đ {formatDharma(aggregate.counterDharma)}</span>
			</span>
		</div>
	);
}

/**
 * One Support/Counter trigger on the market-view card (row 22) — the `.rbtn2`
 * pills at `d5:1100` / `:1102`.
 *
 * ⛔⛔ POLE-KEYED BY THE RESULTING BET SIDE, NOT BY THE RELATION. Support
 * inherits the post's side, Counter takes the opposite, and the pole is resolved
 * from that RESULTING side at this call site — the shape
 * `side-pole-binding.test.ts` exists to require, because a fixed pole on a
 * per-side element is its documented "Route 3" blind spot. AGENTS.md §8: the
 * poles name the SIDE (YES/NO), never the Support/Counter relation.
 *
 * ⚠ THE SIDE DERIVATION IS SHARED, NOT RE-IMPLEMENTED — `deriveReplySide` and
 * `isEntryDisabled` are the same unit-pinned functions the focused-post bar
 * uses, so the two surfaces cannot disagree about which side a relation
 * produces. Only the CSS recipe below is a second copy, and it is a second copy
 * because `ReplySplitBar`'s own `TriggerPill` is file-private and that file is
 * allow-list-EXCLUDED for writing — exporting it would be the edit this task may
 * not make. ⚠ Unifying the two is a follow-up whose fence must include
 * `composer/ReplySplitBar.tsx`.
 *
 * ⚠ F-3 GATING IS NOT OPTIONAL. A trigger whose RESULTING side is not the
 * viewer's held side renders disabled, carrying the C3 batch string in both
 * `aria-label` and the `InfoTip` gloss (INFO-1 §3.4 C3 precedence — the
 * refusal wins over the relation's definition) — identical to the
 * focused-post bar, so the same refusal reads the same way wherever the
 * viewer meets it. ⚠ The `aria-label` channel is the one that reliably
 * reaches a screen reader here: this trigger also carries
 * `disabled:pointer-events-none` (below), which — same reasoning as
 * `RadioSlot`'s (O-3) — suppresses hover/click at the browser's hit-testing
 * layer, so the `InfoTip` channel may never actually open on a disabled
 * pill in a real browser. Not measured; not worked around here.
 */
function TriggerPill({
	relation,
	postSide,
	heldSide,
	marketOpen,
	suspended,
	onReply,
}: {
	relation: "support" | "counter";
	postSide: Side;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	onReply: (relation: "support" | "counter") => void;
}) {
	const resultingSide = deriveReplySide({ parentSide: postSide, relation });
	const oppositeHeld = isEntryDisabled({ resultingSide, heldSide });
	const disabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: resultingSide })
			: null;
	// Black-pill exception: 0.5px n2 edge (values-log §1 item 8).
	const pole =
		resultingSide === "YES"
			? "bg-yes text-no border-[0.5px] border-n2 shadow-xs hover:bg-neutral-200 hover:text-black cursor-pointer active:scale-95"
			: "bg-no text-yes border border-white/25 shadow-xs hover:bg-neutral-800 hover:border-white/60 hover:text-white cursor-pointer active:scale-95";
	// C3 precedence (INFO-1 §3.4): a viewer blocked by the single-side rule is
	// told why they are blocked, not given the relation's definition. The
	// glossary gloss fills the null branch only — c3 still wins outright.
	const gloss =
		c3 ?? (relation === "support" ? GLOSSARY.support : GLOSSARY.counter);
	return (
		<InfoTip content={gloss} asChild>
			<button
				type="button"
				data-testid={`card-trigger-${relation}`}
				disabled={disabled}
				aria-disabled={disabled}
				aria-label={
					c3 ??
					`${relation === "support" ? "Support" : "Counter"} — bet ${resultingSide}`
				}
				onClick={() => onReply(relation)}
				className={cn(
					// ⚠ MERGE (MOBILE-2c ← main): main's #523 geometry, with MOBILE-2b's
					// two phone tokens re-appended. #523 replaced `px-3 py-1` with
					// `w-[78px] h-6 flex items-center justify-center`; ours added a
					// 44px tap-target floor and `touch-action: manipulation` below
					// 640px.
					// ⚠⚠ MOBILE-2e · R-M2 — THE 44px FLOOR IS NO LONGER THE PILL'S OWN
					// HEIGHT, AND THAT IS THE POINT OF THIS REFINEMENT. `min-h-11` grew
					// the PAINTED box to 44px while the split track beside it stayed in
					// its `h-6` alignment box, so the three Đ figures — each the second
					// child of its own column — stopped sharing a line: the two flanks
					// sat 20px below the centre one. Measured on the shipped build at
					// 360/375/390/430.
					// ⇒ The pill is sized at the RULED 32px and the tap area is bought
					// back by a transparent `::after` inset 6px above and below, which
					// is exactly 44 on a 32px box. A pseudo-element is the right
					// instrument here rather than a handler: it extends the element's
					// own hit region at the hit-testing layer, so nothing listens,
					// nothing is prevented, and the phone gesture wall is untouched.
					// ⚠ It needs `relative` to position against, and it must stay
					// INSIDE the card's 12px gutter — `<Card>` is `overflow-hidden` and
					// a clipped region is not hit-testable, so an extension wider than
					// the padding would silently buy no tap area at all.
					// ⛔⛔ AND IT IS ASYMMETRIC — 8px UP, 4px DOWN — which is the whole
					// of the second thought. A symmetric 6/6 also sums to 44, and it
					// reached 2px PAST the top edge of the `Đ n` figure four pixels
					// below (the flank column's `gap-1`), so a tap on that figure fired
					// Support or Counter and opened a reply composer ON A SIDE the
					// reader never chose. Above the pill there is the card's own 10px
					// `gap-2.5` and nothing in it; below there is a figure at 4px. So
					// the extension takes what is free and stops exactly where the
					// figure starts: 8 + 32 + 4 = 44, and the region ends on the seam
					// rather than across it. `@security-auditor`, LOW.
					// ⚠ MOBILE-2n · R-3 — THE UPWARD 8px NOW REACHES EXACTLY TO THE CARD'S
					// GAP, BECAUSE A10 D-3 REMOVED THE 10px THE BAND HELD ABOVE IT. Two
					// variants and two figures: `PostCard`'s present branch is `gap-2.5`
					// (10px), so the extension still stops 2px short of the content above;
					// its REMOVED branch is `gap-2` (8px), where the extension ends exactly
					// on the seam. Nothing interactive sits in either gap, so this is a
					// clearance note rather than a defect — but the paragraph above named
					// one variant and there are two. `@code-reviewer`, LOW.
					"w-[78px] h-6 flex items-center justify-center rounded-(--r-chip) text-xs font-bold transition-all hover:shadow-(--state-hover-glow-pole) focus-visible:shadow-(--state-focus-ring) active:shadow-(--state-pressed-glow-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) max-mobile:relative max-mobile:h-8 max-mobile:text-[13px] max-mobile:font-semibold max-mobile:[touch-action:manipulation] max-mobile:after:absolute max-mobile:after:inset-x-0 max-mobile:after:-top-2 max-mobile:after:-bottom-1 max-mobile:after:content-['']",
					pole,
				)}
			>
				{relation === "support" ? "Support" : "Counter"}
			</button>
		</InfoTip>
	);
}
