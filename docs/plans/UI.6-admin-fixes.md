# UI.6 admin-fixes — post-merge operator fixes (off main @ 1a18fd5)

Branch `feat/ui6-admin-fixes`. Three operator-reported problems on the live PRODUCTION deploy
after PR #145 merged. Read-only audit surface stays read-only; ENGINE.15 market pages are
STYLE-ONLY (no logic/schema/server-action change). No schema change, no migration in this PR.

## Problem 1 — `/admin/moderation/audit` 500 (digest 2374087621) — DIAGNOSED FROM PROD

Root cause (confirmed by a read-only prod schema + query check via Doppler `prd`):
**migration `0016_mod_actions_reason.sql` was never applied to the production database.** Prod
`mod_actions` has no `reason` / `target_market_id` / `blocked_text` columns and no `mod_reason`
enum (row count 0). The audit query filters on `reason` → verbatim prod error
**`42703 column "reason" does not exist`** → the Server Component throws → Next 500 (that digest).

- **The REAL fix is operational** (REPORT, do NOT auto-run — sensitive prod action): apply the
  pending migrations to prod (`doppler run --config prd -- pnpm exec drizzle-kit migrate`).
  Deployment-process gap: `vercel.json` build is `next build` only; the sole migrate script is
  `db:migrate:staging` — prod migrations are out-of-band and 0016 was missed. DEBATE.7's
  `recordGateBlock` is also broken in prod until this is applied.
- **Code fix (this branch, defense-in-depth + the regression test the task asks for):** wrap the
  loader in try/catch in the page; on failure log via Sentry `captureException` + render a clear,
  admin-only error panel ("couldn't load — moderation schema may be behind; apply pending
  migrations") instead of a raw 500. `requireAdminPage()` stays OUTSIDE the try so its redirect
  still propagates. Page remains strictly read-only.
- **RED-first tests** (the live-render path the mocked tests never exercised — no test ever
  rendered the page):
  - `audit-degrade.test.ts` — loader throws → page renders the error panel, does NOT throw, logs.
  - `audit-render.test.ts` — real-DB render: seeded blocked rows render expected content
    (reason badge, BANNED, image placeholder, blocked text); empty result renders the empty state.

## Problem 2 — admin pages unstyled (legibility pass, STYLE-ONLY)

Finding: the global stylesheet IS loaded — root `src/app/layout.tsx:3` imports `./globals.css`
and the `(admin)` group has no nested layout, so Tailwind applies. The ENGINE.15 admin pages were
authored with ZERO styling classes (raw `<main><h1><table>`), which is why they render unstyled.

- New shared presentational primitives `src/app/(admin)/admin/_ui.tsx` (private folder, not a
  route): `AdminShell`, `Banner`, and `adminInput/Button/Select/Textarea/Label` class consts —
  stable shadcn semantic tokens ONLY (`background/card/border/muted/primary/destructive`), NO
  placeholder brand tokens (`--color-yes/no/brand` frozen until DESIGN.7, AGENTS.md §8).
- Restyle: `markets/page.tsx` (list), `markets/new/page.tsx` (form), `markets/[marketId]/page.tsx`
  (detail + state forms), `login/page.tsx`. STYLE-ONLY — every form `name`, server-action closure,
  state conditional, and redirect target preserved byte-for-byte; only className + layout wrappers
  added.

## Problem 3 — `slug_invalid`

Rule (`src/server/markets/create.ts:30-32`, unchanged): `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
length 3–80. Lowercase kebab-case; no uppercase / spaces / underscores / leading-trailing-double
hyphens. Example: `will-eth-flip-btc-2026`.

- New-market form: add helper text under the slug field stating the rule + example, and map the
  `slug_invalid` (and `slug_already_taken`) codes to specific human messages. Form-presentation
  only — the service validation is untouched.

## Ritual
RED-first test for the 500 fix; `@code-reviewer` + `@security-auditor` (focus the 500 fix; confirm
the audit page stays read-only + leak-free and the restyle adds no new data exposure); no
`@db-migration-reviewer` (no schema). `just verify` + new tests + moderation suite. Confirm the
page actually RENDERS on the fresh preview. Open PR, no merge.
