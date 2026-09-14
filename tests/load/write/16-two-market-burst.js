// TWO-MARKET BURST — the session pool split across two markets, all at once.
// Staging T-15: 8 succeeded on market A, 10 on market B. ⚠ This does NOT show
// a per-market limiter; none exists. One rig is one IP, so both halves share
// one `betPerIp` budget and an even split is what chance predicts (C-02).
// ⛔ STAGING ONLY — see `assertWritesAllowed` in lib/target.js.
//
//   MARKET_A_ID=<uuid> MARKET_B_ID=<uuid> SESSION_POOL_PATH=./bet-session-pool.json \
//     k6 run tests/load/write/16-two-market-burst.js

import { check } from "k6";
import http from "k6/http";
import { Counter } from "k6/metrics";
import { requiredEnv } from "../lib/page.js";
import { provenanceBlock, record } from "../lib/record.js";
import { idempotencyKey, isSuccess, loadSessionPool } from "../lib/sessions.js";
import { assertWritesAllowed, TARGET_URL } from "../lib/target.js";

assertWritesAllowed("16-two-market-burst");
const MARKETS = {
	a: requiredEnv("MARKET_A_ID"),
	b: requiredEnv("MARKET_B_ID"),
};
const sessions = loadSessionPool();
const half = Math.floor(sessions.length / 2);

const outcomes = {
	a: {
		ok: new Counter("success_market_a"),
		throttled: new Counter("throttled_market_a"),
		other: new Counter("other_market_a"),
	},
	b: {
		ok: new Counter("success_market_b"),
		throttled: new Counter("throttled_market_b"),
		other: new Counter("other_market_b"),
	},
};

export const options = {
	scenarios: {
		burst: {
			executor: "per-vu-iterations",
			vus: half * 2,
			iterations: 1,
			maxDuration: "30s",
		},
	},
};

export function setup() {
	console.log(
		`[16-two-market-burst] ${JSON.stringify(provenanceBlock({ perMarket: half }))}`,
	);
}

export default function () {
	const idx = __VU - 1;
	if (idx >= half * 2) {
		return;
	}
	const side = idx < half ? "a" : "b";
	const session = sessions[idx];
	const res = http.post(
		`${TARGET_URL}/api/bets/place`,
		JSON.stringify({
			marketId: MARKETS[side],
			side: "YES",
			stake: "12",
			body: `Two-market burst — market ${side}, ${session.userId}.`,
		}),
		{
			headers: {
				"Content-Type": "application/json",
				Cookie: session.cookie,
				"Idempotency-Key": idempotencyKey(`burst-${side}`),
			},
			tags: { name: `market_${side}` },
		},
	);
	record(res, { scenario: `two_market_${side}`, endpoint: "/api/bets/place" });
	check(res, { "status 200/201": isSuccess });
	if (isSuccess(res)) {
		outcomes[side].ok.add(1);
	} else if (res.status === 429) {
		outcomes[side].throttled.add(1);
	} else {
		outcomes[side].other.add(1);
	}
}
