# ADR-0023 — Participant Shell Topology

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-24 |
| **Deciders** | Hrishikesh (operator) · web Claude (review) |
| **Tracker task** | SHELL/UI.0 |
| **Frame document** | SPEC.2 §8.9 (participant URL contract), §8.4/§8.10 (route topology); ADR-0019 (server-mediated reads); ADR-0016 §6 (slug URLs) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Patch records** | 2026-07-17 · (auth) header mount — see §Patch record (UI.A1 / OQ-1) |

---

## Context and Problem Statement

SHELL/UI.0 stands up the one-time participant front-end bootstrap that every
later participant surface (the DEBATE / DESIGN / UI strata) reuses: a route
group, an app shell, the first addressable participant route (`/m/[slug]`), and
the shadcn baseline. Splitting this out of DEBATE.4 lets DEBATE.4 measure only
its own per-surface cost. The forces: keep the bootstrap minimal (no chrome or
providers that a later designed surface will rip out), keep participant reads
server-mediated (ADR-0019), and keep participant URLs slug-addressed, never raw
UUIDs (ADR-0016). This ADR records the topology so later surfaces compose the
same shell rather than re-deciding it.

This ADR does **not** decide:

- The designed global header — market radio, conclusion timer, visitor counter,
  back-nav, social dropdown (DESIGN.W2.4/.5/.14 → UI.13). The shell header here
  is throwaway placeholder scaffolding superseded there.
- The debate view (two-column / ranking / markers / Support–Counter aggregates)
  (DEBATE.4).
- The monochrome token values themselves (the SHELL/UI.0 token mint; provenance
  in `docs/design/design-language.md` §2.1).
- Auth, onboarding, and the admin route group topology (ADR-0004 / ADR-0010).

## Decision Drivers

1. **Reuse over rework.** The shell is the seam every later participant surface
   plugs into; deciding its shape once avoids per-surface drift.
2. **Server-mediated reads (ADR-0019).** No RLS, no client DB cache — reads run
   server-side in RSCs.
3. **URL contract (ADR-0016 §6).** Participant resources are slug-addressed; raw
   UUIDs never appear in participant-facing URLs.
4. **Minimal surface area now.** No provider or header chrome that a designed
   surface (UI.13) will replace; primitives installed just-in-time.
5. **Public-read.** Participant surfaces are reachable signed-out; the proxy
   gates `/admin/*` only.

## Considered Options

1. **A dedicated `(public)/` route group with a placeholder RSC shell + a
   single `/m/[slug]` scaffold, zero new providers** ← chosen
2. Co-locate participant routes at the app root (no group) and add the shell to
   the root `layout.tsx`.
3. Build the designed global header now and gate the group behind middleware.

## Decision Outcome

**Chosen: Option 1 — a `(public)/` route group with a minimal server-component
shell.**

Ratified primitives:

- **`src/app/(public)/` route group** — the participant-read surface family.
  Reached signed-out; **not** middleware-gated (`proxy.ts` matches `/admin/:path*`
  only). Reads are server-mediated (ADR-0019).
- **`(public)/layout.tsx`** — a **server component** app shell. **Zero new
  providers** (PostHog stays root-mounted; session is read server-side via
  `auth.api.getSession({ headers })`; no theme/query provider). The header is a
  **throwaway placeholder**: wordmark + a sign-in/pseudonym affordance only. The
  designed global header (UI.13) supersedes it; header chrome does not grow here.
- **`(public)/m/[slug]/page.tsx`** — the first participant resource route. RSC;
  resolves the market by slug and renders a minimal placeholder (title + status).
  Explicitly **not** the DEBATE.4 debate view.
- **`getMarketBySlug` (`src/server/markets/get-by-slug.ts`)** — the server-only
  slug resolver. Returns a DTO (never a drizzle row, AGENTS.md §6), **excludes
  `Draft`** (a Draft slug → `null` → `notFound()`; Drafts stay admin-only).
- **shadcn baseline** — `card · badge · avatar · separator · skeleton`, the
  foundational primitive set later surfaces reuse; surface-specific primitives
  (dialog, dropdown, tabs, tooltip, sonner) install just-in-time.

### URL contract

`/m/<market-slug>` — the participant market URL. The path parameter is the
`markets.slug` UNIQUE value, never `markets.id` (ADR-0016 §6 / SPEC.2 §8.9
`id::raw-uuid-not-in-participant-urls`). Unknown or `Draft` slug → `notFound()`.

## Consequences

### Positive

- Later participant surfaces drop into `(public)/` and reuse the shell — no
  per-surface shell decision.
- Server-mediated reads keep the client free of DB types and a query cache.
- The slug contract is enforced at the one resolver, with Draft-exclusion in the
  query.
- Zero-new-provider posture keeps the boot graph small and auditable.

### Negative

