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
| — | — | — | — |

⛔ **The directory is empty of records, and that is a finding rather than an oversight.**
SYNC-6 · PRESERVE was asked to commit **`ZUGZWANG_DECISION-RECORD_v2_0.md`** here as
`RECORD-v2.0.md`. **That file exists nowhere on the operator's machine.** A depth-6 search of the
home directory returns exactly one member of the family —
`~/Downloads/ZUGZWANG_DECISION-RECORD_v1_0.md` (34,990 bytes, 2026-08-25, *"3 of 13 frozen · 1
partial · 9 open"*) — and **v1.0 was deliberately not committed in its place.** Filing v1.0 at a
path whose name asserts v2.0 would mint a preserved record that lies in its filename, which is a
worse outcome than a visible gap: the gap is discoverable and the mislabel is not.

⇒ **To close this:** commit `ZUGZWANG_DECISION-RECORD_v2_0.md` here as `RECORD-v2.0.md` when it can
be produced, or rule that v1.0 should be preserved as `RECORD-v1.0.md` instead. Either way, add its
row above. The other three records SYNC-6 · PRESERVE was given were design artifacts and live in
`docs/design/` — `integration-shell-v1.0.html`, `editing-manual.md`, `W2-13-share-card-copy.txt`.
