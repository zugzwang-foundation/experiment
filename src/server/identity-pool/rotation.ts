// Generate `identity_pool` tuples in the order they will be handed out.
//
// `consumeIdentityPoolTuple` allocates FIFO by `created_at`, so the order rows are seeded in IS the order users receive them. The obvious nested loop over colours and animals would give the first thirteen signups the same animal in thirteen colours, and the next thirteen the same again — the pool would look broken to anyone watching a launch.
//
// The fix is arithmetic rather than shuffling. 13 and 67 are coprime, so walking `colour = i mod 13` and `animal = i mod 67` together visits all 13 x 67 = 871 pairs exactly once before repeating (the Chinese remainder theorem), and consecutive steps always advance both indices — no two adjacent tuples can share either axis. Being a pure function of `i` also makes the whole thing deterministic and resumable, which a shuffle would not be.

import {
	ANIMALS,
	type Animal,
	COLOURS,
	type Colour,
	PFP_VARIANTS,
} from "./vocabulary";

const PAIRS = COLOURS.length * ANIMALS.length;

// Numbers are three-digit, 000-999, per SPEC.1 §13 + ADR-0011. One number is spent per full pass over the grid, which caps the namespace at 871,000.
const MAX_NUMBER = 999;

export type PoolTuple = {
	colour: Colour;
	animal: Animal;
	number: number;
	pseudonym: string;
	pfpFilename: string;
};

/**
 * Build the PFP filename for one (colour, animal, variant) triple.
 *
 * Input: a colour and animal from the vocabulary, and a zero-based variant index. Output: the `pfp_filename` value, matching the object keys the asset pipeline's upload step writes under `v1/`.
 *
 * The upload script's own path is deliberately not named here: it lives in a private operator environment that nothing in this repository can reach, and the contract that matters to a caller is the KEY SHAPE below, which is reproduced in full.
 *
 * Variant 0 gets the bare slug so the common case — 65 of 67 animals have exactly one render — carries no suffix. The `v` prefix keeps this axis distinct from the `-<number>` segment ADR-0011 adds once number compositing is built.
 */
export function pfpFilenameFor(
	colour: Colour,
	animal: Animal,
	variant: number,
): string {
	const base = `${colour.toLowerCase()}-${animal.toLowerCase()}`;
	return variant === 0 ? `${base}.webp` : `${base}-v${variant}.webp`;
}

/**
 * Generate `count` pool tuples in seed order.
 *
 * Input: how many tuples to emit. Output: an array of tuples whose `(colour, animal, number)` triples and `pseudonym` values are both unique, ready for bulk INSERT.
 */
export function generatePoolTuples(count: number): PoolTuple[] {
	if (!Number.isInteger(count) || count < 0) {
		throw new RangeError(`count must be a non-negative integer, got ${count}`);
	}
	const maxCount = PAIRS * (MAX_NUMBER + 1);
	if (count > maxCount) {
		throw new RangeError(
			`count ${count} exceeds the ${maxCount}-tuple namespace (${PAIRS} pairs x ${MAX_NUMBER + 1} numbers)`,
		);
	}

	const tuples: PoolTuple[] = [];
	for (let i = 0; i < count; i++) {
		const colour = COLOURS[i % COLOURS.length];
		const animal = ANIMALS[i % ANIMALS.length];
		// Each full pass over the grid spends one number, so the pass index is both the number and the variant cursor for every pair in it.
		const pass = Math.floor(i / PAIRS);
		const variant = pass % PFP_VARIANTS[animal];
		tuples.push({
			colour,
			animal,
			number: pass,
			pseudonym: `${colour}${animal}${String(pass).padStart(3, "0")}`,
			pfpFilename: pfpFilenameFor(colour, animal, variant),
		});
	}
	return tuples;
}
