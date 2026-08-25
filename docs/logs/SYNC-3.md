# SYNC-3 — the scale premises: what a 100,000-signup target falsified, and what it did not

Branch `chore/sync-3-scale-premises`, base `origin/main` @ `a8c5e06` (verified live at session
start, unchanged from the recon). **Docs-only** — `git diff --name-only origin/main...HEAD`
returns five paths, all under `docs/`. Not critical path: no schema, no migration, no `src/`,
no `tests/`, no workflow.

**The task is a premise change, not a defect fix.** The experiment's target moved to
**100,000 signups and 2,000,000 page loads with no cost ceiling**, and this pass records what
that falsifies, what it conspicuously does *not* falsify, and what was already wrong on `main`
before anyone changed a target. The distinction between those three is the whole content of
the session.

---

## What landed (files + PR#)

Seven commits, six files. **PR #364.** Squash SHA at merge.

| Commit | Section | File(s) |
|---|---|---|
| `15efd1a` | **§A** | `docs/adr/0038-scale-target-100k.md` — **NEW**, 95 lines |
| `b730cc3` | **§B** | `docs/adr/0006-hosting.md` — second Patch record + header-cell second entry |
| `a1fcc95` | **§C** | `docs/logs/POOL-1.md` — the compute-tier ruling struck where a reader reaches it |
| `47ee985` | **§D** | `docs/specs/SPEC.2.md` — §0's stale-ceiling annotation, itself re-measured |
| `6eb0a7b` | **§E** | `docs/parked.md` — three corrections (`ADR-0006-DISCIPLINE` ×2, `N5`) |
| `b867998` | **§F** | `docs/parked.md` — new row `IDENTITY-POOL-NAMESPACE` |
| *(this)* | **STEP 4** | `docs/logs/SYNC-3.md` |

Every pack block was **extracted programmatically by anchor and never retyped**, then proven
byte-identical in its destination. The `Instructions for AI` block was extracted from
`CLAUDE.md` §5.13.1's own fence for all seven commits and measured identical each time
(md5 `8f4aab09d860acfca37a6df02ae8f481`).

---

## The four corrections this log carries — because they correct a session log we deliberately did NOT edit

`docs/logs/SYNC-2.md` is history. Editing it to look right is the thing this project has
refused twice, so the corrections live here instead. All four re-measured this session.

**1 · `SYNC-2.md:59` — "157 commits behind" is now 169.**

> *"**The production alias serves `a61859a`** … commit #193 of 2026-07-02, **157 commits behind `main`**."*

