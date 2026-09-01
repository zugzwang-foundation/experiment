import type { EventType } from "@/server/events/event-types";

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
 * One node of a payload SHIP declaration.
 *
 * `true` ships a **scalar leaf** — a string, number, boolean, or null. It does
 * NOT ship an object or an array, and reaching one under `true` throws.
 *
 * ⚠ **That restriction is the whole inversion, and softening it undoes the
 * night's work.** "Ship this subtree unread" is deny-by-default's exact
 * opposite: it is how a key nobody has reviewed rides out inside a container
 * somebody did review. A nested object is declared by nesting; an array
 * applies its child spec to every element. If a payload grows a container the
 * declaration does not describe, the build stops and a human decides what of
 * it ships — which is the decision §19.4.1 exists to record.
 */
export type ShipNode = true | { readonly [key: string]: ShipNode };

/** A whole event type's declaration: which top-level payload keys ship. */
export type ShipSpec = { readonly [key: string]: ShipNode };

/**
 * §19.4.1 — per-event-type payload SHIP declarations for `events.payload`.
 *
 * ## Why this is an allow-list, and why it used to be the opposite
 *
 * Until DATASET.3 this was `PAYLOAD_STRIP_KEYS`: per event type, the keys to
 * REMOVE, with everything else shipping. `events.payload` is a `jsonb` column
 * whose shape is open — anyone adding an event type, or adding a key to an
 * existing type, extends it — so "everything else" is an unbounded set and
 * "unlisted" is the normal state of a key nobody has thought about yet.
 *
 * That produced the same defect three nights running, each time patched by
 * extending a list: §19.5's six FK paths against Appendix B's ~14;
 * `comment.placed.payload` rebuilding an association a shorter way than the
 * path C3 closed; and `payload.client.remoteAddr`, which is silent in all four
 * layers because no list spells it — unstripped (no rule names it),
 * unharvested (`HARVEST_KEYS` has no such spelling), unmatched by value
 * (because it was never harvested) and unmatched by key.
 *
 * **The list was the defect.** The table inventory already had this right one
 * level up: a `pgTable` classified as nothing at all fails the build rather
 * than defaulting either way. This extends that property inward, to keys.
 * Everything undeclared is dropped, unread, at any depth and through arrays.
 *
 * ## What did NOT change
 *
 * The set of keys that ships is preserved exactly, event type by event type,
 * against the deny-list this replaces — this is a change of mechanism, not of
 * policy, and the proof is a byte comparison of the emitted archive across the
 * change. The one measured delta is recorded in the DATASET.3 run report: the
 * dirty fixture's `image_upload.committed` row carries two containers
 * (`context`, `variants`) that `schemas.ts` does not declare and no reviewer
 * ever reviewed, and the inversion drops them. That is the mechanism working
 * on the one row built to carry undeclared keys.
 *
 * ## The two guards behind it
 *
 * `satisfies Record<EventType, ShipSpec>` makes "a new event type with no
 * declaration" a COMPILE error the moment `EVENT_TYPES` grows (O-1 —
 * structural beats procedural), and `completeness.ts` is the runtime belt to
 * that brace, because a type error is silenceable with one cast and a runtime
 * throw is not.
 *
 * ⚠ **Neither of those can see a new KEY on an existing type**, which is the
 * gap that made the old deny-list unsafe. What covers that is
 * `tests/unit/export/egress/payload-ship-schema-parity.test.ts`, which
 * compares this declaration against `eventPayloadSchemas` — the Zod payload
 * shapes in `src/server/events/schemas.ts` — and requires every schema key to
 * be classified as either shipped or deliberately dropped. It has to be a test
 * rather than a compile check because `schemas.ts` imports `server-only` and
 * this module must stay loadable by `tsx` (AGENTS.md §7); stated here so the
 * next reader does not take the missing `satisfies` for an oversight.
 *
 * An event type that ships **nothing** declares `{}` explicitly. Silence and
 * "ships nothing" must not share a representation, or the guard cannot tell an
 * answered question from an unasked one.
 */
