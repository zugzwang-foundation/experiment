import "server-only";

import { z } from "zod";

/**
 * ENGINE.6 §A — Per-event-type Zod schemas for the `events.payload` JSONB
 * column + the canonical 11-string `event_type` enum.
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
