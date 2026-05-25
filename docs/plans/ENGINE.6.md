# ENGINE.6 — Events helper + per-event-type Zod schemas + bulk TODO migration

> Stratum plan per CLAUDE.md §5.1. Lands `src/server/events/insert.ts` +
> `src/server/events/schemas.ts`, fills the 7 accumulated `TODO(ENGINE.6)`
> stub sites across image-upload and auth domains, and absorbs the SCAFFOLD.15
> `signUploadAndInsert` refactor required by CLAUDE.md §3 (no HTTP-in-tx).
>
> Plan-mode chat closes after this plan ratifies; execute chat is the next.

- **Task:** ENGINE.6
- **Plan-mode opened:** 2026-05-24
- **Branch:** `plan/engine-6` → `feat/engine-6-events-helper` (execute)
- **Authority chain:** CLAUDE.md §1–§8 + AGENTS.md §1–§11 + SPEC.2 §3.7 + §7.1–§7.7 + §8.8 + §17 + ADR-0005/0007/0008/0015/0016 (per memory `project_adr_catalogue_framing` — substance in SPEC.2 §0.1 change-log)
- **Critical path:** YES (touches `src/server/auth/` per CLAUDE.md §1)

---

## Context

ADR-0005 + SPEC.2 §3.7 + §7.7 require every state-mutating data flow to emit at least one `events` row inside its originating transaction. The events table substrate (Drizzle schema + DDL + composite-PK partitioning + `uuidv7()` SQL function) was landed at SCAFFOLD.2 stratum 3.C. Subsequent strata (SCAFFOLD.3 + SCAFFOLD.3-FOLLOWUP-1 + SCAFFOLD.13 + SCAFFOLD.15) accumulated 7 `TODO(ENGINE.6)` stub sites awaiting the helper. ENGINE.6 ships the helper + per-event-type Zod schemas + migrates all 7 stubs, completing the events-emission contract across the auth + image-upload surfaces.

Three load-bearing complications surface against repo ground truth that the brief did not pre-decide:

1. **Universal no-tx-context at stubs.** None of the 7 current TODO sites are inside a `db.transaction(async tx => {...})` block. Each requires per-site refactoring (move into existing tx / wrap in new tx / V3 carve-out / per-row micro-tx for cron).
2. **SCAFFOLD.15 `signUploadAndInsert` design bug.** The helper currently does INSERT + `mintPutUrl(HTTP)` + (TODO emission), which would force HTTP-inside-tx if emission is added. ENGINE.6 absorbs the refactor to separate INSERT-in-tx from `mintPutUrl` HTTP call.
3. **Sweep-orphans cannot use the standard contract as written.** Cron path is intentionally non-transactional per CLAUDE.md §3 (R2 HTTP hop). Resolution: per-row micro-tx wrapping UPDATE-CAS + insertEvent, with `deleteObject` outside the tx (preserves SCAFFOLD.15 security-auditor MEDIUM #1 UPDATE-then-delete ordering).

---

## Verdicts

### Q1 — Helper signature (locked at SPEC.2 §7.7)

**Option A**: single generic function with discriminated payload via `satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>` map.

```ts
async function insertEvent<T extends EventType>(
  tx: DbTransaction,
  input: EventInsertInput<T>,
): Promise<void>
```

Rationale grounded in repo state:
- SPEC.2 §7.7 already locks the shape (`tx`, payload Zod-validated, `sql\`...\`` template with composite-PK ON CONFLICT, caller-supplied event_id).
- 11 event_types is well within Option A's discriminated-union ergonomics (Option B's autocomplete advantage is dwarfed by the per-call-site test surface its export bloat implies).
- New event_types touch one file (`schemas.ts`).
- TypeScript `^5` confirmed; `satisfies` (TS 4.9+) compiles.

### Q2 — Error handling on INSERT failure (research brief §7 table is complete surface)

| Failure | Helper behavior | Caller sees |
|---|---|---|
| Zod payload validation fails | Throw `InvalidEventPayloadError` synchronously, no DB I/O | `error_internal` envelope (programming error) |
| `event_id` not UUIDv7 (13th hex char ≠ `7`) | Throw `InvalidEventIdError` synchronously, no DB I/O | `error_internal` envelope |
| ON CONFLICT suppression (duplicate `event_id`) | Return void successfully | Indistinguishable from first INSERT (correct per LD-8) |
| Postgres connection failure | Propagate; helper does NOT catch | Transaction-level failure surfaces to caller |
| SERIALIZABLE 40001 conflict | Propagate; helper does NOT catch | Caller retries whole tx per ADR-0013 |
| DEFAULT partition write | Return void successfully | Sentry alarm 2 fires from partition-level rule (SCAFFOLD.5 wiring) |

