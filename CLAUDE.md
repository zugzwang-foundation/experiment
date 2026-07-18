# CLAUDE.md

> **Read in full at the start of every session.** The contract between Claude Code and Zugzwang — the part that *cannot bend*. This file is the *what*; `AGENTS.md` (imported below) is the *how*.
>
> **Advisory, not a control plane.** Claude reads and tries to follow this; it does **not** enforce. Hard guarantees belong in hooks / `permissions.deny` / CI (§6) — most are not installed yet, so treat every rule here as discipline, not a safety net.
>
> **Keep it lean** — it loads in full every session alongside `@AGENTS.md`. Add a rule only after Claude repeats a mistake; prune the moment a decision supersedes it.

@AGENTS.md

---

## 1. Project frame

The **Zugzwang Experiment** — a CPMM prediction market with mandatory commentary and soulbound reputation (Dharma). Web2 only. Live 15 Sep – 5 Nov 2026; concludes 6 Nov at Devcon 8, Mumbai.

- **Scope:** pure web2. **No chain, no contracts, no tokens.** Dharma is a Postgres `NUMERIC(38,18)` column. Testnet/Mainnet get their own repos.
- **Source of truth:** `SPEC.1` (product, 1.0.15) + `SPEC.2` (technical) + `docs/adr/0003–0031` are canonical. `tracker_v17.html` is planning/sequencing only. On conflict, spec/ADR wins — note the drift once, don't block.
- **License:** AGPL-3.0-or-later (§13 forecloses closed-source forks).
- **Deliberate schema choices:** the DEBATE.8/9 schema catch-up is complete — `comments.stake_at_post_time` and `friendly_fire_events` are dropped. One apparent spec↔schema gap remains and is **intentional**: `comments.bet_id` is **deliberately nullable** (INV-1 via `bets.comment_id` NOT NULL + the W-1 atomic transaction; not a pending NOT-NULL migration — detail in AGENTS.md §6). **Don't "correct" it to the spec.**

**Operating model.** Claude Code executes; web Claude reviews and gates decisions; Hrishikesh relays and operates the dashboards. One task per chat; a fresh session for each major phase transition (§5.8).

**Critical paths** — touching any triggers the full ritual (writer/reviewer §5.6 · invariant gate §5.7 · same-commit ADR §5.12 · pre-PR self-audit §5.10 · subagent review §5.11):

- Built, sensitive: `src/server/auth/` (+ `auth/admin/`), `src/server/identity-pool/`, `src/server/moderation/`, `src/server/cpmm/`, `src/server/dharma/`, `src/server/positions/`, `src/server/bets/`, `src/server/comments/`, `src/server/resolution/`
- Schema / migrations: `src/db/schema/`, `drizzle/migrations/`

*(RLS / `supabase/migrations/` out of scope — ADR-0019.)*

**Vocabulary** — use these exact terms in code, comments, and commits:

