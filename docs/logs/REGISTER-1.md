# REGISTER-1 · session log

**Task:** REGISTER-1 + REGISTER-1.A + REGISTER-1.B + REGISTER-1.C + REGISTER-1.D — five registers repaired in one PR.
**Briefs (all web Claude, 2026-08-31):** `ZUGZWANG_REGISTER-1_authoring-brief_v1_0.md`;
`ZUGZWANG_REGISTER-1A_amendment-brief_v1_0.md`, which rules on the first run's
findings; `ZUGZWANG_REGISTER-1B_final-pass_v1_0.md`, which rules on the second's
and closes the POLISH-0 §0 collision; `REGISTER-1.C`, which censuses POLISH-0's
remaining version statements, retires the header's, and stops on the footer's format;
and `REGISTER-1.D`, which repairs that footer and the last stale pointer.
**Run reports:** `zz_REGISTER-1_run_2026-08-31T1328.md` (541 lines, md5
`b7215c06fbc87950197d8ef5086d1e66`) · `zz_REGISTER-1A_run_2026-08-31T1402.md`
(385 lines, md5 `7f8e7c3863cb3dad85a7ad3f85cbee03`) ·
`zz_REGISTER-1B_run_2026-08-31T1424.md` (291 lines, md5 `908e41b8e05a4fb0b5ac150548739ba9`) ·
`zz_REGISTER-1C_run_2026-08-31T1444.md` (451 lines, md5 `f0bf8f86c82053dac586a5ff5a1fe6cd`) ·
`zz_REGISTER-1D_run_2026-08-31T1545.md`.
**Baseline:** `origin/main` = `940cdcb`, measured at the start of all five passes.
**Branch:** `chore/register-1` · **PR:** #446, against `main`.

---

## 1 · What landed

One PR, five commits, nine repairs. Every one is the same defect seen in a
different register.

| # | File(s) | Repair |
|---|---|---|
| 1 | `docs/specs/SPEC.1.md` | CHART rows `1.0.40`→`1.0.45`, `1.0.41`→`1.0.46`; §0 → `1.0.47` / `2026-08-31`; a `1.0.47` changelog row appended |
| 2 | 14 files in `src/` + `tests/` | 18 `SPEC.1 1.0.40` citations → `1.0.45` |
| 3 | `docs/specs/SPEC.1.md` §9 ×2, `docs/specs/flows/F-DEBATE-4.md` ×1 | 3 further CHART-1 citations → `1.0.45` (REGISTER-1.A) |
| 4 | `docs/polish/POLISH-0_data-manifest.md` §5 | V-space reconciled: `V-12` + `V-15`…`V-18` restored from RPLY-CLOSE, WARLI-CLOSE-2's three → `V-19`…`V-21`, redirect note, pointer sentence replaced |
| 5 | `CLAUDE.md` §8 | `O-15` minted; sharpened at REGISTER-1.B with the union-vs-discard clause |
| 6 | `docs/specs/SPEC.2.md` line 3 | the self-contradicting `1.0.24` removed — the line now carries no version at all |
| 7 | `docs/polish/POLISH-0_data-manifest.md` §0 | RPLY-CLOSE's dropped `v1.10` block (J1–J5) **restored byte-for-byte** from `26dc484`; WARLI-CLOSE-2's block renumbered `v1.10`→`v1.11`; `v1.12` minted *(REGISTER-1.B)* |
| 8 | `docs/polish/POLISH-0_data-manifest.md` header | the `Status:` line stops carrying a version and a supersession claim — the same repair `SPEC.2` line 3 got at REGISTER-1 *(REGISTER-1.C)* |
| 9 | `docs/polish/POLISH-0_data-manifest.md` footer + header tail | RPLY-CLOSE's `v1.10` footer clause **restored byte-for-byte**, WARLI-CLOSE-2 renumbered `v1.11`, `v1.12` appended at the version log's true end; the `I1 of the v1.10 block` pointer corrected to `v1.11` *(REGISTER-1.D)* |

### Why

