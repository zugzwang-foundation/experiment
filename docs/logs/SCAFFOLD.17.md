# SCAFFOLD.17 — plan-mode close-out

> Six-field log per CLAUDE.md §5.9. Written 2026-05-25 at plan-mode session close, before /clear, before any execute work begins.

---

## What landed

- **Branch:** `plan/scaffold-17` (cut from `main` at `42baa8b`, the post-ENGINE.6 merge).
- **Commit 1 — `04d1979` `plan(scaffold-17): plan-mode draft + verdicts`:**
  - `docs/plans/SCAFFOLD.17.md` (526 lines) — full plan-mode draft against the SCAFFOLD.17 plan-mode brief v2 + technical research brief.
- **Commit 2 — `<this commit>` `chore(scaffold-17): log session - plan-mode close-out`:**
  - `docs/logs/SCAFFOLD.17.md` (this file).
- **No PR opened** — branch pushed to origin; execute chat opens directly against `plan/scaffold-17` head after operator confirms plan reads correctly.

---

## Decisions made

### Open questions resolved at /plan opening

- **Q1 — Manifest format:** **CSV, 5 columns** `colour, animal, number, pseudonym, pfp_filename` (operator-confirmed at /plan opening). NOT the brief's default 6-column shape; the `r2_key` column is omitted because the verify-script can compose the R2 key at HEAD time as `` `v1/${pfp_filename}` `` per ADR-0011 layout. Less redundant; assumes pipeline's R2 keys are byte-exact under the canonical layout.
- **Q2 — Vitest integration test layer:** sized into 3 substrate-mock acceptance tests (extending `tests/server/auth/pseudonym.test.ts`) + 2 real-Postgres integration tests (new directory `tests/db/identity-pool/`, mirroring `tests/db/triggers/` precedent).
- **Q3 — Verify-script error-handling shape:** exit 0 on all-pass / 1 on any-fail; text PASS/FAIL per check; hard-coded `N=20` for HEAD spot-check.

### Locked decisions absorbed verbatim (LDs 1-9 from brief §0)

- Scope strictly narrowed: SCAFFOLD.17 ships **net-new artifacts only**. The 4 SCAFFOLD.2/3-shipped substrate files (`src/db/schema/identity.ts`, `src/server/identity-pool/consume.ts`, `src/server/auth/index.ts` hook, `drizzle/migrations/0003_append_only_triggers.sql:108-129` trigger) are NOT touched.
- Pattern locks: signal-table + state-row + transition-detection for pg_cron alarm (research brief R1 + R3); 1,000-row chunks with composite ON CONFLICT target for seed-script (R2); sequential HEAD with seeded SHA-256 sampling for verification spot-check (R4); test SQL function directly (NOT scheduled tick) per R5.
- Threshold arithmetic: `unassigned * 20 < total` (integer; avoids floating-point).

### Phase-0 SURPRISES (documented in plan §3; none blocking)

- **SURPRISE-1 — TODO(SCAFFOLD.5) anchor count.** Brief cites 5 anchors including `auth/index.ts`; actual at HEAD is **4** (no anchor in `auth/index.ts`). **Resolution:** SCAFFOLD.17 ships ONLY the pg_cron SQL `INSERT INTO cron_alarms` side; no new TS-side anchor (the pg_cron job is pure SQL). TS-side drain+emit lands in SCAFFOLD.5 alongside Sentry SDK init.
- **SURPRISE-2 — ADR + PSEUDONYM file backfill.** Only `docs/adr/0001-license-choice.md` exists at HEAD; ADR-0003..0016 + `docs/specs/PSEUDONYM.md` are accepted decisions whose file backfill is queued maintenance per user-memory. **Resolution:** reference as decision names (matching shipped convention at `consume.ts:1-22`).
- **SURPRISE-3 — SCAFFOLD.15 close-out §11.1 sequencing reference.** Brief cites SCAFFOLD.15 close-out §11.1 as ratifying stratum sequencing; `docs/logs/SCAFFOLD.15.md` contains no §11.1 section and no SCAFFOLD.17 mention. **Resolution:** treat as brief-level operator decision, not logged ratification.
- **SURPRISE-4 — F-AUTH-3.md is a skeleton.** `docs/specs/flows/F-AUTH-3.md` exists but its sections are `<placeholder>`; F-AUTH-3 substance lives in SPEC.1 §13 + `consume.ts:1-22`. **Resolution:** reference F-AUTH-3 by decision name; flow-skeleton population follows SPEC.2 §13.4 cadence.

