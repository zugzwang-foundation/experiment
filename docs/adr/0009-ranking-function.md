# ADR-0009 — Ranking Function Lock (`RANKING.md`)

| | |
|---|---|
| **Status** | superseded |
| **Date** | 2026-05-06 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.10 |
| **Frame document** | SPEC.2 §1.4 #3 (delegation: ranking math owned here, not duplicated in SPEC.2), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | ADR-0017 |

---

## Context and Problem Statement

The Zugzwang debate view orders comments under each market by a ranking function. Per SPEC.1 §9, this function must be open-source, deterministic, universal, and auditable from the public dataset. The product surface (debate view, two-column YES/NO render, friendly-fire counts, three-state In/Flipped/Exited marker) is locked; the function that drives ordering is not.

The function shapes which arguments readers see, which they engage with, and ultimately which arguments shift the price. Per the Zugzwang thesis (K × n > C — knowledge × informed participants exceeds manipulative capital), the ranking is part of the propagation mechanism for the K-side of the inequality. A function that surfaces high-K arguments grows the informed-and-staking population over the lifetime of a market; a function that surfaces volume or capital fails the thesis.

The forces at play:

- **Open-source publishing constraint.** RANKING.md is AGPL-3.0 and public. Anyone can read it; anyone can optimise against it. Most production ranking systems (Reddit, HN, Twitter) defend partly via secrecy. Zugzwang explicitly does not. The function must be **gaming-resistant by construction** — every input it uses must satisfy the property that optimising for the input coincides with optimising for K × n.
- **45-day experiment window.** The function ships at launch (2026-09-15) and runs through conclusion (2026-11-08). Reputation signals that take months or years to develop are dead weight in this window.
- **ADR-0005 §4 read-time-computed classification.** Ranking is read-time-computed (no projection table, no materialised view). The function reads from `comments` + `friendly_fire_events` per page render. Any input the function uses must be available on those tables (frozen at write or read-time-aggregable).
- **Performance budget.** Debate view is a hot path. The function runs once per top-level comment per render, on top of N comments and their replies. SQL aggregation cost dominates; per-comment compute must be O(1) and IO-free.
- **Frozen-at-resolution requirement.** Per SPEC.1 §11 + INV-4, resolved markets are immutable historical artifacts. Ranking must freeze with the market — auditors must be able to reproduce the rendered order at any past resolution moment.
- **Number-tuning deferral rule.** Project standing rule: specific weight values lock at the number-tuning pass (target 2026-09-01) against dogfooded markets, not at design time. This ADR locks shape and design-intent ordering only.

This ADR resolves the function shape, input set, weight ordering, reply-rendering rule, and behavioural properties for v1. Specific weight values are deferred per the number-tuning rule.

This ADR does **not** decide:

- Specific weight values for `w_stake`, `w_ff`, `w_reply_opp`, `w_reply_same`, `gravity` — pinned by the number-tuning pass (target 2026-09-01) against dogfooded markets, then locked in `RANKING.md` §7 before public launch.
- The gravity exponent's exact value (HN uses 1.8 in production; verify empirically) — number-tuning pass.
- The schema choice for `friendly_fire_events.cleared_at` (column flip on existing row vs separate compensating row vs row delete) — SCAFFOLD.2 per F-COMMENT-7 ("schema decides"). This ADR consumes whichever shape SCAFFOLD.2 picks via the named filter `frozen_at IS NULL AND cleared_at IS NULL`.
- Hot-path query optimisation (whether the per-render aggregation uses Drizzle query builder or `sql<T>\`...\`` template) — SCAFFOLD.2 / DEBATE.4 / DEBATE.8 per ADR-0008.
- The cache profile at the rendered-page layer (e.g., `unstable_cache` TTL on the debate view) — ADR-0007 + DEBATE.4.
- The debate-view UI rendering (visual treatment of two-slot reply rule, drop-down expansion affordance, mobile layout) — ADR-0012 (`design.md`, SPEC.13) + DEBATE.4 + DEBATE.8.
- Friendly-fire vote eligibility rules (cross-aisle up vs same-side down, self-vote rejection, one-vote-per-pair) — SPEC.1 §8 F-COMMENT-6 (locked) + DEBATE.6.
- Author Dharma at post time as a future input — reintroducible at testnet phase via new ADR when track records compound over months/years; explicitly out of v1 scope.

