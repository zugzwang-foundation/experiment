import { check, sleep } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";
import { withSourceIpHeaders } from "./lib/source-ip.js";

// STAGE 5 — SIGNUP LOAD. R-8 (ratified): "(b) at volume + bounded (a)
// sample, capped by count." (c) — a staging-only seeded-session shortcut —
// is explicitly REFUSED because it's an auth-surface change on a critical
// path needing its own ADR, never load-test scaffolding.
//
// ⛔ BLOCKING PRECONDITIONS, NONE MET AS OF THIS SCRIPT'S WRITING:
//   1. C1 must seed identity_pool to (signup rate × stage duration × 3
//      margin) — currently 849 unassigned, this stage's own M-3 target
//      (test to 30/s) would drain that in <30s.
//   2. The real (b)-path entry point (internal adapter, matching
//      generate.staging.test.ts's own pattern) must be wired here instead
//      of the placeholder below — this script does NOT fabricate real
//      users against a real entry point, per ADR-0036 primitive 3 ("never
//      mocked — anything that writes a row").
//   3. The bounded (a)-sample count cap (real HTTP + real email, capped)
//      needs its actual number decided — not invented here.
//
// NOT YET RUN, and structurally cannot run correctly until the above land.
// This script exists to hold the SHAPE (rate ramp to 30/s, per M-3) ready
// for review, not as something to execute as-is.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";

export const options = {
	scenarios: {
		signup_volume: {
			executor: "ramping-arrival-rate",
			exec: "signupPlaceholder",
			startRate: 1,
			timeUnit: "1s",
			preAllocatedVUs: 50,
			maxVUs: 100,
			stages: [
				{ target: 8, duration: "30s" }, // first-hour signup share, per M-3 (~8-14/s)
				{ target: 30, duration: "30s" }, // M-3's own stated ceiling to test to
				{ target: 0, duration: "10s" },
			],
		},
	},
};

export function setup() {
	console.log(`[stage5] provenance: ${JSON.stringify(provenanceBlock())}`);
	console.log(
		"[stage5] ⛔ PLACEHOLDER SCENARIO — real signup entry point not wired. See docblock preconditions.",
	);
}

export function signupPlaceholder() {
	// Deliberately NOT a real signup call — see the blocking preconditions
	// above. Hits /api/health so the RATE SHAPE is at least exercisable and
	// reviewable; swap for the real (b)-path entry point once C1 and D-11
	// are both resolved.
	const res = http.get(`${BASE_URL}/api/health`, {
		headers: withSourceIpHeaders(__VU),
	});
	record(res, {
		scenario: "stage5_signup",
		endpoint: "/api/health (signup placeholder)",
	});
	check(res, { responded: (r) => r.status !== 0 });
}