### Operator prereqs (brief §6) — all green at /plan opening

- Migration index: `0006_image_uploads_extension.sql` is last shipped; `0007_pg_cron_jobs.sql` is the free next index.
- Test baseline: `pnpm vitest run tests/server/auth/pseudonym.test.ts` passes (6 tests + 1 it.todo, 256 ms).
- Supabase local pg_cron: extension is in `shared_preload_libraries` of supabase/postgres image; `CREATE EXTENSION pg_cron WITH SCHEMA extensions` succeeded against running `supabase start` instance.
- Q1 resolution (operator-confirmed CSV/5-col, above).
- Drizzle version: `drizzle-orm ^0.45.0` per `package.json`; composite ON CONFLICT `target: [...]` syntax stable per research brief R2.

---

## Open questions

- **None at plan-mode close.** Operator may surface concerns after reading the plan; if so, surface in the execute chat kickoff prompt.

---

## Next session starts at

**Execute chat.** Branch `plan/scaffold-17` is the starting point; the SCAFFOLD.17 PR will land against `plan/scaffold-17` HEAD (not `main`).

**Phase 2 START** per CLAUDE.md §5.6: `test-writer` reviewer-call invocation as a fresh-context `general-purpose` Agent with the role briefing at `.claude/agents/test-writer.md` baked into the prompt + plan path `@docs/plans/SCAFFOLD.17.md` + tool-scope constraint (Read + Write/Edit tests-only; no `src/` edits).

Test-writer's deliverable: 5 failing tests across 3 files:
- `tests/db/identity-pool/seed.test.ts` (4 sub-tests).
- `tests/db/identity-pool/watermark.test.ts` (6 sub-tests).
- 3 new sub-tests appended to `tests/server/auth/pseudonym.test.ts`.

Plus fixtures: `tests/db/identity-pool/_fixtures/manifest-100.csv` + `manifest-malformed.csv`.

After tests-first lands FAILING, implement §A-§F in order: seed-script → migration → verify-script → run all tests GREEN → SPEC.2 B.15 amendments → pre-PR self-audit (§6) → reviewer calls (§5) → `gh pr create`.

---

## Context to preserve (non-obvious state across `/clear`)

- **Same-commit SPEC.2 B.15 drifts** queued for execute PR (per LD-9): line 2663 (`1-9` → `0-999`) + line 2664 (kebab-slug → PascalCase). Both land in the same `feat(scaffold-17): ...` commit as the code; NOT a separate docs commit. ENGINE.6 process improvement #5 applies.
- **NO new TS-side TODO(SCAFFOLD.5) anchor** in SCAFFOLD.17 — the pg_cron job is SQL-only; the anchor count stays at 4 after SCAFFOLD.17 merges. The brief's framing of "5 existing anchors" is incorrect (SURPRISE-1).
- **ADR + PSEUDONYM.md file backfill remains queued maintenance.** Do NOT propose creating ADR-0006/0007/0011 files or PSEUDONYM.md in SCAFFOLD.17; the brief references them as decision names.
- **F-AUTH-3.md is a `<placeholder>` skeleton.** Do NOT populate in SCAFFOLD.17; SPEC.2 §13.4 gating cadence applies.
- **`watermark_state` + `cron_alarms` are operational tables** (NOT Bucket A/B protected). No new entry needed in SPEC.2 §5 inventory for these; no append-only triggers; same-commit B.15 amendments are the only SPEC.2 edits.
- **Reviewer-call invocation policy** locked at plan §5 (test-writer Phase 2 START; code-reviewer + db-migration-reviewer + security-auditor post-audit). All are fresh-context `general-purpose` Agent calls with role briefings at `.claude/agents/*.md` baked into the prompt — they are NOT auto-discoverable subagent types.
- **Pre-PR self-audit (§6)** walks §A-§F item-by-item before `gh pr create`. ENGINE.6 process improvement #6 (verify-don't-trust on lint dismissals) applies: any "pre-existing pattern" lint dismissal must be grep-verified before acceptance.
- **LOC test budget** ~550-750 LOC (300-400 real-Postgres + 250-350 substrate-mock). Plan §9 flag: if implementation lands materially over budget, surface as a SURPRISE in execute close-out.
- **pg_cron schedule lookup key** is `'identity-pool-watermark'`. The schedule-registration test (§D test 6) queries `SELECT jobname FROM cron.job WHERE jobname = 'identity-pool-watermark'`.

