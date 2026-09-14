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
| Mobile-responsive read surfaces | **BUILT** — Discovery #486 · profile #509 · auth #497/#510 · header #511 · `/m/[slug]` phone tier MOBILE-2 (**PR #517 MERGED at `9e12fb0d`, 2026-09-13**) — ⚠ **AND THE LANE DID NOT STOP THERE.** #517 was merged with a MERGE commit (two parents), not a squash, and work continued on the same branch: rounds **2j · 2k · 2l · 2m · 2n** (ADR-0051 A5–A10) are on `feat/mobile-2-market-detail` and were on **no PR at all** until MOBILE-2m opened one. A reader who takes "#517 MERGED" to mean "the lane is landed" is four rounds behind · the profile's phone view joined that lane at MOBILE-2e and became TILES at MOBILE-2h | — | — | **0045** · **0048** · **0049** · **0051** | `tests/unit/design/{discovery,profile,phone}-*` · `tests/unit/design/phone-round-five` · `tests/unit/shell/global-header-mobile-reflow` · `tests/unit/debate/phone/*` · `tests/unit/profile/render/phone-sell-{sheet,host}` | ⚠ This row read **NOT BUILT** with "no PR" until 2026-09-12 while five PRs had merged. ⚠ It also cited ADR **0050** — the phone tier was renumbered to **0051** at the MOBILE-2c merge (parked `2c-1`) and §3 below has said 0051 since, so this row contradicted its own document. `/m/[slug]` was the last surface and is no longer unmerged — #517 landed on `main` and `staging` together at `9e12fb0d`, which is also where four `instrumentation-register` tests began failing (see the MOBILE-2h run report; they arrive with `fix/auth-turnstile-tos`, which reached `staging` by a direct merge and has no CI run at all) |

### 2.2 · Components, by directory

`src/components/` holds **eight** directories — `art discovery debate legal onboarding profile
shell ui` (`ls -d src/components/*/`).

