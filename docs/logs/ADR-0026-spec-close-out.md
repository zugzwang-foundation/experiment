# ADR-0026 — Market Media (spec lane) — Session Close-Out Log

> **Time:** 2026-06-30 (spec-authoring + close-out session).
> **PR:** **#182** (`docs/adr-0026-market-media` → `main`). **Canonical SHA = `4819352`** (squash-merge on `main`); pre-merge branch tip `ca8f2ca`, SSH-signed (ED25519), `Zugzwang/world`, no Co-authored-by trailer. **Docs only — no code, no migration, no build.**
> **Frame:** `docs/adr/0026-market-media.md` (accepted 2026-06-30) + its same-commit SPEC.1/SPEC.2 riders. Recon: RECON pass against live `af4a909` (market media genuinely unspecced/unbuilt).

## Scope

Spec lane only. ADR-0026 (Market Media — admin-set asset model, storage, pick-from-pool semantics, moderation posture, video) + the prescriptive SPEC.1/SPEC.2 riders, applied same-commit per the SPEC.2 §0 versioning policy. **No code, no migration, no build** — those are three separate ritual-gated build tasks (below). The descriptive CLAUDE.md/AGENTS.md ADR-ceiling refresh + this log land in a follow-up docs PR (`docs/adr-0026-close-out`).

## What landed (files + PR#)

PR **#182** (squash-merge `4819352`), one commit, three files:

