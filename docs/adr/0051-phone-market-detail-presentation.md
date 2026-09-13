# ADR-0051 — The phone tier of market detail is a presentation, not a reflow

- **Status:** Proposed — web-authored 2026-09-11 (MOBILE-2), to be Accepted at MOBILE-2 close-out after founder refinements
- **Date:** 2026-09-11
- **Deciders:** founder (rulings on stills R1 21:01 / R2 22:54 IST and amendments 23:18 IST); web Claude (author)
- **Extends:** ADR-0045 (override-never-replace; MOBILE-1 Phase A) · **Does not touch:** ADR-0048, ADR-0049
- **Measured at:** origin/main `8d63ebc06f34a9b9549a6aa6a9dc4d8db7bb5e76` · staging canary `d0879c41d446fdb1621b9684526133fac0465f2e` · 2026-09-11

## Context

MOBILE-2 RECON (2026-09-11) measured `/m/[slug]` at 375×812 on staging: the market question truncates 231px over, all four resolution blocks clip at 50px cells, `headzone-right` (price chart and the focus-mode exit) is `hidden … lg:flex` and so absent below 1024px, and the composer has no phone shape. Discovery (Phase A, #486) and the profile (Job B, #509) measure clean. A reflow cannot turn a two-column arena with an opposite-slot composer into a phone experience; the founder ruled a phone-native presentation, inspired by Polymarket's mobile market page, with one non-negotiable difference: every buy carries an argument.

## Decision

**D-1 · A separate presentation, same data.** Below `--breakpoint-mobile` (640px) `/m/[slug]` renders `PhoneDebateView` (`src/components/debate/phone/`) over the same `DebateViewModel`, `ViewerMarketContext`, `initialPostId`, `ownPseudonym` that `DebateView` takes. `DebateViewModel` is not extended (ADR-0034 D-1). The desktop tree is unchanged and hidden below 640px by exactly one additive token on its root; the phone root is `hidden` above 640px. The two hide together, never one alone (guarded).

**D-2 · The convention is extended, not replaced.** ADR-0045's rule — desktop stays the unprefixed default, a phone rule is an additive `max-mobile:` token — still governs every existing component. A **phone-only leaf** may be minted when the desktop composition has no phone shape, provided it (a) lives under `phone/`, (b) consumes only the read model, the viewer context and existing callbacks, (c) contains no write path — writes go through the reused `BetComposer`, `AuthGateSlot` (and, if ever added, `SellModule`) instances, (d) uses no default-breakpoint variant.

**D-3 · Composition (ruled on stills).** Title strip = Discovery's square market thumb + the full question; the strip itself opens the details sheet (no separate control). YES/NO tabs in pole colours over a horizontal scroll-snap track of two side feeds in the desktop column order. Post card = two-line identity block, title, body with `Know more`, image, split bar with Support/Counter. Fixed bottom bar `Bet YES|NO` per active tab; signed-out → the auth gate; opposite side held → disabled with the live reason; market not open → state, no button. Composer = the existing `BetComposer` in a full-height sheet; its empty image state is the `Add Image` button only. Details sheet = media, question, description, four resolver rows, price bar, stats with `Open · AI mode`, the collapsed chart card (→ the existing overlay). Thread view (`?post=N`) = `←` + post title with the market title as subscript, tabs `SUPPORT n / COUNTER n`, reply cards, bottom bar `SUPPORT / COUNTER`; the parent post is read through the strip's sheet. View mode: FEED (a continuous vertical list of post cards, 12px gutters, no y-snapping).

**D-4 · Canon rulings specific to the phone tier.**
(i) The thread view's tabs are labelled by **relation** (Support/Counter). The desktop rule — reply columns are fixed YES/NO poles, never labelled by relation (design-canon §3.2) — is unchanged; the phone thread is a single-post view in which each reply's relation to that post is fixed, so Support ⇔ the post's side and Counter ⇔ the opposite, and the split bar's own vocabulary is the honest label.
(ii) The composer-opposite-slot rule (design-canon §3.3) does not apply on the phone; the sheet replaces it.
(iii) The phone omits: the two-column arena, carousel auto-advance, `ScrollRail`, the `Đ BET` column-head entry, the Focus toggle, the download-post stub, Sell on this surface (the profile carries phone Sell per Job B), and any placeholder art in the composer.
(iv) The price chart lives in the details sheet, mounted on first open.

**D-5 · Invariants carried verbatim** (design-language §1.8): an argument field on every buy; the balance visible where a stake is committed (`Max Đ 250 per bet · Balance Đ n`); the side badge frozen on every card; resolved surfaces read-locked; black = YES / white = NO everywhere; selling remains the only comment-free action and is not on this surface.

**D-6 · Guard family.** `tests/unit/design/phone-market-detail.test.ts` + `tests/unit/debate/phone/*`: twin-hide-together; no default-breakpoint variant in `phone/`; no write string in `phone/`; the sheet's content set; no sort in `phone/`; the relation partition through the existing helper; the four-prop mount without a wrapper.

## Consequences

- Phones now hydrate the desktop tree (status quo, hidden) plus the phone tree. Measured JS delta at 375: **+4.0 KB gzipped** (452,214 B → 456,218 B transferred, cache disabled, read on two Preview deployments of the same branch back to back). A follow-up may lazy-load the desktop tree's heavy client leaves below 640px; not this ADR.
- Phase A's `max-mobile:` tokens on the desktop tree and their guards remain; they are redundant below 640px and are noted as such in `docs/parked.md`.
- `design-language.md §1.7` ("desktop-only") is false as of this ADR; the web lane redrafts it at close-out. Any SPEC.2 sentence the build contradicts is listed in the run report for the same amendment.
- The 641–1023px band still has no chart (RECON S-7); unchanged, separate item.
- Verification at the preview: 375 — `scrollWidth` 375, zero clipped elements inside cards, the question unclipped, resolver rows readable, chart visible in the sheet; 1440 — measured against `origin/main`'s own render: **80 differing pixels on the market view and 27 on the thread view, against a noise floor of 118–156 px** established by reading the SAME build twice; **73 + 12 desktop element boxes byte-identical**, the only two deltas being the price chart's clock-driven right edge (0.01 px) and a live visitor count. ⚠ **The DOM is NOT identical and cannot be**: an additive `max-mobile:` token IS a DOM attribute change, and D-2 requires them on the reused desktop components. What is measured instead, and is the stronger claim: the desktop DOM gains **nine inserted fragments, all nine `max-mobile:` tokens, and zero deletions**.

## Amendment A1 — 2026-09-12 (MOBILE-2b; web-authored from the MOBILE-2 run report §2, §11)

- **D-1 mechanism corrected.** The strip's thumb is `model.market.thumbImageUrl`, already on the read model (`load-debate-view.ts:190`, no extra read) and already rendered by `PostFocusHeader`. The ADR's original text implied a page-level helper call; none exists and none is needed.
- **D-3 composer, empty image state — mechanism corrected.** `ImageAttach`'s empty state is one SVG figure that draws the invitation *and* the `Add Image` pill. On the phone the figure is `display:none` below 640px and the pick button renders the same live constant (`EMPTY_SLOT_COPY.action`) as text. The ruled outcome — the invitation and nothing else — stands.
- **D-3 details sheet.** The sheet mounts the live `CriterionDisclosure` — a new placement; RESO-3 change 6 (the desktop does not render it on `/m/[slug]`) is unchanged.
- **D-2 scoped exception.** A logic edit to a file outside `phone/` is permitted only when it fixes a phone defect, is render- and behaviour-neutral at ≥640px (B1 = 0, existing tests green), is covered by a test that fails if the desktop path changes, and is listed individually in the run report. First instances: pausing the desktop tree's intervals below 640px; the composer-open store read in `DebatePoll`; input attributes for the phone keyboard.
- **Consequences, two additions.** (i) *Runtime* cost, not only hydration: the hidden desktop tree's `setInterval`/`setState` work continues at phone width unless paused — paused as of MOBILE-2b. (ii) *The tier gate is a property of DOM position, and a portal leaves the DOM position*: portal content opened from the phone tree carries `data-tier="phone"` and is styled for the phone; a guard pins that every portal opener under `phone/` passes it.

## Amendment A2 — 2026-09-12 (MOBILE-2c; founder rulings Q1–Q10 of 2026-09-12, web-authored)

- **D-4(v) Tabs.** The phone tier's tab controls (feed `YES/NO`, thread `SUPPORT/COUNTER`) render the active tab as a white fill regardless of side; inactive tabs are outlined. This is a tab-control exception to the pole binding (black = YES / white = NO), which remains in force on side badges, split bars, and the bottom bar.
- **D-3 Sheets.** All phone sheets share one shell: content-height, bottom-anchored, `max-height: 92dvh`, top corners at `--radius-4xl` (26px), page dimmed 60% behind, open by sliding up (`260ms ease-out`), close by sliding down (`200ms ease-in`), backdrop tap and a swipe-down on the handle dismiss (blocked while submitting), reduced motion honoured. A sheet is an overlay on the market, never a page.
- **D-3 Composer order on the phone.** Header → argument title → body → `Add Image` (white, 40px, full width) → `Max Đ · Balance` → `Amount / To win` → `PLACE Đ BET` (one line). The empty image state is the button only. Attached images render at natural aspect, `max-height: 40dvh`.
- **D-3 Identity row on the phone.** Avatar 32px beside the pseudonym; the metadata row runs full card width beneath on one line (13px; 12px only when the sold-position labels overflow at 360).
- **D-3 Scroll model.** Nested snap track with pane scrollers, chosen because it passed the Android touch matrix (report B11) where the alternative did not; no `touchmove` handler under `phone/` calls `preventDefault`.
- **D-2 founder-ruled carve-outs (2026-09-12).** (i) `ImageAttach`'s attached-state preview frame changes on desktop too — its oversized-frame defect was ruled a shared bug (Q8); measured at 1440 before/after. (ii) The shared quote-well's WebKit-only mark misplacement is fixed in the shared component; Chromium rendering at 1440 is unchanged.

## Amendment A3 — 2026-09-12 (MOBILE-2d; founder ask: "smooth up-down and right-left movement like iPhone")

- **D-3 scroll model, corrected.** The phone tier is a bounded app shell below 640px: the tier root is `calc(100dvh - 60px - 2px)` tall with `overflow: hidden` and a column of [title strip + tabs][scroll region], with the bet bar `position: fixed` over it; the scroll region carries `min-h-0` and is **the vertical scroller** (`overflow-y: auto`, `overscroll-behavior-y: contain`); inside it sits the content-height horizontal snap track (`scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`, `min-w-0`), and inside that two panes that are pure snap items with no overflow, no overscroll and no `touch-action`. Momentum, rubber-band, axis lock and snapping are the browser's; **the track and panes carry no touch or pointer handler, and no touch or pointer handler in `phone/` calls `preventDefault`.** Tab state follows the scroller (an IntersectionObserver on the track) and never leads it.
- ⛔⛔ **D-3, THE TOPOLOGY RULE, WHICH IS THE RESULT THIS AMENDMENT EXISTS FOR: the vertical scroller must be an ANCESTOR of the horizontal snap track, never a descendant of it.** A scroller per pane is the obvious design and gives each side its own reading position; it also kills the sideways swipe, invisibly. Measured on Chromium, bounded build, market `sp-m2-active`: with the vertical scroller nested inside the snap track, a horizontal swipe that follows a vertical scroll **moved nothing at all in 15 of 40 trials** — sampled every frame, so a routing decision rather than a snap that returned — across four input paths (10, 24 and 36 hand-dispatched touch moves and Chrome's own `Input.synthesizeScrollGesture`). With the scroller above the track: **40 of 40**, matching the document-scroll model it replaces, with a no-prior-scroll control at 10/10 in both. ⚠ **The price is one shared vertical position for both sides, with the shorter side padded to the taller one's height** — which is exactly what the document did before, so it is the status quo rather than a regression, and it is not recoverable by nesting. ⚠ **Two declarations are fatal on the snap item** and are named so they are not re-added: `overscroll-behavior-x` anything but `auto`, and `touch-action: pan-y` (both 0 of 8) — `touch-action` is intersected down the ancestor chain and inline-axis containment forbids the chain, so a horizontal gesture beginning on a card never reaches the track.
- ⚠ **D-3 consequence, `position: sticky`.** The title-strip-and-tabs block's `sticky top-[62px]` is deleted. `overflow: hidden` makes the tier root a scrollport; a sticky child resolves its offset against the nearest scrollport, so the 62px offset moved the block 62px DOWN inside the shell — measured on every phone profile, putting 61px of the feed behind the tabs. The offset existed to clear the page header while the document scrolled, and the document does not scroll here.
- **Why it changed.** As shipped in MOBILE-2c the chain was unbounded — `min-h-[…]` is a minimum, the pane never scrolled, `overflow-y: auto` never engaged, the document scrolled, and `overscroll-behavior: contain` on a non-scrolling box made Chromium refuse to chain the pan, producing a dead region bounded by the pane's rectangle (probe 2026-09-12T1435 §7.2). MOBILE-2d removed that token as a floor, then bounded the chain so the declaration is correct again.
- **D-3 chrome is inert.** A drag beginning on the title strip, the side tabs or the bet bar scrolls nothing, as in a native app shell. Making them scroll the feed would require a touch handler, which this tier forbids.
- **D-5 consequence.** Scroll locking targets the active scroll container, not `document.body`; `document.body` no longer scrolls below 640px, so a body-level lock is a no-op there. Every sheet restores the scroll container's `scrollTop` exactly on close. Components outside this tier that lock the body on a phone (the first-login deck) are unaffected by this ADR and are reported separately.
- ⚠ **D-5, what the lock is and is not.** The lock is a belt. What actually holds the feed still is that `PhoneSheet` renders a `fixed inset-0` layer with an `inset-0` backdrop, so the feed is not hit-testable while a sheet is open — measured at four heights, both sheets, with the body lock in place AND cleared live: 0px in both arms on the bounded build, against **302px** with the lock cleared on the unbounded build. The shared module (`debate/scroll-lock.ts` — moved out of `phone/`, because the desktop path imports it) exists because the measured mechanism is a property of the sheet's geometry, which a future change could lose silently; a lock that names the container keeps working. It is used by `PhoneSheet` **and** by `MarketPriceChartOverlay`, which opens from inside the phone details sheet and is therefore a second modal over a tier whose `document.body` does not scroll. The first-login deck was measured over the new shell — a Radix `Dialog`, blocking by event interception rather than by `body{overflow}` — and holds it: 0px behind it at four heights, with the feed's position restored exactly.
- **Viewport unit:** `dvh`, chosen over `svh` (and over `vh`/`lvh`, which are the LARGE viewport) because a shell sized in `vh`/`lvh` is taller than the window whenever the browser toolbar is showing, which with `overflow: hidden` on the root and no document scroll puts the bet bar off-screen and unreachable; and because after this change the document no longer scrolls, so the toolbar never collapses, `dvh` and `svh` never separate in practice, and `dvh` is the one that stays correct if that ever ceases to hold — it is also the unit `<main>` and `PageContainer` already declare, so no second boundary enters the chain (MOBILE-2d S-3).

## Amendment A4 — 2026-09-13 (MOBILE-2e; founder rulings of 2026-09-13)

- **D-2 scope.** The phone tier's rules extend to `/u/[pseudonym]`: phone-only leaves live under `src/components/profile/phone/`, consume the profile's existing read model, and contain no write path; Sell on the phone is reached from the profile's position rows and runs the existing `InlineSell` instance inside the shared `PhoneSheet`.
- **D-3 profile composition.** Header = PFP beside the pseudonym, then six tiles three across in two rows; then the positions block — one header row (`POSITIONS · All markets` / `Open · Closed`) and desktop-shaped rows (side glyph │ argument + market │ current value │ `SELL`). The argument viewer panel is not rendered below 640px; a row's title navigates to the post.
- **D-3 composer.** `PLACE Đ BET` shares the bottom bar's primary style when enabled and a solid dim fill when disabled; its edges align with every block above it.
- **D-3 split bar.** Support/Counter buttons 32px, bar 6px, amounts on one line, edges flush with the card; hit areas extended to 44px without handlers.
- **D-4(vi) Tooltips.** No tooltip mounts on the phone tier; the relation is carried by the sheet header. Triggers are blurred when a sheet opens.
- **D-3 identity row.** Position-state chips and lane badges sit on line 1 beside the pseudonym; line 2 is the four metrics, one line at every phone width.
- **D-3 sheet dismissal.** The velocity arm of swipe-to-dismiss requires ≥ 24px of travel.
- **Status.** unchanged — Proposed; to be Accepted by the web lane at Gate C

### A5 — 2026-09-13 · The profile's positions are tiles, not rows; two corrections

Supersedes A4 D-3 in full and A4 D-2's `SellModule` reference. Corrects A3 D-3.

D-1 (supersedes A4 D-3). Below `--breakpoint-mobile`, `/u/[pseudonym]`'s positions
render as one tile per position: one visual viewport tall by default, growing past it
when the market question requires, never clamping it. Tiles snap to their own top edge
through CSS `scroll-snap` (`y proximity`) on the page's existing scroller; no new
scroll container is introduced. Composition: side, value, movement and SELL on one
line; the argument title; the market question, complete. `useEqualRowThirds` stands
down below 640 via its `enabled` option and is unchanged on the desktop. The Closed
tab shares the tile. No tile carries a selected visual below 640; selection state is
retained for the sell sheet.

D-2 (corrects A4 D-2). Strike `SellModule`; nothing imports it. The phone sell sheet
mounts `InlineSellAmount` and drives `useInlineSell`, both unchanged.

D-3 (corrects A3 D-3). The claim reads "no touch or pointer handler under `phone/`
calls `preventDefault`". Keyboard handlers — arrow-key roving in `PhoneSideTabs`, the
Escape/Tab focus trap in `PhoneSheet` — do, and are permitted.

Measurements: B13 (equal column x's, row height) is retired, replaced by the tile
baseline — tile height against viewport at 360/375/390/430, snap landing, question
never clamped. B2 is measured on both tabs.
