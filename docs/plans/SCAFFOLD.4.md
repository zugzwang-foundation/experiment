# SCAFFOLD.4 — Upstash Redis substrate (rate-limit middleware + idempotency cache)

> **Status:** reviewed (Web Claude sign-off 2026-05-15; Q1–Q6 resolved — see §Open Questions; Amendments 1 + 2 absorbed below)
> **Date:** 2026-05-15
> **Author:** Hrishikesh + Claude Code Opus 4.7 (1M ctx) — Phase 1 plan
> **Critical-path?** **Critical-by-consequence.** Files land under `src/server/{middleware,idempotency,config,upstash}/`, none of which appear in CLAUDE.md §1's literal enumeration (`bets|comments|dharma|resolution|auth|identity|moderation/`, `src/db/schema/`, `drizzle/migrations/`, `supabase/migrations/`). However, the substrate is load-bearing for INV-1 (idempotency cache-hit short-circuits the bet wrapper per SPEC.2 §9 + §11 step 3 — a corrupt cache hit would let a duplicate bet bypass the SERIALIZABLE transaction). Per Web Claude Q1: run code-reviewer + test-writer; skip security-auditor; **do NOT amend CLAUDE.md §1 in this PR.**
> **Plan PR / commit:** plan committed as `chore(scaffold-4): plan` on `feat/scaffold-4` branched from `origin/main` `c7936e1` after Web Claude review 2026-05-15.

---

## Context

SCAFFOLD.4 ships the two helper modules that every state-mutating endpoint in the codebase will eventually consume (per SPEC.2 §11 + ADR-0015): a per-surface sliding-window rate-limit middleware on `@upstash/ratelimit` v2.0.8, and a Stripe-style idempotency cache with `SETNX`-with-pending-sentinel storage on Upstash Redis. The contract is locked by ADR-0015; this task is implementation-only. Nothing here is wired into a real endpoint (SCAFFOLD.3 wires auth surfaces, ENGINE.7+ wires bets, DEBATE.2+ wires comments) — SCAFFOLD.4 produces the substrate primitives so those downstream tasks can consume.

Asymmetric failure-mode posture is the load-bearing decision (per ADR-0006 §"Failure-mode profile"): rate-limit fails **OPEN** on Upstash unreachable (brief abuse-cap gap < global outage), idempotency fails **CLOSED** on Upstash unreachable (HTTP 503 — better to user-block than to risk corrupting the ledger by accidentally double-writing a bet). Both emit Sentry alarm 6 sub-IDs (6a + 6b per SPEC.2 §17.3); SCAFFOLD.4 stubs the emission as `console.error('upstash_unavailable_<sub>', err)` + a TODO referencing SCAFFOLD.5, which lands the real Sentry SDK.

---

## Tracker context (v7 row + drift-corrections per kickoff)

```
id: SCAFFOLD.4
phase: 2 (SCAFFOLD)
title: "Upstash Redis (rate limits + job queue + idempotency)"
desc:  (tracker v5/v7 inherited — see drift-corrections below)
pri: P1
deps: ["SPEC.16"]
est: 1d
```

**Drift-corrections versus tracker text** (kickoff-asserted; verified against ADR-0015 absorption row in `docs/specs/SPEC.2.md` line 43 + SPEC.2 §11 + §22 ADR Index status row for ADR-0015):

| # | Tracker text | Reality | Source |
|---|---|---|---|
| 1 | "token-bucket" rate-limit algorithm | **sliding-window** via `@upstash/ratelimit` v2.0.8's `Ratelimit.slidingWindow(maxRequests, durationLiteral)` | ADR-0015 D6 (per SPEC.2 line 43 absorption) + SPEC.2 §11 paragraph 2 |
| 2 | "lightweight job queue" included in scope | **dropped from SCAFFOLD.4 scope.** ADR-0006 settled cron topology (`pg_cron` primary + Vercel Cron HTTP-fanout carve-out for R2 orphan sweep) — no Upstash-side job-queue need in v1 | ADR-0006 §22 + SPEC.2 §3.5 Pattern A-2 + §12.6 |
| 3 | SPEC.16 dep | **SPEC.16 = ADR-0015**, status `accepted` 2026-05-07 per SPEC.2 §22.1 row 13 | SPEC.2 §22.1 + line 43 absorption row |

**Dep status at plan time:** ADR-0015 accepted 2026-05-07; SPEC.2 §11 substance fully absorbed at v0.3-draft; SPEC.1 §16.1 + §17 absorption rows present (v1.7.0-draft). Two upstream env-var prereqs are met (SCAFFOLD.14 wired the auth vendor stack; Upstash is the next vendor on the list). No blocker.

**This task unblocks** (per ADR-0015 absorption row last line + SPEC.2 §23.1 phase tables): SCAFFOLD.3 (Better Auth wiring + OTP rate-limit consumer), ENGINE.7 (bet transaction wrapper — consumes idempotency cache + 40001/40P01 retry per §9), ENGINE.8 (bet flow API), DEBATE.2 (comment schema + image API), DEBATE.6 (friendly-fire vote / clear / freeze).

---

## Approach

Four source files + one env-example diff, all under `src/server/`. **`rate-limit.ts`** instantiates 7 `Ratelimit` objects (one per SPEC.2 §11 surface row), exports per-surface check helpers + identifier-extraction helpers, and wraps every Upstash call in try/catch with **fail-open** fallback. **`cache.ts`** exports `idempotencyLookupOrReserve(key, bodyFingerprint)` returning a 5-state tagged union (`hit | mismatch | pending | miss | unavailable`); the `miss` arm returns a `release` callback the caller invokes in `finally` to either write the completed response (`SET … EX 86400` without `NX`) or DEL the pending sentinel on handler crash; Upstash errors fail **closed** to `{ kind: 'unavailable' }`. **`types.ts`** owns the header name, regex, two TTL constants, pending-sentinel prefix, and the six ADR-0015 error-envelope codes. **`limits.ts`** owns the seven numeric constants from SPEC.1 §16.1 with conservative placeholder values + per-constant comment naming `HARDEN.6` as the tuning source. `.env.example` gets one new section header + two new placeholder keys.

The whole task is substrate-only — no endpoint wiring, no UI, no DB schema, no migrations. Per SPEC.2 §11.6 "single source of truth" file map, the substrate ships in three files (rate-limit.ts + cache.ts + types.ts) plus `limits.ts` for the §16.1 constants. The only addition vs. that map is a tiny shared Redis-client wrapper at `src/server/upstash/redis.ts` proposed as Q3 below.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How preserved by this plan | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | **Indirectly** — the cache hit at SPEC.2 §11 step 3 short-circuits the bet wrapper. A cache hit must replay the cached `(status, body)` verbatim and MUST NOT cause the bet transaction to re-execute. The substrate enforces this by making the `hit` arm return the cached payload and not yielding a `release` callback; the consumer (ENGINE.7) is the actual atomicity site. | `idempotency::cache-hit-returns-cached-response` at `tests/integration/idempotency-cache.integration.test.ts` |
| INV-2 Dharma non-transferable / no overdraft | **Indirectly** — same as INV-1: cache replay protects against a non-deterministic OpenAI moderation re-run + Postgres retry that could double-credit Dharma. ENGINE.7 owns the storage-layer guarantee (`balance_after >= 0` CHECK + `dharma_ledger` append-only trigger); SCAFFOLD.4 just guarantees retries don't re-execute. | `idempotency::cached-response-includes-error-envelopes` (proves a 429 retry doesn't sneak through to fresh execution) + `idempotency::body-mismatch-returns-409` (proves a key-reused-with-mutated-body request is rejected, not silently executed) |
| INV-3 Comments side-bound at post-time | **No.** No `comments` schema, no `side_at_post_time` column written. | n/a |
| INV-4 Resolutions append-only | **No.** No `resolution_events` / `payout_events` access. | n/a |

**INV-1/INV-2 critical-by-consequence note.** The bet wrapper (ENGINE.7) holds the storage-layer guarantee; SCAFFOLD.4 holds the no-re-execution-on-retry guarantee. If `idempotencyLookupOrReserve` returns `kind: 'miss'` on what is actually a duplicate request (e.g., due to a Redis edge bug, fingerprint algorithm drift, or pending-sentinel TTL expiry mid-flight), the bet wrapper opens its SERIALIZABLE transaction a second time and the canonical lock order + 40001 retry kicks in. The Postgres-side guard catches the duplicate. So a substrate bug at this layer surfaces as a re-execution, not a corruption — INV-1/INV-2 hold even under SCAFFOLD.4 bugs, as long as ENGINE.7's transactional integrity holds. This is the explicit defense-in-depth that ADR-0013 §3 contemplates ("idempotency-key cache lookup as the FIRST authenticated step in every bet handler").

---

## 2. Data model changes

**None.** No Drizzle schema files added or edited. No migrations generated. `src/db/schema/` and `drizzle/migrations/` untouched. Upstash Redis is keyed-value, not a Postgres relation; SCAFFOLD.4 does not touch `src/db/`.

