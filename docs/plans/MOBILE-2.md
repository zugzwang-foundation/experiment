# MOBILE-2 — the phone tier of `/m/[slug]`

**Task:** MOBILE-2 · **Branch:** `feat/mobile-2-market-detail` · **Base:** `origin/main` = `8d63ebc06f34a9b9549a6aa6a9dc4d8db7bb5e76` (`8d63ebc0`, measured — the brief's asserted SHA was correct)
**Mode:** autonomous overnight, `docs/overnight-run.md` v1.2 · **Brief:** `zz_MOBILE-2_overnight-brief_2026-09-11.md` (md5 `df9e442127b6cceab8212101914c6ba3`)
**VIEW slot:** `FEED`
**Recon:** `~/Downloads/zz_MOBILE-2_recon_2026-09-11T1802.md`

---

## 1 · What is being built, in one paragraph

Below 640px, `/m/[slug]` stops reflowing the desktop arena and renders a **second presentation over
the same data**. `page.tsx` returns a fragment holding `<DebateView>` (unchanged but for one
appended `max-mobile:hidden` token) and `<PhoneDebateView>` (`hidden max-mobile:flex`). The phone
tree owns no data and no writes: it consumes `DebateViewModel` + `ViewerMarketContext` +
`initialPostId` + `ownPseudonym`, and every write goes through the **reused `BetComposer` instance**
mounted inside a bottom sheet, or through `AuthGateSlot` when signed out. The two roots hide
together and a guard pins that.

---

## 2 · Ambiguities resolved — chose / rejected / why

| # | Ambiguity | Chose | Rejected | Why |
|--:|---|---|---|---|
| A-1 | `VIEW` slot | **FEED** — continuous vertical list, 12px gutters, no y-snapping | REEL | The prompt's slot reads `«FEED»`. RF-3 says build the mode the slot names. |
| A-2 | Where the 40px strip thumb comes from | **`model.market.thumbImageUrl`** | RF-2's `getDefaultMarketMediaUrl` call in `page.tsx` + a 5th prop | The field is already on the read model, is the same `is_default` row, costs no extra read, and is already rendered by `PostFocusHeader.tsx:119`. Honours "do not extend `DebateViewModel`" more strictly than the brief's own mechanism. |
| A-3 | `onPosted` mirroring | **close sheet + `router.refresh()`** | also mirroring `setPosted({commentId, fromModel})` | `posted` feeds `findPostedNode` + the desktop scrollers' one-shot jump. The phone registers no scroller, so mirroring it would carry state with no consumer. The observable behaviour — the refresh — is mirrored exactly, and the refresh BUDGET (pinned at two by `posted-refresh-budget.test.tsx`) is unchanged because the phone's refresh replaces, never doubles, the desktop's. |
| A-4 | Sell on the phone market bar | **absent** | a Sell control beside the position readout | RF-5 rules it out; the profile carries phone Sell since Job B (#509). Selling is the only comment-free action and putting it on the argument surface is a product decision, not a layout one. |
| A-5 | The position readout's label | **`COMPOSER_COPY.yourPositionLabel`** → `Your position · YES · Đ 52` | the brief's literal `You hold` | Prompt §3: *every string is live (`copy.ts`) or canon §6*. `You hold` is neither and R2 flagged it `?G-3`. |
| A-6 | The thread view's parent post | **a sheet opened by tapping the strip**, carrying the full `PostCard` | leaving no way to read the parent | The founder amendment removed the pinned card from the screen and did not say where the post goes. A reply surface with no way to read what is being replied to is unusable. Expect a morning refinement either way. |
| A-7 | The phone avatar step | **`max-mobile:` override attempted, then MEASURED** | asserting 36px (not a live step) or silently keeping 24 | `ui/avatar.tsx:8-16` documents that `data-[size=sm]:size-6` is specificity (0,2,0) and beats a bare `size-*` from `className` regardless of twMerge. The override is written in the compound form and the result is read off the compiled sheet before it is claimed. |
| A-8 | RF-6's empty image slot | **hide `EmptySlotFigure` below 640 and render `EMPTY_SLOT_COPY.action` in a `max-mobile:`-gated span inside the same pick button** | the brief's "hide the art, the button becomes `w-full`" | `Add Image` is drawn INSIDE the SVG (`ImageAttach.tsx:204-230`). Hiding the art hides the affordance. OVN-O4: the ruled outcome is kept, the inferred mechanism is replaced by a measured one. |
| A-9 | The `Open` pill in the details stats row | **export the existing `LifecycleBadge` from `MarketHeader.tsx`** | a second copy of its four lines in `phone/` | A private component copied into a second file is the SEP-1 drift story exactly. Adding `export` changes no rendered output at any width. |
| A-10 | The `AI mode` control in the details sheet | **the same `<a download href={/m/<slug>/export}>` with the same `aria-label`, without the `InfoTip` wrapper** | wrapping it in `InfoTip` as `MarketHeader` does | A hover gloss has no hover on a phone, and `InfoTip`'s `asChild` across the RSC boundary is a documented hazard (AGENTS.md §5) worth not re-entering for no gain. The href, the download attribute and the accessible name — the parts that ARE the affordance — are byte-identical. |
| A-11 | The description disclosure | **mount the live `CriterionDisclosure`** | a new clamp + `KnowMore` pair | `KnowMore` opens the post pop-up; it is not a description control. `CriterionDisclosure` is the component authored for exactly this string, currently unmounted by a PLACEMENT ruling (`DebateView.tsx:1379-1388` says so in terms). |
| A-12 | B1/B2/B3 measurement layer | **two Preview deployments of this branch (`P0` docs-only ≡ `origin/main`, `P1` final), read back to back** | the brief's local prod build | The local Postgres holds zero markets; `/m/<slug>` renders `notFound()` locally. See recon P-2. |
| A-13 | `page-container.test.ts` site-9 `now` | **updated in the same commit, with the reason in the row's comment** | loosening the assertion to `toContain` | It is a site pin. It is supposed to red on a deliberate class-set move, and the MOBILE-1 Phase A precedent for updating `now` additively is in the row already. |

---

## 3 · File map — every file and why

### New, under `src/components/debate/phone/`

| file | RSC | why |
|---|---|---|
| `PhoneDebateView.tsx` | client | The owner: `activeSide`, `sheet`, `suspended`, `composerBusy`, and the feed↔thread arm switch on `initialPostId`. |
| `PhoneTitleStrip.tsx` | client | The whole strip is the details tap target (`role="button"`, `aria-expanded`) — RF-2 / RF-9. |
| `PhoneSideTabs.tsx` | client | `YES p%` / `NO p%`, pole-filled active. Also the thread arm's `SUPPORT n` / `COUNTER n`. |
| `PhoneFeedTrack.tsx` | client | The x scroll-snap track, two panes, `IntersectionObserver` → active side. No gesture JS. |
| `PhoneBottomBar.tsx` | client | All five states (RF-5) including the thread arm's SUPPORT/COUNTER pair. |
| `PhoneSheet.tsx` | client | The dialog shell: `role="dialog" aria-modal`, scroll lock, Escape, `×`, refuses to close while busy. |
| `PhoneDetails.tsx` | **server** | RF-7's content, passed to the client owner as `details`. |
| `PhoneResolverRows.tsx` | **server** | The four label/value rows over `getResolutionBlocks`, with the same catch-and-degrade posture `ResolverCards` carries. |

### Edited — additive only

| file | edit |
|---|---|
| `src/app/(public)/m/[slug]/page.tsx` | fragment + `<PhoneDebateView …>` sibling + `details={<PhoneDetails …/>}`. No wrapper element. |
| `src/components/debate/DebateView.tsx` | **one token** appended to the `PageContainer` className: `max-mobile:hidden`. |
| `src/components/debate/ArgProfile.tsx` | `max-mobile:` tokens for the two-line identity block. |
| `src/components/debate/PostCard.tsx` | `max-mobile:` tokens only (card padding / title size). |
| `src/components/debate/composer/BetComposer.tsx` | `max-mobile:` tokens (full-width fields, full-width submit). |
| `src/components/debate/composer/ImageAttach.tsx` | `max-mobile:hidden` on the `EmptySlotFigure` mount + the gated `Add Image` label span (A-8). |
| `src/components/debate/composer/PositionStrip.tsx` | `max-mobile:` tokens if measurement shows it clips; **measure first**. |
| `src/components/debate/MarketHeader.tsx` | `export` on `LifecycleBadge` (A-9). No render change. |
| `tests/unit/shell/page-container.test.ts` | site-9 `now` += `max-mobile:hidden` (A-13). |

### New tests

`tests/unit/design/phone-market-detail.test.ts` (source scans 1–8) ·
`tests/unit/debate/phone/{tabs,gate,entry-gate,reply-relation,market-state,thread-relation,sheet-a11y}.test.tsx` (RTL 9–15).

### Docs, same commit as S6

`AGENTS.md` (the MOBILE-2 bullet) · `docs/parked.md` (token census row + the Phase A redundancy note) ·
`docs/records/SURFACES-record.md` `:43 :138 :255 :267` · `docs/STATE.md` §2.

---

## 4 · Slices, ordered, each with its exit condition

| # | Slice | Exit condition |
|--:|---|---|
| **S1** | Scaffold: `phone/` dir, `PhoneDebateView` skeleton, the sibling mount, the one token on `DebateView`'s root, the `page-container` `now` update, guards #1 and #7 | full suite green · the phone root visible at 375 and `display:none` at 1440 · `main.children.length` 1 → 2 |
| **S2** | Feed arm: title strip, tabs, snap track, side panes over `PostCard`, bottom bar (all states). Guards #2 #5 #9 #11 #13 | full suite green |
| **S3** | Composer sheet: `PhoneSheet`, `BetComposer`/`AuthGateSlot` mount, handler mirror, the `ImageAttach` empty state, `max-mobile:` tokens inside the composer. Guards #3 #4 #8 #10 #12 #15 | full suite green |
| **S4** | Details sheet: `PhoneDetails` server leaf, `PhoneResolverRows`, `PriceBar`, stats row with `Open` + `AI mode`, the chart mounted on first open | full suite green |
| **S5** | Thread arm: strip with post title + market subscript, post sheet on strip tap, `SUPPORT`/`COUNTER` relation tabs over `post.replies.{support,counter}`, reply cards, bottom bar. Guards #6 #14 | full suite green |
| **S6** | Full suite · reviewer cascade · fixes · docs · re-measure B1–B6 · push · draft PR · preview verified · PNGs · report | draft PR open and unmerged, preview serving the branch tip |

**Reviewer-bearing slices:** S6 runs the whole cascade over the whole diff. `@test-writer` is
launched with `isolation: "worktree"` (OVN-O8), and **every B1–B5 measurement is taken either before
the cascade starts or after it finishes**, never during.

---

## 5 · Baselines — measured, and the predicted post-build value

| # | What | Layer | **Measured at `8d63ebc0`** | Predicted after |
|---|---|---|---|---|
| B1 | 1440×900 `/m/<slug>` list + `?post=1`: pixel diff, and the normalised `outerHTML` hash of `document.querySelector("main").firstElementChild` (a STRUCTURAL selector, not a styling class — OVN-V5) | Chrome `--headless=new` + CDP, own browser, in-page 1440px iframe, fonts awaited, animations killed, `/api/health` canary asserted from inside the frame | taken on `P0` at the end of the run | **0 px diff · identical hash** · `main.children.length` 1 → 2 |
| B2 | 375×812: `documentElement.scrollWidth`; elements with `scrollWidth > clientWidth` inside cards; the `<h1>` overflow | same | 375 / 6 / 231px (RECON, to be re-taken on `P0`) | 375 / **0** / **0** |
| B3 | JS transferred on `/m/<slug>` at 375 (gzip bytes over the network) | CDP `Network` totals | taken on `P0` | report the delta; no target |
| B4 | Full suite file/test counts | `pnpm vitest run`, local PG :54322 | **480 files / 4928 tests / 220.22s** | +N files, +M tests, green |
| B5 | `max-mobile:` distinct token census, comment-stripped | `git grep` + the RECON census method | **14 distinct / 34 sites** | n > 14; `docs/parked.md` row updated with the measured n and date |
| B6 | Full suite at `origin/main` in this worktree | same as B4 | **GREEN** — 479 passed, 1 skipped, 0 failed | — |

---

## 6 · The fifteen guards, and the wrong answer each must reject

| # | Guard | The wrong answer it rejects |
|--:|---|---|
| 1 | twin-hide-together | one root hidden below 640 and the other not → two trees at once, or none |
| 2 | no `sm:`/`md:`/`lg:`/`xl:` under `phone/` | a second breakpoint system inside the phone tier (`-P`, because `\b` is not honoured by `-E`) |
| 3 | no write path in `phone/` | a second fetch to `/api/bets/*` outside `BetComposer` |
| 4 | the sheet's content set | a submit control in `phone/` that is not `BetComposer`'s |
| 5 | no `.sort(` in `phone/` | a second ranking, diverging from the desktop column order |
| 6 | the relation partition comes off the model | new side arithmetic in the thread component |
| 7 | the four-prop mount without a wrapper | a wrapper element breaking the height chain |
| 8 | no `ssr:false`, no `matchMedia` but `prefers-reduced-motion` | a JS viewport branch (hydration mismatch) |
| 9 | tab switch flips the bar label | a bar that does not follow the active pane |
| 10 | `viewer === null` → `AuthGateSlot`, not `BetComposer` | a signed-out composer |
| 11 | opposite side held → disabled + the live reason | an invited bet the viewer cannot place (F-3) |
| 12 | Support/Counter derive the right side and relation | a reply on the wrong pole (INV-3 at the UI) |
| 13 | `status !== "Open"` → no button | a bet control on a read-locked market |
| 14 | thread SUPPORT/COUNTER counts | a relation partition that inverts on a NO post |
| 15 | strip `role="button"`+`aria-expanded`, sheet `role="dialog"`, Escape closes | an untouchable / unannounced sheet |

Every one is verified by **reverting its fix and watching it red** (OVN-V2), and every negative
assertion carries a positive control (OVN-V1). Selection is by `data-testid` on the phone root,
strip, tabs, track, panes, bar and sheet — never by a styling class (OVN-V5).

---

## 7 · Walls carried into execution

⛔ No edit under `src/server/**`, `drizzle/**`, or `composer/{requests,gating,state-map,payload,idempotency,envelope,image-attach,sell-convert}.ts`.
⛔ Desktop ≥640px pixel- and DOM-identical (B1 is the instrument; if B1 ≠ 0 at the end, revert until it is).
⛔ No path to a bet without an argument — the sheet mounts `BetComposer` or `AuthGateSlot` and nothing else.
⛔ No merge, no push to `main`/`staging`, no production touch, no `vercel promote`.
⛔ No authoring of ADRs/SPECs/design-language — `docs/adr/0050-*.md` is committed verbatim from the brief.
⛔ No Phase A `max-mobile:` token or guard removed.
