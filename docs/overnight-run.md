# ZUGZWANG · OVERNIGHT RUN DOCTRINE

**Version:** v1.3 · **Written:** 2026-08-22 · **Amended:** 2026-09-22 from FF-1 (the D-51 R9 extension — verbatim prescriptive commits and in-session expand-only DDL review; OVN-O9, OVN-O10, F-15, F-16) · **Supersedes:** v1.2 (2026-08-30)
**Author:** web Claude (orchestrator)
**Derived from:** POSREV-1 (`feat/posrev-1`, PR #396) — the first fully autonomous
overnight recon → plan → execute → deploy run. Also draws on LOTS-1, MERGE-0,
PHASE-0, MERGE-1 and UNWIRE-1, chiefly for what they got wrong.

**Repo home when committed:** `docs/overnight-run.md`
**Doc class:** prescriptive — web-authored, CC-committed.

**Changed in v1.3.** Two things §10 excluded are now covered, under conditions, by founder ruling D-51 R9 (FF-1, 2026-09-22). **Prescriptive text may ride an overnight run only when the web lane authored it in full before the run** — an ADR, a decision-record amendment, and spec amendment blocks with exact anchors — and the session **commits it verbatim**, filling only measured slots (ADR number, ruling number, versions, SHA, dates, migration name); a block whose anchor does not match exactly once is CARRIED, never rewritten, and the run still authors no prescriptive sentence of its own. **A migration may ride an overnight run only when it is expand-only and reversible** (ADD COLUMN with a default, ADD CONSTRAINT, an index — never a trigger edit, never an UPDATE of a Bucket-A row, never a destructive alter) and `@db-migration-reviewer` runs in-session on the migration slice under a written posture (expand-only · reversible · no trigger SQL · CHECK text verbatim · bucket classification unchanged · guard-catalog count unchanged · journal/snapshot consistent · `db:check-drift` clean). Everything else in §10 stands.

**Changed in v1.1.** F-11's standing mitigation (a reviewer re-run scoped to its
own fix) is **removed by founder ruling** — it costs run latency, and run latency
is the whole point of an overnight. Replaced with a disclosure requirement that
costs nothing: §6 and §7.

---

## 0 · How to use this file

Attach this file **plus** a task-specific brief to a fresh Claude Code session.
This file carries the method; the brief carries the work. They are different
documents and must not be merged:

| | This file | Your task brief |
|---|---|---|
| Changes between runs | never | every time |
| Contains | autonomy contract, verification doctrine, reporting contract, failure register | ground, refinement register, slices, prohibitions specific to this task |
| Authored by | once, amended when a run teaches something | web Claude, per task |

The prompt skeleton at §5 is the join between them. Copy it, fill the slots,
send it with this file attached.

**The one-sentence rationale.** Removing the operator does not remove the
checking — it *relocates* it. Every human checkpoint you delete must be replaced
by a mechanical one, or you have not built an autonomous run, you have built an
unsupervised one. Everything below is the mechanical replacement.

---

## 1 · Walls and gates — the central distinction

The concept that makes an overnight run safe. State it explicitly in every
prompt; it is the thing sessions get wrong when it is left implicit.

**A GATE is a point where the session waits for a human.**
In an overnight run there are **zero**. Not "few." Not "only for critical
things." Zero. Nobody is awake. A session that parks work for a human at 3am has
converted an eight-hour run into a two-hour run and lost the night.

**A WALL is a thing the session must never do, human present or not.**
Walls are absolute and are not softened by autonomy. They exist precisely
*because* nobody is watching.

Reviewers are **neither**. They are subagents that run in-session, whose findings
the session acts on itself and keeps moving. Calling a reviewer a gate is the
mistake that made LOTS-1 skip its cascade entirely.

**Every prohibition in a prompt must be classified.** If a rule is not obviously
a wall, it will be read as a gate and the session will stop at it.

### 1.1 · Walls state their consequence, never just the rule

A prohibition with a reason attached survives contact with a session that thinks
it has found a clever exception. A bare rule does not.

Bad: `Never run pnpm staging:rebuild.`

