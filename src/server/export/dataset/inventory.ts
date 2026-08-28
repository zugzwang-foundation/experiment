import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { EgressContractGapError } from "@/server/export/egress/errors";

/**
 * DATASET.1 Slice 3 — the §19.3 table inventory.
 *
 * ## Why FOUR buckets and not two
 *
 * Brief §4 Slice 3 rules the defect as *"a live `pgTable` that is neither
 * classified as shipped nor as not-shipped"*. Read as a two-bucket map that is
 * unbuildable, because SPEC.2 §19.3 is a **three**-bucket inventory plus an
 * exclusion set:
 *
 *   · 16 SHIPPED · 5 NOT_SHIPPED · 1 UNDECIDED (`lots`) · 4 EXCLUDED entirely
 *
 * ⚠ **Only TWO of §19.3's four exclusions appear in the map below**, and that
 * is a limitation rather than an omission. `watermark_state` and `cron_alarms`
 * are created by raw SQL in `0007_pg_cron_jobs.sql` and are not drizzle tables
 * at all — adding them here would make `compareInventory`'s `orphaned` check
 * fire, because they are absent from the schema this map is compared against.
 * The transcription cannot represent a §19.3 row that is not a `pgTable`, so
 * the map holds `bet_receipts` and `bookmarks` and this note holds the other
 * two. (Corrected after `@code-reviewer` M-11 — the docblock said four while
 * the map declared two.)
 *
 * `lots` is the one that forces the shape. §19.3 row 22 refuses to place it,
 * in terms: ADR-0039 says *"whether lots are released alongside bets is a
 * SPEC.1 G3 question, not this ADR's"*, and the row exists so that
 * *"an unanswered question cannot be mistaken for a settled NO by
 * arithmetic."* Appendix B.19 goes further and declines to write it a
 * per-column section at all, because *"writing one would be indistinguishable
 * from having decided."*
 *
 * ⇒ Forcing `lots` into SHIPPED or NOT_SHIPPED would have this pipeline invent
 * a founder decision. `UNDECIDED` is a real state and is represented as one.
 *
 * `EXCLUDED` is separate from `NOT_SHIPPED` for a reason SPEC.2 states
 * directly (Appendix B.17): the not-shipped five are *dataset-relevant but
 * withheld*; the excluded four *are not part of the inventory at all*.
 * Collapsing them would lose which question was asked about each.
 *
 * ## What the guard actually enforces
 *
 * **Silence is the defect.** A new table must FAIL, not default to either
 * bucket — because the safe-looking default (exclude it) silently withholds
 * research data, and the other (ship it) silently publishes an unreviewed
 * table into a CC-BY-4.0 artifact. Neither is a decision anyone made.
 */

/** The four states a live table can be in, per §19.3 + Appendix B.17. */
export type ShipStatus =
	/** Ships in the 2026-11-06 release, per §19.3's 16. */
	| "SHIPPED"
	/** Dataset-relevant but withheld — operational / privacy-sensitive. */
	| "NOT_SHIPPED"
	/** In the inventory; ship/not-ship is an open SPEC.1 G3 question. */
	| "UNDECIDED"
	/** Not part of the dataset inventory at all. */
	| "EXCLUDED";

export interface InventoryEntry {
	readonly status: ShipStatus;
	/** §19.3 row number, or the Appendix B.17 clause for EXCLUDED. */
	readonly source: string;
	/** Why, in the spec's own terms. */
	readonly rationale: string;
}

/**
 * The §19.3 inventory, transcribed. **Every live `pgTable` must appear.**
 *
 * Ordered as §19.3 orders it — Bucket A audit tables, then B, then C, then the
 * not-shipped, then the undecided, then the exclusions — so that a reader
 * diffing this against the spec is reading the same sequence.
 */
