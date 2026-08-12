# SPEC.CHART / R13 — session log

**Task:** apply the ratified SPEC.CHART / R13 ruling. Docs only.
**Date:** 2026-08-12 IST.
**Pack:** `SPECCHART-apply-pack-v2.md`, web-authored, applied verbatim. v1 void and not read.

---

## 1 · Ground, branch, tree state

| | |
|---|---|
| **Pack's stated ground** | `origin/main` @ `198d1d0` |
| **Actual `origin/main` at run start** | ⚠ **`dfa3012`** — it had moved |
| **Ground actually applied against** | `dfa3012` — see §2, PF-0 |
| **Branch** | `docs/spec-chart-ruling`, reused from the halted v1 run, **reset onto `dfa3012`** |
| **`git status` at start** | clean |
| **`git status` at end** | clean |
| **Commits** | `c0a69e4` (the five ruling documents) + this log |
| **Terminal action** | PR opened. **NOT merged.** Gate C is the founder + web diff-read |

**Scope held:** five documents under `docs/` plus this log. No `src/`, no migration, no DDL, no ADR minted, no ADR ceiling read, SPEC.1 and SPEC.2 not amended. No subagents, no ultracode, one sequential pass.

---

## 2 · Pre-flight

### PF-0 — ground gate — ⚠ **FAILED, and the pack's own remediation applied**

`origin/main` was **`dfa3012`**, not `198d1d0`. PF-0's instruction on failure is explicit: *"run v1's FULL twelve-item pre-flight — every factual claim in the canon text is re-exposed by any change to `main` — and report the new SHA before applying anything."* That path was taken.

