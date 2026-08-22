# ADR-0039 — Per-argument lot accounting (lot = bet = argument; sell is per-lot)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-21 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | LOTS-1 |
| **Frame document** | SPEC.1 §23 (the Đa staked basis · the six tiles · FI-2 basis identity) + SPEC.1 §2 (*SideEpisode*) + SPEC.1 §5 (INV-1…INV-4) + ADR-0017 (reply-as-bet) + ADR-0013 (W-1 SERIALIZABLE bet transaction). Grounded on the READ-ONLY recons `zz_POSCHK-1_recon_2026-08-20T1811`, `zz_POSCHK-1_addendum_2026-08-20T1811` and `zz_RECON-1_surface-audit_2026-08-20T1905`. |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Patch record

**P1 (2026-08-22, RANK-1) — R4 now names all THREE rulers.** In-place Patch record
per CLAUDE.md §5.12 (consumer-surface scoping, **not** supersession). **The
load-bearing decision is unchanged:** ranking keys off surviving lot basis rather
than frozen `bets.stake`. What changes is the enumeration of what "ranking" covers.

**R4 as originally written** read:

> *Ranking keys off SURVIVING LOT BASIS, not frozen bets.stake — both the
> reply-lane ordering ruler and the post-lane attracted-value aggregates.*

It named two rulers. **There are three.** The third is `tiebreak()`
(`src/lib/ranking.ts`), which reads a post's author stake from the frozen
`bets.stake` and decides `topOrder` whenever the lane margins tie — and per
RANKING.md §3.3 that is not an edge case but the *ordinary* state of a young
market, where every post sits below every activity floor and the entire order is
therefore decided by author conviction alone. It also decides `profileOrder`
outright. It was named in **no** document; it was found adversarially at MERGE-1
as SURPRISE S-2.

**The reason for the amendment is a confirmed exploit, not a tidiness concern.**
Place a large reply-bet on a rival's post; the reply-lane ruler sorts on frozen
`bets.stake`, so it takes the top Support or Counter slot and `twoSlot` surfaces
it to every visitor as the best argument on that side. Then exit it. **The CPMM
is fee-less**, so the round trip returns the stake minus ~1e-18 of dust. The lot
goes Sold, `bets.stake` never moves, and the slot is held permanently. It repeats
on every post in every market, and the same shape works one lane over on
`tiebreak()` for the top of the market itself.

Two things this ADR shipped made it worse rather than better, which is why the
patch belongs here:

- **R3's per-lot sell made the exit surgical.** Before it, recovering one reply's
  stake shrank every argument that participant held in that market pro-rata, so
  the attack cost the attacker their other positions.
- **R5's attracted-value decay made it invisible.** The captured slot now renders
  `Đ 0` attracted value beside a `#1` ordering — inverting the one signal a
  reader could have used to detect the manipulation into something that reads
  like a rounding artifact.

**Also amended, in the same commit:** R4's ruling text above; RANKING.md §2, §3.3,
§3.4, §3.6, §7 and §8 (which described frozen stake throughout, and whose §2
aggregate rows had additionally been stale since LOTS-1 shipped R4's aggregate
half in code without amending the spec); and D-5 below. **R6 is unchanged and now
applies to two more surfaces** — the reply badge and the post badge render the
same figure their ruler sorts on, reduced-with-strikethrough when partially sold
and `Đ 0` + `Sold` at exactly zero.

**No schema change.** `lots.surviving_basis` already exists; this is a read-path
substitution at four application query sites plus the staging verification script
(`scripts/verify-ranking-staging.ts`, which had already drifted), and the `lots`
reach is a 1:1 unique-index lookup (`lots_bet_id_uq`), so no aggregate can fan out.

---

## Context and Problem Statement

A participant's holding in a market is currently a single aggregate number with no
attribution beneath it. `positions.quantity` is one row per `(user, market, side)`;
the Staked figure **Đa** is derived by walking that user's whole bet stream for the
market (`src/server/profile/episodes.ts`), and the walk collapses every bet into one
running basis. Three measured consequences follow, and together they are why this
ADR exists:

- **The summands are not rendered.** `stakedBasis` is read at exactly **two** sites in
  the tree (`src/server/profile/positions.ts`, `src/server/bookmarks/figures.ts`),
  both market-scoped. No per-argument basis exists anywhere. On the profile — the
  surface SPEC.1 §23 names as *where a complete record lives* — a participant whose
  basis is 100% reply-bets has **no rendered component of it at all**: the reply-stake
  badge is gated to posts (`ArgumentList.tsx:483`), so the Đ 50 they staked appears
  nowhere on the page displaying their Đ 50 position. Measured on staging: **12 of 39
  held positions (31%) have a majority of their Đa invisible to their owner**, across
  8 of the 9 participants who hold anything.
- **What *is* rendered cannot be reconciled to the aggregate, and after any partial
  sell provably never can.** Argument cards show the frozen `bets.stake`. `bets` is
  Bucket-A append-only (three storage triggers) and a sell writes no `bets` row, so a
  stake badge is immutable forever — while Đa is multiplied by a surviving fraction
  that is rendered nowhere. Before a sell the badges happen to sum to Đa; after one
  they are **guaranteed** to disagree, with no on-screen quantity able to close the gap.
- **The episode boundary is invisible, and the existing marker does not stand in for
  it.** Measured on `math-erdos-contribution-response`: a reader who correctly excludes
  every `Flipped`/`Exited` argument still computes **150** against a true Đa of **50**,
  because a full exit closed an episode *within* the NO side and nothing rendered
  records that boundary.

The forces:

- **The thesis needs attribution, not just a total.** Zugzwang's claim is that argued
  stake is accountable. A holding that cannot be decomposed into the arguments that
  built it is a number the participant must take on trust — which is the thing the
  product exists to refuse.
- **Selling is currently position-level and therefore un-attributable.** A participant
  who wants to withdraw from *one argument* they no longer believe has only one
  control: shrink the whole position. Whatever they meant, every argument they ever
  made in that market is reduced by the same fraction.
- **`positions` is load-bearing and must not be disturbed.** It carries INV-2's
  non-negativity CHECK, the `positions_one_held_side_idx` single-held-side guard, and
  the W-1 write spine (ADR-0013). Attribution must sit *beneath* it, not replace it.
