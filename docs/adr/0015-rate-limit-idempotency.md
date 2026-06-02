# ADR-0015 — Rate-Limit & Idempotency

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-07 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.16 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §11 (Rate-Limit & Idempotency Contract), §15 (Error Envelope), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Every state-mutating endpoint in the experiment needs two cross-cutting protections that cannot live inside any single feature flow: **rate-limit defense** against credential-stuffed bot traffic and per-surface abuse, and **idempotency-key replay** so a retried request after a network drop does not double-commit. SPEC.1 §16.1 lists five rate-limit constants symbolic-only; SPEC.1 §16.2 names the "Network failure on bet | Idempotency key prevents duplicate submission" error row but does not pick the substrate, key shape, or error envelopes. ADR-0013 §3 has already locked the **idempotency-first ordering** (cache lookup is the first authenticated work in every bet handler) and explicitly delegated the substance — substrate, envelope, body-fingerprint discipline, lock-vs-result TTL split, error envelopes for in-flight and body-mismatch — to this ADR. ADR-0014 §3 has already minted a structurally-distinct moderation reservation primitive (10-second Redis SETNX on `mod:reserve:{user_id}:{market_id}:{idempotency_key}`) that consumes the same `Idempotency-Key` header but serves a disjoint purpose; this ADR's idempotency cache must coexist cleanly with that reservation on the same Upstash Redis instance.

Seven implementation questions remained open after the SPEC.2 §11 stub was pre-touched in the SPEC.15 close-out:

1. **D1.** Idempotency-cache substrate — Redis SETNX-with-pending-sentinel or Postgres-native `INSERT … ON CONFLICT DO NOTHING`?
2. **D2.** Body-mismatch HTTP status code — Stripe's HTTP 400 or the IETF/Brandur HTTP 409? (HTTP 422 already excluded by ADR-0013 §3.)
3. **D3.** In-flight collision response shape — mirror ADR-0014's `409 + Retry-After: 2`, or pick differently?
4. **D4.** Idempotency-key scoping — per-endpoint (Stripe) or global (Brandur / IETF draft)?
5. **D5.** Body-fingerprint discipline — SHA-256 of full canonical body, or subset of "meaningful" fields?
6. **D6.** Rate-limit window algorithm — sliding-window everywhere, or sliding-window-for-windows + token-bucket-for-bursts?
7. **D7.** Mint new Appendix B constants for bet anti-abuse (`BET_ATTEMPTS_PER_IP_PER_MIN`) and R2 signed-PUT URL anti-abuse (`IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`)?

This ADR ratifies all seven.

This ADR does **not** decide:

- Bet transaction concurrency model (SERIALIZABLE isolation, lock order, retry ladder, jitter shape) — ADR-0013 / SPEC.14.
- Pre-commit moderation flow (OpenAI call, image moderation, Track A/B routing, 10-second moderation reservation primitive) — ADR-0014 / SPEC.15.
- Numeric values for any rate-limit constant in SPEC.1 §16.1 or Appendix B — HARDEN.6 number-tuning pass (target 2026-09-01).
- UUIDv7 ID schema (used by other ID fields in the system; idempotency-keys are client-generated opaque strings, not server-allocated UUIDs) — ADR-0016 / SPEC.17.
- Specific Redis key namespacing convention beyond the per-surface key-composition table in §Decision Outcome — SCAFFOLD.4 implementation.
- Rate-limit-bypass allowlist for Hrishikesh-as-admin during testing — operational tooling, not architectural ratification.
- Postgres-side cleanup / TTL expiry of idempotency-cache rows — moot under the chosen substrate (Redis TTL is automatic); flagged as a future-consideration if substrate is reconsidered at testnet+.

## Decision Drivers

1. **INV-1 atomicity is non-negotiable.** Bet+comment commit together or not at all (SPEC.1 §5). Nothing in the rate-limit or idempotency machinery may compromise this — both run *outside* the bet transaction wrapper, before the SERIALIZABLE block opens.

2. **Idempotency-first ordering is already locked.** ADR-0013 §3 fixed the in-handler sequence: idempotency cache lookup is the first authenticated work, before rate-limit, before moderation, before transaction. This ADR provides a callable contract that supports that ordering; it does not re-litigate the ordering itself.

3. **Failure modes must be explicit, not discovered at runtime.** Rate-limit fails *open* (allow on Upstash unreachable) because user-blocking on a vendor outage is worse than admitting a brief abuse window. Idempotency fails *closed* (return 503 on Upstash unreachable) because admitting a non-idempotent retry could double-commit a bet. ADR-0006 §"Failure-mode profile" already ratified this asymmetry; this ADR consumes and codifies the contract.

4. **Single-substrate consolidation on Upstash.** ADR-0006 §3 already provisions Upstash Redis for rate-limit, idempotency, and moderation reservation. Splitting any of these onto Postgres would expand the failure-mode matrix, complicate SCAFFOLD.4, and provide marginal benefit for a 50-day experiment with dummy Dharma. The substrate is decided once, here, for all three concerns.

