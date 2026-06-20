# ADR-0004 — Better Auth on Locked Vendor Stack

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.4 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §8 (Authentication & Sessions shape), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Patch record

**P1 (2026-06-20, FIX-AUTH-LOGIN).** In-place Patch record per CLAUDE.md §5.12 (consumer-surface scoping, **not** supersession). **The load-bearing decision is unchanged** — Better Auth remains the auth library on the locked vendor stack, with the §13 onboarding-gate hook and the structural admin/participant separation intact. **Corrected:** the "indefinite cookie lifetime via very-large `session.expiresIn` (~100 years)" consequence below is **removed**. That value was never achievable — browsers (Chrome 104+) clamp cookie `Max-Age`/`Expires` to 400 days client-side regardless — **and** it exceeded better-call's cookie-serialization cap (`better-call/dist/cookies.mjs:55` throws when `maxAge > 34,560,000s`), so Better Auth's `setSessionCookie` (`cookies/index.mjs:126-127`, which feeds `expiresIn` straight into the cookie `maxAge`) threw an **uncaught 500** on cookie issuance for every onboarded/returning-user sign-in (the create-path `ONBOARDING_REQUIRED` gate defers first-time signup, masking it until a user was onboarded). `session.expiresIn` is now capped at 400 days (`60*60*24*400 = 34,560,000`, `src/server/auth/index.ts`). `disableSessionRefresh: true` is **retained**, so the cookie is **not** silently re-issued — the earlier "re-issued on next request" wording was also incorrect. A 400-day session far exceeds the ~51-day live window; truly-indefinite sessions (long-lived `sessions` row + per-visit cookie re-issue) are out of scope. Reconciles SPEC.2 §8.2 (same fix, same commit).

---

## Context and Problem Statement

SPEC.1 §13 locks the participant authentication model: two sign-in paths (Google OAuth via F-AUTH-1, Email + 6-digit OTP via F-AUTH-2) converging on an indefinite server-side participant session, manual-logout-only invalidation, HTTP-only/Secure/SameSite=Lax cookies, structurally separate from the admin path. The vendor stack is locked: Google Identity Services, Resend for OTP delivery, Cloudflare Turnstile for CAPTCHA on the email path, Postgres on Supabase, Drizzle ORM, Vercel Node.js runtime, Next.js 16 App Router with Server Actions per ADR-0003.

What remains undecided is the implementation library that wires F-AUTH-1, F-AUTH-2, and the F-AUTH-3 / F-AUTH-4 onboarding gate (pseudonym assignment + ToS acceptance) onto that vendor stack. SPEC.2 §8 stub references "Auth.js v5 + database session strategy"; that prior is invalidated by current evidence (Auth.js v5 still beta after 18 months as of May 2026; the maintainer team has merged into Better Auth and now redirects new projects there). A fresh decision is required.

The decision must satisfy three load-bearing constraints from SPEC.1 §13 that an off-the-shelf library may or may not support:

1. The participant session cookie MUST NOT be issued until both `users.pseudonym IS NOT NULL` AND `users.tos_accepted_at IS NOT NULL` (F-AUTH-3 + F-AUTH-4 sequencing).
2. Logout deletes the server-side session row, not just the client cookie (F-AUTH-5).
3. The cookie name MUST be structurally distinct from the admin-session cookie (per the structural-separation rule that backs INV-3 and B5).

This ADR does **not** decide:

- Admin auth wiring → ADR-0010 (SPEC.11)
- Cloudflare Turnstile vendor configuration → SPEC.2 §19
- Pseudonym pool design (word lists, asset pipeline, exhaustion handling) → ADR-0011 (SPEC.12)
- Specific numerical values: OTP TTL, OTP wrong-guess attempt cap, per-surface rate-limit windows, session expiry duration, Resend retry policy → SPEC.1 number-tuning pass + ADR-0015 (SPEC.16)
- ToS document content, version-hash mechanism, or acceptance-evidence schema → SCAFFOLD.3 / UI task
- Drizzle schema DDL for `users`, `sessions`, `accounts`, `verifications` → ADR-0005 / SCAFFOLD.2
- Stack-level operational patterns (plugin-order rules, column-naming conventions, cache-scope rules for `auth.api.getSession`) → AGENTS.md

