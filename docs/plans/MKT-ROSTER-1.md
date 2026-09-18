# MKT-ROSTER-1 · DELETE-PLAN

**Task:** MKT-ROSTER-1 · DELETE-PLAN (measure, then write the runbook)
**Session:** Claude Code, 2026-09-18
**Walls honoured:** no writes anywhere (DB, R2, Vercel, Redis, git). stg/prd SQL is
SELECT-only inside `BEGIN READ ONLY … COMMIT`. Every number below is measured in this
session with the command shown. Nothing is copied from docs.
**Prior artifacts reused:** NONE — `ls ~/Downloads/ | grep -i MKT-ROSTER` returned nothing,
so every figure here is first-measurement.

---

## §0 · Measurement log (append-only, written as the work happened)

### Session orientation (measured 2026-09-18T0821Z)

```
git rev-parse --abbrev-ref HEAD   → staging-advance-2
git rev-parse HEAD                → 6a50d7bbda717123e76a712364918460c3b9459c
git status --porcelain            → (empty; clean)
git fetch origin                  → ok
git rev-list --count HEAD..origin/main → 0     # main is fully contained in HEAD
git rev-parse origin/main         → 25d5df3edc20d6cd8cbfbc2e638cbca0404e4625
git rev-parse origin/staging      → 6a50d7bbda717123e76a712364918460c3b9459c  # == HEAD
```

HEAD is `origin/staging`, which contains all of `origin/main`. Every code measurement
below is therefore simultaneously true of `main` unless noted.

### The two market identities (from `docs/data/staging-markets-snapshot.json`, cross-checked against the live DBs in §A1)

| | slug | id |
|---|---|---|
| **MKT-MUM-01** | `mumbai-bmc-pink-october-disclosure` | `01a01181-bb3c-7443-bc4d-35938c65bde9` |
| **MKT-OKT-01** | `oktoberfest-munich-beer-volume` | `01a01181-c07c-765a-9664-c065540c173d` |

The six keepers:

| slug | id |
|---|---|
| `chess-fide-tiebreak-response` | `01a01181-c54b-71b9-a77f-d6e11d373a69` |
| `bitcoin-price-50k` | `01a01181-ca40-725f-895c-270b2190c3ee` |
| `math-erdos-contribution-response` | `01a01181-d035-714a-b735-5d282576d0a3` |
| `claude-bundle-response` | `01a01181-d508-7288-b996-36ec427a9d2f` |
| `yc-paper-club-response` | `01a01181-da63-738b-a3ea-8da89299bc53` |
| `github-zugzwang-repo-stars` | `01a01181-df3a-747f-b154-e79a4a416b51` |

---

## §A · MEASUREMENTS

All SQL below ran through this wrapper, so every statement was inside a read-only
transaction. `transaction_read_only` measured `on` on both targets.

```sh
# scratchpad/ro.sh
doppler run --project zugzwang-experiment --config <stg|prd> -- sh -c \
  'psql "$DATABASE_URL_<STAGING|PROD>" -v ON_ERROR_STOP=1 --no-psqlrc -f <file>'
# file body is always:  BEGIN READ ONLY;  <SELECTs>  COMMIT;
```

**Target identity, proven before any read** (DSNs never printed):

| | project ref | host | `ZUGZWANG_ENV` | `current_database()` | server |
|---|---|---|---|---|---|
| **stg** | `rwfdoqzsghqhhdapxafg` | `aws-1-ap-south-1.pooler.supabase.com:5432` | `staging` | `postgres` | PostgreSQL 17.6 |
| **prd** | `zbvprdcyxhlguxbostdj` | `aws-1-ap-south-1.pooler.supabase.com:5432` | `prod` | `postgres` | PostgreSQL 17.6 |

`zbvprdcyxhlguxbostdj` is byte-identical to `PRODUCTION_PROJECT_REF` in
`tests/staging/_lib/guards.ts:52`. The staging DSN does **not** contain it; the production
DSN does. That is the single fact every staging guard in §A4 turns on.

### A1 · The market roster

#### A1.1 · `markets` columns (identical on both environments)

| n | column | type | null | default |
|--:|---|---|---|---|
| 1 | `id` | uuid | NO | `uuidv7()` |
| 2 | `slug` | text | NO | — |
| 3 | `title` | text | NO | — |
| 4 | `description` | text | YES | — |
| 5 | `status` | `market_status` | NO | `'Draft'` |
| 6 | `resolution_deadline` | timestamptz | NO | — |
| 7 | `resolved_at` | timestamptz | YES | — |
| 8 | `resolution_outcome` | `resolution_outcome` | YES | — |
| 9 | `created_by` | text | NO | `'admin-singleton'` |
| 10 | `created_at` | timestamptz | NO | `now()` |
| 11 | `media_video_url` | text | YES | — |

There is no `tag`, `category`, `resolver`, `logo`, `source` or `handle` column. Everything
`ResolverCards` renders is build-time TypeScript, not data — which is why §A9's work is a
code change and not a migration.

#### A1.2 · ⛔ THE SINGLE MOST IMPORTANT MEASUREMENT: prd and stg are NOT the same markets

**The eight markets exist twice, with different primary keys, different descriptions and
(on one market) a different title.** Production was built fresh on 2026-09-14, not restored
from the staging snapshot. `docs/data/staging-markets-snapshot.json` describes **staging
only** and is useless as a production restore source.

| slug | stg id | prd id |
|---|---|---|
| `bitcoin-price-50k` | `01a01181-ca40-725f-895c-270b2190c3ee` | `01a0a0ba-c700-77bf-8395-7f6bd429e53f` |
| `chess-fide-tiebreak-response` | `01a01181-c54b-71b9-a77f-d6e11d373a69` | `01a0a0ba-d969-7613-a701-0f140bd224b1` |
| `claude-bundle-response` | `01a01181-d508-7288-b996-36ec427a9d2f` | `01a0a0ba-f3bd-70fe-b5fd-70426431e314` |
| `github-zugzwang-repo-stars` | `01a01181-df3a-747f-b154-e79a4a416b51` | `01a0a0bb-0dfb-7793-9ff3-057e1a53c10a` |
| `math-erdos-contribution-response` | `01a01181-d035-714a-b735-5d282576d0a3` | `01a0a0bb-3141-71ce-9843-2d98002f8c87` |
| `yc-paper-club-response` | `01a01181-da63-738b-a3ea-8da89299bc53` | `01a0a0bb-7e0b-7182-9944-bba33914d94b` |
| **MUM** `mumbai-bmc-pink-october-disclosure` | `01a01181-bb3c-7443-bc4d-35938c65bde9` | `01a0a0bb-4e2f-722e-96d4-62139198223a` |
| **OKT** `oktoberfest-munich-beer-volume` | `01a01181-c07c-765a-9664-c065540c173d` | `01a0a0bb-7352-74be-849e-d267b8c074b3` |

Title / description fingerprints (`length` · `md5`):

| slug | title stg | title prd | desc stg | desc prd | same? |
|---|---|---|---|---|---|
| `bitcoin-price-50k` | 57 · `30dee0dd…` | 57 · `30dee0dd…` | 3795 · `b8144024…` | 2457 · `cb6336ff…` | title ✅ desc ❌ |
| `chess-fide-tiebreak-response` | 54 · `f4e54331…` | 54 · `f4e54331…` | 3609 · `fd86e856…` | 1616 · `68e4574d…` | title ✅ desc ❌ |
| `claude-bundle-response` | 64 · `afbe8cd4…` | **61 · `e890d44e…`** | 3733 · `526c557c…` | 1987 · `f075a88c…` | **title ❌** desc ❌ |
| `github-zugzwang-repo-stars` | 52 · `5b5f32f3…` | 52 · `5b5f32f3…` | 794 · `4bbd47fa…` | 794 · `4bbd47fa…` | ✅ both |
| `math-erdos-contribution-response` | 55 · `75742895…` | 55 · `75742895…` | 3836 · `0d4100de…` | 2414 · `1eacf48b…` | title ✅ desc ❌ |
| `yc-paper-club-response` | 62 · `f61cf9d4…` | 62 · `f61cf9d4…` | 789 · `76e7bd3f…` | 525 · `7b537b19…` | title ✅ desc ❌ |
| MUM | 65 · `108325a5…` | 65 · `108325a5…` | 2990 · `5ece1552…` | 2103 · `d89af6f2…` | title ✅ desc ❌ |
| OKT | 64 · `e76fe37c…` | 64 · `e76fe37c…` | 3939 · `26f14306…` | 2976 · `9140e231…` | title ✅ desc ❌ |

⇒ **Each environment must be snapshotted from itself.** A cross-environment restore would
silently replace production copy with staging copy on seven of the eight markets.

#### A1.3 · Lifecycle state today

| | stg | prd |
|---|---|---|
| total markets | **26** | **8** |
| content markets | 8 | 8 |
| `sp-m*` fixtures | 15 | 0 |
| other non-fixture markets | 3 (see A1.5) | 0 |
| MUM status | `Open` | `Open` |
| OKT status | **`Resolved` / `NO`, resolved 2026-09-07 20:38:35Z** | `Open` |
| the six keepers | all `Open` | all `Open` |

`resolution_deadline` for all seven non-OKT markets is `2026-11-05 23:45:00+00`; OKT's is
`2026-10-04 21:59:00+00` on both. `media_video_url` is NULL on all sixteen rows, both
environments. `created_by` is `admin-singleton` everywhere.

#### A1.4 · Opening parameters — `market.opened` payloads

**Production: all eight opened identically.**

```json
{"marketId":"…","openingPriceYes":"0.1",
 "yesReserves":"90000.000000000000000000","noReserves":"10000.000000000000000000",
 "discardedYes":"0.000000000000000000","discardedNo":"80000.000000000000000000",
 "backingMinted":"90000.000000000000000000"}
```

⇒ `p_yes = 0.1`, `tank = 100000` (90000 + 10000), for every market. **One `--price` / `--tank`
pair restores all six**, which is exactly what `scripts/seed-content-markets.ts` can express.

`market.created` payload keys are `marketId, media, mediaVideoUrl, resolutionDeadline` — so
title/description/slug live only in the `markets` row and must come from the snapshot.

#### A1.5 · ⚠ Three staging markets that are neither fixtures nor content

`concurrency-test-market`, `concurrency-test-market-b`, `seed-1-test-staging-20260914` —
all `Open`, all created after the LIQ-1-RESTORE seeding. They do **not** match
`FIXTURE_SLUG_PREFIXES` (`sp-m`, `volume-fixture-`), so `assessContentMarkets`
(`tests/staging/_lib/content-guard.ts:63-72`) classifies them as **content markets**. A
`pnpm staging:reset` today therefore refuses and names **eleven** slugs, not eight. This is
measured, not inferred — the predicate is a prefix filter with no allow-list for test debris.

#### A1.6 · Current pool state (has drifted from opening on BOTH environments)

stg — reserve sums 200035…417000, `p_yes` 0.1000…0.1051.
prd — reserve sums 92371…97265, `p_yes` 0.1874…0.2316.

⇒ **"Exactly as they are today" cannot mean today's reserves** unless every bet is also
replayed. Since every bet is dummy and is being wiped, the faithful restore is the market
*definition* plus the *original* opening parameters (A1.4). Raised as OQ-1 in §B8.

