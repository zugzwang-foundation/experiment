# CLAUDE.md

> **Read in full at the start of every session.** This is the contract between Claude Code and Zugzwang. If anything here conflicts with what you think you know, this file wins. Stack and framework patterns flow through the import below.

@AGENTS.md

---

## 1. Project frame

The **Zugzwang Experiment** — a CPMM prediction market with mandatory commentary and soulbound reputation (Dharma). Web2 only. Live 15 Sep – 5 Nov 2026; concludes 6 Nov at Devcon 8 Mumbai.

- **Repo scope:** pure web2. **No blockchain. No smart contracts. No tokens.** Dharma is a Postgres `NUMERIC(38,18)` column. Testnet and Mainnet phases get their own repos.
- **Source of truth.** Hierarchy: `docs/specs/SPEC.1.md` (product), `docs/specs/SPEC.2.md` (technical), `docs/adr/0003–0016.md` (decisions), `AGENTS.md` (stack patterns). When this file disagrees with code, this file wins until updated by an ADR.
- **License.** AGPL-3.0-or-later. AGPL §13 forecloses closed-source SaaS forks.

### Critical paths (trigger writer/reviewer ritual + invariant test gate + same-commit ADR scan + pre-PR self-audit + task-appropriate reviewer call)

- `src/server/bets/`, `src/server/comments/`, `src/server/dharma/`, `src/server/resolution/`
- `src/server/auth/`, `src/server/identity/`, `src/server/moderation/`
- `src/db/schema/`, `drizzle/migrations/`, `supabase/migrations/`

---

## 2. The four hard-locked invariants

