/**
 * SEED-DEPTH2 — remove ONE seed run and restore the database to its pre-seed snapshot.
 *
 * ⚠⚠ TEST BRANCH ONLY, AND IT DELETES APPEND-ONLY ROWS. CLAUDE.md §2 and ADR-0053
 * forbid this; the operator authorised it for this dummy test only (see
 * `_cleanup-lib.ts`). It exists so a load test on a live database is reversible.
 *
 *   pnpm exec tsx scripts/seed/seed-cleanup.ts --env local --snapshot <snap.json> --run-id <id> [--manifest <manifest-local.json>]
 *   pnpm exec tsx scripts/seed/seed-cleanup.ts --env local --snapshot … --run-id … --execute
 *   (staging) doppler run --project zugzwang-experiment --config stg -- pnpm exec tsx scripts/seed/seed-cleanup.ts --env staging … --execute --i-understand-this-deletes-append-only-rows
 *   (prod)    doppler run --project zugzwang-experiment --config prd -- pnpm exec tsx scripts/seed/seed-cleanup.ts --env prod --ack-production … --execute --i-understand-this-deletes-append-only-rows   (+ a typed phrase)
 *
 * DEFAULT IS A DRY RUN: a read-only transaction that prints what would be removed
 * and restored, per table, and every refusal. `--execute` re-does the analysis
 * inside ONE read-committed transaction that first takes SHARE ROW EXCLUSIVE locks
 * on every table involved (writers wait; readers do not), and:
 *
 *   1. REFUSES if anything other than this run changed since T0 — decided by
 *      comparing every public table's row hashes, minus this run's rows, with the
 *      snapshot. Three families of difference are expected and handled, never
 *      silently: the pools the seed moved (restored), the identity tuples the seed
 *      consumed (un-consumed), and operational rows (watermarks restored; alarms
 *      the seed caused deleted; heartbeats and other alarms kept and listed).
 *   2. Identifies seed users by the Google account sub prefix
 *      `dummy-seed-sub-<runId>-` and seed bets by the receipt key prefix
 *      `seed.<runId>.`, requires the two to agree, and cross-checks the manifest.
 *   3. Disables ONLY the named guard triggers on the tables that hold rows to
 *      remove (never `session_replication_role`, which would also stop FK
 *      enforcement), removes rows in FK order, re-enables them.
 *   4. Verifies before COMMIT: all 81 `bucket_%` guards and `lots_no_delete`
 *      enabled; no seed residue; every table's hashes equal to the snapshot (bar
 *      the listed operational rows); I-LOT-SUM and dangling references unchanged;
 *      `check_nightly_drift()` (run in a rolled-back savepoint) raises nothing it
 *      did not raise before. Any failure → ROLLBACK, exit 1.
 *
 * Because the DISABLE statements run inside that transaction, a crash, a killed
 * process or a dropped socket rolls them back: the guards are never committed off.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

import {
	danglingEventRefs,
	databaseFingerprint,
	describeTarget,
	die,
	flag,
	guardProblems,
	isSnapshot,
	listTables,
	lotSumViolations,
	type Mode,
	multisetMinus,
	openTarget,
	outsideRepo,
	PROD_ACK_FLAG,
	readGuards,
	readSequences,
	resolveCleanupTarget,
	rowHashes,
	type SequenceState,
	type Snapshot,
	type Sql,
	stabiliseRowText,
	type TxSql,
} from "./_cleanup-lib";

const EXECUTE_ACK_FLAG = "--i-understand-this-deletes-append-only-rows";

/** Event types the seed path writes (tests/prod-seed/seed.prod-seed.test.ts). */
const SEED_EVENT_TYPES = new Set([
	"user.pseudonym_assigned",
	"user.tos_accepted",
	"user.oauth_signed_in",
	"dharma.granted",
	"dharma.credited",
	"bet.placed",
	"comment.placed",
	"image_upload.sign_requested",
	"image_upload.committed",
]);

/** Tables whose other (non-seed) changes are reported, never refused. */
const AUTH_PLANE = new Set([
	"sessions",
	"accounts",
	"verifications",
	"admin_sessions",
]);
/** Tables whose post-cleanup content is not asserted: nothing here locks them. */
const UNASSERTED = new Set([
	"verifications",
	"admin_sessions",
	"liquidity_heartbeat",
]);

/** watermark metric → the alarm its transition raises (0007, 0027). */
const WATERMARK_ALARM: Record<string, string> = {
	identity_pool_unassigned: "identity_pool_low_watermark",
	liquidity_silence: "liquidity_silence",
	liquidity_undershoot: "liquidity_undershoot",
};

/** Every table the execute transaction write-locks. Not liquidity_heartbeat: pg_cron may keep beating. */
const LOCKED_TABLES = [
	"users",
	"accounts",
	"sessions",
	"identity_pool",
	"markets",
	"pools",
	"market_media",
	"bets",
	"comments",
	"bet_receipts",
	"positions",
	"lots",
	"dharma_ledger",
	"events",
	"image_uploads",
	"bookmarks",
	"mod_actions",
	"user_events",
	"admin_events",
	"payout_events",
	"resolution_events",
	"watermark_state",
	"cron_alarms",
	"system_state",
	"liquidity_policy",
];

class Refused extends Error {
	constructor(readonly reasons: string[]) {
		super(`refused (${reasons.length})`);
	}
}

// ── PLAN ────────────────────────────────────────────────────────────────────

interface Plan {
	runId: string;
	seedUsers: string[];
	orphanUsers: string[];
	bets: { id: string; commentId: string; marketId: string; key: string }[];
	commentsByDepth: Record<string, string[]>;
	uploads: { id: string; r2Key: string }[];
	seedEvents: { id: string; type: string; partition: string }[];
	injectorEvents: { id: string; marketId: string; partition: string }[];
	seedHashes: Record<string, string[]>;
	preHashes: Record<string, string[]>;
	poolRestores: {
		id: string;
		marketId: string;
		now: { yes: string; no: string };
		snapshot: { yes: string; no: string };
	}[];
	identityUnconsume: {
		id: string;
		pseudonym: string;
		reason: "seed" | "stranded";
	}[];
	watermarkRestores: {
		metric: string;
		now: string | null;
		snapshot: string | null;
	}[];
	cronAlarmDeletes: {
		id: string;
		alarmId: string;
		hash: string;
		why: string;
	}[];
	cronAlarmsKept: { id: string; alarmId: string; why: string }[];
	kept: Record<string, { added: number; removed: number }>;
	sequenceRestores: SequenceState[];
	sequenceNotes: string[];
	triggers: [table: string, trigger: string][];
	refusals: string[];
}

function uniq(xs: readonly string[]): string[] {
	return [...new Set(xs)];
}

function sorted(xs: readonly string[]): string[] {
	return [...xs].sort();
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	const x = sorted(a);
	const y = sorted(b);
	return x.every((v, i) => v === y[i]);
}

