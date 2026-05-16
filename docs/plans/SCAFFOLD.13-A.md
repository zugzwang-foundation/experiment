# SCAFFOLD.13-A — Plan: Postgres cutover from interim Supabase free-tier → production Supabase Pro

**Task ID:** `SCAFFOLD.13-A` (Stratum A of SCAFFOLD.13; Stratum B = Upstash/R2/Doppler env audit, deferred)
**Branch (Phase 2):** `feat/scaffold-13-a` (off `main` at the post-merge SHA of tracker-sweep-v9)
**Predecessors on `main`:** SCAFFOLD.3 @ `62cd299`, tracker-sweep-v9 @ `82bee48`
**Critical path:** YES per CLAUDE.md §1 (`drizzle/migrations/` is in scope — schema is the substrate)
**Plan author:** Claude Code plan-mode session, 2026-05-16
**Plan-review surface:** web Claude chat (per CLAUDE.md §5.1) — Hrishikesh confirms in Claude Code then pastes for sign-off

---

## §1 Context

The repo currently points `DATABASE_URL` (Vercel Production + Preview) at an interim **Supabase free-tier project** wired during SCAFFOLD.3's PR-#38 build (per SCAFFOLD.3 log §"MAINT-10"). The interim project carries two well-known liabilities:

1. **7-day auto-pause** — free-tier projects pause when unused; if the project pauses, any deploy that hits it errors at runtime. Mitigated pre-SCAFFOLD.13 by a daily `pg_dump` cron + R2-age-encrypted off-site bridge (per tracker-sweep-v9 log).
2. **No SLA / no PITR / no native daily backups** — free-tier carries best-effort uptime only.

The infrastructure-subscription strategy locked at tracker-sweep-v9 (`$25/mo Supabase Pro at SCAFFOLD.13 cutover; $20/mo Vercel Pro mid-August 2026; $45/mo at 2026-09-15 launch`) sets the budget envelope. SCAFFOLD.13-A spends the Supabase Pro $25/mo line — it is the SLA + native-backup + PITR substrate swap.

The cutover is **structurally a substrate swap with zero feature delta**:

- The schema is **already version-controlled** in `drizzle/migrations/` (six migrations, `0000..0005`) covering uuidv7 function + 21-table inventory + 12+1 monthly events partitions + 26 append-only trigger declarations + system_state singleton seed + auth schema corrections.
- The interim project carries **no production data** — the experiment launches 2026-09-15; the interim's only writes are SCAFFOLD.3-era dev fixtures (Better Auth onboarding, identity_pool dev-seed). There is **nothing to migrate over the wire**; the new project rebuilds from migrations.
- The application code is **unchanged**. `src/db/index.ts` reads `DATABASE_URL` from env. The swap is one env-var value flip, zero source-tree diff in `src/`.

Per kickoff explicit constraint: **if Claude Code finds itself touching `src/` files for behavioral changes, stop and surface — that signals scope drift.**

### §1.1 Why a NEW Pro project (not an upgrade-in-place)

Per kickoff exit criterion line 1 ("New Supabase Pro project provisioned (ap-south-1, Session pooler port 5432, daily backups enabled, PITR available)") — a fresh project, not an upgrade of the interim. Rationale:

- The interim project was provisioned with whatever free-tier default region was offered at SCAFFOLD.3 build time (region NOT recorded in SCAFFOLD.3 log MAINT-10 — flagged as Open Question Q5 below). Per SPEC.2 §22.1 ADR-0006 row: `Mumbai single-region`. AWS region for Mumbai = **ap-south-1**. If the interim is in a non-Mumbai region, an in-place region transfer is heavyweight; provisioning fresh in ap-south-1 is mechanically simpler.
- Fresh provisioning gives a clean rollback window: interim stays alive during 24h grace, swap is reversible at the Vercel env-var layer alone.
- Pre-launch state has zero data-loss exposure on rebuild.

---

## §2 In scope / Out of scope

### §2.1 In scope (this PR — SCAFFOLD.13-A)

