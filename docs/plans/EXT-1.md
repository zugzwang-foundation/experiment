# EXT-1 — move the experiment's end from 2026-11-05 to 2026-12-31 23:45 UTC

| | |
|---|---|
| **Status** | Build started 2026-10-12. Local only. Merge waits on the seven founder sign-offs, web Claude's text pack, and web Claude's diff review |
| **Source** | `EXT-1_HANDOVER_dev-team_2026-10-11.md` (the handover). The handover overrides the plan draft wherever they differ, so this file is written from the handover |
| **Measured at** | `origin/staging 022c0ee1` · `origin/main 8011d379` (re-fetched 2026-10-12; both environments still served those builds) |
| **Criticality** | Critical path: area 3 (resolution, payouts and freeze) and area 7 (schema and migrations) |
| **Hard deadline** | Production must carry this before **2026-11-05 23:45 UTC**. After that the six markets can close for good under the old date |
| **Branch** | `chore/ext-1-end-dec31`, cut from `origin/staging`. One PR into `staging`, then a `release/ext-1-<PR#>` PR into `main` |

⚠ **Provenance of this file.** The handover names a plan draft (attachment B) and a census (attachment A) as carrying line-level detail. Neither was available on the build machine. Every `path:line` below was therefore re-measured against the staging head rather than copied, and §6 lists what could not be recovered that way.

---

## 1 · What is decided (founder rulings, 2026-10-11)

1. **The end moves.** The experiment ends on **31 Dec 2026 at 23:45 UTC**. That covers the six live markets' close and settlement and every document, constant, copy line and test that states the end. There is one end time, 23:45 UTC; nothing happens at 23:59 any more.
2. **No freeze switch.** The experiment ends when its markets close. `system_state.frozen_at`, `isFrozen()` and every reader stay in the code, unchanged and unused. Resolution happens after the markets close.
3. **Devcon is struck; history stays.** The dataset release is untimed: "after the experiment closes". Historical records stay as written. One new ruling, **D-55**, supersedes the old date.

## 2 · Locks — never weakened

- Dharma stays soulbound. Every bet carries an argument. Admin is not a participant. Moderation is untouched.
- `events` takes INSERTs only. The migration writes to it by INSERT and to `markets` (Bucket C) by UPDATE.
- No new capability to extend a deadline. The B8 guard `assertDeadlineNotExtended` and its negative tests stay. This move is a one-time ruled exception made by migration.
- The freeze code is unchanged in behaviour: `frozen_at`, `isFrozen()`, every freeze gate, `error_experiment_concluded`, the trigger migrations and every freeze test. Two comments are corrected (§3.8).
- Market wording is the founder's. Only the date words in §4 change, exactly as signed off.
- Historical records are never edited: `docs/logs`, `docs/plans` (other than this file), `docs/journey`, past decision records, `docs/handover`, `docs/reports`, `docs/records`, `docs/polish`, `docs/design/mockups`, `docs/aws-migration`, `docs/STATE.md`, and the removed MUM/OKT market files.

---

## 3 · The build

### 3.1 Values

| Site | Before | After |
|---|---|---|
| `src/server/markets/create.ts:34` `FREEZE_INSTANT_UTC` | `2026-11-05T23:59:00.000Z` | `2026-12-31T23:45:00.000Z`. Keep the name; restate its docblock |
| `src/server/config/limits.ts:506`, `:631` chart window end | `2026-11-05T23:45:00.000Z` | `2026-12-31T23:45:00.000Z` |
| `src/server/config/limits.ts:750` axis anchors | third entry `2026-11-05T23:45:00Z` | `2026-12-31T23:45:00Z` (first two entries unchanged) |
| `src/components/debate/resolution-block-data.ts:231` Closes block | `"5 Nov 2026"` | `"31 Dec 2026"` |

The header countdown (target `1798760700000` ms), the admin countdown, the image-export countdown and the market-creation ceiling all follow the constant. The `limits.ts` docblocks at `:563` and `:717` get an in-place note that the window is now 5 October to 31 December.

### 3.2 Copy

| Site | After |
|---|---|
| `src/components/onboarding/cards.ts:89` and its register `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md:181,185` | "…runs from **5th October 2026** to **31st December 2026**…" (start date per sign-off 3) |
| `src/components/legal/LegalFigure.tsx:140` (and `:97` per sign-off 3) | `31 DEC` (and `5 OCT`) |
| `src/components/shell/BrandCluster.tsx:86` (docblock `:27`; pin `tests/unit/shell/phone-header-a13.test.tsx:311`) | "…until the markets close." |
| `src/app/(admin)/admin/markets/_components/NeedsResolutionCount.tsx:96`, `:104` | heading "Markets close"; caption `2026-12-31 23:45 UTC` |
| `src/app/(admin)/admin/markets/new/create-market-form.tsx:62`, `:337-338` | "…no later than the end of the experiment, 2026-12-31 23:45 UTC." |
| `src/server/admin/wire.ts:248` | "Resolution deadline cannot be after the end of the experiment." |
| `public/zugzwang.md:45-46` glossary term "The freeze" | reserved: `«text from web Claude: R-16»` |

