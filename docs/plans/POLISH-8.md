TASK: POLISH.8 · PLAN-COMMIT + EXECUTE. Machine phase. Overnight, unattended.
Pre-authorised under founder ruling D4: no verdict round. Gate C is the ONLY
remaining checkpoint, and it happens in the morning, not in this session.

⚠ THIS RELAY BODY IS THE COMMITTED PLAN. You do not author a plan.
Commit it VERBATIM as docs/plans/POLISH-8.md at commit 0. Do not normalise,
reword, reformat, renumber or "improve" a single sentence. If a sentence looks
wrong, HALT and QUOTE IT.

FOUNDER RULING GOVERNING THIS SURFACE:
"Admin pages are internal — they should be simple and not heavy. Just the core
functions should work."
Axis A (tokens) is REPORT-ONLY except S-1. Axis B (does it work) is the run.
Axis C (the invariant) already PASSED at recon and is not re-litigated.
No visual work. No aesthetic changes. If a change makes admin prettier rather
than more correct, it is out of scope by ruling.

═══════════════════════════════════════════════════════════
⛔ 0 · STOP CONDITIONS — read before anything else

WRITE A HALT REPORT AND STOP THE ENTIRE RUN if ANY of these becomes true.
Do not work around. Do not "handle it and continue." STOP.

  ⛔ S-0a  The string `sexual_minors`, `sexual/minors`, or `minors` appears
           ANYWHERE in your working diff, in any file, for any reason.
           This is deliberately over-broad. Stop and report the file and line.
  ⛔ S-0b  Any change under `src/server/**`.
  ⛔ S-0c  Any change to the moderation act path, ban logic, the classifier
           seam, `moderateComment`, `recordGateBlock`, or any BLOCKED_REASONS
           member.
  ⛔ S-0d  Any DDL, migration, new EVENT_TYPES value, ADR edit or SPEC edit.
  ⛔ S-0e  Any change under `tests/unit/design/**`.
  ⛔ S-0f  `tokens-monochrome.test.ts` goes red.
  ⛔ S-0g  `just verify` or the suite is red at a commit boundary. Do NOT stack
           commits on red. One exception: a guard deliberately committed RED
           whose RED output was captured BEFORE any fix was written.
  ⛔ S-0h  A second vitest runner is detected. Use `pgrep -f 'node.*vitest'` —
           `ps | grep` matches its own command string.
  ⛔ S-0i  The branch already exists, or `git branch --show-current` disagrees
           after checkout. A colliding `checkout -b` is a no-op that silently
           leaves HEAD on main.
  ⛔ S-0j  A reviewer returns a CRITICAL you cannot fix inside the edit boundary.
  ⛔ S-0k  Any file outside the declared edit boundary (§4) would change.

⛔ NEVER MERGE. NEVER push to main. NEVER self-merge.
The run ENDS at PR-open. Gate C is a web diff-read the founder performs in the
morning on an UPLOADED diff file. See §9.

═══════════════════════════════════════════════════════════
1 · SETUP

- Fetch first. Branch off origin/main. Report the tip SHA you branched from.
- Branch name: `polish/8-admin-centre`. If it exists remotely or locally,
  ⛔ S-0i fires — stop, do not improvise a name.
- `git status --porcelain` empty at start.
- ⚠ PR #322 (MOD-REPORT-PATH, docs-only) is open and touches
  docs/polish/POLISH-TRACKER.md. This run touches NO doc under docs/polish/,
  so there is no conflict. If #322 merges mid-session, RE-VERIFY your branch
  still exists remotely before pushing — an auto-deleted branch has twice been
  recreated carrying an already-merged duplicate.
- NEVER `git add -A`. It once replaced a 195-line session log with 47 lines of
  pasted relay text and no gate saw it. Stage by explicit path, every time.
- ULTRACODE IS FORBIDDEN ON EVERY COMMIT IN THIS RUN. Every commit here carries
  an ordered proof obligation — a RED captured before a fix, or a positive
  control captured before an assertion — which fails CLAUDE.md §6 condition 4
  even inside a granted surface.

═══════════════════════════════════════════════════════════
2 · COMMIT 0 — the plan

Write this relay body VERBATIM to docs/plans/POLISH-8.md. Add nothing.
Commit alone: `docs(polish): commit POLISH.8 plan (web-authored, verbatim)`

