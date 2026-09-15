/**
 * SEED-DEPTH2 cleanup — shared pieces of `seed-snapshot.ts` and `seed-cleanup.ts`.
 *
 * ⚠ TEST BRANCH ONLY (`test/seed-depth2-load`, not merged). Deleting append-only
 * rows is what CLAUDE.md §2 and ADR-0053 ("Deleting selected rows with the
 * append-only triggers disabled was requested and refused") forbid. The operator
 * authorised it for THIS dummy test on 2026-09-15, relayed through the session
 * that commissioned these scripts. No ADR records that ruling; read the report
 * this branch carries before running either script anywhere but local.
 *
 * Plain tsx: its own `postgres()` client, never `@/db` (AGENTS.md §7). It reuses
 * the staging and prod-seed target constants so the production refusal and the
 * production match both still have exactly one place to be corrected.
 */
import { isAbsolute, relative, resolve } from "node:path";
import postgres from "postgres";

import { checkTestTargetNotProduction } from "../../tests/_setup/production-ref-guard";
import {
	EXPECTED_GUARD_CATALOG_ROWS,
	isAllowedStagingHost,
	PRODUCTION_PROJECT_REF,
	safeHost,
} from "../../tests/staging/_lib/guards";
import {
	assertLiveConnection,
	readGuardCatalog,
} from "../../tests/staging/_lib/reset";
import {
	LOOPBACK_HOSTS,
	resolveRunnerTarget,
} from "../../tests/staging/_lib/target";

export type Mode = "local" | "staging" | "prod";
export type Sql = postgres.Sql;
export type TxSql = postgres.TransactionSql;
export const MODES: readonly Mode[] = ["local", "staging", "prod"];

export const PROD_ACK_FLAG = "--ack-production";

export function die(message: string): never {
	console.error(`\nREFUSED — ${message}\n`);
	process.exit(1);
}

export function flag(
	argv: readonly string[],
	name: string,
): string | undefined {
	const at = argv.indexOf(name);
	if (at === -1) return undefined;
	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--"))
		die(`${name} needs a value`);
	return value;
}

/** Snapshots and reports hold row hashes and ids; keep them out of git. */
export function outsideRepo(path: string, what: string): string {
	const abs = resolve(path);
	const rel = relative(process.cwd(), abs);
	if (!rel.startsWith("..") && !isAbsolute(rel)) {
		die(`${what} ${abs} is inside the repository; use a path outside it`);
	}
	return abs;
}

// ── TARGET ──────────────────────────────────────────────────────────────────

export type CleanupTarget =
	| {
			readonly ok: true;
			readonly mode: Mode;
			readonly url: string;
			/** The project ref the live socket must carry; null for local. */
			readonly ref: string | null;
	  }
	| { readonly ok: false; readonly reason: string };

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * Pure. The same three doors the seed runner has (tests/prod-seed/_lib/target.ts),
 * minus the runner-only write token:
 *   local   — P-17, then a loopback `DATABASE_URL`.
 *   staging — P-17, then the staging resolver (`DATABASE_URL_STAGING`, the ref
 *             fragment, `ZUGZWANG_ENV=staging`), which refuses production first.
 *   prod    — a POSITIVE match: `--ack-production`, `ZUGZWANG_ENV=prod`,
 *             `DATABASE_URL` naming `PRODUCTION_PROJECT_REF` on a Supabase host.
 */
