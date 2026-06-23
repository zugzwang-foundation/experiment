# RANKING.md — Zugzwang Debate-View Ranking Model

| | |
|---|---|
| **Status** | v1.0.0-draft (shape locked; numeric constants pin at the 2026-09-01 number-tuning pass) |
| **License** | AGPL-3.0-or-later — © The Zugzwang Authors |
| **Authoritative ADR** | ADR-0017 (Ranking Modes & the "Top" Composite) — supersedes ADR-0009 |
| **Patch records consumed** | ADR-0017 P1 (friendly-fire removed entirely), P2 (latest interleave), P3 (filter modes retired from the v1 surface; lane-dominance badges) |
| **Companion specs** | SPEC.1 §9 (product surface), SPEC.2 §5.4 (read-model classification + the four aggregates) |
| **Implementation** | `src/lib/ranking.ts` (pure TypeScript, no IO) · `src/lib/ranking.config.ts` (tunables) |
| **Authored at** | DEBATE.8 |

---

## §0 — Status & the number-tuning rule

This document specifies the **shape** of the ranking model: the lanes, the margin form, the modes' formulas, the reply rule, the interleave, the badges, the decay form, and the behavioural properties. Per the project number-tuning rule, **specific numeric values are not set here** — every constant (`k_lane`, `floor_lane`, `floor_split`, `c`, `g`, `LATEST_INTERLEAVE_INTERVAL`) is a **named placeholder**, pinned against dogfooded markets at the number-tuning pass (target **2026-09-01**) and locked in §12 before public launch. This file goes from `v1.0.0-draft` to `v1.0.0` when those placeholders are pinned. No value in this file is load-bearing until then; the **shapes and design-intent orderings are immutable** and change only via a new ADR with a same-commit SPEC update.

The model is **open-source** (AGPL-3.0-or-later, same license as the protocol). Anyone may read it and optimise against it. Zugzwang does not defend ranking by secrecy — the thesis-level defence is **mandatory commentary** operating in the open (ADR-0017 Driver 2), not a hidden function. **The ranking carries no anti-capital logic.** All lanes compete on equal terms, stake included.

---

## §1 — Scope, purpose, and surfaces

### 1.1 What this models

A **deterministic, universal, read-time-computed order** for the posts and replies in a debate, plus the **lane-dominance badge** each prominent post carries. "Universal" = the same order for every reader at the same moment (no personalisation, no per-reader feature vectors, no A/B). "Read-time-computed" = no projection table, no `ranking_snapshots`, no materialised view, no cached score column; the order and the aggregates are computed against live `comments` + `bets` rows on every render (ADR-0005 §4 / SPEC.2 §5.4).

### 1.2 Thesis relevance

Ranking is a propagation surface for the **K-side** of `K · n > C`: it shapes which arguments accumulate the informed, staking participation that drives a market. There is **no quality verdict** on a post — a Support reply-bet and a Counter reply-bet are *both* contributions, so **contestation is signal, not noise** (the inverse of the Hacker-News stance, which detects controversy to suppress it). The fight is the product.

### 1.3 The surfaces this model orders

| Surface | What is ordered | Order applied |
|---|---|---|
| **Market detail — posts** | The market's top-level posts (one pool) | **Top** (§3) + the **latest interleave** (§4); each dominating post wears one **badge** (§5) |
| **Market detail — replies** | Replies under each post | **Reply ranking** (§7): stake-descending within side, depth-1 |
| **Profile — a user's arguments** | One author's posts (and replies) across markets | **Profile ordering** (§3.6): simplest lens; *not* full Top; *no* interleave |

The model is **surface-agnostic at its core**: `ranking.ts` ranks whatever post set it is handed. The market-detail and profile callers differ only in (a) which posts they pass in and (b) which ordering variant they request.

### 1.4 What this model is NOT

It is **not** the debate-view UI (visual treatment, the badge rendering, mobile layout) — that is ADR-0012 / DEBATE.4. It is **not** an audit event — nothing is stored; researchers reconstruct any historical order on demand from the public dataset. It carries **no anti-capital clause**, **no thesis-defence special-casing**, and **no friendly-fire input** (the friendly-fire vote is removed entirely — ADR-0017 P1; there is no `friendly_fire_events` table and no `↑N ↓M` count).

