# ADR-0058 — Friendly-Fire Toggle: a Declared Stance on Same-Side Reply-Bets

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-22 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | FF-1 |
| **Frame document** | Decision record D-51 (amendment 2.10) · SPEC.1 §8 F-COMMENT-2, §9 · SPEC.2 §5.1 row 4, §5.4 |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0017 — the balance term `b` now reads declared stance (endorse vs contest) instead of side; every other ADR-0017 outcome stands |
| **Amended-by** | — |

---

## Context and Problem Statement

Under the reply-as-bet model a reply's stance toward its parent is **inferred from position**: same side as the parent's `side_at_post_time` ⇒ Support, opposite ⇒ Counter (SPEC.1 §8 F-COMMENT-2; SPEC.2 ReplyAffordance). Position is rightly constrained by the single-side rule (SPEC.1 §7, F-BET-10). Stance is not a position and should not be — but because it is derived from one, a participant who holds YES cannot contest a YES argument at all. The only reply the composer offers is Support, so a same-side critique is stored as `Support`, summed into `support_dharma`, counted toward `support_count`, rendered under the Support pill, and exported with the wrong label. `comments` and `bets` are Bucket A, so the mislabel can never be corrected.

Three things go wrong at once. **The dataset lies** on the replies the thesis cares about most — informed participants correcting their own side. **The ranking reads it backwards**: `b = min(support, counter)/max(support, counter)` scores a post with ten endorsements and ten same-side critiques as `b = 0`, an uncontested blowout that can never wear *Contested*. **Readers are shown the opposite of what was said.** The system cannot tell *right for the right reasons* from *right for the wrong reasons*, and it privileges tribal cohesion over accuracy.

The cell is not new. ADR-0009's friendly-fire was a free up/down vote with eligibility *cross-aisle up / same-side down*; ADR-0017 P1 removed it because it was free (Driver 3), and reply-as-bet re-expressed only the two with-interest cells. This ADR re-expresses the same-side-contest cell **as a bet** — a flag on a staked Support reply — which satisfies the driver that removed the vote. The founder ruled the design on 2026-09-22 (D-51), pre-launch.

This ADR does **not** decide:

- The single-side rule, floors, price impact, lots, moderation, rate limits, idempotency — untouched (ADR-0013, ADR-0018, ADR-0031, ADR-0039, ADR-0044, ADR-0046).
- The mirror cell — an opposite-side holder endorsing a parent — deferred and parked by D-51 R8; the schema does not pre-build it.
- The dataset exporter on PR #435 — docketed in `docs/parked.md` (D-51 R7).
- Any friendly-fire count, badge or badge variant — rejected by D-51 R5.
- The ranking constants (`k_lane`, `floor_lane`, `floor_split`, `c`, `g`) — number-tuning pass, `RANKING.md` §12.

## Decision Drivers

1. **No stake, no voice — applied to stance as well as position.** Every ranking input must cost Dharma (ADR-0017 Driver 3). A stance that rides a ≥ 50 Đ reply-bet costs exactly what a Support costs; a standalone vote would not.
2. **The single-side rule must not move.** A same-side critique must be an own-side buy. The design that stakes the critic on the *other* side breaks the lock; the design that gives the critic a free label breaks Driver 3. Only a flag on an own-side bet satisfies both.
3. **Append-only, frozen at resolution.** The stance must be set once at post time and never mutate — the removed vote's `cast`/`clear` shape is the shape to avoid.
4. **Minimal blast radius on the money path.** The bet engine, ledger and lots must not change; only what is recorded and read about a reply may.
5. **Legibility of the dataset.** With no flag set anywhere the model must produce byte-identical orders to today, so the change is auditable as a pure extension.
6. **Founder-ruled surface** (D-51 R5): toggle not pill, meter not count, card untouched, no badge.

## Considered Options

1. **A compose-time boolean on a Support reply-bet, read by the balance term** ← chosen
2. A third reply kind ("Dissent") with its own pill, stored as an enum stance
3. A standalone friendly-fire vote (the ADR-0009 mechanic), stake-free
4. Status quo — same-side critics post a separate top-level rebuttal

## Decision Outcome

**Chosen: Option 1 — the friendly-fire toggle.**

