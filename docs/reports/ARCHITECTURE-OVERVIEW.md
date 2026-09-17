# Zugzwang — Full Architecture Overview

**For:** anyone new to the project, including infrastructure engineers evaluating a move to AWS
**Checked against:** `main` @ `40f77c5` · 18 September 2026
**Live window:** markets opened 14 Sep 2026 · write-freeze **5 Nov 2026, 23:59 UTC**

---

## 1. What the product is

Zugzwang is a **prediction market where people stake reputation instead of money**, and where **every stake must carry an argument**.

- A **market** is a yes/no question with a price that moves as people bet (CPMM — the same constant-product maths as Manifold).
- **Dharma (Đ)** is the reputation currency. It is **soulbound**: it can never be transferred between users. There is no "send Dharma" feature and no table that could hold one.
- **Every bet must carry a comment, and every comment must ride a bet.** A reply is itself a bet on the parent's side (support) or the other side (counter).
- Everything is **web2 only** — no blockchain, no tokens, no wallets. Dharma is a `NUMERIC(38,18)` column in Postgres.
- The experiment runs to **5 November 2026**, when the database is frozen read-only and the dataset is published.

---

## 2. Technology stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.2 |
| UI library | React | 19.2.4 |
| Language | TypeScript (strict) | 5.x |
| Runtime | Node | 24 |
| Database | PostgreSQL on Supabase (ap-south-1) | 17 |
| ORM | Drizzle ORM + drizzle-kit | 0.45 / 0.30 |
| DB driver | postgres.js | 3.4 |
| Auth | Better Auth (Google OAuth + email OTP + Turnstile) | 1.6.11 |
| Styling | Tailwind CSS v4 (CSS-first) + shadcn/Radix | v4 |
| Cache / limits | Upstash Redis + Ratelimit | 1.38 / 2.0.8 |
| File storage | Cloudflare R2 (S3 API) | aws-sdk 3.1045 |
| Moderation | OpenAI omni-moderation | 6.39 |
| Email | Resend | 6.12 |
| Exact maths | decimal.js (pinned) | 10.6.0 |
| Validation | Zod | 3.25 |
| Monitoring | Sentry + PostHog | 10.53 / 1.376 |
| Tests | Vitest + fast-check | 3.x / 4.8 |
| Lint/format | Biome | 2.4.13 |
| Package manager | pnpm | 10.33.2 |
| Hosting today | Vercel, region `bom1` (Mumbai) | — |
| Secrets | Doppler (configs `prd` and `stg`) | — |
| CI | GitHub Actions | — |

---

## 3. Runtime topology (how it runs today)

```
                    ┌──────────────────────────────┐
   Browser  ──────► │  Vercel (region bom1/Mumbai) │
                    │  Next.js 16 server + CDN     │
                    └───────┬──────────────────────┘
                            │
      ┌─────────────────────┼──────────────────────┬─────────────────┐
      ▼                     ▼                      ▼                 ▼
┌─────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌────────────────┐
│  Supabase   │   │  Upstash Redis   │   │ Cloudflare R2│   │ OpenAI/Resend  │
│ Postgres 17 │   │  (HTTPS REST)    │   │  3 buckets   │   │ Sentry/PostHog │
│ ap-south-1  │   │ limits, locks,   │   │ uploads, pfp,│   │ moderation,    │
│ session     │   │ idempotency,     │   │ market-media │   │ email, errors, │
│ pooler:5432 │   │ counters         │   │ signed URLs  │   │ analytics      │
└─────────────┘   └──────────────────┘   └──────────────┘   └────────────────┘
      ▲
      │ pg_cron inside the database: liquidity injector, drift checks
      └── GitHub Actions: migrations (staging automatic, production gated)
```

**Key point for infrastructure work:** compute and database are already in the **same region** (Mumbai). Measured round trip is **5.34 ms**; the market list page renders at **0.692 s p50**.

---

## 4. Repository layout

```
src/
├── app/                      Next.js App Router
│   ├── (public)/             participant pages: market list, /m/[slug], /u/[pseudonym], /legal
│   ├── (auth)/               sign-in, OTP, onboarding
│   ├── (admin)/admin/        admin pages (separate login, cookie scoped to /admin)
│   └── api/                  route handlers: bets/place, bets/sell, uploads/sign,
│                             auth/[...all], health, visits, cron/*
├── components/               UI: shell, discovery, debate, profile, onboarding, legal, art, ui
├── db/
│   ├── index.ts              the Postgres client (pool settings live here)
│   └── schema/               14 files, 25 tables
├── server/                   all business logic, 28 domains (see §6)
└── lib/                      shared helpers, ranking maths, copy

drizzle/migrations/           31 SQL migrations, append-only (head: 0030)
docs/                         specs (SPEC.1 product, SPEC.2 technical), ADRs, runbooks, plans
tests/                        unit, integration, invariants, scale, staging runners
```

