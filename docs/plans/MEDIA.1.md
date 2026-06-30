# MEDIA.1 — Admin market-media creation

> **Status:** drafted (aligned to ADR-0027, 2026-06-30 — admin-media moderation design removed)
> **Date:** 2026-06-30
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — schema/DDL (`src/db/schema/`, `drizzle/migrations/`) + the admin boundary (`src/server/admin/`, the admin signed-PUT route) per CLAUDE.md §1. **This slice does NOT touch the moderation pipeline** (`src/server/moderation/`) — ADR-0027 made admin market-media direct-upload, unmoderated.
> **Plan PR / commit:** Phase-1 commits on `feat/media-1-admin-create` (initial · Q1–Q3 resolution · ADR-0027 alignment).

> **Context (ADR-0027, 2026-06-30):** This plan is revised to align with **ADR-0027** — admin market-media is **operator-curated, direct-upload, NOT moderated** (the moderation pipeline gates untrusted user-generated content; the admin is structurally not a participant, F-AUTH-ADMIN). **`src/server/moderation/precommit.ts` is untouched by this slice.** All moderation design from the prior revision — the admin-context moderation caller, the shared verdict-helper extraction, moderate-first ordering, the moderation read-back, `media_moderation_blocked`, the `mod_reason` enum addition, the Q1 consequence-equivalence design, and the reject-path safety adds — is **removed**. Upload hygiene that is NOT moderation (file-type/size validation on the signed-PUT) is retained.

---

## Tracker context

No tracker row was supplied (the vN tracker is operator-maintained external HTML). MEDIA.1 is the
**admin-upload** build task of ADR-0026's three (display · **admin-upload** · composer-pick), now governed by
**ADR-0027** for the moderation posture. Authoritative sources: **ADR-0027** (accepted 2026-06-30 — no admin
moderation; supersedes ADR-0026 §D4) · **ADR-0026** (the data model / R2 arm / video model, unaffected) ·
**SPEC.1 §15 F-ADMIN-1** (the media clause, as amended at SPEC.1 1.0.12) · **SPEC.2 §5.1** (`market_media` #23
+ Appendix B.16) · **§12.1** (third R2 arm) · **§4.3** (admin-upload forward-note, as amended at SPEC.2
1.0.13). Recon grounding: `main@f8f4fe9` (read-only, all 9 items verified).

**Declared dependencies at plan time:**
- **ENGINE.14/15** (`createMarket` + `createMarketAction` + the admin wire `actor.ts`/`wire.ts`) — **done**;
  this is the F-ADMIN-1 surface we extend.
