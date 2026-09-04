# ZUGZWANG · OPERATING MODEL

**Version** 3.0 · **Supersedes** `docs/operating/OPERATING-v2.0.md` (2026-08-09, preserved as a record)
**Status** RATIFIED 2026-09-04 by the founder · §1, §3 and §4 ratified explicitly
**Scope** the Experiment phase, through 2026-11-05 · **Recorded as** decision record D-15

> **What this is.** How work is decided and executed in this project: who decides what, which
> rituals survive, and the failure modes that have actually cost us something.
>
> **What this is not.** A register, a spec, or a tracker. Registers live in the repository and are
> pointed at here, never restated — restating one is what produced the namespace collision that cost
> a day. Product rules live in `SPEC.1` and `SPEC.2`. Sequencing lives in the tracker.
>
> **What changed from v2.0.** v2.0 was written for one founder relaying to one executor. There are
> now lanes with leads. The change is §3: the founder's ratification moves from *everything* to a
> named reserved list, and everything else is the lane lead's call. §4 narrows the critical paths.
> §6 flips delegated execution from forbidden-by-default to permitted-off-the-critical-path. §12 is
> new. Everything else is carried forward because it was earned.

---

## §1 · The five locks

These are not process. They define what the dataset measures on 5 November; loosen one and
`K·n > C` is no longer what was tested. **Nothing in this document applies to them, and no lane
lead may weaken one.** Changing any of them is a founder decision requiring its own ADR.

| # | Lock |
|--:|---|
| 1 | **Dharma is soulbound.** Non-transferable. No transfer path exists, by data model, not by check |
| 2 | **Mandatory commentary.** Every bet carries an argument; a reply *is* a Support/Counter bet. No comment-free buy, no stake-free comment. Selling is the only comment-free action |
| 3 | **Append-only, frozen at resolution.** The ledger is never mutated in place; resolved state is not admin-rewritable. History is never rewritten and a resolved market is never un-frozen |
| 4 | **Admin is not a participant.** No user row, no position, no bet, no comment. Structural, at the data model |
| 5 | **Moderation is safety-critical.** The image and CSAM path fails closed and is never bypassed, disabled, or made optional |

---

## §2 · Roles

| Role | Owns | Cannot |
|---|---|---|
| **Founder** | The reserved list in §3. Product direction, thesis, market questions | — |
| **Lane lead** | Everything in their lane not reserved in §3. Approach, sequencing, review, deploys, tooling | Touch a §1 lock or a §3 item without the founder |
| **Contributor** | Execution inside a lane, to the lane lead's review | Merge their own work on a critical path |
| **Web Claude** | Prescriptive documents, architecture, review, sequencing for the founder's lane. **Runs no commands** | Execute; ratify |
| **Claude Code** | Execution. Commands, code, descriptive documents from the repository | Edit a walled document; act outside a stated wall |

**Lanes.** Product · Scale and platform · Campaign · Social-media tech · Documentation and specs.
*(Names and capacity per lane are filled by the founder and live in the tracker, not here — this
document defines the roles, the tracker assigns them.)*

---

## §3 · What the founder decides

**Reserved — cannot be delegated, no exceptions, no urgency override.**

| # | Reserved |
|--:|---|
| 1 | Anything touching a §1 lock |
| 2 | Schema changes and migrations against **production** |
| 3 | The production promote, market resolution, and the freeze |
| 4 | Market questions and resolution criteria — publishing these before the window is what makes the experiment falsifiable |
| 5 | Money: spend, vendors, contracts |
| 6 | Anything irreversible: deleting participant data, publishing the dataset, archiving the repository |
| 7 | Reopening a ruling in the decision record |

**Delegated — the lane lead decides and does not wait.**

Implementation approach within a ratified spec · deploys during the live window · infrastructure
sizing and scaling · test strategy · which reviewer to run · whether to use delegated execution ·
triage and priority within the lane · content scheduling inside a ratified campaign spec · staging
resets · tooling and dependency choices that do not change a vendor.

**The rule underneath both lists.** A decision is reserved when it is irreversible, when it touches
the thesis, or when it costs money. Everything else is reversible, and a reversible decision made
quickly by the person closest to it beats a correct one made three days later.

