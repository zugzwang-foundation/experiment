# FLAGS-1 — the kill switch ADR-0007 bought and never fitted

**Status:** executed 2026-09-14 · branch `feat/flag-kill-switches` · ADR-0052
**Critical path:** no (CLAUDE.md §1 — client components only)

## Why

ADR-0007 chose PostHog substantially for one benefit — *"a same-second toggle on
any feature whose live behaviour proves wrong, without redeploy"* — and deferred
the flag inventory to SCAFFOLD.6. SCAFFOLD.6 shipped the transport and stopped.

Measured at kickoff: `useFlag` correct, SDKs installed, provider mounted, both
env vars provisioned in `stg` and `prd` — and **zero call sites in `src/`**. The
brake was a lever connected to nothing, on the day before launch.

## What shipped

One flag: **`image-attach-enabled`**, default `true`, gated in `BetComposer`.

Image attach is the highest-risk surface entering the live window (R2 spend, and
the one path putting a participant-chosen image in front of other participants),
and its off-state is the product's own core rather than a degraded mode — with
mandatory commentary, the argument was always the point.

| File | Change |
|---|---|
| `src/components/debate/composer/BetComposer.tsx` | the gate: one condition drives both the child and its grid track |
| `src/lib/posthog/use-flag.ts` | docblock only — three dangling `AGENTS.md §7` citations repointed at ADR-0007 |
| `docs/adr/0052-v1-feature-flag-kill-switches.md` | new — the inventory, the polarity convention, the gate-placement rule |
| `docs/adr/0007-observability.md` | `Amended-by` + the polarity amendment in-place (`O-5`), two stale file paths corrected |
| `tests/unit/composer/render/image-attach-kill-switch.test.tsx` | new — 5 tests, RED-first |
| `tests/unit/posthog/_probe-useflag-no-provider.test.tsx` | new — vendor-contract guard |
| `tests/unit/design/composer-fit.test.ts` | anchor repair only; the assertion is unchanged |

## The two findings that shaped it

**1 · The gate belongs in the parent.** `BetComposer`'s argument region is
`grid-cols-[2fr_3fr]` with attach as the first track. Dropping only the child
leaves the track — ~40 % of the composer blank, with every fields-column
assertion still green. That is `RESO-1 · R-4` / `CRIT-1` recurring, and
`MarketPriceChartHost.tsx:30-32` already carries the standing warning. The child
and its track must come from one decision, so the flag is read where both live.

**2 · The price chart is NOT gated, and that is a finding rather than a
descoping.** The original plan called it the *safe* option. It is the hard one:
`HeadZone.tsx:216` branches on `right === null` **literally**, so a chart that
*renders* null still gets a 340 px rail drawn around it — and the caller that
would need to know, `MarketHeader.tsx`, is a **server component** that cannot ask
a client flag. Gating it needs server-side flags or a restructure of a layout
component with two live-defect histories. Neither belongs on launch eve.

⇒ **The newest code in the product has no brake.** Stated plainly because it is
the gap a reader of ADR-0052 most needs to know about.

## Verification performed

- `ZUGZWANG_ENV=preview just verify` — green (typecheck → biome → build)
- `pnpm vitest run tests/unit/` — **3996 passed / 295 files**, zero failures
- Tests written RED first: 2 of 5 failing before `BetComposer` was touched
- Browser probe (AGENTS.md §9, with positive *and* negative controls): both track
  templates compile — off-state `grid-cols-1` → one full-width track, on-state
  `grid-cols-[2fr_3fr]` → `409.6px 614.4px`, a bogus class → `none`.
  `document.styleSheets.length` 2 and body ground `rgb(24,24,24)`, so the probe
  read a real stylesheet rather than an unstyled document.

⚠ **NOT verified: the composer's off-state rendered in a real browser.** It needs
an authenticated session, which cannot be driven headlessly here. Covered by
jsdom structure tests + the compiled-utility probe above; neither performs
layout. `O-13` — recorded as not established rather than assumed green.

## Operator steps (nothing happens until these run)

The flag does not exist in PostHog. An absent flag returns `undefined` →
`defaultValue` → feature on, so **merging this changes nothing a participant can
observe.**

1. Create `image-attach-enabled` in PostHog, rollout **100 %** (feature on).
2. To brake: set rollout to **0 %**. To release: back to 100 %.
3. Rehearse on staging before relying on it in production.

## Carried forward

- Price chart brake — needs server-side flags or a `HeadZone` restructure
- Server-side flags — `posthog-node` is constructed without `personalApiKey` /
  `enableLocalEvaluation`, so ADR-0007's "local evaluation" claim is not built;
  closing it needs a new `POSTHOG_PERSONAL_API_KEY` in both Doppler configs
- `posthog.identify()` — never called; percentage/cohort targeting will not
  behave as ADR-0007 describes until it is
- Product analytics — still zero `.capture()` calls, by design
- **Duplicate ADR-0051** — two documents share the number
  (`0051-phone-market-detail-presentation.md`,
  `0051-windowed-shared-read-caches-and-the-poster-bypass.md`). Different slugs →
  different filenames → clean merge → silent collision, which falsifies
  CLAUDE.md §8 `O-15`'s claim that `ADR-NNNN` cannot collide silently. Raised per
  §5.4, not fixed here.
