# CHART-1 — session log

**Task:** CHART-1 — the market price chart, concluded
**Mode:** autonomous overnight run (`docs/overnight-run.md` **v1.1**)
**Session:** 2026-08-26T2036 → 2026-08-26T2250 UTC (2026-08-27, ~02:06 → ~04:20 IST)
**Base:** `origin/main` = `83cf6fb` · **Branch:** `feat/chart-1` · head `1ce5fae`
**Full report:** `~/Downloads/zz_CHART-1_run_2026-08-26T2036.md`
**Review artifact:** `~/Downloads/zz_CHART-1_contact-sheet_2026-08-26T2240.html`

---

## What landed

**PR #425 — OPEN, UNMERGED**, against `main`. Nine commits, 35 files,
+2772 / −354.

| Commit | |
|---|---|
| `1cb9974` | plan |
| `9cf3ad9` | slice 1 — SPEC.1 1.0.39 → **1.0.40**, canon §2 + `C-CHART-2`, `PD-3-04`, `parked.md` |
| `88894c7` | slice 2 — `getCachedReserveWalk` (keyed on market id alone) + `withLiveTail` |
| `6cfb865` | slice 3 — hero onto `MarketPriceChart`; `PriceSparkline` deleted |
| `577e747` | slices 4+5 — terminal dots, token-bound labels, gutter, collision, domain-to-now |
| `5c6c07d` | slice 6 — shared `ChartSummary` on all three modes |
| `e5fde33` | `@test-writer` findings — the clamp bug + four false receipts |
| `9d3b4db` | `@code-reviewer` HIGH — the retro-stamp defect |
| `1ce5fae` | `@security-auditor` dispositions |

**Gate:** `pnpm build` ✅ · `tsc --noEmit` ✅ · `biome check` ✅ (6 warnings, all
pre-existing, none in touched files) · full suite **3610 passed / 0 failed**.

## Decisions made

1. **The brief's central mechanism was not built.** G-5 asserted
   `cacheComponents` was OFF and `'use cache'` absent; both are false — **SCALE
   row 2.1 already landed as S-4 (#405, #423), and #423 is this PR's own base
   commit.** The hand-rolled minimum-window memo would have nested inside a cache
   that already absorbs its calls, under a docblock calling itself provisional
   pending finished work. Built the framework-cache form instead, which EDIT B
   explicitly permits. Argument: `docs/plans/CHART-1.md` §3.1.
2. **G-10 resolved REAL, not synthetic** — the ruled outcome already held, so it
   was pinned with a guard rather than "fixed" (OVN-O4). The founder's screenshot
   is explained by the chart reading `events` while the stat line reads
   `bets`+`comments`.
3. **The key is market id ALONE**, not market id + point cap — stronger than the
   brief's RF-5, because one entry then serves both surfaces at both caps.
   SPEC.1 §9's description was corrected to match (the only deliberate divergence
   from a verbatim EDIT block).
4. **Discovery's F-1 drift `pools` read dropped** from the cached path — a
   floored history legitimately differs from a moved pool, so the check would
   fire by design. ⚠ Consequence larger than assumed at decision time; see Open.
5. **No reviewer was re-run after a fix** — doctrine v1.1 §7.1 removes F-11's
   re-run by founder ruling. The unreviewed-fix list is the mitigation.

## Open questions

1. ⛔ **The events↔`pools` drift instrument is dead in production, and the same
   commit removed the human tell** (chart and bar can no longer disagree). Both
   detectors for *a pool that moved without an event* went at once, on the money
   surface. **Re-siting is OWED** — a cron or a staging gate, never the render path.
2. **ADR-0034 needs an in-place Patch record** — §Decision names
   `loadDebateView(client, { market })`; it is now `(client, { market, walk? })`.
   Property intact, sentence false. Not authored here (doctrine §10).
3. **The hero's `YES`/`NO` labels render ≈ 3px tall.** Canon pins 10px, so
   legibility is a founder ruling. Called out inside the contact sheet.
4. **`C-CHART-2` clause 5** — coincident lines drawn coincident on a zero-bet
   market. The sheet's first cell exists to be ruled on.
5. **`/m/[slug]`'s plot renders ~5.6 % narrower** in the same CSS box (the label
   gutter came out of the viewBox). Ratified trade, or drift to correct.
6. **`loadPriceSeries` has no production caller** — keep / re-site / delete.

## Next session starts at

**Gate C on PR #425.** Read `~/Downloads/zz_CHART-1_run_2026-08-26T2036.md` §8 —
the unreviewed-fix list — **first**, then those three hunks, then the diff. `U-2`
(`src/server/debate-view/price-chart.ts:122-125`, the conditional terminal stamp)
is the one that changes behaviour on a live surface and that no reviewer saw.

## Context to preserve

- **The brief was written against a pre-S-4 repo.** Three premises false: G-5
  (comprehensively), G-1 (`fmtPct` does not exist), G-7 (nine §17 rows, not
  eight). RF-7's "missing" `/m/[slug]` budget test already existed (S-4 Phase E);
  `PD-3-04` was already fixed on two of three modes.
- **`'use cache'` THROWS outside the Next runtime** — `cacheLife() is only
  available with the cacheComponents config`. Measured. It is not merely inert,
  which is why no behavioural window test is possible here and why every cache
  guard in this PR is a source scan that says so plainly.
- **The label gutter is 38 user units**, from a *measured* advance
  (`getComputedTextLength()`: `YES` = 23.41, `NO` = 17.78 at 10px/700/0.1em),
  pinned at 26 with ~11 % headroom because Geist cannot be fetched offline.
  Added to the viewBox, never subtracted from the plot.
