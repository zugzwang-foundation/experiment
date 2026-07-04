// SCAFFOLD.17 plan §D — real-Postgres integration tests for the
// production seed-script `runSeed(manifestPath, testDb)`. Follows the
// canonical pattern at `tests/db/triggers/identity-pool-append-only
// .spec.ts:1–120` (dual `testClient` + `testDb`; afterEach TRUNCATE
// CASCADE to bypass Bucket B trigger).
//
// Tests-first per CLAUDE.md §5.6 — written by test-writer reviewer-call
// at Phase 2 START. Tests MUST fail against the Phase 1 stub at
// `scripts/seed-identity-pool.ts` (which exports nothing): `runSeed` is
// undefined → "runSeed is not a function".

import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { identityPool } from "@/db/schema";
import { runSeed } from "../../../scripts/seed-identity-pool";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

const FIXTURE_DIR = `${path.dirname(fileURLToPath(import.meta.url))}/_fixtures`;
const MANIFEST_100 = path.join(FIXTURE_DIR, "manifest-100.csv");
const MANIFEST_MALFORMED = path.join(FIXTURE_DIR, "manifest-malformed.csv");

// Manifest-100 PascalCase pseudonym pattern.
const PSEUDONYM_SHAPE = /^[A-Z][a-z]+[A-Z][a-z]+\d{3}$/;

describe("seed-identity-pool — runSeed against real Postgres", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["identity_pool"]);
	});

	// === Plan §D Test 1 — happy path =======================================

	it("inserts all 100 rows from a fresh manifest into an empty table", async () => {
		const result = await runSeed(MANIFEST_100, testDb);

		expect(result).toEqual({
			inserted: 100,
			skipped: 0,
			manifestRowCount: 100,
		});

		const rows = await testDb.select().from(identityPool);
		expect(rows).toHaveLength(100);

		// All (colour, animal, number) tuples are unique → set size 100.
		const tuples = new Set(
			rows.map((r) => `${r.colour}|${r.animal}|${r.number}`),
		);
		expect(tuples.size).toBe(100);

		// Every pseudonym matches the manifest's `${Colour}${Animal}${NNN}`
		// PascalCase shape (per consume.ts:51 materialisation rule).
		for (const row of rows) {
			expect(row.pseudonym).toMatch(PSEUDONYM_SHAPE);
			const expected = `${row.colour}${row.animal}${String(row.number).padStart(3, "0")}`;
			expect(row.pseudonym).toBe(expected);
		}

		// Range check: numbers 0–99 by manifest construction (colourIdx*10 +
		// animalIdx). RedFox000 → IvoryPine099 covers the full namespace.
		const numbers = new Set(rows.map((r) => r.number));
		expect(numbers.size).toBe(100);
		expect(Math.min(...numbers)).toBe(0);
		expect(Math.max(...numbers)).toBe(99);
	});

	// === Plan §D Test 2 — idempotency =======================================

	it("idempotent re-run skips all rows (ON CONFLICT DO NOTHING)", async () => {
		const first = await runSeed(MANIFEST_100, testDb);
		expect(first).toEqual({
			inserted: 100,
			skipped: 0,
			manifestRowCount: 100,
		});

		const second = await runSeed(MANIFEST_100, testDb);
		expect(second).toEqual({
			inserted: 0,
			skipped: 100,
			manifestRowCount: 100,
		});

		const [{ c }] = (await testDb.execute(
			`SELECT count(*)::int AS c FROM identity_pool`,
		)) as unknown as Array<{ c: number }>;
		expect(c).toBe(100);
	});

	// === Plan §D Test 3 — partial pre-seed (in-test setup; Flag 1) =========

	it("inserts only missing rows when half the manifest is pre-seeded", async () => {
		// Pre-seed 50 rows that overlap the manifest's first 50. Use the
		// manifest's own deterministic shape (RedFox000…IvoryFox050 range —
		// the first 50 rows of the manifest by colourIdx*10 + animalIdx).
		const preseed = Array.from({ length: 50 }, (_, i) => {
			const colourIdx = Math.floor(i / 10);
			const animalIdx = i % 10;
			const colours = ["Red", "Blue", "Amber", "Green", "Crimson"] as const;
			const animals = [
				"Fox",
				"Wolf",
				"Otter",
				"Badger",
				"Lynx",
				"Hare",
				"Owl",
				"Hawk",
				"Stoat",
				"Pine",
			] as const;
			const colour = colours[colourIdx] ?? "Red";
			const animal = animals[animalIdx] ?? "Fox";
			const number = colourIdx * 10 + animalIdx;
			const nnn = String(number).padStart(3, "0");
			return {
				colour,
				animal,
				number,
				pseudonym: `${colour}${animal}${nnn}`,
				pfpFilename: `${colour.toLowerCase()}-${animal.toLowerCase()}-${nnn}.webp`,
			};
		});

		await testDb.insert(identityPool).values(preseed);

		const result = await runSeed(MANIFEST_100, testDb);

		expect(result).toEqual({
			inserted: 50,
			skipped: 50,
			manifestRowCount: 100,
		});

		const [{ c }] = (await testDb.execute(
			`SELECT count(*)::int AS c FROM identity_pool`,
		)) as unknown as Array<{ c: number }>;
		expect(c).toBe(100);
	});

	// === Plan §D Test 4 — malformed manifest row ===========================

	it("rejects a malformed manifest with a typed parse error and leaves 0 rows", async () => {
		// manifest-malformed.csv: 3 rows; row 2 has number = "abc". The
		// seed-script's CSV parser MUST refuse this (no silent skip per
		// plan §A.2). With CHUNK_SIZE=1000 and a 3-row fixture, the entire
		// run aborts before any chunk commits → 0 rows.

		await expect(runSeed(MANIFEST_MALFORMED, testDb)).rejects.toThrow(/abc/i);

		const [{ c }] = (await testDb.execute(
			`SELECT count(*)::int AS c FROM identity_pool`,
		)) as unknown as Array<{ c: number }>;
		expect(c).toBe(0);
	});
});
