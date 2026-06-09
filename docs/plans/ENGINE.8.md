# ENGINE.8 — Bet-flow handlers (place.ts + sell.ts + the §3.1 handler stack)

> **Status:** Ratified — WEB GREEN + founder ratification (2026-06-09). Docs-only plan; no engine code lands in the plan phase. Execute is a **separate fresh CC session + fresh web chat** (§5.8). Rev 2 = founder rulings Q1–Q4 + WEB CP review R1–R4 + A–C folded.
> **Task:** the per-flow bet handlers that consume the merged ENGINE.7 `runBetTransaction` wrapper — `src/server/bets/place.ts` (F-BET-1/2), `src/server/bets/sell.ts` (F-BET-3), the two `src/app/api/bets/{place,sell}/route.ts` Route Handlers running the full §3.1 stack, the two-floor validator, the §4.4 wire envelope + bet product codes, `I-SIDE-BIND-001`, and the 2 handler concurrency tests.
> **Base:** `main` @ `cf461e8` (ENGINE.7 execute merged: wrapper #95 `37dae5a` + log #96 `cf461e8`). Greenfield: `src/server/bets/{place,sell}.ts` + `src/app/api/bets/` absent.

---

## Context

ENGINE.7 shipped the generic, flow-agnostic W-1 wrapper (`runBetTransaction`) — SERIALIZABLE open · `pools … FOR NO KEY UPDATE` · coarse market-state gate · full-jitter retry · alarm-3 · `BetSerializationExhaustedError`/`MarketNotOpenError`. It deliberately owns **nothing** flow-specific. ENGINE.8 is the consumer: the per-flow callbacks that run the 4-table spine inside the wrapper, plus the §3.1 handler stack around them. This is the most write-contended *participant-facing* path (the money + INV-1 + INV-3 surface) — full ritual, Ultrathink-mandatory.

Recon confirmed every dependency is built and merged (wire, don't build): cpmm, dharma, positions, events, idempotency, rate-limit (`betPerIp`), moderation (`precommitModerate`), origin (`checkOrigin`), auth (`getSession` + `session-gate`), and the `users.banned_at` substrate for F-BET-7. The §15 error catalogue (`error-codes.md`) + six-field §15.1 envelope are **not** built; the wire shape is §4.4.

## Founder rulings folded (this cycle)

- **Q1 — Reply seam (parameterized write).** ENGINE.8 ships **F-BET-1/2 (post-bets) + F-BET-3 (sell)** + the **two-floor validator** (both constants `BET_MIN_STAKE_POST`/`BET_MIN_STAKE_REPLY` + both codes `below_post_floor`/`below_reply_floor` + the floor-selection rule). The INV-1 atomic comment+bet **write is built ONCE, parameterized** (`parentCommentId: string | null` + floor), so it lives in ENGINE.8 under full ritual and **DEBATE.2 reuses it** (never re-touches the SERIALIZABLE write). ENGINE.8 **exercises only the POST floor** on its post-bet routes; **DEBATE.2 (F-COMMENT-2) owns the reply-floor exercise** (`below_reply_floor`), reply preconditions (`parent_comment_not_found` 404, `reply_depth_exceeded` 400, `REPLY_DEPTH_MAX=1`), and replier side-inheritance — calling ENGINE.8's write with a validated `parentCommentId`. `I-SIDE-BIND-001` (INV-3) stays ENGINE.8. *Basis: SPEC.1 §8 F-COMMENT-2 (:376) puts `below_reply_floor` + reply preconditions in the F-COMMENT-2 flow = DEBATE.2 per tracker.*
- **Q2 — Full §3.1 stack + Route Handlers in ENGINE.8.** Build `src/app/api/bets/{place,sell}/route.ts` running all 7 steps (origin → auth → idem-validate → idem-lookup → rate-limit → moderation [PLACE only; sell skips per §3.1] → wrapper → cache-write), reusing built primitives at the named constants' **placeholder** values (HARDEN.6 owns the numbers). **Reuse `middleware/origin-allowlist.ts`** — do NOT create the SPEC-named `src/server/bets/origin-check.ts` (record the drift). *Basis: §3.1 binds the full stack to every state-mutating handler; the 2 handler tests + the Idempotency-Key header require the Route Handler + idem + moderation wired; uploads/sign is the precedent. Partial stack = insecure money endpoint + the 2 named tests un-buildable.*
- **Q3 — Coarse Resolving → `market_resolving` (409).** Reserve `error_in_flight_timeout` (400) for the deferred fine window (carry-forward 1). Closed stays `error_market_closed_at` (400). Overrides the `bets/errors.ts` docstring suggestion. *Basis: SPEC.1 F-BET-1 (:281) specifies 409 `market_resolving`; F-BET-6 (:323) is the 400 fine-window code; the 400/409 asymmetry is spec-locked.*
- **Q4 — §4.4 wire envelope (not bare `{error}`, not six-field §15.1).** Emit `{ ok: false, error: { code, message, retry_after? } }` (§4.4). Mint the bet product codes as stable strings. **Leave** §15.1 catalogue metadata (`error_type`/`retry_semantics`/`field_errors`) + `error-codes.md` + the §15.5 lint as the already-scoped forward (ENGINE error-envelope / HARDEN) deliverable. Record uploads/sign's bare `{error}` as a pre-existing **under-§4.4 gap owned by that forward task** (NOT an ENGINE.8 retrofit). Thin Route-Handler formatter, not a new cross-cutting module. *Basis: §4.4 is the binding locked Route-Handler contract; SPEC.1 F-* rows are code+status pairs.*

### §4.4 wire shape (verbatim, the binding contract)
> Success: `{ ok: true, data: <flow-specific-shape> }`. Error: `{ ok: false, error: { code, message, retry_after? } }`. `retry_after` present iff HTTP status is 429 / 503. Every Route Handler response carries `X-Request-Id` echoing the `proxy.ts` request id.

### §15.1 split (verbatim, what we DEFER)
> The six-field envelope (`code, message, error_type, retry_semantics, retry_after, field_errors`) is the forward catalogue-metadata layer; `docs/specs/error-codes.md` is a **named forward deliverable** (ENGINE error-envelope work), and the §15.5 cross-reference CI lint is a **HARDEN-phase deliverable**. ENGINE.8 emits the §4.4 wire subset only.

---

## WEB CP review — fixes folded (rev 2)

- **R1 — write-order + `dharma_ledger.bet_id`.** Verified merged schema: `dharma_ledger.bet_id` is **nullable, FK → bets.id** (`dharma.ts:49`). The `bet_stake` debit **links to the bet** (`bet_id = bet.id`) → **bets-before-`dharma_ledger`** required. Chosen place order: **`positions → comments → bets → dharma_ledger(bet_id=bet.id) → events → pools`**. Deviation from the ENGINE.7 boundary spine (`positions → dharma_ledger → comments → bets → events`) is explicit: comments+bets move **ahead** of `dharma_ledger` so the FK is satisfiable. **Passes the merged `bets::canonical-lock-order` test** — verified (`concurrency.test.ts:271–342`): it asserts only **zero `friendly_fire_events` rows + the spine rows exist**, NOT an instrumented positional order; the 4-table relative order `positions → dharma_ledger → events` is preserved, and comments/bets-before-`dharma_ledger` does not trip it.
- **R2 — moderation verdict codes corrected** to the SPEC.1 flow forms (canonical-9): `track_a → comment_track_a_blocked` (400), `track_b → comment_track_b_under_review` (**423**) — F-COMMENT-1 (:367). Per F-MOD-4 both Track A and Track B **abort the entry**, so `place` maps a `track_b` verdict to `comment_track_b_under_review` (423) too (F-BET-1:281 omits track_b, but F-MOD-4 governs). Keep ADR-0014 `error_moderation_in_flight` (409) / `error_moderation_unavailable` (503). (Supersedes the prior C1 §15.4 `error_moderation_track_a/b` form.)
- **R3 — TWO events per place: `bet.placed` + `comment.placed`** (resolved in-plan, not execute). Basis: the merged ENGINE.0 payload schemas carry **disjoint** fields (`bet.placed`: stake/shares/price; `comment.placed`: bodyLength/uploadId) and `schemas.ts` slates `comment.placed`'s emit site to ENGINE.7-8; ADR-0005 appends one event per state change (bet row + comment row = two). SPEC.2 §5.4/§7 (read-time-computed, no projection table) does not consume these — they are the event-sourced audit log, so both are still emitted. **Consequence:** the retry-purity contract now generates **two** `event_id`s at handler entry, both closed over; the events-idempotency assertion extends to **two stable rows**.
- **R4 — sell representation** (resolved in-plan): a comment-free sell writes **no `bets` row** (bets.comment_id NOT NULL) and **no `comments` row**. `bet.sold`: **`aggregateType:"market"`, `aggregateId:marketId`** (CP lean + the merged ENGINE.7 precedent `concurrency.test.ts:311–312`); `payload.betId` = a **fresh UUIDv7** generated at handler entry (synthetic sale id, not FK-bound — matches `concurrency.test.ts:314`); **`dharma_ledger.bet_id = null`** for the sell credit (no bets row; FK-safe; matches the ENGINE.7 representative `appendLedgerRow` with no betId). Sell credit tag = **`bet_stake` positive amount** (CP-confirmed fine; `bet_payout` reserved for resolution per `FLOW_TAGS`).
- **A (folded) — onboarding gate demoted.** The Better Auth **session-deferral hook** (`session-gate.ts`, SPEC.2 §8.3) throws `ONBOARDING_REQUIRED` **before any `sessions` row is written** — a valid participant session already guarantees `pseudonym` + `tos_accepted_at`. Step 1's onboarding-403 is therefore a **defensive assertion** (defense-in-depth, mirrors `uploads/sign`), never fires for a valid session.
- **B (folded) — slippage F-BET-9 is UI-only in v1.** The bet executes at the **locked-snapshot price**; there is **no server-side max-price guard / slippage param** on the bet endpoints. `SLIPPAGE_WARNING_PCT_THRESHOLD` drives a client pre-confirm modal (F-BET-9:335) only. A server-side slippage-protection param is a HARDEN/testnet candidate — stated, not built.
- **C (folded) — idempotency `release` in `finally`, explicit.** On the `miss` arm, wrap the handler body in `try { … } finally { … }`: `release(completedResponse)` on success **or terminal cached-error** (4xx product errors + 429 are cached per §11), `release(null)` (DEL the sentinel) on an **uncaught crash or transient 503** so a retry can re-attempt cleanly (ADR-0015 §4).

---

## Approach (one paragraph)

Two thin Node-runtime Route Handlers (`/api/bets/place`, `/api/bets/sell`) each run the §3.1 stack against already-built primitives, generate the `event_id`(s) + `metadata.idempotency_key` **once at handler entry** (retry-purity; two event_ids for place, one for sell), then invoke `runBetTransaction({ marketId, flow }, callback)` where the callback is the per-flow server-layer function (`place.ts` / `sell.ts`). `place.ts` exports a single **parameterized** comment-bearing-bet write (the INV-1 atomic `comments`-then-`bets` insert + the 4-table spine) that ENGINE.8's place route calls with `parentCommentId: null` + the post floor, and DEBATE.2 later calls with a validated parent + the reply floor. `sell.ts` runs a comment-free subset of the spine. The product errors are mapped to the §4.4 wire envelope by a thin bets-local formatter; the six-field §15.1 catalogue stays forward.

---

## The handler stack (per route; §3.1 + §4.3 origin defense)

`POST /api/bets/place` (F-BET-1/2 — comment-bearing) and `POST /api/bets/sell` (F-BET-3 — comment-free) share the stack; **sell skips step 6 (moderation)**.

| # | Step | Primitive (built) | place | sell |
|---|---|---|---|---|
| 0 | **Origin** (§4.3) | `checkOrigin(request)` (`middleware/origin-allowlist.ts`) → 403 `error_origin_not_allowed` | ✓ | ✓ |
| 1 | **Auth + ban** (+ defensive onboarding) | `auth.api.getSession` → 401 `error_session_required`; `users.banned_at IS NOT NULL` → 403 `banned_user` (F-BET-7); onboarding (pseudonym+tosAcceptedAt) → 403 is a **defensive assertion only** (session-deferral hook already guarantees it — opt-A) | ✓ | ✓ |
| 2 | **Idem-key validate** | header present + `IDEMPOTENCY_KEY_REGEX` → 400 `error_idempotency_key_required`/`error_idempotency_key_invalid` | ✓ | ✓ |
| 3 | **Idem cache lookup** | `computeBodyFingerprint` + `idempotencyLookupOrReserve` → hit=replay · mismatch=409 `error_idempotency_key_reused` · pending=409 `error_idempotency_in_flight`+Retry-After 2 · unavailable=503 `error_idempotency_unavailable`+Retry-After 5 · miss=hold `release` (**MUST precede step 4** — §3.1 ordering invariant) | ✓ | ✓ |
| 4 | **Rate-limit** | `checkRateLimit("betPerIp", ipIdentifier(ip))` → 429 `error_rate_limit_exceeded`+Retry-After (fails open) | ✓ | ✓ |
| 5 | **Body validate (zod)** | marketId uuid · side YES/NO · stake `numericString`>0 · body length ∈ [1, `COMMENT_MAX_LENGTH`] → `comment_too_long` · **post floor** check → `below_post_floor` | ✓ | sell: shares>0, no comment |
| 6 | **Pre-commit moderation** | `precommitModerate({text,imageR2Key?,idempotencyKey,userId,marketId})` → pass / track_a→`comment_track_a_blocked` (400) / track_b→`comment_track_b_under_review` (**423**); in-flight=409 `error_moderation_in_flight`; unavailable=503 `error_moderation_unavailable`. **Outside the tx** (ADR-0014) — both tracks abort the entry per F-MOD-4 [R2] | ✓ | **skipped** |
| 7 | **Transaction** | `runBetTransaction({marketId, flow}, callback)` — the spine; **both** `event_id`s (`bet.placed`+`comment.placed`) + `idempotency_key` closed over (retry-purity) [R3] | ✓ | ✓ |
| 8 | **Events + cache** | `insertEvent` (×2 place / ×1 sell) terminal **inside** the tx; `release(...)` in a `finally` **outside** the tx — `release(response)` on success/terminal-cached-error, `release(null)` on crash/transient-503 (opt-C); echo `X-Request-Id` | ✓ | ✓ |

---

## The callback spines (ENGINE.8 builds)

**place.ts — comment-bearing bet (F-BET-1 entry / F-BET-2 subsequent), parameterized.** Write order **`positions → comments → bets → dharma_ledger → events → pools`** [R1 — FK-driven; deviates from the ENGINE.7 boundary spine so the `bet_stake` debit can link `bet_id`]:
```
// READS in the locked snapshot:
heldSideOrNull / canEnter(tx, {userId, marketId})   // F-BET-1 entry no-position / F-BET-2 same-side / F-BET-10 opposite → opposite_side_held
readBalance(tx, userId)                              // F-BET-4 sufficiency (carry-forward 2 — see seam below)
computeBuy({reserves: pool, side: lower(side), stake})  // ENGINE.2; case-translate YES/NO → yes/no
// WRITES (positions → comments → bets → dharma_ledger → events → pools):
positions upsertPositionDelta(tx, {userId, marketId, side, shareDelta:+shares})   // NO previousQuantity (S4)
comments  INSERT  { side_at_post_time=side (INV-3), stake_at_post_time=stake (S3 NOT-NULL trap),
                    parent_comment_id=parentCommentId (null here; DEBATE.2 passes a value), bet_id=NULL (Bucket-A; stays null in v1) }
bets      INSERT  { comment_id=comment.id, side, stake, share_quantity=shares, price_at_bet, idempotency_key }   // comment-before-bet (FK)
dharma_ledger appendLedgerRow(tx, {userId, amount:-stake, entryType:"bet_stake", betId:bet.id, previousBalance})  // bet_id=bet.id → bets-before-dharma_ledger [R1]
events    insertEvent(tx, {eventId:betEventId, eventType:"bet.placed", aggregateType:"bet", aggregateId:bet.id, payload, metadata})      // [R3] event #1
events    insertEvent(tx, {eventId:commentEventId, eventType:"comment.placed", aggregateType:"comment", aggregateId:comment.id, ...})    // [R3] event #2 (TERMINAL)
pools     UPDATE reserves = computeBuy.reserves   // the locked row
```
**sell.ts — comment-free (F-BET-3):** subset — no `comments`/`bets` inserts (comment-free; `bets.comment_id` NOT NULL forbids a bet row). `heldSideOrNull` → `position_not_held` if none; `computeSell` → `proceeds`; `upsertPositionDelta(−sharesSold)`; `appendLedgerRow(+proceeds, "bet_stake", betId:null)` [R4 — FK-safe, no bets row]; `insertEvent({eventId:sellEventId, eventType:"bet.sold", aggregateType:"market", aggregateId:marketId, payload:{betId:freshUuidv7, …}})` [R4]; `pools` UPDATE.

**Retry-purity (load-bearing):** the place flow generates **two** `event_id`s (`betEventId` + `commentEventId`) — and the sell flow one (`sellEventId` + the synthetic `payload.betId`) — plus `metadata.idempotency_key`, **all at handler entry, ONCE, closed over** the callback; never per attempt (the wrapper re-runs the whole callback; `insertEvent` derives `created_at` from each UUIDv7 prefix + dedupes on `ON CONFLICT (event_id, created_at)`). [R3/R4]

---

## The two-floor validator (Q1)

- **Constants** → `src/server/config/limits.ts`: `BET_MIN_STAKE_POST` (placeholder, ~10, HARDEN.6) + `BET_MIN_STAKE_REPLY = 50` (pinned, ADR-0018). Literal pins, JSDoc-cited.
- **Validator** → `src/server/bets/floors.ts` (pure, reused by DEBATE.2): `assertStakeFloor({ parentCommentId, stake }) → throws BelowPostFloorError | BelowReplyFloorError`. Selection rule: `parentCommentId === null ? POST : REPLY`. Unit-tested on **both** branches in ENGINE.8 so DEBATE.2 inherits a tested validator; ENGINE.8's routes exercise only the post branch.

## §4.4 wire envelope + bet product codes (Q4)

Bets-local formatter maps thrown errors → `{ ok:false, error:{ code, message, retry_after? } }` + the HTTP status. Mint, mirroring the existing `bets/errors.ts` pattern (`extends Error` + static `httpStatus`/`code`/`retryAfter` — the `BetSerializationExhaustedError`/`MarketNotOpenError` precedent):

| code | HTTP | retry_after | source |
|---|---|---|---|
| `insufficient_dharma` | 400 | — | F-BET-4 (payload: balance, required) |
| `below_post_floor` / `below_reply_floor` | 400 | — | ADR-0018 (reply exercised by DEBATE.2) |
| `opposite_side_held` | 400 | — | F-BET-10 (payload: current side, shares) |
| `position_not_held` | 400 | — | F-BET-3 |
| `comment_too_long` | 400 | — | F-COMMENT (length) |
| `banned_user` | 403 | — | F-BET-7 |
| `error_market_closed_at` | 400 | — | MarketNotOpenError(Closed) |
| `market_resolving` | 409 | — | MarketNotOpenError(Resolving) [Q3] |
| `error_bet_serialization_exhausted` | 503 | 1 | wrapper (already minted) |
| `comment_track_a_blocked` | 400 | — | moderation track_a [R2] — F-COMMENT-1 |
| `comment_track_b_under_review` | **423** | — | moderation track_b [R2] — F-COMMENT-1; both tracks abort the entry (F-MOD-4) |
| `error_moderation_in_flight` / `error_moderation_unavailable` | 409 / 503 | 2 / 5 | ADR-0014 (built `precommit.ts`) |
| `error_idempotency_*` / `error_rate_limit_exceeded` | 400/409/429/503 | per layer | ADR-0015 (built `types.ts`) |

`error_type`/`retry_semantics`/`field_errors` deliberately **omitted** (forward §15.1). uploads/sign's `{error}` shape untouched (forward task's gap).

---

## Carry-forwards consumed / minted

- **carry-forward 2 (CONSUMED) — balance read.** Recommend promoting `readLatestBalance` → exported **`readBalance(tx, userId)`** in `src/server/dharma/persist.ts` (one-line touch of ENGINE.5's module — flagged cross-module), thread its value into `appendLedgerRow({previousBalance})`. ENGINE.8 needs the value for the friendly `insufficient_dharma` pre-check regardless; the `DharmaOverdraftError` + `CHECK(balance_after>=0)` remain the authoritative backstop.
- **carry-forward 3 (CONSUMED, scoped) — error envelope.** ENGINE.8 wires the §4.4 wire subset only; six-field §15.1 + `error-codes.md` + §15.5 lint stay forward (Q4).
- **carry-forward 1 (UNTOUCHED) — fine F-BET-6 window.** No `markets.resolving_at`; coarse gate rejects all Resolving bets as `market_resolving` (Q3). `error_in_flight_timeout` reserved.
- **NEW drift records (do NOT fix here):** (i) SPEC.2 §4.3 names `src/server/bets/origin-check.ts` as origin SoT, but the built artifact is `middleware/origin-allowlist.ts` — reuse it; (ii) origin code drift: `origin_not_allowed` (§4.3) / `error_origin_rejected` (uploads/sign) / `error_origin_not_allowed` (§15.4) — use the §15.4 catalogue form.

---

## File plan

| File | State | Contents |
|---|---|---|
| `src/app/api/bets/place/route.ts` | NEW | F-BET-1/2 Route Handler — §3.1 stack (incl. moderation) → `place.ts` write. `parentCommentId: null`, post floor. |
| `src/app/api/bets/sell/route.ts` | NEW | F-BET-3 Route Handler — §3.1 stack minus moderation → `sell.ts`. |
| `src/server/bets/place.ts` | NEW | Parameterized comment-bearing-bet write (the wrapper callback) + F-BET pre-tx orchestration. Exported for DEBATE.2 reuse. `server-only`. |
| `src/server/bets/sell.ts` | NEW | Comment-free sell callback. `server-only`. |
| `src/server/bets/floors.ts` | NEW | `assertStakeFloor` two-floor validator (reused by DEBATE.2). |
| `src/server/bets/errors.ts` | EDIT (additive) | Bet product error classes (`InsufficientDharmaError`, `BelowPostFloorError`, `BelowReplyFloorError`, `OppositeSideHeldError`, `PositionNotHeldError`, `BannedUserError`, `CommentTooLongError`) + the §4.4 wire formatter, mirroring the existing static-fields pattern. |
| `src/server/config/limits.ts` | EDIT (additive) | `BET_MIN_STAKE_POST` (placeholder) + `BET_MIN_STAKE_REPLY = 50` (pinned). |
| `src/server/dharma/persist.ts` | EDIT (1-line) | Export `readBalance(tx, userId)` (carry-forward 2; cross-module — flag to `@code-reviewer`). |
| `tests/invariants/I-SIDE-BIND-001.*.spec.ts` | NEW | INV-3 callback-level (RED first). |
| `tests/server/bets/*.test.ts` | NEW | 2 handler concurrency tests + F-BET acceptance scenarios (RED first). |

No schema, no migration (the `readBalance` export is a server module, not `src/db/`). → **no `@db-migration-reviewer`.**

## Thesis invariants touched

- **INV-1 (atomic bet+comment) — EXERCISED.** ENGINE.7 minted `I-ATOMICITY-001` wrapper-level; ENGINE.8's full place flow is the acceptance-level exercise (`tests/server/bets/atomicity.test.ts::happy-path-entry`).
- **INV-2 (no overdraft) — EXERCISED at the seam.** F-BET-4 in-snapshot `readBalance` pre-check (friendly) + the `appendLedgerRow` `DharmaOverdraftError`/`CHECK` (authoritative). `I-NO-OVERDRAFT-001` exists; ENGINE.8 adds the friendly-path acceptance test.
- **INV-3 (side-bound at post time) — MINTED `I-SIDE-BIND-001`.** The `comments.side_at_post_time` write lives in `place.ts`. Canonical assertion: post a comment-bearing bet (side X), then sell-to-zero + re-enter side ¬X (flip), assert the original comment's `side_at_post_time` is STILL X (unchanged). Side-bound at post-time, immutable across the flip.
- **INV-4** — not relevant (resolution / W-3 / ENGINE.9).

## Test plan (RED-first via `@test-writer`)

- `I-SIDE-BIND-001` (invariant, INV-3) — the flip-doesn't-move-frozen-side assertion.
- The 2 handler concurrency tests (`tests/server/bets/`): `idempotency-replay-skips-moderation-and-txn` (a replay returns the cached response without re-running moderation/tx — steps 3→5/7 short-circuit), `moderation-outside-transaction` (moderation runs before `db.transaction` opens — ADR-0014 / §3 HTTP-not-in-tx).
- F-BET acceptance scenarios (SPEC.1 §7 paths): happy entry/subsequent/sell, `insufficient_dharma`, `opposite_side_held`, `position_not_held`, `banned_user`, `market_resolving`(409)/`error_market_closed_at`(400), `comment_too_long`, `comment_track_a_blocked`(400)/`comment_track_b_under_review`(423), both floor branches.
- Events-idempotency [R3]: a successful place writes **exactly two** event rows (`bet.placed`+`comment.placed`), each `created_at` stable across a forced retry; the sell writes exactly one (`bet.sold`).
- DB-backed → CI-RED locally (`:54322` down — whole-suite-needs-Postgres convention); `tests/unit/bets/` (floor validator, code formatter) is the local proxy.

## Out of scope (stated so execute does not drift)

DEBATE.2 reply-bet exercise (`below_reply_floor`, parent preconditions, side-inheritance) — ENGINE.8 ships the parameterized write + validator, not the reply route. The six-field §15.1 envelope + `error-codes.md` + §15.5 lint (forward). `markets.resolving_at` + fine F-BET-6 window (carry-forward 1). **Slippage F-BET-9 — UI-only in v1** (no server-side max-price guard; bet executes at the locked-snapshot price — opt-B posture, stated). A server-side slippage param is a HARDEN/testnet candidate. The `src/server/bets/origin-check.ts` SoT rename (drift recorded). Rate-limit/floor/moderation constant **values** (HARDEN.6). DEBATE.8/9 schema reconciliation (`comments.bet_id`/`stake_at_post_time`/friendly-fire).

## Resolved in rev 2 (was "open execute-details" — now decided in-plan per CP R2–R4)

- **C1 → R2 (RESOLVED):** moderation codes are `comment_track_a_blocked` (400) + `comment_track_b_under_review` (423), per F-COMMENT-1. Not the §15.4 `error_moderation_track_a/b` forms.
- **C2 → R3 (RESOLVED):** **two** events per place (`bet.placed` aggregate "bet" + `comment.placed` aggregate "comment"); two handler-entry `event_id`s; events-idempotency = two stable rows.
- **C3 → R4 (RESOLVED):** sell credit tag `bet_stake` (positive). `bet.sold` aggregate is **market-scoped** (`aggregateType:"market"`, `aggregateId:marketId`); `payload.betId` = a fresh synthetic UUIDv7; `dharma_ledger.bet_id = null` (no bets row).

No open execute-details remain. (Remaining genuine unknowns are constant *values* → HARDEN.6, not design.)

## Execute ritual (full, no narrowing — critical path + Ultrathink)

1. Plan ratified → committed `docs/plans/ENGINE.8.md` before Phase 1 ends; Phase 2 references `@docs/plans/ENGINE.8.md`.
2. `@test-writer` RED — `I-SIDE-BIND-001` + the 2 handler tests + F-BET scenarios, failing first.
3. Implement route handlers + `place.ts`/`sell.ts`/`floors.ts` + errors + config + `readBalance` export → green.
4. `@code-reviewer` (`src/server/` diff vs §2/§3 + stack patterns; flag the cross-module `readBalance` export).
5. `@security-auditor` (after code-reviewer) — money endpoint exploitability: idem-before-rate-limit ordering, moderation-outside-tx, INV-1/2/3 seams, origin/auth/ban gate, retry-purity, fail posture.
6. §5.10 pre-PR self-audit — every handler step + the assertion proving each flagged invariant.
7. `just verify` (`ZUGZWANG_ENV=preview`) + `pnpm test:invariants` + `pnpm test:integration` / `just test-db`.

No `@db-migration-reviewer` (no schema/migration). Subagent kickoffs pass `@docs/plans/ENGINE.8.md`. FAIL in scope → fix before PR; SURPRISE out of scope → `claude-progress.md` + STOP. Execute is a **fresh CC session + fresh web chat**, branched `feat/engine-8-bet-handlers` off `main` — NOT this session.

## ADRs needed

None new. ENGINE.8 implements SPEC.1 §7 + SPEC.2 §3.1/§4.4 + ADR-0013/0014/0015/0017/0018 as already-decided. Closing-ritual question revisited at execute close-out (candidate: a SPEC.2 same-commit note that ENGINE.8 set the §4.4 wire precedent + reused `origin-allowlist` over the §4.3-named `origin-check.ts`).

## References

SPEC.1 v1.0.x §5 (INV), §7 (F-BET-*), §8 (F-COMMENT-2 = DEBATE.2), §10.9 (floors), §16.1 (constants). SPEC.2 v1.0.x §3.1 (stack), §3.2 (W-1), §3.7 (events), §4.3 (Route Handlers), §4.4 (envelope), §9 (concurrency), §10 (moderation), §11 (idempotency), §14 (invariants), §15 (envelope/catalogue). ADR-0013/0014/0015/0017/0018. ENGINE.7 plan + log (boundary + caller contract). Built deps: `bets/transaction.ts`, `idempotency/{cache,types}.ts`, `middleware/{rate-limit,origin-allowlist}.ts`, `moderation/precommit.ts`, `cpmm/calculate.ts`, `dharma/{persist,tags}.ts`, `positions/{persist,read}.ts`, `events/{insert,schemas}.ts`, `lib/errors.ts`, `app/api/uploads/sign/route.ts`.
