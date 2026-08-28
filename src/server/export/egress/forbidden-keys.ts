import type { EventType } from "@/server/events/schemas";

/**
 * DATASET.1 — the declarative forbidden-key registry (brief §4 Slice 1).
 *
 * Derived from SPEC.2 §19.4 (the PII columns dropped), §19.4.1 (the
 * per-event-type payload STRIP_KEY rules) and **Appendix B** (the per-table
 * per-column treatment map).
 *
 * ⚠ **Appendix B is the exhaustive authority here, not §19.4's ten-row table
 * or §19.5's six-bullet list.** Both of those read like inventories and are
 * not: §19.4's table omits `mod_actions.blocked_text` and
 * `mod_actions.image_r2_key`, both of which Appendix B B.10 classifies STRIP;
 * §19.5's list omits `positions` / `payout_events` / `user_events`, all three
 * of which Appendix B classifies PSEUDO. §19.8 routes per-column questions to
 * Appendix B, and B's own coverage note settles the intent — *"every `user_id`
 * / `target_user_id` FK gets rewritten"*. Read B before editing this file.
 *
 * No `server-only` import: this module is pure data + pure predicates, it
 * touches no DB and no secret, and the guard tests import it directly.
 */

/**
 * §19.4 + Appendix B — columns dropped from the released schema entirely,
 * keyed by source table name.
 *
 * ⚠ `users.pfp_filename` is deliberately ABSENT. §19.4's table is titled "The
 * ten PII columns dropped at export" and lists it as row 7 — but its own
 * treatment column reads *"Released as-is; H2-erased rows release as NULL"*,
 * and Appendix B.1 classifies it `NULL_IF_ERASED`, not `STRIP`. It ships.
 * Dropping it would destroy the `identity_pool` join and delete a column the
 * spec twice says survives. The "ten" is a miscount of its own table, and
 * copying the count instead of the treatments is how it propagates.
 */
export const STRIPPED_COLUMNS = {
	users: [
		"email",
		"google_id",
		"name",
		"image",
		"tos_acceptance_ip",
		"tos_acceptance_user_agent",
	],
	image_uploads: ["r2_object_key"],
	// B.10 — neither of these appears in §19.4's ten-row table.
	// `blocked_text` is the rejected comment body retained for ban review;
	// `image_r2_key` is an R2 key, and R2 keys embed the userId per
	// SCAFFOLD.15 §Q9 (`u/<userId>/<uploadId>.<ext>`), which makes it a raw
	// `users.id` carrier under a name that does not say so.
	mod_actions: ["blocked_text", "image_r2_key"],
} as const satisfies Record<string, readonly string[]>;

/**
 * §19.4 rows 9–10 + Appendix B.11/B.12/B.13 — JSONB sub-keys stripped from
 * the `metadata` column of EVERY audit table (`events`, `admin_events`,
 * `user_events`). Not table-scoped: `metadata` has one shape (§3.7's
 * seven-field set) and these two keys never ship from any of them.
 */
export const STRIPPED_METADATA_KEYS = ["ip", "user_agent"] as const;

/**
 * §19.4 — the five `metadata` fields that DO ship. Kept as an explicit
 * positive list, not merely as "everything else", so that a new metadata
 * field added to §3.7's set fails the completeness guard rather than
 * silently shipping on the strength of not being named a secret.
 */
export const SHIPPED_METADATA_KEYS = [
	"request_id",
	"flow_id",
	"user_id",
	"actor_id",
	"idempotency_key",
] as const;

/**
 * §19.4.1 — per-event-type payload STRIP_KEY rules for `events.payload`.
 *
 * ⚠ **The `satisfies Record<EventType, …>` is the load-bearing part of this
 * declaration and must not be relaxed to `Partial<>` or to a plain object.**
 * It makes "a new event type shipped with no strip rule" a COMPILE error at
 * the moment `EVENT_TYPES` grows, rather than a runtime discovery. That is
 * O-1 — structural beats procedural — and it is strictly earlier than the
 * CI guard in `completeness.ts`, which exists as the belt to this brace
 * (a type error is skippable with a cast; the runtime guard is not).
 *
 * An event type with nothing to strip declares `[]` **explicitly**. Silence
 * and "nothing to strip" must not share a representation, because then the
 * guard cannot tell an answered question from an unasked one.
 */
