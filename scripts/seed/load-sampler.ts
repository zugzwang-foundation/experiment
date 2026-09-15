/**
 * LOAD SAMPLER — what did the server side look like while the seed ran?
 *
 * SEED-DEPTH2 (test branch, not for merge). The dummy seed places its bets from
 * THIS machine straight into Supabase Postgres, not through Vercel, so the
 * request path the participants use is never exercised by the seed itself. This
 * samples both halves on a fixed interval and writes ONE JSON line per interval
 * to stdout (so a systemd --user unit lands it in the journal) and to a JSONL
 * file (which is the record — the journal is a convenience).
 *
 *   pnpm exec tsx scripts/seed/load-sampler.ts --env local|staging|prod \
 *     [--base-url https://…] [--interval 10s] [--duration 17m] \
 *     [--out ~/zz-load-logs/run.jsonl] [--slugs a,b] [--label seed-depth2]
 *
 * Launch it through `scripts/seed/run-load-sampler.sh`, which wraps it in the
 * right Doppler config and a transient user unit.
 *
 * ── IT OBSERVES; IT NEVER DRIVES ────────────────────────────────────────────
 *
 * Every sample is ONE `BEGIN READ ONLY` transaction with `SET LOCAL`
 * statement_timeout/lock_timeout, and each probe inside it runs in a SAVEPOINT
 * so one failing probe does not take the others with it.
 *
 * ⚠ Why `BEGIN READ ONLY` + `SET LOCAL` and not a session-level
 * `SET default_transaction_read_only = on`: a session SET survives only as long
 * as the physical backend does, and is silently lost on a postgres.js reconnect —
 * and on a transaction-mode pooler a session SET would leak onto a backend the
 * APP then borrows, making the app's writes fail. Transaction-scoped settings are
 * correct on every pooler and every reconnect. `:6543` is refused anyway (below).
 *
 * ⚠ One transaction per sample, not one per probe, because the sampler's own
 * commits land in the very `pg_stat_database.xact_commit` it measures. At a 10 s
 * interval that is one commit per sample, and `commitsExclSampler` subtracts it.
 * The seed places ~0.2 bets/s; a per-probe design would have out-committed it.
 *
 * ⚠ The sampler HOLDS ONE pooler connection for the whole run (`max: 1`). On the
 * `:5432` session pooler that is one slot of the tenant pool for the duration —
 * a deliberate trade against re-handshaking every interval, and worth knowing
 * when reading the connection counts it reports.
 *
 * ── FAIL-OPEN, EXCEPT ON THE WRONG TARGET ───────────────────────────────────
 *
 * A missing credential, a timeout or an HTTP error becomes an `error` field and
 * the run continues; a monitor that dies mid-window records nothing. A DB URL
 * that names the WRONG project (prod ref in staging mode, anything but the prod
 * ref in prod mode, non-loopback in local mode, `:6543`) refuses at start with
 * exit 2 — being pointed at the wrong database is an operator error, not load.
 *
 * Nothing secret is ever printed: no URL, no token, no query text. Error
 * messages pass through `redact()`, which strips every credential value this
 * process read from its environment.
 *
 * ⚠ Correlating these lines with the seed's own log needs the CLOCK OFFSET, which
 * every DB sample carries (`db.clockOffsetMs`, db − local). It is a measurement,
 * not a constant — see `scripts/sample-backend-activity.ts`, which has watched it
 * change sign on staging.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import {
	isAllowedStagingHost,
	PRODUCTION_PROJECT_REF,
} from "../../tests/staging/_lib/guards";

type Env = "local" | "staging" | "prod";

const LOCAL_DB_DEFAULT =
	"postgresql://postgres:postgres@localhost:54322/postgres";
const DEFAULT_BASE: Record<Env, string | null> = {
	local: null,
	staging: "https://staging.zugzwangworld.com",
	prod: "https://zugzwangworld.com",
};
const EXPECTED_HEALTH_ENV: Record<Env, string | null> = {
	local: null,
	staging: "staging",
	prod: "prod",
};
const HTTP_TIMEOUT_MS = 10_000;
const DB_SAMPLE_TIMEOUT_MS = 8_000;
const VERCEL_EVERY_MS = 60_000;
const USER_AGENT = "zz-load-sampler/1 (scripts/seed/load-sampler.ts)";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

class Refusal extends Error {}

// ── args ────────────────────────────────────────────────────────────────────

function parseDuration(raw: string, flag: string): number {
	const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(raw.trim());
	if (!m)
		throw new Refusal(`${flag}: cannot parse duration ${JSON.stringify(raw)}`);
	const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] ?? "s"] ?? 1000;
	return Math.round(Number(m[1]) * mult);
}

interface Opts {
	env: Env;
	baseUrl: string | null;
	intervalMs: number;
	durationMs: number;
	out: string;
	slugs: string[];
	label: string | null;
}

function parseArgs(argv: string[]): Opts {
	const kv = new Map<string, string>();
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i] ?? "";
		if (!a.startsWith("--"))
			throw new Refusal(`unexpected argument ${JSON.stringify(a)}`);
		const eq = a.indexOf("=");
		if (eq > 0) kv.set(a.slice(2, eq), a.slice(eq + 1));
		else kv.set(a.slice(2), argv[++i] ?? "");
	}
	const known = [
		"env",
		"base-url",
		"interval",
		"duration",
		"out",
		"slugs",
		"label",
	];
	for (const k of kv.keys()) {
		if (!known.includes(k)) throw new Refusal(`unknown flag --${k}`);
	}
	const env = kv.get("env");
	if (env !== "local" && env !== "staging" && env !== "prod") {
		throw new Refusal(
			`--env must be local|staging|prod (saw ${JSON.stringify(env)}); there is no default`,
		);
	}
	const baseUrl =
		(kv.get("base-url") || DEFAULT_BASE[env])?.replace(/\/+$/, "") ?? null;
	if (baseUrl !== null && !/^https?:\/\//.test(baseUrl)) {
		throw new Refusal(`--base-url must be an http(s) URL`);
	}
	const intervalMs = parseDuration(kv.get("interval") || "10s", "--interval");
	const durationMs = parseDuration(kv.get("duration") || "17m", "--duration");
	if (intervalMs < 1000) throw new Refusal("--interval must be at least 1s");

	const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
	const out = resolve(
		kv.get("out")?.replace(/^~(?=\/)/, homedir()) ||
			`${homedir()}/zz-load-logs/zz-load-${env}-${stamp}.jsonl`,
	);
	const rel = relative(REPO_ROOT, out);
	if (!rel.startsWith("..") && !isAbsolute(rel)) {
		throw new Refusal(`--out must be outside the repository (${REPO_ROOT})`);
	}
	const slugs = (kv.get("slugs") ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return {
		env,
		baseUrl,
		intervalMs,
		durationMs,
		out,
		slugs,
		label: kv.get("label") || null,
	};
}

// ── secrets hygiene ─────────────────────────────────────────────────────────

const SECRET_ENV_NAMES = [
	"DATABASE_URL",
	"DATABASE_URL_STAGING",
	"VERCEL_API_TOKEN",
	"UPSTASH_REDIS_REST_TOKEN",
];

function redact(msg: string): string {
	let s = msg;
	for (const name of SECRET_ENV_NAMES) {
		const v = process.env[name];
		if (!v) continue;
		s = s.split(v).join("[redacted]");
		try {
			const u = new URL(v);
			if (u.password)
				s = s.split(decodeURIComponent(u.password)).join("[redacted]");
		} catch {
			// not a URL (a token) — the whole-value replacement above covers it
		}
	}
	return s.slice(0, 300);
}

function errMsg(e: unknown): string {
	const err = e as {
		code?: string;
		message?: string;
		cause?: { code?: string };
	};
	const code = err?.code ?? err?.cause?.code;
	return redact(`${code ? `${code}: ` : ""}${err?.message ?? String(e)}`);
}

// ── DB target ───────────────────────────────────────────────────────────────

interface DbTarget {
	url: string | null;
	source: string;
	unavailable?: string;
}

function resolveDb(env: Env): DbTarget {
	const port = (url: string): string | null => {
		try {
			return new URL(url).port;
		} catch {
			throw new Refusal("the DB URL is not parseable; refusing");
		}
	};
	const host = (url: string): string => new URL(url).hostname.toLowerCase();

	if (env === "local") {
		const url = process.env.DATABASE_URL || LOCAL_DB_DEFAULT;
		port(url);
		if (url.includes(PRODUCTION_PROJECT_REF))
			throw new Refusal(
				"local mode: DATABASE_URL names the PRODUCTION ref; refusing",
			);
		if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host(url))) {
			throw new Refusal(
				"local mode requires a loopback DATABASE_URL; refusing",
			);
		}
		return {
			url,
			source: process.env.DATABASE_URL ? "DATABASE_URL" : "local-default",
		};
	}

	const name =
		env === "staging" && process.env.DATABASE_URL_STAGING
			? "DATABASE_URL_STAGING"
			: "DATABASE_URL";
	const url = process.env[name];
	if (!url) {
		return {
			url: null,
			source: name,
			unavailable: `unavailable: ${env === "staging" ? "DATABASE_URL_STAGING / DATABASE_URL" : "DATABASE_URL"} not set (run under doppler --config ${env === "staging" ? "stg" : "prd"})`,
		};
	}
	if (port(url) === "6543") {
		throw new Refusal(
			"the DB URL is the :6543 transaction pooler; an observer must not ride the pooler it observes. Use :5432.",
		);
	}
	if (!isAllowedStagingHost(host(url)))
		throw new Refusal(`${name} is not a Supabase host; refusing`);
	if (env === "staging") {
		if (url.includes(PRODUCTION_PROJECT_REF)) {
			throw new Refusal(
				`${name} names the PRODUCTION ref in staging mode; refusing (check --config stg)`,
			);
		}
		const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
		if (!fragment || !url.includes(fragment)) {
			throw new Refusal(
				`${name} does not contain STAGING_PROJECT_REF_FRAGMENT; cannot prove it is staging`,
			);
		}
	} else if (!url.includes(PRODUCTION_PROJECT_REF)) {
		throw new Refusal(
			`${name} does not name the PRODUCTION ref in prod mode; refusing (check --config prd)`,
		);
	}
	const zenv = process.env.ZUGZWANG_ENV;
	if (zenv !== env)
		throw new Refusal(
			`ZUGZWANG_ENV is ${JSON.stringify(zenv)}, expected "${env}"; refusing`,
		);
	return { url, source: name };
}

// ── DB sampling ─────────────────────────────────────────────────────────────

interface DbCumulative {
	at: number;
	xact_commit: number;
	xact_rollback: number;
	tup_inserted: number;
	tup_updated: number;
	tup_deleted: number;
	conflicts: number;
	deadlocks: number;
	blks_hit: number;
	blks_read: number;
}

type Json = Record<string, unknown>;

class DbSampler {
	private sql: postgres.Sql | null = null;
	private prev: DbCumulative | null = null;
	private prevSeedBets: number | null = null;
	private prevStatements = new Map<string, { calls: number; total: number }>();
	private statementsRel: string | null | undefined;
	/** Sampler transactions committed/rolled back since `prev` was read. */
	private selfCommits = 0;
	private selfRollbacks = 0;
	seedSince: Date;

	constructor(
		private readonly url: string,
		localStart: Date,
	) {
		this.seedSince = localStart;
	}

	private client(): postgres.Sql {
		if (!this.sql) {
			this.sql = postgres(this.url, {
				max: 1,
				prepare: false,
				connect_timeout: 10,
				idle_timeout: 0,
				connection: { application_name: "zz-load-sampler" },
				onnotice: () => {},
			});
		}
		return this.sql;
	}

	async anchorSeedClock(): Promise<boolean> {
		try {
			const [r] = await this.client()`SELECT clock_timestamp() AS t`;
			this.seedSince = new Date(r?.t as string | Date);
			return true;
		} catch {
			return false;
		}
	}

	async sample(): Promise<Json> {
		const sql = this.client();
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(`db sample exceeded ${DB_SAMPLE_TIMEOUT_MS}ms`)),
				DB_SAMPLE_TIMEOUT_MS,
			);
		});
		try {
			const out = await Promise.race([
				sql.begin("read only", (tx) => this.probes(tx)),
				timeout,
			]);
			this.selfCommits += 1;
			return out;
		} catch (e) {
			this.selfRollbacks += 1;
			// A hung connection would block every later sample behind it on max:1.
			const stale = this.sql;
			this.sql = null;
			void stale?.end({ timeout: 0 }).catch(() => {});
			return { error: errMsg(e) };
		} finally {
			clearTimeout(timer);
		}
	}

	private async probes(tx: postgres.TransactionSql): Promise<Json> {
		const errors: Record<string, string> = {};
		const probe = async <T>(
			name: string,
			fn: (sp: postgres.TransactionSql) => Promise<T>,
		): Promise<T | null> => {
			try {
				return (await tx.savepoint((sp) => fn(sp))) as T;
			} catch (e) {
				errors[name] = errMsg(e);
				return null;
			}
		};
		await tx`SET LOCAL statement_timeout = '3s'`;
		await tx`SET LOCAL lock_timeout = '1s'`;

		const out: Json = {};

		const t0 = Date.now();
		const [clock] = await tx`SELECT clock_timestamp() AS t`;
		const t1 = Date.now();
		out.clockOffsetMs = Math.round(
			new Date(clock?.t as string | Date).getTime() - (t0 + t1) / 2,
		);
		out.rttMs = t1 - t0;

		const stat = await probe("statDatabase", async (sp) => {
			const [r] = await sp`
				SELECT xact_commit, xact_rollback, tup_inserted, tup_updated, tup_deleted,
				       conflicts, deadlocks, blks_hit, blks_read, numbackends
				  FROM pg_stat_database WHERE datname = current_database()`;
			return r;
		});
		if (stat) {
			const cur: DbCumulative = {
				at: Date.now(),
				xact_commit: Number(stat.xact_commit),
				xact_rollback: Number(stat.xact_rollback),
				tup_inserted: Number(stat.tup_inserted),
				tup_updated: Number(stat.tup_updated),
				tup_deleted: Number(stat.tup_deleted),
				conflicts: Number(stat.conflicts),
				deadlocks: Number(stat.deadlocks),
				blks_hit: Number(stat.blks_hit),
				blks_read: Number(stat.blks_read),
			};
			const cumHitRatio =
				cur.blks_hit + cur.blks_read > 0
					? cur.blks_hit / (cur.blks_hit + cur.blks_read)
					: null;
			if (this.prev) {
				const p = this.prev;
				const d = (k: keyof DbCumulative) => cur[k] - p[k];
				const dHit = d("blks_hit");
				const dRead = d("blks_read");
				out.stats = {
					windowS: Math.round((cur.at - p.at) / 100) / 10,
					commits: d("xact_commit"),
					commitsExclSampler: d("xact_commit") - this.selfCommits,
					rollbacks: d("xact_rollback"),
					rollbacksExclSampler: d("xact_rollback") - this.selfRollbacks,
					inserted: d("tup_inserted"),
					updated: d("tup_updated"),
					deleted: d("tup_deleted"),
					conflicts: d("conflicts"),
					deadlocks: d("deadlocks"),
					cacheHitRatio:
						dHit + dRead > 0 ? round4(dHit / (dHit + dRead)) : null,
					cacheHitRatioCumulative:
						cumHitRatio === null ? null : round4(cumHitRatio),
					numbackends: Number(stat.numbackends),
				};
			} else {
				out.stats = {
					baseline: true,
					cacheHitRatioCumulative:
						cumHitRatio === null ? null : round4(cumHitRatio),
				};
			}
			this.prev = cur;
			this.selfCommits = 0;
			this.selfRollbacks = 0;
		}

		const act = await probe(
			"activity",
			(sp) => sp`
			SELECT coalesce(state, 'null') AS state,
			       coalesce(nullif(application_name, ''), '(none)') AS app,
			       count(*)::int AS n,
			       count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS lock_waiting,
			       max(extract(epoch FROM clock_timestamp() - query_start) * 1000)
			         FILTER (WHERE state = 'active') AS longest_active_ms,
			       max(extract(epoch FROM clock_timestamp() - xact_start) * 1000) AS longest_xact_ms
			  FROM pg_stat_activity
			 WHERE datname = current_database()
			   AND backend_type = 'client backend'
			   AND pid <> pg_backend_pid()
			 GROUP BY 1, 2`,
		);
		if (act) {
			const byState: Record<string, number> = {};
			const byApp: Record<string, number> = {};
			let total = 0;
			let lockWaiting = 0;
			let longestActive: number | null = null;
			let longestXact: number | null = null;
			for (const r of act) {
				const n = Number(r.n);
				byState[r.state] = (byState[r.state] ?? 0) + n;
				byApp[r.app] = (byApp[r.app] ?? 0) + n;
				total += n;
				lockWaiting += Number(r.lock_waiting);
				if (r.longest_active_ms !== null)
					longestActive = Math.max(
						longestActive ?? 0,
						Number(r.longest_active_ms),
					);
				if (r.longest_xact_ms !== null)
					longestXact = Math.max(longestXact ?? 0, Number(r.longest_xact_ms));
			}
			out.activity = {
				total,
				active: byState.active ?? 0,
				byState,
				byApp,
				lockWaiting,
				longestActiveQueryMs:
					longestActive === null ? null : Math.round(longestActive),
				longestOpenXactMs:
					longestXact === null ? null : Math.round(longestXact),
			};
		}

		const locks = await probe(
			"locks",
			(sp) => sp`SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`,
		);
		if (locks) out.ungrantedLocks = Number(locks[0]?.n ?? 0);

		out.statements = await this.statements(probe);

		const seed = await probe(
			"seedProgress",
			(sp) => sp`
			SELECT (SELECT count(*) FROM bets WHERE created_at >= ${this.seedSince})::int AS bets,
			       (SELECT count(*) FROM comments WHERE created_at >= ${this.seedSince})::int AS comments`,
		);
		if (seed) {
			const bets = Number(seed[0]?.bets);
			out.seed = {
				bets,
				betsDelta: this.prevSeedBets === null ? null : bets - this.prevSeedBets,
				comments: Number(seed[0]?.comments),
			};
			this.prevSeedBets = bets;
		}

		if (Object.keys(errors).length > 0) out.errors = errors;
		return out;
	}

	private async statements(
		probe: <T>(
			name: string,
			fn: (sp: postgres.TransactionSql) => Promise<T>,
		) => Promise<T | null>,
	): Promise<unknown> {
		if (this.statementsRel === undefined) {
			const r = await probe(
				"statementsLookup",
				(sp) => sp`
				SELECT coalesce(to_regclass('extensions.pg_stat_statements'),
				                to_regclass('public.pg_stat_statements'))::text AS rel`,
			);
			if (r === null) return "unavailable: lookup failed";
			this.statementsRel = (r[0]?.rel as string | null) ?? null;
		}
		const rel = this.statementsRel;
		if (rel === null) return "unavailable: pg_stat_statements is not installed";
		// `rel` is one of two fixed names returned by to_regclass above — never input.
		if (
			rel !== "extensions.pg_stat_statements" &&
			rel !== "pg_stat_statements"
		) {
			return `unavailable: unexpected relation ${rel}`;
		}
		const rows = await probe("statements", (sp) =>
			sp.unsafe(`
			SELECT queryid::text AS queryid, calls, total_exec_time
			  FROM ${rel}
			 WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())`),
		);
		if (rows === null)
			return "unavailable: not readable (see errors.statements)";
		const baseline = this.prevStatements.size === 0;
		const next = new Map<string, { calls: number; total: number }>();
		const deltas: {
			queryid: string;
			calls: number;
			totalMs: number;
			meanMs: number;
		}[] = [];
		let hidden = 0;
		for (const r of rows) {
			if (r.queryid === null) {
				hidden += 1;
				continue;
			}
			// One queryid can appear once per role; sum them into one entry.
			const key = r.queryid as string;
			const acc = next.get(key) ?? { calls: 0, total: 0 };
			acc.calls += Number(r.calls);
			acc.total += Number(r.total_exec_time);
			next.set(key, acc);
		}
		for (const [queryid, cur] of next) {
			const p = this.prevStatements.get(queryid);
			// A reset or eviction makes the delta negative: count the entry from zero.
			const dCalls =
				p && cur.calls >= p.calls ? cur.calls - p.calls : cur.calls;
			const dTotal =
				p && cur.total >= p.total ? cur.total - p.total : cur.total;
			if (!baseline && dCalls > 0) {
				deltas.push({
					queryid,
					calls: dCalls,
					totalMs: round1(dTotal),
					meanMs: round1(dTotal / dCalls),
				});
			}
		}
		this.prevStatements = next;
		if (baseline)
			return { baseline: true, entries: next.size, hiddenRows: hidden };
		deltas.sort((a, b) => b.totalMs - a.totalMs);
		return { top: deltas.slice(0, 5), hiddenRows: hidden };
	}

	async end(): Promise<void> {
		await this.sql?.end({ timeout: 2 }).catch(() => {});
	}
}

