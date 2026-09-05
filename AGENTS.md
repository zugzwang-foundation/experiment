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
- **Framework:** Next.js `16.3.2`, App Router, React `19.2.4`, TypeScript strict. *(Bumped 16.2.4 → 16.3.2 at S-4 Phase B: `cacheComponents` needs the `instant` segment option, which 16.2.4 silently ignored — see §5 Caching and `next.config.ts`.)*
- **DB:** Postgres 17 on Supabase (ap-south-1, session pooler). Drizzle ORM `0.45`, `drizzle-kit 0.30`, `drizzle-zod 0.7`.
- **Auth:** Better Auth `1.6.11` (Google OAuth + email-OTP via Resend + Cloudflare Turnstile). See §H/§7.
- **Styling:** Tailwind v4 (CSS-first via `@theme`) + shadcn (`shadcn 4.7`, `radix-ui 1.4`, `tw-animate-css`).
- **Storage:** Cloudflare R2 via `@aws-sdk/client-s3 3.1045` + `s3-request-presigner`.
- **Cache / limits:** Upstash Redis (`@upstash/redis 1.38`, `@upstash/ratelimit 2.0.8`).
- **Moderation:** OpenAI omni-moderation (`openai 6.39`).
- **Email:** Resend `6.12`. **Canonical JSON:** `canonicalize 3.0`. **IDs:** `uuid 11`. **Validation:** `zod 3.25`.
- **Observability:** Sentry (`@sentry/nextjs 10.53`) + PostHog (`posthog-js 1.376`, `posthog-node 5.35`). Two-vendor. **No Axiom.**
- **Tooling:** `pnpm 10.33.2` (the `packageManager` field), Biome `2.4.13`, Lefthook `2.1.6`, `just`, `tsx 4.22`, Vitest `3`, fast-check `4.8.0`.
- **Build-script approval: `package.json` → `pnpm.onlyBuiltDependencies` is the live list.** It is `esbuild`, `lefthook`, `sharp`. ⛔ **`pnpm-workspace.yaml`'s `allowBuilds` map is DEAD CONFIG in this repo and its extra entries do nothing.** Measured against pnpm 10.33.2: if `package.json` carries `pnpm.onlyBuiltDependencies` **at all — even as an empty array —** `allowBuilds` is never consulted (`allowBuilds` desugars via `settings.onlyBuiltDependencies ??= []`, and `??=` is a no-op once the key exists). Consequence on disk: `@sentry/cli` and `protobufjs` are listed `true` in `allowBuilds`, are absent from `package.json`, and **their install scripts therefore never run.** ⚠ **That does NOT leave `@sentry/cli` without a binary, and this line said it did.** Measured 2026-09-02 on a fresh `pnpm install --frozen-lockfile` at `4c041633`: `@sentry/cli-darwin@2.58.6` ships a **36 MB prebuilt** `bin/sentry-cli`, and running it answers `sentry-cli 2.58.6` at exit 0 — because `@sentry/cli` 2.x delivers its binary through a platform-specific OPTIONAL DEPENDENCY. ⚠ It **does** declare a `postinstall`, and that is the precise point rather than a caveat: `scripts/install.js` resolves the platform package FIRST and skips the manual download when that succeeds, so with the optional dependency present there is nothing the blocked build script would have fetched. The 487-byte file under `@sentry/cli/bin/` is the shim that resolves to it. **Source-map upload is unaffected.** The two claims are separate: *the script never ran* is measurable and true; *therefore the binary is missing* was inferred, and is false. That is the same shape SYNC-5's own reviewer pass named in this very PR — a fact measured at HEAD extrapolated into a consequence HEAD cannot support — and it survived into the correction itself. `protobufjs` was not measured and inherits no verdict from this. **Add a new build-script approval to `package.json`.** Adding it only to `allowBuilds` will silently do nothing. *(This line has now been wrong twice: it first read "Not a `pnpm-workspace.yaml` allow-list" — true when written, false once that file appeared — and SYNC-5 then over-corrected it to "TWO files carry it … which one pnpm honours is version-dependent", which presented a dead map as a live peer. It is not version-dependent; it is measurable, and it was measured at SYNC-5 Gate C across eight installs with a negative control.)*
- **Not installed yet:** Playwright / any E2E runner; `commitlint`.

---

## 2. Setup & commands (the real `justfile`)

`just` is the task entry point; `set dotenv-load := true` sources `.env.local` for every recipe.