export function resolveCleanupTarget(
	mode: string | undefined,
	env: Readonly<Record<string, string | undefined>>,
	opts: { readonly ackProduction: boolean },
): CleanupTarget {
	if (!PRODUCTION_PROJECT_REF) {
		return { ok: false, reason: "PRODUCTION_PROJECT_REF is empty; refusing." };
	}
	if (mode === "local" || mode === "staging") {
		const p17 = checkTestTargetNotProduction(env);
		if (!p17.ok) return p17;
		if (mode === "staging") {
			const staged = resolveRunnerTarget(
				{ ...env, ZUGZWANG_STAGING_TARGET: "staging" },
				{ requireWriteIntent: false },
			);
			if (!staged.ok) return staged;
			return {
				ok: true,
				mode,
				url: staged.url,
				ref: env.STAGING_PROJECT_REF_FRAGMENT ?? null,
			};
		}
		const url = env.DATABASE_URL;
		if (!url) return { ok: false, reason: "DATABASE_URL is not set." };
		const host = hostOf(url);
		if (
			host === null ||
			!LOOPBACK_HOSTS.has(host) ||
			isAllowedStagingHost(host)
		)
			return {
				ok: false,
				reason: `local mode requires a loopback DATABASE_URL (saw ${JSON.stringify(host)}).`,
			};
		return { ok: true, mode, url, ref: null };
	}
	if (mode !== "prod") {
		return {
			ok: false,
			reason: `--env must be local | staging | prod (saw ${mode === undefined ? "unset" : JSON.stringify(mode)}); there is no default.`,
		};
	}
	if (!opts.ackProduction) {
		return {
			ok: false,
			reason: `prod mode requires ${PROD_ACK_FLAG}. This targets PRODUCTION.`,
		};
	}
	if (env.ZUGZWANG_ENV !== "prod") {
		return {
			ok: false,
			reason: `prod mode requires ZUGZWANG_ENV=prod (saw ${JSON.stringify(env.ZUGZWANG_ENV)}); run under doppler --config prd.`,
		};
	}
	const url = env.DATABASE_URL;
	if (!url) return { ok: false, reason: "DATABASE_URL is not set." };
	if (!url.includes(PRODUCTION_PROJECT_REF)) {
		return {
			ok: false,
			reason: "DATABASE_URL does not name the PRODUCTION project ref.",
		};
	}
	const host = hostOf(url);
	if (host === null || !isAllowedStagingHost(host)) {
		return {
			ok: false,
			reason: `DATABASE_URL dials ${JSON.stringify(host)}, not a Supabase host.`,
		};
	}
	return { ok: true, mode: "prod", url, ref: PRODUCTION_PROJECT_REF };
}

/** Open ONE connection and check the live socket before anything is read. */
export async function openTarget(
	target: Extract<CleanupTarget, { ok: true }>,
): Promise<Sql> {
	const sql = postgres(target.url, {
		max: 1,
		prepare: false,
		idle_timeout: 20,
		onnotice: () => {},
	});
	if (target.mode === "local") {
		const [row] = await sql<{ r: string }[]>`
			SELECT current_setting('session_replication_role') AS r`;
		if (row?.r !== "origin") {
			await sql.end();
			die(
				`session_replication_role is ${JSON.stringify(row?.r)}; no trigger would fire. Refusing.`,
			);
		}
	} else {
		if (!target.ref) die("no project ref to check the live socket against");
		// Asserts user@host carries the ref, a Supabase host, database `postgres`,
		// and session_replication_role = origin.
		await assertLiveConnection(sql, target.ref);
	}
	return sql;
}

export function describeTarget(
	target: Extract<CleanupTarget, { ok: true }>,
): string {
	return `${target.mode} · ${safeHost(target.url)}${target.ref ? ` · ref=${target.ref}` : ""}`;
}

// ── SESSION SETTINGS THAT MAKE `row::text` STABLE ───────────────────────────

/** Row hashes are md5(row::text); timestamptz text depends on these. */
export async function stabiliseRowText(sql: TxSql): Promise<void> {
	await sql.unsafe(
		"SET LOCAL TIME ZONE 'UTC'; SET LOCAL datestyle = 'ISO, YMD'; SET LOCAL intervalstyle = 'postgres'; SET LOCAL bytea_output = 'hex'",
	);
}

// ── CATALOGUE READS ─────────────────────────────────────────────────────────

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export function assertSafeIdentifier(name: string): string {
	if (!SAFE_IDENTIFIER.test(name))
		throw new Error(`unsafe identifier ${JSON.stringify(name)}`);
	return name;
}

