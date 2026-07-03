# Session log — AUDIT-FIX-A1 (+A10) — moderated-image byte-identity binding

**Stratum state:** DONE — landed to `main`. Squash SHA **`4350406`** (PR #197).
Plan: `docs/plans/AUDIT-FIX-A1.md`. HEAD at kickoff: `16bb728`.
**Time:** 2026-07-03 (single session, plan → execute → merge close-out).

## What landed (files + PR#)

PR **#197** → squash `4350406`. One commit carried code + tests + ADR + SPEC riders (same-commit doctrine §5.12). No DDL, no migration.

- **Storage:** `src/server/storage/r2.ts` (`mintPutUrl` gains `opts.ifNoneMatch` → arms `If-None-Match: "*"`; `headObject` returns `etag`); NEW `src/server/storage/verify-object.ts` (`verifyUploadedObject` — pre-moderation HeadObject, fail-closed A10 + existence, captures `{etag, byteSize}`).
- **Routes:** `src/app/api/uploads/sign/route.ts` (arms write-once + client `If-None-Match: *` contract); `src/app/api/bets/place/route.ts` (pre-moderation verify call site, pre-tx, fail-closed; threads `etag`/`byteSizeActual`).
- **Bet spine:** `src/server/bets/place.ts` (`PlaceParams.image` + `image_upload.committed` payload gain `etag`/`byteSizeActual` — no new tx write, no ordering change); `src/server/bets/errors.ts` (`toWireError` maps `ImageOversize→400`, `StorageObjectMissing→400`, `StorageUnavailable→503`); `src/server/events/schemas.ts` (`image_upload.committed` payload `+etag` nullable `+byteSizeActual` positive int — no new EVENT_TYPE, still 23).
- **Docs (same commit):** ADR-0028 `docs/adr/0028-moderated-image-byte-identity-binding.md` (web-authored verbatim); SPEC.2 riders §12.3 (B1 sentence upgrade + B2 write-once para), §12.2 step-5 (B3), §10 immutability (B4), §22 ADR-index row (B5); SPEC.1 §16.5 rider (C1).
- **Tests:** 7 new (`verify-object`, `mint-put-url-write-once`, `_probe-if-none-match-signed-header`, `sign-route-write-once`, `place-image-verify-fail-closed`, `image-verify-audit-record`, `swap-write-once-sdk-mock`) + 3 conformance (`media`, `events/insert`, `moderation/image-block` — added the `verify-object` module-boundary mock / required fields).

**Gates:** full `pnpm vitest run` = 1113 passed / 0 failed / 3 skipped; `ZUGZWANG_ENV=preview just verify` green. `@code-reviewer` clean (C/H/M); `@security-auditor` no exploitable finding across all 7 attack surfaces.

## Decisions made

- **Mechanism = physical write-once**, not an ETag compare (ADR-0028). `If-None-Match: "*"` is a *signed* SigV4 header → unstrippable → every post-first PUT to the key 412s → moderated bytes ≡ rendered bytes by construction. ETag is a **forensic fingerprint only, never a security control** (R2 ETag = collision-weak MD5).
- **Missing-object HTTP status = 400** `error_storage_object_missing` (`validation_error`), NOT 409 — ADR-0028 §Decision Outcome RULING (web-authored). Bad request (client referenced an upload it never completed), symmetric with `error_image_oversize→400`.
- **Fail-closed, pre-tx, no-HTTP-in-tx:** the HeadObject verify runs before moderation and strictly outside `db.transaction` (CLAUDE.md §3). A 503 (≥500) is NOT cached under the idempotency key; the 400s are (per `runBetEndpoint`).
- **Admin path untouched:** market-media signed-PUT passes no opts → stays mutable (trusted/unmoderated, ADR-0027).
- **SPEC placement correction (web):** write-once binding lives in **§12.3**, not §12.4; §12.4 (signed-READ-for-OpenAI) untouched.

## Confirmation requested at merge gate (non-blocking) — RESOLVED

**`verifyUploadedObject` runs on the participant OWN-UPLOAD branch only, not pick-from-pool.** Grep-verified: the sole call site is `place/route.ts:101`, inside `if (imageUploadsId !== undefined)`. The bet-place body schema carries `imageUploadsId` only — no `market_media_id`/pick field exists in this route; the market-media pick path is not wired into the bet-place surface at all. Picked market-media images are trusted (ADR-0027), out of A1 scope, and write-once is already scoped to `/api/uploads/sign`. **No leak; behavior recorded as expected.**

## Surprises caught + fixed in-session (§5.10 wins)

1. **New module boundary broke two route-integration tests via a REAL HeadObject.** The full-suite run (not the narrow gate) surfaced `moderation/image-block.test.ts` (and, pre-fix, `comments/media.test.ts`) driving the real place route → the new `verifyUploadedObject` made a live R2 HeadObject → 503 before moderation → block assertions failed. Fix: added `vi.mock("@/server/storage/verify-object")` to both (the plan flagged media; image-block was caught by the full suite). Enumerated all 4 image-attaching route tests to prove image-block was the only remaining one. (Reinforces `project_full_suite_vitest_final_pre_pr_gate`.)
2. **My own `ZUGZWANG_ENV=preview` override broke a redis-key-prefix test.** `precommit-moderate.integration` hardcodes the `prod:` prefix; `tests/_setup/env.ts` defaults `ZUGZWANG_ENV=prod` (`??=`), so my `preview` override flipped the prefix to `preview:`. Diagnosed as an env-override artifact, NOT a code regression; re-ran the full suite the canonical way (plain `pnpm vitest run`, setup default) → green. (`preview` is for `next build`/`just verify`, not vitest.)
3. **Two stale `409→400` code comments caught by reading my own post-commit diff.** After the ADR-0028 ruling flipped the mapping to 400, the block comment in `place/route.ts` and the closing comment in `verify-object.ts` still said `→409`. Behavior was correct (400); comments lagged. Amended the single commit (pre-review) so the diff is internally consistent.
4. **Plan-doc tail delimiter leak** (`</content></invoke>`) caught + stripped before the doc-only plan commit (`feedback_verify_generated_file_tails`).
5. **Web-authored ADR/riders arrived out-of-band** in `~/Downloads/ADR-0028_and_SPEC-riders_web-authored.md` (the `project_logs_arrive_in_downloads` pattern) rather than inline — located, applied verbatim, did not fabricate.

## SWEEP BACKLOG (operator-directed — for the next SYNC)

The deferrals are RULED CORRECT (SYNC-sweep concerns per CLAUDE.md ~line 199 / §7 "Reconcile periodically, not per-task") — accepted, not blocking A1. The next SYNC picks up:

1. **SPEC.2 §22 count-prose** → include 0028 (26→27 ADRs; numbering `0003–0027` → `0003–0028`; accepted count).
2. **SPEC.1 §0 + change-log** entry for ADR-0028.
3. **SPEC.2 §0 + change-log** entry for ADR-0028.
4. **CLAUDE.md + AGENTS.md footer ADR-range** citation → 0028.

(These are the ONLY doc items intentionally not touched in the A1 commit; the ADR-index row, all riders, and the ADR body did land.)

## Closing-ritual doc check

Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this session? **No immediate change.** The one candidate — the footer ADR-range citation → 0028 — is captured in the sweep backlog above per the operator's ruling. The write-once binding pattern is now canonically documented in ADR-0028 + SPEC.2 §12.3; a descriptive AGENTS.md storage-pattern line can ride the next SYNC (no trigger to add it now per §7).

## Open questions

None blocking. The only forward item is the deploy gate (below), which is an operator step.

## ⛔ HARD DEPLOY GATE (operator, post-merge) — the only proof the mechanism works

**Do NOT promote to prod until the staging-412 rehearsal is green against REAL R2:** sign → PUT 200 → repeat PUT 412 → overwrite attempt 412 → HeadObject shows the ORIGINAL ETag → oversize object → `error_image_oversize`. The SDK-mock swap test (`swap-write-once-sdk-mock.test.ts`) is necessary but **insufficient** — this rehearsal is the only evidence R2 honors `If-None-Match` conditional-create + SigV4 signed-header rejection. Rehearse on `staging`; gate prod promote on `/api/health` green (migrate-before-serve is moot — no migration).

## Next session starts at (exact next action)

**Re-kick AUDIT-FIX-B1** — a FRESH plan pass against the **post-A1 HEAD** (`4350406`, not reconstructed against `16bb728`), carrying the 11 rulings + the F1 capture shape: `captureException(err, { tags: { kind } })` for the A5/A6 error sites; `captureMessage(title)` only where there is no `err` object (the drain per-row emits + `events_default_nonempty`). B1 is critical-path-adjacent → gated plan→execute + named-reviewer cascade; pair with a fresh session + new web chat per §5.8. (The B1 plan-review artifact is `~/Downloads/AUDIT-FIX-B1_plan-review_execute-gate.md`.)

## Context to preserve

- Squash SHA `4350406`; post-A1 HEAD for the B1 plan pass.
- ADR-0028 clauses AMD-2 (ETag=forensic) + AMD-3 (MEDIA.3 composer MUST send `If-None-Match: *`, treat 412 as idempotent-success) are hard forward preconditions for the participant image composer.
- The staging-412 deploy gate is unretired until demonstrated against real R2.
