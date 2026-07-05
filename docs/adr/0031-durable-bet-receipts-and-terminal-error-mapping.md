# ADR-0031 — Durable bet-request receipts + terminal error-mapping contract

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-05 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | AUDIT-FIX-B3 |
| **Frame document** | AUDIT.1 master report findings A3 / A4 / A9; `docs/plans/AUDIT-FIX-B3.md` |
| **Supersedes** | — |
| **Superseded-by** | — |

**This ADR does not decide:** the ownership-checked / never-throws release semantics and the completion-write alarm half (those scope ADR-0015 — see its in-place Patch record, same commit); a user-scoped receipt lookup (recorded below as candidate future hardening, out of B3); the non-owner runtime DB role (parked, pre-Sep-15, `parked.md`).

## Context and Problem Statement

`place()` and `sell()` are the W-1 money path (SPEC.2 §3.2 / §9). AUDIT.1 surfaced three robustness gaps on the bet/sell handler + idempotency path that **interlock** into a double-sell and a client that can never learn its bet succeeded:

- **A3 (unmapped terminal errors → uncached 500, retried forever).** Oversell and other unmapped errors fell through `toWireError` to HTTP 500 `error_internal`. Because `wire.status >= 500` sets `completed = null`, that response is **uncached**, so a contract-following client re-runs the full SERIALIZABLE transaction on every retry. Critically, for **place** the `bets_idempotency_key_idx` unique violation (23505) — the very signal that the bet **committed** — also mapped to 500, so a client whose bet landed could **never learn it succeeded**.
- **A4 (`await release()` in the endpoint `finally` can throw and mask a committed bet as a 500).** The release closure issued unguarded Upstash writes; a throw in `finally` supersedes the try/catch return, so a bet/sell whose transaction **already committed** returned a raw 500 — with **no alarm** (ADR-0015 §3 named the idempotency helper as the alarm-6 site "on cache lookup"; the completion-write half was unimplemented) and the pending sentinel left neither promoted nor deleted. Release was also not ownership-checked, so a >30s straggler could clobber a successor's sentinel.
- **A9 (sell has no durable idempotency backstop).** Place has the DB-unique `bets_idempotency_key_idx`; **sell** persisted its key nowhere and minted a fresh `sellEventId` per request, so `events ON CONFLICT` could not dedupe across requests. A crash/Redis window between COMMIT and the completed-cache write → **double proceeds**.

**The interlock:** A4's release-throw masks a committed sell as a 500 → the client's contract-mandated retry after the 30s pending TTL is fresh → with no durable sell backstop (A9) the position **sells a second time**; and for place, the same 23505 that proves the bet landed (A3) reads as a 500.

**Material discovery (re-verification on the live tree; drove the design).** The F-BET-3 response contract `{sharesSold, dharmaReturned, newPrice}` (SPEC.1 §7) **cannot be reconstructed from existing rows on replay**: `newPrice` (`p1`, the post-trade price) is persisted **nowhere** — `bets.price_at_bet` and both event payloads store `pEff`, not `p1`. A durable backstop that must answer a replay with the **original** response therefore cannot re-derive it; it must **store** it. This forces the A9 backstop to a **receipt row carrying the full result**, and forces that receipt to serve **both** flows (place gets it for free; sell requires it). (`newPrice` remains derivable from canonical state — `getPrices(post-trade reserves)`, a pure function of `pools` state, deterministically replayable from the events log — so no dataset-completeness gap arises; the receipt stores it only for synchronous replay fidelity. See §19.3 rider.)

## Decision Drivers

- **Once-only integrity on the money path (INV-1):** no double proceeds under any crash / Redis-window / retry sequence.
- **Core-loop availability:** a committed bet MUST reach the client; no **user-reachable** terminal case may yield an **uncached** 500 (which a contract-following client retries forever, burning transactions and drowning Sentry).
- **Replay fidelity:** a replayed committed request returns its **original** response (the F-BET-3 contract), not a re-derived or bogus one.
- **Append-only safety (Bucket A), minimal `src/` delta, and symmetry** with place's existing DB-unique backstop.
- **Observability:** implement ADR-0015 §3's unimplemented completion-write alarm half.

