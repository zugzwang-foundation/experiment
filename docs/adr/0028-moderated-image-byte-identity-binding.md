# ADR-0028 — Moderated-Image Byte-Identity Binding

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Hrishikesh |
| **Tracker task** | AUDIT-FIX-A1 (+A10) — AUDIT.1 finding A1 (Blocker, CSAM legal-floor) + A10 (Medium, byte-size cap) |
| **Frame document** | SPEC.2 §22 (ADR Index), §12.3 (signed-PUT mint endpoint), §10 (pre-commit moderation contract); SPEC.1 §16.5 (compliance / legal floor) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Under the F-COMMENT-3 image-attached-comment flow (SPEC.2 §12.2), a participant obtains a signed PUT URL (§12.3), uploads image bytes out-of-band to `zugzwang-uploads`, then submits a comment-bearing bet that runs §10 pre-commit moderation against those bytes before the bet+comment transaction opens. AUDIT.1 finding A1 (Blocker) established that nothing bound the bytes moderation read to the bytes render later serves: the signed PUT URL is reusable within its 60-second TTL, no byte identity (ETag/hash/If-Match) was captured, `headObject` had zero request-path callers, and render mints a fresh GET of whatever bytes currently occupy the key. A scripted participant could therefore PUT a benign image, pass moderation, then re-PUT CSAM/gore to the same key inside the window — and the malicious bytes render publicly while `mod_actions` records a pass. This is the sole finding that reaches a legal-floor safety guarantee (SPEC.1 §16.5 CSAM detection + reporting; SPEC.2 §10 fail-closed-on-legal-floor posture).

Finding A10 (bundled) established the paired defect: the §12.3 byte-size cap was specified as a post-PUT `HeadObject` backstop but never wired — `byte_size` was client-declared and never checked against the real object, and the §12.3 backstop had zero callers.

This ADR binds a participant image to its moderated bytes and wires the size backstop. It is needed now because A1 is a launch-blocker (SPEC.1 §16.5) that must land before real participants exist (Sep 15).

This ADR does **not** decide:

- Participant/comment moderation substance — vendor, verdict shape, fail-closed posture, Redis reservation, idempotency-first ordering, CSAM short-circuit are unchanged (ADR-0014; SPEC.2 §10). This ADR adds a byte-binding precondition to that flow; it does not alter the gate.
- Admin market-media uploads — operator-curated trusted content written directly without moderation (ADR-0027), explicitly out of scope: the admin signed-PUT path is untouched.
- The `image_uploads` Bucket-B classification, the append-only ledger, or any schema shape (ADR-0005, SPEC.2 §12.5) — closed at the storage layer, no DDL.
- The future participant composer (MEDIA.3) — this ADR mints a hard precondition it must honour (AMD-3), but does not build it.

## Decision Drivers

1. **Legal floor (SPEC.1 §16.5).** The moderated bytes must be the served bytes, or the CSAM gate is bypassable. The binding must be unbypassable by a scripted client, not merely inconvenient.
2. **Fail-closed discipline (SPEC.2 §10).** Any new verification step that errors must block the bet, never pass — consistent with the moderation-fails-closed-on-legal-floor posture, never the rate-limit-fails-open posture.
3. **No held transaction across an HTTP call (SPEC.2 §9 / §10).** The binding must not introduce any DB transaction held across an R2 or OpenAI call.
4. **Append-only integrity (ADR-0005).** No in-place mutation of protected ground truth; any audit fingerprint rides the existing append-only `image_upload.committed` event payload, not a schema change.
5. **Real R2 / SDK enforceability.** The mechanism must be enforceable by real Cloudflare R2 + the pinned `@aws-sdk/client-s3`, not assumed from docs.
6. **Minimal critical-path surface.** Smallest change to the moderation and storage critical paths; render and moderation code unchanged if possible.

## Considered Options

1. **Write-once conditional PUT (`If-None-Match: "*"`) + pre-tx `HeadObject` backstop** ← chosen
2. Render-side `If-Match` on the read GET
3. Sealed-copy (`CopyObject` to an immutable second key; render from the copy)
4. Server-side SHA-256 content comparison
5. WORM / retention-lock the bucket

## Decision Outcome

**Chosen: Option 1 — write-once conditional PUT + pre-tx `HeadObject` backstop.**

Two primitives are ratified — one load-bearing for security, one for the size backstop + audit fingerprint:

**Primitive 1 — write-once immutability (the A1 security mechanism).** The participant signed PUT (`POST /api/uploads/sign` → `mintPutUrl`) is signed with `If-None-Match: "*"`. Because the SigV4 presigner keeps `if-none-match` as a **signed** header (in `X-Amz-SignedHeaders`), the client cannot drop it without invalidating the signature; R2 receives it as a real conditional-create header. The first PUT creates the object; every subsequent PUT to that key returns **412 Precondition Failed**. The object is therefore **immutable from first write** — the bytes §10 moderation reads are, by construction, the bytes render serves. This is physical immutability, not an ETag comparison. The admin market-media signed-PUT path passes no `ifNoneMatch` option and is unchanged (ADR-0027 — trusted, unmoderated).

