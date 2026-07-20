"use client";

import type {
	GraphNode,
	PerMarketValueSegment,
	ProfileGraphSeries,
} from "@/server/profile/graph-series";

import {
	fmtUtcDay,
	niceMax,
	pointsAttr,
	VIEWBOX_H,
	VIEWBOX_W,
	xPx,
	yPx,
} from "./geometry";

export type ProfileChartMode = "placeholder" | "expanded";

/** The Dharma-graph SVG (the W2.6 port on the §10.8 Đb series). Three renders:
 * PLACEHOLDER (net-worth line only), EXPANDED-cumulative (net-worth +
 * free-Dharma + nodes on the net-worth line, fixed Y 0..yMax), and
 * EXPANDED-per-market (that market's SideEpisode segments — one polyline each,
 * a hard gap at every full sell-out — + nodes on the value line + a flip marker
 * per exited segment; autoscale Y; NO free-Dharma, N-4). Decorative strokes use
 * the brand `--graph-*` tokens, never hex (AGENTS.md §8). */
export function ProfileChart({
	series,
	selection,
	mode,
}: {
	series: ProfileGraphSeries;
	selection: string;
	mode: ProfileChartMode;
}): React.JSX.Element {
	const startMs = Date.parse(series.windowStart);
	const endMs = Date.parse(series.windowEnd);
	const cumulative = selection === "cumulative";
	const perMarket = mode === "expanded" && !cumulative;

	const marketSegments = perMarket
		? series.perMarket.filter((s) => s.marketId === selection)
		: [];
	const marketYMax = perMarket
		? niceMax(marketSegments.flatMap((s) => s.points.map((p) => p.value)))
		: series.yMax;
	const marketNodes = perMarket
		? series.nodes.filter((n) => n.marketId === selection)
		: series.nodes;

	return (
		<svg
			data-testid="profile-chart"
			viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="h-full w-full"
		>
			{/* X endpoint labels — exactly two (Sep 15 · Nov 5), no interior ticks. */}
			<text
				data-testid="axis-x-start"
				x={xPx(series.windowStart, startMs, endMs)}
				y={VIEWBOX_H - 8}
				className="fill-n5 text-[10px]"
				textAnchor="start"
			>
				{fmtUtcDay(series.windowStart)}
			</text>
			<text
				data-testid="axis-x-end"
				x={xPx(series.windowEnd, startMs, endMs)}
				y={VIEWBOX_H - 8}
				className="fill-n5 text-[10px]"
				textAnchor="end"
			>
				{fmtUtcDay(series.windowEnd)}
			</text>

			{/* CUMULATIVE / PLACEHOLDER — the net-worth line (fixed Y). */}
			{!perMarket && (
				<polyline
					data-testid="line-networth"
					points={pointsAttr(series.netWorth, startMs, endMs, series.yMax)}
					fill="none"
					stroke="var(--graph-no)"
					strokeWidth="1.75"
					strokeLinejoin="round"
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
				/>
			)}

			{/* EXPANDED-cumulative only — the free-Dharma line (cumulative-only, N-4)
			    + own nodes on the net-worth line. */}
			{mode === "expanded" && cumulative && (
				<>
					<polyline
						data-testid="line-freedharma"
						points={pointsAttr(series.freeDharma, startMs, endMs, series.yMax)}
						fill="none"
						stroke="var(--graph-yes)"
						strokeWidth="1.5"
						strokeDasharray="5 4"
						strokeLinejoin="round"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					{marketNodes.map((node) => (
						<GraphNodeMark
							key={node.id}
							node={node}
							x={xPx(node.at, startMs, endMs)}
							y={yPx(node.netWorthValue, series.yMax)}
						/>
					))}
				</>
			)}

			{/* EXPANDED-per-market — segments (one polyline each; hard gap), flip
			    markers at exits, nodes on the value line. */}
			{perMarket && (
				<>
					{marketSegments.map((seg) => (
						<Segment
							key={`${seg.marketId}-${seg.episodeIndex}`}
							seg={seg}
							startMs={startMs}
							endMs={endMs}
							yMax={marketYMax}
						/>
					))}
					{marketSegments
						.filter((seg) => seg.exitedAt !== null)
						.map((seg) => (
							<FlipMarker
								key={`flip-${seg.marketId}-${seg.episodeIndex}`}
								seg={seg}
								startMs={startMs}
								endMs={endMs}
								yMax={marketYMax}
							/>
						))}
					{marketNodes.map((node) => (
						<GraphNodeMark
							key={node.id}
							node={node}
							x={xPx(node.at, startMs, endMs)}
							y={yPx(node.marketValue, marketYMax)}
						/>
					))}
				</>
			)}
		</svg>
	);
}

