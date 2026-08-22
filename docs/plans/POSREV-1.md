# POSREV-1 — Profile Positions surface revamp

**Ground:** `origin/main` @ `193d95adcc2b12a6d1de7b873258231e91f6fd89`
**Branch:** `feat/posrev-1` · fresh worktree `~/code/zugzwang/posrev-1`
**Mode:** autonomous overnight. No operator gates. Ambiguity is a logging event.
**Recon:** `~/Downloads/zz_POSREV-1_recon_2026-08-22T1111.md`

**Baseline suite (pre-change, this worktree):**
`Test Files 376 passed | 1 skipped (377)` · `Tests 3413 passed | 1 skipped | 4 todo (3418)`

---

## 0 · What this task is

Today the Positions table shows **one tile per market**, titled with one of the
arguments in it. A participant holding three arguments in one market sees one tile
naming one argument with a total belonging to all three, plus three unstyled rows
(`LotBreakdown`) dangling outside the tile border.

It becomes **one tile per argument, grouped under a market header**. The header is
the market and carries the market's totals; the tiles beneath are the individual
claims; each tile exits on its own.

**Vocabulary rule, pinned by test:** the word *lot* never appears in user-facing copy.
It is *your argument*.

---

## 1 · The three findings that shape the build

### F-1 · The row domain is a **JS `if`**, not SQL — RF-13 costs zero queries

`src/server/profile/positions.ts:202` selects **every** position row for the user
(`.where(eq(positions.userId, userId))`); `:208` then drops `quantity <= 0` in JS.
Widening is deleting a branch. Every downstream read is one batched `inArray` over
`marketIdList`, so a longer list is a longer `IN`, never another round trip.

### F-2 · ⚠ `computeSell` **THROWS** at zero shares — the landmine RF-13 walks onto

`src/server/cpmm/calculate.ts:126` → `requirePositive(shares, "shares")` →
`validate.ts:44` `if (!d.gt(0)) throw new CpmmInputError(...)`.

`positions.ts:416-420` calls `computeSell({… shares: held.quantity})` for every
non-settled row. **Widen the domain without a guard and every fully-exited market
throws on page load.** The guard is also the semantically correct answer: a holding
with no shares is worth exactly zero and there is nothing to compute.

### F-3 · The per-argument sell plumbing **already exists and is already documented**

`SellModule.tsx:55` takes an optional `lotId`, and its own docblock (`:44-54`) states
the exact contract RF-5/6/7 needs: *"`position.quantity` and `position.currentValue`
are the **LOT's** when a lot is named … the caller narrows them."*
`sell-convert.ts:54` returns `quantity` **byte-identical** when `dharmaIn.equals(currentValue)`.
Feed it `quantity = lot.survivingShares` and `currentValue =` RF-4's exact partition, and
an unedited seed lands the lot on exactly zero. The route already takes
`lotId: z.string().uuid().optional()` (`api/bets/sell/route.ts:44`).

⇒ **No new request path is invented.** Only the mount and the cell UI are new.

---

## 2 · File map

| File | Slice | Why |
|---|---|---|
| `src/server/profile/positions.ts` | S1 | widen the JS row domain; zero-quantity `current` guard (F-2); correct the docblock that states the old domain |
| `src/server/profile/owner-view.ts` | S1 | `isSellEligible`'s `quantity > 0` stops being defensive and becomes load-bearing — correct that sentence (orphan my change creates, §5.3) |
| `src/components/debate/format.ts` | S8 | `+ allocateDisplayed()` — the §10.8 displayed-space partition, beside `displayNetProfitLoss` / `netProfitLossDisplayed` which are its siblings |
| `src/components/profile/PositionsTable.tsx` | S3–S7, S9 | group headers, per-argument tiles, columns, inline sell mount, tabs, empty states, toggle fill, tile window, keyboard, dropdown label |
| `src/components/profile/InlineSell.tsx` | S5 | **NEW** — the cell-scoped two-step sell (RF-5/6/7) |
| `src/components/profile/LotBreakdown.tsx` | S3 | **unmounted** — its content is now the tiles themselves. File retained (see D-3) |
| `src/components/profile/selection.ts` | S6, S7 | selection keys move from market to argument; the tab predicate becomes holding-status |
| `src/components/profile/ProfileArena.tsx` | S7 | seed the per-argument SSR selection |
| `src/components/profile/copy.ts` | S6 | the two RF-14 strings (founder-supplied verbatim ⇒ carriage, not authoring) |
| `src/components/profile/ArgumentList.tsx` | S2, S9 | `SplitBar` — stack labels over figures (RF-2a); zero-state track + neutral palette (RF-2b/c) |
| `src/app/(public)/u/[pseudonym]/page.tsx` | S9 | headzone — **only if a dead band is MEASURED** (D-5) |