---

## §2 — The per-side data model (the substrate)

Every top-level **post** exposes **four base signals**, tracked per side, plus its age and the author's own stake. These are the substrate for every order and every badge. Per-side separation is mandatory — it is what makes the value-vs-volume contrast expressible.

| Signal | Definition | Source |
|---|---|---|
| `support_count` | number of reply-bets on the post's **own** side | reply-bets joined to the post, counted where reply side = post side |
| `counter_count` | number of reply-bets on the **opposing** side | reply-bets joined to the post, counted where reply side ≠ post side |
| `support_dharma` | total Dharma staked across **support-side** reply-bets | `SUM(bets.stake)` over support-side reply-bets |
| `counter_dharma` | total Dharma staked across **counter-side** reply-bets | `SUM(bets.stake)` over counter-side reply-bets |
| `age` | `now − created_at`; `now` frozen to the resolution timestamp for resolved markets (INV-4) | `comments.created_at`, `now` parameter |

Derived quantities used throughout:

```
n   = support_count  + counter_count          // VOLUME    — informed participation (thesis n)
D   = support_dharma + counter_dharma          // VALUE     — committed Dharma (capital-like axis)
b   = min(support_count, counter_count)
      / max(support_count, counter_count)       // BALANCE   — 0 (blowout) … 1 (dead even); undefined iff n = 0
lop = 1 − b                                     // DOMINANCE — inverse of balance
a   = the author's own stake on the post        // author conviction; read from the post's own entry bet
```

### 2.1 Read-time join (how the substrate is computed)

The four aggregates derive **entirely from existing columns** — `bets.stake`, `bets.side`, `comments.side_at_post_time`, `comments.parent_comment_id`. There is **no frozen `stake_at_post_time` column** (the superseded ADR-0009 model used one; this model does not need it — value is aggregated from reply-bets at read time).

A reply's stake lives on its **bet row** (`bets.stake`), not on its comment row. The comment↔bet link is the circular pair: `bets.comment_id` is **NOT NULL and populated**; `comments.bet_id` is **deliberately NULL** (structurally — the comment is inserted before its bet exists, and the append-only discipline forbids back-filling it; INV-1 is enforced via `bets.comment_id` NOT NULL + transaction atomicity, see SPEC.2 §14.1). Therefore the aggregation join runs **`bets → comments` via `bets.comment_id = comments.id`**, never via the empty `comments.bet_id`.

- **Per-side grouping** (the four signals) groups a post's reply-comments by `(parent_comment_id, side_at_post_time)` — served by the index **`comments_ranking_idx (parent_comment_id, side_at_post_time)`**.
- **Dharma sums** reach each reply's stake through **`bets.comment_id`** — served by the index **`bets_comment_id_idx (comment_id)`**.

Both indexes already exist (initial schema). **Support vs Counter** is determined at read time: a reply-bet is *Support* when its side equals the parent post's `side_at_post_time`, *Counter* otherwise. **Author stake `a`** reads the post's own entry bet (the bet the post itself rides).

See §11 for the full read-time / performance contract.

---

## §3 — Top: the default order

**Top is the one fixed default order** of the market-detail post list. It is **not an average**. A post earns a high position by **decisively dominating any one lane** — being far ahead of the *second-place* post **in that same lane**. Winning a lane narrowly does not earn a badge; *dominating* it does. Different *kinds* of heavyweight surface simultaneously, each through its own lane. The model never adjudicates which lane "matters" — that is the point.

### 3.1 The lanes (all equal — none suppressed, stake included)

| Lane | Quantity ranked | What it surfaces |
|---|---|---|
| **Traction-dominance** | `n` | A post overwhelmingly more debated than the field — the crowd has converged here |
| **Stake-dominance** | `D` | A post with overwhelmingly more committed Dharma than the field — capital has spoken loudly, and its argument surfaces for public scrutiny |
| **Dominance-split** | `lop`, gated by `n ≥ floor_split` | A post one side has *decisively won*, on meaningful volume — a settled-but-significant debate |

There is **no anti-capital clause**: stake-dominance is an admissible Top lane on fully equal terms. The multi-lane structure ensures stake-dominance *qualifies* a post without *monopolising* Top — traction- and split-dominant posts qualify through their own lanes simultaneously. The thesis is adjudicated by commentary in the open, not by ranking-level suppression.