## Decision Drivers

1. **SPEC.1 §13 onboarding-gate mechanism.** The library MUST expose a hook capable of blocking server-side session-row creation while preserving the user record, so F-AUTH-4 cancellation reroutes back to the gate without state pollution. Without this hook, the cookie grants participant authority before pseudonym + ToS complete, silently violating the F-AUTH-1/2 → F-AUTH-3 → F-AUTH-4 → session sequencing.

2. **Database session strategy native, not bolted on.** SPEC.1 §13 names a server-side session table and manual-logout-deletes-row semantics. The library's default with a database adapter present MUST be a server-side `sessions` row keyed by an opaque cookie token, not a JWT-in-cookie.

3. **Drizzle adapter on a stable major.** Per ADR-0008 the ORM is Drizzle. The library's Drizzle adapter MUST be on the 1.x stable line, owned by the same maintainer team as the core, with a documented schema-extension story for the custom columns this build needs (`pseudonym`, `tos_accepted_at`, `colour`, `animal`, `number`, `pfp_filename`, `last_allowance_accrued_at`).

4. **Email-OTP plugin with custom-transport callback.** SPEC.1 §13 F-AUTH-2 requires a 6-digit numeric OTP delivered via Resend, server-generated, single-use, TTL-bounded, stored in Postgres. The library MUST expose an OTP plugin that takes a `sendVerificationOTP`-style callback (so Resend wires in directly), persists OTPs through the Drizzle adapter, and enforces single-use.

5. **First-class Next.js 16 App Router + Server Actions integration.** ADR-0003 locks the framework. The library's mutation surface MUST be invokable from Server Actions, the session-read API MUST work in Server Components without forcing the page out of Cache Components compatibility (auth-state reads will be in dynamic scopes by SPEC.2 §16 design; the library must not add additional cache constraints).

6. **CVE-2025-29927 architecture compatibility.** The March 2025 disclosure that Next.js middleware-only auth is bypassable via `x-middleware-subrequest` header spoofing makes middleware-only protection unsafe. The library's recommended pattern MUST be defense-in-depth (real auth checks at Server Action / route-handler layer, middleware for optimistic redirects only). AGENTS.md §5 already requires this.

7. **Build-window stability.** Build runs May → November 2026. The library MUST be on a stable 1.x line with no announced 2.0 major in the window, monthly minor-release cadence at most, and a maintainer team active enough to ship CVE patches within days. The build pins a known-good patch and updates only on CVE or required bugfix.

8. **AGPL-compatible licensing.** The codebase is AGPL-3.0 per ADR-0001. The library's license MUST be MIT / Apache-2.0 / ISC compatible with AGPL-3.0 redistribution.

## Considered Options

1. **Better Auth + Drizzle adapter** ← chosen
2. Auth.js v5 (NextAuth v5) + Drizzle adapter
3. Auth.js v4 (NextAuth v4) + Drizzle adapter
4. Clerk
5. Supabase Auth (GoTrue)
6. Hand-rolled on Drizzle
7. Lucia *(explicit non-option, named for the historical record)*

## Decision Outcome

**Chosen: Option 1 — Better Auth + Drizzle adapter.**

This ADR ratifies five primitives as a single unit:

### 1. Library and version pin

`better-auth` on the **1.6.x** stable line. `1.7.0-beta` is not used in production. The Drizzle adapter is consumed via the canonical core import path `better-auth/adapters/drizzle` (the standalone `@better-auth/drizzle-adapter` package is the same code post-1.5 split; either import path is acceptable).

