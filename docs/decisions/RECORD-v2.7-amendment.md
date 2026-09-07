# DECISION RECORD — amendment 2.7

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 · **Opened** 2026-09-08
**Rulings** D-33

---

## D-33 · ADR citation drift is recorded once; ADR bodies are not rewritten to chase moved specs

**Ruled:** 2026-09-08 · **Task:** ADR-1 · **Baseline measured at:** `origin/main` 941e9888

### Context

`SPEC.1` 2.0.0 (D-29) and `SPEC.2` 2.0.0 (D-30) removed eleven sections between them on
2026-09-06/07. The ADR-1 recon resolved every `§`-token in `docs/adr/` and `docs/plans/DEBATE.7.md`
against both specs' live heading inventories, by token rather than by prefix, catching the
prefixed, elided, distributed and bare forms.

Measured at `941e9888`: **1,421** conforming §-tokens · **763** resolve · **72** resolve into a
`SPEC.2` section that survives as a pointer only · **147** are bare and ambiguous · **275 do not
resolve at all.** The 275 are smeared across roughly thirty files; the top five hold 40%.

Separately, the recon found **36** present-tense assertions, in live ADRs, that the moderation
gate blocks content and auto-bans authors — a posture ADR-0046 and **D-32** have reversed. Twenty-two
of the thirty-six are in `ADR-0021`, whose `Amended-by` row is scoped to Track B and therefore
records nothing about D-32's reversal of Track A.

An ADR is a record of a decision taken at a time. It is also read by `claude-code` as a binding
contract. Those two properties pull in opposite directions and this ruling separates them.

### Decision

**R1 — Citation drift is RECORDED, not repaired.** The 275 non-resolving §-tokens in `docs/adr/`
and `docs/plans/DEBATE.7.md` are preserved exactly as written. Their targets — `SPEC.1` §16.3,
§16.4, §16.5, §17, §18, §19, §21, §22, §23 and `SPEC.2` §2, §23 — were removed at 2.0.0. A
citation into a removed section is part of the record of when the decision was taken. It is not
repaired, and no future pass re-derives this: the removal is recorded here, once.

**R2 — `Status` and link rows ARE repaired.** A superseded or amended ADR that does not say so is
not history; it is actively misleading. Where a supersession or amendment has landed and the file
records nothing, the metadata row is added or extended.

**R3 — A live ADR asserting reversed behaviour gains a CALLOUT, not a rewrite.** The callout sits
immediately after the metadata table, before the body, because a note at the foot of the file is
not read before the text it corrects. The body is preserved byte-identical.

**R4 — ADRs carry no `§`-numbered headings. Measured: zero, across all 46.** The only numeric
heading form is `### N.` (bare integer), present in nine files. Every `ADR-NNNN §M` token in the
corpus therefore either matches one of those integers or dangles by construction. `ADR-0014 §84`,
`§85`, `§154`, `§190` and `ADR-0021 §78`, `§84` are line-number-shaped and resolve to nothing.
Recorded so no future pass measures it again.

**R5 — Docketed, not done.**
- 41 of 46 ADRs omit the `Amends` / `Amended-by` rows entirely, against a template that says
  *"Leave a row as an em-dash when it does not apply. Do not delete the row."* Cosmetic; no build
  hazard; deferred.
- `ADR-0047`'s D-31 item — the voided plan to strike `SPEC.1` §10.6 inside a code PR, still stated
  at `0047:207` and `:219` — is **owned by the LIQ-1 Phase 2 closeout**, not by ADR-1.
- `docs/plans/DEBATE.7.md:7` names `SPEC.1` and `SPEC.2` at **v1.0.7** against live 2.0.0.
- `docs/specs/SPEC.2.md:2089` ends mid-sentence — *"A per-file index in a specification is a"* —
  with no terminal clause. A spec defect; ADR-1 does not amend specs.
- `docs/records/` (9 files) was never swept for inbound ADR citations. `docs/lanes/`, named in the
  ADR-1 kickoff, does not exist on `origin/main`.
- Eight bare pointers in contract files (`SPEC.1`, `SPEC.2`, `AGENTS.md`, `RANKING.md`) name an
  ADR whose `Status` is `superseded`, with nothing on the line saying so.

### Consequences

**Positive.** The largest measured defect surface in the corpus is closed by one ruling rather
than 275 edits. Every ADR body survives intact as the record it is. The two files that could
mislead a `claude-code` session building MOD-1 say so at the top.

**Negative.** A reader following a citation into `SPEC.1 §17` still finds nothing at the far end
and must come here to learn why. That cost is accepted: the alternative is 275 judgment calls
about what a removed section "should" now point at, producing a diff no reviewer can check.

**Enforced at:** `ADR-0021`, `ADR-0014`, `ADR-0046`, `ADR-0041`, `ADR-0025`, `ADR-0026`,
`ADR-0028`, `ADR-0013`, `ADR-0006`, `ADR-0011`.

---

*End amendment 2.7.*