| Directory | Files | What it is |
|---|--:|---|
| `debate/` | 33 | the market-detail surface. `DebateView` is the client boundary; `MarketHeader`, `HeadZone`, `PostFocusHeader`, `FocusMarketCard`, `PostCard`, `ReplyCard`, `ReplyPreview`, `scrollers`, `ScrollRail`, `PriceBar`, `AggregateFooter`, `DebateColumn`, `DebatePoll`, `CriterionDisclosure`, `ResolutionCriterion`, `ResolverCards` + `resolution-block-{data,glyphs}`, `MarketMediaPanel`, `CommentImage`, `KnowMore`, `ArgProfile`, `badges`, `dialogs`, `placeholders`, `chart/`, `composer/` |
| `discovery/` | 9 | `DiscoveryGrid`, `DiscoveryCarousel`, `HeroPanels`, `MarketCard`, `MarketThumb`, `StatLine`, plus `EmptyState` / `ErrorState` / `LoadingSkeleton` |
| `profile/` | **17** | `ProfileArena`, `ProfileTiles`, `IdentityCard`, `PositionsTable`, `ArgumentList`, `ArgumentBody`, `ReplicaBody`, `InlineSell`, `LotBreakdown`, `DownloadStub`, `states`, + `partition` / `row-stepper` / `row-thirds` / `selection` / `copy`, + **`phone/`** (MOBILE-2e, ADR-0051 A4 — one leaf, `PhoneSellSheet`). ⚠ The figure read **15** and the enumeration omitted `ReplicaBody`; `ls src/components/profile/ \| wc -l` is the claim. ⚠⚠ **The two rows above it are stale in the same way and are NOT corrected here** — `debate/` reads 33 against a measured **40**, and `ui/` reads 15 against **16**. Neither moved because of this lane, and correcting a count this round did not touch would be the kind of drive-by that makes a diff unreviewable; they are reported in the MOBILE-2e run log instead |
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
| Onboarding deck (7 cards, re-show drops 1) | SHIPPED | `src/components/onboarding/cards.ts:67 (ONBOARDING_CARDS)` | 0037 | `tests/unit/onboarding/copy-drift.test.ts` |
| Warli auth artwork | SHIPPED | `src/components/art/warli/` | — | `tests/unit/art/` (7 files) |
| ⛔ Expanded post nodes on the chart | **REMOVED** | — | — | **absence guarded**: `tests/unit/debate/render/price-chart.test.tsx:869` — `no-circle-carries-a-ground-rim — CHART-NODE-REMOVE`, written so a re-added node reddens. ⚠ Cited as `:862` when generated, which was correct at `ead7415`; PR #470 moved it — corrected against `e945b760` at SYNC-6 · VERIFY |
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
| **Mobile-responsive read surfaces + hard auth gate on mobile** | **ADR-0045** | accepted 2026-09-01; **built across #486 / #497 / #509 / #510 / #511** |
| **Phone surfaces the header stands down for** | **ADR-0048**, **ADR-0049** | 0048 reverses 0045's auth carve-out (a phone participant is allowed to join); 0049 drops the Đ cluster and turns the chip into an avatar at phone width |
| **The phone tier of market detail is a PRESENTATION, not a reflow** | **ADR-0051** | Proposed 2026-09-11 (MOBILE-2). Below 640px the desktop tree hides and `debate/phone/` renders over the same four props; writes go through the reused `BetComposer` / `AuthGateSlot`. **Amendments A1–A11**; **A11 (MOBILE-2o, 2026-09-15)** is round eleven — the footer's colours under the side rule. Black = YES / white = NO holds on BOTH halves of the split bar again: Support's share fills from the left in the post's own pole and the remainder is Counter's, so a NO post whose replies are all Counter is a black bar rather than the empty grey trough A10 D-2 had made it. **D-2 corrects A10 D-2 in place** — the channel is the Đ 0 / Đ 0 state and nothing else, and A10's half-filled bar at zero is withdrawn, because an even contest between Đ 0 and Đ 0 contradicts the two figures printed either side of it. D-1 gives the black side the design language's hairline below 640 and D-3 dims a refused button to 40% of its own pole instead of letting it read as the channel. ⚠ **D-4's X control is RATIFIED AND UNBUILT, and the round stopped it on its own halt condition** — the logo below 640 is pinned to the header's axis, so a second right-zone control does not move it, it covers it: measured **+27.12px of overlap at 360 signed out** and +12.12px at 390, against 14.88px and 29.88px of clearance before. Every other X-1 acceptance line passed (logo 0.00px off centre, four centres collinear, three 8.00px gaps, a 44.00×44.00 hit region on a 34px box), so the ruling fails on ROOM rather than on construction; `docs/parked.md` **2o-1** carries the founder's options. ⚠ Two things A11 could not make true as written, both recorded: opacity cannot make a 40% white pill read as white, so the refused button is a darker grey rather than a less grey one (**2o-2**), and the black pill's edge was ALREADY a 1px hairline because Chrome resolves a 0.5px border to a 1px used width at every device scale factor — the token ships as a declaration rather than as a paint change (**2o-3**). **A10 (MOBILE-2n, 2026-09-14)** is round ten — the position chips (`Flipped`/`Sold`) leave line 1 of the identity block for the END of the meta row, after the age, so the pseudonym gets a line of its own and stops being the field that yields; the split bar goes 8px → 14px over a channel that now spans the WHOLE track, with the fill an even 50% at Đ 0 / Đ 0 so the control has presence before anyone has argued; the Support/Counter footer gives up the lighter ground A9 gave it, which was the last rectangle left on a card that had already given up its own — ⚠ **and that one is WITHDRAWN: A10 D-3 was reversed the same evening (`693ea9c1`), because removing the ground put both bet buttons into a low-contrast state on every card. The band is back and has been since; the ADR says so at its own site and this record now says so too**; the pseudonym's line box becomes the avatar's box so its glyphs centre on the face beside them (7.25px above, at every width, before); and the header carries a GitHub icon control below 640, first in the right zone, reusing the desktop control's href — the desktop control lives inside the wrapper that hides at phone width, so the tier had no route to the repository at all. ⚠ **TWO THINGS ROUND TEN COULD NOT DO AS RULED, both recorded in `docs/parked.md`.** A10 D-2's channel is specified as *one step below the card ground*, which resolves to `--color-ground` #181818 — byte-identical to `--color-yes`, so on every YES post the fill would have been drawn in the channel's own colour and a 51% bar would have rendered as an empty one (`2n-2`); `--surface-inset` ships instead, satisfying A10's own *channel colour ≠ fill colour* line. And at 360px the meta row with both chips still wraps to a third line — 14.09px short after the ruling's full 2px chip-padding allowance is spent, with every other lever closed by R-1 itself (`2n-1`, a founder ruling owed). ⚠ **The defect round ten caught was invisible to every scan:** the shared 34px icon register opens with its own `inline-flex`, which beat the new control's `hidden` on stylesheet emission order — so the control painted at 1440 and pushed the desktop right zone 34px, with the class authored, compiled and present on the node throughout. The B1-p wall found it; `cn()`/twMerge is what resolves it. **A9 (MOBILE-2m, 2026-09-14)** was the last round before the merge — five phone items: the feed card gives up its border, radius and elevation below 640 so content reaches the screen edge with one full-width hairline between posts and the Support/Counter footer as a lighter band; the split bar goes to 8px with rounded ends over a recessed channel that is visible at Đ 0 (the flag `computeSplitBar` has carried since POSREV-1 and this footer never read, so a bar with nothing in it painted as a solid white wire); the header drops its Back button below 640 and places the mark on the header's OWN centre rather than on whatever the side zones leave (measured 43.13px off centre at 360 before, 0.00 after); the pseudonym steps to 14px; and the positions filter pill matches the Open/Closed tabs in height, radius, border and type, its 44px target bought back by a transparent pseudo-element instead of a 44px painted box. ⚠ **The one defect this round shipped and caught was invisible to every number it measures** — making the brand cell `absolute` removes it as a grid ITEM, so auto-placement slid the identity zone into the CENTRE track and the avatar came to rest on top of the logo; the mark's own centre read 0.00px off, nothing overflowed, both walls passed, and a SCREENSHOT found it. **A8 (MOBILE-2l, 2026-09-14)** — six phone items plus two in-place corrections. **D-1** rules the post-bet jump: after a bet the feed shows the viewer's own fresh post, keyed by the id the BET RESPONSE returned, with the active side switched to the side bet. ✅ **D-1's TEXT AND THE SHIPPED CODE DIVERGED AND THE RULING HAS LANDED (MOBILE-2m).** A8 D-1 and its Measurements clause are amended IN PLACE to the mechanism below, and `docs/parked.md` **2l-1** is CLOSED; no code changed, because the code was right. The superseded reading is kept here only so a reader arriving from an older document learns what happened — D-1 says "through the desktop's own pin … the feed region scrolls to top", and the desktop holds NO pin (`DebateView.tsx:930`: "NOTHING IS HELD BY ANY OF THIS"); what looks like one is a PAGED column whose index moves to the author's card. The phone mirrors that mechanism — it scrolls the CARD's top to the region's top — because the feed is ranked and a literal `scrollTo(0)` would show the author a stranger's post as their own. D-1's Measurements clause also names a bet placed on the local QA database, which could not be run (no session, and creating one means authenticating as the founder). A8 was appended VERBATIM because the round authorised exactly that and nothing else under `docs/adr/`; see `docs/parked.md` **2l-1**. **D-2** the identity block is two lines at every phone width, the pseudonym yielding — which WITHDRAWS UI-OVERNIGHT 1b rule 8 below 640px. **D-3** the split bar (no code change: measured already satisfied). **D-4** the positions filter shows the market's tag alone. **D-5** the header avatar below 640 is a circle — a SECOND ruled behaviour in `IdentityCluster.tsx`, so that file's closed allowlist widened from one token to ten. **D-6** the post sheet's header line is the market question. Its **Corrections** amend A6's Measurements clause and widen A7 D-2 IN PLACE, closing `docs/parked.md` **2j-1** and **2k-5**. A7 (MOBILE-2k, 2026-09-14) adds two things to the FEED view below 640px and supersedes nothing. **D-1** — a single `↑ Top` pill under the side tabs, the replacement for the pull-to-refresh that A2's bounded shell removed: the document does not scroll below 640, so the overscroll that fires the browser's gesture cannot happen, and a reader a screen deep had no way back to the top and no way to ask for fresh prices. It shows above one viewport while the reader moves UP, hides on the way down, below half a viewport, and whenever a sheet holds the scroll lock; a tap scrolls the REGION to 0 and then refetches ONCE. ⚠ It is the THIRD leaf under `debate/phone/` to register a listener and the only one that registers on an element the HOST owns — a passive `scroll` read — so it is the fourth row in `phone-gesture-wall.test.ts`'s closed allowlist (⛔ this read *first leaf … of its own* until `@code-reviewer` ran the grep: `PhoneFeedTrack` registers two and `PhoneSheet` one), which that guard's own docblock calls a decision rather than an edit. **D-2** — a post's attachment is capped at 60% of the visual viewport, whole and uncropped, on the card's own ground with no border, at the CARD's radius (`--r`, 8px) rather than the ratified `--imgr` (6px) — a deliberate divergence for this surface, recorded as one. ⚠ There is NO aspect-ratio reservation and that is measured rather than skipped: `image_uploads` carries `content_type` and `byte_size` and no width or height, so there is nothing to reserve with (`docs/parked.md` 2k-1). A6 (MOBILE-2j, 2026-09-14) **supersedes A5 D-1** — the founder walked the viewport-tall snapped tile and rejected it, so `/u/[pseudonym]`'s positions are full-width rows of NATURAL height in the page's ordinary scroll again, with the movement chip as the one element that yields when the money line cannot fit, and the sell sheet's amount rebuilt as a borderless 48px figure with the holding stated beneath it as the ceiling. A5 D-2 and D-3 stand. ⚠ A6's Measurements clause predicts the chip hidden at `Đ 14,260`; the measurement says it is shown and the line fits, because the type came down with the tile — `docs/parked.md` 2j-1, a founder ruling. A5 (MOBILE-2h, 2026-09-13) supersedes A4 D-3 in full — below 640px `/u/[pseudonym]`'s positions are TILES, one visual viewport tall, snapped on the page's own scroller, growing past a screen rather than clamping the market question — and corrects two things the record had wrong: A4 D-2's `SellModule` reference (nothing imports it) and A3 D-3's claim that no handler under `phone/` calls `preventDefault` (the keyboard ones do, and are permitted). A4 (MOBILE-2e, 2026-09-13) extends D-2 to `/u/[pseudonym]` — phone-only leaves under `src/components/profile/phone/`, and SELL reached from a position row through the shared `PhoneSheet` — and rules D-4(vi): **no tooltip mounts on the phone tier at all** |

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

