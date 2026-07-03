# AUDIT-FIX-A1 (+A10) — moderated-image byte-identity binding

> **BLOCKER · critical-path (moderation + storage).** Closes the post-moderation
> CSAM/gore *swap* window: today a participant can upload benign bytes, pass
> pre-commit moderation, then overwrite the same R2 key with disallowed content
> before the image is ever rendered. This plan makes the moderated bytes ≡ the
> rendered bytes **by construction** (physical write-once immutability), and adds
> a fail-closed pre-moderation size/existence backstop (A10).
>
> HEAD at plan authorship: `16bb728`. Opus 4.8 / `/effort max`. NOT `ultracode`
> (critical path — gated plan→execute + named-reviewer cascade). This file is the
> ratified plan of record, reconstructed into the repo for the subagent cascade.

## Tracker context

AUDIT-FIX-A1 is an audit-remediation stratum (no tracker row — audit-driven).
A10 (oversize fail-closed on the REAL object) is folded in because it shares the
one new pre-moderation HeadObject call — one round trip, two guarantees.

## The vulnerability (what we are closing)

1. Participant calls `POST /api/uploads/sign` → gets a presigned PUT URL for
   `u/<userId>/<uploadId>.<ext>` + the `uploadId`.
2. Participant PUTs **benign** bytes to that URL. Object created.
3. Participant calls `POST /api/bets/place` with `imageUploadsId`. The route
   resolves the key, `precommitModerate` mints a 60s read URL and OpenAI
   moderates the **benign** bytes → `pass`. The bet+comment commits; the upload
   terminalizes `committed`.
4. **The hole:** between the moderation read (step 3) and the eventual render,
   nothing stops the participant from issuing a *second* PUT to the same
   presigned URL (still valid within its 60s TTL) — or re-signing — and
   overwriting the object with **CSAM / gore**. The moderated verdict now
   describes bytes that no longer exist; the rendered image is unmoderated.
   (SPEC.1 §16.5 swap-after-approval window; SPEC.2 §10.)

## Approach — physical immutability, not an ETag compare

**Load-bearing mechanism (do NOT substitute an ETag-equality check for it):**

- The participant presigned PUT is signed with **`If-None-Match: "*"`**. The
  first PUT creates the object; **every later PUT to that key → HTTP 412**
  (Precondition Failed). The object is immutable from its first write. Because
  the header is baked into the SigV4 signature (`if-none-match` joins
  `X-Amz-SignedHeaders`), a client **cannot** drop it to bypass write-once — the
  signature would not validate. ⇒ moderated bytes ≡ rendered bytes **by
  construction**.
- **One pre-tx `HeadObject`** before moderation:
  - **(A10)** reject if the REAL `ContentLength` is outside `(0,
    IMAGE_UPLOADS_MAX_BYTES]` — FAIL-CLOSED. The sign-time size is client-declared
    and unverified; this checks the bytes that actually landed.
  - reject if the object is **missing** / R2 is **unavailable** — FAIL-CLOSED
    (a missing object means moderation would have nothing real to read).
  - capture the **ETag + real size** into the append-only
    `image_upload.committed` event.
- **ETag is a FORENSIC FINGERPRINT, never a security primitive.** R2's ETag is an
  MD5 digest (collision-weak); it is recorded for post-hoc audit only. The
  security guarantee is the *physical write-once*, not any ETag comparison. We
  never gate a decision on ETag equality.

**Why this and not a moderate-at-render or re-moderate approach:** re-moderating
at render re-introduces an HTTP hop on the read path and still races the swap;
write-once removes the race entirely at the storage layer with zero read-path
cost. Admin-uploaded market media is **out of scope** (trusted + unmoderated per
ADR-0026/0027) — the admin sign path is untouched and does **not** arm write-once.

## 1. Thesis invariants touched

None weakened. INV-1..4 are untouched:

- **INV-1** (bet↔comment atomicity): the new `verifyUploadedObject` runs
  **pre-tx** (before moderation, which is before `runBetTransaction`). No new
  writes inside the W-1 tx; no ordering change to the spine. The
  `image_upload.committed` payload gains two fields but the emit site + its
  caller-generated `event_id` (retry-purity) are unchanged.
- **INV-2/3/4**: no ledger / side-freeze / resolution surface touched.
- **CLAUDE.md §3 no-HTTP-in-tx**: the new HeadObject is an *external HTTP* call,
  placed strictly **pre-tx** (alongside `resolveImageAttachment` and
  `precommitModerate`). It NEVER runs inside `db.transaction(...)`.
- **Moderation fail-closed posture (ADR-0014)**: preserved and *extended* — the
  new verify step also fails closed (any error blocks; the tx never opens).

## 2. Data model changes

**None. No DDL. No migration.** `@db-migration-reviewer` is N/A.

