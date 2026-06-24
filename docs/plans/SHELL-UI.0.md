# SHELL/UI.0 — Participant front-end bootstrap + DESIGN.7 token mint

> **Status:** APPROVED (web Claude sign-off + six OQ rulings + two required fixes). Phase 1 plan, committed before execution.
> **Plan-then-execute:** execution runs in a **fresh chat** against this committed plan. This file is self-contained — it is the only context the execute phase inherits.
> **Baseline:** `origin/main` @ `9332562` · migration head `0018` · no DESIGN.1/.7 ever landed · participant FE near-empty (root `layout.tsx` + `PostHogProvider` only; `components/ui/` = `button.tsx`; no `(public)/` group).
> **Ritual (critical-path-adjacent):** writer/reviewer → pre-PR self-audit (§5.10) → `@code-reviewer` post-audit. **No `@security-auditor`.** `@db-migration-reviewer` **only if** a migration becomes unavoidable — which is NOT expected; if one proves necessary, **HALT + flag** (head must stay `0018`).

---

## 0. Why this task

The one-time participant-shell bootstrap every later participant surface reuses — split out of DEBATE.4 so DEBATE.4 measures only per-surface cost. **Direct build, no Claude Design handoff this round.** Three pieces: (1) mint the locked v1.0 monochrome tokens into `globals.css`; (2) stand up the minimal participant shell + a `/m/[slug]` scaffold; (3) establish the shadcn install path + a foundational primitive set verified against the new tokens.

## 0.1 Preconditions / confirm-at-execute

- **Pseudonym on session:** confirm `session.user` exposes the pseudonym (Better Auth `user.additionalFields` declares it — per FIX-AUTH-SIGNUP) **or** resolve it server-side for the signed-in header affordance. Settle in execute; do not assume the field name without checking the live `auth` config.
- **Staging-verify data:** staging needs **≥1 Open market** (and ideally **1 Draft**) with **known slugs**, created by the operator via admin market-CRUD, before the staging checklist (§11) can run. Also: the **pre-existing DEBATE.9-close staging `migrations: "drift"`** must be cleared (operator staging redeploy) first, so a clean `/api/health` is attributable to this change.

## 1. Scope fence — NOT DOING (HALT + flag if the plan must cross any)

The debate view / two-column / ranking / markers / Support–Counter aggregates / removal-masking (all DEBATE.4) · the reply composer or any write path · discovery / market-list / profile or any other surface (only the `/m/[slug]` scaffold) · branding / a full `DESIGN.1` brand-tokens.md · **schema or migration changes (head stays `0018`)**. If a migration proves unavoidable → **HALT and flag** (do not self-resolve).

## 2. Resolved decisions (the six OQ rulings)

- **OQ-1 — `--destructive`:** leave it red. Sole consumer is `(admin)/admin/moderation/audit/page.tsx` (admin-only, by design); admin gets its own visual language later (design-language §7.2). It is the one residual non-monochrome semantic token; participant surfaces simply avoid destructive variants.
- **OQ-2 — Draft visibility:** the slug resolver **excludes `Draft`**; all other states (`Open/Closed/Resolving/Resolved/Voided/Frozen`) resolve. A `Draft` slug → 404 for participants (admin still reaches Drafts via the admin route).
- **OQ-3 — radius:** keep the existing `--radius: 0.625rem` + scale (surgical); mint `--imgr: 6px` as a **flagged placeholder**; the mockup's `--r 8px` is deferred to the branding pass.
- **OQ-4 — ramp naming:** mint the ramp as `--color-n0 … --color-n7` + `--color-ink` (Tailwind-idiomatic, generates `bg-n*`/`text-n*`). **No bare `--n*` aliases** this round.
- **OQ-5 — dev smoke page:** retarget the one consumer `src/app/(dev)/scaffold-1-smoke/page.tsx` (`bg-yes/50` → `bg-muted`); **do not delete** the page — flag it as a maintenance-sweep cleanup candidate.
- **OQ-6 — record:** mint a **lightweight ADR** for the participant-shell topology **and** a **design-language §2 patch** (token-mint provenance). Not a brand-tokens.md (fenced out).

## 3. Folder / file structure

