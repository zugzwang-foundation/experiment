// VISITS BEACON — POST /api/visits, the call behind the header's visitor
// counter. Staging stage 3 ran it alongside page reads.
// ⛔ STAGING ONLY. It is a write: every request can move the visitor count
// that production shows to real visitors.
//
//   PEAK_RATE=200 k6 run tests/load/write/17-visits-beacon.js

import { check } from "k6";
import http from "k6/http";
import { escalatingScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock, record } from "../lib/record.js";
import { withSourceIpHeaders } from "../lib/source-ip.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("17-visits-beacon");
const { peak, scenario } = escalatingScenario("hitVisits");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { visits: scenario },
};

export function setup() {
	console.log(
		`[17-visits-beacon] ${JSON.stringify(provenanceBlock({ peak }))}`,
	);
}

export function hitVisits() {
	const res = http.post(`${TARGET_URL}/api/visits`, null, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, { scenario: "visits_beacon", endpoint: "/api/visits" });
	check(res, { responded: (r) => r.status !== 0 });
}
