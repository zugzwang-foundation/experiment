/**
 * UI.19 §9 market-detail price-chart display geometry — the d3-free linear
 * scale layer (the profile-graph precedent: the repo carries no d3, and linear
 * scales + polyline strings suffice — the retired `PriceSparkline` was the other
 * example and was DELETED at CHART-1 when the hero moved onto this component). DUPLICATED from
 * `profile/graph/geometry.ts` per web Gate-C ruling #2 — deliberately NOT a
 * shared module: coupling §23↔§9 through one file would let a profile change
 * silently alter the market chart, and the Y semantics differ (fixed 0–100 %
 * probability here, Đ 0–10000 autoscale there). This module is FULL-BLEED — the
 * market chart's X spans the whole width and Y the whole height (no axis
 * gutter), unlike the profile module's margined inset.
 *
 * ⚠ "FULL-BLEED" DESCRIBES THE PLOT, NOT THE `<svg>`, and at CHART-2 the two
 * came back almost into line. `C-CHART-2` clause 3 no longer puts a LABEL
 * gutter in the viewBox — the labels are HTML OVER the plot since CHART-6, and
 * were HTML beside it from CHART-2 until then — so all the
 * viewBox still reserves is a **terminal allowance**, `TERMINAL_DOT_ALLOWANCE`,
 * enough that the widest mark drawn at the plot's right edge — the pulse RING,
 * not the dot — cannot half-clip there. ⚠ CORRECTED AT CHART-5: this said the
 * mark is drawn AT `cx = VIEWBOX_W`, which CHART-3 falsified — `terminalX`
 * follows the series, so the mark reaches that edge only on a market that has
 * traded to the window end. The allowance still budgets that MAXIMUM, which is
 * the case it has to cover; what was wrong was calling it the only case. The plot is full-bleed across
 * `VIEWBOX_W × VIEWBOX_H`, `xPx`
 * still maps a domain onto 0…640, no plotted coordinate has ever moved, and
 * the `<svg>` is `SVG_W` wide — but `SVG_W` is now 649 rather than 678, which
 * is what gives the plot back the width CHART-1 spent on text. Y is untouched
 * and full-bleed outright.
 *
 * PURE DISPLAY GEOMETRY only: a canonical price string is read as a number
 * SOLELY to place an SVG point / label a percent — no money arithmetic happens
 * here; the canonical values stay server-computed strings (CLAUDE.md §2).
 */

export const VIEWBOX_W = 640;
export const VIEWBOX_H = 320;

/** Which of the three surfaces a render is. Named here because the Y scale is a
 * pure function of it and of nothing else. */
export type ChartMode = "collapsed" | "expanded" | "hero";

/** A whole-percent value on the fixed 0–100 % Y scale → its plot-space y.
 * The mirror of `yYesPx`, which takes a 0..1 probability STRING because it reads
 * a canonical price; this one takes a percent NUMBER because a gridline is a
 * property of the scale and never of the data — there is no price to preserve. */
function yPctPx(pct: number): number {
	// Rounding is genuinely needed here: `(1 − 10/100) · 320` is
	// `288.00000000000006` in binary floating point, and an unrounded coordinate
	// would print those digits into every gridline's `y` in the shipped markup.
	// ⚠ This calls the SHARED `round` — see its declaration for why it is a
	// hoisted function rather than the `const` arrow it used to be. These sets are
	// built at module load, above that declaration.
	return round((1 - pct / 100) * VIEWBOX_H);
}

/** One horizontal gridline: the percent it marks and where that lands. */
export type Gridline = { readonly pct: number; readonly y: number };

