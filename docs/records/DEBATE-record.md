# DEBATE — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** comments, reply-as-bet, ranking, moderation, content removal, the debate read model, and the `.md` export that became the AI-mode button.

## 1 · What this lane is

Every argument on Zugzwang is a bet, and every bet is an argument. There is no way to stake
without writing and no way to write without staking. A reply is not a comment on a post — it
is a bet on a side, placed against that post, and whether it reads as Support or Counter is
derived at read time from which side it took. Replies are flat: you can reply to a post, and
nobody can reply to your reply.

Ordering is the product's opinion about what an argument is worth, so it is not chronological.
Posts rank on a composite of the money still staked behind them and the interest they drew
from other people — *other people* being load-bearing, because a reply from a post's own
author is not evidence that anyone was persuaded.

Text and images are classified before anything is written. The classifier runs outside the
database transaction and its failure refuses the bet rather than admitting it. When a
moderator removes content afterwards, the row stays — the argument's structural slot, its
side and its stake survive — and only the body and author are withheld, everywhere, on every
read path.

## 2 · Feature table

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| Bet + comment atomicity (one tx) | SHIPPED | `src/server/bets/transaction.ts`, `src/server/bets/place.ts` | SPEC.1 §5 INV-1 | 0013 | `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` | — |
| Reply-as-bet, depth 1 | SHIPPED | `src/server/comments/reply-validate.ts`, `src/server/config/limits.ts:125 (REPLY_DEPTH_MAX)` | SPEC.1 §8 · `F-COMMENT-2` | 0017 | `tests/server/comments/reply.test.ts`, `tests/integration/composer-reply.integration.test.ts` | — |
| Side bound at post time | SHIPPED | `src/server/bets/place.ts` (`side_at_post_time` at INSERT) | SPEC.1 §5 INV-3 | 0005 P1 | `tests/invariants/I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts` | — |
| Support / Counter as read-time aggregates | SHIPPED | `src/server/debate-view/reply-substrate.ts` | SPEC.1 §8 | 0017 | `tests/server/debate-view/reply-substrate.integration.test.ts` | — |
| Comment length + body validation | SHIPPED | `src/server/config/limits.ts:122 (COMMENT_MAX_LENGTH)`, place route step 5 | SPEC.1 §10.9 | — | `tests/server/comments/validation.test.ts` | `F-3` (value is a placeholder) |
| Two stake floors (post / reply) | SHIPPED | `src/server/bets/floors.ts`, `limits.ts:104,107 (BET_MIN_STAKE_POST, BET_MIN_STAKE_REPLY)` | SPEC.1 §10.9 | 0018 | `tests/unit/bets/floors.test.ts` | `F-3` (post floor is a placeholder) |
| Image attach — resolve, ownership, un-attached | SHIPPED | `src/server/comments/image-attach.ts` | `F-COMMENT-3` | 0028 | `tests/server/comments/image-attach.test.ts`, `tests/integration/composer-image.integration.test.ts` | — |
| Byte-identity binding on the moderated image | SHIPPED | `src/server/storage/`, `image_uploads` triggers | `F-COMMENT-3` | 0028 | `tests/server/comments/image-verify-audit-record.test.ts` | — |
| **Pre-commit moderation (text + image, one call)** | SHIPPED | `src/server/moderation/precommit.ts`, `openai.ts`; sole call site `src/app/api/bets/place/route.ts:135` | SPEC.1 §16.5 · `F-MOD-1` | 0014, 0021 | `tests/server/moderation/`, `tests/integration/precommit-moderate.integration.test.ts` | — |
| Gate-block consequences (`mod_actions`, auto-ban, CSAM seam) | SHIPPED | `src/server/moderation/consequences.ts:75 (recordGateBlock)`, `:127`, `:188` | SPEC.1 §15 · `F-MOD-2` | 0021 | `mod_actions` + event: `tests/server/moderation/moderation-blocked-event.test.ts` · **auto-ban**: `tests/server/moderation/track-a.test.ts` · **CSAM seam**: `tests/server/moderation/csam-seam.test.ts` | — |
| Reactive removal — no held queue | SHIPPED | `src/server/admin/moderation/` | SPEC.1 §15 | 0020, 0021 | `tests/server/admin/moderation/` | — |
| **Removal masking on every body read** | SHIPPED | `loadRemovedSet` defined in `src/server/debate-view/load-debate-view.ts:486 (loadRemovedSet)`; **five call sites** — `:311` · `discovery/hero.ts:168` · `admin/moderation/review-feed.ts:233` · `profile/arguments.ts:434` · `profile/positions.ts:484` | SPEC.1 §15 | 0020, 0021 | `tests/server/debate-view/load-debate-view.integration.test.ts` (SC-1-compliant: asserts the **body**'s absence) · `tests/server/discovery/hero.test.ts` · `tests/server/admin/moderation/review-feed-completeness.integration.test.ts` · `tests/server/profile/{masking,arguments,positions}.test.ts` | CLAUDE.md §5.14 SC-1 fires on every new body read |
| Ranking — multi-mode composite | SHIPPED | `src/lib/ranking.ts`, `ranking.config.ts`, `ranking-decimal.ts`, substrate `src/server/debate-view/ranking-substrate.ts` | `docs/specs/RANKING.md` | 0017, 0039 | `tests/unit/ranking/` | `F-3` (numerics are a placeholder) |
| Ranking reads surviving basis, not frozen stake | SHIPPED | `src/server/debate-view/ranking-substrate.ts:166,170` | SPEC.2 §4 | 0039 R4 | **behavioural**: `tests/server/lots/rank-decay-parity.test.ts` (real rows through `loadRankingSubstrate`) · source scan: `tests/unit/ranking/substrate-site-parity.test.ts` | — |
| Self-authored replies excluded from attraction | SHIPPED | `src/server/debate-view/ranking-substrate.ts:146,151,168,172` (in `FILTER`, not the JOIN) | SPEC.2 §4 | 0039 P2 | `tests/unit/ranking/substrate-site-parity.test.ts:276` · behavioural: `tests/server/lots/rank-decay-parity.test.ts` | — |
| Two count pairs — displayed vs ranking input | SHIPPED | `src/server/debate-view/ranking-substrate.ts` | SPEC.2 §4 | 0039 P3 | `tests/unit/ranking/substrate-site-parity.test.ts` | — |
| Viewer-scoped debate reads | SHIPPED | `src/server/debate-view/viewer-context.ts`, `load-debate-view.ts` | `F-DEBATE-1` | 0034 | `tests/integration/viewer-context.integration.test.ts` | — |
| Debate view polling (client interval) | SHIPPED | `src/components/debate/DebatePoll.tsx`, `poll-phase.ts` | SPEC.1 §9 · `F-DEBATE-4` | — | `tests/server/debate-view/poll-contract.test.ts` | `F-3` (`POLL_INTERVAL_MS_DEBATE_VIEW` provisional) |
| Price chart on the debate view | SHIPPED | `src/components/debate/chart/`, `src/server/debate-view/price-chart.ts` | SPEC.1 §9 | — | `tests/unit/debate/chart/`, `tests/invariants/I-GENESIS-001.open-implies-market-opened-event.spec.ts` | — |
| Market quote read | SHIPPED | `src/app/(public)/m/[slug]/quote/route.ts`, `src/server/debate-view/quote.ts` | SPEC.1 §7 | — | `tests/integration/market-quote.integration.test.ts` | — |
| **`.md` export / AI mode** | SHIPPED | `src/app/(public)/m/[slug]/export/route.ts`, `src/server/debate-export/{serialize,context,market-meta}.ts`, button in `src/components/debate/MarketHeader.tsx` | SPEC.1 §21.3 | 0025 | `tests/integration/debate-export.integration.test.ts`, `tests/unit/debate-export/` | — |
| Reply foreclosure — single-side × Counter | SHIPPED | `src/server/comments/foreclosure.ts` (`computeReplyAffordance`, `readReplyAffordance`) | SPEC.1 §8 | 0017 | `tests/unit/comments/foreclosure.test.ts` (14 tests) | — |
| No stake, no voice — a comment requires a bet | SHIPPED | `src/app/api/bets/place/route.ts` step 5 | SPEC.1 §5 INV-1 · `F-COMMENT-5` | 0017 | `tests/server/comments/no-position.test.ts::comment-requires-bet` | — |
| Standalone comment (no bet) | **NOT BUILT — refused by design** | — | SPEC.1 §5 INV-1 | 0017 | `tests/server/comments/no-position.test.ts::comment-requires-bet` + `tests/invariants/I-ATOMICITY-001…::every-comment-has-a-referencing-bet-construction` | never |
| Friendly-fire vote as its own row | **REMOVED** | — | — | 0017 | `drizzle/migrations/0018_*` dropped `friendly_fire_events` | — |
| CSAM escalation seam (`csam_auto_report_pending`) | SHIPPED | `src/server/moderation/consequences.ts:188` | SPEC.1 §16.5 | 0014, 0021 | `tests/server/moderation/` | — |
| Vendor and reporting coverage beyond the shipped gate | **NOT BUILT** | — | — | 0014 | none | **`docs/parked.md` SCAFFOLD.16 §6 owns the scope and the resolution path — not restated here** |

### 2.1 · Ranking — the shape, and where the maths lives

⚠ **The formula is `docs/specs/RANKING.md` and is not restated here.** A second copy of a
scoring model is a future contradiction, and this one has already been renumbered once. What
a reader needs from this record is the *shape* and the *entry points*.

| | |
|---|---|
| Spec | `docs/specs/RANKING.md` — §2 the per-side substrate, §3 `Top` (the default order), §3.2 the margin, §3.4 ties, §3.5 the decay decision ADR-0017 left open |
| Pure scoring | `src/lib/ranking.ts` · config `src/lib/ranking.config.ts` · decimal arithmetic `src/lib/ranking-decimal.ts` |
| The read-time join | `src/server/debate-view/ranking-substrate.ts` |
| Guards | `tests/unit/ranking/` — `top-order`, `contested`, `interleave`, `replies`, `badges`, `column-routing`, `profile`, `substrate-site-parity` (8 files) |

**Three amendments changed what the substrate sums, and all three are load-bearing:**

1. **Surviving basis, not frozen stake.** `ranking-substrate.ts:166,170` reads
   `COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) …)`. A replier who sells down stops
   carrying the weight they no longer hold. The `COALESCE` fallback exists because a reply-bet
   predating `lots` has no lot row — the file says so at `:160`.
2. **Self-authored replies are excluded** (ADR-0039 P2). A reply whose author is the parent
   post's author counts toward none of the four ranking aggregates. ⛔ **The predicate sits in
   the aggregate `FILTER`, NOT in the JOIN** — `ranking-substrate.ts:146,151,168,172` carry
   `AND rc.user_id <> p.user_id` inside `FILTER (…)`, while `:212` is a bare
   `LEFT JOIN comments rc ON rc.parent_comment_id = p.id`. ⚠ **RANK-2 put it in the `ON` clause
   and RANK-3 had to move it**, because a JOIN predicate *removes* the row, so the displayed
   total could not be computed from the same query and a post whose only replies were its own
   would vanish from the listing entirely. A `FILTER` keeps the row and declines to count it.
   `tests/unit/ranking/substrate-site-parity.test.ts:276` asserts this by name and would red on
   a reversion.
3. **The counts are two numbers** (ADR-0039 P3). `support_count_total` / `counter_count_total`
   are what a surface **displays** and must equal what a reader can count on the page,
   self-authored and removed included. `support_count` / `counter_count` are the **ranking
   input**, never rendered — distinct people, self-authored excluded.

⚠ **Counts cannot fall and stake can, and that asymmetry is deliberate.** Counts are taken
over append-only rows, so a sale or a removal does not reduce them. Making them decay was
considered and rejected: *a count that falls when someone exits says the argument was never
made, and the reason `Sold` is permanent is that it was.* Decay is the right rule for how much
weight something carries and the wrong rule for whether it happened.

## 3 · The decisions that shaped it

| Decision | Recorded in | What it changed |
|---|---|---|
| Bet and comment commit in one SERIALIZABLE transaction | ADR-0013 | INV-1 became a property of the write path, not a convention |
| A reply **is** a Support/Counter bet; `REPLY_DEPTH_MAX = 1` | ADR-0017 | the friendly-fire vote and its table were deleted outright |
| Moderation runs before the transaction and fails closed | ADR-0014 | no HTTP inside a database transaction, anywhere |
| Reactive moderation, no held queue | ADR-0021 (supersedes 0020) | admin reviews live content; no moderation action touches a position |
| Content removal decoupled from user ban | ADR-0020 (retained half) | removing a body does not ban an author, and vice versa |
| The moderated bytes are the rendered bytes | ADR-0028 | an image cannot be swapped after it passes the gate |
| Viewer-scoped debate reads | ADR-0034 | what you see depends on who you are, computed server-side |
| Per-argument lot accounting | ADR-0039 | ranking follows the money that stayed, not the money that came |
| A post attracting its own author has attracted nobody | ADR-0039 P2 | self-replies stop counting toward traction |
| The counts are two numbers, one shown and one ranked | ADR-0039 P3 | the displayed count matches what a reader can count |
| The debate `.md` export, read-only and uncached | ADR-0025 | the AI-mode button has an artifact to hand over |

## 4 · Invariants and guards this lane carries

### 4.1 · Moderation failure posture, **per branch** — the section most often misread

⚠ **ADR-0014 is titled "Pre-Commit Moderation Flow" and the filename reads like a gate.
It is not a gate in the queue sense — there is no held queue (ADR-0021).** It is a
synchronous, awaited classifier call whose *failure* refuses the write. The distinction
matters because a developer who believes moderation is a queue will defend a background call,
and a background call here would admit unclassified content.

**Where it sits.** `src/app/api/bets/place/route.ts:135` — `await precommitModerate({…})` —
step 6, with the transaction opening at `:197` (`await runBetTransaction`). ⛔ **Outside the
transaction, before it, always.** `precommitModerate` has **exactly one call site in `src/`**. ⚠ The naïve grep does not show
that: `git grep -n 'precommitModerate(' -- src/` returns **two** lines — the call at
`place/route.ts:135` **and its own declaration** at `precommit.ts:75 (precommitModerate)`. Anchoring on the call
form is what makes it a measurement: `git grep -n 'await precommitModerate(' -- src/` returns
**one**, against the control `git grep -n 'await runBetTransaction(' -- src/`, which returns
**two** (`place/route.ts:197`, `sell/route.ts:82`) — so the anchored shape does find multiple
real call sites when they exist.

**Text and image are the same call.** An attached image is not classified at upload time —
`src/app/api/uploads/sign/route.ts` contains no moderation import (0; positive control: the
place route has 2, at `:26` and `:27`). Instead `precommit.ts:113` mints a **60-second
single-use signed READ URL** and `openai.ts` appends it as an `image_url` part to the same
`moderations.create` call. **One awaited multimodal call covers both.**

| Branch | Where | Retries | Sentry tag | Outcome |
|---|---|:-:|---|---|
| Reservation already held (`SET NX` returns non-OK) | `precommit.ts:86-91` | — | — | `ModerationInFlightError` → **HTTP 409 `error_moderation_in_flight`**, `Retry-After: 2` (`src/server/bets/errors.ts:375`) |
| Bad `imageR2Key` shape or cross-user namespace | `precommit.ts:96-111` | — | — | `ModerationUnavailableError` → **503** |
| Signed-read mint failure | `precommit.ts:113-118` | — | — | `ModerationUnavailableError` → **503** |
| **Transient** — connection, timeout, user-abort, 5xx, 429 | `openai.ts:59-67`, loop `:88` | **1** (`OPENAI_MAX_RETRIES`) | `openai_moderation_upstream_failure` (`:162`) | after the retry, `ModerationUnavailableError` (`:164`) → **503** |
| **Auth** — 401 / 403 | `openai.ts:141-147` | ⛔ **none** | `openai_moderation_auth_failure` (`:145`) | immediate **503**. Retrying a bad key only burns the vendor's rate limit |
| **Malformed-flagged** — `flagged === true` with no category true | `openai.ts:113-119` | ⛔ none (re-thrown at `:139`) | `openai_moderation_malformed_flagged` (`:117`) | immediate **503**. ⚠ **This branch exists because the alternative is a fail-OPEN on a legal-floor gate:** the mapper reads specific category booleans, so a flagged-with-no-category response would fall through to `pass` |
| Empty results | `openai.ts:96` | — | `openai_moderation_upstream_failure` | **503** |
| Any other non-transient | `openai.ts:149-155` | ⛔ none | `openai_moderation_upstream_failure` | **503** |

⇒ **Every terminal branch fails CLOSED, to `503 error_moderation_unavailable`** with
`retryAfter: 5` in the body (`errors.ts:380`). A 503 is ≥ 500, so the endpoint does **not**
cache it and a client retry genuinely re-attempts. Timeout is `AbortSignal.timeout(3000)`
(`openai.ts:92`); the Redis reservation is released in a `finally` (`precommit.ts:165`), so a
crash between `SET NX` and `DEL` self-heals after `RESERVATION_TTL_SECONDS = 10`.

**Verdict mapping** (`precommit.ts:148-156`), in evaluation order: `sexual/minors` **with an
image** → `track_a`; `sexual/minors` **text-only** → `track_b` (the ruled carve-out, because
a text classifier's false positives are mitigated by admin review); adult `sexual` **with an
image** → `track_a` (the CSAM-image backstop while PhotoDNA is parked); anything else flagged
→ `track_b`; otherwise `pass`. **Both tracks abort the bet — the transaction never opens.**

⛔ **The admin market-media upload path is deliberately NOT moderated** — ADR-0027 supersedes
ADR-0026 §D4. That is the admin lane's fact and lives in `docs/records/ADMIN-record.md` §4.

### 4.2 · Invariants

| Invariant | Mechanism, with the line |
|---|---|
| **INV-1** — bet ↔ comment atomicity | one SERIALIZABLE transaction wraps both inserts (`src/server/bets/transaction.ts`); `bets.comment_id` is `NOT NULL`. ⚠ `comments.bet_id` is **deliberately nullable** — the pair is circular and the comment is inserted before its bet exists, and Bucket-A append-only forbids a back-fill. **It is not a pending migration.** `tests/invariants/I-ATOMICITY-001…` |
| **INV-2** — Dharma non-transferable, no overdraft | append-only `dharma_ledger`, `CHECK (balance_after >= 0)`, **no transfer table by design**. `tests/invariants/I-NO-OVERDRAFT-001…` |
| **INV-3** — comments side-bound at post time | `comments.side_at_post_time` written at INSERT and immutable after, enforced by the **whole-row** Bucket-A trigger rather than a column-scoped one (`drizzle/migrations/0003_append_only_triggers.sql`). ADR-0005 P1 explains why a bespoke column trigger was rejected: it would only *relax* the table. `tests/invariants/I-SIDE-BIND-001…` |
| **INV-4** — resolutions append-only | `resolution_events` + `payout_events` immutable post-INSERT. `tests/invariants/I-APPEND-ONLY-001…` |

**Removal masking is a property of every body read, not of rows.** `loadRemovedSet` is
extracted once in `load-debate-view.ts:486 (loadRemovedSet)` and reused — never re-implemented — at **five**
call sites: `load-debate-view.ts:311`, `discovery/hero.ts:168`,
`admin/moderation/review-feed.ts:233`, `profile/arguments.ts:434` and
`profile/positions.ts:484`. **The last two are body reads on Profile** and are easy to miss
when enumerating "the debate surfaces". ⚠ **The two `load-debate-view.ts` numbers above were
`:461` and `:287` when this record was generated, and were correct then** — measured at
`ead7415`. PR #470 (`613982c9`) added 25 lines to that file and moved them; corrected against
`e945b760` at SYNC-6 · VERIFY. The other four call sites did not move, which is the tell that
this was drift rather than a mis-read. `hero.ts:142-143` says so
explicitly: *"the SAME masking primitive F-DEBATE-1's debate view enforces
(extracted-and-exported, never re-implemented)"*. ⚠ **CLAUDE.md §5.14 SC-1 fires on any PR
that adds or edits a read over `comments`**, and it exists because a second read path in one
file once leaked a removed parent's body onto staging. A test for this must assert the
**body's** absence, not the row's.

**The golden rule this lane must never break:** no HTTP call inside `db.transaction(...)`.
`consequences.ts:14` records that when `recordGateBlock` runs there is no reservation held and
no HTTP in flight — it is a pure-DB transaction opened *after* the classifier is done.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| ENGINE.7 / .8 | #93, #99 | `7dc22d8`, `66fa532` | 2026-06-09 | W-1 bet-transaction wrapper; side-bind minted as `I-SIDE-BIND-001` |
| DEBATE.2 | #136 | — | 2026-06 | the image reaches the classifier seam; post-time side capture |
| Reactive moderation foundation | #143 | `02f87ac` | 2026-06-19 | gate consequences + `mod_actions` |
| DEBATE.7 smoke | #151 | `07f6972` | 2026-06-21 | moderation smoke close-out |
| AUDIT-FIX-B5 | #205 | `01a9d0c` | 2026-07-05 | `moderation.blocked` emit (A13) + event-id-reuse guard (A30) |
| LOTS-1 | #380 | — | 2026-08-21 | per-argument lot accounting (ADR-0039) |
| RANK-1 | #391 | — | 2026-08-22 | rank follows the money that stayed |
| **RANK-2** | **#394** | `073f65e` | **2026-09-02** | a post attracting its own author is not attracting anything |
| FEED-1 / FEED-2 | #400, #401 | — | 2026-08-24 | the author sees the post they just made, where the bet was |
| RPLY-1 / -2 / -3 | #417, #418, #419 | — | 2026-08-26 | the reply surface, the composer's fit, the composer's grid |
| CRIT-1 | #427 | — | 2026-08-27 | the resolution criterion returns to `/m/[slug]`, collapsed |
| CHART-1 … CHART-7 | #425, #429, #437, #453, #455 | — | 2026-08-27 → 09-01 | the market price chart, concluded over seven passes |
| **AIMODE-1** | **#466** | `e193cfb` | **2026-09-03** | the debate `.md` export becomes the AI-mode button |

⚠ **`docs/logs/` has no `RPLY-1` or `RPLY-2` log** — only `RPLY-3.md` — and no `FEED` log
beyond what `docs/logs/FEED-1.md` / `FEED-2.md` carry. Where a lane has no session log:
**no repository record — the PR merged the work; the lane has no session log.**

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-3` | 26 constants still `TBD` in SPEC.1 Appendix B; 13 ship as labelled placeholders. The comment length, the post floor, the poll interval and every ranking numeric are among them |
| `docs/STATE.md` §4 · `F-5` | `ResolverCards.tsx:56-60` states placeholder arithmetic that does not work; `AGENTS.md` copied the result |
| `docs/parked.md` — SCAFFOLD.16 §6 | the deferred moderation-coverage scope, with its resolution path |
| `docs/parked.md` — SCAFFOLD.16 §1.1 | the Track A text/image asymmetry rationale (LD-3) |
| `docs/parked.md` — UI-6 Gate C D1 | review-feed prior-flag count is blind to content removals |
| `docs/parked.md` — UI-6 Gate C D2 | moderation image TTL too short for a browsing surface |
| `docs/parked.md` — UI-6 Gate C D3 | review-feed `innerJoin(users)` — armed on the next `review-feed.ts` touch |
| `docs/parked.md` — UI-6 Gate C D4 | no un-ban affordance (founder decision) |
| `docs/parked.md` — RPLY-CLOSE P1 | the market-arm position readout lies while a composer is open |
| `docs/parked.md` — RPLY-CLOSE P3 ×4 | reply-surface viewport and parity gaps |
| `CLAUDE.md` §5.14 SC-1 | standing per-PR check: masking is a property of every body read |
