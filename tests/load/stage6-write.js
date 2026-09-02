import { check, sleep } from "k6";
import http from "k6/http";
import {
	moderationCapThreshold,
	recordModerationCall,
} from "./lib/moderation-cap.js";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 6 — WRITE / TRANSACTION LOAD. Bet + comment cost at rate. D-9
// (bet-contention scope) is ratified OUT (R-9) — this measures throughput
// and correctness, not deliberately engineered lock contention (that's
// tests/scale/'s job, already built, already run in-process).
//
// ⛔ THE ARMED ABORT, per RELAY B2's Deliverable 3 (docs/plans/RELAY-B2-money-path-bounds.md):
// any single bet's wall clock exceeding 0.5 × PENDING_TTL_SECONDS (15s
// against today's unmoved 30s) must abort the run. Implemented below as a
// k6 threshold with abortOnFail — this is the one stage where that matters
// most, since it's the stage ADR-0038 P1's unbounded-hang finding is about.
//
// ⛔ BLOCKING PRECONDITIONS:
//   1. Real moderation vendor call, bounded (R-6: no stub — real vendor,
//      $50 / 150,000-call hard cap, rig-enforced). This script does not
//      implement that cap itself; do not run until the cap mechanism
//      exists and is verified to actually stop the run at the ceiling.
//   2. C1's fixtures (a designated hot market, real comment/bet depth).
//   3. A real authenticated session per D-11's ruling.
//
// NOT YET RUN. Placeholder scenario, real shape, real abort wired.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const HOT_MARKET_SLUG = __ENV.HOT_MARKET_SLUG || "github-zugzwang-repo-stars";

// RELAY B2 Deliverable 3 — 0.5 × PENDING_TTL_SECONDS (30s today, unmoved).
const ABORT_WALL_CLOCK_MS = 15000;

export const options = {
	scenarios: {
		bet_write: {
			executor: "ramping-arrival-rate",
			exec: "betPlaceholder",
			startRate: 1,
			timeUnit: "1s",
			preAllocatedVUs: 50,
			maxVUs: 100,
			stages: [
				{ target: 5, duration: "30s" },
				{ target: 45, duration: "60s" }, // M-1's 10% writer share of 450 req/s design target
				{ target: 0, duration: "15s" },
			],
		},
	},
	thresholds: {
		// Armed abort — B2 Deliverable 3. p100 (max) is the right percentile
		// here: ANY single bet past the threshold is the abort condition,
		// not an aggregate.
		"request_duration_ms{scenario:stage6_write}": [
			{ threshold: `max<${ABORT_WALL_CLOCK_MS}`, abortOnFail: true },
		],
		// R-6 / A-5 — the moderation vendor-spend cap. See lib/moderation-cap.js
		// for why this counts iterations, not the app's own vendor calls
		// directly, and why 150,000 (not the $50 framing) is the enforced
		// number.
		...moderationCapThreshold,
	},
};

export function setup() {
	console.log(`[stage6] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		`[stage6] armed abort: any bet wall-clock > ${ABORT_WALL_CLOCK_MS}ms stops the run`,
	);
	console.log(
		"[stage6] ⛔ PLACEHOLDER SCENARIO — real bet-placement entry point not wired. See docblock preconditions.",
	);
}

export function betPlaceholder() {
	// Deliberately NOT a real POST /api/bets/place — see blocking
	// preconditions. A quote read exercises the same market/pool read path
	// without any write, any moderation call, or any real vendor cost, and
	// therefore does NOT call recordModerationCall() below — a placeholder
	// iteration must never count against the real cap.
	const res = http.get(`${BASE_URL}/m/${HOT_MARKET_SLUG}/quote`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, {
		scenario: "stage6_write",
		endpoint: "/m/[slug]/quote (bet placeholder)",
	});
	check(res, { responded: (r) => r.status !== 0 });

	// ⚠ WHEN THE REAL POST /api/bets/place IS WIRED IN (D-11), add exactly
	// one line here: `recordModerationCall();` — once, per real write
	// attempt, regardless of the response status (a rejected bet still cost
	// a moderation call if it got past the precommit gate before failing).
}
