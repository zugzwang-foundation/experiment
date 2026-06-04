# ENGINE.3 — CPMM property-test suite (`tests/unit/cpmm/`)

> **Status:** reviewed
> **Date:** 2026-06-05
> **Author:** Hrishikesh + Claude Code (plan tab)
> **Critical-path?** Adjacent, with a bespoke ritual (OQ-7). CPMM math is thesis-touching (conservation, payout/bet math — CLAUDE.md §5.6), so the property suite that *proves* the cpmm.md §11 invariants gets the full review cascade (`@code-reviewer` → `@security-auditor`) and a pre-PR §5.10 audit. But the task touches **no `src/`** — the module is frozen — so there is **no `@test-writer`/RED phase** (main-session authoring; the tests verify a frozen-green module, they don't drive it) and **no schema review**.
> **Plan PR / commit:** this file commits before Phase 2 (CLAUDE.md §5.1); execute happens after founder ratification.

---

## Tracker context

Tracker row (operator tracker, ENGINE lane — v12 at plan time; full tuple verbatim as supplied; the operator-maintained external HTML is not edited here — memory `project_tracker_external`, ENGINE.2 `vendor/manifold/` recording precedent):

```
{ id: "ENGINE.3",  phase: 3, title: "CPMM property tests (fast-check)",
  desc: "Constant product holds, probabilities sum to 1, no negative balances,
  idempotency on duplicate events.", pri: "P0", deps: ["ENGINE.2"], est: "2d" }
```

**Drift reconciliation (record; do not edit the tracker).** The `desc` predates `cpmm.md` and conflates ENGINE.3 with later strata; the binding charter is `cpmm.md`'s (§4.2, §5.2, §11, §12), not this row:

- *"Constant product holds"* → **INV-C2** `k′ ≥ k` (exact `k′ = k` in the no-dust branch). In charter. ✓
- *"probabilities sum to 1"* → `p_yes + p_no = 1`, asserted **≤1 ulp** after independent half-even rounding (§3.3). In charter (carry-forward assertion). ✓
- *"no negative balances"* → conflates with **ENGINE.5** (Dharma `dharma_ledger.CHECK (balance_after >= 0)`). A pure module has **no balances**; its analogs are INV-C3 domain (`reserves > 0`) + the sequence-bookkeeping `holdings ≥ 0`. Balance non-negativity is ENGINE.5, **out of scope**.
- *"idempotency on duplicate events"* → **ENGINE.6/7** (`event_id` idempotency). A pure module has **no events**. **Out of scope.**

**Dependency status at plan time:** **ENGINE.2 — done.** The frozen module `src/server/cpmm/` (4 files) + the 46-test smoke suite landed via **PR #75**, squash-merged to `main` at **`2a8d888`** (`feat(cpmm): ENGINE.2 — pure CPMM module (#75)`); session-log PR #76 at `130ddba` (current HEAD). `cpmm.md` v1.0.0 (ENGINE.1, `48ca6d0`) is the canonical charter; `numericString` (ENGINE.0, `src/server/events/schemas.ts:23`) is the boundary shape gate the generators target.

---

## Approach (one paragraph)

Add a **universally-quantified property suite + verbatim fixed-vector suite** for the frozen pure CPMM module, using **fast-check 4.8.0** (literal pin). The module under test (`src/server/cpmm/`) and the ENGINE.2 smoke files (`tests/unit/cpmm/{calculate,validate}.test.ts`) are **frozen** — this task adds *only* new test files (+ `package.json`/lockfile + doc riders). Every property asserts a **spec relation between the module's inputs and its outputs** (orderings, the §10.3 derivation deltas, the §8.1 residual identity) — **never an independent re-computation of the curve** (which would share the implementation's bugs). Because the module returns **18-dp rounded** strings while the spec relations are stated over **exact** math, each property pins a **rounding-aware assertion form** (strict / weak / gap-conditioned) plus the **joint generator constraints** that keep that form sound; the central judgment (OQ-3) is a generator domain wide enough to be non-vacuous (multi-order-of-magnitude spans, E4-style skew, both sides, dust + no-dust branches) yet narrow enough to exclude only the economically-unreachable sub-ULP × near-ceiling corner that ENGINE.2 security triage put out of domain. Generators are **exact-decimal-string-native** (scaled `bigint` → 18-dp string; never JS float), and test-side bookkeeping for the audit identities uses **exact scaled-integer arithmetic**, independent of decimal.js. A failing property at execute is **STOP-and-surface**, never a reach-for-green weakening.