// ── HTTP / Upstash / Vercel ─────────────────────────────────────────────────

interface HttpResult {
	path: string;
	status: number | null;
	ms: number;
	ttfbMs?: number;
	bytes?: number;
	cache?: string | null;
	vercelId?: string | null;
	error?: string;
	health?: Json;
}

async function probeHttp(base: string, path: string): Promise<HttpResult> {
	const t0 = performance.now();
	try {
		const res = await fetch(`${base}${path}`, {
			headers: { "user-agent": USER_AGENT },
			redirect: "follow",
			cache: "no-store",
			signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		});
		const ttfb = performance.now() - t0;
		const body = await res.text();
		const r: HttpResult = {
			path,
			status: res.status,
			ms: Math.round(performance.now() - t0),
			ttfbMs: Math.round(ttfb),
			bytes: body.length,
			cache: res.headers.get("x-vercel-cache"),
			vercelId: res.headers.get("x-vercel-id"),
		};
		if (path === "/api/health") {
			try {
				const h = JSON.parse(body) as Json;
				r.health = {
					env: h.env,
					canary: h.canary,
					region: h.region,
					db: h.db,
					migrations: h.migrations,
				};
			} catch {
				r.error = "health body is not JSON";
			}
		}
		return r;
	} catch (e) {
		return {
			path,
			status: null,
			ms: Math.round(performance.now() - t0),
			error: errMsg(e),
		};
	}
}

