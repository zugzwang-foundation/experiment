# ADR-0003 — Next.js 16 + App Router on the Experiment Stack

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-04 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.3 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The Zugzwang experiment-phase build runs from 2026-04-24 (build start) through 2026-09-15 (launch) to 2026-11-08 (conclusion at Devcon 8 / ETHGlobal Mumbai). The build is owned by one developer with two support devs and Claude Code; scope freezes at launch and the codebase reaches end-of-life at conclusion. There is no time, headcount, or appetite for a mid-build framework migration.

The product is a CPMM prediction market with mandatory commentary, a soulbound reputation token (Dharma), a debate-view ranking surface, and a K_eff dashboard. SPEC.1 surface mix is approximately:

- Server-rendered read surfaces (market list, market detail, debate view, K_eff dashboard, public profiles) — the majority of pages
- Authenticated mutation endpoints (place bet, sell, post comment, settle market) — each tightly coupled to a Postgres transaction
- A small set of public/external endpoints (OAuth callbacks, R2 upload signing, webhooks)
- One always-fresh dashboard surface (K_eff) suited to time-bounded server-side caching

SPEC.2 §1.4 #5 explicitly delegates "Next.js version / App Router config" to this ADR. SPEC.2 §3 (Reading Guide), §4 (System Context), §10 (Pre-commit moderation), and §16 (K_eff dashboard data flow) reference framework-level primitives — Server Components, Server Actions, `cacheLife({ revalidate, expire })`, Vercel runtime cache — without ratifying the framework choice from which those primitives originate. This ADR is that ratification.

This ADR does **not** decide:

- Hosting topology, regions, or cron infrastructure (ADR-0006)
- Authentication library (ADR-0004) or admin auth wiring (ADR-0010)
- Real-time pattern: SSE, polling, or `LISTEN/NOTIFY` (ADR-0007)
- ORM choice (ADR-0008) or Postgres schema (ADR-0005)
- Specific cache cadences or `cacheLife()` profile values (ADR-0007)
- Observability vendor configuration (ADR-0007)

## Decision Drivers

1. **Build-lifetime LTS alignment.** The build runs May 2026 → Nov 2026 with no scope flex post-launch. The framework chosen today must be on **Active LTS** for the entire build lifetime — receiving feature, performance, and security work — not on a Maintenance LTS branch frozen to critical fixes only.

2. **No mid-build major-version migration.** Scope freezes at 2026-09-15. A framework major upgrade between launch and 2026-11-08 conclusion is infeasible. The framework must carry through conclusion with no major version bump required.

3. **Single-developer + Claude Code workflow.** The framework's documentation footprint, ecosystem maturity, and tooling integration must be where Claude Code and broader agent training data align most cleanly. This compounds across every code-generation cycle for the next ~5 months.

4. **Concurrency contract compatibility (SPEC.2 §9, ADR-0013).** The bet handler runs as a single Postgres SERIALIZABLE transaction with `SELECT FOR UPDATE` and a 3× retry on SQLSTATE 40001. The framework's runtime selection model must support pinning these handlers to a Node.js runtime per-route, reliably.

5. **Read-freshness vs cache discipline.** Bet-flow read paths (positions, pending bets, debate-view ordering, current YES/NO price) MUST be uncached on read to preserve INV-* freshness. The K_eff dashboard, market list, and public profiles SHOULD be cached on a time-bounded basis. The framework's caching model must make these two regimes explicit and easy to enforce.

6. **Server-rendered-by-default cost model.** Per the surface mix above, >80% of page renders are read-heavy server-rendered surfaces. A framework defaulting to client-side rendering would invert the cost model and balloon hydration cost.

7. **First-party React 19 support.** React 19's `useActionState`, `useFormStatus`, ref-as-prop, and Server-Action model are part of the mutation contract this build commits to. The framework must ship and support them as first-party, not via a community shim.

## Considered Options

1. **Next.js 16 + App Router** ← chosen
2. Next.js 15 + App Router
3. Next.js 16 + Pages Router
4. Remix / React Router 7
5. SvelteKit / Nuxt / Astro

## Decision Outcome

**Chosen: Option 1 — Next.js 16 + App Router.**

This ADR ratifies six framework primitives as a single coherent unit, plus one hard runtime constraint that originates here.

### Six framework primitives

1. **Next.js 16.** Active LTS as of 2025-10-21; remains in Active LTS until Next.js 17 ships (cadence suggests ~2026-10-21); subsequently in Maintenance LTS until 2027-10-21.

