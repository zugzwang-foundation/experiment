# ADR-0050 — The post image export: a server-rendered JPEG of one argument and its market

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-09-12 |
| **Deciders** | Hrishikesh |
| **Tracker task** | POST-IMAGE-EXPORT |
| **Frame document** | SPEC.1 §21.3 (export surfaces), §22 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0025 — the `.md` export is no longer the only way a debate leaves the product |
| **Amended-by** | — |

---

## Context and Problem Statement

A participant who wants to show someone their argument has, until now, a link
and nothing else. A link asks the reader to arrive, orient themselves in a
product they have never seen, and find the post; most of them will not. The
`.md` export (ADR-0025) answers a different need — it hands a whole debate to
someone who will read it — and it is text, which no feed renders.

What is missing is the form that feeds actually carry: one image, legible at
thumbnail size, that says who staked what on which side, what they argued, and
where the market stands. That image has to be **deterministic** — the same post
must produce the same picture from any device, at any viewport, with or without
the reader's fonts — which rules out capturing the page.

This ADR does **not** decide:

- What the `.md` export contains or when it is regenerated (ADR-0025)
- Whether participant images are moderated before display (ADR-0046, ADR-0014)
- The chart's own geometry, gridline sets or axis anchors (CHART-1 … CHART-8)
- Anything about the freeze, resolution or the dataset release

## Decision Drivers

1. **Determinism.** The same post, rendered twice, must be the same bytes-worth
   of picture. A viewport-dependent capture is not an export.
2. **It must not be able to lie.** Every figure on the image has to come from
   the same read model and the same formatters the page uses, or the image and
   the page will one day disagree about a number and the image will be the one
   that travelled.
3. **No participant waits on a human.** The route is a plain GET; nothing is
   queued, approved, or pre-generated.
4. **Masking is not optional.** A removed post must not be exportable, and the
   guard must assert the BODY's absence rather than the row's (SC-1).
5. **The window is small.** A reader gives a feed image about a second.

## Decision Outcome

**A server-rendered JPEG at `GET /m/[slug]/export/image?post=<ordinal>`, drawn
by `next/og` (Satori) from a purpose-built composition, encoded by `sharp`.**

The route performs the same reads as `page.tsx` — `getMarketBySlug` →
`resolvePostParam` → `getCachedDebateView` + live pricing + `withLiveTail` —
maps them through one pure function (`composePostExport`), and hands finished
strings to a renderer that never touches the view model. Missing, malformed or
removed post → 404. `Content-Disposition: attachment`, `Cache-Control: no-store`.

### Why server-side rather than `html-to-image`