export const TABLE_INVENTORY = {
	// ── §19.3 rows 1–9: the nine Bucket-A audit tables ──────────────────
	events: {
		status: "SHIPPED",
		source: "§19.3 row 1",
		rationale: "Canonical audit log; foundational for K_eff(t)",
	},
	dharma_ledger: {
		status: "SHIPPED",
		source: "§19.3 row 2",
		rationale: "Per-transaction Dharma flow",
	},
	bets: {
		status: "SHIPPED",
		source: "§19.3 row 3",
		rationale: "Per-bet record",
	},
	comments: {
		status: "SHIPPED",
		source: "§19.3 row 4",
		rationale: "Per-comment record — the thesis-core commentary signal",
	},
	resolution_events: {
		status: "SHIPPED",
		source: "§19.3 row 5",
		rationale: "Per-market-resolution audit row",
	},
	payout_events: {
		status: "SHIPPED",
		source: "§19.3 row 6",
		rationale: "Per-bet settlement",
	},
	mod_actions: {
		status: "SHIPPED",
		source: "§19.3 row 7",
		rationale: "Moderation audit trail; admin actor as 'admin-singleton'",
	},
	admin_events: {
		status: "SHIPPED",
		source: "§19.3 row 8",
		rationale:
			"Admin-action audit trail. ⚠ ZERO WRITERS in src/ — ships EMPTY " +
			"(ADMIN-EVENTS-WRITER, docs/parked.md, founder fork, open). Built to " +
			"§19.3 as written; not this task's to resolve (brief §6).",
	},
	user_events: {
		status: "SHIPPED",
		source: "§19.3 row 9",
		rationale:
			"User lifecycle audit trail. ⚠ ALSO ZERO WRITERS in src/ — ships " +
			"EMPTY, and unlike admin_events this is recorded NOWHERE: no " +
			"docs/parked.md entry, no founder fork, no dated ruling. Surfaced by " +
			"DATASET.1; the lifecycle facts ride `events` instead (Appendix B.12).",
	},

	// ── §19.3 rows 10–11: Bucket B ──────────────────────────────────────
	identity_pool: {
		status: "SHIPPED",
		source: "§19.3 row 10",
		rationale: "Pseudonym pool; post-experiment all rows are revealed",
	},
	image_uploads: {
		status: "SHIPPED",
		source: "§19.3 row 11",
		rationale: "Upload lifecycle; r2_object_key excluded per §19.4",
	},

	// ── §19.3 rows 12–16: Bucket C + users ──────────────────────────────
	markets: {
		status: "SHIPPED",
		source: "§19.3 row 12",
		rationale: "Market metadata",
	},
	pools: {
		status: "SHIPPED",
		source: "§19.3 row 13",
		rationale: "CPMM pool reserves at freeze",
	},
	positions: {
		status: "SHIPPED",
		source: "§19.3 row 14",
		rationale: "Final per-user-per-market positions at freeze",
	},
	users: {
		status: "SHIPPED",
		source: "§19.3 row 15",
		rationale: "YES with PII strip per §19.4 — the only table keeping raw id",
	},
	market_media: {
		status: "SHIPPED",
		source: "§19.3 row 16",
		rationale: "Admin-curated market context; no user_id, no PII (B.16)",
	},

	// ── §19.3 rows 17–21: not shipped ───────────────────────────────────
	system_state: {
		status: "NOT_SHIPPED",
		source: "§19.3 row 17",
		rationale: "Operational singleton; the freeze is visible in the events log",
	},
	sessions: {
		status: "NOT_SHIPPED",
		source: "§19.3 row 18",
		rationale: "Privacy-sensitive — cookie tokens, last-seen timestamps",
	},
	accounts: {
		status: "NOT_SHIPPED",
		source: "§19.3 row 19",
		rationale: "Provider-side identity proof; PII-adjacent, no thesis signal",
	},
	verifications: {
		status: "NOT_SHIPPED",
		source: "§19.3 row 20",
		rationale: "Transient OTP rows; TTL-bounded",
	},
	admin_sessions: {
		status: "NOT_SHIPPED",
		source: "§19.3 row 21",
		rationale: "Operational; admin-side privacy-sensitive",
	},

	// ── §19.3 row 22: the open question ─────────────────────────────────
	lots: {
		status: "UNDECIDED",
		source: "§19.3 row 22",
		rationale:
			"SPEC.1 G3 owns this. ADR-0039 declines the call in terms; the row " +
			"exists so an unanswered question is not mistaken for a settled NO " +
			"by arithmetic. A YES costs one line in §19.5 pseudonymization " +
			"(`lots.user_id`) and nothing else (Appendix B.19).",
	},

	// ── Appendix B.17: excluded from the inventory entirely ─────────────
	bet_receipts: {
		status: "EXCLUDED",
		source: "Appendix B.17 / ADR-0031",
		rationale:
			"Operational per-request receipt; `result` is fully derivable from " +
			"events + pools, so it carries no independent research signal",
	},
	bookmarks: {
		status: "EXCLUDED",
		source: "Appendix B.17 / ADR-0032",
		rationale: "Private per-viewer saved pointers; no thesis signal, no PII",
	},
} as const satisfies Record<string, InventoryEntry>;

