# ENGINE.2 — session log

> **Stratum:** ENGINE.2 — CPMM TypeScript module (`src/server/cpmm/`)
> **Entry:** plan session (recon → draft → web review → ratification → docs land). Execute sessions append below.

---

## Plan session — 2026-06-04

**What landed.**
- `docs/plans/ENGINE.2.md` — the founder-ratified implementation plan — via **PR #73**, squash-merged to `main` at **`d6af030`** (`docs(plans): ENGINE.2 — CPMM module implementation plan (founder-ratified) (#73)`).
- No `src/` and no schema/migration changes — this session was plan-only. Plan-chat branch `docs/engine-2-plan` merged and deleted; this log ships on `chore/engine-2-log`.

**Decisions made.**
- **OQ-A** — decimal.js pinned **literal `10.6.0`** (not the kickoff's `^10.6.0`): vendor-dep literal-pin discipline + cpmm.md §10.4 determinism (exact reproducibility of money math); literal sits within the spec's `^10.6` line, so no `cpmm.md` contradiction.
- **OQ-B** — **tests-first** via `@test-writer` (RED → implement → GREEN), per CLAUDE.md §5.6; reorders the kickoff's implement-first checklist.
- **OQ-C** — every module output rendered uniform **`Decimal.toFixed(18)`** (resolves §12 shorthand vs §10.3 "exactly 18 dp").
- **OQ-D** — attribution header **uniform on all four files** (directive E; makes the pre-PR grep binary).
- **OQ-E** — doc-drift riders ride the **execute** PR (CLAUDE.md §7 same-PR ritual): CLAUDE.md §2 "no decimal library yet" + §1 critical-path add (`src/server/cpmm/`) **and** AGENTS.md §1 "Not installed yet: decimal library" (caught addition — directive M2 named only CLAUDE.md).
- **Web-review amendments A1–A6** applied to the plan: A1 price recipe = exact-then-quantize is the pin (E1–E5 don't lock it); A2 tracker version-neutral ("operator tracker, v12 at plan time"); A3 execute-PR diff-stat enumerated; A4 E4 no-dust smoke vector added; A5 ADR-0008 §8 patch-record **deferred to SYNC.BACKFILL**; A6 status → reviewed.
- Module shape pinned: 4 direct files (`decimal` / `errors` / `validate` / `calculate`), no barrel; `numericString` imported from `@/server/events/schemas` (never redefined); `CpmmInputError` module-local (outside the §15 catalogue); pure — no clock/env/random/DB/I-O.

**Open questions.** None — all five (OQ-A…E) founder-ratified 2026-06-04; ADR-0008 patch-record deferral resolved (→ SYNC.BACKFILL).

**Next session starts at.** Execute chat: branch `feat/engine-2-cpmm-module` off `main` (`d6af030`+); **step 1 = read the merged plan back in full + `cpmm.md` §10 (arithmetic/rounding) and §13 (module API) verbatim**, then run the plan's execute checklist (`pnpm add "decimal.js@10.6.0"` → `@test-writer` smoke tests RED → `decimal/errors/validate/calculate` → `@code-reviewer` → `@security-auditor` → pre-PR §5.10 audit). Pass `@docs/plans/ENGINE.2.md` to both subagents.

**Context to preserve.**
- **Delimiter-leak guard:** Write-tool-authored files can carry stray `</content>`/`</invoke>` tokens in their trailing bytes — `tail` + `grep -n '</content>\|</invoke>\|</parameter>'` before any commit/cp. (Caught and fixed on the plan doc before #73.)
- **Casing boundary:** the module's `Side` is lowercase `"yes" | "no"` per cpmm.md §13; the system `side` pgEnum / event payloads are uppercase `"YES" | "NO"`. Case translation is **ENGINE.7 glue**, not the cpmm module's job.
- **Reserves derive from the FLOORED `s_r`/`M_r`** (not the exact value) — this is what makes `k′ ≥ k` and the residual identity exact; prices are computed from precision-50 exact quantities then quantized.
- Reference fork clone is **optional** — cpmm.md's closed forms are canonical and self-contained (upstream is float+EPSILON+binary-search, deliberately not mirrored).

**Time.** 2026-06-04 — single plan-chat session (opening recon → plan draft + 5 open questions → web "APPROVED WITH AMENDMENTS" → 6 amendments applied → docs-only PR #73 → squash-merge → this log).

---

## Execute session — 2026-06-04

**What landed.**
- The pure CPMM module `src/server/cpmm/` — **4 files**: `decimal.ts` (`CpmmDecimal` clone @ precision 50 + the `floor18`/`halfEven18`/`toFixed18` quantizers), `errors.ts` (`CpmmInputError`), `validate.ts` (`requirePositive`), `calculate.ts` (the §13 surface: `Side`, `Reserves`, `seedPool`, `getPrices`, `computeBuy`, `computeSell`, `computeResolvedUnwind`).
- A **46-test RED→GREEN smoke suite** at `tests/unit/cpmm/` (`calculate` 22 + `validate` 24), `@test-writer`-authored RED-first per OQ-B.
- **`decimal.js@10.6.0`** — literal pin (the engine's first runtime dep).
- The **3 OQ-E doc-drift riders** (CLAUDE.md §1 + §2; AGENTS.md §1).
- All via **PR #75**, squash-merged to `main` at **`2a8d888`** (`feat(cpmm): ENGINE.2 — pure CPMM module (cpmm.md §13 surface) (#75)`). **CI green** — the first real CI run (the `ci.yml` gate is `pull_request`-only; ran the full vitest suite vs Postgres-17 in 1m28s).

**Decisions made.**
- Ratified plan **NOT edited** (web ruling): the stale execution-checklist string **"E1/E2/E3/E5"** is recorded here instead — **E4 was written** per amendment A4 + the plan's §7 test-plan table (the no-dust `k′ = k` branch).
- `src/server/cpmm/` added to CLAUDE.md §1 **"Built, sensitive"** (it ships built in this PR), not the Greenfield line.
- **Per-file export pin** (the web-confirmed reading of "no extra exports"): `decimal.ts` = `CpmmDecimal` + `floor18`/`halfEven18`/`toFixed18`; `errors.ts` = `CpmmInputError`; `validate.ts` = `requirePositive`; `calculate.ts` = the §13 set. The quantize helpers and `requirePositive` are intended module API, not extras.
- Checkpoints batched **`decimal.ts` + `errors.ts`** into one commit; install used **`--save-exact`** (no `.npmrc` save-exact, so plain `pnpm add` would have written a caret) to land the literal pin in one step.
- Reviewer cascade **not re-run** after the reports — **zero code fixes applied** (every finding was an out-of-scope carry-forward, below).

**Open questions / carry-forwards.**
1. **ENGINE.3** — make the k-monotonicity property **magnitude-bounded** (an unconstrained property rediscovers the sub-ULP edge); optionally add the ≤1-ulp `getPrices(result.reserves)`-vs-returned-`p1` cross-consistency assertion (plan self-critique #1).
2. **ENGINE.7/9 caller contract** — callers must never feed **sub-ULP reserves** or **near-ceiling stakes** (security LOW ×2, web-accepted no-change; the module's domain proofs hold over realistic magnitudes, not the full `numericString` envelope; the 20-digit regex self-limits and fails closed via `CpmmInputError`).
3. **ENGINE.5** — `numericString` admits `-0` / leading zeros (e.g. `00100`): a canonical-form decision is owed at the Dharma ledger boundary (security SURPRISE; harmless in CPMM, gated by `.gt(0)`).
4. **OQ-D** — uniform attribution header (all 4 files) **stood at execute review** (founder did not revisit).
5. **Future docs PR** — a one-line `cpmm.md` §10.3 price-recipe clarification (MINOR bump), separate from this stratum.

**Next session starts at.** **ENGINE.3** (universally-quantified property suite: E1–E5 verbatim, §4.2/§5.2 properties, INV-C1–C5), pending the web-side close ritual + paired kickoff prompts.

**Context to preserve.**
- **pnpm store drift was machine-local** (node_modules linked from store v11 vs the pinned pnpm 10.33.2's v10) — fixed with `CI=true pnpm install --frozen-lockfile` (relinks, lockfile untouched); not a repo change.
- **Local `next build` needs `ZUGZWANG_ENV=preview`** (the `getRedisKey` build-env gate rejects `"unknown"`); bare `just verify` fails on `/admin/login` page-data collection without it — env-only, not a regression.
- **CI has no push trigger** — `ci.yml` is `on: pull_request: branches: [main]` only (no `workflow_dispatch`); CI runs only once a PR is open, so the local gate (biome + tsc + `next build` + unit suite) is the pre-PR proxy.

**Time.** 2026-06-04 — execute chat across 5 checkpoints (preflight read-back → branch + install + `@test-writer` RED → `decimal`+`errors` → `validate` → `calculate` GREEN → doc riders + `just verify` + push + cascade → §5.10 audit + PR #75 + CI green → post-merge sync + this log).
