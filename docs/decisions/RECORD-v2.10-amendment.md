# DECISION RECORD — amendment 2.10

**Amends** `RECORD-v2.0.md` · follows every amendment on disk before it (measured: `ls docs/decisions/`) · **Opened** 2026-09-22
**Rulings** D-51


---

## D-51 · The friendly-fire toggle — a declared stance on same-side reply-bets

**Ruled:** 2026-09-22 · **Task:** FF-1 · **Baseline measured at:** `origin/main` 22b39987

### Context

A reply-bet's stance toward its parent is not declared; it is inferred from the replier's position. Same side as the parent's frozen side ⇒ *Support*; opposite ⇒ *Counter* (`SPEC.1` §8 F-COMMENT-2, "a derived classification, never a stored verdict"). That welds two judgments into one: agreement with the **conclusion** (the position, rightly constrained by the single-side rule) and agreement with **this argument** (the stance, which the single-side rule was never meant to constrain). A participant holding YES therefore cannot contest a YES argument: the only reply available is Support, and every same-side critique is stored, ranked, displayed and exported as endorsement. Because `comments` and `bets` are Bucket-A append-only, the mislabel is permanent.

The consequence is a **measurement error in the experiment's own instrument**, not a missing convenience: the dataset's Support/Counter labels are wrong for exactly the replies the thesis cares about most — informed participants correcting their own side; the balance term `b` reads a post its own side is tearing apart as an uncontested blowout; and the split bar tells readers the opposite of what was written. The system cannot distinguish *right for the right reasons* from *right for the wrong reasons*, and it privileges tribal cohesion over accuracy.

This cell existed once. ADR-0009's friendly-fire was a **free** vote with eligibility *cross-aisle up / same-side down*. ADR-0017 P1 (2026-06-03) removed it entirely for one reason — it cost no Dharma (Driver 3) — and the reply-as-bet model that replaced it re-expressed only the two with-interest cells (Support, Counter). The against-interest cells were dropped, not replaced. This ruling re-expresses one of them **as a bet**, which is what Driver 3 demands.

Ruled in one sitting on 2026-09-22 with web Claude, pre-launch, on the founder's own design.

### Decision

**R1 — Name and mechanic.** The feature is named **friendly fire** in the product, `friendly_fire` in the schema, and *the friendly-fire toggle* in every specification. It is a **compose-time boolean on a Support reply-bet**. It is **not** the friendly-fire vote ADR-0017 P1 removed: that was a free, standalone up/down affordance with its own table; this is a flag on a staked reply and has no affordance of its own, no table, no tally, nothing to cast or clear. Every sentence in the corpus reading *"friendly-fire is removed entirely"* remains true of the vote and gains a one-line rider saying so; none is rewritten. "Dissent" as a name is rejected — it reads like Counter; the name must say *the same side is criticising*.

**R2 — Eligibility.** The toggle exists on **replies only**, and only when the reply is a **Support** — the replier's side equals the parent's `side_at_post_time`. That includes an **entry reply** placed as Support (supporting puts the entrant on that side). It is never offered on a Counter and never on a top-level post. Enforcement: the write path rejects `friendly_fire = true` on an opposite-side reply (400 `friendly_fire_requires_support`) and on a top-level post (400 `friendly_fire_requires_reply`); the top-level half is additionally a DB CHECK. The same-side half is not DDL (it needs the parent row) and is pinned by test.

**R3 — The stake.** A friendly-fire reply is an ordinary buy on the replier's **own** side. It lands in the same pool as a plain Support, moves the price identically, clears the same reply floor, and appends to the ledger identically. The single-side rule (F-BET-10), the CPMM, lots, floors, moderation, rate limits and idempotency are **untouched**. A counter from your own team cannot go to the other pool without breaking the single-side lock; this is the only form a same-side critique can take.

**R4 — Immutability.** The flag is set on INSERT and never updated — `comments` is Bucket A, and the existing append-only trigger is the enforcement. There is no un-firing, no clear, no edit. Like the side badge, it freezes at resolution with everything else. No new hard-locked invariant is minted; the existing INV-4 append-only discipline covers it.

