import { describe, expect, it } from "vitest";

// D2 §6 tests-first (TDD RED) — the env-parity audit contract
// (ADR-0024 item 9 + 2026-06-26 errata; OD-1 scope LOCKED to (a)+(c)+(d)+(b)).
//
// Greenfield value imports from `../../scripts/ci-env-parity` WILL fail to
// resolve until the implementation module lands; that unresolved-import RED
// state is the goal (plan §6 "RED first", §10 execute ritual: @test-writer
// writes these BEFORE the implementation). The main session writes
// `scripts/ci-env-parity.ts` AFTER these tests are red.
//
// `scripts/` has no `@/` alias (tsconfig `paths` is `@/* → ./src/*` only), so
// the import is a relative path. The `import type` lines are stripped by
// esbuild and do not soften the RED — the value imports (`auditEnvParity`,
// `findingsTotal`) are what fire it.
//
// One subject per file (AGENTS.md §9 `<subject>.test.ts`): this file = the
// pure `auditEnvParity(...)` + `findingsTotal(...)` logic. No IO, no network,
// no mocking — pure function against mocked Vercel+Doppler topology fixtures.
//
// Semantics under test (plan §3 Change 3):
//   (a) orphans          — a Vercel key in a scope, absent from that scope's
//                          mapped Doppler config, and NOT in intentionalManual.
//   (c) unhealthySyncs   — every sync whose status !== "in_sync".
//   (d) duplicateSyncs   — any (config, scope) pair held by > 1 sync.
//   (b) missingRequired  — every requiredKey absent from a Doppler config.

import type {
	AuditFindings,
	AuditInput,
	EnvSync,
} from "../../scripts/ci-env-parity";
import { auditEnvParity, findingsTotal } from "../../scripts/ci-env-parity";

// The LOCKED topology (plan §3 Change 3 / Ratified OD-1):
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
// `scripts/vercel-env-audit.ts`'s INTENTIONAL_MANUAL (the reused set, plan
// §3 Change 3 (a)). These keys are pasted into Vercel by the operator and have
// no Doppler source by design — they must NEVER orphan.
const INTENTIONAL_MANUAL: ReadonlySet<string> = new Set([
	"NEXT_PUBLIC_SENTRY_DSN",
	"SENTRY_ORG",
	"SENTRY_PROJECT",
	"SENTRY_AUTH_TOKEN",
	"SENTRY_API_TOKEN",
]);

// A fully-consistent topology: every Vercel key in a scope is present in that
// scope's mapped Doppler config, every requiredKey is present in BOTH prd and
// stg, every sync is in_sync, no (config, scope) pair is duplicated, and a
// Sentry intentional-manual key (NEXT_PUBLIC_SENTRY_DSN) sits in Vercel only.
// Helper builders so each case mutates a clean copy — no cross-test bleed.
function cleanSyncs(): EnvSync[] {
	return [
		{ id: "sync_prod", config: "prd", scope: "Production", status: "in_sync" },
		{ id: "sync_prev", config: "stg", scope: "Preview", status: "in_sync" },
		{ id: "sync_stag", config: "stg", scope: "Staging", status: "in_sync" },
	];
}

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
		syncs: cleanSyncs(),
		scopeToConfig: SCOPE_TO_CONFIG,
		intentionalManual: INTENTIONAL_MANUAL,
		requiredKeys: REQUIRED_KEYS,
	};
}

describe("auditEnvParity", () => {
	describe("clean topology", () => {
		it("returns all four arrays empty", () => {
			const f = auditEnvParity(cleanInput());
			expect(f.orphans).toEqual([]);
			expect(f.unhealthySyncs).toEqual([]);
			expect(f.duplicateSyncs).toEqual([]);
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
			expect(f.unhealthySyncs).toEqual([]);
			expect(f.duplicateSyncs).toEqual([]);
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

	describe("(c) unhealthySyncs", () => {
		it("flags a sync whose status is failed", () => {
			const input = cleanInput();
			input.syncs = [
				{
					id: "sync_prod",
					config: "prd",
					scope: "Production",
					status: "failed",
				},
				{ id: "sync_prev", config: "stg", scope: "Preview", status: "in_sync" },
				{ id: "sync_stag", config: "stg", scope: "Staging", status: "in_sync" },
			];
			const f = auditEnvParity(input);
			expect(f.unhealthySyncs).toEqual([
				{
					id: "sync_prod",
					config: "prd",
					scope: "Production",
					status: "failed",
				},
			]);
			// in_sync syncs are not flagged.
			expect(f.unhealthySyncs.some((s) => s.status === "in_sync")).toBe(false);
			expect(findingsTotal(f)).toBe(1);
		});

		it("flags every non-in_sync status (out_of_sync / disabled)", () => {
			const input = cleanInput();
			input.syncs = [
				{
					id: "sync_prod",
					config: "prd",
					scope: "Production",
					status: "out_of_sync",
				},
				{
					id: "sync_prev",
					config: "stg",
					scope: "Preview",
					status: "disabled",
				},
				{ id: "sync_stag", config: "stg", scope: "Staging", status: "in_sync" },
			];
			const f = auditEnvParity(input);
			expect(f.unhealthySyncs).toHaveLength(2);
			expect(f.unhealthySyncs.map((s) => s.id).sort()).toEqual([
				"sync_prev",
				"sync_prod",
			]);
			// The two flagged statuses are exactly the non-in_sync ones.
			expect(f.unhealthySyncs.map((s) => s.status).sort()).toEqual([
				"disabled",
				"out_of_sync",
			]);
		});
	});

	describe("(d) duplicateSyncs", () => {
		it("flags a (config, scope) pair held by two syncs with count 2", () => {
			const input = cleanInput();
			input.syncs = [
				{
					id: "sync_prod",
					config: "prd",
					scope: "Production",
					status: "in_sync",
				},
				// Second sync targeting the SAME (stg, Preview) destination.
				{
					id: "sync_prev_a",
					config: "stg",
					scope: "Preview",
					status: "in_sync",
				},
				{
					id: "sync_prev_b",
					config: "stg",
					scope: "Preview",
					status: "in_sync",
				},
			];
			const f = auditEnvParity(input);
			expect(f.duplicateSyncs).toEqual([
				{ config: "stg", scope: "Preview", count: 2 },
			]);
			// The duplicate is the only finding class tripped — all in_sync, so no
			// unhealthy entries.
			expect(f.unhealthySyncs).toEqual([]);
			expect(findingsTotal(f)).toBe(1);
		});

		it("does NOT flag distinct (config, scope) pairs that share a config", () => {
			// Preview and Staging both map to stg but are DISTINCT scopes → the
			// (config, scope) grouping key differs, so no duplicate.
			const f = auditEnvParity(cleanInput());
			expect(f.duplicateSyncs).toEqual([]);
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
		it("sums the lengths of all four finding arrays", () => {
			const f: AuditFindings = {
				orphans: [{ scope: "Production", config: "prd", key: "A" }],
				unhealthySyncs: [
					{ id: "s1", config: "prd", scope: "Production", status: "failed" },
					{ id: "s2", config: "stg", scope: "Preview", status: "disabled" },
				],
				duplicateSyncs: [{ config: "stg", scope: "Preview", count: 2 }],
				missingRequired: [
					{ config: "stg", key: "R2_BUCKET_UPLOADS" },
					{ config: "prd", key: "BETTER_AUTH_URL" },
				],
			};
			// 1 + 2 + 1 + 2 = 6.
			expect(findingsTotal(f)).toBe(6);
		});
	});
});