#### A1.7 · `market_media`

| | stg | prd |
|---|---|---|
| total rows | 34 | 16 |
| per content market | 2 (`.png` `display_order 0 is_default=t`, `.webp` `1 f`) | same |
| MUM rows | 2 | 2 |
| OKT rows | 2 | 2 |
| fixture/test market rows | 18 | 0 |

Keys are `m/<marketId>/<mediaId>.<ext>` — **market-id-scoped, so the prd and stg key spaces
are disjoint.** Media ids are independent UUIDv7s, not derivable; they must be snapshotted.

### A2 · Row counts, every public base table

| table | stg | prd |
|---|--:|--:|
| accounts | 832 | 110 |
| admin_events | 0 | 0 |
| admin_sessions | 1 | 1 |
| bet_receipts | 765 | 1516 |
| bets | 738 | 1507 |
| bookmarks | 0 | 0 |
| comments | 738 | 1507 |
| cron_alarms | 425 | 0 |
| dharma_ledger | 2039 | 1737 |
| events | 5723 | 3970 |
| identity_pool | 1940 | 19904 |
| image_uploads | 194 | 175 |
| liquidity_heartbeat | 15149 | 6978 |
| liquidity_policy | 6 | 2 |
| lots | 738 | 1507 |
| market_media | 34 | 16 |
| markets | 26 | 8 |
| mod_actions | 3 | 0 |
| payout_events | 14 | 0 |
| pools | 25 | 8 |
| positions | 517 | 224 |
| resolution_events | 5 | 0 |
| sessions | 1203 | 120 |
| system_state | 1 | 1 |
| user_events | 0 | 0 |
| users | 839 | **114** |
| verifications | 0 | 0 |
| watermark_state | 3 | 3 |

Invariant baselines, identical on both: **`drizzle.__drizzle_migrations` = 31**,
**guard catalogue = 81 rows, 0 disabled**, `system_state` = 1 row with `frozen_at` NULL.
`liquidity_policy` differs (6 vs 2) and is excluded from truncation on both.

⚠ **Production carries 114 users, 1507 bets and 1507 comments.** The ruling says all of it is
dummy. Nothing measurable in the database distinguishes a dummy participant from a real one,
so the wipe tooling must carry a predicate the operator can point at — see §B2 and OQ-2.

#### A2.1 · Every FK into `markets` — all `ON DELETE RESTRICT`

`bet_receipts · bets · comments · lots · market_media · mod_actions(target_market_id) ·
payout_events · pools · positions · resolution_events` — ten children, ten `RESTRICT`.
Combined with Bucket-A's row-level `no_delete` triggers, **per-row deletion is not merely
discouraged, it is mechanically impossible without disabling guards.** The founder's
wipe-and-restore ruling is the only method the schema admits.

#### A2.2 · Rows referencing MUM / OKT

| table | stg MUM | stg OKT | prd MUM | prd OKT |
|---|--:|--:|--:|--:|
| bets | 27 | 0 | 205 | 195 |
| comments | 27 | 0 | 205 | 195 |
| lots | 27 | 0 | 205 | 195 |
| bet_receipts | 28 | 0 | 212 | 195 |
| positions | 27 | 0 | 28 | 28 |
| pools | 1 | 1 | 1 | 1 |
| market_media | 2 | 2 | 2 | 2 |
| resolution_events | 0 | 1 | 0 | 0 |
| payout_events | 0 | 0 | 0 | 0 |
| mod_actions | 0 | 0 | 0 | 0 |
| **events (id anywhere)** | **61** | **6** | **420** | **393** |

### A2.3 · ⛔ THE ONE MEASUREMENT THAT NEEDS A FOUNDER DECISION BEFORE ANYTHING RUNS

The ruling states: *"All data on stg and prd is dummy and disposable. Nothing is live."*
Production's 114 users measure as **two cohorts, not one**:

| cohort | users | `google_id` | bets | comments | dharma rows | image uploads |
|---|--:|---|--:|--:|--:|--:|
| `@loadtest.example.com` (local parts `test…`) | **100** | — | 1 377 | 1 377 | 1 577 | 90 |
| **`@gmail.com`** | **14** | 110 of 114 rows carry one | **130** | **130** | **160** | **85** |

Signup dates: 1 on 09-13, 8 on 09-14, 1 on 09-15, 2 on 09-16, **102 on 09-17** (the load-test
batch plus two). Bets span 2026-09-15 05:18Z → 2026-09-17 17:12Z.

**110 of 114 users carry a `google_id` — i.e. they completed a real Google OAuth sign-in.**
The fourteen `gmail.com` accounts authored 130 arguments and uploaded 85 images.

That is entirely consistent with "the founder and friends, testing" — and it is *not*
distinguishable in the database from "early real participants." Bucket A is append-only and the
wipe is irreversible, so this number belongs in front of the person making the call, before the
call is acted on. **It does not block the staging leg, which is unambiguous.** It is a hard stop
in front of the production leg only. See **OQ-2** and **STOP-P0** in §B5.

---

### A3 · Users and the identity pool

| | stg | prd |
|---|--:|--:|
| `users` | 839 | **114** |
| onboarded (`tos_accepted_at` not null) | 839 | 114 |
| banned | 1 | 0 |
| distinct emails | 839 | 114 |
| first / last signup | 2026-09-07 → 2026-09-17 | 2026-09-13 → 2026-09-17 |
| `identity_pool` total | **1 940** | **19 904** |
| — unassigned | 705 | 9 793 |
| — assigned | 1 235 | **10 111** |
| distinct `(colour, animal)` pairs | **1 031** | 871 |
| distinct pseudonyms | 1 940 | 19 904 |
| distinct `pfp_filename` | 1 070 | 1 079 |

#### A3.1 · ⛔ NEITHER POOL CAN BE REGENERATED FROM THE REPOSITORY

Three independent measurements say so:

1. `generatePoolTuples(COLOURS.length * ANIMALS.length)` — the only in-repo generator —
   yields **871** tuples (`COLOURS` 13 × `ANIMALS` 67, measured by importing
   `src/server/identity-pool/vocabulary.ts`). Neither 1 940 nor 19 904 is reachable from it.
2. Staging holds **1 031 distinct `(colour, animal)` pairs against a 871-pair vocabulary** —
   it contains combinations today's `vocabulary.ts` cannot produce. The pool predates a
   vocabulary change.
3. `scripts/seed-identity-pool.ts` (the `prod` seeder) takes a **manifest CSV path argument**
   and asserts `EXPECTED_TOTAL = 50_000`. **No such manifest is tracked in the repository** —
   `git ls-files | grep -i manifest` returns only `tests/db/identity-pool/_fixtures/manifest-100.csv`
   and `manifest-malformed.csv`. Production's 19 904 matches neither 871 nor 50 000.

⇒ **`identity_pool` must be captured to a dump before the wipe and re-inserted after**, with
`assigned_at` reset to NULL. It cannot be re-derived. This is also the only way to *unassign*
an identity at all: `identity_pool` is Bucket B, its `assigned_at` transition is a one-shot
`NULL → timestamp` enforced by `bucket_b_update_check`, so truncate-and-reinsert is the only
mechanism that returns 10 111 production identities to the pool.

⚠ Production shows **10 111 assigned identities against 114 users** — a ~89× gap. Whatever
consumed them is not visible in `users`. Raised as OQ-3.

#### A3.2 · `image_uploads`

| terminal_state | stg | prd |
|---|--:|--:|
| `committed` | 85 | 141 |
| `orphan` | 0 | 34 |
| NULL (in flight) | 109 | 0 |

### A4 · The staging reset exactly as built

Source: `tests/staging/reset.staging.test.ts`, `tests/staging/_lib/{guards,reset,content-guard}.ts`.
The batch below was **generated by importing `buildResetBatch(TRUNCATE_SET)` and printing it**,
not transcribed.

#### A4.1 · The exact SQL, one `client.unsafe()` call = one implicit transaction

```sql
SET LOCAL lock_timeout = '15s';
-- 25 × DISABLE
ALTER TABLE dharma_ledger      DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE bets               DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE comments           DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE resolution_events  DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE payout_events      DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE mod_actions        DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE admin_events       DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE user_events        DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE bet_receipts       DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE events             DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE events_2026_05 … events_2027_04, events_default   -- 13 partitions
                           DISABLE TRIGGER bucket_a_no_truncate;
ALTER TABLE identity_pool      DISABLE TRIGGER bucket_b_no_truncate;
ALTER TABLE image_uploads      DISABLE TRIGGER bucket_b_no_truncate;

TRUNCATE events, dharma_ledger, bets, comments, resolution_events, payout_events,
         mod_actions, admin_events, user_events, bet_receipts, positions, lots,
         markets, pools, market_media, bookmarks, image_uploads, identity_pool,
         users, accounts, sessions, verifications CASCADE;

-- the same 25 × ENABLE
```

- `TRUNCATE_SET` = **22 tables**, in that order.
- `TRUNCATE_EXCLUSIONS` = **`system_state`, `liquidity_policy`** (a startup guard refuses if an
  excluded table ever appears in the truncate set).
- `NOT_TRUNCATED_UNRATIFIED` = `admin_sessions`, `cron_alarms`, `watermark_state`,
  `liquidity_heartbeat` — left alone, deliberately.
- `NEVER_DISABLED_GUARD_NAMES` = **`bucket_a_no_update`, `bucket_a_no_delete`,
  `bucket_b_no_delete`, `bucket_b_update_check`** — only `*_no_truncate` is ever lifted.
