# Overnight UI fixes — 2026-09-04

**Branch** `fix/ui-overnight-2026-09-04`, cut from `origin/main` at `ead74157`.
**Commits** seven, one per entry plus one defect the browser measurement found:

| | |
|---|---|
| `673c8a2e` | entry 1a — the compact header-stake formatter |
| `45025159` | entry 1b — the header row's two groups, the badge, the mark |
| `d1afa006` | entry 2 — the positions sub-line |
| `48456c16` | entry 5 — `Know more` becomes presence-driven |
| `b4441d83` | entry 3 — the header block's description and its fixed height |
| `fd1e43f8` | entry 4 — the market card's thumbnail |
| `c1239901` | the download mark's alignment, corrected against a measurement |

All five entries are complete. Nothing was skipped.

---

## Entry 1a — the Đ formatter

**Files** `src/components/debate/format.ts` (`formatDharmaCompact`) ·
`src/components/debate/DharmaFigure.tsx` (new) · `ArgProfile.tsx` ·
`profile/ArgumentList.tsx` · `discovery/HeroPanels.tsx` ·
`tests/unit/debate/format.test.ts` · `tests/unit/debate/render/arg-stake.test.tsx`

**Differed from the brief.** A shared formatter already existed — `formatDharma`,
the single display formatter SPEC.1 §10.8 rules for *every* Đ on the site. It was
not extended: a second, narrower formatter sits beside it with a stated domain, so
the abbreviation cannot leak into the surfaces the brief excludes. The brief's
seven cases are pinned verbatim as a block.

**Judgement calls, each recorded at its site:**

- **The threshold tests the ROUNDED value.** `9999.5` already prints `Đ 10,000`
  through the exact formatter, so branching on the stored value would have printed
  five digits from the formatter that exists to prevent them.
- **The strike-through comparison moved with it.** It compares the two stakes *as
  rendered*, so two figures that both print `Đ 12.5k` draw once. Comparing stored
  values would print `Đ 12.5k ~~Đ 12.5k~~`.
- **The tooltip is `InfoTip`, not `title`.** `relative-time-placement.test.tsx`
  bans the literal `title=` from `ArgProfile.tsx` and `HeroPanels.tsx` — those are
  the files likeliest to spell an absolute timestamp into a tooltip, and the
  exemption is sized to a measurement. Widening it for an unrelated feature would
  have opened the hole it was narrowed to close. `InfoTip` is also the only one of
  the two that opens on touch.
- **The tooltip is conditional.** Only where the short form hides something.
- **Sign is U+2212 on the magnitude** (`Đ −12.5k`, not `−Đ 12.5k`): the Đ glyph is
  supplied by the call site in this codebase. Unreachable in practice — INV-2
  forbids a negative balance — so this is the defensive arm.
- **Applied to `HeroPanels` too**, the discovery hero's author-stake pair. It is a
  post-card header stake, and PD-2-36 records that row as Discovery's binding
  horizontal-overflow constraint (`flex-nowrap overflow-hidden`), so an exact
  six-figure pair does not wrap there — it disappears off the clip edge. Both
  figures of the `Đ a → Đ b` progression abbreviate, or neither: a comparison
  spelled in two units is worse than a long one.

**Tests added** 6 formatter cases + the brief's 7-case table; 6 render assertions
(`arg-stake.test.tsx`) proving the row *uses* the formatter and the tooltip carries
the exact value. A correct formatter no card calls changes nothing on screen.

## Entry 1b — the header layout

**Files** `ArgProfile.tsx` · `PostCard.tsx` · `PostFocusHeader.tsx` ·
`dialogs.tsx` · new `tests/unit/debate/render/arg-profile-row.test.tsx` ·
`tests/unit/design/relative-time-placement.test.tsx`

**Component count** — one component renders this header for **five** mounts (post
card, focused post, reply card, post pop-up, reply pop-up), plus a second
hand-rolled one on the profile (`PresentHead`, in `ArgumentList.tsx`). Entry 1a
reached both; entry 1b's structural change reached `ArgProfile` only — the profile
head carries no badge and no wrap defect, so restructuring it would have been
churn. **`HeroPanels`' head row was deliberately left alone**: it is
`flex-nowrap overflow-hidden whitespace-nowrap` by ratified design and has no
badge and no download mark, so the wrap rule has nothing to act on there.

**Badge data shape** — `LaneBadge` takes a single `Badge | null` (a post dominates
a lane or it does not). The brief's "at most 2" is satisfied by the data, not by a
slice; writing a cap over a scalar would be code that cannot run. If the lane model
ever returns a list, the cap belongs at that seam.

