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
