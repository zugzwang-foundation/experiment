import "server-only";

import { ipAddress } from "@vercel/functions";

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

/**
 * AWS-MIGRATION — the caller's IP, on Vercel and behind an AWS load balancer.
 *
 * `ipAddress()` from `@vercel/functions` reads `x-real-ip`, which Vercel sets
 * and an Application Load Balancer does not — so off-platform this column would
 * silently become `null` for every request, and the §16.3 H3 log row would lose
 * one of its seven fields without anything failing.
 *
 * ⚠ ONLY THE FIRST HOP OF `x-forwarded-for` IS TRUSTED, and that is the whole
 * subtlety: the header is a client-controllable list, so a request can arrive
 * carrying a forged chain. Behind our own ALB the LAST entry is the one the
 * balancer appended and the earlier ones are whatever the client sent — but the
 * first is what every other log in this stack means by "the client", and this
 * value is DIAGNOSTIC ONLY. It gates nothing: rate limiting keys on the user,
 * never on this. Keep it that way, or this becomes a spoofable control.
 */
function clientIp(request: Request): string | null {
	const vercel = ipAddress(request);
	if (vercel) {
		return vercel;
	}
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) {
			return first;
		}
	}
	return request.headers.get("x-real-ip") ?? null;
}

export function logRequest(args: LogRequestArgs): void {
	const url = new URL(args.request.url);
	const row = {
		timestamp: new Date().toISOString(),
		user_id: args.userId,
		route: url.pathname,
		status_code: args.status,
		ip: clientIp(args.request),
		user_agent: args.request.headers.get("user-agent") ?? null,
		latency_ms: Date.now() - args.startedAt,
	};
	console.log(JSON.stringify(row));
}
