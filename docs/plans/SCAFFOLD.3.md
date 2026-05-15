# SCAFFOLD.3 — Auth wiring

> **Status:** approved — plan-review pass 2026-05-15, all 8 plan-review revisions absorbed; green-light to execute Phase 2
> **Date:** 2026-05-15
> **Author:** Hrishikesh + Claude Code (Phase 1 tab, Opus 4.7 1M)
> **Critical-path?** yes — touches `src/server/auth/`, `src/server/identity-pool/`, `src/db/schema/auth.ts` (drift fix); same-commit migration in `drizzle/migrations/`. Pre-PR self-audit per CLAUDE.md §5.10 + reviewer-call invocation per §5.11.
> **Plan PR / commit:** this file's first commit on branch `feat/scaffold-3`; Phase 1 close per CLAUDE.md §5.1.

---

## Tracker context

Canonical task row from `zugzwang_experiment_tracker_v8.html` SCAFFOLD.3 — auth wiring. **Six flows + session-deferral hook + admin two-layer middleware + ~200-row dev-seed. 3d est. P0 critical path.** Predecessor: SCAFFOLD.4 (`docs/logs/SCAFFOLD.4.md`, `main` at `825e18b`).

**Dep status at plan time:**

| Dep | State | Notes |
|---|---|---|
| SCAFFOLD.1 | Closed | Tailwind v4 + shadcn/ui + Turbopack plumbing landed (`e9e1378`) |
| SCAFFOLD.2 (+ strata 2-3A/B/C/D) | Closed | All six auth tables minted: `users`, `sessions`, `accounts`, `verifications`, `admin_sessions`, `identity_pool` |
| SCAFFOLD.4 | Closed | Upstash substrate live: `checkRateLimit`, `idempotencyLookupOrReserve`, `computeBodyFingerprint`; 7 Ratelimit instances pre-declared (3 used here: `otpRequestPerEmail`, `otpRequestPerIpBurst`, `adminLoginPerIp`) |
| SCAFFOLD.14 | Closed | All 9 auth vendor env keys wired to `.env.example` + Vercel Production/Preview |
| SCAFFOLD.15 (R2) | **Not landed** | Carry-forward; PFP rendering uses `/public/pfp-placeholder.svg` placeholder until R2 lands. See Q2 below. |

**Ghost references** (kickoff named these as sources of truth but they do not exist as files in repo; substance is in SPEC.1 §13 + SPEC.2 §8 per SCAFFOLD.2-3C absorption precedent):
- `docs/adr/0004-better-auth.md` → SPEC.2 §8.2
- `docs/adr/0010-admin-auth.md` → SPEC.2 §8.4 + SPEC.1 §13 F-AUTH-ADMIN
- `docs/adr/0011-identity-pool.md` → SPEC.1 §13 F-AUTH-3 + SPEC.2 §13
- `docs/adr/0016-id-schema-uuidv7.md` → SPEC.2 §8.2 line 820 + §8.9
- `docs/specs/PSEUDONYM.md` → SPEC.1 §13 F-AUTH-3 lines 629–675

Only `docs/adr/0001-license-choice.md` exists in `docs/adr/`. References in code and plan use SPEC.1 + SPEC.2 line numbers, not ghost ADR ids.

## Approach (one paragraph)

Stand up Better Auth 1.6.x against the already-minted Drizzle schema with four binding hooks: (a) Cloudflare Turnstile siteverify as a `hooks.before` on the email-OTP send path (fail-CLOSED, runs outside any DB transaction per CLAUDE.md §3 "HTTP inside a DB transaction" rule), (b) a `databaseHooks.user.create.before` that consumes a `(colour, animal, number, pfp_filename)` tuple from `identity_pool` via `SELECT … FOR UPDATE SKIP LOCKED` + `UPDATE assigned_at = now()` in Better Auth's user-row transaction, injecting `pseudonym` + `pfp_filename` into the user data so the `NOT NULL` schema columns are satisfied atomically, (c) the verbatim `databaseHooks.session.create.before` from SPEC.2 §8.3 that gates session-row issuance on `pseudonym` + `tos_accepted_at` and emits a signed `onboarding_ref` cookie on throw so the ToS gate page can identify the pre-session user, and (d) `advanced.database.generateId: () => uuidv7()` for ID-override across all four Better Auth tables. Hand-roll the admin path (`/admin/login` Server Action with `crypto.timingSafeEqual` + transactional `DELETE+INSERT` against `admin_sessions` + identical-401 timing parity; **no Turnstile per SPEC.1 line 609 + same-commit SPEC.2 §8.4 amendment**) and the two-layer middleware (Layer 1 `proxy.ts` redirect UX; Layer 2 `validateAdminSession()` at every admin handler entry, per CVE-2025-29927). Ship a same-commit drizzle migration converting `users_email_idx` from `index()` to `uniqueIndex()` to close the Better Auth concurrency-signup surface. Tests-first per CLAUDE.md §5.6 via test-writer reviewer call; `vi.hoisted` + `vi.mock` substrate-mock pattern copied from SCAFFOLD.4's `tests/integration/idempotency-cache.integration.test.ts`.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | No (indirectly upstream — session-deferral hook forecloses pre-pseudonym writes; bet wrapper is ENGINE.7) | n/a in this task | n/a |
| INV-2 Dharma non-transferable / no overdraft | No | n/a in this task | n/a |
| INV-3 Comments side-bound at post-time | **Yes (construction-layer protection per SPEC.2 §14 row 3 clause (i))** — `databaseHooks.session.create.before` prevents a participant cookie issuing before `pseudonym IS NOT NULL AND tos_accepted_at IS NOT NULL`, foreclosing any pre-pseudonym comment write that could lack a side anchor | `tests/server/auth/session-gate.test.ts::session-blocked-when-pseudonym-null`, `tests/server/auth/session-gate.test.ts::session-blocked-when-tos-null`, `tests/server/auth/session-gate.test.ts::session-issued-when-both-present` |
| INV-4 Resolutions append-only | No (admin path is parallel construction per SPEC.2 §14 row 4 clause (iv); resolution mechanics are RESOLVE.*) | n/a in this task | n/a |

**Critical-path failure mode for INV-3:** if `tests/server/auth/session-gate.test.ts` is omitted or asserts the wrong arm, a refactor that drops the `databaseHooks.session.create.before` callback would let a session cookie issue before `users.pseudonym` is set, and the next Server Action could write a `comments` row whose `side_at_post_time` references a missing or NULL `positions.side` — corrupting INV-3 silently. The hook is the construction-layer mechanism named in SPEC.2 §14.

---

## 2. Data model changes

**Schema deltas — two attribute changes (Q5 drift + step-3 reviewer SURPRISE absorption):**

1. `src/db/schema/auth.ts` line ~65: convert `users_email_idx` from `index(...)` to `uniqueIndex(...)`. Drift surfaced in plan; absorbed in same stratum per CLAUDE.md §7 cleanup-absorption rule (<2h, single-line schema change + migration).

   ```diff
   - index("users_email_idx").on(table.email),
   + uniqueIndex("users_email_idx").on(table.email),
   ```

2. `src/db/schema/auth.ts` line ~79: tighten `sessions.expiresAt` from nullable to `NOT NULL`. Step-3 db-migration-reviewer SURPRISE — Better Auth 1.6.11's `internalAdapter.createSession` always populates `expires_at` with a Date; the prior nullable was unnecessarily permissive and rested on a comment that misreads `disableSessionRefresh` (that option suppresses the *sliding-window UPDATE*, not the INSERT). Same-commit absorbed per §7.

   ```diff
   - expiresAt: timestamp("expires_at", { withTimezone: true }),
   + expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
   ```

**Migration — one new file:** `drizzle/migrations/0005_auth_schema_corrections.sql` (renamed from the original `_users_email_unique.sql` to reflect the two-purpose scope; generated by `pnpm drizzle-kit generate`). Effect: (a) drop + recreate `users_email_idx` as UNIQUE; (b) `ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL` (safe on the pre-launch empty table). Reversible (recreate as non-unique; drop NOT NULL). Triggers a `db-migration-reviewer` reviewer call per §5.11.

