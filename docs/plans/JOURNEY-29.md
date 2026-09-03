# JOURNEY-29 — complete the journey document through the current HEAD

**Task:** JOURNEY-29 · Act VIII, the drift guards, and the renumber
**Mode:** autonomous overnight — abbreviated recon → plan → execute → PR → report
**Branch:** `journey/29-act-viii` · **Base:** `origin/main` = `ead741577b89849560ab3d3222a48b2a69bf18b7`
**Worktree:** `~/code/zugzwang/journey-29` (fresh, at `origin/main`)
**Written:** 2026-09-03, during the run, before slice 1.

---

## 0 · What this task is

The journey document stopped at 18 August. Eighty-seven commits have landed since and not one
carries an entry — which is exactly the backlog the document's own forward contract was written to
prevent. Nothing in the repository fails, warns or reddens because of it: the one test that touches
`docs/journey/` asserts the document is *reachable*, never that it is *current*.

This task writes that act, names it by a rule stated in advance rather than by feel, moves the
unwritten Window act out of the way, and installs three tests that catch voice drift mechanically —
because a single unattended pass has no human holding the voice in context, which is what the
original task's defence against drift actually was.

Everything else in the document is left exactly as it is. Three hundred and forty published entries
are not touched. The style spec is `docs/journey/STYLE.md` from slice 1 onward and wins over this
plan wherever they disagree.

---

## 1 · Ground, measured

| | |
|---|---|
| `origin/main` | `ead741577b89849560ab3d3222a48b2a69bf18b7` — **unmoved since the recon pin** |
| first-parent count | 433 (total 518 — `main` is not linear, so `--first-parent` is load-bearing) |
| act span | **n347 – n433**, 87 commits, 18 August – 3 September 2026, weeks 17–20 |
| commits beyond the recon pin | **0** — no new manifest or bodies file was needed |
| open PRs touching this diff | **none** (three open, zero touch `docs/journey/`, `README.md`, `CLAUDE.md`, `AGENTS.md`) |

**Numbering verified before drafting** (spec §13): the subjects at n=16, n=341 and n=346 — the
highest `n` carrying an Act VII entry — all match the mono lines of the entries carrying those
numbers. Dates check on the committer-local basis; weeks check against the derived formula.

**Baselines:** 341 headings / 340 distinct titles · 26,831 words in `docs/journey/` ·
`git notes list | wc -l` = **343** · full suite 4477 passed, 1 skipped, 4 todo across 451 files.

---

## 2 · The act's name, decided by measurement

Style spec §11.1 fixes the rule in advance: across **all** commits in the act — not a shortlist,
because a selection rule that hunts for a theme returns that theme — count the bodies that record an
instrument, a proof, a measurement or a stated claim that turned out wrong, and was corrected.
At or above 25% the act is **The Instruments**; below it, **The Start Line**.

| | |
|---|---|
| Commits classified | 87 of 87 |
| First pass | 55 YES |
| After adversarial verification (three lenses per YES, majority-refute kills) | **49** |
| Completeness critic over the NO set | 0 promotions proposed |
| **Result** | **49 / 87 = 56.3%** against a 25% threshold |
| **Name selected** | **The Instruments** |

Six first-pass YES verdicts were killed on verification and the reasons are worth keeping, because
they are all the same distinction: a guard *added* where none existed is an absence, not a wrongness;
a draft *improved* across review rounds is not a landed claim corrected; a risk *avoided in advance*
is not an error. The margin is wide enough that none of the six changes the answer.

⇒ **`docs/journey/08-the-instruments.md`**, `# Act VIII — The Instruments`.

---

## 3 · Tier assignment for all 87 commits (spec §12, applied in order)

| Tier | Count | How |
|---|---|---|
| **LANDMARK** | 3 | §3.2, fixed: n=415, n=401, n=397. Exactly three, no fourth. |
| **CHAPTER** | 65 | §12 rule 6 — substantive work with an answer to *what was being protected, and what did it cost?* |
| **GROUNDWORK** | 18 | §12 rules 3, 4 and 5 |
| **NO ENTRY** | 1 | n=367, child-safety, §7.2 default |
| | **87** | 86 entries |

**The eighteen Groundwork:** n=350, 354, 355, 364, 368, 372, 385 (session logs, close-outs and doc
sweeps, §12 rules 3–4) · n=386 and n=394 (substantive diffs whose record answers nothing — §12's own
test: *"If a commit has no answer to that, it is Groundwork, however large its diff"*) · n=405–412
(the eight merge commits, §12 rule 5) · n=425 (a doc sweep, rule 4).