## Decision Drivers

1. **Open-source resistance.** Every input must satisfy the property that optimising the public formula for that input coincides with optimising for K × n. Inputs that can be cheaply gamed (passive engagement metrics, anonymous votes) fail this test and must not appear.
2. **Thesis alignment.** The function must surface high-K arguments — those that genuinely advance knowledge — over volume-only or capital-only signals. Direct counter-arguments and cross-aisle agreement are the strongest K-signals available on the comment surface; volume signals are secondary.
3. **45-day-window constraint.** Inputs whose signal-to-noise ratio is structurally low in 45 days are dead weight. Author Dharma at post time falls into this category (log-scaled spread ≈ 0.7 across the population in this window).
4. **ADR-0005 §4 consistency.** The function reads only from `comments` + `friendly_fire_events`. New inputs that require reads from other tables (`users`, `dharma_ledger`) at rank-time would force an ADR-0005 amendment. Inputs that fit are: column reads on `comments` (frozen at write), aggregations on `friendly_fire_events` (filtered), self-joins on `comments` (for reply counts).
5. **Performance budget.** Per-render cost must stay under ~50ms for N=50 top-level comments and under ~100ms for N=500 hot-market peak. SQL aggregation dominates; per-comment compute must be a handful of float ops with no IO.
6. **Frozen-at-resolution.** Function takes a `now` parameter. For resolved markets, `now` = resolution timestamp. INV-4 (resolutions append-only) ensures the timestamp is immutable; the ranking inherits the same immutability.
7. **Auditability.** Every input must be reconstructible from the public dataset released at conclusion (per SPEC.1 §12.2). Third parties must be able to rerun the function over historical inputs and reproduce the rendered order.
8. **Single deterministic order.** No personalisation, no per-reader feature vectors, no A/B variants in production. One rendered order per market per moment, same for every reader.

## Considered Options

1. **HN-style time-decay over log-scaled additive numerator with side-split reply counts** ← chosen
2. Wilson score interval on friendly-fire alone (Reddit "best" pattern)
3. Multiplicative numerator (`stake × dharma × friendly_fire × ...`)
4. Exponential time-decay over weighted sum (`score × 0.5^(age/half_life)`)
5. Time-bucketed scoring (Reddit "hot" pre-Wilson pattern)
6. Reddit-style sort filters (Top / Controversial / Latest as user-toggle tabs)
7. Subtree reply count (full reply-tree count rather than direct-only)
8. Author Dharma at post time as a v1 input
9. Total reply count (no side split) rather than `opposite_side_reply_count` + `same_side_reply_count`

## Decision Outcome

**Chosen: Option 1 — HN-style time-decay over log-scaled additive numerator with side-split reply counts.**

### Function shape

```
friendly_fire_net = friendly_fire_up - friendly_fire_down

numerator =
    w_stake     * log10(1 + stake_at_post_time)
  + w_ff        * friendly_fire_net
  + w_reply_opp * log10(1 + opposite_side_reply_count)
  + w_reply_same * log10(1 + same_side_reply_count)

score = numerator / (comment_age_hours + 2)^gravity
```

### Inputs (five scoring + one time reference)

| Input | Source | Filter |
|---|---|---|
| `stake_at_post_time` | `comments.stake_at_post_time` (frozen on row, NUMERIC(38, 18)) | none |
| `friendly_fire_up` | `friendly_fire_events` aggregated count | `comment_id = self.id AND direction = 'up' AND frozen_at IS NULL AND cleared_at IS NULL` |
| `friendly_fire_down` | `friendly_fire_events` aggregated count | `comment_id = self.id AND direction = 'down' AND frozen_at IS NULL AND cleared_at IS NULL` |
| `opposite_side_reply_count` | `comments` self-join | `parent_comment_id = self.id AND side_at_post_time != self.side_at_post_time` |
| `same_side_reply_count` | `comments` self-join | `parent_comment_id = self.id AND side_at_post_time = self.side_at_post_time` |
| `now` | function parameter | for resolved markets, set to `resolution_events.timestamp`; otherwise current request time |

### New column on `comments`

