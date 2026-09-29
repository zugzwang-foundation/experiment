# TABLET-1 — small tablets get the phone tier (`--breakpoint-mobile` 640 → 820) + desktop header trims below `xl`

Decision record: `docs/adr/0063-tablets-get-the-phone-tier.md`. This is the plan it was executed from.

## Problem
Between 640px and ~820px every route scrolled sideways: the global header's signed-out desktop form is
812px and only collapsed below 640 (overflow 171px at 640, 111 at 700, 43 at 768).

## History (why the plan changed)
1. Operator chose "stretch the phone view over tablets" → shipped as 1024px on a SIGNED-OUT measurement.
2. Operator saw it at ~1000px signed in, disliked the phone look, and asked to keep the desktop look where it worked.
3. Re-measured SIGNED IN: the desktop header overflows 256px at 820 and 52px at 1024 (fits from ~1076).
   Lowering the line to 820 alone would have brought the bug back for signed-in users.
4. Operator chose option B: line at 820 **plus** a header trim.

## Chosen approach
The number is executed in exactly two places and they must stay equal:

1. `src/app/globals.css` — `--breakpoint-mobile: 820px` (generates every `max-mobile:*` variant)
2. `src/components/debate/phone-tier.ts` — `QUERY = "not all and (min-width: 820px)"` (drives `useIsPhoneTier()`)

Plus the trim — `max-xl:hidden` beside `max-mobile:hidden`, gated on `mobileResponsive`, on: the
header's secondary-controls wrapper (Radio + GitHub), `XLink`, the §21.1 divider, `VisitorCounter`.
`xl` = 80rem = 1280px, measured: the full signed-in header fits from ~1240 (worst case).

## Changes
- the two sites above and the four trim sites (+ docblocks)
- tests: six files hardcoded the tier query; the token guard now pins 820, reads Tailwind `md`/`xl`, and
  pins the four trim sites; `global-header-mobile-reflow.test.ts` has a second exact string for the
  three controls that carry both hides
- `docs/adr/0063-…` + `Amended-by` rows on ADR-0045 and ADR-0051 (phone); `AGENTS.md` §8 operative sentences

## Verification
1. `ZUGZWANG_ENV=preview just verify` — typecheck, biome, `next build`.
2. `pnpm vitest run tests/unit/{design,shell,ui,debate,profile,discovery,composer}` — green.
3. Browser, real compiled CSS, local dev server on staging data (browse only): overflow 0 at
   375/640/768/819/820/834/900/1000/1023/1024/1279/1280/1440 on `/`, `/m/<slug>`, `/u/<pseudonym>`;
   header `flex` at 819 and `grid` at 820; market phone region 721px → 0 at 820 as the arena appears;
   controls hidden 820–1279, shown ≥1280.
4. Signed-in header simulated (injected markup copied from `DharmaCluster`/`IdentityCluster`): typical and
   realistic-long users fit at 820–1440; only a pathological user (34-char name + 8-digit balances) overflows
   (50px at 820, none from 900).
5. **Still owed:** a real signed-in session, signed-in flows at tablet width, image posts, long threads, and a look on a real tablet.
6. Ship: branch `fix/tablet-phone-tier` → PR; merge into `staging` (merge commit) to deploy the test site first.
