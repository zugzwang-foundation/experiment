import type { EventType } from "@/server/events/event-types";
import { EgressContractGapError } from "@/server/export/egress/errors";
import {
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	PAYLOAD_STRIP_KEYS,
	STRIPPED_METADATA_KEYS,
	shipsDespiteForbiddenKey,
} from "@/server/export/egress/forbidden-keys";

import { maskRemovedComment } from "./removed";
import { treatmentsFor } from "./treatments";

/**
 * DATASET.1 Slice 4 — the STRIP pipeline.
 *
 * Three strips, at three levels, because §19.4 and §19.4.1 operate at three
 * levels and conflating them loses one of them:
 *
 *   1. **Column** — Appendix B `STRIP` columns are removed from the released
 *      schema entirely (`users.email`, `mod_actions.image_r2_key`, …).
 *   2. **Metadata sub-key** — `metadata.ip` / `metadata.user_agent`, removed
 *      from every audit table's JSONB.
 *   3. **Payload sub-key** — the §19.4.1 per-event-type rules on
 *      `events.payload`.
 *
 * ## Remove, never null
 *
 * Every strip DELETES the key. It does not set it to `null`. Appendix B.23
 * prescribes `metadata - 'ip'`, and the difference is not cosmetic: a
 * surviving `"ip": null` announces that the field existed and was withheld,
 * which tells an attacker the shape of what they are missing and tells a
 * researcher a column exists that never has data. The absent key says
 * neither.
 *
 * ## Fail closed
 *
 * An event type with no strip rule THROWS rather than passing its payload
 * through. Passing through is the dangerous default — the payload has never
 * been PII-reviewed, because the review IS the §19.4.1 table entry — and it is
 * the default a reasonable person writes without thinking about it.
 */

/** A JSON-shaped row as read from Postgres. */
export type SourceRow = Record<string, unknown>;

/**
 * Strip inputs the caller must supply.
 *
 * ⚠ **`removedCommentIds` is REQUIRED, and that is the whole point.** It was
 * optional, defaulting to no masking — so `stripTable("comments", rows)`
 * published every reactively-removed body and gave no signal
 * (`@security-auditor` M-9). The build path passed it; any second caller — a
 * v2 rebuild script, a partial re-export, a debug tool — would not have.
 *
 * SC-1's whole claim is that masking is a property of the CODE PATH, not of
 * the caller's memory. A required argument is what makes forgetting it a
 * compile error rather than a silent publication (O-1: structural beats
 * procedural). Pass an empty set explicitly when a table genuinely has no
 * removals — that is a statement, where omission was an accident.
 */
export interface StripOptions {
	readonly removedCommentIds: ReadonlySet<string>;
}

/**
 * Tables whose `payload` JSONB is subject to the §19.4.1 per-event-type
 * rules, keyed on their own `event_type` column.
 *
 * ⚠ **§19.4.1 is written as though only `events.payload` existed, and two
 * other shipped tables carry a `payload` of the same shape.** Appendix B.11
 * and B.12 give `admin_events.payload` and `user_events.payload` a bare
 * `SHIP` with no strip rules — but `admin_events` rows are the same
 * `admin.signed_in` facts, carrying the same `sessionId` and `ip` keys that
 * §19.4.1 strips from `events`. Applying the rules to one table and not the
 * others would strip a value from one row and publish it from its twin.
 *
 * Latent today: both tables have ZERO writers (`ADMIN-EVENTS-WRITER`, and the
 * same is true of `user_events` and recorded nowhere), so both ship empty.
 * It stops being latent the moment the parked entry's recommended fix lands —
 * option (a) is a PROJECTION of `events` into `admin_events`, which would
 * deliver exactly these payloads into a table with no rules covering them.
 *
 * ⚠ **And when that lands, expect this to FAIL LOUDLY first, by design.**
 * `admin_events.event_type` and `user_events.event_type` are `text`
 * (open-extensible per §7.1), not the closed `EVENT_TYPES` set — so a
 * projection introducing its own vocabulary (`admin.market_resolved`, which
 * Appendix B.11 already names) hits `stripPayload`'s unknown-type throw. That
 * is the correct direction: an unreviewed payload must not ship. But it means
 * the projection task inherits a required step — extend §19.4.1 to cover the
 * admin vocabulary — and finding that out via a build failure is better than
 * finding it out via a published artifact (`@security-auditor` LOW).
 */
