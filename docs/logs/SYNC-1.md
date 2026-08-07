# SYNC-1 — truth pass, V-renumber, docket

> **Session:** 2026-08-08 IST — unattended, single sequential pass. Effort max.
> **Branch:** `chore/sync-1-truth-pass` · **Base:** `fecbaf3` (`origin/main` at STEP 0).
> **Scope boundary, absolute:** IN `docs/**`, `CLAUDE.md`, `AGENTS.md` · OUT `src/**`, `tests/**`, `drizzle/**`, `.github/**`, `package.json`. **Held: 16 files changed, zero outside IN** (verified mechanically, not by inspection).
> **No ADR minted.** `ultracode` / dynamic workflows: FORBIDDEN, not used. No subagents.
> **Input:** the SYNC-1 RECON report (`~/Desktop/SYNC-1-recon.md`) — its R3 table is this session's work order.

---

## What landed

**16 files, +323 / −100.**

| Area | Files |
|---|---|
| **The V-renumber (STEP 1)** | `docs/polish/POLISH-0_data-manifest.md` · `docs/logs/STAGING-PARITY-closeout.md` · `docs/logs/STAGING-PARITY-closeout-draft.md` · `docs/logs/STAGING-PARITY-A.md` · `docs/logs/F-DEBATE-4.md` · `CLAUDE.md` |
| **The truth pass (STEP 2)** | `AGENTS.md` · `CLAUDE.md` · `docs/runbooks/deploy-pipeline.md` · `docs/maintenance.md` · `docs/design/design-token-contract.md` · `docs/design/design-language.md` · `docs/design/design-workflow.md` · `docs/design/mockups/README.md` · `docs/design/ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md` · `docs/specs/SPEC.2.md` (§0 metadata only) |
| **The docket (STEP 4)** | `docs/parked.md` |

**PK-side, not committed:** `~/Desktop/zz-pk-refresh-SYNC-1/INDEX.md` (STEP 3).

---

## STEP 1 — the V-renumber, executed

**The finding that made it necessary, which the recon could not see.** STAGING-PARITY **D.4 (2026-08-07) had already ruled** the verification lessons out of L-space. **The ruling landed as a routing sentence; the renumbering never executed.** That is why `L-2` read as *missing* rather than as *ambiguous*.

**Root cause, and the reason O-space is now committed:** the register lived **only** in `STAGING-PARITY_operating-plan_v1_0.md`, a project-knowledge document that is not on `main`. A repo-side reader could see every citation and no definition. **A register that lives only in PK cannot arbitrate its own numbering** — nothing on `main` could detect the collision, let alone resolve it.

**Three registers were using the bare form `L-n` simultaneously, each with its own `L-2`:**

| Space | What it holds | Canonical home (now) |
|---|---|---|
| **V-space** — V-1…V-5 | *Verification* lessons: what makes a control weaker than it looks | `docs/polish/POLISH-0_data-manifest.md` **§5** |
| **O-space** — O-1…O-3 | *Operating* disciplines: how to work | `CLAUDE.md` **§8** |
| **L-space** | PRIMITIVES-1 Gate C `@code-reviewer` LOWs | `docs/polish/POLISH-register-ADDITIONS.md` |
| *(fourth)* | Task-scoped `@security-auditor` LOWs | **must carry their task name** — `F-DEBATE-4 L-2`, `SA-L-1` |

**Done:** V-1…V-4 numbered in place in manifest §5 (order unchanged), V-5 appended · manifest §0 gains a **v1.4** record (D1–D4) and the status/footer bump to v1.4 · close-out §3's five *"(web-side — paste in)"* placeholders replaced with canonical text · the L-8 block becomes **V-5, successor to V-1 and V-2** · **both ⚠ "L-2's text is not carried anywhere in-repo" flags deleted — answered** · close-out §3's routing sentence corrected · `CLAUDE.md` §8 mints O-1/O-2/O-3 and records the fourth lesson as **DISCHARGED** (Slice B.3 executed the staging runner).

**`docs/parked.md` needed no substitution** — it already cited **V-3**, not L-3. The recon's 1.4 target was a no-op, which is itself evidence the D.4 ruling had partially propagated.

---

## STEP 2 — the truth pass

Every R3 finding, with disposition. **28 rows.**

