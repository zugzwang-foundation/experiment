/**
 * UI-A5 profile-graph display geometry — the lightweight linear scale layer
 * (the W2.6 port, rebuilt WITHOUT d3: the repo carries no d3 dependency, and
 * linear scales + polyline strings are the `PriceSparkline` precedent). PURE
 * DISPLAY GEOMETRY only: a canonical Đ string is read as a number SOLELY to
 * place an SVG point — no money arithmetic happens here; the canonical values
 * stay server-computed strings (CLAUDE.md §2 / `PriceSparkline` doctrine).
 */

export const VIEWBOX_W = 640;
export const VIEWBOX_H = 320;
const MARGIN = { top: 16, right: 18, bottom: 28, left: 44 };
const INNER_W = VIEWBOX_W - MARGIN.left - MARGIN.right;
const INNER_H = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

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

/** "Sep 15" — UTC month + day (locale/timezone-free, deterministic). */
export function fmtUtcDay(iso: string): string {
	const d = new Date(iso);
	return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** ISO instant → x pixel over the window. */
export function xPx(iso: string, startMs: number, endMs: number): number {
	const t = Date.parse(iso);
	const frac = endMs === startMs ? 0 : (t - startMs) / (endMs - startMs);
	return round(MARGIN.left + frac * INNER_W);
}

/** Đ value → y pixel (inverted: 0 at the bottom, `yMax` at the top). */
export function yPx(value: string, yMax: number): number {
	const v = Number(value);
	const frac = yMax <= 0 ? 0 : Math.min(1, Math.max(0, v / yMax));
	return round(MARGIN.top + (1 - frac) * INNER_H);
}

/** An SVG `points` attribute ("x,y x,y …") for a sample series. */
export function pointsAttr(
	samples: readonly { at: string; value: string }[],
	startMs: number,
	endMs: number,
	yMax: number,
): string {
	return samples
		.map((s) => `${xPx(s.at, startMs, endMs)},${yPx(s.value, yMax)}`)
		.join(" ");
}

/** The per-market autoscale ceiling (structural no-clip: `> max`, rounded to a
 * clean 5-interval bound — the `singleMarketYAxis` "Y4=b" rule). */
export function niceMax(values: readonly string[]): number {
	const max = values.reduce((m, v) => Math.max(m, Number(v)), 0);
	if (!(max > 0)) {
		return 1;
	}
	const raw = (max * 1.1) / 5;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const norm = raw / mag;
	const nice =
		norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
	return nice * mag * 5;
}