---

## 5. How the UI works

### 5.1 Rendering model
- **Server Components by default.** Pages fetch their own data on the server and pass plain, serialized objects to the browser.
- **`"use client"` only at the leaves** — components that need clicks, typing, timers or browser APIs.
- **Pages are read through server-side read models**, not a REST API. A page reads the database through a *read model* (for example `src/server/debate-view/`), which returns a view model; the browser never queries the database and never sees raw table rows. The one exception is `/m/[slug]/version`, a tiny endpoint the market page polls to ask **whether anything changed** before paying for a full refresh (#551) — it returns a version, never content, so removal masking still has a single home.
- **Writes** go through two route handlers (`/api/bets/place`, `/api/bets/sell`) and a small number of Server Actions (comment/sell/admin flows), all validated with Zod.

### 5.2 The three surfaces
| Page | Route | Read model |
|---|---|---|
| Market list ("Discovery") | `/` | `src/server/discovery/list.ts` |
| Market detail (the debate) | `/m/[slug]` | `src/server/debate-view/` |
| Profile | `/u/[pseudonym]` | `src/server/profile/` |

Plus `/legal`, the sign-in flow, and the admin area.

### 5.3 How the page stays fresh
- The market page refreshes itself by calling `router.refresh()`, which **re-runs the same server page** — no second data endpoint exists, so there is only one place where content masking can be applied.
- Cadence: **every 30 seconds**, and it **stops after 5 minutes without any mouse, touch, scroll or key input**, resuming immediately on the next input. Since #551 each tick first asks `/m/[slug]/version` whether anything changed, and only refreshes when it has.
- It also pauses while the tab is hidden or while a bet box is open, and stops permanently once a market is no longer open.
- The post carousel advances every 15 seconds; that is a browser-only timer and makes no server calls.

### 5.4 Styling and design rules
- **Tailwind v4, CSS-first**: colours and sizes are defined as tokens in `globals.css` (`@theme`), not in a JS config.
- **One dark theme.** A fixed neutral palette (`--color-n0 … n7`), with YES = black and NO = white as the two side colours.
- **shadcn/Radix primitives** for dialogs, buttons and inputs; 7 project-authored primitives for empty/loading/error blocks, time labels and tooltips.
- **One breakpoint, 640px.** Mobile rules are added as `max-mobile:` overrides on top of the desktop layout.
- **The market page and the profile page have a separate phone tree** (`components/debate/phone/`, `components/profile/phone/`) because those layouts have no desktop shape to reflow into. Phone leaves contain no write path; bets always go through the shared composer.
- Design rules are enforced by tests that read the source (token census, class checks, listener allow-lists), because there is no browser test runner installed.

---

## 6. How the backend works

### 6.1 Shape
All business logic lives under `src/server/<domain>/`, marked `server-only` so it can never be imported into browser code. Main domains:

`bets` · `cpmm` · `positions` · `lots` · `comments` · `dharma` · `markets` · `resolution` · `moderation` · `identity-pool` · `auth` (+ `auth/admin`) · `storage` · `idempotency` · `upstash` · `discovery` · `debate-view` · `profile` · `events` · `observability` · `system` · `middleware` · `config`

### 6.2 Event sourcing
Every state change appends a row to the `events` table (24 event types such as `bet.placed`, `comment.placed`, `market.opened`, `dharma.granted`). Read models are projections of that history. **Nothing is updated in place** in the append-only tables.

### 6.3 Money maths
All balances, prices and share counts are `NUMERIC(38,18)` in Postgres and `decimal.js` in TypeScript. **JavaScript floats are never used** for money.

### 6.4 Placing a bet — the critical path
```
POST /api/bets/place
  1. Rate limit (Redis)                 — fails OPEN (never blocks a bet)
  2. Idempotency check (Redis + DB)     — fails CLOSED (never double-charges)
  3. Validate input (Zod), stake floors and the 250 Đ ceiling
  4. Moderation (OpenAI) — OUTSIDE the transaction, never inside it
  5. ONE SERIALIZABLE transaction:
       SELECT the pool row FOR NO KEY UPDATE
       compute CPMM result   → insert comment → insert bet
       → update position + lots → append Dharma ledger row → append events
       → write the durable receipt
     (retry with jitter on serialization failure 40001/40P01)
  6. Return the receipt; the page refreshes and shows the new post
```

### 6.5 The four hard rules (invariants)
| ID | Rule | How it is enforced |
|---|---|---|
| INV-1 | A bet and its comment are one atomic unit | One SERIALIZABLE transaction + `bets.comment_id NOT NULL` |
| INV-2 | Dharma is non-transferable and can never go negative | No transfer table exists; `CHECK (balance_after >= 0)` |
| INV-3 | A comment's side is frozen when posted | `comments.side_at_post_time` is immutable |
| INV-4 | Resolutions and payouts are append-only | Database triggers reject UPDATE/DELETE/TRUNCATE |

### 6.6 Storage buckets (Cloudflare R2)
| Bucket | Holds | Served how |
|---|---|---|
| `uploads` | participant post images | short-lived signed GET URLs, cached 1 year by the browser |
| `market-media` | admin market images | same |
| `pfp` | profile pictures | public URL |

Upload path: the server signs a PUT URL → the browser uploads directly to R2 → the server verifies the object exists before attaching it. Images are screened at attach time; text moderation never blocks a post.

---

## 7. Data model

**25 tables managed by Drizzle**, in three groups:

| Group | Behaviour | Tables |
|---|---|---|
| **A — append-only** (11) | no UPDATE, no DELETE, no TRUNCATE; enforced by database triggers | `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts`, `liquidity_policy` |
| **B — append-only with one allowed flip** (3) | one `NULL → timestamp` transition, then immutable | `identity_pool`, `image_uploads`, `system_state` |
| **C — mutable** | ordinary rows | `positions`, `lots` (delete-guarded), `bookmarks`, `markets`, `pools`, `market_media`, `users`, `sessions`, `accounts`, `verifications`, `admin_sessions` |

A few operational tables are created by hand-written SQL rather than Drizzle: `liquidity_heartbeat`, `watermark_state`, `cron_alarms`, and the `events` table's monthly partitions.

**Migrations** are append-only files in `drizzle/migrations/` (31 today, head `0030`). A committed migration is never edited; a new one is written instead.

---

## 8. Authentication

| Who | How |
|---|---|
| **Participants** | Better Auth — Google OAuth, or email one-time code sent by Resend, with a Cloudflare Turnstile challenge. Session cookie scoped to `/`. |
| **Identity** | At signup a pseudonym and profile picture are taken from a pre-seeded `identity_pool`. Real names are never shown. |
| **Admin** | A completely separate login (`/admin/login`) with its own cookie scoped to `Path=/admin`. **The admin has no user row**, cannot bet, and holds no Dharma. |

---

## 9. Caching, limits and background jobs

**Caching**
- Shared page data (comments, ranking, totals) is cached per market for **15 seconds** and reused by every viewer.
- Price history is derived at most once every **60 seconds**; the live price is always read fresh.
- Image URLs are signed in ~46-minute windows, so the browser can cache the image itself for a year.

**Redis (Upstash) is used for**
- rate limiting (fails open), idempotency keys (fails closed), a short lock before moderation, the visitor counter, a cached header figure, and sampled cache statistics.

**Scheduled jobs**
| Job | Schedule | Where |
|---|---|---|
| `close-due-markets` | every minute | Vercel cron → `/api/cron/close-due-markets` |
| `alarms-drain` | every 5 minutes | Vercel cron |
| `r2-orphan-sweep` | every 6 hours | Vercel cron |
| Liquidity injector + alarm checks | scheduled inside Postgres | Supabase `pg_cron` |

---

## 10. Environments and deployment

| Environment | Branch | Database | Deploy |
|---|---|---|---|
| **Production** | `main` | Supabase prod | Vercel; migrations run **before** the new code is promoted |
| **Staging** | `staging` | Supabase staging | Vercel auto-deploy; migrations run automatically by GitHub Actions |
| **Local / preview** | any branch | local or staging | `pnpm dev` |

- Secrets come from **Doppler** (`prd`, `stg`) and are synced to Vercel.
- `/api/health` is the deployment gate. It returns environment, the deployed commit (`canary`), database status and migration status. **A deploy is verified by this endpoint, not by a command's exit code.**
- Schema changes are **expand-then-contract**: add first, never a destructive change on a live table.

---

## 11. Testing and quality gates

| Layer | What it covers |
|---|---|
| **Unit** (Vitest) | pure logic: CPMM maths, ranking, formatting, design-token guards |
| **Component** (jsdom) | rendering and interaction |
| **Integration** | real Postgres: bet atomicity, payouts, idempotency, rate limits |
| **Invariants** | 13 specs that prove the four hard rules and related database guarantees |
| **Scale** | opt-in battery: collision storms, hot-row contention |
| **Staging runners** | operational scripts against the live staging database, each guarded by five checks |

Before any change is called done: type-check → Biome → `next build`; critical paths also run the invariant and integration suites. There is **no end-to-end browser runner installed**; browser behaviour is checked manually or by driving Chrome directly.

---

## 12. Monitoring

- **Sentry** for server and browser errors, with a CSAM escalation path reserved.
- **PostHog** for product analytics.
- **`/api/health`** for deploy and uptime checks.
- Structured server logging; no request bodies are logged.

---

## 13. Environment variables (names only)

| Group | Variables |
|---|---|
| Core | `ZUGZWANG_ENV`, `DATABASE_URL`, `DB_POOLER_MODE` |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `ADMIN_PASSWORD` |
| Storage (per bucket ×3) | `R2_ENDPOINT_*`, `R2_BUCKET_*`, `R2_ACCESS_KEY_ID_*`, `R2_SECRET_ACCESS_KEY_*`, `R2_PUBLIC_URL_PFP` |
| Services | `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, Upstash Redis URL/token |
| Monitoring | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Jobs / platform | `CRON_SECRET`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION` |

⚠ **Three of these are needed at build time, not run time:** `ZUGZWANG_ENV` (baked into the bundle), `NEXT_PUBLIC_SENTRY_DSN` (the app refuses to start in staging/production without it) and `BETTER_AUTH_URL`. A build is therefore **specific to one environment** and cannot be promoted from staging to production.

---

## 14. Notes for an AWS migration (EC2 or ECS)

### 14.1 EC2 or Fargate — decided: ECS on EC2
Both run the same container. The difference is who manages the machine.

| | ECS on EC2 (**chosen**) | ECS Fargate |
|---|---|---|
| OS patching, scaling, AMIs | You | AWS |
| Cost at this size | ~$30/month `t3.medium` (~$18 reserved) | ~$41/month per 1 vCPU / 2 GB task |
| Orchestration | ECS — same rolling deploy, rollback, health checks, migration task | ECS |
| Fit here | **Chosen**: the team wants to own the machines | Less for the team to operate |

The application is a **single stateless Node process**, so either works. **ECS on EC2 is the chosen shape.** Only the capacity underneath changes: an auto scaling group with the ECS-optimised AMI and a capacity provider. The container, the deployment behaviour and every safety property are identical, which is why the switch touched one file.

### 14.2 Things that must be rebuilt (they are Vercel features today)
1. **Three cron jobs** — `close-due-markets` runs **every minute**; nothing else closes markets. Replace with EventBridge Scheduler (or a systemd timer on EC2) calling the same routes with a shared secret.
2. **`/api/health`'s `canary`** reads `VERCEL_GIT_COMMIT_SHA`. Off Vercel it becomes `null` and the deploy verification gate silently stops working. Pass the commit in as a build argument.
3. **Per-environment builds** — see the build-time variables above.
4. **Page caching across instances.** Next's cache is per process. With two or more instances, one instance's cache invalidation does not reach the others (a removed comment could linger for the cache window). Run **one instance** first, or add a shared Redis cache handler before scaling out.
5. **Static assets** — Vercel's CDN serves them today. Put CloudFront or Cloudflare in front, or the container serves every file itself.
6. **Outbound internet access** for Supabase, Upstash, R2, OpenAI, Resend, Sentry and PostHog: either a NAT Gateway (~$32/month) or public subnets with strict security groups.
7. **Migrations before serving** — run them as a one-off task/step before the new version takes traffic, and gate on `/api/health`.

### 14.3 What does *not* change
Supabase and its `pg_cron` jobs, all migrations, R2, Upstash, OpenAI, Resend, Sentry and PostHog. The application keeps talking to them over HTTPS exactly as it does now.

### 14.4 Rules that must survive any migration
- The four invariants in §6.5, and the append-only database triggers.
- Admin stays separate from participants: no user row, no Dharma, separate cookie path.
- No user-to-user Dharma transfer, ever.
- The write-freeze at **5 Nov 2026, 23:59 UTC** must not be bypassed.
- Do not cut over during a seeding run or in the final days before the freeze.

---

## 15. Where to read more (in this repository)

| Topic | File |
|---|---|
| Product rules | `docs/specs/SPEC.1.md` |
| Technical specification | `docs/specs/SPEC.2.md` |
| Architecture decisions | `docs/adr/` (0001 – 0051) |
| Deploy pipeline | `docs/runbooks/deploy-pipeline.md` |
| Build contract for contributors | `CLAUDE.md` |
| Stack patterns and conventions | `AGENTS.md` |
| AWS migration proposal (reviewed) | `docs/reports/aws-migration-proposal.html` |