**What had landed:** `dfa3012` — *MOD-REPORT-PATH — user-facing reporting ruled OUT OF SCOPE for the experiment phase (#322)*. One commit, four files: `docs/adr/0021-…md`, `docs/logs/POLISH-7a.md`, **`docs/parked.md`**, **`docs/polish/POLISH-TRACKER.md`**.

⚠ **Two of the five target documents were touched by it.** That is why the ground gate exists. Specifically:

- **`POLISH-TRACKER.md`** — only the §4 `MOD-REPORT-PATH` row changed. The three Block-N anchors and the Block-S sentence were untouched and re-verified byte-exact.
- **`docs/parked.md`** — the `MOD-REPORT-PATH` heading changed and four lines were added *above* the SPEC.CHART section (shifting it down), and **two entirely new sections were appended at EOF** (`R2-412-DEPLOY-GATE`, `DMARC-ALIGNMENT`). **Block R′ anchors at EOF**, so its insertion point had moved. Blocks O′/P′/Q′ anchors were re-verified byte-exact and were not affected.

**Decision — applied at `dfa3012`, not `198d1d0`.** The branch was reset onto the new head before any write. Rationale: PF-0's remediation says *"before applying anything"*, which contemplates applying after re-verification rather than halting; applying at the stale SHA would have produced a PR whose head is behind base (branch protection rejects a stale head) and whose `parked.md` insertions would collide with the two new EOF sections. All twelve checks plus the two new shape checks were re-run at `dfa3012` and passed, so no factual claim in the pack's canon text was invalidated.

### The full twelve, re-run at `dfa3012` — 12 / 12 PASS

| # | Verdict | Evidence at `dfa3012` |
|---|---|---|
| PF-1 | ✅ PASS | SPEC.1 §9 · "X domain — market lifetime" carries the routing sentence — 1 occurrence |
| PF-2 | ✅ PASS | `UI.19.md` §Self-critique #1 carries *"canon-owned, not spec-pinned — build endpoints only"* — 1 occurrence |
| PF-3 | ✅ PASS | `design-canon.md`: **`chart` = 0 occurrences**; `graph` = 3 (§1 phase row, §2 Profile, §8 row 14). **None in §10.** Routing target confirmed empty |
| PF-4 | ✅ PASS | Two `<text>` labels, `axis-x-start` / `axis-x-end`, expanded-only. Grep for tick/grid/granular/bucket/interval/scaletime across `chart/` → 2 hits, both comments asserting absence |
| PF-5 | ✅ PASS | Two-item YES/NO legend, `--graph-yes` / `--graph-no` swatches, `aria-hidden` |
| PF-6 | ✅ PASS | Panel `w-[min(92vw,880px)] … rounded-[var(--r)] bg-n0 … p-4`; `aspect-[2/1] w-full` in both Card and Overlay; `VIEWBOX_W = 640`, `VIEWBOX_H = 320` |
| PF-7 | ✅ PASS | `r="4"`, side-token fill, `stroke="var(--color-ground)"`, `strokeWidth="1.5"`, `vectorEffect="non-scaling-stroke"` |
| PF-8 | ✅ PASS | Backdrop `bg-[var(--overlay)]`; close `rounded-[var(--r-chip)] px-2 py-1 text-n5 hover:text-ink` |
| PF-9 | ✅ PASS | W2.6 record §10 item 1: *"**Write the production spec** for the market graph from this record"* |
| PF-10 | ✅ PASS | Overlay `sr-only` = **0**; Card `sr-only` present |
| PF-11 | ✅ PASS | `ls docs/plans/UI-19*` → no matches; `docs/plans/UI.19.md` exists |
| PF-12 | ✅ PASS | Highest bare R-number = **R9**; `grep -rn "C-CHART" docs/` → **0** |

### The two new v2 shape checks — the ones that were the halt at v1

| # | Verdict | Evidence |
|---|---|---|
| **PF-13** ⭐ | ✅ PASS | POLISH.3 header parses to **9 columns** — `ID \| Title \| Class \| Baseline \| Evidence \| Disposition \| Status \| Root cause \| Routed to` — and `PD-3-01` parses to **9 cells**, confirming the shape is live, not a stale header |
| **PF-14** ⭐ | ✅ PASS | `parked.md` A11Y.0 backlog is a **2-column table** `Item \| Where` with exactly **4** data rows |

### Column sets declared by every table-writing block — all verified before writing

| Block | Declared | At head | |
|---|---|---|---|
| D (§8 row 14) | 5 columns | 5 | ✅ |
| D (§1 phase row) | 3 columns | 3 | ✅ |
| E (PD-0 table) | 8 columns | 8 | ✅ |
| F′ (POLISH.3) | 9 columns | 9 | ✅ |
| G (§0 index) | 4 columns | 4 | ✅ |
| J / K / L (tier rows) | 2 cells | 2 | ✅ |
| M (patch record) | 3 columns | 3 | ✅ |
| N (tracker ×2) | 3 cells | 3 | ✅ |
| Q′ (A11Y.0) | 2 columns | 2 | ✅ |

---

## 3 · Delegated values — both computed independently, both matched their positive control

### §3.1 · `PD-3-nn`

Found: `PD-3-01`, `PD-3-02`, `PD-3-03` — contiguous, no gap, no duplicate. Highest pre-existing = **`PD-3-03`**. Next free = **`PD-3-04`**.
**Expected `PD-3-04` → MATCH.** *(The table's last row `RR-3` sits outside the sequence and does not affect numbering, as the pack noted.)*

### §3.2 · The §0 tally recount

Counted row by row from the 19-row index, mechanically.

| | SCHEDULED | RULED | OPEN |
|---|---|---|---|
| **At head, before Block G** | **11** — R1, R2, R4, R5, R6, R7, R10, R11, R12, R14, R15 | **7** — R3, R8, R9, R16, R17, R18, R19 | **1** — R13 |
| **After Block G** | **11** | **8** — R3, R8, R9, **R13**, R16, R17, R18, R19 | **0** |

**Expected `11 SCHEDULED · 8 RULED · zero OPEN` → MATCH.**

**The pre-existing discrepancy, reported as required.** The sentence at head read *"Nine SCHEDULED · eight RULED · one OPEN"*. It was **wrong on both counts, in opposite directions** — SCHEDULED understated by 2, RULED overstated by 1 — and does not reconcile by excluding R2 from SCHEDULED (that yields 10, not 9). The sentence and its own table had drifted independently.

**R2 double-description — CONFIRMED.** R2's State cell reads `SCHEDULED` and R2 *is* counted inside the 11, while the sentence also names it routed out of POLISH. §3.3's clarifying sentence was therefore applied immediately after the tally.

---

## 4 · Blocks A → T — all twenty applied, every anchor matched

| Block | File · anchor | Result |
|---|---|---|
| **A** | canon §2 Market Detail, after `Pick is **view-only**.` (1 occurrence) | ✅ applied as a sentence in the same paragraph |
| **B** | canon §10 head, before the first numbered item | ✅ applied |
| **C** | canon §10 end, before `## §11`. Structure confirmed: six-item numbered list (three tagged `R-2`/`R-5`/`R-3`), Đ-cluster block, P7/R8 block with its R9 clause | ✅ `C-CHART-1` appended |
| **D** | canon §8 row 14 + §1 phase row, both byte-exact | ✅ both replaced, 5 and 3 cells preserved |
| **E** | register `PD-0-16` | ✅ replaced, 8 cells |
| **F′** | register POLISH.3 table body | ✅ **`PD-3-04`** appended, **9 cells**, directly below `RR-3` with **no blank line above** (§4.1 rule 3) |
| **G** | POLISH-0 §0 R13 row | ✅ replaced, 4 cells |
| **H** | POLISH-0 §0 tally paragraph | ✅ replaced with counted figures **11 / 8 / zero**, §3.3 clarifier appended |
| **I** | POLISH-0 §2 existence rider | ✅ appended; existing text left intact |
| **J** | POLISH-0 §3 POLISH.3 Tier 1 | ✅ replaced, 2 cells |
| **K** | POLISH-0 §3 POLISH.3 Tier 2 | ✅ replaced, `five` → `six documents` |
| **L** | POLISH-0 §3 POLISH.3 Tier 3 | ✅ replaced |
| **M** | POLISH-0 §10 patch table, after `P-19` | ✅ **P-20 … P-23** appended, 3 cells each |
| **N** | tracker §2 R13 · §4 SPEC.CHART · §1 clause | ✅ all three; §1 row still 6 cells, only the clause changed |
| **O′** | parked SPEC.CHART heading + closure block before the section `---` | ✅ applied |
| **P′** | parked, after that `---`, before `## ADR-0006-DISCIPLINE` | ✅ `CHART-NODE-RING` inserted |
| **Q′** | parked A11Y.0 backlog table | ✅ `OVERLAY.FOCUS` appended **as a 2-cell table row inside the body** |
| **R′** | parked EOF | ✅ `UI19-LOG-SELF-DESCRIPTION` appended at the **new** EOF |
| **S** | tracker §2 duplicate tally sentence | ✅ replaced — counts **removed rather than synced** |
| **T** | POLISH-0 §4.1, after rule 3 | ✅ **rule 4** appended |

### Verbatim integrity — the strongest check available

**All 25 fenced blocks in the pack were matched byte-exact against the committed files**, line by line, after substituting only the two delegated values (`PD-3-NN` → `PD-3-04`; `<n>` → `11` / `8`). **Zero blocks were reformatted, rewrapped or normalised.**

Lefthook's `pre-commit` reported **`biome-check-staged (skip) no files for inspection`** — confirming empirically what §6 states: its glob is `*.{js,jsx,ts,tsx,json,jsonc,css}` and markdown never reaches the formatter. `just verify` was correctly not run.

### Structural integrity after the write

- All five files scanned: **every table row's cell count equals its header's.** The one initial flag — `POLISH-0.md` R15 — was a false positive from nine escaped `\|` pipes inside a row this task never touched (0 occurrences in the diff); parsed correctly it is 4 cells against a 4-column header.
- **No stacked `---`** anywhere in `parked.md` — O′/P′/R′ separators verified, including no `--- / blank / ---` runs.
- The three sections `dfa3012` contributed (`MOD-REPORT-PATH`, `R2-412-DEPLOY-GATE`, `DMARC-ALIGNMENT`) are **intact** — nothing from the newer commit was clobbered.
- A11Y.0 backlog: 4 rows → **5**, all 2-cell, `OVERLAY.FOCUS` confirmed inside the A11Y.0 section's own table.

---

## 5 · The v1 halt, recorded as history

**A future reader should not have to reconstruct why §4.1 has a rule 4.**

v1 of this pack was applied on 2026-08-12 and **halted at zero writes**. Its twelve-item pre-flight passed 12 / 12 — every factual claim it made about the repository was true. **Two blocks were structurally wrong:**

1. **Block F** carried an **8-cell** row aimed at the **9-column** POLISH.3 table. It had silently inherited the 8-column PD-0 shape from Block E, its sibling in the same pack. Its fifth cell was `.3`, a *Surfaces* value, landing in an *Evidence* column; it had no *Root cause* cell at all.
2. **Block Q** was a markdown **bullet** aimed at a **two-column table**. Applied, it would have terminated that table and orphaned the row — the fourth such invisible row, which §4.1 rule 3 exists to prevent.

A third defect was found that v1 contained no block for: **`POLISH-TRACKER.md` §2 carried a second copy of §0's tally**, also drifted. Applying v1 as written would have left §0 recounted correct while the tracker's copy became *more* wrong. **Block S** now removes it rather than syncing it — a count restated in a second document is a second thing that can drift.

**The halt was total rather than partial by deliberate choice**, and that reasoning is now the standing rule (v2 §1): blocks C, E, G, N and O each assert R13's state in a different document, so a subset applied leaves the corpus contradicting itself about the very thing the pack exists to settle. **Prefer zero writes to a partial application.**

**The remedy is Block T.** Block E stated the column set it assumed and matched head instantly; Block F stated none. **Naming the assumption is what made E pass and what made F's defect detectable before it shipped.** Every table-writing block in v2 names its column set, and §4.1 rule 4 now binds every future row anywhere in the corpus.

---

## 6 · Counted claims, re-verified at PR head

Taken **after** `c0a69e4`, not mid-run:

| Claim as written | Re-verified | |
|---|---|---|
| §0 tally says `11 SCHEDULED · 8 RULED · zero OPEN` | table holds 11 / 8 / 0 | ✅ TRUE |
| index is nineteen rulings | 19 rows parsed | ✅ |
| `PD-3-04` is the next free ID | sequence is 01, 02, 03, 04; `PD-3-04` appears once | ✅ |
| "eight `debate-view::price-chart-*` §17 rows" | 8 rows on disk in SPEC.1 §17 | ✅ |
| "`chart` appeared zero times in canon" (stated in `C-CHART-1` as a pre-run measurement) | was 0 at `dfa3012` before the write; the clause is explicitly dated *"verified 2026-08-12"* | ✅ |
| `C-CHART-1` defined once | 1 heading in canon §10 | ✅ |
| §4.1 now carries rules 1–4 | rule 4 present | ✅ |

---

## 7 · Surprises, stated plainly

1. ⚠ **The ground moved between the pack being authored and being applied.** `origin/main` advanced `198d1d0` → `dfa3012` (#322, MOD-REPORT-PATH) and **that commit touched two of the five target documents**. The gate caught it. Had PF-0 not existed, `parked.md`'s two new EOF sections would have collided with Block R′ and the PR would have carried a stale head. **PF-0 earned its place on its first real firing.**

2. **`C-CHART-1` cites `198d1d0` as the state it ratifies, and it is applied at `dfa3012`.** This is correct and left as written: the pack's text says *"Ratifies built state at `198d1d0`"*, and `dfa3012` changed **no** file under `src/` — the built chart components are byte-identical at both SHAs. The ratification statement remains true. **Flagged for Gate C so the SHA is not read as an error.**

3. **The canon now mentions `R10`, `R14` and `R1–R19`** where it previously had no R-number above R9. These are **citations of POLISH's index inside Block B's own numbering-rule text**, not new canon rulings — the bare canon sequence is still closed at R9, exactly as that block states. A future automated "highest R-number" check on this file will read them as noise; the numbering rule is the authority, not the grep.

4. **The A11Y.0 backlog table was the second `| Item |` table in `parked.md`.** There is another with the same header and three columns elsewhere in the file. Block Q′'s row was anchored on the unique `POLISH-1a's title-reach finding` row rather than on the header, and containment inside the A11Y.0 section was verified explicitly afterwards. **Worth knowing at POLISH.5**, which will touch this table again.

5. **Lefthook confirmed the §6 reasoning empirically**, rather than by inference: `biome-check-staged (skip) no files for inspection`. The markdown reformat hazard has no path to this file set, as claimed.

---

## 8 · What this changes for POLISH.3

- **R13 is RULED. Nothing in the ruling index is OPEN.** The chart expanded-overlay is inspectable against SPEC.1 §9 F-DEBATE-5 (behaviour) and canon §10 `C-CHART-1` (presentation).
- **`PD-3-04` is inherited, not to be rediscovered** — the overlay's missing accessible summary is a **tier-1 conformance gap**, and it exists *because* tier 1 exists.
- **`PD-0-16` is closed**, reclassed S → R.
- **`OVERLAY.FOCUS` is A11Y.0's**, cross-surface on both graph overlays — neither `.3` nor `.5` owns it.
- **`CHART-NODE-RING` is founder-election only** and carries a live ADR-0034 D-1 exposure; `.3` does not pull it forward.
- ⚠ **`ProfileGraphOverlay` should be checked at POLISH.5 rather than assumed clean** — it shares the market overlay's root cause on both the summary and the focus gaps.

---

*Applied by Claude Code, 2026-08-12, from `SPECCHART-apply-pack-v2.md`, verbatim. Ground `dfa3012` (pack authored against `198d1d0`; PF-0 caught the move). Twenty blocks, 25 verbatim fragments, all byte-exact. PR opened, not merged.* ⚠ **The "all byte-exact" claim in this line is refined in §9 below — see the separator correction.**

---

## 9 · Gate C amendment (post-merge)

⚠ **`#324` merged at 2026-08-12T07:10:41Z as `0c1b781`, before Gate C's amendments had landed.** Gate C produced two corrections to text this log records as applied; they are applied here, post-merge, on `docs/spec-chart-amendment` off `origin/main` @ `0c1b781`. Both are web-authored and were applied verbatim. Two files, one line each.

### Amendment 1 · `POLISH-0.md` §2 — the existence rider's worked example

**What was wrong.** As merged, §2's worked example still described the class-S conclusion as *"the correct finding"* — **three lines above the addendum explaining that it was wrong.** The paragraph and its own second half contradicted each other, in the section POLISH.3 reads at kickoff. The rider's *narrow* claim (a citation is not an artifact) was always sound; what had to go was the *broad* conclusion the example carried with it.

**Why it happened, recorded so it is not mistaken for an application error.** This is a **web authoring defect, not an application one.** Block I's instruction was explicit — *"Append immediately after it. **Do not delete the existing text** — the rider is correct and its worked example still holds."* The run followed that instruction exactly and was right to. The defect is that the premise in the instruction — *"its worked example still holds"* — was false, and only became visible once the addendum sat beneath it.

**Applied:** the whole paragraph replaced. The example now states plainly that POLISH.0's class-S conclusion **was itself wrong** and that R13 corrected it, tells the reader not to take the example as establishing that conclusion, and keeps the narrow claim that does hold.

### Amendment 2 · `design-canon.md` §10 — `C-CHART-1`'s opening sentence

**What was wrong.** The clause read *"Ratifies built state at `198d1d0`"* while the ruling was committed at `dfa3012`. §7 item 2 of this log had already flagged the mismatch as correct-but-confusing and asked Gate C to read it as deliberate. Gate C ruled it should say so in the artifact rather than only in the log.

**Applied:** the opening sentence now records that the built state was **measured at `198d1d0` and unchanged at `dfa3012`**, naming the reason — `#322` touched no file under `src/`, so the chart components are byte-identical at both.

⚠ **Scope held deliberately: only `C-CHART-1` was amended.** `PD-0-16` and `POLISH-0.md` §0's R13 row also cite `198d1d0`; in both it dates the **recon measurement** and is true exactly as written. Both were left untouched, and verified untouched after the edit.

### Correction to this log's own verbatim claim

§4 of this log states that **all 25 fenced blocks matched byte-exact**. That is true **of block content** and needs one qualifier, which is recorded here rather than left to be rediscovered:

> **Corrected: byte-exact in content; one separator placement adjusted.**

**The one adjustment — Block C.** The pack's `C-CHART-1` block carries **no trailing `---`**. Applied literally it would have consumed canon §10's pre-existing rule as its own leading separator and left **`## §11` with no section boundary**. One trailing `---` was therefore added after the block. Measured: canon's rule at that point moved from *before* `## §11` to *before* `### C-CHART-1`, and a new one now sits between `C-CHART-1` and `## §11`. **Necessary and correct** — without it two sections would have merged.

⚠ **A second adjustment was reported to this task and is NOT borne out by measurement. Recorded so it is not carried forward as fact.** The claim was that Block O′'s leading `---` had been dropped. It was not. Counting rules in the `SPEC.CHART` → `ADR-0006-DISCIPLINE` span: **1 before the ruling, 3 after** — which reconciles exactly to a literal application, with no rule added or lost:

| Rule | Origin |
|---|---|
| before the closure block | **O′'s own leading `---`** — present, not dropped |
| between the closure block and `CHART-NODE-RING` | the **pre-existing section divider**, which O′ was instructed to be inserted *before* |
| between `CHART-NODE-RING` and `## ADR-0006-DISCIPLINE` | **P′'s own trailing `---`** |

Pack composition confirms it: O′ carries a leading rule and no trailing one; P′ carries a trailing rule and no leading one. **`parked.md` required zero separator adjustment.** The corrected count is **one**, in Block C, not two.

*Amended by Claude Code, 2026-08-12, post-merge. Ground `0c1b781`. Two verbatim edits, two files, one line each. No `src/`, no ADR, no SPEC, no tracker, no register. PR opened, not merged.*
