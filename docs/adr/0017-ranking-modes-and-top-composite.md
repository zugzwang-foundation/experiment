# ADR-0017 — Ranking Modes & the "Top" Composite (`RANKING.md`)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-31 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SYNC.4 (successor ranking ADR) |
| **Frame document** | SPEC.2 §1.4 #3 (delegation: ranking math owned here, not duplicated in SPEC.2), §23 (ADR Index) |
| **Supersedes** | ADR-0009 (Ranking Function Lock) |
| **Superseded-by** | — |

---

## Patch record

### P1 — Friendly-fire removed entirely; ADR-Index pointer (PRECURSOR.4 lock review, 2026-06-03)

In-place Patch record per CLAUDE.md §5.12 (consumer-surface scoping, **not** supersession).
**The load-bearing decision is unchanged** — the multi-lane "Top" composite, the single-axis
filter modes, reply-ranking by stake-descending-within-side, shared time-decay, author-stake as
seed-and-tiebreaker, read-time computation (no projection table), and the v1 ship set all stand;
Option 7 (free up/down votes on replies as a ranking signal) remains rejected. This patch scopes
*description* to the reply-as-bet model that SPEC.1 and SPEC.2 (both at v1.0) now lock.

Read the body below through these reconciliations:

1. **Friendly-fire is removed, not "display-only."** Every reference to friendly-fire
   "remaining / staying **display-only**" (Consequences → Neutral; the Flow & invariant table's
   *SPEC.1 §8 F-COMMENT-6* row; More Information) is superseded. Friendly-fire has **no** mechanic
   — no vote affordance, no `↑ N ↓ M` count. A post's Support / Counter signal is the read-time
   per-side reply-bet aggregate already specified under "Per-side data model the ranking reads."

2. **No `friendly_fire_events` read-source.** Decision Drivers' "reads from `comments` + `bets`
   (+ `friendly_fire_events` only where / if a mode / lane uses it)" is superseded.
   `friendly_fire_events` is struck from the schema; **no mode or lane reads it.** Ranking
   read-sources are `comments` + `bets` only.

3. **F-COMMENT-6/7/8 struck.** References to F-COMMENT-6 and its DEBATE.6 eligibility rules are
   superseded — the F-COMMENT-6/7/8 contracts and the `castFriendlyFire` / `clearFriendlyFire`
   actions are removed (SPEC.2 §5.5, §13.3); the physical `friendly_fire_events` drop is forward
   work at DEBATE.9. The SPEC.1 §9 friendly-fire-as-input removal this ADR flagged "for same-commit
   SYNC.7/8" was completed in SYNC.7.

4. **ADR Index is SPEC.2 §22, not §23.** This ADR's inline "SPEC.2 §23 (ADR Index)" references
   (metadata *Frame document* row; Flow & invariant table; More Information) predate the
   PRECURSOR.2-B renumber (§23 → §22). The canonical index is **SPEC.2 §22**; the inline §23
   pointers are left as historical, uniform with ADR-0018/0019 which carry the same pre-strike number.

### P2 — "Latest" interleave in the Top default (DEBATE.8 `RANKING.md` authoring, 2026-06-23)

