# ADR-0052 — v1 Feature-Flag Kill Switches: the Brake ADR-0007 Bought and Never Fitted

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-09-14 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | FLAGS-1 |
| **Frame document** | ADR-0007 §2 (Analytics + feature flags — the `useFlag()` runtime contract); SPEC.2 §18 (Observability Contract) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0007 — the `defaultValue` polarity rule, which inverts for a brake on shipped behaviour |
| **Amended-by** | — |

---

## Context and Problem Statement

ADR-0007 chose PostHog for two jobs, analytics and feature flags, and justified
the vendor substantially on one of them:

> **Feature-flag emergency brake.** PostHog flags provide a same-second toggle on
> any feature whose live behaviour proves wrong, without redeploy. Operational
> hygiene for the live window.

SCAFFOLD.6 then wired the transport and stopped. Measured at `feat/flag-kill-switches`
on 2026-09-14: `src/lib/posthog/use-flag.ts` exists and is correct, the SDKs are
installed, the provider is mounted at `src/app/layout.tsx:32`, and both env vars
are provisioned in the `stg` and `prd` Doppler configs — and there are **zero
`useFlag` call sites anywhere in `src/`**. The brake is a lever connected to
nothing. ADR-0007 anticipated this gap and deferred it by name ("v1 feature-flag
inventory (which flags ship at launch, what each does) → SCAFFOLD.6 + per-feature
ADRs as needed"); this is the ADR that discharges the deferral.

The experiment goes live **2026-09-15** and write-freezes 2026-11-05. A brake is
worth most in exactly that window, and fitting one during it is worse than
fitting one before it.

This ADR does **not** decide:

- The observability vendor set, the alarm catalogue, or the fail-open posture (ADR-0007)
- Product analytics / event emission at flow boundaries (ADR-0007 §2, still deferred — see Negative)
- Moderation architecture, which remains advisory (ADR-0046) and outside any transaction (ADR-0014)
- Whether image uploads should exist at all — this is a brake on a shipped feature, not a review of it (SPEC.1 §8 F-COMMENT-3)

## Decision Drivers

1. **A brake must be reachable without a deploy.** Vercel promote is minutes and
   needs an operator with credentials; a PostHog toggle is seconds and needs a
   browser. That difference is the entire value.
2. **A brake must never fire by accident.** The failure mode of a badly-poled
   flag is that a vendor outage silently removes working parts of the product —
   strictly worse than having no brake, because it converts a third-party
   incident into a first-party one.
3. **Off must be a shape the layout actually has.** A switch that removes a child
   but leaves its layout track produces a visibly broken page, which is not a
   safe state to fall back to.
4. **Launch-eve risk budget.** Anything requiring new secrets, new vendor
   configuration, or edits to components with live-defect histories is out.
5. **Honesty about what a client flag is.** It hides an affordance. It does not
   refuse a request. Any claim beyond that would be a security control this
   mechanism cannot deliver.

## Considered Options

1. **Client-side `useFlag` switch on image attach only** ← chosen
2. Client-side switches on image attach *and* the market price chart
3. Server-side flags via `posthogServer` local evaluation
4. Do nothing — ship the live window with no brake

## Decision Outcome

**Chosen: Option 1 — a single client-side kill switch on the composer's image
attach affordance, gated in `BetComposer`.**

### The inventory

| Flag | Default | Gate point | Off-state |
|---|---|---|---|
| `image-attach-enabled` | `true` | `src/components/debate/composer/BetComposer.tsx` | composer renders one column; posting continues, text-only |

One flag. Image attach is the highest-risk surface entering the live window — it
spends R2 storage and it is the one path by which a participant places an image
the operator did not choose in front of other participants — and its off-state is
the product's own core rather than a degraded mode, because mandatory commentary
means the argument was always the point and the picture never was.

### Polarity — this ADR amends ADR-0007

ADR-0007 §2 states: *"`defaultValue` MUST encode the safe behaviour — typically
'feature disabled.'"* That is correct for an **opt-in new feature**, where
shipping unfinished functionality on a vendor outage is the hazard it guards.

It **inverts for a brake on already-shipped behaviour.** Here the hazard runs the
other way: defaulting to "disabled" would mean an unreachable PostHog, or a flag
nobody has created yet, silently strips a working feature from the live product.
So the flag is named for the **feature** and defaults **on**:
`useFlag("image-attach-enabled", true)`.

⇒ **Convention for every future flag: `<feature>-enabled`, default `true` for a
brake on shipped behaviour; `<feature>-enabled`, default `false` for an opt-in
feature not yet ratified.** The name never encodes the brake ("`kill-*`"), because
a `kill-*` flag read through a `defaultValue` reverses meaning at the one moment
it matters and no reader reliably re-derives it under pressure.

### The gate lives in the parent, not the child

`BetComposer`'s argument region is `grid-cols-[2fr_3fr]` with the attach
affordance as its first track. **Removing only the child leaves the track**, so
the composer would render ~40% of its width blank while every assertion about the
fields column still passed.

This is not hypothetical — it is `RESO-1 · R-4` / `CRIT-1` recurring. There,
`MarketPriceChartHost` returned `null` inside a 340px rail whose caller had
already decided to draw it, and `MarketPriceChartHost.tsx:30-32` now carries a
standing instruction generalising the lesson: *"IF A SECOND 'nothing to draw'
CASE IS EVER ADDED, ADD IT HERE."*

⇒ **The child and the track it occupies must come from one decision.**
`BetComposer` owns both, so the flag is read there. A `useFlag` inside
`ImageAttach` would have reproduced the defect exactly.

### Single-source-of-truth file map

| Concern | File |
|---|---|
| The `useFlag` runtime contract | `src/lib/posthog/use-flag.ts` |
| The `image-attach-enabled` gate | `src/components/debate/composer/BetComposer.tsx` |
| Vendor no-provider behaviour | `tests/unit/posthog/_probe-useflag-no-provider.test.tsx` |
| Switch behaviour + the empty-track guard | `tests/unit/composer/render/image-attach-kill-switch.test.tsx` |

## Consequences

### Positive

- **The brake ADR-0007 paid for now exists**, on the surface most likely to need
  it, reachable in seconds from a browser by an operator with no deploy rights.
- **Inert until used.** The flag does not exist in PostHog; an absent flag returns
  `undefined` → `defaultValue` → feature on. Merging this changes nothing a
  participant can observe, which is what makes it safe to land on launch eve.
- **One gate covers desktop and phone.** `PhoneSheet` mounts the same
  `BetComposer` (ADR-0051 A1 forbids a second write path under `phone/`), so the
  switch reaches both presentations without a second call site.
- **The polarity rule is now written down** with its reasoning, before a second
  flag exists to get it wrong.

### Negative

- **It is not a security control and must never be described as one.** The
  affordance disappears; `POST /api/uploads/sign` is untouched and still serves
  anyone who calls it directly with a valid session. A reader who mistakes this
  for an upload kill switch will believe uploads are stopped when they are not.
- **The price chart is NOT gated, and the reason is a defect, not a preference.**
  `HeadZone.tsx:216` branches on `right === null` *literally*. A chart component
  that renders `null` is still a non-null React element, so `MarketHeader` would
  draw an empty 340px rail — the CRIT-1 defect again. `MarketHeader` is a **server
  component** and cannot ask a client flag, so gating the chart needs either
  server-side flags (below) or a restructure of a layout component carrying two
  live-defect histories. Neither belongs on launch eve. **The newest code in the
  product therefore has no brake.**
- **Server-side flags remain unbuilt, and ADR-0007 describes them as though they
  were.** ADR-0007 §2 states flags "use local evaluation — flag definitions are
  cached on the server at process start… per-request flag checks evaluate locally
  without a network call." `src/lib/posthog/server.ts` constructs
  `new PostHog(key, { host })` with neither `personalApiKey` nor
  `enableLocalEvaluation`, both of which `posthog-node@5.35.1` requires for local
  evaluation (`dist/types.d.ts:109,115`). As built it would issue a network call
  per check. Nothing consumes it, so nothing is broken today — but the ADR is
  ahead of the code, and closing the gap needs a new `POSTHOG_PERSONAL_API_KEY`
  secret in both Doppler configs.
- **Flags evaluate against an anonymous identity.** Nothing calls
  `posthog.identify()`. A global 100%/0% brake is unaffected; percentage rollouts
  and cohort targeting will not behave as ADR-0007 §2 describes until identity is
  wired.
- **Product analytics is still zero.** No `.capture()` call exists and
  autocapture, pageview, pageleave and session recording are all disabled at
  `instrumentation-client.ts:25-32`. The PostHog dashboard is empty by design and
  will stay so. Untouched here; it lands on §1 critical paths and needs its own
  plan and ADR.

### Neutral

- The off-state drops `max-mobile:grid-cols-1` along with the two-track template,
  because a single-track grid is already stacked. No `max-mobile:` override is
  added, so ADR-0045's additive-override convention is untouched.
- `image` state stays `{ phase: "none" }` when the affordance is absent, which is
  the existing no-image submit path. No payload change, no wire change.

## Pros and Cons of the Options

### Option 1 — client switch on image attach only (chosen)

- Good: highest-risk surface, safe and well-understood off-state, single client
  component owns both child and track.
- Good: no new secrets, no vendor configuration, no server behaviour.
- Bad: leaves the price chart — the newest code — without a brake.
- Bad: hides an affordance rather than closing an endpoint.

### Option 2 — image attach *and* the price chart

- Good: covers the surface most likely to misbehave on novelty grounds.
- Bad: `HeadZone`'s `right === null` branch makes the off-state an empty 340px
  rail; the caller is a server component; the fix touches CRIT-1 / RESO-1 R-4
  territory the night before launch. **Rejected on driver 3 and 4.**

### Option 3 — server-side flags via local evaluation

- Good: a real brake that refuses requests rather than hiding controls; would
  make ADR-0007 §2 true as written.
- Bad: new `POSTHOG_PERSONAL_API_KEY` secret in two Doppler configs, new vendor
  configuration, and a hot-path network dependency to reason about. **Rejected on
  driver 4**; recorded as the successor to this ADR.

### Option 4 — no brake

- Good: zero change.
- Bad: forfeits the benefit ADR-0007 chose the vendor for, in the one window it
  was chosen for. **Rejected on driver 1.**

## Flow & invariant constraints absorbed

- **INV-1 (bet ↔ comment atomicity) — untouched.** The switch removes an optional
  attachment affordance. Every bet still carries its comment; the W-1 transaction
  is not on this path.
- **CLAUDE.md §1 — not a critical-path change.** The seven areas are server
  surfaces; this edits two client components and adds tests. The area test —
  *can a mistake here corrupt the ledger, admit a participant who should not
  exist, or publish something that cannot be recalled* — is no on all three: the
  off-state publishes strictly less.
- **CLAUDE.md §5.6 — tests-first observed.** Media upload is a listed
  thesis-touching surface. `image-attach-kill-switch.test.tsx` was written and run
  RED (2 failing of 5) before `BetComposer` was edited.
- **ADR-0046 / ADR-0014 — moderation untouched.** No moderation call, ordering or
  reservation changes. With attach off there is simply no image to screen; the
  text path and its pre-transaction call are unchanged.
- **ADR-0051 A1 — no second write path.** The phone tier reuses `BetComposer`
  rather than mounting its own composer, so the gate is inherited rather than
  duplicated.

## More Information

- ADR-0007 §2 — the `useFlag()` runtime contract and the fail-open posture
- `posthog-node@5.35.1` `dist/types.d.ts:109,115` — `personalApiKey` /
  `enableLocalEvaluation`, the local-evaluation preconditions
- `posthog-js@1.376.0` `react/dist/esm/index.js:12-17` — the default context
  whose `client` getter returns the uninitialised global singleton
- `MarketPriceChartHost.tsx:16-36` and `HeadZone.tsx:216` — the empty-column
  defect this ADR's gate placement avoids