---

## Time

Plan-mode session: ~30-45 min wall-clock from operator kickoff (chat opening + briefs uploaded) to commit `04d1979` + this log commit + branch push. No blocking waits beyond Q1 (single AskUserQuestion turn).

---

*End of SCAFFOLD.17 plan-mode close-out. Operator next action: read the plan; if it reads correctly against the brief, /clear this chat and open execute chat against `plan/scaffold-17` head. If concerns surface, raise in plan-review iteration before /clear.*

---

# SCAFFOLD.17 — plan-mode flag-absorption entry (web Claude review)

> Second log entry; appended 2026-05-25 after web Claude reviewed `docs/plans/SCAFFOLD.17.md` at `04d1979` and surfaced three flags. All absorbed in commit `9dac4d9` on `plan/scaffold-17`. Six fields per CLAUDE.md §5.9.

## What landed (second entry)

- **Commit 3 — `9dac4d9` `plan(scaffold-17): absorb web Claude review flags 1-3`:**
  - `docs/plans/SCAFFOLD.17.md` amended (+73 / -22; net +51 lines; 526 → 577).
- **Commit 4 — `<this commit>` `chore(scaffold-17): log session - flag absorption`:**
  - This second log entry appended to `docs/logs/SCAFFOLD.17.md`.

## Decisions made (second entry)

### Flag 1 (FAIL within scope) — §D Tests 3-5 independence

Rewrote Tests 3-5 with explicit in-test setup steps following the (insert → function → mutate → function) pattern. Web Claude flagged Test 4 as the surfaced symptom; Tests 3 + 5 had the same root cause (implicit inter-test state dependency violating vitest `beforeEach`-per-test semantics). Operator ratified broader-than-flagged absorption at amendment time.

### Flag 2 (FAIL within scope) — §E Test 9 negative-space assertion

Replaced static-import grep against `consume.ts` with `expectTypeOf<…>().toEqualTypeOf<{ pseudonym: string; pfpFilename: string } | null>()` + `vi.spyOn(globalThis, "fetch")` zero-invocation assertion. Type-narrowing + fetch-spy catches both compile-time return-shape drift and runtime HTTP-fetch leaks from the signup hot path.

### Flag 3 (SURPRISE, load-bearing) — §F same-commit scope extension

Extended §F same-commit amendment scope from 2 SPEC.2 B.15 edits to **5 coordinated SPEC.2 edits** per ENGINE.6 process improvement #5:
- Edit 1: B.15 line 2663 (number range).
- Edit 2: B.15 line 2664 (pseudonym shape).
- Edit 3: §5.1 Bucket C rows 22 + 23 (`watermark_state` + `cron_alarms`; domain `system`; owner ADRs `ADR-0006 + ADR-0007`; "operational / pg_cron-machinery" Notes tag).
- Edit 4: §5 opening prose (table count 21 → 23; Bucket C 8 → 10).
- Edit 5: §5.2 summary table (Bucket C count + tables list).

### Five judgment calls operator-ratified

