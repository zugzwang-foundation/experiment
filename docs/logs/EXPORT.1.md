# EXPORT.1 — Debate `.md` Export — Session Log

> **Time:** 2026-06-30 (execute session).
> **PR:** **#180** (`feat/export-1` → `main`). Pre-merge branch ref `3b8bfee`; **canonical SHA = the squash-merge SHA on `main`** (fill post-merge).
> **Plan:** `docs/plans/EXPORT.1.md` (status → executing). **Frame:** ADR-0025 + `docs/specs/debate-export.md`.

## What landed (files + PR#)

PR **#180**, one feature commit + three setup commits (plan, golden fixture, §6 spec patch):

- **New** — `src/server/debate-export/{serialize,market-meta,context}.ts`; `src/app/(public)/m/[slug]/export/route.ts`.
- **Read-model gap-fill** — `src/lib/ranking.ts` (`PostSubstrate`/`ReplySubstrate` + `priceAtBet`); `src/server/debate-view/{ranking-substrate,reply-substrate,load-debate-view}.ts` (`price_at_bet` LATERAL → `entryPrice` on non-removed variants only).
- **UI / config** — `src/components/debate/MarketHeader.tsx` (`<a download>`); `next.config.ts` (tracing key).
- **Ripple** — 7 `tests/unit/ranking/*` helpers + `scripts/verify-ranking-staging.ts` (`priceAtBet` required-field default).
- **Tests** — `tests/unit/debate-export/{serialize.test.ts,_fixtures/{mumbai-metro.input.ts,mumbai-metro.expected.md}}` (22); `tests/integration/debate-export.integration.test.ts` (8).
- **Same-commit docs** — SPEC.2 §4 API row; `docs/specs/debate-export.md` §6 deterministic Block-3a template + status `draft → ratified`.

Gates: `just verify` ✓ · full `pnpm vitest run` (1068 passed) ✓ · cascade clean (code-reviewer no CRIT/HIGH, db-migration-reviewer PASS/N/A, security-auditor no CRIT/HIGH/MED).

## Decisions made

- **Deterministic Block 3a** — web-ratified §6 Summary template (orientation + top-non-removed-arg-per-side); replaced the v1 golden's editorial prose with the v2 fixture (only 3a changed).
- **§10.5 totals** read from `meta` verbatim — raw `COUNT(DISTINCT user_id)` / `SUM(stake)` over `bets` (incl. removed-node rows), never summed from masked nodes.
- **`priceAtBet` REQUIRED** on `PostSubstrate`/`ReplySubstrate` (honest type) so `entryPrice` is compiler-bound to the non-removed variant with no `!`/cast in the masking file; cost = mechanical default in ranking-test helpers + staging script (anticipated by plan Self-critique #3).
- **YAML escaping** (`yamlDouble`) on operator-authored front-matter scalars (code-review MEDIUM); byte-identical for quote-free values.
- **`Content-Disposition`** uses the canonical `market.slug`.
- **Removed-reply** node = structural-only placeholder (spec-undefined; implemented + tested).

## Open questions

- Q1 (Đ grouping) → export-only `formatDharmaGrouped`. Q2 (rate limit) → none (mirrors public read). Q3 (price 2 dp) → `CpmmDecimal.toFixed(2)`. Q4 (market-meta placement) → separate export-only read. Q5 (chain-tip reason) → hand-rolled (no existing reader). Q6 (tracing key) → verified in `route.js.nft.json`. **All resolved.**
- **Tracker note (non-blocking):** the shared pure Đ/percent formatter (`@/components/debate/format`, reused server-side per plan §3) is a candidate to relocate to `src/lib/`.

## Surprises caught + fixed in-session

1. **STOP-gate (pre-build):** the v1 golden's Block 3a Summary was **non-deterministic editorial prose** (paraphrased the question + bodies) — a pure serializer cannot reproduce it, and hard-coding would trip the §3 social-content-invention refusal. Surfaced before `@test-writer`; web ratified a deterministic §6 template and redelivered the **v2** golden (only 3a changed) → unblocked.
2. **Code-review MEDIUM:** front-matter scalars were emitted unescaped → an operator title containing `"`/newline would break the YAML. Added `yamlDouble`.
3. **Security LOW:** the removed-reply placeholder was compiler-safe but **untested** (the plan's "masking is tested, not safe-by-absence" doctrine covered removed posts only). Added a removed-reply regression unit test.

## Next session starts at (exact next action)

**POST-MERGE:** after the operator merges PR #180 (web-gated), stage canonical PK copies — `docs/plans/EXPORT.1.md` + `docs/logs/EXPORT.1.md` → `~/Desktop/zz-pk-refresh-EXPORT.1/` with `-plan`/`-log` dest suffixes (md5-verified; avoid the shared-basename clobber) — and produce the PK update table.

## Context to preserve

- The byte-exact golden is a **matched pair**: `mumbai-metro.input.ts` (a hand-built `DebateViewModel`) → `mumbai-metro.expected.md` with the single `{{ZUGZWANG_MD_CONTEXT}}` token spliced to `public/zugzwang.md`'s verbatim bytes. The serializer reads the context verbatim (no trim) and frames it with `\n\n`.
- The reactive-removal **writer is not built** → nothing is removable in prod today; masking ships TESTED via an injected `mod_actions content_removed` row (post + reply paths).
- `priceAtBet` rides `PostSubstrate`/`ReplySubstrate` (required) but the pure ranking model ignores it.
