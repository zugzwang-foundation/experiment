# MEDIA.1 — Admin market-media creation

> **Status:** drafted (Q1–Q3 self-critique findings resolved by operator ruling, 2026-06-30)
> **Date:** 2026-06-30
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — schema/DDL (`src/db/schema/`, `drizzle/migrations/`) + moderation (`src/server/moderation/`) per CLAUDE.md §1.
> **Plan PR / commit:** Phase-1 commits on `feat/media-1-admin-create` (initial + the Q1–Q3 resolution).

---

## Tracker context

No tracker row was supplied (the vN tracker is operator-maintained external HTML). MEDIA.1 is the
**admin-upload** build task of ADR-0026's three (display · **admin-upload** · composer-pick). Authoritative
sources: **ADR-0026** (accepted 2026-06-30, ceiling) · **SPEC.1 §15 F-ADMIN-1** (the media clause, lines
882-890) · **SPEC.2 §5.1** (`market_media` table #23 + Appendix B.16) · **§12.1** (third R2 arm, line 1196) ·
**§4.3** (admin-upload forward-note, line 425). Recon grounding: `main@f8f4fe9` (read-only, all 9 items
verified).

**Declared dependencies at plan time:**
- **ENGINE.14/15** (`createMarket` + `createMarketAction` + the admin wire `actor.ts`/`wire.ts`) — **done**;
  this is the F-ADMIN-1 surface we extend.
- **DEBATE.4** (PR #163, `4d83231`) — **done**; the participant debate-view render. **Not a prerequisite**
  here (composer-pick + carousel display are separate later slices).
- Participant image + moderation stack (`/api/uploads/sign`, `signUploadAndInsert`, `r2.ts`,
  `precommit.ts`, `consequences.ts::recordGateBlock`, `openai.ts`) — **done**; this slice **forks** the
  participant signed-PUT, **shares** the OpenAI `moderate()` call + a newly-extracted verdict-mapping helper,
  and makes the admin reject path **consequence-equivalent** to `recordGateBlock` (Q1).

## Approach (one paragraph)

Add admin-set per-market media at create. The admin create-form pre-generates the market's UUIDv7 id at
init, uploads each image **out-of-band** (browser→R2 direct, bytes never touch the server, per SPEC.1 §15 /
K3) via a new **admin-context signed-PUT route** forked from the participant one, then on submit the extended
`createMarketAction` **moderates every image first** (admin-context caller, image read back via
`mintReadUrl("market-media", …)`, reusing the OpenAI `moderate()` + a shared verdict-mapping helper) and —
**only on all-pass** — opens **one** transaction inserting the `markets` row (under the pre-generated id, a
**strict insert-only**), the `market_media` rows, and the (payload-extended) `market.created` event. Media is a
§15 **service invariant** (≥1 image, exactly one `is_default`) enforced at create. Any moderation fail ⇒ no
rows, plus an admin reject path that is **consequence-equivalent** to the participant track_a/track_b path
(audit + the CSAM external-report seam + R2 disposition), minus only the account-specific consequences that
can't apply to an account-less admin.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no | This slice writes no bets/comments. | n/a |
| 2.2 Dharma non-transferable (INV-2) | no | No `dharma_ledger` write; admin has no `users` row. | n/a |
| 2.3 Side frozen at comment-time (INV-3) | no | No comments touched. | n/a |
| 2.4 Resolutions append-only (INV-4) | no | No resolution touched. | n/a |

**New invariant-class concerns this slice DOES introduce (critical-path failure modes):**

- **CSAM legal floor (REFUSAL-2 / ADR-0026 #4) — moderate-before-write + consequence-equivalence.** If the
  admin-context caller is bypassed, the verdict mapping is wrong, **or the admin reject path is a softer route
  than the participant's** (e.g. it audits but never fires the CSAM external-report seam), a Track-A image
  could enter the public carousel and/or a CSAM image could go un-reported. *Concrete corruption:* a
  `sexual/minors` (or A2 adult-`sexual`+image) asset becomes public market context, or is silently dropped
  without the NCMEC-report signal the participant path emits. **Mechanism:** moderation runs **outside** and
  **before** the tx (CLAUDE.md §3 / ADR-0014); a non-`pass` verdict ⇒ no `market_media` row + the admin reject
  path mirrors `recordGateBlock`'s full consequence set (§3.4 / §5). **Test:**
  `…::track-a-image-never-enters-pool` + `…::admin-track-a-fires-csam-seam`.
- **§15 "markets always have media" service invariant.** ≥1 image + exactly one `is_default`, enforced at
  create (and re-asserted at `Draft→Open` in a later slice). *Concrete corruption:* a live market with no
  media ⇒ the §9 carousel has no empty-state. **Mechanism:** service guard (`media_required` /
  `default_media_required`) + the partial unique index (DB backstop). **Test:** `…::media-required` +
  `…::exactly-one-default`.
- **Create atomicity (market + media + event) + strict insert-only.** The three writes commit together under
  the pre-generated id or not at all; the `markets` insert **rejects** on a PK conflict (never upserts).
  *Concrete corruption:* a `markets` row with no `market_media` rows, OR a client-supplied existing
  `marketId` mutating another market's row. **Mechanism:** single `db.transaction` (W-4 spine); plain INSERT,
  no `onConflict` clause. **Test:** `…::create-is-atomic` + `…::supplied-existing-marketId-rejects`.

---

## 2. Data model changes

**Migration `0019_market_media` (head `0018`→`0019`):**

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
- **`modReasonEnum` += `market_media_blocked` (Q1, RESOLVED in-scope).** One new `mod_reason` value for the
  admin media-reject audit row. This is **this slice's own schema** (consumed + tested by the admin reject
  path), and does **not** conflict with OD-3 — OD-3 deferred the *pick slice's* `comments.market_media_id`, not
  "exactly two schema objects." The track distinction (track_a vs track_b) rides the **existing** `verdict`
  column (mod_actions has both `reason` and `verdict`), so one reason value + the verdict column is sufficient
  — no track-specific reason proliferation. Same-commit SPEC.2 Appendix-B / §8 enum amendment.
- **Same-commit SPEC.2 grep-verify** (Appendix B.16 + §5.1/§5.2 counts landed at 1.0.12; confirm + add the
  `mod_reason` value). drizzle-zod insert/select schemas added for `market_media`. **No drizzle-kit exclusion
  change** (`events` exclusion untouched).

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
  `imagePutUrlPerIp`, reusing the `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` pattern — safety-add).
- Body: `{ marketId, contentType, byteSize }` (zod; `marketId` validated as a **well-formed UUIDv7** — it is
  the client-supplied pre-generated PK, a trust boundary, Q3). MIME/size reuse `IMAGE_UPLOADS_ALLOWED_MIME` /
  `IMAGE_UPLOADS_MAX_BYTES`.
- **DB-free** (unlike `signUploadAndInsert`): mints `mintPutUrl("market-media", "m/<marketId>/<mediaId>.<ext>", …)` and returns `{ mediaId, putUrl, key }`. No `market_media` row at upload time (the row is written in the create tx after moderation).

**2. `createMarketAction` (extended Server Action, `src/server/admin/markets/create.ts`).** Adds to the zod
schema: `marketId` (UUIDv7), `media: [{ mediaId, key, displayOrder, isDefault }]` (≥1, exactly one
`isDefault`), `mediaVideoUrl` (optional, validated). Flow: validate → **moderate each image** (admin-context
caller, **before** any tx) → on all-pass call extended `createMarket`. New error codes:
`media_required` · `default_media_required` · `media_moderation_blocked` · `video_url_invalid` (mapped in
`toActionError`). On a reject: run the admin reject consequence path (§3.4 / §5) + return
`media_moderation_blocked`.

**3. `createMarket` (extended service, `src/server/markets/create.ts`) — strict insert-only (Q3).** Gains a
**required `marketId`** arg (the pre-generated UUIDv7), validated as well-formed UUIDv7 at entry and inserted
via `.values({ id: marketId, … })`. The insert is a **plain INSERT with NO `onConflict` clause** — a PK
conflict (supplied id already exists) **rejects** (23505 surfaced like the existing slug-taken pre-check),
**never** upserts/overwrites, so a supplied existing/arbitrary `marketId` cannot touch any existing market's
data. In the existing W-4 tx, after the `markets` insert it inserts the `market_media` rows and emits the
**payload-extended** `market.created` (OD-2). *(Fallback if the auditor is uncomfortable with the
client-supplied PK: server-mint the id at the sign endpoint and thread it back — cleaner but heavier; not
required given insert-only + UUIDv7 validation.)*

**4. Admin-context moderation caller + reject consequence path — NEW (`src/server/moderation/…`),
consequence-equivalent to `recordGateBlock` (Q1).** The caller mints
`mintReadUrl("market-media", key, READ_URL_TTL_SECONDS_MODERATION)` (**never** `signRead` — uploads-bound),
calls `moderate({ text: "", imageUrl })`, applies the **shared** verdict helper (image always present ⇒ A2
`image→track_a` ordering); **no** Redis reservation, **no** `u/<userId>/` gate. On a non-`pass` verdict the
create action plays `recordGateBlock`'s role and writes the **full equivalent consequence set**:
  - **`mod_actions` audit** — `reason='market_media_blocked'`, `verdict=track_a|track_b` (the track
    discriminant), `categories`=OpenAI scores, `image_r2_key`=the rejected key, `actor_id='admin-singleton'`,
    `target_market_id`=the marketId, all `target_user/comment/bet`=NULL, `blocked_text`=NULL.
  - **CSAM external-report seam** — on `track_a` + `sexual/minors`, fire the **identical**
    `captureMessage("csam_auto_report_pending")` Sentry signal (tagged with the admin `mod_action_id`) the
    participant path emits. *This is the load-bearing equivalence — the easiest blind-spot to ship.*
  - **R2 disposition** — delete the rejected object (`deleteObject("market-media", key)`). **Correction to
    the Q1 framing:** the participant path does **not** delete — it flips `image_uploads.terminal_state='blocked'`
    (sweep-exempt, retained as evidence in the **private** uploads bucket). The admin path has **no
    `image_uploads` row**, and the `market-media` bucket is **public-read** (§12.1), so retaining CSAM bytes
    there is unacceptable; the admin "block-from-serving" analog is therefore **never write a `market_media`
    row** (nothing references it → never served) **+ delete the object**. The divergence (delete-not-retain)
    is justified by the public bucket; the audit + CSAM seam carry the equivalence.
  - **Skipped (N/A to an account-less admin):** the participant `users.banned_at` auto-ban and the
    `image_uploads→'blocked'` flip — neither has a referent here.

**5. Shared verdict-mapping helper — extracted (REAFFIRM).** The inline `track_a`/`track_b`/`pass` A2 ordering
in `precommit.ts:144-154` is extracted to **one pure helper** consumed by both `precommitModerate` and the
admin caller — single source of truth for the CSAM ordering. Pure refactor of the participant path
(behavior-locked by existing precommit tests).

**6. Events (OD-2): NO new EVENT_TYPE (stays 23).** Extend `eventPayloadSchemas['market.created']`
(`src/server/events/schemas.ts:176`) with the media manifest (image keys + `display_order` + `is_default`)
and `mediaVideoUrl`; `createMarket`'s existing `insertEvent(... "market.created" ...)` passes it. No new
`aggregate_type`. The create path writes no `admin_events` row today; that stays.

## 4. UI / user flow

**Single-page admin create-form** at `src/app/(admin)/admin/markets/new/page.tsx` (extends the existing RSC
form). **The D-15.e zero-client-JS posture is intentionally broken here — SPEC-MANDATED, not optional**
(SPEC.1 §15 requires out-of-band signed-PUT: browser→R2 direct, server bypassed for bytes, per K3). Flow:

1. Form init pre-generates the market UUIDv7 (`v7()`), held in a hidden field / client state.
2. For each chosen image: client `POST /api/admin/markets/media/sign` → browser `PUT`s bytes to R2 at
   `m/<marketId>/<mediaId>.<ext>`. UI tracks `{ mediaId, key, displayOrder, isDefault }`; one `is_default`
   radio across the set; optional video-URL text field.
3. On submit: `createMarketAction(formData)` server-moderates each image then creates (one tx). Success →
   redirect `/admin/markets/<marketId>?ok=created`; failure → redirect back with `?error=<code>`.

**Wireframe:** multi-image picker + per-image default-radio + optional video URL, appended to the existing
slug/title/description/deadline fields. Pixel layout is admin-utility (no design-mockup dependency).

## 5. Failure modes

- **Moderation reject (Track A/B) — the CSAM floor (Q1, consequence-equivalent).** Detect: the admin-context
  caller returns non-`pass`. Recover: **no `markets`/`market_media` row** (tx never opens); run the full
  equivalent consequence set per §3.4 — `mod_actions` audit (track-distinguished via `verdict`), the
  **identical CSAM Sentry seam** on `track_a + sexual/minors`, and the R2 object delete; **skip** the N/A
  user-ban + `image_uploads` flip. All of this runs **outside any tx** (HTTP-outside-tx, CLAUDE.md §3). Return
  `media_moderation_blocked`. **`@security-auditor` specifically verifies the admin track_a path is
  consequence-equivalent to participant track_a (modulo the N/A ban) — that the CSAM external-report seam +
  full audit fire, NOT merely that delete+audit occurred.**
- **Form abandonment / partial-then-reject orphans (Q2, accepted residual).** Images PUT to R2 before any DB
  row exists; on abandonment or a rejected create the passed objects have no DB ref. **Best-effort:** the
  create action deletes **all** of the attempt's uploaded objects on a reject (it holds the keys). **Named,
  accepted residual:** because moderation runs at **submit/create — not at upload** — an uploaded-but-never-
  submitted admin image is **never moderated**, so an abandoned-form image (incl. a hypothetical CSAM one)
  can persist un-moderated in the **no-sweep** `market-media` bucket (SPEC.2 §12.1, deliberately no sweep).
  This is the **same upload-before-moderation property** as the participant out-of-band path — with the
  precise difference that the participant uploads bucket **has** a ≤2h orphan-sweep that reaps abandoned
  un-moderated uploads while `market-media` does not. **Near-moot** under the single-trusted-operator model
  (the create-form is the only admin upload path). `@security-auditor` acknowledges it as an **accepted
  residual consistent with the no-sweep posture**. Closing it later = eager per-image moderation at upload — a
  **separate decision, NOT this slice**.
- **Mint-route abuse / signed-PUT flooding.** Detect: rate counter. Recover: per-IP cap ⇒ 429.
- **Client-supplied `marketId` (trust boundary, Q3).** Validate UUIDv7 at the sign route + create action;
  `createMarket` is **strict insert-only** (no `onConflict`) so a supplied existing/arbitrary id **rejects**
  and cannot mutate existing market data. `@security-auditor` verifies a client supplying an arbitrary/existing
  `marketId` cannot affect any existing market.
- **Moderation HTTP failure.** Fail-**closed** (`ModerationUnavailableError`) ⇒ no create, error surfaced
  (ADR-0014).
- **Tx failure mid-write.** All-or-nothing rollback (market + media + event); the W-4 retry spine handles
  `40001/40P01`.
- **Migrate-applied-before-deploy.** `market_media` + `markets.media_video_url` + the new `mod_reason` value
  are **additive** (expand); old code ignores them — safe under expand/contract + migrate-before-serve
  (ADR-0024).

## 6. Edge cases

- 0 images submitted → `media_required`.
- 0 or ≥2 images flagged `is_default` → `default_media_required`.
- A Track-A (or A2 adult-`sexual`+image) asset → `media_moderation_blocked` + the full track_a consequence
  set (§3.4); **no row**.
- A Track-B asset → `media_moderation_blocked` + a `verdict=track_b` audit row + delete; **no row**.
- Disallowed MIME / oversize → rejected at the sign route (reuse `IMAGE_UPLOADS_*`).
- Invalid / non-YouTube video URL → `video_url_invalid` (no row).
- `mediaVideoUrl` omitted → NULL (valid; video link is optional).
- Duplicate slug (existing path) → `slug_taken`.
- Client supplies an **existing** `marketId` → strict-insert **rejects** (no overwrite); arbitrary non-UUIDv7
  id → validation reject.
- Re-submit after a reject: passed images already in R2 under the same `marketId` — re-moderated on resubmit.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/unit/`) | shared verdict-mapping helper (pass/track_a/track_b incl. A2 image ordering); `mediaVideoUrl` validation; manifest validation (exactly-one-default, ≥1 image) | CSAM-floor mapping |
| Integration (`tests/integration/` + `tests/server/admin/`) | `market_media` Bucket-C insert; partial-unique one-default-per-market (2nd default → 23505); **moderate-reject → no `markets` row + track-distinguished `mod_actions` row + R2 delete (mock)**; **admin track_a + `sexual/minors` fires the CSAM seam (mock Sentry) — consequence-equivalence, not merely delete+audit**; **all-pass → market + media + `market.created` (extended payload) in one tx**; **strict insert-only: a supplied existing `marketId` rejects and leaves the existing market unchanged**; admin-gate on the sign route (401 without session); per-IP rate cap; client `marketId` UUIDv7 validation | CSAM floor (incl. external report) · §15 media invariant · create atomicity + insert-only |

**Critical-path coverage:** every §1 new-invariant concern has an assertion — `track-a-image-never-enters-pool`,
`admin-track-a-fires-csam-seam`, `media-required`/`exactly-one-default`, `create-is-atomic`,
`supplied-existing-marketId-rejects`. Tests-first via `@test-writer` at Phase 2 start. Local gate:
`pnpm vitest run` full suite against Postgres `:54322`.

## 8. Out of scope

- **Composer-pick** (`comments.market_media_id`, the not-both-set `CHECK`, its migration, the F-COMMENT-3
  pick UI) — separate ritual-gated slice.
- **Header carousel display** + the outbound video-link button (the §9 display slice; `media_video_url` is
  stored here, rendered there).
- **The `Draft→Open` media re-assertion** (F-ADMIN-2) — a later touch; this slice enforces at create only.
- **Eager per-image moderation at upload** (would close the Q2 abandoned-un-moderated-image residual) — a
  separate decision, explicitly not this slice.
- **The SPEC.2 phantom `POST /api/admin/uploads/sign` mislabel-fix** — a later SPEC sweep, not this PR (this
  route is `/api/admin/markets/media/sign`).
- **`market_media` curation edits** (reorder / change default post-create) — Bucket-C mutable, but the admin
  edit UI is not this slice.

---

## Open questions

**None at plan time.** The three Phase-1 self-critique findings (Q1 `mod_actions` reason +
consequence-equivalence, Q2 orphan hygiene + named residual, Q3 client-supplied-PK hardening) are **RESOLVED**
by operator ruling (2026-06-30) — see the Self-critique table and §2 / §3.4 / §5.

## ADRs needed

**None new.** ADR-0026 already decides the data model, the third R2 arm, the admin-context moderation, and the
pick-from-pool reference model. The D-15.e client-JS departure is **SPEC-mandated** (SPEC.1 §15 / K3). The
verdict-mapping extraction is a refactor. The `modReasonEnum += market_media_blocked` addition lands as a
**same-commit SPEC.2 amendment** (Appendix-B / §8), not a new ADR.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The `mod_actions` reject-audit needs a `mod_reason` value; the 5 existing values all encode a participant/comment consequence. | **RESOLVED (operator):** add `market_media_blocked` to `modReasonEnum` in 0019 — in-scope (this slice's own schema; OD-3 only deferred the pick slice). Track distinction via the existing `verdict` column. §2. |
| 1b | high | **Substance beyond the enum:** the admin reject path must be **consequence-equivalent** to participant track_a, not a softer/blind-spot route — esp. the **CSAM external-report seam**, which a delete+audit-only implementation would silently drop. | **RESOLVED (operator):** §3.4 mirrors `recordGateBlock`'s full set (audit + CSAM Sentry seam + R2 disposition), minus the N/A ban + `image_uploads` flip. `@security-auditor` verifies equivalence (not merely delete+audit). |
| 2 | low | OD-1 (upload-before-create) + DB-free mint + no `market-media` sweep ⇒ abandoned/rejected attempts leave un-moderated objects; an abandoned image is **never** moderated (moderation is at submit). | **RESOLVED (operator):** best-effort delete-all-on-reject kept; the abandoned-un-moderated-image residual is **named + accepted** (same upload-before-moderation property as participant, but no ≤2h sweep here); auditor acknowledges. §5. |
| 3 | low/medium | OD-1 makes `createMarket` accept a **client-supplied pre-generated PK** — a new trust boundary. | **RESOLVED (operator):** keep client UUIDv7 + validation; **harden** `createMarket` to strict insert-only (reject on PK conflict, never upsert) so an arbitrary/existing id can't touch existing data; auditor verifies; server-mint noted as the heavier fallback. §3.3 / §5. |
| 4 | low | §12.1 "static lifecycle, no per-request mint" could read as forbidding the admin signed-PUT mint. | Clarified: "no per-request mint" is the **read** path (public-read CDN); the admin **write** path still mints a PUT at upload time. |
| 5 | low | `@db-migration-reviewer` may FAIL on `comments.market_media_id` appearing in SPEC.2 without a schema column (OD-3 defers it). | Documented §2 as the **expected** spec-ahead-of-schema gap the pick slice closes — must not be "corrected" here. |

**Coherence verdict:** the five rulings are mutually consistent. OD-1 (single-page, moderate-first) + OD-4
(DB-free mint route + create-action moderation) cohere — moderation runs outside/before the tx, all-pass ⇒ one
tx. The Q1 consequence-equivalence read surfaced one **correction** (participant track_a **retains** the
blocked object in a private bucket; the admin path **deletes** from the public bucket — a justified divergence,
with the audit + CSAM seam carrying the equivalence). OD-3's deferral of `comments.market_media_id` does not
interact with this slice's code (no comments touched); its only downstream is the documented reviewer-gap (#5).

---

## References

- `CLAUDE.md` §1/§2/§3/§5/§6 — the contract (critical-path ritual, INV-1..4, refusal triggers, no-HTTP-in-tx).
- `AGENTS.md` §3/§6/§7 — stack patterns (schema home `src/db/`, Drizzle/Bucket conventions, server-only).
- `docs/specs/SPEC.1.md` §15 F-ADMIN-1 (lines 882-890) — the media clause + error set + service invariant.
- `docs/specs/SPEC.2.md` §5.1 (`market_media` #23, line 527) · Appendix B.16 (lines 2811-2821) · §12.1
  (third R2 arm, line 1196) · §4.3 (admin-upload forward-note, line 425).
- `docs/adr/0026-market-media.md` — the decision this slice implements.
- `src/server/moderation/consequences.ts::recordGateBlock` — the **participant track_a consequence baseline**
  the admin reject path is made equivalent to (Q1).
- Recon: `main@f8f4fe9` (read-only). Files extended: `src/db/schema/{markets,audit}.ts`,
  `drizzle/migrations/0019_*`, `src/server/markets/create.ts`, `src/server/admin/markets/create.ts`,
  `src/server/storage/r2.ts`, `src/server/moderation/{precommit,consequences,openai}.ts` (+ new admin caller +
  shared verdict helper), `src/server/events/schemas.ts`, `src/server/middleware/rate-limit.ts`,
  `src/app/api/admin/markets/media/sign/route.ts` (new), `src/app/(admin)/admin/markets/new/page.tsx`.
- Workflow: `docs/workflows/plan-then-execute.md` (Phase 2 runs in a fresh tab).