- **Nothing may be back-filled, because nothing needs to be.** The experiment's live
  window opens **2026-09-15**; production has never served participants (the prod
  alias still serves a 2026-07-02 build). Staging is disposable by operator ruling.

This ADR does **not** decide:

- **Settlement mechanics.** `resolution_events` → `payout_events` (INV-4), the W-3
  trio, and R-9.8's position-level attribution total are unchanged (ADR-0021 lane;
  SPEC.1 §10). This ADR adds a per-lot *attribution* that **sums to** the existing
  position-level total; it does not change what is paid.
- **The CPMM.** Pricing, `computeBuy`/`computeSell`, and the fee-less single-MM model
  are untouched (`src/server/cpmm/`, cpmm spec 2.1.0).
- **Dharma issuance or the bet floors** (ADR-0018) — `BET_MIN_STAKE_POST` /
  `BET_MIN_STAKE_REPLY` apply to a bet, and a lot is a bet, so they apply unchanged.
- **The reply-as-bet model** (ADR-0017). A lot is 1:1 with a bet, and every bet already
  rides exactly one comment; this ADR consumes that identity and does not extend it.
- **Moderation / masking** (ADR-0021, CLAUDE.md §5.14 SC-1). A removed comment's lot
  still exists and still carries basis; the *body* is masked by the existing read
  predicate. Inherited, not re-decided.
- **The four `computeSell` Đb call sites and the FI-2 identity gap between them**
  (RECON-1 R-07/R-11). Measured and docketed; out of this ADR's frame.

## Decision Drivers

1. **Attribution must be structural, not derived at read time.** A basis that is
   recomputed by walking an event stream can only ever answer *how much*; a stored
   per-lot row answers *from what*, and can be reduced by a sell that names it.
2. **`positions` remains the aggregate authority.** Every invariant, index and CHECK
   that currently protects a holding must keep protecting it, unchanged. Lots are a
   decomposition beneath the authority, never a competing one.
3. **The decomposition must be provably exhaustive.** If Σ lot shares could drift from
   `positions.quantity`, the feature would render an attribution that does not add up —
   worse than rendering none. This needs to be an invariant with a test, not a habit.
4. **Sold must be permanent.** An argument sold to zero is a public record of a
   position that was taken and released. Re-entering must mint a *new* argument, not
   silently revive an old one — the append-only posture applied to attribution.
5. **No back-fill path may be written.** A migration that invents lots for pre-existing
   positions would be inventing attribution that was never expressed. Since no such
   position exists anywhere, a back-fill would also have no consumer — and unused
   migration code is a liability that outlives its author's memory of why it is inert.
6. **The ritual cost must be stated, not absorbed.** This crosses four CLAUDE.md §1
   critical paths (`bets/`, `positions/`, `dharma/`, schema+migrations). Every slice
   carries the full ritual. That cost belongs in the record.

## Considered Options

1. **Per-argument lots — a `lots` row 1:1 with each `bets` row, carrying surviving
   shares and surviving basis, reduced per-lot on sell, summing to `positions`.** ← chosen
2. **Per-post sell** — attribution and sell affordance at the top-level post, with a
   post's replies folded into it.
3. **Pro-rata only** — keep the position-level sell, and *render* each argument's
   pro-rata share of the current basis without ever letting a participant name one.
4. **Retraction marker** — leave the accounting alone and add a per-argument "I no
   longer hold this" marker with no monetary effect.

## Decision Outcome

**Chosen: Option 1 — per-argument lots.** The ruling body below (R1–R10) is
founder-authored and is reproduced **verbatim**; it is the normative part of this ADR.

### The ruling (R1–R10)

> **R1**  Lot = bet = argument, 1:1. "Lot" never appears in user-facing copy.
>
> **R2**  `positions` SURVIVES as aggregate authority. Side-binding, INV-2 and
> positions_one_held_side_idx UNCHANGED. Lots are attribution beneath.
> NEW INVARIANT: Σ surviving lot shares == positions.quantity, per
> (user, market, side).
>
> **R3**  Sell is per-lot. Position-level "sell all" retained, executed as ONE
> atomic multi-lot sell in a single DB transaction.
>
> **R4**  ALL THREE RANKING INPUTS KEY OFF SURVIVING LOT BASIS, no exceptions:
> the reply-lane ordering ruler, the post-lane `tiebreak()` author-conviction
> input, and the attracted aggregates. If the money can leave, the rank it
> bought leaves with it.
> *(**AMENDED at RANK-1, 2026-08-22.** As originally written R4 named only the
> reply-lane ruler and the attracted aggregates; `tiebreak()` was a third ruler
> nobody had listed. Patch record P1 below carries the reason and the original
> wording — nothing is rewritten out of the record.)*
>
> **R5**  support_dharma / counter_dharma decay when a replier's lot sells down.
>
> **R6**  A partially-sold lot renders a reduced figure and NO tag. The Sold tag
> renders only at exactly zero surviving basis.
>
> **R7**  Settlement attribution per-lot, summing to the position. R-9.8's
> position-level total is preserved as the sum.
>
> **R8**  NO BACKFILL. Staging is wiped and production has never gone live, so no
> pre-lot position exists anywhere. Lots are minted natively from the first
> bet forward. Do NOT write a backfill path — it would have no consumer.
> If you find evidence production DOES hold bets, HALT immediately and
> report; do not proceed.
>
> **R9**  Sold is permanent, append-only. Re-buying mints a new bet ⇒ new argument
> ⇒ new lot. INV-3 unchanged: selling never alters a comment.
>
> **R10** Marker vocabulary: Sold (lot basis == 0) is NEW and per-ARGUMENT. Exited
> (position quantity == 0) and Flipped are UNCHANGED and per-POSITION.
> Orthogonal; they compose.

### D-1 · Storage — the `lots` table (Bucket C, mutable)

A new table in a new schema domain file `src/db/schema/lots.ts` (domain-per-file,
ADR-0008). **Bucket C**, for the same reason `positions` is: `surviving_shares` and
`surviving_basis` mutate on every sell that names the lot. It is *not* Bucket A — a
Bucket-A trigger forbids UPDATE, which is the opposite of what this table needs.