**Four judgement calls, recorded because the mechanical rule set cannot make them:**

- **n=390** was Groundwork by the recon's mechanical pass and is a **Chapter**: the rule fired on the
  word *plan* inside a thirty-six-file feature squash. A `feat(` family colliding with a Groundwork
  rule is a collision, not a classification.
- **n=433** is a **Chapter**: rule 4 requires that a plan be the commit's *only* substance, and this
  one also mints a decision record.
- **n=425** is **Groundwork**: its only substance is a document sweep, and its two siblings of the
  same kind (n=350, n=364) are Groundwork. Three commits of one kind get one tier or the document
  teaches nothing.
- **n=426** is a **Chapter**: three-quarters of it records other work, but it retires a marker — a
  ruling, now carried in the contract file — and measures a distance nobody had written down.

**n=414 and n=418 are Chapters read from their attached notes**, not their messages: n=414's body is
empty and n=418's is the wrong text entirely. A note is a decision record, which §6 names as a source
an entry may trace to.

---

## 4 · Slices, in order, each with its exit condition

| | Slice | Exit condition |
|---|---|---|
| **S1** | Phase A complete · this plan committed · `STYLE.md` committed verbatim (RF-8) | `md5` of `docs/journey/STYLE.md` equals the source; plan on the branch |
| **S2+S3** | The three drift guards (RF-7) **and** tier markers on all 341 existing entries (RF-5) | Guards red against the unmarked corpus, green after marking; five planted violations each produce a named assertion |
| **S4** | The renumber VIII → IX (RF-3) | Zero residual `Act VIII` / `08-the-window` outside the spec; `Act IX` / `09-the-window` both present |
| **S5** | Three Landmarks, then the bridge (RF-1 spine, RF-2) | Each Landmark ≤200 words, exactly one visual, one spike; bridge 150–250 words |
| **S6** | Chapters in `n` order (RF-1) | 65 entries, each ≤90 words, guards green |
| **S7** | Groundwork in `n` order (RF-1) | 18 entries, each ≤40 words, guards green |
| **S8** | README reconciled (RF-4) · note-body files (RF-6) · the `CLAUDE.md` count sentence | Every README count equals its measured value; eleven note-body files present and unpushed |
| **S9** | Full suite · reviewer cascade · fixes · PR | Suite green, PR open and unmerged, notes count still 343 |

**S2 and S3 ship as one commit.** They have no shippable intermediate state: a ceiling guard cannot
know which ceiling applies until the markers exist, and a guard that skips unmarked entries passes
over the whole corpus while looking green. Splitting them produces a red tree between two commits,
which defeats the green-suite gate they were split to satisfy. The order of work does not move — the
guards are written first and run red before the markers land, which is the revert-to-red proof for
the marker assertion, obtained for free.

**Full suite green at the end of every slice**, not just the touched tests.

---

## 5 · File map

| File | Why |
|---|---|
| `docs/plans/JOURNEY-29.md` | this plan (S1) |
| `docs/journey/STYLE.md` | **new** — the style spec, verbatim (RF-8, spec §15). A binding rule that lives only in a mirror is not binding |
| `tests/unit/docs/_journey-entries.ts` | **new** — one parser for all three guards, so they cannot drift apart from each other |
| `tests/unit/docs/journey-word-ceilings.test.ts` | **new** — guard 1 (RF-7) |
| `tests/unit/docs/journey-jargon.test.ts` | **new** — guard 2 (RF-7) |
| `tests/unit/docs/journey-title-collision.test.ts` | **new** — guard 3 (RF-7) |
| `docs/journey/01…07-*.md` | tier markers only — an HTML comment per entry, zero prose changes |
| `docs/journey/08-the-window.md` → `09-the-window.md` | the renumber; only line 1's heading changes, the bridge prose is untouched |
| `docs/journey/08-the-instruments.md` | **new** — the act |
| `docs/journey/README.md` | the act table, the link, and every count reconciled to its measured value |
| `docs/journey/notes/` | **new** — eleven note-body files, written, **not pushed** |
| `CLAUDE.md` | the §5.13.1 count sentence, and nothing else |

---