═══════════════════════════════════════════════════════════
3 · THE SHIP SET — eight deltas, in this commit order

Every item names its DISCRIMINATING CONDITION (V-7): not just what to measure,
but the case where the defect WOULD appear. A proof that only exercises the
case where the change is inert is not a proof, and saying so in the commit body
does not discharge it. That is exactly how .7a's §7.1 shipped nine routes all
shorter than the viewport.

Every citation you write is a SECTION ANCHOR, never a line number, into any
living prose document (V-8). Source-code coordinates stay as file:line.

───────────────────────────────────────────
S-1 · D01 — R7 / B12 / PD-0-07
FILE: src/app/(admin)/admin/moderation/audit/page.tsx:75 (inside BanIndicator)
CHANGE: `text-white` → `text-background`. That token, not `text-ink`, not
`text-foreground` — it is the pairing the sibling BANNED pill already uses at
ReviewFeed.tsx:170 for the same semantic on the same bg-destructive surface.
ONE CLASS. Change nothing else on that line or in that component.

⚠ BEFORE WRITING THE FIX — capture two things and paste BOTH into the commit
body. This ordering is mandatory and is why ultracode is forbidden here.

  (a) THE POSITIVE CONTROL / R15's natural RED.
      Run, against the UNFIXED tree:
        grep -rnE '\b(bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|accent|caret|divide)-(white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?\b' src/ | grep -v '\.test\.'
      Capture the output. It must return EXACTLY ONE hit: audit/page.tsx:75.
      A probe that returns nothing on the unfixed tree proves nothing.
  (b) THE R15 HANDOFF ARTIFACT.
      Write the above predicate as a THROWAWAY, UNCOMMITTED probe script in
      /tmp. Run it against the unfixed tree. Capture its RED output verbatim.
      ⚠ DO NOT COMMIT THE PROBE. ⛔ S-0e forbids touching tests/unit/design/**.
      Paste the RED into the commit body AND into the session log under a
      heading `R15 HANDOFF — natural RED, captured pre-fix`.
      State plainly in the log: this is EVIDENCE THE PREDICATE DISCRIMINATES,
      NOT a committed RED-first receipt. R15 still needs a real RED at mint,
      by axis-① mutation, because this fix removes its only live instance.

AFTER: the same grep returns ZERO. State the count, do not claim it.

───────────────────────────────────────────
S-2 · D28 — pin the CC-9 side chip. DO NOT CONSOLIDATE IT.
FILE UNDER TEST: src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx
                 (the `Row` component, chip at :100-108)
⚠ THE CHIP STAYS HAND-ROLLED. Founder-ruled. Do NOT wire it to SideBadge or to
any src/components/** rendering primitive — H-P8-2 fires and PRIMITIVES-2 D5's
zero-call-sites guard depends on it staying unwired.

NEW TEST. Place it beside the existing admin/moderation tests — determine the
exact directory from the live tree and REPORT the path you chose. It must NOT
land under tests/unit/design/** (⛔ S-0e).

ASSERT BOTH POLES. Render the real `Row`/`ReviewFeed` component — not a
reassembled lookalike (V-1):
  - a row with side === "YES"  → carries bg-yes
  - a row with side === "NO"   → carries bg-no
A YES-only test passes on an inverted NO panel. That is exactly how the last
live INV-3 inversion survived a full PR with tests.

DISCRIMINATING CONDITION — RULE-1, both membership axes, RED CAPTURED FIRST:
  ① Mutate the component to swap the two branches. Run. Capture RED. Revert.
  ② Mutate the component to hard-code ONE pole for both sides. Run. Capture
     RED. Revert.
Paste BOTH RED outputs into the commit body. A guard green on first run means
the predicate is wrong (H15).

───────────────────────────────────────────
S-3 · D11 — ordinary confirm on Close
FILES: src/app/(admin)/admin/markets/_components/terminal-actions-logic.ts
       src/app/(admin)/admin/markets/_components/TerminalActions.tsx
BASELINE, quoted: SPEC.1 §15 F-ADMIN-3 Confirmation — "Two gates, both
mandatory on Resolve and Void; Close requires a single ordinary confirm (it is
reversible in effect ... and carries no settlement)."

⚠ THE UI-6 PLAN CONFLICTS WITH THIS. docs/plans/UI-6.md §2.S2 says "Close stays
one-click" and its Acceptance line reads "Close one-click." SPEC OUTRANKS PLAN
— that precedence is the ruling, taken by web Claude, and it is FLAGGED FOR
GATE C in your session log under `RULINGS TAKEN`. Record the conflict in full,
both quotes, so the founder can reverse it in one line.

CHANGE: add an `requiresOrdinaryConfirm` predicate to the pure logic module —
true for Close, false for Resolve/Void/Correct (which already carry the typed
gate). Wire it in TerminalActions using the `window.confirm` idiom already
present at ReviewFeed.tsx:70. Do not invent a new confirm mechanism.

DISCRIMINATING CONDITION — the test must FAIL if the confirm is bypassed:
  - confirm returns FALSE → the action is NOT invoked. Assert the call count
    is zero, not that a flag was set (V-3: asserting a call exists is not
    asserting what it does).
  - confirm returns TRUE  → the action IS invoked. This is the positive
    control; without it the first assertion passes on a broken button (N3).
  - unit-assert SET EQUALITY over which actions require which gate — not a
    count (N5). A fifth action cannot appear silently and a fourth cannot be
    quietly dropped.

───────────────────────────────────────────
S-4 · D12 — the typed confirm restates the side and names permanence
FILE: TerminalActions.tsx:156-171
BASELINE, quoted: SPEC.1 §15 F-ADMIN-3 Confirmation — "The confirm restates the
winning side (Resolve) and names the action as permanent, with corrections
available only via F-RESOLVE-2 clawback."
CHANGE: COPY ONLY, from data already in props. No behaviour change, no new
prop, no read-model field.

⚠ THIS IS SIDE-ENCODING COPY. It is TEXT. Never colourise it, never key a
colour off it — INV-3's poles encode side and this is not a pole site.

DISCRIMINATING CONDITION — BOTH POLES, non-negotiable:
  - a YES-winning resolution confirm names YES
  - a NO-winning resolution confirm names NO
  Assert both strings. A YES-only test passes on a confirm that says YES for
  both sides, which is the worst possible failure on this control.
  - separately assert the permanence sentence is present.

───────────────────────────────────────────
S-5 · D19 — create-market error copy
FILE: src/app/(admin)/admin/markets/new/create-market-form.tsx:118, :124
BASELINE: SPEC.1 §15 F-ADMIN-1 Errors — ten codes.
CHANGE: mirror the existing `terminalErrorCopy` shape from
terminal-actions-logic.ts:135-144. Stop discarding `error.message` and
`field_errors`.

⚠ HALT CONDITION SPECIFIC TO THIS ITEM: read the ten codes from SPEC.1 §15
F-ADMIN-1 AND from the create action's actual error union in src/server/. If
the two sets DISAGREE, that is a finding — STOP this item, report both sets,
and continue with the other items. Do not reconcile them yourself; one of them
is wrong and deciding which is a spec question.

DISCRIMINATING CONDITION:
  - assert SET EQUALITY between the copy map's keys and the code set (N5).
    Never a count.
  - an UNKNOWN code must still surface the raw code to the operator. Assert it.
    Never swallow a code you have no copy for — that trades one unreadable
    failure for a silent one.

───────────────────────────────────────────
S-6 · D17 — a malformed date filter must be visible
FILE: src/app/(admin)/admin/moderation/audit/page.tsx:245-264 (`parseFilters`)
TODAY: `new Date("junkT00:00:00.000Z")` → NaN → predicate silently omitted →
the operator receives UNFILTERED results while believing a date filter applied.
CHANGE: render a visible note when a supplied date fails to parse. Match the
existing role="note" idiom already in this file at :472-484. Do not change the
query, do not change parse semantics, do not throw.

DISCRIMINATING CONDITION — both directions:
  - an INVALID date → the note renders
  - a VALID date    → the note does NOT render  (positive control; without it
    a note that always renders would pass)

───────────────────────────────────────────
S-7 · D20 — label the deadline field UTC
FILE: create-market-form.tsx:141-145 (the LABEL only)
⚠ The UTC PARSE IS SPEC-RATIFIED (SPEC.1 §15 F-ADMIN-1: "minute-granular and
parsed as UTC"). DO NOT CHANGE THE PARSE. Only the label is the delta.
CHANGE: the label states UTC explicitly.
PROOF: render assertion that the label contains "UTC". A source grep is the
weak form (V-4) — assert the rendered output.

───────────────────────────────────────────
S-8 · D06 — the placeholder advertises an unmatchable value
FILE: audit/page.tsx:302
TODAY: the Action-type placeholder reads "content_removed · market.resolved …".
`market.resolved` is an EVENT_TYPES value living only in `events` — NEITHER
union side can ever match it.
CHANGE: the placeholder lists only values that can actually match today
(mod_actions.reason members). Keep it consistent with the honest note already
rendered at :472-484.
⚠ FLAG IN THE LOG: this is downstream of D05's unmade ruling. If D05 later
lands a writer or repoints the spec at `events`, this placeholder changes
again. Shipping the currently-true copy is the defensible option (§4.2 B3);
say so rather than leaving it.

DISCRIMINATING CONDITION: assert no EVENT_TYPES value appears in the
placeholder string. POSITIVE CONTROL: assert the same probe DOES match when
one is planted. A probe that matches nothing passes vacuously (V-2/N3).

═══════════════════════════════════════════════════════════
4 · THE EDIT BOUNDARY — nothing outside this list changes

ALLOWED, and only these:
  docs/plans/POLISH-8.md                                  (commit 0, verbatim)
  docs/logs/POLISH-8.md                                   (the session log)
  src/app/(admin)/admin/moderation/audit/page.tsx
  src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx  ⚠ MUTATE-AND-
      REVERT ONLY, for S-2's RED capture. It must be BYTE-IDENTICAL at PR head.
      Prove it: `git diff origin/main -- <path>` returns empty. State the result.
  src/app/(admin)/admin/markets/_components/terminal-actions-logic.ts
  src/app/(admin)/admin/markets/_components/TerminalActions.tsx
  src/app/(admin)/admin/markets/new/create-market-form.tsx
  the new admin-side test file(s) for S-2, S-3, S-4, S-6, S-7, S-8

FORBIDDEN, without exception:
  anything under src/server/**  ·  any read-model field  ·  any handler or
  submit path  ·  any migration, event type, ADR or SPEC edit  ·  anything
  under tests/unit/design/**  ·  any doc under docs/polish/  ·  any file under
  src/app/(public)/** or src/components/**  ·  any file not listed above.

⚠ DO NOT TOUCH docs/polish/POLISH-0.md, POLISH-TRACKER.md, POLISH-register.md
or docs/parked.md. Recon found seven class-S rows against them. THEY ARE
WEB-AUTHORED AND LAND AT THE CLOSE-OUT, in a separate PR, exactly as .7a did
(#320 machine, #321 close-out). Record them in your session log; do not fix them.

═══════════════════════════════════════════════════════════
5 · THE HALT SET — base H1–H17 plus these, AMENDED per your recon

  H-P8-1  A fix would touch src/server/admin/** or src/server/auth/admin/**.
          ⚠ AMENDED per your H-P8-8: IMPORTING from src/server/auth/admin/**
          also fires this. The ambiguity resolves toward the halt.
  H-P8-2  A fix would wire an (admin) call site to SideBadge or any RENDERING
          participant primitive.
          ⚠ AMENDED per your finding: pure formatters already imported
          (`@/components/debate/format`) are the ratified exception —
          no-raw-dharma-render.test.ts scans (admin) and re-hand-rolling Đ
          would fail it. Do NOT "fix" P8-D02 by duplicating formatDharma.
          P8-D02 is a RECORD defect, not a code defect.
  H-P8-3  A fix would touch tests/unit/design/**.
  H-P8-4  ⛔ The moderation act path, ban logic, the classifier seam, any
          sexual/minors carve-out — ⚠ WIDENED per your recommendation: OR ANY
          UNBUILT F-ADMIN-4 ARM (D07, D09, D10).
  H-P8-5  ⛔ Any participant affordance found under (admin). PASSED at recon
          with positive controls; if the execute tree ever contradicts that,
          stop.
  H-P8-6  An axis-A delta other than S-1 is proposed for BUILD.
  H-P8-7  ⚠ ACCEPTED AND MINTED — your proposal. A delta whose named owner is
          a task that has ALREADY CLOSED is class S and halts on the OWNER, not
          on the work. D07/D09/D10 are all held by it via D08.
  H-P8-8  Folded into H-P8-1 above rather than kept separate.

A halt stops that DELTA and reports. It does not stop the run unless ⛔.

═══════════════════════════════════════════════════════════
6 · PER-COMMIT DISCIPLINE

- Run `just verify` on the UNCOMMITTED tree BEFORE each commit. A green run
  AFTER is weaker evidence — Lefthook formats staged files at pre-commit and
  silently repairs the class of defect the post-commit run would catch.
- One delta per commit for S-1 through S-5. S-6, S-7, S-8 may share one commit.
- Every counted claim is RE-VERIFIED AT PR HEAD, not when you wrote it. A
  counted inventory went from 9 files to 13 four commits later.
- State every count. Never claim one.
- Stage by explicit path. Never `git add -A`.

═══════════════════════════════════════════════════════════
7 · REVIEWER CASCADE — run it, it is free of founder time

POLISH-0 §6 sets .8 at "single gated pass," but .7a ran the cascade anyway and
it returned a CRITICAL. Overnight, this costs nothing.

- Launch reviewer-bearing sessions from a worktree at origin/main. Agent
  definitions load from the session's working directory at launch and are NOT
  hot-reloaded. A subagent dying at 0 tool_uses is a stale model pin — report
  it, do not retry blindly.
- Sequential, one DB-touching reviewer at a time. Concurrent runs saturate
  local PG and manufacture flakiness.
- @code-reviewer, then @security-auditor.
- Every finding reported INDIVIDUALLY, at the severity the reviewer assigned,
  with file:line and a disposition. NEVER "a CRITICAL plus two HIGHs" — a PR
  was once cleared carrying two unaddressed HIGHs because of exactly that
  phrasing.
- FIX: CRITICAL and HIGH, if the fix is inside §4's boundary.
- REPORT ONLY, do not fix: MEDIUM and LOW, unless the fix is one line AND
  inside the boundary.
- ⛔ A CRITICAL you cannot fix inside the boundary fires S-0j. Stop.
- Every reviewer answers as separately-stated points. A bare PASS twice fires
  H10.

═══════════════════════════════════════════════════════════
8 · THE SESSION LOG — docs/logs/POLISH-8.md

Sections, all mandatory:
  1  Surface · routes · components AS VERIFIED — 8 routable entries (7 pages +
     the media/sign route handler), 15 files, 15 components
  2  Ship set — 8 items, each PASS/HALT with its proof and its RED counts
  3  RULINGS TAKEN — ⚠ the D11 SPEC-over-plan precedence call, both quotes in
     full, flagged for Gate C
  4  ROUTED, NOT BUILT — all 20 rows with class, disposition and PROPOSED
     owner. Proposed, not assigned. ⚠ Note explicitly that D02/D03/D04/D22/
     D23/D24/D25 are web-authored and land at close-out
  5  R15 HANDOFF — the pre-fix RED, and the sentence saying it is not a
     committed receipt
  6  Reviewer findings — individually, at assigned severity
  7  Counts re-verified at PR HEAD
  8  ReviewFeed.tsx byte-identity proof (S-2's mutate-and-revert)
  9  ⚠ LESSON FOR THE NEXT RELAY: what the machine read missed. MANDATORY —
     with the founder pass batched, this is the only surviving carrier of the
     feedback loop
 10  Session count and wall-clock time

═══════════════════════════════════════════════════════════
9 · HARD STOP — PR OPEN, NEVER MERGED

- Push the branch. Open the PR. STOP.
- ⛔ DO NOT MERGE. DO NOT SELF-MERGE. Gate C has not happened.
- Write the FULL PR diff to ~/Downloads/POLISH-8-gateC.diff.
  Diffs travel as UPLOADED FILES. Never as pasted terminal output — six
  transmission failures established this.
- Write the session log to docs/logs/POLISH-8.md AND a copy to
  ~/Downloads/POLISH-8-log.md.
- `git status --porcelain` empty at end.

REPORT IN CHAT, and nothing else:
  - branch name · PR number · PR head SHA · base SHA branched from
  - per-file md5 and line count for the two ~/Downloads artifacts
  - the sentinel string ZZ-P8-EXEC-2026-08-12, written into the log header
  - ship set: n shipped / n halted, one line each
  - reviewer tallies by severity
  - any ⛔ stop condition that fired, and where
  - worktree clean
NOTHING ELSE. Inline output has truncated three times.