The two Redis key spaces consumed (per SPEC.2 §11 + §10):
- **`idem:{idempotency_key}`** — owned by SCAFFOLD.4 (`cache.ts`). Two-tier TTL (30s pending sentinel, 24h completed payload).
- **`mod:reserve:{user_id}:{market_id}:{idempotency_key}`** — owned by SCAFFOLD.13 (moderation pipeline); 10s TTL. Disjoint from `idem:*` per SPEC.2 §11 ¶"Distinction from §10's moderation reservation." Not touched by this task.

The per-surface rate-limit Redis keys (`otp-email:{email}`, `otp-ip:{ip}`, `admin-login-ip:{ip}`, `write-budget:user:{user_id}:market:{market_id}`, `write-burst:user:{user_id}`, `bet-ip:{ip}`, `image-put-ip:{ip}`) are managed by `@upstash/ratelimit`'s internal key shape (prefix + identifier); SCAFFOLD.4 controls the prefix names and identifier-extraction helpers, not the literal Redis-key layout the library writes.

---

## 3. API surface

**None.** No Server Actions, no Route Handlers, no `/api/*` files. The substrate exposes a TypeScript surface only:

| Export | File | Shape |
|---|---|---|
| `idempotencyLookupOrReserve` | `src/server/idempotency/cache.ts` | `(key: string, bodyFingerprint: string) => Promise<IdempotencyResult>` where `IdempotencyResult` is a 5-arm discriminated union (see §F2 below) |
| `computeBodyFingerprint` | `src/server/idempotency/cache.ts` | `(body: unknown) => string` — RFC 8785 canonical-JSON → SHA-256 → lowercase hex |
| `checkRateLimit` | `src/server/middleware/rate-limit.ts` | `(surface: RateLimitSurface, identifier: string) => Promise<{ allowed: true; remaining: number; reset: number } \| { allowed: false; retryAfter: number }>` — fail-open on Upstash error returns `{ allowed: true, remaining: -1, reset: 0 }` + alarm-6a emission |
| `ipIdentifier`, `otpEmailIdentifier`, `writeBudgetIdentifier`, `writeBurstIdentifier` | `src/server/middleware/rate-limit.ts` | identifier-extraction helpers consumed by handlers when calling `checkRateLimit` |
| `IDEMPOTENCY_HEADER_NAME`, `IDEMPOTENCY_KEY_REGEX`, `PENDING_TTL_SECONDS`, `COMPLETED_TTL_SECONDS`, `PENDING_SENTINEL_PREFIX` | `src/server/idempotency/types.ts` | constants |
| `IDEMPOTENCY_ERROR_CODES`, `RATE_LIMIT_ERROR_CODE` | `src/server/idempotency/types.ts` | the 6 ADR-0015 error envelope codes |
| `OTP_REQUESTS_PER_EMAIL_PER_HOUR`, `OTP_REQUESTS_PER_IP_BURST_PER_MIN`, `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR`, `RATE_LIMIT_PER_MARKET_PER_DAY`, `RATE_LIMIT_BURST_PER_MIN`, `BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` | `src/server/config/limits.ts` | 7 numeric constants (placeholder values; HARDEN.6 tunes) |

No HTTP surface. No client-facing route. No public endpoint.

---

## 4. UI / user flow

**None — backend substrate.** Nothing renders. No page, no Server Component, no client component. Verification is by tests (Phase 2 §7 plan) + a lightweight smoke (§Smoke checklist below).

---

## 5. Failure modes

The whole task is a failure-mode contract — three concerns, asymmetric postures, per ADR-0006 §"Failure-mode profile" + SPEC.2 §11 ¶"Failure-mode contract".

| # | Failure | Posture | Detection | Recovery |
|---|---|---|---|---|
| 1 | Upstash REST endpoint unreachable from `checkRateLimit` (network error, 5xx, DNS, etc.) | **Fail OPEN** — admit request | `console.error('upstash_unavailable_rate_limit', err)` stubbed; SCAFFOLD.5 routes to Sentry alarm 6a per SPEC.2 §17.3 | Brief abuse-cap gap accepted; next request retries Upstash. Auto-recovery on Upstash side, no state to reset |
| 2 | Upstash REST endpoint unreachable from `idempotencyLookupOrReserve` | **Fail CLOSED** — return `{ kind: 'unavailable' }`; caller maps to HTTP 503 `error_idempotency_unavailable` + `Retry-After: 5` | `console.error('upstash_unavailable_idempotency', err)` stubbed; SCAFFOLD.5 routes to Sentry alarm 6b | Client owns retry per ADR-0015 ¶"No server-side retry on state-mutating endpoints" |
| 3 | `idempotencyLookupOrReserve` returns `kind: 'miss'` + caller crashes between `SET NX` and `release` (e.g., handler throws an unrecoverable error before `finally`) | Pending sentinel persists for 30 seconds, then auto-expires (TTL safety net) | `idempotency::pending-sentinel-ttl-30s` test row; production diagnosis via Sentry trace correlation | TTL expiry is the recovery path. The `finally` block in every consumer also explicitly DELs the pending sentinel on uncaught error. Caller responsibility is enforced by `release(null)` returning a DEL. |
| 4 | Body fingerprint collision (two structurally different requests hash to the same SHA-256) | Cryptographic impossibility in practice (2^256 collision space); not engineered for | n/a — collision is below the noise floor of every other failure mode | n/a |
| 5 | `@upstash/ratelimit`'s internal key naming clashes with the `idem:*` key space | Disjoint per SPEC.2 §11 ¶"Distinction from §10" — `idem:{key}` vs `<surface-prefix>:{identifier}`; no overlap by construction | Code-reviewer audit verifies; unit test asserts key prefixes are mutually disjoint | n/a (prevented by construction) |
| 6 | RFC 8785 canonicalization library produces a non-canonical output (key order drift, whitespace bug, UTF-8 escape mismatch) | Fingerprint computation invariant violated → false `mismatch` reports → false 409s | Unit test: `computeBodyFingerprint({ a: 1, b: 2 }) === computeBodyFingerprint({ b: 2, a: 1 })` + UTF-8 byte-order test | Library bug → upstream patch or replace; surface as `claude-progress.md` SURPRISE |
| 7 | `@upstash/ratelimit` v2.0.8 API drift (e.g., `slidingWindow` signature change) | Compile-time TypeScript error; surfaces immediately | `pnpm tsc --noEmit` in `just verify` | Pin exact version `2.0.8` in `package.json` (not caret-range); upgrade is an ADR-worthy decision |
| 8 | Pending sentinel TTL chosen too short (handler exceeds 30s) | False 409 in-flight on the same client's retry; data correctness preserved but UX hiccup | Sized for §10/ADR-0014's 10s moderation reservation + §9/ADR-0013's ~600ms bet-transaction upper + slack per SPEC.2 §11 ¶"Storage substrate" | Per ADR-0015 D1, 30s is the ratified TTL. Not a tuning knob in v1. |

**Sentry alarm stub site.** Both 6a (rate-limit) and 6b (idempotency) emission sites are stubbed inline as `console.error('upstash_unavailable_rate_limit', err)` / `console.error('upstash_unavailable_idempotency', err)` within the same try/catch block that hosts the fail-open / fail-closed logic. The exact string tag matches SPEC.2 §17.3's `Sentry tag` column verbatim so SCAFFOLD.5's text-search-and-replace lands cleanly. TODO comment references SCAFFOLD.5 by name.

---

## 6. Edge cases

- **Idempotency-Key header missing on a required surface (bet endpoints).** Handler returns HTTP 400 `error_idempotency_key_required` *before* calling into SCAFFOLD.4's `idempotencyLookupOrReserve`. SCAFFOLD.4 doesn't validate header presence — it validates fingerprint shape and key shape only. Handler-side validation is SCAFFOLD.4-adjacent but lives in ENGINE.8 / DEBATE.2 consumers.
- **Idempotency-Key header present but matches regex incorrectly (e.g., empty string, 256 chars, special chars).** Caller validates via `IDEMPOTENCY_KEY_REGEX` exported from `types.ts` *before* calling `idempotencyLookupOrReserve`. SCAFFOLD.4 exports the regex; the validator implementation lives in the consumer.
- **Same idempotency-key, same body, two simultaneous requests.** First request gets `kind: 'miss'` with a release callback; second gets `kind: 'pending'` with retryAfter: 2 (per SPEC.2 §11 ¶"Single-key-encoding-both-states pattern" — the `SET NX EX 30` race-loses and signals in-flight). Body fingerprint check on the pending arm prevents same-key + different-body from being misread as a legitimate in-flight retry.
- **Same idempotency-key, different body, after completion.** First request completes; cache holds completed payload + body fingerprint. Second request with different body hits `kind: 'mismatch'`; caller returns HTTP 409 `error_idempotency_key_reused`.
- **Cached 429 replay.** Per SPEC.2 §11 ¶"Cached error responses include 429s" — a rate-limited request's HTTP 429 response is cached under its idempotency-key just like a successful 200 would be. The consumer (handler) is responsible for writing the 429 response to the cache before returning to the client. SCAFFOLD.4 doesn't differentiate response types; it stores whatever `release(response)` is called with.
- **Pending sentinel held by another instance crash that didn't run `finally`.** TTL is the safety net — 30s expiry. Client retry within 30s gets `kind: 'pending'` + Retry-After: 2 (consistent with the in-flight collision shape); retry after 30s gets `kind: 'miss'` and the handler runs fresh.
- **Bun-/Node-runtime-difference in `crypto.subtle.digest` availability for fingerprint hashing.** Use `node:crypto` `createHash('sha256')` — universally available on Node 24 (per `mise.toml` + AGENTS.md §1 line 1).
- **RFC 8785 canonical JSON for non-JSON-serializable inputs (e.g., `BigInt`, `Date`, `undefined`).** Caller responsibility: SCAFFOLD.4 documents the requirement that `computeBodyFingerprint` receives only JSON-serializable values. If a caller passes a `Date`, JSON.stringify converts to an ISO string — same as the wire format would, but the caller is responsible for shape stability. Documented in `types.ts` JSDoc.
- **`@upstash/ratelimit` `Ratelimit.limit()` returns `success: true` + `remaining: 0`** — caller MUST treat `success: true` as allowed regardless of `remaining`. The `remaining` field is informational (for `X-RateLimit-Remaining` header surfaces consumers might add later).
- **Redis client construction at module-load time vs. lazy.** Module-load is fine for v1 (Next.js 16 Server Action and Route Handler boundaries hot-reload the module on edits; cold-start creates the client once). If a future requirement needs lazy construction (e.g., per-tenant Upstash credentials), refactor at that time. v1 ships module-load.
- **Constants in `limits.ts` shipped with placeholder values.** Tests for "rate-limit throttles after N requests" need to either (a) override the constants via test setup, or (b) accept the placeholder value as the assertion target. Plan: tests assert "throttles after exactly `OTP_REQUESTS_PER_EMAIL_PER_HOUR` requests" by reading the constant at test time — so HARDEN.6's value tune doesn't break tests, only re-tunes them.

