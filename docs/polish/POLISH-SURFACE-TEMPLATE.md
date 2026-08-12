# POLISH — Surface Template

> **Doc:** `POLISH-SURFACE-TEMPLATE.md` · web-authored, operator-ratified, CC-committed. Authored 2026-08-10 at the POLISH-TEMPLATE task.
> **Status:** v1.0
> **Supersedes:** `POLISH-STRATUM.md` (v1.0-draft, 2026-07-31, project-knowledge only, never on `main`, D1–D5 never ratified). Its 83 governing statements were audited one by one before this file was written: 63 absorbed, 12 absorbed with amendment, 8 discarded. **Discard the original.**
> **Governed by:** `POLISH-0.md` — the method. This file does not restate it and never overrides it.
> **Ground:** `origin/main` @ `35d041d`.

**What this is.** The runbook for a POLISH surface's **machine phase**. Fill in the bracketed fields and run it.

**What this is not.** It is not a method. `POLISH-0.md` answers *what is correct* — precedence, inventory, defect classes, exit bar. This answers *how a surface is run*. **Judgment in one file, procedure in the other**, so a change to procedure never silently edits a ratified baseline. If this file and `POLISH-0.md` ever disagree, `POLISH-0.md` wins and this file is the defect.

**The standard.** Someone who has never seen this project should be able to read this and run a surface correctly.

**⚠ One half of this document is provisional and says so.** §11, the founder pass, is written from **zero completed instances**. Every other section is written from POLISH.1, POLISH.2 and DISCOVERY-COMPLETE — three machine phases with merged PRs and Gate C findings. Do not read §11 with the confidence the rest has earned.

---

## §1 · The shape — two phases, and the first one halts

A surface's machine phase is **not** one pass that fixes everything it finds. It is:

```
  RECON ─▶ CLASSIFY ─▶ RATIFY ─▶ EXECUTE ─▶ GATE C
                          │
                          └─▶ HALTS ─▶ a separate gated task
```

**The halts are the point.** A surface's deltas split into what can ship inside a cosmetic edit boundary and what cannot — a read-model gap, a shared primitive, an unruled decision. The second set **becomes the scope of a follow-on plan-then-execute task**, where `src/server/**` and read-model changes are permitted and the named-reviewer cascade runs.

POLISH.2 is the worked example: 50 deltas, 24 shipped in the machine PR, and four `HALT — DTO field` rows became DISCOVERY-COMPLETE's Group 2 — which legitimately changed `hero.ts` and added four `HeroPost` fields under full gates.

**A template that stops at "20 classified, come back later" is useless.** The classification's job is to produce the next task's scope, not a list.

**A surface is closed by neither phase alone.** The machine phase reads source against source; it cannot see what only a render shows. The founder pass (§11) judges proportion, density and rhythm; it cannot see a wrong token that happens to render identically. Both, then `POLISH-0.md` §7's exit bar.

---

## §2 · Step 0 — verify, do not read

**Before anything else.** For the surface's row in `POLISH-0.md` §3, verify against the live repo: every gate, every absence claim, every named source. Report each **TRUE · FALSE · UNVERIFIABLE** with `file:line` or a commit SHA.

**Why this is step 0 and not a footnote.** As committed on 2026-08-05, `POLISH-0.md` asserted C3 was uncommitted (it landed 2026-07-31), that `not-found.tsx` existed nowhere (2026-08-02), that B4 was a live gate (withdrawn 2026-08-02), and that MEDIA.2's status was unconfirmed (answerable in one grep). Four false claims, three already false the day it shipped — in the document whose own §8 says *"a listed dependency is not a completed one."*

- **A citation is not an artifact.** `SPEC.CHART` is cited as a tier-1 source for POLISH.3 and does not exist in `docs/specs/`.
- **A gate listed is not a gate closed.** Verify the artifact, never a document asserting the artifact.
- **A component list is not the route.** POLISH.2's list omitted `StatLine`, which carried six deltas, and listed `scrollers`, which belongs to another surface. Verify the list against what the route actually renders; a divergence is a class-**S** row against the method document.