Helper is thin pass-through except for the two synchronous validations. No retry logic (ON CONFLICT IS the retry primitive). No catch around Postgres errors (transaction-level concerns are caller's). No DEFAULT-partition special-case (alarm 2 IS the surface).

### Q3 — Per-domain organization inside `schemas.ts`

**Single-file.** 11 entries at ENGINE.6 ship; DEBATE.2 (+0 — schemas already registered here) and future Better Auth-hook strata (+0 — same reason) hold count at 11 through the experiment. ≥20 split threshold remains a future decision.

### Q4 — Migration ordering of TODO sites within PR

**Per-domain commits** for git-blame ergonomics + per-site rollback option. Sequence in §"Per-domain commit sequence" below.

### Boundary verdicts (locked at brief §1, retained for audit)

- B1 (event QUERY helpers): **NO** — ADR-0005 file map names only `insert.ts` + `schemas.ts`. Defer to first read-side consumer.
- B2 (replay mechanism): **NO** — testnet-phase concern.
- B3 (new observability sinks): **NO** — ADR-0007 + SPEC.2 §17 own sinks.

---

## Canonical `event_type` inventory (LD-1)

**11 strings** total (struck `image_upload.r2_delete_failed` per execute-chat ratification — SCAFFOLD.5 Sentry surface owns R2-delete-failure observability):

| event_type | aggregate_type | Stub site? | Emit in ENGINE.6? |
|---|---|---|---|
| `image_upload.sign_requested` | `image_upload` | `sign-upload.ts:80` (route stub deleted post-refactor) | ✅ |
| `image_upload.committed` | `image_upload` | (future DEBATE.2 W-2 commit path) | schema only |
| `image_upload.blocked` | `image_upload` | (future DEBATE.2 moderation-reject path) | schema only |
| `image_upload.orphaned` | `image_upload` | `sweep-orphans.ts:127` | ✅ (per-row micro-tx) |
| `user.oauth_signed_in` | `user` | (future Better Auth hook stratum) | schema only |
| `user.otp_signed_in` | `user` | (future Better Auth hook stratum) | schema only |
| `user.pseudonym_assigned` | `user` | (future emit in `consume.ts`) | schema only |
| `user.tos_accepted` | `user` | `tos-accept.ts:128` | ✅ |
| `user.signed_out` | `user` | `logout.ts:20` | ✅ (V3 carve-out) |
| `admin.signed_in` | `admin_session` | `admin/login.ts:180` | ✅ |
| `admin.signed_out` | `admin_session` | `admin/logout.ts:30` | ✅ |

**6 emit sites** in ENGINE.6; **5 schema-only registrations** (per Option α — future strata add emit sites via same-commit `schemas.ts` amendments to grow the enum, no `schemas.ts` edits needed at emit-time).

---

## §A — Per-event-type Zod schemas (`src/server/events/schemas.ts`, NEW)

~140 LOC. Exports:

- `EVENT_TYPES` — `readonly const` array of the 11 strings, alpha-sorted within domain.
- `EventType` — `(typeof EVENT_TYPES)[number]` literal union.
- `eventPayloadSchemas` — `Record<EventType, z.ZodObject<z.ZodRawShape>>` via `satisfies`. One `z.object({...})` per event_type.
- `eventMetadataSchema` — `z.object({ request_id, flow_id, user_id, actor_id, idempotency_key, ip, user_agent })` per SPEC.2 §3.7. snake_case field names (matches JSONB stored shape).

Payload schemas authored from stub-site TODO bodies + SPEC.2 §8.8 + the surrounding code's payload context:

- `image_upload.sign_requested` ← `sign-upload.ts:81-84`: `{ uploadId, userId, contentType, byteSize, key }` — all required, UUID strings, MIME string, positive int.
- `image_upload.orphaned` ← `sweep-orphans.ts:128-131`: `{ uploadId, key }` — UUID + R2 object key string.
- `image_upload.committed` (schema only): `{ uploadId, userId, commentId, key }` — anticipated DEBATE.2 W-2 payload; revisited at DEBATE.2 plan-mode.
- `image_upload.blocked` (schema only): `{ uploadId, userId, modVerdict, reasonCategory }` — anticipated DEBATE.2 moderation-reject payload.
- `user.oauth_signed_in` (schema only): `{ userId, provider: z.literal('google'), googleId }`.
- `user.otp_signed_in` (schema only): `{ userId, email }`.
- `user.pseudonym_assigned` (schema only): `{ userId, pseudonym, pfpFilename }`.
- `user.tos_accepted` ← `tos-accept.ts:128`: `{ userId, tosVersionHash, privacyVersionHash, ip, userAgent }`.
- `user.signed_out` ← `logout.ts:20`: `{ userId }`.
- `admin.signed_in` ← `admin/login.ts:180`: `{ sessionId, ip }`.
- `admin.signed_out` ← `admin/logout.ts:30`: `{ sessionId }`.

File-level docstring documents the event_type addition contract per §G.

---

## §B — Helper (`src/server/events/insert.ts`, NEW)

~75 LOC. `import 'server-only'` at top per ADR-0008 §1.

Imports: `sql` from drizzle-orm, `DbTransaction` type from `@/db`, `events` table from `@/db/schema`, `InvalidEventIdError` + `InvalidEventPayloadError` from `@/lib/errors`, schemas from `@/server/events/schemas`.

```ts
function uuidv7ToCreatedAt(eventId: string): Date {
  if (eventId[14] !== '7') throw new InvalidEventIdError(eventId);
  const hex = eventId.replace(/-/g, '').slice(0, 12);
  return new Date(parseInt(hex, 16));
}

export interface EventInsertInput<T extends EventType> {
  eventId: string;                                          // UUIDv7, caller-supplied
  eventType: T;
  aggregateType: string;
  aggregateId: string;
  payload: z.infer<typeof eventPayloadSchemas[T]>;
  metadata: z.infer<typeof eventMetadataSchema>;
  payloadVersion?: number;                                  // defaults to 1
}

export async function insertEvent<T extends EventType>(
  tx: DbTransaction,
  input: EventInsertInput<T>,
): Promise<void> {
  const payloadResult = eventPayloadSchemas[input.eventType].safeParse(input.payload);
  if (!payloadResult.success) {
    throw new InvalidEventPayloadError(input.eventType, payloadResult.error.issues);
  }
  const createdAt = uuidv7ToCreatedAt(input.eventId);       // throws InvalidEventIdError if not v7
  const metadataResult = eventMetadataSchema.safeParse(input.metadata);
  if (!metadataResult.success) {
    throw new InvalidEventPayloadError(input.eventType, metadataResult.error.issues);
  }
  await tx.execute(sql`
    INSERT INTO events
      (event_id, event_type, aggregate_type, aggregate_id, payload, payload_version, metadata, created_at)
    VALUES
      (${input.eventId}::uuid, ${input.eventType}, ${input.aggregateType}, ${input.aggregateId}::uuid,
       ${payloadResult.data}::jsonb, ${input.payloadVersion ?? 1}, ${metadataResult.data}::jsonb, ${createdAt})
    ON CONFLICT (event_id, created_at) DO NOTHING
  `);
}
```

Three locked properties per SPEC.2 §7.7:

1. **Bound-transaction-only.** `tx: DbTransaction` (not `DbClient`); compile-error to pass top-level `db`. V3 enforced by signature.
2. **Zod-validates payload + metadata** before INSERT. Schema mismatches are runtime errors per LD-4.
3. **Hand-written sql\`\` template** with composite-PK ON CONFLICT per V1 + LD-3. Drizzle query-builder NOT used (LD-3 requires explicit ON CONFLICT clause visible at source).

Helper does NOT:
- Generate `event_id` (caller responsibility per ADR-0016 D1 + V6 + LD-9).
- Call `now()` for `created_at` (derived from UUIDv7 prefix per V2 + LD-9; required for retry-safe ON CONFLICT dedupe).
- Add Sentry tags / log enrichers / trace spans (LD-7 + B3).
- Catch Postgres errors (Q2; propagate to caller's tx retry per ADR-0013).

---

## §C — `src/lib/errors.ts` extension

Add two `DomainError` subclasses to the existing registry (currently 7 kinds per SCAFFOLD.15):

- `InvalidEventPayloadError` — `kind = 'invalid_event_payload'`; `eventType: string` + `issues: z.ZodIssue[]` public readonly. `toEnvelope()` returns `{ error: 'error_internal' }` (programming error, not user-facing — bug surface).
- `InvalidEventIdError` — `kind = 'invalid_event_id'`; `eventId: string` public readonly. `toEnvelope()` returns `{ error: 'error_internal' }`.

Append to the registry's discriminated `kind` union. ~30 LOC delta.

---

## §D — Per-site migration

Six emit sites + helper refactor. Per-site mechanics below.

### D.1 — `sign-upload.ts` + `sign/route.ts` (SCAFFOLD.15 helper refactor + emission)

**Refactor (SURPRISE-A absorption — CLAUDE.md §3 compliance).** `signUploadAndInsert` currently does `INSERT image_uploads` + `await mintPutUrl(...)` + (TODO emission). HTTP-inside-future-tx would violate CLAUDE.md §3.

After refactor:

- **`signUploadAndInsert(tx, args)`** (~+25 LOC; param shape change is breaking-internal): takes `tx: DbTransaction` instead of `db: DbClient | DbTransaction`. New params: `eventId`, `metadata`. Returns `{ uploadId, key }` (drops `putUrl`). Body: validate MIME/size → INSERT row inside `tx` → `await insertEvent(tx, { eventId, eventType: 'image_upload.sign_requested', aggregateType: 'image_upload', aggregateId: uploadId, payload: { uploadId, userId, contentType, byteSize, key }, metadata })`.
- **`route.ts:POST`** (~+20 LOC): unchanged HTTP signature. Generate `eventId = uuidv7()` after auth gate. Build `metadata` from request context. `const { uploadId, key } = await db.transaction(tx => signUploadAndInsert(tx, { ..., eventId, metadata }))`. Then `const putUrl = await mintPutUrl('uploads', key, contentType, PUT_URL_TTL_SECONDS)` outside tx. Return `{ uploadId, putUrl, key }` as before.
- Delete `sign-upload.ts:80` TODO + `route.ts:123` TODO. Update `route.ts:27` step-7 prose comment (no longer "STUB").

Resulting handler sequence honors AGENTS.md §7 seven-step stack: origin → auth → idempotency-exempt → rate-limit → body validate → handler-body (tx) → (events emitted INSIDE tx — step 7 collapses into step 6). Post-tx HTTP fanout (`mintPutUrl`) is response-shaping, not a state mutation.

Test ripple: `tests/server/storage/sign-upload.test.ts` updates per param-shape change (helper now requires tx + eventId + metadata).

### D.2 — `tos-accept.ts:128` (move into existing tx)

Already inside `db.transaction()` at lines 92-121.

- After line 90 (ip + ua derivation), generate `eventId = uuidv7()` + build `metadata = { request_id, flow_id: 'F-AUTH-4', user_id: userId, actor_id: userId, idempotency_key: null, ip, user_agent: ua }`. (Note S-C: `request_id` not yet populated at handler entry — placeholder `'unknown'` until HARDEN.* sweep.)
- Inside existing tx, AFTER the `UPDATE users` (line 112-120), add: `await insertEvent(tx, { eventId, eventType: 'user.tos_accepted', aggregateType: 'user', aggregateId: userId, payload: { userId, tosVersionHash: TOS_VERSION_HASH, privacyVersionHash: PRIVACY_VERSION_HASH, ip, userAgent: ua }, metadata })`.
- Delete `tos-accept.ts:128` TODO.

~15 LOC delta.

### D.3 — `admin/login.ts:180` (move into `attemptAdminSessionReplace` tx; thread eventId)

- After line 109 (ip derivation, before HMAC compare), generate `eventId = uuidv7()` + build `metadata = { request_id: 'unknown', flow_id: 'F-AUTH-ADMIN', user_id: null, actor_id: 'admin-singleton', idempotency_key: null, ip, user_agent }`.
- Refactor `attemptAdminSessionReplace(eventId, metadata)` signature. Inside its existing SERIALIZABLE tx, AFTER `INSERT INTO admin_sessions` returns (line 96-97), add `await insertEvent(tx, { eventId, eventType: 'admin.signed_in', aggregateType: 'admin_session', aggregateId: inserted[0].session_id, payload: { sessionId: inserted[0].session_id, ip }, metadata })`.
- **`aggregate_id` = the inserted `admin_sessions.session_id`** (UUIDv7 PK per `src/db/schema/auth.ts:158-159`; already in scope via existing `RETURNING session_id`). The event's aggregate is the admin_session row being created, not the admin actor. Admin-actor identity carries in `metadata.actor_id = 'admin-singleton'` (JSONB, no UUID constraint) per SPEC.2 §3.6.
- SERIALIZABLE retry-safety: V2 holds. `eventId` is generated at handler entry, reused across both attempts; second attempt's INSERT hits ON CONFLICT and dedupes. (Note: the RETURNING `session_id` differs across retry attempts because the DELETE+INSERT resets identity — fine, since the second attempt's events row is suppressed by ON CONFLICT on `event_id` regardless of payload differences.)
- Delete `admin/login.ts:180` TODO.

~20 LOC delta.

### D.4 — `admin/logout.ts:30` (wrap DELETE in tx)

- Inside the `if (cookie?.value)` branch, generate `eventId = uuidv7()` + `metadata = { request_id: 'unknown', flow_id: 'F-AUTH-5-ADMIN', user_id: null, actor_id: 'admin-singleton', idempotency_key: null, ip: 'unknown' /* logout has no request body, ip via headers helper */, user_agent: 'unknown' }`.
- Replace bare `db.execute(DELETE...)` with `await db.transaction(async (tx) => { await tx.execute(sql\`DELETE FROM admin_sessions WHERE session_id = ${cookie.value}\`); await insertEvent(tx, { eventId, eventType: 'admin.signed_out', aggregateType: 'admin_session', aggregateId: cookie.value, payload: { sessionId: cookie.value }, metadata }); })`.
- **`aggregate_id` = `cookie.value`** (the `admin_sessions.session_id` UUIDv7 directly; admin/login.ts:173-178 stores it in the cookie, admin/logout.ts:21 reads it). No `RETURNING` needed since the cookie carries the PK.
- `cookieStore.delete` stays outside tx (cookie clear is response-shaping).
- Delete `admin/logout.ts:30` TODO.

~15 LOC delta.

### D.5 — `logout.ts:20` (post-signOut V3 carve-out)

V3 carve-out: Better Auth's `signOut` owns the session deletion in its own tx; emission necessarily happens in a separate post-commit tx. Audit-trail gap on process-crash between `signOut` and the emit-tx is accepted operational tradeoff (session deletion is idempotent; missing log entry has no consequence beyond log gap). Same-commit SPEC.2 §7 amendment names the carve-out (§E.2 below).

Shape (per shape-clarification in plan-mode chat):

```ts
export async function signOutAction(): Promise<void> {
  const headerStore = await headers();
  const session = await auth.api.getSession({ headers: headerStore });
  const userId = session?.user?.id ?? null;
  await auth.api.signOut({ headers: headerStore });
  if (userId) {
    const eventId = uuidv7();
    const metadata = { request_id: 'unknown', flow_id: 'F-AUTH-5', user_id: userId, actor_id: userId, idempotency_key: null, ip: 'unknown', user_agent: 'unknown' };
    await db.transaction(async (tx) => {
      await insertEvent(tx, {
        eventId,
        eventType: 'user.signed_out',
        aggregateType: 'user',
        aggregateId: userId,
        payload: { userId },
        metadata,
      });
    });
  }
  redirect('/');
}
```

- `getSession` before `signOut` (the session is deleted by `signOut`; `user.id` unrecoverable afterwards).
- `if (userId)` guard suppresses emission for sign-out calls with no session (idempotent no-op path).
- Delete `logout.ts:20` TODO.

~20 LOC delta.

### D.6 — `sweep-orphans.ts:127` (per-row micro-tx; preserves UPDATE-then-delete ordering)

**Ordering, locked:** UPDATE-CAS (inside tx, with `insertEvent` atomic) → tx commits → THEN `deleteObject` (HTTP, outside tx). Preserves SCAFFOLD.15 security-auditor MEDIUM #1 fix; eliminates W-2/sweep TOCTOU window. Layer-1 R2 90-day lifecycle is the safety net for `deleteObject` failures (per SPEC.2 §12.3 + §12.6). **NOT delete-then-update.**

Shape:

```ts
for (const row of candidates) {
  const r2KeyOrNull = await db.transaction(async (tx) => {
    const updated = await tx.execute<UpdateReturningRow>(sql`
      UPDATE image_uploads
         SET terminal_state = 'orphan', terminal_at = now()
       WHERE id = ${row.id}::uuid AND terminal_state IS NULL
       RETURNING r2_object_key
    `);
    if (updated.length === 0) return null;          // CAS lost — concurrent W-2 commit; no event
    const eventId = uuidv7();                       // per-row generation (cron has no handler entry)
    await insertEvent(tx, {
      eventId,
      eventType: 'image_upload.orphaned',
      aggregateType: 'image_upload',
      aggregateId: row.id,
      payload: { uploadId: row.id, key: updated[0].r2_object_key },
      metadata: { request_id: 'unknown', flow_id: 'F-CRON-ORPHAN-SWEEP', user_id: null, actor_id: 'system', idempotency_key: null, ip: 'cron', user_agent: 'vercel-cron' },
    });
    return updated[0].r2_object_key;
  });
  if (!r2KeyOrNull) continue;                       // CAS lost
  swept++;
  try { await deleteObject('uploads', r2KeyOrNull); consecutiveR2Failures = 0; }
  catch (err) {
    console.error('orphan_sweep_per_row_failure', err);   // SCAFFOLD.5 routes to Sentry
    consecutiveR2Failures++;
    if (consecutiveR2Failures >= circuitBreakerThreshold) { earlyAbort = true; break; }
  }
}
```

Notes:
- `eventId` is generated per-row inside the tx (cron has no handler entry; per-row generation is the cron analog of handler-entry generation; V2 retry-safety holds since each tx is independent).
- `metadata.actor_id = 'system'` per SPEC.2 §3.6 system-actor encoding.
- `deleteObject` runs AFTER tx commits (preserves UPDATE-then-delete ordering).
- Delete `sweep-orphans.ts:127` TODO.

~20 LOC delta. Affected integration tests under `tests/server/storage/orphan-sweep.test.ts` re-baseline against new per-row-tx shape (semantics unchanged: `swept` still counts CAS-success).

---

## §E — SPEC.2 amendments (same-commit per CLAUDE.md §7)

Four amendments, all same-commit:

1. **§7 [STUB] body lift** — **verify at execute.** Brief §2 §E says §7 is still `[STUB]`; Phase-1 read showed full §7.1-§7.7 prose. If `grep '\[STUB\]' docs/specs/SPEC.2.md | grep -i '§7'` returns hits, lift to ratified prose; else no-op. Brief drift; not blocking.
2. **§7 post-mutation observation carve-out** (new paragraph after §7.5): *"V3 (synchronous emission in originating transaction) holds across all in-house mutation paths. One carve-out: when an upstream library (Better Auth `signOut`) owns the originating mutation and does not expose an after-hook for events emission, the events row may be emitted in a separate post-commit transaction. Audit-trail gap between mutation and emission (process-crash window) is accepted iff the upstream mutation is idempotent. Currently applied only at `src/server/auth/logout.ts` for `user.signed_out`."*
3. **§8.8 `admin.signed_out` addition** — append to the admin auth-flow event_type enumeration after `admin.signed_in`. Names the matching `aggregate_type = 'admin_session'` + `aggregate_id = admin_sessions.session_id`. (Codifies an event_type that exists in code but is missing from the §8.8 enum.)
4. **§7.1 `aggregate_type` enum extension** — add `admin_session` as the 7th canonical aggregate_type. Current §7.1 enumeration: `market`, `bet`, `comment`, `user`, `dharma_account`, `system`. Add `admin_session` to support admin.signed_in + admin.signed_out emissions where the aggregate is the admin_sessions row. Single-line addition to the §7.1 `aggregate_type` notes column.

ADR Index (§22): no new ADR (ENGINE.6 consumes accepted ADRs; mints no new architectural decisions per LD-2). Backfill of ADR-0005 file content remains queued maintenance per `project_adr_catalogue_framing` memory.

---

## §F — Tests

Per CLAUDE.md §5.6 (failing tests first via `test-writer` reviewer call at Phase 2 start) + brief §3 + research brief §11.

### Helper tests (`tests/server/events/`)

- **`insert.test.ts`** (~180 LOC integration): per-event_type driver test (11 cases: build valid payload, call `insertEvent(tx, ...)`, assert row in `events` with correct columns). Retry-with-same-eventId test (assert ON CONFLICT dedupes; row count = 1). Transaction-atomicity driver (insert image_uploads + insertEvent in one tx; rollback halfway → neither row present).
- **`insert.guards.test.ts`** (~100 LOC): Zod payload rejection (one per event_type; assert `InvalidEventPayloadError`, row-count snapshot unchanged). Non-UUIDv7 event_id rejection (`InvalidEventIdError`). Missing metadata field (each of 7 fields independently).
- **`insert.probe.test.ts`** (~70 LOC): UUIDv7 → created_at extraction (fixed-seed UUIDv7; assert ms precision). Drizzle-`sql\`...\``-to-SQL probe (compile-time-equivalent; assert literal `ON CONFLICT ("event_id", "created_at") DO NOTHING` in generated SQL). Partition routing (2026-06 → `events_2026_06`; out-of-range → DEFAULT — asserts route, not alarm wiring).

### Migration-site tests (per emit site)

- `tests/server/storage/sign-upload-event.test.ts` (~60 LOC) — assert `image_upload.sign_requested` row + `image_uploads` row atomically commit; `mintPutUrl` is post-tx.
- `tests/server/storage/sweep-orphans-event.test.ts` (~70 LOC) — per-row CAS-success emits `image_upload.orphaned`; CAS-loss path emits NOTHING; `deleteObject` runs after tx.
- `tests/server/auth/tos-accept-event.test.ts` (~50 LOC) — emission atomic with `UPDATE users` inside SERIALIZABLE tx.
- `tests/server/auth/logout-event.test.ts` (~70 LOC) — V3 carve-out: `getSession` returns userId; after `signOut`, emit happens in new tx; sign-out-with-no-session emits NOTHING.
- `tests/server/auth/admin/login-event.test.ts` (~70 LOC) — emission inside SERIALIZABLE retry path; retry reuses same eventId; ON CONFLICT dedupes.
- `tests/server/auth/admin/logout-event.test.ts` (~50 LOC) — DELETE + insertEvent atomic; no-cookie path emits nothing.

**~720 LOC tests total** (350 helper + 370 migration-site).

---

## §G — `event_type` enum hygiene

`src/server/events/schemas.ts` is the SoT for valid event_type strings. Adding a new event_type at any future stratum:

1. Add literal to `EVENT_TYPES` array (1 line, alpha-sorted within domain).
2. Add `z.object({...})` entry to `eventPayloadSchemas` map (~5-10 lines).
3. `satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>` catches step-2 omission at TypeScript compile time.
4. No other file edits required at the helper or call-site layer.

File-level docstring in `schemas.ts` documents this contract. AGENTS.md inclusion deferred per project memory (ADR backfill is queued maintenance).

---

## File-touch inventory + LOC estimate

**NEW (5 files):**

| Path | Est LOC |
|---|---|
| `src/server/events/insert.ts` | ~75 |
| `src/server/events/schemas.ts` | ~140 |
| `tests/server/events/insert.test.ts` | ~180 |
| `tests/server/events/insert.guards.test.ts` | ~100 |
| `tests/server/events/insert.probe.test.ts` | ~70 |

**MODIFIED (10 files):**

| Path | Est LOC delta |
|---|---|
| `src/lib/errors.ts` | +30 (2 new error classes) |
| `src/server/storage/sign-upload.ts` | ~+25 (refactor + emission) |
| `src/app/api/uploads/sign/route.ts` | ~+20 (tx orchestration + post-tx HTTP) |
| `src/server/storage/sweep-orphans.ts` | ~+20 (per-row micro-tx) |
| `src/server/auth/tos-accept.ts` | ~+15 (emission inside existing tx) |
| `src/server/auth/logout.ts` | ~+20 (getSession + post-signOut emit) |
| `src/server/auth/admin/login.ts` | ~+20 (thread eventId; emit in SERIALIZABLE tx) |
| `src/server/auth/admin/logout.ts` | ~+15 (wrap DELETE in tx + emit) |
| `docs/specs/SPEC.2.md` | 3-4 same-commit amendments |
| `tests/server/storage/sign-upload.test.ts` | re-baseline for refactor |

**NEW (6 migration-site tests, ~370 LOC total):** per §F.

**Aggregate stratum size: ~1100 LOC** (560 src code + 720 tests + spec amendments). Larger than brief's implicit estimate; driven by tests-first discipline + the helper-refactor absorption + per-site test coverage. Within the SCAFFOLD.15 envelope.

---

## Per-domain commit sequence (Q4 verdict)

1. **`feat(engine-6): events helper + per-event-type Zod schemas`** — `src/server/events/insert.ts`, `src/server/events/schemas.ts`, `src/lib/errors.ts`, `tests/server/events/*.test.ts`. Helper + schemas + tests land first; subsequent commits depend on these.
2. **`feat(engine-6): emit image_upload.sign_requested + helper refactor`** — `src/server/storage/sign-upload.ts`, `src/app/api/uploads/sign/route.ts`, `tests/server/storage/sign-upload.test.ts` (re-baseline), `tests/server/storage/sign-upload-event.test.ts`. Absorbs SURPRISE-A.
3. **`feat(engine-6): emit image_upload.orphaned (per-row micro-tx)`** — `src/server/storage/sweep-orphans.ts`, `tests/server/storage/sweep-orphans-event.test.ts`.
4. **`feat(engine-6): emit user.tos_accepted`** — `src/server/auth/tos-accept.ts`, `tests/server/auth/tos-accept-event.test.ts`.
5. **`feat(engine-6): emit user.signed_out (post-signOut V3 carve-out)`** — `src/server/auth/logout.ts`, `tests/server/auth/logout-event.test.ts`.
6. **`feat(engine-6): emit admin.signed_in + admin.signed_out`** — `src/server/auth/admin/{login,logout}.ts`, `tests/server/auth/admin/{login,logout}-event.test.ts`.
7. **`docs(spec-2): ENGINE.6 amendments (§7 carve-out + §8.8 admin.signed_out + §7.1 admin_session aggregate_type)`** — `docs/specs/SPEC.2.md`. Same PR; per CLAUDE.md §7 cleanup absorption rule.

PR opens against `main` from `feat/engine-6-events-helper` after pre-PR audit (§5.10) + reviewer calls (§5.11) clean.

---

## Verification (CLAUDE.md §5.7 + §5.10 + §5.11)

### Pre-PR self-audit (§5.10)

Walk in this order; record PASS / FAIL / SURPRISE inline:

- Every event_type in `EVENT_TYPES` matches the 11-string canonical list above (no extras, no omissions, no `r2_delete_failed`).
- Every `eventPayloadSchemas` entry compiles via `satisfies` exhaustiveness — `tsc --noEmit` GREEN.
- Every migrated site's emission is inside a `tx` (or V3 carve-out documented per §E.2).
- Every emit call passes `metadata` with all 7 fields (S-C accepted as `'unknown'` placeholders pending HARDEN.* sweep; document each site's `'unknown'` count).
- `eventId` generated at handler entry per ADR-0016 D1 at all sites except `sweep-orphans` (cron — per-row generation justified inline).
- Helper's INSERT cites `ON CONFLICT (event_id, created_at) DO NOTHING` (composite per V1) — grep verification.
- Helper's `created_at` is derived from `uuidv7ToCreatedAt(eventId)`, NOT `now()` (V2) — grep verification.
- `grep -rn "TODO(ENGINE.6)" src/` returns 0 hits.
- `grep -rn "TODO(ENGINE.6)" tests/` flagged informationally (out of scope per brief §7).
- SPEC.2 amendments per §E land in the same commit as the implementing code per CLAUDE.md §7.

### Reviewer calls (§5.11)

- **`test-writer`** at Phase 2 start (per §5.6 — events helper is new business-logic primitive on the bet/comment/dharma/resolution dependency path). Failing tests first against §F test plan. Tool scope: Read, Write/Edit tests only, Bash, Grep, Glob. No `src/` edits.
- **`code-reviewer`** at Phase 2 post-audit on all `src/server/events/*.ts` + per-site emit refactors. Tool scope: Read, Grep, Glob, Bash.
- **`security-auditor`** at Phase 2 after code-reviewer on auth-flow emit sites — verify admin/participant structural separation per SPEC.2 §8.7-§8.9; no PII leaks into payload (PII belongs in `metadata` for filterability); `metadata.user_id = NULL` for admin actors per SPEC.2 §3.6. Tool scope: Read, Grep, Glob, Bash.
- **`db-migration-reviewer`**: NOT invoked (no schema migrations in ENGINE.6 — events table predates this stratum).

### Just-check + invariant gate

- `just verify` (typecheck + lint + tests + build) GREEN before PR open.
- `pnpm test:invariants` — events helper does not touch the 4 hard-locked invariants directly; migration sites adjacent (tos_accept inside SERIALIZABLE tx; admin.signed_in inside SERIALIZABLE retry path). Re-run invariants to confirm zero regression.
- `pnpm test:integration` — events-table writes verified end-to-end against test Postgres.

---

## Anticipated SURPRISES (carry forward, not pre-resolved)

| ID | Phase | Trigger | Resolution lean |
|---|---|---|---|
| S-A | Resolved (plan) | sign_requested double-stub | Helper refactor (§D.1) absorbs both sites; one emit inside tx. |
| S-B | Resolved (plan) | All TODO sites outside tx | Per-site verdicts §D.1-§D.6; V3 carve-out §E.2 for logout. |
| S-C | Deferred | metadata 7-field set not built at handler entries | `'unknown'` placeholders at emit; HARDEN.* sweep adds request-context middleware to populate at handler entry. ENGINE.6 surfaces and defers. |
| S-D | Cosmetic | SPEC.2 §22.2 design-independence carve-out doesn't name ENGINE.6 | If found, carry-forward to next tracker sweep; non-blocking. |
| S-E | Cleared | TS < 4.9 for `satisfies` | TS `^5` ✓. |
| S-F | Resolved (plan, WC correction) | Conflated `events.aggregate_id` (entity mutated) with `metadata.actor_id` (admin singleton). | Use `admin_sessions.session_id` (UUIDv7 PK) as `aggregate_id` for admin events; `aggregate_type = 'admin_session'` (new enum entry — SPEC.2 §7.1 amendment per §E.4); `metadata.actor_id = 'admin-singleton'` (JSONB, no UUID constraint) per SPEC.2 §3.6. No ADMIN_SINGLETON_UUID synthesized. |
| S-G | New (execute-time verify) | SPEC.2 §7 [STUB] marker actually present | If found, lift to ratified prose same-commit per §E.1; else no-op. |

---

## Out of scope (mirror of brief §7)

- Event QUERY helpers — deferred to admin/dataset stratum.
- Replay mechanism — testnet phase.
- New Sentry sinks — ADR-0007 / SCAFFOLD.5.
- DEBATE.2 future event sites (`.committed`, `.blocked`) — schemas registered here; emit sites added at DEBATE.2 same-commit.
- Future Better Auth-hook stratum (`.oauth_signed_in`, `.otp_signed_in`, `.pseudonym_assigned`) — schemas registered here; emit sites + Better Auth `after`-hook integration deferred.
- `image_upload.r2_delete_failed` — SCAFFOLD.5 Sentry path; not in canonical enum.
- CI lint enforcing `insertEvent` in state-mutating handlers — HARDEN.* per ADR-0005.
- AGENTS.md event_type addition contract — deferred per project memory.
- `metadata` 7-field set population at handler entries — HARDEN.* sweep.
- `users.banned_at` enforcement gap (SCAFFOLD.15 SURPRISE-14) — orthogonal HARDEN.* task.
- `X-Forwarded-For` first-entry trust (SCAFFOLD.15 SURPRISE-15) — orthogonal HARDEN.* task.

---

*Plan-mode authored 2026-05-24 per ENGINE.6 plan-mode brief + technical research brief. Drift from brief §2 §D inventory (5+6→6+5 corrected per LD-1 verdict above) absorbed at plan-mode per the kickoff's audit-against-repo-state discipline.*