| # | File · claim | Disposition |
|---|---|---|
| 1 | `AGENTS.md:98` — "the market-list surface … is still to come" | **FIXED.** Replaced with a four-row surface table (Discovery / Debate / Profile / Bookmarks, each with route + read model + landing task) and a ⚠ block naming Discovery as the **PERF-1 GO-LIVE BLOCKER** with its two file:line citations. |
| 2 | `AGENTS.md:84` — server-dir list missing 4 dirs | **FIXED.** +`bookmarks/`, `discovery/`, `profile/`, `visitors/`; `discovery/` given its own annotated line as the PERF-1 surface. |
| 3 | `AGENTS.md:71` — `(public)/` tree missing 3 surfaces | **FIXED.** Full per-file tree. |
| 4 | `AGENTS.md:72` — `api/` missing `visits` | **FIXED.** |
| 5 | `AGENTS.md:74` — `components/ui/` missing 3 primitives | **FIXED.** +dialog, input, textarea; `src/components/` sub-dirs added. |
| 6 | `AGENTS.md:203` — "`Sonner` for toasts" (FALSE) | **FIXED.** Replaced with "no toast library is installed", cross-referenced to §11 ask-first. |
| 7 | `AGENTS.md:216` — 20 integration suites | **FIXED.** 30, all ten missing names added. |
| 8 | `AGENTS.md:225` — 26 `*.test.tsx` | **FIXED.** 30. |
| 9 | `AGENTS.md` §2 — recipe list missing `just test-scale` | **FIXED.** |
| 10 | `AGENTS.md:293` — SPEC cites 1.0.14 / 1.0.17 | **FIXED.** Footer rebuilt against `fecbaf3` with every verified ceiling. |
| 11 | `CLAUDE.md:18` — ADRs "0001–0034 / 33 files / next free 0035" | **FIXED** → 0001–0036 / 34 / 0037, with a clause recording that the sentence teaches "read the highest number, never count" and **was itself three numbers stale**. That is O-2. |
| 12 | `CLAUDE.md:18` — SPEC.1 1.0.15 | **FIXED** → 1.0.29; SPEC.2 1.0.22 added. |
| 13 | `CLAUDE.md:18, :203` — `tracker_v17.html` | **FIXED** → `tracker_v20`, both sites. |
| 14 | `CLAUDE.md` §6 — never names ADR-0035 / ADR-0036 | **FIXED.** New paragraph: `tests/staging/` is ADR-governed; the runners are operational artifacts against the live staging DB under a five-guard contract. |
| 15 | `CLAUDE.md:232` — footer "CC → Opus 4.8" | **FIXED** by **date-scoping, not deletion** — same treatment the ADR-range clause in that sentence already had. |
| 16 | Masking standing check buried in `docs/parked.md` | **FIXED / MOVED.** Now `CLAUDE.md` **§5.14 SC-1**, a per-PR reviewer gate. |
| 17 | `deploy-pipeline.md:200` — "`smoke:staging` is once again a valid staging gate" (FALSE) | **FIXED.** New **§3.0** states the smoke's real reach: canary/env/db/migrations sound; **item 9 `sentry-routing` has never asserted anything**, all three reasons enumerated, with an explicit "a green smoke is not evidence Sentry is ingesting" and "do not fix this by loosening the gate". §4 headline rewritten to point at §3.0. |
| 18 | `deploy-pipeline.md:77` — `--config staging` warning outlived its defect | **FIXED.** Warning removed, resolution record kept; verified `migrate-staging.ts:8/:42` both read `stg`. |
| 19 | `maintenance.md:20, :152` — `zugzwang_experiment_tracker_v9.html` | **FIXED.** Removed from **both** tables + why. |
| 20 | `maintenance.md:19, :151` — `docs/logs/_template.md` | **FIXED.** Removed from both. |
| 21 | `maintenance.md:24, :155` — `.claude/commands/*`, `.claude/hooks/*` | **FIXED.** Removed from both. |
| 22 | `maintenance.md` log — F-DEBATE-4 working-directory pin correction unlogged | **FIXED.** Appended, with the operating rule (launch reviewer sessions from a worktree at `origin/main`) and the fallback. |
| 23 | `design-token-contract.md:227` — `--imgr` "CD-DEFERRED placeholder" | **FIXED** → RATIFIED, naming the three-way contradiction it resolved. |
| 24 | `mockups/README.md:4` — `DESIGN-phase-record.md` §9 pointer | **FIXED — struck**, per instruction. The file exists nowhere; `design-canon.md` absorbed and superseded it. |
| 25 | Dangling refs to `DESIGN_integration-shell_v1_0.html` | **FIXED (annotated) + DOCKETED N1.** See the correction below. |
| 26 | Dangling refs to `ZUGZWANG-CD_design-system-editing-manual_v1_0.md` | **FIXED (annotated) ×4 + DOCKETED N1.** |
| 27 | `SPEC.2.md` §0 — "ADRs 0003–0034 (32) folded" | **PARTIAL — annotated, correction DOCKETED N5.** See STOP below. |
| 28 | `poll-contract.test.ts:211` + 4 sibling sites | **OUT-OF-SCOPE → DOCKETED N3.** |

