# S-4 Phase B — Session log

**Task:** S-4 (read-path collapse) Phase B — migration unblock. Enable `cacheComponents`
without caching anything or changing behavior. Plan: `docs/plans/` (not yet committed —
plan file currently lives at the Claude Code plan-mode path; see "Context to preserve" below).

---

## What landed (uncommitted — no PR opened yet this session)

**`package.json` / `pnpm-lock.yaml`** — `next` bumped `16.2.4 → 16.3.2`. Required: the
`export const instant = false` route-segment config the migration plan depends on does not
exist in 16.2.4 (confirmed via `grep` across the installed `node_modules/next/dist/` —
zero hits; it silently no-ops rather than erroring, which is what made the first attempt
at this phase fail confusingly). Verified in isolation before touching anything else:
typecheck clean, plain `next build` (flag still off) green, no incidental breakage from
the bump alone.

**`next.config.ts`** — `cacheComponents: true` added.

**13 files** carry `export const instant = false;` (deferring the framework's
instant-navigation validation, per the official incremental-adoption path):
- `(public)`: `layout.tsx`, `page.tsx`, `m/[slug]/page.tsx`, `u/[pseudonym]/page.tsx`,
  `bookmarks/page.tsx`
- `(admin)`: `page.tsx`, `markets/page.tsx`, `markets/[marketId]/page.tsx`,
  `markets/new/page.tsx`, `moderation/page.tsx`, `moderation/audit/page.tsx`,
  `login/page.tsx`
- `(auth)`: `layout.tsx` (covers `/sign-in`, `/sign-in/otp`, `/onboarding` — one shared
  layout)