5. **Deferral-rule compliance.** Per the project-wide number-tuning rule, this ADR mints the *shape* (per-user vs per-IP, sliding-window-vs-fixed, key composition, TTL semantics) and defers all numeric values to HARDEN.6. New constants minted by this ADR (D7) follow the same rule: `TBD` in Appendix B until tuning.

6. **Alignment with already-ratified ADR contracts.** ADR-0014 picked HTTP 409 + `Retry-After: 2` for the moderation-reservation in-flight collision. This ADR's idempotency-cache in-flight collision should mirror that pattern verbatim — asymmetric retry-afters across two structurally-similar primitives in the same handler would just confuse client implementations.

7. **Single-developer-friendly contract.** Two helper modules, three exported functions total. No middleware framework dependency beyond Next.js's standard request lifecycle. Every state-mutating handler becomes a five-step pattern that Claude Code can replicate without per-handler invention.

## Considered Options

### D1 — Idempotency-cache substrate

1. **Redis SETNX-with-pending-sentinel on Upstash, 24-hour TTL** ← chosen
2. Postgres `INSERT … ON CONFLICT DO NOTHING` on a dedicated `idempotency_keys` table per Brandur Leach
3. Hybrid (Postgres for completed responses; Redis for pending sentinels)

### D2 — Body-mismatch HTTP status code

1. **HTTP 409 with `error_idempotency_key_reused`** (IETF draft + Brandur) ← chosen
2. HTTP 400 with `code: idempotency_error` (Stripe)
3. HTTP 422 — excluded by ADR-0013 §3 (idempotency-key reuse is a conflict, not a payload-validity problem)

### D3 — In-flight collision response shape

1. **HTTP 409 with `error_idempotency_in_flight` + `Retry-After: 2`** (mirror ADR-0014) ← chosen
2. HTTP 503 + `Retry-After: 2` (server unavailable framing)
3. HTTP 425 Too Early + `Retry-After: 2`

### D4 — Idempotency-key scoping

1. **Global** — key matched on key alone, regardless of HTTP method or path (Brandur + IETF draft) ← chosen
2. Per-endpoint — `(method, path, key)` as the cache key (Stripe)

### D5 — Body-fingerprint discipline

1. **SHA-256 of canonical-JSON full request body** (sorted keys, no whitespace, UTF-8) ← chosen
2. SHA-256 of a per-endpoint subset of "meaningful" fields
3. No body fingerprint — match on key alone

### D6 — Rate-limit window algorithm

1. **Sliding-window via `@upstash/ratelimit`'s `Ratelimit.slidingWindow(...)` for every surface**, window duration matching the constant's window (1m / 1h / 24h) ← chosen
2. Fixed window for cheap surfaces, sliding window for hot surfaces
3. Token bucket for burst caps, sliding window for windowed caps

### D7 — New Appendix B constants

1. **Mint both** `BET_ATTEMPTS_PER_IP_PER_MIN` and `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` ← chosen
2. Mint only `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`; leave bet endpoints unrate-limited
3. Mint neither; defer entirely to HARDEN.* if abuse signal emerges

## Decision Outcome

**Chosen across all seven dimensions:**

- **D1** — Redis SETNX-with-pending-sentinel on Upstash, two-tier TTL (30-second pending sentinel for in-flight requests; 24-hour outer TTL for completed responses).
- **D2** — HTTP 409 with `error_idempotency_key_reused` for body-mismatch.
- **D3** — HTTP 409 with `error_idempotency_in_flight` and `Retry-After: 2` for in-flight collision (mirrors ADR-0014 verbatim).
- **D4** — Global key scoping; idempotency-key matched on the key value alone.
- **D5** — SHA-256 of canonical-JSON full request body; canonical-JSON defined as sorted-keys, no insignificant whitespace, UTF-8 encoded (RFC 8785 — JSON Canonicalization Scheme).
- **D6** — Sliding-window via `Ratelimit.slidingWindow(maxRequests, durationLiteral)` for every rate-limit surface; window duration matches the SPEC.1 §16.1 constant's named window.
- **D7** — Mint both new constants; values deferred to HARDEN.6.

### 1. Per-surface rate-limit table

Each row is enforced by a `Ratelimit` instance configured with `slidingWindow(constantValue, windowDuration)` against a per-identifier Redis key.

