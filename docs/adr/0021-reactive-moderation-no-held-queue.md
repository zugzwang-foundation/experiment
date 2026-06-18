# ADR-0021 — Reactive Moderation Model (No Held Queue)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-18 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | DEBATE.7 (consumer); admin-dashboard stratum (consumer) |
| **Frame document** | SPEC.1 §14 (Moderation), §15 (Admin Operations — F-ADMIN-4); SPEC.2 §10 (Pre-Commit Moderation Contract), §23 (ADR Index) |
| **Supersedes** | ADR-0020 (held queue removed in full) |
| **Superseded-by** | — |
| **Amends** | ADR-0014 (Track B verdict *consequence* only — §85 + the §154 verdict-router `track_b` outcome; the gate architecture is otherwise unchanged) |

---

## Context and Problem Statement

ADR-0020 and the SPEC.1 v1.0.6 amendment locked a three-disposition moderation model: the OpenAI gate classifies each comment as Track A (auto-ban: CSAM, sexual/minors, NSFW), Track B (**held for admin review**: graphic violence, hate, harassment, threats, self-harm, weapons), or Track C (passes, publishes live). Track B content was hidden and queued; an admin later chose **Approve / Discard / Block** (ADR-0020's three-option held queue), and on Approve the held bet settled. ADR-0014 ratified the gate architecture and pinned the Track B consequence to a `track_b_pending` `mod_actions` row plus the F-MOD-2 held-content response (§85; the §154 verdict-router emits `track_b` → held).

That model assumes **timely human review**. The Experiment has one operator, who is explicitly **not** moderating in real time. A disposition that blocks a user's argument from publishing until the operator happens to clear it makes every flagged user's voice depend on operator availability — unworkable for a sole, asynchronous operator, and incoherent now that the "review tier" the held queue existed to serve does not run on any meaningful clock. The "flag-but-don't-block" rationale for Track B was *that a human would review it quickly*; remove the quick human review and the only coherent treatment for gate-flagged harmful content is to **block it at the gate**.

This ADR resolves the model to match how the Experiment is actually operated: the OpenAI gate **blocks** flagged content at submission (Tracks A and B); everything that passes goes **live**; and the admin reviews the live stream **reactively, on their own schedule**, removing false-negatives and banning bad actors after the fact. No content is ever held pending review. Crucially — and this is the thesis-load-bearing constraint — **no moderation action moves a market position or mutates the ledger**: ban removes voice, not balance.

The decoupling principle ADR-0020 introduced (content removal and user ban are independent axes, each audited with a distinct reason code) **survives** and now governs the reactive Remove / Ban path, which is elevated from a secondary path to the **primary and sole** admin moderation action.

This ADR does **not** decide:

- The exact `mod_actions` reason-code strings and schema (DEBATE.7 plan owns the moderation schema; this ADR mints only the forward-compatible *set* and the content-removal-vs-user-ban distinction).
- The reactive-review feed's presentation beyond "live chronological stream, no filter, no ranking" — real-time delivery mechanism, market filter, and whether OpenAI category scores are surfaced as annotation to aid the eyeball scan (admin-dashboard stratum + SPEC.1 §15 IA).
- The `removed by moderator` placeholder and thread-integrity render on the public debate view (DEBATE.7 / dashboard build — a public-surface render detail).
- Track A degrade mode (HARDEN.5). **Forward note:** ADR-0021 removes the held queue that the ADR-0014 §190 degrade mode assumed flag-only Track A items would land in for manual ban. The HARDEN.5 degrade-mode decision must re-home flag-only Track A items into the reactive live-review surface rather than a held queue; that re-homing is HARDEN.5's to make, not this ADR's.
- Whether Track B block-and-revise needs abusive-retry-loop protection. This is the **same** provisional concern ADR-0014 §188 / F-MOD-4 already flagged for entry comments ("confirm or override during sample-content testing if revision creates abusive retry loops"), now also applying to Track B. HARDEN.5 owns it; this ADR introduces no new unbounded behaviour beyond the one already flagged.
- Per-category threshold values (HARDEN.5).
- The pre-commit gate's transaction-safety architecture, vendor selection, fail-closed posture, Redis reservation, idempotency-first ordering, or CSAM short-circuit (ADR-0014, unchanged — this ADR amends only the Track B *consequence*).

## Decision Drivers

1. **Solo asynchronous operator.** No real-time human review exists. A disposition that gates publication on operator availability is unworkable.
2. **Coherence.** With no quick human-review tier, the "flag-but-publish-anyway" basis for Track B collapses; gate-flagged harmful content must block at the gate.
3. **Moderation safety floor (guardrail).** Blocking *more* at the gate strengthens, not weakens, pre-publication moderation. Removing the held queue is not a relaxation — flagged content is now blocked outright rather than hidden-then-maybe-approved.
4. **Ledger immutability / thesis (guardrail).** No moderation action may move a market position or mutate the append-only ledger. The operator must be demonstrably unable to rewrite economic outcomes (INV-2). Ban removes voice, not balance; positions ride to resolution.
5. **Proportionality.** Track B gate-block rejects the *comment* without nuking the *account* — the author may revise and resubmit; the always-on gate re-checks; reactive Ban escalates for repeat or bad-faith actors. This is exactly the proportionality ADR-0020 chose the decoupling for, now applied at the gate.
6. **Surface reduction.** Collapsing three dispositions to two and removing the held queue, its held-content state, its three-option decision, and the held-bet settlement model shrinks the safety-critical surface DEBATE.7 must wire and review.

## Considered Options

1. **OpenAI blocks Track B at the gate (no ban); admin reactively Removes/Bans live content; no held queue; no moderation action touches positions** ← chosen
2. Keep the held queue (ADR-0020 status quo: Track B held; admin Approve / Discard / Block; Approve settles the held bet)
3. OpenAI passes Track B to live and the admin removes it reactively (publish-flagged-then-remove)
4. Block Track B **and** auto-ban the author (apply Track A auto-ban mechanics to Track B)

## Decision Outcome

**Chosen: Option 1 — reactive moderation; OpenAI blocks at the gate, the admin reviews live content after the fact, and no moderation action touches a position.**

The following are ratified:

1. **The OpenAI gate returns two dispositions: block or pass.** The "hold" disposition is removed.
   - **Track A** (CSAM, sexual/minors, NSFW) → **block + auto-ban author + CSAM auto-report (NCMEC legal floor)**. Unchanged from ADR-0014 §84. The bet+comment transaction never opens (F-MOD-4 trivially).
   - **Track B** (graphic violence, hate, harassment, threats, self-harm, weapons) → **block content only**. The submit is rejected; the bet+comment transaction never opens; no comment row, no bet row, no stake committed. The author receives a rejection response and **may revise and resubmit**. **No auto-ban.** This **supersedes** ADR-0014 §85's `track_b_pending` / F-MOD-2 held-content consequence and the §154 verdict-router's `track_b` → held outcome.
   - **Track C** (pass) → the bet+comment transaction proceeds normally via the ADR-0013 wrapper. Unchanged.

2. **No held queue.** The held-content state, the F-MOD-2 held-content response, the three-option held decision (F-MOD-3 Approve / Discard / Block), the held-bet settlement model, and the held-bet price keystone are all **removed**. Nothing is held; nothing waits for admin review before publishing. ADR-0020 is superseded in full.

3. **Admin moderation is reactive, post-publication, on live (passed) content — the primary and sole admin moderation action.** The admin reviews the live stream of passed posts on their own schedule (asynchronous; **no SLA, no real-time requirement**) and applies, on any live comment:
   - **Remove** — hide the live comment from all public surfaces; the author is untouched; **the author's bet rides to resolution**; the ledger is untouched. Replies under a removed parent remain (they are other users' stake-backed arguments); the parent renders a `removed by moderator` placeholder with the thread intact.
   - **Ban** — ban the author (account flagged, Daily Credit stops, no appeal per E2); **the author's positions ride to resolution**; the ledger is untouched.
   - **Remove and Ban are decoupled** — either may be applied without the other (carried forward from ADR-0020 §3, now the primary path).