Good:
```
⛔ Never run `pnpm staging:rebuild`. Not once, not to check something. It does
   not merely truncate the eight seeded markets — it REPLACES them with fifteen
   sp-* fixtures and reports six green gates while doing it. There is no
   restore path.
```

The second version is a wall. The first is a suggestion with a stern font.

---

## 2 · The autonomy contract

Paste this into every overnight prompt, adjusted only for the task's own walls.

```
There are NO operator gates in this task. Nobody is awake. You do not stop to
ask, you do not wait for ratification, and you do not park work for a human.

AMBIGUITY IS A LOGGING EVENT, NOT A HALT.
  Pick the option most consistent with the refinement register. Write down the
  choice AND the alternative you rejected AND why, in the run log. Continue.

FAILURE IS A FIX, THEN A CONTINUE.
  If a slice cannot be made to pass after three genuine attempts, revert THAT
  SLICE ONLY, log it as CARRIED, move to the next slice. Never leave the tree
  red. Never abandon the run.

THE REVIEWER CASCADE IS NOT A GATE.
  Those are subagents. They run in-session. You act on their findings yourself
  and keep going. You may DECLINE a finding — but a declined finding is logged
  with its reasoning, never dropped silently.

SLICE BOUNDARIES MAY MOVE.
  If two slices have no shippable intermediate state, ship them as one commit
  and say so, with the reason, in the report. Splitting a change into states
  that each fail the green-suite gate defeats the gate they were split to
  satisfy. The ORDER OF WORK does not move; only the commit boundary.
```

### 2.1 · Why "three attempts then revert that slice only"

Unbounded retry is how a session burns a night on one defect. Abandoning the run
is how you get nothing. Reverting the slice preserves everything before it and
lets the remaining slices land. POSREV-1 never invoked this; the option existing
is what let it push hard on the ones it did fix.

### 2.2 · Declining is legitimate

POSREV-1 declined two reviewer findings (L-2, L-4), each with reasoning that
named why the fix would widen a contract the task had no mandate to widen. Both
appear in the report as DECLINED with the argument. That is correct behaviour and
should be explicitly permitted, or sessions will implement findings they know to
be wrong rather than appear to have ignored them.

---

## 3 · Verification doctrine

This is the section that does the actual work. An unattended run's output is only
worth what its verification is worth.

### OVN-V1 · Every negative assertion carries a positive control

A search that returns nothing proves nothing on its own — it is equally
consistent with "absent" and "my pattern is wrong."

> POSREV-1, verifying no `bets.stake` read survived on the ranking path: ran
> `grep surviving_basis` first, got 25 hits across 7 files, establishing the
> pattern finds real code. *Then* asserted the absence.

Instruct: *"Each negative assertion gets a positive control — the same search
pattern against a term you know is present, returning hits."*

### OVN-V2 · Every guard is verified by reverting its fix and watching it red

A test written after a fix, against the fixed code, has never seen the defect. It
may be asserting something unrelated and passing for the wrong reason.

> POSREV-1 verified all four new guards this way — and caught that its own C-1
> regression test **passed with the defect restored**. The YES→NO flip happened
> to return the held row last, so last-write-wins landed on the right answer by
> accident. Rebuilt as NO→YES with the held row inserted first, so the exited row
> is last under both plausible query orders.

Instruct: *"Verify every new guard by reverting its fix and confirming it reds.
Report the assertion message it produces."*

### OVN-V3 · A control that cannot fire is not a control

Sharper than V-2 in the existing register. The control must exercise the failing
syntax, in the failing shape, through a path that can actually reach it.

Three instances, all real:

- A positive control written with a **literal** where the failing arm used a
  **variable**. Passed happily, caught nothing. *(LOTS-1)*
- A dust control that typed `31` into a field already displaying `31`. React
  dispatches no change event for an unchanged value, so the draft stayed
  untouched and the exact seed went out — the control reddened against the build
  it was written to clear. *(POSREV-1)*
- A reproduction run over 56 files when the failing assertion reads a table
  unfiltered and inherits residue from a serial full suite. The polluting
  predecessor was not in the subset. *(POSREV-1, first attempt)*

