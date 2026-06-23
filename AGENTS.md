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
```

Test scripts (in `package.json`): `pnpm test:invariants` (`vitest run tests/invariants/`), `pnpm test:integration` (`vitest run tests/integration/`), plus identity-pool seed/verify and staging migrate/seed/smoke scripts. There is **no `just db:up`** and **no all-in-one test recipe** — run `just test-db` and the `pnpm test:*` scripts as needed.

**Before claiming a change is done:** `just verify`. Critical-path work additionally runs the test suites above (CLAUDE.md §5.7).

**`just verify` build env:** `next build` (and therefore bare `just verify`) requires `ZUGZWANG_ENV=preview` — the `getRedisKey` build-env gate rejects `"unknown"`, failing `/admin/login` page-data collection. Run `ZUGZWANG_ENV=preview just verify`; env-only, not a regression.

---

## 3. Project structure (the real tree)

```
experiment/
├── CLAUDE.md, AGENTS.md            # contract + stack patterns (CLAUDE.md imports @AGENTS.md)
├── .claude/agents/                 # 4 subagent briefings (tracked); settings.local.json is gitignored
├── .github/workflows/ci.yml        # the ONLY workflow
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (admin)/admin/          # login (separate from Better Auth) + markets, markets/new, markets/[marketId] (ENGINE.15 market-admin pages)
│   │   ├── (auth)/                 # onboarding, sign-in, sign-in/otp
│   │   ├── (dev)/                  # scaffold smoke page
│   │   ├── api/                    # _smoke-error, auth/[...all], bets/{place,sell}, cron/{r2-orphan-sweep,close-due-markets}, health, uploads/sign
│   │   ├── globals.css, layout.tsx, page.tsx
│   ├── components/ui/              # shadcn primitives (button.tsx …)
│   ├── db/                         # ← Drizzle client + schema live HERE (not src/server/db)
│   │   ├── index.ts                #   the drizzle client
│   │   └── schema/                 #   12 files: _enums, audit, auth, bets, comments, dharma,
│   │                               #   events, identity, image-uploads, index, markets, system
│   ├── lib/                        # auth-client, errors, utils, posthog/
│   └── server/                     # server-side business logic
│       ├── admin/                  # actor (assertAdminActor — the R-14.5 belt; ENGINE.14)
│       ├── auth/                   # index, email-otp, session-gate, onboarding-ref, tos-*, logout
│       │   └── admin/              # login, logout, validate (admin path)
│       ├── bets/ config/ cpmm/ dharma/ events/ idempotency/ identity-pool/
│       ├── markets/                # transitions, errors + ENGINE.14: transaction (W-4), create, open, close (incl. the closeDueMarkets sweep)
│       ├── middleware/ moderation/ positions/ resolution/ storage/ upstash/
├── tests/                          # dedicated dir (NOT colocated) — see §9
├── docs/{adr,specs,logs,plans,…}
├── drizzle/migrations/             # generated + hand-written; append-only — DO NOT EDIT
├── scripts/                        # tsx operational scripts (seed, verify, migrate-staging, smoke)
├── supabase/                       # branch/snippet scratch only — NO migrations dir (RLS out of scope, ADR-0019)
├── biome.json, drizzle.config.ts, lefthook.yml, mise.toml, justfile,
├── next.config.ts, postcss.config.mjs, tsconfig.json, vitest.config.ts, vercel.json
└── instrumentation.ts, instrumentation-client.ts, sentry.{server,edge}.config.ts, proxy.ts
```

**Greenfield — implied by the specs but NOT yet on disk:** `src/server/comments/`, `src/server/identity/` (the built dir is `identity-pool/`), and `src/app/(public)/` (the market-list/detail/debate route group). These arrive in the ENGINE / DEBATE / UI phases. (`src/server/{bets,cpmm,dharma,markets,positions}/` landed across ENGINE.2–12; `src/server/resolution/` — the W-3 trio + F-ADMIN-3 trigger — landed at ENGINE.9; `src/server/markets/{transaction,create,open,close}.ts` — W-4 + the lifecycle flows — and `src/server/admin/actor.ts` landed at ENGINE.14.)

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
- **One file may hold several related tables.** 20 tables live across 11 files — e.g. `bets.ts` (bets + positions), `events.ts` (events + resolution_events + payout_events).

### Reply-as-bet schema reality

- `bets.comment_id` — **`NOT NULL`**, FK to `comments.id` (the built half of INV-1). Indexed.
- `comments.bet_id` — **EXISTS but NULLABLE by design**; INV-1 is enforced via `bets.comment_id` NOT NULL + the W-1 atomic transaction, not via `comments.bet_id` (the circular pair sets only the `bets.comment_id` direction at write time; Bucket-A append-only forbids a later back-fill) — **not** a pending NOT-NULL migration (ADR-0017 ranking reconciliation, DEBATE.8). Indexed (`comments_bet_id_idx`, migration 0008).

### Append-only buckets

- **Bucket A — fully append-only** (9 tables: events, dharma_ledger, bets, comments, resolution_events, payout_events, mod_actions, admin_events, user_events). Protected by `0003_append_only_triggers.sql`; reject UPDATE/DELETE at the storage layer.
- **Bucket B — append-only with whitelisted column transition(s)** (3 tables: identity-pool, image-uploads, system-state). Each permits a one-shot `NULL→timestamp` transition on a whitelisted column — e.g. `system_state.frozen_at` flips once then is immutable (`image_uploads` transitions `terminal_state` + `terminal_at` together). All other column changes + every DELETE are rejected at the storage layer.
- **Bucket C — mutable** (e.g. `positions`).

### Migrations (`drizzle/migrations/`)

- Generated via `just db-generate <name>`; **append-only — never edit a committed migration, write a new one.** Destructive migrations need PR sign-off + a backup snapshot first.
- The `events` table partitioning is **hand-written** (`PARTITION BY RANGE`) in `0002_events_partitioning.sql` and **excluded from drizzle-kit** via `drizzle.config.ts` → `tablesFilter: ["!events"]`.
- pg_cron-coupled migrations (`0007_pg_cron_jobs.sql`, `0011_position_drift_pg_cron.sql`) carry `cron.schedule()` (and `0007` the `CREATE EXTENSION pg_cron`); CI strips those statements from every `*pg_cron*.sql` before applying (the CI runner has no pg_cron).
- Current head: `0016_mod_actions_reason.sql` (0014 = resolution constraints + the terminal-once index; 0015 = the full `check_nightly_drift()` re-statement correcting 0011's two zero-terminal false-positive clauses — the 0007→0011 function-replace precedent; 0016 = `mod_actions.reason` for the reactive-moderation foundation, PR #143).

### Transactions, queries, validation

- **Any multi-write user action runs in `db.transaction(...)`.** Bet placement is `SERIALIZABLE` + `SELECT … FOR NO KEY UPDATE` on the pool row with full-jitter retry on `40001/40P01` (ADR-0013) — landed at ENGINE.7/8 (W-1 `src/server/bets/transaction.ts` + `endpoint.ts`); the market-lifecycle W-4 (`src/server/markets/transaction.ts`) and resolution W-3 (`src/server/resolution/transaction.ts`) wrappers mirror the same retry spine.
- Drizzle query builder for typed reads; raw `sql<T>` only for hot paths. Avoid N+1 (`db.query.<t>.findMany({ with })`). Don't `SELECT *` in hot paths. Don't expose Drizzle row types in API responses — map to DTOs in the server layer.
- **`drizzle-zod`** (`createInsertSchema` / `createSelectSchema`) derives zod schemas from tables — one source of truth for shape.

### Events

`events.event_type` is **`text`** (open-extensibility, SPEC.2 §7.1), **not** a `pgEnum`. The closed value set is the TS const `EVENT_TYPES` in `src/server/events/schemas.ts` (currently 23 values: 4 `image_upload.*`, 5 `user.*`, 2 `admin.*`, 7 `market.*`, 2 `bet.*`, 1 `comment.*`, 2 `dharma.*`), compile-guarded by `as const satisfies Record<EventType, …>`. When a new event type is added, extend `EVENT_TYPES` **and** its Zod payload schema in the **same commit** (enum-hygiene).

---

## 7. Server stack — `server-only`, middleware, handlers

- Files under `src/server/**` that touch the DB or secrets import `server-only`. **Scripts run under `tsx` must not delegate into the `@/db` → `server-only` chain** — inline their own `postgres()` client (the staging-seed/smoke pattern).
- **Structured logging** via the `src/server/middleware/logging.ts` logger — no `console.log` in server code (a convention today, *not* a Biome rule; `console.error` does appear in auth). No request bodies in logs.
- Middleware: `logging`, `origin-allowlist`, `rate-limit`. Idempotency store + lock in `idempotency/` + `upstash/`. Moderation is `moderation/precommit.ts` (OpenAI **before** the bet tx, guarded by a Redis SETNX reservation; fail-closed on terminal — ADR-0014). Rate-limit fails **open**; idempotency fails **closed** (ADR-0015).
- **Better Auth custom `users` columns:** the drizzle adapter persists only fields in Better Auth's user model (6 core + `user.additionalFields`). Any custom `users` column written through a `databaseHook`/`mapProfileToUser` **must** be declared in `user.additionalFields` (`type:"string"`, `required:false`, `input:false` for server-only/identity fields) or it is silently stripped before INSERT — the cause of the `unable_to_create_user`/`23502` null-`pseudonym` signup bug (FIX-AUTH-SIGNUP). `input:false` also blocks client identity-spoofing at `parseInputData`.
- **Better Auth `session.expiresIn` → cookie `Max-Age` 400-day ceiling:** `expiresIn` is fed straight into the session-cookie `maxAge` by Better Auth's `setSessionCookie`, and the better-call cookie serializer **throws** when `maxAge > 34,560,000 s` (400 days). The throw fires at **cookie-serialization time on sign-in, not at token creation**, surfacing as an uncaught 500 for onboarded/returning users (first-time signup is deferred by the `session.create.before` onboarding gate, which masks it). Cap `expiresIn` at `SESSION_MAX_AGE_SEC = 60*60*24*400`; modern browsers (Chrome 104+) clamp `Max-Age`/`Expires` to the same 400-day ceiling regardless (FIX-AUTH-LOGIN / ADR-0004 Patch P1; SPEC.2 §8.2).

---

## 8. Frontend — Tailwind v4 + shadcn

- **CSS-first config** in `src/app/globals.css`: `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`, then `@custom-variant dark`. **`postcss.config.mjs`** loads `@tailwindcss/postcss` (Next.js needs it).
- **OKLCH only** in `@theme` — no hex/HSL/RGB (perceptually uniform; opacity like `bg-yes/50` behaves). Defining `--color-yes` auto-generates `bg-yes`, `text-yes`, etc.
- **Tokens are PLACEHOLDER.** The `@theme` block (`--color-yes/no/brand`, `--font-sans/mono` → Geist) is a SCAFFOLD.1 placeholder per SPEC.2 §22.2; DESIGN.1 mints real values and DESIGN.7 back-applies. **Do not consume brand tokens in business logic until DESIGN.7 lands.**
- shadcn primitives carry `data-slot`; use the current variant, don't mix older styles; `Sonner` for toasts.
- **Accessibility:** `aria-label` on icon-only buttons and YES/NO toggles; Tab-reachable; focus-trap via shadcn `Dialog`; `aria-live="polite"` for price/status; pair colour with icon/text. *(No axe/Playwright accessibility project is installed yet — manual review for now.)*

---

## 9. Testing — Vitest (no Playwright yet)

**Vitest is the only runner installed.** No Playwright, no `tests/e2e/`. Real layout under a dedicated `tests/` dir (not colocated):

```
tests/
├── _setup/        env.ts, server-only-shim.ts
├── db/            _fixtures/, identity-pool/, triggers/ (12 append-only specs, one per protected table)
├── integration/   11 *.integration.test.ts (idempotency, orphan-sweep, positions, precommit-moderate, rate-limit, sign-*, upstash-lock, dharma-ledger, resolution-conservation, nightly-drift-resolution)
├── invariants/    9 specs — see the Invariant-tests bullet below
├── server/        auth/ (incl. _probe-* + admin-login-result), bets/ (atomicity, concurrency, daily-credit, events-idempotency, idempotency-replay, moderation-outside-transaction, sell, subsequent-buy, validation), cron/ (close-due-markets — ENGINE.15, the first route-handler test convention), events/, identity/, middleware/, moderation/, resolution/ (happy-path, pro-rata, correction, void, concurrency, actor-assert), storage/, admin/ (moderation/ + markets, pool-seed, resolution — each carries its ENGINE.15 wire-action blocks), dharma/ (non-transferable)
└── unit/          body-fingerprint, rate-limit-prefix, upstash-keys, bets/ (errors, floors, wire-envelope), cpmm/ (calculate + validate + vectors.test.ts + *.property.test.ts + _arbitraries.ts), markets/ (transitions.test.ts), positions/ (compute.test.ts), resolution/ (basis + basis.property), dharma/ (accrual, canonical, _probe-decimal-negzero, ledger, conservation, conservation-correction)
```

- **Unit** (no IO): pure functions in `src/lib/` and `src/server/<domain>/`. Happy path + ≥2 edges + the relevant invariant.
- **Integration** (real test Postgres): any service-layer function that writes. Mandatory scenarios as the ENGINE lands — bet atomicity, Dharma reconciliation, side-freeze on comment, payout math, append-only enforcement.
- **Invariant tests** at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts` — 9 on disk:
  - `I-APPEND-ONLY-001.resolutions-append-only` (INV-4) — `resolution_events` + `payout_events` reject UPDATE/DELETE post-INSERT at the storage layer.
  - `I-ATOMICITY-001.bet-comment-atomic` (INV-1) — one SERIALIZABLE W-1 tx wraps the full bet spine; if any write throws, every write rolls back (minted ENGINE.7).
  - `I-DAILY-ONCE-001.daily-credit-once-per-utc-day` — at most one `daily_allowance` ledger row per user per UTC day; storage backstop is the unique partial index `dharma_ledger_daily_allowance_day_uq` (minted ENGINE.12).
  - `I-GRANT-ONCE-001.initial-grant-once-per-user` — at most one `initial_grant` ledger row per user, EVER; storage backstop is the unique partial index `dharma_ledger_initial_grant_user_uq` (minted ENGINE.13).
  - `I-NO-OVERDRAFT-001.dharma-ledger-monotone` (INV-2) — `dharma_ledger` `balance_after >= 0`; no overdraft.
  - `I-NO-OVERSELL-001.positions-quantity-non-negative` — position quantity never negative (invariant-class spec rule, not INV-1..4).
  - `I-RESOLVE-ONCE-001.market-terminates-once` — a market terminates exactly one way, once; storage backstop is the partial unique index `resolution_events_terminal_market_uq` (fixture-bypass second terminal row → 23505; `correct` rows keep the chain open — minted ENGINE.9, OQ-7).
  - `I-SIDE-BIND-001.comment-side-bound-at-post-time` (INV-3) — `comments.side_at_post_time` is frozen at post-time; selling out and re-entering the other side never moves prior comments (minted ENGINE.8; DEBATE.3 reuses).
  - `I-SINGLE-SIDE-001.positions-one-held-side` — at most one held side per (user, market) (invariant-class spec rule).
- **`_probe-*.test.ts`** = vendor-contract **regression guards** (e.g. `_probe-openai-omni-shape`, auth probes) — they assert a third-party/library shape, distinct from TDD drivers (CLAUDE.md §5.6).
- **Naming:** `<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<area>.spec.ts` (db/invariant specs), `<area>.property.test.ts` (fast-check property suites). One subject per file.

---

## 10. Git workflow + macOS/zsh

- **Branches:** `feat/*`, `fix/*`, `chore/*`, `refactor/*`. **Squash-merge only. PRs required. Signed commits (SSH, ED25519).** These are enforced by **GitHub branch protection (server-side)** — **not** by a local hook. Locally, Lefthook runs only: `pre-commit` → Biome on staged files (auto-fix, re-stage); `pre-push` → `tsc --noEmit` + `biome check .`. There is **no** commit-msg/commitlint job and **no** block-main hook.
- **Conventional Commits** by convention (e.g. `feat(bets): …`, `fix(dharma): …`, `chore(deps): …`) — a style rule, not machine-enforced.
- **Multi-line commit messages:** write to `/tmp/commit-msg.txt`, then `git commit -F /tmp/commit-msg.txt`. Never multi-line `-m` or heredocs (macOS zsh truncates pastes ~1KB — split multi-command pastes into single commands; files >1KB via the editor).
- **Canonical SHA** for landed work is the **squash-merge SHA on `main`**; feature-branch SHAs are ephemeral.
- **Commit identity:** `Zugzwang/world <zugzwangworld@proton.me>`, git username `Chrollo`.
- **No `Co-authored-by` trailer.** Foundation commits are single-author — the operational identity above; never append a `Co-authored-by` line. When cherry-picking or replaying a commit that already carries one, strip it at commit time (`git commit --amend` to drop the trailer) before pushing — the squash-merge dialog is a backstop, not the primary control (see `docs/logs/SYNC.10.md`, where a trailer leaked into a squash body).

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

**What is actually enforced vs. discipline.** Mechanically enforced today: PR-required + squash + signed-commit (GitHub branch protection); Biome + `tsc` (Lefthook pre-push + CI); append-only on Bucket-A tables (DB triggers); `bets.comment_id NOT NULL` (schema). Everything else in this section is **discipline** — no hook blocks it. (The previously-documented `deploy-prod.yml`, `commitlint`, block-main / block-destructive hooks, Playwright, and `gitleaks`/CodeQL CI steps do **not** exist; CI is `ci.yml` = Biome → tsc → migrate → `vitest run` against a Postgres-17 service.)

---

*Rebuilt at SYNC.8 (Jun 2, 2026) against the live repo at `27216fc` + SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0019. Descriptive: tracks the repo, not the target. Follows the [agents.md](https://agents.md) standard. Maintained per `docs/maintenance.md`.*