**Data seed — one new file (NOT a migration):** `scripts/seed-identity-pool-dev.ts` — one-shot `pnpm tsx` script (idempotent via `ON CONFLICT (colour, animal, number) DO NOTHING`). Inserts ~200 deterministic `identity_pool` rows for local dev. Exposed as `pnpm seed:identity-pool:dev`. Not run in CI; documented in `justfile` if a `just db:seed-pool` target is convenient. Tuple values are PascalCase colours (e.g. `Red`, `Blue`, `Amber` — 20 entries), PascalCase animals (`Fox`, `Wolf`, `Otter`, …— 10 entries), numbers 0–999 selected to yield exactly ~200 tuples (e.g. 20×10×1 number per pair). `pfp_filename` slug deterministic: `${colour.toLowerCase()}-${animal.toLowerCase()}-${String(number).padStart(3, '0')}.webp`. The dev placeholder image at `/public/pfp-placeholder.svg` is rendered until SCAFFOLD.15's R2 URL builder ships.

**No Drizzle schema changes for Better Auth tables** — `users`, `sessions`, `accounts`, `verifications`, `admin_sessions` already match Better Auth 1.6.x core shape per SCAFFOLD.2-3 strata. UUIDv7 column defaults already wired (`default(sql\`uuidv7()\`)`); Better Auth library-side ID-override is a runtime config option (no schema impact).

---

## 3. API surface

