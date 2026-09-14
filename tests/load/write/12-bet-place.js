// BET PLACE over real HTTP — origin check, session cookie, idempotency, rate
// limit, moderation, then the W-1 transaction. Staging T-06: correct; capped
// by `betPerIp` (30 req/min per IP), and one rig machine is one IP.
// ⛔ STAGING ONLY — see `assertWritesAllowed` in lib/target.js.
//
//   MARKET_ID=<uuid> SESSION_POOL_PATH=./bet-session-pool.json PEAK_RATE=50 \
//     k6 run tests/load/write/12-bet-place.js

import { check } from "k6";
import http from "k6/http";
import { requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock, record } from "../lib/record.js";
import { idempotencyKey, isSuccess, loadSessionPool } from "../lib/sessions.js";
import { withSourceIpHeaders } from "../lib/source-ip.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("12-bet-place");
const MARKET_ID = requiredEnv("MARKET_ID");
const PEAK = Number(requiredEnv("PEAK_RATE"));
const sessions = loadSessionPool();

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		bet_place: {
			executor: "ramping-arrival-rate",
			exec: "placeBet",
			startRate: 0,
			timeUnit: "1s",
			preAllocatedVUs: Math.min(PEAK, 500),
			maxVUs: Math.max(PEAK * 5, 500),
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
		`[12-bet-place] ${JSON.stringify(provenanceBlock({ peak: PEAK, market: MARKET_ID, sessions: sessions.length }))}`,
	);
}

export function placeBet() {
	const session = sessions[Math.floor(Math.random() * sessions.length)];
	const res = http.post(
		`${TARGET_URL}/api/bets/place`,
		JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "12",
			body: `Load test bet — ${session.email}, VU ${__VU}.`,
		}),
		{
			headers: withSourceIpHeaders(__VU, {
				"Content-Type": "application/json",
				Cookie: session.cookie,
				"Idempotency-Key": idempotencyKey("place"),
			}),
		},
	);
	record(res, { scenario: "bet_place", endpoint: "/api/bets/place" });
	check(res, {
		"status 200/201": isSuccess,
		"not 5xx": (r) => r.status < 500,
	});
}