The only schema-adjacent change is the `image_upload.committed` **event payload
Zod schema** (`events.payload` is JSONB; the schema is validated at write time
only — no read-side replay re-validates it, same as `market.created`). Two new
fields:

- `etag: z.string().nullable()` — the forensic fingerprint (null iff R2 omits
  the ETag header, defensive).
- `byteSizeActual: z.number().int().positive()` — the REAL object size from
  HeadObject.

`EVENT_TYPES` is **unchanged** (still 23 — no new event type, no new
aggregate_type).

## 3. Implementation — file by file

### 3.1 `src/server/storage/r2.ts`
- `mintPutUrl` gains an optional final param
  `opts?: { ifNoneMatch?: boolean }`. When `opts?.ifNoneMatch === true`, add
  `IfNoneMatch: "*"` to the `PutObjectCommand`. Default (no opts) is byte-for-byte
  the current behavior — the **admin** media sign path passes nothing and is
  UNCHANGED.
- `headObject`'s return is extended with `etag: string | undefined` (from
  `out.ETag`, kept verbatim — the quoted MD5 R2 returns; forensic, not parsed).
  Existing `{ contentLength, contentType }` fields unchanged. Only caller today
  is `verify-object.ts` (new) — no other consumer to update.

### 3.2 NEW `src/server/storage/verify-object.ts`
```ts
export async function verifyUploadedObject(
  key: string,
): Promise<{ etag: string | undefined; byteSize: number }>
```
- Calls `headObject("uploads", key)`.
- Enforces `0 < contentLength <= IMAGE_UPLOADS_MAX_BYTES`; otherwise throws
  `ImageOversizeError(contentLength, IMAGE_UPLOADS_MAX_BYTES)` (A10). The lower
  bound mirrors the existing `ImageOversizeError` contract already used in
  `sign-upload.ts` (its docstring: "byteSize outside (0, MAX]"), and guarantees
  `byteSizeActual` satisfies the `.positive()` event schema — no 500-in-tx from a
  0-byte object.
- Lets `StorageObjectMissingError` (404) and `StorageUnavailableError` (5xx /
  connection) **PROPAGATE** — fail-closed. Does not catch them.
- `import "server-only"`.

### 3.3 `src/app/api/uploads/sign/route.ts`
- Pass `{ ifNoneMatch: true }` to `mintPutUrl(...)`.
- Document the **client contract** in the handler comment: the PUT **must** send
  `If-None-Match: *` (it is a signed header — omitting it fails signature
  validation); a **412** on a repeat PUT is expected and means
  *already-uploaded* → the client treats it as idempotent success.

### 3.4 `src/app/api/bets/place/route.ts`
- New **pre-moderation** step, only when an image is attached: after
  `resolveImageAttachment` (step 5c), call `verifyUploadedObject(r2ObjectKey)`
  (fail-closed) and thread `{ etag, byteSize }` into the resolved-image record.
  Concretely, widen `resolvedImage` to carry `etag: string | null` +
  `byteSizeActual: number`, so the late `image` object (currently
  `{ ...resolvedImage, committedEventId }`) automatically carries them.
- Error mapping is handled by `toWireError` (see §3.7) — the route already lets
  `inner` throw and `runBetEndpoint` maps via `toWireError`. Confirm mapping:
  `ImageOversizeError → 400 error_image_oversize`; `StorageObjectMissingError →
  409 error_storage_object_missing`; `StorageUnavailableError → 503
  error_storage_unavailable` (Retry-After 5). See the **Open decision** on the
  missing-object status below.

### 3.5 `src/server/bets/place.ts`
- `PlaceParams.image` gains `etag: string | null` + `byteSizeActual: number`
  (required when an image is present).
- Include both in the `image_upload.committed` event payload. **NO new tx writes,
  NO ordering change** — only two fields added to the existing emit's payload.

### 3.6 `src/server/events/schemas.ts`
- Extend the `image_upload.committed` payload `z.object({...})` with
  `etag: z.string().nullable()` + `byteSizeActual: z.number().int().positive()`.
  **No new `EVENT_TYPE`.**

