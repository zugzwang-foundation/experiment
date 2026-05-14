# AGENTS.md

> Stack and framework patterns for the `zugzwang-foundation/experiment` codebase. Follows the [agents.md](https://agents.md) open standard so any coding agent (Claude Code, Codex, Cursor, Copilot, Aider, Gemini CLI) reads the same guidance.
>
> Project-specific rules — thesis invariants, golden rules, refusal triggers, decision log — live in `CLAUDE.md`. This file is the *how* of writing code in this stack; CLAUDE.md is the *what cannot bend*.

---

## 1. Stack (locked — do not propose alternatives)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24 via `mise` | `mise.toml` pins major; `.nvmrc` mirrors for non-mise users |
| Package manager | pnpm 10 | `pnpm-workspace.yaml` declares `allowBuilds` for build-script approval |
| Framework | Next.js 16 (App Router) | Turbopack default; React Server Components first; `cacheComponents: true` |
| Language | TypeScript 5.x strict | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all `true` |
| ORM | Drizzle 0.45+ | event-sourced schema; one table per file |
| Database | Postgres 17.6 (Supabase) | UUIDv7 PKs via userspace `public.uuidv7()` per ADR-0016 |
| Cache / KV | Upstash Redis | rate-limit + Stripe-style idempotency |
| Object storage | Cloudflare R2 | image uploads via signed PUT URLs |
| Auth | Better Auth | participant: Google OAuth + Email-OTP; admin: hand-rolled static-password (per ADR-0004 + ADR-0010) |
| Email | Resend | OTP delivery |
| CAPTCHA | Cloudflare Turnstile | invisible by default, fail-closed at OTP issuance |
| Hosting | Vercel | Server Actions + Route Handlers + Vercel Cron (HTTP-fanout) + pg_cron (DB-internal) |
| Observability | Sentry + PostHog + Vercel runtime logs | Sentry for errors/alarms; PostHog for **feature flags only** (no product analytics in v1); Vercel logs for the structured request log |
| Styling | Tailwind v4 (CSS-first via `@theme`) + shadcn/ui radix-nova preset | OKLCH colors only |
| Linter / formatter | Biome v2 | one tool both jobs; 80-char line width; trailing newlines required |
| Testing | Vitest (unit + integration) + Playwright (E2E) | invariant tests gated separately via `pnpm test:invariants` |
| Tooling | `mise`, `just`, `lefthook`, `drizzle-kit`, `gh` | |

If a task requires a layer not listed here, stop and surface it. Do not introduce a new vendor or library without an ADR.

---

## 2. Setup and commands

```bash
# First-time setup
mise install                          # pulls Node + pnpm versions
pnpm install                          # install deps
cp .env.example .env.local            # fill in Supabase, Upstash, Better Auth, Resend, Turnstile, Sentry, PostHog secrets
just db:up                            # local Supabase via supabase CLI
pnpm drizzle-kit push                 # local schema push (dev only)

# Daily commands
pnpm dev                              # Next.js dev server (Turbopack)
pnpm tsc --noEmit                     # type-check
pnpm biome check .                    # lint + format check
pnpm biome check --write .            # auto-fix lint + format
pnpm vitest run                       # unit + integration tests
pnpm vitest run tests/invariants/     # the four hard-locked invariants only
pnpm playwright test                  # E2E
pnpm drizzle-kit generate             # generate migration from schema diff
pnpm drizzle-kit push                 # apply (dev) — never against staging or prod
just check                            # full pre-PR check (typecheck + lint + tests + build)
just clean                            # clear .next, .turbo (fixes iCloud dup-suffix bug)
```

**`just check` before opening a PR.** It fails fast on type errors, lint, missing tests, or broken builds.

**Do not run `pnpm build` during agent sessions.** Production builds run from CI on PR merge. Use `pnpm dev` and `pnpm test` for verification.

If `pnpm dev` fails with `TypeScript "duplicate identifier"` errors, run `just clean` and retry — iCloud occasionally duplicates `.next/` and `.turbo/` directories with `" 2"` suffixes. The long-term fix is moving the project off iCloud-synced paths (deferred).

---

## 3. Project structure

```
experiment/
├── CLAUDE.md, AGENTS.md              # contract + stack patterns
├── .claude/                          # subagents, skills, hooks, MCP
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # market list, market detail, debate view
│   │   ├── (auth)/                   # sign-in flows
│   │   ├── (admin)/                  # admin Control Centre (admin-only, route-gated)
│   │   └── api/                      # Route Handlers (bet endpoints, OAuth callbacks, public-read JSON)
│   ├── server/                       # CRITICAL — see CLAUDE.md
│   │   ├── bets/, comments/, dharma/, resolution/
│   │   ├── auth/, identity/, moderation/
│   │   ├── events/                   # event-row insertion helper (every state-mutation calls this)
│   │   └── db/                       # Drizzle client + schema
│   ├── components/                   # shared UI
│   ├── lib/                          # pure utilities, no IO
│   └── styles/                       # globals.css with @theme
├── tests/{unit,integration,e2e,invariants}/
├── docs/{specs,adr,runbooks,workflows,maintenance.md}
├── drizzle/migrations/               # generated, append-only — DO NOT EDIT
├── supabase/migrations/              # RLS policies (paired with drizzle migrations on schema-affecting changes)
├── scripts/                          # one-off ops scripts (data migrations with --dry-run)
├── next.config.ts, drizzle.config.ts, biome.json, lefthook.yml,
├── mise.toml, justfile, vitest.config.ts, playwright.config.ts
└── postcss.config.mjs                # Tailwind v4 needs this for Next.js
```

Server-side business logic lives under `src/server/`. Don't import from `src/server/` into client components — that's a server/client boundary violation Next.js catches at build, but better to catch in review.

---

## 4. TypeScript conventions

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` in `tsconfig.json`. Non-negotiable.
- **No `any`.** Reach for `unknown` plus a type guard.
- **No `as` casts** except at trust boundaries (parsed form input, third-party API responses). Every cast paired with a Zod validation or an explicit comment.
- **Named exports only.** No default exports, except where Next.js requires them (`page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `route.ts`).
- **Explicit return types on exported functions.** Inference is fine internally; the exported boundary is contractual.
- **`type` for unions and shapes; `interface` for extensible object types** consumed across modules.
- **String literal unions over enums.** `type Side = 'yes' | 'no'`, not `enum Side`.
- **Errors:** custom error classes in `src/lib/errors.ts` with discriminated `kind`. Never throw plain strings.
- **Imports:** absolute via TS path aliases (`@/server/bets`), not deep relative paths.

