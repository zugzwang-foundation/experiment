// SPIKE — the homepage goes from near-idle to peak in 10 seconds (a big share
// or a launch post). Staging stage 8: 98.33% success, median ~1 s, at a
// 1,500 req/s spike. The best result of the campaign.
// ⚠ Most meaningful against a COLD deployment — run it first after a deploy,
// before anything else has warmed the caches.
//
//   PEAK_RATE=500 k6 run tests/load/read/09-spike.js

import { getPage, requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";
import { assertRateAllowed } from "../lib/target.js";

const PEAK = Number(requiredEnv("PEAK_RATE"));
assertRateAllowed(PEAK);

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		spike: {
			executor: "ramping-arrival-rate",
			exec: "hitHomepage",
			startRate: Math.max(1, Math.round(PEAK * 0.01)),
			timeUnit: "1s",
			preAllocatedVUs: PEAK,
			maxVUs: PEAK * 5,
			stages: [
				{ target: PEAK, duration: "10s" },
				{ target: PEAK, duration: "30s" },
				{ target: 0, duration: "15s" },
			],
		},
	},
};

export function setup() {
	console.log(`[09-spike] ${JSON.stringify(provenanceBlock({ peak: PEAK }))}`);
}

export function hitHomepage() {
	getPage("/", "spike");
}