Instruct: *"A control that does not exercise the failing syntax is not a control.
If the failing arm used a variable, do not write the control with a literal.
If the mechanism requires an event, ensure the event can fire."*

### OVN-V4 · Measure the baseline before the change, at the layer that reflects reality

And re-measure after, and put both numbers in the report.

The layer matters more than the number. POSREV-1 measured SQL statements at the
**postgres-js driver** rather than by counting `db.select()` call sites, because
the driver's `debug` hook fires once per statement actually sent — so a read
hidden in a helper or a lazy relation lands in the same tally. Counting call
sites would have measured *the shape of the code* rather than *the shape of the
load*.

Result: 21 statements at M=1 and M=8, before and after. Δ = 0, provable.

Instruct: *"Record the baseline NUMBER before you change anything. State the
measurement layer and why it is the honest one. Re-measure after and report the
delta."*

### OVN-V5 · Never select the thing under test by a styling class

A selector keyed on presentation changes meaning whenever a neighbour is
restyled, and does so silently.

> `:scope > span.flex-col` matched **three** nodes, not two — the middle group
> was a column too and always had been. Replaced with explicit `data-testid`s.

### OVN-V6 · Assert on the structure the change actually touched

A row and a column flatten to the same `textContent`. A test that reads text
cannot see a layout change.

> POSREV-1's stacking guards assert on markup and child order, never
> `textContent`.

Corollary, from the same run: assert vocabulary pins over `textContent` **plus**
every `aria-label` and `title`, across every distinct surface state. And
word-bound them — a guard that reddens on `"allotted pilot slot"` gets suppressed
within a week.

### OVN-V7 · A search is not done until its output has been read in full

A preview is not a result. Two sessions lost a true fact this way — a line-scoped
grep on a sentence that wrapped across two comment lines, and a 41 KB `rg` output
truncated to a 2 KB preview that was read as the answer.

### OVN-V8 · Rotation is not regression

If a red moves between runs, it is environmental. A regression reddens the same
assertion every time.

> Two full runs reddened two *different* untouched files in the same directory.
> That diagnosis led to `pg_class` bloat — 1.19 MB → 230 MB against 950 live
> rows, dead tuples held from vacuum by an active replication slot pinning the
> xmin horizon — not to a code defect. Fixed: 230 MB → 344 kB.

Instruct: *"If a red is intermittent, establish whether it rotates. If it does,
the cause is environmental and the diagnosis is measurement, not more retries."*

### OVN-V9 · An instrument that cannot report an expensive load is not an instrument

Before trusting a measurement, hand the instrument something it **must** call
expensive. If it does not, it is not measuring the quantity it names.

> WARLI-2 needed a frame cost. `requestAnimationFrame` sampling in a launched
> browser returned **60.05 fps** for the artwork and **60.23 fps** for a rotating
> group carrying `feTurbulence` + `feDisplacementMap`. rAF is **vsync-locked** —
> it reports the display's cadence while raster falls behind. The replacement,
> `Page.screencastFrame` timestamps, counts frames actually PRESENTED, and its own
> controls fire: a rotation-removed arm reads 0.2 fps.

⚠ **THE CONTROL MUST RUN AT A LOAD WHERE IT CAN DISCRIMINATE.** At 400 shapes all
three arms were genuinely free and the control did not separate; it only fired at
n=2000 and was decisive at n=5000. **A control run below its discrimination
threshold reads exactly like a passing one.** Finding that threshold is part of
the measurement, not preparation for it.

**Two traps specific to driving a browser from an automation tab**, both of which
have cost this project a run:

1. The tab is `document.hidden`, so **`requestAnimationFrame` never fires at all**
   — a sampler that awaits frames hangs rather than returning zero. Arm the
   collector, return, and read it later, so "no frames" is a RESULT.
2. **The obvious fallback fails for the same root cause.**
   `document.getAnimations()[0].currentTime` does not advance either — measured
   **0 → 0 over 17.7 s**, with the computed transform stuck at the identity
   matrix. The hidden tab freezes the animation **TIMELINE**, not merely the
   callback, so sampling it on a timer samples a clock that is not running.