- **Market** — a binary YES/NO question with a CPMM pool (`markets` + `pools`).
- **CPMM** — constant-product market maker (lifted from Manifold, attributed; fee-less, single-MM). Pure TS in `src/server/cpmm/`.
- **Market states** — `Draft → Open → Closed → Resolving → Resolved` / `Voided` / `Frozen`; pure transition functions, illegal transitions are negative tests (ENGINE.4).
- **Side** — `YES` | `NO` (pgEnum `side`); a bet and its comment share one side.
- **Pool** — the CPMM reserve row backing a market (`pools`); seeded/unwound admin-side only.
- **Support / Counter** — a reply-bet's stance toward its parent; not a separate vote — derived from side at read time.
- **Bet** — a stake on a side (`bets` + `positions`); carries `comment_id`, its argument.
- **Comment** — argued commentary; every comment rides a bet (reply-as-bet), linked via `bets.comment_id` (the populated FK; `comments.bet_id` is deliberately NULL — see §2).
- **Reply-bet** — a reply *is* a Support/Counter bet on the parent (depth 1, flat).
- **Dharma** — soulbound reputation; append-only `dharma_ledger`; never transferable.
- **Daily Credit** — the daily Dharma allowance (DB: `daily_allowance`, `last_allowance_accrued_at`); two stake floors `BET_MIN_STAKE_POST` / `BET_MIN_STAKE_REPLY` (ADR-0018).
- **Artha** — the transferable asset; arrives at **testnet** and is *out of scope* for this web2 repo (named only so it's never reached for here).
- **Position** — a user's net holding in a market (Bucket C, mutable).
- **Resolution** — settlement of a market; append-only `resolution_events` → `payout_events`.
- **Void / Freeze** — a cancelled market (`void_refund` refunds) / the conclusion write-freeze (`system_state.frozen_at`, read-only after).
- **Identity** — pseudonym + PFP assigned from `identity_pool` at signup; the user's public face.

---

## 2. The four hard-locked invariants

SPEC.1 §5. Tests at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts`; the triggers in `drizzle/migrations/0003_append_only_triggers.sql` are storage-layer ground truth — Bucket-A/B triggers reject `UPDATE`/`DELETE`/`TRUNCATE` at the storage layer (TRUNCATE statement-level, ADR-0030). *(Canonical tests on disk: INV-1 → `I-ATOMICITY-001`, INV-2 → `I-NO-OVERDRAFT-001`, INV-3 → `I-SIDE-BIND-001`, INV-4 → `I-APPEND-ONLY-001`; plus six invariant-class spec-rule specs — `I-DAILY-ONCE-001`, `I-GRANT-ONCE-001`, `I-NO-OVERSELL-001`, `I-RESOLVE-ONCE-001`, `I-SINGLE-SIDE-001`, `I-IDEM-ONCE-001` (once-only bet/sell execution across any crash / Redis-window / retry — the durable `bet_receipts` backstop: UNIQUE on `idempotency_key`, last write in the W-1 tx; a replay 23505s and rolls back, ADR-0031). Storage-layer backstop remains `tests/db/triggers/` + the schema.)*

| ID | Rule | Mechanism |
|---|---|---|
| **INV-1** | Bet ↔ comment atomicity (reply-as-bet) | One SERIALIZABLE tx wraps both inserts (ADR-0013). `bets.comment_id NOT NULL` (built); `comments.bet_id` **deliberately nullable** (circular `comments`↔`bets` pair; comment inserted before its bet exists, Bucket-A append-only forbids back-fill) — INV-1 enforced via `bets.comment_id` NOT NULL + W-1 atomicity, **not** via `comments.bet_id`; not a pending NOT-NULL migration (ADR-0017 ranking reconciliation, DEBATE.8). |
| **INV-2** | Dharma non-transferable; no overdraft | Append-only `dharma_ledger`; **no** transfer table, by design; `CHECK (balance_after >= 0)`. |
| **INV-3** | Comments side-bound at post-time | `comments.side_at_post_time` immutable post-INSERT. Flipping sides never moves prior comments. |
| **INV-4** | Resolutions append-only | `resolution_events` + `payout_events` immutable post-INSERT. |

**Mandatory commentary, in schema:** no bet without a comment, **and no comment without a bet** — every comment rides a Support/Counter reply-bet (ADR-0017, `REPLY_DEPTH_MAX = 1`). No standalone friendly-fire vote; Support/Counter are read-time aggregates over reply-bets.

**Refuse to weaken any invariant** — "just for testing" / "temporary admin override" / "while we clean up" included. State it, name the violation, propose an alternative, stop.

**Architecture & money (correctness landmines).** The system is **event-sourced**: every state change is an append to `events`, projected into read models, idempotent by `event_id`, replayable (ADR-0005). **Never mutate state in place.** All monetary/Dharma math is `NUMERIC(38,18)` — **never JS floats** for balances, prices, or shares; app-side decimal arithmetic is decimal.js 10.6.0 (literal pin) via the CpmmDecimal constructor exported from `src/server/cpmm/decimal.ts` (precision 50 — ENGINE.5 reuses it); keep arithmetic exact and server-side. Handler failure posture: rate-limit fails **open**, idempotency fails **closed**, moderation fails **closed** on a terminal error (ADR-0014/0015).

---

## 3. Refusal triggers

Each is a `REFUSAL:` — surface and stop; never silently work around.

- **Dharma transfer.** No user-↔-user "send Dharma" endpoint, ever. Pool seeding is account-↔-pool only.
- **Mandatory commentary.** No bet without a comment; no comment without a bet (§2, INV-1).
- **Admin participation.** Admin has no `users` row — no `role`, no `is_admin`, no runtime check. Admin auth is a separate path (`src/server/auth/admin/`).
- **Market-content invention.** Questions, resolution criteria, settlement dates are Hrishikesh's. Scaffold the form, never the copy.
- **Social-content invention.** Brand posts quote users verbatim with pseudonym attribution. Generate the frame, never the argument.
- **K_eff in-product surface.** No live dashboard / matview / chart. K_eff(t) is derived post-hoc from the 2026-11-06 dataset only.
- **Conclusion-freeze tampering.** The 2026-11-05 23:59 UTC freeze is `system_state.frozen_at`. No bypass; recovery is `BREAK_GLASS.md`-only.
- **HTTP inside a DB transaction.** Never run moderation or any external HTTP inside `db.transaction(...)` — run externals first, pass results in (ADR-0014).

---

## 4. Engagement style — push back, don't sycophant

The dominant failure of a coding assistant is agreeing with a flawed ask and shipping a problem the human would have caught. Compounded across tasks, the codebase goes subtly wrong in ways the human can't see.

**Before agreeing:** state assumptions (ask if uncertain); surface multiple interpretations rather than picking silently; correct wrong framing first; say so when you don't know — guessing is worse than admitting it.

**Push back when:** a task cites a stale file / ADR / tracker / memory (e.g. "this references tracker_v8, but v11 supersedes it"); a stated dependency isn't one; the ask is X but Y solves the real problem (propose Y, defend it); an approach violates §2 or trips §3; a simpler approach exists.

Pushback is **not** disagreement for its own sake, swapping one valid approach for another, or lecturing on basics already understood.

---

## 5. Workflow rules

### 5.1 Plan mode
`/plan` for any critical-path task (§1), any task without an approved `docs/plans/<TASK-ID>.md`, or any work > 30 lines / > 3 files. In plan mode: read, draft the plan, surface uncertainties as questions, **make no edits**. The plan is confirmed in CC, then pasted to the web Claude chat for sign-off; only then exit and execute. The plan file lives in-repo at `docs/plans/<TASK-ID>.md` (not `.claude/`) and is committed before Phase 1 ends — Phase 2 references it via `@docs/plans/...`. About to write code with no approved plan → stop and surface. Trivial work skips planning: file moves, dep bumps, doc-only edits, agreed hot-fixes.

### 5.2 Simplicity first
The minimum code that solves the problem — nothing speculative, no abstractions for single-use code, no error handling for impossible scenarios. If you write 200 lines and it could be 50, rewrite. Test: would a senior engineer call this overcomplicated? If yes, simplify.

### 5.3 Surgical changes
Touch only what the task requires. Don't "improve" adjacent code, comments, or formatting; don't refactor what isn't broken; match the existing style even if you'd do it differently. Clean up orphans *your* change created; leave pre-existing dead code unless asked. Every changed line traces directly to the request.

### 5.4 Stay in scope
Task is `src/server/bets/`? Don't touch `src/server/comments/` — open a separate task. "While we're here" is how a solo-dev codebase dies. New issues surfaced mid-task → write to `claude-progress.md` and raise them; never absorb silently.

### 5.5 Read before writing
Read the file you're about to edit in full, plus its types, schemas, and callers. Don't guess imports.

### 5.6 Tests first (thesis-touching logic)
Failing tests via `@test-writer` first → implement → `@code-reviewer`, for business logic in the surfaces below. Type-only declarations (schema, type aliases) and config are exempt — the type-check is the gate; distinguish TDD drivers from `_probe-*` regression guards (AGENTS.md §9).

- bet placement · Dharma accounting · payout math
- comment attachment · side assignment · resolution
- media upload · moderation · CSAM detection

### 5.7 Verify before "done"
Run `just verify` (= typecheck → `biome check` → `next build`). Critical-path tasks additionally run `pnpm test:invariants` + `pnpm test:integration` (or `just test-db`). Don't claim done before they pass. *(`just check` is Biome-only — not the full gate.)* Bet-handler concurrency — `SERIALIZABLE` + `SELECT … FOR NO KEY UPDATE` on the pool row + full-jitter retry on `40001/40P01` — is ADR-0013 (detail in AGENTS.md §6).

### 5.8 Session boundaries
Use `/clear` (not `/compact`) between strata of a multi-stratum task, after a PR merges before the next task, when context drifts, and at the start of every new session paired with a new web chat. Never `/clear` mid-task — finish to a clean PR boundary first.

### 5.9 Per-session logs
Every session ends with a log at `docs/logs/<TASK-ID>.md` — written *before* `/clear`, before disconnecting, before walking away; every session, not only at task close. Six fields: What landed (files + PR#) · Decisions made · Open questions · Next session starts at (exact next action) · Context to preserve · Time. The log ships in its own commit before the PR: `chore(<scope>): log session — <stratum> <state>`. Canonical reference SHA = the **squash-merge SHA on `main`** (branch SHAs are ephemeral). A session that ends without a log makes the next one start blind — the most expensive failure mode.

### 5.10 Pre-PR self-audit
Critical-path PRs self-audit **before** `gh pr create`, in-session, against the plan item by item: **PASS** (correct, matches plan) / **FAIL** (fix in-session before continuing) / **SURPRISE** (surface to Hrishikesh). What to verify:

- **Schema:** every column / type / nullability, FK, index, enum value set, bucket classification, same-commit spec amendment (grep-verified).
- **Server:** every handler against the plan's API surface + the assertion that proves each flagged invariant holds.
- **Migration:** ordering, idempotency, trigger SQL, partition DDL, singleton constraints.

PR opens only when the audit is clean. This is the execute surface's own pass — **not** a subagent step (§5.11 is separate). Verification is left-shifted to write-time, where fixes are cheap; there is no post-PR soak. Non-critical PRs skip it (still run `just verify`).

### 5.11 Subagent invocation
Subagents (§6) are invoked **explicitly** from kickoff prompts (auto-match is on via "MUST BE USED", but explicit is the reliable path). **Always pass `@docs/plans/<TASK-ID>.md`** — they start from zero context, and without it they re-explore the codebase from scratch. FAIL in scope → fix before PR; SURPRISE out of scope → `claude-progress.md` + STOP. Don't invoke for tightly-coupled schema + server + UI + tests in one pass (they lose shared intent), non-critical work, or type-only changes.

| Work | Subagent | Phase |
|---|---|---|
| `src/db/schema/` or `drizzle/migrations/` | `@db-migration-reviewer` | post-audit |
| `src/server/` changes | `@code-reviewer` | post-audit |
| Critical-path business logic | `@security-auditor` | after `@code-reviewer` |
| New business-logic behavior | `@test-writer` | Phase 2 start (tests-first) |

### 5.12 ADRs
One ADR per architectural change at `docs/adr/<NNNN>-<slug>.md`, in the **same commit** as the code (template `docs/adr/_template.md`). Decision unchanged but consumer surface needs scoping → in-place *Patch record*, not a formal supersession.

### 5.13 Commit & git hygiene
Branches `feat/` · `fix/` · `chore/` · `refactor/`. **Squash-merge only; PRs required; signed commits (SSH, ED25519)** — enforced by GitHub branch protection (server-side), *not* a local hook. Multi-line commit messages: write `/tmp/commit-msg.txt`, then `git commit -F /tmp/commit-msg.txt` — never multi-line `-m` or heredocs (macOS zsh truncates pastes ~1KB; split multi-command pastes into single commands). Commit identity: `Zugzwang/world <zugzwangworld@proton.me>` (git username `Chrollo`).

### Gotchas
- `events.event_type` is `text`, not a pgEnum — extend the `EVENT_TYPES` const **and** its Zod payload schema in the **same commit**.
- The `events` table is hand-partitioned (`PARTITION BY RANGE`) and **excluded from drizzle-kit** (`tablesFilter: ["!events"]`) — write its DDL as raw SQL in a migration.
- Scripts run under `tsx` must **not** import the `@/db` → `server-only` chain — inline their own `postgres()` client (the staging-seed/smoke pattern).
- `0000_uuidv7_function.sql` ships the userspace `uuidv7()`; CI strips `pg_cron` from `0007` before applying.
- Doppler config names are `stg` / `prd` — **never** `staging` / `production`.
- Supabase direct host (`db.<ref>.supabase.co`) is IPv6-only; local scripts and migrations use the **session pooler** (`...pooler.supabase.com:5432`).
- `BETTER_AUTH_URL` fails at **build time**, not request time — the custom domain must be attached and the URL set *before* deploy.
- **Deploy / promote (pipeline is live + gated).** Canonical: `docs/runbooks/deploy-pipeline.md` §3 + ADR-0024 — do not re-derive it here. Load-bearing rules: schema changes are **expand/contract** (additive first; never a destructive in-place alter on a live table); **migrate-before-serve** (the prod migration applies before the new code is promoted); **rehearse on staging first** (push to `staging`, let the auto-deploy + `/api/health` gate go green before touching prod). Two gotchas that bite: (1) `vercel promote` **requires `--scope <team-slug>`** — without it the command errors or hits the wrong project; (2) **trust the `/api/health` gauge, not `migrate` exit codes** — the migrate step can report success while the DB is not actually ready (drizzle-orm #5769), so gate on health, not the exit code.

### `ultrathink`
First word of every coding prompt. Mandatory for CPMM math, Dharma accounting, payout math, side-freeze semantics, cross-service state machines, auth, moderation failure modes, ADR drafting, and CLAUDE.md / AGENTS.md audits. Mechanism: an in-context deeper-reasoning instruction for that turn only — it does **not** change the session/API effort level (effort policy is §6).

---

## 6. Subagents, hooks, model

**Claude Code runs on Claude Opus 4.8** — pinned `claude-opus-4-8`. Pin history (append-only, `docs/maintenance.md` pattern): Fable 5 pinned 2026-06-10 → reverted to Opus 4.8 2026-06-28 (Fable unavailable) → Fable-5 window re-opened at UI.0 (2026-07-16, PR #228; subagents on `claude-fable-5`) → window closed early 2026-07-18, subagents re-pinned `claude-opus-4-8` (OQ-7). Select with `/model opus`. **Effort default is `max`** — run at the highest setting always (`/effort max`; empirically accepted by the subagent schema). `ultracode` + dynamic / auto-orchestrated workflows are the default working mode for ordinary, reversible, parallelizable work — **but never on the four critical paths (auth, bet engine, ledger, commentary/moderation) or any DDL/migration**, which keep the gated plan→execute + named-reviewer cascade (`ultracode` bypasses it). The `CLAUDE_CODE_EFFORT_LEVEL` env var stays **retired** — it outranks subagent frontmatter; never set it. `ultrathink` stays in every coding prompt (§5).

**Subagents** — auto-discovered from `.claude/agents/*.md`; all four are tracked, each `model: claude-opus-4-8` / `effort: max` with a "MUST BE USED" routing description. Full briefings live in those files; invocation policy is §5.11.

- `code-reviewer` — diff under `src/server/` vs §2/§3 + stack patterns; returns CRITICAL/HIGH/MEDIUM/LOW with `file:line`.
- `db-migration-reviewer` — schema vs SPEC.2 §5 inventory, FK lambdas, indexes, Bucket A/B/C, trigger SQL; returns PASS/FAIL/SURPRISE per table.
- `security-auditor` — auth, transaction handlers, moderation, admin surfaces for INV-1/2/3/4 gaps + exploitability.
- `test-writer` — failing tests first against the plan; **never edits `src/`**.

**Hooks / skills — NOT installed.** No committed `.claude/settings.json`, no `.claude/hooks/`, no `.claude/skills/`. The only local config is a gitignored `.claude/settings.local.json` (a tool allow-list — **no `permissions.deny`, no hooks**). So "blocked main commits / blocked destructive commands / commit linting" are **enforced nowhere** — discipline only until installed. The prioritized set to install (hooks at `.claude/hooks/`, registered via a committed `.claude/settings.json`; hard blocks in `permissions.deny`):

- **`block-main-commits`** (PreToolUse) — reject any `git commit`/`push` targeting `main` directly.
- **`block-destructive`** (PreToolUse) — reject `rm -rf`, `db reset`, `migrate down`, force-push outside an explicit allow.
- **`format-and-typecheck`** (post-edit) — `biome` + `tsc` on touched files.
- **`permissions.deny`** — `.env*` writes, `supabase db reset`, raw `psql` against prod.
- *(optional)* commitlint for the `type(scope): subject` convention.

---

## 7. Maintaining this file

Stale docs are worse than none — the ongoing burden is **pruning**, not adding (process: `docs/maintenance.md`).

- **Add** a rule only on trigger: Claude repeated a mistake / a review caught something it should have known / you retyped last session's correction / a new teammate would need it.
- **Prune** on supersession (ADR-0009 ranking → removed, not stacked beside ADR-0017).
- **Auto memory is a separate layer** — Claude's machine-local notes (`~/.claude/projects/<repo>/memory/`) are *not* in the repo and *not* shared with the devs. Team-shared knowledge belongs here, in the committed file.
- **Reconcile periodically** (a SYNC sweep + version bump), not per-task. Routine tasks touch only the logs.

**Decision log** (`DECIDE` = a settled call this file encodes; newest first):

- Source of truth: SPEC.1 / SPEC.2 / ADRs are canonical; `tracker_v17` is planning/sequencing only.
- Doc authorship: AGENTS.md is descriptive (CC-authored from the live repo); CLAUDE.md is the contract (web-drafted invariants + CC-verified file-map refs).
- Market media (ADR-0026): admin-set per-market pool — new `market_media` table (Bucket C, no `user_id`); third R2 bucket arm `market-media` (`m/<marketId>/`); reference-model pick-from-pool via `comments.market_media_id` + not-both-set CHECK; `markets.media_video_url` outbound YouTube (new tab); admin-context upload moderation, pick path pre-vetted. Spec lane only (SPEC.1 1.0.11 / SPEC.2 1.0.12); display + admin-upload + composer-pick are three ritual-gated build tasks (new migration 0018→0019 at execute).
- Debate `.md` export (ADR-0025): on-demand read-only `GET /m/[slug]/export`; masking inherited from `loadDebateView` (removed content never exported); text-only single file with a version-pinned `zugzwang.md` context block prepended. Amends SPEC.1 §21.3.
- Deploy pipeline + migration sequencing (ADR-0024; scoped-supersedes ADR-0022): staging-as-prod-replica; `staging`-branch sandbox + gated prod-promote; two Supabase projects; per-hash `/api/health` drift. Runbook: `docs/runbooks/deploy-pipeline.md` §3.
- Participant shell topology (ADR-0023): `(public)/` route group; server-component shell; `/m/[slug]` first route; `getMarketBySlug` excludes Draft.
- Prod migration strategy + schema-drift guard (ADR-0022): per-migration-tx `db:migrate:prod`; env-fragment guard; status-only `/api/health` drift field; `db:check-drift` (drift method partially superseded by ADR-0024).
- Reactive moderation, no held queue (ADR-0021; supersedes ADR-0020): gate returns block/pass; admin reviews live content reactively (Remove/Ban); no moderation action touches a position.
- Decoupled content removal + three-option held queue (ADR-0020) — superseded by ADR-0021 (held queue removed; the content-removal-vs-user-ban decoupling is retained).
- Ranking = ADR-0017 multi-mode; supersedes ADR-0009. `RANKING.md` stale until DEBATE.8.
- Reply-as-bet (ADR-0017): a reply **is** a Support/Counter bet; `REPLY_DEPTH_MAX = 1`; no standalone friendly-fire vote.
- Issuance + two bet floors (ADR-0018): `BET_MIN_STAKE_POST` / `BET_MIN_STAKE_REPLY`; DB identifiers `daily_allowance` / `last_allowance_accrued_at` retained.
- IDs are UUIDv7 (ADR-0016); no raw UUIDs in participant-facing URLs.
- Two-instrument architecture: Dharma is soulbound (this repo); Artha is transferable and arrives at testnet — not in the web2 experiment.
- Conclusion freeze is 2026-11-05 23:59 UTC; the public dataset (the only place K_eff is derived) is dated 2026-11-06.
- Moderation runs **outside** the bet transaction and fails closed on terminal errors (ADR-0014); the built gate is the OpenAI omni-moderation pre-commit check, with a Sentry CSAM escalation seam (`csam_auto_report_pending`); PhotoDNA/NCMEC integration is parked (`docs/parked.md`).
- RLS out of scope for the experiment (ADR-0019).
- Same-commit doctrine: fixes to guardrail mechanisms are absorbed in-session, never deferred.
- CC on Claude Opus 4.8, pin `claude-opus-4-8` (reverts the 2026-06-10 Fable 5 pin; Fable currently unavailable); subagents pin `model: claude-opus-4-8` / `effort: max`; effort default `max` (highest always); `ultracode` / dynamic workflows default for low-stakes reversible work, **never** critical paths or DDL; `CLAUDE_CODE_EFFORT_LEVEL` retired.
- Enforcement hooks / `permissions.deny` not yet installed — this file is advisory until they are (§6).

**Closing ritual**, every task: "Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this session?" Usually no — the discipline is asking. If yes, same PR, never a follow-up (follow-ups never happen).

---

## 8. Closing rule

**Refuse to weaken the four invariants (§2). Refuse the project triggers (§3). Push back before agreeing (§4). Stay in scope, simplify, log every session, audit before PR (§5). If anything here is wrong, fix it before fixing the code.**

*Rebuilt at SYNC.8 (Jun 2, 2026) against live repo `27216fc` + SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0031; descriptive drift reconciled at BC.1 (Jul 1, 2026) against `248e02f`; SPEC.1/SPEC.2 version citations reconciled at the SYNC sweep (Jul 7, 2026) — SPEC.1 1.0.14, SPEC.2 1.0.17; SPEC.1 cite refreshed to 1.0.15 at SYNC-LITE (Jul 16, 2026). Folded: reply-as-bet, ranking → 0017, two-floor economy → 0018, RLS → 0019, CC → Opus 4.8. Corrected against recon: hooks/skills/`settings.json` not installed; critical-path naming; schema at `src/db/`. Advisory, not enforcement. Maintained per `docs/maintenance.md`.*
