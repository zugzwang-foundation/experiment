# AUTH-OTP-GATE — Email-OTP send short-circuited by the Turnstile before-hook

> **Status:** drafted (sign-off deferred to the morning PR gate — unattended overnight run)
> **Date:** 2026-06-20
> **Author:** Claude Code (overnight autonomous prep tab)
> **Critical-path?** yes — `src/server/auth/` (CLAUDE.md §1)
> **Plan PR / commit:** committed on `fix/auth-otp-gate-context` before Phase 2

---

## Tracker context

No tracker row — this is an overnight-discovered production/staging-blocking bug, queued as work item #1 of the staging-provisioning prep kickoff (2026-06-20). The email-OTP signup path is dead on every environment: `/email-otp/send-verification-otp` returns `200 {}` and **no OTP is ever generated, stored, or sent**, while the client UI still advances to the code-entry screen. This blocks the entire email-OTP arm of participant signup on staging (and prod).

Dependencies: none. The fix is self-contained in `src/server/auth/index.ts`.

## Approach (one paragraph)

The custom `zugzwang-otp-gate` Better Auth plugin runs a `before` hook on `/email-otp/send-verification-otp` to enforce Turnstile + rate-limit. The hook returns a bare `{}` on the success path. Better Auth 1.6.11's hook aggregator treats a returned object **without a truthy `context` key** as a deliberate short-circuit response: it returns that object as the HTTP body and **never invokes the real send endpoint**. The fix is to return `{ context: {} }` instead, which tells the aggregator "continue to the endpoint, merging no context changes." This is a one-line correction plus a comment rewrite (the existing comment asserts the opposite of the library's actual behavior, which is the root cause this shipped). A RED-first integration test drives the real `auth.api.sendVerificationOTP` endpoint and asserts the OTP is actually generated/stored (verification row) + dispatched (Resend callback) — closing the gap that the current unit tests (which only assert the hook *resolves*) left open.

### Evidence (verified against the installed `node_modules/better-auth@1.6.11`)

`dist/api/to-auth-endpoints.mjs`:

- `runBeforeHooks` (L196–237): when our handler returns `{}`, L222 `if (result && typeof result === "object")` is true, L223 `"context" in result` is **false**, so L232 `return result` aborts the hook loop and returns `{}`.
- Main flow (L74–93): `before = {}`. L79 `"context" in before` is **false** → falls to L90 `else if (before)` → `{}` is truthy → returns `toResponse({})` (HTTP 200, empty JSON). **The real `endpoint(internalContext)` at L97 never runs.**
- With `return { context: {} }`: `runBeforeHooks` L223 takes the merge branch → L230 `continue` → L236 returns `{ context: {} }`. Main flow L79 `"context" in before && before.context && typeof before.context === "object"` is **true** (`{}` is a truthy object) → merges (no-op) → falls through past the `else if` to **run the real endpoint**. OTP generated, stored, sent.

`dist/plugins/email-otp/routes.mjs` (the endpoint that now runs):

- `resolveOTP` (L28–51): generates the OTP, `storeOTP`, then `internalAdapter.createVerificationValue({ identifier, value, expiresAt })`. Identifier = `toOTPIdentifier(type, email)` = `` `${type}-otp-${email}` `` (`utils.mjs` L4).
- `sendVerificationOTP` route (L72+): for `type: "sign-in"` with default config (`disableSignUp` unset), `shouldSendOTP` is true, so the verification row is kept and `opts.sendVerificationOTP({ email, otp, type })` (our Resend callback) is invoked.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | no | Auth send path; no bet/comment writes | n/a |
| 2.2 Dharma non-transferable | no | No ledger writes on the OTP send path | n/a |
| 2.3 Side frozen at comment-time | no | No comment writes | n/a |
| 2.4 Resolutions append-only | no | No resolution writes | n/a |

**Invariant-adjacent note (critical-path file, not an INV-1..4 touch):** the gate's *security* behavior (Turnstile fail-closed + rate-limit) must be preserved by the fix. The failure mode if the fix regressed the gate: a Turnstile-failing or rate-limited request could reach the real send endpoint, defeating the abuse controls. The existing `otp.test.ts` reject-path tests (`turnstile-fail-rejects-otp-send`, `turnstile-unavailable-fails-closed`, `rate-limit-*-rejects`) already assert the throw paths and **must stay green** — the fix only changes the *success* return value (`{}` → `{ context: {} }`), never the throw paths (which `throw new APIError(...)` and are unaffected).

---

## 2. Data model changes

None — behavioral fix to an auth before-hook. No schema, no migration.

## 3. API surface

No new endpoints. Behavioral correction to the existing `POST /api/auth/email-otp/send-verification-otp` (Better Auth route, gated by `zugzwang-otp-gate`):

- **Before fix:** Turnstile+rate-limit pass → `200 { }` and no OTP (silent failure).
- **After fix:** Turnstile+rate-limit pass → real endpoint runs → OTP generated/stored + Resend dispatch → `200 { success: true }`.
- Auth: public (pre-auth send path). Rate-limit: unchanged (`otpRequestPerEmail` + `otpRequestPerIpBurst`, enforced in the gate).

