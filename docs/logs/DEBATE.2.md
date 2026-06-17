# DEBATE.1 + DEBATE.2 — execute-session record (close-out)

> **Status:** DONE — both tracker rows landed on `main`.
> **Date:** 2026-06-17
> **Author:** Claude Code (execute), reviewed at the PR gate (web).
> **Plan:** `docs/plans/DEBATE.2.md` (merged `39c281a`, #135).

---

## Scope + outcome

DEBATE.1 and DEBATE.2 were **co-planned and executed as one unit** (one tightly-coupled server + tests change, no schema delta), but remain **two separately-checkable tracker rows**. Both are now **done**, with **different completion SHAs**:

| Row | Title | Completion SHA |
|---|---|---|
| **DEBATE.1** | INV-1 atomicity enforcement (API + DB) | **`334d742`** (PR #136 squash) |
| **DEBATE.2** | Comment/reply-as-bet write path (post / reply / image) | **`b292b36`** (PR #137 squash) |

**Why they differ.** DEBATE.2's code (reply-as-bet, foreclosure, image-attach, terminalization) landed in #136 alongside all of DEBATE.1. But DEBATE.2 is **complete only with the image-attach reuse/dangling/TOCTOU guard**, which a fresh-tab adversarial review surfaced *after* #136 and which landed separately in **#137**. DEBATE.1's exit is fully contained in #136 (the #137 guard is image-only and does not touch it). So DEBATE.1 → `334d742`, DEBATE.2 → `b292b36`.

---

## What shipped

### DEBATE.1 — INV-1 atomicity (API + DB)
- **`comment_requires_bet` (400) named frontstop.** Body-split in the place route: an absent/empty comment body emits the named code, not the generic `error_invalid_request_body`.
- **INV-1 both directions.** bet→comment is the schema half (`bets.comment_id NOT NULL` FK, pre-built). comment→bet is by construction — a comment is only ever inserted inside `place()`'s single SERIALIZABLE `runBetTransaction`, always paired with a bet; an abort leaves **zero comment rows**. There is no comment-only write path.
- **`I-ATOMICITY-001` extended** for the comment→bet construction direction (`throw-before-events-rolls-back-all-tables` inserts comment+bet then aborts → 0 comments; `every-comment-has-a-referencing-bet-construction`), plus `atomicity.test.ts` (`rejects-bet-without-comment…`, `every-persisted-comment-has-a-bet-referencing-it`).

### DEBATE.2 — comment / reply-as-bet write path (greenfield `src/server/comments/`)
- **Un-fenced reply path.** `reply-validate.ts` enforces depth-1 / same-market / parent-existence → `reply_depth_exceeded` (400), `parent_comment_not_found` (404). A reply IS a Support/Counter bet (ADR-0017); the write flows through the single `place()` W-1 tx. `place.ts` stays the single atomic owner.
- **Foreclosure** (`foreclosure.ts`): pure `computeReplyAffordance` + a thin reader (read-time Support/Counter affordance) — **no write, no render** — that agrees by construction with the write-path single-side guard (F-BET-10 `opposite_side_held`).
- **Image-attach** (`image-attach.ts`): resolve + ownership + the `terminal_state IS NULL` un-attached guard. In-tx image **terminalization (`committed`)** with the **CAS claimed-exactly-one** assertion (fail-closed). **Retry-pure** `image_upload.committed` (event_id minted at handler entry, closed over → `ON CONFLICT (event_id, created_at)` dedupe). Route-wire only into the existing `precommitModerate` seam — no classifier, no Track-A/B/C consequences.
- `stake_at_post_time` written `"0"` (Call A); `side_at_post_time` = the **replier's** side (INV-3, never the parent's); `PlaceResult` echoes `parentCommentId`.
- `REPLY_DEPTH_MAX = 1` in `config/limits.ts`. **SPEC.2 §5.4** amended with the `ReplyAffordance` read-time-derivation contract (so DEBATE.4 builds against a load-bearing contract).
- F-COMMENT-1…5 each mapped to its SPEC.1 §8 acceptance test (`direct` / `reply` / `media` / `validation` / `no-position`).

---

## Key rulings (with rationale)

- **Finding B — `error-codes.md` NOT created.** The 3 new codes (`comment_requires_bet`, `reply_depth_exceeded`, `parent_comment_not_found`) are minted as stable strings in `src/server/bets/errors.ts` only (the ENGINE.8 precedent). `docs/specs/error-codes.md` stays a **forward deliverable**: the SPEC.2 §1.0 lock + PRECURSOR.4 explicitly deferred it to avoid a dual-source drift surface, and the spec lock outranks the plan's stale prose (which still listed it). Catalogue remains forward.

- **Orphan-sweep CRITICAL (caught by `@security-auditor`).** The image pass branch is **one atomic op of THREE writes**: link `comments.image_uploads_id` + terminalize the upload `committed` + emit `image_upload.committed`. The first implementation did **2 of 3**, omitting the SPEC.2 §12.2-step-6 terminalization. The orphan-sweep cron selects `terminal_state IS NULL`, so it would have **deleted every committed image's R2 object within 120 min**, leaving a dangling `comments.image_uploads_id`. Fixed in-PR (#136) with the in-tx whitelisted Bucket-B `NULL→committed` transition — no migration.

- **MEDIUM image-attach gap (caught by a fresh-tab adversarial review, post-#136).** Ownership was validated but **terminal_state was not**, and the CAS no-op'd silently. Exploits: re-attaching a `committed` upload (double-link a live image + a duplicate `image_upload.committed` row in the append-only ledger), attaching an `orphan`-swept upload (dangling ref to a deleted object), and a concurrent TOCTOU race (sweep/commit terminalizing in the window between the pre-tx resolve and the in-tx UPDATE). Fixed with **two guards**: a `terminal_state IS NULL` predicate in the resolve (sequential half), and a **CAS claimed-exactly-one** assertion that fails closed by rolling back the whole W-1 tx (concurrent half) — no phantom committed event. Landed in **#137**.

- **Image-ownership error class.** Reuse the existing generic `InvalidRequestBodyError` (400 `error_invalid_request_body`) **uniformly** for absent / not-owned / already-used / swept. No new wire code (honors Finding B) and **no existence-or-reuse oracle** — a caller cannot distinguish the cases.

---

## Lessons (durable takeaways)

1. **PROCESS MISS — an un-pushed commit merged the wrong tree.** The MEDIUM fix (`736787a`) was committed locally and re-audited but **never pushed**, so PR #136 squash-merged the **pre-fix tree** (`ec5096f`). Caught post-merge by a **tree-content diff** (`git diff ec5096f origin/main` was empty == the pre-fix tree, not the fix tree). Recovered via a focused follow-up PR #137 (cherry-pick onto a fresh branch from `main`).

2. **CORRECTED GATE (adopt going forward).** Merge-readiness requires confirming the **PR HEAD SHA includes the fix commit**, AND a **post-merge tree-content proof** (`git diff <reviewed-fix-SHA> origin/main` == empty + grep the guard lines present on `main`) **before flipping any tracker row**. "Committed locally + tests green" is NOT "on the PR" is NOT "on main." These are three distinct states; verify each.

3. **"HALF A TEST" (second occurrence this task).** A route-wire test that asserts the event/link but **not the resulting persisted state** is half a test. The missing `terminal_state` post-condition is exactly what would have caught the orphan-sweep CRITICAL; the earlier `image-track-b` half-assertion (Q2 — asserted the missing committed event but not bet/comment absence) was the same shape. **Standing recommendation:** assert persisted state on every write-path test.

4. **REPORTING HYGIENE.** A build step reported "117 passed / 3 skipped" as the "full suite" when that was the **file count of a path-scoped run**; the real full suite is **~913 tests**. Report the real full-suite tally (tests, not files; whole suite, not a subset).

---

## Verification (final, on main `b292b36`)

- **Full suite: 913 passed · 0 failed · 2 skipped · 5 todo (920).** tsc **0 errors**. biome **clean** (278 files).
- **Scope-zero:** migration head `0015`, EVENT_TYPES 23, no `error-codes.md`. (Confirmed held through both squashes.)
- **All six thesis-load-bearing adversarial checks SAFE from source** (re-audited on a fresh base for #137): moderation tx-never-opens (reply + image), image-ownership oracle closure, INV-1 (both directions), INV-3 (replier-side), foreclosure↔F-BET-10 agreement, no-DEBATE.7-leak.
- **Commit identity correct:** author `Zugzwang/world <zugzwangworld@proton.me>`, no Co-authored-by, SSH-signed (`%G? = G`) across #136 (`334d742`) and #137 (`b292b36`).

---

## Carry-forward / parked

- **Whitespace-only-body frontstop → HARDEN** (a content-policy question, not an INV violation — a comment row still exists). Not added here.
- **`docs/specs/flows/F-COMMENT-{4,5,6}.md` stale skeletons → a future web-authored SYNC doc-sweep.** Mislabeled vs SPEC.1 §8 (canonical); left untouched this task per the DOC NOTE.
- **Downstream DEBATE phase:** DEBATE.3 (BEFORE-UPDATE side-freeze trigger — the value is SET here, the trigger is not built), DEBATE.4 (debate-view render, DESIGN.5-gated), DEBATE.5 (Exited marker), DEBATE.7 (moderation Track-A/B/C consequences), DEBATE.8 (ranking + `RANKING.md`), DEBATE.9 (vestigial drop: `friendly_fire_events` / `stake_at_post_time` / `comments.bet_id → NOT NULL`). **DEBATE.2 was the keystone** — the rest of the DEBATE phase can now hang off the reply-as-bet write path.

---

## §5.9 fields

- **What landed (files + PR#):** `src/server/comments/{foreclosure,reply-validate,image-attach}.ts` (new); `src/server/bets/{place,errors}.ts`, `src/server/config/limits.ts`, `src/app/api/bets/place/route.ts`, `docs/specs/SPEC.2.md` (modified); `tests/server/comments/*`, `tests/unit/comments/foreclosure.test.ts`, `tests/server/bets/atomicity.test.ts`, `tests/invariants/I-ATOMICITY-001…`. PRs **#136** (`334d742`, reply-as-bet + INV-1) and **#137** (`b292b36`, image-attach guard). This log: PR (docs-only) from `docs/debate-2-closeout`.
- **Decisions made:** Finding B (codes in errors.ts only, no error-codes.md); Call A (`stake_at_post_time="0"`); image-ownership reuses the uniform 400 (no oracle, no new code); the orphan-sweep CRITICAL + the image-attach MEDIUM both fixed in-flight.
- **Open questions:** none blocking. Whitespace-body policy is a HARDEN content-rule call.
- **Next session starts at:** PK-refresh staging (`docs/specs/SPEC.2.md`, this log, the tracker flip) after this docs PR merges; then the next DEBATE-phase row (DEBATE.3 freeze trigger is the natural next, or per the tracker sequencing).
- **Context to preserve:** the corrected merge gate (tree-content proof before any tracker flip); `place()` is the single atomic owner of the bet+comment+image-commit write; the image pass branch is 3 writes (link + terminalize + emit); DEBATE.1 ref `334d742`, DEBATE.2 ref `b292b36`.
- **Time:** execute + 3 reviewer passes + the #136 wrong-tree recovery (#137 cherry-pick + re-audit) + this close-out, across the DEBATE.1+.2 execute session (2026-06-16 → 2026-06-17).
