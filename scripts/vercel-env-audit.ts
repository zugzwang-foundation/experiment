/**
 * Vercel env-var audit script per SCAFFOLD.8 plan §4.6 + Risk 2 mitigation.
 *
 * Operator runs at step O3.5 (before O5 Doppler sync setup) to identify which
 * Vercel env vars are Doppler-managed vs. manual. Manual vars must be deleted
 * (if obsolete) or migrated to Doppler (if load-bearing) before O5 — per Doppler
 * advisory 2026-04-21, mixing manual + integration-managed vars causes
 * sync-collision errors on the Vercel side (support article 12963214278427).
 *
 * Per memory feedback_vercel_env_writeonly, `vercel env ls` returns metadata
 * only (values are write-only post-set). This script reads metadata; no value
 * material is logged or echoed.
 *
 * Output-format probing: tries `vercel env ls <env> --json` first; falls back
 * to table parsing if JSON is unsupported in the installed CLI version. If
 * neither parser yields rows the raw output is printed for manual inspection
 * per plan §10 item 4.
 *
 * Usage:
 *   pnpm vercel-env-audit                  audit `production` + `preview` envs
 *   pnpm vercel-env-audit staging          audit a single (Custom) env post-O5
 *
 * Exit codes:
 *   0  all listed vars Doppler-managed; safe to proceed to O5
 *   1  preconditions failed (CLI missing, not authenticated, ls call errored)
 *   2  manual vars present — operator must resolve before O5
 */

import { spawnSync } from "node:child_process";

interface EnvRow {
	key: string;
	source: string;
	isDopplerManaged: boolean;
}

// SCAFFOLD.8 Phase-1 amendment (2026-05-27): Sentry env vars are
// intentionally entered into Vercel directly, NOT routed through
// Doppler. The Sentry Marketplace integration auto-provisions
// NEXT_PUBLIC_SENTRY_DSN + SENTRY_AUTH_TOKEN + SENTRY_ORG +
// SENTRY_PROJECT at build time, and the operator pastes the
// staging-project values manually into Vercel's staging Custom Env
// (per ASK 1 / plan §3.A row "NEXT_PUBLIC_SENTRY_DSN" + LD-9 split-
// project posture). Flagging them as "manual" would generate noise
// and risk the operator deleting them on autopilot. Explicit Set
// (not regex prefix) per security-auditor L5 absorption — exact
// membership avoids over-matching future SENTRY_*-prefixed non-Sentry
// vars an operator might add.
//
// 2026-06-26 amendment: the connected Sentry↔Vercel marketplace
// integration provisions three further Vercel-direct keys — the log
// drain URL, the OTLP traces URL, and the public DSN key — likewise
// with no Doppler source. Added below by EXACT name (not a prefix).
// The 8 entries are the complete Sentry env-var inventory; extend
// (here AND scripts/ci-env-parity.ts together) only when the Sentry
// integration provisions a new key.
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

