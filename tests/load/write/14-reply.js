// REPLY — a counter-argument is a reply-bet on a parent comment (ADR-0017), a
// deeper path than an original post. Staging T-12: 18 of 503 succeeded, 485
// hit the shared per-IP limit; every reply that ran was correct.
// ⛔ STAGING ONLY — see `assertWritesAllowed` in lib/target.js.
//
//   MARKET_ID=<uuid> PARENT_COMMENT_ID=<uuid> SESSION_POOL_PATH=./bet-session-pool.json \
//     PEAK_RATE=50 k6 run tests/load/write/14-reply.js

import { check } from "k6";
import http from "k6/http";
import { requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock, record } from "../lib/record.js";
import { idempotencyKey, isSuccess, loadSessionPool } from "../lib/sessions.js";
import { withSourceIpHeaders } from "../lib/source-ip.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("14-reply");
const MARKET_ID = requiredEnv("MARKET_ID");
const PARENT_COMMENT_ID = requiredEnv("PARENT_COMMENT_ID");
const PEAK = Number(requiredEnv("PEAK_RATE"));
const sessions = loadSessionPool();

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		reply: {
			executor: "ramping-arrival-rate",
			exec: "placeReply",
			startRate: 0,
			timeUnit: "1s",
			preAllocatedVUs: Math.min(PEAK, 300),
			maxVUs: Math.max(PEAK * 5, 300),
			stages: [
				{ target: Math.round(PEAK * 0.5), duration: "10s" },
				{ target: PEAK, duration: "15s" },
				{ target: PEAK, duration: "15s" },
				{ target: 0, duration: "10s" },
			],
		},
	},
};

export function setup() {
	console.log(
		`[14-reply] ${JSON.stringify(provenanceBlock({ peak: PEAK, parent: PARENT_COMMENT_ID }))}`,
	);
}

export function placeReply() {
	const session = sessions[Math.floor(Math.random() * sessions.length)];
	const res = http.post(
		`${TARGET_URL}/api/bets/place`,
		JSON.stringify({
			marketId: MARKET_ID,
			side: "NO",
			stake: "55",
			parentCommentId: PARENT_COMMENT_ID,
			body: `Load test counter-argument — ${session.email}, VU ${__VU}.`,
		}),
		{
			headers: withSourceIpHeaders(__VU, {
				"Content-Type": "application/json",
				Cookie: session.cookie,
				"Idempotency-Key": idempotencyKey("reply"),
			}),
		},
	);
	record(res, { scenario: "reply", endpoint: "/api/bets/place (reply)" });
	check(res, { "status 200/201": isSuccess });
}
