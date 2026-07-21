# ADR-0033 — OTP delivery: sandbox-from boot guard, optimistic-request error semantics, and the structural send-suppression constraint

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Hrishikesh (founder) — web review relay, operator-ratified |
| **Tracker task** | AUTH-OTP-DELIVERY (auth critical-path; UI-A7 ledger follow-up) |
| **Frame document** | `docs/plans/AUTH-OTP-DELIVERY.md` §0·R (ratified rulings); SPEC.2 §8.2 (email-OTP); Better Auth 1.6.11 `runInBackgroundOrAwait` (node_modules) |
| **Supersedes** | — (retires the AUDIT-FIX-B7b A35 "staging deliberately EXEMPT" code accommodation — see Decision §1) |
| **Superseded-by** | — |

---

## Context
- Email-OTP is one of two front doors. UI.A7 staging verification found it fully broken: Resend on a `@resend.dev` sandbox from-address with no verified sending domain; prod carried the identical config, so every non-owner recipient was rejected 403.
- Reading Better Auth 1.6.11 (node_modules): the emailOTP request handler awaits the sender via `runInBackgroundOrAwait`, but its try/catch suppresses any throw to `logger.error`, then unconditionally returns `{ success: true }` (HTTP 200). With no `advanced.backgroundTasks.handler` configured, the send is awaited-but-suppressed. A delivery failure — including an APIError thrown by our own sender — never reaches the client; the SDK sees `{ error: null }`; the sign-in page navigates to the OTP screen on apparent success. Only Turnstile/validation before-hook errors surface; the Resend delivery throw is structurally invisible.

## Decision
1. **Boot guard.** The from-address guard rejects `unset OR sandbox`. Sandbox = the from-address domain equals `resend.dev` or a subdomain of it (case-insensitive; parser handles bare and `Name <email>` forms; malformed/no-`@` values are treated as non-sandbox and fail at send, not at boot). Minimal rule — no verified-domain allowlist. Enforced when `ZUGZWANG_ENV ∈ {prod, staging}`; `preview` (which includes local dev and CI) is exempt so the sandbox stays usable for local testing. This **supersedes** the prior scaffolding-era "staging deliberately EXEMPT" accommodation: staging now has a verified sender, and enforcing on staging makes it a faithful rehearsal of prod's fail-fast.
2. **Optimistic-request error semantics (ratified, not a workaround).** Because send failures are structurally suppressed by the plugin, the request endpoint returns 200 and the client navigates to the OTP screen. Failed delivery is handled by (a) a "Resend code" + "Back to sign in" affordance on the OTP screen, and (b) server-side observability (`Sentry.captureException` in the sender). We do NOT attempt to surface the precise delivery error inline — it is not obtainable at this plugin version.

## Constraints (do NOT undo)
- Do NOT try to reclaim a synchronous client-side delivery error by awaiting/rethrowing in the sender. The plugin's await already happens; the suppression is structural. Awaiting will not surface the error and only adds latency. Any future fix must go through Resend delivery webhooks (out of scope here), not the request path.
- The "Resend" action must carry the same Turnstile token the initial sign-in request sends (today: always-pass placeholder). When AUTH-TURNSTILE-WIRE lands a real widget, the resend path inherits the real token. Keep resend↔sign-in token parity.

## Scope / non-goals
- Hard-bounce / undeliverable detection (typo addresses, permanent failures) is NOT covered — needs Resend delivery webhooks; tracked as a separate observability follow-up.
- Humanizing raw error codes (`rate_limited`, etc.) stays deferred to AUTH-ERROR-COPY; this task reuses the existing `role="alert"` surface with no new copy.
