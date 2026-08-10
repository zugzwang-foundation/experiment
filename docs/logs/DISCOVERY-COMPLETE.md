ZUGZWANG · #311 GATE C — ONE BLOCKING FIX, THEN THE REVIEWERS.
Do not merge. Three items.

1. ⚠ C8 / V13 — `currentValue` IS MARKET-SCOPED AND MY RULING SAID
   POST-SCOPED. hero.ts's own docstring states it: "authorStake is POST-scoped
   and this is MARKET-scoped … the ruled, accepted cost of +0 queries." That
   was not ruled. OD-1's rationale was: two numbers joined by an arrow must be
   the same quantity at two times. As built, an author with three Đ1,000 YES
   posts sees `Đ 1,000 → Đ 4,221` on every panel — a 4x gain on an argument
   while roughly flat. Invisible on staging (single-bet authors), wrong in
   production, on a public surface, attributed to a named pseudonym. Same
   class as the S-3 CRITICAL.

   FIRST, ANSWER — do not build yet:
   a. Can this post's own bet `shareQuantity` ride the EXISTING picked-posts
      select as a LEFT JOIN (bets.commentId = comments.id), the same pattern
      C7 used for imageUploads? Confirm +0 round-trips or say it is not free.
   b. ⚠ `positions` is FUNGIBLE — after a partial sell, "this post's shares"
      is not cleanly defined. Proposed handling: value
      `min(betShares, heldQuantity)`, and null when heldQuantity is 0. Is that
      the honest degradation, or is there a better one?
   c. Does a post ever carry MORE THAN ONE bet? If so the join is not 1:1 and
      the shape changes.
   Report a, b, c and your recommendation. The founder rules, then you build.

2. AFTER the V13 fix lands — RE-RUN BOTH REVIEWERS on the FULL range
   (aff76b3..HEAD, not just Group 2 — the fix touches C8 and the range should
   cover what it changed):
     @code-reviewer   — Group 2 (C5-C8) and the V13 fix
     @security-auditor — the ADR-0034 D-1 boundary and the SC-1 image join
   ⚠ Answers as SEPARATELY-STATED POINTS, never a bare PASS. The founder has
   raised the spend limit. Group 1's reviewer found a CRITICAL and my read
   found this one in the unreviewed group — the cascade is earning its keep.

3. TWO REGISTER ROWS, no code:
   a. `(admin)/…/ReviewFeed.tsx:102-104` — the surviving third side-chip
      hand-roll. Mapping is CORRECT today and it is EXCLUDED from C0's guard
      by directory. Record that it is the chip the operator reads sides from
      while moderating, that it is unguarded, and that it can drift. Route to
      an admin pass, not PRIMITIVES-2.
   b. OQ-3 — PositionMarker outline→filled on /bookmarks and /u/[pseudonym],
      ACCEPTED per my earlier ruling. Record as a known accepted delta so
      POLISH.5/.6 inspect the consolidated state instead of re-filing it.

OQ-2 stays HELD — do not change the reply-head tier. `text-n4` is the dimmer
choice in the inverted ramp and is plausibly right; the founder decides it on
staging.
OQ-4 / CC-5 is correctly deferred — SPEC.2 is web-authored, do not draft it.