### 3.2 The margin: ratio-to-second-place, above an absolute floor

A post's standing in a lane is measured as a **ratio to the second-place post in that lane** — "this post has 3× the next post's stake." Ratio is chosen over a z-score / distance-from-pack measure for **legibility**: a non-technical reviewer can audit "3× the next post" at a glance; a standard-deviations measure is statistically defensible but opaque, and legibility is weighted higher for an experiment that must be learned from. An absolute **floor** (`floor_lane`) kills the small-number noise that a bare ratio admits (so "2 replies vs 1" does not read as a 2× landslide).

### 3.3 The Top score (the single continuous ordering formula)

> **This section makes explicit the synthesis of two ratified sub-decisions:** the floor + no-competitor-sentinel rule, and the *single continuous order* (no separate "fallback mode", no gate that hides posts). One formula produces both clear-winner ordering and graceful degradation.

For each post and lane, compute a **qualified margin**:

```
qualified_margin(post, lane):
    v  = lane_value(post, lane)                 // n, D, or lop
    if v < floor_lane(lane):
        return BELOW_FLOOR                       // sorts below every real ratio (noise-kill, §3.2)
    v2 = lane_value(second_place_post_in_lane)   // among posts that clear the floor in this lane
    if there is no qualifying second place (v2 == 0):
        return SENTINEL_MAX                       // dominated an empty field, above the floor
    return v / v2                                 // a real ratio ≥ (typically) ~1

Top_score(post) = max over the three lanes of qualified_margin(post, lane)

order: Top_score descending, with the tie chain in §3.4
where, for sorting:   BELOW_FLOOR  <  1  <  any real ratio  <  SENTINEL_MAX
```

Notes that make this precise and reproducible:

- **`SENTINEL_MAX` means "ranks above every finite ratio," not a large magic number.** A genuine 500× landslide must not accidentally outrank a true sole leader; encode the sentinel as a rank class above all finite ratios, broken among co-sentinels by §3.4. (`+1`-cushion denominators — `v / (v2 + 1)` — were considered and rejected: they muddy the legible "3× the next post" story and still need a floor.)
- **The dominance-split lane** ranks `lop`. Its floor (`floor_lane(split)`) is a minimum-lopsidedness threshold, and it is additionally gated by `n ≥ floor_split` so a 2-vs-0 post cannot read as maximal lopsidedness — lopsidedness only counts on meaningful volume.
- **Graceful degradation is automatic.** When no post dominates any lane (early or sleepy market), every post's `Top_score` is its best *real* ratio (or `BELOW_FLOOR`), and the order degrades smoothly from "landslide winners" to "the nearest thing to one" to "the cold-start order." **Top never renders empty.** A single loud voice in an otherwise-empty market legitimately tops Top — that is honest, not a capital exploit (ADR-0017 Driver 2).
- **All-sub-floor markets** (every post below every floor) order purely by the §3.4 tie chain — i.e. by **author conviction `a`** first. This is the cold-start seed in action (§8): a high-conviction new post is never invisible.

### 3.4 Ties — author stake, then earlier-wins

When two posts share a `Top_score` (including co-sentinels and all-sub-floor posts), order by:

1. **Author stake `a`** — higher conviction ranks higher;
2. then **earlier-wins** — the earlier-posted post ranks higher (first-posted, by `created_at`; UUIDv7 IDs make this a free natural sort per ADR-0016).

Earlier-wins (not newer-first) is chosen to keep **every tie-break in the system uniform** with the reply rule (§7) and to preserve the audit-stable property: a resolved market's frozen order never shifts as clocks tick. Ties on a continuous ratio are rare regardless.

### 3.5 No fade on Top (the decay decision ADR-0017 left open)

**Top ranks on current lane values — it does not apply the time-decay (gravity) term** that the computed modes use (§9). This is the call ADR-0017 explicitly deferred to `RANKING.md`. Two reasons:

1. **Freshness is already handled** by the latest interleave (§4), which injects new posts into Top by *position* — so Top's ranking does not also need a fade to surface recency.
2. **Legibility.** Top's whole value is the auditable "3× the next post" ratio; a *faded* ratio cannot be eyeballed.