⇒ **Launch your own browser** (`--headless=new` + CDP) rather than measuring in an
automation tab. A browser you launch is not hidden.

The hidden-tab half of this is **V-12**, and the vsync-lock half is **V-16**, both
in `docs/polish/POLISH-0_data-manifest.md` §5. Neither is restated here — this
rule is the overnight-run METHOD; V-space is the register.

---

---

## 4 · What the operator owes the run

A bad brief produces a bad run regardless of how well the session executes. These
are the author's obligations, and each one is on this list because omitting it
cost something real.

### OVN-O1 · Name the reviewer cascade explicitly, or it will not run

CC correctly treats a kickoff's reviewer sequence as ratified scope. If the
kickoff lists none, none run.

> LOTS-1 named no cascade. None ran. **Four of the six most serious findings
> later sat on the one path the plan had predicted.**

Name them, in order, with scope and effort. POSREV-1's cascade found two real
CRITICALs and a HIGH on the money path, every one of which would have reached
`main` otherwise.

### OVN-O2 · Never assert infrastructure behaviour you have not verified

> POSREV-1's brief said *"A Vercel per-branch preview deploys automatically."*
> At the time it did not — the project carried an Ignored Build Step that
> cancelled every non-`main`/`staging`/`verify` build about two seconds in. Six
> previews died before the session worked it out and routed around it.

⚠ **AND THAT EXAMPLE IS NOW STALE IN THE OPPOSITE DIRECTION, which makes it a
better illustration of this rule than it was when it was written.** `feat/*`
branches **DO** preview today — measured at WARLI-1 and again at WARLI-2:
`READY` in ~46 s, serving the branch's own canary. The allow-list changed
underneath the doctrine and nothing announced it.

**Do not read either state as fact.** The rule is not *"previews are blocked"* or
*"previews work" —* it is that **a deploy premise has a shelf life measured in
weeks, and this paragraph has now been wrong in both directions.** Verify it in
the run, every run.

If a premise about tooling, CI, hosting or deploy behaviour cannot be verified
before writing the prompt, **make verifying it the session's first instruction**
rather than stating it as fact.

### OVN-O3 · Ground SHAs go stale — instruct "report actual, do not assume"

> POSREV-1's brief named `origin/main` as `4c64e40`. It was `193d95a` — two
> merges further on. The brief also called the unwire "PR #393"; it landed as
> `ff1c0f9` with no PR suffix.

Always: *"REPORT the actual SHA. Do not assume the one written here."* Then the
staleness is a logged correction rather than a wrong base.

### OVN-O4 · A ruled outcome and its stated mechanism are different claims

The founder rules outcomes. The mechanism described alongside the ruling is the
author's guess and may be wrong.

> RF-11 ruled: collapse the dead 188px band below `lg`. Measurement found every
> `188px` token was already `lg:`-scoped — there was no dead band. **The ruled
> outcome already held; the described mechanism was a fix for a state that did
> not exist.**

Instruct, for any item where the mechanism is inferred rather than measured:
*"Measure first. Act only on a measured condition. If the ruled outcome already
holds, pin it with a guard and report that no change was needed."*

### OVN-O5 · Say which walls are absolute and which are scope fences

"Do not touch X" is ambiguous between *never, it is dangerous* and *not in this
task's remit*. The session will pick one and it may pick wrong. Label them.

### OVN-O6 · Launch from a fresh worktree at `origin/main`

Stale worktrees carry stale subagent frontmatter model pins. A subagent dying at
zero tool uses is that, and it fails silently at 3am with nobody to notice.

```
git fetch origin
git worktree add ~/code/zugzwang/<task> origin/main
cd ~/code/zugzwang/<task>
git switch -c <branch>
```

Concurrent sessions isolate by worktree; stopping other sessions is not required.

### OVN-O7 · Check for shared unlocked resources before launching

If two sessions can run overnight, enumerate what they might contend for. A
shared deploy lane, a shared ref, a shared local database — none of these have
locks.

