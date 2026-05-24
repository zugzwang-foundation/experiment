# SCAFFOLD.15 — R2 buckets + signed-URL endpoint + orphan-sweep + bucket policies

**Status:** Plan-mode draft, awaiting ExitPlanMode approval.
**Date:** 2026-05-24.
**Branch (target):** `feat/scaffold-15-r2-storage-substrate`.
**Stratum:** SCAFFOLD.15 (R2 substrate + F-COMMENT-3 server-side primitives).
**Input contract:** ratified plan-mode brief from web Claude chat, 2026-05-24 (LDs + Q1–Q9 + B1–B3, full text in `/loop` slash-command stdout that opened this chat). Two execute-time clarifications added below (Phase-3 re-asks Q1+Q2).
**Authority:** CLAUDE.md §1–§8 + AGENTS.md §1–§11 + SPEC.2 §3.1, §3.7, §6.3, §10, §11, §12.

---

## §1 Context

Cloudflare R2 is the only object-store substrate for the experiment-phase build (per SPEC.2 §0.1 ADR-0006 change-log entry + §12). SCAFFOLD.15 ships the operational substance §12.9 defers to it: PUT-URL TTL value, read-side TTL, object-key literal pattern, CORS, bucket-policy JSON, F-COMMENT-3 server-side primitives, baseline OpenAI omni-moderation client, orphan-sweep cron handler + Vercel Cron entry. Subsequent strata consume these primitives — DEBATE.2 wires the `placeImageComment` Server Action that calls `precommitModerate()` + the W-2 commit transition; SCAFFOLD.16 adds PhotoDNA/Safer to the moderation pipeline; SCAFFOLD.17 fills `zugzwang-pfp` from the asset-pipeline.

The thirteen-table `image_uploads` schema, enum, append-only trigger function, and trigger declarations already shipped via SCAFFOLD.2 stratum 3.C (`src/db/schema/image-uploads.ts:1-52`, `drizzle/migrations/0003_append_only_triggers.sql:132-196`, test at `tests/db/triggers/image-uploads-append-only.spec.ts`). SCAFFOLD.15 extends rather than creates: migration 0006 adds two operational-only columns (`content_type`, `byte_size`), drops one redundant index, adds one partial sweep index, and re-creates the trigger function via `CREATE OR REPLACE` to extend its immutable-column list. No `moderation_result` column is added — moderation provenance lives in `mod_actions.categories` keyed by `image_r2_key` (per `src/db/schema/audit.ts:42-43`).

The plan integrates with three already-shipped reuse-ready surfaces: the Better Auth session gate (`src/server/auth/session-gate.ts`), the Upstash rate-limit dispatcher (`src/server/middleware/rate-limit.ts` — `imagePutUrlPerIp` class already declared at lines 81-89; `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN=10` already declared at `src/server/config/limits.ts:32`), and the Upstash Redis singleton (`src/server/upstash/redis.ts`). The seven-step handler stack (AGENTS.md §7 / SPEC.2 §3.1) is the discipline both new route handlers conform to, with documented exemptions per §6 below.

---

## §2 Stratum Scope

### §2.1 In scope (Phase-2 execute deliverable)

- **Schema extension:** migration `0006_image_uploads_extension.sql` + updated `src/db/schema/image-uploads.ts`. Trigger function re-creation via `CREATE OR REPLACE` extends immutable-column list to include `content_type` + `byte_size`. Pre-migration safety assertion the table is empty in prd (pre-launch).
- **Storage primitives:** `src/server/storage/r2.ts`, `src/server/storage/sign-upload.ts`, `src/server/storage/sign-read.ts` per SPEC.2 §12.10 single-source-of-truth map.
- **Baseline moderation client:** `src/server/moderation/precommit.ts` + `src/server/moderation/openai.ts`. OpenAI omni-moderation-2024-09-26 only (PhotoDNA stays SCAFFOLD.16). Owns the 10-second `mod:reserve:` Redis reservation lifecycle per SPEC.2 §10.10.
- **Error registry bootstrap:** `src/lib/errors.ts` (new file). Discriminated `kind` union per AGENTS.md §4. SCAFFOLD.15 is the first surface that needs a registry of typed errors (`StorageUnavailableError`, `ModerationUnavailableError`, `ModerationInFlightError`, `ImageMimeRejectedError`, `ImageOversizeError`, `OrphanSweepLockContentionError`); subsequent strata extend the registry as needed.
- **Distributed lock helper:** `src/server/upstash/lock.ts` — `acquireLock(key, ttlSeconds)` + token-matched Lua-script `releaseLock`. Consumed by the cron handler; reusable by future cron jobs.
- **Route handlers:** `src/app/api/uploads/sign/route.ts` (POST) + `src/app/api/cron/r2-orphan-sweep/route.ts` (GET — per Vercel Cron contract, see §6.1 SURPRISE).
- **Vercel cron entry:** new `vercel.json` with single `crons[]` entry.
- **Constants extension:** `src/server/config/limits.ts` adds the MIME whitelist, byte cap, ext mapping, two TTLs, orphan-window minutes, lock TTL, and the five moderation constants per SPEC.2 §10.10.
- **Dependency additions:** `@aws-sdk/client-s3@3.1045.0`, `@aws-sdk/s3-request-presigner@3.1045.0` (literal patch pin per brief Q1), `openai` (latest patch — pin literal at execute).
- **Env additions:** `.env.example` lines for R2 + OpenAI + cron secret.
- **Script aliases:** `pnpm test:invariants` + `pnpm test:integration` in `package.json` scripts (drift fix; both referenced in CLAUDE.md §5.7 but missing).
- **Tests:** 1 update + 8 new test files (driver + guard + probe — see §5 Test Plan).
- **Same-commit spec amendments:** SPEC.2 §3.3, §4, §6.3, §6.6, §11, §12.3, §12.6, §12.9. See §4 below.

### §2.2 Out of scope (deferred to named strata)