### A correction to the recon's own R3 (finding 25)

R3 reported "five committed design docs plus `mockups/README.md` point at `DESIGN_integration-shell_v1_0.html`" as dangling. **That over-counted.** `design-canon.md` **already handles it correctly** — `:10` calls it *"PK-only — deliberately not committed"* and §8 row 16 reads *"🔒 v1.0 — PK-only by rule · ✕ stays PK"*. Two further hits (`design-handoff.md:137`, `design-workflow.md:39`) reference *"integration-shell v1.0"* as the **name of a lock**, not as a file path — not dangling either. The genuinely unannotated sites were `mockups/README.md` ×2 and `design-language.md:18`. Those were annotated; `design-canon.md` was left alone and is the model the annotations follow.

### STOP taken — SPEC.2 §0 (finding 27)

The work order authorised **§0 metadata only** and instructed a STOP if the correction required a normative edit. **It does.** SPEC.2 §22.1 self-describes as *"The 33-row index"* over *"33 ADRs — 32 ADR files + ADR-0012 in-flight"*, numbering *"0001, (0002 skipped), 0003–0034"*, and §22.5 designates the ADR files as SSOT. **On disk: 0001, (0002 skipped), 0003–0036 — 34 files.** Rewriting §0's range while §22.1 still says 33/0003–0034 would leave SPEC.2 **contradicting itself inside one document** — strictly worse than the present state.

**Taken instead:** a §0-scoped annotation that is true and self-consistent — it names the real ceiling (`0036`), names ADR-0035/0036 as folded into neither §0 nor §22.1, distinguishes *what SPEC.2 has absorbed* (the 32/0003–0034 figures, accurate) from *what exists* (stale), and routes to **N5**. **No number was changed.**

**Second-order finding worth keeping:** SPEC.2 §22's arithmetic is deliberately maintained so the index matches the files on disk — the ADR-0033 index-row-only ruling at BOOKMARK-ADD-WIRE exists *precisely* to preserve that property. **That property is currently broken.**

---

## STEP 4 — the docket

| Action | Row | Outcome |
|---|---|---|
| **CLOSE** | SCAFFOLD.3-FOLLOWUP-1 §0.2 S3 (ADR backfill) | ✅ Closed. Discharged by PR #59 (`7a53341`, 2026-06-02). 14 of 16 named ADRs exist; 0002 + 0012 are permanently unused, not gaps. Its premise — *"On disk: `0001-license-choice.md` only"* — had been false for **two months**. |
| **CORRECT** | SYNC-sweep PAID | Version anchors refreshed: 1.0.14 / 1.0.17 marked historical, live values (1.0.29 / 1.0.22 / cpmm 2.1.0) recorded, with the instruction to read them off the files rather than off the row. Don't-re-pay stands. |
| **DECIDE** | ENGINE.4 OQ-F(b) | **RE-TRIGGERED, new owner needed.** Evidence + reasoning below. |
| **MOVE** | STANDING CHECK (masking) | → `CLAUDE.md` §5.14 SC-1. Row replaced by a moved-to pointer, not deleted. |
| **ORDER** | TRIGGERED set | New **SEQUENCE** table at the head of `parked.md`: 1 PERF-1 · 2 POOL-2 `BETTER_AUTH_SECRET` · 3 POOL-2 Sentry smoke · 4 AUDIT-FIX-B2 OQ-2 · 5 UI-6 Gate C D3, each with owner/gate and why. |
| **OPEN** | N1 · N2 · N3 · N4 · **N5** | Five rows, each with a conditional trigger. N5 is an addition — see Class-1 #7. |
| **REPAIR** | A22 FU-1, FU-2 | Both lacked a `Conditional trigger` line, against the promise at `parked.md:7-8`. Triggers added. |