## 6 · Ambiguities resolved, with the alternative rejected

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | The tier marker's form and position | HTML comment on its own line, after the mono line | Appending to the heading; a visible marker; a front-matter table | A comment renders as nothing, so 340 published records read exactly as they did. After the mono line because the mono line's position — always heading+1 — is what every existing reader of this corpus assumes, including the pass that verified the numbering |
| 2 | `Correct Five Times` (n=346): Chapter per the off-`main` register, or Landmark per word count | **Landmark** | Chapter | RF-5 says mark from §3.1 and, where §3.1 is silent, from measured word count. §3.1 is silent on n=346, and §3.1 is demonstrably not a census — it omits three entries that are Landmark-sized and in the off-`main` register, and its own table ends *"Plus the ranking-decision Landmark in Act IV"*, a row it does not print. Closed against redrafting is not the same as complete as an inventory |
| 3 | `Backwards In Public` is 207 words against a 200 ceiling | Pin it at exactly 207 | Exempt it; widen the ceiling; reword it | Rewording is forbidden — it is a published record. An exemption goes quiet forever; a pin still reds if the entry moves in either direction. Widening the ceiling to fit one entry deletes the guard's whole point |
| 4 | The eight merge commits: Groundwork or no entry | **Groundwork** | No entry | §12 rule 5 gives no entry only *"where the merge carries no body of its own"*. Each of these carries a one-line body naming what arrived. Silence would erase the largest diff in the act |
| 5 | n=425 (a doc sweep with a real measured discovery in it) | **Groundwork** | Chapter | Rule 4 is first-match-wins and a doc sweep is exactly what it is. Its two siblings are Groundwork; one kind, one tier |
| 6 | n=367, the act's one child-safety commit | **No entry** | One entry under §7.2's allowance | §7.2's allowance is for a commit carrying a decision nothing else in the corpus carries. This is a session log. Coverage is not a reason, and the default is not to write |
| 7 | The `Co-Authored-By` trailer the harness asks for | **Omit it** | Include it | `AGENTS.md` §10: *"No `Co-authored-by` trailer. Foundation commits are single-author."* The repository's committed contract is specific, reasoned, and has been enforced before |
| 8 | RF-6's `CLAUDE.md` amendment | Amend only what actually moved | Restate 346/341 unchanged; rewrite the surrounding section | The recon measured 346/341 and found the sentence **correct**. What moved is the ref: `git notes list` now returns 343, because two post-convention commits acquired notes. That is the count a reader measures against that sentence, and the sentence's own instruction is *"Update the count when it moves"* |
| 9 | Landmark visuals — spec §4 says "exactly one", three of four existing Landmarks have none | Exactly one each | Follow the corpus and give some none | The spec wins over the corpus by its own rule, and a visual is one of the few things that makes a Landmark legible as one |
| 10 | Where the bridge goes | Head of the new act file | A closing section at the foot of Act VII | Every one of the seven existing bridges is an OPENING bridge at the head of its own act; not one act file carries any prose after its last entry. A closing bridge would introduce a second convention into a document read one entry at a time |

---

## 7 · Predicted post-build values

| Baseline | Before | Predicted after |
|---|---|---|
| `### ` headings in `docs/journey/` | 341 | **427** (341 + 86) |
| Distinct titles | 340 | **426** |
| Act files | 8 | **9** |
| `git notes list \| wc -l` | 343 | **343 — identical, or the wall was crossed** |
| Full suite | 4477 passed / 451 files | **≥ 4477 passed**, plus the three new guards' assertions |

---

## 8 · Reviewer-bearing slices

| Slice | Reviewer | The failure mode being looked for |
|---|---|---|
| S2+S3 | `@test-writer` | A guard that passes for an unrelated reason, or a control that cannot fire |
| S4, S8 | `@code-reviewer` | A stale reference to the old act number surviving somewhere the grep pattern did not reach |
| S8, S9 | `@security-auditor` | Anything in this diff that writes, pushes, or could cause a later human to push a shared ref; and any child-safety material reaching a file, a note body, or the report |

A finding fixed is re-reviewed scoped to the fix, so the last fix in the chain is not reviewed by
nobody.

---

## 9 · Walls this plan operates under

- **No `git notes` write of any kind, and no push of `refs/notes/commits`.** That ref is shared and
  unlocked and has no review surface: a pushed note is live the instant it lands and no pull request
  can catch it. The entire safety model of this run is that it ends at an unmerged PR. Note bodies
  are files in the PR; a human applies them after reading them. `git notes list | wc -l` is measured
  before and after and must be identical.
- **No existing entry's prose changes.** Adding a tier marker is metadata.
- **No amendment to the style spec, an ADR, either specification, or the tracker.** A session that
  fixes a governing document to match its own build has removed the only thing that could have
  caught it. Findings are flagged in the report.
- **No push to `main` or `staging`, no production, and `staging:rebuild` is never run.**
- **Act IX stays a stub.** It is written during the live window by ruling; drafting it now is the
  retrospective that ruling exists to prevent.
