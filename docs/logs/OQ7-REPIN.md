# OQ7-REPIN — session log

**Class:** doc/config chore · execute-lite · no ultracode · no Gate C · one PR
**Date:** 2026-07-18

## What landed

PR #245 — `chore: re-pin subagents to claude-opus-4-8 (post-Fable window) + CLAUDE.md §6 reconcile` (branch `chore/oq7-opus-repin`, impl commit `e61721f`).

- `.claude/agents/{code-reviewer,db-migration-reviewer,security-auditor,test-writer}.md` — `model: claude-fable-5` → `claude-opus-4-8`; `effort: max` unchanged.
- `CLAUDE.md` §6 — model paragraph reconciled to post-window state as an append-only pin-history lineage (2026-06-10 Fable pin → 2026-06-28 Opus revert → 2026-07-16 UI.0 window → 2026-07-18 early close); window record appended, nothing erased.

STEP 0 ground (verified pre-write): `origin/main` tip `3b2d07d` = the #244 squash directly atop `212d468`; A4 squash ≡ branch content over the 28 branch paths (zero diff `edcfb15..origin/main`); root `src/app/page.tsx` absent / `(public)/page.tsx` present on main; remote `feat/ui-a4-discovery` already auto-deleted; local branch deleted post-zero-diff-gate; local `main` fast-forwarded to `3b2d07d`.

## Decisions made

- §6 lineage phrased per the `docs/maintenance.md` harness-history pattern (dated, append-only) rather than replacing the stale "(Fable 5 is currently unavailable)" sentence with a bare current-state claim.
- Kickoff cited "31 branch paths"; the definitive diff shows 28. Treated as advisory operator drift (zero-diff proof is the load-bearing check), not a STOP.
- PR body carries no AI-attribution footer, matching project precedent (#244).

## Open questions

- Noted drift, deliberately not absorbed (kickoff scope was §6 + the four frontmatters, nothing else): CLAUDE.md §7 decision-log entry still reads "(Fable currently unavailable)"; `docs/maintenance.md` harness-history has no 2026-07-16→18 window entry. Both flagged in the PR #245 body as candidates for the next sweep.

## Next session starts at

Operator squash-merges #245 on green (no web gate on this class). Next task per the kickoff's NOT-DOING: A4 close-out owns the A4 follow-ups; tracker/specs/standing set untouched.

## Context to preserve

- Verify gate on this branch: `just clean && ZUGZWANG_ENV=preview just verify` → All checks passed (exit 0); `ci` green on PR #245 in 4m11s.
- Pre-push Biome surfaced one pre-existing unrelated warning (`tests/server/moderation/moderation-blocked-event.test.ts:1` unused import) — left alone per §5.3.

## Time

~20 min.