async function probeUpstash(): Promise<unknown> {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token)
		return "unavailable: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set";
	const t0 = performance.now();
	try {
		const res = await fetch(`${url.replace(/\/+$/, "")}/ping`, {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(5000),
		});
		const body = (await res.json().catch(() => null)) as {
			result?: unknown;
		} | null;
		const pingMs = Math.round(performance.now() - t0);
		if (!res.ok || body?.result !== "PONG")
			return { error: `status ${res.status}`, pingMs };
		return { pingMs };
	} catch (e) {
		return { error: errMsg(e), pingMs: Math.round(performance.now() - t0) };
	}
}

/**
 * Deployment state only. Vercel publishes no stable public REST endpoint for
 * per-deployment invocation or error counts (those live in the dashboard's
 * Observability tab and in log drains), so this reports the deployment that
 * serves the health canary and says plainly that runtime stats are not read.
 */
async function probeVercel(canary: string | null): Promise<unknown> {
	const token = process.env.VERCEL_API_TOKEN;
	const project = process.env.VERCEL_PROJECT_ID;
	const team = process.env.VERCEL_TEAM_ID;
	if (!token) return "unavailable: VERCEL_API_TOKEN not set";
	if (!project) return "unavailable: VERCEL_PROJECT_ID not set";
	const q = new URLSearchParams({ projectId: project, limit: "3" });
	if (team) q.set("teamId", team);
	if (canary) q.set("sha", canary);
	try {
		const res = await fetch(`https://api.vercel.com/v6/deployments?${q}`, {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		});
		if (!res.ok) return `unavailable: deployments API status ${res.status}`;
		const body = (await res.json()) as { deployments?: Json[] };
		return {
			deployments: (body.deployments ?? []).map((d) => ({
				uid: d.uid,
				target: d.target ?? null,
				state: d.state ?? d.readyState ?? null,
				createdAt:
					typeof d.created === "number"
						? new Date(d.created).toISOString()
						: null,
			})),
			runtimeStats:
				"unavailable: no stable public Vercel REST endpoint for invocation/error counts",
		};
	} catch (e) {
		return `unavailable: ${errMsg(e)}`;
	}
}