### 2. Database session strategy

Sessions are server-side rows in the `sessions` table written by the Drizzle adapter. The cookie holds an opaque token, not a JWT. JWT mode is engaged only when the database config is omitted, which this build does not do. Logout (`auth.api.signOut`) deletes the server-side row, then clears the cookie — matching SPEC.1 §13 F-AUTH-5 literally.

### 3. Participant cookie name

The participant session cookie is named **`zugzwang_session`**. This is structurally distinct from the admin cookie `zugzwang_admin_session` (per SPEC.1 §13 F-AUTH-ADMIN), uses the brand prefix to keep the pair scannable in DevTools, and does not leak the library name into the cookie attribute set. Cookie attributes: `HttpOnly`, `Secure` (in production where `baseURL` is HTTPS), `SameSite=Lax`. Configured via `advanced.cookies.session_token.name` and `advanced.defaultCookieAttributes` in the Better Auth config.

### 4. Google OAuth scopes

Google OAuth requests exactly the scopes `openid email profile`. No wider scopes (calendar, drive, etc.) are requested. The signup flow additionally enforces `email_verified === true` from the Google ID token; accounts where Google itself reports the email as unverified are rejected at the F-AUTH-1 callback before the user record is created. This closes the sybil vector where an attacker attaches an unverified Gmail-aliased address to a Google account to bypass the F-AUTH-2 OTP path.

### 5. Email-OTP via Resend through the official plugin

The `emailOTP` plugin from `better-auth/plugins` is wired with a `sendVerificationOTP` callback that calls Resend. OTPs are 6-digit numeric (plugin default), persisted in the `verifications` table through the Drizzle adapter, single-use enforced by the plugin, TTL configured per the SPEC.1 number-tuning pass. The plugin's `disableSignUp` is **not** used (signup-on-first-OTP is the SPEC.1 F-AUTH-2 contract for new users routing to F-AUTH-3).

### Session-deferral hook contract (minted here, consumed downstream)

This ADR mints one hard constraint that downstream code consumes:

