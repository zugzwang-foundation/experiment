# AUTH-OTP-DELIVERY — plan

> **Status:** PLAN ONLY — awaiting web review + operator ratification. A **fresh chat executes** later.
> **Stratum:** auth critical-path (CLAUDE.md §1) → full ritual (gated plan→execute · writer/reviewer cascade · same-commit ADR · pre-PR self-audit · subagent cascade). **`ultracode` MUST NOT be used** (CLAUDE.md §6 — bypasses the gated cascade).
> **Base:** `origin/main` @ `e887c02` (PR #256, UI-A7 skin). Plan branch: `chore/plan-auth-otp-delivery` (do **not** merge).
> **Scope fence:** the two code fixes below only. The Resend delivery unblock (verified `mail.zugzwangworld.com`, `RESEND_FROM_EMAIL=no-reply@mail.zugzwangworld.com` in Doppler stg+prd) is **operator-owned, done, and OUT of scope.**

---

## 0. Preflight + live-state results

| Check | Expected | Actual | ✓ |
|---|---|---|---|
| Session model | `claude-opus-4-8` | `claude-opus-4-8[1m]` | ✓ |
| `.claude/agents/*` model pins | `claude-opus-4-8` ×4 | `claude-opus-4-8` / `effort: max` ×4 (code-reviewer, db-migration-reviewer, security-auditor, test-writer) | ✓ |
| `origin/main` | `e887c02` | `e887c02` | ✓ |
| `origin/staging` | `e887c02` | `e887c02` | ✓ |
| prod deploy | `a61859a` (staged-not-promoted) | **not git-verifiable** — a Vercel promotion state, operator-owned/out-of-scope; irrelevant to this code-only plan | n/a |
| Migration head | `0024` | `0024_bookmarks` | ✓ |
| `EVENT_TYPES` | 24 | 24 | ✓ |
| Next-free ADR | `0033` | max on disk = `0032-bookmarks`; **`0033` free** | ✓ |

No subagent will die at 0 tool_uses (pins match the session model). Preflight clean.

> **Note on the working branch:** the local `feat/ui-a7` branch (`895ce28`) is the *pre-merge* A7 branch and is **stale** (behind `origin/main`). This plan branch is based on `origin/main` @ `e887c02`, which is the canonical merged A7 tree. All line numbers below are against `e887c02`.

---

## 1. Confirmed current code (against `e887c02`)

### 1.1 The two guards (fix (a) targets)
The kickoff calls `email-otp.ts:~29` "the boot guard." **Drift:** that line is the **send-time backstop**; the real **boot** guard is in `instrumentation.ts`. Both are prod-only + unset-only today, and are the LD-10 "two lines of defense" pair. Fix (a) extends **both**.

- **Boot gate** — `instrumentation.ts:55-59`:
  ```ts
  if (env === "prod" && !process.env.RESEND_FROM_EMAIL) {
      throw new Error('instrumentation.register: RESEND_FROM_EMAIL is required when ZUGZWANG_ENV="prod" — the sandbox fallback sender delivers only to the operator inbox (SCAFFOLD.14 caveat)');
  }
  ```
  Prod-only; rejects **unset only**. `staging` deliberately EXEMPT; `preview`/local/CI never throw.

- **Send-time backstop** — `src/server/auth/email-otp.ts:26-35`:
  ```ts
  const fromEnv = process.env.RESEND_FROM_EMAIL;
  if (!fromEnv && process.env.ZUGZWANG_ENV === "prod") {
      throw new Error("RESEND_FROM_EMAIL not set; refusing the sandbox fallback sender in prod — cannot send verification OTP");
  }
  const resend = new Resend(apiKey);
  const from = fromEnv || "onboarding@resend.dev";   // ← sandbox fallback (:35)
  ```
  Send throw on Resend error at `:44-46` (`if (result.error) throw`).

### 1.2 Plugin wiring — `src/server/auth/index.ts`
- `:305` → `plugins: [emailOTP({ sendVerificationOTP }), zugzwangOtpGate]`.
- `advanced` block `:250-273` sets `database.generateId`, `cookies`, `cookiePrefix` — **no `advanced.backgroundTasks.handler`** (load-bearing — see §2).
- `zugzwangOtpGate` (`before` hook, `matcher: ctx.path === "/email-otp/send-verification-otp"`) reads the `x-turnstile-token` header, throws `turnstile_required`/`turnstile_failed` as `APIError` **before** the send. These `before`-hook throws **do** surface to the client (non-2xx); only the *sender* throw is swallowed (§2).

### 1.3 The two auth pages
- **`src/app/(auth)/sign-in/page.tsx`** — `handleEmailOtp` (`:54-83`). **Drift from kickoff:** the page does **NOT** "navigate regardless." It already guards:
  ```ts
  const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }, { headers: { "x-turnstile-token": turnstileToken } });
  if (error) { setEmailError(error.message ?? "send_failed"); return; }   // ← stops
  router.push(`/sign-in/otp?email=${encodeURIComponent(email)}`);         // ← only on success
  ```
  So the sign-in page is **already correct** *for any error the SDK actually returns.* The gap is that a delivery failure never produces such an error (§2). **No change needed on this page.**
- **`src/app/(auth)/sign-in/otp/page.tsx`** — the optimistic-navigation destination. Verify-only: email input, 6-digit input, Verify button, a `role="alert"` slot (verify errors), a phishing-safety note. **No resend / no "back to sign in" affordance.** This is fix (b)'s surface.

---

## 2. Confirmed Better Auth 1.6.11 behavior + fix-(b) feasibility

Read from installed `node_modules/better-auth@1.6.11`.

**Endpoint** (`dist/plugins/email-otp/routes.mjs:104-109`):
```js
await ctx.context.runInBackgroundOrAwait(opts.sendVerificationOTP({ email, otp, type }, ctx));
return ctx.json({ success: true });
```

**`runInBackgroundOrAwait`** (`dist/context/create-context.mjs:211-221`):
```js
async runInBackgroundOrAwait(promise) {
    try {
        if (options.advanced?.backgroundTasks?.handler) {
            if (promise instanceof Promise) options.advanced.backgroundTasks.handler(promise.catch(e => logger.error(...)));
        } else await promise;                 // ← DEFAULT path (we set no handler)
    } catch (e) { logger.error("Failed to run background task:", e); }   // ← SWALLOWS the throw
}
```

**Net behavior for our config** (no `backgroundTasks.handler` → default branch):
1. The sender **is awaited** — the request *does* block until the send resolves (it is **not** literally fire-before-resolve).
2. **But the sender's throw is structurally swallowed** by the `try/catch` (logged to Better Auth's `logger.error`, **not** re-thrown).
3. The handler therefore **always** returns HTTP 200 `{ success: true }` → the SDK's `{ error }` is `null` on a delivery failure → the client's `if (error)` guard **never fires** → the optimistic `router.push("/sign-in/otp")` happens **even when delivery failed.**