interface Manifest {
	runId?: string;
	mode?: string;
	accounts?: { userId?: string }[];
	bets?: { betId?: string; commentId?: string; key?: string | null }[];
	foreignUnderPrefix?: unknown[];
}

async function analyse(
	tx: TxSql,
	snap: Snapshot,
	runId: string,
	manifest: Manifest | null,
): Promise<Plan> {
	const refusals: string[] = [];
	const T0 = snap.takenAt;
	const accountPrefix = `dummy-seed-sub-${runId}-`;
	const keyPrefix = `seed.${runId}.`;
	const emailPattern = `dummy-seed-${runId}-%@seed.example.com`;

	// ── Preconditions that stop everything ─────────────────────────────────
	if ((await databaseFingerprint(tx)) !== snap.fingerprint) {
		throw new Refused([
			"the snapshot was taken from a DIFFERENT database (fingerprint mismatch).",
		]);
	}
	const frozen = await tx<{ id: string }[]>`
		SELECT id FROM system_state WHERE frozen_at IS NOT NULL`;
	if (frozen.length > 0) {
		throw new Refused([
			"the conclusion freeze is set; nothing is written (CLAUDE.md §3, BREAK_GLASS.md only).",
		]);
	}
	const guardIssues = guardProblems(await readGuards(tx));
	if (guardIssues.length > 0) {
		throw new Refused([
			`guards are not all present and enabled BEFORE cleanup: ${guardIssues.join("; ")}`,
		]);
	}
	if (snap.seedMarkers.accountIds.some((a) => a.startsWith(accountPrefix))) {
		refusals.push(
			`run ${runId} already had accounts at T0 — the snapshot was taken after this run began, so it cannot restore the pre-seed state.`,
		);
	}
	if (snap.seedMarkers.receiptKeyPrefixes.includes(keyPrefix)) {
		refusals.push(
			`run ${runId} already had receipts at T0 (snapshot taken after the run began).`,
		);
	}

	// ── Seed users: by account sub, cross-checked against users.google_id + email ─
	const accountRows = await tx<
		{
			user_id: string;
			account_id: string;
			google_id: string | null;
			email: string;
			after: boolean;
		}[]
	>`
		SELECT a.user_id::text, a.account_id, u.google_id, u.email, u.created_at >= ${T0}::timestamptz AS after
		FROM accounts a JOIN users u ON u.id = a.user_id
		WHERE a.provider_id = 'google' AND starts_with(a.account_id, ${accountPrefix})`;
	for (const a of accountRows) {
		if (
			a.google_id !== a.account_id ||
			!a.email.startsWith(`dummy-seed-${runId}-`)
		) {
			refusals.push(
				`account ${a.account_id} belongs to user ${a.user_id} whose google_id/email do not carry the same run (${a.google_id}, ${a.email}).`,
			);
		}
		if (!a.after)
			refusals.push(`seed user ${a.user_id} was created before T0.`);
	}
	const otherAccounts = await tx<{ user_id: string }[]>`
		SELECT a.user_id::text FROM accounts a
		WHERE a.user_id = ANY(${tx.array(accountRows.map((a) => a.user_id))}::uuid[])
		  AND NOT (a.provider_id = 'google' AND starts_with(a.account_id, ${accountPrefix}))`;
	if (otherAccounts.length > 0) {
		refusals.push(
			`seed users hold ${otherAccounts.length} account(s) that are not seed accounts: ${uniq(otherAccounts.map((r) => r.user_id)).join(", ")}.`,
		);
	}
	// A crash between Better Auth's two INSERTs leaves a user row with no account.
	const orphanRows = await tx<{ id: string; after: boolean }[]>`
		SELECT u.id::text, u.created_at >= ${T0}::timestamptz AS after FROM users u
		WHERE starts_with(u.google_id, ${accountPrefix}) AND u.email LIKE ${emailPattern}
		  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id)`;
	for (const o of orphanRows)
		if (!o.after)
			refusals.push(`orphan seed user ${o.id} was created before T0.`);
	const strays = await tx<{ id: string }[]>`
		SELECT u.id::text FROM users u
		WHERE (u.email LIKE ${emailPattern} OR starts_with(u.google_id, ${accountPrefix}))
		  AND u.id <> ALL(${tx.array([...accountRows.map((a) => a.user_id), ...orphanRows.map((o) => o.id)])}::uuid[])`;
	if (strays.length > 0) {
		refusals.push(
			`users carrying this run's email or sub but matching neither rule: ${strays.map((s) => s.id).join(", ")}.`,
		);
	}
	const seedUsers = uniq([
		...accountRows.map((a) => a.user_id),
		...orphanRows.map((o) => o.id),
	]);
	const seedArr = tx.array(seedUsers);

	// ── Seed bets: receipts by key prefix must be exactly the seed users' receipts ─
	const receipts = await tx<{ key: string; user_id: string; flow: string }[]>`
		SELECT idempotency_key AS key, user_id::text, flow FROM bet_receipts
		WHERE starts_with(idempotency_key, ${keyPrefix}) OR user_id = ANY(${seedArr}::uuid[])`;
	const seedSet = new Set(seedUsers);
	for (const r of receipts) {
		if (!r.key.startsWith(keyPrefix))
			refusals.push(
				`seed user ${r.user_id} holds a receipt outside the run's key prefix (${r.key}).`,
			);
		else if (!seedSet.has(r.user_id))
			refusals.push(
				`receipt ${r.key} is under the run's prefix but belongs to NON-seed user ${r.user_id}.`,
			);
		if (r.flow !== "place")
			refusals.push(`receipt ${r.key} is a ${r.flow}, not a place.`);
	}
	const betRows = await tx<
		{
			id: string;
			comment_id: string;
			market_id: string;
			key: string | null;
			user_id: string;
		}[]
	>`
		SELECT id::text, comment_id::text, market_id::text, idempotency_key AS key, user_id::text FROM bets
		WHERE user_id = ANY(${seedArr}::uuid[]) OR starts_with(idempotency_key, ${keyPrefix})`;
	for (const b of betRows) {
		if (!seedSet.has(b.user_id))
			refusals.push(
				`bet ${b.id} is under the run's key prefix but was placed by NON-seed user ${b.user_id}.`,
			);
		if (b.key === null || !b.key.startsWith(keyPrefix))
			refusals.push(
				`seed user ${b.user_id} placed bet ${b.id} without the run's key (${b.key}).`,
			);
	}
	if (
		!sameList(
			betRows.map((b) => b.key ?? ""),
			receipts.map((r) => r.key),
		)
	) {
		refusals.push(
			`bets (${betRows.length}) and receipts (${receipts.length}) under this run do not correspond one to one.`,
		);
	}

	// ── Seed comments: exactly the bets' comments (INV-1), depth from the tree ─
	const commentRows = await tx<
		{
			id: string;
			bet_id: string | null;
			upload: string | null;
			depth: number | null;
		}[]
	>`
		WITH RECURSIVE tree AS (
			SELECT id, 0 AS depth FROM comments WHERE parent_comment_id IS NULL
			UNION ALL
			SELECT c.id, t.depth + 1 FROM comments c JOIN tree t ON c.parent_comment_id = t.id
		)
		SELECT c.id::text, c.bet_id::text, c.image_uploads_id::text AS upload, t.depth
		FROM comments c LEFT JOIN tree t ON t.id = c.id
		WHERE c.user_id = ANY(${seedArr}::uuid[])`;
	if (
		!sameList(
			commentRows.map((c) => c.id),
			betRows.map((b) => b.comment_id),
		)
	) {
		refusals.push(
			"seed comments are not exactly the seed bets' comments (INV-1 pairing broken).",
		);
	}
	const commentsByDepth: Record<string, string[]> = {};
	for (const c of commentRows) {
		if (c.bet_id !== null)
			refusals.push(
				`seed comment ${c.id} has bet_id set; the FK order below assumes it is NULL.`,
			);
		if (c.depth === null)
			refusals.push(
				`seed comment ${c.id} is not reachable from a root comment.`,
			);
		const d = String(c.depth ?? -1);
		commentsByDepth[d] = [...(commentsByDepth[d] ?? []), c.id];
	}
	const foreignReplies = await tx<{ id: string; user_id: string }[]>`
		SELECT id::text, user_id::text FROM comments
		WHERE parent_comment_id = ANY(${tx.array(commentRows.map((c) => c.id))}::uuid[])
		  AND user_id <> ALL(${seedArr}::uuid[])`;
	for (const r of foreignReplies)
		refusals.push(
			`NON-seed user ${r.user_id} replied to seed content (comment ${r.id}).`,
		);

	const uploads = await tx<{ id: string; r2_object_key: string }[]>`
		SELECT id::text, r2_object_key FROM image_uploads WHERE user_id = ANY(${seedArr}::uuid[])`;

	// ── Seed events: actor AND aggregate both belong to the run ─────────────
	const aggregates = new Set([
		...seedUsers,
		...betRows.map((b) => b.id),
		...commentRows.map((c) => c.id),
		...uploads.map((u) => u.id),
	]);
	const eventRows = await tx<
		{
			id: string;
			type: string;
			aggregate: string;
			actor: string | null;
			partition: string;
		}[]
	>`
		SELECT event_id::text AS id, event_type AS type, aggregate_id::text AS aggregate,
		       metadata->>'user_id' AS actor, tableoid::regclass::text AS partition
		FROM events
		WHERE metadata->>'user_id' = ANY(${seedArr}) OR aggregate_id = ANY(${tx.array([...aggregates])}::uuid[])`;
	const seedEvents: Plan["seedEvents"] = [];
	for (const e of eventRows) {
		const orphanSweep =
			e.type === "image_upload.orphaned" &&
			uploads.some((u) => u.id === e.aggregate);
		const ok =
			orphanSweep ||
			(SEED_EVENT_TYPES.has(e.type) &&
				e.actor !== null &&
				seedSet.has(e.actor) &&
				aggregates.has(e.aggregate));
		if (ok) seedEvents.push({ id: e.id, type: e.type, partition: e.partition });
		else
			refusals.push(
				`event ${e.id} (${e.type}) touches the run but is not the run's own (actor ${e.actor}, aggregate ${e.aggregate}).`,
			);
	}

	// ── Per-table diff against the snapshot, seed rows excluded ─────────────
	const seedWhere: Record<string, ReturnType<typeof tx>> = {
		users: tx`id = ANY(${seedArr}::uuid[])`,
		accounts: tx`user_id = ANY(${seedArr}::uuid[])`,
		sessions: tx`user_id = ANY(${seedArr}::uuid[])`,
		bets: tx`user_id = ANY(${seedArr}::uuid[])`,
		bet_receipts: tx`user_id = ANY(${seedArr}::uuid[])`,
		comments: tx`user_id = ANY(${seedArr}::uuid[])`,
		positions: tx`user_id = ANY(${seedArr}::uuid[])`,
		lots: tx`user_id = ANY(${seedArr}::uuid[])`,
		dharma_ledger: tx`user_id = ANY(${seedArr}::uuid[])`,
		image_uploads: tx`user_id = ANY(${seedArr}::uuid[])`,
		events: tx`event_id = ANY(${tx.array(seedEvents.map((e) => e.id))}::uuid[])`,
	};
	const tables = await listTables(tx);
	const newTables = tables.filter((t) => !(t in snap.tables));
	const goneTables = Object.keys(snap.tables).filter(
		(t) => !tables.includes(t),
	);
	if (newTables.length || goneTables.length)
		throw new Refused([
			`the table set changed since T0 (+${newTables.join(",")} −${goneTables.join(",")}).`,
		]);

	const seedHashes: Record<string, string[]> = {};
	const preHashes: Record<string, string[]> = {};
	const added: Record<string, string[]> = {};
	const removed: Record<string, string[]> = {};
	for (const t of tables) {
		preHashes[t] = await rowHashes(tx, t);
		const where = seedWhere[t];
		seedHashes[t] = where ? await rowHashes(tx, t, where) : [];
		const nonSeed = multisetMinus(preHashes[t], seedHashes[t]);
		added[t] = multisetMinus(nonSeed, snap.tables[t]?.hashes ?? []);
		removed[t] = multisetMinus(snap.tables[t]?.hashes ?? [], nonSeed);
	}
	const describe = async (t: string, hashes: string[]) =>
		hashes.length === 0
			? []
			: (
					await tx<{ d: unknown }[]>`
						SELECT jsonb_strip_nulls(jsonb_build_object(
							'id', j->'id', 'event_id', j->'event_id', 'event_type', j->'event_type',
							'metric', j->'metric', 'alarm_id', j->'alarm_id', 'user_id', j->'user_id',
							'market_id', j->'market_id', 'slug', j->'slug', 'status', j->'status',
							'created_at', j->'created_at', 'updated_at', j->'updated_at')) AS d
						FROM (SELECT to_jsonb(t) AS j FROM ${tx(t)} t WHERE md5(t::text) = ANY(${tx.array(hashes.slice(0, 10))})) s`
				).map((r) => JSON.stringify(r.d));

	const kept: Plan["kept"] = {};
	const handled = new Set<string>();

	// events: only the injector's own new rows are explained (and removed, with their pool restored).
	const injectorEvents: Plan["injectorEvents"] = [];
	if ((added.events ?? []).length > 0) {
		const rows = await tx<
			{
				id: string;
				type: string;
				flow: string | null;
				market: string;
				partition: string;
				h: string;
			}[]
		>`
			SELECT event_id::text AS id, event_type AS type, metadata->>'flow_id' AS flow,
			       aggregate_id::text AS market, tableoid::regclass::text AS partition, md5(t::text) AS h
			FROM events t WHERE md5(t::text) = ANY(${tx.array(added.events ?? [])})`;
		const other: string[] = [];
		for (const r of rows) {
			if (
				r.type === "pool.liquidity_added" &&
				r.flow === "F-CRON-LIQUIDITY-INJECT"
			)
				injectorEvents.push({
					id: r.id,
					marketId: r.market,
					partition: r.partition,
				});
			else other.push(r.h);
		}
		if (other.length > 0)
			refusals.push(
				`events: ${other.length} NON-seed event(s) since T0: ${(await describe("events", other)).join(" ")}`,
			);
	}
	if ((removed.events ?? []).length > 0)
		refusals.push(
			`events: ${removed.events?.length} row(s) present at T0 are gone.`,
		);
	handled.add("events");

	// pools: moved by seed bets or by the injector → restored from the snapshot.
	const poolRestores: Plan["poolRestores"] = [];
	if ((added.pools ?? []).length > 0 || (removed.pools ?? []).length > 0) {
		const moved = new Set([
			...betRows.map((b) => b.market_id),
			...injectorEvents.map((e) => e.marketId),
		]);
		const rows = await tx<
			{ id: string; market_id: string; yes: string; no: string }[]
		>`
			SELECT id::text, market_id::text, yes_reserves::text AS yes, no_reserves::text AS no
			FROM pools p WHERE md5(p::text) = ANY(${tx.array(added.pools ?? [])})`;
		for (const r of rows) {
			const was = snap.pools.find((p) => p.id === r.id);
			if (!was) refusals.push(`pools: pool ${r.id} did not exist at T0.`);
			else if (!moved.has(r.market_id))
				refusals.push(
					`pools: pool of market ${r.market_id} changed since T0 with no seed bet and no injection on it.`,
				);
			else
				poolRestores.push({
					id: r.id,
					marketId: r.market_id,
					now: { yes: r.yes, no: r.no },
					snapshot: { yes: was.yes_reserves, no: was.no_reserves },
				});
		}
		const restoredIds = new Set(poolRestores.map((p) => p.id));
		const removedIds = snap.pools
			.filter((p) => (removed.pools ?? []).includes(p.hash))
			.map((p) => p.id);
		if (
			removedIds.length !== (removed.pools ?? []).length ||
			!removedIds.every((id) => restoredIds.has(id))
		)
			refusals.push(
				"pools: the rows changed since T0 are not exactly the rows being restored.",
			);
	}
	handled.add("pools");

	// identity_pool: tuples consumed since T0 by seed users (or stranded by a failed create) → un-consumed.
	const identityUnconsume: Plan["identityUnconsume"] = [];
	{
		const rows = await tx<
			{
				id: string;
				pseudonym: string;
				after: boolean | null;
				owner: string | null;
			}[]
		>`
			SELECT ip.id::text, ip.colour || ip.animal || lpad(ip.number::text, 3, '0') AS pseudonym,
			       ip.assigned_at >= ${T0}::timestamptz AS after, u.id::text AS owner
			FROM identity_pool ip
			LEFT JOIN users u ON u.pseudonym = ip.colour || ip.animal || lpad(ip.number::text, 3, '0')
			WHERE md5(ip::text) = ANY(${tx.array(added.identity_pool ?? [])})`;
		for (const r of rows) {
			if (r.after !== true)
				refusals.push(
					`identity_pool: tuple ${r.pseudonym} changed since T0 but was not consumed after T0.`,
				);
			else if (r.owner === null)
				identityUnconsume.push({
					id: r.id,
					pseudonym: r.pseudonym,
					reason: "stranded",
				});
			else if (seedSet.has(r.owner))
				identityUnconsume.push({
					id: r.id,
					pseudonym: r.pseudonym,
					reason: "seed",
				});
			else
				refusals.push(
					`identity_pool: tuple ${r.pseudonym} was consumed since T0 by NON-seed user ${r.owner}.`,
				);
		}
		if ((removed.identity_pool ?? []).length !== rows.length)
			refusals.push(
				"identity_pool: rows changed since T0 do not pair one to one with the snapshot.",
			);
		const seedTuples = identityUnconsume.filter(
			(u) => u.reason === "seed",
		).length;
		if (seedTuples !== seedUsers.length)
			refusals.push(
				`identity_pool: ${seedUsers.length} seed users but ${seedTuples} tuples consumed by them since T0.`,
			);
	}
	handled.add("identity_pool");

	// watermark_state: restored to the snapshot; alarms raised by a restored transition go with it.
	const watermarkRestores: Plan["watermarkRestores"] = [];
	{
		const now = await tx<{ metric: string; state: string; since: string }[]>`
			SELECT metric, state, since::text FROM watermark_state`;
		const metrics = uniq([
			...now.map((r) => r.metric),
			...snap.watermarkState.map((r) => r.metric),
		]);
		for (const m of metrics) {
			const a = now.find((r) => r.metric === m);
			const b = snap.watermarkState.find((r) => r.metric === m);
			const as = a ? `${a.state}@${a.since}` : null;
			const bs = b ? `${b.state}@${b.since}` : null;
			if (as !== bs)
				watermarkRestores.push({ metric: m, now: as, snapshot: bs });
		}
	}
	handled.add("watermark_state");

	// cron_alarms: new rows raised by a restored watermark or naming a seed user are removed; the rest are kept.
	const cronAlarmDeletes: Plan["cronAlarmDeletes"] = [];
	const cronAlarmsKept: Plan["cronAlarmsKept"] = [];
	{
		const restoredAlarmIds = new Set(
			watermarkRestores
				.map((w) => WATERMARK_ALARM[w.metric])
				.filter((x): x is string => Boolean(x)),
		);
		const now = await tx<
			{ id: string; alarm_id: string; user_id: string | null; h: string }[]
		>`
			SELECT id::text, alarm_id, payload->>'user_id' AS user_id, md5(a::text) AS h FROM cron_alarms a`;
		const atT0 = new Map(snap.cronAlarms.map((a) => [a.id, a]));
		for (const r of now) {
			const was = atT0.get(r.id);
			if (!was) {
				if (restoredAlarmIds.has(r.alarm_id))
					cronAlarmDeletes.push({
						id: r.id,
						alarmId: r.alarm_id,
						hash: r.h,
						why: "raised by a watermark transition being restored",
					});
				else if (r.user_id !== null && seedSet.has(r.user_id))
					cronAlarmDeletes.push({
						id: r.id,
						alarmId: r.alarm_id,
						hash: r.h,
						why: "names a seed user",
					});
				else
					cronAlarmsKept.push({
						id: r.id,
						alarmId: r.alarm_id,
						why: "raised since T0, not attributable to the seed",
					});
			} else if (was.hash !== r.h) {
				cronAlarmsKept.push({
					id: r.id,
					alarmId: r.alarm_id,
					why: "existed at T0; changed since (processed_at stamped by the drain)",
				});
			}
		}
		for (const a of snap.cronAlarms)
			if (!now.some((r) => r.id === a.id))
				cronAlarmsKept.push({
					id: a.id,
					alarmId: a.alarm_id,
					why: "existed at T0; no longer present",
				});
	}
	handled.add("cron_alarms");

	for (const t of [...AUTH_PLANE, "liquidity_heartbeat"]) {
		if ((added[t] ?? []).length || (removed[t] ?? []).length)
			kept[t] = {
				added: added[t]?.length ?? 0,
				removed: removed[t]?.length ?? 0,
			};
		handled.add(t);
	}

	// Every other table must be exactly the snapshot once the seed rows are removed.
	for (const t of tables) {
		if (handled.has(t)) continue;
		if ((added[t] ?? []).length > 0)
			refusals.push(
				`${t}: ${added[t]?.length} NON-seed row version(s) since T0: ${(await describe(t, added[t] ?? [])).join(" ")}`,
			);
		if ((removed[t] ?? []).length > 0)
			refusals.push(
				`${t}: ${removed[t]?.length} row version(s) present at T0 are gone or changed.`,
			);
	}

	// ── Manifest cross-check ────────────────────────────────────────────────
	if (manifest) {
		if (manifest.runId !== runId)
			refusals.push(`manifest is for run ${manifest.runId}, not ${runId}.`);
		if (manifest.mode !== snap.mode)
			refusals.push(
				`manifest mode ${manifest.mode} ≠ snapshot mode ${snap.mode}.`,
			);
		if ((manifest.foreignUnderPrefix ?? []).length > 0)
			refusals.push(
				`manifest lists ${manifest.foreignUnderPrefix?.length} FOREIGN bet(s) under the run's prefix.`,
			);
		const mUsers = (manifest.accounts ?? []).map((a) => a.userId ?? "");
		if (
			!sameList(
				mUsers,
				accountRows.map((a) => a.user_id),
			)
		)
			refusals.push(
				`manifest accounts (${mUsers.length}) ≠ database seed accounts (${accountRows.length}).`,
			);
		const mBets = (manifest.bets ?? []).map(
			(b) => `${b.betId}/${b.commentId}/${b.key}`,
		);
		if (
			!sameList(
				mBets,
				betRows.map((b) => `${b.id}/${b.comment_id}/${b.key}`),
			)
		)
			refusals.push(
				`manifest bets (${mBets.length}) ≠ database seed bets (${betRows.length}).`,
			);
	}

	// ── Sequences ───────────────────────────────────────────────────────────
	const sequenceRestores: SequenceState[] = [];
	const sequenceNotes: string[] = [];
	const nowSeqs = await readSequences(tx);
	for (const s of snap.sequences) {
		const n = nowSeqs.find((x) => x.name === s.name);
		if (!n || (n.lastValue === s.lastValue && n.isCalled === s.isCalled))
			continue;
		if (s.name === "dharma_ledger_seq_seq") sequenceRestores.push(s);
		else
			sequenceNotes.push(
				`${s.name}: ${s.lastValue}/${s.isCalled} at T0, ${n.lastValue}/${n.isCalled} now — left as is (ids may already be referenced outside the database).`,
			);
	}

	// ── The exact guards this plan must disable ─────────────────────────────
	const triggers: Plan["triggers"] = [];
	for (const p of uniq(
		[...seedEvents, ...injectorEvents].map((e) => e.partition),
	))
		triggers.push([p, "bucket_a_no_delete"]);
	if (receipts.length) triggers.push(["bet_receipts", "bucket_a_no_delete"]);
	if ((seedHashes.dharma_ledger ?? []).length)
		triggers.push(["dharma_ledger", "bucket_a_no_delete"]);
	if ((seedHashes.lots ?? []).length) triggers.push(["lots", "lots_no_delete"]);
	if (betRows.length) triggers.push(["bets", "bucket_a_no_delete"]);
	if (commentRows.length) triggers.push(["comments", "bucket_a_no_delete"]);
	if (uploads.length) triggers.push(["image_uploads", "bucket_b_no_delete"]);
	if (identityUnconsume.length)
		triggers.push(["identity_pool", "bucket_b_update_check"]);

	return {
		runId,
		seedUsers,
		orphanUsers: orphanRows.map((o) => o.id),
		bets: betRows.map((b) => ({
			id: b.id,
			commentId: b.comment_id,
			marketId: b.market_id,
			key: b.key ?? "",
		})),
		commentsByDepth,
		uploads: uploads.map((u) => ({ id: u.id, r2Key: u.r2_object_key })),
		seedEvents,
		injectorEvents,
		seedHashes,
		preHashes,
		poolRestores,
		identityUnconsume,
		watermarkRestores,
		cronAlarmDeletes,
		cronAlarmsKept,
		kept,
		sequenceRestores,
		sequenceNotes,
		triggers,
		refusals,
	};
}