`1.0.40` and `1.0.41` each named **two different amendments**. ONBOARD-CARD and
ONBOARD-CARD-FIX allocated them on `staging` on 2026-08-25; CHART-1 and CHART-1.A
allocated the same two on `main` on 2026-08-27, against a `main` whose ceiling was
`1.0.39`. **Neither lane was careless.** Both read the high-water pointer
correctly at their own head, where the other lane was invisible, and the
RECONCILE-1 merge preserved both rows without reporting a conflict — because a
union is the right merge for two appended table rows.

Earlier allocation keeps the number. Of the two possible directions, only this one
leaves the axis monotonic by date: two rows dated 2026-08-27 were carrying numbers
below `1.0.44` dated 2026-08-26.

V-space is the same shape one register over. RPLY-CLOSE minted `V-16`…`V-18` on
`staging` and deliberately **reserved `V-15`** for a pending row; WARLI-CLOSE-2
minted `V-15`…`V-17` on `main` four days later. Both sets survive — RPLY-CLOSE's
at the numbers it allocated first, WARLI-CLOSE-2's at `V-19`…`V-21` — and a
redirect note carries the mapping so closed records citing the old numbers stay as
written. `V-15` stays empty: sliding numbers down into the gap would consume the
number its pending row is queued on.

`O-15` is the generalisation, and it is the durable output of this task:

> Every monotonic identifier space in this repository that has ever collided —
> `V-n`, SPEC.1's version, `GC-n`, `L-n` — is allocated by appending a row to a
> prose document. Every space that never has — `ADR-NNNN`,
> `drizzle/migrations/NNNN_`, `I-<AREA>-NNN`, `F-<AREA>-n` — is allocated by
> **creating a file**. The mechanism belongs to git, not to the register.

---

## 2 · Decisions made

### 2.1 · The in-body self-reference judgements (authoring brief §1.1)

The two CHART rows carry version strings inside their prose, and each needed a
class before it could be touched. Measured by per-line occurrence count, not read
by eye.

**CHART-1 row — 2 × `1.0.40`:** the version cell, and one self-reference
(`*(Scoped at CHART-1.A: 1.0.40 stated this without qualification…)*` — CHART-1.A's
in-place correction written *into* the CHART-1 row, naming what CHART-1 itself
said). Both → `1.0.45`. Two further version strings on that line are `1.0.22` and
were left.

**CHART-1.A row — 5 × `1.0.40` + 1 × `1.0.41`:** the `1.0.41` is the version cell
(→ `1.0.46`); all five `1.0.40` are predecessor references to CHART-1 (→ `1.0.45`).

⚠ **Two of those five read "the 1.0.40 §20 row", which looks like a citation into
a separate §20 table that would also need renumbering.** It is not. `## §20 Change
Log` spans lines 1576–1652, so *"the 1.0.40 §20 row"* **is the CHART-1 changelog
row itself**, named by the section it lives in. Checked before editing, because
acting on the surface reading would have sent a session hunting a table that does
not exist.

**Zero ONBOARD-class occurrences on either row.**

### 2.2 · SPEC.1's five `1.0.41` citations outside the changelog — left

Lines 803, 823, 898, 1644, 1647. All ONBOARD-class §13 ToS-hash material.
`1.0.41` still means ONBOARD-CARD-FIX, so all five are correct as they stand.
Recorded because the authoring brief said *"there are no `1.0.41` citations"* —
true of `src/` and `tests/` (measured: zero), not of SPEC.1 itself.

### 2.3 · §0 set to `1.0.47`, not the brief's literal `1.0.46`

The authoring brief's §1.2 named `1.0.46` / `2026-08-27` as the §0 target; its §1.3
then appended a `1.0.47` row dated `2026-08-31` whose own sections cell declares
`§0`. Following §1.2 literally would have left §0 falsified by its own commit —
the exact §0-vs-changelog defect repair 6 fixes in SPEC.2, reproduced inside the
document repairing it. **Ruled at REGISTER-1.A: CC's call stands.**

### 2.4 · The three prescriptive-document citations — refused, then ruled in

The first pass found three live CHART-1 citations outside the brief's 18
(`SPEC.1:474`, `SPEC.1:533`, `F-DEBATE-4.md:79`) and **did not edit them**, because
the authoring brief's wall read *never change spec content* and the verbatim
`1.0.47` row declared its scope as `§0; changelog` — editing §9 would have made the
row false about itself (`O-9`).

