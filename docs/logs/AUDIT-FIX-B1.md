# AUDIT-FIX-B1 — session log (Observability batch: A5, A6, A7, A17, A18-DSN)

> **State: CLOSED — PR #199 open, NOT merged.** Implementation complete, flush-before-stamp landed, four SPEC.2 §17 riders applied, cascade clean, gate green. Operator merges after web diff review. Canonical reference SHA = the squash-merge SHA on `main` (pending merge).

## What landed (PR #199, branch `feat/audit-fix-b1`)

- `ca6c035` — plan of record `docs/plans/AUDIT-FIX-B1.md` + execute-gate appendix.
- `7ece7d5` — the batch, **amended** (23 files, +2435; flush delta + riders folded into the original `5c4ab35` per same-commit doctrine, un-pushed branch → safe soft-reset amend):
  - **§0** `safe-capture.ts` — fail-open wrappers + `safeFlush` (delivery-confirmation, the third wrapper).
  - **A5** `bets/endpoint.ts` `bet_handler_internal_error` (error_internal arm, original err) + `storage/r2.ts` `r2_unavailable` ×4 (404 excluded).
  - **A6** `moderation/openai.ts` auth tag byte-identical + `openai_moderation_upstream_failure` (non-transient + retries-exhausted); fail-closed byte-identical.
  - **A7** `drain-cron-alarms.ts` **emit → flush → stamp** (delivery-level at-least-once; `safeFlush(ALARMS_DRAIN_FLUSH_TIMEOUT_MS=2000)` gates the stamp on confirmed delivery; `events_default` probe moved ahead of the flush) + `api/cron/alarms-drain/route.ts` + `ALARMS_DRAIN_*` limits + vercel.json `*/5` cron.
  - **A17** `logRequest` wired: `runBetEndpoint` + both sign routes (admin `userId: null`); locked 7-field shape untouched.
  - **A18** `instrumentation.ts` boot-throw, PRIMARY variant (prod + staging).
  - **Riders** SPEC.2 §17.2 (new row 9 `bet_handler_internal_error`, row 2 `events_default_nonempty` + drain-side transport, row 4 `openai_moderation_upstream_failure` pinned, count-prose eight→nine) + §17.3 6c (`headObject` 4th `r2_unavailable` source). No ADR, no migration.
  - 11 new test files + fold-in guards; +5 flush cases.
- `<this commit>` — close-out log + the parked HARDEN follow-up.
- PR: **#199** (squash SHA pending operator merge).

## Decisions made

- **Flush-before-stamp ruled INTO B1** (post-`5c4ab35`) — closes the paused session's "MEDIUM: at-least-once is enqueue-level" residual. Implemented tests-first (`safeFlush` fail-open wrapper; stamp gated `flushed && emittedIds.length > 0`); upgrades the drain to delivery-level at-least-once.
- **Rider text delivered inline as fenced blocks** (the file route + the first inline paste both failed to reach CC; re-paste as code blocks landed). Applied **content-anchored** — all four current cells (rows 4, 2, 6c + the count-prose) matched the tree verbatim before replacement; no mismatch, no STOP. §0 untouched (grep-verified: all 7 hunks in the 1681–1707 band).
- **Model:** session banner reported Fable 5 vs the kickoff's Opus-4.8 precondition; operator ratified proceeding. Named cascade + gated sequencing retained; no ultracode on this critical-path-adjacent work.

## A17 / B8 hand-off note

A17 admin sign route logs `userId: null` (admin has no `users` row — §3 forbids inventing one). SPEC.1 §16.3's field reads "user_id **or anon marker** (a string)"; JSON `null` is byte-stable and the `route` field disambiguates the admin surface, but whether §16.3 mandates a literal string admin-marker is the **§16.3-admin-representation question → folded into B8** (the §16.3(7)⇄§17.6(8, +`request_id`) reconciliation, tracked G2). No B1 rider; `logging.ts` deliberately not edited in B1.

## Known limitation — delivery-guarantee DSN ladder (tracked)

Flush-before-stamp closes the **Sentry-outage-with-valid-DSN** case. **Absent** DSN is guarded by the A18 boot-throw (prod/staging). **Invalid-but-present** DSN is NOT caught by A18's presence-only check and remains a residual — a no-op/failing transport can resolve `flush()` such that rows stamp without a real send. Full closure needs a synthetic canary-event health probe → parked to `docs/parked.md` ("AUDIT-FIX-B1 A7 — invalid-but-present Sentry DSN residual") for the HARDEN backlog.

## Open questions

- None blocking. B8 (§16.3 admin representation) carries the A17 question; invalid-DSN canary is parked (HARDEN).

## Next session starts at

- After operator merges PR #199: capture the squash SHA on `main`, backfill it into this log, and verify branch auto-delete (`git ls-remote`; `git push origin --delete feat/audit-fix-b1` if it survives).
- Otherwise: next AUDIT-FIX stratum (B8 for the §16.3 reconciliation, or the next audit finding).

## Context to preserve

- Branch `feat/audit-fix-b1`, HEAD = this log commit on top of `7ece7d5` (amended impl + riders + flush). Durable plan copy: `~/.claude/plans/splendid-chasing-barto.md`.
- Cascade: prior batch clean (adversarial 5-dim PASS · `@code-reviewer` clean · `@security-auditor` no finding); flush delta re-cascaded clean (`@code-reviewer` 0 CRITICAL/HIGH/MEDIUM/LOW · `@security-auditor` no exploitable finding — both Opus-pinned).
- Gate: `ZUGZWANG_ENV=preview just verify` green; full `pnpm vitest run` **1192 passed / 2 skipped / 5 todo (173 files)**, zero regressions.
- `vercel.json` carries 3 crons (`r2-orphan-sweep`, `close-due-markets`, `alarms-drain`) — no DP.1 collision.

## Time

~1.5h wall this session (2026-07-04, resume + close-out); prior paused session ~2.5h (2026-07-03).
