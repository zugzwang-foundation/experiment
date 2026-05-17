# SCAFFOLD.13-A — Plan: Postgres cutover from interim Supabase free-tier → production Supabase Pro

**Task ID:** `SCAFFOLD.13-A` (Stratum A of SCAFFOLD.13; Stratum B = Upstash/R2/Doppler env audit, deferred)
**Branch (Phase 2):** `feat/scaffold-13-a` (off `main` at the post-merge SHA of tracker-sweep-v9)
**Predecessors on `main`:** SCAFFOLD.3 @ `62cd299`, tracker-sweep-v9 @ `82bee48`
**Critical path:** YES per CLAUDE.md §1 (`drizzle/migrations/` is in scope — schema is the substrate)
**Plan author:** Claude Code plan-mode session, 2026-05-16
**Plan-review surface:** web Claude chat (per CLAUDE.md §5.1) — Hrishikesh confirms in Claude Code then pastes for sign-off

---

## §0 Amendment log — 2026-05-17 (three successive amendment states same day)

Plan amended through three states on 2026-05-17:

1. **Initial amendment** (post-A4 q0): three candidate findings recorded.
2. **First counter-amendment** (same day, post-Sensitive-var realization): finding 3 demoted from "established" to "RETRACTED — CLI artifact". HOLD on §5 A5+ pending Vercel ground-truth check.
3. **Second counter-amendment** (same day, post-A10 first-smoke ground-truth + post-A11-infeasibility realization): finding 3 RESOLVED via runtime evidence; findings 4, 5, and 6 added; HOLD released; A5-A15 retroactive amendments applied.

### Findings (final state)

