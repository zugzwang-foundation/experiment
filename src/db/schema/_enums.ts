import { pgEnum } from "drizzle-orm/pg-core";

// Cross-file pgEnums extracted here to break runtime evaluation cycles.
// sideEnum is used eagerly (non-lambda) by bets.ts (bets.side, positions.side)
// and comments.ts (side_at_post_time). With sideEnum declared in bets.ts and
// imported by comments.ts inside the bets↔comments lambda-FK cycle, drizzle-kit's
// CJS module evaluation hits a TDZ error at comments.ts's eager sideEnum(...) call
// before bets.ts reaches its export declaration. Extraction breaks the cycle
// because _enums.ts has no schema imports — lambda-FK pattern between bets and
// comments is preserved (FK lambdas are evaluated lazily, fine inside cycles).
//
// 3.B erratum absorbed by SCAFFOLD.2 stratum 3.C (per docs/plans/SCAFFOLD.2-3C.md
// §"3.B erratum absorbed"). Per user condition (a): only sideEnum is extracted;
// other pgEnums remain co-located with their tables until proven part of a cycle.
export const sideEnum = pgEnum("side", ["YES", "NO"]);
