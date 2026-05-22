# SCAFFOLD.3-FOLLOWUP-1 — Better Auth Content-Type 415 fix + captcha coverage verification

**Promoted plan (post-ratification).** Ratified across plan-review v1 / v2 / v3 + security-auditor v3 pass; PASS verdict with 2 MEDIUM blocking + 2 LOW fold-in + 2 SURPRISE deferred + 1 INFO deferred. The three amendment change-logs below (Amendments 1, 1.1, 1.2) preserve the lineage record of what changed across each plan-review round.

Branch: `feat/scaffold-3-followup-1` off `main` at `7362e46`.

---

## Amendment 1.2 change-log (vs Amendment 1.1, 2026-05-22 third pass)

Seven security-auditor v3 findings landed: 2 MEDIUM blocking, 2 LOW fold-in, 2 SURPRISES deferred, 1 INFO deferred.

Plan-review v3 verdicts:
- **MEDIUM-1** (SDK call shape mis-nest) → **ACCEPTED**. Plan §1 Plan-Q6 + §2 + §3 amended; wire-shape assertion added as 6th test.
- **MEDIUM-2** (TURNSTILE_SECRET_KEY operator-side probe) → **ACCEPTED**. §6 step 3.5 added; §5 exit criterion #10 added as **GATING**.
- **LOW-1** (SDK redirect-follow misleading) → **ACCEPTED**, folded into §2 `sign-in/otp/page.tsx` with explicit detection logic.
- **LOW-2** (`/sign-in/social` returns 200 not 302) → **ACCEPTED**, folded into §5 exit criterion #2 + §6 step 2.
- **LOW-3** (X-Forwarded-For leftmost element) → **DEFERRED as SURPRISE**; new `docs/parked.md` entry (unconditional, fires regardless of S3).
- **INFO-1** (post-hoc `auth.options.hooks.before` mutation comment polish) → **DEFERRED**; §14.6 note only.
- **INFO-2** (first-request CSRF gap on social + email-otp paths) → **DEFERRED as SURPRISE**; new `docs/parked.md` entry (unconditional, fires regardless of S3).

Bookkeeping deltas:
- Total tests in `_probe-content-type-415.test.ts`: 5 → **6** (added wire-shape assertion).
- Total exit criteria in §5: 9 → **10** (added gating Turnstile probe).
- Total `docs/parked.md` entries to ship: 1 conditional (ADR-backfill per S3) + **2 unconditional** (X-Forwarded-For, first-request CSRF).
- Total verdicts in §8: 8 (Q1–Q5-bis + Q6 + Q7); all unchanged.

---

## Amendment 1.1 change-log (vs Amendment 1, 2026-05-22 second pass)

Two plan-review v2 findings landed: one nit fixed, one nit acknowledged.

- **§0 title** — "AMENDMENT 1 (post web-Claude plan-review v1)" → "AMENDMENT 1.1 (post web-Claude plan-review v2)"; "second pass" → "ratification" + post-ratification `security-auditor` invocation noted.
- **§1 Plan-Q5-bis** — "Optional addendum" → "Coupled addendum (ratified INCLUDE)"; removed "execute-time discretion" language per NIT-4.
- **§3 intro prose + 5th test comment** — removed "optional" + "execute-time discretion" framing; reframed as "five assertions total" with breakdown per NIT-4.
- **§5 exit criterion #7** — "all 4 (or 5 if Plan-Q5-bis optional ships) assertions green" → "all 5 assertions green" with explicit breakdown per NIT-4.
- **§8 Plan-Q5-bis row** — "adjudicate; decide on optional 5th boundary-freeze test" → "resolved at plan-review v2: YES + 5th boundary-freeze test ratified INCLUDE."
- **§10 (Plan-mode close-out)** — Amendment 1.1 subsection added; handoff prose updated for ratification-pass framing.

**NIT-5** (§14.5.0 lives under §14 SURPRISES — taxonomy weirdness) **ACKNOWLEDGED but NOT amended**. Flagged for future plans to consider an "Execute-phase pre-checks" top-level section as a cleaner pattern; not worth re-touching v2 for.

Plan-review v2 verdicts:
- NIT-4 (Plan-Q5-bis framing self-contradiction) → ACCEPTED, applied across §0 title + §1 + §3 + §5 + §8 + §10.
- NIT-5 (§14.5.0 taxonomy) → ACKNOWLEDGED, NOT applied.

---

## Amendment 1 change-log (vs original draft 2026-05-21)

Six findings landed at plan-review v1; three blocking, three nits.

