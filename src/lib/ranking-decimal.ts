import Decimal from "decimal.js";

/**
 * The ranking model's single arithmetic authority (DEBATE.8 / OD-2). A cloned
 * decimal.js constructor isolated from any global decimal.js configuration —
 * mirrors `CpmmDecimal`'s precision (50) and rounding, but is **deliberately
 * NOT** `CpmmDecimal`: that module imports `server-only`, and `ranking.ts` must
 * stay pure and importable from `src/lib`, the server, AND `tsx` operational
 * scripts (the staging-verify path). So the ranking score math gets its own
 * non-server-only constructor here.
 *
 * Why decimal, not JS floats (CLAUDE.md §2 + RANKING.md §10): `D` is a sum of
 * NUMERIC(38,18) stakes, and the order must be **bit-exact reproducible** from
 * the public dataset. JS `Math.pow` is libm-dependent (not guaranteed
 * bit-identical across platforms); decimal.js `pow` at a fixed precision is
 * deterministic. precision 50 gives headroom for the ratio / `n^b` score math.
 */
export const RankingDecimal = Decimal.clone({
	precision: 50,
	rounding: Decimal.ROUND_HALF_EVEN,
});