A FALSE finding here is a real deliverable. File it and correct `POLISH-0.md` in the same PR.

---

## §3 · The recon relay

Fill the brackets. Send verbatim.

```
TASK: POLISH-<N> · RECON. Read-only. No writes, no branch, no PR, no src/,
no spec or ADR edit.

SETUP
- Own detached worktree off origin/main. Fetch first; report the tip SHA.
- git status --porcelain empty at start AND end.
- No build, no DB, no Doppler, no credentialed command.

═══ 0 · VERIFY BEFORE READING (POLISH-SURFACE-TEMPLATE §2)
For POLISH-0.md §3's row for this surface, report TRUE / FALSE / UNVERIFIABLE
with file:line or a SHA for EVERY:
  - gate listed                    - claim of absence or non-existence
  - named tier-1/2/3/4 source      - component in the declared list
Do not judge whether a claim matters. Report every one, including the true ones.
HALT and report if a named source does not exist — that is a class-S finding
about the method document, not a research task.

═══ 1 · READ IN THIS ORDER (POLISH-0.md §8 — do not reorder)
1. TIER 1 — <SPEC/ADR list>. PATCH RECORDS BEFORE DECISION BODIES.
2. TIER 2 — <canon rows · CD close-outs · values-log items>.
3. TIER 3 (BUILD-LAW, do not skip) — docs/plans/<SLOT>.md + its close-outs.
4. TIER 4 — <mockup file>.
5. POLISH-0.md §2.1 (supersessions), §3's pre-recorded rows, §0 (ruling index).

Step 3 is why: at POLISH.0 four apparent divergences were investigated and
THREE were false, each resolving on a tier-3 document. An inspector who skips
step 3 files three false defects for every real one.

═══ 2 · SCOPE
Components: <list>   Routes: <list>
Everything else is out of scope. Do not read or report on other surfaces.

═══ 3 · THE TASK
One row per difference between the tier-4 mockup and the built components:

  | # | What differs | mockup:line | file:line | class | disposition | halt? |

- id is <SURFACE>-D<nn>, e.g. P3-D07. Never a bare Vn.
- class is exactly one of V / F / B / S / R — POLISH-0.md §5.
- disposition per POLISH-0.md §5, and every row names its BASELINE: the tier
  and document it violates. If none can be named it is class S, not V.
- halt? — name the halt condition from §5 below, or "no".
- If a difference matches a POLISH-0.md §2.1 supersession, NAME THE ROW and
  FLAG IT. Do not drop it. Web decides.

═══ 4 · HARD RULES
- FACTS with file:line on BOTH sides. Where judgment is needed, quote both
  and STOP.
- The mockup is TIER 4 — the lowest authority above the export bundle. If
  tiers 1–3 contradict it, say so. ⚠ But tier 4 is the lowest AUTHORITY, not
  the least accurate: at V17 the mockup was CORRECT and the port was wrong.
- Report token USAGE (wrong semantic slot). Never token VALUES — CI-pinned.
- Never infer "done" from a document asserting it is done.
- A directory-scoped negative is NOT a tree-wide one (O-2).
- UNVERIFIABLE + why, never a guess.
- Where the framing in this relay is wrong, SAY SO. Recon has corrected the
  author on every run so far and each correction was right.

═══ 5 · NOT DOING
No fixes. No branch. No PR. No src/ change. No spec or ADR edit.
Do NOT construct anything that is missing. Classify it and move on.

═══ 6 · OUTPUT
Write the WHOLE answer to ~/Downloads/POLISH-<N>-recon.md.
⚠ Report in chat ONLY: file path, md5, line count, section IDs present,
worktree clean. NOTHING ELSE — inline output has truncated twice.
```

---

## §4 · Classification and the standing disposition

### §4.1 · One vocabulary, and it is the register's