> POSREV-1 and RANK-3 ran the same night. Both faced the cancelled-preview wall;
> both had the same incentive to use the `verify` lane; nothing prevents the
> second from overwriting the first's preview. The operator would have opened a
> URL serving the other task's tree with nothing to indicate it.

Mitigation, cheap: instruct the session to **report a canary or commit SHA the
preview must serve**, and check it before trusting anything you see.

---

### OVN-O8 · A mutation-testing reviewer is a WRITER — give it its own worktree

**OVN-O7 covers two SESSIONS contending. It does not cover a session and its own
subagent, and that gap is live the moment a reviewer does mutation testing.**

`@test-writer` proving a guard by reversal necessarily EDITS `src/`, runs the
suite, and restores. While it works, every measurement the parent takes against
that tree is contaminated — and silently, because the file is restored moments
later and the tree looks innocent both before and after.

> WARLI-2 ran a node census, generated the preview artifact and took an entire
> before/after frame-cost measurement inside that window. Some of those numbers
> were fine and one set was not, and it took a second measurement from an
> isolated worktree to tell which — after the session had already reported a
> retraction that turned out to be wrong.

**Either fix works; pick one before the cascade starts:**

- launch the reviewer with `isolation: "worktree"`, or
- take every measurement **before** the cascade, never during it.

⚠ **The detection rule is worth more than the fix, because it generalises:** two
renders identical WITHIN one process but differing ACROSS processes means the
INPUT changed, not the code — determinism cannot fail across processes and hold
within one. That is **V-17** in `docs/polish/POLISH-0_data-manifest.md` §5; it is
not restated here, and V-space is its only home.

---

### OVN-O9 · A schema-bearing branch has no servable preview until its migration reaches the preview database — say so in the brief

FF-1's brief asked for "preview URLs and the SHAs they serve". Both previews built and died at `next build`'s prerender of `/m/[slug]` with `42703 column … does not exist`: the preview lane serves the staging database, `ci.yml` migrates its own Postgres, and applying a migration to staging is a `staging` push the walls reserve to the founder. The run could not have produced a URL. ⇒ When the task lands DDL, the brief states that the preview will build and fail until the founder's staging advance applies the migration, and asks for the failing deployment's log line in place of a canary.

### OVN-O10 · Name the dynamic-workflow posture, and expect the harness to report its mode

`/effort max` is not a command a session can issue; the harness reports its mode (FF-1: `ultracode (xhigh + dynamic workflow orchestration)`). CLAUDE.md §6 forbids dynamic workflows on the seven §1 areas regardless of mode. ⇒ Every brief that touches a §1 area carries one line — *dynamic workflows FORBIDDEN on §1 areas; recon is one sequential pass* — and the report states the mode the harness reported.

---

## 5 · The prompt skeleton

Copy, fill the `«slots»`, attach this file alongside.

