// Moderation vendor-spend cap enforcement, per R-6 (ratified — "no stub, no
// carve-out. Real vendor, bounded volume") and A-5 (provisional — "$50 for
// the whole programme, hard-capped at 150,000 calls, with the rig counting
// calls and aborting at the cap").
//
// ⚠ THIS COUNTS THE RIG'S OWN WRITE-SCENARIO ITERATIONS AS A PROXY FOR
// MODERATION CALLS, not the app's actual OpenAI call count directly — k6
// has no visibility into the app's own downstream vendor calls, only into
// the requests it sends TO the app. This proxy is sound under one
// assumption, stated so it can be checked rather than assumed forever:
// every write-scenario iteration that reaches a real bet/comment POST
// triggers exactly one moderation call (confirmed this session —
// `precommitModerate` calls `moderate()` exactly once per bet, no retries
// counted here since a transient-retry still costs one call to the vendor
// per attempt, which this counter does NOT distinguish — so this is a
// conservative UNDER-count if the app's own retry logic fires, not an
// over-count. Treat the cap as a floor of safety, not an exact ledger).
//
// ⚠ THE $50 FIGURE IS NOT INDEPENDENTLY VERIFIED HERE. A-4 (Day-1 pack §2.4)
// calls for reading the account's actual moderation rate limit and pricing
// posture off the OpenAI dashboard before trusting that 150,000 calls ≈ $50
// — this session has no access to that dashboard. **The 150,000 CALL COUNT
// is the harder, ratified number (A-5) and is what this module enforces.**
// If A-4's real pricing lookup shows 150,000 calls costs meaningfully more
// or less than $50, that changes the dollar framing, not the call-count
// cap this module actually acts on.

import { Counter } from "k6/metrics";

export const moderationCallProxy = new Counter("moderation_call_proxy_total");

/** The ratified hard cap (A-5). Do not raise this without a new founder
 * ruling — it is not a tuning knob. */
export const MODERATION_CALL_CAP = 150000;

/** Call this once per write-scenario iteration that reaches a real
 * bet/comment endpoint (never for read-only or placeholder iterations —
 * counting those would make the cap meaningless). */
export function recordModerationCall() {
	moderationCallProxy.add(1);
}

/** k6 threshold entry for `options.thresholds` — wire this into any script
 * with a real (non-placeholder) write scenario. Aborts the run the moment
 * the proxy count crosses the ratified cap. */
export const moderationCapThreshold = {
	moderation_call_proxy_total: [
		{ threshold: `count<${MODERATION_CALL_CAP}`, abortOnFail: true },
	],
};
