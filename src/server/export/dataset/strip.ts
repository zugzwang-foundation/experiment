import type { EventType } from "@/server/events/event-types";
import { EgressContractGapError } from "@/server/export/egress/errors";
import {
	METADATA_SHIP_SPEC,
	PAYLOAD_SHIP_KEYS,
	type ShipNode,
	type ShipSpec,
} from "@/server/export/egress/forbidden-keys";

import { maskRemovedComment } from "./removed";
import { treatmentsFor } from "./treatments";

/**
 * DATASET.1 Slice 4 — the egress transform. **Inverted at DATASET.3.**
 *
 * Three levels, because §19.4 and §19.4.1 operate at three and conflating them
 * loses one:
 *
 *   1. **Column** — Appendix B classifies every column of every shipped table.
 *      `STRIP` columns are removed from the released schema entirely
 *      (`users.email`, `mod_actions.image_r2_key`, …). This level is already
 *      an allow-list in effect: an unclassified column fails the build
 *      (`assertTreatmentsComplete`), because the schema is closed and every
 *      column has to be looked at once.
 *   2. **Metadata sub-key** — §3.7's seven fields; five ship.
 *   3. **Payload sub-key** — the §19.4.1 per-event-type declarations on
 *      `events.payload`.
 *
 * ## Levels 2 and 3 are ALLOW-lists, and that is the DATASET.3 change
 *
 * They were deny-lists: name the keys to remove, pass the rest through. That
 * is sound for a closed schema and unsound for `jsonb`, whose shape anyone can
 * extend — so "unlisted" was both the dangerous state and the state every new
 * key starts in. Three nights found the same class three times and each patch
 * extended a list. See `shipDeep` for the measured instance and
 * `PAYLOAD_SHIP_KEYS` for the declaration.
 *
 * ## Remove, never null
 *
 * A dropped key is DELETED, not set to `null`. Appendix B.23 prescribes
 * `metadata - 'ip'`, and the difference is not cosmetic: a surviving
 * `"ip": null` announces that the field existed and was withheld, which tells
 * an attacker the shape of what they are missing and tells a researcher a
 * column exists that never has data. The absent key says neither.
 *
 * ## Fail closed
 *
 * An event type with no §19.4.1 declaration THROWS rather than exporting a
 * blank payload. Under the old deny-list the alternative was a LEAK — the
 * whole unreviewed payload shipping. Under the allow-list the alternative is
 * a SILENCE, and the throw is still right: see `shipPayload` for why the two
 * failures are not equally recoverable.
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
 * Appendix B.11 already names) hits `shipPayload`'s unknown-type throw. That
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
 * Keep only the declared `metadata` sub-keys; drop everything else, unread.
 *
 * ⚠ **Inverted at DATASET.3 along with the payload strip, and for the same
 * reason.** This removed `ip` and `user_agent` and passed the rest through, so
 * a `metadata.trace` or `metadata.client` object added by any future handler
 * would have shipped on the strength of not being named. §3.7 declares seven
 * fields; five ship. Nothing else does, whatever it is called.
 *
 * Returns a NEW object; never mutates. The source rows are read once and fed
 * to several passes, and a mutating strip would make the pipeline's result
 * depend on the order those passes happened to run in.
 */
