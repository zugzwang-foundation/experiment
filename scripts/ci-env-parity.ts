/**
 * CI Doppler↔Vercel env-parity audit (D2 / ADR-0024 item 9 + 2026-06-26 errata).
 *
 * Runs in a dedicated SCHEDULED workflow (`.github/workflows/env-audit.yml`,
 * daily + workflow_dispatch) — NOT a per-PR ci.yml step (OD-2 LOCKED): env drift
 * is operator-caused, not PR-caused, so it stays off the merge path. Exits
 * non-zero on ANY finding, and **fails CLOSED** on any API/parse error (a broken
 * audit must never read green).
 *
 * Detects, per the corrected topology (Doppler stg→Vercel Preview+Staging,
 * Doppler prd→Vercel Production):
 *   (a) orphans         — Vercel keys with no Doppler source (minus the Sentry
 *                         intentional-manual allow-list).
 *   (b) missingRequired — a must-exist allow-list key absent from a Doppler
 *                         config (the D1 R2_BUCKET_PFP miss class).
 *   (c) unhealthySyncs  — any Doppler→Vercel sync not in_sync.
 *   (d) duplicateSyncs  — two syncs targeting the same (config, scope).
 *
 * SECRET HYGIENE (the load-bearing discipline — mirrors vercel-env-audit.ts):
 * this script reads env-var KEYS / sync METADATA only. It never requests
 * decrypted Vercel values (no `decrypt=true`) and never logs a response body —
 * only the extracted names/statuses. No secret value is read, echoed, or logged.
 *
 * tsx caveat (AGENTS.md §7): self-contained — no `@/db` → `server-only` chain.
 * The pure `auditEnvParity(...)` + `findingsTotal(...)` are exported for unit
 * tests (tests/unit/ci-env-parity.test.ts); the I/O `main()` runs only when the
 * file is invoked directly (entrypoint guard at the bottom), so importing the
 * pure functions never fires a network call.
 *
 * Operator env (GHA secrets/vars, OD-4 — operator-provisioned, referenced by
 * name only): VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID,
 * DOPPLER_AUDIT_TOKEN, DOPPLER_PROJECT.
 */

import { pathToFileURL } from "node:url";

// ───────────────────────── pure contract (unit-tested) ─────────────────────

export type SyncStatus =
	| "in_sync"
	| "out_of_sync"
	| "failed"
	| "disabled"
	| "unknown";

export interface EnvSync {
	id: string;
	config: string; // Doppler config: "prd" | "stg"
	scope: string; // Vercel scope: "Production" | "Preview" | "Staging"
	status: SyncStatus;
}

export interface AuditInput {
	vercelKeysByScope: Record<string, readonly string[]>;
	dopplerKeysByConfig: Record<string, readonly string[]>;
	syncs: readonly EnvSync[];
	scopeToConfig: Record<string, string>;
	intentionalManual: ReadonlySet<string>;
	requiredKeys: readonly string[];
}

export interface OrphanFinding {
	scope: string;
	config: string;
	key: string;
}
export interface UnhealthySyncFinding {
	id: string;
	config: string;
	scope: string;
	status: SyncStatus;
}
export interface DuplicateSyncFinding {
	config: string;
	scope: string;
	count: number;
}
export interface MissingRequiredFinding {
	config: string;
	key: string;
}

export interface AuditFindings {
	orphans: OrphanFinding[];
	unhealthySyncs: UnhealthySyncFinding[];
	duplicateSyncs: DuplicateSyncFinding[];
	missingRequired: MissingRequiredFinding[];
}

/**
 * Pure parity check over already-fetched, normalized topology. No IO. The four
 * finding classes are independent; an empty union (findingsTotal === 0) is a
 * clean topology.
 */
