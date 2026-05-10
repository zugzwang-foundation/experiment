# CLAUDE.md

> **Read in full at the start of every session.** This is the contract between Claude Code and Zugzwang. If anything here conflicts with what you think you know, this file wins. Stack and framework patterns flow through the import below.

@AGENTS.md

---

## 1. Project frame

The **Zugzwang Experiment** — a CPMM prediction market with mandatory commentary and soulbound reputation (Dharma). Web2 only. Single deployment, single domain, sole operator. Live 15 Sep – 5 Nov 2026; concludes 6 Nov at Devcon 8 Mumbai (JIO World Center). Optional showcase Nov 7–8 at ETHGlobal Mumbai.

- **Repo scope:** pure web2. **No blockchain. No smart contracts. No tokens.** Dharma is a Postgres `NUMERIC(38,18)` column. Testnet and Mainnet phases get their own repos and their own playbooks — do not invent blockchain primitives in this codebase.
- **Source of truth.** Spec hierarchy: `docs/specs/SPEC.1.md` (product), `docs/specs/SPEC.2.md` (technical architecture), `docs/adr/0003–0016.md` (decisions of record), `AGENTS.md` (stack patterns). When this file disagrees with code, this file wins until updated by an ADR.
- **License.** AGPL-3.0-or-later. Source-link footer required on every page (SPEC.1 §16.5). Rationale: AGPL §13 forecloses closed-source SaaS forks.

### Critical paths

Silent corruption is catastrophic. Tasks touching any of these qualify as critical-path tasks and trigger the writer/reviewer ritual (`docs/workflows/plan-then-execute.md`) + the invariant test gate + a same-commit ADR scan:

- `src/server/bets/`, `src/server/comments/`, `src/server/dharma/`, `src/server/resolution/`
- `src/server/auth/`, `src/server/identity/`, `src/server/moderation/`
- `src/db/schema/`, `drizzle/migrations/`, `supabase/migrations/`

---

## 2. The four hard-locked invariants