**What the CHECKs actually give, stated precisely (corrected at PHASE-0).** An earlier
version of this paragraph justified the choice by claiming the monotone CHECKs were
*stronger* than comparing against the previous value, which storage supposedly could
not see. **Both halves of that were false, and the second was falsifiable by reading
`0003`** — the Bucket-B trigger functions compare `OLD` and `NEW` row images routinely;
that is the entire mechanism of the whitelisted-transition pattern. Storage sees the
previous value whenever a trigger is asked to look. And `new ≤ old` implies
`new ≤ original` while the converse does not, so the comparison that was dismissed is
the strictly stronger one. The justification argued for the right decision backwards,
which is worse than arguing for a wrong one: it makes the weaker guarantee sound
sufficient and forecloses the question.

The true statement is narrower and worth having in these words:

- **The CHECKs bound RANGE, not DIRECTION.** `surviving_shares <= original_shares`
  says a lot is never larger than it was minted. It does **not** say a lot never GROWS:
  an UPDATE raising `surviving_shares` from 5 back to 20 against an original of 20
  satisfies every CHECK on the table. Nothing at the storage layer refuses it.
- **R9's monotonicity is therefore APPLICATION-enforced**, by `sellFromLot` being the
  only function that computes a new surviving value and `planLotSale` / `applyLotSale`
  being the only path that writes one. That is a real guarantee and it is the one in
  force — it is simply not a storage guarantee, and this ADR should not have implied
  otherwise.
- **R9's PERMANENCE is storage-enforced, by migration `0026`.** A lot that reached zero
  could still be DELETEd, and a DELETE breaks R2 in the one direction the CHECKs are
  structurally blind to: they bound each surviving row from both ends, so they cannot
  see a summand that is no longer there. `lots_no_delete` (row-level `BEFORE DELETE`)
  closes it. Deliberately not a `bucket_%` name and deliberately not a TRUNCATE guard —
  see the migration-shape section below.
- **The UPDATE-monotonicity trigger** — an `OLD`/`NEW` comparison rejecting any UPDATE
  that raises `surviving_shares` — is the piece that would move R9's first half into
  storage too. It is **DOCKETED, not built**, and named here so the gap is a known
  quantity rather than a claim nobody re-examined.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK `default sql\`uuidv7()\`` | ADR-0016 convention |
| `bet_id` | `uuid` NOT NULL → `bets.id` (`onDelete: restrict`), **UNIQUE** | R1's 1:1, enforced in storage |
| `user_id` | `uuid` NOT NULL → `users.id` (`onDelete: restrict`) | denormalized from the bet — the aggregate key |
| `market_id` | `uuid` NOT NULL → `markets.id` (`onDelete: restrict`) | as above |
| `side` | `side` (pgEnum) NOT NULL | as above; matches `positions.side` |
| `original_shares` | `numeric(38,18)` NOT NULL | `bets.share_quantity` at mint; never mutates |
| `original_basis` | `numeric(38,18)` NOT NULL | `bets.stake` at mint; never mutates |
| `surviving_shares` | `numeric(38,18)` NOT NULL | mutable; monotone non-increasing |
| `surviving_basis` | `numeric(38,18)` NOT NULL | mutable; monotone non-increasing |
| `created_at` | `timestamptz` NOT NULL `defaultNow()` | |
| `updated_at` | `timestamptz` NOT NULL `defaultNow()` | application-managed on UPDATE (Drizzle 0.45 does not auto-bump) |

`user_id` / `market_id` / `side` are denormalized from the bet rather than reached
through a join, because the R2 invariant is stated per `(user, market, side)` and must
be checkable by one indexed aggregate read. They are immutable after mint and are
never the authority — `bets` is.

**Constraints (storage-layer, all named):**

| Name | Predicate | Serves |
|---|---|---|
| `lots_bet_id_uq` | UNIQUE (`bet_id`) | R1 — one lot per bet, exactly |
| `lots_original_shares_positive` | `original_shares > 0` | a lot with no shares is not a lot |
| `lots_original_basis_positive` | `original_basis > 0` | the bet floors (ADR-0018) already guarantee it |
| `lots_surviving_shares_non_negative` | `surviving_shares >= 0` | R2's floor; mirrors `positions_quantity_non_negative` |
| `lots_surviving_basis_non_negative` | `surviving_basis >= 0` | as above |
| `lots_surviving_shares_monotone` | `surviving_shares <= original_shares` | R9 — a lot never grows |
| `lots_surviving_basis_monotone` | `surviving_basis <= original_basis` | R9 |
| `lots_sold_zeroes_basis` | `surviving_shares > 0 OR surviving_basis = 0` | R6/R10 — a fully-sold lot carries no basis |

**Indexes:** `lots_user_market_side_idx` on `(user_id, market_id, side)` (the R2
aggregate read and the decomposition read); `lots_surviving_idx` on
`(user_id, market_id, side) WHERE surviving_shares > 0` (the hot read — only surviving
lots are rendered or sellable; the `positions_one_held_side_idx` partial-index
precedent); `lots_market_id_idx` and `lots_user_id_idx` (the AGENTS.md §6 FK-index
convention, A31 precedent).

**The `lots_sold_zeroes_basis` asymmetry is deliberate.** The reverse implication
(`surviving_basis = 0 → surviving_shares = 0`) is **not** enforced, because 18-dp
half-even quantization of a pro-rata reduction can in principle round a basis to zero
while dust shares remain. That state is unreachable over real data — it requires a
lot whose basis-to-shares ratio is below 1e-18, i.e. an execution price below 1e-18,
and CPMM prices live in (0,1) with stakes floored by ADR-0018 — but it is arithmetic,
not law, so it is not asserted as a constraint. **The canonical `Sold` predicate is
therefore `surviving_shares = 0`**, and the two columns zero *together by law* on a
full-lot sell (the `computeEpisodes` full-exit precedent: the basis is set to canonical
zero, not divided to it).

### D-2 · Mint — one lot per bet, inside the W-1 transaction

`place()` (`src/server/bets/place.ts`) inserts the lot immediately after the `bets`
INSERT it mirrors, inside the same ADR-0013 SERIALIZABLE transaction. Write order
becomes: reads → accrual → positions → comments → bets → **lots** → dharma_ledger →
events → pools → receipt. The lot follows `bets` because it carries the bet's
`RETURNING` id; it precedes `dharma_ledger` so the money writes stay last-but-one as
they are today.

