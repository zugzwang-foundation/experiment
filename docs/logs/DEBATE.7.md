# DEBATE.7 — execute close-out log

**Closed:** 2026-06-19 · **Canonical SHA:** `02f87ac` on `main` (squash of PR #143) · **Plan:** `docs/plans/DEBATE.7.md` · **Governing model:** ADR-0021 (reactive moderation, no held queue) — amends ADR-0014 (gate; §18 P1 patch-record).

> Frame: critical-path · safety-critical · gate-touching. Full ritual ran (plan → tests-first → implement → code review → security audit → migration review → §5.10 self-audit → PR → squash).

## State after this stratum
- **Migration head:** `0016_mod_actions_reason.sql` (was 0015).
- **EVENT_TYPES:** still **23** — no `events` row is emitted for a moderation consequence (OD-4(a); `mod_actions` + `users.banned_at` are the record). `schemas.ts` untouched.
- **SPEC.1 → v1.0.8**, **SPEC.2 → v1.0.8** (same-commit amendments). **ADR-0014 §18 P1** patch-record added (A2 gate-mapping scoping; decision unchanged).

## What landed (the §12 file list)
**New:** `src/server/moderation/consequences.ts` (`recordGateBlock`) · `drizzle/migrations/0016_mod_actions_reason.sql` (+ meta) · 9 test files + `_fixtures/wire.ts` under `tests/server/moderation/` · this log · `docs/runbooks/DEBATE.7-moderation-smoke.md`.
**Modified:** `src/db/schema/audit.ts` · `src/server/moderation/precommit.ts` · `src/server/bets/errors.ts` · `src/app/api/bets/place/route.ts` · `docs/specs/SPEC.2.md` · `docs/specs/SPEC.1.md` · `docs/adr/0014-pre-commit-moderation-flow.md` · 3 reconciled tests (`validation.test.ts`, `media.test.ts`, `mod-actions-append-only.spec.ts`).

### The four-disposition consequence model (off the gate verdict)
- **`track_a`** → `recordGateBlock`: `mod_actions` (`reason = track_a_autoban`) + **auto-ban** (`users.banned_at`, `IS NULL`-guarded) + (image) `image_uploads → 'blocked'` + CSAM seam iff `sexual/minors`. Wire: `400 comment_track_a_blocked`.
- **`track_b` (ordinary)** → `mod_actions` (`reason = track_b_blocked`), **no ban**, (image) `image_uploads → 'blocked'`. Wire: `400 comment_track_b_blocked`.
- **`track_b` (text-only `sexual/minors` carve-out)** → `mod_actions` (`reason = sexual_minors_text_blocked`) — the one blocked-not-published row surfaced for reactive ban-review. **Same** `400 comment_track_b_blocked` (category never revealed to the author — SPEC.1 §983).
- **`pass`** → the W-1 bet tx opens as before (untouched).
- **terminal OpenAI failure** → fail-closed: `503 + Retry-After: 5`, **no** `mod_actions` row.

### A2 gate-map change (`precommit.ts`)
Adult `sexual` + `imageR2Key` → **`track_a`** (the CSAM-image backstop while PhotoDNA is parked; omni scores image-borne CSAM as adult `sexual`, not `sexual/minors`). Adult `sexual` **text** stays `track_b` (auto-ban-on-text → HARDEN.5). `sexual/minors` image → `track_a`, text → `track_b` carve-out (unchanged). New const `TRACK_A_SEXUAL_CATEGORY`.

### `recordGateBlock` invariant posture
One **standalone pure-DB tx** (the Redis reservation is released in precommit's `finally` and the OpenAI hop is done before it opens — **no Postgres tx across the OpenAI call**, golden rule). INV-1: the bet+comment tx never opens on a block. INV-2/3: the ban touches **only** `users.banned_at` — positions + `dharma_ledger` untouched ("ban removes voice, not balance"). `mod_actions` is Bucket A (INSERT-only). The image flip uses the whitelisted Bucket-B two-column transition, keyed on the unique PK `imageUploads.id` (mirroring `place()`).

### Error rename
`CommentTrackBUnderReviewError` → `CommentTrackBBlockedError` (`423 comment_track_b_under_review` → `400 comment_track_b_blocked`), aligning code to SPEC.1 §8.

## Ritual outcome
- **Tests-first:** 17 failing-first tests minted (track-a · track-b-blocked · carve-out · image-block · a2-mapping · fail-closed-no-row · csam-seam · reactive-foundation · blocked-retry-safety) → all green after implement.
- **Code review:** 0 CRITICAL / 0 HIGH / **1 MEDIUM fixed in-flight** — the image-block CAS keyed on the non-unique `r2_object_key`; re-keyed to the unique PK `imageUploads.id` (matching `place()` + plan §12). The 4 test-file reconcile-fixes confirmed deliberate (not assertion-softening).
- **Security audit:** 0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW (non-blocking). All four invariants + the golden rule + fail-closed + author-non-disclosure confirmed PASS.
- **Migration review:** all targets PASS (enum 5 values; `reason` NOT NULL no-default fail-loud; FK lambda + onDelete restrict; verdict nullable; indexes; same-commit App.B.10 amendment present).
- **§5.10 pre-PR self-audit:** all PASS.
- **Gates:** full suite **931 passed / 0 failed**; `just verify` (typecheck → biome → next build) all checks passed.

## Decisions made (session rulings — NOT in the plan; ratified this session)
- **(a) `recordGateBlock` signature** = a single typed params object (`RecordGateBlockArgs`), not positional args.
- **(b) CSAM seam** = Sentry `captureMessage`, event `csam_auto_report_pending`, `mod_action_id` tag, `TODO(MOD-NCMEC-INTEGRATION)` marker — **NO NCMEC call** (parked, `docs/parked.md` LD-7). Fires only on `track_a` + `sexual/minors`; adult-`sexual` image `track_a` does **not** fire it.

## Open questions / carry-forwards / parked
- **Transient-OpenAI-failure-then-succeeds test:** outside the §10 catalogue (only the terminal-failure path has a spec). Revisit at HARDEN test-hardening.
- **Security LOW-1 (`mod_actions.target_user_id` nullable):** a note for the reactive-admin-dashboard stratum / a hardening task — **not** a DEBATE.7 fix (the column predates this PR; reactive admin rows may legitimately need it nullable).
- **Security LOW-2 (rare reservation-release → cache-write duplicate audit row):** ratified **BENIGN** by decision (append-only `mod_actions` + idempotent ban/CAS). No guard, by design (plan §8).
- **Plan §5.5 defect:** the plan instructed "note the `mod_reason` enum in SPEC.2 §5.5," but on-disk §5.5 is "Removed from prior outline (audit trace)" — not an enum-inventory home (SPEC.2 has none). Resolved by documenting `mod_reason` in **App. B.10** (its canonical per-column home) + the §0.1 changelog. Note for future plan authoring: don't cite §5.5 as an enum home.
- **Operator action (alert config, not code):** set the Sentry alert level on `csam_auto_report_pending` high enough to **PAGE** — a pending CSAM report needs human follow-up.
- **Surfaced:** the merged head branch did **not** auto-delete (contrary to the prior expectation) — cleaned manually this dispatch (remote delete + `-D` after an empty tree-diff proof).

## Next session starts at
The **reactive admin-dashboard stratum.** It **reads** the `mod_actions` rows + the ban mechanics this stratum laid, and **builds** the reactive review feed + the Remove/Ban action handlers + the resolution surface. The `content_removed` / `user_banned` `mod_reason` enum values are already in place (forward-compat) — **no further migration** is needed for them. The operator smoke test (`docs/runbooks/DEBATE.7-moderation-smoke.md`) is run on the Vercel preview after web reviews the runbook.

## Context to preserve
- `mod_actions` is now the authoritative append-only moderation audit; `users.banned_at` is the derived ban state the bet gate reads. The dashboard stratum builds on these, not on new tables.
- The carve-out discriminant lives **only** in `mod_actions.reason`, never in the wire response — the dashboard's ban-review feed filters on `reason = 'sexual_minors_text_blocked'`.
- `blocked_text` is admin-only (STRIP-in-dataset), retained for reactive ban-review.

## Time
DEBATE.7 execute (recon → tests-first → implement → review ritual → commit/PR → squash → close-out), single session, closed 2026-06-19.