1. **Schema.** `comments.friendly_fire boolean NOT NULL DEFAULT false`, set on INSERT only. Table CHECK `comments_friendly_fire_requires_parent`: `parent_comment_id IS NOT NULL OR friendly_fire = false`. The same-side condition is enforced on the write path (it needs the parent row) and pinned by test. Bucket A classification unchanged; the existing append-only trigger is the immutability enforcement. Migration is expand-only and reversible (`DROP COLUMN`).
2. **Write path** (`src/server/bets/place.ts` and every reply entry point that reaches it). The reply request carries `friendlyFire` (boolean, default `false`). Pre-transaction and again inside W-1 after the parent read: `friendlyFire = true` with no `parent_comment_id` → 400 `friendly_fire_requires_reply`; with `parent.side_at_post_time ≠` the side being bought → 400 `friendly_fire_requires_support`; no state is written in either case. Otherwise the comment row inserts with the flag; the bet is an ordinary own-side buy — F-BET-1 (entry) or F-BET-2 (subsequent) with `parent_comment_id` set, reply floor, `BET_MAX_STAKE` clamp, all unchanged. The `comment.placed` event payload gains `friendlyFire`; no new event type. The idempotency body fingerprint covers the field (a replay with the flag flipped is 409 `error_idempotency_key_reused`).
3. **Reply affordance.** `computeReplyAffordance` is unchanged. A pure helper `friendlyFireEligible(parentSide, sideBeingBought)` → `parentSide === sideBeingBought` decides whether the composer offers the switch: for a held position that is `held === parentSide`; for an entry reply it is whichever side the entrant chose. It is UI guidance only; the write path is the guard.
4. **Read models.** The reply substrate adds `friendly_fire_dharma` (DISPLAYED — surviving basis over same-side flagged reply-bets by others; a subset of `support_dharma`, which is unchanged and still includes it) and two RANKING INPUTS, `endorse_count` (distinct people, post author excluded, whose same-side replies carry no flag) and `contest_count` (distinct people who countered or friendly-fired, counted once). Each reply DTO carries `friendlyFire`. The `.md` export marks flagged replies.
5. **Ranking** (`RANKING.md`, amending ADR-0017). `n` and `D` unchanged. `b = min(endorse_count, contest_count) / max(endorse_count, contest_count)`; `lop` and `n ^ b` follow. Reply-lane order unchanged (flagged replies stay in the Support pool, by Dharma still held). Badge vocabulary unchanged. Property: with all flags false, `endorse_count = support_count` and `contest_count = counter_count`, so every order and badge is identical to the pre-ADR model.
6. **Surface** (D-51 R5). Composer: a **Friendly fire** switch under the Support pill, default off, shown only when `friendlyFireEligible` holds, hidden and reset when Counter is selected; copy *"Contest this argument without leaving your side. Your stake still backs YES/NO."* Reply row: a **Friendly fire** tag from the marker primitive. Post-focus Support lane header: the **friendly-fire meter** — friendly-fire Đ above the Support pill, a single-fill bar in the split-bar family reading `friendly_fire_dharma ÷ support_dharma` as 0–100 %, total Support Đ below; hidden while `support_dharma = 0`. Post card: unchanged. No counts, no badge. Desktop and the phone tier both.
7. **Dataset.** `comments.friendly_fire` and `comment.placed.friendlyFire` SHIP (SPEC.2 Appendix B.6, §19.4.1). Exporter change parked (D-51 R7).

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Column + CHECK | `src/db/schema/<comments domain file>.ts` · `drizzle/migrations/<NNNN>_comments_friendly_fire.sql` |
| Write-path eligibility + error codes | `src/server/bets/place.ts` |
| Composer eligibility helper | `src/server/comments/foreclosure.ts` (`friendlyFireEligible`) |
| Aggregates (`friendly_fire_dharma`, `endorse_count`, `contest_count`) | `src/server/debate-view/reply-substrate.ts` · `src/server/debate-view/ranking-substrate.ts` |
| Balance term | `src/lib/ranking.ts` |
| Event payload key | `src/server/events/schemas.ts` (`comment.placed`) |

## Consequences

### Positive

- The against-interest signal returns at full Driver-3 cost; no free input enters ranking.
- Dataset labels become true for same-side critique; the balance lane reads contestation as contestation.
- The money path is untouched: no engine, ledger, lot, floor or price-impact change; no new invariant.
- Pure extension: with no flag set, orders, badges and figures are byte-identical to today.
- Gaming is self-defeating: to friendly-fire a YES post an actor must buy YES; nothing in the model lowers a post, so the flag cannot sink a rival.

### Negative

- The label a same-side critic presses is **Support**. Acceptable because: the switch copy carries the meaning, and the founder ruled toggle over pill (D-51 R1, R5).
- The stance label is free *once a reply-bet is being placed*; a coordinated actor can fake "organic internal dissent". Acceptable because: it moves neither price nor rank capture — it taints only the post-hoc dissent-share metric, which the dataset README will say.
- A **Contested** badge can appear on a card whose split bar shows no Counter. Acceptable because: the lane meter in post-focus explains it; founder-accepted (D-51 R6).
- A person who both plain-supports and friendly-fires the same post appears on both pans of `b`. Acceptable because: it is the same shape the flip path already has across sides (RANK-3), and it is pinned by test so nobody rediscovers it.

### Neutral

