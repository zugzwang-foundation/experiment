# ADR-0026 — Market Media (admin-set asset model, storage, pick-from-pool semantics, moderation posture, video)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-30 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | Market media — spec lane (this ADR + the F-ADMIN-1 / §display / SPEC.2 data-model riders authored in the same spec chat). The participant header display, the admin upload UI + route, and the composer pick-from-pool affordance are three separate **build** tasks. Tracker IDs to be regularized by the operator. |
| **Frame document** | SPEC.1 §15 F-ADMIN-1 (Market creation — amended: admin sets media); SPEC.1 F-COMMENT-3 (Bet+comment with image attachment — extended: pick-from-pool + default fallback); a new SPEC.1 Market-Detail display subsection (the carousel + outbound video affordance); SPEC.2 data model (`markets` + the new `market_media` table) and §4 API Surface (admin upload route — lands at build); SPEC.2 §22 (ADR Index). (Exact SPEC.1/SPEC.2 subsection numbers pinned at rider authoring against live text.) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Market media is **admin-curated, per-market context** — a small set of images (a chart, a news still, an explainer frame) plus a single explainer video — created by the operator **before** a market goes live and shown publicly on the Market Detail surface. It does double duty: (1) a header **carousel** of those images plus an outbound link to the operator's YouTube explainer; (2) a **pick-pool** — the same images are selectable inside the post/reply composer, so a participant who has a text argument but no relevant picture of their own can attach one, and if they attach nothing the market's **default** image fills the render slot. Image attachment on a comment is therefore **optional** (the slot always renders via a fallback chain), **not** mandatory.

Today this is entirely **unbuilt and unspecced** (live tree `af4a909`): `markets` carries no media column, no media table exists, no upload route exists, and `MarketHeader.tsx` shows only a dashed *"Market media — arrive with the market-content slice"* placeholder. So this ADR **invents** the feature rather than amending an existing one.

The forces at play: market media is an **admin-owned** asset, but the existing image substrate is **hard-bound to a participant account** — `image_uploads.user_id` is `NOT NULL → users`, and the signed-upload route `/api/uploads/sign` requires a participant session. The admin is structurally outside `users` (F-AUTH-ADMIN), so admin media **cannot** reuse the participant path as-is. Market media is also **publicly visible and participant-pickable**, which puts it squarely against the moderation guardrail: the pick path must not become a way to route unvetted bytes into a comment. And the operator's product steer is **smooth, low-latency UX** on every participant-facing path. The decision is needed now to unblock three downstream builds (the participant header display, the admin upload UI, the composer pick affordance) under the **"no code before a spec"** rule.

This ADR does **not** decide:

- The participant header **pixels** (carousel motion, layout) — owned by the header design-mockup task, then the display build [UI.4 area].
- The admin **upload UI** and the exact upload route/handler signature — owned by the admin-create build [UI.6 area]; lands in SPEC.2 §4 at build.
- The composer pick-affordance **pixels** — owned by the composer build.
- Number-tuned values (none are hard-pinned here).
- The **radio** music player's YouTube-embed-vs-self-host question (SPEC.1 §21.5) — a different feature; market-media video is an *outbound link*, not an in-app embed, and does not touch §21.5.
- The moderation **vendor / verdict mapping** (ADR-0014 / ADR-0021, unchanged) — this ADR adds an admin-context *caller* of the same pipeline; it does not change the pipeline.

## Decision Drivers

1. **Admin-vs-participant separation (thesis guardrail, data layer).** The admin has no `users` row and holds no position. Market media must not force a participant-shaped owner onto an admin asset, and must not blur the structural admin/participant boundary the thesis depends on.
2. **Moderation never bypassed (safety guardrail).** Admin media is publicly visible *and* participant-pickable. The design must make it impossible for a participant to attach unvetted bytes to a comment by "picking" an admin image. The pipeline is never weakened — including by omission.
3. **Low-latency, smooth UX (operator steer).** Participant hot paths — header render, opening the picker, the default fallback — must add **no runtime round-trips**. Assets are CDN-served and ride the existing market read; nothing is generated at request time; a *pick* must not trigger a post-time moderation round-trip.
4. **Reuse over reinvent.** Piggyback the existing `image_uploads` / R2 / CDN substrate and the `resolveImageAttachment` seam (`src/server/comments/image-attach.ts`); do not fork a parallel storage or moderation pattern.
5. **Credential / compromise isolation.** The two R2 clients (`uploads`, `pfp`) each carry distinct credentials so a leak in one cannot expose the others. A third asset class must **preserve** that property, not dilute it.
6. **Simplicity for a ~45-day experiment.** Lowest moving-part count that satisfies the guardrails.

