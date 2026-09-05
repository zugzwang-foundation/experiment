# ZUGZWANG · OPERATING MODEL

**Version** 3.1 · ratified 2026-09-04 · **Recorded as** D-15, amended by D-20, D-22, D-25
**Supersedes** `OPERATING-v2.0.md` (preserved) · **Scope** the Experiment phase, to 2026-11-05

> How work is decided and executed: who decides what, which rituals survive, and the failure
> modes that cost us something. Not a register, not a spec, not a tracker — those are pointed at.

---

## §1 · The five locks

These define what the dataset measures. Loosen one and `K·n > C` is not what was tested. Nothing
in this document applies to them; changing one needs its own ADR.

| # | Lock |
|--:|---|
| 1 | **Dharma is soulbound.** No transfer path exists, by data model, not by check |
| 2 | **Mandatory commentary.** Every bet carries an argument; a reply *is* a Support/Counter bet. Selling is the only comment-free action |
| 3 | **Append-only, frozen at resolution.** The ledger is never mutated in place. History is never rewritten; a resolved market is never un-frozen |
| 4 | **Admin is not a participant.** No user row, no position, no bet, no comment. Structural |
| 5 | **Nothing is served unscreened.** Image screening is never bypassed, disabled or made optional. ⚠ Per D-20 it never *blocks a post* either — screening runs during composition, and a failed image is dropped while the post publishes |

## §2 · Roles

| Role | Owns | Cannot |
|---|---|---|
| **Founder** | §3's reserved list. Product direction, thesis, market questions | — |
| **Lane lead** | Everything in-lane not reserved. Approach, sequencing, review, deploys, tooling | Touch a lock or a §3 item alone |
| **Contributor** | Execution, to the lane lead's review | Merge own work on a critical path |
| **Web Claude** | Prescriptive documents, architecture, review, sequencing. **Runs no commands** | Execute; ratify |
| **Claude Code** | Execution. Commands, code, descriptive documents from the repository | Edit a walled document; act outside a stated wall |

Lanes: product · scale and platform · campaign · social-media tech · documentation and specs.
The tracker assigns them; this document defines the roles.

## §3 · What the founder decides

**Reserved — no delegation, no urgency override.** Anything touching a §1 lock · schema and
migrations against **production** · the promote, resolution and freeze · market questions and
resolution criteria · money · anything irreversible (deleting participant data, publishing the
dataset) · reopening a ruling.

**Delegated — the lane lead decides and does not wait.** Implementation approach inside a ratified
spec · deploys during the live window · infrastructure sizing · test strategy · which reviewer runs
· delegated execution · triage and priority · content scheduling inside a ratified campaign spec ·
staging resets · tooling.

**The rule underneath.** Reserved when irreversible, thesis-touching, or costly. Everything else is
reversible, and a reversible decision made quickly by the person closest to it beats a correct one
made three days later.

## §4 · The critical paths

Not "is this backend" but **"can a mistake here corrupt the ledger, admit a participant who should
not exist, or publish something that cannot be recalled."**

Bet placement and sell · the Dharma ledger and its total order · resolution, payouts and freeze ·
authentication and sessions · moderation, both paths · the identity pool · schema and migrations.

Everything else — surfaces, discovery, profile, charts, admin read views, tooling, observability —
is ordinary work: branch, lane-lead review, merge.

## §5 · Gates

| Gate | Critical path | Ordinary |
|---|---|---|
| Spec or ADR before code | Required | A plan comment in the PR |
| Plan-then-execute | Required — plan, review, execute in a fresh session | Not required |
| Reviewer pass | Required; the lane lead names the reviewer | Lane lead's call |
| Pre-merge diff read | Lane lead. **Founder only where §3 applies** | Lane lead |
| Delegated execution (§6) | Never | Permitted |

**Same-commit doctrine.** A spec rider, its ADR and the governing code land together. ADRs are
immutable; a changed consequence takes an in-place patch record. Landing half of a two-document
correction recreates the half-fix it was meant to close.

**Diffs travel as an uploaded file, never as terminal paste.** Five transmission failures
established this and none announced itself.

## §6 · Delegated execution

**Permitted by default** where all four hold: off every §4 area · fully reversible · genuinely
independent units with no ordered proof obligation · no DDL, no production write, no secret read.

**Forbidden on the seven areas** regardless of model, window pressure, or apparent size. Not a lane
lead's to override.

## §7 · Where truth lives

**GitHub is canonical.** Project knowledge is a mirror and lags. Generated memory lags further.

