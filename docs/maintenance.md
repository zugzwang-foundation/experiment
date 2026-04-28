# Maintaining the core docs

How CLAUDE.md, AGENTS.md, the workflow, the templates, and the tracker stay current as the project evolves.

These files are living documents. They go stale faster than code does because conventions evolve, conventions get violated, and what was once true gets falsified by the work itself. Without an explicit update cadence, they become decorative — every session reads them, but none of them match reality.

This doc encodes the feedback loop. The audit is light, repeatable, and triggered by specific events. Not a calendar-driven policy you'll abandon by month two.

---

## What's in scope

| File | Why it drifts |
|---|---|
| `CLAUDE.md` | New invariants discovered, new subagent/command/hook added, new critical path emerges, decision log updates after ADRs |
| `AGENTS.md` | Framework conventions evolve (Next.js, Drizzle, Tailwind), new SAST findings change rules, ADRs change defaults |
| `docs/workflows/plan-then-execute.md` | Workflow misfires reported in task logs, new failure modes discovered |
| `docs/plans/_template.md` | Plans repeatedly miss something the template should prompt for |
| `docs/logs/_template.md` | Log entries repeatedly fail to capture what was needed |
| `zugzwang_experiment_tracker.html` (or wherever the tracker lives) | Task completion (continuous); occasional reorgs |
| `.claude/agents/*`, `.claude/commands/*`, `.claude/hooks/*` | When the subagent/command/hook itself changes |

---

## When to audit — five triggers

Run an audit on one or more of the files above when ANY of these happen:

1. **A task discovers drift.** A task log's "Core file updates needed?" section flags that something is wrong. Don't defer — fix the same week, ideally as part of the task PR.
2. **A phase ends.** At the end of each tracker phase (FOUND, SPEC, SCAFFOLD, ENGINE, DEBATE, UI, HARDEN, LAUNCH, LIVE): full audit pass on CLAUDE.md and AGENTS.md.
3. **An ADR is accepted.** If the ADR changes a default in CLAUDE.md §10 (Decision log), update §10. If it changes a coding convention, update AGENTS.md.
4. **A new subagent / slash command / hook is added.** Update CLAUDE.md §5.
5. **Calendar: every two weeks regardless.** Standing 30-minute review of CLAUDE.md and AGENTS.md, even if nothing else triggered an audit. Catches slow drift the other triggers miss.

---

## How to audit — process

In a fresh Claude Code tab. **Not** a session you've been working in (same bias problem as writer/reviewer in the same session).

1. `/effort max`
2. Plan mode ON (`Shift+Tab`)
3. Paste:

```
ultrathink

Audit this file: <path to file, e.g. CLAUDE.md>

Read it. Then read the last 10 task logs in docs/logs/. Then look at
the tracker for what's been completed since the file's "Last revised"
line.

Find:
1. Stale references — file paths that don't exist, subagent names
   that changed, slash commands that don't match what's in .claude/,
   ADR numbers that have been renumbered.
2. Stale conventions — rules that were violated by recent merged PRs
   (the rule is wrong, or the PR is wrong; either way, surface it).
3. Missing additions — patterns that have emerged in the codebase
   or in recent logs but aren't documented in this file yet.
4. Contradictions — sections that disagree with each other or with
   sibling files (CLAUDE.md vs AGENTS.md vs the workflow doc).
5. Bloat — sections that no longer apply or duplicate content
   elsewhere.

Output: ranked findings, severity high/medium/low. For each finding,
propose a concrete edit — the exact text to add, remove, or change,
with line numbers if you can identify them.

Do not just agree the file looks fine. Be the reviewer who finds
problems. If you genuinely find none after a careful read, say so
explicitly and explain what you checked.
```

4. Triage findings: apply, defer, or reject each.
5. Apply approved changes as a PR titled `docs: <file> audit pass YYYY-MM-DD`.
6. Update the "Last revised" line at the bottom of the file.
7. If multiple files need updating from the same audit, ship them as one PR — they're often coupled (e.g., a new subagent affects CLAUDE.md §5, AGENTS.md, and `.claude/agents/`).

---

## Self-improvement vs. self-currency

Two distinct goals the loop serves, often confused:

- **Currency** = "the file matches reality today." Stale references, broken paths, renumbered ADRs. Most audit findings.
- **Self-improvement** = "the file is *better* than it was a month ago, because patterns from the work got incorporated." New rules, sharper invariants, examples drawn from real failures.

Audit finding type 3 ("Missing additions — patterns that have emerged but aren't documented") is the self-improvement mechanism. After three months of running tasks, the workflow doc should have a "Failure modes" section that's twice as long as the one we shipped at FOUND.4 — because real failures will have surfaced and gotten codified.

If the audit only ever finds currency issues and never improvements, the loop is half working. Push the prompt harder on type 3.

---

## Anti-patterns

- **Updating reactively without a trigger.** Random edits without a precipitating change produce noise and erode the file's authority. Wait for a trigger.
- **Auditing in the same session that produced the recent work.** Session bias defends what was just written. Use a fresh tab.
- **Treating the tracker as canonical when CLAUDE.md disagrees.** CLAUDE.md is the contract. The tracker is task state. If they conflict, the tracker entry is what gets fixed (lower-cost; the contract should evolve more deliberately).
- **Auditing every file every two weeks.** The cadence is per-file, not blanket. The table below specifies.
- **Approving every audit finding.** Some findings are right; some are reviewer over-reach. Triage.

---

## Closing ritual for every task chat

Every task chat — including this one — ends with one question:

> **Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this task?**

Three answer shapes:

- **"None."** Most tasks. Default. Don't invent updates that aren't real.
- **"Small fix."** Specific line / section / template entry that needs editing. File the change as part of this task's PR, not as a follow-up. (Follow-ups never happen.)
- **"Meaningful update."** Pattern, rule, or convention emerged. Surface it explicitly, propose the change, get approval, ship as part of the task's PR or its own audit-pass PR.

The discipline is *asking the question*, not necessarily changing anything.

---

## File-by-file audit cadence

| File | Trigger sources | Default audit cadence |
|---|---|---|
| `CLAUDE.md` | All five triggers above | Phase boundaries + bi-weekly |
| `AGENTS.md` | ADRs, framework updates, new conventions | Phase boundaries + bi-weekly |
| `docs/workflows/plan-then-execute.md` | Workflow misfires reported in task logs | Phase boundaries |
| `docs/plans/_template.md` | Plans repeatedly missing something | Quarterly |
| `docs/logs/_template.md` | Log entries failing to capture what's needed | Quarterly |
| `zugzwang_experiment_tracker.html` | Task completion (continuous); reorgs (rare) | Continuous (per task close) |
| `.claude/agents/*`, `.claude/commands/*`, `.claude/hooks/*` | When the underlying file changes | As needed |
| This file (`docs/maintenance.md`) | Audit process itself misfires | Quarterly |

Yes, this file gets audited too. The loop checks itself.

---

*Last revised in FOUND.4 (Apr 28, 2026).*
