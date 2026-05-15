# SCAFFOLD.4 — Upstash Redis substrate (rate-limit middleware + idempotency cache)

**Status:** Closed 2026-05-15
**Branch:** `feat/scaffold-4` (pre-merge at log-write time)
**PR:** _to be opened immediately after this log commits_
**Predecessor:** SCAFFOLD.14 (`c7936e1`); Plan committed at `46a260f`
**Unblocks:** SCAFFOLD.3 (Better Auth + OTP rate-limit consumer), ENGINE.7 (bet wrapper idempotency cache + 40001/40P01 retry), ENGINE.8 (bet flow API), DEBATE.2 (comment + image surfaces), DEBATE.6 (friendly-fire vote/clear/freeze) — five downstream tasks gated on this substrate per ADR-0015 absorption row + SPEC.2 §23.1 phase tables.

---

## What landed

Six commits on `feat/scaffold-4` after the plan commit (`46a260f`):

| # | SHA | Subject |
|---|---|---|
| 1 | `61cf08d` | chore(scaffold-4): test scaffolding (24 failing tests, tests-first per §5.6) |
| 2 | `74bfb22` | chore(scaffold-4): deps — @upstash/redis 1.38.0 + @upstash/ratelimit 2.0.8 + canonicalize 3.0.0 |
| 3 | `8be4454` | feat(scaffold-4): rate-limit middleware + idempotency cache substrate |
| 4 | `ae96849` | chore(scaffold-4): vitest mock-hoisting plumbing fixes |
| 5 | `7b32c59` | chore(scaffold-4): env example — Upstash Redis (Vendor 4) |
| 6 | `9e3bae5` | docs(spec-2): tighten §11 pending-sentinel body-mismatch shape |
| 7 | `6b9bf1f` | chore(scaffold-4): canonicalize is Apache-2.0, not MIT |

Source files (5 new under `src/server/`):

| File | LOC | Owner |
|---|---|---|
| `src/server/config/limits.ts` | 32 | 7 SPEC.1 §16.1 numeric placeholders; HARDEN.6 named in JSDoc as the tuning source |
| `src/server/idempotency/types.ts` | 102 | header name + key regex + 2 TTL constants (PENDING=30s, COMPLETED=86400s) + 5 ADR-0015 error codes + RATE_LIMIT_ERROR_CODE + `IdempotencyResult` 5-arm tagged union |
| `src/server/upstash/redis.ts` | 27 | singleton `Redis.fromEnv({ automaticDeserialization: false })` per Q3 ratification |
| `src/server/idempotency/cache.ts` | 145 | `computeBodyFingerprint` (RFC 8785 + SHA-256 + hex) + `idempotencyLookupOrReserve` state machine + bounded race-retry + fail-CLOSED catch |
| `src/server/middleware/rate-limit.ts` | 181 | 7 sliding-window Ratelimit instances + identifier helpers + `checkRateLimit` dispatcher + fail-OPEN catch |

Test files (3 new under `tests/`):

| File | Tests | Plan §7 row |
|---|---|---|
| `tests/unit/body-fingerprint.test.ts` | 4 | §7.2 |
| `tests/integration/idempotency-cache.integration.test.ts` | 12 | §7.1 (incl. row 5 Q4 ratification) |
| `tests/integration/rate-limit.integration.test.ts` | 8 | §7.3 |

Other touched:
- `package.json` — 3 deps added, all pinned exact (no caret)
- `pnpm-lock.yaml` — synced
- `.env.example` — 1 new section header + 2 placeholder keys (Vendor 4 Upstash)
- `docs/specs/SPEC.2.md` — §11 prose-tightening sentence + §0 v0.3-draft → v0.3.1-draft + §0.1 change-log row (per Q4 / Amendment 1)
- `docs/plans/SCAFFOLD.4.md` — committed at `46a260f` before this branch's work

13 files changed total, +2115 lines vs `origin/main` (excluding the plan), 24 tests added, 24 passing.

---

## Decisions made

### Variances absorbed

