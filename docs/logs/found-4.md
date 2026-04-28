# FOUND.4 — CLAUDE.md + AGENTS.md content + supporting docs

**Status:** done
**Date started:** 2026-04-28
**Date completed:** 2026-04-28
**Duration:** ~1 day (across 2 chats — design + delivery)
**Session type:** Tracker task
**PR / commit:** PR #11 (`<SQUASH-SHA>` — replace with `git log --oneline -1` on main)
**Chat link:** FOUND.4 design chat + FOUND.4 delivery chat (archived in Foundation Claude project)

---

## Scope

Per the tracker, FOUND.4 was scoped narrowly as "author CLAUDE.md content
extending the FOUND.2 stub." Final delivery shipped five files: CLAUDE.md
v2 (contract), AGENTS.md (stack patterns, replacing the FOUND.2 stub),
plus three new supporting documents the contract references —
`docs/maintenance.md`, `docs/workflows/plan-then-execute.md`, and
`docs/plans/_template.md`.

Scope expanded over the course of the design chat as the contract
revealed dependencies that needed to land alongside it. See Deviations.

---

## Final state — what is live

### `CLAUDE.md` (replaces 1-line stub)

- 338 lines, 11 sections.
- §1 names the experiment scope, dates (Build → Sep 14, Live → Nov 5,
  Conclude Nov 6 at Devcon 8 Mumbai, optional bonus showcase Nov 7-8 at
  ETHGlobal Mumbai), and the **critical-paths block** (`src/server/`
  files where silent corruption is catastrophic).
- §2 codifies the four thesis invariants with test-assertion guidance
  per invariant.
- §3 codifies engagement style — "push back, don't just agree" — as a
  named behavioural rule, not just a workflow prompt.
- §4 lists ten golden rules; rule 8 ("plan before you write") points
  to the workflow doc.
- §5 references subagents / slash commands / hooks (bodies deferred to
  SCAFFOLD.10).
- §6 is a pointer to the workflow doc.
- §7 is the task-log schema, now including a "Core file updates
  needed?" closing-ritual question.
- §10 (decision log) adds four rows for Claude Code config: Opus 4.7
  model, `effortLevel: xhigh` baseline in `.claude/settings.json`,
  `CLAUDE_CODE_EFFORT_LEVEL=max` env-var override, `ultrathink`
  keyword.