Deltas are classified with `POLISH-0.md` §5's **V · F · B · S · R** and dispositioned with its table. **No second scheme is minted.** POLISH.2's transient `A/B/C/D` lanes are retired: two of the four letters collided with the register class and the gate IDs, and their definitions are unrecoverable — the kickoff that minted them was inline and never committed.

Delta IDs are `<SURFACE>-D<nn>`. Not bare `Vn`, which collided three ways: `V13` a delta, `V-5` a verification lesson, `V` a class.

### §4.2 · The standing disposition — what may ship without asking

Reconstructed from POLISH.2's 44 committed register rows and `docs/logs/POLISH-2.md`, because the kickoff that defined it is lost. **A reconstruction, not a transcription** — recorded as such.

**BUILD unasked** → ships in the machine PR, becomes a class-V row.

| | Rule |
|---|---|
| **B1** | The mockup and every higher tier agree, and the fix is confined to the declared components |
| **B2** | Unresolved but **purely presentational** → build to the mockup, log the call |
| **B3** | The ratified source underdetermines a value → **ship the defensible option, flag it, request a ruling at Gate C. Do not stall** |

**SHIP OR DON'T — never on silence.**

| | Rule |
|---|---|
| **S1** | **Mockup silence never authorises removing a shipped affordance.** The type changes; the affordance stays |
| **S2** | A supersession voids a delta's stated rationale but the delta holds on other grounds → ship it and **state the new ground**, or a later reader finds the reason deleted and assumes the delta was too |
| **S3** | A supersession removes the only thing that made a mockup value resolvable → **do not port it.** There is nothing to port |

**CARVE OUT** → its own task, never built here.

| | Rule |
|---|---|
| **C1** | A fix that **crosses into another surface** forks. A V batch never spans surfaces — building it here silently re-skins a surface nobody inspected |
| **C2** | A shared primitive is **never changed by consumer override.** Change it by **preset**, and **every preset defaults to today's render**, so no un-inspected surface moves |

**HALT** → §5.

**HARD FLOORS** — no disposition and no pre-authorisation reaches these.

| | Rule |
|---|---|
| **F1** | **No vote affordance.** A read-time aggregate is never given controls |
| **F2** | **No colour ported from the mockup by name.** The mockups are light-theme; the shipped ramp is dark **and inverted** |
| **F3** | Token **values** are CI-pinned. Usage may change; value never |
| **F4** | Nothing under `src/server/**`, no read-model field, no handler or submit path |

### §4.3 · Presets, never primitive-wide

`.sidechip.md` is **9px on Discovery, 10px on d5, 8.5px on Profile** — same class name, different ratified numbers per surface. Applying one surface's numbers to a shared primitive imports them onto surfaces with their own.

**Every new preset defaults to the render that ships today, and the default is proved (§8.2), not asserted.**

---

## §5 · The halt set

**A halt stops that delta and reports. It does not stop the run** unless marked ⛔.

### Base set — every surface inherits these