- **DEBATE.4** (PR #163, `4d83231`) — **done**; the participant debate-view render. **Not a prerequisite**
  here (composer-pick + carousel display are separate later slices).
- Participant image stack (`/api/uploads/sign`, `signUploadAndInsert`, `r2.ts`) — **done**; this slice
  **forks** the participant signed-PUT (admin has no `users` row) and reuses `mintPutUrl` with a third bucket
  arm. The participant **moderation** stack (`precommit.ts`, `consequences.ts`, `openai.ts`) is **not** used or
  touched by this slice (ADR-0027).

## Approach (one paragraph)

Add admin-set per-market media at create. The admin create-form pre-generates the market's UUIDv7 id at
init, uploads each image **out-of-band** (browser→R2 direct, bytes never touch the server, per SPEC.1 §15 /
K3) via a new **admin-context signed-PUT route** forked from the participant one, then on submit the extended
`createMarketAction` validates (Q3 UUIDv7 check; ≥1 image + exactly one `is_default`; optional video URL) and
opens **one** transaction inserting the `markets` row (under the pre-generated id, a **strict insert-only**),
the `market_media` rows, and the (payload-extended) `market.created` event. Per **ADR-0027**, market-media is
operator-curated trusted content and is **not** moderated — there is **no moderation gate before the write, no
external HTTP inside the tx, and no `precommit.ts` involvement**. Media is a §15 **service invariant** (≥1
image, exactly one `is_default`) enforced at create as service-required **validation**, not moderation.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no | This slice writes no bets/comments. | n/a |
| 2.2 Dharma non-transferable (INV-2) | no | No `dharma_ledger` write; admin has no `users` row. | n/a |
| 2.3 Side frozen at comment-time (INV-3) | no | No comments touched. | n/a |
| 2.4 Resolutions append-only (INV-4) | no | No resolution touched. | n/a |

**This slice is critical-path due to the migration/DDL + the admin boundary — NOT the moderation pipeline**
(ADR-0027 removed moderation from this path). New invariant-class concerns:

- **§15 "markets always have media" service invariant.** ≥1 image + exactly one `is_default`, enforced at
  create (and re-asserted at `Draft→Open` in a later slice). *Concrete corruption:* a live market with no
  media ⇒ the §9 carousel has no empty-state. **Mechanism:** service guard (`media_required` /
  `default_media_required`) + the partial unique index (DB backstop). **Test:** `…::media-required` +
  `…::exactly-one-default`.
- **Create atomicity (market + media + event) + strict insert-only (admin boundary).** The three writes commit
  together under the pre-generated id or not at all; the `markets` insert **rejects** on a PK conflict (never
  upserts). *Concrete corruption:* a `markets` row with no `market_media` rows, OR a client-supplied existing
  `marketId` mutating another market's row. **Mechanism:** single `db.transaction` (W-4 spine); plain INSERT,
  no `onConflict` clause. **Test:** `…::create-is-atomic` + `…::supplied-existing-marketId-rejects`.

---

## 2. Data model changes

**Migration `0019_market_media` (head `0018`→`0019`) — `market_media` table + `markets.media_video_url` ONLY:**

- **New table `market_media`** (Bucket **C** — mutable; **no** append-only trigger), per SPEC.2 Appendix B.16:
  - `id` uuid PK `default uuidv7()`
  - `market_id` uuid NOT NULL, FK→`markets.id` **`ON DELETE RESTRICT`**, indexed (FK-on-referencing-side)
  - `r2_object_key` text NOT NULL (`m/<marketId>/<mediaId>.<ext>` namespace, §12.1)
  - `display_order` int NOT NULL
  - `is_default` boolean NOT NULL
  - `created_by` text NOT NULL default `'admin-singleton'` (§3.6; **no `user_id`** — admin-owned)
  - `created_at` timestamptz NOT NULL default `now()`
- **Partial unique index (OD-5):** `CREATE UNIQUE INDEX market_media_one_default_per_market_uq ON market_media (market_id) WHERE is_default` — DB backstop for exactly-one-default (service enforces at create).
- **`markets.media_video_url`** — new **nullable** text column (outbound YouTube URL; display slice consumes it).
- **No `modReasonEnum` change.** ADR-0027 — there is no admin moderation, so no reject, no audit row, no new
  `mod_reason` value. `src/db/schema/audit.ts` is **untouched** by this slice.
- **Same-commit SPEC.2 grep-verify** (Appendix B.16 + §5.1/§5.2 counts landed at 1.0.12; confirm).
  drizzle-zod insert/select schemas added for `market_media`. **No drizzle-kit exclusion change** (`events`
  exclusion untouched).

**Deferred to the composer-pick slice (OD-3) — NOT in 0019:** `comments.market_media_id` + the not-both-set
`CHECK`. *Slice discipline: land schema with the code that wires/tests it.* **Expected gap, not drift:**
SPEC.2 §5.1 + Appendix B already describe `comments.market_media_id` ahead of its schema; the
`@db-migration-reviewer` will see it in the spec inventory without a column — that is **expected**, closed by
the pick slice's own migration, and must **not** be "corrected" here.

## 3. API surface

**1. `POST /api/admin/markets/media/sign` — NEW route handler (OD-4).** Greenfield `src/app/api/admin/…`
(this slice stands up `src/app/api/admin/` for the first time — one-time cost). **Forked** from
`src/app/api/uploads/sign/route.ts` (do **not** reuse — the participant route is hard-bound to a `users` row).
- Auth: **admin session** via `requireAdminSession()` (`src/server/admin/wire.ts`); 401/`admin_session_required` otherwise.
- Origin allowlist (`checkOrigin`); **per-IP rate cap** (new `adminMediaPutUrlPerIp` analog of
  `imagePutUrlPerIp`, reusing the `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` pattern — anti-abuse on the URL-mint,
  not moderation).
- Body: `{ marketId, contentType, byteSize }` (zod; `marketId` validated as a **well-formed UUIDv7** — it is
  the client-supplied pre-generated PK, a trust boundary, Q3). **Upload hygiene (file-type/size) validation**
  reuses `IMAGE_UPLOADS_ALLOWED_MIME` / `IMAGE_UPLOADS_MAX_BYTES` (basic validation, not moderation).
- **DB-free** (unlike `signUploadAndInsert`): mints `mintPutUrl("market-media", "m/<marketId>/<mediaId>.<ext>", …)` with a **server-generated `mediaId`** (the client supplies only `marketId` / `contentType` / `byteSize`, **never** the `mediaId` or object key) and returns `{ mediaId, putUrl, key }`. No `market_media` row at upload time (the row is written in the create tx).

**2. `createMarketAction` (extended Server Action, `src/server/admin/markets/create.ts`) — clean transactional
create, no moderation.** Adds to the zod schema: `marketId` (UUIDv7), `media: [{ mediaId, key, displayOrder,
isDefault }]` (≥1, exactly one `isDefault`), `mediaVideoUrl` (optional, validated). Flow: **validate →** (Q3
UUIDv7 check) **→ call extended `createMarket`**. There is **no moderation step, no per-image moderation call,
no moderation read-back, no reject path**. New error codes: `media_required` · `default_media_required` ·
`video_url_invalid` (mapped in `toActionError`). **`media_moderation_blocked` is not minted** (ADR-0027).

**3. `createMarket` (extended service, `src/server/markets/create.ts`) — strict insert-only (Q3, load-bearing).**
Gains a **required `marketId`** arg (the pre-generated UUIDv7), validated as well-formed UUIDv7 at entry and
inserted via `.values({ id: marketId, … })`. The insert is a **plain INSERT with NO `onConflict` clause** — a
PK conflict (supplied id already exists) **rejects** (the 23505 is caught and surfaced as a typed `MarketIdConflictError` → error code **`market_id_conflict`** via `toActionError`, mirroring the `slug_taken` pattern — a **mapped error, never a raw 500**),
**never** upserts/overwrites, so a supplied existing/arbitrary `marketId` cannot touch any existing market's
data. In the existing W-4 tx, after the `markets` insert it inserts the `market_media` rows and emits the
**payload-extended** `market.created` (OD-2). The tx contains **no external HTTP** (no moderation, no R2 hop).
*(Fallback if the auditor is uncomfortable with the client-supplied PK: server-mint the id at the sign endpoint
and thread it back — cleaner but heavier; not required given insert-only + UUIDv7 validation.)*

**4. Events (OD-2): NO new EVENT_TYPE (stays 23).** Extend `eventPayloadSchemas['market.created']`
(`src/server/events/schemas.ts:176`) with the media manifest (image keys + `display_order` + `is_default`)
and `mediaVideoUrl`; `createMarket`'s existing `insertEvent(... "market.created" ...)` passes it. No new
`aggregate_type`. The create path writes no `admin_events` row today; that stays.

**`precommit.ts` is UNTOUCHED by this slice (ADR-0027).** No admin-context moderation caller is built; no
shared verdict-mapping helper is extracted; `src/server/moderation/**` is neither imported nor modified here.
The participant image-moderation pipeline (F-COMMENT-3 / §10 / ADR-0014) is entirely separate and unaffected.

## 4. UI / user flow

**Single-page admin create-form** at `src/app/(admin)/admin/markets/new/page.tsx` (extends the existing RSC
form). **The D-15.e zero-client-JS posture is intentionally broken here — SPEC-MANDATED, not optional**
(SPEC.1 §15 requires out-of-band signed-PUT: browser→R2 direct, server bypassed for bytes, per K3; ADR-0027
did not change the upload mechanism, only removed the moderation step). Flow:

1. Form init pre-generates the market UUIDv7 (`v7()`), held in a hidden field / client state.
2. For each chosen image: client `POST /api/admin/markets/media/sign` → browser `PUT`s bytes to R2 at
   `m/<marketId>/<mediaId>.<ext>`. UI tracks `{ mediaId, key, displayOrder, isDefault }`; one `is_default`
   radio across the set; optional video-URL text field.
3. On submit: `createMarketAction(formData)` **validates** then creates (one tx). Success → redirect
   `/admin/markets/<marketId>?ok=created`; failure → redirect back with `?error=<code>`.

**Wireframe:** multi-image picker + per-image default-radio + optional video URL, appended to the existing
slug/title/description/deadline fields. Pixel layout is admin-utility (no design-mockup dependency).

## 5. Failure modes

- **Form abandonment / unsubmitted-upload orphans (Q2, accepted residual — simplified under ADR-0027).** Images
  PUT to R2 before any DB row exists; on abandonment the uploaded objects have no DB ref. The `market-media`
  bucket has **no orphan sweep** (SPEC.2 §12.1, deliberate), so an uploaded-but-never-submitted admin image may
  **orphan** indefinitely. **Accepted residual:** the **same upload-before-DB-write property** as the
  participant out-of-band path; near-moot under the single-trusted-operator model (the create-form is the only
  admin upload path); the bucket holds operator-curated content only. **There is no moderation-reject cleanup
  branch** — ADR-0027 removed moderation, so nothing is scanned or deleted-on-reject. Closing the orphan gap
  later (e.g. a sweep, or eager scanning) is a separate decision, **not this slice**.
- **Mint-route abuse / signed-PUT flooding.** Detect: rate counter. Recover: per-IP cap ⇒ 429.
- **Client-supplied `marketId` (trust boundary, Q3 — load-bearing).** Validate UUIDv7 at the sign route + create
  action; `createMarket` is **strict insert-only** (no `onConflict`) so a supplied existing/arbitrary id
  **rejects** (→ `market_id_conflict`) and cannot mutate existing market data. **R2 facet:** the sign route
  generates `mediaId` **server-side** (the client cannot supply or target it), so a signed PUT cannot overwrite
  an existing object's key; and display is **`market_media`-row-driven** (an unreferenced object never surfaces
  in any market's carousel). So a signed-PUT minted under an existing/arbitrary `marketId` can at worst create a
  **harmless unreferenced orphan** (Q2-class), never overwrite or surface in an existing market's displayed
  media. `@security-auditor` verifies **both facets**: (a) the DB insert-only **rejects** a duplicate `marketId`,
  **and** (b) the R2 path **cannot overwrite or surface** existing-market media (server-gen `mediaId` +
  row-driven display).
- **Tx failure mid-write.** All-or-nothing rollback (market + media + event); the W-4 retry spine handles
  `40001/40P01`. The tx holds **no external HTTP** (ADR-0027 — no moderation hop), so the no-HTTP-in-tx rule
  (CLAUDE.md §3) is satisfied trivially.
- **Migrate-applied-before-deploy.** `market_media` + `markets.media_video_url` are **additive** (expand); old
  code ignores them — safe under expand/contract + migrate-before-serve (ADR-0024).

## 6. Edge cases

- 0 images submitted → `media_required`.
- 0 or ≥2 images flagged `is_default` → `default_media_required`.
- Disallowed MIME / oversize → rejected at the sign route (reuse `IMAGE_UPLOADS_*` — upload hygiene).
- Invalid / non-YouTube video URL → `video_url_invalid` (no row).
- `mediaVideoUrl` omitted → NULL (valid; video link is optional).
- Duplicate slug (existing path) → `slug_taken`.
- Client supplies an **existing** `marketId` → strict-insert **rejects** (no overwrite); arbitrary non-UUIDv7
  id → validation reject.
- Re-submit after a validation failure (e.g. `video_url_invalid`): images already in R2 under the same
  `marketId` are reused — no re-upload needed.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/unit/`) | `mediaVideoUrl` validation; manifest validation (exactly-one-default, ≥1 image) | §15 media invariant (validation) |
| Integration (`tests/integration/` + `tests/server/admin/`) | `market_media` Bucket-C insert; partial-unique one-default-per-market (2nd default → 23505); **all-pass → market + media + `market.created` (extended payload) in one tx**; **strict insert-only: a supplied existing `marketId` rejects and leaves the existing market unchanged**; admin-gate on the sign route (401 without session); per-IP rate cap; client `marketId` UUIDv7 validation; `media_required` / `default_media_required` / `video_url_invalid` service errors **— each asserting NO `markets` row AND no `market_media` rows persisted (half-tests discipline)**; **create emits the EXISTING `market.created` event carrying the media manifest in its payload, introducing NO new EVENT_TYPE / `aggregate_type` (EVENT_TYPES stays 23 — OD-2 invariant)** | §15 media invariant · create atomicity + insert-only · OD-2 |

**Critical-path coverage:** every §1 new-invariant concern has an assertion — `media-required`/
`exactly-one-default`, `create-is-atomic`, `supplied-existing-marketId-rejects`. **No moderation test items**
(ADR-0027 — nothing to moderate). Tests-first via `@test-writer` at Phase 2 start. Local gate:
`pnpm vitest run` full suite against Postgres `:54322`.

## 8. Out of scope

- **Composer-pick** (`comments.market_media_id`, the not-both-set `CHECK`, its migration, the F-COMMENT-3
  pick UI) — separate ritual-gated slice.
- **Header carousel display** + the outbound video-link button (the §9 display slice; `media_video_url` is
  stored here, rendered there).
- **The `Draft→Open` media re-assertion** (F-ADMIN-2) — a later touch; this slice enforces at create only.
- **Any moderation / scanning of admin market-media** — ADR-0027 decided admin media is operator-curated and
  **not** moderated; a future scan-all-hosted-images compliance regime would revisit ADR-0027, out of scope here.
- **The SPEC.2 phantom `POST /api/admin/uploads/sign` mislabel-fix** — a later SPEC sweep, not this PR (this
  route is `/api/admin/markets/media/sign`).
- **`market_media` curation edits** (reorder / change default post-create) — Bucket-C mutable, but the admin
  edit UI is not this slice.

---

## Open questions

**None at plan time.** Disposition of the three prior Phase-1 self-critique findings under ADR-0027:
- **Q1 (`mod_actions` reason + consequence-equivalence) — DISSOLVED by ADR-0027.** No admin moderation ⇒ no
  reject ⇒ no audit row, no `mod_reason` value, no consequence-equivalence requirement. Removed entirely.
- **Q2 (orphan hygiene) — STANDS, simplified.** No sweep; unsubmitted uploads may orphan (accepted, same as the
  participant out-of-band path). The moderation-reject-cleanup branch is gone. §5.
- **Q3 (client-supplied-PK hardening) — STANDS IN FULL.** Insert-only + UUIDv7 validation + `@security-auditor`
  verification. §3.3 / §5.

## ADRs needed

**None new.** **ADR-0027** decides the moderation posture (admin media not moderated; supersedes ADR-0026 §D4);
**ADR-0026** decides the data model / third R2 arm / outbound-video model (unaffected). The D-15.e client-JS
departure is **SPEC-mandated** (SPEC.1 §15 / K3). No `precommit.ts` change, no verdict-helper extraction, no
`modReasonEnum` addition — so no same-commit moderation amendment is needed for this slice.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The `mod_actions` reject-audit would need a `mod_reason` value; the 5 existing values all encode a participant/comment consequence. | **SUPERSEDED by ADR-0027** — admin media is not moderated, so there is no reject, no `mod_actions` audit, no `mod_reason` value. The enum addition is removed from migration 0019. (Record kept per template discipline.) |
| 1b | high | The admin reject path would have to be **consequence-equivalent** to participant track_a (esp. the CSAM external-report seam), or be a blind-spot route. | **SUPERSEDED by ADR-0027** — there is no admin moderation, no reject path, and therefore no consequence-equivalence requirement on this slice. The participant pipeline is untouched and fully intact. |
| 2 | low | OD-1 (upload-before-create) + DB-free mint + no `market-media` sweep ⇒ abandoned uploads orphan. | **STANDS (simplified):** accepted residual; no sweep; same upload-before-DB-write property as the participant path. The moderation-reject framing is gone (ADR-0027). §5. |
| 3 | low/medium | OD-1 makes `createMarket` accept a **client-supplied pre-generated PK** — a new trust boundary. | **STANDS IN FULL:** keep client UUIDv7 + validation; **harden** `createMarket` to strict insert-only (reject on PK conflict, never upsert) so an arbitrary/existing id can't touch existing data; `@security-auditor` verifies; server-mint noted as the heavier fallback. §3.3 / §5. |
| 4 | low | §12.1 "static lifecycle, no per-request mint" could read as forbidding the admin signed-PUT mint. | Clarified: "no per-request mint" is the **read** path (public-read CDN); the admin **write** path still mints a PUT at upload time. |
| 5 | low | `@db-migration-reviewer` may FAIL on `comments.market_media_id` appearing in SPEC.2 without a schema column (OD-3 defers it). | Documented §2 as the **expected** spec-ahead-of-schema gap the pick slice closes — must not be "corrected" here. |

**Coherence verdict (post-ADR-0027):** the plan is internally consistent and strictly simpler than the prior
revision. The create flow is a clean transactional insert (validate → strict-insert-only → one tx: market +
market_media + `market.created`) with **no external HTTP in the tx** and **no `precommit.ts` involvement**. The
load-bearing surviving hardenings are Q3 (client-supplied-PK → insert-only + UUIDv7 validation) and the §15
service invariant (≥1 image + one `is_default`, service-required validation + the partial unique index). The
critical-path ritual is now driven by the **migration/DDL + the admin boundary**, with `@security-auditor`
focused on the admin boundary + the Q3 client-supplied-PK boundary (not moderation). OD-3's deferral of
`comments.market_media_id` interacts with nothing here (no comments touched).

---

## References

- `CLAUDE.md` §1/§2/§3/§5/§6 — the contract (critical-path ritual, INV-1..4, refusal triggers, no-HTTP-in-tx).
- `AGENTS.md` §3/§6/§7 — stack patterns (schema home `src/db/`, Drizzle/Bucket conventions, server-only).
- `docs/adr/0027-admin-market-media-direct-upload.md` — **admin market-media is direct-upload, NOT moderated**
  (supersedes ADR-0026 §D4); the governing decision for this slice's moderation posture.
- `docs/adr/0026-market-media.md` — the data model / third R2 arm / outbound-video model (unaffected by 0027).
- `docs/specs/SPEC.1.md` §15 F-ADMIN-1 (media clause, as amended at 1.0.12) — error set + service invariant.
- `docs/specs/SPEC.2.md` §5.1 (`market_media` #23) · Appendix B.16 · §12.1 (third R2 arm) · §4.3 (admin-upload
  forward-note, as amended at 1.0.13).
- Recon: `main@f8f4fe9` (read-only). Files extended: `src/db/schema/markets.ts`, `drizzle/migrations/0019_*`,
  `src/server/markets/create.ts`, `src/server/admin/markets/create.ts`, `src/server/storage/r2.ts`,
  `src/server/events/schemas.ts`, `src/server/middleware/rate-limit.ts`,
  `src/app/api/admin/markets/media/sign/route.ts` (new), `src/app/(admin)/admin/markets/new/page.tsx`.
  **`src/server/moderation/**` and `src/db/schema/audit.ts` are NOT touched** (ADR-0027).
- Workflow: `docs/workflows/plan-then-execute.md` (Phase 2 runs in a fresh tab).
