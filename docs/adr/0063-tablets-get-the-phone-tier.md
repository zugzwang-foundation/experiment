# ADR-0063 — Tablets get the phone tier: `--breakpoint-mobile` moves from 640px to 1024px

| | |
|---|---|
| **Status** | proposed (awaiting operator review; browser verification of the data-driven routes pending — see More Information) |
| **Date** | 2026-09-29 |
| **Deciders** | Hrishikesh (operator, chose option A of three), Claude Code |
| **Tracker task** | TABLET-1 (ad hoc — the tablet width band was never owned by MOBILE-1/MOBILE-2) |
| **Frame document** | `design-language §1.7` (via ADR-0045) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0045 — the 640px value only (ADR-0045's override-never-replace convention stands). ADR-0051 (phone market detail) — the 640px tier gate only (its D-1…D-n presentation decisions stand) |
| **Amended-by** | — |

---

## Context and Problem Statement

The repo has one minted breakpoint, `--breakpoint-mobile: 640px` (ADR-0045), and a phone tier that
hangs off it: `max-mobile:*` overrides in the shell and read surfaces, `PhoneDebateView` and its
`phone/` leaves on `/m/[slug]` (ADR-0051), and `profile/phone/`. Below 640 everything is designed.
At 1024 and above the desktop layout is designed. **Between the two nothing is**, and that band is
where tablets live.

Measured on staging (canary `staging-e40d2c3`), signed out, the global header needs **812px** of
width and only collapses to its phone form below 640. So on every route the document scrolls
sideways by 171px at 640, 111px at 700 and 43px at 768; the countdown and JOIN are clipped off the
right edge. `/m/[slug]` additionally squeezes four resolution cards into 109px cells and
`/` squeezes its hero into 175 / 333 / 175px columns. Nothing overflows at 820 and above, and
nothing at 1024 — the desktop tier is sound from about 820; the trouble is that it is being asked
to work down to 640.

The operator was shown three options (a real tablet tier; a header-only fix; the phone layout on
tablets) with mockups of each, and chose the third.

This ADR does **not** decide:

- The phone tier's own design (ADR-0051, ADR-0048, ADR-0049)
- A dedicated tablet layout — explicitly not built; see Considered Options 2
- Any change to `sm:` / `md:` / `lg:` usage outside the phone tier (unchanged; see Neutral)

## Decision Drivers

1. Tablets must stop scrolling sideways and clipping the countdown and JOIN.
2. Smallest change that achieves (1): the phone tier already exists, is measured, and is guarded.
3. Desktop (≥1024) and phone (<640) must not move.
4. The two places that execute the number must not disagree (a CSS gate and a JS hook).
5. Effort is bounded — the operator chose speed over a designed tablet layout.

## Considered Options

1. **Move the one breakpoint to 1024px so tablets get the phone tier** ← chosen
2. Mint a second breakpoint and design a tablet tier (2-column hero, 2×2 resolution cards, trimmed header)
3. Header-only fix: hide the secondary controls between 640 and ~820

## Decision Outcome

**Chosen: Option 1.** Two executable sites change, together, and nothing else in `src/` executes the number:

- `src/app/globals.css` — `--breakpoint-mobile: 640px` → `1024px`. Tailwind therefore generates
  `max-mobile:*` for `<1024px` and `mobile:*` for `>=1024px`.
- `src/components/debate/phone-tier.ts` — `QUERY` `"not all and (min-width: 640px)"` →
  `"not all and (min-width: 1024px)"`. It is a hand-copied string of the token, read by
  `useIsPhoneTier()` (ScrollRail, scrollers, PositionsTable, money-line, InfoTip). Changed alone,
  tablets would get CSS saying "phone" and a hook saying "desktop".

**Why 1024 and not ~820.** The desktop layout is verified overflow-free at 1024; 1024 is where
Tailwind's `lg` reveals the market page's price-chart column (`headzone-right` is
`hidden … lg:flex`); and iPad Pro 12.9" portrait is exactly 1024. iPad portrait (768 / 820 / 834)
becomes phone tier; iPad landscape and laptops (≥1024) stay desktop, byte-identical.

**The name now overstates.** `mobile` reads "phone" and now means "narrower than a laptop". Renaming
was rejected: ~35 files and every guard key on it, and a rename is a separate, mechanical change.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The breakpoint value (CSS variants) | `src/app/globals.css` (`--breakpoint-mobile`) |
| The breakpoint value (JS tier hook) | `src/components/debate/phone-tier.ts` (`QUERY`) — must equal the token |
| Guard that pins name + value | `tests/unit/design/mobile-breakpoint-token.test.ts` |
| Guard that the hook and the desktop tree agree | `tests/unit/debate/phone/desktop-neutrality.test.tsx` |

## Consequences

### Positive

- Tablets no longer overflow sideways; measured 0px at 375 / 640 / 700 / 768 / 820 / 834 / 1000 / 1023 / 1024 / 1280 / 1440 on `/`, `/sign-in`, and (at 375 / 640 / 768 / 834 / 1023 / 1024 / 1440) `/m/[slug]` and `/u/[pseudonym]` — see More Information.
- Two-line source change plus test updates; no new layout code, no new component.
- Phone (<640) and desktop (≥1024) are unchanged by construction: the media queries are false/true on the same sides of their old values.

### Negative

- **Tablets look like a large phone.** One argument card at a time, swiped sideways, wide empty side margins; text and touch targets stay phone-sized. Acceptable because: the operator chose this over a designed tablet tier, and a dedicated tier can still be built later on top of this token.
- **Global blast radius.** Every `max-mobile:` rule in ~35 files now fires up to 1023px, including values tuned at 360–430px (money-line width threshold, composer fit, split bar, position tiles, onboarding deck). Mitigated by: browser sweep across 640–1023 on the data-driven routes before this is accepted.
- **No GitHub / X / Radio / visitor count in the header on tablets** (they hide with the phone tier, ADR-0051 A13 D-1). Acceptable because: it is the phone tier's existing ruling, applied to a wider viewport.
- **InfoTip glosses no longer mount on tablets** (ADR-0051 D-4(vi)). Acceptable because: tablets are touch-first, and the touch branch is the one that double-fires with the reply sheet.
- The name `mobile` is now misleading (see Decision Outcome).

### Neutral

- `mobile` is `px`; Tailwind `lg` is `64rem`. They coincide only at a 16px root font size, so a reader with enlarged text gets `lg` at 1280px and `mobile` at 1024px, and the two hand-offs disagree for them. This is the same divergence globals.css already documented against `sm` at 640px; the guard now reads `lg`.
- Default-breakpoint variants (`sm:`/`md:`/`lg:`) outside `phone/` keep firing as they do today between 640 and 1023 (e.g. `MarketCard`). ADR-0051's ban on default-breakpoint variants applies inside `phone/` only.

## Pros and Cons of the Options

### Option 1 — Move the breakpoint to 1024 (chosen)

**Pros**

- Fewest lines; reuses a tier that is already designed, measured and guarded.
- Removes the overflow at every width in one move rather than per-surface.

**Cons**

- Looks like a stretched phone on tablets; the extra width goes unused.
- Wide blast radius across shared `max-mobile:` rules.

### Option 2 — A real tablet tier

**Pros**

- Uses the width: full-width chart, side-by-side argument columns, 2×2 resolution cards.

**Cons**

- A second breakpoint contradicts ADR-0045's single-breakpoint convention and needs its own design pass, ADR, and ~6–10 files of layout plus guards.

**Verdict:** Rejected for now. Not wrong — the operator chose speed. Nothing here forecloses it.

### Option 3 — Header-only fix

**Pros**

- Smallest possible change; stops the sideways scroll.

**Cons**

- Leaves the squeezed hero and 109px resolution cells; still needs a new breakpoint value.

**Verdict:** Rejected. It fixes the symptom the operator named and leaves the tier broken.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0045 | override-never-replace | Consumes — desktop stays the unprefixed default; a mobile rule is only ever a `max-mobile:` addition. Unchanged. |
| ADR-0051 D-1 | phone tier is a second presentation | Shapes — its gate moves from 640 to 1024; every presentation decision stands. |
| ADR-0051 A13 D-1 | header withdraws off-site controls on the phone tier | Consumes — tablets inherit that ruling. |
| CLAUDE.md §1 | seven critical areas | None touched: shell, discovery and market-detail presentation only; no bet, ledger, resolution, auth, moderation, identity-pool or schema code. |
| AGENTS.md §8 | "ONE minted breakpoint", `max-mobile:` convention | Shapes — the convention is unchanged, its value and its 640 prose move. |

## More Information

**Verification status at the time of writing (2026-09-29).** Measured in a real browser against the
compiled CSS, from a local dev server reading staging data (browse only, no writes): `--breakpoint-mobile`
compiles (an injected `flex max-mobile:flex-col` element reads `column` at 768); the header is the flat
phone row at every width up to 1023 and the desktop grid from 1024; document overflow is 0px at every
width tried on every route tried. On `/m/[slug]` (a market with 3 posts) the phone region is 721px tall
from 375 to 1023 and 0px at 1024, exactly where the desktop arena (593px) appears, so the hand-off is
clean; at 768 it renders the full-width YES/NO tabs, argument cards and pinned bet bar. `/u/[pseudonym]`
renders the phone position rows and a 3-column stats grid at 768; Discovery renders the 2-column market
grid with the hero hidden. **Not measured:** a signed-in viewer (bet composer, reply sheet, phone sell
sheet — the phone-sell path was exercised by unit tests only), an image-bearing post, a market with
many posts (snap-track scrolling), and pixel-identity of the desktop tier at 1024/1440 beyond overflow and
display checks. Status stays `proposed` until the operator has looked at it on a real tablet.

The before-numbers in Context come from a live staging session on 2026-09-29 (canary
`staging-e40d2c3`, header `scrollWidth` 812 at every width from 640 to 768), not from a committed
document — re-measure rather than quoting them if they are ever load-bearing.