1. **Flag 1 absorption broader than flagged** — Tests 3 + 5 rewrite alongside Test 4 (root cause symmetry).
2. **Bucket C classification with operational sub-distinction** — vs new Bucket D (too aggressive amendment scope expansion).
3. **Domain `system`** — vs new `cron` domain (no §5.3 nine-domains list change required).
4. **Owner ADRs `ADR-0006 + ADR-0007`** — decision names per SURPRISE-2 (ADR file backfill remains queued maintenance).
5. **No Drizzle schema files in SCAFFOLD.17** — raw-SQL access pattern only; SCAFFOLD.5 may add `src/db/schema/system.ts` later (CF-5).

### Plus: §D raw-SQL access pattern clarifying note

Added per operator request: explicit note that `watermark.test.ts` uses `testDb.execute(sql\`...\`)` for reads + `testClient.unsafe(...)` for mutations on `watermark_state` + `cron_alarms` because no Drizzle declarations ship in SCAFFOLD.17. `identity_pool` continues with the typed Drizzle query builder unchanged. SCAFFOLD.5 may migrate the raw-SQL paths to typed query-builder calls when it adds Drizzle declarations.

### New SURPRISE-5 added to plan §3

SPEC.2 §5.1 has no "Operational" category — only Buckets A/B/C. Bucket C placement of `watermark_state` + `cron_alarms` is the lowest-risk read of web Claude's "use existing convention" pre-authorization. Notes-column tag carries the "operational / pg_cron-machinery" sub-distinction.

## Open questions (second entry)

- **None at flag-absorption close.** Operator confirmed all 5 judgment calls + the ordering choice (append-end-of-Bucket-C). Execute chat proceeds against `plan/scaffold-17` head at the post-log commit.

## Next session starts at (second entry)

Unchanged from initial close-out: execute chat against `plan/scaffold-17` head. Phase 2 START is the `test-writer` reviewer-call invocation per CLAUDE.md §5.6.

The execute chat references `docs/plans/SCAFFOLD.17.md` (now amended at `9dac4d9`) as the canonical plan contract. Reviewer-call schedule + pre-PR self-audit walk + exit criteria all unchanged from the initial entry except:
- `test-writer` deliverable includes Test 9's `expectTypeOf` + `vi.spyOn(fetch)` shape (Flag 2 absorption) and Tests 3-5 explicit in-test setup (Flag 1 absorption).
- Pre-PR self-audit § F walk now covers 5 SPEC.2 edits, not 2.

## Context to preserve (second entry; supplements first entry)

- **5 coordinated SPEC.2 edits in §F** — all same-commit per ENGINE.6 #5; pre-PR self-audit walks all 5.
- **`watermark_state` + `cron_alarms` are Bucket C** (operational / pg_cron-machinery), domain `system`, owner ADRs `ADR-0006 + ADR-0007`. No Drizzle declarations in SCAFFOLD.17.
- **`watermark.test.ts` raw-SQL access pattern** — `testDb.execute(sql\`...\`)` for reads, `testClient.unsafe(...)` for mutations. `identity_pool` continues with typed Drizzle query builder.
- **Test 9 uses `expectTypeOf` + `vi.spyOn(fetch)`** — NOT static-import grep.
- **Tests 3-5 are independent** — explicit in-test setup; do NOT depend on inter-test state ordering.
- **Test LOC budget rises** to ~660–910 LOC (from ~550–750 pre-absorption). Tests 3-5 setup adds ~10–20 LOC each; Test 9 expectTypeOf+spyOn shape adds ~30–50 LOC.
- **§5.1 Bucket C row ordering** — appended at end (rows 22 + 23 after row 21 `positions`). Bucket C orders loosely; intro phrase "Within each bucket, ordered by §3 lock-order spine where applicable, then by FK-dependency order" is descriptive — `watermark_state` + `cron_alarms` are in neither spine, so end-of-bucket is the natural placement. `system_state` is Bucket B not C, so "adjacent to `system_state`" was not an option.

## Time (second entry)

Flag-absorption iteration: ~20 min wall-clock from web Claude review return through commit `9dac4d9` + this log commit + push.

---

*End of SCAFFOLD.17 plan-mode flag-absorption entry. Operator next action: confirm absorption reads correctly + `/clear` this chat + open execute chat against `plan/scaffold-17` head at the post-log commit.*

