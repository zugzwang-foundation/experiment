import "server-only";

import { z } from "zod";

/**
 * NUMERIC(38,18) decimal string. Money / Dharma / shares / prices cross the
 * Zod boundary as exact base-10 strings — NEVER `z.number()`: a JS double
 * cannot round-trip 18 fractional digits, INV-2 conservation + CPMM math
 * require exactness, and the insert helper writes the parsed value straight to
 * jsonb (CLAUDE.md §2 — never JS floats for balances/prices/shares).
 *
 * Bounds mirror the column type: ≤20 integer digits (precision − scale =
 * 38 − 18) and ≤18 fractional digits ⇒ ≤38 total significant digits. The
 * character class alone enforces the bound — no `.refine` needed. Canonical
 * form: a leading integer digit is required (serializers emit "0.5", never
 * ".5"); plain decimal only (no exponent, no leading "+").
 *
 * Exported for ENGINE.5/8 reuse (`import { numericString }`). Single SIGNED
 * validator (web ruling) — forward-looking for ENGINE.5/8 ledger deltas that
 * can be negative. Per-field sign/positivity (stake > 0, payout ≥ 0) is
 * business logic deferred to ENGINE.5/8, NOT encoded here.
 */
export const numericString = z
	.string()
	.regex(
		/^-?\d{1,20}(?:\.\d{1,18})?$/,
		"must be a NUMERIC(38,18) decimal string",
	);

/**
 * ENGINE.6 §A — Per-event-type Zod schemas for the `events.payload` JSONB
 * column + the canonical `event_type` enum (ENGINE.6 seeded 11; ENGINE.0
 * added 10 forward-stratum types ⇒ 21 — plan §3).
 *
 * Hand-rolled per the closed inventory; drizzle-zod's `createInsertSchema`
 * produces `z.any()` for JSONB columns (ENGINE.6 technical-research brief
 * §3) so derivation isn't an option. The shape is per plan §A's stub-site
 * audit + future-stratum stubs.
 *
 * Enum-hygiene contract (plan §G): adding a new event_type is a one-line
 * edit to `EVENT_TYPES` + one new `z.object()` entry in
 * `eventPayloadSchemas`. The `as const satisfies Record<EventType,
 * z.ZodObject<z.ZodRawShape>>` clause catches step-2 omission at TypeScript
 * compile time — adding to the enum without a matching schema fails
 * `tsc --noEmit`. AGENTS.md inclusion of this contract is deferred per
 * project memory (`project_adr_catalogue_framing`); this docstring is the
 * stopgap.
 *
 * `image_upload.r2_delete_failed` is intentionally NOT in this enum: per
 * plan-mode LD-1 it's an observability signal owned by SCAFFOLD.5's Sentry
 * surface, not a state-transition event.
 */

