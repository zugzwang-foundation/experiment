# ADR-0050 — The phone tier of market detail is a presentation, not a reflow

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
