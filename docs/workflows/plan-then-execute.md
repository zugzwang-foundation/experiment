# Workflow: Plan-then-Execute (2 tabs)

Two phases, two Claude Code tabs. Plan first, then execute. The fresh tab between is what makes the review independent and prevents the session that wrote the plan from defending it during execution.

---

## When to use

**Mandatory for:**

- All ENGINE.* tasks.
- All DEBATE.1–3 tasks.
- Any auth changes.
- Any database migration.
- Any change to a critical-path file (CLAUDE.md §1).
- Any task over 30 lines of diff or touching > 3 files.

**Skip for:**

- Typo fixes, comment edits, single-line tweaks.
- Documentation-only changes.
- Cosmetic refactors under 30 lines outside critical paths.

If you're not sure whether a task qualifies, it qualifies. The cost of running this workflow on a small task is one extra tab. The cost of skipping it on a thesis-touching task can be the experiment.

---

## Critical-path tasks get extra steps (still within the 2-tab structure)

Some code paths are catastrophic if broken — silent thesis violations are the worst class of bug because they don't trip alarms. CLAUDE.md §1 lists the critical paths. For tasks touching any of them, the workflow adds:

- **Phase 1 plan** must enumerate every thesis invariant the task touches, how each is preserved, and a test assertion proving it.
- **Phase 2** invokes `@security-auditor` after `@code-reviewer`.
- **Phase 2** runs `pnpm vitest run tests/integration/` in addition to the standard verification path.
- **After PR**: 24-hour soak before merge. Use the time to read the diff once more in a fresh tab the next morning. The wait catches bugs your morning brain finds that your evening brain missed.

For tasks NOT on critical paths, skip these extras. Don't bloat the workflow when the risk doesn't warrant it.

---

## Phase 1 — Plan (Tab 1)

Open Claude Code at the repo root:

```bash
cd ~/code/zugzwang/experiment
claude
```

Inside:

1. `/clear` (safety)
2. `/effort max` (verify with `/status`)
3. `Shift+Tab` until status bar shows **Plan mode**

Paste this prompt (substitute the task ID, title, and tracker description):

```
ultrathink

Task: <TASK.ID>
Title: <task title from tracker>
Tracker description: <paste from tracker, verbatim>
Critical-path? <yes/no — see CLAUDE.md §1>

Before you respond, read in this order:
1. CLAUDE.md (full)
2. AGENTS.md (full)
3. docs/specs/<relevant-spec>.md if one exists for this task
4. docs/logs/<predecessor-task>.md for the latest 1–2 dependency tasks

Do NOT just agree with me or accept the task framing as given. Be the
co-engineer who pushes back. If the task description is wrong, the
dependencies are wrong, the scope is too broad or too narrow, or the
approach you're being asked to take is suboptimal — say so BEFORE we
plan. Concretely:
- If the tracker description references a stale assumption, flag it.
- If a stated dependency isn't actually a dependency, flag it.
- If the task should be split into two, propose the split.
- If a different approach would be cleaner or safer, propose it and
  defend why.

Only once we've agreed the task framing is sound, interview me until
every category below is covered. Skip questions you can answer from
CLAUDE.md or AGENTS.md.

Categories:
1. Which thesis invariants (CLAUDE.md §2) are touched, and how each is
   preserved.
2. Data model changes — schema diffs, new tables/columns/indexes/
   constraints.
3. API surface — endpoints, Server Actions, route handlers.
4. UI / user flow — affected pages, states, transitions.
5. Failure modes — what can go wrong, how we detect, how we recover.
6. Edge cases — null states, race conditions, concurrent users,
   partial failures.
7. Test plan — unit/integration/e2e split, with specific assertions
   for each invariant touched.
8. Out-of-scope — what we are NOT doing in this task.

[Critical-path tasks only] Also enumerate every thesis invariant the
task touches, the test assertion proving the invariant holds, and the
failure mode if the assertion is missing.

When every category is covered, write the plan to
docs/plans/<TASK.ID>.md following the template at
docs/plans/_template.md.

Then critique the plan you just wrote. Don't be polite to yourself.
Where is it wrong? Where will it fall apart at runtime? What did I
(the human) say imprecisely or contradictorily? What invariants might
silently break? Output ranked findings, severity high/medium/low.

We iterate on the plan until it survives your own self-critique.
```

When the plan survives self-critique, commit it. The plan is now the contract for Phase 2:

```bash
git add docs/plans/<TASK.ID>.md
git commit -m "plan: <TASK.ID> — <short title>"
```

