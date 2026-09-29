# ADR-0063 — Small tablets get the phone tier: `--breakpoint-mobile` moves from 640px to 820px, and the desktop header trims below `xl`

| | |
|---|---|
| **Status** | proposed (awaiting operator review; real-tablet check pending — see More Information) |
| **Date** | 2026-09-29 |
| **Deciders** | Hrishikesh (operator: option A, then B after the signed-in measurement), Claude Code |
| **Tracker task** | TABLET-1 (ad hoc — the tablet width band was never owned by MOBILE-1/MOBILE-2) |
| **Frame document** | `design-language §1.7` (via ADR-0045) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0045 — the 640px value only (override-never-replace stands). ADR-0051 (phone market detail) — the 640px tier gate only (its presentation decisions stand) |
| **Amended-by** | — |

---

## Context and Problem Statement

The repo has one minted breakpoint, `--breakpoint-mobile: 640px` (ADR-0045), and a phone tier hanging
off it: `max-mobile:*` overrides in the shell and read surfaces, `PhoneDebateView` and its `phone/`
leaves on `/m/[slug]` (ADR-0051), and `profile/phone/`. Below 640 everything is designed; above ~820
the desktop layout works. **Between 640 and ~820 nothing was designed**, and that band is where
tablets live.

Measured on staging (canary `staging-e40d2c3`), signed out, the global header's desktop form is
812px wide and only collapsed below 640, so every route scrolled sideways by 171px at 640, 111px at
700 and 43px at 768, with the countdown and JOIN clipped off the right edge.

**A first attempt got the number wrong, and the reason is the point of this ADR.** The fix first
shipped as 1024px on the strength of a SIGNED-OUT measurement ("desktop fits from 820"). The operator
then looked at a signed-in staging window at ~1000px, disliked the phone look there, and asked to keep
the desktop look wherever it worked. Re-measuring the SIGNED-IN header (real compiled CSS, the Đ
cluster and pseudonym chip copied from `DharmaCluster.tsx` / `IdentityCluster.tsx`) showed the desktop
header is far wider signed in: with the phone-only rules stripped, it overflowed by **256px at 820,
176 at 900, 116 at 960, 52 at 1024** and fit only from ~1076. Lowering the line to 820 alone would have
brought the original bug back for exactly the participants who bet.

This ADR does **not** decide:

- The phone tier's own design (ADR-0051, ADR-0048, ADR-0049)
- A dedicated tablet layout — explicitly not built (Considered Options 3)
- The desktop page body's cramping at 820–1023 (e.g. the market page's four resolution cards) — unchanged

## Decision Drivers

1. Tablets must stop scrolling sideways and clipping the countdown and JOIN — for signed-in users, not only signed-out ones.
2. Keep the desktop look everywhere it worked (operator ruling); phone (<640) and laptop (≥1280) must not move.
3. Smallest change that achieves (1) and (2): reuse the existing tier and Tailwind's own breakpoints.
4. The two places that execute the number must not disagree (a CSS gate and a JS hook).

## Considered Options

1. **Phone tier below 820px, desktop above; desktop header trims below `xl`** ← chosen
2. Phone tier below 1024px (first shipped) — every window under 1024 gets the phone look
3. Mint a second breakpoint and design a tablet tier
4. Phone tier below 820px with no header trim

## Decision Outcome

**Chosen: Option 1.**

- `src/app/globals.css` — `--breakpoint-mobile: 640px` → `820px`. `max-mobile:*` now means `<820px`.
- `src/components/debate/phone-tier.ts` — `QUERY` → `"not all and (min-width: 820px)"`. It is a
  hand-copied string of the token, read by `useIsPhoneTier()`; changed alone, tablets would get CSS
  saying "phone" and a hook saying "desktop".
- `GlobalHeader.tsx` (secondary-controls wrapper and the §21.1 divider), `XLink.tsx` and
  `VisitorCounter.tsx` each gain `max-xl:hidden` beside their existing `max-mobile:hidden`, gated on
  `mobileResponsive` like every breakpoint class in that chain. Radio, GitHub, X, the divider and the
  visitor count are therefore hidden below Tailwind's `xl` (1280px). Adding no new breakpoint.

**Why 820.** iPad portrait (768) gets the phone tier; iPad Air/Pro portrait (820/834) and up keep the
desktop look. The header's signed-out desktop form fits from 820.

**Why `xl` (1280px) for the trim.** Measured on the real compiled CSS, worst-case signed-in user
(longest pseudonym, widest balances): the *full* header overflows 131px at 1080, 51px at 1160 and 11px
at 1200, and fits from 1240 (logo full-size from 1280). `xl` is exactly 80rem = 1280px, so it needs no
new token and matches the measurement.

**Why the trim is enough at 820.** With the four controls hidden: typical signed-in user, zero overflow
and full-size logo at every width 820–1440; a long-but-realistic user (17-character pseudonym, six-digit
balances) zero overflow with the logo shrinking to 195–209px at 820–834; only a pathological user
(34-character pseudonym AND 8-digit balances) overflows — 50px at 820, 10px at 860, none from 900.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The breakpoint value (CSS variants) | `src/app/globals.css` (`--breakpoint-mobile`) |
| The breakpoint value (JS tier hook) | `src/components/debate/phone-tier.ts` (`QUERY`) — must equal the token |
| The header trim (`max-xl:hidden`) | `GlobalHeader.tsx`, `XLink.tsx`, `VisitorCounter.tsx` |
| Guard: name + value, px-vs-rem premise, the trim's four sites | `tests/unit/design/mobile-breakpoint-token.test.ts` |
| Guard: exact hide strings | `tests/unit/shell/global-header-mobile-reflow.test.ts` |
| Guard: hook and desktop tree agree | `tests/unit/debate/phone/desktop-neutrality.test.tsx` |