| Item | Substance |
|---|---|
| New Supabase Pro project | ap-south-1 / Mumbai, Session pooler port 5432, daily backups enabled, PITR available |
| Drizzle migration apply | `pnpm drizzle-kit migrate` against new project; all six migrations apply clean in journal order |
| Schema parity verification | SQL suite per §6 comparing new project to interim (or to the canonical schema artifact); ten-query diff yielding zero drift |
| `DATABASE_URL` swap | Vercel Production via CLI; Vercel Preview via dashboard (CLI papercut per SCAFFOLD.3 MAINT-10 absorbed by operator-path workaround, not Doppler) |
| Trigger redeploy | Doc-only commit on `feat/scaffold-13-a` triggers Preview build against new URL; merge to `main` triggers Production deploy |
| Smoke-test pass | Per §7 — Better Auth catch-all reachable + admin login Server Action submits + auth-flow round-trip writes `verifications` row |
| Backup configuration verified | Daily snapshot exists in dashboard after first 24h; PITR window visible in dashboard |
| `pg_dump` cron bridge retirement | Operator cron disabled after cutover smoke-passes (interim's free-tier risk profile is no longer load-bearing) |
| Interim project deletion scheduled | 24h grace from cutover-smoke-pass timestamp; deletion is operator-side dashboard action, NOT this PR |
| `.env.example` housekeeping | Replace stale "interim Supabase / Doppler" notes (line 3 + comment in SCAFFOLD.4 block) with current-state guidance; <2h drift fix per CLAUDE.md §7 cleanup absorption |
| `docs/plans/SCAFFOLD.13-A.md` | This file, promoted from scratch on Phase 2 execute branch |
| `docs/logs/SCAFFOLD.13-A.md` | Six-field log per CLAUDE.md §5.9, written before `gh pr create` |

### §2.2 Out of scope (deferred — separate stratum / future task)

| Item | Deferral target |
|---|---|
| Doppler integration | SCAFFOLD.13-B (Upstash + R2 + DATABASE_URL all-vendor env audit + Doppler-wire). The kickoff explicitly mandates direct Vercel CLI for SCAFFOLD.13-A; Doppler is not on this PR's surface despite tracker-sweep-v9 log §"MAINT-10" mentioning it as eventual home. |
| Upstash credential audit + fold-in | SCAFFOLD.13-B (per SCAFFOLD.3 log §"MAINT-10 (b)" — Upstash keys wired undocumented; needs audit) |
| R2 + Resend env audit | SCAFFOLD.13-B |
| ADR-0006 file mint | PRECURSOR.4 — the SPEC.2 v1.0 lock review mints the 13-ADR file set per §22.1 (the kickoff cites `docs/adr/0006-hosting.md` which currently does not exist; see Open Question Q1) |
| `/api/health` endpoint | HARDEN.* — the smoke surface used in this PR rides existing Better Auth + admin-auth surfaces (see §7 + Open Question Q7) |
| `supabase/migrations/` RLS policies | Not yet present in repo; AGENTS.md §3 names the directory but it carries only `snippets/` today. RLS lock is HARDEN.* per AGENTS.md §6. |
| Sentry alarm wiring | HARDEN.* — append-only-trigger violations + DEFAULT-partition writes alarm-fire only after Sentry wires up |
| Connection-pool tuning | HARDEN.* — current Session pooler default pool size is Supabase default; tune at load-test time |

### §2.3 Source-tree touch surface (what changes in this PR's diff)

```
docs/plans/SCAFFOLD.13-A.md      (NEW — this plan, promoted from scratch)
docs/logs/SCAFFOLD.13-A.md       (NEW — six-field per-session log)
.env.example                     (MODIFIED — drift fix on stale Doppler / "SCAFFOLD.13" notes)
```

**Forbidden surfaces** for this PR:

- `src/**` — no source changes (would signal scope drift per kickoff)
- `drizzle/migrations/**` — append-only at file level per AGENTS.md §6; no new migration ships in this PR
- `src/db/schema/**` — no schema changes
- `tests/**` — no new tests (substrate swap is pre-existing-test-suite-validated; the existing test suite doesn't hit the cloud DB)
- `docs/specs/SPEC.*.md` — no SPEC amendments needed (cutover is procedural; specs don't change)
- `docs/adr/*.md` — no ADR mint (this is operational, not architectural)

---

## §3 Critical-path posture

§1 of CLAUDE.md names `drizzle/migrations/` as a critical path. This PR **reads** the migration set without modifying it (the migration apply is a runtime action against a new substrate). Two consequences for the workflow:

1. **Pre-PR self-audit per CLAUDE.md §5.10 is REQUIRED.** Even though no migration file changes, the parity verification at §6 IS the self-audit's load-bearing artifact. The audit walks the kickoff exit criterion line-by-line and produces PASS / FAIL / SURPRISE per item.
2. **Reviewer-call routing per CLAUDE.md §5.11 fires at two points:**
   - `db-migration-reviewer` after §6 parity verification completes (mandatory; schema-touching surface)
   - `security-auditor` after §8 cutover-rollback procedure documented (mandatory; secrets-handling surface)

`code-reviewer` is NOT invoked (no `src/server/` changes). Per kickoff: "If you find yourself wanting to call it, that's the scope-drift signal."

---

## §4 Kickoff anachronisms (surfaced before planning, not silently absorbed)

Per CLAUDE.md §4 — "Push back when: a task references a stale file, ADR, tracker entry". Surfacing what I found while reading prescribed predecessors:

### §4.1 ADR-0006 file does not exist on disk

The kickoff "Read in order before opening /plan" §5 cites `docs/adr/0006-hosting.md`. The repo contains exactly one ADR file: `docs/adr/0001-license-choice.md`. SPEC.2 §22.1 (the ADR index) names 14 ADRs at SPEC.2 v1.0 lock (13 accepted + 1 in flight) but the v1.0 lock is **not yet shipped** — current SPEC.2 header is `v0.3.1-draft` per tracker-sweep-v9 close. PRECURSOR.4 is the task that mints the ADR file set.

**Resolution for this plan:** I treat **SPEC.2 §22.1 row 0006's row description** (`Hosting topology (Vercel + Supabase + Upstash + Cloudflare R2, Mumbai single-region, pg_cron + Vercel Cron hybrid)`) as the authoritative source for hosting-topology decisions in this task. The downstream procedural choices (ap-south-1, Session pooler, single-region) flow from that row. Surface as Open Question Q1.

### §4.2 SPEC.2 §8.* is Authentication & Sessions, not DB architecture

The kickoff "Read in order" §4 cites `docs/specs/SPEC.2.md §8.* (DB architecture)`. SPEC.2 §8 is actually titled `Authentication & Sessions`. The **DB architecture** spans:

- **SPEC.2 §5** — Data Model — Table Inventory (21 tables, Bucket A/B/C classification)
- **SPEC.2 §6** — Append-Only Enforcement Contract (Bucket A + Bucket B trigger SQL)
- **SPEC.2 §7** — Event Model (events table column shape, monthly partitioning, storage idempotency)

**Resolution for this plan:** I read SPEC.2 §5, §6, §7 in lieu of "§8.* (DB architecture)". The kickoff intent is clear (read whatever covers DB architecture); the section number is a typo. Surface as Open Question Q2.

### §4.3 "SPEC.5" doesn't exist as a separate doc

The kickoff risk register cites "partitioned events table (monthly partitions per SPEC.5)". Per SPEC.2 §22.1's `SPEC.x → ADR-NNNN mapping`, **SPEC.5 is the tracker task that minted ADR-0005** (Postgres + event sourcing). The partitioning DDL itself lives at `drizzle/migrations/0002_events_partitioning.sql` per SPEC.2 §7.2 (12 monthly partitions `events_2026_05..events_2027_04` + DEFAULT partition).

**Resolution for this plan:** I use SPEC.2 §7.2 as the authoritative reference for partition coverage. Surface as Open Question Q3.

### §4.4 `pnpm test` is not a defined script

The kickoff exit criterion line `pnpm test green` doesn't match `package.json` — no `test` script is defined. Per AGENTS.md §2, the canonical test command is `pnpm vitest run`. SCAFFOLD.3 close-out baseline is **58 passed | 5 todo (63 tests) across 9 files**.

**Resolution for this plan:** I interpret "pnpm test green" as `pnpm vitest run` returning the SCAFFOLD.3 baseline (no regressions). Critically, the existing test suite does **not** hit the cloud DB (per `tests/_setup/server-only-shim.ts` + tests/_setup/env.ts shim pattern); test-suite green is independent of the cutover. The cutover's live-DB verification rides on §7 smoke tests, not the vitest suite. Surface as Open Question Q6.

---

## §5 Sub-parts — one per Phase 2 execute reply

Per kickoff: "After plan-review approval, execute one sub-part per reply, wait for Hrishikesh confirmation, never bundle." Sub-parts sequenced for blast-radius minimization: dashboard provisioning before schema apply; schema apply before env swap; env swap before redeploy; redeploy before smoke; smoke before reviewer calls; reviewer calls before PR.

### A1 — Branch + plan promote
**Substance.** From `main` at the post-tracker-sweep-v9 merge SHA, create `feat/scaffold-13-a`. Copy this plan from `~/.claude/plans/moonlit-brewing-sundae.md` to `docs/plans/SCAFFOLD.13-A.md`. Commit as `docs(scaffold-13-a): land approved implementation plan`.
**Output.** Branch ready; plan committed; ready for A2 operator action.
**Touch surface.** `docs/plans/SCAFFOLD.13-A.md` (NEW). Single commit.

### A2 — Operator: provision new Supabase Pro project (DASHBOARD; Hrishikesh)
**Substance.** Hrishikesh in Supabase dashboard:
1. **Create new project**
   - Project name: zugzwang-experiment-prod (mirrors Upstash project name for cross-vendor consistency)
   - Path: `https://supabase.com/dashboard/projects` → `New project`
   - Region: **`ap-south-1` (Mumbai)** — load-bearing per SPEC.2 §22.1 ADR-0006 row
   - Database password: generate fresh 32+ char strong password; capture to operator-side password manager (NEVER commit; NEVER share in chat)
   - Plan: **Pro ($25/mo)** — selected at project-creation step OR via Billing tab post-create
2. **Verify Pro features active**
   - `Settings` → `Database` → confirm:
     - **Daily backups: enabled** (Pro default)
     - **Point-in-Time Recovery: available** (Pro tier carries 7-day PITR window)
   - `Settings` → `Compute` → confirm compute tier (Micro is fine for pre-launch; can scale up at HARDEN.*)
3. **Capture Session pooler connection string**
   - `Settings` → `Database` → `Connection string` tab → `Session pooler`
   - Verify port is **5432** (Session pooler) — NOT 6543 (Transaction pooler — breaks Drizzle prepared statements)
   - Replace the `[YOUR-PASSWORD]` placeholder with the password set in step 1
   - This is the new `DATABASE_URL` value for A6 + A7
4. **Capture interim project diagnostics** (for risk-register completeness AND rollback-capability preservation):
   - **4a.** `Settings` → `General` → confirm region. Note in chat.
   - **4b.** `Settings` → `Database` → `Connection string` → `Session pooler` tab → copy connection string with `[YOUR-PASSWORD]` placeholder substituted. Save to operator-side password manager as `INTERIM_DATABASE_URL`. This is the rollback target for §8.
**Output.** New Supabase Pro project URL + Session pooler connection string captured to operator-side password manager. Interim project region noted in chat.
**Touch surface.** None (operator dashboard work). No commit.
**Refusal trigger check.** No "Dharma transfer", no "send Dharma" endpoint involved. PASS.

### A3 — Apply schema migrations to new project
**Substance.** From the Phase 2 execute terminal:
```bash
# One-shot env override (does NOT write to .env.local — per CLAUDE.md "Never read or write .env* files")
DATABASE_URL='postgres://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' \
  pnpm drizzle-kit migrate
```
**Expected output.** Six migrations apply in journal order: `0000_uuidv7_function.sql`, `0001_initial_schema.sql`, `0002_events_partitioning.sql`, `0003_append_only_triggers.sql`, `0004_seed_system_state.sql`, `0005_auth_schema_corrections.sql`. Drizzle-kit logs each migration name; exit 0 = clean apply.
**Failure mode.** If `drizzle-kit migrate` errors (network unreachable, auth failure, permission error), check Session pooler URL has password substituted + project is unpaused + ap-south-1 reachable from operator's network. **Do not retry destructively** — `drizzle-kit migrate` is idempotent on the journal-cursor level (already-applied migrations are skipped), so a clean retry is safe.
**Output.** Six migrations applied to new project. Drizzle journal cursor at `0005_auth_schema_corrections.sql`.
**Touch surface.** None in the repo. Postgres-side DDL applied.
**Refusal trigger check.** `pnpm drizzle-kit push` is forbidden per AGENTS.md §11 against staging/prod; `pnpm drizzle-kit migrate` (used here) is the safe append-only command. PASS.

### A4 — Schema-parity verification — run §6 SQL suite
**Substance.** Run the ten-query SQL suite from §6 against both endpoints (new Pro project + interim project) and `diff` outputs. Output captured to a session-local scratch file (NOT committed). Each query's results MUST match line-for-line OR have an explainable interim-only state (e.g., interim's `identity_pool.assigned_at` is non-NULL for dev-seed-consumed rows; new project's identity_pool is empty).
**Acceptance.** All ten queries pass per §6 "Pass criterion" column. Drift = FAIL, fix-in-session.
**Output.** Parity-verification artifact (paste into close-out log §"Decisions made"); zero drift confirmed.
**Touch surface.** None in repo.

### A5 — Reviewer call: `db-migration-reviewer`
**Substance.** Fresh-context `general-purpose` Agent invocation per CLAUDE.md §5.11 with role briefing baked into prompt. Prompt template:

> Load `.claude/agents/db-migration-reviewer.md` and follow it verbatim.
> Plan path: `@docs/plans/SCAFFOLD.13-A.md`.
> Tool scope: Read, Grep, Glob, Bash — do NOT Edit or Write.
> Scope: review the schema-parity verification artifact (paste from A4) against SPEC.2 §5 inventory and SPEC.2 §6 trigger contract. Verify:
> - 21 tables present (9 Bucket A + 4 Bucket B + 8 Bucket C per SPEC.2 §5.1)
> - 26 trigger declarations (18 Bucket A + 8 Bucket B per SPEC.2 §6.1)
> - 6 trigger functions (2 shared Bucket A + 4 per-table Bucket B per `drizzle/migrations/0003_append_only_triggers.sql`)
> - 13 events partitions (12 monthly + 1 DEFAULT per `drizzle/migrations/0002_events_partitioning.sql`)
> - 9 enum types (per `drizzle/migrations/0001_initial_schema.sql` lines 1-9)
> - 1 system_state row, frozen_at IS NULL (per `drizzle/migrations/0004_seed_system_state.sql`)
> - uuidv7() function present (per `drizzle/migrations/0000_uuidv7_function.sql`)
> Return PASS / FAIL / SURPRISE per item with `file:line` references.

**Output.** Reviewer report; expected GREEN. Any FAIL fixes in-session before A6. Any SURPRISE writes to `claude-progress.md` and STOPS per CLAUDE.md §5.11.

### A6 — Operator: Vercel env swap — Production (CLI)
**Substance.** Per SCAFFOLD.3 MAINT-10 — Vercel CLI works non-interactively for SINGLE-environment scope (production OR per-preview-branch); the all-preview-branches scope is the broken path. Production is single-environment, so CLI is clean:
```bash
# Belt-and-suspenders: capture current Production value before removing
vercel env ls production --json | jq -r '.[] | select(.key=="DATABASE_URL") | .value' \
  > /tmp/scaffold-13a-prod-database-url.bak.txt
# Verify capture: file is non-empty AND matches interim URL captured at A2.4b
test -s /tmp/scaffold-13a-prod-database-url.bak.txt || \
  { echo "FAIL: env ls capture empty; do NOT proceed with rm"; exit 1; }

# Remove current Production value (interim URL)
vercel env rm DATABASE_URL production --yes

# Add new Production value (new Pro project Session pooler URL)
# Use stdin to avoid shell-history leak of the secret
printf 'postgres://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' \
  | vercel env add DATABASE_URL production
```
**Output.** Production env carries new URL. NOTE: Vercel does NOT auto-redeploy on env change; A8 commit triggers the redeploy.

### A7 — Operator: Vercel env swap — Preview (DASHBOARD; CLI papercut workaround)
**Substance.** Per SCAFFOLD.3 MAINT-10 — CLI rejects `--yes` non-interactive add for the all-preview-branches scope (`{"status":"action_required","reason":"git_branch_required"}`). Dashboard side-wires:
1. `https://vercel.com/<team>/<project>/settings/environment-variables`
2. Locate `DATABASE_URL` row scoped `Preview` (all branches)
3. Click `Edit` → paste new Session pooler URL → `Save`
**Output.** Preview env carries new URL. Same no-auto-redeploy caveat as A6.

### A8 — Reviewer call: `security-auditor`
**Substance.** Fresh-context `general-purpose` Agent invocation per CLAUDE.md §5.11 with role briefing baked into prompt. Prompt template:

> Load `.claude/agents/security-auditor.md` and follow it verbatim.
> Plan path: `@docs/plans/SCAFFOLD.13-A.md`.
> Tool scope: Read, Grep, Glob, Bash — do NOT Edit or Write.
> Scope: review the cutover procedure for secrets-handling exposure and structural-separation invariants. Specifically:
> - `DATABASE_URL` swap procedure (§5 A6 + A7) — does the procedure expose the new password in shell history, logs, or chat? Identify any leak path.
> - Rollback procedure (§8) — is the rollback window adequate (target: <5 min)? Does it preserve the four invariants (CLAUDE.md §2) during the rollback?
> - 24h grace period adequacy — is 24h enough to detect a regression, or should the grace extend?
> - Interim project deletion — does any non-Hrishikesh actor retain credentials? Audit + flag.
> - INV-1 / INV-2 / INV-3 / INV-4 — verify the substrate swap does not enable a path where atomicity, append-only, or side-binding is bypassed during the cutover window.
> Return findings ranked by exploitability with concrete attack scenarios.

**Output.** Reviewer report; expected GREEN. CRITICAL/HIGH findings fix in-session.

### A9 — Trigger Preview redeploy
**Substance.** Push a doc-only commit on `feat/scaffold-13-a`:
```bash
# .env.example drift fix (per §2.1 line "stale Doppler / SCAFFOLD.13 notes") is the natural carrier
git add .env.example
git commit -m "chore(scaffold-13-a): .env.example drift — interim/Doppler notes → current-state guidance"
git push origin feat/scaffold-13-a
```
**Output.** Vercel auto-deploys Preview against new Supabase Pro URL. Watch Vercel dashboard for build status; expected: "Collecting page data using 1 worker" passes without the `Error: DATABASE_URL is not set` failure observed at SCAFFOLD.3 build time.

### A10 — Smoke tests against Preview deploy (operator-driven, live Internet)
**Substance.** Per §7 endpoint list — operator visits Preview URL and exercises:
1. Landing page renders without 500
2. `/(auth)/sign-in` page renders (server-rendered; no DB module-load error)
3. Email-OTP flow submission — type a test email + valid Turnstile token → verify Resend OTP arrives → verify `verifications` table row exists in new Pro project (via `supabase studio` SQL editor)
4. Admin login at `/(admin)/admin/login` — submit `ADMIN_PASSWORD` → verify redirect to `/admin` works → verify `admin_sessions` table has a row in new Pro project
**Acceptance.** All four checks pass. If any fails: rollback procedure §8 fires immediately; investigate offline.
**Output.** Smoke-pass timestamp captured for close-out log + 24h grace clock start.

### A11 — Operator: backup configuration verification (DASHBOARD)
**Substance.** Hrishikesh in Supabase dashboard:
1. `Settings` → `Database` → `Backups` → trigger on-demand snapshot via `Reports` → `Backups` (Pro tier feature). Verifies the backup mechanism works at cutover time — does NOT wait for the +24h first-daily-snapshot window. Capture snapshot completion timestamp.
2. `Settings` → `Database` → `Backups` → confirm daily-snapshot schedule is enabled (the +24h first-snapshot is a soft confirmation post-PR; A15 tracker-row covers verification).
3. `Settings` → `Database` → `Point in Time Recovery` → confirm 7-day window is visible (Pro tier default).
**Output.** On-demand snapshot completion timestamp + daily-schedule status + PITR window confirmed; pasted into close-out log §"Decisions made".

### A12 — Pre-PR self-audit (CLAUDE.md §5.10)
**Substance.** Walk every kickoff exit criterion line, mark PASS / FAIL / SURPRISE with `file:line` or evidence reference. Format per §11 below. FAIL items fix in-session before A14. SURPRISE items per §5.10 (audit catches what plan missed) write into close-out log §"Surprises caught + fixed in-session" with full chain.

### A13 — Write close-out log
**Substance.** `docs/logs/SCAFFOLD.13-A.md` per CLAUDE.md §5.9 six fields:
1. **What landed** — files + PR# (PR# fills on `gh pr create`)
2. **Decisions made** — A2..A11 outcomes + variance from plan + reviewer-call resolutions
3. **Open questions** — none at close (questions in §10 below either resolved at plan-review or absorbed in close-out log §"Decisions")
4. **Next session starts at** — SCAFFOLD.13-B (Doppler + Upstash/R2/Resend env audit) OR ENGINE.6 (events helper) per Hrishikesh's queue ordering
5. **Context to preserve** — new Supabase Pro project URL/ref (operator side, NOT in log); 24h grace deletion clock; interim region; Session pooler port choice rationale
6. **Time** — optional aggregate

### A14 — Open PR
**Substance.** `gh pr create --title "feat(scaffold-13-a): Postgres cutover — interim free-tier → Supabase Pro (ap-south-1)" --body "<HEREDOC>"` referencing plan + log + kickoff exit-criterion table.

### A15 — Post-merge follow-ups (TRACKER ROWS, NOT THIS PR)

- **+24h after A10 cutover-smoke-pass AND PR merged into main (whichever is later)** — operator deletes interim Supabase project from dashboard. Operator-only action; logged as MAINT-row in tracker v9 close-out.
- **At cutover-smoke-pass timestamp** — retire pre-SCAFFOLD.13 `pg_dump` cron bridge (per tracker-sweep-v9 log §"Pre-SCAFFOLD.13 ops bridge"). Operator disables cron; encrypted backup R2 bucket retained for cold-archive ~30d then deleted.
- **SCAFFOLD.13-B kickoff** — Doppler integration + Upstash/R2/Resend env audit (per tracker-sweep-v9 log §"Path A — SCAFFOLD.13 kickoff first" + SCAFFOLD.3 MAINT-10 (b)).

---

## §6 Schema-parity verification SQL suite

Ten queries cross-walk the new Pro project's schema against the canonical migration set + the interim project. Run via `psql` direct connection to each project, capture output to scratch files, `diff` line-for-line. Discrepancies that aren't explainable by interim-dev-fixture state = FAIL.

Run on both endpoints unless noted otherwise. The interim endpoint is the live-reference comparison; the new endpoint is the validate target.

| # | Query | Pass criterion |
|---|---|---|
| 1 | **Table list** — `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;` | 21 base tables per SPEC.2 §5.1 (Bucket A: events, dharma_ledger, bets, comments, resolution_events, payout_events, mod_actions, admin_events, user_events; Bucket B: friendly_fire_events, identity_pool, image_uploads, system_state; Bucket C: users, sessions, accounts, verifications, admin_sessions, markets, pools, positions) PLUS 13 events partitions (`events_2026_05..events_2027_04 + events_default`) PLUS drizzle's internal `__drizzle_migrations` table. Total **35 tables**. |
| 2 | **Column inventory** — `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;` | Every column from `drizzle/migrations/0001_initial_schema.sql` + `0005_auth_schema_corrections.sql` present. NUMERIC(38,18) columns: `bets.stake`, `bets.share_quantity`, `bets.price_at_bet`, `positions.quantity`, `comments.stake_at_post_time`, `dharma_ledger.amount`, `dharma_ledger.balance_after`, `payout_events.amount`, `pools.yes_reserves`, `pools.no_reserves`. UUID columns: every `id` PK + every FK. TIMESTAMPTZ for every `created_at`/`updated_at`/etc. |
| 3 | **Constraints** — `SELECT conrelid::regclass AS table, conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass::text, conname;` | All FKs from `drizzle/migrations/0001_initial_schema.sql` lines 231-258 (~28 FK constraints). CHECK constraint `dharma_ledger_balance_non_negative` present (`balance_after >= 0`, INV-2 ground truth). UNIQUE constraints: `bets_idempotency_key_idx`, `positions_user_market_side_idx`, `friendly_fire_unique_idx`, `identity_pool_tuple_idx`, `sessions_token_unique`, `users_pseudonym_unique`, `markets_slug_unique`, `pools_market_id_unique`, `identity_pool_pseudonym_unique`, `users_email_idx` (unique after 0005). |
| 4 | **Indexes** — `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;` | All `CREATE INDEX` declarations from `drizzle/migrations/0001_initial_schema.sql` lines 259-309 (~40 indexes including partial indexes on `users.banned_at`, `users.google_id`, `dharma_ledger.bet_id`, `bets.idempotency_key`, `identity_pool.assigned_at`). Plus `events_aggregate_idx` from `0002_events_partitioning.sql` line 57 (propagated to all 13 event partitions automatically by Postgres 11+). |
| 5 | **Triggers** — `SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;` | **26 trigger declarations** per `drizzle/migrations/0003_append_only_triggers.sql`. Bucket A: 18 (9 tables × `bucket_a_no_update` + `bucket_a_no_delete`). Bucket B: 8 (4 tables × `bucket_b_update_check` + `bucket_b_no_delete`). Postgres 11+ propagates the partitioned `events` triggers to all 13 partitions — verify via `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgrelid::regclass::text LIKE 'events%';` returns 26 rows on the events partition family (2 × 13 partitions; parent table itself only has FOR EACH ROW propagation, the per-partition copies are what fire). |
| 6 | **Functions** — `SELECT proname, pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f' ORDER BY proname;` | **7 functions**: `uuidv7()` (`0000_uuidv7_function.sql`), `enforce_bucket_a_no_update()`, `enforce_bucket_a_no_delete()`, `enforce_friendly_fire_events_transitions()`, `enforce_identity_pool_assigned_at()`, `enforce_image_uploads_terminal_atomic()`, `enforce_system_state_frozen_at()` (all from `0003_append_only_triggers.sql`). |
| 7 | **Custom types (enums)** — `SELECT t.typname, ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname ORDER BY t.typname;` | **9 enums** per `0001_initial_schema.sql` lines 1-9: `side`, `mod_verdict`, `ff_direction`, `dharma_entry_type` (9 values), `payout_type`, `resolution_event_kind`, `image_terminal_state`, `market_outcome`, `market_status` (7 values). |
| 8 | **Events partitions** — `SELECT inhparent::regclass AS parent, inhrelid::regclass AS partition, pg_get_expr(c.relpartbound, c.oid) AS bound FROM pg_inherits i JOIN pg_class c ON i.inhrelid = c.oid WHERE inhparent = 'events'::regclass ORDER BY partition::text;` | **13 partitions**: 12 monthly (`events_2026_05` through `events_2027_04`) + 1 DEFAULT (`events_default`). Bounds are half-open `[FROM, TO)` per SPEC.2 §7.2. The `events_2026_05` partition is the active month-of-cutover (today is 2026-05-16). |
| 9 | **system_state seed** — `SELECT id, frozen_at IS NULL AS frozen_at_is_null FROM system_state;` | **1 row**: `('system', true)` — singleton per `0004_seed_system_state.sql`; frozen_at NULL until 2026-11-05 23:59 UTC conclusion freeze per SPEC.2 §20.2. |
| 10 | **uuidv7() function smoke** — `SELECT uuidv7();` then `SELECT uuidv7();` then `SELECT uuidv7();` (three times in sequence) | Returns three distinct UUIDs. Per ADR-0016 §1 + `0000_uuidv7_function.sql` lines 11-14: `LANGUAGE sql VOLATILE` + `clock_timestamp()` not `now()` — back-to-back calls inside one transaction MUST return monotonically-increasing UUIDs (millisecond prefix advances per `clock_timestamp()`). If returns identical UUIDs, the function definition is wrong. |

**Capture format.** For each query, run on both endpoints, save to `/tmp/scaffold-13a-q<N>-new.txt` and `/tmp/scaffold-13a-q<N>-interim.txt`. Run `diff -u` and inspect. Discrepancies that aren't dev-fixture state (e.g., consumed identity_pool rows, Better Auth seed users) are FAIL.

**Higher-level alternative** (faster, lossier): `pg_dump --schema-only --no-owner --no-privileges <NEW>` vs `pg_dump --schema-only --no-owner --no-privileges <INTERIM>` and `diff -u`. Captures everything in queries 1-9 plus default privileges + RLS policies (currently none) in one shot. Run this AS WELL as the targeted queries — targeted queries give precise counts; pg_dump diff catches surprises the targeted queries miss.

---

## §7 Smoke-test endpoint list + green criteria

Per Open Question Q7 — `/api/health` does not exist (currently nothing in `src/app/api/` except `auth/[...all]/route.ts`). Smoke surface rides existing endpoints:

| Step | Endpoint | What it confirms | Green criterion |
|---|---|---|---|
| 1 | Landing page (`/`) | Server renders without `Error: DATABASE_URL is not set` | HTTP 200, no module-load DB error in Vercel runtime logs |
| 2 | `/(auth)/sign-in` | Sign-in page server-renders (DESIGN.* placeholder per SCAFFOLD.3 MAINT-9; doesn't yet make DB call at SSR time) | HTTP 200 |
| 3 | `/(admin)/admin/login` GET | Admin login form server-renders | HTTP 200 |
| 4 | Admin login Server Action (POST submit with correct `ADMIN_PASSWORD`) | Writes a row to `admin_sessions` table via SERIALIZABLE DELETE+INSERT per SPEC.2 §8.4 | Redirect to `/admin` + verify `SELECT COUNT(*) FROM admin_sessions;` returns 1 in new Pro project |
| 5 | Better Auth Email-OTP request (`/api/auth/email-otp/send-verification-otp` POST with valid email + Turnstile token) | Cloudflare Turnstile validates + Resend invokes (out-of-process) + Better Auth writes a `verifications` row in DB | Resend email arrives at test inbox; `SELECT COUNT(*) FROM verifications;` returns 1 in new Pro project |
| 6 | Better Auth Email-OTP verify (submit OTP from Resend email) | Better Auth reads `verifications`, validates code, runs `databaseHooks.user.create.before` (consumes `identity_pool`), writes `users` row | New row in `users`; `assigned_at` set on first available `identity_pool` row |

**Failure modes mapped to rollback:**
- Step 1 fails with `DATABASE_URL is not set` → env not yet swapped or value wrong; check Vercel env settings.
- Step 1 fails with `connection refused` / `ECONNREFUSED` → Session pooler URL has wrong port (must be 5432) OR project paused (Pro shouldn't pause, but verify status in Supabase dashboard).
- Step 4 fails with `admin_login_invalid` → `ADMIN_PASSWORD` env mismatch (unrelated to cutover); not a rollback trigger.
- Step 5 fails with timeout → Cloudflare Turnstile network issue OR Resend outage — verify against status pages before rolling back.
- Step 6 fails on identity_pool consumption → `identity_pool` not seeded in new project. Run `pnpm seed:identity-pool:dev` against the new DATABASE_URL (per SCAFFOLD.3 dev-seed script).

---

## §8 Cutover rollback procedure

**Target rollback window:** <5 minutes from smoke-fail decision to interim URL serving traffic.

**Trigger.** Any smoke step 1-6 fails AND the failure is deterministically attributable to the new Pro project (NOT to upstream vendor outage — Turnstile / Resend / Vercel control plane).

**Rollback sequence:**

1. **Re-swap Production DATABASE_URL** (CLI; operator-driven from terminal):
   ```bash
   vercel env rm DATABASE_URL production --yes
   printf '<INTERIM-DATABASE-URL>' | vercel env add DATABASE_URL production
   ```
   The interim DATABASE_URL is captured to operator-side password manager at A2 step 4b (primary) AND to `/tmp/scaffold-13a-prod-database-url.bak.txt` at A6 (secondary). Either source is sufficient for rollback; use 4b first.

2. **Re-swap Preview DATABASE_URL** (dashboard; CLI papercut):
   - `https://vercel.com/<team>/<project>/settings/environment-variables` → DATABASE_URL Preview → `Edit` → paste interim URL → `Save`

3. **Re-deploy** to pick up reverted env:
   - `vercel redeploy <preview-deploy-url>` for Preview (uses last commit's build with new env)
   - For Production: `git revert` the doc-only commit from A9 + push → triggers Vercel auto-deploy

4. **Verify rollback** — re-run §7 smoke steps 1-6 against the re-deployed Preview + Production. All should pass against interim (since interim was green for SCAFFOLD.3 + SCAFFOLD.4).

5. **Operator post-rollback** — open `docs/logs/SCAFFOLD.13-A.md` rollback section + capture failure mode for re-attempt diagnosis.

**Within how many minutes.** Steps 1+2 take <2 minutes via dashboard. Step 3 redeploy is ~60-90 seconds. Step 4 verification is ~2 minutes manual. **Total target: <5 minutes per kickoff Risk register.**

**No data loss.** Pre-launch state — interim still carries dev fixtures from SCAFFOLD.3 era; rollback is non-destructive.

---

## §9 Risk register

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | **Connection pooling — Session vs Transaction** — Drizzle uses prepared statements. Transaction pooler (port 6543) drops prepared statement state between transactions, breaking Drizzle. Session pooler (port 5432) preserves session state — correct choice. | Medium (operator might copy wrong URL) | A2 step 3 explicitly verifies port is 5432; A5 db-migration-reviewer cross-checks |
| R2 | **IPv4 vs IPv6 reachability** — Vercel runtime is IPv4-only on free + Pro tiers. Supabase Direct connection is IPv6-only. Session pooler routes via IPv4. Per SCAFFOLD.3 MAINT-10 (a). | Medium (default Supabase connection-string display sometimes shows Direct first) | A2 step 3 selects "Session pooler" tab explicitly — NOT "Direct connection" or "Transaction pooler" |
| R3 | **Region mismatch latency during cutover window** | Low (cutover is atomic at env-swap; no traffic-straddle; pre-launch = no real users) | Risk is theoretical — no data migration over wire; new project is built from migrations applied via `pnpm drizzle-kit migrate`. Interim region noted at A2 step 4 for risk-register completeness only. |
| R4 | **Migration apply ordering** — six migrations must apply in journal order; out-of-order = broken state | Low (drizzle-kit reads `_journal.json` and applies in order; manual operator intervention is the only way to break this) | A3 invokes `pnpm drizzle-kit migrate` (the safe append-only command, NOT `pnpm drizzle-kit push`); A5 db-migration-reviewer verifies all 6 migrations applied |
| R5 | **Partition initial-month creation** — events_2026_05 must exist on day-of-cutover for current writes to route correctly (today is 2026-05-16; partition range FROM '2026-05-01' TO '2026-06-01' covers it) | Low | A4 query 8 verifies all 13 partitions exist with correct bounds |
| R6 | **Append-only trigger preservation** — 26 triggers + 6 functions must apply via 0003 migration. A trigger that fails to install = INV-2 / INV-3 / INV-4 enforcement gap | Low (drizzle-kit migrate applies SQL atomically; partial install = error + rollback) | A4 query 5 + query 6 verify trigger + function counts match SPEC.2 §6.1 contract; A5 db-migration-reviewer cross-checks per-table |
| R7 | **NUMERIC(38,18) precision parity** — Dharma + bet stake columns must preserve full 38-digit precision. Postgres NUMERIC is precise; both projects are PG 17. | Very Low | A4 query 2 confirms types match |
| R8 | **`uuidv7()` function presence** — every PK depends on this user-space function | Low (0000 migration runs first per journal) | A4 query 6 + query 10 verify presence + functional behavior |
| R9 | **CLI papercut for Preview env all-branches scope** | High (per SCAFFOLD.3 MAINT-10 evidence) | A7 prescribes dashboard workaround explicitly |
| R10 | **Trigger redeploy** — Vercel does NOT auto-redeploy on env change | High (default Vercel behavior) | A9 pushes a doc-only commit on `feat/scaffold-13-a` to trigger Preview auto-deploy. Merge to main triggers Production. |
| R11 | **Secret exposure during swap** — `--value <secret>` flag risks shell-history leak | Medium | A6 uses `printf '...' \| vercel env add` via stdin pattern to keep secret out of shell history. Operator follows same pattern at A7 (dashboard handles secret-display masking natively). |
| R12 | **Interim auto-pause during cutover** — free-tier paused interim makes rollback impossible (cannot re-target a paused project without first unpausing) | Medium (7-day auto-pause clock from last interim activity) | Operator ensures interim is touched within 24h before A6 (e.g., visit Supabase dashboard) to keep its activity clock fresh; alternatively, capture interim URL + auth credentials to operator-side password manager in advance |
| R13 | **24h grace period inadequate** — regression discovered >24h after cutover = interim already deleted, no fast rollback | Low (smoke tests are deterministic; regressions surface within minutes) | If A10 smoke passes, regressions in the 24h window have <24h to surface; if discovered post-deletion, restore from Pro project's PITR (the substitute durability mechanism) |
| R14 | **Interim auto-pause during multi-session Phase 2 execution** — Phase 2 executes one sub-part per reply with operator-confirmation gates. Sub-parts may straddle multiple sessions over hours or days. Interim's 7-day auto-pause clock advances independently. If interim pauses between A2 and A10, three operations break: A4 parity diff (needs interim queryable), A6 belt-and-suspenders sanity ping (needs interim reachable), §8 rollback (needs interim unpaused). | Medium (depends on Phase 2 calendar) | Operator touches interim Supabase dashboard at the START of each Phase 2 session — visit dashboard URL, confirm project is not paused, refresh activity clock. Ritual continues until A10 smoke-passes (after which interim is no longer load-bearing and the 24h grace clock takes over). |

---

## §10 Open questions

Resolution paths annotated. Plan proceeds with the **proposed resolution**; web Claude plan-review confirms or amends.

| Q | Question | Proposed resolution |
|---|---|---|
| Q1 | Kickoff cites `docs/adr/0006-hosting.md`. File does not exist (§4.1). | Treat SPEC.2 §22.1 ADR-0006 row description as authoritative for hosting-topology decisions. ADR file mint is PRECURSOR.4's work, not SCAFFOLD.13-A's. |
| Q2 | Kickoff cites `SPEC.2 §8.* (DB architecture)`. §8 is Authentication & Sessions (§4.2). | Read SPEC.2 §5 + §6 + §7 in lieu. Document kickoff-text typo as MAINT-row in tracker v9 (operator surface; not this PR). |
| Q3 | Kickoff cites `SPEC.5` for partitioning. No SPEC.5 doc exists (§4.3). | Treat as shorthand for `ADR-0005` ratification (which lives in SPEC.2 §22.1 ADR row) + the partition DDL at `drizzle/migrations/0002_events_partitioning.sql` + the partition contract at SPEC.2 §7.2. |
| Q4 | Doppler integration scope — tracker-sweep-v9 log §"Path A — SCAFFOLD.13 kickoff first" includes "Doppler-wired staging + production DATABASE_URL". Kickoff for SCAFFOLD.13-A omits Doppler. | Defer Doppler integration to SCAFFOLD.13-B. SCAFFOLD.13-A uses direct Vercel env management. Stratum B scope per tracker-sweep-v9 covers full env audit across all four vendors (Supabase DATABASE_URL, Upstash, R2, Resend) PLUS Doppler-wiring — not Doppler-alone. The SCAFFOLD.13-B kickoff template must reflect this broader scope when written. |
| Q5 | Interim Supabase project region. SCAFFOLD.3 MAINT-10 (a) does not record it. | A2 step 4 captures interim region for risk-register completeness. Plan does not block on resolution — A2 work proceeds with operator dashboard inspection. |
| Q6 | Kickoff exit criterion `pnpm test green` — script not defined (§4.4). | Interpret as `pnpm vitest run` returning SCAFFOLD.3 baseline (58 pass, 5 todo). The test suite is independent of the cutover (uses module-load shims, not cloud DB). |
| Q7 | Smoke-test endpoint list — kickoff implies `/api/health` exists. It does not (only `/api/auth/[...all]/route.ts` in `src/app/api/`). | Use §7 ride-existing-endpoints approach (Better Auth + admin login + Email-OTP). Document `/api/health` as HARDEN.* deliverable. Note: §7 smoke coverage exercises auth-path code only; non-auth schema (markets, pools, bets, events partitions, etc.) is verified by §6 parity SQL suite at A4, NOT by A10 smoke. Pre-launch this is adequate — non-auth code is not yet wired. Post-launch, `/api/health` with non-auth probes is HARDEN.* scope. |
| Q8 | `pg_dump` cron bridge retirement timing — tracker-sweep-v9 says "retire when SCAFFOLD.13 swaps to Pro with native PITR". After A10 smoke-pass or after A11 backup-verify? | After A10 smoke-pass — at the cutover-smoke-pass moment, native PITR is live (Pro tier default; A11 verifies the dashboard surface). A11's verification is a confirmation step, not a gate. |
| Q9 | 24h interim deletion grace — kickoff prescribes 24h, not 7d. Confirm. | 24h matches kickoff. Clock origin: A10 cutover-smoke-pass timestamp (operational-proof moment, not PR-merge). Guard: deletion proceeds only if PR has merged AND smoke-pass timestamp is >24h old. If PR still open at +24h, deletion waits. |
| Q10 | Vercel Preview env all-branches scope — confirms ALL preview branches use the new URL (not just `feat/scaffold-13-a`)? | Yes — Preview scope in Vercel is "all preview branches" unless per-branch overrides exist. Per SCAFFOLD.3 history, no per-branch overrides are configured. A7 dashboard action sets the all-branches Preview value. |

---

## §11 Self-audit checklist (CLAUDE.md §5.10)

Per kickoff: "Self-audit per §5.10 before `gh pr create`." Run at A12, after A1-A11 completion. Format: PASS / FAIL / SURPRISE per item with `file:line` or evidence reference.

| Audit item | Source criterion | Verification method |
|---|---|---|
| Plan committed before code | CLAUDE.md §5.1 "Plan file must be committed before Phase 1 ends" | `git ls-files docs/plans/SCAFFOLD.13-A.md` returns path |
| New Supabase Pro project in ap-south-1 | Kickoff exit-1 + SPEC.2 §22.1 ADR-0006 | A2 step 1 confirmed |
| Session pooler port 5432 | Kickoff exit-1 + SCAFFOLD.3 MAINT-10 (a) | A2 step 3 confirmed |
| Daily backups enabled | Kickoff exit-1 | A11 step 1 confirmed |
| PITR available | Kickoff exit-1 | A11 step 2 confirmed |
| All 6 drizzle migrations applied | Kickoff exit-2 | `pnpm drizzle-kit migrate` output at A3; SQL query against `__drizzle_migrations` table shows 6 entries |
| Schema parity (zero drift) | Kickoff exit-3 | §6 queries 1-10 run at A4; diff empty per query; A5 db-migration-reviewer reports GREEN |
| DATABASE_URL swapped Vercel Prod | Kickoff exit-4 | `vercel env ls production` shows new Pro project URL |
| DATABASE_URL swapped Vercel Preview | Kickoff exit-4 | Vercel dashboard `Settings → Environment Variables` shows Preview scope = new URL |
| pnpm tsc --noEmit exit 0 | Kickoff exit-5 | Run at A12; capture output |
| pnpm biome check . zero fixes | Kickoff exit-6 | Run at A12; capture output |
| pnpm vitest run green | Kickoff exit-7 (interpreted per Q6) | Run at A12; matches SCAFFOLD.3 baseline (58 pass, 5 todo) |
| Vercel Production deploy green | Kickoff exit-8 | Vercel dashboard shows merge-to-main deploy succeeded |
| Vercel Preview deploy green | Kickoff exit-8 | Vercel dashboard shows feat/scaffold-13-a Preview deploy succeeded |
| Backup configuration verified | Kickoff exit-9 | On-demand snapshot completion timestamp captured at A11 step 1 (mandatory cutover-time verification per Part 4 amendment); PITR 7-day window confirmed at A11 step 3. Daily-snapshot schedule enabled (A11 step 2) is a soft confirmation — first scheduled snapshot lands +24h post-create, verified at A15 tracker-row. |
| Interim deletion scheduled (24h grace) | Kickoff exit-10 | Tracker v9 MAINT-row added; operator calendar reminder set |
| Close-out log written before PR | Kickoff exit-11 + CLAUDE.md §5.9 | `git log --oneline` shows log commit precedes `gh pr create` |
| db-migration-reviewer invoked + GREEN | Kickoff §"Subagent invocations" | A5 output appended to close-out log §"Reviewer-call invocation summary" |
| security-auditor invoked + GREEN | Kickoff §"Subagent invocations" | A8 output appended to close-out log §"Reviewer-call invocation summary" |
| code-reviewer NOT invoked | Kickoff §"Subagent invocations" | Absence-of-invocation is the audit item; confirmed by walking close-out log |
| No `src/` changes | Kickoff scope-drift gate | `git diff main -- src/` returns empty |
| No `drizzle/migrations/` changes | Kickoff scope-drift gate | `git diff main -- drizzle/migrations/` returns empty |
| `.env.example` drift fix | §2.1 housekeeping | `git diff main -- .env.example` shows <2h drift fix |

---

## §12 Reviewer-call routing summary (CLAUDE.md §5.11)

Per §5.11's invocation policy table:

| Reviewer | Phase | When | Tool scope | Briefing | Plan path |
|---|---|---|---|---|---|
| `db-migration-reviewer` | A5 (post-A4 parity verification) | After §6 SQL suite captures parity artifact | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/db-migration-reviewer.md` | `@docs/plans/SCAFFOLD.13-A.md` |
| `security-auditor` | A8 (post-A6/A7 env swap) | After Production + Preview env-swap procedures completed | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-A.md` |
| `code-reviewer` | — | NOT invoked | — | — | — |
| `test-writer` | — | NOT invoked (no new business-logic behavior) | — | — | — |

Three required prompt elements per CLAUDE.md §5.11 enforced in A5 + A8 prompt templates above. FAIL findings within scope → fix in-session; SURPRISE findings outside scope → `claude-progress.md` + STOP.

---

## §13 Exit criterion (mirrors kickoff verbatim; PR opens only after all green)

| # | Criterion | Audit reference |
|---|---|---|
| 1 | New Supabase Pro project provisioned (ap-south-1, Session pooler port 5432, daily backups enabled, PITR available) | §11 items 2-5 |
| 2 | All drizzle migrations applied to new project | §11 item 6 |
| 3 | Schema parity vs interim verified (zero drift on table list, column types, constraints, indexes, triggers, functions) | §11 item 7 + §6 |
| 4 | DATABASE_URL swapped across Vercel Prod + Preview | §11 items 8-9 |
| 5 | pnpm tsc --noEmit exit 0 | §11 item 10 |
| 6 | pnpm biome check . zero fixes | §11 item 11 |
| 7 | pnpm test green (interpreted: `pnpm vitest run` per Q6) | §11 item 12 |
| 8 | Vercel Production + Preview deploys both green against new Supabase Pro | §11 items 13-14 |
| 9 | Backup configuration verified (snapshot test + PITR window check) | §11 item 15 |
| 10 | Interim project deletion scheduled (24h grace, not immediate) | §11 item 16 |
| 11 | docs/logs/SCAFFOLD.13-A.md written before gh pr create | §11 item 17 |

---

## §14 Close-out log shape preview (CLAUDE.md §5.9 — written at A13)

Six fields per CLAUDE.md §5.9; sections drafted in advance below so A13 has a fast-fill template:

```markdown
# SCAFFOLD.13-A — Postgres cutover to Supabase Pro

**Status:** Closed <YYYY-MM-DD>
**Branch:** feat/scaffold-13-a (N commits; head <SHA>); pre-merge at log-write time
**PR:** to fill on open
**Predecessor:** tracker-sweep-v9 (`docs/logs/tracker-sweep-v9.md`, `main` at <merged-SHA>)
**Unblocks:** SCAFFOLD.13-B (Doppler + Upstash/R2/Resend env audit); HARDEN.* connection-pool tuning; HARDEN.* backup-runbook + restore-drill

## What landed (§5.9 field 1)
- New Supabase Pro project provisioned in ap-south-1 with Session pooler @ 5432, daily backups, PITR
- 6 drizzle migrations applied to new project
- DATABASE_URL swapped Vercel Production (CLI) + Preview (dashboard)
- Vercel Preview + Production both green against new project
- .env.example drift fix (line 3 + SCAFFOLD.4-block comment)
- Plan + log committed; interim deletion scheduled +24h

## Decisions made (§5.9 field 2)
- Q1-Q10 resolutions (per plan §10)
- Reviewer-call invocation summary (A5 db-migration-reviewer GREEN; A8 security-auditor GREEN)
- Surprises caught + fixed in-session (CLAUDE.md §5.10 working-as-designed; full chain per audit)

## Open questions (§5.9 field 3)
- (Expected) none at close

## Next session starts at (§5.9 field 4)
- SCAFFOLD.13-B kickoff (Doppler integration + Upstash/R2/Resend env audit) OR ENGINE.6 (events helper at src/server/events/insert.ts) per Hrishikesh's queue ordering

## Context to preserve (§5.9 field 5)
- New Supabase Pro project (name: zugzwang-experiment-prod) ref + Session pooler URL — operator-side password manager, NOT in log
- Interim project region (captured A2 step 4) — for risk-register history
- 24h grace deletion clock — origin = A10 smoke-pass timestamp; guard = PR-merged-into-main; deletion proceeds only when both conditions satisfied. Operator calendar reminder + tracker v9 MAINT-row.
- Session pooler port 5432 rationale (IPv4 + prepared-statement support) — repeat in SCAFFOLD.13-B for Doppler-wired URL discipline
- `pg_dump` cron bridge retired (per Q8 — at cutover-smoke-pass moment)

## Time (§5.9 field 6 — optional)
<rough estimate>
```

---

## §15 Sign-off

Plan ready for review. Web Claude review per CLAUDE.md §5.1; Hrishikesh confirms in Claude Code then pastes for sign-off. **Stop after plan; do not execute until web Claude plan-review approval lands** (per kickoff). Phase 2 begins at A1 in a fresh session post-approval; one sub-part per reply, no bundling.
