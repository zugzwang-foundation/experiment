# DESIGN.W2.6 — Dharma Graph Prototype — Close-Out & Record

**Status:** Look **LOCKED** · prototype complete · production integration pending
**Date:** 2026-06-25
**Lane:** DESIGN (Wave 2)
**Artifact:** standalone throwaway prototype at `~/code/zugzwang/graph-prototype/` — outside the `experiment` repo, synthetic data, no PR, not git-tracked.

---

## 1. What this was

A standalone, throwaway **coded** prototype (Vite 8 + React 19.2.4 + TS 6 + Tailwind v4; hand-rolled SVG; d3-scale + d3-shape for math only) built to **lock the look and interaction of the MARKET graph before writing the production spec**. It used synthetic data only and lived deliberately outside the production repo so it sat clear of the "no code before a spec" gate. The `chart/` + `data/types.ts` layers are written to **file-copy** into the production Next.js 16 app later; everything else is disposable scaffold.

The throwaway has now done its job: the look is locked, and this document is the canonical record the production spec is written from.

---

## 2. Scope outcome

- **BUILT & LOCKED:** the **market** graph — a lines-only placeholder card that expands to a full-page graph, and the node primitive.
- **PARKED (decisions locked, build deferred):** the entire **profile** graph (see §8).
- **Market and profile are now SEPARATE efforts** — ruled during this session to stop drift between the two.

---

## 3. The locked node

A **solid grey inner disk** surrounded by a **black/white side-split ring**. (This replaced an earlier whole-circle pie; the always-visible grey core was also the fix for black-on-black legibility — mostly-black YES nodes were vanishing on the black YES line.)

- **Grey core** = the post author's **own** stake (`authorStake`). Solid grey — monochrome only. This grey is the **brand-accent slot**: recoloured in code at the brand pass, never in design.
- **Outer circle radius** = the **total pool** = `authorStake + supportDharma + counterDharma`.
- **The ring** (inner edge → outer edge) = the **crowd's** YES/NO split, **author excluded**:
  - YES post: `crowdYes = supportDharma`, `crowdNo = counterDharma`
  - NO post: `crowdYes = counterDharma`, `crowdNo = supportDharma`
  - `blackFraction = crowdYes / (crowdYes + crowdNo)` — **BLACK = crowd YES-money, WHITE = crowd NO-money. Colour always means SIDE**, never support/counter.
- **Honest area (locked, proven):** inner and outer share **one `scaleSqrt` anchored at 0**, so `area(inner)/area(outer) = authorStake/totalPool` exactly. The core's size is a truthful fraction of the pool.
- **Start angle:** 12 o'clock, clockwise.
- **Hairlines:** 1px inner-disk edge, 1px ring dividers on the two wedge radii, 1px outer stroke.
- **Edge guards:** `blackFraction` 0 or 1 → single-tone full ring (no zero-width wedge); **empty-crowd** (`support = counter = 0`) → grey core + outer hairline only.

**Reading:** core size = how hard the author backed it · ring split = how the crowd divided · which line it sits on = the post's own side (frozen at post-time).

---

## 4. The locked graph — single view: placeholder + expanded

There is **one** view. (An earlier Daily/Weekly toggle and a two-tier daily/weekly node layering were built and then **removed** — every node is now a full node, and size alone does the visual ranking.)

**Placeholder (collapsed default):** card-sized **YES (ink) / NO (grey)** probability lines on a clean axis — **no nodes, no stems, no vertical lines**. The **whole card is clickable**. Placeholder x-axis shows **exactly two labels: Sep 15 and Nov 5** (window endpoints only).

