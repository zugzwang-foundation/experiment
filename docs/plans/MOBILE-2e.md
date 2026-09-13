# MOBILE-2e — round-5 refinements (market detail + profile), then PR #517 merge-ready

**Task:** MOBILE-2e · **Branch:** `feat/mobile-2-market-detail` (continued, no new branch) · **PR:** #517, stays DRAFT
**Base measured at plan time:** `HEAD 6d0f467b` · `origin/main 09850b9c` (0 commits ahead of HEAD — main has not moved) · `origin/staging 6d0f467b`
**Mode:** autonomous, unattended, no operator gates · **Doctrine:** `docs/overnight-run.md` v1.2
**ADR:** 0051 amendment **A4**, committed verbatim with this plan.

> ⚠ **CLASS-TOKEN CONVENTION IN THIS FILE.** Tailwind v4's source detection scans `docs/`, so a
> class-shaped literal written here becomes a real emitted utility and the built stylesheet stops
> being evidence of what components use (AGENTS.md §8). **Every phone variant below is written with
> a MIDDLE DOT in place of the colon** — `max-mobile·h-8` means `max-mobile` + `:` + `h-8`. Nothing
> in this file is scannable.

---

## 0 · The core idea, in prose

Two surfaces, ten ruled refinements, and not one of them may move a desktop pixel.

On the **market/thread pages** the phone reader meets three small wrongnesses: a submit button that
reads hollow because it is a dark fill on an identically dark ground; a Support/Counter bar whose
pill is 44px tall while the track beside it is 24px, so the three Đ figures under them do not share a
line; and a gloss popover that opens on the same tap that opens the reply sheet and then hangs over
the argument field, because on touch there is no hover to end it. Each is fixed with tokens that are
inert above 640px, except the tooltip — which is gated in `info-tip.tsx` on the tier hook, whose
snapshot is `false` by construction at and above 640px and in jsdom.

On the **profile** the phone reader currently meets a stack of centred tiles, because MOBILE-1 Job B
flipped the table into a column and let every `<td>`'s inherited `text-center` survive. The ruling is
that the phone should read the DESKTOP row — side glyph, argument over market, value, SELL — and be
able to act on it. Acting means Sell, which is the one comment-free action this product has, and on a
phone it happens in the same bottom sheet the composer uses.

The last thing this run does is not a refinement at all: it puts PR #517 into a state a reviewer can
clear in ninety minutes, by consolidating three runs' worth of unreviewed hunks into one packet with
current line numbers.

---

## 1 · Slices, in order, each with its exit condition

| # | slice | exit condition |
|---|---|---|
| **S0** | plan + ADR A4 commit | committed; `just verify` green |
| **S1** | Market/thread — R-M1, R-M2, R-M3, R-Q1, R-Q2 | x-edge pairs equal at 375/390; identity line 2 = 1 line at 360/375/390/430 for normal/sold/badge; zero `[role=tooltip]` after tapping Support at phone width on M2 and M3; **B1 = 0**; full suite green |
| **S2** | Profile — R-P4, R-P1, R-P3 (+ Sell in sheet), R-P2, R-P5 | B13 column x's aligned at 375; a local sell COMPLETES through the sheet; **B1-p = 0**; full suite green |
| **S3** | Half B — merge `origin/main` if moved, full suite, both B1s, touch matrix, re-measure B7/B8/B10, regenerate SURFACES/STATE/parked/AGENTS, push, CI green | CI green on the pushed tip; both B1s = 0 |
| **S4** | guards reversal-verified · reviewer cascade · fixes · unreviewed-fix list · Gate C packet · final push · preview verified | packet written and reviewed by `@code-reviewer` for accuracy; CI green on the final tip |

**Full test suite green at the end of every slice. B1 and B1-p re-measured after every slice.**

---

## 2 · File map — every file this run touches, and why

### Half A · market and thread

| file | why | shape of the edit |
|---|---|---|
| `src/components/debate/composer/BetComposer.tsx` | R-M1 — the submit's fill, height and disabled treatment | additive `max-mobile·` tokens on the `<Button>` only |
| `src/components/debate/AggregateFooter.tsx` | R-M2 — **this is the phone-visible split bar, not `ReplySplitBar` (§P-1)** | additive `max-mobile·` tokens on the pill, the track box, the track, and the two flank figures |
| `src/components/ui/info-tip.tsx` | R-M3 — no tooltip mounts below 640px | ONE early return gated on `useIsPhoneTier()` |
| `src/components/debate/ArgProfile.tsx` | R-Q1 — chips and lane badge to line 1 | additive `max-mobile·order-*` on existing children; NO DOM re-ordering |
| `src/components/debate/phone/PhoneSheet.tsx` | R-Q2 — the velocity arm's travel floor | one new named constant + one `&&` |

