# DESIGN.W2.6 — Profile Dharma Graph — Prototype Close-Out

**Status:** COMPLETE. Profile graph prototype built across PF1–PF6, all 12 gates green, look locked.
**Scope:** the PROFILE half of DESIGN.W2.6 (the MARKET half closed separately and was untouched here).
**Discipline:** standalone throwaway Vite prototype at `~/code/zugzwang/graph-prototype/`, outside the
experiment repo, synthetic data only, no git, no PR, no backend. Same throwaway-prototype discipline as
the market graph.
**Canonical on-disk record:** `PLAN.md §9` (there is no git in the prototype dir, so §9 *is* the spec/record).
**Date:** 2026-06-26.

---

## 1. What was built (one line)

A profile-slot graph that opens as a clean **net-worth placeholder line**, and on click expands to a
fullscreen overlay carrying a **market filter** (default = Cumulative), a **cumulative net-worth view**
and **single-market position views**, the user's **own post + reply nodes** (R2 rings), and a
**flip/exit marker** at single-market breaks. The "standing made visible" centerpiece.

---

## 2. Phase record (PF1–PF6, all signed off)

| Phase | What it delivered | Sign-off |
|---|---|---|
| **PF1** | Data layer: `SideEpisode.shares` (+ v1-limitation note), the `Reply` notion, net-worth quantity + realistic 0–10,000 spread, `assertProfileRealism` (reconciliation, INV-3, floors). Extended the FLIP/GAP scaffold (Decision X). | ✅ |
| **PF2** | Placeholder net-worth line + fixed 0–10,000 Y-scale (5 intervals), continuous line, clean X. | ✅ |
| **PF3** | Expanded view (founder-changed): **cumulative-default + market filter + single-market solo**; hard-gap breaks; free-Dharma cumulative-only; faint reference. **8 monochrome treatments retired**; filter moved PF5→PF3. | ✅ |
| **PF4** | Own **post + reply nodes** in BOTH expanded views (cumulative on the net-worth line; single-market on the position line), R2 rings, one global anchored-0 size scale, edge cases; node-size legibility tuned (crowd cap 4,000). | ✅ |
| **PF5** | **Flip/exit marker** at single-market breaks (F = hard-gap A + glyph C); rendered as a **node-style circle** (paper fill + hairline rim + swap arrows), clearly a marker not a node. | ✅ |
| **PF6** | Wiring: clickable placeholder card → fullscreen overlay (reused `GraphOverlay`); market filter inside the overlay; App integration (two stacked cards); disposable preview retired. | ✅ |
| **Y4=b** | Single-market view **autoscales per market** (replaced the fixed [0,2500] ceiling that clipped positions > 2,500). Structural no-clip: `niceMax ≥ max × 1.1`. Cumulative stays fixed [0,10000]. | ✅ |

---

## 3. Locked design decisions (do NOT re-litigate at port time)

These are founder-ratified. The production port implements them; it does not reopen them.

1. **Net worth is the canonical Dharma number everywhere** (profile, debate view, leaderboard, graph) =
   free Dharma + mark-to-market value of open positions. Leaderboard ranks by net worth.
   *(Deferred spec amendment: SPEC.1 §10.8 needs one clarifying line defining "current Dharma balance" =
   net worth — web-authored, CC-committed at the next spec touch.)*
2. **Y axis:** cumulative view = **fixed 0–10,000** (placeholder 5 intervals, expanded 10 intervals),
   no autoscale. Single-market expanded view = **autoscale per market** (Y4=b), structural no-clip.
3. **Nodes = the user's own posts AND replies**, rendered in the **expanded view only** (never the
   placeholder). Cumulative: node-y = total net worth at post time. Single-market: node-y = position
   value in that market at post time (INV-3). Same node, two heights.