| Surface | Owner | Why deferred |
|---|---|---|
| `src/server/comments/place.ts` (F-COMMENT-3 `placeImageComment` Server Action) | DEBATE.2 | Comment-write W-2 transaction owns `comments` insert + `image_uploads` commit transition; SCAFFOLD.15 ships only the primitives DEBATE.2 consumes |
| `src/app/api/admin/uploads/sign/route.ts` (admin moderation affordance per SPEC.2 §12.10 row 2) | ADMIN.* | Admin-surface structural separation per SPEC.2 §8.7 — separate task |
| `src/server/events/insert.ts` + `src/server/events/schemas.ts` | ENGINE.6 | Per `src/db/schema/events.ts:31` comment + SCAFFOLD.2-3C.md §394 + SCAFFOLD.3 Q7 precedent. All event writes are stubbed `// TODO(ENGINE.6)` with the event_type string enumerated — same posture as SCAFFOLD.3's six auth-flow event writes |
| `src/server/moderation/photodna.ts` + Safer integration | SCAFFOLD.16 | Multi-vendor pipeline; SCAFFOLD.15 wires `precommitModerate()` with single-vendor (OpenAI) call site — SCAFFOLD.16 adds parallel PhotoDNA call inside the same function |
| Sentry alarm wiring (currently stubbed via `console.error` with byte-stable tag strings) | SCAFFOLD.5 | Plan matches existing pattern at `src/server/middleware/rate-limit.ts:174-178` and `src/server/idempotency/cache.ts:74-79` |
| TypeScript `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` tsconfig flags | (new task) | SURPRISE found: `tsconfig.json` has only `strict: true`; these two are NOT included via `strict` per TS docs. Enabling risks cascade type errors across codebase (unknown blast radius). Filed as `docs/parked.md` candidate at close-out |
| Custom domain `cdn.zugzwangworld.com` bind on `zugzwang-pfp` | **DEFERRED to post-experiment (testnet phase)** | Originally GATING exit criterion §7.1.4. At operator-substrate clearance 2026-05-24, deferred per SURPRISE-8: `zugzwangworld.com` DNS hosted at Namecheap (not Cloudflare); partial-CNAME requires Cloudflare Business plan ($200+/mo, infeasible at experiment scale); full nameserver migration carries email continuity risk for `zugzwangworld@proton.me`. SCAFFOLD.15 uses R2 public dev URL on `zugzwang-pfp` instead. Architectural impact: no edge cache for PFP reads experiment-phase; R2 Class B costs ~$2 within free tier. Tracker entry queued for post-experiment scope. |
| H2 erasure semantics for `image_uploads.r2_object_key` | future HARDEN.* task | SURPRISE: SPEC.2 §12.5 line 1124 says H2 scrubs `r2_object_key` to NULL but the existing trigger at `0003_append_only_triggers.sql:155` rejects any change to `r2_object_key`. Pre-existing inconsistency; SCAFFOLD.15 preserves status quo and flags |
| `vercel.ts` migration | (post-Devcon) | AGENTS.md §1 locks `vercel.json`; SPEC.2 §12.10 names it; would need ADR + PRECURSOR task |

### §2.3 Ratified verdicts consumed verbatim from brief §1