---

## Suite design

### File layout (`tests/unit/cpmm/`, extending the existing home — OQ-2)

| File | Subject | Charter coverage |
|---|---|---|
| `_arbitraries.ts` | Shared support (not a spec subject): the exact-decimal-string generators encoding the **OQ-3 domain in one place** (including the OQ-5 cross-consistency sub-generator), the `bigint`↔18-dp-string helpers, and the **fixed seed `20260605` + `numRuns: 1000`** — uniform per property, the sequence property included (OQ-4/A8), so the §5.10 grep of this file is binary. | — (single source of truth for the audit's "generator bounds match plan") |
| `vectors.test.ts` | §12 worked examples **E1–E5 verbatim** (OQ-10 re-encode). | Charter line 1 |
| `buy.property.test.ts` | `computeBuy` — §4.2 properties 1–4; buy-side totality + 18-dp output shape (OQ-9a). | Charter line 2 |
| `sell.property.test.ts` | `computeSell` — §5.2 bounds 1–4; §5.3 round-trip (derived); sell-side totality + shape. | Charter line 3 + derived |
| `invariants.property.test.ts` | INV-C1–C5 (§11) cross-cutting buy+sell; `p_yes + p_no = 1`; the OQ-5 cross-consistency assertion. | Charter line 4 + line 5 |

> Helpers/generators live in `_arbitraries.ts` (underscore-prefixed support, matching `tests/_setup/`, `tests/db/_fixtures/`). Keeping the OQ-3 bounds in one module makes the §5.10 audit binary. It is in the diff-stat closed set.

### Generators — exact-decimal-string-native (OQ-3, approved)

All values are built as **scaled `bigint` of 1e-18 units → 18-dp string** (`decimalString(units)`), never via `Number`. The inverse `toUnits(s)` (parse 18-dp string → `bigint`) backs all exact bookkeeping.

- **Reserve unit band:** `[1e16, 1e27]` units = `[0.01, 1e9]` Đ (11 orders of magnitude).
- **Pair ratio guard:** `1e-4 ≤ y/n ≤ 1e4` — constructed (pick a base magnitude + a skew exponent in `[−4, 4]`, clamp into the band), **not** rejection-sampled. Covers E4's 3:1 and far beyond; excludes the pathological 1e20:1e-18 skew that breaks sub-ULP soundness.
- **Stake (buy):** `S ∈ [0.01, min(1e9, 1e3·b)]` — bounded **absolutely and relative to the opposite reserve `b`**. The relative cap `S ≤ 1e3·b` keeps `p1 < 1` sound (without it, a near-ceiling stake drives the post-price complement to ~1 ulp and `p1` can round to `1.0`).
- **Shares (sell):** `s ∈ [0.01, 1e3·a]` (sold-side relative cap), or — in the sequence harness — a fraction `f ∈ (0,1]` of *current* holdings (so sells never exceed holdings; §5.4 sufficiency is modeled, not violated).
- **Material-trade sub-generator:** `S ∈ [1e-3·b, 1e3·b]` (resp. `s`) — guarantees `impact ≥ ~2e-7` **worst-case across the skew range** (`~5e-4` near balanced pools), in all cases `≫ 1 ulp`; used **only** where a *strict* price-ordering / strict-impact-monotonicity separation is asserted. For the strict-impact-parity assertion (A3) both stakes lie within the cap with `S₂ ≥ 2·S₁` (so `S₁ ≤ 5e2·b`).
- **Cross-consistency sub-generator (OQ-5/A1):** reserves with a **floor of 1 Đ each (pool total ≥ 2 Đ)**, buy + sell variants — bounds the **1/total** price-divergence amplification (see the OQ-5 ruling) so the ≤1-ulp assertion is provable. Used **only** by the OQ-5 cross-consistency property.
- **Side:** `fc.constantFrom("yes", "no")` (lowercase per §13, verbatim).
- **Sequence:** `fc.array(op, { maxLength: 20 })`; each `op` = `{ side, kind: buy|sell, amount }`, sells gated on current holdings.

**Vacuity guard (how the bounds stay non-vacuous).** (1) Anchor vectors `vectors.test.ts` pin the *interesting* regimes concretely — E2 (dust, `k′>k`, impact 0.0475), E4 (no-dust, `k′=k`, skew 3:1, impact 0.0743), E3 (round-trip dust). (2) The material-trade sub-generator forces a measurable `impact` (`≥ ~2e-7` worst-case at the skew extremes, `~5e-4` near balanced — A2/A12) so the strict orderings and strict-impact-monotonicity are genuinely exercised, not satisfied all-equal. (3) The no-dust branch (`k′=k`) is **measure-zero under random generation** — it is covered by the E4 anchor only, and the plan says so rather than pretending the generator hits it.

**Out-of-domain (documented in the test file at execute — ENGINE.2 security triage, carry-forward #2).** The sub-ULP-reserve × near-ceiling-stake corner is excluded **by test policy, not by the module**: sub-ULP positive values **are `numericString`-valid and DO pass the module's input gate** — they are excluded here only because they are economically unreachable (the module's §4/§5 totality proofs and the precision-50 headroom are sized for realistic magnitudes, not the full `numericString` envelope). Separately, magnitudes `≥ 1e20` are impossible under the 20-integer-digit regex (`/^-?\d{1,20}(?:\.\d{1,18})?$/`). The test-file comment at execute carries this same wording.

### Rounding-aware assertion forms (binding; the heart of the suite)

`toFixed(18, …)` half-even is **monotonic non-decreasing**, so an exact `x < y` always maps to `x_r ≤ y_r` (weak form is *unconditionally* sound); strict needs an exact gap `≥ 1 ulp`. Reserves are derived by **exact add/sub of the floored** share/proceeds, so the conservation/audit identities are **exact at 18 dp** (verified algebraically, buy & sell, both sides).

| Property (spec) | Exact relation | Form on **rounded** outputs | Soundness / generator constraint |
|---|---|---|---|
| §4.2.1 `s > S` | `s−S = S·a/(b+S) > 0` | **strict** `s_r > S` | domain ⇒ gap `≥ ~1e-6 ≫ 1 ulp` (reserves ≥ 0.01, ratio ≤ 1e4, S ≥ 0.01) |
| §4.2.2 `p0<pEff<p1` | strict | **weak** `p0_r ≤ pEff_r ≤ p1_r` (always) **+ strict** `p0_r < p1_r` (material subgen) | weak unconditional (monotone rounding); strict via `impact ≥ ~2e-7` worst-case across skew (`~5e-4` balanced), `≫ 1 ulp` |
| §4.2.3 dir. `a′<a, b′>b` | `a′<a ⇔ s>S`; `b′>b` always | **strict** `a′_r < a`; `b′_r > b` | as §4.2.1; `b′=b+S, S≥0.01` trivial |
| §4.2.3 `p1<1` | strict | **strict** `p1_r < 1` | `S ≤ 1e3·b` + ratio ⇒ complement `≥ ~1e-10` |
| §4.2.3 monotone impact | `impact↑` in `S` | **weak** `impact_r(S₂) ≥ impact_r(S₁)`, `S₁<S₂`, same start (always) **+ strict** `impact_r(S₂) > impact_r(S₁)`, `S₂ ≥ 2·S₁` (material subgen, both within cap) | weak unconditional; strict worst exact gap `≈ 3e-10` (saturation end, `r·(1/501²−1/1001²)`, `r ≥ 1e-4`) / `≈ 2e-7` (low end) — both `≫ 1 ulp` |
| §4.2.4 / §5.2.4 / INV-C2 `k′≥k` | `k′ ≥ k` | **non-strict** `k′.gte(k)` (bigint, on the exact 36-dp product) | exact & unconditional within the magnitude bound; `k′=k` via E4 |
| §5.2.1 real distinct roots | `disc>0` | **observable consequence:** `proceeds` finite 18-dp + §5.2.2 bounds hold (a NaN/complex root would fail shape/bounds) | folded into shape + §5.2.2 (no `disc` recompute) |
| §5.2.2 `0<M<min(s,b)`, `a′>a` | strict | **strict** `0 < M_r`, `M_r < s`, `M_r < b`, `a′_r > a` | `M_exact ≥ ~1e-6` (domain); `a′−a = s−M_r > 0` |
| §5.2.3 `p1<pEff<p0` | strict | **weak** `p1_r ≤ pEff_r ≤ p0_r` (always) **+ strict** `p1_r < p0_r` (material subgen) | as §4.2.2 — strict via `impact ≥ ~2e-7` worst-case across skew (`~5e-4` balanced), `≫ 1 ulp` |
| §5.3 round-trip (derived) | `M ≤ S` | **non-strict** `M_r ≤ S` (bigint) | dust to pool (E3 = S − 1 ulp) |
| INV-C1 conservation (OQ-6) | buy `b′−b=S`, `a′=a+S−s_r`; sell `b−b′=M_r`, `a′−a=s−M_r` | **EXACT** bigint equality | exact by §10.3 derivation; module outputs only |
| INV-C3 domain | `reserves>0`, `p∈(0,1)` | **strict** `reserve_r > 0`, `0 < p_r < 1` | bounded ratio + magnitude |
| INV-C4 residual identity (crux) | `holdings[X] = D − reserve[X]` (exact at 18 dp); `unwind = w` | **EXACT** bigint equality, every step of a random sequence; end `computeResolvedUnwind(outcome).residual == winning reserve` and `D − w == holdings[winner]`. **The sequence asserts the exact identities (+ no-throw/shape) ONLY** — intermediate states drift outside the single-op ratio guard, so strict/gap-conditioned forms are never asserted inside the sequence (A4). | exact by derivation; `D = seed + Σstakes − Σproceeds`, holdings from module outputs; sells ≤ holdings |
| INV-C5 determinism | bit-identical | **deep-equal** output strings on repeated calls; `computeResolvedUnwind` idempotent | unconditional |
| `p_yes + p_no = 1` (line 5) | exact | **≤1 ulp**: `|p_yes_r + p_no_r − 1| ≤ 1e-18` | independent half-even rounding |
| OQ-5 cross-consistency (line 5) | ≤1 ulp | `|toUnits(getPrices(result.reserves)[side]) − toUnits(p1)| ≤ 1`, **scoped to the reserve-floor-1-Đ sub-generator (pool total ≥ 2 Đ), buy + sell** | exact divergence `< 1e-18/total` (1/total amplification, A1); total ≥ 2 ⇒ `< 5e-19` ⇒ ≤1-ulp provable |
| OQ-9a totality + shape | total | **no throw** on the valid domain; every output matches `/^\d+\.\d{18}$/` | domain (the §4/§5 proofs) |

> **INV-C4 is the audit crux** and the most valuable property: a random buy/sell sequence from a seed, tracking `D` and per-side holdings purely from module outputs in exact scaled-`bigint`, asserting `holdings[X] = D − reserve[X]` throughout and the §8.1 unwind residual at the end. It consumes outputs only — **no parallel curve recompute** — so it asserts a spec *identity*, not a re-implementation.

---

## Test plan (charter → named test)

| Charter line | Test (file › describe) | Assertion | Invariant |
|---|---|---|---|
| 1 — E1 seed/price | `vectors › E1` | `seedPool("100")` & `getPrices` → `…0.5…` exact strings | INV-C3 (spot) |
| 1 — E2 buy | `vectors › E2` | shares/reserves/p0/pEff/p1/impact/`k′` **verbatim** | INV-C2/C4 (spot) |
| 1 — E3 sell-back | `vectors › E3` | `M=9.999…999`, reserves, `p1=0.5` **verbatim** | §5.3 |
| 1 — E4 no-dust buy | `vectors › E4` | `s=35.000…`, reserves, prices, `k′=k` **verbatim** | INV-C2 (`=`) |
| 1 — E5 residual | `vectors › E5` | `computeResolvedUnwind` both branches; sums = D=110 | INV-C4 |
| 2.1 | `buy › s > S` | strict `s_r > S` | §4.2.1 |
| 2.2 | `buy › price ordering` | weak `p0≤pEff≤p1` + strict `p0<p1` (material) | §4.2.2 |
| 2.3 | `buy › monotone impact` | dir. `a′<a, b′>b, p1<1`; **weak** `impact↑` + **strict** `impact(S₂)>impact(S₁)`, `S₂≥2·S₁` (material) | §4.2.3 |
| 2.4 | `invariants › k non-decreasing` | `k′.gte(k)` on **buy** — **discharges §4.2.4** | §4.2.4 |
| 3.1 | `sell › proceeds bounds` | `proceeds` finite 18-dp (real/distinct roots, observable consequence) | §5.2.1 |
| 3.2 | `sell › proceeds bounds` | `0 < M_r < min(s,b)`, `a′ > a` | §5.2.2 |
| 3.3 | `sell › price ordering` | weak `p1≤pEff≤p0` + strict `p1<p0` (material) | §5.2.3 |
| 3.4 | `invariants › k non-decreasing` | `k′.gte(k)` on **sell** — **discharges §5.2.4** | §5.2.4 |
| 3 (derived) | `sell › round-trip` | buy then full sell-back ⇒ `M_r ≤ S` | §5.3 |
| 4 — INV-C1 | `invariants › conservation` | exact reserve-delta identities (buy+sell) | INV-C1 |
| 4 — INV-C2 | `invariants › k non-decreasing` | `k′.gte(k)` (buy+sell); home of the §4.2.4/§5.2.4 discharges (rows 2.4/3.4) | INV-C2 |
| 4 — INV-C3 | `invariants › domain` | `reserves>0`, `0<p<1` (buy+sell outputs) | INV-C3 |
| 4 — INV-C4 | `invariants › solvency sequence` | `holdings[X]=D−reserve[X]` ∀ steps; unwind=w | INV-C4 |
| 4 — INV-C5 | `invariants › determinism` | repeat-call deep-equal; unwind idempotent | INV-C5 |
| 5 — sum=1 | `invariants › prices sum to 1` | `|p_yes+p_no−1| ≤ 1e-18` | §3.3 |
| 5 — x-consistency | `invariants › getPrices vs p1` | `≤1 ulp` (buy+sell), total ≥ 2 Đ subgen (OQ-5) | self-critique #1 |
| 9a | folded into every buy/sell property | no-throw + `/^\d+\.\d{18}$/` shape | INV-2 exactness |

> Audit line list maps one-to-one: **1, 2.1–2.4, 3.1–3.4, INV-C1–C5, line-5 ×2, 9a** (A10).

---

## Out of scope

- **Module / smoke edits** — `src/server/cpmm/*` and `tests/unit/cpmm/{calculate,validate}.test.ts` are **FROZEN**. Zero `src/` lines; zero smoke edits.
- **Invalid-input fuzzing (OQ-9b)** — the frozen `validate.test.ts` (24 tests) owns the invalid domain; the `numericString` `-0`/leading-zeros quirk is an **ENGINE.5** decision (carry-forward #3), not re-noised here.
- **Balances / events / idempotency** — ENGINE.5 (Dharma `balance_after ≥ 0`) and ENGINE.6/7 (`event_id`), per the tracker-drift reconciliation. A pure module has neither.
- **Transactions / handlers / schema** — W-1/W-3 (ENGINE.7/9), `pools` column mapping (SPEC.2 Appendix B.3). No DB writes ⇒ no integration tests, no `tests/invariants/I-*` (those land with the tx strata).
- **Spec edits** — no `cpmm.md`/SPEC.1/SPEC.2 changes. The §10.3 price-recipe clarification stays a separate future docs PR (ENGINE.2 carry-forward #5).
- **New event types / error codes** — none.
- **Number pinning** — generator bounds are **test policy**, explicitly **not** SPEC.1 §16.1 number pinning.
- **E2E / Playwright / coverage thresholds** — no runner installed; HARDEN.* owns coverage.

---

## Open questions (all founder-ratified 2026-06-05; bodies above reflect the rulings)

- **OQ-1 — fast-check version + pin. → RESOLVED: literal `"fast-check": "4.8.0"` (devDependencies).** Latest 4.8.0; `engines node>=12.17.0` (Node 24 ok); no peer deps. Literal per AWS-SDK/biome/lefthook/tsx discipline + the vendor-pin memory; **OQ-4 interaction** — replaying a logged seed needs the exact version (shrinking/generation drift across releases). Install `pnpm add -D fast-check@4.8.0 --save-exact` (no `.npmrc` save-exact ⇒ plain `add` writes a caret — ENGINE.2 lesson).
- **OQ-2 — test home + naming. → RESOLVED: extend `tests/unit/cpmm/`, `*.property.test.ts` + `vectors.test.ts`.** Property tests of a pure module are unit tests (AGENTS.md §9). Run via `pnpm vitest run tests/unit/cpmm/`; `just verify` runs **no** tests (CI's whole-suite `vitest run` is the gate).
- **OQ-3 — generator domain (central). → RESOLVED: approved as proposed.** Reserves `[0.01, 1e9]`, ratio `≤1e4`, stake/shares relative-capped (`S≤1e3·b`), sequences `≤20`; excludes the sub-ULP × near-ceiling corner; vacuity-guarded by anchors + the material-trade subgen.
- **OQ-4 — numRuns + seed. → RESOLVED: fixed seed `20260605` + `numRuns: 1000`, uniform per property (the INV-C4 sequence property included).** Stated literally in `_arbitraries.ts` so the §5.10 grep is binary. Deterministic/reproducible CI (matches §10.4); pure decimal math ⇒ est. **< 5 s** added (ENGINE.2: 46 tests/234 ms; whole CI ~1m28s). Frozen module ⇒ exploration-over-time has little value.
- **OQ-5 — getPrices vs p1 cross-consistency. → RESOLVED: IN, scoped to a reserve-floor-1-Đ sub-generator (pool total ≥ 2 Đ), buy + sell; tolerance ≤ 1 unit.** Rationale: the floored-derived reserve perturbs `a′` by `Δa′ = s_exact − s_r < 1e-18`; price sensitivity `|∂p1/∂a′| = b′/(a′+b′)² ≤ 1/(a′+b′)`, so the exact divergence scales as **1/total** and reaches tens of ulp at sub-Đ totals. Worked counter-instance: `(a,b) = (0.01, 0.01)`, `S = 0.013` → `s_exact = 0.0186521739130434782608…`, `Δa′ ≈ 2.6e-19`, divergence `≈ 8 ulp` → a flat ≤1-ulp assertion fails. With the reserve floor 1 Đ (total ≥ 2 Đ), `Δp_exact < 5e-19` ⇒ ≤1-ulp is provable. **Forward-note (carry-forward #5):** the queued `cpmm.md` §10.3 clarification PR must state the consequence as **"≤1 ulp for pool totals ≥ 1 Đ, scaling as 1/total below"** — ENGINE.2 self-critique #1's flat "≤1 ulp" was optimistic. This still locks the plan as the pin (E1–E5 don't distinguish the readings).
- **OQ-6 — INV-C1 form. → RESOLVED: exact reserve-delta identities, exact bigint equality.** No parallel curve recompute; exact by the §10.3 derivation rule.
- **OQ-7 — ritual shape. → RESOLVED: main-session author + `@code-reviewer` → `@security-auditor`; bespoke §5.10 audit.** No `@test-writer`/RED (frozen-green module; rounding-aware forms are spec-analysis-heavy and pinned here). `@security-auditor` retained — the magnitude-bound edge was its catch.
- **OQ-8 — doc-drift riders (ride execute PR, CLAUDE.md §7/OQ-E). → RESOLVED: approve the rider set. Founder-confirmed in web chat (Batch C, option 1 — "approve the rider set").** Exact edits enumerated under **Doc riders** below.
- **OQ-9 — error-contract & totality scope. → RESOLVED: (a) IN, (b) OUT.** (a) fold valid-domain totality + 18-dp shape into the properties (near-zero cost; locks OQ-C serialization on random inputs). (b) invalid-input fuzz stays the smoke suite's job.
- **OQ-10 — E1–E5 placement. → RESOLVED: re-encode verbatim in `vectors.test.ts`.** Self-contained ENGINE.3 deliverable satisfying §12's letter; trivial duplication of the frozen smoke vectors (which remain the ENGINE.2 artifact). **Changes execute exit-criterion (c):** "E1–E5 **re-encoded** in `vectors.test.ts` and green" (not "satisfied by the smoke suite").

### Doc riders (OQ-8 — ride the execute PR)

1. **AGENTS.md §9** — the `unit/` tree line currently reads `└── unit/  body-fingerprint, rate-limit-prefix, upstash-keys` (stale since ENGINE.2 added `tests/unit/cpmm/`). Update to include `cpmm/` (smoke + the new `*.property.test.ts` + `vectors.test.ts`).
2. **AGENTS.md §9 naming** — add the property-test convention: `<area>.property.test.ts` (fast-check) alongside the existing `<subject>.test.ts` / `.integration.test.ts` / `.spec.ts` rows.
3. **AGENTS.md §1 Tooling** — name `fast-check 4.8.0` beside `Vitest 3` (now a real test dep).
4. **CLAUDE.md** — **untouched** (`src/server/cpmm/` already in §1 from ENGINE.2; no invariant change). The §1 "Not installed yet: Playwright/commitlint" line is **untouched** (fast-check not named there).

## ADRs needed

**None.** Property-testing with fast-check is a test-tooling choice, not an architectural decision; it mints no event type, error code, schema, or invariant. The doc riders (OQ-8) record the dependency; no ADR.

---

## Execution checklist (runnable by a fresh session, zero plan-chat context)

> **Hard STOP conditions (encode as guards):** the frozen files (`src/server/cpmm/*`, `tests/unit/cpmm/{calculate,validate}.test.ts`) are **untouchable**. A failing property at execute is **STOP-and-surface** — a genuine module bug ⇒ its fix is a **new plan**, never a same-PR patch; a wrong/over-broad property ⇒ **web adjudicates against `cpmm.md`**. **Never** weaken an assertion or narrow a generator below this plan's bounds to reach green. Generators stay exact-decimal-string-native (no JS float). No parallel curve reimplementation.

1. **Sync + branch** (S-1: sync/branch never live in plan mode): `git checkout main && git fetch origin && git reset --hard origin/main` (expect `130ddba` or later) → `git checkout -b feat/engine-3-cpmm-properties`.
2. **Install:** `pnpm add -D fast-check@4.8.0 --save-exact` (literal pin, OQ-1). Nothing else.
3. **Author the suite (main session, OQ-7)** — these must **pass immediately** against the frozen module (verification, not RED-first; a red property is a STOP per the guard above):
   a. `_arbitraries.ts` (generators + bigint helpers + fixed seed `20260605` + `numRuns 1000` — A8) → `vectors.test.ts` (E1–E5 verbatim).
   - **CP-1 (checkpoint):** STOP — paste `_arbitraries.ts` + `vectors.test.ts` **in full** to the web chat for line review **before any property file is written**. Fixes are same-branch.
   b. `buy.property.test.ts` → `sell.property.test.ts` → `invariants.property.test.ts`.
   - **CP-2 (checkpoint):** STOP — paste all three property files **in full** to the web chat for line review **before step 4 (green runs) and the cascade**. Fixes are same-branch.
4. **Green:** `pnpm vitest run tests/unit/cpmm/` (smoke 46 + new) → `pnpm vitest run` (whole suite) → `just verify` (typecheck → biome → build; set `ZUGZWANG_ENV=preview` locally per ENGINE.2 note).
5. **Doc riders (OQ-8):** AGENTS.md §9 tree + naming row; AGENTS.md §1 fast-check.
6. **Review cascade:** `@code-reviewer` then `@security-auditor` — pass `@docs/plans/ENGINE.3.md` to both.
7. **Pre-PR §5.10 audit (bespoke, item-by-item PASS/FAIL/SURPRISE):**
   - **Charter coverage map complete** — every charter line (1, 2.1–2.4, 3.1–3.4, INV-C1–C5, line-5 ×2, 9a) maps to a named, green test.
   - **Diff-stat = closed set:** `tests/unit/cpmm/_arbitraries.ts` + `vectors.test.ts` + `{buy,sell,invariants}.property.test.ts` + `package.json` + `pnpm-lock.yaml` + AGENTS.md (OQ-8 riders). **Zero `src/` lines; zero edits to `calculate.test.ts`/`validate.test.ts`/`src/server/cpmm/*`** (`git diff --stat` proves it).
   - **Generator bounds + ratio constraints** match this plan (grep `_arbitraries.ts` against OQ-3, incl. fixed seed `20260605` + `numRuns 1000`).
   - **Assertion forms** match the rounding-aware table (strict/weak/gap-conditioned as pinned).
   - **No parallel curve reimplementation** — grep the property files: no independent computation of `s`/`M`/`a′`/`b′` compared for equality; only relations on module outputs + spec-stated identities + the §12 hardcoded vectors.
   - **fast-check pinned literal `4.8.0`** in `package.json`; lockfile consistent.
   - **Out-of-domain exclusion** (sub-ULP × near-ceiling) documented in the test file.
8. **PR** → founder squash-merge → post-merge sync + `git branch -D feat/engine-3-cpmm-properties`.

Commit identity `Zugzwang/world` (no `Co-authored-by` trailer); multi-line messages via `/tmp/engine-3-msg.txt` (`rm -f` first; AGENTS.md §10). Tail/grep Write-authored files for stray delimiter tokens before commit (ENGINE.2 context-to-preserve). Plan file commits on its own branch before Phase 2; the session log ships separately (CLAUDE.md §5.9).

---

## Self-critique (plan self-review, 2026-06-05)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Strict price-ordering relies on the **material-trade sub-generator**; the main generator only guarantees the **weak** (≤) form, which is trivially satisfiable (all-equal) ⇒ vacuity risk. | The material-trade subgen forces `impact ≥ ~2e-7` worst-case (`~5e-4` balanced) so strict `p0<p1`/`p1<p0` is genuinely exercised; the E2/E4 anchors pin concrete non-zero impact. The split (weak-always + strict-when-material) is documented in the rounding-aware table. |
| 2 | medium | The INV-C4 sequence harness tracks **aggregate** holdings (one bookkeeping pair), not multiple users. | The identity `holdings_total[X] = D − reserve[X]` is aggregation-invariant (pair accounting, §3.2), so the math is faithful; per-user attribution is the `positions` table (ENGINE.7/9), explicitly out of scope. Noted. |
| 3 | medium | The OQ-5 cross-consistency ≤1-ulp claim is **not** uniform: the exact divergence amplifies as **1/total** and exceeds 1 ulp at sub-Đ totals (worked counter-instance in the OQ-5 ruling). | Scoped to a reserve-floor-1-Đ (total ≥ 2 Đ) sub-generator where `Δp_exact < 5e-19`; the amplification is recorded and a forward-note pins the cpmm.md §10.3 clarification wording (carry-forward #5). |
| 4 | low | The **no-dust** branch (`k′ = k`) is measure-zero under random generation — the property generator only ever exercises `k′ ≥ k` (dust). | Covered by the **E4 anchor vector** (`k′ = k` exact). The plan states this rather than implying the generator hits it. |
| 5 | low | **Fixed seed `20260605`** ⇒ the 1000 cases are identical every run; a latent bug outside them never surfaces. | Accepted for a **frozen** module (determinism > exploration); the seed is recorded for reproducible re-runs, and `numRuns 1000` over the OQ-3 domain is a large deterministic sample. |
| 6 | low | Property **soundness depends on the OQ-3 magnitude bound** being correct; a mis-stated bound could make a strict assertion flake. | Bounds are derived with `≫1-ulp` margin (`≥1e-6`/`1e-10`/`2e-7` vs `1e-18`); `@security-auditor` (the original magnitude-edge catcher) reviews `_arbitraries.ts` against this plan. |
| 7 | low | `_arbitraries.ts` is shared by 3 files — a generator bug silently weakens all three. | It is small, single-purpose, reviewed, and the **generator-independent** anchor vectors (`vectors.test.ts`) cross-check the module regardless. |

Checked: charter completeness (every §4.2/§5.2/§11/§12 line + line-5 carry-forwards mapped), the no-parallel-reimplementation discipline, rounding-aware soundness per property (incl. the A1 1/total amplification, A2/A12 impact floors, A3 strict-impact parity), exact-string-native generators, scope discipline (zero `src/`/smoke edits), doc-drift completeness, OQ rulings + amendments A1–A12 reflected in the bodies.

---

## References

- `docs/specs/cpmm.md` v1.0.0 — the charter: **§3** (domain/price), **§4.2** (buy properties), **§5.2** (sell bounds), **§5.3** (round-trip), **§8.1** (residual identity), **§10.3** (boundary rounding), **§10.4** (determinism), **§11** (INV-C1–C5), **§12** (E1–E5), **§13** (API).
- `CLAUDE.md` §2 (INV-2 exactness, money-as-string/no-floats), §5.6 (tests-first scope — OQ-7), §5.7 (verify gate), §5.10 (pre-PR audit), §5.11 (subagents), §7 (same-PR doc doctrine — OQ-8).
- `AGENTS.md` §1 (Tooling — OQ-8), §9 (test layout/naming — OQ-2/OQ-8).
- `docs/plans/ENGINE.2.md` — template precedent + the deferral of the property suite to ENGINE.3.
- `docs/logs/ENGINE.2.md` — carry-forwards: **#1** magnitude-bounded `k`/optional cross-consistency (OQ-5), **#2** sub-ULP/near-ceiling out-of-domain (OQ-3/A7), **#3** `numericString` `-0`/leading-zeros → ENGINE.5 (OQ-9b), **#5** queued cpmm.md §10.3 price-recipe clarification (OQ-5/A1 forward-note); CI = `pull_request`-only, ~1m28s.
- `src/server/cpmm/{calculate,decimal,errors,validate}.ts` — **frozen** module under test.
- `tests/unit/cpmm/{calculate,validate}.test.ts` — **frozen** 46-test smoke suite.
- `src/server/events/schemas.ts:23` — `numericString` (`/^-?\d{1,20}(?:\.\d{1,18})?$/`), the boundary shape the generators target.
- fast-check **4.8.0** (npm latest; `engines node>=12.17.0`; no peer deps).