/** What a human reads, and what dry-run and execute must agree on. */
function summarise(plan: Plan) {
	const byType: Record<string, number> = {};
	for (const e of plan.seedEvents) byType[e.type] = (byType[e.type] ?? 0) + 1;
	return {
		runId: plan.runId,
		remove: {
			users: plan.seedUsers.length,
			orphanUsersWithoutAccount: plan.orphanUsers.length,
			accountsByCascade: plan.seedHashes.accounts?.length ?? 0,
			sessionsByCascade: plan.seedHashes.sessions?.length ?? 0,
			bet_receipts: plan.seedHashes.bet_receipts?.length ?? 0,
			bets: plan.bets.length,
			commentsByDepth: Object.fromEntries(
				Object.entries(plan.commentsByDepth).map(([d, ids]) => [d, ids.length]),
			),
			dharma_ledger: plan.seedHashes.dharma_ledger?.length ?? 0,
			lots: plan.seedHashes.lots?.length ?? 0,
			positions: plan.seedHashes.positions?.length ?? 0,
			image_uploads: plan.uploads.length,
			events: plan.seedEvents.length,
			eventsByType: byType,
			injectorEvents: plan.injectorEvents.length,
			cronAlarms: plan.cronAlarmDeletes.map(
				(a) => `${a.id}:${a.alarmId} (${a.why})`,
			),
		},
		restore: {
			pools: plan.poolRestores.map(
				(p) =>
					`${p.marketId}: yes ${p.now.yes} → ${p.snapshot.yes}, no ${p.now.no} → ${p.snapshot.no}`,
			),
			identityPoolUnconsume: {
				seed: plan.identityUnconsume.filter((u) => u.reason === "seed").length,
				stranded: plan.identityUnconsume
					.filter((u) => u.reason === "stranded")
					.map((u) => u.pseudonym),
			},
			watermarkState: plan.watermarkRestores,
			sequences: plan.sequenceRestores,
		},
		keptAndListed: {
			cronAlarms: plan.cronAlarmsKept,
			otherTables: plan.kept,
			sequences: plan.sequenceNotes,
			r2ObjectsNotDeleted: plan.uploads.map((u) => u.r2Key),
		},
		triggersToDisable: plan.triggers.map(([t, g]) => `${t}.${g}`),
		refusals: plan.refusals,
	};
}

