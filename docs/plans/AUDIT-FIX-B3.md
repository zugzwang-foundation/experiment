# AUDIT-FIX-B3 — Bet-engine robustness: A3 + A4 + A9 (PLAN, pending web ratification)

> **Session context:** planned on **Fable 5** (operator kickoff, 2026-07-04). Plan-only — no code, no migration written. **Execute runs in a FRESH chat on Fable 5 + ultracode per explicit operator override** of the CLAUDE.md §6 no-ultracode-on-critical-path/DDL line — this plan is therefore prescriptive to the file/function/test level so an auto-orchestrated run cannot wander or truncate. The reviewer cascade stays gated and Opus-pinned (§Execute phases).
> **Live tree:** `main` @ `7fc4c60` (B2 squash — verified `git log origin/main`). Migration head `0021_truncate_guards.sql` → next-free **0022**. ADR head `0030` → next-free **0031** (both `ls`-verified; re-verify at execute Phase 0).
> **Findings:** `AUDIT-1-report-master.md` A3 (§4, High conf 88), A4 (§4, High conf 80), A9 (§4b, Med conf 82). B3 is the last G1 launch-blocker (scope amendment 2026-07-04).

## Context — one cohesive change, not three

The three findings interlock into a double-sell plus a client that can never learn its bet succeeded:

1. **A3** — `sell()` never checks `shares ≤ held.quantity`; the ceiling falls to `applyPositionDelta`'s `PositionOversellError`, which `extends Error` (not `BetProductError`) → `toWireError` fall-through → **uncached 500 `error_internal`** for ordinary user input. Every unmapped terminal error (including the place-replay 23505 below) shares this fate.
2. **A4** — `endpoint.ts` finally runs `await release(completed)`; the release closure's `redis.set`/`redis.del` are unguarded. Upstash blip at completion-write time → the throw in finally supersedes the committed 200 → **a landed bet returns a raw 500**, no alarm (ADR-0015 §3's completion-write alarm half is unimplemented), and the pending sentinel dangles.
3. **A9** — the sell tx persists its idempotency key **nowhere** (place has `bets_idempotency_key_idx`; sell writes no `bets` row) and mints a fresh `sellEventId` per request, so nothing durable dedupes a retry. After (2), the contract-mandated retry re-runs the whole sell → **double proceeds**. For place, the retry 23505s on `bets_idempotency_key_idx` → via (1), another uncached 500 → the client retries forever against a bet that already landed.

Fix shape: **(A3)** an explicit product pre-check + complete terminal-error mapping; **(A4)** a never-throws, ownership-checked, alarmed release; **(A9)** a durable, tx-atomic completion record whose unique constraint 23505s any replay and whose stored result answers it deterministically.

## STEP 1 — Re-verification on the live tree (all three findings STAND; lines shifted post-B1/B2)

| Audit claim | Live location (tree `7fc4c60`) | Verified |
|---|---|---|
| A3: no `shares ≤ held.quantity` check in sell | `src/server/bets/sell.ts:51-61` — only `held === null` → `PositionNotHeldError`; flows straight into `computeSell` | ✓ |
| A3: `PositionOversellError extends Error` (module-local sentinel, "a throw here is a caller bug") | `src/server/positions/errors.ts:19-24`; thrown at `src/server/positions/compute.ts:50-54` | ✓ |
| A3: unmapped fall-through → 500 `error_internal` | `src/server/bets/errors.ts:357` (`toWireError` last line) | ✓ |
| A3: 5xx ⇒ uncached | `src/server/bets/endpoint.ts:328-331` — `completed = wire.status < 500 ? {…} : null` | ✓ |
| A4: unguarded `await release(completed)` in finally | `src/server/bets/endpoint.ts:348` (B1 moved it below the §16.3 `logRequest` block) | ✓ |
| A4: release closure unguarded `redis.del` / `redis.set` | `src/server/idempotency/cache.ts:97-109` (del `:99`, promote-SET `:106`) | ✓ |
| A4: lookup-side alarm exists, completion-write alarm missing | `cache.ts:76-81` (`captureException` tag `upstash_unavailable_idempotency`) vs ADR-0015 §3: alarm-6 fires "on cache lookup **or completion-write failure**" — the second half has no implementation | ✓ |
| A4: sentinel not ownership-checked (vs `lock.ts` token+Lua) | sentinel value = `PENDING:{fingerprint}` (`types.ts:42`, `cache.ts:89-92`); `upstash/lock.ts:24-30` has the check-and-delete Lua precedent | ✓ |
| A9: sell writes no bets row; fresh event id per request | `sell.ts:63-98` write set = positions → dharma_ledger (ONE row: `bet_stake` POSITIVE, `bet_id` NULL) → events (`bet.sold`, `sellEventId` minted per-request at `sell/route.ts:33`) → pools | ✓ |
| A9: place's durable unique | `src/db/schema/bets.ts:63-65` partial unique `bets_idempotency_key_idx` (DDL `0001_initial_schema.sql:281`), stamped at `place.ts:162` | ✓ |
| A9→A3 interlock: place-replay 23505 unmapped | 23505 is not retryable (`transaction.ts:41,134`) → bubbles → `errors.ts:357` → uncached 500 | ✓ |
| B1 Sentry wiring (A4 reuses) | `src/server/observability/safe-capture.ts` — `safeCaptureException(err, {tags:{kind,…}})` fail-open wrappers; endpoint `error_internal` capture at `endpoint.ts:321-325` | ✓ |

