import "server-only";

import { CpmmDecimal } from "@/server/cpmm/decimal";

import { canonicalize } from "./canonical";
import {
	DharmaInputError,
	DharmaOverdraftError,
	DharmaPoolTagError,
} from "./errors";
import { type DharmaEntryType, POOL_DORMANT_TAGS } from "./tags";

/** A computed ledger row: canonical 18-dp `amount` + resulting `balanceAfter`. */
export type LedgerComputation = { amount: string; balanceAfter: string };

const POOL_TAGS = new Set<DharmaEntryType>(POOL_DORMANT_TAGS);

/**
 * The pure Dharma-ledger row computation. No IO, no clock, no randomness.
 *
 * - Pool tags (`pool_seed` / `pool_unwind`) → `DharmaPoolTagError` (R-2: the
 *   ledger is user-only). Checked first, before any input parsing.
 * - BOTH `previousBalance` AND `amount` are gated + canonicalized through the
 *   `numericString` gate (R-CP1-A): invalid either → `DharmaInputError`.
 *   `previousBalance` is NOT assumed pre-canonical (defensive, same A9
 *   philosophy as the conservation checker).
 * - `uncollectable` is the special case (OQ-1 model A): `amount <= 0` is
 *   ENFORCED (positive → `DharmaInputError`, the A9 sign guard — the ONLY
 *   defense, since this row bypasses balance arithmetic AND the storage
 *   CHECK), and `balanceAfter = previousBalance` (UNCHANGED — the one row
 *   where `balanceAfter != previousBalance + amount`).
 * - Every other writable tag: `balanceAfter = previousBalance + amount` as an
 *   exact 18-dp add/sub on the canonicalized operands (no rounding — both are
 *   canonical 18-dp strings post-gate, R-CP1-A). `balanceAfter < 0` →
 *   `DharmaOverdraftError`, the application mirror of the storage
 *   `CHECK (balance_after >= 0)` (INV-2 no-overdraft floor).
 *
 * Per-tag sign for the other 7 is NOT enforced — producer-owned
 * (ENGINE.9/12/signup); the core's only numeric floor is the overdraft check.
 */
export function computeLedgerRow(args: {
	previousBalance: string;
	amount: string;
	entryType: DharmaEntryType;
}): LedgerComputation {
	const { entryType } = args;

	if (POOL_TAGS.has(entryType)) {
		throw new DharmaPoolTagError(
			`pool tag not writable to the user ledger (R-2 dormant): ${entryType}`,
		);
	}

	const previousBalance = canonicalize(args.previousBalance);
	const amount = canonicalize(args.amount);

	if (entryType === "uncollectable") {
		if (new CpmmDecimal(amount).greaterThan(0)) {
			throw new DharmaInputError(
				`uncollectable amount must be <= 0 (A9 sign guard): ${amount}`,
			);
		}
		return { amount, balanceAfter: previousBalance };
	}

	const balanceAfter = new CpmmDecimal(previousBalance).plus(amount);
	if (balanceAfter.lessThan(0)) {
		throw new DharmaOverdraftError(
			`balance_after < 0 (overdraft): ${previousBalance} + ${amount}`,
		);
	}

	return { amount, balanceAfter: balanceAfter.toFixed(18) };
}