// ── summary ─────────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

function pct(sorted: number[], p: number): number | null {
	if (sorted.length === 0) return null;
	return (
		sorted[
			Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
		] ?? null
	);
}

class Summary {
	samples = 0;
	httpMs = new Map<string, number[]>();
	httpErrors = new Map<string, number>();
	statusCounts = new Map<string, Record<string, number>>();
	commits = 0;
	commitsExclSampler = 0;
	rollbacks = 0;
	inserted = 0;
	updated = 0;
	deleted = 0;
	deadlocks = 0;
	maxUngrantedLocks: number | null = null;
	maxActiveConnections: number | null = null;
	maxTotalConnections: number | null = null;
	maxLongestActiveQueryMs: number | null = null;
	dbErrors = 0;
	dbProbeErrors = 0;
	upstashErrors = 0;
	upstashMs: number[] = [];
	lastSeed: unknown = null;
	canaries = new Set<string>();

	add(line: Json): void {
		this.samples += 1;
		for (const h of (line.http as HttpResult[] | undefined) ?? []) {
			const sc = this.statusCounts.get(h.path) ?? {};
			const key = h.status === null ? "error" : String(h.status);
			sc[key] = (sc[key] ?? 0) + 1;
			this.statusCounts.set(h.path, sc);
			if (h.error || h.status === null || h.status >= 500) {
				this.httpErrors.set(h.path, (this.httpErrors.get(h.path) ?? 0) + 1);
			}
			if (h.status !== null)
				this.httpMs.set(h.path, [...(this.httpMs.get(h.path) ?? []), h.ms]);
			const canary = h.health?.canary;
			if (typeof canary === "string") this.canaries.add(canary);
		}
		const db = line.db as Json | string | undefined;
		if (typeof db === "object" && db !== null) {
			if (db.error) this.dbErrors += 1;
			if (db.errors)
				this.dbProbeErrors += Object.keys(db.errors as Json).length;
			const s = db.stats as Json | undefined;
			if (s && !s.baseline) {
				this.commits += Number(s.commits);
				this.commitsExclSampler += Number(s.commitsExclSampler);
				this.rollbacks += Number(s.rollbacks);
				this.inserted += Number(s.inserted);
				this.updated += Number(s.updated);
				this.deleted += Number(s.deleted);
				this.deadlocks += Number(s.deadlocks);
			}
			const a = db.activity as Json | undefined;
			if (a) {
				this.maxActiveConnections = Math.max(
					this.maxActiveConnections ?? 0,
					Number(a.active),
				);
				this.maxTotalConnections = Math.max(
					this.maxTotalConnections ?? 0,
					Number(a.total),
				);
				if (a.longestActiveQueryMs !== null) {
					this.maxLongestActiveQueryMs = Math.max(
						this.maxLongestActiveQueryMs ?? 0,
						Number(a.longestActiveQueryMs),
					);
				}
			}
			if (typeof db.ungrantedLocks === "number") {
				this.maxUngrantedLocks = Math.max(
					this.maxUngrantedLocks ?? 0,
					db.ungrantedLocks,
				);
			}
			if (db.seed) this.lastSeed = db.seed;
		}
		const up = line.upstash as Json | string | undefined;
		if (typeof up === "object" && up !== null) {
			if (up.error) this.upstashErrors += 1;
			else this.upstashMs.push(Number(up.pingMs));
		}
	}