---

## 7. Test plan

Tests land at `tests/integration/idempotency-cache.integration.test.ts` + `tests/integration/rate-limit.integration.test.ts` + `tests/unit/body-fingerprint.test.ts`. Vitest, integration tier (per AGENTS.md §9). Per CLAUDE.md §5.6 + the kickoff request, `test-writer` writes these FAILING FIRST in Phase 2 *before* `src/server/{middleware,idempotency,config}/*.ts` exist.

**Mocking discipline.** Upstash REST client is mocked via `vi.mock('@upstash/redis')` and `vi.mock('@upstash/ratelimit')`. State-machine tests pass mock responses that simulate `SET NX` race wins/losses + `GET` hits/misses + Upstash unreachable (rejected promise). This is a substrate-only task; integration testing the real Upstash REST endpoint is HARDEN-phase territory (and the v1 test infra doesn't have a hermetic Upstash test fixture yet — that's a separate concern). The bet-flow integration tests in ENGINE.7+ will hit the real cache via the bet wrapper, against either a hermetic Redis Docker container or the Upstash REST endpoint with a per-test key prefix — that decision lives in the relevant downstream task's plan.

### 7.1 Idempotency cache state-machine tests (12 scenarios)

Eight cases from SPEC.1 §17 + four extensions covering the discriminated-union arms not directly named there.

