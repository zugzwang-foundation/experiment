# AUDIT-FIX-B7a — session log (close-out)

**Task:** AUDIT.1 findings **A14** (unbounded Upstash transport) + **A24** (whitespace-only comment
bodies), the B7a half of the B7 split (B7b = A29/A31/A32/A33/A35, not this task; A27 dropped —
closed by ADR-0031 row 13). Bet-path critical → full gated ritual (tests-first §5.6, directed
reviewer cascade §5.11, gates §5.7, self-audit §5.10). Operator-ratified ODs: **OD-1**
`REDIS_MAX_RETRIES = 1` · **OD-2** `REDIS_COMMAND_TIMEOUT_MS = 2000` · **OD-3/OD-4** riders as
web-authored (`AUDIT-FIX-B7a_riders_web-authored.md`).

## What landed

- **PR #211, squash `7dabdc9`** (canonical SHA on main). Branch `fix/audit-fix-b7a`: remote
  auto-deleted at merge (`ls-remote` empty at close-out); local `-D` after the empty tree-proof
  (`git diff f5efe03 origin/main` EMPTY; trim-gate + `REDIS_COMMAND_TIMEOUT_MS` guard lines
  grep-confirmed on main).
- **A14:** `src/server/upstash/redis.ts` pins the shared singleton — `retry: { retries: 1,
  backoff: () => 200 /* flat */ }` + `signal: () => AbortSignal.timeout(2000)` (function form
  MANDATORY — a static signal makes the 1.38.0 vendor fabricate a 200 `{result:"Aborted"}`; the
  signal is minted once per command and covers the vendor's whole internal retry loop). Three
  HARDEN-tunable constants in `src/server/config/limits.ts` (new B7a section). Failure postures
  unchanged: rate-limit fail-open / idempotency fail-closed / mod-reserve fail-closed — an abort
  surfaces only as a throw.
- **A24:** `src/app/api/bets/place/route.ts` step-5 emptiness gate → `body.trim().length === 0`
  (`comment_requires_bet`); lower bound on trimmed, upper bound (`comment_too_long`) stays on raw;
  stored ≡ moderated ≡ submitted byte-identical. Replies flow through the same gate.
- **Tests (RED-first):** `tests/server/bets/validation.test.ts` +6 A24 cases;
  `tests/unit/upstash-redis-config.test.ts` (new) 6 A14 config assertions.
- **Riders (same commit, content-anchored, zero mismatches — byte-verified programmatically
  against the web-authored source):** SPEC.1 F-BET-1 Pre C.length sub-bullet (anchor
  `C.length ∈ [1, COMMENT_MAX_LENGTH]`, unique) · ADR-0015 in-place Patch record (transport
  bounding reconciled + accepted SETNX self-collision residual) · SPEC.2 §11 transport line
  appended after the anchor sentence *"The asymmetry across the three concerns is deliberate per
  ADR-0006 §'Failure-mode profile': open / closed / closed."* (quoted in the PR body per rider
  instruction) · parked.md SYNC-sweep extension (heading + originating line + target-1 B7a
  bullet). §0/§22 untouched per rider instruction.
- **Plan record** `docs/plans/AUDIT-FIX-B7a.md` — committed at execute start (`4ef4743` branch
  SHA, folded into squash `7dabdc9`); CC-reconstructed from the kickoff (see Decisions).
- **This log PR:** parked.md target-2 extension (B7a's SPEC.1 §7 F-BET-1 C.length rider added to
  the SPEC.1 §0 change-log enumeration) + parked.md B7a-bullet drift clause (F-BET-1 **Errors**
  row omits `comment_requires_bet` — pre-existing, code throws it since DEBATE.1;
  grep-verified line 282 pre-edit) + AGENTS.md §9 test-inventory (`upstash-redis-config`
  added to the `tests/unit/` line — the drift flagged at execute) + this log.

## Ritual — reviewer cascade AS ACTUALLY RUN

Sequential, one reviewer at a time (B5 lesson):

