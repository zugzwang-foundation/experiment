# MEDIA.1 — Admin market-media creation

> **Status:** drafted
> **Date:** 2026-06-30
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — schema/DDL (`src/db/schema/`, `drizzle/migrations/`) + moderation (`src/server/moderation/`) per CLAUDE.md §1.
> **Plan PR / commit:** this commit (`plan: MEDIA.1 — admin market-media creation`)

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
- Participant image stack (`/api/uploads/sign`, `signUploadAndInsert`, `r2.ts`, `precommit.ts`,
  `consequences.ts`) — **done**; this slice **forks** (does not reuse) the participant signed-PUT and
  **shares** the moderation vendor call + a newly-extracted verdict-mapping helper.

## Approach (one paragraph)

Add admin-set per-market media at create. The admin create-form pre-generates the market's UUIDv7 id at
init, uploads each image **out-of-band** (browser→R2 direct, bytes never touch the server, per SPEC.1 §15 /
K3) via a new **admin-context signed-PUT route** forked from the participant one, then on submit the extended
`createMarketAction` **moderates every image first** (admin-context caller, image read back via
`mintReadUrl("market-media", …)`, reusing the OpenAI `moderate()` + a shared verdict-mapping helper) and —
**only on all-pass** — opens **one** transaction inserting the `markets` row (under the pre-generated id), the
`market_media` rows, and the (payload-extended) `market.created` event. Media is a §15 **service invariant**
(≥1 image, exactly one `is_default`) enforced at create; any moderation fail ⇒ no rows, the rejected R2
object is deleted, and a `mod_actions` audit row is written.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no | This slice writes no bets/comments. | n/a |
| 2.2 Dharma non-transferable (INV-2) | no | No `dharma_ledger` write; admin has no `users` row. | n/a |
| 2.3 Side frozen at comment-time (INV-3) | no | No comments touched. | n/a |
| 2.4 Resolutions append-only (INV-4) | no | No resolution touched. | n/a |

**New invariant-class concerns this slice DOES introduce (critical-path failure modes):**

- **CSAM legal floor (REFUSAL-2 / ADR-0026 #4) — moderate-before-write.** If the admin-context moderation
  caller is bypassed or the verdict mapping is wrong, a Track-A image could enter `market_media` and render
  in the public carousel. *Concrete corruption:* a `sexual/minors` (or A2 adult-`sexual`+image) asset becomes
  market context shown to all participants. **Mechanism:** moderation runs **outside** and **before** the tx
  (CLAUDE.md §3 / ADR-0014); a non-`pass` verdict ⇒ no `market_media` row + R2 object deleted + `mod_actions`
  row. **Test:** `tests/server/admin/markets-media.test.ts::track-a-image-never-enters-pool`.
- **§15 "markets always have media" service invariant.** ≥1 image + exactly one `is_default`, enforced at
  create (and re-asserted at `Draft→Open` in a later slice). *Concrete corruption:* a live market with no
  media ⇒ the §9 carousel has no empty-state and would crash/blank. **Mechanism:** service guard
  (`media_required` / `default_media_required`) + the partial unique index (DB backstop). **Test:**
  `…::media-required` + `…::exactly-one-default`.
- **Create atomicity (market + media + event).** The three writes commit together under the pre-generated id
  or not at all. *Concrete corruption:* a `markets` row with no `market_media` rows (violates the §15
  invariant) if the inserts aren't one tx. **Mechanism:** single `db.transaction` (the W-4 lifecycle wrapper
  spine). **Test:** `…::create-is-atomic`.

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
- **Same-commit SPEC.2 grep-verify** (Appendix B.16 + §5.1/§5.2 counts already landed at 1.0.12; confirm).
- **No drizzle-kit exclusion change** (`events` exclusion untouched). drizzle-zod insert/select schemas added.

**Deferred to the composer-pick slice (OD-3) — NOT in 0019:** `comments.market_media_id` + the not-both-set
`CHECK`. *Slice discipline: land schema with the code that wires/tests it.* **Expected gap, not drift:**
SPEC.2 §5.1 + Appendix B already describe `comments.market_media_id` ahead of its schema; the
`@db-migration-reviewer` will see it in the spec inventory without a column — that is **expected**, closed by
the pick slice's own migration, and must **not** be "corrected" here.

**Open interaction (see Open Questions Q1):** the §5 safety-add (audit a reject in `mod_actions`) needs a
`mod_reason` enum value; the candidate is adding `market_media_blocked` to `modReasonEnum` **in 0019**, which
extends OD-3's literal scope by one enum value. **Flagged — needs operator ruling before Phase 2.**

