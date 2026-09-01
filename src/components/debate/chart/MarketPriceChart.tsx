"use client";

import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { formatPricePercent } from "../format";
import {
	type ChartMode,
	fmtUtcDay,
	type Gridline,
	gridlinesFor,
	labelTopPct,
	SVG_W,
	TERMINAL_DOT_R,
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
 * `hero` renders lines and terminals and NO axis — it is a third of the height
 * of the collapsed card, where three date labels would be noise rather than
 * orientation. That is a presentational choice inside canon's jurisdiction, not
 * a spec pin; §22 and C-CHART-2 both stop at "same component, same derivation".
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
 * STILL RENDERS NO NODES — only the axis half moved. EXPANDED is UNTOUCHED: the
 * two X endpoint labels — ⚠ **the WINDOW's endpoints since CHART-3, no longer
 * `market.opened` · last event**; they name the axis they sit on, and the axis
 * stopped being the market's own span — and interior ticks there remain
 * canon-owned and unbuilt.
 * Post nodes arrive in Slice 2. The SVG is `aria-hidden` on ALL THREE surfaces
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
 * invert the poles). No raw hex. Slice 2: EXPANDED also marks the per-`(UTC day,
 * side)` top-post `nodes` — one dot each, side-bound to the SAME `--graph-*`
 * token (decision #7; never the `--color-*` slot), y = the node's YES price on
 * the fixed 0–100 % scale. Collapsed never renders nodes. */
export function MarketPriceChart({
	series,
	nodes,
	mode,
	isOpen,
}: {
	series: PricePoint[];
	nodes?: ChartNode[];
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
		/* ⛔ THE FRAME IS A FLEX ROW, AND THAT IS THE WHOLE LABEL FIX
		   (`C-CHART-2` clause 2, CHART-2). Left cell: the plot, which the viewBox
		   stretches into. Right cell: an HTML gutter the viewBox cannot reach. A
		   `<text>` inside the `<svg>` is scaled by `preserveAspectRatio="none"`
		   along with everything else, and the scale is DIFFERENT on each of the
		   three surfaces and varies with viewport and carousel position besides —
		   so the same declared 10px rendered 4.28px on the collapsed card. Nothing
		   applied inside that space can be right at more than one size. Out here,
		   10px is 10px.
		   ⚠ The gutter is RETURNED FROM THIS COMPONENT rather than left for each
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
			<div
				data-testid="market-price-chart-plot"
				className="min-w-0 flex-1"
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
					// the 4 units the terminal circle needs not to half-clip at `cx =
					// VIEWBOX_W`. Still ADDED to the viewBox rather than taken out of the
					// plot, so every plotted coordinate — and every guard asserting one — is
					// exactly where it has always been; only the addition shrank, 38 → 4.
					viewBox={`0 0 ${SVG_W} ${VIEWBOX_H}`}
					preserveAspectRatio="none"
					aria-hidden="true"
					className="h-full w-full"
				>
					{/* ✅ COLLAPSED — THE TIME AXIS (SPEC.1 1.0.32, HTML-FINISH · MARKET
			    DETAIL round 2 · R8). Two interior ticks and three date labels.
			    ⚠ IT IS DRAWN FIRST, so the two price lines paint OVER it — gridlines
			    behind data. That is also the shipped `expanded` order below and
			    `ProfileChart`'s, so the three axes stack their layers the same way.
			    ⛔ IT IS INSIDE THE `<svg>`, DELIBERATELY. d5 draws its `.xtick` /
			    `.xlab` as absolutely-positioned DIVS over the graph (`d5:496-499`),
			    and porting that literally is what would have slipped past
			    `price-chart.test.tsx::collapsed-renders-no-axis` GREEN — the guard
			    asserts the absence of testids inside this component, and DOM siblings
			    of the chart carry none of them. Building it here keeps the axis under
			    the guard that names it.

			    ⚠⚠ AND `ProfileChart` HAS NOW DONE THE OPPOSITE, SO READ THE TRAP ABOVE
			    AS A SCOPING HAZARD RATHER THAN A BAN. PROFILE OVERLAP R2 moved that
			    chart's two endpoint labels OUT of its `<svg>` and into HTML, because
			    `preserveAspectRatio="none"` scales user space non-uniformly and text
			    goes with it. The hazard is answered there by RETURNING the labels from
			    the component's own tree rather than making them a sibling of it — a
			    component-scoped query still finds them, which is the property this
			    block was protecting.

			    ⚠⚠ THESE DATE LABELS ARE STILL DISTORTED, AND THEY ARE NOW THE ONLY
			    TEXT IN THIS `<svg>` THAT IS. The `YES`/`NO` end labels left for an
			    HTML gutter at CHART-2 (`C-CHART-2` clause 2); the axis did not,
			    because it is positioned against the PLOT's x-domain — a date sits
			    under the series point it names — and moving it out would mean
			    re-deriving every tick's x in CSS space. That is a real task and it is
			    not this one. Measured in the CHART-2 contact sheet at a pinned
			    1440×777: the collapsed `<svg>` renders **288.85 × 137.02** against
			    the CHART-2 viewBox of 649×320, so `scaleX 0.4451` / `scaleY 0.4282`
			    — an anisotropy of **1.0394**, and a declared 10px date label lands
			    at **4.28px tall** (`10 × scaleY`).
			    ⚠⚠ THIS PARAGRAPH ALSO CARRIED A HYBRID NUMBER, CAUGHT BY
			    `@code-reviewer` AT THE CASCADE, and the correction matters more than
			    the digits. It read `316 × 137.03` and `scaleX 0.49068` — the
			    PRE-change `<svg>` width divided by the POST-change viewBox, giving an
			    anisotropy of 1.1459 that describes no state this component has ever
			    been in. The `<svg>` is no longer 316 wide: the label gutter left it,
			    so it is 288.85. **One measurement from before the change combined
			    with one constant from after it** — exactly the shape ("one ratio,
			    written both ways up") that the paragraph immediately below was
			    rewritten to eliminate, committed in the rewrite itself.
			    ⚠⚠ THE PARAGRAPH THAT STOOD HERE WAS ARITHMETICALLY WRONG AND IS
			    CORRECTED RATHER THAN ANNOTATED. It said that CHART-1's widening made
			    "the anisotropy INVERT to ~0.92: labels are now slightly narrower than
			    tall rather than wider". Measured against that 678-wide viewBox the
			    anisotropy was **1.0884** — `scaleX` (0.46608) was still GREATER than
			    `scaleY` (0.42822), so the labels stayed ~8.8 % **wider** than tall.
			    The direction never inverted; the magnitude shrank, 1.153 → 1.088. The
			    `0.92` is `scaleY/scaleX` (1 / 1.0884 = 0.9188) quoted as though it
			    were the same quantity as the `1.153` two sentences earlier, which is
			    `scaleX/scaleY`. **One ratio, written both ways up, inside one
			    paragraph** — and nothing could catch it, because no guard in this
			    repo measures a CSS pixel.
			    ⛔ ITS SUBSTANTIVE HALF WAS CORRECT AND IS **NOT** DISCHARGED — and
			    this paragraph said it was, on a prediction, before the measurement
			    came back. Because `preserveAspectRatio="none"` maps the WHOLE viewBox
			    onto the CSS box, the 678-wide box rendered the PLOT ≈5.6 % narrower —
			    true on screen, invisible in user units, docketed at CHART-1's Gate C
			    as a cost to carry. CHART-2 was expected to dissolve it. Measured in
			    the contact sheet, on this card's real 316px box, in the shipped face:
			    the plot went **298.29 → 284.85 CSS px, a further 4.5 % NARROWER.**
			    ⚠ THE GUTTER DID NOT GO AWAY; IT CHANGED CURRENCY. It used to be 38
			    user units inside the viewBox and is now ~27 CSS px beside it — and it
			    grew, because the label it holds is a legible 10px rather than a
			    squashed 5.38px, and a bigger glyph needs more room. **That is the
			    trade this task made: the line-end labels went 5.38px → 10px, and the
			    plot paid ~13px of width.** Recorded as a cost, not a recovery,
			    because the number says so. */}
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
							vectorEffect="non-scaling-stroke"
						>
							{grid.map((g) => (
								<line
									key={g.pct}
									data-pct={g.pct}
									x1={0}
									x2={VIEWBOX_W}
									y1={g.y}
									y2={g.y}
								/>
							))}
						</g>
					)}
					{mode === "collapsed" && (
						<CollapsedAxis series={series} startMs={startMs} endMs={endMs} />
					)}

					{/* EXPANDED only — the two X endpoint labels (no interior ticks, §9).

					    ⛔ THESE NAME THE AXIS, NOT THE SERIES, AND THAT CHANGED AT CHART-3.
					    They read `series[0].at` and `series[last].at` while the domain WAS
					    the series' own span, so label and position agreed by construction.
					    Under a fixed window they no longer would: a market that opened
					    three days ago plots its first point a fifth of the way along, and
					    a label reading that date pinned to `x = 0` would place the market's
					    first bet at the window's start — a false statement about when the
					    market began trading, printed in the one place a reader goes to find
					    out. SPEC.1 §9's rule is unchanged and is what settles it: "Axis
					    labels are the domain endpoints." The domain moved; the labels
					    follow it. */}
					{mode === "expanded" && series.length > 0 && (
						<>
							<text
								data-testid="axis-x-start"
								x={0}
								y={VIEWBOX_H - 8}
								className="fill-n5 text-[10px]"
								textAnchor="start"
							>
								{fmtUtcDay(MARKET_CHART_WINDOW_START)}
							</text>
							<text
								data-testid="axis-x-end"
								x={VIEWBOX_W}
								y={VIEWBOX_H - 8}
								className="fill-n5 text-[10px]"
								textAnchor="end"
							>
								{fmtUtcDay(MARKET_CHART_WINDOW_END)}
							</text>
						</>
					)}

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

					{/* EXPANDED only — the per-(UTC day, side) top-post nodes (Slice 2). Each
			    a dot at (post timestamp, its YES price on the 0–100 % scale), filled
			    by the post's SIDE token (`--graph-yes`/`--graph-no`, INV-3 — never
			    the `--color-*` slot; decision #7). A ground-toned rim separates a
			    node from its same-token line. */}
					{mode === "expanded" &&
						(nodes ?? []).map((node) => (
							<circle
								key={node.id}
								data-testid={`graph-node-${node.id}`}
								data-side={node.side}
								cx={xPx(node.at, startMs, endMs)}
								cy={yYesPx(node.yYes)}
								r="4"
								fill={
									node.side === "YES" ? "var(--graph-yes)" : "var(--graph-no)"
								}
								stroke="var(--color-ground)"
								strokeWidth="1.5"
								vectorEffect="non-scaling-stroke"
							/>
						))}

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
			</div>
			{mode === "expanded" && grid.length > 0 && <YMarks marks={grid} />}
			{terminalYes !== null && <TerminalLabels yes={terminalYes} mode={mode} />}
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
 * The two end labels, OUTSIDE the plot — `C-CHART-2` clause 2 as amended at
 * CHART-2. HTML text in a gutter beside the `<svg>`, so `10px` is 10px on every
 * surface at every width.
 *
 * ⛔ THE VERTICAL POSITION IS A PERCENTAGE, AND THAT IS THE ALIGNMENT CONTRACT.
 * `preserveAspectRatio="none"` maps `VIEWBOX_H` onto the plot box's full height
 * whatever that height turns out to be, so a fraction of the viewBox is the
 * same fraction of the rendered box — always. The dot's rendered `cy` is
 * `(cy / VIEWBOX_H) · boxHeight`; the label's centre is `labelTopPct(y)` of the
 * gutter, which `items-stretch` makes exactly as tall as the plot. **The two
 * agree by construction rather than by a number that happens to match at one
 * size**, which is the property a pixel offset could not have given.
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
}: {
	yes: string;
	mode: ChartMode;
}): React.JSX.Element {
	const labelY = terminalLabelYs(yes);
	// Which of the two clause-4 already put on top. Read off its OUTPUT rather
	// than recomputed from the price, so the tie-break at exactly 50 % stays
	// clause 4's and is not decided a second time here.
	const yesOnTop = labelY.yes <= labelY.no;
	const upperPct = labelTopPct(yesOnTop ? labelY.yes : labelY.no);
	const lowerPct = labelTopPct(yesOnTop ? labelY.no : labelY.yes);
	const half = labelHalfBoxPx(mode);
	const showValue = mode === "expanded";
	// ⛔ THE PAIRED FORMATTER, AND IT IS THE POINT OF RF-2. This label renders
	// BOTH sides, so NO must be DERIVED as `100 − YES` rather than rounded on its
	// own — independent per-side half-up rounding prints 101 % at any exact `.xx5`
	// tie (SPEC.1 §10.8). `formatPricePercent` never reads `pricing.no` (its own
	// docblock states that as the structural guarantee), so the pair is built from
	// the single price this component actually holds: the terminal YES. That value
	// is the same `spotYes` `price-chart.ts` stamps the terminal point with — the
	// one the `PriceBar` renders — which is what makes "the chart's end label can
	// never disagree with the bar" true by construction rather than by luck.
	const pair = { yes, no: yes };
	return (
		<div
			data-testid="terminal-label-gutter"
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
			className="relative shrink-0 pl-[5px] text-[10px] leading-none font-bold tracking-[0.1em]"
		>
			{/* ⛔ THE SIZER, AND IT REPLACES A HAND-MEASURED CONSTANT. CHART-1 had to
				    pin `YES` at 26 user units because it could not measure Geist offline.
				    This invisible copy is laid out by the browser in the real shipped
				    face, so the gutter is exactly as wide as the widest label actually
				    is — on every device, with no number to go stale.
				    ⚠ IT SIZES ON THE NAME ALONE EVEN WHEN A VALUE IS STACKED BENEATH IT,
				    and that is correct rather than an oversight: the value is at most
				    four characters (`100%`) of TABULAR digits at 16px, and `YES` at 10px
				    bold with 0.1em tracking is the wider of the two. If that ever stops
				    holding the sizer is what must change — not a number somewhere else. */}
			<span aria-hidden="true" className="invisible block">
				YES
			</span>
			<span
				data-testid="terminal-label-no"
				data-plot-y={labelY.no}
				className="absolute left-[5px] -translate-y-1/2 text-[color:var(--graph-no)]"
				style={{
					top: yesOnTop ? lowerTop(lowerPct, half) : upperTop(upperPct, half),
				}}
			>
				<span className="block">NO</span>
				{showValue && (
					<span
						data-testid="terminal-value-no"
						className="block tracking-normal tabular-nums"
						style={{
							fontSize: `${LABEL_VALUE_PX}px`,
							marginTop: `${LABEL_STACK_GAP_PX}px`,
						}}
					>
						{formatPricePercent(pair, "NO")}
					</span>
				)}
			</span>
			<span
				data-testid="terminal-label-yes"
				data-plot-y={labelY.yes}
				className="absolute left-[5px] -translate-y-1/2 text-[color:var(--graph-yes)]"
				style={{
					top: yesOnTop ? upperTop(upperPct, half) : lowerTop(lowerPct, half),
				}}
			>
				<span className="block">YES</span>
				{showValue && (
					<span
						data-testid="terminal-value-yes"
						className="block tracking-normal tabular-nums"
						style={{
							fontSize: `${LABEL_VALUE_PX}px`,
							marginTop: `${LABEL_STACK_GAP_PX}px`,
						}}
					>
						{formatPricePercent(pair, "YES")}
					</span>
				)}
			</span>
		</div>
	);
}

