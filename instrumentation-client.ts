// Next.js 15.3+ client-side instrumentation entry — replaces the deprecated
// `sentry.client.config.ts`. Sentry SDK init runs once on the client at
// app load; `onRouterTransitionStart` is re-exported so the App Router
// emits navigation breadcrumbs into Sentry per the SDK's instrumentation
// contract. `NEXT_PUBLIC_SENTRY_DSN` is provisioned by the Sentry Vercel
// Marketplace integration; the SDK no-ops gracefully when DSN is absent
// (covered intentionally — no try/catch wrapper per kickoff).

import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 1.0,
	sendDefaultPii: false,
	debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
