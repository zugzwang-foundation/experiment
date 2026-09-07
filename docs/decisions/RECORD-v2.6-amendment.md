# DECISION RECORD — amendment 2.6

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4, 2.5 · **Opened** 2026-09-07
**Rulings** D-30, D-31, D-32 · **D-34 … D-48** (the LIQ-1 lane, ratified as a batch 2026-09-08)
⚠ **D-33 is NOT here.** It belongs to open PR #498, in `RECORD-v2.7-amendment.md` — see the note under D-34.

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
  per D-23 and are byte-identical to `origin/main` — INV-2, INV-3 and INV-4 unchanged in full,
  INV-1's statement column md5-identical. Five clauses inside §14 moved, and all five are declared
  here rather than left to the diff: INV-1's mechanism clause (iii), which described the
  superseded pre-commit gate (*"moderation runs OUTSIDE the transaction so a Track A / Track B
  verdict means the transaction never opens"*) and which ADR-0046 replaces — the invariant is
  unchanged, the mechanism by which it holds is not; §14's ADR footer, carrying the ADR-0014
  supersession marker; a broken citation corrected from `SPEC.1 §11` to `SPEC.1 §5`, §11 being
  Resolution and §5 the invariants, an error predating this pass; and two cross-references to §23,
  which cannot survive the section's removal ruled three bullets above. Carrying clause (iii)
  verbatim would have left an assertion of the superseded gate inside the invariant contract.
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

---

## D-34 … D-48 · The LIQ-1 lane, ratified as a batch

**Records** the decisions taken across the LIQ-1 lane (2026-09-05 → 2026-09-08), closed at
`LIQ-1-SOAK-CLOSE`. 2026-09-08.

⚠ **These are RECORDS, not fresh rulings.** Each was decided in its own session, defended in a
report or an ADR, and is already built. They are numbered here because a decision that lives only
in a `~/Downloads` report and a plan file is a decision the repository cannot arbitrate — the
`O-15` shape, one register over. D-31 already carries the *authorisation*; these carry the
*shape*. Where a row's evidence is a report rather than a file, the report is named in full and
ships in the LIQ-1 PK bundle.

⛔ **THIS BATCH STARTS AT D-34, NOT D-33, AND THE REASON IS THE POINT.** It was drafted as
D-33…D-47 against the merged head, where `RECORD-v2.6-amendment.md` is the current amendment and
D-32 is the ceiling — which is correct, and which is exactly how the collision stays invisible.
**Open PR #498 (`docs/adr-1-pass`, opened 2026-09-07 19:09 UTC) also mints D-33**, in a *different
file*: `RECORD-v2.7-amendment.md`. Two lanes, two different D-33s, and **git would have merged both
without a conflict**, because one appends to an existing file and the other creates a new one.

That is `O-15` in its purest form — *"an identifier allocated in PROSE will collide"* — and its
remedy is the one applied here: **a lane minting into a prose register while another lane is open
re-reads its number against the open PRs, not only against the merged head, before its PR lands.**
D-33 is ceded to #498, which opened first. This batch takes **D-34 … D-48**.

⚠ **The file numbering will look odd for as long as both are open, and that is honest rather than
tidy:** `RECORD-v2.6-amendment.md` will carry D-30…D-32 and D-34…D-48, while
`RECORD-v2.7-amendment.md` carries D-33 alone. The alternative — moving this batch into #498's file
— would have manufactured a merge conflict in someone else's unmerged work to make a version number
read prettily.

| # | Decision | Why, in one line | Evidence |
|---|---|---|---|
| **D-34** | **ADR-0047 accepted** — asymmetric open plus signup-pegged injection | A market that opens at 50/50 says nothing, and one that opens where the operator believes is worthless if the first bet moves it twenty points | `docs/adr/0047-…md`; PRs #491 `e25fa277`, #496 `67ceb6b5` |
| **D-35** | **p-weight rejected for the experiment** | The curve was measured equally lopsided either way, and the exact-arithmetic contract is worth more than a weighting nobody could defend from data | `zz_LIQ-SIM-2_measure_2026-09-06T1444.md`; ADR-0047 *Closed by plan-mode* |
| **D-36** | **Limit orders and user-supplied liquidity are out of scope for the experiment** | Both change what a participant *is*; the thesis is argued commentary priced by a single MM, not a venue | ADR-0047 *Closed by plan-mode*; `docs/plans/LIQ-1-P2_plan.md` |
| **D-37** | **D-14 held at 10/90; the per-market bettor term rejected; the velocity guard rejected** | The bettor term is `O(total bets)` per tick, and the velocity guard measured *anti-correlated* with the trigger — it suppressed seven of eight injections at 40k signups/hour | `zz_LIQ-RECON-2_measure_2026-09-06T1314.md` §10.6; ADR-0047 §D |
| **D-38** | **Phased across two PRs** — #491 (open + identity + replay), #496 (injector) | Phase 1 changes `settle`/`void`/`openMarket`; Phase 2 adds a new `pools` writer. Reviewing them together would have put a money-path correction and a cron sweep under one diff read | ADR-0047 *Execution*; PRs #491, #496 |
| **D-39** | **`D` is summed from events; `readGenesisRow` takes `LIMIT 1`; injections are a second query** | No migration on `pools` for ~30 rows a market, and the events are the audit trail regardless — but the genesis row is *one* row, not a sum, and conflating the two was a real defect caught by mutation | ADR-0047 §E; `src/server/markets/backing.ts`; `zz_LIQ-1-P1_exec_2026-09-06T1009.md` §7 |
| **D-40** | **The injector is a `FUNCTION`, `SELECT`-invoked, one subtransaction per market, with a 600 ms lock-hold budget (`0029`) and a status re-read under lock (`0028`)** | A function invoked by `cron.schedule` is one transaction, which is what makes the advisory lock and the per-market isolation mean anything; the budget is what holds the bound at **any** market count, which a CHECK cannot do | ADR-0047 §D; migrations `0027`, `0028`, `0029` |
| **D-41** | **The seeded policy row is `enabled = false`; arming is one operator INSERT after the promote** | ADR-0024 applies the migration *before* the new code is promoted, so a row seeded `true` would let the injector write rows the running code cannot read — under-reporting a terminal settle on an append-only row | ADR-0047 §G; migration `0027` |
| **D-42** | **`BET_MAX_STAKE` = 250, and the staging fixture generator is bound to it** | A replica whose purpose is to look like production held five bets no participant could place | ADR-0047 *Constants*; `src/server/config/limits.ts`; `tests/staging/generate.staging.test.ts` |
| **D-43** | **`openMarket` is freeze-gated** | A market opened after the 2026-11-05 freeze can take no bets, so it would exist only as an un-actionable row in the public dataset. Resolution's exemption is deliberate and untouched | `docs/parked.md` LIQ-1 L-4 (**PAID**); `tests/server/markets/freeze-gate.test.ts` |
| **D-44** | **Migration `0030` revokes `EXECUTE` on all three liquidity functions from `PUBLIC`, `anon` and `authenticated`** | Defence in depth under ADR-0019's no-RLS premise; `service_role` keeps it, being a secret-holder rather than a browser-reachable role | migration `0030`; `tests/db/liquidity-grants.spec.ts`; `docs/parked.md` LIQ-1 L-10 (function arm **closed**) |
| **D-45** | **G5.7b is restated as two assertions: the cap on live data, and a surviving four-digit *holding*** | With the cap at 250 a four-digit single `bets.stake` is unsatisfiable by any fixture — the old gate was green only because the fixtures violated the product's own cap | `docs/parked.md` LIQ-1-FIX-2 H-1 (**CLOSED**); `tests/staging/gates.staging.test.ts` |
| **D-46** | **The staging reset is guarded against destroying content markets, and the eight are recreated by a seeder that is also the production seeding tool** | The 2026-09-07 reset deleted eight founder-authored markets, recoverable only because a snapshot had been committed first. One tool, used twice, is a tool that gets exercised | ADR-0035; `tests/staging/_lib/content-guard.ts`; `scripts/seed-content-markets.ts`; PR #499 `5052ae80` |
| **D-47** | **The seven Phase-2 open deviations stand as ruled, including R-1's four-case split** | Each was surfaced at kickoff and answered before execution rather than absorbed silently | `docs/plans/LIQ-1-P2_plan.md`; `zz_LIQ-1-P2_exec_2026-09-07T0920.md` |
| **D-48** | **The deploy runbook's migrate log-reading test is replaced by post-migrate database probes** | drizzle-kit echoes nothing and `CREATE TABLE`/`CREATE FUNCTION`/`cron.schedule()` raise no NOTICE, so a no-op and a four-migration apply print an identical log — *a check that answers the same for both outcomes is not a check* | PR #500 `da9979b9`; `docs/runbooks/deploy-pipeline.md` §2 |

### Two corrections this batch owes its reader

⚠ **D-42 was relayed as *"the fixture generator clamps to it"*, and the shipped behaviour is to
REFUSE, not to clamp.** The distinction is deliberate and was `@code-reviewer`'s at LIQ-1-FIX-2:
`clampStakeToMax` is reused as the **oracle**, so a change to the constant propagates without
anyone editing the line, but its return value is compared and never used. Silently shrinking a
fixture stake would produce a green run whose calibrated positions were quietly smaller than the
fixture table declares — *a worse lie than the one it replaces*. Two layers enforce it: a
whole-table pre-flight in `beforeAll` that refuses before a row is written, and a per-call
backstop. Recorded in the built form rather than the relayed one.

⚠ **D-44's verification is now measured on hosted staging, which it previously was not.**
`docs/parked.md` L-10 records that *"nothing automated asserts `0030` took effect on the hosted
projects"* — `tests/db/liquidity-grants.spec.ts` reads `DATABASE_URL` and CI's substrate carries
neither app role. `LIQ-1-SOAK-CLOSE` §A6 is that hand check for **staging**: all seven
`has_function_privilege` reads return FALSE. **Production is still owed.**

---

*End amendment 2.6.*