```
TASK: «TASK-ID» — «one line»
MODE: autonomous, overnight, recon → plan → execute → deploy → report
ultrathink on every planning and reviewing step.

Read the attached OVERNIGHT RUN DOCTRINE first. It governs how you work.
This prompt governs what you build.

═══════════════════════════════════════════════════════════
0 · AUTONOMY CONTRACT
═══════════════════════════════════════════════════════════
«paste §2 of the doctrine verbatim»

WALLS — absolute, not gates:
  ⛔ «prohibition» — «its consequence, concretely»
  ⛔ «prohibition» — «its consequence, concretely»

SCOPE FENCES — not dangerous, just not this task:
  ✗ «out of scope item»

═══════════════════════════════════════════════════════════
1 · GROUND
═══════════════════════════════════════════════════════════
Fresh worktree at origin/main. Do not reuse an existing worktree.
  git fetch origin
  git worktree add ~/code/zugzwang/«task» origin/main
  cd ~/code/zugzwang/«task» && git switch -c «branch»

REPORT the actual origin/main SHA. Do not assume any SHA written in this
prompt — main may have moved.

Confirm subagent model pins resolve. If a subagent later dies at 0 tool_uses,
this is why — check here first.

═══════════════════════════════════════════════════════════
2 · PHASE A — RECON (read-only)
═══════════════════════════════════════════════════════════
Write to ~/Downloads/zz_«TASK-ID»_recon_<UTC>.md incrementally.
Then continue straight into Phase B. Do not stop.

A0 · GROUND VERIFICATION (do this first — cheap, catches a poisoned base)
  «what recently landed that this task builds on»
  «what must still be true — each with a positive control»
  «any environment head/version the deploy target must match»

A1…An · THE SURFACE
  «numbered, specific, file:line demanded for every claim»
  «mark the one or two items the whole task depends on»
  «demand a BASELINE MEASUREMENT of whatever this task could regress,
    and state the measurement layer»

═══════════════════════════════════════════════════════════
3 · THE REGISTER — what you are building
═══════════════════════════════════════════════════════════
«Open with THE CORE IDEA in plain prose — what changes and why, in a
 paragraph a stranger could act on. Every numbered item below is easier
 to interpret correctly once this is stated.»

RF-1 · «name»
  «what, concretely»
  «why, where the why is non-obvious or where a plausible wrong reading exists»
  ⚠ «any trap — byte-identity, ordering, rounding, invariant»

«…»

WHAT YOU ARE NOT DOING
  ✗ «with the reason, where the reason is the interesting part»

═══════════════════════════════════════════════════════════
4 · PHASE B — PLAN
═══════════════════════════════════════════════════════════
Write docs/plans/«TASK-ID».md:
  - slice list, ordered, each with its exit condition
  - file map: every file you will touch and why
  - every ambiguity resolved and the alternative rejected
  - the baseline measurement and your predicted post-build value
  - which slices are reviewer-bearing
Commit it. Start slice 1. Do not wait for anyone to read it.

═══════════════════════════════════════════════════════════
5 · SLICES
═══════════════════════════════════════════════════════════
  S1  «…»
  …
  Sn  full suite, reviewer cascade, fixes, deploy

FULL TEST SUITE GREEN AT THE END OF EVERY SLICE — the full suite, not the
touched tests. A slice's own tests can pass against a wrong design when they
only exercise the happy path.

═══════════════════════════════════════════════════════════
6 · TESTS AND REVIEWERS
═══════════════════════════════════════════════════════════
Guards you must write:
  - «each one, with the wrong answer it must reject»

Verify every guard by reverting its fix and watching it red (OVN-V2).
Every negative assertion carries a positive control (OVN-V1).

Reviewer cascade, in order, all at effort max:
  1. @test-writer      — «scope»
  2. @code-reviewer    — «scope»
  3. @security-auditor — «scope, and the failure mode to look for»
Brief each one on what the failure mode IS, not just what to read.
Act on findings yourself. Log anything you decline, with reasoning.

⚠ If you fix a finding AFTER the reviewer that would have caught the fix has
  already run, FLAG IT EXPLICITLY IN THE REPORT — file, finding, and what the
  fix changed. Do not re-run the reviewer; that costs the night. The flag is
  what routes it to the human diff read.

═══════════════════════════════════════════════════════════
7 · DEPLOY
═══════════════════════════════════════════════════════════
  · Push the branch. Open a PR against main. LEAVE IT UNMERGED.
  · «preview mechanism — VERIFY it, do not assume it»
  · Report the SHA the preview serves, so the operator can confirm they are
    looking at this task's build and not another session's.
  · Do not push shared refs. Do not touch production.

═══════════════════════════════════════════════════════════
8 · REPORTING (O-11)
═══════════════════════════════════════════════════════════
«paste §6 of the doctrine»
```

---

## 6 · The reporting contract

Write `~/Downloads/zz_«TASK-ID»_run_<UTC-YYYY-MM-DDTHHMM>.md` **incrementally as
you go, not at the end.** If the session dies at 4am, that file is the entire
record of the night.

**Required sections, in this order:**

1. **Preview URL and the SHA it serves** — first line, before anything else.
2. **Any premise in the brief that turned out to be wrong** — loudly, at the top.
   The operator needs to know their instructions were faulty before they read
   what was built from them.
