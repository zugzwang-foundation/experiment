// IMAGE POST DEEP LINK — /m/<slug>?post=<n>, a shared link straight to one
// argument with a photo. Staging ran it at PEAK_RATE=100 on a photo-heavy
// market (volume-fixture-b-mid, post 204).
//
//   MARKET_SLUG=<slug> POST_ID=<n> PEAK_RATE=100 k6 run tests/load/read/05-image-post.js

import { getPage, requiredEnv } from "../lib/page.js";
import { ladderScenario, SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock } from "../lib/record.js";

const PATH = `/m/${requiredEnv("MARKET_SLUG")}?post=${requiredEnv("POST_ID")}`;
const { peak, scenario } = ladderScenario("hitPost", "100");

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: { image_post: scenario },
};

export function setup() {
	console.log(
		`[05-image-post] ${JSON.stringify(provenanceBlock({ path: PATH, peak }))}`,
	);
}

export function hitPost() {
	getPage(PATH, "image_post_deep_link");
}
