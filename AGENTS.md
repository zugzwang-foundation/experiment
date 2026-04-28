# AGENTS.md

> Stack / framework patterns for the Zugzwang Experiment codebase. Follows the [agents.md](https://agents.md) open standard so any coding agent (Claude Code, Cursor, Codex, Aider) gets the same guidance.
>
> Project-specific rules — thesis invariants, golden rules, engagement style, decision log — live in `CLAUDE.md`. This file is the *how* of writing code in this stack; CLAUDE.md is the *what cannot bend*.

---

## 1. Stack (with versions)

- **Runtime:** Node 22 (LTS) via `mise`.
- **Framework:** Next.js 16, App Router, TypeScript strict.
- **DB:** Postgres 17 on Supabase, Drizzle ORM v0.45+ (event-sourced schema).
- **Styling:** Tailwind v4 (CSS-first via `@theme`) + shadcn/ui new-york v4 variant.
- **State:** Server Components by default, `"use client"` only when needed.
- **Real-time:** SSE over Postgres `LISTEN/NOTIFY` (DECIDE — see ADR-0007).
- **Auth:** Clerk *or* NextAuth — DECIDE in ADR-0004.
- **Storage:** Cloudflare R2.
- **Tests:** Vitest (unit + integration) + Playwright (E2E).
- **Tools:** pnpm 10, Biome v2, Lefthook, just, drizzle-kit.
- **Observability:** Sentry (errors), PostHog (analytics + flags), Axiom (logs + metrics).

---

## 2. Setup & commands

```bash
pnpm install                          # install deps
pnpm dev                              # start Next.js dev server (Turbopack)
pnpm build                            # production build
pnpm tsc --noEmit                     # type-check
pnpm biome check .                    # lint + format check
pnpm biome check --write .            # auto-fix lint + format
pnpm vitest run                       # unit + integration tests
pnpm vitest run tests/integration/    # integration only (against test Postgres)
pnpm playwright test                  # E2E
pnpm drizzle-kit generate             # generate migration from schema diff
pnpm drizzle-kit migrate              # apply migrations
just check                            # full pre-PR check (all of the above)
just clean                            # clear .next, .turbo (fixes iCloud dup-suffix bug)
```

**Always** run `just check` before opening a PR. It fails fast on type errors, lint, missing tests, or broken builds.

---

## 3. Project structure

```
zugzwang/
├── CLAUDE.md, AGENTS.md              # contract + stack patterns
├── .claude/                          # subagents, commands, hooks (SCAFFOLD.10)
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # market list, market detail, debate view
│   │   ├── (auth)/                   # sign-in/up flows
│   │   ├── (admin)/                  # admin-only — Hrishikesh
│   │   └── api/                      # external-facing route handlers (webhooks, uploads)
│   ├── server/                       # CRITICAL — see CLAUDE.md §1
│   │   ├── markets/, bets/, comments/
│   │   ├── dharma/, resolution/, auth/
│   │   └── db/                       # drizzle client + schema
│   ├── components/                   # shared UI
│   ├── lib/                          # pure utilities, no IO
│   └── styles/                       # globals.css with @theme
├── tests/{unit,integration,e2e}/
├── docs/{adr,specs,logs,plans,workflows,maintenance.md}
├── drizzle/migrations/               # generated, append-only — DO NOT EDIT
├── next.config.ts, drizzle.config.ts, biome.json, lefthook.yml,
├── mise.toml, justfile, vitest.config.ts, playwright.config.ts
└── postcss.config.mjs                # Tailwind v4 needs this for Next.js
```

Server Components live under `src/app/`. Server-side business logic lives under `src/server/`. Client components live colocated with their route under `src/app/` or in `src/components/`. **Don't** import from `src/server/` into client components — that's a server/client boundary violation Next.js will catch, but better to catch in review.

---

## 4. TypeScript conventions

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` in `tsconfig.json`. Non-negotiable.
- **No `any`.** If you reach for `any`, stop and use `unknown` + a type guard.
- **No `as` casts** except at trust boundaries (parsed form input, third-party API responses). Every cast is paired with a zod validation or an explicit comment.
- **Named exports only.** No default exports, except where Next.js requires it (`page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, route handlers).
- **`type` for unions and shapes; `interface` for extensible object types** consumed across modules.
- **String literal unions over enums.** `type Side = 'yes' | 'no'`, not `enum Side { ... }`.
- **Errors:** custom error classes in `src/lib/errors.ts` with discriminated `kind`. Never throw plain strings.
- **Imports:** absolute via TS path aliases (`@/server/markets`), not deep relative paths.

### Naming

- Files: `kebab-case.ts` for utilities, server modules, route folders. `PascalCase.tsx` for components.
- Functions: `camelCase`. Types: `PascalCase`. Constants: `UPPER_SNAKE_CASE` only for true global constants (env keys, magic strings).
- Tests: `<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<flow>.spec.ts` (Playwright).

