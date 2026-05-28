import { execSync } from "node:child_process";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const buildTimestamp = new Date().toISOString();
const buildGitSha = (() => {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
})();

const nextConfig: NextConfig = {
	env: {
		BUILD_TIMESTAMP: buildTimestamp,
		BUILD_GIT_SHA: buildGitSha,
		// SCAFFOLD.8 C6 amendment: surface ZUGZWANG_ENV into the browser
		// bundle so `instrumentation-client.ts`'s Sentry.init() reads a
		// non-undefined `environment` tag. Without this entry the var
		// isn't NEXT_PUBLIC_-prefixed and would inline as undefined on
		// the client (server-runtime reads from Doppler-synced env are
		// unaffected — same source on Vercel Custom Env). Fallback to
		// "unknown" matches the BUILD_GIT_SHA discipline; in any
		// deployment scenario where the server boots successfully,
		// instrumentation.ts::register() has already validated the live
		// value against VALID_ENVS so the inlined value is one of
		// prod / staging / preview.
		ZUGZWANG_ENV: process.env.ZUGZWANG_ENV ?? "unknown",
	},
};

// `withSentryConfig` wraps the Next.js config with Sentry's build-time
// instrumentation. Under Next.js 16 + Turbopack, the SDK uses the
// `runAfterProductionCompile` hook (default for SDK ≥ 10.13.0) to upload
// source maps + tag the release; no Webpack plugin options needed.
// Marketplace-provisioned env vars (SENTRY_ORG, SENTRY_PROJECT,
// SENTRY_AUTH_TOKEN) are read by `@sentry/cli` under the hood; no manual
// `release` wiring per kickoff (marketplace auto-tags).
export default withSentryConfig(nextConfig, {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	silent: !process.env.CI,
});