**New finding surfaced by this re-verification (shapes the A9 design):** the response field `newPrice` (post-trade price `p1`) is **persisted nowhere** for either flow — `bets.price_at_bet` stores `pEff` (`place.ts:160`), and both event payloads carry `pEff` (`place.ts:191`, `sell.ts:90`). SPEC.1 §7 F-BET-3 pins the sell response as `{ sharesSold, dharmaReturned, newPrice }`, and the kickoff requires place replay to "return the original bet's result" — so **no existing durable row can reconstruct either original response**. The durable record must store the result itself.

## STEP 2 — Numbering (verified on `main` @ `7fc4c60`; do not trust docs)

- `drizzle/migrations/`: `0000`–`0021` on disk → **B3 = 0022** (single migration; see STEP 4).
- `docs/adr/`: `0001`–`0030` on disk (no 0002/0012) → **B3 = ADR-0031** + an in-place Patch record on ADR-0015.
- Execute Phase 0 re-verifies both (`ls`) before generating.

## STEP 3 — Design

### 3.1 A9 direction — deterministic-event_id alternative DISQUALIFIED (kickoff 3.i + 3.ii)

- **(i) events uniqueness:** `events` has **no standalone unique on `event_id`** — the PK is composite `(event_id, created_at)` on a `PARTITION BY RANGE (created_at)` table (`0002_events_partitioning.sql:29-30`; Postgres cannot express a partition-crossing unique). `event_id` alone is NOT globally enforced. This alone rules out cross-request dedup via event id.
- **(ii) pressure-test, and why it's actively harmful, not merely weak:**
  1. The insert path is `ON CONFLICT (event_id, created_at) DO NOTHING` (`insert.ts:136`, the A30 surface). Even where a deterministic id DID collide, DO NOTHING **silently skips the event row and lets the rest of the tx commit** — positions/ledger/pools double-apply with the duplicate's audit event *dropped*. It would convert A9's double-sell into a double-sell with a falsified audit log. Fixing that requires A30's RETURNING-check (explicitly out of B3 scope).
  2. `created_at` is derived from the UUIDv7 millisecond prefix (`insert.ts:58-62,109`). A key-derived deterministic id needs a stable ms prefix: derive it purely from the key and you fabricate a timestamp (lands in the wrong monthly partition or `events_default` — the alarm-2 surface, polluting the canonical time-partitioned log); derive it from request time and retries get different `created_at` → different PK → no dedup at all.
  3. SPEC.2 §7.3 deliberately scopes storage-layer idempotency to *intra-request* retries; overloading it for cross-request dedup breaks that contract's framing.
- **Conclusion: a dedicated unique constraint on a non-partitioned table wins.** Its 23505 aborts the whole SERIALIZABLE tx (rollback = no double proceeds), which is exactly the semantics A9 needs.

### 3.2 The durable completion record — new table `bet_receipts` (Bucket A)

