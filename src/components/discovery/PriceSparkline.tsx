import type { PricePoint } from "@/server/discovery/price-series";

/**
 * The design-language §3.2 two-line price graph — one YES series in, the NO
 * line rendered as its complement (NO = 1 − YES; always-complementary, so a
 * single series suffices). Card sparkline and hero full-size share the one
 * component via `size` (a data attribute — the box is styled by the parent).
 * Token strokes `--graph-yes` / `--graph-no`, never hex literals (AGENTS.md
 * §8). Decorative (`aria-hidden`) — the PriceBar carries the accessible
 * price text.
 *
 * Coordinate mapping is DISPLAY GEOMETRY only: the price string is read as a
 * number solely to place SVG points (y_yes = (1−p)·40, y_no = p·40 — the two
 * lines mirror about the midline, y_yes + y_no = 40 at every x). No money
 * arithmetic happens here; the canonical values stay server-computed strings
 * (CLAUDE.md §2).
 */
export function PriceSparkline({
	series,
	size = "card",
}: {
	series: PricePoint[];
	size?: "card" | "hero";
}) {
	if (series.length === 0) {
		// ⛔ PRODUCTION IS BYTE-IDENTICAL TO BEFORE — an empty series still renders
		// nothing there. ⚠ This mount needs its OWN gate: the market-detail chart's
		// gate lives in `MarketPriceChartHost` and does not reach this component,
		// so without this line a hero replica would ship fabricated data to prod.
		// ⚠ `process.env.ZUGZWANG_ENV` is readable in the browser because
		// `next.config.ts:29` inlines it, so server and client read one build-time
		// constant and this branch cannot hydration-mismatch.
		if (process.env.ZUGZWANG_ENV === "prod") {
			return null;
		}
		return <PlaceholderSparkline size={size} />;
	}

	const coord = (v: number): string => (Math.round(v * 100) / 100).toString();

	// A single-point (seed-only) series renders as a flat line across the
	// full width — the point duplicated at x=0 and x=100 (§22 zero-bet edge).
	const xs =
		series.length === 1
			? [0, 100]
			: series.map((_, i) => (i * 100) / (series.length - 1));
	const points = series.length === 1 ? [series[0], series[0]] : series;

	const yesPoints = points
		.map((p, i) => `${coord(xs[i])},${coord((1 - Number(p.yes)) * 40)}`)
		.join(" ");
	const noPoints = points
		.map((p, i) => `${coord(xs[i])},${coord(Number(p.yes) * 40)}`)
		.join(" ");

	return (
		<svg
			viewBox="0 0 100 40"
			preserveAspectRatio="none"
			aria-hidden="true"
			data-testid="price-sparkline"
			data-size={size}
			className="h-full w-full"
		>
			<polyline
				points={yesPoints}
				fill="none"
				stroke="var(--graph-yes)"
				strokeWidth="1.4"
				vectorEffect="non-scaling-stroke"
			/>
			<polyline
				points={noPoints}
				fill="none"
				stroke="var(--graph-no)"
				strokeWidth="1.4"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

/**
 * ⛔⛔ DEMO REPLICA — FOUNDER RULING 2026-08-24. DELETE THIS, DO NOT MAINTAIN IT.
 *
 * The Discovery hero's stand-in, and the same story as the market-detail chart
 * one surface over: the hero renders NO sparkline today because the price series
 * is empty on every market, because no `market.opened` event exists anywhere in
 * staging (measured 2026-08-24 — 0 rows, all 8 markets Open with pools). The
 * series is a read-time replay seeded by that event, so it returns `[]` before
 * reading any bet.
 * ⇒ DELETED WHEN STAGING IS RE-SEEDED THROUGH `openMarket()` (deferred, R8).
 *
 * ⛔ IT IS THIS COMPONENT'S OWN BOX, NOT THE MARKET CHART'S STRETCHED INTO IT.
 * `viewBox="0 0 100 40"`, `preserveAspectRatio="none"`, `h-full w-full`,
 * strokes at 1.4 with no linecap/linejoin — every one of those is read off the
 * real render directly above, which is a different geometry from the detail
 * chart's 640×320 at 1.75.
 *
 * ⛔ SAME TOKENS AS THE REAL RENDER, side poles included: `--graph-yes` /
 * `--graph-no`, mirrored about the midline (y_yes + y_no = 40 at every x), the
 * relationship the real component's own coordinate mapping guarantees.
 *
 * ⚠ DETERMINISTIC — every coordinate a literal. No RNG, no clock, no
 * client-only value; identical on every load, no hydration mismatch.
 *
 * ⚠ `data-testid`/`data-size` mirror the real component so a consumer styling
 * the box by `[data-size]` keeps working while this stands in. No label, no
 * tooltip, non-interactive, `aria-hidden` — the PriceBar carries the price text.
 */
function PlaceholderSparkline({ size }: { size: "card" | "hero" }) {
	return (
		<svg
			viewBox="0 0 100 40"
			preserveAspectRatio="none"
			aria-hidden="true"
			data-testid="price-sparkline-placeholder"
			data-size={size}
			className="h-full w-full"
		>
			<polyline
				points="0,20 11,20.4 22,21.3 33,20.8 44,22.4 56,23.4 67,23 78,24.4 89,25.8 100,25.4"
				fill="none"
				stroke="var(--graph-no)"
				strokeWidth="1.4"
				vectorEffect="non-scaling-stroke"
			/>
			<polyline
				points="0,20 11,19.6 22,18.7 33,19.2 44,17.6 56,16.6 67,17 78,15.6 89,14.2 100,14.6"
				fill="none"
				stroke="var(--graph-yes)"
				strokeWidth="1.4"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
