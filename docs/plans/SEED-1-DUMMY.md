# SEED-1-DUMMY — engine-driven dummy content seeder, production-capable

## Context
The team (Hrishikesh + Mahadevan, 15 Sep 2026) wants dummy content on PRD first, built so the
real seed can reuse it later: ~1000 users, SEED-1-shaped post/reply chains on the 8 live markets,
placeholder images named per row in one folder (so real images drop in later), and time-spreading
(24h random + auto-resume) behind a flag. For the dummy run: 1000 users, everything at once,
clearly labelled `[DUMMY SEED]` text. "Build it and keep it ready" — **nothing runs against PRD
until an explicit go.**

Measured today: PRD `/api/health` → env prod, canary `a7bf4d2`, bom1, migrations ok; 8 markets Open
at 10%, no posts. Every existing runner refuses PRD by design (`tests/staging/_lib/target.ts:101`,
`tests/_setup/production-ref-guard.ts` P-17 on all three vitest configs,
`scripts/seed-content-markets.ts:121`). Not measured: PRD user count, free identity-pool tuples,
liquidity_policy enabled — the runner's pre-flight reads and prints these.

### Excluded — refused, recorded
**Cleanup by selective row delete with the append-only triggers disabled on production is NOT
built** (CLAUDE.md §2 "while we clean up" → refuse; also functionally broken: pools, positions, lots,
`dharma_ledger.seq`, consumed identity tuples and injector liquidity stay mutated). The seeder
instead writes a **manifest** of every id it creates, so any cleanup decision has an exact list.
Available on request: a guarded full in-place rebuild runbook, or fresh-project cutover.

## Design

P-17 and the staging target resolvers stay **untouched**. A new, separate runner family gets its own
positive-match production guard, following the ADR-0035/0036 shape. ⚠ One shared file does change:
`tests/staging/_lib/write-guard.ts` learns Windows stack frames. Without that, every engine write is
refused on the operator's machine. It is pinned by `tests/unit/staging/write-guard-frames.test.ts`.
*(Corrected after the @code-reviewer pass: this section first said all staging guards stay untouched.)*

### 1. Pure table layer — `tests/prod-seed/_lib/table.ts` (no DB, no `@/server`)
- Types: `SeedRow { key, market (slug), seq, postNo, kind: post|support|counter, side, stake, author,
  body, image|null, dueOffsetMs }`, `SeedTable { runId, markets[], authors[], rows[] }`.
- `validateTable(table)` — SEED-1 §4.3's seven rules as hard errors (floors 10/50, cap 250 checked
  against the same constants in `src/server/config/limits.ts`; reply after parent; no self-reply; one
  held side per author per market; running spend ≤ 500 of the 1000 grant; no author in consecutive
  rows; image names unique). Also checks that keys match `/^[A-Za-z0-9_-]{1,255}$/` and that body
  length is 1–5000 (the route rules `place()` does not enforce).
- `rowKey = seed-<runId>-<marketIdx>-<seq>`, which is deterministic. It is the bet idempotency key.

### 2. Table generator — `scripts/seed/generate-table.ts` (plain tsx, seeded RNG)
Flags: `--run-id --markets <slugs,…> --users 1000 --posts 100 --coverage 0.5 --yes-ratio 0.4
--image-ratio 0.5 --window 0|24h --seed <n> --out <dir>`. Implements SEED-1 §4.4:
- post stakes from the 10/10/15/20/25/40 ladder;
- reply stakes by side (NO 90–130, YES 50–80);
- author walk under the rules;
- interleave (birth position + a random reply gap);
- sorted random due offsets inside the window.

Bodies: `[DUMMY SEED] Post 7 on this market. Placeholder text, to be replaced.` (and a reply
variant). Image names: `<slug>_p<NNN>.png`. Writes `table.json`, then runs `validateTable` and
refuses to write on failure. The author budget is a cap: authors get a bet only when the rules allow
it, so exactly `--users` accounts are created and some may hold a single bet.