```
src/app/
  globals.css                         # TOUCH — mint ramp; fix YES/NO binding; drop --color-brand + the "do not consume" header
  (public)/                           # NEW route group (public-read; not middleware-gated — proxy.ts matcher is /admin/* only)
    layout.tsx                        # NEW — minimal app shell (RSC); placeholder header + <main>{children}</main>
    m/[slug]/page.tsx                 # NEW — RSC; getMarketBySlug(slug); notFound() if null; minimal placeholder (title + status)
  (dev)/scaffold-1-smoke/page.tsx     # TOUCH (1 line) — bg-yes/50 → bg-muted  (OQ-5; leave a maintenance-sweep note)
src/server/markets/
  get-by-slug.ts                      # NEW — server-only slug resolver (returns a DTO, excludes Draft)
src/components/ui/
  card.tsx badge.tsx avatar.tsx separator.tsx skeleton.tsx   # NEW (shadcn add)
docs/adr/00NN-participant-shell-topology.md   # NEW — lightweight ADR (OQ-6)
docs/design/design-language.md        # TOUCH — §2 patch (values landed)
AGENTS.md                             # TOUCH — §8 (drop placeholder note), §3 ((public)/ + /m/[slug] exist)
tests/
  unit/design/tokens-monochrome.test.ts             # NEW — static token regression guard
  integration/market-by-slug.integration.test.ts    # NEW — resolver behavior (real test Postgres)
docs/plans/SHELL-UI.0.md              # THIS FILE (Phase 1 commit)
```

No schema/migration files. Migration head stays **`0018`**.

## 4. Token mint — exact mapping (mockup hex → `globals.css`)

Minted into the existing literal `@theme { … }` block, in **OKLCH** (AGENTS.md §8 — "OKLCH only in `@theme`"). The OKLCH values are the canonical Tailwind-neutral equivalents of the mockup hex (pure greys → chroma 0). **Execute converts each hex with a deterministic tool (e.g. `culori`/`oklch()`), not by eye**, and verifies the round-trip is lossless for greys.

| Mockup | Hex | `globals.css` token | OKLCH |
|---|---|---|---|
| `--n0` | `#FFFFFF` | `--color-n0` | `oklch(1 0 0)` |
| `--n1` | `#F5F5F5` | `--color-n1` | `oklch(0.971 0 0)` |
| `--n2` | `#E5E5E5` | `--color-n2` | `oklch(0.922 0 0)` |
| `--n3` | `#D4D4D4` | `--color-n3` | `oklch(0.871 0 0)` |
| `--n4` | `#A3A3A3` | `--color-n4` | `oklch(0.708 0 0)` |
| `--n5` | `#737373` | `--color-n5` | `oklch(0.556 0 0)` |
| `--n6` | `#404040` | `--color-n6` | `oklch(0.371 0 0)` |
| `--n7` | `#171717` | `--color-n7` | `oklch(0.205 0 0)` |
| `--ink` | `#0A0A0A` | `--color-ink` | `oklch(0.145 0 0)` |

### Binding fix (the inversion correction) — REQUIRED FIX 1: comments name the SIDE, not the relation

design-language §1.3/§2.1 supersedes the Support↔YES / Counter↔NO wording; **do not carry that conflation into code.** Write the side, with these exact comments:

```css
--color-yes: oklch(0.145 0 0); /* YES side = black — frozen post-side; NOT Support (design-language §1.3/§2.1) */
--color-no: oklch(1 0 0); /* NO side = white */
```

- **Remove** `--color-brand` (deferred to the centralized brand-pass token-swap).
- **Remove** the "SCAFFOLD.1 placeholder … do not consume until DESIGN.7" header comment.

### Non-color tokens (raw `:root` custom properties — not utility-generating)

```css
--hairline: 1px solid var(--color-n2);
--imgmax: 160px; /* tunable — comment-image max (consumed by DEBATE.4) */
```

### CD-deferred — kept as clearly-flagged placeholders, NOT finalized

```css
--imgr: 6px; /* image corner radius — CD-DEFERRED placeholder; finalized at the branding pass */
```

- Radius: **keep** the existing `--radius: 0.625rem` + scale untouched (OQ-3); mockup's `--r 8px` deferred to branding.
- Type: **keep** the incumbent **Geist** (`--font-sans` → Geist, already loaded in `layout.tsx`) as the neutral-sans placeholder, flagged CD-deferred.

