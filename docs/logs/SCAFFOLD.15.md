# SCAFFOLD.15 — close-out

> Stratum close-out per CLAUDE.md §5.9. R2 storage substrate + signed-URL
> endpoint + orphan-sweep cron + baseline moderation client.

- **Task:** SCAFFOLD.15 — R2 buckets + signed-URL endpoint + orphan-sweep + bucket policies
- **Closed:** 2026-05-24
- **Branch:** `feat/scaffold-15-r2-storage-substrate` (cut off `plan/scaffold-15` at `0040270`)
- **PR:** TBD (this commit + the implementation commit + PR open)
- **Plan:** `docs/plans/SCAFFOLD.15.md` (committed `0040270`; amended in same execute commit per absorption rule)
- **Authority chain followed:** CLAUDE.md §1–§8 + AGENTS.md §1–§11 + SPEC.2 §3.1, §3.7, §6.3, §10, §11, §12

---

## What landed

23 changed files (17 new + 9 modified) across schema, server, route handlers, env, deps, tests, spec amendments. No source code outside SCAFFOLD.15 critical-path scope was touched.

### New (substrate)

- **`drizzle/migrations/0006_image_uploads_extension.sql`** — Extends `image_uploads` with `content_type text NOT NULL` + `byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 8388608)`, drops `image_uploads_terminal_state_idx`, creates partial `image_uploads_orphan_sweep_idx ON image_uploads(created_at) WHERE terminal_state IS NULL`, re-creates `enforce_image_uploads_terminal_atomic()` trigger via `CREATE OR REPLACE` to extend the immutable column list. Journal entry idx 6 + snapshot at `drizzle/migrations/meta/0006_snapshot.json`.
- **`src/lib/errors.ts`** — Discriminated `DomainError` registry (7 kinds per plan §5.3 — `storage_unavailable`, `storage_object_missing`, `moderation_unavailable`, `moderation_in_flight`, `image_mime_rejected`, `image_oversize`, `orphan_sweep_lock_contention`). Each class carries a public readonly `kind` + `toEnvelope()` shape.
- **`src/server/storage/r2.ts`** — Bucket-scoped S3-compat client wrappers (`mintPutUrl` / `mintReadUrl` / `headObject` / `deleteObject`). Two `S3Client` instances cached at first call per bucket (uploads, pfp) using per-bucket env vars per B2.
- **`src/server/storage/sign-upload.ts`** — `signUploadAndInsert({db, userId, contentType, byteSize})` validates → INSERT `image_uploads` row → mints PUT URL. Q9 key shape `u/${userId}/${uploadId}.${ext}` (lowercase canonical ext per MIME).
- **`src/server/storage/sign-read.ts`** — `signRead(key, ttlSeconds)` thin wrapper around `mintReadUrl("uploads", key, ttlSeconds)`.
- **`src/server/storage/sweep-orphans.ts`** — Orphan-sweep loop helper. **UPDATE-then-delete** order (per security-auditor MEDIUM #1 absorption): CAS-UPDATE first, deleteObject second; eliminates the W-2/sweep TOCTOU window. Layer 1 R2 90-day lifecycle is the R2-side safety net.
- **`src/server/moderation/openai.ts`** — `moderate({text, imageUrl?})` against `omni-moderation-2024-09-26` snapshot, 3s timeout, 1 retry on transient, fail-CLOSED via `ModerationUnavailableError`. 4xx auth fails immediately + emits byte-stable `openai_moderation_auth_failure` Sentry stub tag.
- **`src/server/moderation/precommit.ts`** — `precommitModerate({text, imageR2Key?, idempotencyKey, userId, marketId})` owns the 10-second `mod:reserve:*` Redis reservation lifecycle (SET NX EX 10 + DEL in finally + throw on collision). Verdict mapping per SPEC.2 §10.10: `'sexual/minors'` → `track_a` (REFUSAL-2 CSAM legal floor); any other flagged → `track_b`; none → `pass`. Defensive `imageR2Key` shape gate (`u/<userId>/<uploadId>.<ext>` namespace-scoped to caller) per security-auditor LOW absorption.
- **`src/server/upstash/lock.ts`** — `acquireLock(key, ttlSeconds)` SET NX EX + `releaseLock(key, token)` Lua-EVAL token-matched DEL. Prevents stuck-lock-from-prior-run releasing the current run after the prior's TTL expires.
- **`src/server/middleware/origin-allowlist.ts`** — `checkOrigin(request)` cross-cutting CSRF defense. Allowlist derived from `BETTER_AUTH_URL` (http+https variants). Codified as load-bearing primitive via same-commit SPEC.2 §4.1 amendment.
- **`src/app/api/uploads/sign/route.ts`** — `POST` handler. Seven-step stack with one documented exemption (Idempotency-Key per Q2 + SPEC.2 §11 amendment). Origin → auth gate (session + onboarding re-check mirroring `createSessionGate`) → rate-limit (`imagePutUrlPerIp`) → body validate (hand-rolled shape; semantic via helper) → `signUploadAndInsert` → ENGINE.6 event stub. `StorageUnavailableError` → HTTP 503 with `Retry-After: 5`.
- **`src/app/api/cron/r2-orphan-sweep/route.ts`** — `GET` handler (per Vercel Cron contract). Bearer `CRON_SECRET` via `crypto.timingSafeEqual` constant-time compare → `acquireLock` → outer try/catch around `sweepOrphans` (maps unexpected throws to `{status:'error', swept:0}` HTTP 200 to preserve cron-is-not-failing signal per security-auditor MEDIUM #2 absorption) → `finally { releaseLock }`.
- **`vercel.json`** — Single `crons[]` entry: `0 */6 * * *` schedule on `/api/cron/r2-orphan-sweep`.

### New (tests)

- 5 integration tests via test-writer reviewer call: `sign-upload`, `sign-read`, `precommit-moderate`, `upstash-lock`, `orphan-sweep` (54 tests total, all RED at write → all GREEN at impl).
- 3 probe tests: `_probe-aws-sdk-presigned-put.test.ts` (type-contract; 3 tests), `_probe-openai-omni-shape.test.ts` (3 tests), `_probe-r2-roundtrip.test.ts` (1 test, default-OFF, gated on `R2_PROBE_LIVE === 'true'` with `probe/` key prefix per kickoff safety).

### Modified

- **`src/db/schema/image-uploads.ts`** — `contentType` + `byteSize` columns; partial sweep index (`.where(sql\`terminal_state IS NULL\`)`); old enum-index removed.
- **`src/server/config/limits.ts`** — 13 new constants per SCAFFOLD.15 §5.5 + SCAFFOLD.5-absorption `ORPHAN_SWEEP_BATCH_SIZE` lifted from route module to limits for greppability.
- **`.env.example`** — 10 SCAFFOLD.15 env lines + `R2_PROBE_LIVE` gating var = 11 new lines.
- **`package.json`** — 3 deps literal-pinned per Q1 (`@aws-sdk/client-s3@3.1045.0`, `@aws-sdk/s3-request-presigner@3.1045.0`, `openai@6.39.0`) + 2 scripts (`test:invariants`, `test:integration`).
- **`tests/db/triggers/image-uploads-append-only.spec.ts`** — Extended +5 cases per plan §3.3 (8 → 13). New cases: driver + content_type/byte_size mutation rejected (P0001) + byte_size CHECK at INSERT (SQLSTATE 23514).
- **`drizzle/migrations/meta/_journal.json`** + **`drizzle/migrations/meta/0006_snapshot.json`** — drizzle-kit journal + snapshot for 0006.
- **`docs/specs/SPEC.2.md`** — 13 same-commit amendments per plan §4 + 2 SURPRISE-7/8 propagations (lifecycle 30d→90d in §12.3/§12.6, PFP base URL substitution in §12.7). Grep-clean: `POST /api/cron/r2-orphan-sweep` = 0 hits, `33+ cases minimum` = 0 hits, `comments/{user_id}/{yyyy}` = 0 hits, `Cross-cutting Origin-allowlist` = 1 hit.
- **`docs/plans/SCAFFOLD.15.md`** — Same-commit annotations for SURPRISE-7 (lifecycle 30d→90d in §5.11/Q7/§4 amendment #6+#10) + SURPRISE-8 (custom domain deferral in §2.2/§5.11/§7.1.4/§8.2).

---

## Decisions made

### Same-commit SPEC.2 amendments (13 plan items + 3 SURPRISE absorptions)

All 13 plan §4 items landed verbatim; grep-verification per plan §4 ¶197 returned the expected zero-hit set. Two additional SURPRISE-driven amendments propagated through the spec at the same time (SURPRISE-7 + SURPRISE-8 below).

### In-stratum absorptions (post-reviewer)

- **MEDIUM (security-auditor #1) — sweep-orphans ordering inversion.** Switched from `delete-then-UPDATE` to `UPDATE-CAS-then-delete`. Eliminates the TOCTOU window where a concurrent W-2 commit between SELECT and UPDATE could leave a `committed` row pointing at a deleted R2 object. New semantic: `swept` counts DB-orphan-terminalizations (CAS-success), not R2 delete successes. R2 cleanup is best-effort; Layer 1 R2 90-day lifecycle is the safety net per SPEC.2 §12.6 layer asymmetry. **Updated 3 affected integration tests** to match new semantics (`continues-past-per-row-r2-error`, `circuit-breaker-aborts-after-N`, `circuit-breaker-resets-on-success`).
- **MEDIUM (security-auditor #2) — cron handler outer try/catch.** Added outer try/catch around `sweepOrphans` to map unexpected throws (e.g., DB connection failure during candidate SELECT) to `{status:'error', swept:0}` HTTP 200 — preserves Vercel-cron-is-not-failing operational signal.
- **LOW (security-auditor) — `StorageUnavailableError` 503 includes `Retry-After: 5`** per SPEC.2 §11 convention. Matches the idempotency-cache 503 surface.
- **LOW (security-auditor) — `precommitModerate` defensive `imageR2Key` shape gate.** Path `u/<userId>/<uploadId>.<ext>` namespace-scoped to caller's `userId`. Prevents a future misconfigured caller from minting a signed READ URL into arbitrary `uploads/`-bucket objects.
- **LOW (code-reviewer) — SCAFFOLD.5 TODO comment block added to `sweep-orphans.ts`** matching the convention at `rate-limit.ts:174-178`.
- **LOW (code-reviewer) — `BATCH_SIZE = 100` lifted from route module to `limits.ts`** as `ORPHAN_SWEEP_BATCH_SIZE` for SCAFFOLD.5 greppability.
- **LOW (code-reviewer) — Justification comment added to OpenAI moderation trust-boundary casts.**
- **MEDIUM (code-reviewer) — `make_interval(mins => ${orphanWindowMinutes})` substituted for the awkward text-concat interval formulation** in `sweep-orphans.ts`. Cleaner SQL, same parameter binding.

### Deviations from plan §5

- **`src/app/api/uploads/sign/route.ts`** — body validation is **hand-rolled** (no Zod direct-dep). Plan §5.6 step 5 suggested Zod but plan §5.10 only authorized 3 new deps (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `openai`); adding `zod` as a direct dep was unauthorized scope. Semantic validation still happens inside `signUploadAndInsert` via the typed error classes. In-stratum cleanup absorption per CLAUDE.md §7.
- **`src/server/storage/sweep-orphans.ts`** — deliberately avoids `FOR UPDATE SKIP LOCKED` inside a wrapping transaction. Plan §5.6 prose mentions that pattern, but holding a DB transaction across the R2 HTTP call would violate CLAUDE.md §3 ("HTTP inside a DB transaction"). Substitute defenses: (a) distributed lock at handler layer ensures single-runner across Vercel cron fanout; (b) UPDATE WHERE-CAS predicate (`terminal_state IS NULL`) protects against concurrent W-2 commit. Documented in code header.
- **`src/server/moderation/precommit.ts`** — defensively wraps any throw from `moderate()` into `ModerationUnavailableError`. Plan §5.2 didn't call this out, but the test-writer's `reservation-deleted-on-throw` test required it (a mock that throws raw `Error` rather than `ModerationUnavailableError` would otherwise leak the raw type). Production path through `openai.ts` already throws `ModerationUnavailableError`; the precommit wrap is idempotent.

### Substrate substitution

- Custom domain `cdn.zugzwangworld.com` bind on `zugzwang-pfp` is **deferred to post-experiment** per SURPRISE-8. Substituted with R2 public dev URL on `zugzwang-pfp` (`R2_PUBLIC_URL_PFP` env var). Architectural impact: no edge cache for PFP reads during experiment phase; R2 Class B costs ≤$2 over experiment window (within free tier).

---

## Surprises caught + fixed in-session

Per user-memory `feedback_audit_surprises.md` — full chain, not buried.

### Operator-side (carried in via kickoff; absorbed same-commit)

- **SURPRISE-7 (MEDIUM): lifecycle window 30d → 90d on `zugzwang-uploads` Rule A (prefix `u/`).** Plan + research-brief locked 30d, but experiment runs Sep 15 → Nov 5 = 51 days plus archive window. 30d would auto-delete committed images mid-experiment (R2 lifecycle is age-based, not DB-state-aware). Operator-side rule already applied at 90d on bucket. CC absorbed in same-commit: plan §5.11/Q7, plan §4 amendments #6 + #10 prose updated to "90-day", SPEC.2 §12.3 + §12.6 amendments now reference 90-day Layer 1 lifecycle.

- **SURPRISE-8 (MEDIUM): Custom Domain `cdn.zugzwangworld.com` bind deferred to post-experiment.** `zugzwangworld.com` DNS hosted at Namecheap, not Cloudflare. Partial-CNAME setup requires Cloudflare Business plan ($200+/mo, infeasible at experiment scale). Full nameserver migration carries email risk for the founder's primary identity. Operator-side: R2 public dev URL enabled on `zugzwang-pfp` instead. CC absorbed same-commit: plan §2.2 deferred-row updated, §5.11 substrate substitution noted, §7.1.4 gating-item struck, §8.2 probe substituted, SPEC.2 §12.7 amendment adds R2_PUBLIC_URL_PFP substrate-substitution paragraph + post-experiment tracker entry queued.

- **SURPRISE-9 (LOW): R2 secret key length not independently verified at operator-substrate clearance.** R2 secrets are deterministically 64 hex chars; if stored value differs, sign requests fail with SignatureDoesNotMatch. Documented in `tests/server/storage/_probe-r2-roundtrip.test.ts` header so the next probe-time SignatureDoesNotMatch surfaces secret-length as root-cause check #1. No SPEC amendment needed.

### Execute-time (new in this chat; absorbed same-commit)

- **SURPRISE-10 (LOW): `precommit.ts` defensively wraps `moderate()` throws.** Test contract from test-writer required precommit to wrap any throw from `moderate()` into `ModerationUnavailableError` (test mock throws raw `Error`). Plan §5.2 didn't explicitly call for this; production path through `openai.ts` already produces `ModerationUnavailableError`. In-stratum implementation detail; documented in `precommit.ts` comment.

- **SURPRISE-11 (LOW): Hand-rolled body validation in upload-sign route (no Zod direct-dep).** Plan §5.6 step 5 suggested Zod but plan §5.10 only authorized 3 new deps. Hand-roll covers syntactic shape; semantic validation flows through `signUploadAndInsert` typed-error classes. CLAUDE.md §7 cleanup absorption.

- **SURPRISE-12 (LOW): `sweepOrphans` uses compare-and-swap WHERE instead of `FOR UPDATE SKIP LOCKED`.** Plan §5.6 prose mentions SKIP LOCKED but that requires a wrapping transaction across the R2 HTTP call → CLAUDE.md §3 refusal. Distributed lock + `WHERE terminal_state IS NULL` compare-and-swap is the substitute. Documented in `sweep-orphans.ts` header.

- **SURPRISE-13 (MEDIUM): Sweep-orphans ordering inverted from delete-then-UPDATE to UPDATE-CAS-then-delete.** Surfaced by security-auditor as a TOCTOU window where a concurrent W-2 commit between SELECT and UPDATE could leave a `committed` row pointing at a deleted R2 object. Fixed in-session; 3 integration tests updated to match new semantics.

- **SURPRISE-14 (MEDIUM, pre-existing): `bannedAt` not enforced anywhere in the codebase.** Surfaced by security-auditor. SPEC.2 §8.6 requires request-time ban enforcement on every state-mutating handler. No handler in the codebase currently honors `users.banned_at` — including pre-existing surfaces (`createSessionGate`, OTP gate). SCAFFOLD.15 inherits the gap, does not regress. **Action item:** file HARDEN.* task (or fold into DEBATE.7's ban-write rollout) to extend `createSessionGate` + every state-mutating handler with a `bannedAt IS NULL` gate returning `error_account_banned`. Carried in close-out, not in SCAFFOLD.15 PR.

- **SURPRISE-15 (LOW, pre-existing): `X-Forwarded-For` first-entry trust in `extractIp`.** Pattern lives in `src/server/auth/tos-accept.ts:50`, `src/server/auth/index.ts:100`, `src/server/auth/admin/login.ts:55`, and the new upload-sign route. Attacker can spoof leftmost entry to evade per-IP rate-limit. Pre-existing systemic, not introduced by SCAFFOLD.15; severity LOW because rate-limit is fail-OPEN. **Action item:** file HARDEN.* task to centralize at a `lib/extract-client-ip.ts` helper that prefers `X-Real-IP` with `X-Forwarded-For` rightmost fallback. Carried in close-out, not in SCAFFOLD.15 PR.

### Bookkeeping

- **db-migration-reviewer SURPRISE (informational): Appendix B.16 not amended** to enumerate `content_type` + `byte_size` rows. Plan §4 amendment list doesn't include B.16. Operational-only columns implicitly STRIP at the §19.4 column-list level; Hrishikesh decision whether to extend the amendment set to B.16 explicitly. Not a blocker.
- **db-migration-reviewer SURPRISE (informational): Migration 0006 uses unquoted identifiers** (bare `image_uploads`); prior migrations 0001-0005 use double-quoted (`"image_uploads"`). Functionally identical for lowercase names. Cosmetic only.
- **Brief §7 wording bug (informational):** the original web-Claude research brief framed SCAFFOLD.16 as adding the "moderation client" — but SCAFFOLD.15 already ships the baseline moderation client (`openai.ts` + `precommit.ts`); SCAFFOLD.16 ADDS PhotoDNA + Safer as parallel calls via `Promise.all` inside the existing `precommitModerate`. Carried for next brief revision. Not a code issue.

---

## Open questions

- Should Appendix B.16 be extended with `content_type` + `byte_size` per-column treatment rows? Default is STRIP per §19.4 implicit rule; explicit rows would be belt-and-suspenders. Hrishikesh decision.
- Should the unquoted-identifier convention in 0006 be normalized to match 0001-0005? Cosmetic; functionally identical for lowercase names. Probably defer to a future migration-convention sweep.
- Should the `bannedAt IS NULL` gate land before SCAFFOLD.15 ships, or as a HARDEN.* sweep that catches all handlers at once? Recommend HARDEN.* sweep — sprinkling per-handler checks risks drift; centralizing in `createSessionGate` (or a wrapper helper) is cleaner.

---

## Next session starts at

**Option A (recommended): ENGINE.6 (events helper).** SCAFFOLD.15 leaves 4 stub event-write sites with canonical event_type strings (`image_upload.sign_requested`, `image_upload.committed`, `image_upload.blocked`, `image_upload.orphaned`). ENGINE.6 lands `src/server/events/insert.ts` + `src/server/events/schemas.ts` and the SCAFFOLD.15 sites pick them up via the same pattern as SCAFFOLD.3's 6 auth-flow stub sites.

**Option B: DEBATE.2 (placeImageComment Server Action).** Consumes the SCAFFOLD.15 primitives (`signUploadAndInsert` already used by the route handler; `precommitModerate` consumed inside the W-2 commit transaction wrapper; `image_uploads` row terminal-state flip). DEBATE.2 also surfaces the comment-side bound at post-time (INV-3 construction-layer protection) — separate critical path.

**Option C: SCAFFOLD.16 (PhotoDNA + Safer parallel moderation).** Extends `precommitModerate` with two parallel vendor calls inside a `Promise.all`. Lower priority than ENGINE.6 / DEBATE.2 in the dependency graph (no other strata block on SCAFFOLD.16).

---

## Context to preserve

- **Operator substrate state** (verified at chat open 2026-05-24): R2 enabled on account `4ddce98b4a4cbc9146d4269f36b03f68`. Both buckets present in APAC. CORS on uploads: `["content-type"]` literal AllowedHeaders + `["https://zugzwangworld.com"]` AllowedOrigins + `["PUT"]` AllowedMethods + `["ETag"]` ExposeHeaders + 3600 MaxAge. Lifecycle on uploads: 90-day prefix `u/` delete (SURPRISE-7) + 7-day multipart abort. Bucket-scoped API tokens minted. Doppler `experiment/prd`: 10 SCAFFOLD.15 env vars + `CRON_SECRET` (32-byte hex) all set. Vercel Pro tier active. `R2_PUBLIC_URL_PFP` carries the R2 public dev URL on `zugzwang-pfp` per SURPRISE-8.

- **Live R2 probe** (`tests/server/storage/_probe-r2-roundtrip.test.ts`) is default-OFF. Operator runs `R2_PROBE_LIVE=true pnpm vitest run tests/server/storage/_probe-r2-roundtrip.test.ts` against the operator-managed substrate post-merge. Probe key prefix is `probe/` (NOT `u/`) so the 90-day lifecycle rule doesn't sweep probe artifacts; teardown deletes after assertion.

- **Vercel Cron contract is GET only** (SURPRISE-1 from plan-phase; spec-amended). Any future cron added to `vercel.json` `crons[]` must be a `GET` handler, NOT POST.

- **Idempotency-Key exempt on `POST /api/uploads/sign`** per SCAFFOLD.15 Q2 + SPEC.2 §11 amendment. Double-mint risk accepted; orphan-sweep cleans within ≤2h.

- **`ENGINE.6` event_type strings to consume:** `image_upload.sign_requested` (upload-sign route), `image_upload.committed` (DEBATE.2 W-2 commit path), `image_upload.blocked` (DEBATE.2 moderation-reject path), `image_upload.orphaned` (orphan-sweep). All four stubbed in code with canonical strings.

- **AVIF support across CSAM hash vendors is undocumented.** Flagged for SCAFFOLD.16 plan-mode (PhotoDNA + Safer). SCAFFOLD.15 accepts AVIF at the upload-sign boundary per Q5 whitelist.

- **Trigger function name `enforce_image_uploads_terminal_atomic` is preserved** across 0003 and 0006. The 0003 trigger declaration at line 195 re-binds automatically to the 0006-replaced function body. Same-commit SPEC.2 §6.3 amendment enumerates the extended immutable list.

- **Tracker update** is operator-side per user-memory `project_tracker_external.md` — CC notes the SCAFFOLD.15 close-out here; tracker HTML lives in web-Claude project knowledge.

---

## Time

~5 hours execute (test-writer call + schema + amendments + substrate + primitives + handlers + probes + verify + 3 reviewer calls + in-session absorptions + log). Plan-mode chat preceded.

---

*Closed against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft amended same-commit + ADRs 0003–0016 (cited but not re-litigated). Authority chain: CLAUDE.md §1–§8 + AGENTS.md §1–§11.*