2. **App Router** as the routing model. File-based routing under `src/app/`, Server Components by default, parallel/intercepting routes available where needed. Pages Router is not used.

3. **React 19.2** as the bundled React version. Server Components, Server Actions, `useActionState`, `useFormStatus`, ref-as-prop, the new `<form>` action handlers, and the React 19 hydration model.

4. **Server Actions** as the mutation contract. All server-side state mutations initiated from a UI surface go through a typed Server Action: zod-validated input, transactional body where the mutation touches multiple tables, idempotency-key compatible. External-facing endpoints (webhooks, OAuth callbacks, R2 upload signing) use `app/api/*/route.ts` route handlers under the same validation discipline.

5. **Turbopack** as the default bundler for both `pnpm dev` and `pnpm build`. Webpack remains available as a documented fallback via `next.config.ts` if a build-time dependency requires a Webpack-only plugin.

6. **Cache Components** (`cacheComponents: true` in `next.config.ts`). Data fetching is uncached by default. Cached scopes opt in explicitly with the `'use cache'` directive and `cacheLife({ revalidate, expire })` profile. The K_eff dashboard, market list, and public profile surfaces use this opt-in; bet-flow read paths do not.

### One hard runtime constraint (minted here, consumed downstream)

7. **Server Actions and route handlers under the following directories MUST run on the Node.js runtime, not the Edge runtime**:
   - `src/server/bets/`
   - `src/server/comments/`
   - `src/server/dharma/`
   - `src/server/resolution/`

   Files in these directories MUST NOT export `runtime = 'edge'`, and any page or route handler that imports from them MUST resolve to the Node.js runtime. Rationale: the bet handler holds a Postgres SERIALIZABLE transaction with `SELECT FOR UPDATE` (SPEC.2 §9, ADR-0013); the moderation guard sequences a 60-second Redis reservation around an external call (SPEC.2 §10, ADR-0014); the Dharma ledger and resolution paths consume the same transaction shape. Edge runtime's V8-isolate execution and connection pooling model do not reliably support these patterns.

   This constraint originates here because runtime selection is a framework configuration decision. ADR-0013 (concurrency) and ADR-0014 (pre-commit moderation) consume it; they do not redefine it.

   Routes outside these four directories MAY opt into Edge runtime per-route at the discretion of the implementing task (e.g. a public read-only profile endpoint with no Postgres-transaction body). This ADR does not forbid Edge runtime globally.

### Single-source-of-truth file map

Per SPEC.2 Appendix A discipline:

| Concern | Source-of-truth file |
|---|---|
| Framework configuration (cacheComponents flag, image domains, experimental flags, bundler config) | `next.config.ts` |
| PostCSS configuration bridging Tailwind v4 into Next.js | `postcss.config.mjs` |
| TypeScript compiler configuration | `tsconfig.json` |
| Framework version pin | `package.json` (`next`, `react`, `react-dom`) |
| Default runtime selection | root `app/layout.tsx` (no explicit `runtime` export = Node.js default) |
| Per-route runtime override | inline `export const runtime = '...'` in the affected `route.ts` / `page.tsx` |

`next.config.ts` is the single source of truth for framework-level configuration. No other file may set framework behavior.

## Consequences

### Positive

- **Active LTS for the entire build lifetime.** Next.js 16 stays in Active LTS until ~2026-10-21 — past launch, into the live window, ~2 weeks shy of conclusion. Next.js 17 likely ships ~2026-10-21; the build does not need to upgrade because the live window ends 2026-11-08 and the codebase archives at conclusion.
- **Cache Components matches the read-freshness model.** Uncached-by-default lines up with bet-flow read paths needing freshness; explicit `'use cache'` opt-in for the K_eff dashboard, market list, and public profiles is a precise control surface that SPEC.2 §16 already references in shape.
- **Server Actions reduce mutation surface area.** Mutations go through typed Server Actions with zod validation, not a parallel REST/RPC layer. One mutation contract for the codebase. Client components consume actions via `useActionState`, not via fetch + custom client cache.
- **Turbopack iteration speed.** Faster dev server and production builds compared to Webpack — material for solo-dev iteration cadence.
- **Stack documentation already aligned.** AGENTS.md §1, §5 and CLAUDE.md §10 decision log already document Next.js 16 + App Router as the assumed stack. This ADR ratifies what the stack assumed; no drift to clean up.
- **First-party React 19 support.** Server Components and Server Actions ship and are supported directly, not via community shims.
- **Single source of truth for framework config.** `next.config.ts` is the only place framework behavior is configured.