## Consequences

### Positive

- No sideways scroll at any width tried (375–1440) on `/`, `/m/[slug]` and `/u/[pseudonym]`, and none in the signed-in header simulation from 820 up for typical and realistic-long users.
- Laptop windows and large tablets keep the desktop look; only widths under 820 change from the desktop look.
- The trim also removes a pre-existing defect: a signed-in header overflowed by up to 52px at 1024 and squeezed the logo up to ~1240px, before this change.
- No new breakpoint; three source files gain one token each.

### Negative

- **820–1279px loses Radio, GitHub, X and the visitor count** on the desktop look (for signed-out visitors too — it does not vary by viewer). Acceptable because: it is the phone tier's existing trade applied to a band, the alternative was overflow, and at ≥1280 nothing changes.
- **Small tablets and narrow windows under 820px look like a large phone** — one card at a time, wide side margins. Acceptable because: this was the operator's choice over a designed tablet tier.
- **The desktop page body is still cramped at 820–1023px** (four resolution cards at ~100px each, hero columns of ~190/365/190px). Unchanged by this ADR and out of scope.
- **A pathological signed-in user overflows up to 50px at 820–~890px.** Acceptable because: a 34-character name with 8-digit balances is far beyond what auto-assigned pseudonyms and current balances produce; re-measure if either changes.
- **Every `max-mobile:` rule now fires up to 819px** including values tuned at 360–430px. Mitigated by: browser sweep across the band; the phone tier was already measured to 640.
- The name `mobile` now overstates (it covers small tablets). Rename rejected: ~35 files and every guard key on it.

### Neutral

- `mobile` is `px`; Tailwind's breakpoints are `rem` (`md` 48rem, `lg` 64rem, `xl` 80rem). They coincide only at a 16px root font size, so for a reader with enlarged text the hand-offs disagree (the `xl` trim moves later, which errs toward hiding more). The guard reads the installed Tailwind values.
- Default-breakpoint variants outside `phone/` keep firing as today. ADR-0051's ban on them applies inside `phone/` only.
- **A signed-out measurement misled this decision once.** Any future change to the header's width or to this breakpoint must be re-measured signed in.

## Pros and Cons of the Options

### Option 1 — 820 + header trim below `xl` (chosen)

**Pros**

- Desktop look kept where it works; fixes signed-in overflow, not just signed-out.
- Reuses the tier and Tailwind's `xl`; no new breakpoint.

**Cons**

- The header is slimmer between 820 and 1279 than a laptop user might expect.
- The desktop body stays cramped at 820–1023.

### Option 2 — 1024 (first shipped)

**Pros**

- One number; no header edits; consistent phone look under 1024.

**Cons**

- Narrow desktop windows and iPad landscape-ish widths got the plain phone look for no overflow reason.

**Verdict:** Rejected after the operator saw it. It was chosen on a signed-out measurement.

### Option 3 — A real tablet tier

**Pros**

- Uses the width properly: full-width chart, side-by-side argument columns, 2×2 resolution cards.

**Cons**

- A second breakpoint contradicts ADR-0045's single-breakpoint convention and needs a design pass and ~6–10 files.

**Verdict:** Rejected for now; nothing here forecloses it.

### Option 4 — 820 with no trim

**Pros**

- Smallest change.

**Cons**

- Re-creates the sideways scroll for every signed-in user from 820 to ~1076 (256px at 820) — the original defect.

**Verdict:** Rejected on the signed-in measurement.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0045 | override-never-replace | Consumes — desktop stays the unprefixed default; a mobile rule is only ever a `max-mobile:`/`max-xl:` addition behind `mobileResponsive`. Unchanged. |
| ADR-0051 D-1 | phone tier is a second presentation | Shapes — its gate moves from 640 to 820; every presentation decision stands. |
| ADR-0051 A13 D-1 | header withdraws off-site controls on the phone tier | Consumes — extended by the `xl` trim to 820–1279. |
| SPEC.1 §21.1 | register divider fences the visitor count off the Đ figures | Consumes — divider and counter hide TOGETHER, exactly as they already do on the phone tier. |
| CLAUDE.md §1 | seven critical areas | None touched: shell, discovery and market-detail presentation only. |
| AGENTS.md §8 | `max-mobile:` convention, prop-gated | Shapes — the convention is unchanged; its value and its 640 prose move. |

## More Information

**Verification (2026-09-29).** Real browser, compiled CSS, local dev server reading staging data
(browse only):

- Overflow 0px at 375 / 640 / 768 / 819 / 820 / 834 / 900 / 1000 / 1023 / 1024 / 1279 / 1280 / 1440
  on `/`, `/m/[slug]` (a market with 3 posts) and `/u/[pseudonym]`.
- Hand-off is exact: header row is `flex` at 819 and `grid` at 820; the market page's phone region is
  721px tall up to 819 and 0 from 820, where the desktop arena (616px) appears.
- Radio/GitHub/visitor hidden at 820–1279, shown at 1280+.
- Signed-in simulation (injected markup, real CSS): see Decision Outcome for the four cases measured.

**Not measured:** a real signed-in session (the signed-in header was simulated by copying the
components' markup, so widths depend on that copy staying faithful), signed-in flows at tablet width
(bet composer, reply sheet, phone sell sheet — the sell path is covered by unit tests only), image
posts, many-post threads, and real tablet hardware. Status stays `proposed` until the operator has
looked at it on a real tablet.

The before-numbers in Context come from live staging sessions on 2026-09-29, not from a committed
document — re-measure rather than quoting them if they are ever load-bearing.