`git rev-list --count a61859a..origin/main` → **169**. The drift is 12: the nine merges of the
SYNC-3 recon range, plus `#352` (SYNC-2's own merge), `#354` and `#353`. ⚠ **The line does not
date its figure**, unlike `:58` immediately above it, which says *"at the time of the recon
addendum"* and is therefore still true. One dated sentence and one undated one, four lines
apart, and only the undated one went wrong.

**2 · `SYNC-2.md:82` — the ADR ceiling line was falsified 3h49m after SYNC-2 merged, and
`:129` certified it as correct.**

> `:82` — *"**The ADR ceiling has not moved: `0036`, next free `0037`.**"*
> `:129` — *"**Questions 5, 6 and 7 remain open and are correctly stated above.**"*

`ADR-0037` landed at **#355**, 2026-08-18 17:45:59 +0530. SYNC-2 merged at `a50de29`,
2026-08-18 13:56:06 +0530. **Live ceiling measured at this session's STEP 0: `0037`, next free
`0038`** — which is the number §A used. ⚠ The Gate C addendum re-certifying it is the sharper
half: a correct-when-written number was re-affirmed by a later reader who had no reason to
re-run `ls`.

**3 · `SYNC-2.md:81` — "twelve times" was never true.**

> *"**`CLAUDE.md` now contains `DO NOT MERGE` twelve times**, all inside §5.13.2."*

Measured now: **5 occurrences on 4 lines**, all inside §5.13.2. Measured at `a50de29` (SYNC-2's
own merge commit): **5**. Measured at `94dacb7`: **5**. ⚠ **The placement half is right and the
count half was already false at the commit that introduced it** — so this is not drift, and no
later merge caused it. Recorded because `:81`'s stated purpose is to stop a future pack halting
on a *"zero occurrences"* pre-flight gate, and a pack calibrated to twelve mis-fires just as
badly as one calibrated to zero.

**4 · The 5,000-vs-50,000 identity-pool image discrepancy — both sides quoted.**

| Side | Quoted |
|---|---|
| **5,000** — `docs/adr/0011-pseudonym-pool-design.md:71` | *"50 colours × 100 animals = **5,000 unique `(colour, animal)` pairs**. **Each pair is the subject of one Flux generation.** Each generated base image is composited with 10 deterministically-selected number variants…"* |
| **5,000** — `docs/adr/0011-…:167` | *"A model-checkpoint upgrade or major aesthetic override regenerates **~5,000 Flux images** at ~3.5h GPU."* |
| **5,000–10,000** — `docs/adr/0006-hosting.md:103` | *"identity-pool PFPs (**5,000–10,000 images** per SCAFFOLD.17) at low single-digit GB total"* |
| **50,000** — `docs/specs/SPEC.1.md:751` | *"Storage: **~50,000 × 50 KB webp ≈ 2.5 GB total**. Trivial CDN cost."* |
| **50,000** — `docs/specs/SPEC.2.md:1299` | *"**50,000 pseudonym profile pictures** uploaded once before launch"* |
| **50,000** — `docs/specs/SPEC.2.md:1301` | *"generates **50,000 PNG**-then-WebP-converted images locally on the DGX"* |

⚠ **`SPEC.1` contradicts itself one line apart.** `:749` reads *"Each animal image × 10 number
variants = 50,000 unique **pseudonyms**"* — which is correct and is the 5,000-image model — and
`:751` then prices **50,000 images**. The pseudonym count and the image count are different
quantities and `SPEC.1` uses one number for both. **Not resolved here.** It is recorded in §F's
new docket row because a namespace amendment that starts from the wrong base restates it at
~20 sites.

---

## Decisions made

1. **The `≤5k concurrent` figure was NOT declared falsified, and the ADR says so explicitly.**
   Concurrency is instantaneous; signups and page loads are cumulative over ~52 days.
   2,000,000 loads averages ~0.45/sec and even a large peak factor stays under 5,000 concurrent.
   Calling it falsified would have been the tidier sentence and would have discarded a figure
   that is still true while leaving the real problem unnamed — **four sizing decisions cited it
   as their justification, and those sizings are load-proportional in a way a concurrency
   number never described.**
2. **`0038` was taken from a live `ls docs/adr/`, not from any document.** STEP 0 ran before
   anything was written. Both `CLAUDE.md` §1 and the recon already said 0038; the point is that
   neither was trusted. ⚠ `#355` took `0037` *inside* the recon range, which is exactly the
   window in which a remembered ceiling goes wrong.
3. **Verbatim-and-flag was applied without exception.** Four disagreements between the pack and
   the repo are reported below and **none was reconciled**. Every block is committed byte-for-byte.
4. **`just verify` was run once, not seven times, and it is reported as vacuous *and* red.**
   See *Context to preserve* — the honest statement is longer than "green".
5. **Neither missing plan was written.** GH-STAR's Downloads artifact is a **pre-ratification
   draft carrying four unruled open decisions**, two of which the founder subsequently overruled.
   VIEWS-1 has no plan artifact at all. See *Open questions* 1.
6. **§F dockets the identity-pool namespace rather than amending ADR-0011.** The new
   construction is a founder ruling that has not been made, and the `O-5` sweep across ~20 sites
   is not something to do halfway.

---

## Contradictions between the pack and the repo — committed as written, reported here

**F-1 · §E.2's text says the ADR-0006 patch lands "in the same commit as this line". It does not.**
The pack's discharge line reads *"lands as a Patch record on ADR-0006 **in the same commit as
this line**"*, but the kickoff's STEP 3 mandates one commit per section, so §B (`b730cc3`) and
§E (`6eb0a7b`) are separate. **Both land in the same PR**, which is what the claim is actually
protecting. Committed verbatim; the commit shape came from the kickoff and the sentence from
the pack, and reconciling them is a founder call, not mine.

**F-2 · §E.3a's replacement produces NESTED BOLD, which will not render as intended.**
The target sentence is already bold — `**On disk the numbering runs …, 0003–0036 — 34 files.**`
— and the pack's replacement text contains its own `**…**` spans. The result on `main` is
`**On disk … 0003–0037 — 35 files ⚠ **re-measured…#355.** Read \`ls docs/adr/\` … wrong again.**`.
Markdown closes the outer bold at the first inner `**`. **The text is correct; its emphasis will
render wrong.** Not fixed — fixing it means editing ratified bytes.

**F-3 · §A's closing line promises a same-commit SPEC.2 §22 row that §G forbids.**
ADR-0038's *Spec impact* reads *"`SPEC.2` §22 index gains this row in the same commit."* §G says
*"SPEC.2's §22 index is NOT rebuilt. `N5` owns it and says it is normative."* **The two
instructions in one pack are incompatible and §G is the operative one**, so no §22 row was
added. ⚠ **ADR-0038 therefore ships stating a spec impact that did not happen** — which makes it
the fourth ADR in `N5`'s backlog rather than the exception to it.

**F-4 · The kickoff's warning about nested fences in §A does not match the pack.**
The kickoff cautioned that *"§A's ADR contains nested ``` fences"*. Measured: the pack has
**18 fence lines forming 9 clean pairs**, and §A's block (pack lines 30→126) contains **none**.
The anchor-based extractor was used regardless — it is the right method whether or not the
hazard is present — but the stated hazard was not there. **Reported so a future pack is not
written to defend against a problem this one did not have.**

**F-5 · §B's anchor is quoted without its backticks.** The pack names the section
`## Patch record — 2026-08-09 · the ratified bom1 region was never applied (PERF-1)`; the file
has `` `bom1` ``. **Not ambiguous** — ADR-0006 contains exactly one `## Patch record` heading —
so the item proceeded rather than halting. Recorded because a stricter matcher would have halted.

---

## Where things were placed, as the pack asked

- **§B's new Patch record** → `docs/adr/0006-hosting.md:462`, immediately after the PERF-1
  patch record and everything belonging to it, and **before** the file's closing `---` +
  italic footer (now at `:488`/`:490`). The footer belongs to the whole ADR, not to PERF-1.
- **§B's header cell** → `:12`, second entry appended `<br>`-separated. **Format copied from the
  repo's own precedent**, `docs/adr/0023-participant-shell-topology.md:12`, which already
  carries two patch records in exactly that shape. Not invented.
- **§F's new row** → `docs/parked.md:834`, between `STAGING-FIXTURE-DISCOVERY-SHAPE` (the last
  of the three hard-dated `DUE 2026-09-05` rows) and `O1-KICKOFF-INPUT`. It keeps the
  pre-go-live cluster contiguous, which is what "adjacent to the other pre-go-live rows" asks
  for, and §F's own trigger is pre-go-live.

