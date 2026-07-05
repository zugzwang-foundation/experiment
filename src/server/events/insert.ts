import "server-only";

import canonicalize from "canonicalize";
import { sql } from "drizzle-orm";
import type { z } from "zod";

import type { DbTransaction } from "@/db";
import { InvalidEventIdError, InvalidEventPayloadError } from "@/lib/errors";
import { safeCaptureException } from "@/server/observability/safe-capture";

import {
	type EventType,
	eventMetadataSchema,
	eventPayloadSchemas,
} from "./schemas";

/**
 * ENGINE.6 §B — `events`-row INSERT helper. Three load-bearing properties
 * per SPEC.2 §7.7 + plan §B:
 *
 *   1. Bound-transaction-only signature (V3). `tx: DbTransaction` (NOT
 *      `DbClient`). Compile-error to pass top-level `db`. The caller
 *      already opened a transaction wrapping the read-model write +
 *      this INSERT; both rows commit or roll back together (ADR-0005 §4).
 *      One named carve-out: `src/server/auth/logout.ts` emits
 *      `user.signed_out` in a post-`signOut` micro-tx because Better Auth's
 *      `signOut` owns the originating mutation and exposes no after-hook
 *      (SPEC.2 §7 amendment per plan §E.2).
 *
 *   2. Caller-supplied `event_id` (UUIDv7 per ADR-0016 D1). Helper checks
 *      the 13th hex char (`eventId[14]`) is '7' and derives `created_at`
 *      from the first 48 bits — NOT `now()`. Retry-safety depends on this:
 *      a retried tx with the same eventId reuses the same `created_at` and
 *      the composite-PK ON CONFLICT dedupes (LD-8 + LD-9). Cron sites
 *      generate `eventId` per-row inside the tx as the cron analog of
 *      handler-entry generation (plan §D.6).
 *
 *   3. Hand-written `sql\`...\`` template with composite-PK ON CONFLICT
 *      target (V1 + LD-3). Drizzle's query builder is NOT used because
 *      LD-3 requires the ON CONFLICT clause visible at source. The
 *      composite `(event_id, created_at)` is mandatory — Postgres rejects
 *      single-column ON CONFLICT on partitioned tables (research brief §2;
 *      SPEC.2 §7.1 composite-PK reconciliation).
 *
 * Failure-mode posture per plan §B Q2:
 *   - Zod payload fail → `InvalidEventPayloadError`, no DB I/O.
 *   - Zod metadata fail → `InvalidEventPayloadError`, no DB I/O.
 *   - eventId not v7 → `InvalidEventIdError`, no DB I/O.
 *   - Postgres errors (40001 / 40P01 / connection) propagate; caller's
 *     transaction wrapper handles retry per ADR-0013.
 *   - DEFAULT-partition writes return successfully; Sentry alarm 2 fires
 *     from the partition-level rule (SCAFFOLD.5 wiring; not the helper's
 *     surface).
 *
 * On the happy path the helper does NOT add Sentry tags, log enrichers,
 * trace spans, or mutate `metadata` (LD-7 + B3) — the V4 passthrough
 * property is behaviorally locked at `tests/server/events/insert.probe.test.ts`.
 * (AUDIT-FIX-B5 / A30 adds ONE fail-open `safeCaptureException` that fires
 * only on the ON-CONFLICT payload-mismatch path — never on a successful
 * insert, and never mutating the payload or metadata.)
 */

function uuidv7ToCreatedAt(eventId: string): Date {
	if (eventId[14] !== "7") throw new InvalidEventIdError(eventId);
	const hex = eventId.replace(/-/g, "").slice(0, 12);
	return new Date(Number.parseInt(hex, 16));
}

/**
 * Closed enum of valid `aggregate_type` values per SPEC.2 §7.1 line 701
 * + Appendix B.13. 9 values total — adding a new aggregate_type is a
 * same-commit amendment to this union, SPEC.2 §7.1 + B.13, and any
 * affected per-event-type payload schemas in `schemas.ts`.
 *
 * Narrowed from the prior `string` shape (Checkpoint 4 absorption) to
 * close the defense-in-depth gap surfaced by security-auditor MEDIUM —
 * a future caller passing `'admin'` instead of `'admin_session'` or
 * `'users'` instead of `'user'` now fails at tsc time.
 *
 * `mod_action` added at AUDIT-FIX-B5 (A13) — the `moderation.blocked`
 * gate-block event references the `mod_actions` row it accompanies.
 */
export type AggregateType =
	| "market"
	| "bet"
	| "comment"
	| "user"
	| "dharma_account"
	| "system"
	| "admin_session"
	| "image_upload"
	| "mod_action";

export interface EventInsertInput<T extends EventType> {
	eventId: string;
	eventType: T;
	aggregateType: AggregateType;
	aggregateId: string;
	payload: z.infer<(typeof eventPayloadSchemas)[T]>;
	metadata: z.infer<typeof eventMetadataSchema>;
	payloadVersion?: number;
}

