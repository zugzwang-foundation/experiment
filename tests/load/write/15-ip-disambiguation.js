// IP DISAMBIGUATION — N one-shot bettors, each trying exactly once with its
// own header IP, to tell "the limiter is per-IP" apart from "the rig is broken".
// Staging T-07: 85% still blocked, only the first ~11 got through — because
// Vercel replaces the header and every VU shared the rig's one real IP (C-02).
// ⛔ STAGING ONLY — see `assertWritesAllowed` in lib/target.js.
//
//   MARKET_ID=<uuid> SESSION_POOL_PATH=./bet-session-pool.json VU_COUNT=200 \
//     k6 run tests/load/write/15-ip-disambiguation.js

import { check } from "k6";
import http from "k6/http";
import { requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock, record } from "../lib/record.js";
import { idempotencyKey, isSuccess, loadSessionPool } from "../lib/sessions.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("15-ip-disambiguation");
const MARKET_ID = requiredEnv("MARKET_ID");
const VU_COUNT = Number(__ENV.VU_COUNT || "200");
const sessions = loadSessionPool();

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		one_shot_per_ip: {
			executor: "per-vu-iterations",
			exec: "placeOnce",
			vus: VU_COUNT,
			iterations: 1,
			maxDuration: "120s",
		},
	},
};

export function setup() {
	console.log(
		`[15-ip-disambiguation] ${JSON.stringify(provenanceBlock({ vus: VU_COUNT, sessions: sessions.length }))}`,
	);
}

function distinctIp(vuId) {
	const n = vuId % 16000000;
	return `198.51.${(((n >> 16) & 0xff) % 100) + 1}.${(((n >> 8) & 0xff) ^ (n & 0xff)) % 255}`;
}

export function placeOnce() {
	const session = sessions[__VU % sessions.length];
	const res = http.post(
		`${TARGET_URL}/api/bets/place`,
		JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "10",
			body: `IP-disambiguation one-shot, VU ${__VU}.`,
		}),
		{
			headers: {
				"Content-Type": "application/json",
				Cookie: session.cookie,
				"Idempotency-Key": idempotencyKey("ipdis"),
				"x-forwarded-for": distinctIp(__VU),
			},
		},
	);
	record(res, { scenario: "ip_disambiguation", endpoint: "/api/bets/place" });
	check(res, { "status 200/201": isSuccess });
}
