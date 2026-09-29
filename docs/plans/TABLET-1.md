# TABLET-1 — give tablets the phone tier (`--breakpoint-mobile` 640 → 1024)

Decision record: `docs/adr/0063-tablets-get-the-phone-tier.md`. This is the plan it was executed from.

## Problem
Between 640px and ~820px every route scrolls sideways: the global header needs 812px and only
collapses to its phone form below 640 (overflow 171px at 640, 111 at 700, 43 at 768). `/m/[slug]`
also squeezes four resolution cards into 109px cells; `/` squeezes its hero into 175/333/175px.

## Chosen approach (operator chose option A of three)
Stretch the existing phone tier over tablet widths. The number is executed in exactly two places:

1. `src/app/globals.css` — `--breakpoint-mobile: 1024px` (generates every `max-mobile:*` variant)
2. `src/components/debate/phone-tier.ts` — `QUERY = "not all and (min-width: 1024px)"` (drives `useIsPhoneTier()`)

They must be equal; `tests/unit/design/mobile-breakpoint-token.test.ts` and
`tests/unit/debate/phone/desktop-neutrality.test.tsx` pin them.

Rejected: a real tablet tier (second breakpoint + layout work) and a header-only fix (leaves the
squeezed hero and resolution cards). See the ADR.

## Changes
- the two sites above (+ their docblocks)
- tests that hardcode the tier query: `info-tip`, `friendly-fire` (×3), `phone-sell-host`,
  `desktop-neutrality`, and the token guard (its neighbour is now Tailwind `lg`/`64rem`, not `sm`/`40rem`)
- `docs/adr/0062-…` (new) + `Amended-by` rows on ADR-0045 and ADR-0051 (phone)
- `AGENTS.md` §8 — the operative breakpoint statements only; historical "640" mentions are left as the
  record of what was measured, with one sentence saying so

## Verification
1. `pnpm tsc --noEmit` — clean.
2. `pnpm vitest run tests/unit/{design,shell,ui,debate,profile,discovery,composer}` — green.
3. Browser, real compiled CSS: probe an injected `flex max-mobile:flex-col` (must read `column` at 768);
   assert `document.styleSheets.length > 0`; sweep 375/640/700/768/820/834/1000/1023/1024/1280/1440 →
   `scrollWidth - innerWidth === 0`; phone row (`flex`) up to 1023, desktop grid (`grid`) from 1024.
   **Done** locally (dev server on staging data, browse-only): header on `/` and `/sign-in`; overflow and the
   phone/desktop hand-off on `/m/<slug>` and `/u/<pseudonym>`; screenshots at 768 of `/`, `/m/<slug>`, `/u/<pseudonym>`.
4. **Still owed:** signed-in flows at 640–1023 (bet composer, reply sheet, phone sell sheet), image posts,
   long-thread snap-track scrolling, and a look on a real tablet.
5. Ship: branch `fix/tablet-phone-tier` → PR. O-10: push `staging` BEFORE the branch.