## Considered Options

- **Data-model home:** a new `market_media` table *(chosen)* vs making `image_uploads.user_id` nullable + adding an owner-type discriminator.
- **Storage:** a new `market-media` R2 bucket arm with isolated credentials *(chosen)* vs a new `m/<marketId>/` prefix inside the existing `uploads` bucket vs reusing the `pfp` bucket.
- **Pick semantics:** the **reference model** — a separate nullable `comments.market_media_id` FK *(chosen)* vs **copy** — duplicating the picked bytes into a participant `image_uploads` row.
- **Moderation posture:** admin media **moderated at upload**, same pipeline *(chosen)* vs **admin-trusted**, unmoderated.
- **Video:** a single nullable `markets.media_video_url`, **outbound** (opens YouTube in a new tab) *(chosen)* vs an **in-carousel embedded** player vs **no** video.
- **Default image:** an `is_default` flag on one `market_media` row *(chosen)* vs a separate `markets.default_media_*` field.

## Decision Outcome

**Chosen across the forks above.** The following are ratified:

1. **New `market_media` table (the schema home).** One row per market-media image; one pool per market; **admin-owned, structurally separate from `image_uploads`**. Columns mirror the markets/pools conventions (ADR-0016): `id` UUIDv7 PK; `market_id` FK (FK-on-referencing-side + index, matching the `markets` insert conventions); `r2_object_key text`; `display_order int` (carousel order); `is_default boolean` (exactly one `true` per market — see #5); `created_by` defaulting to the `admin-singleton` actor; `created_at`. **No `user_id`** — this is the load-bearing separation: admin media never enters the participant-owned `image_uploads` namespace, so the participant moderation read-scope keyed on `u/<userId>/` stays clean and unambiguous.

2. **New R2 bucket arm `market-media`.** `R2Bucket` gains a third arm (`"uploads" | "pfp" | "market-media"`) with its own **isolated credentials**, preserving the compromise-isolation property (`pfp` is the precedent for an admin-owned, non-participant asset class with its own bucket). Key namespace `m/<marketId>/<mediaId>.<ext>` — distinct from the participant `u/<userId>/` namespace.

3. **Reference model for picks; image attachment is optional with a default fallback.** A comment's displayed image resolves by a three-step chain, **own upload → picked pool image → market default**, encoded as: a new nullable `comments.market_media_id` FK → `market_media`, **mutually exclusive** with the existing `comments.image_uploads_id` (a DB-level CHECK that the two are not both set). Render resolution = `image_uploads_id ?? market_media_id ?? (the market's is_default market_media row)`. The **default case stores nothing** — it is a read-time lookup of the `is_default` row, so a text-only comment costs **zero extra writes** and still renders an image. This keeps the two image sources on **two separate R2 read-scopes** (`u/<userId>/` for own uploads, `m/<marketId>/` for picks), resolving the read-scope collision the recon flagged. The pick path hooks the **existing** `resolveImageAttachment` seam (`src/server/comments/image-attach.ts`) that `bets/place` already calls — it is not a new seam.

4. **Admin-moderated at upload (safety-critical).** Admin market-media bytes run through the **same** image moderation (CSAM hash + general classifier) as participant uploads — but at **admin-upload time, pre-live**, via an **admin-context** moderation path. The current `precommitModerate()` is participant-session-bound; this ADR mints the requirement for an admin-context variant that moderates the bytes **without** a participant session (the build task owns the exact factoring). Because admin media is **pre-vetted**, a participant **pick** attaches an already-clean asset with **no post-time image-moderation round-trip** — the pick path is moderation-free **by construction**. This is simultaneously the **safety** property (a participant cannot route unvetted bytes into a comment by picking) and the **latency** property (picking is the *fast* image path — no upload, no moderation wait). A participant's **own** upload still runs the full pipeline (F-COMMENT-3, unchanged); a comment's **text** always runs text moderation regardless of image source (unchanged). The pipeline is never weakened — this ADR only adds a new, trusted-context **caller** of it.

5. **Default = one `is_default` row; markets always have media.** Exactly one `market_media` row per market carries `is_default = true`; it backs the render-fallback in #3. Carousel order is `display_order`. Markets **always** have media (the admin sets it pre-live), so there is **no empty-state path** — the header always renders a carousel and a default always exists.

6. **Video = single outbound YouTube link.** A single nullable `markets.media_video_url` column. The play affordance on the header **opens the URL in a new tab** — the video is hosted on YouTube and reached by **outbound link**, **not embedded** and **not self-hosted**. This resolves the legacy *"MARKET MEDIA — IMG / VIDEO"* placeholder into a precise treatment: **a carousel of images plus one outbound video-link button**, not videos *inside* the carousel. It is categorically distinct from the radio music player (SPEC.1 §21.5), which is an *in-app* YouTube IFrame embed for background audio; §21.5 is untouched and its embed-vs-self-host question does not apply here.

7. **Participant display (Market Detail header).** The dashed `MarketHeader.tsx` placeholder is replaced by an auto-advancing **carousel** of the market's images (`display_order`) plus the outbound **video-link** button. The recursive market→post shell is **unchanged**: in post-view the same slot still shows the *post's* single image (`image_uploads_id`), not the market carousel. The carousel/video pixels are owned by the design-mockup → display-build task (see #9).

8. **Latency posture (operator steer — baked in).** All participant-facing market-media reads are **CDN-served** (R2 CDN — the existing pattern, the same one serving the pseudonym images) and **ride the existing market read**: the media set, which row `is_default`, and `media_video_url` load **with the market header** in the read that already runs for the Market Detail page — **no extra round-trip** on header render. The picker reads the same small, indexed, already-loaded pool. The default fallback is a read-time lookup of an already-loaded row. Assets are pre-set pre-live, so **nothing is generated at request time**. Combined with the moderation-free pick path (#4), the net runtime cost added to participant hot paths is **zero round-trips**.

9. **Build split — three ritual-gated tasks; new migration.** (a) **Participant header display** — a header design-mockup task authors the locked still (direct from the locked d5 / integration-shell base), then the display build [UI.4 area] builds from it. (b) **Admin upload UI + route** — extends F-ADMIN-1 / a market-media admin sub-surface; **full plan→execute ritual + `@db-migration-reviewer`** (new table) **+ `@security-auditor`** (admin boundary + an admin-context moderation caller). (c) **Composer pick-from-pool affordance** — extends the existing `image-attach` seam; **full ritual + `@security-auditor`** (the moderation read-scope and the not-both-set invariant are safety-relevant). The new `market_media` table, `comments.market_media_id`, and `markets.media_video_url` land in a **new migration** (head is `0018` at this ADR; next is `0019` absent intervening work — pin at execute).

### Single-source-of-truth file map

| Concern | Source-of-truth |
|---|---|
| The `market_media` table (columns, FK, `is_default`, `display_order`) | a new table in `src/db/schema/` — this ADR mints the requirement; the schema owns the exact columns (built later) |
| `comments.market_media_id` FK + the not-both-set CHECK | the `comments` schema in `src/db/schema/` — built later |
| `markets.media_video_url` | the `markets` schema in `src/db/schema/` — built later |
| R2 bucket arms (the third `market-media` arm + `m/<marketId>/` namespace) | `src/server/storage/r2.ts` — built later |
| Admin-context image moderation (the non-participant-session caller) | a variant of `src/server/moderation/precommit.ts` — exact factoring owned by the admin-upload build task |
| Pick / default render resolution (the three-step fallback) | `src/server/comments/image-attach.ts` (the existing `resolveImageAttachment` seam) — extension owned by the composer build |
| The admin market-media upload route | SPEC.2 §4 / `src/server/admin/markets/…` — owned by the admin-upload build task |

## Consequences

**Positive.** The admin/participant boundary is preserved at the data layer (no `user_id` on market media; a separate table; a separate bucket) — thesis-aligned and audit-clean. Moderation is never bypassed even on the pick path — it is clean *by construction*, because admin media is pre-vetted and there is no omission to exploit. Participant latency is low by design: CDN-served assets, ride-along load with the market header, a moderation-free pick path, and nothing generated at request time. Credential isolation is preserved (a third isolated bucket arm, not a diluted shared one). The pick path reuses the existing `image-attach` seam and the existing image/R2/CDN substrate — no parallel logic to drift. "Markets always have media" removes empty-state branching entirely.

**Negative / trade-offs.** A new table + a new migration + a third R2 bucket (credentials to provision in Doppler) — real setup cost, accepted because it is the work this feature requires. An **admin-context moderation path must be factored out** of the participant-session-bound `precommitModerate` — non-trivial, but correct: the guardrail requires admin media to be moderated, and a trusted-context caller is the clean way to do it. The **not-both-set CHECK** adds a write-path invariant on `comments` (mitigated: a single DB-level constraint enforcing the mutually-exclusive image sources). An admin could introduce a bad image **only if moderation misses it** (mitigated: the same pipeline as participant uploads, plus the operator is a trusted curator acting pre-live; reactive removal remains the backstop). The video is an **off-platform** jump — a funnel leak (mitigated by new-tab, so the market page is retained).

**Follow-ups.** The three build tasks in #9; the header design-mockup still (the participant display — now a downstream design task rather than this spec chat); the **F-ADMIN-1 / §display / SPEC.2 data-model riders authored in this same spec chat** (the next step); the **SPEC.2 §22 ADR-Index row for ADR-0026**; and a SYNC-sweep note that `src/server/comments/` is **already partly built** (`foreclosure.ts`, `image-attach.ts`, `reply-validate.ts`), so the riders must not describe comments as wholly unbuilt (recorded for the next sweep, not this PR).

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 INV-1 | bet ↔ comment atomicity | **Consumes.** A picked pool image is attached **inside** the bet+comment transaction (via the `image-attach` seam); the `market_media_id ?? default` resolution must not open a second write or break INV-1 atomicity. |
| SPEC.1 F-COMMENT-3 | image-attached comment | **Shapes.** Extends the attachment model with a second, mutually-exclusive image source (`market_media_id`) plus a default fallback; the participant-upload moderation path (F-COMMENT-3) is unchanged. |
| SPEC.1 §14 (moderation, Track A/B) | moderation gate | **Shapes.** Admin market-media is moderated at upload via an admin-context caller of the same pipeline; the pick path attaches a pre-vetted asset and opens **no** new unmoderated route. Pipeline unweakened. |
| SPEC.1 §15 F-ADMIN-1 / F-AUTH-ADMIN | admin-not-participant | **Consumes.** Market media is admin-set and admin-owned; it must not require or create a `users` row, and must not use the participant-bound `/api/uploads/sign`. |
| SPEC.2 data model + §4 | markets schema / API surface | **Mints.** The `market_media` table, `comments.market_media_id`, `markets.media_video_url`, the third R2 arm, and the admin upload route — consumed by the three build tasks. |
| Tracker | the three market-media build tasks | All depend on this ADR being `accepted` (and the riders landed). |

*(Moderation §14 reference verified against `see §14 F-MOD-4` in SPEC.1; the F-COMMENT-3 / display subsection numbers are pinned exactly in the riders.)*

---

*ADR-0026 ratifies the market-media model: an admin-owned, separately-stored, pre-moderated per-market image pool that drives a Market-Detail header carousel and doubles as an optional composer pick-source with a default fallback, plus a single outbound YouTube explainer link — with the admin/participant boundary, the moderation guardrail, and low participant latency preserved by construction. The decision body and the constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