| Endpoint / Server Action | Method + path | Request shape | Response shape | Auth | Rate-limit class |
|---|---|---|---|---|---|
| Better Auth catch-all handlers | `ALL /api/auth/[...all]` | Better Auth internal contract: Google OAuth callback, `/email-otp/send-verification-otp`, `/email-otp/verify-email`, `/sign-out`, etc. | Better Auth internal envelope | public | Turnstile siteverify + `otpRequestPerEmail(email)` + `otpRequestPerIpBurst(ip)` invoked from `hooks.before` **matched ONLY to `/email-otp/send-verification-otp`** (per plan-review feedback §5 failure-mode #2 — Google callback path explicitly excluded from the matcher, so a Cloudflare outage cannot take both auth paths down) |
| Participant logout Server Action | `signOutAction()` in `src/server/auth/logout.ts`; invoked from header `<form action={signOutAction}>` | empty FormData | `redirect('/')` after `auth.api.signOut({ headers })` | participant cookie required | none |
| Admin login Server Action | `adminLoginAction(formData)` in `src/server/auth/admin/login.ts`; invoked from `/admin/login` `<form>` | zod-validated `{ password: z.string().min(1).max(256) }` (no turnstile token — see Q1) | success: `redirect('/admin')` with `zugzwang_admin_session` cookie set; failure: `{ ok: false, code: 'admin_login_invalid' }` (identical-401 for wrong-password OR rate-limit-exceeded). **Password compare uses HMAC-SHA256 digest comparison** (see §4 step 6) so `crypto.timingSafeEqual` never throws on length mismatch. | public | `adminLoginPerIp(ip)` — placeholder 10/h (HARDEN.6) |
| Admin logout Server Action | `adminLogoutAction()` in `src/server/auth/admin/logout.ts` | empty FormData | `redirect('/admin/login')` after `DELETE FROM admin_sessions WHERE session_id = $1` + cookie clear | admin cookie required | none |
| ToS acceptance Server Action | `acceptTosAction(formData)` in `src/server/auth/tos-accept.ts` | zod-validated `{ accepted: z.literal(true) }`; userId read from signed `onboarding_ref` cookie | success: `redirect('/')` after `users` UPDATE + re-trigger session creation (cookie now issues since session-deferral hook passes); failure: `{ ok: false, code: 'tos_acceptance_required' }` | signed `onboarding_ref` cookie required | `writeBurstPerUser` (placeholder) |
| Onboarding RSC page | `GET /(auth)/onboarding` (page.tsx) | URL only; `onboarding_ref` cookie read server-side | RSC (pseudonym + PFP + ToS + Privacy + checkbox + Continue/Cancel) | signed `onboarding_ref` cookie required (else redirect `/(auth)/sign-in`) | none (read) |
| Sign-in landing RSC page | `GET /(auth)/sign-in` | URL only | RSC (Google button + Email OTP form) | public | none |
| OTP code entry RSC page | `GET /(auth)/sign-in/otp` | URL only (email carried via signed `otp_session_ref` cookie set by send-OTP success) | RSC (6-digit code input + email display + Resend button) | signed `otp_session_ref` cookie required | none |
| Admin login RSC page | `GET /admin/login` | URL only | RSC (single password field + Continue button) | public | none |

**Single source-of-truth file map** (per SPEC.2 §8.10 — fully honored):

| Concern | File |
|---|---|
| Better Auth instance + plugins + databaseHooks + cookie config + UUIDv7 generateId override | `src/server/auth/index.ts` |
| Resend `sendVerificationOTP` callback body | `src/server/auth/email-otp.ts` |
| Session-deferral hook factory | `src/server/auth/session-gate.ts` (re-exported into `index.ts`) |
| Better Auth catch-all route handlers | `src/app/api/auth/[...all]/route.ts` |
| Better Auth + plugin version pins | `package.json` |
| Drizzle schema (already exists; drift fix to email index) | `src/db/schema/auth.ts` |
| Admin login Server Action | `src/server/auth/admin/login.ts` |
| Admin logout Server Action | `src/server/auth/admin/logout.ts` |
| Admin validator (Layer 2 boundary) | `src/server/auth/admin/validate.ts` |
| Participant logout Server Action | `src/server/auth/logout.ts` |
| Edge middleware (Layer 1 redirect UX) | `proxy.ts` (repo root; Next.js 16.2.4 supports both `proxy.ts` + `middleware.ts` per `node_modules/next/dist/lib/constants.js`; spec mandates `proxy.ts`) |

**Files outside the §8.10 map (justified additions):**
- `src/server/auth/tos-accept.ts` — ToS Server Action; not in §8.10 because §8.10 names the auth-domain primitives but doesn't enumerate every flow Server Action. Lives under `src/server/auth/` per AGENTS.md domain-scoping.
- `src/server/auth/onboarding-ref.ts` — signed pre-session cookie helpers (`signOnboardingRef`, `verifyOnboardingRef`) using `BETTER_AUTH_SECRET` via `node:crypto` HMAC-SHA256. Cookie attributes: `HttpOnly`, `Secure`, **`Path=/onboarding`** (narrowed from `/` per plan-review feedback; route group `(auth)` does not appear in the URL — actual URL is `/onboarding`; cookie only needs to be sent to the onboarding GET + the `acceptTosAction` POST which both route to `/onboarding`), `SameSite=Lax`, `Max-Age=600` (10 min TTL).
- `src/server/identity-pool/consume.ts` — `consumeIdentityPoolTuple(tx: DbTransaction): Promise<{ pseudonym, pfpFilename } | null>` invoked from `databaseHooks.user.create.before`. Returns null on exhaustion → hook throws `APIError("SERVICE_UNAVAILABLE", "identity_pool_exhausted")` → Better Auth rolls back → catch-all returns HTTP 503.
- `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/otp/page.tsx`, `src/app/(auth)/onboarding/page.tsx`, `src/app/(admin)/admin/login/page.tsx` — UI pages.
- `scripts/seed-identity-pool-dev.ts` — dev-seed script.
- `tests/server/auth/{google,otp,pseudonym,tos,session-gate,admin-login,logout}.test.ts` — flow tests.
- `tests/server/identity/no-raw-uuid-in-urls.test.ts` — placeholder `it.todo` per Q8 deferral; SPEC.2 §8.10 names this file but its assertion is meaningful only when participant resource routes exist.

---

## 4. UI / user flow

**Page inventory:**

- `src/app/(auth)/sign-in/page.tsx` — Server Component. Two CTAs: (1) "Sign in with Google" — POSTs to `/api/auth/sign-in/social` with `provider: 'google'` body; (2) "Email + OTP" — `<form action="/api/auth/email-otp/send-verification-otp" method="post">` with email input + `<NEXT_PUBLIC_TURNSTILE_SITE_KEY>` Turnstile widget mounted client-side. Layout is placeholder; DESIGN.1 mints brand; DESIGN.7 back-applies typography.
- `src/app/(auth)/sign-in/otp/page.tsx` — second-stage form. 6-digit code input + email hidden field (carried via signed `otp_session_ref` cookie set by send-OTP success path). POSTs to `/api/auth/email-otp/verify-email`.
- `src/app/(auth)/onboarding/page.tsx` — **single inline-scrollable screen per SPEC.1 §13 F-AUTH-4 lines 682–688**, structured top-to-bottom:
  1. Pseudonym + PFP block labelled "permanent" (PFP renders `/public/pfp-placeholder.svg` until SCAFFOLD.15)
  2. Emphasised re-id warning callout block, separate from and visually preceding ToS body, carrying SPEC.1 line 684 verbatim text: *"Your pseudonym is public and your activity is recorded as a permanent record. Distinctive patterns in your writing or betting may allow others to re-identify you across platforms. If anonymity from de-anonymisation analysis matters to you, do not use this product."*
  3. Full Terms of Service text in a scrollable in-page region (lorem ipsum placeholder; HARDEN.7 swaps real text)
  4. Full Privacy Policy text in a second scrollable in-page region (lorem ipsum placeholder)
  5. Single combined acceptance checkbox covering both
  6. Continue (`<button formAction={acceptTosAction}>`) + Cancel (`<Link href="/">`). Continue disabled-until-checked client-side; server-side check on action entry rejects unchecked submit with `tos_acceptance_required`.
  7. Footer text: "ToS v1.0 · `<hash>`" rendering `TOS_VERSION_HASH` constant
- `src/app/(admin)/admin/login/page.tsx` — single password field + Continue button. **No Turnstile widget** (Q1: follow SPEC.1 line 609). `<meta name="robots" content="noindex,nofollow">`. Server-rendered.

**Transitions:**

1. Unauthenticated visitor → any participant route → `proxy.ts` checks for `zugzwang_session` cookie → if absent and route is protected, redirect to `/(auth)/sign-in`.
2. Click "Sign in with Google" → Google OAuth → Better Auth callback at `/api/auth/callback/google` → on success Better Auth opens DB transaction → if new user, `databaseHooks.user.create.before` fires → `consumeIdentityPoolTuple(tx)` returns a tuple → user row inserted with pseudonym + pfp_filename atomically → `databaseHooks.session.create.before` fires → reads `users.pseudonym` + `users.tos_accepted_at` → throws `APIError("FORBIDDEN", "ONBOARDING_REQUIRED")` because `tos_accepted_at IS NULL` → catch-all route's error path catches the APIError → emits signed `onboarding_ref` cookie (`HttpOnly`, `Secure`, **`Path=/onboarding`**, `SameSite=Lax`, 10-min TTL) carrying `{ userId, exp }` HMAC-signed with `BETTER_AUTH_SECRET` → returns 302 redirect to `/onboarding` (Next.js route groups `(auth)` are file-tree-only and do not appear in URLs).
3. On `/onboarding` (URL — route group `(auth)` is file-tree organisation, not URL), RSC reads `onboarding_ref` cookie via `cookies().get('onboarding_ref')` → verifies signature → fetches user's pseudonym + pfp_filename → renders the inline screen → user checks the box, clicks Continue → `acceptTosAction` (form's `formAction` posts back to `/onboarding`, so the cookie is sent) re-verifies the cookie → opens SERIALIZABLE transaction → `SELECT tos_accepted_at FROM users WHERE id = $userId FOR UPDATE` → if already set (tab-race per SPEC.1 line 703), commit no-op and proceed to session re-trigger → else `UPDATE users SET tos_accepted_at = now(), tos_version_hash = $1, privacy_version_hash = $2, tos_acceptance_ip = $3, tos_acceptance_user_agent = $4 WHERE id = $userId` → commit → call `auth.api.signInEmail` (or equivalent re-trigger path) → session-create hook now passes → cookie issues → clear `onboarding_ref` cookie (`Set-Cookie: onboarding_ref=; Max-Age=0; Path=/onboarding` matching the original Path attribute) → redirect to `/`. `// TODO(ENGINE.6): writeUserEvent('user.tos_accepted', ...)`.
4. Email-OTP flow: Turnstile widget loads invisibly → user submits → token + email POST to `/api/auth/email-otp/send-verification-otp` → Better Auth `hooks.before` runs siteverify → on fail return HTTP 400 `error_turnstile_failed`; on pass, run `checkRateLimit('otpRequestPerEmail', email)` + `checkRateLimit('otpRequestPerIpBurst', ip)` → on either deny, return 429 `error_otp_rate_limited`; on pass, Better Auth's email-OTP plugin generates the 6-digit code, inserts `verifications` row, calls `sendVerificationOTP` → Resend delivers (sandbox: only delivers to `zugzwangworld@proton.me` until SCAFFOLD.12) → user enters code on `/(auth)/sign-in/otp` → Better Auth validates → from here identical to step 2.5 onward.
5. Existing user signs in (user row exists): `databaseHooks.user.create.before` does NOT fire (only on insert). `databaseHooks.session.create.before` fires, finds `tos_accepted_at IS NOT NULL` → session issues. If user is a stale-unaccepted (tos_accepted_at NULL but row exists per Cancel-from-onboarding edge case), hook re-throws → re-routes back to onboarding with the same userId (no pool reconsumption per SPEC.1 line 702).
6. Admin signs in at `/admin/login` → enters password → `adminLoginAction(formData)` runs **4 steps (no Turnstile per Q1)**:
   1. `checkRateLimit('adminLoginPerIp', ipIdentifier(ip))` → on deny, return identical-401 `admin_login_invalid`
   2. **Length-safe timing-equal comparison via HMAC digests** (per plan-review feedback — `crypto.timingSafeEqual` throws on different-length buffers, which would surface a length-leak side channel):
      ```ts
      const key = process.env.BETTER_AUTH_SECRET; // any constant server-only secret
      const inputDigest    = crypto.createHmac('sha256', key).update(input.password).digest();
      const expectedDigest = crypto.createHmac('sha256', key).update(process.env.ADMIN_PASSWORD).digest();
      const match = crypto.timingSafeEqual(inputDigest, expectedDigest); // both 32 bytes, never throws
      ```
   3. On mismatch: dummy `SELECT 1 FROM admin_sessions LIMIT 1` + `await sleep(constantTimeMs)` (timing parity per SPEC.2 §8.4 step 3) → return identical-401
   4. On match: SERIALIZABLE transaction `DELETE FROM admin_sessions; INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES (uuidv7(), now(), now()) RETURNING session_id` → set `zugzwang_admin_session` cookie (HttpOnly, Secure, SameSite=Lax, Path=`/admin`, no Max-Age, host-only) → redirect to `/admin`
   - `// TODO(ENGINE.6): writeAdminEvent('admin.signed_in', ...)`
7. Participant logout → `signOutAction` → `auth.api.signOut({ headers })` (Better Auth deletes `sessions` row + clears `zugzwang_session` cookie) → redirect to `/`.
8. Admin logout → `adminLogoutAction` → reads cookie session_id → `DELETE FROM admin_sessions WHERE session_id = $1` → clears `zugzwang_admin_session` cookie → redirect to `/admin/login`.

---

## 5. Failure modes

