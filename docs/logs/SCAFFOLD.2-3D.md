# SCAFFOLD.2-3D — Session log

- **Task ID:** SCAFFOLD.2 stratum 3.D
- **Date:** 2026-05-12
- **Branch:** `feat/scaffold-2-stratum-d`
- **PR:** [#30 — feat(scaffold-2): d — trigger tests (14 files, 51 cases) + INV-4](https://github.com/zugzwang-foundation/experiment/pull/30) (draft)
- **Phase 2 commit:** `c98a692` (18 files, +1737)
- **Plan:** `docs/plans/SCAFFOLD.2-3D.md` (941 lines, committed at `50cc64b` Phase 1 close)
- **Author:** Hrishikesh + Claude Code Opus 4.7 (1M context, Phase 1 + Phase 2) + general-purpose subagent (test-writer-equivalent; see drift §4 inherited #1) + web Claude Opus 4.7
- **Duration:** ~3 hours wall-clock (planned 5–7 hours; clean run, no mid-stratum surfacings beyond drift absorption)

---

## 1. Goal and exit criterion

**Goal.** Lock the storage-layer trigger contract from 3.C (PR #28, `drizzle/migrations/0003_append_only_triggers.sql`) under a Vitest test suite. 13 trigger spec files (one per protected table) + 1 INV-4 canonical at `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` + supporting fixture + vitest config. ≥33 cases (SPEC.2 §6.6 floor); target 51.

**Exit criterion.** `just verify` green; `just test-db` reports 51 pass / 0 fail / 0 skip against a fresh local Supabase Postgres 17.6 with the 5 migrations applied; pre-PR self-audit reports zero FAIL and zero SURPRISE; PR opened against `main` with the inventory and drift list documented.

**Met.** All exit criteria satisfied. PR #30 (draft) opened 2026-05-12.

---

## 2. What landed (PR #30)

### Test infrastructure

| File | Function |
|---|---|
| `vitest.config.ts` (root, NEW) | `vite-tsconfig-paths` plugin, `pool: 'forks'`, `fileParallelism: false`, `globals: false`, `testTimeout: 10_000`, no coverage. |
| `tests/db/_fixtures/db.ts` (NEW) | Two-client split — `testClient` (raw `postgres-js`, `max: 1`) for assertion SELECTs returning `Date` and rejection-path `unsafe()` calls; internal `drizzleClient` (`max: 1`) wrapped as `testDb` (Drizzle 0.45) for INSERT setup. Plus `TestDb` type and `createdAtFromUuidV7(id: string): Date` helper used by the INV-4 case 3 replay test. |

### Bucket A spec files (9 × 2 = 18 cases)

| File | Cases | FK chain |
|---|---|---|
| `tests/db/triggers/events-append-only.spec.ts` | 2 | none; explicit `createdAt = '2026-06-15T12:00:00Z'` (mid `events_2026_06`) |
| `tests/db/triggers/dharma-ledger-append-only.spec.ts` | 2 | users |
| `tests/db/triggers/bets-append-only.spec.ts` | 2 | users → markets → comments(bet_id NULL) → bets |
| `tests/db/triggers/comments-append-only.spec.ts` | 2 | users → markets → comments (storage-layer mechanism of INV-3) |
| `tests/db/triggers/resolution-events-append-only.spec.ts` | 2 | markets |
| `tests/db/triggers/payout-events-append-only.spec.ts` | 2 | 6-table chain through markets/comments/bets/resolution_events |
| `tests/db/triggers/mod-actions-append-only.spec.ts` | 2 | none (target_* nullable; `actor_id = 'admin-singleton'`) |
| `tests/db/triggers/admin-events-append-only.spec.ts` | 2 | none |
| `tests/db/triggers/user-events-append-only.spec.ts` | 2 | users |

### Bucket B spec files (4 files, 30 cases)

| File | Cases | Non-whitelisted column for mutation | Carve-out |
|---|---|---|---|
| `tests/db/triggers/friendly-fire-events-append-only.spec.ts` | 10 | `direction` (up→down) | both-together-reject (case 3); 3 no-op-accept cases (case 7 pre-transition both-NULL + cases 8,9 post each column) |
| `tests/db/triggers/identity-pool-append-only.spec.ts` | 6 | `pseudonym` | no FKs |
| `tests/db/triggers/image-uploads-append-only.spec.ts` | 8 | `r2_object_key` | partial-transition-reject (cases 4, 5) |
| `tests/db/triggers/system-state-append-only.spec.ts` | 6 | `created_at` | singleton — per-test rollback wrap (`RollbackSignal` + `inRolledBackTx`); every mutation via `tx`, never `testDb`. Hard rule CAT 4.13.2 honored: `testDb` symbol does not appear anywhere in the file. |

### INV-4 canonical (1 file, 3 cases)

| File | Cases |
|---|---|
| `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` | (1) `resolution_events` UPDATE rejected at storage layer (INV-4 mechanism ii); (2) `payout_events` UPDATE rejected; (3) SPEC.2 §7.3 storage idempotency — `ON CONFLICT (event_id, created_at) DO NOTHING` exactly-once on retry. Case 3 uses `uuidv7()` from the npm `uuid` package + `createdAtFromUuidV7()` + raw `testClient.unsafe()`. |

### Other repo changes

- `package.json` — `vite-tsconfig-paths: ^6.1.1` added to `devDependencies` (one line).
- `pnpm-lock.yaml` — refreshed (3 packages added; plugin + 2 small transitives).

**Case totals: 18 + 30 + 3 = 51. SPEC.2 §6.6 floor 33 met with margin of 18.**

---

## 3. Decisions made

### At plan time (Phase 1, sign-off held 2 questions)

- **Q1 — INV-4 mechanism coverage.** SPEC.2 §14.1 has 4 mechanisms (not 3 as the kickoff prompt's self-critique step 4 said). 3.D verifies mechanism (ii) [Bucket-A append-only on `resolution_events` + `payout_events`] + §7.3 storage idempotency. Mechanisms (i)/(iii)/(iv) lock at ENGINE.9 + SCAFFOLD.3 per §14.2 two-test-layer split. **Resolved Hrishikesh: read is correct; future canonical entries 002, 003 land at those stratums.**
- **Q2 — `system_state` afterEach.** CAT 2 default "UPDATE-reset" was incompatible with the Bucket-B trigger contract (`OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at` blocks non-NULL → NULL UPDATE). **Resolved Hrishikesh: per-test transaction-rollback wrap via `testClient.begin(async (tx) => { … })` + `RollbackSignal` sentinel.** Documented in the spec file's top comment as a file-specific carve-out from CAT 2.

### Mid-execute (during Phase 2)

- **Drizzle wraps PostgresError → use raw `testClient.unsafe()`** for rejection-path queries. Plan CAT 6 line 639 stated "passes through unchanged"; verified incorrect against `node_modules/drizzle-orm/errors.cjs` line 35 (`DrizzleQueryError extends Error`, wraps original on `.cause`). Empirically: `expect(testDb.update(...)).rejects.toMatchObject({ code: 'P0001' })` would fail. Test-writer-equivalent surfaced this at write-time and routed all rejection assertions through `testClient.unsafe(...)`. INSERT setup retained via `testDb`. Plan's assertion shape `{ code, message }` preserved. **Absorbed in-PR.**
- **Drizzle mutates `postgres-js` parsers → two-client fixture split.** `drizzle(client)` installs identity-parsers on date/time-type OIDs (`node_modules/drizzle-orm/postgres-js/driver.cjs` lines 47-53), so post-wrap SELECTs of `timestamptz` via `testClient` return text instead of `Date` — breaks `expect(rows[0]?.frozen_at).toEqual(new Date(...))` in friendly_fire/identity_pool/image_uploads/system_state accept-path cases. Test-writer-equivalent split into `testClient` (unmutated, exported) + internal `drizzleClient` (mutated, wrapped). Exported fixture API unchanged. **Absorbed in-PR.**
- **`fileParallelism: false` in vitest config.** Plan CAT 5's "`pool: 'forks'` safe with `max: 1` per file" claim missed that parallel forks against ONE local DB race on `TRUNCATE … CASCADE` over shared FK ancestors (`users`, `markets`, `comments`) producing `40P01` deadlocks and `23503` FK violations. Files run sequentially; tests within a file already sequential by Vitest default. Runtime 5.28s. **Absorbed in-PR.**
- **`vite-tsconfig-paths` resolved to ^6.1.1** (plan said ^5.0.0; 6.1.1 is npm current stable on 2026-05-12; plugin API unchanged). **Absorbed in-PR.**

### At self-audit time

- **Pre-PR self-audit (CLAUDE.md §5.10) PASS** across all 16 in-scope files + 7 cross-cutting items. Two PASS+drift markers documented (vitest.config + fixture). Zero FAIL. Zero SURPRISE.
- **Subagent invocation policy (CLAUDE.md §5.11).** `@test-writer` invoked at Phase 2 start with explicit plan path. Project agent file at `.claude/agents/test-writer.md` is not discoverable by the harness Agent tool (built-in types only); invoked `general-purpose` with role + plan baked into the prompt. Honors §5.11 *intent* (fresh-context subagent does test-writing; main session does not). Surface for harness fix (see §4 inherited #1). `@code-reviewer` / `@db-migration-reviewer` / `@security-auditor` NOT invoked — 3.D writes no `src/server/` or `src/db/schema/` or `drizzle/migrations/` code, so the §5.11 table's invocation triggers don't fire.

---

## 4. Drifts absorbed (4 in-PR) and inherited drift (3 flagged for PRECURSOR.5)

### Absorbed in 3.D

| # | Drift | Surface | Resolution |
|---|---|---|---|
| 1 | `vite-tsconfig-paths` version pin stale | `pnpm add -D vite-tsconfig-paths` resolved to 6.1.1, plan said ^5.0.0 | Accept 6.1.1; plan's "current stable" intent honored; plugin API unchanged. Documented inline in PR + commit message. |
| 2 | Drizzle 0.45 wraps `PostgresError` in `DrizzleQueryError` (plan CAT 6 said it passes through) | `rejects.toMatchObject({ code: 'P0001' })` would fail against the wrapper | Route all rejection-path queries through `testClient.unsafe(...)`. INSERT via `testDb` retained. |
| 3 | `drizzle(client)` mutates `postgres-js` type parsers (timestamptz → text on shared client) | `expect(rows[0]?.frozen_at).toEqual(new Date(...))` fails on raw-string return | Two-client fixture split: exported `testClient` unmutated, internal `drizzleClient` wrapped. Exported API unchanged. |
| 4 | Vitest default file-parallelism races cross-file `TRUNCATE … CASCADE` on shared FK ancestors | `40P01` deadlocks + `23503` FK violations on test runs | `fileParallelism: false` in `vitest.config.ts`. `pool: 'forks'` retained. |

All four are test-infrastructure-scoped. None touch `src/db/schema/`, `drizzle/migrations/`, `src/server/`, SPEC, ADR, `CLAUDE.md`, or `AGENTS.md`. `git diff --stat origin/main..HEAD --` against those paths is empty.

### Not fixed (flagged for PRECURSOR.5)

- **`.claude/agents/*.md` not discoverable by the runtime `Agent` tool.** CLAUDE.md §5.11 + §6 + commit `304681b` document `.claude/agents/test-writer.md` as invocable via `subagent_type: "test-writer"`; the runtime returns `Agent type 'test-writer' not found` because only built-in types (`claude-code-guide | Explore | general-purpose | Plan | statusline-setup`) are exposed. Worked around by invoking `general-purpose` with the role baked in. **Backlog fix:** harness / `.claude/settings.json` wiring so project agent files are discovered. Also affects `@code-reviewer`, `@db-migration-reviewer`, `@security-auditor` invocations on future critical-path strata.
- **`just db-migrate` doesn't source `.env.local`.** Already named in 3.C log §4 row 3. Workaround used in this session: inline `DATABASE_URL='postgresql://postgres:postgres@localhost:54322/postgres' pnpm drizzle-kit migrate`. Justfile recipe needs `set dotenv-load := true` or equivalent.
- **`src/db/schema/events.ts` declaration alignment to composite PK** (3.C log §4 row 4). The INV-4 case 3 worked around via raw `testClient.unsafe(...)` for `ON CONFLICT (event_id, created_at) DO NOTHING`.

---

## 5. Verifications

### CAT 7 chain (all PASS)

| Step | Check | Result |
|---|---|---|
| 1 | `just verify` | green (tsc + biome + build, 40 files checked) |
| 2 | `supabase status` | running on `127.0.0.1:54322` |
| 3 | `supabase db reset` | recreated; 5 migrations applied |
| 4 | `just db-migrate` (with inline `DATABASE_URL` workaround) | no pending |
| 5 | `just test-db` | 14 files passed, 51 tests passed, 0 fail, 0 skip, 5.28s |
| 6 | total ✓ count via `vitest --reporter=verbose | grep -cE "✓"` | 51 (target ≥ 51) |
| 7 | per-dir count | 48 trigger + 3 invariant |
| 8 | no skips | ✓ |
| 9 | no `.only(` | ✓ |
| 10 | no `.skip(` | ✓ |
| 11 | file counts | 13 trigger + 1 invariant + 1 fixture |
| 12 | scope diff against `src/`, `drizzle/migrations/`, `docs/specs/`, `docs/adr/`, `CLAUDE.md`, `AGENTS.md` | empty (zero changes) |
| 13 | `system_state` hard-rule grep — `testDb` inside any `it()` body | zero matches |

### Pre-PR self-audit (CLAUDE.md §5.10)

Walked CAT 1 inventory item by item against every file written. 16 in-scope files: 12 PASS, 2 PASS+drift (vitest.config, fixture), 0 FAIL, 0 SURPRISE. 7 cross-cutting audit items: 7 PASS (1 PASS+drift on devDep version). Recorded in `claude-progress.md` for the session, not committed (working note).

### Subagents

No invocations beyond test-writer-equivalent. `@code-reviewer` / `@db-migration-reviewer` / `@security-auditor` did not fire — no `src/server/`, no `src/db/schema/`, no `drizzle/migrations/` work in 3.D.

---

## 6. What's next

### Immediate

Hrishikesh's call. Natural successors per SCAFFOLD.2 master plan + the plan's "Refusal-grade out-of-scope" list:

- **SCAFFOLD.3 — Auth.** Better Auth wiring (participant: Google + Email-OTP; admin: hand-rolled static-password). Per ADR-0004 + ADR-0010 + AGENTS.md §1.
- **ENGINE.5 — Decimal arithmetic library choice.** Pre-condition for Dharma accounting + CPMM pricing math.
- **ENGINE.6 — Events insert helper.** `src/server/events/insert.ts` — the in-transaction `events` row writer with `(event_id, created_at)` deterministic from UUIDv7 prefix per SPEC.2 §3.7 + §7.3.
- **PRECURSOR.5 cleanup pass.** Bundle the four 3.D-newly-flagged inherited drifts (subagent discovery + `just db-migrate` env-source + events composite-PK Drizzle alignment + `supabase/` `.gitignore`) into one focused PR before further strata land.

### PRECURSOR.5 backlog after 3.D

Adding to the 3.C-flagged list (still open: `just db-migrate` env-source, `supabase/` `.gitignore`, ADR ghost references, events PK Drizzle alignment, Sentry alarm 2):

- `.claude/agents/*.md` not discoverable by the runtime `Agent` tool. Harness wiring fix.

### Risk on horizon

- ENGINE.* work will write to `src/server/*` for the first time. The `@code-reviewer` + `@security-auditor` subagent invocation triggers (CLAUDE.md §5.11) will then fire. If the harness-discovery issue is not fixed before then, every critical-path PR pays the `general-purpose` workaround cost. Worth fixing early.
- The `useFlag` runtime contract (AGENTS.md §7) and the bet handler stack (§7) are the next two surfaces. Both are critical-path. Both are well-specified in AGENTS.md / SPEC.2; plan-time discipline (verify against library behavior) per lesson 1 below.

---

## 7. Lessons

1. **Plan-time assertions about third-party library behavior need empirical verification.** Plan CAT 6 stated "Drizzle propagation passes the PostgresError through unchanged" — that is incorrect against Drizzle 0.45 (`DrizzleQueryError` wraps on `.cause`). Plan CAT 5 stated `pool: 'forks' + max: 1` is safe — not against a single local DB with overlapping FK truncate sets. Both surfaces would have been caught by a half-page smoke script (one rejection-path assertion + one parallel-file run) against the actual stack at plan time. Adding to the PRECURSOR.5 "tooling sanity sweep" lesson from 3.C.

2. **Tests-AFTER-implementation works as a deliberate carve-out.** The `@test-writer` agent's default rule is "tests must fail when written"; for 3.D the trigger contract from 3.C already exists. Naming this exception in the plan's anti-pattern checklist (line 900) + the kickoff prompt's instructions to the subagent prevented the agent from balking on green-on-first-run. The kickoff was explicit and unambiguous — the carve-out worked.

3. **System_state's hard rule on `testDb` exclusion is a real footgun, not a stylistic preference.** Plan CAT 4.13.2's exhaustive prohibition on `testDb` inside `it()` bodies (with grep-based audit verification) is the right discipline: a `testDb` write inside a `inRolledBackTx` body would silently commit outside the transaction, leaving `frozen_at` permanently set and breaking every downstream test. The hard rule + audit grep together prevent the failure mode. Test-writer-equivalent honored it — `testDb` does not appear anywhere in the file, not even in the imports.

4. **Pre-PR self-audit caught zero FAIL items at audit-time.** Same pattern as 3.C: drift surfaced at write-time, resolved in-session, audit confirmed clean. The audit is fastest when it has nothing to fix; that's the design.

5. **Two-client fixture split is a generic pattern.** Anywhere `drizzle(client)` and raw `postgres-js` SELECTs need to coexist with `Date` semantics on the raw side, the same split applies. Likely needed again in ENGINE.6 integration tests if those exercise raw + Drizzle paths. Worth carrying the pattern forward.

6. **Plan estimate undershot — favorable side this time.** 5–7 h planned, ~3 h actual. Three drifts absorbed quickly; no mid-stratum SURPRISE; subagent returned cleanly on first invocation. The 3.C overshoot (4 → 6 h on drift) was migration-substrate-grounded; 3.D's test-substrate is more tractable. Estimates for future test strata should bias toward 3.C-style drift-rounds-included rather than ideal-path.

---

## 8. Context to preserve (non-obvious state)

- **`claude-progress.md` lives at repo root, NOT committed.** Working note for the self-audit + drift catalog. Safe to delete after PR merge.
- **`supabase/` directory at repo root remains untracked.** Same as 3.C log §4 row 2 (PRECURSOR.5 `.gitignore` backlog).
- **`.env.local` ships `DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres`.** Sourced manually for `pnpm drizzle-kit migrate` invocations (`just db-migrate` doesn't auto-source).
- **PR #30 is DRAFT.** Per kickoff Step 7 hard rule: do not merge. Hrishikesh's call after web Claude review.
- **The trigger contract was confirmed unbroken.** Green-on-first-run is the correct signal; no `enforce_*` function in `0003_append_only_triggers.sql` was buggy.

---

## 9. References

- **Plan:** `docs/plans/SCAFFOLD.2-3D.md` (941 lines, plan-time self-critique passed Q1+Q2 with Hrishikesh sign-off)
- **Predecessor log:** `docs/logs/SCAFFOLD.2-3C.md`
- **Master plan:** `docs/plans/SCAFFOLD.2.md` §3.D
- **CLAUDE.md:** §1 (critical paths), §2 (invariants), §5.4 (scope), §5.6 (tests this stratum IS the test stratum), §5.9 (this log), §5.10 (pre-PR self-audit), §5.11 (subagent invocation)
- **AGENTS.md:** §6 (Postgres + Drizzle conventions), §9 (testing patterns), §10 (commit + PR conventions), §11 (boundaries)
- **SPEC.2:** §5 (table inventory), §6.1–§6.3 (Bucket A/B append-only enforcement), §6.6 (test-floor 33), §7.1 + §7.3 (composite PK + ON CONFLICT), §14.1 + §14.2 (invariant two-test-layer split)
- **PR:** [#30 — feat(scaffold-2): d — trigger tests (14 files, 51 cases) + INV-4](https://github.com/zugzwang-foundation/experiment/pull/30)
- **Phase 2 commit:** `c98a692`
- **Plan commit:** `50cc64b`

---

*Log committed to `feat/scaffold-2-stratum-d` per CLAUDE.md §5.9 closing ritual. PR remains draft pending Hrishikesh + web-Claude review.*
