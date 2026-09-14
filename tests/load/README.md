# Load-test kit — re-running the staging campaign against production

This directory rebuilds the load-testing campaign run against staging from 1 to 13 September 2026, so it can be re-run page by page against production after the migration and compared number for number.

The scripts are the ones that ran on staging. They were recovered from the session that ran them, and the only changes are the target and the safety rules below. Every one parses and passes Biome. ⚠ **None has been executed through k6 in this exact form yet**, because the load-test machine was unreachable when this kit was assembled. Run the smoke step in §3 before trusting any number.

---

## 1. What is safe to run where

| # | Script | What it hits | Production | Staging result to compare against |
|---|---|---|---|---|
| 01 | `read/01-rig-ceiling.js` | `/favicon.ico`, no app work | ⛔ Run against staging. It measures the rig, not the site. | 85 → 237 req/s achieved after raising `ulimit -n` |
| 02 | `read/02-sign-in.js` | `/sign-in` or `/sign-in/otp` | ✅ | >98% failed at every batch, 200 → 3,000 req/s. Fixed since by ADR-0052. |
| 03 | `read/03-homepage.js` | `/` | ✅ | Success 23.96% at 1,000 · 11.15% at 2,000 · 9.23% at 3,000 · 5.44% at 4,000 · 7.68% at 5,000 |
| 04 | `read/04-market-page.js` | `/m/<slug>` | ✅ | Photo-heavy market at 200 req/s: 16.39% success. Driven by image bandwidth, not server CPU. |
| 05 | `read/05-image-post.js` | `/m/<slug>?post=<n>` | ✅ | Run at 25 → 50 → 100 req/s |
| 06 | `read/06-profile.js` | `/u/<pseudonym>` | ✅ | 99.48% at 200 req/s · 73.18% under heavy load |
| 07 | `read/07-mixed-read.js` | homepage, market, profile and sign-in blended | ✅ | New blend; no single staging equivalent |
| 08 | `read/08-hotspot.js` | one market, sudden | ✅ | 93.25% success at a 1,500 req/s spike on a market without bulk images |
| 09 | `read/09-spike.js` | homepage, 0 → peak in 10 s | ✅ | 98.33% success, median ~1 s, at a 1,500 req/s spike. Best result of the campaign. |
| 10 | `read/10-soak.js` | homepage and market, long | ✅ | Never run: blocked on the database connection bottleneck |
| 11 | `read/11-ceiling.js` | homepage and market, past design | ✅ capped at 600 req/s | Offered up to 2,500 req/s, achieved ≈59 req/s, 267,184 dropped iterations. Cause never separated between rig, app pool and platform. |
| 12 | `write/12-bet-place.js` | `POST /api/bets/place` | ⛔ staging only | Correct; capped by the per-IP limit |
| 13 | `write/13-bet-sell.js` | buy, then `POST /api/bets/sell` | ⛔ staging only | 11 of 17 sells succeeded; all correct |
| 14 | `write/14-reply.js` | reply-bet on a parent comment | ⛔ staging only | 18 of 503 succeeded; 485 rate-limited |
| 15 | `write/15-ip-disambiguation.js` | 200 one-shot bettors | ⛔ staging only | 85% blocked: one real IP |
| 16 | `write/16-two-market-burst.js` | bets split over two markets | ⛔ staging only | 8 on A, 10 on B. Does not show a per-market limiter; none exists. |
| 17 | `write/17-visits-beacon.js` | `POST /api/visits` | ⛔ staging only | Ran inside stage 3 |

Three staging tests are not k6 scripts. They call the app's own code directly against the staging database, so they have no production form:

| Test | Runner | Staging result |
|---|---|---|
| 500 simultaneous bets on one market, with the Dharma math re-checked against the database | `tests/staging/concurrency-setup.staging.test.ts` then `concurrency-burst.staging.test.ts` | 140 succeeded; every Dharma amount exact |
| 150 simultaneous signups | `tests/staging/concurrent-signup-burst.staging.test.ts` | 150 of 150; zero collisions |
| 50 simultaneous photo uploads | `tests/staging/concurrent-image-upload-burst.staging.test.ts` | 19 of 50; the rest were the database's contention safety, not a defect |

### Why the write half never runs against production

`lib/target.js` refuses every write script unless the target is staging, and there is no override.

