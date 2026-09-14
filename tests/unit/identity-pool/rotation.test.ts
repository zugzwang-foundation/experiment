// PFP-1 — pool tuples are generated in the order they will be handed out.
//
// `consumeIdentityPoolTuple` allocates FIFO by `created_at`, so the order rows
// are seeded in IS the order users receive them. Generating the grid in nested
// -loop order would give the first thirteen signups the same animal in
// thirteen colours. These tests pin the rotation that prevents that.

import { describe, expect, it } from "vitest";

import { generatePoolTuples, numberFor } from "@/server/identity-pool/rotation";
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

// PFP-3 — the number axis.
//
// `number` used to BE the pass index, so the first 871 signups all carried `000`. These tests pin the two properties that replaced it: the first pass is spread across the range (what a reader sees), and the derivation is a bijection per pair (what the unique index requires).
describe("number derivation", () => {
	it("no longer hands the whole first pass the same number", () => {
		const numbers = generatePoolTuples(PAIRS).map((t) => t.number);
		// The regression this change exists to close. Under `number: pass` this set had exactly one member.
		expect(new Set(numbers).size).toBeGreaterThan(500);
	});

	it("spreads the first pass across every decade of the range", () => {
		const numbers = generatePoolTuples(PAIRS).map((t) => t.number);
		for (let decade = 0; decade < 10; decade++) {
			const inDecade = numbers.filter(
				(n) => Math.floor(n / 100) === decade,
			).length;
			// A flat draw would put 87 in each. 40 is loose enough not to pin the hash and tight enough to catch clustering.
			expect(inDecade).toBeGreaterThan(40);
		}
	});

	it("walks all 1000 numbers for a pair before repeating one", () => {
		// This is the bijection, and it is what makes pool extension collision-free without consulting the rows already seeded.
		const seen = new Set<number>();
		for (let pass = 0; pass < 1000; pass++) {
			seen.add(numberFor("Gold", "Zebra", pass));
		}
		expect(seen.size).toBe(1000);
	});

	it("keeps every (colour, animal, number) triple unique across the WHOLE namespace", () => {
		// 871,000 triples. Counted per pair rather than materialised, so this stays fast: distinct numbers per pair x distinct pairs is the whole proof.
		let total = 0;
		for (const colour of COLOURS) {
			for (const animal of ANIMALS) {
				const seen = new Set<number>();
				for (let pass = 0; pass < 1000; pass++) {
					seen.add(numberFor(colour, animal, pass));
				}
				expect(seen.size).toBe(1000);
				total += seen.size;
			}
		}
		expect(total).toBe(PAIRS * 1000);
	});

	it("stays inside 0-999 for every pair on every pass", () => {
		for (const colour of COLOURS) {
			for (const animal of ANIMALS) {
				for (let pass = 0; pass < 1000; pass += 97) {
					const n = numberFor(colour, animal, pass);
					expect(n).toBeGreaterThanOrEqual(0);
					expect(n).toBeLessThanOrEqual(999);
				}
			}
		}
	});

	it("is deterministic — the same pair and pass always give the same number", () => {
		expect(numberFor("Jade", "Ferret", 0)).toBe(numberFor("Jade", "Ferret", 0));
		expect(numberFor("Jade", "Ferret", 7)).toBe(numberFor("Jade", "Ferret", 7));
	});

	it("leaves the image axis alone — variant still follows the pass, not the number", () => {
		// The number and the picture are independent axes. A tuple's pfp is named by pair and variant; changing how the number is drawn must not move which image a signup gets.
		const cats = generatePoolTuples(PAIRS * 9).filter(
			(t) => t.animal === "Cat" && t.colour === "Gold",
		);
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
});
