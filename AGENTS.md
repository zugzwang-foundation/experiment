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

**Staging operational scripts** — these point at the LIVE staging database and are **not tests** (§9, ADR-0036): `pnpm staging:reset` (guarded truncate, then re-seeds `identity_pool`) · `pnpm staging:generate` (the engine-driven fixture generator) · `pnpm staging:gates` (the six verification gates) · **`pnpm staging:rebuild`** (the composite: reset → seed → generate → gates). Each wraps `vitest.staging.config.ts` in `doppler run --config stg`; the write-capable ones additionally require an intent token in the environment. **`pnpm exec tsx scripts/seed-content-markets.ts --env staging --create|--open|--media`** joins them at LIQ-1-RESTORE — it is a CLI over the same harness (it spawns the runner under `doppler --config stg` itself, so it takes no wrapper) and recreates the eight CONTENT markets through `createMarket` / `openMarket`. ⚠ `staging:reset` — and therefore `staging:rebuild` — now **refuses** while those eight are present; §9's reset bullet has the acknowledgement.

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
│   │                               #   DP.2 promote. ⚠ SUPERSEDED 2026-09-11 — QUOTE-1 A
│   │                               #   (PR #513) took that docket's STRIP exit for BOTH
│   │                               #   remaining kinds: the empty arm and all THREE
│   │                               #   PostImagePlaceholder mounts render `null` and the
│   │                               #   component is deleted, so /m/[slug] ships ZERO mockup
│   │                               #   placeholders. Guards INVERTED, not removed. ⚠ Kind 2's
│   │                               #   null arm is interim — QUOTE-1 C replaces it with the
│   │                               #   title-as-quotation well), ScrollRail (the rail — and, since R3,
│   │                               #   the auto-advance countdown). Since HTML-FINISH the
│   │                               #   directory has ALSO gained CriterionDisclosure (CRIT-1),
│   │                               #   DebatePoll, chart/ (CHART-1, the price chart), and
│   │                               #   quote-well/ (QUOTE-1 C — QuoteWell.tsx + size.ts, the
│   │                               #   title-as-quotation well the line above forecasts. ⚠ THAT
│   │                               #   FORECAST IS NOW DISCHARGED FOR THE CARD AND ONLY THE
│   │                               #   CARD: `PostCard`'s imageless arm draws the well in its
│   │                               #   `.argimg` cell (design-canon C-QUOTE-1, SPEC.1 2.0.2),
│   │                               #   while `PostFocusHeader` and `ReplyCard` keep the interim
│   │                               #   `null` by ruling — the hero is owed at QUOTE-1 C2. ⛔ IT
│   │                               #   MOVES NO PLACEHOLDER COUNT: the count has been ZERO
│   │                               #   since QUOTE-1 A deleted the component, and a well is not
│   │                               #   a placeholder — it renders the post's own title, not the
│   │                               #   words "POST IMAGE". The FIVE/"four" arithmetic above is
│   │                               #   about a state that no longer exists on this route.
│   │                               #   ⚠ The well is wrapped in the title row's `onEnter`
│   │                               #   button, because deleting that row removes an imageless
│   │                               #   card's only way into post-focus; pending founder
│   │                               #   ratification, see docs/plans/QUOTE-1.md §8 D).
│   │                               #   ⛔ AND phone/ (MOBILE-2 / ADR-0051) — `ls
│   │                               #   src/components/debate/phone/ | wc -l` is the claim. It
│   │                               #   is NINE — MOBILE-2k's `PhoneTopPill.tsx` is the ninth,
│   │                               #   and this line read EIGHT until it landed. MOBILE-2d
│   │                               #   added `scroll-lock.ts` here and then
│   │                               #   MOVED it to `debate/`, because the DESKTOP path imports
│   │                               #   it (MarketPriceChartOverlay) and a module reached from
│   │                               #   above is a leak out of a subtree whose whole contract is
│   │                               #   that nothing below its root escapes. `debate/
│   │                               #   phone-tier.ts` is the precedent. The subtree is, and
│   │                               #   the ONLY subtree in src/ that is a SECOND
│   │                               #   PRESENTATION rather than an override: below 640px
│   │                               #   DebateView hides and this renders over the same four
│   │                               #   props. SEVEN client (PhoneDebateView · PhoneTitleStrip ·
│   │                               #   PhoneSideTabs · PhoneFeedTrack · PhoneBottomBar ·
│   │                               #   PhoneSheet · PhoneTopPill) and TWO SERVER (PhoneDetails ·
│   │                               #   PhoneResolverRows) — the details sheet's body is an
│   │                               #   RSC node passed down, so the shell is the only client
│   │                               #   part of it. It contains NO write path: every bet goes
│   │                               #   through the reused BetComposer. See §8's MOBILE-2
│   │                               #   bullet for the four conditions a phone-only leaf has
│   │                               #   to meet, and for the guard family that pins them.
│   │                               #   ⚠ `PhoneTopPill` (MOBILE-2k, ADR-0051 A7) is the THIRD
│   │                               #   leaf here to register a DOM listener, and the only one
│   │                               #   that registers on an element the HOST owns — a passive
│   │                               #   `scroll` read on the feed region, because the bounded
│   │                               #   shell of MOBILE-2d took pull-to-refresh away and nothing
│   │                               #   else can tell it which way the reader is going.
│   │                               #   ⛔ THIS LINE CLAIMED "the ONE leaf that registers a DOM
│   │                               #   listener of its own" AND "the fourth and only non-`track`
│   │                               #   row", AND BOTH WERE FALSE TO A ONE-LINE GREP — caught by
│   │                               #   `@code-reviewer` in the same round that wrote them.
│   │                               #   `grep -rn addEventListener src/components/debate/phone/`
│   │                               #   returns FOUR registrations in THREE files
│   │                               #   (`PhoneFeedTrack` twice, `PhoneSheet` once, this once),
│   │                               #   and `RATIFIED_LISTENERS` already held a non-`track` row
│   │                               #   — `document::keydown::onKey::`, which that guard's own
│   │                               #   docblock names. Run the grep; it is the claim.
│   │                               #   It IS the fourth row in
│   │                               #   `phone-gesture-wall.test.ts`'s CLOSED allowlist, and
│   │                               #   adding it there was a decision rather than an edit.
│   │                               #   It holds no write path: its tap calls `router.refresh()`
│   │                               #   and nothing else, and it refuses even that while the
│   │                               #   composer reports `busy`.
│   │                               #   debate/ also holds TWO TIER-CROSSING MODULES, minted at
│   │                               #   MOBILE-2b because the phone tree is a SIBLING of the
│   │                               #   desktop tree rather than a child, so no prop path exists
│   │                               #   between them. `composer-open-store.ts` — one bit read
│   │                               #   through `useSyncExternalStore`, so `DebatePoll` can
│   │                               #   suspend for a phone composer it cannot see. ⚠ Published
│   │                               #   from an EFFECT, never a handler: a flag stuck `true`
│   │                               #   does not throw and does not render, it silently stops the
│   │                               #   surface refreshing for the rest of the session, and
│   │                               #   React's cleanup releases it on paths nobody remembered to
│   │                               #   write. `phone-tier.ts` — `useIsPhoneTier()`, so the
│   │                               #   hidden desktop tree's intervals can stop below the gate.
│   │                               #   ⛔ `display: none` STOPS PAINTING AND DOES NOT STOP A
│   │                               #   TIMER: 252 callbacks a minute were measured on a phone,
│   │                               #   every one of them the invisible tree's, from TWO sources
│   │                               #   (`ScrollRail`'s fill and `scrollers.tsx`'s auto-advance —
│   │                               #   the second found only after the first was called done).
│   │                               #   ⚠ It subscribes to the query Tailwind ACTUALLY EMITS,
│   │                               #   `not all and (min-width: 640px)` — NOT
│   │                               #   `max-width: 639.98px`, which appears zero times in the
│   │                               #   compiled sheet and which a confident docblock claimed was
│   │                               #   "Tailwind's own spelling, copied not invented".
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
│   │                               #   ⛔ AND `src/components/profile/phone/` — A SECOND
│   │                               #   PHONE SUBTREE, minted at MOBILE-2e under ADR-0051
│   │                               #   **A4** D-2, which extends the phone-tier convention
│   │                               #   from `/m/[slug]` to `/u/[pseudonym]`.
│   │                               #   `ls src/components/profile/phone/ | wc -l` is the
│   │                               #   claim; it is ONE — `PhoneSellSheet.tsx`. It exists
│   │                               #   because SELL is the one comment-free action in the
│   │                               #   product and the desktop arms it IN the position row,
│   │                               #   which on a phone is 64px of value column beside a
│   │                               #   flexible argument. The sheet is the SAME `PhoneSheet`
│   │                               #   the composer opens on `/m/[slug]`, and it drives the
│   │                               #   SAME `useInlineSell` controller the desktop table
│   │                               #   holds — a second set of controls, never a second
│   │                               #   controller.
│   │                               #   ⛔ IT IS MOUNTED INSIDE THE ARMED ROW'S `<td>`, and
│   │                               #   that is load-bearing rather than incidental:
│   │                               #   `useInlineSell` decides what counts as an outside
│   │                               #   click by asking whether the armed `<tr>` CONTAINS the
│   │                               #   tap. Mounted anywhere else, the first touch inside the
│   │                               #   sheet — `Confirm` included — cancels the sell it was
│   │                               #   opened for. `position: fixed` lifts it out of the cell
│   │                               #   visually, so the DOM position costs nothing.
│   │                               #   ⚠ The host gates it on `useIsPhoneTier()`, so the node
│   │                               #   does not EXIST at ≥640px or in jsdom — which is what
│   │                               #   leaves all forty-three shipped sell tests observing
│   │                               #   the unchanged in-row arm.
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