/**
 * The Y scale's numeric marks — HTML in a gutter of their own, between the plot
 * and the end labels (`C-CHART-1` clause 1 as amended at CHART-5).
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
 * fix was to stop disturbing the gutter at all. It is now byte-identical to what
 * it was before this task, and the marks are a sibling column.
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
			className="relative shrink-0 pl-[6px] text-right text-[10px] leading-none text-n5 tabular-nums"
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
					className="absolute right-0 -translate-y-1/2"
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
 * ⚠ Half-box is the ONE-LINE value: a mark is a single line of 10px type at
 * `leading-none` on every mode that has marks.
 */
function markTop(pct: number): string {
	const half = LABEL_NAME_PX / 2;
	return `clamp(${half}px, ${pct}%, calc(100% - ${half}px))`;
}

/**
 * Half the label's rendered box, in CSS PIXELS — the type is `text-[10px]` at
 * `leading-none`, so the box is 10px and half of it is 5.
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

/**
 * The stacked VALUE line's type size and the air between it and the name — the
 * other two numbers the expanded label's box is made of (`C-CHART-2` clause 2 as
 * amended at CHART-5). Both are `leading-none`, so each line's box IS its type
 * and the stack's height is exactly the sum below.
 */
const LABEL_VALUE_PX = 16;
const LABEL_STACK_GAP_PX = 2;