**Not touched:** `src/server/lots/**`, `src/server/bets/**`, `src/server/resolution/**`,
`src/server/dharma/**`, `src/server/positions/**`, `src/db/schema/**`,
`drizzle/migrations/**`, `SellModule.tsx`, `sell-convert.ts`, `requests.ts`,
`api/bets/sell/route.ts`. **No migration. No DDL. No new dependency.**

---

## 3 · Slices, in order, with exit conditions

> **FULL SUITE GREEN AT THE END OF EVERY SLICE.** Not the touched tests — the full
> suite. A slice's own tests passing against a wrong design is the known failure mode.

### S1 · DTO + row domain widening (RF-13) + statement-count measurement
- Widen the `:208` predicate to admit `quantity == 0`; drop markets that turn out to
  have **no lots** at the assembly loop (after `loadLotDecomposition`, which is already
  loaded before the loop — no new read).
- **F-2 guard:** `current` = `CANONICAL_ZERO` when `quantity == 0` and not settled;
  `computeSell` is called only on a positive quantity.
- `staked` (Đa) is already `CANONICAL_ZERO` for an exited market — `loadLotBasis`
  filters `surviving_shares > 0` (`basis.ts:93`), so `lotBasisOf` falls through. No change.
- **NEW** `tests/integration/profile-statement-count.integration.test.ts` — wraps the
  drizzle client in a counting proxy, drives the three RSC loaders at **M=1** and **M=8**,
  and **pins** the statement count. This is both the A6 baseline and the standing
  regression guard RF-13 demands.
- **EXIT:** statement count at M=1 and M=8 is **identical** to the pre-change number;
  a fully-exited market yields a row with `quantity=0`, `staked=Đ0`, `current=Đ0` and its
  lots; full suite green.