LD-1 through LD-13 stand (LD-7 substrate substitution per SURPRISE-8 — R2 public dev URL replaces custom-domain bind for experiment phase; architectural shape unchanged). Q1 (S3 SDK + s3-request-presigner pinned `3.1045.0`), Q2 (PUT URL TTL 60s), Q3 (READ URL TTL 3600s render — but SCAFFOLD.15 doesn't ship the render-side caller, so this constant is documented in `limits.ts` for DEBATE.2 consumption rather than used in any SCAFFOLD.15 code path), Q4 (custom-domain on PFP only, `zugzwang-uploads` stays on default endpoint — superseded by SURPRISE-8: experiment-phase PFP uses R2 public dev URL; uploads still uses default endpoint unchanged), Q5 (MIME whitelist: jpeg/png/webp/gif/avif), Q6 (8 MB cap; post-PUT HeadObject enforcement), Q7 (orphan-sweep composite: R2 lifecycle **90d** + 7d-multipart-abort + Vercel Cron `0 */6 * * *` — 90d not 30d per SURPRISE-7: 30d would auto-delete committed images mid-experiment since the live window is 51 days plus archive headroom), Q9 (key shape `u/{user_id}/{image_uploads_id}.{ext}` — extended trigger keeps `r2_object_key` immutable in line with existing schema discipline; lowercase canonical ext mapping), B1 (Safer onboarding deadline 2026-08-15 — informational, operator-side), B2 (two bucket-scoped R2 API tokens), B3 (Vercel Pro tier required for `0 */6 * * *` cadence).

### §2.4 Execute-chat clarifications (Phase-3 re-asks)

- **Q1 (re-ask 2026-05-24):** schema delta narrowed to **content_type + byte_size only** (no `moderation_result` column). Moderation provenance via `mod_actions.categories` keyed by `image_r2_key`. Single source of truth; no duplication.
- **Q2 (re-ask 2026-05-24):** upload-sign endpoint **skips Idempotency-Key**. Double-mint risk accepted; orphan sweep cleans within 2h. Same-commit SPEC.2 §11 amendment adds upload-sign to the explicit "exempt" tier alongside comment/friendly-fire.

---

## §3 Schema Work

### §3.1 Migration `drizzle/migrations/0006_image_uploads_extension.sql`

Five DDL statements + one trigger re-creation. Statement breakpoint between each (`--> statement-breakpoint`) per existing convention at `0003_append_only_triggers.sql`.

```sql
-- 0006_image_uploads_extension.sql — SCAFFOLD.15
-- Extends image_uploads (Bucket B, ratified 3-B §12-R1) with two
-- operational columns + reshapes the orphan-sweep index.
--
-- Pre-launch safety: this migration assumes image_uploads is empty
-- in prd. If a future re-run encounters rows, the NOT NULL ADD fails
-- with a clean error; manual backfill is not in v1 scope.
--
-- Trigger function re-created via CREATE OR REPLACE per SPEC.2 §6.3 +
-- amendment landing in same commit. Immutable-column list extended;
-- the two existing whitelisted transitions (terminal_state +
-- terminal_at atomic XOR) and the one-shot semantics are unchanged.

ALTER TABLE image_uploads ADD COLUMN content_type text NOT NULL;
--> statement-breakpoint

ALTER TABLE image_uploads ADD COLUMN byte_size integer NOT NULL
  CHECK (byte_size > 0 AND byte_size <= 8388608);
--> statement-breakpoint

DROP INDEX IF EXISTS image_uploads_terminal_state_idx;
--> statement-breakpoint

CREATE INDEX image_uploads_orphan_sweep_idx
  ON image_uploads (created_at)
  WHERE terminal_state IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_image_uploads_terminal_atomic()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on terminal_state (unchanged from 0003)
  IF OLD.terminal_state IS NOT NULL AND NEW.terminal_state IS DISTINCT FROM OLD.terminal_state THEN
    RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)';
  END IF;
  -- One-shot on terminal_at (unchanged from 0003)
  IF OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at THEN
    RAISE EXCEPTION 'image_uploads: terminal_at is one-shot (immutable once set)';
  END IF;
  -- Atomic XOR on terminal_state + terminal_at (unchanged from 0003)
  IF (NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL) THEN
    RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together';
  END IF;
  -- Extended immutable list (content_type + byte_size added)
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
    OR NEW.content_type IS DISTINCT FROM OLD.content_type
    OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### §3.2 Drizzle schema file (`src/db/schema/image-uploads.ts`)

Two field additions + index list update. Final shape:

```ts
export const imageUploads = pgTable(
  "image_uploads",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: uuid("user_id").notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    r2ObjectKey: text("r2_object_key").notNull(),
    contentType: text("content_type").notNull(),     // NEW (SCAFFOLD.15)
    byteSize: integer("byte_size").notNull(),        // NEW (SCAFFOLD.15)
    terminalState: imageTerminalStateEnum("terminal_state"),
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull().defaultNow(),
  },
  (table) => [
    index("image_uploads_user_id_idx").on(table.userId),
    index("image_uploads_created_at_idx").on(table.createdAt),
    // image_uploads_terminal_state_idx dropped; partial sweep index
    // is added via raw SQL in 0006 (Drizzle .where() on indexes is
    // 0.45-supported via the `.where()` chain).
    index("image_uploads_orphan_sweep_idx")
      .on(table.createdAt)
      .where(sql`terminal_state IS NULL`),
  ],
);
```

The CHECK constraint on `byte_size` is enforced at the SQL layer (migration 0006); Drizzle's `pgTable` builder doesn't surface `CHECK` natively in 0.45, so the constraint is migration-only. `drizzle-zod`'s `createInsertSchema` auto-picks up the `.notNull()` + `integer()` declarations.

The Bucket-B classification statement comment (lines 14-16) is updated to enumerate the extended immutable list.

### §3.3 Trigger test update (`tests/db/triggers/image-uploads-append-only.spec.ts`)

Extend the existing 8 cases with:
- New case: `accepts terminal transition with content_type/byte_size unchanged` (driver — covers the happy path with the new columns persisted).
- New case: `rejects content_type mutation` (guard — UPDATE `content_type = 'image/png'` on a JPEG row → P0001).
- New case: `rejects byte_size mutation` (guard — UPDATE `byte_size = 1024` on a row with different size → P0001).
- New case: `rejects byte_size at INSERT > 8388608` (guard — CHECK constraint fires; SQLSTATE `23514`, not P0001 trigger).
- New case: `rejects byte_size at INSERT <= 0` (guard — same CHECK).
- Update `setupRow` to include `contentType: "image/jpeg"`, `byteSize: 102400`.

The existing 8 cases remain unchanged (they test trigger semantics that did not change).

---

## §4 Same-Commit SPEC.2 Amendments

Per CLAUDE.md §7 cleanup absorption rule + §5.10 "every same-commit spec amendment (grep verification)" — the following SPEC.2 edits land in the same commit as the migration + handler code. Each is small (one paragraph or one row).

1. **§3.3 line 269** — change `POST /api/cron/r2-orphan-sweep` to `GET /api/cron/r2-orphan-sweep`. Same line clarifies "Vercel Cron contract supports GET only; auth via `Authorization: Bearer ${CRON_SECRET}` header."
2. **§4.3 Route Handlers catalogue** — the cron entry's HTTP method column updates POST → GET. (Locate via grep `r2-orphan-sweep`.)
3. **§6.3 image_uploads block (lines 596-633)** — extend the per-table function code block + prose to reflect the extended immutable list (`content_type`, `byte_size` added). Existing two-column atomic transition semantics unchanged.
4. **§6.6 line 656** — bump test contract floor count to reflect the 5 new image_uploads cases (33+ → 38+).
5. **§11 ¶"Idempotency contract — header, key shape, storage" (line 1036)** — extend "Required on bet endpoints (`place`, `sell`); optional on comment / friendly-fire endpoints" to add a third clause: "exempt on file-storage PUT-URL mint (`POST /api/uploads/sign`) — orphan-sweep handles duplicate-mint cleanup within `ORPHAN_WINDOW_MINUTES` per §12.6."
6. **§12.3 ¶"Scoped per upload" (line 1106)** — append clarifying sentence: "R2 does not enforce `Content-Length-Range` at signing time per its S3-compat contract; the byte-size cap is enforced post-PUT via HeadObject + R2 native lifecycle rule (**90-day** prefix expire — bumped from 30d at execute per SURPRISE-7 to span experiment's 51-day live window + archive headroom) as backstop."
7. **§12.3 ¶"TTL" (line 1108)** — replace deferral with literal value: "60 seconds per SCAFFOLD.15 Q2 ratification — long enough for `pick file → review → submit` (~30s typical), short enough to bound exfiltrated-URL exposure."
8. **§12.6 line 1132** — change `POST /api/cron/r2-orphan-sweep` to `GET /api/cron/r2-orphan-sweep` (mirror of #1).
9. **§12.6 line 1134** — replace cadence deferral with literal value: "`0 */6 * * *` per SCAFFOLD.15 Q7 ratification (every 6 hours; Vercel Pro tier required)."
10. **§12.6 line 1135** — clarify scope of sweep: "Sweeps `terminal_state IS NULL` rows only. Bucket-B `'blocked'` rows are deleted from R2 by the **90-day** native lifecycle rule (Layer 1 — bumped from 30d at execute per SURPRISE-7); their DB rows stay in terminal `'blocked'` state for audit. The cron sweep is Layer 2 (early-orphan reconciliation)."
11. **§12.9 line 1172** — strike `(e.g., comments/{user_id}/{yyyy}/{mm}/{uuid}.{ext} or other)` from the "Object-key literal pattern" row. Replace with the locked literal: `u/{user_id}/{image_uploads_id}.{ext}` (where `ext ∈ {jpg, png, webp, gif, avif}` lowercase canonical per MIME).
12. **§12.10 line 1186** — leave `POST /api/admin/uploads/sign` reference as-is; flag in close-out log as ADMIN.* scope.
13. **§4.1 ¶"Routing taxonomy" (Route Handlers prose)** — add a new paragraph codifying the Origin allowlist as the cross-cutting middleware applied to **every** state-mutating Route Handler per ADR-0003 §D3 CSRF defense. Source of truth: `src/server/middleware/origin-allowlist.ts` (bootstrapped by SCAFFOLD.15; consumed by `/api/uploads/sign` first and by future bet/comment endpoints). Allowlist derived from `BETTER_AUTH_URL` env var with http→https variant for prd. Missing-Origin requests (server-to-server) are admitted; mismatched-Origin requests return HTTP 403 `error_origin_rejected`. The cron route handler is **exempt** (Vercel-internal caller; no Origin header). This codification closes the gap where the pattern would otherwise sneak in as undocumented middleware without an audit trail.

Grep-verifiable list at execute-time: `grep -n "POST /api/cron/r2-orphan-sweep\|comments/{user_id}/{yyyy}\|33+ cases minimum\|Required on bet endpoints" docs/specs/SPEC.2.md` should return zero hits after the amendment lands. `grep -n "origin-allowlist\|origin_rejected" docs/specs/SPEC.2.md` should return at least one §4.1 hit after #13 lands.

---

## §5 Implementation Inventory

File-by-file, with line-count estimates and pattern references.

### §5.1 Storage layer (`src/server/storage/`)

**`r2.ts` (~120 LOC).** Module-scoped `S3Client` for two buckets (`uploads`, `pfp`); HTTP keep-alive across warm Vercel invocations. Region `"auto"` (mandatory per S3 SDK; ignored by R2). `forcePathStyle: false` (virtual-hosted-style URLs). Functions exported:

- `mintPutUrl(bucket: "uploads" | "pfp", key: string, contentType: string, ttlSeconds: number): Promise<string>` — `getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: ttlSeconds })`.
- `mintReadUrl(bucket: "uploads" | "pfp", key: string, ttlSeconds: number): Promise<string>` — `getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: ttlSeconds })`.
- `headObject(bucket: "uploads" | "pfp", key: string): Promise<{ contentLength: number; contentType: string }>` — `HeadObjectCommand`; throws `StorageObjectMissingError` on 404, `StorageUnavailableError` on 5xx.
- `deleteObject(bucket: "uploads" | "pfp", key: string): Promise<void>` — `DeleteObjectCommand`; idempotent (204 even on non-existent).

Two `S3Client` instances cached at module load; one per bucket because the env vars (`R2_ACCESS_KEY_ID_*`, `R2_SECRET_ACCESS_KEY_*`, `R2_ENDPOINT_*`) are bucket-scoped per B2 ratification. Construction throws if any env var missing — same posture as `src/server/upstash/redis.ts:27`.

**`sign-upload.ts` (~80 LOC).** `signUploadAndInsert({ db, userId, contentType, byteSize }): Promise<{ uploadId, putUrl, key }>`. READ COMMITTED transaction (the Drizzle default; SERIALIZABLE reserved for W-1/W-2/W-3 per SPEC.2 §3.2). Steps:

1. Validate `contentType ∈ IMAGE_UPLOADS_ALLOWED_MIME` — throw `ImageMimeRejectedError` if not.
2. Validate `byteSize > 0 && byteSize <= IMAGE_UPLOADS_MAX_BYTES` — throw `ImageOversizeError` if not.
3. Generate `uploadId` via UUIDv7 (Drizzle column default fires on INSERT).
4. Derive `ext = IMAGE_UPLOADS_EXT_BY_MIME[contentType]`.
5. Compose `key = `u/${userId}/${uploadId}.${ext}``.
6. `INSERT INTO image_uploads (id, user_id, r2_object_key, content_type, byte_size)` returning `id`.
7. `mintPutUrl("uploads", key, contentType, PUT_URL_TTL_SECONDS)`.
8. `// TODO(ENGINE.6): insertEvent(tx, { eventType: "image_upload.sign_requested", ... })`.