## 3. API surface

**1. `POST /api/admin/markets/media/sign` — NEW route handler (OD-4).** Greenfield `src/app/api/admin/…`
(this slice stands up `src/app/api/admin/` for the first time — one-time cost). **Forked** from
`src/app/api/uploads/sign/route.ts` (do **not** reuse — the participant route is hard-bound to a `users` row).
- Auth: **admin session** via `requireAdminSession()` (`src/server/admin/wire.ts`); 401/`admin_session_required` otherwise.
- Origin allowlist (`checkOrigin`); **per-IP rate cap** (new `adminMediaPutUrlPerIp` analog of
  `imagePutUrlPerIp`, reusing the `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` pattern — §5 safety-add).
- Body: `{ marketId, contentType, byteSize }` (zod; `marketId` validated as a well-formed UUIDv7 — it is the
  **client-supplied pre-generated PK**, a trust boundary). MIME/size reuse `IMAGE_UPLOADS_ALLOWED_MIME` /
  `IMAGE_UPLOADS_MAX_BYTES`.
- **DB-free** (unlike `signUploadAndInsert`): mints `mintPutUrl("market-media", "m/<marketId>/<mediaId>.<ext>", …)` and returns `{ mediaId, putUrl, key }`. No `market_media` row at upload time (the row is written in the create tx after moderation).

**2. `createMarketAction` (extended Server Action, `src/server/admin/markets/create.ts`).** Adds to the zod
schema: `marketId` (UUIDv7), `media: [{ mediaId, key, displayOrder, isDefault }]` (≥1, exactly one
`isDefault`), `mediaVideoUrl` (optional, validated). Flow: validate → **moderate each image** (admin-context
caller, **before** any tx) → on all-pass call extended `createMarket`. New error codes:
`media_required` · `default_media_required` · `media_moderation_blocked` · `video_url_invalid` (mapped in
`toActionError`). On a reject: delete the rejected R2 object + write the `mod_actions` row (§5) + return
`media_moderation_blocked`.

**3. `createMarket` (extended service, `src/server/markets/create.ts`).** Gains a **required `marketId`** arg
(the pre-generated UUIDv7) inserted via `.values({ id: marketId, … })` (today the DB default generates it),
plus the media set + `mediaVideoUrl`. In the existing W-4 tx, after the `markets` insert it inserts the
`market_media` rows and emits the **payload-extended** `market.created` (OD-2). A PK collision surfaces like
the existing slug-taken pre-check.

**4. Admin-context moderation caller — NEW (`src/server/moderation/…`).** Mints
`mintReadUrl("market-media", key, READ_URL_TTL_SECONDS_MODERATION)` (**never** `signRead` — that is
uploads-bound), calls `moderate({ text: "", imageUrl })` directly, applies the **shared** verdict mapping;
**no** Redis reservation, **no** `u/<userId>/` namespace gate (admin-context). Image always present ⇒ the A2
`image→track_a` ordering applies. Fail-closed on terminal error (`ModerationUnavailableError`).

**5. Shared verdict-mapping helper — extracted (REAFFIRM).** The inline `track_a`/`track_b`/`pass` A2 ordering
in `precommit.ts:144-154` is extracted to **one pure helper** consumed by both `precommitModerate` and the
admin caller — single source of truth for the CSAM ordering. Pure refactor of participant path (behavior-locked
by existing precommit tests).

**6. Events (OD-2): NO new EVENT_TYPE (stays 23).** Extend `eventPayloadSchemas['market.created']`
(`src/server/events/schemas.ts:176`) with the media manifest (image keys + `display_order` + `is_default`)
and `mediaVideoUrl`; `createMarket`'s existing `insertEvent(... "market.created" ...)` passes it. No new
`aggregate_type`. No `admin_events` row is written by the create path today; that stays.

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

- **Moderation reject (Track A/B) — the CSAM floor.** Detect: the admin-context caller returns non-`pass`.
  Recover: **no `markets`/`market_media` row** (tx never opens); **delete the rejected R2 object**
  (`deleteObject("market-media", key)` — a failed/CSAM asset must not linger; §12.1 has **no orphan sweep**);
  **write a `mod_actions` row** (`actor_id='admin-singleton'`, `target_market_id=<marketId>`, `verdict`,
  `categories` scores, `image_r2_key`, `reason=<see Q1>`) mirroring the participant `recordGateBlock` audit;
  return `media_moderation_blocked`. **The `mod_actions` write + R2 delete run OUTSIDE any tx** (HTTP-outside-tx).
