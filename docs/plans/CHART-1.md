# CHART-1 — the market price chart, concluded

**Task:** CHART-1 · autonomous overnight run
**Base:** `origin/main` = `83cf6fb` · branch `feat/chart-1`
**Governing method:** `docs/overnight-run.md` **v1.1** (on disk; supersedes the
v1.0 attached to the kickoff — see A-1)
**Governing work:** `zz_CHART-1_overnight-brief_v1_0.md` (web-authored)

---

## 0 · What recon changed about this plan

The brief was written against a **pre-S-4 repo**. Three of its premises are
false at `83cf6fb`, and one of them (G-5) invalidates the mechanism the brief
names for its central deliverable:

- **G-10 — the series is REAL event replay, not synthetic.** The brief's primary
  contingency ("if synthetic, replacing it is the primary deliverable") does not
  fire. The ruled outcome already holds; it gets a guard (OVN-O4).
- **G-5 — `cacheComponents` is ON**, `force-dynamic` is gone repo-wide, and
  three `'use cache'` functions ship. **SCALE row 2.1 has already landed** as
  S-4 Phases B/C/D (#405, #423 — this run's own base commit).
- **RF-7's "missing" `/m/[slug]` budget test exists** (S-4 Phase E).
- **`PD-3-04` is already fixed in code** on collapsed *and* expanded; only the
  hero lacks the summary, and the register row still says `open`.

**What is actually still broken, and why this task is not a no-op.** Both chart
surfaces are already cached — but **keyed on `reserves`**. Every bet moves the
CPMM pool, changes the key, and forces a full miss including the 3-statement
replay. That is precisely the failure mode the brief's own RF-5 rationale names:
*"tag-only invalidation performs worst precisely when load is highest … at a bet
a second the effective lifetime is about a second."* **The founder's ruled
outcome — the graph is not real-time, and stops costing what real-time costs —
does not yet hold.** Delivering it is this run's work.

---

## 1 · The core idea, in one paragraph

The price chart's **history** stops being keyed on anything a bet can move, so
fifty bets in thirty seconds cost one derivation instead of fifty; its **right
edge** is composed fresh at render from the live pool price both surfaces
already read for `PriceBar`, so the chart can never disagree with the bar
beneath it. One component renders it on all three surfaces (collapsed card,
expanded overlay, Discovery hero), each line ending in a dot and its own
token-bound `YES`/`NO` label, with the near-even collision case — where every
market sits at open — handled as the default rather than the exception.

---

## 2 · Slices, in the brief's fixed order

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 1 | Prescriptive docs (EDIT A–M) | all 13 edits applied; SPEC.1 → 1.0.40 | no |
| 2 | Series module: shared cached walk, one downsample, narrowed query | full suite green; budget tests green or improved | **yes** — `@code-reviewer`, `@security-auditor` |
| 3 | Component unification — hero renders `MarketPriceChart`, time-scaled | hero renders the same component; suite green | yes |
| 4 | Terminal dots, labels, gutter, collision rule | new render guards green | yes |
| 5 | Domain-to-now + live tail pin | `Open` runs to now; non-`Open` frozen | **yes** |
| 6 | Accessible summary on all three modes; `PD-3-04` status | hero summary present, `aria-hidden` gone | no |
| 7 | Guards, budget deltas, bench, contact sheet | every guard revert-to-red verified | yes |

Slices **4 and 5 are expected to land as one commit** — the terminal marker and
the terminal's *position* are the same SVG element, and a state where the dot
exists but sits at the wrong x is not a shippable intermediate.

---

## 3 · The mechanism — decided, with the rejected alternative

### 3.1 · REJECTED: the hand-rolled minimum-window memo (RF-5 as literally written)

The brief specifies a module-scope LRU `Map` holding derived history for
`MARKET_SERIES_MIN_WINDOW_MS`, bounded at 64 entries. **Not built.** Four
reasons, in descending weight:

1. **It would be nested inside a `'use cache'` function and therefore almost
   never execute.** Both chart call sites already sit inside cached blocks. On
   an outer hit the body never runs, so the memo is not consulted; on an outer
   miss it is consulted once. A mechanism whose hit rate is dominated by a
   mechanism above it is not a mechanism, it is dead weight.
2. **Its stated justification is falsified.** RF-5 exists because G-5 said the
   framework cache was unavailable. It is available and is the repo's ratified
   idiom, with invalidation already wired (`market:${id}`).
3. **The brief itself ratifies the alternative.** EDIT B, which this run applies
   verbatim, says the memo's *"mechanism is an implementation choice and may be
   replaced by the SPEC.2 R-2 framework cache without a spec change."* SPEC.1
   §22:1743 already describes exactly this posture for the same derivation:
   *"the cached-per-load model … amortizes the replay across the cache
   lifetime."*
4. **RF-5's required docblock would be a false statement.** It must say the memo
   is *"provisional pending SCALE row 2.1, which will replace it with the
   framework cache."* Row 2.1 has landed. Writing that sentence would mint a doc
   that is stale on the commit that creates it.

### 3.2 · BUILT: the shared cached reserve walk

**`src/server/discovery/cached-series.ts`** — new, one module boundary.

```
getCachedReserveWalk(marketId)          'use cache'
  cacheLife({ revalidate: MARKET_SERIES_MIN_WINDOW_MS / 1000, … })
  cacheTag(`market:${marketId}`)
  → WireReservePoint[]   // ISO-stamped; the pure replay, no live values
```

Five properties, each deliberate:

- **Keyed on `marketId` alone.** Not on reserves, not on a cap, and structurally
  incapable of carrying viewer state: it is the function's only parameter and it
  is a market id. This is *stronger* than RF-5's "market id + point cap" — one
  entry serves both surfaces at both caps, because the **walk** is cached and
  the cap is applied by a pure function afterwards.
- **The walk, not the series.** The walk is the expensive artifact (3 SQL
  statements + N CPMM folds) and it is what the expanded-mode node placement
  needs (`reservesAt`). Caching the downsampled series instead would have forced
  node y-values onto a thinned grid — a behaviour change to `C-CHART-1`
  territory this task has no mandate to make.
- **ISO strings on the wire, never a `Date`.** A `Date` crossing the cache
  boundary depends on the serializer's handling; the cache is inert under
  `vitest`, so a mistake there would be invisible in test and live in
  production. Serializing explicitly removes the question.
- **No `Date.now()` inside.** A clock read inside a cached function freezes at
  derivation time. RF-4's "domain runs to now" is therefore composed *outside*
  the cache, at the same place as RF-6's live tail — they are one operation.
- **`revalidate` bound to the constant, never inlined** (EDIT F's own
  requirement).

### 3.3 · The composition point — RF-4 and RF-6 are the same edit

Both surfaces already read the live pool **before** the cached block, and both
already thread that live value past the cache:

- `src/app/(public)/page.tsx` — `priced` per market, then
  `getCachedMarketDiscoveryData(id, priced.reserves)`.
- `src/app/(public)/m/[slug]/page.tsx` — `priced`, then `getCachedDebateView`,
  then an **explicit override** of `pricing`/`unitToWin` with the live values
  (the S-4 Gate-C fix).

The live tail is composed at exactly those two points, by one pure function:

```
withLiveTail(series, { spotYes, nowIso, isOpen })
  isOpen  && now > last.at →  append { at: now, yes: spotYes }   // RF-4
  otherwise                →  restamp last with spotYes          // RF-6, INV-4
```

**Zero new reads.** `spotYes` is `priced.pricing.yes`, already in hand.

### 3.4 · Blast radius, deliberately bounded

- `loadDebateView` takes **one optional `walk` argument**, defaulting to its
  current live replay. Its signature stays viewer-independent (ADR-0034 D-1);
  no viewer-scoped value is added or reachable.
- **`m/[slug]/export/route.ts` is not touched and passes nothing** — it keeps
  calling `loadDebateView` directly and uncached, so ADR-0025's "no cache on the
  export" holds byte-for-byte.
- `PriceBar` is not touched.
- No DDL, no migration, no new event type, no new Route Handler, no new
  dependency.

---

## 4 · File map

| File | Why |
|---|---|
| `docs/specs/SPEC.1.md` | EDIT A–I · §0 → 1.0.40 |
| `docs/design/design-canon.md` | EDIT J (§2 stale sentence) · EDIT K (`C-CHART-2`) |
| `docs/polish/POLISH-register.md` | EDIT L — `PD-3-04` status only |
| `docs/parked.md` | EDIT M — legend / freshness / hero rows |
| `src/server/config/limits.ts` | `MARKET_SERIES_MIN_WINDOW_MS = 60000` |
| `src/server/discovery/cached-series.ts` | **new** — the cached walk + pure helpers |
| `src/server/discovery/price-series.ts` | export the walk→series map; keep `loadPriceSeries` for uncached callers |
| `src/server/debate-view/price-chart.ts` | accept an injected walk |
| `src/server/debate-view/load-debate-view.ts` | one optional arg, plumbed |
| `src/server/debate-view/cached-view.ts` | fetch + pass the cached walk |
| `src/app/(public)/page.tsx` | live tail on the hero series |
| `src/app/(public)/m/[slug]/page.tsx` | live tail in the existing override block |
| `src/components/debate/chart/MarketPriceChart.tsx` | terminal dots + labels + gutter + collision + `hero` mode |
| `src/components/debate/chart/geometry.ts` | right gutter, label metrics |
| `src/components/debate/chart/MarketPriceChartOverlay.tsx` | legend removed (C-CHART-2 supersedes C-CHART-1 cl. 3) |
| `src/components/discovery/HeroPanels.tsx` | render `MarketPriceChart` in `hero` mode |
| `src/components/discovery/PriceSparkline.tsx` | retired at the hero call site |
| `tests/**` | the eleven guards + budget deltas |

---

## 5 · Baselines — measured before, re-measured after

| Baseline | Layer | Why that layer |
|---|---|---|
| Discovery statement pin | `tests/server/discovery/round-trip-budget.test.ts` — Drizzle `logger.logQuery` | executed statements, not call sites; a `JOIN LATERAL` builder is not a round trip |
| `/m/[slug]` statement pin | `tests/server/debate-view/round-trip-budget.test.ts` | same; already split warm / cached-block / viewer |
| Series derivation cost | bench at 10 / 1 000 / 10 000 events | the curve, not one number |
| Derivations per simulated 10-min session | counted at the derivation | the founder-legible number |
| Bundle delta | build output | RF-9 — must be ≈ 0 |

**Predicted post-build:** Discovery `1 + 12N` → **`1 + 11N`** (the F-1 drift pool
read leaves the cached path); `/m/[slug]` cached block **12 → 9** (the
3-statement walk moves behind its own key). Both are *decreases*; any increase
is a headline finding.

---

## 6 · Ambiguities resolved here (full register in the run report)

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A-1 | Kickoff attached doctrine v1.0; repo has v1.1 | v1.1 | v1.0 | kickoff says the repo copy is canonical. ⇒ **no reviewer re-runs**; the unreviewed-fix list is the mitigation |
| A-2 | RF-5 memo vs framework cache | framework cache | hand-rolled LRU memo | §3.1, four reasons |
| A-3 | Where the module lives | `src/server/discovery/` beside `price-series.ts` | a new `src/server/market-series/` dir | the shared derivation already lives there and market-detail already imports across; a new dir is a structural claim this task need not make |
| A-4 | Discovery's F-1 drift pool read on the cached path | dropped | kept | a floored history *legitimately* differs from the live pool, so the check would warn by design. Superseded by the live tail pin, which makes the edge exact by construction rather than by monitoring. −1 statement |
| A-5 | Cache the walk or the capped series | the walk | the series | node placement needs `reservesAt`; one entry serves both caps |

---

## 7 · Test plan — the eleven guards

Each named with the wrong answer it must reject; each verified by reverting its
fix and watching it red (OVN-V2); each negative assertion carrying a positive
control (OVN-V1).

1. **Terminal-label non-overlap** — rejects two label boxes intersecting at
   YES = 50 / 49 / 51 %.
2. **Terminal-label token binding** — rejects a label on `n5` or on the opposite
   pole's token.
3. **Pole non-inversion** — rejects YES rendering on `--graph-no`. Asserted on
   the computed attribute, not on source text (**V-4**).
4. **Domain runs to now** — rejects an `Open` market whose right edge is the last
   event.
5. **Domain frozen** — rejects a non-`Open` market whose domain advances
   (**INV-4**).
6. **Flat line on a zero-bet market** — G-10's pin.
7. **Window coalescing** — rejects a second derivation inside the window.
   ⚠ Asserted on a **spy over the derivation**, never on elapsed time or on
   array equality: two recomputes of a deterministic function return equal
   arrays, so an equality assertion passes for the wrong reason. The spy must be
   proven able to observe a miss.
8. **Cache viewer-independence** — rejects any viewer-scoped field in the key or
   the value. Source-scan, the repo's established shape for an inert-under-test
   cache (`cached-view-contract.test.ts`).
9. **Tail pin exactness** — rejects a rendered terminal differing from what
   `PriceBar` renders in the same tree.
10. **`/m/[slug]` round-trip budget** — rejects any statement increase.
11. **Discovery round-trip budget** — rejects movement of the pin in either
    direction (a *decrease* is re-pinned deliberately, with the reason).

---

## 8 · Reviewer cascade

1. `@test-writer` — the eleven guards. Briefed that **the collision case is the
   default state of every market**, and that guard 7's failure mode is passing
   for the wrong reason.
2. `@code-reviewer` — the series module, the cache boundary, the unification,
   and every docblock the change made false. Briefed that the failure mode is
   **a derivation that is no longer pure**.
3. `@security-auditor` — scope: **the cache as a cross-viewer leak surface**,
   and `loadDebateView`'s diff against ADR-0034 D-1.

Per doctrine v1.1 §7.1, **no reviewer is re-run after a fix**. Every fix
authored after its reviewer ran is disclosed in the run report's
**unreviewed-fix list**, which is the whole mitigation.
