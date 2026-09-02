// PFP-1 — pool tuples are generated in the order they will be handed out.
//
// `consumeIdentityPoolTuple` allocates FIFO by `created_at`, so the order rows
// are seeded in IS the order users receive them. Generating the grid in nested
// -loop order would give the first thirteen signups the same animal in
// thirteen colours. These tests pin the rotation that prevents that.

import { describe, expect, it } from "vitest";

import { generatePoolTuples } from "@/server/identity-pool/rotation";
import {
	ANIMALS,
	COLOURS,
	PFP_VARIANTS,
} from "@/server/identity-pool/vocabulary";

const PAIRS = COLOURS.length * ANIMALS.length; // 13 x 67 = 871

describe("generatePoolTuples", () => {
	it("emits exactly the count asked for", () => {
		expect(generatePoolTuples(50)).toHaveLength(50);
		expect(generatePoolTuples(0)).toHaveLength(0);
		expect(generatePoolTuples(PAIRS * 2)).toHaveLength(PAIRS * 2);
	});

	it("is deterministic across calls", () => {
		expect(generatePoolTuples(300)).toEqual(generatePoolTuples(300));
	});

	it("is a prefix of itself at larger counts", () => {
		expect(generatePoolTuples(1000).slice(0, 40)).toEqual(
			generatePoolTuples(40),
		);
	});

	// The point of the whole exercise: two people signing up back to back must
	// not look like each other.
	it("never repeats a colour or an animal back to back", () => {
		const tuples = generatePoolTuples(PAIRS * 3);
		for (let i = 1; i < tuples.length; i++) {
			expect(tuples[i]?.colour).not.toBe(tuples[i - 1]?.colour);
			expect(tuples[i]?.animal).not.toBe(tuples[i - 1]?.animal);
		}
	});

	it("visits all 871 pairs before repeating any", () => {
		const seen = new Set(
			generatePoolTuples(PAIRS).map((t) => `${t.colour}:${t.animal}`),
		);
		expect(seen.size).toBe(PAIRS);
	});

	it("keeps (colour, animal, number) unique, which the DB index requires", () => {
		const tuples = generatePoolTuples(PAIRS * 4);
		const keys = tuples.map((t) => `${t.colour}:${t.animal}:${t.number}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("keeps pseudonyms unique, which the DB column requires", () => {
		const names = generatePoolTuples(PAIRS * 4).map((t) => t.pseudonym);
		expect(new Set(names).size).toBe(names.length);
	});

	it("builds the pseudonym as Colour + Animal + 3-digit number", () => {
		for (const t of generatePoolTuples(200)) {
			expect(t.pseudonym).toBe(
				`${t.colour}${t.animal}${String(t.number).padStart(3, "0")}`,
			);
		}
	});

	it("keeps numbers inside the 0-999 range ADR-0011 locks", () => {
		for (const t of generatePoolTuples(PAIRS * 5)) {
			expect(t.number).toBeGreaterThanOrEqual(0);
			expect(t.number).toBeLessThanOrEqual(999);
		}
	});

	describe("pfpFilename", () => {
		it("is the bare pair slug on a single-image animal, every time round", () => {
			const zebras = generatePoolTuples(PAIRS * 9).filter(
				(t) => t.animal === "Zebra" && t.colour === "Gold",
			);
			expect(zebras.length).toBeGreaterThan(1);
			for (const t of zebras) {
				expect(t.pfpFilename).toBe("gold-zebra.webp");
			}
		});

		it("cycles through the 9 variants Cat and Dog actually have", () => {
			const cats = generatePoolTuples(PAIRS * 9).filter(
				(t) => t.animal === "Cat" && t.colour === "Gold",
			);
			expect(cats).toHaveLength(9);
			expect(cats.map((t) => t.pfpFilename)).toEqual([
				"gold-cat.webp",
				"gold-cat-v1.webp",
				"gold-cat-v2.webp",
				"gold-cat-v3.webp",
				"gold-cat-v4.webp",
				"gold-cat-v5.webp",
				"gold-cat-v6.webp",
				"gold-cat-v7.webp",
				"gold-cat-v8.webp",
			]);
		});

		it("wraps back to variant 0 after exhausting a pair's variants", () => {
			const cats = generatePoolTuples(PAIRS * 10).filter(
				(t) => t.animal === "Cat" && t.colour === "Gold",
			);
			expect(cats[9]?.pfpFilename).toBe("gold-cat.webp");
		});

		it("is lowercase and never names a variant beyond what exists", () => {
			for (const t of generatePoolTuples(PAIRS * 3)) {
				expect(t.pfpFilename).toBe(t.pfpFilename.toLowerCase());
				const match = t.pfpFilename.match(/-v(\d+)\.webp$/);
				const variant = match ? Number(match[1]) : 0;
				expect(variant).toBeLessThan(PFP_VARIANTS[t.animal] ?? 1);
			}
		});
	});
});