## Considered Options (A9 backstop mechanism)

- **(a)** A dedicated durable **receipt row** (`bet_receipts`) with a UNIQUE on `idempotency_key`, written as the **last write inside the W-1 transaction** by both `place()` and `sell()`. A replay 23505s → the whole transaction rolls back → no double proceeds; the stored `result` answers the retry with the original 200.
- **(b)** Derive the `bet.sold` `event_id` **deterministically** from the idempotency key and lean on the `events` table to dedupe.

## Decision Outcome

**Chosen: (a).**

**(b) is disqualified on evidence.** The `events` table has **no standalone unique on `event_id`** — its PK is composite `(event_id, created_at)` on a RANGE-partitioned table (SPEC.2 §7.1), so a unique on `event_id` alone is not enforceable across partitions. And the events insert uses `INSERT … ON CONFLICT (event_id, created_at) DO NOTHING` (SPEC.2 §7.7), which would **silently swallow** the duplicate event **while the money-moving writes (proceeds credit, position decrement) still commit** — strictly **worse** than today (a silent double-proceed with no error). Option (b) also cannot store the response required for replay fidelity given the `newPrice` gap.

**The receipt table.** New **Bucket-A** table `bet_receipts` (append-only; migration **0022**; append-only guard triggers in the **same migration file**, reusing the shared `0003`/`0021` functions — the table is never unguarded). Shape:

```
bet_receipts (
  id               uuid PK DEFAULT uuidv7()
  idempotency_key  text NOT NULL            -- UNIQUE (bet_receipts_idempotency_key_uq)
  body_fingerprint text NOT NULL            -- RFC 8785 SHA-256, per ADR-0015 D5
  user_id          uuid NOT NULL  FK → users(id)   ON DELETE restrict   -- indexed
  market_id        uuid NOT NULL  FK → markets(id) ON DELETE restrict   -- indexed
  flow             text NOT NULL  CHECK IN ('place','sell')
  result           jsonb NOT NULL           -- the exact F-BET response body
  created_at       timestamptz NOT NULL DEFAULT now()
)
```

**Receipts serve both flows** (forced by the `newPrice` gap for sell; place gets it for free + symmetry).

**Replay resolution order** (bet handlers): the durable receipt pre-check runs **after** the Redis idempotency cache lookup and **before** rate-limit and moderation.
1. Redis cache hit → replay as today.
2. **Durable receipt pre-check** (new): receipt hit + **matching** `body_fingerprint` → return the stored `result` (HTTP 200), promote the Redis sentinel, done. Receipt hit + **mismatched** fingerprint → HTTP 409 `error_idempotency_key_reused` (poison guard; **not** cached). Placing the pre-check **before moderation** is load-bearing: a replay of an already-committed comment-bearing bet can **never** be re-moderated into a bogus rejection.
3. Execute → the receipt INSERT is the **last write in the transaction**.
4. **23505 race backstop:** if a compound fault (Redis cache lost **and** the durable pre-check read missed) lets a replay reach execute, the receipt INSERT 23505s on the UNIQUE → the whole transaction rolls back → no double proceeds → the 23505 catch reads the receipt and returns the original 200.

**Terminal error-mapping contract (canonical here).** Zero **user-reachable** terminal case yields an **uncached** HTTP 500. Bug-class errors (unknown 23505, RETURNING-empty, CAS failure, driver error, 57014 statement-timeout) **deliberately** stay loud, **uncached** 500 `error_internal` + B1 `captureException` — laundering genuine internal bugs into 200s would hide real corruption; the target is "no longer **silent**" (B1 makes them visible), not "no 500."