/** Every ordinary and partitioned-parent table in `public` (partitions fold into their parent). */
export async function listTables(sql: Sql | TxSql): Promise<string[]> {
	const rows = await sql<{ name: string }[]>`
		SELECT c.relname AS name
		FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
		ORDER BY 1`;
	return rows.map((r) => assertSafeIdentifier(r.name));
}

/** Sorted md5(row::text) of every row matching `where` (default: all rows). */
export async function rowHashes(
	sql: Sql | TxSql,
	table: string,
	where?: postgres.PendingQuery<readonly (object | undefined)[]>,
): Promise<string[]> {
	const rows = await sql<{ h: string }[]>`
		SELECT md5(t::text) AS h FROM ${sql(assertSafeIdentifier(table))} t
		WHERE ${where ?? sql`TRUE`}
		ORDER BY 1`;
	return rows.map((r) => r.h);
}

export type GuardState = {
	readonly bucketCount: number;
	readonly bucketNotEnabled: readonly string[];
	readonly bucketNames: readonly string[];
	readonly lotsNoDelete: string | null;
};

export async function readGuards(sql: Sql | TxSql): Promise<GuardState> {
	const catalog = await readGuardCatalog(sql as unknown as Sql);
	const [lots] = await sql<{ enabled: string }[]>`
		SELECT t.tgenabled AS enabled FROM pg_trigger t
		JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relname = 'lots' AND t.tgname = 'lots_no_delete'`;
	return {
		bucketCount: catalog.length,
		bucketNotEnabled: catalog
			.filter((r) => r.enabled !== "O")
			.map((r) => `${r.table}.${r.trigger}=${r.enabled}`),
		bucketNames: catalog.map((r) => `${r.table}.${r.trigger}`),
		lotsNoDelete: lots?.enabled ?? null,
	};
}

export function guardProblems(g: GuardState): string[] {
	const out: string[] = [];
	if (g.bucketCount !== EXPECTED_GUARD_CATALOG_ROWS)
		out.push(
			`bucket_% guard catalogue has ${g.bucketCount} rows, expected ${EXPECTED_GUARD_CATALOG_ROWS}`,
		);
	if (g.bucketNotEnabled.length > 0)
		out.push(`bucket_% guards not enabled: ${g.bucketNotEnabled.join(", ")}`);
	if (g.lotsNoDelete !== "O")
		out.push(
			`lots.lots_no_delete is ${JSON.stringify(g.lotsNoDelete)}, expected "O"`,
		);
	return out;
}

/**
 * A value unique to one database and stable across its life: the liquidity
 * policy rows (uuidv7 ids minted at migration time), the freeze sentinel's
 * creation instant, and the migration ledger. A snapshot from another database
 * — staging's snapshot fed to a prod cleanup — does not match.
 */
export async function databaseFingerprint(sql: Sql | TxSql): Promise<string> {
	const [row] = await sql<{ f: string }[]>`
		SELECT md5(
			coalesce((SELECT string_agg(id::text || '@' || effective_from::text, ',' ORDER BY version) FROM liquidity_policy), '') || '|' ||
			coalesce((SELECT created_at::text FROM system_state WHERE id = 'system'), '') || '|' ||
			coalesce((SELECT string_agg(hash || '@' || created_at::text, ',' ORDER BY id) FROM drizzle.__drizzle_migrations), '')
		) AS f`;
	if (!row) throw new Error("fingerprint query returned no row");
	return row.f;
}

export type SequenceState = {
	name: string;
	lastValue: string;
	isCalled: boolean;
};

