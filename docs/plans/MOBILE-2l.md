# MOBILE-2l · Round eight — the last round before the merge

Ground: `b7114791` (2k's tip), `feat/mobile-2-market-detail`, clean.
Measurement target: the local QA dev server, `http://localhost:3100`, canary `b7114791`.

---

## §1 What the recon changed about this brief

Three of the six items arrived with a premise that a measurement does not support. Each is
recorded here rather than silently built around.

### R-2 — the desktop does NOT pin, and this is the load-bearing correction

The brief says *"Desktop already does this: after a bet, the viewer's fresh post sits at the
top of the feed with a 'just now' treatment, and later takes its ranked place."*

Measured in `DebateView.tsx:916-990` and `scrollers.tsx:97-145,270-311`, the desktop:

- holds **no pin**, **no marker**, **no panel** and **no "just now" treatment**. Its own
  docblock (`DebateView.tsx:930-933`) says so in terms: *"NOTHING IS HELD BY ANY OF THIS.
  There is no panel, no marker and no state to dismiss … the card that appears is the
  column's ordinary card in its true ranked position."*
- does **not** reorder the feed. `buildTopList` (`src/lib/ranking.ts:344`) is the Top ranked
  spine plus the latest-interleave; a fresh post lands where its score puts it.

**Why the founder nonetheless sees it "at the top", and why that reading is correct.** The
desktop column is **paged** — `usePagedColumn` renders exactly one post, `const post =
posts[index]` (`scrollers.tsx:326`). The jump sets `index` to the posted comment's index, so
after a bet the author's own post becomes *the* card the column displays. "At the top of the
feed" is an accurate description of what a paged column does; it is not a pin, and there is
no treatment to copy.

⇒ **The phone mirrors the mechanism, not the brief's description of it.** The phone feed is a
scrolling list, so the faithful analogue of "index = the posted card" is "scroll the feed
region so the posted card is at the top of the region". That serves the founder's stated
intent — the author sees their argument when the sheet closes — which a blind
`scrollTo({top:0})` would *not*, because the card is not first in a ranked list.

The brief's acceptance lines *"the viewer's post is the first card"* and *"scrollTop == 0"*
are inferences from the wrong premise and are replaced by the measured equivalents:
**the posted card's top aligns with the feed region's top**, and **the pinned id == the
bet-response id**. Recorded, not silently substituted.

**The desktop mechanism, named as the brief's §2 requires:**

| Question | Answer, measured |
|---|---|
| State it reads | `posted: {commentId, fromModel} \| null`, `DebateView.tsx:279` |
| Where the id comes from | the **bet response** — `BetComposer.tsx:413` calls `props.onPosted({commentId})`; `onPosted` (`:291`) stores it and fires `router.refresh()` |
| "Landed" signal | `model !== posted.fromModel` — the RSC payload's object identity (`:940`) |
| Which post | `findPostedNode({posts, parent, commentId})` — **fail-closed**, a removed comment yields `null` |
| Which side | the comment's **own** side (`sideAtPostTime`, or a reply's frozen `side`) — never the composer's column |
| The "treatment" | none. `pickSide(jumpSide)` pauses that column's auto-advance so the card stays put |
| Expiry | **no timer.** One-shot keyed on `commentId` (`pickedFor` ref `:983`; `jumped.current` `scrollers.tsx:139`). Released only by the reader's own actions |
| Under a poll refresh | nothing re-fires — `posted` is never cleared precisely *because* both consumers are one-shot (`:272-277`) |

### R-3 — already satisfied at ground

Measured at 360 on `/m/sp-m12-fill`:

```
track height 6.00px (computed 5.99609px, border-box, 0.625px hairline each side) — fill 4.75px
border-radius 8px on a 6px bar ⇒ ends fully rounded
three columns  [78.00, 138.79, 78.00]  centres 63.61 / 180.00 / 296.39
figure centres 63.61 / 180.00 / 296.39  ⇒ Δ 0.00px on all three
```

`max-mobile:​h-[6px]` is already on the track (`AggregateFooter.tsx:244`, landed MOBILE-2e ·
R-M2) and the three figures are already centred by `items-center` on each column. The brief's
*"from ~3"* matches neither the track (6.00) nor the fill (4.75). ⇒ **No edit.** Changing a
ruled 6px would be a regression; the measurement is the deliverable.

### R-1 — no tag column exists; the split is authorised and taken