- §11 references `docs/maintenance.md` for the audit cadence.
- Top of file imports `@AGENTS.md` so framework guidance flows
  through (preserves FOUND.2's import contract).

### `AGENTS.md` (replaces 5-line stub)

- 370 lines, 10 sections, follows the agents.md open standard
  (Linux-Foundation-stewarded).
- Six core areas covered per the spec: stack/commands, project
  structure, code style, framework patterns (Next.js 16 + Drizzle +
  Tailwind v4 + shadcn new-york v4), testing, git workflow.
- §10 uses the three-tier boundaries pattern (always / ask first /
  never), tied directly to CLAUDE.md §1 (critical paths) and §2
  (thesis invariants).
- Includes Zugzwang-specific examples: bet-placement Server Action
  showing transaction wrap (§2.1), `bets.comment_id` NOT NULL
  enforcement (§2.1), explicit absence of `dharma_transfer` table
  (§2.2), raw-SQL audit triggers for resolution events (§2.4).

### `docs/maintenance.md`

- 139 lines.
- Encodes the feedback / validation loop: five triggers that should
  prompt an audit (task discovers drift, phase ends, ADR accepted, new
  subagent/command/hook lands, calendar bi-weekly), audit process via
  fresh Claude Code tab with paste-able prompt, anti-patterns,
  per-file cadence table, closing ritual.
- Distinguishes self-currency ("file matches reality") from
  self-improvement ("patterns from work codified into rules") — both
  surface in the same audit pass via different finding types.

### `docs/workflows/plan-then-execute.md`

- 233 lines.
- Two-tab Claude Code workflow: Plan tab (plan mode + ultrathink + max
  effort) → Execute tab (fresh tab, plan mode off + ultrathink + max
  effort).
- Critical-path tasks (per CLAUDE.md §1) add `@security-auditor`
  invocation, integration test run, 24-hour PR soak before merge.
- Pushback prompts baked into both phases.
- Prerequisites section names `CLAUDE_CODE_EFFORT_LEVEL=max` env var
  and `effortLevel: xhigh` in `.claude/settings.json`.
- References `.claude/commands/plan.md` for slash-command bootstrap
  (deferred to SCAFFOLD.10).

### `docs/plans/_template.md`

- 157 lines.
- Mirrors workflow Phase 1 categories: tracker context → approach →
  thesis-invariants table (forces yes/no per invariant + test
  assertion) → data model → API surface → UI/flow → failure modes →
  edge cases → test plan (3-layer table mapping to invariant
  assertions) → out-of-scope → open questions → ADRs needed →
  self-critique log (preserved, not deleted) → references.
- Status field: `drafted | reviewed | executing | complete | abandoned`.

### Repo state

- Branch protection on `main` continues to enforce signed PR-only
  merges, squash-merge only.
- Lefthook pre-commit (`biome-check-staged`) skipped this commit
  cleanly because Biome ignores Markdown by config (FOUND.2 setup) —
  no rule violations possible on an all-Markdown commit. Pre-push
  (`biome-check-all` + `typecheck`) ran and passed.
- `just verify` (full chain: typecheck + biome + build) runs green
  with the new files in place.

---

## Decisions taken

- **Two-tab workflow, not four.** Initial design proposed Plan +
  Adversarial Review + Execute + Final Review (four fresh Claude Code
  tabs). At the tracker's ~35 critical-path tasks, that would have
  meant 140 fresh sessions across the build — unsustainable. Adversarial
  review folded into Phase 1 self-critique; final review folded into
  the existing fresh-tab review pattern. Critical-path tasks add
  conditional steps (security-auditor, integration tests, 24h soak)
  inside the 2-tab structure rather than tiering the workflow itself.

- **Engagement style codified as CLAUDE.md §3, not just workflow
  prompts.** The "push back, don't just agree" rule applies to every
  Claude Code session, not only when running the workflow's pushback
  scaffolding. Designed to combat LLM sycophancy as the dominant
  failure mode of coding assistants.

- **AGENTS.md replaced, not extended.** FOUND.2 carry-forward implied
  "extend, don't replace" but was specifically about preserving the
  `@AGENTS.md` import line in CLAUDE.md. The AGENTS.md file itself was
  a 5-line stub (not Vercel framework guidance, despite FOUND.2 log
  phrasing). Conscious replacement decided before commit; the new
  AGENTS.md follows the agents.md open standard rather than ad-hoc
  patterns.

- **Maintenance loop in its own file, referenced from CLAUDE.md.**
  Process metadata kept out of the contract; CLAUDE.md §11 is a brief
  pointer to `docs/maintenance.md` for the full audit cadence. Keeps
  CLAUDE.md focused on the contract rather than meta-process.

- **Critical-path classification is in CLAUDE.md §1, not the workflow
  doc.** Single source of truth. The workflow doc references the list
  rather than maintaining its own copy.

- **Plan-template filename is `_template.md` with leading underscore.**
  Keeps non-task files at the top of `docs/plans/` listing and
  visually distinct from real plans (which use `<TASK.ID>.md`).

- **Single combined commit, not five atomic commits.** All five files
  ship in one commit because the squash-merge collapses them anyway
  and the files form a coherent unit (the contract + the supporting
  docs it references). Five atomic commits would have been valid but
  added review-time overhead with no merge-time benefit.

- **Pre-format with Biome before commit.** `pnpm biome check . --write`
  ran before staging, then the verify chain re-confirmed clean. Avoids
  the "auto-fix as a separate commit" anti-pattern. Reported "No fixes
  applied" because Biome config skips Markdown — pattern still
  established for future code commits.

---

## Deviations from plan

- **Scope grew from "1 file" to "5 files."** Tracker entry for FOUND.4
  said only "extend CLAUDE.md." Once CLAUDE.md was being authored,
  AGENTS.md needed real content (the 5-line stub couldn't carry the
  framework-patterns role the contract referenced), and CLAUDE.md
  pointed to the workflow doc, maintenance doc, and plan template —
  all of which had to exist for CLAUDE.md to be coherent. All four
  supporting docs landed in the same PR rather than as follow-ups.

- **AGENTS.md replacement is technically a deviation from FOUND.2's
  "preserve @AGENTS.md" carry-forward note** — though the import line
  in CLAUDE.md was preserved, the AGENTS.md file itself was rewritten.
  Surfaced explicitly mid-chat before commit so the decision was
  visible, not silent.

- **Tracker description for FOUND.4 still says "Author CLAUDE.md and
  AGENTS.md content"** — accurate but doesn't reflect the four
  supporting documents shipped in this same PR. Tracker update needed
  (see follow-ups).

- **Subagent bodies, slash command bodies, hook scripts, and
  `.claude/settings.json` deferred to SCAFFOLD.10.** This was always
  the design, but it means the workflow doc and CLAUDE.md §5 reference
  files that don't yet exist on disk. Until SCAFFOLD.10 lands, those
  references are forward-pointing — anyone running the workflow before
  SCAFFOLD.10 must invoke subagent roles inline by referencing
  CLAUDE.md §5.

- **`docs/logs/_template.md` not separately authored.** The schema
  lives in CLAUDE.md §7 only. Tiny follow-up to extract it.

---

## Open items / follow-ups

### Blocking future technical work

- **SCAFFOLD.10 must land before the workflow becomes load-bearing.**
  The workflow doc references `@test-writer`, `@code-reviewer`,
  `@security-auditor` (subagents in `.claude/agents/`), `/plan`,
  `/new-market`, `/resolve`, `/audit-prep`, `/audit-core`, `/pr` (slash
  commands in `.claude/commands/`), and the four hook scripts in
  `.claude/hooks/`. None exist yet. SCAFFOLD.10 ships them all plus
  `.claude/settings.json` with model + effort baselines. Workflow
  failure mode without SCAFFOLD.10: invoking subagents inline by name
  in prompts, which works but loses the standardisation.

- **`docs/plans/<TASK.ID>.md` first instance** will be created on the
  first task that uses the workflow (likely an ENGINE.* task). Plan
  template exists; first plan validates the template by use.

### Non-blocking

- **`docs/logs/_template.md`.** Extract the §7 schema from CLAUDE.md
  into a standalone template file. ~30 lines. Tiny PR.

- **Tracker FOUND.4 description.** Either expand to reflect five files
  shipped, or split into FOUND.4a/b/c retrospectively. Either is fine;
  current state is just slightly under-described.

- **Project-knowledge sync.** Per the Project Knowledge Protocol's
  "missing" audit category: upload `plan-then-execute.md` to project
  knowledge (currently missing — only 4 of 5 FOUND.4 files present),
  re-upload any others that drifted from `main`, add this `Found-4.md`
  log once committed, delete the legacy `Experiment_Playbook.md` if
  still present (superseded by CLAUDE.md + AGENTS.md + workflow +
  maintenance).

- **Stale remote branches from FOUND.2 / FOUND.3 lifecycle.**
  `chore/editor-config`, `docs/add-chat-logs`, `docs/chat-0-log`,
  `docs/found-2-log`, `feat/found-2-scaffold`, `found-2-log`,
  `found-3-coc`, `found-3-license`, `found-3-log`, `found-3-security`.
  All squash-merged via PRs already; the branches outlived their PRs.
  Cleanup: `git push origin --delete <name>` per branch. Single
  housekeeping pass.

- **`gpg` not installed locally.** FOUND.3 follow-up #205 marked this
  as a blocker for `git log --show-signature`. Turned out to be moot —
  SSH-signing verifies via `ssh-keygen` natively when `gpg.format=ssh`,
  no `gpg` binary needed. Verified during FOUND.4 commit. Item can be
  closed unless something else surfaces a real `gpg` dependency.

- **iCloud `.next/` duplicate-suffix bug.** Did not trigger this time
  because no Next.js build artefacts touched the FOUND.4 commit. Still
  on the books for future code commits; workaround `just clean` if it
  surfaces.

- **First real maintenance audit.** Calendar trigger fires
  ~2026-05-12 (bi-weekly cadence, two weeks from FOUND.4 close) for
  the first standing review of CLAUDE.md and AGENTS.md. Phase-boundary
  trigger fires whenever FOUND phase closes (after FOUND.5 / FOUND.6
  if those exist; otherwise at SPEC.1 start).

---

## Context to carry forward

The contract is in place. CLAUDE.md is the authoritative project
contract; AGENTS.md is the stack guide following the agents.md open
standard; `docs/maintenance.md` encodes the feedback loop;
`docs/workflows/plan-then-execute.md` is the 2-tab procedure for
non-trivial tasks; `docs/plans/_template.md` standardises Phase 1
plan output. Together these five files are what every future Claude
Code session reads first.

The maintenance loop gives this docset a way to evolve. At every task
close, the question "Should CLAUDE.md, AGENTS.md, the workflow, or
the tracker change?" is now the closing ritual — the discipline is
asking the question, not necessarily changing anything. Phase
boundaries trigger full audits. Calendar bi-weekly catches slow drift
between triggers.

Critical-path code is named in CLAUDE.md §1: `src/server/markets/`,
`src/server/bets/`, `src/server/comments/`, `src/server/dharma/`,
`src/server/resolution/`, `src/server/auth/`, plus any DB migration
touching tables in those services. Tasks touching these qualify as
critical-path tasks and trigger the workflow's extra steps
(security-auditor, integration tests, 24h soak). Other tasks use the
2-tab workflow without the extras.

Engagement style is codified — Claude Code (and chat Claude) push
back rather than just agreeing. This was the most important
intervention in the contract: combats the LLM-sycophancy failure mode
as a design principle, not just a workflow prompt.

The workflow is unenforced infrastructure until SCAFFOLD.10 ships
subagent + slash-command + hook bodies. Until then, when running
ENGINE.* or DEBATE.1-3 tasks, invoke subagent roles inline by
referencing CLAUDE.md §5 verbatim in the Phase 2 prompt. Once
SCAFFOLD.10 lands, the workflow's `@subagent` references resolve
automatically.

Next: tracker reflects **FOUND.5** (Manifold reference clone), **FOUND.6**
(ADR 0001 — license choice), **FOUND.7** (README.md, public-facing repo
intro), and **FOUND.8** (ADR 0002 — experiment/protocol repo split).
FOUND.5–8 close out the foundation phase. After foundation phase
closes, **SPEC.1** opens as the first non-foundation task. No
non-trivial code lands before SPEC.1 per project refusal rules.
SCAFFOLD.10 lands somewhere between SPEC.1 and the first ENGINE.*
task — its exact placement to be confirmed when the SPEC phase
tracker is reconciled.

Two follow-ups deferred from FOUND.2 / FOUND.3 are also still on the
books and will route through FOUND.5–8 as appropriate: the Next.js
scaffold metadata sweep (`<title>Create Next App</title>` cleanup —
FOUND.7's territory now that it owns the public-facing surface), and
the smart-contract licensing decision (LGPL-3.0 vs AGPL-3.0 for
contract code) which must be resolved before SPEC.5 / ENGINE.1 and
will likely be ADR'd alongside FOUND.6 or as a separate ADR-0003.

The maintenance loop's first concrete test will be when FOUND.5 or a
SPEC task surfaces something that was assumed in this set of files
but turns out to be wrong. The "Core file updates needed?" question
in §7 of the task-log schema is the place that signal lands. If it
never fires across the next 5 tasks, the question itself is a
candidate for audit (either the docs are unusually correct, or nobody
is looking).