4. **No bucketing** in the profile graph (a single user's own nodes are sparse).
5. **The node** = reused locked primitive (grey core = author stake; black/white ring = crowd split,
   author excluded; honest area via shared scaleSqrt anchored at 0). **Ring orientation = R2:**
   BLACK = YES-money on EVERY node. For a reply, `yesMoney = (parentSide==="YES" ? supportCrowd :
   counterCrowd)`, `blackFraction = yesMoney/(yesMoney+noMoney)`, the reply's own stake excluded.
   Support/Counter is a derived (node-side vs parent-side) classification, never encoded in colour.
   *(Resolved the latent side-binding contradiction "YES/Support=black" in favour of the YES/NO half.)*
6. **Held-side line:** per-market position value = shares × price over each SideEpisode; **hard gap** at
   every full sell-out, resume on re-entry; holding nothing = no line. Not the market aggregate; not a
   YES+NO mirror pair.
7. **Flip/break rendering = A + C:** hard gap (no connector) **plus** a flip/exit marker (the product's
   two-arrow "Flipped" icon) at each break, single-market view only. Rendered as a node-style circle
   marker (not a real node — no stake/crowd encoding).
8. **Expanded view default = Cumulative** (the net-worth line), with the market filter above it; the
   overlaid "all per-market lines at once" state was **removed**; the 8 monochrome treatments were
   **retired**.
9. **Monochrome only** (black/white/grey) in the prototype; the brand accent is a deferred code-side
   token swap (the grey core is the brand-accent slot).

---

## 4. Port list — what goes to production vs what stays behind

The prototype was built for file-copy porting: `chart/` is framework-agnostic, everything real sits
behind `data/types.ts`. **A port is a real engineering task, NOT a folder copy.**

### Ports to production (the portable layer)
- **`chart/` components:** `PostNode`, `ProfileChart`, `MarketPositionLine`, `NetWorthLine`,
  `FreeDharmaLine`, `ProfileNodes`, `FlipGlyph`, `MarketFilter`, `Axes`, `ChartFrame`, `geometry`,
  `scales`, `tokens`. (File-copy into the Next.js app; add `"use client"` to leaf files.)
- **`data/types.ts`:** the data contract — the seam real queries slot behind, unchanged.
- **The locked decisions in §3** as the basis for the production spec.

### Stays behind (disposable scaffold — do NOT copy into the production tree)
- **`data/generate.ts`** — the **synthetic data generator**. Must NEVER enter production.
- **`App.tsx`** — the fake two-card demo shell.
- **`scripts/_smoke-entry.tsx` + the `pnpm phaseN`/`profileN` harness** — prototype test rig.
- **`components/GraphOverlay.tsx`, `components/ProfileExpanded.tsx`** — disposable chrome (production
  has its own overlay/host).
- (The disposable dev preview `preview.html` / `src/preview.tsx` was already deleted at PF6.)

---

## 5. Open items for the production port (must be handled when porting)

1. **`shares(t)` fidelity.** The prototype holds position **shares constant within an episode** (v1
   simplification). Production must compute **true `shares(t)`** across mid-episode subsequent buys
   (F-BET-2) against real data.
2. **R2 primitive attribute.** `PostNode`'s internal `data-wedge="YES-money"` is honest under R2, but
   confirm/clean any vocabulary at port time so the attribute reads correctly for reply nodes too.
3. **Real data wiring.** Replace `data/generate.ts` with real queries behind the unchanged
   `data/types.ts`: per-market price series, the user's episodes + stakes, crowd pools, net-worth and
   per-market position-value series. The graph renders the Dharma economy, so these read models are
   **critical-path-adjacent** — plan-then-execute + review.
4. **Brand tokens.** Swap the monochrome tokens for brand tokens (the grey core → brand accent).
5. **SPEC.1 §10.8 amendment** (from decision §3.1): one line defining "current Dharma balance" = net
   worth, recorded at the next spec touch.
6. **Graph load analysis (DEFERRED — tracker task for the load-testing sweep).** Measure the real
   expanded-view render + data cost per graph (market + profile) on production data; decide the lazy
   mechanism. The placeholder→overlay split (the expanded React tree doesn't mount until clicked) is
   already in place and is most of the win; the open question is whether to *additionally* code-split
   the expanded component's JS and/or fetch the expanded data on click. **Production-port / load-test
   concern, not a prototype concern — the prototype proves the visual, not the performance.**

---

## 6. Process notes / requirements for the port (the "GitHub part")

The move into `zugzwang-foundation/experiment` is its **own stratum**, scoped properly — NOT a folder
copy. It must satisfy the standing guardrails:

- **No code before a spec.** The prototype side-stepped this *because* it was standalone. Production graph
  code needs a **production spec or ADR** (grounded in §3's locked decisions). §9 / `PLAN.md` is a
  design-exploration record, not a production spec.
- **Critical-path ritual** for the real-data read models (positions/ledger-derived): plan-then-execute,
  writer/reviewer pass.
- **Normal PR flow** through CI — not a drop into main.
- **Keep the boundary clean:** do NOT copy the standalone Vite prototype (with its synthetic generator)
  into the production tree as an interim step. The portable parts enter as production code (rewired,
  spec'd, reviewed); the disposable parts stay where they are (or are archived alongside the market-graph
  prototype).

---

## 7. PK refresh pointers (for memory ⇄ repo consistency)

- Profile graph PF1–PF6 complete; look locked; canonical record = `PLAN.md §9`.
- Locked decisions per §3 above (esp. net worth canonical everywhere; R2 rings; cumulative-default +
  filter; single-market autoscale per market; flip marker as node-style circle; 8 treatments retired;
  overlaid-all state removed).
- Deferred: graph load analysis (load-test sweep tracker task); `shares(t)` production fidelity;
  SPEC.1 §10.8 net-worth amendment.
- Next: the "port to production" stratum (spec → plan → PR), then resume DESIGN Wave-2 stratums.