Returns `{ uploadId, putUrl, key }` for client consumption.

**`sign-read.ts` (~30 LOC).** Thin wrapper around `mintReadUrl("uploads", key, ttlSeconds)`. Caller specifies TTL (60s for moderation, 3600s for future render). Exported for consumption by `precommit.ts` and (future) DEBATE.4 render path. SCAFFOLD.15 uses only the 60s code path.

### §5.2 Moderation layer (`src/server/moderation/`)

**`precommit.ts` (~150 LOC).** `precommitModerate({ text, imageR2Key?, idempotencyKey, userId, marketId }): Promise<{ outcome: 'pass' | 'track_a' | 'track_b', categories: string[] }>` per SPEC.2 §10.10 source-of-truth. Owns reservation lifecycle:

1. Compute reservation key: ``${RESERVATION_KEY_PREFIX}${userId}:${marketId}:${idempotencyKey}``.
2. `redis.set(reservationKey, "1", { nx: true, ex: RESERVATION_TTL_SECONDS })`. If returns null, throw `ModerationInFlightError` (caller maps to HTTP 409).
3. `try { ... } finally { redis.del(reservationKey) }`.
4. Inside try: if `imageR2Key`, mint 60s signed READ URL via `sign-read.ts`.
5. Call `openai.moderate({ text, imageUrl })`. (PhotoDNA call added by SCAFFOLD.16 in parallel via `Promise.all`.)
6. Map verdict: `result.categories['sexual/minors'] === true` → `track_a`; any other flagged category → `track_b`; none → `pass`. Track A is the legal-floor CSAM category per SPEC.1 §16.5.

Exports constants per SPEC.2 §10.10: `OPENAI_MODERATION_MODEL_SNAPSHOT = 'omni-moderation-2024-09-26'`, `OPENAI_TIMEOUT_MS = 3000`, `OPENAI_MAX_RETRIES = 1`, `RESERVATION_KEY_PREFIX = 'mod:reserve:'`, `RESERVATION_TTL_SECONDS = 10` — physically located in `src/server/config/limits.ts` per AGENTS.md §11 reuse-of-limits-module convention.

**`openai.ts` (~80 LOC).** Module-scoped `OpenAI` client (`new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`). Function:

- `moderate({ text, imageUrl? }): Promise<{ flagged: boolean, categories: Record<string, boolean>, scores: Record<string, number> }>` — `client.moderations.create({ model: OPENAI_MODERATION_MODEL_SNAPSHOT, input: [{ type: 'text', text }, ...(imageUrl ? [{ type: 'image_url', image_url: { url: imageUrl } }] : [])] })`.

3-second timeout (`AbortSignal.timeout`); 1 retry on transient (network error / timeout / 5xx / 429); fail-CLOSED throws `ModerationUnavailableError` on terminal failure. 4xx auth errors (401/403) throw without retry and emit `openai_moderation_auth_failure` stub Sentry tag (byte-stable per SPEC.2 §17.2 row 4 — SCAFFOLD.5 swaps for real Sentry).

### §5.3 Error registry (`src/lib/errors.ts`)

New file. Discriminated `kind` union per AGENTS.md §4. Initial population (SCAFFOLD.15 surfaces only — future strata extend):

```ts
export type DomainError =
  | { kind: "storage_unavailable"; cause: unknown }
  | { kind: "storage_object_missing"; key: string }
  | { kind: "moderation_unavailable"; cause: unknown }
  | { kind: "moderation_in_flight" }
  | { kind: "image_mime_rejected"; received: string; allowed: readonly string[] }
  | { kind: "image_oversize"; received: number; max: number }
  | { kind: "orphan_sweep_lock_contention" };

export class StorageUnavailableError extends Error { ... }
// ... one class per kind
```

Each class carries the discriminated `kind` as a public readonly property + a `toEnvelope()` method returning `{ error: string }` for HTTP response shaping. Error-code strings match `error_<kind>` convention from SPEC.2 §11 + §10 (e.g., `error_storage_unavailable`, `error_moderation_unavailable`).

### §5.4 Upstash lock helper (`src/server/upstash/lock.ts`)

New file (~60 LOC). Two functions:

- `acquireLock(key: string, ttlSeconds: number): Promise<{ token: string } | null>` — generates `token = crypto.randomUUID()`, runs `redis.set(key, token, { nx: true, ex: ttlSeconds })`. Returns `{ token }` if set, `null` if contention.
- `releaseLock(key: string, token: string): Promise<boolean>` — runs Lua via `redis.eval(...)`:
  ```lua
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
  ```
  Returns `true` if deleted (token matched), `false` otherwise. Prevents a stuck-lock-from-prior-run releasing the current run.

Both fail-CLOSED on Upstash unreachable (catch + throw). The caller decides posture; for orphan-sweep cron, fail-CLOSED means the sweep run aborts cleanly and the next 6-hour fire retries.

### §5.5 Constants extension (`src/server/config/limits.ts`)

Existing file has 7 constants (lines 14-32). SCAFFOLD.15 adds 12 more. The header comment is updated to enumerate the new constants.

```ts
// SCAFFOLD.15 additions (per SPEC.2 §10.10 + §12.9 ratification at SCAFFOLD.15)

export const PUT_URL_TTL_SECONDS = 60;
export const READ_URL_TTL_SECONDS_MODERATION = 60;
// READ_URL_TTL_SECONDS_RENDER (3600s render-side TTL per SCAFFOLD.15 Q3 ratification)
// is documented but NOT exported — SCAFFOLD.15 doesn't ship a render-side caller;
// DEBATE.4 adds the constant + caller together.

export const IMAGE_UPLOADS_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB
export const IMAGE_UPLOADS_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export const IMAGE_UPLOADS_EXT_BY_MIME: Readonly<Record<typeof IMAGE_UPLOADS_ALLOWED_MIME[number], string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const ORPHAN_WINDOW_MINUTES = 120;
export const ORPHAN_SWEEP_LOCK_TTL_SECONDS = 600;
export const ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD = 5;

export const OPENAI_MODERATION_MODEL_SNAPSHOT = "omni-moderation-2024-09-26";
export const OPENAI_TIMEOUT_MS = 3000;
export const OPENAI_MAX_RETRIES = 1;
export const RESERVATION_KEY_PREFIX = "mod:reserve:";
export const RESERVATION_TTL_SECONDS = 10;
```

