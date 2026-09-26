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
	// S-4 Phase B — Cache Components on. Enables `'use cache'`/`cacheLife`/
	// `cacheTag` (S-4 Phase C/D) and Partial Prerendering by default. This
	// commit caches nothing and changes no behavior: every route still
	// exporting `dynamic` was migrated off it in the same commit (redundant
	// under this flag — Next.js: "all pages are dynamic by default"), and
	// every segment not yet restructured for the framework's
	// instant-navigation validation carries `instant = false` as the
	// equivalent opt-out (requires Next >=16.3.2 — `next` was bumped from
	// 16.2.4 in this same commit for exactly this; 16.2.4 silently ignored
	// `instant` and the build failed on 14 routes, not the 10 originally
	// scoped — see docs/logs S-4 Phase B).
	cacheComponents: true,
	// AWS-MIGRATION — the container build, and ONLY the container build, asks for
	// the standalone server bundle (a self-contained `.next/standalone` tree with
	// its own minimal `node_modules`, which is what the Dockerfile copies).
	//
	// ⚠ GATED ON AN ENV VAR RATHER THAN SET UNCONDITIONALLY, deliberately. Vercel
	// runs its own builder and does not need this; turning it on everywhere would
	// change the output of every existing build — including the production one
	// serving the live experiment — to buy nothing on the platform we are still
	// on. `BUILD_TARGET=docker` is set by the Dockerfile and by nothing else, so
	// the Vercel build stays byte-identical until the day we cut over.
	...(process.env.BUILD_TARGET === "docker"
		? { output: "standalone" as const }
		: {}),
	// The 16.3.x `next dev`/`next build` auto-appends an "agentRules" block to
	// AGENTS.md on every run (generate-agent-files.js) — undesired here: this
	// repo's AGENTS.md is a hand-authored, tightly governed document (CLAUDE.md
	// §7) with its own maintenance discipline, not a file the framework should
	// silently mutate. Disabled at the same commit that bumped Next to 16.3.2
	// (S-4 Phase B), before the feature could leave a footprint.
	agentRules: false,
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
	// D1 / ADR-0024 §Decision Outcome #6: the per-hash drift check on
	// `/api/health` calls `readMigrationFiles("drizzle/migrations")`, which reads
	// the journal + every `.sql` from disk at runtime via a runtime-computed
	// path. @vercel/nft cannot trace that path, so without this the migration
	// files are absent from the route's Lambda and the detector returns "error"
	// in every deployed env. This forces them into the route's traced bundle —
	// it IMPLEMENTS ADR-0024's mandated mechanism (readMigrationFiles unchanged),
	// it does not change it.
	outputFileTracingIncludes: {
		"/api/health": ["./drizzle/migrations/**/*"],
		// EXPORT.1 — the `.md` export route reads `public/zugzwang.md` from disk at
		// request time (context.ts, runtime-computed path @vercel/nft cannot trace).
		// Force it into the route's traced bundle, mirroring the /api/health key.
		"/m/[slug]/export": ["./public/zugzwang.md"],
		// POST-IMAGE-EXPORT — the PNG export route reads its Geist TTFs from
		// disk at request time (`fonts.ts`, `process.cwd()`-rooted path). Same
		// mechanism, same reason as the two keys above.
		"/m/[slug]/export/image": [
			"./src/server/debate-export/image/fonts/*.ttf",
			// The band's Zugzwang mark (`logo.ts`), read from `public/brand/` at
			// request time for the same reason and by the same mechanism.
			"./public/brand/zugzwang-mark.svg",
		],
	},
	// WARLI-FIELD-ASSET — the auth artwork's static field, a ~680 KB SVG. A
	// `public/` file is otherwise served `max-age=0`, so every visit would
	// revalidate it. The filename carries a hash of its own content
	// (`scripts/warli-field-svg.tsx`), so a changed drawing is a NEW URL and a
	// year of `immutable` can never serve a stale one. ⚠ The pattern is pinned to
	// the hashed shape on purpose: an unhashed file under `/art/` must not
	// inherit a cache it could never be evicted from.
	async headers() {
		return [
			{
				source: "/art/:file(warli-field\\.[0-9a-f]{10}\\.svg)",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
		];
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
