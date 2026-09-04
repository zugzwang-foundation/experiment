import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";
import type { PricePoint } from "@/server/discovery/price-series";

import {
	hasRenderableSeries,
	MarketPriceChartHost,
} from "./chart/MarketPriceChartHost";
import {
	COMPACT_FROM_MARKET_TOTAL,
	dharmaExactHint,
	formatDharmaCompact,
} from "./format";
import { HeadZone } from "./HeadZone";
import { MarketMediaPanel } from "./MarketMediaPanel";
import { PriceBar } from "./PriceBar";
import { ResolverCards } from "./ResolverCards";
import type { DebateMarketHeader, Side } from "./types";

const TERMINAL: ReadonlySet<string> = new Set([
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
]);

/**
 * PD-3-08 — the count and its noun agree: `1 post`, never `1 posts`. Zero is
 * PLURAL (`0 replies`). Mirrors the shipped reference implementation in
 * `src/components/discovery/StatLine.tsx`, which is file-private there and so
 * cannot be imported without widening that module's surface.
 */
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Append an abbreviated figure's exact value to a gloss, or return the gloss
 * untouched when there is nothing hidden to reveal (UI-FOLLOWUP A).
 *
 * ⚠ THE `null` ARM IS THE POINT. `dharmaExactHint` returns `null` below the
 * threshold, where the compact and exact spellings are the SAME string — and a
 * gloss ending "this market: Đ 435" beside a figure already reading `Đ 435` is
 * the redundant affordance UI-OVERNIGHT entry 1a took care not to build.
 */
const joinGloss = (gloss: string, hint: string | null) =>
	hint === null ? gloss : `${gloss}. This market: ${hint}`;

/**
 * `.attrs .sep` (`d5:502`) — the middle dot between the three stat fields:
 * `color:var(--n3)`, normal weight against the bold figures, `margin:0 6px`.
 * `aria-hidden` for the same reason `ArgProfile`'s `Sep` carries it.
 */
function AttrSep() {
	return (
		<span aria-hidden="true" className="mx-1.5 font-normal text-n3">
			·
		</span>
	);
}

/**
 * INFO-1 — one gloss per real lifecycle state. `Draft` has no entry: it is
 * excluded upstream (`getMarketBySlug` never returns a Draft market to this
 * surface), and adding an invented "not yet open" gloss for a state this
 * component can never actually receive would be a definition nobody
 * ratified.
 */
const LIFECYCLE_GLOSS: Record<
	Exclude<DebateMarketHeader["status"], "Draft">,
	string
> = {
	Open: GLOSSARY.lifecycleOpen,
	Closed: GLOSSARY.lifecycleClosed,
	Resolving: GLOSSARY.lifecycleResolving,
	Resolved: GLOSSARY.lifecycleResolved,
	Voided: GLOSSARY.lifecycleVoided,
	Frozen: GLOSSARY.lifecycleFrozen,
};

/**
 * The market lifecycle / resolution marker (INV-4 / design-language §3.1). A
 * terminal market (Closed/Resolving/Resolved/Voided/Frozen) reads as locked —
 * "read-only" — paired with the literal status (never colour alone, §8).
 */
function LifecycleBadge({ status }: { status: DebateMarketHeader["status"] }) {
	const terminal = TERMINAL.has(status);
	const badge = (
		<Badge
			variant={terminal ? "secondary" : "outline"}
			aria-label={`Market ${status}${terminal ? ", read-only" : ""}`}
		>
			{status}
			{terminal ? " · read-only" : ""}
		</Badge>
	);
	// Structurally unreachable (see LIFECYCLE_GLOSS above) — kept as a guard
	// rather than an unsafe cast, so an admitted-but-impossible type stays
	// admitted rather than asserted away.
	if (status === "Draft") {
		return badge;
	}
	return (
		<InfoTip content={LIFECYCLE_GLOSS[status]} asChild>
			{badge}
		</InfoTip>
	);
}

