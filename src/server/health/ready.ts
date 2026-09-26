import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { markets, users } from "@/db/schema";
import { safeCaptureMessage } from "@/server/observability/safe-capture";

/**
 * Warm-up for a freshly started task (AWS-MIGRATION-3).
 *
 * The ALB target-group health check points at `/api/ready`, which answers 503
 * until this has run once — so a new task joins the load balancer only after
 * it has rendered, through its own HTTP port, the pages that cost the most:
 * the home page, every Open market, and one profile. Measured on staging: a
 * task 2½ minutes old, caches empty, collapsed under twelve concurrent users
 * (7.7 % no-response, p95 ≈ 10 s); the same task warmed sequentially served
 * the 30-minute soak. Rendering through `127.0.0.1:PORT` rather than calling
 * the read models directly is deliberate — it fills the SAME `'use cache'`
 * entries and shared blocks a real request would.
 *
 * ⚠ BOUNDED, AND A FAILURE COUNTS AS DONE. A market whose page cannot render
 * must make the task colder, never undeployable: each fetch has its own
 * timeout, the whole warm has a budget, and a fetch that fails or times out
 * is recorded in `failed` and skipped. Readiness is therefore "this process
 * tried, once" — the strongest promise that cannot leave a service with zero
 * healthy targets.
 *
 * Process-local state, on purpose: a memoised promise is exactly the right
 * scope for "has THIS process warmed", and the only in-process state this
 * lane adds.
 */
export const READY_PER_FETCH_TIMEOUT_MS = 20_000;
export const READY_TOTAL_BUDGET_MS = 90_000;

export interface WarmUpDeps {
	readonly fetchImpl: (
		url: string,
		init: { signal: AbortSignal },
	) => Promise<unknown>;
	readonly baseUrl: string;
	readonly listOpenSlugs: () => Promise<readonly string[]>;
	readonly profilePseudonym: () => Promise<string | null>;
	readonly perFetchTimeoutMs?: number;
	readonly totalBudgetMs?: number;
	readonly log?: (line: string) => void;
}

export interface WarmUpResult {
	readonly ready: true;
	readonly warmed: readonly string[];
	readonly failed: readonly string[];
	readonly durationMs: number;
	readonly warmedAt: string;
}

export async function warmUp(deps: WarmUpDeps): Promise<WarmUpResult> {
	const perFetch = deps.perFetchTimeoutMs ?? READY_PER_FETCH_TIMEOUT_MS;
	const budget = deps.totalBudgetMs ?? READY_TOTAL_BUDGET_MS;
	const log = deps.log ?? (() => {});
	const started = Date.now();
	const warmed: string[] = [];
	const failed: string[] = [];

	const paths: string[] = ["/"];
	try {
		for (const slug of await deps.listOpenSlugs()) paths.push(`/m/${slug}`);
	} catch (err) {
		log(`ready: could not list open markets (${String(err).slice(0, 120)})`);
	}
	try {
		const pseudonym = await deps.profilePseudonym();
		if (pseudonym) paths.push(`/u/${pseudonym}`);
	} catch (err) {
		log(`ready: could not pick a profile (${String(err).slice(0, 120)})`);
	}

	for (const path of paths) {
		const elapsed = Date.now() - started;
		if (elapsed >= budget) {
			failed.push(path);
			continue;
		}
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(),
			Math.min(perFetch, budget - elapsed),
		);
		try {
			await deps.fetchImpl(`${deps.baseUrl}${path}`, {
				signal: controller.signal,
			});
			warmed.push(path);
		} catch (err) {
			failed.push(path);
			log(`ready: warm ${path} failed (${String(err).slice(0, 120)})`);
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		ready: true,
		warmed,
		failed,
		durationMs: Date.now() - started,
		warmedAt: new Date().toISOString(),
	};
}

async function listOpenSlugs(): Promise<readonly string[]> {
	const rows = await db
		.select({ slug: markets.slug })
		.from(markets)
		.where(eq(markets.status, "Open"));
	return rows.map((r) => r.slug);
}

async function anyPseudonym(): Promise<string | null> {
	const rows = await db
		.select({ pseudonym: users.pseudonym })
		.from(users)
		.limit(1);
	return rows[0]?.pseudonym ?? null;
}

/**
 * The default fetch for the warm. Two things `fetch` alone does not do
 * (`@code-reviewer` HIGH): it resolves on HEADERS, and with Partial
 * Prerendering the shell flushes before the dynamic segments render — so an
 * undrained body lets the walk finish in milliseconds with the expensive
 * render abandoned and no cache entry filled; and it resolves for a 500
 * exactly as for a 200, so a page that cannot render would count as warmed.
 * Drain the body, then treat any non-2xx as a failure of that path.
 */
export async function warmFetch(
	url: string,
	init: { signal: AbortSignal },
): Promise<void> {
	const res = await fetch(url, { signal: init.signal });
	await res.arrayBuffer();
	if (!res.ok) {
		throw new Error(`status ${res.status}`);
	}
}

let inflight: Promise<WarmUpResult> | null = null;

/** Once per process. The first caller starts the warm; everyone shares it. */
export function readiness(): Promise<WarmUpResult> {
	if (inflight === null) {
		const port = process.env.PORT ?? "3000";
		// `console.warn` rather than the structured logger: `logRequest` is
		// request-shaped and field-locked, and this is boot-time process state.
		// A warm with failures is ALSO sent to Sentry (fail-open) — a task that
		// serves cold at 3 a.m. must not be a line nobody reads (O-3).
		inflight = warmUp({
			fetchImpl: warmFetch,
			baseUrl: `http://127.0.0.1:${port}`,
			listOpenSlugs,
			profilePseudonym: anyPseudonym,
			log: (line) => console.warn(line),
		}).then((result) => {
			if (result.failed.length > 0) {
				safeCaptureMessage("ready_warmup_incomplete", {
					level: "warning",
					tags: { failed: String(result.failed.length) },
					extra: { failed: result.failed, warmed: result.warmed },
				});
			}
			return result;
		});
	}
	return inflight;
}