- The word "friendly fire" now names two mechanics in the corpus — the removed vote and this toggle. Every "removed entirely" sentence gains a rider; ADR-0017 carries an `Amended-by` row and a callout, its body untouched (D-33 R3 shape).
- `EXPECTED_GUARD_CATALOG_ROWS` is unchanged — no new trigger, no new guard.
- The phone tier (ADR-0051) is in scope for the three surface elements; nothing else on mobile moves.

## Pros and Cons of the Options

### Option 1 — Compose-time boolean on a Support reply-bet (chosen)

**Pros:** costs a bet (Driver 1); own-side by construction (Driver 2); one column, set once (Driver 3); engine untouched (Driver 4); identity with today when unset (Driver 5); matches the ruling (Driver 6).
**Cons:** "Support" is the label pressed; a free label on a paid bet (recorded above).

### Option 2 — Third reply kind with its own pill and an enum stance

**Pros:** explicit choice; future-proofs the mirror cell.
**Cons:** a third pill reads like Counter to readers and invites the wrong bet; more composer surface; rejected by the founder.
**Verdict:** Rejected. Same data, worse surface.

### Option 3 — Standalone friendly-fire vote (ADR-0009 shape)

**Pros:** no bet needed to criticise.
**Cons:** free input — sybil-trivial, carries no K; the exact mechanic ADR-0017 P1 removed.
**Verdict:** Rejected on Driver 1.

### Option 4 — Status quo, rebut with a top-level post

**Pros:** nothing to build.
**Cons:** no linkage to the argument being rebutted; the bad post keeps accruing "support"; the dataset stays wrong.
**Verdict:** Rejected. It does not fix the instrument.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| D-51 | Decision record amendment 2.10 | **Consumes.** Every outcome above is the ruling; this ADR records the architecture. SPEC.1 moves by the ruling (D-22), not by this file. |
| SPEC.1 §5 INV-1 | Bet ↔ comment atomicity | **Consumes.** The flag rides the comment row inserted inside W-1; no new write outside the transaction. |
| SPEC.1 §5 INV-3 | Side bound at post time | **Consumes.** The flag is bound in the same INSERT as `side_at_post_time`; a flagged reply's side is still the bet's side. |
| SPEC.1 §5 INV-4 / SPEC.2 §6 | Append-only, frozen at resolution | **Consumes.** Immutability of the flag is the existing Bucket-A trigger; no new invariant minted. Pinned by a db test that UPDATEs the column and is refused. |
| SPEC.1 §7 F-BET-10 | Single-side rule | **Consumes.** A flagged reply is an own-side buy; `opposite_side_held` still governs. Mints nothing. |
| SPEC.1 §8 F-COMMENT-2 | Reply flow | **Shapes.** Adds the flag, two error codes and the response key; the derived Support/Counter classification stands. |
| SPEC.1 §9 | Ranking model | **Shapes.** Adds two stance counts; redefines `b`; `n`, `D`, reply order and badges stand. |
| SPEC.2 §5.1 row 4 | `comments` | **Mints** the column and CHECK. |
| SPEC.2 §5.4 | Read-time aggregates | **Mints** `friendly_fire_dharma`, `endorse_count`, `contest_count`. |
| SPEC.2 §19.4.1 / Appendix B.6 | Dataset | **Mints** two SHIP rows; exporter change parked (D-51 R7). |
| ADR-0017 P1 | Friendly-fire vote removed | **Consumes.** The vote stays removed; this is a different mechanic. |
| ADR-0039 R4 / P2 / P3 | Surviving basis · self-exclusion · counts are people | **Consumes.** All three apply to the new aggregates unchanged. |
| ADR-0031 | Durable receipts, body fingerprint | **Consumes.** The fingerprint covers `friendlyFire`. |
| ADR-0051 | Phone tier | **Consumes.** The three surface elements land on both tiers. |

## More Information

**Error codes minted:** `friendly_fire_requires_reply` (400) · `friendly_fire_requires_support` (400).

**Guards** (each names the wrong answer it rejects): column default and CHECK (a top-level flagged row inserts) · trigger refuses UPDATE of the flag (the flag is mutable) · flagged reply buys the held side and leaves the position side unchanged (the stake lands opposite) · opposite-side flag → 400 with no rows (a Counter carries the flag) · top-level flag → 400 (a post carries the flag) · entry reply as Support with the flag (the entrant lands on the wrong side) · replay with the flag flipped → 409 (a replay silently changes stance) · `comment.placed` payload carries the key (the event log is incomplete) · substrate figures on a fixed fixture (the meter or `b` reads the wrong bucket) · `n` and `D` invariant under any flag assignment, `b` not (the flag leaks into traction or stake) · all-flags-false ⇒ orders byte-identical to the pre-ADR model (the extension is not pure) · composer, tag, meter and card markup (the switch shows on Counter; the card grew a friendly-fire element) · `.md` export marks flagged replies.

**Rejected by ruling, recorded so it is not re-derived:** counts, badge, badge variant, third pill, "Dissent", the mirror cell (parked).
