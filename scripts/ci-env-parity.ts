/**
 * CI Doppler↔Vercel env-parity audit (D2 / ADR-0024 item 9 + 2026-06-26 errata
 * + Patch P2 env-audit descope).
 *
 * Runs in a dedicated SCHEDULED workflow (`.github/workflows/env-audit.yml`,
 * daily + workflow_dispatch) — NOT a per-PR ci.yml step (OD-2): env drift is
 * operator-caused, not PR-caused, so it stays off the merge path. Exits
 * non-zero on ANY finding, and **fails CLOSED** on any API/parse error (a broken
 * audit must never read green).
 *
 * Detects, per the corrected topology (Doppler prd→Vercel Production, Doppler
 * stg→Vercel Preview+Staging):
 *   (a) orphans         — Vercel keys with no Doppler source (minus the Sentry
 *                         intentional-manual allow-list, and minus required keys
 *                         which are owned by (b)).
 *   (b) missingRequired — a must-exist allow-list key absent from a Doppler
 *                         config (the D1 R2_BUCKET_PFP miss class).
 *
 * DESCOPED (ADR-0024 Patch P2): sync-health (sync-not-In-Sync) + duplicate-sync
 * detection are removed. Listing Doppler↔Vercel syncs needs account-level
 * visibility via a Service Account (Doppler Team/Enterprise-only), which the
 * operator's plan does not include. Doppler reads are therefore re-sourced from
 * TWO config-scoped read-only tokens (one per config) instead of a single
 * cross-config token — no account-level access is required.
 *
 * SECRET HYGIENE (load-bearing): reads env-var KEYS only. Never requests
 * decrypted Vercel values (no `decrypt=true`) and never logs a response body —
 * only the extracted names. No secret value is read, echoed, or logged.
 *
 * tsx caveat (AGENTS.md §7): self-contained — no `@/db` → `server-only` chain.
 * The pure `auditEnvParity(...)` + `findingsTotal(...)` are exported for unit
 * tests (tests/unit/ci-env-parity.test.ts); the I/O `main()` runs only when the
 * file is invoked directly (entrypoint guard at the bottom), so importing the
 * pure functions never fires a network call.
 *
 * Operator env (GHA secrets/vars, operator-provisioned, referenced by name
 * only): VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, DOPPLER_PROJECT,
 * DOPPLER_TOKEN_STG (stg config), DOPPLER_AUDIT_TOKEN_PRD (prd config).
 */

import { pathToFileURL } from "node:url";

// ───────────────────────── pure contract (unit-tested) ─────────────────────

export interface AuditInput {
	vercelKeysByScope: Record<string, readonly string[]>;
	dopplerKeysByConfig: Record<string, readonly string[]>;
	scopeToConfig: Record<string, string>;
	intentionalManual: ReadonlySet<string>;
	requiredKeys: readonly string[];
}

export interface OrphanFinding {
	scope: string;
	config: string;
	key: string;
}
export interface MissingRequiredFinding {
	config: string;
	key: string;
}

export interface AuditFindings {
	orphans: OrphanFinding[];
	missingRequired: MissingRequiredFinding[];
}

/**
 * Pure parity check over already-fetched, normalized topology. No IO. The two
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

	const missingRequired: MissingRequiredFinding[] = [];
	for (const [config, keys] of Object.entries(input.dopplerKeysByConfig)) {
		const present = new Set(keys);
		for (const key of input.requiredKeys) {
			if (!present.has(key)) missingRequired.push({ config, key });
		}
	}

	return { orphans, missingRequired };
}

export function findingsTotal(f: AuditFindings): number {
	return f.orphans.length + f.missingRequired.length;
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

// ───────────────────────────── thin IO layer ───────────────────────────────
//
// The pure logic above is unit-tested; the loaders below map live REST shapes
// onto it. The Vercel env + Doppler secret-name shapes are stable. Doppler reads
// use TWO config-scoped read-only tokens (one per config, Patch P2) — no
// cross-config or account-level (sync) access is required.

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

// Doppler secret NAMES for one config, read with that config's own scoped token.
// The secrets response carries values; we extract Object.keys() ONLY and never
// log the body — no value leaves here.
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
}

async function main(): Promise<void> {
	try {
		const vercelToken = requireEnv("VERCEL_API_TOKEN");
		const projectId = requireEnv("VERCEL_PROJECT_ID");
		const teamId = requireEnv("VERCEL_TEAM_ID");
		const dopplerProject = requireEnv("DOPPLER_PROJECT");
		const stgToken = requireEnv("DOPPLER_TOKEN_STG");
		const prdToken = requireEnv("DOPPLER_AUDIT_TOKEN_PRD");

		const vercelKeysByScope = await loadVercelKeysByScope(
			vercelToken,
			projectId,
			teamId,
		);

		// Each config is read with its own config-scoped token (Patch P2): no
		// cross-config token, no account-level sync access.
		const dopplerKeysByConfig: Record<string, string[]> = {
			prd: await loadDopplerKeys(prdToken, dopplerProject, "prd"),
			stg: await loadDopplerKeys(stgToken, dopplerProject, "stg"),
		};

		const findings = auditEnvParity({
			vercelKeysByScope,
			dopplerKeysByConfig,
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