`markets` has no `tag`/`category` column (`src/db/schema/markets.ts:37-53`); the profile read
model carries `marketTitle` only. The eight content markets are `"<Tag> · <Question>"`
(`docs/data/staging-markets-snapshot.json`) — Mumbai, Oktoberfest, Chess, Bitcoin, Math,
Claude, YCombinator, GitHub. ⇒ **Split on the leading `" · "` segment, as the brief
authorises, and recorded here.** Titles with no `" · "` (every local `sp-m*` fixture) keep the
whole title as the label and still get the arrow.

---

## §2 The build

### R-1 · the filter pill shows the tag (`PositionsTable.tsx`)

⛔ `arrangement.test.tsx:1005` asserts the trigger's whole `textContent === "<marketTitle> ▾"`
by **equality**, and `ArgProfile`'s own docblock rules that a JS slice would make the
accessible name lie. Both hold if the label is **split, never sliced**:

```
<span>{tag}<span class="max-mobile:​hidden">{" · " + rest}</span></span>  <span class="shrink-0">▾</span>
```

`textContent` is byte-identical at every width (so the test and the accessible name are
untouched); below 640 the remainder is `display:none` and the caret sits **outside** the
truncating box, which is the actual defect — today the caret is inside it and gets clipped.

### R-2 · the phone mirrors the desktop jump (`PhoneDebateView.tsx`)

- `onPosted` gains the receipt: `({commentId}) => { setPosted({commentId, fromModel: model}); setSheet(null); router.refresh(); }`.
- `landed` / `findPostedNode` / `jumpSide` — **the same three expressions as the desktop**,
  importing the same `find-posted.ts`. No second masking path, no reconstruction.
- one-shot `useEffect` keyed on `commentId` (a `useRef`, exactly like `pickedFor`) that
  `setActiveSide(jumpSide)` and scrolls the **feed region** (`scrollRegionRef`) so the card's
  top meets the region's top. Never `window`, never `?post=`.
- ⛔ `?post=N` is untouched — the pin sets client state directly.
- No write path. Presentation over the read model.

### R-4 · two lines, always (`ArgProfile.tsx`, `badges.tsx`)

- pseudonym yields: `max-mobile:​min-w-0 max-mobile:​truncate` (it is a flex item of the row at
  phone width because both groups are `display:contents`).
- chips and the export icon never shrink: `max-mobile:​shrink-0`.
- one chip style at phone: `Sold` drops to the `PositionMarker` register
  (`max-mobile:​normal-case`, `max-mobile:​font-normal`, `max-mobile:​tracking-normal`), both at
  `max-mobile:​text-[11px]` with stated leading, same padding and ground.

### R-5 · the header avatar is a circle (`IdentityCluster.tsx`)

Below 640 the chip becomes a 44×44 borderless, groundless box and the avatar fills it.
⚠ `avatar.tsx` ships `data-[size=sm]:size-6` at specificity (0,2,0); a bare `max-mobile:​size-11`
is (0,1,0) and **loses**. The override must match the data-variant or be measured; this is the
trap `avatar.tsx:8-16` documents. **Measure the computed size, do not assume the class won.**

### R-6 · the post sheet header is the market question (`dialogs.tsx`)

`PostPopup` already takes `tier`; the phone branch renders the market question in the
market-question register (grey, small, one line, ellipsis) instead of `post.title`. `×`
untouched, the card beneath untouched, desktop branch byte-identical.

---

## §3 Walls

- No edit under `src/server/**`, `drizzle/**`, `src/db/**`, auth, or the composer's
  money/moderation modules. No `--force`. No merge. No production touch.
- Every token is `max-mobile:​` or a `phone/` leaf or a `tier==="phone"` branch.
- **B1-p is the proof of the desktop wall**, measured adjacent in time at the same build.

## §4 Known gaps, stated up front

- **No signed-in session exists on the local QA database**, and creating one means
  authenticating as the founder, which I do not do. ⇒ R-2's *live* bet and R-5's *live*
  geometry cannot be measured. Both are proven in the jsdom layer instead, and the exact
  step that would close it is: the founder signs in at `http://localhost:3100`, then the
  probe re-runs.
- **B2 already fails at 640 at ground**, on both routes: `documentElement.scrollWidth` 750 vs
  640, worst element `header > div > div[2]`. At 640 the `max-mobile:​` tokens are off, so this
  is the **desktop** header in a 640 viewport — inherited, not this round's, and out of scope
  (fixing it would be a desktop edit).