### Half A · profile

| file | why | shape of the edit |
|---|---|---|
| `src/components/profile/IdentityCard.tsx` | R-P4 — PFP 56px beside the pseudonym, vertically centred | additive `max-mobile·` tokens |
| `src/components/profile/ProfileTiles.tsx` | R-P4 — three across, two rows, at phone width | additive `max-mobile·grid-cols-3` + label/value sizes |
| `src/components/profile/PositionsTable.tsx` | R-P1 (one header row), R-P3 (desktop-shaped rows + SELL 44px + the sheet mount), R-P5 (order) | additive `max-mobile·` tokens on the head, the `<tr>` and each `<td>`; one `useIsPhoneTier()` branch that mounts the sell sheet |
| `src/components/profile/ArgumentList.tsx` | R-P2 — the viewer panel is not rendered below 640px | one additive `max-mobile·hidden` on the panel root |
| `src/components/profile/phone/PhoneSellSheet.tsx` | **NEW** — the phone's sell surface | a phone-only leaf under `profile/phone/` (ADR-0051 A4 D-2) |
| `src/components/debate/badges.tsx` | R-Q1 — the chips need a `className` to carry their order token | ⚠ **MISSING FROM THIS MAP UNTIL `@code-reviewer` NAMED IT.** An optional prop merged through `cn`, so an absent one is byte-identical; required by R-Q1 and reachable nowhere else |
| `src/components/debate/phone-tier.ts` | the tier hook gains 33 consumers this round | ⚠ **ALSO MISSING.** One shared `MediaQueryList` instead of one per subscriber AND one per render — see §4 A-12 |

### Guards (new) — ⚠ CORRECTED IN PLACE AFTER THE BUILD

This section planned five separate design-guard files, one per register item. **They shipped as ONE**,
`tests/unit/design/phone-round-five.test.ts`, and the reason is worth keeping: every one of them
would have opened the same handful of source files, re-declared the same runtime-assembled variant
prefix and the same comment stripper, and re-proved the same recognisers. Five files would have been
five copies of the apparatus and one assertion each.

What actually shipped:

| file | rows | what it is |
|---|--:|---|
| `tests/unit/design/phone-round-five.test.ts` | **24** | NEW — source scans for R-M1 · R-M2 · R-M3 · R-Q1 · R-P1 · R-P2 · R-P3 · R-P4, plus two positive-control rows that prove the recognisers fire before any of them runs. ⚠ It shipped at 20 and gained four at the final gate, after an adversarial pass found seventeen mutations the set could not catch |
| `tests/unit/profile/render/phone-sell-sheet.test.tsx` | **9** | NEW — jsdom, mounting the leaf DIRECTLY. ⛔ **The reason given here for mounting it directly — that the host cannot be reached in jsdom — was FALSE**, and the file's own docblock now says so. `useIsPhoneTier` reads `window.matchMedia`, and a per-query stub mounts the phone arm through the real host |
| `tests/unit/profile/render/phone-sell-host.test.tsx` | **9** | NEW, **not planned** — the host-mounted counterpart, written at the final gate. It proves at RUNTIME what this plan filed as source facts: the row `contains` the sheet, the two arms are exclusive, a tap inside does not cancel the arm, the wire carries the exact holding, the seed is the ceiling, an empty amount cannot be confirmed, the body lock goes on and comes off |
| `tests/unit/debate/render/arg-profile-row.test.tsx` | **+3** | the R-Q1 lift proved to REACH THE DOM rather than to exist at the call site — deleting the `className` merge in `badges.tsx` had been green everywhere |
| `tests/unit/design/profile-mobile-reflow.test.ts` | 4 changed, 1 added | MOBILE-1 Job B's guards, INVERTED for round five |
| `tests/unit/debate/phone/phone-sheet-swipe.test.tsx` | +2 | the 24px travel floor, with its own control at 24px exactly |
| `tests/unit/ui/info-tip.test.tsx` | +3 | the tier gate, plus a per-query `matchMedia` stub (a blanket one had been answering the pointer question AND the viewport question with one value) |
| `tests/unit/design/composer-fit.test.ts` | 1 changed | its 400-character window widened to 1200 and its silent-degradation arm removed |

