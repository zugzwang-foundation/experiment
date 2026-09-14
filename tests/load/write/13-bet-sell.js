// BET SELL over real HTTP — each iteration buys, then sells half the shares
// it just bought. Staging T-08: 11 of 17 sells succeeded once past the rate
// limit; every sell that ran was correct.
// ⛔ STAGING ONLY — see `assertWritesAllowed` in lib/target.js.
//
//   MARKET_ID=<uuid> SESSION_POOL_PATH=./bet-session-pool.json PEAK_RATE=20 \
//     k6 run tests/load/write/13-bet-sell.js

import { check } from "k6";
import http from "k6/http";
import { requiredEnv } from "../lib/page.js";
import { SUMMARY_TREND_STATS } from "../lib/ramp.js";
import { provenanceBlock, record } from "../lib/record.js";
import { idempotencyKey, isSuccess, loadSessionPool } from "../lib/sessions.js";
import { withSourceIpHeaders } from "../lib/source-ip.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("13-bet-sell");
const MARKET_ID = requiredEnv("MARKET_ID");
const PEAK = Number(requiredEnv("PEAK_RATE"));
const sessions = loadSessionPool();

export const options = {
	summaryTrendStats: SUMMARY_TREND_STATS,
	scenarios: {
		bet_sell: {
			executor: "ramping-arrival-rate",
			exec: "buyThenSell",
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
		`[13-bet-sell] ${JSON.stringify(provenanceBlock({ peak: PEAK, market: MARKET_ID, sessions: sessions.length }))}`,
	);
}

export function buyThenSell() {
	const session = sessions[Math.floor(Math.random() * sessions.length)];
	const headers = (tag) =>
		withSourceIpHeaders(__VU, {
			"Content-Type": "application/json",
			Cookie: session.cookie,
			"Idempotency-Key": idempotencyKey(tag),
		});

	const buy = http.post(
		`${TARGET_URL}/api/bets/place`,
		JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "10",
			body: `Load test sell setup — ${session.email}, VU ${__VU}.`,
		}),
		{ headers: headers("buy") },
	);
	record(buy, { scenario: "bet_sell_setup_buy", endpoint: "/api/bets/place" });
	if (!isSuccess(buy)) {
		return;
	}
	let sharesBought;
	try {
		sharesBought = JSON.parse(buy.body).data.sharesBought;
	} catch (_err) {
		return;
	}
	if (!sharesBought) {
		return;
	}

	const sell = http.post(
		`${TARGET_URL}/api/bets/sell`,
		JSON.stringify({
			marketId: MARKET_ID,
			shares: (Number.parseFloat(sharesBought) / 2).toFixed(6),
		}),
		{ headers: headers("sell") },
	);
	record(sell, { scenario: "bet_sell", endpoint: "/api/bets/sell" });
	check(sell, { "sell 200/201": isSuccess });
}