At mint, `surviving_* = original_*` — a freshly-placed argument is wholly intact.

**There is no other mint site.** A lot exists if and only if a bet exists, and bets are
minted in exactly one place.

### D-3 · Sell — per-lot, and the position-level path

`sellFromLot(lot, sharesToSell)` is a pure function (`src/server/lots/compute.ts`):

- `sharesToSell > surviving_shares` → `LotOversellError` (the per-lot oversell
  pre-check R3/S5 requires; mirrors `InsufficientSharesError` at the position level).
- `sharesToSell == surviving_shares` → **full lot sale**: both survivors set to
  canonical zero **by law**, not by division. This is what makes `Sold` exact.
- otherwise → `surviving_shares' = surviving_shares − sharesToSell`, and
  `surviving_basis' = surviving_basis × surviving_shares' / surviving_shares`,
  precision-50 intermediates quantized half-even at 18 dp — the same R-9.8
  surviving-fraction mechanic `computeEpisodes` applies, now scoped to one lot.

Two sell shapes reach it:

1. **Per-lot sell** — the request names a `lotId`. Exactly one lot is reduced. This is
   the new affordance R3 mints, and it is the one that makes a sell mean something
   about a specific argument.
2. **Position-level sell** — the request names no lot (the shipped `POST /api/bets/sell`
   contract). Every surviving lot in `(user, market, side)` is reduced **pro-rata by the
   position-level surviving fraction**, in ONE atomic multi-lot sell inside a single
   transaction. `shares == positions.quantity` is the "sell all" case R3 retains, and it
   falls out exactly: the fraction is zero, so every lot takes the full-sale branch and
   every lot goes to `Sold`.

⛔ **Attribution never vetoes the authority.** If a holding has **no** surviving
lots, the position-level sell **proceeds and reduces nothing**. This follows
directly from R2 — `positions` is the aggregate authority and lots are
"attribution beneath" — and getting it backwards is dangerous rather than merely
wrong: were the sell to refuse, any drift between `lots` and `positions` (a bug,
a half-applied migration, a hand-seeded row) would **lock a participant out of
exiting a position they hold**, trapping their Dharma behind a bookkeeping
disagreement. Incomplete attribution is recoverable; a trapped position is not.
The drift is not swallowed — `I-LOT-SUM-001` asserts the equality against live
data, which is where a real divergence belongs.

The **per-lot** path still refuses an unknown or foreign lot id, and must: there
the lot *is* the subject of the request, so a bad id is a wrong request rather
than missing bookkeeping.

⚠ **The pro-rata rule for the position-level path is the one mechanic R1–R10 does not
state, and it is chosen to change nothing.** The alternatives were FIFO and
LIFO consumption. Pro-rata is selected because it reproduces the shipped Đa arithmetic
**exactly** — Σ (basis × f) = (Σ basis) × f — so the position-level sell's observable
basis behaviour is byte-identical before and after this ADR, and the green
`staked-episode-basis-post-partial-sell` assertion (`staked === "75"`) stays green for
the reason it was written rather than by coincidence. The operator's rejection of
pro-rata (see Option 3 below) was a rejection of pro-rata **as the user-facing sell
model** — as the thing you get *instead of* naming an argument. It is not in tension
with pro-rata as the mechanic of the control that deliberately names no argument.
FIFO/LIFO would each silently assert an ordering claim the participant did not make.

### D-4 · Đa is now Σ surviving lot basis

`Đa(user, market, side) = Σ lots.surviving_basis WHERE surviving_shares > 0`.

This replaces the `episodes.ts` walk **as the basis authority** at both of its two
current readers (`profile/positions.ts`, `bookmarks/figures.ts`). `computeEpisodes`
survives, and keeps two jobs it alone can do: the graph's SideEpisode **gap law**
(`profile/graph-series.ts`, which calls it and never reads `stakedBasis`) and the
**`openingTradeId`** the N-1a argument cell resolves. It is no longer on the basis path.

⚠ **This is a redefinition, not a refactor, and the two definitions genuinely differ.**
They agree for the position-level path (D-3, by construction) and for any market where
every lot was bought at the same price. They diverge the moment a **per-lot** sell
targets lots of unequal price — which is the entire point of the feature. Worked
example: lot A (basis 100 → 40 shares) and lot B (basis 100 → 20 shares), sell all of B.
Episode model: 200 × 40/60 = **133.33**. Lot model: **100**. The lot model is the correct
one *because it knows which shares left*; the episode model was the best available
answer when nothing did.

### D-5 · Ranking (R4) and attracted-value decay (R5)

`support_dharma` / `counter_dharma` are today read-time `SUM(rb.stake) FILTER (…)`
aggregates over the frozen `bets.stake`, at three byte-equivalent sites
(`debate-view/ranking-substrate.ts`, `profile/arguments.ts`, `bookmarks/list.ts`).
Under R4/R5 the summand becomes the replier's **surviving lot basis** for that reply —
`SUM(COALESCE(l.surviving_basis, rb.stake)) FILTER (…)`, joined `lots ON lots.bet_id =
rb.id`. A replier who sells their lot down therefore withdraws the weight they lent the
parent, which is the behaviour R5 names.

**The COALESCE fallback is part of the ruling, not a defensive habit.** Every bet mints
its lot inside the same W-1 transaction (R8), so a lot-less bet does not arise. The
fallback exists for what would happen if one ever did: dropping it would score an
unknown surviving amount as **zero**, silently deleting a real contribution from the
model. Reading "unknown" as "all of it survives" is the pre-LOTS-1 behaviour and the
smaller failure.

