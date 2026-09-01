# BLOCK-2 — session log

Attended follow-up to BLOCK-1, same branch/PR (`feat/block-1-resolution-content`,
PR #447). Full report: `~/Downloads/zz_BLOCK-2_report_2026-08-31T1744.md`.

**What landed** — 3 commits: (1) a deterministic repair of YCP-01's staging
description, correcting BLOCK-1's over-broad rename to the actual
founder-ruled scope (one phrase substituted, not the bare noun everywhere);
(2) oktoberfest's RESOLUTION block corrected from the brand name
"Oktoberfest" to the founder-ruled literal surface "oktoberfest.de"; (3)
confirmation (code comment + regression test, no functional change) that
claude-bundle-response's single-account RESOLVER chip is intentional.

**Decisions made** — none required founder judgment from this session; all
three items arrived pre-ruled. The one judgment call was mechanical: how to
implement the staging repair without repeating BLOCK-1's over-broad
mechanism — resolved by hardcoding both the expected-current and target
strings as literals (sourced from the committed S1 snapshot and the live
read respectively) rather than any pattern-based replace, so the script
can't over-match a second time.

**Open questions** — none carried forward from this task specifically.
BLOCK-1's own open item (claude-bundle-response's description still naming
three accounts while the chip shows one) is explicitly NOT this task's to
resolve — flagged as a separate, still-open decision.

**Next session starts at** — nothing queued for this branch. PR #447 is
ready for Gate C / founder merge review.

**Context to preserve** — `scripts/repair-ycp01-description.ts` is a
one-time repair, not a reusable tool; it hardcodes the exact before/after
text and will refuse to run again once staging no longer matches its
`EXPECTED_CURRENT_*` constants (which is now true — it already ran
successfully). Don't reach for it as a template for a future rename; reach
for `scripts/rename-ycp01-artifact.ts`'s guard structure (intent token +
target proof) instead, and hardcode literals rather than a pattern if the
scope is this narrow again.

**Time** — single attended session, 2026-08-31, immediately following
BLOCK-1's close-out in the same conversation.
