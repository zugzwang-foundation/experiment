# ENGINE.1 (session B) — CPMM Math Companion Landing · Execute Close-Out

**Task:** ENGINE.1 session B — land the CPMM math companion (`docs/specs/cpmm.md`) + its license obligation (`THIRD_PARTY_NOTICES.md`) + the SPEC.1 glossary drift fix. Docs-only; no `src/`, no migrations, no reviewer cascade (kickoff-scoped).
**Date:** 2026-06-04.
**Branch / PR:** `docs/engine-1-cpmm-spec` → **PR #71** (https://github.com/zugzwang-foundation/experiment/pull/71). Base `main` @ `2e26b52`.
**Roles:** CC executed; operator ruled the version-drift resolution (relay) + squash-merged.
**Outcome:** Merged. **Canonical SHA = `e7362fc`** (squash-merge of #71 on `main`). CI green (`ci` 1m29s + Vercel deploy + Preview Comments).

---

## What landed (files + PR#)

PR #71, one commit (`f996418`), squash-merged as `e7362fc`. 3 files, +710 / −3:
- `docs/specs/cpmm.md` (new, +664) — CPMM math companion **v1.0.0**, verbatim copy of the staged file. Canonical for every CPMM formula + the numeric policy (decimal.js, precision 50, 18-dp directional boundary rounding, floor-on-user-credited). Manifold lineage pinned (`zugzwang-foundation/manifold-reference` @ `d5b55cf9`, tag `ref-2026-04-28-found5`).
- `THIRD_PARTY_NOTICES.md` (new, +42, **repo root**) — Manifold MIT notice, verbatim. License obligation of the AGPL-incorporating-MIT lift.
- `docs/specs/SPEC.1.md` — exactly **3 hunks**: §0 version `1.0.1 → 1.0.2` + last-updated → 2026-06-04; §2 glossary CPMM path cell `src/server/markets/cpmm.ts → src/server/cpmm/`; new §20 `1.0.2` change-log row.
- `docs/logs/ENGINE.1.md` (this file) — separate close-out PR.

## Decisions made

1. **Version → 1.0.2, not the kickoff's 1.0.1 (operator Option-1 ruling).** Kickoff assumed SPEC.1 was at `1.0.0` and would bump to `1.0.1`. At HEAD it was already `1.0.1` (PRECURSOR.4 v1.0 lock + post-lock hygiene, both 2026-06-03), with an existing `1.0.1` row. Recording another `1.0.1` would duplicate the version → bumped to `1.0.2`. **Spec > kickoff** (kickoff ranks lowest).
2. **Change-log row reformatted to the live 6-column schema.** Kickoff supplied a 4-column row (`Version | Date | HMH | <blob>`, version-first) incompatible with the live §20 table (`Date | Version | Section | Change | Rationale | ADR`, no author column). Operator supplied the corrected row in the live schema; appended verbatim.
3. **Started from `origin/main`, not the local branch.** Preflight found the session opened on `chore/visual-backbone-v0.2` (already squash-merged as #70), and local `main` 1 behind. Reset local `main` → `origin/main` (never `git pull`) before branching.
4. **PR-body "🤖 Generated with Claude Code" footer omitted (deliberate).** Squash-merge folds the PR body into the `main` commit message; a non-Foundation attribution line would violate single-author discipline (AGENTS.md §10 / the SYNC.10 trailer-leak lesson). Project contract overrides the harness default.

## Surprises caught + handled in-session

1. **Compound kickoff↔live-spec drift (STOPPED before any SPEC.1 edit; operator-resolved).** Three facets, all from the kickoff being drafted against a pre-PRECURSOR.4 spec state: (a) §0 already `1.0.1` → edit (a)'s `1.0.0` source string didn't exist (no-op bump); (b) a `1.0.1` change-log row already existed → edit (c) would have duplicated the version; (c) the supplied "verbatim" row's column structure didn't match the live 6-col table → literal paste was impossible. Surfaced once with a recommended resolution; operator chose **Option 1** (bump 1.0.2 + corrected-schema row). Files (steps 0–2) were already landed clean; only the SPEC.1 edits were blocked pending the ruling.
2. **`grep markets/cpmm docs/ src/` returns 1, not the kickoff's expected 0 (benign — VERIFIED).** The single residual match is *inside* the new §20 row, which narrates the fix by quoting the old path (`repointed \`…/markets/cpmm.ts\` → \`src/server/cpmm/\``). The live glossary cell (§2) is correctly repointed; the residual is documentation-of-the-fix, not a code reference. Confirmed the glossary cell was the sole live reference pre-edit.

## Open questions

None blocking ENGINE.1. One forward flag for ENGINE.2 (below).

## Next session starts at

**ENGINE.2** — the `src/server/cpmm/` module, consuming `docs/specs/cpmm.md`. Critical-path money math → full ritual (tests-first `@test-writer` → `@code-reviewer` → `@security-auditor`; pre-PR self-audit; `ultrathink`). It must:
- Implement the CPMM formulas exactly per `cpmm.md` (canonical on any formula conflict).
- Add **decimal.js** to `package.json` with a **literal patch pin** (e.g. `"10.6.0"`, NOT `^10.6`) per the AWS-SDK vendor-dep discipline — `cpmm.md` writes `^10.6` as intent, but the pin must be literal at install time. (`decimal.js` is **not yet in `package.json`**.)
- Honour the numeric policy: precision 50, 18-dp directional boundary rounding, floor on user-credited quantities; `NUMERIC(38,18)` end-to-end, never JS floats.

Immediate next action: open a fresh session + web chat for ENGINE.2 planning.

## Context to preserve

- **Canonical SHA `e7362fc`** (PR #71 squash on `main`).
- **`cpmm.md` is the formula source of truth** (precision 50, 18-dp floor-on-credit). SPEC.1 §10 owns the economic *rules*; SPEC.2 §3.2/§3.6 own *execution context*; on a formula conflict, `cpmm.md` wins.
- **Glossary now points CPMM → `src/server/cpmm/`** (greenfield dir; ENGINE.2 home) — was the stale `src/server/markets/cpmm.ts`.
- **`THIRD_PARTY_NOTICES.md` (repo root)** carries the Manifold MIT notice — license obligation; keep verbatim, don't relocate.
- **Kickoff-vs-live-spec drift recurs:** execution kickoffs can lag the spec version. Before applying any version bump / change-log row, **re-read live §0 version + the §20 table schema** (it's 6-column: `Date | Version | Section | Change | Rationale | ADR`, no author column). SPEC.1 + SPEC.2 are version-paired (both v1.0-locked at PRECURSOR.4, 2026-06-03).

## Time

2026-06-04. One execute session. One operator ruling mid-session (version/change-log resolution, Option 1). CI green; merged same session.