### Untouched (surgical)

The shadcn semantic `:root`/`.dark` ramp already resolves to these greys → installed primitives render monochrome with **no semantic-token edit**. `--destructive` stays red (OQ-1, admin-only). The `.dark` block is left dormant (participant surfaces are light-only, desktop-only — design-language §1.7). The `:root` semantic tokens (`--background`, `--foreground`, `--muted`, `--border`, `--ring`, …) are **not** edited — they are already the monochrome neutral ramp; document the duplication is intentional (`--color-n*` is the design-system vocabulary; the semantic tokens are the shadcn-consumed vocabulary; both point at the same greys).

## 5. Minimal provider tree (the bootstrap adds **zero** new providers)

```
<html><body>
  <PostHogProvider>            ← existing (root); analytics; participant pages inherit
    (public)/layout.tsx  →  <header> placeholder </header> <main>{children}</main>
```

| Candidate | Verdict | Justification |
|---|---|---|
| PostHog | keep (existing) | Already root-mounted; no change. |
| Session/auth context | **none added** | Better Auth's React client (`authClient`) is provider-less (nanostore `useSession`); the shell reads session server-side via `auth.api.getSession({ headers })` in the RSC layout. |
| Theme provider | **none** | Single light monochrome theme, CSS-token-driven, desktop-only (design-language §1.7) — no toggle. |
| Data/query provider | **none** | RSC server-side fetching (ADR-0019 server-mediated reads); no client cache. |

## 6. `(public)/layout.tsx` — REQUIRED FIX 2: minimal PLACEHOLDER shell

`(public)/layout.tsx` is a **server component** = the reusable app shell. Header is a **MINIMAL PLACEHOLDER**: wordmark + a sign-in/pseudonym affordance only (signed-out → `Sign in` link to `/sign-in`; signed-in → `session.user.pseudonym`). It is **throwaway scaffolding superseded by the designed global header (DESIGN.W2.4/.5/.14 → UI.13)**. **Do NOT build** radio / timer / visitor-counter / back-nav / social-dropdown chrome here. **Flag it as a placeholder in code** (a header comment naming UI.13 as the supersessor). No `"use client"`.

## 7. `/m/[slug]` + slug resolver

- `src/app/(public)/m/[slug]/page.tsx` — RSC; `const { slug } = await params;` → `getMarketBySlug(db, slug)`; `null → notFound()`; else render a **minimal placeholder** (title + status badge + a "debate view arrives in DEBATE.4" line). Explicitly **not** the two-column / ranking / markers view.
- `src/server/markets/get-by-slug.ts`:

```ts
import "server-only";
export type MarketSummary = {
  id: string; slug: string; title: string;
  description: string | null; status: MarketStatus;
};
export async function getMarketBySlug(
  client: DbClient | DbTransaction, slug: string,
): Promise<MarketSummary | null>;
// SELECT id, slug, title, description, status FROM markets
//   WHERE slug = $1 AND status <> 'Draft'  LIMIT 1   → DTO (not a drizzle row); null if none
```

Read-only; uses the existing `markets.slug` UNIQUE — **no new index, no migration, no new table**. Excludes `Draft` (OQ-2). Maps to a DTO, never exposing a drizzle row (AGENTS.md §6).

## 8. shadcn baseline set

Install path: `pnpm dlx shadcn@latest add <name>` (`components.json` present — style `radix-nova`, rsc, baseColor neutral, css → `globals.css`, lucide). Foundational set (also the token no-regression probe — exercises bg / card / muted / foreground / border / ring):

- `card` (surfaces) · `badge` (status pill) · `avatar` (header PFP) · `separator` (hairline structure) · `skeleton` (loading — design-language §4.10).

Surface-specific primitives (dialog, dropdown, tabs, tooltip, sonner) are installed **just-in-time** by the surface that needs them — keeps this bootstrap minimal.

## 9. No-regression validation

