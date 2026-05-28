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

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