### Negative

- **Cache Components is a relatively young feature.** It is stable in Next.js 16 (the flag is no longer behind `experimental`), but the surface for `'use cache'` semantics, `cacheLife()` profiles, and tagging will likely keep evolving inside Next.js 16's Active LTS window. Patch-version regressions are plausible. Mitigated by pinning `next` to a known-good patch in `package.json` and testing upgrades in a feature branch.
- **Server Actions tie the mutation layer to Next.js.** Migrating off Next.js post-experiment would require rewriting the mutation layer. Acceptable: the experiment phase concludes 2026-11-08; the testnet phase is a fresh codebase per FOUND-3 / ADR-0002, with no requirement to carry mutation-layer code forward.
- **Edge runtime is partially forfeited.** Public read paths could in principle benefit from Edge runtime (lower latency, broader region coverage), but the codebase commits to Node.js runtime as the default to keep the bet-flow constraint clean and reduce per-route runtime-selection cognitive load. Per-route Edge opt-in remains available for non-critical-path read endpoints; the ADR does not forbid it outside the four named directories.
- **`params` and `searchParams` as Promises.** Next.js 15+ breaking change that propagates through every page and route handler signature. Already absorbed in AGENTS.md §5; no further migration work, but new contributors (or new agents) MUST internalize this on first read.
- **Turbopack ecosystem gaps.** Turbopack's plugin ecosystem is narrower than Webpack's. If a build-time dependency requires a Webpack plugin with no Turbopack equivalent, the codebase falls back to Webpack via `next.config.ts`. Tracked, not blocking. Adding such a dependency is an "ask first" event per AGENTS.md §10.
- **`'use cache'` cannot read cookies/headers inside the cached scope.** Auth-aware cached reads must read auth state outside the cache scope and pass user-scoped values in as arguments. Constrains how authenticated read pages are composed; absorbed into AGENTS.md §5 patterns.

### Neutral

- **Licensing.** Next.js (MIT) and React (MIT) impose no obligations on Zugzwang's AGPL-3.0 license.
- **Tailwind v4 + shadcn/ui new-york v4.** Both target Next.js 16 first-class; their PostCSS bridge is documented in AGENTS.md §7 and pinned by `postcss.config.mjs`.

## Pros and Cons of the Options

### Option 1 — Next.js 16 + App Router (chosen)

**Pros**

- Active LTS through ~2026-10-21 (covers full build + nearly the full live window); Maintenance LTS through 2027-10-21
- Cache Components, Turbopack default, React 19 first-party
- `cacheLife()` API matches SPEC.2 §16 references already drafted
- Smallest delta from current AGENTS.md / CLAUDE.md state — zero stack drift to clean up
- Server Actions provide a typed mutation contract aligned with the bet-flow transaction shape

**Cons**

- Framework lock-in for the experiment phase (acceptable given 2026-11-08 hard end and fresh testnet codebase)
- Cache Components surface is younger; more API churn likely within Next.js 16's Active LTS window than in older caching primitives

### Option 2 — Next.js 15 + App Router

**Pros**

- Same App Router shape; documentation footprint broader, more represented in agent training data
- More patterns and community tutorials for App Router edge cases

**Cons**

- **Maintenance LTS for the entire build lifetime.** Next.js 15 entered Maintenance LTS on 2025-10-21 (when 16 shipped). Starting a fresh codebase in May 2026 means starting 6+ months into Maintenance LTS and ending the live window 18 days before EOL on 2026-10-21. No feature work, only critical fixes, for the full build window. This is the wrong starting position for a fresh build.
- **No Cache Components.** The caching model is the older `unstable_cache` + per-fetch `revalidate` triple, harder to reason about and missing the explicit-opt-in default that SPEC.2 §16 already references. Adopting Next 15 would force SPEC.2 §16 to be rewritten.
- **React 18, not 19.** No first-party `useActionState`/`useFormStatus`; Server-Action ergonomics are weaker. The mutation contract becomes more verbose.
- Turbopack still opt-in, not default — slower iteration baseline.

**Verdict:** Rejected. Starting a fresh codebase on Maintenance LTS is the wrong starting position regardless of EOL-date arithmetic.

### Option 3 — Next.js 16 + Pages Router

**Pros**

- More mature router model with longer track record
- File-based API routes via `pages/api/*.ts` familiar to a wider developer pool

**Cons**