```bash
just                  # = `just list` — print every recipe (the `default` recipe)
just list             # just --list
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
│   │   │                           #   _lib/session.ts              — the route group's viewer-session read
│   │   │                           #   ⛔ NO bookmarks/ route. UI-A6 shipped it and
│   │   │                           #   ADR-0040 UNWIRED it — the route, the read model
│   │   │                           #   (src/server/bookmarks/) and the components are all
│   │   │                           #   gone from disk. The `bookmarks` TABLE survives
│   │   │                           #   (src/db/schema/bookmarks.ts, migration 0024).
│   │   ├── api/                    # _smoke-error, auth/[...all], bets/{place,sell}, cron/{r2-orphan-sweep,close-due-markets,alarms-drain}, health, uploads/sign, visits
│   │   ├── globals.css, layout.tsx, not-found.tsx, global-error.tsx
│   ├── components/                 # `ls -d src/components/*/` — EIGHT as at 2026-09-02:
│   │                               #   art/ debate/ discovery/ legal/ onboarding/ profile/
│   │                               #   shell/ ui/. ⚠ The COMMAND is the claim; the list is a
│   │                               #   reading of it. Both sides of the SYNC-5 merge carried
│   │                               #   this list and each was wrong in a different place —
│   │                               #   SYNC-5's had dropped art/, main's had dropped
│   │                               #   onboarding/, BOTH had dropped legal/, and main's
│   │                               #   still named bookmarks/ after ADR-0040 deleted it.
│   │                               #
│   │                               #   debate/ gained five components at HTML-FINISH ·
│   │                               #   MARKET DETAIL: HeadZone (the arm-scoped two-column
│   │                               #   header frame), MarketMediaPanel, FocusMarketCard
│   │                               #   (the post arm's rail — and the EXIT), ResolverCards
│   │                               #   (⚠ the NAME is now narrow and deliberately kept —
│   │                               #   RESO-1 turned the two "resolver + X-official" cards
│   │                               #   into FOUR evenly-placed vertical blocks from one
│   │                               #   hardcoded fixture. Chrome and labels land — and since
│   │                               #   BLOCK-1 (#447) so do the VALUE and SUBVALUE lines, for
│   │                               #   all eight live markets, from a static per-slug map with
│   │                               #   NO migration, so `markets` still carries no
│   │                               #   resolver/logo/source/handle column. ⚠ This line said
│   │                               #   "the DATA fields are still empty" until 2026-09-02 —
│   │                               #   true when SYNC-5 measured it, false by the time that
│   │                               #   work merged, because BLOCK-1 landed in between.
│   │                               #   `ResolverCards.tsx`'s own docblock states the reversal
│   │                               #   and names THIS list as the site to fix. ⚠ It also moves
│   │                               #   the placeholder inventory: with the resolution blocks
│   │                               #   out of it, FIVE placeholders of TWO kinds remain
│   │                               #   (market-media, post-image) against SEQUENCE #5's
│   │                               #   "four" — the docket text is NOT corrected here. It rendered
│   │                               #   `null` until round 2's R2 reversed OD-2; see
│   │                               #   docs/parked.md SEQUENCE #5, strip or gate before the
│   │                               #   DP.2 promote), ScrollRail (the rail — and, since R3,
│   │                               #   the auto-advance countdown). Since HTML-FINISH the
│   │                               #   directory has ALSO gained CriterionDisclosure (CRIT-1),
│   │                               #   DebatePoll, and chart/ (CHART-1, the price chart).
│   │   ├── art/warli/              #   WARLI-1/2 — a decorative SVG art layer, MOUNTED
│   │                               #   AT ONE SITE: `src/app/(auth)/layout.tsx`, as a
│   │                               #   `pointer-events-none fixed inset-0 -z-10` underlay
│   │                               #   behind /sign-in, /sign-in/otp and /onboarding
│   │                               #   (WARLI-MOUNT). The count and the site are BOTH
│   │                               #   pinned — `tests/unit/art/art-layer-guards.test.ts`
│   │                               #   asserts the importer list is exactly that one file
│   │                               #   (it asserted the EMPTY list until this mount), and
│   │                               #   `tests/unit/shell/sticky-header.test.ts` pins it as
│   │                               #   the tree's only UNDERLAY — the first `fixed`
│   │                               #   node here that goes UNDER rather than over.
│   │                               #   Two counter-rotating rings — 8 FACED
│   │                               #   figures inner, 12 faceless outer — around a still
│   │                               #   centre the auth card sits in, inside a STATIC
│   │                               #   field of 28 more figures, 104 motifs, 330 ground
│   │                               #   marks and a four-edge border stack (WARLI-2).
│   │                               #   ⚠ ONLY THE TWO RINGS ROTATE; everything else is
│   │                               #   painted once. Before WARLI-2, 497 of 497 drawn
│   │                               #   shapes sat in an animated group — measured.
│   │                               #   `scene.ts` places the static population from
│   │                               #   seeded loops (no Math.random, no clock anywhere in
│   │                               #   the layer — the ring engine's determinism guard
│   │                               #   depends on it), and `primitives/wobble.ts` bows
│   │                               #   every straight run into a quadratic whose CONTROL
│   │                               #   POINT carries the noise and whose ENDPOINTS never
│   │                               #   move — which is what lets the hand chain and the
│   │                               #   equal-reach guard survive a change to every mark.
│   │                               #   Sealed OUTBOUND: it imports nothing but
│   │                               #   `react` and its own files (asserted by
│   │                               #   tests/unit/art/). ⚠ THE INBOUND HALF OF THAT
│   │                               #   SENTENCE IS DEAD — it used to read "and nothing
│   │                               #   imports it", which WARLI-MOUNT made false; the
│   │                               #   same test now asserts exactly one importer, named
│   │                               #   above. Outbound seal and inbound count are two
│   │                               #   claims, and only the first is still a zero.
│   │                               #   ⚠ IT IS THE
│   │                               #   ONLY COMPONENT IN THE TREE THAT EMBEDS ITS OWN
│   │                               #   `<style>` AND AUTHORS `@keyframes` — necessary,
│   │                               #   because Tailwind's `animate-spin` is NOT in this
│   │                               #   app's built CSS (measured: the only keyframes
│   │                               #   emitted are enter/exit/pulse), so the obvious
│   │                               #   utility would have produced rings that silently
│   │                               #   never turned. Names are `warli-` prefixed and
│   │                               #   collision-free. Copy the pattern only when the
│   │                               #   same measurement holds; it is not a general
│   │                               #   licence to ship component-scoped stylesheets.
│   │   └── ui/                     #   16 files, and they are NOT all shadcn. NINE shadcn
│   │                               #   primitives: avatar, badge, button, card, dialog,
│   │                               #   input, separator, skeleton, textarea. SEVEN are
│   │                               #   project-authored — empty-block (P1), loading-block
│   │                               #   (P7), error-block (the route-boundary family; canon
│   │                               #   §10 C-STATES-1 rules it NEITHER P1 NOR P7),
│   │                               #   thumb-glyph (canon §3 item 13, pinned by component
│   │                               #   name and props), relative-time (canon §3 item 14 + the
│   │                               #   §6 copy register's `Argument age` entry, pinned the same
│   │                               #   way — TIME-1's age at the end of every card's identity
│   │                               #   row, on all four card surfaces), and info-tip (INFO-1 —
│   │                               #   the one affordance that opens on both pointer hover and
│   │                               #   touch tap; composes radix-ui's Tooltip and Popover,
│   │                               #   picked per-render on `(hover: hover) and (pointer:
│   │                               #   fine)`; not yet canon-ratified — the others are, this
│   │                               #   one landed the same night), and field-separator (SEP-1 —
│   │                               #   the author row's `.vsep` pipe, lifted out of THREE private
│   │                               #   copies in `debate/ArgProfile`, `discovery/HeroPanels` and
│   │                               #   `profile/ArgumentList` after those copies drifted: one lost
│   │                               #   the divider before its timestamp and the other two kept it.
│   │                               #   ⚠ It is the one leaf here that states its OWN font-size and
│   │                               #   inherits none — the inverse of relative-time's split,
│   │                               #   because a seam that changes size per surface is the drift
│   │                               #   it exists to end). Don't reach for a shadcn
│   │                               #   generator to change one
│   ├── db/                         # ← Drizzle client + schema live HERE (not src/server/db)
│   │   ├── index.ts                #   the drizzle client
│   │   └── schema/                 #   14 files: _enums, audit, auth, bets, bookmarks, comments,
│   │                               #   dharma, events, identity, image-uploads, index, lots, markets, system
│   ├── lib/                        # `ls src/lib/` — TEN entries as at 2026-09-02: auth-client,
│   │                               #   errors, legal-sections, relative-time, utils,
│   │                               #   ranking{,.config,-decimal}, copy/, posthog/. The command
│   │                               #   is the claim; the list is a reading of it.
│   └── server/                     # server-side business logic — 28 dirs (re-measured at SYNC-5,
│                                   #   2026-08-28: the line read 29 and had counted `bookmarks/`,
│                                   #   which ADR-0040 deleted. Measure with `ls -d src/server/*/ | wc -l`.)
│       ├── admin/                  # actor (assertAdminActor — the R-14.5 belt; ENGINE.14)
│       ├── auth/                   # index, email-otp, session-gate, onboarding-ref, tos-*, logout
│       │   └── admin/              # login, logout, validate (admin path)
│       ├── bets/ comments/ config/ cpmm/ debate-export/ debate-view/ dharma/ events/ github/ health/ idempotency/ identity-pool/ onboarding/
│       ├── discovery/              # ← list.ts is the Discovery read model. PERF-1 was here and is CLOSED (see the callout below §3's tree) — no go-live blocker row remains
│       ├── markets/                # transitions, errors + ENGINE.14: transaction (W-4), create, open, close (incl. the closeDueMarkets sweep)
│       ├── lots/                   # ← LOTS-1 / ADR-0039. compute (the pure core: mintLot · sellFromLot · allocateProRata · sumLots), persist (the ONLY `lots` write path), errors, basis (Đa = Σ surviving_basis)
│       ├── middleware/ moderation/ observability/ positions/ profile/ resolution/ storage/ system/ upstash/ visitors/
├── tests/                          # dedicated dir (NOT colocated) — see §9
├── docs/{adr,specs,logs,plans,…}
├── drizzle/migrations/             # generated + hand-written; append-only — DO NOT EDIT
├── scripts/                        # tsx operational scripts (seed, verify, migrate-staging, smoke)
├── supabase/                       # ⚠ NOT TRACKED — 0 files under version control
│                                   #   (`git ls-files 'supabase/*'` → 0; control:
│                                   #   `git ls-files 'scripts/*'` → 27 as at 2026-09-02 — RUN
│                                   #   the control, never trust the figure: its only job is to
│                                   #   prove the pattern finds files at all, so any non-zero
│                                   #   discharges it and the exact number is disposable).
│                                   #   `.gitignore` ignores the whole
│                                   #   directory, so a fresh clone or worktree has none of
│                                   #   it — but the operator's working tree DOES: the
│                                   #   Supabase CLI writes `.branches`, `.temp`, `snippets`
│                                   #   there, exactly as `.gitignore`'s own comment predicts.
│                                   #   ⚠ Do not read its absence in a worktree as absence —
│                                   #   a worktree cannot see gitignored files, so that
│                                   #   reading is unfalsifiable by construction. No
│                                   #   migrations dir and none is planned — RLS is out of
│                                   #   scope (ADR-0019); if one is ever minted, `.gitignore`
│                                   #   already says to add `!supabase/migrations/`.
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

⛔ **Bookmarks is NOT a surface any more.** It shipped at UI-A6 (ADR-0032) and **ADR-0040
unwired it**: `src/app/(public)/bookmarks/`, `src/server/bookmarks/` and
`src/components/bookmarks/` are all absent from disk. What survives is the `bookmarks`
TABLE (`src/db/schema/bookmarks.ts`, migration `0024_bookmarks`) — schema kept, surface
withdrawn. This table previously listed Bookmarks as a live route; it did not, and a
session planning against that row would have looked for three directories that are gone.

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

**Caching. ⚠ `cacheComponents` IS ENABLED** — the `cacheComponents` key in `next.config.ts`, landed at S-4 Phase B (ADR-0041). This line previously said it was NOT enabled and that the config was "a Sentry wrapper + env injection only"; both are now false and the difference changes how you write every route. With the flag on: Partial Prerendering is the default, `'use cache'` / `cacheLife` / `cacheTag` are available, and **cookies/headers must be read OUTSIDE a cached scope**. A segment not yet restructured for the framework's instant-navigation validation opts out with `instant = false` (this is why Next had to go to `16.3.2` — `16.2.4` silently ignored `instant`). `next.config.ts` also carries `agentRules: false` (the 16.3.x dev/build step otherwise appends a generated `agentRules` block to **this file** on every run) and `outputFileTracingIncludes` for `/api/health` (the migration files) and `/m/[slug]/export` (`public/zugzwang.md`). No Turbopack flags are set.

**`params` / `searchParams` are Promises** (Next 15+). `const { id } = await params;`.

---

## 6. Database — Drizzle + Postgres

### Schema conventions

- **PKs:** UUIDv7 — `uuid("id").primaryKey().default(sql\`uuidv7()\`)`. The userspace `public.uuidv7()` function ships in **`drizzle/migrations/0000_uuidv7_function.sql`**.
- **Timestamps:** `timestamp("…", { withTimezone: true })` everywhere.
- **Money / Dharma:** `numeric("…", { precision: 38, scale: 18 })`.
- **Enums:** `pgEnum`. `side` is `["YES","NO"]`, extracted to `src/db/schema/_enums.ts` to break the `bets ↔ comments` runtime-eval cycle. `dharma_entry_type` (column `entry_type`, **not** "reason") has 10 values: `bet_stake, bet_payout, daily_allowance, pool_seed, pool_unwind, correction_reverse, correction_apply, void_refund, uncollectable, initial_grant` (`initial_grant` appended by ENGINE.5 / R-1; `pool_seed`/`pool_unwind` dormant in v1, R-2).
- **Indexes** inline in the second `pgTable` arg. **FKs** always declared and indexed on the referencing side; circular pairs use the lambda form `(): AnyPgColumn => other.id`.
- **One file may hold several related tables.** 24 tables live across 12 table-bearing files — e.g. `bets.ts` (bets + positions + bet_receipts), `events.ts` (events + resolution_events + payout_events), `markets.ts` (markets + pools + market_media). *(`src/db/schema/` holds 14 files; `_enums.ts` and `index.ts` declare no table, which is why the footer's "24 tables / 14 schema files" and this line's 12 are both right. Re-measured at MERGE-1 — this read "23 tables across 11 files" while six other lines in this file were moved at PHASE-0 and the footer already said 24.)*

### Reply-as-bet schema reality

- `bets.comment_id` — **`NOT NULL`**, FK to `comments.id` (the built half of INV-1). Indexed.
- `comments.bet_id` — **EXISTS but NULLABLE by design**; INV-1 is enforced via `bets.comment_id` NOT NULL + the W-1 atomic transaction, not via `comments.bet_id` (the circular pair sets only the `bets.comment_id` direction at write time; Bucket-A append-only forbids a later back-fill) — **not** a pending NOT-NULL migration (ADR-0017 ranking reconciliation, DEBATE.8). Indexed (`comments_bet_id_idx`, migration 0008).

### Append-only buckets

- **Bucket A — fully append-only** (10 tables: events, dharma_ledger, bets, comments, resolution_events, payout_events, mod_actions, admin_events, user_events, bet_receipts). Protected by `0003_append_only_triggers.sql` (row-level UPDATE/DELETE) + `0021`/`0022` (statement-level TRUNCATE, ADR-0030); `bet_receipts` (AUDIT-FIX-B3 / ADR-0031) ships all three guards in `0022` reusing the shared functions. Reject UPDATE/DELETE/TRUNCATE at the storage layer.
- **Bucket B — append-only with whitelisted column transition(s)** (3 tables: identity-pool, image-uploads, system-state). Each permits a one-shot `NULL→timestamp` transition on a whitelisted column — e.g. `system_state.frozen_at` flips once then is immutable (`image_uploads` transitions `terminal_state` + `terminal_at` together). All other column changes, every DELETE, and every TRUNCATE are rejected at the storage layer (TRUNCATE statement-level, ADR-0030).
- **Bucket C — mutable** (e.g. `positions`, `bookmarks`, `lots`).
  - ⚠ **`lots` is Bucket C and carries a DELETE guard, which no bucket name covers** (ADR-0039 D-1, SPEC.2 §5.2; added at MERGE-1, where this line still read *"e.g. `positions`"* alone). Its shape is narrower than either family: the row may CHANGE — that is what `surviving_shares` is for — in ONE direction, forever, and may never LEAVE. Calling it Bucket A would assert UPDATE is forbidden, the opposite of true. So migration `0026` gives it a row-level `BEFORE DELETE` reject named `lots_no_delete` **deliberately outside the `bucket_%` family**, so it enters neither the §6 append-only contract nor the staging reset's guard catalogue — both of which it would misdescribe. **The protected count is unchanged at thirteen**, and `EXPECTED_GUARD_CATALOG_ROWS` stays 78.

### Migrations (`drizzle/migrations/`)

- Generated via `just db-generate <name>`; **append-only — never edit a committed migration, write a new one.** Destructive migrations need PR sign-off + a backup snapshot first.
- The `events` table partitioning is **hand-written** (`PARTITION BY RANGE`) in `0002_events_partitioning.sql` and **excluded from drizzle-kit** via `drizzle.config.ts` → `tablesFilter: ["!events"]`.
- pg_cron-coupled migrations (`0007_pg_cron_jobs.sql`, `0011_position_drift_pg_cron.sql`) carry `cron.schedule()` (and `0007` the `CREATE EXTENSION pg_cron`); CI strips those statements from every `*pg_cron*.sql` before applying (the CI runner has no pg_cron).
- Current head: `0026_lots_no_delete` (0016 = `mod_actions.reason` for the reactive-moderation foundation, PR #143; 0017 = drop `comments.stake_at_post_time` (DEBATE.8); 0018 = drop `friendly_fire_events` (DEBATE.9); 0019 = `market_media` (MEDIA.1); 0020 = `dharma_ledger.seq` total-order (AUDIT-FIX-B2 / ADR-0029); 0021 = TRUNCATE guards (AUDIT-FIX-B2 / ADR-0030); 0022 = `bet_receipts` durable idempotency receipts + same-file Bucket-A guards (AUDIT-FIX-B3 / ADR-0031); 0023 = `positions_market_id_idx` W-3 settle-read + FK-convention index (AUDIT-FIX-B7b / A31); 0024 = `bookmarks` (UI-A6 / ADR-0032, PR #254); 0025 = `lots` (LOTS-1 / ADR-0039 — Bucket C, no back-fill, seven CHECKs); 0026 = `lots_no_delete` (PHASE-0 / ADR-0039 R9 — a row-level `BEFORE DELETE` reject, deliberately NOT `bucket_%` and deliberately NOT a TRUNCATE guard, so `lots` stays Bucket C, `EXPECTED_GUARD_CATALOG_ROWS` stays 78, and `TRUNCATE bets CASCADE` still empties it)).

### Transactions, queries, validation

- **Any multi-write user action runs in `db.transaction(...)`.** Bet placement is `SERIALIZABLE` + `SELECT … FOR NO KEY UPDATE` on the pool row with full-jitter retry on `40001/40P01` (ADR-0013) — landed at ENGINE.7/8 (W-1 `src/server/bets/transaction.ts` + `endpoint.ts`); the market-lifecycle W-4 (`src/server/markets/transaction.ts`) and resolution W-3 (`src/server/resolution/transaction.ts`) wrappers mirror the same retry spine.
- Drizzle query builder for typed reads; raw `sql<T>` only for hot paths. Avoid N+1 (`db.query.<t>.findMany({ with })`). Don't `SELECT *` in hot paths. Don't expose Drizzle row types in API responses — map to DTOs in the server layer.
- **`drizzle-zod`** (`createInsertSchema` / `createSelectSchema`) derives zod schemas from tables — one source of truth for shape.

### Events

`events.event_type` is **`text`** (open-extensibility, SPEC.2 §7.1), **not** a `pgEnum`. The closed value set is the TS const `EVENT_TYPES` in `src/server/events/schemas.ts` (currently 24 values: 4 `image_upload.*`, 5 `user.*`, 2 `admin.*`, 7 `market.*`, 2 `bet.*`, 1 `comment.*`, 2 `dharma.*`, 1 `moderation.*` — `moderation.blocked`, AUDIT-FIX-B5), compile-guarded by `as const satisfies Record<EventType, …>`. When a new event type is added, extend `EVENT_TYPES` **and** its Zod payload schema in the **same commit** (enum-hygiene).

---

## 7. Server stack — `server-only`, middleware, handlers

- Files under `src/server/**` that touch the DB or secrets import `server-only`. **Scripts run under `tsx` must not delegate into the `@/db` → `server-only` chain** — inline their own `postgres()` client (the staging-seed/smoke pattern).
  - ⚠ **ONE EXCEPTION, and it is narrow: a script whose subject IS the shipped client.** A verification control that must observe the pool options, connection string or pooler the app actually ships **may** import `@/db`, and must then be invoked as **`tsx --conditions=react-server`**. `server-only`'s package exports map `react-server` → an empty module and `default` → a module whose whole body is a `throw`, so plain `tsx` dies on the import before a line of the script runs; the condition flag is what makes the shipped singleton reachable (measured 2026-08-22 — plain `tsx` throws, `--conditions=react-server` imports clean). **The rule above still governs everything else.** The distinction is what the script is *for*: a seeder or a smoke check needs *a* connection and should inline one, but a control needs *the* connection — and a copied client is a copy, free to drift from the shipped pool options, at which point the control is exercising a connection nobody ships and passing while it does. That is the failure mode a control exists to catch, reproduced inside the control. **Sole instance: `scripts/verify-pooler-mode.ts` (S-1).** Adding a second is a decision, not an edit.
- **Structured logging** via the `src/server/middleware/logging.ts` logger — no `console.log` in server code (a convention today, *not* a Biome rule; `console.error` does appear in auth). No request bodies in logs.
- Middleware: `logging`, `origin-allowlist`, `rate-limit`, `envelope` (the §4.4 wire helpers for non-bet Route Handlers — attributed duplication of the bets-private copies, AUDIT-FIX-B7b A29; unification rides ENGINE.8 Q4). Idempotency store + lock in `idempotency/` + `upstash/`. Moderation is `moderation/precommit.ts` (OpenAI **before** the bet tx, guarded by a Redis SETNX reservation; fail-closed on terminal — ADR-0014). Rate-limit fails **open**; idempotency fails **closed** (ADR-0015). ⚠ **`per ADR-0046 — MOD-1 pending`.** ADR-0046 supersedes ADR-0014's gate architecture: moderation is **advisory**, the invariant being *a post is never blocked by moderation, and an image is never served before it has been screened* — text fire-and-forget, images screened at attach. **The sentence above is what is on disk and stays until MOD-1 lands**, because this file is descriptive; `CLAUDE.md` §2 carries the ruling. The two disagreeing is the correct interim state and this marker is what makes the disagreement legible rather than accidental. What ADR-0046 does *not* touch, and what therefore is not pending: the vendor, the category taxonomy, the Redis reservation, idempotency-first ordering, and the rule that no Postgres transaction is held across the OpenAI call.
- **Better Auth custom `users` columns:** the drizzle adapter persists only fields in Better Auth's user model (6 core + `user.additionalFields`). Any custom `users` column written through a `databaseHook`/`mapProfileToUser` **must** be declared in `user.additionalFields` (`type:"string"`, `required:false`, `input:false` for server-only/identity fields) or it is silently stripped before INSERT — the cause of the `unable_to_create_user`/`23502` null-`pseudonym` signup bug (FIX-AUTH-SIGNUP). `input:false` also blocks client identity-spoofing at `parseInputData`.
- **Better Auth `session.expiresIn` → cookie `Max-Age` 400-day ceiling:** `expiresIn` is fed straight into the session-cookie `maxAge` by Better Auth's `setSessionCookie`, and the better-call cookie serializer **throws** when `maxAge > 34,560,000 s` (400 days). The throw fires at **cookie-serialization time on sign-in, not at token creation**, surfacing as an uncaught 500 for onboarded/returning users (first-time signup is deferred by the `session.create.before` onboarding gate, which masks it). Cap `expiresIn` at `SESSION_MAX_AGE_SEC = 60*60*24*400`; modern browsers (Chrome 104+) clamp `Max-Age`/`Expires` to the same 400-day ceiling regardless (FIX-AUTH-LOGIN / ADR-0004 Patch P1; SPEC.2 §8.2).
- **`nextCookies()` (from `better-auth/next-js`) MUST be the last entry in `plugins:`** — Better Auth's own runtime warns otherwise. It's what lets an `auth.api.*` call made from a Server Action (not a route handler) actually set a cookie the browser receives: its `after` hook replays any Set-Cookie the call produced onto `next/headers`'s `cookies()`, since a bare programmatic `auth.api.*` call has no HTTP response of its own to carry one. ADR-0004's Flow-constraints table named this pattern and routed it here; landed at AUTH-DBL-1, the first caller (`src/server/auth/tos-accept.ts`'s `acceptTosAction`) that needed it wired in. For an endpoint that must stay in-process-only (never reachable over HTTP), give its `createAuthEndpoint(...)` options `metadata: { SERVER_ONLY: true }` — better-call excludes it from the router's route table entirely (not just a request-time 404), so `auth.api.<name>(...)` still works while `POST /api/auth/<path>` 404s. Stronger than a `disabledPaths` denylist, which is a separate request-time string match that can diverge from the router's own path-matching.

---

## 8. Frontend — Tailwind v4 + shadcn

- **CSS-first config** in `src/app/globals.css`: `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`, then `@custom-variant dark`. **`postcss.config.mjs`** loads `@tailwindcss/postcss` (Next.js needs it).
- **Hex authoritative in `@theme`** (BRIDGE / OQ-2): colour tokens land as 6-digit **lowercase** hex (Biome's CSS formatter normalizes case — uppercase is a format error); **oklch may appear in comments only**. The census achromatic rule is **R == G == B** on the hex. Defining `--color-yes` auto-generates `bg-yes`, `text-yes`, etc. *(Supersedes the SHELL/UI.0-era "OKLCH only" rule.)*
- **Tokens are BRANDED (dark, values-log v0_3 §3).** The `@theme` block in `globals.css` carries the branded dark system landed at BRIDGE onto the frozen contract slots: page ground `--color-ground` `#181818` (generates `bg-ground`; outside the 11-token census), the true-neutral ramp `--color-n0 … --color-n7` + `--color-ink` — achromatic, running **dark → bright** (`n0 #212121` darkest card surface … `n7 #e4e4e4` brightest emphasis, `ink #fafafa`; **inverted vs the retired light ramp — never copy by lightness**) — and the side poles `--color-yes` = `#181818` (YES side = black) / `--color-no` = `#fafafa` (NO side = white). The poles name the **SIDE** (YES/NO), never the Support/Counter relation. Single dark theme lives in `:root`/`@theme`; the `.dark` block is **descoped-inert** (never applied; its two chromatic strays neutralized). `--destructive` is neutralized to `var(--color-n6)`. The shadcn semantic `:root` slots alias the same primitives via `var()` chains (tier-2; `--sidebar-*` mirrors its `--X` — OQ-8). The raw-props `:root` block adds the applied-semantic / state / elevation / radius tokens (`--surface-*`, `--text-*`, `--graph-yes/no`, `--state-*` ×8, `--elev-0..3`, `--r`/`--r-chip`/`--r-dot`, `--avatar-ring`, `--dur-hover`, `--overlay`, `--btn-fill`, `--border-strong`). No accent: nothing named `--color-brand` exists (true-neutral ratified; contract §2.2 stays reserved-empty). `--font-sans/mono` → Geist, **ratified FINAL** (WI-13; Lucide FINAL alongside). `--imgr` is **ratified** (6px — images, avatars, media, graph panels; values-log §3 item 2). Guarded by `tests/unit/design/tokens-monochrome.test.ts` — exact hex pins, 11-count census, ground/graph/destructive pins, string bans.
- **`--breakpoint-mobile: 640px` is the repo's ONE minted breakpoint, and every mobile rule is an ADDITIVE `max-mobile:` override behind a `mobileResponsive` prop** (MOBILE-1 Phase A / ADR-0045, the first breakpoint this repo has ever minted; ADR-0045 calls the convention "a new convention future work must follow consistently"). It lives in the plain `@theme` block beside the branded ramp — a `--breakpoint-*` outside `@theme` is an ordinary custom property that resolves in `var()` and generates **no variant at all**, silently. It generates `mobile:*` (≥640px) and `max-mobile:*` (<640px). **Three rules, and each exists because its violation fails quietly:**
  - **Override, never replace.** Desktop stays the unprefixed default; a mobile rule is a `max-mobile:` token *appended* to the existing class string. That is what makes "zero desktop regression" structural rather than a thing to re-measure — but ⚠ **only for tokens that are genuinely inert above 640px**, which an unprefixed class added alongside is not: `HeroPanels.tsx:137`'s `grid-cols-1` is live below 768px and is deliberate, not a counter-example.
  - **⛔ GATE IT ON A PROP, AND THREAD THE PROP THE WHOLE WAY DOWN.** `GlobalHeader` is mounted by BOTH `(public)/layout.tsx` and `(auth)/layout.tsx`, and ADR-0045 leaves auth/join surfaces *"gated, not made responsive."* So every reflow class is `cn(base, mobileResponsive && "max-mobile:…")`, the prop **defaults `false`** (a mount that forgets it inherits the desktop render rather than an accidental reflow), and only `(public)` opts in. ⚠ **The gate is the prop chain, not the file boundary** — a class left unconditional two components down reaches `(auth)` exactly as surely as one written in the layout's own file, which is how `OnboardingDeck` shipped three ungated classes onto `/sign-in` through `GlobalHeader → RulesControl → OnboardingDeck`. Guarded by `tests/unit/shell/global-header-mobile-reflow.test.ts`.
  - **⚠ IT IS NOT A SYNONYM FOR `sm`, AND THE GAP IS AN ACCESSIBILITY SETTING.** Tailwind ships `--breakpoint-sm: 40rem` (unoverridden here); this token is `640px`. Equal at a 16px root font size and at no other — at a 20px root, `sm` fires at 800px and `mobile` at 640px, with both boundaries live in one stylesheet. `px` is deliberate (a device viewport does not grow when someone enlarges their text), so **do not "fix" the value**; know that a `max-mobile:` override and an `sm:`/`md:` rule do not reliably hand off to each other.
  - ⚠ **Tailwind v4 source detection scans `docs/`.** A class-shaped string written in prose becomes a real emitted utility — `docs/logs/MOBILE-1.md` alone put `max-mobile:grid&#8203;-cols-2` into the built stylesheet, restoring a rule the code had reverted. The cost is not the bytes: **the built sheet stops being evidence of what components use.** Break the string when naming an unshipped class in a doc.
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
├── db/            _fixtures/, identity-pool/, indexes/ (positions-market-id pg_indexes assert — the catalog-assertion mint, AUDIT-FIX-B7b), triggers/ (13 append-only specs, one per protected table — +bet-receipts-append-only, AUDIT-FIX-B3 — plus truncate-rejected.spec, plus lots-no-delete.spec: NOT an append-only spec — `lots` is Bucket C and the file's third test is a POSITIVE control proving `TRUNCATE bets CASCADE` still empties it)
├── integration/   36 *.integration.test.ts (admin-moderation-audit-feed, alarms-drain,
│                  auth-dbl-1-first-login-session, composer-image, composer-place, composer-reply,
│                  composer-sell, cross-user-idempotency, debate-export, dharma-chain-drift-drain,
│                  dharma-ledger, email-otp-send, header-balance, header-portfolio, idempotency-cache — the
│                  former idempotency suite, renamed — market-by-slug, market-media-selection, market-quote,
│                  migration-drift, nightly-drift-resolution, oauth-orphan-fallback,
│                  oauth-signup-pool-deadlock, onboarded-login-session, orphan-sweep, positions, post-param,
│                  precommit-moderate, profile-statement-count, rate-limit, resolution-conservation,
│                  sign-read, sign-upload, signup-create-path, staging-reset-mechanism, upstash-lock,
│                  viewer-context)
├── invariants/    `ls tests/invariants/ | wc -l` — 13 as at 2026-09-02; the command is the claim. See the Invariant-tests bullet below
├── scale/         8 *.scale.test.ts (the ENGINE.10 Q-2 correctness-at-scale battery) + _fixtures/, _harness/ — opt-in only, see the Scale bullet below
├── staging/       OPERATIONAL RUNNERS, not tests — THREE runners (reset.staging.test.ts · generate.staging.test.ts · gates.staging.test.ts) + fixtures.ts (the literal fixture table) + _lib/ (target, client, read-client, write-guard, guards, reset, coverage, captured-identities). ADR-0035/0036, STAGING-PARITY Slices A–D. Points at the LIVE staging DB; opt-in only, see the Operational-runners bullet below
├── server/        21 dirs. auth/ (incl. _probe-* + admin-login-result + email-otp-from-guard, AUDIT-FIX-B7b), bets/ (atomicity, concurrency, daily-credit, events-idempotency, idempotency-replay, moderation-outside-transaction, sell, subsequent-buy, validation + AUDIT-FIX-B3: sell-oversell, place-replay-durable, sell-replay-durable, release-failure, double-sell-chain), cron/ (close-due-markets — ENGINE.15, the first route-handler test convention), events/, identity/, middleware/, moderation/ (+ _fixtures/), resolution/ (happy-path, pro-rata, correction, void, concurrency, actor-assert), storage/ (incl. sign-route-envelope, AUDIT-FIX-B7b), admin/ (moderation/ + markets, pool-seed, resolution — each carries its ENGINE.15 wire-action blocks; + markets-media-sign-envelope, AUDIT-FIX-B7b), dharma/ (non-transferable), and — undocumented here until SYNC-5 — comments/, debate-view/, discovery/, health/, lots/, markets/, observability/, profile/, system/, visitors/
└── unit/          `ls -d tests/unit/*/ | wc -l` → 32 as at 2026-09-02; the command is the claim, the figure is a reading of it. Loose: body-fingerprint, rate-limit-prefix, upstash-keys, upstash-redis-config (AUDIT-FIX-B7a — the A14 transport-bound config pins), idempotency-release (AUDIT-FIX-B3). Dirs: bets/ (errors, floors, wire-envelope), cpmm/ (calculate + validate + vectors.test.ts + *.property.test.ts + _arbitraries.ts), markets/ (transitions.test.ts), positions/ (compute.test.ts), resolution/ (basis + basis.property), dharma/ (accrual, canonical, _probe-decimal-negzero, ledger, conservation, conservation-correction), staging/ (8 files — the guards that constrain the tests/staging/ runners WITHOUT touching a database: generator-no-direct-writes incl. the import allowlist, write-guard, runner-target, runner-gating, runner-isolation, reset-guard, guard-list-parity, fixture-table), design/ (`ls tests/unit/design/ | wc -l` → 17 as at 2026-09-04, of which **THREE height chains** — `discovery-height-chain`, `profile-height-chain`, `debate-height-chain` (added at HTML-FINISH · MARKET DETAIL); all three are SOURCE SCANS, because jsdom performs no layout. ⚠ this line said FOUR. The fourth was real: `tests/unit/design/bookmarks-height-chain.test.ts` was minted at `c6526a9`, landed on `main` at `fd4b357` (HTML-FINISH · BOOKMARKS, PR #338, 2026-08-16), and was **deleted by UNWIRE-1 / ADR-0040** at `8f353c4` and `ff1c0f9` on 2026-08-22, along with the surface it guarded. Three remain), and — undocumented here until SYNC-5 — _support/, auth/, comments/, composer/, config/, copy/, db/, debate/, debate-export/, debate-view/, discovery/, docs/, identity-pool/, lots/, middleware/, observability/, onboarding/, profile/, ranking/, scripts/, shell/, storage/, ui/, and art/ (WARLI-1/2 — `ls tests/unit/art/ | wc -l` → 7 as at 2026-09-02, not the 5 this entry carried before WARLI-MOUNT added `_mount-scan.ts` and `mount-scan-reach.test.ts`: `ring-geometry.test.ts` asserts the ring engine against HAND-COMPUTED positions rather than a snapshot, because a snapshot pins whatever the engine does today and it caught a real `-0` defect on its first run; `warli-render.test.tsx` reads the rendered `transform` attribute, which is the ONLY place facing/radius/phase reach the DOM; `art-layer-guards.test.ts` holds the raster, side-pole, raw-hex, injection-sink and OUTBOUND-seal checks, plus the inbound MOUNT-SITE pin — that last row asserted the importer list was EMPTY until WARLI-MOUNT and now asserts it is exactly `src/app/(auth)/layout.tsx`, inverted rather than deleted so a second mount still reddens; `wobble.test.ts` (WARLI-2) — ⚠ its FIRST block is the load-bearing one, because determinism, endpoint-preservation and bounded amplitude are ALL satisfied perfectly by a wobble that does nothing, which is how this slice most likely fails and it fails GREEN; `composition.test.tsx` (WARLI-2) holds G1–G4 — pairs at 180°, the static field facing centre, exactly 8 faces, and the density meridian, the last of which measures ink NORMALISED BY ADMISSIBLE AREA because the middle columns of the frame ARE the rings and a raw column count measures the hole in the doughnut)
```

- **Unit** (no IO): pure functions in `src/lib/` and `src/server/<domain>/`. Happy path + ≥2 edges + the relevant invariant.
- **Component / render** (jsdom, no IO): `jsdom` + `@testing-library/react`, enabled **per file** by a `// @vitest-environment jsdom` docblock on line 1 — `find tests -name '*.test.tsx' | wc -l` → **108** as at 2026-09-04 (the command is the claim; the number is a reading of it — this figure has been written out and gone stale four times, at 30, 79, 84 and 106) — mostly under `tests/unit/**/render/` plus `tests/server/admin/*.component.test.tsx`. **There is no `jest-dom`**, so `toBeInTheDocument()` / `toBeDisabled()` and that whole matcher set are UNAVAILABLE — assert against plain DOM (`getAttribute`, `textContent`, `querySelector`). Fake timers + `act()` for interval/effect behaviour; page visibility is exercised by stubbing `document.hidden` and dispatching `visibilitychange` (F-DEBATE-4). *Recorded at F-DEBATE-4 because this harness has existed since UI.0 and §9 never named it, so successive plans inherited a false "the UI cannot be tested" premise.*
  - ⚠ **AN OUTSIDE-CLICK ASSERTION MUST YIELD TO THE TASK QUEUE BEFORE IT FIRES.** Radix's `DismissableLayer` arms its `pointerdown` listener inside a **`setTimeout(…, 0)`**, so a pointer event dispatched synchronously after `render()` reaches **no listener at all**. Make the test `async` and `await new Promise((r) => setTimeout(r, 0))` first. ⛔ **The failure mode is a false GREEN, not a red:** a *"the backdrop does NOT dismiss this"* assertion written without the yield passes against a listener that was never armed, certifying a guard it never exercised. **Always pair it with the opposite assertion in the dismissible context** — that control is the only thing proving the mechanism fires at all. Escape is unaffected and works synchronously (`fireEvent.keyDown(document, { key: "Escape" })`). *Minted at O1-DECK, where the paired control went red on the first run; without it the non-dismissible guard would have shipped green and empty.*
- **Browser measurement** (the LIVE deployed app, driven through the Chrome/CDP tools). Not a runner and not a suite — there is no E2E runner installed, and **jsdom performs no layout**, which is why the three `tests/unit/design/` height chains are SOURCE SCANS and why anything geometric has to be read off a real browser. *(Three, not four — this sentence said FOUR until 2026-09-02. The fourth was `bookmarks-height-chain`, deleted with the surface it guarded by ADR-0040. It survived SYNC-5's `FOUR → THREE` repair because this bullet did not exist in the tree SYNC-5 measured; it arrived from `main` in the merge, carrying the superseded number into a document that had just corrected it. The count lives with its command in the tree block above — this site should never have carried one.)* Five rules, all of which exist because their failure mode is a plausible number rather than an error.
  - ⛔ **EVERY BOX MEASURES `0×0` UNTIL YOU COMPLETE THE SUSPENSE BOUNDARY BY HAND, AND NOTHING TELLS YOU SO.** React 19 streams suspended content into a `<div hidden id="S:0">` near the end of the document and reveals it with an inline `$RC`, whose reveal path is **`requestAnimationFrame`-gated** — the shipped tail is `$RT?requestAnimationFrame($RV.bind(null,$RB)):(a=performance.now(),setTimeout(…))`. **A CDP-driven tab is `document.hidden`, so rAF never fires.** The document reaches `readyState: "complete"` with the whole page still parked in the hidden div. There is no error, no console warning, and `querySelector` still returns every element you ask for — so the probe reads `0×0` for the element, its row, its panel and every ancestor up to `<body>`, which looks like a **layout collapse rather than a harness failure**. ⚠ Not specific to `/`: any route with a `Suspense` boundary streams the same way, so the tell is `document.querySelectorAll('div[hidden][id^="S:"]').length > 0`, not the route.
  - ⇒ **The remedy is to perform `$RC`'s own DOM operation.** For each `div[hidden][id^="S:"]`, find its `template#B:<n>`, walk back to the pending marker, walk forward to the matching `<!--/$-->` honouring nesting, delete the range between them, insert the streamed children in order, then flip the marker to `<!--$-->`. ⛔ **THE PENDING MARKER IS `<!--$?-->` *OR* `<!--$~-->`, AND THIS SENTENCE NAMED ONLY THE FIRST FOR ONE TASK.** Measured at BLOCK-5a: Discovery's boundary is `$~`, so a reveal written to this paragraph verbatim matched zero boundaries, revealed nothing, and returned `0×0` for every element on the route — the exact failure the bullet above describes, reached *by following the fix for it*. Match the SET `{"$?", "$~"}`, and treat `$~` as a start marker when counting nesting too. The `stillHidden === 0` and non-zero-box assertions are what caught it; without them the run reports a clean measurement of an un-revealed page. Real markup, real stylesheet, real fonts — only the reveal is hand-driven, so this is not a hand-mapped probe reproducing your own assumption. ⛔ **Prove it worked before trusting any number:** assert the count of boundaries revealed, assert `stillHidden === 0`, and assert a **non-zero box on the element you came to measure**. A measurement taken on an un-revealed document is silently a measurement of nothing.
  - ⚠ **Pin the frame IN-PAGE, never the OS window.** Load the route into a same-origin `iframe` carrying inline `position:fixed; width:1440px; max-width:none; min-width:0`, and **`throw` unless `contentWindow.innerWidth === 1440`**. Once a CDP metrics override is in play — taking a screenshot installs one — resizing the window no longer moves `innerWidth`, so the window is precisely the thing that can lie about the width you believe you measured. The throw is the control; a width copied into a report is not.
  - ⚠ **`await document.fonts.ready` and confirm `document.fonts.status === "loaded"`** (plus `fonts.check('12px Geist')` for the face in question) **before reading a baseline.** Font metrics decide where the baseline sits inside a line box; a baseline measured against a fallback face is a fiction shaped exactly like a number.
  - ⚠ **Kill animation and transition before measuring** — inject `*,*::before,*::after{animation:none !important;transition:none !important}` — because the same hidden-tab freeze that stops rAF leaves an unfinished reveal parked at its START transform instead of its settled position.
  - ⚠ **Assert build identity in the SAME call as the geometry** — `fetch('/api/health')` from inside the measured frame and throw unless `canary` is the SHA you meant. The alias serves the previous build until the new one is Ready, so one trusting read returns a healthy response describing the old tree.
  - ⛔⛔ **`getComputedStyle` RETURNS A LIVE DECLARATION — SNAPSHOT EVERY VALUE TO A STRING AT THE INSTANT IT IS VALID.** It is not a copy taken at call time: the object re-resolves on every property read. So `const cs = getComputedStyle(el); el.focus(); …; el.blur(); return cs.boxShadow` returns the BLURRED value, and the state you went to measure is gone by the time you read it. ⚠ **The failure mode is a fabricated defect, not a missing number.** Measured at BLOCK-4: a focus ring that renders correctly reported `boxShadow: "none"` this way, on an element whose `:focus-visible` had already been captured as `true` — a combination that reads as "the selector matches but the rule does not apply", i.e. exactly like a real CSS bug, and it was one edit away from being written up as an accessibility regression. Applies to every state-dependent read: `:hover`, `:focus-visible`, `:active`, `aria-expanded`, anything a class toggles.
  - ⚠ **AND THE COMPOSED `box-shadow` SHORTHAND UNDER-REPORTS TAILWIND v4's RING CHAIN — READ `--tw-shadow`, OR READ THE PAINT.** Tailwind v4 builds `box-shadow` from five `var()` layers backed by `@property`-registered customs. Chrome's computed `box-shadow` for the shipped inset ring prints `rgba(0, 0, 0, 0) 0px 0px 0px 0px inset` — the `inset` keyword survives, the spread and colour do not — while `--tw-shadow` on the same element correctly holds `inset 0 0 0 2px #747474` and the ring is visibly drawn. **The paint is the arbiter**: capture a zoom of the element in the state in question and look at it, rather than trusting either string.
  - ⛔⛔ **A RESPONSIVE UTILITY THAT SILENTLY FAILED TO COMPILE REPRODUCES THE EXACT BEFORE-STATE YOU ARE TESTING AGAINST — PROBE THE UTILITY, NEVER TRUST THE MEASUREMENT.** Turbopack's cache can serve a stylesheet missing a newly-authored variant while the `className` string carrying it is present in the DOM and correct in source. The measurement then reports the element behaving exactly as it did before the fix, which is **ambiguous between "my fix does not work" and "my CSS was never built"** — and the first reading is the one a reader reaches for, because the class is right there in the markup. Measured twice at MOBILE-1 Phase A: `max-mobile:*` utilities absent from the compiled sheet, the debate arena reporting `flex-direction: row` with 379px of overflow at 375px — byte-identical to the un-fixed baseline. ⚠ **A hard reload does NOT clear it and neither does restarting the dev server**; `just clean` (`rm -rf .next/ .turbo/`) then restart does. ⚠ **THE STYLESHEET'S RULE COUNT IS A RED HERRING** — it read 109 both before and after the repair, so "too few rules" proves nothing. The only reliable probe injects the utility and reads back the computed value:
    ```js
    const p = document.createElement("div");
    p.className = "flex max-mobile:flex-col";
    document.body.appendChild(p);
    getComputedStyle(p).flexDirection; // "row" = NOT compiled, "column" = compiled
    ```
    ⇒ **Run it before believing any responsive measurement**, exactly as the boundary-reveal assertions above are run before believing any geometry. Same class as the rest of this bullet: it turns a plausible wrong answer into a checkable one.
  - *Minted at TIME-1 · Form B, where the first probe returned `0×0` for every element on Discovery and the cause was three layers down in React's shipped reveal script. Sub-bullets 3–6 are standing practice the same run used; they are recorded here because they are the same class — each turns a silent wrong answer into a thrown one. **The last two are BLOCK-4's and are the same class again, one layer up: there the harness lied about geometry, here the style API lies about state.** The stale-utility rule is MOBILE-1 Phase A's and is the same class a third time, one layer lower again: there the harness lied about geometry and the style API lied about state; here the BUILD lies about what shipped, and its lie is indistinguishable from a correct measurement of a broken fix.*
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
- **Invariant tests** at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts` — `ls tests/invariants/ | wc -l` → **13** as at 2026-09-02. ⚠ The count and the enumeration below are two claims, and they have disagreed before: this line read `12` beside a list of 12 while `I-GENESIS-001` sat on disk unlisted. Count first, then read the list.
  - `I-APPEND-ONLY-001.resolutions-append-only` (INV-4) — `resolution_events` + `payout_events` reject UPDATE/DELETE post-INSERT at the storage layer.
  - `I-ATOMICITY-001.bet-comment-atomic` (INV-1) — one SERIALIZABLE W-1 tx wraps the full bet spine; if any write throws, every write rolls back (minted ENGINE.7).
  - `I-DAILY-ONCE-001.daily-credit-once-per-utc-day` — at most one `daily_allowance` ledger row per user per UTC day; storage backstop is the unique partial index `dharma_ledger_daily_allowance_day_uq` (minted ENGINE.12).
  - `I-GENESIS-001.open-implies-market-opened-event` — every market in status `Open` carries a `market.opened` event (SPEC.1 §17 `markets::open-implies-market-opened-event`; minted CHART-3). True by construction in the product — `seedPoolAction` → `openMarket` is the only path to `Open` and emits the event inside the same W-4 transaction — which is exactly why it needed a test: a property nothing asserts stays true until a migration, a restored snapshot or a hand-fixed status makes it false, and the only symptom is a blank chart. `replayReserveSeries` seeds its walk from that event, so without it the series is `[]` and the surface renders nothing, indistinguishable from a market nobody has bet on. Staging is in that state on all eight markets, because they reached `Open` outside the product.
  - `I-GRANT-ONCE-001.initial-grant-once-per-user` — at most one `initial_grant` ledger row per user, EVER; storage backstop is the unique partial index `dharma_ledger_initial_grant_user_uq` (minted ENGINE.13).
  - `I-IDEM-NOMASK-001.cached-non-2xx-never-masks-a-commit` — a SINGLE REQUEST's own cached non-2xx response never coexists with THAT SAME REQUEST's own committed transaction (five cases: rate-limit, validation, moderation, durable-mismatch, post-tx-mismatch). ⚠ Scope it narrowly: it does **not** cover the cross-request case (an earlier commit's receipt sitting beside a later request's genuinely-cached rejection) — that is `endpoint.ts`'s `case "hit"` durable consult, "DC-a", guarded by `tests/integration/cross-user-idempotency.integration.test.ts`. Green on the day it was written and correctly so: a `_probe-*`-posture regression guard, not a TDD driver (minted S-7 / ADR-0044).
  - `I-IDEM-ONCE-001.one-commit-per-idempotency-key` — at most one committed bet/sell per idempotency key; storage backstop is the unique index `bet_receipts_idempotency_key_uq` (fixture-bypass duplicate key → 23505; the route layer rides it via the durable pre-check + 23505 catch — minted AUDIT-FIX-B3 / ADR-0031).
  - `I-LOT-SUM-001.lot-shares-sum-to-position` — Σ `lots.surviving_shares` == `positions.quantity` per (user, market, side); the ADR-0039 R2 invariant-class rule. ⚠ It seeds its own rows into the local ephemeral Postgres and truncates after, so it proves the RULE and observes NO live environment — a live-DB Σ check is owed and belongs with the staging gates (minted LOTS-1 S4a).
  - `I-NO-OVERDRAFT-001.dharma-ledger-monotone` (INV-2) — `dharma_ledger` `balance_after >= 0`; no overdraft.
  - `I-NO-OVERSELL-001.positions-quantity-non-negative` — position quantity never negative (invariant-class spec rule, not INV-1..4).
  - `I-RESOLVE-ONCE-001.market-terminates-once` — a market terminates exactly one way, once; storage backstop is the partial unique index `resolution_events_terminal_market_uq` (fixture-bypass second terminal row → 23505; `correct` rows keep the chain open — minted ENGINE.9, OQ-7).
  - `I-SIDE-BIND-001.comment-side-bound-at-post-time` (INV-3) — `comments.side_at_post_time` is frozen at post-time; selling out and re-entering the other side never moves prior comments (minted ENGINE.8; DEBATE.3 reuses).
  - `I-SINGLE-SIDE-001.positions-one-held-side` — at most one held side per (user, market) (invariant-class spec rule).
- **`_probe-*.test.ts`** = vendor-contract **regression guards** (e.g. `_probe-openai-omni-shape`, auth probes) — they assert a third-party/library shape, distinct from TDD drivers (CLAUDE.md §5.6).
- **Naming:** `<subject>.test.ts` (unit), `<subject>.integration.test.ts` (integration), `<area>.spec.ts` (db/invariant specs), `<area>.property.test.ts` (fast-check property suites), `<area>.scale.test.ts` (the opt-in scale battery). One subject per file.

---

## 10. Git workflow + macOS/zsh

- **Branches:** `feat/*`, `fix/*`, `chore/*`, `refactor/*`. PRs, signed commits (SSH, ED25519), squash-merge and linear history are all **CONVENTIONS**. ⛔ **There is no branch protection on this repository, on any branch.** **The measurement and its date live in CLAUDE.md §5.13 and only there** — read it there; a second copy would drift and whichever one you happened to open would be the wrong one. What follows from it in this file's territory: **`ci` is not a required check**, so a red PR can merge and green must be re-checked at the moment of merging; **nothing server-side rejects a force-push**; and **nothing blocks a direct push to `main` or `staging`** — 32 of the 35 commits `staging` carried at S-1 arrived that way. Locally, Lefthook runs `pre-commit` → Biome on staged files (auto-fix, re-stage); `pre-push` → `tsc --noEmit` + `biome check .` + **`no-force-push-protected`**, which refuses a non-fast-forward push to `main` or `staging` (S-1; client-side, `--no-verify` skips it, so it is a discipline with a mechanism rather than a control). There is **no** commit-msg/commitlint job and **no** block-main hook. ⚠ **All pre-push jobs are skipped when the push changes no files** — measured at S-1; see §11.
- **Conventional Commits** by convention (e.g. `feat(bets): …`, `fix(dharma): …`, `chore(deps): …`) — a style rule, not machine-enforced.
- **Multi-line commit messages:** write to `/tmp/commit-msg.txt`, then `git commit -F /tmp/commit-msg.txt`. Never multi-line `-m` or heredocs (macOS zsh truncates pastes ~1KB — split multi-command pastes into single commands; files >1KB via the editor).
- **Canonical SHA** for landed work is the **squash-merge SHA on `main`**; feature-branch SHAs are ephemeral.
- ⛔⛔ **`git branch --contains <sha>` AND `main..HEAD` BOTH ANSWER "NOT MERGED" FOR WORK THAT IS MERGED — `git fetch` FIRST, THEN ASK BY CONTENT.** Two independent failures stack here and each alone is survivable: (1) **squash-merge mints a NEW SHA**, so the feature commit's own hash never appears on `main` and every hash-reachability check reports it absent *by construction*, forever; and (2) **a local `main` is a stale snapshot** that moves only when fetched, so `main..HEAD` measures distance to wherever `main` was the last time anyone pulled. ⚠ **Together they produce a confident, precise, wrong answer** — "1 commit ahead of `main`, unmerged" — with nothing anomalous in the output to prompt a second look. Measured at MOBILE-1 Phase A, where the reading was 17 commits stale and the branch under it had been squash-merged as PR #473 the previous day; the whole of Phase A was built on an already-merged dead branch, and the tell came from the OPERATOR remembering the merge, not from git. ⇒ **Fetch, then ask `origin/main` a CONTENT question:**
  ```bash
  git fetch origin
  git rev-list --count HEAD..origin/main   # 0 = current; anything else = you are stale
  gh pr list --state merged --head <branch>  # the authoritative answer
  git show origin/main:<path> | grep -c '<a string the commit introduced>'
  ```
  ⚠ **`git rebase` corroborates it after the fact and cannot warn you before** — it prints `warning: skipped previously applied commit <sha>`, which is git recognising by PATCH what it could not recognise by hash. Useful as confirmation, useless as a check, because by then the work is already built on the wrong base. **This is the O-13 shape one step on**: there an endpoint that could not answer was read as confirmation; here a command that answers precisely is answering a question about a hash when the question that matters is about content.
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
- Touching a **`CLAUDE.md` §1 critical path** — that list is the source and is deliberately not copied here, because the copy this line used to carry named five of the nine and silently exempted the rest; they carry the full ritual.

### Never
- Edit `drizzle/migrations/*` after commit (append-only).
- Read or write `.env*` files.
- Use `any` or unsafe `as` to silence type errors.
- Import from `src/server/**` into client components.
- Expose Drizzle row types directly in API responses.
- Create a "send Dharma" / user-to-user transfer endpoint (CLAUDE.md §3).
- `UPDATE` rows in `resolution_events` or `payout_events` (append-only, INV-4).
- Commit directly to `main` (PR-only). ⛔ **Nothing will reject it** — this line previously said server-side protection would, and it will not (§11, CLAUDE.md §5.13). It is now the sharpest "Never" in this list precisely because it is the one with no mechanism behind it.

**What is actually enforced vs. discipline.** ⛔ **Mechanically enforced today, in full: append-only on Bucket-A tables (DB triggers) and `bets.comment_id NOT NULL` (schema). That is the list.** Everything else in this section — and every "Never" above it — is **discipline**, held by whoever is typing, with nothing that rejects the violation.

Biome + `tsc` run at Lefthook `pre-push` and in CI, which is real friction but not a control: `--no-verify` skips the hook, and CI's verdict **gates nothing**, because no status check can be required without branch protection. ⛔ **PR-required, signed commits, linear history, no-force-push, `enforce_admins`, and the required `ci` check with `strict: true` were all documented here as enforced and NONE of them is.** **The reads, the date and the not-established question are in CLAUDE.md §5.13 — the single home; don't restate them here.** The nearest thing to a mechanism is `lefthook.yml`'s `no-force-push-protected` pre-push job (S-1), which is client-side and therefore still a discipline. ⚠ **NOT squash either** — all three merge methods remain enabled at the repo level; that flag reading was always sound because it comes from the repository endpoint rather than the protection endpoint, which is exactly the distinction the 2026-08-14 pass did not draw (**O-13**).

⚠ **Lefthook skips EVERY `pre-push` job when the push changes no files** — the log reads `(skip) no matching push files`, and it applies to `typecheck` and `biome-check-all` as much as to the force-push guard. Measured at S-1 by pushing empty commits to a local bare repo: three jobs, three skips, exit 0, and a summary that looks identical to a clean run. A `files:` override does not rescue it; the push-file set is computed first and an empty one short-circuits the hook. **Consequence: a push that only reorders or removes commits — which is exactly what a force-push often is — runs no pre-push job at all.** The guard therefore covers the common case and not the empty-diff one, and saying so is the point: a guard whose coverage is unstated will be read as total. (The previously-documented `deploy-prod.yml`, `commitlint`, block-main / block-destructive hooks, Playwright, and `gitleaks`/CodeQL CI steps do **not** exist; CI is `ci.yml` = Biome → tsc → `drizzle-kit check` → migrate → `db:check-drift` → `vitest run` against a Postgres-17 service [the two migration checks added at D2]. `env-audit.yml` (scheduled Doppler↔Vercel parity, D2) is **not** a merge gate.)

- `staging-migrate.yml` — armed; fires on push to `staging`, applying pending migrations to the staging DB (`--config stg`). The full deploy/promote path (staging gate → scoped prod promote) lives in `docs/runbooks/deploy-pipeline.md` §3 — do not re-document it here.

---

*Rebuilt at SYNC.8 (Jun 2, 2026) against the live repo at `27216fc` + SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0031; descriptive drift reconciled at BC.1 (Jul 1, 2026) against `248e02f`; SPEC.1/SPEC.2 version citations reconciled at the SYNC sweep (Jul 7, 2026), then SYNC-LITE (Jul 16). **Reconciled against the live repo at SYNC-1 (Aug 8, 2026), `fecbaf3` — SPEC.1 1.0.29, SPEC.2 1.0.22, cpmm 2.1.0, ADRs 0001–0036 (34 files), migration head `0024_bookmarks`, `EVENT_TYPES` 24, 23 tables / 13 schema files.** **Counts re-measured at PHASE-0 (Aug 21, 2026): ADRs 0001–0039 (37 files), migration head `0026_lots_no_delete`, `EVENT_TYPES` still 24 (a lot rides its bet's events and mints none), 24 tables / 14 schema files, 11 invariant specs.** **Re-measured again at SYNC-5 (Aug 28, 2026) against `acb71cb`: SPEC.1 `1.0.41`, SPEC.2 `1.0.27`, cpmm `2.1.0`, ADRs — **the ceiling is no longer written here; read it with `ls docs/adr/ | sort | tail -1`** (0002 and 0012 permanently unused), migration head still `0026_lots_no_delete`, `EVENT_TYPES` still 24 (measured by RUNTIME import, not a regex), 24 tables / 14 schema files, **12** invariant specs, **36** integration tests, **79** `*.test.tsx`, **28** `src/server/` dirs, **37** `F-*.md` flow files. SYNC-5 corrected here: Next `16.2.4 → 16.3.2`; `cacheComponents` NOT-enabled → **enabled**; the `pnpm-workspace.yaml` allow-list parenthetical; the Bookmarks route/read-model/components rows (ADR-0040 unwired them — the TABLE survives); the `src/server/` dir count and list; the `components/` and `src/lib/` lists; the `tests/server/` and `tests/unit/` dir lists; `FOUR height chains` → THREE; the ResolverCards description (RESO-1); and the `discovery/` GO-LIVE BLOCKER note that contradicted the PERF-1-is-CLOSED callout twenty lines below it. SYNC-1 corrected: the `(public)/` tree (Discovery / Profile / Bookmarks were all live and undocumented), the `src/server/` directory list (+`bookmarks`, `discovery`, `profile`, `visitors`), the `api/` list (+`visits`), `components/ui/` (+dialog, input, textarea), the integration count (20 → 30) and `*.test.tsx` count (26 → 30), the `just` recipe list (+`test-scale`), and the `Sonner` instruction (removed — not installed). Descriptive: tracks the repo, not the target. Follows the [agents.md](https://agents.md) standard. Maintained per `docs/maintenance.md`.*
