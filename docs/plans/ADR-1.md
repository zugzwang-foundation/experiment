# ADR-1 · EXECUTION PLAN

**Authored:** web Claude (orchestrator), 2026-09-08
**Ratified:** Hrishikesh — *"go with best recoms — post liq closeout, that chat will create the 0047."*
**Baseline:** `origin/main` = `941e98880d822912ec63700e861d9c0543144cb0`, measured by the ADR-1
recon (`zz_ADR-1_recon_2026-09-07T1534_part1.md` md5 `b4a9f82765f6e77bebbe154a257a2262`,
`_part2.md` md5 `b3a87bfb324b8b17ec05581aeaee3c43`).
**Shape:** one plan · one PR · one branch.

---

## 0 · WHAT THIS PASS DOES AND DOES NOT DO

**Does:**
- Mints **D-33**, which records the citation drift once and states the repair rule for ADRs.
- Repairs `Status` / link rows where a supersession or amendment **has landed** and the file
  does not say so.
- Adds a **top-of-file callout** to the two ADRs whose bodies assert reversed behaviour in the
  present tense, so a reader — human or `claude-code` — is told before reaching the body.
- Discharges two existing rulings (D-21/D-26, D-28 r4) that never reached `ADR-0011`.

**Does not:**
- Repair any of the **275 dangling §-citations.** They are recorded in D-33 R1 and left as written.
- Rewrite **any** narrative prose in **any** ADR. Context / Decision / Consequences bodies are
  preserved byte-identical everywhere except the five modified lines enumerated at §5.
- Touch `src/`, `tests/`, `drizzle/`, `SPEC.1`, `SPEC.2`, `CLAUDE.md`, `AGENTS.md`, the eight
  market specs, or `docs/plans/DEBATE.7.md`.
- Touch **`ADR-0047`.** Ratified out: PR #496 (`liq-1/phase-2`) is open against it and the
  **LIQ closeout chat owns the D-31 repair.** If ADR-0047 appears in this PR's diff, the run
  has failed.
- Touch `ADR-0019`, `ADR-0045`, `ADR-0038`. Open PRs #496 / #487 / #462 touch them and this
  pass has no repair for them.

---

## 1 · THE TWELVE FILES

| # | Path | Edit class | Modified lines |
|--:|---|---|--:|
| 1 | `docs/decisions/RECORD-v2.7-amendment.md` | **NEW FILE** | — |
| 2 | `docs/decisions/README.md` | index row appended | 0 |
| 3 | `docs/adr/0021-reactive-moderation-no-held-queue.md` | callout + patch record + metadata cell | **1** |
| 4 | `docs/adr/0014-pre-commit-moderation-flow.md` | callout | 0 |
| 5 | `docs/adr/0046-moderation-is-advisory.md` | patch record | 0 |
| 6 | `docs/adr/0041-cache-components-and-reserves-keyed-participant-caching.md` | metadata row inserted | 0 |
| 7 | `docs/adr/0025-debate-md-export.md` | patch record | 0 |
| 8 | `docs/adr/0026-market-media.md` | inline marker | **1** |
| 9 | `docs/adr/0028-moderated-image-byte-identity-binding.md` | patch record | 0 |
| 10 | `docs/adr/0013-concurrency-bet-transaction.md` | patch record | 0 |
| 11 | `docs/adr/0006-hosting.md` | patch record | 0 |
| 12 | `docs/adr/0011-pseudonym-pool-design.md` | 3 strikes + patch record | **3** |

**Total modified lines across the PR: 5.** Everything else is insertion. This is the acceptance
test (§5), not a description.

---

## 2 · ANCHORING RULE — READ BEFORE EXECUTING

**No edit in this plan is anchored on a line number.** A line number in a plan ages exactly like
a line number in a fence (`CLAUDE.md` §8, **O-8**) — `ADR-0006`'s own patch record is the
receipt: D-28 r20 cited `ADR-0006:34` and that line had already moved before the ruling shipped.

Every edit below carries:

