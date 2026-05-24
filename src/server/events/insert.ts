import "server-only";

import { sql } from "drizzle-orm";
import type { z } from "zod";

import type { DbTransaction } from "@/db";
import { InvalidEventIdError, InvalidEventPayloadError } from "@/lib/errors";

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
 * The helper does NOT add Sentry tags, log enrichers, trace spans, or
 * mutate `metadata` (LD-7 + B3) — the V4 passthrough property is
 * behaviorally locked at `tests/server/events/insert.probe.test.ts`.
 */

function uuidv7ToCreatedAt(eventId: string): Date {
	if (eventId[14] !== "7") throw new InvalidEventIdError(eventId);
	const hex = eventId.replace(/-/g, "").slice(0, 12);
	return new Date(Number.parseInt(hex, 16));
}

export interface EventInsertInput<T extends EventType> {
	eventId: string;
	eventType: T;
	aggregateType: string;
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
	await tx.execute(sql`
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
	`);
}
