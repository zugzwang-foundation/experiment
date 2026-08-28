import { EgressContractGapError } from "@/server/export/egress/errors";

import type { SourceRow } from "./strip";
import { treatmentsFor } from "./treatments";

/**
 * DATASET.1 Slice 5 — export-time JOIN pseudonymization (SPEC.2 §19.5).
 *
 * Every FK reference to `users.id` becomes the `users.pseudonym` slug, so that
 * cross-table joins in the released archive work on readable keys and no raw
 * UUID leaves the `users` table.
 *
 * ## Three distinct rewrites, which is one more than §19.5's prose implies
 *
 *   1. **Column rename + value rewrite.** `bets.user_id` → `bets.user_pseudonym`.
 *      §19.5 names the rename explicitly. `mod_actions.target_user_id` becomes
 *      `target_user_pseudonym`, not `user_pseudonym` (Appendix B.10) — the
 *      prefix carries which user it is, and flattening it would silently
 *      relabel "the user who was moderated" as "the user who acted".
 *
 *   2. **Value rewrite, key preserved.** `metadata.actor_id` keeps its key and
 *      rewrites its value, because the column is polymorphic: it holds either
 *      a participant UUID or the `'admin-singleton'` / `'system'` sentinel.
 *      Appendix B.13 describes it that way — *"sentinel preserved literally;
 *      participant-actor values rewrite to pseudonym"*. ⚠ A rename here would
 *      be wrong in a way a rename elsewhere is not: a CSV column cannot change
 *      its name per row, so `actor_id` would have to become `actor_pseudonym`
 *      for every row including the sentinel ones, which mislabels the sentinel
 *      as a pseudonym.
 *
 *      ⚠ **DIVERGENCE, and it is the fourth — flagged, not silent.** The rule
 *      above follows Appendix **B.13** (`events`) and applies it uniformly.
 *      Appendix **B.12** (`user_events`) says something different for the same
 *      key: `metadata.actor_id` *"rewritten to `actor_pseudonym`"* — a rename
 *      — and **B.11** (`admin_events`) says something different again, marking
 *      `metadata.user_id` a plain `SHIP_KEY` with no rename at all. Three
 *      appendix sections, three treatments, one JSONB key.
 *
 *      Uniform-per-B.13 is chosen because `user_events.metadata.actor_id` is
 *      self-actor (it echoes `user_id`), so under B.12 the same identity would
 *      arrive twice under two different key names in one object — and because
 *      a per-table key name makes the three audit tables structurally
 *      incomparable for no research gain.
 *
 *      **Nil impact today**, and that is why it is a comment rather than a
 *      halt: `admin_events` and `user_events` both have ZERO writers, so both
 *      ship empty. It becomes live the moment either gains one — which the
 *      `ADMIN-EVENTS-WRITER` projection would do. **Needs a web-authored
 *      ruling before that lands.** (Surfaced by `@test-writer` M-2; the plan's
 *      §6 item 4 justified this from B.13 alone and had not read B.12.)
 *
 *   3. **Nested JSONB rewrite.** `events.metadata.user_id` →
 *      `events.metadata.user_pseudonym`, inside the JSONB value. The brief
 *      names this as the path most likely to be missed, and it is: it is the
 *      only rewrite that no column-level treatment loop will ever reach.
 *
 * ## Unknown ids fail closed
 *
 * A `user_id` absent from the pseudonym map THROWS. The tempting fallback —
 * leave the raw value — is the exact failure the wall forbids, and it would
 * happen precisely in the case nobody anticipated. Failing the build is
 * recoverable; publishing is not.
 */

/** `users.id` → `users.pseudonym`, built from the source `users` table. */
export type PseudonymMap = ReadonlyMap<string, string>;

/**
 * Sentinels that are NOT user ids and must survive verbatim.
 *
 * §19.5: *"admin has no `users` row, no pseudonym to map. Researchers
 * analyzing admin-actor patterns filter on the literal sentinel string"* — so
 * rewriting one would not merely be wrong, it would delete the admin-action
 * analysis the dataset promises.
 */
