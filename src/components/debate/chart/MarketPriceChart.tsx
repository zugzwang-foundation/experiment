"use client";

import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import {
	fmtUtcDay,
	VIEWBOX_H,
	VIEWBOX_W,
	xPx,
	yNoPx,
	yYesPx,
} from "./geometry";

export type MarketPriceChartMode = "collapsed" | "expanded";

/** The market-detail price-chart SVG (SPEC.1 1.0.32 §9 / F-DEBATE-5) — two
 * complementary YES/NO probability lines mirrored about 50 % (design-language
 * §3.2), fixed Y 0–100 %, X spanning the market lifetime.
 *
 * ⚠⚠ COLLAPSED NOW CARRIES A TIME AXIS — two interior ticks and three date
 * labels — and this sentence used to read "COLLAPSED renders the two lines only
 * (no axis, no nodes)". SPEC.1 1.0.32 reverses that pin at all four of its
 * operative sites (§9 :490, F-DEBATE-5 System :515 and Acceptance :517, §17
 * :1260): the collapsed card was specified without an axis when it was a
 * sparkline, and it is now the market's primary price surface in the header
 * rail, where a price series without a time axis is not readable. ⛔ COLLAPSED
 * STILL RENDERS NO NODES — only the axis half moved. EXPANDED is UNTOUCHED: the
 * two X endpoint labels (`market.opened` · last event), and interior ticks there
 * remain canon-owned and unbuilt.
 * Post nodes arrive in Slice 2. The SVG is `aria-hidden` (decorative) — the
 * accessible readout lives in the card's `sr-only` summary. Strokes bind by the
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
}: {
	series: PricePoint[];
	nodes?: ChartNode[];
	mode: MarketPriceChartMode;
}): React.JSX.Element {
	const startMs = series.length > 0 ? Date.parse(series[0].at) : 0;
	const endMs =
		series.length > 0 ? Date.parse(series[series.length - 1].at) : 0;

	return (
		<svg
			data-testid="market-price-chart"
			viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
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
			    the guard that names it. */}
			{mode === "collapsed" && (
				<CollapsedAxis series={series} startMs={startMs} endMs={endMs} />
			)}

			{/* EXPANDED only — the two X endpoint labels (no interior ticks, §9). */}
			{mode === "expanded" && series.length > 0 && (
				<>
					<text
						data-testid="axis-x-start"
						x={0}
						y={VIEWBOX_H - 8}
						className="fill-n5 text-[10px]"
						textAnchor="start"
					>
						{fmtUtcDay(series[0].at)}
					</text>
					<text
						data-testid="axis-x-end"
						x={VIEWBOX_W}
						y={VIEWBOX_H - 8}
						className="fill-n5 text-[10px]"
						textAnchor="end"
					>
						{fmtUtcDay(series[series.length - 1].at)}
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
						fill={node.side === "YES" ? "var(--graph-yes)" : "var(--graph-no)"}
						stroke="var(--color-ground)"
						strokeWidth="1.5"
						vectorEffect="non-scaling-stroke"
					/>
				))}
		</svg>
	);
}

/**
 * The COLLAPSED chart's time axis — SPEC.1 1.0.32 (HTML-FINISH · MARKET DETAIL
 * round 2 · R8, founder-ruled 2026-08-16). d5's `.xtick` ×2 + `.xlab` ×2 +
 * `.xlab.end` (`d5:1014-1018`).
 *
 * ⛔⛔ EVERY TIMESTAMP IT RENDERS IS A REAL `PricePoint.at`, AND THAT IS THE
 * RULING'S OWN CONSTRAINT: *"it introduces no new data and no new read — every
 * timestamp it renders is already carried on `PricePoint.at`."* So the ticks are
 * ANCHORED TO SERIES POINTS, not placed at fixed 33.3%/66.6% fractions with an
 * INTERPOLATED date under them. d5 does the latter, because d5's dates are demo
 * copy; interpolating `start + (end − start)/3` here would mint a timestamp the
 * series does not contain, which is exactly what the ruling forecloses.
 * ⇒ Each interior tick is the series point whose x lands nearest the third, the
 * tick sits at THAT point's own `xPx`, and the label under it is THAT point's
 * own day. Tick and label therefore always agree, and the axis cannot claim a
 * reading the data does not support.
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
	// The two interior anchors: the series point whose x lands nearest each
	// third. `nearestPoint` scans rather than indexes, because the series is
	// downsampled by uniform INDEX stride while x is computed from TIME — the
	// point at index n/3 can sit anywhere on the axis.
	const interior = [1 / 3, 2 / 3].map((f) =>
		nearestPoint(series, startMs, endMs, f * VIEWBOX_W),
	);
	const last = series[series.length - 1];

	return (
		<>
			{interior.map((p, i) => (
				<line
					// Index-keyed on purpose: these two are a FIXED PAIR of positions
					// (first third, second third), not an identity-bearing list, and two
					// points can legitimately resolve to the same `at`.
					key={`tick-${i === 0 ? "first" : "second"}`}
					data-testid={`axis-x-tick-${i === 0 ? "first" : "second"}`}
					x1={xPx(p.at, startMs, endMs)}
					x2={xPx(p.at, startMs, endMs)}
					y1={0}
					y2={VIEWBOX_H}
					stroke="var(--color-n2)"
					strokeWidth="1"
					strokeDasharray="5 4"
					vectorEffect="non-scaling-stroke"
				/>
			))}
			{interior.map((p, i) => (
				<text
					key={`lab-${i === 0 ? "first" : "second"}`}
					data-testid={`axis-x-label-${i === 0 ? "first" : "second"}`}
					x={xPx(p.at, startMs, endMs)}
					y={VIEWBOX_H - 8}
					className="fill-n5 text-[10px]"
					textAnchor="middle"
				>
					{fmtUtcDay(p.at)}
				</text>
			))}
			{/* `.xlab.end` (`d5:499`) — right-anchored at the domain's end, so it
			    cannot overflow the viewBox the way a centred label would. */}
			<text
				data-testid="axis-x-label-end"
				x={VIEWBOX_W}
				y={VIEWBOX_H - 8}
				className="fill-n5 text-[10px]"
				textAnchor="end"
			>
				{fmtUtcDay(last.at)}
			</text>
		</>
	);
}

/** The series point whose plotted x is closest to `targetX`. Pure display
 * selection over already-computed geometry — no money or price arithmetic. */
function nearestPoint(
	series: PricePoint[],
	startMs: number,
	endMs: number,
	targetX: number,
): PricePoint {
	let best = series[0];
	let bestGap = Number.POSITIVE_INFINITY;
	for (const p of series) {
		const gap = Math.abs(xPx(p.at, startMs, endMs) - targetX);
		if (gap < bestGap) {
			bestGap = gap;
			best = p;
		}
	}
	return best;
}

/** An SVG `points` string for one line. With fewer than two points OR a
 * degenerate domain (`startMs === endMs`, the unbet market), draws a FULL-WIDTH
 * FLAT LINE — the value duplicated at x = 0 and x = VIEWBOX_W (the
 * `PriceSparkline` "duplicate at both ends" trick; SPEC.1 §9 "flat line at the
 * opening price"). */
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
		return `0,${y} ${VIEWBOX_W},${y}`;
	}
	return series
		.map((p) => `${xPx(p.at, startMs, endMs)},${yFn(p.yes)}`)
		.join(" ");
}
