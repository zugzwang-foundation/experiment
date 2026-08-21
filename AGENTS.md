# AGENTS.md

> Stack / framework patterns for the **Zugzwang Experiment** codebase. Follows the [agents.md](https://agents.md) open standard — a README for coding agents.
>
> **Claude Code reads this via the `@AGENTS.md` import at the top of `CLAUDE.md`** (Claude Code does not read `AGENTS.md` natively). This file is the *how* of writing code in this stack; `CLAUDE.md` is the *what cannot bend*.
>
> **Descriptive, not aspirational.** It documents the repo as it actually is at the current commit. Where it and a SPEC disagree, the SPEC is the *target* and this file is the *present reality* — see "Deliberate schema choices" below. Keep it accurate and lean; it loads in full every session alongside `CLAUDE.md`.

**Deliberate schema choices (read once).** The built schema is reconciled to the specs — the DEBATE.8/9 pre-fold catch-up is complete (`comments.stake_at_post_time` dropped at DEBATE.8, `friendly_fire_events` dropped at DEBATE.9). One apparent spec↔schema gap remains and is **intentional**: `comments.bet_id` is **deliberately nullable** — INV-1 is enforced by `bets.comment_id` NOT NULL + the W-1 atomic transaction; the comment↔`bets` pair only sets the `bets.comment_id` direction at write time (Bucket-A append-only forbids a later back-fill). It is **not** a pending NOT-NULL migration (ADR-0017 ranking reconciliation). This file describes what is *on disk now*; don't "correct" `comments.bet_id` to the spec.

---

## 1. Stack (live versions — from `package.json`)

- **Runtime:** Node 24 (`mise.toml`). CI pins via `.nvmrc` (pinned to 24).
- **Framework:** Next.js `16.2.4`, App Router, React `19.2.4`, TypeScript strict.
- **DB:** Postgres 17 on Supabase (ap-south-1, session pooler). Drizzle ORM `0.45`, `drizzle-kit 0.30`, `drizzle-zod 0.7`.
- **Auth:** Better Auth `1.6.11` (Google OAuth + email-OTP via Resend + Cloudflare Turnstile). See §H/§7.
- **Styling:** Tailwind v4 (CSS-first via `@theme`) + shadcn (`shadcn 4.7`, `radix-ui 1.4`, `tw-animate-css`).
- **Storage:** Cloudflare R2 via `@aws-sdk/client-s3 3.1045` + `s3-request-presigner`.
- **Cache / limits:** Upstash Redis (`@upstash/redis 1.38`, `@upstash/ratelimit 2.0.8`).
- **Moderation:** OpenAI omni-moderation (`openai 6.39`).
- **Email:** Resend `6.12`. **Canonical JSON:** `canonicalize 3.0`. **IDs:** `uuid 11`. **Validation:** `zod 3.25`.
- **Observability:** Sentry (`@sentry/nextjs 10.53`) + PostHog (`posthog-js 1.376`, `posthog-node 5.35`). Two-vendor. **No Axiom.**
- **Tooling:** `pnpm 10.33.2` (the `packageManager` field), Biome `2.4.13`, Lefthook `2.1.6`, `just`, `tsx 4.22`, Vitest `3`, fast-check `4.8.0`.
- **Build-script approval:** `package.json` → `pnpm.onlyBuiltDependencies` (`esbuild`, `lefthook`, `sharp`). *(Not a `pnpm-workspace.yaml` allow-list.)*
- **Not installed yet:** Playwright / any E2E runner; `commitlint`.

---

## 2. Setup & commands (the real `justfile`)

`just` is the task entry point; `set dotenv-load := true` sources `.env.local` for every recipe.

```bash
just setup            # mise install; pnpm install; lefthook install
just dev              # next dev
just build            # next build
just typecheck        # pnpm tsc --noEmit
just check            # biome check .          (LINT/FORMAT ONLY — not the full gate)
just format           # biome check --write .
just verify           # typecheck → check → build   (the pre-claim gate; DOES build; runs NO tests)
just clean            # rm -rf .next/ .turbo/ tsconfig.tsbuildinfo
just db-generate name # drizzle-kit generate --name <name>
just db-migrate       # drizzle-kit migrate
just db-reset         # supabase db reset
just test-db          # vitest run tests/db/ tests/invariants/
just test-scale       # pnpm test:scale — the ENGINE.10 Q-2 battery (opt-in, own config)
```

Test scripts (in `package.json`): `pnpm test:invariants` (`vitest run tests/invariants/`), `pnpm test:integration` (`vitest run tests/integration/`), `pnpm test:scale` (opt-in, its own config), plus identity-pool seed/verify and staging migrate/seed/smoke scripts. There is **no `just db:up`** and **no all-in-one test recipe** — run `just test-db` and the `pnpm test:*` scripts as needed.

**Staging operational scripts** — these point at the LIVE staging database and are **not tests** (§9, ADR-0036): `pnpm staging:reset` (guarded truncate, then re-seeds `identity_pool`) · `pnpm staging:generate` (the engine-driven fixture generator) · `pnpm staging:gates` (the six verification gates) · **`pnpm staging:rebuild`** (the composite: reset → seed → generate → gates). Each wraps `vitest.staging.config.ts` in `doppler run --config stg`; the write-capable ones additionally require an intent token in the environment.

**Before claiming a change is done:** `just verify`. Critical-path work additionally runs the test suites above (CLAUDE.md §5.7).

**`just verify` build env:** `next build` (and therefore bare `just verify`) requires `ZUGZWANG_ENV=preview` — the `getRedisKey` build-env gate rejects `"unknown"`, failing `/admin/login` page-data collection. Run `ZUGZWANG_ENV=preview just verify`; env-only, not a regression.

---

## 3. Project structure (the real tree)

```
experiment/
├── CLAUDE.md, AGENTS.md            # contract + stack patterns (CLAUDE.md imports @AGENTS.md)
├── .claude/agents/                 # 4 subagent briefings (tracked); settings.local.json is gitignored
├── .github/workflows/              # ci.yml (the PR gate) + env-audit.yml + staging-migrate.yml (D2)
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (admin)/admin/          # login (separate from Better Auth) + markets, markets/new, markets/[marketId] (ENGINE.15 market-admin pages) + markets/media/sign route (MEDIA.1) + moderation/audit page
│   │   ├── (auth)/                 # onboarding, sign-in, sign-in/otp
│   │   ├── (public)/               # the participant surface — layout.tsx + not-found.tsx (shell, SHELL/UI.0)
│   │   │                           #   page.tsx                     — DISCOVERY, the market list (UI-A4). LIVE.
│   │   │                           #   m/[slug]/page.tsx            — the debate view
│   │   │                           #   m/[slug]/error.tsx           — the debate route error boundary
│   │   │                           #   m/[slug]/export/route.ts     — debate .md export (ADR-0025)
│   │   │                           #   m/[slug]/quote/route.ts      — CPMM quote read (UI-A2)
│   │   │                           #   u/[pseudonym]/{page,loading,error}.tsx — PROFILE (UI-A5)
│   │   │                           #   bookmarks/{page,loading,error}.tsx     — BOOKMARKS (UI-A6, ADR-0032)
│   │   ├── api/                    # _smoke-error, auth/[...all], bets/{place,sell}, cron/{r2-orphan-sweep,close-due-markets,alarms-drain}, health, uploads/sign, visits
│   │   ├── globals.css, layout.tsx, page.tsx
│   ├── components/                 # bookmarks/ debate/ discovery/ profile/ shell/ ui/
│   │                               #   debate/ gained five components at HTML-FINISH ·
│   │                               #   MARKET DETAIL: HeadZone (the arm-scoped two-column
│   │                               #   header frame), MarketMediaPanel, FocusMarketCard
│   │                               #   (the post arm's rail — and the EXIT), ResolverCards
│   │                               #   (the resolver + X-official PLACEHOLDER cards —
│   │                               #   it rendered `null` until round 2's R2 reversed
│   │                               #   OD-2; see docs/parked.md SEQUENCE #5, strip or
│   │                               #   gate before the DP.2 promote), ScrollRail (the
│   │                               #   rail — and, since R3, the auto-advance countdown)
│   │   └── ui/                     #   13 files, and they are NOT all shadcn. NINE shadcn
│   │                               #   primitives: avatar, badge, button, card, dialog,
│   │                               #   input, separator, skeleton, textarea. FOUR are
│   │                               #   project-authored and canon-ratified — empty-block
│   │                               #   (P1), loading-block (P7), error-block (the
│   │                               #   route-boundary family; canon §10 C-STATES-1 rules
│   │                               #   it NEITHER P1 NOR P7), thumb-glyph (canon §3
│   │                               #   item 13, pinned by component name and props).
│   │                               #   Don't reach for a shadcn generator to change one
│   ├── db/                         # ← Drizzle client + schema live HERE (not src/server/db)
│   │   ├── index.ts                #   the drizzle client
│   │   └── schema/                 #   13 files: _enums, audit, auth, bets, bookmarks, comments,
│   │                               #   dharma, events, identity, image-uploads, index, markets, system
│   ├── lib/                        # auth-client, errors, utils, ranking{,.config,-decimal}, posthog/
│   └── server/                     # server-side business logic — 26 dirs
│       ├── admin/                  # actor (assertAdminActor — the R-14.5 belt; ENGINE.14)
│       ├── auth/                   # index, email-otp, session-gate, onboarding-ref, tos-*, logout
│       │   └── admin/              # login, logout, validate (admin path)
│       ├── bets/ bookmarks/ comments/ config/ cpmm/ debate-export/ debate-view/ dharma/ events/ health/ idempotency/ identity-pool/
│       ├── discovery/              # ← list.ts is the Discovery read model. THE PERF-1 SURFACE (docs/parked.md, GO-LIVE BLOCKER)
│       ├── markets/                # transitions, errors + ENGINE.14: transaction (W-4), create, open, close (incl. the closeDueMarkets sweep)
│       ├── middleware/ moderation/ observability/ positions/ profile/ resolution/ storage/ system/ upstash/ visitors/
├── tests/                          # dedicated dir (NOT colocated) — see §9
├── docs/{adr,specs,logs,plans,…}
├── drizzle/migrations/             # generated + hand-written; append-only — DO NOT EDIT
├── scripts/                        # tsx operational scripts (seed, verify, migrate-staging, smoke)
├── supabase/                       # branch/snippet scratch only — NO migrations dir (RLS out of scope, ADR-0019)
├── biome.json, drizzle.config.ts, lefthook.yml, mise.toml, justfile,
├── next.config.ts, postcss.config.mjs, tsconfig.json, vitest.config.ts, vitest.scale.config.ts,
│   vitest.staging.config.ts, vercel.json
└── instrumentation.ts, instrumentation-client.ts, sentry.{server,edge}.config.ts, proxy.ts
```

**Greenfield — implied by the specs but NOT yet on disk: none.** The `src/app/(public)/` participant route group is **built, not pending**, and every surface under it is live:

| Surface | Route | Read model | Landed |
|---|---|---|---|
| **Discovery** (the market list) | `(public)/page.tsx` | `src/server/discovery/list.ts` | UI-A4 |
| Debate view | `(public)/m/[slug]/page.tsx` | `src/server/debate-view/` | DEBATE.4 · ADR-0034 |
| Profile | `(public)/u/[pseudonym]/page.tsx` | `src/server/profile/` | UI-A5 |
| Bookmarks | `(public)/bookmarks/page.tsx` | `src/server/bookmarks/` | UI-A6 · ADR-0032 |

> ⚠ **Discovery is built and PERF-1 is CLOSED.** The surface served in ~35 s because Vercel
> functions ran in `iad1` against a Mumbai database — ADR-0006 ratified `bom1` and it had
> never been applied. Fixed 2026-08-10 (#307, #308): **361.6 → 5.34 ms per round trip,
> Discovery 35.07 → 0.692 s p50**, staging-verified. There is no go-live blocker row left in
> `docs/parked.md`. ⚠ **The fix is on `main` and on `staging`; it is NOT on what the
> production alias serves** — `zugzwangworld.com` is pinned to a 2026-07-02 build and
> reports `region: None`. That is a DP.2 promote, not a Discovery defect.

The former `src/server/identity/` entry was reconciled away at AUDIT-FIX-A22 (SPEC.2 §3.5/§3-SSOT/Appendix A now name the built `identity-pool/consume.ts` path; nothing implies a separate `identity/` dir anymore). (`src/server/{bets,cpmm,dharma,markets,positions}/` landed across ENGINE.2–12; `src/server/resolution/` — the W-3 trio + F-ADMIN-3 trigger — landed at ENGINE.9; `src/server/markets/{transaction,create,open,close}.ts` — W-4 + the lifecycle flows — and `src/server/admin/actor.ts` landed at ENGINE.14; `src/server/markets/get-by-slug.ts` — the public slug resolver — landed at SHELL/UI.0.)

Server-side logic lives under `src/server/`. **Never import from `src/server/**` into a client (`"use client"`) component** — Next.js will catch it, but catch it in review first. The schema/client live at `src/db/` (path alias `@/db`), confirmed by `drizzle.config.ts` (`schema: "./src/db/schema"`).

---

## 4. TypeScript conventions

- `tsconfig.json` sets `"strict": true`. `target` ES2017, `moduleResolution: "bundler"`, path alias `@/* → ./src/*`. **Note:** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are **not currently set** — do not rely on them; enabling them is a candidate hardening (raise before assuming).
- **No `any`.** Reach for `unknown` + a type guard instead.
- **No `as` casts** except at trust boundaries (parsed form input, third-party responses); pair each with a zod validation or an explicit comment.
- **Named exports** except where Next.js requires default (`page/layout/error/loading/not-found.tsx`, route handlers). *(Not Biome-enforced today — convention.)*
- **`type`** for unions/shapes; **`interface`** for extensible cross-module objects. **String-literal unions over enums** in TS (`type Side = "YES" | "NO"`).
- **Errors:** custom classes in `src/lib/errors.ts` with a discriminated `kind`. Never throw plain strings.
- **Imports:** absolute via `@/...`, not deep relative paths.

**Naming.** Files: `kebab-case.ts` for utilities/server modules/route folders; `PascalCase.tsx` for components. Functions `camelCase`, types `PascalCase`, true global constants `UPPER_SNAKE_CASE`. Tests: see §9. **Formatting is Biome:** tab indent, double quotes, default line width 80 (not pinned — see §10).

---

## 5. Next.js 16 patterns

**Server vs client.** Server Components by default. Add `"use client"` only for hooks, event handlers, browser APIs, or client-only libraries. Pass server-fetched data down as props; keep the client boundary near the leaf.

**Server Actions (mutations).** Every action validates input with zod — no naked form data into the DB. Every multi-write action runs inside `db.transaction(...)` (§6). Example shape:

```ts
"use server";
import { z } from "zod";
import { db } from "@/db";

const placeBetSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["YES", "NO"]),
  stake: z.coerce.number().positive(),
});
// validate → run externals (e.g. moderation) → db.transaction(bet + comment) → revalidate
```

**Route handlers** (`app/api/*/route.ts`) — external-facing endpoints (auth callback, bets place/sell, uploads, health, cron — incl. `cron/close-due-markets`). Same zod + auth rules.

**Admin Route Handlers live under `src/app/(admin)/admin/...`** (URL `/admin/...`), **NEVER** `/api/admin/...` — the admin session cookie is scoped `Path=/admin`, so a handler under `/api/admin/...` never receives it and 401s the real admin. (Participant routes may live under `/api/...` because the participant cookie is `Path=/`.) Verified by MEDIA.1: the planned `/api/admin/markets/media/sign` was relocated to `/admin/markets/media/sign` for exactly this reason — a `cookies()` mock had masked the failure in the unit layer.

**Caching.** `next.config.ts` is currently a Sentry wrapper + env injection only — **`cacheComponents` is NOT enabled** and no Turbopack flags are set. If `cacheComponents` is turned on later, fetches become uncached by default and you mark scopes with `'use cache'`, reading cookies/headers *outside* cached scopes. Until then, standard Next 16 caching applies.

**`params` / `searchParams` are Promises** (Next 15+). `const { id } = await params;`.

---

## 6. Database — Drizzle + Postgres

### Schema conventions

- **PKs:** UUIDv7 — `uuid("id").primaryKey().default(sql\`uuidv7()\`)`. The userspace `public.uuidv7()` function ships in **`drizzle/migrations/0000_uuidv7_function.sql`**.
- **Timestamps:** `timestamp("…", { withTimezone: true })` everywhere.
- **Money / Dharma:** `numeric("…", { precision: 38, scale: 18 })`.
- **Enums:** `pgEnum`. `side` is `["YES","NO"]`, extracted to `src/db/schema/_enums.ts` to break the `bets ↔ comments` runtime-eval cycle. `dharma_entry_type` (column `entry_type`, **not** "reason") has 10 values: `bet_stake, bet_payout, daily_allowance, pool_seed, pool_unwind, correction_reverse, correction_apply, void_refund, uncollectable, initial_grant` (`initial_grant` appended by ENGINE.5 / R-1; `pool_seed`/`pool_unwind` dormant in v1, R-2).
- **Indexes** inline in the second `pgTable` arg. **FKs** always declared and indexed on the referencing side; circular pairs use the lambda form `(): AnyPgColumn => other.id`.
- **One file may hold several related tables.** 23 tables live across 11 files — e.g. `bets.ts` (bets + positions + bet_receipts), `events.ts` (events + resolution_events + payout_events), `markets.ts` (markets + pools + market_media).

### Reply-as-bet schema reality

- `bets.comment_id` — **`NOT NULL`**, FK to `comments.id` (the built half of INV-1). Indexed.
- `comments.bet_id` — **EXISTS but NULLABLE by design**; INV-1 is enforced via `bets.comment_id` NOT NULL + the W-1 atomic transaction, not via `comments.bet_id` (the circular pair sets only the `bets.comment_id` direction at write time; Bucket-A append-only forbids a later back-fill) — **not** a pending NOT-NULL migration (ADR-0017 ranking reconciliation, DEBATE.8). Indexed (`comments_bet_id_idx`, migration 0008).

### Append-only buckets

- **Bucket A — fully append-only** (10 tables: events, dharma_ledger, bets, comments, resolution_events, payout_events, mod_actions, admin_events, user_events, bet_receipts). Protected by `0003_append_only_triggers.sql` (row-level UPDATE/DELETE) + `0021`/`0022` (statement-level TRUNCATE, ADR-0030); `bet_receipts` (AUDIT-FIX-B3 / ADR-0031) ships all three guards in `0022` reusing the shared functions. Reject UPDATE/DELETE/TRUNCATE at the storage layer.
- **Bucket B — append-only with whitelisted column transition(s)** (3 tables: identity-pool, image-uploads, system-state). Each permits a one-shot `NULL→timestamp` transition on a whitelisted column — e.g. `system_state.frozen_at` flips once then is immutable (`image_uploads` transitions `terminal_state` + `terminal_at` together). All other column changes, every DELETE, and every TRUNCATE are rejected at the storage layer (TRUNCATE statement-level, ADR-0030).
- **Bucket C — mutable** (e.g. `positions`).

### Migrations (`drizzle/migrations/`)

- Generated via `just db-generate <name>`; **append-only — never edit a committed migration, write a new one.** Destructive migrations need PR sign-off + a backup snapshot first.
- The `events` table partitioning is **hand-written** (`PARTITION BY RANGE`) in `0002_events_partitioning.sql` and **excluded from drizzle-kit** via `drizzle.config.ts` → `tablesFilter: ["!events"]`.
- pg_cron-coupled migrations (`0007_pg_cron_jobs.sql`, `0011_position_drift_pg_cron.sql`) carry `cron.schedule()` (and `0007` the `CREATE EXTENSION pg_cron`); CI strips those statements from every `*pg_cron*.sql` before applying (the CI runner has no pg_cron).
- Current head: `0024_bookmarks` (0016 = `mod_actions.reason` for the reactive-moderation foundation, PR #143; 0017 = drop `comments.stake_at_post_time` (DEBATE.8); 0018 = drop `friendly_fire_events` (DEBATE.9); 0019 = `market_media` (MEDIA.1); 0020 = `dharma_ledger.seq` total-order (AUDIT-FIX-B2 / ADR-0029); 0021 = TRUNCATE guards (AUDIT-FIX-B2 / ADR-0030); 0022 = `bet_receipts` durable idempotency receipts + same-file Bucket-A guards (AUDIT-FIX-B3 / ADR-0031); 0023 = `positions_market_id_idx` W-3 settle-read + FK-convention index (AUDIT-FIX-B7b / A31); 0024 = `bookmarks` (UI-A6 / ADR-0032, PR #254)).

### Transactions, queries, validation

- **Any multi-write user action runs in `db.transaction(...)`.** Bet placement is `SERIALIZABLE` + `SELECT … FOR NO KEY UPDATE` on the pool row with full-jitter retry on `40001/40P01` (ADR-0013) — landed at ENGINE.7/8 (W-1 `src/server/bets/transaction.ts` + `endpoint.ts`); the market-lifecycle W-4 (`src/server/markets/transaction.ts`) and resolution W-3 (`src/server/resolution/transaction.ts`) wrappers mirror the same retry spine.
- Drizzle query builder for typed reads; raw `sql<T>` only for hot paths. Avoid N+1 (`db.query.<t>.findMany({ with })`). Don't `SELECT *` in hot paths. Don't expose Drizzle row types in API responses — map to DTOs in the server layer.
- **`drizzle-zod`** (`createInsertSchema` / `createSelectSchema`) derives zod schemas from tables — one source of truth for shape.

### Events

`events.event_type` is **`text`** (open-extensibility, SPEC.2 §7.1), **not** a `pgEnum`. The closed value set is the TS const `EVENT_TYPES` in `src/server/events/schemas.ts` (currently 24 values: 4 `image_upload.*`, 5 `user.*`, 2 `admin.*`, 7 `market.*`, 2 `bet.*`, 1 `comment.*`, 2 `dharma.*`, 1 `moderation.*` — `moderation.blocked`, AUDIT-FIX-B5), compile-guarded by `as const satisfies Record<EventType, …>`. When a new event type is added, extend `EVENT_TYPES` **and** its Zod payload schema in the **same commit** (enum-hygiene).

---

## 7. Server stack — `server-only`, middleware, handlers

- Files under `src/server/**` that touch the DB or secrets import `server-only`. **Scripts run under `tsx` must not delegate into the `@/db` → `server-only` chain** — inline their own `postgres()` client (the staging-seed/smoke pattern).
- **Structured logging** via the `src/server/middleware/logging.ts` logger — no `console.log` in server code (a convention today, *not* a Biome rule; `console.error` does appear in auth). No request bodies in logs.
- Middleware: `logging`, `origin-allowlist`, `rate-limit`, `envelope` (the §4.4 wire helpers for non-bet Route Handlers — attributed duplication of the bets-private copies, AUDIT-FIX-B7b A29; unification rides ENGINE.8 Q4). Idempotency store + lock in `idempotency/` + `upstash/`. Moderation is `moderation/precommit.ts` (OpenAI **before** the bet tx, guarded by a Redis SETNX reservation; fail-closed on terminal — ADR-0014). Rate-limit fails **open**; idempotency fails **closed** (ADR-0015).
- **Better Auth custom `users` columns:** the drizzle adapter persists only fields in Better Auth's user model (6 core + `user.additionalFields`). Any custom `users` column written through a `databaseHook`/`mapProfileToUser` **must** be declared in `user.additionalFields` (`type:"string"`, `required:false`, `input:false` for server-only/identity fields) or it is silently stripped before INSERT — the cause of the `unable_to_create_user`/`23502` null-`pseudonym` signup bug (FIX-AUTH-SIGNUP). `input:false` also blocks client identity-spoofing at `parseInputData`.
- **Better Auth `session.expiresIn` → cookie `Max-Age` 400-day ceiling:** `expiresIn` is fed straight into the session-cookie `maxAge` by Better Auth's `setSessionCookie`, and the better-call cookie serializer **throws** when `maxAge > 34,560,000 s` (400 days). The throw fires at **cookie-serialization time on sign-in, not at token creation**, surfacing as an uncaught 500 for onboarded/returning users (first-time signup is deferred by the `session.create.before` onboarding gate, which masks it). Cap `expiresIn` at `SESSION_MAX_AGE_SEC = 60*60*24*400`; modern browsers (Chrome 104+) clamp `Max-Age`/`Expires` to the same 400-day ceiling regardless (FIX-AUTH-LOGIN / ADR-0004 Patch P1; SPEC.2 §8.2).
- **`nextCookies()` (from `better-auth/next-js`) MUST be the last entry in `plugins:`** — Better Auth's own runtime warns otherwise. It's what lets an `auth.api.*` call made from a Server Action (not a route handler) actually set a cookie the browser receives: its `after` hook replays any Set-Cookie the call produced onto `next/headers`'s `cookies()`, since a bare programmatic `auth.api.*` call has no HTTP response of its own to carry one. ADR-0004's Flow-constraints table named this pattern and routed it here; landed at AUTH-DBL-1, the first caller (`src/server/auth/tos-accept.ts`'s `acceptTosAction`) that needed it wired in. For an endpoint that must stay in-process-only (never reachable over HTTP), give its `createAuthEndpoint(...)` options `metadata: { SERVER_ONLY: true }` — better-call excludes it from the router's route table entirely (not just a request-time 404), so `auth.api.<name>(...)` still works while `POST /api/auth/<path>` 404s. Stronger than a `disabledPaths` denylist, which is a separate request-time string match that can diverge from the router's own path-matching.

---

## 8. Frontend — Tailwind v4 + shadcn

- **CSS-first config** in `src/app/globals.css`: `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`, then `@custom-variant dark`. **`postcss.config.mjs`** loads `@tailwindcss/postcss` (Next.js needs it).
- **Hex authoritative in `@theme`** (BRIDGE / OQ-2): colour tokens land as 6-digit **lowercase** hex (Biome's CSS formatter normalizes case — uppercase is a format error); **oklch may appear in comments only**. The census achromatic rule is **R == G == B** on the hex. Defining `--color-yes` auto-generates `bg-yes`, `text-yes`, etc. *(Supersedes the SHELL/UI.0-era "OKLCH only" rule.)*
- **Tokens are BRANDED (dark, values-log v0_3 §3).** The `@theme` block in `globals.css` carries the branded dark system landed at BRIDGE onto the frozen contract slots: page ground `--color-ground` `#181818` (generates `bg-ground`; outside the 11-token census), the true-neutral ramp `--color-n0 … --color-n7` + `--color-ink` — achromatic, running **dark → bright** (`n0 #212121` darkest card surface … `n7 #e4e4e4` brightest emphasis, `ink #fafafa`; **inverted vs the retired light ramp — never copy by lightness**) — and the side poles `--color-yes` = `#181818` (YES side = black) / `--color-no` = `#fafafa` (NO side = white). The poles name the **SIDE** (YES/NO), never the Support/Counter relation. Single dark theme lives in `:root`/`@theme`; the `.dark` block is **descoped-inert** (never applied; its two chromatic strays neutralized). `--destructive` is neutralized to `var(--color-n6)`. The shadcn semantic `:root` slots alias the same primitives via `var()` chains (tier-2; `--sidebar-*` mirrors its `--X` — OQ-8). The raw-props `:root` block adds the applied-semantic / state / elevation / radius tokens (`--surface-*`, `--text-*`, `--graph-yes/no`, `--state-*` ×8, `--elev-0..3`, `--r`/`--r-chip`/`--r-dot`, `--avatar-ring`, `--dur-hover`, `--overlay`, `--btn-fill`, `--border-strong`). No accent: nothing named `--color-brand` exists (true-neutral ratified; contract §2.2 stays reserved-empty). `--font-sans/mono` → Geist, **ratified FINAL** (WI-13; Lucide FINAL alongside). `--imgr` is **ratified** (6px — images, avatars, media, graph panels; values-log §3 item 2). Guarded by `tests/unit/design/tokens-monochrome.test.ts` — exact hex pins, 11-count census, ground/graph/destructive pins, string bans.
- **An arbitrary `text-[Npx]` does NOT reset the paired line-height, and `leading-normal` is NOT the CSS `normal` keyword.** Two traps, one line, both measured on staging at PROFILE-FULL. (a) Every Tailwind `text-*` step ships a line-height with it, and the arbitrary-value form inherits whatever step was in scope — so `text-[8px]` kept `text-xs`'s **16px** leading and `text-[14px]` kept `text-sm`'s **20px**. State the leading whenever you state an arbitrary size. (b) `leading-normal` is `line-height: 1.5`; the CSS `normal` KEYWORD resolves to ~1.2 from the font's own metrics. A mockup that leaves `line-height` unset is at 1.2, so *"take the mockup's leading"* is **`leading-[1.2]`**, never `leading-normal` — reaching for the class whose name matches the keyword put every tile 10px tall and every control a line too tall, and nothing errored. *(Measured: tile 68 → 58, pseudonym 30 → 24, buttons 38 → 35, chips 26 → 23 — each landing on the mockup's figure exactly.)*
- **`table-fixed` is what makes a `<th>` width BIND.** Without it a width is a hint the auto table layout may overrule from cell content — measured: a `w-[118px]` Current column rendered at **86px** and broke a Đ figure mid-value. ⚠ And `table-fixed` contains the substring `fixed`: a source scan for document-level overlays written as `/\bfixed\b/` over a whole class string matches it (`-` is a word boundary) and reports a `<table>` as a positioned layer. Match a class TOKEN — `(^|:)fixed$` — as `tests/unit/shell/sticky-header.test.ts` now does.
- shadcn primitives carry `data-slot`; use the current variant, don't mix older styles. **No toast library is installed** — `sonner` is in neither `package.json` nor `src/`. (Through 2026-08-08 this line said "`Sonner` for toasts", which was an instruction to reach for an uninstalled dependency, against §11's *ask first* on adding one. Corrected at SYNC-1; adding a toast library remains a §11 ask-first decision, not a default.)
- **Accessibility:** `aria-label` on icon-only buttons and YES/NO toggles; Tab-reachable; focus-trap via shadcn `Dialog`; `aria-live="polite"` for price/status; pair colour with icon/text. *(No axe/Playwright accessibility project is installed yet — manual review for now.)*

---

## 9. Testing — Vitest (no Playwright yet)

**Vitest is the only runner installed.** No Playwright, no `tests/e2e/`. Real layout under a dedicated `tests/` dir (not colocated):

```
tests/
├── _setup/        env.ts, server-only-shim.ts
├── db/            _fixtures/, identity-pool/, indexes/ (positions-market-id pg_indexes assert — the catalog-assertion mint, AUDIT-FIX-B7b), triggers/ (13 append-only specs, one per protected table — +bet-receipts-append-only, AUDIT-FIX-B3 — plus truncate-rejected.spec)
├── integration/   30 *.integration.test.ts (admin-moderation-audit-feed, alarms-drain, composer-image,
│                  composer-place, composer-reply, composer-sell, debate-export, dharma-chain-drift-drain,
│                  dharma-ledger, email-otp-send, header-balance, header-portfolio, idempotency-cache — the
│                  former idempotency suite, renamed — market-by-slug, market-quote, migration-drift,
│                  nightly-drift-resolution, onboarded-login-session, orphan-sweep, positions, post-param,
│                  precommit-moderate, rate-limit, resolution-conservation, sign-read, sign-upload,
│                  signup-create-path, staging-reset-mechanism, upstash-lock, viewer-context)
├── invariants/    10 specs — see the Invariant-tests bullet below
├── scale/         8 *.scale.test.ts (the ENGINE.10 Q-2 correctness-at-scale battery) + _fixtures/, _harness/ — opt-in only, see the Scale bullet below
├── staging/       OPERATIONAL RUNNERS, not tests — THREE runners (reset.staging.test.ts · generate.staging.test.ts · gates.staging.test.ts) + fixtures.ts (the literal fixture table) + _lib/ (target, client, read-client, write-guard, guards, reset, coverage, captured-identities). ADR-0035/0036, STAGING-PARITY Slices A–D. Points at the LIVE staging DB; opt-in only, see the Operational-runners bullet below
├── server/        auth/ (incl. _probe-* + admin-login-result + email-otp-from-guard, AUDIT-FIX-B7b), bets/ (atomicity, concurrency, daily-credit, events-idempotency, idempotency-replay, moderation-outside-transaction, sell, subsequent-buy, validation + AUDIT-FIX-B3: sell-oversell, place-replay-durable, sell-replay-durable, release-failure, double-sell-chain), cron/ (close-due-markets — ENGINE.15, the first route-handler test convention), events/, identity/, middleware/, moderation/, resolution/ (happy-path, pro-rata, correction, void, concurrency, actor-assert), storage/ (incl. sign-route-envelope, AUDIT-FIX-B7b), admin/ (moderation/ + markets, pool-seed, resolution — each carries its ENGINE.15 wire-action blocks; + markets-media-sign-envelope, AUDIT-FIX-B7b), dharma/ (non-transferable)
└── unit/          body-fingerprint, rate-limit-prefix, upstash-keys, upstash-redis-config (AUDIT-FIX-B7a — the A14 transport-bound config pins), idempotency-release (AUDIT-FIX-B3), bets/ (errors, floors, wire-envelope), cpmm/ (calculate + validate + vectors.test.ts + *.property.test.ts + _arbitraries.ts), markets/ (transitions.test.ts), positions/ (compute.test.ts), resolution/ (basis + basis.property), dharma/ (accrual, canonical, _probe-decimal-negzero, ledger, conservation, conservation-correction), staging/ (8 files — the guards that constrain the tests/staging/ runners WITHOUT touching a database: generator-no-direct-writes incl. the import allowlist, write-guard, runner-target, runner-gating, runner-isolation, reset-guard, guard-list-parity, fixture-table), design/ (**FOUR height chains** — discovery, profile, bookmarks, and `debate-height-chain.test.ts` added at HTML-FINISH · MARKET DETAIL; all four are SOURCE SCANS, because jsdom performs no layout)
```

- **Unit** (no IO): pure functions in `src/lib/` and `src/server/<domain>/`. Happy path + ≥2 edges + the relevant invariant.
- **Component / render** (jsdom, no IO): `jsdom` + `@testing-library/react`, enabled **per file** by a `// @vitest-environment jsdom` docblock on line 1 — **75** `*.test.tsx` files, mostly under `tests/unit/**/render/` plus `tests/server/admin/*.component.test.tsx`. **There is no `jest-dom`**, so `toBeInTheDocument()` / `toBeDisabled()` and that whole matcher set are UNAVAILABLE — assert against plain DOM (`getAttribute`, `textContent`, `querySelector`). Fake timers + `act()` for interval/effect behaviour; page visibility is exercised by stubbing `document.hidden` and dispatching `visibilitychange` (F-DEBATE-4). *Recorded at F-DEBATE-4 because this harness has existed since UI.0 and §9 never named it, so successive plans inherited a false "the UI cannot be tested" premise.*
  - ⚠ **AN OUTSIDE-CLICK ASSERTION MUST YIELD TO THE TASK QUEUE BEFORE IT FIRES.** Radix's `DismissableLayer` arms its `pointerdown` listener inside a **`setTimeout(…, 0)`**, so a pointer event dispatched synchronously after `render()` reaches **no listener at all**. Make the test `async` and `await new Promise((r) => setTimeout(r, 0))` first. ⛔ **The failure mode is a false GREEN, not a red:** a *"the backdrop does NOT dismiss this"* assertion written without the yield passes against a listener that was never armed, certifying a guard it never exercised. **Always pair it with the opposite assertion in the dismissible context** — that control is the only thing proving the mechanism fires at all. Escape is unaffected and works synchronously (`fireEvent.keyDown(document, { key: "Escape" })`). *Minted at O1-DECK, where the paired control went red on the first run; without it the non-dismissible guard would have shipped green and empty.*
- **Integration** (real test Postgres): any service-layer function that writes. Mandatory scenarios as the ENGINE lands — bet atomicity, Dharma reconciliation, side-freeze on comment, payout math, append-only enforcement.
- **Scale** (opt-in, real test Postgres): `tests/scale/` is the correctness-at-scale battery (collision storms, hot-row contention, determinism under load — ENGINE.10 Q-2). It runs **only** via `pnpm test:scale` with its own `vitest.scale.config.ts`; the default config **excludes `tests/scale/**`** (`vitest.config.ts`), so a bare `vitest run` — local or CI — never picks it up.
- **Operational runners** (opt-in, the LIVE staging database): `tests/staging/` holds non-test operational artifacts that borrow the Vitest harness for module resolution — ADR-0036. **THREE runners are on disk, not one:**
  - `reset.staging.test.ts` — the guarded staging reset (ADR-0035). `pnpm staging:reset` (which `&&`-chains `db:seed:staging`, because the reset leaves `identity_pool` empty).
  - `generate.staging.test.ts` — the **engine-driven fixture generator**. Drives `createOAuthUser` · `acceptTosAction` · `createMarket` · `openMarket` · `place` · `sell` · `closeMarket` · `triggerResolution` · `settleMarket` · `voidMarket` · `moderateComment` · `addBookmarkAction` · the R2 image chain, and writes **NOTHING** itself. `pnpm staging:generate`.
  - `gates.staging.test.ts` — the **six verification gates** (event parity incl. G1.6 content parity and G1.7 flow-id parity · conservation · durable receipt integrity · coverage · magnitudes · zero-share). Emits `docs/polish/staging-coverage.json` and fails RED if it drifts from the committed copy. `pnpm staging:gates`.
  - `fixtures.ts` — the literal fixture table (no RNG). `_lib/` holds the target resolver, the write-guarded and read-only clients, the guard predicates, the reset mechanism, and the gate-4 coverage inventory.
  - **`pnpm staging:rebuild`** is the composite: reset → seed → generate → gates.
- **Never mocked in a runner:** anything that writes a row or moves Dharma (ADR-0036 primitive 3). Only the HTTP/cookie shell may be — `next/headers`, `next/navigation`, `next/cache`, `verifyOnboardingRef`, `requireAdminSession`, `auth.api.getSession`. **`tests/unit/staging/generator-no-direct-writes.test.ts` pins an ALLOWLIST of the `@/server/**` entrypoints a runner may import**; adding a name to it is a decision, not an edit, and `@/server/events/insert` + `@/server/dharma/persist` are pinned as *not* ratified as its own positive control.
- The default config **excludes `tests/staging/**`** exactly as it excludes `tests/scale/**`, so no bare `vitest run` — local, CI, or a subagent's — can reach a live database. Each runner additionally refuses to start unless the FIVE-guard contract passes (intent · target · environment · live connection · post-run verification — the G-5 intent token is the ADR-0035 Addendum's addition to primitive 6's four); the **write-capable** runners require the intent token, the read-only gates deliberately do not. Isolation is asserted by `tests/unit/staging/runner-isolation.test.ts`; the runners' gating shape by `runner-gating.test.ts`; the no-direct-writes rule behaviourally by `_lib/write-guard.ts` and textually by `generator-no-direct-writes.test.ts`; and the fixture table's own consistency — including the C3/C4 lane calibration, computed with the shipped pure `badgeFor` — by `fixture-table.test.ts`.
- **Invariant tests** at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts` — 10 on disk:
  - `I-APPEND-ONLY-001.resolutions-append-only` (INV-4) — `resolution_events` + `payout_events` reject UPDATE/DELETE post-INSERT at the storage layer.
  - `I-ATOMICITY-001.bet-comment-atomic` (INV-1) — one SERIALIZABLE W-1 tx wraps the full bet spine; if any write throws, every write rolls back (minted ENGINE.7).
  - `I-DAILY-ONCE-001.daily-credit-once-per-utc-day` — at most one `daily_allowance` ledger row per user per UTC day; storage backstop is the unique partial index `dharma_ledger_daily_allowance_day_uq` (minted ENGINE.12).
  - `I-GRANT-ONCE-001.initial-grant-once-per-user` — at most one `initial_grant` ledger row per user, EVER; storage backstop is the unique partial index `dharma_ledger_initial_grant_user_uq` (minted ENGINE.13).
  - `I-IDEM-ONCE-001.one-commit-per-idempotency-key` — at most one committed bet/sell per idempotency key; storage backstop is the unique index `bet_receipts_idempotency_key_uq` (fixture-bypass duplicate key → 23505; the route layer rides it via the durable pre-check + 23505 catch — minted AUDIT-FIX-B3 / ADR-0031).
  - `I-NO-OVERDRAFT-001.dharma-ledger-monotone` (INV-2) — `dharma_ledger` `balance_after >= 0`; no overdraft.
  - `I-NO-OVERSELL-001.positions-quantity-non-negative` — position quantity never negative (invariant-class spec rule, not INV-1..4).
  - `I-RESOLVE-ONCE-001.market-terminates-once` — a market terminates exactly one way, once; storage backstop is the partial unique index `resolution_events_terminal_market_uq` (fixture-bypass second terminal row → 23505; `correct` rows keep the chain open — minted ENGINE.9, OQ-7).
  - `I-SIDE-BIND-001.comment-side-bound-at-post-time` (INV-3) — `comments.side_at_post_time` is frozen at post-time; selling out and re-entering the other side never moves prior comments (minted ENGINE.8; DEBATE.3 reuses).
  - `I-SINGLE-SIDE-001.positions-one-held-side` — at most one held side per (user, market) (invariant-class spec rule).
- **`_probe-*.test.ts`** = vendor-contract **regression guards** (e.g. `_probe-openai-omni-shape`, auth probes) — they assert a third-party/library shape, distinct from TDD drivers (CLAUDE.md §5.6).
- **Naming:** `<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<area>.spec.ts` (db/invariant specs), `<area>.property.test.ts` (fast-check property suites), `<area>.scale.test.ts` (the opt-in scale battery). One subject per file.

---

## 10. Git workflow + macOS/zsh

- **Branches:** `feat/*`, `fix/*`, `chore/*`, `refactor/*`. **PRs required. Signed commits (SSH, ED25519).** These are enforced by **GitHub branch protection (server-side)** — **not** by a local hook. ⚠ **`Squash-merge only` is DISCIPLINE — corrected 2026-08-14 against the live API**, which reports `allow_squash_merge`, `allow_merge_commit` and `allow_rebase_merge` **all `true`**. Linear history blocks the merge-commit in practice; **the reachable set is squash OR rebase**, and nothing rejects a rebase merge. Locally, Lefthook runs only: `pre-commit` → Biome on staged files (auto-fix, re-stage); `pre-push` → `tsc --noEmit` + `biome check .`. There is **no** commit-msg/commitlint job and **no** block-main hook.
- **Conventional Commits** by convention (e.g. `feat(bets): …`, `fix(dharma): …`, `chore(deps): …`) — a style rule, not machine-enforced.
- **Multi-line commit messages:** write to `/tmp/commit-msg.txt`, then `git commit -F /tmp/commit-msg.txt`. Never multi-line `-m` or heredocs (macOS zsh truncates pastes ~1KB — split multi-command pastes into single commands; files >1KB via the editor).
- **Canonical SHA** for landed work is the **squash-merge SHA on `main`**; feature-branch SHAs are ephemeral.
- **Commit identity:** `Zugzwang/world <zugzwangworld@proton.me>`, git username `Chrollo`.
- **No `Co-authored-by` trailer.** Foundation commits are single-author — the operational identity above; never append a `Co-authored-by` line. When cherry-picking or replaying a commit that already carries one, strip it at commit time (`git commit --amend` to drop the trailer) before pushing — the squash-merge dialog is a backstop, not the primary control (see `docs/logs/SYNC.10.md`, where a trailer leaked into a squash body).
- **The `Instructions for AI` block** sits **after the body and before any trailers** — so on a commit that carries a trailer the order is body → blank line → block → blank line → trailer. Every commit has it, no exemption by type, and its text is constant. **`CLAUDE.md` §5.13.1 is the governing rule and the single home of the text** — read it there and copy it from there; never retype it from memory and never restate it in this file. Commits predating that rule carry their reasoning as a `git note` rather than in the message (README, *Why a commit exists*).

---

## 11. Boundaries — always / ask first / never

### Always
- Run `just verify` (and the test suites on critical paths) before claiming a change is done.
- Wrap any multi-write user action in `db.transaction(...)`.
- Validate Server Action / route-handler input with zod.
- Server Components by default; `"use client"` only when needed.

### Ask first
- Adding a dependency (justify why an existing one can't do it).
- Editing a committed migration (almost always: write a new one).
- Disabling a Biome rule.
- Touching `src/server/{bets,comments,dharma,resolution}/` or `src/server/auth/` — the CLAUDE.md §1 critical paths, which carry the full ritual.

### Never
- Edit `drizzle/migrations/*` after commit (append-only).
- Read or write `.env*` files.
- Use `any` or unsafe `as` to silence type errors.
- Import from `src/server/**` into client components.
- Expose Drizzle row types directly in API responses.
- Create a "send Dharma" / user-to-user transfer endpoint (CLAUDE.md §3).
- `UPDATE` rows in `resolution_events` or `payout_events` (append-only, INV-4).
- Commit directly to `main` (PR-only — and server-side protection will reject it).

**What is actually enforced vs. discipline.** Mechanically enforced today: PR-required + signed-commit + linear-history + no-force-push + `enforce_admins` + a required **`ci`** status check with `strict: true` (GitHub branch protection; `ci` promoted to a required check at D2, required-reviews still 0). ⚠ **NOT squash** — measured 2026-08-14: all three merge methods are enabled at the repo level, so squash-only is **discipline**, not a control; Biome + `tsc` (Lefthook pre-push + CI); append-only on Bucket-A tables (DB triggers); `bets.comment_id NOT NULL` (schema). Everything else in this section is **discipline** — no hook blocks it. (The previously-documented `deploy-prod.yml`, `commitlint`, block-main / block-destructive hooks, Playwright, and `gitleaks`/CodeQL CI steps do **not** exist; CI is `ci.yml` = Biome → tsc → `drizzle-kit check` → migrate → `db:check-drift` → `vitest run` against a Postgres-17 service [the two migration checks added at D2]. `env-audit.yml` (scheduled Doppler↔Vercel parity, D2) is **not** a merge gate.)

- `staging-migrate.yml` — armed; fires on push to `staging`, applying pending migrations to the staging DB (`--config stg`). The full deploy/promote path (staging gate → scoped prod promote) lives in `docs/runbooks/deploy-pipeline.md` §3 — do not re-document it here.

---

*Rebuilt at SYNC.8 (Jun 2, 2026) against the live repo at `27216fc` + SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0031; descriptive drift reconciled at BC.1 (Jul 1, 2026) against `248e02f`; SPEC.1/SPEC.2 version citations reconciled at the SYNC sweep (Jul 7, 2026), then SYNC-LITE (Jul 16). **Reconciled against the live repo at SYNC-1 (Aug 8, 2026), `fecbaf3` — SPEC.1 1.0.29, SPEC.2 1.0.22, cpmm 2.1.0, ADRs 0001–0036 (34 files), migration head `0024_bookmarks`, `EVENT_TYPES` 24, 23 tables / 13 schema files.** SYNC-1 corrected: the `(public)/` tree (Discovery / Profile / Bookmarks were all live and undocumented), the `src/server/` directory list (+`bookmarks`, `discovery`, `profile`, `visitors`), the `api/` list (+`visits`), `components/ui/` (+dialog, input, textarea), the integration count (20 → 30) and `*.test.tsx` count (26 → 30), the `just` recipe list (+`test-scale`), and the `Sonner` instruction (removed — not installed). Descriptive: tracks the repo, not the target. Follows the [agents.md](https://agents.md) standard. Maintained per `docs/maintenance.md`.*