### S2 · Formatting (RF-4 formatting, RF-2a)
- `PositionsTable.tsx:1102` — `({pl.sign}Đ{pl.magnitude})` → `({pl.sign}Đ {pl.magnitude})`.
  **The sign branch is untouched** (recon A7: `Đ 0` unsigned is already RF-4's target).
- `ArgumentList.tsx` `SplitBar` — Support/Counter labels stack **over** their Đ figures.
- **EXIT:** every Đ on the surface reads `Đ <space> N`; `no-raw-dharma-render` green.

### S3 · Group header + one tile per argument (RF-3)
- `<tbody>` per market group. Group header `<tr>`: `market title · Đa → Đb`, always
  expanded, never collapsible, `sticky` under the column header.
- One `<tr>` per **lot** beneath it.
- The per-tile market subtitle is **removed** (`ArgumentCell`'s `marketLine`) — the
  header names the market now.
- `LotBreakdown` is unmounted; its per-lot title/figure/strikethrough move into the tile.
- **The header figures are the position's existing `staked` / `current`. Nothing is
  recomputed per tab** — `I-LOT-SUM-001` guarantees Σ surviving lot shares ==
  `positions.quantity`, so Đa is already Σ surviving lot bases and already equals the
  sum of the Open tab's tiles.
- **EXIT:** a 3-argument market renders one header + three tiles; `"lot"` appears in no
  rendered text; full suite green.

### S4 · Columns + stacked CURRENT cell (RF-4)
- Open tab: `POSITION │ ARGUMENT │ CURRENT │ SELL`. **STAKED deleted**; the `w-[16px]`
  arrow track deleted with it (it existed only to separate Staked from Current).
- CURRENT stacks three lines: `Đ 151` / `(+Đ 1)` / `from Đ 150`.
- **EXIT:** four `<th>`s in that order; `table-fixed` still binds every width (AGENTS.md §8).

### S5 · Inline sell (RF-5/6/7)
- **NEW** `InlineSell.tsx`. Resting = `SELL`. Armed = numeric input in the CURRENT cell,
  `CONFIRM` + `✕`, Escape and click-outside cancel, delta + "from" lines hidden.
- **One row armed at a time** — the armed `lotId` is lifted to `PositionsTable`.
- **THE SEED (D-2 below).** Exact partition held in state; rounded figure displayed;
  untouched ⇒ the **exact** value is submitted.
- Clamp above max ⇒ silently return to the untouched state (displays the rounded max,
  submits the exact max). No error state.
- Plumbing reused verbatim: `sellSharesFor`, `buildSellRequest`, `idempotency.ts`
  (`initialKeyState`/`reduceKey`), `envelope.ts`, `state-map.ts`.
- The position-level `SellModule` mount is **removed**; the file is retained.
- **EXIT:** an untouched input submits the exact seed (asserted); a second SELL closes
  the first; Escape and outside-click both cancel; full suite green.

### S6 · Open/Closed = holding status (RF-13) + Closed columns + count + empty states (RF-14)
- Tab predicate becomes **per-argument**: `survivingShares > 0` ⇒ Open, `= 0` ⇒ Closed.
  **`surviving_shares = 0`, never zero basis** — the CHECK is one-directional
  (`db/schema/lots.ts:186-189`), so zero basis is a strict superset that would retire a
  dust lot still holding sellable shares.
- Closed columns: `POSITION │ ARGUMENT │ STAKED │ OPENED` (`originalBasis` / `placedAt`).
  No CURRENT (it would read `Đ 0` on every row), no SELL.
- Closed group header: market title + `Σ originalBasis` of that market's closed
  arguments, labelled `STAKED`. **No `Đa → Đb`** — both would read `Đ 0`.
- `Closed` label carries an incrementing count.
- RF-14's three empty states.
- **EXIT:** a split market renders in **both** tabs with the correct tiles in each;
  labels are exactly `Open` / `Closed`; full suite green.

### S7 · Position column, toggle fill, three-tile container, keyboard (RF-8/9/10/12)
- Position cell: side word + thumb, **larger**, **top-aligned to the argument title's
  first baseline**. `Open` badge **deleted**. No marker chips (recon A14: none exist on
  this surface beyond the status badge and `Sold`).
- Toggle: selected option **fills the block** with `n6`/`n7` and inverts the label.
  ⛔ **not `#fafafa`** — that is the NO pole under INV-3, inches from chips reading "Yes".
- Container: fixed height at exactly **three argument tiles**; group headers sticky and
  **do not consume a slot**; free scroll, **no scroll-snap**; same in the Closed tab.
  Height is measured off the **actual rendered tile**, never a constant.
- Keyboard: auto-select the **first tile** on load; **no auto-focus**; roving tabindex;
  arrows act once the region has focus.
- **EXIT:** measured tile heights equal; the 4th tile is below the fold and reachable
  by scrolling; page load steals no focus; full suite green.

### S8 · Display rounding partition (RF-15)
- `allocateDisplayed(parentExact, childExacts): string[]` in `format.ts` — round the
  parent from its **exact** value, floor each child, hand the residual out one unit at a
  time to the largest remainders (ties by index). Chained at two levels:
  `Positions-value tile == Σ displayed group headers` and
  `each group header == Σ displayed tiles`.
- Display arithmetic only. **No query, no stored value, no server change.**
- **EXIT:** at figures chosen to FORCE a remainder, both identities hold exactly.

### S9 · Dropdown label (RF-1), S/C bar zero state + palette (RF-2b/c), headzone (RF-11)
- Dropdown reads the **selected market's title**, or `All markets` when none — never
  `Select market`. It keeps scoping the Positions block **only**.
- S/C bar at `Đ 0` / `Đ 0` renders an **empty neutral track**, no fill; fill moves off the
  `#181818` / `#fafafa` poles onto the neutral ramp.
- Headzone: **measure first** (D-5).
- **EXIT:** a 0/0 bar has zero fill width and a neutral track; `side-pole-binding` and
  `tokens-monochrome` green.

### S10 · Full suite, reviewer cascade, fixes, deploy
`@test-writer` → `@code-reviewer` → `@security-auditor` (sell path only), **sequentially**
(concurrent subagent vitest saturates the local Postgres). Act on findings in-session.
Push, open PR against `main`, **leave it open and unmerged**, capture the preview URL.

**Reviewer-bearing (read-path / money-path) slices: S1, S5, S8.**
S1 changes a server read model; S5 touches a money path; S8 is the arithmetic the two
displayed identities rest on.

---

## 4 · Decisions taken without an operator (kickoff §0)

**D-1 · RF-13's fourth Closed column = `placedAt` / `OPENED`.**
*Rejected:* adding `lots.updated_at` to the existing select (which would cost **zero**
queries) and labelling it `EXITED`.
*Why:* RF-13's conditional keys on *"already in the DTO"*, and it is not; and
`updated_at` is **last-touched**, not exited — on a lot sold twice it is the second sell,
and on a never-sold lot it equals `createdAt`.

**D-2 · The seed displays the RF-15 allocated figure, not `round0(exact)`.**
*Rejected:* seeding the input from `formatDharmaExact(exact)` (SellModule's own idiom).
*Why:* two reasons. (i) The figure in the input must equal the figure in the CURRENT cell
the user is looking at, and after RF-15 that is the **allocated** integer, which can
differ from `round0(exact)` by 1. (ii) It keeps the new code out of the `dround-allow`
allowlist entirely — `no-raw-dharma-render.test.ts:161` pins
`expect(markers).toHaveLength(1)`, so a second marker would redden it.
**The exact value is still what is submitted when the field is untouched**, and it is the
same string handed to `sellSharesFor` as `currentValue`, so `:54`'s byte-identity branch
fires and the lot lands on exactly zero.

**D-3 · `SellModule.tsx` is unmounted, not deleted.**
*Rejected (a):* deleting it — RF-5 says "just remove this mount", §5.3 says leave
pre-existing code, and six test files mount it directly.
*Rejected (b):* mounting it inline in the CURRENT cell with `lotId` + narrowed figures —
its anatomy (SideBadge · "Position" label · live You-receive quote · Cancel · Sell)
contradicts RF-4/5/6's explicit cell description and would put a second Đ figure and a
live quote inside a 118px column.
*Note:* it is mounted **nowhere else** in `src/` (recon A11), so it becomes unmounted
production code. Flagged in the run log.

**D-4 · Marker-chip removal is scoped to the Positions panel.**
`ArgumentList.tsx:446` renders `<PositionMarker>` (with `aria-label="Author Flipped"`),
and `ArgumentList` also carries an ADR-0039 R6 `Sold` tag. Those are in the **right-hand
argument panel**, not the positions table.
*Chose:* remove the status badge + `Sold` tag from the **Positions panel** only.
*Rejected:* also stripping `PositionMarker` and the R6 `Sold` tag from `ArgumentList` on
the strength of §3's "None. Anywhere."
*Why:* recon **A14 asks specifically about "the positions table"**; every RF item that
names a location names the positions surface; and `ArgumentList`'s tags are ADR-0039 R6
renders bound to the ranking basis, which §3 forbids touching ("no ranking work").
**Flagged for the founder** — if the intent was the whole page, it is one follow-up.

**D-5 · RF-11 is measured before it is encoded.**
`page.tsx:384` is already `grid gap-4 lg:h-[188px] lg:grid-cols-2 lg:grid-rows-[188px]`
— every height token is **`lg:`-scoped**, so below `lg` the band is one content-sized
column holding one child, and **there may be no dead 188px band to collapse**.
*Chose:* measure the below-`lg` headzone height on the preview and act only on a
measured dead band; report the measurement either way.
*Why:* a ruled outcome can be right while the stated mechanism is not, and the
measurement arbitrates.

**D-6 · `positionsFiltered` becomes unreachable and is retained unrendered.**
RF-14's three cases are evaluated over the **market-scoped** row set. `marketOptions` is
built from `rows`, so every option has ≥1 row, and every row lands in exactly one tab ⇒
at least one tab is always non-empty. The string stays in `copy.ts` on the shipped
precedent of `PROFILE_COPY.chip` (`PositionsTable.tsx:1309`).

**D-7 · The `<table>` stays; the group header is a sticky `<tr>` at a MEASURED offset.**
*Rejected:* a CSS grid. `PositionsTable.tsx:656-663` records why — two tables cannot
share column widths, and a grid needs an explicit track template whose only available
source is the mockup's five light-prototype literals (VALUE RULE).
`table-fixed` is what makes the widths bind (AGENTS.md §8).
The thead height is written to a CSS custom property by the **effect that already
measures the tile window**, so the group header's `top` is measured, never typed.
⚠ Tailwind preflight sets `border-collapse: collapse`, under which sticky **table cells**
do not stick in Chrome — so sticky goes on the **`<tr>`**, which is what the shipped
`<thead className="sticky top-0">` already relies on. **To be verified in a real browser
on the preview**, not reasoned about; a failure is logged and the header ships non-sticky.

---

## 5 · Tests

**Required by the kickoff:**
1. `textContent`: the string `"lot"` appears in **no** user-facing copy.
2. The Sold predicate is `surviving_shares = 0`, **with a positive control** that a dust
   lot (zero basis, non-zero shares) is **NOT** retired to Closed.
3. `Σ displayed tiles == displayed group header` and `Σ displayed headers == the
   Positions-value tile`, at figures chosen to **force** a rounding remainder.
4. An untouched sell input submits the **exact** seed, not the displayed value.
5. A split market renders in **both** tabs with the correct tiles in each.
6. RF-14 empty-state copy, all three cases.

**Added by this plan:**
7. Statement count at M=1 and M=8, pinned (S1) — the RF-13 no-N+1 guard.
8. A fully-exited market does **not** throw (F-2 regression guard) — the arm that would
   have called `computeSell` with zero shares.

**On controls:** *a control that does not exercise the failing syntax is not a control.*
Test 2's control uses a lot with `surviving_basis = 0 ∧ surviving_shares > 0` — the exact
state the one-directional CHECK permits — not a literal stand-in.

**Existing tests expected to move** (behaviour changed deliberately, updated with reason,
never "fixed" by restoring old behaviour): `tests/unit/profile/render/{sell,surface,
selection,panel-filter,row-window,lot-breakdown,arrangement,keyboard-anchor,
struck-and-held}.test.tsx`, `tests/unit/profile/initial-selection.test.ts`,
`tests/unit/design/profile-height-chain.test.ts`.

---

## 6 · Statement-count contract

**Measured pre-change and re-measured post-S1 by the same test.**
`loadProfilePositions` issues a **fixed** number of statements, independent of M —
positions · payoutEvents · markets · pools · bets · events · comments · `loadLotBasis` ·
`loadLotDecomposition` · `loadRemovedSet`. Widening the domain lengthens the `IN` lists
and adds **no** statement.

**Predicted post-build count: identical to baseline at both M=1 and M=8.**
If it rises, the widening was done wrong and is folded back in rather than accepted.

---

## 7 · Closing ritual

Does `CLAUDE.md` / `AGENTS.md` change as a result? Candidates, decided at S10:
- AGENTS.md §3's `components/profile/` inventory gains `InlineSell.tsx`.
- AGENTS.md §9's `tests/integration/` count moves by one.
- A `computeSell`-throws-at-zero gotcha, if the reviewers agree it generalises.