export const PAYLOAD_STRIP_KEYS = {
	// — user lifecycle —
	// `ip`/`user_agent` are PII per §19.4 and redundant with the (already
	// stripped) `users.tos_acceptance_*` columns.
	"user.tos_accepted": ["ip", "user_agent"],
	// `googleId` mirrors the `users.google_id` STRIP. `userId` is
	// defense-in-depth: `aggregate_id` is rewritten to a pseudonym per §19.5,
	// but a raw `payload.userId` left behind re-identifies by cross-join.
	"user.oauth_signed_in": ["googleId", "userId"],
	"user.otp_signed_in": ["email", "userId"],
	"user.pseudonym_assigned": ["userId"],
	"user.signed_out": ["userId"],

	// — image upload lifecycle —
	// `key` is the R2 object key, which embeds the userId per SCAFFOLD.15 §Q9.
	"image_upload.sign_requested": ["userId", "key"],
	"image_upload.committed": ["userId", "key"],
	"image_upload.blocked": ["userId", "key"],
	// `orphaned` carries no `userId`; `uploadId` is the row id and SHIPS.
	"image_upload.orphaned": ["key"],

	// — moderation —
	// Research keys `reason` / `banned` / `uploadId` SHIP (AUDIT-FIX-B5).
	"moderation.blocked": ["userId"],

	// — admin —
	// `sessionId` is the admin cookie value; `ip` is the admin's IP. Both are
	// defense-in-depth on top of the BREAK_GLASS.md pre-freeze rotation.
	"admin.signed_in": ["sessionId", "ip"],
	"admin.signed_out": ["sessionId"],

	// — dharma —
	"dharma.credited": ["userId"],
	"dharma.granted": ["userId"],

	// — bet / comment —
	// Research keys SHIP and are the K_eff(t) derivation core per §19.6:
	// stake, side, price, sharesSold, proceeds, bodyLength, and the market /
	// bet / comment ids. Only actor identity is stripped.
	"bet.placed": ["userId"],
	"bet.sold": ["userId"],
	"comment.placed": ["userId"],

	// — market lifecycle: nothing to strip, declared explicitly —
	// Every market.* payload is admin-actor and carries no PII-class key. The
	// actor is `metadata.actor_id = 'admin-singleton'`, a sentinel that is
	// never pseudonymized (§19.5).
	"market.created": [],
	"market.opened": [],
	"market.closed": [],
	"market.resolving": [],
	"market.resolved": [],
	"market.corrected": [],
	"market.voided": [],
} as const satisfies Record<EventType, readonly string[]>;

/**
 * The named value-classes brief §4 Slice 1 requires an assertion helper for.
 * These are the things that must never reach a written file, whatever key
 * they arrive under and however deeply they are nested.
 */
export const FORBIDDEN_VALUE_CLASSES = [
	"raw-user-id",
	"ip",
	"user-agent",
	"google-id",
	"r2-object-key",
	"admin-session-id",
] as const;

export type ForbiddenValueClass = (typeof FORBIDDEN_VALUE_CLASSES)[number];

/**
 * Key names that must never appear in an exported payload or metadata object,
 * at any depth, on any table — the key-shaped half of the same contract the
 * value classes cover. Union of every STRIP_KEY target in §19.4.1 plus the
 * two metadata keys.
 *
 * ⚠ This is a *cross-cutting* net, not a substitute for the per-event-type
 * rules above. `key` is stripped from `image_upload.*` by rule; it is listed
 * here so that a `key` appearing on some *other* event type — one whose rule
 * says `[]` because nobody expected it to carry one — still fails.
 */
export const GLOBALLY_FORBIDDEN_PAYLOAD_KEYS = [
	"ip",
	"user_agent",
	"userAgent",
	"email",
	"googleId",
	"google_id",
	"sessionId",
	"session_id",
	"key",
	// `userId` is stripped by rule on every event type that carries one, and
	// the `market.*` types carry none — so no surviving payload may hold it.
	// ⚠ Note the asymmetry with `metadata`: `metadata.user_id` SHIPS, as a
	// pseudonym under the renamed key `user_pseudonym` (§19.5). Payload
	// `userId` is STRIP with no pseudonym substitute (§19.4.1). Two different
	// treatments of the same identity, one key apart, and conflating them
	// either deletes a shipped column or ships a stripped one.
	"userId",
] as const;
