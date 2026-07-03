// Next.js 16 server-side instrumentation entry per
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation.
// `register()` fires once per server runtime startup; we dispatch to the
// matching Sentry init by `NEXT_RUNTIME`. `onRequestError` is re-exported so
// Next.js forwards unhandled errors raised in Server Components and Route
// Handlers to Sentry per the SDK's instrumentation contract.
//
// SCAFFOLD.8 LD-2 / OQ-5: ZUGZWANG_ENV is the canonical per-environment
// scope marker (prod | staging | preview). Validated here because Next.js
// guarantees register() completes before the server handles requests, so
// a boot-time throw fails the deploy rather than surfacing later as a
// downstream throw inside getRedisKey() (the second line of defense per
// LD-10) or a mis-routed Sentry event.

const VALID_ENVS = ["prod", "staging", "preview"] as const;

export async function register(): Promise<void> {
	const env = process.env.ZUGZWANG_ENV;
	if (!env || !VALID_ENVS.includes(env as (typeof VALID_ENVS)[number])) {
		throw new Error(
			`instrumentation.register: ZUGZWANG_ENV ("${env}") must be one of ${VALID_ENVS.join(", ")}`,
		);
	}

	// AUDIT-FIX-B1 A18-DSN (ruling #9): a missing NEXT_PUBLIC_SENTRY_DSN
	// silently no-ops all three Sentry.init sites, so assert presence at boot.
	// Mechanism (same posture as the ZUGZWANG_ENV gate above): Next 16 skips
	// register() during `next build` (NEXT_PHASE guard) and runs it at server
	// cold start — the throw 500s every invocation including /api/health, so
	// the deploy-pipeline health gates (runbook §3, staging gate + pre-promote
	// staged-build curl) catch absence before any traffic is served.
	// `staging` sits INSIDE the throw scope (PRIMARY variant, execute-gate F2:
	// DSN confirmed in both Vercel scopes) so absence blows up at rehearsal,
	// never first at prod. `preview` never throws (local builds + CI). Client
	// init stays no-op-if-absent — this server gate catches absence first.
	if (
		(env === "prod" || env === "staging") &&
		!process.env.NEXT_PUBLIC_SENTRY_DSN
	) {
		throw new Error(
			`instrumentation.register: NEXT_PUBLIC_SENTRY_DSN is required when ZUGZWANG_ENV="${env}" — Sentry.init would silently no-op (SPEC.2 §17)`,
		);
	}

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