| # | Halt |
|---|---|
| **H1** | A delta needs a field the read model does not carry |
| **H2** | A fix would touch `src/server/**`, a handler, a submit path, or the argument-required gate |
| **H3** | A fix would add a field to `DebateViewModel` or a type it transitively contains — **ADR-0034 D-1**, keyed on the property not on a class letter |
| **H4** | A fix crosses into another surface's components (§4.2 C1) |
| **H5** | A delta is blocked on a ruling `POLISH-0.md` §0 marks `OPEN` or `SCHEDULED` |
| **H6** | A named baseline does not exist → class **S**, SPEC-FIRST |
| **H7** | ⛔ Any DDL, migration, new `EVENT_TYPES` value, ADR or SPEC edit turns out to be required |
| **H8** | ⛔ `tokens-monochrome.test.ts` goes red — a new colour token or a changed hex |
| **H9** | ⛔ `just verify` or the suite red at a commit boundary. **Do not stack commits on red.** One exception only: a guard deliberately committed RED, whose RED output is captured **before any fix is written** and pasted into its commit body |
| **H10** | A required reviewer returns a bare PASS **twice** |
| **H11** | ⛔ The branch already exists, or `git branch --show-current` disagrees after checkout — a colliding `checkout -b` is a no-op that silently leaves HEAD on `main` |
| **H12** | A second `vitest` runner is detected. Concurrent runs truncate each other's fixtures into a **false RED**. Use `pgrep -f 'node.*vitest'`; `ps \| grep` matches its own command string |
| **H13** | A mockup colour token is about to be ported **by name** where it encodes a side |
| **H14** | A static guard finds an offender **not in its predicted list**. Stop and report — **never widen an allowlist to make a suite green.** That is the failure the guard exists to prevent |
| **H15** | A new guard is **green on first run**. It must be RED. A green first run means the predicate is wrong — a vacuous pass |
| **H16** | Scope creep into a named out-of-scope row |
| **H17** | A handoff file fails its admit-check (§9.3) |

### Per-surface slot

`<add the halts specific to this surface — the read that must not widen, the file that must not move, the fixture that must not change>`

---

## §6 · The edit boundary

**Frozen.** Token *definitions* — `globals.css`, contract v0.4, the 11-token hex census, the poles, `--graph-*` · the type ramp, radii, elevation tiers, motion values · theme, ground, colour.

**Fair game.** Which token a component **uses** (the wrong semantic slot) · non-token layout — grid columns, widths, aspect ratios, element order, hardcoded gaps · copy strings · aria labels · static elements rendered from data already in props.

This is **usage, not value**, and the value half is machine-enforced.

**Forbidden in a machine PR, without exception:** anything under `src/server/**` · any field on `DebateViewModel` or a type it transitively contains · any submit path, handler or the argument-required gate · any migration, event type, ADR or SPEC edit · any file outside the declared component list.

> **⚠ This bounds the MACHINE PR, not the surface.** A halted delta routes to a gated follow-on where these prohibitions do not apply and the named-reviewer cascade does. DISCOVERY-COMPLETE changed `hero.ts` and added four DTO fields — correctly. Conflating the two produces either a template that forbids necessary work, or a machine pass quietly doing read-model work under a cosmetic gate.
>
> **One carve-out:** a canon amendment that a code change depends on lands in the **same commit** as that code. Docs are not SPEC.

---

## §7 · Ratify, plan, execute

**Ratification is the hard gate. Nothing is edited before it.** Three of four POLISH.0 divergences were false; an apply-first run ships all three and hands you a diff where good and bad changes are already tangled. **False positives die on paper.**

The ratification table — one per surface, the last column filled by the operator:

| # | What differs | mockup:line / file:line | class | disposition | baseline | halt | verdict |
|---|---|---|---|---|---|---|---|
| `<S>-D01` | one line | both sides | V/F/B/S/R | per §5 | tier + doc | H-n or no | ✓ / ✗ / amend |

**Ratification is default-ON.** Pre-authorising a full run — no halt-for-ratification — is an explicit per-run founder grant, and it **removes every checkpoint except Gate C**. Say so when asking for it.

**Ritual depth**, from `POLISH-0.md`: `.3` and `.4` take the full plan→execute with the named-reviewer cascade — the reply-as-bet surface and the write path. Everything else is a single gated pass. **Ultracode is never stacked on a gated unit**, and permission is checked **per commit** against `CLAUDE.md` §6's four conditions, not granted per surface. A commit carrying an ordered proof obligation — a RED before a fix, a before/after baseline — fails condition 4 even inside a granted surface.

**Reviewers, sequentially, one DB-touching reviewer at a time** (concurrent subagent runs saturate local PG and manufacture flakiness). Launch from a worktree at `origin/main` — agent definitions load from the session's working directory at launch and are not hot-reloaded; a subagent dying at 0 tool_uses is a stale model pin.

**Every reviewer answers as separately-stated points, never a bare PASS.**

