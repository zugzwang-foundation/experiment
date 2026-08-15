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

	// `OD-9` — Y-AXIS INTERVALS, THE TWO CUMULATIVE ARMS ONLY. Both run the
	// fixed 0..`series.yMax` domain, ruled at 5 intervals collapsed and 10
	// expanded (DESIGN-W2_6-profile-graph-CLOSE-OUT.md §3 item 2).
	//
	// ⛔ The PER-MARKET view autoscales through `niceMax` and its interval count
	// is UNRULED, so it draws NONE and this component makes no claim about it.
	// Zero here means "not ruled", never "ruled zero".
	const gridIntervals = perMarket ? 0 : mode === "expanded" ? 10 : 5;
	// The interval UPPER bounds, in Đ. N intervals over 0..yMax yield N bounds,
	// which is why N intervals draw N lines. Each value is distinct, so it also
	// serves as the React key without keying on an array index.
	const gridBounds = Array.from(
		{ length: gridIntervals },
		(_, i) => (series.yMax * (i + 1)) / gridIntervals,
	);

	return (
		<svg
			data-testid="profile-chart"
			viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="h-full w-full"
		>
			{/* Y gridlines — UNLABELLED. Each line is one interval's UPPER bound, so
			    N intervals draw N lines; value 0 sits at the plot floor and NOTHING
			    draws it — there is no baseline rule, and the X labels below encode
			    dates, not the Y zero. Drawn FIRST so they paint behind every series.
			    Spanned
			    by the same `xPx` endpoints the axis labels use, so item 16 adds no
			    geometry primitive and `geometry.ts` is read, never written. Labels
			    would print Đ figures and would have to route through `formatDharma`;
			    unlabelled is the ratified reading and needs no data. */}
			{gridBounds.map((bound, i) => {
				const gy = yPx(String(bound), series.yMax);
				return (
					<line
						key={bound}
						data-testid={`grid-y-${i + 1}`}
						x1={xPx(series.windowStart, startMs, endMs)}
						x2={xPx(series.windowEnd, startMs, endMs)}
						y1={gy}
						y2={gy}
						stroke="var(--color-n2)"
						strokeWidth="1"
						vectorEffect="non-scaling-stroke"
					/>
				);
			})}

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
	// Ruling 3 — the per-market value segment strokes by its OWN frozen side:
	// YES → `--graph-yes`, NO → `--graph-no` (the cumulative-view line mapping is
	// unchanged). Token classes, never hex (AGENTS.md §8).
	return (
		<polyline
			data-testid={`segment-${seg.marketId}-${seg.episodeIndex}`}
			data-side={seg.side}
			points={pointsAttr(seg.points, startMs, endMs, yMax)}
			fill="none"
			className={
				seg.side === "YES"
					? "stroke-[var(--graph-yes)]"
					: "stroke-[var(--graph-no)]"
			}
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

/** One own post/reply node — a side-keyed disc inside a FIXED grey rim, with a
 * FIXED grey core. Placement is `netWorthValue` (cumulative) or `marketValue`
 * (per-market).
 *
 * ⛔ NOT the W2.6 "R2" primitive, which this docblock claimed until POLISH.5
 * item 12. R2 is a CROWD-SPLIT ring — "black/white ring = crowd split", "Ring
 * orientation = R2: BLACK = YES-money on EVERY node"
 * (DESIGN-W2_6-profile-graph-CLOSE-OUT.md §3 item 5). This rim is ONE FIXED
 * GREY and encodes nothing, and `GraphNode` carries neither a stake nor a crowd
 * field — so R2 is not merely unbuilt here, it is unrenderable from this DTO.
 * Its market twin is docketed as `CHART-NODE-RING`; the profile half is routed,
 * not settled here (`P5-D20b`, defined at `docs/plans/POLISH-5.md` §3.1).
 *
 * ⚠ TWO TOKEN FAMILIES MEET HERE AND ONLY ONE IS SIDE-KEYED — read each token's
 * NAME and its VALUE separately, because here they disagree:
 *
 * - The r=5 disc's `fill` is this node's only side-keyed COLOUR expression:
 *   `--color-yes` (#181818) for YES, `--color-no` (#fafafa) for NO — the POLE
 *   family, carrying the locked binding: the poles name the SIDE, never the
 *   Support/Counter relation (AGENTS.md §8; design-language.md §1 "Binding
 *   resolved"). ⚠ The sibling MARKET-chart node is ruled onto `--graph-*`
 *   instead (design-canon.md §10 `C-CHART-1` item 2) — a ruling its own text
 *   scopes to `MarketPriceChart`, so the two differ by decision, not by drift.
 * - The rim (that disc's stroke) and the r=2 core are BOTH `--graph-yes`, FIXED
 *   on every side. Its NAME says YES; its VALUE is a mid-grey (#737373).
 *
 * ⚠ AND THEY DO NOT COMPOSE THE WAY THE NAMES SUGGEST. `--color-yes` equals
 * `--color-ground` (#181818) and both charts sit on `bg-n0` (#212121), so on a
 * YES node the disc is very nearly invisible: what actually changes between the
 * poles is the ANNULUS between core and rim — ground-dark on YES, white on NO.
 * The always-visible grey core is the documented fix for precisely that, not a
 * side effect of the token (DESIGN-W2_6-graph-prototype-record.md §3 — it
 * "rescues mostly-black YES nodes that otherwise vanished").
 *
 * ⚠ The families COINCIDE ON NO (`--graph-no` and `--color-no` are both
 * #fafafa) and DIFFER ON YES, so a RESOLVED-colour assertion cannot tell them
 * apart on the NO arm. The fill's guard asserts the LITERAL token string —
 * graph.test.tsx, "node-on-line-placement". */
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