1. **@test-writer** (RED): 8 RED / 14 GREEN — A24 cases 1–3 (whitespace passes the old gate:
   `expected 200 to be 400`) + all 5 A14 retry/signal assertions (`expected undefined to be
   1/200/2000`, signal not a function); cases 4–6 + the `automaticDeserialization` pin verified
   honest GREEN pre-fix. Deviations recorded in its report (A14 file collects rather than
   erroring; cases 1–3 seed no Dharma so an empty ledger proves the tx never opened; `it.each`).
2. **@code-reviewer** (directed, per-point "verify AND STATE"): all 8 points CONFIRMED with
   file:line evidence — raw-body byte-identity through moderation + W-1; upper bound on raw; no
   second gate site; three failure arms untouched by the diff; abort-throw verified against the
   vendor request loop; config shape matches 1.38.0 types; constants match ODs; single Redis
   construction site. Zero CRITICAL/HIGH/MEDIUM; one LOW (below).
3. **@security-auditor** — **CC-ADDED beyond the ratified sequence** (the ratified plan/kickoff
   named only @code-reviewer — an intentional waiver; CC invoked it anyway citing the CLAUDE.md
   §5.11 critical-path mandate). Recorded as a deviation in the safe direction, surfaced in the
   PR body. Result: **no blocker** — INV-1..4 untouched, no weaponizable fail-open (the
   fail-closed idempotency gate sits strictly upstream of the fail-open rate-limit arm), the
   accepted SETNX self-collision residual verified terminally safe on place AND sell, no
   HTTP-in-tx, admin/participant separation intact.

**Gates (all green, RED→GREEN complete):** `ZUGZWANG_ENV=preview just verify` · `pnpm
test:invariants` 24/24 · `pnpm test:integration` 133/133 · full `pnpm vitest run` (:54322,
pnpm directly per house rule) 192 files / 1279 passed / 22-of-22 on the two touched files.
§5.10 self-audit clean before `gh pr create`; both commits SSH-signed.

## Verify-don't-trust

- **Plan-message → execution path drift (A24 test file):** the web plan message named
  `tests/server/comments/validation.test.ts`; the real F-BET rejection-matrix harness is
  `tests/server/bets/validation.test.ts` (no comments/ validation harness exists — the A24 cases
  are bet-entry rejections, F-BET-1 step 5). The **committed plan (§3) and the execution are
  consistent** on the `bets/` path; drift was in the upstream plan message only. No content
  impact.
- **Rider anchors:** all four byte-verified unique against the branch before editing (Python
  normalization check in-session); zero STOP conditions fired.
