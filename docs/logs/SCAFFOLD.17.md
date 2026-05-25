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

---

# SCAFFOLD.17 — execute close-out

> Third log entry; appended 2026-05-25 at execute-chat close, before `/clear`, before operator PR review. Six fields per CLAUDE.md §5.9.

## What landed (third entry)

- **Branch:** `feat/scaffold-17` cut from `main` at `42baa8b` (post-ENGINE.6 merge); NOT from `plan/scaffold-17`. Plan branch carries planning artifacts as separate history; execute PR brings only the implementation.
- **PR:** [#50](https://github.com/zugzwang-foundation/experiment/pull/50) — `feat(scaffold-17): identity-pool seed + pg_cron low-watermark + verification` against `main`.
- **Commits on `feat/scaffold-17`:**
  - `8700d8e` — Phase 1 scaffold (empty files + fixtures + package.json scripts).
  - `c1d2ba4` — Phase 2 START tests-first (test-writer reviewer-call output): 10 fail-first tests + 3 regression-guards.
  - `9fca58b` — Phase 2 §B pg_cron migration (`0007_pg_cron_jobs.sql`) + drizzle meta journal + 0007 snapshot (duplicates 0006 shape; new tables are raw-SQL-only per Flag 3 absorption).
  - `cad1d99` — Phase 2 §A `scripts/seed-identity-pool.ts` (chunked bulk-INSERT; `runSeed` exported; CLI exit codes 0/1/2/3; dynamic `import("@/db")` keeps prod pool out of test runtime).
  - `4ff971b` — Phase 2 §C `scripts/verify-identity-pool.ts` (4 checks; SHA-256-seeded 20-sample HEAD spot-check via `headObject`).
  - `fbf3ba7` — Phase 2 §F 5 SPEC.2 same-commit amendments (B.15 line 2665+2666 + §5.1 Bucket C rows 22+23 + §5 prose 21→23 + §5.2 summary table 8→10).
  - `ac06b55` — Post-audit MEDIUM fix: ESM main-gate `import.meta.url === \`file://${process.argv[1]}\`` → `pathToFileURL(process.argv[1]).href` per code-reviewer reviewer-call.
- **Files:** 14 changed; 4669 insertions; 5 deletions.
  - Net-new code: `scripts/seed-identity-pool.ts` (218 LOC), `scripts/verify-identity-pool.ts` (130 LOC), `drizzle/migrations/0007_pg_cron_jobs.sql` (82 LOC), `tests/db/identity-pool/seed.test.ts` (158 LOC) + `watermark.test.ts` (240 LOC).
  - Net-new fixtures: `_fixtures/manifest-100.csv` (101 lines) + `_fixtures/manifest-malformed.csv` (4 lines).
  - Extended: `tests/server/auth/pseudonym.test.ts` (+223 LOC = 3 new tests + import-line edit; existing 6 active tests + 1 it.todo unmodified).
  - Modified: `docs/specs/SPEC.2.md` (5 hunks per §F).
  - Plan + log copied from `plan/scaffold-17` into the feat branch so reviewers have execute context in-tree.

## Decisions made (third entry)

### Pre-PR self-audit (§6 + CLAUDE.md §5.10) — PASS

Walked §A–§F inventory item-by-item with grep verification:
- **§A**: CSV parser anchors, `ManifestParseError` export, `CHUNK_SIZE=1_000`, `onConflictDoNothing({ target: [colour, animal, number] })`, exit codes 0/1/2/3 all present + correctly discriminated; `pathToFileURL` main-gate post-MEDIUM-fix. `package.json` `seed:identity-pool:prod` entry present.
- **§B**: `CREATE EXTENSION`, `CREATE TABLE watermark_state` + `cron_alarms`, `CREATE OR REPLACE FUNCTION check_identity_pool_watermark`, `unassigned * 20 < total` threshold (line 13 doc + line 46 SQL), 5 `--> statement-breakpoint` separators, `cron.schedule('identity-pool-watermark', '*/5 * * * *', ...)` all present. Local DB verified post-migrate: `cron.job` has the row (active=t), `watermark_state` seeded to `'above'`, `cron_alarms` empty.
- **§C**: 4 PASS/FAIL/INFO checks, `EXPECTED_TOTAL=50_000`, `SAMPLE_N=20`, `headObject` consumed via dynamic import from `@/server/storage/r2`. `package.json` `verify:identity-pool` entry present.
- **§D**: 4 + 6 sub-tests with names matching plan §D; afterEach/beforeEach TRUNCATE CASCADE; fixtures present and well-formed.
- **§E**: 3 new tests appended at lines 366, 434, 512 (after existing it.todo at line 361); `expectTypeOf` imported at line 6 + used at line 534; `vi.spyOn(globalThis, "fetch")` at line 545; existing 6 active tests bodies UNCHANGED (git diff shows only additions).
- **§F**: 5 SPEC.2 amendments grep-verified — old text 0 matches, new text 1 match each.

Test budget: ~620 LOC net-new (158 + 240 + 220), well under plan §9 ceiling of 660–910 LOC. No LOC-overage SURPRISE.

### Reviewer-call subagents (Phase 2 post-audit per CLAUDE.md §5.11) — 3 invocations

1. **db-migration-reviewer**: PASS on all schema + function + 5 SPEC.2 amendments + meta journal + snapshot. 3 SURPRISEs surfaced (all cosmetic; see "Surprises caught + fixed in-session" below).
2. **code-reviewer**: 1 MEDIUM **fixed in-session** + 7 LOW deferred. Details below.
3. **security-auditor**: 0 CRITICAL / 0 HIGH / 0 MEDIUM. 1 LOW (header doc nit — `cron_alarms` accumulation bound not quantified in migration header; bound IS quantified in plan §B; not exploitable at `bigserial` × ~576 rows/day worst case vs 9e18 capacity).

### Surprises caught + fixed in-session

Per CLAUDE.md §5.10 self-audit ritual + user memory pattern (close-out subsection, not buried footnote):

1. **code-reviewer MEDIUM — ESM main-gate path-symlink-fragile.** `import.meta.url === \`file://${process.argv[1]}\`` returns false when the script is invoked via a symlinked path (macOS Darwin `/tmp` → `/private/tmp`) because Node's `import.meta.url` resolves symlinks while `process.argv[1]` preserves un-resolved paths. Production invocation path (`pnpm seed:identity-pool:prod` → `tsx scripts/seed-identity-pool.ts`) is safe in this repo (working tree NOT under a Darwin-symlinked root), but the failure mode would be silent (script imports cleanly, exits 0 without doing anything). Test path unaffected (tests import `runSeed` directly, not `main`). **Fix in-session per CLAUDE.md §7 in-stratum drift absorption (< 2 hours):** commit `ac06b55` replaces with canonical `pathToFileURL(process.argv[1]).href` idiom + adds `process.argv[1] &&` guard. Pattern matches existing `node:url` consumption in `tests/db/identity-pool/seed.test.ts:13`.

2. **db-migration-reviewer SURPRISE — SPEC.2 line numbers shifted by +2 from plan citations.** Plan §F cites lines 2663 (`number` row) + 2664 (`pseudonym` row). Actual landed at lines 2665 + 2666 — a +2 shift likely from a prior PRECURSOR-era additive edit pushing the B.15 section down. Content is verbatim-correct in both rows (grep-verified: old `1-9 per ADR-0011` = 0 matches, new `0-999 per ADR-0011` = 1 match; old `Composed slug` = 0 matches, new `PascalCase concatenation` = 1 match). No correctness issue; cosmetic plan-citation drift only. **Resolution:** absorbed (no plan amendment); future strata referencing B.15 line numbers should grep instead of hard-coding.

3. **db-migration-reviewer SURPRISE — local Supabase preinstalls pg_cron in `pg_catalog`, prod-aligned environments use `extensions`.** `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions` succeeds idempotently locally because IF NOT EXISTS short-circuits before the schema specification matters. On Supabase production the extension lives in `extensions` per `cron.schema_name`, so the statement remains correct for the deploy target. **Resolution:** plan §B note already acknowledges "succeeded locally"; no action.

4. **db-migration-reviewer SURPRISE — SQL tab indentation vs plan markdown rendering.** Plan §B prints the file with space indentation; shipped file uses tab indentation per Biome convention + existing `0003_append_only_triggers.sql` + `0006_image_uploads_extension.sql` precedent. Semantically identical. **Resolution:** absorbed; cosmetic.

5. **code-reviewer LOW — `noUncheckedIndexedAccess` missing from `tsconfig.json` despite AGENTS.md §1 claim.** AGENTS.md §1 declares `noUncheckedIndexedAccess: true`; actual `tsconfig.json` does NOT set it. Pre-existing global drift, NOT SCAFFOLD.17 scope (the seed-script's `lines[i] as string` cast is forced by this gap). **Resolution:** Carry-forward CF-9 — flag for next tsconfig sweep; AGENTS.md is the source of truth; tsconfig should align.

### LOW findings deferred per CLAUDE.md §7 cleanup absorption rule (carry-forward)

- code-reviewer LOW: `as unknown as Array<{...}>` casts in scripts match repo convention (verified at `scripts/seed-identity-pool-dev.ts:87`, `tests/db/identity-pool/seed.test.ts:86-88`, `watermark.test.ts:97-100`). Letter-of-AGENTS.md-§4 gap could be closed with one-line comments. **CF-8** (HARDEN.\* docs sweep).
- code-reviewer LOW: docstring "Re-runs are safe" is precisely "Re-runs of the SAME manifest are safe" — `pseudonym` UNIQUE constraint would raise 23505 (caught at exit-2) for a pseudonym collision against a DIFFERENT manifest. **CF-10** (one-line tightening; non-blocking).
- code-reviewer LOW: `noUncheckedIndexedAccess` global gap (see #5 above). **CF-9**.
- code-reviewer LOW: sequential OFFSET queries × 20 in verify-script — plan §C explicitly accepted "20 short queries; acceptable at this N". **CF-11** (HARDEN.\* if 50K grows).
- code-reviewer LOW: hard-coded `image/webp` content-type check — plan §C explicitly specified. Tripwire if pipeline ever ships AVIF/JPEG/PNG fallbacks.
- code-reviewer LOW: `Promise<never>` return type on `main()` — technically correct; matches `process.exit(...)` discipline.
- security-auditor LOW: migration header could quantify `cron_alarms` accumulation bound until SCAFFOLD.5 drain ships (~576 rows/day worst case vs `bigserial` 9e18 capacity). **CF-12** (one-line migration header addition; non-blocking).

### Test-writer regression-guard discipline (plan §E Tests 7-9)

Tests 7-9 pass on the current commit by design — they are **regression guards**, NOT fail-first per CLAUDE.md §5.6 strict interpretation. The kickoff prompt explicitly authorised this: *"Do NOT contrive a way to make Test 9 fail-first if the contract is 'regression guard only'."* Plan §E acknowledges this — Flag 2 absorption rationale states the new shape *"catches any future drift…"*. Test-writer subagent documented the design choice + coverage map; no judgment call required at execute time.

## Open questions (third entry)

- **None blocking PR review.** All in-scope items resolved; out-of-scope LOW findings + reviewer SURPRISEs documented above as CF-8 through CF-12.
- **Awaiting operator review.** PR #50 is open against `main`; CI not yet run at log-write time. Operator confirms merge readiness after CI green.

## Next session starts at

**SCAFFOLD.16 brief-drafting chat** per the plan-mode close-out's stratum sequencing (ENGINE.6 → SCAFFOLD.17 → SCAFFOLD.16). SCAFFOLD.16 substance per `docs/logs/SCAFFOLD.15.md` line 130: PhotoDNA + Safer parallel moderation.

After SCAFFOLD.17 merges, operator runs the post-merge runbook per plan §6 (operator-side; not blocking for downstream strata).

## Context to preserve (third entry; supplements first + second)

### Operator-side post-merge runbook (per plan §6)

The seed + verify scripts ship NOW; operator runs them post-merge AFTER the external-dev image pipeline (B1) delivers the 50K `.webp` files + CSV manifest. The plan does NOT block on B1.

1. **External-dev pipeline (B1).** Operator-side parallel work — 50K `.webp` files uploaded to `zugzwang-pfp/v1/` + CSV manifest produced (Q1 5-column shape: `colour, animal, number, pseudonym, pfp_filename`). NOT in SCAFFOLD.17 scope.
2. **`pnpm seed:identity-pool:prod <manifest-path>`.** Operator runs against production DB. Wall-clock ~30 s (50 chunks × 1,000 rows × ~0.5 s/chunk per research brief R2).
3. **`pnpm verify:identity-pool`.** Runs the 4 checks; exit 0 means all pass.
4. **`SELECT jobname FROM cron.job WHERE jobname = 'identity-pool-watermark'`.** Operator confirms 1 row post-deploy.
5. **`SELECT * FROM watermark_state WHERE metric = 'identity_pool_unassigned'`.** Operator confirms `state = 'above'`.
6. **`SELECT count(*) FROM cron_alarms`.** Operator confirms 0 rows (no false-positive alarms at deploy time).

### Carry-forwards minted in execute

- **CF-8** — Code-reviewer LOW: `as unknown as Array<...>` casts in seed/verify scripts. One-line repo-convention comments would close the letter-of-AGENTS.md-§4 gap. HARDEN.\* docs sweep.
- **CF-9** — Code-reviewer LOW: `noUncheckedIndexedAccess` missing from `tsconfig.json` despite AGENTS.md §1 claim. Pre-existing global drift; tsconfig should align with AGENTS.md. HARDEN.\* tsconfig sweep.
- **CF-10** — Code-reviewer LOW: docstring "Re-runs are safe" → "Re-runs of the SAME manifest are safe" (pseudonym UNIQUE would raise 23505 on cross-manifest collision). One-line tightening.
- **CF-11** — Code-reviewer LOW: verify-script's 20 sequential OFFSET queries — acceptable at N=50K per plan §C; revisit if N grows.
- **CF-12** — Security-auditor LOW: migration header could quantify `cron_alarms` accumulation bound. Non-blocking; one-line addition.
- All carry-forwards land in the operator's task tracker rather than in code today (per CLAUDE.md §7 cleanup absorption rule — drift items <2h absorb in-stratum, OR mint a real task; these are documentation-only nits without immediate consequence).

### Reviewer-call invocation pattern (load-bearing for future execute chats)

All 3 post-audit reviewer subagents (db-migration-reviewer, code-reviewer, security-auditor) invoked **in parallel** in a single message via 3 `Agent` tool calls with `subagent_type: "general-purpose"` + role briefing baked into the prompt + plan path + tool-scope constraint. Parallel invocation cut wall-clock by ~3× vs sequential.

### Specific implementation choices ratified at execute time (non-obvious; preserve for future strata)

- **Drizzle 0007 snapshot is a pure shape-duplicate of 0006** (only `id` + `prevId` change). Per Flag 3 absorption + plan §B note: `watermark_state` + `cron_alarms` ship as raw SQL only (no Drizzle declaration in SCAFFOLD.17). SCAFFOLD.5 MAY add Drizzle declarations at `src/db/schema/system.ts` when it ships the drain handler — at that point the snapshot diff will land naturally.
- **Drizzle meta `_journal.json` `when` timestamp** for idx 7 set to `1779832800000` (~2026-05-25 06:00:00 UTC). Chosen as a small monotonic increment over 0006's `1779614793533` to preserve journal ordering; the exact value is not load-bearing.
- **Seed-script's `import.meta.url === pathToFileURL(...).href`** prevents `main()` from running when tests import `runSeed` directly. Without this gate, the test process would call `process.exit(...)` and crash the runner. Pattern minted at SCAFFOLD.17; reusable for future tsx-invocable scripts.
- **Test-writer reviewer-call's pseudonym.test.ts extension** added 3 new tests AFTER the existing `it.todo` (now at line 361 post-import-line-shift, previously at 352 per plan). The shift is from the import-line edit adding `expectTypeOf` to the named imports; existing 6 active test bodies UNCHANGED.

## Time (third entry)

Execute session: ~70-90 min wall-clock from operator kickoff to PR #50 + this log entry + push. Breakdown:
- Phase 0–1 (baseline + scaffold): ~10 min.
- Phase 2 START (test-writer reviewer-call): ~8 min wall-clock for subagent; ~5 min for verification + commit.
- Phase 2 implementation (§B + §A + §C + §F): ~15 min.
- Phase 2 post-audit (3 reviewer subagents in parallel): ~8 min wall-clock (parallel invocation); ~5 min for review + MEDIUM fix.
- Phase 2 pre-PR self-audit: ~5 min.
- Phase 3 (push + PR open): ~3 min.
- Phase 4 (this log entry): ~10-15 min.

Cogitation: dominated by reviewer-subagent prompt drafting (tool-scope constraints, target file enumeration, briefing references) — ~10 min cumulative across the 4 invocations (1 test-writer + 3 post-audit). Plan + brief reading at chat opening: ~5 min.

---

*End of SCAFFOLD.17 execute close-out. Operator next action: review PR #50 + CI green + merge against `main`. Post-merge runbook per "Context to preserve" → Operator-side runbook above. Next stratum: SCAFFOLD.16 brief-drafting.*