export type InventoriedTable = keyof typeof TABLE_INVENTORY;

/**
 * Every `pgTable("...")` name DECLARED anywhere under `src/db/schema/`, read
 * from the source files rather than from the barrel.
 *
 * ⚠ **`liveTableNames()` alone is not sufficient, and `@code-reviewer` H-3
 * measured why.** It enumerates `import * as schema from "@/db/schema"` — the
 * BARREL. `drizzle.config.ts` sets `schema: "./src/db/schema"`, a DIRECTORY
 * glob, so a new table declared in a new file that nobody adds to `index.ts`
 * is generated into a migration and created in Postgres, while the inventory
 * guard never sees it and passes. Measured: a probe table in a new file
 * produced `0027_probe_shiny.sql` and `assertInventoryComplete()` returned
 * clean.
 *
 * That defeats Slice 3's whole exit condition for an entire class of new
 * table — and it fails in the *withholding* direction, silently omitting
 * research data from the release.
 *
 * Scanned textually because the barrel is precisely what cannot be trusted
 * here. Comments are stripped first: without that the scan matches the
 * `pgTable(` written inside a docblock, which is the shape this project has
 * recorded six times.
 */
export function declaredTableNames(schemaDir: string): readonly string[] {
	const names: string[] = [];
	for (const file of readdirSync(schemaDir)) {
		if (!file.endsWith(".ts")) continue;
		const src = readFileSync(join(schemaDir, file), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\/\/.*$/gm, "");
		for (const m of src.matchAll(/pgTable\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g)) {
			if (m[1]) names.push(m[1]);
		}
	}
	return names.sort();
}

/** Every live `pgTable` name, read from the drizzle schema barrel at runtime. */
export function liveTableNames(): readonly string[] {
	const names: string[] = [];
	for (const value of Object.values(schema)) {
		if (is(value, PgTable)) names.push(getTableName(value));
	}
	return names.sort();
}

export interface InventoryReport {
	/** Live tables with no inventory entry. **The defect.** */
	readonly unclassified: readonly string[];
	/**
	 * Tables declared under `src/db/schema/` but NOT exported from the
	 * barrel — invisible to `liveTableNames()` yet created in Postgres by
	 * drizzle-kit's directory glob (`@code-reviewer` H-3).
	 */
	readonly unexported: readonly string[];
	/** Inventory entries naming a table that no longer exists. */
	readonly orphaned: readonly string[];
	readonly shipped: readonly string[];
	readonly notShipped: readonly string[];
	readonly undecided: readonly string[];
	readonly excluded: readonly string[];
}

/**
 * The pure comparison, both sides injectable.
 *
 * ⚠ Exported for the guard's own positive control, exactly as
 * `compareStripRules` is. The live schema is fully classified today, so a test
 * able only to call `verifyInventoryCoverage()` would assert
 * `unclassified === []` against data with no gap — passing identically whether
 * the comparison works or always returns empty (OVN-V3).
 */