function planDigest(plan: Plan): string {
	return JSON.stringify({
		u: sorted(plan.seedUsers),
		b: sorted(plan.bets.map((b) => b.id)),
		e: sorted(plan.seedEvents.map((e) => e.id)),
		i: sorted(plan.injectorEvents.map((e) => e.id)),
		p: sorted(plan.poolRestores.map((p) => `${p.id}:${p.now.yes}:${p.now.no}`)),
		ip: sorted(plan.identityUnconsume.map((x) => x.id)),
		w: plan.watermarkRestores,
		c: sorted(plan.cronAlarmDeletes.map((a) => a.id)),
		t: plan.triggers,
	});
}

// ── EXECUTE ─────────────────────────────────────────────────────────────────

function expectCount(label: string, got: number, want: number): void {
	if (got !== want)
		throw new Error(
			`${label}: affected ${got} row(s), expected ${want}; rolling back`,
		);
}

async function driftAlarms(
	tx: TxSql,
	exclude: ReadonlySet<string>,
): Promise<string[]> {
	const [seq] = await tx<{ last_value: string; is_called: boolean }[]>`
		SELECT last_value::text, is_called FROM cron_alarms_id_seq`;
	const [max] = await tx<
		{ m: string }[]
	>`SELECT coalesce(max(id), 0)::text AS m FROM cron_alarms`;
	await tx.unsafe("SAVEPOINT seed_cleanup_drift_probe");
	await tx`SELECT check_nightly_drift()`;
	const rows = await tx<
		{ alarm_id: string; payload: Record<string, unknown> }[]
	>`
		SELECT alarm_id, payload FROM cron_alarms WHERE id > ${max?.m ?? "0"}::bigint`;
	await tx.unsafe("ROLLBACK TO SAVEPOINT seed_cleanup_drift_probe");
	// nextval is not transactional: put the alarm sequence back where it was.
	if (seq)
		await tx`SELECT setval('cron_alarms_id_seq', ${seq.last_value}::bigint, ${seq.is_called})`;
	return rows
		.filter(
			(r) =>
				!(
					typeof r.payload.user_id === "string" &&
					exclude.has(r.payload.user_id)
				),
		)
		.map(
			(r) =>
				`${r.alarm_id} ${JSON.stringify(Object.fromEntries(Object.entries(r.payload).sort()))}`,
		)
		.sort();
}

