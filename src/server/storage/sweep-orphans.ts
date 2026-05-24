import "server-only";
import { sql } from "drizzle-orm";

import type { DbClient } from "@/db";

// Orphan-sweep loop helper per SCAFFOLD.15 plan §5.6. Factored out of the
// cron Route Handler body so tests can drive the loop directly with an
// injected `deleteObject` mock + a real testDb fixture without going
// through HTTP / auth / lock-acquire (those layers are owned by the
// handler).
//
// Algorithm (UPDATE-then-delete ordering per SCAFFOLD.15 security-auditor
// MEDIUM #1 absorption — eliminates the TOCTOU window where W-2's commit
// could race the sweep between SELECT and UPDATE):
//   - Loop until empty batch:
//     1. SELECT id FROM image_uploads
//          WHERE terminal_state IS NULL
//            AND created_at < now() - interval '<window> minutes'
//          LIMIT batchSize
//     2. For each candidate id:
//          UPDATE image_uploads
//             SET terminal_state='orphan', terminal_at=now()
//           WHERE id=$1 AND terminal_state IS NULL  -- CAS predicate
//           RETURNING r2_object_key
//          if returned a row (CAS succeeded — we won the race):
//             swept++; consecutiveFailures=0; reset failure streak
//             try { deleteObject('uploads', returningRow.r2_object_key) }
//             catch: log + counter++. If counter >= circuitBreakerThreshold:
//               return { status: 'r2_unavailable', swept } -- abort cleanly.
//          if returned no rows (CAS lost — W-2's commit or another path
//             terminalized between SELECT and UPDATE): skip; do nothing.
//
// Semantic note: `swept` counts CAS-successful orphan terminalizations.
// R2 cleanup is best-effort downstream — Layer 1 R2 native 90-day prefix
// lifecycle is the safety net for any R2 deletes the cron fails to issue
// (per SPEC.2 §12.6 layer-1/layer-2 asymmetry).
//
// NOTE: this helper deliberately avoids `SELECT FOR UPDATE SKIP LOCKED`
// inside a wrapping transaction. The plan §5.6 prose mentions that
// pattern, but holding a transaction open across HTTP calls violates
// CLAUDE.md §3 ("HTTP inside a DB transaction"). The defenses against
// concurrent sweepers are layered differently here:
//   (a) The cron handler holds a distributed lock (acquireLock) — at most
//       one sweep runs at a time across the Vercel cron fan-out.
//   (b) The UPDATE statement carries `WHERE terminal_state IS NULL` as a
//       compare-and-swap predicate — if another path concurrently
//       terminalized this row (e.g., W-2 commit), our UPDATE no-ops.
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
			// UPDATE-then-delete order per SCAFFOLD.15 security-auditor MEDIUM #1
			// absorption. CAS predicate `terminal_state IS NULL` means we only
			// terminalize rows that haven't been claimed by a concurrent W-2
			// commit between SELECT and UPDATE. RETURNING gives us the
			// r2_object_key only on CAS-success — no need to read it pre-UPDATE.
			const updated = await db.execute<UpdateReturningRow>(sql`
				UPDATE image_uploads
				   SET terminal_state = 'orphan',
				       terminal_at = now()
				 WHERE id = ${row.id}::uuid
				   AND terminal_state IS NULL
				 RETURNING r2_object_key
			`);
			if (updated.length === 0) {
				// CAS lost — another path terminalized this row (typically W-2
				// commit). Skip silently; not a failure.
				continue;
			}
			swept++;
			// TODO(ENGINE.6): insertEvent(tx, {
			//   eventType: "image_upload.orphaned",
			//   payload: { uploadId: row.id, key: updated[0].r2_object_key },
			//   metadata: { actorId: "system", ... }
			// })
			const r2ObjectKey = updated[0]?.r2_object_key;
			if (!r2ObjectKey) continue;
			try {
				await deleteObject("uploads", r2ObjectKey);
				consecutiveR2Failures = 0;
			} catch (err) {
				// TODO(SCAFFOLD.5): replace console.error with Sentry captureException
				// + tag `orphan_sweep_per_row_failure` for the §17 alarm-6 sub-table.
				// Tag string MUST stay byte-identical so the text-search-and-replace
				// lands cleanly (matches the convention at
				// src/server/middleware/rate-limit.ts:174-178).
				//
				// Row is already DB-orphan-terminalized; R2 object lingers until
				// the Layer 1 90-day native lifecycle cleans it. Operationally
				// acceptable per SPEC.2 §12.6 layer asymmetry.
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