**29 mutations, 29 reds** — every guard verified by reverting the fix it exists to catch.

Every new guard **assembles the `max-mobile` prefix at runtime** (`const V = "max-mobile"; const S = ":"`),
per `profile-mobile-reflow.test.ts:112-115`, so no guard emits a utility into the built sheet.

---

## 3 · Per-item design, and the trap each one has

### R-M1 · `PLACE Đ BET`

Today: `<Button className="h-auto min-h-[44px] flex-col gap-0 self-stretch px-3 py-1 …">` with two
spans (`Place`, `Đ BET`); enabled it resolves to `bg-(--btn-fill)` = `#181818` on a `#181818` ground
with a `#404040` hairline — dark on dark, which is what reads as hollow. Disabled is the same box at
`--state-disabled-opacity: 0.5`, inherited from the cva base.

Build, phone-only:
- `max-mobile·h-[52px]` (the ruled height) — the base keeps `h-auto min-h-[44px]`, so
  `composer-fit.test.ts:168-184`, which requires `h-auto` AND a `min-h-[N≥44px]`, still passes.
- `max-mobile·bg-ink max-mobile·text-ground` — the bar's primary fill.
- `max-mobile·text-sm max-mobile·font-extrabold max-mobile·tracking-[0.06em] max-mobile·uppercase`
  on the button, matching `PhoneBottomBar.tsx:169`'s live weight/size/tracking.
- Disabled: `max-mobile·disabled:opacity-100 max-mobile·disabled:bg-n2 max-mobile·disabled:text-n5`
  — a SOLID dim fill from the neutral ramp with muted text, replacing the 0.5-opacity hollow.
- ⚠ **`bg-(--btn-fill)` is unprefixed on the primitive and `max-mobile·bg-ink` is a different twMerge
  group key, so BOTH survive the merge and the winner is decided by Tailwind's emitted variant
  order, not by twMerge.** That is measured in a real browser before it is believed — the
  stale-utility probe first, then the computed `background-color` at 375.
- ⚠ The label stays TWO spans. **Ambiguity A-1** below.

### R-M2 · the Support/Counter row — on `AggregateFooter`

- pill: `max-mobile·h-8` replacing `max-mobile·min-h-11` (32px, ruled), `max-mobile·text-[13px]`,
  `max-mobile·font-semibold`, radius token unchanged (`rounded-(--r-chip)`).
- the 44px tap target comes back as a pseudo-element: `max-mobile·relative`,
  `max-mobile·after:absolute max-mobile·after:inset-x-0 max-mobile·after:-inset-y-1.5
  max-mobile·after:content-['']`. **6px each side on a 32px box is exactly 44.** No handler.
  ⚠ `<Card>` is `overflow-hidden`; the extension is vertical and the card's padding is 12px, so it
  is not clipped — measured, not assumed.
- track box: `max-mobile·h-8` so its centre sits where the pill's does.
- track: `max-mobile·h-[6px]` (the base `h-[18px]` literal is untouched, so
  `split-bar-parity.test.ts` and `aggregate-footer-alignment.test.ts` both still read it).
- the three figures: the row root is already `text-xs` (12px); the centre `<b>` is `text-sm`, so it
  gets `max-mobile·text-xs`. The `<span className="tracking-[0.1em] uppercase">` literal is pinned
  by the parity guard and is **not touched**.

### R-M3 · tooltips do not mount on the phone tier

ONE gate, in `src/components/ui/info-tip.tsx`:

```
const isPhone = useIsPhoneTier();
if (isPhone) return <>{child}</>;
```

Why there and not at the call sites: **every** phone-reachable InfoTip lives in a component the
desktop tree also renders, and five of the six carriers are SERVER components (`badges.tsx`,
`ArgProfile.tsx`, `AggregateFooter.tsx`, `PriceBar.tsx`, `DharmaFigure.tsx`, `MarketHeader.tsx`) —
they cannot take a hook without a boundary change. A threaded prop would have to reach
`PhoneDebateView → PostCard → ArgProfile → badges`, and one unthreaded hop leaves a tooltip mounted:
exactly the `GlobalHeader → RulesControl → OnboardingDeck` failure AGENTS.md §8 records.

Desktop neutrality is by construction: `useIsPhoneTier`'s query is `not all and (min-width: 640px)`,
its `getServerSnapshot` is `false`, and its `getSnapshot` returns `false` when `window.matchMedia` is
absent — which is jsdom. So SSR is byte-identical, ≥640px is byte-identical, and every one of the
existing render tests observes the unchanged branch.