export async function insertEvent<T extends EventType>(
	tx: DbTransaction,
	input: EventInsertInput<T>,
): Promise<void> {
	const payloadResult = eventPayloadSchemas[input.eventType].safeParse(
		input.payload,
	);
	if (!payloadResult.success) {
		throw new InvalidEventPayloadError(
			input.eventType,
			payloadResult.error.issues,
		);
	}

	const createdAt = uuidv7ToCreatedAt(input.eventId);

	const metadataResult = eventMetadataSchema.safeParse(input.metadata);
	if (!metadataResult.success) {
		throw new InvalidEventPayloadError(
			input.eventType,
			metadataResult.error.issues,
		);
	}

	// `created_at` bound as ISO string with explicit ::timestamptz cast.
	// Direct Date binding via postgres-js + drizzle-orm's extended-protocol
	// path emits a Date object into the wire-format `reset.str` byte
	// encoder, which only accepts strings/Buffer/ArrayBuffer — Date trips
	// `ERR_INVALID_ARG_TYPE` at bind time. ISO-stringify keeps the
	// deterministic UUIDv7-derived value (millisecond precision intact).
	//
	// AUDIT-FIX-B5 / A30 — the composite ON CONFLICT keeps the same-event_id retry
	// idempotent (§7.3). The existing-payload read is FUSED into the write via a
	// data-modifying CTE, so there is NO separate post-write statement: if the
	// combined statement errors (40001 / statement_timeout / infra) it propagates
	// exactly as the bare INSERT always could — the write didn't land, the tx can't
	// commit its intended state anyway, and 40001 reaches the ADR-0013 retry
	// unchanged. A bare two-statement re-SELECT would be a fail-open violation (an
	// observability read could abort an otherwise-committable tx) and MUST NOT be
	// reintroduced; `DO UPDATE` to fetch the row is likewise forbidden — a no-op
	// UPDATE trips the §6 append-only BEFORE UPDATE trigger.
	//
	// `inserted_count` = rows the INSERT actually wrote (0 on the DO-NOTHING
	// conflict path, else 1). `existing_payload` is the PRE-EXISTING committed row:
	// a data-modifying CTE's insert is invisible to the outer SELECT (statement-
	// start snapshot), so on a real insert it is NULL and the guard is skipped via
	// `inserted_count >= 1`; on a conflict it is the row that caused the conflict.
	// A conflict WITH `existing_payload` NULL is a DEFENSIVE belt, not a live path
	// under the callers' fixed-snapshot isolation: SERIALIZABLE / REPEATABLE READ
	// raise 40001 at the ON CONFLICT arbiter (→ ADR-0013 retry re-reads on a fresh
	// snapshot that sees the row, the normal compare path); `comparePayloads(x,
	// null)` → cannot-compare → silent covers only the residual microsecond race.
	const rows = (await tx.execute(sql`
		WITH ins AS (
			INSERT INTO events
				(event_id, event_type, aggregate_type, aggregate_id,
				 payload, payload_version, metadata, created_at)
			VALUES
				(${input.eventId}::uuid, ${input.eventType},
				 ${input.aggregateType}, ${input.aggregateId}::uuid,
				 ${JSON.stringify(payloadResult.data)}::jsonb,
				 ${input.payloadVersion ?? 1},
				 ${JSON.stringify(metadataResult.data)}::jsonb,
				 ${createdAt.toISOString()}::timestamptz)
			ON CONFLICT (event_id, created_at) DO NOTHING
			RETURNING 1 AS inserted
		)
		SELECT
			(SELECT count(*) FROM ins)::int AS inserted_count,
			(SELECT payload FROM events
			   WHERE event_id = ${input.eventId}::uuid
			     AND created_at = ${createdAt.toISOString()}::timestamptz) AS existing_payload
	`)) as unknown as
		| Array<{
				inserted_count: number;
				existing_payload: Record<string, unknown> | null;
		  }>
		| undefined;

	// Fail-open (§17.5): ONLY the pure compare + capture is guarded — NO DB call
	// inside the try, NO separate re-SELECT anywhere. A minimal test double whose
	// `execute` returns undefined leaves `row` undefined → guard skipped, never
	// crashes the caller's transaction.
	const row = rows?.[0];
	if (row && row.inserted_count === 0) {
		try {
			const { mismatch, divergentKeys } = comparePayloads(
				payloadResult.data as Record<string, unknown>,
				row.existing_payload ?? null,
			);
			if (mismatch) {
				// key NAMES only — payload values are PII and are NEVER logged.
				// FUTURE-WORK GATE (AUDIT-FIX-B5 LOW-b): logging key names is PII-safe
				// ONLY because every event payload today has fixed, code-defined keys.
				// Re-evaluate this capture BEFORE any `z.record()` / user-controlled-key
				// payload lands — such keys would leak user data through `differing_keys`.
				safeCaptureException(new Error("event_id_reuse_payload_mismatch"), {
					tags: {
						kind: "event_id_reuse_payload_mismatch",
						event_id: input.eventId,
						differing_keys: divergentKeys.join(","),
					},
				});
			}
		} catch {
			// Observability must never break the caller's transaction.
		}
	}
}

/**
 * AUDIT-FIX-B5 (A30) — pure payload-divergence check for the event_id-reuse
 * guard. Canonicalizes both payloads (RFC 8785 via the `canonicalize` dependency)
 * so jsonb key-order is irrelevant — a raw string compare would false-mismatch.
 * Returns whether the incoming payload diverges from the committed one and the
 * NAMES of the top-level keys that differ (values are PII — never surfaced).
 * `existing === null` (the fused CTE read found no row — the conflicting row
 * committed outside this snapshot) is cannot-compare → no mismatch (fail-open).
 */
export function comparePayloads(
	incoming: Record<string, unknown>,
	existing: Record<string, unknown> | null,
): { mismatch: boolean; divergentKeys: string[] } {
	if (existing === null) return { mismatch: false, divergentKeys: [] };
	if (canonicalize(incoming) === canonicalize(existing)) {
		return { mismatch: false, divergentKeys: [] };
	}
	const keys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
	const divergentKeys = [...keys]
		.filter((k) => canonicalize(incoming[k]) !== canonicalize(existing[k]))
		.sort();
	return { mismatch: true, divergentKeys };
}