async function execute(
	tx: TxSql,
	snap: Snapshot,
	runId: string,
	manifest: Manifest | null,
	dryDigest: string,
) {
	await stabiliseRowText(tx);
	await tx.unsafe("SET LOCAL lock_timeout = '10s'");
	await tx.unsafe(
		`LOCK TABLE ${LOCKED_TABLES.join(", ")} IN SHARE ROW EXCLUSIVE MODE`,
	);
	const [role] = await tx<
		{ r: string }[]
	>`SELECT current_setting('session_replication_role') AS r`;
	if (role?.r !== "origin")
		throw new Refused([`session_replication_role is ${role?.r}.`]);

	const plan = await analyse(tx, snap, runId, manifest);
	if (plan.refusals.length > 0) throw new Refused(plan.refusals);
	if (planDigest(plan) !== dryDigest)
		throw new Refused([
			"the database changed between the dry run and the locked re-analysis; re-run.",
		]);

	const seedSet = new Set(plan.seedUsers);
	const driftBefore = await driftAlarms(tx, seedSet);
	const seedArr = tx.array(plan.seedUsers);

	for (const [table, trigger] of plan.triggers)
		await tx.unsafe(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);

	const eventIds = [...plan.seedEvents, ...plan.injectorEvents].map(
		(e) => e.id,
	);
	expectCount(
		"events",
		(
			await tx`DELETE FROM events WHERE event_id = ANY(${tx.array(eventIds)}::uuid[])`
		).count,
		eventIds.length,
	);
	expectCount(
		"bet_receipts",
		(await tx`DELETE FROM bet_receipts WHERE user_id = ANY(${seedArr}::uuid[])`)
			.count,
		plan.seedHashes.bet_receipts?.length ?? 0,
	);
	expectCount(
		"dharma_ledger",
		(
			await tx`DELETE FROM dharma_ledger WHERE user_id = ANY(${seedArr}::uuid[])`
		).count,
		plan.seedHashes.dharma_ledger?.length ?? 0,
	);
	expectCount(
		"lots",
		(await tx`DELETE FROM lots WHERE user_id = ANY(${seedArr}::uuid[])`).count,
		plan.seedHashes.lots?.length ?? 0,
	);
	expectCount(
		"positions",
		(await tx`DELETE FROM positions WHERE user_id = ANY(${seedArr}::uuid[])`)
			.count,
		plan.seedHashes.positions?.length ?? 0,
	);
	expectCount(
		"bets",
		(await tx`DELETE FROM bets WHERE user_id = ANY(${seedArr}::uuid[])`).count,
		plan.bets.length,
	);
	// Deepest first: a reply-to-reply before the reply it answers (parent_comment_id is RESTRICT).
	for (const depth of Object.keys(plan.commentsByDepth)
		.map(Number)
		.sort((a, b) => b - a)) {
		const ids = plan.commentsByDepth[String(depth)] ?? [];
		expectCount(
			`comments depth ${depth}`,
			(await tx`DELETE FROM comments WHERE id = ANY(${tx.array(ids)}::uuid[])`)
				.count,
			ids.length,
		);
	}
	expectCount(
		"image_uploads",
		(
			await tx`DELETE FROM image_uploads WHERE user_id = ANY(${seedArr}::uuid[])`
		).count,
		plan.uploads.length,
	);
	// accounts and sessions go by ON DELETE CASCADE.
	expectCount(
		"users",
		(await tx`DELETE FROM users WHERE id = ANY(${seedArr}::uuid[])`).count,
		plan.seedUsers.length,
	);
	expectCount(
		"identity_pool",
		(
			await tx`UPDATE identity_pool SET assigned_at = NULL WHERE id = ANY(${tx.array(plan.identityUnconsume.map((u) => u.id))}::uuid[]) AND assigned_at IS NOT NULL`
		).count,
		plan.identityUnconsume.length,
	);
	for (const p of plan.poolRestores)
		expectCount(
			`pool ${p.id}`,
			(
				await tx`UPDATE pools SET yes_reserves = ${p.snapshot.yes}::numeric, no_reserves = ${p.snapshot.no}::numeric WHERE id = ${p.id}::uuid`
			).count,
			1,
		);
	for (const w of plan.watermarkRestores) {
		await tx`DELETE FROM watermark_state WHERE metric = ${w.metric}`;
		const was = snap.watermarkState.find((r) => r.metric === w.metric);
		if (was)
			await tx`INSERT INTO watermark_state (metric, state, since) VALUES (${was.metric}, ${was.state}, ${was.since}::timestamptz)`;
	}
	expectCount(
		"cron_alarms",
		(
			await tx`DELETE FROM cron_alarms WHERE id = ANY(${tx.array(plan.cronAlarmDeletes.map((a) => a.id))}::bigint[])`
		).count,
		plan.cronAlarmDeletes.length,
	);
	// The dharma_ledger sequence is NOT rewound here: setval is not transactional,
	// so a rewind followed by a ROLLBACK would leave the sequence below rows that
	// still exist, and a later row would take a seq LOWER than its user's latest —
	// breaking the ADR-0029 `ORDER BY seq DESC` balance read. See rewindSequences().

	for (const [table, trigger] of plan.triggers)
		await tx.unsafe(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);

	// ── VERIFY, still inside the transaction ────────────────────────────────
	const failures: string[] = [];
	const guards = await readGuards(tx);
	failures.push(...guardProblems(guards));
	if (!sameList(guards.bucketNames, snap.guards.bucketNames))
		failures.push("guard catalogue names differ from the snapshot's");

	const accountPrefix = `dummy-seed-sub-${runId}-`;
	const keyPrefix = `seed.${runId}.`;
	const [residue] = await tx<Record<string, number>[]>`
		SELECT
			(SELECT count(*)::int FROM users WHERE id = ANY(${seedArr}::uuid[]) OR starts_with(google_id, ${accountPrefix})) AS users,
			(SELECT count(*)::int FROM accounts WHERE starts_with(account_id, ${accountPrefix}) OR user_id = ANY(${seedArr}::uuid[])) AS accounts,
			(SELECT count(*)::int FROM sessions WHERE user_id = ANY(${seedArr}::uuid[])) AS sessions,
			(SELECT count(*)::int FROM bet_receipts WHERE starts_with(idempotency_key, ${keyPrefix}) OR user_id = ANY(${seedArr}::uuid[])) AS bet_receipts,
			(SELECT count(*)::int FROM bets WHERE starts_with(idempotency_key, ${keyPrefix}) OR user_id = ANY(${seedArr}::uuid[])) AS bets,
			(SELECT count(*)::int FROM comments WHERE user_id = ANY(${seedArr}::uuid[])) AS comments,
			(SELECT count(*)::int FROM dharma_ledger WHERE user_id = ANY(${seedArr}::uuid[])) AS dharma_ledger,
			(SELECT count(*)::int FROM lots WHERE user_id = ANY(${seedArr}::uuid[])) AS lots,
			(SELECT count(*)::int FROM positions WHERE user_id = ANY(${seedArr}::uuid[])) AS positions,
			(SELECT count(*)::int FROM image_uploads WHERE user_id = ANY(${seedArr}::uuid[])) AS image_uploads,
			(SELECT count(*)::int FROM events WHERE event_id = ANY(${tx.array(eventIds)}::uuid[]) OR metadata->>'user_id' = ANY(${seedArr})) AS events,
			(SELECT count(*)::int FROM dharma_ledger d WHERE d.bet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.id = d.bet_id)) AS dangling_ledger_bets,
			(SELECT count(*)::int FROM comments c WHERE c.parent_comment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comments p WHERE p.id = c.parent_comment_id)) AS dangling_parents`;
	for (const [k, v] of Object.entries(residue ?? {}))
		if (v !== 0) failures.push(`residue ${k} = ${v}`);

	const tableResults: Record<string, string> = {};
	const deletedAlarmHashes = plan.cronAlarmDeletes.map((a) => a.hash);
	for (const t of await listTables(tx)) {
		if (UNASSERTED.has(t)) {
			tableResults[t] = "not asserted (unlocked operational/auth table)";
			continue;
		}
		const now = sorted(await rowHashes(tx, t));
		const expected =
			t === "cron_alarms"
				? multisetMinus(plan.preHashes[t] ?? [], deletedAlarmHashes)
				: AUTH_PLANE.has(t)
					? multisetMinus(plan.preHashes[t] ?? [], plan.seedHashes[t] ?? [])
					: (snap.tables[t]?.hashes ?? []);
		const ok = sameList(now, expected);
		tableResults[t] = ok
			? `== ${t === "cron_alarms" || AUTH_PLANE.has(t) ? "pre-cleanup minus seed" : "snapshot"} (${now.length})`
			: `MISMATCH (${now.length} vs ${expected.length})`;
		if (!ok)
			failures.push(
				`${t}: row hashes do not equal the expected state (${now.length} vs ${expected.length})`,
			);
	}
	const [pool] = await tx<
		{ free: number }[]
	>`SELECT count(*) FILTER (WHERE assigned_at IS NULL)::int AS free FROM identity_pool`;
	if (pool?.free !== snap.identityPool.free)
		failures.push(
			`identity_pool free ${pool?.free} ≠ snapshot ${snap.identityPool.free}`,
		);
	const lotSum = await lotSumViolations(tx);
	if (lotSum !== snap.lotSumViolations)
		failures.push(
			`I-LOT-SUM violations ${lotSum} ≠ snapshot ${snap.lotSumViolations}`,
		);
	const dangling = await danglingEventRefs(tx);
	if (dangling !== snap.danglingEventRefs)
		failures.push(
			`dangling event refs ${dangling} ≠ snapshot ${snap.danglingEventRefs}`,
		);
	const driftAfter = await driftAlarms(tx, seedSet);
	if (!sameList(driftAfter, driftBefore))
		failures.push(
			`check_nightly_drift() differs: before ${driftBefore.length}, after ${driftAfter.length}`,
		);

	const verification = {
		guards: {
			bucketCount: guards.bucketCount,
			bucketNotEnabled: guards.bucketNotEnabled,
			lotsNoDelete: guards.lotsNoDelete,
		},
		residue,
		tables: tableResults,
		identityPoolFree: pool?.free,
		lotSumViolations: lotSum,
		danglingEventRefs: dangling,
		nightlyDriftAlarms: { before: driftBefore, after: driftAfter },
		failures,
	};
	if (failures.length > 0) {
		const err = new Error(
			`verification failed (${failures.length}); rolling back`,
		);
		(err as Error & { verification?: unknown }).verification = verification;
		throw err;
	}
	return { plan, verification };
}