The census (eight phone-reachable render sites) is in the QA log; the `title` attributes are
**deliberately left** — see **Ambiguity A-3**.

### R-Q1 · identity-row chips to line 1

Measured BEFORE: at 375/390/430 the SOLD row and the BADGE row each wrap line 2 onto two lines; at
360 a third (a long pseudonym + a Đ 120 stake) does too. The fix is **ORDER, not DOM order** — the
row must not move a desktop pixel, and at ≥640px every `max-mobile·` token is inert while document
order IS the layout (`ArgProfile.tsx:172-178` records that lifting the pseudonym out was rejected for
exactly this reason).

The wrapping area is a `flex-wrap` row whose phone shape comes from `max-mobile·basis-full` on the
pseudonym link and `max-mobile·contents` on Group A. Adding `max-mobile·order-*` lets the chips and
the lane badge sit on line 1 without moving a node:

- pseudonym link — `max-mobile·order-1`, and `max-mobile·basis-full` is REPLACED by
  `max-mobile·basis-auto` so line 1 can carry company. The line break is then produced by giving the
  FIRST line-2 field `max-mobile·basis-full` instead.
- the side-badge span holds `SideBadge` + `PositionMarker`; the chip must go to line 1 while the
  badge stays on line 2, so **the chip's own order token moves it** — `PositionMarker` and the
  `Sold` span each take `max-mobile·order-2`, and everything that stays on line 2 takes
  `max-mobile·order-3` or higher. Group A is `contents` at phone width, so its children are real flex
  items and `order` applies to them directly.
- `LaneBadge` takes `max-mobile·order-2` too.
- ⚠ Two shipped guards assert the OLD arrangement in DOCUMENT order —
  `arg-profile-row.test.tsx:87-112` (`Flipped` inside Group A; the badge AFTER the age) and
  `relative-time-placement.test.tsx:579-620` (`spokenAfter(age)` contains `Highest Stakes`). Both
  read jsdom at desktop width, where `order` is inert and document order is unchanged, **so both keep
  passing** — which is the whole argument for doing this with `order` rather than by moving nodes.

### R-Q2 · the flick floor

`PhoneSheet.tsx:393-399` is `if (travelled >= SWIPE_CLOSE_PX || velocity >= SWIPE_CLOSE_VELOCITY)`,
with `elapsed` floored at 1ms — so a 1px drag released within 1ms yields velocity 1.0 and dismisses.
Add `const SWIPE_MIN_TRAVEL_PX = 24;` and require `travelled >= SWIPE_MIN_TRAVEL_PX` on the velocity
arm only. ⚠ `phone-sheet-swipe.test.tsx:136-141` re-reads BOTH existing constants out of the source
by regex; the new one is mirrored there in the same commit or that row reds.

### R-P4 · profile header

