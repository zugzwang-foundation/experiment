# SURFACES — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** every screen a participant can reach: discovery, market detail, the composer and reply surface, profile, onboarding, the global header, charts, timestamps, tooltips, the auth artwork, and mobile.

## 1 · What this lane is

There are four participant screens and one gate. **Discovery** (`/`) is the front page: a grid
of markets with a rotating hero. **Market detail** (`/m/[slug]`) is where the argument happens
— two columns, YES and NO, each a scrollable lane of posts, with a composer that is also a
bet form. **Profile** (`/u/[pseudonym]`) is a participant's record: their identity, their
positions, and every argument they have made. **Legal** (`/legal`) serves the terms and
privacy text. The gate is the auth group — sign-in, OTP, onboarding — which sits behind its
own layout and carries the artwork.

Two things about this lane are unusual enough to state up front. First, **the design contract
is not in this file**: `docs/design/design-canon.md`, `design-language.md` and
`design-token-contract.md` own the tokens, the composition and the copy register, and a second
copy of any of them would disagree with the original within a fortnight. This record points.

Second, **a surface that was deleted is listed here as deleted**. Bookmarks shipped, worked,
and was unwired; a reader who finds a reference to `/bookmarks` in an older document needs to
learn that from a record rather than from a fruitless search for code that is gone.

## 2 · Feature table

### 2.1 · Routes

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| `(public)` route group + shell | SHIPPED | `src/app/(public)/layout.tsx`, `not-found.tsx` | SPEC.1 §21 | 0023 | `tests/unit/shell/` | — |
| **Discovery** `/` | SHIPPED | `src/app/(public)/page.tsx`, read model `src/server/discovery/list.ts` | SPEC.1 §22 | 0023 | `tests/unit/discovery/`, `tests/unit/design/discovery-height-chain.test.ts` | — |
| **Market detail** `/m/[slug]` | SHIPPED | `src/app/(public)/m/[slug]/page.tsx` → `src/components/debate/DebateView.tsx` | SPEC.1 §9 | 0023, 0034 | `tests/unit/debate/`, `tests/unit/design/debate-height-chain.test.ts` | — |
| Debate route error boundary | SHIPPED | `src/app/(public)/m/[slug]/error.tsx` | — | — | `tests/unit/debate/render/` | — |
| Market `.md` export / **AI mode** | SHIPPED | `src/app/(public)/m/[slug]/export/route.ts`; button in `MarketHeader.tsx` | SPEC.1 §21.3 | 0025 | `tests/integration/debate-export.integration.test.ts` | — |
| CPMM quote read | SHIPPED | `src/app/(public)/m/[slug]/quote/route.ts` | SPEC.1 §7 | — | `tests/integration/market-quote.integration.test.ts` | — |
| **Profile** `/u/[pseudonym]` | SHIPPED | `src/app/(public)/u/[pseudonym]/{page,loading,error}.tsx` | SPEC.1 §23 | — | `tests/unit/profile/`, `tests/unit/design/profile-height-chain.test.ts` | — |
| **Legal** `/legal` | SHIPPED | `src/app/(public)/legal/page.tsx`, `src/lib/legal-sections.ts`, `public/legal/{tos,privacy}.txt` | SPEC.1 §13 | — | `tests/unit/design/legal-figures.test.ts` | — |
| Auth group + layout | SHIPPED | `src/app/(auth)/{layout,error}.tsx`, `sign-in/`, `sign-in/otp/`, `onboarding/` | SPEC.1 §13 | 0023 | `tests/unit/auth/` | — |
| Visitor counter POST | SHIPPED | `src/app/api/visits/route.ts`, `src/components/shell/VisitorCounter.tsx` | SPEC.1 §21.1 | — | route: `tests/server/visitors/{route,counter}.test.ts` · component: `tests/unit/shell/` | — |
| ⛔ **Bookmarks** `/bookmarks` | **REMOVED** | — | — | **0040** | **none** — searched; no coverage exists under another name | table + migration retained |
| ⛔ **Profile Dharma graph** | **REMOVED** | — | — | **0040** | **none** — searched; no coverage exists under another name | — |
| Mobile-responsive read surfaces | **NOT BUILT** | — | — | **0045** (accepted 2026-09-01) | none | plan at `docs/plans/MOBILE-1.md`; no PR |

