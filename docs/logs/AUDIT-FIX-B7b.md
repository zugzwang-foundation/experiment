# AUDIT-FIX-B7b — session log (close-out)

**Task:** AUDIT.1 findings **A29** (§4.4 envelope on the two sign routes) + **A31** (positions
market_id index) + **A32** ((dev) scaffold deletion) + **A33** (image-uploads CHECK comment) +
**A35** (RESEND_FROM_EMAIL prod guard) — the B7b half of the B7 split (B7a = A14/A24, PR #211).
Auth + DDL touches → full gated ritual (tests-first §5.6, sequential directed cascade §5.11,
gates §5.7, self-audit §5.10). Operator-ratified ODs: **OD-1** INCLUDE `metadata.request_id`
wiring · **OD-2** presence-only guard · **OD-3** DROP the fs route-gone test · **OD-4**
security-auditor ENGAGED with directed scope.

## What landed

- **PR #213, squash `a66d359`** (canonical SHA on main — see Merge hygiene below; the relayed
  `4e1f9c2` is NOT a valid object anywhere in the repo). Branch `fix/audit-fix-b7b`: remote
  auto-deleted at merge (`ls-remote` empty at close-out); local `-D` after the empty tree-proof
  (`git diff 9787dd7 a66d359` EMPTY; envelope module head + 0023 index SQL + A35 gate lines
  grep-confirmed on main).
- **A29:** new shared `src/server/middleware/envelope.ts` (`envelope()` / `jsonResponse()` /
  `resolveRequestId()` — attributed duplication of the bets-private §4.4 helpers; bets copies
  byte-untouched, verified; unification + §15.1 metadata + the `error_origin_rejected` rename
  ride ENGINE.8 Q4). Both sign routes (`/api/uploads/sign`,
  `/admin/markets/media/sign`) migrated to `{ok:true,data}` /
  `{ok:false,error:{code,message,retry_after?}}` with `X-Request-Id` echo-or-mint on EVERY
  response; body `retry_after` on 429/503; ALL code strings verbatim (shape-only);
  `toEnvelope()` stays the code source, `lib/errors.ts` untouched. Caller
  `create-market-form.tsx` reconciled (`SignResponse` → envelope form; error branch reads
  `body?.error?.code`). **OD-1:** participant events `metadata.request_id` now carries the
  resolved id (was `'unknown'`; gate-verified nothing pinned the placeholder).
- **A31:** `positions_market_id_idx` — plain `(market_id)` btree in `src/db/schema/bets.ts` +
  migration `0023_positions_market_id_idx.sql` on the 0022 head (journal idx 23; snapshot
  prevId chain verified to the 0022 snapshot id). The generate run emitted EXACTLY the one
  predicted statement — drift gate clean. Applied + catalog-confirmed on :54322.
- **A32:** `src/app/(dev)/` deleted (single-file group, zero inbound refs; no fs test per OD-3).
- **A33:** `schema/image-uploads.ts` CHECK comment corrected — drizzle CAN express `check()`
  (bets.ts precedent); the constraint lives in hand-written 0006; pgTable declaration now would
  diff against the constraint-less snapshot and emit a duplicate-constraint migration; parity
  deliberately deferred. Comment-only, no schema object touched.
- **A35:** boot gate in `instrumentation.ts` (`env === "prod" && !RESEND_FROM_EMAIL` → throw;
  staging deliberately EXEMPT per parked SCAFFOLD.12 §10.b; empty string trips) + send-time
  backstop in `src/server/auth/email-otp.ts` throwing BEFORE any Resend construction
  (presence-only per OD-2). `??`→`||` on the fallback closes the empty-string-sender edge in
  every env (code-reviewer LOW, for-the-record). The entire auth/ touch.
- **Tests (RED-first, @test-writer):** 50 tests / 37 RED → all GREEN post-impl —
  `tests/server/storage/sign-route-envelope.test.ts` (14) +
  `tests/server/admin/markets-media-sign-envelope.test.ts` (13) + existing
  `markets-media-sign.test.ts` shape migration (6) + `tests/db/indexes/positions-market-id.spec.ts`
  (pg_indexes catalog-assertion mint, new dir) + instrumentation-register +5 A35 cases +
  `tests/server/auth/email-otp-from-guard.test.ts` (4).
- **AGENTS.md drift (rode PR #213):** §3 tree (drop `(dev)/`), §6 head 0022→0023 (+0023 ledger
  entry), §7 middleware list (+`envelope`), §9 test tree (+`indexes/`, +the two envelope suites,
  +email-otp guard).
- **Plan record** `docs/plans/AUDIT-FIX-B7b.md` — committed at execute start; recovered VERBATIM
  from the plan-mode session transcript (no plan file existed on disk) and stamped with a
  ratification header carrying the four kickoff OD rulings (see Decisions).
