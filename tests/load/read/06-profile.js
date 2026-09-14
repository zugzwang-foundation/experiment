// PROFILE PAGE — /u/<pseudonym>: identity card, positions, arguments.
// Staging T-10/T-11: 200 req/s → 99.48% success; heavy load → 73.18%.
// The best-performing content page on staging.
//
//   PSEUDONYM=<pseudonym> PEAK_RATE=200 k6 run tests/load/read/06-profile.js

import { getPage, requiredEnv } from "../lib/page.js";
import { escalatingScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const PSEUDONYM = requiredEnv("PSEUDONYM");
const { peak, scenario } = escalatingScenario("hitProfile");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { profile: scenario },
};

export function setup() {
	console.log(
		`[06-profile] ${JSON.stringify(provenanceBlock({ pseudonym: PSEUDONYM, peak }))}`,
	);
}

export function hitProfile() {
	getPage(`/u/${PSEUDONYM}`, `profile_${peak}`);
}