export const PAYLOAD_SHIP_KEYS = {
	// — user lifecycle —
	// `ip` / `userAgent` are PII per §19.4 and redundant with the (already
	// stripped) `users.tos_acceptance_*` columns. `userId` is withheld
	// throughout: `aggregate_id` is rewritten to a pseudonym per §19.5, and a
	// raw `payload.userId` left beside it re-identifies by cross-join.
	//
	// ⚠ The two hashes are the research content — which version of the terms a
	// participant accepted, without who they are.
	"user.tos_accepted": { tosVersionHash: true, privacyVersionHash: true },
	// `googleId` mirrors the `users.google_id` STRIP; `provider` is the literal
	// "google" on every row, which carries no signal a researcher can use and
	// which nobody ratified shipping. Under a deny-list it shipped because
	// nobody had named it.
	"user.oauth_signed_in": {},
	"user.otp_signed_in": {},
	"user.pseudonym_assigned": { pseudonym: true, pfpFilename: true },
	"user.signed_out": {},

	// — image upload lifecycle —
	// `key` is the R2 object key, which embeds the userId per SCAFFOLD.15 §Q9,
	// so it is a raw `users.id` carrier under a name that does not say so.
	"image_upload.sign_requested": {
		uploadId: true,
		contentType: true,
		byteSize: true,
	},
	// ⚠ `commentId` does NOT ship (SPEC.2 §19.4.1, DATASET.2 C3).
	//
	// Appendix B.6 withholds a reactively-removed comment's `image_uploads_id`,
	// and that key reconstructs the identical association from the other side —
	// so shipping it rebuilds exactly the link B.6 withholds
	// (`@security-auditor` M-8). With removed bodies ruled withheld (R1),
	// leaving a recovery path for the one association that withholding exists
	// to break is incoherent.
	//
	// **Unconditional, not conditional-on-removal**, and the reason is the
	// interesting part: a rule that fired only for removed comments would make
	// the key's own presence or absence the removal flag, on every row, in an
	// archive that already ships `mod_actions`. The conditional leaks the
	// condition. Uniform absence carries no signal at all.
	//
	// ⚠ Under the deny-list this needed saying as an explicit STRIP entry.
	// Under the allow-list it is simply not written down, which is the point:
	// the same outcome now costs nothing to maintain and cannot be lost by
	// somebody editing a different line.
	"image_upload.committed": {
		uploadId: true,
		etag: true,
		byteSizeActual: true,
	},
	"image_upload.blocked": {
		uploadId: true,
		modVerdict: true,
		reasonCategory: true,
	},
	// `orphaned` carries no `userId`; `uploadId` is the row id and SHIPS.
	"image_upload.orphaned": { uploadId: true },

	// — moderation —
	// Research keys `reason` / `banned` / `uploadId` SHIP (AUDIT-FIX-B5).
	"moderation.blocked": { reason: true, banned: true, uploadId: true },

	// — admin —
	// `sessionId` is the admin cookie value and `ip` is the admin's IP; both
	// are withheld as defense-in-depth on top of the BREAK_GLASS.md pre-freeze
	// rotation. Nothing else is on either payload, so both ship nothing — and
	// the empty object says that was decided, not overlooked.
	"admin.signed_in": {},
	"admin.signed_out": {},

	// — dharma —
	"dharma.credited": { amount: true, creditedForDate: true },
	"dharma.granted": { amount: true },

	// — bet / comment —
	// These are the K_eff(t) derivation core per §19.6: stake, side, price,
	// shares, proceeds, body length, and the market / bet / comment ids. Only
	// the actor's identity is withheld.
	"bet.placed": {
		betId: true,
		marketId: true,
		side: true,
		stake: true,
		shares: true,
		price: true,
		commentId: true,
		parentCommentId: true,
	},
	"bet.sold": {
		betId: true,
		marketId: true,
		side: true,
		sharesSold: true,
		proceeds: true,
		price: true,
	},
	// ⚠ `uploadId` is DELIBERATELY ABSENT — ruling S5, DATASET.3. It is the
	// other half of the recovery path `image_upload.committed.commentId` was
	// ratified to close: this payload carries `commentId` too, so the pair
	// rebuilds the association Appendix B.6 withholds in ONE ROW with no join.
	// Closing one end and leaving the other is not a partial mitigation; it is
	// none. `comments.image_uploads_id` already carries the link for every
	// comment that is not withheld, so nothing a researcher can use is lost.
	"comment.placed": {
		commentId: true,
		betId: true,
		marketId: true,
		side: true,
		parentCommentId: true,
		bodyLength: true,
	},

	// — market lifecycle —
	// Every `market.*` payload is admin-actor and carries no PII-class key, so
	// the whole declared shape ships. The actor is
	// `metadata.actor_id = 'admin-singleton'`, a sentinel never pseudonymized
	// (§19.5).
	//
	// ⚠ `media[]` is the one place a nested declaration is load-bearing. Its
	// `key` lives in the `m/<marketId>/` namespace — operator-curated, no user
	// id embedded, and Appendix B.16 ships the identical string as a
	// `market_media` column. `schemas.ts` declares the array `.min(1)`, so
	// EVERY market carries one: a rule that dropped it would hard-fail the
	// one-shot release build on the first real read (`@security-auditor` H-1).
	// Declaring the three child keys is what ships them WITHOUT shipping a
	// fourth key somebody adds to that object later.
	"market.created": {
		marketId: true,
		resolutionDeadline: true,
		media: { key: true, displayOrder: true, isDefault: true },
		mediaVideoUrl: true,
	},
	"market.opened": { marketId: true, seedAmount: true },
	"market.closed": { marketId: true },
	"market.resolving": { marketId: true },
	"market.resolved": {
		marketId: true,
		winningSide: true,
		resolutionNote: true,
		poolUnwindAmount: true,
	},
	"market.corrected": {
		marketId: true,
		correctsEventId: true,
		correctedWinningSide: true,
		resolutionNote: true,
	},
	"market.voided": {
		marketId: true,
		voidReason: true,
		poolUnwindAmount: true,
	},
} as const satisfies Record<EventType, ShipSpec>;

