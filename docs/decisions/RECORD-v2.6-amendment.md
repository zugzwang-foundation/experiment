# DECISION RECORD — amendment 2.6

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4, 2.5 · **Opened** 2026-09-07
**Ruling** D-30

---

## D-30 · `SPEC.2` is rebaselined at 2.0.0, and D-23's rebuild is narrowed to the defective sections

**Narrows** D-23 (2026-09-04) for `SPEC.2`. D-29 already narrowed it for `SPEC.1`.

**Why.** D-23 ruled a rebuild from an estimate — *"nine defects, a stale index, and five `MUST`
clauses."* The `SPEC-2-RECON-0` measurement (2026-09-06) puts the count at 87 and shows them
**concentrated**: §10, §13, §0 and §12 carry 51% of them in 12.7% of the file, nine of 26 sections
carry none, and the two kinds do not overlap — the gate assertions sit in §10 and §12, the broken
citations in §13, §0 and §3. A whole-document rebuild would rewrite 2,945 lines to repair 87
defects, and would put §14's four invariants — which D-23 requires carried verbatim — through an
unnecessary rewrite.

**Ruling.**
- **Section-level rebuild:** §10 (renamed *Moderation Contract*) and §12's moderation-coupled
  clauses. These state the superseded pre-commit gate; the posture is wrong, not the wording.
- **Repair in place:** §0, §3, §4, §5, §8, §11, §13, §15, §17, §18, §19, Appendix B.
- **Reduced to a pointer:** §21, §22, Appendix A. Each is a list the repository already holds and
  each has gone stale — §22 declares 38 ADRs against 44 on disk and a ceiling of 0039 against
  0046; Appendix A declares 26; §21 names twenty runbooks of which nineteen do not exist. This
  discharges D-28 r12 (*"the twenty are struck; `docs/runbooks/` is kept whole"*), r16, r17 and,
  by removing the index that keeps going stale rather than reformatting it, r18.
- **Removed:** §2 (Architectural Blockers Register — a historical register) and §23 (Tracker Task
  Gating Map — the tracker is last on the D-22 ladder and is operator-maintained). No ruling names
  either.
- **Untouched:** §1, §6, §7, §9, §14, §16, §20. §14 carries INV-1…INV-4 verbatim, per D-23.
- **Kept deliberately:** Appendix B. It carries no `MUST` line, but it decides which columns about
  real participants are published on 2026-11-06. That is a privacy contract, not a catalogue.
- Change log reset; the `v0.1-outline`–`1.0.27` line stays in git history. Version 2.0.0. Section
  numbers are retained with gaps so cross-references elsewhere stay resolvable.

**Consequences.** D-28 r12/r15/r16/r17/r18 are discharged at this pass. D-24's launch date, absent
from `SPEC.2` entirely, is stated. Moderation code conformance remains `MOD-1`, pending: the spec
leads the code until it lands and the 2.0.0 change-log row says so. The `SPEC.1` §16 preamble
residue (`SPEC.1:1155`) and the superseded ladders in `docs/decisions/README.md` and
`docs/STATE.md` are a separate hygiene commit, not this one.

**Enforced at** `SPEC.2` §0 and its change log.

---

*End amendment 2.6.*