1. **canonicalize@3.0.0 vs plan's `^2.x`.** pnpm grabbed 3.0.0 stable; investigated and accepted as benign:
   - 49 LOC, ESM-native default-export `canonicalize(value): string`
   - Same call-site API as 2.x (`import canonicalize from "canonicalize"`)
   - Stricter NaN/Infinity throws — improves fingerprint stability
   - Apache-2.0 license (NOT MIT as plan §F2 comment originally claimed; corrected at commit `6b9bf1f` per code-reviewer LOW finding)
   - Pinned exact `3.0.0` (no caret) per plan's pin-exact discipline
   - Pre-PR self-audit + code-reviewer call both PASS

2. **`@upstash/redis` pinned exact `1.38.0`.** Plan said "latest stable; pin exactly at install"; pnpm initially defaulted to caret `^1.38.0`; manually edited package.json to remove the caret per plan's pin-exact discipline. `@upstash/ratelimit: 2.0.8` was pinned exact from the start per plan's `D6 closing paragraph` instruction.

3. **`automaticDeserialization: false` on the singleton Redis client (load-bearing addition vs plan §F5).** Plan §F5 said `Redis.fromEnv()` plain. Investigation (during cache.ts implementation): `@upstash/redis` auto-parses JSON on `GET` by default; this would break the cache state machine because `existing.startsWith(PENDING_SENTINEL_PREFIX)` requires `existing` to be a string, not an object. The flag forces raw-string return so cache.ts owns its own JSON pipeline. Documented in `redis.ts` JSDoc as load-bearing, not stylistic. Verified `@upstash/ratelimit` is unaffected (it uses `evalsha`, response shape independent of `automaticDeserialization`).

4. **vitest mock-hoisting plumbing fix (commit `ae96849`).** Discovered at Step 10 verification: `vi.mock()` factories can't reference top-level `const` (factory hoists above all top-level statements). Fixed via `vi.hoisted({ ... })` wrapper around `mockRedis` and `ratelimitInstances`. Also flipped `afterEach` from `vi.restoreAllMocks()` to `vi.clearAllMocks()` because `restoreAllMocks` would detach the module-level `consoleErrorSpy` after the first test, breaking the fail-closed (cache row 9) and fail-open (rate-limit row 5) assertions. Test SCENARIOS unchanged; only mock machinery adjusted.

5. **Body-fingerprint test mock for `@/server/upstash/redis` (commit `ae96849`).** `computeBodyFingerprint` is pure but its containing module imports the singleton wrapper which calls `Redis.fromEnv()` at module-load. Without env vars, stderr printed warnings during the unit test. Added a mock to suppress noise; doesn't affect test assertions.

### Amendments landed (per plan §Open Questions)

- **Q3 wrapper file `src/server/upstash/redis.ts`** — added per plan ratification with module-level JSDoc explicitly naming the additive-utility classification and referencing SPEC.2 §11.6 confirming this is NOT a contract amendment (the §11.6 file map names rate-limit.ts + cache.ts + types.ts as the load-bearing trio; redis.ts is internal testability + one env-read site).
- **Q4 ratification (pending body-mismatch returns in-flight shape)** — implemented in cache.ts:127–138 (pending arm returns `kind: 'pending'` regardless of fingerprint match). Same-commit SPEC.2 §11 prose tightening landed at commit `9e3bae5` per Amendment 1; version bump v0.3-draft → v0.3.1-draft + §0.1 change-log row applied. ADR-0015 §22.1 status row unchanged (`accepted 2026-05-07`).
- **Q5 `canonicalize` dep** — added; rationale documented in cache.ts module-level comment per Q5 resolution body.
- **Q6 ADR-0015 file does not exist at `docs/adr/0015-rate-limit-idempotency.md`** — observation re-confirmed; no action this task; carry-forward to post-SCAFFOLD.4 tracker sweep chat per Q6 resolution.

### Tracker drift-corrections (closed by this PR per plan §Tracker context)

1. "token-bucket" rate-limit algorithm → **sliding-window** via `@upstash/ratelimit` v2.0.8's `Ratelimit.slidingWindow(maxRequests, durationLiteral)`. Source: ADR-0015 D6 + SPEC.2 §11 ¶2.
2. "lightweight job queue" → **dropped from SCAFFOLD.4 scope.** ADR-0006 §22 settled cron topology (`pg_cron` primary + Vercel Cron HTTP-fanout for R2 orphan sweep). No Upstash-side queue in v1. Source: ADR-0006 §22 + SPEC.2 §3.5 Pattern A-2 + §12.6.
3. "SPEC.16 dep" → **SPEC.16 = ADR-0015**, status `accepted 2026-05-07` per SPEC.2 §22.1 row 13. Source: SPEC.2 §22.1 + line 43 absorption row.

