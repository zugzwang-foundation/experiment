import { check } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 8 — SPIKE. Launch-day shape: cold cache, 0 → peak in seconds. Read
// path only (safe once C1 lands); the signup-burst half carries Stage 5's
// same blocking preconditions.
//
// NOT YET RUN.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";

export const options = {
	scenarios: {
		cold_spike: {
			executor: "ramping-arrival-rate",
			exec: "hitDiscoveryColdSpike",
			startRate: 10,
			timeUnit: "1s",
			preAllocatedVUs: 400,
			maxVUs: 1500,
			stages: [
				{ target: 1500, duration: "10s" }, // the spike — 0 to ramp-ceiling fast
				{ target: 1500, duration: "30s" },
				{ target: 0, duration: "15s" },
			],
		},
	},
};

export function setup() {
	console.log(`[stage8] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		"[stage8] run this against a COLD instance/cache for validity — a warm run measures a different question",
	);
}

export function hitDiscoveryColdSpike() {
	const res = http.get(`${BASE_URL}/`, { headers: withSourceIpHeaders(__VU) });
	record(res, { scenario: "stage8_spike", endpoint: "/" });
	check(res, { "status 200": (r) => r.status === 200 });
}
