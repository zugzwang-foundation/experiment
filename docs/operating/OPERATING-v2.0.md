# ZUGZWANG · OPERATING PLAN v2.0

> **Supersedes:** `STAGING-PARITY_operating-plan_v1_0.md` · **Authored:** 2026-08-09 at the SYNC-1 close
> **What this is.** The durable method for running a task in this project — roles, gates, transmission, and the failure modes that have actually bitten.
> **What this is not.** A register. V-space, O-space and L-space live in the repo; this document points at them and never restates them. Restating a register in a second document is what produced the L-space collision SYNC-1 spent a day untangling.

---

## §1 · Roles

| | |
|---|---|
| **Web Claude** | Orchestrator and reviewer. Gates decisions, sequences work, authors prescriptive documents, reads every diff at Gate C. **Runs no commands.** |
| **Claude Code** | Executor. Runs commands, writes code, authors descriptive documents and session logs from its own context. |
| **Cowork** | Operates surfaces neither of the above can reach — chiefly the project-knowledge panel. |
| **Hrishikesh** | Operator and founder. Dashboards, relay, ratification. The only party who can see a rendered page or a vendor console. |

One task per chat. Web Claude flags when a task should split — at kickoff or mid-task — before compaction forces it.

---

## §2 · Gates

**Plan-then-execute** for anything touching `src/`, `drizzle/`, an ADR or a spec. CC writes the plan in one chat; web reviews; the operator ratifies; a **fresh chat** executes from the committed plan.

**The four critical paths — auth, bet engine, ledger, commentary/moderation — plus any DDL or migration** keep the full gated cascade regardless of model, window pressure or how small the change looks. `ultracode` and auto-orchestrated workflows are the default for ordinary reversible parallelizable work and are **never** used there.

**Gate C** is a web diff-read before merge, and the diff arrives as an **uploaded file**. Not terminal paste. Five transmission failures established this.

**Same-commit doctrine.** Spec riders, ADRs and the governing code land together. ADRs are immutable: a changed consequence takes an in-place **Patch record**, and landing one half of a two-document correction recreates the half-fix it was meant to close.

---

## §3 · Where truth lives

**GitHub is canonical.** Project knowledge is its mirror and lags. Generated memory lags further. The tracker is the sequencer, not a spec.

**Precedence:** SPEC.1 / SPEC.2 › ADRs › tracker.

**One exception, and it is load-bearing.** Code state comes from the repo — but **ruling state and operator-side provisioning state come from the tracker lineage and nothing else carries them.** v17 was right about four rulings that v18 and v19r1 wrongly reopened, because each rewrite took its ground from the repo and from working memory and neither re-read the prior tracker's own rulings. At every sweep, diff the new status map against the previous two trackers' closed rows; a row moving ✅ → open must cite the evidence that reopened it.

**Doc flow.** Descriptive documents — README, AGENTS, schema and file maps — are CC-authored from the repo and web-reviewed. Prescriptive documents — ADRs, specs, tracker — are web-authored and CC-committed.

---

## §4 · The registers — pointers only

| Register | Home | Scope |
|---|---|---|
| **V-1…V-5** | `docs/polish/POLISH-0_data-manifest.md` §5 | Verification discipline |
| **O-1…O-3** | `CLAUDE.md` §8 | Operating discipline |
| **L-1…L-9** | `docs/polish/POLISH-register-ADDITIONS.md` | Gate C reviewer LOW findings |
| **Task-scoped `L-n`** | the originating log | Security-auditor LOWs. Always cited **with** their task — "F-DEBATE-4 L-2", never bare |
| **INV-1…INV-4** | `SPEC.2` · ENGINE phase record | Cannot be weakened by any lane |

**Every register lives in the repo.** A register in a PK-only document cannot be defined or adjudicated by `main`, which is precisely how three bare `L-n` namespaces came to collide.