Tracker HTML row description carries the stale wording; not in SCAFFOLD.4 commit scope (tracker is operational, not code). Surface for the next tracker-sweep chat.

### Reviewer-call outcomes

- **`test-writer`** (Step 2, fresh-context general-purpose Agent): wrote 24 failing tests across 3 files per plan §7. Honored tool-scope constraint (no `src/` writes). Verified red via `pnpm vitest run` (3 file-load errors — natural ESM failure when source modules don't exist).
- **`code-reviewer`** (Step 12, fresh-context general-purpose Agent): zero CRITICAL, zero HIGH, zero MEDIUM findings. 4 LOW findings; one fixed in-session (canonicalize license comment), three deferred per Amendment 2 finding policy:
  - LOW: `computeBodyFingerprint` is `async` but body is synchronous (cosmetic; no consumer behavior change). Defer.
  - LOW: `result.pending` from `@upstash/ratelimit.limit()` silently dropped. Safe today (single-region Mumbai + `analytics: false` makes `pending` a noop). If a future ENGINE.7+ task moves any rate-limited route handler onto Vercel Edge, `pending` should be threaded through `context.waitUntil(pending)` — note for SCAFFOLD.5 (Sentry wiring) or HARDEN-phase Edge sweep.
  - LOW: `release` callback in `cache.ts` doesn't catch Upstash errors during the completion-promotion `SET` or crash-DEL. Errors propagate to caller's `finally`. Plan §F2 + §5 don't require special handling; pending sentinel auto-expires at 30s either way (TTL safety net). Documentation-only finding; consider JSDoc note on `release` callback contract clarifying release-time error propagation.
- **`security-auditor`** — NOT invoked per plan §"security-auditor — NOT invoked." SCAFFOLD.4 has no auth flow, no admin surface, no resolution mechanic, no moderation path. Structural-separation invariants untouched.
- **`db-migration-reviewer`** — NOT invoked. No `src/db/schema/` or `drizzle/migrations/` changes.

### Pre-PR self-audit

8/8 items PASS per plan §"Pre-PR self-audit checklist":

1. ✓ 7 Ratelimit instances match SPEC.2 §11 row-for-row (prefix + window + constant)
2. ✓ 5 IdempotencyResult arms reachable (`hit | mismatch | pending | miss | unavailable`)
3. ✓ Posture asymmetry correct + tag strings byte-identical to SPEC.2 §17.3 col 4
4. ✓ 6 ADR-0015 error codes verbatim
5. ✓ .env.example new section + 2 placeholder keys (no secrets)
6. ✓ 7 limits constants + HARDEN.6 JSDoc each
7. ✓ Tracker drift-corrections captured (this log §Decisions made)
8. ✓ SPEC.2 §11 prose tightening + version bump + change-log row + ADR-0015 status unchanged

---

## Open questions / non-blocking items

1. **canonicalize is Apache-2.0, not MIT (closed by `6b9bf1f`).** No outstanding. Closed.

2. **Three LOW code-reviewer deferrals.** All forward-looking; not load-bearing for SCAFFOLD.4's substrate contract:
   - `computeBodyFingerprint` async-keyword cosmetic (no fix needed)
   - `result.pending` Edge-runtime concern → revisit at first Edge-runtime route handler in ENGINE.7+
   - `release` callback Upstash error propagation → revisit at consumer wiring in ENGINE.7+ if behavior surprises

3. **ADR-0015 file (`docs/adr/0015-rate-limit-idempotency.md`) still does not exist.** Q6 observation; SPEC.2 line 43 is canonical for substance. Out of SCAFFOLD.4 scope; defer to post-SCAFFOLD.4 tracker sweep.

4. **Tracker row description for SCAFFOLD.4 carries stale "token-bucket" + "lightweight job queue" wording.** Tracker HTML is operational, not code. Surface in next tracker-sweep chat per plan §Risks #8.

5. **Pre-existing tsconfig drift: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` not enabled.** AGENTS.md §1 line `Language | TypeScript 5.x strict | strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes all true` says they SHOULD be on; current `tsconfig.json` only has `strict: true`. Pre-existing drift, not absorbed by this PR (CLAUDE.md §5.4 stay in scope). If turned on in a future cleanup pass, `rate-limit.ts:158` (`SURFACE_INSTANCES[surface]` → `Ratelimit | undefined`) would need a non-null assertion or defensive guard. Surface for whichever PR enables the strict-er flags.

6. **Upstash account provisioning + `.env.local` population** — operator out-of-band click-flow per plan §"Out of scope" item 5. Hrishikesh signs up at https://console.upstash.com/redis (`ap-south-1` / Mumbai region per ADR-0006 §4) and pastes `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` into `.env.local` and Vercel env.

7. **Sentry stub site → real Sentry SDK at SCAFFOLD.5.** `console.error('upstash_unavailable_rate_limit', err)` and `console.error('upstash_unavailable_idempotency', err)` are stubs with verbatim tag strings matching SPEC.2 §17.3 column 4. SCAFFOLD.5 swaps in `Sentry.captureException` + tag setting.

8. **HARDEN.6 number tuning** — 7 placeholder values in `limits.ts`; tests read constants live so retunes don't break assertions.

---

## Next session starts at

**SCAFFOLD.3** (Better Auth wiring + OTP rate-limit consumer) — first task that consumes the SCAFFOLD.4 substrate via `checkRateLimit('otpRequestPerEmail', otpEmailIdentifier(email))` + `checkRateLimit('otpRequestPerIpBurst', ipIdentifier(ip))` from `@/server/middleware/rate-limit`. Per plan §Tracker context unblocks list, SCAFFOLD.3 is the canonical first downstream consumer.

If a different task lands first (parallel SCAFFOLD.* or visual DESIGN.* track), the consumer interface contract is documented in `src/server/middleware/rate-limit.ts` exports + `src/server/idempotency/cache.ts` exports; the §11 in-handler call sequence (auth gate → idempotency-validate → idempotency-lookup → rate-limit → moderation → handler body → events-row) is the canonical wiring per SPEC.2 §11.

---

## Context to preserve

- **Q3 ratified the wrapper file** `src/server/upstash/redis.ts` as additive utility; SPEC.2 §11.6 file map unchanged. Future drafters should treat the file map as load-bearing-files-named, not exhaustive-files-named.
- **Q4 ratified pending body-mismatch as in-flight shape** (NOT completed-mismatch). cache.ts:127–138 is the implementation; SPEC.2 §11 paragraph "Single-key-encoding-both-states pattern" is the contract surface. Future readers grep `idempotency::in-flight-mismatch-still-409-on-pending-sentinel` to find the test.
- **Asymmetric failure-mode posture is load-bearing.** rate-limit.ts fails OPEN, cache.ts fails CLOSED. Per ADR-0006 §"Failure-mode profile". Future drafters/auditors who see this asymmetry and try to "fix" it would be reverting a deliberate decision.
- **`automaticDeserialization: false` on the Redis singleton is load-bearing**, not stylistic. Without it, `existing.startsWith(PENDING_SENTINEL_PREFIX)` in cache.ts would throw on a non-string. Documented in `redis.ts` JSDoc.
- **Race-retry path in `tryReserveOrLookup` is bounded.** If SET NX fails AND GET returns null, retry once. After retry, throw → outer catch maps to `{ kind: 'unavailable' }`. Stronger than plan §F2 pseudocode's loose recursion; correctness-preserving (caller surfaces 503 rather than fabricating a `miss` arm).
- **Stub Sentry tag strings are the contract surface for SCAFFOLD.5.** `upstash_unavailable_rate_limit` and `upstash_unavailable_idempotency` MUST stay byte-identical so SCAFFOLD.5's text-search-and-replace lands cleanly. TODO comments in cache.ts and rate-limit.ts name SCAFFOLD.5.
- **Pre-existing test failures (14 `tests/db/triggers/*` files)** require local Supabase + `DATABASE_URL` in `.env.local`. Untouched by this PR. Standalone diagnostic: those tests are written for SCAFFOLD.2 schema, not SCAFFOLD.4 substrate; documented for traceability so a future reader doesn't think this PR broke them.
- **`pnpm test:invariants` passes unchanged** — no I-* files added or changed; SCAFFOLD.4 is upstream of every invariant surface. INV-1 / INV-2 storage-layer guarantees live at ENGINE.7's bet wrapper, not at this substrate.

---

## Time

~3.5h wall clock from Phase 2 start (read plan + spec context) to log commit. Roughly aligned with the plan's 3-4h budget.

---

## Single source of truth — files touched

| File | State | Notes |
|---|---|---|
| `docs/plans/SCAFFOLD.4.md` | Committed at `46a260f` (pre-Phase-2) | Plan body; Q1–Q6 + Amendments 1+2 absorbed |
| `package.json` | +3 deps exact-pinned | `@upstash/ratelimit@2.0.8`, `@upstash/redis@1.38.0`, `canonicalize@3.0.0` |
| `pnpm-lock.yaml` | Synced | |
| `.env.example` | +7 lines / +1 section / +2 keys | SCAFFOLD.4 section header convention follows SCAFFOLD.14 |
| `src/server/config/limits.ts` | New | 7 §16.1 numeric placeholders |
| `src/server/idempotency/types.ts` | New | constants + 6 error codes + 5-arm IdempotencyResult |
| `src/server/upstash/redis.ts` | New | singleton wrapper per Q3; `automaticDeserialization: false` load-bearing |
| `src/server/idempotency/cache.ts` | New | RFC 8785 fingerprint + state machine + Q4 honored + fail-CLOSED + Apache-2.0 comment fix |
| `src/server/middleware/rate-limit.ts` | New | 7 Ratelimit instances + identifier helpers + checkRateLimit dispatcher + fail-OPEN |
| `tests/unit/body-fingerprint.test.ts` | New | 4 tests, plan §7.2 |
| `tests/integration/idempotency-cache.integration.test.ts` | New | 12 tests, plan §7.1 incl. Q4 row |
| `tests/integration/rate-limit.integration.test.ts` | New | 8 tests, plan §7.3 |
| `docs/specs/SPEC.2.md` | Modified (-4/+5) | §11 prose tightening + §0 v0.3.1-draft + §0.1 change-log row |
| `docs/logs/SCAFFOLD.4.md` | This file | Committed via post-Step-12 separate commit before `gh pr create` |
| `.env.local` | Untracked (operator) | UPSTASH_REDIS_REST_URL + TOKEN populated locally + in Vercel out-of-band per plan §"Out of scope" item 5 |
| `Vercel env (Production + Preview)` | Operator action | Same 2 keys as `.env.local`, scope per SCAFFOLD.14 precedent |
| Upstash console (Mumbai region) | Operator action | Database created per ADR-0006 §4 jurisdiction |

---

## CLAUDE.md / AGENTS.md / workflow / tracker amendments

Per CLAUDE.md §7 closing ritual ("Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this session?"):

- **CLAUDE.md** — no amendment. SCAFFOLD.4 is critical-by-consequence per Q1 ratification; the §1 enumeration stays narrow per Q1 Web Claude resolution. The one-off carve-out is documented in the plan header field, not in CLAUDE.md.
- **AGENTS.md** — no amendment. Stack patterns unchanged; pnpm-lock + biome conventions held.
- **Workflow (CLAUDE.md §5)** — no amendment. Tests-first via test-writer reviewer-call (§5.6 + §5.11), 8-item self-audit (§5.10), code-reviewer reviewer-call after audit (§5.11), log before PR (§5.9) all followed. Commit discipline (one logical commit per stratum) followed; mock-hoisting plumbing was a small unplanned commit but cleanly separated from source.
- **Tracker** — SCAFFOLD.4 row stays "token-bucket + lightweight job queue" stale wording; surface in post-SCAFFOLD.4 tracker sweep chat. No mid-PR tracker edit (HTML, not code).
- **Amendments worth surfacing in maintenance loop** (per `docs/maintenance.md`):
  - tsconfig drift vs AGENTS.md §1 (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` named in AGENTS but not in tsconfig). Pre-existing; not absorbed.