- **Post-merge tree proof:** `git diff f5efe03 origin/main` EMPTY + guard-line greps on main
  before this log branch was cut (the #136 lesson).
- **3b drift claim verified before recording:** SPEC.1:282 F-BET-1 Errors row enumerates seven
  codes, `comment_requires_bet` absent — confirmed pre-existing (route throws it since DEBATE.1).

## Decisions made

- **Operator (ratified pre-execute):** OD-1 retries=1 · OD-2 timeout=2000ms · OD-3/OD-4 riders
  as web-authored · security-auditor waived in the ratified sequence (see cascade note above).
- **CC execution decisions:** (1) no standalone plan file was relayed → `docs/plans/AUDIT-FIX-B7a.md`
  reconstructed verbatim from the kickoff + riders package with a provenance header (the
  self-contained-kickoff rule; surfaced as the §5.10 SURPRISE). (2) SPEC.1 rider inserted as an
  indented sub-bullet under the Pre bullet — keeps the flow list intact, text verbatim. (3) §11
  anchor sentence chosen and quoted in the PR body per rider instruction. (4) The three REDIS_*
  constants placed as a new `=== AUDIT-FIX-B7a ===` section at the end of `limits.ts` —
  "beside the OPENAI_* precedent" read as same posture/JSDoc style; literal adjacency would
  break the file's chronological task-section order. (5) security-auditor invoked despite the
  waiver (deviation, safe direction, clean pass).

## Surprises caught + LOW findings (all informational, none blocked)

- **SURPRISE (§5.10):** missing standalone plan file → reconstructed (above).
- **LOW (code-reviewer):** worst case is ≈2.2s, not a hard 2.0s — the vendor's 200ms
  inter-attempt backoff `setTimeout` is not signal-aware; a deadline landing mid-backoff overruns
  by ≤ `REDIS_RETRY_BACKOFF_MS`. Transport remains strictly bounded + abort-thrown; the ADR's
  "2.0s" reads as approximate. Note-only.
- **LOW (security-auditor, accepted residual of the ratified ruling):** Unicode
  default-ignorables outside `trim()`'s class (U+200B, U+2800, U+3164 …) still pass the emptiness
  gate. Bounded: costs stake, rate-limited, moderated on raw, attributed, admin-removable; INV-1
  structurally intact. Future-HARDEN candidate; NOT a ruling change.
- **LOW (pre-existing):** a transport abort on the mod-reserve SET (outside precommit's try) maps
  to 500 `error_internal` rather than 503 — fail-closed either way, fires
  `bet_handler_internal_error`; made reachable-at-2s (previously reachable-on-hang).

## Open questions

- None for B7a. **B7b awaits operator ratification** (A31 + A33 + A32 + A35; A29 routing — B7b vs
  the ENGINE.8 Q4 error-envelope/HARDEN deliverable — is still the operator's call, per the
  B7-A26 log).

## Next session starts at

B7b execute per operator ratification (or the SYNC.* sweep — the parked entry now carries six
originating tasks). Fresh chat + `/clear`, read the kickoff, VERIFY-LIVE against then-current
main. A31/A33 mechanism notes are in `docs/logs/AUDIT-FIX-B7-A26.md` §"Context to preserve" — do
not re-derive.

## Context to preserve

- **Vendor pin (encoded in ADR-0015 Patch + redis.ts comment + the A14 unit test — do not
  re-derive):** `@upstash/redis` 1.38.0 request loop — static signal fabricates 200
  `{result:"Aborted"}` on abort; function form rethrows; `signal()` evaluated once at
  request-options build, covering the whole `retries` loop; `retry.retries: 1` = 2 fetch attempts.
- **F-BET-1 Errors-row omission** (`comment_requires_bet`) now parked in the SYNC-sweep bullet —
  sweep-class, not a per-task fix.
- **Zero-width residual** recorded in PR #211 body + the security-audit report — future-HARDEN.
- **PK staging:** `~/Desktop/zz-pk-refresh-B7a/` — 7 files, md5-verified (table below).

## PK update table

| File | State | Keep/Verify/Add/Remove | Reason |
|---|---|---|---|
| `SPEC.1.md` | main @ `7dabdc9` | Verify (replace stale PK copy) | carries the F-BET-1 Pre C.length rider (A24 ruling) |
| `SPEC.2.md` | main @ `7dabdc9` | Verify (replace stale PK copy) | carries the §11 transport-bound line |
| `0015-rate-limit-idempotency.md` | main @ `7dabdc9` | Verify (replace stale PK copy) | carries the B7a Patch record (second patch record after B3's) |
| `parked.md` | `chore/b7a-log` (this PR) | Verify (replace stale PK copy) | SYNC-sweep entry: B7a bullet + errors-row drift clause + target-2 SPEC.1 enumeration |
| `AGENTS.md` | `chore/b7a-log` (this PR) | Verify (replace stale PK copy) | §9 test-inventory gains `upstash-redis-config` |
| `AUDIT-FIX-B7a-plan.md` | main @ `7dabdc9` (`docs/plans/AUDIT-FIX-B7a.md`) | Add | the committed ratified-plan record (provenance header) — `-plan` suffix, basename collision with the log |
| `AUDIT-FIX-B7a-log.md` | `chore/b7a-log` (this PR, `docs/logs/AUDIT-FIX-B7a.md`) | Add | this log — `-log` suffix |

## Time

2026-07-06, two chats: **execute** (recon + anchors ≈25 min · plan commit ≈5 min · @test-writer
RED ≈15 min · implement + riders ≈20 min · @code-reviewer ≈10 min · @security-auditor ≈10 min ·
gates ≈10 min · self-audit + PR #211 ≈15 min) · **close-out** (post-merge proof + parked/AGENTS
edits + log + PK staging ≈25 min).
