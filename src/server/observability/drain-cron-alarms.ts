import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
	ALARMS_DRAIN_BATCH_SIZE,
	ALARMS_DRAIN_FLUSH_TIMEOUT_MS,
} from "@/server/config/limits";

import { safeCaptureMessage, safeFlush } from "./safe-capture";

// AUDIT-FIX-B1 A7 (rulings #5, #10-OVERRIDE) — the `cron_alarms` drain. The
// pg_cron writers (0007 identity-pool watermark; 0011/0015 nightly drift)
// INSERT alarm rows because pg_cron cannot emit HTTP (ADR-0006 §6); this is
// the SCAFFOLD.5 consumer that finally carries them to Sentry.
//
// Emit → flush → stamp, at-least-once at the DELIVERY level, NO open
// transaction across the Sentry hop (the OQ-10 override + its guardrail —
// CLAUDE.md §3 forbids HTTP inside a DB tx; the Redis lock in the route
// serializes concurrent drains instead). The B1 close-out ruling upgraded the
// original enqueue-level guarantee to delivery-level: after the synchronous
// per-row enqueues + the events_default probe, `safeFlush` awaits the SDK
// transport (bounded by ALARMS_DRAIN_FLUSH_TIMEOUT_MS) and a row is stamped
// ONLY when delivery is confirmed. A Sentry outage, transport timeout, or a
// flush throw now retires NOTHING (safeFlush fails open — §17.5), so the whole
// batch re-drains next tick (fingerprint dedup absorbs the re-emit).
//
//   1. SELECT unprocessed rows (processed_at IS NULL), oldest first, bounded
//      by ALARMS_DRAIN_BATCH_SIZE (leftovers drain next tick — bounded, not
//      silent: `selected` returns in the route body).
//   2. Per row: one title-matched emit (title = alarm_id; Sentry fingerprint-
//      dedups re-emits, which is what makes at-least-once "no-spam").
//   3. `safeFlush` the SDK transport (bounded, fail-open) — the stamp gates on
//      its confirmed-delivery boolean.
//   4. ONE UPDATE stamping processed_at for ONLY the ids whose emit returned
//      true, and ONLY if the flush confirmed delivery. A crash or a flush-miss
//      before the stamp → the next tick re-emits (accepted; dedup absorbs it).
//      A failed emit leaves its row unstamped for retry.
//
// Plus the `events_default` fold (ruling #5): a non-empty DEFAULT partition
// means an events row landed outside every monthly range — a partition-DDL
// gap. Emitted before the flush; re-fires each tick while non-empty (OQ-c:
// fingerprint dedup, no transition-state row).
//
// `cron_alarms` is deliberately NOT in the drizzle schema (hand-written 0007
// DDL; a pgTable would make the next `drizzle-kit generate` emit a duplicate
// CREATE) — raw `db.execute<T>(sql\`…\`)` per the sweep-orphans.ts precedent.

/** postgres-js returns int8 (bigserial / count(*)) as strings. */
type CronAlarmRow = {
	id: string;
	alarm_id: string;
	payload: unknown;
	emitted_at: Date;
	[key: string]: unknown;
};

type CountRow = {
	count: string;
	[key: string]: unknown;
};

export interface DrainResult {
	selected: number;
	emitted: number;
	stamped: number;
	defaultPartitionCount: number;
	flushed: boolean;
}

export async function drainCronAlarms(): Promise<DrainResult> {
	const rows: CronAlarmRow[] = await db.execute<CronAlarmRow>(sql`
		SELECT id, alarm_id, payload, emitted_at
		  FROM cron_alarms
		 WHERE processed_at IS NULL
		 ORDER BY id
		 LIMIT ${ALARMS_DRAIN_BATCH_SIZE}
	`);

	// Emit (outside any tx) — collect only the ids whose emit succeeded.
	const emittedIds: string[] = [];
	for (const row of rows) {
		const ok = safeCaptureMessage(row.alarm_id, {
			level: "error",
			tags: { alarm_id: row.alarm_id },
			extra: {
				payload: row.payload,
				emitted_at: row.emitted_at,
				cron_alarm_id: row.id,
			},
		});
		if (ok) {
			emittedIds.push(row.id);
		}
	}

	// events_default fold (ruling #5) — emitted BEFORE the flush so the flush
	// covers this event too.
	const countRows: CountRow[] = await db.execute<CountRow>(
		sql`SELECT count(*) AS count FROM events_default`,
	);
	const defaultPartitionCount = Number(countRows[0]?.count ?? "0");
	if (defaultPartitionCount > 0) {
		safeCaptureMessage("events_default_nonempty", {
			level: "error",
			extra: { count: defaultPartitionCount },
		});
	}

	// Flush-before-stamp (delivery-level at-least-once, B1 close-out ruling):
	// await the SDK transport for the whole batch (per-row emits + the
	// events_default probe) BEFORE retiring any row. safeFlush is fail-open —
	// a reject, throw, or transport timeout returns false, which stamps NOTHING
	// (every row re-drains next tick; fingerprint dedup absorbs the re-emit).
	// This never breaks the cron route.
	const flushed = await safeFlush(ALARMS_DRAIN_FLUSH_TIMEOUT_MS);

	// Stamp — one statement, emitted rows only, and ONLY once the flush confirmed
	// delivery. Failed emits and a whole flush-miss stay unstamped and re-drain
	// next tick (the at-least-once heart). Per-id binds via sql.join — the drizzle
	// template expands a bare JS array into a record `($1, $2)`, which cannot cast
	// to bigint[]. The `processed_at IS NULL` guard makes the stamp idempotent
	// under a lock-lapse overlap (a second drain never overwrites the
	// first-processed timestamp).
	let stamped = 0;
	if (flushed && emittedIds.length > 0) {
		const idList = sql.join(
			emittedIds.map((id) => sql`${id}::bigint`),
			sql`, `,
		);
		const updated = await db.execute(sql`
			UPDATE cron_alarms
			   SET processed_at = now()
			 WHERE id IN (${idList})
			   AND processed_at IS NULL
			 RETURNING id
		`);
		stamped = updated.length;
	}

	return {
		selected: rows.length,
		emitted: emittedIds.length,
		stamped,
		defaultPartitionCount,
		flushed,
	};
}