### The ENGINE.4 OQ-F(b) verdict — **RE-TRIGGER**

**Content check, run against `origin/main` `fecbaf3`:**

- **`docs/specs/SPEC.1.md:69`** — the §2 glossary row still reads *"Open / Closed / Resolving / Resolved / Voided / Frozen | The **six** market lifecycle states"*, column **`markets.state`**. **All three prescribed fixes are un-made**: `Draft` absent, still "six" not "seven", column still `markets.state`. It is **self-contradicted 168 lines later** at `SPEC.1.md:237`, which writes `markets.status` for the same column.
- **`docs/adr/0013-concurrency-bet-transaction.md:318, :320, :321`** — still `markets.state` (3 sites) and `markets.resolving_at` (3 sites). Un-fixed.

**The sharper finding: the trigger was un-fireable from birth.** The row was written at the ENGINE.4 OQ-F ruling on **2026-06-05** with the sole trigger *"PRECURSOR.5 runs."* `docs/logs/PRECURSOR.5.md` is dated **2026-05-14** — **three weeks earlier**. PRECURSOR.5 had already run when the row was filed. A trigger pointing at a completed event never fires, and nothing detects that. **Durable rule, recorded in the row: any docket row whose trigger names a task must be checked against that task's log at filing time.**

**Why SYNC-1 did not simply fix it — see Class-1 #6.**

---

## Class-1 decisions

| # | Decision | Reasoning |
|--:|---|---|
| 1 | **Branched with `git checkout -b … origin/main`**, not by fast-forwarding local `main` | Local `main` was behind (`acd9c15`) after PR #287 merged to `fecbaf3`. Branching directly off the remote ref reaches the right base without mutating `main`, and sidesteps the checkout-then-reset hazard where an aborted checkout aims a `reset --hard` at the wrong branch. Asserted `HEAD == origin/main` after. |
| 2 | **V-n canonical text = the work order's text; existing evidential tails preserved** | The order said both *"write these five verbatim"* and *"number them in place."* Where the canonical text subsumed the existing bullet (V-2, V-4) it replaced it; where the bullet carried extra evidence the canonical text lacked (V-1's "assert against the wire", V-3's guard-surface example, V-4's "cheap tripwire") that tail was kept. Verbatim for the register, non-destructive for the section. |
| 3 | **O-space inserted as a new §8; the closing rule renumbered §8 → §9** | ~19 in-repo references to *"CLAUDE.md §7"* exist (all meaning the cleanup-absorption rule) and **zero** to §8 — verified by grep before deciding. Renumbering §8 breaks nothing; renumbering §7 would break nineteen. The closing rule stays last, where it belongs. |
| 4 | **Masking check filed as a new §5.14, not folded into §5.10** | §5.10 is the **critical-path** pre-PR audit. SC-1 fires on **any** PR touching a `comments` read, critical-path or not. Burying it in §5.10 would narrow its trigger — the precise failure that put it in the docket. |
| 5 | **`STAGING-PARITY-A.md` annotated, not renumbered** | It is a historical session log; rewriting its `L-n` citations would falsify the record of what was believed at close. But leaving five bare `L-n` in the most-cited STAGING-PARITY log would keep the collision live in the exact file a future session greps. A header note maps them (`L-1`→`V-1`, `L-3`→`O-1`, `L-7` slice-local and never promoted) without touching the body. **Beyond the literal instruction — flagged for review.** |
| 6 | **ENGINE.4 OQ-F(b) RE-TRIGGERED, and neither half fixed here** | The ADR-0013 half cannot be a plain body edit — ADRs are immutable (SPEC.2 §22.4), so it needs an in-place **Patch record** per CLAUDE.md §5.12, an ADR-lane action outside a documentation truth pass and against this session's *mint-no-ADRs* posture. The SPEC.1 half is a normative glossary edit whose sibling cannot land in the same commit. **Landing only the SPEC.1 half re-creates the half-fixed state the row already records.** They must land together, under an owner who can take the ADR action. |
| 7 | **N5 opened — a fifth row beyond the four specified** | Discovered while executing 2.7's STOP. CLAUDE.md §5.4 forbids absorbing a surfaced issue silently, and a blocker with a clean conditional trigger belongs in the docket rather than only in a log. **Flagged as a deviation-by-addition** so review can strike it. |
| 8 | **F-DEBATE-4 `:173` task-scoped as well as `:158`** | The order named `:158`. `:173` carries `(L-1)` and `(L-3)` from the *same* audit in the *same* file — the identical defect. Fixing one and leaving the other is the half-fix this whole task exists to eliminate. **Deviation-by-addition, flagged.** |
| 9 | **A22 FU-1 / FU-2 given conditional triggers** | The order noted *"parked.md:7-8 promises one and two existing rows break that promise"* as context. Honouring the header costs two lines and closes the gap the observation names. **Deviation-by-addition, flagged.** |
| 10 | **`design-canon.md` left untouched in the 2.6 sweep** | It already annotates the integration shell as PK-only by rule. Annotating it again would be noise; it is instead the model the other annotations follow. Recorded as a correction to R3's over-count. |
| 11 | **N1 written with its blocking tension stated, not as a clean instruction** | `design-canon.md` §8 row 16 rules the integration shell **"PK-only by rule · ✕ stays PK."** N1 as specified would **reverse a documented canon rule**. The row therefore splits into two decisions — the editing manual (no rule opposes it) and the shell (needs a founder ruling + a same-commit canon amendment, or scope-down). Writing it as a simple do-this would have handed a future session a hidden conflict. |
| 12 | **SPEC.2 §0 annotated rather than left silent** | A pure STOP would leave a reader of §0 believing 0034 is the ceiling. The annotation changes no number, contradicts no normative section, and strictly reduces error — the maximum available inside "§0 metadata only". |

