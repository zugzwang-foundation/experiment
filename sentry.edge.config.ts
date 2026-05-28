// Sentry edge-runtime initialisation per SCAFFOLD.5 + ADR-0007 (substance
// at SPEC.2 §0.1). Imported by `instrumentation.ts` register() when
// `process.env.NEXT_RUNTIME === 'edge'`. Edge runtime is reachable from
// proxy / route handlers configured with `runtime = 'edge'`; v1 carve-outs
// (bet endpoints + OAuth callbacks + public-read JSON) run nodejs but the
// init still ships so any future edge handler captures.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.ZUGZWANG_ENV,
	tracesSampleRate: 1.0,
	sendDefaultPii: false,
	debug: false,
});