/**
 * The Y-scale gridline sets — `C-CHART-1` clause 1 as amended at CHART-5.
 *
 * ⛔ COMPUTED ONCE, AT MODULE LOAD, AND THAT IS A REQUIREMENT RATHER THAN AN
 * OPTIMISATION. The set is a pure function of the MODE and never of the series,
 * so building it per render — let alone per point — would be recomputing a
 * constant on every paint of a component that renders three times per market
 * page. Freezing them here also makes the "never per-point" property structural:
 * there is no code path that could accidentally close over a data value, because
 * these arrays exist before any data does.
 *
 * ⚠ THE SETS DIFFER BECAUSE THE BOXES DO, not because the data does. The
 * collapsed card is 194 px tall, so eleven lines in it would be ~18 px apart and
 * read as hatching rather than as a scale; it gets the quarters.
 *
 * ⛔⛔ THE HERO TOOK THE EMPTY SET UNTIL CHART-6, ON A FIGURE THAT WAS WRONG BY A
 * FACTOR OF FOUR. This docblock said *"The Discovery hero is ~96 px tall and gets
 * NONE — at that height even four lines compete with the series for the same
 * pixels"*. **Measured on the shipped build at 1440: the hero's chart box is
 * 418.75 px, and the expanded overlay it was being contrasted against is
 * 382.25 px. The hero is 36.5 px TALLER than the overlay.** Where 96 came from is
 * worth knowing, because it is a live trap: `HeroPanels` mounts the chart in
 * `min-h-24 flex-1`, and `min-h-24` is 6rem = 96 px — a FLOOR, not a height.
 * HTML-FINISH row 9 changed `h-24` to `min-h-24 flex-1` precisely so the graph
 * would grow with its panel, and CHART-5 read the floor as the box.
 *
 * ⇒ The hero and the overlay share ONE set (founder ruling, CHART-6): both are
 * full panels and both carry every 10 %. Two names for one array would be two
 * places for them to drift apart, so there is one — and the collapsed card's
 * quarters stay separate, because its box genuinely is short.
 */
const GRIDLINES_COLLAPSED: readonly Gridline[] = Object.freeze(
	[25, 50, 75, 100].map((pct) => Object.freeze({ pct, y: yPctPx(pct) })),
);

const GRIDLINES_TEN_STEP: readonly Gridline[] = Object.freeze(
	Array.from({ length: 11 }, (_, i) => i * 10).map((pct) =>
		Object.freeze({ pct, y: yPctPx(pct) }),
	),
);

/**
 * Whether a mode's end label carries the current VALUE beneath — now beside — its
 * name (`C-CHART-2` clause 2, CHART-5/CHART-6).
 *
 * ⛔ RENAMED FROM `hasFullYScale` AT CHART-7, BECAUSE IT STOPPED BEING TRUE OF THE
 * NAME IT HAD. It governed three things as one bundle — the ten-step gridlines,
 * the numeric marks column, and the value line — and RF-1/RF-3 break that bundle
 * up: **the marks column now renders on every mode**, so its condition is
 * `grid.length > 0` and not this predicate, and the gridline SET was always
 * `gridlinesFor`'s business rather than this one's. What is left is the value line
 * and the collision floor that composes from it. A predicate called
 * `hasFullYScale` that no longer decides whether a mode has the full Y scale is
 * the kind of name a maintainer reads instead of reading the code.
 *
 * ⛔ IT STILL GOVERNS TWO THINGS AND THAT IS STILL DELIBERATE. The label's
 * half-box composes from whether the value renders, so a mode that gained the
 * value and kept the one-line floor would overlap its own two labels across the
 * band where every market rests — the failure this component has shipped once
 * already. One predicate, so the two cannot be given different answers.
 *
 * ⚠ WRITTEN AS A NEGATION OF `collapsed`, NOT A LIST OF THE OTHER TWO, and that
 * is the direction that survives a fourth surface: a new mode joins the full
 * treatment by default and is corrected deliberately, rather than silently
 * shipping without the value. `gridlinesFor` keeps its own exhaustive switch; the
 * two are tied together by an assertion in
 * `tests/unit/debate/render/y-scale.test.tsx` rather than by one calling the
 * other, so neither can quietly stop agreeing.
 */
export function hasEndValue(mode: ChartMode): boolean {
	return mode !== "collapsed";
}

