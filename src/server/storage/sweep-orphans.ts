import "server-only";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import type { DbClient } from "@/db";
import { insertEvent } from "@/server/events/insert";

// Orphan-sweep loop helper per SCAFFOLD.15 plan §5.6 + ENGINE.6 §D.6.
// Factored out of the cron Route Handler body so tests can drive the loop
// directly with an injected `deleteObject` mock + a real testDb fixture
// without going through HTTP / auth / lock-acquire (those layers are owned
// by the handler).
//
// Algorithm (UPDATE-then-delete ordering per SCAFFOLD.15 security-auditor
// MEDIUM #1 absorption — eliminates the TOCTOU window where W-2's commit
// could race the sweep between SELECT and UPDATE):
//   - Loop until empty batch:
//     1. SELECT id FROM image_uploads
//          WHERE terminal_state IS NULL
//            AND created_at < now() - interval '<window> minutes'
//          LIMIT batchSize
//     2. For each candidate id, open a PER-ROW micro-transaction:
//          a. UPDATE image_uploads
//                SET terminal_state='orphan', terminal_at=now()
//              WHERE id=$1 AND terminal_state IS NULL  -- CAS predicate
//              RETURNING r2_object_key
//          b. If CAS returned 0 rows (W-2 commit or another path
//             terminalized between SELECT and UPDATE): rollback no-op,
//             return null (skip emission + skip delete).
//          c. If CAS won: generate per-row eventId, INSERT the
//             `image_upload.orphaned` events row inside the SAME tx
//             (atomic with the UPDATE), return r2_object_key.
//          The tx commits both rows together (or rolls back both on any
//          throw inside the callback).
//     3. After the tx commits, try deleteObject(r2_object_key) OUTSIDE
//        the tx (HTTP must NEVER run inside a DB transaction per
//        CLAUDE.md §3 + ADR-0014). On success: reset failure counter.
//        On failure: log via console.error (SCAFFOLD.5 routes to Sentry
//        later); counter++. If counter >= circuitBreakerThreshold,
//        return { status: 'r2_unavailable', swept } — clean exit.
//
// Semantic note: `swept` counts CAS-successful orphan terminalizations
// (= per-row tx commits). R2 cleanup is best-effort downstream — Layer 1
// R2 native 90-day prefix lifecycle is the safety net for any R2 deletes
// the cron fails to issue (per SPEC.2 §12.6 layer-1/layer-2 asymmetry).
//
// Audit-trail invariant: when deleteObject fails AFTER the tx commit, the
// `events` row stays in the DB. The events log records the orphan
// terminalization intent; the R2 object lingers until Layer 1 sweeps it.
// Reverting the ordering (delete-then-update) would re-open the TOCTOU
// fix and is explicitly rejected by plan §D.6.
//
// NOTE: this helper deliberately avoids `SELECT FOR UPDATE SKIP LOCKED`
// inside a wrapping transaction. The plan §5.6 prose mentions that
// pattern, but holding a transaction open across HTTP calls violates
// CLAUDE.md §3 ("HTTP inside a DB transaction"). The defenses against
// concurrent sweepers are layered differently here:
//   (a) The cron handler holds a distributed lock (acquireLock) — at most
//       one sweep runs at a time across the Vercel cron fan-out.
//   (b) The per-row UPDATE statement carries `WHERE terminal_state IS
//       NULL` as a compare-and-swap predicate — if another path
//       concurrently terminalized this row (e.g., W-2 commit), our
//       UPDATE no-ops.
// These two layers cover the concurrency surface without long-held
// transactions across the R2 deleteObject hop.

interface SweepArgs {
	db: DbClient;
	deleteObject: (bucket: "uploads", key: string) => Promise<void>;
	batchSize: number;
	orphanWindowMinutes: number;
	circuitBreakerThreshold: number;
}

interface SweepResult {
	status: "ok" | "r2_unavailable";
	swept: number;
}

// Index signature required by Drizzle's `execute<TRow extends Record<string,
// unknown>>` generic constraint. Raw-SQL row reads return the columns the
// query selects; the extra index signature is the type-level "any other
// column might exist" affordance that satisfies the constraint.
type CandidateRow = {
	id: string;
	[key: string]: unknown;
};

type UpdateReturningRow = {
	r2_object_key: string;
	[key: string]: unknown;
};

