# ADR-0046 — Moderation is advisory: no post is ever blocked

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-04 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | MOD-1 |
| **Frame document** | Decision record D-20; `SPEC.1` §14, §16.5; `SPEC.2` §10; `docs/operating/OPERATING.md` §1 |
| **Supersedes** | ADR-0014, partial — the gate architecture only (§Decision Outcome, the pre-commit ordering, the fail-closed terminal posture). ADR-0014's vendor choice, category taxonomy, Redis reservation, idempotency-first ordering and byte-identity binding stand unamended. |
| **Superseded-by** | — |
| **Amends** | ADR-0021 — its Track B verdict consequence (block) becomes: publish, then flag. Its removal of the held queue stands. |

**This ADR does not decide:** the moderation vendor · the category taxonomy or its thresholds · the admin review surface · retention of moderation verdicts in the published dataset · the auto-ban policy in `SPEC.1` §16.4.

---

## Context and Problem Statement

Ruling **D-2** (2026-08-24) stated that OpenAI moderation is an advisory signal, not a gate, with a latency budget of zero: on failure *"the signal stops. The product does not."* It left one question open — whether the call is awaited.

**It is.** `src/app/api/bets/place/route.ts` awaits `precommitModerate` before the transaction opens; both tracks throw; a terminal provider failure returns a fail-closed 503. Worst case is roughly six seconds in front of every commented bet.

Two things followed. First, the ruling never reached any document, so `ADR-0014`, `ADR-0021`, `SPEC.1`, `SPEC.2`, `CLAUDE.md` and the code all describe a gate, and the question has resurfaced repeatedly. Second, the shipped gate is **one call handling both the text and the image path**, so "text is advisory" could not be implemented without deciding what happens to images.

This ADR settles both.

**Why it matters to the thesis.** Every bet carries a mandatory argument. Latency in front of a commented bet is friction on precisely the behaviour the experiment measures. A six-second wait is not a neutral cost.

## Decision Drivers

- **D-20** — no post is ever blocked, no submission ever fails, no participant ever waits.
- `SPEC.1` §16.5 makes CSAM detection and reporting a legal floor. The floor is not the wait; it is that nothing is served unscreened.
- Lock 5 (`OPERATING.md` §1) — moderation is safety-critical and is never bypassed. It is not bypassed here; it is re-ordered.
- The composer's own physics: an image is attached **before** the argument is written, and the argument is mandatory.

## Considered Options

1. **Keep the gate.** Zero work. Six seconds of friction stays, and the ruling stays unimplemented.
2. **Everything advisory, images published on submit and screened after.** Publishes unscreened bytes to a public URL. Rejected — no correction path, and the platform ships a public dataset.
3. **Screen at attach; publish on submit.** The screening runs during composition, so the verdict exists before submit. Chosen.

## Decision Outcome

**Moderation is advisory. No post is ever blocked, no submission ever fails, no participant ever waits.**

**Text.** Fire-and-forget. The moderation call is not awaited on the request path. The comment publishes. Flags are written to the audit trail and surfaced in the Admin Control Centre. A provider failure, timeout or error changes nothing a participant sees.

**Images.** Screened at **attach**, not at submit.

| Moment | Behaviour |
|---|---|
| Attach | Uploads to a private prefix. Screening fires immediately in the background. The composer stays fully interactive |
| Composing | Screening completes — a second or two against a minimum of tens of seconds of typing |
| Submit | The verdict already exists. Post and image publish together. **No wait** |
| Submit before the verdict lands | The post publishes immediately. The image appears when the verdict does. **The post is never held** |
| Verdict is a rejection | **The post still publishes.** The image is dropped and the participant is told which one and why |
| Provider failure or timeout | **The post still publishes.** The image is dropped, the failure is recorded, admin sees it |

**The invariant, stated once:** *a post is never blocked by moderation, and an image is never served before it has been screened.* Both hold simultaneously because the screening window is the composing window.

`ADR-0028`'s byte-identity binding is unchanged and does the caching: an identical re-upload hits a cached verdict with no provider call.

## Consequences

**Good.** Roughly six seconds leaves the front of every commented bet. The ruling is finally written where the code reads it. Terminal provider failure stops taking the product down with it.

**Bad.** Two code paths where there was one, and a rejection is now a partial success the composer has to explain. `SPEC.1` §16.5's CSAM short-circuit moves from "abort the transaction" to "drop the image, publish the post, report" — the report obligation is unchanged and unweakened.

**Follow-on, in the same commit or the same PR:** `ADR-0014` gains an `Amended-by` row · `ADR-0021`'s Track B consequence changes · `SPEC.1` §14 and §16.5 and `SPEC.2` §10 restate the posture · `CLAUDE.md` §2's "fails closed on a terminal error" becomes the invariant above · the moderation acceptance rows are re-derived.

⚠ **Critical path.** Moderation is one of the seven areas in `OPERATING.md` §4 and this ADR touches lock 5. Plan-then-execute, reviewer pass and a founder diff-read are all required.

## Flow & invariant constraints absorbed

| Constraint | Effect |
|---|---|
| **INV-1** — bet ↔ comment atomicity | Preserved. `ADR-0014` preserved it structurally by never opening the transaction; here the transaction is never conditional on a verdict, so nothing can partially commit |
| **Lock 2** — mandatory commentary | Unchanged, and load-bearing: it is what guarantees the composing window exists |
| **Lock 3** — append-only | Unchanged. A dropped image is a fact recorded forward, never an edit |
| **Lock 5** — moderation safety-critical | Preserved. Screening still precedes serving; only the wait is removed |
| `SPEC.1` §16.5 — CSAM legal floor | Preserved. Nothing is served unscreened; the report obligation is unchanged |