	toJson(): Json {
		const http: Json = {};
		for (const [path, ms] of this.httpMs) {
			const s = [...ms].sort((a, b) => a - b);
			http[path] = {
				n: s.length,
				minMs: s[0] ?? null,
				p50Ms: pct(s, 50),
				p95Ms: pct(s, 95),
				maxMs: s[s.length - 1] ?? null,
				statuses: this.statusCounts.get(path),
				errors: this.httpErrors.get(path) ?? 0,
			};
		}
		for (const [path, sc] of this.statusCounts) {
			if (!http[path])
				http[path] = {
					n: 0,
					statuses: sc,
					errors: this.httpErrors.get(path) ?? 0,
				};
		}
		const up = [...this.upstashMs].sort((a, b) => a - b);
		return {
			samples: this.samples,
			http,
			db: {
				commits: this.commits,
				commitsExclSampler: this.commitsExclSampler,
				rollbacks: this.rollbacks,
				inserted: this.inserted,
				updated: this.updated,
				deleted: this.deleted,
				deadlocks: this.deadlocks,
				maxUngrantedLocks: this.maxUngrantedLocks,
				maxActiveConnections: this.maxActiveConnections,
				maxTotalConnections: this.maxTotalConnections,
				maxLongestActiveQueryMs: this.maxLongestActiveQueryMs,
				seed: this.lastSeed,
			},
			upstash: {
				n: up.length,
				p50Ms: pct(up, 50),
				maxMs: up[up.length - 1] ?? null,
			},
			errors: {
				dbSample: this.dbErrors,
				dbProbe: this.dbProbeErrors,
				http: Object.fromEntries(this.httpErrors),
				upstash: this.upstashErrors,
			},
			canaries: [...this.canaries],
		};
	}
}