`stake_at_post_time NUMERIC(38, 18) NOT NULL` is added to the `comments` table. Computed inside the comment-writing transaction (F-BET-1 entry, F-COMMENT-1 direct, F-COMMENT-2 reply) as the Dharma-valued size of the author's position on the comment's side at the moment of post. For entry comments this equals the entry stake; for subsequent comments this equals position size × current price on the comment's side at write-time. The column is INSERT-only and inherits the existing Bucket A append-only trigger on `comments` per ADR-0005 §3 — no new trigger required.

### Tunable parameters and design-intent ordering

Five tunable parameters: `w_stake`, `w_ff`, `w_reply_opp`, `w_reply_same`, `gravity`. Specific values pin via the number-tuning pass (target 2026-09-01) against dogfooded markets, then lock in `RANKING.md` §7 before public launch.

Design-intent ordering ratified by this ADR (specific numbers in tuning pass):

```
w_reply_opp > w_ff > w_reply_same > w_stake
```

Rationale: counter-replies are the most costly cross-aisle action a participant can take (they require both holding a position and writing substantive content) and are therefore the strongest K-signal available. Friendly-fire votes are the secondary cross-aisle signal (cross-aisle ups + same-side downs are both costly, but cheaper than counter-replies). Same-side reply count is the sociability signal. Stake is the floor — rewards committing Dharma without dominating.

### Reply rendering rule

Replies are scored by the same function as top-level comments. Rendered via **two-slot rule**: under each parent comment, surface the highest-scoring opposite-side reply and the highest-scoring same-side reply by default. A "show all replies" affordance expands the full reply set, ordered by ranking-function score descending.

Edge cases (per `RANKING.md` §5.2):

- No opposite-side reply: render two best same-side.
- No same-side reply: render two best opposite-side.
- Single reply: render without expansion affordance.
- Zero replies: no reply widget rendered.

### Flat reply rule

`REPLY_DEPTH_MAX = 1` is pinned by this ADR. Replies cannot themselves be replied to. Pinned (not deferred to number-tuning pass) because the choice is structural — flat replies cap the reply-bombing attack surface to one layer.

### Tie-break

`comment_id` ascending. Per ADR-0016, comment IDs are UUIDv7 and sort by natural creation time. Ties break in favour of the earlier comment, deterministically.

### Frozen-at-resolution

Function takes a `now` parameter. For markets in `Open`, `Closed`, or `Resolving` state, `now` is the request timestamp. For markets in `Resolved` or `Voided` state, `now` is fixed to the resolution timestamp from `resolution_events`. Once a market resolves, the rendered order at resolution becomes permanent.

### Read-time-computed (no projection table)

Per ADR-0005 §4, ranking is read-time-computed. No `ranking_snapshots` table, no per-poll history, no materialised view of scored comments. The function runs against current-state tables on every debate-view render. Researchers reconstruct historical rankings from the public dataset by replaying the function over historical inputs.

### Required indexes

Two indexes flagged for SCAFFOLD.2:

- `friendly_fire_events(comment_id, direction, frozen_at, cleared_at)` — covers the up/down aggregation per top-level comment.
- `comments(parent_comment_id, side_at_post_time)` — covers the opposite-side / same-side reply-count aggregation per top-level comment.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Function specification (formula, inputs, behavioural properties, worked example, weights) | `experiment/docs/specs/RANKING.md` |
| Function implementation (pure TypeScript module, no IO) | `src/lib/ranking.ts` |
| Tunable parameter values (post-2026-09-01 number-tuning pass) | `RANKING.md` §7 — pinned values; `src/lib/ranking.config.ts` — runtime configuration source |
| Index DDL for `friendly_fire_events(comment_id, direction, frozen_at, cleared_at)` and `comments(parent_comment_id, side_at_post_time)` | `drizzle/migrations/<NNNN>_ranking_indexes.sql` (SCAFFOLD.2 deliverable) |

## Consequences

### Positive