**REGISTER-1.A ruled the refusal correct and the wall too broad:** a version
citation inside a parenthetical is a pointer, not spec content. All three are now
`1.0.45`, the row's sections cell reads `§0; §9; changelog`, and the row carries an
authored paragraph recording why the first pass could not have caught them.

The lesson is in that paragraph and is worth repeating here: **a census scoped to
where you expect the answer is not a census.** The first pass's verification
searched `src/` and `tests/` — which is where the eighteen live, and is not where
these three do.

### 2.5 · The high-water pointer — 297 characters preserved

REGISTER-1.A supplies a replacement for the pointer sentence and says to replace it
*in full*. **The line in the tree is 550 characters; the span the replacement
covers is the first 253.** The remaining 297 are pre-existing register prose — the
`V-7` rationale for why the PROPOSED row stays unnumbered, ending *"The founder
mints it or it stays unnumbered."* — which the first run report's F-4 quote had
truncated, and which the amendment brief therefore appears not to have seen.

Replacing the whole line would have **deleted** that reasoning. The authored text
was spliced at the boundary and the tail preserved verbatim; the new `⛔` sentence
ends where the old one did, and *"V-7's own text is why —"* reads on from it
without a seam. Nothing was authored and nothing was destroyed.

### 2.6 · The Load-bearing block sits mid-list, deliberately

`⚠ Load-bearing for Slice B` appears twice in the source material — once after
staging's `V-18`, once after main's `V-17`. Identical text, a merge artifact. Kept
once, attached to `V-18` as instructed, which places it between `V-18` and `V-19`.
**Ruled correct as placed at REGISTER-1.A** — it belongs to V-18 by content, and
moving it would be authoring.

---

### 2.7 · REGISTER-1.B — the restore, the renumber, and what was left alone

**F-A1 ruled: the splice stands.** REGISTER-1.A's §1 said to replace the pointer
sentence *in full* against a quotation that was itself truncated, so its own wall
could not fire. Preserving the 297-character `V-7` tail was ruled correct and the
reading is now standing: **you do not author register prose, and you do not
silently unwrite it.** No edit at REGISTER-1.B.

**F-A2 ruled: restore, renumber, earlier allocation keeps.** RPLY-CLOSE's `v1.10`
block (rows J1–J5) is restored **byte-for-byte** from `26dc484` — proved by
extracting both spans and diffing them to empty, md5 `ed613dce…` on each side.
WARLI-CLOSE-2's block, allocated four days later, moves to `v1.11`; **its heading
alone changed and row I1 is byte-identical**, because an amendment record is
append-only — you append the correction rather than rewriting the entry. `v1.12`
records the whole repair.

**`v1.11` and `v1.12` were proved free in HISTORY, not merely on disk** — zero on
`940cdcb`, zero on `26dc484`, and zero commits touching either string in that
file's entire history across all refs. That check exists because F-A2's lesson is
precisely that a disk census cannot see a discarded allocation.

**`O-15` gained the sharper half:** a clean union is the *benign* outcome. The same
merge gave §5 a union and §0 a discard, and the surface whose structure looked more
robust is the one that lost data. ⇒ after a merge that touched a prose register,
census what is **MISSING** against both parents, not only what is duplicated.

### 2.8 · Two sites REGISTER-1.B does not reach, and why a partial fix is worse

POLISH-0 carries its version in **three** places. The brief renumbers one.

- **The document header, line 4** — `> **Status:** **v1.10** — 2026-08-30 IST.
  Supersedes v1.9 (2026-08-19).` Now two behind §0's `v1.12`, and its *"Supersedes
  v1.9"* clause is wrong as well.
- **The footer version log** — carries `v1.10 2026-08-30 from WARLI-CLOSE-2` and has
  **no `v1.10` RPLY-CLOSE clause at all**, having lost it in the same merge.