/**
 * The market-view header (DEBATE.4 §4): question = `markets.title` · lifecycle
 * marker · the price bar (`getPrices`) · the attrs (Đ staked · posts · replies).
 * ⚠ THIS LINE USED TO NAME `resolution criterion = markets.description
 * (R-14.4)` AS A THING THIS HEADER RENDERS. It no longer does — RESO-1 · R-2
 * removed the excerpt. ⚠ AND THE SENTENCE THAT REPLACED IT — "`description`
 * reaches the participant only through the ADR-0025 `.md` export" — WAS TRUE FOR
 * EXACTLY ONE TASK. CRIT-1 restores the criterion to `/m/[slug]` as a collapsed
 * native disclosure mounted in `DebateView`, so it reaches the participant on the
 * page again; it is simply no longer THIS component's row. Corrected here rather
 * than left as a docblock describing a state that has moved on (doctrine §6.2) —
 * and corrected with some feeling, because this very sentence exists BECAUSE
 * RESO-1 fixed a docblock naming a row that had left the file. Leaving it stale
 * would have reproduced, one revision later, the failure it was written to end. Composes into the
 * SHELL `(public)/layout.tsx` shell; the placeholder global header is left
 * untouched (superseded at UI.13). ⚠ The deferred D1 placeholder box was
 * REMOVED at POLISH.3 (PD-3-09 / OD-6) — it rendered a build-time note about
 * unbuilt work to every participant. The record that market media and resolver
 * cards are still unbuilt survives at `docs/polish/POLISH-0.md` §3 and
 * `docs/parked.md`'s `MEDIA.2-GOLIVE`; the carousel itself is MEDIA.2's.
 *
 * HTML-FINISH · MARKET DETAIL row 1 — THIS IS THE HEADZONE'S MARKET ARM, and it
 * is now rendered INSIDE the market↔post ternary rather than above it. Every
 * element below is a `vm` element in the mockup (`.question` · `.attrs` ·
 * `.rescards` · `.graph` · `.barrow f`); the post arm's `vp` set is
 * `PostFocusHeader`'s. The two are disjoint and they SWAP — see `HeadZone.tsx`.
 * ⚠ `.criterion` LEFT THIS LIST AT RESO-1 · R-2. It is still a `vm` element in
 * the mockup — d5 is unchanged — but it is no longer one this component
 * renders, and a list of "every element below" that names one that is not below
 * is the kind of faithfully-carried-forward falsehood doctrine §6.2 is about.
 *
 * ⇒ CONSEQUENCE, DECLARED: the lifecycle marker and the `.md` export (labelled
 * `AI mode` since AIMODE-1; `Download .md` before it) become
 * MARKET-ARM ONLY, exactly like every other `vm` element beside them. ⛔ Neither
 * is DELETED — row 9 is a reverse delta the founder has not ruled, and OD-3
 * keeps all five. The ADR-0025 export stays reachable and the INV-4 read-only
 * marker stays rendered wherever the market itself is the subject; in post-focus
 * the reader's market context is the row-17 market card, one click from exit.
 */