| # | Failure | Posture | Detect | Recover |
|---|---|---|---|---|
| 1 | Better Auth library boot failure (config malformed, env missing) | Hard fail at module load → process won't start | `pnpm tsc --noEmit` + Vercel deploy log | Fix config; re-deploy |
| 2 | Cloudflare Turnstile siteverify down or 5xx | **Fail CLOSED** — `hooks.before` rejects `error_turnstile_unavailable` (HTTP 503); email-OTP send blocked. **Google path remains available — confirmed by scoping `hooks.before` matcher to `/email-otp/send-verification-otp` ONLY**; Google OAuth callback (`/api/auth/callback/google`) does NOT invoke Turnstile. Test assertion: `tests/server/auth/otp.test.ts::turnstile-hook-scope-excludes-google-callback` verifies via fetch-spy that no Cloudflare siteverify call fires on the Google path. | `console.error('turnstile_unavailable', err)` stub (SCAFFOLD.5 swaps for Sentry) | User retries; Cloudflare auto-recovers; Google sign-in remains usable through outage |
| 3 | Google OAuth callback with `email_verified !== true` | Reject `error_oauth_email_not_verified` per SPEC.2 §8.2 line 814; no user row, no session row | Better Auth error envelope | User verifies Google email or uses Email + OTP |
| 4 | Resend send failure | `sendVerificationOTP` throws → surface `error_otp_send_failed` HTTP 503; `verifications` row exists but no email reached user | `console.error('resend_send_failed', err)` stub | User retries (counts against `otpRequestPerEmail`); ops rotates `RESEND_API_KEY` if invalid; sandbox-mode caveat documented (`onboarding@resend.dev` only delivers to `zugzwangworld@proton.me` until SCAFFOLD.12) |
| 5 | `identity_pool` exhausted | `consumeIdentityPoolTuple` returns null → `user.create.before` throws `APIError("SERVICE_UNAVAILABLE", "identity_pool_exhausted")` → Better Auth rolls back user-row INSERT → catch-all surfaces HTTP 503 | `console.error('identity_pool_exhausted')` stub | Dev: re-run `pnpm seed:identity-pool:dev`. Prod (operational, post-launch): asset pipeline mints more tuples + admin seeds. User retries. |
| 6 | Concurrent signup race on same email | Postgres `users_email_idx` UNIQUE (post drift-fix migration) rejects the loser at INSERT → Better Auth's adapter maps to existing-user-match flow | Postgres constraint violation surfaces as Better Auth `user_already_exists` (or similar) | Loser is routed to existing-user-match path; no double pool consumption |
| 7 | `identity_pool` double-assignment under concurrent tx | `SELECT … FOR UPDATE SKIP LOCKED` + immediate `UPDATE assigned_at = now()` guarantees each tuple is taken by exactly one transaction. Bucket B trigger on `identity_pool.assigned_at` enforces NULL→timestamp one-way at storage layer. | Test: `tests/server/auth/pseudonym.test.ts::pool-fifo-no-double-assignment-under-concurrency` | n/a (prevented by construction) |
| 8 | Hook transaction rollback semantics (the "stranded tuple" scenario) | **Open per Q6 below** — verified at Phase 2 step 2 once Better Auth source is readable in node_modules. Plan-time assumption: Better Auth wraps `user.create.before` + user INSERT + `session.create.before` + session INSERT in one Postgres transaction; a session-create throw rolls the user row back AND restores the `identity_pool.assigned_at` NULL. If false, a stale tuple remains assigned to a user row that never got a session — Cancel-from-onboarding edge case is the operational instance. Stale-30d sweep is the recovery path; HARDEN-era. | Phase 2 step 2 reads library source + asserts the actual semantics; test in `pseudonym.test.ts` covers the assumed semantics, gets adjusted if Q6 lands on two-transaction. | **Locked: accept stale-30d sweep recovery per SPEC.1 line 704** (Q6 fallback). NO release-sweep written in SCAFFOLD.3 — operational instance (Cancel-from-onboarding) already bounded; release-sweep is HARDEN-era if needed. |
| 9 | CVE-2025-29927 middleware bypass | Layer 2 validator is the security boundary; Layer 1 `proxy.ts` is UX only | `tests/server/auth/admin-login.test.ts::layer2-validator-called-on-bypassed-middleware` (mocked) + `code-reviewer` reviewer call checks every admin handler entry | n/a (prevented by validator pattern) |
| 10 | `ADMIN_PASSWORD` env var missing | Module load detection + identical-401 on all admin login attempts | Vercel deploy preview catches missing var | Ops fills via Vercel UI |
| 11 | ToS Server Action tab-race | `SELECT … FOR UPDATE` on `users` row makes the second call see `tos_accepted_at IS NOT NULL`, take no-op branch | Test: `tests/server/auth/tos.test.ts::tab-race-idempotent-acceptance` | n/a (idempotent by construction) |
| 12 | `onboarding_ref` cookie expired (>10min) | `verifyOnboardingRef` returns null → redirect to `/(auth)/sign-in` → user signs in again, hook fires fresh, new cookie issues | Test: `tests/server/auth/tos.test.ts::onboarding-ref-expired-redirects-to-signin` | User signs in again |
| 13 | `onboarding_ref` cookie signature invalid (tampering) | HMAC verify fails → 401 → redirect to `/(auth)/sign-in` | Test: `tests/server/auth/tos.test.ts::onboarding-ref-tampered-redirected` | User signs in again |

---

## 6. Edge cases

- **Tab race on ToS acceptance** — two tabs of `/(auth)/onboarding` for same user. Both click Continue. SERIALIZABLE + `SELECT FOR UPDATE` on `users` row makes the second call see `tos_accepted_at IS NOT NULL`, take no-op branch, proceed to session-issue. Per SPEC.1 line 703.
- **Cancel from onboarding** — user clicks Cancel on `/(auth)/onboarding`. The F-AUTH-3 user row remains with `tos_accepted_at IS NULL`. The `(colour, animal, number)` tuple stays consumed (not returned to pool). `onboarding_ref` cookie cleared. On next sign-in, hook routes back to onboarding with the same userId (no second pool consumption). Per SPEC.1 line 701.
- **User signs up multiple times before accepting ToS** — each attempt finds existing row (by Google account ID or email), `user.create.before` does NOT fire, no second pool consumption. Per SPEC.1 line 702.
- **OTP code expired** — `verifications.expires_at < now()` → Better Auth's email-OTP plugin rejects with `otp_expired`. TTL is plugin default (HARDEN.6-deferred per SPEC.2 §8.2).
- **OTP code already consumed** — plugin-enforced single-use → second submission returns `otp_invalid` or `otp_already_used`.
- **Google `email_verified === false`** — per ADR-0004 §1 (cited at SPEC.2 §8.2 line 814), reject with `error_oauth_email_not_verified` before any user row writes.
- **Rate-limit fail-OPEN on Upstash outage during OTP send** — OTP send goes through (SCAFFOLD.4 posture); Turnstile still gates; abuse-cap gap accepted per SPEC.2 §11 / ADR-0006 (referenced via SCAFFOLD.4 substrate).
- **Admin login concurrent with another admin tab** — SERIALIZABLE `DELETE FROM admin_sessions; INSERT ...` → new login revokes prior session. Prior tab's next admin call sees absent admin_sessions row → 401 → redirect to `/admin/login`. Per SPEC.1 line 736.
- **Admin login wrong password** — identical-401 timing parity: mismatch branch runs `SELECT 1 FROM admin_sessions LIMIT 1` + constant-time delay before returning. Per SPEC.2 §8.4 step 3.
- **Admin login rate-limit exceeded** — same identical-401 envelope (`admin_login_invalid`). Per SPEC.2 §8.4.
- **Pseudonym injection attempt** — pseudonyms come only from pre-seeded `identity_pool` rows; user input never influences pseudonym. PascalCase + 3-digit zero-padded per SPEC.1 line 629.
- **`pfp_filename` references missing image** — SCAFFOLD.15 not landed; UI renders `/public/pfp-placeholder.svg`. SCAFFOLD.15 wires R2 URL builder when it lands.
- **Better Auth's UPDATE on `users.name`/`email`/etc. colliding with our ToS UPDATE** — `users` is Bucket C (mutable per SCAFFOLD.2). `tos_accepted_at` is not append-only at the DB layer. SERIALIZABLE isolation on ToS transaction prevents lost updates.
- **Pre-session `onboarding_ref` cookie expired between page load and acceptTosAction click** — re-verify on action entry; if expired, return `redirect('/(auth)/sign-in')` with a flash-style hint. Cookie TTL is 10 min; ToS pages don't carry long-running state.

