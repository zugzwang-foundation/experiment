# WARLI-FIELD-ASSET — take the static Warli field out of every auth page's HTML

> ⚠ **Deviation, recorded at execute:** §2 planned an SVG `<image>`. `art-layer-guards.test.ts` lists `<image` as a security-audit sink, so the field is the hero root's CSS `background-image` (`cover` + `center`, the same geometry as `xMidYMid slice`) instead. The guard is unchanged. `scripts/warli-preview.tsx` also re-inlines `<FieldLayer />`, because a double-clicked preview cannot resolve `/art/…`.

> ⚠ **Amended at execute — long cache + preload (founder ask):** §4 below said "Vercel default, no hash". Superseded:
> - `pnpm art:field` writes `public/art/warli-field.<sha256-10>.svg`, deletes stale hashes, and generates `src/components/art/warli/field-asset.ts` (`FIELD_ASSET_HREF`).
> - `next.config.ts` `headers()` serves only that hashed shape as `public, max-age=31536000, immutable`.
> - `(auth)/layout.tsx` renders `<link rel="preload" as="image" fetchPriority="high">`, which React hoists into `<head>`. `preload()` from `react-dom` in the layout emitted nothing, and the art layer is sealed to `react`.
> - `field-asset.test.ts` pins: one published file, href equals content hash, module text, and the config rule.
> - Measured in Chrome: first visit, the SVG starts before the HTML finishes and is fetched once (72 KB on the wire). Second visit, it comes from cache with 0 bytes, at the same instant as the HTML.

## Context

Vercel Fast Data Transfer (last 30 days) puts `/sign-in` at the top of the list with **27.72 GB from 49K requests**, which is about 566 KB per request. `/` sends 6.2 GB from 120K requests.

Measured on prod (`a7bf4d2`):
- `/sign-in` HTML is **822 KB** uncompressed and 83 KB br. `/` is 68 KB and 11 KB.
- The page is `Cache-Control: max-age=0`, so nothing is ever reused.
- `<WarliHero />` rendered on its own is **792 KB and 7,967 SVG elements**:
  - the static `<FieldLayer />` is **~682 KB (86%)**;
  - the two rotating rings are ~109 KB.
- The RSC payload is only 12.5 KB, so client-side navigation to `/sign-in` is cheap. The cost is full document loads.

The field never moves. `FIELD_SCENE` in `field-layer.tsx` is already constant-folded and has no randomness or clock, so its markup is byte-identical on every request.

**Outcome:**
- Serve the field once as a static, CDN-cached `.svg`.
- Keep the two rings inline, unchanged.
- `/sign-in` HTML should drop to ~140 KB uncompressed.
- The field code also leaves the client JS bundle, because `hero.tsx` is `"use client"`.

This is ordinary work, not one of the CLAUDE.md §1 critical areas. No auth logic, ledger or schema is touched.

## Approach

### 1. Generator: `scripts/warli-field-svg.tsx` (new)
Follow the existing `scripts/warli-preview.tsx` pattern: `renderToStaticMarkup`, and the script imports the art layer, never the other way round.
- Export `buildFieldSvg(): string`. It returns a standalone SVG document with:
  - `xmlns`, `viewBox="0 0 1440 1000"` (the hero's `VIEW_WIDTH`/`VIEW_HEIGHT`), `fill="none"`, `stroke="currentColor"`;
  - an embedded `<style>`: `svg{color:<ink>} .warli-reserve{color:<ground>}`;
  - then `renderToStaticMarkup(<FieldLayer />)`.
- An SVG loaded as an image cannot read the page's CSS variables. So the two hex values are **read from `src/app/globals.css`** (`--color-ink`, `--color-ground`) at generation time, never hard-coded. That keeps `art-layer-guards`' no-hex scan true, and the token pins in `tokens-monochrome.test.ts` stay the single source.
- `--write` writes `public/art/warli-field.svg`. Add `pnpm art:field` to `package.json`.

### 2. `src/components/art/warli/hero.tsx`
- Replace `<FieldLayer />` with `<image href="/art/warli-field.svg" x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} data-warli-field-image="" />`.
- Same spot in the tree: drawn first, outside the centring transform.
- Because it is an SVG `<image>` inside the same `viewBox` and `preserveAspectRatio="xMidYMid slice"`, **alignment with the rings holds by construction**. There is no separate `<img>`/object-fit to match.
- Drop the `FieldLayer` import and update the paint-order comment.
- `field-layer.tsx`, `scene.ts` and the primitives are untouched. The field's source of truth stays in code.

### 3. Tests (`tests/unit/art/`)
- **New `field-asset.test.ts` (parity guard):**
  - `buildFieldSvg()` must equal the committed `public/art/warli-field.svg` byte for byte. If someone edits the field and forgets to regenerate, this goes red and says to run `pnpm art:field`.
  - Positive control: the file contains `data-warli-field-layer` and the two hex values that `globals.css` currently holds.
- **`composition.test.tsx` and `warli-render.test.tsx`:** the cases that query `[data-warli-field-figure]`, `[data-warli-motif]` and `[data-warli-ground]` through `render(<WarliHero />)` switch to rendering `<svg><FieldLayer /></svg>` for the field assertions. The ring assertions keep rendering the hero. Counts and geometry stay exactly as asserted; no assertion is loosened.
- **"keeps the static field OUT of the rotating groups" is inverted, not deleted.** The hero now has exactly one `[data-warli-field-image]`, it is not inside any `.warli-spin`, and the hero carries zero `[data-warli-motif]`/`[data-warli-ground]` nodes. That last check is what proves the 682 KB is gone from the HTML.
- `art-layer-guards`: check the raster and sink scans against the new `<image href>`. `.svg` does not match `RASTER`, and `href` to a same-origin path is not a sink. Add the generator to the preview-generator escape check only if it concatenates any non-constant text. It shouldn't: the style text is two hex values read from a file.

### 4. Caching
- Use Vercel's default for `public/`: ETag plus revalidation, so a repeat visit gets a ~300-byte 304.
- No content-hashed filename or `immutable` header for now; that is a follow-up only if measurement shows it matters.
- HTML-only crawlers do not fetch `<image>` subresources, so bot traffic stops paying for the field entirely.

## Files
- **New:** `scripts/warli-field-svg.tsx`, `public/art/warli-field.svg` (generated, committed), `tests/unit/art/field-asset.test.ts`, `docs/plans/WARLI-FIELD-ASSET.md` (this plan, in-repo per §5.1).
- **Edit:** `src/components/art/warli/hero.tsx`, `tests/unit/art/composition.test.tsx`, `tests/unit/art/warli-render.test.tsx`, `package.json` (one script).

## Verification
1. `pnpm art:field` generates the file, and `pnpm vitest run tests/unit/art/` is green.
2. Mutation check: change one motif count, confirm `field-asset.test.ts` goes red, then revert.
3. `ZUGZWANG_ENV=preview just verify` (via Doppler `--preserve-env`, per memory). Local vitest noise outside `tests/unit/art/` is not a signal.
4. `next start` locally:
   - `curl` `/sign-in` with and without `Accept-Encoding`, expecting HTML ~140 KB raw (was 822 KB);
   - `scripts/measure-page-weight.mts http://localhost:3000/sign-in` to check the SVG is served once with an ETag.
5. Browser at 1440 and 375:
   - screenshot before and after, with the field and rings aligned identically;
   - rings still turn;
   - `prefers-reduced-motion` still halts them.
6. Local only: no commit, push or PR until you say so.