**Candidate V-6, offered and not ruled:** a reconstruction does not merely omit; it can **assert**. A regenerated index recorded a surface as having "no POLISH row" where the original documented it precisely. V-1 covers insufficiency, not confident negatives manufactured to fill a gap.

---

## §5 · Transmission

| Direction | Rule |
|---|---|
| Web → CC | Every reply ends in a clean copy-pastable relay block: the exact instruction, nothing to edit |
| CC → web | Inline by default. Web requests an `.md` scratchpad only for output it must analyse |
| **Diffs, either way** | **Uploaded file. Never terminal paste.** |
| Web → operator | One consolidated `## Operator actions` table, absolutely last. Every action appears as a row — none lives only in prose |
| Deliverables | Downloadable `.md` to outputs, with a short in-chat pointer |

---

## §6 · Project knowledge

**⚠ PK can hold more than one record at a single identical path, and the panel shows one.** Six such paths existed at SYNC-1, one a triple. `project_read` and `project_delete` both silently collapse to the newest record with no signal that others exist — so a delete looks like it worked and the name reappears.

**A filename census and a record census are different measurements.** Any name-deduped listing — including a mounted snapshot, which also appears to normalise `.` to `_` in filename stems — undercounts records and surfaces the *oldest* record at a duplicated path.

Three consequences, each earned:

1. An md5 sweep proves a **staged** file is correct. It proves nothing about a stale twin at the same path.
2. Purge each duplicated path to **zero**, then re-drag a known-good copy. "Keep the newest, delete the older" is unexecutable, because delete removes the newest.
3. **Dump PK-only files to disk before purging.** A purge-to-zero of a file absent from the repo destroys it. This was learned by destroying one.

**What belongs in PK:** what a future session must *read to decide*. Anything a session would instead verify against the live repo does not belong — GitHub is canonical and PK is the mirror, not a second copy. Rolling-3 window for task logs. Staged copies come from `origin/main` post-merge into `~/Desktop/zz-pk-refresh-<TASK.ID>/`, md5-verified, for the operator to drag in. **CC never deletes PK.**

**Destination filenames are PK convention, not repo basenames.** `docs/plans/UI-A5.md` stages as `UI-A5-plan.md`, because PK already holds `UI-A5.md`, which is the *log*. A mechanical basename copy silently overwrites a different document.

---

## §7 · Failure modes with names

**A snapshot is never a live source, however carefully it was made.** The SYNC-1 inventory was treated as ground truth three separate times and was wrong each time. That is O-2 in a new costume, and the fix is to say so **on the artifact** when handing it over.

**A negative assertion needs a positive control — and the control must span the failure class.** Asserting a file absent from a listing proves nothing without first proving the listing can see files of that kind. Testing whether an instrument *refreshes* is not testing whether it *enumerates*; claiming coverage for both from one control is V-5 at the tooling layer.

**A reconstruction is not the artifact.** Restore the original where one exists. Where none does, say so plainly and write nothing — no approximation, no placeholder, and never "regenerated" in a provenance record when the truth is "restored".

**A green gate can be blind.** Four instances in POLISH.1 alone. Verify non-vacuously or do not claim the verification.

**A listed dependency is not a completed one.** Verify both that prerequisites are done *and* that the candidate is not already done, against the live repo, before naming or planning a task.

---

## §8 · Chat shape

Open with scope framing — objective and exit criterion, the three roles, numbered kickoff-to-close steps, and the **not-doing** list — then wait for alignment. Read the task-relevant documents first; surface a research-needs list rather than assuming; ask CC to retrieve from the live repo where PK is unclear.

Every reply opens with `## Summary` in plain language. One sub-part per reply. Questions arrive in a table with recommendations. Full files, never diffs, unless a diff is asked for.

**Escalate first.** On deadline risk, a thesis violation, a security issue, or an irreversible decision being rushed, the escalation leads the reply — not the answer.

Close by verifying the tracker, staging the PK refresh, and writing the close-out. **Own errors explicitly**; a close-out without an error section on a task this long is not a close-out.

*End operating plan v2.0.*
