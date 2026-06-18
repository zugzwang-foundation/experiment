# ADR-0020 — Decoupled Content Removal and Three-Option Held Queue

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-18 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | Admin-dashboard ideation (origin); DEBATE.7 + admin-dashboard stratum (consumers) |
| **Frame document** | SPEC.1 §14 (Moderation — F-MOD-3 product behaviour); SPEC.2 §10 (Pre-Commit Moderation Contract — interacts), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

SPEC.1 §14 F-MOD-3 fuses two distinct judgments into every moderation decision: *removing content* and *banning the author*. The held queue is binary — **Approve** or **Block-and-ban** — with an explicit "no middle option (no warn-and-restore, no edit-and-resubmit)." The reactive inline-removal scope (F-ADMIN-4) is "remove a Track A or Track B comment," and removal there also bans.

The admin-dashboard ideation ratified **Reading X**: OpenAI gates every comment pre-admin, Track C posts live, and the admin runs a real-time reactive feed *after* the gate. That model surfaced two needs the binary model cannot serve. First, reactive removal must extend to **Track-C-passed (live) content** — the only coverage for the image-category hate/harassment/weapons false-negative gap omni-moderation cannot classify — but ban-on-sight for a borderline false-negative is disproportionately blunt. Second, the binary model makes an author's fate depend on *whether OpenAI flagged the content, not on the content itself*: a borderline argument caught by OpenAI (Track B) forces a ban via Block, while the same argument slipping through to Track C and caught by the admin can only be removed-with-ban. That inconsistency is incoherent.

The fix is to separate the **content axis** ("is this comment out of bounds for any market discourse?") from the **user axis** ("is this person acting in bad faith?"). This lets the admin remove content without banning, and makes banning a separate, deliberate judgment. This is the one change to ratified moderation product behaviour the admin-dashboard design requires, and it must land before DEBATE.7 plans the Track A/B/C consequence wiring — DEBATE.7 wires the new Discard/Remove paths this ADR mints.

This ADR does **not** decide:

- The bet-on-hold execution model for Approve — whether the held bet settles at post-time or approve-time price, and its INV-3 reconciliation (DEBATE.7 plan).
- The freeze-edge disposition for held items un-actioned at the 2026-11-05 23:59 UTC freeze (DEBATE.7 plan).
- The real-time delivery mechanism, market filter, and homepage IA (SPEC.1 §15 amendment — UI/IA, paired with this ADR).
- The pre-commit gate shape, vendor selection, or fail-closed posture (ADR-0014, unchanged; this ADR does not re-open it).
- Track A degrade mode (HARDEN.5).

## Decision Drivers

1. **Reading X coverage.** Reactive removal of live (Track C) content is required for false-negative coverage; ban-on-sight is too blunt for borderline cases.
2. **Consistency.** An author's ban should follow from content and behaviour, not from whether OpenAI happened to flag the comment.
3. **Audit integrity.** Every action — including a no-ban removal — must write an append-only `mod_actions` row; no silent suppression (SPEC.1 §16.4, "no shadow-ban").
4. **Invariant safety.** The decoupling must not touch the bet or ledger (INV-1/INV-2/INV-3); it operates only at comment-visibility and account-state level. Ban removes voice, not balance — positions ride to resolution.
5. **No-bypass.** The new actions are consequences of the gate's verdict, never a way around it; the OpenAI gate still runs on every comment regardless of admin state.
6. **Sequencing.** Must be ratified before DEBATE.7 wires the moderation consequences.

## Considered Options

1. **Decouple the two axes: add a no-ban content-removal action; held queue becomes Approve / Discard / Block; live reactive path gets Remove / Ban** ← chosen
2. Keep the binary model (Approve / Block; removal always bans) — status quo
3. Decouple only on the live (Track C) path; keep the held queue binary
4. Add a graduated model (warn-and-restore / three-strike) for the middle ground

## Decision Outcome

**Chosen: Option 1 — decouple content removal from user ban across both moderation paths.**

The following are ratified:

1. **Two independent axes.** Content removal (hide a comment from public view) and user ban are separate moderation outcomes. Either may be applied without the other.

2. **Held queue (Track B) action set: Approve / Discard / Block.**
   - **Approve** — publish the argument and settle the staked bet. *(The held-bet execution model is DEBATE.7's to resolve; this ADR ratifies only that Approve is the publish path.)*
   - **Discard** — keep the content hidden, author untouched, no ban. Because the built model never opens the bet+comment transaction on a Track B verdict (ADR-0014 §85), Discard simply closes the held `mod_actions` row: no comment row, no bet, no stake committed.
   - **Block** — keep hidden and ban the author (Track A mechanics: account flagged, Daily Credit stops, existing positions ride, no appeal per E2).

3. **Live (Track C) reactive action set: Remove / Ban.**
   - **Remove** — hide the already-public comment, author untouched, the author's bet rides to resolution. Replies under it stay (other users' stake-backed arguments); the parent renders a "removed by moderator" placeholder with the thread intact.
   - **Ban** — hide and ban the author (Track A mechanics; positions ride).

4. **Reactive-removal scope extended to Track C.** F-ADMIN-4's inline-removal scope, currently limited to Track A/B, extends to Track-C-passed live content — the coverage role Reading X depends on.

5. **Every action is audited.** Approve, Discard, Block, Remove, and Ban each write an append-only `mod_actions` row carrying a reason code that distinguishes content-removal (no ban) from user-ban. There is no silent suppression. **Discard is a moderation decision, not a no-op**, and is audited like the rest.

6. **No bet/ledger touch.** All five actions operate only at comment-visibility and account-state level. INV-1 (bet↔comment atomicity), INV-2 (Dharma non-transferable), and INV-3 (side frozen at comment-time) are untouched. **Ban removes voice, not balance.**