/** One SideEpisode's value polyline (a hard gap is simply a separate element —
 * re-entry is a fresh segment, never a bridged path). */
function Segment({
	seg,
	startMs,
	endMs,
	yMax,
}: {
	seg: PerMarketValueSegment;
	startMs: number;
	endMs: number;
	yMax: number;
}): React.JSX.Element {
	return (
		<polyline
			data-testid={`segment-${seg.marketId}-${seg.episodeIndex}`}
			data-side={seg.side}
			points={pointsAttr(seg.points, startMs, endMs, yMax)}
			fill="none"
			stroke="var(--graph-no)"
			strokeWidth="1.75"
			strokeLinejoin="round"
			strokeLinecap="round"
			vectorEffect="non-scaling-stroke"
		/>
	);
}

/** The flip/exit marker at a full sell-out (the "C" anchor; the hard gap "A" is
 * the absent connector). Its OWN primitive — never a graph node. */
function FlipMarker({
	seg,
	startMs,
	endMs,
	yMax,
}: {
	seg: PerMarketValueSegment;
	startMs: number;
	endMs: number;
	yMax: number;
}): React.JSX.Element | null {
	const last = seg.points[seg.points.length - 1];
	if (last === undefined) {
		return null;
	}
	// The product's two-arrow SWAP icon (top shaft → right, bottom ← left) — the
	// "Flipped" mark the app stamps at a full sell-out (the "C" of F = A + C; the
	// hard gap "A" is the absent connector). A marker, NOT a node: a plain rim +
	// swap arrows, no grey core, no crowd ring (ported from the prototype FlipGlyph).
	const w = 6.5;
	const g = w * 0.42;
	const head = w * 0.5;
	return (
		<g
			data-testid={`flip-marker-${seg.marketId}-${seg.episodeIndex}`}
			data-side={seg.side}
			transform={`translate(${xPx(last.at, startMs, endMs)},${yPx(last.value, yMax)})`}
		>
			<circle
				r={w * 1.5}
				fill="var(--color-ground)"
				fillOpacity="0.9"
				stroke="var(--graph-yes)"
				strokeWidth="1.25"
				vectorEffect="non-scaling-stroke"
			/>
			<g
				fill="none"
				stroke="var(--graph-no)"
				strokeWidth="1.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d={`M${-w},${-g} L${w},${-g}`} />
				<path
					d={`M${w - head},${-g - head} L${w},${-g} L${w - head},${-g + head}`}
				/>
				<path d={`M${w},${g} L${-w},${g}`} />
				<path
					d={`M${-w + head},${g - head} L${-w},${g} L${-w + head},${g + head}`}
				/>
			</g>
		</g>
	);
}

/** One own post/reply node — the grey core + side ring (the R2 node primitive).
 * Placement is `netWorthValue` (cumulative) or `marketValue` (per-market). */
function GraphNodeMark({
	node,
	x,
	y,
}: {
	node: GraphNode;
	x: number;
	y: number;
}): React.JSX.Element {
	return (
		<g
			data-testid={`graph-node-${node.id}`}
			data-side={node.side}
			data-kind={node.kind}
			transform={`translate(${x},${y})`}
		>
			<circle
				r="5"
				fill={node.side === "YES" ? "var(--color-yes)" : "var(--color-no)"}
				stroke="var(--graph-yes)"
				strokeWidth="1"
			/>
			<circle r="2" fill="var(--graph-yes)" />
		</g>
	);
}