**The mark is pinned by `ml-auto`, not `flex-1`.** `flex-1` on the metadata area
was tried and reverted: `reply-card-absorber.test.tsx` reads the *first* `flex-1`
descendant of a reply card and requires it to be the image cell, so the header
would have taken that slot and the guard would have described a header while
claiming to describe an image cell.

**⚠ This reverses a recorded ruling.** The `Sep` before the timestamp is removed
(brief rule 7) and the badge now follows the age (rule 5). `ArgProfile.tsx` and
`ArgumentList.tsx` both record canon §3 item 11 as having *gained* that divider by
founder ruling. **Canon §3 item 11 is owed an amendment for this row.** The guard
was re-derived, not relaxed — see below.

## Entry 2 — the Positions panel sub-line

**Files** `profile/PositionsTable.tsx` · `arrangement.test.tsx` ·
`surface.test.tsx` · `struck-and-held.test.tsx`

Removed `· staked Đ n` and the `Replied to …` line; the now-unused `basis` prop
went with them.

**⚠ Two consequences, both real:**

1. **The percentage in the `CURRENT` cell has no visible denominator.**
   POSREV-POLISH-2 R-3 put the staked figure on that line precisely because "a
   percentage whose denominator appears nowhere is a figure nobody can check". That
   reasoning is not refuted, only overruled. The cost is paid knowingly.
2. **SPEC.1 §23 names the parent reference on a positions row** ("for reply-bets —
   the parent post reference"), and `struck-and-held.test.tsx` row A-7 guards it as
   a *presence* specifically so nobody deletes it. It is not gone from the surface
   — the argument panel renders it under the argument being read — and §23 names
   the reference, not its location. **An amendment is owed either way.** A-7 is
   re-pointed to the panel and two new struck rows (A-7b, A-7c) hold both removals
   *out* of the cell, so the pair says "somewhere, but not here".

## Entry 5 — `Know more` only when a description exists

**Files** `composer/payload.ts` (`hasExtendedText`) · `PostCard.tsx` ·
`ReplyCard.tsx` · `PostFocusHeader.tsx` · `profile/ArgumentList.tsx` ·
`tests/unit/composer/payload.test.ts` + three render suites

**What "the description" is here.** The composer writes two fields into one wire
`body` — a title line and an optional extended text after a blank line
(`composeWireBody`) — and the server splits them back apart (`deriveTitleTeaser`).
The predicate is the exact inverse of the first, mirroring the second, with a
round-trip test binding them: if they disagree, a card offers to show more of an
argument that has none, or hides an extended text its author wrote.

**A description equal to the title counts as present** — the predicate asks whether
a second paragraph exists, never what it says.

**A long single-paragraph argument is NOT a description** and gets no control.
Deliberate: the title is the first line, clamped at two lines of a 125-character
string, so the pop-up would show what the card already shows. ⚠ *Legacy or
seed-written rows whose first line exceeds 125 characters would lose their reveal
path.* The composer gates title length, so this is unreachable through the product.

**What `Know more` does** is unchanged at the four debate mounts: it opens the
read-only pop-up.

**Two fixtures were corrected, not accommodated** (`post-card`, `head-zone`,
`comment-image`): they declared a `teaser` their own `body` did not contain — a
post the product cannot write. Harmless while nothing read the two fields together.

## Entry 3 — the header block, and the profile preview

**Files** `PostFocusHeader.tsx` · `HeadZone.tsx` · `profile/ArgumentList.tsx` ·
new `profile/ReplicaBody.tsx` · `KnowMore.tsx` · `head-zone.test.tsx` ·
`comment-image.test.tsx` · `debate-height-chain.test.ts` ·
`resolution-block-glyphs.test.ts` · `panel-filter.test.tsx`

**The fixed height was `HeadZone`'s `basis-[24.2dvh]` + `overflow-hidden`** — a
viewport fraction, shared by both header arms. The post arm now passes `fit` and
takes a content-sized band; **the market arm is untouched** and keeps its fraction,
because its contents are chrome and clipping a resolver card costs a reader
nothing. The rail is `lg:items-start`, so the market card is top-aligned and no
longer stretched. Scoped to `lg` so mobile is untouched (ground rule 1).

**⚠ Removing the declared height broke something invisible, and it was caught.**
The image frame took its height from that band through `h-full`. A percentage
inside a chain that derives its height *from* the element is circular, and a
browser resolves it to `auto` — the frame would have collapsed to one line of
placeholder text, with nothing in the suite able to see it (jsdom performs no
layout). It is `self-stretch` now: the height comes from the sibling text stack.
**Measured after the change: 181.45px, not collapsed.**

**Profile preview** — `Know more` is reused (the brief's preferred option, not the
fallback), wired to an in-place disclosure. `KnowMore` regained an `expanded` prop
so the mount announces `aria-expanded` instead of `aria-haspopup="dialog"`: this
mount opens no dialog, and the debate pop-up takes a `PresentPost` whose fields
this surface does not hold — constructing one would be fabricating data to satisfy
a type. The visible control is identical; only the promise to a screen reader
follows the mount.

## Entry 4 — the market summary card's thumbnail

**Files** `server/discovery/media.ts` · `server/debate-view/load-debate-view.ts` ·
`PostFocusHeader.tsx` · `market-media-selection.integration.test.ts` ·
`load-debate-view.integration.test.ts` · `head-zone.test.tsx` + 8 fixture files

**The two surfaces did not share an image field.** Discovery signs the
`is_default` `market_media` row; the debate view signs the lowest-order
*non-default* row (MEDIA-SECOND-ROW, deliberately, so the header can carry a larger
picture). The post arm's rail is the locked *card* composition — the same one
Discovery renders — so it was showing a different picture of the market the reader
had just clicked. The brief's "make no change" fallback did **not** apply.

**One SELECT, two images.** `getMarketMediaUrls` returns both from one result set.
This read is re-invoked every 15s per viewer against a `max: 10` pool behind a
15-slot pooler, and its media budget is one statement; a second query would have
been +4 statements/minute/viewer for a row the first query already held.

**`getSecondaryMarketMediaUrl` is deleted.** It resolved the same row with the same
ordering and a `LIMIT 1`; keeping it would have put that rule — including the
`id ASC` tiebreak that stops the header flickering across polls — in two places.
Its integration coverage moved rather than disappearing and now measures both arms.

`thumbImageUrl` is **required** on `DebateMarketHeader`, so the eight fixtures that
forgot it were compile errors rather than cards silently showing the wrong picture.

---

## Verification

Run locally against the CI step list (`.github/workflows/ci.yml`).

| Suite | Result |
|---|---|
| `pnpm biome check .` | **pass** (exit 0; 15 warnings, 4 infos — all pre-existing, in files this branch does not touch) |
| `pnpm tsc --noEmit` | **pass** (exit 0) |
| `pnpm drizzle-kit check` | **pass** — "Everything's fine" |
| `pnpm db:check-drift` | **pass** — journal head `0026_lots_no_delete` == DB head, 27 applied |
| `pnpm vitest run` (whole suite: unit + server + integration + db + invariants) | **pass** — 451 files, 4531 tests, 1 skipped, 4 todo, 0 failed |
| `next build` (`ZUGZWANG_ENV=preview`) | **pass** (exit 0) |
| `pnpm test:scale` | **not run** — opt-in battery, its own config, excluded from CI |
| `tests/staging/**` | **not run** — operational runners against the live staging DB (ADR-0035/0036); never run from a feature branch |
| E2E | **not run** — no Playwright/Cypress/Storybook in this repo, and none installed |

**No test was weakened to pass.** Eleven assertions were re-derived because the
brief intentionally changes what they assert; each carries the superseded reasoning
in place, and each re-derivation kept or strengthened the property:

- `relative-time::G6-last-on-the-identity-row` — finds the identity row by walking
  to the author instead of assuming the age's parent is it (the age is now nested
  in a group), reads document order instead of sibling order, and allows *only* a
  lane badge after the age. **A new test exercises that allowance**, because a
  widening no fixture reaches is a hole with a justification attached.
