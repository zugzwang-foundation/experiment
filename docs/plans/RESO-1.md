# RESO-1 — Market Detail resolution block, geometry pass

**Task** RESO-1 · **Branch** `feat/reso-1-resolution-geometry` · **Base** `origin/main` @ `83cf6fb`
**Mode** autonomous overnight (recon → plan → execute → deploy → report). No operator gates.
**Governing docs** `ZUGZWANG-RESO-1_overnight-brief_v1_0.md` (what) + `docs/overnight-run.md` (how).

---

## 0 · The core idea, in prose

The resolution block on Market Detail today shows a `RESOLUTION` section label, a one-line
truncated excerpt of the market's criterion, and two placeholder cards that draw no data. The
YES/NO price bar sits in the right rail under the chart.

This task removes the label and the excerpt, moves the price bar into the left column above the
block row, lets the chart grow into the space the bar leaves, and replaces the two cards with
**four evenly-placed blocks** rendered from one hardcoded fixture. Nothing is wired to data and
nothing is clickable. The point is to establish geometry so the content pass has measured
dimensions to write copy against instead of guessing from a screenshot.

---

## 1 · What recon changed about the plan

Four findings moved real work. Each is measured, not inferred.

**F-1 · The chart does not render on ANY staging market.** `market-price-chart-card` count is
`0` on all eight slugs. `MarketPriceChartHost` returns `null` for an empty series, and the
staging fixtures are raw-INSERT rather than event-backed, so the price series is empty. ⇒ R-5's
growth cannot be measured as a rendered box on the available data, and the rail today holds a
15px bar in a 188px column — **173px of empty black**, visible in the screenshot.

**F-2 · Therefore R-4 must also make the rail conditional, or it creates an empty-rail defect.**
`MarketHeader` currently passes `right={<>{chart}{<PriceBar/>}</>}` — a fragment that is never
`null`, which is why `MarketHeader.tsx:163-166` can claim "the rail is now ALWAYS rendered on the
market arm". Move the bar out and, on every market that has no chart, the rail becomes an empty
340px column — `PD-3-09` / `OD-6`, the exact defect that deleted the deferred-work placeholder
box. ⇒ `right` goes back to `priceChart ? <Chart/> : null`. This is not scope creep; it is the
orphan R-4 creates, cleaned up in the same commit (CLAUDE.md §5.3).

**F-3 · R-5's ruled outcome already holds; no chart edit is needed.**
`MarketPriceChartCard.tsx:46` is `flex-1 min-h-0` inside the rail's flex column, so it already
takes whatever the bar and the `gap-3` leave — its own docblock records the measurement
("161px against d5's 160"). ⇒ Pin with a guard, report that no change was needed (brief §4).

**F-4 · `PriceBar` is shared, but the `detail` call site is not.** Four call sites; `size="detail"`
is rendered from `MarketHeader.tsx:172` alone. ⇒ R-4's "extract or parameterise" conditional does
not fire. Moving one JSX element inside the file that owns it reaches no other surface.

---

## 2 · File map — every file touched, and why

| File | Why |
|---|---|
| `src/components/debate/MarketHeader.tsx` | R-1, R-2 (delete label + excerpt), R-3 (merge rows), R-4 (relocate bar + make rail conditional) |
| `src/components/debate/ResolverCards.tsx` | R-7, R-8, R-12 (two cards → four fixture blocks) |
| `src/components/debate/chart/MarketPriceChart.tsx` | R-6 (inline YES/NO line tags) |
| `tests/unit/debate/render/market-header.test.tsx` | encodes the superseded ruling at 8 assertions; carries G-1, G-2, G-5 |
| `tests/unit/debate/render/resolver-cards.test.tsx` | encodes "exactly two cards"; carries G-3, G-4 |
| `tests/unit/debate/render/price-chart.test.tsx` | R-6 tags + the R-5 no-change pin |
| `docs/plans/RESO-1.md` | this file |

**Not touched, deliberately:** `HeadZone.tsx` · `DebateView.tsx` · `DebateColumn.tsx` ·
`PriceBar.tsx` · `MarketPriceChartCard.tsx` · `MarketPriceChartHost.tsx` · `geometry.ts` ·
any schema, migration, ADR, SPEC or tracker.

---

## 3 · Baseline, measured before any change

Layer: a **CLI preview deploy of the base SHA itself** (`83cf6fb`), measured inside a
**pinned 1440×777 same-origin iframe** that throws on a size mismatch. Not `next dev`; not
staging (staging serves `defb62b`, which is not on `main` — it carries PFP-UI-1).

| Element | y | h | w |
|---|---|---|---|
| headzone band | 78 | 188.03 | 1384 |
| headzone-stack | 78 | 188.03 | 673.73 |
| headzone-right (rail) | 78 | 188.03 | 340 |
| chart card | — | **null — not rendered** | — |
| price bar (in rail) | 78 | 15 | 340 |
| stack kid 0 `<h1>` | 78 | 26.04 | |
| stack kid 1 meta line | 109.04 | 16 | |
| stack kid 2 `[Open] Download .md` | 130.04 | 20 | |
| stack kid 3 criterion block | 155.04 | 63.25 | |
| stack kid 4 block row | 223.29 | **56.25** | 673.73 |
| one block | | 56.25 | 332.86 |

Stack overflow `scrollHeight 202` vs `clientHeight 188` ⇒ **+14**; block row spills **13.51px**
past the band today. Page does not scroll. Full suite **388 files / 3560 tests**, exit 0.

### 3.1 · Predicted post-build value

Stack children become `h1 · mergedRow · priceBar · blockRow`, three gaps of 5px:

```
26.04 + 20 + 15 + H + 3×5 = 188.03   ⇒   H = 111.99
```

⇒ the block row can reach **~112px** and exactly fill the band. Target **≤ ~108px** so a few px
of slack absorbs font-rendering variance, and the spill goes **13.51 → 0**.
Chart, when a market ever has a series: **161.03 → 188.03 (+27.03 = bar 15 + rail gap 12)** —
derived from the rail's measured box and the `flex-1` contract, not directly rendered.

---

## 4 · Slices

| # | Slice | Exit condition |
|---|---|---|
| S1 | R-1 + R-2 — remove the section label and the criterion excerpt | full suite green; excerpt body absent from DOM |
| S2 | R-3 — meta line and actions on one row, actions right-aligned | full suite green; both present, one row |
| S3 | R-4 + R-5 + R-6 — relocate bar, conditional rail, chart growth pin, inline tags | full suite green; bar in one place only |
| S4 | R-7 + R-8 + R-12 — four fixture blocks, non-interactive | full suite green |
| S5 | Guards, reviewer cascade, full suite, deploy, report | all green; preview serves the canary |

**Full suite green at the end of every slice**, not the touched tests.

Reviewer-bearing: **S5** runs `code-reviewer` over the full diff, then `test-writer` adversarially
over the five guards. `security-auditor` and `db-migration-reviewer` are deliberately excluded —
no auth path, no ledger, no money path, no schema.

---

## 5 · Guards (§5.1), each verified by reverting its fix and watching it red

| # | Guard | The wrong answer it must reject |
|---|---|---|
| G-1 | criterion excerpt absent from the DOM, **with a positive control** on a string confirmed present | a query that returns nothing because the pattern is wrong, not because the text is gone |
| G-2 | the bar renders above the block row, exactly one instance | a bar left behind in the rail, or rendered twice |
| G-3 | four blocks, equal width, one row | three blocks, or four at unequal widths |
| G-4 | no block exposes `href` or a click handler | a block that looks or behaves clickable |
| G-5 | the existing INV-3 guards still pass, **unmodified** | greening a red by editing the guard |

⚠ G-1 must assert the excerpt **BODY**, never the word `Resolution` — the R-7 fixture ships a
block *labelled* `Resolution`, so a label-based query would pass on a page still rendering the
excerpt, and fail for the wrong reason on one that is not.

⚠ G-5's subjects are three files, asserted unmodified by an empty `git diff` on their paths:
`tests/unit/design/side-pole-binding.test.ts` (view-layer pole binding),
`tests/invariants/I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts` (canonical INV-3),
and `price-chart.test.tsx::line-tokens-bind-by-side-inv3` — the last lives in a file R-6 edits,
so that one test's body is pinned byte-unchanged rather than the whole file.

---

## 6 · Ambiguities resolved here, with the alternative rejected

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A-1 | R-3's `[Open]` names no element on this surface | `[Open]` = the `LifecycleBadge` rendering `market.status` | inventing an "Open" control | the DOM text of that row is literally `OpenDownload .md`, measured. A market's badge reads `Open` / `Closed · read-only` / … |
| A-2 | "the left column's full width" — `headzone-left`, or the stack? | the **stack** (`headzone-stack`), where the block row already lives | lifting the row out to `headzone-left`, below the media row | R-4 puts the bar "in the left column, directly above the block row"; both items use "left column" for one place, and keeping the row where it is changes less (brief §4) |
| A-3 | block orientation — the current card is a horizontal row | **vertical**: square on top, label, value | horizontal, with a bigger square | R-8 says height increases and the blocks absorb freed height; a vertical stack grows into height naturally, and "blocks" replacing "cards" reads as a shape change |
| A-4 | what fills the "value line" | an **empty** `aria-hidden` placeholder bar, exactly as today | a fixture-supplied value string | `markets` carries no resolver/logo/source/handle, and a settlement date is market content. Filling it is inventing market content — CLAUDE.md §3, and the surviving half of `ResolverCards`' own ruling |
| A-5 | rename `ResolverCards` → the name is now false for 4 blocks | **keep** the filename, export and container testid; correct the docblock in place | rename the file/component | a rename makes `AGENTS.md` §3 and `docs/parked.md` stale in a run explicitly fenced against doc edits. Flagged in the report instead |
| A-6 | R-6 tag markup — SVG `<text>` or an HTML overlay | SVG `<text>`, reusing the shipped `text-[10px]` label recipe | an absolutely-positioned HTML overlay | three axis labels already ship as in-SVG `<text>` in this component; an overlay is a new positioning mechanism on a finished surface. The `preserveAspectRatio="none"` anisotropy is documented and founder-carried at `MarketPriceChart.tsx:82-96` |
| A-7 | R-6 tag colour | each tag takes **its own line's** `--graph-*` token, as a literal — no side-keyed ternary | both tags on `fill-n5` | the graph family is deliberately separate from the INV-3 `--color-*` poles, so this cannot imply the pole encoding; identical tags would make the tag do no work the line position does not. A literal (not a ternary) keeps `side-pole-binding`'s closed inventory untouched |
| A-8 | block row responsive columns | `grid-cols-4` unconditionally | `grid-cols-2 lg:grid-cols-4` | G-3 requires one row; below `lg` the headzone stacks and the left column is full width, so four across is wider there, not narrower |

---

## 7 · What this task is NOT doing

Hyperlinking · logo assets · block copy as canon · the title clamp · any surface but Market
Detail · market content of any kind · DDL/migrations · prescriptive doc edits · merging.
Reasons are in the brief §8 and are not restated here.