Both were left. The brief says *"change the WARLI-CLOSE-2 heading **only**"*, and
more importantly **a partial fix here is worse than a flagged gap**: bumping the
header's number leaves *"Supersedes v1.9"* false, and restoring the footer's
RPLY-CLOSE clause is impossible cleanly — **`26dc484`'s own footer is mangled**,
that clause having been spliced into the middle of `v1.6`'s parenthetical
(`POLISH.7a ( · **v1.10 … row)**.**V-7 and V-8 minted**;`). There is no clean text
to copy. A repair that *looks* done is the failure mode this whole task documents.

### 2.9 · REGISTER-1.C — the census the earlier passes never ran, and one STOP

**The census came first this time, and that is the whole point of the pass.**
POLISH-0 states its own version, lineage or high-water in **five** places, not the
two REGISTER-1.B found by reading:

| site | states | after this pass |
|---|---|---|
| header, line 4 | own version + *"Supersedes v1.9"* | ✅ **retired** — carries neither |
| §0's eleven `### vN.N` headings | the lineage itself | ✅ ceiling `v1.12` |
| §5 *"canonical home of V-1…V-21"* | V-space extent | ✅ |
| §5's high-water pointer, `V-21` | V-space high-water | ✅ |
| footer version log, line 291 | the whole lineage again | ⛔ **still stale — see §3.3** |

⚠ **The brief's own second search pattern could not find one of them.** It greps
`high-water`, and the pointer line reads `**High-water read off this register at
head:`. Case-sensitive, so it missed the site the pattern was named for. Found by
re-running with `-i`, and recorded because a census that misses a site is the
defect this task exists to repair, one layer up.

**The header's tail was preserved byte-for-byte** — 322 characters before and
after, asserted, not assumed.

### 2.10 · REGISTER-1.C STOPPED on the footer, by its own gate

§3 said: print the footer, and if its format differs from `vN.N YYYY-MM-DD from
LANE (**…**)` separated by ` · `, **STOP and report — do not adapt.** It differs,
in two ways that would each have produced a wrong edit:

1. **A lane name contains the separator.** `v1.8 2026-08-17 from HTML-FINISH ·
   MARKET DETAIL Gate C (…)` — splitting on ` · ` cuts that clause in half, so
   ` · ` does not delimit clauses.
2. **The line does not end at the last version clause.** After WARLI-CLOSE-2's
   clause comes a *"Constants named in caps…"* sentence and the closing `*`. §3c
   says *"append at the end of the line"*; the end of the line is not the end of
   the version log, so appending there would file `v1.12` after prose that has
   nothing to do with versions.

Three of eleven clauses also carry no parenthetical at all, so the stated shape is
not the format even where the separator holds.

**§2 was applied and §3 was not** — they are independent, and stopping the one
that is genuinely ambiguous costs a round, while adapting it would have written a
malformed register line that reads as finished.

### 2.11 · REGISTER-1.D — the footer, repaired against its own hazards

REGISTER-1.C stopped here because the footer's format broke the shape it had been
described with. **1.D repaired it by anchoring on unique strings instead of a
separator**, which is what the format demanded:

- **Renumber first.** `v1.10 2026-08-30 from WARLI-CLOSE-2` → `v1.11`, *before*
  restoring RPLY-CLOSE's clause. That ordering is the whole trick: it leaves **zero
  `v1.10` in the footer**, so step 2's insert has an unambiguous target. Asserted,
  not assumed.
- **Restore, don't retype.** RPLY-CLOSE's 148-char clause extracted from `26dc484`
  by walking its parenthetical to the matching `)`. The `**…**` wrapper around it
  there was **excluded** — main's footer bolds only inner summaries, never a whole
  clause, so the bolding belongs to the mangled insertion, not the clause. Guarded:
  the script halts if the extract contains `V-7 and V-8` or `POLISH.7a`, which is
  what bleeding into the `v1.6` span would look like. **Diffs empty, md5
  `2ec9bd21…` on both sides.**
- **Append at the version log's TRUE end**, between `backfilled)` and
  `. Constants`, not at the end of the line — the line runs on past the version log
  into a sentence about naming constants, and appending there would have filed
  `v1.12` after prose unrelated to versions. Asserted afterwards that the Constants
  sentence still closes the line inside its italic.