/**
 * AFTER the cleanup has committed: put `dharma_ledger_seq_seq` back to its T0
 * value, in its own transaction, under a lock that stops any ledger insert, and
 * only if no remaining row's seq is above that value. Because the condition is
 * checked under the lock and setval is the last statement, the rewind is valid
 * even if this transaction then fails to commit: no row could have been added.
 *
 * A gap would be harmless (ADR-0029's order is per-user `ORDER BY seq DESC`, and
 * check_nightly_drift's D2 is order-free); the rewind exists so the database is
 * byte-identical to T0, not because a gap breaks anything.
 */
async function rewindSequences(sql: Sql, restores: readonly SequenceState[]) {
	const out: Record<string, string> = {};
	for (const s of restores) {
		if (s.name !== "dharma_ledger_seq_seq") continue;
		out[s.name] = await sql.begin(async (tx) => {
			await tx.unsafe("SET LOCAL lock_timeout = '10s'");
			await tx.unsafe("LOCK TABLE dharma_ledger IN SHARE ROW EXCLUSIVE MODE");
			const [m] = await tx<{ m: string | null }[]>`
				SELECT max(seq)::text AS m FROM dharma_ledger`;
			if (m?.m != null && BigInt(m.m) > BigInt(s.lastValue))
				return `left at its current value: max(seq) ${m.m} is above the T0 value ${s.lastValue} (a gap, harmless)`;
			await tx`SELECT setval('dharma_ledger_seq_seq', ${s.lastValue}::bigint, ${s.isCalled})`;
			return `rewound to ${s.lastValue} (is_called ${s.isCalled}); max(seq) ${m?.m ?? "none"}`;
		});
	}
	return out;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	const snapshotPath = outsideRepo(
		flag(argv, "--snapshot") ?? die("--snapshot is required"),
		"--snapshot",
	);
	const runId = flag(argv, "--run-id") ?? die("--run-id is required");
	if (!/^[a-z0-9]{8,}$/.test(runId))
		die(
			"--run-id must be 8+ lowercase alphanumerics (the seed runner's shape)",
		);
	const manifestPath = flag(argv, "--manifest");
	const doExecute = argv.includes("--execute");

	const target = resolveCleanupTarget(flag(argv, "--env"), process.env, {
		ackProduction: argv.includes(PROD_ACK_FLAG),
	});
	if (!target.ok) die(target.reason);
	if (doExecute && target.mode !== "local" && !argv.includes(EXECUTE_ACK_FLAG))
		die(`--execute on ${target.mode} requires ${EXECUTE_ACK_FLAG}`);

	const parsed: unknown = JSON.parse(readFileSync(snapshotPath, "utf8"));
	if (!isSnapshot(parsed))
		die(`${snapshotPath} is not a seed-cleanup snapshot`);
	const snap = parsed;
	if (snap.mode !== (target.mode as Mode))
		die(`the snapshot is for ${snap.mode}, this run targets ${target.mode}`);
	const manifest = manifestPath
		? (JSON.parse(
				readFileSync(outsideRepo(manifestPath, "--manifest"), "utf8"),
			) as Manifest)
		: null;

	const reportPath = join(
		dirname(snapshotPath),
		`cleanup-report-${runId}-${target.mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
	);
	const report: Record<string, unknown> = {
		target: describeTarget(target),
		runId,
		snapshot: basename(snapshotPath),
		T0: snap.takenAt,
		startedAt: new Date().toISOString(),
		mode: doExecute ? "execute" : "dry-run",
	};
	const finish = (outcome: string, code: number): number => {
		report.outcome = outcome;
		report.finishedAt = new Date().toISOString();
		writeFileSync(reportPath, `${JSON.stringify(report, null, "\t")}\n`);
		console.log(`\n[seed-cleanup] ${outcome} · report ${reportPath}`);
		return code;
	};

	const sql: Sql = await openTarget(target);
	try {
		// ── Dry run (always first) ──────────────────────────────────────────
		let dry: Plan;
		try {
			dry = await sql.begin(
				"isolation level repeatable read read only",
				async (tx) => {
					await stabiliseRowText(tx);
					return analyse(tx, snap, runId, manifest);
				},
			);
		} catch (err) {
			if (err instanceof Refused) {
				report.refusals = err.reasons;
				console.error(`[seed-cleanup] REFUSED:\n  ${err.reasons.join("\n  ")}`);
				return finish("REFUSED", 1);
			}
			throw err;
		}
		const summary = summarise(dry);
		report.dryRun = summary;
		console.log(
			`[seed-cleanup] ${describeTarget(target)} · run ${runId} · T0 ${snap.takenAt}`,
		);
		console.log(JSON.stringify(summary, null, 2));
		if (dry.refusals.length > 0) {
			console.error(
				`\n[seed-cleanup] REFUSED (${dry.refusals.length}):\n  ${dry.refusals.join("\n  ")}`,
			);
			return finish("REFUSED", 1);
		}
		if (!doExecute)
			return finish("DRY-RUN (nothing written; pass --execute)", 0);

		if (target.mode === "prod") {
			const phrase = `delete seed run ${runId} from production`;
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			const typed = await rl.question(
				`\nThis DELETES append-only rows on PRODUCTION.\nType "${phrase}" to continue: `,
			);
			rl.close();
			if (typed.trim() !== phrase)
				return finish("ABORTED (confirmation phrase did not match)", 1);
		}

		// ── Execute: one transaction; any throw rolls every statement back ──
		try {
			const result = await sql.begin((tx) =>
				execute(tx, snap, runId, manifest, planDigest(dry)),
			);
			report.executed = summarise(result.plan);
			report.verification = result.verification;
		} catch (err) {
			report.error = err instanceof Error ? err.message : String(err);
			if (err instanceof Refused) report.refusals = err.reasons;
			const v = (err as { verification?: unknown }).verification;
			if (v) report.verification = v;
			console.error(
				`[seed-cleanup] ROLLED BACK: ${report.error}${err instanceof Refused ? `\n  ${err.reasons.join("\n  ")}` : ""}`,
			);
			if (v) console.error(JSON.stringify(v, null, 2));
			const g = await readGuards(sql);
			report.guardsAfterRollback = {
				bucketCount: g.bucketCount,
				bucketNotEnabled: g.bucketNotEnabled,
				lotsNoDelete: g.lotsNoDelete,
			};
			return finish("ROLLED BACK", 1);
		}
		report.sequences = await rewindSequences(sql, dry.sequenceRestores);
		console.log(
			`[seed-cleanup] sequences: ${JSON.stringify(report.sequences)}`,
		);
		// Belt: read the catalogue again on a fresh statement, outside the transaction.
		const after = await readGuards(sql);
		report.guardsAfterCommit = {
			bucketCount: after.bucketCount,
			bucketNotEnabled: after.bucketNotEnabled,
			lotsNoDelete: after.lotsNoDelete,
		};
		console.log(JSON.stringify(report.verification, null, 2));
		const problems = guardProblems(after);
		if (problems.length > 0) {
			console.error(
				`[seed-cleanup] ⚠ GUARDS AFTER COMMIT: ${problems.join("; ")}`,
			);
			return finish("COMMITTED — BUT GUARDS ARE NOT ALL ENABLED", 2);
		}
		return finish("COMMITTED", 0);
	} finally {
		await sql.end({ timeout: 10 });
	}
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err);
		process.exit(1);
	},
);