Comment arithmetic (recorded start 2026-10-05; each phrase keeps its own counting convention):

- "~51 days" / "51-day" → "~87 days" / "87-day", and `51d ago` → `87d ago`: `src/lib/relative-time.ts:24-25`, `src/server/auth/index.ts:70`, `tests/unit/relative-time.test.ts:64`.
- "seven-week window" and "eight-week window" → "twelve-week window": `src/components/debate/chart/MarketPriceChart.tsx:160,198,1411`; `src/components/debate/resolution-block-data.ts:226`.
- "fifty-two-day window" → "eighty-eight-day window": `src/server/debate-export/image/PriceHistorySvg.tsx:114`.
- "~32-day production window" → "~88-day": `tests/unit/debate/render/price-chart.test.tsx:98`.

Dec 31 − Oct 5 = 87 days by difference; Oct 5..Dec 31 inclusive = 88 dates; 87 / 7 = 12.4 weeks.

### 3.3 Data: migration `0032` (no DDL)

**Files.** `drizzle/migrations/0032_ext1_end_moved_to_dec31.sql`, journal `idx 32`, and `meta/0032_snapshot.json` — `0031`'s body under a fresh `id` with `prevId` = `0031`'s id (the no-diff pattern of `0026` and `0030`). The filename must not match `*pg_cron*`.