---

## Open questions

1. **⛔ Neither GH-STAR nor VIEWS-1 has a plan on `main`, and STEP 2 did not land one.**
   - `~/Downloads/zz_GH-STAR_plan_2026-08-19T1731.md` (457 lines) **exists but is NOT ratified.**
     It carries a section headed *"Open decisions — founder to rule, execute does not pick"*
     with **OD-1 … OD-4** unruled. `docs/logs/GH-STAR.md` records that the founder subsequently
     **overruled OD-2 and OD-4**. The `#357` precedent landed a file that self-describes as
     *"**RATIFIED (amended)** — all five open decisions ruled by the founder … Ready for
     execute"* (`docs/plans/O1-DECK.md:3`), and that file is **byte-identical** to its own
     Downloads artifact (md5 `d43369ad2550e136b5d6b02a0a23e25c`, verified this session).
     **Landing a pre-ratification draft is a different act from that precedent.**
   - ⚠ **And it would land actively wrong text:** OD-2 recommends *"a short **ADR-0038**"* for
     the star count and was overruled — so `0038` stayed free and is now the scale-target ADR.
     The draft would sit on `main` proposing 0038 for something it is not.
   - **VIEWS-1 has no plan artifact anywhere** — `~/Downloads` holds only execute reports
     (`zz_VIEWS-1_execute`, `-1c_`, `-1d_`); `~/Desktop` matched nothing.
   - **Nothing was written.** A plan reconstructed after the fact from its own log is
     fabrication. **Founder call: ratify the GH-STAR draft as-is, ratify an amended version, or
     rule that both lanes close without plans.**
2. **`F-3` above — does ADR-0038's *Spec impact* line stand, given `N5` blocks the §22 row?**
   One-line fix either way, and not decidable from the pack, which instructs both.