export async function readSequences(
	sql: Sql | TxSql,
): Promise<SequenceState[]> {
	const names = await sql<{ name: string }[]>`
		SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'S' ORDER BY 1`;
	const out: SequenceState[] = [];
	for (const { name } of names) {
		const [s] = await sql<{ last_value: string; is_called: boolean }[]>`
			SELECT last_value::text AS last_value, is_called FROM ${sql(assertSafeIdentifier(name))}`;
		if (s) out.push({ name, lastValue: s.last_value, isCalled: s.is_called });
	}
	return out;
}

/** I-LOT-SUM: Σ lots.surviving_shares == positions.quantity per (user, market, side). */
export async function lotSumViolations(sql: Sql | TxSql): Promise<number> {
	const [row] = await sql<{ n: number }[]>`
		SELECT count(*)::int AS n FROM (
			SELECT coalesce(l.user_id, p.user_id) u
			FROM (SELECT user_id, market_id, side, sum(surviving_shares) s FROM lots GROUP BY 1, 2, 3) l
			FULL OUTER JOIN positions p
				ON p.user_id = l.user_id AND p.market_id = l.market_id AND p.side = l.side
			WHERE coalesce(l.s, 0) <> coalesce(p.quantity, 0)
		) v`;
	return row?.n ?? -1;
}

/** Event references that no longer resolve (a bet.placed / comment.placed whose row is gone). */
export async function danglingEventRefs(sql: Sql | TxSql): Promise<number> {
	const [row] = await sql<{ n: number }[]>`
		SELECT count(*)::int AS n FROM events e
		WHERE (e.event_type = 'bet.placed' AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.id = e.aggregate_id))
		   OR (e.event_type = 'comment.placed' AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = e.aggregate_id))`;
	return row?.n ?? -1;
}

// ── SNAPSHOT SHAPE ──────────────────────────────────────────────────────────

export const SNAPSHOT_KIND = "zugzwang-seed-cleanup-snapshot";

export interface Snapshot {
	kind: typeof SNAPSHOT_KIND;
	version: 1;
	mode: Mode;
	target: string;
	/** DB `now()` of the snapshot's transaction — T0. */
	takenAt: string;
	pgSnapshot: string;
	fingerprint: string;
	guards: GuardState;
	systemState: { id: string; frozen_at: string | null }[];
	liquidityPolicyInForce: Record<string, unknown> | null;
	identityPool: { total: number; free: number };
	pools: {
		id: string;
		market_id: string;
		yes_reserves: string;
		no_reserves: string;
		hash: string;
	}[];
	markets: Record<string, unknown>[];
	watermarkState: { metric: string; state: string; since: string }[];
	cronAlarms: { id: string; alarm_id: string; hash: string }[];
	liquidityHeartbeatMaxId: string | null;
	dharmaLedgerMaxSeq: string | null;
	sequences: SequenceState[];
	events: {
		count: number;
		maxCreatedAt: string | null;
		perPartition: { partition: string; count: number }[];
	};
	migrations: number;
	/** Seed markers already present at T0 (any run): a cleanup of such a run refuses. */
	seedMarkers: { accountIds: string[]; receiptKeyPrefixes: string[] };
	lotSumViolations: number;
	danglingEventRefs: number;
	tables: Record<string, { count: number; hashes: string[] }>;
}

export function isSnapshot(v: unknown): v is Snapshot {
	return (
		typeof v === "object" &&
		v !== null &&
		(v as { kind?: unknown }).kind === SNAPSHOT_KIND &&
		(v as { version?: unknown }).version === 1
	);
}