4. **No moderation action moves a market position or mutates the ledger — ever.** Track A auto-ban, Track B gate-block, reactive Remove, and reactive Ban all operate **solely** at comment-visibility and account-state level. INV-1 (bet↔comment atomicity), INV-2 (Dharma non-transferable), and INV-3 (side frozen at comment-time) are untouched. **Ban removes voice, not balance; positions ride to resolution.** There is no compensating sell, no position unwind, no clawback, and no mechanism — at the gate or in the reactive path — by which the operator can affect a market's economic outcome. This is load-bearing for the thesis: the operator is demonstrably unable to rewrite who won.

5. **The admin review surface is the live chronological stream of passed content — no pre-publication admin step, no admin-side filtering, no algorithmic ranking.** Every passed post is shown; ordering is chronological; there is no prioritization or scoring-based sort. Feed enrichment — whether OpenAI category scores are surfaced as annotation to aid the operator's eyeball scan, plus the market filter and real-time delivery mechanism — is a **presentation detail owned by the dashboard stratum / SPEC.1 §15**, not ratified here. What is ratified is the *absence* of a held queue, an approval step, and a ranking.

6. **Every action is audited; the decoupling survives.** Content removal and user ban remain independent axes. Track A auto-ban, Track B gate-block, reactive Remove, and reactive Ban each write an append-only `mod_actions` row whose reason code distinguishes content-removal from user-ban (§16.4). There is **no silent suppression**.

