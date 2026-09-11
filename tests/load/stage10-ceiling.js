import { check } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 10 — CONTROLLED CEILING. Find the breaking point deliberately, abort
// armed. ⚠ Under :6543 the ceiling does not announce itself as errors — it
// presents as latency (W-10, ADR-0038 P1). Read queue depth and backend
// utilisation (sample-backend-activity.ts, run in parallel) against Pool
// Size 15, never error rate, to find the real ceiling.
//
// Read-only ramp shown here; this is the stage whose OUTPUT feeds S-8's
// tier decision (S-5 produces run #1 only — "the run-#1/#2 delta IS the
// tier answer", not this run alone).
//
// NOT YET RUN.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const MARKET_SLUG = __ENV.MARKET_SLUG || "github-zugzwang-repo-stars";

export const options = {
	scenarios: {
		progressive_ceiling: {
			executor: "ramping-arrival-rate",
			exec: "hitReadPaths",
			startRate: 200,
			timeUnit: "1s",
			preAllocatedVUs: 600,
			maxVUs: 3000,
			stages: [
				{ target: 500, duration: "60s" },
				{ target: 1000, duration: "60s" },
				{ target: 1500, duration: "60s" },
				{ target: 2500, duration: "60s" }, // beyond the ramp ceiling — deliberately, to find the real break
				{ target: 0, duration: "20s" },
			],
		},
	},
};

export function setup() {
	console.log(`[stage10] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		"[stage10] ⚠ read the ceiling from queue depth + backend utilisation (sampler), NEVER from error rate alone — a saturated :6543 pool can report zero HTTP errors.",
	);
}

export function hitReadPaths() {
	const res =
		Math.random() < 0.5
			? http.get(`${BASE_URL}/`, { headers: withSourceIpHeaders(__VU) })
			: http.get(`${BASE_URL}/m/${MARKET_SLUG}`, {
					headers: withSourceIpHeaders(__VU),
				});
	record(res, { scenario: "stage10_ceiling", endpoint: "mixed read" });
	check(res, { responded: (r) => r.status !== 0 });
}