### 3.7 `src/server/bets/errors.ts` (`toWireError`)
- Map the three `@/lib/errors` DomainError classes explicitly onto the §4.4 wire
  envelope (they are NOT `BetProductError`, so they currently fall through to 500
  `error_internal`). Add, grouped with the existing moderation-class mappings:
  - `ImageOversizeError → buildWire(400, "error_image_oversize", msg)` — cached
    terminal 4xx (the object won't shrink; a fresh attempt uses a new key).
  - `StorageObjectMissingError → buildWire(400, "error_storage_object_missing",
    msg)` — cached terminal 4xx. **RESOLVED** (ADR-0028 §Decision Outcome RULING;
    kickoff wrote "400/409"): **400** `validation_error` — the client referenced
    an upload it never completed (bad request), symmetric with
    `error_image_oversize → 400`; 409 in this codebase denotes a clash with
    existing/in-flight state, which an absent object is not.
  - `StorageUnavailableError → buildWire(503, "error_storage_unavailable", msg,
    { retryAfterBody: 5 })` — status ≥ 500 ⇒ `runBetEndpoint` does **NOT** cache
    it ⇒ a retry re-attempts cleanly. Correct fail-open-on-retry for transient
    infra.

### UNTOUCHED (proven safe by write-once)
`load-debate-view.ts`, `precommit.ts` / `openai.ts` / `consequences.ts`,
`sign-read.ts`, the admin `markets/media/sign` route, all schema + migrations.

## 4. User / client flow

Unchanged shape; one new client obligation on the PUT:

1. `POST /api/uploads/sign` → `{ uploadId, putUrl, key }`.
2. Client `PUT putUrl` with the image bytes **and header `If-None-Match: *`**.
   First PUT → 200. Any repeat PUT to that URL/key → **412** (treat as
   already-uploaded success).
3. `POST /api/bets/place` with `imageUploadsId`. Route: resolve → **verify
   (HeadObject, A10 + existence, fail-closed)** → moderation (pre-tx) → W-1 tx.
4. Render path serves the object that is now physically immutable ≡ moderated.

## 5. Failure modes (all fail-closed)

| Condition | Detection | Result |
|---|---|---|
| Object missing at place-time | HeadObject 404 → `StorageObjectMissingError` | 409, tx never opens |
| R2 down / 5xx at place-time | HeadObject 5xx → `StorageUnavailableError` | 503 (Retry-After 5), NOT cached, tx never opens |
| Real object oversize / 0-byte | `ContentLength` ∉ (0, MAX] → `ImageOversizeError` | 400 `error_image_oversize`, tx never opens |
| Repeat PUT (swap attempt) | R2 If-None-Match precondition | 412 at R2; object never mutated |
| Client drops `If-None-Match` on PUT | SigV4 signed-header mismatch | 403 at R2; PUT rejected |

## 6. Edge cases

- **412 on the first legitimate PUT** cannot happen (object doesn't exist yet).
- **Double-mint** (two `sign` calls, same intended content): each returns a
  distinct `uploadId`/key; the orphan sweep reaps the unused one (unchanged).
- **Retry of `place`** (same Idempotency-Key): the HeadObject re-runs pre-tx on
  each attempt (idempotent, read-only); the tx-level retry re-uses the closed-over
  `committedEventId` (retry-purity intact).
- **ETag absent** in R2 response (defensive): `etag` stored as `null`; no failure
  (forensic-only).
- **Old `image_upload.committed` events** (pre-change, no new fields): no read-side
  replay re-validates the payload schema — write-time validation only; greenfield,
  no prod data.

## 7. Test plan (`@test-writer`, FAILING first, never edits `src/`)

New tests (the 8 required scenarios):
1. **write-once armed** — `mintPutUrl("uploads", …, { ifNoneMatch: true })`
   produces a `PutObjectCommand` whose input carries `IfNoneMatch: "*"` (assert
   at the command layer; the admin/no-opts path does NOT).
2. **presigner signs it** — the signed URL's `X-Amz-SignedHeaders` includes
   `if-none-match` (real presigner, no network — mirrors
   `_probe-aws-sdk-presigned-put.test.ts`).
3. **sign route opts in** — `POST /api/uploads/sign` calls `mintPutUrl` with
   `{ ifNoneMatch: true }` (spy on `mintPutUrl`).
4. **A10 oversize → fail-closed** — HeadObject returns `ContentLength > MAX` ⇒
   `verifyUploadedObject` throws `ImageOversizeError`; via the place route ⇒ 400
   `error_image_oversize`, the bet tx **never opens**.
5. **missing object → fail-closed** — HeadObject 404 ⇒ propagates ⇒ place route
   409 `error_storage_object_missing`, tx never opens.
6. **R2 unavailable → 503** — HeadObject 5xx ⇒ `StorageUnavailableError` ⇒ 503,
   NOT cached.
7. **audit record** — a passing image bet emits `image_upload.committed` carrying
   `etag` + `byteSizeActual` from the HeadObject.
8. **swap E2E (SDK mock, LABELED as mock)** — sign → PUT 200 → repeat PUT to the
   same signed URL → 412 (SDK-level mock of the R2 precondition). Explicitly
   labeled a mock; the REAL 412 is the deploy gate (§10), not this test.

Existing tests needing **conformance updates** (required-field addition +
new module boundary — implementer updates these, they are not new-behavior TDD):
- `tests/server/comments/media.test.ts` — drives the REAL place route against
  test Postgres; must **`vi.mock("@/server/storage/verify-object")`** to return a
  benign `{ etag, byteSize }` (else it makes a real HeadObject call), and thread
  the two new payload fields wherever it asserts `image_upload.committed`.
- `tests/server/events/insert.test.ts` + `insert.guards.test.ts` — construct an
  `image_upload.committed` event; add `etag` + `byteSizeActual` to the fixture
  payload (else Zod validation rejects the now-required fields).

## 8. Out of scope

- Admin market-media upload path (trusted/unmoderated, ADR-0026/0027) — untouched.
- Any re-moderation-at-render or second-vendor CSAM scanning (parked).
- The future MEDIA.3 composer client — it MUST honor the same `If-None-Match: *`
  contract (ADR-0028 AMD-3); building it is not this stratum.
- No changes to `precommitModerate`, `openai.ts`, `consequences.ts`, read paths.

## 9. Open decisions (RESOLVED)

- **Missing-object HTTP status** — **RESOLVED to 400** `error_storage_object_missing`
  (`validation_error`) per ADR-0028 §Decision Outcome RULING (web-authored). The
  kickoff wrote "400/409"; the ratified call is 400 (bad request, symmetric with
  `error_image_oversize`), landed in `bets/errors.ts` + the one test assertion.

## 10. Rollout — HARD DEPLOY GATE (staging-412)

**NO production deploy until a REAL 412 is demonstrated against REAL R2.** The
SDK-signs-it test (#2/#8) is necessary but INSUFFICIENT. Staging rehearsal:
sign → PUT benign (200) → PUT again same URL → **412** → `place` commits →
overwrite attempt → **412** → HeadObject shows the ORIGINAL ETag → oversize object
→ `error_image_oversize`. Gate the prod promote on `/api/health` green
(migrate-before-serve is moot here — no migration). Rehearse on `staging` first.

## 11. ADR + SPEC riders (same commit — WEB-AUTHORED, PAUSE to fetch)

- **NEW `docs/adr/0028-moderated-image-byte-identity-binding.md`** — next free
  number verified `0028` (0027 is the last on disk). Amends ADR-0014; references
  0026/0027 (admin path excluded as trusted/unmoderated). Required clauses:
  **(AMD-2)** ETag = forensic fingerprint, NOT a security control; **(AMD-3)** the
  future MEDIA.3 composer MUST send `If-None-Match: *` and treat 412 as
  idempotent-success (hard precondition).
- **SPEC.2 riders** (same commit): §12.4 (write-once binding), §12.3 (HeadObject
  size backstop wired, fail-closed, ETag captured), §10 (moderated object
  immutable between moderation and render).
- **SPEC.1 rider**: §16.5 (swap-after-approval CSAM window closed at storage
  layer).

> **PAUSE before committing the ADR + spec riders** and request the WEB-AUTHORED
> ADR-0028 body + rider text. This is a critical-path ADR on the CSAM floor — web
> authors the decision text; CC places it and web reviews the diff. CC does NOT
> author web-owned ADR/SPEC decision text.

## 12. Execute-phase ritual (critical path)

Cascade: `@test-writer` (Phase 2 start, FAILING first) → implement → `just verify`
+ `pnpm vitest run` (full suite — critical-path gate, run locally against
Postgres :54322) → `@code-reviewer` (`src/server/{storage,bets,events}` +
`api/{uploads/sign,bets/place}` diff) → `@security-auditor` (write-once armed +
UNBYPASSABLE, fail-closed HEAD, NO HTTP-in-tx, INV-1..4 intact, admin path
untouched). `@db-migration-reviewer` N/A (no DDL). Pre-PR §5.10 self-audit
item-by-item. **STOP at PR** — open it, return the diff, do NOT merge (operator
merges after web review).

## 13. Hard constraints (all reviewers enforce)

- Moderation + the new verify step stay strictly **PRE-TX** and **FAIL-CLOSED** —
  any new fetch/verify that errors MUST block, never pass.
- Weaken no invariant (INV-1..4) / moderation / idempotency; append-only respected
  (no in-place Bucket-A mutation).
- Same-commit doctrine: code + ADR-0028 + SPEC.2/SPEC.1 riders land together.

## References

- SPEC.1 §16.5; SPEC.2 §10, §12.3/§12.4; ADR-0014 (pre-commit moderation),
  ADR-0026/0027 (market media, admin upload).
- Live code: `src/server/storage/r2.ts`, `src/server/storage/verify-object.ts`
  (new), `src/app/api/uploads/sign/route.ts`, `src/app/api/bets/place/route.ts`,
  `src/server/bets/place.ts`, `src/server/bets/errors.ts`,
  `src/server/events/schemas.ts`.