3. **Ground verification results**, each with its positive control shown.
4. **Baselines** — the numbers, and the measurement layer, and why that layer.
5. **Per slice** — what shipped, test counts, anything CARRIED.
6. **The ambiguity register** — a table: `# | Ambiguity | Chose | Rejected | Why`.
   This is what makes an unattended run reviewable. POSREV-1 logged eleven.
7. **Reviewer findings and dispositions** — including DECLINED, with reasoning.
8. **THE UNREVIEWED-FIX LIST.** Every fix authored *after* the reviewer that
   would have caught it had already run. File, the finding that prompted it, and
   what it changed. See §7 F-11 — this list is the whole mitigation, and Gate C
   reads it first.
9. **Your own errors, recorded in place.** A run that reports none is less
   trustworthy than one that reports three.
10. **The measured delta** on whatever the baseline guarded.
11. **CARRIED / NOT DONE / OWED** — anything the next session or the founder
    inherits.

**Final chat reply: maximum 10 lines.**

```
FILE      ~/Downloads/zz_«TASK-ID»_run_<UTC>.md
LINES     «wc -l»
MD5       «md5»
STATUS    «one line»
PREVIEW   «url»
HEADLINE  «≤4 lines naming what was MEASURED»
```

`LINES` and `MD5` are **measured**, never asserted. Do not paste the report into
chat — the operator uploads the file.

### 6.1 · Report your own errors in place

POSREV-1 reported three of its own: a control that could not fire, a selector
matching a neighbour, and a docblock stating a reason for a guard that was not
the guard's actual reason. Each was corrected where it lived, with the correction
explaining itself.

This is not confession theatre. A report that surfaces the session's own mistakes
is evidence the checking was real, and each one is a register entry the project
keeps. A clean report from an eight-hour unattended run should raise an eyebrow.

### 6.2 · Correct stale documentation in place, never append to it

When a change makes a docblock false, edit the docblock. Do not add a note
underneath saying it is now false. POSREV-1 corrected six, including two that had
been *faithfully carried forward* through multiple refactors while being wrong the
whole time.

---

## 7 · Failure register — named, so they can be cited

| Ref | Failure | Where it bit |
|---|---|---|
| **F-1** | Cascade omitted from the kickoff, so no reviewer ran | LOTS-1 — four of six serious findings on the predicted path |
| **F-2** | Control written with a literal where the failing arm used a variable | LOTS-1 |
| **F-3** | Control that could not fire — no event dispatched for an unchanged value | POSREV-1, self-caught |
| **F-4** | Guard passing with the defect restored — query order made the wrong code right by accident | POSREV-1, self-caught by revert-to-red |
| **F-5** | Selector matching a neighbour because it keyed on a styling class | POSREV-1, self-caught |
| **F-6** | Reproduction over a subset that did not contain the polluting predecessor | POSREV-1, first attempt |
| **F-7** | Search output read as a preview rather than in full | PHASE-0 and MERGE-1, both self-reported |
| **F-8** | Infrastructure behaviour asserted in a brief without verification | POSREV-1 brief — six cancelled previews |
| **F-9** | Ground SHA stale by two merges; a PR number that was never a PR | POSREV-1 brief |
| **F-10** | Mechanism inferred from a screenshot, ruled as though measured | RF-11 — the outcome already held |
| **F-11** | A fix creating the next hazard, with the last fix in the chain reviewed by nobody | POSREV-1 — C-2's fix opened the security HIGH |
| **F-12** | Shared deploy lane with no lock, two sessions running | POSREV-1 / RANK-3, same night |
| **F-13** | Local catalog bloat presenting as intermittent test failures | POSREV-1 — diagnosed, not blamed |
| **F-14** | A session measuring its own tree while its mutation-testing subagent wrote to it | WARLI-2 — self-caught, but only after a wrong retraction (OVN-O8) |
| **F-15** | An amendment anchor that was the prefix of two headings — carried correctly, but the callout it carried was the one an ADR-0017 reader needed most | FF-1 brief, B5.2 — anchors are line-bounded or multi-line wherever a heading string can recur |
| **F-16** | A brief naming source files from a spec inventory the code had already outgrown | FF-1 brief, A1-b — two files that did not exist; recon corrected it and the plan recorded it |

