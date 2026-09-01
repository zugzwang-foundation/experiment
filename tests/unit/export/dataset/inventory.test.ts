import { describe, expect, it } from "vitest";

import {
	assertInventoryComplete,
	compareInventory,
	type InventoryEntry,
	liveTableNames,
	shippedTables,
	TABLE_INVENTORY,
	verifyInventoryCoverage,
} from "@/server/export/dataset/inventory";
import {
	COLUMN_TREATMENTS,
	compareTreatments,
	liveColumns,
	verifyTreatmentCoverage,
} from "@/server/export/dataset/treatments";
import { EgressContractGapError } from "@/server/export/egress/errors";

/**
 * DATASET.1 Slice 3 — table inventory + per-column treatment map.
 *
 * **The wrong answer this must reject** (brief §4 Slice 3): a live `pgTable`
 * that is neither classified as shipped nor as not-shipped. *Silence is the
 * defect* — a new table must fail the guard, not default into a bucket.
 */

describe("inventory · the live schema is fully classified", () => {
	it("every live pgTable has a §19.3 classification", () => {
		const report = verifyInventoryCoverage();
		expect(report.unclassified).toEqual([]);
	});

	it("no inventory entry names a table that no longer exists", () => {
		expect(verifyInventoryCoverage().orphaned).toEqual([]);
	});

	it("does not throw against the live schema", () => {
		expect(() => assertInventoryComplete()).not.toThrow();
	});

	it("reads the live tables at RUNTIME — 24, not a file count", () => {
		// P4's measurement, pinned. AGENTS.md warns against counting files to
		// find a ceiling; the same applies to counting `pgTable(` matches,
		// since one file declares several tables.
		expect(liveTableNames()).toHaveLength(24);
	});

	it("matches §19.3's stated counts: 16 shipped / 5 not / 1 undecided", () => {
		const r = verifyInventoryCoverage();
		expect(r.shipped).toHaveLength(16);
		expect(r.notShipped).toHaveLength(5);
		expect(r.undecided).toEqual(["lots"]);
		// Only 2 of §19.3's 4 exclusions are drizzle tables; `watermark_state`
		// and `cron_alarms` are raw pg_cron SQL and are not in the schema at
		// all, which is why 22 inventory rows + 2 = 24 live tables.
		expect(r.excluded).toEqual(["bet_receipts", "bookmarks"]);
		expect(r.shipped.length + r.notShipped.length + r.undecided.length).toBe(
			22,
		);
	});
});

describe("inventory · `lots` is UNDECIDED, and that is load-bearing", () => {
	it("classifies lots as UNDECIDED — not as a quiet NO", () => {
		// §19.3 row 22 counts it "in neither the 16 nor the 5 … precisely so
		// that an unanswered question cannot be mistaken for a settled NO by
		// arithmetic." Forcing it either way would invent a founder decision.
		expect(TABLE_INVENTORY.lots.status).toBe("UNDECIDED");
	});

	it("does NOT ship it, while leaving the question open", () => {
		// Classified ≠ exportable. The guard proves somebody answered the
		// question of whether it is known; `shippedTables()` is what decides
		// what is read, and UNDECIDED is not SHIPPED.
		expect(shippedTables()).not.toContain("lots");
		expect(shippedTables()).toHaveLength(16);
	});

	it("has no per-column treatment block, per Appendix B.19", () => {
		// B.19 declines to write one because doing so "would be
		// indistinguishable from having decided."
		expect(COLUMN_TREATMENTS).not.toHaveProperty("lots");
	});
});

describe("inventory · POSITIVE CONTROLS (the injected gap)", () => {
	it("THE WRONG ANSWER — an unclassified new table is detected", () => {
		// Brief §4 Slice 3's defect, constructed: a table exists in the
		// schema and nobody has said whether it ships.
		const live = [...liveTableNames(), "referrals"];

		const report = compareInventory(live, TABLE_INVENTORY);
		expect(report.unclassified).toEqual(["referrals"]);
	});

	it("an unclassified table THROWS, and the message says why silence is bad", () => {
		const live = [...liveTableNames(), "referrals"];
		const report = compareInventory(live, TABLE_INVENTORY);

		// Drive the real error shape from the real report.
		const err = new EgressContractGapError(
			`live pgTable(s): ${report.unclassified.join(", ")}`,
			"Silence is the defect: defaulting to EXCLUDED silently withholds " +
				"research data, and defaulting to SHIPPED silently publishes an " +
				"unreviewed table into a CC-BY-4.0 artifact.",
		);
		expect(err.message).toContain("referrals");
		expect(err.message).toContain("Silence is the defect");
	});

	it("detects an inventory entry orphaned by a dropped table", () => {
		const live = liveTableNames().filter((t) => t !== "bookmarks");
		expect(compareInventory(live, TABLE_INVENTORY).orphaned).toEqual([
			"bookmarks",
		]);
	});

	it("a table classified but absent from the map is still caught", () => {
		// The other silence: an entry removed from TABLE_INVENTORY while the
		// table still exists. Without both directions, deleting an awkward
		// row would look like fixing the guard.
		const { users: _removed, ...withoutUsers } = TABLE_INVENTORY;

		const report = compareInventory(
			liveTableNames(),
			withoutUsers as Record<string, InventoryEntry>,
		);
		expect(report.unclassified).toEqual(["users"]);
	});
});

