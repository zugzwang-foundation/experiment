# Session log — FIX-AUTH-LOGIN (execute)

**Stratum/state:** Execute — returning/onboarded-user-login 500 fix + e2e test landed; **PR #150 OPEN, NOT merged** (web+operator gate). PR only, no prod touch (HARD STOP honored).

## What landed (files + PR#)
- `src/server/auth/index.ts` — `ONE_HUNDRED_YEARS_SEC` (100y) → `SESSION_MAX_AGE_SEC = 60*60*24*400` (34,560,000 = 400-day cap). `disableSessionRefresh: true` retained.
- `docs/specs/SPEC.2.md` §8.2 — web-ratified "Session lifetime" text (replaces "Indefinite cookie lifetime").
- `docs/adr/0004-better-auth.md` — Patch record P1 (§5.12; corrects the "indefinite / silently re-issued" consequence) + 2 inline pointers. (code-reviewer HIGH.)
- `src/db/schema/auth.ts` — sessions comment "sentinel" → "400-day cap". (code-reviewer MEDIUM.)
- `tests/integration/onboarded-login-session.integration.test.ts` — first e2e through real `setSessionCookie` for an onboarded user.
- **PR #150** → `main` (base `origin/main` `52ed64d`; commit `df7fce6`, signed). DO NOT MERGE.

## Decisions made
- Root cause (confirmed prior read-only chat + here): 100y `expiresIn` → cookie `maxAge` → better-call throws (`> 34,560,000`, cookies.mjs:55) → uncaught 500 on the onboarded session-issuance path (gate defers first-time signup). NOT #149.
- Exact value: **34,560,000** (400 days). better-call's guard is strict `>`, so the boundary passes (both reviewers confirmed). RED (`Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.`) → GREEN witnessed.
- code-reviewer HIGH (ADR-0004) + MEDIUM (schema comment) fixed in-commit (amended). security-auditor clean ("ship it") — strictly tightens; no fixation/INV/admin/oracle regression.

## Open questions (→ gate)
- SPEC.1 §13 still says "indefinite server-side participant session" — both reviewers flagged; product spec (web/founder-owned) → separate doc-reconciliation task, not edited here.
- Optional: an AGENTS.md auth gotcha line for the Better-Auth `expiresIn`→cookie-`maxAge` 400-day cap (mirrors the FIX-AUTH-SIGNUP additionalFields gotcha) — surfaced for web to ratify, not added unilaterally. The behavior is documented in-place (code comment + SPEC.2 §8.2 + ADR-0004 P1).
- Orphan `sessions` rows on staging (insert precedes the cookie throw): couldn't count cheaply (no staging DB creds). Cleanup not required.

## Next session starts at (exact next action)
Gate: web + operator review PR #150. On approval → merge → deploy to staging → operator retries returning-user Google sign-in (fresh Incognito) as acceptance.

## Verification (all green)
- New test RED→GREEN; `@code-reviewer` (HIGH/MEDIUM fixed in-commit) + `@security-auditor` (clean, all 5 mandatory checks).
- `ZUGZWANG_ENV=preview just verify` → All checks passed; full `pnpm vitest run` → 967 passed / 0 failed (135 files).

## Context to preserve
- The fix is config-only (no schema change → no db-migration-reviewer). `sessions.expires_at` is real (NOT NULL); better-auth `getSession` enforces `expiresAt < now` — the old SPEC "no time math" claim was always wrong, now corrected.
- Admin auth (`admin_sessions`, `zugzwang_admin_session`) is separate and unaffected by `session.expiresIn`.

## Time
2026-06-20.