| Surface | Rate-limit identifier | Algorithm | Window | Constant | Status |
|---|---|---|---|---|---|
| OTP request (per email) | `otp-email:{email}` | sliding | 1h | `OTP_REQUESTS_PER_EMAIL_PER_HOUR` | existing |
| OTP request (per-IP burst) | `otp-ip:{ip}` | sliding | 1m | `OTP_REQUESTS_PER_IP_BURST_PER_MIN` | existing |
| Admin login (per-IP) | `admin-login-ip:{ip}` | sliding | 1h | `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` | existing |
| Comment + friendly-fire shared per-market budget | `write-budget:user:{user_id}:market:{market_id}` | sliding | 24h | `RATE_LIMIT_PER_MARKET_PER_DAY` | existing |
| Comment + friendly-fire shared burst | `write-burst:user:{user_id}` | sliding | 1m | `RATE_LIMIT_BURST_PER_MIN` | existing |
| Bet `place` / `sell` per-IP anti-abuse burst | `bet-ip:{ip}` | sliding | 1m | `BET_ATTEMPTS_PER_IP_PER_MIN` | **new** |
| R2 signed-PUT URL mint per-IP | `image-put-ip:{ip}` | sliding | 1m | `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` | **new** |

The shared comment + friendly-fire budget is enforced by **two parallel `Ratelimit.limit()` calls** per write attempt (the per-market 24h cap *and* the user-wide 1m burst cap); both must succeed for the write to proceed. This matches the SPEC.1 §8 preamble's "shared budget covering direct comments, replies, image-comments, and friendly-fire votes" without requiring a custom limiter.

Bet placement and image-PUT-URL mint use **per-IP** identifiers rather than per-user because the threat model is credential-stuffed bot traffic where a single IP fans out across many compromised accounts. Per-user limits are the wrong defense surface for that threat — they only fire after a successful login.

### 2. Idempotency contract — header, key shape, storage

**Header.** Clients send `Idempotency-Key: <opaque-string>` on every state-mutating POST/PUT/PATCH endpoint that supports idempotency replay (the bet endpoints `place` / `sell`, the comment endpoints `post` / `reply` / `image-comment`, the friendly-fire endpoints `cast` / `clear`). The header is REQUIRED on bet endpoints (per ADR-0013 §3), OPTIONAL on comment and friendly-fire endpoints (where natural-key uniqueness already protects against most duplicate-write hazards but idempotency-aware retries are still safer for clients on flaky networks).

**Key format.** Opaque server-side. Server validates against `^[A-Za-z0-9_-]{1,255}$` and rejects with HTTP 400 `error_idempotency_key_invalid` on mismatch. Client recommendation (non-normative): UUIDv7 via the npm `uuid` package's `v7` export (`import { v7 as uuidv7 } from "uuid"`).

**Scoping (D4).** Global. The cache lookup matches on the key value alone; method and path are NOT part of the cache key. A client that reuses the same idempotency-key across two distinct endpoints (e.g., POST /api/bets/place and POST /api/bets/sell) will trigger the body-fingerprint mismatch path on the second call and receive HTTP 409 `error_idempotency_key_reused`. Cross-endpoint key reuse is treated as the same class of error as same-endpoint key reuse with mismatched body — both are "client gave us the same key for a different operation."

**Storage substrate (D1).** Upstash Redis. One Redis key per idempotency-key, encoding both lifecycle states:

- **Pending sentinel.** On cache miss, the handler executes `SET idem:{key} <pending-sentinel> NX EX 30`. The `NX` flag means "only set if key does not exist"; if it returns `0`, another in-flight request holds the sentinel and we return HTTP 409 `error_idempotency_in_flight + Retry-After: 2`. The `<pending-sentinel>` value is a constant string `"PENDING"` plus the body fingerprint (so the in-flight collision check can already detect body mismatch on a still-pending key).
- **Completed response.** On handler completion (success or terminal error), the handler executes `SET idem:{key} <completed-payload> EX 86400` (24-hour outer TTL). The `<completed-payload>` is a JSON-encoded `{ status, body, body_fingerprint }` triple where `status` is the HTTP status code, `body` is the response body verbatim, and `body_fingerprint` is the SHA-256 of the original canonical request body.

The single-key-encoding-both-states pattern (rather than two separate keys per request) is deliberate: the atomic transition from pending → completed is just a `SET` without `NX`, which Redis guarantees as atomic. The 30-second pending TTL is sized for ADR-0014's 10-second moderation reservation worst case + ADR-0013's bet-transaction worst case (3 retries × ~200ms = ~600ms upper bound) + ample slack; the 24-hour outer TTL matches Stripe's published contract.

**Body-fingerprint (D5).** SHA-256 of the canonical-JSON-serialised request body, hex-encoded. Canonical-JSON per RFC 8785: object keys sorted lexicographically, no insignificant whitespace, UTF-8 encoded. The fingerprint is computed at handler entry (before any other work), stored alongside the pending sentinel, and compared on every subsequent lookup. Clients sending the same key with a body that differs in any byte after canonicalisation receive HTTP 409 `error_idempotency_key_reused`.

**Cached error responses.** A request that hits the rate-limit (HTTP 429) is still cached under its idempotency-key. Subsequent retries with the same key return the cached 429, NOT a fresh execution — the rate-limit was a deterministic property of the original request, and a client retrying after rate-limit recovery should generate a fresh idempotency-key. This matches Stripe and the IETF draft.

### 3. Failure-mode contract