- **Form abandonment / partial-then-reject orphans.** Images PUT to R2 before any DB row exist; on abandonment
  or a rejected create, the **passed** objects orphan (no DB ref, no sweep for `market-media`). **Accepted**
  for an admin-only, low-volume, pre-vetted path; **best-effort mitigation (Q2):** the create action deletes
  **all** of the attempt's uploaded objects on any reject (it holds the keys). Negligible storage over 50 days.
- **Mint-route abuse / signed-PUT flooding.** Detect: rate counter. Recover: per-IP cap (safety-add) ⇒ 429.
- **Client-supplied `marketId` (trust boundary).** The pre-generated PK comes from the browser. Validate as
  UUIDv7 at both the sign route and the create action; the `m/<marketId>/` key is admin-scoped (admin-gated
  route). A PK collision on insert → handled like slug-taken (internal error; UUIDv7 collision is negligible).
- **Moderation HTTP failure.** Fail-**closed** (`ModerationUnavailableError`) ⇒ no create, error surfaced;
  consistent with ADR-0014.
- **Tx failure mid-write.** All-or-nothing rollback (market + media + event); the W-4 retry spine handles
  `40001/40P01`.
- **Migrate-applied-before-deploy.** `market_media` + `markets.media_video_url` are **additive** (expand);
  old code ignores them — safe under the expand/contract + migrate-before-serve discipline (ADR-0024).

## 6. Edge cases