---

## 5. Next.js 16 patterns

### Server vs client components

Server Components by default. Add `"use client"` **only** when the component needs:
- React hooks (`useState`, `useEffect`, `useActionState`, etc.)
- Event listeners (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- Third-party client-only libraries (most charts, rich editors)

Pass server-fetched data down to client components as props. Keep the client boundary as close to the leaf as possible.

### Server Actions (mutations)

Every Server Action validates input with zod. No naked form data into the DB.

```ts
// src/server/bets/place-bet.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { auth } from '@/server/auth';

const placeBetSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(['yes', 'no']),
  stake: z.coerce.number().positive(),
  commentId: z.string().uuid(), // CLAUDE.md §2.1 — bet↔comment atomicity
});

export async function placeBet(input: unknown) {
  const user = await auth.requireUser();
  const parsed = placeBetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  // CLAUDE.md §2.1 — bet + comment atomicity in one transaction.
  await db.transaction(async (tx) => {
    await tx.insert(bets).values({ ...parsed.data, userId: user.id });
    // comment row is referenced via FK; insert/lookup happens in tx
  });

  revalidatePath(`/markets/${parsed.data.marketId}`);
  return { ok: true as const };
}
```

### Route handlers (`app/api/*/route.ts`)

For external-facing endpoints: webhooks, uploads, OAuth callbacks. Same zod-validation rule. Same auth-check rule.

### `cacheComponents` + `'use cache'`

Next.js 16 ships **explicit caching** via the `cacheComponents` flag. Set in `next.config.ts`:

```ts
const nextConfig: NextConfig = { cacheComponents: true };
```

With this on, data fetching is **uncached by default**. Mark scopes explicitly with `'use cache'`:

```ts
// Cache the homepage list of markets for 60 seconds
async function getOpenMarkets() {
  'use cache';
  return db.select().from(markets).where(eq(markets.status, 'open'));
}
```

To use cookies or headers, read them **outside** cached scopes and pass values as arguments.

### `params` and `searchParams` are Promises

Breaking change from Next.js 14 → 15+. Pages and route handlers receive these as Promises:

```ts
export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ...
}
```

### Middleware (`src/middleware.ts`)

Used for: auth-required redirects on `(admin)` and authenticated routes, request logging, geo-blocking. The admin check **also** happens at the Server Action / route handler layer (defense in depth).

---

## 6. Database — Drizzle + Postgres

### Schema conventions

- Identity columns over `serial`. Use `integer('id').primaryKey().generatedAlwaysAsIdentity()`.
- Timestamps with timezone: `timestamp('created_at', { withTimezone: true })` everywhere.
- Money / Dharma: `numeric('balance', { precision: 38, scale: 18 })`.
- Enums: `pgEnum`, defined alongside the table.
- Indexes inline with the schema in the second arg to `pgTable`.
- Foreign keys: always declared, always indexed on the referencing side.
- **`bets.comment_id`** is `NOT NULL` with a foreign key to `comments.id`. Enforces CLAUDE.md §2.1 at the schema level.

### Migrations (`drizzle/migrations/`)

- Generated via `pnpm drizzle-kit generate`.
- **Append-only.** Never edit a committed migration; write a new one.
- Destructive migrations (DROP COLUMN, DROP TABLE) require explicit sign-off in the PR + a backup snapshot taken immediately before apply.
- Data migrations (not schema) live in `scripts/data-migrations/` with a dry-run mode.
- Postgres partitioning is not first-class in Drizzle — for the events table partitioning, write the `CREATE TABLE ... PARTITION BY RANGE` as raw SQL in a custom migration.

### Transactions — required for any multi-write user action

```ts
await db.transaction(async (tx) => {
  await tx.insert(comments).values({ ... });
  await tx.insert(bets).values({ ... });
  await tx.insert(dharmaLedger).values({ ... });
});
```

No nested transactions without savepoints. If the function might be called from inside another transaction, accept `tx` as a parameter.

### Query conventions

- **Drizzle query builder** for typed reads. Raw SQL only for performance-critical paths (price curves, leaderboards), kept in `src/server/<domain>/queries.sql.ts` with explicit `sql<T>` types.
- **Avoid N+1.** Use `db.query.<table>.findMany({ with: { ... } })` for relational reads, not loops with `where` clauses.
- **Don't `SELECT *` in hot paths.** Name the columns.
- **Don't expose Drizzle row types to API responses.** Map to API DTOs in the server layer; the DB schema is internal.

### Validation — `drizzle-zod`

Use `createInsertSchema` / `createSelectSchema` to derive zod schemas from Drizzle tables. One source of truth for shape.

```ts
import { createInsertSchema } from 'drizzle-zod';
export const insertBetSchema = createInsertSchema(bets, {
  stake: (s) => s.positive(),
});
```

---

## 7. Frontend — Tailwind v4 + shadcn/ui

### Tailwind v4 — CSS-first config

No `tailwind.config.ts`. All design tokens go in `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-yes: oklch(0.65 0.18 145);    /* market YES side */
  --color-no:  oklch(0.65 0.18 25);     /* market NO side */
  --color-brand: oklch(0.55 0.20 270);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

Defining `--color-yes` automatically generates utilities `bg-yes`, `text-yes`, `border-yes`, etc.

**OKLCH only** for colors. No hex, no HSL, no RGB in `@theme`. OKLCH gives perceptually uniform color and predictable opacity (`bg-yes/50` works correctly).

Next.js 16 also needs `postcss.config.mjs` with `@tailwindcss/postcss` (the "zero config" story is full only for Vite).

### shadcn/ui — new-york v4 variant

- All primitives have a `data-slot` attribute for styling.
- Components use the new-york v4 styles. Don't mix in v3-style components.
- `Sonner` for toasts (deprecated `Toast` component).
- Buttons use the default cursor (CSS reset change).

When adding a new shadcn component: `pnpm dlx shadcn@latest add <component>`. Review the generated code; commit it. Don't import from `@/components/ui` in `src/server/`.

### Class-string formatting

When a `className` exceeds ~80 chars, pre-wrap across multiple lines. Biome will auto-format on save, but writing the source pre-wrapped avoids round-trips:

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
- Run `pnpm playwright test --project=accessibility` (axe-core) on every PR touching `src/app/**`.

---

## 8. Testing

### Unit (Vitest, `tests/unit/`)

- Pure functions in `src/lib/` and `src/server/<domain>/{pricing,dharma,side}.ts` MUST have unit tests covering happy path + at least two edge cases + the relevant invariant.
- No IO in unit tests. If the function needs DB or network, it's an integration test.

### Integration (Vitest + test Postgres, `tests/integration/`)

- Required for any service-layer function that writes to the DB.
- Each test runs in a transaction that rolls back at the end (no test pollution).
- Mandatory scenarios: bet placement atomicity, Dharma ledger reconciliation, side-freezing on comment, resolution payout math, append-only enforcement.

### E2E (Playwright, `tests/e2e/`)

- Full user flows: sign-in → market detail → place bet with comment → debate view.
- Run against staging on every PR; against local against a `docker compose` Postgres.

### Test naming

`<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<flow>.spec.ts` (E2E). One subject per file.

---

## 9. Git workflow

- **Branches:** `feat/*`, `fix/*`, `chore/*`, `refactor/*`. Never commit to `main` (hook enforces).
- **Commits:** Conventional Commits, enforced by commitlint via Lefthook. Examples:
  - `feat(bets): add comment-id requirement to place-bet action`
  - `fix(dharma): prevent double-credit on resolution-correction event`
  - `chore(deps): bump drizzle-orm to 0.45.2`
- **Multi-line commit messages:** write to `/tmp/commit-msg.txt` via VS Code, then `git commit -F /tmp/commit-msg.txt`. Don't use multi-line `git commit -m "..."` (zsh paste truncates ~1KB).
- **PRs:** open via `/pr` slash command (lands at SCAFFOLD.10) or `gh pr create --fill`. Title = conventional commit format.
- **CI** runs Biome, tsc, Vitest, Playwright, build, gitleaks, CodeQL on every PR. Required passing before merge.

---

## 10. Boundaries — always / ask first / never

### Always

- Run `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` before claiming a change is done.
- Wrap any multi-write user action in `db.transaction(...)`.
- Validate Server Action / route handler input with zod.
- Use Server Components by default; add `"use client"` only when needed.

### Ask first

- Adding a new dependency. Justify why an existing one can't do the job.
- Editing a committed migration. The answer is almost always "write a new migration instead."
- Disabling a Biome rule. Discuss why before silencing.
- Touching `src/server/markets/`, `src/server/bets/`, `src/server/comments/`, `src/server/dharma/`, `src/server/resolution/`, or `src/server/auth/` — these are CLAUDE.md §1 critical paths and follow the workflow's extra steps.

### Never

- Edit `drizzle/migrations/*` after commit (append-only).
- Edit `.github/workflows/deploy-prod.yml` without human review.
- Read or write `.env*` files.
- Use `any` or unsafe `as` casts to silence type errors.
- Use `console.log` in `src/server/**` (Biome rule). Use the structured logger (`pino`).
- Import from `src/server/**` into client components (`"use client"` files).
- Expose Drizzle row types directly in API responses.
- Create a "send Dharma" or user-to-user Dharma transfer endpoint (CLAUDE.md §2.2).
- `UPDATE` rows in `resolution_events` or `payout_events` (CLAUDE.md §2.4 — append-only).

---

*AGENTS.md follows the open standard at [agents.md](https://agents.md). Update via the maintenance loop (`docs/maintenance.md`) when stack conventions evolve. Last revised in FOUND.4 (Apr 28, 2026).*