export const PAYLOAD_BEARING_TABLES = new Set([
	"events",
	"admin_events",
	"user_events",
]);

/**
 * Remove the two PII sub-keys from a `metadata` JSONB value.
 *
 * Returns a NEW object; never mutates. The source rows are read once and fed
 * to several passes, and a mutating strip would make the pipeline's result
 * depend on the order those passes happened to run in.
 */
export function stripMetadata(metadata: unknown, where = "metadata"): unknown {
	if (metadata === null || metadata === undefined) return metadata;
	assertJsonObject("metadata", where, metadata);
	return stripDeep(metadata, new Set(STRIPPED_METADATA_KEYS));
}

/**
 * A `payload` / `metadata` column must be a plain JSON OBJECT.
 *
 * ⚠ **This is the correction to a genuine fail-OPEN** (`@code-reviewer`
 * HIGH-2). Both strips previously returned the value unchanged when it was not
 * an object — `if (typeof value !== "object") return value` — which reads like
 * defensive coding and is the opposite. A stringified JSONB column then walked
 * straight through **all four layers at once**, measured end to end on a build
 * that reported zero violations and zero advisories while emitting into
 * `events.csv`: a raw ip, a raw user-agent, a raw `users.id` and a raw admin
 * session id.
 *
 * Every layer goes quiet on the same input, and each for a different reason —
 * which is why nothing caught it:
 *
 *   · the **strip** returns early, so nothing is removed;
 *   · the **harvest** walks a string, `walk` yields one entry with
 *     `key === null`, the loop skips it, and the secrets are never collected —
 *     so the value scan is never told to look for them;
 *   · **`findValues`** is whole-leaf equality and the leaf is the entire JSON
 *     blob, so no needle matches;
 *   · **`findKeys`** sees no keys at all.
 *
 * The file's own docblock claims this pipeline fails closed. It did, for an
 * unknown event *type*, and did not for an unexpected *value shape*. Failing
 * the build is recoverable; publishing is not.
 */
function assertJsonObject(
	column: string,
	where: string,
	value: unknown,
): asserts value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new EgressContractGapError(
			`${where}.${column}`,
			`is ${Array.isArray(value) ? "an array" : `a ${typeof value}`}, not a ` +
				"JSON object. Refusing to pass it through: a non-object payload or " +
				"metadata is invisible to the strip, to the secret harvest, to the " +
				"value scan and to the key scan simultaneously — every guard " +
				"reports clean while the whole blob ships verbatim.",
		);
	}
}

