// RIG CEILING — how fast the load machine itself can go, measured against a
// static file that does no app work. Staging T-14 / corrections C-01, C-03.
//
// ⚠ RUN THIS FIRST, ONCE PER RIG, AND AGAINST STAGING. It measures the rig,
// not the site, so the target does not matter — and its 4,000 req/s peak is
// refused on production by `PRODUCTION_MAX_RATE`. If this run tops out below a
// page test's peak, that page test is measuring the rig.
// Staging, after raising `ulimit -n` 1,024 → 65,536: 85 → 237 req/s achieved.

import { check } from "k6";
import http from "k6/http";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";
import { assertRateAllowed, TARGET_URL } from "../lib/target.js";

const PEAK = Number(__ENV.PEAK_RATE || "4000");
assertRateAllowed(PEAK);

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		rig_ceiling: {
			executor: "ramping-arrival-rate",
			startRate: Math.round(PEAK * 0.05),
			timeUnit: "1s",
			preAllocatedVUs: PEAK,
			maxVUs: PEAK * 5,
			stages: [
				{ target: Math.round(PEAK * 0.125), duration: "20s" },
				{ target: Math.round(PEAK * 0.25), duration: "20s" },
				{ target: Math.round(PEAK * 0.5), duration: "20s" },
				{ target: PEAK, duration: "20s" },
				{ target: 0, duration: "10s" },
			],
		},
	},
};

export function setup() {
	console.log(
		`[01-rig-ceiling] ${JSON.stringify(provenanceBlock({ peak: PEAK }))}`,
	);
}

export default function () {
	const res = http.get(`${TARGET_URL}/favicon.ico`, {
		tags: { name: "favicon" },
	});
	check(res, { "status 200": (r) => r.status === 200 });
}