7. **ADR-0014's gate architecture is unchanged except the Track B consequence.** The transaction-safety shape (no Postgres transaction held across the OpenAI HTTP call), the idempotency-cache-first ordering, the 10-second Redis SETNX intent reservation and its release on every exit path, the OpenAI vendor and pinned snapshot (`omni-moderation-2024-09-26`), the PhotoDNA CSAM short-circuit, and the fail-closed posture (terminal moderation failure → 503, no `mod_actions` row, reservation released, nothing posts unmoderated) are **all unchanged**. The OpenAI A/B/C *classification* is unchanged. ADR-0021 changes only the *consequence* of a Track B verdict: from held-pending to block-content. CSAM fail-open remains non-negotiable.

8. **Text-only `sexual/minors` carve-out (SCAFFOLD.16 LD-3) under the reactive model — block immediately + reactive admin review.** The LD-3 carve-out routes **text-only** `sexual/minors` flags to Track B (not Track A auto-ban) because the text classifier's false-positive rate on this CSAM-adjacent category is high (news / fiction / educational vectors) and auto-ban would punish legitimate authors. Removing the held queue must not silently strip human judgment from this one child-safety-adjacent routing. Therefore this category is handled as a **scoped exception** to both the general Track B block (#1) and the audit-only disposition: the content is **blocked at the gate immediately** — it never publishes, so the safety property holds regardless of operator availability — **the author is not auto-banned**, and the `mod_actions` row (reason `sexual_minors_text_blocked`) **surfaces in the admin's reactive review** so a human can ban a true-positive author. This preserves LD-3's human-judgment intent in reactive form: block now, human reviews for the ban decision later. **Image-attached** `sexual/minors` continues to route to **Track A** (block + auto-ban + CSAM auto-report), unchanged. This carve-out resolves the prior **SPEC.1 Appendix A ↔ SPEC.2 §10 drift** in favour of LD-3 (Track B intent); the SPEC.1 Appendix A row for text-only `sexual/minors` — which stale-read "Track A auto-ban" — is corrected in the same amendment to reflect this disposition.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| `mod_actions` reason-code enum (content-removal vs user-ban distinction; forward-compatible set: `track_a_autoban`, `track_b_blocked`, `content_removed`, `user_banned`) | the moderation consequence path under `src/server/moderation/` + the `mod_actions` schema — **exact strings and schema owned by the DEBATE.7 plan**; this ADR mints only the forward-compatible set and the requirement that content-removal and user-ban be *distinct* codes |

## Consequences

### Positive

- The moderation model matches how the Experiment is actually operated — asynchronous reactive review, no dependency on operator availability for a user's argument to publish.
- Stronger pre-publication moderation: gate-flagged harmful content is blocked outright rather than hidden-then-maybe-approved.
- The safety-critical surface shrinks materially — no held-content state, no three-option decision, no held-bet settlement, no submission-vs-approve price keystone, no freeze-edge disposition for held items. DEBATE.7 becomes tighter and more reviewable.
- Proportionate sanction at the gate: a Track B flag rejects the comment without banning the account; the author may revise; reactive Ban escalates for repeat actors.
- The thesis guarantee is strengthened and made legible: the operator demonstrably cannot move a market position by any moderation action.
- The decoupling principle and its honest audit trail (distinct content-removal vs user-ban reason codes) are retained.

### Negative