**10 files** had `export const dynamic = "force-dynamic";` removed (redundant/build-breaking
under `cacheComponents` — confirmed via the official Next.js migration guide: "all pages
are dynamic by default... just remove it"): the 4 originally in-fence (`(public)/page.tsx`,
`m/[slug]/page.tsx`, `m/[slug]/quote/route.ts`, `m/[slug]/export/route.ts`) plus 6
out-of-fence (`api/visits/route.ts` and 5 `(admin)` pages) — the out-of-fence removal was
explicitly approved as a scoped fence exception (mechanical, 1-line, zero behavior change;
the flag is global and the build errors on ANY route still exporting `dynamic`, in or out
of any lane's stated fence).

**3 test files** updated to match — none were caught by the original grep-based inventory,
all were live assertions that would otherwise fail:
- `tests/unit/discovery/render/page-states.test.tsx` — pinned `page.dynamic === "force-dynamic"`,
  now pins `page.instant === false`
- `tests/server/debate-view/poll-contract.test.ts` — pinned the literal `dynamic` export string,
  now asserts the page contains no `'use cache'` directive (the inverted but equivalent guarantee
  under Cache Components: dynamic-by-default unless a route opts INTO caching)
- `tests/integration/market-quote.integration.test.ts` — updated a stale "PINNED ROUTE CONTRACT"
  doc comment, not a live assertion

**Verification run:** `ZUGZWANG_ENV=preview` typecheck clean, Biome clean (same 5
pre-existing warnings/4 infos, none in touched files), `next build` green on all 26 routes,
21 non-DB test assertions passing. `next start` smoke test: Discovery (`/`) 200 with real
content, `/api/health` `db: ok`, a real market detail page (`/m/[slug]`) 200 with full
rendered content and `Cache-Control: private, no-store` (confirms nothing is being served
cached to the client — Phase B caches nothing, as designed).

## Decisions made

1. **Defer the Suspense hoist to Phase C/D via `instant = false`**, rather than doing the
   pack's literal "hoist runtime reads into uncached parents in this same phase." Chosen
   because it keeps Phase B genuinely behavior-neutral and couples the real hoist to the
   caching work it exists to enable. Turned out to require the Next.js version bump below.
2. **Include the 6 out-of-fence `dynamic`-removal edits in this PR**, flagged explicitly
   rather than treated as a silent H1. The alternative (halt entirely until a separate
   admin-owning task does 6 one-line deletions) was judged worse than a clearly-labeled
   fence exception for a zero-behavior-change mechanical fix.
3. **Upgrade Next.js 16.2.4 → 16.3.2**, once `--debug-prerender` proved the real blocker
   was 14 routes across three route groups (not the 10 originally scoped), and that
   `instant` — the lever the whole plan depended on — doesn't exist in 16.2.4 at all.
   Rejected alternatives: doing the full Suspense hoist immediately on Next 16.2.4 (bigger,
   riskier diff, arguably itself an H4 violation), or holding Phase B entirely.
4. **Accept the redirect-delivery regression, document it, ship anyway** (tech-lead
   ruling this session). See "Open questions / known gaps" below — this is the one
   finding that's a genuine, unresolved behavior change, not fully closed by this PR.

## Open questions / known gaps

- **`redirect()` no longer produces a clean HTTP 307 on any route still carrying
  `instant = false`.** Once `cacheComponents` is on, the framework streams the response
  (`x-nextjs-postponed: 1`) even on routes the build labels plain `ƒ Dynamic`, so by the
  time a `redirect()` call is reached, a `200` has already been sent — Next falls back to
  `<meta http-equiv="refresh" content="1;url=...">` + client-side nav instead of a
  protocol-level redirect. Verified directly via `curl -D -` against the built app:
  `/bookmarks` (signed-out) returns `200` with the meta-refresh tag and
  `9:E{"digest":"NEXT_REDIRECT;replace;/sign-in;307;"}` embedded in the flight payload,
  not a real `Location` header. Real browsers still land correctly (both mechanisms fire);
  a non-JS client (curl, a crawler, a bot without JS) sees a ~1s-delayed meta-refresh
  instead of an instant redirect. Affects every route whose job is (partly or wholly) a
  redirect: `bookmarks/page.tsx` → `/sign-in`, `(admin)/admin/page.tsx` →
  `/admin/moderation`, and `requireAdminPage`'s own `/admin/login` redirect on every admin
  page it guards. **Documented inline** at the two page-level redirect call sites
  (`bookmarks/page.tsx`, `(admin)/admin/page.tsx`). **Closes when the S-4 Phase C/D
  Suspense hoist lands on these specific routes** — verify via `curl -D -` for a real
  `307`/`Location` header, not just a `200`, as the exit criterion.
- **Local Postgres is not set up in this environment** (`supabase` CLI not installed,
  nothing listening on `:54322`). The full DB-backed `vitest run` suite hangs indefinitely
  waiting on a connection rather than failing fast — killed after ~20 min idle (near-zero
  CPU accumulation is the tell). Could not run `pnpm test:invariants` / `test:integration` /
  `just test-db` this session. Verified what doesn't need a DB (typecheck, Biome, build,
  the 3 edited test files' own assertions, live HTTP smoke test against the built app using
  the real staging DB via `.env.local`'s `DATABASE_URL`) — this is a load-bearing gap for
  whoever runs Gate C / the full regression suite before merge.
- **Plan file not yet committed to `docs/plans/`** — it exists at the Claude Code plan-mode
  path (`~/.claude/plans/wobbly-drifting-coral.md`), not in-repo yet. CLAUDE.md §5.1 wants
  it at `docs/plans/<TASK-ID>.md`, committed before Phase 1 ends.

## Next session starts at

1. Set up local Postgres (`supabase start` or equivalent) so the DB-backed suites can
   actually run — this session's verification is incomplete without it.
2. Run `pnpm test:invariants`, `pnpm test:integration`, `tests/server/discovery/round-trip-budget.test.ts`
   specifically (the driver-level pinned test — must still assert `1 + 12*N`, unchanged from
   Phase A) once Postgres is up.
3. Copy the plan content into `docs/plans/S4-PHASE-B.md`, committed.
4. Self-audit against the plan's own checklist (§5.10-style), then open the PR — flag the
   6-file fence exception and the redirect gap explicitly in the PR body, per the decisions
   above.
5. Gate C / RP-3 review.

## Context to preserve

- Phase A audit: `~/Downloads/zz_S4-AUDIT_phaseA_2026-08-21T1626.md` (328 lines,
  md5 `1ba722b0d956b9d5053878edd0a4c126`)
- The `instant`/Next-16.3.2 finding is worth carrying into Phase C/D's own kickoff — that
  phase's actual Suspense hoist work needs to know it's landing on 16.3.2, not 16.2.4, and
  that closing the redirect gap on `bookmarks`/`admin` should be an explicit item in its
  scope, not rediscovered.
- Working tree state at session end: `next.config.ts`, `package.json`, `pnpm-lock.yaml`,
  16 `src/app/**` files, 3 `tests/**` files modified; nothing committed.

## Time

2026-08-21, single session (Phase A audit → Phase B plan → two build attempts, one full
revert between them → Next.js version bump → Phase B re-executed → smoke-tested →
redirect-behavior finding → tech-lead ruling to accept and document).