export function auditEnvParity(input: AuditInput): AuditFindings {
	// Required keys are owned by the (b) missingRequired check; excluding them
	// here keeps a Doppler-missing-required-key from double-counting as both an
	// orphan and a missing finding. Orphans = UNEXPECTED Vercel keys only.
	const required = new Set(input.requiredKeys);
	const orphans: OrphanFinding[] = [];
	for (const [scope, keys] of Object.entries(input.vercelKeysByScope)) {
		const config = input.scopeToConfig[scope];
		if (config === undefined) continue; // scope with no mapped config — skip
		const source = new Set(input.dopplerKeysByConfig[config] ?? []);
		for (const key of keys) {
			if (input.intentionalManual.has(key)) continue; // Sentry-direct by design
			if (required.has(key)) continue; // owned by (b) missingRequired
			if (!source.has(key)) orphans.push({ scope, config, key });
		}
	}

	const unhealthySyncs: UnhealthySyncFinding[] = input.syncs
		.filter((s) => s.status !== "in_sync")
		.map((s) => ({
			id: s.id,
			config: s.config,
			scope: s.scope,
			status: s.status,
		}));

	const groups = new Map<string, DuplicateSyncFinding>();
	for (const s of input.syncs) {
		const groupKey = JSON.stringify([s.config, s.scope]);
		const existing = groups.get(groupKey);
		if (existing) existing.count += 1;
		else groups.set(groupKey, { config: s.config, scope: s.scope, count: 1 });
	}
	const duplicateSyncs: DuplicateSyncFinding[] = [...groups.values()].filter(
		(g) => g.count > 1,
	);

	const missingRequired: MissingRequiredFinding[] = [];
	for (const [config, keys] of Object.entries(input.dopplerKeysByConfig)) {
		const present = new Set(keys);
		for (const key of input.requiredKeys) {
			if (!present.has(key)) missingRequired.push({ config, key });
		}
	}

	return { orphans, unhealthySyncs, duplicateSyncs, missingRequired };
}

export function findingsTotal(f: AuditFindings): number {
	return (
		f.orphans.length +
		f.unhealthySyncs.length +
		f.duplicateSyncs.length +
		f.missingRequired.length
	);
}

// ───────────────────────────── locked topology ─────────────────────────────

// Vercel scope → Doppler config (the corrected topology, ADR-0024 errata).
const SCOPE_TO_CONFIG: Record<string, string> = {
	Production: "prd",
	Preview: "stg",
	Staging: "stg",
};

// OD-1(b): a small must-exist allow-list (NOT a full manifest). R2_BUCKET_UPLOADS
// read from src/server/storage/r2.ts:45 (PFP counterpart at :56), not guessed.
const REQUIRED_KEYS: readonly string[] = [
	"DATABASE_URL",
	"BETTER_AUTH_URL",
	"R2_BUCKET_PFP",
	"R2_BUCKET_UPLOADS",
];

// Sentry keys entered into Vercel directly by design (no Doppler source) — must
// never orphan. Mirrors scripts/vercel-env-audit.ts INTENTIONAL_MANUAL (the
// canonical inventory; extend there and here together when a Sentry key joins).
const INTENTIONAL_MANUAL: ReadonlySet<string> = new Set([
	"NEXT_PUBLIC_SENTRY_DSN",
	"SENTRY_ORG",
	"SENTRY_PROJECT",
	"SENTRY_AUTH_TOKEN",
	"SENTRY_API_TOKEN",
]);

const DOPPLER_CONFIGS: readonly string[] = ["prd", "stg"];

// ───────────────────────────── thin IO layer ───────────────────────────────
//
// The pure logic above is unit-tested; the normalizers below map live REST
// shapes onto it. The Vercel env + Doppler secret-name shapes are stable; the
// Doppler *sync* shape (deriveScope/deriveStatus) is operator-validated on the
// first `workflow_dispatch` run (plan §6 operational row) and is fail-closed —
// an unparseable sync resolves to status "unknown" (flagged), never in_sync.

const VERCEL_API = "https://api.vercel.com";
const DOPPLER_API = "https://api.doppler.com";

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		console.error(`[ci-env-parity] missing required env: ${name}`);
		process.exit(1);
	}
	return v;
}