### 2.2 · Components, by directory

`src/components/` holds **eight** directories — `art discovery debate legal onboarding profile
shell ui` (`ls -d src/components/*/`).

| Directory | Files | What it is |
|---|--:|---|
| `debate/` | 33 | the market-detail surface. `DebateView` is the client boundary; `MarketHeader`, `HeadZone`, `PostFocusHeader`, `FocusMarketCard`, `PostCard`, `ReplyCard`, `ReplyPreview`, `scrollers`, `ScrollRail`, `PriceBar`, `AggregateFooter`, `DebateColumn`, `DebatePoll`, `CriterionDisclosure`, `ResolutionCriterion`, `ResolverCards` + `resolution-block-{data,glyphs}`, `MarketMediaPanel`, `CommentImage`, `KnowMore`, `ArgProfile`, `badges`, `dialogs`, `placeholders`, `chart/`, `composer/` |
| `discovery/` | 9 | `DiscoveryGrid`, `DiscoveryCarousel`, `HeroPanels`, `MarketCard`, `MarketThumb`, `StatLine`, plus `EmptyState` / `ErrorState` / `LoadingSkeleton` |
| `profile/` | 15 | `ProfileArena`, `ProfileTiles`, `IdentityCard`, `PositionsTable`, `ArgumentList`, `ArgumentBody`, `InlineSell`, `LotBreakdown`, `DownloadStub`, `states`, + `partition` / `row-stepper` / `row-thirds` / `selection` / `copy` |
| `shell/` | 13 | `GlobalHeader`, `HeaderNav`, `BrandCluster`, `Wordmark`, `IdentityCluster`, `DharmaCluster`, `PageContainer`, `VisitorCounter`, `GitHubStars`, `RulesControl`, `RadioSlot`, `CountdownDigits`, `countdown-format` |
| `onboarding/` | 3 | `OnboardingDeck`, `cards.ts` (the seven-card array), `figures.tsx` |
| `art/warli/` | — | the decorative SVG layer, mounted at exactly one site — see §4 |
| `legal/` | 1 | `LegalFigure` |
| `ui/` | 15 | **nine shadcn primitives** (avatar, badge, button, card, dialog, input, separator, skeleton, textarea) and **six project-authored** (`empty-block`, `loading-block`, `error-block`, `thumb-glyph`, `relative-time`, `info-tip`) |

⚠ **`src/components/ui/` is not "the shadcn folder".** Six of its fifteen files are
project-authored and canon-pinned by component name and props; reaching for a shadcn generator
to change one will overwrite a contract. `info-tip` is the one affordance that opens on both
pointer hover and touch tap — it composes Radix's Tooltip and Popover and picks per render on
`(hover: hover) and (pointer: fine)`.

### 2.3 · Cross-surface features

| Feature | Status | Code | ADR | Proved by |
|---|---|---|---|---|
| Global header (identity, Dharma, portfolio, countdown) | SHIPPED | `src/components/shell/GlobalHeader.tsx` + cluster components | — | `tests/unit/shell/sticky-header.test.ts`, `tests/integration/header-{balance,portfolio}.integration.test.ts` |
| GitHub star control, 0-vs-unavailable | SHIPPED | `src/components/shell/GitHubStars.tsx`, `src/server/github/` | — | `tests/unit/shell/` |
| Relative timestamps on every card | SHIPPED | `src/components/ui/relative-time.tsx`, `src/lib/relative-time.ts` | — | `tests/unit/ui/` |
| Glossary tooltips (INFO-1) | SHIPPED | `src/components/ui/info-tip.tsx`, `src/lib/copy/glossary.ts` | — | `tests/unit/ui/` |
| Price chart (market detail + discovery sparkline) | SHIPPED | `src/components/debate/chart/` | — | `tests/unit/debate/chart/` |
| Composer with image attach + client downscale | SHIPPED | `src/components/debate/composer/` | 0028, 0042 | `tests/unit/composer/`, `tests/integration/composer-{place,reply,sell,image}.integration.test.ts` |
| Inline sell on profile | SHIPPED | `src/components/profile/InlineSell.tsx`, `LotBreakdown.tsx` | 0039 | `tests/unit/profile/` |
| Onboarding deck (7 cards, re-show drops 1) | SHIPPED | `src/components/onboarding/cards.ts:67` | 0037 | `tests/unit/onboarding/copy-drift.test.ts` |
| Warli auth artwork | SHIPPED | `src/components/art/warli/` | — | `tests/unit/art/` (7 files) |
| ⛔ Expanded post nodes on the chart | **REMOVED** | — | — | **absence guarded**: `tests/unit/debate/render/price-chart.test.tsx:862` — `no-circle-carries-a-ground-rim — CHART-NODE-REMOVE`, written so a re-added node reddens |
| Toast / notification layer | **NOT BUILT** | — | — | none |

