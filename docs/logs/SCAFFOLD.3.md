# SCAFFOLD.3 — Auth wiring

**Status:** Closed 2026-05-16
**Branch:** 11 commits on feat/scaffold-3 (base: `c83a32b`, head: `aa008aa`); not yet merged
**PR:** to fill on open (step 28)
**Predecessor:** SCAFFOLD.4 (`docs/logs/SCAFFOLD.4.md`, `main` at `825e18b`)
**Unblocks:** ENGINE.6 (events helper at `src/server/events/insert.ts` — every SCAFFOLD.3 event-row TODO is parked there); DESIGN.* (sign-in form + brand); HARDEN.6 (rate-limit numbers); HARDEN.7 (real ToS/Privacy text + hashes)

---

## What landed (CLAUDE.md §5.9 field 1)

11 of 11 plan scope items implemented; full 28-step Phase-2 execute pipeline completed through step 27 (this log). 11 commits on `feat/scaffold-3`:

```
cf06873  fix(scaffold-3): SERIALIZABLE + retry-once on admin login (step-25 MEDIUM)
66cec11  fix(scaffold-3): step-24 self-audit FAIL resolutions
61c2fb9  feat(scaffold-3): tos-accept + tos-versions + proxy + UI pages + seed (steps 16-21)
c8faaf4  chore(scaffold-3): tighten adminLoginAction return type — drop confusing void
a4dd7d9  feat(scaffold-3): admin auth path + participant logout (steps 12-15)
02f0dd5  chore(scaffold-3): drop unused biome-ignore comments in probe test
13fc655  feat(scaffold-3): catch-all route (step 11) + items #2/#3/#4 resolved
613aa02  chore(scaffold-3): replace `as any` cast on OTP-gate plugin
df8697e  feat(scaffold-3): Better Auth wiring (steps 6-10) — INV-3 protection live
c83a32b  test(scaffold-3): land failing tests via test-writer reviewer call
95b394d  feat(scaffold-3): users.email uniqueIndex + sessions.expiresAt NOT NULL
fc9edef  chore(scaffold-3): install better-auth 1.6.11 + resend; verify Q6/Q10/Q11
4bdfcef  docs(scaffold-3): land approved implementation plan
```

Scope items:

1. F-AUTH-1 Google OAuth via `socialProviders.google` + `mapProfileToUser` enforcing `email_verified === true`
2. F-AUTH-2 Email-OTP via Better Auth email-otp plugin + Resend `sendVerificationOTP` callback + Cloudflare Turnstile `hooks.before` matched to `/email-otp/send-verification-otp` only
3. F-AUTH-3 pseudonym + PFP via `identity_pool` FIFO consumer (`SELECT FOR UPDATE SKIP LOCKED` + `UPDATE assigned_at`)
4. F-AUTH-4 ToS acceptance via `acceptTosAction` Server Action with 5-column evidence + SELECT FOR UPDATE tab-race idempotency
5. F-AUTH-5 logout (participant via `auth.api.signOut`; admin via direct `DELETE FROM admin_sessions` + cookie clear)
6. F-AUTH-ADMIN static-password admin auth with HMAC-digest length-safe `timingSafeEqual` + SERIALIZABLE DELETE+INSERT + retry-once-on-40001 + identical-401 envelope
7. Session-deferral hook factory at `src/server/auth/session-gate.ts` (DIRECT INV-3 construction-layer protection) wired inline via `databaseHooks.session.create.before`
8. Two-layer admin middleware: Layer 1 `proxy.ts` redirect UX; Layer 2 `validateAdminSession` at every admin handler entry (CVE-2025-29927 boundary)
9. Better Auth ID-override across 4 tables via `advanced.database.generateId: () => uuidv7()` + DB-side `default(sql\`uuidv7()\`)` belt-and-braces
10. ~200-row identity_pool dev-seed (20 colours × 10 animals × 1 number per pair) via `pnpm seed:identity-pool:dev` (`scripts/seed-identity-pool-dev.ts`, idempotent ON CONFLICT)
11. Rate-limit middleware on auth surfaces consuming SCAFFOLD.4 substrate: `adminLoginPerIp`, `otpRequestPerEmail`, `otpRequestPerIpBurst`

Test state: **58 passed | 5 todo (63 tests)** across 9 files. tsc clean. biome clean (82 files).

---

## Decisions made (CLAUDE.md §5.9 field 2)