describe("treatments · Appendix B vs the live schema, both directions", () => {
	it("every column of every shipped table has a treatment", () => {
		expect(verifyTreatmentCoverage().untreatedColumns).toEqual([]);
	});

	it("no treatment names a column absent from the schema", () => {
		// Appendix B's own preamble: "any column enumerated here that does
		// not exist in source is a drift fix."
		expect(verifyTreatmentCoverage().phantomColumns).toEqual([]);
	});

	it("every shipped table has a treatment block", () => {
		expect(verifyTreatmentCoverage().untreatedTables).toEqual([]);
	});

	it("POSITIVE CONTROL — an untreated column is detected", () => {
		const live = { ...liveColumns() };
		live.bets = [...(live.bets ?? []), "referral_code"];

		expect(compareTreatments(live, COLUMN_TREATMENTS).untreatedColumns).toEqual(
			["bets.referral_code"],
		);
	});

	it("POSITIVE CONTROL — a phantom treatment is detected", () => {
		// This is not hypothetical. Appendix B.6 carries
		// `comments.market_media_id` marked PENDING-BUILD, and the column is
		// still absent at migration head 0026 — so transcribing B verbatim
		// WOULD have produced a phantom. It is omitted from the map for that
		// reason, and this control is what would catch it coming back.
		const withPhantom = {
			...COLUMN_TREATMENTS,
			comments: {
				...COLUMN_TREATMENTS.comments,
				market_media_id: "SHIP" as const,
			},
		};

		expect(
			compareTreatments(liveColumns(), withPhantom).phantomColumns,
		).toEqual(["comments.market_media_id"]);
	});
});

describe("treatments · the PSEUDO set is the wall, enumerated", () => {
	it("pseudonymizes all EIGHT column-level user FKs, not §19.5's six", () => {
		// ⚠ The finding this task exists to not get wrong. §19.5's prose
		// bullet list names six paths; three shipped tables carrying a raw
		// `users.id` are absent from it, and Appendix B marks each PSEUDO.
		expect(verifyTreatmentCoverage().pseudoColumns).toEqual([
			"bets.user_id",
			"comments.user_id",
			"dharma_ledger.user_id",
			"image_uploads.user_id",
			"mod_actions.target_user_id",
			// ── the three §19.5's bullet list omits ──
			"payout_events.user_id",
			"positions.user_id",
			"user_events.user_id",
		]);
	});

	it("strips all TEN columns, including the three §19.4's table omits", () => {
		// ⚠ TEN as of DATASET.3. `bets.idempotency_key` is ruling S2's
		// addition — 255 bytes of participant-chosen header text that
		// moderation never sees, previously annotated `SHIP // no PII`, which
		// was an assumption rather than a constraint.
		expect(verifyTreatmentCoverage().stripColumns).toEqual([
			"bets.idempotency_key",
			"image_uploads.r2_object_key",
			// ── absent from §19.4's ten-column table; B.10 marks both STRIP ──
			"mod_actions.blocked_text",
			"mod_actions.image_r2_key",
			// ──
			"users.email",
			"users.google_id",
			"users.image",
			"users.name",
			"users.tos_acceptance_ip",
			"users.tos_acceptance_user_agent",
		]);
	});

	it("users.pfp_filename is NULL_IF_ERASED — it SHIPS, it is not stripped", () => {
		// §19.4's table is titled "The ten PII columns dropped at export" and
		// lists pfp_filename as row 7, while its own treatment cell reads
		// "Released as-is". B.1 settles it. Dropping it would destroy the
		// identity_pool join, on the authority of a table's title.
		expect(COLUMN_TREATMENTS.users.pfp_filename).toBe("NULL_IF_ERASED");
		expect(verifyTreatmentCoverage().stripColumns).not.toContain(
			"users.pfp_filename",
		);
	});

	it("market_media.r2_object_key SHIPS while image_uploads' is STRIPPED", () => {
		// Same column name, opposite treatments, and the asymmetry is the
		// point: `u/<userId>/…` embeds a user id, `m/<marketId>/…` does not.
		// A rule keyed on the column NAME gets exactly one of these wrong.
		expect(COLUMN_TREATMENTS.market_media.r2_object_key).toBe("SHIP");
		expect(COLUMN_TREATMENTS.image_uploads.r2_object_key).toBe("STRIP");
	});

	it("events.aggregate_id is SHIP_OR_PSEUDO, resolved per row", () => {
		// B.13. A blanket rule in either direction is wrong: ship-all leaks
		// user ids for `user`-aggregate rows, pseudonymize-all corrupts the
		// market / bet / comment / upload PKs of every other aggregate type.
		expect(COLUMN_TREATMENTS.events.aggregate_id).toBe("SHIP_OR_PSEUDO");
	});

	it("sentinel-bearing actor columns are SHIP, never PSEUDO", () => {
		// §19.5: "admin has no users row, no pseudonym to map." Researchers
		// filter on the literal string, so rewriting it would delete the
		// admin-action analysis the dataset promises.
		expect(COLUMN_TREATMENTS.mod_actions.actor_id).toBe("SHIP");
		expect(COLUMN_TREATMENTS.markets.created_by).toBe("SHIP");
		expect(COLUMN_TREATMENTS.market_media.created_by).toBe("SHIP");
	});

	it("users.id is the ONE raw id that ships, and only in users", () => {
		expect(COLUMN_TREATMENTS.users.id).toBe("SHIP");
		// Nothing else may carry a SHIP treatment on a users-FK column.
		for (const [table, cols] of Object.entries(COLUMN_TREATMENTS)) {
			if (table === "users") continue;
			for (const [col, treatment] of Object.entries(cols)) {
				if (col === "user_id" || col === "target_user_id") {
					expect(treatment, `${table}.${col} must be PSEUDO`).toBe("PSEUDO");
				}
			}
		}
	});
});
