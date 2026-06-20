# Session log — FIX-AUTH-SIGNUP (diagnostic + fix plan)

**Stratum/state:** PLAN-mode diagnostic — complete, plan approved, no code fix (HARD STOP honored).

## What landed (files + PR#)
- `docs/plans/FIX-AUTH-SIGNUP.md` — diagnostic + fix plan (this branch, off `origin/main`).
- `docs/logs/FIX-AUTH-SIGNUP.md` — this log.
- No code change, no migration, no deploy, no PR. No temp diagnostic instrumentation created.

## Decisions made
- **Root cause proven by source inspection** (no live instrumentation needed): Better Auth `1.6.11`'s drizzle adapter `transformInput` (`factory.mjs:108–109`) only writes fields in its user *model*; the model lacks `pseudonym`/`pfpFilename`/`googleId` because `user.additionalFields` is undeclared (`get-tables.mjs:130–172`). Hook-injected `pseudonym` (`with-hooks.mjs:18–21`) is dropped → `users.pseudonym` NOT-NULL no-default → **Postgres `23502`** → raw (non-APIError) throw → `link-account.mjs:113–117` returns `unable_to_create_user`.
- **"Re-seed identity_pool" hypothesis rejected.** An empty pool would surface `identity_pool_exhausted` (APIError, `link-account.mjs:108–112`), not `unable_to_create_user`. The 2 stranded tuples prove the pool is seeded and consumed.
- **Fix = code-only:** add `user.additionalFields` ({ pseudonym, pfpFilename, googleId } each `type:"string", required:false, input:false`) in `src/server/auth/index.ts`. `input:false` is security-load-bearing (blocks client pseudonym spoofing via `parseInputData` `schema.mjs:40–51`; hook-injected value unaffected). No schema/migration.
- **Standing requirement:** new real-DB end-to-end signup test (`tests/integration/signup-create-path.integration.test.ts`) — drives real `auth` create-path, asserts real `users`+`accounts` row + pool tuple consumed + pseudonym round-trips. RED (23502) → GREEN is the live confirmation.

## Open questions (→ web review)
1. `users.google_id` disposition: populate via `additionalFields` (recommended) vs. drop as dead (sub already in `accounts.account_id`). SURPRISE — has been NULL for every user.
2. Canonical TASK-ID / tracker placement (currently provisional `FIX-AUTH-SIGNUP`, no tracker row).

## Next session starts at (exact next action)
Fresh **execute** chat (Fable 5), after web + operator review the plan: `git checkout fix/auth-signup-additionalfields`, then Execution-sequence step 2 — `@test-writer` writes `tests/integration/signup-create-path.integration.test.ts` (RED), capture the verbatim `23502` line, then implement the `additionalFields` block.

## Context to preserve
- Branch `fix/auth-signup-additionalfields` is off `origin/main` `bdb4e71…`; local `main` was stale (`1a18fd5…`) — execute chat must branch/rebase from `origin/main`, not local `main`.
- No existing harness instantiates real Better Auth against test Postgres; the e2e test must build one (`auth.$context`) and NOT mock the adapter/hooks (the mock-at-boundary pattern is exactly what hid this bug).
- Critical-path: full ritual in execute (test-writer → code-reviewer → security-auditor → §5.10 self-audit). No db-migration-reviewer (no schema change).

## Time
2026-06-20.

---

# Session log — FIX-AUTH-SIGNUP (execute) — Session 2

**Stratum/state:** Execute — fix + e2e test landed; PR #149 OPEN, NOT merged (web+operator gate). PR only, no prod touch (HARD STOP honored).

## What landed (files + PR#)
- `src/server/auth/index.ts` — `user.additionalFields` for `pseudonym`/`pfpFilename`/`googleId` (`{type:"string",required:false,input:false}`). Code-only, no migration. (commit `d9a9ebb`)
- `tests/integration/signup-create-path.integration.test.ts` — first real-DB e2e signup test (real `auth.$context.internalAdapter.createOAuthUser`, no adapter/hook mocking).
- **PR #149** → `main` (base `origin/main` `bdb4e71`; all commits signed). DO NOT MERGE.

## Decisions made
- RED witnessed (verbatim `null value in column "pseudonym" … 23502`) → GREEN after fix.
- Web+operator rulings applied: `google_id` populated (not dropped); TASK-ID `FIX-AUTH-SIGNUP`.
- AGENTS.md auth-gotcha line NOT added unilaterally — surfaced in the PR body for web to ratify; if approved, amend into this same unmerged PR.

## Open questions (→ gate)
- AGENTS.md gotcha line: add or not (recommended).
- `google_id` denormalization (duplicate of `accounts.account_id`, not an auth key) — keep or drop the column in a later schema task.

## Next session starts at (exact next action)
Gate: web + operator review PR #149. On approval → merge → deploy to staging → operator completes a real Google + email-OTP signup (runbook step #2) as acceptance.

## Verification (all green)
- New test RED→GREEN; `@code-reviewer` clean (no findings); `@security-auditor` gate holds (client cannot self-assign identity; INV-1..4 untouched; admin untouched).
- `ZUGZWANG_ENV=preview just verify` → All checks passed; full `pnpm vitest run` → 966 passed / 0 failed (134 files).

## Context to preserve
- The fix is complete: the other 7 custom `users` columns bypass Better Auth's adapter (direct Drizzle/raw SQL), so only the 3 create-path columns needed declaring (code-reviewer-verified).
- Pre-existing LOW (out of scope): `better-auth` `link-account.mjs:107` `logger.error(e)` logs raw errors.
- Stranded tuples RedFox000/RedWolf001 → 30-day sweep, no action.

## Time
2026-06-20.