---

## 7. Test plan

| Layer | Scenarios | Invariants asserted |
|---|---|---|
| Unit (Vitest, `tests/server/auth/*.test.ts`) — mock-heavy substrate per SCAFFOLD.4 pattern (`vi.hoisted` for mocks, `vi.mock` for module patches, `vi.clearAllMocks` not `restoreAllMocks` per the spy-attached caveat from `idempotency-cache.integration.test.ts:80–85`) | `google.test.ts`: callback with `email_verified=true` issues `user.create.before` + `session.create.before` paths; callback with `email_verified=false` rejects `oauth_email_not_verified`; existing-user-match skips pool consumption; new user runs `user.create.before` once. | n/a |
| | `otp.test.ts`: send-verification-otp gated by Turnstile (mocked siteverify pass/fail); send rate-limited by `otpRequestPerEmail` + `otpRequestPerIpBurst` (mocked `checkRateLimit`); verify with valid code single-use semantics; verify with expired code rejected; `sendVerificationOTP` Resend mock called with email + code. | n/a |
| | `pseudonym.test.ts`: FIFO selection — oldest unassigned tuple taken (assert via `created_at` ordering); SELECT FOR UPDATE SKIP LOCKED prevents double-assignment under concurrency (two parallel transactions get different tuples); 503 on exhaustion (`consumeIdentityPoolTuple` returns null). | **INV-3 construction-layer (indirect)** |
| | `tos.test.ts`: warning text matches SPEC.1 line 684 verbatim (string assertion); checkbox required (server-side); 5-column acceptance evidence recorded in single transaction; cancel leaves `tos_accepted_at NULL`; reentry routes back without pool reconsumption; tab-race idempotent; stale-30d sweep marked `it.todo` (HARDEN-deferred); `onboarding_ref` cookie expired → redirect; cookie tampered → 401 + redirect. | n/a |
| | `session-gate.test.ts`: session-create blocked when pseudonym NULL; blocked when `tos_accepted_at` NULL; issued when both present; APIError shape matches SPEC.2 §8.3 verbatim (`FORBIDDEN` code, `ONBOARDING_REQUIRED` message); on throw, `onboarding_ref` cookie issued with `{ userId }` matching the failed session attempt. | **INV-3 construction-layer protection (DIRECT)** |
| | `admin-login.test.ts`: rate-limit returns identical-401 (`admin_login_invalid`); wrong password returns identical-401 with constant-time delay (assert via fake timers + fetch spy assertion that the timing branch ran the dummy DB read); right password issues cookie + replaces prior `admin_sessions` row in single SERIALIZABLE transaction; **no Turnstile fetch** (assert fetch spy was not called with any Cloudflare endpoint); cookie attributes `HttpOnly + Secure + SameSite=Lax + Path=/admin + no Max-Age` per SPEC.2 §8.5; **`admin-login.test.ts::password-shorter-than-env-does-not-throw`** asserts the HMAC-digest compare handles input shorter, equal, or longer than `ADMIN_PASSWORD` without throwing `RangeError`. | n/a |
| | `logout.test.ts`: participant logout invalidates `sessions` row + clears `zugzwang_session`; admin logout deletes `admin_sessions` row + clears `zugzwang_admin_session`; participant cookie does NOT reach admin handler; admin cookie does NOT reach participant handler (cross-validator rejection per SPEC.2 §8.7 pillar 6). | n/a |
| | `onboarding-ref.test.ts`: `signOnboardingRef` produces base64url HMAC-SHA256 with `BETTER_AUTH_SECRET`; `verifyOnboardingRef` accepts valid signature within TTL; rejects expired; rejects tampered. | n/a |
| Integration (Vitest + real Postgres, `tests/integration/auth-flows.integration.test.ts`) — only if SCAFFOLD.2's integration test infra at `tests/db/_fixtures/db.ts` is wired into a `--project=integration` Vitest config | End-to-end signup with real Drizzle + Postgres: assert pool consumption commits with user row; assert append-only Bucket B trigger blocks any second UPDATE on `identity_pool.assigned_at`; admin login real DELETE+INSERT verifies singleton-by-construction. | INV-3 indirect |
| E2E (Playwright, `tests/e2e/`) | **Out of scope** — full-flow Playwright after DESIGN.* lands brand + components. SCAFFOLD.3 ships placeholder UI; E2E against placeholders is low-signal. | n/a |

**Critical-path coverage check:** INV-3 has direct assertions at `tests/server/auth/session-gate.test.ts`. No touched invariant lacks an assertion.

**Test-writer reviewer call (per CLAUDE.md §5.6 + §5.11):** First reviewer call at Phase 2 START, before any `src/server/auth/` code. Briefing tool scope: Read + Write tests only (no `src/` edits). Plan path: `@docs/plans/SCAFFOLD.3.md`. Coverage map returned with each test file's invariant assertion.

---

## 8. Out of scope

- **Events-row writes for auth flows** — `user.oauth_signed_in`, `user.otp_signed_in`, `user.pseudonym_assigned`, `user.tos_accepted`, `user.signed_out`, `admin.signed_in` per SPEC.2 §8.8. Deferred to **ENGINE.6** (events helper `src/server/events/insert.ts`). SCAFFOLD.3 stubs every call site with `// TODO(ENGINE.6): writeUserEvent(...)`; tests assert event-row counts via `it.todo` placeholders. **Resolved via Q7.**
- **Real ToS / Privacy legal text** — placeholder lorem ipsum + placeholder `TOS_VERSION_HASH = 'placeholder-tos-v0'` / `PRIVACY_VERSION_HASH = 'placeholder-privacy-v0'` constants. HARDEN.7 swaps real text + computes real hashes after legal review.
- **50K production identity_pool seed** — asset pipeline at SPEC.1 §13 lines 643–651 runs pre-launch (out-of-repo Hrishikesh DGX Spark + ComfyUI + Flux.1 12B FP4 + Pillow number compositing). SCAFFOLD.3 ships **~200-row dev seed** at `scripts/seed-identity-pool-dev.ts`.
- **R2 PFP image hosting** — SCAFFOLD.15 owns R2 buckets + signed URL endpoint + CDN. SCAFFOLD.3 renders `/public/pfp-placeholder.svg` placeholder.
- **30-day stale-unaccepted-user sweep** — operational daily job; HARDEN-era per SPEC.1 line 704.
- **OTP TTL numeric tuning** — Better Auth plugin default; HARDEN.6 tunes per SPEC.2 §8.2.
- **Real Sentry alarm 6a/6b emission** — SCAFFOLD.5 swaps `console.error` for `Sentry.captureException`. Stub tag strings already byte-exact per SCAFFOLD.4 convention.
- **`tests/server/identity/no-raw-uuid-in-urls.test.ts` active assertion** — placeholder `it.todo` for now; meaningful only once participant resource routes (`/profile/:pseudonym`, `/u/:pseudonym`, etc.) exist. **Q8 resolved.**
- **Custom Resend FROM domain** — SCAFFOLD.12 unlocks `noreply@zugzwangworld.com`. Until then, sandbox `onboarding@resend.dev` only delivers to `zugzwangworld@proton.me`. Documented in `.env.example` comment + plan.
- **Mid-experiment ToS/Privacy revision flow (`tos_version_changed` 410)** — operationally deferred per SPEC.1 line 698; v1 assumes single ToS version.
- **Account ban semantics (`users.banned_at IS NOT NULL` enforcement at handler entry)** — bridges to F-MOD-1 (Track A automatic ban) and F-ADMIN-4 (Track B manual ban); SCAFFOLD.3 leaves the column unindexed for ban-state queries (already indexed per `users_banned_at_idx` partial WHERE NOT NULL). The actual ban-enforcement check rides on the validator path that SCAFFOLD.3 establishes; the validator itself only checks session existence in v1.
- **`pillar 7 / inline admin affordances` end-to-end test** — meaningful only when a public page renders an admin affordance (e.g., "Resolve" button on market detail). Plan-time placeholder; out of scope for SCAFFOLD.3.