/**
 * The gridline set for a mode. A pure lookup — see the docblock above for why it
 * must not compute.
 *
 * ⚠ `0` AND `100` LAND EXACTLY ON THE PLOT'S EDGES (y = 320 and y = 0), so on the
 * expanded overlay two of the eleven are boundary rules rather than interior
 * ones. That is deliberate and is the founder's ruled set; whether the `100`
 * line is visually redundant against the card border is a ruling the CHART-5
 * contact sheet renders both ways.
 */
export function gridlinesFor(mode: ChartMode): readonly Gridline[] {
	switch (mode) {
		case "expanded":
			return GRIDLINES_TEN_STEP;
		case "collapsed":
			return GRIDLINES_COLLAPSED;
		case "hero":
			// CHART-6, founder ruling: the same set as the overlay. The hero's box was
			// believed to be ~96px and measures 418.75px — taller than the overlay's
			// 382.25px — so the ground the empty set stood on was a mis-read layout
			// floor rather than a design constraint. See the sets' own docblock.
			return GRIDLINES_TEN_STEP;
		default: {
			// ⛔ EXHAUSTIVE BY COMPILE ERROR, NOT BY FALLING THROUGH. The first
			// version ended `return GRIDLINES_HERO` after two `if`s, so a FOURTH
			// surface added to `ChartMode` would compile clean and ship with no Y
			// scale at all (the version that did this ended `return GRIDLINES_HERO`,
			// an empty set that CHART-6 removed along with the name) — silently, on a chart whose whole point is that the
			// scale is a function of the mode. `MarketPriceChartMode`'s own docblock
			// names this hazard for the type union ("two places for a fourth surface
			// to be added to only one of") and it was left open for the lookup.
			// Raised by `@code-reviewer` at the CHART-5 cascade.
			const exhaustive: never = mode;
			return exhaustive;
		}
	}
}

/** Terminal dot radius — `C-CHART-2` clause 1. Deliberately NOT `C-CHART-1`
 * clause 2's `r=4` post node, and deliberately rimless: the two marks mean
 * different things (where the series ENDS vs. where a post SITS) and are told
 * apart by the label beside this one, not by a one-pixel radius difference. */
export const TERMINAL_DOT_R = 3;

/**
 * The pulse ring's peak scale (`C-CHART-2` clause 7).
 *
 * ⛔ IT LIVES HERE AND NOT ONLY IN THE KEYFRAME BECAUSE THE VIEWBOX HAS TO
 * BUDGET FOR IT. The animation itself runs in CSS — this constant is never
 * applied to anything; it exists so `TERMINAL_DOT_ALLOWANCE` below can be
 * derived from the LARGEST mark the viewBox must contain rather than from the
 * smallest. `tests/unit/debate/render/terminal-pulse.test.tsx` reads the
 * `scale()` out of `globals.css` and asserts it equals this number, so the two
 * cannot drift — the same read-both-and-compare shape as the container/viewBox
 * lock, and for the same reason.
 */
export const TERMINAL_PULSE_PEAK_SCALE = 2.4;

/**
 * The pulse ring's outer radius AT ITS PEAK, in plot user units — `7.2`.
 *
 * ⛔ MINTED AT CHART-6 BECAUSE A SECOND CONSUMER APPEARED, AND TWO CALLERS
 * MULTIPLYING THE SAME PAIR IS HOW THEY DRIFT. `TERMINAL_DOT_ALLOWANCE` below
 * already computed this product to budget the viewBox; `C-CHART-2` clause 2 as
 * amended at CHART-6 needs the same length again, to hold the end label clear of
 * the ring. Naming it once means the label's gap and the viewBox's allowance
 * cannot come to disagree about how big the ring is — which is exactly the
 * failure this module's own docblocks record twice over, once when the allowance
 * was sized to the dot rather than the ring, and once when `markTop` read the end
 * label's type size instead of the mark's.
 *
 * ⚠ IT IS A RADIUS, NOT A DIAMETER. The ring shares the dot's `cx`/`cy` and
 * scales about its own centre (`transform-box: fill-box; transform-origin:
 * center` in `globals.css`), so at peak it reaches this far in EVERY direction
 * from the terminal dot — which is why the label's horizontal gap and the
 * viewBox's right-hand allowance are the same number.
 */