function runVercel(args: string[]): {
	status: number | null;
	stdout: string;
	stderr: string;
} {
	const r = spawnSync("vercel", args, { encoding: "utf8" });
	return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function checkPreconditions(): void {
	const v = runVercel(["--version"]);
	if (v.status !== 0) {
		console.error(
			"[vercel-env-audit] vercel CLI not found. Install with: pnpm add -g vercel",
		);
		process.exit(1);
	}
	const w = runVercel(["whoami"]);
	if (w.status !== 0) {
		console.error(
			"[vercel-env-audit] vercel CLI not authenticated. Run: vercel login",
		);
		process.exit(1);
	}
}

function isDopplerSource(s: string): boolean {
	return s.toLowerCase().includes("doppler");
}

function normalizeRow(raw: unknown): EnvRow {
	if (typeof raw !== "object" || raw === null) {
		return { key: "(malformed)", source: "", isDopplerManaged: false };
	}
	const obj = raw as Record<string, unknown>;
	const key = String(obj.key ?? obj.name ?? "");
	const source = String(obj.source ?? obj.createdBy ?? obj.type ?? "");
	return { key, source, isDopplerManaged: isDopplerSource(source) };
}

function tryJsonOutput(env: string): EnvRow[] | null {
	const r = runVercel(["env", "ls", env, "--json"]);
	if (r.status !== 0 || !r.stdout.trim()) return null;
	try {
		const parsed: unknown = JSON.parse(r.stdout);
		if (!Array.isArray(parsed)) return null;
		return parsed.map(normalizeRow);
	} catch {
		return null;
	}
}

function parseTableOutput(env: string): { rows: EnvRow[]; raw: string } {
	const r = runVercel(["env", "ls", env]);
	if (r.status !== 0) {
		console.error(`[vercel-env-audit] \`vercel env ls ${env}\` failed:`);
		if (r.stderr) console.error(r.stderr);
		if (r.stdout) console.error(r.stdout);
		process.exit(1);
	}
	const rows: EnvRow[] = [];
	for (const line of r.stdout.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith(">") || trimmed.startsWith("?")) continue;
		if (/^(name|variable)\s/i.test(trimmed)) continue;
		const cols = trimmed.split(/\s{2,}/);
		const key = cols[0] ?? "";
		if (!/^[A-Z_][A-Z_0-9]*$/.test(key)) continue;
		const source = cols.slice(1).join(" | ");
		rows.push({ key, source, isDopplerManaged: isDopplerSource(source) });
	}
	return { rows, raw: r.stdout };
}

function auditEnv(env: string): EnvRow[] {
	const json = tryJsonOutput(env);
	if (json) return json;
	const table = parseTableOutput(env);
	if (table.rows.length === 0) {
		console.warn(
			`[vercel-env-audit] could not parse \`vercel env ls ${env}\` output. Raw:`,
		);
		console.warn(table.raw);
	}
	return table.rows;
}

function main(): void {
	checkPreconditions();

	const cliEnv = process.argv[2];
	const envs = cliEnv ? [cliEnv] : ["production", "preview"];

	console.log("# Vercel env-var audit (SCAFFOLD.8 O3.5)\n");

	let totalActionable = 0;
	for (const env of envs) {
		const rows = auditEnv(env);
		const managed = rows.filter((row) => row.isDopplerManaged);
		const nonManaged = rows.filter((row) => !row.isDopplerManaged);
		const intentional = nonManaged.filter((row) =>
			INTENTIONAL_MANUAL.has(row.key),
		);
		const actionable = nonManaged.filter(
			(row) => !INTENTIONAL_MANUAL.has(row.key),
		);
		totalActionable += actionable.length;

		console.log(`## ${env}`);
		console.log(
			`Total: ${rows.length} | Doppler-managed: ${managed.length} | Intentional-manual (Sentry): ${intentional.length} | Actionable manual: ${actionable.length}\n`,
		);
		if (intentional.length > 0) {
			console.log(
				"Intentional-manual env vars (Sentry — Vercel-direct by design; do NOT migrate):",
			);
			for (const row of intentional) {
				console.log(`  - ${row.key}   [source: ${row.source || "(unknown)"}]`);
			}
			console.log();
		}
		if (actionable.length > 0) {
			console.log(
				"Actionable manual env vars (operator decision — DELETE if obsolete, MIGRATE to Doppler if load-bearing):",
			);
			for (const row of actionable) {
				console.log(`  - ${row.key}   [source: ${row.source || "(unknown)"}]`);
			}
			console.log();
		}
	}

	if (totalActionable > 0) {
		console.log(
			`[NEXT] Resolve ${totalActionable} actionable manual var(s) above before O5 (Doppler sync setup).`,
		);
		process.exit(2);
	}
	console.log(
		"[OK] All non-Sentry Vercel env vars are Doppler-managed. Proceed to O5.",
	);
}

main();