**Rate-limit fails OPEN on Upstash unreachable.** The middleware catches the Upstash error, emits a Sentry event tagged `upstash_unavailable_rate_limit` (per ADR-0007 §4 alarm 6), and admits the request. Brief abuse windows are accepted as the cost of not blocking legitimate users on a vendor outage. The middleware does NOT auto-retry against Upstash on the request path (auto-retry adds latency under exactly the conditions where Upstash is already struggling).

**Idempotency cache fails CLOSED on Upstash unreachable.** The cache helper catches the Upstash error, emits a Sentry event tagged `upstash_unavailable_idempotency` (per ADR-0007 §4 alarm 6), and returns HTTP 503 `error_idempotency_unavailable + Retry-After: 5` without executing the handler. This matches SPEC.2 §11's pre-touched posture and ADR-0006's failure-mode profile. The bet+comment is never persisted; the user retries.

**No server-side retry on state-mutating endpoints.** A single Upstash failure surfaces directly to the client. The client owns retry policy. Server-side retry for reads is fine but out of scope here.

**Sentry alarm 6 emission sites.** Both `src/server/middleware/rate-limit.ts` and `src/server/idempotency/cache.ts` are alarm-6 emission sites. The rate-limit middleware emits on rate-limit-check timeout; the idempotency cache helper emits on cache lookup or completion-write failure. Per ADR-0007 §4 alarm 6, these surface as Sentry custom events filtered into the Upstash unreachable channel.

### 4. In-handler call sequence (consumed by every state-mutating endpoint)

1. **Auth gate.** Reject unauthenticated requests with HTTP 401 (or 403 for banned users per F-BET-7 / F-COMMENT-5).
2. **Idempotency-key validation.** If the endpoint requires the header, reject missing header with HTTP 400 `error_idempotency_key_required`. Validate format; reject malformed with HTTP 400 `error_idempotency_key_invalid`.
3. **Idempotency cache lookup.** Call `idempotencyLookupOrReserve(key, bodyFingerprint)`. Branch on the result:
   - `{ kind: "hit", response }` → return the cached response verbatim. No further work.
   - `{ kind: "pending" }` → return HTTP 409 `error_idempotency_in_flight + Retry-After: 2`.
   - `{ kind: "mismatch" }` → return HTTP 409 `error_idempotency_key_reused`.
   - `{ kind: "unavailable" }` → return HTTP 503 `error_idempotency_unavailable + Retry-After: 5`.
   - `{ kind: "miss", release }` → continue. The `release` callback MUST be called in a `finally` block to either (a) write the completed response under the outer 24h TTL on handler success/terminal-error, or (b) `DEL` the pending sentinel on handler crash.
4. **Rate-limit check** (per the surface table in §1). On rate-limit-exceeded, write the HTTP 429 response into the idempotency cache (so subsequent retries with the same key return the cached 429), then return HTTP 429 `error_rate_limit_exceeded + Retry-After: <seconds>` derived from `Ratelimit.limit()`'s `reset` field.
5. **Pre-commit moderation** (per ADR-0014, F-BET-1 entry case only).
6. **Bet transaction wrapper** (per ADR-0013) or other handler body.
7. **Cache the completed response** under the 24h outer TTL via the `release` callback from step 3.

This sequence is the contract every state-mutating handler implements. Steps 1–4 and step 7 are universal; steps 5–6 are bet-flow-specific.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Rate-limit middleware (per-surface `Ratelimit` instances, fail-open posture, Sentry alarm 6 emission, identifier-extraction helpers) | `src/server/middleware/rate-limit.ts` |
| Idempotency cache helper (`idempotencyLookupOrReserve`, body-fingerprint, fail-closed posture, Sentry alarm 6 emission) | `src/server/idempotency/cache.ts` |
| Idempotency types and constants (`Idempotency-Key` header name constant, validation regex, `PENDING_TTL_SECONDS = 30`, `COMPLETED_TTL_SECONDS = 86400`, error envelope codes) | `src/server/idempotency/types.ts` |
| New Appendix B constants (`BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`) | `src/server/config/limits.ts` (already houses the existing five §16.1 constants per SCAFFOLD.4) |

## Consequences

### Positive

- **Idempotency-first ordering (ADR-0013 §3) has a callable contract.** `idempotencyLookupOrReserve(key, bodyFingerprint)` is one function call, returning a tagged union the handler dispatches on. ENGINE.7 / ENGINE.8 / DEBATE.2 / DEBATE.6 all consume the same shape.
- **Failure modes are asymmetric on purpose, and the asymmetry is documented.** Rate-limit fails open, idempotency fails closed. ADR-0006 §"Failure-mode profile" already ratified this; this ADR codifies the implementation.
- **Single substrate (Upstash) for rate-limit, idempotency, and moderation reservation.** SCAFFOLD.4 provisions one Redis client; three concerns share the connection pool.
- **Sliding-window via `@upstash/ratelimit` is one library call per surface.** `Ratelimit.slidingWindow(constantValue, "1 h")` configures each row in the surface table; no custom limiter logic.
- **Body-fingerprint is RFC 8785 canonical JSON.** Standard, deterministic, no per-endpoint subset-field maintenance burden.
- **HTTP 409 alignment between idempotency in-flight collision and ADR-0014's moderation reservation collision.** Same status, same `Retry-After: 2`, different error-envelope codes. Client implementations see a coherent pattern.
- **Two new Appendix B constants close the bet + image-PUT-URL anti-abuse gap.** Without them, a single compromised account can hammer the bet endpoint at network speed; the per-day per-market shared budget covers comments/friendly-fire but explicitly *not* bets, by SPEC.1 §16.1's design.