No HTML-to-image library is in the tree and `next/og` already is. Rendering on
the server is what makes the output independent of viewport, browser, font
cache and the R2 buckets' CORS posture, and it sidesteps Safari's
`foreignObject` capture bugs on mobile. The cost is a real wait — measured at
~17 s cold and a second or two warm — which the control announces rather than
hides (`DownloadPostImage`'s busy label).

### The composition is deliberately NOT the page's components

Satori renders a fixed subset of CSS from inline styles, so
`MarketPostExport.tsx` re-expresses the product's visual language rather than
importing it. That separation is the point: the page can change without
silently changing the export, and the export can be tuned without touching a
surface participants act on. Where a value CAN be shared it is — the chart
imports `geometry.ts`'s scales, gridline set, anchor filter and label collision
rule; the mapper uses `formatDharma`, `formatPricePercent`, `computeSplitBar`,
`deriveReplySide` and `formatCountdown`.

### Single-source-of-truth file map

| Concern | File |
|---|---|
| Route, reads, 404s | `src/app/(public)/m/[slug]/export/image/route.ts` |
| View model → display strings | `src/server/debate-export/image/compose.ts` |
| The composition | `src/server/debate-export/image/MarketPostExport.tsx` |
| The price graph | `src/server/debate-export/image/PriceHistorySvg.tsx` |
| Literal token values | `src/server/debate-export/image/palette.ts` |
| Vendored faces | `src/server/debate-export/image/fonts.ts` + `fonts/` |
| The brand mark | `src/server/debate-export/image/logo.ts` |
| Image pre-fetch + transcode | `src/server/debate-export/image/images.ts` |
| Render + JPEG encode | `src/server/debate-export/image/render.tsx` |
| The control | `src/components/debate/DownloadPostImage.tsx` |

## The three decisions inside this one that are worth naming

### 1 · `sharp` is declared as a dependency — and this is the ask-first item

Every avatar (`pfp-url.ts` accepts `.webp` only) and every `market_media` object
on staging is WebP, which **Satori cannot decode**: the render threw
`TypeError: u2 is not iterable` against real data. `sharp` was already in the
lockfile as Next's own dependency and already on `pnpm.onlyBuiltDependencies`;
declaring it makes the import resolvable. It also encodes the final JPEG.

⚠ AGENTS.md §11 makes a new dependency ask-first. The alternative was a
self-fetch through `/_next/image` with `images.remotePatterns` for both R2
hosts — more moving parts, and an image pipeline that depends on the app being
able to reach itself. **This is the item to ratify or reject.**

### 2 · Colour enters where the product has none

`globals.css` is true-neutral by ratification and `tokens-monochrome.test.ts`
enforces an eleven-token achromatic census. The export introduces an `ACCENT`
object — green, red, a topic chip, a flavour chip — that is **deliberately
outside** the token system, read by nothing but this module, and pinned by
`image-palette-parity.test.ts` to an exact key set so it cannot grow in silence.

The reason is the surface, not taste: a shared image is read once, at thumbnail
size, beside content nobody controls, by someone who has never seen the
product. The two facts it must carry — which way the market leans, which way
this argument leans — are exactly the two that a grey line and a white line at
50/50 make indistinguishable.

⚠ The pole law still binds where these name a side: green IS YES, red IS NO on
the price lines and the market's bar. The post's Support/Counter bar is a ruled
exception (fixed green left, red right) so that two bars in one image share one
legend; `palette.ts` and `MarketPostExport.tsx` both carry the reasoning.

### 3 · The export carries no post BODY

The argument text was dropped from the composition, and from the PROPS — not
merely left unrendered. A body that travels into a payload nothing paints is a
body one careless `JSON.stringify` away from being published, and the masking
check that would have to protect it lives three files back.
`image-compose.test.ts` asserts the field's absence, so re-adding one reddens a
test rather than quietly reintroducing the read.

## Verification requirements

- `composePostExport` is pure and unit-tested, including SC-1: a removed post
  yields `null`, and no post's body appears in any output.
- `image-palette-parity.test.ts` reads `globals.css` and asserts every `PALETTE`
  entry equals the token it names — a token change on the page reddens this
  module rather than leaving the export on the old colour.
- The route's 404s are tested: missing `?post`, malformed ordinal, removed post,
  unknown slug.
- `image-fetch.test.ts` covers the bounded pre-fetch (4 s, 8 MB), the WebP → PNG
  transcode, and degradation to the composition's own placeholder on any failure.

## Consequences

### Positive

- A participant can put their argument in a feed without asking anyone.
- The image cannot disagree with the page about a figure: one read model, one
  set of formatters, one pure mapper with a test.
- The composition is isolated, so tuning it cannot regress a surface
  participants act on.
- Determinism is structural rather than a property anybody has to maintain:
  fonts are vendored, the mark is read from `public/brand/`, and nothing is
  fetched from a third party at request time.

### Negative

- **A dependency is declared** (`sharp`) that the product did not previously
  import directly.
- **Off-system colour exists**, and a future token change will not reach it.
  The parity guard catches the values it can and cannot catch a new one.
- **The visual language is duplicated.** The chessboard wordmark, the chips, the
  split bar and the radii are re-expressed here; the page can move without this
  following. That is the deliberate trade of the previous bullet, stated twice
  because it cuts both ways.
- **A cold render is slow** (~17 s measured locally) and is not cached.

### Neutral

- The countdown DIVERGES from the site's `CountdownDigits` by operator ruling —
  three outlined fields rather than the header's continuous chessboard. Recorded
  in the component so a later pass does not read it as drift.
- The market's TOPIC chip is cut from the title's `Topic · Question?` prefix, so
  a market whose title is not written that way renders no topic chip. The
  flavour chip comes from the ratified per-slug register and is `null` outside
  the eight live markets. Both degrade silently and neither is a per-post
  concern.

## More Information

- `docs/plans/` carries no plan for this task; it was executed conversationally
  against a supplied reference at each revision.
- The eight-market register that supplies the flavour chip lives in
  `src/components/debate/resolution-block-data.ts`.