- `debate-height::headzone-is-declared-and-does-NOT-grow` — reads the band off its
  named constant (the element now chooses between two), and asserts the element
  carries no literal `className` so a third band cannot appear unnoticed. **A new
  test holds the content-sized band** to what it keeps (`shrink-0`, `min-h-0`, no
  fixed height) and what it gives up (`basis-*`, `overflow-hidden`).
- `head-zone::a-bodyless-post-…-KEEPS-the-expand-control` → **`…-AND-the-expand-control`**, inverted.
- `head-zone::the-focused-post-renders-its-teaser-not-its-body` → renders neither.
- `head-zone::the-post-arm-renders-through-the-SAME-frame` and
  `comment-image::the-focused-image-precedes-the-argument-stack` — markers moved
  off the removed teaser onto the reply bar / the control; the properties are
  unchanged.
- `itemD::BOTH-value-figures-carry-the-glyph` → one figure, with the second
  asserted **absent** so the test cannot keep its name while checking half of it.
- `surface::band-composition`, `struck-and-held` A-7 (+ new A-7b/A-7c),
  `replica::…-in-that-order`, `replica::the-body-ships-WHOLE` — see the entries.
- `resolution-block-glyphs` G-g — checks `gap-5` on **both** bands.

**Tests added:** 34 (7 header-structure, 6 stake-render, 13 formatter, 4 `Know
more` presence + 2 reply, 1 payload round-trip, 1 content-sized band, 3 thumbnail
wiring, 1 badge allowance, 1 two-arm media integration, plus assertions folded into
existing cases).

