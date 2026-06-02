# ADR-0018 — Dharma Issuance, Daily Credit & Asymmetric Minimum-Bet Floors

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-01 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SYNC.5 (issuance ruling — the gate item) |
| **Frame document** | SPEC.1 (product surface: economy, bet floors); SPEC.2 §23 (ADR Index); number-tuning pass (2026-09-01) |
| **Supersedes** | — (supersedes the informally-documented "fixed signup grant + daily login credit" draft, which was never ratified into a spec or ADR) |
| **Superseded-by** | — |

---

## Context and Problem Statement

Dharma is Zugzwang's soulbound, non-transferable reputation token. In the experiment phase it is the **only** participant-side instrument (Artha is a market-maker instrument and out of participant scope per the locked two-instrument architecture). Dharma is dual-use: it is simultaneously a participant's **reputation score** and the **stake** they commit to place a bet — and, because every bet carries mandatory commentary, the stake is also the cost of **voice**. "No stake, no voice" (locked floor, sharpened in SYNC.4 to mean *influence must cost something*) makes the issuance question load-bearing: how a participant acquires Dharma directly determines what one unit of participation costs, and therefore the integrity of the `n` half of the thesis **K · n > C**.

This ADR resolves the three issuance parameters the experiment must ship with:

1. The **initial grant** — how much Dharma a new account receives.
2. The **daily credit** — recurring Dharma for returning participants.
3. The **minimum bet** — the floor stake per bet, which this ADR splits into **two** floors (fresh posts vs. replies).

**The gate status.** This was escalated in SYNC.4 and parked "to resolve WHEN Dharma issuance is defined." It is the gate for SYNC.5 because participation-counting, "Most Debated," and the meaning of "informed participation" are all undefined until one unit of participation has a cost. Sybil resistance is **deliberately deprioritized** for the experiment (no cash value, 7-week disposable window, content-moderation pipeline exists) — this ADR therefore rules issuance *economics*, not sybil *identity* (the latter is noted as a live second-order risk, not resolved here).

**The structural fact that shapes everything.** Markets do **not resolve during the live window** (Sep 15 – Nov 5); resolution is at conclusion (Nov 6). Therefore **no losing bet removes Dharma during play** — there is a *faucet* (grant + daily credit) but **no loss-driven sink**. The only in-window sink is Dharma *locked* in open positions. Every unit issued is near-permanent new supply for seven weeks. Over-issuance — not scarcity — is the central risk: an abundant, effortless currency cannot signal conviction (the "monopoly money" effect), and because Dharma is also the reputation score, debasement corrupts *both* the price signal and the reputation signal at once.

**The reply-floor problem (the non-obvious core).** Per ADR-0017, **a reply *is* a bet** (stake + side), replies rank **stake-descending within side**, and `REPLY_DEPTH_MAX = 1` (flat). ADR-0017 explicitly recorded and *accepted* a tension: with depth-1, stake is the only signal a reply emits, so reply ranking is **purely the C-axis** — "a direct C > n outcome inside a system whose headline is K · n > C." It closed the two structural fixes (nesting; stake-backed backing micro-bets) as out of experiment scope. This leaves the **reply minimum bet as the only remaining lever** that touches that conceded tension — and it is a *parameter*, not a ranking-function change, so it does not reopen ADR-0017.

This ADR does **not** decide:

- **Final pinned values** for the initial grant, the daily credit, or the post-level minimum bet — these are launch *intents* / *ranges* here; the number-tuning pass (2026-09-01) ratifies or adjusts them against dogfooded markets, then pins in the relevant config before launch. (The reply floor is pinned as a founder policy value — see Decision Outcome — but remains tuning-pass-revisable.)
- **Sybil / identity gating** (phone verification, OAuth-only, vouching) — deprioritized for the experiment; reconsider at testnet.
- **The optional in-window sink design** (amplify-a-market, seed-a-market, etc.) — this ADR rules the *principle* that at least one sink is desirable; the mechanism is a SYNC.7/8 product-spec question or a future ADR.
- **Issuance ledger mechanics** — how grants/credits are written as events (INV-1/INV-2 append-only ledger) — SPEC.2 §5/§7 + the engine work in `src/server/dharma` (absent, forward).
- **Streak / retention UI** — the visible streak counter is named here as the retention carrier; its rendering is ADR-0012 / design scope.

## Decision Drivers

