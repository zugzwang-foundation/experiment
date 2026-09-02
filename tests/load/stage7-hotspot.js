import { check } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 7 — HOTSPOT / ADVERSARIAL. Concentrated traffic on ONE market/pool
// row + N concurrent cache-misses on one key at t=0 (cache stampede, CM-8).
// Read-only version below (safe to run once C1 designates the hot market);
// the write half (concentrated bet writes on one pool row) carries the same
// blocking preconditions as Stage 6 and is not included here.
//
// NOT YET RUN. Read-only scenario is close to run-ready once C1 lands.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const HOT_MARKET_SLUG = __ENV.HOT_MARKET_SLUG || "github-zugzwang-repo-stars";

export const options = {
	scenarios: {
		concentrated_reads: {
			executor: "ramping-arrival-rate",
			exec: "hitHotMarket",
			startRate: 50,
			timeUnit: "1s",
			preAllocatedVUs: 400,
			maxVUs: 1500,
			// Sharp spike shape, not a gentle ramp — the point is N simultaneous
			// misses on one cache key at t=0, per CM-8.
			stages: [
				{ target: 1500, duration: "5s" },
				{ target: 1500, duration: "20s" },
				{ target: 0, duration: "10s" },
			],
		},
	},
};

export function setup() {
	console.log(`[stage7] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(`[stage7] hotspot market: ${HOT_MARKET_SLUG}`);
}

export function hitHotMarket() {
	const res = http.get(`${BASE_URL}/m/${HOT_MARKET_SLUG}`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, {
		scenario: "stage7_hotspot",
		endpoint: "/m/[slug] (concentrated)",
	});
	check(res, { "status 200": (r) => r.status === 200 });
}