| # | Case | Wire | Cached? | Finding |
|---|---|---|---|---|
| 1 | origin/auth/ban/onboarding/freeze/key/JSON | 403/401/403/403/410/400/400 | pre-reservation | — |
| 2 | Redis hit / pending / mismatch / unavailable | replay / 409 +RA2 / 409 / 503 +RA5 | n/a | — |
| 3 | Durable pre-check: receipt + fingerprint match | 200 original `{ok,data}` | YES (sentinel promoted) | A9 |
| 4 | Durable pre-check: fingerprint mismatch | 409 `error_idempotency_key_reused` | NO (poison guard) | A9 |
| 5 | Rate-limited | 429 +RA | YES | — |
| 6 | validation/floors/comment/reply/image/moderation/market-state/serialization | existing §15 codes | <500 cached; 503 uncached | — |
| 7 | Oversell — product pre-check (hold 5, sell 10) | 400 `insufficient_shares` | YES | A3 |
| 8 | Oversell — storage backstop `PositionOversellError` | 400 `insufficient_shares` + backstop alarm | YES | A3 |
| 9 | Single-side write-race loser `PositionSingleSideError` | 503 `error_position_conflict` +RA1 | NO (retry → 400 #6) | A3 |
| 10 | Place replay 23505 (`bets_idempotency_key_idx`) | 200 original (or 409 #4) | YES/NO | A9 |
| 11 | Sell replay 23505 (`bet_receipts_idempotency_key_uq`) | 200 original | YES | A9 |
| 12 | Release failure after commit | the already-built response + alarm 6b | best-effort | A4 |
| 13 | unknown 23505 / RETURNING-empty / CAS / driver / 57014 | 500 `error_internal` + B1 capture | NO — deliberate bug-class | — |

**Two new wire codes.**
- `insufficient_shares` — **bare**, HTTP 400, `error_type: validation`, `retry_semantics: do_not_retry`. The explicit `shares ≤ held.quantity` product pre-check in `sell()` (F-BET-4 mirror), keeping `PositionOversellError` as the storage backstop (row 8, belt-mapped to the same 400 + a backstop-trip alarm). Mirrors `insufficient_dharma`.
- `error_position_conflict` — **prefixed**, HTTP 503, `error_type: unavailable`, `retry_semantics: retry_after`, `retry_after: 1`. The **write-side single-side race-loser** (`persist.ts` catches 23505 on `positions_one_held_side_idx`). This is **transient**: the winning concurrent write has established the opposite held side, so the 503 makes the client retry, re-read, and resolve deterministically to a cached `opposite_side_held` 400 — the retry terminates; no A3-style storm. The only *persistent* instance (`read.ts` >1 held rows) requires the unique index to be absent = structural corruption, not user-reachable; the two share the exception class and cannot be distinguished at `toWireError`, so 503 stands, justified by the reachable case. **Prefix note:** its nearest sibling `bet_serialization_exhausted` (also 503 / `unavailable` / RA1, bet-path) is **bare**; `error_position_conflict` is prefixed to group with the `error_idempotency_*` bet-endpoint infrastructure codes. The bare-vs-`error_`-prefix convention is a **known unreconciled drift** with a planned forward sweep (SPEC.2 v1.0 note) — recorded here, not reconciled.

**A4 release (scopes ADR-0015 — see its Patch record).** The release / completion-write path becomes (i) **ownership-checked** (the sentinel carries an owner token; release acts only on its own sentinel — the `lock.ts` token-checked Lua pattern — closing the >30s-straggler-clobbers-a-successor sub-bug), (ii) **never-throws** (a release/Upstash failure never converts a committed bet into a 500 — the committed result reaches the client; fail-open on the response path), and (iii) **alarmed** — it emits **alarm 6b** (`upstash_unavailable_idempotency`) at the **completion-write site** (a site discriminator distinguishing it from the existing cache-lookup site), implementing ADR-0015 §3's completion-write alarm half. A guarded `finally` in the endpoint is the belt.

## Reviewer notes folded in (defense-in-depth; no code change)

- **Scope of the tx-unique-backstop correctness claim.** The "replay returns the idempotent original 200" guarantee holds for **all place replays** and for **sell replays where the position is not depleted by the resell amount**. For a **sell-to-zero (depleting)** replay under the **compound** double-fault (Redis cache lost **and** the durable pre-check read missed), execute runs, hits `position_not_held`/`insufficient_shares` because the first committed sell already depleted the position, and returns a clean 404/400 **before** the receipt-insert 23505 can recover the original 200 — a **replay-fidelity degradation** (404/400 instead of the original 200), **not** an invariant break and **not** a double-proceed. Strictly better than pre-B3 (which would double-sell). Recorded as the guarantee's honest boundary.
- **Receipt keyed by `idempotency_key` alone (not user-scoped) — risk acceptance.** The receipt lookup matches on `idempotency_key` alone, **mirroring the pre-existing Redis idempotency cache's global key scoping** (ADR-0015 D4). Gated by the unguessable client-generated key; the stored `result` carries no PII; and all bet outcomes are public in the 2026-11-06 dataset. The one delta vs the Redis cache: **receipts do not expire** (the Redis completed-payload TTL is 24h). **Accepted for the experiment phase** (@security-auditor cleared: no CRITICAL/HIGH/MEDIUM). **Candidate future hardening (not B3):** user-scope the pre-check + 23505-catch reads to `(user_id, idempotency_key)` so a cross-user key replay 409s rather than reading another user's receipt.

## Consequences

**Positive.** The double-sell + unlearnable-committed-success interlock is closed; sell gains the durable backstop place already had (symmetry); the money path has **zero user-reachable uncached 500s**; ADR-0015 §3's completion-write alarm half is implemented; the sentinel is ownership-checked, so a straggler cannot clobber a successor.

**Negative.** Receipts do not expire (bounded — one row per successful bet/sell, closed by the conclusion-freeze); the depleting-sell compound-double-fault replay returns 404/400 rather than the original 200 (fidelity gap, not a correctness break); the key-only receipt scoping is a defense-in-depth gap accepted for the experiment phase; one more Bucket-A table + its guard triggers to maintain, with the standing forward obligation on partition/table-adding migrations (per ADR-0030).

**Neutral.** `bet_receipts` is **excluded from the 2026-11-06 dataset entirely** (operational idempotency backstop; `result` content fully derivable from `events` + `pools`) — it joins `watermark_state`/`cron_alarms` in the "excluded entirely" set (SPEC.2 §19.3), so the dataset-relevant table count is unchanged. The drizzle snapshot carries the new table. The `events` storage-idempotency layer and the Redis API-boundary idempotency layer are unchanged — the receipt is a **third, durable, per-request backstop layer** beneath them.

## Pros and Cons of the Options

**(a) durable `bet_receipts` row.** *Pros:* symmetric with place's DB-unique backstop; a replay 23505s and rolls back on a real global unique; stores the response, so replay fidelity survives the `newPrice` gap; append-only auditable. *Cons:* a migration + one Bucket-A table; receipts don't expire. **Verdict: chosen.**

**(b) deterministic `event_id`.** *Cons:* the `events` unique is composite on a partitioned table (no global `event_id` unique to lean on); `ON CONFLICT DO NOTHING` would swallow the dup while money writes commit — a silent double-proceed, strictly worse than today; cannot store the response. **Verdict: disqualified on evidence.**

## Single-source file map

`src/db/schema/bets.ts` (the `bet_receipts` table + drizzle-zod pair) + `drizzle/migrations/0022_*.sql` (table + same-file guard triggers); the write path + pre-check + mapping across `src/server/bets/{errors,sell,place,endpoint}.ts`, the replay/pre-check module, and `src/server/idempotency/cache.ts` (ownership-checked never-throws release). CC's B3 close-out file map is canonical.