function asRecord(v: unknown): Record<string, unknown> | null {
	return typeof v === "object" && v !== null
		? (v as Record<string, unknown>)
		: null;
}
function asArray(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

async function vercelGet(
	path: string,
	token: string,
	teamId: string,
): Promise<unknown> {
	const sep = path.includes("?") ? "&" : "?";
	const url = `${VERCEL_API}${path}${sep}teamId=${encodeURIComponent(teamId)}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`Vercel API ${path} → HTTP ${res.status}`);
	return res.json();
}

async function dopplerGet(
	path: string,
	query: string,
	token: string,
): Promise<unknown> {
	const res = await fetch(`${DOPPLER_API}${path}?${query}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});
	// Echo the path only (not the query) on error — no value material either way.
	if (!res.ok) throw new Error(`Doppler API ${path} → HTTP ${res.status}`);
	return res.json();
}

// Resolve the "Staging" custom-environment id so its env vars map to scope
// "Staging". Returns null if no custom env slugged "staging" exists.
async function fetchStagingEnvId(
	token: string,
	projectId: string,
	teamId: string,
): Promise<string | null> {
	const body = await vercelGet(
		`/v9/projects/${projectId}/custom-environments`,
		token,
		teamId,
	);
	const rec = asRecord(body);
	const envs = Array.isArray(body) ? body : asArray(rec?.environments);
	for (const e of envs) {
		const er = asRecord(e);
		if (er && asString(er.slug).toLowerCase() === "staging") {
			return asString(er.id);
		}
	}
	return null;
}

// Vercel env KEYS grouped by scope. Values are never requested or read — only
// `key`, `target`, and `customEnvironmentIds`.
async function loadVercelKeysByScope(
	token: string,
	projectId: string,
	teamId: string,
): Promise<Record<string, string[]>> {
	const stagingEnvId = await fetchStagingEnvId(token, projectId, teamId);
	const body = await vercelGet(`/v9/projects/${projectId}/env`, token, teamId);
	const rec = asRecord(body);
	const envs = asArray(rec?.envs);

	const production = new Set<string>();
	const preview = new Set<string>();
	const staging = new Set<string>();
	for (const e of envs) {
		const er = asRecord(e);
		if (!er) continue;
		const key = asString(er.key);
		if (!key) continue;
		const targets = asArray(er.target).map(asString);
		if (targets.includes("production")) production.add(key);
		if (targets.includes("preview")) preview.add(key);
		const customIds = asArray(er.customEnvironmentIds).map(asString);
		if (stagingEnvId && customIds.includes(stagingEnvId)) staging.add(key);
	}
	return {
		Production: [...production],
		Preview: [...preview],
		Staging: [...staging],
	};
}

// Doppler secret NAMES for one config. The secrets response carries values; we
// extract Object.keys() ONLY and never log the body — no value leaves here.
async function loadDopplerKeys(
	token: string,
	project: string,
	config: string,
): Promise<string[]> {
	const query = `project=${encodeURIComponent(project)}&config=${encodeURIComponent(config)}`;
	const body = await dopplerGet("/v3/configs/config/secrets", query, token);
	const secrets = asRecord(asRecord(body)?.secrets);
	return secrets ? Object.keys(secrets) : [];
}

function deriveSyncScope(r: Record<string, unknown>): string {
	// Probe the documented-ish Vercel-target fields; normalize to a scope name.
	// Fallback "unknown" is stable (not per-id) so genuine duplicates still
	// collapse; an unparseable target is itself a smell worth surfacing.
	const options = asRecord(r.options) ?? asRecord(r.payload) ?? {};
	const raw = (
		asString(r.environment) ||
		asString(options.environment) ||
		asString(options.target) ||
		asString(options.vercelEnvironment)
	).toLowerCase();
	if (raw.includes("production")) return "Production";
	if (raw.includes("preview")) return "Preview";
	if (raw.includes("staging") || raw.includes("custom")) return "Staging";
	return "unknown";
}

