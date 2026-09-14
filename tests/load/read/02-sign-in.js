// SIGN-IN PAGE — the shared front door for new and returning users.
// Staging T-01/T-02: >98% failed at every batch, 200 → 3,000 req/s.
// Fixed since by ADR-0052 (the page is now prerendered); this is the re-measure.
//
// PAGE-LOAD capacity only (a plain GET). Real signups consume the finite
// identity pool and are never load-tested against production.
//
//   PEAK_RATE=200 k6 run tests/load/read/02-sign-in.js
//   PAGE_PATH=/sign-in/otp PEAK_RATE=200 k6 run tests/load/read/02-sign-in.js

import { getPage } from "../lib/page.js";
import { escalatingScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const PAGE_PATH = __ENV.PAGE_PATH || "/sign-in";
const { peak, scenario } = escalatingScenario("hitSignIn");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { sign_in: scenario },
};

export function setup() {
	console.log(
		`[02-sign-in] ${JSON.stringify(provenanceBlock({ page: PAGE_PATH, peak }))}`,
	);
}

export function hitSignIn() {
	getPage(PAGE_PATH, `sign_in_${peak}`);
}