## 4. UI / user flow

None changed in this PR. (The client already advances to the code screen; after this fix the code the user is told to enter will actually exist.) The client-side form is out of scope.

## 5. Failure modes

- **Turnstile down / fails:** unchanged — gate throws `APIError` before the endpoint runs (fail-closed). Asserted by existing tests.
- **Rate-limit exceeded:** unchanged — gate throws 429. Asserted by existing tests.
- **Resend send failure:** the real endpoint runs `opts.sendVerificationOTP`, which throws on Resend error → surfaced as a 5xx (existing `resend-failure-throws` unit test covers the callback). Detect via Sentry; recover via retry by the user.
- **Regression risk:** if a future refactor reverts to `return {}` (or any object without `context`), the silent short-circuit returns. The new integration test is the regression guard — it fails loudly (no verification row, no Resend call).

## 6. Edge cases

- `type: "sign-in"` with no pre-existing user → verification row created + kept + sent (default config, `disableSignUp` unset). This is the participant-signup case and is exactly what the RED test exercises.
- Concurrent sends for the same email → governed by the unchanged per-email rate-limit; not affected by this fix.
- The merge branch in the aggregator destructures `headers` out of the returned context; returning `{ context: {} }` has `headers === undefined` → no header mutation (verified at `to-auth-endpoints.mjs` L80, L86 guards `if (headers)`).

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/server/auth/otp.test.ts`) | Existing suite must stay GREEN unchanged — confirms the fix does not regress the Turnstile/rate-limit throw paths or the matcher scope. | gate security behavior (not INV-1..4) |
| Integration (`tests/integration/email-otp-send.integration.test.ts`, NEW — RED-first) | Drive the **real** `auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers: { x-turnstile-token, x-forwarded-for } })` with Turnstile (fetch) + `checkRateLimit` mocked to pass and Resend mocked. Assert: (a) a `verifications` row exists for identifier `sign-in-otp-<email>` after the call (OTP **generated/stored**); (b) the Resend `emails.send` mock was called once with a 6-digit code (OTP **dispatched**). Under the bug both assertions fail (endpoint never runs); under the fix both pass. Cleanup: delete the identifier's verification rows before + after. | n/a (auth send path) |

**RED protocol:** `@test-writer` authors the integration test against this §7 before the fix lands; it must run RED (fails: no verification row / no Resend call) on the unfixed `return {}`, then GREEN after `return { context: {} }`. The local test Postgres (`:54322`) is up, so RED/GREEN is demonstrated locally, not deferred to CI.

## 8. Out of scope

- Not touching the client-side sign-in/OTP form (`src/app/(auth)/`).
- Not changing the Turnstile header transport (`x-turnstile-token`), rate-limit buckets, or any gate security semantics — only the success-path return value.
- Not flipping `RESEND_FROM_EMAIL` off the sandbox domain (that is a staging/prod env + DNS task — see the staging runbook, work item #3).
- Not adding an ADR (this is a bug fix correcting a wrong assumption about a library contract, not an architectural decision — CLAUDE.md §5.12).
- Not migrating the gate from the `as unknown as BetterAuthPlugin` double-cast plugin shape (pre-existing, works at runtime).

---

## Open questions

- **Q:** Should the integration test also assert the HTTP-level `{ success: true }` return shape?
- **Candidate:** No — asserting the DB verification row + the Resend dispatch is the load-bearing, behavior-faithful signal ("generated/stored/sent"). The return shape is incidental and couples the test to Better Auth's response envelope.
- **Resolve with:** this plan (decided: assert side effects, not the envelope).

## ADRs needed

None. Bug fix; corrects a mistaken assumption about Better Auth's before-hook return contract. The corrected understanding is captured in the code comment + this plan.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | A pure-unit test (calling the handler directly) would NOT catch this bug — that is exactly the gap that let it ship. | Resolved: the RED test drives the real `auth.api` endpoint through the aggregator, not the handler in isolation. |
| 2 | low | `runInBackgroundOrAwait` could in principle defer the Resend call, making the Resend assertion flaky. | Mitigated: the **verification row** (created synchronously inside `resolveOTP` via an awaited `createVerificationValue`) is the primary assertion; in the Node server-API context `runInBackgroundOrAwait` awaits, so the Resend assertion is reliable as secondary. |
| 3 | low | Test could collide with real data if run against a shared DB. | Mitigated: unique throwaway email + delete-by-identifier cleanup before and after. |

---

## References

- `CLAUDE.md` §1 (critical paths), §2 (no invariant touched), §5.6 (tests-first), §5.11 (reviewer cascade)
- `AGENTS.md` §7 (server stack), §9 (testing layout)
- `node_modules/better-auth/dist/api/to-auth-endpoints.mjs` (verified hook-aggregator behavior)
- `node_modules/better-auth/dist/plugins/email-otp/routes.mjs` (verified send-path behavior)
- Work item #1, staging-provisioning prep kickoff, 2026-06-20