⚠ **It IS invisible when it fires, and an earlier draft of this paragraph claimed the
opposite.** A lot-less row emits nothing: no log line, no Sentry breadcrumb, no counter,
no DTO field, and no badge difference — `sold` reads `false` and the original equals the
current, so it renders pixel-identical to an argument nobody has touched. Nothing in the
tree distinguishes *"this stake is fully intact"* from *"we have no idea and are assuming
it is"*. The fallback remains the right choice; the reason it is right is that reading
unknown as zero would silently delete a real argument's weight, **not** that the fallback
announces itself. That correction matters because it changes what a lot-less row IS after
RANK-1: with every other row now decaying, it is the one class that holds ranking weight
regardless of exit — permanently, silently, with no back-fill path (R8) and no detector.
Not participant-reachable under the shipped write path (the lot mints inside the same W-1
transaction as its bet), but reachable during an ADR-0024 migrate-before-serve promote or
a rollback to a pre-`0025` build. **The owed control is a DETECTOR, not a semantics
change** — the HALT condition `drizzle/migrations/0025_lots.sql` states in prose and
nothing implements.

**The other two rulers take the same substitution** (R4 as amended at RANK-1 — see the
Patch record):

- **The reply-lane ordering ruler** — `compareReply` in `src/lib/ranking.ts`, fed by
  `ReplySubstrate.stake` from **three** sites: `debate-view/reply-substrate.ts`,
  `profile/arguments.ts` and `bookmarks/list.ts`. ⚠ Note which one is NOT the
  aggregate trio: `reply-substrate.ts` builds no aggregate and appears on no earlier
  list, yet it is the loader that feeds the two-slot debate view — the surface the
  capture runs through — and it had no `lots` join at all. (`ranking-substrate.ts` is
  in the aggregate trio but builds only `PostSubstrate`, so it feeds ruler (ii),
  never a reply.)
- **The post-lane `tiebreak()` author-conviction input** — `PostSubstrate.authorStake`,
  read through each site's earliest-bet `JOIN LATERAL`. It decides `topOrder` whenever
  the lane margins tie (the ordinary case below the activity floors) and `profileOrder`
  outright.

⚠ **Expect the lane order to CHANGE for any market where an argument has been sold down.
That change is the fix, not a regression.** A shipped test asserting a specific ordering
that goes red is updated to the new expected order with the reason recorded in the test;
it is never "fixed" by restoring the old order.

**This makes attracted value mutable where it was frozen.** That is the intended
semantics: the aggregate now measures *conviction currently held*, not *conviction once
expressed*. The historical figure is not lost — `bets.stake` is Bucket-A immutable and
still readable — it simply stops being what the aggregate reports.

### D-6 · Settlement attribution (R7)

At resolution, each surviving lot receives `payout × (lot.surviving_shares /
positions.quantity)`. By R2 the denominators sum to one, so **Σ per-lot attribution ==
the position-level total** R-9.8 already computes, which is preserved unchanged and
remains the figure `payout_events` records. Per-lot attribution is **display
attribution**: it is derived from rows that already exist and adds no `payout_events`
row, so **INV-4 is untouched by construction**.

### D-7 · The marker vocabulary (R6, R10)

| Marker | Predicate | Scope | Status |
|---|---|---|---|
| **Sold** | `lots.surviving_shares == 0` (⇒ `surviving_basis == 0`) | per-**argument** | NEW |
| **Exited** | `positions.quantity == 0` | per-**position** | unchanged |
| **Flipped** | held side differs from the argument's frozen side | per-**position** | unchanged |

They are orthogonal and compose: an argument can be `Sold` while its position is still
held (the participant released *that argument* and kept others), and a position can be
`Exited` with no argument marked `Sold` only if it never had a lot — which R2 forbids.
A **partially**-sold lot renders its reduced figure and **no tag** (R6): a reduced number
is the signal, and a tag would overstate it.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The `lots` table declaration | `src/db/schema/lots.ts` |
| Lot pure math (mint / reduce / sell-from / sum) | `src/server/lots/compute.ts` |
| Lot persistence inside the W-1 tx | `src/server/lots/persist.ts` |
| The R2 invariant test | `tests/invariants/I-LOT-SUM-001.lot-shares-sum-to-position.spec.ts` |
| Đa as Σ surviving lot basis | `src/server/lots/basis.ts` |
| SideEpisode segmentation + `openingTradeId` (no longer basis) | `src/server/profile/episodes.ts` |

### Invariant impact

| Invariant | Impact | Why |
|---|---|---|
| **INV-1** — bet ↔ comment atomicity | **none, and reinforced** | The lot INSERT joins the same W-1 SERIALIZABLE transaction; if any write throws, the lot rolls back with the bet and comment. `bets.comment_id` NOT NULL is untouched. A lot cannot exist without a bet (FK + UNIQUE), and a bet cannot exist without a comment — so **a lot cannot exist without an argument**, which is R1 stated in storage. |
| **INV-2** — Dharma non-transferable, no overdraft | **none** | No lot column holds Dharma-as-balance. `dharma_ledger` is untouched; `CHECK (balance_after >= 0)` is untouched; no transfer surface is created. `surviving_basis` is a *cost record*, never a spendable balance, and no code path reads it as one. |
| **INV-3** — comments side-bound at post time | **none, and reinforced** | Selling a lot writes only `lots` (and `positions`/`dharma_ledger`/`events`/`pools` as today). `comments.side_at_post_time` is not read or written by any lot path. R9 restates this: selling never alters a comment; re-entry mints a new comment via a new bet. |
| **INV-4** — resolutions append-only | **none** | D-6 attribution is derived at read time from existing rows. No `resolution_events` or `payout_events` row is added, updated or deleted. |
| **NEW (invariant-class, not INV-1…4)** — **Σ surviving lot shares == `positions.quantity`**, per `(user, market, side)` | **minted** | The decomposition is exhaustive or it is a lie. Application-level: every write path that touches `positions` touches lots in the same transaction with the same delta. Storage-level backstop: the per-lot CHECKs bound each summand, plus `lots_no_delete` (migration 0026), which closes the one direction the CHECKs are blind to — a summand that is no longer there. **Corrected at PHASE-0:** this cell previously said the R2 equality is asserted by `I-LOT-SUM-001` "over the live DB". It is not. That spec seeds its own rows into a local ephemeral Postgres and truncates after; it proves the RULE and observes NOTHING, and can no more see staging or production than any other unit of the suite. The same false backstop claim sat in `src/server/lots/persist.ts` and is corrected there in the same commit (O-5: an amendment is applied at every site stating the superseded position). **What is genuinely owed is a live-environment check** — the staging gates are where it belongs, beside conservation and durable-receipt integrity — reading Σ `lots.surviving_shares` against `positions.quantity` per `(user, market, side)` on a real database and failing RED on a difference. Until it exists, drift in a live environment is undetected, and the D1 nightly position-drift cron is the nearest existing seam, not a substitute. |
| `positions_one_held_side_idx` | **unchanged** | Lots carry `side` but constrain nothing about it; the single-held-side guard remains the only authority. |