**Primitive 2 — pre-moderation `HeadObject` verify (wires A10 + records the fingerprint).** Before §10 moderation runs, `verifyUploadedObject(key)` issues one `HeadObject` against the uploaded key and: (a) rejects if the real `ContentLength > IMAGE_UPLOADS_MAX_BYTES` (A10 — the §12.3 backstop, now wired, **fail-closed**); (b) rejects if the object is missing or R2 is unavailable (**fail-closed** — `StorageObjectMissingError` / `StorageUnavailableError` propagate); (c) captures the real ETag + byte size, recorded into the append-only `image_upload.committed` event as the moderated object's forensic fingerprint. It runs **pre-transaction** and **outside** any DB transaction (no HTTP-in-tx). No bet transaction opens until the verify passes.

**Minted error codes** (for the forward `docs/specs/error-codes.md` catalogue per §15 discipline; aggregated with the other in-scope-but-unenumerated codes):
- `error_image_oversize` — HTTP **400**, `error_type: validation_error`. Real R2 object exceeds `IMAGE_UPLOADS_MAX_BYTES` (A10).
- `error_storage_object_missing` — HTTP **400**, `error_type: validation_error`. Referenced upload has no physical R2 object (see RULING).
- (`error_storage_unavailable` — HTTP 503, existing per §12.8 — reused for the R2-unavailable verify arm.)

**RULING — missing-object status is 400, not 409.** In the sign → PUT → place flow, a missing object at place time means the client referenced an upload it did not complete (or replayed a stale/foreign `image_uploads_id`) — a bad request, not a conflict with existing resource state. 400 is chosen because: (i) the root cause is client-side; (ii) it is symmetric with `error_image_oversize` → 400 `validation_error` (both are invalid image references — one client bucket); (iii) in this codebase 409 `conflict` denotes a clash with existing/in-flight state (idempotency in-flight, body mismatch, moderation in-flight), which an absent object is not; (iv) there is no legitimate eventual-consistency case — the contract has the client await the PUT 200 before calling place, so missing-at-place is a contract violation, and 409 would falsely imply retrying the same request may succeed without re-upload.

**AMENDMENT 2 (required) — ETag is a forensic fingerprint, NOT a security primitive.** R2's ETag is MD5-based for a single PUT (collision-weak); R2 exposes no SHA-256. Security rests **solely** on Primitive 1 (write-once immutability). No downstream check may treat ETag equality as a security control; the captured ETag exists only as a CSAM paper-trail entry in the append-only log.

**AMENDMENT 3 (required) — MEDIA.3 composer precondition.** The future participant image composer (MEDIA.3) **must** send `If-None-Match: *` on its PUT and treat a 412 as idempotent-success. This is a hard MEDIA.3 precondition recorded here, not an aside: the security guarantee is void if a later uploader arms the participant PUT without it.

**AMENDMENT 4 — re-signing cannot bypass write-once.** Keys are server-generated per sign; the participant sign path now always sets `ifNoneMatch`; there is no client-side DELETE. A re-signed URL therefore still yields a conditional PUT that 412s against the existing object.

Consequences for adjacent spec (same commit): SPEC.2 §12.3 (write-once binding clause + backstop upgraded from conceptual to wired), §12.2 (step 5 notes the pre-moderation verify), §10 (moderated object immutable between moderation and render), §22 (ADR-Index entry); SPEC.1 §16.5 (compliance bullet: swap window closed at the storage layer).

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Write-once PUT arming + HeadObject ETag return | `src/server/storage/r2.ts` |
| Pre-moderation object verify (size backstop + fingerprint, fail-closed) | `src/server/storage/verify-object.ts` |
| Participant signed-PUT mint (opts in to write-once) | `src/app/api/uploads/sign/route.ts` |
| Pre-tx verify wiring + error mapping | `src/app/api/bets/place/route.ts` |
| `image_upload.committed` payload (etag + byteSizeActual) | `src/server/bets/place.ts` + `src/server/events/schemas.ts` |

## Consequences

### Positive

- Closes the A1 CSAM/gore swap window at the storage layer, by construction — moderated bytes ≡ rendered bytes with no runtime comparison.
- Wires the A10 real-byte size cap that was specified but dead; `byte_size` is no longer trust-the-client.
- Records a per-image ETag + real-size fingerprint into the append-only log — a CSAM paper trail for post-hoc audit.
- No DDL, no migration, no protected-table churn; the fingerprint rides the existing JSONB payload.
- Render (`load-debate-view.ts`) and moderation (`precommit.ts`/`openai.ts`) are unchanged — the fix is confined to the storage seam.
- The client contract is free to arm now (no participant uploader exists yet), becoming a hard MEDIA.3 precondition.

