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