7. **ADR-0014 unchanged.** The pre-commit gate, vendor, fail-closed posture, and Track A/B/C verdict mapping are untouched. This ADR refines only the admin *consequence* actions downstream of the verdict; it does not re-open the gate.

8. **Amends F-MOD-3; supersedes nothing.** F-MOD-3's "no middle option" stance is replaced by the three-option held queue and the decoupled live actions. The corresponding SPEC.1 §14/§15 amendment is authored alongside this ADR.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| `mod_actions` action/reason enum (content-removal vs user-ban distinction; values `track_a_autoban`, `track_b_pending`, `approved`, `discarded`, `content_removed`, `user_banned`) | the moderation consequence path under `src/server/moderation/` + the `mod_actions` schema — **exact strings and schema owned by the DEBATE.7 plan**; this ADR mints only the requirement that content-removal and user-ban be *distinct* codes |

## Consequences

### Positive

- Reactive false-negative coverage works on live content without forcing a ban — Reading X's coverage role is realizable and proportionate.
- Author treatment is consistent: a ban follows from content/behaviour, not from whether OpenAI flagged the comment.
- Moderation is proportionate — a borderline comment can be removed without the heaviest sanction.
- The audit trail is richer and more honest — it distinguishes content-level from user-level actions.

### Negative

- One additional action to reason about on a safety-critical surface (three held options vs two; two live actions). *Mitigated by:* explicit UI labeling (Block bans the person; Discard/Remove do not) and keyboard triage with distinct keys (`a`/`d`/`b` held; `r`/`b` live).
- A removed-but-not-banned author can re-post, and a bad actor could repeat. *Acceptable because:* the gate runs on every re-post, repeated abuse escalates to Ban, and this is precisely the proportionality tradeoff the decoupling is chosen for.
- New `mod_actions` reason codes expand the schema surface DEBATE.7 must lay. *Acceptable because:* it is a small enum addition and DEBATE.7 owns the moderation schema regardless.

### Neutral

- Does not change ADR-0014 or the gate; it is purely a consequence-layer refinement.
- The "removed by moderator" placeholder and thread-integrity behaviour is a public-surface (debate-view) render detail, realized in the DEBATE.7 / dashboard build, not in the gate.

## Pros and Cons of the Options

### Option 1 — Decouple both axes (chosen)

**Pros**

- Serves Reading X's reactive coverage on Track C proportionately.
- Fixes the held-queue inconsistency uniformly.
- Proportionate sanctions; honest audit trail.

**Cons**

- One more action on a safety-critical surface (mitigated by labeling + distinct keys).
- Removed-not-banned authors can re-post (mitigated by the always-on gate + escalation to Ban).

### Option 2 — Keep the binary model (status quo)

**Pros**

- Simplest; fewest actions to reason about.

**Cons**

- Cannot cover Track C reactively without ban-on-sight.
- Inconsistent author treatment (ban depends on OpenAI's flag, not the content).
- Over-sanctions borderline content.

**Verdict:** Rejected. It cannot serve Reading X's reactive role proportionately, and the inconsistency it bakes in is the problem this ADR exists to fix.

### Option 3 — Decouple the live path only

**Pros**

- Covers the live-path coverage need.

**Cons**

- Leaves the held-queue inconsistency in place (OpenAI-flagged content forces a ban while admin-caught content does not).

**Verdict:** Rejected. The inconsistency is the core motivation; fixing it on one path only is half a fix.

### Option 4 — Graduated warn / three-strike model

**Pros**

- Richest middle ground (warnings, escalation tiers).

**Cons**

- Explicitly out of scope per SPEC.1 §14 ("no three-strike per E2", "no appeal in v1").
- Substantial build for a sole-admin v1.

**Verdict:** Rejected. Out of scope for the Experiment phase; revisit at testnet community-moderation. The two-axis decoupling is the minimal coherent change.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §14 | F-MOD-3 held-queue actions | **Shapes** — replaces binary Approve/Block with Approve/Discard/Block |
| SPEC.1 §15 | F-ADMIN-4 reactive-removal scope | **Shapes** — extends removal to Track-C live content |
| SPEC.1 §5 | INV-1 (bet↔comment atomicity) | **Consumes** — actions never touch the bet/ledger; held items never opened the tx |
| SPEC.1 §5 | INV-2 (Dharma non-transferable) | **Consumes** — ban removes voice, not balance; no Dharma movement |
| SPEC.1 §5 | INV-3 (side frozen at comment-time) | **Consumes** — actions are comment-visibility / account-state only |
| SPEC.1 §16.4 | append-only audit | **Consumes** — every action, including no-ban removal and Discard, writes a `mod_actions` row |
| ADR-0014 | pre-commit flow | **Consumes** — gate and verdict mapping unchanged; this refines consequences only |
| Tracker | DEBATE.7 (consequence wiring) + admin-dashboard stratum | All depend on this ADR being `accepted` |

## More Information

- SPEC.1 §14 (Moderation), §15 (Admin Operations — F-ADMIN-4), §16.4 (Audit Logs)
- ADR-0014 (Pre-Commit Moderation Flow)
- ADR-0010 (admin-is-not-a-participant — structural separation the consequence actions sit within)
- Admin-dashboard ideation synthesis (this chat's output)

---

*ADR-0020 ratifies the decoupling of content removal from user ban across both the held (Track B) and live (Track C) moderation paths, the three-option held queue (Approve / Discard / Block), the two-option live reactive path (Remove / Ban), the extension of reactive removal to Track-C content, and the requirement that every action write a distinct, audited `mod_actions` reason code. The decision body is immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
