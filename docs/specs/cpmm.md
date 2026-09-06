# cpmm.md — CPMM Math Specification (Zugzwang experiment)

## §0 Document metadata

| Field | Value |
|---|---|
| **Document** | `cpmm.md` — CPMM math companion (named in SPEC.2 §0 companion files + §1.4 #2) |
| **Version** | 3.0.0 (semver; MAJOR on any change to a formula or invariant, MINOR on clarifications) |
| **Date** | 2026-09-06 |
| **Owner** | Hrishikesh Manoj Hundekari |
| **Status** | Authored at ENGINE.1 (web-authored, founder-ratified, CC-committed) |
| **Gates** | ENGINE.2 (module `src/server/cpmm/`), ENGINE.3 (property tests); the former DESIGN.4 slippage-modal gate is retired — SPEC.1 §7 (1.0.15) |
| **Authority** | Canonical for every CPMM formula and the numeric policy. SPEC.1 §10 owns the economic *rules*; SPEC.2 §3.2 / §3.6 own the *execution context*. On conflict over a formula, this file wins; on conflict over product behaviour, SPEC.1 wins. |
| **Lineage** | Derived from Manifold's CPMM (MIT) — see §2 |
| **License** | AGPL-3.0-or-later (repo-wide, ADR-0001), incorporating MIT-licensed upstream with attribution (§2; full notice in `THIRD_PARTY_NOTICES.md`) |

## §1 Purpose & scope

This file defines the exact, deterministic mathematics of the experiment's market
maker: a **fee-less, admin-seeded, binary (YES/NO) constant-product market maker**,
one per market. Every Dharma-denominated quantity the engine produces when a bet is
placed (§4), a position is sold (§5), the price impact is computed for the
non-blocking bet preview (§6), a pool is seeded (§7), or a market terminates
(§8) is defined here and only here. SPEC.2 names
*that* the bet handler computes "CPMM share-payout per `cpmm.md`"; it deliberately
does not duplicate the math (SPEC.2 §1.4 #2). RANKING.md is this file's sibling: one
companion spec per published, auditable model.

**Execution context.** The implementing module (ENGINE.2, `src/server/cpmm/`) is
**pure**: no I/O, no clock, no database access, no randomness. It is invoked inside
the W-1 bet transaction (SERIALIZABLE isolation, pool-row pessimistic lock, lock
order `pools → positions → dharma_ledger → events`; SPEC.2 §3.2) and by the W-3
resolution flow (SPEC.2 §3.6). Concurrency, locking, retries, idempotency, floors,
and moderation are upstream concerns — they live in SPEC.2 and the flow contracts,
never here.

**Trading window.** CPMM trades occur only while the market is `Open` (SPEC.1 §6).
Reserves are immutable from the `Open → Closed` transition onward; the only
post-`Closed` pool operation is the terminal unwind (§8). After `Resolved` or
`Voided` the CPMM state is frozen permanently and must remain auditor-reproducible
(INV-4; §11).

**Pinned model (deltas vs upstream).** Relative to the Manifold source (§2), this
maker is: **fee-less** — no fee term exists anywhere in the share or price math
(SPEC.1 §10 and §16.1 define no fee constant); **single-MM** — the admin seeds the
pool once at `Draft → Open` and there are no external liquidity providers and no
mid-market adjustments (SPEC.1 §10.5, §10.6); **binary single-answer** — no
multi-outcome machinery; and **weight-pinned** — Manifold's pool weight is fixed at
p ≡ ½, which collapses their parametrised maker to the pure constant product
`y · n = k` (§3.3). ⚠ **Note the scope of that stripping: it removes the curve
WEIGHT, not the ability to open at a chosen price.** Since ADR-0047 a pool seeds
at whatever probability the operator names, by placing the two reserves
asymmetrically and discarding the excess side (§7.1) — the weight-pinning is why
that is done with reserves rather than with an exponent. The pre-launch curation
slate seeds ARGUMENTS, in stakes deliberately too small to move the price (§7.2);
it stopped being the price-setting mechanism at ADR-0047, and the sentences here
that described it walking the price from 0.5 to a chosen level are gone with it.

**Numbers.** This file pins **no magnitudes**. Seed sizes and bet floors
remain symbolic constants owned by SPEC.1 §16.1 and pin at the
number-tuning pass (~2026-09-01).

## §2 Lineage, license & attribution

The algebra in §3–§5 and §7 derives from Manifold's CPMM implementation
(`common/src/calculate-cpmm.ts`), read at the pinned reference fork
`zugzwang-foundation/manifold-reference`, tag `ref-2026-04-28-found5` =
commit `d5b55cf9472ec05f545e6c1a817d88005b8dbf2b` (upstream
`manifoldmarkets/manifold`; map: `docs/references/manifold.md`, FOUND.5).

**Kept:** the two-reserve state and derived probability (§3); the
deposit-mints-pairs purchase algebra (§4); the liquidity quantity (§7); the
sale-as-opposite-purchase equivalence, used here in closed form (§5).
**Stripped:** fees, limit-order fills, multi-answer arbitrage,
liquidity-provider weights, and the `p` weight parameter (pinned ½, §1).
**Replaced:** float + EPSILON arithmetic → exact NUMERIC(38,18) per §10;
binary-search sale → the closed-form quadratic of §5.

**License.** Upstream is MIT — Copyright (c) 2022 Manifold Markets, Inc.
This spec and the derived implementation are AGPL-3.0-or-later (ADR-0001);
MIT → AGPL incorporation is permitted and **attribution is mandatory**. The
full MIT notice is preserved verbatim in `THIRD_PARTY_NOTICES.md` (repo
root, committed with this file). Every source file under `src/server/cpmm/`
that derives from the upstream carries a short attribution header (upstream
file + fork + tag + commit + pointer to the notice) — an ENGINE.2
review-gate obligation.

## §3 State model

### 3.1 Reserves

For each market, the pool state is the pair **(y, n)**: the YES-share and NO-share
reserves, each a NUMERIC(38,18) value carried as a decimal string at every module
boundary (the `numericString` validator, ENGINE.0). Reserves persist as one row per
market in the `pools` table; SPEC.2 §5 / Appendix B.3 own the column names — this
file is written against the symbols y and n, and the pure module never sees column
names. The invariant product **k := y · n is derived, never persisted**.

### 3.2 Share semantics (pair-mint accounting)

Every 1 Đ (Dharma) that enters the pool — seed (§7) or stake (§4) — mints exactly
one (YES, NO) share **pair**. One pair is worth exactly 1 Đ; at resolution each
winning-side share pays 1 Đ and each losing-side share pays 0 (SPEC.1 §10.3).
Conversely, every 1 Đ that leaves the pool (sale proceeds, §5) burns one pair. At
all times every share in existence sits either in the pool reserves or in a user
position — the admin holds no positions (SPEC.1 §10.1) — **or was DISCARDED at
open (§7.1)**, and the count of pairs in existence equals the Đ the pool holds.
⚠ The discard clause is ADR-0047's and it is load-bearing: a discarded share is
in no reserve and no position, so without it this sentence is false the moment a
market opens at a price (at a 10% open, pairs in existence are 10,000 against
90,000 Đ held). Solvency is still structural, not managed: whichever side wins,
the shares users hold are each backed by a Đ already inside the pool, and the Đ
behind the discarded shares is the residual §8.1 returns (stated as an invariant
with the residual identity in §8 and §11).

### 3.3 Price

The market-implied probability is read directly off the reserves:

    p_yes := n / (y + n)        p_no := y / (y + n) = 1 − p_yes

Note the cross: **a side's probability is proportional to the opposite reserve**.
Abundant YES shares in the pool mean YES is cheap — low p_yes. Upstream's own test
fixes the orientation: reserves (y, n) = (150, 50) give p_yes = 0.25. The marginal
property that makes p a price: the cost of the next infinitesimal share of a side
equals that side's probability (derived in §4.3). p_yes + p_no = 1 identically;
there is no fee wedge between the two sides.

### 3.4 Domain

y > 0 and n > 0 at all times. Both are established strictly positive at seed (§7)
and preserved by every operation: a buy strictly increases the opposite reserve
(§4), and a sale's proceeds satisfy M < n (respectively M < y) strictly (proof in
§5.2). Reserves never reach zero; probabilities never reach 0 or 1.

### 3.5 Notation

Used throughout this file:

| Symbol | Meaning |
|---|---|
| y, n | YES / NO share reserves before the operation |
| y′, n′ | reserves after the operation |
| k | y · n (derived) |
| S | stake of a buy, in Đ |
| s | share quantity (bought §4 / sold §5) |
| M | sale proceeds, in Đ |
| p0 | trade-side probability before the trade (spot) |
| p_eff | effective average price paid: S/s on a buy, M/s on a sale |
| p1 | trade-side probability after the trade (spot) |

All Đ and share quantities are NUMERIC(38,18) decimal strings at module boundaries;
arithmetic and rounding are governed by §10.

## §4 Buy

### 4.1 Definition

A buy is a stake of S Đ on one side of an Open market. Side-neutrally, let
**a** = the reserve of the bought side and **b** = the reserve of the opposite
side (so a YES buy reads (a, b) = (y, n); a NO buy reads (a, b) = (n, y)).

The trade in pair-mint terms (§3.2): S Đ enters the pool and mints S share
pairs, taking the reserves to (a + S, b + S); the buyer then withdraws s
bought-side shares, with s fixed by restoring the invariant product
(a + S − s)(b + S) = a · b. Closed form:

    s  = a + S − (a · b) / (b + S)

    a′ = (a · b) / (b + S)          (bought-side reserve after)
    b′ = b + S                      (opposite reserve after)

Equivalently a′ = a + S − s. The post-trade probability of the bought side is
p1 = b′ / (a′ + b′) per §3.3.

### 4.2 Properties

For all a, b > 0 and S > 0 (each is a required property test in ENGINE.3):

1. **s > S.** s − S = a·S/(b + S) > 0: a share always costs strictly less
   than 1 Đ pre-resolution, so a stake always buys more shares than Đ spent.
2. **Price ordering: p0 < p_eff < p1.** The effective price p_eff = S/s lies
   strictly between the pre- and post-trade spot — the marginal price rises
   monotonically along the fill, so its average sits strictly inside.
3. **Monotone impact.** A buy strictly raises the bought side's probability
   (a′ < a, b′ > b) and larger S means larger impact; p1 < 1 always (§3.4).
4. **k preservation.** In exact arithmetic k′ = k identically. Under the §10
   boundary rounding (s floored to 18 dp before reserves are derived),
   k′ ≥ k — rounding dust accrues to the pool, never to the trader.

### 4.3 Marginal price (closes the §3.3 claim)

ds/dS = 1 + a·b/(b + S)². At S → 0 this is (a + b)/b, so the cost of the
next infinitesimal share, dS/ds, equals b/(a + b) — exactly the bought
side's probability. The §3.3 reading of reserves as a price is literal.

### 4.4 Outputs

A buy computation returns the bundle **{s, a′, b′, p0, p_eff, p1}** (decimal
strings, §10). These feed the bet row and ledger delta (W-1), the events
payload, and the §6.1 impact quantity / §6.3 non-blocking preview. Nothing
else about a buy — floors,
moderation, idempotency, position bookkeeping — is computed here (§1).

## §5 Sell

### 5.1 Definition

A sell returns s shares of one held side to the pool for M Đ (F-BET-1/2's
inverse; flow F-BET-3 — the only comment-free action, SPEC.1 §7). Let
**a** = the reserve of the sold side, **b** = the opposite reserve.

In pair terms: the seller returns s sold-side shares; the pool pays M Đ by
burning M pairs. Reserves move to a′ = a + s − M, b′ = b − M, with M fixed
by (a + s − M)(b − M) = a · b, i.e. the quadratic

    M² − (a + s + b) · M + s · b = 0

whose **smaller root** is the proceeds:

    M = [ (a + s + b) − √( (a + s + b)² − 4 · s · b ) ] / 2

The larger root exceeds b and is geometrically meaningless (it would drive
b′ negative). The post-trade probability of the sold side is p1 = b′/(a′+b′).

### 5.2 Bounds (each a required ENGINE.3 property test)

For all a, b > 0 and s > 0:

1. **Real and distinct roots.** (a + s + b)² > (s + b)² ≥ 4·s·b (AM–GM),
   strictly, since a > 0.
2. **0 < M < min(s, b).** Writing f(M) = M² − (a+s+b)M + s·b: f(0) = s·b > 0,
   f(s) = −a·s < 0, f(b) = −a·b < 0, so the smaller root lies in
   (0, min(s, b)). M < s: pre-resolution shares are worth < 1 Đ each.
   M < b: the opposite reserve stays strictly positive. And
   a′ = a + (s − M) > a > 0. §3.4's domain is preserved.
3. **Price ordering: p1 < p_eff < p0.** Selling pushes the sold side's
   probability down; the effective price received, p_eff = M/s, sits
   strictly between post- and pre-trade spot.
4. **k preservation.** Exact arithmetic: k′ = k. Under §10 rounding
   (M floored before reserves are derived): k′ ≥ k.

### 5.3 Round-trip neutrality

Buying s shares for S and immediately selling all s back returns exactly
M = S in exact arithmetic — the fee-less curve charges no spread; a trader
fully unwinds their own impact. Under §10 rounding, M ≤ S with the dust
retained by the pool. Consequence: profit and loss arise only from price
movement caused by other participants and from resolution — never from
mechanical churn. (Stake-to-rank-then-sell remains visible and marked at the
read layer per SPEC.1 §5.4; this file only fixes what the seller is paid.)

### 5.4 Outputs

A sell computation returns **{M, a′, b′, p0, p_eff, p1}** (decimal strings,
§10). Position sufficiency (s ≤ holdings) is enforced upstream against the
positions table inside the same W-1 transaction — not here.

## §6 Slippage

### 6.1 Quantities

Every trade preview and execution carries three prices from §4/§5 — p0
(spot before), p_eff (effective average), p1 (spot after) — all measured on
the trade side. **Impact** is the spot move caused by the trade itself:

    impact := | p1 − p0 |        (a probability-point delta in [0, 1))

For a buy, impact = p1 − p0 > 0; for a sell, p0 − p1 > 0.

Impact is measured in **absolute probability points**, not relative
change: relative impact diverges as p0 → 0 and would overweight small
absolute moves at the tails — penalising exactly the low-p conviction
bets whose convex payoff the thesis prizes (SPEC.1 §10.3) — and
|Δp_yes| = |Δp_no|, so the definition is independent of which side's
probability a surface happens to display.

### 6.3 Preview semantics

The preview is computed read-only against then-current reserves and is
**advisory**: the authoritative numbers are recomputed inside the W-1
transaction under the pool-row lock at execution. If the price moved between
preview and confirm, the trade executes at the curve as found — same
formulas, possibly different numbers. (Recorded fact, not a defect: v1 has
no slippage-tolerance abort by SPEC.1's design; revisiting that is a SPEC.1
product question, out of scope here.)

### 6.4 Preview consumable

The preview bundle for the non-blocking bet preview (the buy/sell composer
surface) is:

    { side, S | s, shares_or_proceeds, p0, p1, p_eff, impact }

The preview renders price (p0 → p1), shares, and cost-or-proceeds — a
display, not a gate: no modal, no threshold, no confirm step (warning
retired — SPEC.1 §7, 1.0.15). The caller applies the per-bet stake cap
(SPEC.1 §16.1) before `computeBuy`, so on a clamped buy these figures
reflect the clamped stake. Presentation precision is a display concern
(§10 fixes stored precision at 18 dp; UI rounding is design.md's).

## §7 Pool seed & opening price

### 7.1 Seed mechanism

At the `Draft → Open` transition the admin opens the market at a chosen
price over a reserve TANK of size T — the two reserves sum to exactly T —
recorded as the
`yesReserves`, `noReserves`, `openingPriceYes`, `backingMinted`,
`discardedYes` and `discardedNo` payload fields on the `market.opened`
events row plus the `pools` reserve initialisation, never a
`dharma_ledger` row (R-2; SPEC.1 §10.1). Given an opening price
p = p_yes ∈ (0,1), the reserves initialise ASYMMETRICALLY:

    (y0, n0) = ((1 − p) · T,  p · T)      ⇒      p_yes = p at seed

since a side's price is proportional to the OPPOSITE reserve (§3.3): a
LOW p_yes means a LARGE yes-reserve. At p = ½ this reduces to the
symmetric (T/2, T/2) and everything below is a no-op — the symmetric seed
is the special case, not the rule.

In pair-mint terms (§3.2) the open mints B = max(y0, n0) share pairs, of
which min(y0, n0) of the short side enter the pool and the remaining
B − min(y0, n0) are DISCARDED — permanently destroyed, held by no one,
in no position. Discards are what let a price be set with no holder for
the excess side, which is the constraint §7.2 describes. They are
LARGE: the discard fraction is 1 − min(p, 1−p) / max(p, 1−p), which is
88.9% at a 10% open.

Because discarded shares leave the pool without entering a position, the
pair-mint accounting of §3.2 is completed by the BACKING IDENTITY, which
holds per side at every instant of a market's life:

    Y + H_yes + D_yes  ==  N + H_no + D_no  ==  total Đ deposited

where Y, N are the reserves, H_x the sum of user-held shares on side x,
and D_x the cumulative discards on side x. D is summed from events —
`market.opened` and, from ADR-0047 Phase 2, `pool.liquidity_added` —
and is the term that makes §8's unwind and void arithmetic close on an
asymmetric market. A symmetric seed has D_yes = D_no = 0, which is why
the identity was invisible before this section was written.

T > 0 and p ∈ (0,1) are parameters of market opening; magnitude and
policy are owned by SPEC.1 §10.5/§16.1 and by ADR-0047. ⚠ **T is the
reserve SUM, not the Đ deposited.** The Đ deposited is B = max(y0, n0) —
90,000 at p = 0.10, T = 100,000 — and B is what the identity above equates
to AT OPEN. Thereafter it equates to §8.1's D = B + Σ stakes − Σ proceeds:
the identity holds at every instant, but the constant it holds against
grows with the book. Reading T as Đ overstates the deposit by the discard,
and Phase 2's target rule compares against T, so the two must not be
conflated. This file fixes
the mechanism: asymmetric initialisation at a chosen price, exactly
once, with the excess discarded. There is still no curve-weight dial —
upstream's `p` parameter (which lets Manifold open at an arbitrary
probability with equal reserves, since equal reserves give prob = p
exactly) remains stripped (§1, §2), and is a different mechanism from
the p above: this p is a target price, not an exponent. The
reserve-placement primitive that computes the pair, and the
price-preserving addition that §7.4 will admit, are one function —
`openingReserves` / `addLiquidity` in `src/server/cpmm/calculate.ts`,
derived from upstream's `addCpmmLiquidityFixedP` under the §2 MIT
attribution.

### 7.2 The pre-launch curation slate — arguments, not price

**AMENDED by ADR-0047 (2026-09-06). This section previously made the slate
the price-setting mechanism. It is not, and it does not set price again.**

Price is set structurally, by the two opening reserves (§7.1). The slate's
only remaining job is the one it was always better at: giving a market a
debate to arrive into.

The paragraph that stood here opened "the probability at seed is 0.5
structurally", and that sentence held for exactly as long as the seed was
symmetric. §7.1 now opens the market at a chosen p and DISCARDS the excess
side rather than finding a holder for it — which is precisely the
impossibility this section used to rest on.

**Standard launch procedure for every market:** after the open and before
public availability, a **curation slate** posts a small number of sincere,
fully-argued bets on each side (§4 buys under INV-1, every stake carrying
its argument), curated per-market. Its purpose is (a) that a market does
not go live with an empty debate, and (b) that both sides are represented
by an argument someone can answer. **Stakes are deliberately small enough
not to move the price** — the opening price is §7.1's, and a slate that
moved it would be re-introducing the mechanism ADR-0047 removed.

Why this changed is worth recording, because the old design was not
obviously wrong. Reaching a 10% open by slate required operator-controlled
participant accounts to hold NO positions worth twice the seed, riding to
resolution, each carrying a mandatory argument under INV-1 that the
operator does not hold — arguments by fiat, with stake, taking real
payouts and real leaderboard rows. That is strictly further from an honest
book than a discard, which has no holder, no position, no vote, no payout
and no leaderboard row. Setting the price structurally and letting the
slate seed ARGUMENTS ONLY separates the two things this section used to
conflate. See ADR-0047 §Decision Outcome B and §Consequences.

To this file a slate bet is indistinguishable from any other bet: same
formulas, same rounding, same ledger flows, same k-preservation; slate
positions are real positions, exposed to §8 resolution like any other.
**No special math exists or is needed** — and now that the slate does not
set price, none is implied either. What the slate requires is product
definition, owned by SPEC.1 and deferred to the debate-phase market design:
the curation-account model and Dharma provenance, the lifecycle window in
which the slate executes (a SPEC.1 §6 definition — bets currently exist
only in `Open`, so pre-launch implies a visibility gate or a defined
sub-state), dataset labeling/disclosure of slate bets, and leaderboard
treatment of slate accounts. **Per-market opening levels are no longer on
that list**: they are a parameter of market opening (§7.1), not a curation
outcome.

### 7.3 Rejected reserve-side alternatives (recorded)

**AMENDED by ADR-0047 (2026-09-06). The first rejection below is
REVERSED; it is kept in place, struck, because the reasoning that
overturned it is the substance of the amendment.**

~~Asymmetric open via one-sided share burn at seed — mint C pairs, burn
x of one side for reserves (C, C − x) — is solvency-safe but rejected:
it sets a price by fiat with no stake and no argument behind it, exactly
what the curation-slate route avoids.~~

**ACCEPTED, and it is now the only open mechanism (§7.1).** The
objection was that a burn sets a price "by fiat with no stake and no
argument behind it". Measured, the alternative it protected does worse
on its own terms: reaching a 10% open by curation slate requires
operator-controlled participant accounts to hold NO positions worth
twice the seed, riding to resolution, each carrying a mandatory argument
under INV-1 that the operator does not hold — arguments by fiat, with
stake, which is strictly further from an honest book than a discard
nobody holds. A discard has no holder, no position, no vote, no payout
and no leaderboard row; it is an accounting fact, disclosed in the
dataset. Setting the price structurally and letting the slate seed
ARGUMENTS ONLY — with stakes too small to move the price — separates the
two things the slate was conflating. See ADR-0047 §Decision Outcome B
and §Consequences.

Reintroducing the upstream `p` weight **remains rejected**, and ADR-0047
re-examined it against a measurement rather than inheriting this
sentence: it rewrites every function in `src/server/cpmm/` around
fractional powers, weakens the exact-arithmetic contract of §10, needs a
column on `pools`, buys no discarded shares — worthless to a mint that
can simply not mint them — and yields a curve that measures equally
lopsided at a 10/90 open (YES:NO impact 14:1 against fixed-p's 12:1).
Upstream itself runs fixed-`p` with discards for its multi-choice
markets. Either revisit is an ADR, not an edit; the `p`-weight revisit
is reasonable at testnet and out of scope for the experiment.

### 7.4 No liquidity operations exist

Per SPEC.1 §10.6, the seed is fixed for the market's life. This module
exposes no add/remove-liquidity operation IN ANY RUNTIME PATH — ⚠ but
`addLiquidity` IS an export of `src/server/cpmm/calculate.ts` as of ADR-0047
Phase 1, with no caller: it is the specification and differential-fuzz oracle the
Phase-2 SQL injector is pinned against. This section's rewrite rides Phase 2 with
SPEC.1 §10.6; until then, read it as "no operation is WIRED", not "no function
exists". Upstream's liquidity functions
are stripped (§2). Reserves change through exactly three doors: §4 buy,
§5 sell, §8 terminal unwind.

## §8 Resolution, void & freeze

Trading halts at `Open → Closed` (§1). Everything in this section is
terminal bookkeeping; the curve never runs again after the last Open trade.

### 8.1 Resolved

The admin resolves the market to an outcome side (W-3; SPEC.2 §3.6 — a
single terminal `market.resolved` events row; per-bet payouts live in the
`payout_events` table; this file mints no event types).

- **Payout rule.** Each user-held winning-side share pays exactly 1 Đ; each
  losing-side share pays 0 (SPEC.1 §10.3, reconciled in §9). Per-bet deltas
  are independent (§9.3).
- **Residual identity (the audit crux). AMENDED by ADR-0047 — the unwind is
  no longer the winning reserve alone.** Let w = the winning-side reserve at
  freeze, D_W = the cumulative DISCARD on the winning side (§7.1), and D =
  the pool's Đ balance (= backing + Σ stakes − Σ proceeds). By pair
  accounting (§3.2) the winning shares that ever existed number D, but D_W
  of them were destroyed at open and are held by no one, so winning shares
  IN EXISTENCE are D − D_W and user-held winning shares are D − w − D_W.
  The pool pays out D − w − D_W, and the residual returned via `pool_unwind`
  is

      unwind = w + D_W

  because the Đ backing a discarded share has no holder to pay and nowhere
  else to go. ⛔ **The unwind is therefore NOT auditable from the frozen
  reserves alone** — it needs D_W, which is read from the market's
  `market.opened` event (and, from ADR-0047 Phase 2, its
  `pool.liquidity_added` events). That sentence stood here until ADR-0047
  and is now false; `src/server/resolution/settle.ts` is the shipped
  arithmetic.

  A SYMMETRIC open has D_yes = D_no = 0 and every clause above degenerates
  to the pre-ADR-0047 form, which is why this was invisible: `unwind = w`
  was not an approximation, it was the D_W = 0 special case.

  The identity stays exact at 18 dp: §10's rounding leaves all dust inside
  the reserves, and the discard is carried as a residual (§7.1) rather than
  a separately rounded product, so reserves + user holdings + discards sum
  to D to the last digit. (Instance from §12, a symmetric seed so D_W = 0:
  seed 100, one YES buy of 10 → user holds 19.090909090909090909 YES, pool
  YES reserve 90.909090909090909091; the two sum to 110.000000000000000000
  = D. YES wins ⇒ unwind = the YES reserve; NO wins ⇒ unwind = 110 = the NO
  reserve. On an ASYMMETRIC open the same market would add D_W to whichever
  side won.)
- The losing-side reserve is informational only — those shares expire
  worthless inside the pool; no flow corresponds to them.

### 8.2 Voided

Void (SPEC.1 §6 `Open|Closed → Voided`, §10.7 per B3) runs **no curve
math**. Reversal is ledger arithmetic on the founder-ratified **R-9.8
basis** (SPEC.1 §10.3 + §10.7, v1.0.3 ENGINE.9 riders; shipped
`src/server/resolution/void.ts`): every bet is refunded **`void_refund` =
f × stake**, where f is the surviving fraction of the user's held-side
position (f = position quantity ÷ Σ same-side `share_quantity`; per-bet
exact-sum rounding — floors with a deterministic last-row remainder
ordered by bet id — is owned by SPEC.1 §10.3). **Sale proceeds stand** —
the sale was a real trade at a real price. Proceeds are never reversed,
no negative compensating entries exist, and a fully-sold side has f = 0
and refunds 0 (zero legs are legal — SPEC.2 Appendix B.8, R-9.2/R-9.8).
Refunds are therefore always ≥ 0: the floor-at-zero / `uncollectable`
discipline (SPEC.1 §10.7 per B4) belongs to the **correction** path
(§8.3) and has **no void leg**.

**Residual.** The pool's remaining Đ after refunds — D − Σ `void_refund`,
with D = seed + Σ stakes − Σ proceeds (§8.1) — is **not in general the
seed**: it differs from the seed by exactly the users' net realized sale
P&L (a seller's gain stayed with the seller, so the pool carries the
mirror; a seller's loss likewise stayed in the pool). The residual exits
circulation as `poolUnwindAmount` on the terminal `market.voided` events
row (R-9.5/R-9.5e) via `pool_unwind`; there is no admin balance. Shares
are extinguished without payout; comments lock `voided`. **Audit path:**
void reproduction is **ledger-based** — recompute f per user-side from
the shipped `positions`/`bets`, apply f × stake per bet, compare Σ
against the `void_refund` rows and the event's `poolUnwindAmount` — not
a frozen-reserve identity (contrast §8.1's Resolved case; see INV-C4).

### 8.3 Correction

A resolution correction (SPEC.1 §10.7 per B4) is reverse-and-reapply on the
ledger using the §8.1 payout rule against the **frozen** reserves and
positions. The CPMM state is never recomputed or mutated by a correction.

### 8.4 Freeze (INV-4)

The reserve pair at the moment the market enters `Resolved` or `Voided` is
permanent. The module performs no computation against a terminal market
except pure reads. From the frozen (y, n), the bets, and the ledger, every
§8 quantity — each payout, the unwind, the residual — is exactly
reproducible by any auditor. The pool account row dissolves at `→ Frozen`
(SPEC.1 §10.1); the frozen reserve values persist for the dataset.

## §9 Award-rule reconciliation (SPEC.1 §10.3)

### 9.1 The reading

SPEC.1 §10.3: "A bet of stake S at market-implied probability p buys S/p
shares; win delta +S(1−p)/p; lose delta −S." The probability in that
sentence is the **effective execution probability p_eff = S/s of §4** —
the average price actually paid across the fill — not the pre-trade spot.

### 9.2 Exactness

Under that reading §10.3 is an identity, not an approximation:

    s = S / p_eff                          (definition of p_eff)
    win:  Δ = s · 1 − S = S · (1 − p_eff) / p_eff
    lose: Δ = −S

The spot-price reading (p = p0) holds only in the infinitesimal limit
(§4.3); for any finite stake, p0 < p_eff (§4.2), so a finite bet buys
strictly fewer than S/p0 shares. The executable rule is §4's closed form;
§10.3 is its economic statement with p = p_eff. (The identity is exact with
the unrounded p_eff = S/s; the 18-dp p_eff of §10 is informational.)

### 9.3 Emergent properties, grounded

The §10.3 claims now follow mechanically: **convexity-in-confidence** — a
correct bet executed at low p_eff pays (1 − p_eff)/p_eff per Đ, which grows
without bound as p_eff → 0; **time-weighting** — earlier bets on the
eventually-correct side execute at lower p_eff before the crowd moves the
price (no explicit time term anywhere); **per-bet independence** — each
bet's s is fixed at execution and pays independently at resolution, so a
user's total movement is the sum of per-bet deltas. No Brier overlay, no
bonus terms, by construction.

## §10 Arithmetic & rounding policy

### 10.1 Library (resolves ADR-0008 §8)

Application-side decimal arithmetic for this module — and, by shared
constructor, for ENGINE.5's ledger deltas — is **decimal.js, pinned ^10.6**
(ENGINE.2 installs it; nothing is installed by this spec). This resolves
the library choice ADR-0008 §8 deferred (decimal.js vs dnum vs
js-big-decimal): dnum's documented API has no square root (required by §5)
and per-call decimals management; js-big-decimal defaults division to
8-digit precision and has the thinnest maintenance surface. Decision
ratified at ENGINE.1 (2026-06-04).

### 10.2 Configuration

The module exports a single cloned constructor — its only arithmetic
authority, isolated from any global decimal.js configuration:

    CpmmDecimal = Decimal.clone({ precision: 50, rounding: ROUND_HALF_EVEN })

Precision 50 significant digits gives headroom over every NUMERIC(38,18)
intermediate this file produces (products of two 38-digit values are exact
well within 50 sd at experiment magnitudes); ROUND_HALF_EVEN governs the
(immaterial) internal rounding at that precision. The square root in §5 is
decimal.js `sqrt()`, correctly rounded to the configured precision — the
only non-rational operation in the module.

### 10.3 Boundary rounding (the directional rule)

Every quantity leaving the module is quantized to exactly 18 decimal
places. Direction is fixed per quantity class:

- **User-credited quantities** — shares bought s (§4), sale proceeds M
  (§5): **ROUND_DOWN** (floor). The trader never receives the benefit of
  rounding.
- **Reserves** — derived *after* the user-side quantity is floored, by
  exact addition/subtraction of 18-dp values (buy: a′ = a + S − s_r,
  b′ = b + S; sell: a′ = a + s − M_r, b′ = b − M_r). No further rounding
  occurs or is needed; reserves are exact at 18 dp by construction.
- **Prices** — p0, p_eff, p1, impact: 18 dp **ROUND_HALF_EVEN**. These are
  informational; they never feed back into reserve arithmetic.

Consequence (§4.2.4, §5.2.4): k′ ≥ k after every rounded operation —
rounding dust accrues to the pool, never to a participant. "k is
non-decreasing" is thereby a machine-checkable per-trade invariant
(INV-C2).

### 10.4 Determinism & reproducibility

The policy is implementation-independent: any arithmetic correctly rounded
to 50 significant digits (e.g. Python `decimal` at prec=50) reproduces
every quantity in this file bit-for-bit from the same inputs — required by
INV-4 / INV-C5 for third-party audit of the public dataset. decimal.js is
the pinned production implementation; results are a pure function of
(inputs, precision, rounding) — no platform, locale, or Node-version
dependence.

### 10.5 Input domain

Module boundaries accept decimal strings validated by ENGINE.0's
`numericString` (reused via import — never `z.number()`, never redefined).
The module additionally requires strict positivity where §3.4/§4/§5 demand
it (reserves > 0, S > 0, s > 0). Violations are programmer errors — the
caller failed its contract — and throw (§13); they are not product
validation, which lives upstream (floors, balances, position sufficiency;
SPEC.1 §15 codes). The module never produces NaN or ±Infinity: the §4/§5
bounds proofs guarantee totality over the valid domain.

## §11 Invariants

Numbered INV-C* to avoid collision with the system invariants INV-1..4
(SPEC.2 §14). Each is a required ENGINE.3 property test alongside every
numbered property in §4.2 and §5.2.

- **INV-C1 — Conservation.** Every operation's Đ flow nets to zero across
  {trader, pool}; the module mints and burns share *pairs* only, never Đ.
  All flows are user ↔ pool market mechanics (SPEC.1 §10.2; upholds INV-2
  non-transferability).
- **INV-C2 — k non-decreasing.** Exact arithmetic preserves k identically;
  under §10.3 rounding, k′ ≥ k on every buy and sell, with the dust inside
  the reserves.
- **INV-C3 — Domain.** y > 0 and n > 0 always; probabilities strictly
  inside (0, 1); s > S on every buy; 0 < M < min(s, b) on every sell.
- **INV-C4 — Solvency / residual identity. AMENDED by ADR-0047.** User-held
  shares of side X equal D − x_reserve − D_X, where D_X is the cumulative
  discard on side X (§7.1) and D = pool Đ balance. **Resolved:** payout =
  D − w − D_W, unwind = w + D_W (the winning reserve PLUS the winning side's
  discard) — ⛔ **NOT auditable from the frozen reserves alone**; D_W comes
  from the market's `market.opened` event. The prior form (`unwind = w`,
  reserves-only audit) is the D_W = 0 special case that every symmetric seed
  satisfies. **Voided:** unwind (`poolUnwindAmount`) = D − Σ
  `void_refund` on the R-9.8 f × stake basis (§8.2); it equals the seed
  **only** when no realized sale P&L exists across users, and it audits
  from the shipped ledger (`bets`, `positions`, `dharma_ledger`) plus the
  terminal `market.voided` row (R-9.5e) — **not** from reserves alone.
- **INV-C5 — Frozen determinism.** Terminal CPMM state is immutable; the
  module is pure and deterministic (§10.4); every §8 quantity is exactly
  reproducible by an auditor from the frozen state (upholds INV-4).
  ⚠ Since ADR-0047 the frozen state that an auditor needs is the reserves
  **and the market's `market.opened` payload** — the discard terms live
  there, not in `pools`. Both ship in the dataset (SPEC.2 §19.3 row 1 +
  §19.4.1), so the reproducibility claim holds; what changed is which rows
  the auditor has to read.

## §12 Worked examples

All values computed under the §10 policy (precision 50, boundary rounding
as stated); 18-dp strings shown in full. ENGINE.3 must encode E1–E5 as
fixed-vector tests verbatim.

**E1 — Seed.** C = 100 → (y, n) = (100, 100); p_yes = p_no =
0.500000000000000000.

**E2 — Buy YES, S = 10, from (100, 100).** k = 10000.
Exact s = 110 − 10000/110 = 19.0909… (repeating); floored:

    s   = 19.090909090909090909
    y′  = 90.909090909090909091        n′ = 110
    k′  = 10000.000000000000000010     (≥ k: dust to pool)
    p0  = 0.500000000000000000
    p_eff = 0.523809523809523810
    p1  = 0.547511312217194570
    impact = 0.047511312217194570      (4.75 points)

**E3 — Immediate full sell-back of E2's shares.** Selling
s = 19.090909090909090909 YES from (90.909090909090909091, 110):

    M   = 9.999999999999999999         (exact root 9.9999…95; floored)
    y″  = 100.000000000000000001       n″ = 100.000000000000000001
    k″  = 10000.0000000000000002…      (≥ k)
    p1  = 0.500000000000000000

Round-trip neutrality (§5.3) made concrete: the trader paid 10, got back
9.999999999999999999; the missing 10⁻¹⁸ Đ is the rounding dust, now in the
reserves.

**E4 — Skewed buy (clean integers).** State (150, 50), p_yes =
0.250000000000000000. Buy YES, S = 10; k = 7500:

    s   = 35.000000000000000000        (exact: 160 − 7500/60 = 35)
    y′  = 125.000000000000000000       n′ = 60
    k′  = 7500.000000000000000000      (= k: no dust — s was exact)
    p_eff = 0.285714285714285714       (= 2/7)
    p1  = 0.324324324324324324         (= 12/37)
    impact = 0.074324324324324324      (7.43 points)

If YES resolves: the position pays s = 35 Đ on a 10 Đ stake — Δ = +25 =
S·(1 − p_eff)/p_eff with p_eff = 10/35 (§9.2): the convexity of a correct
low-p bet, with no bonus term anywhere.

**E5 — Resolution residual on E2 (no sell).** D = seed 100 + stake 10 =
110. User holds 19.090909090909090909 YES; reserves
(90.909090909090909091, 110).

- YES wins: payouts = 19.090909090909090909; `pool_unwind` =
  90.909090909090909091 (the YES reserve). Sum = 110.000000000000000000 ✓.
- NO wins: user holds no NO shares; payouts = D − n = 110 − 110 = 0;
  `pool_unwind` = 110 (the NO reserve) ✓.

The §8.1 residual identity, demonstrated on both branches. ⚠ E5 is a
SYMMETRIC seed, so `D_yes = D_no = 0` and the unwind equals the winning
reserve exactly. That is the special case, not the rule: since ADR-0047 the
identity is `unwind = w + D_W`, and on a market opened at a price the winning
side's discard is added. E1–E5 are deliberately left on the symmetric seed —
they are ENGINE.3's fixed vectors and rewriting them would rewrite the
`tests/unit/cpmm/vectors.test.ts` suite in a task with no mandate to. An
asymmetric worked example is owed and belongs with Phase 2.

## §13 Module API (ENGINE.2 contract)

Pure TypeScript at `src/server/cpmm/` (`import 'server-only'` per ADR-0008
house pattern; no framework dependencies). All quantities are decimal
strings (`numericString`); DB column mapping is ENGINE.2 glue outside this
module (SPEC.2 Appendix B.3 owns column names). Signatures are normative in
semantics and shape; ENGINE.2's plan may adjust naming ergonomics without
changing meaning.

    type Side = 'yes' | 'no'
    type Reserves = { yes: string; no: string }

    seedPool(seed: string): Reserves
      // {yes: seed, no: seed}; requires seed > 0. ⚠ The p = ½ SPECIAL CASE of
      // §7.1, not the open mechanism — `openingReserves` is. Kept because every
      // historical market.opened row is this shape and §12's vectors pin it.

    seedReserves(yes: string, no: string): Reserves
      // Seed from two explicit reserves; both > 0  (§7.1)

    openingReserves(args: { openingPriceYes: string; tank: string }):
      { reserves: Reserves; backingMinted: string;
        discardedYes: string; discardedNo: string }
      // THE open mechanism (§7.1, ADR-0047 §B). no = floor18(p·T),
      // yes = T − no, so yes + no == T exactly; mints max(yes,no) pairs and
      // discards max − min on the short side. p strictly inside (0,1).

    addLiquidity(args: { reserves: Reserves; amount: string }):
      { reserves: Reserves; backingMinted: string;
        discardedYes: string; discardedNo: string }
      // Price-preserving addition (ADR-0047 §A). L' = L + a,
      // S' = floor18(S + a·S/L), discarded = a − (S'−S) as a RESIDUAL so the
      // backing identity closes exactly. NO runtime caller in Phase 1 — it is
      // the oracle the Phase-2 SQL injector is differentially fuzzed against.

    getPrices(reserves: Reserves): { yes: string; no: string }
      // §3.3; 18 dp HALF_EVEN

    computeBuy(args: { reserves: Reserves; side: Side; stake: string }):
      { shares: string; reserves: Reserves;
        p0: string; pEff: string; p1: string; impact: string }   // §4, §6

    computeSell(args: { reserves: Reserves; side: Side; shares: string }):
      { proceeds: string; reserves: Reserves;
        p0: string; pEff: string; p1: string; impact: string }   // §5, §6

    computeResolvedUnwind(args: { reserves: Reserves; outcome: Side }):
      { residual: string }
      // ⛔ SUPERSEDED BY ADR-0047 §E AS THE RESOLVED UNWIND, and it has no
      // src/ caller. Returns the bare winning-side reserve, which was the
      // residual only while every discard was zero. The shipped resolved
      // unwind is `w + D_W` (§8.1) and lives in resolution/settle.ts, not
      // here — this function would under-pay every asymmetric winning side.
      // Kept because §12's vectors pin it; its removal is a Phase-2 call.
      // Void residual is a ledger identity (§8.2), not a curve computation.

    CpmmDecimal   // the §10.2 cloned constructor, exported for ENGINE.5

Error contract: malformed or domain-violating inputs (§10.5) throw a typed
`CpmmInputError` — programmer error, not product validation; handlers
perform all business checks (floors, balance, position sufficiency,
market state) before calling. Over the valid domain the functions are
total: they never throw, never return NaN/Infinity (§4/§5 proofs). The
module reads no clock, no environment, no randomness.

## §14 Non-goals

Fees of any kind; order books and limit orders; multi-outcome markets;
curve weights (p ≠ ½) — asymmetric seeds are NO LONGER a non-goal; ADR-0047
made them the only open mechanism (§7.1, §7.3);
mid-market liquidity operations (SPEC.1 §10.6); slippage tolerance,
auto-abort, or per-trade warning — retired by ruling, not open (design-canon
§4 ruling 2, W2.10 Option A: deep-liquidity seeding + the SPEC.1 §16.1
per-bet stake cap; SPEC.1 §7, 1.0.15); numeric magnitudes (seed C, floors,
the per-bet stake cap — SPEC.1 §16.1, number-tuning); DB column names (SPEC.2
Appendix B.3); UI presentation and display rounding (design.md / DESIGN.4);
event-type minting (ENGINE.0's vocabulary is closed; §8 uses existing
types and tables); admin trading (structurally impossible, SPEC.1 §10.1);
the curation slate's product definition (§7.2 — SPEC.1, debate phase).

## §15 Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-06-04 | HMH | Initial authoring at ENGINE.1. Lineage pinned to `zugzwang-foundation/manifold-reference` @ `d5b55cf9` (tag `ref-2026-04-28-found5`), MIT notice landed in `THIRD_PARTY_NOTICES.md` same-commit. Decimal arithmetic pinned: decimal.js ^10.6, precision 50, 18-dp directional boundary rounding (floor on user-credited quantities; resolves ADR-0008 §8; binds ENGINE.2 + ENGINE.5). Slippage pinned as absolute probability-point impact, strict-> threshold trigger (F-BET-9; gates DESIGN.4). §7.2 pre-launch curation slate recorded as standard launch procedure (product definition deferred to SPEC.1 / debate phase). Worked examples E1–E5 are ENGINE.3 fixed vectors. |
| 2.0.0 | 2026-07-07 | HMH | **§8.2 + INV-C4 rewritten to the founder-ratified R-9.8 void basis** (AUDIT.1 finding D1; canonical sources: SPEC.1/SPEC.2 v1.0.3 ENGINE.9 riders + shipped `resolution/void.ts`): refund = f × stake per bet, sale proceeds stand, no negative compensating entries, no void-leg `uncollectable`; residual (`poolUnwindAmount`, R-9.5e) = D − Σ `void_refund`, equal to seed only absent realized sale P&L; void auditing is ledger-based, not reserve-alone. §13 contract comment verified current (void stays ledger arithmetic, no curve function — unchanged). MAJOR per §0 semver (formula/invariant change). Also records the previously-unlogged ENGINE.14 amendment (`a29ef7e`, pool-seed payload recording form — no version bump was made at the time). |
| 2.1.0 | 2026-07-15 | HMH | **Slippage warning trigger retired** (F-BET-9; SPEC.1 1.0.15; basis design-canon §4 ruling 2 — W2.10 Option A, operator-ratified 2026-06-27). §6.2 trigger removed (threshold, strict->, pre-confirm modal); its probability-points rationale relocated to §6.1 as the impact-unit definition. §6.4 consumable reframed from the pre-confirm modal to the non-blocking preview (price / shares / cost-or-proceeds; `threshold` dropped from the bundle; the caller-side SPEC.1 §16.1 per-bet stake cap is reflected in the preview figures — the cap constant itself deliberately lives only in SPEC.1: app-layer guard, the pure functions stay pure). §0 gates / §1 / §4.4 / §14 warning references scrubbed. MINOR per §0 semver: no change to the §6.1 impact formula, §6.3 preview semantics, §13 returns, or the worked examples — consumer-scope change, not a formula/invariant change. |
| 3.0.0 | 2026-09-06 | HMH | **ADR-0047 Phase 1 — asymmetric open at a chosen price (LIQ-1).** **§7.1** rewritten: the `Draft → Open` seed commits a TANK of T Đ at an opening price p ∈ (0,1) and initialises the reserves ASYMMETRICALLY at `(y0, n0) = ((1 − p)·T, p·T)`, replacing the symmetric `(y0, n0) = (C, C)`; the symmetric seed is now the p = ½ special case, not the rule. The pair-mint account is completed by the **backing identity** `Y + H_yes + D_yes == N + H_no + D_no == total Đ deposited`, where `D_x` is the cumulative DISCARD per side — summed from `market.opened` (and, from ADR-0047 Phase 2, `pool.liquidity_added`). Discards are large by construction: the fraction is `1 − min(p,1−p)/max(p,1−p)`, 88.9% at a 10% open. **§7.3** the recorded rejection of asymmetric open is REVERSED and kept in place, struck, with the measurement that overturned it (a curation slate reaching 10% needs operator-held NO positions carrying mandatory arguments the operator does not hold — arguments by fiat, with stake, which is further from an honest book than a discard nobody holds); the upstream `p`-weight rejection STANDS and is re-derived rather than inherited. **MAJOR per §0 semver** — `(y0,n0) = (C,C)` is a formula this changes, and the backing identity is a new invariant. §7.2's slate paragraph is narrowed by §7.1's new closing sentence rather than rewritten; §7.4 and §14 are Phase 2 and deliberately untouched here. Paired: SPEC.2 §19.4.1 `market.opened` SHIP row (same commit), `src/server/cpmm/calculate.ts` `openingReserves`/`addLiquidity`/`seedReserves`, `src/server/markets/open.ts`. |
| 3.0.0 | 2026-09-06 | HMH | **§7.2 rewritten under the same version (LIQ-1 Phase 1 addendum D3).** The row above deliberately left §7.2 alone, which put a flat "the probability at seed is 0.5 structurally" one section below a §7.1 that had just made it false — a reader landing on §7.2 first met the superseded claim, with the correction in a section they had not opened (`O-4`). §7.2 no longer sets price: the slate seeds ARGUMENTS ONLY, in stakes deliberately too small to move the curve, and every sentence describing operator-controlled accounts walking the price to a chosen level is DELETED rather than qualified. The reasoning that overturned it is kept, because the old design was not obviously wrong and a reversal with no argument teaches a later reader nothing. "Per-market opening levels" is struck from §7.2's deferred-product list — it is a parameter of market opening now, not a curation outcome. **No version bump: 3.0.0 is the ADR-0047 version and this is that same amendment finishing its job**, not a second one. |
| 3.0.0 | 2026-09-06 | HMH | **§8.1, §11 INV-C4 and §11 INV-C5 amended; §7.1's `T` disambiguated (LIQ-1 Phase 1, `@code-reviewer` HIGH-3 and MEDIUM-5).** §8.1 and INV-C4 still said the resolved unwind is **exactly the winning-side reserve, auditable from the frozen reserves alone** — true only while every discard was zero, and CONTRADICTING the shipped `resolution/settle.ts` as of this same version. On a spec↔code conflict the spec wins, so a later session reading INV-C4 would have "corrected" settle.ts back and silently under-paid every asymmetric winning side by its discard. Now: `unwind = w + D_W`, payout = `D − w − D_W`, and the reserves-only audit claim is struck — D_W is read from `market.opened`. INV-C5's determinism claim SURVIVES and is scoped: the auditor needs the reserves AND the genesis payload, both of which ship (SPEC.2 §19.3 row 1 + §19.4.1). **The plan's T11 only ever scoped §7.1 and §7.3, so §8/§11 were a plan gap rather than an execution slip.** §7.1 additionally: `T` is the reserve SUM, not the Đ deposited (that is `B = max(y0,n0)`, 90,000 against T = 100,000) — the original wording conflated the two in the same section that equates the backing identity to Đ deposited, and Phase 2's target rule compares against T. |
| 3.0.0 | 2026-09-06 | HMH | **§13 and §12 E5 — the two sites the §8.1 amendment above MISSED (self-grep, LIQ-1 Phase 1).** O-4 says a durable amendment lands at every site that states the superseded position, and the row above corrected §8.1 and §11 while leaving two others asserting it. **§13** — the module API contract — still documented `computeResolvedUnwind` as `= winning-side reserve (§8.1)`, which is a contract line directly contradicting `resolution/settle.ts`; it now carries the supersession, the reason it is kept (§12's vectors pin it) and the warning that reaching for it by name under-pays every asymmetric winning side. **§12 E5** was not wrong — it is a symmetric seed, so `D_W = 0` and its figures stand — but it closed "the §8.1 residual identity, demonstrated on both branches", from which a reader concludes the identity is reserves-only. E1–E5 stay on the symmetric seed deliberately: they are ENGINE.3's fixed vectors and rewriting them rewrites `tests/unit/cpmm/vectors.test.ts`, which this task has no mandate to do. An asymmetric worked example is OWED and belongs with Phase 2. |