3. **`F-2`'s nested bold** — fix in a follow-up, or leave as ratified bytes?
4. **The compute tier disagrees with itself and neither side was touched here.**
   `docs/adr/0006-hosting.md:82` ratifies **Small** (1 GB RAM, 2 vCPU shared);
   `docs/logs/POOL-1.md:15` measured **Micro** at the dashboard on 2026-08-08 and says
   *"the 15 is that tier's default."* ⚠ **Load-bearing for scale work**, because `pool_size: 15`
   is the number `src/db/index.ts:24` divides by, and which tier is live decides whether 15 is
   still the right divisor. **Not ruled — needs a dashboard read.**

---

## Next session starts at

**Gate C — a web diff-read of PR #364 (`chore/sync-3-scale-premises`).** ⛔ **DO NOT MERGE before it.**
The diff travels as an **uploaded file**, `~/Downloads/zz_SYNC-3_diff_<T>.md`, not as a paste.
Exact next action: read the five `F-` contradictions above, rule open questions 1–3, and decide
whether `F-3` warrants amending ADR-0038's *Spec impact* line before merge.

**After merge, in order:** (a) advance `staging` — **⚠ but see *Context to preserve*: it is
already level as of this session**, so this may be a no-op; re-run §2.5(b)'s content test rather
than assuming; (b) the identity-pool namespace ruling (§F's row) is the one item with a
**pre-signup-traffic** trigger, and it needs the 5,000-vs-50,000 resolution first.

---

## Context to preserve

- **⚠ `origin/staging` MOVED between the recon and this session, and it was not moved by me.**
  The recon (16:14 UTC) measured `origin/staging` at `c58d64a`, one commit behind `main`, with
  an empty content diff — a clean §2.5 fast-forward, deliberately not performed under a
  read-only ritual. **Measured now: `origin/staging` == `origin/main` == `a8c5e06`**, and
  `git rev-list --count origin/staging..origin/main` → **0**. ⚠ **This session performed no ref
  mutation of any kind** — its only network write was `git fetch --prune`. I did not verify who
  advanced it, and **I did not call `/api/health`**, so *the ref is level* and *the deployment
  serves that SHA* are two different claims and only the first is measured.
- **`just verify` is BOTH vacuous AND red, and the honest report is the long one.**
  Run once with `ZUGZWANG_ENV=preview`: **typecheck ✅ → `biome check` ✅ (747 files) → `next
  build` ❌** on `Error: DATABASE_URL is not set` (log line 241). That is
  `project_fresh_worktree_no_env_local_build` — this worktree has no `.env.local` — and it is an
  environment fact that a markdown-only diff is structurally incapable of causing. **And even a
  green run would certify nothing here:** Biome 2.4.13 has no markdown support and runs
  `ignoreUnknown: true`, so **zero of the 747 files it checked is a file this PR touches**, and
  neither `tsc` nor `next build` reads a `.md`. This is `docs/parked.md`'s
  `MARKDOWN-UNGATED-BY-CI` row happening again, on a PR that PR would have caught.
  ⚠ **`biome check` was re-run before each of the six section commits** (all clean, 747 files
  each time); the full `verify` was not, because re-running a 4-minute build to re-observe the
  same env failure on files it never opens is waste, and saying so is cheaper than hiding it.
- ⚠ **A trailing `echo` masked the failure the first time.** `just verify > log 2>&1; echo
  "EXIT=$?"` reported exit **0** while the recipe had failed — the trailing command owns the
  exit status of the compound. The failure was found by reading the log, not the code.
  `feedback_gate_commands_never_pipe_to_tail`, hit live.
- **Every anchor was asserted UNIQUE before its edit**, and every span was re-asserted against a
  figure measured in a prior read-only pass (§D's annotation is 498 chars and the script halts if
  it is not; §E.1's sentence is 254 and likewise). A moved file halts rather than being edited blind.
- **`ADR-0006-DISCIPLINE` is now discharged and the branch commit is redundant, not lost.**
  `origin/chore/post-perf-1-docket` @ `1b7f37f` still exists and is still absent from `main`;
  the correction it carried was **authored fresh** into §B rather than cherry-picked, so nothing
  is owed to that branch any more.
- **This PR touches `docs/**` only** — asserted with `git diff --name-only origin/main...HEAD`
  (five paths, zero outside `docs/`), never against local `main`.
- **No staging push, no deploy, no promote, no database statement, no subagent, no dynamic
  workflow, and not one byte outside `docs/`.**

---

## Time

2026-08-19, 16:35 → 17:0x UTC (22:05 → 22:3x IST). Single session, seven commits, one PR opened
and left unmerged for Gate C.
