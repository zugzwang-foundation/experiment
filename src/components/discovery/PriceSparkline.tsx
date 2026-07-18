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
		return null;
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