---

## §8 · Proof discipline

### §8.1 · Non-vacuity

A control that cannot fail is worse than no control, because it reads as discharged.

| | Rule |
|---|---|
| **N1** | **Alive check first.** A glob, grep or `ls-tree` that matches nothing passes vacuously. Assert the set is non-empty before asserting anything about it |
| **N2** | **Sentinel + a second distinct value + absent → null.** A single-value test is satisfiable by a constant |
| **N3** | **A positive control beside every absence assertion.** `not.toMatch` passes when its pattern matches nothing — and "matches nothing" is what a rename or a reformat produces |
| **N4** | **Behaviour over source match.** Assert what a call *does*, not that it exists. A source match is the weak form and false-alarms on correct code |
| **N5** | **Assert SET EQUALITY, never a count.** A seventh cannot appear silently and a sixth cannot be quietly added |
| **N6** | **Read the deployed artifact.** Source is what you wrote; the bundle is what ships |
| **N7** | **Negative controls must SPAN failure classes.** Three probes for one failure mode raise confidence without raising coverage |
| **N8** | **A promised assertion delivered vacuously is worse than an absent one, because it reads as discharged.** An absent assertion is visible in a coverage read; a vacuous one carries a false receipt. **V-6** |
| **N9** | **A green suite is not a gate.** Three surfaces have now shipped a real defect through a green suite — including a live INV-3 pole inversion whose every test rendered the other side as `null` |

### §8.2 · Zero-delta proof, per consumer

Changing a shared primitive requires proving each existing call site is unaffected. **Enumerate every one — never claim it.**

- A **byte-identical baseline** captured from the pre-change component and pinned.
- Or an exact argument pin plus a tail assertion.
- **Byte-identical, not visually identical.** A first draft once emitted the same classes in a different order and passed by eye; the byte pin caught it.
- **A counted inventory goes stale inside one PR.** One went from 9 files to 13 four commits later. Re-count at PR head, never at plan time.

---

## §9 · Known hazards

### §9.1 · The four routes to a wrong pole

Every remaining surface ports from the same light-theme mockups into the same inverted dark ramp. All four routes have produced a real inversion in this repo.

| # | Route | Mechanism | Caught by |
|---|---|---|---|
| **1** | **Semantic indirection** | `side === "YES" ? "default" : "secondary"` resolves through shadcn variants to a near-WHITE neutral for YES. The call site names no colour, so the inversion is invisible where it is written | the static pole guard |
| **2** | **Name-porting across the inverted ramp** | The mockups are light (`--ink` near-black); the build ramp is dark (`--color-ink` near-white). Porting a side-encoding token **by name** flips the pole | the static pole guard |
| **3** | **Fixed pole on a per-side element** | No side value appears in the colour expression at all. The pole is hard-coded while the quantity it measures flips meaning with the side | ⚠ **NOTHING** |
| **4** | **Partial-mechanism porting** | The mockup expressed the binding through **track + fill + anchor**; the port copied the fill colour and missed the anchor eleven lines away | ⚠ **NOTHING** |

**⚠ The guard catches routes 1 and 2 only, and its own docstring says so. A green run is not completeness.** Route 3 has no static detector — there is no side-keyed expression to match, so nothing can match it. A component-level rule was evaluated and **rejected**: it false-negatives on the most important live instance, where the file keys on side in one place and not in another.

**Routes 3 and 4 are closed by review and by per-pole render tests — assert BOTH a YES and a NO instance.** A YES-only test passes on an inverted NO panel. That is exactly how the last one survived a full PR with tests.

**The porting rule:** when a mockup expresses a binding through **position or anchoring** as well as colour, port the **binding**, never the property. Route 3 is the shape the code ends up in; route 4 is the misreading that gets you there. **The mockup was correct both times.**

**The guard's file inventory is deliberately brittle.** Each new pole site is a **decision** — add the file explicitly, with a comment saying why. Never relax the predicate to avoid the churn.

