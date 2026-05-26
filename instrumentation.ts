// Next.js 16 server-side instrumentation entry per
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation.
// `register()` fires once per server runtime startup; we dispatch to the
// matching Sentry init by `NEXT_RUNTIME`. `onRequestError` is re-exported so
// Next.js forwards unhandled errors raised in Server Components and Route
// Handlers to Sentry per the SDK's instrumentation contract.

export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
