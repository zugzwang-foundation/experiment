# `docs/decisions/` — preserved records

**These are preserved records, not living documents.** Everything here was authored outside the
repository — in a chat, a design tool, or a working session — and is committed **byte-for-byte, as
it stood on the day it was written**. Nothing in this directory is maintained: a record is not
corrected when the world moves past it, not reformatted, not renumbered, and not brought into line
with a later decision. If it says something that is no longer true, that is the record doing its
job, and the correction belongs in the document that superseded it.

That is what separates this directory from `docs/adr/` and `docs/records/`. An ADR is a decision
the repository still stands behind and amends in place; a `docs/records/` lane record is
**regenerated** from code and the commit log whenever it drifts. A preserved record can do neither,
because its value is that it is evidence of what was decided *then* — and evidence you are willing
to edit is not evidence.

**Reading one:** check the `Superseded by` column first. Then read it as dated material. Where a
preserved record and a spec disagree, the spec wins (`CLAUDE.md` §1) — the record is telling you
what was believed, not what is true.

| File | What it records | Date | Superseded by |
|---|---|---|---|
| `RECORD-v2.0.md` | **ZUGZWANG · DECISION RECORD.** How Hrishikesh ruled on every capacity, cost and degradation question raised during hardening, so no ruling has to be re-derived from a conversation. Its own status line: *15 numbered · 2 collapsed · 13 live, all ruled · 2 accepted without measurement · 0 open* | Opened **2026-08-23**, last ruling **2026-09-03** | — (current) |
| `../operating/OPERATING-v2.0.md` | **ZUGZWANG · OPERATING PLAN.** The durable method for running a task here — roles, gates, transmission, and the failure modes that have actually bitten. Filed under `docs/operating/`, not here, because it is a method in use rather than a record of a past decision | **2026-08-09**, at the SYNC-1 close | — (current); it supersedes `STAGING-PARITY_operating-plan_v1_0.md` |

⚠ **`RECORD-v2.0.md` has a v1.0, and it is deliberately not in this repository.**
`~/Downloads/ZUGZWANG_DECISION-RECORD_v1_0.md` (34,990 bytes, 2026-08-25, *"3 of 13 frozen · 1
partial · 9 open"*) exists on the operator's machine only. SYNC-6 · PRESERVE was asked for v2.0,
found only v1.0, and **declined to commit it at a path named v2.0** — a preserved record that lies
in its own filename is worse than a visible gap. v2.0 arrived at SYNC-6 · PRESERVE-2 and is the row
above. **v1.0 was still not committed**, because it is superseded rather than lost: v2.0 carries
the same scope with every ruling closed, so preserving the earlier draft would add a document whose
only distinguishing content is a set of open questions that are now answered. If the intermediate
state is ever wanted as evidence, it is one `cp` away and this paragraph says where.

⚠ **`OPERATING-v2.0.md` closes a finding `CLAUDE.md` §8 names by file.** Its predecessor,
`STAGING-PARITY_operating-plan_v1_0.md`, was **project-knowledge only and never on `main`** — and
V-1…V-5 were numbered against it, so a repo-side reader found every citation and no definition.
That is the founding case for O-space being committed in the repo at all. v2.0 is now on `main`,
and it **does not repeat the mistake**: its own §4 carries pointers to the registers and restates
none of them, on the stated grounds that *"a register in a PK-only document cannot be defined or
adjudicated by `main`."*

### How this directory came to exist

SYNC-6 · PRESERVE created it and could not fill it. It was asked to commit
`ZUGZWANG_DECISION-RECORD_v2_0.md`; a depth-6 search of the operator's machine found only **v1.0**,
and v1.0 was **not** filed at a path whose name asserts v2.0 — a preserved record that lies in its
own filename is worse than a visible gap, because the gap is discoverable and the mislabel is not.
So the directory shipped with a README, no records, and precise instructions for closing it.

SYNC-6 · PRESERVE-2 closed it: v2.0 was produced, its md5 verified against the value the task
carried **before the file was read**, and committed unchanged. **The gap was closed by the record
arriving, not by the standard moving** — which is the only reason the empty README was worth
shipping.

The other three records SYNC-6 · PRESERVE was given were design artifacts and live in
`docs/design/` — `integration-shell-v1.0.html`, `editing-manual.md`, `W2-13-share-card-copy.txt`.