- **No Server Components.** Every page is a client-rendered React tree, inverting the cost model the read-heavy SPEC.1 surfaces depend on
- **No Server Actions.** Mutations require a parallel REST/RPC layer — net new contract surface, more code, more places for validation drift
- **No Cache Components.** Inconsistent with SPEC.2 §16 references already drafted
- Pages Router is on its own deprecation track inside Next.js; no new framework features land there

**Verdict:** Rejected. Surrenders most of what makes Next.js 16 the right pick.

### Option 4 — Remix / React Router 7

**Pros**

- Excellent server-rendering model
- Action / loader contract is conceptually comparable to Server Actions
- React 19 supported

**Cons**

- Smaller ecosystem; less first-class deployment integration on the targeted hosting (relevant for ADR-0006)
- Documentation footprint smaller in agent training data; Claude Code's effective output quality on Remix is materially below its quality on Next.js for a build of this complexity
- shadcn/ui new-york v4's first-class targeting is Next.js; Remix support exists but is second-class
- AGENTS.md, CLAUDE.md, and the current `src/app/` skeleton already assume Next.js — switching would require rewriting all stack documentation

**Verdict:** Rejected. Viable on architectural merits but pays a documentation-and-tooling penalty for marginal architectural gain, in a single-developer build with a hard 2026-11-08 deadline.

### Option 5 — SvelteKit / Nuxt / Astro

**Pros**

- Each is a strong server-first framework

**Cons**

- Non-React; requires writing the entire frontend in a different paradigm
- shadcn/ui is React-only (a hard dependency per AGENTS.md §7)
- Claude Code's React + Next.js performance is the strongest of any agent / framework combination relevant to this build; switching frameworks loses the compounding agent-quality advantage
- Stack documentation, solo-dev playbook, and the existing scaffold all assume React + Next.js

**Verdict:** Rejected. Unjustifiable for an experiment phase with a fixed 2026-11-08 end and a single non-technical product owner relying on agent-assisted code generation.

## Flow & invariant constraints absorbed

This ADR mints, consumes, or shapes the following items from SPEC.1 and SPEC.2. Future ADRs and SPEC.2 section authors MUST treat this table as a contract: changes to any row require a same-commit update to both this ADR and the cited section.

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | Next.js version / App Router config — ratified by this ADR |
| SPEC.2 §3 (stub) | Reading Guide | When drafted, MUST cite ADR-0003 as framework SST and list `src/server/{bets,comments,dharma,resolution}/` as Node.js-runtime-pinned directories |
| SPEC.2 §4 (stub) | System Context | When drafted, the runtime topology MUST name "Next.js 16 (App Router) on Node.js runtime" as the web tier. The diagram does NOT name a hosting vendor (that is ADR-0006's scope). |
| SPEC.2 §9 | Concurrency contract | The bet handler MUST run on Node.js runtime — minted here, consumed by ADR-0013 |
| SPEC.2 §10 | Pre-commit moderation | Server Action sequence (parse → Redis reserve → OpenAI moderate → DB transaction → Redis release) is implementable because Server Actions are the framework's mutation contract per this ADR. ADR-0014 owns the moderation substance. |
| SPEC.2 §16 | K_eff dashboard | `cacheLife({ revalidate, expire })` is callable because `cacheComponents: true` is set per this ADR. ADR-0007 owns the cadence values. |
| SPEC.2 §23 | ADR Index | Status of ADR-0003 flips from `provisional` to `accepted` on this commit |
| SPEC.1 INV-1 | Bet+comment atomicity | Implemented via Server Action wrapping `db.transaction(...)`. The Action shape comes from this ADR; the atomicity itself comes from the Postgres transaction (ADR-0013) |
| Tracker | SCAFFOLD.1, SCAFFOLD.2, every UI.* task, every ENGINE.* task that ships a Server Action or page | All depend on this ADR being `accepted` |

## More Information

- Next.js Support Policy: <https://nextjs.org/support-policy>
- Next.js 16 release announcement: <https://nextjs.org/blog/next-16> (2025-10-21)
- React 19 release notes: <https://react.dev/blog/2024/12/05/react-19>
- Vercel Cache Components documentation: <https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>
- AGENTS.md §1 (stack), §5 (Next.js 16 patterns), §7 (Tailwind v4 + shadcn bridge) — already aligned with this decision
- CLAUDE.md §10 decision log row "Framework" — cites this ADR
- SPEC.2 §1.4 #5 (delegation) and §23 (ADR Index)

---

*ADR-0003 ratifies the framework choice for the Zugzwang experiment phase. The decision body and the runtime constraint in §7 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
