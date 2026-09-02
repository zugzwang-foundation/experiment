import { check, sleep } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 3 — READ LOAD. S-5-LOAD-PLAN.md Stage 3: the first honest post-S-4
// latency measurement, at real (arrival-rate) concurrency, against the
// design target (M-1: 450-500 req/s, ramp ceiling 1,500 req/s).
//
// SUPERSEDES the earlier ad hoc read-load script used before this pack
// existed (which used ramping-vus — prohibited by M-0 outside Stage 2, and
// closer to 25,000 req/s worth of closed-loop demand than the 450-500 req/s
// real user population offers). This version uses ramping-arrival-rate
// throughout.
//
// Endpoints per S-5-LOAD-PLAN.md §4 Stage 3: Discovery, market detail, user
// profile, visits — the 15s poll is a SEPARATE concern (visibility
// suspension on/off), not modeled as raw request volume here.
//
// NOT YET RUN. Script only.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const MARKET_SLUG = __ENV.MARKET_SLUG || "github-zugzwang-repo-stars";
const PSEUDONYM = __ENV.PROFILE_PSEUDONYM || ""; // unset until C1 seeds a known profile

export const options = {
	scenarios: {
		discovery: {
			executor: "ramping-arrival-rate",
			exec: "hitDiscovery",
			startRate: 50,
			timeUnit: "1s",
			preAllocatedVUs: 300,
			maxVUs: 1500,
			stages: [
				{ target: 200, duration: "30s" },
				{ target: 450, duration: "60s" },
				{ target: 1500, duration: "30s" },
				{ target: 0, duration: "15s" },
			],
		},
		market_detail: {
			executor: "ramping-arrival-rate",
			exec: "hitMarketDetail",
			startRate: 25,
			timeUnit: "1s",
			preAllocatedVUs: 200,
			maxVUs: 800,
			stages: [
				{ target: 100, duration: "30s" },
				{ target: 225, duration: "60s" },
				{ target: 750, duration: "30s" },
				{ target: 0, duration: "15s" },
			],
		},
		visits: {
			executor: "ramping-arrival-rate",
			exec: "hitVisits",
			startRate: 25,
			timeUnit: "1s",
			preAllocatedVUs: 100,
			maxVUs: 500,
			stages: [
				{ target: 100, duration: "30s" },
				{ target: 225, duration: "60s" },
				{ target: 750, duration: "30s" },
				{ target: 0, duration: "15s" },
			],
		},
	},
};

export function setup() {
	console.log(`[stage3] provenance: ${JSON.stringify(provenanceBlock())}`);
}

export function hitDiscovery() {
	const res = http.get(`${BASE_URL}/`, { headers: withSourceIpHeaders(__VU) });
	record(res, { scenario: "stage3_read", endpoint: "/" });
	check(res, { "status 200": (r) => r.status === 200 });
}

export function hitMarketDetail() {
	const res = http.get(`${BASE_URL}/m/${MARKET_SLUG}`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, { scenario: "stage3_read", endpoint: "/m/[slug]" });
	check(res, { "status 200": (r) => r.status === 200 });
}

export function hitVisits() {
	const res = http.post(`${BASE_URL}/api/visits`, null, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, { scenario: "stage3_read", endpoint: "/api/visits" });
	check(res, { responded: (r) => r.status !== 0 });
}