- **The collision case is the default state of every market** — labels overlap
  between ≈48.125 % and ≈51.875 %, which is where every market opens.

## Surprises caught + fixed in-session

- ⛔ **The retro-stamp defect** (`@code-reviewer` HIGH): with a floored history,
  stamping the terminal wrote the live price onto the *previous* event's
  timestamp — an unbounded horizontal error, and only on `/m/[slug]`, so the two
  surfaces drew different histories for the same market.
- ⛔ **The clamp that did not clamp** (`@test-writer`): the non-colliding branch
  returned unclamped, clipping above YES ≈ 98.44 % — **and the test named for the
  clamp measured the label's centre, not its box, so deleting the clamp left it
  green.**
- Removing a §17 acceptance row orphaned **three** live citations, one of them a
  passing test named after it. All three fixed in the same commit (**O-9**).

## Time

~2 h 15 m wall clock. Zero operator gates. No slice reverted, no
three-attempt limit reached, nothing CARRIED.

---

# CHART-1.A — Gate C amendment (2026-08-27, attended)

Four items found at Gate C, applied to `feat/chart-1` **before #425 merged** — the
`#324 → #325` precedent in the right order, so `main` never carries a
self-contradicting §9.

## A-1 — the non-`Open` branch kept the retro-stamp shape U-2 removed *(MEDIUM, behaviour)*

`withLiveTail`'s frozen-market branch restamped the live pool price onto the last
event's timestamp — structurally the same operation `deriveMarketPriceChart`'s
injected path already declined, in the same file, for the reason that decided it:
*a price at the wrong time is a false statement about the market, not a stale
one.* Its safety case rested on "a closed market's pool cannot move", which
`pool_unwind` waking would falsify — and on a **frozen** surface, where INV-4
means nobody re-examines it, so a false statement has no discovery path.

It now returns the series untouched. **If the pool ever moves after close the
chart and `PriceBar` will visibly disagree, and that is the correct outcome** —
true and discoverable, where a silent retro-stamp is neither.

**Two existing assertions inverted** and are rewritten, not flipped in silence —
both `tests/unit/discovery/live-tail.test.ts`, both reported in §3 of the
amendment report.

## A-2 — Discovery's `isOpen: true` literal *(LOW)* — **branch (b), and it already held**

Measured: **no cached shape carries `status`.** `DiscoveryMarketId` is
`{id, slug, title}`; `CachedMarketDiscoveryData` is
`{totals, imageUrl, series, topPosts}`; `getMarketPricingAndReserves` selects
only the two `pools` columns. `status` appears solely in WHERE clauses.

⇒ Branch (b) — keep the literal, pin the filter. **And the guard already existed**
(`live-tail-wiring.test.ts`, minted by `@test-writer` during CHART-1); verified
live by widening the filter and watching it red. The only gap was the citation,
so the literal's comment now names the guard by path.

⚠ Adding `status` to the projection was considered and rejected: a SELECT from a
query that already filters `status = 'Open'` can only ever return `'Open'`. It
would look like a read while carrying exactly the information the literal
carries. **The filter is the observation; the guard is what makes it
load-bearing.**

## A-3 / A-4 — SPEC.1 §9 *Refresh* replaced; §0 → **1.0.41**

1.0.40 described a mechanism that was never built: it called the derivation a
bespoke **memo** and said R-2 *"may replace"* it, when **R-2 is what was built**;
and it described the key as carrying the **point cap**, when the shipped key is
the **market id alone**. Both were fossils of a brief whose premise the build had
already falsified. The 1.0.40 §20 row is corrected in place — a row wrong about
its own version is an error, not history.

Two rules are promoted from code comments into the spec because the live edge
depends on them: the cached scope **reads no clock**, and the key is **not** the
pool reserves.

## A-5 — `C-CHART-2` clause 4 typography

`Collision - the default` → `—`; `|2 x YES - 100|` → `|2·YES − 100|`. Scanned the
whole clause block on three patterns; the degradation was confined to those two
lines, with the block's eight existing em-dashes as the positive control.

## Root cause, recorded because it is reusable

⚠ **A *verbatim* edit block authored on a premise the session then falsifies does
not self-correct — it hardens.** The CHART-1 brief asserted `cacheComponents` off
and no `'use cache'` in `src/`; SCALE row 2.1 had already landed as S-4 (#405,
#423 — the run's own base commit). The build measured the truth in recon and
routed around it correctly; the prescriptive text it had been told to apply
verbatim did not. **The build was right and the spec was wrong, which is the safe
direction — but only because the recon ran before the edit was applied.**

## `@code-reviewer` found two things the amendment itself missed

- **CRITICAL** — §9 still asserted *"the right edge … can never disagree with the
  bar below it"* **unqualified**, in the very paragraph A-3 replaced, plus three
  sibling sites. As written, the code would have been the thing in violation of a
  canonical spec, and the next reader would have restored the retro-stamp
  believing they were complying. **All four scoped to `Open`** — O-5 applied at
  every operative site rather than in an appendix.
- **HIGH** — the `parked.md` carry-forward row's stated harm was **false**: the
  `.md` export never serializes the price series (`model.priceChart` is
  referenced nowhere under `src/server/debate-export/`). The residual is
  unobservable dead code, not an ADR-0025-gated export-byte change. Row rewritten.
- Plus three `src/` docblocks still describing the restamp as live. All corrected.

## Owed after this merges — neither in this amendment

- **`CHART-2`** — the terminal-label gutter (founder D2: labels out of the SVG,
  into HTML). Fenced out here; its own task, reviewer pass and contact sheet.
- **The CHART-1 close-out** — register entries, PK refresh, the **ADR-0034 patch
  record**, tracker delta.
