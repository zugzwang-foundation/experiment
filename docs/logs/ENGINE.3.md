# ENGINE.3 — session log

> **Stratum:** ENGINE.3 — CPMM property-test suite (fast-check) over the frozen `src/server/cpmm/`.
> **Entry:** plan session (preflight → draft → web line-by-line review → ratification → docs land). Execute session appends below in a fresh CC session.

---

## Plan session — 2026-06-05

**What landed.**
- `docs/plans/ENGINE.3.md` — the founder-ratified implementation plan (**Status: reviewed**) — via **PR #77**, squash-merged to `main` at **`945b764`** (`docs(plans): ENGINE.3 — CPMM property-suite plan (founder-ratified) (#77)`), **+221 lines**.
- No `src/`, no test, no schema/migration changes — plan-only. Plan-chat branch `docs/engine-3-plan` merged and deleted; this log ships on `chore/engine-3-log`.

**Decisions made — OQ-1..10 (all founder-ratified 2026-06-05).**
- **OQ-1** fast-check **`4.8.0` literal pin** (devDependencies); install `pnpm add -D fast-check@4.8.0 --save-exact`.
- **OQ-2** extend `tests/unit/cpmm/`, `*.property.test.ts` + `vectors.test.ts` (property tests of a pure module are unit tests).
- **OQ-3** generator domain approved: reserves `[0.01, 1e9]`, ratio `≤1e4`, stake/shares relative-capped `S≤1e3·b`, sequences `≤20`; sub-ULP × near-ceiling corner excluded.
- **OQ-4** fixed seed **`20260605`** + **`numRuns: 1000`**, uniform per property (sequence included).
- **OQ-5** getPrices-vs-p1 cross-consistency **IN**, ≤1 ulp — scoped to a pool-total-≥-2-Đ sub-generator (see A1).
- **OQ-6** INV-C1 = **exact** reserve-delta identities (bigint equality), module outputs only.
- **OQ-7** ritual: **main-session author** + `@code-reviewer` → `@security-auditor`; no `@test-writer`/RED (frozen-green module); bespoke §5.10 audit.
- **OQ-8** doc-drift riders **approved** (AGENTS.md §9 tree + naming, §1 fast-check; CLAUDE.md untouched).
- **OQ-9** **(a) IN** (valid-domain totality + 18-dp shape folded into properties), **(b) OUT** (invalid-input fuzz stays the smoke suite's job).
- **OQ-10** **re-encode** E1–E5 verbatim in `vectors.test.ts`.

**Decisions made — web amendments A1–A12 (incorporated into the ratified plan).**
- **A1** OQ-5 property **scoped to a reserve-floor-1-Đ sub-generator (pool total ≥ 2 Đ)** — records the **1/total** divergence amplification (`|∂p1/∂a′| ≤ 1/(a′+b′)`) + the worked counter-instance `(0.01,0.01,S=0.013) → ≈8 ulp`; flat ≤1-ulp was optimistic.
- **A2** material-impact floor corrected to **`~2e-7` worst-case across skew** (was the optimistic `~1e-4`).
- **A3** added **strict** impact parity `impact_r(S₂) > impact_r(S₁)` for `S₂≥2·S₁` (gaps `≈3e-10` saturation / `≈2e-7` low end, both `≫1 ulp`).
- **A4** the INV-C4 sequence asserts **exact identities + no-throw/shape only** (intermediate states drift outside the single-op ratio guard).
- **A5** OQ-8 founder-confirmed (Batch C — "approve the rider set").
- **A6** execute **checkpoints CP-1 / CP-2** (web line review before green runs + cascade).
- **A7** out-of-domain wording: excluded **by test policy**, not the gate (sub-ULP positives are `numericString`-valid).
- **A8** fixed seed **`20260605`** + `numRuns 1000` pinned in `_arbitraries.ts` (binary §5.10 grep).
- **A9** tracker row recorded **verbatim** (full tuple).
- **A10** coverage map **one-to-one** (explicit `2.4`/`3.4` discharge rows → `invariants › k non-decreasing`).
- **A11** Status `draft → reviewed`.
- **A12** balanced-pool material-impact floor harmonized to **`~5e-4`** near balanced (the stray `~1e-4` came from the web A2 text; `~2e-7` worst-case unchanged).

**Open questions.** None — all ten ruled. A **separate** future docs PR stands (not this stratum): the `cpmm.md` §10.3 price-recipe clarification (ENGINE.2 carry-forward #5), now carrying the A1 forward-note wording — **"≤1 ulp for pool totals ≥ 1 Đ, scaling as 1/total below."**

**Next session starts at.** **ENGINE.3 EXECUTE in a FRESH CC session** (§5.1/§5.8 plan/execute split — never this session). The corrected execute kickoff is issued by the web chat at close. Execute **step 1** = sync + branch `feat/engine-3-cpmm-properties` off `main` (`945b764`+); **step 2** = `pnpm add -D fast-check@4.8.0 --save-exact`. Pass `@docs/plans/ENGINE.3.md` to the cascade subagents.

**Context to preserve.**
- **Frozen surfaces — byte-untouchable:** `src/server/cpmm/*` (4 files) and the **46/46** smoke suite `tests/unit/cpmm/{calculate,validate}.test.ts`. The execute diff-stat closed set = new test files (`_arbitraries.ts`, `vectors.test.ts`, `{buy,sell,invariants}.property.test.ts`) + `package.json` + `pnpm-lock.yaml` + AGENTS.md riders. **Zero `src/` lines, zero smoke edits.**
- **CP-1 / CP-2 web review checkpoints** before the green runs and the cascade (paste the files in full).
- **Any red property = STOP-and-surface** — a module bug ⇒ a *new* plan, never a same-PR patch; an over-broad property ⇒ web adjudicates against `cpmm.md`. **Never** weaken an assertion or narrow a generator below the plan's bounds to reach green.
- **Seed `20260605` + `numRuns 1000`** uniform (sequence property included).
- **OQ-5 cross-consistency property runs ONLY on the reserve-floor-1-Đ sub-generator** (pool total ≥ 2 Đ).
- **Generators are exact-decimal-string-native** (scaled `bigint` → 18-dp string; **never** JS float); test-side bookkeeping uses exact scaled-integer arithmetic.
- Install note: no `.npmrc` save-exact ⇒ plain `pnpm add` writes a caret — use `--save-exact` for the literal pin. Local `just verify` needs `ZUGZWANG_ENV=preview`.

**Time.** 2026-06-05 (IST) — single plan-chat session: read-only preflight → plan draft + 10 open questions (AskUserQuestion, all ruled to the recommendation) → web "APPROVED WITH AMENDMENTS" A1–A11 → amendments incorporated → A12 at ratification → docs-only PR #77 → squash-merge (`945b764`) → this log.

---