- A banned bad actor **keeps any winning market position** — the operator removes voice and account, not winnings. *Accepted because:* clawing back a position is exactly the ledger mutation the thesis forbids (INV-2); the economic bet was right or wrong on the market's merits independent of whether the comment was acceptable. Policing speech and conduct is decoupled from rewriting economic outcomes by design. **(This is the ratified consequence Hrishikesh accepted — Model 3.)**
- Track B gate-block can false-positive — OpenAI may flag a strongly-worded-but-legitimate argument as harassment/hate and block it with no human appeal. *Mitigated by:* HARDEN.5 threshold tuning against real sample content; a false-positive-blocked user may rephrase and resubmit; the block rejects the comment, not the account.
- A revise-and-resubmit loop on a persistently-flagged Track B comment is possible. *Mitigated by:* this is the **same** provisional concern ADR-0014 §188 already flagged (now extended to Track B); HARDEN.5 owns abusive-retry-loop handling; reactive Ban escalates a bad-faith retrier.
- The image-category false-negative gap (hate/harassment/weapons in images, which omni-moderation cannot classify) is now covered **only** by reactive admin removal of live content — there is no held-queue second look. *Accepted because:* it was the accepted v1 coverage role for reactive removal regardless (a third image classifier was rejected); reactive Remove on live content is precisely that coverage.

### Neutral

- ADR-0014's gate architecture is otherwise untouched; this is a consequence-layer change to one verdict branch plus the removal of a downstream queue.
- The `/admin/moderation` surface persists, but its content changes from a held queue (pre-publication approval) to a live review stream (post-publication reactive removal). The dashboard stratum builds the live-review surface.
- ADR-0020's decoupling principle and Remove/Ban semantics are preserved verbatim; only its held queue is removed.
- Text-only `sexual/minors` (LD-3) is the **one** category surfaced in the admin's reactive review despite being blocked (never published) — a scoped exception to the audit-only disposition, justified by the child-safety sensitivity of the category. Every other blocked Track B item is audit-searchable only.

## Pros and Cons of the Options

### Option 1 — Reactive moderation; gate blocks Track B; no held queue (chosen)

**Pros**

- Matches the solo asynchronous operator; no publication dependency on operator availability.
- Strengthens pre-publication moderation (block-at-gate) while shrinking the safety-critical surface.
- Preserves the thesis guarantee (no moderation action touches a position) and makes it legible.
- Retains the decoupling principle and honest audit.

**Cons**

- A banned actor keeps a winning position (accepted — clawback is the forbidden mutation).
- Track B false-positives block legitimate argument with no appeal (mitigated by HARDEN.5 tuning + revise-and-resubmit).

### Option 2 — Keep the held queue (ADR-0020 status quo)

**Pros**

- Preserves a human second-look on flagged-but-possibly-legitimate content before it is blocked outright.

**Cons**

- Requires timely human review the sole asynchronous operator cannot provide; a user's argument waits on operator availability to publish.
- Carries the held-content state, three-option decision, held-bet settlement model, submission-vs-approve price keystone, and freeze-edge disposition — a large safety-critical surface for a review tier that does not run on a meaningful clock.

**Verdict:** Rejected. The held queue's premise — quick human review — does not hold for this operator; the model it forces is unworkable and the surface it carries is unjustified.

### Option 3 — Publish Track B to live, remove reactively

**Pros**

- Maximally simple gate (block only Track A); everything else publishes.

**Cons**

- Publishes gate-flagged harmful content (graphic violence, hate, threats) **by default**, live, until a non-real-time operator happens to catch it — an exposure window for known-flagged content.
- Brushes the moderation safety-floor guardrail ("never weakened").

**Verdict:** Rejected on guardrail grounds. Publishing content the gate has already flagged as harmful, and relying on asynchronous reactive removal to catch it, weakens pre-publication moderation. If the classifier is confident enough to flag it, block it.

### Option 4 — Block Track B and auto-ban (Track A mechanics for Track B)

**Pros**

- Strongest deterrent; one uniform block-and-ban consequence for all flagged content.

**Cons**

- Disproportionate: auto-bans on a single classifier flag of content that may be a false positive or a fixable phrasing — exactly the "ban-on-sight is disproportionately blunt" failure ADR-0020 was chosen to avoid.
- Self-harm-flagged content auto-banning the author is actively harmful (the author may need support, not a ban).
- Conflates the content axis with the user axis the decoupling principle keeps separate.