**Shape.** ONE plpgsql `DO` block and no `--> statement-breakpoint`, so both appliers (`scripts/apply-migrations-per-tx.ts`, which wraps each migration in `sql.begin`, and CI's `drizzle-kit migrate`) run it as one statement in one transaction. Every text literal is dollar-quoted. The pair rows are generated from §4, never retyped.

1. **Presence gate**, keyed on the six ids in §4. None present → `RAISE NOTICE` and return (CI and test databases). Some but not all → `RAISE EXCEPTION`. All six → `SELECT … FOR NO KEY UPDATE` the six rows in id order, then continue (§6 D-8).
2. **Row preconditions**, per market: `status = 'Open'` and `resolution_deadline >= '2026-11-05T00:00:00Z' AND resolution_deadline < '2026-11-06T00:00:00Z'`. Otherwise `RAISE EXCEPTION` naming the slug.
3. **Text pairs** (§4), one `(market, field, before, after)` at a time. `before` must occur exactly once, then it is replaced. Already-applied arm: if `before` is absent and `after` occurs exactly once, the pair is skipped. Anything else raises.
4. **Row update.** `resolution_deadline = '2026-12-31T23:45:00Z'`; BTC's title; all six descriptions.
5. **Postconditions.** `md5(description)` equals the after-md5 in §4 (BTC's title too); the deadline is the new value; `slug`, `status`, `media_video_url` and `created_at` are unchanged.
6. **Ledger: one `INSERT INTO events` per market**, following `0029_liquidity_policy_ceilings_tightened.sql:146-182`:
   - `event_id = public.uuidv7()`; `created_at` derived from its first 48 bits; `payload_version 1`;
   - `event_type 'market.deadline_moved'`, `aggregate_type 'market'`, `aggregate_id` = the market id;
   - `payload { marketId, previousDeadline, newDeadline: "2026-12-31T23:45:00.000Z", ruling: "D-55" }`. `previousDeadline` is **read from the row before the update**, formatted as ISO-8601 with milliseconds and `Z`;
   - `metadata`, all seven fields of `eventMetadataSchema`: `request_id 'ext-1:<marketId>'`, `flow_id 'EXT-1'`, `user_id null`, `actor_id 'system'`, `idempotency_key 'ext-1:deadline-moved:<marketId>'`, `ip 'migration'`, `user_agent 'migration'`.
7. **The pipeline admits it.** `scripts/aws-migration/check-destructive-migrations.cjs` refuses DROP, TRUNCATE, DELETE FROM, column drops, type changes and renames. It does not refuse UPDATE or INSERT.

Forward-only. Reversal is a new `0033` with the reverse pairs and its own event, possible only before 2026-11-05 23:45 UTC.

### 3.4 New event type (same commit as the migration)

Add `market.deadline_moved` to `EVENT_TYPES` in `src/server/events/schemas.ts` (25 → 26) and its payload schema to `eventPayloadSchemas`:

```ts
"market.deadline_moved": z.object({
	marketId: z.string().uuid(),
	previousDeadline: z.string().datetime({ offset: true }),
	newDeadline: z.string().datetime({ offset: true }),
	ruling: z.string().min(1),
}),
```

No reader needs to learn the type: every `events` read in `src/` filters on an explicit `event_type` (`price-series.ts`, `backing.ts`, `profile/positions.ts`). The count pins at `tests/server/admin/markets-media.test.ts:337` and `tests/server/admin/moderation/act.test.ts:513` move to 26, and the two "stays 25" comments in `src/db/schema/bookmarks.ts:22` and `src/server/admin/moderation/act.ts:25` move with them.

### 3.5 Terms and Privacy v1.1 (sign-offs 2 and 3; recommended wording built)

```text
TERMS (public/legal/tos.txt)
:3     Version 1.1 · Effective 20 October 2026          (follows the actual production day)
new    What changed in 1.1: the experiment now ends on 31 December 2026 at 23:45 UTC,
       when its markets close (it previously ended on 5 November 2026), and its start
       date is corrected to 5 October 2026.
:17-20 The experiment is live from 5 October 2026 to 31 December 2026 (23:45 UTC), after
       which it ends permanently: its markets close and are then resolved, no new
       positions or arguments are accepted, and the experiment's pseudonymous activity
       record becomes part of a published open research record.
:59    — is void when the experiment ends on 31 December 2026.
:188   Zugzwang Experiment · Terms of Service · Version 1.1 ·

PRIVACY (public/legal/privacy.txt)
:3     Version 1.1 · Effective 20 October 2026
new    What changed in 1.1: the experiment now ends on 31 December 2026 at 23:45 UTC,
       when its markets close (it previously ended on 5 November 2026).
:57-58 When the experiment ends on 31 December 2026, its markets close and are then
       resolved, all Dharma is void, and the Service stops accepting new positions and
       arguments.
:77    Zugzwang Experiment · Privacy Policy · Version 1.1 ·
```

Reflow each paragraph to the files' ~70-column wrap. Recompute `TOS_VERSION_HASH` and `PRIVACY_VERSION_HASH` in `src/server/auth/tos-versions.ts` in the same commit; `tests/unit/auth/tos-version-hashes.test.ts` recomputes both from the files. No one re-accepts: the sign-in gate checks only that `tos_accepted_at` is present (`src/server/auth/session-gate.ts:33-46`).

### 3.6 Docs

**Mechanical — done on 2026-10-12** (date words only, no test reads these files): `docs/specs/SPEC.1.md:1074,1088,1120,1137`; `docs/specs/RANKING.md:375`; `docs/design/design-canon.md:150,284`; the nine plain dataset mentions in `docs/specs/SPEC.2.md` that sit outside the reserved sections (`:79,235,340,390,392,742,795,1004,1620`).

**Mechanical — moves with the code, because tests read these files:**

- `docs/data/{prod,staging}-markets-snapshot.json` and `staging-markets-snapshot.md`: `resolution_deadline` → `2026-12-31T23:45:00.000Z`, plus the §4 pairs. Every §4 `before` occurs exactly once in both committed snapshots (measured), so the same pairs apply even where a snapshot's text differs from the live text.
- `docs/markets/MKT-{BTC,CHE,CLA,GIT,MAT,YCP}-01.md`: their own date words, table rows, the CLOSES ON line, the bare deadline lines, BTC's 52 → 108 — **and the same §4 pairs in their §1–§3 bodies** (see §6 D-2).
- `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md:181,185`, with the card copy.
- `docs/specs/SPEC.1.md:1210-1211`, the two §16.1 rows pinned to the chart constants (§6 D-5).
- Version bumps: SPEC.1 2.2.0 → 2.3.0; SPEC.2 2.2.2 → 2.3.0 — held for the change-log rows (§6 D-6).

**Reserved — text from web Claude; leave `«text from web Claude: R-n»` and write nothing:**

| R | File | What |
|---|---|---|
| R-1 | `docs/decisions/RECORD-v2.13-amendment.md` (new) and a `docs/decisions/README.md` row | Ruling D-55 |
| R-2 | `docs/adr/0067-…` (new) | No scheduled freeze; the end is the markets' close; the one-time data move as the sanctioned exception to B8; the new event type |
| R-3 | The ADRs with hits | One standard D-55 patch note each. No strike-throughs except ADR-0019:85 |
| R-5 | `SPEC.1.md` §6.1, §12, §15, Appendix B, changelog | Restated passages |
| R-6 | `SPEC.2.md` §0, §5, §15.4, §18, §19, §20, Appendix B, changelog | Restated passages |
| R-7 | `CLAUDE.md` §1, vocabulary, §3 (the freeze refusal trigger), decision log | Restated contract text |
| R-8 | `.claude/agents/security-auditor.md:70` | Restated checklist item |
| R-9 | `docs/operating/OPERATING.md` header and §12 | Restated |
| R-10 | `docs/runbooks/dataset-release.md:15-65` | Timeline keyed on the markets' close |
| R-11 | `docs/runbooks/BREAK_GLASS.md` §1 | Restated trigger |
| R-12 | `docs/parked.md` rows: FF-DATASET, §21.7 freeze banner, MOD-REPORT-PATH | Restated rows |
| R-15 | `docs/specs/flows/F-DEBATE-4.md:66`, `docs/design/design-language.md:134`, `docs/design/design-canon.md:315` | Restated |
| R-16 | `public/zugzwang.md:45-46` | Glossary term |

### 3.7 Workflow

`.github/workflows/staging-migrate.yml` migrates the retired Supabase staging database, and what its six markets carry is not established. Left armed, `0032` has two possible outcomes there and neither is wanted: the committed snapshot of that database shows the same six slugs under other ids, in which case `0032` does nothing and is still recorded as applied; or the ids are present with text it was not signed against, in which case it aborts and the workflow goes red on every staging push. Its only trigger today is `push` (see §6 D-1), so the change is: **replace `push` with `workflow_dispatch`**.

### 3.8 Two comments corrected (comment-only)

Each now says that no scheduled writer exists and the flag is dormant per D-55: `src/server/system/is-frozen.ts:12` ("HARDEN.10's pg_cron owns the flip" — it does not exist) and `src/db/schema/system.ts:7-9` ("2026-11-05 23:59 UTC conclusion freeze").

---

## 4 · Market text: the exact pairs

Read from the pages as served. All six descriptions are byte-identical on staging and production, and each `before` occurs exactly once. Re-verified 2026-10-12 against all twelve pages: every before-md5, every exactly-once count and every after-md5 below reproduces, and both environments serve these six market ids.

The moved-from clause goes before the deadline sentence's final full stop: `, moved from 5 November 2026 by ruling D-55 (11 October 2026)`. If the D-number changes at landing, the clause and every after-md5 change with it.

```text
BTC · bitcoin-price-50k · id 01a0a0ba-c700-77bf-8395-7f6bd429e53f
  description md5  f8ebff04543296d08a37dc18663a32c4 (2457) -> 3b2b3629d7daae859162da65c13e175d (2524)
  title md5        50400c9b735e08a31269d80bd54e8d47 -> 76a64d3e14f49a3afa0548b12bb18dcb
  T1  by 5th November?
   -> by 31st December?
  D1  between 15th September 2026 and 5th November 2026, as measured
   -> between 15th September 2026 and 31st December 2026, as measured
  D2  on any date from 15 September to 5 November 2026 inclusive.
   -> on any date from 15 September to 31 December 2026 inclusive.
  D3  The window is the 52 UTC calendar dates from 15 September 2026 to 5 November 2026 inclusive.
   -> The window is the 108 UTC calendar dates from 15 September 2026 to 31 December 2026 inclusive.
  D4  DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:45:00Z.
   -> DEADLINE. Trading closes and settlement occurs at 2026-12-31T23:45:00Z, moved from 5 November 2026 by ruling D-55 (11 October 2026).
  D5  (c) The 5 November daily low is binding as published;
   -> (c) The 31 December daily low is binding as published;
  D6  the full daily-low series for all 52 dates in the window
   -> the full daily-low series for all 108 dates in the window
  (108 = 16 + 31 + 30 + 31 dates, 15 Sep..31 Dec inclusive; the market keeps its own 15 Sep opening.)

CHE · chess-fide-tiebreak-response · id 01a0a0ba-d969-7613-a701-0f140bd224b1
  description md5  bf97ca9b7a50df859e92e552d845bbee (1903) -> 5bedd1bef0d453d1733b4233b7b4eb1b (1974)
  D1  respond publicly on X by 5 November 2026 to
   -> respond publicly on X by 31 December 2026 to
  D2  Window. Opens at the root post's timestamp, ends 5 November 2026 at 23:45 UTC.
   -> Window. Opens at the root post's timestamp, ends 31 December 2026 at 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).
  D3  No extensions.
   -> No further extensions.

CLA · claude-bundle-response · id 01a0a0ba-f3bd-70fe-b5fd-70426431e314
  description md5  76cbb17b564ad5f714be733425a3d05c (2169) -> 93e30bb6ca6859549e42c46f64cd9f59 (2240)
  D1  on X, between 15 September and 5 November 2026?
   -> on X, between 15 September and 31 December 2026?
  D2  Deadline. 5 November 2026, 23:45 UTC.
   -> Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).
  D3  No extensions.
   -> No further extensions.

GIT · github-zugzwang-repo-stars · id 01a0a0bb-0dfb-7793-9ff3-057e1a53c10a
  description md5  3d37aa85ef72a46be8f2f10facba720e (792) -> c3f860f4cec1c54ce17dac01291b7dc4 (855)
  D1  GitHub stars by 5 November 2026?
   -> GitHub stars by 31 December 2026?
  D2  Deadline 5 November 2026, 23:45 UTC.
   -> Deadline 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).

MAT · math-erdos-solved-on-zugzwang · id 01a0a0bb-3141-71ce-9843-2d98002f8c87
  description md5  379337a2e76c69304b6c8abef8c78f0c (2852) -> 68bbb6776caa9ef04b57cff8b1193f2d (2923)
  D1  publicly confirm on X by 5 November 2026 that
   -> publicly confirm on X by 31 December 2026 that
  D2  Deadline. 5 November 2026, 23:45 UTC.
   -> Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).
  D3  No extensions.
   -> No further extensions.
  (titles untouched: staging "#728" md5 9a3a26e7fc8d448ba57e889384ba43aa; production "#689" md5 837b7fa04723445de2d4028bf926d15e)

YCP · yc-w27-acceptance · id 01a0a0bb-7e0b-7182-9944-bba33914d94b
  description md5  28d456ecebc3af51dd6823ee44066b9a (1658) -> c1fe47fd059ac1b2f4274d32a69f33cc (1729)
  D1  Winter 2027 batch by 5 November 2026?
   -> Winter 2027 batch by 31 December 2026?
  D2  Deadline. 5 November 2026, 23:45 UTC.
   -> Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).
  D3  No extensions.
   -> No further extensions.
  (YC's own dates stay: "on-time deadline of 2 November 2026", "hear back by 11 December 2026".)
```

---

## 5 · Test plan (failing tests first)

### 5.1 New: the migration (`tests/db/ext1-end-moved.spec.ts`, real Postgres)

The before-state fixture is `tests/db/_fixtures/ext1-live-markets.json`: the six live titles and descriptions as served on 2026-10-11, each matching its before-md5 in §4. The test applies the migration by executing the SQL file's body.

1. Seed the six markets with the fixture text, `status 'Open'`, deadline `2026-11-05T23:45:00Z`. Apply. Assert: the after-md5s (BTC's title too) and the new deadline on all six; `slug`, `status`, `media_video_url`, `created_at` unchanged; **exactly six** new `market.deadline_moved` events with the right payload and metadata.
2. Empty database → no-op, zero events, no error.
3. Five of six present → raises; nothing changes.
4. One before-string altered → raises, and nothing changes on any market (rollback).
5. One market `Closed` → raises.
6. One pair pre-applied → that pair is skipped; still six events and the right md5s.
7. Each event row parses with the new Zod payload schema and with `eventMetadataSchema`.
8. A deadline of `2026-11-05T23:59:00Z` → accepted, and that event's `previousDeadline` is `2026-11-05T23:59:00.000Z`.

Plus one file-level guard, no database: the SQL holds no `--> statement-breakpoint`, and `findDestructive` from `scripts/aws-migration/check-destructive-migrations.cjs` returns nothing for it.

### 5.2 New: the event type

`EVENT_TYPES` has 26 entries and includes `market.deadline_moved`; its schema accepts the migration's payload shape and rejects one missing `ruling`.

### 5.3 Value pins that move (edit the expectation; never loosen an assertion)

- `FREEZE_INSTANT_UTC` pins and local copies: `tests/server/admin/markets.test.ts`, `markets-media.test.ts`, `markets-needs-resolution.test.ts`, `tests/server/debate-view/poll-contract.test.ts`, `tests/staging/fixtures.ts`, `tests/unit/shell/countdown-format.test.ts`, `tests/unit/staging/content-markets-source.test.ts`, `tests/unit/staging/deadline-clamp.test.ts` (`:48` → `2026-12-31T22:45:00.000Z`).
- `tests/unit/config/chart-window.test.ts:54,110,177`, and the anchor, axis-row and price-chart tests. **Expect chart-geometry failures** — the axis grows from ~32 to ~88 days. Fix the fixtures; do not loosen assertions.
- `tests/unit/debate/resolution-block-data.test.ts:102` (Closes against the snapshots).
- `tests/unit/onboarding/copy-drift.test.ts:202` ("31st December 2026") **and `:232`** (the start date, "5th October 2026" under sign-off 3 — see §6 D-3).
- `tests/unit/shell/phone-header-a13.test.tsx:311` ("until the markets close.").
- The countdown-format and image-compose examples; the legal-hash test (it recomputes, so it passes once the constants move).
- `tests/unit/staging/market-spec-snapshot-parity.test.ts` is left **unchanged**, and EXT-1 must add no failure to it: the spec files and the snapshots move together. ⚠ It is **not green at the staging head** — two of its tests are red on the Chess TITLE, which differs between the two snapshots since #646 (measured on a clean checkout of `022c0ee1`). Every description is in parity before and after. The title drift is the separate task the handover names.
- Strike the Devcon fixture sentences: `tests/integration/market-by-slug.integration.test.ts:52,61`; `tests/unit/shell/header-nav-back.test.tsx:98`.

A fixture that merely uses a November date as an arbitrary deadline is left alone; only pins that assert the END value move.

### 5.4 Must stay green, unchanged

The B8 tests `tests/unit/markets/transitions.test.ts:222-245`; every freeze test (`tests/server/system/is-frozen*`, `markets/freeze-gate`, `resolution/freeze-exemption`, `bets/freeze`, `tests/db/triggers/system-state-append-only`, the freeze rows in `debate-view/poll-contract`, `tests/unit/debate/debate-view-freeze.test.ts`, the opt-in scale freeze test); all 13 invariant specs.

### 5.5 Gates, in order

`ZUGZWANG_ENV=preview just verify` → `pnpm test:invariants` → `pnpm test:integration` → a full `pnpm vitest run`, last.

---

## 6 · Where this plan departs from the handover, and what is still open

**Departures, each because the handover's instruction does not survive contact with the repo:**

- **D-1 · `staging-migrate.yml` has no `workflow_dispatch` to keep.** Its `on:` block is `push: branches: [staging]` and nothing else. Removing `push` alone leaves an empty `on:`; §3.7 replaces it.
- **D-2 · The market spec files take the same pairs as the snapshots.** `tests/unit/staging/market-spec-snapshot-parity.test.ts` asserts that §1–§3 of `MKT-{CHE,CLA,GIT,MAT,YCP}-01.md` equal each snapshot's `description` byte for byte. The handover gives the moved-from clause and "No further extensions." to the snapshots only, which would turn that guard red.
- **D-3 · `tests/unit/onboarding/copy-drift.test.ts:232` pins "15th September 2026".** It moves with sign-off 3 and is missing from the handover's pin list.
- **D-4 · Metadata `ip` and `user_agent` are `'migration'`.** The handover fixes five of the seven fields; the precedent uses `'pg_cron'` for these two, which would be false here.
- **D-5 · `docs/specs/SPEC.1.md:1210-1211` moved with the constants.** The handover does not list these two §16.1 rows. `src/server/config/limits.ts` states that `MARKET_CHART_WINDOW_END` and `MARKET_CHART_AXIS_ANCHORS` are written to be byte-comparable with them and that the row is amended in the same commit, so the value in each row was swapped and nothing else in the row was touched.
- **D-6 · The spec version bumps are held.** SPEC.1 2.2.0 → 2.3.0 and SPEC.2 2.2.2 → 2.3.0 land with their change-log rows, which are reserved text (R-5, R-6); a bumped header with no row would point at nothing.
- **D-7 · No placeholder was written over a reserved sentence.** The handover asks for `«text from web Claude: R-n»` wherever a sentence is reserved. Most reserved sentences are live contract text (`CLAUDE.md` §3, the spec freeze sections); replacing them with a marker would strip the rule from the working tree until the pack arrives. They are left as they stand and listed in §3.6 instead.

- **D-8 · The six rows are locked `FOR NO KEY UPDATE`, not `FOR UPDATE`** (`@db-migration-reviewer`). The migration changes no key column, and `FOR UPDATE` is the one strength that conflicts with the `KEY SHARE` a bet's comment and bet INSERTs take on their market through the foreign key. Held across six rows it would stall live bets on the earlier markets while the migration waited on a later one, each failing at the bet path's 1,000 ms statement timeout as a 503. `src/server/bets/transaction.ts` rules the same way and `0029` locks these rows at this strength. It still serialises against close, resolution and the liquidity injector.

- **D-9 · `AGENTS.md` moved in this PR, not after landing.** The handover schedules descriptive refreshes for later; `CLAUDE.md`'s closing ritual says a contract file the session made stale is fixed in the same PR. Three facts were updated and nothing else: the migration head (`0032`), the `EVENT_TYPES` count (26, eight `market.*`), and the `staging-migrate.yml` trigger.
- **D-10 · Comments the change made false were corrected** (`@code-reviewer` L-1, L-2, L-11): the countdown cell-count date, the chart anchor labels, the Closes docblocks, the export countdown label and the legal preamble comment. Comment-only. Also (`@code-reviewer` M-1) `src/server/auth/tos-versions.ts` now names the two retired Version 1.0 hashes and the commit that holds their bytes, because that file was the only place in the tree that named them.

**Red before EXT-1, and not caused by it** (measured on a clean checkout of `022c0ee1`): `tests/unit/shell/phone-header-a13.test.tsx` `all-five-render-in-that-DOM-order-in-both-arms`; the four tests in `tests/unit/shell/header-nav-back.test.tsx`; `relative-time::nothing-makes-the-string-tick` in `tests/unit/design/relative-time-placement.test.tsx`; and the two Chess-title tests in `market-spec-snapshot-parity.test.ts`.

**Open — for web Claude or Hrishikesh, not decided here:**

- **OQ-1 · The migration tests are in no automated gate.** PRs into `staging` and the staging deploy run no CI (STAGING-FAST-DEPLOY). The `main` PR and the production deploy run `pnpm test:critical`, which covers neither `tests/db/` nor `tests/unit/`. Either add `tests/db/ext1-end-moved.spec.ts` to `test:critical` (an ADR-0066 change) or dispatch `full-suite.yml` on the branch and read it before each merge. Not changed in this build.
- **OQ-2 · F9 is narrower than stated.** The chart-window expiry alarm is outside `test:critical`, so after 2026-11-05 it reddens only the nightly full suite, which gates nothing.
- **OQ-3 · `public/legal/tos.txt:73`** still reads "All markets resolve when the experiment concludes." beside the restated `:17-20`. Legal wording is founder-reserved; left as is.
- **OQ-4 · Date-bearing lines the handover names nowhere:** `docs/specs/SPEC.1.md:94` (§3.1, "public dataset on November 6, 2026"), `:521`; `docs/specs/SPEC.2.md:892`, `:1199` ("51-day live window"); fourteen comment-only mentions in `src/`. Left untouched.
- **OQ-5 · `docs/parked.md`.** Which rows are "the dataset-date rows", and how the two Devcon lines (`:3819`, `:4017`) are struck, is not recoverable from the handover.
- **OQ-6 · Commit trailers.** The handover says no `Co-authored-by`; `AGENTS.md` §10 records the opposite as current practice.
- **OQ-7 · The liquidity injector.** `run_liquidity_injection` skips a market only inside `endgame_hours` of its deadline, so moving the deadline keeps the six markets eligible for 56 more days wherever the policy is enabled.
- **OQ-8 · D-55 and the clause wording must be final before the STAGING merge, not "at landing".** `0032` writes "D-55" into six descriptions and six append-only events. Once it has run on the staging RDS it cannot be edited, and a changed number would need a second migration (`@db-migration-reviewer`).
- **OQ-9 · The presence gate keys on ids only.** A database holding the same six slugs under other ids lands in the no-op arm and is still recorded as migrated. Both live environments were measured serving the six ids on 2026-10-12, so this does not bite today; nothing automated would report it if it did. Options: raise in the zero arm when any of the six slugs exists (which would also stop a local database seeded from the staging snapshot from migrating), or have V-1 and V-2 assert six `market.deadline_moved` rows.
- **OQ-10 · No documented exit if `0032` raises on production after it has applied on staging.** One market not `Open`, one character of drift, or a deadline off 2026-11-05 wedges every later production migration behind it. The pre-merge check is a page GET; the predicate the migration evaluates is SQL.
- **OQ-11 · Owed in the text pack, same commit:** a `market.deadline_moved` row in SPEC.2 §19.4.1 (`docs/specs/SPEC.2.md:1957-1972` makes it a same-commit amendment for any new event type). And at PR #435's rebase (the dataset pipeline): its `PAYLOAD_SHIP_KEYS` needs a `market.deadline_moved` entry, or the dataset build throws on the six rows `0032` writes (`@code-reviewer` M-2).
- **OQ-12 · A leftover label.** `src/app/(admin)/admin/markets/_components/countdown.ts:33` still returns `"freeze reached"` under a card that now reads "Markets close". Not in the handover's copy table; left as is.
- **OQ-13 · The docs' own Math title.** `MKT-MAT-01.md` and the production snapshot carried "…be solved by 5th November?", a date the live title does not have. It took the same swap as Bitcoin's title so that spec and snapshot stay in parity. Migration `0032` makes that edit on no database.
- **OQ-14 · Dated dataset mentions in tests**, left as they are: `tests/staging/generate.staging.test.ts:330`, `tests/staging/fixtures.ts:67`, and the test title at `tests/server/identity/no-raw-uuid-in-urls.test.ts:100`.
- **OQ-15 · `CLAUDE.md` still describes `staging-migrate.yml` as a live step** (§8 O-4 and the Gotchas list), beside the four lines that state the old end. All of it is R-7 text.
- **OQ-16 · The Closes value is computed to fit, not measured** (`@code-reviewer` M-3). `31 Dec 2026` is one character longer than `5 Nov 2026`; from the repo's own Geist advance table it is ~81.1px at 14px against the 90.67px column. `resolution-block-data.ts` is a file whose contract is "measured", so a browser measurement at 1440 and across 1024–1440 is owed at V-1.
- **OQ-17 · The manual run of `staging-migrate.yml` exists only once the file reaches `main`.** GitHub offers `workflow_dispatch` from the default branch's copy; the push trigger is gone as soon as the file reaches `staging`.
- **OQ-18 · No test pins the legal figure's `5 OCT` / `31 DEC` labels** (`src/components/legal/LegalFigure.tsx`). They are a third hand-written copy of the dates, which is how `15 SEP` outlived the start move.

**Raised by `@security-auditor` — no CRITICAL; nothing in the diff weakens INV-1..INV-4 or disables a freeze gate. Each of these needs a ruling, and none is decided here:**

- **SA-H-1 · The move can be front-run from the public repository.** The repository is public. From the first push of this branch, anyone can read that all six "by 5 November" markets are about to become "by 31 December", which raises the fair price of YES on every one of them, and can buy on production before `0032` lands there. Nothing in the diff announces the change in-product. ⇒ Decide how and when D-55 is made known to every participant at once **before the branch is pushed**, or collapse push → staging → production into one sitting.
- **SA-H-2 · The close cron is now the only thing that ends trading.** The bet path reads `markets.status` and never the deadline (`src/server/bets/transaction.ts`, `assertMarketOpen`), so between 23:45:00 and the next sweep a holder can still sell or buy on a market whose outcome window is over. That lag is the founder-accepted R-14.3 carry-forward and is unchanged; what D-55 removes is the 23:59 freeze that bounded it. Two things make a failed sweep quiet: the cron route answers HTTP 200 with `{status:"error"}` on a sweep throw, so the CloudWatch `FailedInvocations` alarm does not see it, and `closeDueMarkets` abandons the remaining markets on any non-lifecycle error. The smallest fix is a deadline check inside `assertMarketOpen`, which is a bet-path change (area 1) and founder-gated by SPEC.2 §20.2 — a separate task, not this build. Until then: an alarm on any market `Open` more than five minutes past its deadline, and the admin Close action as the manual backstop.
- **SA-H-3 · The R2 `u/` lifecycle rule, if it exists, was sized for a 51-day window.** `docs/specs/SPEC.2.md:1199` describes a 90-day expiry on the prefix that also holds committed images. An image committed on 2026-10-05 would expire on 2027-01-03, three days after the new end and inside the resolution period. The rule is in no file in this repository; the handover's ops check 3 covers it, and SPEC.2 §12.3 has to be amended in the same commit as any change. **Confirmed 2026-10-13 from the Cloudflare dashboard (bucket `zugzwang-uploads` → Settings → Object Lifecycle Rules, read by the operator and pasted into the session):** rule `delete-uploads-after-90d`, prefix `u/`, "Delete objects after 90 day(s)", Enabled — beside the default "Abort uploads after 7 day(s)" multipart rule. Not changed. `zugzwang-staging-uploads`, `zugzwang-market-media` and `zugzwang-pfp` were not read. Three things ride a change to 365 days: (1) the same rule is the Layer 1 net of SPEC.2 §12.6, so `blocked` objects and orphans the sweep missed are also kept for 365 days rather than 90; (2) four sites state the 90 — `docs/specs/SPEC.2.md:1199` and `:1230`, `src/server/storage/sweep-orphans.ts:46` and `:187` — and `:1199`'s reasoning ("the experiment's 51-day live window") is restated prose, which is the text pack's; (3) Cloudflare's lifecycle page says a changed rule reaches existing objects with a delay, "most … within 24 hours", so the change is not instant but the oldest launch object is nine days old today.
- **SA-M-1 · The record never stops.** With `frozen_at` NULL for good, signup (and its 1,000 Đ grant), `uploads/sign`, and a moderation block on a refused bet all keep appending to shipped tables after every market has closed. No participant path changes a resolved outcome's inputs. ⇒ The dataset build needs an explicit cutoff — the last `market.closed` instant — written into the reserved runbook text (R-10).
- **SA-M-2 · The legal-hash guard is in no automated gate, and the effective date is a release-day edit.** `tests/unit/auth/tos-version-hashes.test.ts` is the only check that the two constants match the two files, and `test:critical` does not cover `tests/unit/`. If the "Effective 20 October 2026" line is changed at release and a constant is missed, CI stays green and every later signup is recorded against a hash that names no document. Same decision as OQ-1.
- **SA-M-3 · What can make `0032` abort on production** (sharpens OQ-10): an admin Void on any of the six, any operator script that rewrites a description or Bitcoin's title, or the clock passing 2026-11-05 23:45 UTC. No participant action can. ⇒ No admin Void and no market script between the pre-merge check and the production migrate, and the exit procedure written before the staging merge.
- **SA-L-1 · ADR-0044's stated mitigation is void, and its conclusion still holds.** The "the freeze returns 410" argument is gone; a published idempotency key is still not replayable, because the Redis slot and the receipt read are user-scoped and the two global uniques are reachable only inside W-1 after `assertMarketOpen`. The ADR needs a substantive patch record rather than the standard date note, and the release runbook should require that no market is `Open` before publishing.
- **SA-L-3 · Version 1.0 accepters are never shown 1.1.** The handover says so on purpose; SPEC.2 §18.3's "a version change forces re-acceptance" was never built and first bites here.
- **SA-L-4 · Fixed in this build:** `staging-migrate.yml` could be dispatched from any ref once it lost its `push` trigger; it now refuses any ref but `staging`.
- **SA-L-5 · `docs/runbooks/dataset-release.md:39-57` still instructs setting `frozen_at` at the old instant.** Followed on 5 November it would end the experiment 56 days early with no thaw, and a hand-set flag before the markets close would also stop the close cron, which is itself freeze-gated. ⇒ R-10 must land in the same merge as the code, not after it.

Three findings outside EXT-1 are filed in `claude-progress.md`: `/api/uploads/sign` has no ban check, the presigned PUT has no size bound, and `assertDeadlineNotExtended` has no caller.

## 7 · Landing, verification, rollback

As the handover §7–§11, unchanged: staging first (one PR into `staging`; `deploy-aws.yml` builds → migrates the staging RDS → deploys → verifies), then V-1; then the `release/…` PR into `main`, a pre-merge re-GET of the six production pages against the before-md5s, a manual production RDS snapshot, and `deploy-production.yml` with Hrishikesh approving each `aws-production` job; then V-2 and the exit census. Code rolls back by revert or `rollback_image_tag`; migration `0032` is forward-only.

## 8 · Self-audit before each PR

- **Migration:** one statement, no breakpoint; presence gate's three arms; both preconditions; every pair exactly-once with the already-applied arm; five postconditions; six events with seven metadata fields; journal `idx 32`; snapshot is `0031`'s body under a fresh id; filename not `*pg_cron*`; the destructive checker passes it.
- **Schema:** no DDL; no table, column, index, trigger or enum touched; `EXPECTED_GUARD_CATALOG_ROWS` stays 81.
- **Server:** `EVENT_TYPES` 26 with its Zod schema in the same commit; the constant keeps its name; no freeze gate, no `isFrozen` caller and no B8 guard changed.
- **Docs:** every reserved line holds web Claude's text verbatim or its placeholder; no historical record edited; ceilings re-read on the merged heads (D-55, ADR-0067, `0032`).