/** Read everything the cleanup compares against. Call inside a read-only REPEATABLE READ tx. */
export async function readSnapshot(
	sql: TxSql,
	mode: Mode,
	target: string,
): Promise<Snapshot> {
	await stabiliseRowText(sql);
	const [t0] = await sql<{ now: string; snap: string }[]>`
		SELECT now()::text AS now, pg_current_snapshot()::text AS snap`;
	if (!t0) throw new Error("now() returned no row");

	const tables: Snapshot["tables"] = {};
	for (const table of await listTables(sql)) {
		const hashes = await rowHashes(sql, table);
		tables[table] = { count: hashes.length, hashes };
	}

	const [policy] = await sql<Record<string, unknown>[]>`
		SELECT to_jsonb(p) AS j FROM liquidity_policy p WHERE effective_from <= now()
		ORDER BY effective_from DESC, version DESC LIMIT 1`;
	const [pool] = await sql<{ total: number; free: number }[]>`
		SELECT count(*)::int AS total, count(*) FILTER (WHERE assigned_at IS NULL)::int AS free FROM identity_pool`;
	const [maxes] = await sql<
		{
			hb: string | null;
			seq: string | null;
			ev_n: number;
			ev_max: string | null;
		}[]
	>`
		SELECT (SELECT max(id)::text FROM liquidity_heartbeat) AS hb,
		       (SELECT max(seq)::text FROM dharma_ledger) AS seq,
		       (SELECT count(*)::int FROM events) AS ev_n,
		       (SELECT max(created_at)::text FROM events) AS ev_max`;
	const [migrations] = await sql<{ n: number }[]>`
		SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;

	return {
		kind: SNAPSHOT_KIND,
		version: 1,
		mode,
		target,
		takenAt: t0.now,
		pgSnapshot: t0.snap,
		fingerprint: await databaseFingerprint(sql),
		guards: await readGuards(sql),
		systemState:
			await sql`SELECT id, frozen_at::text FROM system_state ORDER BY id`,
		liquidityPolicyInForce: (policy?.j as Record<string, unknown>) ?? null,
		identityPool: { total: pool?.total ?? 0, free: pool?.free ?? 0 },
		pools: await sql`
			SELECT id::text, market_id::text, yes_reserves::text, no_reserves::text, md5(p::text) AS hash
			FROM pools p ORDER BY id`,
		markets: await sql`
			SELECT id::text, slug, status::text, resolution_deadline::text, resolved_at::text,
			       resolution_outcome::text, md5(m::text) AS hash
			FROM markets m ORDER BY id`,
		watermarkState: await sql`
			SELECT metric, state, since::text FROM watermark_state ORDER BY metric`,
		cronAlarms: await sql`
			SELECT id::text, alarm_id, md5(a::text) AS hash FROM cron_alarms a ORDER BY id`,
		liquidityHeartbeatMaxId: maxes?.hb ?? null,
		dharmaLedgerMaxSeq: maxes?.seq ?? null,
		sequences: await readSequences(sql),
		events: {
			count: maxes?.ev_n ?? 0,
			maxCreatedAt: maxes?.ev_max ?? null,
			perPartition: await sql`
				SELECT tableoid::regclass::text AS partition, count(*)::int AS count
				FROM events GROUP BY 1 ORDER BY 1`,
		},
		migrations: migrations?.n ?? 0,
		seedMarkers: {
			accountIds: (
				await sql<{ a: string }[]>`
					SELECT account_id AS a FROM accounts
					WHERE provider_id = 'google' AND starts_with(account_id, 'dummy-seed-sub-') ORDER BY 1`
			).map((r) => r.a),
			receiptKeyPrefixes: (
				await sql<{ p: string }[]>`
					SELECT DISTINCT split_part(idempotency_key, '.', 1) || '.' || split_part(idempotency_key, '.', 2) || '.' AS p
					FROM bet_receipts WHERE starts_with(idempotency_key, 'seed.') ORDER BY 1`
			).map((r) => r.p),
		},
		lotSumViolations: await lotSumViolations(sql),
		danglingEventRefs: await danglingEventRefs(sql),
		tables,
	};
}

/** Multiset difference a − b over sorted-or-not string lists. */
export function multisetMinus(
	a: readonly string[],
	b: readonly string[],
): string[] {
	const counts = new Map<string, number>();
	for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
	const out: string[] = [];
	for (const x of a) {
		const n = counts.get(x) ?? 0;
		if (n > 0) counts.set(x, n - 1);
		else out.push(x);
	}
	return out;
}