**R5 — Display.** **No friendly-fire count renders anywhere** — not on the card, not in `Replies · N`, not in the lane. The **post card is untouched**: its Support/Counter split bar and figures are unchanged, and friendly-fire Đ rolls into the Support figure (same pool). A friendly-fire reply wears a **`Friendly fire` tag** in the reply lane, built from the same marker primitive as Flipped / Exited. The post-focus **Support lane header** carries a one-sided **friendly-fire meter**: `friendly_fire_dharma ÷ support_dharma`, both on Dharma **still held** and both excluding the post author's own replies, rendered 0–100 % — friendly-fire Đ above the Support pill, total Support Đ below, in the same family as the split bar; hidden while `support_dharma` is zero. **No badge and no badge variant** for friendly fire; the meter is the explanation.

**R6 — Ranking** (delegated to web Claude on 2026-09-22; recorded here so it is a ruling, not a recollection). Traction `n` and stake `D` do not read the flag: a friendly-firer is a person attracted, and their Dharma is real. **Balance `b` reads the declared stance**: `b = min(endorse_count, contest_count) / max(endorse_count, contest_count)`, where `endorse_count` is the distinct people (post author excluded) whose same-side replies carry no flag and `contest_count` the distinct people who countered *or* friendly-fired, counted once each even if they did both. `lop = 1 − b` and the Contested lane `n ^ b` follow. Reply-lane ordering is unchanged: friendly-fire replies sit in the Support lane, by Dharma still held. The Contested badge's label is unchanged; a Contested badge on a card whose bar shows no Counter is explained by the lane meter in post-focus — **accepted**. With no flag set anywhere, every order and every badge is byte-identical to today; that identity is a regression guard.

**R7 — Dataset and metric.** `comments.friendly_fire` **SHIPs** (Appendix B.6) and the `comment.placed` payload key `friendlyFire` **SHIPs**. The dataset exporter on PR #435 is **not touched** by FF-1 — it predates `lots`, and a column it does not have breaks its suite until rebase; the exporter change is docketed in `docs/parked.md` with the trigger *"at #435's rebase for its post-2026-11-05 merge, add `friendly_fire` to the comments export."* The post-hoc metric — same-side dissent share, per post and per market side — derives from the dataset; **no in-product surface** for it in v1.

**R8 — Rejected and deferred.** Rejected: a third reply pill; any friendly-fire count; a badge or badge variant; the name "Dissent". **Deferred, parked with reasoning:** the mirror cell (an opposite-side holder *endorsing* a parent) — it is free *and* in the actor's interest (a NO holder could promote the weakest YES arguments at no cost), the opposite gaming profile from friendly fire, which costs a bet against the actor's interest. The schema does not pre-build it.

**R9 — Execution.** Pre-launch; launch is not done as of this ruling. FF-1 runs as an **overnight run under `docs/overnight-run.md` v1.2, extended for this task on two points the doctrine excludes**: (i) prescriptive text — this amendment, ADR-0058, and the `SPEC.1` / `SPEC.2` / `RANKING.md` / `design-language.md` amendment blocks — is **web-authored** and **committed verbatim** by the session, which fills only measured slots and improvises nothing; a block that fails to match its anchor exactly once is CARRIED, not rewritten; (ii) the migration is reviewed **in-session by `@db-migration-reviewer`** under a written posture (expand-only, reversible, no trigger edit, CI's migrate + drift-check as mechanical gates). The doctrine is patched to **v1.3** at close-out recording this extension. Two stacked pull requests (server, then UI); **nothing merges overnight**; Gate C and merge are the founder's. `SPEC.1` moves by this ruling (D-22); the ADR records the architecture and does not amend `SPEC.1` on its own.

### Consequences

**Positive.** The against-interest signal ADR-0009 named among the strongest K-signals returns, as a bet. Support/Counter labels in the dataset become true for the replies that matter most. The Contested lane stops reading internal contestation as consensus. The money layer is not touched.

**Negative.** A same-side reader who wants to say *"good conclusion, bad argument"* must press **Support** and then flip a switch — the label they press is not the thing they mean. Accepted: the switch copy carries the meaning (*Contest this argument without leaving your side. Your stake still backs YES.*), and the alternative (a third pill) reads like Counter. A market-view reader does not see internal dissent until post-focus. Accepted: the card is unchanged by ruling.

**Enforced at:** `SPEC.1` §2, §7, §8 F-COMMENT-2, §9, §20 · `SPEC.2` §0.1, §5.1 row 4, §5.4, §5.5, §13.3, §19.4.1, Appendix B.6 · `RANKING.md` header, §1, §2, §5, §6.1, §7 · `docs/design/design-language.md` §3.1, §6 · `docs/adr/ADR-0017` (metadata + callout) · `docs/adr/0058-friendly-fire-toggle.md`.

---

*End amendment 2.10.*
