# CHART-3 — the chart without a genesis event, and the fixed experiment window

**Task:** `CHART-3` · autonomous overnight run · `feat/chart-3`
**Base:** `origin/main` = `44c9f99065895cbdac51b67fd48ad4eb4d1fa936`
**Brief:** `zz_CHART-3_overnight-brief_v1_0.md` (md5 `ac31412b501acfcfd1f9344243d75d96`, verified)
**Method:** `docs/overnight-run.md` v1.1
**Planned:** 2026-08-29T21:46Z

---

## 0 · SLICE 0 · G-1 — THE PRECONDITION, ANSWERED BEFORE ANY EDIT

> **Is the constant product `k = yes × no` INVARIANT across `bet.placed` and `bet.sold`?**

## **NO.** `k` is **non-decreasing**, not constant.

The brief's branch therefore fires: **Slice 2 (the genesis fallback) is ABANDONED.**

### The evidence, at three layers, which all agree

**1 · The spec says it by name.** `docs/specs/cpmm.md` §11:

> **INV-C2 — k non-decreasing.** Exact arithmetic preserves k identically; under
> §10.3 rounding, **k′ ≥ k on every buy and sell**, with the dust inside the reserves.

and §10.3 (`cpmm.md:513-516`):

> Consequence (§4.2.4, §5.2.4): **k′ ≥ k after every rounded operation** — rounding
> dust accrues to the pool, never to a participant. "k is non-decreasing" is thereby
> a machine-checkable per-trade invariant (INV-C2).