A deliberate consequence, stated plainly: a signal like reply-volume `n` is **faded** in the (computed-but-unexposed, §6) "Most Debated" lens but **raw** in Top's traction lane. This is intentional — **Top is a "biggest right now" snapshot; the lenses are "sustained-leader" views.** The stale-blowout edge (an old, dead, lopsided post resurfacing in the split lane) is handled by gating split on `n` and by the degradation pressure; whether the dominance margin should carry its own decay term is **recorded as a named option for the 2026-09-01 tuning pass** (§12), to be added only if dogfooding shows stale blowouts resurfacing.

### 3.6 Profile ordering (a user's arguments — the simplest lens)

When a visitor views a user's profile, that user's arguments are listed in ranking order — but the **simplest** form of it, not the full market-relative Top (which compares posts *within one market* and behaves oddly on a small cross-market profile pool). The profile order is:

1. The user's **top-level posts**, ordered by the **value signal `D`** (total Dharma the post attracted, `support_dharma + counter_dharma`), descending; then
2. the user's **replies**, ordered by **their own stake** (the reply-bet's `bets.stake`), descending;
3. **posts above replies** in the combined list.

Posts and replies are measured on different rulers by design (a post is ranked by what it *attracted*; a reply is a leaf that attracts nothing, so its only signal is its own stake) — hence replies always sit below posts. The order is **viewer-independent** (the same for the owner and any visitor; the owner additionally sees their own SELL controls layered on, a UI concern, not an ordering one — ADR-0017's "same order for every reader"). The **latest interleave does NOT apply** to the profile — a profile is a body of work, not a live market feed, so the momentum-burial problem (§4) does not arise.

---

## §4 — The latest interleave (ADR-0017 P2)

### 4.1 The problem it solves

Top's lanes (`n`, `D`, `lop`) are all **accumulation** signals — a post scores by what it has *already* attracted. A brand-new post has none yet, so it starts at the bottom; being unseen, it attracts no reply-bets, so it *stays* at the bottom — a rich-get-richer visibility trap that suppresses exactly the fresh informed participation (`dn/dt`) the thesis depends on. Gravity (§9) decays *old* posts but does nothing for *new* ones. The interleave is the deterministic, dataset-safe mechanism that gives new posts a guaranteed slot in every reader's view.

### 4.2 The rule

In the **Top** order **only**, after every `LATEST_INTERLEAVE_INTERVAL` ranked posts, the next position is filled by the **newest post (by `created_at`) that has not already appeared higher in the list**; ranking then resumes.

```
build_top_list(posts):
    ranked  = posts sorted by §3 (Top_score, ties §3.4)
    shown   = []
    while posts remain to place:
        emit the next LATEST_INTERLEAVE_INTERVAL not-yet-shown posts from ranked → shown
        if any not-yet-shown post remains:
            latest = the not-yet-shown post with the greatest created_at
            emit latest → shown                    // exactly ONE latest post (§4.3)
    return shown
```

### 4.3 The fixed rules of the interleave

1. **Top-default only.** Applies to Top on the market-detail post list and nowhere else — **not** the computed modes (§6), **not** the profile (§3.6).
2. **One-at-a-time.** Exactly one latest post is injected per cadence point — never a batch — for maximum predictability and reproducibility.
3. **No duplication.** The ranked order is the spine; at each cadence point the injected post is the newest **not-yet-shown** post. Every post appears **exactly once**. A post that would naturally rank within the first `LATEST_INTERLEAVE_INTERVAL` positions is not re-injected as a latest slot.

### 4.4 Why this is consistent with "fixed, not shuffled"

ADR-0017 locked "the default is fixed, not shuffled" to forbid **non-determinism** (per-load shuffle, per-reader variation), which destroys legibility and corrupts the experimental dataset. The interleave introduces **no non-determinism**: the injected position is a deterministic function of `created_at` over the current post set, **identical for every reader at a given moment**, and fully **reproducible** by replaying this model over the public dataset. The freeze at resolution is inherited unchanged (INV-4) — a resolved market's interleaved order is as immutable and replayable as its ranked order. The legibility concern is preserved: the rule is a single published sentence ("every Nth slot is the newest unshown post"), not a hidden weight. The interleave therefore **refines** the fixed default; it does not reopen the anti-shuffle decision.

---

## §5 — Lane-dominance badges (ADR-0017 P3)

In v1 there is **no sort-mode selector**. The market-detail page is **always** in Top order (§3 + §4). In place of a selector, each post that **dominates a lane** is rendered with a single **lane-dominance badge** naming that lane — minimum reader interaction, attention on the arguments.

### 5.1 The badge rule

1. A badge is a **read-time label** computed by `ranking.ts` from the same lane values it already computes for Top. It is **not** stored, **not** a ranking input, and adds **no** schema, column, or event type — identical read-time posture to the order and the four aggregates.
2. A post is badged **only if it dominates a lane** — i.e. its best `qualified_margin` (§3.3) clears `k_lane` *and* the lane value clears `floor_lane`. Posts that dominate no lane (the majority) carry **no badge**.
3. A badged post carries **exactly one** badge — the lane of its **highest margin** (its single strongest dominance). This is the same lane that earns the post its Top position, so the badge and the ordering are **consistent by construction**.

### 5.2 The badge vocabulary (three lanes)

| Badge | Lane | Meaning |
|---|---|---|
| **Most Debated** | traction (`n`) | the most replies — sheer volume of argument |
| **Highest Stakes** | stake (`D`) | the most Dharma committed — value at risk |
| **Contested** | dominance/split lens (`n^b`) | big **and** evenly split — a live cliffhanger |

**"Newest" is not a badge** — recency is a *position* fact surfaced by the interleave (§4), not a lane a post "wins." (If a "🆕 New" tag on interleaved posts is wanted later, it is a clean UI addition that requires no model change — out of v1 scope unless reopened.)

> A naming note carried on the record: **"Contested," never "Controversial."** Hacker News uses "controversial" to mark threads it wants to *suppress*; Zugzwang treats contestation as the live signal it surfaces. The word choice encodes the thesis.

### 5.3 Modes computed, not exposed

The single-axis lenses (§6) still **compute** — they are how the lane values and the Contested signal are derived for the badges — but they are **not reader-selectable** in v1. The full mode machinery is preserved in the model for reintroduction at testnet+ as a **UI-only** change requiring no model rework.

---

## §6 — Filter modes (computed; not exposed in v1)

These are the single-axis lenses Top composes from. In v1 they are **computed but not surfaced as reader-selectable sorts** (§5.3). Their formulas are specified here because they define the lane values and the Contested signal, and because they are the testnet+ reintroduction contract.

| Mode | Order | Time-decay (§9) |
|---|---|---|
| **Most Debated** | `n` descending | yes (gravity) |
| **Highest Stakes** | `D` descending | yes (gravity) |
| **Contested** | `n ^ b` descending | yes (gravity) |
| **Newest** | `age` ascending (pure chronological) | no — time *is* the sort |
| **Surging** *(v1.x — deferred)* | recent-window activity rate descending | no — the window *is* the recency |

### 6.1 Contested (`n ^ b`) and its zero-reply edge

`n ^ b` floats a big *and* even post toward its full magnitude (`b ≈ 1`), collapses a lopsided blowout toward `1` regardless of size (`b → 0`, so `n^0 = 1`), and keeps a tiny even post small (small `n`). It isolates the live-cliffhanger corner.

**The zero-reply edge (the one true gap):** `b = min/max` is **undefined when `n = 0`** (`0 ÷ 0`). The rule:

```
contested_score(post):
    if n == 0:  return 0          // a zero-reply post has no debate → honest Contested score is 0;
                                   // this guard also avoids the 0^undefined trap
    return n ^ b                   // n ≥ 1 ⇒ b is defined in [0, 1]
```

Zero-reply posts (all scoring `0`) order **among themselves by the author's own stake `a`** — the same cold-start seed every order uses (§8). A *fully one-sided* post is **not** an edge case: `b = 0`, so `n^b = n^0 = 1`, correctly sunk near the bottom. Excluding zero-reply posts from Contested was considered and rejected — a mode where some posts silently vanish is surprising and harder to audit.

### 6.2 Mode-presentation order (retained on record, not active in v1)

With no selector in v1 this ordering is dormant, but it is retained for a future surface that reintroduces selectable modes, because it encodes the thesis stance: **Top → Most Debated → Highest Stakes → Contested → (Surging) → Newest**. Most Debated (`n`) is placed *before* Highest Stakes (`D`) deliberately, signalling participation's primacy over capital.

---

## §7 — Reply ranking (depth = 1) — by stake, within side

`REPLY_DEPTH_MAX = 1` (flat replies, locked — SPEC.1 §16.1 / ADR-0017). With flat replies the other axes do not exist at the reply level: a reply has no children, so **no traction and no split**; a reply *is* a bet, so **stake is the only signal it emits**. The reply metric is therefore not a *choice* — it is the only rankable number a flat reply carries.

```
reply ranking (depth = 1):
  1. Partition replies by side (Support pool, Counter pool — relative to the parent post's side).
  2. Within each side, sort by reply stake (Đ, = bets.stake) descending.
  3. Tie-break: earlier posting time wins at equal stake (first-posted ranks higher; UUIDv7 natural order).
  4. The two-slot debate-view default surfaces the TOP reply of EACH side;
     a "show all replies" affordance expands each side's full stake-sorted list.
```

### 7.1 Two-slot edge cases

- **One side has no replies:** render the two best from the other side.
- **Only one reply exists:** render it, with no expansion affordance.
- **Zero replies exist:** render no reply widget.

### 7.2 The conceded reply-level tension (recorded, accepted)

With depth = 1, stake is the only signal a flat reply emits, so **the reply ranking is purely the C-axis** — a high-Đ reply outranks many small informed replies on the same side, every time. This is a direct `C > n` outcome *inside* a system whose headline is `K · n > C`. It is an **accepted consequence** of the depth-1 + no-free-votes decisions, recorded here so the contradiction is on the record, not discovered later. It is **narrow** — it lives only at the reply level inside a single post; the post-level model (§3, §6) carries the thesis at the level that matters for which debates assemble. The **reply floor** (`BET_MIN_STAKE_REPLY = 50`, ADR-0018) is the parameter-level lever that compresses this tension. The `n`-bearing alternatives — nesting (depth > 1) and stake-backed "backing" micro-bets — were considered and rejected for experiment scope; reconsider only if depth > 1 is reintroduced via a future ADR.

---

## §8 — Author stake (`a`) — seed and tiebreaker, not a mode

`a` (the author's own stake on the post, read from the post's entry bet) is **not** a mode. It plays two roles:

- **Cold-start seed.** A brand-new post with zero replies has no `n` and no `D`, so it is ordered by author conviction `a` until reply-bets arrive and the real lane values take over (operationally: such a post is `BELOW_FLOOR` on every lane in §3.3, so the §3.4 tie chain — `a` first — orders it). A high-conviction new post is never invisible.
- **Tiebreaker.** When two posts tie on an order's metric, higher `a` wins, then recency (§3.4).

---

## §9 — Shared time-decay (gravity)

The computed modes Most Debated, Highest Stakes, and Contested rank quantities that only *accumulate* (`n`, `D`, and `n`-derived) — left raw, the oldest post wins forever for merely existing longest. They share an HN-style gravity term so a post must *keep* attracting activity to hold position:

```
ranked_score = raw_signal / (age + c) ^ g          // c, g → number-tuning pass (§12)
```

- **`age` is measured in hours** (the Hacker-News lineage: `(points − 1) / (age_hours + 2)^1.8`).
- **The fade applies to each mode's final signal** — `n`, `D`, or `n^b` — *after* the signal is formed (`(n^b) / (age+c)^g`, **not** `(n / (age+c)^g)^b`). Applying gravity to the final signal keeps the decay term **identical across all three modes** (one shared function, applied once) — which is exactly what "they share a gravity term" means.
- **Newest is exempt** (time *is* its sort). **Surging is exempt** (it reads only a recent window). **Top is exempt** (§3.5) — it ranks on current lane values; the interleave handles its freshness.

---

## §10 — Determinism, freeze-at-resolution, auditability

- **One deterministic order per moment.** No personalisation, no per-reader feature vectors, no production A/B, no per-load shuffle. The same order for every reader at the same moment, including the interleave (§4.4).
- **Freeze at resolution.** The model takes a `now` parameter; for resolved markets `now` = the resolution timestamp. The rendered order (and every aggregate, badge, and interleave position) at that moment becomes permanent (INV-4). Auditors must reproduce the exact rendered order at any past resolution moment.
- **Auditability.** Every input (`bets.stake`, `bets.side`, `comments.side_at_post_time`, `comments.parent_comment_id`, `comments.created_at`, the author's entry bet) is reconstructible from the 2026-11-06 public dataset. Any historical order — Top, any computed mode, and the interleave — is bit-exact reproducible by replaying this published model over the historical inputs.

---

## §11 — Read-time computation & performance

### 11.1 No projection table

Per ADR-0005 §4 / SPEC.2 §5.4: **no `ranking_snapshots` table, no per-poll history, no materialised scored-comment view, no cached score column on `comments`.** Lane aggregates and per-post scores compute against current-state tables on every debate-view render. Per-post compute is O(1) and IO-free; lane aggregation is a bounded set of SQL aggregates per render.

### 11.2 The indexes the model relies on

| Read | Index | Status |
|---|---|---|
| Per-side grouping of a post's reply-comments (`support_count` / `counter_count`, and the per-side partition of the Dharma sums) | **`comments_ranking_idx (parent_comment_id, side_at_post_time)`** | Exists (initial schema). **Must survive** — PRECURSOR.4 lock. **This is the live index the ADR-0017 model needs; it is NOT dropped by DEBATE.8.** |
| Reaching each reply-bet's `stake` / `side` from its comment (the Dharma sums) | **`bets_comment_id_idx (comment_id)`** | Exists (initial schema) |

> **Index disposition (carried from PRECURSOR.4):** the DEBATE.8 migration drops **only** the dead `comments.stake_at_post_time` column. It does **not** drop `comments_ranking_idx` — that index was tagged "ADR-0009 vestigial" by an earlier tracker assumption, but the new model groups on the same `(parent_comment_id, side_at_post_time)` key, so it is load-bearing for the per-side aggregation. Dropping it would deoptimise the debate hot path.

### 11.3 A possible covering index (tuning-pass profiling call)

Whether the Dharma sums benefit from a **covering index** on `bets(comment_id)` that *includes* `stake` and `side` (making the per-side sum index-only) is a **profiling call**, settled when `ranking.ts` is implemented and measured against dogfooded data — **not** provisioned here. The SCAFFOLD.2 "lane-aggregation index" deliverable named a dedicated `*_ranking_indexes.sql` migration that was never minted; its index *content* is already satisfied by the two indexes above, so the named file is not needed unless profiling motivates the covering index.

### 11.4 Query implementation

Per ADR-0008, the per-render lane aggregation may use a typed `sql<T>` template on the hot path; builder-vs-raw is a DEBATE.8 implementation call inside plan-mode. `ranking.ts` itself is **pure** (no IO, no DB calls) — it receives the aggregated per-post substrate and returns the order + badges; the SQL aggregation that feeds it lives at the query layer.

---

## §12 — Tunable constants (placeholders → pinned 2026-09-01)

All values below are **named placeholders**. They pin against dogfooded markets at the number-tuning pass (target **2026-09-01**) and lock here before public launch. `src/lib/ranking.config.ts` carries the runtime values; this file carries the pinned canonical values.

| Constant | Role | Value |
|---|---|---|
| `k_lane` (per lane) | dominance ratio that qualifies a post for a Top lane / a badge | **TBD — number-tuning pass** |
| `floor_lane` (per lane) | absolute activity floor below which a lane does not fire (noise-kill) | **TBD — number-tuning pass** |
| `floor_split` | minimum `n` for the dominance-split lane to count (anti 2-vs-0) | **TBD — number-tuning pass** |
| `c` | gravity recency offset (`(age + c)^g`) | **TBD — number-tuning pass** |
| `g` | gravity exponent | **TBD — number-tuning pass** |
| `LATEST_INTERLEAVE_INTERVAL` | ranked posts between latest injections (§4) | **TBD — number-tuning pass** (design intent: ≈ 10) |

**Recorded tuning-pass option (not a constant yet):** whether to add an explicit **decay term to Top's dominance margin** (§3.5), to be introduced *only* if dogfooding shows stale blowouts resurfacing in the split lane.

---

## §13 — Worked example (illustrative; not a product market)

> An abstract illustration of Top, the badges, and the interleave. The posts and numbers are fictional placeholders for explanation only — **not** a real market or resolution question. Constants are shown with illustrative values purely to make the arithmetic concrete; the real values pin at tuning.

Assume a single market's post pool with these computed substrates, and illustrative `floor_lane = 5` (for `n`), `floor_lane = 200` (for `D`), `k_lane = 3`, `floor_split = 6`:

| Post | `n` | `D` (Đ) | `lop` | `a` (Đ) | created |
|---|---|---|---|---|---|
| P1 | 40 | 1,200 | 0.10 | 300 | oldest |
| P2 | 12 | 2,840 | 0.55 | 240 | mid |
| P3 | 9 | 300 | 0.80 | 180 | newer |
| P4 | 2 | 50 | — | 90 | newest |

Lane-by-lane (second place is the next-highest post *that clears the floor* in that lane):

- **Traction (`n`):** P1 = 40, P2 = 12, P3 = 9 clear the floor (≥ 5); P4 (2) is `BELOW_FLOOR`. P1's margin = 40 / 12 = **3.33×** (≥ `k_lane` 3 → dominates). → **P1 badge: Most Debated.**
- **Stake (`D`):** P2 = 2,840, P1 = 1,200 clear the floor (≥ 200); P3 (300) clears too, P4 (50) does not. P2's margin = 2,840 / 1,200 = **2.37×** (< 3 → does *not* dominate, no badge from this lane). P2's best lane is stake at 2.37× — below `k_lane`, so **P2 is unbadged** unless another lane qualifies it (it does not). P2 still ranks by its 2.37× `Top_score`.
- **Split (`lop`, gated `n ≥ 6`):** P2 (`n`=12, lop 0.55) and P3 (`n`=9, lop 0.80) clear the `n`-gate; P4 fails the gate. P3's margin = 0.80 / 0.55 = **1.45×** (< 3 → no badge).

`Top_score`: P1 = 3.33 (its best across lanes), P2 = 2.37, P3 = 1.45, P4 = `BELOW_FLOOR`. **Order: P1, P2, P3, P4.** Only **P1** is badged (**Most Debated**). P4 (the newest, all-sub-floor) sits last, ordered there by the §3.4 chain (author stake, then recency) — and would be the post the **interleave** injects at the first cadence point if the list were longer than `LATEST_INTERLEAVE_INTERVAL`.

*(If P2 also reached, say, 9× on stake while staying even, it would dominate the stake lane and the Contested signal; it could earn a badge — and per §5.1(3) the single badge shown would be its **highest-margin** lane.)*

---

## §14 — Implementation pointers

- **`src/lib/ranking.ts`** — pure TypeScript, **no IO**: receives the per-post aggregated substrate (the four signals + age + `a`, per post) and returns the ordered list (Top + interleave), the per-post badge (or none), and the reply ordering. Importable from server + tests.
- **`src/lib/ranking.config.ts`** — the tunable values of §12 at runtime.
- The **SQL aggregation** that produces the substrate (the `bets → comments` join, the per-side grouping) lives at the query layer (DEBATE.8 / DEBATE.4), not inside `ranking.ts`.
- **Surfaces** call `ranking.ts` with their own post set and ordering variant: market-detail (Top + interleave + badges), profile (the §3.6 simplest order, no interleave).

---

## §15 — Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0.0-draft | 2026-06-23 | HMH (web-authored, founder-ratified) | Initial authoring at DEBATE.8. Specifies the full ADR-0017 model — per-side data model and read-time join; Top (lanes, ratio-to-#2 margin, floor/SENTINEL_MAX, the single continuous ordering formula synthesising the floor + continuous-order decisions, author-stake/earlier-wins ties, no-fade-on-Top); the latest interleave (P2); lane-dominance badges replacing the v1 selector (P3); the computed-but-unexposed filter modes and the Contested zero-reply guard; reply ranking (depth-1, stake-within-side, two-slot edges); author-stake seed/tiebreaker; shared gravity; determinism/freeze/auditability; the read-time/performance contract (keeps comments_ranking_idx); the placeholder-constant table; and an abstract worked example. Numeric constants deferred to the 2026-09-01 number-tuning pass (→ v1.0.0). |
