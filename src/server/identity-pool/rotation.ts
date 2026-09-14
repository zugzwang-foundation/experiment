// Generate `identity_pool` tuples in the order they will be handed out.
//
// `consumeIdentityPoolTuple` allocates FIFO by `created_at`, so the order rows are seeded in IS the order users receive them. The obvious nested loop over colours and animals would give the first thirteen signups the same animal in thirteen colours, and the next thirteen the same again — the pool would look broken to anyone watching a launch.
//
// The fix is arithmetic rather than shuffling. 13 and 67 are coprime, so walking `colour = i mod 13` and `animal = i mod 67` together visits all 13 x 67 = 871 pairs exactly once before repeating (the Chinese remainder theorem), and consecutive steps always advance both indices — no two adjacent tuples can share either axis. Being a pure function of `i` also makes the whole thing deterministic and resumable, which a shuffle would not be.
//
// The NUMBER axis is derived the same way, and for the same reason. It used to be the pass index itself — `number: pass` — which meant the first 871 signups all got `000` and the next 871 all got `001`. At the 1K-10K scale SPEC.1 sizes the experiment at, only the first pass or two is ever reached, so the number carried no information and read as a defect: a wall of `RedFox000`, `JadeOwl000`, `SilverZebra000`. ADR-0011 (line 83) already asked for the opposite — numbers "derived deterministically from `hash(colour + ":" + animal + ":" + version_tag + ...)`", "visually varied (numbers spread across the range, not clustered)", and "pool-extension collision-free". `number: pass` satisfied none of the three. This is a divergence being closed, not a new decision, which is why no spec amendment rides with it.

import { createHash } from "node:crypto";

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
const NUMBER_SPACE = MAX_NUMBER + 1;

/**
 * The override lever ADR-0011 names. Bumping this re-derives every unassigned pair's number sequence.
 *
 * ⚠ It is NOT free to bump. `identity_pool` is Bucket B and the append-only trigger at `drizzle/migrations/0003_append_only_triggers.sql` permits only `assigned_at` to transition, so rows already seeded keep the numbers they were seeded with — a bump reaches new rows only and leaves the pool split across two derivations. Bump it when the asset pipeline's own `version_tag` moves and the pool is being re-seeded anyway, not to nudge the aesthetics of a live pool.
 */
export const NUMBER_VERSION_TAG = "v1";

// ⚠ THE BYTE LAYOUT IS PART OF THE CONTRACT, NOT AN IMPLEMENTATION DETAIL. ADR-0011's driver 2 requires that a third party can re-derive the pool from this repository alone, and "hash-derived" does not say WHICH bytes become the offset and which become the step. Naming them is what makes the derivation reproducible; moving either one silently re-numbers every unassigned pair, which is the announcement `NUMBER_VERSION_TAG` exists to make.
const OFFSET_BYTE = 0;
const STEP_BYTE = 4;

/**
 * Every residue coprime to 1000, which is every odd number that is not a multiple of 5. `1000 = 2^3 * 5^3`, so those are the only two prime factors to dodge, and `phi(1000) = 400` says how many survive.
 *
 * ⚠ THE TABLE IS BUILT BY THE DEFINITION, NOT BY AN ARITHMETIC TRICK, AND THAT IS THE WHOLE POINT. A step drawn from here is coprime to 1000 by construction, which is what makes `pass -> (step * pass + offset) mod 1000` a bijection and therefore what stops a pair from ever revisiting a number across its 1000 passes. An earlier draft of this change computed the step arithmetically and carried a comment asserting it was never a multiple of 5; it was, and the result was 6 colliding `(colour, animal, number)` triples in 8,710 — which the unique index `identity_pool_tuple_idx` would have rejected at seed time, turning a cosmetic change into a failed seed. A comment cannot hold that property. A filter over the range can.
 */
const COPRIME_STEPS: readonly number[] = Array.from(
	{ length: NUMBER_SPACE },
	(_, n) => n,
).filter((n) => n % 2 === 1 && n % 5 !== 0);