---

## §4 · The critical paths

Narrowed from nine server directories to seven areas. The test is not "is this backend" but
**"can a mistake here corrupt the ledger, admit a participant who should not exist, or publish
something that cannot be recalled."**

| # | Area | Why |
|--:|---|---|
| 1 | Bet placement and sell | Money and the atomicity invariant |
| 2 | The Dharma ledger and its total order | Append-only; a mistake is unrecoverable |
| 3 | Resolution, payouts, freeze | Irreversible by design |
| 4 | Authentication and sessions | Admits participants |
| 5 | Moderation — both paths | Safety-critical; §1 lock 5 |
| 6 | The identity pool | Pseudonymity, and it feeds the published dataset |
| 7 | Schema and migrations | Irreversible against real rows |

Everything else — surfaces, discovery, profile, charts, admin read views, documentation, tooling,
observability — is **ordinary work**: normal branch, lane-lead review, merge.

---

## §5 · Gates

| Gate | Critical path (§4) | Ordinary work |
|---|---|---|
| **Spec or ADR before code** | Required | A plan comment in the pull request is enough |
| **Plan-then-execute** | Required. Plan in one session, reviewed, executed in a fresh one | Not required |
| **Reviewer pass** | Required — the reviewer named by the lane lead | Lane lead's call |
| **Pre-merge diff read** | Lane lead. **Founder only where §3 applies** | Lane lead |
| **Delegated execution (§6)** | Never | Permitted |

**Same-commit doctrine, unchanged.** A spec rider, its ADR and the governing code land together.
ADRs are immutable — a changed consequence takes an in-place patch record. Landing one half of a
two-document correction recreates the half-fix it was meant to close.

**Diffs travel as an uploaded file, never as terminal paste.** Five transmission failures
established this and none of them announced itself.

---

## §6 · Delegated execution

Parallel, auto-orchestrated execution is **permitted by default** for work that meets all four:

1. Off every §4 critical path
2. Fully reversible — a revert restores the prior state
3. Genuinely independent units, with no ordered proof obligation between them
4. No DDL, no production write, no secret read

It is **forbidden** on the seven critical paths regardless of model, window pressure, or how small
the change looks. That prohibition does not relax, and it is the one line in this section that a
lane lead may not override.

---

## §7 · Where truth lives

**GitHub is canonical.** Project knowledge is a mirror and lags. Generated memory lags further. A
snapshot is never a live source, however carefully it was made.

**Precedence:** `SPEC.1` → `SPEC.2` → ADRs → tracker. The tracker sequences; it does not rule.

**One exception, load-bearing.** Code state comes from the repository — but **ruling state comes
from the decision record and the tracker lineage, and nothing else carries it.** Three consecutive
tracker rewrites each took their ground from the repository and working memory, and each reopened
rulings a prior tracker had correctly closed. A row moving from closed to open must cite the
evidence that reopened it.

**Document flow.** Descriptive documents — README, `AGENTS.md`, schema and file maps, the lane
records — are executor-authored from the repository and web-reviewed. Prescriptive documents —
ADRs, specs, the tracker, this document — are web-authored and executor-committed.

---

## §8 · The registers — pointers only

| Register | Home | Scope |
|---|---|---|
| **V-n** | `docs/polish/POLISH-0_data-manifest.md` §5 | Verification discipline |
| **O-n** | `CLAUDE.md` §8 | Operating discipline for the executor |
| **L-n** | `docs/polish/POLISH-register-ADDITIONS.md` | Reviewer LOW findings |
| **Task-scoped `L-n`** | the originating record | Always cited **with** its task, never bare |
| **INV-1…INV-4** | `SPEC.2` · `docs/records/ENGINE-record.md` | Cannot be weakened by any lane |

**Every register lives in the repository.** A register defined in a mirror-only document cannot be
adjudicated by `main`, which is exactly how three bare namespaces came to collide.

---

## §9 · Transmission

| Direction | Rule |
|---|---|
| Web → executor | One clean, copy-pastable relay block per reply. The exact instruction, nothing to edit |
| Executor → web | A `.md` file written incrementally first; the inline reply is a headline of ten lines or fewer. Line counts and hashes are **measured**, never asserted |
| Diffs, either way | **Uploaded file. Never terminal paste** |
| Web → founder | One consolidated `## Operator actions` table, absolutely last. Every action is a row; none lives only in prose |
| Deliverables | A downloadable file, with a short pointer in the reply |

