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

/** The market-detail price-chart SVG (SPEC.1 1.0.22 §9 / F-DEBATE-5) — two
 * complementary YES/NO probability lines mirrored about 50 % (design-language
 * §3.2), fixed Y 0–100 %, X spanning the market lifetime. COLLAPSED renders the
 * two lines only (no axis, no nodes). EXPANDED adds the two X endpoint labels
 * (`market.opened` · last event); interior ticks are canon-owned, not built.
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
