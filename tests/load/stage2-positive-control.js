import { check, sleep } from "k6";
import http from "k6/http";
import { provenanceBlock, record } from "./lib/record.js";

// STAGE 2 — POSITIVE CONTROL. S-5-LOAD-PLAN.md Stage 2: "prove the rig can
// detect a known passing condition AND prove a known failing condition
// actually fails." Reuses the S-3 shape essentially as written: clean at
// N=3 concurrent signups, wedged at N=4 (the reproduced pool-checkout
// deadlock, since fixed at ADR-0043 / PR #431 — this stage re-proves the
// fix holds, it does not re-discover the original bug).
//
// ⚠ THE ONE NAMED EXCEPTION TO M-0. Every other stage uses
// constant-arrival-rate / ramping-arrival-rate. THIS stage alone uses
// constant-vus, because the point here is exact, held concurrency (exactly
// N simultaneous in-flight signups), not an offered rate — arrival-rate
// executors do not guarantee N requests are ever concurrently in-flight at
// once, which is the entire property this test needs to hold.
//
// ⛔ ABORT THE WHOLE PROGRAMME IF THE FAILING ARM DOES NOT FAIL. Per
// S-5-OBSERVABILITY-PLAN.md's own rule 2: "a deadlock test that always
// hangs is indistinguishable from one that detects a deadlock." If N=4
// does NOT reproduce distinguishable wedging (elevated latency / errors
// relative to N=3), every later "the system held" result in this
// programme is uninterpretable, because the rig's ability to SEE a real
// failure was never proven.
//
// NOT YET RUN. This session built the script; it did not execute it
// against staging.

const BASE_URL = __ENV.TARGET_URL || "https://staging.zugzwangworld.com";

export const options = {
	scenarios: {
		clean_n3: {
			executor: "constant-vus",
			vus: 3,
			duration: "20s",
			exec: "signupAttempt",
			env: { PC_ARM: "clean" },
		},
		wedge_n4: {
			executor: "constant-vus",
			vus: 4,
			duration: "20s",
			exec: "signupAttempt",
			startTime: "25s",
			env: { PC_ARM: "wedge" },
		},
	},
};

export function setup() {
	console.log(`[stage2] provenance: ${JSON.stringify(provenanceBlock())}`);
}

export function signupAttempt() {
	// Placeholder endpoint — the real signup-path fidelity choice (internal
	// adapter vs real HTTP+email vs seeded session) is RELAY B2/D-11's
	// decision (S-5-SCALE-ROADMAP.md), not this script's. This hits the
	// health endpoint as a stand-in so the CONCURRENCY SHAPE (the actual
	// thing being tested) is exercisable before that choice is finalized —
	// swap the URL for the real signup entry point once D-11 rules.
	const res = http.get(`${BASE_URL}/api/health`);
	record(res, {
		scenario: "stage2_positive_control",
		endpoint: "/api/health (signup stand-in)",
	});
	check(res, { responded: (r) => r.status !== 0 });
	sleep(0.1);
}