**⛔ `asChild` ACROSS THE RSC BOUNDARY IS NOT SAFE BY DEFAULT — an element passed from a Server Component into a Client Component's `asChild` slot is USUALLY an element and OCCASIONALLY a `React.lazy`.** React Flight writes a Client Component's props inline until the row it is building passes `MAX_ROW_SIZE` (**3200 bytes**), then defers the NEXT element to a row of its own, where it arrives as `{$$typeof: Symbol.for("react.lazy"), _payload, _init}`. `React.isValidElement` is false for that, and Radix's `Slot` returns **`null`** for a child it cannot clone (`@radix-ui/react-slot` dist `:34-42`) — so the affordance silently **deletes its own child**. ⚠ **Which child is hit is a byte position, not a call site.** Measured on `/` at DIAG-HEADER-BALANCE-HYDRATION: +0 bytes of payload hit `DharmaCluster`'s Balance eyebrow, +300 hit Portfolio, and either side of those hit nobody — so it moves with any unrelated edit anywhere earlier in the page, and no call site is durably safe. ⚠⚠ **AND IT IS INVISIBLE TO A STATIC RENDER**, which is why it shipped: the server takes its own non-element fallback and PAINTS the child, so `renderToString` and every `render()` test look correct; the deletion happens only when the client re-renders onto the Slot. There is no hydration warning and no console error, because neither half is a mismatch — each is a correct render of a different branch. ⇒ **Resolve the child before anything inspects it** (`src/components/ui/info-tip.tsx`'s `isDeferredChild` → `React.use(children._payload)`, which returns synchronously because the row has already arrived), and **test it by HYDRATING, never by rendering** (`tests/unit/ui/info-tip.test.tsx`).

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

- **Bucket A — fully append-only** (11 tables: events, dharma_ledger, bets, comments, resolution_events, payout_events, mod_actions, admin_events, user_events, bet_receipts, liquidity_policy). Protected by `0003_append_only_triggers.sql` (row-level UPDATE/DELETE) + `0021`/`0022`/`0027` (statement-level TRUNCATE, ADR-0030); `bet_receipts` (AUDIT-FIX-B3 / ADR-0031) ships all three guards in `0022`, and `liquidity_policy` (LIQ-1 Phase 2 / ADR-0047) all three in `0027`, both reusing the shared functions. Reject UPDATE/DELETE/TRUNCATE at the storage layer. ⚠ **`liquidity_policy` is the second table after `system_state` whose truncate guard stays ARMED during a staging reset** (`TRUNCATE_EXCLUSIONS`, `tests/staging/_lib/guards.ts`): its seed row comes from a migration drizzle will never re-run, so wiping it would make the injector read no policy and fail closed silently, forever.
- **Bucket B — append-only with whitelisted column transition(s)** (3 tables: identity-pool, image-uploads, system-state). Each permits a one-shot `NULL→timestamp` transition on a whitelisted column — e.g. `system_state.frozen_at` flips once then is immutable (`image_uploads` transitions `terminal_state` + `terminal_at` together). All other column changes, every DELETE, and every TRUNCATE are rejected at the storage layer (TRUNCATE statement-level, ADR-0030).
- **Bucket C — mutable** (e.g. `positions`, `bookmarks`, `lots`).
  - ⚠ **`lots` is Bucket C and carries a DELETE guard, which no bucket name covers** (ADR-0039 D-1, SPEC.2 §5.2; added at MERGE-1, where this line still read *"e.g. `positions`"* alone). Its shape is narrower than either family: the row may CHANGE — that is what `surviving_shares` is for — in ONE direction, forever, and may never LEAVE. Calling it Bucket A would assert UPDATE is forbidden, the opposite of true. So migration `0026` gives it a row-level `BEFORE DELETE` reject named `lots_no_delete` **deliberately outside the `bucket_%` family**, so it enters neither the §6 append-only contract nor the staging reset's guard catalogue — both of which it would misdescribe. **The protected count is unchanged at thirteen** by `lots`, and `EXPECTED_GUARD_CATALOG_ROWS` stayed 78 through `0026`. ⚠ **BOTH MOVED AT `0027`** — `liquidity_policy` is the fourteenth protected relation and the eleventh Bucket-A table, so the catalogue is **81**. The sentence above is about `lots` and is still true of `lots`; it is not a standing statement about the counts.

### Migrations (`drizzle/migrations/`)

- Generated via `just db-generate <name>`; **append-only — never edit a committed migration, write a new one.** Destructive migrations need PR sign-off + a backup snapshot first.
- The `events` table partitioning is **hand-written** (`PARTITION BY RANGE`) in `0002_events_partitioning.sql` and **excluded from drizzle-kit** via `drizzle.config.ts` → `tablesFilter`, whose live value is `["!events", "!liquidity_heartbeat"]` — the second entry is LIQ-1 Phase 2's operational heartbeat table, hand-written for the same reason `watermark_state` and `cron_alarms` are. ⚠ **The filter guards `drizzle-kit push`/`pull`, NOT `db:check-drift`** — that script only compares journal head against applied head and never introspects a table, so it cannot see an undeclared one either way (`O-13`).
- pg_cron-coupled migrations (`0007_pg_cron_jobs.sql`, `0011_position_drift_pg_cron.sql`, `0027_liquidity_injector_pg_cron.sql`) carry `cron.schedule()` (and `0007` the `CREATE EXTENSION pg_cron`); CI strips those statements from every `*pg_cron*.sql` before applying (the CI runner has no pg_cron).
- Current head: **`0030_liquidity_revoke_app_roles`** (0016 = `mod_actions.reason` for the reactive-moderation foundation, PR #143; 0017 = drop `comments.stake_at_post_time` (DEBATE.8); 0018 = drop `friendly_fire_events` (DEBATE.9); 0019 = `market_media` (MEDIA.1); 0020 = `dharma_ledger.seq` total-order (AUDIT-FIX-B2 / ADR-0029); 0021 = TRUNCATE guards (AUDIT-FIX-B2 / ADR-0030); 0022 = `bet_receipts` durable idempotency receipts + same-file Bucket-A guards (AUDIT-FIX-B3 / ADR-0031); 0023 = `positions_market_id_idx` W-3 settle-read + FK-convention index (AUDIT-FIX-B7b / A31); 0024 = `bookmarks` (UI-A6 / ADR-0032, PR #254); 0025 = `lots` (LOTS-1 / ADR-0039 — Bucket C, no back-fill, seven CHECKs); 0026 = `lots_no_delete` (PHASE-0 / ADR-0039 R9 — a row-level `BEFORE DELETE` reject, deliberately NOT `bucket_%` and deliberately NOT a TRUNCATE guard, so `lots` stays Bucket C, `EXPECTED_GUARD_CATALOG_ROWS` stays 78, and `TRUNCATE bets CASCADE` still empties it); 0027 = `liquidity_injector_pg_cron` (LIQ-1 Phase 2 / ADR-0047 — `liquidity_policy` with three Bucket-A guards, the unguarded operational `liquidity_heartbeat`, the three plpgsql routines `zz_add_liquidity` / `run_liquidity_injection` / `check_liquidity_alarms`, one seeded policy row with `enabled = false`, and two `cron.schedule` registrations. **`EXPECTED_GUARD_CATALOG_ROWS` moves 78 → 81.** ⚠ Its filename MUST match `*pg_cron*` — the inverse of `0015`'s case — because it carries the registrations and CI's `^`-anchored strip matches on the filename; each registration therefore starts at column 0 and closes on a bare `);`. `liquidity_heartbeat` is hand-written and NOT in Drizzle, so `drizzle.config.ts`'s `tablesFilter` gains `"!liquidity_heartbeat"` alongside `"!events"`); 0028 = `liquidity_policy_ceilings` (LIQ-1 Phase 2 Gate C — CHECK ceilings on `lock_timeout_ms` and `endgame_hours`, and the status RE-READ under lock inside `run_liquidity_injection`: the cursor's snapshot predates every lock it takes, so a market can leave `Open` between the scan and the write); 0029 = `liquidity_policy_ceilings_tightened` (`@security-auditor` H-1 — the **250 ms** ceiling `0028` set was still above the value that breaks a bet, and `0029` lowers it to 100. ⚠ **250 is the CEILING `0028` wrote; 100 is the value the seeded policy row carries** — this entry conflated the two until the `@db-migration-reviewer` read `0028` out of the repository rather than out of the prose, and `0029`'s own commit subject (*the ceiling I set was above the value that breaks it*) reads correctly only against 250. Measured: ten Open markets at the shipped 100 ms is ~945 ms of lock-holding against the bet path's NON-retryable 1,000 ms `statement_timeout`, roughly 55 ms of margin and reachable by a participant. A CHECK cannot see the market count, so the bound moved INTO the sweep as a 600 ms lock-hold budget that holds for any count and any legal timeout. ⚠ **The budget is not all `0029` did** — it also lowers `endgame_hours` 8760 -> 168, adds `floor <= 10000000` and `coefficient <= 100000`, and re-creates `liquidity_policy_bounds`; the CHECK approach was TIGHTENED alongside the sweep budget, not replaced by it); **0030 = `liquidity_revoke_app_roles`** (LIQ-1-FIX-2 / L-10 — `REVOKE EXECUTE` on all three liquidity functions from `PUBLIC`, `anon` and `authenticated`; `service_role` deliberately keeps it, being a secret-holder rather than a browser-reachable role. ⚠ Its filename must NOT match `*pg_cron*` — the inverse of `0027`'s case — because it carries no `cron.schedule` and CI's strip matches on the filename. The revokes for the two roles — six of them, 2 roles x 3 functions — sit inside a `pg_roles` DO-block guard: those roles are Supabase's, CI's vanilla `postgres:17` has neither, and a bare REVOKE against an absent role is a hard `42704`, so one file has to mean the same thing on both substrates. ⚠ Measured before it was written — all three functions carried EXPLICIT `anon=X` and `authenticated=X` entries from Supabase's `ALTER DEFAULT PRIVILEGES`, not merely the default PUBLIC grant, so revoking PUBLIC alone would have looked right and changed nothing that mattered. It adds no guard, so `EXPECTED_GUARD_CATALOG_ROWS` stays 81, and it makes no schema diff, so `0030_snapshot.json` is `0029`'s body under a fresh id — the `0026` pattern. Guarded by `tests/db/liquidity-grants.spec.ts`)).

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
- **`--breakpoint-mobile: 640px` is the repo's ONE minted breakpoint, and every mobile rule is an ADDITIVE `max-mobile:` override behind a `mobileResponsive` prop** (MOBILE-1 Phase A / ADR-0045, the first breakpoint this repo has ever minted; ADR-0045 calls the convention "a new convention future work must follow consistently"). It lives in the plain `@theme` block beside the branded ramp — a `--breakpoint-*` outside `@theme` is an ordinary custom property that resolves in `var()` and generates **no variant at all**, silently. It generates `mobile:*` (≥640px) and `max-mobile:*` (<640px). **Four rules, and each exists because its violation fails quietly:**
  - **Override, never replace.** Desktop stays the unprefixed default; a mobile rule is a `max-mobile:` token *appended* to the existing class string. That is what makes "zero desktop regression" structural rather than a thing to re-measure — but ⚠ **only for tokens that are genuinely inert above 640px**, which an unprefixed class added alongside is not: `HeroPanels.tsx:137`'s `grid-cols-1` is live below 768px and is deliberate, not a counter-example.
  - **⛔ GATE IT ON A PROP, AND THREAD THE PROP THE WHOLE WAY DOWN.** `GlobalHeader` is mounted by BOTH `(public)/layout.tsx` and `(auth)/layout.tsx`, so every reflow class is `cn(base, mobileResponsive && "max-mobile:…")` and the prop **defaults `false`** — a mount that forgets it inherits the desktop render rather than an accidental reflow. ⚠ **BOTH MOUNTS NOW OPT IN.** This line read *"ADR-0045 leaves auth/join surfaces `gated, not made responsive`… and only `(public)` opts in"* until MOBILE-1 · Job A, and **ADR-0048 supersedes exactly that carve-out** — a phone participant is allowed to join, so `(auth)/layout.tsx` passes the prop and `/sign-in`, `/sign-in/otp` and `/onboarding` reflow at the 640px tier (measured: 379px of document overflow → 0px, header min-content 754px → 375px). ⛔ **The default is NOT thereby dead, and deleting it is the wrong inference from "both callers pass it".** The polarity is a property of the default rather than of who currently passes it: it is what makes a THIRD mount safe by omission, and ADR-0048 `:84` considers removing the prop and rejects it for now. ⚠ **The gate is the prop chain, not the file boundary** — a class left unconditional two components down reaches `(auth)` exactly as surely as one written in the layout's own file, which is how `OnboardingDeck` shipped three ungated classes onto `/sign-in` through `GlobalHeader → RulesControl → OnboardingDeck`. That deck now reflows on the auth routes **by founder ruling**, which is a change in what is wanted, not in the discipline: the classes are still gated and still threaded. Guarded by `tests/unit/shell/global-header-mobile-reflow.test.ts`. ⚠ Several `src/` docblocks on that chain still state the superseded position and are a known, deferred debt — see `docs/plans/MOBILE-1-JOB-A.md` OQ-6a.
  - **⚠ IT IS NOT A SYNONYM FOR `sm`, AND THE GAP IS AN ACCESSIBILITY SETTING.** Tailwind ships `--breakpoint-sm: 40rem` (unoverridden here); this token is `640px`. Equal at a 16px root font size and at no other — at a 20px root, `sm` fires at 800px and `mobile` at 640px, with both boundaries live in one stylesheet. `px` is deliberate (a device viewport does not grow when someone enlarges their text), so **do not "fix" the value**; know that a `max-mobile:` override and an `sm:`/`md:` rule do not reliably hand off to each other.
  - ⚠⚠ **Tailwind v4 source detection scans `docs/` AND `tests/`.** A class-shaped string written in prose *or in a test file* becomes a real emitted utility — `docs/logs/MOBILE-1.md` alone put `max-mobile:grid&#8203;-cols-2` into the built stylesheet, restoring a rule the code had reverted. The cost is not the bytes: **the built sheet stops being evidence of what components use.** Break the string when naming an unshipped class in a doc. ⛔ **This line said `docs/` alone until MOBILE-1 · Job B, and the omission was load-bearing rather than cosmetic**, because `tests/unit/design/` is exactly where the guards for these tokens live: a guard asserting a class is present in a component **can emit that class itself**, so any check that greps the built sheet to prove a component's new utility compiled is self-fulfilling. **Measured, with a positive control:** `max-mobile:opacity-&#8203;0` is present in `.next/static/chunks/*.css` and in `tests/`, and present in **no `src/` file** — a test file emitted a production utility. ⇒ **In a guard, assemble the prefix at runtime** (`const V = "max-mobile"; const S = ":";`) so the file carries no scannable token, as `tests/unit/design/profile-mobile-reflow.test.ts` does and says why. ⚠ The older guards still carry clean literals and are **not** yet cleaned (`docs/parked.md`, MOBILE-1 Block D), so the set of built-sheet utilities with no `src/` origin is **non-empty**. ⛔ **It is no longer UNENUMERATED, and the method is the durable part of this sentence.** `grep` cannot answer it — the question is what Tailwind's extractor sees, so ask the extractor: `new Scanner({sources:[{base, pattern, negated:false}]}).scan()` from `@tailwindcss/oxide` (resolve it under `node_modules/.pnpm/`; it is not a direct dependency), **with a positive control** — a `src/` component known to carry the tokens, so a zero elsewhere is a verdict rather than a broken call. Measured that way at MOBILE-2e across eight files — and ⛔ **the two CONTRACT files are the large half: `docs/parked.md` emits 16 real utilities and this file emits 5**, all from prose written in earlier rounds, which is the `docs/` warning above finally carrying a number. Among the test files: `tests/unit/design/composer-fit.test.ts` yields `max-mobile:&#8203;contents` and `max-mobile:&#8203;hidden`, joining `opacity-0`; `phone-round-five.test.ts` and `profile-mobile-reflow.test.ts` yield only the bare candidate `max-mobile`, which matches no utility and emits nothing; the three others are clean. ⚠ Six files is not the repository — **the set is enumerated where it has been scanned and nowhere else**, and the command above is what extends that.
  - ⛔⛔ **WHEN A PHONE RENDER HAS TO DEPEND ON HOW WIDE ITS OWN CONTENT IS, MAKE IT A *DATA* RULE AND A `max-mobile:` CLASS — NEVER A MEASUREMENT AT RUNTIME.** MOBILE-2j / ADR-0051 A6 is the first instance and `src/components/profile/money-line.ts` is the pattern: a position tile's money line carries four `whitespace-nowrap` things on one row at 360px, and when the figure is long enough the movement chip has to drop. **The obvious implementation is a `ResizeObserver`, and it is wrong three ways** — it can only act AFTER a frame in which the row was already too wide; it is a mechanism per element where the decision is per VALUE; and it puts layout state into React on the one surface that must not reflow. ⇒ **Key on the formatted STRING, whose length is known on the server before a pixel is painted**, and measure the threshold ONCE, in a real browser, at the narrowest supported width. The constant is a measurement and says so in its own docblock, with the run and the figures beside it.
  - ⚠ **AND THE TIER GATE IS THE CLASS, NOT THE HOOK.** `useIsPhoneTier()` decides WHETHER; a `max-mobile:hidden` decides WHERE. Branching the MARKUP on the hook renders one shape on the server (its server snapshot is `false`) and the other on hydration — a visible flip on the line the reader is looking at — and it also reaches the desktop, which the class cannot do at all. The rule computes the same on both tiers and only the phone acts on it.
- **⛔⛔ MOBILE-2 / ADR-0051 — THE CONVENTION ABOVE HAS A FLOOR, AND `src/components/debate/phone/` IS WHERE IT WAS HIT.** `/m/[slug]`'s desktop composition is a two-column arena whose composer opens in the column OPPOSITE the one being bet; a stacked arena has no opposite column, so there is no phone shape to reflow INTO. Below 640px the desktop tree therefore **hides** (one appended `max-mobile:&#8203;hidden` on `DebateView`'s root) and a second tree renders over the SAME four props `DebateView` takes. **This does not loosen ADR-0045** — override-never-replace still governs every existing component, and a phone-only leaf may be minted only when the desktop composition has no phone shape, and only if it (a) lives under `phone/`, (b) consumes the read model / viewer context / existing callbacks and nothing else, (c) contains **no write path** — every bet goes through the reused `BetComposer`, every signed-out prompt through the reused `AuthGateSlot` — and (d) uses no default-breakpoint variant.
  - ⚠ **CLASSES INSIDE `phone/` ARE UNPREFIXED, AND THAT IS THE POINT RATHER THAN AN EXEMPTION.** The whole subtree is `display:none` above 640px, so the tier gate is declared ONCE on its root and nothing below it can leak upward. What is forbidden under `phone/` is the opposite direction — an `sm:`/`md:`/`lg:`/`xl:` rule, i.e. a SECOND breakpoint system inside a tier that already has one.
  - ⛔⛔ **THE SCROLL MODEL IS A BOUNDED APP SHELL WHOSE VERTICAL SCROLLER IS AN *ANCESTOR* OF THE HORIZONTAL SNAP TRACK (MOBILE-2d, ADR-0051 A3).** ⚠ **This bullet described the opposite until MOBILE-2d and the old text is replaced rather than annotated** — it read "nested-snap-with-a-document-scroller … the panes have no height chain behind them, so they are content-height and `<html>` is the only vertical scroller", and called that measured-rather-than-chosen. It WAS measured, and the measurement was of a model nobody designed: `<main>`'s `min-h-[calc(100dvh-60px-2px)]` is a MINIMUM, so nothing bounded the chain, the panes' `overflow-y-auto` never engaged, and `overscroll-behavior: contain` sat on a box that could not scroll — where its only reachable effect is to refuse the pan and leave a dead rectangle (the 2026-09-12 Android report; reproduced on demand, `contain` 0px vs `auto` 401px out of a pane parked at its end).
  - **The shape now, below 640px only.** `PhoneDebateView`'s root is `max-mobile:h-[calc(100dvh-60px-2px)] max-mobile:flex-none max-mobile:overflow-hidden max-mobile:flex-col`; row 1 is the title-strip-and-tabs block (`shrink-0`); row 2 is `[data-testid="phone-scroll-region"]`, `min-h-0 flex-1 overflow-y-auto overscroll-y-contain` — **the vertical scroller**; inside it sits `PhoneFeedTrack`, content-height, `overflow-x-auto snap-x snap-mandatory overflow-y-hidden overscroll-x-contain min-w-0 [touch-action:pan-x_pan-y]`; inside that, two panes that are **pure snap items** with no overflow, no overscroll, no touch-action and no height. The bet bar stays `position: fixed`. The document does not scroll at all.
  - ⛔⛔ **WHY THE SCROLLER IS ABOVE THE TRACK AND NOT INSIDE IT — THE ONE RESULT WORTH CARRYING FORWARD.** The obvious design gives each side its own reading position by putting `overflow-y: auto` on each pane. It breaks the sideways swipe and nothing in the layout shows it: with a vertical scroller nested inside the snap track, **a horizontal swipe that follows a vertical scroll moved nothing at all in 15 of 40 trials**, sampled every frame — so a routing decision, not a snap that changed its mind. Measured across four input paths (10, 24 and 36 hand-dispatched touch moves, and Chrome's own `Input.synthesizeScrollGesture`), all four alike; **40 of 40 with the scroller above the track**, and 10/10 with no prior scroll in every arm. ⚠ **The price is real and is the status quo rather than a regression:** both sides share one vertical position and the shorter side is padded to the taller one's height — exactly what the document did before. Per-side positions need a different mechanism and cannot be got by nesting.
  - ⚠ **Two declarations are FATAL on the snap item and are named so nobody adds them back:** `overscroll-behavior-x` anything other than `auto`, and `touch-action: pan-y` — both 0 of 8, because `touch-action` is intersected down the ancestor chain and inline-axis containment forbids the chain, so a horizontal gesture starting on a card never reaches the track.
  - ⚠ **`sticky top-[62px]` WAS DELETED FROM THE TITLE-STRIP BLOCK AND ITS REMOVAL IS LOAD-BEARING.** `overflow: hidden` makes the tier root a scrollport, a `position: sticky` child resolves its offset against the nearest scrollport, and the 62px offset then pushed the strip and tabs **62px down inside the shell** — measured on every phone profile (strip `y 72 → 134`, tabs `y 126 → 188`, against a track still starting at `y 179`), putting 61px of the feed behind the tabs. The offset existed to clear the page header while the DOCUMENT scrolled.
  - ⛔⛔ **ADR-0051 A4 (MOBILE-2e) — THE CONVENTION NOW HAS TWO HOMES, AND `src/components/profile/phone/` IS THE SECOND.** The four conditions above are unchanged and are what a leaf there must still meet; what moved is the surface. `/u/[pseudonym]`'s phone view needed one leaf (`PhoneSellSheet.tsx`) for the same reason `/m/[slug]` needed eight: the desktop composition has no phone shape to reflow INTO — the sell arms inside a position row, and a phone row has no room for an editable figure beside two controls. ⚠ **The leaf holds no write path**, and that is asserted rather than asserted-about: `tests/unit/design/phone-round-five.test.ts` scans it for `fetch(`, `/api/`, `"use server"`, `@/server/` and six more — `ls` the array rather than trusting this sentence — with a positive control so an empty read cannot pass.
  - ⛔ **D-4(vi) — NO INFO AFFORDANCE MOUNTS BELOW 640px, AND THE GATE IS IN THE PRIMITIVE.** `src/components/ui/info-tip.tsx` early-returns the bare child when `useIsPhoneTier()` is true. It is there rather than at the 34 call sites (`grep -rn '<InfoTip' src/ --include='*.tsx' | wc -l` is the claim) because all eight phone-reachable affordances live in components the DESKTOP also renders, and five of the six carriers are server components that cannot take a hook without a boundary change — and because a threaded prop has to reach `PhoneDebateView → PostCard → ArgProfile → badges`, where one unthreaded hop leaves a gloss mounted. ⚠ The defect it closes is not "a gloss is unwanted": on touch the component takes the POPOVER branch, which MERGES an `onClick` toggle onto its child, so one tap on a Support pill opened the reply sheet AND the gloss — and with no hover to end it, the gloss sat over the argument field. ⚠ Native `title` attributes are deliberately NOT covered — see `docs/parked.md` `2e-4`.
  - ⛔ **NO TOUCH OR POINTER HANDLER ON THE TRACK OR THE PANES AT ALL, and no `preventDefault` on a touch handler anywhere under `phone/` — EITHER `phone/`.** Momentum, rubber-banding, axis lock and snapping are the browser's; a handler is the only place they can be got wrong, and it is how this lane got its P0. The one exception is named: the track carries `pointermove` and `touchmove` **passively**, both resolving to the same `release`, to un-mute the tab observer when the reader overrules a programmatic slide. `tests/unit/design/phone-touch-handlers.test.ts` scans with the comments stripped, because six previous negative source scans in this repo matched the comment explaining the absence.
  - ⚠ **Scroll locking targets the live scroll containers, not `document.body` (`debate/scroll-lock.ts`).** Below 640px the body no longer scrolls, so a body-level lock is inert there — measured: on the UNBOUNDED build, clearing the body lock live while a sheet was open let the page move **302px**; on the bounded build the same experiment moves **0**. ⛔ **What actually holds the feed still is the sheet's `fixed inset-0` layer**, which makes the feed un-hit-testable; the lock is a belt that keeps working if that geometry ever changes, and it restores each container's `scrollTop` exactly. Radix dialogs (`PostPopup`, `ReplyPopup`, `ImageLightbox`, the first-login deck) are NOT in this set: `react-remove-scroll` blocks by event interception, and the deck was measured over the new shell at four heights — 0px behind it, feed restored exactly.

  - ⛔⛔ **ONE SHEET SHELL, CONTENT-HEIGHT, AND THERE IS NO HEIGHT PROP (MOBILE-2c R-5, ADR-0051 A2 D-3).** `PhoneSheet` is `max-h-[92dvh]`, bottom-anchored, `rounded-t-4xl` (= `--radius-4xl`, 26px, the largest token in the `@theme` scale and the largest actually used), over a 60% `--overlay` backdrop, with `env(safe-area-inset-bottom)` on its body. ⚠ **It used to take `fullHeight`, and `PhoneDebateView` passed `viewer !== null` — so the sheet was the height of the viewport for exactly the readers who can bet, its own backdrop was behind its own panel, and NOT ONE PIXEL of backdrop was reachable.** A tap outside did nothing, so the sheet stayed, and a `fixed inset-0` sheet over a `body{overflow:hidden}` page takes away vertical scrolling AND the tab taps at once — two symptoms of one modal the reader cannot tell is up. That was MOBILE-2c's P0 and it reproduced on **every** engine, not only Android. `tests/unit/debate/phone/phone-sheet-dismissal.test.tsx` pins the absence of any full-height branch; the reachability itself is a browser fact and lives in the B11 matrix.
  - ⚠ **THE CLOSE IS ANIMATED BY DEFERRING `onClose`, NOT BY HOLDING THE OUTGOING CHILDREN.** `PhoneSheet` returns `null` when `!open` and `PhoneDebateView` also stops rendering the composer element, so there are two synchronous unmount paths and neither leaves a window to animate in. `ComposerSlot` solves the same problem by keeping its outgoing element mounted for `EXIT_MS` — rejected here, because that keeps `BetComposer` alive after the reader dismissed it, on the surface that takes money, and the busy interlock exists precisely so the host never has a live composer it has stopped believing in. ⇒ Every door sets a `leaving` phase, the panel slides (260ms in, 200ms out — `design-canon.md §5:109`'s ratified `.26 s` and the founder's Q4 ruling), the root goes `pointer-events-none`, and `onClose` fires at the end. `prefers-reduced-motion` is honoured **in JS**, not only in CSS, for `ComposerSlot.tsx:49-53`'s reason: `motion-reduce:animate-none` suppresses the motion and leaves the delay. **`CLOSE_MS` appears twice — as a constant and as `duration-[200ms]` — and `phone-sheet-motion.test.tsx` pins the two together by reading the file**, because Tailwind's scanner needs a literal and a comment asking the next reader to keep two numbers in step is not a mechanism.
  - ⚠ **The handle is a real gesture now, and `[touch-action:none]` on it is the one place that value is allowed under `phone/`.** Swipe-down dismisses at 80px OR 0.5 px·ms⁻¹ (either bound; the velocity arm is what makes a flick work), the panel follows the finger by inline `transform`, an upward drag clamps at 0, and `busy` blocks it. It uses **pointer events with `setPointerCapture`** and calls `preventDefault` nowhere — the browser is told what the strip is for declaratively instead. The strip is ~36×20px and is not a scroller; the sheet body beside it keeps `overflow-y-auto`.

  - **The guard family:** `tests/unit/design/phone-market-detail.test.ts` (eight source scans — twin-hide-together · no default-breakpoint variant · no `fetch(`/`/api/bets/`/`requests.ts` · the sheet's content set · no `.sort(` · the relation partition off the model · the four-prop mount with no wrapper · no `ssr:false` and no `matchMedia` but `prefers-reduced-motion`) and `tests/unit/debate/phone/*.test.tsx` (RTL — the bar's four states, the F-3 gate, the Support/Counter derivation, the thread partition, sheet a11y). ⚠ It assembles `max-mobile` **at runtime**, for the reason the bullet above gives.
  - ⚠ **TWO EXISTING GUARDS REDDEN ON THIS WORK BY DESIGN AND BOTH WERE UPDATED, NOT LOOSENED.** `tests/unit/shell/page-container.test.ts` pins site 9's class set by EQUALITY, so the added token had to move `now` deliberately; `tests/unit/design/side-pole-binding.test.ts` keeps a CLOSED INVENTORY of files resolving a side to a pole colour, and the phone owner joins it because the tabs resolve the pole at the call site — which is where `AggregateFooter`'s ratified anti-inversion shape puts it, and which the shared tabs component could not do without learning the difference between a side and a relation.
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
├── staging/       OPERATIONAL RUNNERS, not tests — `ls tests/staging/*.staging.test.ts | wc -l` → 4 as at 2026-09-07 (reset · generate · gates · content-markets, the last minted at LIQ-1-RESTORE); the command is the claim. Plus fixtures.ts (the literal fixture table) + content-markets.ts (the eight CONTENT markets, read verbatim from docs/data/staging-markets-snapshot.json — a snapshot, not a fixture table, because their copy is the founder's) + _lib/ (target, client, read-client, write-guard, guards, content-guard, reset, coverage, captured-identities). ADR-0035/0036, STAGING-PARITY Slices A–D. Points at the LIVE staging DB; opt-in only, see the Operational-runners bullet below
├── server/        21 dirs. auth/ (incl. _probe-* + admin-login-result + email-otp-from-guard, AUDIT-FIX-B7b), bets/ (atomicity, concurrency, daily-credit, events-idempotency, idempotency-replay, moderation-outside-transaction, sell, subsequent-buy, validation + AUDIT-FIX-B3: sell-oversell, place-replay-durable, sell-replay-durable, release-failure, double-sell-chain), cron/ (close-due-markets — ENGINE.15, the first route-handler test convention), events/, identity/, middleware/, moderation/ (+ _fixtures/), resolution/ (happy-path, pro-rata, correction, void, concurrency, actor-assert), storage/ (incl. sign-route-envelope, AUDIT-FIX-B7b), admin/ (moderation/ + markets, pool-seed, resolution — each carries its ENGINE.15 wire-action blocks; + markets-media-sign-envelope, AUDIT-FIX-B7b), dharma/ (non-transferable), and — undocumented here until SYNC-5 — comments/, debate-view/, discovery/, health/, lots/, markets/, observability/, profile/, system/, visitors/
└── unit/          ⚠ `debate/phone/` gained three guards at MOBILE-2b and FIVE MORE at MOBILE-2c
│                  (`phone-sheet-dismissal` · `phone-sheet-motion` · `phone-sheet-swipe` ·
│                  `phone-sheet-single-close` · `phone-side-tabs`, plus
│                  `design/phone-touch-handlers`) — `ls tests/unit/debate/phone/` is the claim.
│                  ⚠ The MOBILE-2c five are `_probe-*`-posture REGRESSION guards, not TDD
│                  drivers: the code they pin was already written, so none could be red on
│                  first write and all six were green immediately. **Their proof is the
│                  mutation pass** — 26 source mutations applied and reverted, every one
│                  attributed to a named row, zero survivors — and it found two defects in the
│                  guards themselves, including a tokenizer that split on whitespace and so
│                  could not see a forbidden class in FIRST position, which is exactly where
│                  the defect it hunts would sit. Each MOBILE-2b guard was shaped by what it must
│                  NOT be able to pass. `feed-track-scroll-race` supplies its OWN
│                  IntersectionObserver rather than provoking a real one, because the defect is an
│                  ORDERING fact — a report arriving mid-scroll — and in a browser it reproduces at
│                  the mercy of frame timing. `desktop-neutrality` pins the logic edits outside
│                  `phone/` in PAIRS ("stopped it on a phone" is satisfied by stopping it
│                  everywhere) and measures `vi.getTimerCount()` rather than a painted height,
│                  because a mutation audit showed the height version passing a build whose timer
│                  still ran at full rate. `arm-reset-interlock` renders the real host, drives a
│                  real in-flight submit and asserts the sheet SURVIVES a back swipe — a
│                  double-charge door, not a stray sheet. And `design/phone-portal-tier` pins that
│                  every portal opener under `phone/` declares its tier, which is ADR-0051 A1's
│                  promise and was write-only until both reviewers said so.
└── unit/          `ls -d tests/unit/*/ | wc -l` → 32 as at 2026-09-02; the command is the claim, the figure is a reading of it. Loose: body-fingerprint, rate-limit-prefix, upstash-keys, upstash-redis-config (AUDIT-FIX-B7a — the A14 transport-bound config pins), idempotency-release (AUDIT-FIX-B3). Dirs: bets/ (errors, floors, wire-envelope), cpmm/ (calculate + validate + vectors.test.ts + *.property.test.ts + _arbitraries.ts), markets/ (transitions.test.ts), positions/ (compute.test.ts), resolution/ (basis + basis.property), dharma/ (accrual, canonical, _probe-decimal-negzero, ledger, conservation, conservation-correction), staging/ (`ls tests/unit/staging/ | wc -l` → 11 as at 2026-09-07 — the guards that constrain the tests/staging/ runners WITHOUT touching a database: generator-no-direct-writes incl. the import allowlist, write-guard, runner-target, runner-gating, runner-isolation, reset-guard, guard-list-parity, fixture-table, deadline-clamp, and LIQ-1-RESTORE's two — content-markets-source (the eight parse into something `createMarket` accepts) and content-market-reset-guard (the reset refuses to destroy a market it did not create, and is wired to)), design/ (`ls tests/unit/design/ | wc -l` → **30** as at 2026-09-13, of which **THREE height chains** — `discovery-height-chain`, `profile-height-chain`, `debate-height-chain` (added at HTML-FINISH · MARKET DETAIL); all three are SOURCE SCANS, because jsdom performs no layout. ⚠ this line said FOUR. The fourth was real: `tests/unit/design/bookmarks-height-chain.test.ts` was minted at `c6526a9`, landed on `main` at `fd4b357` (HTML-FINISH · BOOKMARKS, PR #338, 2026-08-16), and was **deleted by UNWIRE-1 / ADR-0040** at `8f353c4` and `ff1c0f9` on 2026-08-22, along with the surface it guarded. Three remain. ⚠⚠ **THE COUNT WAS 17 AND THE DIRECTORY HELD 29 BEFORE MOBILE-2h ADDED ITS THIRTIETH** — twelve files of drift, accumulated across the rounds that wrote them, and corrected here only because this round moved the figure. The figure is a reading; the command beside it is the claim, and running it was what found the gap), and — undocumented here until SYNC-5 — _support/, auth/, comments/, composer/, config/, copy/, db/, debate/, debate-export/, debate-view/, discovery/, docs/, identity-pool/, lots/, middleware/, observability/, onboarding/, profile/, ranking/, scripts/, shell/, storage/, ui/, and art/ (WARLI-1/2 — `ls tests/unit/art/ | wc -l` → 7 as at 2026-09-02, not the 5 this entry carried before WARLI-MOUNT added `_mount-scan.ts` and `mount-scan-reach.test.ts`: `ring-geometry.test.ts` asserts the ring engine against HAND-COMPUTED positions rather than a snapshot, because a snapshot pins whatever the engine does today and it caught a real `-0` defect on its first run; `warli-render.test.tsx` reads the rendered `transform` attribute, which is the ONLY place facing/radius/phase reach the DOM; `art-layer-guards.test.ts` holds the raster, side-pole, raw-hex, injection-sink and OUTBOUND-seal checks, plus the inbound MOUNT-SITE pin — that last row asserted the importer list was EMPTY until WARLI-MOUNT and now asserts it is exactly `src/app/(auth)/layout.tsx`, inverted rather than deleted so a second mount still reddens; `wobble.test.ts` (WARLI-2) — ⚠ its FIRST block is the load-bearing one, because determinism, endpoint-preservation and bounded amplitude are ALL satisfied perfectly by a wobble that does nothing, which is how this slice most likely fails and it fails GREEN; `composition.test.tsx` (WARLI-2) holds G1–G4 — pairs at 180°, the static field facing centre, exactly 8 faces, and the density meridian, the last of which measures ink NORMALISED BY ADMISSIBLE AREA because the middle columns of the frame ARE the rings and a raw column count measures the hole in the doughnut)
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
  - ⛔ **AND WHEN YOU GREP THE BUILT SHEET INSTEAD, IT IS `.next/static/chunks/*.css`. `.next/static/css/` DOES NOT EXIST IN THIS TREE** — Next 16 with Turbopack emits the app stylesheet alongside the JS chunks. ⚠ **The wrong path does not fail loudly; under zsh the glob never expands at all** (`no matches found: .next/static/css/*.css`), so `grep` is never invoked and the visible result is **indistinguishable from a clean pass** — O-13, on the check you reached for precisely to catch a silently-inert stylesheet. **Confirm the command returns a NON-EMPTY list**; a zero here means the path is wrong, not that the utility is absent. *Already paid for once: `docs/logs/POLISH-4.md:293` recorded "no compiled-CSS read was available" on the strength of the wrong directory, and `scripts/chart-6-contact-sheet.tsx:87` has carried this same warning under **O-3** since — in a script, while neither contract file recorded the path. Written here at MOBILE-1 · Job A, where a plan re-derived the bug.*
  - ⛔⛔ **AND THE PROBE ITSELF CAN MUTATE THE THING IT IS ABOUT TO MEASURE — A `return { … }` LITERAL IS EVALUATED WHEN IT IS REACHED, NOT WHERE ITS READS ARE WRITTEN.** A geometry read placed inside the returned object (`markWidth: bw(mark)`) runs **after** every statement above it in the function — so a probe that measures, then mutates, then returns has in fact **mutated and then measured**. Measured at MOBILE-1-HEADER: a probe that stripped every `max-mobile:` token off the live header (ADR-0049's own prescribed desktop non-regression check) and returned geometry in the literal reported the brand mark at **48.00px at a 320px frame, `documentOverflow: 379`, `header.scrollWidth: 754`** — *the exact pre-Phase-A figures*, i.e. a precise, plausible, internally-consistent reading of a reflow that had completely failed. **It had not failed; the probe was reading the stripped desktop layout.** ⇒ **Freeze every measured value into a primitive BEFORE any mutation** — build the result object first and mutate afterwards, never the reverse. ⚠ The failure mode is what earns this its own entry: the wrong answer **incriminates the code under test** rather than the harness, it matches a real historical baseline exactly, and nothing in it looks anomalous. Same family as the `getComputedStyle` rule above and NOT the same rule: there the STYLE API re-resolves under you; here **your own probe moved the DOM**, and no amount of snapshotting a declaration helps.
  - ⛔⛔ **A MEASUREMENT THAT CANNOT EXPRESS THE FAILURE SCORES THE FAILURE AS A PASS, and this bit twice in one night at two different layers.** (a) A tier root that renders NOTHING still has a full WIDTH: a height-chain change collapsed `<main>` to zero on WebKit, and the sweep passed it — overflow 0, the 640px gate correct, the phone root present — because every check was looking at width. **Assert a non-zero HEIGHT on the element you came to measure.** (b) A page served with NO STYLESHEET screenshots cleanly: boxes are non-zero, `document.fonts.status` is `"loaded"`, Suspense is revealed, nothing errors. Sixteen PNGs were taken of an unstyled document before anyone opened one. The cause is ordinary — running `next build` against a live `next start` leaves the server referencing chunks that no longer exist — and the tell is one line: **assert `document.styleSheets.length > 0` and that `body`'s computed background is the app's ground rather than transparent or white.** ⚠ Neither was caught by a control; both were caught by accident, which is the argument for making them assertions.
  - ⚠ **`disabled` CONTROLS ARE NOT TAP-TARGET FAILURES** — WCAG 2.5.8 exempts inert controls, and counting them inflated a 44 to a 55 on a surface where one disabled placeholder renders per card. Mark `disabled` / `aria-disabled` and report both numbers, because a before-measurement taken with the inflated instrument has to stay comparable to the after.
  - ⛔⛔ **AND THE LAYOUT CAN BE RIGHT WHILE THE PAINT IS WRONG — INSIDE `<foreignObject>`, WEBKIT MIS-PAINTS A NEGATIVELY-OFFSET `position: relative` BOX AND REPORTS ITS GEOMETRY CORRECTLY.** `quote-well/QuoteWell.tsx` is an `<svg>` whose content is HTML in a `foreignObject`. Its two quotation marks were 67.5px glyphs in 21px boxes pulled into place by `top: -N`. On WebKit the opening mark painted **on top of the title's first line and right of centre**, and the closing mark did not paint at all; Chromium was correct. ⚠ **Every geometric instrument said the two engines agreed**: `getBoundingClientRect` on the mark, `getComputedStyle` on every declaration, and `Range.getClientRects()` over the glyph's own text run — all identical to within 0.1px, at 375 and at 1440. A geometry-only check reports this defect as ABSENT. ⇒ **Capture the paint and look at it**, and when the two disagree, **bisect by overriding one declaration at a time on the broken engine** until the picture moves — that is what named `position: relative` here, and nothing else moved anything (not `justify-content: safe center`, not `text-wrap: balance`, not the well's `overflow: hidden`). The fix takes the optical inset with margins, arranged so the outer box is unchanged, which is what keeps the working engine identical. ⚠ **`elementHandle.screenshot()` is itself a suspect on an `<svg>`** — it clips by the element box; re-shoot from a viewport capture cropped to the element's own measured rect before believing a paint difference.

  - *Minted at TIME-1 · Form B, where the first probe returned `0×0` for every element on Discovery and the cause was three layers down in React's shipped reveal script. Sub-bullets 3–6 are standing practice the same run used; they are recorded here because they are the same class — each turns a silent wrong answer into a thrown one. **The last two are BLOCK-4's and are the same class again, one layer up: there the harness lied about geometry, here the style API lies about state.** The stale-utility rule is MOBILE-1 Phase A's and is the same class a third time, one layer lower again: there the harness lied about geometry and the style API lied about state; here the BUILD lies about what shipped, and its lie is indistinguishable from a correct measurement of a broken fix.*
- **Integration** (real test Postgres): any service-layer function that writes. Mandatory scenarios as the ENGINE lands — bet atomicity, Dharma reconciliation, side-freeze on comment, payout math, append-only enforcement.
- **Scale** (opt-in, real test Postgres): `tests/scale/` is the correctness-at-scale battery (collision storms, hot-row contention, determinism under load — ENGINE.10 Q-2). It runs **only** via `pnpm test:scale` with its own `vitest.scale.config.ts`; the default config **excludes `tests/scale/**`** (`vitest.config.ts`), so a bare `vitest run` — local or CI — never picks it up.
- **Operational runners** (opt-in, the LIVE staging database): `tests/staging/` holds non-test operational artifacts that borrow the Vitest harness for module resolution — ADR-0036. **FOUR runners are on disk, not one** (`ls tests/staging/*.staging.test.ts` is the claim; this line has said THREE since Slice D and gained its fourth at LIQ-1-RESTORE):
  - `reset.staging.test.ts` — the guarded staging reset (ADR-0035). `pnpm staging:reset` (which `&&`-chains `db:seed:staging`, because the reset leaves `identity_pool` empty). ⚠ Since LIQ-1-RESTORE it carries a SIXTH gate, and it is the only one that asks about DATA: the pre-flight reads `SELECT slug FROM markets` and REFUSES, naming every slug, when it finds one no fixture family claims (`sp-m*`, `volume-fixture-*`). `markets` is in `TRUNCATE_SET`, and on 2026-09-07 that cost eight founder-authored content markets. Acknowledge with `ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS=include-content-markets`; a boolean-shaped value fails closed. Predicate: `_lib/content-guard.ts`.
  - `generate.staging.test.ts` — the **engine-driven fixture generator**. Drives `createOAuthUser` · `acceptTosAction` · `createMarket` · `openMarket` · `place` · `sell` · `closeMarket` · `triggerResolution` · `settleMarket` · `voidMarket` · `moderateComment` · `addBookmarkAction` · the R2 image chain, and writes **NOTHING** itself. `pnpm staging:generate`.
  - `gates.staging.test.ts` — the **six verification gates** (event parity incl. G1.6 content parity and G1.7 flow-id parity · conservation · durable receipt integrity · coverage · magnitudes · zero-share). Emits `docs/polish/staging-coverage.json` and fails RED if it drifts from the committed copy. `pnpm staging:gates`.
  - `content-markets.staging.test.ts` — **the CONTENT-market seeder** (LIQ-1-RESTORE). Drives `createMarket` and `openMarket` over the eight markets in `docs/data/staging-markets-snapshot.json`, reusing their ORIGINAL UUIDv7 ids so the sixteen surviving R2 objects stay addressable, and writes NOTHING itself. Idempotent in both phases (`MarketSlugTakenError` / `MarketLifecycleStateError` are the only errors swallowed). Invoked through `scripts/seed-content-markets.ts`, which is the CLI half — `--env staging|local` (never defaulted, `prod` refused by name), `--create` / `--open --price <p> --tank <T>` / `--media`. ⚠ **That split is not decoration.** A plain `tsx` script cannot reach the engine: `tsx` alone dies on `server-only`'s exports map and `tsx --conditions=react-server` dies on `canonicalize@3.0.0` having only an `import` condition (both measured 2026-09-07 at `67ceb6b5`), and `openMarket`'s `next/cache` call needs a module mock `tsx` cannot install.
  - `fixtures.ts` — the literal fixture table (no RNG). `content-markets.ts` — the eight content markets, parsed from the committed snapshot; a snapshot rather than a table because the copy is founder-authored and the repository was never its source. `_lib/` holds the target resolver, the write-guarded and read-only clients, the guard predicates (including `content-guard.ts`), the reset mechanism, and the gate-4 coverage inventory.
  - **`pnpm staging:rebuild`** is the composite: reset → seed → generate → gates. ⚠ It now REFUSES at the first step whenever content markets are present — see the reset's sixth gate above.
- **Never mocked in a runner:** anything that writes a row or moves Dharma (ADR-0036 primitive 3). Only the HTTP/cookie shell may be — `next/headers`, `next/navigation`, `next/cache`, `verifyOnboardingRef`, `requireAdminSession`, `auth.api.getSession`. **`tests/unit/staging/generator-no-direct-writes.test.ts` pins an ALLOWLIST of the `@/server/**` entrypoints a runner may import**; adding a name to it is a decision, not an edit, and `@/server/events/insert` + `@/server/dharma/persist` are pinned as *not* ratified as its own positive control.
- The default config **excludes `tests/staging/**`** exactly as it excludes `tests/scale/**`, so no bare `vitest run` — local, CI, or a subagent's — can reach a live database. Each runner additionally refuses to start unless the FIVE-guard contract passes (intent · target · environment · live connection · post-run verification — the G-5 intent token is the ADR-0035 Addendum's addition to primitive 6's four); the **write-capable** runners require the intent token, the read-only gates deliberately do not. Isolation is asserted by `tests/unit/staging/runner-isolation.test.ts`; the runners' gating shape by `runner-gating.test.ts`; the no-direct-writes rule behaviourally by `_lib/write-guard.ts` and textually by `generator-no-direct-writes.test.ts`; and the fixture table's own consistency — including the C3/C4 lane calibration, computed with the shipped pure `badgeFor` — by `fixture-table.test.ts`.
- **Invariant tests** at `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts` — `ls tests/invariants/ | wc -l` → **13** as at 2026-09-02. ⚠ The count and the enumeration below are two claims, and they have disagreed before: this line read `12` beside a list of 12 while `I-GENESIS-001` sat on disk unlisted. Count first, then read the list.
  - `I-APPEND-ONLY-001.resolutions-append-only` (INV-4) — `resolution_events` + `payout_events` reject UPDATE/DELETE post-INSERT at the storage layer.
  - `I-ATOMICITY-001.bet-comment-atomic` (INV-1) — one SERIALIZABLE W-1 tx wraps the full bet spine; if any write throws, every write rolls back (minted ENGINE.7).
  - `I-DAILY-ONCE-001.daily-credit-once-per-utc-day` — at most one `daily_allowance` ledger row per user per UTC day; storage backstop is the unique partial index `dharma_ledger_daily_allowance_day_uq` (minted ENGINE.12).
  - `I-GENESIS-001.open-implies-market-opened-event` — every market in status `Open` carries a `market.opened` event (SPEC.1 §17 `markets::open-implies-market-opened-event`; minted CHART-3). True by construction in the product — `seedPoolAction` → `openMarket` is the only path to `Open` and emits the event inside the same W-4 transaction — which is exactly why it needed a test: a property nothing asserts stays true until a migration, a restored snapshot or a hand-fixed status makes it false, and the only symptom is a blank chart. `replayReserveSeries` seeds its walk from that event, so without it the series is `[]` and the surface renders nothing, indistinguishable from a market nobody has bet on. ⚠ **This line used to end "Staging is in that state on all eight markets, because they reached `Open` outside the product." That is no longer true, and the reason is worth keeping:** those eight were destroyed by the 2026-09-07 reset and recreated at LIQ-1-RESTORE *through* `createMarket` / `openMarket`, so each now carries exactly one `market.opened` (measured 2026-09-07). The genesis rows exist because the product minted them — which is the same fact the invariant asserts, arriving the only way it ever should.
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

  ⚠ **AND `git diff <branch>...origin/main` IS THE WRONG INSTRUMENT FOR THE SAME QUESTION — IT RE-REPORTS THE WHOLE CHANGE WHEN THE MERGE WAS PERFECT.** Three-dot earns its place against a **moving** base: it diffs `B` against the merge base, deliberately hiding commits `B` gained while you worked. A squash merge has **no parent link to the branch**, so the merge base of the branch tip and the squash is the **pre-merge tip of `main`** — which makes the three-dot diff `pre-merge-main..squash`, i.e. the entire change, forever, however correctly it landed. Measured at #505: merge base `69513a0c`, three-dot `51 insertions(+), 4 deletions(-)`, two-dot **empty**, and the work had landed byte-for-byte. ⇒ **For two PINNED SHAs the question is whether the trees are equal, and a tree hash answers it directly:**
  ```bash
  git rev-parse '<branch-tip>^{tree}'   # a81432c3…
  git rev-parse 'origin/main^{tree}'    # a81432c3…  equal = that exact tree landed
  ```
  Prefer it over the (also correct) empty two-dot diff: a hash is a **positive** receipt you can quote in a report, whereas an empty diff reports success as *silence* — the one output indistinguishable from a command that never ran (`O-13`; §9's zsh-glob trap is the same shape).
- **Commit identity:** `Zugzwang/world <zugzwangworld@proton.me>`, git username `Chrollo`.
- ⚠ **"No `Co-authored-by` trailer" IS NO LONGER TRUE, and this line asserted it for months after the practice reversed.** Measured 2026-09-07 on `origin/main`: **32 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` lines across the last 30 squash commits**, each paired with a `Claude-Session:` URL. The rule as written — *"Foundation commits are single-author; never append a `Co-authored-by` line"* — was a real decision (it is why `docs/logs/SYNC.10.md` records a leaked trailer as a defect), and it has been superseded by the harness's own attribution instruction rather than by a ruling anybody wrote down. **The current shape is: body → blank → `Instructions for AI` block → blank → `Co-Authored-By:` → `Claude-Session:`.** Recorded as measured rather than corrected in either direction, because which one the founder wants is a ruling and this file is descriptive. The half that has NOT changed: the author identity itself is always `Zugzwang/world <zugzwangworld@proton.me>`, and a trailer must never be the thing that carries authorship.
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
