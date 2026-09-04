# DECISION RECORD — amendment 2.1

**Amends** `docs/decisions/RECORD-v2.0.md` (preserved; not edited)
**Opened** 2026-09-04 · **Rulings** D-15 … D-19
**Numbering** continues from the record's own ceiling: v2.0 carries D-0 … D-14, so the next free
number is D-15. Measured from the record's §0 header, not assumed.

> **Why an amendment and not an edit.** `RECORD-v2.0.md` is a preserved record. Records are not
> rewritten in place — a changed consequence takes an amendment, exactly as an ADR takes a patch.
> Editing it would destroy the evidence of what was ruled and when.

---

## D-15 · The operating model is v3.0, and it supersedes D-13

**Ruled** 2026-09-04 · **Supersedes** D-13 (2026-09-03, live-window ownership)

D-13 ruled that the founder owns live-window capacity with no rota. That was correct for a solo
operator and is wrong now that lanes have leads.

**Ruling.** `docs/operating/OPERATING.md` v3.0 is the operating model. §3 reserves seven classes of
decision to the founder — the five locks, production schema, the promote and resolution and freeze,
market questions and resolution criteria, money, irreversible actions, and reopening a ruling.
**Everything else is the lane lead's call, decided without waiting.**

**Enforced at** `docs/operating/OPERATING.md` §3.

---

## D-16 · The critical paths are seven areas, not nine directories

**Ruled** 2026-09-04

The prior list enumerated server directories, which made "is this backend" the test. The test is now
**"can a mistake here corrupt the ledger, admit a participant who should not exist, or publish
something that cannot be recalled."**

**Ruling.** Seven areas: bet placement and sell · the Dharma ledger and its total order · resolution,
payouts and freeze · authentication and sessions · moderation, both paths · the identity pool ·
schema and migrations. Everything else is ordinary work — branch, lane-lead review, merge.

**Enforced at** `OPERATING.md` §4 · to be reflected in `CLAUDE.md` at the core-doc review.

---

## D-17 · Delegated parallel execution is permitted off the critical path

**Ruled** 2026-09-04 · **Reverses** the prior forbidden-by-default posture

**Ruling.** Permitted by default where all four hold: off every D-16 area · fully reversible ·
genuinely independent units with no ordered proof obligation · no DDL, no production write, no
secret read. **Forbidden on the seven areas regardless of model, window pressure, or apparent
size**, and that prohibition is not a lane lead's to override.

**Enforced at** `OPERATING.md` §6.

---

## D-18 · Close-out documents are abolished

**Ruled** 2026-09-04

366 log and plan documents recorded how the product was built, in the order it was built. Nobody
entering the production window can read them and nobody should have to.

**Ruling.** Session logs and close-out documents are not written. `docs/records/` plus the commit
log are the record. 202 files were deleted at SYNC-6; the remaining 166 are kept only where the work
is unmerged or a live document references them, and none is mirrored into project knowledge.

**Enforced at** `OPERATING.md` §10 · `docs/records/README.md`.

---

## D-19 · A citation names a symbol; a line number is a convenience

**Ruled** 2026-09-04

Two citations written correctly on 3 September were wrong on 4 September, because a pull request
merged underneath them and moved the lines. No discipline in this repository supplied a way for a
citation to say which commit it was true at.

**Ruling.** Where a citation points at a definition, it names the symbol alongside the line. Where
it points at an assertion inside a test, or at a line whose content is the claim, there is nothing
to anchor to and the line stands alone.

**Enforced at** `OPERATING.md` §11 rule 6 · `docs/records/README.md` rule 5.

---

## Note on identifier hygiene

The programme tracker carries its own `D-n` column for open decisions. **That is a second `D-n`
namespace and it collides with this one.** The tracker's is renamed to `Q-n` at its next revision.
Recorded here because an unrecorded collision is how three `L-n` namespaces came to overlap and cost
a day to untangle.

*End amendment 2.1.*