- **Writes to production are permanent.** Bets, replies and sells add rows to `bets`, `comments`, `dharma_ledger` and `events`. Database triggers reject UPDATE and DELETE on those tables, and the rows are part of the public dataset released after the freeze.
- **Signups use up the identity pool.** A pseudonym handed out is never handed out again.
- **The sessions don't exist.** The write scripts need signed-in sessions minted straight into the database by `mint-bet-sessions.staging.test.ts`, which refuses any database but staging.

Staging runs the same code as production. To re-check write paths after a production deploy, deploy the same commit to staging and run the write half there.

---

## 2. Before touching production

1. **The migration is finished and signed off** by whoever is doing it. Don't load-test a half-migrated system.
2. **Production is healthy.** Check that `https://zugzwangworld.com/api/health` returns `"status":"ok"`, `"db":"ok"` and `"migrations":"ok"`. `run.sh` refuses to start otherwise.
3. **Pick the window.** Real visitors share the capacity you are consuming. Run before the public launch, or at the quietest hour, and tell the team first.
4. **Have the dashboards open:** Vercel for functions, errors and spend; Supabase for connections and CPU; Upstash for commands. Stop the run if real users start seeing errors.
5. **Know the ceiling.** Past about 600 to 700 req/s from one machine, Vercel's abuse protection resets connections (staging correction C-03). Production runs are capped at `PRODUCTION_MAX_RATE`, 600 by default. Going higher from one machine measures Vercel, not the app, and may get the rig's IP challenged.
6. **One test at a time,** with a minute of quiet between batches, so each result belongs to one test.

---

## 3. Rig setup

On the load-test machine (the DGX, `zugzwang@100.74.9.117`):

```bash
cd ~/experiment
git fetch company && git checkout chore/load-test-kit     # this branch
k6 version                                                # any recent k6
ulimit -n 65536                                           # run.sh also does this
```

**Smoke test first.** Before any real batch, run each script once at a trivial rate to prove it runs on this k6:

```bash
TARGET_URL=https://staging.zugzwangworld.com PEAK_RATE=5 tests/load/run.sh read/03-homepage.js
```

**Then measure the rig,** against staging, once:

```bash
TARGET_URL=https://staging.zugzwangworld.com tests/load/run.sh read/01-rig-ceiling.js
```

If the rig tops out below a page test's peak rate, that page test is measuring the rig.

---

## 4. Production, page by page

Set these once. Pick real values from production:

```bash
export TARGET_URL=https://zugzwangworld.com
export MARKET_SLUG=<a real open market slug>
export PHOTO_MARKET_SLUG=<the market with the most image posts>
export POST_ID=<an image post number on that market>
export PSEUDONYM=<a real participant with positions>
```

Run in this order. Each block is one page; run its batches one after another.

**4.1 Spike on a cold deployment.** This goes first because later tests warm the caches.

```bash
PEAK_RATE=500 tests/load/run.sh read/09-spike.js
```

**4.2 Sign-in page.** Staging batches were 200 → 3,000. On production stop at the cap:

```bash
for r in 100 200 300 500 600; do PEAK_RATE=$r tests/load/run.sh read/02-sign-in.js; sleep 60; done
PAGE_PATH=/sign-in/otp PEAK_RATE=300 tests/load/run.sh read/02-sign-in.js
```

**4.3 Homepage.**

```bash
for r in 100 200 300 500 600; do PEAK_RATE=$r tests/load/run.sh read/03-homepage.js; sleep 60; done
```

**4.4 Market pages.** Run once per market, never overlapping:

```bash
for slug in <slug-1> <slug-2> <slug-3>; do MARKET_SLUG=$slug PEAK_RATE=100 tests/load/run.sh read/04-market-page.js; sleep 60; done
```

**4.5 Image post deep link.**

```bash
MARKET_SLUG=$PHOTO_MARKET_SLUG POST_ID=$POST_ID PEAK_RATE=100 tests/load/run.sh read/05-image-post.js
```

**4.6 Profile page.**

```bash
for r in 100 200 300 500; do PEAK_RATE=$r tests/load/run.sh read/06-profile.js; sleep 60; done
```

**4.7 Hotspot.**

```bash
PEAK_RATE=500 tests/load/run.sh read/08-hotspot.js
```