**And one pointer.** `see H2, and I1 of the v1.10 block` → `v1.11`. I1 moved at
REGISTER-1.B; the wall that preserved the stale token at 1.C was lifted for this
one token, on the ruling that a pointer correction is the same class as the 21
citations. The rest of that 322-character tail is byte-identical — asserted by
reconstructing it with the single token swapped and comparing for equality.

**Result: the census now finds zero inconsistent sites.** All five classes — header,
§0's eleven headings, §5's canonical home, §5's high-water pointer, and the footer —
agree, and §0's ceiling equals the footer's at `v1.12`.

## 3 · Open questions

### 3.1 · ✅ CLOSED AT REGISTER-1.B — the third collision, in POLISH-0's own amendment record

**Reported at REGISTER-1.A, ruled and repaired at REGISTER-1.B.** Kept here in full
because the diagnosis is the reusable part; the disposition is at §2.7.

`docs/polish/POLISH-0_data-manifest.md` §0 is a versioned amendment record. **Both
lanes labelled their entry `v1.10`:**

| lane | entry | content |
|---|---|---|
| `26dc484` (staging) | `### v1.10 — 2026-08-26 · from RPLY-CLOSE` | rows **J1–J5** — mints `V-16`/`V-17`/`V-18`, patches `V-12`, records `V-15`'s deliberate reservation |
| `940cdcb` (main) | `### v1.10 — 2026-08-30 · from WARLI-CLOSE-2` | rows **I1–I2** — mints `V-15`/`V-16`/`V-17`, restates the missing `v1.8` block |

⚠ **And the merge did not preserve both. It kept main's and dropped staging's.**
The merged file carries nine `###` entries and exactly one `v1.10` — WARLI-CLOSE-2's.
**RPLY-CLOSE's amendment-record block is absent from `main` entirely.**

This is why nothing was appended. Three consequences, all for the founder to rule:

1. **`v1.10` is double-allocated in history but not on disk**, so a duplicate census
   finds nothing. The amendment brief's §3.2 trigger was written for a duplicate;
   the collision manifested as a **loss** instead, because §0's blocks are separated
   by `###` headings while §5's entries are list items, and the merge resolved the
   two structures differently. **Same collision, different surface, worse outcome.**
2. **REGISTER-1 has just restored RPLY-CLOSE's `V-12` patch and `V-15`…`V-18`
   without their provenance.** Rows J1–J5 are the record of who ruled them and how;
   that record is still only on `26dc484`.
3. **WARLI-CLOSE-2's I1 row is now stale**: it reads *"V-15, V-16 and V-17 added"*
   for rules that are now `V-19`/`V-20`/`V-21`. It is covered by the §5 redirect
   note, which speaks to any document dated before 2026-08-31 — but it is covered
   *by* a note rather than correct in itself.

Appending a `v1.11` would have asserted that the ceiling is `v1.10` and the record
complete. Both are false. **`O-15` says the pointer is a citation, not a lock; this
record is the third proof and the first where a merge silently discarded a side.**

### 3.2 · Three items the amendment brief does not close

- **`docs/plans/CHART-1.md:55,168`** carry `SPEC.1 → 1.0.40` as statements of what
  CHART-1 did at the time. Classified **correct as history** and left. If plans are
  ever ruled living documents rather than closed records, they change.
- **`1.0.22` names a SPEC.1 version *and* a SPEC.2 version.** Not a collision —
  two documents, two registers — but a repo-wide grep for a bare version string
  cannot tell them apart, and `src/app/(public)/m/[slug]/page.tsx:16` cites
  `SPEC.2 1.0.22` two lines from code citing `SPEC.1 1.0.45`.
- **The `1.0.47` row says *"a blockquote rider under row 1633"***. The rider sits
  at lines 1638–1642, under row 1636; it *relates to* rows 1632/1633 by content.
  Verbatim authored text, placed as written. Its load-bearing claim — that the
  rider breaks the markdown table so the CHART rows render as a visually separate
  second table — **is true and was verified**.

---

## 4 · Verification

Both passes ran the authoring brief's six checks. Every negative carries a control.