### 7.1 · F-11 and why it has no in-session mitigation

The shape: a reviewer finds a defect, the session fixes it, the fix opens a new
hazard, the next reviewer finds *that*, the session fixes it — and the final fix
in the chain is reviewed by nobody, because the cascade has already run.

> POSREV-1: `@code-reviewer` found one idempotency key per page session (second
> sell always 409s). The fix minted a fresh key per arm. `@security-auditor` then
> found that this handed the client the exact "pick a new key" escape that turns
> a completed sell into a second executed one. The session fixed that three ways.
> Nobody audited the three-way fix.

**A reviewer re-run scoped to its own fix was considered and REJECTED by founder
ruling, 2026-08-22, on latency.** It is the right call: an overnight run's entire
value is what it completes in one night, and a re-run at effort max on a critical
path is not cheap. Buying a second audit with an hour of the night is a bad trade
when a free instrument already exists.

**The free instrument is disclosure.** The session flags every fix authored after
its reviewer ran — §6 item 8 — and **Gate C reads those hunks first.** The check
does not disappear; it moves from the session, where it costs the night, to the
human diff read, which happens before merge regardless and costs nothing extra.

This works only if the flag is reliable. **A session that omits the
unreviewed-fix list has removed the only mitigation there is** — treat a missing
list as a defect in the report, not an absence of findings.

---

## 8 · Pre-flight checklist

Before sending an overnight prompt:

- [ ] Every wall states its consequence, not just its rule
- [ ] Walls and scope fences are labelled differently
- [ ] The reviewer cascade is named, in order, with scope and effort
- [ ] The unreviewed-fix disclosure (§6 item 8) is instructed explicitly
- [ ] Every infrastructure premise is either verified or converted into an
      instruction to verify
- [ ] No SHA is asserted; every one is "report actual"
- [ ] A fresh worktree is instructed, at `origin/main`
- [ ] Whatever the task could regress has a demanded baseline, with its
      measurement layer specified
- [ ] Any item whose mechanism is inferred says "measure first"
- [ ] Shared unlocked resources are enumerated, and the session is told to report
      a canary the operator can check
- [ ] The register's core idea is stated in plain prose before the numbered items
- [ ] The NOT-DOING list gives reasons, not just names

## 9 · Post-flight checklist

On reading the report:

- [ ] Does the preview serve **this task's** SHA?
- [ ] **Read the unreviewed-fix list first, then those hunks at Gate C.** If the
      list is missing, ask for it before merging anything (§7.1)
- [ ] Did any brief premise turn out wrong? Fix the brief, not just the code.
- [ ] Did the baseline hold? Is the measurement layer honest?
- [ ] Read the ambiguity register in full — this is where a run silently diverges
- [ ] Read every DECLINED finding and agree or overturn it
- [ ] Did the session report its own errors? None reported is a flag, not a pass
- [ ] Gate C on the diff before merge — the report is not a substitute
- [ ] Do any prescriptive docs now contradict the shipped code?
- [ ] New register entries earned → carry them into V / O / L and into this file

---

## 10 · What this doctrine does not cover

- **Merge.** The overnight run ends at an open, unmerged PR. Gate C, the founder
  diff read, and merge order against concurrent lanes are operator work.
- **Prescriptive doc edits.** Sessions do not author ADRs, SPECs or trackers. If
  a run makes a spec false, the run flags it and the web lane authors the
  amendment. POSREV-1 flagged SPEC.1 §23 correctly and did not touch it.
- **Anything requiring a founder ruling.** Log it, build to the register as
  written, flag it. Do not resolve it and do not stop for it.
- **Migrations and DDL.** Not because they cannot be done overnight, but because
  nothing so far has needed to be. If a future run does, that is a distinct
  doctrine and needs its own reviewer posture.

---

**END — Zugzwang overnight run doctrine v1.3**
