import "server-only";

import { ipAddress } from "@vercel/functions";

import type { DeviceClass } from "@/server/auth/device-class";

// Structured request-log emitter per SPEC.1 §16.3 H3 + the ADR-0007 Axiom
// amendment (substance at SPEC.2 §0.1 ADR-0007 entry — Vercel runtime logs
// replace Axiom as the structured-log surface).
//
// Field set is LOCKED at the seven enumerated columns: timestamp, user_id,
// route, status_code, ip, user_agent, latency_ms. SPEC.1 §16.3 explicitly
// forecloses request body, response body, headers beyond user-agent, and
// any other PII. The public-dataset extractor (post-experiment per §12.2)
// relies on the shape staying byte-stable; additions require a SPEC.1
// amendment and a same-commit field-set update here.
//
// Emission via console.log(JSON.stringify(row)) — Vercel runtime logs
// auto-ingest each stdout line. This is the project's "structured logger"
// referenced by AGENTS.md §11 (the rule forbids ad-hoc console.log in
// handler bodies; routing every server-side request log through this one
// helper is what the rule preserves).
//
// Caller responsibility: invoke as the post-handler step (AGENTS.md §7
// step 7 observability sibling). Rejected requests — origin-blocked,
// rate-limited, auth-failed — DO NOT call this helper. The rule "did the
// request happen and how long did it take" stays satisfied because
// rejections never reached the handler body; Sentry covers the error
// story for those paths via the alarm-6/4 catalogue.

interface LogRequestArgs {
	request: Request;
	status: number;
	userId: string | null;
	startedAt: number;
}

export function logRequest(args: LogRequestArgs): void {
	const url = new URL(args.request.url);
	const row = {
		timestamp: new Date().toISOString(),
		user_id: args.userId,
		route: url.pathname,
		status_code: args.status,
		ip: ipAddress(args.request) ?? null,
		user_agent: args.request.headers.get("user-agent") ?? null,
		latency_ms: Date.now() - args.startedAt,
	};
	console.log(JSON.stringify(row));
}

// MOBILE-1 · Phase B (plan §3 Observability, M1-5) — the ADR-0045 device-gate
// reject emitter.
//
// ⛔ A SEPARATE EXPORT, NOT A REUSE OR A WIDENING OF `logRequest`. Two
// independent reasons, either sufficient:
//   1. `logRequest`'s own doctrine above excludes rejections in as many words
//      ("Rejected requests — origin-blocked, rate-limited, auth-failed — DO NOT
//      call this helper"), because a rejected request never reached a handler
//      body and has no latency to report;
//   2. its seven-field shape is LOCKED to the public-dataset extractor
//      (SPEC.1 §16.3) — adding a field there needs a SPEC.1 amendment, which
//      this task does not carry and does not want.
// So this row shares the emission mechanism and nothing else, and it leads with
// an `event` discriminator so the two are separable in one log stream rather
// than by guessing from which keys happen to be present.
//
// WHY IT EXISTS AT ALL. ADR-0045 Decision Driver 1 knowingly trades against
// ADR-0038's 100k-signup target, and records the trade so that ratifying it is
// a choice rather than an oversight. Without a line per reject there is no way
// to check that trade against reality — not the false-positive rate, not
// whether the gate still fires — until the November freeze, by which point
// there is nothing left to do about it.

// ⛔ BOTH ATTACKER-CONTROLLED FIELDS ARE BOUNDED, NOT JUST THE OBVIOUS ONE.
// `user_agent` is the field anyone thinks to bound. `route` is fed
// `url.pathname` from a CATCH-ALL mount (`/api/auth/[...all]`), so every path
// under it reaches the gate and an unauthenticated caller chooses the string:
// `GET /api/auth/<9 KB of padding>` with a phone User-Agent produced a single
// 9 KB stdout line before this bound existed. That is unmetered, unauthenticated
// log-ingestion cost — and worse, this row is the ONLY instrument ADR-0045
// Decision Driver 1 has for measuring the gate's false-positive rate before the
// freeze, so burying a real "a Mac got blocked" line under volume is the actual
// attack. The classifier's decision never reads past the path prefix, so the log
// has no reason to carry more of it than the decision did. (Found by
// `@security-auditor` at MOBILE-1 Phase B; the residual sampling/correlation
// question is escalated in `claude-progress.md`, not solved here.)
const REJECT_LOG_UA_MAX_LEN = 256;
const REJECT_LOG_ROUTE_MAX_LEN = 256;

interface DeviceGateRejectArgs {
	/** Which of the two gates refused — plan §3 call site 1 vs. call site 2. */
	callSite: "auth-route" | "tos-accept";
	/** The reason, in the classifier's own vocabulary. */
	deviceClass: DeviceClass;
	userAgent: string | null;
	route: string;
}

export function logDeviceGateReject(args: DeviceGateRejectArgs): void {
	const row = {
		event: "device_gate_reject",
		timestamp: new Date().toISOString(),
		call_site: args.callSite,
		device_class: args.deviceClass,
		route: args.route.slice(0, REJECT_LOG_ROUTE_MAX_LEN),
		// Truncated on the same bound the classifier reads to, so the log can
		// never carry more of a client-controlled string than the decision did.
		user_agent: args.userAgent?.slice(0, REJECT_LOG_UA_MAX_LEN) ?? null,
	};
	console.log(JSON.stringify(row));
}
