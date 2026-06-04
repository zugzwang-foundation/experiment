/**
 * Derived from Manifold's CPMM implementation (MIT).
 * Upstream: manifoldmarkets/manifold — common/src/calculate-cpmm.ts
 * Read at fork: zugzwang-foundation/manifold-reference,
 *   tag ref-2026-04-28-found5 = commit d5b55cf9472ec05f545e6c1a817d88005b8dbf2b
 * Upstream license: MIT — Copyright (c) 2022 Manifold Markets, Inc.
 * Full notice: THIRD_PARTY_NOTICES.md (repo root).
 * This file: AGPL-3.0-or-later, © The Zugzwang Authors. See docs/specs/cpmm.md §2.
 */
import "server-only";

import Decimal from "decimal.js";

/**
 * The module's single arithmetic authority — a cloned constructor isolated
 * from any global decimal.js configuration (cpmm.md §10.2). precision: 50
 * gives headroom over every NUMERIC(38,18) intermediate this module produces;
 * ROUND_HALF_EVEN governs the (immaterial) internal rounding at that
 * precision. Exported for ENGINE.5 reuse.
 */
export const CpmmDecimal = Decimal.clone({
	precision: 50,
	rounding: Decimal.ROUND_HALF_EVEN,
});

// Boundary quantizers (cpmm.md §10.3): every quantity leaving the module is
// serialized to exactly 18 decimal places, direction fixed per quantity class.
// Each takes a precision-50 intermediate and returns the 18-dp decimal string.

/** User-credited quantities — shares bought (§4), sale proceeds (§5): floor. */
export function floor18(d: Decimal): string {
	return d.toFixed(18, Decimal.ROUND_DOWN);
}

/** Prices — p0, pEff, p1, impact (§6): half-even. Informational only. */
export function halfEven18(d: Decimal): string {
	return d.toFixed(18, Decimal.ROUND_HALF_EVEN);
}

/**
 * Pad-only — values already exact at ≤18 dp: seeds (§7.1), reserves derived by
 * exact add/sub (§10.3), the resolved-unwind selector (§8.1). No rounding.
 */
export function toFixed18(d: Decimal): string {
	return d.toFixed(18);
}