/**
 * Half the label's rendered box, in CSS PIXELS — **derived from the type the
 * label is actually made of, per mode.**
 *
 * ⛔ ONE RULE, TWO MEASURED INPUTS — NOT A SECOND COLLISION RULE. Clause 4's
 * arithmetic in `terminalLabelYs` is untouched, and so is the `min`/`max`/
 * `clamp` shape below. The only thing CHART-5 changes is the NUMBER handed to
 * that shape, because the expanded overlay's label is now two lines rather than
 * one and a taller box collides at a wider spread. Hard-coding a second
 * threshold would have been the CHART-2 defect exactly — a constant chosen
 * against one surface — so the box is composed from the same three type values
 * the label declares, and the threshold moves whenever they do.
 *
 * ⚠ THE ONE-LINE VALUE IS UNCHANGED AT 5, so the collapsed card and the
 * Discovery hero keep the narrower threshold they already had. That is the
 * ruling's own asymmetry: they keep the name alone, so their box did not grow.
 */
function labelHalfBoxPx(mode: ChartMode): number {
	return mode === "expanded"
		? (LABEL_NAME_PX + LABEL_STACK_GAP_PX + LABEL_VALUE_PX) / 2
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
 * clause 4's plot-space positions pass through untouched — which is why the
 * expanded overlay still separates by clause 4's own 12 units (~20 px) rather
 * than being flattened to 10.
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

function lowerTop(pct: number, half: number): string {
	return `clamp(${half}px, max(${pct}%, calc(50% + ${half}px)), calc(100% - ${half}px))`;
}

/**
 * The COLLAPSED chart's time axis — SPEC.1 1.0.32 (HTML-FINISH · MARKET DETAIL
 * round 2 · R8, founder-ruled 2026-08-16). d5's `.xtick` ×2 + `.xlab` ×2 +
 * `.xlab.end` (`d5:1014-1018`).
 *
 * ⛔⛔ EVERY TIMESTAMP IT RENDERS IS A REAL `PricePoint.at`, AND THAT IS THE
 * RULING'S OWN CONSTRAINT: *"it introduces no new data and no new read — every
 * timestamp it renders is already carried on `PricePoint.at`."*
 *
 * ⛔ THAT CONSTRAINT PRODUCED THE OPPOSITE RULE UNTIL CHART-3, AND THE REVERSAL
 * IS RATIFIED RATHER THAN INFERRED. The ticks used to be ANCHORED TO SERIES
 * POINTS — each one the series point whose x landed nearest a third — precisely
 * so the axis could not "mint a timestamp the series does not contain". That
 * was right while the domain was the market's own lifetime, because then an
 * interpolated date WAS a claim about the market's history. It is wrong against
 * a fixed window, for two reasons that compound:
 *
 * 1. **It stops being an axis.** Two markets on the same window would carry
 *    DIFFERENT tick dates, defeating the entire ruling — canon `C-CHART-1`
 *    clause 1 (amended CHART-3) says tick placement is "computed against a
 *    **constant** span rather than a per-market one, which makes every market's
 *    axis identical and two charts directly comparable."
 * 2. **It collapses.** A market three days into a seven-week window occupies
 *    the leftmost ~6 % of the axis, so `nearestPoint` returns the SAME final
 *    point for both thirds: two ticks stacked at one x under two identical
 *    labels. On the production window that is the rendering for roughly the
 *    experiment's first two and a half weeks — not an edge case, the opening.
 *
 * ⇒ Each interior tick now sits at a fixed third of the WINDOW and is labelled
 * with that instant's own UTC day. This mints no claim about the market: the
 * window is a constant this build already knows, so the label is a calendar
 * date, not an interpolated observation. The 1.0.32 constraint is honoured in
 * the sense that mattered — the axis still asserts nothing about the data that
 * the data does not say, because it no longer speaks about the data at all.
 *
 * ⛔ NO AXIS ON A DEGENERATE DOMAIN. Fewer than two points, or `endMs ===
 * startMs` (the unbet market), is the flat-line case `buildLine` handles by
 * duplicating one value at both edges — every point shares x = 0, so ticks would
 * stack on the left edge and three labels would print the same day three times.
 * The chart keeps its lines and renders no axis, which is the honest reading of
 * "no time has passed yet".
 *
 * ⚠ NO GUTTER IS RESERVED, and the labels are drawn OVER the full-bleed plot.
 * `geometry.ts` is FULL-BLEED by construction ("X spans the whole width and Y
 * the whole height, no axis gutter") and it is outside this task's allow-list;
 * more to the point, the shipped `expanded` axis and `ProfileChart` both already
 * place their labels at `y = VIEWBOX_H − 8` over the plot, so this is the
 * established treatment rather than a new one. d5's `18px` gutter is a VALUE and
 * is not taken.
 *
 * ⚠ TOKENS, NEVER HEX. The tick is `--color-n2` — index-wise the same role d5
 * gives its `--n2` dotted rule: a faint gridline one step off the surface. The
 * label reuses `fill-n5 text-[10px]`, byte-identical to the `expanded` labels
 * eight lines below and to `ProfileChart`'s, so the three axes cannot drift. The
 * dash pattern `5 4` is byte-carried from `ProfileChart.tsx:104`, the shipped
 * dashed stroke on `main` — d5 says `dotted` and gives no numbers, so inventing
 * a pattern would have been the value this task may not take.
 */
function CollapsedAxis({
	series,
	startMs,
	endMs,
}: {
	series: PricePoint[];
	startMs: number;
	endMs: number;
}): React.JSX.Element | null {
	if (series.length < 2 || endMs === startMs) {
		return null;
	}
	// The two interior anchors: a fixed third and two-thirds of the WINDOW,
	// FLOORED TO UTC MIDNIGHT. Both are instants on a constant span, so every
	// market's axis carries the same two dates — the property the fixed window
	// exists to buy.
	//
	// ⛔ THE FLOOR IS WHY THE TICK AND ITS LABEL AGREE. A raw third of the
	// production window is 2026-10-02T07:55Z and a raw two-thirds is
	// 2026-10-19T15:50Z — so an unfloored rule draws the gridline 8 and 16 hours
	// right of the midnight its label names, which is 4.09 and 8.18 user units.
	// Under the superseded series-anchored rule tick and label were the same
	// point BY CONSTRUCTION and could not disagree; a fixed span reintroduces the
	// gap, and it is a small instance of the shape this file rejects everywhere
	// else — a mark drawn at a time that is not the time written under it.
	// Flooring costs perfectly even spacing, which nothing requires, and buys an
	// axis whose labels are true. Raised by `@security-auditor` at the cascade.
	const interior = [1 / 3, 2 / 3].map((f) => {
		const raw = new Date(startMs + (endMs - startMs) * f);
		return new Date(
			Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()),
		).toISOString();
	});

	return (
		<>
			{interior.map((at, i) => (
				<line
					// Index-keyed on purpose: these two are a FIXED PAIR of positions
					// (first third, second third), not an identity-bearing list.
					key={`tick-${i === 0 ? "first" : "second"}`}
					data-testid={`axis-x-tick-${i === 0 ? "first" : "second"}`}
					x1={xPx(at, startMs, endMs)}
					x2={xPx(at, startMs, endMs)}
					y1={0}
					y2={VIEWBOX_H}
					stroke="var(--color-n2)"
					strokeWidth="1"
					strokeDasharray="5 4"
					vectorEffect="non-scaling-stroke"
				/>
			))}
			{interior.map((at, i) => (
				<text
					key={`lab-${i === 0 ? "first" : "second"}`}
					data-testid={`axis-x-label-${i === 0 ? "first" : "second"}`}
					x={xPx(at, startMs, endMs)}
					y={VIEWBOX_H - 8}
					className="fill-n5 text-[10px]"
					textAnchor="middle"
				>
					{fmtUtcDay(at)}
				</text>
			))}
			{/* `.xlab.end` (`d5:499`) — right-anchored at the domain's end, so it
			    cannot overflow the viewBox the way a centred label would.
			    ⚠ It names the WINDOW's end, not the series' — CHART-3. It sits at
			    `x = VIEWBOX_W`, which under a fixed axis is the window's end and no
			    longer the last event, so labelling it with the last event's day
			    would print a date at a position that is not that date. */}
			<text
				data-testid="axis-x-label-end"
				x={VIEWBOX_W}
				y={VIEWBOX_H - 8}
				className="fill-n5 text-[10px]"
				textAnchor="end"
			>
				{fmtUtcDay(new Date(endMs).toISOString())}
			</text>
		</>
	);
}

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
