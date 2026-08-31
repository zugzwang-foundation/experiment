import type { PricePoint } from "@/server/discovery/price-series";

import { formatPercentUnpaired } from "../format";
import { fmtUtcDay } from "./geometry";

/**
 * The chart's accessible readout (SPEC.1 §9 · *Accessibility*) — opening price,
 * current price, and the two domain endpoints.
 *
 * ⛔ ONE COMPONENT, THREE SURFACES, AND THAT IS THE POINT. The collapsed card
 * and the expanded overlay carried this sentence as two byte-identical inline
 * copies; CHART-1 owed a third to the Discovery hero, and three copies of one
 * sentence that must agree exactly is a drift surface rather than an
 * encapsulation win — the same argument that collapsed three `downsample`
 * helpers into one. Extracted here so the three surfaces cannot come to
 * describe the same chart differently.
 *
 * ⚠ THE SVG STAYS `aria-hidden` ON EVERY SURFACE AND THIS IS THE ACCESSIBLE
 * CHANNEL. "Not `aria-hidden` on any surface" (SPEC.1 1.0.45 §9) is a claim
 * about the CHART, not about the `<svg>` element: a screen reader cannot read a
 * polyline, so announcing the graphic means announcing this sentence beside it.
 * That is the pattern the card and overlay already shipped and the one the hero
 * now joins — what changed at CHART-1 is that the hero HAS one, having been
 * fully decorative when it was a thumbnail beside a card sparkline.
 *
 * `testId` is required rather than defaulted: three summaries can be in one
 * document at once, and a query that matched the wrong one would silently
 * assert about a different surface. Making the caller name it removes the
 * possibility of two sharing an id by omission.
 */
export function ChartSummary({
	series,
	testId,
}: {
	series: PricePoint[];
	testId: string;
}): React.JSX.Element | null {
	const opening = series[0];
	const current = series[series.length - 1];
	if (opening === undefined || current === undefined) {
		return null;
	}

	// pctround-allow: genuinely single-side — the OPENING YES price, one point in
	// TIME, not one half of a pair (SPEC.1 §10.8 escape hatch).
	const openingPct = formatPercentUnpaired(opening.yes);
	// pctround-allow: genuinely single-side — the CURRENT YES price, the other
	// point in TIME. Shares `PriceBar`'s formatter core, so this readout and the
	// bar a few pixels below can never disagree on the same price.
	const currentPct = formatPercentUnpaired(current.yes);

	return (
		<span data-testid={testId} className="sr-only">
			Price history: opening {openingPct}, current {currentPct},{" "}
			{fmtUtcDay(opening.at)} to {fmtUtcDay(current.at)}.
		</span>
	);
}