export function MarketHeader({
	market,
	priceChart,
	pick,
}: {
	market: DebateMarketHeader;
	priceChart: { series: PricePoint[] } | null;
	/**
	 * HTML-FINISH · MARKET DETAIL round 2 · R7 (row 8) — the rail bar's clickable
	 * percent labels. Threaded straight through to `PriceBar`; this component
	 * neither derives nor gates it, because the viewer state it carries is
	 * `DebateView`'s and duplicating the F-3 gate here would be a second place for
	 * it to drift. See `PriceBar` for why the handler and the gate travel as one
	 * object.
	 */
	pick?: {
		heldSide: Side | null;
		marketOpen: boolean;
		suspended: boolean;
		onPick: (side: Side) => void;
	};
}) {
	return (
		<HeadZone
			// HTML-FINISH · MARKET DETAIL row 4 — THE PRICE CHART IS THE RAIL'S
			// content, and since RESO-1 it is the rail's ONLY content. The chart used
			// to render in the left column between the criterion and the price bar,
			// which put the market's shape INSIDE the reading column instead of
			// beside it; that move stands.
			// ⚠ THE SENTENCE "the mockup's `.hright` holds exactly `.graph` +
			// `.barrow f` in the market arm (`d5:1007`, `:1037`)" USED TO STAND HERE
			// AS THIS PROP'S JUSTIFICATION. It is still true OF d5 and is no longer
			// true of this build: R-4 moves `.barrow` out. Recorded rather than
			// deleted, because the divergence from the mockup is deliberate and a
			// later reader comparing the two should find it named.
			// ⚠ `null` WHEN THE SERIES READ FAILED is the pre-existing contract, not
			// a new one: a null `priceChart` is non-fatal and the rest of the header
			// stands. `MarketPriceChartHost` itself also returns null for an empty
			// series, so both null paths agree.
			// ⛔⛔ RESO-1 · R-4 — THE RAIL IS THE CHART, AND NOTHING ELSE. The price
			// bar has moved into the reading column (see `left`), and the rail
			// returns to `null` when there is no chart to put in it.
			//
			// ⚠⚠ THE `null` IS NOT TIDINESS — IT IS THE DEFECT R-4 WOULD OTHERWISE
			// CREATE, AND IT IS MEASURED. This prop used to be a FRAGMENT, which is
			// never `null`, and the block that stood here said so in terms: "THE RAIL
			// IS NOW ALWAYS RENDERED on the market arm: `PriceBar` returns its
			// 'Pricing unavailable' stub rather than null, so there is no market-arm
			// state with an empty rail." That sentence was true only because the bar
			// was in here. Take the bar out and leave the fragment, and every market
			// with no chart renders a 340px column containing nothing — which is
			// `PD-3-09` / `OD-6` verbatim, the ruling that deleted the deferred-work
			// placeholder box from this very component.
			// ⇒ AND IT IS NOT HYPOTHETICAL. Measured at RESO-1 recon against the base
			// build: `market-price-chart-card` renders on ZERO of the eight staging
			// markets — the fixtures are raw-INSERT rather than event-backed, so the
			// price series is empty and `MarketPriceChartHost` returns null for all of
			// them. On today's data the fragment version of this prop would have
			// shipped an empty rail on EVERY market, not an edge case.
			// ⚠ This restores the contract `HeadZone`'s own docblock describes ("A
			// consumer with no rail content passes `null` and the surface is one
			// column"), which the bar's arrival had quietly suspended.
			//
			// ⛔⛔ AND THE CONDITION IS `series.length`, NOT `priceChart != null` —
			// THE FIRST VERSION OF THIS LINE TESTED THE WRONG NULL AND SHIPPED THE
			// EXACT DEFECT THE PARAGRAPH ABOVE EXISTS TO PREVENT. Measured on the
			// deployed RESO-1 preview at `38213de`: `headzone-right` present,
			// 340×188, `innerHTML === ""` — an empty column on EVERY market.
			// ⇒ THE MECHANISM, because it is subtle and it will recur. `priceChart`
			// is NOT null on a market with no price history — the read model returns
			// `{ series: [] }`, which is TRUTHY. The emptiness is decided
			// one level DOWN, inside `MarketPriceChartHost`, which returns `null` for
			// an empty series. So `priceChart ? <Host/> : null` hands `HeadZone` a
			// non-null React element that renders NOTHING, and `HeadZone` — correctly,
			// by its own contract — draws the column around it.
			// ⇒ THE RAIL'S CONDITION IS NOW LITERALLY THE HOST'S OWN CONDITION —
			// `hasRenderableSeries`, exported from the host for exactly this, so the
			// two cannot drift. It was a HAND-COPY of that test first; @code-reviewer
			// flagged that a second null path in the host would re-open the defect,
			// and a copied condition is a proxy
			// for it. Two components deciding "is there a chart?" by DIFFERENT tests
			// is what produced the gap; the fix is to ask the same question, not to
			// ask a different question more carefully.
			// ⚠ AND THE UNIT GUARD COULD NOT SEE IT. It rendered `priceChart={null}`,
			// a shape production never produces, so it was green throughout.
			// `market-header.test.tsx` now also exercises `{ series: [] }`.
			// ⚠ THE SHAPE LOST ITS `nodes` AT CHART-NODE-REMOVE AND THE LESSON DID
			// NOT: `{ series: [] }` is still truthy, so the condition is still
			// `hasRenderableSeries(...)` and never `priceChart != null`.
			right={
				priceChart && hasRenderableSeries(priceChart.series) ? (
					<MarketPriceChartHost
						series={priceChart.series}
						// C-CHART-2 clause 1 (CHART-2) — the terminal pulse. READ
						// from the market's own status, never assumed: this is the
						// ONE surface where a non-`Open` market renders a chart at
						// all (Discovery lists only `Open` ones), so it is the one
						// place the frozen branch is reachable. A pulse on a
						// `Closed`, `Resolving`, `Resolved` or `Voided` market
						// asserts it is live, which is false where stake is
						// committed and runs at INV-4 — the same reason
						// `withLiveTail` reads `market.status` here and nowhere else.
						isOpen={market.status === "Open"}
					/>
				) : null
			}
			left={
				/* HTML-FINISH · MARKET DETAIL row 2 — `.hleft` IS A ROW (`d5:448`),
				   holding `.mmedia` then `.hstack`. The market arm's media panel takes
				   the same slot the post arm gives the focused post's image, so the two
				   arms swap contents inside one identical frame.
				   ⚠⚠ BLOCK-3 — `items-start` ON THIS ROW WAS TRIED AND REVERTED, MEASURED
				   WRONG, NOT REASONED WRONG. The panel now derives its height from a
				   THIRD of the row's width (`aspect-[16/9] w-1/3`, `MarketMediaPanel.tsx`)
				   instead of `h-full`, so it no longer needs `align-items:stretch` to get
				   its size — but `headzone-stack` DOES: its `flex-1` growth into
				   whatever height the band leaves over (R-8's whole mechanism, and the
				   reason the block row can absorb freed height at all) DEPENDS on being
				   stretched to the row's height by the row's `align-items`. Setting the
				   ROW to `items-start` un-stretches BOTH children, and `headzone-stack`
				   is not supposed to be one of them. Measured: with `items-start` here,
				   `headzone-stack` read the SAME 176px at both 1440×900 and 1440×777,
				   where its band is 217.8px and 188px respectively — the extra height
				   was going nowhere. The fix is on the ONE child that actually needs it
				   — see `MarketMediaPanel.tsx`'s `self-start`. */
				<div className="flex min-h-0 flex-1 gap-4">
					<MarketMediaPanel
						imageUrl={market.mediaImageUrl}
						videoUrl={market.mediaVideoUrl}
						title={market.title}
					/>
					{/* `.hstack` (`d5:462`) — everything that is not the media.
					    ⚠ `min-h-0` is this node's link in the one-screen chain: without
					    it the stack refuses to shrink below its content and pushes the
					    declared band taller.

					    ⚠⚠ `overflow-y-auto` IS AN ACCOMMODATION Q-1 FORCED, AND IT IS
					    REPORTED RATHER THAN ABSORBED. This stack ALREADY overflowed its
					    own band before Q-1: measured on staging at `c13aa54`,
					    `scrollHeight` 197 against `clientHeight` 188, so the resolver
					    cards were spilling 9px PAST the headzone and over the arena
					    beneath it. I did not catch that in the parity pass — the phase-1
					    table measured each region's own box and never asked whether the
					    children summed to the parent.
					    ⇒ Q-1 adds a row, which widens that spill. The containment is the
					    mechanism ALREADY RULED for this surface one component over
					    (`DebateColumn`'s `.colwrap`, `d5:568`): the page never scrolls,
					    and anything that does not fit scrolls INSIDE its own region.
					    Nothing is clipped and nothing is deleted — the marker, the
					    export and all FOUR resolution blocks stay reachable (they were two
					    resolver cards until RESO-1 · R-7).
					    ⚠ THE PARAGRAPH THAT STOOD HERE IS SUPERSEDED BY RESO-1 AND IS KEPT
					    AS THE RECORD. It read: "`ResolverCards` is sized to d5's `.rescard`
					    (71.8px -> 56.3px) and this stack's gap drops from 12px to 5px, so
					    the content fits the band AT REST and the `overflow-y-auto` above
					    stops firing — it stays as the backstop for a long criterion, which
					    is what it was for." ⇒ The block row is no longer sized to `.rescard`
					    at all (R-8 makes it `flex-1`, measured 111.99px), and it cannot be
					    a backstop "for a long criterion" because R-2 removed the criterion.
					    ⇒ WHAT `overflow-y-auto` IS FOR NOW: the block row carries a MEASURED
					    content floor (`min-h-[97px]`, see `ResolverCards.tsx`), so below a
					    viewport height of ~715px the stack's content exceeds the band and
					    THIS is what scrolls. Without that floor the row absorbed every
					    shortfall by shrinking and each block clipped in silence — which is
					    what shipped for one commit, and what @code-reviewer caught.

					    ⛔⛔ 5px IS NOT d5's GAP, AND THE ARITHMETIC THAT JUSTIFIED IT IS
					    RE-DERIVED AT RESO-1 — the superseded version is recorded because
					    the NUMBER did not move and the REASON did. It read: d5 spaces this
					    stack 8 / 12 / 10 = 30px across THREE gaps; Q-1 added a FOURTH child
					    (the lifecycle marker + `.md` export row); content sums to 167.1px
					    before gaps in a 188px band, so the budget is 20.9px across FOUR
					    gaps, and 5px was the largest uniform gap that fits.
					    ⇒ EVERY TERM OF THAT IS NOW FALSE. R-3 merged the marker row INTO
					    the attrs row, so the fourth child is gone; R-1/R-2 removed the
					    criterion, so `.criterion` is not in this stack at all; and R-7's
					    row is `flex-1`, so it has no fixed height to sum.
					    ⇒ THE STACK IS NOW `h1 · mergedRow · priceBar · blockRow` — FOUR
					    children, THREE gaps. Measured on the deployed preview at 1440x777:
					    26.04 + 20 + 15 + 3x5 = 76.04px of fixed content and gaps, and the
					    block row takes the remaining 111.99px of the 188.03px band.
					    ⇒ 5px SURVIVES AS A COMPOSITION CHOICE, not as the output of a
					    budget: the row that grows is the block row, so these gaps no longer
					    compete with anything for space. Kept because changing it would be a
					    spacing change nobody ruled, not because 20.9px still divides by
					    four.

					    ⛔⛔ BLOCK-4 §3 — 5px IS RULED, AND IT IS `gap-5` (20px). The
					    sentence directly above is the one this change answers: 5px survived
					    three tasks purely because nobody had ruled on it, and the founder
					    has now looked at the result and ruled it cramped. THE RHYTHM WAS
					    ALSO UNEVEN, which the arbitrary value hid — `ResolverCards` carried
					    its own `mt-4` on top of this gap, so the three stacked elements the
					    §3 brief names read 5px / 5px / **21px**: question→stats 5,
					    stats→bar 5, bar→blocks 21. Dropping that `mt-4` (see
					    `ResolverCards.tsx`) and moving this to `gap-5` makes all three
					    gaps 20px — measured 5/5/21 → 20/20/20 at 1440×900.
					    ⚠ `gap-5` IS NOT A NEW TOKEN AND NOT AN ARBITRARY VALUE. It is
					    d5's own `.headzone{gap:20px}` (`:447`), already shipping one level
					    up on `HeadZone`'s band as the gap between this column and the chart
					    rail. The stack's vertical rhythm and the band's horizontal one are
					    now the same number, which is a composition argument rather than a
					    coincidence — and it replaces a bracket value that belonged to no
					    scale at all.
					    ⚠ WHAT PAYS FOR IT: BLOCK-4 §2 stops the block row absorbing the
					    band's leftover (it was 122.76px at 1440×900 for 53.25px of
					    content), so the 45px these gaps gain is drawn from a row that was
					    only ever holding air. The band, the arena and the media panel are
					    all untouched by this. */}
					<div
						data-testid="headzone-stack"
						className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto"
					>
						{/* `.question` (`d5:463`) — `font-size:21px;font-weight:700;
							    line-height:1.24`, and SINGLE LINE with an ellipsis
							    (`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
							    ruled at D5-02 / v0.9: "Market title → single line (no wrap;
							    ellipsis if it ever overflows)"). The shipped heading was
							    20px / 600 with `tracking-tight`, i.e. lighter, smaller and
							    NEGATIVELY tracked where the mockup is heavier and neutral.
							    ⚠⚠ THE TRUNCATION IS A REAL COST AND IT IS REPORTED, NOT
							    SMOOTHED OVER: at a narrow viewport a long question is cut
							    with no in-place way to read the rest. `title` carries the
							    full string for pointer users and the accessible name is
							    unaffected (the text node is whole in the DOM); the ADR-0025
							    `.md` export carries it in full. 
							    ⚠ ITS STATED GROUND CHANGED AT RESO-1; THE TRUNCATION DID NOT.
							    This read "This follows the founder's own adoption of
							    `.crittext`'s 2-line clamp one block down — the two rulings
							    would otherwise contradict each other." R-2 removed that clamp,
							    so the coherence argument now cites a sibling ruling that is
							    gone. The truncation stands on its own original ground instead —
							    D5-02 / v0.9 ruled the market title to a single line with an
							    ellipsis — and that ruling is untouched by RESO-1. Recorded
							    rather than quietly re-justified. */}
						{/* ⚠ `min-w-0 flex-1` — `.question` (`d5:463`) is a BLOCK filling
							    `.hstack`, and `truncate` only ellipsises what it is given. As a
							    shrink-to-fit flex item beside the badge cluster the heading
							    measured 501px against d5's 674px at the pinned 1440×777
							    (−12.0pp), so it truncated far earlier than the mockup does and
							    left the row's spare width unused. */}
						{/* ⛔⛔ `shrink-0` IS LOAD-BEARING AND ITS ABSENCE MADE THE QUESTION
						    INVISIBLE. Measured on staging at `6190a90`: the `<h1>` rendered
						    698px wide and **0px TALL**. `truncate` carries `overflow:hidden`,
						    which sets this item's automatic minimum size to 0 — so once Q-1's
						    extra row pushed the stack's content (203px) past its band (174px),
						    flex-shrink squeezed the ONE child that could be squeezed down to
						    nothing. Every sibling survived at full height because
						    `overflow:visible` leaves their automatic minimum at their content.
						    ⇒ The market question, the most important text on the surface, was
						    gone. `shrink-0` makes the stack absorb its overflow by SCROLLING,
						    which is what `overflow-y-auto` above is for, instead of by
						    crushing whichever child happens to be crushable.
						    ⚠ A class-string reading could not have found this: every class
						    involved was correct in isolation. It took a box measurement in a
						    browser. */}
						<h1
							title={market.title}
							className="shrink-0 truncate text-[21px] leading-[1.24] font-bold tracking-normal"
						>
							{market.title}
						</h1>
						{/* HTML-FINISH · MARKET DETAIL row 6 — THE ATTRS STRIP SITS DIRECTLY
					    UNDER THE QUESTION. The mockup's `.hstack` orders its `vm` children
					    `.question` -> `.attrs` -> `.criterion` -> `.rescards`
					    (`d5:958-985`); this strip used to render LAST, below the chart and
					    the price bar.
					    ⚠ THIS BLOCK USED TO READ "…SITS BETWEEN THE QUESTION AND THE
					    CRITERION … the criterion — the terms of the bet — is the thing you
					    read last and most carefully." Both clauses died with RESO-1 · R-2:
					    there is no criterion in this stack, so the strip sits between the
					    question and the price bar. Reading order is still the substance of
					    the row — the market's size is context for the question — but the
					    thing you read last is now the block row, not the terms.
					    ⛔ ORDER ONLY. The strip's own composition is untouched: the same
					    three spans, the same `flex flex-wrap` container, the same spaced
					    `Đ ` grammar and the same PD-3-08 plural rule, all still pinned by
					    `market-header.test.tsx`. `.attrs`'s bold numerals and `·`
					    separators are a different row's subject and are not taken here. */}
						{/* ⚠ `.attrs` (`d5:500-502`) — `font-size:12px;font-weight:700;
						    color:var(--ink)`, its three fields joined by a `.sep` middle dot
						    (`color:var(--n3);font-weight:400;margin:0 6px`). The shipped
						    strip was `text-muted-foreground` at normal weight with the
						    fields merely SPACED, so `Đ 1,681 staked 4 posts 1 reply` ran
						    together as one grey sentence.
						    ⛔ THE `·` IS THE MOCKUP'S OWN GLYPH (U+00B7), and it is
						    `aria-hidden` for the reason `ArgProfile`'s `Sep` already
						    states: it is punctuation, and announcing it between every
						    field makes the row unlistenable.
						    ⚠ THE PD-3-08 PLURAL RULE IS UNTOUCHED — same `noun()`, same
						    three fields, same order. Only weight, colour and the
						    separators change. */}
						{/* ⚠⚠ RESO-1 · R-3 — THE META LINE AND THE ACTIONS ARE NOW ONE ROW,
						    AND Q-1's RULING IS NARROWED RATHER THAN REVERSED. Q-1 moved the
						    lifecycle marker and the `.md` export OFF the question's row,
						    founder-ruled, because as `shrink-0` siblings of the `<h1>` they
						    took 146px of it — the heading measured 528px against d5's 674px
						    at the pinned 1440×777, the last region outside ±2pp and the only
						    one whose cause was build-only chrome rather than geometry.
						    ⇒ THAT REASON IS ABOUT THE QUESTION'S ROW, AND IT STILL HOLDS:
						    they do not go back beside the `<h1>`. They join the ATTRS row,
						    which is a short fixed-length strip with spare width to the right
						    of it, so nothing here is competing with the heading for space.
						    The row this vacates is what R-8's taller blocks absorb.

						    ⛔ `ml-auto` IS THE RIGHT-ALIGNMENT, NOT `justify-between`. The
						    two are identical when both children are present and diverge
						    when one is not: `justify-between` on a single surviving child
						    pins it LEFT, so a future state with no actions would silently
						    move the meta line nowhere and a future state with no meta line
						    would slam the actions to the left edge. `ml-auto` on the actions
						    means "as far right as there is room", which is the declaration
						    the row actually wants and holds in both degenerate cases.

						    ⚠ `items-center` — R-3 says vertically centred against the meta
						    line, and the two are DIFFERENT HEIGHTS: the attrs strip measured
						    16px and the badge row 20px, so the row's height is the badge's
						    and the text must centre inside it rather than sit on its top
						    edge. Baseline alignment would look right only while both happen
						    to share a font size.

						    ⚠ NEITHER ELEMENT'S OWN COMPOSITION CHANGES — same `AttrSep`
						    glyphs, same PD-3-08 plural rule, same `LifecycleBadge`, same
						    anchor with its `download` attribute and accessible name. Only
						    the two containers merge into one. `market-header.test.tsx`
						    asserts both by text and role rather than by position, so those
						    guards read this unchanged. */}
						<div className="flex items-center gap-3">
							{/* ⚠ `min-w-0` — this is the row's flexible child now, and without
							    it a long attrs strip sets the row's automatic minimum and
							    pushes the actions off the right edge instead of wrapping.
							    ⚠⚠ BLOCK-3 §2 — `text-xs` (12px) → `text-[13px]`, this task's
							    share of the space `ResolverCards.tsx` no longer needs (the
							    "stats line" in the §2 brief). The row's own height still
							    tracks `LifecycleBadge`'s fixed `h-5` (20px, `ui/badge.tsx`) —
							    a shared shadcn primitive, left untouched rather than resized
							    for one call site — so this bump reads as denser, more legible
							    figures within the SAME row height, not a taller row. */}
							<div className="flex min-w-0 flex-wrap items-center gap-y-1 text-[13px] font-bold text-ink">
								{/* ⚠⚠ UI-FOLLOWUP A — THE EXACT FIGURE RIDES THE GLOSS RATHER THAN A
								    SECOND TOOLTIP, AND THAT IS THE ONE THING THIS SITE DOES DIFFERENTLY
								    FROM `StatLine` AND `FocusMarketCard`. Both of those hang the exact
								    value on the NUMBER, because the number is a free element there. Here
								    the whole `Đ … staked` phrase is ALREADY an `InfoTip` host, so a second
								    tip inside it would NEST two info affordances on one run of text: a
								    hover over the number opens the inner tip and — the event bubbling to
								    the outer trigger — the gloss on top of it. Two popups, one anchor, at
								    every market past a thousand Đ.
								    ⇒ ONE AFFORDANCE CARRYING BOTH FACTS. A reader who opens it wanted to
								    know what `staked` counts or what `34.4k` hides, and gets either.
								    ⛔ THE PHRASE STAYS ONE CONTIGUOUS TEXT RUN — no child element is
								    introduced, which is what keeps `market-header.test.tsx`'s five
								    `getByText("Đ 150 staked")` DOM-walk anchors and its two `innerHTML`
								    ordering assertions matching. Splitting it would have reddened them for
								    a reason unrelated to anything they guard. */}
								<InfoTip
									content={joinGloss(
										GLOSSARY.stakedMarket,
										dharmaExactHint(
											market.totals.dharmaStaked,
											COMPACT_FROM_MARKET_TOTAL,
										),
									)}
									asChild
								>
									<span>
										Đ{" "}
										{formatDharmaCompact(
											market.totals.dharmaStaked,
											COMPACT_FROM_MARKET_TOTAL,
										)}{" "}
										staked
									</span>
								</InfoTip>
								<AttrSep />
								<span>
									{market.totals.postCount}{" "}
									{noun(market.totals.postCount, "post", "posts")}
								</span>
								<AttrSep />
								<span>
									{market.totals.replyCount}{" "}
									{noun(market.totals.replyCount, "reply", "replies")}
								</span>
							</div>
							{/* `shrink-0` — the actions are fixed-content chrome; the meta line
							    is what gives way when the row runs out of width. */}
							<div className="ml-auto flex shrink-0 items-center gap-2">
								<LifecycleBadge status={market.status} />
								{/* EXPORT.1 — native download of the debate `.md` (server-mediated
								    GET); plain anchor, no client boundary, works signed-out.
								    ⛔ IT STAYS AN `<a>`, AND AIMODE-1 DID NOT CHANGE THAT. The
								    brief said "rendered as a button, not a text link" — which is
								    a statement about APPEARANCE, and is satisfied by
								    `buttonVariants`. The two halves are separable: it stops being
								    a text LINK, it does not stop being an anchor.
								    
								    ⚠ AN EARLIER DRAFT JUSTIFIED THIS BY SAYING A `<button>` WOULD
								    INTRODUCE "a client boundary in a server component". ⛔ THAT WAS
								    FALSE and is corrected here rather than quietly dropped, because
								    a right answer resting on a wrong mechanism is the thing that
								    gets copied. THIS COMPONENT IS ALREADY CLIENT-SIDE: its sole
								    importer is `DebateView.tsx`, which is `"use client"` and hands
								    it `pick.onPick` — a FUNCTION prop, which only passes
								    client→client. There is no boundary here to cross.
								    ⇒ The real grounds, which do hold: an anchor is what FETCHES A
								    RESOURCE, and `download` is a native attribute of one. A button
								    would have to re-implement the download in JS — and would then
								    do it WORSE, because this way it still works before hydration
								    and with JS off. AT hearing "link" is also simply true of it.
								    Same shape as `composer/SlotHeader.tsx`, where `buttonVariants`
								    supplies the look and a `Link` keeps the behaviour.

								    ⚠ GEOMETRY IS PINNED TO `LifecycleBadge`, ITS ROW-NEIGHBOUR,
								    and the two overrides are what pin it. `size="xs"` is h-6 with
								    a ~10px radius; the badge beside it is `h-5 rounded-4xl`
								    (`ui/badge.tsx`). Left at `xs` this control would set the
								    row's height instead of the badge, growing it 4px — and the
								    note at the top of this row records that the row tracks the
								    badge's fixed `h-5`, inside a `basis-[24.2dvh] overflow-hidden`
								    band whose interior budget is already fully allocated. So the
								    override is a height CONTRACT with the element beside it, not
								    a nudge: `h-5 rounded-4xl` reproduces the badge's box exactly
								    (h-5 · gap-1 · rounded-4xl · px-2 · text-xs · svg size-3) and
								    the row's height delta is zero.

								    ⚠ `variant="outline"` NAMES a bordered pill; it does NOT buy
								    de-emphasis. `default` and `outline` are byte-identical in
								    `buttonVariants` — the one-button system (values-log §3 item 3
								    / R-6). Anyone reaching here to make this "quieter" by
								    swapping the variant will change nothing; the lighter
								    treatments are `ghost` and `secondary`, and picking one is a
								    design ruling, not an edit.

								    ⛔⛔ THE ACCESSIBLE NAME IS NOT THE VISIBLE LABEL, AND THE
								    DIFFERENCE IS THE WHOLE FIX. Visible: the ratified two words.
								    Accessible: those words, an em dash, then a short statement
								    that a Markdown file downloads. Both halves are
								    founder-ratified — the name at AIMODE-1, the suffix at its
								    addendum (OQ-1) — and the suffix exists because of what is
								    measured below.

								    An earlier draft of THIS BLOCK said the download "reaches AT
								    as a DESCRIPTION" via `aria-describedby`. ⛔ IT DOES NOT, on
								    the branch that matters. MEASURED, not read: while the tip is
								    CLOSED, `aria-describedby` on this anchor resolves to `null`
								    — the Popover mounts its content only when open, while
								    `InfoTip` sets the attribute unconditionally, so the id
								    DANGLES and the gloss is not in the document at all. The touch
								    branch is the DEFAULT for every unknown, including anything
								    without `matchMedia`.
								    ⇒ Pointer/desktop was never the problem — Radix's Tooltip
								    renders a `VisuallyHidden` copy and opens on FOCUS, so a
								    keyboard user meets the gloss. On TOUCH the only way to open
								    the description is to activate the control, which also starts
								    the download. A touch AT user therefore got a name that names
								    no file and no indication that one arrives — a WCAG 2.4.4
								    (Link Purpose, Level A) regression against the pre-AIMODE-1
								    label, which said so outright.
								    ⇒ CLOSED HERE, in the one place that reaches every branch:
								    the name itself. Purpose carried in the attribute needs no tip
								    to open, no pointer to hover and no id to resolve. The
								    ratified label stays the PREFIX, so the visible words remain a
								    leading substring of the accessible name and a speech-input
								    user can still say them (WCAG 2.5.3, Label in Name).
								    ⚠ This block still NAMES the string rather than quoting it in
								    attribute syntax, and the restraint outlived its first reason.
								    That reason — an unshipped literal here is the one a
								    source-scan guard would match — is discharged; the string
								    ships. What replaces it is the mirror: a second copy in a
								    comment can drift from the JSX silently, and the guards that
								    own this claim read the rendered DOM, so they would never see
								    the drift. Six recorded instances in this repo.

								    ⚠ TARGET SIZE, the other cost of matching the badge. `h-5`
								    is 20px against WCAG 2.5.8 (AA)'s 24px floor — and `size=xs`
								    alone would have been 24px exactly. The Spacing exception
								    most likely carries it (the badge is the nearest target, a
								    `gap-2` away), but the geometry match was ratified knowing
								    this rather than in ignorance of it. */}
								<InfoTip content={GLOSSARY.downloadMd} asChild>
									<a
										download
										href={`/m/${market.slug}/export`}
										aria-label="AI mode — download this debate as Markdown"
										className={cn(
											buttonVariants({ variant: "outline", size: "xs" }),
											"h-5 rounded-4xl",
										)}
									>
										{/* Bare, like the two sibling call sites (`ArgProfile`,
										    `DownloadStub`). The glyph IS hidden from AT — lucide
										    adds `aria-hidden="true"` itself — but it does so
										    CONDITIONALLY: `!children && !hasA11yProp(rest)`
										    (`lucide-react@1.14.0` `dist/esm/Icon.mjs:36`, read, not
										    assumed). So passing it here would be redundant, and —
										    the part worth knowing — passing any OTHER a11y prop
										    later SILENTLY REVOKES the default and un-hides the
										    glyph. That is a vendor contract, so it is pinned as one
										    in `market-header.test.tsx` rather than restated here as
										    a prop that only looks like it is doing the work. */}
										<Download />
										AI mode
									</a>
								</InfoTip>
							</div>
						</div>
						{/* ⛔⛔ RESO-1 · R-1 + R-2 — THE `RESOLUTION` SECTION LABEL AND THE
						    CLAMPED CRITERION EXCERPT ARE GONE, AND THE RULING THAT PUT THEM
						    HERE IS SUPERSEDED IN PLACE RATHER THAN LEFT STANDING (O-4).
						    What stood here was `.criterion` (`d5:974-977`) — a top hairline
						    rule, an `.overline` reading `Resolution`, and a `line-clamp-2`
						    `<p>` holding `market.description`. Its own block recorded the
						    2026-08-16 founder ruling that ADOPTED that clamp, over three
						    earlier grounds for refusing it.

						    ⇒ RESO-1 removes both. The section label sat above blocks that
						    carry their own labels, so it named a section twice; and a
						    two-line excerpt of the bet's terms is not a reading of them —
						    it is an advertisement for a document you cannot open here,
						    which is what made the clamp contentious in the first place.
						    The block row below now carries a `Resolution` block of its own,
						    which marks the slot without pretending to show the text.

						    ⚠⚠ THE COST IS REAL, IT IS LARGER THAN THE ROW IT REMOVES, AND
						    IT IS THE FOUNDER'S TO WEIGH — NOT THIS TASK'S. Measured at
						    RESO-1 recon: `market.description` rendered in EXACTLY ONE place
						    on `/m/[slug]`, and it was this `<p>`. Removing it left the
						    pre-registered public resolution criterion with NO on-page
						    presence on this surface at all.
						    ✅ THAT COST IS NOW DISCHARGED, AND THE RULING CAME BACK. The
						    founder ruled the criterion returns COLLAPSED, and CRIT-1 ships
						    it: a native `<details>` disclosure, closed by default, carrying
						    the complete untransformed text, mounted in `DebateView` as a
						    sibling of the arena. So the sentence that stood here — "not
						    clamped, not collapsed, absent" — named three states, and the
						    middle one is what the surface now has.
						    ⛔ DO NOT "restore" it HERE, and that half is UNCHANGED. The
						    criterion's home is the disclosure below the band, not this
						    header: the band is `shrink-0 basis-[24.2dvh]` and its interior
						    budget is fully allocated, so anything re-added inside this stack
						    comes straight back out of the four-block row. Re-adding it here
						    would also give the surface TWO copies of the binding text.
						    ⚠ What is discharged is the measure-and-report deferral, not the
						    fence. See `docs/plans/CRIT-1.md`.
						    ⚠ NO CLAMP SURVIVES THIS REMOVAL. `line-clamp-2` was a class on
						    the element itself, not a shared helper, so it leaves with it —
						    there is no orphaned clamp and no prop that existed only to feed
						    one (`description` stays on `DebateMarketHeader` because the
						    TYPE MIRRORS THE READ MODEL, which is the real reason — the
						    ADR-0025 export reads its OWN server model in
						    `server/debate-export/serialize.ts`, not this view model.
						    ⚠ THE CLAUSE THAT FOLLOWED — "after R-2 no view component reads
						    the field at all, so it crosses the RSC boundary unrendered" —
						    IS NO LONGER TRUE: CRIT-1's `CriterionDisclosure`, mounted in
						    `DebateView`, reads it. The field stopped being a dead wire and
						    became load-bearing, which is exactly why keeping it on the type
						    was right). */}
						{/* ⛔⛔ RESO-1 · R-4 — THE PRICE BAR NOW LIVES HERE, IN THE READING
						    COLUMN, DIRECTLY ABOVE THE BLOCK ROW. It was the rail's second
						    occupant, under the chart, on the argument that "the bar and the
						    chart above it read the SAME price, so standing them in one
						    column is what lets a reader check one against the other."
						    ⇒ That argument assumed there WAS a chart to check against.
						    Measured at RESO-1 recon: there is one on none of the eight
						    markets, so in practice the bar was a 15px strip alone at the top
						    of a 188px column with 173px of empty ground beneath it. Moving
						    it into the reading column puts the price next to the market's
						    own text, and gives the chart the whole rail on the day a market
						    has a series to draw.

						    ⚠ MOVING THE CALL SITE IS NOT MOVING THE COMPONENT, and the
						    distinction is why no extraction was needed here. `PriceBar` IS
						    shared — Discovery's `MarketCard` and `HeroPanels` render it, as
						    does the post arm's `FocusMarketCard` — but they render `card`
						    and `hero`. `size="detail"` has exactly ONE call site in the
						    repo and it is this line, so relocating this element reaches no
						    other surface. Measured, not assumed: four call sites, one
						    `detail`.

						    ⚠ THE `pick` GATE TRAVELS UNCHANGED. Same object, same three
						    conditions, same handler — a relocation that dropped `pick` would
						    silently turn the live percent labels back into plain text, which
						    reads as a styling regression rather than the lost affordance it
						    would be. */}
						<PriceBar pricing={market.pricing} size="detail" pick={pick} />
						{/* RESO-1 · R-7 — `.rescards` (`d5:986`) is now the FOUR-block row
						    and the LAST child of `.hstack`, directly under the price bar
						    R-4 moved in above it. It used to sit after the criterion; the
						    criterion is gone, so "after the criterion" is corrected here
						    rather than left describing a neighbour that no longer exists.
						    ⛔ The blocks still carry NO market data — see `ResolverCards.tsx`
						    for why that half did not reverse. */}
						<ResolverCards market={market} />
					</div>
				</div>
			}
		/>
	);
}