### 3. Images — `scripts/seed/prepare-images.ts`
`--table <json> --common <image> --dir <folder outside repo>`: copies one common image to every
filename the table names, then pre-flights the set: every row has a file, every file has a row, type
is in the accepted list, size ≤ 8 MiB. For the real run the files in the folder are replaced and the
same pre-flight runs.

### 4. Runner — `tests/prod-seed/seed.prod-seed.test.ts` (Vitest harness, per ADR-0036)
- **Config** `vitest.prod-seed.config.ts`: a copy of `vitest.staging.config.ts`, but it includes only
  `tests/prod-seed/**/*.prod-seed.test.ts` and sets `watch:false`. `globalSetup` is replaced by
  `tests/prod-seed/_lib/guard-setup.ts` (below). Timeouts are sized for a 24h window.
  `vitest.config.ts` gains an exclude for `tests/prod-seed/**`.
- **Target** `tests/prod-seed/_lib/target.ts`, `resolveSeedTarget(env)`, fails closed, no default.
  `ZUGZWANG_SEED_TARGET` must be one of:
  - `local` — a loopback `DATABASE_URL` (reuses `LOOPBACK_HOSTS`);
  - `staging` — delegates to the existing `resolveRunnerTarget` plus `checkTestTargetNotProduction`;
  - `prod` — the URL **must contain** `PRODUCTION_PROJECT_REF`, on a Supabase host
    (`isAllowedStagingHost`), with `ZUGZWANG_ENV=prod`, and
    `ZUGZWANG_PROD_SEED_ACK=seed-dummy-content-on-production`.

  Every mode refuses a target from a different mode (for example a staging ref while in prod mode).
  `guard-setup.ts` runs this check as `globalSetup`, so P-17 is not bypassed in the other modes.
- **Client** `tests/prod-seed/_lib/client.ts`: the same shape as `tests/staging/_lib/client.ts`. It
  reuses `createWriteGuard` (`tests/staging/_lib/write-guard.ts`) and hands out `guardedDb` and
  `readOnly` only. The live-socket check reuses `assertLiveConnection(client, ref)`
  (`tests/staging/_lib/reset.ts:66`) with the mode's ref.
- **Mocks**: the same shell-only set as `generate.staging.test.ts:70-137` (Sentry, next/headers,
  next/navigation, next/cache, onboarding-ref, `@/db` → guardedDb). Nothing that writes or moves
  Dharma is mocked.
- **Pre-flight** (read-only, prints everything, refuses before any write):
  - table valid;
  - every market slug exists, is `Open`, and its id is printed;
  - the conclusion freeze is not set, and the `system_state` row exists;
  - no needed seed account is banned, and no user row lacks its account;
  - every existing receipt under the run's keys matches the table (fingerprint, market, user);
  - free identity tuples ≥ accounts still to create for the selected rows;
  - image folder passes pre-flight;
  - `liquidity_policy` latest row printed;
  - PRD user count printed.

  `ZUGZWANG_SEED_PREFLIGHT_ONLY=1` stops here. One test is never skipped, so pre-flight really runs.
- **Users**, resumable, only for the authors of the selected rows: for each author, look up `accounts` by (`google`,
  `dummy-seed-sub-<runId>-<author>`), which is unique per `auth.ts:129`. If absent, call
  `createParticipant` (the same Better Auth `createOAuthUser` + real `acceptTosAction`, synthetic
  IP/UA literals).
