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
 * gutter in the viewBox — the labels are HTML beside the plot now — so all the
 * viewBox still reserves is a **dot allowance**, `TERMINAL_DOT_ALLOWANCE`,
 * enough that the terminal circle at `cx = VIEWBOX_W` cannot half-clip on the
 * right edge. The plot is full-bleed across `VIEWBOX_W × VIEWBOX_H`, `xPx`
 * still maps a domain onto 0…640, no plotted coordinate has ever moved, and
 * the `<svg>` is `SVG_W` wide — but `SVG_W` is now 644 rather than 678, which
 * is what gives the plot back the width CHART-1 spent on text. Y is untouched
 * and full-bleed outright.
 *
 * PURE DISPLAY GEOMETRY only: a canonical price string is read as a number
 * SOLELY to place an SVG point / label a percent — no money arithmetic happens
 * here; the canonical values stay server-computed strings (CLAUDE.md §2).
 */

export const VIEWBOX_W = 640;
export const VIEWBOX_H = 320;

/** Terminal dot radius — `C-CHART-2` clause 1. Deliberately NOT `C-CHART-1`
 * clause 2's `r=4` post node, and deliberately rimless: the two marks mean
 * different things (where the series ENDS vs. where a post SITS) and are told
 * apart by the label beside this one, not by a one-pixel radius difference. */
export const TERMINAL_DOT_R = 3;

/**
 * The ONLY thing the viewBox reserves to the right of the plot — `C-CHART-2`
 * clause 3, as amended at CHART-2. The terminal dot is centred at
 * `cx = VIEWBOX_W`, so without an allowance its right half would sit outside
 * the viewBox and an `<svg>` clips there by default. Radius plus one unit of
 * air.
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
export const TERMINAL_DOT_ALLOWANCE = TERMINAL_DOT_R + 1;

/**
 * The `<svg viewBox>` width — the plot plus the dot allowance. **644.**
 *
 * ⛔ IT IS STILL ADDED TO THE VIEWBOX RATHER THAN SUBTRACTED FROM THE PLOT, so
 * `VIEWBOX_W` remains the PLOT width, `xPx` still maps the domain onto 0…640,
 * and no plotted coordinate has moved at CHART-1 or here. What changed is the
 * SIZE of the addition: 38 → 4.
 *
 * ⚠ AND THAT IS A USER-SPACE FACT WITH A CSS-PIXEL CONSEQUENCE, which is the
 * distinction CHART-1 got wrong. Because `preserveAspectRatio="none"` maps the
 * whole viewBox onto the CSS box, a wider viewBox renders the PLOT narrower in
 * the same box: at 678 the plot took 640/678 = 94.4 % of the width, so every
 * `/m/[slug]` chart drew ≈5.6 % narrower than it had. At 644 it takes
 * 640/644 = 99.4 %. **That recovers ≈5.3 of the 5.6 points**; the residual
 * 0.62 % is the dot allowance and is the price of the dot not clipping.
 */
export const SVG_W = VIEWBOX_W + TERMINAL_DOT_ALLOWANCE;

/** Minimum vertical centre-to-centre distance between the two end labels before
 * they read as one smudge: the 10px type plus 2px of air. */
export const TERMINAL_LABEL_MIN_GAP = 12;

/** Keep a label's centre far enough inside the plot that its 10px box stays
 * within the plot's vertical extent (`C-CHART-2` clause 3, "clamped inside the
 * plot's vertical extent"). 6 is half that box. */
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

const round = (v: number): number => Math.round(v * 100) / 100;

/** "Sep 15" — UTC month + day (locale/timezone-free, deterministic). */
export function fmtUtcDay(iso: string): string {
	const d = new Date(iso);
	return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** ISO instant → x pixel over the market lifetime domain, FULL-BLEED:
 * `startMs` → 0, `endMs` → `VIEWBOX_W`. A degenerate domain (`startMs ===
 * endMs`, the single-point unbet market) collapses to the start edge (0) — a
 * FINITE value, never NaN; the component spans the flat line to `VIEWBOX_W`. */
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
