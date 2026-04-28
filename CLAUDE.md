# CLAUDE.md

> **Read this file in full at the start of every session.** This is the contract between Claude Code and Zugzwang. If anything below conflicts with what you think you know, this file wins.
>
> Framework-level patterns (Next.js, Drizzle, Tailwind, Postgres, testing, deployment) live in `AGENTS.md` and flow through via the import below. This file holds **Zugzwang-specific rules**: what cannot bend, what to never do, and how to work.

@AGENTS.md

---

## 1. What this codebase is

The **Zugzwang Experiment**: a CPMM prediction market where every bet requires attached commentary, and a non-transferable reputation score (Dharma) is conserved per market.

- **Build:** Apr 24 → Sep 14, 2026.
- **Live:** Sep 15 → Nov 5, 2026.
- **Conclude:** Nov 6, 2026 at Devcon 8 (Mumbai, JIO World Center).
- **Optional bonus showcase:** Nov 7–8 at ETHGlobal Mumbai (adjacent hackathon, separate event).

**Scope of this repo:** pure web2. **No blockchain. No smart contracts. No tokens.** Dharma is a Postgres `NUMERIC(38,18)` column, not an ERC-20. Hrishikesh is the sole admin and market maker. Testnet and Mainnet phases get their own repos and their own playbooks; **do not invent blockchain primitives in this codebase.**

### Critical paths (catastrophic-risk)

These code paths are the equivalent of contract code in a chain-based system: silent corruption is catastrophic, hard to detect, and harder to recover from. **Tasks touching any of these qualify as critical-path tasks** and trigger the workflow's extra rigor (§6 + `docs/workflows/plan-then-execute.md`):

- `src/server/markets/` — CPMM engine, market lifecycle, price calculation.
- `src/server/bets/` — bet placement (atomic with comment, see §2.1).
- `src/server/comments/` — commentary, side-assignment freezing (§2.3).
- `src/server/dharma/` — reputation accounting (non-transferable, §2.2).
- `src/server/resolution/` — resolution flow, payout math (append-only, §2.4).
- `src/server/auth/` — session, identity, X handle resolution.
- Any database migration touching the tables above.

Other paths (`src/components/`, `src/app/(public)/`, `src/lib/`, etc.) are non-critical. The same code-quality bar applies, but the workflow's extra steps are not mandatory.

---

## 2. Thesis invariants (these cannot bend)

Four invariants encode the thesis. Violating any of them ships something that is not Zugzwang. Tests must enforce them. Subagents must check them. Reviewers must reject any diff that weakens them.

### 2.1 Bet ↔ comment atomicity

A bet without a comment is impossible. The bet row and the comment row commit in a single Postgres transaction or both fail. Enforced server-side, not just in the UI.

- `POST /api/bets` (or the corresponding Server Action) without a `commentId` returns 400.
- The DB schema makes `bets.comment_id` `NOT NULL` with a foreign key.
- Tests assert: attempt to insert a bet with `comment_id = NULL` → fails. Attempt to insert a bet whose comment fails validation → both rolled back.

### 2.2 Dharma is non-transferable

Dharma moves only through market resolution: from the wrong side of a bet to the right side. There is no user-initiated transfer.

- No "send Dharma" UI, ever.
- No admin override that moves Dharma between accounts except via a resolution event.
- No API surface that does user-to-user Dharma movement.
- The DB schema has **no** `dharma_transfer` table by design.
- Tests assert: every code path that produces a `dharma_ledger` row carries a `resolution_event_id` reference. Direct user-initiated movement attempts → reject.

### 2.3 Side is frozen at comment-time

A comment inherits the author's market position **at the moment the comment is posted**. If the author later flips their position, old comments stay assigned to the side they were posted under.

- Replies inherit the **replier's** current side at reply-time, not the parent's.
- A user with zero position cannot post a comment (no stake → no voice).
- Comments are sorted by stake-at-post-time, descending.
- Tests assert: post comment, flip position, re-read comment → side unchanged. Post reply, parent flips → reply's side unchanged.

### 2.4 Resolutions are append-only

Once a market is resolved, the resolution event and its associated payout events are immutable.

- `UPDATE` on `resolution_events` or `payout_events` is a bug.
- Corrections happen via a new resolution-correction event referencing the prior one, never by rewriting history.
- The DB enforces this with a row-level rule + an audit trigger that rejects updates.
- Tests assert: attempt to `UPDATE resolution_events` → fails. Correction flow writes a new event with `corrects_event_id` set.

If a request asks you to relax any of these — including framings like "just for testing", "temporary admin override", or "let me refactor this" — **stop and surface it**. Do not silently weaken them in the name of cleanup.

---