### Migration shape

**One migration, `0025_lots`** (head verified `0024_bookmarks` by reading
`drizzle/migrations/meta/_journal.json` on `origin/main` — never from memory, O-2).

Forward: `CREATE TABLE lots (…)` with the **seven** CHECKs inline, then the three
FKs and the five indexes (of which `lots_bet_id_uq` is the UNIQUE that carries R1
— it is an index, not a CHECK; the constraint table above lists eight rows because
it lists that UNIQUE alongside the seven CHECKs).
It is **purely additive** — no `ALTER` on any live table, no column drop, no data
movement — so it satisfies the ADR-0024 expand/contract rule trivially and is safe under
migrate-before-serve: old code ignores a table it does not know about.

**No back-fill (R8), stated as a property of the migration and not only as a
convention.** The migration creates an empty table and inserts nothing. This is correct
because it is *checkable*: a back-fill would need a source of per-argument attribution
for positions built before lots existed, and none exists — the information was never
recorded. Verified: the live window opens 2026-09-15, production has never served
participants (its alias serves a 2026-07-02 build), and staging is wiped as part of this
task. **A `bets` row whose `created_at` is at or after the moment this migration applied
in that environment — readable per-database from `drizzle.__drizzle_migrations.created_at`
for `folderMillis` 1787261127286 — and which has no matching `lots` row, is a halt
condition, never a back-fill trigger.** Bets older than that instant are expected to have
no lot, and always will.

> ⚠ **Corrected at MERGE-1, and the scope is the whole point of it.** This paragraph said
> *"if any environment is later found to hold `bets` rows with no matching `lots` row"*,
> unscoped — which is satisfied by **every pre-existing bet the instant the migration
> applies**, because R8 is precisely the decision not to give those rows a lot.
> **Staging tripped it on contact.** A halt that fires on the state the migration was
> designed to create is not a halt; it is noise that teaches the operator to ignore the
> alarm, on the one environment anybody was watching. `0025_lots.sql:26-42` already
> carries the scoped form, and `docs/specs/SPEC.2.md` §5.1 row 26 already carries it too —
> this ADR was the site left stating the superseded version, and it is the one a reader
> reaches first.

**Down path.** `DROP TABLE IF EXISTS lots;` — sufficient and complete, because the
migration is additive and touches nothing else. It is recorded as a commented `-- DOWN`
block inside the migration file rather than as an applied artifact, matching the repo's
forward-only, append-only migration discipline (AGENTS.md §6: never edit a committed
migration; write a new one). Reversal in practice is a new forward migration, and the
block exists so its author does not have to re-derive the statement.

**No new Bucket-A guard.** `lots` is Bucket C, so it takes no `0003`/`0021` append-only
or TRUNCATE trigger, and `tests/db/_fixtures/truncate.ts`'s `TRUNCATE_GUARDS` list is
**not** extended. A `TRUNCATE bets CASCADE` in a teardown reaches `lots` through the FK
and succeeds, which is the intended behaviour.

**A second migration, `0026_lots_no_delete`** (PHASE-0), carrying the R9 permanence
guard argued for in D-1: one function and one row-level `BEFORE DELETE` reject on
`lots`. Purely additive, so it satisfies ADR-0024's expand/contract rule trivially, and
no code path in the repo deletes a lot, so nothing predating it is affected.

Two properties of that guard are load-bearing and are ruled here rather than left to a
source comment:

- **The trigger is named `lots_no_delete`, NOT `bucket_%`.** The staging reset's G-4
  catalogue selects `WHERE tgname LIKE 'bucket_%'` and pins the row count
  (`EXPECTED_GUARD_CATALOG_ROWS`). A `bucket_`-prefixed name would enrol this guard in
  the §6 append-only contract and assert a bucket family covering exactly one table,
  while `lots` is Bucket C and its rows legitimately change. The count therefore stays
  where it is — **verified against the live catalogue, not assumed**. The cost is that
  a guard outside the catalogue is one G-4 does not check remains enabled;
  `tests/unit/staging/guard-list-parity.test.ts` takes that job instead and pins the
  non-catalogue set to exactly this one trigger.
- **It is row-level only, so TRUNCATE is unaffected.** Postgres fires no row-level
  trigger on TRUNCATE, so `TRUNCATE bets CASCADE` still empties `lots` and the teardown
  and staging-reset paths are untouched. Asserted through the real `truncateTables()`
  helper in `tests/db/triggers/lots-no-delete.spec.ts`, because the claim is about the
  path the operator actually takes and not one that resembles it.

**`TRUNCATE_SET` — ruled here, having previously lived only in a source comment.**
`lots` **is** named in `tests/staging/_lib/guards.ts`'s `TRUNCATE_SET` (the staging
reset's own table list), which is a *different* list from the
`tests/db/_fixtures/truncate.ts` `TRUNCATE_GUARDS` this section rules on above. The
paragraph above said what `lots` is NOT in and was silent on what it IS in, which left
the decision recorded nowhere but in the comment on the line that made it — the shape
`O-5` rules against, and the shape that makes a reader unable to tell a decision from
an oversight. The ruling: **`lots` belongs in `TRUNCATE_SET`.** It could not go
anywhere else — `NOT_TRUNCATED_UNRATIFIED` is documented and tested as holding only
tables with no outbound FK, which survive structurally rather than by omission, and
`lots` has three; `bets` is already in the set, so `TRUNCATE … CASCADE` empties `lots`
whether it is named or not. Naming it makes the reset explicit instead of incidental.
This is **not** a widening of the STAGING-PARITY Q3 ratified set: that warning concerns
moving an EXISTING table out of the unratified list, and `lots` postdates Q3 entirely,
so the ratified set cannot have ruled on it either way.

### The schedule cost — stated, not resolved

Building this to the standard the four critical paths require is **17–22
founder-serial sessions**. The ruling body is settled; the cost is not, and this ADR
does not pretend otherwise. It is recorded here because a decision whose cost is
discovered slice-by-slice is a decision made twice.