### §5.6 Route handlers (`src/app/api/`)

**`uploads/sign/route.ts` (~120 LOC).** `POST` handler. Seven-step stack with one documented exemption (step 2+3+7 — see §2.4 above):

1. **Origin allowlist.** Per ADR-0003 §D3 carve-out (cited in SPEC.2 §4.1) — `request.headers.get('origin')` must match a `BETTER_AUTH_URL`-derived whitelist. Reuse pattern from existing bet-endpoint check (which lives at... actually, no bet endpoint exists yet — SCAFFOLD.15 introduces the Origin-check pattern via a new `src/server/middleware/origin-allowlist.ts` (~30 LOC) since the bet endpoints are future ENGINE scope but share this exact need).
2. **Auth gate.** `await auth.api.getSession({ headers })` → reject 401 if no session; reject 403 if `users.pseudonym` or `users.tos_accepted_at` NULL (mirror `createSessionGate` pattern from `src/server/auth/session-gate.ts:33-46`).
3. **Idempotency: EXEMPT** (per §2.4 Q2 + §4 amendment #5). Skip steps 2+3+7 of the seven-step stack. Spec-amended same commit.
4. **Rate-limit.** `await checkRateLimit("imagePutUrlPerIp", ipIdentifier(extractIp(request)))`. On `{ allowed: false }` return HTTP 429 `error_rate_limit_exceeded` with `Retry-After`.
5. **Body validate.** Zod: `{ contentType: z.enum(IMAGE_UPLOADS_ALLOWED_MIME), byteSize: z.number().int().positive().max(IMAGE_UPLOADS_MAX_BYTES) }`. Reject malformed with 400.
6. **Handler body.** Call `signUploadAndInsert({ db, userId: session.userId, contentType, byteSize })`. Catch domain errors → map to envelope per `errors.ts`.
7. **Events row: STUB** (per §2.2 ENGINE.6 deferral). `// TODO(ENGINE.6): insertEvent(tx, { eventType: "image_upload.sign_requested", payload: { uploadId, userId, contentType, byteSize, key }, metadata: { ... } })`.

Return `{ uploadId, putUrl, key }` JSON, HTTP 200.

**`cron/r2-orphan-sweep/route.ts` (~150 LOC).** `GET` handler (per Vercel Cron contract — see §6.1 SURPRISE; spec-amended same commit). Three-phase:

1. **Auth.** `request.headers.get('authorization') === `Bearer ${CRON_SECRET}`` → reject 401 if not. Constant-time compare via `crypto.timingSafeEqual` on UTF-8 bytes.
2. **Lock acquire.** `const lock = await acquireLock("cron-lock:r2-orphan-sweep", ORPHAN_SWEEP_LOCK_TTL_SECONDS)`. If `null` → return HTTP 200 with body `{ status: "locked", swept: 0 }` (200-not-error per brief §E so Vercel doesn't treat as failure).
3. **Sweep loop.** In `try { ... } finally { await releaseLock("cron-lock:r2-orphan-sweep", lock.token) }`:
   - Query candidates: `SELECT id, user_id, r2_object_key FROM image_uploads WHERE terminal_state IS NULL AND created_at < now() - interval '${ORPHAN_WINDOW_MINUTES} minutes' FOR UPDATE SKIP LOCKED LIMIT 100` (batch size 100; loop until empty batch).
   - Per row: `await deleteObject("uploads", row.r2ObjectKey)` then `UPDATE image_uploads SET terminal_state = 'orphan', terminal_at = now() WHERE id = $1`.
   - `// TODO(ENGINE.6): insertEvent(tx, { eventType: "image_upload.orphaned", payload: { uploadId, key }, metadata: { actorId: "system", ... } })`.
   - Catch per-row errors (e.g., R2 5xx, stale row): log + continue. Don't abort the whole sweep on one bad row.
   - Accumulate `swept` counter; return `{ status: "ok", swept: N }` JSON.
   - **Circuit breaker.** Track `consecutiveR2Failures` counter. Reset on any successful `deleteObject`. If counter reaches `ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD = 5`, abort the sweep cleanly and return `{ status: "r2_unavailable", swept: <partial count> }` HTTP 200 (not error — Vercel cron should not treat as failure; the next 6-hour fire retries). Prevents burn-down of Vercel function execution budget + Sentry noise on a universal R2 outage. Constant added to `src/server/config/limits.ts` per §5.5.

Rate-limit + Idempotency-Key: **EXEMPT** (caller is Vercel itself; per-IP RL on Vercel is pointless; cron has its own retry semantics via the at-least-once lock + idempotent ops). Documented in code comments referencing this plan §6.2 SURPRISE.

### §5.7 Origin allowlist helper (`src/server/middleware/origin-allowlist.ts`)

New file (~30 LOC). `checkOrigin(request: Request): boolean`. Reads `BETTER_AUTH_URL` env var; builds an allowlist `[BETTER_AUTH_URL, BETTER_AUTH_URL.replace('http://', 'https://')]` (handles localhost dev + prd). Returns `true` on match or missing Origin (server-to-server). Exported for reuse by future bet endpoints + admin handlers.

This helper is codified as a load-bearing primitive via same-commit SPEC.2 §4.1 amendment #13 (per §4 above) — the pattern is named in the architectural contract so future Route Handlers reach for it by reference rather than re-inventing.

### §5.8 Vercel cron entry (`vercel.json`)

New file. Single `crons` array entry per Vercel docs:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/r2-orphan-sweep",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### §5.9 `.env.example` additions

```
# Cloudflare R2 (SCAFFOLD.15)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID_UPLOADS=
R2_SECRET_ACCESS_KEY_UPLOADS=
R2_ENDPOINT_UPLOADS=
R2_ACCESS_KEY_ID_PFP=
R2_SECRET_ACCESS_KEY_PFP=
R2_ENDPOINT_PFP=
R2_PUBLIC_URL_PFP=

# OpenAI moderation (SCAFFOLD.15)
OPENAI_API_KEY=

# Vercel cron auth (SCAFFOLD.15)
CRON_SECRET=
```

### §5.10 Package.json changes

```jsonc
{
  "scripts": {
    // existing scripts unchanged...
    "test:invariants": "vitest run tests/invariants/",  // NEW (drift fix per CLAUDE.md §5.7)
    "test:integration": "vitest run tests/integration/" // NEW (drift fix)
  },
  "dependencies": {
    // existing deps unchanged...
    "@aws-sdk/client-s3": "3.1045.0",         // NEW (literal pin per brief Q1)
    "@aws-sdk/s3-request-presigner": "3.1045.0", // NEW
    "openai": "5.X.Y" // NEW — literal patch pin (NOT caret) matching AWS SDK pinning discipline; X.Y.Z resolved at execute via `pnpm add openai@<exact-patch>` then committed as literal in package.json
  }
}
```

### §5.11 Substrate provisioning (operator-side; gating per §7.1)

Out of code-work scope but blocks PR merge:
- R2 enabled on Cloudflare account (currently disabled per Phase-0 verification).
- Bucket creation: `zugzwang-uploads` (jurisdiction `apac` location hint) + `zugzwang-pfp` (same jurisdiction).
- CORS config on `zugzwang-uploads` — literal `["content-type"]` for `AllowedHeaders` (NOT wildcard — known R2 landmine per brief §8.4).
- Lifecycle rules on `zugzwang-uploads`: (1) `Object age ≥ 90 days, prefix u/` → DeleteObject (bumped from 30d per SURPRISE-7); (2) `Multipart upload age ≥ 7 days` → AbortIncompleteMultipartUpload.
- ~~Custom Domain `cdn.zugzwangworld.com` bound to `zugzwang-pfp`~~ — **DEFERRED to post-experiment per SURPRISE-8** (Namecheap DNS + Cloudflare Business cost / nameserver-migration email risk). Operator enabled R2 public dev URL on `zugzwang-pfp` instead; `R2_PUBLIC_URL_PFP` env var carries the public dev URL value in Doppler `prd`.
- R2 API tokens (two; bucket-scoped per B2).
- Doppler `prd` env vars (all 10 from §5.9).
- Vercel Pro tier active on production project (per B3 — Hobby tier blocks `0 */6 * * *` cadence).
- `CRON_SECRET` 32-byte random in Doppler `prd`.

---

## §6 Risk Register / SURPRISES Found in Plan Phase

### §6.1 SURPRISE-1 (MEDIUM): Vercel Cron HTTP method is GET, not POST

SPEC.2 §3.4 line 269 + §12.6 line 1132 specify `POST /api/cron/r2-orphan-sweep`. Vercel Cron's documented contract supports only GET (cron fires HTTP GET against the configured path; no method override in `vercel.json` `crons[]` schema). Plan defaults to GET handler + amends SPEC.2 §3.4, §4.3, §12.6 to GET same-commit (§4 amendments #1, #2, #8). Bearer auth via `Authorization: Bearer ${CRON_SECRET}` header — works for GET. Verify at execute by deploying a stub cron and inspecting the actual incoming request.

### §6.2 SURPRISE-2 (LOW): cron handler rate-limit + Idempotency-Key exemption is undocumented in SPEC.2

The seven-step handler stack (AGENTS.md §7 / SPEC.2 §3.1) is "every state-mutating endpoint." Cron handler is state-mutating but caller is Vercel itself; per-IP RL is pointless and Vercel-cron at-least-once is handled by the distributed lock + idempotent ops. Documented in code comments + referenced this plan §5.6; no SPEC.2 amendment needed (the spec implicitly exempts via §3.4 cron-engine-split prose).

### §6.3 SURPRISE-3 (MEDIUM): H2 erasure vs `r2_object_key` immutability inconsistency (pre-existing)

SPEC.2 §12.5 line 1124 says H2 erasure "scrubs `r2_object_key` to NULL and PII columns" but the existing trigger at `drizzle/migrations/0003_append_only_triggers.sql:155` rejects any change to `r2_object_key`. SCAFFOLD.15 preserves status quo (extends immutable list without touching the existing entries). H2 erasure mechanism for image_uploads requires re-derivation of the trigger semantics + an ADR. Filed for future HARDEN.* task; tracker entry at close-out.

### §6.4 SURPRISE-4 (LOW): `src/server/events/insert.ts` is ENGINE.6 deliverable, not SCAFFOLD.15

Caught by Plan agent at Phase 2. SCAFFOLD.3 stubbed all event writes with `// TODO(ENGINE.6)` markers (precedent at session close-out per SCAFFOLD.3 Q7). SCAFFOLD.15 follows the same posture: enumerate the four new event_type strings (`image_upload.sign_requested`, `image_upload.committed`, `image_upload.blocked`, `image_upload.orphaned`) as input to ENGINE.6 in this plan + in code comments at each stub site; do NOT bootstrap `insert.ts` or `schemas.ts`.

### §6.5 SURPRISE-5 (LOW): TypeScript tsconfig flags missing

`tsconfig.json` declares only `strict: true`. Per TS docs, `strict: true` does NOT include `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes` (these are separate flags). AGENTS.md §1 names all three as locked `true`. Enabling them risks cascade type errors across the codebase (unknown blast radius). Not absorbed in SCAFFOLD.15 — filed as `docs/parked.md` candidate at close-out for separate task.

### §6.6 SURPRISE-6 (LOW): ADR 0003–0016 are accepted decisions, file backfill is queued maintenance

CLAUDE.md + AGENTS.md + SPEC.2 reference ADR-0003 through ADR-0016 by number, but only `docs/adr/0001-license-choice.md` exists as a file. **These are accepted decisions** — their substance + ratification + acceptance dates are tracked as SPEC.2 §0.1 change-log entries (verified at Phase 1). Backfilling them into separate `docs/adr/<NNNN>-<slug>.md` files is queued maintenance per `docs/maintenance.md`, not an open question. Per CLAUDE.md §5.12 "One ADR per architectural change at `docs/adr/<NNNN>-<slug>.md` in the same commit" — SCAFFOLD.15's net-new vendor additions (`@aws-sdk/*`, `openai`) cite the accepted ADR-0006 §4 (R2 vendor + jurisdiction + bucket inventory) + ADR-0014 (multimodal moderation HTTP call shape) + ADR-0015 (image-PUT rate-limit class) substance via their SPEC.2 §0.1 entries. No new ADR file authored for SCAFFOLD.15 because the architectural decisions are already accepted upstream; SCAFFOLD.15 implements rather than decides.

---

## §7 Exit Criteria

Numbered with explicit GATING markers for operator-side substrate (per SCAFFOLD.3-FOLLOWUP-1 lesson 3.4).

### §7.1 Substrate-level (GATING; operator clears BEFORE merge)

1. **[GATING-substrate]** R2 enabled on Cloudflare account.
2. **[GATING-substrate]** `zugzwang-uploads` bucket provisioned with CORS (`AllowedHeaders: ["content-type"]` literal) + two lifecycle rules per §5.11.
3. **[GATING-substrate]** `zugzwang-pfp` bucket provisioned (empty; SCAFFOLD.17 fills).
4. **~~[GATING-substrate]~~** ~~Custom Domain `cdn.zugzwangworld.com` bound to `zugzwang-pfp` with TLS ≥1.2 + edge cache verified~~ — **DEFERRED to post-experiment per SURPRISE-8.** Substrate-substitution: R2 public dev URL enabled on `zugzwang-pfp`; `R2_PUBLIC_URL_PFP` carries that URL in Doppler `prd`. PFP reads bypass edge cache experiment-phase. Tracker entry "post-experiment: bind cdn.zugzwangworld.com to zugzwang-pfp + DNS migration" queued for testnet-phase scope.
5. **[GATING-substrate]** Two R2 API tokens (bucket-scoped per B2) created; secrets in Doppler `prd`.
6. **[GATING-substrate]** All 10 env vars from §5.9 in Doppler `prd`.
7. **[GATING-substrate]** `CRON_SECRET` (32-byte random) in Doppler `prd`.
8. **[GATING-substrate]** Vercel Pro tier confirmed on production project.

### §7.2 Code-level

9. Migration `0006_image_uploads_extension.sql` applied locally + verified via `pnpm drizzle-kit push` (dev) + integration test pass.
10. Schema file `src/db/schema/image-uploads.ts` updated with `contentType` + `byteSize` + index list.
11. Trigger test `tests/db/triggers/image-uploads-append-only.spec.ts` extended with 5 new cases (per §3.3).
12. `src/server/storage/r2.ts`, `sign-upload.ts`, `sign-read.ts` implemented per §5.1.
13. `src/server/moderation/precommit.ts`, `openai.ts` implemented per §5.2.
14. `src/lib/errors.ts` bootstrapped per §5.3.
15. `src/server/upstash/lock.ts` implemented per §5.4.
16. `src/server/config/limits.ts` extended per §5.5.
17. `src/server/middleware/origin-allowlist.ts` implemented per §5.7.
18. `POST /api/uploads/sign` route handler implemented per §5.6.
19. `GET /api/cron/r2-orphan-sweep` route handler implemented per §5.6.
20. `vercel.json` created per §5.8.
21. `.env.example` updated per §5.9.
22. `package.json` updated (scripts + deps) per §5.10.
23. Same-commit SPEC.2 amendments landed per §4 (all 12 items; grep-verified at audit).

### §7.3 Functional verification

24. `just verify` passes (typecheck + Biome + build).
25. `pnpm test:invariants` passes (existing 1 file unchanged).
26. `pnpm test:integration` passes (6 new integration test files + updated trigger test).
27. All driver tests pass (§5 enumerated).
28. All guard tests pass (§5 enumerated).
29. All probe tests pass (live R2 probe + AWS SDK shape probe + OpenAI shape probe; live probes `describe.skipIf`-gated on env presence).
30. Operator-side functional probes pass per §8 below.

### §7.4 Reviewer-call + audit (per CLAUDE.md §5.10 + §5.11)

31. Pre-PR self-audit complete (PASS/FAIL/SURPRISE format; walks schema/handler/migration/spec-amendment inventory).
32. `db-migration-reviewer` fresh-context call complete (Read-only; `.claude/agents/db-migration-reviewer.md` briefing; plan path `@docs/plans/SCAFFOLD.15.md`).
33. `code-reviewer` fresh-context call complete on `src/server/` + `src/app/api/` (Read-only).
34. `security-auditor` fresh-context call complete after code-reviewer (Read-only); auth, moderation pipeline, cron auth, orphan sweep, fail-CLOSED moderation, distributed lock correctness all in scope.
35. FAIL findings within scope fixed in-session; SURPRISE findings outside scope written to `claude-progress.md` and surfaced.

### §7.5 Documentation

36. `docs/logs/SCAFFOLD.15.md` close-out log committed (per CLAUDE.md §5.9 — six-field shape). Includes the "Surprises caught + fixed in-session" subsection per user-memory `feedback_audit_surprises.md`.
37. Tracker `zugzwang_experiment_tracker_v*.html` updated (status: `done`) — operator-side per user-memory `project_tracker_external.md` (CC notes update in close-out log).
38. Brief §7 wording bug (re: SCAFFOLD.16 moderation client implementation scope) flagged in close-out log for next brief revision.

---

## §8 Verification Mechanics (Operator Probes — Execute-Time)

Operator runs against prd substrate before PR merge. CC drafts exact probe commands at execute-time; this section names the probe classes.

### §8.1 Substrate-existence probes

- `wrangler r2 bucket list` → verify both buckets present, `apac` jurisdiction.
- `wrangler r2 bucket cors get zugzwang-uploads` → verify literal `["content-type"]` AllowedHeaders.
- `wrangler r2 bucket lifecycle get zugzwang-uploads` → verify both rules present.
- Vercel dashboard → Plan settings → verify "Pro" tier active on production project.
- `doppler secrets get -p experiment -c prd <var>` for each of the 10 env vars from §5.9 → verify non-empty (per user-memory `feedback_vercel_env_writeonly.md`: cannot verify values, only presence + downstream behaviour).

### §8.2 Functional probes (operator CLI, not via app)

- Signed-PUT roundtrip: `aws s3 cp test.jpg s3://zugzwang-uploads/test-key --endpoint-url <R2_ENDPOINT_UPLOADS> --content-type image/jpeg` using R2_TOKEN_UPLOADS credentials → expect 200.
- HeadObject roundtrip: `aws s3api head-object --bucket zugzwang-uploads --key test-key --endpoint-url <R2_ENDPOINT_UPLOADS>` → expect contentType + contentLength returned.
- DeleteObject idempotency: `aws s3api delete-object --bucket zugzwang-uploads --key test-key --endpoint-url <R2_ENDPOINT_UPLOADS>` twice → both return 204.
- CORS preflight: `curl -X OPTIONS -H "Origin: https://zugzwangworld.com" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: content-type" https://<account_id>.r2.cloudflarestorage.com/zugzwang-uploads/test-key` → expect 200 with appropriate Access-Control-Allow-* headers.
- ~~Custom-domain CDN: `curl -I https://cdn.zugzwangworld.com/...`~~ — **N/A per SURPRISE-8** (custom domain deferred). Probe substituted: `curl -I https://pub-<account-hash>.r2.dev/v1/test-pfp.webp` (R2 public dev URL on `zugzwang-pfp`) → expect 200; cache-status header is absent (no edge cache on dev URL — direct R2 origin hit). Cache verification deferred to post-experiment custom-domain bind.
- ~~TLS minimum~~ — N/A under R2 public dev URL substrate (Cloudflare-managed TLS at platform level; SURPRISE-8 substitution).

### §8.3 App-level probes (against deployed Vercel preview)

- POST `/api/uploads/sign` with no session → expect 401.
- POST `/api/uploads/sign` with session, malformed body → expect 400 with `error_image_mime_rejected` or `error_image_oversize`.
- POST `/api/uploads/sign` rapid-fire 11 calls from same IP → expect 11th returns 429 with Retry-After.
- POST `/api/uploads/sign` happy path → expect `{ uploadId, putUrl, key }` JSON.
- PUT to mismatched Content-Type at signed URL → expect R2 SignatureDoesNotMatch.
- GET `/api/cron/r2-orphan-sweep` without bearer → expect 401.
- GET `/api/cron/r2-orphan-sweep` with bearer (manual trigger) → expect `{ status: "ok", swept: N }`.
- Manual setup: INSERT image_uploads row + R2 object → wait 2h or manually trigger sweep → verify row terminal_state='orphan', R2 object deleted.

---

## §9 Critical Files Reference

### §9.1 Files to create

- `drizzle/migrations/0006_image_uploads_extension.sql`
- `src/server/storage/r2.ts`
- `src/server/storage/sign-upload.ts`
- `src/server/storage/sign-read.ts`
- `src/server/moderation/precommit.ts`
- `src/server/moderation/openai.ts`
- `src/server/upstash/lock.ts`
- `src/server/middleware/origin-allowlist.ts`
- `src/lib/errors.ts`
- `src/app/api/uploads/sign/route.ts`
- `src/app/api/cron/r2-orphan-sweep/route.ts`
- `vercel.json`
- `tests/integration/sign-upload.integration.test.ts`
- `tests/integration/sign-read.integration.test.ts`
- `tests/integration/precommit-moderate.integration.test.ts`
- `tests/integration/orphan-sweep.integration.test.ts`
- `tests/integration/upstash-lock.integration.test.ts`
- `tests/server/storage/_probe-aws-sdk-presigned-put.test.ts`
- `tests/server/storage/_probe-r2-roundtrip.test.ts` (live R2; `describe.skipIf(!process.env.R2_ENDPOINT_UPLOADS)`)
- `tests/server/moderation/_probe-openai-omni-shape.test.ts`

### §9.2 Files to modify

- `src/db/schema/image-uploads.ts` (add `contentType` + `byteSize`; update index list)
- `src/server/config/limits.ts` (12 new constants per §5.5)
- `.env.example` (10 new lines per §5.9)
- `package.json` (3 deps + 2 scripts)
- `tests/db/triggers/image-uploads-append-only.spec.ts` (extend with 5 new cases)
- `docs/specs/SPEC.2.md` (12 amendments per §4)

### §9.3 Files to reuse without modification

- `src/server/upstash/redis.ts` (singleton Redis client)
- `src/server/middleware/rate-limit.ts` (`imagePutUrlPerIp` instance + `checkRateLimit` + `ipIdentifier` already declared)
- `src/server/auth/session-gate.ts` (session-resolution pattern)
- `src/server/auth/index.ts` (Better Auth instance)
- `src/server/idempotency/cache.ts` (pattern reference; not consumed by SCAFFOLD.15 surfaces)
- `tests/db/_fixtures/db.ts` (testClient + testDb)
- `tests/_setup/env.ts` (env defaults for tests)

---

## §10 Phase-2 Execution Order

Suggested ordering inside the execute chat. CC adjusts as needed; tests-first per CLAUDE.md §5.6 for new business-logic surfaces.

1. **Test-writer reviewer call (Phase 2 start):** writes FAILING tests for `signUploadAndInsert`, `precommitModerate` verdict mapping, orphan-sweep loop, distributed lock semantics. Tool scope: Read + Write tests only. Plan path: `@docs/plans/SCAFFOLD.15.md`. Per CLAUDE.md §5.11 + §6 test-writer briefing.
2. **Schema work (write code):** migration 0006 + schema TS + trigger test extension. Verify locally via `pnpm drizzle-kit push` + `pnpm vitest run tests/db/triggers/image-uploads-append-only.spec.ts`.
3. **Same-commit SPEC.2 amendments:** all 12 per §4. Grep verify post-edit.
4. **Constants + env + deps:** `src/server/config/limits.ts`, `.env.example`, `package.json` (`pnpm add ...`).
5. **Substrate-layer code:** `errors.ts`, `r2.ts`, `lock.ts`, `origin-allowlist.ts`.
6. **Storage + moderation primitives:** `sign-upload.ts`, `sign-read.ts`, `openai.ts`, `precommit.ts`. Verify failing tests now pass.
7. **Route handlers:** `uploads/sign/route.ts`, `cron/r2-orphan-sweep/route.ts`. `vercel.json`.
8. **Probe tests:** AWS SDK shape, OpenAI shape, live R2 roundtrip (env-gated).
9. **`just verify`** — runs typecheck + Biome + build.
10. **Pre-PR self-audit** per CLAUDE.md §5.10 (PASS/FAIL/SURPRISE walking §7 exit criteria).
11. **Reviewer-call sequence:** `db-migration-reviewer` → `code-reviewer` → `security-auditor`. Each fresh-context `general-purpose` Agent with role briefing + plan path + tool scope per CLAUDE.md §5.11.
12. **Fix FAIL findings in-session; surface SURPRISE findings to operator.**
13. **Session log** at `docs/logs/SCAFFOLD.15.md` per CLAUDE.md §5.9 (ships in its own commit BEFORE `gh pr create`).
14. **Operator clears [GATING-substrate]** items §7.1.1–8 (if not already cleared in parallel).
15. **`gh pr create`** with conventional-commits title `feat(scaffold-15): R2 storage substrate + signed-URL endpoint + orphan-sweep`.
16. **CI passes, operator probes pass, PR merges.**

---

## §11 Carry-Forward Notes for Execute Chat

1. **SURPRISE-arrest discipline** (SCAFFOLD.3-FOLLOWUP-1 lesson 3.1): any finding at execute-time that's load-bearing → STOP and surface. Don't paper over.
2. **Vendor SDK shape verified empirically** (lesson 3.4): at execute, verify `@aws-sdk/s3-request-presigner` `getSignedUrl` call shape against `node_modules/@aws-sdk/s3-request-presigner/dist-types/`. R2 CORS literal-headers requirement is a known landmine — verify via probe (§8.1).
3. **R2 lifecycle is 24-hour-fuzzy.** Don't write tests that assert lifecycle-driven deletion within a tight window. Vercel Cron is the precision layer; R2 lifecycle is the safety net.
4. **Vercel cron at-least-once + may-fire-twice-concurrently.** Idempotency + lock non-negotiable; token-matched Lua release.
5. **AVIF support across CSAM hash vendors is undocumented.** Out of scope for SCAFFOLD.15; flagged in close-out log for SCAFFOLD.16 plan-mode.
6. **Cost is not a constraint at experiment scale (~$2 total).** Prioritise correctness.
7. **Stub event writes carry the canonical event_type string.** `image_upload.sign_requested`, `image_upload.committed`, `image_upload.blocked`, `image_upload.orphaned`. ENGINE.6 picks these up verbatim.

---

## §12 Plan Provenance

- **Drafted:** Claude Code SCAFFOLD.15 plan-mode chat, 2026-05-24.
- **Input contract:** ratified web-Claude brief from same date (LDs 1–13 verified Phase 0; Q1–Q9 + B1–B3 verdicts ratified; Q2 wording-bug flagged for next brief revision).
- **Phase 1 verification:** 3 parallel Explore agents (schema + server stack + tooling); confirmed `image_uploads` schema/trigger/test already shipped; identified reuse-ready infrastructure (`imagePutUrlPerIp`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`, Better Auth session gate, Upstash Redis); flagged 6 SURPRISES (§6).
- **Phase 2 design:** 1 Plan agent critique; caught events-helper scope violation (forced stub-per-SCAFFOLD.3 posture) + cron-method spec drift (POST → GET amendment) + moderation_result duplication risk (Q1 re-ask).
- **Phase 3 user re-asks (2026-05-24):** Q1 narrowed to (c) content_type + byte_size only; Q2 confirmed Idempotency-Key skip on upload-sign.
- **Next consumer:** Claude Code SCAFFOLD.15 execute chat. CC writes failing tests first (test-writer), then implements per §10 execution order, then runs reviewer-call sequence + pre-PR self-audit, then opens PR.