### Naming

- Files: `kebab-case.ts` for utilities, server modules, route folders. `PascalCase.tsx` for components.
- Functions: `camelCase`. Types: `PascalCase`. Constants: `UPPER_SNAKE_CASE` for true global constants only (env keys, magic strings).
- Tests: `<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<flow>.spec.ts` (Playwright), `I-<AREA>-<NNN>.<short-name>.spec.ts` (invariant).

---

## 5. Next.js 16 patterns

<!-- BEGIN:nextjs-agent-rules -->
**ALWAYS read Next.js docs before writing Next.js code.** Your training data is older than Next.js 16.2. The bundled docs at `node_modules/next/dist/docs/` are the source of truth. Find and read the relevant doc before writing any Next.js API.
<!-- END:nextjs-agent-rules -->

### Server vs client components

Server Components by default. Add `'use client'` **only** when the component needs:
- React hooks (`useState`, `useEffect`, `useActionState`, etc.)
- Event listeners (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- Third-party client-only libraries (most charts, rich editors)

Pass server-fetched data down to client components as props. Keep the client boundary as close to the leaf as possible. Never add `'use client'` to a page or layout file unless the entire route is interactive.

### Server Actions are the default mutation contract

Three carve-outs ride as Route Handlers per ADR-0003 + SPEC.2 §4:

1. **Bet endpoints** (F-BET-1 / F-BET-2 / F-BET-3) — need the `Idempotency-Key` HTTP header that Server Actions cannot currently read from the client. Each implements an explicit Origin allowlist at handler entry as the CSRF defense.
2. **OAuth callbacks** — external surface, must accept HTTP.
3. **Public-read JSON** (`/api/health`, `/api/dataset/manifest`) — cacheless GETs.

Every Server Action validates input with Zod. No naked form data into the DB.

### `cacheComponents` + `'use cache'`

`next.config.ts` ships with `cacheComponents: true`. Data fetching is **uncached by default**. Mark scopes explicitly with `'use cache'`:

```ts
async function getOpenMarkets() {
  'use cache';
  cacheTag('markets:open');
  return db.select().from(markets).where(eq(markets.status, 'Open'));
}
```

Invalidate via `revalidateTag('markets:open')`, not time-based revalidation.

To use cookies or headers, read them **outside** cached scopes and pass values as arguments.

### `params` and `searchParams` are Promises

Pages and route handlers receive these as Promises (Next.js 15+ contract):

```ts
export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### Don't / do

| Don't | Do |
|---|---|
| Don't use `next/dynamic` with `ssr: false` in a Server Component. | Move the dynamic import into a client component. |
| Don't pass server-only objects (DB rows, `request`) into `'use client'` components. | Map to plain DTOs in the server layer. |
| Don't `revalidatePath()` from inside a transaction. | Call after the transaction commits. |

---

## 6. Database — Drizzle + Postgres

Read this section in full before touching `src/db/schema/`, `drizzle/migrations/`, or `src/server/<domain>/`.

### Schema conventions

- **One table per file** in `src/db/schema/<table>.ts`. Re-export from `src/db/schema/index.ts`.
- **Primary keys are UUIDv7** per ADR-0016. Fixed declaration:
  ```ts
  id: uuid().primaryKey().default(sql`uuidv7()`)
  ```
  Userspace `public.uuidv7()` is a hand-written PL/pgSQL function shipped in `drizzle/migrations/0001_uuidv7.sql`. Do NOT use `crypto.randomUUID()`, `gen_random_uuid()`, `uuid_generate_v4()`, or `serial`/`bigserial` for primary keys.
- **Better Auth tables are uniform with the rest of the schema** — `user`, `session`, `account`, `verification` carry `uuid` PKs via the Better Auth `advanced.database.generateId` override (per ADR-0016 §4).
- Timestamps with timezone: `timestamp('created_at', { withTimezone: true })` everywhere.
- Money / Dharma: `numeric('balance', { precision: 38, scale: 18 })`.
- Enums: `pgEnum`, defined alongside the table.
- Indexes inline with the schema in the second arg to `pgTable`. Index every foreign key on the referencing side — Postgres does NOT auto-index FK columns.
- Foreign keys: always declared, always indexed.

### Append-only triggers — the storage-layer ground truth

The 13 protected tables (9 Bucket A + 4 Bucket B per SPEC.2 §5) carry `BEFORE UPDATE` and `BEFORE DELETE` triggers in `drizzle/migrations/<NNNN>_append_only_triggers.sql`. Application code cannot bypass these — they fire on every credentialed connection.

- **Bucket A** (strictly append-only): `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`. No UPDATE, no DELETE.
- **Bucket B** (append-only with one whitelisted column transition): `friendly_fire_events`, `identity_pool`, `image_uploads`, `system_state`. Exactly one column flips from NULL to a timestamp once.
- **Bucket C** (mutable): `users`, `markets`, `pools`, `positions`, `sessions`, `accounts`, `verifications`, `admin_sessions`. Regular FK / UNIQUE / CHECK constraints only.

Adding a new protected table is a same-commit edit to: schema file, triggers migration, SPEC.2 §5.1 row, SPEC.2 §6 test case. No exceptions.

### Migrations

- Generated via `pnpm drizzle-kit generate`. Verify the generated SQL before committing.
- **Append-only at the file level.** Never edit a committed migration; write a new one that references the prior.
- **Destructive operations** (`DROP COLUMN`, `DROP TABLE`, type narrowing) need a deprecation path: ship the deprecation in one migration, the destructive change in a later one, with at least one deploy between.
- **Supabase RLS policies** live in `supabase/migrations/`. A schema change that affects RLS is a same-commit edit to both directories.
- Postgres partitioning is not first-class in Drizzle — for the events table partitioning per SPEC.2 §7, write the `CREATE TABLE ... PARTITION BY RANGE` as raw SQL in a custom migration.

### Bet transaction contract (`src/server/bets/transaction.ts`)

Per SPEC.2 §9 + ADR-0013. Read both before changing anything in `src/server/bets/`.

- **Isolation:** `SERIALIZABLE`. Set per-transaction.
- **Pool row lock:** `SELECT … FOR NO KEY UPDATE` (NOT `FOR UPDATE`). `FOR UPDATE` conflicts with the `FOR KEY SHARE` lock concurrent FK-validating INSERTs take, blocking every other bet on the market.
- **Canonical lock order:** `pools → positions → dharma_ledger → friendly_fire_events → events`. Acquire locks in this order, every transaction, every code path.
- **Retry policy:** up to 3 attempts on `SQLSTATE 40001` (serialization failure) OR `40P01` (deadlock). Full-jitter backoff on bases `[50, 100, 200]` ms. Exhaustion fires §17 alarm 3 and returns `error_bet_serialization_exhausted` (HTTP 503, `Retry-After: 1`).
- **Moderation runs OUTSIDE the transaction** (per CLAUDE.md golden rule, ADR-0014, SPEC.2 §10). Holding a transaction open across a 200–2000 ms HTTP call would block every other bet on the same market. The bet wrapper opens its transaction only on a `pass` verdict.

### Read patterns

- **Drizzle query builder** for typed reads. Raw SQL only for performance-critical paths (price curves, leaderboards, the debate-view ranking function), kept in `src/server/<domain>/queries.sql.ts` with explicit `sql<T>` types.
- **Avoid N+1.** Use `db.query.<table>.findMany({ with: { ... } })` for relational reads, not loops with `where` clauses.
- **Don't `SELECT *` in hot paths.** Name the columns.
- **Don't expose Drizzle row types in API responses.** Map to API DTOs in the server layer; the DB schema is internal.

### Validation — `drizzle-zod`

Use `createInsertSchema` / `createSelectSchema` to derive Zod schemas from Drizzle tables. One source of truth for shape.

```ts
import { createInsertSchema } from 'drizzle-zod';
export const insertBetSchema = createInsertSchema(bets, {
  stake: (s) => s.positive(),
});
```

---

## 7. Handler stack — every state-mutating endpoint

Per SPEC.2 §3.1. Seven steps in fixed order. The bet wrapper (`src/server/bets/transaction.ts`), the comment write transaction (`src/server/comments/write.ts`), and the resolution flow (`src/server/resolution/`) all reduce to this stack.

1. **Auth gate** — middleware redirect (Layer 1, UX) + Server Action / Route Handler validator (Layer 2, security boundary). Two layers per CVE-2025-29927 defense-in-depth.
2. **Idempotency-Key validation** — RFC 8785 canonical-JSON SHA-256 fingerprint over the request body. Per ADR-0015.
3. **Idempotency cache lookup** — return cached `(status, body)` on hit (including cached 429s and 4xxs); skip moderation and DB transaction. Per Stripe contract.
4. **Rate-limit check** — `@upstash/ratelimit` sliding window per surface.
5. **Pre-commit moderation** — OpenAI moderation + PhotoDNA, OUTSIDE the DB transaction. Per ADR-0014.
6. **Handler body** — the SERIALIZABLE transaction or read query.
7. **Events row + response cache write** — every state-mutating transaction writes its `events` row in-transaction with the seven-field metadata block (`request_id`, `flow_id`, `user_id`, `actor_id`, `idempotency_key`, `ip`, `user_agent`). Per SPEC.2 §3.7.

### Failure-mode posture (asymmetric, deliberate)

| Concern | Substrate | Failure mode | Reason |
|---|---|---|---|
| Rate-limit | Upstash Redis | **Fail open** — admit, alarm 6a | Brief abuse-cap gap < global outage |
| Idempotency | Upstash Redis | **Fail closed** — HTTP 503, alarm 6b | Duplicate bet would corrupt the ledger |
| Moderation | OpenAI + PhotoDNA | **Fail closed** — HTTP 503, alarm 4 | Legal-floor breach for CSAM categories |
| Sentry | Sentry | Fail open silently | Observability is downstream of correctness |
| PostHog flags | PostHog | Return `defaultValue` per call site | Never expose unfinished UI on outage |

### `useFlag` runtime contract

```ts
useFlag(name: string, defaultValue: boolean): boolean
```

Local evaluation only (no server round-trip per render). Safe `defaultValue` per call site (never expose unfinished UI on a PostHog outage — that would be a `REFUSAL:`). Returns `defaultValue` on outage. Every call site MUST pass an explicit `defaultValue`.

---

## 8. Frontend — Tailwind v4 + shadcn/ui

### Tailwind v4 — CSS-first config

No `tailwind.config.ts`. All design tokens go in `src/app/globals.css`:

```css
@import "tailwindcss";

/* Plain @theme: adds utilities for tokens that don't have a Tailwind name. */
@theme {
  --color-yes:   oklch(0.65 0.18 145);  /* placeholder — DESIGN.1 mints */
  --color-no:    oklch(0.65 0.18 25);   /* placeholder — DESIGN.1 mints */
  --color-brand: oklch(0.55 0.20 270);  /* placeholder — DESIGN.1 mints */
  --font-sans:   var(--font-geist-sans); /* placeholder — DESIGN.7 swaps */
  --font-mono:   var(--font-geist-mono); /* placeholder — DESIGN.7 swaps */
}
```

The `--color-yes` / `--color-no` / `--color-brand` color values AND the `--font-sans` / `--font-mono` mappings shown above are **SCAFFOLD.1 placeholders**. The real brand palette is produced by DESIGN.1 (brand + tokens) and back-applied to `globals.css` by DESIGN.7; the font choice is similarly DESIGN.7's call. This is the operational realization of SPEC.2 §22.2's design-independence carve-out: the codebase scaffolds without `docs/specs/design.md`, then the design system layers on once ADR-0012 lands. Token NAMES (`--color-yes`, `--font-sans`, etc.) are stable; only VALUES are placeholder.

Defining `--color-yes` automatically generates `bg-yes`, `text-yes`, `border-yes`, etc.

**OKLCH only** for colors. No hex, no HSL, no RGB in `@theme`. OKLCH gives perceptually uniform color and predictable opacity (`bg-yes/50` works correctly).

Next.js 16 needs `postcss.config.mjs` with `@tailwindcss/postcss`.

### shadcn/ui — radix-nova preset

- Primitives use `data-slot` attributes for styling.
- radix-nova preset only (per SCAFFOLD.1 init; `components.json` `style` field). Don't mix in older shadcn styles.
- `Sonner` for toasts (deprecated `Toast` component).
- `pnpm dlx shadcn@latest add <component>` to add. Review the generated code; commit it. Don't import from `@/components/ui` in `src/server/`.

### Class-string formatting

When a `className` exceeds ~80 chars, pre-wrap across multiple lines. Biome auto-formats on save, but writing source pre-wrapped avoids round-trips:

```tsx
<div
  className={cn(
    'flex items-center justify-between gap-3',
    'rounded-md border border-border bg-card p-4',
    'hover:bg-accent transition-colors',
    isActive && 'ring-2 ring-ring',
  )}
>
```

### Accessibility

- `aria-label` on icon-only buttons and on YES/NO toggles.
- All interactive elements reachable via Tab.
- Modal/dialog focus-trap via shadcn `Dialog`.
- Live regions (`aria-live="polite"`) for order status and price updates.
- Pair color with icon or text for state — never color-only.
- `pnpm playwright test --project=accessibility` (axe-core) on every PR touching `src/app/**`.

---

## 9. Testing

### Unit (Vitest, `tests/unit/`)

Pure functions in `src/lib/` and `src/server/<domain>/{pricing,dharma,side}.ts` MUST have unit tests covering happy path + at least two edge cases + the relevant invariant. No IO.

### Integration (Vitest + test Postgres, `tests/integration/`)

Required for any service-layer function that writes to the DB. Each test runs in a transaction that rolls back at the end (no test pollution).

### Invariant (`tests/invariants/`)

The four hard-locked invariants from SPEC.1 §5 each have a canonical integration test at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts`:

- `I-ATOMICITY-001.bet-comment-atomic.spec.ts`
- `I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts`
- `I-SIDE-BIND-001.comment-side-frozen.spec.ts`
- `I-APPEND-ONLY-001.resolutions-append-only.spec.ts`

Run via `pnpm test:invariants`. CI fails if any invariant test fails or is skipped.

### E2E (Playwright, `tests/e2e/`)

Full user flows: sign-in → market detail → place bet with comment → debate view. Run against staging on every PR; against `docker compose` Postgres locally.

---

## 10. Git workflow + macOS / zsh constraints

- **Git identity** for this repo: `Zugzwang/world <zugzwangworld@proton.me>`. Set per-repo: `git config user.email zugzwangworld@proton.me`.
- **Branches:** `feat/*`, `fix/*`, `chore/*`, `refactor/*`. Never commit to `main` (Lefthook enforces).
- **Conventional Commits**, enforced by commitlint via Lefthook:
  - `feat(bets): add comment-id requirement to place-bet action`
  - `fix(dharma): prevent double-credit on resolution-correction event`
  - `chore(deps): bump drizzle-orm to 0.45.2`
- **Multi-line commit messages:** write to `/tmp/commit-msg.txt` via VS Code, then `git commit -F /tmp/commit-msg.txt`. The macOS Terminal+zsh paste buffer caps ~1 KB and silently truncates `git commit -m "..."`.
- **Files >1 KB:** open in VS Code (`code <path>`), paste the full file, save. Do not use heredocs, `printf` line-continuations, or `cat > <file> <<EOF` — they truncate at the same paste-buffer limit.
- **Trailing newline at end of file** — POSIX convention; Biome enforces.
- **PRs:** open via the `/pr` skill at `.claude/skills/pr-create/SKILL.md` (per current Claude Code conventions; legacy `.claude/commands/pr.md` superseded) or `gh pr create --fill`. Title follows Conventional Commits format.
- **CI** runs Biome, tsc, Vitest, Playwright, `pnpm test:invariants`, build, gitleaks, CodeQL on every PR. All required passing before merge.
- **One ADR per architectural change.** Add `docs/adr/<NNNN>-<slug>.md` in the same commit as the implementation. Template lives at `docs/adr/_template.md`.

---

## 11. Boundaries — always / ask first / never

### Always

- Run `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` (or `just check`) before claiming a change is done.
- Wrap any multi-write user action in `db.transaction(...)` at SERIALIZABLE isolation.
- Validate Server Action / Route Handler input with Zod.
- Use Server Components by default; add `'use client'` only when needed.
- Read `node_modules/next/dist/docs/` before writing Next.js APIs.
- Reference ADRs and SPEC sections by number in code comments where the implementation is load-bearing (e.g., `// per SPEC.2 §9 / ADR-0013`).

### Ask first

- Adding a new dependency. Justify why an existing one cannot do the job.
- Editing a committed migration. The answer is almost always "write a new migration instead."
- Disabling a Biome rule. Discuss why before silencing.
- Touching `src/server/bets/`, `src/server/comments/`, `src/server/dharma/`, `src/server/resolution/`, `src/server/auth/`, `src/server/identity/`, or `src/server/moderation/` — these are CLAUDE.md critical paths and follow the workflow's extra steps.
- Changing the canonical lock order, retry policy, or isolation level in `src/server/bets/transaction.ts`.

### Never

- Edit `drizzle/migrations/*` after commit (append-only at the file level).
- Edit `.github/workflows/deploy-prod.yml` without human review.
- Read or write `.env*` files.
- Use `any` or unsafe `as` casts to silence type errors.
- Use `console.log` in `src/server/**` (Biome rule). Use the structured logger.
- Import from `src/server/**` into client components (`'use client'` files).
- Expose Drizzle row types directly in API responses.
- Use `gen_random_uuid()`, `crypto.randomUUID()`, or `uuid_generate_v4()` for primary keys. Use `uuid().primaryKey().default(sql`uuidv7()`)` per ADR-0016.
- Hold a database transaction across an HTTP call (OpenAI, R2, Resend, anything). Run external calls before the transaction opens; pass results in. Per ADR-0014.
- Use `FOR UPDATE` on the pool row in `src/server/bets/`. Use `FOR NO KEY UPDATE` per ADR-0013.
- Run `pnpm build` or `vercel --prod` during agent sessions.
- Run `supabase db reset --linked`, `drizzle-kit drop`, or any `DROP TABLE` against staging or production.
- Create a "send Dharma" or user-to-user Dharma transfer endpoint. There is no `dharma_transfer` table by design.
- `UPDATE` rows in `resolution_events` or `payout_events`. Append-only enforced by Postgres trigger; the trigger is the ground truth, not the application code.

---

*AGENTS.md follows the [agents.md](https://agents.md) open standard. Update via the maintenance loop (`docs/maintenance.md`) when stack conventions evolve. Last revised PRECURSOR.5 (May 2026) against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft + ADRs 0003–0016.*