**Expanded (click the placeholder):** opens as a **fullscreen overlay** (React state toggle, **not** a route). Close via **X / Escape / backdrop**.
- Full-window **Sep 15 → Nov 5 2026** YES(ink)/NO(grey) lines.
- **One top post per (day, side)** as a full node — top YES post → node on the YES line, top NO → node on the NO line. **~46 nodes per side (~92 total).** Nodes sit at the **day's x** on their side's line (on-curve at the day vertex), **no snap stems**.
- **Clean axis:** weekly date labels + endpoints; **no vertical lines, no daily ticks**. (The thin dividers *inside* each node's ring are the node design, not axis clutter.)
- **"Top post" = a DUMMY swappable selector** — arbitrary/representative, *not* any real ranking. The real ranking is a **one-function replacement** (see §6).

---

## 5. Final tuned values — PROTOTYPE REFERENCE (re-tune absolutes in production)

These were tuned on-screen against the prototype's standalone full-page canvas at a 1920×1080 display. **The relationships and ratios carry; the absolute pixel values are a starting reference, not a hard spec** — production re-tunes against the real container/page.

| Value | Prototype setting | In production |
|---|---|---|
| Node clamps (expanded) | `R_MAX 22, R_MIN 3, INNER_MIN 2.5, MIN_HIT 15` | Re-tune to the real container; **keep scale anchored at 0** |
| Radius scale | `scaleSqrt().domain([0, maxPool]).range([0, R_MAX])`, floors applied **after** the scale | **Hard rule — preserve** (this is what keeps area honest) |
| Expanded overlay size | live = `innerW − 48 × innerH − 48`, 24px inset; ref 1872×1032 @ 1920×1080 | Fit the real layout |
| Node count | 92 (46 YES on ink line, 46 NO on grey line); 1 empty-crowd; 9 floored at R_MAX 22 | Follows real data |
| Grey core token | `--color-core = oklch(0.72)` (provisional) | Becomes the brand-accent token at the brand pass |
| Placeholder axis | 2 labels [Sep 15, Nov 5] | Carry |
| Expanded axis | 9 weekly labels + endpoints | Carry |

**Light overlap where large pools cluster in time is accepted — no collision layout** (deliberate, "keep it simple").

---

## 6. The portable seam — what file-copies to production

**Portable (`chart/` + `data/types.ts`) — copy across, add `"use client"` to leaf chart files, replace the generator with real queries behind the unchanged types:**
- `data/types.ts` — the data contract (`Post` carries `authorStake / supportDharma / counterDharma / side / postedAt / marketId / authorId`; `MarketData` carries the probability `series`; profile types retained **unrendered**).
- `chart/geometry.ts` — node math: anchored-at-0 `scaleSqrt`, `ringWedges` (annulus), crowd-only `blackFraction`, `interpolateY`, post-scale floors.
- `chart/tokens.ts` — `coreTone()` grey (accent slot) + ring tones.
- `chart/PostNode.tsx` — the node primitive.
- `chart/buckets.ts` — `bucketByDaySide` (+ `utcDayFloor`).
- `data/select.ts` — **`selectTopPost` — the DUMMY ranking swap seam. The real ranking replaces this one function.**
- `chart/scales.ts`, `ChartFrame.tsx`, `Axes.tsx`, `PriceLines.tsx`, `MarketChart.tsx`.

**Disposable scaffold (do not port):** `App.tsx`, `GraphOverlay.tsx` (chrome), `data/generate.ts` + `rng.ts` (synthetic data), `scripts/`.

---

## 7. The node → replies contract  *(the first production-integration task)*

**Clicking a node navigates to that post's replies page** — the **DESIGN.5 two-column YES/NO debate surface** (already built and locked).

- The node **already carries its post identity**; the click is a **wired no-op in the prototype** only because the replies page lives in the **production** app, not in this throwaway — there was nothing in the prototype to navigate to.
- **In production:** the click handler uses the post id the node already holds and navigates to that post's replies surface. Small addition — no re-architecting.
- This is the **first behaviour to wire when the graph is integrated** into the production app.

---

## 8. Parked — the profile graph (decisions locked, build deferred)

Deferred to a separate later effort, with decisions **kept locked**:
- The **held-side line** (Correction B — each market draws the user's held-side curve, breaking at every exit).
- **Flip break-rendering** (options A–E — undecided, was a Phase-3 checkpoint).
- **≤8 per-market monochrome treatments** (shade / weight / dash).
- The **market filter** (isolate one market).
- **`ProfileView`** itself.

**Profile-supporting data types (`SideEpisode`, `UserMarketParticipation`) are kept in the contract, unrendered** — so the profile graph resumes later without re-adding data.

---

## 9. Key decisions & learnings

- **Area-honesty fix (reusable principle).** The honest-area lock (Correction C) collided with the size clamps. Resolved by keeping the radius scale **anchored at 0** (`range [0, R_MAX]`) and applying the min-size floors **after** the scale — *not* as the range minimum, which would shift the whole scale and inflate small cores (a true ~17% core would render ~29%). Anchored-at-0 + post-scale floors keeps `area(inner)/area(outer) = stake/pool` exact for every non-floored node.
- **Node redesign solved legibility.** The grey core + crowd ring replaced an original whole-circle pie specifically because the always-visible grey core rescues mostly-black YES nodes that otherwise vanished on the black YES line.
- **Decision evolution (for the spec author):** node → side-split → grey core + crowd ring (author excluded); views → bucketing → Daily/Weekly toggle → collapsed to single placeholder+expanded, per-(day,side) nodes, two-tier removed; axis → endpoints+weekly+daily ticks → clean (no verticals) → placeholder reduced to 2 labels.
- **Not git-tracked.** The prototype has no `.git`. **Recommend `git init` + an initial commit** before production work, to snapshot the look-locked state (a cleared session already proved the on-disk plan + code is the real source of truth; a snapshot adds a safety net).

---

## 10. What's next

1. **Write the production spec** for the market graph from this record (the throwaway is done).
2. **Build the production component** — file-copy `chart/` + `data/types.ts` into the Next.js app, add `"use client"`, replace the generator with real queries behind the unchanged types.
3. **node → replies navigation** = the first integration behaviour (§7).
4. (Recommended) `git init` the prototype to snapshot the locked state.
5. Eventually: the **profile graph** (§8) and the **real ranking** swapped into `selectTopPost` (§6).

---

## 11. PK update

| File | State | Action | Reason |
|---|---|---|---|
| `DESIGN-W2.6-graph-prototype-record.md` (this) | NEW | **ADD to PK** | Canonical record of the locked market-graph look + node→replies contract; the input to the production spec |
| `tracker_v14.html` | EXISTING | **UPDATE (operator)** | Mark DESIGN.W2.6 prototype **look-locked**; market-graph spec + production component now the open items; node→replies = first integration task |
| `DESIGN-phase-record.md` | EXISTING | **VERIFY / add entry** | Add a W2.6 entry pointing to this record |
| Production market-graph spec | — | **TO WRITE (next)** | Write from this record before building the production component |
| `PLAN.md` (in the prototype dir) | ON DISK | **KEEP** | Lives with the throwaway; not in PK; canonical for the prototype itself |