### §9.2 · The plausible-mechanism hazard

**Twice in one surface, the web lane asserted a defect that did not exist**, and CC refuted both against the served artifact: a defect in a section that had no such defect, and a carousel ordering claim contradicted by the shipped HTML.

Both were **plausible mechanisms accepted without verifying the artifact.** The mechanism was coherent; the artifact disagreed. Verify against what shipped, not against what would explain the symptom.

**And the mirror:** a build session once shipped a factually wrong number on a public surface with a confident justification wrapped around it, then wrote the ruling it had violated into its own docstring. Neither a green suite nor a reviewer caught it — Gate C did. **Confidence is not evidence, in either direction.**

### §9.3 · Handoff files need an admit-check

A path is a claim; a string in the file is evidence. Commit 1 of this very task halted because a relay named a destination that already held a **different file of the same name**.

**Every file handed between lanes carries an admit-check the receiver runs first:** md5, line count, and **at least one string that exists only in the intended version**. Halt on failure; never author a substitute for another lane's ratified text.

### §9.4 · Two mechanical habits, both earned

- **After any merge lands mid-session, re-verify the working branch still exists remotely before pushing.** An auto-deleted branch got recreated carrying an already-merged duplicate. Twice.
- **`git add -A` destroys session logs.** It once replaced a 195-line log with 47 lines of pasted relay text, and no gate saw it — `just verify` passed, CI would have passed, and it would have squashed to `main` *as* the log. Now guarded by a test that asserts the tracked set survives, is non-empty, and still opens with an H1. Presence and non-emptiness alone would not have caught it.

---

## §10 · Gate C

**A web diff-read before merge, on every machine-phase PR, without exception.** Not the heavy surfaces only.

Three surfaces, three green suites, three real defects that only a diff-read caught: a half-applied change no test pinned; a factually wrong figure on a public surface; a live INV-3 pole inversion.

**Diffs travel as UPLOADED FILES.** CC writes the diff to `~/Downloads`; the operator uploads it. Never pasted terminal output — four transmission failures established this and two more happened during this task.

**⚠ Every reviewer finding is reported INDIVIDUALLY, at the severity the reviewer assigned it, with `file:line` and a disposition.** Never *"a CRITICAL plus two HIGHs."* A PR was once cleared containing two unaddressed HIGHs because of exactly that phrasing.

Gate C is not optional and it is not a formality. If a run was pre-authorised, **it is the only checkpoint left.**

---

## §11 · The founder pass — ⚠ provisional

**Written from zero completed instances.** Revise it after the first one runs.

Currently batched: all machine phases first, then **one comprehensive visual pass across the whole product**, then refinement PRs. That reverses the original per-surface sequencing.

**⚠ The revert trigger.** The deferral is safe **only because** shared visual decisions land as **named presets**, so a later ruling is one line per preset rather than a six-surface sweep. If they land inline instead, the safety property is gone and the batched pass must be revisited.

**What is lost, and how it is recovered.** The original sequence let each eye pass teach the next surface's relay what the machine missed. Batching discards that. Recovered by obligation: **every machine-phase close-out emits a "what the machine read missed" line, and the next surface's relay carries it.**

**Judge only what a machine cannot:** proportion, density, rhythm, balance · does the eye land where it should · does anything read as broken, unfinished or accidental · do the states feel like one family.

**Do not re-check what the machine covered** — presence, order, token slot, copy. If it missed one of those, that is a finding about the relay; note it for the next surface.

**Out of scope, never filed:** responsive and viewport (desktop 1440 only) · accessibility (routed to its own workstream; surfaces close as `closed (a11y-deferred)`) · anything in `POLISH-0.md` §2.1 bucket A.

**⚠ The pass produces a backlog across every surface it covers, and those refinement PRs need build time.** Budget it before starting, not after.

**Exit:** every `POLISH-0.md` §7 item is a PASS, a register row with a class and a disposition, or `data-blocked` with a named reason. **A surface does not close on "looks fine."**

