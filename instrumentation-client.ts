// Next.js 15.3+ client-side instrumentation entry — replaces the deprecated
// `sentry.client.config.ts`. Sentry + PostHog SDKs both initialize here so
// the singletons are live before any React tree renders. The SDKs no-op
// gracefully when their respective env vars are absent (covered
// intentionally — no try/catch wrapper per kickoff).

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 1.0,
	sendDefaultPii: false,
	debug: false,
});

// PostHog: feature flags only in v1 (AGENTS.md §1 observability stack +
// SPEC.2 §0.1 ADR-0007 entry). Disable autocapture, pageview, pageleave,
// and session recording so the SDK acts as a flag transport. Conditional
// init guards the dev case where the operator hasn't provisioned the env
// var; in production the Marketplace + Doppler sync land the values.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
	posthog.init(posthogKey, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
		autocapture: false,
		capture_pageview: false,
		capture_pageleave: false,
		disable_session_recording: true,
	});
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