export const TERMINAL_PULSE_MAX_R = TERMINAL_DOT_R * TERMINAL_PULSE_PEAK_SCALE;

/**
 * What the viewBox reserves to the right of the plot — `C-CHART-2` clause 3, as
 * amended at CHART-2. ⚠ CHART-5 correction: this read "the terminal marks are
 * centred at `cx = VIEWBOX_W`", which CHART-3 falsified — they are centred at
 * `terminalX`, the series' own last point, and reach `VIEWBOX_W` only when the
 * series runs to the window end. That MAXIMUM is what the allowance budgets, so
 * without an allowance their right halves sit outside the viewBox, and an
 * `<svg>` clips there by default.
 *
 * ⛔ SIZED TO THE RING, NOT THE DOT, AND THAT CORRECTION IS THE WHOLE POINT OF
 * THIS DOCBLOCK. It was `TERMINAL_DOT_R + 1` = 4 — correct for the r=3 dot and
 * for nothing else. The pulse ring added in the same commit range is the same
 * circle scaled to 2.4, so its outer edge reaches **7.2** units and the halo was
 * cut by a straight vertical chord 3.2 units outside the box: barely visible on
 * the collapsed card, roughly 4 CSS px off a 9 px radius on the expanded
 * overlay. **A length that was right for one mark, reused as the budget for a
 * larger one** — the exact failure this task exists to correct, committed inside
 * the task correcting it. Caught by `@code-reviewer` at the CHART-2 cascade.
 * ⚠ THE COST IS REAL AND SMALL: the allowance goes 4 → 9, so the plot takes
 * 640/649 = 98.6 % of the `<svg>` rather than the 99.4 % a dot-sized allowance
 * would have bought. The expanded post nodes
 * (`r=4` plus a 1.5px rim) also fit now, which they did not at 4.
 * ⚠ WHAT THIS DOES **NOT** FIX, said rather than left to be discovered: the ring
 * still clips VERTICALLY on a market near 0 % or 100 %, because the dot sits at
 * its true `cy` and a price of 99 % puts that 3.2 units from the top edge. The
 * dot marks a price and may not be moved to flatter a decoration, and padding
 * the viewBox vertically would rescale `yYesPx`/`yNoPx` for every chart in the
 * product. A halo trimmed at the very top of an almost-resolved market is the
 * honest cost of both of those.
 *
 * ⛔ THIS REPLACES A 38-UNIT LABEL GUTTER, AND THE DELETION IS THE POINT.
 * CHART-1 sized that gutter by hand-measuring the string `YES` at 23.41 user
 * units and pinning **26** — a ~11 % headroom bought because the measuring
 * engine resolved the font stack to `ui-sans-serif`, Geist being unfetchable
 * offline through `next/font/google`. That pin was a guess about a font nobody
 * could measure, guarding a horizontal clip nothing asserted. **The labels are
 * HTML now and the browser measures them in the real face**, so the pin is
 * deleted rather than left stale, and no constant in this module encodes a
 * string's width any more.
 */
export const TERMINAL_DOT_ALLOWANCE = Math.ceil(TERMINAL_PULSE_MAX_R) + 1;

