# SCAFFOLD.17 — Plan

> **Authority:** Plan-mode draft against the SCAFFOLD.17 plan-mode brief v2 + technical research brief. Plan-mode CC chat 2026-05-25; branch `plan/scaffold-17` cut from `main` at HEAD `42baa8b` (post-ENGINE.6 merge).
>
> **Stratum sequencing:** ENGINE.6 (merged 2026-05-25 at 42baa8b) → **SCAFFOLD.17** → SCAFFOLD.16.
>
> **Out-of-scope at chat level:** external-dev image pipeline (Flux + ComfyUI + Pillow + R2 upload) per B1; F-AUTH-4 stale-sweep handler per B2; SCAFFOLD.5 Sentry SDK init + `cron_alarms` drain-and-emit per B4.

---

## §0 — Plan provenance

- **Input briefs:** `SCAFFOLD.17-plan-mode-brief.md` (v2; 406 lines) + `SCAFFOLD.17-technical-research-brief.md` (224 lines). Both 2026-05-25, sibling artifacts.
- **Predecessor close-out:** `docs/logs/ENGINE.6.md` (487 lines; PR #49, merged 2026-05-25). ENGINE.6 process improvements #5 (same-commit amendment scope) + #6 (verify-don't-trust on lint dismissals) carried forward at §9.
- **Operator ratifications at brief drafting:**
  - LD-1 corrected to match shipped code (`pseudonym` IS a column with UNIQUE constraint).
  - Old LD-9 dropped (F-AUTH-4 trigger amendment unnecessary; stale-sweep is recovery-handler scope per `consume.ts:16–22`).
  - New LD-9 added for two SPEC.2 B.15 drifts as same-commit amendments.
  - Signal-table + state-row + transition-detection pattern locked for pg_cron alarm (research brief R1 + R3).
  - 1,000-row chunks with composite ON CONFLICT target locked for seed-script (research brief R2).
  - Sequential HEAD with seeded sampling locked for verification spot-check (research brief R4).
  - Scope strictly narrowed: SCAFFOLD.17 ships **net-new artifacts only**; the 4 SCAFFOLD.2/3-shipped substrate files are NOT touched.
- **Plan-mode kickoff prompt:** operator-supplied 2026-05-25 with explicit scope correction (4 already-shipped files NOT touched + 5 net-new artifacts + same-commit SPEC.2 B.15 amendments).
- **Web Claude review (2026-05-25):** plan ratified with three flags absorbed in commit-3 amendment:
  - **Flag 1 (FAIL within scope)** — §D Tests 3-5 had implicit inter-test state dependencies that violate vitest's `beforeEach`-per-test semantics. Rewritten with explicit per-test setup. Scope broader than web Claude flagged (Test 4 was the surfaced symptom; Tests 3 + 5 had the same root cause).
  - **Flag 2 (FAIL within scope)** — §E Test 9 static-import grep against `consume.ts` was a brittle proxy for the actual property under test. Replaced with `expectTypeOf` return-type narrowing + `vi.spyOn(fetch)` zero-invocation assertion.
  - **Flag 3 (SURPRISE, load-bearing)** — §F same-commit amendment scope extended from 2 SPEC.2 B.15 edits to 5 coordinated SPEC.2 edits (B.15 line 2663 + 2664 + §5.1 Bucket C row 22 + row 23 + §5 opening prose + §5.2 summary count). Per ENGINE.6 process improvement #5 (same-commit amendment scope): new tables `watermark_state` + `cron_alarms` belong in §5.1 inventory; failing to add them at SCAFFOLD.17 merge time would leave SPEC.2 §5.1 drifted against shipped schema.

---

## §1 — Locked decisions absorbed verbatim

Plan-mode CC does **not** re-litigate. LDs 1–9 from brief §0 reproduced as decision names; substance is at brief §0.

- **LD-1** — `identity_pool` schema shipped at `src/db/schema/identity.ts` (8 columns: `id, colour, animal, number, pseudonym UNIQUE, pfpFilename, assignedAt, createdAt`; 2 indexes: `identity_pool_tuple_idx` UNIQUE + `identity_pool_fifo_idx` partial). SCAFFOLD.17 does NOT touch.
- **LD-2** — Bucket B trigger `enforce_identity_pool_assigned_at()` shipped at `drizzle/migrations/0003_append_only_triggers.sql:108–129` with `bucket_b_update_check` + `bucket_b_no_delete` triggers at lines 193–194. SCAFFOLD.17 does NOT touch.
- **LD-3** — F-AUTH-3 consumer `consumeIdentityPoolTuple()` at `src/server/identity-pool/consume.ts:23–54` + Better Auth `databaseHooks.user.create.before` at `src/server/auth/index.ts:247–271` + `databaseHooks.session.create.before` at lines 272–281. SCAFFOLD.17 does NOT touch.
- **LD-4** — 50,000-row namespace (50 colours × 100 animals × 10 numbers per pair) per ADR-0011 + SPEC.1 §13.
- **LD-5** — R2 layout `zugzwang-pfp/v1/<slug>` per ADR-0011 + ADR-0006 §4. Existing helpers consumed: `headObject(bucket, key)` at `src/server/storage/r2.ts:149–169`; bucket name resolved from `R2_*_PFP` env keys.
- **LD-6** — pg_cron low-watermark per ADR-0006 §7 + ADR-0007 §4 alarm 5. New migration at `drizzle/migrations/0007_pg_cron_jobs.sql`. Firing condition `unassigned * 20 < total` (integer arithmetic; research brief R3). State-row + transition-detection pattern fires exactly once per below-threshold episode. Signal-table emit via `cron_alarms` queue table; drain-and-emit is SCAFFOLD.5 scope per B4.
- **LD-7** — Three new acceptance tests + 6 existing tests + 1 it.todo preserved at `tests/server/auth/pseudonym.test.ts`. Test naming follows shipped `pseudonym::*` family convention; SPEC.1 §17's `auth::pseudonym-*` drift is queued for next SPEC.1 sweep (CF-2).
- **LD-8** — H2-scrub permanently retires tuples (Bucket B trigger rejects `assigned_at` non-NULL → NULL).
- **LD-9** — Same-commit SPEC.2 Appendix B.15 amendments (two line-level corrections; §F).

---

## §2 — Open questions resolved at /plan opening

- **Q1 — Manifest format.** **CSV, 5 columns** (operator-confirmed 2026-05-25): `colour, animal, number, pseudonym, pfp_filename`. R2 key composed at verify-time as `v1/${pfp_filename}` per ADR-0011 layout. No `r2_key` column in manifest. Locked at §A.
- **Q2 — Vitest integration test layer.** Resolved by sizing:
  - 3 new pseudonym acceptance tests → substrate-mock pattern (extend `tests/server/auth/pseudonym.test.ts`).
  - 2 new test files (seed-script + pg_cron watermark function) → real-Postgres pattern at new directory `tests/db/identity-pool/` (sibling of `tests/db/triggers/`).
- **Q3 — Verification script error-handling shape.** Locked defaults: exit `0` on all-pass / `1` on any-fail; text output with PASS/FAIL per check; hard-coded N=20 for HEAD spot-check.

---

## §3 — Phase-0 SURPRISES (discovered during /plan opening greps)

Four discoveries; none blocks the plan; all documented for execute-chat awareness.

- **SURPRISE-1 — TODO(SCAFFOLD.5) anchor count.** Brief LD-6 + research brief recommendation 5 cite "5 existing TODO(SCAFFOLD.5) anchors in rate-limit.ts, idempotency/cache.ts, auth/index.ts, sweep-orphans.ts, moderation/openai.ts". Actual count at HEAD is **4** (no anchor in `src/server/auth/index.ts`). The 4 anchors are at `rate-limit.ts:174`, `idempotency/cache.ts:74`, `sweep-orphans.ts:182`, `moderation/openai.ts:109`. **Resolution:** SCAFFOLD.17 ships ONLY the pg_cron SQL `INSERT INTO cron_alarms` side. There is no new TS-side `console.error("identity_pool_low_watermark", …)` anchor in SCAFFOLD.17 — the pg_cron job is pure SQL with no TS runtime path. The TS-side drain+emit lands in SCAFFOLD.5 alongside Sentry SDK init. Anchor count stays at **4** after SCAFFOLD.17 merges.

- **SURPRISE-2 — ADR + PSEUDONYM file backfill.** Brief references ADR-0003 through ADR-0016 + `docs/specs/PSEUDONYM.md` extensively. At HEAD, only `docs/adr/0001-license-choice.md` exists as an ADR file; `docs/specs/PSEUDONYM.md` does not exist. Per the user's auto-memory (`project_adr_catalogue_framing.md`): *"ADRs 0003–0016 are accepted decisions, file backfill is queued maintenance — substance lives in SPEC.2 §0.1 change-log entries."* **Resolution:** Reference ADR-0006/0007/0011 + PSEUDONYM.md as **decision names** in the plan and in code comments (per shipped convention; `consume.ts:1–22` already cites ADR-0011 + PSEUDONYM.md as decision names with no expectation of file presence). SCAFFOLD.17 does NOT propose creating ADR files or PSEUDONYM.md — file backfill remains queued maintenance.

- **SURPRISE-3 — SCAFFOLD.15 close-out §11.1 sequencing reference.** Brief §9 + operator kickoff cite *"SCAFFOLD.15 close-out §11.1 ratifies the stratum sequencing ENGINE.6 → SCAFFOLD.17 → SCAFFOLD.16"*. `docs/logs/SCAFFOLD.15.md` (160 lines) contains **no `§11.1` section** and **no `SCAFFOLD.17` mention**; only SCAFFOLD.16 references appear (line 130: *"SCAFFOLD.16 (PhotoDNA + Safer parallel moderation)"*). **Resolution:** Stratum-sequencing precedence is the brief's own assertion — operator-ratified at the brief-drafting chat, not logged into SCAFFOLD.15 close-out. Treat as a brief-level operator decision; document in plan §0 provenance (above) without claiming SCAFFOLD.15 §11.1 attribution.

- **SURPRISE-4 — F-AUTH-3.md is a skeleton.** `docs/specs/flows/F-AUTH-3.md` exists at HEAD but its sections (Pre, System, Response, Errors, Invariants, Acceptance) are `<placeholder>`. F-AUTH-3 substance lives in SPEC.1 §13 + code comments (`consume.ts:1–22`) + ADR-0011 (as a decision name). **Resolution:** Reference F-AUTH-3 by decision name (SPEC.1 §13 lookup) in plan + code comments. SCAFFOLD.17 does NOT populate F-AUTH-3.md — flow-skeleton population follows SPEC.2 §13.4 gating cadence per the skeleton's own status comment.

- **SURPRISE-5 — SPEC.2 §5.1 has no "Operational" Bucket category.** (Surfaced during Flag 3 absorption from web Claude review.) Web Claude's flag framing recommended new rows labelled "Mutable / Operational"; SPEC.2 §5.1 at HEAD has only Buckets A (strictly append-only), B (whitelisted transition), and C (mutable). `watermark_state` + `cron_alarms` definitionally fit Bucket C (mutable + no append-only trigger), so the lowest-risk amendment shape per web Claude's "use existing convention" pre-authorization is to place both tables in Bucket C with a Notes-column tag like "operational / pg_cron-machinery" marking the sub-distinction from domain-entity rows. **Resolution:** §F Edit 3 adds the two rows to Bucket C; §F Edit 4 updates the §5 opening prose count (21 → 23); §F Edit 5 updates the §5.2 summary count (Bucket C 8 → 10). Surface to operator at amendment time for ratification — if the operator wants a new Bucket category instead, the amendment scope expands to a §5.2 contract clarification + §6 confirmation.

---

## §A — Seed-script (`scripts/seed-identity-pool.ts`) — NEW

Net-new file producing the 50,000-row identity_pool ingestion. Existing convention reference: `scripts/seed-identity-pool-dev.ts:1–100` (200-row dev seed; in-code rows; single-row INSERT loop).

### Inputs

- Positional `<manifest-path>` (required) — path to CSV manifest produced by external-dev pipeline (B1).
- `DATABASE_URL` env (project convention; consumed by `@/db`).

### CSV shape (Q1-locked)

5 columns, header row required, comma-delimited, no embedded commas/quotes (operator-owned constraint on pipeline output):

```
colour,animal,number,pseudonym,pfp_filename
Red,Fox,1,RedFox001,red-fox-001.webp
Blue,Otter,42,BlueOtter042,blue-otter-042.webp
...
```

Expected total: 50,000 rows per LD-4. `pseudonym` and `pfp_filename` are derived (PascalCase + kebab-NNN respectively); they ship in the manifest as cross-checks against the pipeline's materialisation rather than being re-derived in the seed-script.

### Implementation outline

1. **CSV parser — inline, no new dep.** The 5-column constraint (no quoting) makes an inline ~15-line splitter sufficient: read file, split on `/\r?\n/`, drop header, `split(',')` per line, length-5 guard, trim. **No new dependency proposed** — adding `csv-parse` for one consumer fails AGENTS.md §10 "ask first" + simplicity-first per CLAUDE.md §5.2. If the pipeline ever produces quoted/escaped CSV, lift `csv-parse` 6.x in a separate stratum.
2. **Row coercion.** Map each parsed row → `typeof identityPool.$inferInsert` with explicit narrowing: `number` via `Number.parseInt(s, 10)` + range check `0 ≤ n ≤ 999` per ADR-0011 + LD-4. REFUSE on malformed rows (exit 1; no silent skip).
3. **Refactored core for testability.** Export:
   ```ts
   export async function runSeed(
     manifestPath: string,
     db: DbClient,
   ): Promise<{ inserted: number; skipped: number; manifestRowCount: number }>
   ```
   CLI thin-wrapper invokes `runSeed(argv[2], db)` and `process.exit(...)` based on returned counts. The `db` parameter is injected so integration tests can pass `testDb` from `tests/db/_fixtures/db.ts` (which avoids the `server-only` runtime check).
4. **Chunked bulk-INSERT** at `CHUNK_SIZE = 1_000` per research brief R2 (5 explicit columns × 1,000 = 5,000 binds; ≪ 32,767 conservative ceiling). Inline generator (no project-wide helper until a second call site exists):
   ```ts
   function* chunked<T>(rows: T[], size: number): Generator<T[]> {
     for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
   }
   ```
5. **Per-chunk transaction.** `await db.transaction(async (tx) => { await tx.insert(identityPool).values(chunk).onConflictDoNothing({ target: [identityPool.colour, identityPool.animal, identityPool.number] }); })` — per-chunk isolation lets partial reruns degrade gracefully + avoids long-running tx WAL bloat (research brief R2). Drizzle 0.45.0 syntax verified stable through `drizzle-orm@1.0.0-beta.22`.
6. **Inserted/skipped counting.** Per chunk: `.returning({ id: identityPool.id })`. `returned.length` is the inserted count; `chunk.length - returned.length` is the skipped (ON CONFLICT) count.
7. **Progress logging.** `console.log` per chunk: `[seed-identity-pool] chunk N/50: inserted K, skipped (ON CONFLICT) P, cumulative I/50000`. Final summary at end.
8. **Exit codes:**
   - `0` — success: `manifestRowCount === 50000` AND post-run `SELECT count(*) FROM identity_pool >= 50000`.
   - `1` — manifest parse error (file missing, malformed line, type coercion failure).
   - `2` — DB INSERT error (Drizzle / Postgres exception inside `runSeed`).
   - `3` — row-count mismatch (post-run table count ≠ expected; e.g., manifest had 49,998 rows OR another seed source pre-populated unrelated rows).

### `package.json` entry

```json
"seed:identity-pool:prod": "tsx scripts/seed-identity-pool.ts"
```

---

## §B — pg_cron migration (`drizzle/migrations/0007_pg_cron_jobs.sql`) — NEW

Net-new hand-written SQL migration. Next free index after `0006_image_uploads_extension.sql` (verified at /plan opening). Follows existing convention (pragma header per scaffold; `--> statement-breakpoint` separators per Drizzle-Kit 0.30.x; see `0006_image_uploads_extension.sql:1–13` for header shape).

### File contents

```sql
-- 0007_pg_cron_jobs.sql — SCAFFOLD.17
-- Schedules the identity-pool low-watermark check (alarm 5 per
-- ADR-0007 §4 — decision name) via pg_cron. State-row +
-- transition-detection pattern (research brief R3) fires the alarm
-- exactly once per below-threshold episode regardless of cron tick
-- frequency.
--
-- Per ADR-0006 §6 + research brief R1: pg_cron cannot emit HTTP
-- directly (pg_net rejected). The job INSERTs into `cron_alarms`
-- queue table; SCAFFOLD.5 ships the Vercel Cron drain handler that
-- reads `processed_at IS NULL` rows and emits Sentry events.
--
-- Threshold: 5% unassigned = `unassigned * 20 < total` (integer
-- arithmetic; avoids floating-point per research brief R3).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS watermark_state (
  metric text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('above','below')),
  since timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS cron_alarms (
  id bigserial PRIMARY KEY,
  alarm_id text NOT NULL,
  payload jsonb NOT NULL,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_identity_pool_watermark()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  WITH counts AS (
    SELECT
      count(*) FILTER (WHERE assigned_at IS NULL) AS unassigned,
      count(*) AS total
    FROM identity_pool
  ),
  new_state AS (
    SELECT
      CASE WHEN unassigned * 20 < total THEN 'below' ELSE 'above' END AS s,
      unassigned,
      total
    FROM counts
  ),
  transition AS (
    UPDATE watermark_state w
    SET state = ns.s, since = now()
    FROM new_state ns
    WHERE w.metric = 'identity_pool_unassigned'
      AND w.state IS DISTINCT FROM ns.s
    RETURNING w.metric, w.state
  )
  INSERT INTO cron_alarms (alarm_id, payload)
  SELECT
    'identity_pool_low_watermark',
    jsonb_build_object(
      'state', t.state,
      'unassigned', ns.unassigned,
      'total', ns.total
    )
  FROM transition t, new_state ns
  WHERE t.state = 'below';
END;
$$;
--> statement-breakpoint

INSERT INTO watermark_state (metric, state)
VALUES ('identity_pool_unassigned', 'above')
ON CONFLICT (metric) DO NOTHING;
--> statement-breakpoint

SELECT cron.schedule(
  'identity-pool-watermark',
  '*/5 * * * *',
  $$SELECT check_identity_pool_watermark()$$
);
```

### Notes

- **CREATE EXTENSION:** `WITH SCHEMA extensions` matches Supabase's `cron.schema_name = 'extensions'` default. Verified at /plan opening: `pg_cron` is in `shared_preload_libraries` of local supabase/postgres image; `CREATE EXTENSION` succeeded locally.
- **`watermark_state`** is a single-row-per-metric table; `state` CHECK enum makes corruption impossible; `since` lets the runbook compute episode duration.
- **`cron_alarms`** schema matches the SCAFFOLD.5 drain contract (CF-5): `(id bigserial, alarm_id text, payload jsonb, emitted_at timestamptz, processed_at timestamptz NULL)`.
- **CTE body** is the research-brief-R3 form, with the payload extended to carry `unassigned` + `total` so SCAFFOLD.5's drain handler can populate the Sentry event without re-querying.
- **Seed insert** `ON CONFLICT (metric) DO NOTHING` is idempotent across `drizzle-kit migrate` retries.
- **`cron.schedule(...)`** name `'identity-pool-watermark'` is the lookup key for the schedule-registration test (§D test 6). `*/5 * * * *` cadence is placeholder; HARDEN.* tunes (CF-6).
- **Trigger interaction:** the CTE's UPDATE on `watermark_state` is governed by no Bucket A/B trigger. Both `watermark_state` and `cron_alarms` are classified **Bucket C** (mutable, no append-only trigger) in SPEC.2 §5.1 per the same-commit inventory amendment (§F Edit 3); they ride on constraint-driven validation only (CHECK enum on `watermark_state.state`; PK + NOT NULL on `cron_alarms`). The "operational / pg_cron-machinery" sub-distinction is documented in their §5.1 Notes columns; no new bucket category needed (SURPRISE-5).

---

## §C — Verification script (`scripts/verify-identity-pool.ts`) — NEW

Net-new file. Four post-seed checks per PSEUDONYM.md §10.3 (decision name; substance per ADR-0011 + SPEC.1 §13 F-AUTH-3 step 4).

### Checks

1. **Row count.** `SELECT count(*) FROM identity_pool` must equal 50,000.
2. **Uniqueness.** `SELECT count(*) FROM (SELECT DISTINCT colour, animal, number FROM identity_pool) sub` must equal 50,000.
3. **R2 object count (out-of-band).** The PFP bucket's IAM token does NOT have LIST permission per ADR-0011 + SCAFFOLD.15 plan §5.1. Script LOGS the expected count (50,000) for operator side-by-side comparison with R2 dashboard / `aws s3 ls` totals; does NOT auto-verify.
4. **R2 HEAD spot-check (20 random samples).** Per research brief R4:
   - **Seeded deterministic sample.** Derive 20 indices from `crypto.createHash('sha256').update('verify-identity-pool/v1').digest()` mapped to `[0, 50000)` (Node built-in; avoids `seedrandom` 3rd-party dep). Indices stable across runs.
   - Read 20 rows: `SELECT pfp_filename FROM identity_pool ORDER BY id LIMIT 1 OFFSET <idx>` per index (20 short queries; acceptable at this N).
   - Sequential `await headObject("pfp", \`v1/${pfp_filename}\`)` per row. ~50–100 ms per HEAD × 20 = ~1–2 s total.
   - Assert: no throw (HTTP 200) AND `contentType === "image/webp"`.

### Output shape

Plain text, PASS/FAIL per check, exit 0 on all-pass / 1 on any-fail (per Q3):

```
[verify-identity-pool] PASS: row count = 50000
[verify-identity-pool] PASS: uniqueness — 50000 distinct (colour, animal, number) tuples
[verify-identity-pool] INFO: expected R2 object count = 50000 (verify out-of-band via R2 dashboard)
[verify-identity-pool] PASS: 20/20 R2 HEAD spot-checks (image/webp)
[verify-identity-pool] all checks passed
```

### `package.json` entry

```json
"verify:identity-pool": "tsx scripts/verify-identity-pool.ts"
```

### Helper consumption

- `headObject(bucket, key)` from `src/server/storage/r2.ts:149–169` — existing helper, throws `StorageObjectMissingError` on 404 / `StorageUnavailableError` on 5xx. Verify-script catches per-key and reports.
- `db` from `@/db` — runtime client; script context, no `server-only` build-time guard applies in tsx.

---

## §D — Real-Postgres integration tests (`tests/db/identity-pool/`) — NEW DIRECTORY

New sibling directory of `tests/db/triggers/`. Follows the existing pattern at `tests/db/triggers/identity-pool-append-only.spec.ts:1–120` (dual `testClient` + `testDb` from `tests/db/_fixtures/db.ts`; `afterEach` TRUNCATE; `testClient.unsafe(...)` for raw-SQL assertions). Vitest config (`pool: "forks", fileParallelism: false, isolate: true`) is correct for real-DB tests; do NOT change.

### `tests/db/identity-pool/seed.test.ts`

Exercises `runSeed(manifestPath, testDb)` against the local Supabase Postgres.

- **Fixture:** `tests/db/identity-pool/_fixtures/manifest-100.csv` — 100 rows (10 colours × 10 animals × 1 number per pair; deterministic). Created as part of this stratum.
- **`afterEach`:** `await testClient.unsafe('TRUNCATE identity_pool CASCADE')` (existing TRUNCATE-after-each pattern; CASCADE bypasses the row-level Bucket B DELETE trigger).
- **Test 1 — happy path.** Call `runSeed('<path>/manifest-100.csv', testDb)`. Assert: `inserted === 100`, `skipped === 0`, `manifestRowCount === 100`. SELECT all rows; assert all `(colour, animal, number)` tuples unique; all `pseudonym` values match `${Colour}${Animal}${NNN}` PascalCase shape from manifest.
- **Test 2 — idempotency.** Call `runSeed(...)` once, then again. Assert second call: `inserted === 0`, `skipped === 100`, total row count remains 100.
- **Test 3 — partial pre-seed.** Insert 50 fixture rows via `testDb.insert(identityPool).values(...)`, then `runSeed(...)`. Assert: `inserted === 50`, `skipped === 50`, total row count is 100.
- **Test 4 — malformed manifest row.** Fixture `manifest-malformed.csv` with one row having `number = "abc"`. Call `runSeed(...)`. Assert: throws / rejects with a typed parse error; table count is 0 (no partial commit beyond the failed row's chunk's tx boundary).

### `tests/db/identity-pool/watermark.test.ts`

Tests `check_identity_pool_watermark()` SQL function directly per research brief R5 (NOT the scheduled tick — pg_cron background-worker timing inside `supabase start` is unreliable per supabase/cli #137).

- **`beforeEach`:** `TRUNCATE identity_pool, watermark_state, cron_alarms CASCADE` (TRUNCATE bypasses per-row triggers; `cron_alarms` + `watermark_state` are operational tables with no append-only triggers). Re-seed `watermark_state` row to `('identity_pool_unassigned', 'above', now())`.
- **Test 1 — above threshold, no alarm.** Insert 100 fixture rows; mark 94 as assigned (`UPDATE identity_pool SET assigned_at = now() WHERE id IN (SELECT id FROM identity_pool LIMIT 94)`). Run `SELECT check_identity_pool_watermark()`. Assert: `watermark_state.state === 'above'`, `cron_alarms` empty.
- **Test 2 — transition above → below fires once.** Insert 100 fixture rows; mark 96 assigned (4 unassigned = 4%, below 5%). Run the function. Assert: `watermark_state.state === 'below'`, exactly 1 row in `cron_alarms` with `alarm_id === 'identity_pool_low_watermark'`, payload contains `{state: 'below', unassigned: 4, total: 100}`.
- **Test 3 — repeated tick stays below, no second alarm.** Setup is in-test (independent of test order per vitest `beforeEach`-per-test semantics). Insert 100 rows; mark 96 assigned (4 unassigned, 4% < 5%). Run `check_identity_pool_watermark()` once → drives state `'above'` → `'below'` and inserts 1 alarm row. Run the function **again** with the pool unchanged. Assert: `watermark_state.state === 'below'`, `cron_alarms` still has exactly 1 row (transition CTE returns no rows on the second run; idempotent).
- **Test 4 — transition below → above clears state, no alarm.** Setup is in-test. (1) Insert 100 rows; mark 96 assigned (4 unassigned, below); run function → state transitions to `'below'`, `cron_alarms` has 1 row. (2) TRUNCATE `identity_pool` + re-insert 100 rows with 94 assigned (6 unassigned = 6%, above 5%; arithmetic: `6 * 20 = 120; 120 < 100` is FALSE → state becomes `'above'`). (3) Run the function. Assert: `watermark_state.state === 'above'`, `cron_alarms` still has 1 row (no alarm fires on below → above transition; only below transitions emit). The end-to-end above → below → above exercise verifies the full state-machine, not the static "no-emit-on-clear" property in isolation.
- **Test 5 — second episode fires new alarm.** Setup is in-test (full above → below → above → below sequence). (1) Insert 100 rows with 4 unassigned; run function → state `'below'`, 1 alarm. (2) TRUNCATE + re-insert with 6 unassigned (above); run function → state `'above'`, still 1 alarm. (3) TRUNCATE + re-insert with 4 unassigned (below again); run function. Assert: state `'below'`, `cron_alarms` has **2** rows (1 from the first below episode + 1 from this second below episode; transition detection is per-episode, not per-tick).
- **Test 6 — schedule registration.** `SELECT jobname FROM cron.job WHERE jobname = 'identity-pool-watermark'` returns exactly 1 row.

**Independence note (Flag 1 absorption, web Claude review).** Tests 3, 4, 5 each set up their full state precondition inside the test body via the (insert → function → mutate → function) pattern. They do NOT depend on inter-test state ordering. `beforeEach` truncates `identity_pool, watermark_state, cron_alarms CASCADE` and re-seeds `watermark_state` to `('identity_pool_unassigned', 'above')` before each test runs. The original Test 4 setup ("TRUNCATE + re-insert with 94 assigned" alone) was implicitly relying on Test 3 leaving state = `'below'` — a fragile shape vitest does not guarantee. The broader Flag 1 absorption applies the same fix to Tests 3 + 5 even though web Claude flagged only Test 4 (root cause symmetry).

**Raw-SQL access pattern note (no Drizzle schema for `watermark_state` + `cron_alarms` in SCAFFOLD.17).** Per §F Edit 3, the two new operational tables are minted in `0007_pg_cron_jobs.sql` only — there is no Drizzle declaration at `src/db/schema/system.ts` (or elsewhere) in SCAFFOLD.17. All test access to these tables therefore uses raw SQL via the dual-client pattern shipped at `tests/db/_fixtures/db.ts`:
- **Reads** through `testDb.execute(sql\`SELECT ... FROM watermark_state\`)` / `sql\`SELECT ... FROM cron_alarms\``. Drizzle wraps the raw tagged-template SQL but does not type-check the result rows — tests cast or narrow as needed.
- **Mutations** (the Test 4/5 setup mid-step that drives state transitions, plus the `beforeEach` re-seed of `watermark_state`) through `testClient.unsafe('UPDATE watermark_state SET state = $1 WHERE metric = $2', [state, metric])` or equivalent.
- **`identity_pool`** continues to use the typed Drizzle query builder (`testDb.insert(identityPool).values(...)`, `testDb.select().from(identityPool)`) because its Drizzle declaration ships at HEAD (`src/db/schema/identity.ts`).

SCAFFOLD.5 may add Drizzle declarations for `watermark_state` + `cron_alarms` at `src/db/schema/system.ts` when it ships the drain handler (CF-5); at that point these tests' raw-SQL paths CAN migrate to typed query-builder calls. SCAFFOLD.17 does NOT anticipate that work — raw SQL is the canonical access shape for the stratum.

**Bucket B interaction.** The trigger forbids `assigned_at` non-NULL → NULL (LD-2). Tests 4 + 5 work around this by TRUNCATE-then-re-INSERT (allowed; the trigger guards UPDATE/DELETE on rows, not INSERT into an empty table after TRUNCATE).

### Pattern reference

`tests/db/triggers/identity-pool-append-only.spec.ts:1–120` is the canonical adjacent pattern (afterEach TRUNCATE, dual-client, `expect(...).rejects.toMatchObject({ code: 'P0001', ... })`). Adapt for function-invocation assertions: `expect((await testDb.execute(sql\`SELECT count(*)::int AS c FROM cron_alarms\`))[0].c).toBe(1)`.

---

## §E — Three new substrate-mock acceptance tests (extend `tests/server/auth/pseudonym.test.ts`)

Extend existing file (currently 356 lines; 6 active tests + 1 it.todo at line 352). Follow the substrate-mock pattern (`vi.hoisted` + `vi.mock("@/db/index")`; see lines 21–55). Test naming: `pseudonym::*` family per LD-7.

### Test 7 — `pseudonym::pool-extension-deterministic-no-collision`

Verifies the PRNG seed-derivation contract per ADR-0011 (decision name; substance lives in PSEUDONYM.md §3 per decision-name reference): the per-pair number-set selection is stable + reproducible + extensible.

- **Contract under test:** for a given `(colour, animal, version_tag, model_checkpoint_hash)`, the deterministic PRNG yields a fixed set of N numbers. When `count_per_pair` widens (e.g., v1 = 10 → v2 = 20), the v2 set is a **superset** of v1's set — specifically the first 10 v2 numbers are the same 10 v1 produced; the next 10 are disjoint.
- **Pure-function test; no DB.** Mock the PRNG seed-derivation surface (operator-side implementation per LD-1; SCAFFOLD.17 is the negative-space guard). Assert: invoking the derivation twice with v1 inputs yields identical sets; v2 inputs include all v1 numbers + 10 new ones that are not present in any v1 (colour, animal) set across the pool.
- **Negative-space assertion:** the test does NOT assert a specific number-set; it asserts the disjointness + reproducibility properties that any compliant PRNG must satisfy.

### Test 8 — `pseudonym::scrubbed-tuple-not-returned-to-pool`

Verifies LD-8 + the Bucket B trigger at storage layer (LD-2) at the **application contract level**: no application code path attempts to UNassign a previously-assigned tuple.

- **Contract under test:** the H2-scrub handler (downstream stratum per B2) and the consumer (`consumeIdentityPoolTuple`) together must NEVER issue `UPDATE identity_pool SET assigned_at = NULL WHERE id = ?` against a previously-assigned row. The Bucket B trigger at `0003_append_only_triggers.sql:108–129` rejects this operation; this test verifies the application layer does not even attempt it.
- **Substrate-mock the consumer + an artificial H2-scrub stub.** Spy on the Drizzle `tx.execute` call surface. Assert: across the consumer code paths (FIFO consume; existing test 4's "assigned in same tx" path), NO `assigned_at = NULL` UPDATE is ever issued.
- **Companion to existing trigger tests:** the storage-layer rejection is verified by `tests/db/triggers/identity-pool-append-only.spec.ts:46–62` ("rejects re-firing assigned_at once set"). This new test adds the application-side guard.

### Test 9 — `pseudonym::pfp-served-from-r2-not-runtime-generated`

Verifies SPEC.1 §13 F-AUTH-3 step 4 (decision name): signup flow surfaces only the pfp slug, never bytes. PFPs are CDN-served from R2 at request-time per ADR-0011 (`zugzwang-pfp/v1/<slug>`).

- **Contract under test:** `consumeIdentityPoolTuple()` returns `{ pseudonym: string; pfpFilename: string } | null` (text slug, not bytes). The signup hook injects only these scalars into the user row; no image-generation surface is invoked at signup time; no HTTP fetch is issued from the signup hot path.
- **Type-narrowing assertion (positive shape).** Use `expectTypeOf<Awaited<ReturnType<typeof consumeIdentityPoolTuple>>>().toEqualTypeOf<{ pseudonym: string; pfpFilename: string } | null>()`. This catches any future drift where the return shape gains a `Buffer | Uint8Array | Blob | URL` field at compile time, not runtime. (Vitest exports `expectTypeOf` since v0.27; verify availability at execute-chat. Equivalent `tsd` / `expect-type` shapes are acceptable substitutes.)
- **Runtime mock-invocation assertion (negative-space).** Wrap `globalThis.fetch` with `vi.spyOn(globalThis, "fetch")` before the test body; invoke the substrate-mocked consumer; assert `fetch` was NOT called. This catches any runtime HTTP fetch from the signup hot path regardless of whether the call site is in `consume.ts` itself or in a transitive dep.
- **Why this shape (Flag 2 absorption, web Claude review).** The original "static-import grep against `consume.ts`" was a brittle proxy: it would silently pass on a transitive dep refactor that routed image-byte handling through a different module name, and it would fail for the wrong reason if a future cleanup added a legitimate `@aws-sdk/client-s3` import (e.g., for a non-image S3 call in the same module). Type-narrowing + fetch-spy are robust to both classes of drift.

### Naming convention drift (CF-2)

Shipped tests use `pseudonym::*` family. SPEC.1 §17's reference to `auth::pseudonym-*` is a drift logged for next SPEC.1 sweep (NOT touched in SCAFFOLD.17 PR).

---

## §F — Same-commit SPEC.2 amendments

Per LD-9 + Flag 3 absorption (web Claude review) + ENGINE.6 process improvement #5 (same-commit amendment scope). **Five coordinated line-level edits** to `docs/specs/SPEC.2.md`; all land in the SCAFFOLD.17 PR commit alongside the new code. Two edits absorb the B.15 drifts that LD-9 originally flagged (Edits 1 + 2); three edits absorb the §5 inventory drift introduced by SCAFFOLD.17 itself (the two new operational tables; Edits 3 + 4 + 5).

### Edit 1 — `number` row Notes in B.15 (line 2663)

```diff
-| `number` | smallint | SHIP | 1-9 per ADR-0011 |
+| `number` | smallint | SHIP | 0-999 per ADR-0011 |
```

**Rationale:** shipped `src/db/schema/identity.ts:27` declares `smallint("number").notNull()`, range governed at application layer (ADR-0011 specifies 0–999); 10 numbers per (colour, animal) pair × 50 colours × 100 animals = 50K rows per LD-4. `1-9` is authoring-time drift acknowledged in code at `identity.ts:19`: *"number range 0–999 per SPEC.1 §13 + ADR-0011; SPEC.2 B.15's '1-9' is drift (PRECURSOR.5 backlog)"*. PRECURSOR.5 closed without absorbing; SCAFFOLD.17 absorbs now per process improvement #5.

### Edit 2 — `pseudonym` row Notes in B.15 (line 2664)

```diff
-| `pseudonym` | text | SHIP | Composed slug `<colour>-<animal>-<number>` |
+| `pseudonym` | text | SHIP | Materialised PascalCase concatenation `<Colour><Animal><NNN>` (e.g. `RedFox001`) per shipped `src/server/identity-pool/consume.ts:51`. NOT hyphen-kebab — that shape applies to `pfp_filename` only. |
```

**Rationale:** shipped `consume.ts:51` materialises `${row.colour}${row.animal}${String(row.number).padStart(3, "0")}` → `RedFox001`. The hyphen-kebab shape applies only to `pfp_filename` (`red-fox-001.webp`).

### Edit 3 — §5.1 Bucket C inventory rows for the two new operational tables

Add two rows to the Bucket C table at SPEC.2 §5.1 (currently 8 rows ending at row 21 `positions`). The added rows extend the inventory to 23 total tables:

```diff
 | 21 | `positions` | `bets` | ADR-0005 + ADR-0009 | Per-user-per-market position cache; updated synchronously inside bet transaction per §3.7; ranking-function input via `comments.stake_at_post_time` derivation |
+| 22 | `watermark_state` | `system` | ADR-0006 + ADR-0007 | Single-row-per-metric state-machine table backing pg_cron alarm transition detection (alarm 5 per ADR-0007 §4). Ships in `drizzle/migrations/0007_pg_cron_jobs.sql`. Schema: `(metric text PK, state text CHECK IN ('above','below'), since timestamptz)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (CHECK enum). |
+| 23 | `cron_alarms` | `system` | ADR-0006 + ADR-0007 | Queue table for pg_cron-emitted alarms. SCAFFOLD.17 ships the INSERT side; SCAFFOLD.5 ships the drain-and-emit side. Schema: `(id bigserial PK, alarm_id text NOT NULL, payload jsonb NOT NULL, emitted_at timestamptz, processed_at timestamptz NULL)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (PK + NOT NULL). |
```

**Rationale:** §B introduces these two tables via raw SQL in `0007_pg_cron_jobs.sql`. SPEC.2 §5.1 catalogues every table in the v1 schema; failing to add §5.1 rows leaves the inventory drifted against shipped schema post-merge. Web Claude flagged this as the load-bearing extension of LD-9's same-commit amendment scope. Bucket C placement per SURPRISE-5: SPEC.2 has no "Operational" category; Bucket C definitionally covers "mutable + no append-only trigger" which fits both new tables. The Notes column carries the "operational / pg_cron-machinery" sub-distinction. **Owner ADRs:** `ADR-0006 + ADR-0007` (decision names) — pg_cron cadence + alarms framework jointly mint these tables' substance. **Domain:** `system` (alongside existing `system_state` per §5.1 row 13 + §5.3 nine-domains list). **No Drizzle schema file in SCAFFOLD.17** — these tables are raw-SQL-only; SCAFFOLD.5 may add Drizzle declarations at `src/db/schema/system.ts` when it ships the drain handler (carry-forward CF-5).

### Edit 4 — §5 opening prose (line 455)

```diff
-Twenty-one tables in v1 across nine domains. Nine strictly append-only (Bucket A); four append-only with one whitelisted column transition (Bucket B); eight mutable with no append-only trigger (Bucket C). Total protected by §6's append-only enforcement contract: thirteen.
+Twenty-three tables in v1 across nine domains. Nine strictly append-only (Bucket A); four append-only with one whitelisted column transition (Bucket B); ten mutable with no append-only trigger (Bucket C). Total protected by §6's append-only enforcement contract: thirteen.
```

**Rationale:** count derives from Edit 3; protected-table count is unchanged because the new tables are Bucket C (not protected).

### Edit 5 — §5.2 Bucket-classification summary table (line 505)

```diff
-| **C** — mutable | 8 | No append-only trigger (constraint-driven validation only) | `users`, `markets`, `pools`, `positions`, `sessions`, `accounts`, `verifications`, `admin_sessions` |
+| **C** — mutable | 10 | No append-only trigger (constraint-driven validation only) | `users`, `markets`, `pools`, `positions`, `sessions`, `accounts`, `verifications`, `admin_sessions`, `watermark_state`, `cron_alarms` |
```

**Rationale:** mirrors Edit 3; the summary table's count + table list must stay synchronised with §5.1.

### Non-amended

- **B.15 structural column listing:** the brief's LD-9 confirms `pseudonym` is already correctly listed as a column in B.15 (verified at line 2664). No structural edit needed.
- **§5.4 Read-models that are not tables:** `watermark_state` + `cron_alarms` ARE tables, not read-models; they do not belong in §5.4.
- **§5.5 Removed from prior outline:** the new tables are net-new, not "removed-from-outline"; no §5.5 amendment.
- **§5 Single source of truth table:** the new tables ship in `drizzle/migrations/0007_pg_cron_jobs.sql` (a path the existing §5 SoT table already covers under "Append-only trigger SQL" + the generic migration SoT). No SoT-table amendment needed.
- **§6 Append-Only Enforcement Contract:** unchanged — Bucket C tables ride no append-only trigger.

### Same-commit landing

All five edits land in the same `feat(scaffold-17): ...` commit as the seed-script + migration + verification script + tests. No separate "docs" commit per ENGINE.6 process improvement #5.

---

## §G — Carry-forwards (informational; no code touched in this PR)

- **CF-1 — Five same-commit SPEC.2 edits** (Edits 1–5 at §F). Two absorb B.15 drifts per LD-9 (Edits 1 + 2); three absorb §5 inventory drift introduced by SCAFFOLD.17's two new operational tables (Edits 3 + 4 + 5) per Flag 3 (web Claude review) + ENGINE.6 process improvement #5.
- **CF-2 — Test-naming convention drift.** Shipped tests use `pseudonym::*`; SPEC.1 §17 uses `auth::pseudonym-*`. Both valid `<area>::<scenario>` shapes per AGENTS.md §9. Shipped convention is canonical; SPEC.1 §17 update queued for next SPEC sweep (NOT in SCAFFOLD.17 PR).
- **CF-3 — Tracker SCAFFOLD.17 estimate.** Tracker v10 entry reads "5d" + conflates operator-pipeline-run with codebase-side ingestion. Real codebase-side stratum is 1–2 d per CC repo inspection. Flag once for next tracker sweep; not blocking.
- **CF-4 — ENGINE.6 lessons applied** (process improvements #5 + #6). See §9.
- **CF-5 — SCAFFOLD.5 `cron_alarms` drain handler dependency.** SCAFFOLD.17 ships the INSERT side (§B). SCAFFOLD.5 ships the drain-and-emit side. Contract shape:
  - `cron_alarms` row: `(id bigserial, alarm_id text, payload jsonb, emitted_at timestamptz, processed_at timestamptz NULL)`.
  - Drain handler: `SELECT … WHERE processed_at IS NULL ORDER BY emitted_at LIMIT N`, emit Sentry event, `UPDATE … SET processed_at = now()`.
  - Vercel Cron schedule for drain: TBD by SCAFFOLD.5 (likely `*/1 * * * *` or `*/5 * * * *`).
- **CF-6 — pg_cron cadence + alarm 5 threshold tuning.** Currently `*/5 * * * *` + 5% threshold (`unassigned * 20 < total`). HARDEN.* tunes per ADR-0006 §7 + ADR-0007 §4 (decision names).
- **CF-7 — F-AUTH-4 stale-unaccepted-user sweep handler (B2).** Downstream auth-handler stratum. Stranded-tuple recovery semantics acknowledged in `consume.ts:16–22` and SPEC.1 line 704 (HARDEN-era).

---

## §4 — Test plan (execute-chat surface)

Per CLAUDE.md §5.6 + §5.11: failing tests FIRST via a `test-writer` reviewer-call invocation at Phase 2 START. Reviewer-call is a fresh-context `general-purpose` Agent invocation with the role briefing at `.claude/agents/test-writer.md` baked into the prompt + this plan path (`@docs/plans/SCAFFOLD.17.md`) + tool-scope constraint (Read + Write/Edit tests-only; no `src/` edits).

### Test inventory

- **Real-Postgres integration tests** (§D):
  - `tests/db/identity-pool/seed.test.ts` — 4 sub-tests (happy / idempotency / partial pre-seed / malformed row).
  - `tests/db/identity-pool/watermark.test.ts` — 6 sub-tests (above-no-alarm / above→below / repeated-below / below→above / second-episode / schedule-registration).
  - Fixtures: `tests/db/identity-pool/_fixtures/manifest-100.csv` + `manifest-malformed.csv`.
- **Substrate-mock acceptance tests** (§E) extending `tests/server/auth/pseudonym.test.ts`:
  - `pseudonym::pool-extension-deterministic-no-collision`
  - `pseudonym::scrubbed-tuple-not-returned-to-pool`
  - `pseudonym::pfp-served-from-r2-not-runtime-generated`
- **Regression coverage:** 6 existing pseudonym tests + 6 existing identity-pool trigger tests + all other `tests/db/triggers/` files pass unmodified post-SCAFFOLD.17.

### Invariants asserted

- **LD-1** schema shape preserved (no edits to `identity.ts`).
- **LD-2** Bucket B one-shot transition (existing trigger tests; §E test 8 verifies application layer never attempts the rejected operation).
- **LD-3** consumer + Better Auth hook behaviour preserved (existing pseudonym tests pass unmodified).
- **LD-6** `check_identity_pool_watermark()` fires exactly once per below-threshold episode (§D tests 2–5).
- **LD-7** FIFO + format + concurrency safety of consumer (existing pseudonym tests).

---

## §5 — Reviewer-call invocations (execute-chat)

Per CLAUDE.md §5.11. After pre-PR self-audit passes (§6 below), before `gh pr create`. Each invocation is a fresh-context `general-purpose` Agent with role briefing + plan path + tool-scope constraints embedded in the prompt.

| Reviewer briefing | Phase | Targets | Tool scope |
|---|---|---|---|
| `test-writer` (`.claude/agents/test-writer.md`) | Phase 2 START (tests-first per §5.6) | §D + §E test files + fixtures (failing first) | Read + Write/Edit tests-only; no `src/` edits |
| `code-reviewer` (`.claude/agents/code-reviewer.md`) | Phase 2 post-audit | `scripts/seed-identity-pool.ts` + `scripts/verify-identity-pool.ts` + `package.json` script entries | Read, Grep, Glob, Bash (read-only) |
| `db-migration-reviewer` (`.claude/agents/db-migration-reviewer.md`) | Phase 2 post-audit | `drizzle/migrations/0007_pg_cron_jobs.sql` + same-commit SPEC.2 B.15 amendments | Read, Grep, Glob, Bash (read-only) |
| `security-auditor` (`.claude/agents/security-auditor.md`) | After code-reviewer | seed-script SQL-injection surface (manifest input → INSERT via Drizzle parameterised values) + pg_cron extension role permissions + `cron.schedule` body shape | Read, Grep, Glob, Bash (read-only) |

### FAIL / SURPRISE handling per CLAUDE.md §5.11

- **FAIL within scope** → fix in-session before PR.
- **SURPRISE outside scope** → write to `claude-progress.md` + STOP (do not silently expand scope).

---

## §6 — Verification mechanic (post-merge operator-side runbook)

Per CLAUDE.md §5.10 + PSEUDONYM.md §10.3 (decision name). Operator-side sequence:

1. **External-dev pipeline (B1).** Operator-side parallel work — 50K `.webp` files uploaded to `zugzwang-pfp/v1/` + CSV manifest produced (Q1 shape). NOT in SCAFFOLD.17 scope.
2. **`pnpm seed:identity-pool:prod <manifest-path>`.** Operator runs against production DB. Wall-clock ~30 s (50 chunks × 1,000 rows × ~0.5 s/chunk per research brief R2).
3. **`pnpm verify:identity-pool`.** Runs the 4 PSEUDONYM.md §10.3 checks; exit 0 means all pass.
4. **`SELECT jobname FROM cron.job`.** Operator confirms `'identity-pool-watermark'` row present post-deploy.
5. **`SELECT * FROM watermark_state WHERE metric = 'identity_pool_unassigned'`.** Operator confirms `state = 'above'`.
6. **`SELECT count(*) FROM cron_alarms`.** Operator confirms 0 rows (no false-positive alarms).

### Pre-PR self-audit (per CLAUDE.md §5.10)

Walks §A–§F inventory item-by-item before `gh pr create`. Verifies:

- **§A** — every CSV-parse error path, exit code, chunked-INSERT shape, ON CONFLICT target columns, `package.json` script entry.
- **§B** — every CREATE EXTENSION / TABLE / FUNCTION / SELECT cron.schedule statement; CTE body; statement-breakpoint placement; threshold arithmetic.
- **§C** — every check assertion, exit code, R2 helper consumption, `package.json` script entry.
- **§D** — every sub-test in seed.test.ts + watermark.test.ts; beforeEach/afterEach cleanup; fixture content.
- **§E** — every test name matches `pseudonym::*` family; substrate-mock pattern matches existing 6 tests.
- **§F** — all 5 SPEC.2.md edits verbatim: Edits 1 + 2 against B.15 (lines 2663 + 2664); Edit 3 against §5.1 Bucket C (rows 22 + 23 added); Edit 4 against §5 opening prose (count 21 → 23, Bucket C 8 → 10); Edit 5 against §5.2 summary table (Bucket C count + tables list). All same-commit.

FAIL items fix in-session before PR. SURPRISE items surface to Hrishikesh.

---

## §7 — Exit criteria

### Code
- [ ] `scripts/seed-identity-pool.ts` per §A (chunked bulk-INSERT, per-chunk tx, ON CONFLICT idempotency, exported `runSeed`).
- [ ] `scripts/verify-identity-pool.ts` per §C (4 checks, seeded sample HEAD spot-check, text output).
- [ ] `drizzle/migrations/0007_pg_cron_jobs.sql` per §B (extension + tables + function + schedule).
- [ ] `tests/db/identity-pool/seed.test.ts` + `watermark.test.ts` + `_fixtures/manifest-100.csv` + `_fixtures/manifest-malformed.csv` per §D.
- [ ] `tests/server/auth/pseudonym.test.ts` extended with 3 new tests per §E (existing 6 tests + 1 it.todo unmodified).
- [ ] 6 existing identity-pool trigger tests + all other existing tests pass unmodified.
- [ ] `package.json` scripts: `seed:identity-pool:prod`, `verify:identity-pool`.
- [ ] `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` clean (or `just check` clean).

### Functional
- [ ] `runSeed` ingests fixture manifest at small N; idempotent re-run = no-op; partial pre-seed handled.
- [ ] `check_identity_pool_watermark()` fires `cron_alarms` row exactly once per below-threshold episode.
- [ ] All 4 §C checks pass against post-seed table state.
- [ ] pg_cron job appears in `cron.job` post-migrate.

### Documentation
- [ ] `docs/plans/SCAFFOLD.17.md` committed on `plan/scaffold-17` branch (this PR).
- [ ] `docs/logs/SCAFFOLD.17.md` plan-mode close-out committed on `plan/scaffold-17` per CLAUDE.md §5.9 (initial entry + flag-absorption entry).
- [ ] **5 SPEC.2 edits** per §F (B.15 lines 2663 + 2664 + §5.1 Bucket C rows 22 + 23 + §5 opening prose + §5.2 summary) same-commit in execute PR.
- [ ] Execute-chat close-out log delivered per closing ritual.

---

## §8 — Out-of-scope (per brief §7)

### Operator-side (B-list)
- **B1** — External-dev image pipeline (Flux + ComfyUI + Pillow + R2 upload). Operator-side parallel task.
- **B3** — Word-list curation, font selection, prompt template tuning, sampler params. Operator-side per PSEUDONYM.md §13 (decision name).
- R2 bucket policy JSON (authored by SCAFFOLD.15) — not SCAFFOLD.17 scope.

### Downstream strata
- **B2** — F-AUTH-4 stale-unaccepted-user sweep handler. Downstream auth-handler stratum (stranded-tuple recovery acknowledged in `consume.ts:16–22`; SPEC.1 line 704 HARDEN-era scope).
- **B4** — SCAFFOLD.5 Sentry SDK init + `cron_alarms` drain handler. Owns the TS-side emit path; SCAFFOLD.17 ships only the SQL-side INSERT (§B).
- H2-scrub handler (admin moderation) — downstream admin stratum.

### Post-Nov-8 scope (per user memory)
- Testnet blockchain integration — do NOT propose.
- Mainnet L1 deployment — do NOT propose.
- Artha as economic asset — do NOT propose.
- Validator ops — do NOT propose.

### Tuning / observability
- pg_cron cadence value (`*/5 * * * *` placeholder) — deferred to HARDEN.* per ADR-0006 §7.
- Sentry alarm 5 threshold tuning — deferred to HARDEN.* per ADR-0007 §4.
- Custom domain bind (`cdn.zugzwangworld.com`) — post-experiment per memory.

### ADR-0012 (design system lock)
Separately deferred — gates Phase 5 UI only.

---

## §9 — Carry-forwards from ENGINE.6 (process improvements applied)

Per `docs/logs/ENGINE.6.md` lines 302–317:

- **#5 — Same-commit amendment scope.** *"Future strata introducing emit sites with new aggregate_types should enumerate ALL new values in the same-commit §7.1 amendment scope, not just the immediately load-bearing one."* Generalised: all drift related to the stratum's scope absorbs in the same commit. **Applied at §F** (2 SPEC.2 B.15 corrections land same-commit as seed-script + migration + tests).
- **#6 — Verify-don't-trust on lint dismissals.** *"Future self-audits should grep-verify any 'pre-existing pattern' dismissal claim before accepting it as boilerplate-absorption."* **Applied at §6 pre-PR self-audit:** any dismissal of a Biome / type-check warning as "pre-existing" must be grep-verified before acceptance.

### LOC variance note (updated post web Claude review)

ENGINE.6's tests came in at ~3000 LOC vs plan §F budget of ~720 (≈4× over). SCAFFOLD.17 tests should land closer to the literal estimate (schema + script + migration + tests is more linear than ENGINE.6's discriminated-union payload validation):

- §D real-Postgres tests: ~180–230 LOC each × 2 = ~360–460 LOC (slightly higher than the pre-review estimate; the in-test setup steps for Tests 3-5 add ~10–20 LOC per test for the (insert → function → mutate → function) sequence per Flag 1 absorption).
- §E substrate-mock tests: ~100–150 LOC each × 3 = ~300–450 LOC (slightly higher than the pre-review estimate; Test 9's `expectTypeOf` + `vi.spyOn(fetch)` shape adds ~30–50 LOC vs the original static-import grep per Flag 2 absorption).
- §F SPEC.2 edits: 5 coordinated line-level edits (was 2 pre-review; per Flag 3 absorption). Doc-edit LOC is small (~10 lines net added to SPEC.2.md) but the edit count is the load-bearing change.
- **Total test budget ~660–910 LOC.**

Plan-mode CC flags this for execute-chat awareness; if implementation lands materially over budget, surface as a SURPRISE in the execute close-out.

---

*End of SCAFFOLD.17 plan. Plan-mode CC chat next action: commit this file at `docs/plans/SCAFFOLD.17.md` on `plan/scaffold-17` branch, write 6-field plan-mode close-out at `docs/logs/SCAFFOLD.17.md`, push branch to origin. Execute chat opens against `plan/scaffold-17` head after Hrishikesh confirms.*