### Browser measurement — 1440×777, real CSS, real markup

No E2E runner exists, so the geometry was measured directly: the shipped
components' own rendered markup, spliced into the real `DebateView`/`PageContainer`
chain **inside the running production build**, against the compiled stylesheet.
The frame was pinned in-page and the probe throws unless it measures 1440. Fonts
awaited; animation and transition killed first (a CDP tab is `document.hidden`).

| Acceptance criterion | Measured |
|---|---|
| No badge → one line, mark top-right | metadata **20.00px** (one line); mark glyph centre **325.29** = line-1 centre **325.29** |
| Badge, fits → one line incl. badge | focus header (1024px column): **1 line**, age then badge |
| Badge, doesn't fit → B wraps whole | metadata **43.99px**; line 1 top 315.29 h20, line 2 top 339.29 h20, **left 72.61 = group A's left** |
| Mark never moves, never between lines | glyph centre **325.29** on both, identical to the one-line case |
| Line 2 has line 1's rhythm | both **20px** |
| Action row + stake summary fully visible | foot 226.07→274.06, inside the band (bottom **290.68**); text reads `Support Đ 38,000 · Đ 100,000 STAKED · Counter Đ 62,000` |
| No inner scrollbar, nothing clipped | band **214.69px** (content-sized, not 188px); arena starts **302.68**, no overlap |
| Market card top-aligned, not stretched | card top **76** = band top; height **133.20** against the left column's **214.69** |
| Image frame did not collapse | **181.45px** |
| Abbreviation is header-only | header `Đ 999.9k`; split bar `Đ 38,000` / `Đ 100,000` / `Đ 62,000` exact |
| `Know more` absent on a title-only card | absent (right-hand card in the capture) |

**This found a real defect.** The mark was aligned to a 24px band on the reasoning
that the avatar sets line 1's height. It does not — the avatar is a *sibling* of
the wrapping area — and the mark sat 2px low. Fixed in `c1239901`; the line is set
by the side chip's `h-5`.

**Screenshots** (1440, from the same pinned frame):
`docs/reports/ui-overnight-2026-09-04/surface-1440.jpg` — the whole surface.
`docs/reports/ui-overnight-2026-09-04/card-headers-1440.png` — the two card
headers side by side: wrapped-with-badge on the left, one-line-without on the
right, `Đ 999.9k` beside `Đ 550`, and `Know more` present on one card and absent
on the other.

⚠ **What this measurement is and is not.** The markup and the CSS are the shipped
ones and the page chain is copied verbatim from `DebateView.tsx`, but the *data* is
a fixture and the surrounding shell was assembled by the probe. It is strong
evidence about geometry and no evidence at all about the real route under real
data — the local database has no open markets.

---

## Needs your eyes

1. **Canon §3 item 11 is owed an amendment.** Entry 1b removes the separator before
   the age and puts the lane badge after it. Both files that render this row record
   that divider as *ruled in*. The code now disagrees with the document it cites.
2. **SPEC.1 §23 is owed an amendment.** Entry 2 removes the parent-post reference
   from the positions row. It still renders in the argument panel and §23 names no
   location — but a guard existed specifically to stop this deletion, and it was
   re-pointed rather than satisfied.
3. **The `CURRENT` cell's percentage now has no visible denominator.** Entry 2
   removed the figure R-3 put there for exactly that purpose. Reversible in one
   line if you want it back.
4. **Group A never wraps, so a narrow card can overflow horizontally.** The brief
   rules this ("A may overflow by a few px; acceptable") and it does not bite at
   desktop — the worst-case fixture measured 494px in a 586px column. The profile
   replica panel is narrower and was not measured under a 20-character pseudonym.
5. **The abbreviation reached `HeroPanels`.** Judgement call — it is a post-card
   header stake and that row is a documented overflow constraint. If Discovery's
   hero should keep exact figures, it is a two-line revert.
6. **`getSecondaryMarketMediaUrl` is deleted.** No production caller remained after
   entry 4. If something outside this repo imports it, it is gone.
7. **The header block is content-sized now, so a very long post title makes the
   band taller** and the arena shorter. The arena scrolls, so nothing is lost, but
   the one-screen proportions move with the title. Not measured across title
   lengths.
8. **`data-testid="argument-replica-body-*"` only exists while the disclosure is
   open.** Anything outside this repo keying on it will not find it on first paint.
9. **No `Co-Authored-By` trailer** on any commit, per AGENTS.md §10 — this
   overrides the harness default.
10. **Not deployed anywhere.** No staging push, no promote. The browser measurement
    was local, against the production build.
