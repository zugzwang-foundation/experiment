import {
	axisAnchorsFor,
	fmtUtcDay,
	gridlinesFor,
	SVG_W,
	TERMINAL_DOT_R,
	TERMINAL_PULSE_MAX_R,
	TERMINAL_PULSE_PEAK_SCALE,
	terminalLabelYs,
	VIEWBOX_H,
	VIEWBOX_W,
	xPx,
	yNoPx,
	yYesPx,
} from "@/components/debate/chart/geometry";
import {
	MARKET_CHART_AXIS_ANCHORS,
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

import { ACCENT, PALETTE } from "./palette";

/**
 * The page's own type sizes, restated in this file's base units.
 *
 * Each is the CSS-pixel literal `MarketPriceChart.tsx` carries for the
 * COLLAPSED card — the mode the debate page mounts, and therefore the chart a
 * reader has actually seen before they see this image. They are restated rather
 * than imported because the page holds them as module-private consts beside
 * Tailwind classes; everything that can be imported from `geometry.ts` (the
 * scales, the gridline set, the anchor filter, the label collision rule) IS
 * imported, so the divergence between the two files is only ever type, never
 * geometry.
 */
const MARK_TYPE = 10;
const MARK_PAD = 6;
const AXIS_DATE_TYPE = 12;
const AXIS_DATE_TOP = 4;
const AXIS_BAND = AXIS_DATE_TYPE + AXIS_DATE_TOP;
const LABEL_NAME = 10;
const LABEL_AIR = 5;

/**
 * The trailing cell the travelling end labels overflow into — the page's own
 * `chart-label-reserve`, which is a `padding-left: 15px` plus the width of the
 * word `YES` at the label's type. The export cannot measure text, so the word's
 * width is stated rather than laid out: 24 base units at 10px bold on 0.1em
 * tracking.
 *
 * ⚠ IT COMES OUT OF THE PLOT, exactly as it does on the page. Without it a
 * market whose last trade is recent — which is every live one — draws its
 * terminal dot near the right edge and hangs `YES` off the card.
 */
const LABEL_RESERVE = 15 + 24;

/** The Y-mark column: the width of `100` at `MARK_TYPE`, plus its right pad. */
export const CHART_Y_GUTTER = 18 + MARK_PAD;

/**
 * The export's price graph — the debate page's COLLAPSED chart card, element
 * for element, with one thing changed: the colour.
 *
 * ⛔ THIS IS NOT AN APPROXIMATION OF THE PAGE'S CHART, IT IS THE PAGE'S CHART.
 * Operator ruling (revision 5, 2026-09-11): the graph should look the way it
 * looks on the platform, and only the colour should change in the JPEG. So
 * everything a reader can point at comes from the source the page takes it
 * from — `gridlinesFor("collapsed")` for the five rules, `axisAnchorsFor` for
 * which of the three ratified anchor dates are drawn and which of those earn an
 * interior tick, `terminalLabelYs` for the end labels' collision rule, `xPx` /
 * `yYesPx` / `yNoPx` for every coordinate. A number this file states on its own
 * is a TYPE SIZE, never a position.
 *
 * ⚠ WHAT THIS REPLACED, AND WHY EACH ONE WENT. The previous revision drew its
 * own chart in the spirit of the page's, and every difference read as a
 * different market rather than as a different surface:
 *   · an AREA WASH under the YES line — the page has none, and a filled region
 *     on a still image reads as volume or conviction, which is a claim about
 *     the market that nothing in the data supports;
 *   · EIGHT EVENLY-SPACED date ticks in place of the ratified anchors. The old
 *     docblock argued that even ticks say "how long the window is" better than
 *     three named dates, which is a real argument and is now overruled: an
 *     export that labels its axis differently from the page cannot be checked
 *     against the page by the one person holding both;
 *   · `100% / 50% / 0%` in the gutter against the page's `0 25 50 75 100` —
 *     three marks where the page has five, and a percent sign the page drops;
 *   · NO terminal labels at all, so nothing in the image said which line was
 *     which except its colour — which is exactly what the colour change below
 *     makes unreadable to someone who has never seen the product.
 *
 * ⚠ THE ONE DEPARTURE IS `--graph-yes` / `--graph-no` → `ACCENT.green` /
 * `ACCENT.red`. `palette.ts`'s `ACCENT` docblock carries why: the page draws
 * grey-on-white because its reader has the axis, the card and the whole
 * surrounding surface to tell the two lines apart, and a shared image has none
 * of that. The pole law is unchanged — green IS the YES series, red IS the NO
 * series — and the terminal labels now say so in words as well as in colour.
 *
 * ── Satori, and why the markup looks like this ─────────────────────────────
 *
 * ⛔ NO `transform`, ANYWHERE. The page centres its marks and dates with
 * `-translate-y-1/2` / `-translate-x-1/2`. Whether Satori honours a percentage
 * translate is not something a deterministic export should rest on, so every
 * centring here is ARITHMETIC: a mark sits at `y - type/2` (its line box is
 * exactly its type size at `lineHeight: 1`), and a date sits inside a
 * fixed-width box centred on its own x.
 *
 * ⛔ NO `preserveAspectRatio="none"`. The page stretches a 649×320 user space
 * onto its box, which turns the terminal dots into ellipses — invisible there
 * on a fine CSS pixel grid, obvious here at 2×. So every coordinate is
 * multiplied into device pixels on the way in and the viewBox IS the box.
 * ⚠ `sx` DIVIDES BY `SVG_W`, NOT `VIEWBOX_W`: the nine units of terminal-dot
 * allowance are part of the page's horizontal domain, and dropping them would
 * shift every x by 1.4% — a whole day, on a fifty-two-day window.
 *
 * ⚠ STROKE WIDTHS ARE IN BASE UNITS, NOT USER UNITS. The page gets 1 CSS px
 * hairlines from `vector-effect="non-scaling-stroke"`, which Satori does not
 * implement; `u(1)` reproduces that apparent weight, where `1 * sx` — what this
 * file used to do — draws them at 0.7 and loses the grid to the JPEG encoder.
 */
export function PriceHistorySvg({
	series,
	isOpen,
	u,
	width,
	height,
}: {
	series: PricePoint[];
	isOpen: boolean;
	/** Base units → device pixels — the composition's own scale function. */
	u: (n: number) => number;
	/** The chart box, Y gutter EXCLUDED: the plot plus the label reserve. */
	width: number;
	height: number;
}) {
	const startMs = Date.parse(MARKET_CHART_WINDOW_START);
	const endMs = Date.parse(MARKET_CHART_WINDOW_END);

	const plotW = width - u(LABEL_RESERVE);
	const plotH = height;
	const sx = plotW / SVG_W;
	const sy = plotH / VIEWBOX_H;

	const first = series[0];
	const last = series[series.length - 1];
	const degenerate = series.length < 2 || endMs === startMs;

	/** `buildLine`'s rule: a lone point draws flat from the left edge to itself. */
	const line = (yFn: (yes: string) => number): string => {
		if (first === undefined) {
			return "";
		}
		if (degenerate) {
			const y = yFn(first.yes) * sy;
			return `0,${y} ${xPx(first.at, startMs, endMs) * sx},${y}`;
		}
		return series
			.map((p) => `${xPx(p.at, startMs, endMs) * sx},${yFn(p.yes) * sy}`)
			.join(" ");
	};

	const terminalX = last === undefined ? 0 : xPx(last.at, startMs, endMs) * sx;
	const dotR = TERMINAL_DOT_R * sx;
	const pulseGap = TERMINAL_PULSE_MAX_R * sx;

	const grid = gridlinesFor("collapsed");
	// `drawsTimeAxis("collapsed", …)`: two points are what make a time axis mean
	// anything, and a zero-width window has no axis to draw.
	const drawsAxis = series.length >= 2 && endMs !== startMs;
	const anchors = drawsAxis
		? axisAnchorsFor(MARKET_CHART_AXIS_ANCHORS, "collapsed", startMs, endMs)
		: [];
	// Only the anchors INSIDE the plot earn a rule; an endpoint tick would be
	// drawn on the border it already sits on.
	const interior = anchors.filter(({ iso }) => {
		const x = xPx(iso, startMs, endMs);
		return x > 0 && x < VIEWBOX_W;
	});

	const markHalf = u(MARK_TYPE) / 2;
	const markTop = (y: number): number =>
		Math.min(Math.max(y * sy, markHalf), plotH - markHalf) - markHalf;

	return (
		<div style={{ display: "flex", width: width + u(CHART_Y_GUTTER) }}>
			{/* ── the Y gutter · 0 25 50 75 100, each on its own rule ────────── */}
			<div
				style={{
					display: "flex",
					position: "relative",
					width: u(CHART_Y_GUTTER),
					height: plotH,
				}}
			>
				{grid.map((g) => (
					<span
						key={g.pct}
						style={{
							position: "absolute",
							right: u(MARK_PAD),
							top: markTop(g.y),
							fontSize: u(MARK_TYPE),
							lineHeight: 1,
							color: PALETTE.n5,
						}}
					>
						{g.pct}
					</span>
				))}
			</div>

			<div style={{ display: "flex", flexDirection: "column", width }}>
				<div style={{ display: "flex", position: "relative", height: plotH }}>
					<svg
						width={plotW}
						height={plotH}
						viewBox={`0 0 ${plotW} ${plotH}`}
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						{/* ⚠ No React fragments inside the `<svg>`: Satori serialises the
						    subtree itself and walks element children only, so every mark
						    is its own node and the tree it sees is flat. */}
						{grid.map((g) => (
							<line
								key={g.pct}
								x1={0}
								x2={VIEWBOX_W * sx}
								y1={g.y * sy}
								y2={g.y * sy}
								stroke={PALETTE.n2}
								strokeWidth={u(1)}
								strokeDasharray={`${u(1)} ${u(3)}`}
							/>
						))}
						{interior.map(({ iso, i }) => (
							<line
								key={`tick-${i}`}
								x1={xPx(iso, startMs, endMs) * sx}
								x2={xPx(iso, startMs, endMs) * sx}
								y1={0}
								y2={plotH}
								stroke={PALETTE.n2}
								strokeWidth={u(1)}
								strokeDasharray={`${u(5)} ${u(4)}`}
							/>
						))}
						{last !== undefined && (
							<polyline
								points={line(yNoPx)}
								fill="none"
								stroke={ACCENT.red}
								strokeWidth={u(1.75)}
								strokeLinejoin="round"
								strokeLinecap="round"
							/>
						)}
						{last !== undefined && (
							<polyline
								points={line(yYesPx)}
								fill="none"
								stroke={ACCENT.green}
								strokeWidth={u(1.75)}
								strokeLinejoin="round"
								strokeLinecap="round"
							/>
						)}
						{last !== undefined && isOpen && (
							<circle
								cx={terminalX}
								cy={yNoPx(last.yes) * sy}
								r={dotR * TERMINAL_PULSE_PEAK_SCALE}
								fill={ACCENT.red}
								fillOpacity={0.35}
							/>
						)}
						{last !== undefined && isOpen && (
							<circle
								cx={terminalX}
								cy={yYesPx(last.yes) * sy}
								r={dotR * TERMINAL_PULSE_PEAK_SCALE}
								fill={ACCENT.green}
								fillOpacity={0.35}
							/>
						)}
						{last !== undefined && (
							<circle
								cx={terminalX}
								cy={yNoPx(last.yes) * sy}
								r={dotR}
								fill={ACCENT.red}
							/>
						)}
						{last !== undefined && (
							<circle
								cx={terminalX}
								cy={yYesPx(last.yes) * sy}
								r={dotR}
								fill={ACCENT.green}
							/>
						)}
					</svg>

					{last !== undefined && (
						<TerminalLabels
							u={u}
							yes={last.yes}
							terminalX={terminalX}
							plotW={plotW}
							plotH={plotH}
							boxW={width}
							sy={sy}
							gap={pulseGap}
						/>
					)}
				</div>

				<div
					style={{
						display: "flex",
						position: "relative",
						width,
						height: u(AXIS_BAND),
					}}
				>
					{anchors.map(({ iso, i }) => (
						<AxisDate
							key={`anchor-${i}`}
							u={u}
							iso={iso}
							x={xPx(iso, startMs, endMs) * sx}
							plotW={plotW}
							boxW={width}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

/**
 * One date under the plot, placed the way the page places it: centred on its
 * own x, except at the two edges, where it is pulled inside the plot so it
 * cannot hang off either end.
 *
 * The centring is a fixed-width box rather than a translate (see the component
 * docblock) — wide enough for the longest string the formatter can produce and
 * then some, because the box is invisible and only its CENTRE is load-bearing.
 */
function AxisDate({
	u,
	iso,
	x,
	plotW,
	boxW,
}: {
	u: (n: number) => number;
	iso: string;
	x: number;
	plotW: number;
	boxW: number;
}) {
	const W = u(64);
	const atStart = x <= 0;
	const atEnd = x >= plotW;
	// ⛔ THE EDGE KEY IS ADDED, NEVER SET TO `undefined`. Satori reads the style
	// object directly rather than through React's DOM layer, and an `undefined`
	// value reaches its parser as one — where it dies on `.trim()` with a message
	// that names no property. Two spreads, so only the key in use exists.
	const edge = atEnd
		? { right: boxW - plotW }
		: { left: atStart ? 0 : x - W / 2 };
	return (
		<div
			style={{
				display: "flex",
				position: "absolute",
				top: u(AXIS_DATE_TOP),
				width: W,
				...edge,
				justifyContent: atStart ? "flex-start" : atEnd ? "flex-end" : "center",
				fontSize: u(AXIS_DATE_TYPE),
				lineHeight: 1,
				color: PALETTE.n5,
			}}
		>
			<span>{fmtUtcDay(iso)}</span>
		</div>
	);
}

/**
 * `YES` and `NO` beside their own terminal dots — the page's `TerminalLabels`
 * in collapsed mode, which carries the NAME only and no value (`hasEndValue`).
 *
 * ⛔ THE COLLISION RULE IS IMPORTED, NOT REIMPLEMENTED. `terminalLabelYs` pushes
 * the two apart when the market rests near 50/50 — which is where a market
 * spends most of its life, and where the dots are close enough that honest
 * placement would stack the words on each other. Re-deriving that here would be
 * a second opinion on a rule the page already owns.
 *
 * ⚠ THE FLIP IS THE PAGE'S TOO, AND IT IS NOT DEAD CODE. A market whose last
 * trade lands at the window's end puts its dot on the plot's right edge, and a
 * label drawn rightward from there leaves the card. The page flips it to the
 * left of the dot; so does this, by anchoring `right` instead of `left` — which
 * is how a surface that cannot measure its own text right-aligns anything.
 */
function TerminalLabels({
	u,
	yes,
	terminalX,
	plotW,
	plotH,
	boxW,
	sy,
	gap,
}: {
	u: (n: number) => number;
	yes: string;
	terminalX: number;
	plotW: number;
	plotH: number;
	boxW: number;
	sy: number;
	gap: number;
}) {
	const ys = terminalLabelYs(yes);
	const yesOnTop = ys.yes <= ys.no;
	const half = u(LABEL_NAME) / 2;
	const clamp = (y: number) => Math.min(Math.max(y, half), plotH - half);
	const upper = clamp(
		Math.min((yesOnTop ? ys.yes : ys.no) * sy, plotH / 2 - half),
	);
	const lower = clamp(
		Math.max((yesOnTop ? ys.no : ys.yes) * sy, plotH / 2 + half),
	);
	const flip = terminalX + gap > plotW;
	const place = (y: number) =>
		flip
			? { right: boxW - (terminalX - gap - u(LABEL_AIR)), top: y - half }
			: { left: terminalX + gap + u(LABEL_AIR), top: y - half };
	const type = {
		display: "flex" as const,
		position: "absolute" as const,
		fontSize: u(LABEL_NAME),
		fontWeight: 700,
		letterSpacing: u(LABEL_NAME * 0.1),
		lineHeight: 1,
	};
	return (
		<div
			style={{
				display: "flex",
				position: "absolute",
				top: 0,
				left: 0,
				width: boxW,
				height: plotH,
			}}
		>
			<div
				style={{
					...type,
					...place(upper),
					color: yesOnTop ? ACCENT.green : ACCENT.red,
				}}
			>
				<span>{yesOnTop ? "YES" : "NO"}</span>
			</div>
			<div
				style={{
					...type,
					...place(lower),
					color: yesOnTop ? ACCENT.red : ACCENT.green,
				}}
			>
				<span>{yesOnTop ? "NO" : "YES"}</span>
			</div>
		</div>
	);
}
