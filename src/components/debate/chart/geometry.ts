/**
 * UI.19 §9 market-detail price-chart display geometry — the d3-free linear
 * scale layer (the `PriceSparkline` / profile-graph precedent: the repo carries
 * no d3, and linear scales + polyline strings suffice). DUPLICATED from
 * `profile/graph/geometry.ts` per web Gate-C ruling #2 — deliberately NOT a
 * shared module: coupling §23↔§9 through one file would let a profile change
 * silently alter the market chart, and the Y semantics differ (fixed 0–100 %
 * probability here, Đ 0–10000 autoscale there). This module is FULL-BLEED — the
 * market chart's X spans the whole width and Y the whole height (no axis
 * gutter), unlike the profile module's margined inset.
 *
 * ⚠ "FULL-BLEED" NOW DESCRIBES THE PLOT, NOT THE `<svg>` — corrected here at
 * CHART-1 rather than left reading as an absolute a later reader would trust.
 * `C-CHART-2` clause 3 adds a RIGHT GUTTER for the end labels, and it is added
 * to the viewBox rather than taken out of the plot. So the plot is still
 * full-bleed across `VIEWBOX_W × VIEWBOX_H`, `xPx` still maps a domain onto
 * 0…640, and no existing coordinate moved; the `<svg>` is `SVG_W` wide. Y is
 * untouched and full-bleed outright.
 *
 * PURE DISPLAY GEOMETRY only: a canonical price string is read as a number
 * SOLELY to place an SVG point / label a percent — no money arithmetic happens
 * here; the canonical values stay server-computed strings (CLAUDE.md §2 /
 * `PriceSparkline` doctrine).
 */

export const VIEWBOX_W = 640;
export const VIEWBOX_H = 320;

/** Terminal dot radius — `C-CHART-2` clause 1. Deliberately NOT `C-CHART-1`
 * clause 2's `r=4` post node, and deliberately rimless: the two marks mean
 * different things (where the series ENDS vs. where a post SITS) and are told
 * apart by the label beside this one, not by a one-pixel radius difference. */
export const TERMINAL_DOT_R = 3;

/** Gap between the terminal dot's edge and the start of its label. */
const TERMINAL_LABEL_GAP = 5;

/**
 * Horizontal room reserved for one end label, in viewBox user units.
 *
 * ⛔ MEASURED, NOT ESTIMATED — `C-CHART-2` clause 3 requires the gutter be sized
 * to the rendered text advance. Measured with `getComputedTextLength()` on an
 * SVG `<text>` carrying this component's exact type — `font-size: 10px`,
 * `font-weight: 700`, `letter-spacing: 0.1em` — in Chrome:
 *
 *     "YES" → 23.41 user units      "NO" → 17.78 user units
 *
 * `YES` is the binding case. The pin is **26**, ~11 % above the measurement,
 * because the measuring engine resolved the stack to `ui-sans-serif`: Geist
 * ships through `next/font/google` and cannot be fetched offline, so the exact
 * shipped advance is a font-metric difference away from the number above. The
 * headroom absorbs that, and `terminalLabelYs` clamps besides, so a wider face
 * shifts the label rather than clipping it. ⚠ If Geist's advance is ever
 * measured directly, correct this number — do not add a second constant.
 */
const TERMINAL_LABEL_ADVANCE = 26;

/** Trailing breathing room between the label and the viewBox edge. */
const TERMINAL_LABEL_PAD = 4;

/**
 * The right gutter — `C-CHART-2` clause 3. Dot + gap + label + pad = **38**.
 *
 * ⛔ IT IS ADDED TO THE VIEWBOX, NOT SUBTRACTED FROM THE PLOT, and that is the
 * clause's own instruction: *"the plot's 2:1 aspect is preserved; the gutter is
 * taken from the viewBox, not from the aspect."* So `VIEWBOX_W` stays the PLOT
 * width, `xPx` still maps the domain onto 0…640, and every coordinate any
 * existing guard asserts is unchanged. Subtracting the gutter from the plot
 * instead would have silently moved every point on every chart in the product
 * to buy the same 38 units.
 */
export const TERMINAL_GUTTER =
	TERMINAL_DOT_R +
	TERMINAL_LABEL_GAP +
	TERMINAL_LABEL_ADVANCE +
	TERMINAL_LABEL_PAD;

/** The `<svg viewBox>` width — the 2:1 plot plus the label gutter. */
export const SVG_W = VIEWBOX_W + TERMINAL_GUTTER;

/** x where a terminal label begins (`textAnchor="start"`), just past its dot. */
export const TERMINAL_LABEL_X = VIEWBOX_W + TERMINAL_DOT_R + TERMINAL_LABEL_GAP;

/** Minimum vertical centre-to-centre distance between the two end labels before
 * they read as one smudge: the 10px type plus 2px of air. */
export const TERMINAL_LABEL_MIN_GAP = 12;

/** Keep a label's centre far enough inside the plot that its 10px box cannot
 * clip on either edge (`C-CHART-2` clause 3, "clamped inside the box"). */
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
		return { yes: yYes, no: yNo };
	}
	const push = (TERMINAL_LABEL_MIN_GAP - gap) / 2 + 2;
	const yesGoesUp = yYes <= yNo;
	return {
		yes: clampLabelY(round(yYes + (yesGoesUp ? -push : push))),
		no: clampLabelY(round(yNo + (yesGoesUp ? push : -push))),
	};
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
