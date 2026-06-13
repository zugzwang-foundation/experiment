import "server-only";

// ENGINE.15 S1 RED scaffold — import-resolution STUB ONLY. The real shared
// wire module (D-15.b: `requireAdminSession` / `buildAdminMetadata` /
// `canonicalizeAmount18` / `toActionError`) lands at S2. This file exists so
// the S1 RED test suite resolves its imports and fails on ASSERTION, never on
// module resolution. Nothing here is production logic.

/** SPEC.2 §4.4 Server-Action return envelope (typed codes only — SA-L-3). */
export type ActionResult<T> =
	| { ok: true; data: T }
	| {
			ok: false;
			error: {
				code: string;
				message: string;
				field_errors?: Record<string, string[]>;
			};
	  };

/**
 * STUB (S1 RED). The real canonicalizer (CR-3/SA-I-3) validates a positive
 * NUMERIC(38,18) string — rejecting sign, exponent, empty, `1.`, and >18-dp —
 * and returns the canonical `^[0-9]+\.[0-9]{18}$` form (one integer digit
 * minimum, exactly 18 fractional digits, value > 0). The stub returns its
 * input unchanged and never throws, so every §State×Action `canonicalizeAmount18`
 * table row fails on ASSERTION: valid rows get the wrong (un-canonicalized)
 * string; reject rows get no throw. S2 implements.
 */
export function canonicalizeAmount18(input: string): string {
	return input;
}
