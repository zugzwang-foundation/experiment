// MARKET PAGE — /m/<slug>: header, chart, arguments, images.
// Staging T-04: run once per market, sequentially and never overlapping, at
// PEAK_RATE=100 (25 → 50 → 100 req/s). A photo-heavy market managed 16.39%
// success at 200 req/s; the cost is image bandwidth, not server CPU.
//
//   MARKET_SLUG=<slug> PEAK_RATE=100 k6 run tests/load/read/04-market-page.js

import { getPage, requiredEnv } from "../lib/page.js";
import { ladderScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const MARKET_SLUG = requiredEnv("MARKET_SLUG");
const { peak, scenario } = ladderScenario("hitMarket", "100");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { market_page: scenario },
};

export function setup() {
	console.log(
		`[04-market-page] ${JSON.stringify(provenanceBlock({ market: MARKET_SLUG, peak }))}`,
	);
}

export function hitMarket() {
	getPage(`/m/${MARKET_SLUG}`, `market_page_${MARKET_SLUG}`);
}
