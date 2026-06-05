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

## Execute session — 2026-06-05

**What landed.**
- The CPMM property suite — **PR #79**, squash-merged to `main` at **`d8e9159`** (`test(cpmm): ENGINE.3 — CPMM property suite (fast-check) (#79)`). Closed set **8 files, +1233 / −3**: 5 new under `tests/unit/cpmm/` (`_arbitraries.ts`, `vectors.test.ts`, `{buy,sell,invariants}.property.test.ts`) + `package.json` + `pnpm-lock.yaml` (fast-check **`4.8.0`** literal pin) + `AGENTS.md` (OQ-8 riders). **41 new tests** (21 vectors + 6 buy + 4 sell + 10 invariants); with the frozen 46/46 smoke = **87/87**. **Zero `src/` lines, zero smoke edits, `tsconfig` untouched.**
- Six signed commits on `feat/engine-3-cpmm-properties`: deps pin → arbitraries+vectors → CP-1 fixes (F-1..F-3) → property suite → CP-2 nit (F-4) → OQ-8 riders.

**Gates.** Local `tests/unit/cpmm/` **87/87** · `tests/unit/` **97/97** · `ZUGZWANG_ENV=preview just verify` clean (tsc + biome 151 files + build). **Whole-suite gate = CI on PR #79 — green in `1m42s`** (Biome → tsc → migrate → `vitest run` vs the Postgres-17 service); this IS the SURPRISE-3 discharge (the 27 DB-backed files that `ECONNREFUSED`'d locally all passed on CI). Cascade: `@code-reviewer` **clean at all severities**; `@security-auditor` **sound** (mutation-tested INV-C4 — skim / inflate / underpay mutants **all caught**; **0/1000** vacuity on strict separations). Bespoke §5.10 audit **all-PASS**.

**Decisions made.**
- **Checkpoints.** CP-1 (arbitraries + vectors, web line-review) → **CP-1b** (post-F-1 re-review) → CP-2 (the three property files) → pre-PR verification — each web-gated; no property file authored before its checkpoint cleared.
- **Fixes.** **F-1 (must-fix)** — magnitude-stratified `stratUnits` draw: `fc.bigInt` is linear-uniform ⇒ ~90% mass in the top decade; decade-uniform stratification (**same support**, only re-weighted) restores the plan's multi-magnitude vacuity guard, wired into every draw. **F-2** E3 18-dp shape adds `out.impact`. **F-3** header "safe interior" scoped to the single-op generators + sequence-harness note. **F-4** `reservesArb` comment names both consumers (sum-to-1 + INV-C5 unwind-determinism).
- **Rulings.** **R-1** SURPRISE-2 resolved test-side (option a); `tsconfig` untouched + carry-forward minted (below). **R-2** `seedArb` ratified (the INV-C4 "sequence from a seed" requires it). **R-3** two pre-authorized `_arbitraries.ts` additions — `orderedStakePairScenario` (R-3a, weak monotone impact) + `reservesArb` (R-3b, sum-to-1 + INV-C5 unwind).
- **Two LOW findings → no-change** (founder-adjudicated): plan self-critique **item 5** (fixed-seed determinism — accepted for a frozen module; mitigated by the `stratUnits` decade-spread) and **item 2** (INV-C4 aggregate holdings, not per-user — aggregation-invariant per §3.2; per-user `positions` is ENGINE.7/9). Re-surfacing recorded; **no new carry-forward task** (R-1 is the only new-minted one).

**Surprises caught + adjudicated (full chain).**
- **SURPRISE-1** — preflight: the plan is **221 lines**, not the relay's stated "222" (corroborated by `wc`/`awk`/`od` + the plan-session log's "+221 lines" + merged PR #77). Adjudicated a **web-relay / PK-viewer trailing-newline rendering error**; proceeded on 221, plan canonical.
- **SURPRISE-2** — the repo `target` ES2017 **forbids `n`-suffixed bigint literals** (TS2737), yet the plan mandates exact `bigint`. Resolved **in-scope, test-side** via `pow10()` / `BigInt()` (the `bigint` type + `BigInt` global are ES2017-ok via `lib: esnext`; only the literal *syntax* is gated) — same exact arithmetic, no config/frozen change. Founder ratified (a); the ES2017→ES2020 bump minted as **R-1**.
- **SURPRISE-3** — the plan's step-4b whole-suite **local** run is environment-gated: DB-backed suites need Postgres (absent — port 54322 closed). Per the ENGINE.2 CI-adjudication convention (local = pre-PR proxy; CI = merge gate), discharged by **CI on PR #79** (green, 1m42s); local substitute = the maximal DB-independent subset (`tests/unit/` 97/97). The ratified plan was **not** edited (record, not living doc).

**Carry-forward statuses.**
- ENGINE.2 **#1** (magnitude-bounded `k` / OQ-5 cross-consistency) — ✓ **DISCHARGED here** (INV-C2 `k′≥k` + the OQ-5 ≤1-ulp property, both green).
- ENGINE.2 **#2** (sub-ULP × near-ceiling out-of-domain, A7) — ✓ **DISCHARGED here** (documented as test policy in `_arbitraries.ts`).
- ENGINE.2 **#3** (`numericString` `-0` / leading-zeros, OQ-9b) — → **ENGINE.5** (open).
- ENGINE.2 **#5** / `cpmm.md` §10.3 price-recipe clarification — **still queued** as a separate docs PR, with the A1 wording: **"≤1 ulp for pool totals ≥ 1 Đ, scaling as 1/total below."**
- Plan self-critique **item 2** (INV-C4 per-user attribution) — → **ENGINE.7/9** (`positions`).
- **NEW — R-1:** evaluate `tsconfig` `target` **ES2017 → ES2020** (restores bigint-literal syntax; interacts with build output) — **config/HARDEN-class** task.
- Operator **2FA** — **discharged** (per founder, this wind-down).

**Open questions.** None.

**Next session starts at.** A **fresh CC session** for the next stratum (per the operator tracker / web chat) — `/clear` + a new web pair (§5.8). ENGINE.3 is closed; this log + the PK refresh ship in this wind-down. The `cpmm.md` §10.3 clarification docs PR remains separately queued.

**Context to preserve.**
- `src/server/cpmm/*` + the smoke suite stay **frozen**; ENGINE.5 (Dharma) reuses `CpmmDecimal` (`src/server/cpmm/decimal.ts`) and the exact-bigint discipline.
- **`stratUnits`** (decade-uniform, support-identical to `fc.bigInt`) is the generator-distribution pattern for future fast-check suites; `{seed: SEED, numRuns: NUM_RUNS}` is imported from `_arbitraries.ts`, never re-literaled.
- Whole-suite local runs are DB-gated (no local Postgres) — use `tests/unit/` as the DB-independent proxy and let CI run the full suite (the SURPRISE-3 convention).
- **R-1** (tsconfig ES2017→ES2020) is the only new open carry-forward — config/HARDEN-class, non-blocking.

**Time.** 2026-06-05 (IST) — single execute session in a fresh CC pair: preflight → branch + install → CP-1 (arbitraries + vectors) → CP-1b (F-1 `stratUnits`) → CP-2 (property suite) → steps 4–7 (formal greens · OQ-8 riders · `@code-reviewer`→`@security-auditor` cascade · §5.10 audit) → PR #79 → CI green (1m42s) → founder squash-merge (`d8e9159`) → this log.

---