- an **ANCHOR** — a content string CC locates in the file, and
- a **CROSS-CHECK** — the line number the recon measured at `941e9888`.

**HALT CONDITION.** If the anchor is not found exactly once, or is found more than ±15 lines
from the cross-check, **stop, do not edit that file, and report.** Do not search harder, do not
relax the anchor, do not proceed to the next file. A moved anchor means something merged.

**PREFLIGHT (Relay B step 0), before any edit:**

```
git fetch origin
git rev-parse origin/main
for f in <the 12 paths>; do git show origin/main:$f | md5 -q; done   # record all twelve
```

- If `origin/main` ≠ `941e9888`, **report the new SHA and what moved before editing anything.**
  PR #496 landing is the expected cause; it touches `ADR-0047` and `ADR-0019`, neither of which
  is in this plan's file list, so a #496 merge alone should leave all twelve anchors intact —
  but that is a prediction, and it must be **measured**, not assumed.
- The twelve md5s are the fence. They are re-measured at close against **`origin/main`**, never
  against the previous commit on this branch (earned rule 1 — three run reports certified a
  fence that was already breached because the baseline moved with the breach).

**Fields written as `<MEASURE: ...>` are placeholders. CC measures them from the file at execute
time and substitutes. It never asserts one from this plan, from the recon, or from memory.**

---

## 3 · THE NEW RULING — D-33

### 3.1 File 1 — `docs/decisions/RECORD-v2.7-amendment.md` (NEW)

**Before writing:** re-measure the D-ceiling live.

```
for f in docs/decisions/RECORD-*.md; do grep -hoE '^#{1,6}[[:space:]]+.*\bD-[0-9]+' "$f"; done \
  | grep -oE 'D-[0-9]+' | sort -u -t- -k2 -n | tail -1
```

The recon measured **D-32** at `941e9888`. If the live ceiling is not 32, **halt and report** —
another lane minted a ruling and this amendment's number and file name are both wrong.

**Structure:** mirror `RECORD-v2.6-amendment.md` exactly — same front-matter shape, same heading
levels, same closing form. CC reads v2.6 first and copies its skeleton. Do not invent a format.

**Body:**

---

```markdown
## D-33 · ADR citation drift is recorded once; ADR bodies are not rewritten to chase moved specs

**Ruled:** 2026-09-08 · **Task:** ADR-1 · **Baseline measured at:** `origin/main` 941e9888

### Context

`SPEC.1` 2.0.0 (D-29) and `SPEC.2` 2.0.0 (D-30) removed eleven sections between them on
2026-09-06/07. The ADR-1 recon resolved every `§`-token in `docs/adr/` and `docs/plans/DEBATE.7.md`
against both specs' live heading inventories, by token rather than by prefix, catching the
prefixed, elided, distributed and bare forms.

Measured at `941e9888`: **1,421** conforming §-tokens · **763** resolve · **72** resolve into a
`SPEC.2` section that survives as a pointer only · **147** are bare and ambiguous · **275 do not
resolve at all.** The 275 are smeared across roughly thirty files; the top five hold 40%.

Separately, the recon found **36** present-tense assertions, in live ADRs, that the moderation
gate blocks content and auto-bans authors — a posture ADR-0046 and **D-32** have reversed. Twenty-two
of the thirty-six are in `ADR-0021`, whose `Amended-by` row is scoped to Track B and therefore
records nothing about D-32's reversal of Track A.

An ADR is a record of a decision taken at a time. It is also read by `claude-code` as a binding
contract. Those two properties pull in opposite directions and this ruling separates them.

### Decision

**R1 — Citation drift is RECORDED, not repaired.** The 275 non-resolving §-tokens in `docs/adr/`
and `docs/plans/DEBATE.7.md` are preserved exactly as written. Their targets — `SPEC.1` §16.3,
§16.4, §16.5, §17, §18, §19, §21, §22, §23 and `SPEC.2` §2, §23 — were removed at 2.0.0. A
citation into a removed section is part of the record of when the decision was taken. It is not
repaired, and no future pass re-derives this: the removal is recorded here, once.

**R2 — `Status` and link rows ARE repaired.** A superseded or amended ADR that does not say so is
not history; it is actively misleading. Where a supersession or amendment has landed and the file
records nothing, the metadata row is added or extended.

**R3 — A live ADR asserting reversed behaviour gains a CALLOUT, not a rewrite.** The callout sits
immediately after the metadata table, before the body, because a note at the foot of the file is
not read before the text it corrects. The body is preserved byte-identical.

**R4 — ADRs carry no `§`-numbered headings. Measured: zero, across all 46.** The only numeric
heading form is `### N.` (bare integer), present in nine files. Every `ADR-NNNN §M` token in the
corpus therefore either matches one of those integers or dangles by construction. `ADR-0014 §84`,
`§85`, `§154`, `§190` and `ADR-0021 §78`, `§84` are line-number-shaped and resolve to nothing.
Recorded so no future pass measures it again.