1. **Dharma must signal, not inflate.** Because Dharma is both reputation and stake, its scarcity *is* its signal value. The issuance schedule must keep the marginal unit meaningful across a no-sink 7-week window. Faucet discipline is the primary constraint.
2. **The faucet has no loss-sink in-window.** Grant + daily credit are pure faucets; only position-locking drains. Total spendable supply only grows. Recurring issuance (daily credit) must therefore be small and bounded, never escalating.
3. **Equal start; differentiation by deployment, not endowment.** With no resolution in-window, reputation cannot be *earned by being right*. It must be *granted* up front. Therefore the grant is the reputation floor and must be **equal for all** — standing during the window comes from how skilfully Dharma is deployed and how convincing the mandatory commentary is, not from who arrived with more or who logged in more.
4. **The minimum bet is the granularity of conviction *and*, for replies, the granularity of the only ranking axis.** A fresh post still has traction and balance lanes carrying it (ADR-0017); its floor is mostly an anti-dust tripwire. A reply emits *only* stake; its floor calibrates the entire reply-ranking axis. The two floors do structurally different jobs and must be set independently.
5. **The reply floor is the last lever on ADR-0017's conceded C > n.** A *low* reply floor widens the reply stake range → a single high-Dharma reply dominates the side-ranking by a large multiple → *sharpens* C > n. A *high* reply floor compresses the range → big stakes still win but by less, and more informed voices sit visibly near the top → *softens* C > n. The thesis therefore argues for **reply floor > post floor** — the inverse of the naive "replies are cheap chatter" intuition.
6. **Retention rides loss-aversion, not payout size.** Behavioural-design evidence (habit-loop / streak literature) is that daily-return habits run on the visible streak and fear-of-reset, not on the magnitude of the reward. The retention loop can therefore be driven by a streak counter + the obligation to post a daily commented bet, *without* large currency issuance — separating "engagement that produces signal" (a thoughtful commented bet) from "engagement bait" (claim a free chest and leave).
7. **Number-tuning deferral (project standing rule).** Specific economic values ratify at the tuning pass against dogfooded markets, not at design time. This ADR locks **shape and design-intent** and the one founder-policy pin (reply floor = 50); it ranges the rest.

## Considered Options

**For the minimum-bet structure:**

1. **Symmetric — one floor for posts and replies.** ("A bet is a bet.")
2. **Asymmetric-static — two flat floors, reply floor > post floor.** ← chosen
3. **Asymmetric-dynamic — post floor flat; reply floor = base + must-beat-standing-replies to outrank.**

**For the issuance schedule:**

4. **Large grant + large escalating daily streak credit** (the informally-documented draft: ~10,000 grant, ~1,000/day, escalating). 
5. **Moderate equal grant + small flat daily credit (paid on a commented bet) + at least one optional sink.** ← chosen
6. **Grant only, no daily credit** (pure one-time endowment).

## Decision Outcome

**Chosen: Option 2 (asymmetric-static minimum-bet floors, reply > post) + Option 5 (moderate equal grant, small flat daily credit, optional sink).**

### The two minimum-bet floors

| Floor | Value | Status | Rationale |
|---|---|---|---|
| **Reply floor** | **50 Dharma** | **Pinned (founder policy; tuning-pass-revisable)** | The lever on ADR-0017's conceded reply-level C > n. Set high relative to the post floor to compress the reply stake distribution so committed Dharma cannot run away with the side-ranking. Ceiling on this value is *dissent cost* — it must stay low enough that a small, informed counter-voice can still afford to enter a thread; 50 sits in that band against a ~1,000 grant (a participant can afford ~20 floor-level replies from the grant alone). |
| **Post floor** | **lower than the reply floor** — anchor ~10, range ~10–25 (ratio ~1:2.5 to 1:5 against the reply floor) | **Ranged → tuning pass** | A fresh post still has traction + balance lanes (ADR-0017); its floor is an anti-dust tripwire, not a ranking-axis calibration. Kept low so that *opening a new line of argument* — the generative act the platform exists for — stays cheap and accessible. |

**The ruled shape is: reply floor > post floor, reply floor pinned at 50, post floor low and ranged.** This is the headline reversal of the intuitive answer, justified by Decision Driver 5.

**Why not symmetric (Option 1):** Defensible and simplest, but it spends nothing on the one lever available against ADR-0017's conceded C > n, and treats two structurally different jobs (opening a thread vs. competing in a contested reply pool) as identical. Rejected as a waste of the lever.