- **Rows**, resumable, in seq order:
  - In window mode, sleep until `startedAt + dueOffsetMs`. `startedAt` is persisted to
    `<table-dir>/state-<mode>.json` together with the table's hash, so a restart keeps the schedule.
  - Before the row, re-check the freeze and the author's ban.
  - Skip the row if its receipt was verified in pre-flight.
  - Resolve a reply's parent through the verified keys, then run `validateReplyParent` and check the
    parent's side.
  - For image rows, upload through the shipped chain (the `uploadFixtureImage` pattern with the
    folder's file: `signUploadAndInsert` → `mintPutUrl` with `ifNoneMatch` → PUT →
    `verifyUploadedObject`).
  - Place the bet: `runBetTransaction` → `place()` with `idempotencyKey = rowKey` and
    `bodyFingerprint = sha256(row)`.
  - Append a progress line to `<table-dir>/progress-<mode>.jsonl`.
  - `ZUGZWANG_SEED_LIMIT=N` selects the **first N rows of the table**, so re-running is a no-op.
- **Post-run**:
  - the write log has no `tests/` writer and is non-vacuous (`bets` and `comments` written from
    `src/`);
  - no Sentry captures;
  - `manifest-<mode>.json` is rebuilt from the database;
  - a per-market report of posts, replies and price.
- **Auto-resume wrapper**: the CLI's `--until-done` re-invokes the runner after a non-zero exit, with
  backoff and a max of N attempts. Resume correctness rests on the deterministic keys, not on the
  wrapper.

### 5. CLI — `scripts/seed-prod.ts`
`--env local|staging|prod` (required, no default) `--table <json> --images <dir> [--window-live]
[--preflight-only] [--limit N] [--until-done]`. It spawns
`doppler run --project zugzwang-experiment --config <stg|prd> -- pnpm exec vitest run --config
vitest.prod-seed.config.ts tests/prod-seed/seed.prod-seed.test.ts`, passing parameters as env vars
(the `seed-content-markets.ts:166-215` pattern). `prod` additionally requires the operator to type
the literal `seed production` at a prompt, plus `--i-understand-this-writes-production`.

### 6. Guards and tests (non-DB, run locally)
- `tests/unit/prod-seed/table-validate.test.ts`: one failing fixture per rule, plus a generated
  1000-user table passing (positive control).
- `tests/unit/prod-seed/seed-target.test.ts`: prod accepted only with ref + Supabase host + env +
  ack; staging URL refused in prod mode; prod URL refused in local/staging mode; empty ref refuses.
- `tests/unit/staging/runner-isolation.test.ts`: add the assertion that the default config excludes
  `tests/prod-seed/**` and that the new config includes only its own glob.
- A source tripwire mirroring `generator-no-direct-writes.test.ts` for `tests/prod-seed/` (import
  allowlist plus forbidden direct writes).

### 7. Docs (same change set)
- `docs/adr/0053-production-dummy-seed-runner.md`: a scoped exception to ADR-0035/0036's "no
  production runner". It records the positive-match guard, the manifest, and the refused cleanup
  path.
- `docs/plans/SEED-1-DUMMY.md`: a copy of this plan.
- AGENTS.md §9: one bullet for the new runner family.

Nothing is committed or pushed (standing instruction: verify locally only).

## Verification
1. Run `pnpm tsc --noEmit` and `pnpm biome check .`. Run
   `vitest run tests/unit/prod-seed tests/unit/staging/runner-isolation.test.ts`, which needs no DB.
   Run `ZUGZWANG_ENV=preview just verify`.
2. Generate the table (`--users 1000 --posts 100 --coverage 0.5`, markets = the 8 PRD slugs from
   Discovery), prepare images, and check both validators are green. Print the counts (rows, users,
   spend distribution).
3. **Rehearsal on staging** (reversible, the guarded staging reset exists): a run with `--env staging
   --limit 30`, on a table generated against staging's Open markets. Check the manifest, the rendered
   posts and image, then re-run the same command and confirm 0 new rows (resume proof — valid since
   `--limit` names the first N table rows).
4. **PRD**, only on explicit go:
   1. `--env prod --preflight-only`, and report the numbers.
   2. `--limit 10` smoke, then a browser spot-check of `/m/<slug>`.
   3. The full run.
