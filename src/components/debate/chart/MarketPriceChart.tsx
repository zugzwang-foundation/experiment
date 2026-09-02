"use client";

import {
	MARKET_CHART_AXIS_ANCHORS,
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

import { formatPricePercent } from "../format";
import {
	axisAnchorsFor,
	type ChartMode,
	fmtUtcDay,
	type Gridline,
	gridlinesFor,
	hasEndValue,
	labelLeftPct,
	labelTopPct,
	SVG_W,
	TERMINAL_DOT_R,
	TERMINAL_PULSE_MAX_R,
	terminalLabelYs,
	VIEWBOX_H,
	VIEWBOX_W,
	xPx,
	yNoPx,
	yYesPx,
} from "./geometry";

/**
 * The three surfaces this one component renders (CHART-1, SPEC.1 1.0.45 §9/§22).
 *
 * `hero` is the Discovery hero, which until CHART-1 rendered a DIFFERENT
 * component — `PriceSparkline`, index-spaced and `aria-hidden`. Index spacing
 * draws twenty bets in an hour identically to twenty bets across three weeks,
 * which was defensible while the hero was a decorative thumbnail beside a card
 * sparkline. It stopped being one when HTML-FINISH · DISCOVERY deleted the card
 * sparkline and left the hero as Discovery's ONLY price graph. It is time-scaled
 * here for the same reason §9 gave for market detail: on a surface a reader uses
 * to judge whether a market has already moved, chronology *is* the information.
 *
 * `hero` renders lines, terminals, the same Y scale the expanded overlay carries
 * (CHART-6) and — since CHART-7 — the same calendar X axis (RF-4). Those are two
 * different
 * questions and this sentence used to answer them with one number: it said the
 * hero "is a third of the height of the collapsed card", which is false. Measured
 * on the shipped build at 1440, the hero's chart box is **418.75 px** against the
 * collapsed card's **193.80** and the overlay's **382.25** — it is the TALLEST of
 * the three. ⚠ THAT OVERLAY FIGURE IS PRE-CHART-6 and the margin moved: deleting
 * the label gutter returns 48.73 px of width to the overlay's plot, and its
 * aspect lock turns width into height, so the overlay measures **406.91** after
 * this change and the hero leads by **11.84 px**, not 36.5. The comparison the
 * CHART-5 claim needed is against the number that existed when it was made; the
 * comparison a reader makes today is against the other one. Both are stated
 * because quoting either alone is the hybrid-number defect this file records
 * twice. The 96 px everyone had been quoting is `min-h-24`, the layout FLOOR
 * `HeroPanels` sets before `flex-1` grows it.
 *
 * ⛔ THE TIME AXIS USED TO STAY OFF AND THE FOUNDER HAS RULED IT ON (CHART-7,
 * RF-4). This paragraph read: *"three date labels along the bottom of a carousel
 * panel a reader flicks past are noise rather than orientation, and Discovery's
 * job is to say whether a market has moved, not when."* It named its own ground
 * correctly — a presentational choice inside canon's jurisdiction, not a spec pin,
 * with §22 and C-CHART-2 both stopping at "same component, same derivation" — and
 * that is exactly the kind of choice a founder ruling reverses. RF-4's table names
 * `expanded` **and** `hero`; the canon text it ratifies reads *"plus `Oct 1` on
 * the wider modes"*.
 * ⚠ AND THE ANCHORS ARE WHAT MAKE IT CHEAP. The objection was to labels that vary
 * per market and therefore have to be read; three fixed calendar dates, identical
 * on every panel of the carousel, are frame rather than content — a reader learns
 * them once and then reads position against them. That is not the element the
 * paragraph above was arguing against.
 *
 * ⚠ ALIASED TO `geometry.ts`'s `ChartMode` AT CHART-5 RATHER THAN RESTATED. The
 * Y scale is a pure function of the mode, so `geometry` needed the union too —
 * and two structurally-identical unions in two files are two places for a fourth
 * surface to be added to only one of. The exported NAME is unchanged, because
 * other modules import it.
 */
export type MarketPriceChartMode = ChartMode;

/** The market-detail price-chart SVG (SPEC.1 1.0.48 §9 / F-DEBATE-5) — two
 * complementary YES/NO probability lines mirrored about 50 % (design-language
 * §3.2), fixed Y 0–100 %, X spanning **the fixed experiment window**
 * (`MARKET_CHART_WINDOW_START` → `_END`), identical for every market.
 *
 * ⚠ THAT LAST CLAUSE READ "X spanning the market lifetime" UNTIL CHART-3, and
 * it is corrected rather than annotated. The lifetime domain gave every market
 * its own axis, so two charts could not be compared — which is what a reader
 * most wants to do when all eight markets resolve at the same instant.
 *
 * ⚠⚠ COLLAPSED NOW CARRIES A TIME AXIS — two interior ticks and three date
 * labels — and this sentence used to read "COLLAPSED renders the two lines only
 * (no axis, no nodes)". SPEC.1 1.0.32 reverses that pin at all four of its
 * operative sites (§9 :490, F-DEBATE-5 System :515 and Acceptance :517, §17
 * :1260): the collapsed card was specified without an axis when it was a
 * sparkline, and it is now the market's primary price surface in the header
 * rail, where a price series without a time axis is not readable. ⛔ COLLAPSED
 * STILL RENDERS NO NODES — only the axis half moved.
 * ⛔⛔ AND AT CHART-7 THE AXIS STOPPED NAMING THE WINDOW AT ALL (RF-4, founder
 * ruling D20(b)/D21(b)). This sentence read *"EXPANDED is UNTOUCHED: the two X
 * endpoint labels — the WINDOW's endpoints since CHART-3"*, which was true through
 * CHART-6 and is not now. **Every mode labels the same three calendar instants** —
 * `MARKET_CHART_AXIS_ANCHORS`, of which the collapsed card draws the first and
 * last — so two markets on two environments carry the same dates even though their
 * windows differ. An anchor outside the configured window is not drawn. Interior
 * ticks on the OVERLAY remain canon-owned and unbuilt; the collapsed card's two
 * dashed rules are shipped and now follow the interior anchors.
 * The SVG is `aria-hidden` on ALL THREE surfaces
 * and the accessible readout lives in the shared `ChartSummary` beside it —
 * collapsed card, expanded overlay and, since CHART-1, the Discovery hero. ⚠ It
 * used to say "the card's `sr-only` summary", naming one surface of three and a
 * home the sentence no longer has. ⚠ SPEC.1 1.0.45 §9 says this chart is "not
 * `aria-hidden` on any surface"; that is a claim about the CHART, not this
 * ELEMENT — a screen reader cannot read a polyline, so announcing the graphic
 * means announcing the summary next to it. The attribute below and that sentence
 * are about different things; this note exists because the next reader will grep
 * the attribute and find them in apparent conflict. Strokes bind by the
 * `--graph-yes` / `--graph-no` token NAME (INV-3 side binding, never the slot
 * value; `--color-yes` = the ground, so a value-copy would be invisible AND
 * invert the poles). No raw hex.
 * ⛔ THE POST NODES ARE GONE FROM EVERY SURFACE (CHART-NODE-REMOVE, founder
 * ruling). This paragraph used to end: "Slice 2: EXPANDED also marks the
 * per-`(UTC day, side)` top-post `nodes` … Collapsed never renders nodes." There
 * are no nodes on any mode now, so the collapsed exemption has nothing left to
 * except and is removed with the thing it excepted. **The only circles this
 * component draws are the two terminal dots and, on an `Open` market, their two
 * pulse rings** — `r=3`, rimless, each on its own series token. */
export function MarketPriceChart({
	series,
	mode,
	isOpen,
}: {
	series: PricePoint[];
	mode: MarketPriceChartMode;
	/**
	 * `C-CHART-2` clause 1 (CHART-2) — whether the terminal dots pulse.
	 *
	 * ⛔ REQUIRED, NEVER DEFAULTED, and for the reason `ChartSummary.testId` is:
	 * a default would let a caller get this wrong by omission, and the wrong
	 * value here is a **frozen market advertising itself as live** (INV-4). It
	 * is READ from `market.status` on `/m/[slug]` and is the licensed `true`
	 * literal on Discovery, which lists only `Open` markets — the same
	 * asymmetry, from the same two call sites, that `withLiveTail` already
	 * carries. **Never inferred from the series' shape**: a quiet `Open` market
	 * and a `Closed` one look identical from the data.
	 */
	isOpen: boolean;
}): React.JSX.Element {
	// ⛔ THE AXIS IS FIXED AND THE LINE IS NOT (SPEC.1 1.0.48 §9, founder-ruled
	// at CHART-3). These two used to be `series[0].at` and `series[last].at` —
	// the market's own lifetime — which meant no two markets shared an axis and
	// therefore no two charts could be compared. All eight resolve at one
	// instant, so a shared window is what makes them readable side by side.
	//
	// ⚠ The SERIES is untouched by this. It still ends where the data ends —
	// at `now` on an `Open` market (`withLiveTail`) and at the last event
	// otherwise (**INV-4**) — so a market that has traded for one week of a
	// seven-week window draws a line across the left portion of a wide chart.
	// That is the true picture of a young market. Extending it to the axis end
	// would assert a price at an instant that has not happened.
	//
	// ⚠ A point BEYOND `MARKET_CHART_WINDOW_END` is clipped by the viewBox and
	// is deliberately NOT clamped onto the right edge: clamping would draw the
	// live price at the wrong instant, which this codebase rejects twice in
	// writing (`price-series.ts` `withLiveTail`, `price-chart.ts`
	// `deriveMarketPriceChart`). Reachable on staging after its window end; the
	// fix is to move the constant, not the geometry.
	//
	// ⛔ AND THE CLIP TAKES MORE THAN THE LINE'S TAIL — this comment used to stop
	// at "clipped", which reads as cosmetic. `terminalX` below follows the
	// series, so once the last point is past the window BOTH terminal dots and
	// BOTH pulses leave the canvas, while `TerminalLabels` keeps rendering in its
	// HTML gutter: two colour-coded words naming two marks that are not there.
	// Stated at full strength because a diagnosis that undersells its own symptom
	// is how the symptom gets triaged as a style bug.
	const startMs = Date.parse(MARKET_CHART_WINDOW_START);
	const endMs = Date.parse(MARKET_CHART_WINDOW_END);

	// The terminal YES price — the ONE value both the dots and the HTML labels
	// read, so the two can never disagree about where the series ends. The
	// degenerate branch is `buildLine`'s: see `TerminalMarkers` for why it reads
	// the FIRST point rather than the last when the domain collapses.
	const terminalYes =
		series.length === 0
			? null
			: series.length < 2 || endMs === startMs
				? series[0].yes
				: series[series.length - 1].yes;

	// ⛔ THE TERMINAL X, AND WHY IT SUDDENLY NEEDS TO EXIST. `TerminalMarkers`
	// hard-coded `cx = VIEWBOX_W`, which was not a shortcut: while the domain
	// ended at the last point, the line's end WAS the right edge, so the two were
	// the same number and the dot could not be wrong.
	//
	// The fixed axis separates them. A market that has traded for one week of a
	// seven-week window ends its line a seventh of the way across, and a dot left
	// at `VIEWBOX_W` would hang in empty space at the far right, attached to
	// nothing — on every market, for most of the experiment, with the pulse
	// advertising a live price at a coordinate carrying no line. The dots mark
	// where the lines END, so they follow the lines.
	//
	// ⛔ THE DEGENERATE ARM USED TO KEEP `VIEWBOX_W`, AND IT HAD TO MOVE IN THE
	// SAME COMMIT AS `buildLine`. Both answer one question — "where does the
	// drawn line stop?" — so the moment D9 stopped the sparse flat line at its
	// own instant, a dot still pinned to the right edge would hang in empty space
	// attached to nothing. That is the identical defect the ≥2-point arm below
	// was written to fix, and leaving this arm behind would have re-opened it for
	// the one market shape nobody looks at.
	//
	// ⚠ WITH THAT ARM GONE THE CONDITION COLLAPSES ENTIRELY, and the collapse is
	// the tell that the special case was never real: for a single-point series
	// `series[series.length - 1]` IS `series[0]`, and a degenerate domain sends
	// `xPx` to 0 by its own `endMs === startMs` guard. So one expression now
	// covers every non-empty series. The empty case keeps `VIEWBOX_W` because
	// nothing renders there — `terminalYes` is null and the markers are skipped.
	const terminalX =
		series.length === 0
			? VIEWBOX_W
			: xPx(series[series.length - 1].at, startMs, endMs);

	// The Y scale (CHART-5). A LOOKUP, not a computation — the frozen per-mode
	// sets are built once at module load in `geometry.ts`, so this line costs one
	// property read per render and cannot vary with the data.
	const grid = gridlinesFor(mode);

	return (
		/* ⛔ THE LABELS ARE HTML AND NOT SVG `<text>`, AND THAT IS THE HALF OF THE
		   CHART-2 FIX THAT SURVIVES (`C-CHART-2` clause 2). A `<text>` inside the
		   `<svg>` is scaled by `preserveAspectRatio="none"` along with everything
		   else, and the scale is DIFFERENT on each of the three surfaces and varies
		   with viewport and carousel position besides — so the same declared 10px
		   rendered 4.28px on the collapsed card. Nothing applied inside that space
		   can be right at more than one size. Out here, 10px is 10px.

		   ⛔⛔ THE OTHER HALF IS GONE AND THIS COMMENT USED TO BE IT. It read "THE
		   FRAME IS A FLEX ROW, AND THAT IS THE WHOLE LABEL FIX … Left cell: the
		   plot. Right cell: an HTML gutter the viewBox cannot reach." **There is no
		   right cell holding labels since CHART-6.** A gutter beside the plot can
		   only give a label the plot's HEIGHT, and an x anchored to it is an x
		   anchored to the plot's right EDGE — which is where the terminal dot sits
		   on exactly one market shape. The labels are an overlay INSIDE the plot box
		   now (`:relative` below, `absolute inset-0` in `TerminalLabels`), because
		   that box shares BOTH dimensions with the viewBox. Corrected in place
		   rather than annotated: two adjacent comments giving incompatible accounts
		   of one mechanism is the `O-5` shape inside a single file, and
		   `@code-reviewer` filed this as the largest missed docblock of the task.

		   ⚠ THE ROW REMAINS, and still earns `items-stretch`: the numeric marks
		   column is a real flex cell whose percentage tops resolve against its own
		   height. The labels no longer depend on it.
		   ⚠ IT IS THREE CELLS SINCE CHART-7, NOT TWO — `[marks | plot | reserve]`.
		   RF-1 moved the marks to the LEADING cell and RF-5 added a trailing RESERVE
		   the traveling end labels overflow into. Both are `shrink-0`; the plot is
		   the only cell that grows, which is what `alignment-chain.test.tsx` pins.
		   The LABEL layer is still not among them and must never be: it is an
		   overlay sharing the plot's box, and putting it back in flow narrows the
		   plot and moves every rendered coordinate in the product.
		   ⚠ The labels are RETURNED FROM THIS COMPONENT rather than left for each
		   caller to place — the `ProfileChart` precedent (PROFILE OVERLAP R2),
		   which moved its endpoint labels out of its `<svg>` the same way. A
		   component-scoped query still finds them, which is the property that
		   makes them guardable; a sibling of the component would not be. */
		<div
			data-testid="market-price-chart-frame"
			data-mode={mode}
			className={
				mode === "expanded"
					? "flex w-full items-stretch"
					: "flex h-full w-full items-stretch"
			}
		>
			{grid.length > 0 && <YMarks marks={grid} />}
			<div
				data-testid="market-price-chart-plot"
				/* ⛔ `relative` IS NOT DECORATION — IT IS THE LABELS' CONTAINING BLOCK,
				   and since CHART-6 that is this box rather than a gutter beside it
				   (`C-CHART-2` clause 2 as amended). The labels resolve BOTH their
				   `top` and their `left` as percentages of this element, which is the
				   same box `preserveAspectRatio="none"` stretches the viewBox onto —
				   so a label lands on its dot in both axes by construction rather than
				   by a number that agrees at one size. Without it the percentages
				   resolve against the nearest positioned ancestor, which on `/m/[slug]`
				   is somewhere up in the page shell. */
				className="relative min-w-0 flex-1"
				/* ⛔ THE CONTAINER/VIEWBOX LOCK — `C-CHART-1` clause 4 as amended at
				   CHART-2, and the reason this task exists. The expanded overlay is
				   the ONE mode whose box is declared rather than inherited, so it is
				   the one mode that can be locked. It used to declare `aspect-[2/1]`
				   against a 640×320 viewBox — exactly uniform — and CHART-1 widened
				   the viewBox to 678×320 without touching it, dropping anisotropy to
				   0.94395 where no guard was looking, because every guard asserts in
				   user units and the defect exists only in CSS pixels.
				   ⛔ IT IS DERIVED, NOT RESTATED. `aspect-[649/320]` would be the
				   same defect with a newer number; this reads the two constants the
				   viewBox itself is built from, so the ratio cannot fall out of step
				   with the box it is meant to match. `tests/unit/debate/chart/
				   container-viewbox-lock.test.tsx` asserts the two are equal.
				   ⚠ COLLAPSED AND HERO GET NO LOCK, DELIBERATELY. Their boxes are
				   `flex-1`/`min-h-24` inside a rail and a carousel panel — functions
				   of viewport and content, not declared shapes. Pinning an aspect to
				   either would be inventing a constraint the layout does not have.
				   What makes THEM correct is the label move above, not a lock. */
				style={
					mode === "expanded"
						? { aspectRatio: `${SVG_W} / ${VIEWBOX_H}` }
						: undefined
				}
			>
				<svg
					data-testid="market-price-chart"
					// CHART-1 — which of the three surfaces this render is. The hero's
					// retired `PriceSparkline` carried `data-size`, and two hero tests
					// selected on it; keeping a mode attribute means a guard can still
					// name the surface it is asserting about without reaching for a
					// styling class to identify the thing under test (OVN-V5).
					data-mode={mode}
					// C-CHART-2 clause 3 (CHART-2) — the viewBox is the PLOT plus a DOT
					// ALLOWANCE, and nothing else. The end labels used to live in a 38-unit
					// gutter here; they are HTML beside the plot now, so all that remains is
					// the units the terminal circle needs not to half-clip at the plot's
					// right edge. ⚠ CORRECTED AT CHART-5, TWICE OVER: this said "the 4
					// units" and `TERMINAL_DOT_ALLOWANCE` is **9** — sized to the pulse
					// RING at 2.4×, not the dot, and `geometry.ts` says "the allowance
					// goes 4 → 9" three lines from the constant this comment describes.
					// It also said the circle sits at `cx = VIEWBOX_W`, the sentence
					// CHART-3 falsified and CHART-5 corrected one file over while
					// leaving it standing here, in `src/`, on the attribute it describes.
					// Still ADDED to the viewBox rather than taken out of the
					// plot, so every plotted coordinate — and every guard asserting one — is
					// exactly where it has always been; only the addition shrank, 38 → 9.
					viewBox={`0 0 ${SVG_W} ${VIEWBOX_H}`}
					preserveAspectRatio="none"
					aria-hidden="true"
					className="h-full w-full"
				>
					{/* ✅ COLLAPSED — THE TIME TICKS (SPEC.1 1.0.32, HTML-FINISH · MARKET
			    DETAIL round 2 · R8), and NOTHING ELSE. They are drawn FIRST, so the
			    two price lines paint OVER them — gridlines behind data, which is the
			    order `ProfileChart` uses too, so the axes stack their layers the same
			    way.

			    ⛔⛔ EIGHTY LINES STOOD HERE AND ARE DELETED RATHER THAN ANNOTATED,
			    BECAUSE CHART-7 MADE EVERY ONE OF THEM MOOT. They argued three things:
			    that the axis belongs INSIDE the `<svg>` (against porting d5's
			    absolutely-positioned divs, which is exactly what `AxisDates` now is);
			    that its date labels are "the ONLY TEXT IN THIS `<svg>` THAT IS
			    DISTORTED" (there is no text in this `<svg>` at all any more); and some
			    fifty lines of anisotropy arithmetic about a declared 10px label
			    rendering at 4.28px, which was the measurement that finally moved it
			    out. What survives of the argument is one sentence, and it is the one
			    worth keeping: **a tick is geometry in the plot's own domain and stays
			    here; type is not, and left.**

			    ⚠ THE SCOPING HAZARD THE DELETED BLOCK EXISTED TO GUARD IS STILL REAL
			    and is answered elsewhere. Its point was that a DOM sibling of this
			    component carries none of its testids, so
			    `price-chart.test.tsx::collapsed-renders-no-axis` would pass against an
			    axis built outside it. `AxisDates` is RETURNED FROM THIS COMPONENT —
			    the `ProfileChart` / PROFILE OVERLAP R2 answer — so a component-scoped
			    query still finds it, and `collapsed-renders-the-time-axis` asserts
			    exactly that containment against the chart FRAME rather than the
			    `<svg>`.
			    ⚠ Deleted rather than left standing because two adjacent comments
			    giving incompatible accounts of one mechanism is the `O-5` shape inside
			    a single file — which this file's own frame docblock names, and which
			    `@code-reviewer` filed here again at the CHART-7 cascade. */}
					{/* ⛔ THE Y SCALE, AND IT IS DRAWN FIRST — before the x-axis, before the
					    lines, before every mark — so the series paints over it. Gridlines
					    behind data is the order `CollapsedAxis` and `ProfileChart` already
					    use; a grid on top of a polyline reads as the polyline being
					    dashed.
					    ⚠ THE SET IS A PURE FUNCTION OF THE MODE, resolved once at module
					    load in `gridlinesFor` — never per point and never per render. The
					    data cannot reach it: a gridline marks a position on a FIXED 0–100 %
					    scale, so unlike the x-axis it has no domain to consult.
					    ⛔ THE STROKE IS `--color-n2`, WHICH IS THE STEP THE X TICKS
					    ALREADY USE, and matching it is the reason rather than a
					    coincidence: two axes on one plot drawn at two different weights
					    read as two systems, one of which looks like it means more. It is an
					    EXISTING ramp step — no token is minted, which the 11-token census
					    (`tokens-monochrome.test.ts`) enforces as a correctness guard.
					    ⚠ DOTTED `1 3` WHERE THE X TICKS ARE DASHED `5 4` — same colour,
					    different rhythm, so the two directions stay distinguishable at a
					    glance without spending a second tone on the difference. */}
					{grid.length > 0 && (
						<g
							data-testid="chart-gridlines"
							stroke="var(--color-n2)"
							strokeWidth="1"
							strokeDasharray="1 3"
						>
							{grid.map((g) => (
								<line
									key={g.pct}
									data-pct={g.pct}
									x1={0}
									x2={VIEWBOX_W}
									y1={g.y}
									y2={g.y}
									// ⛔ ON THE LINE, NEVER ON THE `<g>` — AND IT WAS ON THE `<g>`
									// UNTIL `@code-reviewer` CAUGHT IT. `vector-effect` is NOT an
									// inherited property and does not apply to container
									// elements, so a `<g>`-level declaration is silently
									// discarded while `stroke`, `stroke-width` and
									// `stroke-dasharray` beside it inherit normally and work.
									// The result was a group that looked correctly configured
									// and rendered at the WRONG WEIGHT: a horizontal rule's
									// stroke is vertical, so `scaleY 0.4282` on the collapsed
									// card drew these at ≈0.43 CSS px beside an x-axis tick at a
									// true 1px — three surfaces, three weights, and the grid
									// fainter than the ticks on the market's primary price
									// display. Which is precisely the outcome this group's own
									// docblock claims to prevent. Every other call site in this
									// file already puts it on the shape element.
									vectorEffect="non-scaling-stroke"
								/>
							))}
						</g>
					)}
					{mode === "collapsed" && (
						<CollapsedTicks series={series} startMs={startMs} endMs={endMs} />
					)}

					{/* ⛔ THE DATE LABELS ARE NOT HERE ANY MORE — THEY ARE HTML, BELOW THE
					    `</svg>` (CHART-7, RF-3). They were the LAST text left inside this
					    stretched space, and this block used to hold the expanded overlay's
					    two endpoint labels while `CollapsedAxis` held the card's three.
					    Both moved for `C-CHART-2` clause 2's original reason, applied to
					    the one element that had never taken it: `preserveAspectRatio="none"`
					    scales user space non-uniformly and per surface, so ONE declared size
					    rendered a **7.70 px** box on the collapsed card and a **16.00 px**
					    box on the expanded overlay — measured, in the shipped face, on the
					    unchanged tree. RF-3 asks for the dates to be made bigger and checked
					    against the marks' 10 px, and no declared value inside this viewBox
					    can satisfy that on more than one surface at a time.
					    ⚠ WHAT DID NOT MOVE IS THE TICK, and the split is deliberate: a tick
					    is GEOMETRY — a rule at an x in the plot's own domain — and belongs
					    in the space that owns that domain. Only the TYPE had a reason to
					    leave. */}
					<polyline
						data-testid="line-no"
						points={buildLine(series, startMs, endMs, yNoPx)}
						fill="none"
						stroke="var(--graph-no)"
						strokeWidth="1.75"
						strokeLinejoin="round"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					<polyline
						data-testid="line-yes"
						points={buildLine(series, startMs, endMs, yYesPx)}
						fill="none"
						stroke="var(--graph-yes)"
						strokeWidth="1.75"
						strokeLinejoin="round"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>

					{/* ⛔ THE POST NODES STOOD HERE AND ARE REMOVED (CHART-NODE-REMOVE,
			    founder ruling): one `r=4` circle per `(UTC day, side)` bucket, filled
			    by the post's frozen side token and rimmed in `--color-ground` to
			    separate it from its same-token line, drawn on the expanded overlay
			    only.

			    ⛔ THE RIM IS WHAT THE GUARD NOW BANS, AND IT IS THE RIGHT HANDLE
			    BECAUSE IT WAS NEVER SHARED. The terminal marks below are rimless by
			    ruling (`C-CHART-2` clause 1 — "with no rim", deliberately distinct
			    from the node's `r=4` and its 1.5px rim), so "no circle carries a
			    `--color-ground` rim" separates the thing removed from the thing kept
			    without naming either by testid. A guard written on `graph-node-` would
			    pass against a node re-added under any other name.

			    ⚠ WHAT LEFT WITH IT, upward: the `nodes` prop through
			    `MarketPriceChartHost` and `MarketPriceChartOverlay`, the
			    `priceChart.nodes` field on the view model, and — the part a
			    render-only delete would have missed — `selectChartNodes` and
			    `reservesAt` in `price-chart.ts`, which would otherwise have gone on
			    walking `topOrder` and pricing a bucket per post on every read. */}
					{/* C-CHART-2 clauses 1 and 7 — EVERY MODE, INCLUDING THE HERO. Each line
			    ends in a rimless r=3 dot on its own series token, and on an `Open`
			    market a ring of the same token pulses out of it.
			    ⚠ THE NAMES USED TO BE HERE AND ARE NOT ANY MORE (clause 2, CHART-2).
			    They render as HTML in `TerminalLabels`, outside this `<svg>`, because
			    `preserveAspectRatio="none"` stretched them by a factor that differs
			    per surface and per viewport. What stayed is what must: a dot marks a
			    PRICE, so it has to sit exactly where that price is, in the same
			    stretched space as the line it terminates.
			    ⛔ THE TOKEN IS THE POINT, NOT DECORATION — and it is why the ruling's
			    word "grey" is not taken literally. A neutral mark on the NO line is a
			    pole rendered off its own token (INV-3). It binds by TOKEN NAME
			    (`--graph-yes` / `--graph-no`), never the `--color-*` slot: the repo
			    aliases `--color-yes` to the page ground, so a value-copy would render
			    the YES mark invisible AND invert the poles. It reads grey anyway —
			    `--graph-yes` IS grey (#737373), and a `--graph-no` (#fafafa) ring at
			    low alpha over `--color-ground` (#181818) reads grey.
			    ⚠ The DOTS sit at the lines' true y. Only the LABELS may be displaced,
			    and only when they would collide — that whole rule lives in
			    `terminalLabelYs`, not here. */}
					{/* ⚠ THE DEGENERATE CASE READS THE SAME POINT THE LINE DOES. `buildLine`
			    draws a flat line at `series[0].yes` when the domain collapses
			    (`length < 2`, or every point sharing one instant), while the terminal
			    normally reads the LAST point. Those differ only if two or more events
			    share a timestamp to the microsecond — remote, but the consequence is
			    that the dots would sit off their own line, which is the one thing a
			    terminal marker must never do. Raised by `@code-reviewer` at the
			    CHART-1 cascade. */}
					{terminalYes !== null && (
						<TerminalMarkers yes={terminalYes} cx={terminalX} isOpen={isOpen} />
					)}
				</svg>
				{/* ⛔ INSIDE THE PLOT BOX, NOT BESIDE IT — CHART-6. The labels are still
				    HTML and still outside the `<svg>`, so `10px` is still 10px on every
				    surface (clause 2's original reason is untouched). What changed is
				    which box their percentages resolve against: a gutter could only
				    give them a HEIGHT to share with the plot, and an x anchored to a
				    gutter is an x anchored to the plot's right EDGE — which is where
				    the dot sits only on a market that has traded to the window end. */}
				{terminalYes !== null && (
					<TerminalLabels
						yes={terminalYes}
						mode={mode}
						terminalX={terminalX}
						// ⛔ THE SAME EXPRESSION `AxisDates` GATES ON, NOT A COARSER ONE.
						// This read `drawsTimeAxis(...)`, which answers "may this mode draw
						// an axis" — while the ROW additionally requires an anchor inside
						// the window. Under a window containing none, `drawsTimeAxis` is
						// still true, so the clamp reserved a band beneath a row that does
						// not exist: the very case this prop's own docblock says it avoids.
						// `drawsTimeAxis`'s docblock names the rule that leaked — "the two
						// halves of one axis must not be able to disagree" — and the band is
						// a THIRD consumer of that question. Caught by `@code-reviewer`.
						bandPx={
							axisDatesFor(mode, series, startMs, endMs).length > 0
								? AXIS_DATE_BAND_PX
								: 0
						}
					/>
				)}
				{/* ⛔ INSIDE THE PLOT BOX FOR `TerminalLabels`' REASON EXACTLY (CHART-7).
				    A date label's x is a position in the plot's own domain, so it has to
				    resolve against the same rectangle `preserveAspectRatio="none"`
				    stretches the viewBox onto — which is this box and not a strip
				    beneath it. `labelLeftPct` is CHART-6's own conversion, reused rather
				    than re-derived, so the date and the tick it names cannot come to
				    disagree about where that x is. */}
				<AxisDates
					mode={mode}
					series={series}
					startMs={startMs}
					endMs={endMs}
				/>
			</div>
			<LabelReserve mode={mode} />
		</div>
	);
}

/**
 * The two line ends, INSIDE the plot: a dot at each line's true terminal y, and
 * — on an `Open` market only — a ring pulsing out of it (`C-CHART-2` clauses 1
 * and 7). The NAMES are not here; they are HTML, in `TerminalLabels` below.
 *
 * Takes the terminal YES price ALONE, because NO is its complement by
 * construction (design-language §3.2) — the same reason the whole chart is fed
 * one series. Passing both would mint a second place for the poles to disagree.
 *
 * ⛔ THE RING IS DRAWN BEFORE THE DOT so the solid dot paints over it and stays
 * crisp at its own radius. It shares the dot's `cx`/`cy`/`r` exactly, so it
 * expands FROM the dot rather than from somewhere near it.
 *
 * ⚠ `fillOpacity` IS THE "LOW OPACITY" OF THE RULING; the animation's own
 * `opacity` 1 → 0.2 is canon clause 7's ratified live-indicator value. They are
 * two different properties doing two different jobs — the first sets how present
 * the ring ever is, the second is the breath — and multiplying rather than
 * conflating them is what lets the motion values stay byte-identical to the
 * radio's while the mark stays a faint ring rather than a second dot.
 */
function TerminalMarkers({
	yes,
	cx,
	isOpen,
}: {
	yes: string;
	/** Where the drawn line ENDS — `xPx` of the series' last point, in EVERY
	 * non-empty case. ⚠ This used to read "or `VIEWBOX_W` on the full-width
	 * degenerate line"; CHART-4 D9 stopped that line at its own instant, so
	 * there is no longer a case where the line ends anywhere but its last point.
	 * ⛔ REQUIRED, NEVER DEFAULTED: a default would be `VIEWBOX_W`, which is
	 * exactly the wrong answer under the CHART-3 fixed axis and would be wrong
	 * SILENTLY, since a dot at the right edge looks deliberate. */
	cx: number;
	isOpen: boolean;
}): React.JSX.Element {
	const yNo = yNoPx(yes);
	const yYes = yYesPx(yes);
	return (
		<>
			{isOpen && (
				<>
					<circle
						data-testid="terminal-pulse-no"
						cx={cx}
						cy={yNo}
						r={TERMINAL_DOT_R}
						fill="var(--graph-no)"
						fillOpacity={0.35}
						className="chart-terminal-pulse"
					/>
					<circle
						data-testid="terminal-pulse-yes"
						cx={cx}
						cy={yYes}
						r={TERMINAL_DOT_R}
						fill="var(--graph-yes)"
						fillOpacity={0.35}
						className="chart-terminal-pulse"
					/>
				</>
			)}
			<circle
				data-testid="terminal-dot-no"
				cx={cx}
				cy={yNo}
				r={TERMINAL_DOT_R}
				fill="var(--graph-no)"
			/>
			<circle
				data-testid="terminal-dot-yes"
				cx={cx}
				cy={yYes}
				r={TERMINAL_DOT_R}
				fill="var(--graph-yes)"
			/>
		</>
	);
}

/**
 * The two end labels — HTML text layered OVER the plot, outside the `<svg>`, so
 * `10px` is 10px on every surface at every width (`C-CHART-2` clause 2 as amended
 * at CHART-2 and again at CHART-6).
 *
 * ⛔ BOTH COORDINATES ARE NOW PERCENTAGES OF THE PLOT BOX, AND THAT IS THE WHOLE
 * ALIGNMENT CONTRACT. `preserveAspectRatio="none"` maps the viewBox onto the plot
 * box's full width AND full height, whatever those turn out to be — so a fraction
 * of the viewBox is the same fraction of the rendered box in either axis. The
 * dot renders at `(cx / SVG_W) · boxWidth`, `(cy / VIEWBOX_H) · boxHeight`; the
 * label sits at `labelLeftPct(terminalX)`, `labelTopPct(y)` of the same box.
 * **The two agree by construction rather than by a number that happens to match
 * at one size**, which is the property a pixel offset could not have given — and,
 * until CHART-6, the horizontal half did not have it at all.
 *
 * ⛔ THE DEFECT THIS REPLACES, STATED PLAINLY BECAUSE IT SURVIVED THREE TASKS.
 * The label's x was `left: 5px` inside a gutter pinned to the plot's right edge —
 * a CONSTANT. The dot's x is `terminalX`, DERIVED from the series' last point.
 * While the domain was the series' own span those were the same number and the
 * label could not be wrong. CHART-3 fixed the axis to the experiment window and
 * separated them, and nothing noticed, because no guard in the repository
 * compared a layout position to a data position. Measured on staging at CHART-6:
 * the hero's `YES` label sat **515 px** from the dot it names, on a 597 px plot;
 * collapsed 252 px of 289; expanded 691 px of 775. Roughly nine-tenths of the
 * plot, on all three surfaces, on all eight markets.
 *
 * ⚠ `terminalLabelYs` IS NOT RE-DERIVED HERE, only converted. The 12-unit
 * minimum gap, the symmetric push, the clamp and the YES-takes-upper tie-break
 * all still happen in plot space exactly as they did when these were `<text>`
 * (`C-CHART-2` clause 4, unchanged). This function spends that answer; it does
 * not second-guess it. So in the ordinary non-colliding case the label centre
 * IS the dot's `cy`, and in the colliding case it is deliberately not — which
 * is the whole point of clause 4 and why the alignment guard uses a
 * non-colliding market.
 *
 * ⚠ `leading-none` IS STATED BECAUSE `text-[10px]` DOES NOT RESET IT. An
 * arbitrary Tailwind size inherits whatever step's line-height is in scope, so
 * the box would be 16px tall around 10px type and `-translate-y-1/2` would
 * centre the wrong box. At `leading-none` the box IS the type.
 */
function TerminalLabels({
	yes,
	mode,
	terminalX,
	bandPx,
}: {
	yes: string;
	mode: ChartMode;
	/** Where the drawn line ENDS, in viewBox units — the SAME `terminalX` the two
	 * dots are drawn at, passed rather than re-derived so the label and the mark
	 * cannot come to disagree about where the series stopped.
	 * ⛔ REQUIRED, NEVER DEFAULTED, for `TerminalMarkers.cx`'s reason exactly: the
	 * only plausible default is `VIEWBOX_W`, which is the pre-CHART-6 defect
	 * spelled out as a value. */
	terminalX: number;
	/** The height of the X-axis date row, in CSS px, or `0` on a render that draws
	 * no axis — `C-CHART-2` clause 3's reserved band (RF-5).
	 * ⛔ PASSED, NEVER RE-DERIVED. Whether an axis is drawn depends on the mode AND
	 * the series, which this component does not see; computing it here would mean a
	 * second copy of `drawsTimeAxis`'s per-mode gates, and two copies of a gate are
	 * two answers to "is there a date row?" — one held by the row and one by the
	 * clamp meant to clear it. */
	bandPx: number;
}): React.JSX.Element {
	const labelY = terminalLabelYs(yes);
	// Which of the two clause-4 already put on top. Read off its OUTPUT rather
	// than recomputed from the price, so the tie-break at exactly 50 % stays
	// clause 4's and is not decided a second time here.
	const yesOnTop = labelY.yes <= labelY.no;
	const upperPct = labelTopPct(yesOnTop ? labelY.yes : labelY.no);
	const lowerPct = labelTopPct(yesOnTop ? labelY.no : labelY.yes);
	const half = labelHalfBoxPx(mode);
	const showValue = hasEndValue(mode);
	// The horizontal half of the contract, computed once for both labels because
	// both dots share one `cx` — `TerminalMarkers` draws them at the same
	// `terminalX`, since a market has one series and therefore one last point.
	const xPct = labelLeftPct(terminalX);
	const flip = shouldFlip(xPct);
	const left = labelLeftCss(xPct, flip);
	// ⛔ THE PAIRED FORMATTER, AND IT IS THE POINT OF RF-2. This label renders
	// BOTH sides, so NO must be DERIVED as `100 − YES` rather than rounded on its
	// own — independent per-side half-up rounding prints 101 % at any exact `.xx5`
	// tie (SPEC.1 §10.8). `formatPricePercent` never reads `pricing.no` (its own
	// docblock states that as the structural guarantee), so the pair is built from
	// the single price this component actually holds: the terminal YES.
	//
	// ⛔ AND THE GUARANTEE IS NARROWER THAN THIS COMMENT FIRST CLAIMED. It said the
	// terminal is "the same `spotYes` `price-chart.ts` stamps the point with — the
	// one the `PriceBar` renders", making agreement "true by construction". That is
	// false on the path that actually serves this component: `deriveMarketPriceChart`
	// passes `spotYes` only when it derives the walk itself, and the market-detail
	// page INJECTS a cached walk, so the stamp does not run. What holds instead:
	// on an `Open` market `withLiveTail` composes the right edge from the live pool,
	// so the two agree; on every other state the chart shows the walk's terminal and
	// the bar shows the pool, and `price-series.ts` RULED that a divergence there is
	// "the correct outcome" rather than a defect. They agree today because a closed
	// market's pool does not move. Corrected at the CHART-5 cascade — a comment
	// re-asserting a guarantee an adjacent module spent thirty lines giving up is
	// how a future reader "fixes" a correct render.
	const pair = { yes, no: yes };
	return (
		<div
			data-testid="terminal-label-layer"
			data-flip={flip ? "true" : "false"}
			// ⛔ ARIA-HIDDEN, AND THIS ATTRIBUTE IS A REGRESSION FIX, NOT TIDINESS.
			// While the labels were `<text>` they sat inside an `aria-hidden`
			// `<svg>` and were excluded from every accessible-name computation. Out
			// here they are ordinary HTML inside the collapsed card's `<button>` and
			// the Discovery hero's `<Link>`, so they JOINED both accessible names:
			// measured, the card announced "NO YES Price history: opening 50 %,
			// current 65 %, …". Two orphan words in front of the sentence that is
			// supposed to be the readout — and on the hero, in front of a link whose
			// name length is already a docketed concern (`HeroPanels`, A11Y.0).
			// ⚠ THE CHART'S ACCESSIBLE CHANNEL IS `ChartSummary` AND ONLY IT. That
			// is the ruling `C-CHART-1` and SPEC.1 §9 already carry: a screen reader
			// cannot read a polyline, so announcing the graphic means announcing the
			// sentence beside it. These two words are a visual key for a visual
			// mark; they add nothing a reader of the summary does not already have,
			// and reading them aloud in isolation is noise.
			// Caught by `@code-reviewer` at the CHART-2 cascade.
			aria-hidden="true"
			/* ⛔ AN OVERLAY ON THE PLOT, NOT A COLUMN BESIDE IT — `C-CHART-2` clause 3
			   as amended at CHART-6 (RF-2). `inset-0` makes this box exactly the plot
			   box, which is what lets BOTH percentages resolve against the same
			   rectangle the viewBox is stretched onto.
			   ⛔ `pointer-events-none` IS A REGRESSION FIX, NOT TIDINESS. This layer
			   now covers the whole plot, and the plot sits inside the collapsed card's
			   `<button>` and the Discovery hero's `<Link>`. Without it, two 10px words
			   would swallow clicks across the entire graph on the two surfaces whose
			   graph IS the affordance.
			   ⚠ THE SIZER IS GONE, AND ITS DELETION IS THE POINT RATHER THAN A
			   SIDE-EFFECT. It existed to give the GUTTER a width — an in-flow
			   invisible copy of the widest label, so no number encoded a string's
			   advance in a face nobody could measure (CHART-2, deleting CHART-1's
			   hand-pinned `26`). There is no gutter to size now: the labels are
			   absolutely positioned and `whitespace-nowrap`, so they take their own
			   width wherever they land. The mechanism is retired because its job
			   went, not because the reason for it stopped being true — a pinned width
			   here would be the same defect in a new place, which is why
			   `alignment-chain.test.tsx` still bans one. */
			className="pointer-events-none absolute inset-0 text-[10px] leading-none font-bold tracking-[0.1em]"
		>
			<span
				data-testid="terminal-label-no"
				data-plot-y={labelY.no}
				data-plot-x={terminalX}
				className={`absolute -translate-y-1/2 whitespace-nowrap text-[color:var(--graph-no)]${
					flip ? " -translate-x-full" : ""
				}`}
				style={{
					left,
					top: yesOnTop
						? lowerTop(lowerPct, half, bandPx)
						: upperTop(upperPct, half),
				}}
			>
				<LabelParts
					name="NO"
					value={showValue ? formatPricePercent(pair, "NO") : null}
					valueTestId="terminal-value-no"
				/>
			</span>
			<span
				data-testid="terminal-label-yes"
				data-plot-y={labelY.yes}
				data-plot-x={terminalX}
				className={`absolute -translate-y-1/2 whitespace-nowrap text-[color:var(--graph-yes)]${
					flip ? " -translate-x-full" : ""
				}`}
				style={{
					left,
					top: yesOnTop
						? upperTop(upperPct, half)
						: lowerTop(lowerPct, half, bandPx),
				}}
			>
				<LabelParts
					name="YES"
					value={showValue ? formatPricePercent(pair, "YES") : null}
					valueTestId="terminal-value-yes"
				/>
			</span>
		</div>
	);
}

/**
 * The Y scale's numeric marks — HTML in a column of their own, to the **LEFT** of
 * the plot (`C-CHART-1` clause 1 as amended at CHART-5, CHART-6 and CHART-7).
 *
 * ⛔ THE SIDE IS THE CHART-7 CHANGE, AND IT IS A CONSEQUENCE RATHER THAN A TASTE.
 * The right side now belongs to the traveling end labels: since CHART-6 they are
 * positioned from their own dot's x, so on a market trading near the deadline they
 * arrive at the plot's right edge — which is exactly where this column used to
 * sit. Two systems reaching for one strip is what made both cramped, and the
 * founder's ruling separates them by axis: **marks left, labels right** (`RF-1`).
 * A left scale is also the conventional reading order for a Y axis, which is the
 * smaller half of the reason and the one a reader notices first.
 *
 * ⛔⛔ THE AIR IS THE PADDING **AND** THE MARK'S OWN OFFSET, AND GETTING THAT WRONG
 * IS THE DEFECT THIS TASK ALMOST SHIPPED. The 6px is the gap between the numerals
 * and the gridlines they label. It is tempting to read it as a property of the
 * padding alone — this docblock did, at length — but a mark is `absolute`, and an
 * absolutely positioned box resolves `right` against its ancestor's **PADDING
 * BOX**, whose right edge is the OUTER edge of the padding. So `right: 0` lands the
 * numeral flush with the column's border edge and the padding sits BEHIND it,
 * contributing width and no air.
 *
 * ⚠ THE OLD ARRANGEMENT PRODUCED THE 6PX BY ACCIDENT OF OPPOSITION, which is why
 * nothing noticed. With the column on the RIGHT the padding was on the LEFT and the
 * alignment on the RIGHT — two different edges, so the slack fell on the plot side.
 * Moving the column made them the same edge and they cancelled. **Measured in a
 * real browser, on a minimal repro of all four arrangements:**
 *
 *     column RIGHT · pl-[6px] · right:0      → 6.00px   (what shipped before)
 *     column LEFT  · pr-[6px] · right:0      → 0.00px   ⛔ the defect
 *     column LEFT  · pr-[6px] · right-[6px]  → 6.00px   ✅ shipped now
 *     column LEFT  · mr-[6px] · right:0      → 6.00px   (rejected: the column's own
 *                                               border box shrinks to 17.59px)
 *
 * ⇒ **A coordinate that is right only because two independent quantities happen to
 * be arranged a particular way** — the register entry CHART-3 minted, CHART-6 hit on
 * the label's x, and CHART-5 hit on this very column's edge clamp. Third instance,
 * same file, caught by `@code-reviewer` at the CHART-7 cascade. The column keeps
 * `pr-[6px]` so its measured 24px footprint is unchanged and the mark carries the
 * matching `right-[6px]`; the guard asserts the PAIR, because asserting the padding
 * side alone is exactly what certified the defect.
 *
 * ⚠ "BETWEEN THE PLOT AND THE END LABELS" WAS TRUE UNTIL CHART-6 AND IS NOT NOW.
 * The end labels left the row entirely — they are an overlay on the plot,
 * positioned from their own dots — so this column shares no strip with anything.
 * ⚠ AND IT RENDERS ON ALL THREE MODES SINCE CHART-7 (`RF-3`), where it used to be
 * the overlay and the hero only; the collapsed card carries the quarters plus `0`
 * rather than the ten-step, which is `gridlinesFor`'s business and not this
 * component's.
 *
 * ⛔ HTML AND NOT SVG `<text>`, for exactly the reason clause 2 moved `YES`/`NO`
 * out at CHART-2: `preserveAspectRatio="none"` stretches user space by a factor
 * that differs per surface and per viewport, so a declared 10-unit label renders
 * anywhere between ~4 px and ~19 px. Out here, 10px is 10px on every surface.
 *
 * ⛔ ITS OWN COLUMN, NOT A SECOND ABSOLUTE LAYER INSIDE `TerminalLabels`, AND THE
 * FIRST ATTEMPT AT THIS SHIPPED THE WRONG ONE. Putting the marks inside the label
 * gutter forced that gutter from `relative` to `flex` and pushed the width-sizer
 * one level down — which broke `alignment-chain.test.tsx`'s two structural guards
 * on `C-CHART-2` clause 2 link 4 and clause 3. Those guards are RIGHT: the
 * labels' `top: X%` must resolve against a box exactly as tall as the plot, and
 * the gutter's width must be measured by an in-flow sizer rather than pinned. The
 * fix was to stop disturbing the gutter at all.
 * ⚠ AND CHART-6 DELETED THE GUTTER OUTRIGHT, so "byte-identical to what it was
 * before this task" — true of CHART-5 — describes a box that no longer exists.
 * What survives is the RULE the regression taught: this column is a SIBLING of
 * the plot and owns its own layout, and the labels are an overlay inside the
 * plot. Neither can force the other's box.
 *
 * ⚠ NO PINNED WIDTH HERE EITHER. The column is sized by an in-flow invisible
 * copy of the widest mark string, the same mechanism and for the same reason
 * CHART-2 gave when it deleted a hand-measured `26` for the label gutter: a
 * number encoding a string's width in a face nobody measured goes stale the
 * moment the face or the set changes. `items-stretch` on the frame makes this
 * column exactly the plot's height, which is what lets a percentage top land a
 * mark on its own gridline.
 */
function YMarks({ marks }: { marks: readonly Gridline[] }): React.JSX.Element {
	return (
		<div
			data-testid="chart-y-marks"
			// Same reasoning as the label gutter's: this is a visual key for a visual
			// mark, and the chart's accessible channel is `ChartSummary` alone.
			aria-hidden="true"
			className="relative shrink-0 pr-[6px] text-right text-[10px] leading-none text-n5 tabular-nums"
		>
			{/* The sizer — an in-flow copy of the widest mark, laid out by the browser
			    in the real shipped face. `100` is the widest of the eleven at tabular
			    figures, where every digit is the same width. */}
			<span aria-hidden="true" className="invisible block">
				100
			</span>
			{marks.map((g) => (
				<span
					key={g.pct}
					data-testid={`y-mark-${g.pct}`}
					data-pct={g.pct}
					className="absolute right-[6px] -translate-y-1/2"
					style={{ top: markTop(labelTopPct(g.y)) }}
				>
					{g.pct}
				</span>
			))}
		</div>
	);
}

/**
 * A numeric mark's CSS `top` — the OUTER edge clamp only.
 *
 * ⛔ NOT A COLLISION RULE, AND THE OMISSION IS THE WHOLE POINT. `upperTop` /
 * `lowerTop` carry a `min`/`max` term pivoting on 50 % because the two END
 * labels converge there and must be pushed apart. Gridline marks are evenly
 * spaced by construction and can never converge, so they need no such term —
 * only the same edge floor that stops the `0` and `100` marks, whose centres sit
 * exactly on the plot's boundaries, from having half their box outside it. The
 * gutter does not clip, so an unclamped mark escapes rather than being cut.
 *
 * ⚠ IT READS THE MARK'S OWN TYPE, NOT THE END LABEL'S, and the first version did
 * the latter — `LABEL_NAME_PX / 2`. Those two constants are both 10 today and
 * describe different things: one is the end label's name, the other is the size
 * `YMarks` declares for itself. Change the end label to 12px — a one-token edit
 * `labelHalfBoxPx` is explicitly built to absorb — and the marks' edge clamp
 * silently became 6px against a 10px box, pushing the `0` and `100` marks a pixel
 * off their own gridlines in a gutter that does not clip. A coordinate correct
 * only because two independently-declared quantities happen to be equal is the
 * register entry CHART-3 minted; caught here by `@code-reviewer`.
 */
function markTop(pct: number): string {
	const half = MARK_TYPE_PX / 2;
	return `clamp(${half}px, ${pct}%, calc(100% - ${half}px))`;
}

/**
 * One end label's contents — the name, and beside it the value when the mode
 * carries one (`C-CHART-2` clause 2 as amended at CHART-7).
 *
 * ⛔ EXTRACTED SO THE RIGHT RESERVE CAN BE SIZED BY THE REAL LABEL RATHER THAN BY A
 * COPY OF IT. `LabelReserve` renders this same element at the widest price the
 * chart can produce, invisibly and in flow, and takes its width from the browser.
 * If the sizer duplicated the spans instead, the two would agree on the day they
 * were written and drift on the day one of them changed — which is exactly the
 * failure `C-CHART-2` clause 3 records for CHART-1's hand-measured `26`, in a new
 * place. One element, two callers, no second declaration of what a label is.
 *
 * ⚠ THE TESTID IS OPTIONAL AND THE SIZER PASSES NONE, deliberately: two elements
 * carrying `terminal-value-yes` would make every guard that reads "the value" pick
 * whichever came first in the markup, and the one that comes first would be the
 * invisible copy.
 */
function LabelParts({
	name,
	value,
	valueTestId,
}: {
	name: "YES" | "NO";
	value: string | null;
	valueTestId?: string;
}): React.JSX.Element {
	return (
		<>
			<span>{name}</span>
			{value !== null && (
				<span
					data-testid={valueTestId}
					className="tracking-normal tabular-nums"
					style={{
						fontSize: `${LABEL_VALUE_PX}px`,
						marginLeft: `${LABEL_INLINE_GAP_PX}px`,
					}}
				>
					{value}
				</span>
			)}
		</>
	);
}

/**
 * The RIGHT gutter — a reserve the traveling end labels can occupy without
 * crossing the frame (`C-CHART-2` clause 3 as amended at CHART-7, RF-5).
 *
 * ⛔ WHY A RESERVE AND NOT A BIGGER FLIP THRESHOLD. Since CHART-6 the labels travel
 * with their dots, so a market trading near the deadline drives them to the plot's
 * right edge; the only thing standing between them and the edge was the FLIP,
 * which puts the label on the other side of its dot. That works, and it means the
 * normal end-of-experiment rendering is the fallback rather than the design. A
 * reserve makes the flip the exception it was written to be.
 *
 * ⛔ SIZED BY AN IN-FLOW INVISIBLE COPY OF THE WIDEST LABEL, NOT BY A NUMBER — the
 * mechanism `YMarks` already uses and CHART-2 minted when it deleted CHART-1's
 * hand-measured `26`. `formatPricePercent` at a YES price of `1` is `100%` by the
 * shipped formatter, so the sizer's string is the widest string the chart CAN
 * produce rather than a literal somebody believed was. Measured in the shipped
 * face: `YES 100%` is **69.88 px** and `NO 100%` is **64.84 px**, so `YES` is
 * correctly the one to size from.
 *
 * ⚠ THE PADDING IS THE OTHER TWO MEASURED INPUTS. `LABEL_AIR_PX` is the 5 px of
 * separation carried since CHART-2, and `RESERVE_RING_PX` is the pulse ring's
 * maximum extent in CSS px — measured **3.48 px on the collapsed card, 6.64 on the
 * hero, 9.12 on the expanded overlay**, so 10 covers the widest plot the product
 * ships. One number rather than three, erring high: over-reserving costs a few
 * pixels of plot, under-reserving flips a label early. The failure is one-sided,
 * so the margin belongs on the safe side.
 *
 * ⚠ AND A MEASUREMENT THAT SAYS THE RING IS ALREADY PAID FOR, RECORDED BECAUSE IT
 * IS THE INTERESTING PART. The dot's maximum x is `VIEWBOX_W / SVG_W` = **98.61 %**
 * of the plot, not 100 %, and the ring's own clearance is `LABEL_GAP_PCT` =
 * **1.1094 %** — the two sum to 99.72 %, still inside the plot. So the true
 * overhang past the plot's edge is `5px + labelWidth − 0.28 % × plotWidth`, and the
 * ring term is slack rather than load. It is included anyway because `C-CHART-2`
 * clause 3 pins it; the slack is stated so nobody later "discovers" it and removes
 * the wrong term.
 *
 * ⛔ `invisible`, NEVER `hidden`. `visibility: hidden` keeps the box, which is the
 * whole mechanism; `display: none` removes it and the reserve collapses to its
 * padding — silently, leaving a chart that looks almost right.
 */
function LabelReserve({ mode }: { mode: ChartMode }): React.JSX.Element {
	return (
		<div
			data-testid="chart-label-reserve"
			// A blank strip that must not be announced, and must not intercept a click
			// on the collapsed card's `<button>` or the hero's `<Link>` — the same two
			// attributes, for the same two reasons, as the label layer it serves.
			aria-hidden="true"
			className="pointer-events-none invisible shrink-0 whitespace-nowrap text-[10px] leading-none font-bold tracking-[0.1em]"
			style={{ paddingLeft: `${LABEL_AIR_PX + RESERVE_RING_PX}px` }}
		>
			<LabelParts
				name="YES"
				value={
					hasEndValue(mode)
						? formatPricePercent({ yes: "1", no: "1" }, "YES")
						: null
				}
			/>
		</div>
	);
}

/**
 * The pulse ring's maximum extent, in CSS PIXELS, as the right reserve budgets it.
 *
 * ⛔ A BOUND, NOT AN EXACT VALUE, AND SAYING SO IS THE POINT. The ring's extent is
 * a fraction of the plot — `TERMINAL_PULSE_MAX_R / SVG_W` — so in pixels it differs
 * per surface and per viewport: measured **3.48 px (collapsed) · 6.64 (hero) ·
 * 9.12 (expanded overlay)** on the product's real boxes, in the shipped face. The
 * reserve is one CSS box and cannot carry three numbers, so it carries the ceiling.
 * ⚠ A plot wider than ~900 px would exceed it; the flip is what covers that, which
 * is what a fallback is for.
 */
const RESERVE_RING_PX = 10;

/**
 * The gap between a terminal dot and its label, expressed as a PERCENTAGE of the
 * plot — `C-CHART-2` clause 2 as amended at CHART-6.
 *
 * ⛔ IT IS THE PULSE RING'S OWN RADIUS, CONVERTED, AND NOT A CHOSEN NUMBER. The
 * ruling is that the label must not be overlapped by the ring at any point in the
 * animation, and the ring reaches `TERMINAL_PULSE_MAX_R` = 7.2 user units from
 * the dot at its peak (`globals.css` `scale(2.4)`, pinned against
 * `TERMINAL_PULSE_PEAK_SCALE` by `terminal-pulse.test.tsx`). Running it through
 * `labelLeftPct` puts it in the same currency as the label's position, so the
 * clearance is exact **at every mode and every viewport** — both quantities are
 * fractions of the same box, so they scale together.
 *
 * ⚠ A CSS-PIXEL GAP WOULD HAVE BEEN WRONG ON TWO SURFACES OUT OF THREE, and that
 * is not hypothetical — it is `TERMINAL_LABEL_MIN_GAP`'s history one axis over.
 * The ring renders 3.20 px wide on the collapsed card, 6.63 px on the hero and
 * 8.60 px on the expanded overlay (measured, 2026-09-01), because the plot's
 * scale factor differs by 2.7× across them. Any single pixel value clears the
 * ring on at most one.
 */
const LABEL_GAP_PCT = labelLeftPct(TERMINAL_PULSE_MAX_R);

/**
 * The air between the ring's edge and the label, in CSS px.
 *
 * ⚠ CARRIED, NOT MINTED. It is the `pl-[5px]` the gutter shipped with since
 * CHART-2 — the same 5 px of separation, measured from the ring instead of from
 * the plot's edge. A new value here would be this task inventing a spacing that
 * no document rules, which is exactly what CHART-3 declined to do in the same
 * component.
 */
const LABEL_AIR_PX = 5;

/**
 * How much of the plot a right-placed label needs BEYOND what the right reserve
 * already holds, as a percentage — the flip threshold.
 *
 * ⛔⛔ IT IS ZERO SINCE CHART-7, AND A ZERO CONSTANT NEEDS ITS REASON WRITTEN DOWN
 * OR SOMEBODY WILL DELETE THE TERM. `LABEL_FLIP_RESERVE_PCT` was **14** — the
 * percentage of the plot a label needed for itself, because there was nothing to
 * the right of the plot and a label that would not fit inside it had to flip. RF-5
 * puts a real reserve there, sized from the widest label the chart can produce plus
 * the ring plus the gap, so the label no longer needs a percentage of the PLOT: it
 * needs room in the RESERVE, and by construction the reserve has it.
 *
 * ⛔ THE ARITHMETIC, BECAUSE "BY CONSTRUCTION" IS A CLAIM. A label starts at
 * `xPct% + LABEL_GAP_PCT% + LABEL_AIR_PX` of the plot and runs `labelWidth` past
 * that. The reserve provides `labelWidth + LABEL_AIR_PX + RESERVE_RING_PX`. The
 * dot's maximum in-window x is `VIEWBOX_W / SVG_W` = **98.61 %**, so the label's
 * left edge is at most `98.61 + 1.11 = 99.72 %` of the plot — still inside it — and
 * the overhang past the plot's edge is `5px + labelWidth − 0.28 % × plotWidth`,
 * which is strictly less than the reserve for every plot width the product ships.
 * **So an in-window label always fits, and the threshold that used to buy it room
 * is spent.**
 *
 * ⚠ THE FLIP IS NOT DEAD, AND THE CASE IT COVERS IS LIVE ON STAGING. `xPx` is
 * deliberately unclamped, so a series running PAST the window end puts `terminalX`
 * beyond `VIEWBOX_W`, and once `xPct` exceeds **98.8906** — i.e. `terminalX >
 * 641.70`, about **3.3 hours** past the window end — `xPct + LABEL_GAP_PCT`
 * exceeds 100 and this fires.
 * ⚠ THE BAND BETWEEN 640 AND 641.70 IS COVERED BY THE RESERVE, NOT BY THE FLIP,
 * and saying so is the point: this docblock first read "above 98.89", which is the
 * THRESHOLD, and a reader would take it for the value a just-past-the-end series
 * produces — that is 98.61, still inside. The reserve needs ≈74.9px there against
 * the 84.88px it holds. Caught by `@code-reviewer` at the CHART-7 cascade. That is a real rendering (`limits.ts` records it
 * happening for two weeks) and it is exactly what a fallback is for: the reserve
 * covers a label anchored INSIDE the plot, and nothing can reserve room for a dot
 * that is not on the canvas.
 *
 * ⚠ AND WHY THE TERM STAYS RATHER THAN THE COMPARISON BEING SIMPLIFIED TO
 * `xPct + LABEL_GAP_PCT > 100`. The two are identical today. Keeping the named
 * quantity keeps clause 2's flip arithmetic byte-identical to what CHART-6 shipped
 * and measured — a scope fence this task honours by changing only its INPUT — and
 * leaves one place to put a number back if a future reserve cannot cover
 * something.
 * ⚠ AND THE CAP IS TIGHTER THAN THIS DOCBLOCK FIRST CLAIMED. It said
 * `label-anchor.test.tsx` "caps it at 20 from the other direction" — true of the
 * sweep CHART-6 left, and understated by two orders of magnitude now: the
 * in-window walk added at CHART-7 asserts that NO series with `f ≤ 1` flips, and
 * the tightest of those anchors at 98.61 %, so anything above **0.28** reds.
 * Corrected because it is exactly the sentence a future reader would cite to
 * justify raising the constant. Found by `@test-writer` at the CHART-7 cascade.
 *
 * ⛔ WHAT THE 14 WAS, KEPT BECAUSE THE MEASUREMENT COST SOMETHING AND STILL
 * TEACHES. It was read off the shipped build across the whole viewport range as
 * `labelWidth / plotWidth`: the hero's chart frame has a measured FLOOR of
 * **496.49 px** — identical at 768, 900, 1024 and 1045, because the
 * `md:grid-cols-[1fr_1.9fr_1fr]` centre track hits a content minimum of 530.99 and
 * stops shrinking — its plot at that floor is **472.49**, and `100%` renders
 * **42.47 px** in the shipped face, giving 8.99 % plus 1.06 pp for the air the
 * threshold could not express: **10.05 %**, cleared by 14 with 3.95 points spare.
 * ⚠ AND A CAREFUL DERIVATION GETS THAT FLOOR WRONG: reading the grid as a pure
 * `1fr 1.9fr 1fr` split gives 421.95 px at 1024 and predicts a defect, and it
 * reproduces 1440 EXACTLY, which is what makes it convincing. `@code-reviewer`
 * filed exactly that at the CHART-6 cascade. **A layout figure is measured or it is
 * not known.**
 */
const LABEL_FLIP_RESERVE_PCT = 0;

/** Whether a label at this x would cross the plot's right edge — `C-CHART-2`
 * clause 2's flip, per label. ⚠ Both labels share one `terminalX` today, because
 * a market has one series and both dots mark its end; the rule is still written
 * per label so it stays correct if that ever stops being true. */
function shouldFlip(xPct: number): boolean {
	return xPct + LABEL_GAP_PCT > 100 - LABEL_FLIP_RESERVE_PCT;
}

/**
 * A label's CSS `left` — its dot's x, plus or minus the ring's clearance.
 *
 * ⚠ THE FLIPPED ARM PAIRS WITH `-translate-x-full` ON THE ELEMENT, and neither
 * half works alone. `left` places the label's LEFT edge; on the flipped side what
 * must sit clear of the ring is its RIGHT edge, and the only width-free way to say
 * that is a translate of −100 % of the element's own box — a percentage the
 * browser resolves against the label, which is the one width nobody here knows.
 * The two translates compose (`-translate-y-1/2` keeps the vertical centring);
 * separating them into `left` and `transform` is what keeps the vertical rule —
 * clause 4's whole arithmetic — untouched by this change.
 */
function labelLeftCss(xPct: number, flip: boolean): string {
	return flip
		? `calc(${xPct}% - ${LABEL_GAP_PCT}% - ${LABEL_AIR_PX}px)`
		: `calc(${xPct}% + ${LABEL_GAP_PCT}% + ${LABEL_AIR_PX}px)`;
}

/**
 * The end label NAME's type size, in CSS PIXELS — `text-[10px]` at
 * `leading-none`, so the name's box IS 10px. Callers halve it themselves.
 *
 * ⛔ IN PIXELS, NOT PLOT UNITS, AND THAT DISTINCTION IS A DEFECT THIS TASK
 * ALMOST SHIPPED. `TERMINAL_LABEL_MIN_GAP = 12` and `clampLabelY`'s floor of 6
 * were both exactly right while the label was SVG `<text>` at `font-size: 10`
 * **in user units** — 10 units of type plus 2 of air, and 6 units of half-box.
 * The moment the label became HTML at 10 **CSS px**, those numbers stopped
 * describing it: a plot unit is 0.42822 CSS px on the collapsed card, so 12
 * units of separation is **5.14 px** between two boxes that are 10 px tall.
 * Measured, the two labels OVERLAP by ~3 px for every market between YES ≈
 * 46.35 % and 53.65 % — the resting state of every market and six of the eight
 * seeded ones — on the surface that is the market's primary price display.
 * Caught by `@test-writer` at the CHART-2 cascade.
 */
const LABEL_NAME_PX = 10;
// ⚠ Renamed from `LABEL_HALF_BOX_PX` at CHART-5, and the docblock above it was
// NOT renamed with it — it read "half of it is 5" beside a constant of 10, i.e.
// it described the value's predecessor. Both call sites (`labelHalfBoxPx` and
// `markTop`) correctly treat this as the FULL box and divide, which is the
// opposite of what that text said; a maintainer trusting it and writing
// `clamp(${LABEL_NAME_PX}px, …)` in a new clamp would have got a silent 2×
// over-clamp. `markTop` is exactly such a new clamp, added in the same commit.
// Caught by `@code-reviewer`.

/**
 * The VALUE's type size, and the air BESIDE it — the other two numbers the
 * label's box is made of (`C-CHART-2` clause 2 as amended at CHART-5 and again at
 * CHART-7).
 *
 * ⛔ THE SECOND NUMBER CHANGED AXIS AT CHART-7 AND WAS RENAMED WITH IT. It was
 * `LABEL_STACK_GAP_PX = 2`, a `margin-top` separating a value stacked BENEATH its
 * name. RF-2 puts the two side by side — `NO 52%` — so the air is horizontal and
 * the old name would describe a stack that no longer exists. **A renamed constant
 * is cheaper than a maintainer trusting the old one.**
 *
 * ⚠ 4 IS MEASURED, NOT PICKED. It is Geist's own space advance at the VALUE's
 * type size — **4.39 px at 16 px**, measured in the shipped face with the font
 * check passing — floored to the integer, so the gap is a word space and never
 * wider than one. The name's own `tracking-[0.1em]` already contributes ~1 px of
 * trailing letter-space, which is why the pair does not need the full advance.
 * Measured widths of the whole `YES 100%` label at each candidate: **65.88 px at
 * 0, 67.88 at 2, 69.88 at 4, 71.88 at 6** — the right reserve is sized from the
 * 4 px figure.
 *
 * ⚠ THE GAP DOES NOT ENTER THE BOX'S HEIGHT ANY MORE, and that is the whole
 * reason clause 4's threshold moves. Stacked, the box was `10 + 2 + 16 = 28`.
 * Side by side it is `max(10, 16) = 16` — see `labelHalfBoxPx`.
 */
const LABEL_VALUE_PX = 16;
const LABEL_INLINE_GAP_PX = 4;

/** The numeric marks' own type size — `YMarks` declares `text-[10px]`, and this
 * is that number rather than a second reader of the end label's. See `markTop`. */
const MARK_TYPE_PX = 10;

/**
 * Half the label's rendered box, in CSS PIXELS — **derived from the type the
 * label is actually made of, per mode.**
 *
 * ⛔ ONE RULE, TWO MEASURED INPUTS — NOT A SECOND COLLISION RULE. Clause 4's
 * arithmetic in `terminalLabelYs` is untouched, and so is the `min`/`max`/
 * `clamp` shape below. The only thing CHART-5 and CHART-7 change is the NUMBER
 * handed to that shape: CHART-5 made the value-bearing label two lines, so a
 * taller box collided at a wider spread, and CHART-7's founder ruling puts the two
 * on ONE line, so it collides at a narrower one. Hard-coding a threshold per
 * surface would have been the CHART-2 defect exactly — a constant chosen against
 * one surface — so the box is composed from the type values the label declares,
 * and the threshold moves whenever they do.
 *
 * ⚠ THE NAME-ONLY VALUE IS UNCHANGED AT 5 AND APPLIES TO THE COLLAPSED CARD
 * ALONE. It used to cover the Discovery hero too, on CHART-5's asymmetry — those
 * two kept the name alone, so their box did not grow. CHART-6 gives the hero the
 * value, so its box grew and its threshold had to grow with it: that is exactly
 * why this reads `hasEndValue` rather than a second `mode ===` test. A hero that
 * gained the value and kept the 5px floor would overlap its own two labels across
 * the band where every market rests.
 *
 * ⛔ AND AT CHART-7 THE VALUE-BEARING BOX HALVED, WHICH IS RF-2'S WHOLE MECHANICAL
 * CONSEQUENCE. Stacked, the box was `10 + 2 + 16 = 28`, so the floor held the two
 * centres 28 px apart. Side by side, the two share ONE line box and the horizontal
 * gap contributes nothing to its height, so the box is `max(name, value) = 16` and
 * the floor holds them 16 px apart. **The rule is untouched; only the measured
 * input moved** — the same sentence CHART-5 wrote when it moved the other way.
 *
 * ⚠ `Math.max`, NOT `LABEL_VALUE_PX`, EVEN THOUGH THE VALUE IS THE TALLER TODAY.
 * The two sizes are independently declared, so naming the taller one would be a
 * coordinate that is right only because two quantities currently happen to be
 * ordered a particular way — the register entry this file already keeps twice.
 * Make the name 20px and this follows; name the value and it silently does not.
 */
function labelHalfBoxPx(mode: ChartMode): number {
	return hasEndValue(mode)
		? Math.max(LABEL_NAME_PX, LABEL_VALUE_PX) / 2
		: LABEL_NAME_PX / 2;
}

/**
 * The two end labels' CSS `top`, and the one place plot space and CSS space are
 * reconciled.
 *
 * ⛔ `terminalLabelYs` IS UNTOUCHED — `C-CHART-2` clause 4's arithmetic is a
 * scope fence and stays exactly as it was. What these two helpers add is a FLOOR
 * expressed in the unit the labels are now drawn in, layered ON TOP of clause
 * 4's answer, never replacing it:
 *
 *   upper:  clamp(5px, min(P%, calc(50% - 5px)), calc(100% - 5px))
 *   lower:  clamp(5px, max(P%, calc(50% + 5px)), calc(100% - 5px))
 *
 * ⚠ WHY 50 % IS THE RIGHT PIVOT AND NOT AN ASSUMPTION. YES and NO mirror about
 * the midline by construction (design-language §3.2), so the only place the two
 * can approach each other is there. Far from even, `min`/`max` are no-ops and
 * clause 4's plot-space positions pass through untouched.
 * ⚠ THIS PARAGRAPH HAS NOW BEEN WRONG IN BOTH DIRECTIONS AND IS CORRECTED IN
 * PLACE FOR THE SECOND TIME. It first read "the expanded overlay still separates
 * by clause 4's own 12 units (~20 px) rather than being flattened to 10", which
 * CHART-5 falsified by stacking the value under the name: `half` became 14, the
 * floor held the two centres 28 px apart, and the CSS floor DOMINATED clause 4
 * across roughly the 46–54 % band. **CHART-7 halves it again, the other way.**
 * RF-2 puts name and value on one line, so `half` is 8 and the floor holds them
 * 16 px apart — still above clause 4's own post-push separation near even, so the
 * floor still dominates, across a band roughly half as wide. The measured band is
 * reported in the CHART-7 run rather than restated here, because a number written
 * into a docblock is the thing that goes stale: this paragraph is the proof,
 * twice over.
 *
 * ⛔ AND WHY CSS MATH RATHER THAN A BIGGER CONSTANT. The alternative was to
 * raise `TERMINAL_LABEL_MIN_GAP` to ~24 units so that 12 px survived the worst
 * scale factor. That would over-separate the two larger surfaces by 3× — and,
 * worse, it would be **the very error this task exists to correct, one level
 * up**: a single number chosen against one surface's scale, wrong everywhere
 * else. `min()`/`max()`/`clamp()` mix `%` and `px` in the browser's own layout
 * pass, so the guarantee is exact on every surface without anyone knowing the
 * box's height at render time — which, being server-rendered, nobody does.
 *
 * The outer `clamp` is the same fix in the other axis: `clampLabelY`'s 6-unit
 * floor is 2.57 px on the collapsed card against a 5 px half-box, so a market
 * near 99 % put the upper label's box partly ABOVE the plot. The gutter does not
 * clip — that is the point of it — so it escaped into whatever sits above the
 * chart rather than being cut off.
 */
function upperTop(pct: number, half: number): string {
	return `clamp(${half}px, min(${pct}%, calc(50% - ${half}px)), calc(100% - ${half}px))`;
}

/**
 * ⛔ THE THIRD TERM IS THE DATE ROW, AND IT IS ONE MORE MEASURED INPUT TO THIS
 * CLAMP RATHER THAN A SECOND RULE (`C-CHART-2` clause 3, RF-5). The bottom bound
 * was `100% - half`, which keeps the label's box inside the PLOT; the plot's floor
 * is also where the X-axis dates sit, so at the window end with an extreme price
 * the lower label came to rest exactly on top of its own date label. Measured at
 * CHART-6 and reproduced on this branch before the change: **19.99 × 16.00 px** on
 * the expanded overlay, **4.54 × 7.70 px** on the collapsed card.
 *
 * ⚠ IT NEEDS BOTH CONDITIONS AT ONCE — a series reaching the window end AND a
 * price at an extreme — which is why it is invisible today and is what every
 * market looks like on 2026-11-05.
 *
 * ⛔ THE BAND IS COMPOSED, NOT WRITTEN DOWN. `AXIS_DATE_BAND_PX` is
 * `AXIS_DATE_PX + AXIS_DATE_BOTTOM_PX` — the row's own type plus its own offset —
 * so changing either moves the clamp with it. A literal here would be a threshold
 * chosen against one date size, which is the CHART-2 defect this file records
 * twice.
 *
 * ⚠ AND IT IS `0` ON A RENDER THAT DRAWS NO AXIS, passed in rather than assumed.
 * Reserving a band under a row that is not there would push the lower label up on
 * a degenerate market for no reason a reader could see.
 */
function lowerTop(pct: number, half: number, bandPx: number): string {
	return `clamp(${half}px, max(${pct}%, calc(50% + ${half}px)), calc(100% - ${half}px - ${bandPx}px))`;
}

/**
 * The COLLAPSED chart's time TICKS — SPEC.1 1.0.32 (HTML-FINISH · MARKET DETAIL
 * round 2 · R8, founder-ruled 2026-08-16). d5's `.xtick` ×2 (`d5:1014-1018`).
 *
 * ⛔ IT WAS `CollapsedAxis` AND HELD THE LABELS TOO, UNTIL CHART-7. The labels are
 * HTML now — `AxisDates` below — for `C-CHART-2` clause 2's original reason
 * applied to the one element that had never taken it. What is left here is the
 * part that had no reason to leave: a tick is a rule at an x in the PLOT's own
 * domain, drawn in the space that owns that domain, and it carries no type for a
 * non-uniform scale to distort.
 *
 * ⛔⛔ EVERY TIMESTAMP IT RENDERS IS A REAL INSTANT ON A CONSTANT SPAN, which is
 * how the 1.0.32 ruling's constraint — *"it introduces no new data and no new
 * read"* — is honoured in the sense that mattered. The ticks used to be ANCHORED
 * TO SERIES POINTS, precisely so the axis could not "mint a timestamp the series
 * does not contain". That was right while the domain was the market's own
 * lifetime, and wrong against a fixed window for two reasons that compound: two
 * markets on one window would carry DIFFERENT tick dates, defeating the ruling
 * canon `C-CHART-1` clause 1 states; and a market three days into a seven-week
 * window has `nearestPoint` return the SAME final point for both thirds, stacking
 * two ticks at one x.
 *
 * ⛔ NO AXIS ON A DEGENERATE DOMAIN. Fewer than two points, or `endMs ===
 * startMs`, is the flat-line case `buildLine` handles by duplicating one value at
 * both edges — every point shares x = 0, so ticks would stack on the left edge.
 * The chart keeps its lines and renders no axis, which is the honest reading of
 * "no time has passed yet". `AxisDates` carries the SAME gate, from the same
 * predicate, so the two halves of one axis cannot come to disagree about whether
 * there is an axis.
 *
 * ⚠ TOKENS, NEVER HEX. `--color-n2` — index-wise the same role d5 gives its `--n2`
 * dotted rule. The dash pattern `5 4` is byte-carried from `ProfileChart.tsx:104`,
 * the shipped dashed stroke on `main`; d5 says `dotted` and gives no numbers, so
 * inventing a pattern would have been a value this component may not take.
 */
function CollapsedTicks({
	series,
	startMs,
	endMs,
}: {
	series: PricePoint[];
	startMs: number;
	endMs: number;
}): React.JSX.Element | null {
	if (!drawsTimeAxis("collapsed", series, startMs, endMs)) {
		return null;
	}
	// ⛔ THE TICKS FOLLOW THE ANCHORS SINCE CHART-7, AND ONLY THE INTERIOR ONES.
	// They used to sit at a fixed third and two-thirds of the WINDOW, floored to
	// UTC midnight — which was the right rule while the axis described the window,
	// and is the wrong one now that it describes the calendar: a tick at a third of
	// the span, under a label reading `Sep 15`, is a rule drawn at a time nothing
	// names.
	//
	// ⚠ AN ANCHOR AT THE PLOT'S EDGE GETS NO TICK, WHICH IS WHY THIS FILTERS RATHER
	// THAN DRAWING ALL OF THEM. On production the card's two anchors ARE the plot's
	// edges, so it draws none — a `vector-effect` rule at x = 0 is half outside the
	// viewBox and renders as a half-pixel smear along the border, which reads as a
	// rendering fault rather than as an axis. On staging `Sep 15` is interior and
	// gets its rule. The two environments differing here is the ruling working, not
	// a defect: the anchors are calendar dates and the windows are not the same.
	//
	// ⛔ THE FLOORING WENT WITH THE THIRDS AND IS NOT MISSED. It existed because a
	// raw third of the production window is `2026-10-02T07:55Z` — eight hours right
	// of the midnight its label named, so tick and label disagreed by 4.09 user
	// units. The anchors are already midnight-aligned instants (and `Nov 5` is the
	// ratified 23:45 deadline, which is the instant it names), so tick and label
	// read the SAME value and cannot diverge. Raised by `@security-auditor` at the
	// CHART-3 cascade; discharged by construction here.
	const interior = drawnAnchors("collapsed", startMs, endMs).filter(
		({ iso }) => {
			const x = xPx(iso, startMs, endMs);
			return x > 0 && x < VIEWBOX_W;
		},
	);

	return (
		<>
			{interior.map(({ iso, i }) => (
				<line
					key={`tick-${i}`}
					data-testid={`axis-x-tick-${i}`}
					x1={xPx(iso, startMs, endMs)}
					x2={xPx(iso, startMs, endMs)}
					y1={0}
					y2={VIEWBOX_H}
					stroke="var(--color-n2)"
					strokeWidth="1"
					strokeDasharray="5 4"
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</>
	);
}

/**
 * Whether a mode draws a time axis at all — ONE predicate, read by both halves.
 *
 * ⛔ THE TWO HALVES OF ONE AXIS MUST NOT BE ABLE TO DISAGREE. The ticks are SVG
 * and the dates are HTML, so they live in different trees and are mounted by
 * different expressions; before CHART-7 they were one component and the gate was
 * structural. Split apart, "ticks but no dates" and "dates but no ticks" both
 * become reachable by editing one arm — and both look deliberate on screen.
 *
 * ⚠ THE PER-MODE GATES ARE CARRIED, NOT UNIFIED, and that is deliberate restraint
 * rather than an oversight. The collapsed card has required ≥2 points since
 * HTML-FINISH R8; the expanded overlay has required ≥1 since CHART-1. Both are
 * shipped, measured behaviour that nothing in this task's register asks to move,
 * and unifying them would change what a one-point market renders on a surface
 * nobody ruled about. `endMs === startMs` is unreachable under a constant window
 * and is kept because `xPx` still has the branch.
 */
function drawsTimeAxis(
	mode: ChartMode,
	series: PricePoint[],
	startMs: number,
	endMs: number,
): boolean {
	if (endMs === startMs) {
		return false;
	}
	switch (mode) {
		case "collapsed":
			return series.length >= 2;
		case "expanded":
			return series.length > 0;
		case "hero":
			// ⛔ REVERSED AT CHART-7 (RF-4, founder ruling D20(b)/D21(b)). This arm
			// returned `false` on the ground that "three date labels along the bottom
			// of a carousel panel a reader flicks past are noise rather than
			// orientation, and Discovery's job is to say whether a market has moved,
			// not when." That was a canon-jurisdiction presentational call and the
			// founder has taken it the other way: RF-4's table names `expanded` AND
			// `hero`, and the canon text it ratifies reads "plus `Oct 1` on the wider
			// modes". The hero is the widest of the three — 624.62 px against the
			// overlay's 848 in width but the TALLEST at 418.75 — so the argument from
			// crowding does not hold there either.
			return series.length > 0;
		default: {
			const exhaustive: never = mode;
			return exhaustive;
		}
	}
}

/** One drawn date label: where it sits, what it says, and how it hangs off its
 * own x. */
type AxisDate = {
	readonly testId: string;
	readonly at: string;
	readonly x: number;
	readonly anchor: "start" | "middle" | "end";
};

/**
 * The date labels a mode draws, in order.
 *
 * ⚠ THE ANCHORING IS A PURE FUNCTION OF THE X, NEVER OF THE INDEX, and that is
 * the form that survives RF-4. A label at the plot's left edge must hang to the
 * RIGHT of its x or half of it is outside the box; one at the right edge must
 * hang left; everything between is centred on the tick it names. Written as
 * "first label → start-anchored" it would be right on a window whose first
 * label sits at x = 0 and wrong the moment one sits inside the plot — which is
 * exactly what the calendar anchors do on staging.
 */
function axisDatesFor(
	mode: ChartMode,
	series: PricePoint[],
	startMs: number,
	endMs: number,
): readonly AxisDate[] {
	if (!drawsTimeAxis(mode, series, startMs, endMs)) {
		return [];
	}
	const at = (iso: string, testId: string): AxisDate => {
		const x = xPx(iso, startMs, endMs);
		return {
			testId,
			at: iso,
			x,
			anchor: x <= 0 ? "start" : x >= VIEWBOX_W ? "end" : "middle",
		};
	};
	return drawnAnchors(mode, startMs, endMs).map(({ iso, i }) =>
		at(iso, `axis-x-anchor-${i}`),
	);
}

/**
 * Which anchors this chart draws — the shipped list, bound to the pure selector.
 *
 * ⛔ ONE BINDING SITE FOR THE REAL CONSTANT, AND IT IS THE ONLY THING THIS WRAPPER
 * DOES. `axisAnchorsFor` takes the list as a parameter so a guard can drive it
 * through a synthetic window (see its docblock); that flexibility is exactly what
 * must NOT reach the render, or a caller could pass a fixture list and the product
 * would label dates nobody ruled. The component has one source and names it here.
 */
function drawnAnchors(
	mode: ChartMode,
	startMs: number,
	endMs: number,
): readonly { readonly iso: string; readonly i: number }[] {
	return axisAnchorsFor(MARKET_CHART_AXIS_ANCHORS, mode, startMs, endMs);
}

/**
 * The X axis's date labels — HTML text layered over the plot, outside the `<svg>`
 * (CHART-7, RF-3).
 *
 * ⛔ THEY WERE THE LAST TEXT INSIDE THE STRETCHED VIEWBOX, AND THAT IS THE WHOLE
 * REASON THEY MOVED. `C-CHART-2` clause 2 sent `YES`/`NO` out at CHART-2 because
 * `preserveAspectRatio="none"` scales user space by a factor that differs per
 * surface, so nothing applied inside it can be right at more than one size. The
 * date row was left behind on the stated ground that moving it "would mean
 * re-deriving every tick's x in CSS space" — a real objection when it was
 * written, and one CHART-6 answered by building `labelLeftPct` for the end
 * labels. The derivation already exists; this reuses it.
 *
 * ⛔ AND RF-3 IS NOT SATISFIABLE WITHOUT THE MOVE, WHICH IS THE ARGUMENT RATHER
 * THAN A CONVENIENCE. Measured on the unchanged tree, in the shipped face: ONE
 * declaration of `10px` rendered a **7.70 px** box on the collapsed card and a
 * **16.00 px** box on the expanded overlay — a factor of 2.08. RF-3 asks for the
 * dates to be made bigger AND checked against the numeric marks' 10 px so the two
 * scales do not fight; against the marks the collapsed dates were 23 % SMALLER
 * and the expanded ones 60 % LARGER, in opposite directions, from one number. No
 * declared value inside the viewBox fixes both. Out here, `AXIS_DATE_PX` is that
 * many pixels on every surface.
 *
 * ⚠ `aria-hidden` AND `pointer-events-none`, BOTH REGRESSION FIXES RATHER THAN
 * TIDINESS — the same two `TerminalLabels` carries and for the same reasons.
 * Inside the `aria-hidden` `<svg>` these strings were excluded from every
 * accessible name; out here they are ordinary HTML inside the collapsed card's
 * `<button>`, so they would JOIN its accessible name and read three bare dates in
 * front of the sentence that IS the readout. And this layer covers the plot,
 * which on that card and on the hero IS the affordance, so without
 * `pointer-events-none` it would swallow clicks.
 */
function AxisDates({
	mode,
	series,
	startMs,
	endMs,
}: {
	mode: ChartMode;
	series: PricePoint[];
	startMs: number;
	endMs: number;
}): React.JSX.Element | null {
	const dates = axisDatesFor(mode, series, startMs, endMs);
	if (dates.length === 0) {
		return null;
	}
	return (
		<div
			data-testid="axis-date-row"
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 leading-none text-n5 tabular-nums"
			style={{ fontSize: `${AXIS_DATE_PX}px` }}
		>
			{dates.map((d) => (
				<span
					key={d.testId}
					data-testid={d.testId}
					data-plot-x={d.x}
					className={`absolute whitespace-nowrap${
						d.anchor === "end"
							? " -translate-x-full"
							: d.anchor === "middle"
								? " -translate-x-1/2"
								: ""
					}`}
					style={{
						left: `${labelLeftPct(d.x)}%`,
						bottom: `${AXIS_DATE_BOTTOM_PX}px`,
					}}
				>
					{fmtUtcDay(d.at)}
				</span>
			))}
		</div>
	);
}

/**
 * The date row's type size, in CSS PIXELS, and the air beneath it.
 *
 * ⛔ 12, NOT 10, AND THE DIFFERENCE IS THE RULING. RF-3 says the dates are too
 * small and asks that the result be checked against the marks' size "so the two
 * scales do not fight". Ten would make them identical to the numeric marks — and
 * identical is the one relation that DOES fight, because the two scales then
 * compete to be read as the same system. Twelve reads as the axis: a step above
 * the marks, plainly the frame rather than a value on it, and still close enough
 * that neither dominates. Against what shipped, the collapsed card's dates go
 * from a **7.70 px** rendered box to **12 px** — the increase the ruling asks
 * for — and the expanded overlay's come DOWN from 16.00, which is not a
 * regression but the removal of a distortion nobody chose.
 *
 * ⚠ `AXIS_DATE_BOTTOM_PX` IS THE ROW'S OWN OFFSET FROM THE PLOT'S FLOOR, and it
 * is load-bearing beyond spacing: `lowerTop` reserves `AXIS_DATE_PX +
 * AXIS_DATE_BOTTOM_PX` as a band the lower end label may not enter, so this pair
 * is the measured input to `C-CHART-2` clause 3's date-row clearance. Change
 * either and the clamp follows, because the band is composed from them rather
 * than written down a second time.
 */
const AXIS_DATE_PX = 12;
const AXIS_DATE_BOTTOM_PX = 4;

/** The whole height the date row occupies above the plot's floor — the band
 * `lowerTop` may not put a label into (`C-CHART-2` clause 3, RF-5). Composed from
 * the two constants above rather than written as a third number, so the clamp and
 * the row can never disagree about how tall the row is. */
const AXIS_DATE_BAND_PX = AXIS_DATE_PX + AXIS_DATE_BOTTOM_PX;

/** An SVG `points` string for one line. With fewer than two points OR a
 * degenerate domain (`startMs === endMs`), draws a FLAT LINE from the left edge
 * to the series' own instant — the value at x = 0 and again at that point's x
 * (a narrowing of the "duplicate at both ends" trick the retired
 * `PriceSparkline` also used — that component was DELETED at CHART-1 when the
 * hero moved onto this one, so read the name as history, not as a live
 * reference; SPEC.1 §9 "flat line at the opening price").
 *
 * ⚠ SINCE CHART-3 THE SECOND CONDITION IS UNREACHABLE and the first is nearly
 * so. The domain is now a constant non-empty window, so `startMs === endMs`
 * cannot happen; and an `Open` market always gains `withLiveTail`'s point at
 * `now`, so a single-point series needs a **non-`Open` market that was never
 * bet on**. The branch is KEPT because SPEC.1 §9 *Sparse and terminal states*
 * pins it — "fewer than two points … renders a flat line at the opening price
 * … there is no empty state".
 *
 * ⛔ THE RIGHT EDGE WAS `VIEWBOX_W` UNTIL CHART-4, AND THAT WAS A FALSE
 * STATEMENT ON A FROZEN SURFACE. Read after CHART-3, "across the domain" is the
 * fixed experiment window, so the one reachable case — a market that closed on
 * Oct 1 having never been bet on — painted a price all the way out to the
 * window end on Nov 5, five weeks past the instant it froze. CHART-3 shipped
 * that unchanged and flagged it for a founder ruling rather than inventing a
 * rendering; **the ruling came back the other way (CHART-4 D9)**: a market's
 * series never extends past the later of its last event or, on an `Open`
 * market, the present instant — never to the window end. So the right edge is
 * now the point's own `xPx`, which is the same rule the ≥2-point branch below
 * has always followed, rather than a special case beside it.
 *
 * ⚠ THE LEFT EDGE IS DELIBERATELY STILL `0` AND IS NOT WHAT D9 RULED. Anchoring
 * it at the point's own x too would collapse the line to zero length and render
 * nothing, which is the "empty state" §9 forbids in terms. It does mean the
 * opening price is drawn from the window start up to the genesis instant, which
 * is a mirror of the defect just removed and is smaller only because the market
 * had no other price to show. It is left alone because D9 constrains where a
 * series may END, and widening the fix past the ruling would be this session
 * choosing a rendering no document specifies — the exact thing CHART-3 declined
 * to do. Flagged for the web lane in the CHART-4 report. */
function buildLine(
	series: PricePoint[],
	startMs: number,
	endMs: number,
	yFn: (yes: string) => number,
): string {
	if (series.length === 0) {
		return "";
	}
	if (series.length < 2 || endMs === startMs) {
		const y = yFn(series[0].yes);
		return `0,${y} ${xPx(series[0].at, startMs, endMs)},${y}`;
	}
	return series
		.map((p) => `${xPx(p.at, startMs, endMs)},${yFn(p.yes)}`)
		.join(" ");
}