**R5 — Docketed, not done.**
- 41 of 46 ADRs omit the `Amends` / `Amended-by` rows entirely, against a template that says
  *"Leave a row as an em-dash when it does not apply. Do not delete the row."* Cosmetic; no build
  hazard; deferred.
- `ADR-0047`'s D-31 item — the voided plan to strike `SPEC.1` §10.6 inside a code PR, still stated
  at `0047:207` and `:219` — is **owned by the LIQ-1 Phase 2 closeout**, not by ADR-1.
- `docs/plans/DEBATE.7.md:7` names `SPEC.1` and `SPEC.2` at **v1.0.7** against live 2.0.0.
- `docs/specs/SPEC.2.md:2089` ends mid-sentence — *"A per-file index in a specification is a"* —
  with no terminal clause. A spec defect; ADR-1 does not amend specs.
- `docs/records/` (9 files) was never swept for inbound ADR citations. `docs/lanes/`, named in the
  ADR-1 kickoff, does not exist on `origin/main`.
- Eight bare pointers in contract files (`SPEC.1`, `SPEC.2`, `AGENTS.md`, `RANKING.md`) name an
  ADR whose `Status` is `superseded`, with nothing on the line saying so.

### Consequences

**Positive.** The largest measured defect surface in the corpus is closed by one ruling rather
than 275 edits. Every ADR body survives intact as the record it is. The two files that could
mislead a `claude-code` session building MOD-1 say so at the top.

**Negative.** A reader following a citation into `SPEC.1 §17` still finds nothing at the far end
and must come here to learn why. That cost is accepted: the alternative is 275 judgment calls
about what a removed section "should" now point at, producing a diff no reviewer can check.