- **This log PR:** parked.md XFF entry (the B7b security-auditor out-of-scope SURPRISE,
  cross-linked to the same-class SCAFFOLD.3-FOLLOWUP-1 SURPRISE-1 row) + this log. **No
  SYNC-sweep extension owed — B7b landed zero spec riders** (gate-verified: SPEC.2 B.4 carries
  no index enumeration).

## Merge hygiene (second close-out addendum — verified before this log froze)

- **Canonical-SHA discrepancy RESOLVED:** operator relay said "squash `4e1f9c2`"; `git cat-file -t
  4e1f9c2` → *not a valid object* (0 hits across `git log --all`) — a relay typo/misread. The
  TRUE canonical SHA is **`a66d359`** (`a66d359ee30f8c79daa381df18e336c46ec00c0a`): `gh pr view
  213 --json mergeCommit` and the `origin/main` head agree; merged 2026-07-06T20:16:41Z by
  Zugzwang-world. `a66d359` is cited everywhere in this log + the parked.md entry; no other
  artifact references #213 by SHA.
- **Squash method CONFIRMED, no deviation:** `a66d359` has exactly ONE parent (`8ef34d4`) — not
  a merge commit; it is the only new commit on main for #213 (the 3 branch commits did not land);
  tree parity `git diff 9787dd7 a66d359` EMPTY (the reviewed tree landed byte-exact). House
  squash-only rule held — nothing to flag for web disposition.
- **Retro-gate-C note (per the close-out addendum, note-once):** #213 was merged ~1 minute after
  PR open (20:16:41Z) — the web gate-C diff read ran RETROACTIVELY (post-merge) rather than
  pre-merge. The byte-exact read artifact remains `~/Desktop/AUDIT-FIX-B7b-pr213.diff`
  (md5 `d62e00c7f7755f1a62bdc9430f2c24a7`, verified against a fresh `origin/main..HEAD` regen).
  No retro-read finding has been relayed as of this log; if one lands, it opens a new AUDIT-FIX
  task against `a66d359`.

## Ritual — reviewer cascade AS ACTUALLY RUN

Sequential, one reviewer at a time, directed per-point "verify AND STATE" (B5 lesson):

1. **@test-writer** (RED): 37 RED / 13 GREEN-control across 6 files; every RED verified failing
   for the right reason (flat shape / missing header / missing index / missing guard — never
   import/setup). DSN-confound guard encoded (prod A35 cases set the DSN + message-match
   `/RESEND_FROM_EMAIL/` so the RED is precisely the missing gate).
2. **@code-reviewer** (directed, 8 points): 8/8 PASS with file:line evidence — envelope module
   byte-faithful to the bets originals; bets/ diff EMPTY; all rejection sites per-route verified;
   A17 log discipline unchanged; scope containment (no bets/moderation/resolution/lib-errors/
   proxy/spec touches). Zero CRITICAL/HIGH/MEDIUM; one LOW for-the-record (`??`→`||`, deliberate).
3. **@db-migration-reviewer** (directed, 9 points): 9/9 PASS — one-hunk schema edit; 0023 =
   single 80-byte statement, no CONCURRENTLY (correct for the per-migration-tx runner), no drift
   leakage; journal append-only; snapshot chain `0023.prevId == 0022.id` verified; A33 claims
   fact-checked against 0006. No FAIL, no SURPRISE.
4. **@security-auditor** (OD-4 ENGAGED, directed, 7 points): 7/7 PASS — authz/origin behavior of
   both routes UNCHANGED (shape-only); REQUEST_ID_SAFE anchored/bounded, echo cannot self-500;
   OD-1 sink traced end-to-end (schema-validated bound-param jsonb, nothing renders it — LOW,
   inert); A35 gates leak no secret, cannot DoS staging; INV-1..4 + refusal triggers untouched;
   no HTTP-in-tx. One out-of-scope SURPRISE (below).

**Gates (all green, RED→GREEN complete):** `ZUGZWANG_ENV=preview just verify` (after `just
clean` — the A32 stale-validator gotcha) · `pnpm test:invariants` 24/24 · `pnpm test:integration`
133/133 · full `pnpm vitest run` (:54322, pnpm directly per house rule) 199 files / **1316
passed / 0 failed**. All four execute-gates cleared without a STOP: generate-drift (one index
only) · SPEC.2 positions-index enumeration (none — B.4 is a dataset-export column table, no web
rider) · `metadata.request_id` placeholder contract (nothing pins it; the sign-upload suites pass
caller-supplied ids) · `just clean` pre-push. §5.10 self-audit clean before `gh pr create`.

## Decisions made

- **Operator (ratified pre-execute):** OD-1 INCLUDE · OD-2 presence-only · OD-3 DROP · OD-4
  security-auditor ENGAGED (directed scope).