The mechanism is not a fee — the maker is **fee-less** (`cpmm.md:44`, "no fee term exists
anywhere in the share or price math"). It is §10.3's **directional boundary rounding**: the
user-credited quantity (shares bought, sale proceeds) is **floored**, and the reserves are
then derived by exact add/sub of the *floored* value. The trader never gets the benefit of
the rounding, so the dust lands in the pool and `k` ratchets **upward**, permanently.

**2 · The shipped implementation agrees, in its own docblocks and its own green tests.**

- `src/server/cpmm/calculate.ts:52-54` — "the output reserves are derived by exact add/sub
  of the FLOORED share, **so k′ ≥ k** (rounding dust to the pool, INV-C2)"
- `src/server/cpmm/calculate.ts:106-107` — "reserves are derived by exact add/sub of the
  FLOORED proceeds (**k′ ≥ k**, INV-C2)"
- `tests/unit/cpmm/vectors.test.ts:89` — a committed, passing test named
  `INV-C2: k′ = 10000.000000000000000010 exactly (dust ⇒ k′ > k)`, which asserts
  `k′ > k` is `true`.

**⇒ Spec and implementation do NOT disagree.** The brief asked; they are in exact accord.

**3 · Measured through the shipped functions.** `computeBuy`/`computeSell` were driven
directly (harness written, run, and deleted — it is not part of this branch):

| state | reserves | `√(y·n)` at 18 dp |
|---|---|---|
| genesis, seed 100 | `100` / `100` | `100.000000000000000000` ✓ |
| after 1 buy (S=10) | `90.909090909090909091` / `110` | `100.000000000000000000` ✓ |
| after full sell-back | `100.000000000000000001` / `100.000000000000000001` | **`100.000000000000000001`** ✗ |

**Two operations is all it takes.** At experiment magnitude (seed 10 000, mixed buys and
sells): first divergence at **trade 2**; `√k` = `10000.000000000000000004` by trade 11,
`…000000022` by 50, `…000000201` by 400. Monotone, never recovering.

**Positive control (OVN-V1/V3):** `cpmm.md` E4 is the *exact* branch — `(150, 50)` buy YES
`S=10` gives `s = 35` exactly, no dust. Driven through the same harness: **drift exactly
`0.000000000000000000`.** The measurement detects real dust, not a harness artifact.

**4 · And it is already true of the live staging data the fallback would have consumed.**
Read-only probe against staging tonight — five of five bet-carrying markets:

| market | `√(yes · no)` |
|---|---|
| `bitcoin-price-50k` | `10000.000000000000000000495…` |
| `math-erdos-contribution-response` | `10000.000000000000000002511…` |
| `claude-bundle-response` | `10000.000000000000000002980…` |
| `yc-paper-club-response` | `10000.000000000000000003299…` |
| `github-zugzwang-repo-stars` | `10000.000000000000000007371…` |

Not one is an integer. The drift orders exactly by trade count (21 bets + 4 sells largest;
1 bet smallest) — the signature of accumulated flooring dust, not of noise.

### RF-1's own test gives the same answer

RF-1: *"The derived value is **exact or it is not used.** If `√k` is not an integer within
the numeric precision the pool carries, that is the `k`-drifts case — report and abandon."*
The pool carries `NUMERIC(38,18)`. `10000.000000000000000003` is not an integer at 18 dp.
**Both tests — G-1's and RF-1's — return ABANDON.**

### What the founder should know before ruling again

The error is **~10⁻¹⁸ Đ on a 10 000 Đ seed**, and because the fallback would seed
`yes = no = √k`, the genesis price would still be exactly `0.5`. **The derived curve would
be visually identical to the true one.** So the honest summary is: *provably not exact,
and not visibly wrong.* The ruling that "a curve that is subtly wrong is worse than a
curve that is absent" was made against a *materially* wrong curve; the measured error is
eighteen decimal places down. **A bounded-error variant is therefore a live option** — but
it is a founder ruling, not a call an unattended session may take, and RF-1's stated test
is unambiguous. Abandoned, flagged, not resolved. See run report §12 OWED.

---

## 1 · SLICES

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 0 | **GROUND** — G-1, then G-2 | G-1 answered above; G-2 in §2 | — |
| 1 | **Prescriptive docs** — §5 EDITs A, C, D, F. **B and E WITHHELD** (§3) | SPEC.1 + canon amended; withheld text quoted in the report | — |
| 2 | ~~The fallback seed~~ | **ABANDONED — G-1** | — |
| 3 | **`Open ⇒ market.opened` invariant** (RF-3) | `I-GENESIS-001` red against a violating fixture, green against a real `openMarket` | `@test-writer`, `@code-reviewer` |
| 4 | **The fixed experiment window** (RF-2) | Axis spans the constants; series still stops at now; full suite green | `@code-reviewer` |
| 5 | **Guards, budgets, contact sheet** | Both round-trip pins unmoved; contact sheet regenerated | `@security-auditor` |

**Full suite green at the end of every slice.** Baseline: **403 files / 3766 tests, 206.88 s.**

---

## 2 · G-2 — THE CURRENT SHAPE, BY FILE AND LINE

| # | Fact | Location |
|---|---|---|
| G-2.1 | `replayReserveSeries` — the genesis lookup | `src/server/discovery/price-series.ts:182-193` |
| G-2.2 | the `if (!opened) return []` early exit | `src/server/discovery/price-series.ts:195-198` |
| G-2.3 | **the X domain is computed IN THE COMPONENT**, from the series' own first and last point | `src/components/debate/chart/MarketPriceChart.tsx:91-93` |
| G-2.4 | `xPx` maps `startMs`→0, `endMs`→`VIEWBOX_W`; degenerate domain collapses to 0 | `src/components/debate/chart/geometry.ts:275-282` |
| G-2.5 | CHART-1's "→ now on `Open`, → last event otherwise" lives in **`withLiveTail`**, server-side — it appends a point, it does not set a domain | `src/server/discovery/price-series.ts:144-156` |
| G-2.6 | **a `pools` read is ALREADY in scope** at `loadPriceSeries` (Discovery) … | `src/server/discovery/price-series.ts:299-303` |
| G-2.7 | … but **NOT** inside `replayReserveSeries`, and **NOT** on the `/m/[slug]` path, which calls the replay directly | `src/server/debate-view/price-chart.ts:51`, `:92` |
| G-2.8 | the existing server-side warning mechanism is `safeCaptureMessage(..., { level: "warning" })` — Sentry-backed, already used by this exact file | `src/server/discovery/price-series.ts:310-321` |
| G-2.9 | `MARKET_SERIES_MAX_POINTS` = **256**, `DISCOVERY_SERIES_MAX_POINTS` = **64**, `MARKET_SERIES_MIN_WINDOW_MS` = **60000** — read, not trusted from the brief | `src/server/config/limits.ts:208,217,243` |
| G-2.10 | four `"use client"` components already import `@/server/config/limits` — the precedent that lets the window constants live at the limits layer and still reach the component | `DebatePoll.tsx`, `scrollers.tsx`, `composer/ImageAttach.tsx`, `composer/BetComposer.tsx` |
| G-2.11 | `next.config.ts` `env:` **inlines `ZUGZWANG_ENV` into the browser bundle** — so a constants module can resolve the window once, at module scope, on both sides | `next.config.ts` `env.ZUGZWANG_ENV` |
| G-2.12 | staging: **all 8 markets `Open`, all 8 with `opened_events = 0`** — the brief's central premise, confirmed | measured |
| G-2.13 | staging: 3 markets carry **zero** bets; 5 carry bets (1, 4, 4, 9, 21 rows) | measured |
| G-2.14 | **RF-2 staging window start, MEASURED:** earliest `bet.placed` = `2026-08-21T05:29:29.430Z` → floored **`2026-08-21T00:00:00Z`** | measured |
| G-2.15 | latest `bet.placed` = `2026-08-29T16:26:57.144Z` — **inside** the proposed staging window, so **no real data is clipped** | measured |
| G-2.16 | an equivalent assertion already exists — but only as a **live-staging operational gate**, excluded from `vitest run`, so it guards nothing in CI | `tests/staging/gates.staging.test.ts:175-187` (G1.4) |

**RF-4 answer (loud, as demanded):** a `pools` read inside `replayReserveSeries` **would have
been a new query on the `/m/[slug]` path** (G-2.7) and would have moved the debate-view
round-trip pin. Moot — Slice 2 is abandoned — but recorded because the brief asked for it
before any code was written, and because it is the reason the fallback was never free.

---

## 3 · AMBIGUITIES RESOLVED (full register in the run report §7)

**#1 — `apply §5 verbatim` vs. `§5's text is now false`.**
*Chose:* apply EDIT A, C, D, F; **withhold EDIT B and EDIT E**; author no replacement;
quote every withheld byte in the report.
*Rejected:* applying B and E verbatim.
*Why:* both assert *"which is exact because the constant product is invariant across
trades"* — which `cpmm.md` §11 contradicts **by name** — and both document a fallback that
this branch does not ship. "Apply verbatim" cannot authorise committing a knowingly-false
claim into the canonical spec, unattended, and doctrine §10 forbids me to author the
correction. Withholding leaves the spec true and the debt visible; applying would leave it
false and the debt invisible.

**#2 — §17's `debate-view::price-chart-market-lifetime-domain` row asserts the reversed behaviour.**
*Chose:* **replace** it with EDIT D's `debate-view::price-chart-axis-spans-fixed-window`.
*Rejected:* leaving it beside the new row.
*Why:* exact precedent at 1.0.40, which **replaced** `debate-view::poll-refreshes-price-chart`
because "it asserted the behaviour the CHART-1 amendment reverses". The replacement row is
web-authored (EDIT D), so no text is invented.

**#3 — does the fixed window apply to the Discovery `hero` mode too?**
*Chose:* **yes — all three modes.**
*Rejected:* fixing the axis only on `collapsed`/`expanded` (the §9 surfaces) and leaving
`hero` (§22) on market lifetime.
*Why:* it is **one component and one domain computation**; a mode-conditional domain would
make the same market's line a different shape on the card and in the header, which is worse
than either option alone. Comparability across markets is *most* load-bearing on Discovery,
where all eight are seen together — the exact reason RF-2 gives. **Owed:** SPEC.1 §22 has no
amendment for this; flagged for the web lane, not authored here.

**#4 — the single-point (`series.length < 2`) flat line under a fixed axis.**
*Chose:* **no change.** Keep the full-width flat line.
*Rejected:* drawing the single point at its own `x` and no line.
*Why:* SPEC.1 §9:527 pins it — "fewer than two points … renders a **flat line at the opening
price across the domain**; there is **no empty state**" — and EDIT A does not amend that
paragraph. Read after EDIT A, "across the domain" *is* the fixed window, so the spec's own
words already govern the new behaviour and **the ruled outcome already holds** (OVN-O4).
Pinned with a guard; no code changed. Note it is near-unreachable: an `Open` market always
gains `withLiveTail`'s second point, so this needs a **non-`Open` market with zero bets**.

**#5 — `now` beyond the window end (staging, after 2026-09-10T23:45Z).**
*Chose:* **do not clamp `xPx`.** Let the SVG viewBox clip, as it already does.
*Rejected:* clamping `x` into `[0, VIEWBOX_W]`.
*Why:* clamping would draw the live price **at the wrong instant** — the precise failure
this codebase rejects twice in writing (`price-series.ts:114-134`, `price-chart.ts:96-121`:
*"a price at the wrong time is a false statement about the market, not a stale one"*).
Clipping draws every point at its true x and simply cuts off what is off-canvas, which is
honest. **OWED:** staging's window end must be extended before **2026-09-10**, or staging
charts will run their live tail past the axis.

**#6 — which environments get the staging window.**
*Chose:* `staging` **and** `preview` → staging window; everything else (`prod`, `unknown`,
unset) → **production** window.
*Rejected:* keying only on `staging`.
*Why:* preview deployments read the staging database, so a preview on the production window
would render every chart as a line crushed against the left edge — broken-looking in exactly
the surface used to review this change. Defaulting the *unknown* case to production is the
fail-safe direction: production is the only environment whose window is load-bearing.

---

## 4 · FILE MAP

| File | Why |
|---|---|
| `docs/specs/SPEC.1.md` | EDIT A (§9 X domain), EDIT C (§16.1 two constants), EDIT D (§17 rows, incl. the #2 replacement), §0 version bump |
| `docs/design/design-canon.md` | EDIT F (§10 `C-CHART-1` clause 1) |
| `src/server/config/limits.ts` | `MARKET_CHART_WINDOW_START` / `_END` + the pure `resolveChartWindow` they are built from |
| `src/components/debate/chart/MarketPriceChart.tsx` | the domain at `:91-93` becomes the fixed window; docblocks corrected in place |
| `tests/invariants/I-GENESIS-001.open-implies-market-opened-event.spec.ts` | **new** — RF-3, the run's primary deliverable |
| `tests/unit/config/chart-window.test.ts` | **new** — the constants layer: resolution per env, no conditional downstream |
| `tests/unit/debate/render/price-chart.test.tsx` | the domain guards — updated + new fixed-window / never-beyond-now assertions |
| `tests/unit/debate/render/terminal-markers.test.tsx`, `chart-overlay-a11y.test.tsx` | inherited domain assumptions, updated if red |

**Not touched, deliberately:** `src/server/cpmm/**` (no write path, no curve math),
`src/server/bets/**`, `geometry.ts`'s viewBox lock, `PriceBar`, anything CHART-2 shipped.

---

## 5 · BASELINES (OVN-V4) AND PREDICTIONS

| Baseline | Layer, and why it is the honest one | Before | Predicted after |
|---|---|---|---|
| Discovery round-trip pin | statements counted at the **drizzle client seam** the test wraps (`countingDb`) — it counts statements actually issued, not `db.select()` call sites | `1 + 11·N` and `5` | **unchanged** |
| `/m/[slug]` round-trip pin | same seam | `2, 12, 3, 9, 3, 1, 2, 3` | **unchanged** |
| Full suite | `pnpm vitest run`, whole repo | 403 files / 3766 tests / 206.88 s | **≥ 3766 + new**, green |

The axis change is **pure render arithmetic in a client component** and adds **no read**, so
the prediction is Δ = 0 on both pins with high confidence. Slice 3 adds an invariant spec
that opens its own connection, which is outside both pinned harnesses.

---

## 6 · WALLS OBSERVED

No DB writes. No `market.opened` backfill. No `staging:*` runner. No new market. No push to
`main`/`staging`/`verify`. No production interaction. No DDL, migration, event type, route
handler or dependency. No Workflow/ultracode fan-out. PR left **unmerged**.

⚠ **One read was taken against the staging database** — RF-2 requires the window start to be
*measured* ("read it, floor it, report it"). Read-only; every statement a `SELECT`. One
self-caught error in how that was guarded is recorded in the run report §9.
