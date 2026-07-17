import Decimal from "decimal.js";

/**
 * UI.A3 slice 1 — the sell Đ→shares conversion (plan §3.2 "Sell conversion" +
 * §1 I-NO-OVERSELL row + SG-2). Display/input conversion ONLY — the
 * authoritative math (proceeds, oversell) is server-side; the storage
 * CHECK + `insufficient_shares` pre-check backstop everything here.
 *
 * SG-2 LAW: sell is NEVER clamped — this module carries no per-bet cap code
 * of any kind (grep-pinned by its unit test). The only bound is the held
 * quantity.
 */

/**
 * The CLIENT-side decimal.js constructor — a clone mirroring the server's
 * `CpmmDecimal` (src/server/cpmm/decimal.ts, cpmm.md §10.2), which is
 * `server-only` and cannot cross the client boundary. Config parity is
 * pin-tested against the real CpmmDecimal so this mirror can never drift.
 * Exact decimal strings, never JS floats (CLAUDE.md §2).
 */
export const ComposerDecimal = Decimal.clone({
	precision: 50,
	rounding: Decimal.ROUND_HALF_EVEN,
});

/** One share quantum — the NUMERIC(38,18) least significant digit. */
const MIN_POSITIVE_SHARES = "0.000000000000000001";

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Đ input → shares to sell. Full exit (dharmaIn decimal-equal to the
 * position's currentValue) returns `quantity` BYTE-IDENTICAL — zero
 * arithmetic, zero rounding drift on the sell-to-zero path (§6 edge).
 * Partial: shares = quantity × dharmaIn ÷ currentValue via exact decimal
 * strings, emitted at 18 dp (ROUND_DOWN — never overstate), capped at the
 * held quantity, and floored at one share quantum so a positive Đ input
 * never converts to zero shares (positivity holds — §6 dust edge). Throws on
 * a non-positive/non-numeric dharmaIn (caller bug; the module UI bounds the
 * input first).
 */
export function sellSharesFor(args: {
	quantity: string;
	currentValue: string;
	dharmaIn: string;
}): string {
	if (
		!PLAIN_DECIMAL.test(args.dharmaIn) ||
		!new ComposerDecimal(args.dharmaIn).greaterThan(0)
	) {
		throw new Error("sellSharesFor: dharmaIn must be a positive decimal");
	}
	const dharmaIn = new ComposerDecimal(args.dharmaIn);
	if (dharmaIn.equals(args.currentValue)) {
		return args.quantity;
	}
	const shares = new ComposerDecimal(args.quantity)
		.times(dharmaIn)
		.dividedBy(args.currentValue);
	if (shares.greaterThanOrEqualTo(args.quantity)) {
		return args.quantity;
	}
	const fixed = shares.toFixed(18, Decimal.ROUND_DOWN);
	if (!new ComposerDecimal(fixed).greaterThan(0)) {
		return MIN_POSITIVE_SHARES;
	}
	return fixed;
}
