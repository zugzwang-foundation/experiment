# UI.19 — Market-detail price chart (F-DEBATE-5)

> **Status:** PLAN — **revision 2, web Gate-C rulings folded.** Committed off `origin/main 78b2952`. No code, no implementation.
> **Contract:** SPEC.1 1.0.22 §9 "Market price history — the market-detail chart" + **F-DEBATE-5**.
> **Baseline:** `origin/main = 78b2952` (post-#265). **Mode:** ultracode OFF, per-slice named cascade (A5 mode-law inherited). **Not a critical path** (read-time only; no auth / bet engine / ledger / commentary-moderation write).

### Revision 2 — web Gate-C rulings folded
- **BLOCKER #4 (poll):** the polled-read requirement is satisfied **structurally, not by refresh code** — the series lives on the one market view-model payload (`priceChart.series` on `DebateMarketHeader`) — superseded by revision 3 (#5): the series moved to a top-level `model.priceChart`; when the poll fires it arrives with it; **no separate client fetch, ever.** F-DEBATE-4 interval polling is **not wired on `/m/[slug]` today** — a **DOCKETED FINDING** with file evidence (below), not a restructure trigger. Rewritten in full at self-critique #4.
- **OVERRULED #6 (terminal agreement):** the one-event divergence is **fixed, not accepted** — the chart's terminal point renders the **same spot the `PriceBar` renders**, one quantity from one source, agreeing by construction (the §10.8 "one holding never shows two different current values" discipline). See design decision #6.
- **Ruling #2 (geometry):** **DUPLICATE** profile's geometry into a debate-local module; do **not** extract a shared one (coupling §23↔§9 through one file lets a profile change silently alter the market chart; Y semantics already differ — Đ 0–10000 vs probability 0–100).
- **Ruling #3 (tokens):** `--graph-yes` / `--graph-no` for **nodes AND lines** (confirmed; `--color-yes` = `#181818` = the ground, so a YES node in it is invisible and disagrees with its own line).
- **Ruling #9 (PR boundary):** **TWO PRs**, slice 1 then slice 2 — slice 2 carries the masking rule + mandatory `@security-auditor` and must not be reviewed inside a mostly-geometry diff.
- **Added to (c):** a mechanical test that **within a bucket, selection order == `topOrder`'s order** — makes "no second ranking rule" structural, not asserted.

### Revision 3 — final amendments (web Gate-C)
- **#5 REVERSED:** `priceChart` moves **off `DebateMarketHeader`** to a **top-level `model.priceChart`**, sibling of `model.market` (whose `pricing` feeds `PriceBar`); `MarketHeader` receives it as a prop from `DebateView`. A ~256-point series must not ride a type several components read; sibling placement makes the same-payload guarantee legible.
- **#8 DEFERRAL OVERRULED:** slice 1 fixes the `DISCOVERY_SERIES_MAX_POINTS` JSDoc in `config/limits.ts` ("NOT a spec constant" → pinned design value per §16.1 + Appendix B, 1.0.22) — a statement the code makes that the spec now contradicts.
- **ERROR STATE (new):** the market price-series read is **NON-FATAL** — on failure the chart is omitted, the rest of the header renders, the failure is captured via the existing observability path, the page does **not** 500 (Discovery's F-1 WARN-never-throw posture). Slice 1 adds a test.
- **Standing note recorded:** removing the replay-vs-live-pool drift check from this path leaves it on Discovery only — a correctness canary for the event-sourced replay that must not later be optimised out of Discovery (see "Standing note — drift canary").
- **Docket forward:** the F-DEBATE-4-polling-unimplemented finding is carried verbatim into a standalone block at the end, flagged for a tracker row (not in v18). UI.19 wires no poll.

---

## STEP 0 — ground (verified read-only)

| Check | Result |
|---|---|
| Subagent frontmatter | all four `.claude/agents/*.md` on `model: claude-opus-4-8` / `effort: max` — **no `claude-fable-5`, no HALT** |
| `origin/main` | `78b29521…` = **#265 merged** (`docs(spec): SPEC.1 1.0.22 — §9 market-detail price chart + F-DEBATE-5`) — post-#265 ✓ |
| SPEC.1 on main | **1.0.22**; `### Market price history — the market-detail chart` (§9, L486) + `### F-DEBATE-5` (L512) present ✓ |
| Migration head | `0024_bookmarks.sql` (AGENTS.md's `0023` cite is stale — noted, not this task) |
| ADR ceiling | `0033` (AGENTS.md's `0031` cite is stale — noted) |
| EVENT_TYPES | unchanged; **no new event type in this task** ✓ |
| Staging health | `staging.zugzwangworld.com/api/health` → **200** `{"status":"ok","env":"staging","canary":"903e185…","db":"ok","migrations":"ok"}`. Healthy; `canary = 903e185` because #265 was **docs-only** (no code redeploy) — expected, **not an incident** |
| Working tree | on stale local `docs/spec1-1022-market-price-chart@da196574` (remote deleted after squash as #265); **`git diff origin/main` over all substrate paths is EMPTY** → local reads are valid for the staging baseline |

---

## Governing reads (contract)

- **SPEC.1 §9 price-chart sub-section + F-DEBATE-5** (L486–517) — the binding surface spec.
- **§22 Discovery** (L1534–1568) — the replay mechanism being reused (`loadPriceSeries` / `replayReserveSeries`, "no new store").
- **§23 Profile** (L1572–1624) — the card→overlay + server-replay + nodes pattern being mirrored (the A5 template).
- **§16.1** L1052–1053 (`MARKET_SERIES_MAX_POINTS` = **256**, `DISCOVERY_SERIES_MAX_POINTS` = 64) + **Appendix B** L1679–1680 (both pinned design values).
- **§17** L1223–1230 — the eight `debate-view::price-chart-*` acceptance rows.
- **RANKING.md** §3 (Top), §4 (latest interleave — Top-list only, **not** nodes), §3.6 (profile order) — node selection reuses §3 Top via `topOrder`.
- **design-language §3.2** — the two-line YES/NO graph mirrored about 50 %, token strokes `--graph-yes`/`--graph-no`.

---

## Substrate study (what already exists — consume, don't re-derive)

| File | Role for UI.19 |
|---|---|
| `src/server/discovery/price-series.ts` | **`replayReserveSeries(client, marketId): ReservePoint[]`** — the ADDITIVE raw walk (no downsample, no drift check, no pool read), already exported at UI-A5 OQ-2 B and already consumed by `graph-series.ts`. **This is the seam UI.19 consumes.** `loadPriceSeries` (Discovery) is the 64-point consumer — **untouched.** |
| `src/components/discovery/PriceSparkline.tsx` | Decorative, `aria-hidden`, **index-spaced** X, one component. **Do NOT modify** — it is not reused (its axis discards timestamps; disqualified by the recon). |
| `src/server/profile/graph-series.ts` | **THE server template.** Consumes `replayReserveSeries`, derives series + nodes read-time, `downsample()` (private, re-implemented per-file), no stored series. |
| `src/components/profile/graph/{geometry,ProfileChart,ProfileGraphCard,ProfileGraphOverlay,ProfileGraph}.tsx` | **THE component template.** `geometry.ts` = pure d3-free scales (`xPx` time-scaled, `fmtUtcDay`, `pointsAttr`, `yPx`). `ProfileChart` = one SVG, `mode` prop, SVG `aria-hidden`. `ProfileGraph` = host holding `open` state → Card (collapsed, whole card is the expand `<button>`) + Overlay (dialog: ESC/backdrop/scroll-lock). Mirror this shape. |
| `src/server/debate-view/load-debate-view.ts` | The market-detail read-model aggregator + **the single masking gate**. Already calls `loadRankingSubstrate` (→ `postSubstrate`) and `loadRemovedSet` (→ `removedSet`). The chart derivation folds in here, **reusing both** — the one additive cost is a single `replayReserveSeries` call. |
| `src/server/debate-view/ranking-substrate.ts` + `src/lib/ranking.ts` | `loadRankingSubstrate` → `PostSubstrate[]`; `topOrder(substrate)` = pure §3 Top (no interleave; the hero's choice). `PostSubstrate` carries `createdAt: Date` + `parentSide` → sufficient to bucket by (UTC day, side). |
| `src/server/discovery/hero.ts` | Precedent for "top post per side" reusing `topOrder` + `loadRemovedSet` masking. **Not** per-(UTC day) — so UI.19 adds a thin bucketing selector, **not** a new ranking rule. |
| `src/components/debate/MarketHeader.tsx` | Mount site: chart mounts **above `<PriceBar>`**; strip only the `Price history — arrives with the ledger-replay read-model` line from `DeferredPlaceholders` (two siblings stay). |
| `src/components/debate/PriceBar.tsx` | Keeps its own `role="img" aria-label="YES x%, NO y%"` — **unchanged.** |
| `~/code/zugzwang/graph-prototype/**` | Read for SEMANTICS ONLY. **d3 does not cross.** |

---

## Named plan questions (§3) — answered

### (a) How the market path gets 256 without changing Discovery's 64

`loadPriceSeries` downsamples to `DISCOVERY_SERIES_MAX_POINTS` (64) **internally** and is not touched. UI.19 consumes the **already-exported additive seam** `replayReserveSeries` — the raw walk, no cap — exactly as `graph-series.ts` (A5) does. A new `loadMarketPriceSeries` maps the walk to YES-spot `PricePoint`s (`getPrices(step.reserves).yes`) and downsamples to **`MARKET_SERIES_MAX_POINTS` (256)** with a file-local `downsample` (the A5 precedent: the tiny index-math helper is re-implemented per file, never exported). Two independent consumers of **one replay authority**; Discovery's `loadPriceSeries` and `DISCOVERY_SERIES_MAX_POINTS` are byte-preserved. **Mechanism: additive consumption of `replayReserveSeries`, never a change to `loadPriceSeries`.**

### (b) Module placement

**Following the A5 precedent (consume, do not move/refactor).** `graph-series.ts` lives in `src/server/profile/` and imports `replayReserveSeries` from `@/server/discovery/price-series`. UI.19's server module lives in **`src/server/debate-view/price-chart.ts`** (the market-detail read-model home) and imports the same seam. Discovery is not moved, renamed, or refactored. Confirmed — precedent followed.

### (c) Node selection — reuse the existing §9 Top

Node ranking reuses **`loadRankingSubstrate` + `topOrder`** (pure §3 Top, no §4 interleave — the interleave is a debate-**list** display cadence, RANKING.md §4 ¶"Top-default only", and must not influence node picks; identical to hero's `topOrder` choice). **There is no pre-existing server function for "top per (UTC day, side)"** — hero does "top per side" *globally*, not per-day. UI.19 therefore adds a **thin pure selector** that **buckets** the existing `topOrder` output by `(utcDay(createdAt), parentSide)` and takes the first (highest-ranked) eligible post per bucket. This is a **partition over the existing Top order — not a second ranking rule** (F-DEBATE-5: "No second ranking rule is introduced, and none may be"). Stated plainly: no reusable per-day Top exists; UI.19 reuses the Top *ordering* and adds only a grouping. **Made mechanical (web Gate-C):** a unit test asserts that within any bucket the selector's winner is exactly the earliest member of that bucket in `topOrder`'s output — the selector never re-sorts, it only takes-first over the existing Top order, so "no second ranking rule" is structural, not merely asserted.

### (d) Content-removed exclusion is a MASKING rule — where enforced, how tested

Enforced through **`loadRemovedSet`** (exported from `load-debate-view.ts`), the **single audited masking primitive** — keyed **only** on `mod_actions.reason = 'content_removed'` (never `banned_at`), already reused by `selectHeroTopPosts`. The node selector receives the `removedSet` **already loaded by `loadDebateView`** (no second, drift-prone read) and skips those comment ids; the next eligible post on that (day, side) takes the slot, or the slot stays empty — mirroring §22 F-DISC-2. **Tested by:** `chart-nodes.integration.test.ts::content-removed-excluded-from-nodes` (a removed post that would otherwise win its bucket is excluded; next eligible or empty) + a pure-selector unit test. **`@security-auditor` reviews this selector + its masking reuse (MANDATORY, §5 below).**

### (e) Accessible text summary — where it lives

`PriceBar` keeps its own `aria-label` current-price readout, **unchanged** (the canonical spot readout). The new **`MarketPriceChart` host** carries the F-DEBATE-5-required summary: the SVG is `aria-hidden` (decorative, as `ProfileChart`), and a sibling **`sr-only` element** in the collapsed card states **opening price, current price, and the two domain endpoints** (`series[0].yes`, `series[last].yes`, opened date → last-event date). This is the one accessibility departure from the §22 sparkline (which is fully `aria-hidden` with no summary). The summary derives from the same server series — no new data.

---

## Design decisions (load-bearing)

1. **Chart data rides `loadDebateView` on a TOP-LEVEL `model.priceChart` (web Gate-C #5 — reversed).** The RSC (`m/[slug]/page.tsx`) already calls `loadDebateView`; the chart model (`{ series, nodes } | null`) sits at **`model.priceChart`**, a **sibling of `model.market`** (whose `pricing` feeds `PriceBar`) and `model.posts` — **not** on `DebateMarketHeader`. A ~256-point series must not ride a type several components read, and sibling placement makes the one-payload guarantee legible (exactly what `::series-on-same-payload-as-pricing` asserts). `DebateView` destructures it and passes it as a prop to `MarketHeader` → `MarketPriceChart` (client, owns expand state). Null when the read failed (error state below). No client fetch, no separate route.
2. **One additive DB cost.** `loadDebateView` gains exactly one `replayReserveSeries` call; node selection reuses the **already-loaded** `postSubstrate` + `removedSet`. This is the spec's "one additional per-market series call."
3. **F-DEBATE-4 refresh — satisfied STRUCTURALLY (web Gate-C ruling).** The series is on the one market view-model payload (top-level `model.priceChart.series`), so it refreshes on the SAME read that carries `market.pricing`; there is **no separate client-side fetch for the series, ever.** When F-DEBATE-4 interval polling lands, the series rides that read for free — nothing extra to build. Interval polling is **not wired on `/m/[slug]` today** (docketed finding, self-critique #4). A slice-1 test asserts `model.priceChart.series` and `model.market.pricing` arrive on the same `loadDebateView` payload.
4. **Frozen-after-resolution is by construction (INV-4).** Non-`Open` markets accept no new `bet.*` events (writes require `Open`) and resolution never writes bet events, so the walk ends at the last event and never advances; `topOrder` over append-only substrate is deterministic → series and nodes are stable forever. No `now` parameter (mirrors `ranking-substrate.ts`).
5. **Single-point (unbet) case.** An Open-but-unbet market yields a length-1 walk (the seed) → `< 2` points → the component renders a **full-width flat line at the opening price** (the `PriceSparkline` "duplicate at both ends" trick), because the time scale degenerates when `openedMs === lastMs`. No empty state (spec).
6. **Terminal point agrees with `PriceBar` BY CONSTRUCTION (web Gate-C OVERRULED — fixed, not accepted).** `getMarketPricingAndUnitToWin` already runs in `loadDebateView` and feeds `market.pricing` → `PriceBar`. `deriveMarketPriceChart` receives that **same** `pricing` and **stamps the series' terminal point with `pricing.yes`** (after downsample, on the retained last point) — one quantity, one source, so the point directly beneath the bar can never disagree with it (the §10.8 "one holding never shows two different current values" discipline, applied to the current-price readout). Interior/history points remain the pure replay (their only source); only the *current* terminal is the shared spot. The sr-only summary's "current price" reads the same `pricing.yes`. **Feasible with zero extra reads** — `pricing` is already loaded. A slice-1 test asserts `series[last].yes === market.pricing.yes`. *(Discovery's F-1 pool-compare/Sentry drift telemetry stays Discovery-only; agreement here is by construction, not by monitoring. Defensive `pricing == null` — unreachable for an opened, non-Draft market — falls back to the replay-final terminal.)*
7. **Node colour binds to `--graph-yes`/`--graph-no` by side** — a deliberate divergence from `ProfileChart`'s node fill (which uses `--color-yes/no`), to honor constraint #6 ("Tokens only: `--graph-yes` / `--graph-no`"). INV-3: bind YES-series→`--graph-yes`, NO-series→`--graph-no` **by semantic token name only** — never copy the underlying slot value (the repo aliases YES→ink slot / NO→n0 slot; a value-copy inverts the poles).
8. **Error state — the series read is NON-FATAL (web Gate-C).** `loadDebateView` wraps the chart derivation so a rejection sets `model.priceChart = null` and captures via the **existing observability path** (`safeCaptureMessage("market_price_series_read_failed", { level: "warning", … })` — the Discovery F-1 posture, WARN never throw); the rest of the Market-Detail header (title, description, `PriceBar`, totals, media) renders unaffected and the page does **not** 500. `MarketHeader` renders the chart only when `priceChart` is non-null. **No suspense boundary** is introduced — the series is part of the one awaited `loadDebateView` read, arriving with the header like `pricing`, so there is no separate loading shape.

### Standing note — drift canary (record, do not act)
Removing the replay-vs-live-pool consistency check (`loadPriceSeries`'s F-1: replayed final reserves vs the live `pools` row → `safeCaptureMessage("discovery_price_series_drift")`) from this path leaves it running **only on Discovery**. That check is a **correctness canary for the event-sourced replay**, not a chart feature. Discovery's per-load coverage is sufficient — so UI.19 does not duplicate it (agreement with `PriceBar` here is by construction, decision #6). **Recorded constraint:** the Discovery F-1 drift check **must not later be optimised out of Discovery**, or no replay canary remains anywhere in the system.

---

## Plan shape — two vertical slices (never big-bang)

Each slice is a full vertical (read model → geometry → component → wiring → states → tests) and ends green + PR-able. **Two PRs — slice 1 then slice 2 (ratified, web Gate-C #9)** — isolating the security-sensitive node diff behind `@security-auditor`.

### Slice 1 — Collapsed price line + expand→overlay (lines + time axis, no nodes)

**Delivers the working chart minus nodes.**

Files touched:
- `src/server/config/limits.ts` — (1) add `export const MARKET_SERIES_MAX_POINTS = 256` (§16.1 / Appendix B pinned design value; JSDoc cites 1.0.22); (2) **fix the `DISCOVERY_SERIES_MAX_POINTS` JSDoc** (web Gate-C #8): the current "An IMPLEMENTATION constant, NOT a spec constant" is contradicted by SPEC.1 1.0.22 §16.1 + Appendix B, which record it as a **pinned design value** — one-line reconciliation in the file slice 1 already opens. *(Type/config — the type-check is its gate, §5.6-exempt.)*
- `src/server/debate-view/price-chart.ts` **(new)** — `loadMarketPriceSeries(client, marketId, spotYes): Promise<PricePoint[]>`: `replayReserveSeries` → `getPrices().yes` per step → file-local `downsample(_, MARKET_SERIES_MAX_POINTS)` → **stamp the retained terminal point's `yes = spotYes`** (the shared `PriceBar` spot — decision #6). Returns `[]` only on the unreachable no-`market.opened` case; when `spotYes == null` (defensive) it leaves the replay-final terminal.
- `src/server/debate-view/load-debate-view.ts` — add **top-level** `priceChart: { series: PricePoint[] } | null` to **`DebateViewModel`** (a sibling of `market`/`posts`, web Gate-C #5 — **not** on `DebateMarketHeader`); assemble via `loadMarketPriceSeries(db, marketId, pricingAndUnitToWin?.pricing.yes ?? null)` **after** the pricing read, **wrapped so a rejection → `priceChart = null` + `safeCaptureMessage("market_price_series_read_failed", { level: "warning", tags: { marketId } })`** and the rest of the model returns intact (non-fatal, web Gate-C error-state; the header never 500s on a chart-read failure). Additive field; all consumers still typecheck.
- `src/components/debate/chart/geometry.ts` **(new)** — d3-free scales **DUPLICATED from** `profile/graph/geometry.ts` (web Gate-C ruling #2 — duplicate, never a shared module): time-scaled `xPx(iso, startMs, endMs)`, `fmtUtcDay`, and the **probability-Y mirror** (`y_yes=(1−p)·H`, `y_no=p·H`, mirror about 50 % — the `PriceSparkline`/design-language §3.2 rule; the profile module's Đ 0–10000 scale is deliberately NOT shared) + the single-point full-width flat-line handling.
- `src/components/debate/chart/MarketPriceChart.tsx` **(new)** — one SVG, `mode: "collapsed" | "expanded"`; two polylines on `--graph-yes`/`--graph-no`; fixed Y 0–100 %; `aria-hidden`. Collapsed = lines only, no axis, no nodes. Expanded = + two X endpoint labels (`fmtUtcDay(opened)` · `fmtUtcDay(last)`).
- `src/components/debate/chart/MarketPriceChartCard.tsx` **(new)** — collapsed `<button>` (whole card = expand affordance), contains the `aria-hidden` SVG + the **`sr-only` accessible summary** (opening %, current %, domain endpoints).
- `src/components/debate/chart/MarketPriceChartOverlay.tsx` **(new)** — dismissible dialog mirroring `ProfileGraphOverlay` (ESC / backdrop / body-scroll-lock; `role="dialog" aria-modal`), rendering `MarketPriceChart mode="expanded"` (no nodes yet).
- `src/components/debate/chart/MarketPriceChart` host (in `MarketPriceChart.tsx` or a small `MarketPriceChartHost.tsx`) — `"use client"`, owns `open` state, Card + conditional Overlay (mirrors `ProfileGraph.tsx`).
- `src/components/debate/MarketHeader.tsx` — accept a `priceChart` **prop** (from `DebateView`); mount the host **above `<PriceBar>`** and render it **only when `priceChart` is non-null**; remove **only** the `Price history — …` line from `DeferredPlaceholders` (keep `Resolver cards` + `Market media`).
- `src/components/debate/DebateView.tsx` — destructure `priceChart` from the model and pass it to `<MarketHeader market={market} priceChart={priceChart} />` (prop threading only; `page.tsx` unchanged — `priceChart` flows through the existing `model` prop).

States: **loading** — none; the series is part of the one awaited `loadDebateView` read (**no suspense boundary** introduced), arriving with the header like `pricing`/`PriceBar`. **empty** — none by spec; `<2` points → flat line at opening; defensive `series.length === 0` (unreachable) → chart omitted, header intact. **error — NON-FATAL (web Gate-C):** the series read is wrapped so a rejection sets `model.priceChart = null`, captures via the existing observability path (`safeCaptureMessage`, WARN — the Discovery F-1 posture, never throw), and the rest of the Market-Detail header (title, description, `PriceBar`, totals, media) renders unaffected; the page does **not** 500.

Tests (test-writer first):
- `tests/server/debate-view/price-series.integration.test.ts` — `::market-lifetime-domain` (X = opened→last event), `::single-point-renders-flat-line` (unbet → flat at opening), `::downsample-cap-respected` (>256 events → ≤256, first+last kept), `::series-frozen-on-non-open` (INV-4 series half), **`::series-on-same-payload-as-pricing`** (`model.priceChart.series` and `model.market.pricing` are siblings on the one `loadDebateView` return — web Gate-C #4/#5: one payload, no separate fetch), **`::terminal-equals-pricing-spot`** (`model.priceChart.series[last].yes === model.market.pricing.yes` — web Gate-C #6), **`::series-read-failure-is-non-fatal`** (a rejected series read → `model.priceChart === null`, `market`/`posts` intact, no throw, WARN captured — web Gate-C error-state).
- `tests/unit/debate/render/price-chart.test.tsx` — `::collapsed-renders-no-axis` (collapsed shows no axis/nodes), `::accessible-summary-present` (sr-only opening/current/endpoints), `::flat-line-when-single-point`, **`::header-renders-without-chart-when-priceChart-null`** (`MarketHeader` with `priceChart={null}` renders `PriceBar`/title/totals, no chart — web Gate-C error-state).
- `tests/unit/debate/chart/geometry.test.ts` — `xPx`/probability-mirror/flat-line unit coverage.

Reviewer cascade: `@test-writer` (Phase 2 start) → implement → **`@code-reviewer`** (`src/server/` + `src/components/` diff).

### Slice 2 — Expanded post nodes (ranking reuse + masking)

**Adds nodes to the overlay; carries the mandatory security review.**

Files touched:
- `src/server/debate-view/price-chart.ts` — add pure `selectChartNodes(substrate: PostSubstrate[], removedSet: Set<string>, walk: ReservePoint[]): ChartNode[]`: `topOrder(substrate)` → iterate **in Top order** → bucket by `(utcDay(createdAt), parentSide)`, **take-first** eligible (not in `removedSet`) per bucket → node `{ id, side: parentSide (INV-3), at, yYes: getPrices(reservesAt(walk, at)).yes }`. The selector **never re-sorts** — bucket winners are exactly `topOrder`'s earliest member per bucket (no second ranking rule, made mechanical). Plus `deriveMarketPriceChart(client, { marketId, postSubstrate, removedSet, spotYes })` orchestrating series (terminal-stamped with `spotYes`, decision #6) + nodes over **one shared** `replayReserveSeries` walk.
- `src/server/debate-view/load-debate-view.ts` — extend the top-level `model.priceChart` to `{ series, nodes } | null`; call `deriveMarketPriceChart` passing the **already-loaded** `postSubstrate` + `removedSet` + `pricing.yes` (reuse the `replayReserveSeries` result across series + node-y). The slice-1 non-fatal wrap now covers the whole derivation — a rejection (series **or** node build) → `priceChart = null` + WARN, header intact.
- `src/components/debate/chart/MarketPriceChart.tsx` — render node marks in `mode="expanded"` only (side-bound `--graph-yes`/`--graph-no`; node y = `yPx(node.yYes)` on the 0–100 % scale).
- `src/components/debate/chart/MarketPriceChartOverlay.tsx` — nodes now present in the expanded chart (no structural change).

States: no eligible node on a (day, side) → slot empty (no placeholder); removed → excluded; frozen post-resolution.

Tests (test-writer first):
- `tests/server/debate-view/chart-nodes.integration.test.ts` — `::top-post-per-utc-day-per-side`, `::content-removed-excluded-from-nodes`, `::node-side-frozen-at-post-time` (INV-3), `::frozen-after-resolution` (INV-4 nodes half), `::replies-are-not-nodes`.
- `tests/unit/debate/chart/select-nodes.test.ts` — pure selector: bucketing by (UTC day, side), removed-skip → next-eligible, empty-slot, and **`::within-bucket-order-is-toporder`** (the per-bucket winner == the earliest bucket member in `topOrder`'s output — "no second ranking rule" made mechanical, web Gate-C addition to (c)).
- `tests/unit/debate/render/price-chart.test.tsx` — `::expanded-renders-nodes`, node side→token binding (no pole inversion).

Reviewer cascade: `@test-writer` → implement → **`@code-reviewer`** → **`@security-auditor` (MANDATORY on `selectChartNodes` + the masking reuse — §3d)**.

---

## Acceptance mapping — F-DEBATE-5's eight §17 test ids

| §17 id | F-DEBATE-5 acceptance path | Slice | Invariant |
|---|---|---|---|
| `price-chart-market-lifetime-domain` | `price-series…::market-lifetime-domain` | 1 | — |
| `price-chart-single-point-flat-line` | `price-series…::single-point-renders-flat-line` | 1 | — |
| `price-chart-downsample-cap` | `price-series…::downsample-cap-respected` | 1 | — |
| `price-chart-collapsed-no-axis` | `…render/price-chart::collapsed-renders-no-axis` | 1 | — |
| `price-chart-nodes-top-per-utc-day-per-side` | `chart-nodes…::top-post-per-utc-day-per-side` | 2 | — |
| `price-chart-nodes-exclude-content-removed` | `chart-nodes…::content-removed-excluded-from-nodes` | 2 | ADR-0021 |
| `price-chart-node-side-frozen` | `chart-nodes…::node-side-frozen-at-post-time` | 2 | **INV-3** |
| `price-chart-frozen-after-resolution` | `price-series…::series-frozen-on-non-open` (1) + `chart-nodes…::frozen-after-resolution` (2) | 1+2 | **INV-4** |

**Web Gate-C-mandated tests (beyond the eight §17 ids):** `::series-on-same-payload-as-pricing` (#4/#5, slice 1), `::terminal-equals-pricing-spot` (#6, slice 1), `::series-read-failure-is-non-fatal` + `::header-renders-without-chart-when-priceChart-null` (error-state, slice 1), `::within-bucket-order-is-toporder` (added to (c), slice 2).

*(Repo convention appends `.integration` to DB-backed specs and places component tests at `tests/unit/<domain>/render/`; the spec's proposed paths are honored by test-id, path per "CC confirms at build.")*

---

## Mode + gates (binding)

- **ultracode OFF** — A5's mode-law across the whole vertical.
- **Per-slice cascade:** `@test-writer` → implement → `@code-reviewer`; **`@security-auditor` MANDATORY on slice 2's node-selection/masking.** Run sequentially, directed scope (one reviewer touching PG :54322 at a time — the B5/flakiness lesson). Pass `@docs/plans/UI.19.md` to every subagent.
- **Gate C by web before merge** (this touches a read model).
- **Pre-PR self-audit** per slice against this plan (schema n/a; server handlers vs the API surface; the INV-3/INV-4 assertions present).
- **`just verify`** + `pnpm vitest run` (full suite — the cross-suite floor catches, e.g. EVENT_TYPES inventory) run locally against PG :54322 before each PR; `ZUGZWANG_ENV=preview` for the build.

---

## Constraints (violating any = HALT + report) — how honored

1. **No d3, no new dependency.** Pure `geometry.ts` (linear scales + polyline strings), the `PriceSparkline`/A5 precedent. Prototype d3 read for semantics only.
2. **Tokens only `--graph-yes`/`--graph-no`; no raw hex.** Lines + nodes bind to those two tokens; `tests/unit/design/{no-raw-hex-view-layer,tokens-monochrome}.test.ts` **not amended** and stay green.
3. **INV-3 poles never inverted.** Bind by semantic token name (YES→`--graph-yes`, NO→`--graph-no`); never copy the slot value (design decision #7).
4. **Never plot K_eff.** The chart plots only YES/NO probability from pool replay; no derived thesis metric (§3 G3 / §12.3).
5. **No DDL, no migration, no new event type, no new table/column.** Read-time replay only; the sole new persisted-adjacent constant is `MARKET_SERIES_MAX_POINTS` in `config/limits.ts` (a config constant, not schema).
6. **Do not touch §22, `PriceSparkline`, or `PriceBar`.** `loadPriceSeries` + `DISCOVERY_SERIES_MAX_POINTS` byte-preserved; `PriceSparkline`/`PriceBar` unedited.
7. **Prototype scaffold stays behind.** No generator / App / prototype overlay chrome crosses.
8. **`DeferredPlaceholders` kept** — only its price-history line removed; two siblings stay.

---

## Self-critique (numbered)

1. **Scaffold-drag (the A5-item-8 analog).** The live temptation is importing the graph-prototype's d3 `MarketChart`/`PriceLines`/`Axes`/`scales` or over-building axis/tick machinery beyond the two endpoint labels A5 shipped. **Guard:** geometry is a fresh ~30-line pure module; the acceptance test set has no interior-tick assertion; intermediate tick granularity is canon-owned, not spec-pinned — build endpoints only.
2. **Cross-domain geometry coupling — RESOLVED (web Gate-C #2).** Ruling: **duplicate** profile's geometry into `components/debate/chart/geometry.ts`; do **not** extract a shared module — coupling §23↔§9 through one file would let a profile change silently alter the market chart, and the Y semantics already differ (Đ 0–10000 vs probability 0–100). The small duplication is accepted (A5 itself re-implemented `downsample` per file rather than exporting it).
3. **Node colour token — RESOLVED (web Gate-C #3).** Ruling: `--graph-yes` / `--graph-no` for **nodes and lines**. `--color-yes` = `#181818` = the ground, so a YES node filled with it is invisible and disagrees with its own line. Bind by semantic token name only — never the slot value (INV-3 poles never inverted).
4. **F-DEBATE-4 refresh — satisfied structurally; polling is a docketed finding (web Gate-C #4, BLOCKER resolved).** SPEC.1 1.0.22 §9 "Refresh" and F-DEBATE-5's System step both require the series to ride the F-DEBATE-4 polled read. This is satisfied **structurally, not with refresh code**: the series lives on the **one** market view-model payload (top-level `model.priceChart.series`, assembled in `loadDebateView` alongside `model.market.pricing`), so when the poll fires the series arrives with it — and there is **no separate client-side fetch for the series, ever.** A slice-1 test (`::series-on-same-payload-as-pricing`) pins that the series and pricing return on the one payload.
   **DOCKETED FINDING — F-DEBATE-4 interval polling is NOT wired on `/m/[slug]` at `origin/main 78b2952`.** Evidence: (1) `POLL_INTERVAL_MS_DEBATE_VIEW` is **defined nowhere in `src/`** (grep empty); (2) `src/components/debate/DebateView.tsx` imports only `useState` — **no `useEffect`, no `setInterval`** — it is seeded once from RSC props; (3) the only re-render trigger in the debate path is imperative `router.refresh()` **after a write** (`src/components/debate/composer/SellModule.tsx:183,214`, `src/components/debate/composer/BetComposer.tsx:313,360`), a post-mutation refresh — not an interval poll. Consequence today: the market payload (with `priceChart.series`) refreshes on navigation, RSC re-render, and post-write `router.refresh()` — the same cadence as `market.pricing`/`PriceBar`. **This is a finding to hand forward, not a licence to restructure:** UI.19 wires no poll; when F-DEBATE-4 lands it carries the series for free because it is on the same payload.
5. **Model placement — RESOLVED (web Gate-C #5, reversed).** `priceChart` moved OFF `DebateMarketHeader` to a **top-level `model.priceChart`** (sibling of `market`/`posts`); `MarketHeader` receives it as a prop from `DebateView`. A ~256-point series should not ride a type several components read, and sibling placement makes the same-payload guarantee (`::series-on-same-payload-as-pricing`) legible.
6. **Chart-final vs `PriceBar`-spot — FIXED, not accepted (web Gate-C #6, OVERRULED).** The chart's terminal point is stamped with the **same `pricing.yes` the `PriceBar` renders** (design decision #6): one quantity, one source, agreeing by construction — the §10.8 "one holding never shows two different current values" discipline applied to the current-price readout. Zero extra reads (`pricing` is already loaded in `loadDebateView`); slice-1 test `::terminal-equals-pricing-spot` pins it. History/interior points remain the pure replay (their only source). Discovery's F-1 drift telemetry stays Discovery-only — unnecessary once agreement is structural.
7. **Single-point degenerate domain.** `openedMs === lastMs` breaks the time scale; the flat-line special-case is easy to forget and is the `single-point-flat-line` acceptance. Called out as decision #5 and given a dedicated geometry unit test so it cannot regress silently.
8. **`DISCOVERY_SERIES_MAX_POINTS` JSDoc — FIXED in slice 1 (web Gate-C #8, deferral overruled).** The JSDoc says "NOT a spec constant," which SPEC.1 1.0.22 §16.1 + Appendix B now contradict (pinned design value) — a false statement the code makes, not mere staleness. Slice 1 already opens `config/limits.ts` to add `MARKET_SERIES_MAX_POINTS`, so the one-line reconciliation lands in the same file/slice.
9. **PR boundary — RESOLVED (web Gate-C #9).** Ruling: **two PRs**, slice 1 then slice 2. Slice 2 carries the masking rule + the mandatory `@security-auditor` and must not be reviewed inside a mostly-geometry diff.

---

## Docketed finding — F-DEBATE-4 interval polling unimplemented on `/m/[slug]`

> **Flagged for a tracker row. NOT tracked in v18. UI.19 wires no poll — this is a hand-forward, not UI.19 scope.**

SPEC.1 1.0.22 §9 "Refresh" and F-DEBATE-4 specify the debate view polls the read endpoint at `POLL_INTERVAL_MS_DEBATE_VIEW`. At `origin/main 78b2952` that interval poll is **not wired on `/m/[slug]`**. Evidence (verbatim, read-only):

1. **`POLL_INTERVAL_MS_DEBATE_VIEW` is absent from `src/`** — `grep -rn "POLL_INTERVAL_MS_DEBATE_VIEW" src/` returns nothing; the constant F-DEBATE-4 names is not defined anywhere in the tree.
2. **`src/components/debate/DebateView.tsx` is `useState`-only** — it imports `useState` (and `type ReactNode`); it has **no `useEffect`, no `setInterval`, no timer**. It is seeded once from the RSC `model` prop and never re-fetches.
3. **The only re-render trigger in the debate path is post-write `router.refresh()`** — `src/components/debate/composer/SellModule.tsx:183,214` and `src/components/debate/composer/BetComposer.tsx:313,360` call `router.refresh()` after a completed bet/sell mutation. That is an imperative post-mutation refresh, **not** an interval poll.

**Consequence today:** the whole market view-model (including UI.19's `model.priceChart`) refreshes on navigation, RSC re-render, and post-write `router.refresh()` — the same cadence as `market.pricing`/`PriceBar`. **UI.19 satisfies F-DEBATE-5's "rides the F-DEBATE-4 poll" structurally** (the series is on the one payload; §Design decision #3), so when the poll is later implemented the series rides it for free — **nothing in UI.19 needs to change.** The missing interval poll is a separate F-DEBATE-4 gap to schedule on its own tracker row.
