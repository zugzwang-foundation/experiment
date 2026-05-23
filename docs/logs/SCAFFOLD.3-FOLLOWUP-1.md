# SCAFFOLD.3-FOLLOWUP-1 — Close-out log

**Task ID:** SCAFFOLD.3-FOLLOWUP-1
**Stratum:** SCAFFOLD.3 follow-up (Better Auth Content-Type 415 fix + captcha coverage)
**Plan-mode chat closed:** 2026-05-22
**Execute-phase chat closed:** 2026-05-23
**PR:** [#45](https://github.com/zugzwang-foundation/experiment/pull/45) (squashed to `main` as `3a737c6`)
**Branch:** `feat/scaffold-3-followup-1` (archived post-merge)
**Critical path:** YES (auth surface)

---

## 1. Outcome

PR #45 merged to `main`, deployed to production (`zugzwangworld.com`), and
verified via operator-side smoke test. Same-commit discipline preserved
across 5 amendments and 3 subagent gate cycles.

**Smoke test result summary:**

| Scenario | Result | Notes |
|---|---|---|
| §6 step 3.5 GATING probe (`TURNSTILE_SECRET_KEY` functional check) | PASS | Cloudflare returned `success: false / invalid-input-response`; production secret is a real Cloudflare-issued key, not a published test key. SPEC.2 §18.2 fail-CLOSED contract intact. |
| Scenario A (Google OAuth end-to-end) | PARTIAL PASS | OAuth code-exchange works post-`GOOGLE_CLIENT_SECRET` rotation. Path discriminator works (clean error redirect, no JSON-in-URL-bar leak). Session-creation hook chain executes through to pseudonym assignment. Blocked downstream at empty pseudonym pool in prd DB — out of scope for this task. |
| Scenario B (email-OTP send `turnstile_failed`) | PASS | Page rendered `turnstile_failed` error from SDK call. HTTP 400, not 415, not 500. SDK migration + hook header-transport + fail-CLOSED Turnstile gate all functional end-to-end. |
| Scenario C (returning user OTP-verify) | SKIPPED | Not gating; deferred until pseudonym pool seeded. |
| Vercel production deploy | GREEN | `next build` succeeded, implicitly verifying the Suspense wrap fix (Amendment 1.6 Resolution 2). |

---

## 2. Plan lineage

Plan opened at SPEC.10 closeout (SCAFFOLD.3 follow-up identification).
Plan-mode chat ratified Amendment 1.2 at commit `9aefb58`. Execute-phase
chat opened on `feat/scaffold-3-followup-1` at the same HEAD.

**Amendments landed during execute (all same-commit):**

- **§15 Amendment 1.3** — BLOCKING-1 absorption. `src/server/auth/index.ts:294-299` post-hoc hooks mutation removed; `TypeError: hook.handler is not a function` at `to-auth-endpoints.mjs:215` would have HTTP-500'd every email-OTP send post-merge. `otp.test.ts` introspection rewritten to walk `auth.options.plugins` directly. Hook reads `x-turnstile-token` via header transport per Q6 verdict (verified-at-execute against Zod default `.strip()` schema).
- **§16 Amendment 1.4** — SURPRISE 3 + 4 resolutions. Per-file fail-CLOSED `TURNSTILE_SECRET_KEY` override (`2x000…AA`) in `_probe-content-type-415.test.ts` via `beforeAll`/`afterAll` so test #5 hits 400 path in milliseconds instead of timing out at 10s. Per-call `customFetchImpl` override in test #6 to capture SDK wire-shape (`vi.spyOn(globalThis, 'fetch')` invisible to better-auth's module-load-captured `customFetchImpl` at `config.mjs:45`).
- **§17 Amendment 1.5** — §14.4 SURPRISE resolution (initial). Catch-all wrapper `ONBOARDING_REQUIRED` branch returns 403 JSON instead of 302 redirect on SDK paths; detection moved to `sdkError?.message === "ONBOARDING_REQUIRED"` since Better Auth's SDK return shape exposes only `{data, error}` (no `response.url` per `@better-fetch/fetch/index.d.ts:616-628`). Set-Cookie preserved byte-for-byte.
- **§18 Amendment 1.6** — Phase 6 reviewer-call CRITICAL + HIGH + MEDIUM absorption. Path discriminator added to wrapper: `/api/auth/callback/<provider>` browser-navigation paths return 302+null-body (HMAC token cookie-only); SDK paths return 403 JSON per §17. Suspense wrap on `sign-in/otp/page.tsx` per Next.js 16 `useSearchParams` build requirement. New `_probe-route-wrapper.test.ts` covering both wrapper branches + privilege-escalation regression guard.

---

## 3. Verdicts ratified

All 8 plan-time verdicts (Q1–Q7 + Q5-bis) held without re-litigation. 5
web-Claude execute-time ratifications:

1. `test-writer` split invocation (Phase 2a/2b/2c) — TDD-failing-first discipline.
2. Query-string email transport between sign-in pages — `router.push('/sign-in/otp?email=...')` + `useSearchParams()`.
3. §14.5.0 Zod schema mode pre-check at Phase 0.3 — non-blocking.
4. Primary-only `ONBOARDING_REQUIRED` detection — no defensive cookie-sniff fallback.
5. PR #44 (SCAFFOLD.12) body mirror for PR #45.

---

## 4. SURPRISES — full ledger

| ID | Phase | Severity | Disposition |
|---|---|---|---|
| S1–S6 | Plan-mode | 3 MED, 2 LOW, 1 INFO | Absorbed Amendment 1.2 |
| AS1 | Plan-time audit (X-Forwarded-For trust chain) | LOW | Deferred → `docs/parked.md` |
| AS2 | Plan-time audit (first-request CSRF gap) | INFO | Deferred → `docs/parked.md` |
| AS3 | Plan-time audit (ADR backfill 0002–0017 absent on disk) | LOW | Deferred → `docs/parked.md` |
| BLOCKING-1 | Checkpoint B (execute) | BLOCKING | Resolved Amendment 1.3 (same-commit refactor: post-hoc mutation removal + plugin-walk introspection) |
| SURPRISE-3 | Checkpoint B (execute) | MEDIUM | Resolved Amendment 1.4 (`beforeAll`/`afterAll` Turnstile secret override scoped to one test file) |
| SURPRISE-4 | Checkpoint B (execute) | MEDIUM | Resolved Amendment 1.4 (per-call `customFetchImpl` override) |
| §14.4 SURPRISE | Checkpoint C (execute, post-tsc) | HIGH | Resolved Amendment 1.5 (wrapper 302 → 403 JSON; `error.message` detection) |
| CRITICAL (Phase 6 round 1) | security-auditor | CRITICAL | Resolved Amendment 1.6 (path discriminator: `/api/auth/callback/<provider>` keeps 302 contract). Was about to ship a P0 break for new Google sign-ups + HMAC token leak via visible JSON body. |
| HIGH (Phase 6 round 1) | code-reviewer | HIGH | Resolved Amendment 1.6 (Suspense wrap on `sign-in/otp/page.tsx` for Next.js 16 build requirement). |
| MEDIUM (Phase 6 round 1) | code-reviewer | MEDIUM | Resolved Amendment 1.6 (new `_probe-route-wrapper.test.ts`). |
| 5× LOW (Phase 6 round 1) | mixed | LOW | Absorbed in-commit during Amendment 1.6: Content-Type assertion restored in test #6; stale 500-bullet trimmed from test #5 comment; stale post-hoc-mutation paragraph removed from `src/server/auth/index.ts`; §14.5.1 populated with empirical Phase 0.3 finding (default `.strip()`); item-11 plugin-package.json line drift noted in §14.5.2. |
| Phase 6 round 2 (post-Amendment-1.6) | security-auditor + code-reviewer | PASS | Both clean. Auditor noted WHATWG URL.pathname normalization makes path discriminator robust by construction against `..`/`%2E` traversal attempts. |

---

## 5. Operator-side findings during smoke test (post-merge)

These are **NOT** PR #45 bugs but were discovered during the smoke test
because the PR removed accidental cover (the 415 contract bug) that
hid them.

### 5.1 — `GOOGLE_CLIENT_SECRET` typo in Doppler `prd` config

**Symptom (first Scenario A attempt):**
- User completed Google consent → redirected to `/api/auth/callback/google?code=...`
- Callback redirected to `?error=invalid_code`
- Vercel runtime log captured: `ERROR [Better Auth]: { error: 'invalid_client', error_description: 'The provided client secret is invalid.', status: 401, statusText: 'Unauthorized' }`

**Root cause:** Operator had introduced an extra character into the
`GOOGLE_CLIENT_SECRET` value when setting it in Doppler. Google's token
endpoint rejected the code exchange with 401 `invalid_client`. Better
Auth re-mapped the upstream 401 to a generic `invalid_code` for the
user-facing redirect, which initially looked like a state-cookie
failure (the wrapper also cleared `__Secure-zugzwang.state` cookie on
error, deepening the misdirection).

**Resolution:** Operator rotated `GOOGLE_CLIENT_SECRET` in Doppler,
synced to Vercel `Production` env, triggered redeploy. Subsequent
Scenario A retry got past Google's token endpoint cleanly.

**Lesson:** When `invalid_code` surfaces from an OAuth callback, ALWAYS
check upstream Vercel runtime logs before assuming state-cookie failure.
The HTTP-level error code is often a re-mapping of an upstream auth
failure that lives in the runtime log, not the response body.

### 5.2 — Pseudonym pool empty in prd DB (`identity_pool_exhausted`)

**Symptom (second Scenario A attempt, post-secret-rotation):**
- Google OAuth code exchange succeeded.
- Session-creation hook chain executed.
- Redirected to `?error=identity_pool_exhausted` on root path.

**Root cause:** The pseudonym pool in prd DB has never been seeded.
Session-creation hook attempts to assign a pseudonym from the pool, pool
is empty, hook throws `identity_pool_exhausted`, wrapper redirects with
that error code.

**Resolution:** None in scope for PR #45. Separate scaffold task already
exists for pseudonym pool seeding (per Hrishikesh, 2026-05-23).

**Lesson:** PR #45's success is what made this finding observable — the
415 contract bug was hiding the entire downstream chain. Now that the
path works, every subsequent dependency in the user-creation flow needs
to be verified for prd-readiness before launch.

---

## 6. Same-commit final inventory

**Squashed commit `3a737c6` on `main`. 12 file touches:**

NEW (3):
- `src/lib/auth-client.ts`
- `tests/server/auth/_probe-content-type-415.test.ts` (6 assertions)
- `tests/server/auth/_probe-route-wrapper.test.ts` (3 assertions)

MODIFIED (9):
- `src/app/(auth)/sign-in/page.tsx` ('use client' + SDK migration + hidden Turnstile input retained)
- `src/app/(auth)/sign-in/otp/page.tsx` ('use client' + SDK migration + Suspense wrap + endpoint correction per Plan-Q5-bis)
- `src/app/api/auth/[...all]/route.ts` (path discriminator: 302 for OAuth callback paths, 403 JSON for SDK paths)
- `src/server/auth/index.ts` (header read + post-hoc mutation deletion + stale comment trim)
- `tests/server/auth/otp.test.ts` (plugin-walk introspection + header transport across 6 sites)
- `tests/_setup/env.ts` (`window.location.origin` shim for Node test env)
- `docs/parked.md` (3 deferred entries: ADR backfill, X-Forwarded-For, first-request CSRF)
- `docs/plans/SCAFFOLD.3-FOLLOWUP-1.md` (Amendments §15 + §16 + §17 + §18 + §14.5.1 population)
- (One additional auto-formatted file touched by Biome organize-imports on pre-commit; cosmetic only)

Total: 11 source/test/doc files + 1 cosmetic Biome touch = 12.

---

## 7. Test posture at PR close

- `pnpm exec biome check src/ tests/`: GREEN
- `pnpm exec tsc --noEmit`: GREEN
- `pnpm vitest run`: 27 files, 142 passed, 5 todo, 0 failed
- Pre-commit `biome-check-staged`: GREEN
- Pre-push `biome-check-all` + `typecheck`: GREEN
- security-auditor (round 2 post-Amendment 1.6): PASS
- code-reviewer (round 2 post-Amendment 1.6): PASS

---

## 8. Generalizable lessons (carry into future strata)

1. **SURPRISE-arrest rule earned its cost three times** in this execute. BLOCKING-1 (Checkpoint B), §14.4 (Checkpoint C), CRITICAL Google OAuth callback path (Checkpoint D round 1). Each one would have shipped a production-breaking regression without the gate. Trust the rule. Continue gating critical-path PRs with `security-auditor` + `code-reviewer` re-runs after every amendment.

2. **"No live caller" framing is brittle** — Amendment 1.5's premise ("no live caller still relies on the 302 contract") was wrong because it didn't enumerate browser-navigation consumers (Google OAuth callback) separately from SDK consumers. Future plan-mode passes should require explicit consumer-type inventory before any contract change is ratified. "Path discriminator" is a defensible pattern when multiple consumer-types share an endpoint.

3. **Vendor SDK behaviors discovered empirically in this PR (carry as reference for future Better Auth work):**
   - Better Auth's `runBeforeHooks` invokes `hook.handler(...)` on items from `options.hooks.before`. Post-hoc mutation that puts an array there breaks at runtime (`TypeError: hook.handler is not a function`).
   - The right place for plugin-scoped hooks is the plugin's own `hooks.before` array, accessed via `auth.options.plugins.find(p => p.id === <id>).hooks.before`.
   - Better Auth's SDK return shape is `{ data, error }` from `@better-fetch/fetch`. NO `response` field exposed. URL-sniffing for routing decisions is structurally impossible — must use `error.message` discriminators.
   - Better Auth's `$fetch` captures `customFetchImpl: fetch` at module load (`config.mjs:45`); `@better-fetch/fetch`'s `getFetch` always prefers `customFetchImpl` over `globalThis.fetch`. `vi.spyOn(globalThis, 'fetch')` is invisible to SDK calls. Use per-call `customFetchImpl` override for wire-shape testing.
   - Email-OTP send Zod schema is default `.strip()` (no chained modifier in plugin source). Body fields not declared in the schema are silently dropped. Header transport for ancillary fields (Turnstile token, etc.) is the only viable path.

4. **Next.js 16 production-build pitfalls** — `useSearchParams()` in a client component requires `<Suspense>` wrap, but `tsc --noEmit` + `vitest` do NOT catch the build-time error. Only `next build` does. AGENTS.md §2 forbids `pnpm build` in agent sessions for good reason (it's slow), but this means production-deploy-time can surface a class of bugs that pre-PR verification doesn't catch. Future PRs touching client components with `useSearchParams`, `useRouter` async APIs, or other build-time-checked hooks should explicitly call out the Suspense requirement in plan §2.

5. **Operator-side prd config bugs hide behind code bugs** — Both `GOOGLE_CLIENT_SECRET` typo and empty pseudonym pool were pre-existing prd misconfigurations that became observable only because PR #45 removed accidental cover. This pattern will repeat. Pre-launch HARDEN.* stratum should include a prd-readiness checklist: every env var used by the auth surface gets a functional probe; every seeded table gets a row-count assertion; every external service (Resend, Cloudflare, Google) gets a synthetic check.

6. **WHATWG URL.pathname normalization is robust by construction** — Path discriminators (`url.pathname.startsWith('/api/auth/callback/')`) are safer than they look because `..` and `%2E` traversal attempts collapse to non-matching paths and fall through to the safer branch (in our case, the SDK-JSON branch, which doesn't expose the HMAC token in the body). Documented as a "safer-by-construction" pattern for future wrapper logic.

---

## 9. Closed deferrables (carried out during this task)

- §14.5.1 — Zod schema mode pre-check finding populated.

## 10. Outstanding deferrables (carried forward to next strata)

- ADR backfill (0002 through 0017 missing from disk) — `docs/parked.md`, fires at the next task touching an ADR-governed domain OR at dedicated ADR-BACKFILL stratum OR at HARDEN.* consolidation.
- X-Forwarded-For trust chain — `docs/parked.md`, fires at HARDEN.* or first observed abuse.
- First-request CSRF gap on social + email-otp paths — `docs/parked.md`, fires at HARDEN.* security pass.
- Pseudonym pool seeding in prd DB — separate scaffold task (already exists per operator).
- Turnstile widget mount on sign-in page (DESIGN.*) — DESIGN deferral per plan §8. Until this lands, email-OTP send returns 400 `turnstile_failed` for all real users (this is the correct fail-CLOSED behavior; user-facing email-OTP signup is gated on widget mount).
- Item-11 plugin-package.json line drift (better-auth v1.6.11 subpath exports moved from line 22/47 to 54/79) — informational only; no action required unless package.json structure changes again.

---

## 11. Process notes

- 5 amendments deep on a single execute phase. The plan-mode work was thorough but better-auth 1.6.11's empirical reality surfaced cascading edge cases. The amendment rate decelerated as the diff converged: BLOCKING-1 at the start was a structural bug; the CRITICAL at amendment 4 was a missed consumer type; by amendment 5 the diff was reviewer-verified clean on first try.
- Reviewer-call re-runs are required after every plan amendment on a critical-path PR. Pass-by-reference from a prior round is not acceptable. This pattern paid off at amendment 4 (CRITICAL discovery).
- 4-checkpoint cadence (instead of 9) preserved the SURPRISE-arrest rule's structural benefit while reducing operator round-trip overhead. Worth defaulting to for future critical-path executes.

---

## 12. Sign-off

PR #45 squash-merged to `main` as `3a737c6`. Production deploy GREEN.
Operator-side smoke test complete. Path is functional end-to-end except
for the pseudonym pool dependency (out of scope, separate task).

**Ready for Phase 9 step 2 (project-knowledge update table).**

🥤 — Hrishikesh, 2026-05-23