---

## §10 · Project knowledge

**⚠ The mirror can hold more than one record at a single path, and the panel shows one.** Reads and
deletes both collapse silently to the newest, so a delete looks like it worked and the name
reappears. A filename census and a record census are different measurements.

Three consequences, each earned:

1. A hash sweep proves a **staged** file is correct. It proves nothing about a stale twin at the
   same path.
2. Purge each duplicated path to **zero**, then re-drag. "Keep the newest, delete the older" is
   unexecutable, because delete removes the newest.
3. **Anything that exists only in the mirror goes to the repository before the purge.** This was
   learned by destroying a file.

**What belongs in the mirror:** what a future session must *read to decide*. Anything a session
would instead verify against the live repository does not belong. Session logs and close-out
documents no longer exist in this project — the lane records and the commit log are the record.

**The executor never deletes from the mirror.** It stages a hash-verified folder; the founder drags.

---

## §11 · Failure modes with names

Each of these cost something. They are stated as rules because the abstraction is what transfers.

| # | Rule |
|--:|---|
| 1 | **A negative assertion needs a positive control, and the control must span the failure class.** Proving a listing can refresh is not proving it can enumerate |
| 2 | **A green gate can be blind.** Verify non-vacuously or do not claim the verification. A gate that inspected none of the changed files is not a receipt |
| 3 | **An empty diff is a comparison, not a receipt.** Verify a change landed by grepping the changed line on `main` |
| 4 | **A listed dependency is not a completed one.** Verify both that prerequisites are done *and* that the work is not already done, against the live repository |
| 5 | **No number is copied from prose.** Ceilings, counts and versions are measured at the moment of use, with the command shown. This rule has been broken at five consecutive passes by documents that themselves contained it |
| 6 | **A citation names a symbol; a line number is a convenience and decays.** A merge underneath a document moves its line numbers without touching its words |
| 7 | **A reconstruction is not the artifact.** Restore the original. Where none exists, say so and write nothing — no approximation, and never "regenerated" where the truth is "restored" |
| 8 | **A spec↔spec or spec↔tree disagreement is reported, never resolved mid-task.** It is a finding for the founder, not a judgement call for the executor |
| 9 | **Findings are recorded, not silently fixed.** A document that quietly disagrees with the thing it describes is worse than one that flags the gap |
| 10 | **A partial fix that reads as complete is worse than none.** Say which sites were closed and which were not |

---

## §12 · The live window — what changes on 15 September

| | |
|---|---|
| **Deploys** | Permitted, at the lane lead's discretion. No freeze on shipping |
| **Schema and migrations** | Founder-reserved. Real participant rows; irreversible |
| **The ledger** | Append-only means there is no data fix. A wrong bet stays and is corrected forward, never edited |
| **Resolution and freeze** | Founder only, on the published criteria, without exception |
| **Moderation** | The queue is attended daily. §1 lock 5 has no window exemption |
| **The dataset** | Nothing is published before 5 November 23:59 UTC. Publication is founder-reserved |
| **Escalation** | Anything reserved in §3, any suspected data corruption, any moderation failure — straight to the founder, no queue |

---

## §13 · How a session runs

Open with the objective, the exit criterion, the roles, numbered steps, and a **not-doing** list.
Read the task-relevant documents first; surface what you need rather than assuming it.

Every reply opens with a plain-language summary. One sub-part per reply. Questions arrive in a
table with a recommendation. Full files, never diffs, unless a diff is asked for.

**Escalate first.** On deadline risk, a thesis violation, a security issue, or an irreversible
decision being rushed, the escalation leads the reply — not the answer.

**Own errors explicitly.** A report claiming none is less trustworthy than one reporting three.

---

## §14 · Amendment

Amend by pull request. §1, §3 and §4 require founder ratification; every other section may be
amended by a lane lead with the founder notified. Every amendment carries a decision record entry —
a rule that changed without a recorded ruling is a rule nobody can date.

*End operating model v3.0.*