- **CC execution decisions:** (1) no plan file existed on disk → recovered verbatim from the
  plan-mode session transcript (`a82d5c75…` final message, 15,588 chars) + ratification header;
  provenance stated in the plan file and PR body. (2) Envelope messages written in the bets terse
  style ("origin not allowed", "rate limit exceeded", …) — codes are the contract, messages are
  display templates. (3) `resolveRequestId()` extracted as a named export (the bets inline
  echo-or-mint, function-formed for the two consumers). (4) AGENTS.md §7 middleware list gained
  `envelope` beyond the three planned drift spots — same descriptive-accuracy spirit, surfaced in
  the PR body. (5) The security-auditor XFF SURPRISE recorded (claude-progress.md + parked.md +
  PR body), NOT absorbed — pre-existing, out of the five-finding scope, not a kickoff STOP
  condition.

## Surprises caught + LOW findings (all informational, none blocked)

- **SURPRISE (out of scope, parked):** XFF-spoofable `extractIp()` rate-limit keying +
  `events.metadata.ip` in both sign routes (and the bets endpoint sibling) — pre-existing,
  byte-identical to base; parked with the same-class FOLLOWUP-1 SURPRISE-1 row for one HARDEN
  sweep. Web to disposition.
- **SURPRISE (close-out):** relayed squash SHA `4e1f9c2` does not exist — resolved to `a66d359`
  before the log froze (Merge hygiene above).
- **LOW (code-reviewer, for-the-record):** `??`→`||` in email-otp — deliberate; empty-string
  sender now throws in prod / falls back in non-prod instead of passing `from: ""` to Resend.
- **LOW (security-auditor, inert):** OD-1 makes `metadata.request_id` participant-influenced
  (≤200 chars of `[A-Za-z0-9_-]`) — traced to an opaque bound-param jsonb string nothing renders;
  same pattern the bets stack has carried since ENGINE.8. Forward breadcrumb: the 2026-11-06
  dataset build must keep treating it as an opaque escaped string.

## Open questions

- None for B7b itself. The retro-gate-C read may still surface findings (would open a new task).
- XFF parked entry awaits web disposition (HARDEN candidate).

## Next session starts at

Next task per operator kickoff — candidates: the SYNC.* sweep (parked entry carries six
originating tasks; B7b adds nothing to it), the HARDEN trusted-IP sweep (new parked entry), or
B8/DP per the sequencer. Fresh chat + `/clear`, VERIFY-LIVE against then-current main
(head `a66d359` at this log).

## Context to preserve

- **Envelope unification is DEFERRED BY DESIGN:** the bets stack keeps private copies;
  `src/server/middleware/envelope.ts` serves non-bet routes. §15.1 metadata + the
  `error_origin_rejected → error_origin_not_allowed` rename + participant
  `error_unauthenticated` vs bets `error_session_required` code drift ALL ride ENGINE.8 Q4 —
  don't "fix" them piecemeal.
- **A31 catalog-spec precedent minted:** `tests/db/indexes/` — pg_indexes assertions parse
  `pg_get_indexdef` NORMALIZED (unquoted) form; asserting the quoted migration form would
  false-GREEN never-match.
- **A35 scope pin:** staging exemption is deliberate (parked SCAFFOLD.12 §10.b sender flip);
  extending the gate to staging would hard-fail every staging deploy on a parked ops task.
- **tests/_setup/env.ts defaults BOTH `ZUGZWANG_ENV=prod` AND `RESEND_FROM_EMAIL=sandbox`** —
  env-guard tests must delete/restore both (`delete`, never `= undefined`).
- **PK staging:** `~/Desktop/zz-pk-refresh-B7b/` — 4 files, md5-verified (table below).

## PK update table

| File | State | Keep/Verify/Add/Remove | Reason |
|---|---|---|---|
| `AGENTS.md` | main @ `a66d359` | Verify (replace stale PK copy) | §3 tree −(dev)/, §6 head 0023, §7 +envelope, §9 test-tree additions |
| `parked.md` | `chore/b7b-log` (this PR) | Verify (replace stale PK copy) | +B7b XFF entry (cross-linked to FOLLOWUP-1 SURPRISE-1) |
| `AUDIT-FIX-B7b-plan.md` | main @ `a66d359` (`docs/plans/AUDIT-FIX-B7b.md`) | Add | the committed ratified-plan record (transcript-recovery provenance + OD header) — `-plan` suffix |
| `AUDIT-FIX-B7b-log.md` | `chore/b7b-log` (this PR, `docs/logs/AUDIT-FIX-B7b.md`) | Add | this log — `-log` suffix |

## Time

2026-07-07, one execute chat + close-out addenda: **execute** (recon + plan recovery ≈20 min ·
plan commit ≈5 min · @test-writer RED ≈20 min · implement + 0023 ≈30 min · cascade ≈20 min ·
gates ≈15 min · self-audit + PR #213 + diff artifact ≈10 min) · **close-out** (merge-hygiene
verification — SHA resolution + squash proof + tree parity — ≈10 min · parked/log/PK staging
≈25 min).