**Verdict:** Rejected. Track B gate-block must be a **content** action (reject the comment, author may revise), not a **user** action (ban). Auto-ban is reserved for Track A's egregious, non-revisable categories. The reactive Ban path handles repeat/bad-faith escalation.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §14 | three-track disposition table | **Shapes** — Track B consequence changes from held-for-review to block-content; gate returns block/pass, not block/hold/pass |
| SPEC.1 §14 | F-MOD-2 (held content), F-MOD-3 (Approve/Discard/Block) | **Shapes** — both removed (no held queue) |
| SPEC.1 §15 | F-ADMIN-4 reactive Remove/Ban | **Shapes** — elevated from secondary to primary/sole admin moderation action; scope is reactive removal of live (Track C) content |
| SPEC.1 §5 | INV-1 (bet↔comment atomicity) | **Consumes** — no action touches the bet/ledger; Track A/B gate-blocks never open the tx |
| SPEC.1 §5 | INV-2 (Dharma non-transferable) | **Consumes** — ban removes voice, not balance; no Dharma movement, no clawback |
| SPEC.1 §5 | INV-3 (side frozen at comment-time) | **Consumes** — actions are comment-visibility / account-state only |
| SPEC.1 §16.4 | append-only audit | **Consumes** — every action (Track A auto-ban, Track B block, Remove, Ban) writes a `mod_actions` row with a content-removal-vs-user-ban reason code |
| SPEC.1 §16.5 | CSAM legal floor | **Consumes** — Track A CSAM auto-report unchanged; fail-open non-negotiable |
| ADR-0014 | §85 + §154 verdict-router `track_b` | **Amends** — Track B consequence only (held-pending → block-content); gate shape, vendor, fail-closed, Redis reservation, idempotency-first, CSAM short-circuit unchanged |
| ADR-0014 | §190 degrade mode | **Shapes (forward)** — removes the held queue flag-only Track A items assumed; HARDEN.5 must re-home them to the reactive live-review surface |
| SPEC.2 §10 / SPEC.1 App. A | SCAFFOLD.16 LD-3 (text-only `sexual/minors`) | **Shapes** — under no held queue, text-only `sexual/minors` → block immediately + reactive admin review (block-now-ban-later, #8), not held; resolves the SPEC.1 Appendix A ↔ SPEC.2 §10 drift in favour of LD-3 and corrects the stale Appendix A "Track A" read |
| ADR-0020 | held queue + decoupling | **Supersedes** the held queue (Approve/Discard/Block) in full; **retains** the decoupling principle and Remove/Ban semantics |
| ADR-0010 | admin-is-not-a-participant | **Consumes** — the reactive moderation actions sit within the structural admin/user separation; admin holds no position |
| ADR-0013 | bet wrapper (§8 moderation-unaware) | **Consumes** — Track C proceeds via the wrapper; the wrapper sees no moderation context |
| Tracker | DEBATE.7 + admin-dashboard stratum | All depend on this ADR being `accepted` |

## More Information

- ADR-0020 (Decoupled Content Removal and Three-Option Held Queue — superseded; decoupling principle retained)
- ADR-0014 (Pre-Commit Moderation Flow — Track B consequence amended; architecture unchanged)
- ADR-0013 (Concurrency / bet transaction — §8 moderation-unaware wrapper)
- ADR-0010 (admin-is-not-a-participant)
- SPEC.1 §14 (Moderation), §15 (Admin Operations — F-ADMIN-4), §16.4 (Audit Logs), §16.5 (CSAM legal floor)
- SPEC.2 §10 (Pre-Commit Moderation Contract), §23 (ADR Index)

---

*ADR-0021 ratifies the reactive moderation model: the OpenAI gate returns block (Track A: block + auto-ban + CSAM report; Track B: block content, no ban, author may revise) or pass (Track C: publishes live); there is no held queue; the admin reviews live content reactively and asynchronously, applying decoupled Remove / Ban; and no moderation action — at the gate or in the reactive path — moves a market position or mutates the append-only ledger (ban removes voice, not balance). Text-only `sexual/minors` (the SCAFFOLD.16 LD-3 carve-out) is blocked immediately and surfaced for reactive human ban-review, preserving child-safety oversight without a held queue. It supersedes ADR-0020's held queue in full while retaining ADR-0020's decoupling principle, and amends ADR-0014's Track B verdict consequence only. The decision body is immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
