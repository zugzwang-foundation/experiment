// MIXED READ — a realistic blend of page views at one combined rate, instead
// of one page in isolation. Staging stage 3 ran the same pages as separate
// scenarios; one weighted scenario keeps a production run to one knob.
//
// Default blend: homepage 40% · market page 35% · profile 15% · sign-in 10%.
//
//   MARKET_SLUG=<slug> PSEUDONYM=<pseudonym> PEAK_RATE=300 k6 run tests/load/read/07-mixed-read.js

import { getPage, requiredEnv } from "../lib/page.js";
import { escalatingScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const MARKET_SLUG = requiredEnv("MARKET_SLUG");
const PSEUDONYM = requiredEnv("PSEUDONYM");
const { peak, scenario } = escalatingScenario("hitMix");

const BLEND = [
	{ weight: 0.4, path: "/" },
	{ weight: 0.35, path: `/m/${MARKET_SLUG}` },
	{ weight: 0.15, path: `/u/${PSEUDONYM}` },
	{ weight: 0.1, path: "/sign-in" },
];

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { mixed_read: scenario },
};

export function setup() {
	console.log(
		`[07-mixed-read] ${JSON.stringify(provenanceBlock({ peak, blend: BLEND }))}`,
	);
}

export function hitMix() {
	let roll = Math.random();
	for (const entry of BLEND) {
		roll -= entry.weight;
		if (roll <= 0) {
			getPage(entry.path, "mixed_read");
			return;
		}
	}
	getPage("/", "mixed_read");
}