export function compareInventory(
	live: readonly string[],
	inventory: Readonly<Record<string, InventoryEntry>>,
	declared: readonly string[] = live,
): InventoryReport {
	const known = new Set(Object.keys(inventory));
	const liveSet = new Set(live);
	const withStatus = (s: ShipStatus) =>
		Object.entries(inventory)
			.filter(([, e]) => e.status === s)
			.map(([t]) => t)
			.sort();

	const liveNames = new Set(live);
	return {
		unexported: declared.filter((t) => !liveNames.has(t)).sort(),
		unclassified: live.filter((t) => !known.has(t)).sort(),
		orphaned: [...known].filter((t) => !liveSet.has(t)).sort(),
		shipped: withStatus("SHIPPED"),
		notShipped: withStatus("NOT_SHIPPED"),
		undecided: withStatus("UNDECIDED"),
		excluded: withStatus("EXCLUDED"),
	};
}

/** The on-disk schema directory this repo's drizzle config globs. */
export const SCHEMA_DIR = "src/db/schema";

/** Compare the live schema against the §19.3 inventory. */
export function verifyInventoryCoverage(
	schemaDir: string = join(process.cwd(), SCHEMA_DIR),
): InventoryReport {
	return compareInventory(
		liveTableNames(),
		TABLE_INVENTORY,
		declaredTableNames(schemaDir),
	);
}

/**
 * Throw unless every live table is classified.
 *
 * ⚠ **`UNDECIDED` is a legal classification but NOT a legal thing to export.**
 * The pipeline calls `shippedTables()`, which excludes it — so `lots` being
 * classified does not make it ship. The guard's job is to prove somebody
 * answered the question, not to answer it.
 */
export function assertInventoryComplete(): void {
	const report = verifyInventoryCoverage();

	if (report.unclassified.length > 0) {
		throw new EgressContractGapError(
			`live pgTable(s): ${report.unclassified.join(", ")}`,
			`${report.unclassified.length} live table(s) have no SPEC.2 §19.3 ` +
				`classification. Silence is the defect: defaulting to EXCLUDED ` +
				`silently withholds research data, and defaulting to SHIPPED ` +
				`silently publishes an unreviewed table into a CC-BY-4.0 artifact ` +
				`that cannot be withdrawn. Classify it in TABLE_INVENTORY and amend ` +
				`SPEC.2 §19.3 + Appendix B in the same commit.`,
		);
	}

	if (report.unexported.length > 0) {
		throw new EgressContractGapError(
			`schema tables: ${report.unexported.join(", ")}`,
			`${report.unexported.length} table(s) are declared under ` +
				`${SCHEMA_DIR}/ but not exported from its barrel. drizzle-kit ` +
				"globs the DIRECTORY, so these are migrated into Postgres and " +
				"exist — while every barrel-based check, including this " +
				"inventory, is blind to them. The failure is silent and in the " +
				"withholding direction: research data omitted from the release " +
				"because nobody could see the table was there.",
		);
	}

	if (report.orphaned.length > 0) {
		throw new EgressContractGapError(
			`inventory entries: ${report.orphaned.join(", ")}`,
			`${report.orphaned.length} inventory entr(ies) name a table that no ` +
				`longer exists in the schema. The pipeline would query a missing ` +
				`relation and fail mid-export.`,
		);
	}
}

/**
 * The tables the pipeline actually reads. SHIPPED only.
 *
 * ⚠ `UNDECIDED` is deliberately excluded, and that is not the same as ruling
 * NO. §19.3 row 22 counts `lots` *"in neither the 16 nor the 5"*; a pipeline
 * that shipped it would be publishing on an authority nobody granted, and one
 * that recorded it as NOT_SHIPPED would be doing the arithmetic the row exists
 * to prevent. Not shipping while the question is open is the only reading that
 * leaves the question open.
 */
export function shippedTables(): readonly string[] {
	return verifyInventoryCoverage().shipped;
}