- **Gaming-resistant by construction.** Every input requires committing Dharma to generate (stake-at-post-time, friendly-fire votes from current eligible voters, replies requiring an active position). Optimising the public formula coincides with optimising for K × n.
- **Battle-tested lineage.** HN-style power-law decay is in production since 2007 across millions of items/day; the multi-input numerator extension is a clean adaptation of the proven shape.
- **Auditable from public dataset.** Every input is a column in the dataset release or trivially derivable. Third parties can rerun and verify any historical ranking.
- **Cheap at rank-time.** One SQL aggregation + one pure TS pass per debate-view render. Sub-50ms for N=50 typical, sub-100ms for N=500 hot peak.
- **Deterministic and frozen at resolution.** Inherits INV-4's append-only resolution timestamp; resolved-market rankings are bit-exact reproducible forever.
- **Side-split reply counts reward genuine debate.** Counter-replies (the most costly cross-aisle action) carry the largest weight; same-side replies (sociability) carry a smaller weight. This is the tightest thesis-aligned shape we can implement on the comment surface.
- **No closed-source components.** RANKING.md is AGPL-3.0; the formula is the contract. No vendor algorithms, no secret weights, no opaque ML.

### Negative

- **Specific numbers deferred.** Until the number-tuning pass completes (target 2026-09-01), the function cannot be called — calling it without pinned weights is an error per RANKING.md §7. Mitigated by: the number-tuning pass is on the critical path before public launch, and the design-intent ordering locked in this ADR is sufficient to begin implementation against placeholder constants.
- **Reputation signal absent in v1.** Author Dharma at post time is excluded — a user who consistently wins early markets gets no ranking lift from track record alone. Mitigated by: stake-at-post-time captures the same correctness-derived advantage on a per-comment basis (a winning user has more Dharma to stake, so their per-comment stake naturally grows). Reintroducible at testnet phase via new ADR.
- **Subtree reply count unavailable.** Counting full reply subtrees would capture "this comment generated long debate" but is rejected for the reply-bombing attack surface. Mitigated by: direct-reply count plus friendly-fire on the replies themselves (replies are scored by the same function) captures sub-tree quality without weighting raw subtree size.
- **No filter tabs (Top / Controversial / Latest).** Single rendered order, no reader-toggleable variants. Some readers may prefer "newest first" or "controversial-first" views. Acceptable because: the platform's whole stance is "ranking is opinionated by design" — multiple sort tabs are an engagement-platform default, not a knowledge-platform default. Reintroducible post-launch if dogfooded markets show demand.
- **Default sort changes per render.** Time-decay means a comment can move down between renders just because hours pass. Acceptable because: this is a property of the function class (HN, Reddit hot, every time-decay ranker), not a bug. RANKING.md §4.3 states it explicitly so it's not surprising.
- **Index discipline required.** SCAFFOLD.2 must add the two indexes named in the file map. Mitigated by: indexes are flagged in this ADR's "Single-source-of-truth file map" subsection and in the SPEC.2 §0.1 change-log row absorbing this ADR.

### Neutral

- **Bucket A append-only discipline applies to the new column.** `comments.stake_at_post_time` is set on INSERT and never updated. The existing append-only trigger on `comments` per ADR-0005 §3 covers it for free; no new trigger required.
- **AGPL-3.0 license on RANKING.md.** Same license as the protocol per ADR-0001 — opening up the formula to third-party forks under the same license terms.
- **Cleared-row schema choice deferred to SCAFFOLD.2.** The function's `frozen_at IS NULL AND cleared_at IS NULL` filter discipline is named in this ADR; whether `cleared_at` is a column on the row, a separate compensating-row pattern, or a hard delete is SCAFFOLD.2 per F-COMMENT-7. ADR-0009 consumes whichever shape SCAFFOLD.2 picks.

## Pros and Cons of the Options

### Option 1 — HN-style time-decay over log-scaled additive numerator with side-split reply counts (chosen)

**Pros**

- Battle-tested shape (HN since 2007) with proven scaling characteristics.
- Two tunable knobs in the denominator (`+2` offset for recency boost, `gravity` exponent for decay rate) plus four tunable numerator weights.
- Linear-additive numerator: each input contributes independently; no multiplicative cascade effects.
- Log-scaling on Dharma-denominated and count inputs dampens whales without zeroing them.
- Friendly-fire net score (linear, not log-scaled) preserves the rare-but-high-signal property of cross-aisle votes.
- Side-split reply counts let the function reward genuine debate (counter-replies) more than echo-chamber sociability (same-side replies).
- Pure-function shape: no IO, no joins inside the function, sub-millisecond per-comment compute.

