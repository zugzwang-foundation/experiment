import "server-only";

import { CpmmDecimal } from "@/server/cpmm/decimal";
import { numericString } from "@/server/events/schemas";

import { DharmaInputError } from "./errors";

/**
 * `canonicalize(value)` — the single string-form authority for Dharma
 * quantities (plan "Canonicalization spec", D-1 simplified).
 *
 *   1. Gate `value` through `numericString` (reused VERBATIM from the events
 *      module — the signed NUMERIC(38,18) decimal-string validator,
 *      `/^-?\d{1,20}(?:\.\d{1,18})?$/`). Failure → `DharmaInputError`.
 *   2. Return `new CpmmDecimal(value).toFixed(18)` — exactly 18 fractional
 *      digits, leading zeros collapsed, `-0` / `0.0` normalized to unsigned
 *      zero (PROBE-1, decimal.js 10.6.0). Inputs with ≤18 fractional digits
 *      are exact pad-only — the regex caps fractional digits at 18, so
 *      `toFixed(18)` never rounds.
 *
 * The explicit `-0` step-4 branch was dropped (D-1): `toFixed(18)` is the
 * full canonicalizer at decimal.js 10.6.0. The vendor contract is pinned by
 * `tests/unit/dharma/_probe-decimal-negzero.test.ts`.
 */
export function canonicalize(value: string): string {
	if (!numericString.safeParse(value).success) {
		throw new DharmaInputError(
			`not a NUMERIC(38,18) decimal string: ${JSON.stringify(value)}`,
		);
	}
	return new CpmmDecimal(value).toFixed(18);
}