---

## §12 · Close-out

### Register hygiene

- **Allocate real `PD-<surface>-<nn>` numbers from the live high-water mark.** Never renumbered, never reused.
- **Every row names its baseline** — the tier and document. If none can be named it is class **S**.
- `class` takes exactly one letter, unbolded — or `—` for a non-defect row. `status` takes exactly one of the five defined values. **Never append a row below a blank line**: three rows once sat outside the table body, invisible to every parser and to GitHub's renderer, and a stale count in the footer agreed with the broken parse. Two independent errors corroborating each other is what made it invisible.
- **A `superseded` row cites the superseding `doc:line`.** A superseded row with no citation is indistinguishable from an unexamined one.
- **Carry-forwards are homed with NAMED OWNERS.** A carry with a shape and a size but no owner is a phantom. So is a routing destination with no docket row — **a destination named in a committed document gets a `docs/parked.md` row in the same commit.**

### The close-out

```
# POLISH.<N> — CLOSE-OUT

Surface · routes · components (as VERIFIED at step 0, not as listed)
Step 0 findings: <n> TRUE · <n> FALSE · <n> UNVERIFIABLE — each with evidence
Machine PR: #<n> — <k> shipped, <j> halted, <s> superseded
Halts routed to: <the follow-on task, by name>
Register: PD-<n>-01 … PD-<n>-<nn>, allocated from the live high-water mark
Exit bar: item by item — PASS / row / data-blocked with a named reason
Emitted to the tracker: ONE batched row
Carried forward: build rows opened, rulings raised, each with a NAMED OWNER
⚠ Lesson for the next relay: what the machine read missed
```

The last line is mandatory. With the founder pass batched, it is the only surviving carrier of the feedback loop.

## §13 · Standing rules minted at POLISH.8

Each rule below comes from a defect that reached a founder, and every one of them is about the **relay and the plan**, not about the code — which is where POLISH.8's cost actually landed. ⚠ **This lead-in states no count, deliberately.** It read *"Three rules … All three"* while §13 already carried four, and was wrong the moment it was committed — §13.3 firing on §13 itself. Per §13.3, the count is **deleted, not corrected**: correcting it to five would break again at §13.6.

### §13.1 · Run the plan against its own stop conditions before shipping it

**A plan can forbid its own execution, and the contradiction is invisible from the plan text alone.** POLISH.8's ⛔ stop condition S-0a halted the run if a guarded child-safety string appeared *"ANYWHERE in your working diff, in any file, for any reason"* — and §2 mandated committing the plan **verbatim**, while the plan's own text contained that string twice. The two mandates were jointly unsatisfiable: the run could not start. CC proceeded under a narrow stated exemption and the founder ratified it, but **an unattended overnight session was made to take a judgment call on the one condition class that is child-safety.**

**The rule.** Before a relay ships: **run every stop condition against the plan's own commit 0**, and against the plan's own edit boundary. A carve-out written in advance — *"S-0a does not fire on the verbatim text of this plan"* — removes the judgment call entirely. **A guard that fires on the document defining it is not over-broad; it is broken.**

### §13.2 · The edit boundary must name the tests that pin the behaviour, not only the source

**Behaviour is pinned by tests, and a boundary drawn around source files forbids its own items.** POLISH.8's §4 listed *"the new admin-side test file(s)"* and no existing ones. S-3 — an ordinary confirm on Close, required by SPEC.1 — was therefore unshippable by construction: the old behaviour was asserted in a passing test **by name** (`close-is-one-click`). It halted at S-0k, proven at 1 failed | 5 passed, not predicted.

**The rule.** For every item whose fix **changes behaviour**, the boundary names the existing tests that assert the current behaviour, or states that updating a test encoding a superseded position is in scope. ⚠ **And at recon: for every delta whose fix changes behaviour, grep the suite for a test pinning the current behaviour and report it on the row.** A delta with a green test defending it is a different, more expensive object than one without — and POLISH.8's recon filed that delta as doc-vs-doc when it was doc-vs-green-test.

