import Decimal from "decimal.js";

import { ComposerDecimal } from "@/components/debate/composer/sell-convert";

/**
 * POSREV-1 — **ONE ARGUMENT'S SHARE OF A HOLDING'S CURRENT VALUE.**
 *
 * ```
 *   argument_current = position_current × (surviving_shares ÷ quantity)
 * ```
 *
 * ⛔ **NOT A PER-ARGUMENT `computeSell`, AND THAT IS THE WHOLE REASON THIS FILE
 * EXISTS.** A CPMM sell curve is CONCAVE: selling 40 shares realises more per
 * share than selling 120 does. So three independent `computeSell` calls — one
 * per argument — sum to strictly MORE than one call for the whole holding, and
 * the parts would exceed the whole on the surface built to cure exactly that. A
 * PARTITION cannot: the shares are fungible in the pool, the holding has one
 * defensible mark (SPEC.1 §23's FI-2), and this splits that single mark by share
 * count. It also means no quote is fetched and no engine call is made to render
 * a tile.
 *
 * ⚠⚠ **THE SHORT-CIRCUIT IS LOAD-BEARING — BUT NOT FOR THE REASON THIS DOCBLOCK
 * FIRST GAVE, AND THE WRONG REASON IS THE DANGEROUS PART.** It claimed that
 * without the short-circuit `sell-convert.ts:54`'s full-exit branch "would then
 * miss". **It would not.** That branch tests `dharmaIn.equals(currentValue)`, and
 * both are the SAME STRING whatever this function returns — the seed and the
 * conversion basis are one value, so the branch fires either way. A reader acting
 * on the stated mechanism would have concluded the short-circuit was removable.
 *
 * ⇒ **What it actually buys** is that the tile's seed equals the HOLDING's mark
 * exactly, so the tile and its group header agree on screen and the value that
 * goes out is the one the server already computed. Measured: without it,
 * `c × q ÷ q` at 38-digit magnitudes loses a unit in the last place
 * (`99999999999999999.999999999999999999` → `…998`). Small, and it would put a
 * figure on the wire that no server ever produced.
 * (Corrected after `@security-auditor` measured the branch — the guard was right
 * and its justification was not, which is the lying-docblock class this codebase
 * polices.)
 *
 * ⚠ **`ComposerDecimal`, deliberately** — the same clone `sellSharesFor` uses,
 * so the seed and the conversion that consumes it run ONE arithmetic rather than
 * two that agree until the moment they matter. `CpmmDecimal` is `server-only`
 * and cannot cross the client boundary; this is its sanctioned mirror, and its
 * config parity with the real one is pin-tested.
 *
 * Emitted at 18 dp ROUND_DOWN — inside the NUMERIC(38,18) domain, never
 * overstating, matching `sellSharesFor`'s own output convention.
 */

/** The canonical 18-dp zero, matching `lots/compute.ts`'s. */
export const CANONICAL_ZERO = "0.000000000000000000";

export function argumentCurrentExact(args: {
	/** Đb for the WHOLE holding — the single §10.8 mark. */
	positionCurrent: string;
	/** This argument's surviving shares (`lots.surviving_shares`). */
	survivingShares: string;
	/** The holding's `positions.quantity` — Σ of the surviving shares (R2). */
	quantity: string;
}): string {
	let shares: InstanceType<typeof ComposerDecimal>;
	let quantity: InstanceType<typeof ComposerDecimal>;
	try {
		shares = new ComposerDecimal(args.survivingShares);
		quantity = new ComposerDecimal(args.quantity);
	} catch {
		return CANONICAL_ZERO;
	}
	if (
		!shares.isFinite() ||
		!quantity.isFinite() ||
		!shares.greaterThan(0) ||
		!quantity.greaterThan(0)
	) {
		// A sold argument holds nothing and is worth nothing — and so is any share
		// of a holding that itself holds nothing, which is every argument in a
		// fully-exited market, where `quantity` is zero and the ratio is undefined.
		return CANONICAL_ZERO;
	}
	// ⛔ THE BYTE-IDENTITY BRANCH. See the docblock — this is the sell seed.
	if (shares.equals(quantity)) {
		return args.positionCurrent;
	}
	try {
		return new ComposerDecimal(args.positionCurrent)
			.times(shares)
			.dividedBy(quantity)
			.toFixed(18, Decimal.ROUND_DOWN);
	} catch {
		return CANONICAL_ZERO;
	}
}

/**
 * Σ of a set of 18-dp decimal strings, exact — the Closed group header's staked
 * total, and the level-2 parent when a group's tiles are summed. Never a JS
 * float (CLAUDE.md §2); a malformed operand degrades to canonical zero rather
 * than poisoning the sum with `NaN`.
 */
export function sumExact(values: readonly string[]): string {
	let total = new ComposerDecimal(0);
	for (const v of values) {
		try {
			const d = new ComposerDecimal(v);
			if (d.isFinite()) {
				total = total.plus(d);
			}
		} catch {
			// A malformed summand contributes nothing rather than NaN.
		}
	}
	return total.toFixed(18, Decimal.ROUND_DOWN);
}
