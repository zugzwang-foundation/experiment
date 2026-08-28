import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { EgressContractGapError } from "@/server/export/egress/errors";

import { TABLE_INVENTORY } from "./inventory";

/**
 * DATASET.1 Slice 3 — the per-column treatment map (SPEC.2 Appendix B).
 *
 * ## Appendix B is the authority, not §19.4 or §19.5
 *
 * Both of those read like inventories and neither is exhaustive:
 *
 *   · §19.5's six-bullet FK list omits `positions`, `payout_events` and
 *     `user_events` — all three ship, all three carry a raw `users.id`, and
 *     Appendix B.4 / B.8 / B.12 each mark it PSEUDO. B's own coverage note
 *     settles the intent: *"every `user_id` / `target_user_id` FK gets
 *     rewritten"* — ~14 columns, not 6.
 *   · §19.4's ten-column table omits `mod_actions.blocked_text` and
 *     `mod_actions.image_r2_key`, both STRIP per B.10 — and *includes*
 *     `users.pfp_filename`, which B.1 marks NULL_IF_ERASED because it ships.
 *
 * §19.8 routes per-column questions to Appendix B. This file is B, transcribed
 * and then **cross-checked against the live schema in both directions**, which
 * is what B's own preamble asks for: *"any column in source that is not
 * enumerated here is a coverage gap; any column enumerated here that does not
 * exist in source is a drift fix."*
 */

/** Appendix B's five treatments, verbatim from its preamble. */
export type ColumnTreatment =
	/** Ships verbatim from the Postgres source. */
	| "SHIP"
	/** Carries a raw `users.id`; rewritten to the pseudonym slug (§19.5). */
	| "PSEUDO"
	/** Dropped from the released schema entirely (PII per §19.4). */
	| "STRIP"
	/** A JSONB sub-key dropped from a `metadata` / `payload` column. */
	| "STRIP_KEY"
	/** Ships, except H2-erased rows, which release as NULL. */
	| "NULL_IF_ERASED"
	/**
	 * Resolved per-row rather than per-column. Appendix B.13 uses this for
	 * `events.aggregate_id`: `user`-aggregate rows pseudonymize, every other
	 * aggregate type ships raw, and `admin_session` ships raw by explicit
	 * decision. ⚠ A blanket rule in EITHER direction is wrong here — shipping
	 * all raw leaks user ids, pseudonymizing all corrupts six aggregate types
	 * whose ids are market/bet/comment/upload PKs, not users.
	 */
	| "SHIP_OR_PSEUDO";

/**
 * Per-shipped-table column treatments. Keys are DB column names as they
 * appear in Postgres (snake_case), matching Appendix B and the JSONB stored
 * shape, not the drizzle property names.
 *
 * Only SHIPPED tables appear — Appendix B.17: the not-shipped five *"have no
 * per-column treatment because they don't ship"*, and `lots` deliberately has
 * no section at all (B.19) because writing one *"would be indistinguishable
 * from having decided."*
 */
