# DECISION RECORD — amendment 2.2

**Amends** `docs/decisions/RECORD-v2.0.md` (preserved) · follows amendment 2.1
**Opened** 2026-09-04 · **Rulings** D-20 … D-24 · **Numbering** continues from D-19

---

## D-20 · Moderation is advisory, on both paths

**Supersedes** D-2 (which named text only and left its code check open) · **Answers** that check: the call was awaited.

**Ruling.** No post is ever blocked by moderation, no submission ever fails, no participant ever waits. Text moderation is fire-and-forget. Images are screened **at attach**, inside the composing window, so the verdict exists before submit and the post never waits on it. A rejected or failed image is dropped; **the post publishes regardless**.

The invariant: *a post is never blocked by moderation, and an image is never served before it has been screened.* Both hold because the mandatory argument guarantees a composing window.

**Enforced at** `ADR-0046` · `SPEC.1` §14, §16.5 · `SPEC.2` §10 · `CLAUDE.md` §2.

---

## D-21 · Devcon and all post-experiment content are struck

**Restates and widens** D-6, which 11 sites still contradict.

**Ruling.** No document references Devcon, ETHGlobal, a conference, a showcase, or the repository archive. The documentation covers the experiment and nothing after it.

**The dataset release stays in scope** — it is the artifact the experiment produces, and its pipeline is built.

⚠ **The freeze instant, 2026-11-05 23:59 UTC, is correct and does not move.** Only its Devcon justification is struck.

**Enforced at** `CLAUDE.md` · `SPEC.1` · `SPEC.2` · `ADR-0003`, `ADR-0006`, `ADR-0007`.

---

## D-22 · The precedence ladder

**Answers** the four-documents-three-answers conflict.

**Ruling.** **Decision record → `SPEC.1` → `SPEC.2` → ADRs → tracker.**

The record ranks first because it was written when the goal was clear; the ADRs were written at product genesis, before it was. A ruling **obliges an amendment** — it is binding, and the amendment is the work item that makes it findable.

ADRs are corrected by **surgical edit against the record**, never rewritten. Their genesis reasoning stays visible; only the consequence moves.

**Enforced at** `docs/STATE.md` (the lone dissenter — *"the ADR wins"*) · `docs/operating/OPERATING.md` §7 · `SPEC.2` §0.

---

## D-23 · `SPEC.2` is rewritten; `SPEC.1` is edited in place

**Ruling.** `SPEC.2` carries nine defects, a stale index, and five `MUST` clauses binding to a file that has never existed — it is rebuilt from the code and the record. `SPEC.1` is structurally sound and is edited in place.

**Core and invariants are carried verbatim in both.** A rewrite that restates an invariant in its own words has changed it.

---

## D-24 · Launch is 2026-09-15

**Ruling.** The live window opens 15 September 2026. Every document states that date and no other.

---

## D-25 · Concision is a standing rule

**Ruling.** A document that has lost its core to its own wording is defective. Applies retroactively to what this programme has already written, including `OPERATING.md`.

---

*End amendment 2.2.*