export async function sweepOrphans(args: SweepArgs): Promise<SweepResult> {
	const {
		db,
		deleteObject,
		batchSize,
		orphanWindowMinutes,
		circuitBreakerThreshold,
	} = args;

	let swept = 0;
	let consecutiveR2Failures = 0;

	while (true) {
		const candidates: CandidateRow[] = await db.execute<CandidateRow>(sql`
			SELECT id
			  FROM image_uploads
			 WHERE terminal_state IS NULL
			   AND created_at < now() - make_interval(mins => ${orphanWindowMinutes})
			 LIMIT ${batchSize}
		`);

		if (candidates.length === 0) break;

		let earlyAbort = false;

		for (const row of candidates) {
			// ENGINE.6 §D.6: per-row micro-tx wraps UPDATE-CAS + insertEvent.
			// Both rows commit atomically; if either throws, both roll back.
			// The tx returns the r2_object_key on CAS-success so the
			// post-commit deleteObject knows what to delete; returns null on
			// CAS-loss so the post-commit branch skips (no delete, no
			// counter touch).
			//
			// eventId hoisted ABOVE the db.transaction call for symmetry with
			// the other 5 emit sites (sign-upload route, tos-accept,
			// admin/login attempt, admin/logout, logout — all generate
			// eventId before opening the tx). Cron has no handler-entry to
			// match ADR-0016 D1 literally; per-row generation is the cron
			// variant. V2 retry-safety still holds because each per-row tx
			// is independent (no retry across rows; intra-tx throws roll
			// back that row only) — placement before vs inside the tx
			// callback is behaviorally equivalent here.
			const eventId = uuidv7();
			const r2KeyOrNull = await db.transaction(async (tx) => {
				const updated = await tx.execute<UpdateReturningRow>(sql`
					UPDATE image_uploads
					   SET terminal_state = 'orphan',
					       terminal_at = now()
					 WHERE id = ${row.id}::uuid
					   AND terminal_state IS NULL
					 RETURNING r2_object_key
				`);
				if (updated.length === 0) {
					// CAS lost — another path terminalized this row (typically W-2
					// commit between the candidates SELECT and this UPDATE). Skip
					// silently; not a failure. No event emitted.
					return null;
				}
				const r2ObjectKey = updated[0]?.r2_object_key;
				if (!r2ObjectKey) return null;

				await insertEvent(tx, {
					eventId,
					eventType: "image_upload.orphaned",
					aggregateType: "image_upload",
					aggregateId: row.id,
					payload: { uploadId: row.id, key: r2ObjectKey },
					metadata: {
						request_id: "unknown",
						flow_id: "F-CRON-ORPHAN-SWEEP",
						user_id: null,
						actor_id: "system",
						idempotency_key: null,
						ip: "cron",
						user_agent: "vercel-cron",
					},
				});

				return r2ObjectKey;
			});

			if (!r2KeyOrNull) continue;
			swept++;

			try {
				await deleteObject("uploads", r2KeyOrNull);
				consecutiveR2Failures = 0;
			} catch (err) {
				// TODO(SCAFFOLD.5): replace console.error with Sentry captureException
				// + tag `orphan_sweep_per_row_failure` for the §17 alarm-6 sub-table.
				// Tag string MUST stay byte-identical so the text-search-and-replace
				// lands cleanly (matches the convention at
				// src/server/middleware/rate-limit.ts:174-178).
				//
				// Row is already DB-orphan-terminalized AND the events row is
				// already committed (the per-row tx flushed before this catch
				// branch could run). R2 object lingers until the Layer 1 90-day
				// native lifecycle cleans it. Operationally acceptable per
				// SPEC.2 §12.6 layer asymmetry — the audit trail records the
				// orphan-sweep intent regardless of R2 outcome.
				console.error("orphan_sweep_per_row_failure", err);
				consecutiveR2Failures++;
				if (consecutiveR2Failures >= circuitBreakerThreshold) {
					earlyAbort = true;
					break;
				}
			}
		}

		if (earlyAbort) {
			return { status: "r2_unavailable", swept };
		}

		// If we processed fewer than batchSize rows, there's no more candidates
		// — exit cleanly without an extra SELECT round-trip.
		if (candidates.length < batchSize) break;
	}

	return { status: "ok", swept };
}