/**
 * The `metadata` sub-keys that SHIP, as a positive allow-list.
 *
 * ⚠ **This list is now what the metadata strip READS**, where it used to be a
 * declaration nobody consumed (`@code-reviewer` H-4 pinned it with a test
 * precisely because nothing in `src/` read it). Its own docblock claimed it
 * existed "so that a new metadata field fails the completeness guard rather
 * than silently shipping on the strength of not being named a secret" — a
 * guarantee that had no mechanism until the inversion gave it one.
 *
 * §3.7 declares seven metadata fields and this names the five that survive.
 * `ip` and `user_agent` are absent because they are PII (§19.4 rows 9–10) —
 * and, more to the point, so is anything a future author adds to that object.
 *
 * @see SHIPPED_METADATA_KEYS — the same list, kept for the manifest's derived
 * `metadata_fields_included` and for the parity tests.
 */
export const METADATA_SHIP_SPEC: ShipSpec = {
	request_id: true,
	flow_id: true,
	user_id: true,
	actor_id: true,
	idempotency_key: true,
};

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
	// Not among brief §4 Slice 1's six, and each required by Appendix B:
	"email", // B.1 STRIP, §19.4 row 1
	// ⚠ The three below were added after `@code-reviewer` H-4. Each is a
	// STRIP column that had no VALUE class, so the strongest assertion this
	// layer can make — "this exact string, known to be in the source, is
	// absent from the artifact" — had never been pointed at them. `users.name`
	// is the participant's real Google display name.
	"display-name", // B.1 `users.name` STRIP
	"avatar-url", // B.1 `users.image` STRIP
	"blocked-text", // B.10 `mod_actions.blocked_text` STRIP
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

/**
 * Is this R2 object key operator-curated market media (`m/<marketId>/…`)?
 *
 * The `m/` namespace ships (Appendix B.16, §19.4.1's `market.created` row);
 * the `u/` namespace never does, because SCAFFOLD.15 §Q9 embeds the user id in
 * the path. Matching on the prefix rather than on the column name is what lets
 * the same key NAME be safe in one place and a leak in another.
 *
 * ⚠ **Moved here from `assertions.ts` at DATASET.2 C2.** It lived next to its
 * one consumer while it had one; the recursive strip and the recursive harvest
 * are now consumers too, and a namespace rule enforced in the assertion but not
 * in the strip is a rule that fires *after* the value has already been removed.
 */
export function isMarketMediaKey(value: unknown): boolean {
	return typeof value === "string" && value.startsWith("m/");
}

/**
 * Does this (key, value) pair carry a forbidden KEY NAME but a value the spec
 * nonetheless SHIPS?
 *
 * ⚠ **One predicate, three consumers — the strip, the harvest and the
 * assertion — and that is the whole reason it exists as a function rather than
 * as three `startsWith("m/")` checks.** They have to agree by construction:
 *
 *   · the **strip** must not remove it (§19.4.1 ships `market.created.media[]`,
 *     and `key` is `.min(1)` in `schemas.ts`, so EVERY market carries one);
 *   · the **harvest** must not collect it as a secret, or the value scan then
 *     fires on `market_media.csv`, which ships the identical string as a
 *     column (Appendix B.16) — the build would fail on a value it published
 *     itself;
 *   · the **assertion** must not reject it after the other two let it through.
 *
 * Any one of the three disagreeing is a **guaranteed total build failure on a
 * one-shot job**, which is what `@security-auditor` H-1 measured when only the
 * assertion knew the rule. Going recursive multiplies the ways to disagree,
 * so the rule stops being three checks and becomes one.
 *
 * Today the only such pair is `key` in the `m/` namespace. It is written as a
 * general predicate rather than inlined so that a second exemption arrives as
 * one edit here, visible to all three layers at once, instead of as three
 * edits of which someone lands two.
 */
export function shipsDespiteForbiddenKey(key: string, value: unknown): boolean {
	return key === "key" && isMarketMediaKey(value);
}