✅ **DISCHARGED for both kinds, 2026-09-11 — QUOTE-1 A (PR #513) took the STRIP exit.** The
table above is now history: `MarketMediaPanel`'s empty arm returns `null`, `PostImagePlaceholder`
is deleted and all three of its mounts render nothing, so **the inventory this section counts is
ZERO**. Every guard was INVERTED rather than removed — a re-mount reds six named tests, verified
by mutation — and the two design-ratified null states listed apart are untouched, which is why
they were listed apart. ⚠ Kind 2's null arm is **interim**: QUOTE-1 C replaces it with the
argument title rendered as a quotation well. ⚠ The docket's guard names are stale and were left
so: `ships-none-of-the-mockups-MARKET-CONTENT` is
`ships-no-invented-content-and-no-market-fields-leak` since `2a70915f`, and `renders-BOTH-cards`
/ `carries-the-byte-carried-chrome-labels` no longer exist under any name.

✅ **Kind 2's interim `null` is DISCHARGED ON THE CARD, 2026-09-11 — QUOTE-1 C (PR #515).**
`PostCard`'s imageless arm draws the **title-as-quotation well** (design-canon `C-QUOTE-1`,
SPEC.1 2.0.2) in its `.argimg` cell, and the plain title row does not render on that arm.
⛔ **The inventory stays ZERO** — a well is not a placeholder: it renders the post's own derived
title, not byte-carried chrome describing content that does not exist, which is this section's
own definition. ⚠ **The hero is still pending**: `PostFocusHeader` and `ReplyCard` keep the
interim `null` by ruling, owed at **QUOTE-1 C2**. ⚠ The well is wrapped in the title row's own
`onEnter` button — deleting that row removes an imageless card's only path into post-focus, since
row 23 had already deleted `Open debate →` from the present branch *because* the title carried it.
Every test in `post-arm-headers` / `history-ladder` / `posted-jump` that enters a post by clicking
the title heading's enclosing button reds without the wrap and greens with it — **22 failing tests,
15 / 6 / 1 by file**, counted as failing TESTS rather than as call sites and reproducible by
reverting the button. Pending founder ratification (`docs/plans/QUOTE-1.md` §8 D).

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
| **ADR-0045 + MOBILE-1 plan** | **#467** | `ead7415` | **2026-09-03** | the decision and the plan |
| **MOBILE-1 Phase A** | **#486** | `4133338` | **2026-09-06** | the read surfaces reflow at phone width |
| **MOBILE-1 Job A** | **#497**, **#510**, **#511** | `73593f5`, `b19bb43`, `080a798` | **2026-09-07/11** | auth surfaces (ADR-0048) and the signed-in header (ADR-0049) |
| **MOBILE-1 Job B** | **#509** | `7ffc18c` | **2026-09-11** | the phone reads and sells its own positions |
| **MOBILE-2** | *(draft, unmerged)* | — | **2026-09-12** | the phone tier of `/m/[slug]` (ADR-0051) |
| **MOBILE-2b · 2c · 2d** | *(same PR #517)* | — | **2026-09-12/13** | four refinement rounds on that tier: the sheet's latch and geometry, the scroll model, the bounded shell |
| **MOBILE-2h** | *(same PR #517 lane)* | — | **2026-09-13** | the profile's positions become TILES (ADR-0051 A5) — one position per screen, snapped on the DOCUMENT scroller (which needed the panel and its body to release `overflow` AND restore `min-w-0`, and the three-tile window cap to stand down on the tier); the positions head fits one line at 360 with a market selected; the sell sheet's amount is its largest element at 32px over a 44px target |
| **MOBILE-2j** | *(same PR #517 lane)* | — | **2026-09-14** | the tile goes BACK to a list (ADR-0051 A6, superseding A5 D-1) — natural height, no snap anywhere on the surface, `<html>` byte-identical to its pre-2h form, the type stepped down 24/24/13 → 18/18/11 with the title at 15px, one measured data rule dropping the movement chip past six formatted characters, and the sell sheet's amount rebuilt as a frameless 48px figure over a stated ceiling |
| **MOBILE-2k** | *(same PR #517 lane)* | — | **2026-09-14** | the feed gets a way back to the top and its images stop running off the screen (ADR-0051 A7) — a 36px/44px `↑ Top` pill 12px under the side tabs, driven by ONE passive scroll listener, refetching exactly once per tap and never under an in-flight bet; and a post's attachment capped at 60dvh, borderless, at the card's own radius. ⚠ The first version of the pill hid itself DURING its own smooth scroll — the `Refreshing…` label showed for one frame in ninety-six — because the rule it obeys could not tell the reader's scroll from its own |
| **MOBILE-2l** | *(same PR #517 lane)* | — | **2026-09-14** | round eight, the last before the merge (ADR-0051 A8) — the author's own post is brought to the top of the feed after a bet, by the desktop's measured mechanism rather than the pin the brief described; the identity block holds two lines at every phone width by making the PSEUDONYM the field that yields (`flex-1` is what decides it — a wrapping flex container breaks rather than shrinks, so `truncate` alone shipped three lines); `Flipped`/`Exited` and `Sold` become one chip register; the positions filter shows the market's TAG with its caret finally outside the truncating box; the header chip becomes a 44px circle below 640; and the post sheet's header line becomes the market question. ⚠ The split bar was measured ALREADY SATISFIED (6.00px track, figure centres Δ0.00) and deliberately not touched. ⚠ Desktop proven unmoved two ways: **0** desktop CSS rules added or removed across the whole app, and **0** geometry movers on both routes at 1440 and 640 |
| **MOBILE-2m** | *(a NEW PR — #517 was merged on 2026-09-13 and cannot carry this)* | — | **2026-09-14** | round nine (ADR-0051 A9) — the feed card loses its box below 640 and posts are separated by one full-width hairline, the content box 24px wider for it; the split bar gains a recessed channel so Đ 0 against Đ 0 stops reading as 100% Counter; the header drops Back below 640 and pins the mark to its own centre (43.13px → 0.00 at 360, in both auth states); the pseudonym steps 17 → 14px; and the positions filter pill stops being a 44px painted box beside 24px tabs. ⚠ The grid defect it caught is the round's best evidence for taking screenshots: every measured number said the header was correct while the avatar was painted over the logo |
| **MOBILE-2n** | *(the MOBILE-2m PR lane)* | — | **2026-09-14** | round ten (ADR-0051 A10) — the chips leave the name's line for the end of the meta row; the split bar becomes a 14px channel with a share drawn over it and an even split at zero stake; the bet footer gives up the last ground on the card; the pseudonym centres on the avatar (−7.25px → −0.37px, by naming one spacing step rather than one number, so the alignment survives a changed root font size); and the phone header gets the repository back. ⚠ Desktop proven unmoved: `/u/` **0/0/0** at 1440 and 640 in BOTH auth states, `/m/` 0/0/0 at 640 — the only residue is eight price-chart `terminal-*` markers whose x tracks *now*, drifting 0.01px over fifteen minutes and 0.09px over fifty, with a tip-vs-tip control at zero |
| **MOBILE-2o** | *(the MOBILE-2m PR lane, #536)* | — | **2026-09-15** | round eleven (ADR-0051 A11) — the footer's colours go back under the side rule: the bar's remainder is Counter's own pole rather than a groove, the groove becomes the Đ 0 / Đ 0 state alone, the half-fill at zero is withdrawn, the black side declares the hairline and a refused button is dimmed rather than grounded. ⚠ **The X control was built, measured and STOPPED** — it covers the logo by 27.12px at 360 signed out, which is the brief's own halt condition; A11 D-4 is ratified and unbuilt (`docs/parked.md` **2o-1**). ⚠ Desktop proven unmoved with a same-build control taken across the same elapsed time: `/u/` and `/m/` at 1440 and 640, both auth states, **0 geometry and 0 paint differences** — the only residue is one countdown digit, which is the proof the clock ticked across the interval rather than a gap in the measurement. ⚠ The same-build control reads 28 geometry and 4 paint, and it is an UPPER BOUND rather than a matched pair: its two captures bracket the ground capture and so span roughly twice the interval. Stated because a floor larger than the reading it bounds is otherwise unreadable |
| **MOBILE-2e** | *(same PR #517)* | — | **2026-09-13** | round five — the composer's primary, the split bar's 32/6, **no tooltip below 640px**, the identity row's chips on line 1, a 24px flick floor; and the PROFILE's phone view: three-across tiles, a one-row positions head, desktop-shaped rows with a hairline, the argument viewer hidden, and SELL through `profile/phone/PhoneSellSheet.tsx` |

⚠ **Four merged PRs in this lane carry the retired `⛔ LEAVE UNMERGED` / `DO NOT MERGE`
marker** — #254, #336, #403, #448. CLAUDE.md §5.13.2 explains why a marker on `main` is not
evidence that unreviewed work landed, and retires the form.

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-5` | the placeholder-count arithmetic in `ResolverCards.tsx` and in `AGENTS.md` |
| `docs/STATE.md` §4 · `F-10` | SPEC.1 carries two uncorrected "six-card deck" statements (`:1505`, `:1573`); §21.9 and the seven-element array agree |
| `docs/STATE.md` §4 · `F-11` | ⚠ **STALE AS OF 2026-09-13 AND CONTRADICTED BY ROWS 43 AND 138 OF THIS FILE.** It reads "ADR-0045 is accepted and MOBILE-1 is planned; nothing is built, 12 days out". Five mobile PRs have merged (#486 · #497 · #509 · #510 · #511) and the sixth is open as #517. Left in place as the pointer it is — the correction belongs in `STATE.md`, not here — but named so a reader does not take it as current |
| `docs/parked.md` — SEQUENCE row 5 | strip or gate the `/m/[slug]` placeholders before the DP.2 promote |
| `docs/parked.md` — SEQUENCE row 6 | a staging session cannot be re-obtained in-session (its `/bookmarks` example is a removed route) |
| `docs/parked.md` — HTML-FINISH · MARKET DETAIL R2 | the full placeholder docket, with the strip-vs-gate choice left to the founder |
| `docs/parked.md` — RPLY-CLOSE P1 … P4 | seven reply-surface residue rows, severity-labelled |
| `docs/parked.md` — WARLI-3 | the composition notes |
| `docs/polish/POLISH-register.md` | the visual defect register for this lane |
| `docs/design/design-canon.md` · `design-language.md` · `design-token-contract.md` | **the design contract — pointed at, never restated** |
