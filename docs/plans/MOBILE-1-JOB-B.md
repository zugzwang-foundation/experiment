# MOBILE-1 · Job B — PositionsTable at phone width

> **Status:** reviewed — all six Phase-1 questions ruled 2026-09-08, OQ-5 resolved, one question (OQ-6) deliberately left to a render. Phase 2 **not started**.
> **Date:** 2026-09-08
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **no** — no auth logic, no `src/server/`, no schema, no migration. ⚠ But it changes the presentation of a participant read surface that carries an EXIT (Sell), and it is the only surface on the phone from which a position can be closed. Full plan-then-execute ritual by instruction, not by §1 trigger.
> **Plan PR / commit:** branch `feat/mobile-1-job-b`, to be cut off `origin/main` **`f97657e`**. This plan is **commit 1**; the component change, its guard and the `parked.md` row are **commit 2**. One PR. (Job A's OQ-1 shape, approved 2026-09-07.)

---

## ⛔ Reading convention for this file, and it is load-bearing

**Every `max-mobile:` string below is written with a zero-width break — `max-mobile:&#8203;flex` — and the `&#8203;` is not decoration.** Tailwind v4's source detection scans `docs/`, so a clean class-shaped string in this file becomes a **real emitted utility in the built stylesheet** (AGENTS.md §8; `docs/logs/MOBILE-1.md` already did exactly this once). §7 R2 verifies this job's new utilities by reading that stylesheet — so an unbroken token here would make **R2 pass on a class the code does not ship**, which is the one check written to catch the failure that shipped Phase A inert twice, turned self-fulfilling by the plan describing it.

**Delete the `&#8203;` sequence before typing any class into source.** Founder-approved 2026-09-08 along with R2's precondition grep of this file; the grep's 8-broken-token positive control is what makes the convention evidence rather than a claim.

---

## Tracker context

No tracker row. MOBILE-1 is ad hoc, owned by this pod directly (ADR-0045 header; ADR-0048 header: *"MOBILE-1 (continuation; ad hoc, no tracker row)"*).

**Frame document:** `docs/adr/0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md`, accepted 2026-09-07, merged as PR #495. **This job is item 2 of its four.** Items 1 and 3 shipped as Job A (PR #497); item 4 (`/legal`) needed nothing.

**Declared dependencies and their status at plan time:**

| Dependency | Status |
|---|---|
| ADR-0048 ratified and on `main` | ✅ verified by `git show origin/main:docs/adr/0048-*.md` |
| MOBILE-1 Phase A shipped (`--breakpoint-mobile`, the `mobileResponsive` convention) | ✅ PR #486, live |
| Job A merged (items 1 + 3) | ✅ PR #497, `73593f5` |
| `PositionsTable.tsx` unchanged since the RECON base | ✅ `git diff HEAD origin/main -- src/components/profile/` is **empty**; all four cited lines verified at `origin/main` |
| An owner account holding positions on staging | ✅ **`SilverClownfish000`** — the operator placed the bets and authored the arguments 2026-09-08. ⚠ **Open tab only** unless an argument has been fully sold — see §7 R5's prerequisite |
| ADR-0048's same-commit SPEC.2 update | ⛔ **still UNPAID** — Job A's OI-2. Not this job's to pay. |
| `design-language.md` §1 item 7 redraft | ⛔ **still NOT DONE** — Job A's OI-3. Founder-ruling surface. |
| `docs/parked.md` MOBILE-1 Block D row | ⚠ Its trigger fires again, and **this job mints new tokens where Job A minted none**. The row is updated in commit 2 with a re-run census (OI-5). |

### ✅ Two corrections to ADR-0048, CONFIRMED by the founder 2026-09-08

Both are authoring errors in a ratified document, not staleness, and both are the same class as Job A's `(auth)/layout.tsx:189` citation.

1. **ADR-0048 `:62` measured the OPEN TAB ONLY.** Its `324px of fixed columns` is `Position 96 · Current 124 · Sell 104`. **The Closed tab is `Position 96 · Staked 92 · Opened 92` = 280px inside 317**, leaving the Argument column ≈ **37px** — not 0px, and equally unusable. RECON 1 `:105` said *"same shape"* in passing, **and that passing phrase was carried into a ratified document as though it had been measured.** ⇒ The fix covers **both tabs**, and *"nothing dropped"* also means **Staked and Opened**. ⚠ **The 280/37 figures are arithmetic, not a measurement** — nobody has opened the Closed tab at 375px, which is why §7 R5 insists on it.
2. **"ArgumentList already renders stacked cards and measured clean at 375px" was half-founded.** `ProfileArena` seeds `selection` from `initialProfileSelection(...)`, non-null whenever the profile holds a position — and RECON's profile held seven — so the arguments panel rendered the **replica arm** (one card under the market question), not the `argument-list` arm (the stack). **The instruction survives only because the spacing tokens are byte-identical across both arms** (`<Card className="gap-2 p-3">` inside `flex flex-col gap-3`), which is what this job byte-carries. ⛔ **The stack itself remains unmeasured at 375px.** Recorded, not fixed — it is not this job's surface.

⇒ **ADR-0048 is owed a SECOND patch record** (OI-1). ADR bodies are immutable; §5.12 sanctions the patch record.

3. **This worktree was 10 commits behind `origin/main` at plan time** (`73593f5` → `f97657e`; LIQ-1 and chart/doc work). `src/components/profile/` is byte-identical across that range, so every citation holds — but **the branch cuts off `origin/main`, not off this HEAD** (AGENTS.md §10).

---

## Approach

ADR-0048 item 2, under the founder's ruling: below `--breakpoint-mobile` each position becomes its own block with its fields on their own lines, **nothing dropped — not Sell, not Current, and (per correction 1) not Staked or Opened**. The mechanism is the smallest one that reaches that shape: **four additive `max-mobile:` tokens on four elements of the existing table**, flipping it from a table box to a stack of flex columns below 640px, so that one DOM tree keeps every `data-testid`, the ref map, the arrow stepper, `InlineSell` and the selection derivation untouched, and every desktop declaration stays exactly where it is. Spacing is byte-carried from `ArgumentList`'s card list; the two hidden column labels the Closed card actually needs are byte-carried from its own `<th>`s, so **no copy is authored anywhere in this job**. The owner arm — the Sell cell, the armed field and the `SOLD` state — takes **no token until it has been measured**, and §7 R5 states the measurement and the bounded rule that reads it.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | **no** | No write path. Every change is a CSS class token on a presentational component; no server module, no transaction, no DTO. The Sell control's `onClick` is untouched — it still calls the same `sell.confirm(tile.key, sellArgs)`. | n/a |
| 2.2 Dharma non-transferable | **no** | No ledger read or write. The `Đ` figures rendered are the same allocated strings from the same `allocateDisplayed` chain; nothing is recomputed. | n/a |
| 2.3 Side frozen at comment-time | **no** | The tile renders `lot.side` (the argument's own frozen side) exactly as today; the change is which axis its cell stacks on. No side is computed, stored or re-read. | n/a |
| 2.4 Resolutions append-only | **no** | No resolution surface touched. | n/a |

**Not a critical-path task**, so the per-invariant failure-mode paragraph does not apply.

⚠ **The property this job can actually break is not an invariant — it is a CAPABILITY.** ADR-0048's ruling rejected dropping the Sell column because *"dropping Sell removes a phone user's ability to EXIT a position, which is a capability, not a column."* Today that capability is **already** unreachable on a phone: the Sell cell renders, but inside a table whose content is destroyed. So the defect this job fixes is not cosmetic, and the way this job could fail is to move the Sell control somewhere a thumb cannot reach or an eye cannot find. §7 R5 measures the Sell control's own box on the owner render, and **no token is chosen for that cell until it does.**

---

## 2. Data model changes

**None** — presentational change. No schema, no migration, no `drizzle/`, no `src/db/`. Migration head stays `0026_lots_no_delete`.

## 3. API surface

**None** — no route handler, no Server Action, no read model. `src/server/**` is not opened. `@code-reviewer` is invoked anyway by the Job A precedent; see §7 and F-12 for how to read its answer.

---

## 4. UI / user flow

### 4.1 What is broken, measured

RECON 1 `:151-168`, on staging at `84d5756`, `/u/IndigoCat000`, **signed out**, 375×812:

| | |
|---|---|
| document overflow | **0px** — the document is clean and always will be |
| positions panel body | `scrollWidth` **348** vs `clientWidth` **317** — a nested **horizontal** scroller, because `overflow-y:auto` forces `overflow-x` to compute to `auto` |
| the table | renders **324px inside 317px** |
| column widths | Position **96** · **Argument 0** · Current **124** · Sell **104** |
| consequence | `ARGUMENT` and `CURRENT` `<th>`s both at `l=137`, overprinting; the argument body `<a class="line-clamp-4">` at **width 0** — in the DOM, invisible; only the market link escapes, at 63px, overlapping the `Đ 12` value |
| the arguments panel beside it | `scrollWidth 317 === clientWidth 317` — **clean** |

**And by arithmetic, not measurement: the Closed tab is `96 + 92 + 92 = 280` inside 317 → Argument ≈ 37px.** Enough to render a word and not a sentence. Correction 1.

### 4.2 The shape — four tokens, four elements ✅ RULED (OQ-1)

**APPROVED 2026-09-08: the display flip.** One DOM tree keeps every `data-testid`, the `tileRefs` map, the `querySelectorAll` the window cap reads, the arrow stepper, `InlineSell`, the selection derivation, and `arrangement.test.tsx`'s `thead th` order pin. The dual tree duplicates testids into suites that throw on duplicates; cards-at-every-width is replace-not-override on the most polished desktop surface in the repo.

**Edit sites, fenced by SYMBOL (O-8). Line numbers are evidence, verified at `origin/main` `f97657e`, and are not the fence:**

| # | Symbol | Evidence | Change |
|--:|---|---|---|
| 1 | the `<table>` carrying `data-testid="positions-table"` | `:839` | append `max-mobile:&#8203;flex max-mobile:&#8203;flex-col max-mobile:&#8203;gap-3` |
| 2 | its `<thead>` | `:857` | append `max-mobile:&#8203;hidden` |
| 3 | the per-market `<tbody>` inside `groups.map(...)` — **currently carries no `className` at all** | `:885` | add `className="max-mobile:&#8203;flex max-mobile:&#8203;flex-col max-mobile:&#8203;gap-3"` |
| 4 | the `<tr>` in `TileRow` carrying `data-testid={\`position-tile-${tile.key}\`}` | `:1056` | append `max-mobile:&#8203;flex max-mobile:&#8203;flex-col` |

**Why four sites and not ten.** A flex container's children are **blockified** — `display: table-cell` on a flex item computes to `block`. So making the `<tr>` a flex column blockifies all six `<td>` variants (Position · Argument · Current · Sell on Open; Position · Argument · Staked · Opened on Closed) **without opening a single `<td>`**. The same rule cascades upward: the `<table>` as a flex column blockifies its `<tbody>` children, and each `<tbody>` as a flex column blockifies its `<tr>`s. `gap-3` at both levels is what puts the same 12px between two cards in one market as between two markets — byte-carried from `ArgumentList.tsx:153`'s `flex flex-col gap-3`.

⛔ **This is reasoned from CSS Display 3, not measured. It is F-2, and it has a named fallback:** if any `<td>` still shares a horizontal band after the change, the fix is `max-mobile:&#8203;block` on each of the six `<td>`s — six more sites, one more token, same visual result. **Measure first. Do not write the fallback pre-emptively.**

**What stays exactly as it is, at every width:** `w-full`, `table-fixed`, all four `<th>` widths, `text-left text-sm`, every `<td>`'s `p-2`, `align-middle`, `text-center`, `whitespace-nowrap`, `tabular-nums`, the `<tr>`'s `rounded-(--r)`, its selection `[outline:var(--ring-active)]` and its `hover:bg-n1`. Override-never-replace (ADR-0045's surviving convention). **`table-fixed` and the `<th>` widths become inert below 640px because `table-layout` applies only to table boxes — they are not removed, they stop being consulted.**

**Zero desktop regression is structural:** every token added is `max-mobile:`-prefixed and therefore cannot match at ≥640px. This job adds **no unprefixed class anywhere**, which §7 asserts directly, and R3 measures rather than argues.

### 4.3 What each card reads, and the two labels the Closed card gets ✅ RULED (OQ-2)

**Open tab**, top to bottom: `Yes 👍` · argument title (up to 4 lines, `line-clamp-4`, now with a real width) · market question · `Đ 227` + `↑12%` · `[ SELL ]`.
**Closed tab**: `Yes 👍` · argument title · market question · `Staked Đ 100` · `Opened 12 Aug 2026`.

**Nothing is dropped.** ✓

**APPROVED 2026-09-08: labels on the Closed tab only**, byte-carrying the existing `<th>` strings `Staked` and `Opened`. **No copy is authored.** The founder's reasoning, recorded because it is the test a later reader should apply: *`Đ 100` above a bare date is not self-describing; `Đ 227 ↑12%` beside a Sell button is.*

**Implementation note, not a decision:** the label is a `max-mobile:&#8203;inline`-class span inside the existing `<td>`, hidden at ≥640px where the `<th>` already says it. It ships one further new token; R2 covers it.

### 4.4 The `InfoTip`s ✅ RULED (OQ-3) — and one is lost

**APPROVED 2026-09-08 as stated.** The Closed tab's `Staked` tip (`GLOSSARY.stakedOwn`) rides its new label. **The Open tab's `Current` tip (`GLOSSARY.currentValue`) is LOST at phone width, and that is accepted rather than repaired.**

⛔ **Do NOT invent an Open-tab label to preserve it — that is copy authoring**, and §4.3's whole justification is that the Open card needs no label. ⚠ Recorded as a named open item (**OI-6**) with its sting stated: **INFO-1 built `InfoTip` specifically to open on pointer hover *and* touch tap** — it is the one affordance in the tree designed for touch — so this is **a touch capability dropped on the touch surface**.

### 4.5 The three-tile window ✅ RULED (OQ-4) — keep it, zero diff

**APPROVED 2026-09-08: change nothing.** The body already caps at the third tile's bottom at 375px today, because the cap applies precisely *when the page can scroll*. Keeping it is zero diff and the smallest claim.

⛔ **Releasing it was rejected on mechanism, not taste:** the cap is written by an effect keyed on `doc.scrollHeight`, so a width condition would put a **breakpoint literal into JS** — exactly what `row-thirds.ts` was designed to avoid (*"needs no `1024` written down"*).

⚠ **Recorded consequence:** cards are roughly twice as tall as rows, so the windowed panel grows accordingly and the nested vertical scroller inside a page that already scrolls becomes more prominent. **If that reads badly on the real-phone check (R4), it is a separate task** — not a Phase 2 repair.

### 4.6 The ARIA loss ✅ RULED — an accepted cost, recorded as such

`display:flex` on table-internal boxes strips the implicit ARIA `table`/`row`/`cell` roles, so below 640px a screen reader stops announcing *"row 2 of 7, Current"*.

**Accepted, not discovered.** ⛔ The obvious repair is blocked: explicit `role="table"`/`"row"`/`"cell"` is redundant-role, which Biome rejects, and disabling a Biome rule is an ask-first decision (AGENTS.md §11) — the same wall `TileRow`'s own `aria-current` docblock already hit over `role="grid"`.

⚠⚠ **And the comparison that makes this a cost rather than a regression, stated in the founder's terms: the current state is worse.** The argument column renders at **0px** today, so **no phone user can presently reach the content those roles describe.** Trading a correct announcement of unreachable content for reachable content with a weaker announcement is the trade being made, deliberately. Same shape as ADR-0048's hero-chart accessibility rider.

### 4.7 ⚠ Still open — centring (OQ-6)

`Position` is `justify-center`; `Current`, `Sell`, `Staked` and `Opened` are `text-center`. In a full-width card those centre a lone `Yes 👍` and a lone `Đ 227` above a left-aligned title.

**Candidate: change nothing in v1.** Screenshot it at R1 and let the founder rule from the render rather than from this paragraph. ⚠ **This question was carried in the Phase-1 draft as a dangling "OQ-7" that appeared in §4 and in no question list** — a real defect in that draft, found by this pass and renumbered here (self-critique #14).

---

## 5. Failure modes

| # | Failure | Detect | Recover |
|---|---|---|---|
| **F-1** | **Stale compiled stylesheet.** A `max-mobile:` utility present in source and in the DOM but absent from the built CSS reproduces the exact before-state, and the measurement is then ambiguous between *"my fix does not work"* and *"my CSS never built"* (AGENTS.md §9; Phase A hit this twice, Phase B reproduced it). ⚠⚠ **Unlike Job A, this job MINTS UTILITIES** — see R2. **The probe can fail here, and that is a change in kind.** | §7 R2: static grep of `.next/static/chunks/*.css` for the escaped selectors, **confirming a non-empty result**, plus the in-page injection probe. | `just clean` then rebuild. A hard reload and a dev-server restart do **not** clear it. |
| **F-2** | ⛔ **Blockification does not happen as reasoned** and the `<td>`s regenerate an anonymous table row, so the cells stay side by side and the whole shape collapses. This is the plan's central technical bet and it is spec-reasoning, not measurement. | R1 reads each `<td>`'s `getBoundingClientRect()`: a card has cells at **increasing `top` and equal `left`**. If two cells share a `top`, it did not blockify. | **Bounded fallback, already named (§4.2):** `max-mobile:&#8203;block` on each of the six `<td>`s. Same result, six more sites, one more token. Not written pre-emptively. |
| **F-3** | **The measurement runs on an un-revealed page.** A CDP-driven tab is `document.hidden`, React 19's `$RC` reveal is rAF-gated, and every box reads `0×0` with no error. RECON revealed **2** boundaries on this exact route. | Assert the boundary count before and after the hand-reveal; assert `stillHidden === 0`; assert a **non-zero box on the element being measured**. | Perform `$RC`'s DOM operation, matching the pending-marker **set** `{"$?", "$~"}` — `$~` alone is what silently revealed nothing at BLOCK-5a. |
| **F-4** | ⛔ **A document-level probe reports green by construction, and on THIS route it already does.** RECON measured **0px document overflow** while the Argument column was 0px wide. | **Pass criterion is `positions-panel-body.scrollWidth === clientWidth`** plus per-`<td>` boxes. `documentElement.scrollWidth` is recorded for the record and is **not** a pass criterion. | n/a — this is the design of the check. |
| **F-5** | **The signed-in header contaminates every signed-in reading.** `(public)`'s header overflows 375px by ~210px on every route (`zz_MOBILE-1-SIGNED-IN-HEADER_measure_2026-09-07T2241.md`), latent since Phase A, **not this job's** — and R5 is now entirely signed-in. | Measure the panel's box and its descendants. Never the document. Report the header figure separately if it appears, labelled as the known defect. | Nothing. Do not repair it here. |
| **F-6** | **Vacuous green.** A profile with no positions, one short tile, or a Closed tab with **nothing in it** satisfies "0 overflowing descendants" trivially. ⚠⚠ **This is now the live risk on the Closed tab** — see R5's prerequisite. | R5 pins **which profile, which tab, how many tiles, and the longest argument title present**, in the PR body, and **refuses to report a Closed-tab pass from an empty tab**. | Create a Closed tile (one full sell) or report the tab as **not measured**, never as clean. |
| **F-7** | **The owner arm ships on arithmetic.** The Sell cell, the armed `InlineSell` field and the `SOLD` state render only for the owner. | ✅ **Now detectable** — OQ-5 resolved, `SilverClownfish000` holds positions. R5 measures it. | ⛔ **No token is chosen for those three cells until R5 has run.** If R5 cannot reach one of them, that one ships as a **construction argument, not measured** — in those words, never *"verified"*, never *"expected to work"*. |
| **F-8** | **The window cap against taller cards.** `useEqualRowThirds` stands down on a growable page so it is inert at 375; the cap does the opposite and applies *because* the page scrolls. | R1 records: any inline `style.height` on the tiles (expect none), and the body's computed `max-height` and `scrollHeight`. | Behaviour is **unchanged by this job** and ruled (OQ-4, §4.5). If it reads badly on R4, that is a separate task. |
| **F-9** | ⚠ **The phone loses the table's ARIA semantics.** | Source review; no automated check exists (no axe, no Playwright). | ✅ **Ruled an accepted cost** — §4.6, with the reason it is a cost and not a regression. OI-4. |
| **F-10** | **The guard passes on a token that lives in another file.** `docs/parked.md:96-99` records `MarketHeader.tsx:290` as *"guarded by coincidence"* — a scan for the STRING finds it in `DebateView.tsx` while no test opens the FILE. | The new guard opens `src/components/profile/PositionsTable.tsx` **by name**, as `debate-mobile-reflow.test.ts` does for `PostFocusHeader`. | Fix in-session before PR (§5.10 FAIL). |
| **F-11** | ⛔⛔ **This plan lives in `docs/`, which Tailwind scans, so a clean class string here EMITS the utility and makes R2 self-fulfilling.** | The reading convention at the top of this file; and R2 additionally greps this plan for an unbroken token **before** trusting the stylesheet read. ✅ Founder-approved 2026-09-08. | Break the string. ⚠ The mitigation is a discipline in a document — see self-critique #7. |
| **F-12** | **`@code-reviewer` returns a clean pass on a scope it was not built for.** Its briefing is *"diff under `src/server/`"*; this diff touches none. | Pass `@docs/plans/MOBILE-1-JOB-B.md`, state that the diff is UI + test + docs, record what it was asked and what it answered. An empty return is **NOT ESTABLISHED** (O-13). | Treat silence as silence. Do not report it as a review pass. |

---

## 6. Edge cases

- **Both tabs.** Open (`Position · Argument · Current · Sell`) and Closed (`Position · Argument · Staked · Opened`). **Both must be measured** — the Closed tab's breakage is arithmetic only and appears in no measurement anywhere.
- **The whole-holding fallback tile.** A held position with no `lots` attribution renders one Open tile with `lot: null`, no `placedAt`, and a **position-level** Sell. Identical cell set, identical card shape — but it is the tile whose Sell is most load-bearing (`lots/persist.ts:204-218`: a position the owner cannot exit is a lockout wearing a rendering bug's clothes).
- **A removed argument.** The removed variant renders the stub plus the market line and carries no title — a shorter card, exercising the "does a sparse cell still stack" case.
- **The armed sell state.** `InlineSellAmount` replaces the Current cell's content with a bordered `Đ`-prefixed input; `Confirm` + `✕` replace the Sell button. **Owner-only; reachable by tapping Sell, no write** — R5 measures it.
- **The `SOLD` state.** The Current cell becomes the `SOLD` label under an `InfoTip`. ⚠ **Reachable only by performing a real sell** — see R5's prerequisite.
- **Zero positions.** `EmptyBlock` renders instead of the table; every token in §4.2 sits on an element that does not exist. Inert by construction, and it is the state a careless measurement would call green (F-6).
- **A single market with three arguments.** Three cards in one `<tbody>`, `gap-3` between them, market question repeated three times (the ratified POSREV-POLISH P-1 cost). Exercises the intra-group gap.
- **Two markets.** Exercises the inter-group gap — the `<table>`-level `gap-3`, a **different** declaration from the `<tbody>`-level one, which can fail alone.
- **Exactly 640px.** `max-mobile:` is `<640`, so at 640.0 the table rules apply. Nothing straddles.
- **641–860px.** ADR-0048's ratified accepted gap. The table returns to `table-fixed` with 324px of columns in a body wider than 317; less broken than at 375, and **not fixed here**.
- **Phone landscape.** 812px wide — inside the accepted gap, so it renders the desktop table. Stated in advance so R4 is not read as a Job B defect.
- **`--breakpoint-mobile` vs `sm`.** Equal only at a 16px root font size (AGENTS.md §8). This job adds no `sm:` rule, so there is no hand-off to get wrong.

---

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| **Unit — source scan** (new: `tests/unit/design/profile-mobile-reflow.test.ts`) | Opens `PositionsTable.tsx` **by name** (F-10). For each of the four symbols in §4.2: the `max-mobile:` token is **present** AND the desktop declaration it overrides is **still present** (`w-full`, `table-fixed`, the four `<th>` widths) — override-never-replace, asserted, not assumed. Plus the §4.3 labels: present, `max-mobile:`-gated, and **byte-identical to the `<th>` strings they carry** (which is what makes "no copy authored" checkable). Plus: **no unprefixed class is added** by this diff. Follows `debate-mobile-reflow.test.ts`'s shape. | none — no invariant reachable |
| **Unit — regression, unchanged** | `tests/unit/profile/render/*` (11 files) and `tests/unit/design/profile-height-chain.test.ts`. Expected **all green and all uninformative**: jsdom applies no breakpoint, and no test pins an exact className on the table, `<tr>` or `<td>` (checked — the only exact-class pins in the suite are on a `ThumbGlyph` path). ⚠ Recorded as a green that proves nothing here. | none |
| **Unit — full suite** | `pnpm vitest run tests/unit/` before and after; diff the **passing test-name list**, not the count. Expected delta: the new file's names only. Anything else is a surprise (§5.10). | none |
| **Integration** | **None** — no service-layer function, no DB write, no read model. | n/a |
| **E2E** | **None installed** (no Playwright — AGENTS.md §9). | n/a |
| **Subagent review** | `@code-reviewer`, by the Job A precedent. Pass `@docs/plans/MOBILE-1-JOB-B.md`. See F-12 for how to read its answer. | n/a |
| **Browser measurement** — *not a runner; the only layer that can see any of this* | R1–R6 below. | n/a |

### Gate

`ZUGZWANG_ENV=preview just verify` (typecheck → biome → `next build`) plus `pnpm vitest run tests/unit/`. Not a critical-path task, so `pnpm test:invariants` / `test:integration` are not required by §5.7 and are untouched by a className diff. §5.10's pre-PR self-audit runs anyway, by instruction.

### The rig

Job A's — `.claude/launch.json`'s `zugzwang-prod-staging-db` (`next start -H 0.0.0.0`, port 3000) after an explicit clean build:

```bash
just clean
doppler run --project zugzwang-experiment --config stg -- \
  env ZUGZWANG_ENV=preview pnpm next build
```

⚠ The launch config runs `next start` **only**; the build above is mandatory and must follow `just clean` in the same sequence, or R2 is measured against whatever `.next/` survived. `launch.json` is still **untracked**. **The operator signs in as `SilverClownfish000`; no credential passes through the executor.**

### R1 · Measure inside the panel, never the document

Locate `[data-testid="positions-panel-body"]`. Report, **before and after**, on **both tabs**:

- its `scrollWidth` vs `clientWidth` — **pass = equal** (before: 348 vs 317);
- the `<table>`'s `getBoundingClientRect()` and every `<th>`/`<td>` box;
- **every `<td>`'s `top` and `left`** — a card has increasing `top`, equal `left` (F-2);
- every descendant with `scrollWidth > clientWidth` — count and list; **pass = empty**;
- every descendant whose `right` exceeds the panel body's `right`; **pass = empty**;
- the tiles' inline `style.height` (expect none) and the body's computed `max-height` (F-8);
- a screenshot of one Open card and one Closed card, for OQ-6;
- `documentElement.scrollWidth - clientWidth`, **for the record only** — 0px before and after, and not a pass criterion (F-4).

### R2 · Verify the NEW utilities in the built stylesheet, by class name

```bash
grep -o 'max-mobile\\:[a-zA-Z0-9\\.:_-]*' .next/static/chunks/*.css | sort -u
```

⛔ **`chunks/`, NOT `css/`** — Next 16 with Turbopack emits the app stylesheet alongside the JS chunks, `.next/static/css/` does not exist in this tree, and under zsh the wrong glob **never expands, so `grep` never runs and the output is indistinguishable from a clean pass** (AGENTS.md §9; corrected at Job A Phase 2). **Confirm the list is non-empty.**

⚠⚠ **This is where Job B differs from Job A in kind.** Job A reported R2 as *"discharged by construction, zero assurance"* because every token it could ship already existed in the built sheet. **Job B mints utilities.** Census of what ships in `src/` today — `max-mobile:` `hidden` · `overflow-visible` · `flex-wrap` · `flex-col` · `shrink` · `w-full` · `pr-6` · `p-4` · `outline-none` · `h-auto` · `basis-auto` · `max-w-[calc(100vw-24px)]` — so of the shipped set, **`flex`, `gap-3` and `inline` are NEW**, and F-2's fallback would add `block`. **R2 is capable of failing on this diff and is a real check.**

⛔ **Before trusting it, `grep -oE 'max-mobile:[a-zA-Z0-9]' docs/plans/MOBILE-1-JOB-B.md` must return ZERO** (F-11), with the broken-token count as its positive control. Verified at plan time: 0 matches, 8 broken tokens found by the same file.

```js
// runtime, at 375px — AGENTS.md §9's probe, run for each NEW token
const p = document.createElement("div");
p.className = "block max-mobile" + ":flex";      // built at runtime, never a literal
document.body.appendChild(p);
getComputedStyle(p).display;   // "flex" = compiled · "block" = NOT compiled
```

### R3 · Desktop non-regression, measured rather than argued

At **1440px** and at **641px**, on both tabs: record every `<th>`/`<td>` box, then **strip this job's `max-mobile:` tokens off the live nodes via `classList.remove` and re-measure**. **Pass = byte-identical boxes.** Stronger than the structural argument, because it tests the compiled cascade rather than the prefix.

### R4 · The rotation check — operator, real phone

`http://<mac-LAN-ip>:3000` on the same network. Portrait `/u/SilverClownfish000`, both tabs, then rotate. ⛔ **Expected reading, stated in advance: portrait must be clean; landscape is 812px, inside ADR-0048's ratified 641–860px accepted gap, and will show the desktop table.** Do not repair it — that is a new breakpoint and ADR-0048 mints none. **Also the check that reads OQ-4's consequence** (§4.5): if the windowed panel of taller cards reads badly, that is a separate task.

### R5 · The owner render ✅ (OQ-5 resolved) — and its prerequisite

**Profile: `/u/SilverClownfish000`, signed in as that account, at 375px, both tabs.** Measure, in addition to everything in R1:

- the **Sell** button's box and its distance from the card's edges — the capability §1 names;
- the **armed** state: tap Sell, then measure the `InlineSellAmount` field, `Confirm` and `✕` (no write — arming is client state);
- the **`SOLD`** state, if reachable;
- both tabs' tile counts and the longest argument title present.

⛔⛔ **PREREQUISITE, AND IT IS A PROBLEM WITH THE ORDER AS GIVEN.** `isOpenLot` is `survivingShares > 0`, and the Closed tab renders `r.lots.filter(l => !isOpenLot(l))`. **Placing bets creates Open tiles only.** Unless an argument has been **fully sold**, `SilverClownfish000`'s Closed tab renders `EmptyBlock` and every Closed-tab assertion passes over nothing — F-6 exactly, on the tab that carries the arithmetic-only correction this job exists to fix.

✅ **One action closes both gaps: one full sell of one argument.** It creates the Closed-tab tile *and* puts the `SOLD` state on screen. It is a real write to the staging ledger, so **the operator performs it**, not the executor.
⇒ **If no full sell has been made: report the Closed tab as NOT MEASURED. Never as clean.**

**⛔ PHASE 2 DECISION RULE — bounded, no third outcome:**

| R5 result | Ships |
|---|---|
| Sell / armed field / `SOLD` all inside the card, nothing overflowing or escaping | **§4.2's four tokens alone.** No token on those cells (§5.2 — ship the minimum). |
| any of the three overflows or escapes | the token R5's own boxes indicate, on **that** cell only, chosen from a measurement of **that** cell — never inferred across cells (Job A's self-critique #13). |
| a state proves unreachable | that one ships as **construction argument, not measured** — in those words. |

### R6 · Content that exercises the failing path

- **Pin the evidence in the PR body:** pseudonym, tab, tile count, the longest argument title present, and whether a whole-holding-fallback or removed-argument tile was in view (F-6).
- ⛔ **Re-take the BEFORE measurement on this rig.** RECON's `348/317`, `324`, `96/0/124/104` come from a different rig **and from a different profile, signed out**. The tree has not moved, so the shape should reproduce — but a before/after pair drawn from two rigs is not a comparison. **Report divergence rather than adopting RECON's numbers.**

### Standing browser-harness discipline (AGENTS.md §9), applied

Pin the frame **in-page** (same-origin iframe at 375px, `position:fixed; max-width:none; min-width:0`, and **throw** unless `contentWindow.innerWidth === 375`) · `await document.fonts.ready` and confirm `status === "loaded"` · inject `*,*::before,*::after{animation:none!important;transition:none!important}` · **snapshot every `getComputedStyle` value to a string at the instant it is valid** · complete the Suspense boundaries by hand, matching `{"$?", "$~"}` · `fetch('/api/health')` from inside the measured frame and throw unless `canary` is the SHA intended.

---

## 8. Out of scope

- **⛔ The signed-in `(public)` header's ~210px overflow.** Latent since Phase A, proven not-Job-A on a pre-Job-A build. **R5 is entirely signed-in, so it will be present in every reading.** Measure the panel, not the document. Not repaired.
- **The 641–860px band.** ADR-0048's ratified accepted gap. No new breakpoint is minted here.
- **The Discovery hero, `/legal`, `/m/[slug]`, `(auth)`.** ADR-0048 items 1, 3 and 4 are closed.
- **`ArgumentList.tsx`, `IdentityCard.tsx`, `ProfileTiles.tsx`, the profile `page.tsx` bands.** Measured clean at 375px in RECON 1 — ⚠ **except the `argument-list` stack itself, which correction 2 establishes was never measured.** Recorded, **not opened**: "the trigger authorises it" is how a one-component job becomes four.
- **`InlineSell.tsx`.** Measured through the table, not edited. If R5 shows it needs a token, that is a **finding to report** and a decision to take, not an in-scope edit.
- **The three-tile window cap and `useEqualRowThirds`.** Ruled unchanged (§4.5).
- **The Open tab's `Current` `InfoTip`.** Ruled lost (§4.4). OI-6.
- **A11y repair of the lost table roles.** Ruled an accepted cost (§4.6). OI-4.
- **⛔ `SPEC.1 §23`.** It **no longer exists** — SPEC.1 was rebaselined to 2.0.0 (D-29) and now tops out at §20, with §21–§23 intentionally absent. `PositionsTable.tsx:1401,1411` cite it, one of them to say *"SPEC.1 §23 IS OWED AN AMENDMENT"*; so do `LotBreakdown.tsx`, `ProfileTiles.tsx`, `partition.ts` and `IdentityCard.tsx`. **Not fixed here** — Job A's OI-5 class. ⚠ **O-9 consequence: this job writes no new prose citing `SPEC.1 §23`, and must not edit the prose that does.**
- **ADR-0048's two patch records** (OI-1).
- **`design-language.md` §1.7 and the SPEC.2 update.** Job A's OI-2/OI-3, unchanged.

---

## Rulings — received 2026-09-08

| # | Ruling | Effect on this plan |
|---|---|---|
| **C-1** | **CONFIRMED** — ADR-0048's `324px` is the Open tab only; the Closed tab is 280 in 317, Argument ≈37px; RECON's *"same shape"* was carried into a ratified document as though measured. Both tabs are in scope; "nothing dropped" includes Staked and Opened. **Second patch record owed.** | Tracker corrections; §4.1; §6; R1/R5 measure both tabs; OI-1. |
| **C-2** | **CONFIRMED** — the *"ArgumentList measured clean"* instruction was half-founded; the replica arm rendered, not the stack. The instruction survives only on the byte-identical spacing tokens. **The stack itself is unmeasured.** | Tracker correction 2; §8. |
| **OQ-1** | **APPROVED** — the display flip. ⚠ Record the ARIA loss as an **accepted cost, not a discovery**, alongside the fact that the current state is worse (0px argument today). | §4.2 ruled; §4.6 written as a rider; F-9. |
| **OQ-2** | **APPROVED** — Closed tab only, byte-carrying the `<th>` strings. No copy authored. | §4.3; the guard asserts byte-identity to the `<th>` strings. |
| **OQ-3** | **APPROVED as stated** — Closed tips ride the labels; the Open tab's `Current` tip is **lost**, accepted, named. ⛔ Do not invent an Open-tab label to preserve it. | §4.4; OI-6. |
| **OQ-4** | **APPROVED** — keep the cap, zero diff. A breakpoint literal in JS is what `row-thirds.ts` avoids. Cards ~2× taller; if it reads badly on R4, separate task. | §4.5; F-8; R4. |
| **OQ-5** | **RESOLVED** — `SilverClownfish000` holds positions; the owner render must be measured before any token is chosen for the Sell cell, the armed field or `SOLD`. | R5 + its bounded decision rule; F-7. ⚠ **The Closed tab needs one full sell first** — R5's prerequisite. |
| **F-11** | **APPROVED** — the zero-width-space convention plus R2's precondition grep, with the broken-token count as its positive control. | Reading convention; R2. |
| **OQ-6** | *Not ruled — deliberately.* Centring is left to a render. | §4.7; screenshot in R1. |

---

## Open items carried out of this plan

- **OI-1 · ADR-0048 is owed TWO patch records** — Job A's `(auth)/layout.tsx:189` → `:167` citation, and this job's Open-tab-only item-2 measurement. ADR bodies are immutable; §5.12 sanctions the patch record. **Owner: separate job.**
- **OI-2 · Six dead `SPEC.1 §23` citations in `src/components/profile/`.** D-29 removed §21–§23 rather than relocating them. Job A's OI-5 class. **Owner: separate job.**
- **OI-3 · The owner render is unmeasured as of plan close.** ✅ Path resolved (`SilverClownfish000`, local rig, operator signs in); the measurement itself has **not been taken**. Closes at R5. ⚠ **Its Closed-tab half additionally needs one full sell.**
- **OI-4 · The phone loses the table's ARIA roles.** Ruled an accepted cost (§4.6). Reopens if Biome's redundant-role position is ever revisited.
- **OI-5 · `docs/parked.md`'s MOBILE-1 Block D census** is deepened again — **by new tokens, where Job A minted none.** The row rides in commit 2 with the census **re-run by its own documented command at commit time**, never copied from this plan (Job A self-critique #15).
- **OI-6 · The Open tab's `Current` `InfoTip` is lost below 640px.** INFO-1 built `InfoTip` to open on touch as well as hover, so this is a touch capability dropped on the touch surface. Ruled accepted; reopens only with an Open-tab label, which would be copy authoring.
- **OI-7 · `ArgumentList`'s `argument-list` stack is unmeasured at 375px** (correction 2). Not this job's surface.

---

## Self-critique (re-run against the finalised plan)

Fifteen findings. **Ten survive the rulings** — seven marked LIVE, three accepted with reasons — and **five are recorded as resolved** and are **not deleted**, so Phase 2 sees what was considered. *(Counted against the table below rather than asserted: the first draft of this sentence said "six live, nine resolved" and was wrong in both halves, which is the defect this document keeps recording in other people's prose.)*

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high → **resolved** | The plan was not executable: three presentation shapes and both halves of the owner question were open. | Resolved by the rulings. §4.2–§4.6 are decisions; the one remaining question (OQ-6, centring) is deliberately deferred to a render and blocks nothing. |
| 2 | **high** | **The central mechanism is spec-reasoning, not measurement.** "A flex container blockifies its children, so four tokens reach six cells" is correct CSS and has never been observed in this tree. If it is wrong the diff triples. | **LIVE.** F-2 detects it (equal `left`, increasing `top`); the fallback is named and bounded before Phase 2 sees it. |
| 3 | high → **medium** | **The owner case — this job's actual case — is unmeasured.** | Downgraded, not closed: the *path* is resolved and the *measurement* has not happened. R5 gates every owner-arm token behind it, so the plan cannot silently proceed without it. **LIVE until R5 runs.** |
| 4 | **medium** | **"Follow ArgumentList" is answered by reusing its SPACING and refusing its STRUCTURE.** The card is a `<tr>`, not a `<Card>`. Two mechanisms producing one look, on one page — the drift `FieldSeparator` was minted to end, one register up. | **LIVE, accepted with reasons.** The structural alternative duplicates every testid and the ref map. Stated in the OQ-1 ruling rather than smoothed into "follows the pattern". |
| 5 | medium → **resolved** | The a11y loss was carried as a footnote to a layout ruling. | Resolved: §4.6 is its own ruled rider, with the comparison that makes it a cost (0px today) rather than a regression. OI-4. |
| 6 | **medium** | **The guard is a source scan and cannot see whether anything stacks.** It pins that strings are present. jsdom performs no layout; the only witness is a browser and there is no runner. | Accepted — it is every design guard in this repo. Stated so the suite is not read as proof of the fix. |
| 7 | **medium** | **F-11's mitigation is a discipline in a document.** One clean `max-mobile:` string typed into this file later and R2 silently becomes self-fulfilling. | **LIVE.** R2 carries the grep as a precondition with a positive control — a check on the document, which is the best available and is not a mechanism. |
| 8 | medium → **resolved** | Every "before" number in §4.1 was inherited from RECON's rig. | Addressed in R6, and sharpened: RECON's numbers come from a different rig **and a different profile, signed out**. Divergence is reported, not reconciled away. |
| 9 | **medium** | **The Closed-tab correction is arithmetic.** `96+92+92=280` inside a 317 measured on the Open tab. | **LIVE.** Labelled as arithmetic at every appearance; R1/R5 measure the tab, which is the point of insisting — and R5's prerequisite is what stops that measurement being vacuous. |
| 10 | low → **resolved** | The plan risked repeating Job A's *"R2 passed"* overstatement. | Resolved by measurement: three of the tokens are genuinely new, so R2 can fail. Stated as a **difference in kind** from Job A. |
| 11 | low | **The profile route's byte ceiling is asserted, not measured.** `bundle-baseline.json` is generated and this plan does not require regenerating it. | Accepted. It would only bite the dual-tree option, which was rejected. |
| 12 | **medium** | **`@code-reviewer` is invoked outside its briefing** — a `src/server/` reviewer on a diff with no server files. A clean return is silence. | **LIVE.** F-12 states the reading rule. Invoked by precedent, read as O-13. |
| 13 | **high** | ⛔ **The order as given cannot be executed on the Closed tab.** *"Measure BOTH tabs"* + *"the operator has placed bets"* do not combine: `isOpenLot` is `survivingShares > 0`, so bets create Open tiles only and the Closed tab renders `EmptyBlock`. Every Closed assertion would pass over nothing — F-6, on the tab this job's own correction exists for. | **LIVE, with a one-action fix.** R5's prerequisite: **one full sell** creates the Closed tile *and* the `SOLD` state. Operator-performed (it is a ledger write). Absent it, the Closed tab is reported **NOT MEASURED**, never clean. |
| 14 | medium → **resolved** | **The Phase-1 draft carried a dangling `OQ-7`** — cited in §4, absent from every question list, so a reader applying the rulings would have found a question nobody ruled and no list to check it against. My own defect, in the document whose job is to be checkable. | Resolved: renumbered to **OQ-6**, given its own section (§4.7) and a row in the Rulings table marked *not ruled, deliberately*. |
| 15 | **medium** | **`SOLD` cannot be measured without a real ledger write**, so it is the one owner state that may still ship on a construction argument even after OQ-5 was resolved. | **LIVE.** Named in R5 and in the decision rule's third row. The one full sell that fixes finding 13 also fixes this — which is why it is stated as one action, not two. |

⚠ **Where this plan most likely falls apart at runtime:** finding 2 (the blockification bet), and finding 13 — a Closed-tab measurement that returns green because there was nothing in the tab to measure, on the exact tab this job's own correction to a ratified ADR exists for.

---

## References

- `CLAUDE.md` — §1 (critical paths — this is not one), §5.1/§5.2/§5.3/§5.4/§5.7/§5.10/§5.11/§5.12/§5.13, §8 (O-2, O-5, O-6, O-8, O-9, O-11, O-13)
- `AGENTS.md` — §8 (the `--breakpoint-mobile` convention, its three rules, the `docs/`-scanning warning, `table-fixed`, arbitrary `text-[Npx]` leading), §9 (browser measurement — the Suspense reveal, the frame pin, the live `getComputedStyle` declaration, the stale-utility probe, the `chunks/` path), §10 (squash-merge SHAs and the merged-branch trap), §11 (Biome ask-first)
- `docs/adr/0048-…md` — the frame. ⚠ Owed two patch records (OI-1)
- `docs/adr/0045-…md` — partially superseded; the `--breakpoint-mobile` token and override-never-replace survive and govern this job
- `docs/plans/MOBILE-1-JOB-A.md` — items 1 and 3; its §7 verification requirements are carried here wholesale
- `docs/parked.md:44-153` — MOBILE-1 Block D, the unguarded-token census; deepened again (OI-5)
- `~/Downloads/zz_MOBILE-1-RECON_phase-recon_2026-09-07T1620.md` §3 — the signed-out measurement §4.1 is built on
- `~/Downloads/zz_MOBILE-1-SIGNED-IN-HEADER_measure_2026-09-07T2241.md` — the ~210px signed-in header defect, out of scope and present in every R5 reading
- `docs/specs/SPEC.1.md` §0 — §21–§23 intentionally absent (D-29); see §8
- Tracker entry: none — ad hoc, per ADR-0045 and ADR-0048 headers

---

*Plan template lives at `docs/plans/_template.md`.*