/**
 * The `<svg viewBox>` width — the plot plus the terminal allowance. **649.**
 *
 * ⛔ IT IS STILL ADDED TO THE VIEWBOX RATHER THAN SUBTRACTED FROM THE PLOT, so
 * `VIEWBOX_W` remains the PLOT width, `xPx` still maps the domain onto 0…640,
 * and no plotted coordinate has moved at CHART-1 or here. What changed is the
 * SIZE of the addition: 38 → 9.
 *
 * ⚠ AND THAT IS A USER-SPACE FACT WITH A CSS-PIXEL CONSEQUENCE, which is the
 * distinction CHART-1 got wrong. Because `preserveAspectRatio="none"` maps the
 * whole viewBox onto the CSS box, a wider viewBox renders the PLOT narrower in
 * the same box: at 678 the plot took 640/678 = 94.4 % of the `<svg>`'s width.
 * At 649 it takes 640/649 = **98.6 %**.
 *
 * ⛔⛔ THAT IS NOT THE SAME AS THE PLOT GETTING WIDER, AND MEASUREMENT SAYS IT
 * DID NOT. The CHART-2 brief predicted this change would "close the docketed D4
 * 5.6 % item". **It does not, and the honest number is the other way.** The
 * `<svg>` no longer occupies the whole container: the label gutter is CSS now,
 * so it takes its width from the ROW rather than from the viewBox. Measured in
 * the CHART-2 contact sheet, in the shipped Geist face, on the collapsed card's
 * real 316px box:
 *
 *     before  svg 316.00 wide, viewBox 678  →  plot 298.29 CSS px
 *     after   svg 288.85 wide, viewBox 649  →  plot 284.85 CSS px   (−13.44 px)
 *
 * **The plot is ~4.5 % NARROWER than CHART-1 left it, not 5.3 % wider.** A
 * gutter has to be taken from somewhere, and moving it out of the viewBox moves
 * where it is taken from without making it free — it makes it BIGGER, because
 * the label inside it is now a legible 10px instead of a squashed 5.38px and a
 * bigger glyph needs more room. That is the trade, stated plainly rather than
 * booked as a recovery: **the two words at the line ends went from 5.38px to
 * 10px, and the plot paid 13.44px of width for it.**
 * ⚠ What the 98.6 % figure IS good for is the thing it actually governs — the
 * DATE LABELS still inside the `<svg>`, whose distortion fell from an anisotropy
 * of 1.0885 to 1.0394 because the viewBox is closer to the box's own shape.
 */
export const SVG_W = VIEWBOX_W + TERMINAL_DOT_ALLOWANCE;

/** Minimum vertical centre-to-centre distance between the two end labels before
 * they read as one smudge, **in PLOT USER UNITS**: ten units of type plus two of
 * air.
 * ⛔ THOSE UNITS ARE NOT CSS PIXELS ANY MORE, AND THIS DOCBLOCK SAID THEY WERE.
 * It read "the 10px type plus 2px of air", which was exact while the label was
 * SVG `<text>` at `font-size: 10` in this same space. Since CHART-2 the label is
 * HTML at 10 **CSS px**, and a plot unit is 0.42822 CSS px on the collapsed card
 * — so twelve of them is **5.14 px** between two boxes that are 10 px tall.
 * ⚠ THE CONSTANT IS STILL RIGHT AND STILL USED; what changed is that it is no
 * longer SUFFICIENT on its own. `terminalLabelYs` below is unchanged (clause 4
 * is a scope fence) and still separates in plot space; the CSS-pixel floor that
 * makes the separation hold on every surface lives in `MarketPriceChart`'s
 * `upperTop`/`lowerTop`. Read this number as "clause 4's own threshold", never
 * as "the gap the reader sees". */
export const TERMINAL_LABEL_MIN_GAP = 12;

/** Keep a label's centre far enough inside the plot that its box stays within
 * the plot's vertical extent (`C-CHART-2` clause 3). **6 is half the box IN
 * PLOT UNITS**, which is what this function works in.
 * ⛔ SAME UNIT CORRECTION AS `TERMINAL_LABEL_MIN_GAP` ABOVE: this said "its 10px
 * box … 6 is half that box", true of a 10-UNIT `<text>` and false of the 10-CSS-
 * PX HTML label the chart ships since CHART-2 — six plot units is 2.57 px of
 * clearance on the collapsed card for a 5 px half-box. The floor that actually
 * holds the edges is the outer `clamp()` in `MarketPriceChart`'s `upperTop`/
 * `lowerTop`; this one keeps clause 4's own arithmetic inside its own space. */
function clampLabelY(y: number): number {
	return Math.min(Math.max(y, 6), VIEWBOX_H - 6);
}

