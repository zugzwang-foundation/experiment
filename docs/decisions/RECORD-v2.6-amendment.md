# DECISION RECORD — amendment 2.6

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4, 2.5 · **Opened** 2026-09-07
**Rulings** D-30, D-31, D-32

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
- **Untouched:** §1, §6, §7, §9, §16, §20. §14's four invariant *statements* are carried verbatim
  per D-23 and are byte-identical to `origin/main` (INV-2, INV-3 and INV-4 unchanged in full). Two
  clauses inside §14 necessarily moved and are declared here rather than left to the diff: INV-1's
  mechanism clause (iii) described the superseded pre-commit gate (*"moderation runs OUTSIDE the
  transaction so a Track A / Track B verdict means the transaction never opens"*), which ADR-0046
  replaces — the invariant is unchanged, the mechanism by which it holds is not; and §14's ADR
  footer carries the ADR-0014 supersession marker. Carrying clause (iii) verbatim would have left
  an assertion of the superseded gate inside the invariant contract.
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

## D-31 · Mid-market liquidity injection authorised (ADR-0047 Phase 2)

**Amends** `SPEC.1` §10.6 and §3.2 NG15. 2026-09-07.

**Ruling.** The pool seed remains fixed at creation — written once at `Draft → Open`, one
`market.opened` event. Pool **depth** may be increased after open by one named mechanism and no
other: the ADR-0047 §D injector. It is price-neutral by construction (measured |Δp| ≤ 1e-18 at 18
decimal places, LIQ-SIM-2 §0a), admin-side, touches no participant balance and writes no
`dharma_ledger` row, and records each change as one `pool.liquidity_added` event carrying reserves
before and after, the target, and the discards. `SPEC.1` §10.6 and the corresponding non-goal are
amended to state exactly that. No other mid-market liquidity change is permitted.

**Grounds.** §10.6 banned injection on three grounds. Two no longer hold: retroactive re-pricing is
false against this primitive (measured), and audit-trail integrity is restored by the backing
identity landed in ADR-0047 §E. The third inverts — a seed fixed at creation flattens the K_eff
signal as turnout grows (undefended launch price 0.787 at 5k signups/hour against 0.994 at 40k,
LIQ-SIM-2 §3b) — so depth that scales with participation serves K·n > C rather than weakening it.

**Condition, discharged 2026-09-07.** The ruling was made conditional on the backing identity
holding no row in `users` and no participant-shaped account. Measured and discharged by the LIQ
lane: `src/server/markets/backing.ts` imports the `events` schema and nothing else — no `users`,
`positions`, `pools` or `dharma_ledger` — and derives the discards arithmetically from the
`market.opened` payload, returning a number rather than a balance; `src/server/cpmm/calculate.ts`
records that the short side's excess is *"DISCARDED — destroyed, held by no one, in no position"*;
`src/server/markets/open.ts` writes `pools` and `events` and no `users` or `dharma_ledger` row; and
the Phase 2 injector's only contact with `users` is `count(*)`, a cardinality read. *The admin is
not a participant* holds structurally and is not traded against liquidity depth.

**Consequences.** ADR-0047's plan to strike §10.6 inside a code PR is void — an ADR does not amend
`SPEC.1` (D-22). The amendment lands by this ruling; the Phase 2 PR carries the `SPEC.1` text and
cites this row, and does not merge before that text does. `SPEC.2` 2.0.0 is unaffected; Phase 2's
`SPEC.2` changes are additive rows on top of it.

**Evidence.** `zz_LIQ-RECON-2_measure_2026-09-06T1314.md`,
`zz_LIQ-SIM-2_measure_2026-09-06T1444.md`; ADR-0047 §A, §D, §E.

---

## D-32 · Moderation consequences are advisory; the pre-serve hold is retained for the CSAM-adjacent image set

**Extends** D-20 and ADR-0046 from the *timing* of moderation to its *consequences*. 2026-09-07.

**Ruling.** No content is auto-removed and no participant is auto-banned by a classifier verdict.
Every verdict routes to the admin, who decides on removal and on ban. This reverses the retained
Track A auto-ban.

**One exception, and it is not a moderation gate.** An image in the CSAM-adjacent set — CSAM hash,
`sexual/minors`, adult `sexual`, `nsfw` — is not served until its verdict has returned. Every image
is screened before first serve regardless, since a file cannot be known not to be CSAM without
looking at it; what this ruling changes is only the consequence. Images flagged violence, weapons,
harassment, hate or self-harm publish immediately and are flagged. No post is blocked and no
participant waits, in any case.

**Grounds.** PhotoDNA is parked. On `omni-moderation-2024-09-26` the `sexual/minors` category scores
on text only; image-borne child sexual abuse material is scored as adult `sexual`. The
adult-`sexual`-on-an-image predicate (`SPEC.2` §10, A2) is therefore the only mechanism in the
product that catches it. Making that category publish-then-flag would serve it. The hold lifts when
PhotoDNA or a dedicated image classifier is onboarded.

**Consequences.** Amends `SPEC.1` §2 (Track A/B glossary rows), §14 (track table, F-MOD-1, F-MOD-2),
§15 F-ADMIN-4, §16.2 and Appendix A; and `SPEC.2` §10's category-routing paragraph. That text lands
with `MOD-1`, not in this pull request. Detection is unchanged and unweakened.

---

*End amendment 2.6.*
