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
 * PURE DISPLAY GEOMETRY only: a canonical price string is read as a number
 * SOLELY to place an SVG point / label a percent — no money arithmetic happens
 * here; the canonical values stay server-computed strings (CLAUDE.md §2 /
 * `PriceSparkline` doctrine).
 */

export const VIEWBOX_W = 640;
export const VIEWBOX_H = 320;

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

/** "50%" — a whole-percent probability label for the accessible summary. A
 * DISPLAY read of a canonical price string (never money math). */
export function fmtPct(yes: string): string {
	return `${Math.round(Number(yes) * 100)}%`;
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
