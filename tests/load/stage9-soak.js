import { check } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 9 — SOAK. R-12: folded soak, ends with a deliberate stop + ≥15 min
// sampled window. This is the ONLY stage that measures what `max: 4`
// actually protects — stranded connections after suspension (620s idle
// observed with a 20s idle_timeout live, because Fluid suspends and a
// suspended instance runs no timers). A throughput-only run cannot see
// this; it requires the load to STOP and then keep sampling.
//
// ⚠ THIS SCRIPT ONLY COVERS THE LOAD HALF. The ≥15-minute POST-LOAD
// observation window is `sample-backend-activity.ts` (SAMPLE_SECONDS=900+),
// run separately, starting the moment this script's traffic ends — not
// something k6 itself does.
//
// NOT YET RUN. Read-only, safe to run once C1 lands (moderate duration —
// note the pack's actual design calls for this folded into a much longer,
// e.g. 24h, soak; this is the k6 load-generation shape, scaled down for a
// first real run, not the full-duration soak itself).

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const MARKET_SLUG = __ENV.MARKET_SLUG || "github-zugzwang-repo-stars";

export const options = {
	scenarios: {
		sustained_moderate: {
			executor: "constant-arrival-rate",
			exec: "hitReadPaths",
			rate: 200, // moderate, sustained — well under the 450-500 design target
			timeUnit: "1s",
			duration: "10m", // scale up to the full soak window separately; this is the shape
			preAllocatedVUs: 200,
			maxVUs: 600,
		},
	},
};

export function setup() {
	console.log(`[stage9] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		"[stage9] ⚠ START sample-backend-activity.ts with SAMPLE_SECONDS>=900 the MOMENT this run's traffic stops — that post-load window is the actual point of this stage, and it is not part of this script.",
	);
}

export function hitReadPaths() {
	const res =
		Math.random() < 0.5
			? http.get(`${BASE_URL}/`, { headers: withSourceIpHeaders(__VU) })
			: http.get(`${BASE_URL}/m/${MARKET_SLUG}`, {
					headers: withSourceIpHeaders(__VU),
				});
	record(res, { scenario: "stage9_soak", endpoint: "mixed read" });
	check(res, { "status 200": (r) => r.status === 200 });
}
