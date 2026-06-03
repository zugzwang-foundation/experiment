# ENGINE.0 — Event-type Vocabulary Expansion · Execute Close-Out

**Task:** ENGINE.0 — register the 11 forward-stratum `event_type` payload schemas + the `numericString` validator (type-only / shape-only).
**Date:** 2026-06-03.
**Branch / PR:** `feat/engine-0-event-vocabulary` → **PR #69** (https://github.com/zugzwang-foundation/experiment/pull/69). Base `main` @ `7021c8c`.
**Roles:** CC executed; web reviewed the plan + ruled the two blockers; operator relays + merges.
**Outcome:** Implemented + reviewed clean; PR open. **Operator merges (squash).** Canonical SHA = squash-merge SHA on `main` (backfill post-merge).

---

## What landed (files + PR#)

PR #69, three commits (squash collapses them):
- `docs/plans/ENGINE.0.md` (`53d47e8`) — plan reconstructed from the reconciled inline kickoff content.
- `src/server/events/schemas.ts` (`919ee9b`) — `EVENT_TYPES` 11→22; 11 new `eventPayloadSchemas` entries; exported `numericString` validator. Existing 11 schemas + `eventMetadataSchema` byte-unchanged.
- `tests/server/events/insert.test.ts` (`919ee9b`) — inventory floor 11→22 + 11 round-trip driver CASES (written tests-first by `@test-writer`).
- `docs/logs/ENGINE.0.md` (this file) — separate close-out commit on the same branch.

Final 11: `market.created/opened/closed/resolved/corrected/voided`, `bet.placed`, `bet.sold`, `comment.placed`, `dharma.credited`, `payout.settled`.

## Decisions made

1. **Event names → SPEC.2 v1.0 canonical (spec > kickoff).** The kickoff proposed `resolution.resolved/corrected/voided` + `comment.posted`; SPEC.2 v1.0 (locked the same day) uses `market.resolved/corrected/voided` (§3.6) + `comment.placed` (§13.1/§19.4.1). Web ruled the kickoff names a web-side error — conform to spec, **no SPEC.2 amendment**. Conforming also keeps the §19.4.1 export PII-STRIP table matching; the kickoff names would have silently opened a strip-bypass leak path (a `comment.placed`-keyed strip rule that never fires on a `comment.posted` row → `body` ships to the public dataset).
2. **`numericString` = single SIGNED `NUMERIC(38,18)` validator** (web-ruled verbatim): `z.string().regex(/^-?\d{1,20}(?:\.\d{1,18})?$/, …)`. Used on every money/share/price/delta field — never `z.number()` (INV-2 exactness). Per-field positivity/sign (`stake > 0`, `payout ≥ 0`) is business logic deferred to ENGINE.5/8; `dharmaDelta` is explicitly negative-capable.
3. **Amendment A6 retracted.** `correctsEventId` / `resolutionEventId` reference `resolution_events.id` (SPEC.2 §3.6), not `events.event_id`. ENGINE.9 wires the referent; the fields stay `z.string().uuid()` at ENGINE.0 (no schema dependency). A1–A5 applied as specified.
4. **Plan-file source-of-truth correction.** The cited `.claude/plans/engine-0-cc-plan-mode-harmonic-fiddle.md` was absent everywhere (repo, `git log --all`, `~/Downloads`). Web ruled the reconciled inline kickoff content authoritative; `docs/plans/ENGINE.0.md` authored from it.
5. **`@security-auditor` LOW deferred, not fixed:** `resolutionNote`/`voidReason` are `z.string().min(1)` with no `.max()`. Admin-authored, no participant emit path; the upper bound belongs at the ENGINE.9 Server Action matching the `resolution_events.note` width. Not adding a guessed `.max(N)` at ENGINE.0 (scope discipline).

## Surprises caught + handled in-session

1. **Stale docstrings (FIX).** After expanding `EVENT_TYPES`, the `schemas.ts` header still said "canonical 11-string `event_type` enum" and the schemas docstring described only the original 11's provenance — orphans my change created (CLAUDE.md §5.3). Updated both to 11→22 with the ENGINE.0 forward-stratum note, in-session before PR.
2. **Commit-entanglement incident (RECOVERED).** A **concurrent VISUAL session (`chore/visual-backbone-docs`) sharing the same working tree** checked out its branch + staged 4 `docs/design/*.md` files and overwrote `/tmp/commit-msg.txt` *between* my plan commit and my code commit. My `git commit` swept my 2 ENGINE.0 files into their commit (`d767e3d`) on the wrong branch under the design message. Nothing was pushed. Recovery (operator-approved "split the commit"): the VISUAL session itself reset + recommitted design-docs-only (`d09cd23`, my files removed); I then stashed my 2 uncommitted files, checked out `feat/engine-0` (branch-guarded), popped, and committed with the ENGINE.0 message. Both branches end clean; `feat/engine-0` = 3 files vs main; `chore/visual-backbone-docs` = 4 design docs only.
3. **PRECURSOR.4 F.2.1 downstream flag (VERIFIED clean).** PRECURSOR.4 flagged: verify §19.4.1 strips Google `name`/`image` from OAuth/OTP event payloads. The existing `user.oauth_signed_in` (`{userId, provider, googleId}`) and `user.otp_signed_in` (`{userId, email}`) payloads carry **no `name`/`image`** — nothing to strip, no alignment needed. Flag resolved by observation; existing schemas untouched.

## Open questions

None blocking ENGINE.0. Two ENGINE.9 wiring questions (below).

## Next session starts at

ENGINE.9 (resolution/payout emit sites), when it lands, must:
- Add `.max(N)` on `resolutionNote`/`voidReason` at the admin Server Action (match `resolution_events.note` width).
- Resolve whether `payout.settled` is emitted **per-bet** or stays `payout_events`-table-only — SPEC.2 §3.6 says resolution emits "a single terminal `events` row"; the registered shape is per-bet (plan self-critique #3). Then wire `correctsEventId`/`resolutionEventId` → `resolution_events.id`.

Immediate next action: monitor PR #69 CI (the 22-case real-Postgres round-trip runs there — not runnable locally, Docker off), then operator squash-merges.

## Context to preserve

- **Shared-working-tree hazard (operational).** Two Claude sessions (ENGINE.0 + VISUAL-backbone) ran against the **same clone** simultaneously → branch/commit/`/tmp` collisions, caught only because the commit message + branch were visibly wrong. **Going forward: isolate parallel sessions** — separate `git worktree`s or clones per lane. This is the root cause of the entanglement above and will recur otherwise.
- **Source-of-truth precedence:** SPEC.1/SPEC.2 > ADR > tracker > **kickoff** (kickoff ranks lowest). Verified by file:line; on a kickoff↔spec conflict the spec wins.
- **`numericString` is exported** (`import { numericString }`) for ENGINE.5/8 reuse — the canonical money-field validator. Don't re-roll it.
- **Verification posture:** RED→GREEN was demonstrated via `tsc` (tests are type-checked; the new CASES bind to the `EventType` union). The vitest real-Postgres round-trip is CI-only locally. Note the kickoff's named gate commands (`pnpm test:integration` / `just test-db`) do **not** cover `tests/server/events/` — those tests run under bare `vitest run` (CI).

## Time

2026-06-03. One execute session. Two web rulings mid-session (event names, `numericString`); one concurrent-session commit-entanglement recovery.
