# DROUND — Đ display rounding (0-dp, ROUND_HALF_UP)

**Task:** Round every Đ (Dharma) value rendered to a user to **0 decimal places,
ROUND_HALF_UP** (round half away from zero), product-wide. **VIEW LAYER ONLY** —
the engine, cpmm, ledger, read models and every DTO keep full `NUMERIC(38,18)`
precision. SPEC.1 §10.8. Combined plan + execute, single-threaded, no new deps.

**Baseline:** origin/main `78b2952` (SPEC.1 1.0.22; migration head `0024`;
EVENT_TYPES 24; ADR head 0033). Worktree `../wt-dround` on
`feat/dround-display-rounding`. Full suite green at baseline (1924 tests).

## Grounding (recon-pinned, re-verified)

- **33 Đ-currency render sites**; 32 funnel through the two shared formatters
  (`formatDharma`, `formatDharmaGrouped`), exactly **1 renders raw**:
  `ReviewFeed.tsx:165` `Đ{row.authorDharma}`.
- Root cause: `src/components/debate/format.ts :: formatDharma` trimmed trailing
  zeros only, **never rounded**; `composer/copy.ts :: formatDharmaGrouped`
  delegates to it (inherits the fix for free).
- `src/server/debate-export/serialize.ts` imports the shared `formatDharma` (the
  R3 leak) — the `.md` export must keep full precision.
- decimal.js already in the client bundle (`composer/sell-convert.ts`); its
  `ComposerDecimal` clone is ROUND_HALF_EVEN (wrong mode) — a **dedicated** clone
  with the mode passed explicitly is required.
- Re-scan at `78b2952`: **no new Đ render sites** (delta from recon baseline
  `903e185` = one docs-only commit #265). BookmarkCard's 4 sites predate recon.

## Hard guardrails

View-layer only; no DDL / migration / new event type / ADR; the ADR-0025 export
and public dataset keep full precision; multipliers & percentages untouched;
never render `-0`; decimal.js rounding only (never a JS float on a Đ value);
rounded values are terminal (one named exception: the sell-module input seed);
the two existing design guards stay green; touches no critical path.

## Work (ordered)

1. **Tests first** — `tests/unit/debate/format.test.ts`: `formatDharma`
   rounding table, `formatDharmaExact` trim-only, `formatDharmaGrouped`
   grouped+rounding.
2. **Rounding formatter** — `format.ts`: a dedicated `DisplayDecimal =
   Decimal.clone({precision:50})`; `formatDharma` → `toDecimalPlaces(0,
   ROUND_HALF_UP)`, `isZero()`→`"0"` (the −0 guard), malformed → fall back to
   `formatDharmaExact` (never throw).
3. **The rename** — 3a rename the trim-only `formatDharma` → `formatDharmaExact`
   (nothing named `formatDharma` yet); 3b typecheck → capture the broken
   call-site list (the compiler audit); 3c add the new rounding `formatDharma`;
   3d re-point each site (render sites → `formatDharma` auto-resolve; serialize
   → `formatDharmaExact`; sell seed → `formatDharmaExact`).
4. **R3** — `serialize.ts`: change ONLY the import to
   `formatDharmaExact as formatDharma` (body untouched; export precision kept).
5. **R8** — `SellModule.tsx` seed → `formatDharmaExact` + the ratified
   `dround-allow:` marker (byte-identity full-exit; a rounded seed under-sells).
6. **R2** — `format.ts :: displayNetProfitLoss` + `ProfileTiles.tsx`: derive the
   Net P/L tile in DISPLAYED space so `displayed P/L = displayed Wallet +
   displayed Positions − issuance` holds on screen (issuance recovered exactly).
7. **The raw site** — `ReviewFeed.tsx` → wrap `authorDharma` in `formatDharma`.
8. **The guard** — `tests/unit/design/no-raw-dharma-render.test.ts`: static scan
   keyed on money identifiers (not the glyph), also scanning `src/app/(admin)`,
   allowlisting exactly the one `dround-allow:` seed line.
9. **SPEC.1 rider (same commit)** — §0 → 1.0.23; §10.8 the 0-dp paragraph
   (web-authored verbatim); §20 change-log row.
10. Full suite green → `@code-reviewer` → address → plan + log committed last.

## Files

Prod: `format.ts`, `serialize.ts`, `SellModule.tsx`, `ProfileTiles.tsx`,
`ReviewFeed.tsx`. Spec: `docs/specs/SPEC.1.md`. Tests: `format.test.ts`,
`sell-seed-identity.test.ts`, `tile-identity.test.ts`, `no-raw-dharma-render.test.ts`.