- **§0.2 (S3)** — reframed to flag execute-phase confirmation step (run `find` to re-verify ADR absence) + conditional `docs/parked.md` entry per NIT-1.
- **§1** — inserted **Plan-Q5-bis** (endpoint correction `/email-otp/verify-email` → `/sign-in/email-otp`) between Plan-Q5 and Plan-Q6 per BLOCKING-2. Reframed from "side benefit" wording.
- **§2 `sign-in/page.tsx`** — hidden-input retention + `x-turnstile-token` header-value flow made explicit per NIT-3.
- **§2 `sign-in/otp/page.tsx`** — endpoint correction now flagged as a Plan-Q5-bis explicit verdict rather than a side benefit per BLOCKING-2.
- **§3** — added **test #4** (TDD success-path) per BLOCKING-3. Added **optional test #5** (boundary-freeze for `/email-otp/verify-email`) per Plan-Q5-bis addendum. Corrected "two assertions" → "three regression-guard + one TDD success-path + optional fourth boundary-freeze."
- **§4** — `NONE` → **conditional** `docs/parked.md` edit (ADR backfill entry) per NIT-1.
- **§5** — reframed TDD driver per NIT-2: success-path test (#4) drives the fix; the four 415-rejection tests are regression-guards per MAINT.7 lineage, not TDD drivers.
- **§8** — added Plan-Q5-bis row to open-questions table.
- **§14.5** — added **execute-phase pre-check** at top — verify Better Auth email-OTP plugin Zod schema mode (`.strict()` vs `.strip()`) per BLOCKING-1. Verdict (Q6 HEADER) does not change either way.
- **§10 (Plan-mode close-out)** — amendment summary added; bookkeeping updated to reflect 7 → 8 questions, S5 reframed.

Plan-review verdict on each finding:
- BLOCKING-1 (Q6 Zod schema verification gate) → ACCEPTED, added to §14.5.
- BLOCKING-2 (Q5-bis explicit verdict on endpoint correction) → ACCEPTED, added as §1.Plan-Q5-bis.
- BLOCKING-3 (success-path test) → ACCEPTED, added as §3 test #4.
- NIT-1 (S3 parked-item entry) → ACCEPTED, conditional execute-phase action.
- NIT-2 (test-writer gate framing) → ACCEPTED, reframed §5.
- NIT-3 (Q7 sub-question hidden-input retention) → ACCEPTED, made explicit in §2.

---

## §0 Pre-flight — step-1 findings + diagnosis ratification

### §0.1 Findings table (verified by direct file reads, this session)

| Item | Finding | Evidence |
|---|---|---|
| Captcha config state | **(iii)** Hand-rolled `hooks.before` matcher in custom `zugzwangOtpGate` plugin, matched ONLY to `/email-otp/send-verification-otp`. Spec text already matches code. | `src/server/auth/index.ts:112-178` (matcher + handler + plugin wiring + post-hoc options.hooks mutation) |
| Form file paths | `src/app/(auth)/sign-in/page.tsx` (Google OAuth + Email-OTP-send, 2 forms) **AND** `src/app/(auth)/sign-in/otp/page.tsx` (Email-OTP-verify, 1 form, third 415 surface not named in kickoff) | `src/app/(auth)/sign-in/page.tsx:18,31`; `src/app/(auth)/sign-in/otp/page.tsx:9` |
| Form shape | Server components, native `<form action="/api/auth/…" method="post">` on **all three** forms. Page.tsx:13-14 comment already anticipates the SDK fix: "form POSTs JSON via Better Auth's client wrapper in production. Placeholder simple form here." | All three form definitions |
| Turnstile widget render state | **Not rendered.** Hidden `<input name="turnstileToken" value="placeholder-token" />` (page.tsx:37-41). Placeholder fails siteverify post-415-fix → 400 `turnstile_failed`, not 200. | page.tsx:37-41 |
| `authClient` instance state | **MISSING entirely.** `src/lib/auth-client.ts` does not exist; `src/lib/` only contains `utils.ts`. NEW file required. | `src/lib/` ls |
| `better-auth` literal version pin | `1.6.11` (latest with GHSA-xr8f-h2gw-9xh6 fix) | `package.json:14` |
| Handler mount shape | Custom `handleAuth(request)` wrapper around `auth.handler(request)` — intercepts 403 `ONBOARDING_REQUIRED` and rewrites to 302 + signed cookie. Catch-all GET + POST. **Must not regress.** | `src/app/api/auth/[...all]/route.ts:21-66` |
| Better Auth subpath exports | `better-auth/react` (line 47 of exports) + `better-auth/client/plugins` (line 22) both available. `emailOTPClient` exported from `better-auth/client/plugins` per `dist/client/plugins/index.d.mts:40,56`. | `node_modules/better-auth/package.json` exports |
| Existing `_probe-*` precedent | `tests/server/auth/_probe-apierror-body-survival.test.ts` uses `betterAuth({…})` + `memoryAdapter` + synthetic `Request` + `probe.handler(request)` + status/body assertions. Exact shape for new contract test. | `tests/server/auth/_probe-apierror-body-survival.test.ts:33-80` |

### §0.2 Surprises surfaced during step-1 reading

- **S1.** `sign-in/otp/page.tsx` has the same 415 bug on `/api/auth/email-otp/verify-email`. Kickoff named only `/sign-in/social` and `/email-otp/send-verification-otp`. **Drives Q5.**
- **S2.** `src/lib/auth-client.ts` does NOT exist; kickoff step-1 said "confirm it exists" — it does not. **NEW file required.**
- **S3 (AMENDED per NIT-1).** `docs/adr/0004-better-auth.md` does NOT exist on disk per plan-time `ls docs/adr/` (only `0001-license-choice.md` checked in). SPEC.2 + CLAUDE.md reference ADR-0004 §1, §4, §18.2 + ADR-0010, ADR-0014, ADR-0015, ADR-0016 extensively. **Execute-phase action:** re-confirm via `find . -name "0004-better-auth*" -not -path "./node_modules/*"`. If confirmed absent, ship a new parked-item entry in `docs/parked.md` per the wording in plan-review NIT-1 (see §4 below). If the find surfaces a present file (initial grep missed it), drop S3 and the conditional §4 doc-change.
- **S4.** Hand-rolled hook reads `turnstileToken` from `ctx.body` (index.ts:116-119), not from `x-captcha-response` header (Cloudflare convention). **Drives Q6.**
- **S5 (REFRAMED per BLOCKING-2).** `sign-in/otp/page.tsx` form posts to `/email-otp/verify-email` — the email-verification endpoint (sets `emailVerified: true` on existing user), **NOT** the OTP sign-in endpoint (`/sign-in/email-otp`). This is a SCAFFOLD.3 implementation bug, not a "side benefit" to clean up incidentally. Promoted to its own verdict at **Plan-Q5-bis** in §1 below.
- **S6.** SPEC.2 §8.2 line 816 wording (`hooks.before` middleware on `/email-otp/send-verification-otp`) **already matches** the hand-rolled implementation. The web-Claude-side spec-correction hypothesis assumed official `captcha` plugin (which uses `onRequest`). **No spec correction needed → Plan-Q4 drops.**

### §0.3 Diagnosis ratification (kickoff §Pre-plan diagnostic context items 1-8)

All 8 research-derived facts in the kickoff stand against the code we read:

1. ✅ 415 is `better-call`-emitted, not Next/Vercel. (Reproduces identically in any environment hitting `auth.handler(request)`.)
2. ✅ `better-call` JSON-only enforcement is router-level, pre-plugin-hook. Our hand-rolled hook never fires for form-encoded POSTs — confirmed by the §7.3 production behaviour (415 returned with NO Resend dispatch, NO Turnstile siteverify hit).
3. ✅ Form-data widening (Better Auth v1.5) covers `/sign-in/email` + `/sign-up/email` only. We use neither — we use `/sign-in/social` (Google) and `/email-otp/*`.
4. ✅ Canonical fix is `authClient.*` SDK from `better-auth/react`. Confirmed `./react` + `./client/plugins` subpaths exist in v1.6.11.
5. ✅ `x-captcha-response` header is the canonical Cloudflare transport — **but** our hand-rolled hook currently reads from body. See Q6.
6. ✅ `onRequest` runs before 415 check; `hooks.before` runs after. Our hand-rolled hook is `hooks.before`, so even with SDK fix, the 415 path is the gate that opens (correct behavior).
7. ✅ Official captcha plugin's default `endpoints` list excludes our paths — but moot for us since we don't use the official plugin (finding iii).
8. ✅ No v1.6.x knob relaxes JSON-only for our endpoints. SDK migration is the only viable fix.

---

## §1 Decisions — verdicts on Q1–Q7 + Q5-bis (recommended; plan-review confirms or overrides)

### Plan-Q1 — Captcha coverage finding
**Verdict: (iii) hand-rolled `hooks.before` plugin.** No code change needed for captcha config itself. The plugin already covers `/email-otp/send-verification-otp` exclusively (correct per F-AUTH-1 design).

### Plan-Q2 — Should `endpoints` also include `/sign-in/social`?
**Verdict: NO.** SPEC.1 §13 F-AUTH-1 line 616 is explicit: "**No CAPTCHA gate** (Google's own abuse signals replace it)." Adding `/sign-in/social` to the matcher would be a SPEC.1 amendment, not a fix. The Plan-Q2 web-Claude recommendation ("include both") contradicts SPEC.1; override.

Side benefit: keeping `/sign-in/social` outside the matcher means a Cloudflare outage does not take BOTH auth paths down (the rationale already baked into the matcher's exclusivity).

### Plan-Q3 — Contract test naming
**Verdict: single file with multiple assertions** — `tests/server/auth/_probe-content-type-415.test.ts`. Web-Claude recommendation matches. Smaller surface area than per-endpoint files; same coverage. Pattern matches existing `_probe-apierror-body-survival.test.ts` precedent.

### Plan-Q4 — Spec correction (SPEC.2 §8.2 + ADR-0004 §4/§18.2 framing)
**Verdict: DROP from PR scope.** SPEC.2 §8.2 line 816 wording — "Wired via `hooks.before` middleware" — already accurately describes the hand-rolled `zugzwangOtpGate` plugin's matcher. The web-Claude hypothesis (that `onRequest` was the correct framing) was contingent on Finding (i)/(ii) (official captcha plugin). With Finding (iii), the spec matches the code. No correction.

ADR-0004 file does not exist on disk (S3) — surfaced separately at §4 below as conditional `docs/parked.md` edit per NIT-1.

### Plan-Q5 (NEW) — Include `sign-in/otp/page.tsx` 415 fix?
**Verdict: YES, include in this PR.**

Rationale:
- The kickoff scope is "ALL POST endpoints from the SCAFFOLD.3 sign-in form" (per chat_close_2026-05-21_SCAFFOLD_12_full.md §7.2/§7.3 broadening). The verify form is part of the same SCAFFOLD.3 sign-in surface.
- Fixing only the send-OTP form leaves a half-broken flow: user enters email → receives OTP email (post-fix + post-Turnstile-token) → goes to `/sign-in/otp` → submits OTP → 415 → flow halts.
- §7.3 acceptance criterion ("Email-OTP completes end-to-end") cannot pass without both forms fixed.

Cost: +1 file modified (sign-in/otp/page.tsx). +1 contract-test assertion. Total LOC delta probably <40 lines vs Q5=NO.

(The endpoint correction `/email-otp/verify-email` → `/sign-in/email-otp` is a SEPARATE verdict at Plan-Q5-bis below, not a "side benefit" of Q5.)

### Plan-Q5-bis (NEW — per plan-review BLOCKING-2) — Endpoint correction (`/email-otp/verify-email` → `/sign-in/email-otp`)
**Verdict: YES, ship in this PR.**

Rationale:
- SPEC.1 §13 F-AUTH-2 contract demands `/sign-in/email-otp`: "user submits the OTP within the TTL. On valid OTP, server matches the email against the `users` table. Match found → issue session cookie." The session-issuing semantics live at `/sign-in/email-otp`, not `/email-otp/verify-email`.
- The current `/email-otp/verify-email` wiring was a SCAFFOLD.3 implementation bug, never exercised successfully in production due to the 415 short-circuit (all attempts 415'd before reaching the handler).
- Risk surface: **nil.** No production user has ever completed an `/email-otp/verify-email` POST against the SCAFFOLD.3 form. No tests currently assert the wrong-endpoint behavior. No downstream code path depends on `emailVerified: true` being set as a side effect of OTP-verify (the `users` row's `email_verified` flag is set at `users` table INSERT during F-AUTH-2 per SPEC.2 §8.2; OTP-verify does not need to mutate it).

This is a behavioral change (different endpoint → different state-machine effects: session-issuing instead of email-verification side-effect), not a syntactic cleanup. Deserves its own verdict per BLOCKING-2.

**Coupled addendum (ratified INCLUDE per plan-review v2 NIT-4):** add a 5th contract-test assertion to `_probe-content-type-415.test.ts` that POSTs form-encoded to `/email-otp/verify-email` and asserts 415 — freezes the boundary so a future regression cannot silently swap the endpoints back. ~15 LOC; the boundary-freeze value compounds across time. Ships unconditionally in §3 (was an "execute-time discretion" item at plan-review v1; closed at v2 since §3 already had the test inline).

### Plan-Q6 (NEW) — Turnstile token transport: body or header?
**Verdict: HEADER (`x-turnstile-token`).**

Rationale:
- Cleaner intent separation: captcha is a transport-layer gate, not a body field.
- Enables the typed SDK call `authClient.emailOtp.sendVerificationOtp({email, type: 'sign-in'}, { headers: {'x-turnstile-token': token} })`. **Note (per Amendment 1.2 / security-auditor v3 MEDIUM-1):** Correct shape per Better Auth v1.6.x SDK contract (`node_modules/better-auth/dist/client/path-to-object.d.mts:42-54`). The second positional arg IS `FetchOptions` directly — do NOT wrap in `{ fetchOptions: ... }`. Form B (single-arg with `fetchOptions` key) is equivalent: `authClient.emailOtp.sendVerificationOtp({email, type: 'sign-in', fetchOptions: { headers: {'x-turnstile-token': token} }})`. Form A (shown first) recommended for cleaner separation between body and transport. The typed schema for the email-OTP send endpoint does NOT accept `turnstileToken` — **the actual Zod-schema-mode (strict vs strip) is execute-phase-verified per §14.5.0 pre-check**. If `.strict()`, body route is impossible (typed call would reject the extra field); if `.strip()`, body route is possible but the field would be silently dropped, defeating the purpose. Header is the only ergonomic transport either way.
- Aligns with Cloudflare's `x-captcha-response` convention. Using `x-turnstile-token` (not `x-captcha-response`) keeps namespace project-specific and avoids collision if we ever add the official captcha plugin alongside.
- Cost: 1 hook handler change (index.ts:115-128, ~5 LOC), 5 test updates (otp.test.ts: synthetic ctx headers instead of body field). All in scope already.

Body-route alternative would require `authClient.$fetch("/email-otp/send-verification-otp", { method: 'POST', body: {…} })` — bypasses the typed shortcut. Smaller hook change but worse SDK ergonomics and divergent call shape vs sign-in/social.

**Verdict does not change based on the §14.5.0 pre-check outcome** per plan-review BLOCKING-1; cleaner intent separation justifies header transport regardless of schema mode.

### Plan-Q7 (NEW) — Real Turnstile widget rendering vs accepting 400 `turnstile_failed`
**Verdict: DEFER widget rendering to a separate task (or to DESIGN.* sign-in page rewrite).** This PR's exit criterion accepts `400 turnstile_failed` as a SUCCESS — proves the routing + content-type + hook chain works.

Rationale:
- The kickoff exit criterion already includes "HTTP 200 (or **400 if the Turnstile token is malformed**, or 429 for rate-limit) — never 415." 400 is acceptable.
- Real widget rendering needs: new dep (`@marsidev/react-turnstile` or equivalent), env var `TURNSTILE_SITE_KEY` (only `TURNSTILE_SECRET_KEY` is wired currently), design layout for the widget — significant scope expansion.
- Operator-side §7.3 acceptance for THIS PR is "no 415, see 400 `turnstile_failed`" — the Email-OTP "end-to-end" assertion remains blocked until widget renders. Update §7.3 expectation accordingly.
- Cloudflare-test-key alternative (`1x0000…AA`) introduces dev/prod env divergence; rejected.

**Sub-verdict (per NIT-3, now explicit in §2):** KEEP the placeholder hidden `<input name="turnstileToken" value="placeholder-token" />`. Anchor for the future widget mount; minimizes diff. The `onSubmit` handler reads it from form data and passes it as the `x-turnstile-token` header value on the SDK call.

---

## §2 Code changes — file-by-file

### New file: `src/lib/auth-client.ts`

```ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // baseURL omitted — defaults to current origin, matching Better Auth's
  // catch-all mount at /api/auth/[...all].
  plugins: [emailOTPClient()],
});
```

Conventions checked:
- `better-auth/react` exists per `node_modules/better-auth/package.json` exports.
- `emailOTPClient` exported from `better-auth/client/plugins` per `node_modules/better-auth/dist/client/plugins/index.d.mts:56`.
- Named export only (AGENTS.md §4).
- No `'use client'` — `auth-client.ts` is a module, not a component; it's imported by client components which carry the `'use client'` directive.

### Modified: `src/app/(auth)/sign-in/page.tsx`

Convert to `'use client'` component. Both forms become `onSubmit` handlers:

- **Google form** → `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`. SDK handles the 302 → Google → callback navigation transparently.
- **Email-OTP-send form** → `authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }, { headers: { 'x-turnstile-token': turnstileToken } })`. **Note (per Amendment 1.2 / MEDIUM-1):** Correct SDK call shape per Better Auth v1.6.x — second positional arg is `FetchOptions` directly; do NOT wrap in `{ fetchOptions: ... }`. On success, navigate to `/sign-in/otp` (preserving email via query string or sessionStorage — execute-time decision).

**Hidden `<input name="turnstileToken" value="placeholder-token" />` retained** per Plan-Q7 sub-verdict (anchor for future widget mount; minimizes diff). The `onSubmit` handler reads it from form data via `event.currentTarget.elements` (or `FormData(event.currentTarget)`) and passes the value as the `x-turnstile-token` HEADER on the SDK call — NOT as a body field. This is the entirety of the body→header transport handoff for Q6.

State management:
- `useState` for email + turnstileToken inputs (controlled) OR uncontrolled via `event.currentTarget.elements`. Recommend uncontrolled — smaller diff, no extra state.
- `useState` for error/loading state per form.
- No `useFormState` / `useActionState` — the SDK call is the mutation, not a server action.

Visual treatment stays placeholder per DESIGN.* deferral (comments preserve the existing `TODO(DESIGN.*)` markers).

### Modified: `src/app/(auth)/sign-in/otp/page.tsx`

Convert to `'use client'` component. Form becomes `onSubmit` handler.

**Two coupled changes per Plan-Q5 + Plan-Q5-bis:**

1. **415 fix (Plan-Q5):** convert native form to `onSubmit` calling the SDK.
2. **Endpoint correction (Plan-Q5-bis):** the SDK call is `authClient.signIn.emailOtp({ email, otp })` which POSTs to `/api/auth/sign-in/email-otp` (session-issuing). **NOT** `authClient.emailOtp.verifyEmail` which posts to `/api/auth/email-otp/verify-email` (email-verification side-effect only). SPEC.1 §13 F-AUTH-2 contract demands session-issuing semantics.

On success: the catch-all wrapper at `src/app/api/auth/[...all]/route.ts` intercepts `session.create.before` `ONBOARDING_REQUIRED` and sends a 302 + cookie to `/onboarding`; SDK follows the redirect automatically. On a non-onboarding session, navigate to `/`.

On failure: surface `otp_invalid` / `otp_expired` / `otp_rate_limited` error messages (placeholder text, design treatment deferred).

Email passed via query string from `/sign-in/page.tsx`'s send-success navigation (e.g., `router.push('/sign-in/otp?email=' + encodeURIComponent(email))`). Read via `useSearchParams()`.

**Onboarding redirect detection (per Amendment 1.2 / security-auditor v3 LOW-1):**

The `handleAuth` catch-all wrapper at `src/app/api/auth/[...all]/route.ts:21-66` returns HTTP 302 + `onboarding_ref` cookie when `session.create.before` throws `ONBOARDING_REQUIRED`. The SDK's `better-fetch` follows the 302 to `/onboarding` automatically (default `redirect: 'follow'`) — but the SDK consumer sees the GET response body (HTML), NOT a structured "you need to onboard" signal. Without explicit handling, the UI strands the user on `/sign-in/otp` with a confusing SDK error.

Detection logic in the `onSubmit` handler:

```ts
const { data, error, response } = await authClient.signIn.emailOtp(
  { email, otp },
);
// Detect ONBOARDING_REQUIRED via the followed-redirect URL.
if (response?.url?.endsWith("/onboarding")) {
  router.push("/onboarding");
  return;
}
if (error) {
  // Real OTP error (otp_invalid / otp_expired / otp_rate_limited)
  setError(error.message);
  return;
}
// Successful direct session (returning user, no onboarding needed)
router.push("/");
```

**Execute-phase investigation:** confirm `response.url` is accessible via the Better Auth SDK return shape, OR use the `onboarding_ref` cookie presence as a secondary signal (`document.cookie.includes('onboarding_ref')`). Log as a §14.4 SURPRISE if the SDK does not expose `response.url` in a usable way — a fallback detection mechanism (cookie sniffing, or wrapper-side change to return 403 JSON instead of 302) becomes required. The wrapper-change option is out-of-scope for this PR (breaks the existing native-form contract); cookie sniffing is the minimum-diff fallback.

### Modified: `src/server/auth/index.ts`

Per Q6 verdict — change the hand-rolled hook to read `turnstileToken` from the request header `x-turnstile-token` (instead of `ctx.body.turnstileToken`).

Specific change: in `otpGateBeforeHooks[0].handler` (lines 115-128):

```ts
// BEFORE
const body = (ctx.body ?? {}) as { email?: string; turnstileToken?: string };
…
if (!body.turnstileToken) {
  throw new APIError("BAD_REQUEST", { message: "turnstile_required" });
}
const ok = await verifyTurnstile(body.turnstileToken, ip);

// AFTER
const body = (ctx.body ?? {}) as { email?: string };
const headers = ctx.request?.headers ?? ctx.headers;
const turnstileToken = headers?.get("x-turnstile-token") ?? "";
if (!turnstileToken) {
  throw new APIError("BAD_REQUEST", { message: "turnstile_required" });
}
const ok = await verifyTurnstile(turnstileToken, ip);
```

The `HookCtx` type at line 66-71 needs the `turnstileToken` field removed from the body union (cosmetic; runtime ignores type-only changes).

### New file: `tests/server/auth/_probe-content-type-415.test.ts`

Contract regression test + TDD success-path test — see §3.

### NO changes to: `src/app/api/auth/[...all]/route.ts`

The `handleAuth` wrapper at route.ts:21-66 is unchanged. The 403 ONBOARDING_REQUIRED interception logic is orthogonal to the 415 fix. (Confirmed: the SDK calls go through `auth.handler(request)` like any other request; the wrapper sees the post-handler response, not the input content-type.)

### NO changes to: `src/server/auth/email-otp.ts`

The Resend `sendVerificationOTP` callback is unaffected.

### Summary of file touches
- **NEW:** `src/lib/auth-client.ts`, `tests/server/auth/_probe-content-type-415.test.ts` (2 files)
- **MODIFIED:** `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/otp/page.tsx`, `src/server/auth/index.ts`, `tests/server/auth/otp.test.ts` (4 files)
- **CONDITIONAL (per S3 + NIT-1):** `docs/parked.md` (1 file, if `find` re-confirms ADR-0004 absence)
- **TOTAL:** 6 required + 1 conditional. Estimated diff: ~170 lines added, ~40 lines removed.

---

## §3 Test changes

### `tests/server/auth/_probe-content-type-415.test.ts` (NEW)

Modeled on `_probe-apierror-body-survival.test.ts`. **Six assertions total:** three regression-guards (lock current 415-rejection behavior on `/sign-in/social`, `/email-otp/send-verification-otp`, `/sign-in/email-otp`) + one boundary-freeze (`/email-otp/verify-email` per Plan-Q5-bis coupled addendum, ratified INCLUDE per plan-review v2 NIT-4) + one TDD success-path **route-handler** assertion (drives the fix per BLOCKING-3) + **one TDD success-path wire-shape assertion** (drives the SDK-call-correctness gate per Amendment 1.2 / security-auditor v3 MEDIUM-1).

```ts
import { describe, expect, it, vi } from "vitest";
import { auth } from "@/server/auth/index";
import { authClient } from "@/lib/auth-client";

describe("Better Auth Content-Type 415 contract probe", () => {
  // === Regression guards (assert current 415-rejection behavior) =============
  // These tests PASS against `main` (pre-fix) AND against the merged PR. They
  // exist to catch (a) regressions where someone re-adds a native form, and
  // (b) better-auth upgrade surprises where JSON-only enforcement is relaxed.

  it("415::sign-in-social-rejects-form-encoded-post", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "provider=google",
      },
    );
    const response = await auth.handler(request);
    expect(response.status).toBe(415);
  });

  it("415::email-otp-send-rejects-form-encoded-post", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=test%40example.com&turnstileToken=placeholder-token",
      },
    );
    const response = await auth.handler(request);
    expect(response.status).toBe(415);
  });

  it("415::sign-in-email-otp-rejects-form-encoded-post", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/email-otp",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=test%40example.com&otp=123456",
      },
    );
    const response = await auth.handler(request);
    expect(response.status).toBe(415);
  });

  // === 5th assertion (Plan-Q5-bis boundary-freeze, ratified INCLUDE) ========
  // Freezes the boundary: a future regression cannot silently swap
  // /sign-in/email-otp back to /email-otp/verify-email without test failure.
  // Ships unconditionally per plan-review v2 NIT-4.

  it("415::email-otp-verify-email-rejects-form-encoded-post", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/email-otp/verify-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=test%40example.com&otp=123456",
      },
    );
    const response = await auth.handler(request);
    expect(response.status).toBe(415);
  });

  // === TDD success-path assertion (BLOCKING-3 — drives the fix) =============
  // Written FAILING-first against `main` (current form-encoded behavior →
  // 415 → test fails). Passes only after the SDK migration + Q6 header
  // change land. The 415-rejection tests above lock current router
  // behavior; THIS test proves the new transport works end-to-end.

  it("200-or-400-not-415::email-otp-send-accepts-json-with-header-token", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-turnstile-token": "placeholder-token",
        },
        body: JSON.stringify({ email: "test@example.com", type: "sign-in" }),
      },
    );
    const response = await auth.handler(request);
    // Primary assertion: the 415 path no longer fires for properly-shaped
    // JSON. This is what the PR delivers.
    expect(response.status).not.toBe(415);
    // Informational range — depends on test-env Turnstile behavior:
    //   - 200 if verifyTurnstile is mocked/disabled in test env
    //   - 400 if siteverify hits real Cloudflare and rejects placeholder
    //         (or if TURNSTILE_SECRET_KEY unset → fail-CLOSED returns 400)
    //   - 500 if downstream handler errors unexpectedly (would be a bug)
    expect([200, 400, 500]).toContain(response.status);
  });

  // === 6th assertion (wire-shape TDD, per Amendment 1.2 / MEDIUM-1) =========
  // Per security-auditor v3 MEDIUM-1: the route-handler success-path test
  // above sends a hand-built Request directly to auth.handler(), bypassing
  // the SDK entirely. That means a mis-shaped SDK call (e.g., second-arg
  // `{ fetchOptions: { headers: ... } }` double-nest) would PASS the
  // 200-or-400-not-415 test but BREAK in production — the header would
  // never reach the wire. This test imports the actual authClient, spies
  // on global fetch, calls the SDK, and asserts the emitted request
  // carries the x-turnstile-token header + Content-Type: application/json.
  // FAILS if the SDK call shape in src/app/(auth)/sign-in/page.tsx is wrong.

  it("wire-shape::sdk-emits-x-turnstile-token-header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await authClient.emailOtp.sendVerificationOtp(
        { email: "wire-shape@example.com", type: "sign-in" },
        { headers: { "x-turnstile-token": "probe-token" } },
      );
    } catch {
      // Mocked response shape may not satisfy SDK parsing; we only care
      // about the request emitted, not the response handling.
    }

    expect(fetchSpy).toHaveBeenCalled();
    const [reqArg, initArg] = fetchSpy.mock.calls[0] ?? [];
    // Headers can be on init.headers OR on a Request object's headers,
    // depending on better-fetch's calling convention.
    const rawHeaders =
      reqArg instanceof Request
        ? reqArg.headers
        : (initArg as RequestInit | undefined)?.headers;
    const headers =
      rawHeaders instanceof Headers
        ? rawHeaders
        : new Headers((rawHeaders as Record<string, string> | undefined) ?? {});

    expect(headers.get("x-turnstile-token")).toBe("probe-token");
    expect(headers.get("content-type")).toContain("application/json");

    fetchSpy.mockRestore();
  });
});
```

This freezes the contract end-to-end: the 415-rejection tests catch a router-level upgrade surprise; the success-path test catches a fix regression (someone reverts auth-client.ts or hook header-read).

Why use the actual `auth` instance (not a probe instance like `_probe-apierror-body-survival.test.ts`): we want the test to fail if a future upgrade or config change adjusts the project's specific auth wiring. A probe instance would test a generic Better Auth, missing project-specific config changes.

### `tests/server/auth/otp.test.ts` (MODIFIED)

Per Q6 verdict — token is now read from headers. Update synthetic ctx in 5 tests:
- `otp::turnstile-pass-allows-otp-send` (line 187-195): move `turnstileToken: 'test-token-passing'` from `body` to `request.headers` (`'x-turnstile-token': 'test-token-passing'`).
- `otp::turnstile-fail-rejects-otp-send` (line 237-244): same move with `'test-token-failing'`.
- `otp::turnstile-unavailable-fails-closed` (line 280-287): same move with `'anything'`.
- `otp::rate-limit-per-email-rejects-when-exceeded` (line 327-334): same move with `'test-token-passing'`.
- `otp::rate-limit-per-ip-burst-rejects-when-exceeded` (line 381-388): same move with `'test-token-passing'`.

Total: 5 test mutations in one file, each ~3 lines. Test assertions unchanged.

### NO changes to: other test files

`google.test.ts`, `logout.test.ts`, `session-gate.test.ts`, `tos.test.ts`, etc. — untouched.

---

## §4 Doc changes

### Default: NONE (per Q4 verdict).

SPEC.2 §8.2 + §18.2 wording already matches the hand-rolled implementation. No spec correction needed.

### Conditional: `docs/parked.md` (per S3 + plan-review NIT-1).

**Execute-phase action:** run

```
find . -name "0004-better-auth*" -not -path "./node_modules/*"
```

- **If output is empty** (ADR-0004 confirmed absent from disk): add a new section to `docs/parked.md` per the exact wording in plan-review NIT-1:

  > **ADR backfill — 0004 through 0016 missing from disk (per SCAFFOLD.3-FOLLOWUP-1 §0.2 S3)**
  >
  > **Originating task:** SCAFFOLD.3-FOLLOWUP-1 §0 step-1 audit.
  >
  > **Deferred work:** backfill ADRs 0004 (Better Auth), 0010 (admin auth), 0014 (no HTTP-in-transaction), 0015 (rate-limit/idempotency), 0016 (UUIDv7 IDs), and any other ADR referenced by SPEC.1/SPEC.2 but missing from `docs/adr/`.
  >
  > **Why deferred:** scope creep. FOLLOWUP-1 is a code fix, not an ADR backfill task.
  >
  > **Conditional trigger:** next task that touches a domain governed by a missing ADR.

  (Confirm exact final wording of the broader list — "and any other ADR referenced…" — by `grep -nE "ADR-00[0-9]{2}" docs/specs/SPEC.{1,2}.md docs/CLAUDE.md` at execute-time and listing the actual missing IDs explicitly.)

- **If output is non-empty** (the file exists, initial plan-time grep missed it): drop S3 from §0.2, drop the conditional doc change here. No parked-item entry.

### Unconditional: 2 new `docs/parked.md` entries (per Amendment 1.2 / security-auditor v3 SURPRISES — fire regardless of S3 outcome)

**Entry 1 — IP-extraction trust chain (per LOW-3 deferred):**

> **IP-extraction trust chain — `X-Forwarded-For` leftmost-element issue (per SCAFFOLD.3-FOLLOWUP-1 security-auditor v3 SURPRISE-1)**
>
> **Originating task:** SCAFFOLD.3-FOLLOWUP-1 security-auditor pass (Amendment 1.2 transition).
>
> **Deferred work:** `src/server/auth/index.ts:104-110` (`ipFromCtx`) takes `X-Forwarded-For.split(",")[0]` which is the LEFTMOST element — attacker-controlled when chained. Defeats per-IP rate-limit `otpRequestPerIpBurst` AND pollutes Cloudflare siteverify `remoteip` field. Switch to Vercel-canonical `x-real-ip` or `request.ip` per Next.js runtime; rightmost X-Forwarded-For element is the trustworthy one in Vercel's edge.
>
> **Why deferred:** pre-existing surface, not touched by FOLLOWUP-1's Q6 change. Symmetric to the change so the SDK migration does not amplify the risk.
>
> **Conditional trigger:** HARDEN.* pre-launch security pass, OR first observed abuse pattern hitting the per-IP rate-limit.

**Entry 2 — First-request CSRF gap (per INFO-2 deferred):**

> **First-request CSRF gap on `/sign-in/social` + `/sign-in/email-otp` + `/email-otp/send-verification-otp` (per SCAFFOLD.3-FOLLOWUP-1 security-auditor v3 SURPRISE-2)**
>
> **Originating task:** SCAFFOLD.3-FOLLOWUP-1 security-auditor pass (Amendment 1.2 transition).
>
> **Deferred work:** Better Auth's `originCheckMiddleware` only validates origin when cookies are present. First-time (cookie-less) requests to `/sign-in/social`, `/sign-in/email-otp`, and `/email-otp/send-verification-otp` are reachable cross-origin without Sec-Fetch CSRF protection. Threat-model fit: low — initiating a Google OAuth flow cross-origin still requires victim consent at Google's UI; can't auto-complete sign-in. Email-OTP cross-origin send is rate-limited per-IP/per-email.
>
> **Why deferred:** pre-existing Better Auth design choice, not introduced by FOLLOWUP-1. Threat-model fit is low.
>
> **Mitigation candidates:** (a) ask Better Auth maintainers for `formCsrfMiddleware` on social + email-otp paths, OR (b) implement repo-side `Sec-Fetch-Site` check at the catch-all wrapper (`src/app/api/auth/[...all]/route.ts:21-66` is the right hook point).
>
> **Conditional trigger:** HARDEN.* pre-launch security pass.

Both entries fire UNCONDITIONALLY at execute-phase (independent of S3's ADR-0004 confirmation). The conditional ADR-backfill entry above + these 2 unconditional entries = 3 potential parked.md additions, of which at least 2 ship.

Other parked items (§10.b Resend, §10.c BETTER_AUTH_URL, §10.d Google client) untouched.

---

## §5 Exit criteria

Mirror kickoff §exit criterion, refined per Q5 + Q5-bis + Q7 verdicts:

**Post-merge against production at `zugzwangworld.com`:**

1. POST `/api/auth/email-otp/send-verification-otp` from the SCAFFOLD.3 sign-in form returns **HTTP 400 `turnstile_failed`** (the placeholder token `"placeholder-token"` will be passed in `x-turnstile-token` header → siteverify rejects). **NEVER 415.**
2. POST `/api/auth/sign-in/social` (Google OAuth initiation) returns **HTTP 200 JSON `{url: "https://accounts.google.com/...", redirect: true}`** (per Amendment 1.2 / LOW-2 correction; was incorrectly stated as "HTTP 302" pre-amendment). The SDK's `redirectPlugin` then sets `window.location.href = data.url`, navigating the browser to Google's accounts page. **NEVER 415.** The user-observable behavior is "browser at Google's consent screen"; the wire status is 200, not 302.
3. POST `/api/auth/sign-in/email-otp` from the OTP-verify form returns **HTTP 400 `otp_invalid`** (no real OTP exists in the verifications table) OR routes to onboarding. **NEVER 415.** Endpoint corrected per Plan-Q5-bis (was `/email-otp/verify-email` pre-fix).
4. §7.2 (Google OAuth) operator acceptance test re-runs clean — full end-to-end at zugzwangworld.com (Google's anti-abuse signals are real, not placeholder).
5. §7.3 (Email-OTP) operator acceptance test re-runs to PARTIAL success: "no 415 observed; 400 `turnstile_failed` returned." Full end-to-end Email-OTP is blocked on real Turnstile widget render (deferred per Q7).
6. All other Better Auth endpoints unbroken (logout, get-session, OAuth callback).
7. `vitest run tests/server/auth/_probe-content-type-415.test.ts` passes — all **6** assertions green (3 regression-guards covering `/sign-in/social` + `/email-otp/send-verification-otp` + `/sign-in/email-otp`, 1 boundary-freeze covering `/email-otp/verify-email` per Plan-Q5-bis, 1 TDD success-path **route-handler** assertion, 1 TDD success-path **wire-shape** assertion per Amendment 1.2 / MEDIUM-1).
8. `vitest run tests/server/auth/otp.test.ts` passes (updated header-based tests).
9. MAINT.9 tracker entry closed on next sweep (close-out logs the absorption).
10. **GATING (per Amendment 1.2 / security-auditor v3 MEDIUM-2):** Operator-side `TURNSTILE_SECRET_KEY` functional probe (per §6 step 3.5) returns HTTP 400 `turnstile_failed` against an arbitrary fake token (e.g., `auditor-probe-2026-05-22-not-a-real-token`). If the probe returns HTTP 200, the production `TURNSTILE_SECRET_KEY` is a Cloudflare-published test key that accepts ANY token — FOLLOWUP-1 does **NOT** merge until the secret is rotated to a real Cloudflare-issued site/secret pair. Silently defeats SPEC.2 §18.2 fail-closed posture; treat as security incident, not "soft fail."

**TDD-driver framing (per plan-review NIT-2 reframe):**

The TDD test that drives this PR is:

> `200-or-400-not-415::email-otp-send-accepts-json-with-header-token`

Written failing-first against `main` (current form-encoded behavior returns 415 from the catch-all handler at `auth.handler(request)`; assertion `not.toBe(415)` fails). Passes only after `src/lib/auth-client.ts` + sign-in/page.tsx + sign-in/otp/page.tsx + index.ts hook change all land.

The four `415::*-rejects-form-encoded` assertions (3 core + 1 Plan-Q5-bis boundary-freeze, all ratified INCLUDE per plan-review v2 NIT-4) are **regression-guard `_probe-*` tests per MAINT.7 lineage** — they lock current router behavior and pass identically against `main` and against the merged PR. They do NOT drive the fix; they prevent silent erosion of the contract.

`test-writer` reviewer-call writes the success-path assertion FAILING-first; the four regression-guard tests ship in the same file as supporting coverage (added by the same `test-writer` call or by the executor as inline additions — either is fine, the regression-guards don't have a TDD-failing-first requirement since they pass against `main`).

**Self-audit gates** (per CLAUDE.md §5.10):
- Pre-PR self-audit walks §2 inventory item-by-item.
- `code-reviewer` reviewer-call (per CLAUDE.md §5.11): READ-ONLY scope, briefing at `.claude/agents/code-reviewer.md`, plan path `@docs/plans/SCAFFOLD.3-FOLLOWUP-1.md`.
- `security-auditor` reviewer-call (auth = critical path per CLAUDE.md §1).
- `test-writer` reviewer-call at Phase 2 start (per CLAUDE.md §5.6 + §5.11) — writes the **success-path TDD test** FAILING-first, then the four regression-guards as supporting coverage in the same file.

---

## §6 Verification mechanic (post-merge operator-side §7.2 + §7.3 re-run)

1. Hrishikesh navigates to `https://zugzwangworld.com/sign-in`.
2. **§7.2 — Google OAuth path:**
   - Click "Continue with Google" → network tab shows POST `/api/auth/sign-in/social` returns **HTTP 200** with body `{url, redirect: true}` (NOT 302, per Amendment 1.2 / LOW-2 correction) → SDK's `redirectPlugin` (`node_modules/better-auth/dist/client/fetch-plugins.mjs:6-9`) assigns `window.location.href` to that URL → browser navigates to Google's consent screen. **NEVER 415.** Acceptance verifier observes the navigation behavior, NOT the literal HTTP status of the initial POST.
   - Complete consent → Google callback to `https://zugzwangworld.com/api/auth/callback/google?code=…` → catch-all wrapper at route.ts handles 403 ONBOARDING_REQUIRED if first sign-in → redirect to `/onboarding` with cookie.
   - **Pass criteria:** browser lands on `/onboarding` (first sign-in) OR `/` (return user). No 415 in network tab.
3. **§7.3 — Email-OTP path:**
   - Enter `zugzwangworld@proton.me` → click "Send code".
   - **Pass criteria (this PR):** network tab shows POST `/api/auth/email-otp/send-verification-otp` → **400** with body `{message: "turnstile_failed"}`. **NOT 415.** Request `Content-Type: application/json`. Request includes `x-turnstile-token: placeholder-token` header. UI surfaces the error.
   - **Full end-to-end (deferred to later task):** Real Turnstile widget renders, user solves invisible challenge, real token → 200 → email arrives → enter OTP at `/sign-in/otp` → submit POST `/api/auth/sign-in/email-otp` (NOT `/email-otp/verify-email` per Plan-Q5-bis correction) → 302 to onboarding (or `/`).
**Step 3.5 — TURNSTILE_SECRET_KEY production-secret functional probe (per Amendment 1.2 / security-auditor v3 MEDIUM-2 finding — GATING per §5 exit criterion #10):**

Operator opens DevTools → Network panel on the sign-in page, submits the email-OTP form (or any request that hits `/api/auth/email-otp/send-verification-otp`), intercepts the outgoing POST before it's sent (or replays it via the Network panel's "Edit and Resend"), modifies the `x-turnstile-token` header value to an arbitrary string never issued by Cloudflare (e.g., `auditor-probe-2026-05-22-not-a-real-token`), submits.

**Pass criteria:** response is HTTP 400 with body `{message: "turnstile_failed"}`.

**Fail mode:** response is HTTP 200 success. This means the production `TURNSTILE_SECRET_KEY` is a Cloudflare-published test key that accepts ANY token (e.g., `1x0000000000000000000000000000000AA`). Rotate immediately to a real Cloudflare-issued site/secret pair **before any other experiment traffic**. This silently defeats SPEC.2 §18.2 fail-closed posture; treat as a security incident, not "verify-later." Block FOLLOWUP-1 merge until probe passes.

**Why this exists:** the placeholder hidden input `<input value="placeholder-token">` retained per Plan-Q7 sub-verdict will hit Cloudflare siteverify on every form submission. The fail-closed contract assumes siteverify rejects unknown tokens. A test-key-in-prod misconfiguration breaks that assumption silently and is NOT detected by §5 exit criterion #1's behavioral assertion alone (which would be silently degraded to "200 success" without observable failure).

4. Network-tab inspection: confirm `Content-Type: application/json` on all auth POSTs (not form-encoded).

---

## §7 Rollback plan

This PR ships strictly additive + form-conversion changes. Rollback is `git revert <merge commit>` on `main`. No data migrations, no schema changes, no env-var rotations.

Specific rollback concerns:
- **`src/lib/auth-client.ts`** removal → forms revert to native form POSTs → 415 returns (pre-PR state). No data loss.
- **`src/server/auth/index.ts`** revert (hook reads from body again) → existing tests that pass token in body resume passing if also reverted. Header-passing SDK calls would 400 `turnstile_required`.
- **Test file revert** → `_probe-content-type-415.test.ts` disappears; otp.test.ts header changes revert.
- **`docs/parked.md`** revert (if conditional edit shipped) → parked-item entry for ADR-backfill disappears; no functional impact.

Risk surface: zero — strictly client-side and hook-internal changes. No critical-path invariant (INV-1–4) touched.

---

## §8 Open questions (Q*) — for plan-review adjudication

| Q | Question | Web-Claude rec | This-session rec | Resolution at plan-review |
|---|---|---|---|---|
| Q1 | Captcha config state (i/ii/iii) | n/a — pending step-1 | **(iii)** confirmed | — |
| Q2 | Extend `endpoints` to `/sign-in/social`? | INCLUDE | **EXCLUDE** (SPEC.1 §13 F-AUTH-1 line 616 explicit) | confirm OVERRIDE |
| Q3 | Contract test naming (single file vs per-endpoint) | SINGLE | SINGLE | confirm |
| Q4 | Spec correction (`hooks.before` → `onRequest`) | TBD on finding | **DROP** — spec matches code | confirm |
| Q5 (NEW) | Include `sign-in/otp/page.tsx` 415 fix? | — | **YES** (S1; §7.3 acceptance blocked without it) | adjudicate |
| Q5-bis (NEW per BLOCKING-2; v2 NIT-4 ratified 5th test) | Endpoint correction (`/email-otp/verify-email` → `/sign-in/email-otp`) + 5th boundary-freeze test | — | **YES** (SPEC.1 §13 F-AUTH-2 contract; nil production risk; ship in same PR) + 5th boundary-freeze test ratified INCLUDE per v2 NIT-4 | resolved at plan-review v2 |
| Q6 (NEW) | Turnstile token transport (body vs header) | — | **HEADER** (`x-turnstile-token`); execute-phase Zod schema pre-check at §14.5.0 informs but does not change verdict | adjudicate |
| Q7 (NEW) | Real Turnstile widget render in this PR? | — | **DEFER** to DESIGN.*; §7.3 exits at "400 turnstile_failed". Sub-verdict: KEEP placeholder hidden input | adjudicate |

Pre-PR self-audit + reviewer-call invocations (per §5.10 + §5.11) are execute-time gates, NOT plan-review questions. Listed in §5 exit criteria for record.

---

## §9 References

### SPEC.1
- §13 F-AUTH-1 line 616 — "No CAPTCHA gate (Google's own abuse signals replace it)" → drives Q2 verdict
- §13 F-AUTH-2 lines 623-627 — Email-OTP error envelopes (`turnstile_failed`, `otp_invalid`, `otp_expired`, `otp_rate_limited`); session-issuing semantics on OTP submit → drives Plan-Q5-bis verdict

### SPEC.2
- §8.2 lines 800-830 — Better Auth wiring, single source of truth at `src/server/auth/index.ts`; email-verification flag set at users-table INSERT, not at OTP-verify (Plan-Q5-bis nil-risk argument)
- §8.2 line 816 — Cloudflare Turnstile wired via `hooks.before` (already accurate; no correction needed)
- §18.2 line 1689 — Turnstile fail-closed posture
- §8.3 — session-deferral hook (createSessionGate) — orthogonal to this PR but referenced by catch-all wrapper

### CLAUDE.md / AGENTS.md
- CLAUDE.md §1 — `src/server/auth/` is a critical path → triggers reviewer-call ritual
- CLAUDE.md §3 — refusal-trigger surface: Admin participation separation (orthogonal here; F-AUTH-ADMIN not touched)
- CLAUDE.md §5.6 — tests-before-implementation for business-logic (the success-path TDD test fires first via `test-writer` reviewer-call)
- CLAUDE.md §5.10 — pre-PR self-audit (PASS/FAIL/SURPRISE format)
- CLAUDE.md §5.11 — reviewer-call invocation policy + role-briefing pattern
- CLAUDE.md §7 — cleanup absorption rule (S3 conditional parked-item ride-along)
- AGENTS.md §6 — "Don't expose Drizzle row types in API responses" — orthogonal here
- AGENTS.md §11 — "Don't import from `src/server/**` into client components" — relevant: `auth-client.ts` is in `src/lib/`, not `src/server/`, so client components can import it

### Prior close-outs (web-Claude side, not in repo)
- `chat_close_2026-05-21_SCAFFOLD_12_full.md` — §7.2/§7.3 broadening that surfaced FOLLOWUP-1
- `chat_close_2026-05-17_SCAFFOLD_13_A.md` — original Email-OTP-only framing
- `chat_close_2026-05-20_SCAFFOLD_13_B_execute_full.md` — SURPRISE 7 (session endpoint → FOLLOWUP-2 split decision)
- `zugzwang_experiment_tracker_v9.html` — MAINT.9 entry (canonical internal restatement)

### Code paths (file:line refs)
- `src/server/auth/index.ts:112-178` — hand-rolled `zugzwangOtpGate` plugin
- `src/server/auth/index.ts:248` — plugin registration (`plugins: [emailOTP(...), zugzwangOtpGate]`)
- `src/server/auth/index.ts:294-299` — post-hoc `options.hooks.before` mutation (test-introspection convenience)
- `src/server/auth/email-otp.ts:17-36` — Resend sendVerificationOTP callback
- `src/app/(auth)/sign-in/page.tsx:7-47` — sign-in page (2 forms)
- `src/app/(auth)/sign-in/otp/page.tsx:4-29` — OTP verify page (1 form)
- `src/app/api/auth/[...all]/route.ts:21-66` — handleAuth catch-all wrapper
- `tests/server/auth/_probe-apierror-body-survival.test.ts` — pattern model for new probe
- `tests/server/auth/otp.test.ts:121-146` — `auth.options.hooks.before` introspection pattern (5 tests to update for Q6)
- `node_modules/better-auth/package.json` exports — `./react` (line 47), `./client/plugins` (line 22)
- `node_modules/better-auth/dist/client/plugins/index.d.mts:40,56` — `emailOTPClient` export
- `node_modules/better-auth/dist/plugins/email-otp/` — execute-phase Zod schema pre-check target (§14.5.0)

### ADRs referenced (S3 — file may not exist on disk; execute-phase re-confirm required)
- ADR-0004 (Better Auth ratification) — referenced by SPEC.2 §8.2 + §18.2; file `docs/adr/0004-better-auth.md` NOT on disk per plan-time `ls`. Conditional `docs/parked.md` entry per §4 + NIT-1.
- ADR-0010 (admin auth) — orthogonal; no touch.
- ADR-0014 (no HTTP-in-transaction) — orthogonal; Turnstile siteverify runs OUTSIDE any DB transaction (the hand-rolled hook is pre-transaction).
- ADR-0015 (rate-limit / idempotency) — `checkRateLimit` orthogonal-but-adjacent; unchanged by this PR.

---

## §14 SURPRISES — to be populated during execute phase

[Empty section header per SCAFFOLD.12/13 precedent. Execute-phase surprises land here before the close-out log.]

### Category headers (pre-loaded for execute-time use):

- §14.1 Substrate surprises (Better Auth runtime behaviour outside docs)
- §14.2 Test infrastructure surprises (vitest, mock surface, type-check)
- §14.3 SDK call shape surprises (typed method args, fetchOptions plumbing)
- §14.4 Form state / navigation surprises (`useRouter`, `useSearchParams`, redirect semantics)
- **§14.5 Hook-level surprises** (header-reading semantics, `ctx.request.headers` vs `ctx.headers`) — see pre-check below
- §14.6 Regression surprises (other tests broken by hook change) — see also Amendment 1.2 / INFO-1 note below

### §14.6.0 — Documentation polish (per Amendment 1.2 / security-auditor v3 INFO-1, deferred)

Comment at `src/server/auth/index.ts:34-37` could be tightened to reflect the shallow-spread mechanism. Currently says "Better Auth's runtime aggregation has already completed by then (init reads `options.hooks.before` as a single AuthMiddleware at construction)". More precise wording: "the runtime aggregator reads a shallow-spread copy of options at `createAuthContext` (`node_modules/better-auth/dist/context/create-context.mjs:84-131`) that does not see the post-hoc mutation; the mutation is purely a test-introspection surface on the original options object passed to `betterAuth(...)`".

**Why deferred:** documentation polish only; runtime behavior unchanged. Not blocking for this PR.

**Why noted here:** a future Better Auth upgrade that switches from shallow-spread to direct-reference would silently make the post-hoc mutation runtime-visible and trigger per-request crashes (the array would be wrapped as `{matcher: () => true, handler: arrayValue}` by `getHooks` line 277, then `hook.handler(...)` line 215 would throw `TypeError: arrayValue is not a function`). Surfaced for executor-discretion absorption if the file is being modified anyway (e.g., as part of the Q6 hook change).

### §14.5.0 — Execute-phase pre-check (Plan-Q6 Zod schema verification gate, per plan-review BLOCKING-1)

Before wiring the SDK call in `sign-in/page.tsx`, verify the Better Auth email-OTP plugin's Zod schema mode for the `/send-verification-otp` body input. Two options (either is sufficient):

1. **Source inspection:**
   ```
   rg -A 30 "z\.object" node_modules/better-auth/dist/plugins/email-otp/
   ```
   Find the Zod schema definition for the send-verification-otp body and check for `.strict()` / `.strip()` / `.passthrough()` annotations. Default Zod behavior is `.strip()` (unknown keys silently dropped); `.strict()` would reject the request with 400 on input validation if `turnstileToken` is passed in body.

2. **Synthetic probe (5 min):** POST JSON `{email: 'x@y.z', type: 'sign-in', turnstileToken: 'anything'}` against `auth.handler(...)` and observe:
   - If response reaches the hook handler (200 / 400 turnstile_failed / 400 turnstile_required) → schema is `.strip()` or `.passthrough()`, the extra field was dropped/passed through.
   - If response is 400 with body indicating input validation failure on `turnstileToken` → schema is `.strict()`, the extra field caused rejection.

**Document the finding** in §14.5.1 below as a SURPRISE for future strata reference. The Q6 verdict (HEADER transport) does NOT change either way — cleaner intent separation justifies header transport regardless — but the schema mode informs whether the body-route alternative would have been ergonomically viable (it isn't if `.strict()`; the value would be silently lost if `.strip()`; only `.passthrough()` would make body-route work but defeats Better Auth's typed-call contract anyway).

This pre-check costs <10 minutes total and prevents future strata from re-litigating Q6 against incomplete information.

### §14.5.1 — Actual Zod schema mode finding [TBD at execute-time]

(Execute-phase populates: "Mode: `.strict()` / `.strip()` / `.passthrough()`. Evidence: <command-output excerpt or probe-response excerpt>. Implication for body-route alternative: <one line>.")

### §14.5.2 onwards — Other hook-level surprises [populate at execute-time]

---

## Plan lineage (Amendments 1 + 1.1 + 1.2)

### Original draft (2026-05-21)
- Plan-mode reading: 11 files (incl. 8 source + 3 spec/config).
- Findings ratify the kickoff diagnosis end-to-end.
- 3 NEW questions surfaced (Q5–Q7); all have recommended verdicts.
- 6 SURPRISES surfaced (S1–S6); S6 confirms Plan-Q4 drops; S3 flagged as separate backlog.

### Amendment 1 (2026-05-22) — post web-Claude plan-review v1
- 6 plan-review findings landed: 3 blocking (Q6 schema gate, Q5-bis explicit verdict, success-path TDD test), 3 nits (S3 parked entry, test-writer gate framing, hidden-input retention surface).
- All 6 accepted in this amendment; verdicts on Q1–Q7 unchanged.
- 1 NEW verdict added: **Plan-Q5-bis** (endpoint correction → `/sign-in/email-otp`).
- 1 NEW test added: **success-path TDD assertion** at §3 (BLOCKING-3 driver).
- 1 NEW optional test surfaced: **boundary-freeze 415 for `/email-otp/verify-email`** at §3 (Plan-Q5-bis addendum).
- 1 NEW execute-phase pre-check: **§14.5.0 Zod schema mode verification** (BLOCKING-1).
- 1 NEW conditional doc change: **`docs/parked.md` ADR-backfill entry** (S3 + NIT-1).
- S5 reframed from "side benefit" to load-bearing Plan-Q5-bis verdict.
- Total open questions: 7 → 8 (Q1, Q2, Q3, Q4, Q5, Q5-bis, Q6, Q7).
- Total SURPRISES: 6 (S1–S6) — counts unchanged; S3 + S5 reframed, S6 still drops Plan-Q4.

### Amendment 1.1 (2026-05-22 second pass) — post web-Claude plan-review v2
- 2 plan-review v2 findings landed: NIT-4 (Plan-Q5-bis framing self-contradiction) + NIT-5 (§14.5.0 taxonomy).
- NIT-4 ACCEPTED: applied across §0 title (1 → 1.1 + ratification framing), §1 (Optional addendum → Coupled addendum, ratified INCLUDE), §3 (intro prose + test comment updated), §5 (exit #7 updated to "all 5 assertions green"), §8 (Q5-bis row resolved), §10 (this subsection + handoff prose updated).
- NIT-5 ACKNOWLEDGED but NOT applied; flagged for future plans to consider an "Execute-phase pre-checks" top-level section instead of nesting under §14 SURPRISES.
- No new verdicts. No new tests. No new file changes. No new questions.
- Total assertions in `_probe-content-type-415.test.ts`: 5 (was "4 + 1 optional"; now firm 5).
- Total open questions: 8 (Q1-Q7 + Q5-bis); ALL resolved at plan-review v2.

### Amendment 1.2 (2026-05-22 third pass) — post web-Claude plan-review v3 + security-auditor adjudication
- security-auditor reviewer-call landed at Amendment 1.1 → 1.2 transition (post-ratification of v2, pre-ratification of v3). PASS verdict with 7 findings: 2 MEDIUM blocking + 2 LOW fold-in + 2 SURPRISE deferred + 1 INFO deferred.
- **MEDIUM-1 ACCEPTED:** SDK call snippet mis-nest (`{ fetchOptions: { headers: ... } }` double-wrap) corrected to Form A across §1 Plan-Q6, §2 sign-in/page.tsx; wire-shape TDD test added as §3 6th assertion.
- **MEDIUM-2 ACCEPTED:** TURNSTILE_SECRET_KEY operator-side probe added as §6 step 3.5; §5 exit criterion #10 added with GATING marker (blocks merge if prod secret is Cloudflare test key).
- **LOW-1 ACCEPTED:** ONBOARDING_REQUIRED detection logic spelled out in §2 sign-in/otp/page.tsx (use `response.url.endsWith('/onboarding')`; fallback via cookie sniffing).
- **LOW-2 ACCEPTED:** `/sign-in/social` returns HTTP 200 JSON, not 302; corrected in §5 exit #2 + §6 step 2.
- **LOW-3 DEFERRED (SURPRISE):** X-Forwarded-For leftmost-element trust issue → new unconditional `docs/parked.md` entry per §4.
- **INFO-1 DEFERRED:** post-hoc `auth.options.hooks.before` mutation comment polish → §14.6 note only; not blocking.
- **INFO-2 DEFERRED (SURPRISE):** First-request CSRF gap on social + email-otp paths → new unconditional `docs/parked.md` entry per §4.
- Bookkeeping: tests 5 → 6; exit criteria 9 → 10; parked.md entries to ship: 1 conditional + 2 unconditional.
- Open questions: still 8 (Q1–Q5-bis + Q6 + Q7); all unchanged.
- SURPRISES count: 6 plan-time (S1–S6) + 2 audit-time deferred (LOW-3, INFO-2 as parked entries) + 1 audit-time documentation polish (INFO-1 as §14.6 note).

### Execute-phase opening
Execute-phase opens in a fresh CC session with the `test-writer` reviewer-call writing the success-path TDD test (route-handler + wire-shape) FAILING-first per CLAUDE.md §5.6 + §5.11.