The shape of the estimate: schema + migration (1–2) · lot pure core with property tests
(2) · Đa re-basing across both readers (2) · per-lot + atomic multi-lot sell, on the
`src/server/bets/` critical path with the full ritual (3–4) · read models and DTOs (2)
· UI across debate, profile, discovery and bookmarks (3–4) · ranking and
attracted-value decay across three substrate sites (2–3) · settlement attribution (2)
· staging rebuild, spec riders and close-out (1–2). Every slice touching
`src/server/{bets,dharma,positions}/` or `src/db/schema/` carries writer/reviewer
(§5.6), the invariant gate (§5.7), a same-commit ADR/spec rider (§5.12), the pre-PR
self-audit (§5.10) and the subagent cascade (§5.11).

**Whether the experiment's 2026-09-15 live date can absorb that is the founder's call
and is deliberately left open here.**

### Spec riders owed (web-owned; named, not authored)

Three amendments are owed. Two are **not** written by this ADR, because their text is
founder-owned; the third was discharged at PHASE-0 and is marked so.

1. **SPEC.1 §23 — the Đa paragraph.** It currently defines Đa as episode-scoped and
   pro-rata-reduced. D-4 redefines it as Σ surviving lot basis, and D-4's worked example
   shows the two are not the same function. The §2 *SideEpisode* entry stays correct;
   only its role changes (segmentation and opener, no longer basis). **STILL OWED.**
2. **SPEC.1 §7 — F-BET-3's shape.** Added at PHASE-0; it was missing from this list and
   should not have been. This slice **widens F-BET-3's reachable error set** with a
   fifth code, `404 lot_not_found` — the first 404 on that flow, and a new terminal
   state a client must handle — and it adds an optional `lotId` to the request body,
   so the flow now has two shapes (the position-level sell it always was, and a per-lot
   sell) behind one endpoint. A reachable error set is a client contract, not an
   implementation detail: a flow's spec entry is where an integrator learns what can
   come back. **STILL OWED** — founder-authored, like §23.
   *Two related changes are deliberately NOT part of this rider, because they mint no
   new code:* `LotOversellError` maps onto the existing `400 insufficient_shares` and
   `LotInputError` onto the existing `400 error_invalid_request_body` (PHASE-0). Both
   previously fell through to an uncached `500 error_internal`, which is a defect fix
   within the catalogue rather than a widening of it — reusing codes that already mean
   these things is what keeps this rider to the one change that is genuinely new.
3. **SPEC.2 §22.1 — the ADR index**, plus the §0 count and ceiling annotation, which
   SYNC-4 rebuilt normatively on 2026-08-20 and which this ADR moves by one.
   **DISCHARGED at PHASE-0** (SPEC.2 1.0.24), together with the §5 inventory, §5.2/§5.3
   counts, §19.3 dataset row and Appendix A/B riders that were owed with it.

Recorded here per CLAUDE.md §5.12 and O-9: editing prose that cites a governing section
is a same-commit-rider trigger, and the honest discharge of a rider you may not author
is to name it precisely.

## Consequences

### Positive

- **A holding becomes readable.** Đ 680 stops being a number and becomes *Đ 40 + Đ 50 +
  Đ 500 + Đ 90*, each attached to the argument that produced it — on the surface SPEC.1
  §23 already claims is the complete record.
- **A participant can withdraw from one argument.** The unit of belief and the unit of
  exit finally match; ADR-0017 made the reply a bet, and this makes the bet separately
  releasable.
- **The reconciliation gap closes by construction, permanently.** After a partial sell
  the rendered figures still sum to Đa, because they are now *the summands of Đa* rather
  than immutable historical stakes that used to resemble them.
- **Attracted value starts telling the truth over time** (R5). Support that has been
  sold out of stops counting as support.
- **The invariant is testable rather than aspirational.** Σ lot shares == quantity is one
  indexed aggregate, asserted against the live database.
- **`positions` keeps every guarantee it has** — the ADR adds beneath it and removes
  nothing.

### Negative

- **Four critical paths, 17–22 founder-serial sessions, against a 2026-09-15 live date.**
  *Stated, not mitigated — see the schedule-cost section. This is the decision's real
  price and it is the founder's to accept or defer.*
- **Đa's definition changes, and the change is observable.** A per-lot sell produces a
  different Đa than the episode walk would have. *Mitigated by:* D-4's worked example
  and a same-commit SPEC.1 §23 rider, so no reader meets the new number holding the old
  definition.
- **Attracted value becomes mutable.** A post's Support total can fall without its author
  doing anything. *Acceptable because:* that is precisely R5, and the frozen figure
  remains recoverable from Bucket-A `bets.stake` for the dataset.
- **A second mutable row now tracks a holding.** Two rows can drift where one could not.
  *Mitigated by:* both writes living in the same W-1 SERIALIZABLE transaction behind the
  same pool-row lock, the R2 invariant test, and the per-lot CHECKs bounding each summand.
- **Three ranking substrates gain a join.** `lots ON lots.bet_id = rb.id` on the debate,
  profile and bookmarks read paths. *Mitigated by:* `lots_bet_id_uq` making it an index
  lookup, and PERF-1's measured headroom (Discovery p50 0.692 s after the `bom1` fix).
- **"Lot" is a word the product must never say** (R1). Every DTO field, badge and empty
  state has to reach for argument-language instead. *Mitigated by:* R1 being stated in
  the ruling, so it is a review checklist line rather than a taste question.

### Neutral

- `bets` remains Bucket-A append-only and every historical stake stays exactly where it
  is. Lots record what *survives*; bets record what *happened*. Both are kept.
- The public 2026-11-06 dataset gains a decomposition it did not have. Whether lots are
  released alongside bets is a SPEC.1 G3 question, not this ADR's.

## Pros and Cons of the Options

### Option 1 — per-argument lots (chosen)

**Pros**

- The unit of accounting equals the unit of meaning: one argument, one lot, one basis.
- Exhaustive by an invariant that can be tested, not by convention.
- Sold is exact and permanent, because a full-lot sale zeroes by law rather than by
  division.
- Leaves `positions` and all four hard invariants untouched.
- Makes R4/R5 expressible at all — surviving basis is a column to sum, where a
  pro-rata share would have been a derivation with no home.