export const ACTOR_SENTINELS = new Set(["admin-singleton", "system"]);

/** Build the map from source `users` rows. */
export function buildPseudonymMap(users: readonly SourceRow[]): PseudonymMap {
	const map = new Map<string, string>();
	for (const u of users) {
		const id = u.id;
		const pseudonym = u.pseudonym;
		if (typeof id !== "string" || typeof pseudonym !== "string") {
			throw new EgressContractGapError(
				`users row ${String(id)}`,
				"a users row is missing `id` or `pseudonym`; every participant must " +
					"be mappable or downstream tables cannot be pseudonymized at all",
			);
		}
		map.set(id, pseudonym);
	}
	return map;
}

/** Resolve one id, failing closed. */
function resolve(id: string, map: PseudonymMap, where: string): string {
	const pseudonym = map.get(id);
	if (pseudonym === undefined) {
		throw new EgressContractGapError(
			where,
			"carries a users.id with no pseudonym in the map. Refusing to fall " +
				"back to the raw UUID — that is the re-identification vector the " +
				"strip-not-hash posture exists to close, on an artifact that cannot " +
				"be un-downloaded.",
		);
	}
	return pseudonym;
}

/** The renamed column for a PSEUDO column. */
export function pseudonymColumnName(column: string): string {
	// `target_user_id` → `target_user_pseudonym`; `user_id` → `user_pseudonym`.
	// Written as a suffix swap rather than a lookup table so a future PSEUDO
	// column (`lots.user_id`, if G3 rules YES) needs no edit here.
	if (column.endsWith("user_id")) {
		return `${column.slice(0, -"user_id".length)}user_pseudonym`;
	}
	return `${column}_pseudonym`;
}

/**
 * Rewrite `metadata`'s identity keys (Appendix B.11/B.12/B.13).
 *
 * `user_id` renames to `user_pseudonym`; `actor_id` keeps its key and rewrites
 * its value unless it is a sentinel. `null` `user_id` (admin/system actors)
 * passes through as a `null` `user_pseudonym` rather than being dropped —
 * dropping it would make an admin-actor row structurally different from a
 * participant row, which is a shape difference researchers would have to
 * special-case for no reason.
 */
export function pseudonymizeMetadata(
	metadata: unknown,
	map: PseudonymMap,
	where: string,
): unknown {
	if (metadata === null || typeof metadata !== "object") return metadata;
	if (Array.isArray(metadata)) return metadata;

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(metadata as SourceRow)) {
		if (k === "user_id") {
			out.user_pseudonym =
				typeof v === "string"
					? resolve(v, map, `${where}.metadata.user_id`)
					: v;
			continue;
		}
		if (k === "actor_id") {
			out.actor_id =
				typeof v === "string" && !ACTOR_SENTINELS.has(v)
					? resolve(v, map, `${where}.metadata.actor_id`)
					: v;
			continue;
		}
		out[k] = v;
	}
	return out;
}

/**
 * `events.aggregate_id` — Appendix B.13's `SHIP_OR_PSEUDO`, resolved per row.
 *
 * ⚠ **A blanket rule in either direction is wrong.** Ship-all leaks a raw
 * `users.id` on every `user` and `dharma_account` aggregate row. Pseudonymize-
 * all corrupts the `market` / `bet` / `comment` / `image_upload` / `mod_action`
 * rows, whose `aggregate_id` is that table's PK and not a user at all — and
 * would throw on every one of them, since no market id is in the map.
 *
 * `admin_session` ships raw by explicit decision (B.13): the value is the admin
 * cookie, and it is covered by `BREAK_GLASS.md` rotation plus the §19.4.1
 * payload strip rather than by pseudonymization, since there is no `users` row
 * to map it to.
 */
export const USER_BEARING_AGGREGATES = new Set(["user", "dharma_account"]);

