// Sentry server-runtime initialisation per SCAFFOLD.5 + ADR-0007 (substance
// at SPEC.2 §0.1). Imported by `instrumentation.ts` register() when
// `process.env.NEXT_RUNTIME === 'nodejs'`. The marketplace integration
// auto-provisions `NEXT_PUBLIC_SENTRY_DSN` + release tagging at build time;
// no manual `release: process.env.VERCEL_GIT_COMMIT_SHA` wiring per kickoff.
// `sendDefaultPii: false` is load-bearing for SPEC.1 §16.3 transparency-by-
// design — no auto-capture of request/response bodies or headers in Sentry
// breadcrumbs.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.ZUGZWANG_ENV,
	tracesSampleRate: 1.0,
	sendDefaultPii: false,
	debug: false,
});
