# AUDIT-FIX-A22 — session log (close-out)

**Task:** signup/sign-in event completeness (§8.8) + §3.5 spec-vs-built reconciliation — the split-out
remainder of B5. Auth critical path, full gated ritual, one chat across four relays (verify-live →
execute → E12 fold → close-out).

## What landed

- **PR #207, squash `b15a7f5`** (canonical SHA on main). Branch `fix/audit-fix-a22` deleted (remote
  auto-deleted; local `-D` after the empty tree-proof diff `d8f88fc` vs `origin/main` over all A22 paths).
  Preview deployed; **prod promote stays parked (DP.2) — no prod change.**
- **The three §8.8 participant emits are now live:**
  - `user.oauth_signed_in` / `user.otp_signed_in` at `databaseHooks.session.create.after`, discriminated
    on the endpoint path template (`/callback/:id` + `/callback/` prefix belt → F-AUTH-1;
    `/sign-in/email-otp` → F-AUTH-2; unknown path / null ctx → skip-and-log, never a mislabeled type);
  - `user.pseudonym_assigned` at `databaseHooks.user.create.after` — the only seam where the created
    `users.id` exists (the `create.before` pool hook runs pre-INSERT) — F-AUTH-3.
  - Each is a **§7.5.1 sub-case-(b) post-commit carve-out** behind the **verify-then-emit fabrication
    guard** — the load-bearing safety mechanism: Better Auth 1.6.11 drains `create.after` hooks
    post-commit via `queueAfterTransactionHook` **even when the wrapped transaction rolled back**
    (pendingHooks drain before the rethrow in `@better-auth/core` `runWithTransaction`), so each emit
    SELECTs the originating row by PK on our own db client in the post-commit micro-tx and skips when
    absent; payload/actor data reads the COMMITTED row only, never hook input. Benign missing entry
    tolerated (the `user.signed_out` precedent); fabricated audit row impossible.
- **Files:** `src/server/auth/post-commit-events.ts` (new), `src/server/auth/index.ts` (additive `after:`
  wiring only), `docs/specs/SPEC.2.md` (E1–E12 + §0 → **1.0.16**), `docs/plans/AUDIT-FIX-A22.md`,
  `tests/server/auth/{oauth-signin-event,otp-signin-event,pseudonym-assigned-event,post-commit-events-wiring}.test.ts`
  (14 tests).
- **§3.5-vs-built reconciliation (ratified option i, amend-spec-to-built):** §3.5 preamble + sequence
  (`{ data: false }` → `ONBOARDING_REQUIRED`-throw drift corrected) + F-AUTH-3 full rewrite to the built
  hook-folded architecture + F-AUTH-4 isolation (SERIALIZABLE → default) + two pre-existing-observation
  paragraphs; §3.7 CI-lint dir (`identity` → `identity-pool` + post-commit-carve-out false-positive
  clause); §3-SSOT + Appendix A (phantom `identity/assign.ts` → built `identity-pool/consume.ts`); §8.3
  onboarding-loop + cancellation-safety; §16 F-AUTH-4 evidence isolation; §7.5.1 sub-case (a)/(b) split
  + fabrication-guard mandate; §19.4.1 two rows (E12); §0 → 1.0.16 (Status + Version + Date + changelog).
- No migration, no new ADR, no backfill; deferral gate / pool consumption / isolation levels untouched.

## Decisions made

- **Pre-ratified (operator via web):** option (i) amend-spec-to-built · verify-then-emit guard ·
  isolation = describe-built + correctness follow-up · touch §16 · both follow-ups filed at close-out.
