// Shared per-request record + provenance block, per S-5-LOAD-PLAN.md Workstream C
// ("Every request should carry run_id, scenario, endpoint, operation") and the
// observability plan's O-4/O-9 fields (URL, status, wall clock, limiter decision,
// canary SHA, pooler mode, offered rate step, timestamp).
//
// NEVER k6's own executor for concurrency shape — that's set per-script in
// `options.scenarios`. This module only shapes what gets RECORDED, so every
// stage's raw data is comparable and correlatable to the backend sampler's
// JSONL via the same clock-offset convention used elsewhere in this programme
// (never an assumed shared clock).

import { Counter, Trend } from "k6/metrics";

export const requestDuration = new Trend("request_duration_ms", true);
export const limiterThrottled = new Counter("limiter_throttled_total");
export const limiterOpen = new Counter("limiter_fail_open_total");

/**
 * Build one per-request record from a k6 http response. Call this after every
 * request in every stage script — it's the shared shape the rig's evidence
 * package depends on (S-5-LOAD-PLAN.md §14 "Per-run evidence package").
 */
export function record(res, meta) {
	requestDuration.add(res.timings.duration, {
		scenario: meta.scenario,
		endpoint: meta.endpoint,
	});

	// Limiter decision AS RETURNED, never inferred (S-5-OBSERVABILITY-PLAN.md
	// MISSING-6) — a 429 IS the limiter firing; anything else is NOT evidence
	// the limiter held, per checkRateLimit's fail-open posture.
	if (res.status === 429) {
		limiterThrottled.add(1, { scenario: meta.scenario });
	}

	return {
		timestamp: new Date().toISOString(),
		run_id: __ENV.RUN_ID || "unset-run-id",
		scenario: meta.scenario,
		endpoint: meta.endpoint,
		operation: meta.operation || meta.endpoint,
		url: res.url,
		status: res.status,
		wall_clock_ms: res.timings.duration,
		limiter_decision: res.status === 429 ? "throttled" : "not-throttled",
		canary: __ENV.EXPECTED_CANARY || "unrecorded",
		pooler_mode: __ENV.POOLER_MODE || "unrecorded",
		offered_rate_step: __ENV.OFFERED_RATE || "unrecorded",
	};
}

/**
 * Provenance block header — S-5-LOAD-PLAN.md §14 "run metadata". Every stage
 * script should log this once via setup() so every run's raw output is
 * self-describing without depending on the invoker's memory.
 */
export function provenanceBlock() {
	return {
		git_commit: __ENV.GIT_COMMIT || "unrecorded",
		staging_canary: __ENV.EXPECTED_CANARY || "unrecorded",
		environment: __ENV.TARGET_ENV || "staging",
		k6_version: __ENV.K6_VERSION || "unrecorded",
		vus_or_rate: __ENV.OFFERED_RATE || "unrecorded",
		source_ip_posture:
			__ENV.SOURCE_IP_POSTURE ||
			"unrecorded — MUST be set per S-5-LOAD-PLAN.md §2.2",
		sentry_sampling_posture:
			__ENV.SENTRY_SAMPLING_POSTURE || "unrecorded — Stage 0.7 decision",
		fixture_manifest_hash: __ENV.FIXTURE_HASH || "unrecorded",
		timestamp: new Date().toISOString(),
	};
}