/**
 * What an `admin_session` aggregate_id is replaced with.
 *
 * ⚠ **DELIBERATE DIVERGENCE FROM APPENDIX B.13 — flagged, not silent.**
 *
 * B.13 rules that `admin_session` `aggregate_id` *"SHIPs raw — defense-in-depth
 * covered by `BREAK_GLASS.md` rotation + payload STRIP rules per §19.4.1"*.
 * That value is the admin session cookie. Three things are true at once and
 * they do not reconcile:
 *
 *   1. §19.4.1 strips `payload.sessionId` from `admin.signed_in` with the
 *      rationale *"Cookie value + admin IP defense-in-depth"* — so the SAME
 *      value, in the SAME row, is stripped from one field and published from
 *      another.
 *   2. §19.3 row 21 withholds the entire `admin_sessions` table as
 *      *"operational; admin-side privacy-sensitive"*. Publishing the session
 *      id through `events.aggregate_id` partially undoes that withholding.
 *   3. The stated mitigation is an operator step — `dataset-release.md` step 1,
 *      admin session rotation, six hours before the freeze. It is real, but it
 *      makes the release's privacy contingent on a human remembering a
 *      checklist item, for an artifact that cannot be withdrawn.
 *
 * Redaction costs the ability to correlate a signed_in with its signed_out.
 * Nothing in §19.6 or SPEC.1 G3 names that as a research need, and the table
 * that would support it is withheld anyway — so the correlation is already
 * unavailable by design, and shipping the id here restores it only for
 * whoever wants to re-identify the admin.
 *
 * A fixed sentinel rather than a hash: §19.4's strip-not-hash policy rejects
 * hashing precisely because it invites confirmation attacks, and a per-session
 * opaque token would be pseudonymization of an entity with no pseudonym.
 *
 * **This needs a web-authored ruling.** If B.13 is affirmed, delete this and
 * the guard in `assertions.ts` together — but affirm it knowing §19.4.1
 * strips the same bytes one field over.
 */
export const REDACTED_ADMIN_SESSION = "[redacted-admin-session]";

export function pseudonymizeAggregateId(
	aggregateType: unknown,
	aggregateId: unknown,
	map: PseudonymMap,
	where: string,
): unknown {
	if (typeof aggregateType !== "string" || typeof aggregateId !== "string") {
		return aggregateId;
	}
	if (aggregateType === "admin_session") return REDACTED_ADMIN_SESSION;
	if (!USER_BEARING_AGGREGATES.has(aggregateType)) return aggregateId;
	return resolve(aggregateId, map, `${where}.aggregate_id (${aggregateType})`);
}

/**
 * Pseudonymize one row of one table.
 *
 * ⚠ `users` is passed through unchanged. §19.5's last paragraph preserves
 * `users.id` there as a join key for cross-table integrity verification, and
 * `users.pseudonym` is already the readable key — there is nothing to rewrite.
 */
export function pseudonymizeRow(
	table: string,
	row: SourceRow,
	map: PseudonymMap,
): SourceRow {
	if (table === "users") return { ...row };

	const treatments = treatmentsFor(table);
	if (treatments === undefined) {
		throw new EgressContractGapError(
			`table: ${table}`,
			"no Appendix B per-column treatment block",
		);
	}

	const where = `${table}[${String(row.id ?? row.event_id ?? "?")}]`;
	const out: SourceRow = {};

	for (const [col, value] of Object.entries(row)) {
		const treatment = treatments[col];

		if (treatment === "PSEUDO") {
			out[pseudonymColumnName(col)] =
				typeof value === "string"
					? resolve(value, map, `${where}.${col}`)
					: value;
			continue;
		}

		if (treatment === "SHIP_OR_PSEUDO" && col === "aggregate_id") {
			out[col] = pseudonymizeAggregateId(row.aggregate_type, value, map, where);
			continue;
		}

		if (col === "metadata") {
			out[col] = pseudonymizeMetadata(value, map, where);
			continue;
		}

		out[col] = value;
	}
	return out;
}

/** Pseudonymize every row of one table. */
export function pseudonymizeTable(
	table: string,
	rows: readonly SourceRow[],
	map: PseudonymMap,
): SourceRow[] {
	return rows.map((r) => pseudonymizeRow(table, r, map));
}