If Phase 2 later reveals the plan was wrong, **return to Phase 1 in a fresh tab** — do not quietly patch the plan during execution.

---

## Phase 2 — Execute (Tab 2)

Open a **NEW Claude Code tab** — not `/clear`. Independent context is what makes the review honest:

```bash
claude
```

Inside:

1. `/effort max` (verify with `/status`)
2. **Plan mode OFF** — `Shift+Tab` until status bar no longer says "Plan mode"

Paste:

```
ultrathink

Task: <TASK.ID>
Plan: docs/plans/<TASK.ID>.md
Critical-path? <yes/no — see CLAUDE.md §1>

Before doing anything, read CLAUDE.md, AGENTS.md, and the plan in full.

Do NOT just execute the plan if you spot something wrong with it. Be
the co-engineer who pushes back. If the plan is unclear, contradictory,
missing an obvious case, or proposes something that violates CLAUDE.md
— say so BEFORE writing code. Don't paper over plan gaps with code; if
the plan is wrong, we go back to Phase 1 in a different tab, not patch
it here.

Once you've confirmed the plan is sound, execute as follows. Stop and
wait if any step fails.

1. Invoke @test-writer. Have it write FAILING tests covering every
   scenario in the plan's test plan section, including assertions for
   each thesis invariant the plan flags.
2. Run the tests. Verify they fail (red). If they pass already, the
   test is wrong — fix it before continuing.
3. Implement the change. Stay strictly within plan scope.
4. Run the tests. Verify they pass (green).
5. Invoke @code-reviewer on the diff. Address findings.
6. [Critical-path only] Invoke @security-auditor. Address findings.
7. Run the standard verification path:
   - pnpm tsc --noEmit
   - pnpm biome check .
   - pnpm vitest run
   - pnpm build  (if app-level changes)
8. [Critical-path only] Run pnpm vitest run tests/integration/.
9. Stop. Report status.

STAY IN SCOPE. If you discover something else broken, write it to
claude-progress.md and STOP — do not "while we're here" in this
session. That is a hard rule. Open a separate task tomorrow.
```

When all green, open the PR:

```bash
gh pr create --fill
# or use the /pr slash command once SCAFFOLD.10 lands
```

**Critical-path PRs:** wait 24 hours before merge. Tomorrow morning, open one final fresh tab, paste the PR URL, ask for a final review. Then merge.

**Non-critical PRs:** open a final fresh tab, paste the PR URL, ask for a final review. Merge.

---

## Failure modes — stop and reset

- **Implementing in plan mode.** Plan mode is for planning, not editing. If you find yourself typing into `src/`, you're in the wrong mode.
- **Writing code in the same session as the plan was written.** That session is biased toward defending the plan it produced. Open a fresh tab.
- **Skipping Phase 1 because "this task is small."** If it qualifies for the workflow, it qualifies for both phases. The small tasks are where shortcuts get taken silently and the bug ships.
- **Patching the plan during Phase 2.** If the plan is wrong, go back to Phase 1 in a fresh tab. Don't quietly diverge.
- **Adding tasks during Phase 2 that weren't in the plan.** Note them in `claude-progress.md` and don't expand scope. "While we're here" is forbidden.
- **Skipping the 24-hour soak on critical-path PRs because the change "feels right."** That feeling is a session-confidence artifact, not a verification.

---

## Prerequisites

In your shell rc (`.zshrc` for macOS default):

```bash
export CLAUDE_CODE_EFFORT_LEVEL=max
export ANTHROPIC_MODEL="claude-opus-4-7"
```

In `.claude/settings.json` (committed to repo at SCAFFOLD.10):

```json
{
  "model": "opus",
  "effortLevel": "xhigh",
  "alwaysThinkingEnabled": true
}
```

The shell env var `CLAUDE_CODE_EFFORT_LEVEL=max` overrides settings.json `xhigh` on your machine. Settings.json provides the persistent `xhigh` fallback for any contributor who doesn't set the env var. `max` does not persist via settings.json — only via env var.

The `ultrathink` keyword is a habit, not a setting. Drop it as the first word in every coding-task prompt regardless of effort level.

---

*Workflow lives at `docs/workflows/plan-then-execute.md`. Referenced from CLAUDE.md §3 ("Plan before you write") and from `.claude/commands/plan.md` (a slash command landing at SCAFFOLD.10 that bootstraps Phase 1 with the prompt scaffold pre-filled with the task ID).*