---

## Open questions

1. **N1's canon tension.** Does the integration shell get committed (reversing `design-canon.md` §8 row 16, needing a founder ruling + same-commit canon amendment), or does N1 scope down to the editing manual alone? **Founder call.**
2. **N4 — `visual_precursor_planner.md`.** The PK copy is 6,679 B **larger** than the repo's, and its md5 matches no commit in that file's history. Which is authoritative? Until ruled, neither copy should be edited or re-staged.
3. **Tracker version.** This session wrote `tracker_v20` per the work order. The recon observed `v19` in the PK inventory (plus a v19 close-out). If v20 is not yet cut, `CLAUDE.md` §1 and §7 now name a tracker that does not exist.
4. **N5's owner.** The SPEC.2 §22 fold is cheap if it rides the next SPEC.2 amendment and expensive as its own task. Who takes it?

---

## Next session starts at

**Gate C on this PR.** The diff is at `~/Desktop/SYNC-1-RUN1-diff.md` — upload it as a **file**, do not paste it. After merge, resume at **STEP 5.3**: stage all 22 PK replacements from `origin/main` (**not** from the branch) into `~/Desktop/zz-pk-refresh-SYNC-1/`, re-hash 22/22, and rewrite `MANIFEST-partial.md` as `MANIFEST.md`.

**Then: PERF-1.** It is sequenced above POLISH.1 and is the only GO-LIVE BLOCKER, 38 days from go-live.

---

## Context to preserve

- **The nine-file partial PK stage never happened.** The prior session aborted at its precondition (`HEAD != origin/main` — PR #287 had merged mid-session) and correctly created nothing. `~/Desktop/zz-pk-refresh-SYNC-1/` was created **fresh this session** and currently holds **only `INDEX.md`**. STEP 5.4's "the 9 from the partial stage" premise does not hold; all 22 stage together after merge.
- **`git show origin/main:<path>`, never the working tree** — the branch carries 16 modified files, so a working-tree copy would stage un-merged content into PK.
- **PK destination names are PK convention, not repo basenames.** `docs/plans/UI-A5.md` → `UI-A5-plan.md` (PK already holds `UI-A5.md` = `docs/logs/UI-A5.md`); `docs/specs/SPEC.2.md` → `SPEC_2.md`; `docs/logs/SYNC-1.md` → `SYNC-1-log.md`. A wrong name silently overwrites a different PK file.
- **The recon report is the evidence base** for everything here: `~/Desktop/SYNC-1-recon.md` (R0 ceilings · R1 PK drift 85/19/125 · R2 eviction ruling · R3 work order · R4 L-space · R5 docket).

---

## Time

Single unattended session, 2026-08-08 IST. STEP 0 → STEP 5.2 complete; STEP 5.3/5.4 blocked on merge by design.

---

*Per CLAUDE.md §5.9. Written before the PR opened, in its own commit.*