| # | check | result |
|---|---|---|
| 1 | `SPEC.1 1.0.40` in `src/`+`tests/` | **0**; 0 bare stragglers; 18 × `SPEC.1 1.0.45` relanded |
| 1c | control — `SPEC.1 1.0.22` | **10**, exactly the brief's figure |
| 2 | SPEC.1 version duplicates | `1.0.0-draft` ×2 only (pre-lock, benign) |
| 3 | post-lock axis monotonic by date | **0 violating pairs** |
| 4 | V-space census `V-1`…`V-21` | one entry each; `V-15` reserved and empty |
| 5a | `V-12`, `V-15`…`V-18` vs `26dc484` | **byte-identical, 0-byte diff** |
| 5b | `V-19`…`V-21` vs `940cdcb`'s `V-15`…`V-17` | differ in **the label only** |
| 6 | full suite | 434 files / 4129 tests, **zero delta** vs `940cdcb` |
| A1 | repo-wide `1.0.40` census, all 13 sites classified | **zero STALE** |
| A2 | `1.0.47` sections cell vs what §9 actually got | cell `§0; §9; changelog`, §9 edited at 474 and 533 |

### The control that looked like a failure, and was not

The positive control for check 1 read **12**, against the brief's stated 10. Two of
those hits were not the control's subject: `SPEC.2 1.0.22` in
`src/app/(public)/m/[slug]/page.tsx:16` — a different specification — and an
unprefixed continuation line in `limits.ts:207`. *"The same search"* means the
`SPEC.1 `-prefixed one, matching the shape of the primary search it controls, and
that returns **10 as lines and 10 as occurrences**. Recorded rather than quietly
reconciled: a control that reads `12 ≠ 10` and is waved through is how a
verification pass certifies itself.

### The gate whose exit code could not answer

`just verify` was run piped to `tail`, so its exit status was the pipeline's tail
and proved nothing (`O-13`). The receipt used instead is the recipe's own terminal
`@echo "All checks passed."` — `just` aborts a recipe when a dependency recipe
fails, so that line appearing at all is proof `typecheck`, `check` and `build` each
exited 0. A `pnpm`/`vitest`/`tsc` gate has no such marker and must be re-run unpiped.

### How the baseline was taken

Not inherited (`V-9`). The branch's changes were **stashed**, the same suite run at
`940cdcb` in the same worktree against the same `node_modules`, then popped and the
four documents' md5s re-checked against what the apply scripts had written.
Baseline and after are identical in every cell: 433 passed / 1 skipped / 434 files,
4124 passed / 1 skipped / 4 todo / 4129 tests.

### Byte-provenance

V-space was assembled as a **copy job**, never retyped: each entry spliced out of
one of the two source blobs. The scripts asserted the brief's identity claims
before relying on them — `V-1`…`V-11`, `V-13`, `V-14` byte-identical on both sides;
staging's `V-12` a strict superset of main's, 632 → 1287 chars. The relabelling of
`V-19`…`V-21` was proved by **reconstructing the expected string and asserting
equality**, not by reading a diff; all three lengths are unchanged, which is itself
a check a two-digit relabel cannot fail without a second edit.

---

## 5 · Next session starts at

**Nothing in REGISTER-1 is open.** Five passes, five registers, and POLISH-0's
self-statement census now reports zero inconsistencies. PR #446 is complete and
awaiting review, unmerged.

## 6 · Context to preserve

- **`O-15` is the durable output.** Mint identifier spaces by filename. For the four
  prose spaces that already exist, a lane minting while another is open must re-read
  its number against the merged head before its PR lands and say so in the PR body.
  PR #446's body does this.
- **Three registers have now collided the same way**: SPEC.1's version, V-space,
  and POLISH-0's amendment record. The third is unresolved.
- **`V-15` is reserved, not free.** The POLISH.5 PR A / A6 row is queued on it.
- The scripts for both passes are content-anchored and halt on a census mismatch;
  they are the right shape to reuse if a fourth register turns up.

## 7 · Time

2026-08-31, one session, **five passes** — REGISTER-1, 1.A, 1.B, 1.C and 1.D, all on
the same branch before merge. Deliberately: a `1.0.48` row correcting a `1.0.47` row
would be the CHART-1 / CHART-1.A shape this task exists to stop reproducing, and the
same argument applies one register over to a `v1.13` correcting a `v1.12`.