**Enforced at:** `ADR-0021`, `ADR-0014`, `ADR-0046`, `ADR-0041`, `ADR-0025`, `ADR-0026`,
`ADR-0028`, `ADR-0013`, `ADR-0006`, `ADR-0011`.
```

---

### 3.2 File 2 — `docs/decisions/README.md`

**ANCHOR:** the last row of the amendment index table (the row naming `RECORD-v2.6-amendment.md`).
**CROSS-CHECK:** the recon measured ADR mentions at `:10`, `:26`, `:30`; `:30` restates D-31/D-32.
**EDIT:** append one row in the table's existing column shape — CC reads the v2.6 row and mirrors
it. Naming D-33 and `RECORD-v2.7-amendment.md`. Zero modified lines.

⚠ The recon flagged that `docs/decisions/README.md:16-18` still states a superseded precedence
ladder (carried-forward item **HYGIENE-1**). **Do not fix it here.** It is not this pass.

---

## 4 · THE TEN ADR EDITS

Every patch record uses the heading form already in the repo — CC reads an existing one
(`0011:347`, `0006:546`, `0045:132`) and mirrors it exactly. Multiple patch records per file are
the established house form: `ADR-0011` already carries two.

---

### 4.1 · `ADR-0021` — callout + `Amended-by` + patch record  *(1 modified line)*

**A · Metadata cell — THE ONE MODIFIED LINE**

**ANCHOR:** the table row whose first cell is `**Amended-by**`.
**CROSS-CHECK:** `:13`. Current value: `ADR-0046 (Track B consequence: publish, then flag)`.

Replace the **value cell only**, preserving the row's exact column widths and padding:

```
ADR-0046 (Track B consequence: publish, then flag) · D-32 (Track A auto-ban reversed; moderation consequences advisory)
```

**B · Callout — INSERTION**

**ANCHOR:** the first blank line after the **last** row of the leading metadata table (last line
matching `^\|\s*\*\*`). Insert immediately below it, before any other content.

```markdown
> ⚠ **Reversed in its consequences. Read this before the body.**
>
> **D-32** (2026-09-07, `docs/decisions/RECORD-v2.6-amendment.md`) rules moderation consequences
> **advisory**: no content is auto-removed, no participant is auto-banned, nothing is blocked at
> submission. **ADR-0046** had already replaced this ADR's **Track B** consequence with
> *publish, then flag*; **D-32 extends the same reversal to Track A's auto-ban**, which this
> ADR's `Amended-by` row did not previously cover.
>
> The single exception is the CSAM-adjacent image set, which is not **served** until screened.
> That is a serving hold, not a submission block.
>
> Everything below is the decision **as taken on <MEASURE: the value of this ADR's own `Date`
> metadata row>** and is preserved unchanged — including Option 3's *publish-flagged-then-remove*
> being recorded as **rejected**, which is the disposition ADR-0046 has since ratified. It is
> history. It is **not** a description of how the system behaves. The live contract is
> `ADR-0046` + **D-32**; the shipped code is `MOD-1`'s to change.
```

**C · Patch record — INSERTION at EOF**

```markdown
## Patch record — 2026-09-08 · D-32 reverses Track A; the body is preserved (ADR-1)

The ADR-1 recon measured **22** present-tense assertions in this file that the gate blocks content
and auto-bans its author: `:23`, `:40`, `:41`, `:43`, `:55`, `:59`, `:60`, `:71`, `:75`, `:77`,
`:79`, `:92`, `:94`, `:101`, `:107`, `:110`, `:119`, `:166`, `:172`, `:175`, `:199`, `:220`,
`:231`. It is the largest concentration in the corpus and the only one recorded nowhere as
reversed.

Per **D-33 R3** none of those lines is rewritten. The callout above carries the correction.

Three specifics a reader should not have to derive:

1. `:60` — *"Track A … → block + auto-ban author + CSAM auto-report. The bet+comment transaction
   never opens"* — is the exact clause **D-32** reverses.
2. `:50` proposes *"publish-flagged-then-remove"* and `:152` rejects it — *"If the classifier is
   confident enough to flag it, block it."* That rejected option **is** ADR-0046's ruling. The
   argument stands as the record of a decision since overturned.
3. `:77` and `:107` state *"ADR-0014's gate architecture is unchanged / otherwise untouched."*
   ADR-0046 has since superseded that architecture.

`:60`'s citation `ADR-0014 §84`, and the `§85` / `§154` / `§190` family, resolve to nothing —
ADR-0014 has no `§`-numbered headings (**D-33 R4**). Preserved per **D-33 R1**.

