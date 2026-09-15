# MOBILE-2 — close-out record

**Generated** 2026-09-15 from the repository at `f55d738f` (branch `feat/mobile-2-market-detail`,
PR #536) · **Descriptive**, per `docs/records/README.md`: regenerated from the code and the commit
log, carrying no rule of its own. The rules are `docs/adr/0051-phone-market-detail-presentation.md`
(A1–A12) and ADR-0045/0048/0049.

> **What this lane is.** Below `--breakpoint-mobile` (640px), `/m/[slug]` and `/u/[pseudonym]`
> render a **separate presentation over the same read model** rather than a reflow of the desktop
> tree — `PhoneDebateView` and the leaves under `src/components/debate/phone/` and
> `src/components/profile/phone/`, consuming `DebateViewModel` and the profile's existing read
> model, containing no write path of their own. The desktop tree is unchanged and hidden below
> 640px by one additive token; the phone root is hidden above it; the two hide together, guarded.
> Every write still goes through the reused `BetComposer` and `InlineSell` instances, so mandatory
> commentary (INV-1) holds on the phone exactly as it holds on the desktop.

---

## §1 · Timeline

⚠ **Two sequences run through this lane and they are not the same sequence.** The **letters**
(`MOBILE-2`, `2b` … `2o`) are RUNS — one staged report each, in `~/Downloads`. The **numbers**
("round eight", "round nine") are the ADR's own AMENDMENT sequence, `A1`…`A12`. Some letters are
fix passes that carry no amendment; one amendment (`A10`) has no letter of its own. Where a row
below pairs the two, the pairing is taken from the ADR's dated header and the run report's
timestamp, not from a marker in the commit log — except for `A8`–`A11`, which name their round
number in the ADR heading, and `A1`–`A4`, which name their run.

| Run | Date (IST) | Ground → tip | ADR | What it settled |
|---|---|---|---|---|
| **RECON** | 09-11 14:12 | — | — | `/m/[slug]` at 375 measured on staging: question 231px over, resolution blocks clipped, no chart below 1024, composer with no phone shape |
| **MOBILE-2** | 09-11 23:46 → 09-12 01:52 | `09850b9c` → `e49f27f5` | D-1…D-6 | The tier itself: title strip, side tabs over a snap track, post card, bottom bar, composer sheet, details sheet, thread view |
| **2b** | 09-12 04:50 → 05:37 | `e49f27f5` → `6f345639` | **A1** | Mechanism corrections; the `D-2` scoped exception; the portal tier gate; the hidden desktop tree's intervals paused below 640 |
| **2c** | 09-12 15:23 → 19:30 | `0529eabd` → `d5aad22d` | **A2** | One sheet shell for every phone sheet; tab-control exception to the pole binding; composer order; identity row; the Android touch matrix |
| **2d** | 09-12 21:42 → 09-13 03:31 | `d5aad22d` → `6d0f467b` | **A3** | The bounded app shell, and **the topology rule**: the vertical scroller must be an ANCESTOR of the horizontal snap track. 40/40 against 25/40 |
| **2e** | 09-13 10:00 → 11:25 | `6d0f467b` → `d4870816` | **A4** | The tier extends to `/u/[pseudonym]`; phone Sell through the shared sheet; no tooltips on the tier |
| **2f** | 09-13 11:40 → 11:57 | `d4870816` → `e1c17249` | — | Sell-sheet copy, the market filter's own width, a guard that selected its subject by the thing it asserted |
| **2g** | 09-13 11:59 → 13:00 | `e1c17249` → `7f66cc31` | — | Reachability on the sell sheet; six guards rewritten after they were shown unable to fail |
| **2h** | 09-13 21:46 → 22:20 | `9e12fb0d` → `74feed7a` | **A5** | The profile's positions become tiles; `SellModule` struck; the `preventDefault` claim corrected for keyboard handlers |
| **2j** | 09-13 22:46 → 09-14 03:07 | `74feed7a` → `f3345c81` | **A6** | A5 D-1 withdrawn — full-width tiles of natural height in the ordinary scroll; the sell amount becomes one borderless figure |
| **2k** | 09-14 03:46 → 06:14 | `f3345c81` → `b7114791` | **A7** | The `↑ Top` pill (pull-to-refresh's replacement, which the bounded shell removed) and the 60%-viewport media cap |
| **2l** | 09-14 06:14 | — | — | The auditor's two windows; a reassurance that was true of firing and false of landing |
| **2m** | 09-14 11:30 → 12:16 | `b7114791` → `5faa913d` | **A8** | The post-bet jump, the two-line identity block, the 6px split bar, the filter pill, the circular header avatar, the post sheet header |
| **2n** | 09-14 18:13 → 19:44 | `e65c7821` → `76b69034` | **A9** | The unbounded card, the bar's channel, the header with no back button, the 14px pseudonym |
| **round ten** | 09-14 22:33 → 22:51 | `f55f2030` → `79880437` | **A10** | Chips onto the meta row, a 14px bar, the name centred on the avatar — **and the GitHub control** |
| **2n-fix** | 09-15 00:16 | `79880437` → `693ea9c1` | A10 D-3 withdrawn | The footer's ground restored: the band was the contrast the two poles were legible against |
| **2o** | 09-15 02:31 → 03:31 | `693ea9c1` → `89a80281` | **A11** | The footer under the side rule; grey means Đ 0 and nothing else; **the X control built, measured, reverted** |
| **2z** (this) | 09-15 11:23 → 12:11 | `89a80281` → `f55d738f` | **A12** | The X control withdrawn; the supersession rule; the close-out measurement |

---

## §2 · What shipped, indexed to A1–A12

| ADR | Ruling | Where it lives |
|---|---|---|
| D-1…D-6 | The separate presentation; the phone-only leaf rules; the guard family | `src/components/debate/phone/`, `tests/unit/design/phone-market-detail.test.ts` |
| A1 | Mechanism corrections; portal tier gate; intervals paused below 640 | `PhoneDebateView.tsx`, `tests/unit/design/phone-portal-tier.test.ts` |
| A2 | One sheet shell; tab-control pole exception; composer order; identity row | `PhoneSheet.tsx`, `PhoneSideTabs.tsx` |
| A3 | The bounded shell and the scroller-above-track topology | `PhoneDebateView.tsx`, `debate/scroll-lock.ts`, `tests/unit/design/phone-scroll-model.test.ts` |
| A4 | The tier extends to the profile; phone Sell; no tooltips | `src/components/profile/phone/` |
| A5 | Positions become tiles *(D-1 withdrawn by A6)* | `PositionsTable.tsx` |
| A6 | Full-width tiles, natural height; the borderless sell amount | `PositionsTable.tsx`, `InlineSellAmount` |
| A7 | The `↑ Top` pill; media capped at 60% of the viewport | `PhoneTopPill.tsx`, `CommentImage` |
| A8 | Post-bet jump; two-line identity block; filter pill; circular avatar | `PhoneDebateView.tsx`, `ArgProfile.tsx`, `GlobalHeader.tsx` |
| A9 | Unbounded card; the bar's channel; no back button; 14px pseudonym | `PostCard.tsx`, `AggregateFooter.tsx`, `HeaderNav.tsx` |
| A10 | Chips on the meta row; 14px bar; name centred; **the GitHub control** | `ArgProfile.tsx`, `AggregateFooter.tsx`, `GitHubIconControl.tsx`, `header-control.ts` |
| A11 | The footer under black = YES / white = NO; no fill at Đ 0; the refused side at 40% of its own pole | `AggregateFooter.tsx` |
| A12 | The X control withdrawn; the supersession rule; the state at close-out | this record + ADR-0051 |

---

## §3 · The walls at close, measured at the close-out tip

**Instrument.** A local production build (`next build` + `next start -p 3100`) against the
`zugzwang_qa` database, `VERCEL_GIT_COMMIT_SHA` set to the commit under test and `/api/health`'s
canary asserted **from inside the measured frame, in the same evaluate as the geometry**. Every
rule in AGENTS.md §9's browser-measurement bullet throws rather than warns: the viewport is
asserted from inside the page, Suspense boundaries asserted revealed, `document.fonts.ready`
awaited and `fonts.check('12px Geist')` asserted, a runtime-assembled phone-variant probe confirms
the stylesheet compiled, animation and transition are killed before any read. Harness in
`~/Downloads/zz_MOBILE-2z_qa/` — outside the repository, per the lane's standing rule.

### B1-p — the desktop wall

`origin/main` `a7bf4d2d` → tip `f55d738f`, both builds served from the same tree, captures taken
at the same carousel page:

| route @ width | auth | added | removed | **geometry** | **paint** |
|---|---|---|---|---|---|
| `/m/` @ 1440 | in | 0 | 0 | 10 | **0** |
| `/m/` @ 1440 | out | 0 | 0 | 10 | **0** |
| `/m/` @ 640 | in | 0 | 0 | **0** | **0** |
| `/m/` @ 640 | out | 0 | 0 | **0** | **0** |
| `/u/` @ 1440 | in | 0 | 0 | **0** | **0** |
| `/u/` @ 1440 | out | 0 | 0 | **0** | **0** |
| `/u/` @ 640 | in | 0 | 0 | **0** | **0** |
| `/u/` @ 640 | out | 0 | 0 | **0** | **0** |
| **TOTAL** | | **0** | **0** | **20** | **0** |

**The floor, the same build against itself:** `0` added, `0` removed, **`20`** geometry, `0` paint
— the same twenty rows, the same ten element families. Every one is the price chart's
clock-driven right edge: `line-yes` / `line-no`, the four `terminal-*` circles, the two terminal
labels and their YES/NO text spans, each moving 0.01–0.02px between two reads of the same build.
⇒ **The wall equals the floor exactly. Nothing else on the desktop moved, at either width, in
either auth state, on either route.**

⚠ **Two harness defects were found and fixed inside this run, and both would have produced a
plausible wrong number rather than an error.**

1. ⛔ **The signed-in arm was signed out, and nothing said so.** `session-cookie.json` carried an
   expired session; `withPage({signedIn:true})` therefore rendered the signed-out tree, so the
   first capture measured **the same auth state twice** while reporting two. The tell was node
   counts identical across the two arms (281/281, 190/190) where a header carrying a Đ cluster and
   an avatar cannot equal one carrying `JOIN`. Fixed by minting a fresh session against the local
   throwaway database; the arms then separate (296/281 and 208/190), which is the positive control.
   **The whole B1-p wall was re-captured from scratch afterwards.**
2. ⛔ **The fingerprint keys a leaf by its own TEXT, which a ticking clock churns.** When a
   countdown digit goes 8 → 7 its key changes, the same element is reported added-and-removed, and
   every other leaf with that digit re-indexes beneath it — so two unrelated elements end up
   compared under one key. Raw, that read **24 geo / 7 paint**; the differing rows were entirely
   digit-spans and chart terminals. The fix is not to exclude them — that would hide a real move —
   but to normalise a digit-only leaf to `#NUM` so the element keeps its key across a tick and its
   geometry and paint are then compared as usual. Strictly **more** sensitive than exclusion.
   Applied identically to the wall and the floor (`diff2.mjs`).

⚠ **A third artefact was caught by the floor rather than by a fix.** One capture landed with the
desktop carousel at page `3/9` instead of `5/9`, producing 42 added / 14 removed / 45 geo / 14
paint on `/m/ @ 640` signed in. The same-build floor reproduced that signature **exactly, with the
signs reversed** — which is what a floor is for. The wall above is taken at matched pages; the
unmatched pair is kept in `out/b1-tipE.json` so the claim can be re-checked.

### B2 — horizontal overflow below 640

`documentElement.scrollWidth − innerWidth`, both routes, both auth states:

| | 360 | 375 | 390 | 412 | 430 | 639 |
|---|---|---|---|---|---|---|
| `/m/sp-m2-active` signed in | **0** | **0** | **0** | **0** | **0** | **0** |
| `/m/sp-m2-active` signed out | **0** | **0** | **0** | **0** | **0** | **0** |
| `/u/GoldBadger000` signed in | **0** | **0** | **0** | **0** | **0** | **0** |
| `/u/GoldBadger000` signed out | **0** | **0** | **0** | **0** | **0** | **0** |

⚠ The per-element census reports `phone-pane-NO` past the viewport at every width. That is the
second pane of the side track's own horizontal scroller — what the component *is*. The document
does not scroll, and the document is what B2 measures.

### B7 — the named tap targets, measured as EFFECTIVE hit regions

⛔ **The element box is not the hit region in this tree.** A4 D-3's "hit areas extended to 44px
without handlers" is built as an absolutely positioned `::after` with a negative inset, so a census
reading `getBoundingClientRect()` alone reports those controls sub-44 and is wrong. Each row below
carries both, and counts a pseudo-element only when it is painted, absolutely positioned, not
`pointer-events:none`, and anchored to a positioned parent.

| target | box (360 / 390) | effective | verdict |
|---|---|---|---|
| Home | 34×34 | 34×34 | ⚠ **SUB-44** |
| Rules | 34×34 | 34×34 | ⚠ **SUB-44** |
| GitHub | 34×34 | **46×46** | PASS (`::after -inset-1.5`) |
| Avatar | 44×44 | 44×44 | PASS |
| Filter pill | 71.97×24 / 87.3×24 | **×46** | PASS (`::after`) |
| SELL | 59.73×44 | 59.73×44 | PASS |
| Amount field (sell sheet) | 57.59×57.59 | — | PASS |
| CONFIRM | 336×48 / 366×48 | — | PASS |
| `×` (details + sell sheets) | 44×44 | 44×44 | PASS |
| `↑ Top` pill | 67.7×36 | **67.7×44** | PASS (`::after`) |
| Support | 78×32 | **78×44** | PASS (`::after`) |
| Counter, enabled | 78×32 | **78×44** | PASS (`::after`) |
| BET YES / NO | 336×46 / 366×46 | — | PASS |
| Side tab | 165×44 / 180×44 | — | PASS |
| Title strip | 286×44 / 316×44 | — | PASS |

⚠ **Home and Rules fail, and they are not this lane's.** Both wear `HEADER_ICON_BUTTON`, the
desktop header's own 34×34 register, unchanged on `main`; they are already docketed at
`docs/parked.md` **2m-2**. The control this lane *added* to that row — GitHub — is the one that
carries the extension.

⚠ **Two rows needed a second look before they could be read, and both are recorded because the
first reading was wrong.** (a) Every `Counter` on the fixture market is **disabled** for this
viewer, who holds YES: a disabled control has `pointer-events:none` on itself and on its
hit-extension pseudo, so it has no hit region at all, by design (A11 D-3) — reading that as
"SUB-44" is a category error, and the row above is the first ENABLED Counter. (b) The composer
sheet renders `titleHidden`, so it has **no header row and no `×`** — it dismisses by backdrop
(360×740 / 390×844) and by the handle, per A2 D-3. An absent close there is the ruling, not a gap.

### The suite

| gate | result |
|---|---|
| `tsc --noEmit` | **exit 0**, zero output |
| `biome check .` | **exit 0** — 20 warnings, 13 infos over 1018 files; `origin/main` at `a7bf4d2d` reports **the same 20 and 13** over 1009. The lane adds files and **no new diagnostic** |
| `pnpm vitest run` | **exit 0** — **536 files passed**, 1 skipped; **5624 tests passed**, 1 skipped, 4 todo; 277.89s. `pgrep vitest` confirmed zero first |
| phone guard set | **35 files, 346 tests, all green** (`tests/unit/design/phone-*`, `tests/unit/debate/phone/*`, `tests/unit/profile/render/phone-*`, `tests/unit/shell/*-mobile-*`; the 36th path is `_fixtures.ts`, not a test) |

### ⛔ The GitHub control's destination

`https://github.com/zugzwang-foundation/experiment` — the href `GITHUB_REPO_URL` ships — answers
**HTTP 404 to an anonymous request**, with and without redirects. **The repository is still
private.** The control is correct, reachable and 46×46; what it points at is not public yet. On a
live site that is a reader tapping a link into a 404.

---

## §4 · The walls the lane did not cross

- **No file under `src/server/**`, `drizzle/**`, `src/db/**`, or `src/server/auth/**` is authored
  by this lane.** The twenty-five files PR #536 carries are **six components, four shell files**
  (one of which, `header-control.ts`, is a shared constant module rather than a component),
  **eleven guards and four documents** — counted with
  `git diff --name-only origin/main..HEAD`.
- **No migration, no schema change, no `EVENT_TYPES` entry.** Migration head is unchanged at
  `0030_liquidity_revoke_app_roles`.
- **No write path in `phone/`** — guarded textually, and every write still runs through the reused
  `BetComposer` / `InlineSell` instances.
- **Secrets:** a scan of the full 4,697-line diff against `origin/main` for token, key, private-key,
  JWT, connection-string and inline-credential shapes returns **0**.

---

## §5 · The carried files

Two files this lane carried through its own merges, **both already on `main` before the squash**,
and both **byte-identical** between the branch and `origin/main` (blob equality, not a diff):

| File | Origin | Blob |
|---|---|---|
| `src/server/debate-export/image/MarketPostExport.tsx` | #519 → #521 → **#525**'s version, taken into the lane at `7166b4b1` | `8012ad40` on both sides |
| `tests/_setup/production-ref-guard.ts` | **P-17** (`4ff3a243`), taken in at `9f96002a` | `90ee0fd0` on both sides |

⇒ **PR #536 re-carries neither.** They reached `main` through `staging` first; the squash changes
nothing about either.

---

## §6 · The supersession markers added under A12 D-2

Fifteen sentences in A1–A11 now carry a marker naming the later amendment that governs. **Nothing
was deleted and nothing was rewritten** — a rewritten amendment is no longer the thing that was
ratified. Line numbers are at `f55d738f`.

| Line | Amendment | Sentence marked | Governs now |
|---:|---|---|---|
| 53 | A2 `D-3 Scroll model` | nested snap track with pane scrollers | **A3 D-3** |
| 58 | A3 `D-3` | "no touch or pointer handler in `phone/` calls `preventDefault`" | **A5 D-3** |
| 70 | A4 `D-3 profile composition` | desktop-shaped position rows | **A5 D-1** |
| 72 | A4 `D-3 split bar` | buttons 32px, bar 6px, amounts on one line | **A8 D-3** |
| 90 | A5 D-1 | one tile per visual viewport, snapping | **A6 D-1** |
| 101 | A5 Measurements | the tile baseline (height against viewport, snap landing) | **A6 D-1** |
| 165 | A8 D-2 | position chips on line one | **A10 D-1** |
| 168 | A8 D-3 | the 6px bar, three figures in three columns | **A9 D-2** |
| 199 | A9 D-2 | the 8px bar over a muted ground visible at Đ 0 | **A10 D-2** |
| 202 | A9 D-3 | "home and rules sit left, the avatar right" | **A10 D-5** |
| 215 | A9 Measurements | bar height 8px, channel visible at Đ 0 | **A10 D-2** |
| 243 | A10 Measurements | fill at 50% at zero stake | **A11 D-2** |
| 244 | A10 Measurements | footer background transparent, border 0 | **A10 D-3 withdrawal** |
| 264 | A11 D-4 | the X control | **A12 D-1** |
| 269 | A11 Measurements | logo centred with **both** controls present | **A12 D-1** |

**Placement is at the clause, not always at the sentence, and that is deliberate in two rows.**
A9 D-3's marker sits after "the avatar right" and before the logo clause, because A12 D-1 expressly
reaffirms the logo ruling — marking the whole sentence would assert the opposite. A8 D-2's sits
after "the export affordance", because the two-line rule it opens with still stands.

⚠ **`A9 D-1` is NOT marked, and the reason is worth keeping.** `docs/parked.md` **2n-6** named it
as superseded — "the footer keeps a lighter ground and no border" — which was true while A10 D-3
stood. A10 D-3 was withdrawn on the evening of 09-14, the ground was restored byte-for-byte, and
A9 D-1 is **true again**. A marker there would have propagated a finding past the fix that closed
it.

⚠ **One item in the close-out brief names no text that exists.** The brief's minimum list includes
*A10 D-1's "one gap"*; A10 D-1 is about position chips on the meta row and contains no such
phrase, and the nearest candidate — A10's Measurements clause *"icon→avatar gap equals
home→rules"* — is **not** contradicted by A12, because withdrawing the X control returns the header
to exactly one icon and one gap. **No marker was added for it**, and this line is the record of
why rather than a silence.

---

## §7 · Week-one docket

All rows live in `docs/parked.md`. **None is a go-live condition** (D-28 r6). Closed at this
close-out: **2o-1** (X cancelled by the founder), **2n-3**, **2n-6** and **2o-5** (all three closed
by A12 D-2, which is the supersession clause each of them asked a founder to rule on). Open and
carried into week one: **2o-2** (the refused button still reads grey — opacity cannot make a 40%
white pill read as white), **2k-1** (no aspect-ratio reservation, because `image_uploads` carries
no width or height — a schema decision, not an edit), **2k-7** / **2k-8** (a refresh can *land*
while a bet is in flight; `DebatePoll`'s fifteen-second cadence is the wider exposure), **2m-2**
(the sub-44 header census), **2n-8** (A11 D-2 carries no width qualifier and the desktop still
takes `counterPole` at Đ 0), and this run's two new rows.

---

## §8 · Merge packet, in reading order

`2e`'s packet, then the deltas: `2h` · `2j` · `2k` · `2l` · `2n` · `2n-fix` · `2o`, then this
close-out's FINAL delta and this record. ⚠ **`2m` has no Gate C delta staged in `~/Downloads`** —
its run report is there and its delta is not; noted as an observation rather than repaired, since
the round's rulings are in A8 and its guards are in the suite.

---

## §9 · Promote

The production alias move is a **separate, founder-run step** and is not part of this merge. The
sequence, the health check, the two-phone canary and the rollback line are printed in this run's
report (`~/Downloads/zz_MOBILE-2z_run_*.md` §Promote) from `docs/runbooks/deploy-pipeline.md` §3
and `BREAK_GLASS.md`. **Migration check: `git diff --name-only <production-SHA>..HEAD -- drizzle/
src/db/` is EMPTY** — this is a pure alias move with no migration ahead of it.