export function stripMetadata(metadata: unknown, where = "metadata"): unknown {
	if (metadata === null || metadata === undefined) return metadata;
	assertJsonObject("metadata", where, metadata);
	return shipDeep(metadata, METADATA_SHIP_SPEC, `${where}.metadata`);
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
 * Keep only what a SHIP declaration names, **at any depth and through
 * arrays**. Everything undeclared is dropped without being read.
 *
 * ## Why an allow-list (SPEC.2 §19.4.1, DATASET.3)
 *
 * This was `stripDeep(value, forbidden)` — remove the named keys, keep the
 * rest — until DATASET.3, and getting depth right (DATASET.2 C2) did not fix
 * what was wrong with it. A deny-list over an open `jsonb` column ships every
 * key nobody has named, and "nobody has named it" is the state every new key
 * starts in.
 *
 * The measured instance, from DATASET.2's own owed list: `payload.client.
 * remoteAddr` was unstripped (no rule names it), unharvested (`HARVEST_KEYS`
 * has no such spelling), unmatched by value (because it was never harvested)
 * and unmatched by key. **All four layers quiet, on one input.** Depth was
 * irrelevant to it, and no amount of extending the deny-list closes the class
 * — only inverting it does.
 *
 * ## What `true` means, and what it refuses to mean
 *
 * `true` ships a SCALAR. An object or array reached under `true` throws,
 * because "ship this subtree unread" is the deny-list's failure mode wearing
 * an allow-list's clothes: it is precisely how an unreviewed key rides out
 * inside a reviewed container. A container is declared by nesting, and an
 * array applies its child spec to every element.
 *
 * ## What this replaced, and what it made unnecessary
 *
 * The deny-list needed `shipsDespiteForbiddenKey` — the `m/` vs `u/` namespace
 * predicate — because it banned the key NAME `key` globally and then had to
 * carve out the one place §19.4.1 ships it (`market.created.media[].key`,
 * `.min(1)`, so every market carries one). That carve-out is what
 * `@security-auditor` H-1 measured as a guaranteed total build failure when
 * only one of its three consumers knew the rule.
 *
 * Under an allow-list the question does not arise: `media[].key` ships because
 * `market.created` declares it, and `image_upload.*`'s `key` does not ship
 * because nothing declares it. **Same outcome, one fewer rule that three
 * layers have to agree about.** The predicate survives in
 * `forbidden-keys.ts` for the harvest and the assertion, which still reason
 * about key names and still need it.
 *
 * Returns NEW containers throughout; never mutates. The source rows are read
 * once and fed to several passes, and a mutating pass would make the
 * pipeline's output depend on the order those passes happened to run in.
 *
 * @param where a human path used only in error messages, so a contract gap
 *              names the payload position rather than "somewhere in a row"
 */
export function shipDeep(
	value: unknown,
	node: ShipNode,
	where: string,
): unknown {
	// A declared scalar leaf.
	if (node === true) {
		if (value !== null && typeof value === "object") {
			throw new EgressContractGapError(
				where,
				`is declared as a shipped SCALAR but holds ${
					Array.isArray(value) ? "an array" : "an object"
				}. Refusing to ship a container nobody has described key by key — ` +
					"that is the deny-by-default hole this declaration exists to " +
					"close, because every key inside it would ship unreviewed. " +
					"Declare its shape in PAYLOAD_SHIP_KEYS and amend SPEC.2 " +
					"§19.4.1 in the same commit.",
			);
		}
		return value;
	}

	// Null is not a container and carries no keys to leak; an absent nested
	// object is an ordinary shape, not a contract gap.
	if (value === null || value === undefined) return value;

	// An array applies the SAME child spec to every element — these payload
	// arrays are homogeneous (`market.created.media[]` is the only live one).
	if (Array.isArray(value)) {
		return value.map((item, i) => shipDeep(item, node, `${where}[${i}]`));
	}

	if (typeof value !== "object") {
		throw new EgressContractGapError(
			where,
			`is declared as an object whose keys ship individually, but holds a ` +
				`${typeof value}. The declaration and the data disagree; refusing ` +
				"to guess which is right.",
		);
	}

	// ⚠ Iterate the VALUE's keys, not the declaration's, and keep the ones the
	// declaration names. Iterating the declaration would silently invent keys
	// a row does not have (`{"etag": undefined}` on a payload that predates
	// the column), and the emitted CSV would then describe a row that does not
	// exist. Filtering preserves the source's own key order too — irrelevant
	// to the bytes, since `escapeField` canonicalizes, but it keeps a debug
	// print of an intermediate readable against the row it came from.
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as SourceRow)) {
		const child = node[k];
		if (child === undefined) continue;
		out[k] = shipDeep(v, child, `${where}.${k}`);
	}
	return out;
}

/**
 * Apply the §19.4.1 per-event-type SHIP declaration to an `events.payload`.
 *
 * ⚠ **Throws on an unknown event type, rather than shipping `{}`.** Both are
 * safe for privacy — an undeclared type ships nothing either way — and the
 * throw is chosen because the two failures are not equally recoverable. An
 * abort names the missing declaration and stops; a silent `{}` would publish
 * blank payloads for a whole event type into a CC-BY corpus, deleting research
 * data with nobody noticing, and `events` is append-only so it could not be
 * corrected afterwards. `completeness.ts` catches the same gap months earlier,
 * at CI; this is what catches it if that guard is ever removed.
 */
export function shipPayload(eventType: string, payload: unknown): unknown {
	const spec = (PAYLOAD_SHIP_KEYS as Record<string, ShipSpec | undefined>)[
		eventType
	];

	if (spec === undefined) {
		throw new EgressContractGapError(
			`event_type: ${eventType}`,
			"has no SPEC.2 §19.4.1 SHIP declaration. Its payload has never been " +
				"PII-reviewed, because the review IS the §19.4.1 entry that is " +
				"missing. Declare what ships — '{}' if genuinely nothing does, " +
				"which is a decision to record rather than a default to fall into.",
		);
	}

	assertJsonObject("payload", eventType, payload);

	// ⚠ No union with a global forbidden-key net any more, and its absence is
	// deliberate. The deny-list needed one: SPEC.2 §19.4.1's per-row table
	// omits `userId` from `user.tos_accepted` while stripping it from all four
	// sibling `user.*` types, and `dataset-release.md` step 7 reads that
	// omission as intentional — expecting the row to *"show userId"*. That
	// would put a raw `users.id` into a CC-BY-4.0 artifact, so the global net
	// existed to correct a table that was wrong in one cell.
	//
	// An allow-list has no such failure mode. `userId` ships from a payload
	// only if somebody wrote it down, and nobody has. The correction is no
	// longer a patch applied on top of a faithful transcription; it is simply
	// the absence of a line. The global net survives in `assertions.ts` as an
	// independent second net over the OUTPUT, which is where a belt belongs.
	return shipDeep(payload, spec, `${eventType}.payload`);
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
			out[col] = shipPayload(String(source.event_type), value);
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
 * The event types that ship at least one payload key — i.e. those whose
 * payload survives the transform as something other than `{}`. Exported so the
 * pipeline can report what it kept rather than only that it ran.
 *
 * ⚠ Renamed and inverted at DATASET.3. It used to name the types with a
 * NON-EMPTY strip rule, which was the complement of this set and read as its
 * synonym — an easy thing to keep calling "the types with rules" after the
 * meaning of "rule" had flipped.
 */
export function eventTypesShippingPayloadKeys(): readonly EventType[] {
	return Object.entries(PAYLOAD_SHIP_KEYS)
		.filter(([, spec]) => Object.keys(spec).length > 0)
		.map(([t]) => t as EventType);
}
