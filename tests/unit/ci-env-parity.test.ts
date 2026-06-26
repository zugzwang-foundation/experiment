import { describe, expect, it } from "vitest";

// D2 env-parity audit contract — DESCOPED to (a) orphans + (b) missingRequired
// (ADR-0024 item 9 + 2026-06-26 errata + Patch P2). Sync-health (c) +
// duplicate-sync (d) were removed: listing Doppler↔Vercel syncs needs an
// account-level Service Account (Doppler Team/Enterprise-only) the operator's
// plan lacks. Doppler reads now use two config-scoped tokens; the pure
// `auditEnvParity(...)` no longer takes a `syncs` input.
//
// `scripts/` has no `@/` alias (tsconfig `paths` is `@/* → ./src/*` only), so
// the import is a relative path. One subject per file (AGENTS.md §9): the pure
// `auditEnvParity(...)` + `findingsTotal(...)`. No IO, no network, no mocking.
//
// Semantics under test (plan §3 Change 3, descoped):
//   (a) orphans          — a Vercel key in a scope, absent from that scope's
//                          mapped Doppler config, NOT in intentionalManual, and
//                          NOT a required key (owned by (b)).
//   (b) missingRequired  — every requiredKey absent from a Doppler config.

import type { AuditFindings, AuditInput } from "../../scripts/ci-env-parity";
import { auditEnvParity, findingsTotal } from "../../scripts/ci-env-parity";

// The corrected topology (plan §3 Change 3 / Ratified OD-1):
//   scopes  Production / Preview / Staging  →  configs prd / stg / stg.
const SCOPE_TO_CONFIG: Record<string, string> = {
	Production: "prd",
	Preview: "stg",
	Staging: "stg",
};

// The small fixed must-exist allow-list (OD-1(b)); R2_BUCKET_UPLOADS read from
// `src/server/storage/r2.ts:45`, not guessed.
const REQUIRED_KEYS = [
	"DATABASE_URL",
	"BETTER_AUTH_URL",
	"R2_BUCKET_PFP",
	"R2_BUCKET_UPLOADS",
] as const;

// The Sentry intentional-manual allow-list, mirrored verbatim from
// `scripts/vercel-env-audit.ts`'s INTENTIONAL_MANUAL (the reused set). These keys
// are pasted into Vercel by the operator / auto-provisioned by the Sentry↔Vercel
// marketplace integration, and have no Doppler source by design — they must NEVER
// orphan. Extend in lockstep with the two scripts when the integration adds a key.
const INTENTIONAL_MANUAL: ReadonlySet<string> = new Set([
	"NEXT_PUBLIC_SENTRY_DSN",
	"SENTRY_ORG",
	"SENTRY_PROJECT",
	"SENTRY_AUTH_TOKEN",
	"SENTRY_API_TOKEN",
	// Sentry↔Vercel marketplace-integration-provisioned (log drain / OTLP
	// traces / public DSN) — no Doppler source by design (2026-06-26).
	"SENTRY_VERCEL_LOG_DRAIN_URL",
	"SENTRY_OTLP_TRACES_URL",
	"SENTRY_PUBLIC_KEY",
]);

// A fully-consistent topology: every Vercel key in a scope is present in that
// scope's mapped Doppler config, every requiredKey is present in BOTH prd and
// stg, and a Sentry intentional-manual key (NEXT_PUBLIC_SENTRY_DSN) sits in
// Vercel only. Helper builder so each case mutates a clean copy — no bleed.
function cleanInput(): AuditInput {
	return {
		vercelKeysByScope: {
			Production: [
				"DATABASE_URL",
				"BETTER_AUTH_URL",
				"R2_BUCKET_PFP",
				"R2_BUCKET_UPLOADS",
				// Sentry key — Vercel-only by design; must NOT orphan.
				"NEXT_PUBLIC_SENTRY_DSN",
			],
			Preview: [
				"DATABASE_URL",
				"BETTER_AUTH_URL",
				"R2_BUCKET_PFP",
				"R2_BUCKET_UPLOADS",
			],
			Staging: [
				"DATABASE_URL",
				"BETTER_AUTH_URL",
				"R2_BUCKET_PFP",
				"R2_BUCKET_UPLOADS",
			],
		},
		dopplerKeysByConfig: {
			prd: [
				"DATABASE_URL",
				"BETTER_AUTH_URL",
				"R2_BUCKET_PFP",
				"R2_BUCKET_UPLOADS",
			],
			stg: [
				"DATABASE_URL",
				"BETTER_AUTH_URL",
				"R2_BUCKET_PFP",
				"R2_BUCKET_UPLOADS",
			],
		},
		scopeToConfig: SCOPE_TO_CONFIG,
		intentionalManual: INTENTIONAL_MANUAL,
		requiredKeys: REQUIRED_KEYS,
	};
}