### Negative

- A pre-moderation `HeadObject` adds one R2 round-trip per image-attached submit. *Acceptable because:* it is a metadata HEAD (not a byte fetch), runs outside any transaction, and wires an already-specified backstop.
- Security rests on R2 honouring `If-None-Match` conditional-create. *Mitigated by:* the HARD staging-412 deploy gate — no production deploy until a real 412 is demonstrated against real R2.
- The captured ETag is MD5 (collision-weak). *Acceptable because:* it is explicitly a forensic fingerprint, never a security control (AMD-2).
- A future uploader could silently break the guarantee by omitting `If-None-Match: *`. *Mitigated by:* AMD-3 records it as a hard MEDIA.3 precondition + a §10/§12.3 contract.

### Neutral

- The `image_uploads` Bucket-B classification, the orphan sweep, and the read-side rendering TTL are untouched.
- An optional queryable `image_uploads.etag` column is a future analytics follow-up (would invoke `db-migration-reviewer`); not in scope.

## Pros and Cons of the Options

### Option 1 — Write-once conditional PUT + pre-tx HeadObject (chosen)

**Pros**
- Physical immutability ⇒ moderated bytes ≡ served bytes by construction; no comparison to get wrong.
- The conditional header is signed ⇒ the client cannot strip it.
- One HeadObject serves both A10 (size backstop) and the A1 audit fingerprint.
- No DDL; render + moderation untouched.

**Cons**
- Relies on real-R2 enforcement of `If-None-Match`. *Mitigated by:* the hard staging-412 deploy gate.

### Option 2 — Render-side If-Match on the read GET

**Cons**
- A browser `<img>` never sends `If-Match`; a signed-with-If-Match read URL would 403 every image load. **Verdict:** Rejected — breaks rendering.

### Option 3 — Sealed-copy to an immutable second key

**Cons**
- Adds a `CopyObject` round-trip + a second key namespace + MD5-ETag reliance for a strictly weaker guarantee — the client already cannot write to any key but the one presigned, so immutability ≡ sealing. **Verdict:** Rejected — more moving parts for no added guarantee.

### Option 4 — Server-side SHA-256 comparison

**Cons**
- R2 exposes no server-side SHA-256; would require the server to fetch and hash bytes in the request path. **Verdict:** Rejected — capability R2 lacks; heavier path.

### Option 5 — WORM / retention-lock the bucket

**Cons**
- Only narrows the window and blankets un-moderated staging objects under retention. **Verdict:** Rejected — coarse; does not bind moderated↔served.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §16.5 | CSAM legal floor | Consumes — swap-after-approval window closed at the storage layer |
| SPEC.2 §10 | pre-commit moderation, fail-closed | Consumes/shapes — adds a byte-binding precondition; the verify step is fail-closed like the gate |
| SPEC.2 §12.3 | signed-PUT mint + byte-size backstop | Shapes — arms write-once on the participant PUT; wires the HeadObject size backstop |
| SPEC.2 §12.2 | F-COMMENT-3 flow | Shapes — a pre-moderation verify precedes the moderation call |
| SPEC.2 §9 | no HTTP-in-tx | Consumes — the verify runs outside any transaction |
| ADR-0005 | append-only Bucket A/B | Consumes — fingerprint rides the existing `image_upload.committed` payload; no protected-table DDL |
| ADR-0014 | pre-commit moderation flow | **Amends** — adds the moderated-byte-binding contract |
| ADR-0026 / ADR-0027 | shared presign primitive; admin path | Consumes — admin market-media path explicitly excluded (trusted/unmoderated) |
| Tracker | AUDIT-FIX-A1 (+A10) | Unblocked against this ADR being `accepted` |

## More Information

- Cloudflare R2 conditional operations: `If-None-Match` on PutObject (conditional-create → 412); `If-Match` on Get/Head.
- `@aws-sdk/client-s3` SigV4 presigner: `if-none-match` retained as a signed header in `X-Amz-SignedHeaders`.
- AUDIT.1 master report (findings A1 / A10); AUDIT-FIX-A1 plan-of-record.

---

*ADR-0028 ratifies that a participant image is bound to its moderated bytes by write-once immutability on first write (`If-None-Match: *` conditional PUT), so moderated bytes ≡ rendered bytes by construction, with a pre-transaction fail-closed `HeadObject` enforcing the real object-size backstop (A10) and recording the ETag forensic fingerprint into the append-only `image_upload.committed` event. Security rests solely on write-once immutability; the ETag is never a security control. The decision body and the constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
