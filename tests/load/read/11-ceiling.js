// CEILING — push past the design target on purpose to find where it breaks.
// Staging stage 10: 500 → 1,000 → 1,500 → 2,500 req/s, one minute each.
// Offered 2,500, achieved ≈59 req/s with 267,184 dropped iterations; the cause
// (rig, app pool or platform) was never separated.
// ⚠ Read the break from latency and connection failures together. A request
// that queues inside the database pool can succeed slowly with no error.
// ⚠ On production the default cap stops this at 600 req/s. Above that one
// machine measures Vercel's abuse protection, not the app (C-03). A true
// production ceiling needs traffic from several machines.
//
//   MARKET_SLUG=<slug> PEAK_RATE=600 k6 run tests/load/read/11-ceiling.js

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
		ceiling: {
			executor: "ramping-arrival-rate",
			exec: "hitReadPaths",
			startRate: Math.max(1, Math.round(PEAK * 0.08)),
			timeUnit: "1s",
			preAllocatedVUs: PEAK,
			maxVUs: PEAK * 5,
			stages: [
				{ target: Math.round(PEAK * 0.2), duration: "60s" },
				{ target: Math.round(PEAK * 0.4), duration: "60s" },
				{ target: Math.round(PEAK * 0.6), duration: "60s" },
				{ target: PEAK, duration: "60s" },
				{ target: 0, duration: "20s" },
			],
		},
	},
};

export function setup() {
	console.log(
		`[11-ceiling] ${JSON.stringify(provenanceBlock({ peak: PEAK, market: MARKET_SLUG }))}`,
	);
}

export function hitReadPaths() {
	getPage(Math.random() < 0.5 ? "/" : `/m/${MARKET_SLUG}`, "ceiling");
}
