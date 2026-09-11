import { check, sleep } from "k6";
import http from "k6/http";
import {
	moderationCapThreshold,
	recordModerationCall,
} from "./lib/moderation-cap.js";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 4 — MIXED TRAFFIC. The ratified profile (R-2/M-1 + ENGINE.10 axes
// 9/10): ~90% audience/read concurrent with ~10% bettors/writes, at the
// design target (450-500 req/s combined). This is the stage that exposes
// BR-7 (activity-coupled cache invalidation) — a single-scenario read-only
// test cannot see it, by construction.
//
// ⚠ WRITE SCENARIO IS A PLACEHOLDER. Real bet placement here means real
// metered OpenAI moderation calls (R-6: real vendor, bounded volume,
// 150,000-call hard cap, A-5). The cap threshold IS wired below
// (lib/moderation-cap.js) — what's still missing is the real bet-placement
// entry point itself (D-11's ruling) and C1's fixtures. DO NOT run the
// write scenario until both land.
//
// NOT YET RUN. Script only.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";
const MARKET_SLUG = __ENV.MARKET_SLUG || "github-zugzwang-repo-stars";
const HOT_MARKET_SLUG = __ENV.HOT_MARKET_SLUG || MARKET_SLUG; // C1 designates the real hot market

export const options = {
	scenarios: {
		audience_90pct: {
			executor: "ramping-arrival-rate",
			exec: "audienceRead",
			startRate: 45,
			timeUnit: "1s",
			preAllocatedVUs: 300,
			maxVUs: 1400,
			stages: [
				{ target: 180, duration: "30s" },
				{ target: 405, duration: "90s" },
				{ target: 0, duration: "15s" },
			],
		},
		bettors_10pct: {
			executor: "ramping-arrival-rate",
			exec: "bettorWrite",
			startRate: 5,
			timeUnit: "1s",
			preAllocatedVUs: 50,
			maxVUs: 150,
			stages: [
				{ target: 20, duration: "30s" },
				{ target: 45, duration: "90s" },
				{ target: 0, duration: "15s" },
			],
		},
	},
	thresholds: {
		...moderationCapThreshold,
	},
};

export function setup() {
	console.log(`[stage4] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		`[stage4] hot market: ${HOT_MARKET_SLUG} — segment cache-hit measurement against this vs. a zero-write market`,
	);
}

export function audienceRead() {
	const res = http.get(`${BASE_URL}/m/${HOT_MARKET_SLUG}`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, { scenario: "stage4_mixed", endpoint: "/m/[slug] (audience)" });
	check(res, { "status 200": (r) => r.status === 200 });
}

export function bettorWrite() {
	// PLACEHOLDER — real POST /api/bets/place needs: a real authenticated
	// session (C1/D-11's signup fidelity) and a real idempotency key. Left
	// as a read against the same market so the SHAPE (90/10 split,
	// concurrent) is exercisable and reviewable before those land.
	const res = http.get(`${BASE_URL}/m/${HOT_MARKET_SLUG}/quote`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, {
		scenario: "stage4_mixed",
		endpoint: "/m/[slug]/quote (bettor stand-in)",
	});
	check(res, { responded: (r) => r.status !== 0 });

	// ⚠ WHEN THE REAL POST /api/bets/place IS WIRED IN: add exactly one
	// `recordModerationCall();` call here, once per real write attempt.
}