**4.8 Mixed read.**

```bash
PEAK_RATE=300 tests/load/run.sh read/07-mixed-read.js
```

**4.9 Ceiling, up to the single-machine cap.**

```bash
PEAK_RATE=600 tests/load/run.sh read/11-ceiling.js
```

**4.10 Soak, last, only if everything above held.** A short one first:

```bash
SOAK_RATE=100 SOAK_DURATION=30m tests/load/run.sh read/10-soak.js
```

---

## 5. Staging only: the write half

Re-run these on staging, deployed at the same commit as production.

**Set up the markets and sessions.** These write to the staging database:

```bash
ACK="ZUGZWANG_STAGING_TARGET=staging ZUGZWANG_STAGING_VOLUME_WRITE_ACK=generate-staging-volume-fixture"
doppler run --project zugzwang-experiment --config stg -- env $ACK \
  pnpm exec vitest run --config vitest.staging.config.ts tests/staging/concurrency-setup.staging.test.ts
doppler run --project zugzwang-experiment --config stg -- env $ACK SESSION_POOL_OUT=./bet-session-pool.json \
  pnpm exec vitest run --config vitest.staging.config.ts tests/staging/mint-bet-sessions.staging.test.ts
```

Each runner's own docblock is authoritative for its exact guards. The session pool file holds live cookies; it is gitignored.

**Run the write scripts:**

```bash
export TARGET_URL=https://staging.zugzwangworld.com SESSION_POOL_PATH=./bet-session-pool.json
export MARKET_ID=<concurrency-test-market id>
PEAK_RATE=50 tests/load/run.sh write/12-bet-place.js
PEAK_RATE=20 tests/load/run.sh write/13-bet-sell.js
PARENT_COMMENT_ID=<a comment id on that market> PEAK_RATE=50 tests/load/run.sh write/14-reply.js
VU_COUNT=200 tests/load/run.sh write/15-ip-disambiguation.js
MARKET_A_ID=<id> MARKET_B_ID=<id> tests/load/run.sh write/16-two-market-burst.js
PEAK_RATE=200 tests/load/run.sh write/17-visits-beacon.js
```

**The in-process bursts:**

```bash
doppler run --project zugzwang-experiment --config stg -- env $ACK \
  pnpm exec vitest run --config vitest.staging.config.ts tests/staging/concurrency-burst.staging.test.ts
doppler run --project zugzwang-experiment --config stg -- env $ACK \
  pnpm exec vitest run --config vitest.staging.config.ts tests/staging/concurrent-signup-burst.staging.test.ts
doppler run --project zugzwang-experiment --config stg -- env $ACK \
  pnpm exec vitest run --config vitest.staging.config.ts tests/staging/concurrent-image-upload-burst.staging.test.ts
```

The signup burst refuses to start when fewer than 150 identity-pool tuples are free.

---

## 6. Recording results

Every `run.sh` call writes `tests/load/results/<RUN_ID>/`:

- `meta.txt`: target, the deployed commit from `/api/health`, rig, open-file limit, every parameter.
- `summary.json`: k6's full summary.
- `summary.txt`: one line for the table below.
- `stdout.log`: the full run output.

Copy each `summary.txt` into this table:

| Date | Script | Target | Peak req/s | Success | p50 | p95 | 429s | No response | Deployed commit | Staging figure |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

---

## 7. Reading the numbers without fooling yourself

Each of these mistakes was made once during the staging campaign:

- **Offered is not achieved.** `PEAK_RATE` is what k6 tried to send. If `dropped_iterations` is non-zero, the rig could not keep up and the real rate was lower.
- **Check the rig's limit first.** For the whole staging campaign the rig was capped at 1,024 open connections, and no error said so (C-01). `meta.txt` records `open_files`.
- **"No response" past ~600 req/s is usually Vercel's abuse protection,** not the app (C-03).
- **One machine is one IP.** Vercel replaces a client-supplied `x-forwarded-for`, so the per-IP write limit of 30 per minute caps every write test from one rig (C-02). A low success count there measures the limit, not the database.
- **Cold and warm are different questions.** The first run after a deploy fills caches; later runs measure a warm site. Record which one you ran.
- **Slow success still counts as trouble.** Requests that queue for a database connection can succeed after seconds with no error. Read p95 and p99 alongside the success rate.