---

## Open questions

- **Q1: SPEC conflict on admin Turnstile.** *Resolved.* SPEC.1 §13 line 609 wins ("No CAPTCHA on F-AUTH-ADMIN"). Plan absorbs a **same-commit SPEC.2 §8.4 amendment**: drop step 1 (Turnstile siteverify), renumber 2–5 → 1–4. Per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` + identical-401 + transactional replace + indefinite cookie remain sufficient brute-force protection for a single-user admin path.

- **Q2: PFP rendering before SCAFFOLD.15.** *Resolved.* `/public/pfp-placeholder.svg` rendered by every component until SCAFFOLD.15 wires R2 URL builder. UI components accept `pfp_filename` prop but the `<img src={...}>` stub'd to the placeholder.

- **Q3: Pre-session userId routing.** *Resolved.* Signed `onboarding_ref` cookie (Candidate A). HttpOnly, Secure, **Path=`/onboarding`** (narrowed per plan-review feedback — the route group `(auth)` is not in the URL, so the actual URL is `/onboarding`; this is the only path that reads the cookie), SameSite=Lax, 10-min TTL, carrying `{ userId, exp }` HMAC-SHA256-signed with `BETTER_AUTH_SECRET`. Helpers at `src/server/auth/onboarding-ref.ts`. Issued in catch-all route's APIError-handler path; read by `onboarding/page.tsx` + `acceptTosAction`.

- **Q4: ToS placeholder content + hash values.** *Resolved.* Two constants in `src/server/auth/tos-versions.ts`: `TOS_VERSION_HASH = 'placeholder-tos-v0'`, `PRIVACY_VERSION_HASH = 'placeholder-privacy-v0'`; matching `tos.txt` + `privacy.txt` files at **`public/legal/{tos,privacy}.txt`** (path locked — statically served by Next.js public assets convention; no MD-to-HTML rendering in scope). HARDEN.7 may migrate to MDX under `content/` if structured rendering is needed at that time; SCAFFOLD.3 ships plain text. Lorem ipsum body; HARDEN.7 swaps real legal text + recomputes hashes.

- **Q5: Email uniqueness drift.** *Resolved.* Same-commit drizzle migration `drizzle/migrations/0005_users_email_unique.sql` converts `users_email_idx` from `index()` to `uniqueIndex()`. Triggers `db-migration-reviewer` reviewer call. Adds an item to §5.10 self-audit. Per CLAUDE.md §7 cleanup-absorption rule.

- **Q6: Better Auth two-hook transaction wrapping semantics.** **VERIFIED at Phase 2 step 2 + step-3 reviewer correction (Better Auth 1.6.11).** Findings:
  - **Email/password sign-up flow** at `node_modules/better-auth/dist/api/routes/sign-up.mjs:141` wraps the handler in `runWithTransaction`; user + session creation share ONE transaction. **But SCAFFOLD.3 doesn't use this flow.**
  - **OAuth flow (F-AUTH-1)** at `node_modules/better-auth/dist/oauth2/link-account.mjs:91-138` uses `createOAuthUser` which opens its own `runWithTransaction` covering user + account INSERT (see `internal-adapter.mjs:56-73`), but then calls `createSession` at line 125 **OUTSIDE** that transaction.
  - **Email-OTP flow (F-AUTH-2)** has the same shape: user creation in one tx, session creation in a separate tx.
  - **Consequence:** for the flows SCAFFOLD.3 actually wires, session-create is ALWAYS in a separate transaction from user-create. The stranded-tuple scenario isn't contingent on session-gate throw — it can ALWAYS arise on session-create failure.
  - Our pool consumption inside `databaseHooks.user.create.before` runs in yet ANOTHER `db.transaction` (Better Auth doesn't expose its tx handle to hooks; the hook signature is `(user, context: GenericEndpointContext)`).
  - **Stranded-tuple ROW LAYOUT after session-gate throw:** users row exists with `pseudonym` set + `tos_accepted_at NULL`; identity_pool tuple has `assigned_at` set. On user's next sign-in, F-AUTH-1/F-AUTH-2 finds the existing user by email/googleId (no new user.create), session-gate hook fires, sees `tos_accepted_at NULL`, throws → routes to onboarding. **No re-stranding.** The cumulative inventory of stranded tuples = sum of "Cancel-from-onboarding then never returned" users.
  - **Fallback locked (per plan-review feedback):** accept stale-30d sweep recovery per SPEC.1 line 704. NO tuple-release sweep in SCAFFOLD.3.
  - **Implementation note:** still set `transaction: true` in the drizzleAdapter config — Better Auth 1.6.11's own internal-adapter helpers (e.g., `createOAuthUser`) use `runWithTransaction`, and the adapter must expose the wrapper for those internals.

- **Q7: Events-row writes for auth flows.** *Resolved.* Defer to ENGINE.6. Stub call sites with `// TODO(ENGINE.6): writeUserEvent(...)`. Match SCAFFOLD.2 precedent.

- **Q8: `tests/server/identity/no-raw-uuid-in-urls.test.ts` scope.** *Resolved.* Placeholder `it.todo`. Meaningful only after participant resource routes exist; flagged in `tests/server/identity/no-raw-uuid-in-urls.test.ts` body for the future task.

- **Q9: `proxy.ts` vs `middleware.ts`.** *Resolved.* Next.js 16.2.4's `node_modules/next/dist/lib/constants.js` defines BOTH `MIDDLEWARE_FILENAME='middleware'` and `PROXY_FILENAME='proxy'` as valid filenames at repo root (with optional `src/` prefix). Use `proxy.ts` per SPEC.2 §8.10. No compatibility risk; both supported.

- **Q10: Better Auth `databaseHooks.user.create.before` data injection contract.** **VERIFIED at Phase 2 step 2.** `@better-auth/core/types/init-options.d.mts` declares the hook return as `Promise<boolean | void | { data: Optional<User> & Record<string, any> }>`. The `Record<string, any>` permits arbitrary additional fields in the returned `data`. The adapter's `create({ model, data: values })` at `@better-auth/drizzle-adapter/dist/index.mjs:257` passes `values` straight through to Drizzle, so injected `pseudonym` + `pfpFilename` will be written by the user-INSERT. **No fallback needed.** Pattern:
  ```ts
  before: async (user) => {
    const tuple = await consumeIdentityPoolTuple(db); // separate tx, see Q6 caveat
    if (!tuple) throw new APIError("SERVICE_UNAVAILABLE", { message: "identity_pool_exhausted" });
    // Use camelCase TS-identifier keys (pfpFilename, not pfp_filename) — Drizzle
    // adapter's checkMissingFields resolves via the TypeScript table-key, not
    // the SQL column alias; step-3 reviewer SURPRISE #2.
    return { data: { ...user, pseudonym: tuple.pseudonym, pfpFilename: tuple.pfpFilename } };
  }
  ```

- **Q11: Better Auth Drizzle adapter table-name mapping.** **VERIFIED at Phase 2 step 1.** Better Auth 1.6.11's `@better-auth/drizzle-adapter` exposes a `DrizzleAdapterConfig.usePlural: boolean` option (NOT a `tablesMap` — that hypothesis was wrong). Setting `usePlural: true` makes the adapter accept plural table names like `users`/`sessions`/`accounts`/`verifications`. See `@better-auth/drizzle-adapter/dist/index.d.mts:22`. **No schema rename, no migration, no per-table aliasing.** Config:
  ```ts
  betterAuth({
    database: drizzleAdapter(db, {
      schema,             // namespace import from '@/db/schema'
      provider: 'pg',
      usePlural: true,    // Q11 resolution
      transaction: true,  // Q6 — wraps user+session create in one tx
    }),
    // ...
  })
  ```
  Column-name snake_case is already handled at the schema declaration layer (`text("google_id")` etc.).

