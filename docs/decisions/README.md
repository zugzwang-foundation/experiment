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
| `RECORD-v2.0.md` | **ZUGZWANG · DECISION RECORD.** How Hrishikesh ruled on every capacity, cost and degradation question raised during hardening, so no ruling has to be re-derived from a conversation. Its own status line: *15 numbered · 2 collapsed · 13 live, all ruled · 2 accepted without measurement · 0 open* | Opened **2026-08-23**, last ruling **2026-09-03** | **Not superseded — amended** by `RECORD-v2.1-amendment.md`, which names it in its own `Amends` field as *"preserved; not edited"*. Only **D-13** is superseded (by D-15); D-0 … D-14 otherwise stand |
| `../operating/OPERATING-v2.0.md` | **ZUGZWANG · OPERATING PLAN.** The durable method for running a task here — roles, gates, transmission, and the failure modes that have actually bitten. Filed under `docs/operating/`, not here, because it is a method in use rather than a record of a past decision | **2026-08-09**, at the SYNC-1 close | **`../operating/OPERATING.md`** (2026-09-04, ratified as v3.0 and now at **v3.1**), which names it in its own `Supersedes` field. v2.0 stays here as a preserved record and is not edited; it in turn superseded `STAGING-PARITY_operating-plan_v1_0.md` |
| `RECORD-v2.1-amendment.md` | **DECISION RECORD — amendment 2.1.** Rulings **D-15 … D-19**: the operating model is v3.0 and supersedes D-13 · the critical paths narrow from nine server directories to **seven areas** · delegated parallel execution is permitted off those areas and forbidden on them · close-out documents are abolished, `docs/records/` plus the commit log being the record · a citation names a symbol, a line number being a convenience. Numbering continues from v2.0's own ceiling — **measured** from that record's §0 header rather than assumed. **An amendment, not an edit**, on its own stated grounds that editing a preserved record destroys the evidence of what was ruled and when | Opened **2026-09-04** | **Not superseded — followed** by `RECORD-v2.2-amendment.md` (D-20 … D-25) and `RECORD-v2.3-amendment.md` (D-26 … D-27). The three are sequential amendments to the same preserved `RECORD-v2.0.md`, and all three stand; D-15 … D-19 are unamended |
| `../operating/OPERATING.md` | **ZUGZWANG · OPERATING MODEL v3.1.** How work is decided and executed: §1 the five locks no lane lead may weaken · §2 roles · §3 the decision classes reserved to the founder, everything else the lane lead's call without waiting · §4 the seven critical-path areas · §6 delegated execution · §12 what changes on 15 September. Filed under `docs/operating/`, not here, for the same reason v2.0 is: it is a method in use. ⚠ **Unlike everything else in this table it is a living document** — its §14 amends it by pull request, so the directory's *not-maintained* rule does not reach it | **RATIFIED 2026-09-04** by the founder; recorded as decision record **D-15**, since amended by **D-20**, **D-22** and **D-25** — v3.1 (2026-09-05) is D-25 concision applied to it by name, 84 lines shorter and no decision lighter | — (current). ⚠ Its **section numbering is unchanged across v3.0 → v3.1** — §1, §2, §3, §4, §6, §12 and §14 all still name what this row says they do; only the version moved |
| `RECORD-v2.2-amendment.md` | **DECISION RECORD — amendment 2.2.** Rulings **D-20 … D-25**: moderation is advisory on both paths and no post is ever blocked · Devcon and every post-experiment reference is struck, the 2026-11-05 23:59 UTC freeze instant itself standing unmoved · the precedence ladder is **record → `SPEC.1` → `SPEC.2` → ADRs → tracker** · `SPEC.2` is rebuilt and `SPEC.1` edited in place · launch is **2026-09-15** · concision is a standing rule. Follows amendment 2.1 and amends the same preserved `RECORD-v2.0.md`; numbering continues from D-19. ⚠ Its own header names the range *"D-20 … D-24"* while its body carries **D-25** — committed unchanged, because a preserved record is evidence and evidence you are willing to edit is not evidence. **D-27 (amendment 2.3) rules the range and names web Claude as the author of the error**, which is what correction-by-successor looks like | Opened **2026-09-04** | **Not superseded — corrected** on one point by `RECORD-v2.3-amendment.md`: **D-27** rules the range **D-20 … D-25**, against this amendment's own header. The record itself is not edited |
| `RECORD-v2.3-amendment.md` | **DECISION RECORD — amendment 2.3.** Rulings **D-26 … D-27**: D-21 is narrowed to **the event, not the words** — Devcon, ETHGlobal, any named venue, the 6–8 November window and the `2026-11-08` repository-archive boundary are struck, while *"showcase"* and *"conference"* survive wherever they are product or market vocabulary (`SPEC.1` §21.4, the resolver-card labels, market resolution criteria). Its test is a good one: **a site is struck if deleting it removes a claim about what happens after 2026-11-05** — if it removes a product noun, it was never a D-21 site. D-27 corrects amendment 2.2's header range to D-20 … D-25 by succession rather than edit. Opened against a literal reading that would have swept 24 false positives, roughly half the raw hits | Opened **2026-09-05** | **Not superseded — followed** by `RECORD-v2.4-amendment.md` (**D-28**), which amends the same preserved `RECORD-v2.0.md`; D-26 and D-27 are unamended |
| `RECORD-v2.4-amendment.md` | **DECISION RECORD — amendment 2.4.** Ruling **D-28**, the open-questions round: twenty-eight questions put to the founder in one sitting and answered in one sitting, recorded as **one ruling carrying a table** rather than twenty-eight numbered rulings — D-25 concision applied to the record's own numbering. What it closes: the identity pool (row 4, `STATE.md` **F-9** discharged, D-11's stated size superseded) · the dataset pipeline is **deliberately open** until after 5 November, so **F-15** is reclassified from blocker to *by design* (row 5) · `F-MOD-3` is **scrapped**, there is no automated reporting and the admin has full control (row 7) · the twenty runbooks promised in `SPEC.2` §21 are **struck** while `docs/runbooks/` is kept whole (row 12) · the 82 stale *"by 1 September"* claims point at **the event, not the date** (row 21) · the founder occupies **every** lane-lead seat (row 22). Its **standing consequence** closes moderation, alarming and load-shedding as topics — rows 7, 13, 14 and 23 are not reopened without a new ruling. ⚠ It is also the first amendment to **delegate to the executor by name**: rows 26 and 27 rule *"executor applies best practice"* and *"executor decides"* rather than stating the outcome, which is a ruling about who decides and not a decision left unmade | Opened **2026-09-05** | **Not superseded — followed** by `RECORD-v2.5-amendment.md` (**D-29**), which amends the same preserved `RECORD-v2.0.md`; D-28 is unamended |
| `RECORD-v2.5-amendment.md` | **DECISION RECORD — amendment 2.5.** Ruling **D-29**: `SPEC.1` is **rebaselined at 2.0.0**, narrowing D-23 for `SPEC.1` alone while `SPEC.2`'s rebuild stands. The premise is that a product contract is not a catalogue — §16.3–§16.5 (privacy, audit logs, compliance), §17 (the acceptance catalogue), §18 (out of scope), §19 (open questions) and §21–§23 (ancillary surfaces, Discovery, Profile) are **removed**, on the grounds that the repository already carries the built surfaces and the tests that would prove them. Two choices are what keep a deletion this large from losing a rule: **section numbers are retained, with gaps**, so every cross-reference elsewhere still resolves, and **five prescriptive sentences survive by relocation** rather than deletion — the append-only rule on `mod_actions`/`admin_events` and *"removed content is never rendered or exported"* → §15, the AGPL-3.0 source link in the Terms → §13 F-AUTH-4, and *"no misinformation moderation"* with the thesis-bearing exclusions → §3.2 (NG6–NG15). Every flow keeps its inline Acceptance line. The change log is reset and the 1.0.0–1.0.49 line stays in git history. ⚠ It also **records where the spec leads the code**: moderation conformance is `MOD-1`, still pending, and the 2.0.0 change-log row says so — so the gap reads as a known debt rather than as drift | Opened **2026-09-06** | — (current) |

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
