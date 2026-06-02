<!--
ADR template for the Zugzwang experiment phase.

Filename convention: NNNN-kebab-case-title.md
  - NNNN: zero-padded ADR number (e.g., 0004, 0005, 0016)
  - kebab-case-title: short, hyphenated, lowercase

Status values: proposed | accepted | superseded | deprecated
  - proposed: written but not yet ratified by the decider
  - accepted: ratified; load-bearing
  - superseded: replaced by a later ADR (set Superseded-by)
  - deprecated: no longer relevant but not replaced

Supersession rule: superseding an accepted ADR requires a same-commit SPEC.2
update per SPEC.2 §0 versioning policy. Add a "Superseded-by" link in the
old ADR; the new ADR adds a "Supersedes" link.

Sections marked <!-- optional --> may be omitted if not applicable.
Sections without that marker are mandatory for every ADR.

Delete all HTML comments (including this one) before committing.
-->

# ADR-NNNN — <Short title in title case>

| | |
|---|---|
| **Status** | proposed \| accepted \| superseded \| deprecated |
| **Date** | YYYY-MM-DD |
| **Deciders** | <Name(s)> |
| **Tracker task** | <SPEC.N or FOUND.N> |
| **Frame document** | <SPEC.2 §N where this decision is delegated, e.g. "SPEC.2 §1.4 #N (delegation), §23 (ADR Index)"> |
| **Supersedes** | — \| <ADR-NNNN> |
| **Superseded-by** | — \| <ADR-NNNN> |

---

## Context and Problem Statement

<!--
One or two paragraphs covering:
  - The problem this ADR resolves
  - The forces at play (constraints, competing concerns)
  - Why the decision is needed now (what it unblocks)
  - Relevant SPEC.1 / SPEC.2 sections this decision serves

End with an explicit "This ADR does not decide:" list, naming each adjacent
concern and the ADR that owns it. This prevents scope creep and gives
future readers a fast map of where adjacent decisions live.
-->

This ADR does **not** decide:

- <Adjacent concern> (ADR-NNNN)
- <Adjacent concern> (ADR-NNNN)

## Decision Drivers

<!--
Numbered list of the forces that drove the decision. Each driver should be
testable against the considered options — i.e., reading the driver, you
should be able to score each option for/against it.

Typical drivers:
  - Build-lifetime constraints (deadlines, LTS windows)
  - Concurrency / consistency requirements (from SPEC.2)
  - Single-developer / agent-assisted workflow constraints
  - Cost ceilings
  - Integration with other ratified ADRs
  - Security / privacy invariants
-->

1. <Driver>
2. <Driver>
3. <Driver>

## Considered Options

<!--
Numbered list. Mark the chosen option with "← chosen". Aim for 3-5 options.
Including options you ultimately rejected demonstrates the decision was
made on its merits, not by default.
-->

1. **<Option A>** ← chosen
2. <Option B>
3. <Option C>

## Decision Outcome

**Chosen: Option N — <name>.**

<!--
State precisely what is being ratified. Be specific enough that a fresh
reader can implement against the decision without reading the rest of
the ADR.

For multi-part decisions (e.g., "Next.js 16 + App Router + Cache Components
together"), enumerate each primitive that's being ratified. A future
reader needs to know which parts are load-bearing and which are
implications.

For decisions that mint a hard constraint other ADRs consume (e.g., a
runtime pinning, a wire-format choice, a security boundary), name the
constraint explicitly and list which downstream ADRs / files consume it.
-->

### Single-source-of-truth file map <!-- optional -->

<!--
Include this subsection ONLY if the decision pins one or more concerns
to specific source files (per SPEC.2 Appendix A discipline). Each row
names the concern and its single source-of-truth file path. Future
code MUST NOT scatter the concern across other files; doing so triggers
a SPEC.2 §A update.
-->

| Concern | Source-of-truth file |
|---|---|
| <Concern> | `<path>` |
| <Concern> | `<path>` |

## Consequences

### Positive

<!-- 3-7 bullets. Concrete benefits, not vague claims. -->

- <Consequence>
- <Consequence>

### Negative

<!--
3-7 bullets. Real downsides, including ones that may surface later.
Each negative consequence SHOULD have a mitigation note ("Mitigated by:")
where one exists, or be explicitly accepted ("Acceptable because:").
-->

- <Consequence>
- <Consequence>

### Neutral <!-- optional -->

<!--
Implications that are neither benefits nor drawbacks but worth recording
for future readers (e.g., licensing implications, dependencies on
unrelated ADRs).
-->

- <Implication>

## Pros and Cons of the Options

### Option 1 — <name> (chosen) <!-- or use ✓ chosen marker -->

**Pros**

- <Pro>
- <Pro>

**Cons**

- <Con>
- <Con>

### Option 2 — <name>

**Pros**

- <Pro>

**Cons**

- <Con>

**Verdict:** Rejected. <One-sentence reason.>

<!-- Repeat for each option. -->

## Flow & invariant constraints absorbed

<!--
ZUGZWANG-SPECIFIC SECTION (introduced by ADR-0003).

This table is the bridge between the ADR and SPEC.2's invariant-naming
discipline. It MUST exist in every ADR, even if some rows are minimal,
because it's how SPEC.8 fresh-session review verifies coverage.

Each row names: (a) the source — typically a SPEC.2 § or SPEC.1 INV-N or
tracker task — and (b) the constraint this ADR mints, consumes, or shapes
in relation to that source.

"Mints" = constraint originates in this ADR; downstream ADRs / files consume it
"Consumes" = constraint originated upstream; this ADR implements / depends on it
"Shapes" = neither pure mint nor pure consume; this ADR refines or scopes the constraint

A future change to any cited section requires a same-commit update to this ADR.
-->

| Source | Reference | Constraint |
|---|---|---|
| <SPEC.2 §N or SPEC.1 INV-N> | <short label> | <constraint, with verb: mints / consumes / shapes> |
| <SPEC.2 §N> | <short label> | <constraint> |
| Tracker | <task IDs unblocked> | All depend on this ADR being `accepted` |

## More Information <!-- optional -->

<!--
External references the decision relies on:
  - Vendor / framework documentation
  - Standards documents (RFCs, etc.)
  - Prior art in adjacent products
  - Internal docs (AGENTS.md sections, CLAUDE.md decision-log rows)
-->

- <Link or reference>
- <Link or reference>

---

*ADR-NNNN ratifies <one-sentence summary>. The decision body and any constraints minted in §<Decision Outcome subsections> are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