// ── main ────────────────────────────────────────────────────────────────────

function emit(out: string, line: Json): void {
	const s = JSON.stringify(line);
	process.stdout.write(`${s}\n`);
	try {
		appendFileSync(out, `${s}\n`);
	} catch (e) {
		process.stderr.write(
			`[load-sampler] cannot append to --out: ${errMsg(e)}\n`,
		);
	}
}

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));
	const target = resolveDb(opts.env);
	mkdirSync(dirname(opts.out), { recursive: true });

	const localStart = new Date();
	const db = target.url ? new DbSampler(target.url, localStart) : null;
	const anchored = db ? await db.anchorSeedClock() : false;

	let stopping = false;
	let wake: (() => void) | null = null;
	const stop = (sig: string) => {
		if (stopping) return;
		stopping = true;
		process.stderr.write(
			`[load-sampler] ${sig}: finishing the current sample, then summarising\n`,
		);
		wake?.();
	};
	process.on("SIGTERM", () => stop("SIGTERM"));
	process.on("SIGINT", () => stop("SIGINT"));

	const paths = opts.baseUrl
		? [
				"/api/health",
				"/",
				...opts.slugs.map((s) => `/m/${encodeURIComponent(s)}`),
			]
		: [];
	emit(opts.out, {
		kind: "start",
		at: localStart.toISOString(),
		label: opts.label,
		env: opts.env,
		baseUrl: opts.baseUrl,
		paths,
		intervalMs: opts.intervalMs,
		durationMs: opts.durationMs,
		out: opts.out,
		db: target.unavailable ?? {
			source: target.source,
			seedSince: db?.seedSince.toISOString(),
			seedSinceClock: anchored ? "db" : "local",
		},
		pid: process.pid,
	});

	const summary = new Summary();
	const t0 = Date.now();
	let n = 0;
	let lastVercelAt = 0;
	let lastVercel: unknown = null;
	let lastCanary: string | null = null;

	while (!stopping) {
		const slotAt = Date.now();
		n += 1;

		const httpChain = (async () => {
			const results: HttpResult[] = [];
			for (const p of paths) {
				if (stopping && results.length > 0) break;
				results.push(await probeHttp(opts.baseUrl as string, p));
			}
			return results;
		})();
		const [http, dbOut, upstash] = await Promise.all([
			httpChain,
			db
				? db.sample()
				: Promise.resolve(target.unavailable ?? "unavailable: no DB target"),
			probeUpstash(),
		]);

		const health = http.find((h) => h.path === "/api/health")?.health;
		if (typeof health?.canary === "string") lastCanary = health.canary;
		if (Date.now() - lastVercelAt >= VERCEL_EVERY_MS || lastVercel === null) {
			lastVercel = await probeVercel(lastCanary);
			lastVercelAt = Date.now();
		}

		const expectedEnv = EXPECTED_HEALTH_ENV[opts.env];
		const line: Json = {
			kind: "sample",
			n,
			at: new Date(slotAt).toISOString(),
			elapsedS: round1((slotAt - t0) / 1000),
			label: opts.label,
			env: opts.env,
			sampleMs: Date.now() - slotAt,
			db: dbOut,
			http,
			...(health && expectedEnv && health.env !== expectedEnv
				? { healthEnvMismatch: health.env }
				: {}),
			upstash,
			vercel: lastVercel,
		};
		summary.add(line);
		emit(opts.out, line);

		const elapsed = Date.now() - t0;
		if (elapsed >= opts.durationMs) break;
		const nextSlot =
			t0 + Math.ceil((elapsed + 1) / opts.intervalMs) * opts.intervalMs;
		const waitMs = Math.min(nextSlot, t0 + opts.durationMs) - Date.now();
		if (waitMs > 0 && !stopping) {
			await new Promise<void>((r) => {
				const t = setTimeout(r, waitMs);
				wake = () => {
					clearTimeout(t);
					r();
				};
			});
			wake = null;
		}
	}

	await db?.end();
	emit(opts.out, {
		kind: "summary",
		at: new Date().toISOString(),
		label: opts.label,
		env: opts.env,
		stoppedBy: stopping ? "signal" : "duration",
		runS: round1((Date.now() - t0) / 1000),
		...summary.toJson(),
	});
}

main().then(
	() => process.exit(0),
	(e: unknown) => {
		process.stderr.write(
			`[load-sampler] ${e instanceof Refusal ? "REFUSED" : "FAILED"}: ${errMsg(e)}\n`,
		);
		process.exit(2);
	},
);