describe("auditEnvParity", () => {
	describe("clean topology", () => {
		it("returns both finding arrays empty", () => {
			const f = auditEnvParity(cleanInput());
			expect(f.orphans).toEqual([]);
			expect(f.missingRequired).toEqual([]);
		});

		it("findingsTotal === 0 on a clean topology", () => {
			expect(findingsTotal(auditEnvParity(cleanInput()))).toBe(0);
		});

		it("does NOT orphan a Sentry intentional-manual key present in Vercel only", () => {
			const f = auditEnvParity(cleanInput());
			expect(f.orphans.some((o) => o.key === "NEXT_PUBLIC_SENTRY_DSN")).toBe(
				false,
			);
		});
	});

	describe("(a) orphans", () => {
		it("flags exactly the Vercel key absent from its mapped Doppler config", () => {
			const input = cleanInput();
			// A non-Sentry Vercel key in Production with no prd Doppler source.
			input.vercelKeysByScope = {
				...input.vercelKeysByScope,
				Production: [...input.vercelKeysByScope.Production, "ORPHAN_KEY"],
			};
			const f = auditEnvParity(input);
			expect(f.orphans).toEqual([
				{ scope: "Production", config: "prd", key: "ORPHAN_KEY" },
			]);
			// The orphan is the ONLY finding — nothing else trips.
			expect(f.missingRequired).toEqual([]);
			expect(findingsTotal(f)).toBe(1);
		});

		it("does NOT flag a Vercel-only key when it is in intentionalManual", () => {
			const input = cleanInput();
			// Same shape as the orphan case, but the extra key IS intentional-manual
			// (a Sentry key in the Preview scope) → must be exempt.
			input.vercelKeysByScope = {
				...input.vercelKeysByScope,
				Preview: [...input.vercelKeysByScope.Preview, "SENTRY_AUTH_TOKEN"],
			};
			const f = auditEnvParity(input);
			expect(f.orphans).toEqual([]);
			expect(findingsTotal(f)).toBe(0);
		});

		it("does NOT flag the 3 Sentry↔Vercel integration keys (log-drain / OTLP / public DSN) present in Vercel with no Doppler source", () => {
			const input = cleanInput();
			// The exact 2026-06-26 incident: the marketplace-integration keys land
			// in BOTH Production and Preview (Vercel-direct, no Doppler source) — each
			// must be exempt in both scopes, never orphaned. (Regression guard.)
			const integrationKeys = [
				"SENTRY_VERCEL_LOG_DRAIN_URL",
				"SENTRY_OTLP_TRACES_URL",
				"SENTRY_PUBLIC_KEY",
			];
			input.vercelKeysByScope = {
				...input.vercelKeysByScope,
				Production: [...input.vercelKeysByScope.Production, ...integrationKeys],
				Preview: [...input.vercelKeysByScope.Preview, ...integrationKeys],
			};
			const f = auditEnvParity(input);
			expect(f.orphans).toEqual([]);
			expect(findingsTotal(f)).toBe(0);
		});

		it("maps Preview and Staging scopes both to the stg config", () => {
			const input = cleanInput();
			// A non-Sentry key only in the Staging scope, absent from stg Doppler →
			// orphan attributed to config "stg" (the Staging→stg mapping).
			input.vercelKeysByScope = {
				...input.vercelKeysByScope,
				Staging: [...input.vercelKeysByScope.Staging, "STAGING_ONLY_KEY"],
			};
			const f = auditEnvParity(input);
			expect(f.orphans).toEqual([
				{ scope: "Staging", config: "stg", key: "STAGING_ONLY_KEY" },
			]);
		});
	});

	describe("(b) missingRequired", () => {
		it("flags a required key dropped from one config", () => {
			const input = cleanInput();
			// Drop R2_BUCKET_UPLOADS from the stg config only.
			input.dopplerKeysByConfig = {
				...input.dopplerKeysByConfig,
				stg: ["DATABASE_URL", "BETTER_AUTH_URL", "R2_BUCKET_PFP"],
			};
			const f = auditEnvParity(input);
			expect(f.missingRequired).toEqual([
				{ config: "stg", key: "R2_BUCKET_UPLOADS" },
			]);
			expect(findingsTotal(f)).toBe(1);
		});

		it("emits no missingRequired when every allow-list key is present in both configs", () => {
			const f = auditEnvParity(cleanInput());
			expect(f.missingRequired).toEqual([]);
		});
	});

	describe("findingsTotal", () => {
		it("sums the lengths of both finding arrays", () => {
			const f: AuditFindings = {
				orphans: [{ scope: "Production", config: "prd", key: "A" }],
				missingRequired: [
					{ config: "stg", key: "R2_BUCKET_UPLOADS" },
					{ config: "prd", key: "BETTER_AUTH_URL" },
				],
			};
			// 1 + 2 = 3.
			expect(findingsTotal(f)).toBe(3);
		});
	});
});
