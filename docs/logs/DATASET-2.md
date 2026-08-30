# DATASET.2 — session log

**Task** DATASET.2 · live `DatasetSource` + C2/C3 closure + seven ratified doc edits
**Branch** `feat/dataset-1-export-pipeline` (continued from DATASET.1) · **PR #435, OPEN / UNMERGED**
**Worktree** `~/code/zugzwang/dataset-1` · **Ran** 2026-08-29T21:38 → 2026-08-30 UTC
**Full run report** `~/Downloads/zz_DATASET-2_run_2026-08-29T2138.md` (operator-uploaded; not in-repo)

---

## What landed

Seven commits, all signed, all carrying the §5.13.1 block byte-identically.

| SHA | What |
|---|---|
| `a79fec2` | **Slice 1** — the seven ratified doc edits E1–E7; **SPEC.2 1.0.27 → 1.0.28** |
| `a7c75cc` | **Slices 2+3** — C2 recursive payload strip + recursive secret harvest; C3 `commentId` stripped unconditionally |
| `b0c89ae` | **Slices 4+5** — the live drizzle `DatasetSource`; the round-trip equivalence test |
| `7798c40` | Slice 5 hardening — two round-trip mutations that did not red |
| `8f87618` | `@code-reviewer` — CRITICAL + 4 HIGH + 4 MEDIUM |
| `676710c` | `@test-writer` — HIGH-1 correction + 5 further findings |
| `8697bdd` | `@security-auditor` F-11 — the no-transaction premise, + 4 MEDIUM |

**Files:** `src/server/export/dataset/{drizzle-source,csv,strip,build,pseudonymize,treatments,removed}.ts` ·
`src/server/export/egress/{forbidden-keys,assertions}.ts` ·
`tests/_fixtures/dataset/{dirty-source,seed-live}.ts` ·
`tests/integration/{dataset-roundtrip,dataset-paging-reconciliation,dataset-build-script}.integration.test.ts` ·
`tests/unit/export/dataset/{depth-strip,canonical-json,removed-masking,build,reviewer-fixes,transform}.test.ts` ·
`docs/specs/SPEC.2.md` · `docs/runbooks/dataset-release.md` · `docs/parked.md`

**Gate:** `tsc` 0 · `biome check .` 0 · `next build` 0 · `vitest run` **4023 passed / 1 skipped / 4 todo (419 files)** · `pnpm dataset:build:fixture` 0.
**Exit criterion met and measured:** fixture build vs live-reader round-trip →
**16/16 CSVs byte-identical, `content_sha256` equal.**

## Decisions made

- **`ultracode` / dynamic workflows NOT used**, against the session harness's own
  default. Brief §5 states NOT PERMITTED; CLAUDE.md §6 defaults FORBIDDEN; the
  task carries ordered proof obligations. Contract over harness.
- **Canonical JSON (RFC 8785) now determines the emitted bytes.** Required once
  jsonb was seeded correctly, because key order then comes from Postgres rather
  than a literal. ⚠ **Changes every published checksum** — flagged for
  ratification, costs nothing today since nothing is released.
- **Four findings deliberately NOT fixed**, each for a stated reason: the
  participant-poisoning class (changes which guards are fatal — needs a
  ruling); the freeze-gate premise (repair depends on a founder call, and it
  arrived from the last reviewer, so a structural change would ship
  unreviewed); the `comment.placed` recovery path (closing it deletes a key the
  spec ships); microsecond truncation (changes the artifact's timestamp
  format).
- **No document edited outside E1–E7**, including where a reviewer said a
  `parked.md` entry and a runbook line were owed. DATASET.1 flagged four spec
  defects and patched none; that line held.
- **`comments.bet_id` corrected to `null` in the fixture** — the circular
  non-deferrable FK pair means it can never hold a value, which CLAUDE.md §2 and
  AGENTS.md already state.

## Open questions — ranked, full detail in the run report §11

1. ⛔ **CRITICAL** — one HTTP request permanently poisons the release build
   (`User-Agent` → harvested needle → fatal collision with a shipped column;
   `events` is Bucket A, so unremediable post-freeze).
2. ⛔ The reader's **no-transaction premise is false** — `r2-orphan-sweep` is not
   freeze-gated and writes `events` every six hours.
3. Should `r2-orphan-sweep` be freeze-gated at all? (SURPRISE, its own task.)
4. C3 does **not** close the recovery path it was ratified to close —
   `comment.placed` carries both `commentId` and `uploadId`.
5. A nested secret under an **unlisted key name** is silent in all four layers;
   no backstop exists.
6. `idempotency_key` ships 255 bytes of unmoderated participant text, forever.
7. `Date.toISOString()` truncates `timestamptz` **microseconds**, permanently.
8. SPEC.2 §19.4's H2 erasure **cannot be written as specified** (`users.name` /
   `email` are NOT NULL) — and no erasure implementation exists in `src/`.
9. Ratify or reject canonical JSON (it moves every checksum).
10. SPEC.2 carries **two version strings three patches apart**; CLAUDE.md §1
    quotes the stale one.

## Next session starts at

**Rule open questions 1 and 2**, then 3 (it is question 2 asked from the other
direction). Nothing further should be built on the reader until 2 and 3 are
settled — the correct snapshot behaviour depends on the answer.

## Context to preserve

- ⚠ **The mutation harness restores with `git checkout --`, so the work must be
  COMMITTED first.** It destroyed three source files mid-run before that was
  understood, and produced a plausible, uniform, entirely void mutation table.
  Both harnesses now refuse to start unless `git diff --quiet` is clean.
- ⚠ **A fix's test may be unable to fail.** Restoring the jsonb double-encode
  left all 21 round-trip tests green, because canonical JSON makes both sides
  sort keys. Only a direct `jsonb_typeof` assertion catches it.
- ⚠ **`tsc` + biome + vitest can all pass a module the release script cannot
  load.** Each resolves a different `exports` condition. `scripts/build-dataset.ts`
  is now spawned by a real test for exactly this reason.
- ⚠ **A `*/` inside a JSDoc block comment truncates it** — pasting a cron
  literal like the sweep's schedule ends the comment early.
- Local Postgres `:54322`: this run left it clean. Two stray `zz_probe_jsonb*`
  tables created during the jsonb investigation were dropped; they had reddened
  `staging-reset-mechanism.integration.test.ts`.
- `origin/main` moved **twice** during the run (`acb71cb` → `44c9f99` →
  `a95ef2b`). Not rebased; `acb71cb` remains the merge-base.

## Time

~14 h wall clock, unattended. Three reviewer subagents run **sequentially** at
`effort: max` plus the mandatory F-11 re-run — which, as on DATASET.1, was the
highest-value step of the night.