/**
 * Where the two end labels sit — `C-CHART-2` clause 4.
 *
 * ⛔ THE OVERLAP IS THE DEFAULT CASE, NOT AN EDGE CASE, and the arithmetic says
 * why. YES and NO mirror about 50 %, so their vertical separation is
 * `320·|1−2p|` — proportional to how far the market is from even. Against
 * `TERMINAL_LABEL_MIN_GAP` that puts the collision at roughly **48 %–52 %**,
 * which is where every market sits the moment it opens and where all eight
 * seeded markets sit today. A build that treated this as a rare case would be a
 * build whose normal rendering is broken.
 *
 * When they collide the labels are pushed apart symmetrically, each by half the
 * deficit plus 2px, then clamped. ⚠ **THE DOTS DO NOT MOVE** — only the labels
 * do. A displaced label is still unambiguous because it is filled with its own
 * series token and sits beside its own dot, whereas a displaced DOT would be a
 * false statement about a price.
 *
 * ⚠ At exact coincidence (a market with no bets: both lines at the opening
 * price) the two y values are equal and the direction of the push is a tie. YES
 * takes the upper slot, deterministically — arbitrary, but arbitrary and STABLE
 * beats arbitrary and per-render. The LINES are still drawn coincident, one
 * over the other, with no offset invented to separate them (`C-CHART-2`
 * clause 5): the label pair carries the information, and a half-pixel gap
 * conjured to make two identical values look different is a lie told on the
 * surface where stake is committed.
 */
export function terminalLabelYs(yes: string): { yes: number; no: number } {
	const yYes = yYesPx(yes);
	const yNo = yNoPx(yes);
	const gap = Math.abs(yYes - yNo);
	if (gap >= TERMINAL_LABEL_MIN_GAP) {
		// ⚠ CLAMPED HERE TOO — and this line is a FIX, not symmetry for its own
		// sake. The early return originally handed back the raw positions on the
		// reasoning that a non-colliding pair needs no adjustment. Collision and
		// CLIPPING are different failures: at YES ≳ 98.44 % the two labels are 300
		// units apart and perfectly legible, while the upper one's 10px box sits
		// at y ≈ −1.8, outside the plot's vertical extent. A binary market a week
		// from resolution lives exactly there.
		// ⚠ THE CLIP SURFACE CHANGED AT CHART-2 AND THE CLAMP STILL EARNS ITS
		// KEEP. It used to be the `<svg>` edge, which clips by default; the labels
		// are HTML in a gutter now, and a gutter does NOT clip — an unclamped
		// label would instead escape upward past the top of the chart and collide
		// with whatever the surface puts above it. Different failure, same fix,
		// and worth saying so rather than leaving a reader to assume the clamp
		// went vestigial when its enclosure did.
		// ⛔ Caught by `@test-writer` at the CHART-1 audit, which also found that
		// the case NAMED for the clamp could never have caught it: it asserted the
		// label's CENTRE was inside `0…VIEWBOX_H` rather than its BOX, so deleting
		// `clampLabelY` outright left it green. The assertion now measures the box.
		return { yes: clampLabelY(yYes), no: clampLabelY(yNo) };
	}
	const push = (TERMINAL_LABEL_MIN_GAP - gap) / 2 + 2;
	const yesGoesUp = yYes <= yNo;
	return {
		yes: clampLabelY(round(yYes + (yesGoesUp ? -push : push))),
		no: clampLabelY(round(yNo + (yesGoesUp ? push : -push))),
	};
}