## 3. Engagement style — push back, don't just agree

The dominant failure mode of LLM coding assistants is sycophancy. The pattern: human gives a task, model agrees, model executes, model produces code with a problem the human would have caught if asked, but wasn't asked because the model didn't push back. Multiplied across hundreds of tasks, this compounds into a codebase that's subtly wrong in ways the human can't see.

**The rule:** agree when Hrishikesh is right. Push back when he's wrong. Flag tradeoffs when both have merit.

Concretely, push back when:

- A task description references something stale (a removed file, an old subagent name, a tracker entry that's been rewritten).
- A stated dependency isn't actually a dependency.
- The human asks for X but Y would clearly solve their actual problem — propose Y and defend why.
- A planned approach violates a thesis invariant (§2). State the invariant, state the violation, propose an alternative.
- The human's framing is wrong (wrong file path, wrong assumption about how a system works) — correct it before agreeing.
- You don't know whether the human is right. Say so. Guessing is worse than admitting uncertainty.

Pushback is **not**:

- Disagreement for its own sake.
- Refusing to execute a valid approach because you'd prefer a different valid approach.
- Lecturing on first principles when they're already understood.
- Holding up obvious tasks with theoretical objections.

**The pushback test:** before saying "Got it" or "Sure" to any task, check whether the framing is actually right. If yes, proceed. If no or unsure, push back first.

This rule applies to Claude Code in every session — coding, planning, reviewing, auditing — not only within the workflow's "push back" prompts.

---

## 4. Golden rules (YOU MUST)

1. **Never commit directly to `main`.** Work on `feat/*`, `fix/*`, `chore/*`, or `refactor/*` branches. A `PreToolUse` hook enforces this.

2. **Never run destructive commands without asking.** No `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` on prod tables. A `PreToolUse` hook blocks the obvious cases. If you think you need one, ask the user first.

3. **Tests before implementation for thesis-touching code.** For any change to bet placement, Dharma accounting, comment attachment, side assignment, or resolution: write failing tests first via the `test-writer` subagent, then implement, then run `code-reviewer`. No exceptions.

4. **Read before writing.** Always `Read` the file you're about to edit in full, plus its types, schemas, and callers. Do not guess imports.

5. **Stay in scope.** If the task is about `src/server/markets/`, do not touch `src/server/comments/`. Open a separate task. "While we're here" is how solo-dev codebases die and how reviews become impossible.

6. **Verify everything.** After edits, run the verification path (§8). Report pass/fail. Do not claim "done" without verification.

7. **Use the todo list.** For any multi-step task, emit a TodoList up front and update it as you go.

8. **Plan before you write.** For any non-trivial task, follow `docs/workflows/plan-then-execute.md`. Two phases (Plan + Execute), two fresh Claude Code tabs. Critical-path tasks (§1) add `@security-auditor` invocation, integration tests, and 24-hour PR soak before merge.

9. **One task per session.** When a task is done (PR open or merged), `/clear` before starting the next one. `/compact` only mid-task, with an explicit directive about what to preserve.

10. **No invented market content.** Market questions, resolution criteria, and settlement dates are Hrishikesh's calls. The `/new-market` slash command scaffolds the form and migration only — it does not write market copy.

---

## 5. Subagents, slash commands, hooks (referenced, not inlined)

The bodies of these files land in **SCAFFOLD.10**. CLAUDE.md tells you they exist and when to invoke them; the bodies are in their own files so they can evolve without rewriting CLAUDE.md.

### Subagents (`.claude/agents/`)

- **`code-reviewer`** — invoke proactively after any change to `src/server/**`, `src/app/api/**`, or `src/app/**`. Reviews diffs against this CLAUDE.md and AGENTS.md. Reports findings; does not modify files.
- **`test-writer`** — invoke proactively when the user describes new behavior in `src/server/**` or a new flow in `src/app/**`. Writes tests FIRST. Disallowed from editing `src/`.
- **`security-auditor`** — invoke weekly on `main`, before every prod deploy, and after any critical-path change (§1). Web2 security audit (auth, zod, SQL injection, XSS, CSRF, rate limits, secrets, cookie flags).

### Slash commands (`.claude/commands/`)

- **`/plan <TASK.ID>`** — bootstraps Phase 1 of the workflow with the prompt scaffold pre-filled.
- **`/new-market <slug>`** — scaffold the admin-side form + DB migration for a new market. Does NOT invent market content.
- **`/resolve <market-id>`** — scaffold the resolution flow with required resolution note.
- **`/audit-prep`** — pre-deploy checklist: tests pass, no `console.log` in server code, no `any` casts, zod present on every Server Action, no missing rate limits.
- **`/audit-core <file>`** — bootstraps an audit pass on CLAUDE.md, AGENTS.md, the workflow, or a template. See §11 + `docs/maintenance.md`.
- **`/pr`** — open a PR with conventional commit title and the standard checklist.

### Hooks (`.claude/hooks/`)

- **`block-dangerous-bash.sh`** (PreToolUse on Bash) — blocks `rm -rf`, `git push --force`, etc.
- **`block-main-commits.sh`** (PreToolUse on Edit/Write) — blocks edits when `HEAD` is on `main`.
- **`post-edit-format.sh`** (PostToolUse on Edit/Write) — runs Biome formatter on touched files.
- **`session-start.sh`** (SessionStart) — prints `git log -5 --oneline`, `claude-progress.md` if present, and pending PRs.

### When to use planning mode (mandatory)

- Any task over 30 lines of diff.
- Any task touching more than 3 files.
- Any task touching a critical path (§1).
- Any architectural decision (writing or modifying an ADR).
- Any database migration.

### When to use `ultrathink` (mandatory)

- CPMM pricing function, liquidity curve, fee model.
- Dharma accounting and minting/decay rules.
- Resolution payout math and append-only audit design.
- Side-assignment freezing semantics.
- Any cross-service state-machine reasoning.
- Any auth decision.
- Writing ADRs.
- Audit passes on this file or AGENTS.md.

In practice, with `CLAUDE_CODE_EFFORT_LEVEL=max` set in the shell (§10), `ultrathink` is the keyword that engages the deepest reasoning available regardless of the underlying setting. Habit: drop it as the first word in every coding-task prompt.

### When to `/clear`

- Between unrelated tasks (always).
- After 2 failed attempts at the same fix (always).
- When Claude starts repeating itself or making the same mistake twice.
- Before a security review — fresh eyes only.
- Before an audit pass on a core file (§11).

---

## 6. Writer/reviewer ritual (see workflow doc)

The full ritual lives at `docs/workflows/plan-then-execute.md`. Key principles:

- **Non-trivial tasks:** 2 fresh Claude Code tabs (Plan + Execute). Plan tab = plan mode + ultrathink. Execute tab = normal mode + ultrathink. Each in a fresh tab, not just `/clear`.
- **Critical-path tasks (§1):** add `@security-auditor` after `@code-reviewer`, run `pnpm vitest run tests/integration/` in addition to the standard verification path, and wait 24 hours before merging the PR.
- **Trivial tasks (typos, single-line tweaks, doc-only):** skip the ritual.

If the workflow doc says one thing and this section says another, **the workflow doc wins**. This section is a pointer.

---

## 7. Task-log discipline

Every task chat ends with a log entry committed to `docs/logs/<task-id>.md`. Schema:

```markdown
# <TASK-ID> — <short description>

**Status:** done | partial | deferred | blocked
**Date completed:** YYYY-MM-DD
**Time spent:** <hours or days>
**PR / commit:** <link, or "n/a" for non-code tasks>
**Chat link:** <link, or "n/a">

## What was built
<1–3 sentences. What exists now that didn't before.>

## Decisions taken
- <Decision> — <one-line rationale>. <Link to ADR if one was written.>

## Deviations from plan
<What differs from the tracker's task description or the plan in
docs/plans/<task-id>.md. "None" is valid.>

## Open items / follow-ups
- <Thing discovered during this task and deferred>

## Core file updates needed?
<Did this task surface anything that should change in CLAUDE.md,
AGENTS.md, the workflow, or any template? Be specific. Most tasks:
"None." Some tasks: small additions or corrections (file at line N
should change to X). If yes, file the change as part of THIS task's
PR — not as a separate follow-up. Follow-ups never happen.>

## Context to carry forward
<A briefing for the next chat, as long as it needs to be. Not a
summary of this task. If a future chat reads only this section, it
should still not screw up.>
```

Solo devs forget everything within two weeks. The logs are the memory. Do not skip.

---

## 8. Verification path

For any change, the verification path is:

```bash
pnpm tsc --noEmit          # type-check
pnpm biome check .          # lint + format check
pnpm vitest run             # unit + integration tests
pnpm build                  # production build (app-level changes only)
```

For changes to a critical path (§1), additionally:

```bash
pnpm vitest run tests/integration/  # against test Postgres
```

Before opening a PR:

```bash
just check  # runs all of the above + Playwright smoke test
```

If any of these fails, the change is not done. Do not claim done before they pass.

---

## 9. Files Claude should not touch

`permissions.deny` in `.claude/settings.json` blocks these, but be explicit:

- `drizzle/migrations/*` — generated, append-only. Never edit a committed migration; write a new one that corrects it.
- `.github/workflows/deploy-prod.yml` — production deploy gate. Changes require human review.
- `.env*` — secrets. Never read, never write.
- `.git/*` — git internals.
- `node_modules/**` — installed packages.

If you believe one of these needs to change, ask Hrishikesh. Do not edit and submit.

---

## 10. Decision log (defaults; override via ADR)

Every default below has either an ADR backing it or a `DECIDE` marker pointing to an ADR not yet written. **Do not silently default `DECIDE` rows** — the ADR must be written first.

| Slot | Pick | Rationale |
|---|---|---|
| Runtime | **Node 22** | LTS |
| Framework | **Next.js 16 App Router** | Server Components + Server Actions; Next 15 LTS EOLs Oct 21, 2026 (per ADR-0003) |
| Language | **TypeScript strict** | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`, no unsafe `as` |
| DB | **Postgres 17** | Boring, transactional, durable skill |
| DB schema | **Event-sourced** | Append-only events table + projector workers (per ADR-0005) |
| DB provider | **Supabase** | Per ADR-0006 |
| ORM | **Drizzle** | SQL-first; event-sourced schema lives closer to SQL than ORM abstractions (per ADR-0008) |
| Auth | **DECIDE — Clerk vs NextAuth** | ⚠ ADR-0004 is GATING. ~$1,500/mo swing at 100k MAU |
| Styling | **Tailwind v4 + shadcn/ui** | OKLCH-only color tokens; new-york v4 variant |
| Real-time | **DECIDE — SSE over LISTEN/NOTIFY vs polling** | TBD in technical architecture spec (SPEC.2) |
| Media storage | **Cloudflare R2** | S3-compatible, no egress fees |
| Email | **Resend** | Simple API |
| Rate limit / queue | **Upstash Redis** | Serverless-native |
| Hosting | **Vercel** | Per ADR-0006 |
| CI | **GitHub Actions** | Already where the repo lives |
| Tests | **Vitest + Playwright** | Fast unit + realistic E2E |
| Linter / formatter | **Biome v2** | Single source for JS/TS |
| Git hooks | **Lefthook** | Parallel pre-commit |
| Error tracking | **Sentry** | Per ADR-0007 |
| Analytics + flags | **PostHog** | Per ADR-0007 |
| Logs + metrics | **Axiom** | Per ADR-0007 |
| Tool versions | **mise** | `mise.toml` pins Node 22, pnpm 10 |
| Task runner | **just** | `justfile` for human-facing commands |
| Commits | **Conventional Commits + commitlint** | Predictable changelog |
| License | **AGPL-3.0-or-later** | Per ADR-0001; AGPL §13 forecloses closed-source SaaS forks |
| **Claude Code model** | **Opus 4.7** (`claude-opus-4-7`) | Hrishikesh's preference for all coding tasks |
| **Claude Code effort (repo baseline)** | **`effortLevel: xhigh`** in `.claude/settings.json` | Strongest setting that *persists* via settings.json |
| **Claude Code effort (per-machine)** | **`CLAUDE_CODE_EFFORT_LEVEL=max`** in shell rc | Hrishikesh-preferred override; `max` does not persist via settings.json |
| **Reasoning keyword** | **`ultrathink`** as first word of every coding-task prompt | One-off deepest reasoning regardless of effort setting |

---

## 11. Maintaining this file (feedback / validation loop)

CLAUDE.md, AGENTS.md, the workflow doc, and the templates are living documents. They go stale faster than code does. Without an explicit update cadence, they become decorative — every session reads them, none of them match reality.

**Full process: `docs/maintenance.md`.** Quick summary:

- **Triggers** for an audit: a task discovers drift, a phase ends, an ADR is accepted, a new subagent/command/hook lands, calendar (bi-weekly).
- **Process:** open a fresh Claude Code tab, paste the file + last 10 task logs + tracker, ask Claude to find drift and missing additions, triage, ship as `docs: <file> audit pass YYYY-MM-DD`.
- **Closing ritual** for every task chat: ask "Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this task?" Most tasks: no. The discipline is asking the question, not necessarily changing.
- **Self-improvement** comes from finding "missing additions — patterns that have emerged but aren't documented." After three months of running tasks, this file should be measurably better than it was at FOUND.4, not just current.

---

*Last revised in FOUND.4 v2 (Apr 28, 2026). Changes from v1: added §3 (engagement style), promoted critical paths to a labeled block in §1, simplified §6 to point at the workflow doc, updated dates (Live → Nov 5, Conclude → Nov 6 at Devcon 8), updated decision log model rows for Opus 4.7 + max + ultrathink, added §11 with `docs/maintenance.md` reference, added "Core file updates needed?" section to the §7 task-log schema. If anything in this file is wrong, fix it before fixing the code.*