export const COLUMN_TREATMENTS = {
	// B.1
	users: {
		id: "SHIP", // §19.5: raw id preserved HERE ONLY, as a join key
		name: "STRIP",
		email: "STRIP",
		email_verified: "SHIP",
		image: "STRIP",
		pseudonym: "SHIP",
		google_id: "STRIP",
		pfp_filename: "NULL_IF_ERASED", // ⚠ NOT strip — §19.4 row 7 mislabels it
		tos_accepted_at: "SHIP",
		tos_version_hash: "SHIP",
		privacy_version_hash: "SHIP",
		tos_acceptance_ip: "STRIP",
		tos_acceptance_user_agent: "STRIP",
		last_allowance_accrued_at: "SHIP",
		banned_at: "SHIP",
		created_at: "SHIP",
		updated_at: "SHIP",
	},
	// B.2
	markets: {
		id: "SHIP",
		slug: "SHIP",
		title: "SHIP",
		description: "SHIP",
		status: "SHIP",
		resolution_deadline: "SHIP",
		resolved_at: "SHIP",
		resolution_outcome: "SHIP",
		media_video_url: "SHIP",
		created_by: "SHIP", // 'admin-singleton' sentinel — never pseudonymized
		created_at: "SHIP",
	},
	// B.3
	pools: {
		id: "SHIP",
		market_id: "SHIP",
		yes_reserves: "SHIP",
		no_reserves: "SHIP",
		created_at: "SHIP",
	},
	// B.4 — ⚠ absent from §19.5's six-bullet list
	positions: {
		id: "SHIP",
		user_id: "PSEUDO",
		market_id: "SHIP",
		side: "SHIP",
		quantity: "SHIP",
		created_at: "SHIP",
		updated_at: "SHIP",
	},
	// B.5
	bets: {
		id: "SHIP",
		user_id: "PSEUDO",
		market_id: "SHIP",
		side: "SHIP",
		stake: "SHIP",
		share_quantity: "SHIP",
		price_at_bet: "SHIP",
		comment_id: "SHIP",
		idempotency_key: "SHIP", // client-generated opaque string; no PII
		created_at: "SHIP",
	},
	// B.6
	comments: {
		id: "SHIP",
		user_id: "PSEUDO",
		market_id: "SHIP",
		parent_comment_id: "SHIP",
		body: "SHIP", // the thesis-core signal; post-moderation rows only
		image_uploads_id: "SHIP",
		side_at_post_time: "SHIP",
		bet_id: "SHIP",
		created_at: "SHIP",
	},
	// B.7
	dharma_ledger: {
		id: "SHIP",
		seq: "SHIP",
		user_id: "PSEUDO",
		bet_id: "SHIP",
		entry_type: "SHIP",
		amount: "SHIP",
		balance_after: "SHIP",
		created_at: "SHIP",
	},
	// B.8 — ⚠ absent from §19.5's six-bullet list
	payout_events: {
		id: "SHIP",
		bet_id: "SHIP",
		user_id: "PSEUDO",
		market_id: "SHIP",
		resolution_event_id: "SHIP",
		payout_type: "SHIP",
		amount: "SHIP",
		created_at: "SHIP",
	},
	// B.9
	resolution_events: {
		id: "SHIP",
		market_id: "SHIP",
		event_kind: "SHIP",
		outcome: "SHIP",
		corrects_event_id: "SHIP",
		reason: "SHIP",
		created_at: "SHIP",
	},
	// B.10 — two STRIPs that §19.4's ten-column table does not name
	mod_actions: {
		id: "SHIP",
		target_user_id: "PSEUDO", // → `target_user_pseudonym`, not `user_pseudonym`
		target_comment_id: "SHIP",
		target_bet_id: "SHIP",
		target_market_id: "SHIP",
		reason: "SHIP",
		verdict: "SHIP",
		categories: "SHIP",
		blocked_text: "STRIP", // the rejected comment body; admin-only
		image_r2_key: "STRIP", // ⚠ an R2 key, and R2 keys embed the userId
		actor_id: "SHIP", // 'system' / 'admin-singleton' sentinels
		created_at: "SHIP",
	},
	// B.11 — ⚠ ships EMPTY (zero writers; ADMIN-EVENTS-WRITER)
	admin_events: {
		id: "SHIP",
		event_type: "SHIP",
		payload: "SHIP",
		metadata: "SHIP", // sub-keys handled by the metadata rules, not here
		created_at: "SHIP",
	},
	// B.12 — ⚠ also ships EMPTY, and unlike admin_events nothing records it
	user_events: {
		id: "SHIP",
		user_id: "PSEUDO",
		event_type: "SHIP",
		payload: "SHIP",
		metadata: "SHIP",
		created_at: "SHIP",
	},
	// B.13
	events: {
		event_id: "SHIP",
		event_type: "SHIP",
		aggregate_type: "SHIP",
		aggregate_id: "SHIP_OR_PSEUDO", // per aggregate_type — see the type doc
		payload: "SHIP", // with per-event-type STRIP_KEY rules (§19.4.1)
		payload_version: "SHIP",
		metadata: "SHIP",
		created_at: "SHIP",
	},
	// B.14
	identity_pool: {
		id: "SHIP",
		colour: "SHIP",
		animal: "SHIP",
		number: "SHIP",
		pseudonym: "SHIP",
		pfp_filename: "SHIP",
		assigned_at: "SHIP",
		created_at: "SHIP",
	},
	// B.15
	image_uploads: {
		id: "SHIP",
		user_id: "PSEUDO",
		r2_object_key: "STRIP",
		content_type: "SHIP",
		byte_size: "SHIP",
		terminal_state: "SHIP",
		terminal_at: "SHIP",
		created_at: "SHIP",
	},
	// B.16 — ⚠ this r2_object_key SHIPS, unlike image_uploads'. It lives in
	// the `m/<marketId>/` namespace: operator-curated, no userId embedded.
	market_media: {
		id: "SHIP",
		market_id: "SHIP",
		r2_object_key: "SHIP",
		display_order: "SHIP",
		is_default: "SHIP",
		created_by: "SHIP",
		created_at: "SHIP",
	},
} as const satisfies Record<string, Record<string, ColumnTreatment>>;

export type TreatedTable = keyof typeof COLUMN_TREATMENTS;

/**
 * Per-column treatments for one table, or `undefined` if it has none.
 *
 * ⚠ Returns `ColumnTreatment`, not `string`. Callers previously reached the
 * map through `COLUMN_TREATMENTS as Record<string, Record<string, string>>`,
 * which widened the union at four `=== "STRIP"` / `=== "PSEUDO"` comparison
 * sites and let a typo'd literal compare cleanly against nothing
 * (`@code-reviewer` M-13). The `satisfies` on the declaration keeps the map
 * honest; this keeps the READS honest, which is where the comparisons live.
 */