- ⚠ **`CASCADE`, not `RESTART IDENTITY`** — sequences (including `dharma_ledger.seq`,
  ADR-0029's total order) keep counting. Deliberate; do not "fix" it.
- `lots` is emptied by `TRUNCATE bets CASCADE` — its `lots_no_delete` trigger is row-level and
  does not fire on TRUNCATE, which is exactly why migration `0026` was written outside the
  `bucket_%` family.

#### A4.2 · The six gates, and which ones stop it reaching production

| gate | where | what it checks | **blocks prd?** |
|---|---|---|---|
| **G-1 intent** | `guards.ts:408` | `ZUGZWANG_STAGING_RESET_ACK == "wipe-staging-i-mean-it"` | no (target-agnostic) |
| **G-2 target** | `guards.ts:368` | `DATABASE_URL_STAGING` must **not** contain `PRODUCTION_PROJECT_REF` = `zbvprdcyxhlguxbostdj` | ⛔ **YES — primary** |
| | `guards.ts:388` | URL **must** contain `STAGING_PROJECT_REF_FRAGMENT` (≥16 lowercase alnum) | ⛔ **YES** |
| **G-2b env** | `guards.ts:397` | `ZUGZWANG_ENV === "staging"` (prd Doppler carries `prod`) | ⛔ **YES** |
| **G-3 live conn** | `reset.ts:66-128` | driver-resolved host carries the staging fragment; host ends `.supabase.com/.co`; `current_database()=postgres`; `session_replication_role='origin'` | ⛔ **YES** (fragment arm) |
| **G-4 post-verify** | `reset.ts:305` | 81 guard rows all enabled; `system_state` = 1 row, `frozen_at` NULL; `__drizzle_migrations` count retained | no — it verifies |
| **G-5 content** | `content-guard.ts:98` | refuses if any market slug is outside `sp-m*` / `volume-fixture-*`, unless `ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS=include-content-markets` | no |

Also: `vitest.config.ts` excludes `tests/staging/**`, so no bare `vitest run` can reach it.

**Four independent guards (G-2 ×2, G-2b, G-3) name production and refuse it.** That is why
§B2 is a *separate, one-time, unmerged* tool rather than a flag on this one: making
`pnpm staging:reset` capable of production means widening four refusals, and every one of
them is the one that has to hold for the rest of the experiment.

#### A4.3 · What runs after

`staging:reset` = `doppler --config stg -- pnpm staging:reset:exec`, and
`staging:reset:exec` = `ZUGZWANG_STAGING_RESET_ACK=… vitest run … reset.staging.test.ts && pnpm db:seed:staging`.
So the reset **already re-seeds `identity_pool`** via `scripts/seed-staging.ts` — but see
§A3.1: that seeder produces **871** rows, not staging's current 1 940.

`staging:rebuild` = `staging:reset && staging:generate && staging:gates`. **Do not run
`rebuild` here** — `generate` recreates the whole `sp-m*` fixture population, which is the
opposite of "staging ends like production: the six content markets only."

### A5 · Restoring the six through the engine

`scripts/seed-content-markets.ts` → `tests/staging/content-markets.staging.test.ts`.

| requirement | supported? | evidence |
|---|---|---|
| goes through `createMarket` / `openMarket` | ✅ | `content-markets.staging.test.ts:346,387` — imports `@/server/markets/{create,open}`, writes nothing itself; a `write-guard` test asserts zero direct writes |
| explicit market ids | ✅ | `createMarket({ marketId: spec.marketId, … })` |
| existing R2 media keys | ✅ | `spec.media` carries `{mediaId, key, displayOrder, isDefault}`; `--media` phase `HeadObject`s every key first |
| `resolution_deadline`, `media_video_url` | ✅ | passed through |
| idempotent | ✅ | swallows `MarketSlugTakenError` (create) / `MarketLifecycleStateError` (open) only |
| **per-market opening price / tank** | ❌ | **ONE** `--price` and **ONE** `--tank` for the whole run (`OPEN_PRICE`/`OPEN_TANK` are module-level) |
| **production** | ❌ | `scripts/seed-content-markets.ts:121` refuses `--env prod` **by name**, and `resolveRunnerTarget` refuses the prd ref anyway |
| **source of truth** | ⚠ | `docs/data/staging-markets-snapshot.json`, hard-asserted at **`CONTENT_MARKET_COUNT = 8`** (`content-markets.ts:50,147`) — a 6-market snapshot **throws** until this constant moves |

**The single-price limitation is not a problem**, because §A1.4 measured every production
market as having opened at the *same* `p_yes = 0.1`, tank `100000`. One invocation restores all
six faithfully.

**The production refusal is the real gap.** Two candidate paths, and the recommendation:

- **(a) The admin form (F-ADMIN-1 `/admin/markets/new` → F-ADMIN-2 pool seed).** Already exists,
  already production-capable, already the ratified way a production market is created, and it
  needs **no new tooling and no ADR widening**. Cost: six markets × (long description paste +
  two media picks + a seed), by hand, with transcription risk on ~10 KB of founder copy.
- **(b) A one-time production-scoped runner** mirroring `content-markets.staging.test.ts` with
  positive-match prd guards. Exact, scriptable, re-runnable — and it means minting a production
  path for an operational runner, i.e. exactly what ADR-0036 forbids.

⇒ **Recommended: (b), on a branch, never merged**, for the same reason the wipe itself is (b):
the wipe already requires a production-scoped one-time tool under a patch record, and adding
the restore to that same tool costs one more refusal-widening in a document that is already
being written — whereas (a) puts 10 KB of founder-authored copy through a manual paste on the
production surface, which is the single highest-consequence transcription risk in this plan.
See OQ-4.

### A6 · R2 — object storage

Bucket names, read from Doppler (`R2_BUCKET_*`):

| arm | stg bucket | prd bucket | **shared?** |
|---|---|---|---|
| market media | `zugzwang-market-media` | `zugzwang-market-media` | ⛔ **YES — ONE BUCKET** |
| participant uploads | `zugzwang-staging-uploads` | `zugzwang-uploads` | no |
| PFP | `zugzwang-staging-pfp` | `zugzwang-pfp` | no |

#### A6.1 · ⛔ THE MARKET-MEDIA BUCKET IS SHARED BY BOTH ENVIRONMENTS

Listed with both credential sets: **both return the identical 54 objects / 5 265 984 bytes
across 38 `m/<marketId>/` prefixes**, including every staging market id *and* every production
market id. The prd credentials can see and delete staging's media and vice versa.

⇒ **Never scope an R2 delete by bucket. Scope it by `m/<marketId>/` prefix, with the id list
read from that environment's own database.** A "empty the market-media bucket" step written
for production would destroy staging's media in the same call.

Key layouts measured:

- market media — `m/<marketId>/<mediaId>.<png|webp>` (2 objects per content market)
- participant uploads — `u/…` (stg 386 objects / 194 320 689 B; prd 141 objects / 13 748 557 B)
- PFP — stg `v1/`, `v2/`, `v1-pre-pfp2/` at 1 079 objects each (3 237 total);
  prd `v1/` only, 1 079 objects / 6 204 674 B

#### A6.2 · The eight objects this task deletes

| env | prefix | objects |
|---|---|--:|
| stg | `m/01a01181-bb3c-7443-bc4d-35938c65bde9/` (MUM) | 2 |
| stg | `m/01a01181-c07c-765a-9664-c065540c173d/` (OKT) | 2 |
| prd | `m/01a0a0bb-4e2f-722e-96d4-62139198223a/` (MUM) | 2 |
| prd | `m/01a0a0bb-7352-74be-849e-d267b8c074b3/` (OKT) | 2 |

⚠ **22 of the 38 market prefixes belong to no market in either database** (ids `01a01131-*`,
`01a01132-*`, `01a0117d-*`, `01a062f0-*`, `01a0a370-*`) — debris from earlier lanes. They are
out of scope here but they are the reason a prefix-scoped delete is the only safe shape.

⚠ **Participant uploads are NOT swept by truncation.** `/api/cron/r2-orphan-sweep` deletes R2
objects by reading `image_uploads` rows. Truncating that table removes the sweeper's entire
worklist, so **every `u/…` object becomes permanently unreachable debris.** The R2 delete must
therefore happen **from a key list captured BEFORE the truncate**, or by listing the `u/`
prefix directly after it. This is the single easiest step to get wrong.

### A7 · Caches

#### A7.1 · Upstash Redis — ⛔ ONE DATABASE, SHARED BY BOTH ENVIRONMENTS

```
stg  UPSTASH_REDIS_REST_URL host = equal-lemming-124923.upstash.io   token md5 41624b52…
prd  UPSTASH_REDIS_REST_URL host = equal-lemming-124923.upstash.io   token md5 41624b52…
```

Same host **and the same token** — it is literally one database with one credential.
Separation is by key prefix only: `src/server/upstash/keys.ts` builds every key as
`<env>:<…>` with `env ∈ {prod, staging, preview}` and throws otherwise.

Namespaces in use (measured from the call sites): `ratelimit:*`, `idem:*`, `mod-reserve:*`,
`cron-lock:*`, `cache:*`, `cache-metric:*`.

⇒ **`FLUSHDB` is forbidden.** An env-scoped purge is `SCAN MATCH 'prod:*'` → `DEL`, and the
same run must not touch `staging:*` or `preview:*`.

#### A7.2 · Next.js / Vercel caches

`next.config.ts` sets **`cacheComponents: true`** (PPR on). Cache tags in use are exactly two
shapes — `discovery` and `market:<id>` — set by `cacheTag(...)` in `discovery/list.ts:142,237`,
`discovery/cached-series.ts:132`, `debate-view/cached-view.ts:108`, and invalidated by
`revalidateTag("discovery", {expire:0})` in `markets/open.ts:272`, `markets/close.ts:108`,
`admin/markets/void.ts:68` and `updateTag(\`market:…\`)` in `admin/moderation/act.ts:146`.

⛔ **A raw-SQL wipe fires none of those.** Every invalidation seam is application code.

#### A7.3 · The CDN is holding the page right now — measured

```
$ curl -sI https://zugzwangworld.com/m/oktoberfest-munich-beer-volume
x-vercel-cache: HIT
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
age: 40811                      # ≈ 11 h 20 m old
cache-control: public, max-age=0, must-revalidate
```

The market-detail page is a prerendered shell served from the edge. After the row is gone the
cached shell can still be served. ⇒ every 404 proof must bypass the cache (unique query
string), and a purge/redeploy is a required step, not a nicety.

### A8 · pg_cron

Four active jobs per environment (job **ids differ**, names match):

| jobname | schedule | command | writes during/after a wipe |
|---|---|---|---|
| `identity-pool-watermark` | `*/5 * * * *` | `check_identity_pool_watermark()` | ⚠ will alarm into `cron_alarms` while the pool is empty |
| `nightly-drift` | `0 3 * * *` | `check_nightly_drift()` | reads; harmless |
| `liquidity-injector` | `* * * * *` | `run_liquidity_injection()` | ⛔ **every minute**: `SELECT … FROM markets WHERE status='Open' FOR NO KEY UPDATE`, `UPDATE pools`, `INSERT INTO events`, `INSERT INTO liquidity_heartbeat` |
| `liquidity-alarms` | `*/5 * * * *` | `check_liquidity_alarms()` | may `INSERT INTO cron_alarms` |

Run history is healthy on both (stg: 32 260 / 15 090 / 3 033 successes and 1 failure apiece on
jobs 1 and 5 dated 2026-09-08; prd: 23 790 / 6 980 / 1 396, zero failures).

**Consequence for the wipe.** The injector takes row locks on `markets`/`pools` and inserts
into `events` — all three are in `TRUNCATE_SET`, which needs `ACCESS EXCLUSIVE`. Our batch sets
`lock_timeout = 15s`. A collision aborts the batch, which **rolls back atomically** (guards
re-enabled by the rollback), so the failure is safe but wasteful. ⇒ **Unschedule or deactivate
the four jobs before the wipe and restore them after** — and note that `liquidity_policy` is
in `TRUNCATE_EXCLUSIONS` precisely so the injector does not silently read no policy afterwards.

After the wipe and before the restore there are zero `Open` markets, so the injector is a
no-op that still writes a heartbeat row. After the restore it resumes against six.

Vercel crons (`vercel.json`, measured): `/api/cron/r2-orphan-sweep` `0 */6 * * *`,
`/api/cron/close-due-markets` `* * * * *`, `/api/cron/alarms-drain` `*/5 * * * *`.

### A9 · Every MUM/OKT reference in code

Sweep (`git grep -l -i -E 'mumbai-bmc-pink-october|oktoberfest-munich-beer|MKT-MUM-01|MKT-OKT-01|mybmc|oktoberfest\.de|Pink October|pink-october|oktoberfest'`)
returns **22 files**: **13 outside `docs/`**, 9 inside.

#### A9.1 · `src/` — 6 files

| file | symbol | what to do |
|---|---|---|
| `src/components/debate/resolution-block-data.ts` | `KNOWN_SLUGS` (`:192-201`) | drop the 2 slugs → 6 |
| | `RESOLUTION_BLOCKS` (`:240-255`, `:256-296`) | drop both entries |
| | `OKTOBERFEST_CLOSES` (`:232`) | **delete — becomes dead**; it exists only for OKT's 4 Oct deadline |
| | `FLAVOUR_NAMES` (`:164-173`) | drop `"Pressure"` (MUM) and `"Consumption"` (OKT) → 6. Flavours are 1:1 with slugs: Petition/Sentiment/Innovation/Feedback/Showcase/Callout survive |
| | `getResolutionBlocks` throw text (`:459`) | says "exactly the eight known markets" → six |
| `src/components/debate/resolution-block-glyphs.ts` | `MARKET_GLYPHS` (`:55-56`) | drop 2 rows. ⚠ `response-on-x.png` is **kept** — 4 survivors still use it |
| | `FLAVOUR_GLYPHS` | drop `Pressure`/`Consumption` (forced by the `Record<FlavourName,…>` narrowing) |
| `src/components/debate/title-size-overrides.ts` | `MARKET_TITLE_SIZE_OVERRIDES` (`:105`) | MUM is the **only** entry → the map becomes `{}`. Keep the export (typed `Record<string, string|undefined>`, absent slug ⇒ `undefined` ⇒ default `text-[21px]`) |
| `src/components/debate/ResolverCards.tsx` | docblocks `:300`, `:430` | prose only: `@mybmc` is the worked a11y example → re-example off a survivor |
| `src/components/debate/phone/PhoneResolverRows.tsx` | docblock `:93-94` | prose only: sample hrefs list |
| `src/components/profile/PositionsTable.tsx` | docblock `:77-78` | prose only: the tag list "`Mumbai ·`, `Oktoberfest ·`, …" |

⚠ **`resolution-block-data.ts` also carries ~40 lines of BLOCK-1…BLOCK-4 commentary about
oktoberfest's font sizes and sentence case.** Deleting the data entry orphans the prose. This
is an **O-9 same-commit trigger**: several of those comments cite `SPEC.1 §…` and `design-canon
§…`, so rewriting them is applying-or-contradicting those documents.

#### A9.2 · `public/` — 3 assets orphaned of 13

`ls public/brand/blocks/` → 13 files. After the removal:

| asset | used by | verdict |
|---|---|---|
| `oktoberfest.png` | OKT only | **delete** |
| `pressure.png` | flavour `Pressure` = MUM only | **delete** |
| `consumption.png` | flavour `Consumption` = OKT only | **delete** |
| `response-on-x.png` | MUM + chess + math + claude + yc | ⛔ **KEEP** |
| the other 9 | survivors | keep |

⇒ `ALL_GLYPH_FILES` 13 → 10.

#### A9.3 · `tests/` — 7 files

| file | assertion | change |
|---|---|---|
| `tests/unit/debate/resolution-block-data.test.ts` | slug list `:11-12`; `stagingSnapshot.markets.length` `:111`; `@mybmc` block `:132`; oktoberfest blocks `:144-185`, `:246-258`; flavour map `:313-314` | drop the two markets; 8 → 6 |
| `tests/unit/debate/resolution-block-glyphs.test.ts` | `ALL_GLYPH_FILES` **13** (`:127,128,247`); `slugs` **8** (`:278`) | 13 → 10, 8 → 6 |
| `tests/unit/debate/render/resolver-cards.test.tsx` | G3 oktoberfest test `:298-310`; sentence-case test `:724-747`; `slugs` 8 `:971` | **G3 and the sentence-case test lose their subject.** The lowercase-`o` guard exists because `oktoberfest.de` is the only value a CSS `capitalize` would corrupt — ⚠ re-home it onto `coinmarketcap.com`'s href/`CoinMarketCap`, or state in the PR that the guard is retired with its data |
| `tests/unit/debate/render/title-size-override.test.tsx` | `OVERRIDDEN_SLUG = "mumbai-…"` `:51`, title `:58` | **the whole file's subject is MUM.** Either delete the file or rewrite it to assert the map is empty and the default still renders |
| `tests/unit/config/chart-window.test.ts` | `slate.length` 8 `:138`; `genesis.length` 8 `:315`; **clipped `toBe(8)` `:364`**; `snap.markets.length` 8 `:379` | see §A10.1 — the hard one |
| `tests/unit/staging/content-markets-source.test.ts` | description-length map `:206-207` (MUM 2990, OKT 3939) | drop 2 keys |
| `tests/unit/staging/content-market-reset-guard.test.ts` | content-slug fixtures `:34,67,69,108,109` | drop 2 |

#### A9.4 · `docs/` — 9 files, left untouched per the ruling

`docs/data/staging-markets-snapshot.json` · `docs/data/staging-markets-snapshot.md` ·
`docs/design/mockups/surface_d5_v1_0.html` · `docs/markets/MKT-MUM-01.md` ·
`docs/markets/MKT-OKT-01.md` · `docs/parked.md` · `docs/plans/MOBILE-2l.md` ·
`docs/records/SURFACES-record.md` · `docs/specs/SPEC.1.md`

⛔ **ONE OF THEM IS NOT A DOC.** `docs/data/staging-markets-snapshot.json` is **loaded at
runtime** by `tests/staging/content-markets.ts:45` and by `chart-window.test.ts`. It is the
seeder's source of truth and its 8-market length is asserted in three places. **It must be
regenerated to six**, notwithstanding its path — the ruling's "leave docs/ untouched" cannot
have meant the file the restore reads. Raised as OQ-5.

#### A9.5 · PR #435 — hits reported, nothing touched

`gh pr view 435` → **OPEN**, `feat/dataset-1-export-pipeline` → `main`, unmerged,
titled *"DATASET.1 — public dataset export pipeline + shared egress guard layer ⛔ LEAVE UNMERGED"*.
`git grep` on `origin/feat/dataset-1-export-pipeline` finds MUM/OKT in the **same two source
files** (`resolution-block-data.ts`, `ResolverCards.tsx`) at **different line numbers** (its
`KNOWN_SLUGS` is at `:157-158`, `OKTOBERFEST_CLOSES` at `:196`), plus 4 `docs/` files.

⇒ **The permanent PR will conflict with #435 in `resolution-block-data.ts`.** Reported only;
this task touches nothing on that branch. (Per CLAUDE.md §5.13.2 the `⛔ LEAVE UNMERGED` in its
title is a retired marker and is *not* a standing prohibition — it says nothing about whether
that branch may land.)

### A10 · What assumes eight, and what actually breaks at six

#### A10.1 · ⛔ THE ONE THAT BREAKS FOR A REASON NOBODY WOULD PREDICT

`tests/unit/config/chart-window.test.ts:352-368` — *"REDS on the PRODUCTION window — the
control that proves the guard can fire"*:

```ts
const clipped = stagingGenesisInstants().filter(g => xPx(g.at, prodStartMs, endMs) < 0);
expect(clipped.length, "production's window must clip all eight staging genesis points").toBe(8);
```

`stagingGenesisInstants()` is a **hardcoded list of eight 2026-09-07T20:19:2x instants**,
measured off the live staging DB on 2026-09-11. Production's window starts
`2026-09-15T00:00:00.000Z` (`limits.ts:442-444`), so all eight currently clip and the control
reads 8.

**After the staging wipe the genesis instants become ~2026-09-18 — AFTER production's start —
so NOTHING clips and the control goes to 0 and REDs.** Not because six is wrong, but because
the restore moves the data the positive control is built on. Its own docblock warns
*"Re-measure after any reset that recreates the markets."*

⇒ The execute PR must re-measure the six genesis instants after the staging restore, and
**re-base the positive control on a window that genuinely clips** (a synthetic `start` after
the new instants), or the control silently stops controlling — which that same docblock calls
out as *"worse than none."*

⚠ **The mirror image is a free win.** Production's markets were created `2026-09-14 16:23`,
which is **before** production's own window start of `2026-09-15`. Production charts today
clip their own genesis point. Restoring on/after 2026-09-18 puts every genesis inside the
production axis for the first time.

#### A10.2 · Assumes eight and must move

| site | current | after |
|---|---|---|
| `tests/staging/content-markets.ts:50` `CONTENT_MARKET_COUNT` | `8` (throws at `:147`) | `6` |
| `docs/data/staging-markets-snapshot.json` | 8 markets, 16 media rows | 6 / 12 |
| `resolution-block-data.ts` `KNOWN_SLUGS`, `FLAVOUR_NAMES` | 8 / 8 | 6 / 6 |
| `resolution-block-glyphs.ts` `MARKET_GLYPHS`, `FLAVOUR_GLYPHS` | 8 / 8 | 6 / 6 |
| `ALL_GLYPH_FILES` + `public/brand/blocks/` | 13 | 10 |
| the seven test assertions in §A9.3 | 8 / 13 | 6 / 10 |

#### A10.3 · Looks like eight, is NOT affected — do not "fix" these

- **`DISCOVERY_GRID_SIZE = 8`** (`limits.ts:268`) is a **cap**, consumed as `.limit(8)` in
  `discovery/list.ts:94,149`. Six markets render six tiles. `tests/server/discovery/list.test.ts`
  seeds its own 10 and 3 market fixtures and is untouched. (Layout for six tiles is explicitly
  out of scope per the ruling.)
- **`tests/unit/discovery/render/carousel.test.tsx:625,707`** — `views(8)` is a synthetic
  fixture factory, unrelated to the content slate.
- `tests/unit/art/composition.test.tsx`, `wobble.test.ts`, `dharma/ledger.test.ts`,
  `markets/transitions.test.ts`, `shell/countdown-format.test.ts`, `collision-band.test.tsx`,
  `debate-export/image-fetch.test.ts` — all have their own unrelated eights.

#### A10.4 · ⛔ What does NOT break, and it decides the deploy order

`getResolutionBlocks(slug)` **throws** for an unknown slug — but **both callers catch it**:

- `ResolverCards.tsx:116-124` — `try { … } catch { captureException(error); return null; }`
- `PhoneResolverRows.tsx:59-66` — identical posture
- `debate-export/image/compose.ts:306` — guarded by `isKnownMarketSlug()` instead

Both docblocks record that this was a joint `@code-reviewer` / `@security-auditor` finding
precisely because an uncaught throw took the whole `/m/[slug]` route down.

⇒ **Shipping the six-market code while MUM/OKT rows still exist degrades exactly one row of
one panel on two pages and captures to Sentry. It does not 500 and it does not blank a page.**
That is what makes **code-before-wipe** safe — see §B3.

And the converse: **wipe-before-code leaves `RESOLUTION_BLOCKS` holding two slugs no market
has, which is inert** (a lookup nobody performs). Both orders are survivable; §B3 picks on a
different criterion.

### A11 · Deploy flow, measured from the live Vercel project (not from the runbook)

```
project   experiment   prj_5krm0VEQQ9TleA2rjUBIL3oLJpiI   team zugzwang-worlds-projects
link.productionBranch            = main
customEnvironments               = [("staging", preview, branchMatcher equals "staging")]
autoAssignCustomDomains          = False      ← the load-bearing one
commandForIgnoringBuildStep      = build only main | staging | verify |
                                   fix/pool-transaction-mode | feat/*
```

Live targets at measurement time:

| target | branch | sha | state |
|---|---|---|---|
| production | `main` | `25d5df3e` | READY |
| `staging` custom env | `staging` | `6a50d7bb` | READY |

Domains: `zugzwangworld.com`, `www…` (redirect), `staging.zugzwangworld.com`,
`experiment-two-iota.vercel.app`.

Live health:

```
https://zugzwangworld.com/api/health          {status:ok, env:prod,    canary:25d5df3e…, region:bom1, migrations:ok}
https://staging.zugzwangworld.com/api/health  {status:ok, env:staging, canary:6a50d7bb…, region:bom1, migrations:ok, db:ok}
```

⇒ **Answer to "is merging to main the prd deploy?" — NO.** `autoAssignCustomDomains` is
`False`, so a merge to `main` *builds and stages* a production deployment; the domain keeps
serving the previous one until an explicit `vercel promote … --scope zugzwang-worlds-projects`.
Pushing `staging` auto-deploys the staging custom environment and fires `staging-migrate.yml`.

⚠ Production is currently serving `25d5df3e`, which **is** `origin/main` — prod and main agree
today. (Any older note that prod is pinned to a July build is stale.)

### A12 · Backups

- **Local `pg_dump` is feasible on both environments — measured, not assumed.** `pg_dump 18.3`
  against the 17.6 servers, through the session pooler:
  - `pg_dump --schema-only --no-owner --no-acl -n public` on stg → 103 923 bytes, clean exit.
  - `pg_dump --data-only -t public.markets` on prd → 17 606 bytes, clean exit.
  Both `--schema-only` and `--data-only` work through Supavisor. Full-database dumps are
  therefore available as the rollback of last resort.
- ⚠ **Supabase automatic-backup / PITR status is NOT ESTABLISHED (O-13).** `supabase projects
  list` returned *"Access token not provided"*, and this session holds no `SUPABASE_ACCESS_TOKEN`.
  A failed read is not a finding. To establish it, the operator runs
  `! supabase login` then `supabase backups list --project-ref zbvprdcyxhlguxbostdj`
  (and `… rwfdoqzsghqhhdapxafg`). **Do not start the production leg until this is read.**

## §B · THE RUNBOOK

Written for a fresh execute session. Read §A first; every figure below is measured above.

### B0 · Shape of the work

Three artifacts, in this order:

1. **PR-1 (permanent, merges to `main`)** — remove MUM/OKT from code, tooling, tests and
   assets; regenerate both snapshots to six. §B1.
2. **PR-2 (one-time, opened for review, closed UNMERGED after use, never on `main`)** — the
   production wipe + production restore tooling. §B2.
3. **Execution** — staging leg complete and proven, then production leg. §B3–B4.

Staging uses the shipped `pnpm staging:reset` **unchanged**; only production needs new tooling.

### B1 · PR-1 — the permanent change

Branch `feat/mkt-roster-1-six-market-slate`. Critical path? **No** — none of the seven §1 areas
is touched (`src/components/**`, `tests/**`, `public/**`, `docs/data/**` only; no schema, no
migration, no `src/server/` change). `just verify` + full `pnpm vitest run` is the gate;
§5.10's pre-PR audit is not triggered, and §5.11's reviewers are scoped in §B6.

| file | intent |
|---|---|
| `src/components/debate/resolution-block-data.ts` | drop 2 from `KNOWN_SLUGS`; drop 2 `RESOLUTION_BLOCKS` entries; **delete `OKTOBERFEST_CLOSES`** (dead); drop `Pressure`/`Consumption` from `FLAVOUR_NAMES`; fix the `getResolutionBlocks` throw text "eight"→"six"; rewrite the BLOCK-1…4 docblocks that cite oktoberfest's font sizes and sentence case — **O-9 rider: several cite `SPEC.1 §…` / design-canon §…, so read those at HEAD before editing** |
| `src/components/debate/resolution-block-glyphs.ts` | drop 2 `MARKET_GLYPHS` rows and 2 `FLAVOUR_GLYPHS` rows; update the "`response-on-x.png` serves five of the eight" docblock — it now serves **four of six** |
| `src/components/debate/title-size-overrides.ts` | `MARKET_TITLE_SIZE_OVERRIDES` becomes `{}`; **keep the export and its `\| undefined` typing** — `MarketHeader.tsx:464` still indexes it and the default `text-[21px]` is the correct render |
| `src/components/debate/ResolverCards.tsx` | docblocks `:300`, `:430` — re-example the a11y accessible-name walkthrough off a surviving market |
| `src/components/debate/phone/PhoneResolverRows.tsx` | docblock `:93-94` — drop the two sample hrefs |
| `src/components/profile/PositionsTable.tsx` | docblock `:77-78` — the tag list loses `Mumbai ·` and `Oktoberfest ·` |
| `public/brand/blocks/oktoberfest.png` | **delete** |
| `public/brand/blocks/pressure.png` | **delete** (flavour `Pressure` was MUM's alone) |
| `public/brand/blocks/consumption.png` | **delete** (flavour `Consumption` was OKT's alone) |
| ⛔ `public/brand/blocks/response-on-x.png` | **KEEP** — four survivors use it |
| `tests/staging/content-markets.ts` | `CONTENT_MARKET_COUNT` 8 → 6 |
| `docs/data/staging-markets-snapshot.json` | regenerate to **six** markets / twelve `market_media` rows, from the live staging DB (§B3 step 2) |
| `docs/data/staging-markets-snapshot.md` | regenerate alongside it |
| **`docs/data/prod-markets-snapshot.json`** | **NEW** — production's own six, captured the same way. ⚠ deviation, see OQ-5 |
| `tests/unit/debate/resolution-block-data.test.ts` | 8 → 6 everywhere; drop the `@mybmc` and oktoberfest blocks and the two flavour-map rows |
| `tests/unit/debate/resolution-block-glyphs.test.ts` | `ALL_GLYPH_FILES` 13 → 10; `slugs` 8 → 6 |
| `tests/unit/debate/render/resolver-cards.test.tsx` | delete the G3 oktoberfest test and the sentence-case test **or** re-home the lowercase guard onto `coinmarketcap.com`; `slugs` 8 → 6 |
| `tests/unit/debate/render/title-size-override.test.tsx` | subject is MUM — rewrite to assert the map is empty and the default renders, or delete the file and say which in the PR body |
| `tests/unit/config/chart-window.test.ts` | 8 → 6 in four places **and re-base the positive control** — §A10.1, the hard one |
| `tests/unit/staging/content-markets-source.test.ts` | drop the 2 description-length keys |
| `tests/unit/staging/content-market-reset-guard.test.ts` | drop 2 from the content-slug fixtures |

**Not touched:** the nine `docs/` files in §A9.4 other than the two data snapshots; the v3.0
market edits; the Discovery six-tile layout; `docs/records/**`.

⚠ **`chart-window.test.ts` cannot be finished until after the staging restore**, because it
pins measured genesis instants. Sequence inside the PR: land everything else, run the staging
leg, then amend the genesis list and the control in the same PR before merge. This is the one
place the code PR and the data work interleave.

### B2 · PR-2 — the one-time production wipe (branch only, never merged)

Branch `chore/mkt-roster-1-prod-wipe-ONE-TIME`. Opened as a PR **for review only**; after the
run it is closed unmerged and the branch deleted. Nothing in it may import from, or edit,
`tests/staging/_lib/**` — those files are the shipped staging guards and must stay exactly as
they are.

#### B2.1 · psql, not a Vitest runner — and why

**Recommendation: plain SQL through `psql -1 -f`, with the batch GENERATED rather than retyped.**

- The Vitest path's value is its five guards, and **four of them are the production refusal**
  (§A4.2). Re-pointing that runner at production means editing `guards.ts` / `target.ts` —
  the exact files whose job is to make this impossible — on a branch that must never merge.
  One bad rebase and the refusal is gone from `main`.
- Exactness is not a reason to prefer the runner, because the batch is *derivable*: a
  read-only import of `buildResetBatch(TRUNCATE_SET)` prints the 51 statements verbatim (this
  session did exactly that; §A4.1 is its output). Generate to a `.sql` file, diff it against
  §A4.1, run it with psql. **Zero transcription.**
- `psql -1 -f batch.sql` wraps the file in one transaction, which is what `SET LOCAL
  lock_timeout` needs and what makes an abort a clean rollback.

```sh
# generate — read-only import, no edit to any tracked file
pnpm exec tsx scripts/_onetime/print-reset-batch.ts > /tmp/prod-wipe.sql
diff <(cat /tmp/prod-wipe.sql) docs/…/expected-batch.sql   # must be empty
```

#### B2.2 · Guards — positive-match production, replacing G-1..G-3

| | staging gate | production replacement |
|---|---|---|
| G-1 | `ZUGZWANG_STAGING_RESET_ACK=wipe-staging-i-mean-it` | **new one-shot token**, below |
| G-2 | URL must **not** contain `zbvprdcyxhlguxbostdj` | URL **MUST** contain `zbvprdcyxhlguxbostdj` **and MUST NOT** contain `rwfdoqzsghqhhdapxafg` (staging's ref) — both directions, so a mis-set Doppler config fails either way |
| G-2b | `ZUGZWANG_ENV === "staging"` | `ZUGZWANG_ENV === "prod"` |
| G-3 | live conn carries the staging fragment | live conn carries the **prd** fragment; host ends `.supabase.com`; `current_database()='postgres'`; `session_replication_role='origin'` |
| G-4 | post-verify | ⛔ **KEPT VERBATIM** — 81 guard rows all `tgenabled='O'`; `system_state` exactly 1 row with `frozen_at` NULL; `__drizzle_migrations` still 31 |
| G-5 | content-market refusal | **inverted**: refuse unless the market set is *exactly* the eight measured slugs |

**The one-shot confirmation token (proposed).** Not a constant — a value that cannot be reused
tomorrow and cannot be copy-pasted from this document:

```
ZUGZWANG_PROD_WIPE_ACK = "wipe-prod-<YYYY-MM-DD>-<lower 12 hex of the prd markets-table content hash>"
```

where the hash half is printed by the pre-flight itself (`md5` over
`SELECT id||slug||status FROM markets ORDER BY slug`). The operator reads the pre-flight output
and types the token back. It therefore proves: the right day, and *the database the operator
just looked at* — so it goes stale the instant anything changes, including a new signup.

**The real-participant predicate (proposed).** Refuses once production carries anyone the
operator has not explicitly acknowledged:

```sql
-- pre-flight; the run REFUSES unless all three hold
SELECT count(*) = 114                                   AS users_count_pinned,
       max(created_at) = TIMESTAMPTZ '2026-09-17 10:59:56.733+00' AS newest_user_pinned,
       count(*) FILTER (WHERE email NOT LIKE '%@loadtest.example.com') = 14 AS human_cohort_pinned
FROM users;
```

All three are §A2/§A2.3 measurements. **Any new signup between planning and execution moves at
least one of them and stops the run** — which is precisely the event that should stop it. The
operator re-ratifies with fresh numbers, or aborts. Pin the numbers at execute time, not from
this document.

#### B2.3 · Scope of guard-lifting

- ⛔ **Only `bucket_a_no_truncate` and `bucket_b_no_truncate` are disabled** — the 25 pairs in
  §A4.1, inside the single transaction, re-enabled in the same transaction.
- ⛔ **`bucket_a_no_update`, `bucket_a_no_delete`, `bucket_b_no_delete`, `bucket_b_update_check`
  are NEVER touched.** `lots_no_delete` likewise — it is deliberately outside the `bucket_%`
  family and `TRUNCATE bets CASCADE` empties `lots` without it firing.
- Exclusions: `drizzle.__drizzle_migrations` (different schema — not reachable by the batch at
  all), `system_state`, `liquidity_policy`, plus everything the staging reset already leaves
  alone: `admin_sessions`, `cron_alarms`, `watermark_state`, `liquidity_heartbeat`.

#### B2.4 · The production restore tool

Same branch. A mirror of `tests/staging/content-markets.staging.test.ts` that drives
`createMarket` / `openMarket` against production, reading `docs/data/prod-markets-snapshot.json`,
with the B2.2 guards. Parameters from §A1.4: `--price 0.1 --tank 100000`, uniform, all six.
It must reuse the **original production market ids and media keys** so the twelve surviving R2
objects stay addressable with no copy step.

### B3 · Order of operations

#### B3.1 · The deploy-vs-wipe decision, justified from §A10.4

**Deploy the code FIRST, then wipe.** Three measured reasons:

1. **The six-market code is safe against eight-market data.** `getResolutionBlocks` throws for
   an unknown slug, but `ResolverCards.tsx:116-124` and `PhoneResolverRows.tsx:59-66` both
   catch, `captureException`, and `return null`. MUM/OKT keep rendering; they lose one
   four-cell panel and emit a Sentry event. No 500, no blank page.
2. **The reverse order has a worse window.** Wipe-first means live production serves a
   Discovery list and CDN-cached `/m/…` shells for two markets whose rows are gone — 404s and
   a stale grid — for as long as the cache holds (measured `age: 40811`, §A7.3).
3. **The restore *requires* the new code to exist.** The seeder reads
   `docs/data/*-markets-snapshot.json`, whose six-market form is part of PR-1, and
   `CONTENT_MARKET_COUNT` throws at 8. Restoring before PR-1 lands would recreate MUM and OKT.

⇒ **PR-1 merge → deploy → wipe → restore.** The transitional state (six-market code, eight
markets in the DB) is a degraded row on two pages, for minutes.

⚠ **Do not regenerate staging fixtures.** `pnpm staging:rebuild` would re-run
`staging:generate` and rebuild the whole `sp-m*` population — the opposite of the ruling.
On gates: `pnpm staging:gates` is read-only, but gates 4 (coverage) and 1 (event parity) are
written against the generated fixture population and **will fail against a six-market,
zero-participant staging**. Report them as expected-red rather than chasing them; §B4 proves
the same properties directly instead.

#### B3.2 · Staging leg — complete and proven before production starts

| # | step | command / note | stop-point |
|--:|---|---|---|
| 0 | read Supabase backup status | `! supabase login`; `supabase backups list --project-ref rwfdoqzsghqhhdapxafg` | §A12 — NOT ESTABLISHED today |
| 1 | **local backup** | `pg_dump "$DATABASE_URL_STAGING" -Fc --no-owner -f ~/zz-backups/stg-<ts>.dump` — verify with `pg_restore -l` and record the byte count | **S1** |
| 2 | **snapshot the six + the pool** | regenerate `docs/data/staging-markets-snapshot.json` (6 markets, 12 media) from the live DB; separately dump `identity_pool` as `(colour, animal, number, pseudonym, pfp_filename)` with `assigned_at` **NULL** — §A3.1, it cannot be regenerated | **S2** |
| 3 | **capture the R2 upload key list** | list `u/` in `zugzwang-staging-uploads` to a file **now** — after step 6 the sweeper's worklist is gone (§A6.2) | **S3** |
| 4 | merge PR-1 → `main`, then `main` → `staging`, push `staging` | ⚠ **push `staging` BEFORE any branch carrying the same SHA** (O-10); wait for `staging-migrate` green and `/api/health` `canary` == the new SHA | **S4** |
| 5 | **pause pg_cron** | deactivate the four jobs (§A8) — the injector writes to `markets`/`pools`/`events` every minute and can abort the batch on `lock_timeout` | **S5** |
| 6 | **wipe** | `pnpm staging:reset` **unchanged**, with `ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS=include-content-markets`. ⚠ It will name **eleven** slugs, not eight (§A1.5) — the three `concurrency-test-*` / `seed-1-test-*` markets are expected and are also being destroyed | **S6** |
| 7 | **re-seed `identity_pool`** | the reset already chains `db:seed:staging`, but that inserts **871** rows, not 1 940. Restore the step-2 dump instead, or accept 871 and say so | **S7** |
| 8 | **restore the six** | `pnpm exec tsx scripts/seed-content-markets.ts --env staging --create` then `--open --price 0.1 --tank 100000` then `--media` | **S8** |
| 9 | **delete R2** | MUM/OKT prefixes (§A6.2) + every `u/` key from step 3. ⛔ **prefix-scoped, never bucket-scoped** — `zugzwang-market-media` is shared with production (§A6.1). ⛔ **Never touch `zugzwang-staging-pfp`** | **S9** |
| 10 | **restore pg_cron** | re-activate the four jobs; confirm a heartbeat row lands | |
| 11 | **purge caches** | Upstash `SCAN MATCH 'staging:*'` → `DEL` (⛔ never `FLUSHDB`, §A7.1); purge the Vercel data cache / redeploy so `discovery` and `market:*` tags are dropped (§A7.2) | **S10** |
| 12 | **proof** | §B4, entire | **S11** |
| 13 | amend `chart-window.test.ts` | re-measure the six genesis instants; re-base the positive control (§A10.1); push to PR-1 | |

#### B3.3 · Production leg — only after the staging leg is signed off

Same sequence with four substitutions, and one addition at the front:

- **step −1 · STOP-P0** — §A2.3 ratified in writing by the founder (the 14 `gmail.com`
  accounts and their 130 arguments / 85 uploads).
- step 4 — no `staging` push; instead **`vercel promote <deployment> --scope
  zugzwang-worlds-projects`**, because `autoAssignCustomDomains = False` means the merge to
  `main` only *staged* production (§A11). Confirm `https://zugzwangworld.com/api/health`
  `canary` == the new SHA **before** the wipe.
- step 6 — the PR-2 psql batch, not `pnpm staging:reset`.
- step 8 — the PR-2 production restore tool (§B2.4), `--price 0.1 --tank 100000`.
- step 9 — prd prefixes, `zugzwang-uploads`, ⛔ never `zugzwang-pfp`.
- step 11 — Upstash `SCAN MATCH 'prod:*'`.
- step 14 — **delete both local `pg_dump` backups** once both environments pass §B4, and say so
  explicitly in the close-out.

### B4 · PROOF — exact queries and commands, run on both environments

**P1 · Zero rows matching MUM/OKT anywhere, in every text and jsonb column.** Not a
hand-written column list — generated from the catalogue so a column added later cannot hide:

```sql
BEGIN READ ONLY;
-- every text-ish / jsonb column in public, searched for either slug, either title fragment,
-- and both this environment's own ids (substitute the ids measured for THIS env)
SELECT c.table_name, c.column_name, x.n
FROM information_schema.columns c
CROSS JOIN LATERAL (
  SELECT (xpath('/row/c/text()', query_to_xml(format(
     'SELECT count(*) AS c FROM public.%I WHERE %I::text ~* %L',
     c.table_name, c.column_name,
     'mumbai-bmc-pink-october|oktoberfest-munich-beer|Pink October|Oktoberfest|mybmc|<MUM_ID>|<OKT_ID>'
  ), false, true, '')))[1]::text::bigint AS n
) x
WHERE c.table_schema='public'
  AND c.data_type IN ('text','character varying','jsonb','uuid')
  AND x.n > 0;
COMMIT;
-- EXPECT: 0 rows.
```

**P2 · The six are intact and correct.**

```sql
BEGIN READ ONLY;
SELECT slug, status, length(title) t_len, md5(title) t_md5,
       length(description) d_len, md5(description) d_md5,
       resolution_deadline, media_video_url
FROM markets ORDER BY slug;
-- EXPECT exactly 6 rows, status Open, and t_md5/d_md5 byte-equal to the step-2 snapshot.
-- prd reference (measured 2026-09-18): bitcoin 57/30dee0dd… 2457/cb6336ff… ·
--   chess 54/f4e54331… 1616/68e4574d… · claude 61/e890d44e… 1987/f075a88c… ·
--   github 52/5b5f32f3… 794/4bbd47fa… · math 55/75742895… 2414/1eacf48b… ·
--   yc 62/f61cf9d4… 525/7b537b19…
SELECT m.slug, p.yes_reserves, p.no_reserves FROM pools p JOIN markets m ON m.id=p.market_id ORDER BY 1;
-- EXPECT yes=90000.000000000000000000, no=10000.000000000000000000 on all six (§A1.4),
-- BEFORE the injector's first tick. Take this reading with pg_cron still paused.
SELECT m.slug, e.event_type, count(*) FROM events e JOIN markets m ON m.id=e.aggregate_id
GROUP BY 1,2 ORDER BY 1,2;
-- EXPECT exactly one market.created and one market.opened per market, 12 rows total.
SELECT m.slug, count(*) FROM market_media mm JOIN markets m ON m.id=mm.market_id GROUP BY 1;
-- EXPECT 2 per market, 12 rows total; and market_media total = 12.
COMMIT;
```

**P3 · Invariant baselines unmoved.**

```sql
BEGIN READ ONLY;
SELECT count(*) FROM drizzle.__drizzle_migrations;                       -- EXPECT 31 (both envs)
SELECT count(*) AS guards, count(*) FILTER (WHERE t.tgenabled<>'O') AS off
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE 'bucket_%';
                                                                         -- EXPECT 81, 0
SELECT id, frozen_at FROM system_state;                                  -- EXPECT 1 row, NULL
SELECT count(*) FROM liquidity_policy;                                   -- EXPECT stg 6 / prd 2
SELECT count(*) AS total, count(*) FILTER (WHERE assigned_at IS NULL) AS unassigned
FROM identity_pool;   -- EXPECT total == the step-2 dump's row count AND unassigned == total
COMMIT;
```

⚠ **P3's identity-pool line is the one most likely to fail**, and §A3.1 says why: if step 7
falls back to `db:seed:staging`, staging comes back as **871 / 871**, not **1 940 / 1 940**.
Decide which is wanted *before* the run and write the expected number into the runbook.

**P4 · R2.**

```
# both prefixes, this env's ids — EXPECT 0 objects each
list m/<MUM_ID>/   → 0
list m/<OKT_ID>/   → 0
# the six survive — EXPECT 2 objects each, 12 total
list m/<each surviving id>/ → 2
# participant uploads — EXPECT 0
list u/ in zugzwang-staging-uploads | zugzwang-uploads → 0
# PFP UNCHANGED — EXPECT stg 3237 (v1/ v2/ v1-pre-pfp2/ at 1079 each), prd 1079 (v1/)
list zugzwang-staging-pfp | zugzwang-pfp
# and the shared bucket still holds the OTHER env's media — EXPECT 8 prefixes × 2 = 16 intact
```

**P5 · Code.**

```sh
git fetch origin
git grep -i -E 'mumbai-bmc-pink-october|oktoberfest-munich-beer|MKT-MUM-01|MKT-OKT-01|mybmc|oktoberfest' \
  origin/main -- src tests scripts public drizzle
# EXPECT: no output.
git grep -l -i -E 'mumbai-bmc-pink-october|oktoberfest' origin/main -- docs | wc -l
# EXPECT: 9 minus the two data snapshots regenerated in PR-1 → report the number, docs are untouched by ruling.
git rev-parse 'origin/main^{tree}'   # quote the whole ref (zsh ${VAR:path} trap)
```

**P6 · HTTP, with the CDN bypassed** (§A7.3 — `x-vercel-cache: HIT`, `age` ≈ 11 h):

```sh
for S in mumbai-bmc-pink-october-disclosure oktoberfest-munich-beer-volume; do
  curl -s -o /dev/null -w "%{http_code} $S\n" "https://zugzwangworld.com/m/$S?cb=$(date +%s%N)"
done
# EXPECT 404 404.  Also check x-vercel-cache is MISS on that response — a HIT means the
# purge did not happen and the 404 is not proof of anything.
curl -s "https://zugzwangworld.com/api/health" | grep -o '"canary":"[^"]*"'   # == the promoted SHA
curl -s "https://zugzwangworld.com/?cb=$(date +%s%N)" | grep -c 'href="/m/'    # EXPECT 6 market links
```

⚠ **There is no sitemap and no OG-image metadata to check.** Measured: no `sitemap.*`,
`robots.*`, `opengraph-image.*` or `twitter-image.*` anywhere under `src/app`, and only three
`export const metadata` blocks (root layout, `/legal`, `/admin/login`) — none per-market.
The slug-driven surfaces are `/m/[slug]`, `/m/[slug]/export`, `/m/[slug]/export/image` and
`/m/[slug]/quote`; **all four 404 once the row is gone** and all four should be curled.

**P7 · The injector agrees.**

```sql
BEGIN READ ONLY;
SELECT ran_at, policy_version, markets_considered, markets_injected
FROM liquidity_heartbeat ORDER BY ran_at DESC LIMIT 3;
-- EXPECT the newest row to report markets_considered = 6
COMMIT;
```

### B5 · Stop points and rollback

Rollback of last resort at every point: **the `pg_dump` from step 1.** Restore is
`pg_restore --clean --if-exists -d "$URL"`, which needs the `_no_truncate` guards lifted the
same way the wipe does — so the restore path is the wipe tool run in reverse, not a bare
`pg_restore`. Rehearse that on staging.

| id | stop point | trip condition | action |
|---|---|---|---|
| **STOP-P0** | before the production leg only | §A2.3 unratified — 14 `gmail.com` accounts, 130 arguments, 85 uploads | **halt.** Founder ratifies in writing or the production leg does not run. Staging is unaffected |
| **STOP-B** | before either leg | Supabase backup/PITR status still NOT ESTABLISHED (§A12) | halt; read it first |
| **S1** | after `pg_dump` | `pg_restore -l` errors, or byte count is implausible vs §A2 | halt; do not proceed without a readable backup |
| **S2** | after snapshot | any of the six md5s absent, or `identity_pool` dump row count ≠ §A2 | halt; the snapshot is the only restore source |
| **S3** | after R2 key capture | listing returns 0 objects under `u/` when §A6 says 386 / 141 | halt; wrong bucket or wrong credentials |
| **S4** | after deploy | `/api/health` `canary` ≠ the merged SHA | halt; the wipe must not run against old code (O-14: ask whether the ground moved before concluding the deploy failed) |
| **S5** | after pausing cron | any job still `active` | halt; the injector will fight the TRUNCATE |
| **S6** | after the wipe | the batch aborted | ✅ **safe** — one transaction, `ALTER TABLE … DISABLE TRIGGER` is transactional DDL, so an abort rolls the disables back with it. Confirm 81 guards / 0 disabled, then retry |
| | | batch committed but G-4 fails | ⛔ **the database is wiped and unverified.** Do not restore on top. Diagnose, then `pg_restore` from S1 |
| **S7** | after re-seed | `identity_pool` total ≠ the expected number (871 vs 1 940 — decide first) | halt |
| **S8** | after restore | `created + skipped ≠ 6`, or any `market.created`/`market.opened` count ≠ 1 | halt; do not re-run blindly — it is idempotent on slug, so inspect first |
| **S9** | after R2 delete | any surviving market's prefix returns ≠ 2 objects, **or the other environment's 16 objects moved** | ⛔ **halt loudly** — the bucket is shared (§A6.1); a wrong-scope delete has hit the other environment |
| **S10** | after cache purge | `staging:*` / `prod:*` key count ≠ 0, or the *other* env's namespace changed | halt |
| **S11** | proof | any §B4 check fails | halt; do not start the production leg |

⚠ **The irreversible instant is S6-committed.** Everything before it is undoable by stopping;
after it, only the S1 dump brings anything back.

### B6 · Reviewers at execute

| artifact | reviewer | why |
|---|---|---|
| **PR-2 (production wipe + restore tooling)** | **`@security-auditor`** — required | It disables append-only enforcement on a production database. This is the §1-area-adjacent, refusal-trigger-adjacent artifact in the whole task |
| PR-2 | **`@code-reviewer`** | the guard predicates, the token, the batch generator |
| PR-2 | **`@db-migration-reviewer`** | ⚠ no migration is added, but the batch manipulates triggers and truncates 22 tables — the bucket classifications, the exclusion set and `EXPECTED_GUARD_CATALOG_ROWS = 81` are exactly this reviewer's contract |
| PR-1 | **`@code-reviewer`** | ⚠ scoped to `src/components/**`; **no `src/server/` file changes**, so its usual trigger does not fire — invoke it explicitly for the dead-code and docblock-consistency pass |
| PR-1 | `@test-writer` — **not** invoked | No new business-logic behaviour. This is deletion plus guard re-basing; §5.6's tests-first rule has no subject |

All four get `@docs/plans/MKT-ROSTER-1.md` (§5.11 — they start from zero context).

### B7 · Every prescriptive sentence the production wipe contradicts

For web Claude to draft against. **I have not authored, and must not author, any ADR or
decision-record text** — this is the citation list only.

| # | citation | the sentence | how the wipe contradicts it |
|---|---|---|---|
| 1 | `docs/adr/0035-guarded-staging-reset.md:86` | *"**Lifetime.** Staging only. … No production analogue is designed, deferred, or implied."* | the wipe **is** the production analogue |
| 2 | `docs/adr/0035-guarded-staging-reset.md:32` (Non-goals) | *"Anything about production. Production reset is not deferred, not scoped, not designed. It does not exist."* | direct |
| 3 | `docs/adr/0035-guarded-staging-reset.md:58` (primitive 1) | *"It lives under `tests/staging/`, is never imported from `src/**`, and is never reachable from any product code path."* | PR-2 lives elsewhere and targets prd; the *spirit* (containment) is preserved by never merging it |
| 4 | `docs/adr/0035-guarded-staging-reset.md:21` | quotes `tests/db/_fixtures/truncate.ts`'s own header: *"never import this from `src/**`; **production must not gain an escape hatch**."* | the escape hatch is exactly what PR-2 is; the never-merged branch is the mitigation |
| 5 | `docs/adr/0035-guarded-staging-reset.md:77` (G-1 Target) | *"must not contain the production ref … **Never fall back to `DATABASE_URL`**"* | PR-2 inverts this to a positive production match |
| 6 | `docs/adr/0036-vitest-context-operational-runners.md:37` (Non-goals) | *"Anything about production. No operational runner touches production, now or later."* | direct — and it is why §B2.1 recommends psql over a runner |
| 7 | `docs/adr/0036-vitest-context-operational-runners.md:85` (primitive 6) | *"**Scope and lifetime.** Staging only. Never production. … any other use is a new decision."* | direct. ⚠ *"a new decision"* is the ADR's own word for what is needed |
| 8 | `docs/specs/SPEC.2.md:699` | *"The only way to write to (or truncate) a Bucket A table without firing the trigger is to issue `ALTER TABLE <name> DISABLE TRIGGER <trigger>;` first … the append-only guard is a defense-in-depth barrier … **not** a hard boundary against an owner-level actor"* | ⚠ **describes rather than forbids** — this is the sentence that makes the wipe mechanically possible and it already says so |
| 9 | `docs/specs/SPEC.2.md:598` | *"No row in a Bucket A table can be modified or truncated after insert, ever, by any code path."* | the wipe truncates eleven Bucket-A tables |
| 10 | `docs/specs/SPEC.2.md:467` | `EXPECTED_GUARD_CATALOG_ROWS` = **81** | not contradicted — **preserved**, and G-4 is what proves it |
| 11 | `CLAUDE.md:70` | *"the triggers … are storage-layer ground truth — Bucket-A/B triggers reject `UPDATE`/`DELETE`/`TRUNCATE` at the storage layer"* | temporarily false for `_no_truncate`, inside one transaction |
| 12 | `CLAUDE.md:81` | *"**Refuse to weaken any invariant** — 'just for testing' / 'temporary admin override' / 'while we clean up' included."* | ⚠ the nearest thing to a refusal trigger this task touches. The defence is that INV-1..4 are *preserved* — no row is edited, `_no_update`/`_no_delete` are never lifted, and the end state satisfies every invariant — but the sentence is broad and the founder should rule on it explicitly |
| 13 | `CLAUDE.md:289` | *"each refuses to start unless the five-guard contract passes"* | PR-2 must carry an equivalent contract or this becomes false of the family |
| 14 | `AGENTS.md:632` | *"no bare `vitest run` … can reach a live database"* | preserved **only if** PR-2 is psql-based (§B2.1). A production-capable Vitest runner would make this sentence false |
| 15 | `AGENTS.md:700`, `:703` | *"`UPDATE` rows in `resolution_events` or `payout_events`"* is a Never; *"Mechanically enforced today, in full: append-only on Bucket-A tables (DB triggers)"* | the second becomes momentarily untrue |

#### B7.1 · ⛔ THE ONE THAT CHANGES WHAT WEB CLAUDE HAS TO WRITE

`docs/adr/0035-guarded-staging-reset.md:204` states its own amendment rule:

> *"An addendum to an accepted ADR may ADD a refusal condition. It may never remove one, widen a
> permitted set, or change a mechanism. Those three require a superseding ADR."*

The production wipe **widens a permitted set** (staging-only → staging plus one production pass)
and **changes a mechanism** (the target guard inverts). By ADR-0035's own rule that is **a
superseding ADR, not a patch record** — and ADR-0036:85 independently calls any non-staging use
*"a new decision."*

The ruling (item 4) says *"Web Claude drafts both patch records before execute."* I am flagging
the conflict once and proceeding as instructed: **the plan assumes two decision records, and
whether they are patch records or superseding ADRs is the founder's call, not mine.** I have not
drafted either. **OQ-6.**

### B8 · Open questions, each with a candidate answer

**OQ-1 — What does "restore the six exactly as they are today" mean?**
Today's pools have drifted (§A1.6). *Candidate:* restore the market **definition** byte-for-byte
(id, slug, title, description, deadline, media, video url) and re-open at the **original**
parameters `p_yes = 0.1`, tank `100000` (§A1.4) — not today's drifted reserves. Every bet that
moved them is dummy and is being deleted, so replaying them would be restoring the thing the
wipe exists to remove.

**OQ-2 — Are the 14 `gmail.com` production accounts disposable?** (§A2.3, **STOP-P0**)
130 arguments, 160 ledger rows, 85 image uploads, 110 of 114 users carrying a real `google_id`.
*Candidate:* they are the founder and testers, and the answer is yes — but it must be said
explicitly, with the numbers seen, because Bucket A makes it irreversible. If any is a real
participant, the method changes completely.

**OQ-3 — Production has 10 111 assigned identities against 114 users.** (§A3)
*Candidate:* a prior load test consumed them and its users were removed without the pool being
reset (`assigned_at` is a one-shot Bucket-B transition, so they can never be released in place).
The wipe fixes it as a side effect. Worth confirming nothing else explains it.

**OQ-4 — Production restore: admin form, or one-time runner?** (§A5)
*Candidate:* **one-time runner on the unmerged branch.** PR-2 already has to exist and already
has to carry production guards; adding the restore costs one more inverted refusal in a document
being written anyway, whereas the admin form puts ~10 KB of founder-authored copy through six
manual pastes on the production surface.

**OQ-5 — May PR-1 write `docs/data/`?** (§A9.4)
The ruling says `docs/` is out of scope, but `docs/data/staging-markets-snapshot.json` is
**loaded at runtime** by `tests/staging/content-markets.ts:45` and is the seeder's source.
*Candidate:* yes for the two data snapshots only — they are code-in-`docs/`, not documentation —
**plus a new `docs/data/prod-markets-snapshot.json`**, because production has no committed
snapshot at all and the 2026-09-07 incident is the precedent for why that matters. Everything
else under `docs/` stays untouched.

**OQ-6 — Patch records or superseding ADRs?** (§B7.1) *Candidate:* ADR-0035's own §204 says
superseding ADRs. Founder's call.

**OQ-7 — `identity_pool` after the wipe: 871, 1 940, or the captured dump?** (§A3.1)
*Candidate:* restore the captured dump on both environments, all `assigned_at` NULL. Regenerating
gives 871 on staging (wrong, and it loses the 1 031-pair vocabulary the current pool contains) and
is impossible on production (no manifest in the repo). Write the expected number into the runbook
before the run so P3 can be a real assertion.

**OQ-8 — Do the staging gates need to pass?** (§B3.1)
`pnpm staging:gates` is read-only but its coverage and event-parity gates are written against the
generated fixture population, which is not being regenerated. *Candidate:* run them, expect gates
1 and 4 red, report them as expected-red with the reason, and let §B4's direct proofs stand as the
evidence instead. Do **not** run `staging:generate` to make them green.

**OQ-9 — PR #435 conflict.** (§A9.5) `feat/dataset-1-export-pipeline` is open and touches
`resolution-block-data.ts`. *Candidate:* land PR-1 first and let #435 rebase; it is unmerged and
its lane is not active. Reported, not acted on.

---

## §C · WHAT THIS PASS DID NOT ESTABLISH

1. **Supabase automatic-backup / PITR status and retention, on either environment.**
   `supabase projects list` → *"Access token not provided."* No token in this session.
   Read it with `! supabase login` then
   `supabase backups list --project-ref zbvprdcyxhlguxbostdj` / `… rwfdoqzsghqhhdapxafg`.
   **A 403/absent answer is not a finding (O-13).**
2. **Whether the 14 `gmail.com` production accounts are testers or participants.** Measurable
   only by asking; nothing in the database distinguishes them.
3. **Vercel data-cache purge mechanics.** The tags (`discovery`, `market:<id>`) and the CDN HIT
   are measured (§A7.2/§A7.3); the exact purge command was not exercised, because exercising it
   is a write. The installed CLI is 54.4.1 against a current 59.x, so confirm
   `vercel cache purge` exists at execute time rather than assuming it.
4. **What consumed 10 111 production identities.** (OQ-3)
5. **Whether the three stray staging markets** (`concurrency-test-market`,
   `concurrency-test-market-b`, `seed-1-test-staging-20260914`) **are wanted.** They are
   destroyed by this plan as a side effect of the wipe; nobody has said they should be.

---

*End of report. Measured 2026-09-18T0821–0900Z against staging `rwfdoqzsghqhhdapxafg` and
production `zbvprdcyxhlguxbostdj`, both read-only. No write was issued to any database, bucket,
cache, deployment or git ref during this pass.*

---

## §D · AMENDMENTS — founder, 2026-09-18

**These are the execute kickoff's amendments, appended verbatim. Where §A–§C above and §D
disagree, §D wins.** The plan is preserved unedited so that what was measured on the morning of
2026-09-18 stays legible next to what was then ruled about it.

**Authority — founder rulings, 2026-09-18**

- **1A** · All 114 production accounts are disposable: 100 `@loadtest.example.com` + 14
  `@gmail.com` (the founder and his testers), 1,507 bets. **STOP-P0 is ratified for THOSE numbers
  only.**
- **2A** · Recorded as a decision-record ruling plus callouts on ADR-0035 and ADR-0036 —
  `docs/decisions/RECORD-v2.8-amendment.md` (**D-49**) and the callouts now standing under each
  ADR's metadata table.
- Scope: simple market deletion with the necessary backups. No structural or architectural change.

**WALLS**

- Nothing beyond the runbook: no schema or migration, no `src/server` change, no edit to
  `tests/staging/_lib/**`, no Discovery or layout change, no v3.0 edits, no fixture regeneration.
  The pool-drain and shared-bucket / shared-Redis findings are recorded, not fixed.
- R2 deletes are prefix-scoped, never bucket-scoped (`zugzwang-market-media` is shared by both
  envs). Redis deletes are `SCAN MATCH '<env>:*'` → `DEL`, never `FLUSHDB`. Never touch a PFP
  bucket.
- Any stop point that trips (S1–S11 and the ones added below): STOP and report. Don't improvise.

**AMENDMENTS**

- **A1 · Order.** PR-1 reaches staging from its own branch (push to `staging`). It merges to `main`
  only after the staging proof passes and `chart-window.test.ts` is re-based, with CI green. The
  production leg starts from that merge. PR-2 is rebased onto that `main` before any production
  tool runs, so the engine it drives is the engine production serves.
- **A2 · The staging wipe is the shipped reset step on its own** — `reset.staging.test.ts` under
  `vitest.staging.config.ts` with `ZUGZWANG_STAGING_RESET_ACK` and
  `ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS=include-content-markets` — **NOT** `pnpm staging:reset`,
  whose chained `db:seed:staging` adds 871 `identity_pool` rows that can never be removed. Then
  insert the saved pool. Expect the reset to name eleven slugs.
- **A3** · The production batch asserts **G-4 inside its own transaction before COMMIT** (81 guard
  rows, 0 disabled · `system_state` 1 row, `frozen_at` NULL · `__drizzle_migrations` 31) and raises
  on any failure, so a failed check rolls the wipe back. G-4 runs again after commit. Pre-flight
  also asserts the prd connection role owns every table the batch touches.
- **A4** · If simple, the saved `identity_pool` goes back inside that same transaction, after the
  ENABLEs and before the assertion; otherwise immediately after, with S7 as the check.
- **A5** · Immediately before the production wipe, re-check the six live prd definitions against
  `docs/data/prod-markets-snapshot.json` (title and description md5, slug, deadline, media keys).
  Any difference: STOP.
- **A6 · R2** · besides the MUM/OKT prefixes, delete any object under the 22 orphan prefixes whose
  ETag matches a MUM/OKT object; list every other orphan in the report, untouched. Empty each
  environment's own `u/` prefix completely.
- **A7** · The Redis purge skips `cron-lock:*` keys.
- **A8 · STOP-B is informational**: read Supabase backup status if a token is available and report
  it; do not block on it. The local `pg_dump`, verified readable, is the fallback. No restore
  rehearsal.
- **A9** · Rehearse the generated production batch file — the SQL alone, not the guarded wrapper —
  once against a local throwaway database built from the migrations, if the repo's db-test setup
  provides one; if not, say so and proceed.
- **A10** · Operational tables outside the truncate set are kept. If the proof finds a row in one of
  them naming MUM or OKT, delete that row (Bucket C, unguarded) and re-run the proof.
- **A11** · If the installed Vercel CLI cannot purge the data cache, stop and ask the founder to
  purge it from the dashboard; then verify `x-vercel-cache: MISS` on the proof requests.

**Calls on §B8's open questions**

| | call |
|---|---|
| **OQ-1** | definitions exactly as saved, reopened at **0.1 / 100,000** |
| **OQ-4** | one-time runner on the unmerged branch |
| **OQ-5** | yes — the two data snapshots **plus** the new production snapshot |
| **OQ-7** | the saved pool, all unassigned (stg 1,940 / prd 19,904) |
| **OQ-8** | gates 1 and 4 expected red, reported |
| **OQ-9** | PR-1 lands first |
| — | the three stray staging test markets are destroyed |

**SEQUENCE**

0. **Set-up.** Branch `feat/mkt-roster-1-six-market-slate` (PR-1): apply §B1; regenerate the staging
   snapshot to six from live staging; capture production's six, read-only, into
   `docs/data/prod-markets-snapshot.json`. Measure the next free decision-record amendment version
   and D-number in the live repo; fill every placeholder in the two ruling files; commit the
   amendment as `docs/decisions/RECORD-v2.8-amendment.md`; insert both callouts exactly as the
   callouts file instructs; commit `docs/plans/MKT-ROSTER-1.md` (the plan verbatim + §D). Open PR-1.
   Branch `chore/mkt-roster-1-prod-wipe-ONE-TIME` (PR-2): §B2 plus A3 and A4; open it for review
   only. Run the §B6 reviewers on both PRs and resolve their findings before any production step.
   A9 here.
1. **Staging leg:** §B3.2 with A1, A2, A6, A7, A11, then §B4 in full on staging (S11).
2. **Merge PR-1** (A1). **Production leg:** §B3.3. First the pinned-count predicate — if `users` ≠
   114, the gmail cohort ≠ 14, or the newest-user timestamp moved, **STOP**: the ruling covers those
   numbers only. Then A5, the token, the wipe, the pool (A4), the restore, R2 (A6), pg_cron, caches
   (A7, A11), then §B4 in full on production.
3. **Close-out.** Close PR-2 unmerged and delete its branch. Delete both local `pg_dump`s and the
   saved pool files, and confirm each deletion in the report.
