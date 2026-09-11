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

- Phones now hydrate the desktop tree (status quo, hidden) plus the phone tree. Measured JS delta at 375: «bytes». A follow-up may lazy-load the desktop tree's heavy client leaves below 640px; not this ADR.
- Phase A's `max-mobile:` tokens on the desktop tree and their guards remain; they are redundant below 640px and are noted as such in `docs/parked.md`.
- `design-language.md §1.7` ("desktop-only") is false as of this ADR; the web lane redrafts it at close-out. Any SPEC.2 sentence the build contradicts is listed in the run report for the same amendment.
- The 641–1023px band still has no chart (RECON S-7); unchanged, separate item.
- Verification at the preview: 375 — `scrollWidth` 375, zero clipped elements inside cards, the question unclipped, resolver rows readable, chart visible in the sheet; 1440 — «0 px diff / identical DOM hash» against `origin/main`.