- **New** — `docs/adr/0026-market-media.md` (Status=accepted, 2026-06-30).
- **`docs/specs/SPEC.1.md` → 1.0.11** — §15 F-ADMIN-1 (admin sets the media pool AT-CREATE; Errors + Invariants extended); new §9 "Market media — participant display" subsection (header carousel + outbound video link, market-view only); §8 F-COMMENT-3 (pick-from-pool + default fallback); §0 version + §20 change-log row.
- **`docs/specs/SPEC.2.md` → 1.0.12** — §5.1 new `market_media` table (#23, Bucket C, no `user_id`) + `comments.market_media_id` + not-both-set CHECK + `markets.media_video_url`; §5.2 bucket summary; §5 ADRs-consumed; §12.1 third R2 bucket arm `market-media`; §4.3 admin-upload forward-note; §22 ADR-0026 row + count strings; Appendix A + B (new B.16); §0 version + §0.1 change-log row.

**Counts (read live, not from the riders doc):** SPEC.2 §5 22 → 23 tables, Bucket C 10 → 11, protected set 12 (unchanged), domains 10 (unchanged — `market_media` in the markets domain). §22 23 → 24 ADRs, 20 → 21 accepted, "24-row index". §22 row used the live 6-col format (the riders' 5-col sample was reconciled away).

This follow-up PR (`docs/adr-0026-close-out`) additionally lands: CLAUDE.md ADR-ceiling `0003–0024 → 0003–0026` (source-of-truth line + footer) + AGENTS.md footer; CLAUDE.md decision-log rows for ADR-0026 **and** ADR-0025 (catch-up — ADR-0025 was absent); this log.

## Decisions ratified (ADR-0026, accepted 2026-06-30)

- **D1 — new `market_media` table** (the schema home): one row per market-media image, Bucket C, **admin-owned, `no user_id`** — the load-bearing separation (admin has no `users` row per F-AUTH-ADMIN; admin media never enters the participant `image_uploads` namespace).
- **D2 — third R2 bucket arm `market-media`** (`R2Bucket = "uploads" | "pfp" | "market-media"`) with isolated credentials (compromise isolation preserved; `pfp` is the admin-owned-asset precedent); key namespace `m/<marketId>/<mediaId>.<ext>`, distinct from the participant `u/<userId>/`.
- **D3 — reference model for picks + optional attachment with default fallback**: nullable `comments.market_media_id` mutually exclusive with `image_uploads_id` (DB CHECK); render chain `image_uploads_id ?? market_media_id ?? is_default`; the default case stores nothing (text-only comment = both FKs NULL, renders the default by lookup; zero extra writes); picks hook the existing `resolveImageAttachment` seam.
- **D4 — admin-moderated at upload** (safety-critical): admin media runs the **same** image-moderation pipeline (CSAM hash + classifier) at admin-upload time via an admin-context caller; the participant pick path is moderation-free **by construction** (pre-vetted) — simultaneously the safety property (no unvetted bytes via a pick) and the latency property (picking is the fast image path). Pipeline never weakened — only a new trusted-context caller.
- **Video = single outbound `markets.media_video_url`** — opens YouTube in a new tab; not embedded, not self-hosted; categorically distinct from the §21.5 radio embed (its embed-vs-self-host question does not apply).
- **Default = one `is_default` row** — exactly one `is_default = true` per market backs the render fallback; carousel order is `display_order`.
- **S1-A placement = media AT-CREATE** (F-ADMIN-1, operator ruling) — a market is never in `Draft` without its media pool; re-asserted at `Draft → Open` (F-ADMIN-2). "Markets always have media" is a service invariant; no empty-media render path. The open sub-decision (create vs pre-Open gate) is closed; not surfaced in the spec.

## Open questions

None outstanding for the spec lane. Number-tuned values (none hard-pinned), participant pixels, and exact route/handler signatures are deferred to the build tasks per the ADR's "this ADR does not decide" list.

## Surprises caught + fixed in-session

1. **F-ADMIN-4 phantom cross-ref (gate-check #182, fixed pre-merge).** My §4.3 forward-note claimed the market-media upload is "distinct from the **existing** F-ADMIN-4 `/api/admin/uploads/sign` moderation-affordance route." Live verification: `src/app/api/admin/` does **not exist** (no admin upload-sign route on disk), and SPEC.1 F-ADMIN-4 is **"Moderation actions"**, not an upload route. The "existing route" reference was mine, not real → dropped the F-ADMIN-4 mention; the note is now a plain build-deferred forward-note (commit amended `e5c73c3 → ca8f2ca`, force-pushed pre-merge).
2. **§22 row-format reconciliation.** The riders supplied a 5-col `| ADR | Title | Status | Date | — |` sample; the live §22.1 is 6-col `| ADR | SPEC.x | File | Title | Status | Accepted |`. Used the live format (⟂ checklist item 5).
3. **"New schema file" vs ten-domain architecture.** The riders suggested a new `src/db/schema/` file for `market_media`; a new file implies an 11th domain, conflicting with §5.3's "ten domains." Reconciled `market_media` into the **markets** domain (`markets.ts`) — keeps domain count at 10; the build owns the exact file.
4. **`media_video_url` pre-add verify.** Re-verified the live `src/db/schema/markets.ts` column set (10 cols) before adding the column to the §5.1 row + Appendix B (⟂ checklist item 3).

## Logged, NOT fixed (out of scope — sweep candidates)

- **Pre-existing §4.3 / Appendix-A F-ADMIN-4 mislabel.** SPEC.2 catalogues `POST /api/admin/uploads/sign` (§4.3 / §4.5 / §4-SSOT / §12.10 / Appendix A.4) tagged "F-ADMIN-4 image affordance," but the route is **not on disk** and F-ADMIN-4 is the moderation feature, not an upload route. Pre-existing SPEC.2 drift; not touched (only my own forward-note was corrected).
- **SPEC.2 stale banner `Status: 1.0.5`** vs the §0 metadata (now 1.0.12) — the last 6 version bumps never touched it; followed that precedent.
- **Appendix B B.6** documents `comments.bet_id` as "NOT NULL" while the live schema keeps it deliberately nullable (CLAUDE.md §1) — pre-existing Appendix-B drift.
- **`src/server/comments/` is already partly built** (`foreclosure.ts`, `image-attach.ts`, `reply-validate.ts`) — AGENTS.md §3 still lists `src/server/comments/` as greenfield. Flagged for the next SYNC sweep (riders' checklist item #7); rider text was written so as not to describe comments as wholly unbuilt.
- **CLAUDE.md `tracker_v11.html` reference** (line ~18) is stale drift — left untouched (unrelated; logged for a sweep).

## Next session starts at (exact next action)

**POST-MERGE of this close-out PR (web-gated):** PK-refresh Batch 2 — add the bumped `CLAUDE.md`, `AGENTS.md`, and this log to `~/Desktop/zz-pk-refresh-ADR-0026/` from `origin/main`, md5-verified (Batch 1 — the three #182 docs — already staged from main). Then the three **build** tasks are unblocked (ADR is `accepted`, riders landed):

1. **Participant header display** — preceded by a **header design-mockup** (locked still from the d5 / integration-shell base), then the display build [UI.4 area].
2. **Admin upload UI + route** — full plan→execute ritual + `@db-migration-reviewer` (new table) + `@security-auditor` (admin boundary + admin-context moderation caller).
3. **Composer pick-from-pool affordance** — full ritual + `@security-auditor` (R2 read-scope + not-both-set invariant).

The `market_media` table, `comments.market_media_id`, and `markets.media_video_url` land in a **new migration** (head `0018 → 0019`) at execute. Tracker IDs for the three builds to be regularized by the operator.

## Context to preserve

- **No `user_id` on `market_media` is load-bearing** — it is the data-layer expression of the admin/participant boundary; the build must not add a participant owner, and the admin upload path must not reuse the participant-session-bound `/api/uploads/sign`.
- **Two separate R2 read-scopes** (`u/<userId>/` own uploads, `m/<marketId>/` picks) keep the participant moderation read-scope clean — do not collapse them.
- **Pick path is moderation-free by construction** (pre-vetted at admin upload) — a build that adds a post-time moderation round-trip on a pick is both a latency regression and a redundant call; a build that lets a participant route unvetted bytes via a "pick" is a guardrail breach (CLAUDE.md §3).
- **Version pairing:** SPEC.1 1.0.11 ↔ SPEC.2 1.0.12 ↔ ADR-0026, same commit (#182).
