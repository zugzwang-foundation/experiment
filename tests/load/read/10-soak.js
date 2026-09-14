// SOAK — a moderate rate held for a long time, to catch slow degradation a
// short burst cannot (leaks, pool exhaustion, cache churn).
// Staging P5: NEVER RUN — blocked on the database connection bottleneck (P1).
// Default 200 req/s for 10 minutes; the real soak is SOAK_DURATION=24h.
//
//   MARKET_SLUG=<slug> SOAK_RATE=200 SOAK_DURATION=30m k6 run tests/load/read/10-soak.js

import { getPage, requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";
import { assertRateAllowed } from "../lib/target.js";

const MARKET_SLUG = requiredEnv("MARKET_SLUG");
const RATE = Number(__ENV.SOAK_RATE || "200");
const DURATION = __ENV.SOAK_DURATION || "10m";
assertRateAllowed(RATE);

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		soak: {
			executor: "constant-arrival-rate",
			exec: "hitReadPaths",
			rate: RATE,
			timeUnit: "1s",
			duration: DURATION,
			preAllocatedVUs: RATE,
			maxVUs: RATE * 3,
		},
	},
};

export function setup() {
	console.log(
		`[10-soak] ${JSON.stringify(provenanceBlock({ rate: RATE, duration: DURATION, market: MARKET_SLUG }))}`,
	);
}

export function hitReadPaths() {
	getPage(Math.random() < 0.5 ? "/" : `/m/${MARKET_SLUG}`, "soak");
}