In-place Patch record per CLAUDE.md §5.12 (refines the **Top default's order**; **not** supersession). **The load-bearing decisions are unchanged** — the multi-lane "Top" composite, the single-axis filter modes, reply ranking by stake-descending-within-side, shared time-decay, author-stake as seed-and-tiebreaker, read-time computation, and the v1 ship set all stand. This patch adds one element to the Top default and records the rationale, because it touches a property this ADR locked under **Decision Outcome → "Default is fixed, not shuffled."**

**The change.** The **Top** default order interleaves the **newest post not yet shown** at a fixed positional cadence: after every `LATEST_INTERLEAVE_INTERVAL` ranked posts, the next position is filled by the most recent post (by `created_at`) that has not already appeared higher in the list; ranking then resumes. The cadence constant `LATEST_INTERLEAVE_INTERVAL` is owned by `RANKING.md` and pinned at the 2026-09-01 number-tuning pass (placeholder until then), per the number-tuning rule.

**Scope of the change (deliberately narrow):**

1. **Top default only.** The interleave applies to the Top order on the market detail view and nowhere else. It does **not** apply to the single-axis filter modes (Most Debated, Highest Stakes, Contested) — a reader selecting a pure-axis lens has asked for that axis undiluted; injecting recency would break the lens contract. It does **not** apply to **Newest** (already pure recency) and is moot there. It does **not** apply to the **profile** post/reply list (a body of work, not a live market feed — the momentum-burial problem does not arise; see SPEC.1 §9 profile-ranking scope).
2. **One-at-a-time.** Exactly one latest post is injected per cadence point — not a batch — for maximum predictability and reproducibility.
3. **No duplication.** The ranked order is the spine; at each cadence point the injected post is the newest post **not already shown** above. Every post therefore appears exactly once. A post that would naturally rank within the top `LATEST_INTERLEAVE_INTERVAL` is not re-injected as a latest slot.

**Why this is consistent with "fixed, not shuffled."** The locked property forbids **non-determinism** (per-load shuffle, per-reader variation) on the grounds that it destroys legibility and corrupts the experimental dataset. The interleave introduces **no non-determinism**: the injected position is a deterministic function of `created_at` over the current post set, identical for every reader at a given moment, and fully reproducible by replaying the published model over the public dataset (INV-4 freeze at resolution inherited unchanged — a resolved market's interleaved order is as immutable and replayable as its ranked order). The legibility concern is likewise preserved: the rule is a single published sentence ("every Nth slot is the newest unshown post"), not a hidden weight. This patch therefore **refines** the fixed default; it does not reopen the anti-shuffle decision.

**Rationale (the blind spot this closes).** The Top lanes (`n`, `D`, `lop`) are all **accumulation** signals — a post scores by what it has *already* attracted. The shared gravity term (`raw / (age + c)^g`) decays *old* posts but does nothing for a *brand-new* post that has not yet accumulated: it starts at the bottom of every lane and, being unseen, attracts no reply-bets, so it stays at the bottom — a rich-get-richer visibility trap that suppresses exactly the fresh informed participation (`dn/dt`) the thesis depends on. Gravity addresses "old and coasting"; the interleave addresses "new and buried." The two are complementary, and the interleave is the deterministic, dataset-safe mechanism for the second.

**Consequence absorbed.** `RANKING.md` (DEBATE.8) specifies the interleave in the Top default's order section, defines `LATEST_INTERLEAVE_INTERVAL` as a number-tuning placeholder, and states the no-duplication and one-at-a-time rules precisely. SPEC.1 §9's "default is fixed, not shuffled" sentence is annotated to point at this patch (the property holds; the mechanism is refined). No schema, no new event type, no new write path — the interleave is a read-time ordering rule over existing rows.

### P3 — Filter modes retired from the v1 surface; lane-dominance badges replace them (DEBATE.8 `RANKING.md` authoring, 2026-06-23)

In-place Patch record per CLAUDE.md §5.12 (scopes the **v1 reader-facing surface**; **not** supersession). **The load-bearing decisions are unchanged** — the multi-lane "Top" composite, the per-side data model and four base signals, reply ranking by stake-descending-within-side, shared time-decay, author-stake as seed-and-tiebreaker, read-time computation, the P2 latest-interleave, and the underlying lane definitions all stand. This patch changes only **how the lanes are exposed to the reader**, which touches the v1 ship set under **Decision Outcome → "v1 ship set"** and the **mode-presentation-order** subsection.

**The change.** The opt-in **single-axis filter modes** (Most Debated, Highest Stakes, Contested, Newest) are **removed from the v1 reader-facing surface**. There is **no mode selector** in v1. The debate view is always rendered in **Top** order (with the P2 latest-interleave). In place of the selector, each post that **dominates a lane** is rendered with a single **lane-dominance badge** naming that lane.

**The badge rule (read-time, derived from the existing model — not a ranking input):**

1. A badge is a **read-time label** computed by `ranking.ts` from the same lane values it already computes for Top. It is **not** stored, **not** a ranking input, and adds **no** schema, column, or event type — same read-time-computed posture as the order and the four aggregates (SPEC.2 §5.4).
2. A post is badged **only if it dominates a lane** — i.e. its lane margin clears the same `k_lane` / `floor_lane` thresholds that qualify it for Top. Posts that dominate no lane (the majority) carry **no badge**.
3. A badged post carries **exactly one** badge — the lane of its **highest margin** (its single strongest dominance). This is the same lane that earns the post its Top position, so the badge and the ordering are consistent by construction.
4. The badge vocabulary is the three **dominance lanes**: **Most Debated** (`n`), **Highest Stakes** (`D`), **Contested** (the even-and-big lane, `n^b`). **Newest is not a badge** — recency is a position fact surfaced by the P2 interleave, not a lane a post "wins."

**What this removes, and why it's acceptable.** The reader loses the ability to *re-sort* the debate by a single axis, and the **Contested** and **Newest** *browsable views* are gone (Contested survives as a badge; Newest's intent survives via the interleave). This is a deliberate **experiment-scope simplification** in service of two project goals: **minimum user interaction** (no controls to operate — the reader reads arguments, not a sort menu) and **focus on the posts** (the badge tells the reader *why* a post is prominent at a glance, where a filter would pull them into operating the UI). The cost is reader control over presentation; the benefit is a single, legible, low-interaction surface for a 45-day experiment whose purpose is to make people read and stake on arguments, not browse a feed. The full mode machinery is preserved in the model (the lanes still compute, the badges read off them), so reintroducing reader-selectable modes at testnet+ is a UI-only change requiring no model rework.

**Mode-presentation-order subsection — superseded for v1.** The menu order (Top → Most Debated → Highest Stakes → Contested → Surging → Newest) was a *selector* ordering; with no selector in v1 it does not apply. The thesis stance it encoded (participation `n` surfaced before stake `D`) is preserved at the **badge** level only as a non-ordered label vocabulary. Retained on record for a future surface that reintroduces selectable modes.

**Surging.** Already deferred to v1.x (unchanged). Under this patch, if Surging ships later it ships as either a badge or a reintroduced mode per the surface decision at that time — out of v1 scope either way.

**Consequence absorbed.** `RANKING.md` (DEBATE.8) specifies: the single Top order (with P2 interleave) as the only v1 reader surface; the lane-dominance badge as a read-time output of `ranking.ts` (one badge, highest-margin lane, `k_lane`-gated, three-lane vocabulary); and the filter modes as *computed-but-not-exposed* lane lenses retained for testnet+. SPEC.1 §9's mode-selector language and F-DEBATE-1's "mode selector exposing Most Debated / Highest Stakes / Contested / Newest" are annotated to v1 = Top-only-plus-badges (the modes compute; the selector is not built). DEBATE.4 (debate-view render) builds the badge display and **no** mode selector. No schema, no new event type, no new write path.

## Context and Problem Statement

ADR-0009 locked a single deterministic ranking function — an HN-style time-decayed numerator combining stake, friendly-fire net score, and side-split reply counts — as the *one* order in which debate-view comments render. The SYNC.3.5 refinement pass (item 02, reply-as-bet model) reopened the reply/ranking model, and **ADR-0009 is rejected and superseded**. This ADR replaces it. It does not amend ADR-0009's function; it discards the single-function model and decides the ranking model afresh.

The ranking model shapes which posts a reader sees, which they engage with, and therefore which arguments accumulate the informed-and-staking participation that drives a market. Per the Zugzwang thesis (**K · n > C** — knowledge × informed participants exceeds manipulative capital), ranking is part of the propagation surface for the K-side of the inequality.

**The reframe that forces a new model.** ADR-0009 inherited a vote-quality mental model from social platforms: it treated friendly-fire as a quality signal and produced one "correct" order. Zugzwang has no quality verdict on a post. Every reply is itself a **bet** carrying a stake and a side; a **support** bet and a **counter** bet are *both* contributions to the debate, not "good" and "bad." A heavily-countered post is not low-quality — it is *contested*, possibly the most significant post in the market. This single fact invalidates the entire approval-rate family (Wilson "best", and any up/down quality sort) and inverts the Hacker News stance: HN *detects* controversy to *suppress* it; Zugzwang treats **contestation as signal, not noise**. The fight is the product.

**A fresh post lives in a two-axis space.** *Traction* (how much activity a post draws) and *balance* (how evenly the two sides are matched) are independent, producing four post archetypes — high-traction/balanced (the live cliffhanger), high-traction/lopsided (a settled blowout), low-traction/balanced (a niche standoff), low-traction/lopsided (an obvious take). A single scalar order cannot tell these apart; it smears them. **This is why the answer is a small set of single-purpose lenses plus one composite default, not one number.**

**Two distinct ranking problems.** The model must rank (a) **fresh posts** — top-level bets within a single market's debate, one pool, ranked top-to-bottom; and (b) **replies** — which per the locked two-slot debate-view rule are *side-partitioned* and rendered as a matched pair (best opposite-side + best same-side), expandable to a score-sorted list. The two problems share signal vocabulary but differ structurally; with `REPLY_DEPTH_MAX = 1` (flat replies, locked) a reply emits only one rankable signal, so the reply ranking is far simpler than the fresh-post ranking.

The forces at play:

- **Open-source publishing constraint.** `RANKING.md` is AGPL-3.0 and public. Anyone can read it and optimise against it. Zugzwang does not defend ranking by secrecy. **But the thesis-level defense is not the ranking function — it is mandatory commentary** (see Decision Driver 2). Capital is *not* handicapped at the ranking layer; surfacing a heavily-staked post surfaces its argument for public scrutiny, and the commentary layer adjudicates in the open.
- **45-day experiment window.** The model ships at launch (2026-09-15) and runs through conclusion (2026-11-08). Signals that take months to develop are dead weight.
- **ADR-0005 §4 read-time-computed classification.** Ranking is read-time-computed (no projection table, no materialised view). The model reads from `comments` + `bets` (+ `friendly_fire_events` only where a mode uses it) per page render. Any input must be available on those tables (frozen at write or read-time-aggregable).
- **Performance budget.** Debate view is a hot path. Lane aggregation runs per market render. SQL aggregation dominates; per-post compute must be O(1) and IO-free.
- **Frozen-at-resolution requirement.** Per SPEC.1 §11 + INV-4, resolved markets are immutable. Ranking must freeze with the market — auditors must reproduce the rendered order at any past resolution moment.
- **Number-tuning deferral rule.** Project standing rule: specific weight, ratio, and threshold values lock at the number-tuning pass (target 2026-09-01) against dogfooded markets, not at design time. This ADR locks **shape and design-intent ordering only**.

This ADR resolves: the per-side data model the ranking reads; the fresh-post default ("Top") and its multi-lane mechanism; the single-axis filter modes; the reply ranking rule; the v1 ship set; and the behavioural properties. Specific numeric values are deferred per the number-tuning rule.

This ADR does **not** decide:

- Specific values for any lane ratio threshold `k_lane`, any activity floor `floor_lane`, the gravity exponent `g`, the recency offset `c`, or the Surging window length — pinned by the number-tuning pass (target 2026-09-01), then locked in `RANKING.md` before public launch.
- The debate-view UI rendering (visual treatment of the Top list, the filter selector, the two-slot reply pair, mobile layout) — ADR-0012 (`design.md`, SPEC.13) + DEBATE.4 + DEBATE.8.
- **Filters** (subsetting the post set — by tag, status, etc., distinct from *ranking* which orders the set) — a separate SYNC.7/8 refinement, explicitly out of scope here.
- The cache profile at the rendered-page layer — ADR-0007 + DEBATE.4.
- Friendly-fire vote eligibility rules — SPEC.1 §8 F-COMMENT-6 (locked) + DEBATE.6. (This ADR decides only *whether and where* friendly-fire enters ranking — see Decision Outcome.)
- Hot-path query implementation (Drizzle query builder vs `sql<T>` template) — SCAFFOLD.2 / DEBATE.4 / DEBATE.8 per ADR-0008.
- Author Dharma / track-record at post time as a future input — reintroducible at testnet phase via new ADR when track records compound over months; out of v1 scope.
- A post-resolution "vindicated / was-right" lens — genuinely a future feature (requires ground truth, which does not exist pre-resolution); out of live-phase scope.

## Decision Drivers

1. **The model is a set of lenses, not one order.** Because support and counter are both real contributions, there is no single "best" order. The model must offer one opinionated default plus single-axis lenses, each reading one facet of the traction × balance × value space.
2. **Mandatory commentary is the thesis mechanism — the ranking carries no anti-capital logic.** K · n > C is upheld by the commentary layer operating in the open, not by suppressing capital at the ranking layer. On a pure betting market (Polymarket), placement *is* capital buying the frame, because there is nothing to read but a number. On Zugzwang, every post carries mandatory commentary (text/image/evidence); surfacing a heavily-staked post surfaces a **falsifiable argument**, and visibility is *where the debate happens*, not a prize capital captures. A visible bad argument is self-defeating when every reader can reply with evidence. Therefore: **all ranking lanes are equal, including stake-dominance; capital competes at full strength in both ranking and resolution; the experiment is only meaningful because capital is not handicapped.** Walling capital out of either arena would rig the test.
3. **Open-source resistance via cost, not secrecy.** Every ranking input must require committing Dharma to generate (a bet's stake, a reply being itself a bet). Costless inputs (free votes, passive engagement) are excluded — not to protect against capital (Driver 2), but because costless inputs are sybil-trivial and carry no K. This is why no free up/down vote enters ranking.
4. **Significance is axis-agnostic ("dominate any lane").** The default must surface every *kind* of heavyweight — the decisively-won post, the most-debated post, the most-staked post — without the model taking a side on which axis "matters." A post earns the default by *decisively dominating any one lane*, not by averaging competently across lanes.
5. **45-day-window constraint.** Inputs whose signal-to-noise is structurally low in 45 days are dead weight (author track-record falls here).
6. **ADR-0005 §4 consistency + performance.** Read-time-computed, reads from `comments` + `bets` (+ `friendly_fire_events` only if a lane uses it). Per-post compute O(1), IO-free; lane aggregation a bounded set of SQL aggregates per render.
7. **Frozen-at-resolution + auditability.** Every input reconstructible from the public dataset; the model takes a `now` parameter fixed to the resolution timestamp for resolved markets (INV-4 immutability inherited). Third parties must reproduce any historical order.
8. **Single deterministic order per mode.** No personalisation, no per-reader feature vectors, no production A/B. One order per market per mode per moment, same for every reader. **The default is fixed, not shuffled** (see Decision Outcome → Default).

## Considered Options

1. **Multi-lane "Top" composite (relative-margin lane qualification) as fixed default, single-axis filter modes, reply-by-stake** ← chosen
2. Retain ADR-0009's single HN-style time-decayed numerator (friendly-fire as input, one order)
3. Weighted-average composite default (blend traction + stake + balance into one averaged score)
4. Single-axis lens as default with the others as equal alternatives, user picks (no composite)
5. Per-load **shuffled** default mode (rotate which lens orders the front page each render)
6. Stake-dominance **excluded** from default Top lanes (anti-capital ranking clause)
7. Free up/down votes on replies as a ranking signal (Reddit/HN pattern)
8. Reply ranking by a stake × backer-count blend (stake-backed "backing" micro-bets)

## Decision Outcome

**Chosen: Option 1 — a multi-lane "Top" composite as the fixed default, single-axis filter modes as opt-in lenses, and reply ranking by stake within side.**

### Per-side data model the ranking reads

Each fresh post (top-level comment) exposes **four base signals**, tracked per side, plus age. These are the substrate for every mode. Per-side separation is mandatory — it is what makes the value-vs-volume contrast expressible.

| Signal | Definition | Source |
|---|---|---|
| `support_count` | number of reply-bets on the post's own side | `bets` / `comments` self-join on side |
| `counter_count` | number of reply-bets on the opposing side | `bets` / `comments` self-join on side |
| `support_dharma` | total Dharma staked across support-side reply-bets | `bets.stake` aggregated, support side |
| `counter_dharma` | total Dharma staked across counter-side reply-bets | `bets.stake` aggregated, counter side |
| `age` | post age (`now − created_at`); `now` frozen at resolution for resolved markets | `comments.created_at`, `now` parameter |

Derived quantities used by the modes:

```
n   = support_count  + counter_count          // VOLUME  — informed participation (thesis n)
D   = support_dharma + counter_dharma          // VALUE   — committed Dharma (capital-like axis)
b   = min(support_count, counter_count)
      / max(support_count, counter_count)       // BALANCE — 0 (blowout) … 1 (dead even)
lop = 1 − b                                     // DOMINANCE — the inverse of balance
a   = author's own stake on the post            // author conviction (header-level, see Display)
```

> **Display correction absorbed (data-model consequence, not a UI decision).** The per-post activity footer renders **two side-pairs** — `Support (support_count) : Đ support_dharma` and `Counter (counter_count) : Đ counter_dharma` — *not* a single combined pool. The author's own stake `a` renders at **header** level (a property of the post), not in the activity footer. This forces the four-signal per-side shape above; a single `D`/`n` pair would not support the value-vs-volume contrast that the modes depend on. UI treatment proper is ADR-0012 / DEBATE.4.

### The default: "Top" — dominate any single lane by a relative margin

**Top is the one fixed default order.** It is **not** an average. A post qualifies for Top by **decisively dominating any one lane** — being far ahead of the *second-place* post *in that same lane*. Winning a lane narrowly does not qualify; *dominating* it does. A post that is a mediocre second across three lanes qualifies in none; a post that crushes one lane qualifies through that lane. Different *kinds* of heavyweight therefore surface simultaneously, each through its own lane.

**Lanes (all equal — no lane suppressed, including stake; per Driver 2):**

| Lane | Quantity ranked | What it surfaces |
|---|---|---|
| **Traction-dominance** | `n` | A post overwhelmingly more debated than the field (the crowd has converged here) |
| **Stake-dominance** | `D` | A post with overwhelmingly more committed Dharma than the field (capital has spoken loudly — its argument surfaces for scrutiny) |
| **Dominance (split)** | `lop`, gated by `n` | A post one side has *decisively won*, on meaningful volume (a settled-but-significant debate; the heavyweight-author case) |

**Margin shape — ratio-to-#2 above an absolute activity floor.** A lane qualifies a post when its lane quantity exceeds the second-place post's lane quantity by more than a tunable ratio `k_lane`, *and* the post clears a small absolute activity `floor_lane` (so "3 replies vs 1" is not a 3× "landslide"). Ratio chosen over a z-score / distance-from-pack measure for **legibility** — "this post has 3× the next post's stake" is auditable at a glance by a non-technical reviewer; a standard-deviations measure is statistically defensible but opaque, and legibility was weighted higher for an experiment that must be learned from. The floor kills small-number noise that ratio alone admits.

```
qualifies_lane(post, lane) :=
      lane_value(post)            ≥ floor_lane
  AND lane_value(post)            ≥ k_lane × lane_value(second_place_in_lane)

Top_score(post) := max over lanes of  margin_in_lane(post)        // best landslide wins ordering
                                                                   // (margin = lane_value / second_place_value)
```

`k_lane`, `floor_lane` per lane → number-tuning pass. The **dominance (split)** lane is gated by `n ≥ floor_split` so a 2-vs-0 post cannot read as maximal lopsidedness; lopsidedness only counts on meaningful volume.

**Graceful degradation (no-landslide / flat-market case).** Early or sleepy markets may have no post that dominates any lane by `k_lane`. Top must never render empty. When no post crosses a lane's qualifying ratio, Top falls back to **closest-to-landslide ordering** — rank by best margin *achieved* across lanes even if none crosses the threshold — degrading smoothly from "landslide winners" to "the nearest thing to one." A single loud voice in an otherwise-empty market legitimately tops Top; that is honest, not a capital exploit (Driver 2).

**No anti-capital clause.** Stake-dominance is an admissible Top lane on equal terms. The multi-lane structure ensures stake-dominance *qualifies* a post without *monopolising* Top — traction- and split-dominant posts qualify through their own lanes simultaneously. The thesis is adjudicated by commentary in the open, not by ranking-level suppression (Driver 2). **The ranking contains no thesis-defense logic, because none is needed; the defense lives in the mandatory-commentary floor.**

### Single-axis filter modes (opt-in lenses)

When a reader selects a filter, ranking switches to that lane's single-axis order. These are the lenses Top composes from, exposed individually:

| Mode | Order | Time-decay |
|---|---|---|
| **Most Debated** | `n` descending | yes (gravity) |
| **Highest Stakes** | `D` descending | yes (gravity) |
| **Contested** | `n ^ b` descending (magnitude raised to the power of balance) | yes (gravity) |
| **Surging** *(v1.x — deferred)* | recent-window activity rate descending | n/a (window *is* the recency) |
| **Newest** | `age` ascending (pure chronological) | n/a (time *is* the sort) |

**Contested** is the mode the four-quadrant reframe is built around: `n ^ b` makes a big *and* even post score near its full magnitude (`b ≈ 1`), collapses a lopsided blowout toward 1 regardless of size (`b → 0`), and keeps a tiny even post small (small `n`). It isolates the live-cliffhanger corner. It is offered as a filter, **not** as the default — the default is Top, which is axis-agnostic.

**There is no "Best" mode.** A "best" post would mean the one that *correctly predicted the outcome*, but pre-resolution there is no ground truth. A "vindicated" lens is a genuine *post-mortem* feature (out of scope, named in "does not decide").

### Shared time-decay (gravity)

Most Debated, Highest Stakes, and Contested rank quantities that only *accumulate* (`n`, `D`, and `n`-derived) — left raw, the oldest post wins forever for merely existing longest. They share an HN-style gravity term so a post must *keep* attracting activity to hold position:

```
ranked_score = raw_signal / (age + c)^g            // c, g → number-tuning pass
```

Newest is exempt (time is its sort). Surging is exempt (it reads only a recent window). **Top's lane margins use current lane values**; whether the dominance margin itself carries decay is a number-tuning refinement, but the *split* lane in particular must not resurface a *stale* blowout — the stale-blowout case (high `lop`, old, dead) is handled by gating split on `n` and by the freshness implicit in the closest-to-landslide fallback. (Recorded as a tuning-sensitive edge — see Consequences → Negative.)

### Author stake — seed and tiebreaker, not a mode

`a` (author's own stake) is **not** a mode. It plays two roles: **cold-start seed** — a brand-new post with zero replies has no `n` and no `D`, so it is ordered by author conviction `a` until reply-bets arrive and the real lane values take over (a high-conviction new post is never invisible); and **tiebreaker** — when two posts tie on a mode's metric, higher `a` wins, then recency.

### Reply ranking (depth = 1) — by stake, within side

`REPLY_DEPTH_MAX = 1` (flat replies, locked SPEC.1 §16.1 / F-COMMENT-2 / this ADR). With flat replies, the other axes do not exist at the reply level: a reply has no children, so **no traction** and **no split**; a reply *is* a bet, so **stake is the only signal it emits**. The reply metric is therefore not a *choice* — it is the only rankable number a flat reply carries.

```
Reply ranking (depth = 1):
  1. Partition replies by side (support pool, counter pool).
  2. Within each side, sort by reply stake (Đ) descending.
  3. Tie-break: earlier posting time wins at equal stake (first-posted ranks higher).
  4. The two-slot debate-view default surfaces the top reply of EACH side;
     expansion shows each side's full stake-sorted list.
```

Tie-break is **earlier-wins** (deterministic, rewards conviction shown earlier, stable for the audit trail; the same anti-non-determinism reasoning that rejects shuffle). Per ADR-0016, reply IDs are UUIDv7 and sort by creation time, so "earlier" is a free natural sort.

> **Known tension (recorded, accepted, not an oversight).** With depth = 1, stake is the only signal a flat reply emits, so **the reply ranking is purely the C-axis** — a high-Đ reply outranks many small informed replies on the same side, every time. This is a direct `C > n` outcome *inside* a system whose headline is `K · n > C`. It is an **accepted consequence** of the depth-1 + no-free-votes decisions, recorded here so the contradiction is on the record rather than discovered later. The `n`-bearing alternatives — nesting (depth > 1) and stake-backed "backing" micro-bets (Option 8) — were considered and rejected for experiment scope (nesting: structural complexity; backing: scope). Reconsider only if depth > 1 is reintroduced via a future ADR. Note this tension is *narrow*: it lives at the reply level inside a single post; the post-level model (Top, Contested) carries the thesis at the level that matters for which debates assemble.

### Default is fixed, not shuffled

The default mode (Top) is **fixed across loads and readers**. Per-load shuffle (Option 5) was rejected: its one benefit — breaking the rich-get-richer feedback loop — is already delivered by the gravity term (which prevents permanent domination without randomness), while its costs are real and matter more for an experiment — it **destroys legibility** (a reader cannot form a stable "why is this on top" model) and **corrupts the experimental dataset** (behaviour is uninterpretable when the ordering itself is random). If variety is wanted later, the legible path is a *scheduled, announced* rotation (e.g. weekly default change), never per-load randomness. v1 ships one fixed default.

### Mode presentation order

The menu order encodes the thesis stance and is not arbitrary:

| # | Mode | Why here |
|---|---|---|
| 1 | **Top** | Default and flagship — leads. |
| 2 | Most Debated | The `n` readout. Placed *before* Highest Stakes deliberately, signalling participation's primacy. |
| 3 | Highest Stakes | The `D` readout. Adjacent to its opposite so the contrast is one glance away. |
| 4 | Contested | The live-cliffhanger lens. |
| 5 | Surging *(v1.x)* | Utility lens — "what's hot now." |
| 6 | Newest | Baseline / audit — last. |

### v1 ship set

Deadline-disciplined (launch 2026-09-15 locked, scope flexes):

- **v1 (launch):** **Top** (the default composite), **Most Debated**, **Highest Stakes**, **Contested**, **Newest**. Top + Most Debated + Highest Stakes + Newest are cheap (aggregates / sort). Contested is moderate (the `n ^ b` shape) and is worth shipping — it is the live-debate lens.
- **v1.x (post-launch if time allows):** **Surging.** Most infrastructure (time-windowed velocity aggregation), most game-able (timed burst). No reason to block launch on it.

### Read-time-computed (no projection table)

Per ADR-0005 §4, ranking is read-time-computed. No `ranking_snapshots` table, no per-poll history, no materialised scored-comment view. Lane aggregates and per-post scores compute against current-state tables on every debate-view render. Researchers reconstruct historical rankings (Top and every filter) by replaying the published model over historical inputs from the public dataset.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Model specification (modes, Top lanes + margin shape, decay, reply rule, behavioural properties, worked example, thresholds) | `experiment/docs/specs/RANKING.md` |
| Model implementation (pure TypeScript, no IO) | `src/lib/ranking.ts` |
| Tunable values (post-2026-09-01) — `k_lane`, `floor_lane` per lane, `c`, `g`, Surging window | `RANKING.md` (pinned values); `src/lib/ranking.config.ts` (runtime config) |
| Lane / mode aggregation index DDL | `drizzle/migrations/<NNNN>_ranking_indexes.sql` (SCAFFOLD.2 deliverable) |

## Consequences

### Positive

- **Axis-agnostic significance.** Top surfaces the decisively-won post, the most-debated post, and the most-staked post *simultaneously*, each through its own lane — the model never has to adjudicate "is lopsidedness good or is balance good," the fight that stalls every single-scalar design.
- **Thesis-honest by omission.** The ranking carries *no* anti-capital logic and *no* thesis-defense special-casing. Capital competes at full strength; the mandatory-commentary floor is the mechanism. Fewer special cases, less code, and philosophically exact — a win earned against un-handicapped capital is the only win that means anything.
- **Gaming-resistant by cost.** Every ranking input requires committing Dharma to generate (stake, reply-as-bet). No free votes enter ranking; costless sybil-`n` has no path in.
- **Legible and auditable.** Ratio-to-#2 margins ("3× the next post") are reconstructible at a glance; every input is in the public dataset; any historical order in any mode is bit-exact reproducible. Fixed (un-shuffled) default keeps reader mental models and dataset interpretation clean.
- **Contested isolates the live debate.** `n ^ b` is a clean closed-form that floats big-and-even fights and sinks both blowouts and 1-v-1s, offered to readers who want exactly that lens.
- **Cheap at rank-time.** A bounded set of SQL lane-aggregates + one pure-TS pass per render; per-post compute is a handful of float ops.
- **No closed-source components.** `RANKING.md` is AGPL-3.0; the model is the contract — no vendor algorithms, no secret weights, no opaque ML.

### Negative

- **Reply ranking is pure C-axis.** (See the boxed Known Tension.) Accepted consequence of depth-1 + no-free-votes; recorded, not hidden; narrow (reply-level only).
- **Specific numbers deferred.** Until the 2026-09-01 number-tuning pass pins `k_lane`, `floor_lane`, `c`, `g`, the model cannot render real orders (placeholder constants only). Mitigated: the tuning pass is on the critical path before launch; this ADR's shape + design-intent ordering is sufficient to implement against placeholders.
- **Stale-blowout edge is tuning-sensitive.** The split lane must not resurface an old, dead, lopsided post. Handled by gating split on `n` and by the closest-to-landslide fallback's freshness pressure — but whether the dominance margin needs an explicit decay term is a tuning-pass call. Flagged so it is not discovered in production.
- **No filter tabs beyond the named modes.** No personalised or reader-tunable variants beyond mode selection. Acceptable: the platform's stance is "ranking is opinionated"; an unbounded sort-menu is an engagement-platform default, not a knowledge-platform one. Filters (set-subsetting) are a separate SYNC.7/8 refinement.
- **Order changes per render (decayed modes).** Time-decay means a post can drift down between renders as hours pass. A property of the function class (HN, every time-decay ranker), not a bug; `RANKING.md` states it explicitly.
- **Index discipline required.** SCAFFOLD.2 must add the lane-aggregation indexes. Flagged in the file map and the SPEC.2 §0.1 change-log row absorbing this ADR.
- **Surging absent at launch.** "What's accelerating now" is unavailable in v1. Mitigated: Newest covers raw recency; Surging ships v1.x.

### Neutral

- **Friendly-fire is no longer a ranking input.** ADR-0009 fed friendly-fire net score into its single function. This model does not — friendly-fire remains a **display-only** mechanic per SPEC.1 §8 F-COMMENT-6 (`↑ N ↓ M` live count), with no ranking role. This *removes* friendly-fire from the ranking inputs SPEC.1 §9 previously enumerated; SPEC.1 §9 requires a same-commit update in SYNC.7/8 to drop the friendly-fire-as-input language. (Rationale: friendly-fire is the nearest thing to a free vote in the system; keeping it out of ranking is consistent with Driver 3.)
- **`bets.stake` is the value substrate.** Per-side Dharma aggregates read from `bets.stake` (the reply-bet's committed Dharma). Bucket A append-only discipline applies — stake is set on INSERT, never updated.
- **AGPL-3.0 on `RANKING.md`.** Same license as the protocol per ADR-0001.
- **Author-stake header placement.** `a` renders at post header (conviction is a post property), not in the per-side activity footer. A display consequence of the data-model split; visual treatment is ADR-0012.

## Pros and Cons of the Options

### Option 1 — Multi-lane "Top" composite + single-axis filters + reply-by-stake (chosen)

**Pros**

- Axis-agnostic: surfaces every kind of heavyweight without adjudicating which axis matters.
- Carries no anti-capital logic — thesis-honest, fewer special cases, commentary is the mechanism.
- Every input requires Dharma to generate; no free-vote / sybil-`n` path into ranking.
- Ratio-to-#2 margins are legible and auditable; fixed default keeps the dataset interpretable.
- Reply rule is the *only* rankable signal under depth-1 — minimal, deterministic.

**Cons**

- Reply ranking is pure C-axis (boxed tension; accepted, narrow).
- More moving parts than a single function — lanes, margins, fallback, plus per-mode orders — i.e. more to specify in `RANKING.md` and more thresholds in the tuning pass. The cost buys axis-agnostic significance the single-function model cannot express.
- Stale-blowout split edge is tuning-sensitive (flagged).

### Option 2 — Retain ADR-0009's single HN-style numerator

**Pros**

- Already specified and battle-tested-lineage; one order, one function, minimal surface.
- Friendly-fire-as-input is already wired in SPEC.1 §9.

**Cons**

- Built on the **vote-quality model the reframe invalidates** — it produces one "correct" order as if posts had a quality verdict, but support and counter are both contributions, not good/bad. A single order *smears* the four post archetypes it cannot distinguish.
- Cannot express the value-vs-volume contrast (it blends, it does not separate), so it cannot surface "capital says X / crowd says Y" — the readout the thesis cares about.
- Treats friendly-fire (the system's nearest-to-free signal) as a ranking input, against Driver 3.

**Verdict:** Rejected and superseded. The model it encodes is the one SYNC.4 exists to replace.

### Option 3 — Weighted-average composite default

**Pros**

- One scalar, simple to sort; "rewards all-round strength."

**Cons**

- **Rewards mediocre-across-the-board, not decisive-in-one** — the opposite of what significance means here. A post that crushes one lane (the Carlsen-style decisively-won post; the runaway-debate post) can be beaten by a bland second-everywhere post. An average *buries* heavyweights.
- Forces a fixed weight on each axis — i.e. a permanent, baked-in statement of "how much does capital count vs crowd," the single most thesis-loaded number in the system, hidden inside a tuning constant. The chosen multi-lane model avoids picking that ratio at all (all lanes qualify independently).

**Verdict:** Rejected. Averaging is structurally wrong for "dominate any lane" significance.

### Option 4 — Single-axis lens as default, others as equal alternatives (no composite)

**Pros**

- Simplest mental model — pick a lane, that is the order.

**Cons**

- *Every* single-axis default is wrong as a default: Most Debated alone is the prime sybil target; Highest Stakes alone hands the front page to whichever post a whale dominates the stake lane on (not wrong per Driver 2, but it shows *only* the stake heavyweight and hides the others); Newest alone shows nothing — it never demonstrates the platform working, wasting the shop window of an experiment whose purpose is to demonstrate K · n > C; Contested alone hides the decisively-won significant post (the Carlsen case). No single lens surfaces *all* kinds of heavyweight — which is precisely the job Top's multi-lane composite does.

**Verdict:** Rejected. The default must be multi-lane to surface every heavyweight kind at once.

### Option 5 — Per-load shuffled default

**Pros**

- Breaks rich-get-richer (a top post is not always seen-most-so-climbs-most).

**Cons**

- The rich-get-richer benefit is **already delivered by the gravity term** without randomness.
- **Destroys legibility** — no reader can form a stable "why is this on top" model.
- **Corrupts the experimental dataset** — behaviour is uninterpretable when the ordering itself is non-deterministic, which is fatal for an experiment meant to be learned from.

**Verdict:** Rejected. Fixed default; scheduled rotation is the legible alternative if variety is ever wanted.

### Option 6 — Stake-dominance excluded from default Top lanes (anti-capital clause)

**Pros**

- Superficially "protects" the front page from capital.

**Cons**

- **Misunderstands the thesis.** K · n > C is the claim that informed numbers *can beat* capital in the open, *not* that capital must be restrained. Excluding the stake lane handicaps C at the ranking layer — and a win against handicapped capital proves nothing. The experiment is only meaningful if capital competes at full strength and n beats it anyway.
- **Unnecessary** — because of mandatory commentary (Driver 2), surfacing a stake-dominant post surfaces a *falsifiable argument* exposed to public scrutiny; visibility is where the debate happens, not a frame capital captures unanswerably (the Polymarket case, which Zugzwang is not). The multi-lane structure already prevents *monopoly* without *suppression*.

**Verdict:** Rejected. All lanes equal; the ranking carries no anti-capital logic; commentary is the mechanism.

### Option 7 — Free up/down votes on replies as a ranking signal

**Pros**

- Familiar (Reddit/HN); would inject a `n`-like signal into reply ranking, softening the pure-C-axis reply tension.

**Cons**

- **Breaches the "no stake, no voice" floor** — the floor governs *influence*, not the betting verb. A free vote that *reorders* replies is costless influence over the shared surface, which is exactly what the floor forecloses, regardless of the vote not being a "bet." It also lets the costless thing (vote) overrule the costly thing (stake) on a surface *made of bets* — stake losing to no-stake.
- Delivers only *costless* `n`, which is sybil-trivial and carries no K — the weakest possible input, against Driver 3.

**Verdict:** Rejected. Reply ranking stays stake-only; the floor is not breached.

### Option 8 — Reply ranking by stake × backer-count (stake-backed "backing" micro-bets)

**Pros**

- Would inject *informed* `n` (each backer commits a minimum stake) into reply ranking without breaching the floor — the principled version of Option 7.
- Mirrors the post-level value-vs-volume shape one level down.

**Cons**

- A net-new mechanic (a "back this reply" micro-bet surface) — added scope and new write paths in the experiment window, for a reply-level refinement.
- Reply-level C-axis purity is a *narrow* tension (single post, reply pool); not worth a new betting surface to soften within experiment scope.

**Verdict:** Rejected for the experiment. The principled `n`-into-replies path; revisit only alongside a depth>1 / backing decision in a future ADR.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0009 | Predecessor ranking lock | **Supersedes.** This ADR discards ADR-0009's single-function model (HN numerator + friendly-fire input + design-intent weight ordering). ADR-0009 status → `superseded` in same SYNC.7/8 commit; SPEC.2 §23 entry updated. |
| SPEC.1 §9 | Ranking function open-source / deterministic / universal / auditable | Consumes the four properties; **mints** a new model that satisfies them (modes + Top composite). SPEC.1 §9 requires same-commit rewrite (SYNC.7/8): replace the single-function preamble and its five-input list (which names friendly-fire as an input) with the mode set, Top lanes, and the four per-side base signals. **Friendly-fire removed from ranking inputs** (now display-only). |
| SPEC.1 §9 (replies) | Reply ordering | Consumes the locked two-slot rule (best opposite-side + best same-side, expansion score-sorted). **Mints** the reply order: stake-descending within side, earlier-wins tie-break. Replaces ADR-0009's "scored by the same function" reply rule with stake-only (the only signal depth-1 emits). |
| SPEC.1 §8 F-COMMENT-6 | Friendly-fire mechanic | Consumes: friendly-fire stays display-only (`↑ N ↓ M`). **This ADR removes its prior ranking-input role.** Eligibility rules unchanged (DEBATE.6). |
| SPEC.1 §16.1 | `REPLY_DEPTH_MAX` | Consumes: stays pinned to 1 (flat replies). The reply-stake-only rule is a *consequence* of depth-1 (no children ⇒ no traction/split signal). |
| SPEC.1 §11 + INV-4 | Resolution-time freeze | Consumes: model `now` parameter set to `resolution_events.timestamp` for resolved markets; INV-4 immutability inherited by every mode's order. |
| SPEC.1 §17 | Acceptance test catalogue | **Mints** (SYNC.7/8): rows for `ranking::top-multi-lane-qualification`, `ranking::top-relative-margin-and-floor`, `ranking::top-graceful-degradation-no-landslide`, `ranking::mode-most-debated`, `ranking::mode-highest-stakes`, `ranking::mode-contested-n-pow-balance`, `ranking::mode-newest`, `ranking::deterministic-and-universal-per-mode`, `ranking::frozen-at-resolution`, `ranking::default-fixed-not-shuffled`, `replies::stake-descending-within-side`, `replies::tie-break-earlier-wins`. Removes ADR-0009-era rows that assumed friendly-fire-in-ranking (`ranking::excludes-frozen-and-cleared-friendly-fire` is retired *as a ranking test*; friendly-fire display tests stay). |
| SPEC.1 §18 | Out-of-scope catalogue | **Mints:** free-vote-as-ranking-signal (with the influence-floor rationale); post-resolution "vindicated" lens; author track-record at post time; Surging (v1.x, not out-of-scope but deferred); stake-backed backing. |
| SPEC.2 §1.4 #3 | Ranking math delegation | Consumes: SPEC.2 defers ranking math to `RANKING.md`. This ADR + the rewritten `RANKING.md` fulfil the delegation under the new model. |
| SPEC.2 §5 (Data Model) | Per-side reply-bet aggregates | Consumes the `comments` / `bets` shape (`side_at_post_time`, `bets.stake`, `bets.side`). Confirms the four per-side base signals are read-time-aggregable from existing columns; **no new frozen column required** on `comments` (unlike ADR-0009's `stake_at_post_time`, which this model does not need at post-level — value is aggregated from reply-bets). Author stake `a` for cold-start/tiebreak reads the post's own entry bet. Substantive absorption deferred to SPEC.2 §5 drafting chat. |
| SPEC.2 §7 (Event Model) | Read-time-computed classification | Consumes: ADR-0005 §4's "read-time-computed (no projection table)" classification stands and is reaffirmed. |
| SPEC.2 §9 (Concurrency) | Bet/comment write transaction | Consumes: per-side aggregates read `bets.stake` + `side`; no new in-transaction computation required at post level (value aggregates at read-time). |
| SPEC.2 §23 (ADR Index) | ADR index | **Mints** an ADR-0017 entry; flips ADR-0009 to `superseded`. Same SYNC.7/8 commit. |
| SPEC.2 Appendix A (File Map) | Ranking module + spec | Consumes the existing `RANKING.md` + `src/lib/ranking.ts` rows; adds `src/lib/ranking.config.ts` for the new tunables. Substantive absorption deferred to SPEC.2 Appendix A drafting chat. |
| ADR-0001 | License (AGPL-3.0-or-later) | Consumes: `RANKING.md` ships AGPL-3.0-or-later, same as protocol. |
| ADR-0005 §3/§4 | Append-only triggers; read-model classification | Consumes: ranking reads current-state tables read-time; `bets.stake` is INSERT-only (existing trigger covers it); no projection table. |
| ADR-0007 | Cache profile | Defers: rendered-page caching for the debate view is ADR-0007 + DEBATE.4, not this ADR. |
| ADR-0008 | Drizzle hot-path patterns | Consumes: per-render lane aggregation may use `sql<T>` template per ADR-0008; builder-vs-raw is SCAFFOLD.2 / DEBATE.4 / DEBATE.8. |
| ADR-0016 | UUIDv7 IDs | Consumes: reply "earlier-wins" tie-break is free — UUIDv7 reply IDs sort by creation time. |
| Tracker | SYNC.4 (this ADR), SYNC.7/8 (SPEC.1 §9 rewrite, SPEC.2 §23 + change-log), DEBATE.4 (debate-view render), DEBATE.8 (`RANKING.md` integration + live computation), SCAFFOLD.2 (lane-aggregation index DDL) | All depend on this ADR being accepted. |

## More Information

- `experiment/docs/specs/RANKING.md` — model specification under SYNC.7/8 rewrite (modes, Top lanes + relative-margin + floor, graceful degradation, gravity, reply rule, behavioural properties, worked example over MKT-CHESS-01, thresholds).
- `src/lib/ranking.ts` — pure-function implementation (no IO); `src/lib/ranking.config.ts` — tunables.
- SPEC.1 §9 — product surface; **requires same-commit rewrite** in SYNC.7/8 (drop friendly-fire-as-input; introduce modes + Top + four per-side signals; reply stake-order).
- SPEC.1 §16.1 — `REPLY_DEPTH_MAX = 1` (consumed, unchanged).
- SPEC.1 §8 F-COMMENT-6 — friendly-fire mechanic (now display-only w.r.t. ranking).
- SPEC.2 §23 — ADR Index (ADR-0017 entry; ADR-0009 → superseded).
- ADR-0009 — superseded predecessor (single-function ranking lock).
- Hacker News story-ranking formula — `(points − 1) / (age_hours + 2)^1.8` — gravity-term lineage for the decay shape.
- SYNC.4 chat record (2026-05-31) — the reframe (no approval axis; contestation as signal), the four-quadrant analysis, the C-vs-n arena distinction (resolution vs visibility) resolved by mandatory commentary, and the decisions ledger from which this ADR is written.

---

*ADR-0017 supersedes ADR-0009 and ratifies a multi-mode ranking model: a fixed multi-lane "Top" default (dominate any lane by a relative margin over second place, all lanes equal including stake), single-axis filter modes (Most Debated, Highest Stakes, Contested, Newest; Surging deferred to v1.x), and reply ranking by stake within side (depth = 1). The model shape, lane set, margin shape (ratio-to-#2 above an activity floor), design-intent mode order, and behavioural properties are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy. Specific numeric values (`k_lane`, `floor_lane`, `c`, `g`, Surging window) defer to the 2026-09-01 number-tuning pass and pin in `RANKING.md` before public launch. The ranking carries no anti-capital logic by design — K · n > C is upheld by the mandatory-commentary floor operating in the open, not by ranking-level suppression of capital.*