**Feasibility verdict for fix (b):**
- **(b)(i) "await the send so a real failure propagates to the client" — NOT feasible via the standard plugin.** The await already happens; the suppression is **structural** (the `try/catch` + unconditional `ctx.json({ success: true })`). Even an `APIError` thrown from our `sendVerificationOTP` is swallowed. There is no plugin option that makes a *sender* failure produce a non-2xx. (Setting `backgroundTasks.handler` would make it *more* fire-and-forget, the wrong direction.) Reimplementing the send outside the plugin to reclaim synchronous errors is a large architectural change, far out of scope — rejected.
- Note: Turnstile/validation errors DO surface (they throw from the `before` hook, outside the swallow). Only the Resend delivery failure is invisible to the client.
- **⇒ Fix (b) must be (ii): an OTP-screen UX affordance** (defense-in-depth for the structurally-suppressed failure), optionally paired with server-side observability (§4, OQ-2). This is an **honest** design: a resend cannot *confirm* delivery (same swallow→200), it gives the user *agency* to retry / restart.

**Layered story after both fixes:**
- **Config (operator, done):** real verified sender in stg+prd → the sandbox-misconfig class cannot occur in normal operation.
- **Fix (a) boot guard:** any deploy with an unset/sandbox sender **fails fast at cold boot** (health-gate catches it before traffic) → the misconfig class is caught at deploy time, before a participant ever hits it.
- **Fix (b) UX affordance:** for *runtime* send failures (Resend outage / rate-limit / transient) that boot-time can't catch and the client can't see, the participant gets a "didn't get a code? resend / back" recourse instead of being stranded on `/sign-in/otp`.

---

## 3. Fix (a) — extend BOTH guards to reject the sandbox from-address

**Rule (minimal, per kickoff):** in-scope env AND (`unset(from)` OR `isSandbox(from)`) → **throw**. No verified-domain allowlist.

### 3.1 Shared pure helper (new) — `src/server/auth/resend-from.ts`
A single source of the sandbox rule, importable by both guards (DRY across the two lines of defense). **Hard constraints:** zero side-effect imports, **no `server-only`, no `resend`** — pure string parsing so `instrumentation.ts` (boot path, node+edge runtimes) can import it safely.