/**
 * A plot-space y (0…`VIEWBOX_H`) as a PERCENTAGE of the plot's rendered height
 * — the one bridge between the SVG's user space and the HTML gutter's CSS
 * space (`C-CHART-2` clause 2, CHART-2).
 *
 * ⛔ THIS IS A CONVERSION, NOT A SECOND DERIVATION, and that distinction is the
 * whole reason the collision rule could stay untouched. `terminalLabelYs` still
 * computes everything — the 12-unit minimum gap, the symmetric push, the clamp,
 * the YES-takes-upper tie-break — in plot space, exactly as it did when the
 * labels were `<text>`. All that changed is where its answer is spent.
 *
 * ⚠ WHY A PERCENTAGE AND NOT A PIXEL OFFSET. `preserveAspectRatio="none"` maps
 * `VIEWBOX_H` onto the plot box's full height whatever that height is, so a
 * fraction of the viewBox IS the same fraction of the rendered box — at every
 * mode, every viewport, and every carousel position. A pixel offset would have
 * to know the box's height, which is exactly the thing that varies and exactly
 * the reason the labels are leaving the SVG in the first place. This is what
 * makes the label's centre land on its dot's rendered `cy` **by construction**
 * rather than by a number that happens to agree at one size.
 */
export function labelTopPct(y: number): number {
	// ⚠ FOUR DECIMAL PLACES, NOT THE MODULE'S USUAL TWO, AND THE REASON IS A UNIT
	// CHANGE RATHER THAN A TASTE FOR PRECISION. Everywhere else in this module
	// `round` trims a PLOT-UNIT coordinate, where 0.01 is already far below a
	// rendered pixel. Here the quantity becomes a PERCENTAGE OF 320, so two
	// decimal places would quantise the position to 0.032 plot units and a label
	// could no longer land exactly on the y `terminalLabelYs` computed. Harmless
	// on screen; corrosive in a guard, because the alignment assertion would have
	// to be loosened to absorb an error this function invented. Four places puts
	// the round-trip error at ~1e-4 units, which is nothing on either side.
	return Math.round((y / VIEWBOX_H) * 100 * 10000) / 10000;
}

/**
 * A viewBox-space x (0…`SVG_W`) as a PERCENTAGE of the plot box's rendered width
 * — the horizontal mirror of `labelTopPct`, and the whole of `C-CHART-2` clause 2
 * as amended at CHART-6.
 *
 * ⛔⛔ IT DIVIDES BY `SVG_W`, NOT BY `VIEWBOX_W`, AND THAT IS THE ONE THING TO GET
 * RIGHT HERE. `preserveAspectRatio="none"` maps the WHOLE viewBox — all 649 units
 * of it, plot plus terminal allowance — onto the plot box's full width. So a mark
 * at user-space x renders at `(x / SVG_W) · boxWidth`, and dividing by
 * `VIEWBOX_W` (640) would place every label 1.4 % of the plot right of its own
 * dot: small enough to look like a deliberate gap, large enough to be wrong, and
 * invisible to any assertion that compares two numbers both computed this way.
 * Verified against the shipped build rather than argued: the EXPANDED overlay's
 * dot at `cx = 94.86` renders 113.32 px into its 775.27 px plot, and
 * `94.86 / 649 × 775.27 = 113.32`. ⚠ This said "the collapsed dot" and quoted the
 * expanded plot's width — the arithmetic was right and the surface named was
 * wrong, on the one measurement that justifies the divisor. Caught by
 * `@code-reviewer`.
 *
 * ⛔ WHY THIS EXISTS AT ALL — THE DEFECT CHART-6 CORRECTS. Until this function the
 * label's x was a CONSTANT (`left: 5px` inside a fixed gutter) while the dot's x
 * was DERIVED from the series. The two agreed only when the series happened to
 * run to the axis end, which was always true while the domain WAS the series' own
 * span, and stopped being true the moment CHART-3 fixed the axis. Measured on
 * staging: 515 px between a hero label and the dot it names, on a 597 px plot.
 * **A coordinate that is right only when two independent quantities happen to be
 * equal is wrong, and it is invisible until they diverge.**
 *
 * ⚠ FOUR DECIMAL PLACES, for `labelTopPct`'s reason exactly — the quantity becomes
 * a percentage of 649, so two places would quantise the position to 0.065 user
 * units and the label could no longer land on the x its dot was drawn at.
 */