### Q-resolutions (all 11 plan-time questions resolved + ratified)

| Q | Resolution | Landing commit |
|---|---|---|
| Q1 | No Turnstile on F-AUTH-ADMIN per SPEC.1 line 609. SPEC.2 §8.4 amended (4 steps, post-Turnstile-drop). | `66cec11` (audit fix; see MAINT-4) |
| Q2 | PFP renders `/public/pfp-placeholder.svg` until SCAFFOLD.15 R2 lands | `61c2fb9` |
| Q3 | Pre-session `onboarding_ref` cookie: HMAC-SHA256(BETTER_AUTH_SECRET) signed; Path=`/onboarding`, HttpOnly, Secure, SameSite=Lax, Max-Age=600 | `df8697e` |
| Q4 | ToS placeholder text at `public/legal/{tos,privacy}.txt`; hashes `placeholder-tos-v0` / `placeholder-privacy-v0` | `61c2fb9` |
| Q5 | Migration `0005_auth_schema_corrections.sql`: `users_email_idx` → uniqueIndex; sessions.expiresAt nullable → NOT NULL (step-3 SURPRISE absorbed) | `95b394d` |
| Q6 | Stranded-tuple fallback locked to stale-30d sweep (HARDEN-era); regression-guard test at `pseudonym.test.ts:259` | `fc9edef` (verification); `c83a32b` (regression test) |
| Q7 | Auth event-row writes deferred to ENGINE.6; call sites stubbed `// TODO(ENGINE.6)` | (all commits) |
| Q8 | `tests/server/identity/no-raw-uuid-in-urls.test.ts` placeholder (3 `it.todo`) | `c83a32b` |
| Q9 | `proxy.ts` filename (Next.js 16's middleware → proxy rename per `node_modules/next/dist/lib/constants.js`) | `61c2fb9` |
| Q10 | `user.create.before` injection via `{ data: { ...user, pseudonym, pfpFilename } }`; camelCase TS-identifier keys (not SQL aliases) per drizzle-adapter resolution | `df8697e` |
| Q11 | `drizzleAdapter({ usePlural: true, transaction: true })` — accepts plural Drizzle schema as-is | `df8697e` |

### Items #2 / #3 / #4 (step-10 check-in triage)

| Item | Resolution | Landing |
|---|---|---|
| #2 | `session.disableSessionRefresh: true` (canonical Better Auth 1.6.11 option, not the `updateAge` substitute) | `13fc655` |
| #3 | Cookie name `zugzwang_session` via `advanced.cookies.session_token.name` override (verified at `cookies/index.mjs:27`); no SPEC.2 §8.5 amendment | `13fc655` |
| #4 | APIError body field survival empirically confirmed + regression-guarded at `tests/server/auth/_probe-apierror-body-survival.test.ts`; no AsyncLocalStorage fallback needed | `13fc655` (route impl); `13fc655` (probe) |

### Step-24 audit FAILs (fixed in-session)

- **FAIL-1**: tos-accept.ts had no row lock; default READ COMMITTED check-then-write race possible. Fixed: prepended `tx.execute(sql\`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE\`)` to lock the row before findFirst. Test regex tightened `/UPDATE/i` → `/UPDATE\s+users\s+SET/i`. Commit `66cec11`.
- **FAIL-2**: SPEC.2 §8.4 amendment (Q1) was supposed to land in same commit as admin/login.ts (`a4dd7d9`); missed. Fixed: amended in `66cec11` (within-PR not within-commit; see MAINT-4).

### Step-25 code-reviewer MEDIUM (fixed in-session)

`admin/login.ts:100-108` opened `db.transaction(...)` without isolation level. Plan §4 step 6.4 + SPEC.2 §8.4 DELETE+INSERT step specify SERIALIZABLE. Applied Option A-prime: SERIALIZABLE isolation + retry-once-on-40001 wrapper. Second 40001 surfaces `admin_login_serialization_conflict` envelope (HTTP 503 semantic; distinct from `admin_login_invalid` 401). Commit `cf06873`.

### Step-26 security-auditor result

**GREEN** — zero CRITICAL/HIGH/MEDIUM. 2 LOW deferred (see MAINT-8, MAINT-9). 13 numbered concerns + 4 invariants walked; all PASS. SAFE section is the load-bearing artifact — auditor showed work.

### Reviewer-call invocation summary

| Call | Outcome | Commit |
|---|---|---|
| db-migration-reviewer (1/2) — schema cross-walk vs Better Auth 1.6.11 | GREEN — no missing columns | (verification; no commit) |
| db-migration-reviewer (2/2) — generated migration | GREEN — reversible, idempotent, chain-intact | `95b394d` |
| test-writer — 8 failing test files + 1 placeholder | RED state confirmed (`Cannot find package @/server/auth/...`) | `c83a32b` |
| code-reviewer | 1 MEDIUM fixed (isolation level); 4 LOW for tracker | `cf06873` |
| security-auditor | 0 C/H/M; 2 LOW deferred | (this log) |

---

## Open questions (CLAUDE.md §5.9 field 3)

**None at close time.** All Q1-Q11 + items #2/#3/#4 resolved + ratified during execute. All FAILs surfaced by step-24 audit + step-25 reviewer fixed in-session. The 9 carry-forward MAINT items below are *known accepted state*, not open questions.

---

## Next session starts at (CLAUDE.md §5.9 field 4)

**ENGINE.6** — events helper at `src/server/events/insert.ts`. All 6 `// TODO(ENGINE.6): write*Event(...)` call sites in SCAFFOLD.3 are awaiting that surface:

- `src/server/auth/session-gate.ts` — `user.tos_accepted` (in `acceptTosAction` post-UPDATE)
- `src/server/auth/admin/login.ts:144` — `admin.signed_in`
- `src/server/auth/admin/logout.ts` — `admin.signed_out`
- `src/server/auth/logout.ts` — `user.signed_out`
- (plus the `user.oauth_signed_in` / `user.otp_signed_in` / `user.pseudonym_assigned` sites at the auth-flow boundaries inside Better Auth — those land when ENGINE.6 ships the helper)

Plan path: `docs/plans/ENGINE.6.md` (to be drafted; will reference SPEC.2 §3.7 seven-field metadata block + §7 events table + §8.8 auth-event-type list).

Pre-launch deadline check: ENGINE.6 must close before 2026-09-15 launch (per project tracker) so dataset-export (SPEC.2 §19) has consumable event-row history. The auth-events backfill from SCAFFOLD.3-shipped flows is N/A — events are forward-looking flow audit, not historical reconstruction.

---

## Context to preserve (CLAUDE.md §5.9 field 5)

### Library + tooling pins

- `better-auth@1.6.11` (exact; see SPEC.2 §8.2 line 798 "pinned at version 1.6.x")
- `resend@6.12.3` (exact)
- `uuid@11.1.1` (carat; v7 export used for `advanced.database.generateId`)
- `tsx@4.22.0` (exact; for the seed script)
- `drizzle-orm@^0.45.0` (resolved to 0.45.2 — satisfies Better Auth's `>=0.45.2` peer)

### Stranded-tuple semantic (Q6 caveat — load-bearing)

Pool consumption inside `databaseHooks.user.create.before` runs in its OWN `db.transaction` (Better Auth doesn't expose its tx handle to hooks). Better Auth's OAuth flow (`oauth2/link-account.mjs:91-138`) and Email-OTP flow each open their own tx for user-create that DOES NOT wrap session-create. Consequence: if session-gate throws ONBOARDING_REQUIRED, the user row rolls back but `identity_pool.assigned_at` UPDATE persists. The `pseudonym::pool-tuple-strands-on-session-gate-throw` regression-guard test in `tests/server/auth/pseudonym.test.ts:259` will FAIL if a future Better Auth version changes the tx wrapping to one-tx — at which point drop the test + tighten Q6 fallback posture.

### HMAC-digest length-safe pattern (reusable)

`admin/login.ts:73-79` defines `hmacDigestEqual(input, expected, secret)`. Pattern: `createHmac("sha256", secret).update(x).digest()` on BOTH inputs → two 32-byte buffers → `timingSafeEqual`. No `RangeError` on length mismatch; no length-leak side channel. Reusable for any future static-credential compare.

### Test introspection hack

`src/server/auth/index.ts:289-299` post-hoc mutates `auth.options.hooks.before = otpGateBeforeHooks` for unit-test access. Runtime wiring is the `zugzwang-otp-gate` plugin (Better Auth's aggregator at `to-auth-endpoints.mjs` merges plugin hooks into the before-chain at init). The mutation is read-only at runtime — Better Auth never re-reads `options.hooks.before` after init.

### Resend sandbox-mode caveat

`RESEND_FROM_EMAIL=onboarding@resend.dev` only delivers to `zugzwangworld@proton.me` until SCAFFOLD.12 lands DNS verification + flips the from-address. SCAFFOLD.3 OTP flow is end-to-end testable only against that single recipient address.

### Cookie names settled

- `zugzwang_session` (participant) — Better Auth via `advanced.cookies.session_token.name` override
- `zugzwang_admin_session` (admin) — hand-rolled at `admin/login.ts:178`
- `onboarding_ref` (pre-session) — HMAC-signed; Path=`/onboarding`, 10-min TTL

### Identity pool

200 dev-seed rows via `pnpm seed:identity-pool:dev`. Production 50K seed is out-of-repo (Hrishikesh DGX-Spark + ComfyUI + Flux.1 12B FP4 + Pillow number compositing) per SPEC.1 §13 lines 643-651.

### Test setup additions

- `tests/_setup/env.ts` seeds non-empty `BETTER_AUTH_SECRET`/`GOOGLE_CLIENT_ID`/etc. for module-load env validation; `??=` so `.env.local` overrides win
- `tests/_setup/server-only-shim.ts` aliased in `vitest.config.ts` `resolve.alias` so `@/db/index.ts`'s `import "server-only"` doesn't throw in Node test environment

---

## Time (CLAUDE.md §5.9 field 6 — optional)

Aggregate ~6 hours focused execute time across Phase 1 (planning) + Phase 2 (execute through step 27). Plan-mode drafting: 2026-05-15. Execute: 2026-05-15 → 2026-05-16. Plan-review + step-24 audit-fix + step-25 MEDIUM-fix + step-26 security-audit = the bulk of the second day.

---

## Carry-forward MAINT — for future strata / HARDEN

### MAINT-1: SCAFFOLD.2 schema doc — sessions.expiresAt nullable misread, corrected

SCAFFOLD.2 close-out documented `sessions.expiresAt` as nullable, justifying it by `disableSessionRefresh: true`. The misread: `disableSessionRefresh` suppresses the **sliding-window UPDATE** (refresh of `expires_at`), not the **INSERT** path. Better Auth's `internalAdapter.createSession` always populates `expires_at` with a Date. SCAFFOLD.3 step-3 reviewer SURPRISE caught this; step-4 migration `0005_auth_schema_corrections.sql` tightened the column to `NOT NULL` and the schema comment at `src/db/schema/auth.ts:69-84` was rewritten. No backfill needed (pre-launch empty table).

### MAINT-2: AGENTS.md test-path convention contradicts SPEC.1 §13 + SPEC.2 §8.10

AGENTS.md §3/§4 says tests live under `tests/{unit,integration,e2e,invariants}/`. SPEC.1 §13 + SPEC.2 §8.10 specify `tests/server/auth/` for the auth-flow acceptance tests. Per CLAUDE.md doc-hierarchy (SPEC > AGENTS), SPECs won. AGENTS.md §3 + §4 are due for a non-blocking cosmetic amendment when convenient. SCAFFOLD.3 tests live under `tests/server/auth/` + `tests/server/identity/`; future auth-domain tests should follow.

### MAINT-3: Q6 two-tx semantics confirmed; stale-30d sweep is locked recovery

Better Auth 1.6.11's OAuth + Email-OTP flows do NOT wrap user-create + session-create in one Postgres transaction. Pool consumption inside `user.create.before` commits in its own `db.transaction`. On session-gate throw (ToS NULL), the user row rolls back but `identity_pool.assigned_at` persists. Recovery: stale-30d sweep per SPEC.1 line 704 (HARDEN-era). NO release-sweep written in SCAFFOLD.3 — scope discipline.

### MAINT-4: SPEC.2 §8.4 amendment landed within-PR not within-commit

Kickoff Q1 ratification said the Turnstile-drop SPEC amendment should land in the SAME commit as `src/server/auth/admin/login.ts`. It actually landed in commit `66cec11` (step-24 audit fix), separate from `a4dd7d9` (where admin/login.ts was added). All within the SAME PR. CLAUDE.md §7 "same-commit absorption" wording was relaxed at-time. **Future strata: retain commit-grain discipline** — co-amend the spec in the same commit where the load-bearing code change lands. The cost of the slip was procedural: the spec said one thing while the code said another for two commits (`a4dd7d9` through `66cec11` exclusive).

### MAINT-5: proxy.ts only protects /admin/* this iteration

Plan §4 step 1 implies `proxy.ts` redirects unauthenticated visitors from protected participant routes to `/(auth)/sign-in`. Current `proxy.ts` matcher is `/admin/:path*` only — no participant resource routes exist yet (ENGINE.*/DEBATE.* scope). When the first participant resource route lands, add a matcher entry to `proxy.ts` for `zugzwang_session` cookie presence; the existing admin-redirect logic is the template.

### MAINT-6: Session-gate ships inline via databaseHooks (not as a Better Auth plugin)

Design decision worth documenting because Better Auth's hook surface has two distinct shapes:

- **Inline `databaseHooks`** (used for session-gate at `src/server/auth/index.ts:280-285`): `databaseHooks.session.create.before = createSessionGate(db)`. Single hook function fires unconditionally before every session INSERT. No matcher; no array.
- **Custom plugin** (used for OTP/Turnstile gate at `src/server/auth/index.ts:174-176`): `zugzwang-otp-gate` plugin exports `hooks.before: [{matcher, handler}]`. Better Auth's runtime aggregator merges these into the before-chain.

The split rule: **inline databaseHooks when the hook fires on every event; custom plugin when path-scoped matching is needed**. Better Auth's top-level `hooks.before` is a single `AuthMiddleware` with no matcher option, so path-scoped middleware MUST use plugin form. Future strata adding auth hooks should pick the form based on this rule; consider documenting in CLAUDE.md / AGENTS.md if the pattern proliferates.

### MAINT-7: `_probe-*` naming convention for library-contract regression-guard tests

`tests/server/auth/_probe-apierror-body-survival.test.ts` is the prototype: a test that empirically verifies a third-party library's behavior we depend on (in this case, Better Auth preserving arbitrary APIError body fields through its HTTP response serialization). The underscore prefix marks it as a regression guard, distinct from flow tests (`google.test.ts`, `otp.test.ts`, etc.). Convention going forward: **`tests/<area>/_probe-<library>-<behavior>.test.ts`** for any test that exists to catch a third-party library's contract drift.

### MAINT-8: LOW-1 admin cookie UUID validation deferred to HARDEN.*

Step-26 security-auditor LOW: `src/server/auth/admin/validate.ts:34-36` and `admin/logout.ts:24-26` pass attacker-controllable `cookie.value` directly into a parameterized SQL query against `admin_sessions.session_id` (`uuid` column). If attacker sets `zugzwang_admin_session=not-a-uuid` (no auth needed; just craft the cookie), Postgres rejects with `invalid input syntax for type uuid` → uncaught error → HTTP 500 (instead of clean 401/redirect). **NOT SQLi** (Drizzle parameterizes via positional binding); availability/UX gap only. Self-recovers (a 500 just denies the admin who's already unauthorized). **Deferred reasoning**: HARDEN.*'s catch-and-401 conversion is the right home. Fixing now would be one regex pre-check per call site, but the cleaner fix (centralized in `validateAdminSession`) lands alongside other admin-handler hardening at HARDEN.

### MAINT-9: LOW-2 sign-in form content-type deferred to DESIGN.*

Step-26 security-auditor LOW: `src/app/(auth)/sign-in/page.tsx:18,31` use raw HTML `<form>` POSTs (default `application/x-www-form-urlencoded`); Better Auth's `/api/auth/sign-in/social` + `/api/auth/email-otp/send-verification-otp` expect JSON bodies. Form submissions functionally fail in dev. **NOT a security issue** — UX/wiring stub only. **Deferred reasoning**: DESIGN.* rewrites the whole sign-in page with the Better Auth client wrapper (which posts JSON), proper Turnstile widget mount, and brand styling. Fixing the placeholder now is throw-away work. The hardcoded `turnstileToken=placeholder-token` would be Turnstile-rejected (fail-CLOSED, correct behavior).

---

## Single source of truth — files touched

| File | State | Notes |
|---|---|---|
| `docs/plans/SCAFFOLD.3.md` | Created | 337 → ~350 lines after audit + check-in updates |
| `docs/specs/SPEC.2.md` | Amended at §8.4 | Q1 — Turnstile dropped; 4 steps post-amendment |
| `package.json` | Modified | +better-auth@1.6.11, +resend@6.12.3, +tsx@4.22.0; +seed:identity-pool:dev script |
| `pnpm-lock.yaml` | Modified | Locked to those exact versions |
| `src/db/schema/auth.ts` | Modified | users_email_idx → uniqueIndex; sessions.expiresAt → NOT NULL |
| `drizzle/migrations/0005_auth_schema_corrections.sql` | Created | Drift fixes |
| `drizzle/migrations/meta/_journal.json` + `0005_snapshot.json` | Modified/Created | Drizzle chain integrity |
| `src/server/auth/index.ts` | Created | Better Auth instance + databaseHooks + zugzwang-otp-gate plugin + cookie config |
| `src/server/auth/session-gate.ts` | Created | DIRECT INV-3 protection (createSessionGate factory) |
| `src/server/auth/onboarding-ref.ts` | Created | HMAC-signed pre-session cookie helpers |
| `src/server/auth/email-otp.ts` | Created | Resend `sendVerificationOTP` callback |
| `src/server/auth/tos-accept.ts` | Created | F-AUTH-4 Server Action with SELECT FOR UPDATE |
| `src/server/auth/tos-versions.ts` | Created | TOS_VERSION_HASH + PRIVACY_VERSION_HASH + REID_WARNING_TEXT |
| `src/server/auth/logout.ts` | Created | Participant logout — never reads cookies() |
| `src/server/auth/admin/login.ts` | Created | 4-step admin login; SERIALIZABLE + retry-once |
| `src/server/auth/admin/logout.ts` | Created | Admin logout — idempotent on missing cookie |
| `src/server/auth/admin/validate.ts` | Created | Layer 2 CVE-2025-29927 boundary |
| `src/server/identity-pool/consume.ts` | Created | SELECT FOR UPDATE SKIP LOCKED + UPDATE assigned_at |
| `src/app/api/auth/[...all]/route.ts` | Created | Better Auth catch-all + onboarding_ref cookie emission |
| `src/app/(auth)/sign-in/page.tsx` | Created | Placeholder (DESIGN.* rewrites — see MAINT-9) |
| `src/app/(auth)/sign-in/otp/page.tsx` | Created | Placeholder |
| `src/app/(auth)/onboarding/page.tsx` | Created | Pseudonym + PFP + ToS gate; reads onboarding_ref; inline Server Action wrapper |
| `src/app/(admin)/admin/login/page.tsx` | Created | Single password field; noindex meta |
| `proxy.ts` | Created | Next.js 16 Layer 1 redirect UX (admin-redirect only — see MAINT-5) |
| `public/legal/tos.txt` + `privacy.txt` | Created | Lorem ipsum (HARDEN.7 swaps real text — see MAINT-9) |
| `public/pfp-placeholder.svg` | Created | Gray-circle placeholder (SCAFFOLD.15 swaps R2 URL) |
| `scripts/seed-identity-pool-dev.ts` | Created | 200-tuple deterministic seed |
| `vitest.config.ts` | Modified | +setupFiles + resolve.alias for server-only shim |
| `tests/_setup/env.ts` | Created | Test-env defaults |
| `tests/_setup/server-only-shim.ts` | Created | Vitest no-op shim |
| `tests/server/auth/google.test.ts` | Created | F-AUTH-1 |
| `tests/server/auth/otp.test.ts` | Created | F-AUTH-2 + Turnstile + rate-limit |
| `tests/server/auth/pseudonym.test.ts` | Created | F-AUTH-3 + Q6 regression guard |
| `tests/server/auth/tos.test.ts` | Created | F-AUTH-4 |
| `tests/server/auth/session-gate.test.ts` | Created | INV-3 DIRECT |
| `tests/server/auth/admin-login.test.ts` | Created | F-AUTH-ADMIN |
| `tests/server/auth/logout.test.ts` | Created | F-AUTH-5 + SPEC.2 §8.7 pillar 6 |
| `tests/server/auth/onboarding-ref.test.ts` | Created | HMAC sign/verify round-trip |
| `tests/server/auth/_probe-apierror-body-survival.test.ts` | Created | Library-contract regression guard (MAINT-7) |
| `tests/server/identity/no-raw-uuid-in-urls.test.ts` | Created | `it.todo` placeholder (Q8) |
| `docs/logs/SCAFFOLD.3.md` | This file | Created |
