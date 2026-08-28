import { pgTable, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

/**
 * DATASET.1 Slice 3 — the §19.3 inventory guard, driven through its REAL
 * throwing path.
 *
 * ⚠ `inventory.test.ts`'s *"an unclassified table THROWS"* test does not call
 * `assertInventoryComplete`. It builds an `EgressContractGapError` itself and
 * asserts on the message it just wrote — so it is equally satisfied by
 * `assertInventoryComplete` being `return;`, and by its message being empty.
 * `compareInventory` (the pure half) IS controlled properly there; the THROWER
 * is not, and the thrower is what `buildDataset` calls.
 *
 * The failing shape lives at the input: a live `pgTable` nobody has classified.
 * That is what the mock below builds, and it is the real-world shape too — a
 * migration lands, the inventory is not amended, and on 6 November the table
 * either ships unreviewed or is silently withheld.
 */

vi.mock("@/db/schema", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/db/schema")>();
	return {
		...actual,
		// The defect, constructed: a 25th live table with no §19.3 row.
		referrals: pgTable("referrals", { id: uuid("id").primaryKey() }),
	};
});

describe("inventory · the REAL throw, not a reconstruction", () => {
	it("assertInventoryComplete THROWS on an unclassified live table", async () => {
		const { assertInventoryComplete } = await import(
			"@/server/export/dataset/inventory"
		);
		const { EgressContractGapError } = await import(
			"@/server/export/egress/errors"
		);

		expect(() => assertInventoryComplete()).toThrow(EgressContractGapError);
	});

	it("the REAL message names the table and says why silence is the defect", async () => {
		const { assertInventoryComplete } = await import(
			"@/server/export/dataset/inventory"
		);

		let message = "";
		try {
			assertInventoryComplete();
		} catch (e) {
			message = (e as Error).message;
		}

		expect(message).toContain("referrals");
		// Both wrong defaults have to be named, or the reader picks one.
		expect(message).toContain("Silence is the defect");
		expect(message).toContain("EXCLUDED");
		expect(message).toContain("SHIPPED");
		expect(message).toContain("§19.3");
	});

	it("the unclassified table does NOT quietly join the shipped set", async () => {
		// The other half: a guard that throws is worth nothing if the pipeline
		// would have exported the table anyway had the throw been removed.
		const { shippedTables, verifyInventoryCoverage } = await import(
			"@/server/export/dataset/inventory"
		);

		expect(verifyInventoryCoverage().unclassified).toEqual(["referrals"]);
		expect(shippedTables()).not.toContain("referrals");
		expect(shippedTables()).toHaveLength(16);
	});

	it("buildDataset REFUSES to read a row while the table is unclassified", async () => {
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