**Cons**

- The largest schema addition since `bookmarks`, on four critical paths.
- Redefines a spec-level quantity (Đa) rather than adding beside it.
- Two mutable rows per holding instead of one.

### Option 2 — per-post sell (replies folded into their parent post)

**Pros**

- Fewer sell affordances; the post is already the debate's visual unit.
- Smaller decomposition — one lot per post rather than per argument.

**Cons**

- **Sends a false signal, which is the disqualifying objection.** Selling a post would
  silently sell the replies made under it, so a participant releasing one claim would
  release arguments they still hold — and the surface would report their remaining
  conviction as lower than it is.
- Contradicts ADR-0017 head-on: a reply *is* a bet, and folding it into its parent
  un-does the identity the whole debate model rests on.
- A reply's parent may be someone else's post, so "sell the post" is not even
  well-defined for the replier.

**Verdict:** Rejected. It makes the exit control lie about what was exited.

### Option 3 — pro-rata display only (no per-lot sell)

**Pros**

- No schema change at all; the numbers are derivable from what exists today.
- Position-level sell semantics stay exactly as shipped.

**Cons**

- **Rejected by the operator as illegible.** Every argument's figure moves whenever
  *any* sell happens, including sells that had nothing to do with it — so a participant
  watching one argument sees it change for reasons they cannot see or cause.
- It renders an attribution while withholding the control that would make the
  attribution actionable: you can see your Đ 500 argument, and you still cannot exit it.
- Does not close R4/R5: pro-rata shares are recomputed per read, so nothing decays in a
  way another user's ranking could key off.

**Verdict:** Rejected. It answers *how much* more precisely without ever answering
*from what you can now act on*.

### Option 4 — retraction marker, no monetary effect

**Pros**

- Cheapest by an order of magnitude; a boolean and a badge.
- Touches no invariant, no money path, no migration beyond one column.

**Cons**

- Costless. A marker that moves no stake is a claim anyone can make about any argument
  at any time, which is exactly the kind of unbacked assertion the mandatory-commentary
  rule exists to prevent.
- Leaves the measured defect entirely in place — the basis is still un-decomposed and
  the badges still cannot be reconciled to it.

**Verdict:** Deferred rather than rejected. It is a genuinely useful *addition* once
lots exist (a way to say "I was wrong" while still holding), and it is recorded here so
that value is not lost. It is not a substitute for this ADR.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §5 INV-1 | bet ↔ comment atomicity | **Consumes** — the lot INSERT joins the existing W-1 SERIALIZABLE transaction; lot ⊂ bet ⊂ comment by FK, so a lot without an argument is unrepresentable |
| SPEC.1 §5 INV-2 | Dharma non-transferable, no overdraft | **Consumes** — `surviving_basis` is a cost record, never a balance; no ledger column and no transfer surface is added |
| SPEC.1 §5 INV-3 | comments side-bound at post time | **Consumes** — no lot path reads or writes `comments.side_at_post_time`; R9 restates it |
| SPEC.1 §5 INV-4 | resolutions append-only | **Consumes** — D-6 attribution is read-time derivation; no `payout_events` row is added or altered |
| — | **Σ surviving lot shares == `positions.quantity`** per `(user, market, side)` | **Mints** — invariant-class spec rule; test `I-LOT-SUM-001`; storage backstop = the per-lot bounding CHECKs |
| SPEC.1 §23 | the Đa staked basis | **Shapes** — Đa is redefined as Σ surviving lot basis (D-4); a same-commit §23 rider is owed and is founder-authored |
| SPEC.1 §2 | *SideEpisode* | **Shapes** — retained for the graph gap law and `openingTradeId`; removed from the basis path |
| SPEC.1 §23 | FI-2 basis identity (Đb) | **Consumes** — unchanged; this ADR touches Đa only, and the four `computeSell` sites are explicitly out of frame |
| ADR-0013 | W-1 SERIALIZABLE bet transaction | **Consumes** — mint and every sell run inside it, behind the same pool-row `FOR NO KEY UPDATE` |
| ADR-0017 | reply-as-bet, `REPLY_DEPTH_MAX = 1` | **Consumes** — R1's 1:1 is only coherent because a reply already *is* a bet |
| ADR-0018 | issuance + two bet floors | **Consumes** — floors apply per bet, therefore per lot, unchanged |
| ADR-0024 | expand/contract, migrate-before-serve | **Consumes** — `0025_lots` is purely additive; old code ignores an unknown table |
| ADR-0031 | durable `bet_receipts` | **Consumes** — receipt shape unchanged; the per-lot sell rides the existing idempotency key |
| ADR-0005 | event sourcing, Bucket taxonomy | **Consumes** — Bucket C, on the `positions` precedent, for the same reason |
| SPEC.2 §22.1 | ADR index | **Shapes** — a same-commit index row is owed (founder-authored) |
| Tracker | LOTS-1 and its successor slices | All depend on this ADR being `accepted` |

## More Information

- `~/Downloads/zz_POSCHK-1_recon_2026-08-20T1811.md` — the Đa = 680 ground truth; the
  four-bet decomposition; the three Bucket-A triggers on `bets` measured live.
- `~/Downloads/zz_POSCHK-1_addendum_2026-08-20T1811.md` — the eight-query basis
  predicate; the single `positions` write site; `support_dharma`/`counter_dharma`
  proved read-time-only across 14 files.
- `~/Downloads/zz_RECON-1_surface-audit_2026-08-20T1905.md` — the R-01…R-16 surface
  inventory; the 12-of-39 sizing; the `math-erdos` counter-example proving the marker
  does not discriminate.
- CLAUDE.md §2 (the four hard-locked invariants) · §5.12 (same-commit ADR) · §8 O-9
  (editing prose that cites a governing section is a rider trigger).

---

*ADR-0039 ratifies per-argument lot accounting: a `lots` row 1:1 with every bet,
carrying surviving shares and surviving basis, summing to `positions.quantity` by a
newly-minted invariant, sellable individually, permanent once Sold, and never
back-filled. The ruling body R1–R10 is founder-authored and reproduced verbatim; the
decision body and any constraints minted in §Decision Outcome are immutable, and
superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0
versioning policy.*