---

## ADRs needed

**None new in this stratum.** Substance for ADR-0004 (Better Auth) / ADR-0010 (admin path) / ADR-0011 (identity pool FIFO) / ADR-0016 (UUIDv7 + URL exposure) lives in SPEC.1 §13 + SPEC.2 §8 per the SCAFFOLD.2-3C absorption precedent; **no new ADRs needed**.

**Same-commit SPEC amendments** (per CLAUDE.md §7 cleanup-absorption rule, absorbed by this stratum, not deferred):
1. **SPEC.2 §8.4 amendment** — drop step 1 (Turnstile siteverify), renumber 2–5 → 1–4. Per Q1.
2. **SPEC.2 §8.5 cookie table amendment** — clarify `Path` for admin cookie is `/admin` (already present); confirm participant cookie `Path` is `/` (already present). No change expected; verify byte-identity during execute.

If a Phase-2 surprise (Q6 / Q10 / Q11 surprise on Better Auth semantics) forces an architectural variance, mint an ADR-at-the-time per CLAUDE.md §5.12. Otherwise, no ADRs.

---

## Self-critique (Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high | Q6 (two-hook transaction wrapping) is foundational to the INV-3 claim. If Better Auth uses two transactions, the "atomic pool + ToS rollback" property weakens to "atomic at the user-row scope" and stranded tuples become operational reality. | **Phase 2 step 2** reads `node_modules/better-auth/dist/` to verify; Q6 fallback locked to stale-30d sweep recovery (no release-sweep this stratum); plan §5 failure-mode #8 wording updated to reflect findings. |
| 2 | medium | Q10 (data injection in `user.create.before`) is the second foundational unknown. If Better Auth rejects injecting NOT NULL columns, the `pseudonym` NOT NULL schema is incompatible. Fallback: `additionalFields` config or hand-roll the user INSERT in the hook. | **Phase 2 step 2** verifies; fallback config landed in same plan-execute commit. |
| 3 | medium | Pre-session `onboarding_ref` cookie design lives outside SPEC.2 §8.10 file map. Slight surface-area expansion. | Justified inline §3; passes the "narrow exception, single-use" test. Files added: `onboarding-ref.ts`, `tos-accept.ts`. Surface kept tight. |
| 4 | medium | Plan defers 6 auth-events-row writes to ENGINE.6. SPEC.2 §8.8 names them as required for dataset export at §19 and audit search at F-ADMIN-5. Risk: ENGINE.6 may not land before launch. | Q7 ratified by user; ENGINE.6 is the right owner; risk is operational (track ENGINE.6 close before launch in tracker v8). Plan note: backfill is N/A (events are forward-looking flow audit). |
| 5 | low | Plan asserts identical-401 timing parity via `await sleep(constantTimeMs)` — fake-timer test discipline is fragile (jitter from event loop + Promise microtask scheduling). | Test uses `vi.useFakeTimers()` + asserts the dummy DB read was called; timing-parity is best-effort, brute-force protection is the rate-limit anyway. |
| 6 | low | `it.todo` placeholders for `no-raw-uuid-in-urls.test.ts` and `stale-30d-sweep` are flagged-but-deferred test files. CI counts these as zero coverage. | Acceptable; `it.todo` is a CI-visible signal that surfaces these in test runs. |
| 7 | low | Resend sandbox-mode caveat means F-AUTH-2 OTP is only end-to-end testable for `zugzwangworld@proton.me` until SCAFFOLD.12. SCAFFOLD.3 PR cannot validate F-AUTH-2 against arbitrary email addresses in dev. | Acceptable; documented in `.env.example` + plan §5 failure mode #4. Unit-level Resend mock proves the wiring; real-recipient testing post-SCAFFOLD.12. |
| 8 | medium | Plan does NOT enumerate the four Better Auth tables (`users`, `sessions`, `accounts`, `verifications`) for ID-override + name-mapping verification line-by-line. The §5.10 self-audit's "every column name, type, nullability; every FK + index; every enum value set; every bucket classification; every same-commit spec amendment" demands this. | Pre-PR self-audit walk (per §5.10) covers; plan §3 + §2 + the file map are sufficient for Phase 2 to write the audit checklist from. |
| 9 | high | The plan doesn't explicitly verify the SCAFFOLD.2 `users` schema columns against Better Auth 1.6.x's expected fields. The schema has `name`, `image`, `email_verified` as Better Auth core. Need to confirm at Phase 2 against the actual Better Auth 1.6.x adapter contract. | **Phase 2 step 3** is the dedicated schema cross-walk: `db-migration-reviewer` reviewer call walks `src/db/schema/auth.ts` against Better Auth 1.6.x adapter requirements. Any missing column absorbed into step 4's migration (single same-commit fix alongside the email-unique drift). |

---

## Implementation order (Phase 2 execute pipeline)

Strictly ordered; each step gates the next. **Reordered per plan-review feedback** so library-contract verification (Q6/Q10/Q11) and schema-vs-library cross-walk both precede test-writing — the test-writer cannot write tests for semantics that may not exist as described.