**Why not asymmetric-dynamic (Option 3):** The most faithful to "replies rank by stake descending," and elegant — but it (a) adds a new dynamic write-path in a locked launch window, (b) is harder to explain, and (c) risks a stake arms-race that pushes reply stakes *up* and *worsens* C > n — the opposite of the goal. **Rejected for the experiment; hold as a testnet-phase candidate** (revisit only alongside any depth>1 / backing reconsideration, consistent with ADR-0017's deferrals).

### The issuance schedule

| Parameter | Value | Status | Rationale |
|---|---|---|---|
| **Initial grant** | ~1,000 Dharma (range 1,000–2,000), **equal for all** | Ranged → tuning pass | Funds ~20 floor-level replies / ~100 post-floor bets — ample expressive range without nominal inflation. Equal-for-all per Driver 3 (poker-tournament logic: standing is deployment, not endowment). Avoid both extremes — sub-200 reads as stingy; HSX-style millions destroy granular conviction meaning. |
| **Daily credit** | ~10 Dharma, **FLAT (never escalating)**, paid **only on placing a commented bet** | Ranged → tuning pass | One extra post-floor unit of voice per *active* day. Flat per Driver 2 (no loss-sink → escalating credit is pure inflation). Paid-on-commented-bet per Driver 6 (signal, not bait). Across the ~51-day window, perfect attendance yields ~510 Dharma — bounded at roughly half the grant, the upper limit of acceptable dilution. |
| **Optional in-window sink** | At least one (principle ruled; mechanism deferred) | Principle ruled → SYNC.7/8 | Per Driver 2, a faucet with no drain debases the currency. Add ≥1 optional sink (e.g. spend Dharma to amplify a market's visibility, or to seed/create a market — the latter is Manifold's own post-crisis fix) to anchor value and give high-conviction users a way to spend down abundant balances. If no sink ships, the fallback is to accept managed inflation and tighten the faucet (cut daily credit toward 5) when median free balances run away. |

### The rejected draft (Option 4) — recorded so it cannot silently return

The informally-documented "~10,000 grant / ~1,000-per-day / 100 minimum" draft is **rejected**. The problem was never the individual figures — it was the **ratios**. At ~1,000/day against a 100 floor, one login funds ten bets *for doing nothing*, and over the 51-day window attendance alone mints ~51,000 Dharma — roughly 5× the signup grant. **The dominant source of Dharma becomes attendance, not knowledge** — inverting what the token is meant to measure, and breaching the influence-floor reading of "no stake, no voice" (presence is not stake). Escalating daily credit (Manifold's M$5→M$25 streak shape) is rejected for the same reason, compounded by the no-sink window. Large referral/bonus grants are rejected (Manifold's largest issuance mistake; "manaflation" + a forced 10× devaluation in May 2024) unless matched by a sink.

### Resulting design-intent ratio

**~100 : 1 : 1 : 5** (initial grant : daily credit : post floor : reply floor) = **~1,000 : ~10 : ~10 : 50**. The reply floor is the one pinned member; the rest range to the tuning pass.

## Consequences

### Positive
- Dharma stays scarce enough to signal conviction across a no-sink window; the marginal unit retains meaning.
- The reply floor is spent in the thesis-correct direction — the only available softening of ADR-0017's conceded reply-level C > n.
- Equal grant keeps initial voice equal; differentiation is deployment + commentary quality, which is what the experiment is meant to observe.
- Retention is carried by the streak loop, not by issuance, so engagement does not require debasing the currency.

### Negative / accepted tensions
- **A higher reply floor raises the cost of dissent specifically** — a small informed voice entering an opponent's thread pays 50 to be heard. This is the price of compressing the stake range (Driver 5). Mitigated by keeping 50 well below the grant (~20 affordable floor-replies); if dogfooding shows dissent being priced out, the tuning pass lowers it. The symmetric fallback (Option 1) is the honest alternative if this tradeoff is judged unacceptable.
- **No loss-sink in-window means managed inflation is the baseline state**, not an anomaly. Requires either the optional sink or active faucet-tightening; flagged for monitoring (median free balance, weekly).
- **Sybil is unaddressed** — a generous-enough daily credit + easy signup means multi-account users could accumulate disproportionate voice. The small flat daily credit mitigates the *second-order* effect; the *first-order* identity problem is deferred to testnet by deliberate choice.
- **Pinning the reply floor at design time** is a conscious departure from ADR-0017's tune-everything-later precedent. Recorded as founder policy, kept tuning-pass-revisable, so the inconsistency is explicit rather than silent.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0017 | Reply-as-bet, stake-descending-within-side, depth-1, conceded C > n | **Consumes.** The reply floor is the parameter-level lever on the C > n tension ADR-0017 recorded and accepted. This ADR does **not** reopen the ranking function — it sets the floor that calibrates the reply-ranking axis ADR-0017 defined. Reply floor > post floor is justified *by* ADR-0017's reply mechanic. |
| SPEC.1 (economy / bet floors) | Product surface for grant, credit, minimum bet | **Mints** (SYNC.7/8): the two-floor minimum-bet rule (reply 50, post low/ranged), the equal initial grant, the flat-daily-credit-on-commented-bet rule, and the optional-sink principle. Wherever SPEC.1 currently implies a single minimum bet, it requires a same-commit rewrite to the two-floor model. |
| SPEC.1 §8 / §16.1 (mandatory commentary, REPLY_DEPTH_MAX=1) | Locked floor | Consumes: every bet (post or reply) carries commentary; the daily credit is paid only on a *commented* bet, consistent with no-stake-no-voice. Depth-1 is why the reply floor is the only available lever. |
| "No stake, no voice" (locked, SYNC.4 influence reading) | Thesis floor | Consumes: presence/attendance is **not** stake → the rejected draft's login-funds-bets ratio breaches the influence reading; this ADR's small-flat-paid-on-bet credit upholds it. |
| Two-instrument architecture | Artha vs Dharma | Consumes: participant scope is Dharma-only; Artha (MM instrument) is untouched. Issuance here is participant Dharma only. |
| INV-1 / INV-2 (append-only Dharma ledger, balance ≥ 0) | SPEC.2 §5, ADR-0005 | Consumes: grants and daily credits are issuance events on the append-only ledger; the engine mechanics (`src/server/dharma`, absent/forward) implement them. Minimum-bet enforcement is a write-path check in the bet handler. |
| K · n > C | Thesis | Consumes: issuance defines the *cost of one unit of `n`*; faucet discipline protects the signal value of staked Dharma; the reply floor protects the K-side of reply-level participation against runaway C. |
| Number-tuning pass (2026-09-01) | Project standing rule | **Mints** tuning-pass items: ratify/adjust initial grant, daily credit, post floor; re-examine reply floor = 50; decide the optional-sink mechanism or the faucet-tightening fallback; set the median-free-balance monitoring threshold. |
| SPEC.2 §23 (ADR Index) | ADR index | **Mints** an ADR-0018 entry (same SYNC.7/8 commit). |
| Tracker | SYNC.5 (this ADR), SYNC.7/8 (SPEC.1 economy rewrite, SPEC.2 §23), ADR backfill (commit this file), number-tuning pass | All consume this ADR being accepted. |

## More Information

- SPEC.1 — product surface for the participant economy; **requires same-commit rewrite** in SYNC.7/8 to the two-floor minimum-bet model and the issuance schedule.
- ADR-0017 — ranking model; the source of the reply-as-bet mechanic and the conceded reply-level C > n that the reply floor addresses.
- SYNC.5 chat record (2026-06-01) — the issuance brief, the three-model minimum-bet analysis, the faucet/no-sink reasoning, the comparable-platform research (Manifold issuance history + May-2024 devaluation, Metaculus reputation/currency separation, Stack Overflow reputation-as-currency floor, Iowa Electronic Markets stake caps, EVE Online faucet/sink economics), and the decisions ledger from which this ADR is written.
- `dharma-distribution-ruling.html` (SYNC.5 founder brief) — the presentation artifact that argued this decision.

---

*ADR-0018 ratifies Zugzwang's experiment-phase Dharma issuance: an equal initial grant (~1,000, ranged), a small flat daily credit (~10, paid only on a commented bet, never escalating), at least one optional in-window sink, and — the load-bearing decision — **two asymmetric minimum-bet floors with the reply floor (pinned at 50) set higher than the post floor (low, ranged)**, because the reply floor is the only remaining parameter-level lever on the reply-level C > n that ADR-0017 conceded. Sybil identity gating is deliberately out of experiment scope. All values except the reply-floor pin defer to the 2026-09-01 number-tuning pass; the reply-floor pin is founder policy and remains tuning-pass-revisable. The schedule upholds K · n > C by keeping staked Dharma scarce enough to signal in a window with a faucet but no loss-sink.*