**Why a receipts table and not a sell-only column:** the kickoff's own required place mapping ("already succeeded" replay returning the original result) is impossible from existing rows (the `newPrice`/`p1` gap, STEP 1). A `dharma_ledger.idempotency_key` column reconstructs only the proceeds amount; a sell-only record table leaves place with a lossy replay needing a spec ruling. One table storing the committed result serves both flows symmetrically, keeps `dharma_ledger`/`bets`/`events` schemas untouched, and is the durable twin of ADR-0015's Redis completed-cache — written **inside the money tx**, so response durability is atomic with commit (closing the exact A4/A9 crash window). This does NOT re-litigate ADR-0015 D1 (Redis stays the substrate/fast path); it falsifies D1's "not durable … acceptable" con for *committed money mutations specifically* — ADR-0031 records that scoping.

**Schema** (append to `src/db/schema/bets.ts`; `export *` in `schema/index.ts` picks it up):

```ts
// Bucket A. The durable idempotency completion record (ADR-0031, AUDIT-FIX-B3).
export const betReceipts = pgTable("bet_receipts", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  idempotencyKey: text("idempotency_key").notNull(),
  bodyFingerprint: text("body_fingerprint").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  marketId: uuid("market_id").notNull().references(() => markets.id, { onDelete: "restrict" }),
  flow: text("flow").notNull(),           // 'place' | 'sell' (CHECK below)
  result: jsonb("result").notNull(),      // the 200 body's `data` object verbatim (PlaceResult | SellResult)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("bet_receipts_idempotency_key_uq").on(t.idempotencyKey),
  index("bet_receipts_user_id_idx").on(t.userId),
  index("bet_receipts_market_id_idx").on(t.marketId),
  check("bet_receipts_flow_check", sql`${t.flow} IN ('place', 'sell')`),
]);
```

- Written as the **LAST write** inside the W-1 callback by BOTH `place()` and `sell()` (after the pools update; it must follow the `RETURNING` ids it stores). Lock-order note for the reviewer: insert-only, no row locks taken, single direction after `events` — no cycle with the ADR-0013 spine.
- **200-commits only.** Terminal 4xx responses stay Redis-cached only — they committed nothing; deterministic re-derivation on a cache-lost retry is correct (oversell re-checks to the same 400).
- Retry-purity: all stored values are attempt-stable except `result`'s DB-generated ids, which are consistent with the committed attempt (full rollback discards losers). No event ids inside. No new `events` row for the receipt itself — receipts are request-completion infrastructure, not domain state; the flows already satisfy §3.7 with their existing events.
- Money fields inside `result` are decimal **strings** (house rule), so JSON round-trip replay is byte-stable.

### 3.3 Replay resolution order (the new §11 durable layer)