```ts
// Extract the address from a bare "a@b.com" or a "Name <a@b.com>" RESEND_FROM_EMAIL,
// then true iff its domain is Resend's sandbox (resend.dev or a *.resend.dev subdomain).
export function isSandboxFrom(value: string): boolean {
    const m = value.match(/<([^>]+)>/);
    const addr = (m ? m[1] : value).trim();
    const at = addr.lastIndexOf("@");
    if (at === -1) return false;
    const domain = addr.slice(at + 1).trim().toLowerCase();
    return domain === "resend.dev" || domain.endsWith(".resend.dev");
}
```
Callers keep their existing separate `!from`/empty check; `isSandboxFrom` covers only the sandbox-domain predicate. (OQ-4: confirm the `.resend.dev` subdomain arm.)

> **Fallback if the boot-path import proves problematic:** inline the same parse in `instrumentation.ts` and keep the exported helper for `email-otp.ts`. Prefer the shared module.

### 3.2 Boot gate — `instrumentation.ts:55`
Replace the unset-only predicate with `unset || isSandboxFrom(from)` and update the message to name the sandbox reason. Env scope per **OQ-1**.

### 3.3 Send-time backstop — `email-otp.ts:26-35`
Mirror the same predicate. Under the new rule, an in-scope env never reaches the `|| "onboarding@resend.dev"` fallback (`:35`) with a sandbox value — it throws first; the fallback survives only for exempt (`preview`) envs.

### 3.4 OQ-1 (load-bearing) — env scope of the sandbox-rejection
The operator has now set a **real** sender in **both** stg+prd, and staging is the acceptance-gate rehearsal env — so the original "staging keeps the sandbox sender (parked SCAFFOLD.12 §10.b)" premise is **void** (the flip happened).

- **Recommended — S2 (prod + staging):** both reject `unset || sandbox`; `preview`/local/CI exempt. Makes staging a faithful boot fail-fast rehearsal and directly supports the acceptance gate (operator can trip the boot guard on staging, not first in prod). Requires staging to always have `RESEND_FROM_EMAIL` set — it now does.
- **Conservative fallback — prod-only:** keep env scope exactly as today (staging unchanged, still allows unset→sandbox fallback); add only the sandbox check within the prod branch.

**This is web/operator's call** (relay, per the relay model — no in-CLI `AskUserQuestion`). The test deltas below list both branches.

---

## 4. Fix (b) — OTP-screen recourse affordance (`src/app/(auth)/sign-in/otp/page.tsx`)

Minimal, presentation-layer, on the existing page (within the "minimal error-surface fix (b) requires" fence). No new route, no server change.

- **Resend button** — re-calls `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }, { headers: { "x-turnstile-token": "placeholder-token" } })`. The Turnstile header is **required** (the OTP gate rejects a missing token); reuse the same placeholder the sign-in page uses (Turnstile widget is not wired — AUTH-TURNSTILE-WIRE is a separate task). On `!error` → a subtle "code re-sent" confirmation; on `error` (Turnstile/validation only — **not** delivery, per §2) → the existing `role="alert"` slot. **Honest limitation, stated in a code comment:** a resend re-triggers the send but cannot confirm delivery (plugin returns 200 regardless); it gives the user agency, not delivery detection.
- **"Back to sign in" link** → `/sign-in` (lets a mistyped-email user restart).
- *(Minor option, OQ):* a short resend cooldown (disable N s) to avoid hammering. Default: omit unless web wants it.

**OQ-2 (recommended: YES) — server-side observability.** In `sendVerificationOTP` (`email-otp.ts`), before the `throw` at `:44-46` (and on the network-catch path), `Sentry.captureException` the Resend `result.error`. Rationale: today a delivery failure is only a Better Auth `logger.error` (not wired to Sentry) → **near-invisible to operators**. This is a small, contained addition **beyond the literal ask** — it makes runtime send failures visible without changing client semantics (still 200 to the client). Flag for web accept/reject. Keep the existing `throw` (harmless; preserves the send-time contract).

---

## 5. ADR-0033 call