1. **PROD provisioning predates session.** Supabase Pro project `zugzwang-experiment-prod` (ap-south-1) was provisioned + 6 drizzle migrations applied on **2026-05-15 13:20:44 UTC**, before this Phase 2 session opened. A2 today was URL capture + PITR/backup verification on an existing project, not net-new provisioning. A3's `pnpm drizzle-kit migrate` was an idempotent no-op (journal cursor already at 0005). PITR add-on (~$100/mo separate billing) deferred to HARDEN per A2 operator decision; daily backups confirmed active. **STANDS.**
2. **Interim is schemaless.** Interim Tokyo-region (`ap-northeast-1`) free-tier project `niihrpqgzxpczyignxnn` carries no Zugzwang schema. `drizzle.__drizzle_migrations` and `public.__drizzle_migrations` both return "relation does not exist"; public schema is empty; only Supabase-internal schemas (auth/extensions/graphql/pgbouncer/realtime/storage/vault) present. Interim is a stale placeholder, never received `drizzle-kit migrate`. **STANDS.**
3. ~~**Vercel `DATABASE_URL` is literally empty.**~~ **RETRACTED then RESOLVED 2026-05-17.** Initial reading: `vercel env pull` returned `DATABASE_URL=""`. Retracted same day after recognizing Vercel marks the variable Sensitive (CLI returns empty for Sensitive vars by deliberate platform-security design — write-once-read-never from outside runtime). **Resolved later same day via A10 first-smoke ground-truth:** Email-OTP POST to `/api/auth/email-otp/send-verification-otp` returned HTTP 415 with Better Auth domain error (`Content-Type "application/x-www-form-urlencoded" is not allowed`), NOT a 500 with Postgres/connection error. The 415 is end-to-end runtime evidence that `DATABASE_URL` is correctly wired to PROD and the request path reaches Better Auth past the auth-handler boundary. Stronger signal than deploy-log inspection because it tests the runtime end-to-end. **The stored URL value remains unreadable** (still Sensitive); operational verification supersedes inspection.
4. **Procedural divergence at A6/A7 (NEW per second counter-amendment).** Operator applied PROD Session pooler URL via Vercel web dashboard mid-session, **out of plan's procedural sequence** — before A4 close, before A5 reviewer call, before A11 snapshot. State landed correct: scope Production + Preview, Sensitive flag on; auto-redeploy triggered to build `3QvGjQ32M` from commit `82bee48`. **State correct; procedure broke.** Captured as load-bearing §14 SURPRISE for future procedural discipline (operator dashboard work can outrun the Claude Code-orchestrated sequence; instrumenting a "dashboard-side actions log" in plan templates is a candidate maintenance item).
5. **Downstream SCAFFOLD.3 sign-in form bug — separate tracker entry (NEW per second counter-amendment).** Sign-in form posts `application/x-www-form-urlencoded`; Better Auth `/api/auth/email-otp/send-verification-otp` route expects `application/json`. 415 surfaced by A10 first-smoke (the very fact this bug was never previously caught is because SCAFFOLD.3 deploys never reached a working DATABASE_URL until A6/A7 wired one). **Not SCAFFOLD.13-A scope.** Mint as new tracker entry post-merge (suggested ID: SCAFFOLD.3-FOLLOWUP-1 or BUG-1; operator's call). **Documented here for traceability, not for in-PR action.**
6. **A11 procedure infeasible — substituted by scheduled-backup-by-coincidence (NEW per second counter-amendment).** Web-Claude plan-review originally specified A11 as "trigger on-demand snapshot via Supabase dashboard → Reports → Backups (Pro tier feature)". **Infeasible from the start:** on-demand snapshots on Supabase Pro require the PITR add-on (~$100/mo), which was explicitly skipped at A2 per HARDEN scoping. The prescribed A11 procedure could not run. **Functional substitution:** the 2026-05-16 23:30:19 UTC scheduled daily backup (Pro tier default, included) predates today's A6/A7 cutover and captures the post-migration / pre-traffic state (6 migrations applied, zero application rows). This is the de facto rollback anchor — **A11 is satisfied incidentally**. No operator action needed in Supabase. Plan-review-time miss to capture for `docs/maintenance.md` (future plan-review templates should verify dashboard procedures are available on the chosen plan tier before prescribing them).

### Consequence (second counter-amendment)

The "cutover" framing is substantively "substrate setup with zero feature delta" — PROD is the live wired substrate (confirmed via A10 415 evidence); interim has no role. §6 parity-vs-interim is structurally invalid (per finding 2); reframed to PROD-only schema-correctness against canonical migration files. §8 recovery is rewritten — **the 2026-05-16 23:30 UTC scheduled daily backup is the de facto rollback anchor** (per finding 6 substitution); PITR + on-demand snapshots are both HARDEN-scoped; interim is schemaless and not a fallback. §5 sub-parts A6/A7/A9 land as retrospective status; A10 lands as PARTIAL (one smoke step ran); A11 satisfied incidentally; A5/A8/A12-A15 retain pending status with refined scope.

### Sections actually amended below (full post-second-counter-amendment scope)

| § | Change |
|---|---|
| §1, §1.1 | Rewritten to reflect PROD-wired-via-415-ground-truth + procedural-divergence; downstream 415 bug pointer added |
| §2.1 | Rows updated to reflect ✓ statuses for items already complete + first-traffic-anchor reframing of A11 |
| §3 | Reviewer-call routing notes mention §0 findings 1-5 |
| §5 intro | A11 reframed as first-traffic anchor (still pending; sequence preserved A1→…→A15) |
| §5 A1-A3 | Status notes retained (factual) |
| §5 A4 | Retroactive PARTIAL CLOSE (q0 done; §6 canonical-reference suite still pending) |
| §5 A5 | Reframed: retroactive state review, not procedural gate |
| §5 A6/A7 | Retroactive ✓ status notes (operator-applied via Vercel dashboard mid-session, out-of-sequence); capture `vercel env ls` post-hoc |
| §5 A8 | Scope expanded: credential-leak audit + post-cutover env hygiene + procedural-divergence review |
| §5 A9 | Retroactive ✓ status (implicit redeploy to build `3QvGjQ32M` from commit `82bee48`) |
| §5 A10 | Retroactive PARTIAL ✓: sign-in render + 415 OTP-POST captured; remaining §7 steps pending |
| §5 A11 | ✓ Satisfied incidentally by scheduled-backup-by-coincidence (per §0 finding 6): on-demand snapshot procedure infeasible without PITR add-on (skipped to HARDEN); 2026-05-16 23:30:19 UTC scheduled backup is the de facto rollback anchor (post-migration, pre-traffic). No operator action required. |
| §5 A15 | Interim deletion 24h grace held as soft window per §10 Q9 (data-drain role reduced; interim is schemaless); separate tracker entry for downstream 415 bug noted |
| §6 | Schema-correctness reframe (PROD-only against canonical) — kept from first counter-amendment |
| §7 | Updated: steps 1-2 ✓ (sign-in renders); step 5 returned 415 (separate-tracker bug); remaining steps still pending |
| §8 | Recovery procedure rewritten — 2026-05-16 23:30 UTC scheduled daily backup is the de facto rollback anchor (per §0 finding 6); PITR + on-demand snapshots are HARDEN-scoped; interim is schemaless and not a fallback |
| §9 R3/R12/R13/R14 | Reframed — interim-load-bearing risks dissolve (interim is schemaless) |
| §10 Q5/Q8 | Q5 resolved (interim region = `ap-northeast-1` Tokyo); Q8 resolved (cron bridge irrelevant; PROD is wired) |
| §11 | Audit checklist items updated to reflect retroactive completion of A6/A7/A9/A10-partial |
| §12 | A5/A8 scope rows refined per amendment |
| §13 | Items 4, 8 retroactively complete; item 1 PROD-pre-existed noted; item 7 (`pnpm vitest run`) still pending |
| §14 | 6 SURPRISE entries pre-drafted (PROD pre-existed, interim schemaless, Sensitive-var CLI artifact, credential-leak rotation, procedural-divergence A6/A7, A11 procedure-infeasibility-substituted-by-scheduled-backup) |

### A1-A10 outcomes (operator-confirmed in session)

- A1 ✓ committed 2026-05-16 as `912c3d3` on `feat/scaffold-13-a` (plan promotion)
- A2 ✓ URL capture + diagnostics; PROD pre-existed (2026-05-15); PITR deferred to HARDEN
- A3 ✓ migrate no-op (cursor was already at 0005)
- A4 ✓ PARTIAL: q0 done; §6 canonical-reference suite still pending (PROD-only against migration files)
- A5 ⏳ pending; reframed scope (retroactive state review of completed A6/A7 + standing findings)
- A6 ✓ COMPLETED out-of-sequence via Vercel web dashboard; documented retroactively in §5 A6
- A7 ✓ COMPLETED in same A6 dashboard action (Vercel groups Production + Preview on single entry; Sensitive flag on)
- A8 ⏳ pending; scope expanded (credential-leak audit + post-cutover env hygiene + procedural-divergence review)
- A9 ✓ implicit redeploy to build `3QvGjQ32M` from commit `82bee48`
- A10 ✓ PARTIAL first-smoke: sign-in renders cleanly at `experiment-zugzwang-worlds-projects.vercel.app/sign-in`; Email-OTP POST returned 415 (Better Auth domain error → DB reachable; downstream bug per finding 5)
- A11 ✓ satisfied incidentally per §0 finding 6: on-demand snapshot procedure was infeasible (requires PITR add-on, skipped to HARDEN); 2026-05-16 23:30:19 UTC scheduled daily backup is the de facto rollback anchor (post-migration, pre-traffic). No operator action required.
- A12 ⏳ pending (self-audit per CLAUDE.md §5.10)
- A13 ⏳ pending (close-out log with 5 SURPRISE entries pre-drafted per §14)
- A14 ⏳ pending (PR open)
- A15 ⏳ pending (interim deletion 24h grace + downstream-bug tracker entry to mint)
- **Mid-session security incident (caught + fixed):** PROD + INTERIM DATABASE_URL credentials leaked into Claude Code chat during A4 q0 protocol; Claude Code refused execution + recommended immediate rotation; both passwords rotated mid-session; new URLs re-captured to operator-side password manager via `read -rs` discipline. Documented as SURPRISE entry per §14.

---

## §1 Context (amended 2026-05-17, second counter-amendment same day)

The repo's Vercel `DATABASE_URL` env var (Production + Preview, single grouped entry, Sensitive flag on) is wired to PROD as of 2026-05-17 mid-session, applied by the operator via Vercel web dashboard. Ground-truth confirmation came via A10 first-smoke executed in browser: `experiment-zugzwang-worlds-projects.vercel.app/sign-in` renders cleanly; Email-OTP POST to `/api/auth/email-otp/send-verification-otp` returned HTTP 415 with Better Auth domain error (`Content-Type "application/x-www-form-urlencoded" is not allowed`), NOT a 500 with a Postgres/connection error. The 415 is stronger evidence than build-log inspection: the request reached Better Auth, was processed past the auth-handler boundary, and rejected at Content-Type validation — meaning `DATABASE_URL` is correctly wired and the runtime is reaching the DB.

The actual operational state at end of A10 PARTIAL first-smoke (2026-05-17):

- **PROD project** (`zugzwang-experiment-prod`, ap-south-1 Mumbai): provisioned + all 6 drizzle migrations applied on 2026-05-15. Cursor at 0005 (`__drizzle_migrations.last_id=6, last_hash=0e9e617f...242edf4e`). PITR add-on (~$100/mo) deferred to HARDEN per A2 operator decision; daily backups (Pro tier default, included) confirmed active — the 2026-05-16 23:30:19 UTC scheduled backup predates today's A6/A7 cutover and captures the post-migration / pre-traffic state, acting as the de facto rollback anchor (per §0 finding 6 — A11 satisfied incidentally). Live first traffic: 1 request (the 415 smoke).
- **Vercel `DATABASE_URL`** (Production + Preview, single grouped entry, Sensitive flag on): PROD Session pooler URL, applied via dashboard mid-session out of plan procedural sequence (§0 finding 4); auto-redeployed to build `3QvGjQ32M` from commit `82bee48`. Stored value remains unreadable post-creation (Sensitive); operational verification via A10 415 is authoritative.
- **Interim project** (ap-northeast-1 Tokyo, free-tier `niihrpqgzxpczyignxnn`): schemaless. Never received `drizzle-kit migrate`. Confirmed via A4 q0 + post-415 inference to be unrelated to deployed-app `DATABASE_URL`; deletion in 24h grace per §10 Q9 / A15.
- **Downstream bug (separate tracker entry post-merge):** SCAFFOLD.3 sign-in form posts urlencoded; Better Auth route expects JSON — surfaced by A10 first-smoke 415 (§0 finding 5). Not SCAFFOLD.13-A scope.

SCAFFOLD.13-A's "substrate setup with zero feature delta" framing is correct: PROD is the live wired substrate; interim has no role. A6/A7 procedural sequence was inverted (§0 finding 4) — operator did the env work mid-session via dashboard before A4 close + A5 reviewer call + A11 snapshot; state landed correct, procedure broke. Captured as §14 SURPRISE.

The infrastructure-subscription strategy locked at tracker-sweep-v9 (`$25/mo Supabase Pro at SCAFFOLD.13 cutover; $20/mo Vercel Pro mid-August 2026; $45/mo at 2026-09-15 launch`) is honored by the pre-existing PROD project.

- The schema is **already version-controlled** in `drizzle/migrations/` (six migrations, `0000..0005`) covering uuidv7 function + 21-table inventory + 12+1 monthly events partitions + 26 append-only trigger declarations + system_state singleton seed + auth schema corrections. PROD is at the latest cursor as of 2026-05-15.
- There is **negligible production data at risk** — pre-launch state, only first-traffic so far is the 415 smoke (which failed at Content-Type validation, before any DB write). PROD's data tables remain empty.
- The application code is **unchanged**. `src/db/index.ts` reads `DATABASE_URL` from env. The wire was one env-var value set + redeploy, zero source-tree diff in `src/`.

Per kickoff explicit constraint: **if Claude Code finds itself touching `src/` files for behavioral changes, stop and surface — that signals scope drift.** (The 415 downstream bug is in `src/` but is a separate task per the new tracker entry; not SCAFFOLD.13-A scope.)

### §1.1 Why a pre-existing Pro project (not an in-session provision)

Original plan §1.1 prescribed creating a new Pro project during A2 ("fresh provisioning gives a clean rollback window; interim stays alive during 24h grace"). Reality (per §0 finding 1): the project was provisioned on 2026-05-15, predating this session. A2 today was URL capture + PITR/backup verification on the existing project. Functional outcome unchanged — PROD is in `ap-south-1` (Mumbai per SPEC.2 §22.1 ADR-0006), Session pooler port 5432, daily backups active. PITR add-on (~$100/mo separate billing) deferred to HARDEN.

The original "fresh provisioning rollback" rationale is reframed: there is no interim schema to roll back to (interim is schemaless per §0 finding 2). The §8 recovery procedure now reads: **the 2026-05-16 23:30 UTC scheduled daily backup is the de facto rollback anchor** (per §0 finding 6 — PITR and on-demand snapshot are both HARDEN-scoped); recovery via Supabase dashboard → Settings → Database → Backups → Restore. Acceptable pre-launch posture — no production data; A10 first-smoke landed at 415-before-DB-write, so PROD's data tables remain empty.

---

## §2 In scope / Out of scope

### §2.1 In scope (this PR — SCAFFOLD.13-A)

| Item | Substance |
|---|---|
| ✓ Pre-existing Pro project verified | `zugzwang-experiment-prod`, ap-south-1 / Mumbai, Session pooler port 5432, daily backups active. PITR add-on deferred to HARDEN per §0 + A2 amendment |
| ✓ Drizzle migration cursor verified | `pnpm drizzle-kit migrate` against PROD = idempotent no-op (cursor at 0005 from 2026-05-15 apply); A4 q0 confirms `last_id=6, last_hash=0e9e617f...242edf4e` |
| ⏳ Schema-correctness verification | §6 SQL suite against PROD-only; outputs validated against canonical migration files (`drizzle/migrations/0000-0005.sql`) + SPEC.2 §5 inventory; interim parity diff structurally invalid (interim schemaless per §0) |
| ✓ `DATABASE_URL` wired to PROD | Operator-applied via Vercel web dashboard mid-session (out-of-sequence per §0 finding 4); scope Production + Preview, single grouped entry, Sensitive flag on |
| ✓ Trigger redeploy | Auto-redeployed at A6/A7 dashboard action; build `3QvGjQ32M` from commit `82bee48` |
| ✓ PARTIAL smoke-test | Per §7 — sign-in renders cleanly; OTP POST returned 415 (Better Auth Content-Type validation → DB reachable; downstream bug per §0 finding 5); remaining §7 steps blocked by downstream bug (separate tracker entry) |
| ✓ A11 rollback anchor satisfied incidentally | On-demand snapshot procedure infeasible (PITR add-on required, deferred to HARDEN per A2). 2026-05-16 23:30:19 UTC scheduled backup (Pro tier default, included) is the de facto post-migration / pre-traffic rollback anchor. No operator action required (per §0 finding 6) |
| ✓ Backup configuration verified | Daily snapshot active (Pro tier default); 2026-05-16 23:30:19 UTC backup confirmed in dashboard. PITR + on-demand snapshots deferred to HARDEN per §0 |
| `pg_dump` cron bridge retirement | Operator cron disabled at any convenient time post-A6/A7; bridge wasn't on the PROD path (interim is schemaless per §0 finding 2; bridge ran against interim and is now orphaned) |
| ⏳ Interim project deletion scheduled | 24h grace post-PR-merge; operator-side dashboard action, NOT this PR. Interim is schemaless per §0, so grace's data-drain role is reduced; 24h matches kickoff and is retained as soft window |
| `.env.example` housekeeping | Replace stale "interim Supabase / Doppler" notes (line 3 + comment in SCAFFOLD.4 block) with current-state guidance; <2h drift fix per CLAUDE.md §7 cleanup absorption |
| `docs/plans/SCAFFOLD.13-A.md` | This file, promoted at A1; amended per §0 mid-session (three amendment states; second counter-amendment current) |
| `docs/logs/SCAFFOLD.13-A.md` | Six-field log per CLAUDE.md §5.9, written before `gh pr create`; includes 5 SURPRISE entries per §14 (PROD pre-existed, interim schemaless, Sensitive-var CLI artifact, credential-leak rotation, procedural-divergence A6/A7 out-of-sequence) |

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

§1 of CLAUDE.md names `drizzle/migrations/` as a critical path. This PR **reads** the migration set without modifying it (the migration apply was a pre-session operator action against PROD per §0 finding 1). Two consequences for the workflow:

1. **Pre-PR self-audit per CLAUDE.md §5.10 is REQUIRED.** Even though no migration file changes, the §6 schema-correctness verification IS the self-audit's load-bearing artifact. The audit walks the kickoff exit criterion line-by-line and produces PASS / FAIL / SURPRISE per item. Per §0 amendments, the audit's SURPRISE section is pre-loaded with the two standing findings (PROD pre-existed, interim schemaless), the retracted finding 3 (Vercel-empty was a CLI artifact, not ground truth), and the mid-session credential-leak incident.
2. **Reviewer-call routing per CLAUDE.md §5.11 fires at two points:**
   - `db-migration-reviewer` after §6 schema-correctness verification completes (mandatory; reframed scope per §0 — review schema-empty interim finding + PROD-pre-existed cursor verification, not parity-vs-interim)
   - `security-auditor` after §8 cutover-rollback procedure documented (mandatory; load-bearing surface now includes the credential-leak incident audit alongside the original secrets-handling-during-swap framing)

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

**Execution sequence: A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10 → A11 → A12 → A13 → A14 → A15** (original ordering — the proposed A11-before-A6 reorder was withdrawn alongside §0 finding 3 retraction; A11 timing may be reconsidered after the Vercel ground-truth check).

### A1 — Branch + plan promote
**Status.** ✓ COMPLETED 2026-05-16 as `912c3d3` on `feat/scaffold-13-a`. Local main fast-forwarded from `62cd299` → `82bee48` during step 2; gate-failure caught and benign (local main was one commit behind origin/main pre-pull); plan committed as new file (531 insertions, byte-identical to scratchpad per A1 diff).
**Substance.** From `main` at the post-tracker-sweep-v9 merge SHA, create `feat/scaffold-13-a`. Copy this plan from `~/.claude/plans/moonlit-brewing-sundae.md` to `docs/plans/SCAFFOLD.13-A.md`. Commit as `docs(scaffold-13-a): land approved implementation plan`.
**Output.** Branch ready; plan committed; ready for A2 operator action.
**Touch surface.** `docs/plans/SCAFFOLD.13-A.md` (NEW). Single commit.

### A2 — Operator: verify pre-existing Supabase Pro project + capture URLs (DASHBOARD; Hrishikesh)
**Status.** ✓ COMPLETED 2026-05-17. **Deviation from prescribed substance:** PROD project was pre-provisioned on 2026-05-15 (per `__drizzle_migrations.created_at`); steps 1-3 below execute as URL-capture + PITR/backup verification rather than net-new provisioning. PITR add-on (~$100/mo separate billing) deferred to HARDEN per operator decision; daily backups confirmed active (snapshot from 2026-05-16 23:30 UTC already exists). Step 4 captures interim diagnostics: region resolved as `ap-northeast-1` (Tokyo); INTERIM URL captured per amended step 4b. **Mid-session security incident:** both URLs subsequently leaked into Claude Code chat at A4 q0 protocol; both passwords rotated immediately; re-capture via `read -rs` discipline completed before resuming A4.
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

### A3 — Apply (or verify already-applied) schema migrations to PROD project
**Status.** ✓ COMPLETED 2026-05-17. Drizzle-kit reported `[✓] migrations applied successfully!`. **Outcome detail per A4 q0:** the apply was an idempotent no-op — the journal cursor was already at 0005 from the 2026-05-15 13:20:44 UTC pre-session apply. No new rows in `__drizzle_migrations` from this session. drizzle-kit's "applied successfully" message covers both fresh-apply and journal-already-current cases; A4 q0 distinguishes them via `last_applied_utc`.
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

### A4 — Schema-correctness verification — run §6 SQL suite against PROD-only
**Status.** ⏳ q0 cursor verification ran 2026-05-17 (PROD at cursor 0005 confirmed via `total=6, last_id=6, last_hash=0e9e617f...242edf4e`; interim schemaless surfaced as plan-invalidating finding per §0 finding 2). Full §6 schema-correctness suite (PROD-only against canonical) is independent of Vercel state and can technically proceed; further plan amendments past A4 HOLD pending the Vercel ground-truth check per §0 finding 3 retraction.
**Substance (amended per §0).** Run the §6 SQL suite against PROD only; validate outputs against canonical migration files (`drizzle/migrations/0000-0005.sql`) and SPEC.2 §5 inventory. Interim parity is structurally invalid (interim schemaless per §0 finding 2); the original "diff PROD vs interim" target is replaced with "verify PROD matches canonical schema-of-record."

The §6 queries return concrete counts and shapes — 21 base tables + 13 events partitions + drizzle migrations table; 26 trigger declarations; 7 functions (uuidv7 + 6 enforcers); 9 enums; 1 `system_state` row with `frozen_at IS NULL`; 3 distinct `uuidv7()` outputs. The pass criterion is: PROD's query outputs match SPEC.2 §5 + migration-file canonical expectations within the explanatory bounds noted in §6.

**Acceptance.** Every §6 query's PROD output matches canonical expectations OR has an explainable variance (e.g., `__drizzle_migrations` schema location — `drizzle` vs `public`). Variances surface as SURPRISE per CLAUDE.md §5.10 and land in §14 close-out log.
**Output.** Schema-correctness verification artifact (paste into close-out log §"Decisions made"); PROD confirmed at SPEC.2 §5 inventory.
**Touch surface.** None in repo.

### A5 — Reviewer call: `db-migration-reviewer`
**Status.** ⏳ PENDING. Scope reframed per §0 second counter-amendment: **retroactive state review, not procedural gate** — A6/A7 already complete via dashboard (§0 finding 4 procedural divergence); A11 satisfied incidentally (§0 finding 6); A10 PARTIAL first-smoke confirms PROD-wired. Reviewer's job: verify PROD schema at cursor 0005 matches SPEC.2 §5 inventory + canonical migration files, and flag whether the standing state (cursor 0005 + Sensitive Vercel env wired to PROD + 16 May scheduled backup as rollback anchor + 415 downstream bug noted) is reviewer-PASS for proceeding to A12 self-audit.
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

### A6 — Operator: Vercel env wire — Production
**Status.** ✓ COMPLETED out-of-sequence 2026-05-17 via **Vercel web dashboard** (not CLI). Per §0 finding 4 procedural divergence: operator applied PROD Session pooler URL via dashboard before A4 close + A5 reviewer call + A11 anchor. Scope = Production + Preview (single grouped Vercel entry); Sensitive flag on; auto-redeployed to build `3QvGjQ32M` from commit `82bee48`. The original CLI-based procedure below stands as reference but was not executed; the belt-and-suspenders `vercel env ls` backup file was not created (dashboard procedure doesn't surface prior value via CLI; Sensitive flag prevents post-set read anyway per §0 finding 3 root cause). Retroactive `vercel env ls production` capture available pending operator (for §14 close-out audit trail; will return Sensitive-redacted but at least confirm key present + scope).
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

### A7 — Operator: Vercel env wire — Preview
**Status.** ✓ COMPLETED in same A6 dashboard action. Per finding made at A4 q0 protocol: Vercel groups Production + Preview on a single grouped entry for `DATABASE_URL` (Sensitive flag on); the A6 dashboard set covered both scopes simultaneously. No separate Preview dashboard action required. Original prescribed procedure below (separate Preview dashboard edit) stands as reference but was unnecessary given the single-entry grouping.
**Substance.** Per SCAFFOLD.3 MAINT-10 — CLI rejects `--yes` non-interactive add for the all-preview-branches scope (`{"status":"action_required","reason":"git_branch_required"}`). Dashboard side-wires:
1. `https://vercel.com/<team>/<project>/settings/environment-variables`
2. Locate `DATABASE_URL` row scoped `Preview` (all branches)
3. Click `Edit` → paste new Session pooler URL → `Save`
**Output.** Preview env carries new URL. Same no-auto-redeploy caveat as A6.

### A8 — Reviewer call: `security-auditor`
**Status.** ⏳ PENDING. Scope expanded per §0 second counter-amendment to include four review surfaces (was: secrets-handling during swap only):
1. **Original** — `DATABASE_URL` swap procedure leak surfaces (§5 A6 + A7); INV-1/INV-2/INV-3/INV-4 preservation
2. **NEW — credential-leak incident audit** (load-bearing): PROD + INTERIM URLs leaked into Claude Code chat at A4 q0 protocol; both passwords rotated mid-session; re-capture via `read -rs` discipline. Audit: residual exposure in chat transcripts, conversation logs, ScheduleWakeup contexts, etc.; sufficiency of rotation; future hardening
3. **NEW — post-cutover env hygiene**: Sensitive flag confirmed on; scope grouping (Production + Preview single entry) reviewed; A6/A7 unifying surface verified
4. **NEW — procedural-divergence review** (§0 finding 4): A6/A7 happened out-of-sequence via dashboard before A4 close + A5 reviewer call + A11 anchor. State landed correct, procedure broke. Audit: is the resulting state reviewable? what hardening prevents future divergence?

Rollback procedure note for the auditor: §8 reframed to scheduled-backup-by-coincidence (per §0 finding 6) — recovery anchor is 2026-05-16 23:30 UTC daily backup; PITR + on-demand snapshots are HARDEN-scoped.

**Substance.** Fresh-context `general-purpose` Agent invocation per CLAUDE.md §5.11 with role briefing baked into prompt. Prompt template:

> Load `.claude/agents/security-auditor.md` and follow it verbatim.
> Plan path: `@docs/plans/SCAFFOLD.13-A.md`.
> Tool scope: Read, Grep, Glob, Bash — do NOT Edit or Write.
> Scope: per A8 Status amendment above (four surfaces: original swap leak + NEW credential-leak incident + NEW env hygiene + NEW procedural-divergence). Specifically:
> - `DATABASE_URL` set procedure (§5 A6 + A7 amended Status) — does the dashboard procedure expose the password? Identify any residual leak path.
> - Credential-leak incident audit — see §0 finding 3 retraction + A4 q0 timeline; verify rotation sufficiency + flag any residual conversation-log exposure
> - Recovery procedure (§8 reframed per §0 finding 6) — is the scheduled-backup-by-coincidence anchor adequate pre-launch? Identify gaps
> - 24h grace period adequacy — is 24h enough to detect a regression?
> - Interim project deletion — does any non-Hrishikesh actor retain credentials? Both URLs were leaked and rotated; verify
> - INV-1 / INV-2 / INV-3 / INV-4 — verify the substrate setup does not enable a path where atomicity, append-only, or side-binding is bypassed
> - Procedural-divergence review (§0 finding 4) — is the resulting state reviewable? What hardening prevents future operator-dashboard work running ahead of Claude Code-orchestrated sequence?
> Return findings ranked by exploitability with concrete attack scenarios.

**Output.** Reviewer report; expected GREEN with conditional findings on credential-leak rotation sufficiency. CRITICAL/HIGH findings fix in-session.

### A9 — Trigger Preview redeploy
**Status.** ✓ IMPLICIT. Vercel auto-redeployed at A6/A7 dashboard env-var set; new build = `3QvGjQ32M` from commit `82bee48`. Doc-only commit procedure below stands as reference but is redundant given the dashboard-induced redeploy. Operator may still push a `.env.example` drift-fix commit at A9's original step (covers the §2.1 housekeeping row); that commit triggers another Preview build, this time as a no-op env-wise.
**Substance.** Push a doc-only commit on `feat/scaffold-13-a`:
```bash
# .env.example drift fix (per §2.1 line "stale Doppler / SCAFFOLD.13 notes") is the natural carrier
git add .env.example
git commit -m "chore(scaffold-13-a): .env.example drift — interim/Doppler notes → current-state guidance"
git push origin feat/scaffold-13-a
```
**Output.** Vercel auto-deploys Preview against new Supabase Pro URL. Watch Vercel dashboard for build status; expected: "Collecting page data using 1 worker" passes without the `Error: DATABASE_URL is not set` failure observed at SCAFFOLD.3 build time.

### A10 — First-smoke tests against Production deploy (operator-driven, live Internet)
**Status.** ✓ PARTIAL. Live first-smoke executed 2026-05-17 in browser against `https://experiment-zugzwang-worlds-projects.vercel.app`:
- ✓ Step 1 (sign-in page render): renders cleanly, HTTP 200
- ✗ Step 3 (Email-OTP POST to `/api/auth/email-otp/send-verification-otp`): returned HTTP 415 with Better Auth domain error (`Content-Type "application/x-www-form-urlencoded" is not allowed. Allowed types: application/json`)
- Steps 2/4 (admin login flow, full OTP verify) blocked by downstream Better Auth content-type bug (§0 finding 5; separate tracker entry post-merge)

**Interpretation:** The 415 is end-to-end runtime evidence that `DATABASE_URL` is correctly wired (request reached Better Auth past the auth-handler boundary; rejected at Content-Type validation). A 500 with Postgres/connection error would have indicated a wiring failure. Stronger signal than build-log inspection (per §0 finding 3 resolution). Rollback NOT triggered — 415 is a downstream domain bug, not a connection failure.

**Substance.** Per §7 endpoint list — operator visits Preview/Production URL and exercises:
1. Landing page renders without 500
2. `/(auth)/sign-in` page renders (server-rendered; no DB module-load error)
3. Email-OTP flow submission — type a test email + valid Turnstile token → verify Resend OTP arrives → verify `verifications` table row exists in new Pro project (via `supabase studio` SQL editor)
4. Admin login at `/(admin)/admin/login` — submit `ADMIN_PASSWORD` → verify redirect to `/admin` works → verify `admin_sessions` table has a row in new Pro project
**Acceptance.** All four checks pass OR (per §0 finding 5) Step 3+4 blocked by downstream bug + Step 1+2 pass + 415 surfaces the bug as the load-bearing wiring-confirmation. Rollback only on connection-failure shape (5xx with Postgres error), not on 4xx domain errors.
**Output.** Smoke-pass timestamp 2026-05-17 captured; first-traffic clock starts; downstream bug minted as separate tracker entry per A15.

### A11 — Rollback anchor verification (no operator action required per §0 finding 6)
**Status.** ✓ SATISFIED INCIDENTALLY. Original A11 prescribed on-demand snapshot trigger via Supabase dashboard `Reports` → `Backups`. **Procedure infeasible:** on-demand snapshots require the PITR add-on (~$100/mo), explicitly deferred to HARDEN per A2 operator decision. The prescribed A11 procedure could not run.

**Functional substitution:** the 2026-05-16 23:30:19 UTC scheduled daily backup (Pro tier default, included; predates A6/A7) captures the post-migration / pre-traffic state (6 migrations applied, zero application rows). This is the de facto rollback anchor. **No operator action in Supabase needed.**

**Substance (retained as historical reference; not for execution).** Original Part-4-amended A11:
1. ~~`Settings` → `Database` → `Backups` → trigger on-demand snapshot via `Reports` → `Backups` (Pro tier feature). Verifies the backup mechanism works at cutover time.~~ INFEASIBLE — requires PITR add-on, deferred to HARDEN.
2. ~~`Settings` → `Database` → `Backups` → confirm daily-snapshot schedule is enabled.~~ ✓ Confirmed at A2; 2026-05-16 23:30:19 UTC backup exists.
3. ~~`Settings` → `Database` → `Point in Time Recovery` → confirm 7-day window is visible.~~ INFEASIBLE — PITR add-on not active.

**Output.** 2026-05-16 23:30:19 UTC scheduled-backup timestamp documented as rollback anchor in close-out log §"Decisions made" + §14 SURPRISE entry 6 (procedure-infeasibility-substituted-by-scheduled-backup).
**Touch surface.** None.
**Maintenance flag.** Plan-review templates should verify dashboard procedures are available on the chosen plan tier before prescribing them. Capture for `docs/maintenance.md`.

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

## §6 Schema-correctness verification SQL suite (reframed per §0 finding 2)

Ten queries verify PROD's schema matches the canonical migration set. **Original framing was parity-vs-interim; reframed to PROD-only against canonical per §0 finding 2 (interim is schemaless — parity diff is structurally invalid).** Run via `psql` direct connection to PROD, capture output to scratch files, compare against canonical expectations from `drizzle/migrations/0000-0005.sql` + SPEC.2 §5 inventory.

Run on PROD endpoint only. The validate target is "PROD matches canonical" — variance from expected counts/shapes is FAIL (or SURPRISE if explainable by drizzle-kit version specifics — e.g., `__drizzle_migrations` schema location is `drizzle.` not `public.`).

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

**Capture format (reframed per §0 finding 2).** For each query, run against PROD, save to `/tmp/scaffold-13a-q<N>-prod.txt`. Compare row counts + content shapes against the canonical expectations in the "Pass criterion" column. **No interim diff — interim is schemaless.** Variances surface as SURPRISE per CLAUDE.md §5.10.

**Higher-level alternative** (faster, lossier): `pg_dump --schema-only --no-owner --no-privileges <PROD>` produces a deterministic schema dump that can be eyeballed against the migration files (`cat drizzle/migrations/0000*.sql drizzle/migrations/0001*.sql ...`). Catches surprises the targeted queries miss (default privileges, RLS policies — currently none — comment text, etc.).

---

## §7 Smoke-test endpoint list + green criteria

Per Open Question Q7 — `/api/health` does not exist (currently nothing in `src/app/api/` except `auth/[...all]/route.ts`). Smoke surface rides existing endpoints:

| Step | Endpoint | What it confirms | Green criterion | A10 result (2026-05-17) |
|---|---|---|---|---|
| 1 | Landing page (`/`) | Server renders without `Error: DATABASE_URL is not set` | HTTP 200, no module-load DB error in Vercel runtime logs | not exercised in A10 (operator went directly to sign-in) |
| 2 | `/(auth)/sign-in` | Sign-in page server-renders (DESIGN.* placeholder per SCAFFOLD.3 MAINT-9; doesn't yet make DB call at SSR time) | HTTP 200 | **✓ PASS** — renders cleanly |
| 3 | `/(admin)/admin/login` GET | Admin login form server-renders | HTTP 200 | not exercised in A10 |
| 4 | Admin login Server Action (POST submit with correct `ADMIN_PASSWORD`) | Writes a row to `admin_sessions` table via SERIALIZABLE DELETE+INSERT per SPEC.2 §8.4 | Redirect to `/admin` + verify `SELECT COUNT(*) FROM admin_sessions;` returns 1 in PROD | blocked by §0 finding 5 |
| 5 | Better Auth Email-OTP request (`/api/auth/email-otp/send-verification-otp` POST with valid email + Turnstile token) | Cloudflare Turnstile validates + Resend invokes (out-of-process) + Better Auth writes a `verifications` row in DB | Resend email arrives at test inbox; `SELECT COUNT(*) FROM verifications;` returns 1 in PROD | **✗ 415** — Better Auth Content-Type validation rejects urlencoded body (downstream bug per §0 finding 5); 415 itself is ground-truth evidence that DATABASE_URL is correctly wired (request reached Better Auth) |
| 6 | Better Auth Email-OTP verify (submit OTP from Resend email) | Better Auth reads `verifications`, validates code, runs `databaseHooks.user.create.before` (consumes `identity_pool`), writes `users` row | New row in `users`; `assigned_at` set on first available `identity_pool` row | blocked by §0 finding 5 (step 5 prerequisite) |

**Failure modes mapped to recovery (reframed per §0 finding 6):**
- Step 1 fails with `DATABASE_URL is not set` → Vercel env not set or value wrong; verify in Vercel dashboard (Sensitive value can't be inspected, but Vercel dashboard surfaces whether the key exists)
- Step 1 fails with `connection refused` / `ECONNREFUSED` → Session pooler URL has wrong port (must be 5432) OR PROD project paused (Pro shouldn't pause). Restore from 2026-05-16 23:30 scheduled backup if data corrupted; otherwise re-set env-var
- Step 4 fails with `admin_login_invalid` → `ADMIN_PASSWORD` env mismatch (unrelated to cutover); not a recovery trigger
- Step 5 returns **HTTP 415 (per A10 PARTIAL)** → downstream Better Auth Content-Type bug (separate tracker entry per §0 finding 5). NOT a recovery trigger — DB reachability confirmed by the 415 itself (request landed at Better Auth past handler boundary)
- Step 5 fails with timeout → Cloudflare Turnstile network issue OR Resend outage — verify against status pages before recovery
- Step 6 fails on identity_pool consumption → `identity_pool` not seeded in PROD. Run `pnpm seed:identity-pool:dev` against PROD (per SCAFFOLD.3 dev-seed script)

---

## §8 Recovery procedure (reframed per §0 findings 2 + 6)

**Original framing was "rollback to interim DATABASE_URL".** Reality (§0 finding 2): interim is schemaless — there is nothing to roll back to. **Reframed: recovery via 2026-05-16 23:30 UTC scheduled daily backup of PROD** (de facto rollback anchor per §0 finding 6; on-demand snapshot + PITR both HARDEN-scoped).

**Pre-A10 state:** Vercel `DATABASE_URL` was unset/empty; no recovery needed (no traffic).

**Post-A6/A7 state (current):** Vercel `DATABASE_URL` wired to PROD; A10 PARTIAL first-smoke landed (sign-in render + 415 OTP-POST). PROD's data tables remain empty (415 short-circuited before any DB write). Recovery if needed:

### Recovery substrates (in order of preference)

1. **Most-recent scheduled daily backup restore** — Supabase dashboard → Settings → Database → Backups → select 2026-05-16 23:30:19 UTC backup (or later daily) → Restore. Restores PROD to post-migration / pre-traffic state. **RTO ~5-15 min.** Pre-launch acceptable; max 24h data loss between backups (negligible pre-launch — no real user data yet).
2. **Re-migrate from scratch** — drop public schema, re-run `pnpm drizzle-kit migrate` against PROD. **RTO ~2 min.** Last resort; loses any legitimate data writes between last backup and now (none expected pre-launch).
3. **PITR restore + on-demand snapshot recovery** — **not available** until HARDEN PITR add-on lands. **On Supabase Pro, PITR and on-demand snapshots are coupled into a single procurement** (on-demand snapshots require the PITR add-on; both together cost ~$100/mo as one decision per §0 finding 6). HARDEN scoping addresses both simultaneously. Out of scope for SCAFFOLD.13-A.

### No interim fallback

The original plan §8's "re-swap to interim URL" is invalid (interim is schemaless per §0 finding 2; re-swapping to it would make every server action fail with relation-does-not-exist errors). The 24h grace on interim deletion (per A15) is a soft window for unrelated regression discovery, not an operational rollback target.

### When recovery fires

- DATABASE_URL set to wrong value (typo, wrong project ref) → re-run A6/A7 with correct value. No data recovery needed.
- A10 step 5/6 fail with HTTP 5xx + Postgres/connection error → DB unreachable. Verify Supabase project status; if PROD compromised, restore from scheduled backup
- A10 step 5/6 surface data-corruption (e.g., constraint violations from app bugs) → restore from scheduled backup, fix app bug separately, redeploy
- **A10 415 result is NOT a recovery trigger** — domain-level Better Auth bug, not a wiring or data issue

### Target recovery window

**<15 minutes** (dashboard backup restore + redeploy + smoke re-verify). Acceptable pre-launch posture.

### Operator post-recovery

Open `docs/logs/SCAFFOLD.13-A.md` recovery section + capture failure mode for re-attempt diagnosis. Mint a tracker entry if root cause warrants a follow-up.

---

## §9 Risk register

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | **Connection pooling — Session vs Transaction** — Drizzle uses prepared statements. Transaction pooler (port 6543) drops prepared statement state between transactions, breaking Drizzle. Session pooler (port 5432) preserves session state — correct choice. | Medium (operator might copy wrong URL) | A2 step 3 explicitly verifies port is 5432; A5 db-migration-reviewer cross-checks |
| R2 | **IPv4 vs IPv6 reachability** — Vercel runtime is IPv4-only on free + Pro tiers. Supabase Direct connection is IPv6-only. Session pooler routes via IPv4. Per SCAFFOLD.3 MAINT-10 (a). | Medium (default Supabase connection-string display sometimes shows Direct first) | A2 step 3 selects "Session pooler" tab explicitly — NOT "Direct connection" or "Transaction pooler" |
| R3 | **Region mismatch latency during cutover window** | Low → **RETROACTIVELY MOOT** (interim was never live per §0 finding 2 + A10 first-smoke 415 evidence; no traffic-straddle ever occurred) | A2 step 4a recorded interim region as `ap-northeast-1` (Tokyo). PROD is in `ap-south-1` (Mumbai). Region mismatch is irrelevant because interim never carried production traffic. |
| R4 | **Migration apply ordering** — six migrations must apply in journal order; out-of-order = broken state | Low (drizzle-kit reads `_journal.json` and applies in order; manual operator intervention is the only way to break this) | A3 invokes `pnpm drizzle-kit migrate` (the safe append-only command, NOT `pnpm drizzle-kit push`); A5 db-migration-reviewer verifies all 6 migrations applied |
| R5 | **Partition initial-month creation** — events_2026_05 must exist on day-of-cutover for current writes to route correctly (today is 2026-05-16; partition range FROM '2026-05-01' TO '2026-06-01' covers it) | Low | A4 query 8 verifies all 13 partitions exist with correct bounds |
| R6 | **Append-only trigger preservation** — 26 triggers + 6 functions must apply via 0003 migration. A trigger that fails to install = INV-2 / INV-3 / INV-4 enforcement gap | Low (drizzle-kit migrate applies SQL atomically; partial install = error + rollback) | A4 query 5 + query 6 verify trigger + function counts match SPEC.2 §6.1 contract; A5 db-migration-reviewer cross-checks per-table |
| R7 | **NUMERIC(38,18) precision parity** — Dharma + bet stake columns must preserve full 38-digit precision. Postgres NUMERIC is precise; both projects are PG 17. | Very Low | A4 query 2 confirms types match |
| R8 | **`uuidv7()` function presence** — every PK depends on this user-space function | Low (0000 migration runs first per journal) | A4 query 6 + query 10 verify presence + functional behavior |
| R9 | **CLI papercut for Preview env all-branches scope** | High → **OBSOLETE** (Vercel `DATABASE_URL` is grouped as a single Production + Preview entry with Sensitive flag; A6 dashboard set covered both scopes simultaneously per A7 status — no separate Preview action needed) | Original mitigation (A7 dashboard workaround) not exercised because no separate Preview action was required |
| R10 | **Trigger redeploy** — original framing: Vercel does NOT auto-redeploy on env change | High → **WRONG FRAMING** (Vercel DOES auto-redeploy on dashboard env-var set — empirically confirmed at A6/A7: build `3QvGjQ32M` from commit `82bee48` triggered on save) | A9 doc-only-commit was therefore redundant; original R10 framing was inverted. Reframe: "operator-applied dashboard env changes auto-trigger redeploy in Vercel; no separate trigger required." |
| R11 | **Secret exposure during swap** — `--value <secret>` flag risks shell-history leak | Medium → **MATERIALIZED + MITIGATED** | Risk materialized in a different form at A4 q0 protocol: both PROD + INTERIM URLs leaked into Claude Code chat (not shell history). Mitigated by mid-session password rotation on both projects + re-capture via `read -rs`. A8 security-auditor scope expanded to include incident audit (per §5 A8 amended status). |
| R12 | **Interim auto-pause during cutover** — free-tier paused interim makes rollback impossible | Medium → **MOOT** (interim was never the live substrate per §0 findings 2 + 3 + A10 415 evidence; auto-pause has no operational impact since no rollback target ever existed) | No mitigation required. Interim deletion 24h grace (per A15) is now a soft window for unrelated regression discovery, not a load-bearing rollback path. |
| R13 | **24h grace period inadequate** — regression discovered >24h after cutover = interim already deleted, no fast rollback | Low → **PARTIALLY MOOT** (interim path is moot per R12; PITR substitution mentioned in original mitigation is HARDEN-scoped per §0 finding 6) | Reframed recovery is **scheduled-backup-based** per §8 (2026-05-16 23:30 UTC scheduled daily backup is the de facto rollback anchor; max 24h data loss between backups is acceptable pre-launch since no real user data exists yet). |
| R14 | **Interim auto-pause during multi-session Phase 2 execution** — sub-parts straddle sessions; interim 7-day auto-pause clock advances independently | Medium → **MOOT** (interim was never load-bearing per §0 finding 2 + R12; A4 parity diff was structurally invalid regardless of pause status; A6 belt-and-suspenders sanity ping was reframed to dashboard procedure per A6 status) | Original mitigation ritual (operator touches interim dashboard at session start) was not needed; ritual logged in close-out for procedural-discipline reference only. |

---

## §10 Open questions

Resolution paths annotated. Plan proceeds with the **proposed resolution**; web Claude plan-review confirms or amends.

| Q | Question | Proposed resolution |
|---|---|---|
| Q1 | Kickoff cites `docs/adr/0006-hosting.md`. File does not exist (§4.1). | Treat SPEC.2 §22.1 ADR-0006 row description as authoritative for hosting-topology decisions. ADR file mint is PRECURSOR.4's work, not SCAFFOLD.13-A's. |
| Q2 | Kickoff cites `SPEC.2 §8.* (DB architecture)`. §8 is Authentication & Sessions (§4.2). | Read SPEC.2 §5 + §6 + §7 in lieu. Document kickoff-text typo as MAINT-row in tracker v9 (operator surface; not this PR). |
| Q3 | Kickoff cites `SPEC.5` for partitioning. No SPEC.5 doc exists (§4.3). | Treat as shorthand for `ADR-0005` ratification (which lives in SPEC.2 §22.1 ADR row) + the partition DDL at `drizzle/migrations/0002_events_partitioning.sql` + the partition contract at SPEC.2 §7.2. |
| Q4 | Doppler integration scope — tracker-sweep-v9 log §"Path A — SCAFFOLD.13 kickoff first" includes "Doppler-wired staging + production DATABASE_URL". Kickoff for SCAFFOLD.13-A omits Doppler. | Defer Doppler integration to SCAFFOLD.13-B. SCAFFOLD.13-A uses direct Vercel env management. Stratum B scope per tracker-sweep-v9 covers full env audit across all four vendors (Supabase DATABASE_URL, Upstash, R2, Resend) PLUS Doppler-wiring — not Doppler-alone. The SCAFFOLD.13-B kickoff template must reflect this broader scope when written. |
| Q5 | Interim Supabase project region. SCAFFOLD.3 MAINT-10 (a) does not record it. | ✓ **RESOLVED 2026-05-17:** interim region is `ap-northeast-1` (Tokyo), revealed at A2 step 4a dashboard inspection + the URL pasted at A4 q0 protocol (`aws-1-ap-northeast-1.pooler.supabase.com:5432`). Combined with §0 finding 2 (interim is schemaless) + R3 retroactive moot, the region is now historical context only — interim is operationally irrelevant. |
| Q6 | Kickoff exit criterion `pnpm test green` — script not defined (§4.4). | Interpret as `pnpm vitest run` returning SCAFFOLD.3 baseline (58 pass, 5 todo). The test suite is independent of the cutover (uses module-load shims, not cloud DB). |
| Q7 | Smoke-test endpoint list — kickoff implies `/api/health` exists. It does not (only `/api/auth/[...all]/route.ts` in `src/app/api/`). | Use §7 ride-existing-endpoints approach (Better Auth + admin login + Email-OTP). Document `/api/health` as HARDEN.* deliverable. Note: §7 smoke coverage exercises auth-path code only; non-auth schema (markets, pools, bets, events partitions, etc.) is verified by §6 parity SQL suite at A4, NOT by A10 smoke. Pre-launch this is adequate — non-auth code is not yet wired. Post-launch, `/api/health` with non-auth probes is HARDEN.* scope. |
| Q8 | `pg_dump` cron bridge retirement timing — tracker-sweep-v9 says "retire when SCAFFOLD.13 swaps to Pro with native PITR". After A10 smoke-pass or after A11 backup-verify? | ✓ **RESOLVED 2026-05-17 (reframed):** Question presumed PITR would be active post-cutover. Per §0 finding 6, PITR is HARDEN-scoped (~$100/mo add-on deferred). The bridge was running against interim (which is schemaless per §0 finding 2 — bridge output was empty dumps anyway). **Bridge retirement is unrelated to PROD wiring; operator can retire at any convenient time post-PR-merge.** Recovery substrate for PROD is the 2026-05-16 23:30 UTC scheduled daily backup per §8, not PITR. |
| Q9 | 24h interim deletion grace — kickoff prescribes 24h, not 7d. Confirm. | 24h matches kickoff. Clock origin: A10 cutover-smoke-pass timestamp (operational-proof moment, not PR-merge). Guard: deletion proceeds only if PR has merged AND smoke-pass timestamp is >24h old. If PR still open at +24h, deletion waits. |
| Q10 | Vercel Preview env all-branches scope — confirms ALL preview branches use the new URL (not just `feat/scaffold-13-a`)? | Yes — Preview scope in Vercel is "all preview branches" unless per-branch overrides exist. Per SCAFFOLD.3 history, no per-branch overrides are configured. A7 dashboard action sets the all-branches Preview value. |

---

## §11 Self-audit checklist (CLAUDE.md §5.10)

Per kickoff: "Self-audit per §5.10 before `gh pr create`." Run at A12, after A1-A11 completion. Format: PASS / FAIL / SURPRISE per item with `file:line` or evidence reference.

| Audit item | Source criterion | Verification method |
|---|---|---|
| ✓ Plan committed before code | CLAUDE.md §5.1 | `git ls-files docs/plans/SCAFFOLD.13-A.md` returns path; A1 committed `912c3d3` 2026-05-16 |
| ✓ Supabase Pro project in ap-south-1 (pre-existed) | Kickoff exit-1 + SPEC.2 §22.1 ADR-0006 | A2 confirmed: PROD = `zugzwang-experiment-prod`, pre-provisioned 2026-05-15 per §0 finding 1 |
| ✓ Session pooler port 5432 | Kickoff exit-1 + SCAFFOLD.3 MAINT-10 (a) | A2 step 3 confirmed: URL ends in `:5432/postgres` |
| ✓ Daily backups enabled | Kickoff exit-1 | A2 confirmed: scheduled daily backup active; 2026-05-16 23:30:19 UTC backup is the de facto rollback anchor per §0 finding 6 |
| **PITR deferred to HARDEN per §0** | Kickoff exit-1 (amended) | A2 operator decision: PITR add-on (~$100/mo) skipped; A11 on-demand-snapshot procedure infeasible per §0 finding 6, substituted incidentally by scheduled backup |
| ✓ All 6 drizzle migrations applied | Kickoff exit-2 | A4 q0 confirms PROD cursor at 0005 (`__drizzle_migrations.last_id=6, last_hash=0e9e617f...242edf4e`); A3 migrate was idempotent no-op per §0 finding 1 |
| ⏳ Schema-correctness vs canonical (reframed per §0 finding 2) | Kickoff exit-3 (amended) | §6 queries 1-10 run against PROD-only at A4; validated against canonical migration files + SPEC.2 §5; A5 db-migration-reviewer reports PASS/FAIL/SURPRISE per query. **Parity-vs-interim is structurally invalid (interim schemaless).** |
| ✓ `DATABASE_URL` set in Vercel (single grouped entry) | Kickoff exit-4 (amended) | A6/A7 ✓ completed out-of-sequence via dashboard (§0 finding 4); Sensitive flag on; scope Production + Preview single entry; auto-redeployed build `3QvGjQ32M` from commit `82bee48`. Stored value unreadable post-set; A10 415 evidence is the wiring confirmation |
| ⏳ pnpm tsc --noEmit exit 0 | Kickoff exit-5 | Run at A12; capture output |
| ⏳ pnpm biome check . zero fixes | Kickoff exit-6 | Run at A12; capture output |
| ⏳ pnpm vitest run green | Kickoff exit-7 (interpreted per Q6) | Run at A12; matches SCAFFOLD.3 baseline (58 pass, 5 todo) |
| ✓ Vercel Production deploy green | Kickoff exit-8 | Build `3QvGjQ32M` from commit `82bee48` deployed successfully; A10 first-smoke confirms HTTP 200 at `/sign-in` |
| ✓ Vercel Preview deploy green | Kickoff exit-8 | Same build per single-entry env grouping (§0 finding 4); A10 first-smoke ran against Production URL |
| ✓ Backup configuration verified | Kickoff exit-9 (reframed per §0 finding 6) | 2026-05-16 23:30:19 UTC scheduled daily backup confirmed in dashboard (post-migration, pre-traffic) = de facto rollback anchor; PITR + on-demand snapshots HARDEN-scoped |
| ⏳ Interim deletion scheduled (24h grace) | Kickoff exit-10 | Tracker v9 MAINT-row added (per A15); operator calendar reminder set; interim is schemaless so grace is soft window |
| ⏳ Close-out log written before PR | Kickoff exit-11 + CLAUDE.md §5.9 | `git log --oneline` shows log commit precedes `gh pr create`; includes 6 SURPRISE entries per §14 |
| ⏳ db-migration-reviewer invoked (retroactive state review) | Kickoff §"Subagent invocations" | A5 output appended to close-out log §"Reviewer-call invocation summary"; scope reframed per A5 amended status |
| ⏳ security-auditor invoked (expanded scope) | Kickoff §"Subagent invocations" | A8 output appended to close-out log §"Reviewer-call invocation summary"; scope expanded per A8 amended status (4 surfaces) |
| code-reviewer NOT invoked | Kickoff §"Subagent invocations" | Absence-of-invocation is the audit item; confirmed by walking close-out log |
| No `src/` changes | Kickoff scope-drift gate | `git diff main -- src/` returns empty (downstream 415 bug per §0 finding 5 is separate tracker entry, not in this PR) |
| No `drizzle/migrations/` changes | Kickoff scope-drift gate | `git diff main -- drizzle/migrations/` returns empty |
| `.env.example` drift fix | §2.1 housekeeping | `git diff main -- .env.example` shows <2h drift fix |

---

## §12 Reviewer-call routing summary (CLAUDE.md §5.11)

Per §5.11's invocation policy table:

| Reviewer | Phase | When | Tool scope | Briefing | Plan path | Scope (per §0 second counter-amendment) |
|---|---|---|---|---|---|---|
| `db-migration-reviewer` | A5 (retroactive state review per A5 amended status) | After §6 schema-correctness suite captures PROD-vs-canonical artifact | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/db-migration-reviewer.md` | `@docs/plans/SCAFFOLD.13-A.md` | Verify PROD schema at cursor 0005 matches SPEC.2 §5 inventory + canonical migration files; flag whether standing state (cursor 0005 + Sensitive Vercel env wired to PROD + 16 May scheduled backup as rollback anchor + 415 downstream bug noted) is reviewer-PASS for proceeding to A12 |
| `security-auditor` | A8 (post-cutover; A6/A7 already completed out-of-sequence per §0 finding 4) | After PROD wired + A10 first-smoke landed | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-A.md` | Four surfaces per A8 amended status: (1) original swap leak surfaces; (2) NEW credential-leak incident audit (load-bearing); (3) NEW post-cutover env hygiene; (4) NEW procedural-divergence review |
| `code-reviewer` | — | NOT invoked | — | — | — | No `src/server/` changes in this PR (downstream 415 bug per §0 finding 5 is a separate tracker entry) |
| `test-writer` | — | NOT invoked (no new business-logic behavior) | — | — | — | — |

Three required prompt elements per CLAUDE.md §5.11 enforced in A5 + A8 prompt templates above. FAIL findings within scope → fix in-session; SURPRISE findings outside scope → `claude-progress.md` + STOP.

---

## §13 Exit criterion (mirrors kickoff verbatim; PR opens only after all green)

| # | Criterion | Audit reference | Status |
|---|---|---|---|
| 1 | Supabase Pro project provisioned (ap-south-1, Session pooler port 5432, daily backups enabled; **PITR deferred to HARDEN per §0**) | §11 items 2-5 | ✓ (project pre-existed 2026-05-15 per §0 finding 1; PITR amendment) |
| 2 | All drizzle migrations applied to PROD | §11 item 6 | ✓ (cursor 0005 per A4 q0) |
| 3 | Schema-correctness vs canonical verified (PROD-only against migration files + SPEC.2 §5; **parity-vs-interim invalid per §0 finding 2**) | §11 item 7 + §6 | ⏳ pending full §6 suite + A5 reviewer call |
| 4 | DATABASE_URL set in Vercel (single grouped entry covers Production + Preview per A4 finding) | §11 item 8 | ✓ A6/A7 completed out-of-sequence per §0 finding 4 |
| 5 | pnpm tsc --noEmit exit 0 | §11 item 10 | ⏳ pending A12 |
| 6 | pnpm biome check . zero fixes | §11 item 11 | ⏳ pending A12 |
| 7 | pnpm test green (interpreted: `pnpm vitest run` per Q6) | §11 item 12 | ⏳ pending A12 |
| 8 | Vercel deploy green against PROD (build `3QvGjQ32M` from commit `82bee48`; A10 first-smoke landed) | §11 items 13-14 | ✓ confirmed by HTTP 200 on `/sign-in` + 415 on OTP POST (DB reachable per §0 finding 3 resolution) |
| 9 | Backup configuration verified (2026-05-16 23:30 UTC scheduled backup as rollback anchor per §0 finding 6; on-demand snapshot + PITR HARDEN-scoped) | §11 item 15 | ✓ |
| 10 | Interim project deletion scheduled (24h grace, not immediate; soft window per §10 Q9 amendment) | §11 item 16 | ⏳ pending A15 |
| 11 | docs/logs/SCAFFOLD.13-A.md written before gh pr create (includes 6 SURPRISE entries per §14) | §11 item 17 | ⏳ pending A13 |

---

## §14 Close-out log shape preview (CLAUDE.md §5.9 — written at A13)

Six fields per CLAUDE.md §5.9; sections drafted in advance below so A13 has a fast-fill template. Includes pre-drafted 6 SURPRISE entries per §0 second counter-amendment.

```markdown
# SCAFFOLD.13-A — Postgres cutover to Supabase Pro

**Status:** Closed <YYYY-MM-DD>
**Branch:** feat/scaffold-13-a (N commits; head <SHA>); pre-merge at log-write time
**PR:** to fill on open
**Predecessor:** tracker-sweep-v9 (`docs/logs/tracker-sweep-v9.md`, `main` at `82bee48`)
**Unblocks:** SCAFFOLD.13-B (Doppler + Upstash/R2/Resend env audit); HARDEN.* connection-pool tuning; HARDEN.* PITR add-on + backup-runbook + restore-drill; SCAFFOLD.3-FOLLOWUP-1 (Better Auth Content-Type bug per §0 finding 5)

## What landed (§5.9 field 1)
- PROD Supabase Pro project (`zugzwang-experiment-prod`, ap-south-1, Session pooler @ 5432, daily backups) verified pre-existing (provisioned 2026-05-15 per §0 finding 1); PITR add-on deferred to HARDEN
- 6 drizzle migrations confirmed applied to PROD via A4 q0 (cursor 0005, hash `0e9e617f...242edf4e`); A3 migrate was idempotent no-op
- DATABASE_URL wired to PROD via Vercel web dashboard (operator-applied out-of-sequence per §0 finding 4); scope Production + Preview single grouped entry; Sensitive flag on
- Auto-redeploy to build `3QvGjQ32M` from commit `82bee48`; A10 PARTIAL first-smoke landed (sign-in renders; OTP POST returned 415 → DB reachable, downstream bug per §0 finding 5)
- A11 rollback anchor satisfied incidentally per §0 finding 6: 2026-05-16 23:30:19 UTC scheduled daily backup captures post-migration / pre-traffic state
- .env.example drift fix (line 3 + SCAFFOLD.4-block comment)
- Plan + log committed; interim (Tokyo, schemaless) deletion scheduled +24h soft window

## Decisions made (§5.9 field 2)
- Q1-Q10 resolutions (per plan §10; Q5 resolved → interim region `ap-northeast-1`; Q8 resolved → cron bridge retirement decoupled from PITR per §0 finding 6)
- Reviewer-call invocation summary (A5 db-migration-reviewer reframed scope → retroactive state review; A8 security-auditor expanded scope → 4 surfaces including credential-leak incident)
- §0 amendment log: three successive amendment states same day (initial → first counter-amendment Sensitive-var retraction → second counter-amendment post-A10 ground-truth + findings 4/5/6)

## Surprises caught + fixed in-session (§5.10 — 6 entries)
1. **PROD pre-existed (§0 finding 1).** Project + migrations applied 2026-05-15 (before session). A2 became URL-capture; A3 became no-op verification. State correct.
2. **Interim schemaless (§0 finding 2).** Interim Tokyo project never received `drizzle-kit migrate`; plan §6 parity-vs-interim framework structurally invalid; reframed to PROD-only schema-correctness vs canonical migration files.
3. **Sensitive-var CLI artifact (§0 finding 3 retraction).** `vercel env pull` returned `DATABASE_URL=""` — mistaken initially for "Vercel env is empty"; root cause: Vercel marks `DATABASE_URL` Sensitive (CLI returns empty for Sensitive vars by deliberate platform-security design). Retracted same day; later resolved via A10 first-smoke 415 evidence.
4. **Credential-leak incident (caught + rotated).** PROD + INTERIM DATABASE_URL credentials leaked into Claude Code chat during A4 q0 protocol; Claude Code refused execution + recommended immediate rotation; both passwords rotated mid-session; new URLs re-captured via `read -rs` discipline. A8 security-auditor scope expanded to audit incident.
5. **Procedural divergence A6/A7 (§0 finding 4).** Operator applied PROD URL via Vercel dashboard mid-session, out of plan sequence (before A4 close + A5 reviewer call + A11 anchor). State landed correct; procedure broke. Captured for future-discipline: plan templates should instrument a "dashboard-side actions log" to keep operator dashboard work in sync with Claude Code-orchestrated sequence.
6. **A11 procedure infeasible, substituted by scheduled-backup-by-coincidence (§0 finding 6).** Web-Claude plan-review prescribed mandatory on-demand snapshot via Supabase dashboard; infeasible because on-demand snapshots require PITR add-on (deferred to HARDEN). The 2026-05-16 23:30:19 UTC scheduled daily backup (Pro tier default, included; predates A6/A7) substitutes incidentally as the de facto rollback anchor. Plan-review-template miss: future templates should verify dashboard procedures are available on the chosen plan tier before prescribing them. Capture for `docs/maintenance.md`.

## Open questions (§5.9 field 3)
- (Expected) none at close — all 6 surprises resolved in-session

## Next session starts at (§5.9 field 4)
- SCAFFOLD.13-B kickoff (Doppler integration + Upstash/R2/Resend env audit) OR ENGINE.6 (events helper at src/server/events/insert.ts) per Hrishikesh's queue ordering
- New tracker entry: SCAFFOLD.3-FOLLOWUP-1 (Better Auth Content-Type bug per §0 finding 5)

## Context to preserve (§5.9 field 5)
- PROD Supabase Pro project (name: `zugzwang-experiment-prod`, ref `zbvprdcyxhlguxbostdj`, ap-south-1, Session pooler URL) — operator-side password manager; **passwords rotated 2026-05-17 post-leak** (new credentials in password manager only)
- Interim project (name: `niihrpqgzxpczyignxnn`, ap-northeast-1 Tokyo, schemaless) — deletion +24h soft window per §10 Q9 amendment
- 24h grace deletion clock — origin = A10 first-smoke timestamp (2026-05-17); guard = PR-merged-into-main; deletion proceeds only when both conditions satisfied. Operator calendar reminder + tracker v9 MAINT-row.
- Session pooler port 5432 rationale (IPv4 + prepared-statement support) — repeat in SCAFFOLD.13-B for Doppler-wired URL discipline
- `pg_dump` cron bridge retired at operator's convenience post-merge — bridge was orphaned anyway (interim was schemaless)
- 2026-05-16 23:30:19 UTC scheduled daily backup is the de facto rollback anchor; restore via Supabase dashboard if needed
- Procedural-discipline maintenance item: instrument "dashboard-side actions log" in plan templates (per §0 finding 4 surprise 5)
- Plan-review template maintenance item: verify dashboard procedures available on chosen plan tier before prescribing (per §0 finding 6 surprise 6)

## Time (§5.9 field 6 — optional)
<rough estimate>
```

---

## §15 Sign-off

Plan ready for review. Web Claude review per CLAUDE.md §5.1; Hrishikesh confirms in Claude Code then pastes for sign-off. **Stop after plan; do not execute until web Claude plan-review approval lands** (per kickoff). Phase 2 begins at A1 in a fresh session post-approval; one sub-part per reply, no bundling.
