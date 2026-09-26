import "server-only";

import { getRequestClientIp } from "@/server/middleware/client-ip";

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
 * S-1 / ADR-0061 — the caller's IP via the shared trusted-IP helper, on Vercel
 * (`x-real-ip`) and behind Cloudflare + the ALB alike. It used to read the
 * FIRST hop of X-Forwarded-For, which the client controls; the helper starts
 * from the address our own edge observed instead. Diagnostic here, but the
 * same value now gates the per-IP limits, so there is one derivation.
 */
function clientIp(request: Request): string | null {
	return getRequestClientIp(request);
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
