# ENGINE.2 — CPMM TypeScript module (`src/server/cpmm/`)

> **Status:** reviewed
> **Date:** 2026-06-04
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** Yes (de facto). CPMM math is thesis-touching (conservation, payout/bet math — CLAUDE.md §5.6) so the full ritual runs (`@test-writer` tests-first → `@code-reviewer` → `@security-auditor`). Note: `src/server/cpmm/` is **not** in CLAUDE.md §1's enumerated critical-path list — see OQ-E (proposed two-line §1 amend riding the execute PR).
> **Plan PR / commit:** this file commits before Phase 2 (CLAUDE.md §5.1); execute happens after founder ratification.

---

## Tracker context

Tracker row (operator tracker, ENGINE lane — v12 at plan time; verbatim):

```
{ id: "ENGINE.2", title: "CPMM TypeScript module",
  desc: "src/server/cpmm/ (greenfield). Pure TS, no framework deps. Implements
  the ENGINE.1 cpmm.md spec — LIFT Manifold's calculate-cpmm.ts (read-only at
  vendor/manifold/) and rewrite for our invariants (Dharma conservation,
  NUMERIC(38,18) exact decimal, fee-less single-MM) + clarity. ATTRIBUTE the
  Manifold lineage (MIT→AGPL; preserve notice). REUSE ENGINE.0's exported
  numericString at the boundary — do not redefine. Pure module only: no DB
  writes, no transaction logic (ENGINE.7), no property tests (ENGINE.3).
  SPEC-GATED: no module code before cpmm.md is merged.",
  pri: P0, deps: [ENGINE.1, ENGINE.0, FOUND.5], est: 3d }
```

**Known stale string in the row:** the source is **not** `vendor/manifold/` (no such dir exists). The pinned reference is `zugzwang-foundation/manifold-reference`, tag `ref-2026-04-28-found5` = commit `d5b55cf9472ec05f545e6c1a817d88005b8dbf2b`, file `common/src/calculate-cpmm.ts`, mapped in `docs/references/manifold.md`. Not edited (tracker is operator-maintained external HTML).

