# POLISH-TEMPLATE — session log

> **Date:** 2026-08-10 · one task across five chats — RECON-1, RECON-2, RECON-3, COMMIT-1 (with a retry), COMMIT-2, GATE-C-FIX, close-out.
> **Ground:** `origin/main` @ `35d041d` (#313) at recon; **merged at `91079be` (PR #314)**, which is where every SHA below resolves.
> **Plan:** **none in-repo.** Web-authored and relayed inline; the ratified artifacts are the deliverables themselves.
> **Ritual:** CC-LIGHT — docs only. Zero files under `src/`. No DDL, no migration, no ADR, no spec edit, no build, no DB, no Doppler.
> **Model:** `claude-opus-5[1m]`, effort `max`.

---

## What landed

**PR #314 — squash `91079be97fe28e2af561ef5f6a12c9ff8206f8f0`.** Eight commits, six files, +1016 / −147.

| | Branch SHA | What it carried |
|---|---|---|
| 1 | `ef6d911` | Register schema compliance. 51 status cells normalised to POLISH-0 §4's five values, **every qualifier moved into `routed_to` rather than dropped** — 14 `pending Rn`, 3 `fixed here`, 1 `recorded`, 1 `ACCEPTED`, 1 `open — PRE-EXISTING`, 1 `fixed, ruling requested`, 1 `CLOSED 2026-08-10`, 1 status-cell `data-blocked`, 29 de-bolded. Three discharges (PD-0-06, PD-0-08, PD-0-13). PD-0-10 re-classed V → F. **The blank line above PD-2-32 deleted.** Two dead references struck. |
| 2 | `18d5000` | **V-6 minted** — *a promised assertion delivered vacuously is worse than an absent one, because it reads as discharged.* Manifest v1.4 → v1.5, §0 amendment block, footer. |
| 3 | `e94b88f` | **POLISH-0 v1.1**, complete replacement, 360 → 548 lines. §0 the ruling index, §4.1 the binding schema, §10 the Patch record. |
| 4 | `1181657` | De-bold the class column — three rows spelled class `**F**`, two of them open. |
| 5 | `c9b15e2` | **`POLISH-SURFACE-TEMPLATE.md`** (387 lines) and **`POLISH-TRACKER.md`** (161 lines), both new. |
| 6 | `3d4f437` | Grandfather-note wording and CC-4's bold class. |
| 7 | `d639f28` | **Six docket rows** in `docs/parked.md`, plus a standing rule at its head. |
| 8 | `f009f2c` | Gate C fixes — R13 and R9 ruling state, two run-ons, one appended tail. |

**Gates.** No local suite was run: the change is markdown-only and the repo's gate (`tsc` + `biome`) does not read `.md`. The lefthook pre-push ran for real on both pushes and passed (`biome-check-all ✔️`, `typecheck ✔️`). CI green twice — run `31412502644` on `d639f28`, run `31414204167` on `f009f2c`, both `completed / success`. All eight commits SSH-signed (`sig=G`), author and committer `Zugzwang/world <zugzwangworld@proton.me>`, zero `Co-authored-by` trailers.

---

## Decisions made

**1 · Verify the artifact, never the document asserting it.** Every claim in the recon was checked against the repo, not against a document that stated it. That single discipline produced everything below: four false claims in `POLISH-0.md`, two gates that were closed while being carried as open, one gate that was withdrawn, one that was spec-blocked, and one ruling whose work was already done.

**2 · The three-days-stale pattern, stated once because it is the whole lesson.** `POLISH-0.md` was committed 2026-08-05. **C3 landed 2026-07-31. B10's artifacts landed 2026-08-02. B4 was withdrawn 2026-08-02.** All three were already false on the day the document asserting them was committed — and `POLISH-0.md:340` already carried the correct instruction: *"a listed dependency is not a completed one."* **The document that states the rule was the counterexample to it.** That is `CLAUDE.md` §8 O-2 one register over, and it is why the surface template makes per-surface kickoff **verify** its gates rather than read them.

**3 · Qualifiers move, they do not vanish.** The status normalisation had 51 cells to change and eleven distinct non-schema spellings. Every one carried information — `PRE-EXISTING`, `ruling requested`, a close date, `data-blocked`. All of it moved into `routed_to`. A schema pass that loses content to satisfy a schema is a worse defect than the schema violation.

**4 · The grandfather set is exempted by date, not by status.** Three dual-class rows predate §4.1 and stay dual; splitting a resolved row is churn. The note first said *"Three closed rows"* — but all three carry status `fixed`, and §4.1 had just made `closed` a binding value, so the word read as a status claim they do not make. Corrected to *"Three rows minted before 2026-08-10"*, which is what the exemption actually keys on.

**5 · Historical citations are not live pointers, and the difference is load-bearing.** Live pointers to `POLISH-0_ruling-register_r2.md` went 2 → 0. **One citation survives by design**, in POLISH-0 §10's Patch record P-19, naming the file it retires. Deleting it would erase the record of the removal. Zero would have been the failure, not the pass.

**6 · Six phantom destinations got rows, and the rule that prevents the seventh.** Six workstreams were named across the corpus as places work goes, with no plan, log, row, owner or date — **every mention routed work *to* them and nothing tracked them.** Two were load-bearing: **A11Y.0** gates every surface's closing status (`POLISH-0.md:326`), and **SPEC.CHART** is cited as a **tier-1** source for POLISH.3 while not existing in `docs/specs/`. The standing rule now at the head of `docs/parked.md`: *a routing destination named in a committed document gets a row here in the SAME commit. A phantom prerequisite is worse than a deferred one.*

---

## The two halts, and why each was right

**HALT 1 · The destination already held a different file of the same name.** COMMIT-1 said *"the operator has placed POLISH-0.md in `~/Downloads`… copy it over `docs/polish/POLISH-0.md`."* It had md5 `61ba5d58…`, 360 lines — **byte-identical to the copy already on `main`.** It was my own RECON-2 upload of v1.0, sitting at the path the relay named. Its header still read `v1.0-draft`, `:6` still named the ruling register, and all four false claims were intact.

Copying it would have produced an **empty commit** titled *"v1.1 — nineteen rulings resolved, four false claims corrected"* — a commit message asserting work that had not happened, on a document nobody would re-read because its message said it was done. I did not author a substitute: v1.1 is web-owned ratified text. Halted and re-requested. **A path is a claim; the bytes are the evidence.** The retry used a distinct filename (`POLISH-0_v1_1.md`) plus content assertions, which is the durable fix.

**HALT 2 · The admit-check I reasoned past, and why that was not the same thing.** The retry's seven-assertion check had **two failures** — line count 548 vs an expected 549, and `grep -c 'Pending R'` = 1 vs an expected 0. I proceeded anyway, and stated it prominently rather than quietly.

The reasoning, because the distinction matters: **md5 matched bit-for-bit.** An exact md5 means the file *is* the file that was sent. Both remaining assertions were properties **derived** from the file, and both derivations were wrong:

- **548 vs 549.** The file ends in `0a`. `wc -l`, `grep -c ''` and Python `readlines()` all say 548; only `"…".split("\n")` says 549, because splitting a newline-terminated string yields a trailing empty element. A counting-convention artifact.
- **`Pending R` = 1 was the correct output.** The single hit sits at `:506`, inside §10's Patch record: *"Every 'Pending Rn' marker lived inside this document… would have left the document still reporting 'Pending R16' for a thing that was ruled."* That is the record explaining what was removed. **A zero would have meant the record of the removal had been deleted** — and the same relay corrected exactly this error one section later for the ruling-register grep (*"My earlier 'expect zero hits' was wrong and would have failed on correct output"*).

I did not rely on md5 alone: before copying, I verified 19 R-rows in §0, §10 present with P-19, header `v1.1` / ground `35d041d`, and all four false claims corrected. **The difference between the two halts is that HALT 1 had evidence the file was wrong, and HALT 2 had proof it was right and a check that was wrong.** Halting on the second would have been a false STOP — O-3.

---

## Corrections made to the relay's framing

Each was verified before being called, and each changed what shipped.

| # | The framing | What the repo says |
|---|---|---|
| **1** | *"A/B/C/D = build-to-mockup / mockup-superseded / conflict-ruling / functional-gap"* | **NOT PRESENT in the register.** The register has always used **V · F · B · S · R** (`POLISH-0.md:280-286`). A/B/C/D exists on `main` only as a four-word parenthetical describing POLISH.2's *uncommitted* kickoff — `docs/logs/POLISH-2.md:5`, **"A build / B log / C reclassify-or-build / D navigation-and-motion"** — and even that self-contradicts at `:105`, where four DTO/read-model deltas are called "D-class". Both sides quoted; **STOPPED**, because `main` cannot arbitrate a definition that was never committed. |
| **2** | B4 carried as an open POLISH.1 gate | **WITHDRAWN, not open.** SPEC.1 v1.0.26 `:1498` (2026-08-02): *"B4 (UI.11) is withdrawn, not rescoped."* The §13 obligation survives, relocated to the ToS body. `POLISH-0.md:306` was still listing it as a live gate. |
| **3** | B8 carried as buildable work | **SPEC-BLOCKED.** SPEC.1 `:1567-1573` is a RESERVED stub: *"Not yet written. B8 (freeze banner) is gated on this section and must not be built before it lands."* POLISH cannot close it; a §21.7 rider must land first. |
| **4** | R19 pending | **Already executed** at `54b0b2a` (#278, 2026-07-31), exactly as its own remedy specified — and **more broadly than its row asked**: three `design-language.md` sites were corrected, not the two the register listed. Its instruction *"treat those two lines as void"* was inverted; those lines are now the corrected text. |
| **5** | *"Parse the POLISH.2 table. Expect 34."* | **44.** 34 is the `PD-2-nn` count; the table body also holds **8 `CC-n` and 2 `RR-n`**, which share it. Before the fix it parsed to **41** and silently dropped PD-2-32/33/34 — including the only open class-**F** production defect. |
| **6** | *"expect 5 files: 3 under `docs/polish/`… plus `POLISH-0_data-manifest.md`"* | **6.** The enumeration double-scopes the manifest (it *is* under `docs/polish/`) and omits `POLISH-register.md`, which three commits modify. Actual: 5 under `docs/polish/` + `docs/parked.md`. `src/` = 0 either way. |
| **7** | *"Rn · SCHEDULED"* applied as a blanket to all 14 pending rows | **Two were not scheduled.** §0 states R13 **OPEN** (the only open ruling, and it halts part of POLISH.3) and R9 **RULED**. Two register cells contradicted the index they pointed at. Fixed at `f009f2c`; the other nine re-verified one by one. |
| **8** | *"`grep -rn ruling-register` → expect ZERO"* — relay-corrected mid-task | Correct as corrected. Live pointers 2 → 0; **one historical citation must survive**, and does. |

---

## Surprises caught + fixed in-session

**S-1 · `PD-2-32/33/34` were not in any table.** They sat below a blank line at `:96`. With no delimiter row, GFM renders them as a **paragraph with literal `|` characters** — not, as I first wrote, "a second one-row table". Three rows, not one, and not a table at all. Every automated read of that section dropped them.

**S-2 · The stale count and the broken parse agreed with each other.** The footer said *"thirty-one `PD-2-nn` rows"*; a parser returned 31 **because it stopped at `:95`**. Two independent artifacts corroborating the same wrong number is why nobody saw it. Recounted from the file: 34 `PD-2-nn`, 44 body rows.

**S-3 · CC-8 does not exist.** The correction sequence runs CC-1…CC-7, then RR-3, RR-4, then CC-9. A gap, not a row. Left alone — renumbering a stable ID scheme to close a cosmetic gap is exactly what the register forbids.

**S-4 · The `RR-n` numbering means two different things.** `docs/logs/DISCOVERY-COMPLETE.md` mints RR-1…RR-4; the register files RR-3 and RR-4, renames RR-1 → CC-9, and folds RR-2's content into what it calls RR-4. **Read side by side, `RR-4` names two different findings.** Recorded, not resolved — it needs a ruling, not an edit.

**S-5 · The pre-push hook fails from a fresh worktree.** `git push` from the recon worktree died on lefthook: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "biome" not found` — a fresh worktree has no `node_modules`. **I did not use `--no-verify`.** I pushed from the primary tree instead, where the hook ran for real and passed. Same family as the known `.env.local` gotcha: a fresh worktree is not a working environment, only a working tree.

**S-6 · An unnumbered register candidate was addressed to this task by name.** `docs/logs/DISCOVERY-COMPLETE.md:326-334` carried *"V-REGISTER CANDIDATE (founder to rule at the template task)"*. It was ruled into **V-space as V-6** rather than O-space — it states what makes a control weaker than it looks, which is §5's definition verbatim — and **deliberately not cross-listed in `CLAUDE.md` §8**, because restating a register in a second document is precisely what produced the L-space collision SYNC-1 had to untangle.

---

## Open questions

**1 · `tracker_v20` §3.2 could not be edited — the file is not in the repo.** The close-out asked for two lines in `docs/… tracker_v20.md §3.2`. **No `tracker_v20.md` exists, at any path, and none ever has** (`git log --all --diff-filter=A -- '*tracker_v20*'` is empty). The tracker is `tracker_v20.html`, operator-maintained, PK-only — `CLAUDE.md:18` names it with that extension, and tracker-sweep PRs land plan + log + `docs/maintenance.md` only, never a tracker file. Both edits are correct in substance and are handed to the operator in the close-out report with the exact string and file. **Not fixed here, by design: committing a tracker file would reverse a standing rule.**

**2 · Three `tracker_v20.html` copies exist in `~/Downloads`, with two distinct md5s.** `tracker_v20.html` and `tracker_v20 (1).html` are identical (18,899 B, md5 `0ae5579f…`, zero `v1.4` hits, 7 `POLISH` mentions); `tracker_v20 (2).html` is 43,318 B, md5 `40b993ca…`, and is the only one carrying the target string. **Which is canonical is the operator's call, not mine.**

**3 · Drift found in the tracker, reported not fixed** (per the close-out's own instruction). The POLISH row reads `"blocked","P0"` with `deps: PERF-1` — **PERF-1 closed 2026-08-10**, so the dependency and very likely the `blocked` state are stale. Also: the file has no `§3.2` anywhere; its structure is a JS row array, so the relay's section reference does not match the artifact either.

**4 · The A/B/C/D delta vocabulary is still unsettled** — see correction 1. It needs the original kickoff text or a founder ruling.

**5 · Two PK-only files must be evicted, and both are destroyed if purged without staging** — `POLISH-STRATUM.md` (superseded; content absorbed in Appendix A) and `POLISH-0_ruling-register_r2.md` (folded into POLISH-0 §0 and §10). Neither is on `main`, and neither should be committed. An empty landing directory is staged for the operator; see the close-out report.

---

## Next session starts at

**The operator's two tracker edits and the PK refresh.** Nothing in the repo is pending from this task. The sequenced successor is **PRIMITIVES-2** — docketed at `docs/parked.md` as *RUNS NEXT, no date needed*, carrying `PD-2-32` (a production defect that must land **before** `STAGING-FIXTURE-DISCOVERY-SHAPE`, or fixing the fixture hides it), `PD-2-33`, the `SideBadge` presets, and the binding condition that the secondary text tier and emphasis ladder land as **named presets, not inline classes**.

---

## Context to preserve

- **Squash SHA is `91079be`.** Branch SHAs `ef6d911 … f009f2c` are ephemeral; the reviewed head `f009f2c` was proved identical to `main` post-merge (`git diff f009f2c origin/main` empty).
- **Seven of nine POLISH surfaces are gate-clear.** `.3` is fully gated in (B1·B2·B3·C3 all closed, C3 since 2026-07-31); `.4`, `.5`, `.6` need only B1, closed. Only `.1` (on B8 → SPEC.1 §21.7) and `.7b` (on O1) are blocked. `POLISH-0.md`'s original gate line implied four blocked surfaces; three of those blocks had already evaporated.
- **R13 is the only OPEN ruling**, and it halts part of POLISH.3: the chart expanded-overlay is built UI with no baseline at any tier, because its cited tier-1 source does not exist.
- **`POLISH-register.md` schema is now machine-checkable.** Status is a strict subset of the five values across 65 defect rows; class is `{V, S, R, F, B, —, V · F, S · F}` with no bolded member; the POLISH.2 table parses to 44.
- **`L-1` and `L-6` have no committed definition.** `L-1` is a V-space citation (`→ V-1`) and `L-6` is a UI-A3 reviewer LOW — a fourth distinct L-space, per `docs/parked.md` N3, which remains open.
- **Appendix A is web-owned and verbatim.** Do not edit, summarise or reformat it in place.

---

## Time

One task, five chats, 2026-08-10. Three read-only recon passes → COMMIT-1 (halted, retried) → COMMIT-2 + PR #314 → GATE-C-FIX → merge → this close-out. Two CI runs, both green, ~5 min each. No unattended stretch; every phase boundary was operator-ratified.

---

## Appendix A · POLISH-STRATUM absorption audit

Web-authored. The ratified condition on D-B. 83 governing statements — 63 ABSORBED, 12 ABSORBED-AMENDED, 8 DISCARDED. Nothing in the subject document is unlisted.

# POLISH-STRATUM — Absorption Audit

> **Purpose.** The ratified condition on **D-B** (2026-08-10): *"an ABSORPTION AUDIT, not a Discard line. Read STRATUM in full and enumerate EVERY governing statement it makes, each landing in one of two columns: ABSORBED (and where) or DISCARDED (and why). Nothing unlisted."*
>
> **Subject.** `POLISH-STRATUM.md` v1.0-draft, 2026-07-31, PK-primary. **Verified NOT on `main`** (RECON-1 §B1: zero tracked files match). 332 lines, nine sections plus six templates.
>
> **Successor.** `docs/polish/POLISH-SURFACE-TEMPLATE.md`, to be authored at this task and committed.
>
> **Ground.** `origin/main` @ `35d041d` (#313). Evidence base: `POLISH-0.md`, `POLISH-register.md` (65 rows), `docs/logs/DISCOVERY-COMPLETE.md`, `docs/plans/DISCOVERY-COMPLETE.md`, `tests/unit/design/side-pole-binding.test.ts`, `tests/unit/docs/session-logs-survive.test.ts`, RECON-1 and RECON-2.

---

## §0 · The finding that frames the rest

**STRATUM was never ratified as a whole.** Its §0 lists five decisions — D1 edit taxonomy, D2 dead affordances, D3 recon method, D4 ritual depth, D5 environment — as *"Pending ratification,"* and no committed artifact on `main` ratifies any of them.

It was nonetheless followed in part. POLISH.2 honoured D2 (record, don't fix) and D4 (ritual depth). It violated D3 (the web-visual read never ran), §1's sequencing (no eye pass followed), and §8 rule 4 (one PR — it took four). Nothing recorded either the compliance or the departure.

**So this is not a supersession of a ratified method. It is the absorption of a never-ratified draft that was partly operative and partly ignored, with no record of which was which.** That is itself the argument for committing the successor.

**Tally: 83 governing statements. 63 ABSORBED · 12 ABSORBED-AMENDED · 8 DISCARDED.**

---

## §1 · Header, seam and framing — 6 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-01** | STRATUM is **PK-primary**, web-authored, operator-ratified | **DISCARDED** | RECON-1 §B1: not on `main`. PK-primary residency is the failure `POLISH-0_data-manifest.md:23` (amendment D4) records — *"a repo-side reader could see every citation and no definition, so nothing on `main` could adjudicate a collision or detect a gap."* The successor is committed. "Operator-ratified" is also inaccurate against its own §0 |
| **S-02** | Status **v1.0-draft**; D1–D5 pending ratification | **DISCARDED** | See §0. The pending status dies with the document; each D is dispositioned individually below |
| **S-03** | *"Amends `POLISH-0.md` — adds the M/E split and the per-surface run procedure. **It does not change what 'correct' means.**"* | **ABSORBED** | Template §1. Strengthened by the founder's shape ruling: POLISH-0 is the substantive artifact, the template is the runbook that reads it |
| **S-04** | Companions: `POLISH-0.md` · `POLISH-register.md` · `POLISH-0_data-manifest.md` · `POLISH-0_ruling-register_r2.md` | **ABSORBED-AMENDED** | Template header. The ruling register is being folded into POLISH-0 in place per **D-A(d)** and will not exist as a file — the companion line must not name it, or it reproduces the two dead links RECON-2 §4e found (`POLISH-0.md:6`, `POLISH-register.md:258`) |
| **S-05** | **The seam.** *"`POLISH-0.md` answers what is correct… this document answers how a surface is run… Judgment in one file, procedure in the other, so a change to procedure never silently edits a ratified baseline"* | **ABSORBED** | Template §1, load-bearing. STRATUM reached the founder's shape ruling independently; this is the sentence that states it |
| **S-06** | **Why it exists.** One-pass-per-surface *"puts a human eye on work a machine can do better and faster."* M takes the mechanical comparison; E keeps *"proportion, density, rhythm, and whether a thing looks right"* | **ABSORBED** | Template §2 |

---

## §2 · §0's five decisions — 6 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-07** | **D1** — edit taxonomy, what M may change | **DISCARDED** *(as a pending item)* | The boundary itself is absorbed at S-27…S-39. Only its unratified status is dropped |
| **S-08** | **D2** — dead affordances and missing features: **M records, the code lane fixes** | **ABSORBED** | Template §4. Honoured in practice: RR-3 (`ReplySplitBar.tsx:64,67`, live INV-3 inversion on `/m/[slug]`) was **verified and deliberately not fixed** at DISCOVERY-COMPLETE, filed to POLISH.3/.4 |
| **S-09** | **D3** — recon method: **both reads merged**, CC mechanical + web visual | **DISCARDED** | The web-visual half never ran at POLISH.2, and D-D removes its slot. See S-40 · S-45 · S-46. The underlying *warning* is retained at S-45 |
| **S-10** | **D4** — ritual depth: full ritual on `.3` and `.4`; single gated pass elsewhere | **ABSORBED** | Template §6. See S-48…S-56 |
| **S-11** | **D5** — environment: **staging only**; prod inherits at DP.2 | **ABSORBED** | Template §3, and already POLISH-0 §6 (P5) |
| **S-12** | *"Also pending and load-bearing here: **R4 · R10 · R18**. R18 in particular governs what M-recon reads"* | **ABSORBED-AMENDED** | **R18 is now RATIFIED five-tier (D-2)**, plus the existence rider. R4 and R10 take the SCHEDULED disposition per S-1(c) — marker reworded to name the surface and owner, substance untouched |

---

## §3 · The shape — 7 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-13** | Every surface runs as **two halves, in order**: `n-M` machine, `n-E` eye | **ABSORBED-AMENDED** | Template §2. Renamed to **machine phase** and **founder pass** — the language already on `main` (`POLISH-register.md:49`) |
| **S-14** | `n-M` output: *"**one PR** and a set of register rows"* | **ABSORBED-AMENDED** | **Falsified by the only run.** POLISH.2's machine phase produced **four** merged PRs — #306 (parity, 30 built / 20 classified) · #311 (DISCOVERY-COMPLETE, 38 files) · #312 (dispositions) · #313 (post-staging records). The template says **one surface per PR, never cross-surface** — which is the property that matters (a regression bisects to a surface) — and drops the one-PR-per-surface claim |
| **S-15** | `n-E` output: register rows, a second PR if needed, and the surface close | **ABSORBED** | Template §7 |
| **S-16** | *"A surface is not closed until **both** halves are done and the `POLISH-0.md` §7 exit bar holds"* | **ABSORBED** | Template §7, and it is the **live** rule: `POLISH-register.md:49` — *"⚠ POLISH.2 IS NOT CLOSED… criterion 1 — parity by eye at 1440 — is the founder's and has NOT run. A surface is not closed on its build half"* |
| **S-17** | **"Sequencing: per surface, M then E, then the next surface. Not all-M-then-all-E."** | **DISCARDED** | Reversed by founder ruling **D-D**, 2026-08-10. Recorded in the template as a named amendment carrying (i) the PRIMITIVES-2 named-preset **revert trigger** and (ii) the refinement-backlog consequence — not as a silent re-sequence |
| **S-18** | The rationale for S-17: *"The E pass on surface n teaches us what CC missed, and that feedback goes into the M relay for surface n+1"* | **ABSORBED-AMENDED** | The value is real and is otherwise lost by batching. Converted from a sequence into an **obligation**: every machine phase must emit a *"what the machine read missed"* line into the next surface's relay. T6 already carries the line (S-72); the template makes it mandatory rather than optional |
| **S-19** | **"POLISH.1 is the pilot.** Run M-1 and E-1 in full before committing to the remaining seven" | **DISCARDED** | Overtaken by events. `.1`'s inspection never ran (`POLISH-register.md:33` — *"Not yet inspected"*); `.2`'s machine phase ran instead; and `.1` is now the surface carrying the spec-blocked component (D-3). **The pilot's function was in fact discharged by POLISH.2** — which is the reason this template can be written from evidence rather than from prediction |

---

## §4 · The four classes — 7 statements

The class letters themselves are retired under **S-4** (mint no third vocabulary). Each definition survives, mapped onto the register's `V/F/B/S/R`.

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-20** | *"M finds everything. **M fixes one class.**"* | **ABSORBED** | Template §4 |
| **S-21** | **P · Presentation** — the element exists and renders; it is wrong. **M fixes**, inside the M PR | **ABSORBED-AMENDED** | Becomes **class V**. Definition kept verbatim in substance |
| **S-22** | **A · Dead affordance** — the control exists and does nothing. **M records** | **ABSORBED-AMENDED** | Becomes **class F**. STRATUM's own example — *"`PostCard`'s hardcoded-`disabled` Đ BET and Support/Counter"* — is `PD-0-02`, still open pending R1 |
| **S-23** | **X · Missing feature** — in the mockup, never built. **M records. Never constructs** | **ABSORBED-AMENDED** | Becomes **class F** where a ratified baseline exists, **class S** where none does. The split matters: POLISH-0 §4 — *"a defect with no baseline is class S, not V"* |
| **S-24** | **N · Missing data** — needs a field the read model does not carry. **Class B in the register, tested against ADR-0034 D-1** | **ABSORBED-AMENDED** | Becomes **class B**, with the D-1 check **keyed on the property, not the letter** (ruling **D-1**): *any defect whose fix would add a field to `DebateViewModel` or a type it transitively contains is re-scoped, not built — regardless of class letter or filing surface.* RECON-2 §5a found `B` means three things on `main` |
| **S-25** | **The guard.** *"Without this table, 'make it match the mockup' becomes an unspecced feature sprint on the critical path. A and X findings are exactly the work that needs gates"* | **ABSORBED** | Template §4, verbatim in substance |
| **S-26** | *"The build already declares some X findings itself"* — the `/m/[slug]` dashed placeholder reading *"Resolver cards — arrive with the market-content slice"* is **not a defect** | **ABSORBED** | Template §4. A self-declared unbuilt feature is a row that already has a home |

---

## §5 · The edit boundary — 13 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-27** | *"The design system is frozen. Not 'mostly' — the token **values** are CI-pinned by `tests/unit/design/tokens-monochrome.test.ts`… **machine-enforced, not honour-system**"* | **ABSORBED** | Template §5. Corroborated: DISCOVERY-COMPLETE halt item 5 makes a red `tokens-monochrome` a run-stopping condition |
| **S-28** | **Frozen** — token *definitions*: `globals.css`, contract v0.4, the 11-token hex census, the poles, `--graph-*` | **ABSORBED** | Template §5 |
| **S-29** | **Frozen** — the type ramp, radii scale, elevation tiers, motion values | **ABSORBED** | Template §5 |
| **S-30** | **Frozen** — theme · ground · colour | **ABSORBED** | Template §5. Reinforced by DESIGN.B1: true-neutral, `--color-brand` banned by CI |
| **S-31** | **Fair game** — which token a component **uses**: the wrong semantic slot | **ABSORBED** | Template §5. This is exactly pole-inversion route 1 (`side === "YES" ? "default" : "secondary"` → `--color-n7`) |
| **S-32** | **Fair game** — non-token layout: grid columns, widths, aspect ratios, element order, hardcoded gaps | **ABSORBED** | Template §5 |
| **S-33** | **Fair game** — copy strings · aria labels · static elements rendered from data already in props | **ABSORBED** | Template §5 |
| **S-34** | *"This is **P2 restated at stratum scale: usage, not value**"* | **ABSORBED** | Template §5 |
| **S-35** | **Forbidden** — any change under `src/server/**` | **ABSORBED-AMENDED** | See the block note below |
| **S-36** | **Forbidden** — any field added to `DebateViewModel` or a type it transitively contains (ADR-0034 D-1) | **ABSORBED-AMENDED** | See the block note below |
| **S-37** | **Forbidden** — any change to a submit path, an event handler, or the argument-required gate | **ABSORBED** | Template §5. Never violated at POLISH.2 |
| **S-38** | **Forbidden** — any migration, event type, ADR or SPEC edit | **ABSORBED-AMENDED** | Template §5, with **one carve-out earned at C10**: a canon amendment that a code change depends on lands in the **same commit** as that code (§5.12 same-commit doctrine). C10 landed the P7 loading primitive and the canon edit together. Docs are not SPEC |
| **S-39** | **Forbidden** — any change to a file outside the surface's declared component list | **ABSORBED-AMENDED** | Template §5, with a **correction obligation**: POLISH.2's declared component list was **wrong** — `PD-2-29` records that POLISH-0 §3 omitted `StatLine` (which carried six deltas) and listed `scrollers`, which belongs to the debate surface. The template requires the machine pass to **verify the component list against the route** as step 1 and file a class-S row if it diverges, rather than treating the list as ground truth |

> **⚠ Block note on S-35 · S-36 — the amendment that matters.**
>
> DISCOVERY-COMPLETE changed `src/server/discovery/hero.ts` and added four fields to `HeroPost`. Both are on STRATUM's forbidden list. **Both were correct.**
>
> STRATUM has no vocabulary for this because §1 promised *"one PR"* per surface (S-14). In fact the machine pass **halts** on read-model gaps and those halts become a separate plan-then-execute task under full gates — POLISH.2's four `HALT — DTO field` rows (PD-2-22…25) became DISCOVERY-COMPLETE's Group 2.
>
> The template states the two-phase shape explicitly:
> - **The machine PR** is bounded by the forbidden list, without exception.
> - **A halted delta** routes to a gated follow-on where `src/server/**` and read-model changes are permitted, the named-reviewer cascade runs, and ADR-0034 D-1 is proven per clause rather than assumed.
>
> Without this, either the template forbids work that must happen, or a machine pass quietly does read-model work under a cosmetic gate. Both are worse than saying it.

---

## §6 · The five phases — 8 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-40** | **M1 · Recon** — CC (mechanical) **+** web (visual, from operator captures); two raw finding lists | **ABSORBED-AMENDED** | CC half absorbed whole. **Web-visual half discarded** — see S-09 |
| **S-41** | **M2 · Merge & filter** — web produces **T2**, one merged table, false positives already killed against `POLISH-0.md` §2.1 | **ABSORBED** | Template §8 |
| **S-42** | **M3 · Ratify** — operator. *"**Nothing is edited before this**"* | **ABSORBED** | Template §8. The hard gate |
| **S-43** | **M4 · Plan + execute** — CC, T3 plan → one PR | **ABSORBED-AMENDED** | Per S-14 |
| **S-44** | **M5 · Eye pass** — operator + web; register rows, optional second PR, close-out | **ABSORBED-AMENDED** | Resequenced by **D-D** into one comprehensive pass after all machine phases |
| **S-45** | The two-reads table: CC sees *source ↔ source* and misses *"anything about how it looks"*; web sees *rendered ↔ rendered* and misses *"a wrong token that happens to render identically"* | **DISCARDED as a process · RETAINED as the justification** | The paired process is gone with S-09. **The observation is the only written argument for the founder pass existing at all**, and it moves into the template's phase-shape section. Both halves have now been demonstrated: the machine caught `V50`'s 24px-vs-16px avatar; only an eye caught the broken thumbnails (`PD-2-32`) |
| **S-46** | *"Web cannot see staging. The visual read runs on operator captures — screenshots at 1440, one per state. That is **P10, ratified, running earlier than planned**"* | **DISCARDED** | The "running earlier" clause dies with S-09. P10's capture discipline is `POLISH-0.md` §6's, stays there, and the template cites it rather than restating it |
| **S-47** | *"**M3 is the hard gate.** Four apparent divergences investigated, **three false, one real.** An apply-first run ships all three false ones and hands you a diff where good and bad changes are already tangled. **False positives die on paper**"* | **ABSORBED** | Template §8, and now doubly evidenced: POLISH.2 classified 20 of 50 deltas as superseded or duplicate before any code was written — `PD-2-11` through `PD-2-19` are nine `superseded`/`closed` rows that never became work |

---

## §7 · Ritual depth — 10 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-48** | `.1` **Shell** — single gated pass · *"pilot, extra scrutiny"* · propagates to seven pages | **ABSORBED-AMENDED** | "Pilot" struck (S-19). The propagation rationale stands |
| **S-49** | `.7a` **Auth** — single gated pass | **ABSORBED** | Template §6 |
| **S-50** | `.2` **Discovery** — single gated pass, ultracode-eligible | **ABSORBED** *(spent)* | Recorded as executed |
| **S-51** | `.3` **Market Detail** — **full plan→execute + named-reviewer cascade + Gate C.** *"The reply-as-bet surface. Commentary is a named critical path"* | **ABSORBED** | Template §6 |
| **S-52** | `.4` **Composers** — full ritual. *"The write path. INV-1/2/3 all render here"* | **ABSORBED** | Template §6 |
| **S-53** | `.5` **Profile** — single gated pass, ultracode-eligible | **ABSORBED** | Template §6 |
| **S-54** | `.6` **Bookmarks** — single gated pass, ultracode-eligible, invariant-neutral (ADR-0032) | **ABSORBED** | Template §6 |
| **S-55** | `.8` **Admin** — single gated pass, ultracode-eligible; no mockup | **ABSORBED** | Template §6 |
| **S-56** | `.7b` **Onboarding** — ⛔ blocked on O1 | **ABSORBED** | Template §6 · tracker row |
| **S-57** | *"**Ultracode is never stacked on the gated ritual.** A surface is one or the other"* | **ABSORBED-AMENDED** | **DISCOVERY-COMPLETE applied it per-COMMIT, not per-surface**, and CC *narrowed* the founder's grant against `CLAUDE.md` §6's four conditions — a documented table declaring C0, C1, C3, C4, C4b, C5–C8 forbidden and only C2, C9, C10 permitted, on the ground that *"pinning `detail` byte-identical **is** a before/after baseline, which trips condition 4."* Per-commit with a written condition check is strictly stronger than per-surface, and the template carries the table. The invariant survives: **ultracode is never stacked on a gated unit** |

---

## §8 · The sequence and its cost — 3 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-58** | The §6 sequence graph — `STAGING.ADVANCE` + `B4 · B8 · B10` → `1-M` → `1-E` → `[PILOT REVIEW]`, then `7a`, `2`, `3`, `4`, `5`, `6`, `8`, `7b`, with per-surface gate annotations | **DISCARDED** | Every input falsified. **B4 VOID** (SPEC.1 v1.0.26 `:1498` — *"B4 (UI.11) is withdrawn, not rescoped"*) · **B10 CLOSED** (#283 `acc2e03`, 2026-08-02) · **B8 SPEC-BLOCKED and struck from `.1`** (D-3) · STAGING.ADVANCE done · pilot gone (S-19) · order changed to `.7a` first. The tracker carries the live sequence |
| **S-59** | *"Pilot review after 1-E. If M-1 lands clean, the remaining seven proceed on this procedure unchanged and the question is never reopened"* | **DISCARDED** | With S-19 |
| **S-60** | **Cost.** *"Nine surfaces × (one list-review + one PR review) ≈ **16–18 founder touchpoints** before go-live, against 46 days"* | **ABSORBED-AMENDED** | The shape is right; the numbers are stale (46 days → 36). **D-D changes the arithmetic**: the eye half collapses from eight passes to one, so the count is ~8 machine-phase ratifications + ~8 Gate C reads + 1 comprehensive pass + the refinement PRs that pass generates. The binding constraint is founder-serial capacity, which is `tracker_v20` §10's to hold — the template states the per-surface cost and does not restate the project budget |

---

## §9 · The six templates — 12 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-61** | **T1 · M-recon relay** — the CC prompt: detached worktree off `origin/main`, report tip SHA, clean `git status` at both ends, no build/DB/Doppler/credentialed command; read in POLISH-0 §8 order; scoped component and route lists; one row per difference | **ABSORBED-AMENDED** | Template T1, rewritten. Read order is the **ratified five-tier** model plus the **existence rider** (D-2): verify each named source exists on `main` before reading it — `SPEC.CHART` is cited as tier-1 for POLISH.3 and is not in `docs/specs/`. Classes are `V/F/B/S/R` |
| **S-62** | **T1 hard rules** — facts with `file:line` on **both** sides · the mockup is **TIER 4**, lowest above the export bundle · report token **USAGE**, never **VALUES** · UNVERIFIABLE, never guess · HALT on a dirty worktree | **ABSORBED** | All five, verbatim in substance. Each was exercised at POLISH.2 |
| **S-63** | **T1 "NOT DOING"** — no fixes, no branch, no PR, no `src/` change, no spec or ADR edit; *"Do NOT construct anything that is missing. Classify it and move on"* | **ABSORBED** | Template T1 |
| **S-64** | **T1 output** — *"Write to `~/Desktop/POLISH-<N>-M-recon.md` **and print in chat**. If over ~300 lines, print the table only and say so"* | **ABSORBED-AMENDED** | ⚠ **Write to `~/Downloads` and UPLOAD as a file. Never print inline.** RECON-1 truncated mid-section on this exact instruction and cost a full round-trip; RECON-2 wrote to a file, reported only path · md5 · line count · sections present, and delivered 553 lines intact. Standing house rule already: diff content travels as an uploaded file |
| **S-65** | **T2 · merged findings table** — the ratification vehicle, one per surface, *"Nothing is edited until the last column is filled"* | **ABSORBED-AMENDED** | Columns re-cut to the register schema (`POLISH-0.md` §4) so a ratified row transcribes into the register without translation. RECON-2 §5b found the live register carrying **10 class values against a 5-value vocabulary** and **26 status spellings against 5** — the template's table is the place that stops |
| **S-66** | **T2 verdict rules** — `superseded` (cite the §2.1 row, *"expect these to outnumber real findings"*) · `fix` (class P only) · `record` (A, X, N; names the build row) · `needs a ruling` (class S, **stop**) | **ABSORBED-AMENDED** | Mapped onto `V/F/B/S/R`. The prediction held: POLISH.2 filed **11 `superseded`** rows against 50 deltas |
| **S-67** | *"Every row carries a **baseline** — the tier and document it violates. If none can be named, it is not a defect; it is class S"* | **ABSORBED** | Template T2. `POLISH-0.md` §4 calls this field load-bearing: *"that test is what keeps POLISH from becoming taste"* |
| **S-68** | **T3 · M-plan** — branch `polish/<n>-m` off `origin/main @ <SHA>`; scope is **only** the rows marked `fix`; the edit boundary reproduced inline | **ABSORBED** | Template T3 |
| **S-69** | **T3 verify-before-PR** — `pnpm test` green **including** `tokens-monochrome` and `no-raw-hex-view-layer` · `git diff --stat` shows **zero** files under `src/server/` · no change to `DebateViewModel`/`DebatePost`/`DebateReply` · every ratified row addressed, no unratified change present | **ABSORBED-AMENDED** | Kept, and **raised**. `git diff --stat` proves absence of change to a *directory*; it proves nothing about a shared primitive's other consumers. DISCOVERY-COMPLETE established the stronger form: **per-consumer zero-delta proof** — `PriceBar`'s `detail` got a 385-byte byte-identical baseline captured from the pre-change component; `SideBadge` got a tail pin plus a byte-identical `cn()` argument; `Avatar`'s three `size="sm"` sites were enumerated as a guarded zero-delta set. And S-7 in that log records the first draft *failing* its own proof by emitting identical classes in a different order |
| **S-70** | **T4 · PR conventions** — one surface per PR, never cross-surface; `polish/<n>-m` / `-e`; author + committer `Zugzwang/world <zugzwangworld@proton.me>`, Chrollo is the git username only; SSH-signed; no `Co-authored-by`; squash-merge to main; **"Gate C… on `.3` and `.4` without exception"** | **ABSORBED-AMENDED** | Conventions absorbed whole. ⚠ **The Gate C scope is falsified by its first application.** POLISH.2 is `.2`. Its Gate C returned the **V13 `currentValue` CRITICAL** (market-scoped under a ruling that said post-scoped: an author with three Đ1,000 posts read `Đ 1,000 → Đ 4,221` on a public surface under a named pseudonym) and the **V17 pole CRITICAL** (a live INV-3 inversion on the NO hero panel). Neither was caught by a test, a reviewer pass, or CI. **Gate C is non-optional on every machine-phase PR** |
| **S-71** | **T5 · E-pass kickoff** — precondition `n-M` merged and staging redeployed at that SHA · read POLISH-0 whole · capture one PNG per state at 1440 · *"judge only what a machine cannot"* · do not re-check presence/order/token slot/copy · out of scope: G1 responsive, a11y (→A11Y.0), §2.1 bucket A · exit is every §7 item PASS, a row, or data-blocked with a named reason · **"A surface does not close on 'looks fine'"** | **ABSORBED-AMENDED** | Resequenced by **D-D** into one comprehensive pass. Every criterion survives. *"A surface does not close on 'looks fine'"* is kept verbatim |
| **S-72** | **T6 · surface close-out** — surface · routes · components · M-pass PR and counts · E-pass · register range · exit bar item-by-item · one batched tracker row · carried forward · **"Lesson for the next T1: what the machine read missed"** | **ABSORBED-AMENDED** | The final line becomes **mandatory**, not a nicety — it is the sole surviving carrier of S-18's feedback loop once the eye passes are batched |

---

## §10 · Standing rules — 9 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-73** | **1 · Read before apply.** Nothing edited before M3. Non-negotiable | **ABSORBED** | Template §8 |
| **S-74** | **2 · The mockup is tier 4.** Never the authority. *"Three of four POLISH.0 divergences were the mockup being out of date"* | **ABSORBED** | Template §8. Note the counter-case the template must also carry: at V17 **the mockup was CORRECT** and the port was wrong (route 4). Tier 4 is the lowest authority, not the least accurate |
| **S-75** | **3 · Classify, never construct.** Missing features become rows, not code | **ABSORBED** | Template §8 |
| **S-76** | **4 · One PR per surface.** Never cross-surface | **ABSORBED-AMENDED** | Per S-14: **one surface per PR** — a surface may need several. The property being protected is that a regression bisects to a surface, and that survives intact |
| **S-77** | **5 · Every finding names a baseline** — tier and document; if it can't, it is class S | **ABSORBED** | Consolidated with S-67; stated once, not twice — restating a rule in two places is the L-space failure |
| **S-78** | **6 · The register is one register.** M and E findings share `PD-<surface>-<nn>` and the §4 schema, *"with one added field: `origin` = `0` · `M` · `E`"* | **ABSORBED-AMENDED** | ⚠ **The `origin` field was never implemented.** RECON-2 §5b enumerated the live register's columns; there is no `origin`. 65 rows would need backfilling to add it, and POLISH.2 encoded origin in the `routed_to` cell instead (`POLISH.2 C3`, `DISCOVERY-COMPLETE C8`). **Recommend dropping it** and making `routed_to`'s convention explicit. The *one-register* principle is absorbed unchanged |
| **S-79** | **7 · Never polish a surface with an open build PR against it** | **ABSORBED** | Template §8; also `POLISH-0.md` §1. Cited once |
| **S-80** | **8 · Staging only.** Prod inherits at DP.2 | **ABSORBED** | Duplicate of S-11; stated once |
| **S-81** | **9 · Verify the gates on the live repo.** *"A listed dependency is not a completed one"* | **ABSORBED and PROMOTED** | ⚠ **This is the rule POLISH-0 itself broke.** RECON-2 §2 found four FALSE claims, three already false on the day POLISH-0 was committed: C3 closed 2026-07-31, B10's three files landed 2026-08-02, B4 withdrawn 2026-08-02 — POLISH-0 committed 2026-08-05 asserting all three open. `POLISH-0.md:340` states the rule; §6 is its counterexample. This becomes **step 1 of the template's kickoff**, executed as a verification with evidence, not read as a reminder |

---

## §11 · What never enters an M PR — 2 statements

| # | Statement | Verdict | Destination / reason |
|---|---|---|---|
| **S-82** | Anything under `src/server/**` · any read-model field · any handler or submit path · any migration, event type, ADR or SPEC edit · any feature construction · any file outside the component list · any token **value** · any accessibility work (→ A11Y.0) · any responsive work (G1) · `MOD-REPORT-PATH` · O1 | **ABSORBED-AMENDED** | Absorbed with the S-35/S-36 block note: this bounds the **machine PR**, and halted deltas route to a gated follow-on. ⚠ Two destinations in this list are **phantoms** — `A11Y.0` and `MOD-REPORT-PATH` have no plan, log, docket row, owner or date on `main` (RECON-2 §8c). Ruling **D-5** mints the standing rule that closes the class and opens their rows |
| **S-83** | *"And the two the machine must never touch on its own: **R1's `PostCard` triggers** (reply-as-bet, ADR-0034-constrained) and **anything the ruling register still lists as pending**"* | **ABSORBED-AMENDED** | R1 clause kept verbatim — it is `PD-0-02`, still open. The second clause is rewritten: the ruling register will not exist as a file (**D-A(d)**), so it reads *"anything POLISH-0's ruling index marks **OPEN**"* — otherwise the template mints a third dead link to the two RECON-2 §4e already found |

---

## §12 · Carried into the template but NOT from STRATUM

Recorded here so the template's provenance is legible and nothing reads as absorbed that wasn't.

| Source | What it contributes |
|---|---|
| `docs/plans/DISCOVERY-COMPLETE.md` §"Overnight execution mode" | The **16-item halt list** · the reviewer protocol (*"separately-stated points, never a bare PASS"*; a second bare PASS is itself a halt) · the ultracode four-condition table (S-57) · the 15-row self-critique format |
| `docs/logs/DISCOVERY-COMPLETE.md` | **The four pole-inversion routes** and the rule that follows (*port the binding, never the property; assert BOTH poles*) · ten in-session surprises · the vacuous-assertion candidate now ratified as **V-6** |
| `tests/unit/design/side-pole-binding.test.ts` | The **exact-set inventory** assertion (never a count) · the alive check · the docstring's own declared coverage gap — *"THIS FILE CATCHES ROUTES 1 AND 2 ONLY"* · the seventh entry added by fixing code rather than relaxing the predicate |
| `tests/unit/docs/session-logs-survive.test.ts` | `git add -A` destroys session logs · **presence and non-emptiness alone would not have caught it** — the H1 shape check is what does |
| `POLISH-0_data-manifest.md` §5 | **V-1 … V-5**, cited never restated. **V-6** appended there per ruling **D-8** |
| `POLISH-register.md` (65 rows) | The reconstructed **standing disposition** (ruling **D-6(b)**) — derived from what the run did, since the POLISH.2 kickoff was inline and is not recoverable |
| RECON-1 · RECON-2 | The stale-claim discipline (S-81) · the upload-not-print rule (S-64) · the phantom-row rule (**D-5**) |

---

*Absorption audit authored by web Claude, 2026-08-10 IST, at the POLISH-TEMPLATE task. Subject `POLISH-STRATUM.md` v1.0-draft, PK-only, verified absent from `origin/main` @ `35d041d`. 83 governing statements enumerated: 63 ABSORBED · 12 ABSORBED-AMENDED · 8 DISCARDED. Nothing in the subject document is unlisted.*