export const EVENT_TYPES = [
	// image_upload domain (4)
	"image_upload.sign_requested",
	"image_upload.committed",
	"image_upload.blocked",
	"image_upload.orphaned",
	// user domain (5)
	"user.oauth_signed_in",
	"user.otp_signed_in",
	"user.pseudonym_assigned",
	"user.tos_accepted",
	"user.signed_out",
	// admin domain (2)
	"admin.signed_in",
	"admin.signed_out",
	// market domain (6) — ENGINE.0; lifecycle (created→opened→closed) +
	// settlement (resolved/corrected/voided). All ride aggregate_type "market".
	"market.created",
	"market.opened",
	"market.closed",
	"market.resolved",
	"market.corrected",
	"market.voided",
	// bet domain (2) — ENGINE.0
	"bet.placed",
	"bet.sold",
	// comment domain (1) — ENGINE.0 (SPEC.2 §13.1 canonical name)
	"comment.placed",
	// dharma domain (2) — ENGINE.0 + ENGINE.13
	"dharma.credited",
	"dharma.granted",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Per-event-type payload schemas. Each `z.object()` corresponds to the
 * payload shape passed to `insertEvent` for that `event_type`.
 *
 * Six entries (EMIT in ENGINE.6) are sourced from plan §D.1–§D.6 call
 * sites; five entries (schema-only registration) are sourced from plan §A
 * for future-stratum consumers (DEBATE.2 `.committed`/`.blocked`; future
 * Better Auth-hook stratum `.oauth_signed_in`/`.otp_signed_in`; future
 * emit site `user.pseudonym_assigned`).
 *
 * ENGINE.0 (plan §3) adds 10 forward-stratum entries (6 market + 2 bet +
 * 1 comment + 1 dharma) — schema-only registration; emit sites land at
 * ENGINE.5 (dharma) / 7–8 (market lifecycle, bet, comment) / 9 (settlement).
 * Money/share/price fields use `numericString`.
 *
 * No `payout.*` type: SPEC.2 §3.6 — resolution emits ONE terminal events row
 * (`market.resolved`/`corrected`/`voided`); per-bet payouts are rows in the
 * `payout_events` TABLE, not generic events (D-B reversed pre-merge).
 *
 * `as const satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>` is
 * load-bearing: `as const` preserves per-key narrowing so
 * `eventPayloadSchemas['user.signed_out']` is the specific
 * `z.ZodObject<{ userId: ZodString }>`, NOT widened to
 * `z.ZodObject<z.ZodRawShape>`. `satisfies` enforces the closed-enum
 * coverage at compile time.
 */
export const eventPayloadSchemas = {
	"image_upload.sign_requested": z.object({
		uploadId: z.string().uuid(),
		userId: z.string().uuid(),
		contentType: z.string(),
		byteSize: z.number().int().positive(),
		key: z.string(),
	}),
	"image_upload.committed": z.object({
		uploadId: z.string().uuid(),
		userId: z.string().uuid(),
		commentId: z.string().uuid(),
		key: z.string(),
	}),
	"image_upload.blocked": z.object({
		uploadId: z.string().uuid(),
		userId: z.string().uuid(),
		modVerdict: z.string(),
		reasonCategory: z.string(),
	}),
	"image_upload.orphaned": z.object({
		uploadId: z.string().uuid(),
		key: z.string(),
	}),
	"user.oauth_signed_in": z.object({
		userId: z.string().uuid(),
		provider: z.literal("google"),
		googleId: z.string(),
	}),
	"user.otp_signed_in": z.object({
		userId: z.string().uuid(),
		email: z.string().email(),
	}),
	"user.pseudonym_assigned": z.object({
		userId: z.string().uuid(),
		pseudonym: z.string(),
		pfpFilename: z.string(),
	}),
	"user.tos_accepted": z.object({
		userId: z.string().uuid(),
		tosVersionHash: z.string(),
		privacyVersionHash: z.string(),
		ip: z.string(),
		userAgent: z.string(),
	}),
	"user.signed_out": z.object({
		userId: z.string().uuid(),
	}),
	"admin.signed_in": z.object({
		sessionId: z.string().uuid(),
		ip: z.string(),
	}),
	"admin.signed_out": z.object({
		sessionId: z.string().uuid(),
	}),
	// === ENGINE.0 forward-stratum types (10 — plan §3) =======================
	// market lifecycle. seedAmount is the CPMM seed (numericString);
	// resolutionDeadline is an ISO-8601 instant with offset.
	"market.created": z.object({
		marketId: z.string().uuid(),
		resolutionDeadline: z.string().datetime({ offset: true }),
		seedAmount: numericString,
	}),
	"market.opened": z.object({
		marketId: z.string().uuid(),
	}),
	"market.closed": z.object({
		marketId: z.string().uuid(),
	}),
	// market settlement. winningSide mirrors the `side` pgEnum
	// (src/db/schema/_enums.ts). correctsEventId references resolution_events.id
	// (SPEC.2 §3.6) — ENGINE.9 wires the referent; stays a uuid here.
	"market.resolved": z.object({
		marketId: z.string().uuid(),
		winningSide: z.enum(["YES", "NO"]),
		resolutionNote: z.string().min(1),
	}),
	"market.corrected": z.object({
		marketId: z.string().uuid(),
		correctsEventId: z.string().uuid(),
		correctedWinningSide: z.enum(["YES", "NO"]),
		resolutionNote: z.string().min(1),
	}),
	"market.voided": z.object({
		marketId: z.string().uuid(),
		voidReason: z.string().min(1),
	}),
	// bet domain. side mirrors the `side` pgEnum. stake/shares/price are exact
	// NUMERIC(38,18) strings. parentCommentId null = top-level post-bet;
	// uuid = reply-bet.
	"bet.placed": z.object({
		betId: z.string().uuid(),
		marketId: z.string().uuid(),
		userId: z.string().uuid(),
		side: z.enum(["YES", "NO"]),
		stake: numericString,
		shares: numericString,
		price: numericString,
		commentId: z.string().uuid(),
		parentCommentId: z.string().uuid().nullable(),
	}),
	"bet.sold": z.object({
		betId: z.string().uuid(),
		marketId: z.string().uuid(),
		userId: z.string().uuid(),
		side: z.enum(["YES", "NO"]),
		sharesSold: numericString,
		proceeds: numericString,
		price: numericString,
	}),
	// comment.placed. bodyLength is a character count, not money. uploadId
	// null = no image attached.
	"comment.placed": z.object({
		commentId: z.string().uuid(),
		betId: z.string().uuid(),
		userId: z.string().uuid(),
		marketId: z.string().uuid(),
		side: z.enum(["YES", "NO"]),
		parentCommentId: z.string().uuid().nullable(),
		bodyLength: z.number().int().nonnegative(),
		uploadId: z.string().uuid().nullable(),
	}),
	// dharma. creditedForDate is a UTC calendar day (YYYY-MM-DD), not a
	// timestamp — the Daily Credit accrual key (SPEC.1 §10.4). amount is signed
	// numericString (single validator; positivity is business logic).
	"dharma.credited": z.object({
		userId: z.string().uuid(),
		amount: numericString,
		creditedForDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "UTC date YYYY-MM-DD"),
	}),
	// dharma.granted — the one-time genesis issuance (ENGINE.13). No day key:
	// a genesis row has no accrual date (creditedForDate is dharma.credited's
	// key, not this event's). amount is the equal grant (numericString).
	"dharma.granted": z.object({
		userId: z.string().uuid(),
		amount: numericString,
	}),
} as const satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>;

/**
 * Canonical 7-field metadata set per SPEC.2 §3.7. Stored in
 * `events.metadata` JSONB column with snake_case field names (matches
 * the JSONB stored shape; downstream dataset consumers grep on snake_case).
 *
 * Nullability matrix:
 *   - `user_id` nullable — admin + system actors have no `users.id`.
 *   - `idempotency_key` nullable — handler entries without one (cron, logout)
 *     pass null explicitly.
 *   - `request_id`, `flow_id`, `actor_id`, `ip`, `user_agent` required
 *     strings. Handler entries supply 'unknown' placeholders if not yet
 *     populated (S-C deferral; HARDEN.* request-context middleware
 *     tightens at handler entry later).
 *
 * Per LD-7 the helper does NOT enrich metadata — it passes the parsed
 * object through to JSONB verbatim. V4 probe at
 * `tests/server/events/insert.probe.test.ts::events::probe-metadata-passed-through-without-enrichment`
 * locks the property behaviorally.
 */
export const eventMetadataSchema = z.object({
	request_id: z.string(),
	flow_id: z.string(),
	user_id: z.string().nullable(),
	actor_id: z.string(),
	idempotency_key: z.string().nullable(),
	ip: z.string(),
	user_agent: z.string(),
});
