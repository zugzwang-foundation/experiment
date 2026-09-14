// HOTSPOT — everyone piles onto one market at once (a market going viral).
// Staging stage 7: ramp to peak in 5 s, hold 20 s. 93.25% success at a
// 1,500 req/s spike on a market without bulk images (volume-fixture-c-hot).
//
//   MARKET_SLUG=<slug> PEAK_RATE=500 k6 run tests/load/read/08-hotspot.js

import { getPage, requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";
import { assertRateAllowed } from "../lib/target.js";

const MARKET_SLUG = requiredEnv("MARKET_SLUG");
const PEAK = Number(requiredEnv("PEAK_RATE"));
assertRateAllowed(PEAK);

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		hotspot: {
			executor: "ramping-arrival-rate",
			exec: "hitHot",
			startRate: Math.max(1, Math.round(PEAK * 0.03)),
			timeUnit: "1s",
			preAllocatedVUs: PEAK,
			maxVUs: PEAK * 5,
			stages: [
				{ target: PEAK, duration: "5s" },
				{ target: PEAK, duration: "20s" },
				{ target: 0, duration: "10s" },
			],
		},
	},
};

export function setup() {
	console.log(
		`[08-hotspot] ${JSON.stringify(provenanceBlock({ market: MARKET_SLUG, peak: PEAK }))}`,
	);
}

export function hitHot() {
	getPage(`/m/${MARKET_SLUG}`, "hotspot");
}