### §13.3 · Delete the count, or make the count and the enumeration the same artifact

**A total written beside an enumeration will disagree with it.** Seven instances in this phase: `POLISH-TRACKER` §6 (EIGHT stated, SEVEN enumerated) · the POLISH.8 log's §7 and §10 (nine stated, eight enumerated) · §4 (*"20 rows"* / *"27 deltas"*, enumerating 21 against a true 28, with `D21` never existing) · §9 (*"Four things"*, six items) · and a 20-vs-19 commit count. **Four were inside PR #323 — one of them in the very section that minted the rule against it.**

**The rule, and it has two forms.** Where the count carries no information — a lead-in like *"Four things"* — **delete it**; do not correct it, because the next added item breaks it again. Where the count is load-bearing, **make the count and the enumeration one artifact**: a numbered table of *n* rows fails visibly if the total is wrong. And **never write a total you did not just measure.**

✅ **Evidenced, not merely argued:** after the numbered-table treatment was applied, the next instance — a 20-vs-19 commit count at Gate C read 3 — **died at authoring**, the first of the seven not to reach a founder.

### §13.4 · Unattended runs fence by DIRECTORY on a critical path

**An unattended run's stop conditions fence by DIRECTORY on a critical path, never by mechanism — and the fence is stated in the durable document, not only in the run's relay.**

POLISH.8's stop set named the moderation **act path** — `moderateComment`, `recordGateBlock`, `BLOCKED_REASONS` — and not the moderation **directory**. The run legitimately edited `src/app/(admin)/admin/moderation/audit/page.tsx` with bypass permissions on, and the question surfaced at reconciliation rather than at relay-authoring time. **Fencing by mechanism requires the author to have enumerated every mechanism correctly in advance, which is exactly the assumption the guardrail exists because we cannot make.**

**`src/app/(admin)/admin/moderation/**` joins the ⛔ stop set for any unattended run.** A relay-only fence dies with the session; that is O-1 applied to itself.

### §13.5 · A replacement instruction names the UNIT, quoted in full — never the phrase it changes

**Anchor on what you are REPLACING, not on what you are CHANGING.** The POLISH.8 close-out pack committed this five times. Three were caught before any commit — CC halted on them — and **one of those three would have SHIPPED**: it left `POLISH-TRACKER.md` §6 ending with two *"This is a MEASUREMENT, not a forecast"* paragraphs that disagreed three ways, and it rendered cleanly, so nothing downstream would have caught it. Two more were caught at Gate C: §5's diagram lost the entire downstream phase shape because the anchor named the diagram and the replacement redrew only its top half, and §5 was left contradicting §6 about R-G's batch lever because the anchor stopped one paragraph short.

**The rule.** Every replacement instruction **quotes the full text it replaces, verbatim, in a fenced block** — the whole paragraph, the whole diagram, the whole table row. A receiver can string-match a quoted anchor; a receiver cannot check an anchor described in prose. ⚠ **And the failure mode is asymmetric: an under-scoped anchor that yields visible garbage is caught by the next reader, while one that renders cleanly and contradicts its neighbour is not.** Assume the second.

**Corollary — a handoff's admit-check must be verifiable in the medium the handoff travels in.** v1.0 of that pack named a line count as an admit-check leg and was delivered as an inline paste; CC correctly reported it UNVERIFIABLE — *"counting my own transcription would measure my typing, not the artifact."* Name legs the receiver can check: a version string, a ground SHA, a block sequence, a contiguous ID range.

---

*Authored by web Claude, 2026-08-10 IST, at the POLISH-TEMPLATE task. Ground `origin/main` @ `35d041d`. Supersedes `POLISH-STRATUM.md` following a statement-by-statement absorption audit. §1–§10 and §12 are written from three completed machine phases; **§11 is provisional and written from none.***
