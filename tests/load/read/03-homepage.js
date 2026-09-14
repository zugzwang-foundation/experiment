// HOMEPAGE — Discovery, the market list: cards, images, sparklines.
// Staging T-03, success rate by batch: 1,000 → 23.96% · 2,000 → 11.15% ·
// 3,000 → 9.23% · 4,000 → 5.44% · 5,000 → 7.68%.
// ⚠ Those peaks were OFFERED rates; the rig and Vercel's abuse protection
// capped what actually arrived (C-01, C-03). Compare at equal offered rates.
//
//   PEAK_RATE=300 k6 run tests/load/read/03-homepage.js

import { getPage } from "../lib/page.js";
import { escalatingScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const { peak, scenario } = escalatingScenario("hitHomepage");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { homepage: scenario },
};

export function setup() {
	console.log(`[03-homepage] ${JSON.stringify(provenanceBlock({ peak }))}`);
}

export function hitHomepage() {
	getPage("/", `homepage_${peak}`);
}