**Precedence (D-22): decision record → `SPEC.1` → `SPEC.2` → ADRs → tracker.** The record ranks
first because it was written when the goal was clear; the ADRs were written at genesis, before it
was. **A ruling obliges an amendment** — binding, and the amendment is the work item that makes it
findable. ADRs are corrected by surgical edit against the record, never rewritten.

**Ruling state comes from the decision record and the tracker lineage, and nothing else carries
it.** Three consecutive tracker rewrites took their ground from the repository and reopened rulings
a prior tracker had correctly closed. A row moving from closed to open cites the evidence.

**Document flow.** Descriptive documents — README, `AGENTS.md`, schema and file maps, lane records
— are executor-authored from the repository, web-reviewed. Prescriptive — ADRs, specs, the tracker,
this document — are web-authored, executor-committed.

## §8 · The registers — pointers only

`V-n` → `POLISH-0_data-manifest.md` §5 · `O-n` → `CLAUDE.md` §8 · `L-n` →
`POLISH-register-ADDITIONS.md` · task-scoped `L-n` cited **with** its task · `INV-1…4` → `SPEC.2`,
`ENGINE-record.md`.

Every register lives in the repository. A register defined in a mirror-only document cannot be
adjudicated by `main` — which is how three bare namespaces came to collide.

## §9 · Transmission

Web → executor: one copy-pastable relay per reply. Executor → web: a `.md` written incrementally
first, inline reply a headline of ten lines or fewer, counts and hashes **measured**. Diffs either
way: **uploaded file, never terminal paste**. Web → founder: one consolidated `## Operator actions`
table, absolutely last, every action a row.

## §10 · Project knowledge

**⚠ The mirror can hold more than one record at a single path and shows one.** Reads and deletes
collapse to the newest, so a delete looks like it worked and the name reappears.

1. A hash sweep proves a **staged** file is correct. It proves nothing about a stale twin.
2. Purge each duplicated path to **zero**, then re-drag.
3. **Anything existing only in the mirror goes to the repository before the purge.** Learned by
   destroying a file.

**What belongs:** what a session must read *to decide*. Not what it would verify against the
repository. Session logs and close-outs no longer exist here — the lane records and the commit log
are the record. **The executor never deletes from the mirror**; it stages, the founder drags.

## §11 · Failure modes with names

| # | Rule |
|--:|---|
| 1 | **A negative assertion needs a positive control**, spanning the failure class |
| 2 | **A green gate can be blind.** A gate that inspected none of the changed files is not a receipt |
| 3 | **An empty diff is a comparison, not a receipt.** Grep the changed line on `main` |
| 4 | **A listed dependency is not a completed one.** Verify prerequisites are done *and* the work is not already done |
| 5 | **No number is copied from prose.** Measured at the moment of use, command shown. Broken at five consecutive passes by documents containing the rule |
| 6 | **A citation names a symbol.** A merge underneath a document moves its line numbers without touching its words |
| 7 | **A reconstruction is not the artifact.** Restore, or say so and write nothing |
| 8 | **A spec↔spec or spec↔tree disagreement is reported, never resolved mid-task** |
| 9 | **Findings are recorded, not silently fixed** |
| 10 | **A partial fix that reads as complete is worse than none** |
| 11 | **A count with no way to say when it was true will go stale.** Write the command, not the number |

## §12 · The live window, from 15 September

Deploys: permitted, lane lead's discretion. Schema and migrations: founder-reserved; the rows are
real. The ledger is append-only, so **there is no data fix** — a wrong bet is corrected forward.
Resolution and freeze: founder only, on the published criteria. Moderation: advisory per D-20, and
the queue is attended daily. The dataset publishes nothing before 5 November 23:59 UTC. Escalation:
anything reserved, any suspected corruption, any moderation failure — straight to the founder.

## §13 · How a session runs

Open with objective, exit criterion, roles, numbered steps, and a **not-doing** list. Read the
task-relevant documents first. Every reply opens with a plain-language summary; one sub-part per
reply; questions in a table with a recommendation; full files, not diffs.

**Escalate first.** On deadline risk, a thesis violation, a security issue, or an irreversible
decision being rushed, the escalation leads the reply.

**Own errors explicitly.** A report claiming none is less trustworthy than one reporting three.

## §14 · Amendment

By pull request. §1, §3 and §4 need founder ratification; other sections may be amended by a lane
lead with the founder notified. Every amendment carries a decision record entry — a rule that
changed without a recorded ruling is a rule nobody can date.