**Recommendation: YES — a short ADR 0033 is warranted.** It records (1) the load-bearing Better Auth constraint — *send errors are structurally swallowed → the OTP-request endpoint always returns 200*, so a future engineer must **not** try to "fix" the optimistic navigation by awaiting (it won't help); and (2) the ratified error semantics — *OTP-request is optimistic-by-design; delivery failure is surfaced via boot-time fail-fast (a) + UX affordance (b) + optional server observability, NOT via a synchronous client error.*

- Per kickoff, **I do NOT draft the ADR.** Execute **PAUSES at the commit point** for **web-authored rider text**; the ADR lands in the **same commit** as the code (CLAUDE.md §5.12).
- **Fix (a) alone needs no ADR** — it is an in-place extension of the A35 guard.
- If web deems fix (b) a pure UX affordance with no semantics change, it may downgrade to no-ADR — **web's call** (OQ-3).

---

## 6. Test plan (writer-first at execute — `@test-writer`, Phase 2 start)

### 6.1 Fix (a) — helper unit (new) — `tests/unit/auth/resend-from.test.ts`
`isSandboxFrom` truth table: bare `onboarding@resend.dev` → true · `"Zugzwang <onboarding@resend.dev>"` → true · `x@mail.resend.dev` (subdomain) → true · bare `no-reply@mail.zugzwangworld.com` → false · `"Zugzwang <no-reply@mail.zugzwangworld.com>"` → false · `""`/no-`@` → false · case-insensitivity (`ONBOARDING@Resend.DEV` → true).

### 6.2 Fix (a) — boot gate — extend `tests/server/observability/instrumentation-register.test.ts`
Add: prod + bare-sandbox → `register()` rejects `/RESEND_FROM_EMAIL/` · prod + `"Name <sandbox>"` → rejects · prod + real (bare **and** `"Name <email>"`) → resolves (guards against a false-positive on the angle-bracket real address). **If S2:** `staging + sandbox → rejects`; and change `staging-without-from-resolves` → `staging-without-from-rejects`. **If prod-only:** leave the staging cases unchanged.

### 6.3 Fix (a) — send backstop — extend `tests/server/auth/email-otp-from-guard.test.ts`
Add: prod + bare-sandbox → throws + `send not called` · prod + `"Name <sandbox>"` → throws · prod + real `"Name <email>"` → resolves + send called with that `from`. Update the "valid" example from `no-reply@zugzwang.world` to the real `no-reply@mail.zugzwangworld.com` (fidelity; either passes). **If S2:** change `staging-without-from-uses-sandbox-sender` → throws. **If prod-only:** unchanged.

### 6.4 Fix (a) — **the `tests/_setup/env.ts` landmine (required companion edit)**
`env.ts:29` defaults `ZUGZWANG_ENV="prod"` **and** `:15` defaults `RESEND_FROM_EMAIL="onboarding@resend.dev"` (the **sandbox** address). So the **default test env is prod + sandbox** — which the extended guard would now **reject across the whole suite** (any test that boots `register()` or calls `sendVerificationOTP` without overriding `from`). **Required:** change `env.ts:15` default to a **non-sandbox** placeholder (recommend `no-reply@zugzwang.world`, matching the existing "valid" convention). Tests that specifically exercise sandbox behavior set it explicitly; the `staging`/`preview` fallback tests `delete` the var (they test the code's hardcoded `|| "onboarding@resend.dev"`), so they are unaffected by the default change.
- **Audit at execute:** `tests/integration/email-otp-send.integration.test.ts` (inherits the defaults; sends under prod + sandbox-from today → would throw under the extended guard) and any test asserting `from === "onboarding@resend.dev"` **without** deleting the var. Reconcile.
- **Backstop:** run the **full** `pnpm vitest run` (not just the named gate list) — this is exactly the cross-suite env interaction the full-suite gate exists to catch.

### 6.5 Fix (b) — extend `tests/unit/auth/otp-render.test.tsx`
Assert the Resend button + "Back to sign in" link render; clicking Resend calls the SDK send with `{ email, type: "sign-in" }` + the `x-turnstile-token` header; a returned `{ error }` renders in the `role="alert"` slot. **Stated limitation in the test:** it asserts the affordance exists + re-triggers the send, **not** delivery detection (impossible — plugin returns 200 regardless).
- **If OQ-2 adopted:** a unit test that a Resend `result.error` triggers `Sentry.captureException` (mock `@sentry/nextjs`).

### 6.6 Manual staging acceptance gate (NOT automated — the real acceptance)
- **Positive:** staging has the real sender → request OTP → email arrives → complete sign-in.
- **Forced-failure negative:** (i) trip the **boot** guard on staging — set a sandbox/unset `RESEND_FROM_EMAIL` and confirm the deploy fails the `/api/health` gate (exercises fix (a) fail-fast on the acceptance env — an S2 benefit); (ii) induce a **runtime** send failure and confirm fix (b)'s affordance lets the user recover. **Caveat:** the runtime path shows *agency*, not a synchronous delivery error (per §2). Note it; do not automate.

---

## 7. No-DDL confirmation + ritual/gates

- **No schema, no migration, no new event type.** Fix (a) = env-guard string logic + a pure helper; fix (b) = client UX + optional `Sentry.captureException`. Migration head stays `0024`; `EVENT_TYPES` stays 24. **⇒ `@db-migration-reviewer` is WAIVED** (explicitly — nothing under `src/db/schema/` or `drizzle/migrations/`).
- **Execute cascade (separate chat), sequential + directed scope, each passed `@docs/plans/AUTH-OTP-DELIVERY.md`:**
  1. `@test-writer` (Phase 2 start) — the §6 failing tests first.
  2. Implement fix (a) + (b).
  3. `just verify` (with `ZUGZWANG_ENV=preview`) + **full** `pnpm vitest run` (§6.4 backstop) + `pnpm test:integration` for the auth suites.
  4. Pre-PR self-audit (§5.10) item-by-item vs this plan.
  5. `@code-reviewer` (`src/server/` + `instrumentation.ts` diff) → **then** `@security-auditor` (auth critical-path). Not concurrent (avoids PG :54322 saturation; directed per-point re-gate).
  6. **PAUSE at commit** for web-authored **ADR-0033** rider (same-commit).
  7. `gh pr create` → **Gate C** web diff-read before merge.

---

## 8. Scope fence (execute must honor)

- **Byte-identical to HEAD** (do not touch): `src/server/auth/session-gate.ts`, `src/app/api/auth/[...all]/route.ts`, `src/server/auth/tos-accept.ts`, `src/server/auth/onboarding-ref.ts`, and all session logic.
- **`sign-in/page.tsx`:** already correct (§1.3) — **no change** beyond confirming it. **`sign-in/otp/page.tsx`:** only the §4 affordance. No other auth-page work (A7 is closed).
- **Out of scope (sibling A7-ledger tasks):** AUTH-FIRST-LOGIN, AUTH-ERROR-COPY, AUTH-HARDEN (XFF), AUTH-TURNSTILE-WIRE.
- **Doc reconciliation (execute, same-commit — CLAUDE.md closing ritual):** the operator's flip **resolves** `docs/parked.md` "SCAFFOLD.12 §10.b — Resend domain verification + `RESEND_FROM_EMAIL` flip" (lines 12-38) and makes the "staging deliberately EXEMPT / parked SCAFFOLD.12 §10.b" comments in `instrumentation.ts` + `email-otp.ts` **stale** — reconcile these in the fix commit **iff S2 is adopted** (OQ-5). Flag for web.

---

## 9. Files touched at execute (inventory)

| File | Change | Fix |
|---|---|---|
| `src/server/auth/resend-from.ts` | **new** pure `isSandboxFrom` helper | (a) |
| `instrumentation.ts` | boot gate `:55` → `unset \|\| sandbox` (+ env scope per OQ-1) | (a) |
| `src/server/auth/email-otp.ts` | send backstop `:26-35` mirror (+ optional Sentry capture `:44`) | (a)/(b-obs) |
| `src/app/(auth)/sign-in/otp/page.tsx` | Resend + "Back to sign in" affordance | (b) |
| `tests/_setup/env.ts` | `:15` default from → non-sandbox (**required** companion) | (a) |
| `tests/unit/auth/resend-from.test.ts` | **new** helper truth table | (a) |
| `tests/server/observability/instrumentation-register.test.ts` | extend (+S2 staging delta) | (a) |
| `tests/server/auth/email-otp-from-guard.test.ts` | extend (+S2 staging delta) | (a) |
| `tests/unit/auth/otp-render.test.tsx` | extend (affordance render) | (b) |
| `docs/adr/0033-*.md` | **web-authored**, same-commit | (b) |
| `docs/parked.md` + guard comments | reconcile stale flip (iff S2) | doc |

---

## 10. Open questions for web/operator (relay — surface, do not `AskUserQuestion`)

- **OQ-1 (load-bearing):** env scope of the sandbox-rejection — **S2 (prod+staging)** recommended vs prod-only fallback. Drives §3.4 + the §6.2/§6.3 staging test deltas + OQ-5.
- **OQ-2:** adopt the `Sentry.captureException` observability in `sendVerificationOTP`? **Recommend YES** (delivery failures are currently near-invisible).
- **OQ-3:** ADR-0033 — **recommend YES**; web authors rider text at the execute commit-pause. May waive if fix (b) is deemed pure-UX.
- **OQ-4:** `isSandboxFrom` subdomain arm (`=== "resend.dev" || endsWith(".resend.dev")`) — confirm the robust form.
- **OQ-5:** reconcile the now-resolved `docs/parked.md` flip + stale staging-EXEMPT comments in the same commit? **Recommend YES** (closing ritual), gated on OQ-1=S2.