**Server-side session-row creation MUST be gated on pseudonym assignment AND ToS acceptance.** The gate is implemented as `databaseHooks.session.create.before` in the Better Auth config. The hook reads `users.pseudonym` and `users.tos_accepted_at` for the `session.userId` and throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` when either is missing. The user record and OAuth-account row are preserved on rejection; no `sessions` row is written and no cookie is issued.

```ts
// src/server/auth/index.ts (single source of truth for the auth instance)
databaseHooks: {
  session: {
    create: {
      before: async (session) => {
        const u = await db.query.users.findFirst({
          where: eq(users.id, session.userId),
          columns: { pseudonym: true, tosAcceptedAt: true },
        });
        if (!u?.pseudonym || !u?.tosAcceptedAt) {
          throw new APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" });
        }
        return { data: session };
      },
    },
  },
},
```

The hook is invoked on every successful F-AUTH-1 / F-AUTH-2 callback. For new users (no `users` row), F-AUTH-3 runs first (creating the row with `pseudonym` populated, `tos_accepted_at` still NULL), then F-AUTH-4 (setting `tos_accepted_at`), then session creation re-attempts and succeeds. For existing users where both columns are non-NULL, the hook returns `{ data: session }` immediately and the cookie is issued. For users who cancel mid-onboarding, the next sign-in attempt re-evaluates the hook against current column state and routes them back to whichever gate is still open.

ADR-0011 (pseudonym pool, F-AUTH-3 substance) and SCAFFOLD.3 (auth wiring) consume this constraint. They do not redefine it. Changes to the gate condition (e.g. adding a third precondition) require a same-commit update to this ADR.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Better Auth instance + plugins + databaseHooks | `src/server/auth/index.ts` |
| Resend `sendVerificationOTP` callback body | `src/server/auth/email-otp.ts` |
| Session-deferral hook (pseudonym + ToS gate) | `src/server/auth/session-gate.ts` (re-exported into `index.ts`) |
| Catch-all auth route handlers | `app/api/auth/[...all]/route.ts` |
| Better Auth + plugin version pins | `package.json` |
| Drizzle schema for `users`, `sessions`, `accounts`, `verifications` | owned by ADR-0005 (`src/db/schema/auth.ts`) |
| Cookie attributes + names | `src/server/auth/index.ts` (in `advanced.cookies` config) |

## Consequences

### Positive

- **SPEC.1 §13 onboarding-gate enforced by library mechanism, not app middleware.** The cookie literally cannot be issued until pseudonym + ToS are non-NULL. INV-3 and INV-4 are protected by construction at the auth layer, not by a middleware redirect that can be bypassed.
- **Server-side session row + manual-logout-deletes-row matches F-AUTH-5 literally.** No interpretation note required. Logout is a single transaction.
- **Drizzle adapter is first-class.** Schema is application-owned; custom columns plug in via `user.additionalFields`. No "Better Auth's user table vs my user table" split.
- **Email-OTP plugin removes ~150 LOC of OTP-handling code we'd otherwise own.** Generation, persistence, single-use enforcement, wrong-guess attempt capping all built in. Resend wires in via one callback.
- **Auth.js merger signal.** The Auth.js / NextAuth maintainer team consolidated under Better Auth in September 2025. The TypeScript-auth ecosystem is converging on this library. Choosing it sits on the dominant trajectory rather than a forked or maintenance-mode line.
- **AGPL-compatible.** Better Auth is MIT-licensed; no obligations on Zugzwang's AGPL-3.0 redistribution.
- **$0 across all scales for the build window.** No MAU pricing, no vendor SLA tier. Fully open-source.

### Negative

- **Younger track record than Clerk or Auth.js v4.** Better Auth shipped v1 in early 2025; ~16 months of production exposure as of this ADR. Mitigation: the build window ends 2026-11-08 with codebase archive; pin to a known-good patch version after launch and update only on CVE or required bugfix.
- **No commercial SLA.** Support is community + maintainer-team via GitHub Issues and Discord; response time is observably hours-to-days, but there is no ticket-and-engineer-on-the-other-end. Acceptable because: build window is 1.75 months live, the library's core auth flow is small enough that critical-path bugs are reproducible quickly, and the AGPL codebase can fork-and-patch a Better Auth dependency if needed without licensing friction.
- **`onAPIError.errorURL` is ignored on the OAuth callback path** (Better Auth issue #5518). The OAuth-callback failure redirect must be handled in an explicit `app/auth/error/page.tsx` that reads error query params and routes accordingly. Mitigated by: SCAFFOLD.3 owns the error page; one-time cost.
- **Indefinite cookie lifetime is achieved by very-large `session.expiresIn` (~100 years), not a literal `Infinity`.** Combined with `disableSessionRefresh: true` to prevent sliding-window updates. Functionally indefinite for the build window (codebase archives Nov 2026); browsers cap visible cookie lifetime at ~400 days (Chrome) regardless of what the server sends, but the server-side row remains valid and the cookie is silently re-issued on next request. **(Corrected by Patch record P1: the ~100-year value is removed and `expiresIn` capped at 400 days; with `disableSessionRefresh: true` the cookie is not re-issued.)**
- **Stale-pseudonym-row drainage.** A user who completes F-AUTH-3 (pseudonym assigned) but cancels at F-AUTH-4 (ToS not accepted) leaves a `users` row with `pseudonym IS NOT NULL` and `tos_accepted_at IS NULL`, holding an `identity_pool` tuple. SPEC.1 §13 F-AUTH-4 already specifies the 30-day daily admin-sweep that releases the tuple back to the pool; this ADR does not change that mechanism, only notes it is the relevant cleanup path.
- **Server-Action client-side session-state lag** (Better Auth issue #3608). After a server-side `signIn` / `signOut` action completes, `useSession` on the client does not auto-refresh until `router.refresh()` or `authClient.useSession().refetch()` is called. SCAFFOLD.3 absorbs this in the post-action client handler.

### Neutral

- **Better Auth core is MIT.** Drizzle (Apache-2.0), Resend SDK (MIT), and Cloudflare Turnstile (no SDK redistribution) impose no obligations on Zugzwang's AGPL-3.0 license.
- **CVE history.** One critical CVE (CVE-2025-61928, October 2025) affected the `api-key` plugin only; this build does not use that plugin and is not exposed. No CVEs against core, OAuth, email-OTP, or session subsystems as of 2026-05-05. Vulnerability disclosure-and-patch loop functioned within days.

## Pros and Cons of the Options

### Option 1 — Better Auth + Drizzle adapter (chosen)

**Pros**

- `databaseHooks.session.create.before` is the exact session-deferral mechanism F-AUTH-3/4 needs; the user row is preserved on rejection so the user can resume onboarding
- Database session strategy is the default with a Drizzle adapter present; matches F-AUTH-5 literally
- Official `emailOTP` plugin with `sendVerificationOTP` callback wires Resend in one function
- Drizzle adapter is owned by the same maintainer team as core, on the same stable 1.x line
- Next.js 16 App Router + Server Actions documented as first-class with explicit `proxy.ts` (Next.js 16 rename) guidance
- CVE-2025-29927 defense-in-depth pattern is the documented recommendation: real auth checks happen in Server Components / Server Actions / route handlers, middleware (proxy) is for optimistic redirects only
- Auth.js merger consolidates the TypeScript-auth ecosystem under this team — dominant trajectory
- $0 across all scales, MIT-licensed, no MAU pricing

**Cons**

- ~16 months of production exposure as of decision date; younger than Clerk or Auth.js v4
- Community-only support model
- Issue #5518 forces an explicit OAuth error page (one-time cost)
- Indefinite cookie via large `expiresIn`, not a literal flag *(→ Patch record P1: now a 400-day `expiresIn` cap)*

### Option 2 — Auth.js v5 (NextAuth v5) + Drizzle adapter

**Pros**

- SPEC.2 §8 stub originally named this; zero text drift if chosen
- `signIn` callback returning `false` would defer session issuance similarly to Better Auth's `databaseHooks.session.create.before`

**Cons**

- **Still in beta after 18 months as of May 2026** — Auth.js docs themselves direct you to install with the `@beta` tag. Fails Driver 7 (build-window stability) outright.
- Auth.js maintainer team has consolidated under Better Auth (September 2025); v5 will receive security patches but not feature work. Trajectory is wrong for a fresh build.
- LogRocket Feb-2026 review explicitly characterizes v5 as "a migration bridge rather than a default recommendation for greenfield apps."

**Verdict:** Rejected. Stable was promised; beta was delivered. Foundational dependency uncertainty is unacceptable for the build window.

### Option 3 — Auth.js v4 (NextAuth v4) + Drizzle adapter

**Pros**

- Battle-tested for years; hundreds of thousands of production deployments
- `signIn` callback gives an equivalent session-deferral hook
- `@auth/drizzle-adapter` works with v4

**Cons**

- v4 is in maintenance — no new features, fewer App Router examples in agent training data
- v4's headline DX is the Pages Router; App Router support exists but is not the documented happy path
- Claude Code's effective output quality on v4 + App Router is materially weaker than on v5 patterns or Better Auth (per LogRocket Feb-2026 hands-on)
- Picks up zero of the Auth.js consolidation benefit

**Verdict:** Rejected. Maintenance-mode foundation for a fresh App Router build is a regression.

### Option 4 — Clerk

**Pros**

- Most-battle-tested option (10M+ users, 5,300+ production deployments)
- Commercial support, SLA, SOC 2
- Free tier covers experiment scale; cost is $0

**Cons**

- **Session-deferral semantic mismatch.** Clerk creates the Clerk session immediately on OAuth callback; F-AUTH-3 / F-AUTH-4 sequencing must be enforced post-hoc by app middleware blocking participant routes until `users.tos_accepted_at IS NOT NULL`. Security property is identical, literal SPEC.1 §13 sequencing is not. Forces a SPEC.1 §13 interpretation note.
- Clerk's user-facing identity primitives compete with the pseudonym system; cognitive friction at every F-AUTH-3 / F-AUTH-4 touch point
- Vendor lock-in (acceptable for the build window, but not free)

**Verdict:** Rejected. Strict-filter winner on "battle-tested + good support" but loses on the load-bearing technical-fit driver (Driver 1).

### Option 5 — Supabase Auth (GoTrue)

**Pros**

- Supabase is the locked DB provider per ADR-0006; one fewer vendor
- Free up to 50k MAU
- Battle-tested (GoTrue is Netlify's 2017 fork, used by all Supabase apps)

**Cons**

- **JWT-native session model** vs SPEC.1 §13's server-side session table requirement. Wrapping GoTrue with our own session row layer means using GoTrue for OAuth/OTP wiring only and re-implementing sessions on top — most of the value gone
- OTP via Resend requires Resend configured as SMTP relay; more friction than Better Auth's plugin callback shape

**Verdict:** Rejected. Architectural mismatch with the locked session model.

### Option 6 — Hand-rolled on Drizzle

**Pros**

- Maximum control; no dependency
- ~500 LOC for OAuth callback + OTP table + session table + cookie management

**Cons**

- Solo developer + Claude Code workflow + 1.75-month live window does not have the time budget to write, test, and maintain auth code
- No commercial or community support model — every bug is yours
- Reinventing OTP single-use enforcement, OAuth-state CSRF, cookie attributes, session-expiry housekeeping is unjustified given Better Auth ships all of it tested

**Verdict:** Rejected. Not worth the engineering time.

### Option 7 — Lucia *(explicit non-option, for the record)*

Sunset by maintainer in late 2024. Not a viable choice for a fresh build. Listed here so a future reader sees it was considered and rejected on availability grounds.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | Auth library + callback chain — ratified by this ADR |
| SPEC.2 §8 (stub) | Authentication & Sessions shape | "Auth.js v5 + database session strategy" reference is invalidated by this ADR; back-pressure: §8 is rewritten on the next §8 drafting pass to name "Better Auth + Drizzle adapter + database session strategy" and the cookie name `zugzwang_session`. The two-parallel-cookie-systems and structural-separation rule is unchanged. |
| SPEC.2 §11 (stub) | Rate-Limit & Idempotency Contract | Better Auth's `rateLimit.customRules` provides the per-endpoint rate-limit primitive consumed by §11 / ADR-0015. No back-pressure on §11 substance; specific window/cap values remain SPEC.1 number-tuning pass / ADR-0015 territory. |
| SPEC.2 §19 (stub) | Sybil & Security Model | Cloudflare Turnstile token verification on `/email-otp/send-verification-otp` is implemented as a Better Auth `hooks.before` middleware on that path. Vendor configuration substance remains §19 / ADR-0004's scope (this ADR), per the SPEC.4 brief; this ADR ratifies that the integration shape is "Better Auth `hooks.before` calls Cloudflare siteverify before the OTP send fires." |
| SPEC.2 §23 | ADR Index | Status of ADR-0004 flips from `provisional` to `accepted` on this commit. |
| SPEC.1 §13 F-AUTH-1 | Google sign-in | Implemented via Better Auth `socialProviders.google` with scopes `openid email profile`; signup flow rejects `email_verified === false`. |
| SPEC.1 §13 F-AUTH-2 | Email + OTP | Implemented via `emailOTP` plugin with Resend transport. |
| SPEC.1 §13 F-AUTH-3 | Pseudonym assignment | Sequenced before session creation by the session-deferral hook minted in this ADR. ADR-0011 owns substance. |
| SPEC.1 §13 F-AUTH-4 | ToS gate | Sequenced before session creation by the session-deferral hook minted in this ADR. SCAFFOLD.3 / UI task owns substance. |
| SPEC.1 §13 F-AUTH-5 | Logout | Implemented by `auth.api.signOut` deleting the server-side session row and clearing the `zugzwang_session` cookie. |
| SPEC.1 INV-3 | Comments side-bound at post time | Protected by construction: cookie cannot grant participant authority before pseudonym + ToS, so a participant cannot comment under any state where post-time-side binding would be ambiguous. |
| SPEC.1 INV-4 | Append-only resolutions | Indirectly protected: same construction prevents pre-onboarding writes of any kind. |
| AGENTS.md §5 | Defense-in-depth | This ADR does not re-mint the constraint. AGENTS.md §5 already requires "admin check **also** happens at the Server Action / route handler layer (defense in depth)"; the same rule applies to participant-write paths, which call `auth.api.getSession({ headers })` at the Server Action / route-handler boundary regardless of any middleware/proxy state. CVE-2025-29927 is the historical context for why this is non-negotiable. |
| AGENTS.md (next update) | Stack patterns | Better Auth operational patterns (`nextCookies()` last-in-array, camelCase column names end-to-end, no `auth.api.getSession` inside `'use cache'` scopes, version pin to 1.6.x) are stack-level patterns and live in AGENTS.md after the next AGENTS.md update pass. This ADR does not enumerate them. |
| Tracker | SCAFFOLD.3, SCAFFOLD.11, SCAFFOLD.14, every UI/ENGINE task that reads session | All depend on this ADR being `accepted` |

## More Information

- Better Auth documentation: <https://better-auth.com/docs>
- Better Auth Drizzle adapter: <https://better-auth.com/docs/adapters/drizzle>
- Better Auth `databaseHooks`: <https://better-auth.com/docs/concepts/database#database-hooks>
- Better Auth Email-OTP plugin: <https://better-auth.com/docs/plugins/email-otp>
- Better Auth Next.js integration: <https://better-auth.com/docs/integrations/next>
- Better Auth changelog: <https://better-auth.com/changelog>
- Auth.js → Better Auth merger announcement (Sept 2025): <https://github.com/nextauthjs/next-auth/discussions/13252>
- LogRocket "Best auth library for Next.js in 2026" (Feb 2026): <https://blog.logrocket.com/best-auth-library-nextjs-2026/>
- CVE-2025-29927 (Next.js middleware bypass): referenced in Decision Driver 6
- Better Auth verification report (project knowledge): SPEC.4 research artefact, 2026-05-05
- AGENTS.md §5 (Next.js 16 patterns), §1 (stack — to be updated to "Better Auth" on the next AGENTS.md pass)
- CLAUDE.md row 320 (auth model, locked 2026-04-30) — unchanged by this ADR
- CLAUDE.md row 321 (auth library `DECIDE`) — flips to "Better Auth (per ADR-0004)" on this commit; GATING flag clears
- SPEC.1 §13 (Authentication, including F-AUTH-1 through F-AUTH-5)
- SPEC.2 §8 (Authentication & Sessions stub) — back-pressure pending on next §8 drafting pass
- SPEC.2 §23 (ADR Index)

---

*ADR-0004 ratifies Better Auth as the participant authentication library on the locked Google OAuth + Resend + Cloudflare Turnstile + Postgres + Drizzle vendor stack, with database session strategy, the participant cookie name `zugzwang_session`, Google OAuth scopes `openid email profile` with `email_verified` enforced, the official email-OTP plugin wired to Resend, and the session-deferral hook contract gating session creation on pseudonym + ToS. The decision body and the session-deferral hook constraint in §"Decision Outcome" are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