Encoded in SPEC.1 §5. Tests at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts`. Triggers at `drizzle/migrations/<NNNN>_append_only_triggers.sql` — storage-layer ground truth, not application advisory.

| ID | Rule | Mechanism |
|---|---|---|
| INV-1 | Bet ↔ comment atomicity | SERIALIZABLE transaction wraps both inserts (ADR-0013) |
| INV-2 | Dharma non-transferable; no overdraft | Append-only `dharma_ledger`; no `dharma_transfer` table by design; `CHECK (balance_after >= 0)` at storage layer |
| INV-3 | Comments side-bound at post-time | `comments.side_at_post_time` immutable post-INSERT (SPEC.2 §6) |
| INV-4 | Resolutions append-only | `resolution_events` + `payout_events` immutable post-INSERT (SPEC.2 §6) |

**Refuse to weaken any of these** — including "just for testing", "temporary admin override", "while we're cleaning up". State the invariant, the violation, propose an alternative, stop.

---

## 3. Refusal triggers

Treat as `REFUSAL:` — surface and stop, do not silently work around.

- **Dharma transferability.** No "send Dharma" or user-↔-user transfer endpoint, ever. Admin pool seeding is account-↔-pool only.
- **Mandatory commentary.** No bet without a comment. `bets.comment_id NOT NULL` with FK; the entry comment is INV-1.
- **Admin participation.** Admin has no `users` row. No `users.role` column, no `is_admin` boolean, no runtime check. Structural separation by data-model.
- **Market content invention.** Market questions, resolution criteria, settlement dates are Hrishikesh's calls. Skills scaffold the form; they do not write market copy.
- **Social content invention.** Brand posts quote user content verbatim with pseudonym attribution. AI generates the frame; never the user's argument.
- **K_eff in-product surface.** No live dashboard, no matview, no admin chart. K_eff(t) is derived post-hoc from the 2026-11-06 public dataset only.
- **Conclusion-freeze tampering.** The 2026-11-05 23:59 UTC write-freeze is `system_state.frozen_at`. No bypass path. Recovery is `BREAK_GLASS.md`-only.
- **HTTP inside a DB transaction.** Never `await openaiModerate(...)` or any external HTTP inside `db.transaction(...)`. Run externals first, pass results in (SPEC.2 §10 + ADR-0014).

---

## 4. Engagement style — push back, don't sycophant

The dominant failure mode of coding assistants is sycophancy: human asks, model agrees, model executes, problem ships that the human would have caught if asked. Compounded across tasks, the codebase becomes subtly wrong in ways the human cannot see.

**Before agreeing:**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If the framing is wrong (wrong file, wrong assumption about how a system works), correct first.
- If you don't know whether the framing is right, say so. Guessing is worse than admitting uncertainty.

**Push back when:**

- A task references a stale file, ADR, tracker entry, or memory edit.
- A stated dependency is not actually a dependency.
- The ask is X but Y solves the actual problem — propose Y and defend.
- A planned approach violates an invariant (§2) or triggers a refusal (§3).
- A simpler approach exists. Say so.

Pushback is **not** disagreement for its own sake, refusing a valid approach for a different valid approach, or lecturing on first principles already understood.

---

## 5. Workflow rules

### 5.1 Plan mode

Use `/plan` for any task touching critical paths (§1), any task without an existing approved `docs/plans/<TASK-ID>.md`, or any work >30 lines / >3 files.

In `/plan`: read, draft plan, surface uncertainties as questions, **no edits**. Plan reviewed in Claude Code (Hrishikesh confirms), then pasted to web Claude chat for sign-off. Only then exit and execute.

Plan file lives at `docs/plans/<TASK-ID>.md` inside the repo, **not** at `.claude/plans/<scratch>.md`. The plan file is the contract Phase 2 references via `@docs/plans/...` It must be committed before Phase 1 ends.

Trivial work skips: file moves, dep bumps, doc-only edits, hot-fixes already agreed.

If about to write code without an approved plan, **stop and surface**.

### 5.2 Simplicity first

- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite.

Test: would a senior engineer call this overcomplicated? If yes, simplify.

### 5.3 Surgical changes

- Touch only what the task requires.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Clean up orphans YOUR changes created. Don't delete pre-existing dead code unless asked.

Every changed line traces directly to the user's request.

### 5.4 Stay in scope (task-level)

Task is `src/server/bets/`? Do not touch `src/server/comments/`. Open a separate task. "While we're here" is how solo-dev codebases die.

### 5.5 Read before writing

Read the file you're about to edit in full, plus its types, schemas, and callers. Do not guess imports.

### 5.6 Tests before implementation (thesis-touching code)

For bet placement, Dharma accounting, comment attachment, side assignment, resolution, media upload, moderation, CSAM detection: failing tests first via a `test-writer` reviewer call (per §5.11), then implement, then a `code-reviewer` reviewer call.

§5.6 applies to **business logic**. Type-only declarations (schema files, type aliases, interfaces) and configuration changes are exempt — the type-check is the gate.

### 5.7 Verify before claiming done

Run `just verify`. Critical-path tasks additionally run `pnpm test:invariants` and `pnpm test:integration`. Don't claim done before they pass.

### 5.8 Session boundaries

Use `/clear` (not `/compact`) between distinct units of work:

- Between strata of a multi-stratum task
- After a PR is merged before the next task begins
- When context drifts
- At the start of every new Claude Code session paired with a new web Claude chat

Do NOT `/clear` mid-task. Finish to a clean PR boundary first.

### 5.9 Per-session logs

Every session ends with a log entry at `docs/logs/<TASK-ID>.md`. No exceptions.

Write BEFORE `/clear`, BEFORE disconnecting Remote Control, BEFORE walking away. Not at task close only — every session.

Six fields: **What landed** (files + PR#), **Decisions made** (variances, amendments, carve-outs), **Open questions**, **Next session starts at** (exact next action), **Context to preserve** (non-obvious state), **Time** (optional).

Log ships in its own commit on the branch BEFORE the PR opens. Convention: `chore(<scope>): log session — <stratum> <state>`.

If a session ends without a log, the next session starts blind. **Most expensive failure mode.**

### 5.10 Pre-PR self-audit

Critical-path PRs (per §1) run a self-audit inside the execute session **BEFORE** `gh pr create`. The author surface verifies its own work against the plan, item by item, while context is still loaded.

The audit walks the plan's per-table / per-component inventory and verifies actual code matches the plan. Format:

- **PASS** — item present, correct, matches plan
- **FAIL** — item wrong or missing; fix in-session before continuing
- **SURPRISE** — unexpected finding not predicted by plan; surface to Hrishikesh

What to verify (task-dependent — kickoff prompts list specifics):

- **Schema work:** every column name, type, nullability; every FK + index; every enum value set; every bucket classification; every same-commit spec amendment (grep verification)
- **Server work:** every handler against the plan's API surface; every invariant the plan flags + the assertion that proves it holds
- **Migration work:** ordering, idempotency, trigger SQL correctness, partition DDL, singleton constraints

The audit is run by the Phase 2 execute surface (same Claude Code session that wrote the code). It is NOT a reviewer-call step — §5.11 covers reviewer-call review separately.

PR opens only after audit reports clean. FAIL items fix in-session, re-verify, then PR. SURPRISE items surface for Hrishikesh's decision.

Non-critical-path PRs skip the audit (still run `just verify`).

Verification is left-shifted into write-time, where context is loaded and fixes are cheap. There is no post-PR soak — audit at write-time is stronger.

### 5.11 Reviewer-call invocation

The Claude Code `Agent` tool exposes only built-in agent types (`general-purpose`, `Explore`, etc.) — the named project review roles (`code-reviewer`, `db-migration-reviewer`, `security-auditor`, `test-writer`) are NOT auto-discoverable. Project roles live as **role briefings** at `.claude/agents/*.md`. A "reviewer call" is a fresh-context `general-purpose` Agent invocation with the role briefing baked into the prompt, plus the plan path, plus tool-scope constraints. The §6 catalogue names which briefing routes to which work type.

**Critical-path invocation policy** (after pre-PR self-audit passes, before `gh pr create`):

| Work type | Role briefing | Phase | Tool scope (enforce via prompt) |
|---|---|---|---|
| `src/db/schema/` or `drizzle/migrations/` | `db-migration-reviewer` | Phase 2 post-audit | Read-only |
| `src/server/` changes | `code-reviewer` | Phase 2 post-audit | Read-only |
| Critical-path business logic | `security-auditor` | After code-reviewer | Read-only |
| New business-logic behavior | `test-writer` | Phase 2 start (tests-first per §5.6) | Read + Write tests only (no `src/` edits) |

**Three required prompt elements** for every reviewer call:

1. **Explicit role briefing** — name the role and point at `.claude/agents/<role>.md`; instruct the agent to load it and follow it verbatim.
2. **Plan path** — `@docs/plans/<TASK-ID>.md`. Without it, the call re-explores the codebase from scratch — expensive and noisy.
3. **Tool-scope constraints** — the briefing's tool scope enforced in the prompt body (e.g., "Read, Grep, Glob, Bash only — do not Edit or Write"). The `general-purpose` agent has full tool access by default; the prompt must constrain it.

**Findings:**
- FAIL findings within scope → fix in-session before PR
- SURPRISE findings outside scope → write to `claude-progress.md` and STOP (do not silently expand scope)

**When NOT to invoke a reviewer call:**
- Tightly coupled work spanning schema + server + UI + tests in one pass (separate calls lose shared intent; stay in main session)
- Non-critical-path work (file moves, dep bumps, doc edits)
- Type-only declarations (the type-check is the gate)

### 5.12 ADRs

One ADR per architectural change at `docs/adr/<NNNN>-<slug>.md` in the same commit as the implementation. Template at `docs/adr/_template.md`.

### When to use `ultrathink`

First word of every coding-task prompt. Mandatory for: CPMM pricing math, Dharma accounting, resolution payout math, side-freezing semantics, cross-service state machines, auth choices, moderation failure modes, ADR drafting, CLAUDE.md / AGENTS.md audits.

---

## 6. Review roles, skills, hooks

**Review roles** are role briefings at `.claude/agents/*.md`, invoked per §5.11 as fresh-context `general-purpose` Agent calls. They are NOT auto-discovered runtime subagents — the Claude Code runtime exposes only built-in agent types. Each briefing names its checklist, output format, and tool-scope expectations; §5.11's invocation policy table names which work types route to which briefing.

- **`code-reviewer`** — reviews diffs under `src/server/` for invariant violations (§2), missing error handling, and refusal triggers (§3). Returns findings as CRITICAL / HIGH / MEDIUM / LOW with `file:line` references. Briefing tool scope: Read, Grep, Glob, Bash. Briefing file: `.claude/agents/code-reviewer.md`.

- **`db-migration-reviewer`** — reviews changes under `src/db/schema/` or `drizzle/migrations/` against SPEC.2 §5 inventory; verifies FK lambdas, indexes per AGENTS.md §6, Bucket A/B/C classifications, and append-only trigger SQL. Returns PASS / FAIL / SURPRISE per table. Briefing tool scope: Read, Grep, Glob, Bash. Briefing file: `.claude/agents/db-migration-reviewer.md`.

- **`security-auditor`** — reviews critical-path work (per §1) for INV-1 / INV-2 / INV-3 / INV-4 enforcement gaps, auth bypasses, moderation pipeline exploitability, and admin-surface separation. Returns findings ranked by exploitability with concrete attack scenarios. Briefing tool scope: Read, Grep, Glob, Bash. Briefing file: `.claude/agents/security-auditor.md`.

- **`test-writer`** — writes FAILING tests FIRST for new business-logic behavior per §5.6 against the plan's test plan section. Briefing forbids edits to `src/`. Returns test files + coverage map. Briefing tool scope: Read, Write, Edit (tests only), Bash, Grep, Glob. Briefing file: `.claude/agents/test-writer.md`.

**Skills:** auto-discovered from `.claude/skills/<name>/SKILL.md` at session start.

**Hooks:** `block-destructive.sh` (rm -rf, force-push, DROP TABLE), `block-main-commits.sh`, `format-and-typecheck.sh` (Biome + tsc post-edit), `session-start.sh` (recent commits + open PRs).

---

## 7. Maintaining this file

CLAUDE.md, AGENTS.md, ADRs, SPECs go stale faster than code. Audit triggers: drift discovered, phase ends, ADR accepted, new role briefing / skill / hook, bi-weekly. Process at `docs/maintenance.md`.

**Closing ritual** for every task: "Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this session?" Most: no. The discipline is asking. If yes, file in the same PR — never as a follow-up. Follow-ups never happen.

### Decision log

- **2026-05-14:** VISUAL phase minted (8 DESIGN.* tasks, runs parallel to ENGINE). Tracker v7 absorbs the phase. SPEC.13 retained as pointer to DESIGN.8 producer. See project-knowledge close-out log (chat_close_2026-05-14_visual-phase-mint_v7-tracker).

### Cleanup absorption rule

Drift fixes — config tweaks, doc updates, stale-reference replacements, convention codifications, naming inconsistencies — are absorbed by the stratum that surfaces them, in the same PR, before merge.

Forbidden:

- Deferring drift to a future "PRECURSOR-N" or "cleanup sweep" task.
- Accumulating backlogs across multiple strata for batch resolution.
- Treating per-stratum cleanup as overhead rather than as part of the stratum's close-out ritual.

Permitted:

- In-stratum absorption of drift items that take <2 hours per item.
- For drift items that genuinely require >2 hours (architectural decisions, multi-file coordinated edits), mint a real task with its own kickoff. Not a backlog row.
- Parking items genuinely out-of-scope for any current task (e.g., "engage lawyer mid-July 2026 HARDEN.7") in `docs/parked.md`.

PRECURSOR.5 (this PR) is the last PRECURSOR-N task. Future drift rolls into the stratum that surfaced it.

---

## 8. Closing rule

**Refuse to weaken the four invariants (§2). Refuse the project triggers (§3). Push back before agreeing (§4). Stay in scope, simplify, log every session, audit before PR (§5). If anything in this file is wrong, fix it before fixing the code.**

*Last revised PRECURSOR.5 (May 14, 2026) — subagent → reviewer-call reframe per §5.11 + §6 (`.claude/agents/*.md` role briefings invoked via fresh-context `general-purpose` Agent calls, not auto-discovered); decision log + cleanup absorption rule added at §7. Against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft + ADRs 0003–0016. Maintained per `docs/maintenance.md`.*