/**
 * Remove every `forbidden` key from a JSON-shaped value **at any depth**,
 * descending through objects and through arrays of objects.
 *
 * ## Why depth (SPEC.2 §19.4.1, DATASET.2 C2)
 *
 * This walked exactly one level until DATASET.2, and the one-level walk was
 * **correct for every payload shape that exists today** — which is precisely
 * what made it worth changing rather than leaving. `@security-auditor` H-3
 * found that a nested secret is neither stripped nor harvested nor
 * key-matched, and closed the single live instance
 * (`market.created.payload.media[].key`) by hand.
 *
 * Depth is not a property a future author thinks to check when they add an
 * event type. They are asked, by the shape of §19.4.1's table, only *which
 * keys* are sensitive — so a payload that nests one is the default outcome of
 * following the contract as written, not a mistake someone has to make.
 *
 * ⚠ **What the shallow strip actually did — corrected after measuring it**
 * (`@test-writer` HIGH-1). This docblock previously claimed the gap was
 * *silent*: that a nested secret was neither stripped nor harvested, so "both
 * layers go quiet at once and the build reports success". **That is false for
 * any nested key on one of the nets.** `walk()` has been recursive since
 * DATASET.1 and both KEY nets ride on it, so `findKeys` saw nested `userId` /
 * `ip` / `key` whatever the strip did. Measured against the fixture with the
 * one-level strip restored: **8 fatal violations**.
 *
 * ⇒ The shallow strip was a **guaranteed build ABORT on a one-shot job**, not
 * a leak. Worth fixing for that alone — an abort on the morning of 6 November
 * is as expensive as a leak, in a different currency — but the honest reason
 * is not the one first written here.
 *
 * ⚠ **The genuinely silent case is narrower and recursion does NOT close it.**
 * A nested secret under a key name on no list at all — `payload.client.
 * remoteAddr` — is unstripped (no rule names it), unharvested (`HARVEST_KEYS`
 * has no such spelling), unmatched by value (because it was never harvested)
 * and unmatched by key. All four layers really are quiet, and depth is
 * irrelevant to it. Closing it needs either a value-SHAPED net over payload
 * leaves or a positive allow-list of shipped payload keys per event type —
 * both spec decisions, both owed.
 *
 * ## Why the namespace predicate rides along
 *
 * Recursion is what makes `shipsDespiteForbiddenKey` load-bearing *here*
 * rather than only in the assertion. `market.created.payload.media[].key` is
 * a required field on every market and §19.4.1 SHIPs it; a depth rule applied
 * without the namespace rule deletes it, and the first real read of a live
 * `market.created` row hard-fails the one-shot release build. See that
 * predicate's docblock — the strip, the harvest and the assertion must agree
 * by construction.
 *
 * Returns NEW containers throughout; never mutates. The source rows are read
 * once and fed to several passes, and a mutating strip would make the
 * pipeline's output depend on the order those passes happened to run in.
 */
export function stripDeep(
	value: unknown,
	forbidden: ReadonlySet<string>,
): unknown {
	if (value === null || typeof value !== "object") return value;

	if (Array.isArray(value)) {
		return value.map((item) => stripDeep(item, forbidden));
	}

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as SourceRow)) {
		if (forbidden.has(k) && !shipsDespiteForbiddenKey(k, v)) continue;
		out[k] = stripDeep(v, forbidden);
	}
	return out;
}

/**
 * Apply the §19.4.1 per-event-type STRIP rules to an `events.payload`.
 *
 * ⚠ Throws on an unknown event type. See the fail-closed note above — the
 * alternative is that a type added between releases ships its whole payload
 * into a public artifact on the strength of nobody having written it a rule.
 */
export function stripPayload(eventType: string, payload: unknown): unknown {
	const rules = (PAYLOAD_STRIP_KEYS as Record<string, readonly string[]>)[
		eventType
	];

	if (rules === undefined) {
		throw new EgressContractGapError(
			`event_type: ${eventType}`,
			"no SPEC.2 §19.4.1 STRIP rule. Refusing to pass the payload through " +
				"unstripped — the payload has never been PII-reviewed, because the " +
				"review is the §19.4.1 entry that is missing.",
		);
	}

	assertJsonObject("payload", eventType, payload);

	// ⚠ The union with the global net is LOAD-BEARING and is not belt-and-
	// braces tidiness. SPEC.2 §19.4.1's per-row table omits `userId` from
	// `user.tos_accepted` while stripping it from all four sibling `user.*`
	// types, each with the stated rationale *"prevents re-identification via
	// cross-join"* — and `dataset-release.md` step 7 confirms the omission is
	// read as intentional, expecting that row's payload to *"show userId"*.
	//
	// That would put a raw `users.id` into `events.payload` on a CC-BY-4.0
	// artifact, which brief §5's sixth wall forbids absolutely. Appendix B.13
	// is the more complete statement and lists `userId` in the general strip
	// set for `events.payload`, so the union follows B rather than the
	// per-row table — the same precedence this task applies everywhere else.
	//
	// Keeping `PAYLOAD_STRIP_KEYS` a FAITHFUL transcription of §19.4.1 and
	// applying the correction here is deliberate: the registry stays
	// auditable line-by-line against the spec, and the divergence is one
	// documented place rather than an untraceable edit inside the table.
	const forbidden = new Set([...rules, ...GLOBALLY_FORBIDDEN_PAYLOAD_KEYS]);

	// ⚠ DEPTH (DATASET.2 C2 / SPEC.2 §19.4.1): the rules apply at any nesting
	// level and through arrays, not only to top-level keys. See `stripDeep`.
	return stripDeep(payload, forbidden);
}