- 0 images submitted → `media_required`.
- 0 or ≥2 images flagged `is_default` → `default_media_required`.
- A Track-A (or A2 adult-`sexual`+image) asset → `media_moderation_blocked` + delete + audit; **no row**.
- Disallowed MIME / oversize → rejected at the sign route (reuse `IMAGE_UPLOADS_*`).
- Invalid / non-YouTube video URL → `video_url_invalid` (no row).
- `mediaVideoUrl` omitted → NULL (valid; video link is optional).
- Duplicate slug (existing path) → `slug_taken`.
- Re-submit after a reject: passed images already in R2 under the same `marketId` — re-moderated on resubmit
  (retry semantics noted in Q2).

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/unit/`) | shared verdict-mapping helper (pass/track_a/track_b incl. A2 image ordering); `mediaVideoUrl` validation; manifest validation (exactly-one-default, ≥1 image) | CSAM-floor mapping |
| Integration (`tests/integration/` + `tests/server/admin/`) | `market_media` Bucket-C insert; partial-unique one-default-per-market (2nd default → 23505); **moderate-reject → no `markets` row + `mod_actions` row + R2 delete (mock)**; **all-pass → market + media + `market.created` (extended payload) in one tx**; admin-gate on the sign route (401 without session); per-IP rate cap; client `marketId` UUIDv7 validation | CSAM floor · §15 media invariant · create atomicity |

**Critical-path coverage:** the three §1 new-invariant concerns each have an assertion
(`track-a-image-never-enters-pool`, `media-required`/`exactly-one-default`, `create-is-atomic`). Tests-first via
`@test-writer` at Phase 2 start. Local gate: `pnpm vitest run` full suite against Postgres `:54322`.

## 8. Out of scope

- **Composer-pick** (`comments.market_media_id`, the not-both-set `CHECK`, its migration, the F-COMMENT-3
  pick UI) — separate ritual-gated slice.
- **Header carousel display** + the outbound video-link button (the §9 display slice; `media_video_url` is
  stored here, rendered there).
- **The `Draft→Open` media re-assertion** (F-ADMIN-2) — a later touch; this slice enforces at create only.
- **The SPEC.2 phantom `POST /api/admin/uploads/sign` mislabel-fix** — a later SPEC sweep, not this PR (this
  route is `/api/admin/markets/media/sign`).
- **`market_media` curation edits** (reorder / change default post-create) — Bucket-C mutable, but the admin
  edit UI is not this slice.

---

## Open questions

- **Q1 — `mod_actions` reason for an admin media reject.**
  - **Candidate:** add `market_media_blocked` to `modReasonEnum` in migration 0019 (+ same-commit SPEC.2
    Appendix-B / §8 amendment); `actor_id='admin-singleton'`, `verdict=track_a|track_b`, `target_market_id`
    set, all `target_user/comment/bet` NULL. Reusing an existing reason would be semantically wrong (they
    imply a user-ban / published-comment block).
  - **Resolve with:** operator ruling **before Phase 2** (this nudges OD-3's "ONLY two things" migration scope
    by one enum value — flagged, not papered over).
- **Q2 — orphan hygiene on reject/abandonment.**
  - **Candidate:** create action best-effort deletes **all** of the attempt's uploaded R2 objects on any
    reject; abandonment orphans accepted as a known limitation (no `market-media` sweep, §12.1).
  - **Resolve with:** this plan §5 / confirm before Phase 2.
- **Q3 — verdict-mapping helper location.**
  - **Candidate:** `src/server/moderation/verdict.ts` (pure), imported by `precommit.ts` + the admin caller.
  - **Resolve with:** Phase 2.

## ADRs needed

**None new.** ADR-0026 already decides the data model, the third R2 arm, the admin-context moderation, and the
pick-from-pool reference model. The D-15.e client-JS departure is **SPEC-mandated** (SPEC.1 §15 / K3), not a
fresh architectural choice. The verdict-mapping extraction is a refactor. **If** Q1 is approved, the
`modReasonEnum` addition lands as a **same-commit SPEC.2 amendment**, not a new ADR.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The `mod_actions` reject-audit safety-add has no fitting `mod_reason` enum value; the 5 existing values all encode a participant/comment consequence. Cleanly representing it requires a `modReasonEnum` addition in 0019, beyond OD-3's literal scope. | Surfaced as **Open Question Q1** + flagged to operator; candidate `market_media_blocked` in 0019. Not resolved unilaterally — no lossy reuse in code. |
| 2 | low | OD-1 (pre-gen id + upload-before-create) + DB-free mint (OD-4) + no `market-media` orphan sweep (§12.1) ⇒ abandoned/rejected attempts orphan passed R2 objects. | Accepted known limitation (admin-only, tiny volume); best-effort delete-all-on-reject (Q2) in §5. The reject-object delete (CSAM) **is** required and covered. |
| 3 | low/medium | OD-1 forces `createMarket` to accept a **client-supplied pre-generated PK** — a new signature + a new trust boundary (the browser determines `markets.id`). | Addressed §3: validate UUIDv7 at the sign route + create action; PK-collision handled like slug-taken; `@security-auditor` to verify the trust boundary. |
| 4 | low | §12.1 "static lifecycle, no per-request mint" could read as forbidding the admin signed-PUT mint. | Clarified: "no per-request mint" is the **read** path (public-read CDN); the admin **write** path still mints a PUT at upload time. Documented so reviewers don't false-flag. |
| 5 | low | `@db-migration-reviewer` may FAIL on `comments.market_media_id` appearing in SPEC.2 §5.1/Appendix B without a schema column (OD-3 defers it). | Documented §2 as the **expected** spec-ahead-of-schema gap the pick slice closes — must not be "corrected" here. |

**Coherence verdict:** the five rulings are mutually consistent. OD-1 (single-page, moderate-first) + OD-4
(DB-free mint route + create-action moderation) cohere — moderation runs outside/before the tx, all-pass ⇒ one
tx. OD-3's deferral of `comments.market_media_id` does not interact with this slice's code (no comments
touched); its only downstream is the documented reviewer-gap (#5) and the Q1 enum-scope nudge.

---

## References

- `CLAUDE.md` §1/§2/§3/§5/§6 — the contract (critical-path ritual, INV-1..4, refusal triggers, no-HTTP-in-tx).
- `AGENTS.md` §3/§6/§7 — stack patterns (schema home `src/db/`, Drizzle/Bucket conventions, server-only).
- `docs/specs/SPEC.1.md` §15 F-ADMIN-1 (lines 882-890) — the media clause + error set + service invariant.
- `docs/specs/SPEC.2.md` §5.1 (`market_media` #23, line 527) · Appendix B.16 (lines 2811-2821) · §12.1
  (third R2 arm, line 1196) · §4.3 (admin-upload forward-note, line 425).
- `docs/adr/0026-market-media.md` — the decision this slice implements.
- Recon: `main@f8f4fe9` (read-only). Files extended: `src/db/schema/{markets,audit}.ts`,
  `drizzle/migrations/0019_*`, `src/server/markets/create.ts`, `src/server/admin/markets/create.ts`,
  `src/server/storage/r2.ts`, `src/server/moderation/{precommit,consequences,openai}.ts` (+ new admin caller +
  shared verdict helper), `src/server/events/schemas.ts`, `src/server/middleware/rate-limit.ts`,
  `src/app/api/admin/markets/media/sign/route.ts` (new), `src/app/(admin)/admin/markets/new/page.tsx`.
- Workflow: `docs/workflows/plan-then-execute.md` (Phase 2 runs in a fresh tab).