**Cons**

- Five tunable parameters (slightly more than HN's two) — more knobs to tune in the 2026-09-01 pass.
- Counter-reply count is filterable by a coordinated group of opponents (rare but possible). Mitigated: replies require an active position + Dharma, and friendly-fire on the replies themselves catches low-quality counter-replies.

### Option 2 — Wilson score interval on friendly-fire alone

**Pros**

- Rigorous statistical foundation (Wilson 95% confidence interval).
- Handles low-vote-count comments well (small samples don't get over-weighted).
- Battle-tested (Reddit "best" since 2009).

**Cons**

- Treats stake and reply count as second-class — function reads only friendly-fire ratio, ignoring the two strongest K-signals on the platform.
- No time decay built in (Reddit later replaced "best" with hybrid sorts for this reason).
- Fundamentally a binary up/down ranker; Zugzwang has more than one signal type.

**Verdict:** Rejected. Wrong shape for a multi-signal stake-attached platform.

### Option 3 — Multiplicative numerator (`stake × dharma × friendly_fire × ...`)

**Pros**

- Single zero kills the whole score — strong filter against undersigned content.
- Compact mathematical form.

**Cons**

- A new user (low Dharma) writing a 100-Dharma stake comment would rank near zero. Wrong incentive — penalises new users posting strong claims, which the thesis explicitly wants to enable.
- One small input value drowns large signals from other inputs. Tuning is much harder.
- Friendly-fire net score can be zero or negative — multiplying by zero collapses the comment regardless of other strong signals.

**Verdict:** Rejected. Penalises new users and degenerates on common input combinations.

### Option 4 — Exponential time-decay over weighted sum

**Pros**

- Smooth decay shape, well-understood mathematically (`half_life` is intuitive).
- Single tuning parameter for time decay.

**Cons**

- Only one knob (the half-life); HN-style power-law gives two knobs (offset + gravity), more tuning room.
- Aggressive on long-tail content — exponential decay kills slow-burn arguments faster than power-law.
- Less tested in this exact problem domain (comment ranking with new evidence arriving over the window).

**Verdict:** Rejected. Less tunable and less proven than HN-style power-law for this use case.

### Option 5 — Time-bucketed scoring (Reddit "hot" pre-Wilson)

**Pros**

- Simple to implement (score within 24h bucket, switch buckets on cron).

**Cons**

- Discontinuities at bucket boundaries — comments visibly jitter in ranking when the clock crosses a boundary.
- Reddit replaced this exact shape because of the discontinuity problem.
- Requires periodic recomputation (cron or background worker), adding operational surface.

**Verdict:** Rejected. Discontinuities cause user-visible jitter; replaced by HN-style decay in production-proven systems.

### Option 6 — Reddit-style sort filters (Top / Controversial / Latest)

**Pros**

- Reader-controllable views — each tab is its own opinionated function.
- "Latest" tab matches a natural reader behaviour ("what's being said right now").
- "Controversial" tab surfaces flame wars, which some readers value.

**Cons**

- Each tab is its own publishable formula in RANKING.md, its own test surface, its own audit boundary. Three formulas means triple the locked spec, triple the tuning, triple the edge cases before launch.
- "Controversial" doesn't translate cleanly to Zugzwang — friendly-fire is asymmetric by construction (cross-aisle up, same-side down), so "vote split" doesn't have a clean analog.
- Zugzwang's stance is "ranking is opinionated by design" — multiple sort tabs are an engagement-platform default, not a knowledge-platform default.
- Reader-controllable sort variants undermine the "single rendered order per moment" property that simplifies auditability.

**Verdict:** Rejected for v1. One ranking function, one rendered order. Reintroducible post-launch via new ADR if dogfooded markets show demand.

### Option 7 — Subtree reply count (full reply-tree count rather than direct-only)

**Pros**

- Captures "this comment generated long debate" more fully than direct-reply count.
- Single SQL aggregation rather than per-level join.

**Cons**

- Opens a reply-bombing attack: a coordinated group runs nested back-and-forth replies under a target comment, generating arbitrary subtree count without the comment author acting. Reddit's "controversial" sort got famously gamed this way.
- Each reply requires a position, but daily allowance funds small positions for free — coordination of 5–10 friends is trivial in 45 days.
- The signal "long debate happened here" is captured by direct-reply count + friendly-fire on the replies themselves (replies are scored by the same function), without the attack surface.

**Verdict:** Rejected. Direct-reply count, capped at depth 1 (flat replies), gives the meaningful signal without the attack vector.

### Option 8 — Author Dharma at post time as a v1 input

**Pros**

- Captures "track record" — users who have been right across many markets get ranking lift.
- Standard in mature reputation systems.

**Cons**

- 45-day experiment window is too short for Dharma balances to spread meaningfully across users. Top-decile vs median Dharma might be 2–3× in this window; log-scaled spread is ≈0.7. Signal is structurally weak.
- The same correctness-derived advantage shows up in stake-at-post-time on a per-comment basis (winning users have more Dharma to stake on each new comment), so the function isn't blind to track record — just doesn't read it from a separate input.
- Adding the input means another frozen column on `comments` and a corresponding number to tune — overhead without real signal in this window.

**Verdict:** Rejected for v1. Reintroducible at testnet phase via new ADR when track records compound over months/years.

### Option 9 — Total reply count (no side split)

**Pros**

- One input rather than two; one weight to tune rather than two.
- Simpler formula and simpler RANKING.md.

**Cons**

- Treats counter-replies (real debate, high-K) and same-side replies (sociability, lower-K) as the same signal. The strongest K-signal on the comment surface gets diluted by echo-chamber engagement.
- Misses an opportunity to weight `w_reply_opp > w_reply_same` as a structural property of the formula rather than a tuning artifact.
- The cost of side-splitting is one extra weight in the tuning pass and one extra filter clause in the SQL — negligible.

**Verdict:** Rejected. Side-split is the thesis-aligned shape; the simplicity cost of merging is not worth the K-signal dilution.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §9 | Ranking function open-source / deterministic / universal / auditable | Consumes: ratifies the four properties and locks the function shape that satisfies them. |
| SPEC.1 §9 (preamble) | Function inputs | Mints: five locked inputs (`stake_at_post_time` frozen on row, friendly-fire net score with frozen+cleared filter, opposite-side direct-reply count, same-side direct-reply count, comment age). SPEC.1 §9 amended same-commit (v1.1.0-draft → v1.2.0-draft) to match. |
| SPEC.1 §9 (replies) | Reply ordering | Mints: replies scored by same function, rendered via two-slot rule (best opposite-side + best same-side, expansion ranked by score). Replaces SPEC.1 v1.1.0-draft "chronological-ascending" rule. |
| SPEC.1 §11 + INV-4 | Resolution-time freeze | Consumes: function `now` parameter set to `resolution_events.timestamp` for resolved markets; INV-4 immutability inherited by ranking. |
| SPEC.1 §16.1 | `REPLY_DEPTH_MAX` | Mints: pinned to 1 (flat replies). Not deferred to number-tuning pass. |
| SPEC.1 §17 | Acceptance test catalogue | Mints: six new test rows (`debate-view::replies-two-slot-best-opposite-and-same`, `debate-view::replies-expansion-ranked-by-function`, `ranking::deterministic-and-universal`, `ranking::frozen-at-resolution`, `ranking::tie-break-by-comment-id`, `ranking::excludes-frozen-and-cleared-friendly-fire`). One row removed (`debate-view::replies-chronological-ascending`). |
| SPEC.1 §18 | Out-of-scope catalogue | Mints: three new entries (passive-engagement metrics with discriminating rule; author Dharma at post time; subtree reply count). One existing entry rewritten (engagement-metric → passive-engagement with the "must require Dharma to generate" test). |
| SPEC.2 §1.4 #3 | Ranking math delegation | Consumes: SPEC.2 names that the debate view orders by ranking function, defers math to RANKING.md. This ADR + RANKING.md fulfil that delegation. |
| SPEC.2 §5 (Data Model — Table Inventory) | `comments` table column shape | Mints: new column `comments.stake_at_post_time NUMERIC(38, 18) NOT NULL`. Bucket A append-only mutation discipline applies (set on INSERT, never updated). Substantive absorption deferred to SPEC.2 §5 drafting chat per the outline-level absorption pattern. |
| SPEC.2 §7 (Event Model) | Read-time-computed classification | Consumes: ADR-0005 §4's "Read-time-computed (no projection table): debate-view ranking" classification stands. This ADR confirms the classification by specifying inputs that fit the read-time-computed contract. |
| SPEC.2 §9 (Concurrency & Transactions) | Comment-writing transaction | Shapes: F-BET-1 / F-COMMENT-1 / F-COMMENT-2 transactions must compute and persist `stake_at_post_time` inside the transaction (Dharma-valued position size on the comment's side at write-time). Substantive absorption deferred to SPEC.2 §9 drafting chat. |
| SPEC.2 §23 (ADR Index) | ADR-0009 status | Consumes: SPEC.2 §23 entry flipped to `accepted (2026-05-06)` in same commit. |
| SPEC.2 Appendix A (Single-Source-of-Truth File Map) | Ranking module + spec | Mints: two file-map rows (`experiment/docs/specs/RANKING.md` for the spec; `src/lib/ranking.ts` for the implementation). Substantive absorption deferred to SPEC.2 Appendix A drafting chat. |
| ADR-0001 | License (AGPL-3.0-or-later) | Consumes: RANKING.md ships under AGPL-3.0-or-later, same as protocol. |
| ADR-0005 §3 | Bucket A append-only triggers on `comments` | Consumes: `comments.stake_at_post_time` is INSERT-only; existing trigger covers it for free, no new trigger required. |
| ADR-0005 §4 | Synchronous-vs-asynchronous read-model classification | Consumes: ranking is read-time-computed (no projection table); function reads from `comments` + `friendly_fire_events`. |
| ADR-0007 | Cache profile at rendered-page layer | Defers: rendered-page caching for the debate view is owned by ADR-0007 + DEBATE.4, not this ADR. |
| ADR-0008 | Drizzle ORM hot-path query patterns | Consumes: per-render aggregation may use `sql<T>\`...\`` template per ADR-0008 hot-path discipline; query-builder vs raw-SQL choice is SCAFFOLD.2 / DEBATE.4 / DEBATE.8 territory. |
| ADR-0016 | UUIDv7 IDs | Consumes: `comment_id` ascending tie-break works because UUIDv7 sorts naturally by creation time. |
| Tracker | SPEC.10 (this ADR), DEBATE.4 (debate view rendering), DEBATE.8 (RANKING.md integration + live computation), SCAFFOLD.2 (index DDL for `friendly_fire_events` + `comments`) | All depend on this ADR being `accepted`. |

## More Information

- `experiment/docs/specs/RANKING.md` — function specification (formula, inputs, behavioural properties, worked example, weights, performance characterization).
- SPEC.1 v1.2.0-draft §9 — product surface (debate view, ranking function preamble, replies two-slot rule, F-DEBATE-1/2/3/4).
- SPEC.1 v1.2.0-draft §16.1 — `REPLY_DEPTH_MAX` pinned to 1.
- SPEC.1 v1.2.0-draft §17 — acceptance-test catalogue with six new ranking tests.
- SPEC.1 v1.2.0-draft §18 — out-of-scope entries for passive-engagement, author Dharma, subtree reply count.
- SPEC.1 v1.2.0-draft §19 Q13 — closed by this ADR.
- SPEC.2 v0.1-outline §0.1 — change-log row absorbing this ADR.
- SPEC.2 v0.1-outline §23 — ADR Index entry for this ADR.
- ADR-0005 §3 — Bucket A append-only triggers on `comments`.
- ADR-0005 §4 — synchronous-vs-asynchronous read-model classification, naming ranking as read-time-computed.
- ADR-0008 — Drizzle ORM hot-path query patterns.
- ADR-0016 — UUIDv7 ID schema (tie-break dependency).
- Hacker News story-ranking formula — `(points − 1) / (age_hours + 2)^1.8` — published by Y Combinator, in production since 2007.
- Wilson score interval (Reddit "best") — Randall Munroe, "How Not To Sort By Average Rating", 2009.

---

*ADR-0009 ratifies the universal deterministic ranking function in `RANKING.md`. The function shape, input set, design-intent weight ordering, reply-rendering rule, and behavioural properties are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy. Specific weight values are deferred to the 2026-09-01 number-tuning pass and pin in `RANKING.md` §7 before public launch.*