Status remains `accepted`. No text above this record is changed.
```

---

### 4.2 · `ADR-0014` — callout only  *(0 modified lines)*

**ANCHOR:** first blank line after the last metadata-table row. **CROSS-CHECK:** metadata at
`:10`–`:12`; Status at `:5`.

```markdown
> ⚠ **Gate architecture superseded. Read this before the body.**
>
> **ADR-0046** supersedes this ADR's gate architecture — the pre-commit ordering, the fail-closed
> terminal posture, and the blocking verdict. **D-32** extends that to consequences: nothing is
> auto-removed and no participant is auto-banned. The `Superseded-by` row above records the first;
> **D-32** is a ruling, and is recorded in `docs/decisions/RECORD-v2.6-amendment.md`.
>
> The body below describes the gate in the **present tense** throughout — 60 lines of it — because
> it was written while the gate was the design. It is preserved unchanged as the record of that
> decision. It is **not** a description of how the system behaves.
>
> **D-2** (`docs/decisions/RECORD-v2.0.md:504`) had already noted that this ADR's title *"produces
> a picture of a gate content must pass through before being accepted. **It is not one.**"* The
> title and filename are left as written; they are part of the record.
>
> The live contract is `ADR-0046` + **D-32**. The shipped code is `MOD-1`'s to change.
```

No patch record. The callout is the whole edit.

---

### 4.3 · `ADR-0046` — patch record  *(0 modified lines)*

**ANCHOR:** EOF.

```markdown
## Patch record — 2026-09-08 · D-32 extends this ADR from timing to consequences (ADR-1)

This ADR states at `:14` that it does **not** decide *"the auto-ban policy in `SPEC.1` §16.4."*
**D-32** (`docs/decisions/RECORD-v2.6-amendment.md:96`) now decides it: moderation consequences
are advisory — no auto-removal, no auto-ban, every consequence routed to the admin — with one
exception, the CSAM-adjacent image set, which is not served until screened.

Two things a reader of this file should be told:

1. **`:14`'s carve-out is discharged.** The auto-ban policy is decided, by ruling. (`SPEC.1` §16.4
   was itself removed at 2.0.0 by D-29; per **D-33 R1** the citation stands as written.)
2. **This ADR's stated follow-on at `:70` is discharged, not outstanding.** It asked that
   *"`ADR-0014` gains an `Amended-by` row."* What shipped is a **`Superseded-by`** row
   (`0014:11`), which is the repo's own convention for a *partial* supersession — `ADR-0022`,
   `ADR-0026`, `ADR-0031` and `ADR-0045` all carry a scoped `Superseded-by` with `Status`
   `accepted`. The relationship is recorded and reciprocal. No further row is added.

