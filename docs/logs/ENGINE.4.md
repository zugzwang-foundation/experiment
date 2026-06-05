# ENGINE.4 — session log

> **Stratum:** ENGINE.4 — market state machine (`src/server/markets/`); a pure-TS 7-state transition module over the built `market_status` enum, reading `markets`/`pools`.
> **Entry:** plan session (read-only preflight recon → draft → founder OQ batch → web review A1–A6 + a three-touch A2 scope extension → ratification → docs land). Execute session appends below in a fresh CC session.

---

## Plan session — 2026-06-05

**What landed.**
- `docs/plans/ENGINE.4.md` — the founder-ratified implementation plan (**Status: reviewed**) — via **PR #81**, squash-merged to `main` at **`314802034c76a3f76594ebbe801718a24bea2ea1`** (`plan: ENGINE.4 — market state machine (reviewed) (#81)`), **+300 lines, docs-only, no reviewer cascade** (#77 precedent).
- No `src/`, no test, no schema/migration changes — plan-only. Plan-chat branch `docs/engine-4-plan` merged and deleted; this log ships on `chore/engine-4-log`.

**Decisions made — OQ batch (all founder-ratified 2026-06-05).**
- **OQ-A** ritual ruled **(ii)**: `@test-writer` RED → `@code-reviewer` → a **narrow `@security-auditor`** pass (scoped to INV-4-edge-foreclosure + single-gate-bypass) → §5.10 audit; **no post-PR soak** (CLAUDE.md §5.10 supersedes `plan-then-execute.md`'s 24h). The CC dissent (drop `@security-auditor` for a pure IO-free module) was **overridden** — belt-and-braces on the INV-4-adjacent gate.
- **OQ-B** ruled **(i)**: `Frozen` is a **real terminal state** (`Resolved|Voided → Frozen` legal, `Frozen` absorbing); ENGINE.4 ships **no `'Frozen'` writer** — the global freeze stays `system_state.frozen_at`.
- **OQ-C / OQ-D** web priors adopted: the `resolving_at` anchor + `market.resolving` / `→Frozen` / `Draft→discard` event gaps → **ENGINE.7/9** (with an ADR-0013 in-place patch record there); `Draft→discard` is **not** a machine edge — the machine encodes only the `Draft→Voided` rejection, and discard is a plan note owned by the market-creation stratum.
- **OQ-E** ruled **(i)**: discriminated **`TransitionResult`** + a **reserved `MarketTransitionError`** sentinel (the unreachable enum-drift case). A2 type-shape note: the B8 field guard returns its **own** `DeadlineCheckResult` (`deadline_extension` narrows to it, out of `TransitionRejection`).
- **OQ-F** ruled: **(a)** AGENTS.md §9 tree + `ZUGZWANG_ENV` gotcha promotion **ride the execute PR**; **(b)** F-4/F-6 editorial fixes (SPEC.1 §2 glossary `Draft`/seven/`status`; ADR-0013 `markets.state`+`resolving_at`) → **PRECURSOR.5** via a one-line `docs/parked.md` entry that rides the execute PR.

**Decisions made — web review amendments A1–A6 (folded into the ratified plan).**
- **A1** rejected-pair count `42 → 41` (two occurrences: Approach + transition-table), harmonized with the 7×7 matrix + the 49-pair totality row.
- **A2** `assertDeadlineNotExtended` returns its **own** `DeadlineCheckResult = { ok:true } | { ok:false; reason:"deadline_extension" }`; `deadline_extension` narrows **out** of `TransitionRejection`. Required a **three-touch scope extension** surfaced via **two scope-ARRESTs** (do-not-absorb held): line 140 + line 226 granted on ARREST #1 (OQ-E prose harmonization; ruling-note parenthetical with the ruling text untouched), line 44 granted on ARREST #2 (file-layout type-list completion). A **post-fold ARREST #3 sweep came back CLEAN** — no strands beyond the three.
- **A3** `docs/parked.md` named as the **PRECURSOR.5 queue vehicle** for F-4/F-6 (OQ-F + checklist step 5 + step 7 execute diff-stat).
- **A4** the totality test additionally asserts **`transition(f,t).ok === canTransition(f,t)`** across all 49 pairs.
- **A5** added a **"Carry-forwards minted by this plan"** block (three forward items).
- **A6** the `≥` boundary cited from **SPEC.1 §6.1 `:210` "deadline reached"** (reached ⇒ the `==` instant closes); self-critique #5 downgraded to **low (resolved)**; named boundary test retained.

**Probes (L-E3.5 — typecheck-probe planned constructs; both PASS, neither blocked PR open).**
- **P-1 (enumValues).** A temporary `src/server/markets/_probe.ts` checked **bidirectional** assignability between `(typeof marketStatusEnum.enumValues)[number]` and the explicit 7-literal union — `pnpm tsc --noEmit` **exit 0** both directions ⇒ the derivation does **not** collapse to `string`. Probe removed; **zero trace** (`git status` = only the plan file). No A7 fallback (local union + `satisfies` guard) needed.
- **P-2 (DB-free test-load).** `vitest.config.ts:21` (`tsconfigPaths()` → `@/`) + `:23–25` (`server-only` → noop shim) confirm `tests/unit/markets/` imports `@/db/schema/markets` without Postgres (`markets.ts` pulls only `drizzle-orm/pg-core` + `drizzle-zod`).

**Open questions.** None — all ruled. The plan's **"Carry-forwards minted by this plan"** block routes the three forward items: (1) `resolving_at` anchor + `market.resolving` event gap → **ENGINE.7/9** (+ ADR-0013 patch record); (2) single-gate mechanical-enforcement decision (DB trigger vs CI lint vs review-only) → **ENGINE.9**; (3) F-4/F-6 editorial fixes → **PRECURSOR.5** via `docs/parked.md`.

**Next session starts at.** **ENGINE.4 EXECUTE in a FRESH CC session + fresh web chat** (§5.1/§5.8 plan/execute split — never this session). Execute **step 1** = sync + branch **`feat/engine-4-market-state-machine`** off `main` (`3148020`+); **step 2** = `@test-writer` RED authors `tests/unit/markets/transitions.test.ts` (CP-1 web line-review before implementation). Pass `@docs/plans/ENGINE.4.md` to the cascade subagents.

**Context to preserve.**
- **Canonical ratified-plan SHA:** `314802034c76a3f76594ebbe801718a24bea2ea1` (squash of PR #81).
- **Ritual** (OQ-A): `@test-writer` RED → `@code-reviewer` → **narrow `@security-auditor`** (INV-4-edge-foreclosure + single-gate-bypass) → §5.10 audit; **no soak**.
- **Verify form:** `ZUGZWANG_ENV=preview just verify` (the build stage needs the env prefix — `docs/logs/ENGINE.2.md:64`); `tests/unit/markets/` runs DB-free locally, the whole suite is the CI merge gate.
- **Design pins:** `MarketStatus` derived from `marketStatusEnum.enumValues` (P-1-validated); the §6.1 graph is `LEGAL_TRANSITIONS` + `satisfies Record<MarketStatus,…>`; `closeOnDeadline` takes `{ now, resolutionDeadline }` (never reads a clock); discriminated `TransitionResult` + the B8 `DeadlineCheckResult`; module-local `MarketTransitionError` reserved for enum-drift.
- **Execute diff-stat closed set:** `src/server/markets/{transitions,errors}.ts` + `tests/unit/markets/transitions.test.ts` + the **AGENTS.md** rider + the one-line **`docs/parked.md`** entry. **Zero schema/migration/event/handler lines.** Legal set **== 8 edges** exactly; a §6.1 gap is STOP-and-surface, never a guess.

**Time.** 2026-06-05 (IST) — single plan-chat session: read-only preflight recon (P0–P8) → plan draft + founder OQ batch (A/B/E/F via AskUserQuestion; C/D adopted priors) → web "ratifiable after six amendments" A1–A6 → atomic fold + three ARRESTs (A2 scope-extension grants at lines 140/226 then 44; post-fold ARREST #3 sweep clean) → P-1/P-2 probes → docs-only PR #81 → founder squash-merge (`3148020`) → post-merge sync (clean recovery from a transiently-aborted `checkout main` — `reset --hard` had landed on the plan branch; re-synced `main` to `origin/main`, branch deleted) → this log.

---