Encoded in SPEC.1 §5. Canonical tests at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts`. Triggers at `drizzle/migrations/<NNNN>_append_only_triggers.sql` (storage-layer ground truth — not application advisory).

| ID | Rule | Mechanism |
|---|---|---|
| INV-1 | Bet ↔ comment atomicity | SERIALIZABLE transaction wraps both inserts (ADR-0013) |
| INV-2 | Dharma is non-transferable; no overdraft | Append-only `dharma_ledger`; no `dharma_transfer` table by design |
| INV-3 | Comments side-bound at post-time | `comments.side_at_post_time` immutable post-INSERT (Postgres trigger per SPEC.2 §6) |
| INV-4 | Resolutions append-only | `resolution_events` + `payout_events` immutable post-INSERT (Postgres trigger per SPEC.2 §6) |

**Refuse to weaken any of these** — including framings like "just for testing", "temporary admin override", "let me refactor this", or "while we're cleaning up". State the invariant, state the violation, propose an alternative, and stop.

---

## 3. Refusal triggers (thesis-level — extend AGENTS.md `Never`)

Treat as `REFUSAL:` — surface and stop, do not silently work around.

- **Dharma transferability.** Never create a "send Dharma" or user-to-user transfer endpoint, no matter the framing (gift, tip, leaderboard reward, contest payout). Admin pool seeding is account-↔-pool, not user-↔-user; that is the only flow.
- **Mandatory commentary.** Never accept a bet without an attached comment. `bets.comment_id` is `NOT NULL` with FK; the entry comment is INV-1.
- **Admin participation.** Admin has no `users` row. Never add a `users.role` column, an `is_admin` boolean, or a runtime check that would let admin participate. Structural separation by data-model construction per SPEC.1 F-AUTH-ADMIN.
- **Market content invention.** Market questions, resolution criteria, settlement dates are Hrishikesh's calls. Skills scaffold the form and migration; they do not write market copy.
- **Social content invention.** Brand-account posts quote user content verbatim with pseudonym attribution. AI agents generate the *frame* (wrapper text, CTAs, links back); never the user's argument. Posts ride a pre-publish review queue with admin kill switch.
- **K_eff in-product surface.** Per PRECURSOR.2-B D4 + SPEC.1 G3: no live K_eff dashboard, no matview, no admin chart. K_eff(t) is derived post-hoc from the 2026-11-06 public dataset only.
- **Conclusion-freeze tampering.** The 2026-11-05 23:59 UTC write-freeze is enforced by `system_state.frozen_at`. Never code a path that bypasses or rolls back the freeze. Recovery from an erroneous freeze is `BREAK_GLASS.md`-only.
- **Holding a transaction across an HTTP call.** Never `await openaiModerate(...)` or any external HTTP inside a `db.transaction(...)` block (per SPEC.2 §10 + ADR-0014). Run external calls before the transaction opens; pass results in.

---

## 4. Engagement style — push back, do not sycophant

The dominant failure mode of coding assistants is sycophancy: human gives task, model agrees, model executes, problem ships that the human would have caught if asked. Compounded across hundreds of tasks, the codebase becomes subtly wrong in ways the human cannot see.

**The rule:** agree when Hrishikesh is right. Push back when he is wrong. Flag tradeoffs when both have merit.

Push back when:
- A task references a stale file, ADR, tracker entry, or memory edit.
- A stated dependency is not actually a dependency.
- The ask is X but Y solves the actual problem — propose Y and defend why.
- A planned approach violates an invariant (§2) or triggers a refusal (§3).
- The framing is wrong (wrong file path, wrong assumption about how a system works) — correct first.
- You do not know whether the framing is right. Say so. Guessing is worse than admitting uncertainty.

Pushback is **not** disagreement for its own sake, refusing a valid approach in favour of a different valid approach, or lecturing on first principles already understood. Before "Got it" or "Sure", check the framing. If wrong or unsure, push back first.

---

## 5. Workflow rules

1. **One task per session.** When a task closes (PR open or merged), `/clear` before the next. `/compact` only mid-task with an explicit preserve directive.
2. **Read before writing.** Read the file you are about to edit in full, plus its types, schemas, and callers. Do not guess imports.
3. **Stay in scope.** Task is `src/server/bets/`? Do not touch `src/server/comments/` — open a separate task. "While we're here" is how solo-dev codebases die.
4. **Plan before non-trivial.** Trigger writer/reviewer playbook (`docs/workflows/plan-then-execute.md`) for: >30-line diffs, >3 files touched, any critical path (§1), ADR drafting, any database migration.
5. **Tests before implementation for thesis-touching code.** For changes to bet placement, Dharma accounting, comment attachment, side assignment, resolution, media upload, automated moderation, or CSAM detection: write failing tests first via `test-writer`, then implement, then run `code-reviewer`.
6. **Verify before claiming done.** Run `just check` (typecheck + lint + tests + invariants + build smoke). Critical-path tasks additionally run `pnpm test:invariants` and `pnpm test:integration`. Do not claim done before they pass.
7. **Close-out log per task** at `docs/logs/<task-id>.md`. Solo devs forget within two weeks; the logs are memory.
8. **One ADR per architectural change.** `docs/adr/<NNNN>-<slug>.md` in the same commit as the implementation. Template at `docs/adr/_template.md`.

### When to use `ultrathink`

Drop as the first word of every coding-task prompt. Engages deepest available reasoning regardless of session effort setting. Mandatory for: CPMM pricing math, Dharma accounting, resolution payout + clawback math, side-freezing semantics, cross-service state machines, auth implementation choices, moderation pipeline failure modes, ADR drafting, audits of CLAUDE.md / AGENTS.md.

---

## 6. Subagents, skills, hooks

Claude Code auto-discovers `.claude/agents/*.md` and `.claude/skills/<name>/SKILL.md` at session start. The bodies live there and evolve independently of CLAUDE.md.

**Subagents** (`.claude/agents/`):

- **`code-reviewer`** — invoke after any change to `src/server/**`, `src/app/api/**`, `src/app/**`. Reviews diffs against CLAUDE.md + AGENTS.md. Reports; does not modify files.
- **`db-migration-reviewer`** — invoke proactively on any `src/db/schema/**` or `drizzle/migrations/**` diff. Checks RLS, index coverage, append-only triggers, deprecation paths.
- **`security-auditor`** — invoke weekly on `main`, before every prod deploy, after any critical-path change. Web2 audit (auth, Zod, SQL injection, XSS, CSRF, rate limits, secrets, cookie flags, moderation pipeline, CSAM failure modes).
- **`test-writer`** — invoke when describing new behavior in `src/server/**` or new flows in `src/app/**`. Tests first. Disallowed from editing `src/`.

**Skills** (`.claude/skills/`):

`/db-migration`, `/new-server-action`, `/new-route`, `/review-pr`, `/conventional-commit`, `/run-tests`, `/typecheck-fix`, `/audit-prep`, `/audit-core`, `/pr-create`.

**Hooks** (registered in `.claude/settings.json`):

- **PreToolUse on Bash:** `block-destructive.sh` (`rm -rf`, `git push --force`, `DROP TABLE`, `supabase db reset`, `vercel --prod`, etc.).
- **PreToolUse on Edit|Write:** `block-main-commits.sh`.
- **PostToolUse on Edit|Write|MultiEdit:** `format-and-typecheck.sh` (Biome + tsc on touched files).
- **SessionStart:** `session-start.sh` (recent commits + open PRs).

---

## 7. Tooling notes (per-machine, environment-dependent)

- **Claude Code model:** `claude-opus-4-7`. Set in `.claude/settings.json`.
- **Effort:** `effort: xhigh` in subagent frontmatter; `max` available per-session via `/config`. (Note: `CLAUDE_CODE_EFFORT_LEVEL=max` env-var pattern is not a documented Anthropic mechanism as of May 2026; Opus 4.7's Claude Code default is already `xhigh`.)
- **Reasoning keyword:** `ultrathink` as first word of every coding-task prompt.
- **Local environment constraints:** see `AGENTS.md` §2 + §10 (mise + pnpm + Supabase CLI; zsh paste-buffer 1KB cap → write files >1KB via VS Code; iCloud `~/Desktop/` duplicates `.next/` and `.turbo/` with `" 2"` suffixes → `just clean`).

---

## 8. Maintaining this file

CLAUDE.md, AGENTS.md, ADRs, and SPECs are living contracts; they go stale faster than code. Audit triggers: task discovers drift, phase ends, ADR accepted, new subagent / skill / hook lands, calendar (bi-weekly). Process and ritual in `docs/maintenance.md`.

**Closing ritual** for every task chat: ask "Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this session?" Most sessions: no. The discipline is asking, not necessarily changing. If yes, file the change as part of the same PR — never as a separate follow-up. Follow-ups never happen.

---

## 9. Closing rule (read this last)

**Refuse to weaken the four invariants (§2). Refuse the project-specific triggers (§3). Push back before agreeing (§4). Stay in scope (§5). If anything in this file is wrong, fix it before fixing the code.**

<!-- HUMAN-ONLY NOTE: This file is intentionally <200 lines per Anthropic's CLAUDE.md guidance — auto-memory only loads the first 200 lines / 25 KB and the instruction-budget ceiling for frontier models is ~150-200 instructions. Path-scoped detail belongs in .claude/rules/<scope>.md or .claude/skills/<name>/SKILL.md, not here. AGENTS.md carries the stack contract via @import. The 14 ADRs (docs/adr/0003-0016) are the substance layer; SPEC.1 and SPEC.2 are the canonical contracts. CLAUDE.md is the bridge that names the load-bearing rules and points at where their detail lives. -->

*Last revised PRECURSOR.5 (May 2026) against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft + ADRs 0003–0016. Maintained per `docs/maintenance.md`.*