### Negative

- **Vendor lock-in to Upstash for the idempotency cache.** Migrating to Postgres-native (Brandur's pattern) post-experiment requires a new ADR and a small data-migration story (idempotency cache rows are short-lived; a 24-hour cutover window suffices). *Mitigated by:* Postgres-native is documented as a Considered Option (rejected, future-consideration); the rejection rationale lives here for future re-litigation.
- **Cached error responses include 429s.** A client that hits rate-limit and retries with the same idempotency-key sees the same 429 forever (until 24h TTL). *Mitigated by:* this is the documented Stripe and IETF behaviour; clients SHOULD generate a fresh idempotency-key after rate-limit recovery. The contract is named in §2 "Cached error responses".
- **Body-fingerprint requires canonical JSON serialisation on every state-mutating request.** Adds ~1ms of CPU per request. *Acceptable because:* bet flow critical path is already 100–500ms; ~1ms is rounding noise.
- **Pending sentinel TTL of 30 seconds is a guess about worst-case latency.** If ADR-0013 retry ladder ever extends beyond 30 seconds, the sentinel could expire mid-request and a duplicate could slip through. *Mitigated by:* the bet transaction is bounded by Postgres `statement_timeout` (recommended ~5s per ADR-0013 Consequences) and the moderation call is bounded by ADR-0014's 6-second budget; total worst case is well under 30 seconds. If ADR-0013's retry budget is ever extended, this ADR's pending TTL must be extended in the same commit.
- **Rate-limit fails open on Upstash unavailability admits a brief abuse window.** *Acceptable because:* Hrishikesh-as-admin can engage manual blocking via SCAFFOLD.4's bypass-allowlist mechanism (operational, not architectural); per ADR-0006, brief vendor outages on a 50-day experiment are acceptable as cost of not user-blocking.

### Neutral

- **Postgres-native idempotency (Brandur's pattern) is documented as the cleaner choice for testnet+ when Dharma becomes a real economic asset.** The rejection here is a phase-fit decision, not a technical-merit decision.
- **AGPL-3.0 licensing applies to both new files (`rate-limit.ts`, `idempotency/cache.ts`).** No third-party code imported beyond `@upstash/ratelimit` (MIT) and `@upstash/redis` (MIT); both are AGPL-compatible.
- **`@upstash/ratelimit` v2.0.8 is the current version.** A `dynamicLimits` flag was added in Jan 2026 for runtime-changeable limits — *not adopted* in v1; experiment limits are static-per-deploy. Documented as a future-consideration if ADR-0017 (or later) ever needs runtime rate-limit tuning.

## Pros and Cons of the Options

### D1 — Idempotency-cache substrate

#### Option 1 — Redis SETNX-with-pending-sentinel on Upstash (chosen)

**Pros**

- Already provisioned via ADR-0006 §3; no new vendor.
- Fast (~1–2ms p99 hot path) — idempotency lookup is in front of every bet, every comment.
- TTL is automatic; no cleanup job.
- SETNX-with-sentinel is the canonical idiom for distributed in-flight dedup; well-understood by Claude Code and the support devs.
- Same substrate as ADR-0014's moderation reservation; co-located concerns are easier to reason about.

**Cons**

- Vendor lock-in to Upstash. Migrating to Postgres at testnet+ requires a new ADR.
- Fails closed on Upstash unavailability; bet flow gated by Redis availability.
- Not durable across Redis restart (acceptable for 24-hour TTL responses; idempotency replay is a network-failure safety net, not a permanent record).

#### Option 2 — Postgres `INSERT … ON CONFLICT DO NOTHING` (Brandur Leach pattern)

**Pros**

- Durable: idempotency cache survives Redis restart.
- Single source of truth (bet ledger and idempotency cache both in Postgres).
- No fail-closed-on-Upstash-down failure mode.
- Brandur's full state-machine pattern (NEW → IN_PROGRESS → COMPLETED with recovery_point) is the canonical practitioner reference for payment-grade systems.

**Cons**

- Adds a write to every state-mutating endpoint at the start of the handler, before the bet transaction wrapper. Cheap, but non-zero.
- Storing full response bodies in Postgres rows is heavier than Redis JSON-encoded strings.
- Cleanup is a `pg_cron` job, not automatic TTL.
- Brandur's full state-machine pattern is over-engineered for a 50-day experiment with dummy Dharma; a "minimal Brandur" without the recovery_point column would be cleaner-than-Redis but lose most of Brandur's actual benefits.
- Adds schema migration to SCAFFOLD.2 + a new projector/cleanup story.

**Verdict:** Rejected for v1; flagged as future-consideration for testnet+ when Dharma becomes a real economic asset. The phase-fit calculus is: experiment uses dummy Dharma, fail-closed on Upstash unreachable is acceptable, and Redis-with-fail-closed is operationally simpler than Postgres-with-cleanup-job.

#### Option 3 — Hybrid (Postgres for completed; Redis for pending)

**Pros**

- Durability for the response cache; speed for the in-flight sentinel.

**Cons**

- Two substrates to reason about for one concern.
- Atomic transition from pending → completed crosses substrate boundaries (Redis DEL + Postgres INSERT); requires a careful idempotent-on-retry implementation.
- Rejection rationale: complexity outweighs the durability gain on a 50-day experiment.

**Verdict:** Rejected. Not worth the cross-substrate coordination cost.

### D2 — Body-mismatch HTTP status code

#### Option 1 — HTTP 409 with `error_idempotency_key_reused` (chosen)

**Pros**

- Semantically a conflict (same key, different body). Matches RFC 9110 §15.5.10 (409 Conflict).
- Aligns with the IETF draft `draft-ietf-httpapi-idempotency-key-header-07` (Jena, Dalal 2025).
- Aligns with Brandur Leach's reference implementation.
- Aligns with ADR-0014's 409 for moderation-reservation collision; consistent across the same handler.

**Cons**

- Diverges from Stripe (which uses HTTP 400). Engineers familiar with Stripe will need a moment to adjust.

#### Option 2 — HTTP 400 with `code: idempotency_error` (Stripe)

**Pros**

- Matches the most-cited prior art (Stripe API).
- Most existing client libraries default to Stripe's behaviour.

**Cons**

- Semantically wrong: the request body is *valid*; the error is that it conflicts with a prior request. HTTP 400 is "bad request"; HTTP 409 is "conflict with current state". Stripe's choice predates the IETF codification.
- Rejection rationale: standards alignment > prior-art mimicry.

**Verdict:** Rejected. We're not building a Stripe-compatible API; standards alignment is the right discipline.

#### Option 3 — HTTP 422

Excluded by ADR-0013 §3 explicit decision: "HTTP 422 is not a valid choice; idempotency-key reuse is a conflict, not a payload-validity problem."

### D3 — In-flight collision response

#### Option 1 — HTTP 409 + `Retry-After: 2` (chosen)

**Pros**

- Mirrors ADR-0014 verbatim. Same handler, same shape, same retry guidance.
- Distinct error code (`error_idempotency_in_flight`) lets clients distinguish from body-mismatch (`error_idempotency_key_reused`).
- 2-second retry-after is generous enough for the dominant case (network-flaky double-submit) without wasting client time.

**Cons**

- HTTP 409 is the same status as body-mismatch; clients must inspect the error envelope code to distinguish. Acceptable: structured error envelopes are required for *all* 4xx/5xx responses per SPEC.2 §15.

#### Option 2 — HTTP 503 + `Retry-After: 2`

**Pros**

- 503 implies "try again, the request might succeed soon" — semantically correct for in-flight.

**Cons**

- 503 is "service unavailable"; the service is *available*, the issue is a coordination conflict.
- Diverges from ADR-0014's 409 for the same conceptual case.

**Verdict:** Rejected. Asymmetric retry-afters across two structurally-similar primitives in the same handler would just confuse client implementations.

#### Option 3 — HTTP 425 Too Early

**Pros**

- Specifically for "request received before its prerequisite request completed."

**Cons**

- 425 was designed for TLS early-data replay (RFC 8470), not for application-layer in-flight dedup. Misapplying it would surprise readers familiar with the RFC.

**Verdict:** Rejected. Wrong semantic match.

### D4 — Idempotency-key scoping

#### Option 1 — Global (chosen)

**Pros**

- Simpler contract: one key = one operation, regardless of endpoint.
- Matches Brandur Leach's pattern and the IETF draft's recommendation.
- Cross-endpoint key collision risk is essentially zero with random-keyed UUIDs (v4 or v7).
- Body-fingerprint catches the legitimate misuse case (same key, different body).

**Cons**

- A buggy client that reuses keys across endpoints sees 409s instead of "silent" cross-endpoint isolation.
- Slight Redis key-pool size increase vs per-endpoint scoping (irrelevant at experiment scale).

#### Option 2 — Per-endpoint (Stripe)

**Pros**

- Allows the same client-generated key to be reused across endpoints without conflict.
- Matches Stripe's API contract.

**Cons**

- "Allows the same key across endpoints" defeats the point of idempotency-keys; clients SHOULD generate one key per logical operation.
- Adds `(method, path, key)` discriminator to every cache entry for no real protection.
- Body-fingerprint catches cross-endpoint misuse anyway; per-endpoint scoping is redundant.

**Verdict:** Rejected. Cleaner contract wins.

### D5 — Body-fingerprint discipline

#### Option 1 — SHA-256 of canonical-JSON full body (chosen)

**Pros**

- One rule; no per-endpoint maintenance burden.
- RFC 8785 (JSON Canonicalization Scheme) is a published standard; canonical-JSON libraries exist.
- Conservative: any client-side body change (intentional or accidental) triggers the mismatch path.
- Matches Stripe's documented behaviour (Stripe normalises before fingerprinting).

**Cons**

- A client that adds a non-meaningful field (e.g., a new client-side telemetry id) silently triggers 409 on retry. Acceptable: client retry-with-same-key requires byte-identical request body.
- ~1ms CPU cost per state-mutating request.

#### Option 2 — Subset of meaningful fields per endpoint

**Pros**

- More forgiving for non-meaningful client-side changes.

**Cons**

- "Meaningful" is a maintenance burden: every endpoint definition must enumerate which fields count.
- A new field added later silently widens the equivalence class — security/correctness footgun.
- Fingerprint correctness becomes part of every endpoint's spec; reviewer load.

**Verdict:** Rejected. Maintenance burden outweighs the marginal usability gain.

#### Option 3 — No body fingerprint

**Pros**

- Simplest possible.

**Cons**

- A client that sends the same key with different bodies on two distinct intent calls (e.g., changed bet amount) silently sees the cached response from the first call. This is the canonical reason idempotency-keys *need* fingerprints.

**Verdict:** Rejected. Defeats the purpose of idempotency replay.

### D6 — Rate-limit window algorithm

#### Option 1 — Sliding-window everywhere (chosen)

**Pros**

- One library call per surface: `Ratelimit.slidingWindow(value, "1 h")`.
- More accurate than fixed-window (no edge-of-window doubling at boundaries).
- Cheaper than token-bucket for anti-abuse caps (no refill-rate state).
- Single primitive across all surfaces simplifies HARDEN.2 test suite.

**Cons**

- Slightly more expensive than fixed-window per check (2 Redis ops vs 1). Negligible at experiment scale.
- Approximates request distribution as uniform within the prior window; a request-spiked prior window slightly underestimates current-window pressure. Acceptable for anti-abuse: small under-estimation is conservative-against-abuse, not in favor of it.

#### Option 2 — Mixed (sliding for windowed, token-bucket for bursts)

**Pros**

- Token-bucket's "burst tolerance" is more natural for genuine-burst use cases.

**Cons**

- Burst caps in our table aren't "productive bursts" (where token-bucket shines); they're anti-abuse caps where sliding-window's accuracy is what matters.
- Two primitives means two failure-mode shapes, two test patterns, two debugging surfaces.

**Verdict:** Rejected. Single primitive wins.

#### Option 3 — Fixed window everywhere

**Pros**

- Cheapest per check (1 Redis op).

**Cons**

- Edge-of-window doubling: a client can hit `value` requests just before window rollover and `value` more just after, effectively doubling the cap.
- For anti-abuse surfaces, this is the wrong defense.

**Verdict:** Rejected. Edge-doubling is an unacceptable anti-abuse property.

### D7 — Mint new Appendix B constants

#### Option 1 — Mint both (chosen)

**Pros**

- Closes the bet + image-PUT-URL anti-abuse gap. Without these, a single compromised account hammers the bet endpoint at network speed.
- Appendix B grows by 2 rows (`TBD` until HARDEN.6); SPEC.1 amendment is small.
- HARDEN.6 owns the values, so no number-tuning lock-in.

**Cons**

- Appendix B grows by 2 rows; small SPEC.1 amendment cost.
- Two more constants to test in HARDEN.2.

#### Option 2 — Mint only image-PUT-URL

**Pros**

- Image upload is a clearer abuse vector; bet placement is gated by Dharma balance.

**Cons**

- A bot account with a non-zero Dharma balance (which every signup gets) can still hammer bet endpoints at network speed during the daily-allowance window. Per-IP defense is the right guard.

**Verdict:** Rejected. Bet placement needs the same defense surface.

#### Option 3 — Mint neither

**Pros**

- Smallest SPEC.1 amendment.

**Cons**

- Leaves a gap in the threat model from now until launch.
- Per the SPEC.1 §16.1 design, bets are intentionally exempt from the productive cap but the *anti-abuse* cap is a separate concern; neither exists without this ADR minting them.

**Verdict:** Rejected. Threat-model coverage is the discipline.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §16.1 | Operational floor constants | **Consumes** the existing 5 constants (`OTP_REQUESTS_PER_EMAIL_PER_HOUR`, `OTP_REQUESTS_PER_IP_BURST_PER_MIN`, `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR`, `RATE_LIMIT_PER_MARKET_PER_DAY`, `RATE_LIMIT_BURST_PER_MIN`); **mints** 2 new constants (`BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`), values deferred to HARDEN.6 |
| SPEC.1 §16.2 | "Network failure on bet" error row | **Consumes** the row's "Idempotency key prevents duplicate submission" promise; substantiates the mechanism |
| SPEC.1 §17 | Acceptance tests | **Mints** 12 new test rows covering idempotency cache states, body-mismatch envelope, in-flight collision, fail-closed and fail-open postures, and the 2 new rate-limit surfaces |
| SPEC.1 §8 (preamble) | Shared write-rate budget across F-COMMENT-1/2/3/6 | **Consumes** the shared-budget concept; implements via two parallel `Ratelimit.limit()` calls per write attempt (per-market 24h + user-wide 1m burst) |
| SPEC.2 §1.4 #5 | "Bet transaction retry policy + jitter formula + idempotency-key shape → ADR-0013 + ADR-0015" | **Consumes** the delegation; closes the idempotency-key-shape half (ADR-0013 closed the retry/jitter half) |
| SPEC.2 §11 | Rate-Limit & Idempotency Contract (stub) | **Mints** — substantive absorption of the stub by this ADR's §Decision Outcome content |
| SPEC.2 §15 | Error Envelope | **Mints** four new error envelope codes: `error_idempotency_key_required` (HTTP 400), `error_idempotency_key_invalid` (HTTP 400), `error_idempotency_key_reused` (HTTP 409), `error_idempotency_in_flight` (HTTP 409, `Retry-After: 2`), `error_idempotency_unavailable` (HTTP 503, `Retry-After: 5`), `error_rate_limit_exceeded` (HTTP 429, `Retry-After: <n>`) |
| ADR-0013 §3 | Idempotency-first ordering | **Consumes** — provides the callable contract (`idempotencyLookupOrReserve`) that the bet handler invokes as the first authenticated work |
| ADR-0014 §3 | Moderation reservation primitive | **Consumes** — confirms the moderation reservation key (`mod:reserve:{user_id}:{market_id}:{idempotency_key}`, 10-second TTL) is structurally distinct from this ADR's idempotency cache key (`idem:{key}`, 30s pending / 24h completed); both consume the same `Idempotency-Key` header but on disjoint key spaces |
| ADR-0006 §3 | Upstash Redis as substrate | **Consumes** — Upstash provides the storage for both rate-limit middleware and idempotency cache |
| ADR-0006 §"Failure-mode profile" | Mixed posture (rate-limit fails open, idempotency fails closed) | **Consumes** and codifies — implementation lives in `rate-limit.ts` and `idempotency/cache.ts` |
| ADR-0007 §4 alarm 6 | Per-vendor unavailability — Upstash unreachable | **Consumes** — both new files are alarm-6 emission sites |
| Tracker | SCAFFOLD.4, ENGINE.7, ENGINE.8, DEBATE.2, DEBATE.6 | All depend on this ADR being `accepted` |

## More Information

- Brandur Leach, *Implementing Stripe-like Idempotency Keys in Postgres*: <https://brandur.org/idempotency-keys>
- Stripe, *Idempotent Requests*: <https://docs.stripe.com/api/idempotent_requests>
- IETF HTTPAPI WG, *The Idempotency-Key HTTP Header Field* (`draft-ietf-httpapi-idempotency-key-header-07`, Jena & Dalal, October 2025; expired April 2026, revision in flight at <https://github.com/ietf-wg-httpapi/idempotency>)
- RFC 8785 — *JSON Canonicalization Scheme (JCS)*: <https://www.rfc-editor.org/rfc/rfc8785>
- RFC 9110 §15.5.10 — *409 Conflict*: <https://www.rfc-editor.org/rfc/rfc9110#name-409-conflict>
- `@upstash/ratelimit` v2.0.8: <https://www.npmjs.com/package/@upstash/ratelimit>; algorithm reference: <https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms>
- ADR-0006 §3 (Upstash Redis substrate) and §"Failure-mode profile" (mixed posture)
- ADR-0007 §4 alarm 6 (Upstash unreachable)
- ADR-0013 §3 (idempotency-first ordering, HTTP 422 exclusion, Postgres-native future-consideration flag)
- ADR-0014 §3 (moderation reservation, 10s TTL, 409 + Retry-After: 2 on collision)

---

*ADR-0015 ratifies the rate-limit and idempotency contract for the Zugzwang experiment phase: sliding-window per-surface rate limits via `@upstash/ratelimit` on Upstash Redis (fail-open on Upstash unreachable); Stripe-style idempotency keys with global scoping, full canonical-body SHA-256 fingerprint, 30-second pending-sentinel TTL plus 24-hour completed-response TTL, fail-closed on Upstash unreachable; HTTP 409 for both body-mismatch and in-flight collision (with `error_idempotency_key_reused` and `error_idempotency_in_flight` envelope codes respectively); two new Appendix B constants `BET_ATTEMPTS_PER_IP_PER_MIN` and `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` minted with values deferred to HARDEN.6. The decision body and any constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