/**
 * Strip one row of one table: drop every `STRIP` column, then strip the
 * `metadata` and (on `events`) `payload` JSONB sub-keys.
 *
 * `NULL_IF_ERASED` columns are passed through untouched — H2 erasure has
 * already nulled them in the source where it fired, and §19.4's H2 note is
 * explicit that erased and never-populated rows must be indistinguishable in
 * the release. Re-nulling here would be a no-op; *stripping* here would delete
 * a column that ships.
 */
export function stripRow(
	table: string,
	row: SourceRow,
	opts: StripOptions,
): SourceRow {
	const treatments = treatmentsFor(table);

	if (treatments === undefined) {
		throw new EgressContractGapError(
			`table: ${table}`,
			"no Appendix B per-column treatment block. Refusing to export a table " +
				"whose columns nobody has classified.",
		);
	}

	// ⚠ Reactive-removal masking, BEFORE the column walk. Removal is
	// read-side (a `content_removed` mod_actions row; no write to `comments`),
	// so a read that does not intersect the removed set publishes the body —
	// CLAUDE.md §5.14 SC-1. See `removed.ts` for why this withholds absent a
	// ruling rather than shipping per Appendix B.6's bare SHIP.
	// ⚠ `opts.removedCommentIds.has(…)`, NOT `?.has(…)`. The optional chain
	// turned a missing set into `undefined` → falsy → no masking and NO
	// ERROR, which sawed the brace off the belt: the required type is the
	// compile-time guarantee, and this throw is the runtime one for any
	// caller that reaches here through an `any` seam, a JSON-shaped options
	// object, or a `tsx` script without full type coverage
	// (`@security-auditor` F-11 M-C).
	const source =
		table === "comments" &&
		typeof row.id === "string" &&
		opts.removedCommentIds.has(row.id)
			? maskRemovedComment(row)
			: row;

	const out: SourceRow = {};
	for (const [col, value] of Object.entries(source)) {
		if (treatments[col] === "STRIP") continue;

		if (col === "metadata") {
			out[col] = stripMetadata(value, table);
			continue;
		}
		if (col === "payload" && PAYLOAD_BEARING_TABLES.has(table)) {
			out[col] = stripPayload(String(source.event_type), value);
			continue;
		}
		out[col] = value;
	}
	return out;
}

/** Strip every row of one table. */
export function stripTable(
	table: string,
	rows: readonly SourceRow[],
	opts: StripOptions,
): SourceRow[] {
	return rows.map((r) => stripRow(table, r, opts));
}

/**
 * The event types whose payload rule is non-empty — i.e. those where a strip
 * measurably changes the row. Exported so the pipeline can report how many
 * keys it actually removed, rather than only that it ran.
 */
export function eventTypesWithStripRules(): readonly EventType[] {
	return Object.entries(PAYLOAD_STRIP_KEYS)
		.filter(([, keys]) => (keys as readonly string[]).length > 0)
		.map(([t]) => t as EventType);
}
