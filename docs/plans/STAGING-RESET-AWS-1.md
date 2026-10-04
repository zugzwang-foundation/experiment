# STAGING-RESET-AWS-1 — plan (ONE-OFF)

**Task.** Reset the LIVE staging database ONCE. Since AWS-MIGRATION it is RDS PostgreSQL inside the
VPC's isolated subnets (ADR-0059). End state: staging emptied, identity pool re-seeded, the six
content markets recreated through the shipped engine and opened at **YES 10% / NO 90%**, with **no
posts or replies** (founder: "khaali rakho").
**Requested by.** Founder, 2026-10-04.
**Founder rulings (2026-10-04).** (a) Markets left empty at 10/90 — no seeded activity. (b) **ONE-OFF:**
everything added for this run is removed from the repository afterwards; the reset happens once.
(c) **Tank = what it was:** `--price 0.1 --tank 100000` (90,000 / 10,000 — measured from each market's
`market.opened` payload, `docs/data/staging-markets-snapshot.md`). (d) **Market copy = what live
staging (AWS) holds today**, NOT the committed snapshot. ⚠ The two differ: the snapshot carries the
later specs (e.g. MKT-MAT-01 v3.3 dropped "on Zugzwang"), live still carries v3.0. The founder chose
live — so the run captures live first (T3 step 0) and recreates from that capture.
**Status.** APPROVED 2026-10-04 — PR-1 (T1–T4).

## Why the existing tools cannot do it today (measured 2026-10-04)

1. **They aim at the wrong database.** `pnpm staging:reset` / `seed-content-markets.ts` run under
   `doppler run --config stg`, and Doppler `stg` still holds the Supabase pooler
   (`DATABASE_URL_STAGING` host `aws-1-ap-south-1.pooler.supabase.com`). Run today, they would wipe the
   retired Supabase database and leave live staging untouched.
2. **The guard refuses RDS.** `tests/staging/_lib/target.ts` requires a Supabase host and reads the
   ref fragment from the URL's username. An RDS URL fails both checks.
3. **Nothing outside the VPC reaches RDS.** The only in-VPC task is `zugzwang-staging-migrate`
   (secrets: `DATABASE_URL_STAGING`, `STAGING_PROJECT_REF_FRAGMENT` — nothing else).
4. **The migrate image has no runner.** It carries `node_modules`, `scripts/`, `src/`, `drizzle/` —
   not `tests/staging/`, `tests/_setup/`, `vitest.staging.config.ts` or the markets snapshot.

## Design — temporary, then deleted

Because it runs once, nothing permanent is built: no new CDK task, no new IAM grant, no standing
button. It rides the EXISTING migrate task with a command override, which the GitHub staging role can
already run.

### T1 — Guard accepts the staging RDS host (temporary)
- `isAllowedStagingHost` also accepts `*.rds.amazonaws.com`; for an RDS URL the fragment must be a
  substring of the host. Production refusal unchanged (prod-ref guard also gets the prod RDS fragment).
- Tests first: staging RDS accepted · prod RDS refused · RDS without the fragment refused.

### T2 — Image: the migrate stage temporarily also carries the runner
- `Dockerfile` migrate stage copies `tests/staging/`, `tests/_setup/`, `vitest.staging.config.ts`,
  `docs/data/staging-markets-snapshot.json`. Migrations behave exactly as before (same CMD, same
  task-definition command); the files are just present.

### T3 — One orchestrator, five steps, fail-fast (`scripts/staging-reset-once.ts`)
0. **capture live** — READ-ONLY select of the six markets (`id, slug, title, description,
   resolution_deadline, media_video_url`) and their `market_media` rows, written over the image's
   `docs/data/staging-markets-snapshot.json` inside the container (never committed), in the shape
   `tests/staging/content-markets.ts` parses. Refuses unless exactly six markets, each with exactly one
   default image. Prints every captured slug + title to the log — the receipt of what was restored.
   Original ids are kept, so the R2 media objects stay addressable.
1. reset — `reset.staging.test.ts` (+ the content-market acknowledgement)
2. `db:seed:staging` — identity pool
3. content markets `--create`
4. content markets `--open --price 0.1 --tank 100000`

No `--media` step: it needs R2 keys the migrate task does not carry, and the media rows come from the
snapshot pointing at objects already in R2. Checked visually after the run instead.
Needs only the two secrets the migrate task already has — nothing new is injected.

### T4 — One-off workflow `.github/workflows/staging-reset-once.yml`
- ⚠ Not `workflow_dispatch`: GitHub dispatches only workflows on the default branch (`main`), and
  `main` deploys production. Trigger = a push of an already-merged **staging** commit to one of two
  dedicated branch names; the name is the mode, and pushing to the `-run` name is the confirmation:
  `ops/staging-reset-dry-run` (reads only) · `ops/staging-reset-run` (WIPES staging).
- First step refuses any commit that is not an ancestor of `origin/staging`.
- Builds the migrate image from that commit, pushes it as `staging-migrate`, then
  `aws ecs run-task --task-definition zugzwang-staging-migrate` with a **command override** running
  `scripts/staging-reset-once.ts --dry-run|--run`; waits; fails unless exit 0 and the digest matches;
  prints the task log; on `run`, checks `/api/health`.
- Shares deploy-aws.yml's `deploy-aws-staging` concurrency group (both move `staging-migrate`).
- The next normal staging deploy re-points `staging-migrate` at a fresh migrate image.

### T5 — Delete it all
After a successful run, a second PR removes T1–T4 completely (guard, Dockerfile lines, orchestrator,
workflow, and this plan's temporary tests). The repository returns to its pre-task state; git history
keeps the record. A one-line note goes in `docs/parked.md` / ADR-0035 patch record: "staging was reset
once on <date> via a temporary in-VPC run (PR #a, removed in PR #b)".

## Sequence

1. PR-1 (T1–T4) → review (`@code-reviewer`, `@security-auditor`) → merge to `staging`.
2. Push the merged staging commit to `ops/staging-reset-dry-run`; read the capture; then to `ops/staging-reset-run`.
3. Check: six markets at 10/90, no posts, sign-up works, market images show.
4. PR-2 (T5) → merge. Done.

## Risks

- **It destroys staging** — every user, bet, post and Dharma row. Undo = RDS automated backup restore
  (ADR-0059). Typed confirmation + staging-only + host/fragment guard + prod-ref guard.
- **No write-pause** during the few minutes it runs (one-off; staging traffic is the team). A bet placed
  mid-run is wiped by the reset or lands after it — acceptable for a one-off, stated here.
- **Live copy is older than the specs** (Math v3.0 vs v3.3): restored as-is by ruling (d).
- **Step 0 is the only copy of the live text during the run.** If step 1 succeeds and a later step
  fails, the captured JSON is in the task log; re-running step 3–4 from it is the recovery.

## Open questions

None — answered 2026-10-04 (rulings a–d above).