- The placeholder header is throwaway — it will be replaced wholesale at UI.13.
  *Acceptable because:* it is explicitly scaffolding, flagged in code; building
  the designed header now would block on DESIGN.W2 work that has not landed.
- `(public)/` being un-gated means every route under it must independently be
  safe to serve signed-out. *Mitigated by:* read-only surfaces only; any future
  write path adds its own auth gate at the handler (the proxy is UX-layer, not a
  security boundary — ADR-0010).

### Neutral

- `getMarketBySlug` uses the existing `markets.slug` UNIQUE — no new index, no
  migration (head stays `0018`).

## Pros and Cons of the Options

### Option 1 — `(public)/` group + placeholder shell + `/m/[slug]` (chosen)

**Pros**

- Clean reuse seam; matches the existing `(admin)` / `(auth)` group convention.
- Minimal: one shell, one route, zero providers.

**Cons**

- The placeholder header is discarded at UI.13.

### Option 2 — root-level routes, shell in root `layout.tsx`

**Pros**

- One fewer directory.

**Cons**

- The root layout is shared with `(admin)` / `(auth)`; participant chrome would
  leak into those. **Verdict:** Rejected — group isolation is why the existing
  `(admin)`/`(auth)` groups exist.

### Option 3 — build the designed header now, gate the group

**Pros**

- No throwaway scaffolding.

**Cons**

- Blocks on DESIGN.W2 (radio/timer/visitor-counter/social-dropdown) not yet
  designed; middleware gating contradicts public-read. **Verdict:** Rejected —
  out of SHELL/UI.0 scope; the header is UI.13.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0019 | server-mediated reads | consumes — `(public)/` reads run server-side in RSCs; no RLS/client cache |
| ADR-0016 §6 | slug URLs | consumes — `/m/<slug>` is slug-addressed; no raw UUID in the participant URL |
| SPEC.2 §8.9 | `id::raw-uuid-not-in-participant-urls` | shapes — the `/m/[slug]` route satisfies the URL-exposure rule |
| ADR-0010 | admin auth boundary | consumes — `(public)/` is not the admin path; proxy gates `/admin/*` only |
| design-language §1.7 | desktop-only light theme | consumes — no theme provider; single light monochrome theme |
| Tracker | DEBATE.4, DESIGN.*, UI.* participant surfaces | All compose this shell once `accepted` |

## More Information

- `docs/design/design-language.md` §1 (locked constraints) + §2.1 (the token mint
  this shell renders against)
- `docs/plans/SHELL-UI.0.md` (the approved plan + six OQ rulings + two required fixes)
- AGENTS.md §3 (route topology), §6 (DTO-not-row), §8 (tokens)

---

*ADR-0023 ratifies the participant front-end shell topology: a `(public)/` route
group with a minimal zero-provider server-component shell, the `/m/<slug>`
resolver-backed scaffold, and the shadcn baseline set. The decision body and the
URL contract minted in §Decision Outcome are immutable; superseding requires a
new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*

---

## Patch record — 2026-07-17 · Branded header mounts in `(auth)` (UI.A1, ratified OQ-1)

**Decision unchanged; consumer surface grows** (CLAUDE.md §5.12 in-place
patch — not a supersession). The `(public)/` topology, URL contract, and
every primitive ratified above stand as written.

**What grows:** the shared branded `GlobalHeader` (UI.A1 — the designed
header this ADR deferred as "UI.13"; UI-LANE §2 re-sequenced UI.13 into A1)
now also mounts in the **`(auth)` route group** via a new, **additive**
`src/app/(auth)/layout.tsx`:

    getSession → <GlobalHeader viewer={…}/> + <main>{children}</main>

**Why here:** the Session-B fork gate (UI-LANE §3) requires the branded
header live on `/m/[slug]` **and the auth routes**. No `(auth)/layout.tsx`
existed; mounting via the root layout is rejected by this ADR's own
Option-2 verdict (root is shared with `(admin)` — participant chrome would
leak). An additive group layout is the only mechanism consistent with the
decision body.

**What does not change:**
- **Zero edits to existing auth files** — `src/app/(auth)/**` pages and
  `src/server/auth/**` are untouched (A7 critical-path class). This patch
  adds one file; it edits none.
- **No auth behavior change** — the layout performs the existing
  `auth.api.getSession({ headers })` read already used by
  `(public)/layout.tsx` (an import + call, not an auth-code change). Auth,
  onboarding, and admin topology remain decided by ADR-0004 / ADR-0010, as
  the Context section scopes.
- **Public-read posture** — unchanged; `(auth)` was never proxy-gated and
  is not now.

**Same-commit law:** this patch record lands in the same commit as
`src/app/(auth)/layout.tsx` (CLAUDE.md §5.12). Ratification: OQ-1,
operator-ratified 2026-07-16 (docs/plans/UI-A1.md, Ratification record).
