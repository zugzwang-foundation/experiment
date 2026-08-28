import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

/**
 * DATASET.1 Slice 3 — the Appendix B per-column coverage guard, driven through
 * its REAL throwing path.
 *
 * ⚠ **`assertTreatmentsComplete` has no test at all today.** `inventory.test.ts`
 * asserts on `verifyTreatmentCoverage()`'s report fields and on
 * `compareTreatments`'s injected-gap behaviour, both of which are sound — but
 * the THROWER is never called, in either direction. Mutating its body to
 * `return;` leaves all 131 export tests green, and it is the only thing standing
 * between "a migration adds a column to a shipped table" and "the column ships
 * into a CC-BY-4.0 artifact without anyone having classified it".
 *
 * ⚠ The mock adds a column to an EXISTING shipped table rather than adding a
 * new table, and that distinction is the whole point of a separate file: an
 * extra table makes `assertInventoryComplete` throw FIRST inside `buildDataset`,
 * so the treatments check would be satisfied by its neighbour and the mutation
 * would survive. Here the inventory is intact and the treatments check is the
 * only one that can fire.
 *
 * `pools` is the subject because it is the smallest shipped table — every real
 * column is restated so that `phantomColumns` stays empty and the guard has
 * exactly one thing to report.
 */

vi.mock("@/db/schema", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/schema")>();
	return {
		...actual,
		pools: pgTable("pools", {
			id: uuid("id").primaryKey(),
			marketId: uuid("market_id"),
			yesReserves: numeric("yes_reserves", { precision: 38, scale: 18 }),
			noReserves: numeric("no_reserves", { precision: 38, scale: 18 }),
			createdAt: timestamp("created_at", { withTimezone: true }),
			// The defect, constructed: a column a migration added and Appendix B
			// never classified.
			referralCode: text("referral_code"),
		}),
	};
});

describe("treatments · the REAL throw, not a reconstruction", () => {
	it("assertTreatmentsComplete THROWS on an unclassified shipped column", async () => {
		const { assertTreatmentsComplete } = await import(
			"@/server/export/dataset/treatments"
		);
		const { EgressContractGapError } = await import(
			"@/server/export/egress/errors"
		);

		expect(() => assertTreatmentsComplete()).toThrow(EgressContractGapError);
	});

	it("the REAL message names the column and the consequence", async () => {
		const { assertTreatmentsComplete } = await import(
			"@/server/export/dataset/treatments"
		);

		let message = "";
		try {
			assertTreatmentsComplete();
		} catch (e) {
			message = (e as Error).message;
		}

		expect(message).toContain("pools.referral_code");
		expect(message).toContain("Appendix B");
		// The consequence, not just the fact: an untreated column is not a
		// bookkeeping slip, it is a publication.
		expect(message).toContain("ship verbatim");
	});

	it("the inventory is INTACT — this fires on treatments alone", async () => {
		// The control's control. If the mock had also disturbed the inventory,
		// this file would prove nothing about the treatments check, because
		// `buildDataset` would throw one line earlier.
		const { verifyInventoryCoverage } = await import(
			"@/server/export/dataset/inventory"
		);
		const { verifyTreatmentCoverage } = await import(
			"@/server/export/dataset/treatments"
		);

		expect(verifyInventoryCoverage().unclassified).toEqual([]);
		expect(verifyInventoryCoverage().orphaned).toEqual([]);
		expect(verifyTreatmentCoverage().untreatedColumns).toEqual([
			"pools.referral_code",
		]);
		expect(verifyTreatmentCoverage().phantomColumns).toEqual([]);
	});

	it("buildDataset REFUSES to read a row while a column is unclassified", async () => {
		// Pins the THIRD line of `build.ts`'s preamble specifically. With the
		// inventory clean, nothing else in that preamble can produce this throw.
		const { buildDataset } = await import("@/server/export/dataset/build");
		const { EgressContractGapError } = await import(
			"@/server/export/egress/errors"
		);

		let readAttempts = 0;
		const source = {
			label: "gap-probe",
			read: async () => {
				readAttempts++;
				return [];
			},
		};

		await expect(
			buildDataset({ source, releaseDate: "2026-11-06" }),
		).rejects.toBeInstanceOf(EgressContractGapError);
		expect(readAttempts).toBe(0);
	});
});