// Guard the count rather than trust the filter. If the vocabulary of this module ever moves off a 1000-wide number space, `phi` changes and this fires at import rather than at seed time.
if (COPRIME_STEPS.length !== 400) {
	throw new Error(
		`COPRIME_STEPS must hold the 400 residues coprime to 1000, got ${COPRIME_STEPS.length}`,
	);
}

export type PoolTuple = {
	colour: Colour;
	animal: Animal;
	number: number;
	pseudonym: string;
	pfpFilename: string;
};

type PairCoefficients = { step: number; offset: number };

// One sha256 per PAIR, not per tuple. `generatePoolTuples(871_000)` asks for a number 871,000 times across only 871 distinct pairs, so without this the seed would hash the same eight strings a thousand times each. The cache is keyed by the same string that is hashed, so it cannot drift from what it memoizes, and it does not make the function impure — the same pair still yields the same coefficients in any process.
const coefficientCache = new Map<string, PairCoefficients>();

function coefficientsFor(colour: Colour, animal: Animal): PairCoefficients {
	const seed = `${colour}:${animal}:${NUMBER_VERSION_TAG}`;
	const cached = coefficientCache.get(seed);
	if (cached) return cached;

	const digest = createHash("sha256").update(seed).digest();
	// Two disjoint 4-byte slices, so the offset a pair starts on and the step it walks by are drawn independently. Reusing one slice for both would tie the two together and make the first pass predictable from the step.
	//
	// The `%` introduces a modulo bias of about one part in 14 million (2^32 leaves a remainder of 296 over 1000, and 96 over 400). That is far below what any reader could perceive in 871 draws, and rejection sampling here would buy nothing but a loop.
	const coefficients: PairCoefficients = {
		offset: digest.readUInt32BE(OFFSET_BYTE) % NUMBER_SPACE,
		step: COPRIME_STEPS[
			digest.readUInt32BE(STEP_BYTE) % COPRIME_STEPS.length
		] as number,
	};
	coefficientCache.set(seed, coefficients);
	return coefficients;
}

/**
 * The number a given pair carries on a given pass.
 *
 * Input: a colour and animal from the vocabulary, and a zero-based pass index. Output: an integer in 0-999.
 *
 * `offset` is what spreads the FIRST pass, which is the only pass most of this experiment will ever reach — without it every pair would start at 0 again. `step` is what keeps later passes apart, and being coprime to 1000 is what makes the map a bijection: a pair walks all 1000 numbers before repeating any, so extending the pool can never collide with what is already seeded. That is ADR-0011's "pool-extension collision-free" property, held by the arithmetic instead of by a lookup against existing rows.
 */
export function numberFor(
	colour: Colour,
	animal: Animal,
	pass: number,
): number {
	const { step, offset } = coefficientsFor(colour, animal);
	return (step * pass + offset) % NUMBER_SPACE;
}

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
	const maxCount = PAIRS * NUMBER_SPACE;
	if (count > maxCount) {
		throw new RangeError(
			`count ${count} exceeds the ${maxCount}-tuple namespace (${PAIRS} pairs x ${NUMBER_SPACE} numbers)`,
		);
	}

	const tuples: PoolTuple[] = [];
	for (let i = 0; i < count; i++) {
		const colour = COLOURS[i % COLOURS.length];
		const animal = ANIMALS[i % ANIMALS.length];
		// Each full pass over the grid spends one number per pair, so the pass index is both the number cursor and the variant cursor. The number is now derived from it rather than equal to it; the variant is deliberately left alone, because it selects an IMAGE and the images are named by pair and variant, not by number.
		const pass = Math.floor(i / PAIRS);
		const variant = pass % PFP_VARIANTS[animal];
		const number = numberFor(colour, animal, pass);
		tuples.push({
			colour,
			animal,
			number,
			pseudonym: `${colour}${animal}${String(number).padStart(3, "0")}`,
			pfpFilename: pfpFilenameFor(colour, animal, variant),
		});
	}
	return tuples;
}