### 2.4 · SPEC.1 §21 ancillary surfaces — the status of each

SPEC.1 §21 homes nine numbered ancillary surfaces. **Their build status is not stated in the
spec**, so it is stated here, measured.

| § | Surface | Status | Evidence |
|---|---|---|---|
| 21.1 | Visitor counter ("views") | **SHIPPED** | `src/components/shell/VisitorCounter.tsx`, `src/app/api/visits/route.ts`, `src/server/visitors/`. One Upstash integer, env-namespaced, `INCR` on visit |
| 21.2 | Download post → JPEG | **NOT BUILT** | the only affordance is `src/components/profile/DownloadStub.tsx` — permanently disabled, and its own docblock says why: *"no per-argument export exists yet"*. Consumers: `ArgumentList.tsx`, `MarketHeader.tsx` |
| 21.3 | Download debate → `.md` | **SHIPPED** | `src/app/(public)/m/[slug]/export/route.ts`; surfaced as the AI-mode button at AIMODE-1 (#466) |
| 21.4 | Historical-debate showcase | **NOT BUILT** | `grep -ril 'showcase' src/` returns only two `resolution-block-*` files, which are the market-detail blocks, not a showcase surface |
| 21.5 | Radio / music widget | **STUBBED, NOT BUILT** | `src/components/shell/RadioSlot.tsx` — an inert skin: `disabled`, `aria-disabled="true"`, four static bars, zero client JS. Its docblock names the gate: *"The real YouTube-backed player + final look are W2.14 — Session B, SPEC-FIRST (§21.5 amendment + ADR before ANY build)."* No such amendment and no such ADR exist |
| 21.6 | Feature-guide page + "i" deep-links | **DESCOPED** | founder ruling 2026-06-29, recorded in §21.6 itself. Its content is served by the deck's re-show |
| 21.7 | Freeze banner / global notice | **RESERVED — NOT BUILT** | `grep -rilE 'freeze.?banner\|FreezeBanner' src/` → **empty**; positive control `grep -rl 'isFrozen' src/` → 3 files including `src/server/system/is-frozen.ts`. **The freeze mechanism exists; the banner does not** |
| 21.8 | Signed-in Dharma cluster | **SHIPPED** | `src/components/shell/DharmaCluster.tsx`, `IdentityCluster.tsx` |
| 21.9 | Onboarding deck | **SHIPPED** | `src/components/onboarding/` — see §2.3 |

⚠ **§21.5's "lawyer flag (mid-July)" has passed** and the surface is gated behind a SPEC-FIRST
amendment nobody has written. Whether the radio ships is a founder call this record takes no
position on; what it records is that the slot on the page today is inert by ratified design,
not by accident.

### 2.5 · The composer — the one surface that is also a write path

`src/components/debate/composer/` holds **20 files** and is the only participant component
directory that submits money. It is listed separately because a reader looking for "where a bet
is placed" will otherwise look in `src/server/bets/` and miss the half that decides what gets
sent.

| Piece | File | What it does |
|---|---|---|
| The form | `BetComposer.tsx`, `ComposerSlot.tsx`, `SlotHeader.tsx` | the argument + stake form, per side |
| Sell | `SellModule.tsx`, `sell-convert.ts` | the exit path, shares → Dharma |
| Position readout | `PositionStrip.tsx`, `ReplySplitBar.tsx`, `split-bar.ts` | what the viewer already holds |
| Image | `ImageAttach.tsx`, `image-attach.ts` | client-side downscale **before** upload (HO-T3, #449/#451) |
| Wire | `payload.ts`, `requests.ts`, `envelope.ts`, `idempotency.ts`, `quote-reader.ts` | the request shape and its idempotency key |
| Gating | `gating.ts`, `AuthGateSlot.tsx`, `state-map.ts` | signed-out, frozen, closed and foreclosed states |
| Copy + errors | `copy.ts`, `ErrorStrip.tsx` | the register, and the failure surface |

⚠ **`docs/parked.md` RPLY-CLOSE P1 is a live correctness row on this surface** — the
market-arm position readout is wrong while a composer is open. It is severity-labelled P1 and
is not closed.

## 3 · The decisions that shaped it

| Decision | Recorded in | What it changed |
|---|---|---|
| `(public)` route group, server-component shell, `/m/[slug]` first | ADR-0023 | the participant surface's topology; `getMarketBySlug` excludes `Draft` |
| Viewer-scoped debate reads | ADR-0034 | what a surface shows depends on who is looking, decided server-side |
| Bookmarks vertical | ADR-0032 | shipped the route, the read model and the components |
| **Unwire bookmarks and the Profile graph** | **ADR-0040** | deleted all three bookmark directories and the graph; **kept the table** |
| The deck's seen-marker is a cookie | ADR-0037 | first-login gating with no schema |
| `cacheComponents` + reserves-keyed caching | ADR-0041 | PPR by default; a bet invalidates what it changed |
| Presigned-URL hold budgeted against the downstream cache | ADR-0042 | image URL lifetimes are a cache decision, not a convenience one |
| Market media, admin-set per market | ADR-0026 | the header's media panel and its empty state |
| **Mobile-responsive read surfaces + hard auth gate on mobile** | **ADR-0045** | accepted 2026-09-01; **nothing built yet** |

## 4 · Invariants and guards this lane carries

**This lane touches no money and no ledger.** Its guards are about what renders, and the
failure mode they exist to catch is a surface that *looks* right in a screenshot and is wrong
in the DOM.

| Guard family | Where | What it pins |
|---|---|---|
| **Height chains** | `tests/unit/design/{discovery,profile,debate}-height-chain.test.ts` | the composed height of a card, as a chain of tokens. ⚠ **All three are SOURCE SCANS, because jsdom performs no layout** — they read the class strings, not a rendered box |
| Token census | `tests/unit/design/tokens-monochrome.test.ts` | exact hex pins, the 11-token census, ground/graph/destructive pins, string bans |
| CSS compile | `tests/unit/design/` (added #459, corrected #463) | the stylesheet compiles in CI, which nothing did before |
| Sticky header | `tests/unit/shell/sticky-header.test.ts` | the header's `z-40` tier, and that the art layer is the tree's only **underlay** |
| Art layer seal | `tests/unit/art/art-layer-guards.test.ts` | the layer imports nothing but `react` and its own files, **and** its importer list is exactly one file |
| Copy drift | `tests/unit/onboarding/copy-drift.test.ts` | the deck's strings are byte-equal to `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md` |
| Removal masking | inherited from `loadRemovedSet` | see `docs/records/DEBATE-record.md` §4.2 — a removed body reaches no surface |

⚠ **The Warli art layer is mounted at exactly one site** — `src/app/(auth)/layout.tsx`, as a
`pointer-events-none fixed inset-0 -z-10` underlay behind `/sign-in`, `/sign-in/otp` and
`/onboarding`. **The count and the site are both pinned**: `art-layer-guards.test.ts` asserts
the importer list is exactly that one file. It asserted the *empty* list until WARLI-MOUNT and
was inverted rather than deleted, so a second mount still reddens. It is also the only
component in the tree that embeds its own `<style>` and authors `@keyframes` — necessary,
because Tailwind's `animate-spin` is not in this app's built CSS, so the obvious utility would
have produced rings that silently never turned.

### 4.1 · PLACEHOLDER INVENTORY — counted here, from the code

⚠ **Two documents circulate two different counts and neither re-counted.**
`docs/parked.md`'s `HTML-FINISH-MD-PLACEHOLDERS` says **four**; `ResolverCards.tsx:56-60`
says **five**; `AGENTS.md` copied the five. **This is the count, taken from the components.**

**Definition used:** an element that renders byte-carried mockup chrome describing content
which does not exist. Exactly two such elements exist in the tree, both carrying a
`data-testid`.

| # | Kind | Element | Visible string | Mounted at |
|--:|---|---|---|---|
| 1 | market-media | `src/components/debate/MarketMediaPanel.tsx:135` — `data-testid="market-media-placeholder"` | `MARKET MEDIA — IMG / VIDEO` (`:153`) | `MarketHeader.tsx:263` → `DebateView.tsx:1212` (market arm) |
| 2 | post-image | `src/components/debate/CommentImage.tsx:169` — `data-testid="post-image-placeholder"`, exported `PostImagePlaceholder` at `:141` | `POST IMAGE · 640:586` (`:176`) | `PostCard.tsx:243` → `scrollers.tsx:332` |
| 3 | post-image | same element | same | `ReplyCard.tsx:200` → `scrollers.tsx:426` and `ReplyPreview.tsx:122,139,160` |
| 4 | post-image | same element | same | `PostFocusHeader.tsx:130` → `DebateView.tsx:1011` (post arm) |

⇒ **TWO kinds, at FOUR mount sites.**

**Two further `IMG` glyph boxes are design-ratified null states, not mockup chrome,** and are
listed apart rather than folded in: `MarketMediaPanel.tsx:164-172` (the video-present /
image-absent arm) and `FocusMarketCard.tsx:70-79` (the post-arm rail thumb).
`MarketMediaPanel.tsx:158-160` calls the second *"the shipped, design-ratified null placeholder
for a market image"*. A market may simply have no image; that is a product state, not a note
about unbuilt work.

**Why the two circulating numbers differ.** The docket's table has exactly four rows, one per
**kind** — market-media, post-image, resolver-card, x-official-card. BLOCK-1 (#447) filled the
resolution blocks' value and subvalue lines from a static per-slug map, so rows 3 and 4 took
the docket's own third exit (*"the moment resolver data exists they stop being placeholders and
become the real cards"*). That leaves **two kinds**. `ResolverCards.tsx:56-60`'s arithmetic —
*"SIX placeholders of THREE kinds; BLOCK-1 removes the resolution blocks … leaving FIVE
placeholders of TWO kinds"* — **does not work: 6 − 4 = 2.** Recorded, not corrected; see
`docs/STATE.md` §4 · `F-5`.

✅ **What must survive any strip-or-gate is intact.** The d5 demo market content has not been
ported: `grep -rn 'Brihanmumbai' src/` returns **0**; positive control
`grep -rl 'mumbai-bmc-pink-october' src/` returns **2 files**. All three docket-named guards
exist: `tests/unit/debate/render/{market-media-panel,comment-image,resolver-cards}.test.tsx`.

⛔ **`docs/parked.md` SEQUENCE row 5 remains open and its trigger is the production promote**,
not a date: *strip or gate before DP.2*.

### 4.2 · Removed surfaces, and what survives them

| Surface | Removed by | What is gone | What survives |
|---|---|---|---|
| **Bookmarks** | **ADR-0040** / UNWIRE-1 (#393) | `src/app/(public)/bookmarks/`, `src/server/bookmarks/`, `src/components/bookmarks/`, and `tests/unit/design/bookmarks-height-chain.test.ts` | the **`bookmarks` table** — `src/db/schema/bookmarks.ts` and `drizzle/migrations/0024_bookmarks.sql`. Schema kept, surface withdrawn |
| **Profile Dharma graph** | **ADR-0040** | the `ProfileGraphCard` component | sizing-only comments in `src/app/(public)/u/[pseudonym]/page.tsx:217,281,291` that still name it |
| **Expanded post nodes on the chart** | #457, CHART-NODE-REMOVE | the nodes and everything that existed only for them | the chart |

Verified as absences with positive controls (OVN-V1): `ls -d src/app/(public)/bookmarks
src/server/bookmarks src/components/bookmarks` → all **ABSENT**, against the control
`ls -d src/server/discovery` → **present**. `find src -name 'ProfileGraph*'` → **empty**,
against `find src -name 'PositionsTable*'` → `src/components/profile/PositionsTable.tsx`.

⚠ **`page.tsx` still mentions `ProfileGraphCard` three times, in comments explaining a sizing
fence.** The component is gone; the comments describe why a dimension is what it is. A reader
searching for the component will find the comments first.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| UI-A4 | #244 | `3b2d07d` | 2026-07-18 | Discovery front page at `/` |
| UI-A6 | #254 | `9423eef` | 2026-07-21 | Bookmarks vertical (ADR-0032, migration 0024) — **later unwired** |
| UI.19 slice 2 | #271 | `9d289b3` | 2026-07-23 | expanded post nodes — **later removed by #457** |
| POLISH.6 | #336 | `ea1795e` | 2026-08-15 | `/bookmarks` onto the state primitives — **later unwired** |
| HTML-FINISH · BOOKMARKS | #338 | `fd4b357` | 2026-08-15 | the Profile arrangement replicated — **later unwired** |
| GH-STAR | #362 | `beb36a6` | 2026-08-19 | the GitHub star control and its 0-vs-unavailable contract |
| POSREV-1 | #396 | `52efee2` | 2026-08-23 | the Positions surface counts arguments, not markets |
| TIME-1 | #403 | `efed628` | 2026-08-25 | every post and reply says how long ago it was written |
| INFO-1 | #416 | `b0b5919` | 2026-08-26 | one gloss for every Zugzwang term, on an affordance that works on a phone |
| CHART-1 | #425 | `9d2a920` | 2026-08-27 | the market price chart |
| WARLI-1 / -2 | #433, #438 | `a95ef2b`, `ab0f23b` | 2026-08-29/30 | the artwork, **unmounted** |
| WARLI-MOUNT | #448 | `98e203f` | 2026-08-31 | hung on the auth surface, with the cost measured |
| BLOCK-3 / -4 / -5b | #452, #454, #461 | `7155cf1`, `47c3f86`, `340f31d` | 2026-09-01/02 | resolution block refinements, one-line blocks, the glyph |
| CHART-NODE-REMOVE | #457 | `4c04163` | 2026-09-01 | the post nodes come off every surface |
| **AIMODE-1** | **#466** | `e193cfb` | **2026-09-03** | the `.md` export becomes the AI-mode button |
| **ADR-0045 + MOBILE-1 plan** | **#467** | `ead7415` | **2026-09-03** | the decision and the plan. **No implementation PR exists** |

⚠ **Three merged PRs in this lane carry the retired `⛔ LEAVE UNMERGED` / `DO NOT MERGE`
marker** — #254, #336, #403, #448. CLAUDE.md §5.13.2 explains why a marker on `main` is not
evidence that unreviewed work landed, and retires the form.

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-5` | the placeholder-count arithmetic in `ResolverCards.tsx` and in `AGENTS.md` |
| `docs/STATE.md` §4 · `F-10` | SPEC.1 says "six-card deck" at four sites and "all seven cards" at one; the array has seven |
| `docs/STATE.md` §4 · `F-11` | ADR-0045 is accepted and MOBILE-1 is planned; nothing is built, 12 days out |
| `docs/parked.md` — SEQUENCE row 5 | strip or gate the `/m/[slug]` placeholders before the DP.2 promote |
| `docs/parked.md` — SEQUENCE row 6 | a staging session cannot be re-obtained in-session (its `/bookmarks` example is a removed route) |
| `docs/parked.md` — HTML-FINISH · MARKET DETAIL R2 | the full placeholder docket, with the strip-vs-gate choice left to the founder |
| `docs/parked.md` — RPLY-CLOSE P1 … P4 | seven reply-surface residue rows, severity-labelled |
| `docs/parked.md` — WARLI-3 | the composition notes |
| `docs/polish/POLISH-register.md` | the visual defect register for this lane |
| `docs/design/design-canon.md` · `design-language.md` · `design-token-contract.md` | **the design contract — pointed at, never restated** |