1. **Redis hit** (unchanged fast path, `endpoint.ts:237-243`).
2. **NEW durable pre-check** — in `runBetEndpoint`, on the `miss` arm, inside the try, **before** `checkRateLimit` (it is part of the step-3 idempotency lookup family; §3.1's "lookup precedes rate-limit" rationale — replays must not consume rate budget — applies verbatim). `SELECT … FROM bet_receipts WHERE idempotency_key = $key`:
   - found + `body_fingerprint` matches → return `200 {ok:true, data: receipt.result}`; set `completed` → the finally's release **promotes the sentinel** → Redis fast path repopulated.
   - found + fingerprint mismatch → return `409 error_idempotency_key_reused` (code exists, `types.ts:53`), **`completed` stays `null`** → release deletes the sentinel. NEVER cache this 409 — caching it under the key would poison the original body's rightful replay.
   - not found → proceed.
   - **pre-check DB error → fail-OPEN to normal execution** (`safeCaptureException`, tag `kind: "durable_replay_precheck_failed"`): the pre-check is an optimization + moderation shield; correctness is backstopped by the tx-level unique (step 3).
   - Placement bonus (deliberate, name it in the ADR): the pre-check short-circuits **before step-6 moderation**, so a replayed committed place can never be re-moderated into a bogus `comment_track_b_blocked` 400 for a bet that already landed (verdict-flip hazard).
3. **Race loser / Redis-lost 23505** — both routes wrap `runBetTransaction` in a catch: if the error is SQLSTATE 23505 (read `.cause.code ?? .code`, the `transaction.ts:250` / `positions/persist.ts` precedent) **and** the constraint is `bets_idempotency_key_idx` or `bet_receipts_idempotency_key_uq` → read the receipt → same match/mismatch handling as (2) (match → `{status:200, body:{ok:true,data:result}}`, cached; mismatch → 409 reused with `noCache`). Receipt absent despite the 23505 (impossible live — zero users pre-launch, both writes land in one tx) → rethrow (honest 500 + the existing B1 capture). Any other 23505/unknown constraint → rethrow.
   - Concurrency note: a second same-key request blocks on the first's in-flight unique claim until COMMIT/ABORT — on commit it 23505s and the receipt is already committed and visible; on abort it proceeds cleanly. Sound under SERIALIZABLE.

New shared helper **`src/server/bets/replay.ts`**: `isDurableIdempotencyConflict(err): boolean` + `loadDurableReplay(db, {idempotencyKey, bodyFingerprint}): Promise<{kind:"replay", result:unknown} | {kind:"mismatch"} | null>`. Call sites build their own wire shapes (endpoint keeps its local `envelope()`; routes build `{ok:true,data}` as today).

**Plumbing:** `BetEndpointCtx` gains `bodyFingerprint` (computed at `endpoint.ts:235`, currently not passed). `SellParams` gains `idempotencyKey` + `bodyFingerprint`; `PlaceParams` gains `bodyFingerprint` (has the key already). The inner-result type gains optional `noCache?: true`, and the success-path caching rule becomes `result.status < 500 && !result.noCache` (`endpoint.ts:308-312`). The 429 arm and the thrown-4xx catch arm are UNCHANGED (A25's cached `error_moderation_in_flight` is operator-accepted won't-fix — do not touch).

### 3.4 A3 — oversell + the unmapped-error sweep

- **New `InsufficientSharesError extends BetProductError`** in `bets/errors.ts` — `httpStatus 400`, `code "insufficient_shares"`, fields `{held, requested}` (name/code mirror F-BET-4's `InsufficientDharmaError`, `errors.ts:92-106`; web may rename in the rider, OD-5).
- **Product pre-check in `sell()`** immediately after the `held === null` check (`sell.ts:55`): `if (new CpmmDecimal(shares).greaterThan(held.quantity)) throw new InsufficientSharesError({held: held.quantity, requested: shares})`. In-snapshot → race-consistent: a concurrent shrink surfaces as SSI 40001 → retry re-runs the pre-check → clean 400. `shares === held.quantity` stays legal (sell-to-zero, `compute.ts` allows `== 0`).
- **`toWireError` belt:** map `PositionOversellError` → the SAME `400 insufficient_shares` (import from `@/server/positions/errors`; no runtime cycle — positions never imports bets). It is unreachable-except-bug post-pre-check, so the endpoint catch additionally fires `safeCaptureException(err, {tags:{kind:"position_oversell_backstop"}})` when `err instanceof PositionOversellError` (the A5 lesson: no silent backstop trips). `PositionOversellError` itself and the storage `CHECK (positions_quantity_non_negative)` stay untouched as backstops.
- **`PositionSingleSideError`** (the other user-reachable unmapped error on this path — the read-side single-side race-loser, `positions/errors.ts:40`, `read.ts:36-40`) → map to `503 error_position_conflict`, `Retry-After: 1` (body `retry_after` per §4.4). 503 ⇒ uncached by the existing rule, which is correct: the retry re-resolves deterministically to `opposite_side_held` 400. (409 would be cached by the `<500` rule and would poison the key.)
- **Deliberate residual 500s (bug class, loud by design — enumerate in the ADR):** the RETURNING-empty guards (`place.ts:149,166`), the image-CAS race (`place.ts:248` — documented intentional), input-canonicalization sentinels (`PositionInputError`, dharma/cpmm input errors — unreachable from zod-validated input), driver/infra errors, and 57014 (A27, B7 scope). All keep the B1 `bet_handler_internal_error` capture. The ZERO-residual-uncached-500 rule targets **user-reachable terminal cases**, all of which the table below now maps.

### 3.5 A4 — never-throws, ownership-checked, alarmed release

In `src/server/idempotency/cache.ts`:

- **Owner token:** the reservation SET value becomes `PENDING:{fingerprint}:{token}` (`token = randomUUID()` per `lock.ts:44`). The pending-arm parse extracts `heldFingerprint` as the segment between the prefix and the last `:` (fingerprint is hex — no collision). `PENDING_SENTINEL_PREFIX` constant unchanged; update the `types.ts:34-42` doc comment (rider).
- **Ownership-checked release** (the `lock.ts:24-30` Lua precedent, via `redis.eval`):
  - `release(null)` → `if GET(key) == myPendingValue then DEL` — a >30s straggler can no longer delete a successor's sentinel or a completed response.
  - `release(completed)` → `if GET(key) == myPendingValue then SET key <completed-json> EX 86400` — a straggler can no longer clobber a successor's state; if our sentinel already expired and nobody re-reserved, the guarded op no-ops (lost cache optimization only — the durable receipt answers the replay).
- **Guard + alarm (the ADR-0015 §3 completion-write half):** the entire release body wrapped in try/catch → `safeCaptureException(err, {tags:{kind:"upstash_unavailable_idempotency", site:"release"}})` → **return, never throw**. Post-failure semantics (document in the rider): the sentinel dangles ≤ `PENDING_TTL_SECONDS` (30s) → a retry inside the window gets 409 in-flight; after expiry it re-executes and the durable layer resolves it. That chain is now closed end-to-end.
- **Lookup-side hardening (same file, same concern):** swap the bare `captureException` at `cache.ts:77` for `safeCaptureException` — it currently sits where a Sentry-client throw would escape `idempotencyLookupOrReserve`, which is called OUTSIDE the endpoint's try (`endpoint.ts:236`) and would 500 a request the fail-closed contract means to 503. One-line, B1 ruling-#8 compliant (new sites route through the safe wrappers).

In `src/server/bets/endpoint.ts`:

- **Guarded finally (belt):** wrap `await release(completed)` (`endpoint.ts:348`) in try/catch → same `safeCaptureException` tag with `site:"endpoint_finally"` → swallow. The already-built response (committed 200 or terminal 4xx) always reaches the client regardless of any release implementation. This is the layer the route-backed RED test proves (module mocks replace cache.ts wholesale).

### 3.6 Error-mapping table (every terminal bet/sell case; the kickoff deliverable)

| # | Case | Source | Wire | Cached? | Status |
|---|---|---|---|---|---|
| 1 | Origin / auth / ban / onboarding / freeze / key-format / bad JSON | endpoint prefix | 403/401/403/403/410/400/400 (existing codes) | pre-reservation — no cache interaction | unchanged |
| 2 | Redis hit / pending / mismatch / unavailable | `idem` switch | replay verbatim / 409 in-flight +RA2 / 409 reused / 503 +RA5 | n/a / no / no / no | unchanged |
| 3 | **Durable pre-check: receipt + fingerprint match** | **NEW** endpoint step 3.5 | **200 original `{ok:true,data:result}`** | **YES → sentinel promoted** | **NEW (A9)** |
| 4 | **Durable pre-check: receipt + fingerprint mismatch** | **NEW** | **409 `error_idempotency_key_reused`** | **NO (`completed` null; poison guard)** | **NEW (A9)** |
| 5 | Rate-limited | endpoint step 4 | 429 +RA, cached | YES (per §11, unchanged) | unchanged |
| 6 | Body/stake/shares validation; floors; comment rules; reply rules; image errors; moderation blocks/unavailable; market-state; serialization-exhausted | route + tx (existing classes) | existing §15 codes (400/404/409/503) | `<500` cached; 503s uncached | unchanged (incl. A25 as-is) |
| 7 | **Oversell — product pre-check** (hold 5, sell 10) | **NEW** `sell()` | **400 `insufficient_shares`** | **YES → deterministic, retry-safe** | **NEW (A3)** |
| 8 | **Oversell — storage backstop** `PositionOversellError` | **NEW** `toWireError` map | **400 `insufficient_shares`** + backstop alarm | YES | **NEW (A3)** |
| 9 | **Single-side race-loser** `PositionSingleSideError` | **NEW** map | **503 `error_position_conflict` +RA1** | NO (retry re-resolves → 400 #6) | **NEW (A3)** |
| 10 | **Place replay 23505** (`bets_idempotency_key_idx`) | **NEW** route catch | **200 original result** (or 409 #4 on mismatch) | YES (200) / NO (409) | **NEW (A9; kills the A3 500)** |
| 11 | **Sell replay 23505** (`bet_receipts_idempotency_key_uq`) | **NEW** route catch | **200 original result** — rollback already discarded the duplicate writes | YES | **NEW (A9)** |
| 12 | Release failure after commit | **NEW** guarded release ×2 | **the already-built response** + alarm 6b (`site` tag) | best-effort (guarded promote) | **NEW (A4)** |
| 13 | Unknown 23505 / RETURNING-empty / CAS race / driver / 57014 | fall-through | 500 `error_internal` + B1 capture | NO — deliberate (bug class / A27 out of scope) | unchanged, enumerated |

Zero user-reachable terminal case now yields an uncached 500. Rows 3/4/10/11/12 are the A4+A9 chain closure; rows 7/8/9 are A3.

## STEP 4 — DDL + ADR determination

- **DDL: YES — migration `0022_bet_receipts.sql`, one file.** Generate via `just db-generate bet_receipts` from the schema edit (drizzle-tracked table — hand-writing would desync the snapshot), then **hand-append to the same generated file**: `bucket_a_no_update` + `bucket_a_no_delete` row triggers and the `bucket_a_no_truncate` statement trigger on `bet_receipts`, reusing the existing functions (`enforce_bucket_a_no_update`/`_no_delete` from `0003:21,30`; `enforce_bucket_a_no_truncate` from `0021:39`) — no new functions. Single-file rationale (vs B2's 0020/0021 split, which was two concerns): a Bucket-A table must never exist unguarded, even between migrations. Trigger SQL is invisible to the drizzle snapshot (0003 precedent); no pg_cron content → the CI strip is unaffected. Expand-only → ADR-0024 compliant; staging rehearsal (`doppler run --config stg -- pnpm db:migrate:staging` + `/api/health` gate) before the prod migrate-before-serve.
- **@db-migration-reviewer REQUIRED** (schema + migration + bucket classification + trigger SQL).
- **ADR-0031 — durable bet-request receipts + terminal error mapping** (web-authored at the commit-pause; CC does NOT draft). Must cover: the receipts layer under ADR-0015's Redis cache (scoped D1 revisit — substrate unchanged; durability con falsified for committed money mutations); the replay resolution order (§3.3) incl. the pre-moderation short-circuit; the zero-uncached-500 terminal-mapping contract + the deliberate bug-class residual (§3.4/§3.6); `insufficient_shares` + `error_position_conflict`; the disqualified deterministic-event_id alternative with the §3.1(i)/(ii) evidence; Bucket-A classification + no-events-row framing for receipts.
- **ADR-0015 in-place Patch record** (web-authored): sentinel value gains the owner token; release becomes ownership-checked + never-throws; the §3 completion-write alarm half implemented (`site` sub-tag).
- **SPEC riders** (web-authored, same commit): SPEC.2 §3.1 (stack gains the durable pre-check step) · §3.2 (W-1 write set + receipts) · §5.1/§5.2 (inventory row; Bucket A 9→10, protected 12→13) · §6.2 (trigger list +1) · §7.3 (cross-ref the durable API-boundary layer) · §9 (write-order note) · §11 (durable backstop, token, resolution order, release semantics) · §15.4 (+2 codes) · §17.2/§17.3 (6b release site; `position_oversell_backstop` + `durable_replay_precheck_failed` tags) · §19.3 + Appendix B (bet_receipts SHIP/STRIP + per-column shape); SPEC.1 §7 F-BET-3 (oversell pre-condition + error row + acceptance rows; the "or equivalently `bet_unwind`" prose already matches shipped reality). CLAUDE.md §2 (canonical-tests parenthetical gains I-IDEM-ONCE-001 if OD-2 ratifies) + AGENTS.md §6 (bucket lines, migration head 0022) + §9 (test tree). SPEC §0 version bumps stay sweep-deferred — add the B3 line to the existing `docs/parked.md` SYNC-sweep row (B2 precedent).

## STEP 5 — Test plan (RED first via @test-writer; all five kickoff scenarios mapped)

Route-backed files follow the `tests/server/bets/sell.test.ts` harness: real local Postgres via `tests/db/_fixtures/db.ts`, module mocks for sentry/auth/origin/rate-limit/idempotency-cache(/moderation), `truncateTables` teardown. The **always-miss idempotency mock** (as in `sell.test.ts:45-51`) IS the Redis-lost simulation.

1. **`tests/unit/bets/wire-envelope.test.ts`** (extend): `InsufficientSharesError` → 400 `insufficient_shares`; `PositionOversellError` → 400 `insufficient_shares`; `PositionSingleSideError` → 503 `error_position_conflict` + retry-after; fall-through unchanged.
2. **`tests/server/bets/sell-oversell.test.ts`** (NEW — kickoff RED a): seed position quantity 5 (direct insert, `sell.test.ts:278` pattern), POST `{shares:"10"}` → **400 `insufficient_shares`** (today: RED, 500 `error_internal`); release mock received `completed.status === 400` (cached ⇒ retry-safe); zero deltas (no ledger row, no `bet.sold`, pools unchanged); `shares == held` boundary → 200 (cross-ref `sell.test.ts` full-quantity sell).
3. **`tests/server/bets/place-replay-durable.test.ts`** (NEW — kickoff RED b): always-miss mock; place K → 200; place K again (same body) → **200, body deeply equal** (today: RED, 500 via 23505); exactly ONE bets/comments row; `precommitModerate` called ONCE across both (pre-check precedes moderation); ledger/pools unchanged by the replay; variant: same K different body → **409 `error_idempotency_key_reused`** + release(null) (not cached).
4. **`tests/server/bets/sell-replay-durable.test.ts`** (NEW — kickoff RED d): place then sell K → 200; sell K again → **200 equal proceeds** (today: RED, double-sell succeeds); exactly ONE sell-credit ledger row, ONE `bet.sold`, pools/position unchanged after the replay (no double proceeds).
5. **`tests/server/bets/release-failure.test.ts`** (NEW — kickoff RED c): miss-arm mock whose `release` **throws**; place/sell → **200** (today: RED, 500), committed rows present, `safeCaptureException` (mock `@sentry/nextjs`.captureException) fired with `kind: upstash_unavailable_idempotency`.
6. **`tests/server/bets/double-sell-chain.test.ts`** (NEW — kickoff RED e, E2E): sell commits → release throws → **200 still returned**; second request same key (fresh miss = sentinel expired) → **durable backstop answers 200-replay**; ledger/pools/position prove single execution; alarm fired.
7. **`tests/unit/idempotency-release.test.ts`** (NEW, mocked `@/server/upstash/redis`): guarded release resolves (never rejects) on set/del/eval throw + capture called; ownership semantics — promote/delete are compare-guarded (foreign sentinel value ⇒ no-op); promote writes `EX 86400`.
8. **`tests/integration/idempotency-cache.integration.test.ts`** (ADAPT — it pins the sentinel string at `:161,215`): value shape gains the token segment; five-arm semantics + Q4 pending-mismatch behavior re-asserted unchanged.
9. **`tests/db/triggers/bet-receipts-append-only.spec.ts`** (NEW, mirror the 12 existing specs) + **`truncate-rejected.spec.ts`** (extend to 13 protected tables) + **`tests/db/_fixtures/truncate.ts`** guard list +`["bet_receipts","bucket_a_no_truncate"]` (the "keep in sync" contract at `truncate.ts:20-22`).
10. **`tests/invariants/I-IDEM-ONCE-001.one-commit-per-idempotency-key.spec.ts`** (NEW, OD-2): fixture-bypass duplicate `bet_receipts.idempotency_key` insert → 23505; documents the storage backstop the route layer rides.
11. **Unchanged-suite floor:** `events-idempotency` (retry-purity untouched), `atomicity`, `concurrency`, `sell`, `daily-credit`, `validation`, `subsequent-buy`, `moderation-outside-transaction`, `idempotency-replay` all stay green. `pnpm test:scale` runs as a belt (`idempotency-dedup.scale.test.ts` exercises same-key concurrency; if its assertions observe the new 200-replay-instead-of-second-execution, adapt them to the ratified semantics — flag in the log, don't silently rewrite intent).

## STEP 6 — Execute phases (the ultracode rails)

**Phase 0 — boot/preconditions:** fresh chat; `git fetch && git checkout fix/audit-fix-b3` (this plan is its HEAD; branch is un-pushed — verify `git ls-remote --heads origin fix/audit-fix-b3` empty, then `git rebase origin/main` if main moved); re-verify next-free 0022/0031 (`ls`); local Postgres up (`docker ps` FIRST — the stack is usually already up on :54322; Docker CLI at `/Applications/Docker.app/Contents/Resources/bin/`); read this plan in full.
**Phase 1 — @test-writer** (pass `@docs/plans/AUDIT-FIX-B3.md`; never edits `src/`): the STEP 5 list. Then confirm REDs fail for the right reasons: `pnpm vitest run tests/server/bets/ tests/unit/bets/ tests/unit/idempotency-release.test.ts` (direct vitest → `DATABASE_URL` defaults to :54322 per `tests/_setup/env.ts:21`; never `just` — dotenv would target the cloud DB).
**Phase 2 — schema + DDL:** edit `schema/bets.ts` → `just db-generate bet_receipts` → hand-append the three trigger statements to the generated 0022 → apply locally with `DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres" pnpm drizzle-kit migrate` → db-spec suites green.
**Phase 3 — implement, in this order:** `bets/errors.ts` (new class + two maps) → `sell.ts` (pre-check + receipt insert + params) → `place.ts` (receipt insert + param) → `bets/replay.ts` (new) → `endpoint.ts` (ctx fingerprint, durable pre-check, noCache rule, guarded finally) → both routes (param plumb + 23505 catch) → `idempotency/cache.ts` (token, Lua guards, alarmed never-throw release, safe lookup capture) + `types.ts` doc comment.
**Phase 4 — gates:** `ZUGZWANG_ENV=preview just verify` · `pnpm test:invariants` · `pnpm test:integration` · `just test-db` · full `pnpm vitest run` (the adopted final pre-PR gate) · `pnpm test:scale` (belt, note above). `just clean` before push if the pre-push tsc trips on stale `.next/types`.
**Phase 5 — §5.10 self-audit** against this plan item-by-item (schema columns/indexes/CHECK/bucket + trigger SQL + grep-verified rider list; every handler vs §3.6; PASS/FAIL/SURPRISE).
**Phase 6 — cascade (all `.claude/agents/*` pins: `claude-opus-4-8` / `effort: max`):** @code-reviewer → @db-migration-reviewer (0022 + schema) → @security-auditor. FAIL in scope → fix in-session; SURPRISE out of scope → `claude-progress.md` + STOP.
**Phase 7 — COMMIT-PAUSE (relay protocol):** impl commit `fix(bets): AUDIT-FIX-B3 — oversell 400 (A3) + guarded release (A4) + durable idempotency receipts (A9)` + paused-session log commit; **PAUSE and request the web-authored texts** (ADR-0031, ADR-0015 Patch, all STEP-4 riders, CLAUDE/AGENTS lines) — CC does NOT draft them; on receipt use the B1/B2 amend pattern (`reset --soft` the log → amend riders into the impl commit → rebuild the log with the PR#) → `gh pr create` → STOP with the full diff for web merge-gate. Multi-line messages via `git commit -F /tmp/audit-fix-b3-msg.txt`; identity `Zugzwang/world <zugzwangworld@proton.me>`; **no Co-Authored-By trailer**; session log `docs/logs/AUDIT-FIX-B3.md` per §5.9 before any pause/clear.

## Hard rails — NOT in scope (do not fold in)

- **A30** (`insert.ts` RETURNING check), **A21** (moderation verdict belt), **A31** (`positions_market_id_idx`), **A26** (freeze TOCTOU), **A27** (57014 map — B7), **A25/A28** (operator won't-fix — leave the cached moderation-409 + reservation-throw behavior exactly as-is).
- No edits to: `events/insert.ts`, `dharma/*` (schema or persist), `moderation/*`, `positions/compute.ts`/`errors.ts`/`read.ts` (import-only), committed migrations 0000–0021, `transaction.ts` retry spine, B2's deploy surface, the parked non-owner DB role, the SPEC §0/§22/footer sweep (#200).
- No invariant weakening anywhere; receipts must NOT be exposed on any read/API surface (server-internal only).

## Open decisions for web ratification (defaults chosen; execute proceeds on ratified values)

- **OD-1** — receipts serve BOTH flows (place included). Default **YES**: forced by the kickoff's place-replay requirement + the `newPrice` persistence gap (STEP 1). Alternative (sell-only + lossy place replay) needs a spec ruling on a degraded response body.
- **OD-2** — mint `I-IDEM-ONCE-001` as a 10th invariant-class spec (I-DAILY-ONCE/I-GRANT-ONCE precedent). Default **YES**.
- **OD-3** — sentinel ownership token in B3 scope. Default **YES** (named in the A4 finding text; `lock.ts` pattern is proven in-repo; post-receipts it is hygiene, so severable if web prefers).
- **OD-4** — ADR shape: new ADR-0031 + in-place Patch record on ADR-0015 (not a supersession). Default **YES**.
- **OD-5** — wire code names `insufficient_shares` / `error_position_conflict` (and the `bet_receipts` table name). Web may rename in the riders; code follows the ratified strings.