`ADR-0028`'s byte-identity binding remains unchanged, per `:62`. No text above this record is
changed.
```

---

### 4.4 · `ADR-0041` — `Amended-by` row  *(0 modified lines)*

The corpus's only one-sided link: `ADR-0042` amends this ADR and this ADR records nothing.

**ANCHOR:** the metadata-table row whose first cell is `**Superseded-by**`. Insert the new row
**immediately after it**, matching the file's exact column widths and padding.

**BEFORE WRITING THE VALUE:** read `docs/adr/0042-presigned-url-hold-budgeted-against-downstream-cache.md`
line `<MEASURE: the line of its `**Amends**` row; recon cross-check `:12`>` and **mirror its
scoping language.** Do not paraphrase it, and note that the `D-6` it names is a decision **inside
ADR-0041**, not decision-record D-6.

Value, adjusted to match ADR-0042's actual wording:

```
ADR-0042 (D-6 only — the presigned-URL hold is budgeted against this ADR's 7200 s TTL; the TTL itself stands)
```

No callout. No patch record. One inserted row.

---

### 4.5 · `ADR-0025` — patch record  *(0 modified lines)*

**ANCHOR:** EOF.

```markdown
## Patch record — 2026-09-08 · the D-6 withdrawal is recorded; the §21 target is gone (ADR-1)

**D-6** (`docs/decisions/RECORD-v2.0.md:200`) rules: *"Withdrawn. The ADR-0025 export amendment
existed to protect a Devcon-day spike. No Devcon, no spike."* Nothing in this file recorded it.
This file carries no `Amends` or `Amended-by` row at all.

⚠ **Which amendment D-6 withdraws is NOT ESTABLISHED.** This ADR names three — *"amendment 1"*
(`:138`), a *"§21.3 pointer-amendment"* (`:142`–`:144`), and a *"§21 amendment pass"* (`:176`) —
and D-6 names none of them by number. Recorded as an open cross-reference. Not resolved by guess.

⚠ Independently: **`SPEC.1` §21 was removed at 2.0.0** (D-29). The §21-family citations in this
file, and the 20 non-resolving tokens the ADR-1 recon measured here, point at sections that no
longer exist. Preserved as written per **D-33 R1**.

Status remains `accepted`. No text above this record is changed.
```

---

### 4.6 · `ADR-0026` — inline marker  *(1 modified line)*

`:90` carries an inline *"Superseded in part by ADR-0027"* marker. `:128` asserts the behaviour
ADR-0027 reversed — *"Admin market-media is moderated at upload"* — and carries no marker.
ADR-0027 removed that call entirely.

**STEP 1.** Read `docs/adr/0026-market-media.md` line `<MEASURE: the line carrying the existing
"Superseded in part by ADR-0027" marker; recon cross-check `:90`>` and record its **exact marker
form** — punctuation, emphasis, position in the line.

**STEP 2. ANCHOR:** the line containing `is moderated at upload`.
**CROSS-CHECK:** `:128`. It is a table row: *"SPEC.1 §14 (moderation, Track A/B) | moderation gate
| **Shapes.** Admin market-media is moderated at upload…"*

Apply **the identical marker form from step 1** to that line. Do not invent a second form, do not
rewrite the sentence, do not touch the row's other cells.

⚠ If the marker at `:90` is a whole-line construct that cannot sit inside a table cell, **halt and
report** rather than improvising a variant.

No patch record.

---

### 4.7 · `ADR-0028`, `ADR-0013`, `ADR-0006` — one patch record each  *(0 modified lines)*

Same skeleton, three file-specific substitutions. **ANCHOR:** EOF in each.

```markdown
## Patch record — 2026-09-08 · the pre-commit gate this file describes is superseded (ADR-1)

**ADR-0046** supersedes `ADR-0014`'s gate architecture and **D-32** makes moderation consequences
advisory. Lines <LINES> of this file describe that gate — its ordering, its fail-closed posture,
or its blocking verdict — in the **present tense**.

Per **D-33 R3** they are preserved as written. They record this ADR's decision against the
architecture as it then stood; they are not a description of current behaviour. The live contract
is `ADR-0046` + **D-32**.

**This ADR's own decision is unchanged.** <FILE-SPECIFIC>

Status remains `accepted`. No text above this record is changed.
```

| File | `<LINES>` | `<FILE-SPECIFIC>` |
|---|---|---|
| `ADR-0028` | `:25`, `:32`, `:33`, `:143`, `:160` | `ADR-0046:62` explicitly preserves this ADR's byte-identity binding: the moderated bytes must be the served bytes. Only the gate's blocking property moves; the binding does not. |
| `ADR-0013` | `:171`, `:234`, `:330`, `:469` | The `SERIALIZABLE` bet transaction, its retry policy, its Sentry alarm-3 emission and its step ordering are untouched. Only the moderation step's blocking property moves. |
| `ADR-0006` | `:184`, `:189`, `:216`, `:350` | The hosting topology, the vendor set and the failure-mode profile are untouched. Only the pre-commit-moderation reservation's fail-closed property moves; idempotency-fails-closed is unaffected. |

⚠ `ADR-0006` already carries a patch record (D-28 r20, recon cross-check `:546`). Append **after**
it. Do not merge into it, do not edit it.

---

### 4.8 · `ADR-0011` — three strikes + patch record  *(3 modified lines)*

**STEP 1 — read the established strike form.** Read this file's own D-28 r16 patch record
(`<MEASURE: recon cross-check :347>`) and its two struck sites (`<MEASURE: cross-check :134,
:165>`). Record the **exact** strikethrough + marker construct. Nine other ADRs carry the matching
*"repository-archive boundary is struck (D-21 / D-26)"* record — read one for the D-21 phrasing.

**STEP 2 — three modified lines.** ANCHOR on the phrase **`Devcon Mumbai conclusion-event
presentation surface`**, which occurs exactly three times.
**CROSS-CHECK:** `:152`, `:215`, `:240`. Confirm the count is exactly 3 before editing; if not,
halt.

Apply the step-1 strike form to each, citing **D-21 / D-26**. Strike the claim in place. Do not
delete the line, do not rewrite the surrounding sentence.

**STEP 3 — patch record. ANCHOR:** EOF. This file's existing records (`PFP-1`, D-28 r16) are
untouched; append after them.

```markdown
## Patch record — 2026-09-08 · Devcon struck (D-21 / D-26); the 50,000 namespace is superseded (D-28 r4) (ADR-1)

Two discharges of existing rulings. Neither is a new decision.

**1 · Devcon — struck.** D-26's test is *"a site is struck if deleting it removes a claim about
what happens after 2026-11-05."* Three sites in this file make exactly that claim and are struck
in place above: `:152`, `:215`, `:240`. This file is the **only** ADR in the corpus still naming
Devcon, and the only D-21-relevant ADR without the matching *"repository-archive boundary is
struck (D-21 / D-26)"* record that nine others carry. It was missed, not exempted.

**2 · The 50,000 namespace — recorded, not rewritten.** `RECORD-v2.4-amendment.md:18` (**D-28
r4**) closes the identity pool at *"1,070 PFPs × numeric suffixes"* and records **D-11's stated
size as superseded**. This ADR still ratifies 50,000 at `:71`, `:196`, `:275` and in its closing
ratification `:343`. Its own `PFP-1` record already carries the real render — *"13 colours × 67
animals = 871 pairs"* — and marks the 50,000-row manifest *"not started."*

⚠ **The 50,000 figures are NOT rewritten.** D-28 r4 supersedes **D-11's** stated size, which is a
decision-record ruling, not this ADR's ratification. The discrepancy is recorded here so a reader
arriving at `:71` is told; the ratification stands as the record of what was decided.

Status remains `accepted`.
```

---

## 5 · ACCEPTANCE TEST

**`just verify` is NOT a receipt for this PR.** No test and no CI step reads these files; green
over zero relevant files reads like coverage and is not (earned rule 6). The acceptance test is
the **diff shape**:

```
git diff origin/main --stat
git diff origin/main | grep -c '^-[^-]'        # deleted/modified source lines
git diff origin/main --name-only | sort
```

| # | Test | Expected | Fails if |
|--:|---|---|---|
| 1 | `--name-only` | **exactly the 12 paths at §1** | any 13th path — above all `docs/adr/0047-*` |
| 2 | `grep -c '^-[^-]'` | **exactly 5** | 6+ means prose was rewritten; 4 or fewer means an edit did not land |
| 3 | The 5 removed lines, read individually | 1 × `ADR-0021` `Amended-by` · 1 × `ADR-0026` `:128` · 3 × `ADR-0011` Devcon | any other line |
| 4 | `git show origin/main:<f> \| md5 -q` ×12 | identical to the preflight fence | a parallel merge |
| 5 | Every `<MEASURE: …>` placeholder | **zero remaining** in the diff | `grep -c 'MEASURE:'` > 0 |
| 6 | Every anchor's cross-check | within ±15 lines | report the delta; do not silently accept |
| 7 | `SPEC.1`, `SPEC.2`, `CLAUDE.md`, `AGENTS.md`, `src/`, `tests/`, `drizzle/` | **absent from the diff** | any appearance |

Report all seven as measured output, not as claims.

---

## 6 · GATE C — REVIEW SEQUENCE

No executable path changes: no `src/`, no `drizzle/`, no DDL. The named-reviewer cascade
(test-writer → code-reviewer → db-migration-reviewer → security-auditor) does **not** apply.

What does apply, unchanged from the SPEC passes:

1. CC runs the seven acceptance tests and writes a run report.
2. An **independent reviewer session** reads the diff against this plan — not against CC's report.
3. Web Claude reads the diff.
4. Hrishikesh reads the diff.
5. Hrishikesh merges. One PR, squash.

---

## 7 · TRANSMISSION

- Run report to `~/Downloads/zz_ADR-1_execute_<YYYY-MM-DD>T<HHMM>.md`, written **incrementally**.
- Inline: ≤10 lines — FILE · LINES · MD5 (measured, `md5 -q`) · STATUS · HALTED-AT.
- Commit author `Zugzwang/world <zugzwangworld@proton.me>`. **No `Co-authored-by`, no
  `Claude-Session` trailer** — `AGENTS.md` §10.
- Branch: `docs/adr-1-pass`. Base `main`. PR title: `docs(adr): ADR-1 — supersession and posture
  repair per D-33`.

---

## 8 · WHAT A DEFECT LOOKS LIKE HERE

Read this before executing. Each is a failure mode the SPEC passes actually produced.

- **Rewriting a sentence because the fix reads better as a rewrite.** The five modified lines are
  the whole budget. If an edit needs a sixth, halt and report; do not spend it.
- **Repairing a dangling citation "while you're in the file."** D-33 R1 forbids it. There are 275
  and they are all preserved.
- **Improvising a marker or strike form.** Two edits (§4.6, §4.8) require reading an existing
  instance first. Mirror it; do not design one.
- **Substituting a date, a line number or an ADR-0042 value from this plan.** Every `<MEASURE: …>`
  is measured from the file.
- **Fencing against the branch instead of `origin/main`.** The baseline moves with the breach.
- **Touching `ADR-0047`.** It is ratified out and owned by the LIQ closeout chat.

---

## 9 · Note added at commit time — two commands in this plan are superseded

**Everything above is the plan exactly as ratified on 2026-09-08 and is not corrected.** It is the
record of what was ratified, not a corrected copy — which is the point of committing it. Three
defects were found while executing it; all three are recorded in the run report
(`zz_ADR-1_execute_2026-09-08T0022.md`) and **two of them are in commands this document tells a
later reader to run.** They are named here so the document cannot mislead someone who runs them.

1. **§3.1's D-ceiling command returns the wrong answer on macOS.**
   `grep -oE '^#{1,6}[[:space:]]+.*\bD-[0-9]+'` truncates a multi-digit ruling to one digit — BSD
   `grep` resolves it leftmost-**first**, so the greedy `.*` wins the backtrack and `[0-9]+`
   settles for a single digit (`D-31` → `D-3`). It reported `D-30` against a live ceiling of
   **`D-32`**, which would have tripped this plan's own HALT on a false cause. Anchor `D-` to the
   heading marker instead: `grep -oE '^#{1,6}[[:space:]]+D-[0-9]+'`.

2. **§5 test 2's `grep -c '^-[^-]'` cannot count a removed markdown bullet.** The `[^-]` skips the
   `--- a/<file>` header, but a removed line beginning `- ` renders as `--` and is skipped too. It
   reported **2** against an actual **5**. Use either of:
   `git diff <base> | grep -E '^-' | grep -vE '^--- ' | wc -l` ·
   `git diff <base> --numstat | awk '{s+=$2} END {print s}'`

3. **§5's `git diff origin/main` is a TWO-DOT diff and silently inverts the other side.** Once
   `origin/main` advanced past the branch it reported **22 files / 1542 deletions** for a PR that
   changed 12 files and 6 lines, failing tests 1, 2 and 7 on correct work. Use the three-dot form,
   `git diff origin/main...HEAD`, which compares against the merge base.

**All three share one shape, and it is the reason this note exists rather than a silent fix:** each
returned a *plausible wrong number* rather than an error. Two would have stopped or failed a run
that was correct. The plan's rule that every value be measured from the file is what caught them —
applied, as it turned out, to the plan's own instruments.

**Ratified budget:** the 5-line budget at §1/§5 was raised to **6** by founder ruling during
execution, the sixth line being the `docs/decisions/README.md` v2.6 handoff row. **§4.1's `22`
present-tense assertions was ruled to be `23`** — the recon's table held 22 rows across 23 line
numbers, one row carrying two. This file, `docs/plans/ADR-1.md`, is the thirteenth path in the PR
and was ratified after the plan was written; §1's twelve-file table predates it.
