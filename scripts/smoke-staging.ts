/**
 * Staging deploy smoke test per SCAFFOLD.8 plan §4.4 / LD-5 (10 items) +
 * OQ-13 (item 11 R2 token scope).
 *
 * Operator usage:
 *   doppler run --config staging -- pnpm smoke:staging
 *   PREVIEW_URL=https://<deploy>.vercel.app doppler run --config staging -- pnpm smoke:staging
 *
 * Items:
 *   1. DNS resolves (dig)
 *   2. HTTPS works (HEAD /)
 *   3. App loads (GET /)
 *   4. Staging /api/health DB connects (db: "ok")
 *   5. Staging /api/health env + canary echo ("staging" + "staging-...")
 *   6. Preview /api/health env + canary (skipped if PREVIEW_URL not set)
 *   7. Drizzle migrations applied to staging DB (count parity with journal)
 *   8. identity_pool seeded (~200 rows)
 *   9. Sentry routing (staging Sentry HAS the labeled error;
 *      prod Sentry does NOT)
 *  10. (folded into item 7 per LD-5 — journal-count parity)
 *  11. R2 token scope (shells out to `pnpm verify:r2-scope`)
 *
 * Items 1–3 retry once after a 60s sleep to tolerate DNS propagation +
 * Vercel cold-start per brief §5.
 *
 * Exit 0 only when every executed item passes. Skipped items (e.g.
 * `health-preview` without PREVIEW_URL) do not count toward failure.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const STAGING_URL = "https://staging.zugzwangworld.com";
const PREVIEW_URL = process.env.PREVIEW_URL;
const SENTRY_API_TOKEN = process.env.SENTRY_API_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const DATABASE_URL_STAGING = process.env.DATABASE_URL_STAGING;
const STAGING_PROJECT_REF_FRAGMENT = process.env.STAGING_PROJECT_REF_FRAGMENT;

const SENTRY_API_BASE = "https://sentry.io/api/0";
const STAGING_SENTRY_PROJECT = "zugzwang-staging";
const PROD_SENTRY_PROJECT = "zugzwang-prod";

type Result = { item: string; pass: boolean; detail: string; skipped?: true };
const results: Result[] = [];

async function check(
	item: string,
	fn: () => Promise<string>,
): Promise<boolean> {
	try {
		const detail = await fn();
		console.log(`[PASS] ${item}: ${detail}`);
		results.push({ item, pass: true, detail });
		return true;
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		console.error(`[FAIL] ${item}: ${detail}`);
		results.push({ item, pass: false, detail });
		return false;
	}
}

async function checkWithRetry(
	item: string,
	fn: () => Promise<string>,
): Promise<boolean> {
	const ok = await check(item, fn);
	if (ok) return true;
	console.log(`[RETRY] ${item}: sleeping 60s then retrying once...`);
	// Replace the failure with the retry attempt so the final results carry
	// the eventual verdict (matches the spirit of "tolerate cold start").
	results.pop();
	await new Promise((r) => setTimeout(r, 60_000));
	return check(item, fn);
}

function skip(item: string, reason: string): void {
	console.warn(`[SKIP] ${item}: ${reason}`);
	results.push({ item, pass: true, detail: reason, skipped: true });
}

function countJournalEntries(): number {
	const journalPath = join(
		process.cwd(),
		"drizzle",
		"migrations",
		"meta",
		"_journal.json",
	);
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
		entries?: Array<{ tag: string }>;
	};
	return journal.entries?.length ?? 0;
}

async function queryStagingScalar<T>(query: string): Promise<T> {
	if (!DATABASE_URL_STAGING || !STAGING_PROJECT_REF_FRAGMENT) {
		throw new Error(
			"DATABASE_URL_STAGING / STAGING_PROJECT_REF_FRAGMENT not set",
		);
	}
	if (!DATABASE_URL_STAGING.includes(STAGING_PROJECT_REF_FRAGMENT)) {
		throw new Error(
			`DATABASE_URL_STAGING does not contain "${STAGING_PROJECT_REF_FRAGMENT}"; refusing to query`,
		);
	}
	const sql = postgres(DATABASE_URL_STAGING, { max: 1 });
	try {
		const rows = (await sql.unsafe(query)) as Array<Record<string, unknown>>;
		const first = rows[0];
		if (!first) throw new Error("query returned 0 rows");
		const value = Object.values(first)[0];
		return value as T;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

interface SentryEvent {
	id?: string;
	title?: string;
	message?: string;
	"event.type"?: string;
}

async function fetchSentryEvents(
	projectSlug: string,
	apiToken: string,
	org: string,
): Promise<SentryEvent[]> {
	const url = `${SENTRY_API_BASE}/projects/${org}/${projectSlug}/events/?statsPeriod=10m`;
	const r = await fetch(url, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!r.ok) {
		throw new Error(`Sentry API ${projectSlug} → HTTP ${r.status}`);
	}
	return (await r.json()) as SentryEvent[];
}

// === Items 1–3: DNS / HTTPS / GET / =========================================

async function main(): Promise<void> {
	await checkWithRetry("dns", async () => {
		const out = execSync("dig +short staging.zugzwangworld.com")
			.toString()
			.trim();
		if (!out) throw new Error("NXDOMAIN — DNS not propagated");
		return out.replace(/\n/g, " ");
	});

	await checkWithRetry("https", async () => {
		const r = await fetch(STAGING_URL, { method: "HEAD" });
		// 200 is the happy path; 401 acceptable if Deployment Protection is on.
		if (r.status !== 200 && r.status !== 401) {
			throw new Error(`status ${r.status}`);
		}
		return `status ${r.status}`;
	});

	await checkWithRetry("app-loads", async () => {
		const r = await fetch(STAGING_URL);
		if (r.status !== 200 && r.status !== 401) {
			throw new Error(`status ${r.status}`);
		}
		return `status ${r.status}`;
	});

	// === Items 4 + 5: staging /api/health ====================================

	await check("health-staging", async () => {
		const r = await fetch(`${STAGING_URL}/api/health`);
		if (!r.ok) throw new Error(`status ${r.status}`);
		const body = (await r.json()) as {
			env?: string;
			canary?: string;
			db?: string;
		};
		if (body.env !== "staging") {
			throw new Error(`env=${body.env}, expected "staging"`);
		}
		if (!body.canary?.startsWith("staging-")) {
			throw new Error(`canary="${body.canary}" must start with "staging-"`);
		}
		if (body.db !== "ok") throw new Error(`db=${body.db}`);
		return `env=${body.env}, canary=${body.canary}, db=${body.db}`;
	});

	// === Item 6: preview /api/health (optional) ==============================

	if (PREVIEW_URL) {
		await check("health-preview", async () => {
			const r = await fetch(`${PREVIEW_URL}/api/health`);
			if (!r.ok) throw new Error(`status ${r.status}`);
			const body = (await r.json()) as { env?: string; canary?: string };
			if (body.env !== "preview") {
				throw new Error(`env=${body.env}, expected "preview"`);
			}
			if (!body.canary?.startsWith("preview-")) {
				throw new Error(`canary="${body.canary}" must start with "preview-"`);
			}
			return `env=${body.env}, canary=${body.canary}`;
		});
	} else {
		skip("health-preview", "PREVIEW_URL not set");
	}

	// === Items 7 + 10: migrations + journal parity ===========================

	await check("migrations-applied", async () => {
		const expected = countJournalEntries();
		const actual = await queryStagingScalar<number>(
			"SELECT COUNT(*)::int FROM drizzle.__drizzle_migrations",
		);
		if (actual !== expected) {
			throw new Error(`expected ${expected}, got ${actual}`);
		}
		return `${actual} migrations (matches drizzle/migrations/meta/_journal.json)`;
	});

	// === Item 8: identity_pool seeded ========================================

	await check("identity-pool-seeded", async () => {
		const count = await queryStagingScalar<number>(
			"SELECT COUNT(*)::int FROM identity_pool",
		);
		if (count < 100 || count > 300) {
			throw new Error(`count=${count}, expected ~200`);
		}
		return `${count} pool rows`;
	});

	// === Item 9: Sentry routing ==============================================

	if (!SENTRY_API_TOKEN || !SENTRY_ORG) {
		skip(
			"sentry-routing",
			"SENTRY_API_TOKEN / SENTRY_ORG not set in smoke env",
		);
	} else {
		await check("sentry-routing", async () => {
			// Trigger the labeled error from /api/_smoke-error.
			const triggerStart = Date.now();
			await fetch(`${STAGING_URL}/api/_smoke-error`).catch(() => {
				/* server-throw maps to 500; suppress */
			});
			// Allow ~30s for Sentry ingestion + indexing.
			await new Promise((r) => setTimeout(r, 30_000));
			const [stagingEvents, prodEvents] = await Promise.all([
				fetchSentryEvents(STAGING_SENTRY_PROJECT, SENTRY_API_TOKEN, SENTRY_ORG),
				fetchSentryEvents(PROD_SENTRY_PROJECT, SENTRY_API_TOKEN, SENTRY_ORG),
			]);
			const matches = (e: SentryEvent): boolean => {
				const fields = [e.title, e.message].filter(
					(x): x is string => typeof x === "string",
				);
				return fields.some((s) => s.includes("[smoke-error]"));
			};
			const inStaging = stagingEvents.some(matches);
			const inProd = prodEvents.some(matches);
			if (!inStaging) {
				throw new Error(
					`error not present in ${STAGING_SENTRY_PROJECT} after ${Math.round((Date.now() - triggerStart) / 1000)}s`,
				);
			}
			if (inProd) {
				throw new Error(
					`error LEAKED to ${PROD_SENTRY_PROJECT} — DSN mis-routing`,
				);
			}
			return `${STAGING_SENTRY_PROJECT} HAS event; ${PROD_SENTRY_PROJECT} does NOT`;
		});
	}

	// === Item 11: R2 token scope (OQ-13) =====================================

	await check("r2-scope", async () => {
		execSync("pnpm verify:r2-scope", { stdio: "inherit" });
		return "all 4 cross-bucket attempts returned 403/AccessDenied";
	});

	// === Summary =============================================================

	const fails = results.filter((r) => !r.pass);
	const skipped = results.filter((r) => r.skipped);
	const passed = results.filter((r) => r.pass && !r.skipped);
	console.log(
		`\n[smoke-staging] ${passed.length} passed, ${fails.length} failed, ${skipped.length} skipped (of ${results.length})`,
	);
	if (fails.length > 0) process.exit(1);
}

void main();