1. **Static token guard** (`tokens-monochrome.test.ts`): `globals.css` contains the n-ramp + `--color-yes` = ink + `--color-no` = n0; **zero** chromatic oklch in the brand block (no green/red/purple); the "do not consume" header is removed.
2. **`ZUGZWANG_ENV=preview just verify`** — the build proves Tailwind compiles the new tokens, generates `bg-n*`/`bg-yes`/`bg-no` utilities, and the 5 primitives typecheck/compile.
3. **Manual visual pass** (`just dev` + staging): shell + `/m/[slug]` + the 5 primitives render monochrome (no green/red); hairlines/cards/badges correct. **No Playwright is installed → no automated visual regression; manual is the only path** (stated, not hidden).
4. **ADR-0016 guard:** run `tests/server/identity/no-raw-uuid-in-urls.test.ts` — the new `/m/[slug]` uses a slug param (not a UUID) and must still PASS.

## 10. Test list

- `tests/integration/market-by-slug.integration.test.ts` — known slug → DTO; unknown → `null`; **Draft → `null`** (OQ-2). Real test Postgres.
- `tests/unit/design/tokens-monochrome.test.ts` — the static guard (§9.1).
- (re-run) `tests/server/identity/no-raw-uuid-in-urls.test.ts`.
- Pages/layout: no unit framework for RSC (no Playwright) → covered by build + manual. Per CLAUDE.md §5.6, shell UI/RSC scaffolding is TDD-exempt; the slug resolver is the one logic piece warranting a test.

## 11. Staging-verify checklist

- `ZUGZWANG_ENV=preview just verify` green; `pnpm vitest run` (full suite) green — incl. the new + existing token/url tests (the EVENT_TYPES cross-suite floor habit: run the whole suite, not just the named gates).
- Signed-out on staging: `/` renders; `/m/<seeded-open-slug>` → placeholder (title + status), monochrome, **no auth redirect** (public-read holds); `/m/<unknown>` → 404; `/m/<draft-slug>` → 404 (OQ-2).
- Signed-in: header shows the pseudonym.
- shadcn primitives render monochrome (no green/red anywhere).
- `/api/health`: migrations head unaffected (**`0018`**); the pre-existing DEBATE.9-close `"drift"` must already be cleared (§0.1) so a clean status is attributable here.

## 12. Doc / ADR updates (closing ritual, same-commit as the code)

- `docs/design/design-language.md` §2 patch — the neutral ramp + side poles now have landed values (was "blank → CD"); cite SHELL/UI.0 + `globals.css` as the provenance.
- `AGENTS.md` §8 — drop "placeholder / do not consume until DESIGN.7"; describe the minted ramp. §3 — `(public)/` + `/m/[slug]` now exist (and the already-stale `comments/`-greenfield note can be truthed-up if cheap).
- `docs/adr/00NN-participant-shell-topology.md` — NEW lightweight ADR (OQ-6): the `(public)/` route group, the zero-new-provider posture, public-read via ADR-0019, the `/m/<slug>` URL contract (ADR-0016 §6).
- `CLAUDE.md` — expected **no change** (no invariant/contract shift); confirm at close.
- `claude-progress.md` — record the OQ-5 dev-smoke-page retarget as a maintenance-sweep cleanup candidate (gitignored scratch; never `git add` it).

## 13. Execute-phase ritual

1. This plan is already committed (Phase 1). Phase 2 (fresh chat) references it via `@docs/plans/SHELL-UI.0.md`.
2. Writer/reviewer pass on: `globals.css` token mint · `get-by-slug.ts` · `(public)/layout.tsx` + `m/[slug]/page.tsx` · the dev-smoke retarget · the shadcn adds · the two tests · the ADR + doc patches.
3. Pre-PR self-audit (§5.10) item-by-item against this plan (PASS / FAIL / SURPRISE).
4. `@code-reviewer` post-audit (the new `src/server/markets/get-by-slug.ts` + the `(public)` pages). **No `@security-auditor`.** `@db-migration-reviewer` **only if** a migration becomes unavoidable — **HALT + flag** if so.
5. Gates: `ZUGZWANG_ENV=preview just verify` + `pnpm vitest run` (full suite). Critical-path invariant suites are **not** triggered (no schema/bet/dharma/resolution change), but run the full suite per the cross-suite floor habit.
6. PR opens only after the self-audit is clean. Session log at `docs/logs/SHELL-UI.0.md` before `/clear`.