**Dependency status at plan time:** all three done.
- **ENGINE.1** — `cpmm.md` v1.0.0 merged (PR #71, in `origin/main` @ `48ca6d0`); the spec gate is satisfied.
- **ENGINE.0** — `numericString` exported from `src/server/events/schemas.ts:23` (the boundary validator this module reuses).
- **FOUND.5** — reference fork pinned; `docs/references/manifold.md` + `THIRD_PARTY_NOTICES.md` landed.

## Approach (one paragraph)

Build a **pure, deterministic, no-I/O** TypeScript module at `src/server/cpmm/` that implements the closed-form CPMM math fixed in `cpmm.md` §3–§13. Four files, no barrel (house convention): `decimal.ts` (the `CpmmDecimal` cloned constructor + quantize helpers), `errors.ts` (`CpmmInputError`), `validate.ts` (boundary gate reusing ENGINE.0's `numericString` + strict positivity), `calculate.ts` (the §13 surface — the file derived from upstream `calculate-cpmm.ts`). The math is **not ported line-by-line**: `cpmm.md` §2 already *replaced* upstream's float+EPSILON and binary-search-sale with exact `NUMERIC(38,18)` arithmetic and a closed-form quadratic, so the implementation follows `cpmm.md`'s closed forms and treats upstream as lineage/attribution only. Smoke tests (E1–E3 spot vectors + the error contract) land at `tests/unit/cpmm/`; the universally-quantified property suite (E1–E5 verbatim, §4.2/§5.2 properties, INV-C1–C5) is **ENGINE.3**, explicitly deferred.

---

## Module design

### File layout (direct files, no `index.ts` — house convention)

Every file begins with `import "server-only";` (dep present; inert under test via the `vitest.config.ts` alias to `tests/_setup/server-only-shim.ts`) and carries the attribution header (below).

| File | Contents | §ref |
|---|---|---|
| `src/server/cpmm/decimal.ts` | `CpmmDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN })`; quantize/serialize helpers `floor18` (`toFixed(18, ROUND_DOWN)`), `halfEven18` (`toFixed(18, ROUND_HALF_EVEN)`), `toFixed18` (`toFixed(18)`, pads exact values). Exports `CpmmDecimal` for ENGINE.5 reuse. | §10.2 / §10.3 / §13 |
| `src/server/cpmm/errors.ts` | `class CpmmInputError extends Error` (`name = "CpmmInputError"`). **No error-code minting** — programmer error, outside the SPEC.1 §15 envelope / 38-code catalogue. Module-local, not `src/lib/errors.ts`. | §10.5 / §13 |
| `src/server/cpmm/validate.ts` | Input gate: `numericString` **imported** from `@/server/events/schemas` (never redefined, never `z.number()`); on `safeParse` failure → throw `CpmmInputError`; then strict positivity (`> 0`) per §10.5 → throw `CpmmInputError`. Returns `CpmmDecimal` instances to the callers. | §10.5 |
| `src/server/cpmm/calculate.ts` | The full §13 surface: `seedPool`, `getPrices`, `computeBuy`, `computeSell`, `computeResolvedUnwind`; types `Side`, `Reserves`. The file derived from upstream `common/src/calculate-cpmm.ts`. | §3–§9, §13 |

### Public API — §13 signatures VERBATIM (zero ergonomic renames)

```ts
type Side = "yes" | "no";
type Reserves = { yes: string; no: string };

seedPool(seed: string): Reserves
getPrices(reserves: Reserves): { yes: string; no: string }
computeBuy(args:  { reserves: Reserves; side: Side; stake: string }):
  { shares: string;   reserves: Reserves; p0: string; pEff: string; p1: string; impact: string }
computeSell(args: { reserves: Reserves; side: Side; shares: string }):
  { proceeds: string; reserves: Reserves; p0: string; pEff: string; p1: string; impact: string }
computeResolvedUnwind(args: { reserves: Reserves; outcome: Side }): { residual: string }
CpmmDecimal   // the §10.2 cloned constructor, exported for ENGINE.5
```

- Exports: `Side`, `Reserves`, `CpmmDecimal`, `CpmmInputError`, and the five functions.
- **No void function** (§8.2: void residual is a ledger identity, not curve math).
- `computeResolvedUnwind` is a selector: `residual = toFixed18(reserves[outcome])` — the winning-side reserve (§8.1); no curve math.
- **⚠ Casing boundary (note for ENGINE.7/8 glue, not a change here):** the module's `Side` is **lowercase** `"yes" | "no"` per §13, distinct from the system-wide `side` pgEnum / event payloads which are **uppercase** `"YES" | "NO"` (`src/db/schema/_enums.ts`, ENGINE.0). Case translation is the *caller's* (handler glue) responsibility — §13: "DB column mapping is ENGINE.2 glue outside this module." The module stays verbatim-lowercase.

### Numeric policy (binding; cite, do not re-derive — `cpmm.md` §10)

- **Constructor:** `precision: 50`, internal rounding `ROUND_HALF_EVEN` (§10.2). `sqrt` (§5) = decimal.js `.sqrt()` at precision 50.
- **Boundary rounding (§10.3), directional:**
  - **User-credited** (`shares` s §4, `proceeds` M §5) → **floor** (`ROUND_DOWN`) to 18 dp.
  - **Reserves** → derived **after** the user-side quantity is floored, by **exact** add/sub of 18-dp values: buy `a′ = a + S − s_r`, `b′ = b + S`; sell `a′ = a + s − M_r`, `b′ = b − M_r`. Use the **floored** `s_r`/`M_r` (not the exact value) — this is what makes `k′ ≥ k` and the residual identity exact. Output via `toFixed18` (pad, no further rounding).
  - **Prices** (`p0`, `pEff`, `p1`, `impact`) → 18 dp `ROUND_HALF_EVEN`. Computed from the **precision-50 exact** intermediate quantities (per §10.4 "pure function of (inputs, precision, rounding)"), then quantized; pEff uses the **exact** computed quantity — S/s_exact on a buy, M_exact/s on a sell (§9.2) — never the floored output. Prices are informational and never feed back into reserve arithmetic. (Pin: this exact-then-quantize recipe — not the floored output reserves — is the price recipe; see self-critique #1 for the ≤1-ulp getPrices consequence.)
- **k is derived, never persisted/stored** (§3.1).
- Side→(a,b) mapping inside buy/sell: bought/sold side reserve = `a`, opposite = `b`; output reserves map `a′`→bought/sold side, `b′`→opposite. (Verified against E2 buy and E3 sell.)

### Validation semantics (§10.5)

- `numericString` is **signed** (allows leading `-`, allows `0`). The module layers **strict positivity** on top: `reserves.yes > 0`, `reserves.no > 0`, `stake > 0`, `shares > 0`, `seed > 0`. Violations are **programmer errors** → `CpmmInputError` (not product validation; floors/balances/position-sufficiency/market-state are upstream, SPEC.1 §15).
- **No output validation** — §4/§5 bounds proofs guarantee totality; the module never returns NaN/±Infinity over the valid domain.
- **Purity:** no clock, no env, no randomness, no DB, no `fetch`, no I/O anywhere.

### Code-quality pin

Write clean under `noUncheckedIndexedAccess` semantics (flag currently **off** in `tsconfig.json`; `HARDEN-TSCONFIG-1` flips it later — this module must be a no-op then). The module is naturally clean: keyed object access (`reserves[side]` over the closed `Reserves` union) is safe; avoid bare array indexing.

### Attribution header (every `src/server/cpmm/*.ts` — §2 review-gate obligation)

```ts
/**
 * Derived from Manifold's CPMM implementation (MIT).
 * Upstream: manifoldmarkets/manifold — common/src/calculate-cpmm.ts
 * Read at fork: zugzwang-foundation/manifold-reference,
 *   tag ref-2026-04-28-found5 = commit d5b55cf9472ec05f545e6c1a817d88005b8dbf2b
 * Upstream license: MIT — Copyright (c) 2022 Manifold Markets, Inc.
 * Full notice: THIRD_PARTY_NOTICES.md (repo root).
 * This file: AGPL-3.0-or-later, © The Zugzwang Authors. See docs/specs/cpmm.md §2.
 */
```

Uniform header on all four files makes the pre-PR grep binary (see OQ-D for the only-`calculate.ts` alternative).

---

## 1. Thesis invariants touched

Pure module, no DB writes — **none of the four thesis invariants is directly enforced here**; each is enforced by the W-1/W-3 transaction strata (ENGINE.7/9) that *call* this module.

| Invariant | Touched? | Why / how the plan relates | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | no | Atomicity is the SERIALIZABLE bet tx (ADR-0013, ENGINE.7); this module computes shares/price for that tx, holds no transaction. | n/a here (ENGINE.7 `tests/invariants/I-ATOMICITY-*`) |
| INV-2 Dharma non-transferable / no overdraft | partial (exactness) | All quantities are exact `NUMERIC(38,18)` decimal strings (decimal.js, never JS floats) — upholds the CLAUDE.md §2 "no floats for balances/prices/shares" rule at the math layer. Conservation (no mint/burn of Đ) is INV-C1. Overdraft/balance checks are upstream. | smoke 18-dp shape; INV-C1 → ENGINE.3 |
| INV-3 Side frozen at comment-time | no | `side` is an *input*; the module never persists or freezes it. Freeze is `comments.side_at_post_time` + trigger (DEBATE.2). | n/a here |
| INV-4 Resolutions append-only | partial (reproducibility) | `computeResolvedUnwind` is pure/deterministic so every §8 quantity is reproducible from frozen reserves (INV-C5 upholds INV-4). Append-only is the Bucket-A triggers + W-3 (ENGINE.9). | smoke E5 spot; INV-C5 → ENGINE.3 |

### CPMM-level invariants (INV-C1–C5, `cpmm.md` §11)

Canonical test home is **ENGINE.3** (universally-quantified property tests). The ENGINE.2 smoke vectors touch some incidentally (noted). Failure mode = what ships if the assertion is missing/wrong (critical-path rule).

| ID | Guarantee | Test home | Failure mode if missing/wrong |
|---|---|---|---|
| INV-C1 Conservation | Every op nets Đ to zero across {trader, pool}; mints/burns share *pairs* only. | ENGINE.3 property; smoke E2/E3 (reserve sums) | A sign slip or deriving reserves off the unfloored value mints/destroys Đ → pool insolvent or stake vanishes into the void. |
| INV-C2 k non-decreasing | `k′ ≥ k` on every buy/sell under §10.3 rounding (dust to pool). | ENGINE.3 property; smoke E2 (`k′ = 10000.000000000000000010`) | Reserves derived from the **un**floored s/M → `k′ < k` → dust leaks to the trader → mechanical round-trip arbitrage drains the pool. |
| INV-C3 Domain | `y,n > 0`; probabilities strictly in (0,1); `s > S` per buy; `0 < M < min(s,b)` per sell. | ENGINE.3 property + `validate.ts` positivity; smoke error cases | A zero/negative reserve slips through → div-by-zero / prob 0 or 1 / NaN propagates into the live W-1 tx. |
| INV-C4 Solvency / residual identity | User-held side-X shares = `D − x_reserve`; resolved unwind = winning reserve `w`; void residual = seed − Σ uncollectable. | ENGINE.3 property; smoke E5 (`residual = winning reserve`, sum = D) | `computeResolvedUnwind` returns ≠ winning reserve → admin unwind over/under-pays → insolvency or admin skim. |
| INV-C5 Frozen determinism | Terminal state immutable; module pure/deterministic; every §8 quantity reproducible by an auditor. | ENGINE.3 + pre-PR "no clock/env/random/DB" grep; smoke determinism | Hidden nondeterminism (clock/env/`Math.random`/platform float) → public dataset not reproducible → INV-4 audit broken. |

---

## 2. Data model changes

**None — pure module.** No table, column, index, FK, enum, constraint, partition, or migration. No `src/db/` touch. (DB column mapping for reserves is ENGINE.7 glue per §13 / SPEC.2 Appendix B.3 — not here.)

## 3. API surface

**None as an HTTP / Server-Action / route-handler surface** — no network endpoint, no auth, no rate-limit class, no zod request schema at a route. The deliverable is a **pure module API** (the §13 contract documented under *Module design* above): five functions + `Side`/`Reserves`/`CpmmDecimal`/`CpmmInputError` exports, consumed in-process by the ENGINE.7 bet tx and ENGINE.9 resolution flow.

## 4. UI / user flow

**None — backend-only (pure math module).** The §6 slippage bundle feeds DESIGN.4's modal later; no UI in this task. (See self-critique #3 on `server-only` and client-side preview reuse.)

## 5. Failure modes

Nothing runs at request time in this task (no emit sites yet), so "failure modes" are caller-contract and math-correctness surfaces:

- **Malformed / non-positive input** → `validate.ts` throws `CpmmInputError` (programmer error). Detected at the call site's dev/test time; recovery = fix the caller. No DB/I-O, so no partial-write hazard.
- **Floored-value reserve-derivation regression** (a refactor uses exact s/M instead of the floored `s_r`/`M_r` to derive reserves) → silent `k′ < k` dust leak. Detected by INV-C2 (smoke spot + ENGINE.3 property). Recovery = revert; pre-PR audit greps the rounding direction.
- **Casing mismatch at the boundary** (caller passes `"YES"` instead of `"yes"`) → `side` is a TS literal union, so a wrong case is a **compile error** at the call site; at runtime an unexpected string would mis-key `reserves[side]`. Mitigated by the typed `Side` + the §13 casing note for ENGINE.7/8 glue.
- **Determinism drift** (platform/locale/Node version) → none: decimal.js results are a pure function of (inputs, precision, rounding) (§10.4). Guarded by the purity grep.

## 6. Edge cases (smoke + ENGINE.3)

- **Exact-divisible result** (E4: state (150,50), buy 10 → s = 35 exactly, `k′ = k`, no dust) vs **repeating** (E2: dust to pool).
- **Round-trip neutrality** (E3: buy then immediate full sell-back returns S − 1 ulp; dust retained).
- **Boundary magnitudes:** max 20 integer digits + 18 fractional (the `numericString` envelope); very small stake vs large reserves (tiny impact, still 18-dp).
- **Rejected inputs:** malformed string (`".5"`, `"1e5"`, `"+1"`, `""`); negative (`"-1"`); zero (`"0"`) for any of reserves/stake/shares/seed → `CpmmInputError`.
- **`getPrices` rounded-sum:** `p_yes + p_no` may differ from 1 by ≤1 ulp after independent half-even rounding (exact identity holds pre-rounding; informational — self-critique #2).
- **`computeResolvedUnwind` both branches** (E5: winning side = its reserve; losing side = the other reserve; sum = D).

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit smoke (Vitest, `tests/unit/cpmm/`) | **`calculate.test.ts`:** seed + `getPrices` (E1 → `0.500000000000000000`); one buy (E2 exact strings: `shares`, reserves, `pEff`, `p1`, `impact`, `k′ ≥ k`); one sell (E3 strings); one exact-divisible buy (E4 plain assertions: s = 35.000000000000000000, k′ = k — the no-dust branch); `computeResolvedUnwind` both branches (E5); every output is an 18-dp decimal string. **`validate.test.ts`:** `CpmmInputError` on malformed / negative / zero for stake, shares, seed, and a reserve. | INV-2 exactness (18-dp strings); INV-C2 (E2 `k′`), INV-C4 (E5 residual) touched as spot vectors |
| Integration (`tests/integration/`) | **None** — no DB writes in this task. | — |
| E2E (Playwright) | **None** — no runner installed; no UI. | — |

- **`@test-writer` writes these FIRST (RED), before `calculate.ts`** (CLAUDE.md §5.6 tests-first; `@test-writer` forbidden from `src/`). The §13 contract + the E1/E2/E3/E5 numbers from `cpmm.md` §12 give it everything. *(This reorders directive K — see OQ-B.)*
- `globals: false` → tests import `{ describe, it, expect }` from `vitest`. Run locally via `pnpm vitest run tests/unit/cpmm/` (note: `just verify` runs **no** tests; CI's `vitest run` covers the whole suite).
- **Explicit deferral to ENGINE.3:** E1–E5 verbatim fixed-vector tests, every numbered §4.2/§5.2 property, and INV-C1–C5 property tests are **not** absorbed here. ENGINE.2 ships spot vectors + the error contract only.

## 8. Out of scope

- **Handlers / routes / transactions** — the W-1 bet tx, W-3 resolution, lock order, retries, idempotency, moderation, floors (ENGINE.7/9; ADR-0013).
- **Schema / migrations** — none; DB column mapping (reserves ↔ `pools`) is ENGINE.7 glue (SPEC.2 Appendix B.3).
- **Property / vector suite** — ENGINE.3 (E1–E5, §4.2/§5.2 properties, INV-C1–C5).
- **Spec edits** — no `cpmm.md` / SPEC.1 / SPEC.2 changes. (CLAUDE.md / AGENTS.md doc-drift riders are OQ-E, not spec edits.)
- **Number pinning** — seed C, floors, `SLIPPAGE_WARNING_PCT_THRESHOLD` stay symbolic (SPEC.1 §16.1).
- **New event types / error codes** — none minted (`CpmmInputError` is a programmer-error sentinel, not a §15 code).
- **API beyond §13** — no extra helpers exported; no client-side build of the module (`server-only`).
- **Cloning the reference fork** — optional; `cpmm.md`'s closed forms are canonical and self-contained (upstream is float+EPSILON+binary-search, deliberately *not* mirrored — §2 "Replaced").
- **No weakening** of purity / fee-less / conservation / append-only.

---

## Open questions

*All founder-ratified 2026-06-04 (plan-chat AskUserQuestion). Bodies above already reflect the rulings.*

- **OQ-A — decimal.js version pin: literal `"10.6.0"` vs caret `"^10.6.0"`. → RESOLVED: literal `"decimal.js": "10.6.0"`.**
  - **Why:** (1) project vendor-dep discipline pins money/runtime deps literal (AWS SDK `3.1045.0`, better-auth `1.6.11`, openai `6.39.0`, zod `3.25.76`) and prior founder feedback is "literal, never caret" for vendor deps; (2) §10.4 makes exact-version reproducibility a *requirement* — a caret admitting 10.7+ could silently alter rounding/`sqrt`. Literal `10.6.0` sits **within** the spec's `^10.6` line, so this is package.json pin *mechanics*, not a `cpmm.md` contradiction. (Directive H wrote `^10.6.0`; founder overrode to literal.)
- **OQ-B — test ordering: tests-first vs implement-first. → RESOLVED: tests-first (`@test-writer` RED → implement → GREEN).**
  - **Why:** CLAUDE.md §5.6 mandates failing-tests-first for thesis-touching logic (CPMM math), and ENGINE.0 set the house precedent. Directive K listed "calculate.ts → smoke tests" (implement-first); the execute checklist (step 3) is reordered to put `@test-writer` before `calculate.ts`.
- **OQ-C — serialization pin: every output `Decimal.toFixed(18)` (uniform 18-dp). → RESOLVED: YES.**
  - Resolves §12's `"n′ = 110"` prose shorthand vs `"110.000000000000000000"` in favour of §10.3's "exactly 18 decimal places." So e.g. `seedPool("100") → {yes:"100.000000000000000000", no:"100.000000000000000000"}`.
- **OQ-D — attribution header on all four files vs `calculate.ts` only. → DEFAULTED: uniform on all four (directive E; not escalated).**
  - Makes the pre-PR grep binary. Minor semantic nuance: `errors.ts`/`validate.ts`/`decimal.ts` are original work, not "derived from `calculate-cpmm.ts`"; the §2 *literal* obligation is "every source file that derives." Broad/conservative attribution accepted. (Founder may still revisit at execute review.)
- **OQ-E — doc-drift riders on the execute PR (CLAUDE.md §7 same-PR ritual). → RESOLVED: YES, ride the execute PR.** Three lines go stale at install:
    1. CLAUDE.md §2 — "there is no decimal library yet" becomes false.
    2. CLAUDE.md §1 — critical-path list omits `src/server/cpmm/` (add it).
    3. **AGENTS.md §1** — "Not installed yet: … a decimal math library (decimal.js/big.js)" becomes false. *(Caught addition — directive M2 named only CLAUDE.md; AGENTS.md drifts too.)*

## ADRs needed

**None new.** The library choice (decimal.js, resolving ADR-0008 §8) was ratified at ENGINE.1 in `cpmm.md` §10.1/§15; module structure follows the ADR-0008 house pattern. Optional: an in-place ADR-0008 *Patch record* noting §8 is now resolved — RESOLVED at ratification (2026-06-04): deferred to SYNC.BACKFILL with the other ADR header flips.

---

## Execution checklist (runnable by a fresh session, zero plan-chat context)

1. Sync `main` (`git checkout main && git fetch origin && git reset --hard origin/main`; expect `48ca6d0` or later) → branch `feat/engine-2-cpmm-module`.
2. Install: `pnpm add "decimal.js@10.6.0"` (literal pin per OQ-A; the engine's first runtime dep). Nothing else installed.
3. **`@test-writer`** writes failing smoke tests (RED) at `tests/unit/cpmm/{calculate,validate}.test.ts` against the §13 contract + §12 E1/E2/E3/E5 numbers (OQ-B).
4. `decimal.ts` → `errors.ts` → `validate.ts` → `calculate.ts` (turn smoke GREEN). Attribution header on every file.
5. `pnpm vitest run tests/unit/cpmm/` green → `just verify` (typecheck → biome → build) → CI green (whole-suite `vitest run`).
6. **`@code-reviewer`** then **`@security-auditor`** — pass `@docs/plans/ENGINE.2.md` to both.
7. **Pre-PR self-audit (§5.10), item-by-item PASS/FAIL/SURPRISE:**
   - §13 export surface present & verbatim (names, arg shapes, return shapes; `Side`/`Reserves`/`CpmmDecimal`/`CpmmInputError` exported; no extra exports; no void function).
   - `numericString` **imported** from `@/server/events/schemas`, **not** redefined; no `z.number()`.
   - Attribution header on **every** `src/server/cpmm/*.ts`.
   - No `db`/`fetch`/`Date`/`Math.random`/env import anywhere in the module (purity grep).
   - Rounding directions: **floor** on `shares`/`proceeds`; reserves derived from the **floored** value; **half-even** on prices. `k` never persisted.
   - `git diff --stat` (the feature PR) = exactly: `src/server/cpmm/*`, `tests/unit/cpmm/*`, `package.json`, `pnpm-lock.yaml`, `CLAUDE.md` (OQ-E riders: §1 critical-path add + §2 decimal line), `AGENTS.md` (OQ-E rider: §1 not-installed line). Nothing else — the plan file merged earlier on `docs/engine-2-plan`; the session log ships separately on `chore/engine-2-log`.
8. PR → founder squash-merge → post-merge sync + `git branch -D feat/engine-2-cpmm-module`.

Commit identity `Zugzwang/world`; multi-line messages via `/tmp/engine-2-msg.txt` (`rm -f` first); no `Co-authored-by` trailer.

---

## Self-critique (Phase 1 self-review, 2026-06-04)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Prices (`p0/p1`) computed from precision-50 exact reserves, while the **output** reserves are floored-derived 18-dp — the two can differ by ≤1 ulp. | Chosen per §10.4 (exact-then-round); prices are informational and not used in §8, so INV-C5 is unaffected. E1–E5 do **not** distinguish the two readings (verified on E2) — so the vectors do NOT lock this; **this plan is the pin**. Consequence: getPrices(result.reserves) may differ from the returned p1 by ≤1 ulp on some inputs (never on E1–E5); ENGINE.3 may add a ≤1-ulp cross-consistency assertion. A one-line cpmm.md §10.3 clarification (MINOR bump) is queued as a separate future docs PR — not this task. |
| 2 | low | `getPrices` rounds `p_yes` and `p_no` independently → their sum may be 1 ± 1 ulp though §3.3 says `p_yes + p_no = 1` identically. | Accepted: the exact identity holds pre-rounding; rounded prices are informational. ENGINE.3 may add a ≤1-ulp tolerance assertion. Noted, not "fixed." |
| 3 | low | `import "server-only"` (per §13) forecloses reusing this module client-side for a live, as-you-type slippage preview; DESIGN.4 would need a server round-trip or a later pure-core extraction. | Spec is explicit (§13) — followed. Recorded as a forward note for DESIGN.4; not an ENGINE.2 change. |
| 4 | low | `CpmmInputError` lives in `src/server/cpmm/errors.ts`, deviating from AGENTS.md §4's "custom error classes in `src/lib/errors.ts`." | Intentional: it is a programmer-error sentinel **outside** the SPEC.1 §15 product-error catalogue (directive B), so it stays module-local. Documented. |

Checked: invariant coverage (thesis + INV-C), scope discipline (pure module, no schema/tx), test-assertion mapping, edge-case enumeration, rounding-direction correctness against E2/E3/E4/E5, doc-drift completeness (caught AGENTS.md §1).

---

## References

- `docs/specs/cpmm.md` v1.0.0 — the canonical math/numeric contract this plan implements (§2 attribution, §3–§9 formulas, §10 rounding, §11 INV-C, §12 vectors, §13 API, §14 non-goals).
- `CLAUDE.md` §1 (critical paths — see OQ-E), §2 (INV-1/2/3/4; money-as-string, no floats), §5.6 (tests-first — OQ-B), §5.10 (pre-PR audit), §5.12 (ADRs).
- `AGENTS.md` §1 ("Not installed yet: decimal library" — OQ-E), §4 (no `z.number()`, error classes), §6 (`side` pgEnum casing), §9 (test layout).
- `src/server/events/schemas.ts:23` — `numericString` (the reused boundary validator).
- `docs/references/manifold.md` — pinned fork map (tag `ref-2026-04-28-found5` @ `d5b55cf9`); `THIRD_PARTY_NOTICES.md` — the MIT notice.
- `docs/plans/ENGINE.0.md` — house template precedent (tests-first, doc-drift riders, zero-edit proof).
- Tracker: operator tracker (v12 at plan time), ENGINE lane, ENGINE.2 (deps ENGINE.1/ENGINE.0/FOUND.5 — all done).