`IdentityCard` is already a `flex-row items-center gap-[18px]` with a 56×56 PFP and a 20px pseudonym
span — **the ruled shape already holds below `xl`**, except that the pseudonym is not a link. R-P4
says "pseudonym as a link". ⚠ **Ambiguity A-4.** Tiles: `grid-cols-2 sm:grid-cols-3` today, so at
phone width they are 2×3; the ruling is 3×2, so `max-mobile·grid-cols-3` is appended (it wins over
`sm:grid-cols-3` below 640px because `sm` does not apply there, and over the base `grid-cols-2`
because it is more specific in Tailwind's emitted order). Label 10–11px: `max-mobile·text-[10px]` on
the label span (base 8px), value at the live size (14px, unchanged). Two-line labels accepted.

### R-P1 · the positions header row

The head is `flex flex-wrap items-center gap-2 p-3 min-h-[52px]` with `ml-auto` on the status pills.
At phone width a long market question makes it wrap and the pills drop. Fix: `max-mobile·flex-nowrap`
on the head, `max-mobile·min-w-0` + `max-mobile·truncate` on the filter wrapper so the BUTTON can
shrink (the primitive carries `whitespace-nowrap shrink-0`, so it will not shrink on its own).
⚠ `arrangement.test.tsx:998-1008` asserts the button's full `textContent` equals `${title} ▾`, so the
truncation must be CSS-only, never a JS slice. ⚠ `profile-height-chain.test.ts:510-562` pins
`min-h-[52px]` on BOTH panel heads as one shared value and rejects a fixed `h-[…]` — the floor is not
touched.

### R-P3 · desktop-shaped rows, and Sell in a sheet

Row: the `<tr>`'s `max-mobile·flex-col` becomes `max-mobile·flex-row max-mobile·items-center`, and
each `<td>` takes phone widths — Position `max-mobile·w-12` (48px), Argument
`max-mobile·flex-1 max-mobile·min-w-0 max-mobile·text-left`, Current `max-mobile·w-16` (64px),
Sell `max-mobile·w-auto`. The argument title takes `max-mobile·line-clamp-2` (the base
`line-clamp-4` stays; ⛔ never add `block` beside a `line-clamp-*`, it makes the clamp inert).
Hairline between rows: the row is an OUTLINED card today and
`selection.test.tsx:404-419` counts EXACTLY ONE `[outline:` utility, so the phone hairline is added
as a **border-top on the row** (`max-mobile·[border-top:var(--hairline)]`) with the outline dropped
at phone width (`max-mobile·[outline:none]`) and the inter-row `gap-3` collapsed
(`max-mobile·gap-0`). That keeps the outline-utility COUNT at one.

SELL: `max-mobile·min-h-11 max-mobile·[touch-action:manipulation]` on the existing `h-6` button —
the established additive 44px pattern (`AggregateFooter.tsx:346`), never a `max-mobile·h-11`, which
would be a second height declaration resolved by emission order.

**The sheet.** `PhoneSellSheet` renders a `PhoneSheet` containing `InlineSellAmount` + Confirm +
Cancel, driven by the SAME `useInlineSell()` controller the table already holds. Three things make
this work without editing `InlineSell.tsx`:

1. ⛔ **It is mounted inside the armed row's Sell `<td>`.** `useInlineSell`'s outside-click predicate
   is `if (!armedRowRef.current?.contains(e.target)) cancel()`, and `armedRowRef` is typed
   `HTMLTableRowElement` — it is the `<tr>`. A sheet rendered anywhere else is not contained by the
   row, so the FIRST tap inside it (including on Confirm) would cancel the arm. Rendering it inside
   the `<td>` is valid HTML, and `position: fixed` escapes the cell visually.
2. **It is gated on `useIsPhoneTier()`**, so the node does not exist at ≥640px or in jsdom — which is
   what keeps B1-p at zero and leaves all 43 existing sell tests observing the unchanged desktop
   arm. The in-row armed controls are gated the other way, so there is exactly one set of controls
   and no duplicated `data-testid`.
3. **`busy` is wired straight through**: `PhoneSheet` already takes `busy: boolean` and shuts all
   four doors on it (`beginClose`, the deferred close's re-check, the handle, Escape, the `×`).
   `sell.busy` is the value.

⚠ `lockPageScroll` looks for `[data-testid="phone-debate-view"]`, which does not exist on the
profile — so on this surface it locks `document.body` and nothing else. ⛔ **AND THE JUSTIFICATION
FIRST WRITTEN HERE WAS CONTRADICTED BY THIS RUN'S OWN SIBLING MEASUREMENT.** It said *"which is
correct here because the document IS the scroller"*. R-P2 hides the arguments panel, which is what
made the phone profile page FIT its viewport at 375/390/430 — that is the whole reason the row
equaliser had to be gated. If the document does not scroll there, `document.body` is not the
scroller; `positions-panel-body` is, and it is not locked. **Nothing breaks**, because ADR-0051 D-5
already names the sheet's `fixed inset-0` geometry as the mechanism and the lock as a BELT — but the
belt is inert on this surface, and that is the honest statement rather than the comfortable one.
Found by `@code-reviewer`.
⚠ The 900ms `Sold` dwell carries the only `router.refresh()` for a full exit and is cleared on
unmount. The sheet must NOT unmount within that window: `onClose` cancels the arm but the host keeps
the controller, and the dwell lives in the controller, not in the sheet.

### R-P2 / R-P5 · the viewer panel, and what is last

`ArgumentsPanel`'s root takes `max-mobile·hidden`. Nothing else on the profile phone view follows the
positions block, so R-P5 is satisfied by R-P2 plus the existing DOM order (headzone, then arena:
positions, then arguments).

---

## 4 · The ambiguity register (resolved here, re-stated in the run report)

| # | ambiguity | chose | rejected | why |
|--:|---|---|---|---|
| **A-1** | R-M1's guard says the label is "a single text node"; today it is two spans, and on the phone they already render as ONE LINE | keep two spans; the guard asserts the phone label is one LINE and the disabled/enabled class sets | collapse to one text node | collapsing is a DESKTOP DOM change, and desktop pixel-identity is a wall. The accessible name is `aria-label="PLACE Đ BET"` either way, and a dozen tests bind it |
| **A-2** | R-M2 names `ReplySplitBar`; that component does not render at phone width | apply to `AggregateFooter`, the bar a phone reader sees | edit `ReplySplitBar` as written | a token there paints nothing on a phone (§P-1). Every edit is `max-mobile·`-prefixed so the parity guard's unprefixed literals are untouched |
| **A-3** | "tooltips do not mount on the phone tier" — does it reach native `title` attributes? | gate `InfoTip` only; leave the four `title` attributes | strip `title` too | a `title` does not MOUNT anything, and Chrome Android never shows one. `PriceBar.tsx:212`'s is pinned by `market-header.test.tsx` as "the ONLY tooltip string in the entire repo under test" — removing it reds a guard this task was told not to touch |
| **A-4** | R-P4 wants "pseudonym as a link"; today it is a plain `<span>` on the profile's own header | make it a link at phone width only would be a DOM fork; instead **leave it a span and report** | make it an `<a href="/u/<self>">` | on `/u/<pseudonym>` the pseudonym would link to the page you are already on — a self-link, which is worse than no link. The linked pseudonym the ruling is thinking of is `ArgProfile`'s, which already IS a link. Reported as OWED rather than built wrong |
| **A-5** | R-P3's "hairline between rows" vs the shipped outlined-card row | phone-only: drop the outline, add a top border, collapse the gap | add a divider beside the outline | `selection.test.tsx:404-419` counts EXACTLY ONE `[outline:` utility in either state; a second would red it |
| **A-6** | row-title-navigates vs row-inert | **navigates** — and it already does | make the row inert except SELL | `PositionsTable.tsx:1507` is already a `<Link>` to `/m/<slug>?post=<ordinal>`; OVN-O4 says pin a ruled outcome that already holds rather than rebuild it |
| **A-7** | B1 baseline — against `origin/main` or against the branch tip? | **against the branch tip `6d0f467b`**, same machine, same build pipeline | against `origin/main` | against main the branch already differs by the whole of MOBILE-2/2b/2c/2d. The claim the wall means is "MOBILE-2e moves nothing" (the same reading MOBILE-2d took) |

---

## 5 · Baselines — measured BEFORE, re-measured after every slice

| id | what | layer, and why that layer is the honest one |
|---|---|---|
| **B1** | `/m/[slug]` at 1440 | the BOX of every `[data-testid]` node **and** a deep census of every `body *` node keyed by structural path — a testid census alone cannot see an untagged wrapper moving |
| **B1-p** | `/u/[pseudonym]` at 1440, SIGNED IN | same; signed in because SELL renders only for the owner |
| **B2** | horizontal overflow, both routes, 360/375/390/430/639/640/1440 | `documentElement.scrollWidth − innerWidth` |
| **B7** | tap targets | every interactive box under 43.5px in either axis, at four phone widths |
| **B8** | axe | axe-core against the phone render of both routes |
| **B10** | timers/min | `setInterval`/`setTimeout`/rAF patched in an init script, sampled over a 20s window — **with a positive control that arms two timers and asserts the census sees them** (OVN-V9: a census reading 0 is indistinguishable from one that is not wired) |
| **B11** | the touch matrix on M3 | the MOBILE-2d G1–G10 instrument |
| **B12** | identity-row line counts (normal / sold / badge) | leaf flex items of the `.flex-wrap` area, clustered by vertical MIDPOINT — ⚠ not by `top`: the area is `items-center`, so a 20px chip and a 17px text node on one visual line have different tops by design, and counting distinct tops reported four lines where the reader sees two |
| **B13** | profile row column x's at 375 | the left/right edge of each `<td>` in a row |
| **x-edges** | the composer's blocks vs the submit | `getBoundingClientRect().x` / `.right` per block, with the sheet open |

---

## 6 · What this run is NOT doing

- ✗ **The first-login deck** — measured and holding at MOBILE-2d; untouched.
- ✗ **The desktop tier's no-scroller finding on a touch device** — another lane's, re-reported.
- ✗ **REEL, the 641–1023px band, landscape** — out of the register.
- ✗ **`design-language.md`, SPEC riders, ADR status** — the web lane's at Gate C. Only A4 is written,
  verbatim from the brief.
- ✗ **New strings.** The tooltip copy is not moved anywhere; it stops mounting on phones.
- ✗ **Any edit under `src/server/**`, `drizzle/**`, auth, money or moderation.**