1. **`pnpm install better-auth@^1.6.0`** + Resend SDK (`resend`) + the email-OTP plugin if shipped as separate package. Pin exact versions in `package.json`. Verify **Q11**: Better Auth's Drizzle adapter `schema`/`tablesMap` config option (whatever the actual exported name is in 1.6.x); commit to mapping plural Drizzle table exports → singular Better Auth conventions at runtime. No schema rename.
2. **Verify Q6 + Q10 against library source.** Read `node_modules/better-auth/dist/` for: (a) whether `databaseHooks.user.create.before` + user INSERT + `databaseHooks.session.create.before` + session INSERT share ONE Postgres transaction (Q6 — the INV-3 atomic-rollback claim) and (b) whether `user.create.before` accepts injected NOT NULL columns in the return value (Q10 — the pseudonym + pfp_filename injection path). Document findings in plan §5 failure-mode #8 + §6 edge-case list. If Q10 hits the rejection branch: fallback to Better Auth's `additionalFields` config. If Q6 hits the two-transaction branch: per Q6 fallback-locked-above, accept stale-30d sweep recovery (no release-sweep this stratum).
3. **Schema cross-walk vs Better Auth 1.6.x core fields — db-migration-reviewer reviewer call (1 of 2).** Brief the reviewer to walk `src/db/schema/auth.ts` against Better Auth 1.6.x's expected `user`/`session`/`account`/`verification` column shapes — every name, nullability, default, FK. Surface any column the adapter requires that SCAFFOLD.2 didn't mint (or any present column the adapter would reject as unknown). Per CLAUDE.md self-critique #9 (high-severity). Findings absorbed into step 4's migration if missing-column, else marked PASS for the audit.
4. **Schema delta + migration.** Convert `users_email_idx` from `index()` to `uniqueIndex()` (Q5 drift fix). Absorb any missing column surfaced in step 3 into the same migration. Generate `drizzle/migrations/0005_users_email_unique.sql` (rename file if multi-purpose) via `pnpm drizzle-kit generate`. **db-migration-reviewer reviewer call (2 of 2)** — review the generated migration file: idempotency, reversibility, FK-index-coverage per AGENTS.md §6.
5. **Test-writer reviewer call** (per §5.6) — writes failing tests for every flow under `tests/server/auth/` against this plan's §7, NOW grounded on the Q6/Q10/Q11/step-3 findings. Tool scope: Read + Write tests only (no `src/` edits per `.claude/agents/test-writer.md`). Plan path: `@docs/plans/SCAFFOLD.3.md`. Returns: test files + coverage map + invariants asserted per test.
6. Write `src/server/auth/onboarding-ref.ts` — `signOnboardingRef`, `verifyOnboardingRef` (HMAC-SHA256 with `BETTER_AUTH_SECRET`). Cookie attributes per §3: `Path=/onboarding`, HttpOnly, Secure, SameSite=Lax, Max-Age=600.
7. Write `src/server/identity-pool/consume.ts` — `consumeIdentityPoolTuple(tx)`.
8. Write `src/server/auth/session-gate.ts` — session-deferral hook factory + onboarding-ref emit on throw.
9. Write `src/server/auth/email-otp.ts` — Resend `sendVerificationOTP` callback.
10. Write `src/server/auth/index.ts` — Better Auth instance + `socialProviders.google` (with `email_verified` enforcement) + Email-OTP plugin + `hooks.before` **scoped to `/email-otp/send-verification-otp` only** (Turnstile siteverify + rate-limit; Google callback path is NOT matched per §5 failure-mode #2) + `databaseHooks.user.create.before` + `databaseHooks.session.create.before` + cookie config (indefinite, host-only) + `advanced.database.generateId: () => uuidv7()` + Drizzle adapter `schema`/`tablesMap` plural→singular alias per Q11.
11. Write `src/app/api/auth/[...all]/route.ts` — Better Auth catch-all mount + the APIError-handler path that emits the signed `onboarding_ref` cookie on `ONBOARDING_REQUIRED`.
12. Write `src/server/auth/admin/validate.ts` — Layer 2 validator.
13. Write `src/server/auth/admin/login.ts` — 4-step admin Server Action (no Turnstile per Q1; **HMAC-SHA256 digest comparison** for length-safe `timingSafeEqual` per §4 step 6).
14. Write `src/server/auth/admin/logout.ts`.
15. Write `src/server/auth/logout.ts` — participant logout.
16. Write `src/server/auth/tos-accept.ts` — ToS Server Action.
17. Write `proxy.ts` at repo root — Layer 1 redirect UX.
18. Write `src/server/auth/tos-versions.ts` + `public/legal/{tos,privacy}.txt` (path locked per Q4).
19. Write UI pages: `(auth)/sign-in/page.tsx`, `(auth)/sign-in/otp/page.tsx`, `(auth)/onboarding/page.tsx`, `(admin)/admin/login/page.tsx`.
20. Write `scripts/seed-identity-pool-dev.ts` + add `pnpm seed:identity-pool:dev` script.
21. Add `/public/pfp-placeholder.svg`.
22. Run failing tests → they pass. `pnpm vitest run tests/server/auth/`.
23. `just check` (typecheck + lint + tests + build).
24. **Pre-PR self-audit** per CLAUDE.md §5.10 — walk this plan's §3 + §4 + §5 + §7 + Implementation order, PASS/FAIL/SURPRISE for each item. Fix FAILs in-session; surface SURPRISEs.
25. **code-reviewer reviewer call** (per §5.11) — `src/server/` changes review.
26. **security-auditor reviewer call** (per §5.11) — critical-path content review (CVE-2025-29927, OTP timing-attack surface, `crypto.timingSafeEqual` correctness via HMAC-digest pattern, cookie attributes incl. narrow `Path=/onboarding` on the pre-session ref, CSRF stance, OTP brute-force, session-fixation, Turnstile-scope-excludes-Google).
27. Commit session log to `docs/logs/SCAFFOLD.3.md` per CLAUDE.md §5.9 (six fields), commit message `chore(scaffold-3): log session — SCAFFOLD.3 close`. SAME branch, BEFORE the PR opens.
28. Open PR via `/pr` skill or `gh pr create --fill`. Title follows Conventional Commits: `feat(scaffold-3): auth wiring — 6 flows + session-deferral + admin two-layer middleware + dev-seed`.

---

## References

- `/Users/hrishikesh/code/zugzwang/experiment/CLAUDE.md` §1 (critical paths), §2 (invariants), §3 (refusal triggers), §4 (engagement style), §5.1 (plan mode), §5.6 (tests-first), §5.10 (self-audit), §5.11 (reviewer calls), §5.12 (ADRs), §7 (cleanup-absorption)
- `/Users/hrishikesh/code/zugzwang/experiment/AGENTS.md` §5 (Next.js 16 patterns), §6 (Drizzle conventions), §7 (handler stack), §10 (commit conventions), §11 (boundaries)
- `/Users/hrishikesh/code/zugzwang/experiment/docs/specs/SPEC.1.md` §13 lines 601–749 (F-AUTH-1 / F-AUTH-2 / F-AUTH-3 / F-AUTH-4 / F-AUTH-5 / F-AUTH-ADMIN). Verbatim warning text at line 684. SPEC.1 line 609: "No CAPTCHA on F-AUTH-ADMIN" — canonical per Q1.
- `/Users/hrishikesh/code/zugzwang/experiment/docs/specs/SPEC.2.md` §8 lines 788–951. §8.2 line 814 `email_verified` enforcement. §8.3 lines 826–840 verbatim session-deferral hook code. §8.4 lines 855–875 admin login 5-step (this plan absorbs same-commit amendment to drop step 1). §8.5 cookie table. §8.7 seven structural-separation pillars. §8.8 event types (deferred to ENGINE.6). §8.10 lines 933–949 file map.
- `/Users/hrishikesh/code/zugzwang/experiment/src/db/schema/auth.ts` — `users` (17 cols + 3 indexes; email index needs UNIQUE drift fix), `sessions` (8 cols, expiresAt nullable per disableSessionRefresh), `accounts`, `verifications`, `adminSessions` (PK = session_id; no FK to users).
- `/Users/hrishikesh/code/zugzwang/experiment/src/db/schema/identity.ts` — `identityPool` (8 cols; FIFO partial index on createdAt WHERE assignedAt IS NULL; Bucket B `assignedAt` whitelisted transition).
- `/Users/hrishikesh/code/zugzwang/experiment/drizzle/migrations/0003_append_only_triggers.sql` — Bucket B trigger for `identity_pool` (rejects any UPDATE that doesn't transition `assigned_at` NULL→timestamp once).
- `/Users/hrishikesh/code/zugzwang/experiment/src/server/middleware/rate-limit.ts` — `checkRateLimit`, identifier helpers, 7 Ratelimit instances; fail-OPEN.
- `/Users/hrishikesh/code/zugzwang/experiment/src/server/idempotency/cache.ts` + `types.ts` — `idempotencyLookupOrReserve`, `computeBodyFingerprint`; fail-CLOSED.
- `/Users/hrishikesh/code/zugzwang/experiment/src/server/config/limits.ts` — `OTP_REQUESTS_PER_EMAIL_PER_HOUR=5`, `OTP_REQUESTS_PER_IP_BURST_PER_MIN=10`, `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR=10` (placeholders; HARDEN.6).
- `/Users/hrishikesh/code/zugzwang/experiment/.env.example` — 9 auth env keys SCAFFOLD.14 wired.
- `/Users/hrishikesh/code/zugzwang/experiment/tests/integration/idempotency-cache.integration.test.ts` lines 43–85 — `vi.hoisted` + `vi.mock` + `clearAllMocks` test discipline pattern.
- `/Users/hrishikesh/code/zugzwang/experiment/docs/logs/SCAFFOLD.4.md` — Upstash substrate close-out.
- `/Users/hrishikesh/code/zugzwang/experiment/docs/logs/SCAFFOLD.14.md` — vendor env wiring close-out (sandbox-mode caveat for Resend; no CAPTCHA admin caveat).
- `/Users/hrishikesh/code/zugzwang/experiment/docs/logs/SCAFFOLD.2.md` and `SCAFFOLD.2-3C.md` — schema close-out + ADR absorption precedent.
- `/Users/hrishikesh/code/zugzwang/experiment/node_modules/next/dist/lib/constants.js` — Next.js 16.2.4 supports both `MIDDLEWARE_FILENAME='middleware'` and `PROXY_FILENAME='proxy'`. SPEC.2 §8.10 picks `proxy.ts`.
- Tracker: `zugzwang_experiment_tracker_v8.html` SCAFFOLD.3 row (operator-maintained, not in repo).