export function labelLeftPct(x: number): number {
	return Math.round((x / SVG_W) * 100 * 10000) / 10000;
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

// ⛔ A FUNCTION DECLARATION, NOT A `const` ARROW, AND THE FORM IS LOAD-BEARING.
// The frozen gridline sets near the top of this module are built AT MODULE LOAD,
// several hundred lines above this point. Against a `const` arrow that is a
// temporal-dead-zone `ReferenceError` on import — so `yPctPx` was written with
// its own inlined copy of this one-liner and a docblock explaining why. Two
// copies of one rounding rule in one module is a real hazard: change this to 3 dp
// for coordinates and the gridline y's silently keep 2 dp and stop agreeing with
// the line and dot y's they are drawn to align with. A declaration hoists, so the
// constraint disappears instead of being documented — structural beats
// procedural (`O-1`). Raised by `@code-reviewer` at the CHART-5 cascade.
function round(v: number): number {
	return Math.round(v * 100) / 100;
}

/** "Sep 15" — UTC month + day (locale/timezone-free, deterministic). */
export function fmtUtcDay(iso: string): string {
	const d = new Date(iso);
	return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** ISO instant → x pixel over the chart's domain, FULL-BLEED: `startMs` → 0,
 * `endMs` → `VIEWBOX_W`. A degenerate domain (`startMs === endMs`) collapses to
 * the start edge (0) — a FINITE value, never NaN; the component spans the flat
 * line to `VIEWBOX_W`.
 *
 * ⚠ THE DOMAIN IS THE FIXED EXPERIMENT WINDOW SINCE CHART-3, not the market's
 * lifetime, and this docblock said the latter. Two consequences for callers:
 * the degenerate branch above is now unreachable from the shipped call sites
 * (the window is a non-empty constant), and **the return value is NOT clamped
 * IN EITHER DIRECTION** — an instant outside the window maps outside
 * `0 … VIEWBOX_W` and is clipped by the viewBox. That is deliberate: clamping
 * would place a point at a time it did not happen, and a price at the wrong
 * time is a false statement about the market rather than a stale one.
 *
 * ⛔ "EITHER DIRECTION" IS LOAD-BEARING AND WAS MISSING. Every artefact in the
 * CHART-3 branch — this docblock, the component's comment, the constants, the
 * §17 row, the named guard — reasoned only about instants PAST the window end.
 * The left edge is the one that is structural rather than hypothetical:
 * `MARKET_CHART_WINDOW_START` is the experiment's OPENING instant, and a market
 * must reach `Open` BEFORE that for anyone to bet at launch — so
 * `market.opened`, the genesis point §9 calls "the opening price", maps to a
 * NEGATIVE x on every production market and is clipped. Measured on the shipped
 * component: a market opened 2026-09-14T18:30Z draws its first two points at
 * x = −2.82 and −2.05.
 *
 * Both directions are guarded (`tests/unit/debate/render/price-chart.test.tsx`),
 * because a one-sided guard is what let `Math.max(0, …)` pass a 3 792-test suite.
 * ⚠ Whether the production START should instead be the earliest `market.opened`
 * — which is what the STAGING constant already is, measured from data — is a
 * founder ruling this branch flags and does not take. Found by
 * `@security-auditor` at the CHART-3 cascade. */
export function xPx(iso: string, startMs: number, endMs: number): number {
	const t = Date.parse(iso);
	const frac = endMs === startMs ? 0 : (t - startMs) / (endMs - startMs);
	return round(frac * VIEWBOX_W);
}

/** YES probability → y pixel for the YES line: `(1 − p)·H` (p = YES prob, 0..1);
 * p = 1 sits at the top (0), p = 0 at the bottom (H). Clamped to [0, 1]. */
export function yYesPx(yes: string): number {
	const p = Math.min(1, Math.max(0, Number(yes)));
	return round((1 - p) * VIEWBOX_H);
}

/** YES probability → y pixel for the NO line: `p·H` — the mirror of the YES
 * line about the 50 % midline (design-language §3.2; the two always sum to H).
 * Takes the YES probability so the component never does `1 − yes` string math. */
export function yNoPx(yes: string): number {
	const p = Math.min(1, Math.max(0, Number(yes)));
	return round(p * VIEWBOX_H);
}