- **CC execution decisions (documented in module docstring + plan):** unexpected emit errors PROPAGATE
  (the `signed_out` precedent — loud via Sentry, sign-in retryable; only the logged benign-missing-entry
  branches skip silently); `metadata.ip`/`user_agent` from the VERIFIED sessions row with `|| "unknown"`
  (empty string → placeholder); `pfp_filename`-NULL belt branch (same never-fabricate class as the
  ratified `google_id`-NULL edge); §0 Date field bumped alongside Version (date-follows-version
  convention — one field beyond the kickoff's literal enumeration, surfaced in the PR body).
- **E12 fold (operator ruling, pre-merge):** the §19.4.1 userId strips folded into the unmerged A22
  commit via amend (`06fcf3b` → `d8f88fc`) — no 1.0.17 minted; the 1.0.16 changelog row amended in place.

## Surprises caught + fixed in-session

- **security-auditor SURPRISE → CLOSED IN A22 (E12 fold, NOT spun out).** §19.4.1 stripped
  `payload.googleId`/`payload.email` for the two sign-in events but **not `payload.userId`** — unlike
  every comparable user-scoped row, and inconsistent with Appendix B.13's class-level strip. Pre-existing
  ENGINE.6 authorship; A22 is what makes these events emit, activating the re-identification gap at
  export (raw UUIDv7 userId beside a §19.5-pseudonymized `aggregate_id`; the v7 prefix also leaks the
  account-creation instant). Chain: auditor point-4 finding → raised in `claude-progress.md` + PR body
  (not absorbed — unratified spec surface) → operator fold ruling → E12 anchors byte-verified → two rows
  + changelog amendment → amended commit `d8f88fc` → PR body updated in place.
- **Full-suite exactly-once fragility (test fix post-RED):** the unfiltered `SELECT FROM events`
  exactly-once assertions broke in full-suite runs on other suites' leftover rows — scoped to an IN-list
  of the three A22 event types (deterministic under `fileParallelism: false`, still catches a mislabeled
  emit). Separately, one non-reproducing full-suite failure (13:45 run); two subsequent full runs green —
  the B5-noted local-PG flake class.
- **Process note (gate-C timing):** the E12 amendment merged a beat ahead of the web E12 read — substance
  held (the rows were web-authored in the operator ruling, CC byte-matched the anchors, web confirmed
  post-merge), but keep gate C strictly pre-merge next time.
- **AGENTS.md phantom-path flag (close-out grep, folded here per kickoff):** AGENTS.md §3 carried
  "Greenfield — implied by the specs but NOT yet on disk: `src/server/identity/`… arrives in the DEBATE /
  later phases" — post-A22 the spec implies no such dir (it names the built `identity-pool/` path).
  One-line descriptive fix in this log PR. CLAUDE.md clean; AGENTS.md §9's `identity/` under `tests/` is
  the real `tests/server/identity/` — untouched.

## Ritual

- **Failing-first honored:** @test-writer wrote 4 files / 14 tests RED (module-not-found + unwired
  after-hooks) before any `src/` change; fixture SQL pre-validated against live :54322 schema.
- **Strictly-sequential cascade (Opus / effort max, one DB owner at a time):** @test-writer →
  @code-reviewer (zero CRITICAL/HIGH/MEDIUM; 2 LOW notes, non-blocking) → @security-auditor (zero
  actionable findings; all 6 directed points PASS; independently re-verified the drain-on-rollback
  mechanism in shipped Better Auth source; documented attack attempts against the guard — attacker-chosen
  ids, delete-between-commit-and-drain, pooled-connection reads — all defeated). No db-migration-reviewer
  (no DDL).
- **Gates:** full suite **1267 passed / 0 failed** (EXIT 0); `ZUGZWANG_ENV=preview just verify` green
  (pre- and post-E12); §5.10 self-audit clean (all 11+3 OLD/anchor strings byte-verified against live
  before editing; `index.ts` diff purely additive; no `1.0.<next>` remnant; commits SSH-signed).

## Open questions

- None blocking for A22. **FU-1** (pool-consume/user-insert non-atomicity) and **FU-2**
  (default-vs-SERIALIZABLE isolation on the two auth transactions) filed in `docs/parked.md` (this PR).
- **SYNC-sweep state note (surfaced, not absorbed):** the parked SYNC-sweep entry says SPEC.2 is
  "currently v1.0.15" and owes the A1/B1/B2/B3 §0 rows — A22 ran its own bump to 1.0.16, so the sweep's
  baseline statement is now stale (the owed A1/B1/B2/B3 rows + SPEC.1 bump + ADR-index/footer counts are
  unchanged obligations; new rows land above/below 1.0.16 per table order at sweep time).

## Next session starts at

Next task per tracker relay (A-series audit-fix remainder or DP.2 prod promote when scheduled). A22 has
no remainder. First action of any next session: fresh chat + `/clear`, read the kickoff, VERIFY-LIVE.

## Context to preserve

- **Better Auth 1.6.11 mechanism facts (verified in shipped source; re-verify on ANY version bump):**
  `databaseHooks.<model>.create.after` receives `(createdRow, endpointCtx)`; after-hooks are queued via
  `queueAfterTransactionHook` and drained post-commit (`runWithAdapter` end-of-handler / after
  `adapter.transaction` resolves) — **and drain even on rollback**; `ctx.path` is the route TEMPLATE
  (`/callback/:id`, `/sign-in/email-otp`). The OTP discriminator is exact-match and fails SAFE on a
  future path rename (null → skip, never mislabel).
- The emit functions are `server-only`, reachable only via the two hooks; `input:false` additionalFields
  still block identity spoofing; admin path (hand-rolled `admin_sessions`) never touches these seams.
- **Test convention minted:** events-table exactly-once assertions in the shared local PG must scope by
  `event_type` IN-list — unfiltered SELECTs break under other suites' leftovers even with
  `fileParallelism: false`.
- First-signup flow shape: gate throws ONBOARDING_REQUIRED → no session → no sign-in event on first
  contact; `pseudonym_assigned` emits at user-create; the sign-in event lands on the post-onboarding
  re-sign-in. Sign-in emit failures 500 an otherwise-committed sign-in (retryable; accepted posture).

## Time

2026-07-06, single chat, four relays: verify-live recon ≈45 min · execute (plan → RED tests → code →
spec E1–E11 + §0 → sequential cascade → gates → PR #207) ≈2 h · E12 fold + amend ≈15 min · close-out
(log + parked.md + AGENTS.md flag + PK staging) ≈30 min.