export function treatmentsFor(
	table: string,
): Readonly<Record<string, ColumnTreatment>> | undefined {
	return (COLUMN_TREATMENTS as Record<string, Record<string, ColumnTreatment>>)[
		table
	];
}

/** Live column names per table, read from the drizzle schema at runtime. */
export function liveColumns(): Readonly<Record<string, readonly string[]>> {
	const out: Record<string, string[]> = {};
	for (const value of Object.values(schema)) {
		if (!is(value as never, PgTable)) continue;
		out[getTableName(value as never)] = Object.values(
			getTableColumns(value as never),
		)
			.map((c) => (c as { name: string }).name)
			.sort();
	}
	return out;
}

export interface TreatmentReport {
	/** Shipped columns in the schema with no Appendix B treatment. */
	readonly untreatedColumns: readonly string[];
	/** Treatments naming a column that does not exist in the schema. */
	readonly phantomColumns: readonly string[];
	/** Shipped tables with no treatment block at all. */
	readonly untreatedTables: readonly string[];
	/** Every column that must be pseudonymized, as `table.column`. */
	readonly pseudoColumns: readonly string[];
	/** Every column dropped entirely, as `table.column`. */
	readonly stripColumns: readonly string[];
}

/**
 * Cross-check the treatment map against the live schema, both directions.
 *
 * ⚠ Both sides injectable, for the same reason as everywhere else in this
 * task: the map is complete today, so a control that could only ask the real
 * pair would assert emptiness against data with no gap (OVN-V3).
 */
export function compareTreatments(
	live: Readonly<Record<string, readonly string[]>>,
	treatments: Readonly<Record<string, Record<string, ColumnTreatment>>>,
	inventory: Readonly<Record<string, { status: string }>> = TABLE_INVENTORY,
): TreatmentReport {
	const shipped = Object.entries(inventory)
		.filter(([, e]) => e.status === "SHIPPED")
		.map(([t]) => t);

	const untreatedColumns: string[] = [];
	const phantomColumns: string[] = [];
	const untreatedTables: string[] = [];
	const pseudoColumns: string[] = [];
	const stripColumns: string[] = [];

	for (const table of shipped) {
		const block = treatments[table];
		if (!block) {
			untreatedTables.push(table);
			continue;
		}
		const cols = new Set(live[table] ?? []);
		for (const c of cols) {
			if (!(c in block)) untreatedColumns.push(`${table}.${c}`);
		}
		for (const [c, t] of Object.entries(block)) {
			if (!cols.has(c)) phantomColumns.push(`${table}.${c}`);
			if (t === "PSEUDO") pseudoColumns.push(`${table}.${c}`);
			if (t === "STRIP") stripColumns.push(`${table}.${c}`);
		}
	}

	return {
		untreatedColumns: untreatedColumns.sort(),
		phantomColumns: phantomColumns.sort(),
		untreatedTables: untreatedTables.sort(),
		pseudoColumns: pseudoColumns.sort(),
		stripColumns: stripColumns.sort(),
	};
}

/** Cross-check the live schema against Appendix B. */
export function verifyTreatmentCoverage(): TreatmentReport {
	return compareTreatments(liveColumns(), COLUMN_TREATMENTS);
}

/**
 * Throw unless every shipped column has a treatment and every treatment names
 * a real column.
 *
 * An untreated column is the dangerous direction — it would ship verbatim
 * without anyone having decided it should. A phantom is the quieter one, but
 * it means the map has drifted from the schema, and a map that is wrong
 * somewhere is a map nobody can rely on anywhere.
 */
export function assertTreatmentsComplete(): void {
	const r = verifyTreatmentCoverage();

	if (r.untreatedTables.length > 0) {
		throw new EgressContractGapError(
			`shipped tables: ${r.untreatedTables.join(", ")}`,
			"shipped per §19.3 with no Appendix B per-column treatment block",
		);
	}
	if (r.untreatedColumns.length > 0) {
		throw new EgressContractGapError(
			`columns: ${r.untreatedColumns.join(", ")}`,
			`${r.untreatedColumns.length} column(s) exist in a shipped table with ` +
				`no Appendix B treatment. They would ship verbatim without anyone ` +
				`having decided they should. Classify each and amend Appendix B in ` +
				`the same commit.`,
		);
	}
	if (r.phantomColumns.length > 0) {
		throw new EgressContractGapError(
			`columns: ${r.phantomColumns.join(", ")}`,
			`${r.phantomColumns.length} treatment(s) name a column absent from the ` +
				`live schema — Appendix B's own preamble calls this "a drift fix".`,
		);
	}
}
