// Per-request metrics and the provenance line every run prints once.
//
// Ported from the staging campaign's `lib/record.js` unchanged in what it
// measures, so staging and production summaries are comparable field for
// field. The environment now comes from `target.js` instead of defaulting to
// "staging".

import { Counter, Trend } from "k6/metrics";
import { TARGET_ENV, TARGET_URL } from "./target.js";

export const requestDuration = new Trend("request_duration_ms", true);
export const limiterThrottled = new Counter("limiter_throttled_total");
export const connectionFailures = new Counter("connection_failures_total");

/**
 * Record one response. A 429 is the app's rate limiter answering; status 0
 * is a request that never got an HTTP answer at all (timeout, reset, refused).
 * ⚠ Status 0 spiking past ~600 req/s from one machine is usually Vercel's
 * abuse protection, not the app (staging correction C-03).
 */
export function record(res, meta) {
	const tags = { scenario: meta.scenario, endpoint: meta.endpoint };
	requestDuration.add(res.timings.duration, tags);
	if (res.status === 429) {
		limiterThrottled.add(1, tags);
	}
	if (res.status === 0) {
		connectionFailures.add(1, tags);
	}
}

export function provenanceBlock(extra) {
	return Object.assign(
		{
			run_id: __ENV.RUN_ID || "unset",
			target_url: TARGET_URL,
			target_env: TARGET_ENV,
			deployed_canary: __ENV.EXPECTED_CANARY || "unrecorded",
			git_commit: __ENV.GIT_COMMIT || "unrecorded",
			k6_version: __ENV.K6_VERSION || "unrecorded",
			rig: __ENV.RIG || "unrecorded",
			timestamp: new Date().toISOString(),
		},
		extra || {},
	);
}