function deriveSyncStatus(r: Record<string, unknown>): SyncStatus {
	if (r.enabled === false) return "disabled";
	const lastSync = asRecord(r.last_sync) ?? asRecord(r.lastSync);
	if (asString(r.error) || asString(lastSync?.error)) return "failed";
	if (asString(r.last_synced_at) || asString(r.lastSyncedAt)) return "in_sync";
	return "unknown"; // never synced / unparseable → fail-closed
}

async function loadDopplerSyncs(
	token: string,
	project: string,
	config: string,
): Promise<EnvSync[]> {
	const query = `project=${encodeURIComponent(project)}&config=${encodeURIComponent(config)}`;
	const body = await dopplerGet("/v3/configs/config/syncs", query, token);
	const syncs = asArray(asRecord(body)?.syncs);
	return syncs.map((raw) => {
		const r = asRecord(raw) ?? {};
		const id = asString(r.slug) || asString(r.id) || "(unknown)";
		return {
			id,
			config,
			scope: deriveSyncScope(r),
			status: deriveSyncStatus(r),
		};
	});
}

function report(f: AuditFindings): void {
	console.log("# Doppler↔Vercel env-parity audit\n");
	if (f.orphans.length) {
		console.log(
			`Orphan Vercel vars (no Doppler source) — ${f.orphans.length}:`,
		);
		for (const o of f.orphans) {
			console.log(
				`  - ${o.scope} / ${o.key}  (expected in Doppler ${o.config})`,
			);
		}
	}
	if (f.missingRequired.length) {
		console.log(`Missing required keys — ${f.missingRequired.length}:`);
		for (const m of f.missingRequired) {
			console.log(`  - ${m.key}  (absent from Doppler ${m.config})`);
		}
	}
	if (f.unhealthySyncs.length) {
		console.log(`Unhealthy syncs — ${f.unhealthySyncs.length}:`);
		for (const s of f.unhealthySyncs) {
			console.log(`  - ${s.config} → ${s.scope}  [${s.status}]  (${s.id})`);
		}
	}
	if (f.duplicateSyncs.length) {
		console.log(`Duplicate syncs — ${f.duplicateSyncs.length}:`);
		for (const d of f.duplicateSyncs) {
			console.log(`  - ${d.config} → ${d.scope}  (${d.count} syncs)`);
		}
	}
}

async function main(): Promise<void> {
	try {
		const vercelToken = requireEnv("VERCEL_API_TOKEN");
		const projectId = requireEnv("VERCEL_PROJECT_ID");
		const teamId = requireEnv("VERCEL_TEAM_ID");
		const dopplerToken = requireEnv("DOPPLER_AUDIT_TOKEN");
		const dopplerProject = requireEnv("DOPPLER_PROJECT");

		const vercelKeysByScope = await loadVercelKeysByScope(
			vercelToken,
			projectId,
			teamId,
		);

		const dopplerKeysByConfig: Record<string, string[]> = {};
		const syncs: EnvSync[] = [];
		for (const config of DOPPLER_CONFIGS) {
			dopplerKeysByConfig[config] = await loadDopplerKeys(
				dopplerToken,
				dopplerProject,
				config,
			);
			syncs.push(
				...(await loadDopplerSyncs(dopplerToken, dopplerProject, config)),
			);
		}

		const findings = auditEnvParity({
			vercelKeysByScope,
			dopplerKeysByConfig,
			syncs,
			scopeToConfig: SCOPE_TO_CONFIG,
			intentionalManual: INTENTIONAL_MANUAL,
			requiredKeys: REQUIRED_KEYS,
		});
		report(findings);

		const total = findingsTotal(findings);
		if (total > 0) {
			console.error(`[ci-env-parity] FAIL — ${total} finding(s) above.`);
			process.exit(1);
		}
		console.log("[ci-env-parity] OK — Doppler↔Vercel env parity clean.");
		process.exit(0);
	} catch (err) {
		// Fail CLOSED: any API/parse error is an audit failure, never a pass.
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[ci-env-parity] ERROR (fail-closed): ${msg}`);
		process.exit(1);
	}
}

// Only execute main() when invoked as CLI (not when imported by tests).
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	void main();
}