| # | Test name | Scenario | SPEC.1 §17 row | Invariant asserted |
|---|---|---|---|---|
| 1 | `idempotency::cache-hit-returns-cached-response` | Cache holds completed payload matching body fingerprint; call returns `{ kind: 'hit', cachedResponse }`; no SETNX issued | line 1075 | INV-1 (indirectly — proves no re-execution) |
| 2 | `idempotency::cache-miss-executes-fresh` | Cache empty; `SET NX EX 30` wins; returns `{ kind: 'miss', release }`; caller invokes `release(response)` → SET without NX with `EX 86400` | line 1076 | — |
| 3 | `idempotency::body-mismatch-returns-409` | Completed entry holds fingerprint A; call with fingerprint B returns `{ kind: 'mismatch', cachedFingerprint: A }` (caller maps to HTTP 409 `error_idempotency_key_reused`) | line 1077 | INV-1, INV-2 (indirectly — proves no silent execution under key collision) |
| 4 | `idempotency::in-flight-collision-returns-409-retry-after-2` | Pending sentinel with fingerprint A held; call with fingerprint A returns `{ kind: 'pending', heldFingerprint: A }`; caller maps to HTTP 409 `error_idempotency_in_flight` + `Retry-After: 2` | line 1078 | — |
| 5 | `idempotency::in-flight-mismatch-still-409-on-pending-sentinel` (extension) | Pending sentinel with fingerprint A held; call with fingerprint B — proves the mismatch detection runs against pending sentinels too, not only completed entries. Returns `{ kind: 'pending', heldFingerprint: A }` and caller produces HTTP 409 `error_idempotency_in_flight + Retry-After: 2` (kickoff Q4 decision: pending-mismatch shape = in-flight collision; surfaced as Q4 for confirmation). | extension of line 1078 | INV-1 |
| 6 | `idempotency::pending-sentinel-ttl-30s` | After `SET NX EX 30`, key expires at 30s ±1; subsequent lookup returns `{ kind: 'miss' }` | line 1079 | — |
| 7 | `idempotency::completed-response-ttl-24h` | After `release(response)`, key persists for 86400s; subsequent lookup returns `{ kind: 'hit' }` | line 1080 | — |
| 8 | `idempotency::cached-response-includes-error-envelopes` | `release({ status: 429, body: { error_code: 'error_rate_limit_exceeded' } })` writes the 429; subsequent lookup with same key + same body returns the cached 429 — proves error envelopes are first-class cache entries | line 1081 | INV-2 (indirectly — proves rate-limited retry doesn't sneak into fresh execution) |
| 9 | `idempotency::fails-closed-on-upstash-unreachable-503` | Upstash mock rejects with network error; `idempotencyLookupOrReserve` returns `{ kind: 'unavailable', error }`; `console.error('upstash_unavailable_idempotency', err)` is called | line 1082 | — |
| 10 | `idempotency::release-on-crash-deletes-pending-sentinel` (extension) | Caller gets `kind: 'miss'`, invokes `release(null)` in finally — pending sentinel is DELed, not promoted to completed | n/a | — |
| 11 | `idempotency::release-returns-promise` (extension) | `release` is awaited; caller can `await release(response)` without hanging | n/a | — |
| 12 | `idempotency::regex-key-validation` (extension at types.ts boundary) | `IDEMPOTENCY_KEY_REGEX` rejects empty string, 256+ chars, special chars (`{`, `}`, `:`, spaces); accepts 1–255 chars of `[A-Za-z0-9_-]` | extension of line 1077 prereq | — |

### 7.2 Body-fingerprint unit tests (4 scenarios)

Pure-function tests, `tests/unit/body-fingerprint.test.ts`.

| # | Test name | Asserts |
|---|---|---|
| 1 | `body-fingerprint::canonical-key-order-stable` | `computeBodyFingerprint({ a: 1, b: 2 }) === computeBodyFingerprint({ b: 2, a: 1 })` — RFC 8785 sorts keys |
| 2 | `body-fingerprint::utf-8-encoding` | Non-ASCII content (e.g., `{ comment: "नमस्ते" }`) produces a stable hex string across Node + browser representations |
| 3 | `body-fingerprint::nested-object-canonical` | `{ a: { x: 1, y: 2 } }` and `{ a: { y: 2, x: 1 } }` produce identical fingerprints |
| 4 | `body-fingerprint::distinct-bodies-distinct-fingerprints` | `{ a: 1 }` and `{ a: 2 }` produce different fingerprints (sanity floor) |

### 7.3 Rate-limit middleware tests (8 scenarios)

| # | Test name | Scenario | SPEC.1 §17 row | Invariant asserted |
|---|---|---|---|---|
| 1 | `rate-limit::shared-budget-comments-and-friendly-fire` | Two parallel `Ratelimit.limit()` calls on `write-budget` + `write-burst`; both must allow for the call to admit | line 1074 | — |
| 2 | `rate-limit::otp-per-ip-burst-throttles` | Surface `otpRequestPerIpBurst`; identifier `otp-ip:1.2.3.4`; after `OTP_REQUESTS_PER_IP_BURST_PER_MIN` requests in 60s, `checkRateLimit` returns `{ allowed: false, retryAfter }` | line 1083 | — |
| 3 | `rate-limit::bet-per-ip-burst-throttles` | Surface `betPerIp`; identifier `bet-ip:1.2.3.4`; after `BET_ATTEMPTS_PER_IP_PER_MIN` requests in 60s, returns `{ allowed: false }` | line 1084 | — |
| 4 | `rate-limit::image-put-url-per-ip-burst-throttles` | Surface `imagePutUrlPerIp`; identifier `image-put-ip:1.2.3.4`; after limit, returns `{ allowed: false }` | line 1085 | — |
| 5 | `rate-limit::fails-open-on-upstash-unreachable` | Upstash mock rejects; `checkRateLimit` returns `{ allowed: true, remaining: -1, reset: 0 }`; `console.error('upstash_unavailable_rate_limit', err)` is called | line 1086 | — |
| 6 | `rate-limit::otp-email-vs-otp-ip-disjoint-keys` (extension) | Same email used across two IPs: `otp-email:{email}` accumulates; `otp-ip:{ip1}` and `otp-ip:{ip2}` accumulate independently. Sanity test that identifier helpers produce distinct keys | n/a | — |
| 7 | `rate-limit::write-budget-and-burst-must-both-allow` (extension) | One returns `success: true`, the other `success: false`; combined check returns `{ allowed: false }`. Reverse holds (both must succeed) | extension of line 1074 | — |
| 8 | `rate-limit::idempotency-and-rate-limit-key-prefixes-disjoint` (extension) | Programmatic check that `idem:*` prefix used by `cache.ts` does not overlap with any rate-limit surface prefix (`otp-email`, `otp-ip`, `admin-login-ip`, `write-budget`, `write-burst`, `bet-ip`, `image-put-ip`). Per SPEC.2 §11 ¶"Distinction from §10" | n/a | INV-1 (indirectly — prevents key-space collision) |

### 7.4 Test plan table (per template §7)

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (Vitest, `tests/unit/`) | 4 body-fingerprint tests (§7.2) | — |
| Integration (Vitest + Upstash mock, `tests/integration/`) | 12 cache-state-machine tests (§7.1) + 8 rate-limit tests (§7.3) | INV-1, INV-2 (indirectly — see §1 table) |
| E2E (Playwright, `tests/e2e/`) | none — substrate task, no user-facing surface | — |
| Invariant (`tests/invariants/I-*.spec.ts`) | none — INV-1 / INV-2 enforcement lives at ENGINE.7 (transaction wrapper) not at SCAFFOLD.4 substrate | — |

`pnpm test:invariants` continues to pass with no new I-* files added; SCAFFOLD.4 is upstream of any I-* surface.

---

## 8. Out of scope (refusal-grade for Phase 2)

Adding any of these to SCAFFOLD.4 is scope creep:

- **Lightweight job queue.** Dropped from SCAFFOLD.4 per kickoff drift-correction #2. ADR-0006 §22 settled cron topology via `pg_cron` + Vercel Cron HTTP-fanout. No Upstash-side queue in v1.
- **Wiring rate-limit or idempotency into any real endpoint.** SCAFFOLD.3 wires OTP rate-limit + admin-login rate-limit. ENGINE.7 / ENGINE.8 wire bet idempotency + bet-IP rate-limit. DEBATE.2 wires comment + image-PUT-URL surfaces. DEBATE.6 wires friendly-fire. SCAFFOLD.4 ships the substrate; consumers wire it.
- **Real Sentry SDK integration.** SCAFFOLD.5 lands `@sentry/nextjs` SDK + the actual `captureMessage` / `captureException` calls. SCAFFOLD.4 stubs via `console.error` with the exact 6a / 6b tag strings.
- **Numeric value tuning.** HARDEN.6 sets real values for the 7 §16.1 constants. SCAFFOLD.4 ships conservative placeholders + per-constant comment naming HARDEN.6.
- **Upstash account provisioning + `.env.local` population.** Hrishikesh signs up out-of-band (Upstash → Redis → create database in `ap-south-1` per ADR-0006 §3) and pastes `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` into `.env.local` and Vercel env. SCAFFOLD.4 ships `.env.example` placeholders + names the required keys; the operator does the actual click-flow.
- **Moderation reservation (`mod:reserve:{user_id}:{market_id}:{idempotency_key}`).** SCAFFOLD.13's territory (per SPEC.2 §10 ¶"Single source of truth" — `src/server/moderation/precommit.ts` owns the reservation lifecycle). Disjoint Redis key space, shared substrate.
- **HTTP error envelope wrapping.** The 6 ADR-0015 error codes are exported as string constants from `types.ts`; the actual `{ ok: false, error: { code, message, error_type, retry_semantics, retry_after, field_errors } }` envelope (per SPEC.2 §15.1) is wrapped by the consumer's HTTP / Server Action boundary, not by SCAFFOLD.4. The catalogue file `docs/specs/error-codes.md` mints the rows; PRECURSOR.4 carry-forward (per SPEC.2 §15.6) governs the catalogue authoring.
- **`useFlag()` feature-flag integration.** SCAFFOLD.6's territory (PostHog SDK + flag wiring) per SPEC.2 §17.4.
- **Drizzle schema or Postgres-side concerns.** ADR-0015 §D1 explicitly rejected the Brandur Leach `INSERT … ON CONFLICT DO NOTHING` Postgres-native option for v1. Substrate is Upstash Redis only.

---

## Open questions

All six resolved at Web Claude review 2026-05-15. Resolutions inline; the Candidate / Resolve-with framing is preserved for traceability.

- **Q1: Critical-path classification.** CLAUDE.md §1's critical-path enumeration is `src/server/{bets,comments,dharma,resolution,auth,identity,moderation}/`. SCAFFOLD.4 ships under `src/server/{middleware,idempotency,config,upstash}/` — not literally listed. But the idempotency cache is load-bearing for INV-1 (its cache-hit branch short-circuits the bet wrapper).
  - **Candidate:** Treat as non-critical-path per the literal §1 enumeration; run code-reviewer + test-writer reviewer-calls; skip security-auditor.
  - **Resolve with:** Hrishikesh confirms or amends §1 in a follow-up CLAUDE.md sweep.
  - **Resolved (2026-05-15, Web Claude sign-off):** Treat as **critical-by-consequence.** Run code-reviewer + test-writer; skip security-auditor. **Do NOT amend CLAUDE.md §1 in this PR** — the §1 enumeration stays narrow; SCAFFOLD.4 is a one-off carve-out justified by the load-bearing INV-1 short-circuit, not a general expansion. Header field "Critical-path?" updated to reflect.

- **Q2: `test-writer` category-fit.** CLAUDE.md §5.6 enumerates "bet placement, Dharma accounting, comment attachment, side assignment, resolution mechanics, moderation, CSAM detection" as `test-writer` triggers. Idempotency cache + rate-limit middleware are not in that enumeration. Kickoff requests `test-writer` regardless — likely because the cache state-machine has invariants worth asserting before implementation (body-fingerprint mismatch is a security boundary, fail-closed posture is a correctness invariant).
  - **Candidate:** Honor the kickoff request — invoke `test-writer` at Phase 2 start with the §7 test plan.
  - **Resolve with:** Phase 2 plan execution.
  - **Resolved (2026-05-15, Web Claude sign-off):** Honor the kickoff. Invoke `test-writer` first per the §Reviewer-call invocation plan's test-writer block. The 12 cache-state-machine + 8 rate-limit + 4 body-fingerprint scenarios are the contract Phase 2 implementation lands against. No CLAUDE.md §5.6 amendment this PR.

- **Q3: Shared Redis client wrapper file.** SPEC.2 §11.6 names three files (rate-limit.ts + cache.ts + types.ts) as the "single source of truth." Both rate-limit.ts and cache.ts need an Upstash Redis client. Two options: (a) each file instantiates `new Redis({ url, token })` directly from `@upstash/redis`; (b) a 5-line wrapper at `src/server/upstash/redis.ts` exports a singleton.
  - **Candidate:** Option (b) — singleton wrapper. Reasoning: testability (one mock surface for `vi.mock`), one env-read site, and the wrapper is so thin it doesn't expand the API surface area meaningfully.
  - **Resolve with:** Phase 2.
  - **Resolved (2026-05-15, Web Claude sign-off):** **Add the wrapper at `src/server/upstash/redis.ts`.** SPEC.2 §11.6's file map is "load-bearing files," not exhaustive — adding a thin internal utility is fine. **Phase 2 must document the singleton in the file's module-level JSDoc with an explicit reference to SPEC.2 §11.6 confirming this is an additive utility** (not a load-bearing surface, not a contract amendment). Suggested JSDoc text: `/** Singleton Upstash Redis REST client. Additive utility — SPEC.2 §11.6 names three "single source of truth" files (rate-limit.ts, cache.ts, types.ts); this wrapper is an internal testability helper, not a contract surface. */`

- **Q4: Pending-sentinel + body-mismatch response shape.** SPEC.2 §11 ¶"Single-key-encoding-both-states pattern" says "the in-flight collision check can already detect body mismatch on a still-pending key" — but does NOT specify whether a body-mismatch *on a pending sentinel* returns `error_idempotency_in_flight` (409 + Retry-After: 2, the in-flight shape) or `error_idempotency_key_reused` (409 + no Retry-After, the completed-mismatch shape).
  - **Candidate:** Return `error_idempotency_in_flight` (in-flight shape).
  - **Resolve with:** Phase 2 implementation.
  - **Resolved (2026-05-15, Web Claude sign-off):** **Return `error_idempotency_in_flight` (in-flight shape) for body-mismatch on a pending sentinel.** Surfacing two different errors mid-flight would confuse client retry policy, and the in-flight request may yet complete with a body that matches the eventual retry. **ALSO commit a same-PR one-sentence prose tightening into SPEC.2 §11 ¶"Single-key-encoding-both-states pattern"** clarifying this behavior — per SPEC.2 §0 versioning policy, this is a prose tightening not an ADR-0015 erratum (ADR-0015 D2/D3 ratified the in-flight + body-mismatch shapes; SPEC.2 §11 just under-specified the intersection case). See §"SPEC.2 §11 prose-tightening commitment" below for the exact diff Phase 2 lands.

- **Q5: RFC 8785 canonicalization library.** Options: (a) `canonicalize` npm package (~4K weekly downloads, MIT, small surface); (b) hand-roll (sort keys recursively + `JSON.stringify`). Per AGENTS.md §11 "ask first" — new dep needs justification.
  - **Candidate:** (a) `canonicalize`.
  - **Resolve with:** Hrishikesh signs off on the dep at plan-review time.
  - **Resolved (2026-05-15, Web Claude sign-off):** **Add `canonicalize`.** AGENTS.md §11 "ask first" satisfied via Q5. **Pin the exact version at install** (no caret); Phase 2 captures the resolved version in `package.json` + `pnpm-lock.yaml`. **Document rationale in `cache.ts` module-level comment** — suggested text: `/* Body-fingerprint uses RFC 8785 (JSON Canonicalization Scheme) via the canonicalize npm package. Hand-rolling RFC 8785 gets number-formatting (ECMA-262 §7.1.12.1) and UTF-8 escape edge cases wrong; the library is ~200 LOC, MIT-licensed, RFC 8785 §3.2.2.3 compliant. Per ADR-0015 D5. */`

- **Q6: ADR-0015 file does not exist at `docs/adr/0015-rate-limit-idempotency.md`.** Only `docs/adr/0001-license-choice.md` is committed; SPEC.2 §22.1 lists 13 accepted ADRs but the files are not minted. This is observed drift, not a SCAFFOLD.4 blocker — every ADR reference in SPEC.2 prose resolves logically to the absorbed section + change-log row (SPEC.2 line 43 is the canonical ADR-0015 text). PRECURSOR.4 / PRECURSOR.5 closed without minting the files.
  - **Candidate:** Not a SCAFFOLD.4 problem.
  - **Resolve with:** No action this task.
  - **Resolved (2026-05-15, Web Claude sign-off):** **Acknowledged as observation. No action this task. Will be discussed in the tracker-sweep chat post-SCAFFOLD.4.** No `docs/logs/SCAFFOLD.4.md` close-out item required — the observation lives here in the plan body for traceability and re-surfaces in the post-SCAFFOLD.4 tracker sweep.

---

### SPEC.2 §11 prose-tightening commitment (per Q4 resolution)

Same-commit edit to `docs/specs/SPEC.2.md` lands alongside the SCAFFOLD.4 source files. The change is a one-sentence prose tightening in §11 ¶"Single-key-encoding-both-states pattern" — NOT an ADR-0015 erratum; ADR-0015 D2/D3 already ratified the in-flight + body-mismatch shapes, SPEC.2 §11 just under-specified their intersection.

**Existing sentence (SPEC.2 §11 ¶3, line 1038):**
> The pending-sentinel value is the constant string `"PENDING"` plus the body fingerprint (so the in-flight collision check can already detect body mismatch on a still-pending key).

**Proposed appended sentence:**
> A body-fingerprint mismatch against a still-pending sentinel returns the in-flight collision shape (HTTP 409 `error_idempotency_in_flight + Retry-After: 2`), NOT the completed-mismatch shape (`error_idempotency_key_reused`) — surfacing two different errors mid-flight would confuse client retry policy, and the still-pending request may yet complete with a body that matches the eventual retry.

**Same-commit version-bump.** SPEC.2 v0.3-draft → v0.3.1-draft (or whatever patch-level cadence is current at Phase 2 commit time per §0). §0.1 change-log row added naming the prose tightening + Q4 resolution + SCAFFOLD.4 source PR. No §22 ADR-Index status flip (ADR-0015 stays `accepted 2026-05-07`).

---

## ADRs needed

**None this task.** ADR-0015 is the substance ADR (per SPEC.2 §22.1 row 13, accepted 2026-05-07); SCAFFOLD.4 implements it. ADR-0006 (hosting / Upstash substrate) is also accepted. No new architectural decision is being made.

If Q4 (pending-sentinel body-mismatch response shape) turns out to require disambiguation versus ADR-0015's text, that's an ADR-0015 erratum, not a new ADR — folded into the SCAFFOLD.4 PR as a same-commit SPEC.2 §11 prose tightening.

---

## File-by-file walkthrough

Five files net (four source + one env example diff). Estimates exclude test files (covered in §7).

### Source files (new)

1. **`/Users/hrishikesh/code/zugzwang/experiment/src/server/idempotency/types.ts`** — new file. ~50 LOC.
   - `export const IDEMPOTENCY_HEADER_NAME = 'Idempotency-Key';`
   - `export const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{1,255}$/;`
   - `export const PENDING_TTL_SECONDS = 30;`
   - `export const COMPLETED_TTL_SECONDS = 86400;`
   - `export const PENDING_SENTINEL_PREFIX = 'PENDING:';`
   - `export const IDEMPOTENCY_ERROR_CODES = { KEY_REQUIRED: 'error_idempotency_key_required', KEY_INVALID: 'error_idempotency_key_invalid', KEY_REUSED: 'error_idempotency_key_reused', IN_FLIGHT: 'error_idempotency_in_flight', UNAVAILABLE: 'error_idempotency_unavailable' } as const;`
   - `export const RATE_LIMIT_ERROR_CODE = 'error_rate_limit_exceeded' as const;`
   - `export type CompletedResponse = { status: number; body: unknown; bodyFingerprint: string };`
   - `export type IdempotencyResult = { kind: 'hit'; cachedResponse: CompletedResponse } | { kind: 'mismatch'; cachedFingerprint: string } | { kind: 'pending'; heldFingerprint: string } | { kind: 'miss'; release: (response: CompletedResponse | null) => Promise<void> } | { kind: 'unavailable'; error: unknown };`

2. **`/Users/hrishikesh/code/zugzwang/experiment/src/server/idempotency/cache.ts`** — new file. ~200 LOC.
   - Imports `Redis` from `@upstash/redis` (or from `@/server/upstash/redis` per Q3); imports `canonicalize` for RFC 8785; imports `createHash` from `node:crypto`.
   - **`export async function computeBodyFingerprint(body: unknown): Promise<string>`** — `createHash('sha256').update(canonicalize(body), 'utf-8').digest('hex')`. Returns lowercase hex.
   - **`export async function idempotencyLookupOrReserve(key: string, bodyFingerprint: string): Promise<IdempotencyResult>`** — the state machine. Pseudocode:
     ```
     redisKey = `idem:${key}`
     try {
       reservation = await redis.set(redisKey, `${PENDING_SENTINEL_PREFIX}${bodyFingerprint}`, { nx: true, ex: PENDING_TTL_SECONDS })
       if (reservation === 'OK') {
         return { kind: 'miss', release: async (response) => {
           if (response === null) {
             await redis.del(redisKey)
           } else {
             await redis.set(redisKey, JSON.stringify(response), { ex: COMPLETED_TTL_SECONDS })
           }
         } }
       }
       // SET NX failed — key exists. Inspect it.
       existing = await redis.get(redisKey)
       if (existing === null) {
         // race: key expired between SET NX and GET. Retry the SET NX once. (Stable; SETNX wins or losses converge.)
         return idempotencyLookupOrReserve(key, bodyFingerprint)
       }
       if (existing.startsWith(PENDING_SENTINEL_PREFIX)) {
         heldFingerprint = existing.slice(PENDING_SENTINEL_PREFIX.length)
         return { kind: 'pending', heldFingerprint }  // caller maps to 409 in-flight; per Q4, body-mismatch on pending also = in-flight shape
       }
       cached = JSON.parse(existing) as CompletedResponse
       if (cached.bodyFingerprint === bodyFingerprint) {
         return { kind: 'hit', cachedResponse: cached }
       }
       return { kind: 'mismatch', cachedFingerprint: cached.bodyFingerprint }  // caller maps to 409 error_idempotency_key_reused
     } catch (err) {
       console.error('upstash_unavailable_idempotency', err)  // TODO: SCAFFOLD.5 — replace with Sentry captureException + tag
       return { kind: 'unavailable', error: err }
     }
     ```
   - JSDoc above `idempotencyLookupOrReserve` explains the 5-state union and references SPEC.2 §11 ¶"Single-key-encoding-both-states pattern" + ADR-0015.
   - JSDoc above `computeBodyFingerprint` explains the RFC 8785 + SHA-256 + hex pipeline and references SPEC.2 §11 ¶"Idempotency contract."

3. **`/Users/hrishikesh/code/zugzwang/experiment/src/server/middleware/rate-limit.ts`** — new file. ~160 LOC.
   - Imports `Ratelimit` from `@upstash/ratelimit`; imports the singleton Redis client.
   - Imports the 7 numeric constants from `@/server/config/limits`.
   - **Seven `Ratelimit` instances** (one per SPEC.2 §11 surface row):
     ```
     export const otpRequestPerEmail = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_EMAIL_PER_HOUR, '1 h'), prefix: 'otp-email', analytics: false })
     export const otpRequestPerIpBurst = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_IP_BURST_PER_MIN, '1 m'), prefix: 'otp-ip', analytics: false })
     export const adminLoginPerIp = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR, '1 h'), prefix: 'admin-login-ip', analytics: false })
     export const writeBudgetPerMarket = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_MARKET_PER_DAY, '24 h'), prefix: 'write-budget', analytics: false })
     export const writeBurstPerUser = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(RATE_LIMIT_BURST_PER_MIN, '1 m'), prefix: 'write-burst', analytics: false })
     export const betPerIp = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(BET_ATTEMPTS_PER_IP_PER_MIN, '1 m'), prefix: 'bet-ip', analytics: false })
     export const imagePutUrlPerIp = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN, '1 m'), prefix: 'image-put-ip', analytics: false })
     ```
   - **Identifier extraction helpers**:
     ```
     export const otpEmailIdentifier = (email: string) => email  // prefix is automatic
     export const ipIdentifier = (ip: string) => ip
     export const writeBudgetIdentifier = (userId: string, marketId: string) => `user:${userId}:market:${marketId}`
     export const writeBurstIdentifier = (userId: string) => `user:${userId}`
     ```
     (The `@upstash/ratelimit` library prepends the configured `prefix` itself, so identifiers are bare values.)
   - **Surface-keyed dispatcher** `checkRateLimit(surface: RateLimitSurface, identifier: string)`: switch on surface enum → calls the matching `Ratelimit` instance's `.limit(identifier)` → returns `{ allowed: success, remaining, reset, retryAfter }` shape (computing `retryAfter = Math.ceil((reset - Date.now()) / 1000)`).
   - **Fail-open wrapper** around the entire `checkRateLimit` body:
     ```
     try { ...check... }
     catch (err) {
       console.error('upstash_unavailable_rate_limit', err)  // TODO: SCAFFOLD.5 — replace with Sentry
       return { allowed: true, remaining: -1, reset: 0 }  // admit on outage per SPEC.2 §11 fail-open posture
     }
     ```
   - JSDoc references SPEC.2 §11 ¶"Per-surface rate-limit table" + ADR-0015 D6 + §17.3 alarm 6a.

4. **`/Users/hrishikesh/code/zugzwang/experiment/src/server/config/limits.ts`** — new file. ~70 LOC.
   - Seven numeric constants from SPEC.1 §16.1 with conservative placeholder values and HARDEN.6 tuning source named:
     ```
     /** Per-email OTP request cap (anti-spam / anti-bot). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4/Q16. */
     export const OTP_REQUESTS_PER_EMAIL_PER_HOUR = 5;
     /** Per-IP OTP request burst cap. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4/Q16. */
     export const OTP_REQUESTS_PER_IP_BURST_PER_MIN = 10;
     /** Per-IP rate limit on /admin/login POST attempts. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0010. */
     export const ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR = 10;
     /** Per-user, per-market write cap (shared by comments / replies / image-comments / friendly-fire). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4. */
     export const RATE_LIMIT_PER_MARKET_PER_DAY = 50;
     /** Per-user write burst cap (shared with the per-market budget). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1. */
     export const RATE_LIMIT_BURST_PER_MIN = 5;
     /** Per-IP anti-abuse burst cap on bet place/sell. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0015. */
     export const BET_ATTEMPTS_PER_IP_PER_MIN = 30;
     /** Per-IP anti-abuse burst cap on R2 signed-PUT URL mint. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0015. */
     export const IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN = 10;
     ```
   - Module-level comment names SPEC.1 §16.1 + SPEC.2 §11's per-surface table + HARDEN.6 as the tuning source.

5. **`/Users/hrishikesh/code/zugzwang/experiment/src/server/upstash/redis.ts`** — new file, **proposed per Q3**. ~10 LOC.
   - `import { Redis } from '@upstash/redis'`
   - `export const redis = Redis.fromEnv()` (reads `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
   - JSDoc names it as a singleton for testability + one env-read site.
   - **If Q3 resolves "no shared wrapper":** drop this file; inline `Redis.fromEnv()` in rate-limit.ts and cache.ts.

### Env example (modified)

6. **`/Users/hrishikesh/code/zugzwang/experiment/.env.example`** — appended section. +5 lines.
   ```
   # === SCAFFOLD.4: Upstash Redis (rate-limit + idempotency) ===
   
   # Upstash Redis (Vendor 4 — rate-limit middleware + idempotency cache per ADR-0006 §3 + ADR-0015)
   # Get from: https://console.upstash.com/redis (create DB in ap-south-1 / Mumbai)
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```
   Matches the SCAFFOLD.14 section-header convention (`# === SCAFFOLD.NN: <title> ===`).

### Spec prose tightening (modified, per Q4 resolution)

7. **`/Users/hrishikesh/code/zugzwang/experiment/docs/specs/SPEC.2.md`** — one-paragraph diff in §11 ¶"Single-key-encoding-both-states pattern" (~line 1038 area). Net: +1 sentence appended; +1 row in §0.1 change log; §0 version bump v0.3-draft → v0.3.1-draft (or whatever patch cadence is current at Phase 2 commit time). Exact text in §"SPEC.2 §11 prose-tightening commitment" above. Lands in the SCAFFOLD.4 PR (same commit as the source files), not deferred.

### Test files (new, per §7)

8. **`/Users/hrishikesh/code/zugzwang/experiment/tests/unit/body-fingerprint.test.ts`** — new file. ~60 LOC. Four scenarios per §7.2.
9. **`/Users/hrishikesh/code/zugzwang/experiment/tests/integration/idempotency-cache.integration.test.ts`** — new file. ~280 LOC. Twelve scenarios per §7.1, Vitest with `vi.mock('@upstash/redis')`.
10. **`/Users/hrishikesh/code/zugzwang/experiment/tests/integration/rate-limit.integration.test.ts`** — new file. ~220 LOC. Eight scenarios per §7.3, Vitest with `vi.mock('@upstash/ratelimit')`.

### NO-TOUCH (explicit)

`src/db/schema/`, `drizzle/migrations/`, `supabase/migrations/`, `src/server/{bets,comments,dharma,resolution,auth,identity,moderation}/`, `src/app/`, `src/components/`, `next.config.ts`, `tsconfig.json`, `biome.json`, `justfile`, `mise.toml`, `package.json` (except for the `@upstash/redis` + `@upstash/ratelimit` + `canonicalize` dep additions), `pnpm-lock.yaml` (auto-regenerated by `pnpm install`).

---

## Dependencies to add

Per AGENTS.md §11 "ask first" — flagging at plan time. Three new packages:

| Package | Version | Why | Resolves Q? |
|---|---|---|---|
| `@upstash/redis` | latest stable (`^1.34.x` at plan time; pin exactly at install) | Required substrate per ADR-0006 §3 + SPEC.2 §11. REST-based client; works in Edge + Node + Bun runtimes. | n/a (locked) |
| `@upstash/ratelimit` | **exactly `2.0.8`** (no caret) | Required substrate per ADR-0015 D6. SPEC.2 §11 names v2.0.8 explicitly. | n/a (locked) |
| `canonicalize` | `^2.x` | RFC 8785 canonical-JSON serialization for body fingerprint per ADR-0015 D5. ~200 LOC library. | Q5 — Hrishikesh sign-off |

---

## Reviewer-call invocation plan (per CLAUDE.md §5.11)

The Claude Code `Agent` tool exposes only built-in agent types (`general-purpose`, `Explore`); the named project roles live as briefings at `.claude/agents/<role>.md`. Per §5.11, each reviewer-call is a fresh-context `general-purpose` Agent invocation with the role briefing baked into the prompt, plus `@docs/plans/SCAFFOLD.4.md` as the plan path, plus tool-scope constraints.

### test-writer at Phase 2 START

- **When:** First action of Phase 2, before any `src/server/{middleware,idempotency,config,upstash}/*.ts` exists.
- **Role briefing:** `.claude/agents/test-writer.md` (load + follow verbatim).
- **Plan path:** `@docs/plans/SCAFFOLD.4.md`.
- **Tool-scope constraint in prompt:** "Read, Write (tests only — `tests/unit/`, `tests/integration/`), Edit (tests only), Bash, Grep, Glob. Forbidden: Edit/Write under `src/`."
- **Deliverable:** Three failing test files per §F7–F9 above (~560 LOC total). Tests fail because the source files don't exist yet.
- **Scenarios covered:** all 24 scenarios in §7.1 + §7.2 + §7.3.
- **Invariants asserted:** INV-1 + INV-2 (indirectly — see §1 table).

### code-reviewer at Phase 2 post-audit, pre-`gh pr create`

- **When:** After source files are written, after pre-PR self-audit reports PASS, before opening the PR.
- **Role briefing:** `.claude/agents/code-reviewer.md`.
- **Plan path:** `@docs/plans/SCAFFOLD.4.md`.
- **Tool-scope constraint in prompt:** "Read, Grep, Glob, Bash only. Do not Edit or Write."
- **Deliverable:** CRITICAL / HIGH / MEDIUM / LOW findings with `file:line` references for the diff under `src/server/{middleware,idempotency,config,upstash}/`.
- **Specifically asked to verify:** (a) fail-open / fail-closed posture is correctly inverted between rate-limit.ts and cache.ts; (b) the 7 Ratelimit instances match SPEC.2 §11's per-surface table row-for-row (prefix + window duration + constant name); (c) the 5-state tagged union in `IdempotencyResult` has every arm exercised by the state-machine implementation; (d) Sentry stub tag strings are exact verbatim per SPEC.2 §17.3 column 4 (`upstash_unavailable_rate_limit` / `upstash_unavailable_idempotency`); (e) no HTTP-in-transaction anti-pattern (sanity).

### security-auditor — NOT invoked

Per kickoff explicit exclusion. Reasoning: SCAFFOLD.4 is substrate, not a critical-path business-logic surface; the relevant security surface (idempotency cache hit short-circuits the bet wrapper) is consumed by ENGINE.7 / ENGINE.8 / DEBATE.2 / DEBATE.6 — those consumers run `security-auditor` per §5.11. SCAFFOLD.4 has no auth flow, no admin surface, no resolution mechanic, no moderation path. The structural-separation invariants (admin vs participant) are not touched.

### db-migration-reviewer — NOT invoked

No `src/db/schema/` or `drizzle/migrations/` changes. Briefing not triggered per §5.11 table.

---

## Pre-PR self-audit checklist (per CLAUDE.md §5.10)

Six items the audit step must verify before `gh pr create`. Run by the Phase 2 execute surface (same Claude Code session that wrote the code).

1. **Per-surface Ratelimit table** — 7 Ratelimit instances in `rate-limit.ts`, each matching SPEC.2 §11's per-surface table verbatim:
   - prefix: `otp-email` / `otp-ip` / `admin-login-ip` / `write-budget` / `write-burst` / `bet-ip` / `image-put-ip`
   - window literal: `'1 h'` / `'1 m'` / `'1 h'` / `'24 h'` / `'1 m'` / `'1 m'` / `'1 m'`
   - constant: imports the exact `*_PER_*` name from `@/server/config/limits`
   - **PASS** if all 7 rows match; **FAIL** otherwise (fix in-session).

2. **Idempotency state machine** — 5 arms of `IdempotencyResult` (`hit` / `mismatch` / `pending` / `miss` / `unavailable`) are each returned by at least one code path in `idempotencyLookupOrReserve`. Specifically:
   - `miss` returns a `release` callback whose `null` argument DELs the pending sentinel; non-null argument SETs without NX with `EX 86400`.
   - `mismatch` is returned only when the cached entry is a *completed payload* (not a pending sentinel) with a different fingerprint.
   - `pending` is returned for any held sentinel (matching or non-matching fingerprint) — per Q4 decision.
   - **PASS** if all 5 arms reachable; **FAIL** otherwise.

3. **Failure-mode posture asymmetry** — rate-limit.ts catch block admits the request (`{ allowed: true }`) and emits tag `upstash_unavailable_rate_limit`; cache.ts catch block returns `{ kind: 'unavailable' }` and emits tag `upstash_unavailable_idempotency`. Tag strings match SPEC.2 §17.3 column 4 byte-for-byte. Both stubs use `console.error` + TODO comment naming SCAFFOLD.5.
   - **PASS** if both posture + tag strings correct; **FAIL** otherwise.

4. **Error envelope codes** — types.ts exports all 6 ADR-0015 codes (`error_idempotency_key_required`, `error_idempotency_key_invalid`, `error_idempotency_key_reused`, `error_idempotency_in_flight`, `error_idempotency_unavailable`, `error_rate_limit_exceeded`). Names match SPEC.2 §15.4 row 5 (ADR-0015) verbatim.
   - **PASS** if all 6 present + verbatim; **FAIL** otherwise.

5. **.env.example diff** — new `# === SCAFFOLD.4: Upstash Redis (rate-limit + idempotency) ===` section header; two new keys `UPSTASH_REDIS_REST_URL=` (empty value) + `UPSTASH_REDIS_REST_TOKEN=` (empty value). No real secrets committed (grep diff for non-empty token-shaped strings).
   - **PASS** if section header + 2 placeholder keys with empty values; **FAIL** if any non-empty secret detected.

6. **limits.ts constants** — 7 numeric exports. Each carries a `/** ... */` doc comment naming HARDEN.6 as the tuning source. No `throw if TBD` guard (placeholders ship as-is; HARDEN.6 tunes the values, not the existence).
   - **PASS** if all 7 constants present + commented; **FAIL** otherwise.

7. **Tracker drift-corrections** (bonus check, since this PR is the closure of the kickoff-asserted drift items #1 + #2 + #3). Verify the PR description names the three drift items + corrections + sources. PRECURSOR.5 closed without sweeping the tracker row description; SCAFFOLD.4's close-out log per CLAUDE.md §5.9 captures the final drift-correction text.

8. **SPEC.2 §11 prose tightening landed** — `docs/specs/SPEC.2.md` carries the exact appended sentence per §"SPEC.2 §11 prose-tightening commitment" above (single new sentence in ¶"Single-key-encoding-both-states pattern"); §0 version bump applied (v0.3-draft → v0.3.1-draft or current patch-cadence); §0.1 change-log row references Q4 resolution + SCAFFOLD.4 PR; §22.1 ADR-0015 row status unchanged (`accepted 2026-05-07`).
   - **PASS** if prose + version + change-log row + §22.1 stability all hold; **FAIL** otherwise (most likely failure: forgot to bump §0 or forgot the §0.1 row).

FAIL items fix in-session, re-verify, then PR. SURPRISE items (unexpected findings) surface to `claude-progress.md` and stop per §5.11 ¶"Findings."

---

## Risks + drift-absorption

| # | Risk / drift | Severity | Mitigation / absorption |
|---|---|---|---|
| 1 | Kickoff path reference `docs/specs/adrs/0015-rate-limit-idempotency.md` is **stale** — the canonical ADR location per AGENTS.md §3 + SPEC.2 §22.1 is `docs/adr/0015-rate-limit-idempotency.md`. The ADR file itself does not yet exist (only `docs/adr/0001-license-choice.md` is committed); SPEC.2 line 43 carries the full ADR-0015 substance. | LOW | Plan body resolves all ADR-0015 references against SPEC.2 §11 + §22 + line 43 absorption row, not against the (non-existent) file. Observation logged in Q6. |
| 2 | Kickoff path reference `docs/specs/SPEC_2.md` should be `docs/specs/SPEC.2.md` (dot, not underscore). | LOW | Plan body uses the correct path. No content impact. |
| 3 | `@upstash/ratelimit` v2.0.8 carries a `dynamicLimits` flag (added Jan 2026 per ADR-0015 D6 closing paragraph) we are NOT adopting in v1. | LOW | Pin `2.0.8` exactly; document the explicit non-adoption in `rate-limit.ts` module-level comment so a future reader doesn't add `dynamicLimits: true` thinking it's an oversight. |
| 4 | `Redis.fromEnv()` fails at module load if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset. | MEDIUM | Acceptable — same posture as SCAFFOLD.14's `BETTER_AUTH_SECRET` (the app refuses to boot without it). Document in `redis.ts` JSDoc. If a developer attempts to run `pnpm dev` without the env vars, the error message points at `.env.example`. |
| 5 | Test mocks for `@upstash/redis` + `@upstash/ratelimit` are inherently fragile under library upgrades. | MEDIUM | Pin both library versions exactly. Code-reviewer call flags any version drift in `package.json`. ENGINE.7's plan can revisit "real Upstash test fixture vs mock" if mocking becomes painful. |
| 6 | RFC 8785 canonicalization edge case: numbers with high precision (`0.1 + 0.2 === 0.30000000000000004`) might produce non-stable fingerprints across JS engines. | LOW | The `canonicalize` library handles this per RFC 8785 §3.2.2.3 (number formatting via ECMA-262 §7.1.12.1). Unit test §7.2 covers stability. If a real-world bug surfaces, replace library or hand-roll. |
| 7 | The 7 numeric placeholder values in `limits.ts` are arbitrary engineering judgment — they are NOT calibrated against any real abuse model. | LOW | Per kickoff explicit "conservative-default placeholder values (real values at HARDEN.6); name each value's intended HARDEN.6 source." Documented in `limits.ts` per-constant JSDoc. |
| 8 | Tracker row description for SCAFFOLD.4 carries the stale "token-bucket" + "lightweight job queue" wording (per drift-correction #1 + #2 above). | LOW | Out of scope for SCAFFOLD.4 commit (tracker HTML is operational, not code). Log in close-out per CLAUDE.md §5.9 + §7 closing ritual; surface as a CLAUDE.md / tracker-amendment question. Not a blocker. |

---

## Smoke checklist (post-PR)

Run by Phase 2 close-out before merging.

1. **`pnpm install` cleanly resolves** the three new deps (`@upstash/redis`, `@upstash/ratelimit@2.0.8`, `canonicalize`). No new build-script approval requests (verify against pnpm 10's allowlist).
2. **`pnpm tsc --noEmit`** passes. The new exports type-check; consumers of `IdempotencyResult` would discriminate on `kind` exhaustively.
3. **`pnpm biome check .`** passes (zero Biome warnings on the new files; Biome auto-fix run if needed).
4. **`pnpm vitest run tests/unit/body-fingerprint.test.ts tests/integration/idempotency-cache.integration.test.ts tests/integration/rate-limit.integration.test.ts`** — all 24 tests pass.
5. **`pnpm vitest run tests/invariants/`** — passes unchanged (no I-* files added/changed).
6. **Manual smoke: `node -e "import('./src/server/idempotency/cache.ts').then(m => m.computeBodyFingerprint({a:1,b:2}).then(console.log))"`** — produces a stable 64-char hex string. Repeat with `{b:2,a:1}` and confirm identical output.
7. **Manual smoke: trigger fail-closed posture.** Set `UPSTASH_REDIS_REST_URL=http://localhost:1` (unreachable); call `idempotencyLookupOrReserve('test', 'abc')`; verify it returns `{ kind: 'unavailable' }` and `console.error('upstash_unavailable_idempotency', ...)` fires.
8. **`just check`** passes end-to-end.

If any smoke item fails, fix before merge. The smoke is verification, not exploration — if step 7 surfaces something unexpected, the pre-PR audit step 3 didn't catch it.

---

## Implementation order (Phase 2 reference; not Phase 1 deliverable)

For Phase 2 to follow. Twelve steps. Verification gates inline.

1. **Branch already on** `feat/scaffold-4` (from `origin/main` `c7936e1`); tree clean.
2. **Invoke `test-writer` reviewer-call** with the §test-writer-invocation prompt above. Tests land at the three files in §7; tests fail (source files don't exist). Verify `pnpm vitest run` shows 24 failures, not 24 errors.
3. **`pnpm add @upstash/redis @upstash/ratelimit@2.0.8 canonicalize`.** Verify `package.json` carries `"@upstash/ratelimit": "2.0.8"` (exact, no caret).
4. **Write `src/server/config/limits.ts`** — the 7 numeric constants with HARDEN.6 JSDoc.
5. **Write `src/server/idempotency/types.ts`** — header name, regex, TTLs, sentinel prefix, error codes, type aliases.
6. **Write `src/server/upstash/redis.ts`** (per Q3 — or inline `Redis.fromEnv()` in the two consumers if Q3 lands "no wrapper").
7. **Write `src/server/idempotency/cache.ts`** — fingerprint helper + state machine + release callback + fail-closed catch.
8. **Write `src/server/middleware/rate-limit.ts`** — 7 Ratelimit instances + identifier helpers + checkRateLimit dispatcher + fail-open catch.
9. **Append `.env.example`** — new section + 2 placeholder keys.
10. **`pnpm vitest run`** — all 24 tests pass; previously-failing tests flip to passing.
11. **Run pre-PR self-audit checklist** (§Pre-PR self-audit above) — 6 items verify PASS.
12. **Invoke `code-reviewer` reviewer-call** with the §code-reviewer-invocation prompt above. **Finding policy (per Web Claude Amendment 2):** if code-reviewer surfaces CRITICAL or HIGH findings, fix in-session, **re-run the relevant self-audit row (not the full 6-item sweep)** to verify the fix, then proceed. MEDIUM / LOW findings: address inline if cheap, defer to follow-up if not. Open PR via `/pr` skill or `gh pr create --fill`.

Per CLAUDE.md §5.9, write `docs/logs/SCAFFOLD.4.md` BEFORE `gh pr create`, on the same branch, in its own commit (`chore(scaffold-4): log session — <state>`).

---

## Self-critique (after Phase 1 self-review)

Self-review on 2026-05-15 against the kickoff's required-sections list, CLAUDE.md §5.1 / §5.10 / §5.11, AGENTS.md §1 / §3 / §5, SPEC.2 §11.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium → **resolved** | Q4 (pending-sentinel body-mismatch shape) is technically a SPEC.2 §11 disambiguation; resolving it in Phase 2 implementation without a same-commit SPEC.2 prose tightening would leave SPEC.2 §11 ambiguous on future re-reads. | **Resolved (2026-05-15, Web Claude sign-off):** Q4 ratifies the in-flight shape AND commits a same-PR one-sentence prose tightening to SPEC.2 §11 ¶"Single-key-encoding-both-states pattern" — see §"SPEC.2 §11 prose-tightening commitment" for the exact text. SPEC.2.md added to the file inventory (item 7) as a modified file. SPEC.2 §0 version bump v0.3-draft → v0.3.1-draft + §0.1 change-log row land same-commit. Not an ADR-0015 erratum (ADR-0015 D2/D3 already ratified the shapes; SPEC.2 §11 just under-specified the intersection case). |
| 2 | medium → **resolved** | The plan proposes a `src/server/upstash/redis.ts` file not named in SPEC.2 §11.6's "single source of truth" file map. Strict adherence would push back. | **Resolved (2026-05-15, Web Claude sign-off):** Q3 ratifies the wrapper as an additive internal utility. Phase 2 MUST document the singleton in module-level JSDoc with explicit reference to SPEC.2 §11.6 confirming the additive (not contract-amending) intent. JSDoc text suggested in Q3 resolution body. |
| 3 | low | The plan reads 35K bytes — close to SCAFFOLD.1's plan size. Could compress by trimming the per-test-name scenario tables, but the SPEC.1 §17 row mappings are load-bearing for the test-writer reviewer-call. | Kept verbatim — the row-by-row mapping is the contract between this plan and §17. Compressing it would shift load to the test-writer call's prompt. |
| 4 | low | `console.error` stub for Sentry alarm-6 emission means HARDEN.* CI lint for no-body-logging discipline (per SPEC.2 §17.6) might flag these calls. | Acceptable — the stub goes away at SCAFFOLD.5; HARDEN.* lint runs after SCAFFOLD.5. No conflict at SCAFFOLD.4 lifetime. Noted in `rate-limit.ts` + `cache.ts` JSDoc. |
| 5 | low | The plan does not address the case where `@upstash/redis` returns `null` from `.set(key, value, { nx: true })` (which it does on race-loss; `'OK'` is the success sentinel). | Addressed in §F2 (cache.ts pseudocode) — `if (reservation === 'OK')` vs not. Surfaced for code-reviewer attention. |
| 6 | accepted-as-known-limitation | Tests run against mocked `@upstash/redis`, not against real Upstash. State-machine semantics tested; real-network behavior is verified only at HARDEN-phase or via a hermetic Redis test container in ENGINE.7+. | Documented in §7 ¶"Mocking discipline." Acceptable for v1 substrate. |

---

## References

- `CLAUDE.md` §1 (critical paths), §2 (invariants), §3 (refusal triggers — none fire for substrate), §5.1 / §5.6 / §5.9 / §5.10 / §5.11 (plan + tests-first + log + audit + reviewer-call), §6 (review roles + skills + hooks), §7 (closing ritual + cleanup absorption rule), §8 (closing rule)
- `AGENTS.md` §1 (stack), §3 (project structure + path aliases), §5 (Next.js patterns), §6 (database conventions — note: not touched by SCAFFOLD.4 but referenced for path-alias discipline), §9 (testing), §10 (git workflow), §11 (boundaries — "ask first" for new deps)
- `docs/specs/SPEC.1.md` §16.1 (operational floor constants, lines 919–948), §17 (acceptance tests, lines 1017–1164 — 12 new SCAFFOLD.4-relevant rows at lines 1074–1086)
- `docs/specs/SPEC.2.md` §9 (concurrency contract, lines 954–977 — INV-1 storage-layer guard upstream of cache), §10 (moderation contract, lines 980–1012 — disjoint Redis key space `mod:reserve:*`), §11 (rate-limit + idempotency contract, lines 1016–1062 — primary source; **modified same-commit by this PR per Q4 resolution: one-sentence prose tightening to ¶"Single-key-encoding-both-states pattern" + §0 version bump + §0.1 change-log row**), §15 (error envelope, lines 1389–1496 — 6 codes minted by ADR-0015), §17 (observability, lines 1543–1658 — alarm 6 sub-IDs 6a + 6b), §22 (ADR Index, lines 2038–2110 — ADR-0015 row 13, accepted 2026-05-07; no status flip this PR)
- `docs/specs/SPEC.2.md` line 43 — ADR-0015 absorption row, 7 ratified primitives across 7 dimensions, canonical decision-body text
- `docs/specs/SPEC.1.md` line 1269 — SPEC.1 v1.7.0-draft change-log row, names 12 new acceptance test rows
- `docs/logs/SCAFFOLD.14.md` — env-wiring precedent: `.env.example` section-header style, Vercel scope discipline, two-vendor accounts (Upstash will be vendor 4)
- `docs/plans/SCAFFOLD.1.md` — plan structure precedent
- ADR-0006 (hosting topology + Upstash substrate + failure-mode profile) — referenced via SPEC.2 §22.1 row 4
- ADR-0007 (observability — Sentry alarm 6 catalogue) — referenced via SPEC.2 §17
- ADR-0013 (concurrency + bet transaction — idempotency cache as first authenticated step) — referenced via SPEC.2 §9
- ADR-0014 (pre-commit moderation — `mod:reserve:*` 10s reservation, disjoint substrate) — referenced via SPEC.2 §10
- ADR-0015 (rate-limit + idempotency contract) — primary substance ADR; absorbed verbatim in SPEC.2 §11 + SPEC.2 line 43
- Tracker entry: `zugzwang_experiment_tracker_v7.html` row SCAFFOLD.4 — substrate description carries stale "token-bucket" + "job queue" wording per drift-corrections #1 + #2 in §Tracker context above

---

*Plan against SPEC.1 v1.7.0-draft + SPEC.2 v0.3-draft + ADR-0015 (accepted 2026-05-07). Phase 1 deliverable per CLAUDE.md §5.1; Phase 2 awaits Hrishikesh sign-off on Q1–Q5 + Web Claude review. No source code lands in this session.*
