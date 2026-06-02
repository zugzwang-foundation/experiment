# ADR-0010 — Admin Auth Wiring (Static Password, Hand-Rolled, Two-Layer Middleware-plus-Validator)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-06 |
| **Deciders** | Hrishikesh Manoj Hundekari (HMH) |
| **Tracker task** | SPEC.11 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §8 (Authentication & Sessions stub), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

SPEC.1 v1.3.0-draft §13 F-AUTH-ADMIN locks the admin sign-in shape: **structurally separate from participants** (no `users` row, no pseudonym, no ToS gate, separate cookie name `zugzwang_admin_session`, separate session table `admin_sessions`), **route-gated** (URL not linked from any public surface; `robots.txt` Disallow + meta noindex), **single admin in v1** (per `E4`), **static password** held in env var `ADMIN_PASSWORD` as the auth secret. ADR-0010 ratifies the **how**: implementation choice, schema, middleware shape, cookie attributes, error-code discipline, and source-of-truth file map.

The amendment to SPEC.1 v1.3.0-draft (same commit as this ADR) replaced the prior Google OAuth + `ADMIN_EMAIL` allowlist with the static-password path. The driver is operator fit: single admin (HMH), single laptop, internal-facing surface, ~50-day live window, no real-money stakes. Google OAuth machinery (callback URLs, OAuth state-CSRF, third-party identity provider, hardware-key 2FA recommendation on a Google account) was overengineered for that threat model. Static password reduces vendor surface (no `googleapis` / OAuth-callback dependencies in the admin trust path), reduces code (~20 LOC vs ~50–100 LOC), and preserves all structural-separation guarantees that back `B5`. The trade-off — rotation no longer auto-invalidates active cookies via env-var re-check — is recovered by the documented `DELETE+INSERT`-on-login pattern for routine rotation and a manual `DELETE FROM admin_sessions` step for suspected-compromise rotation. Both are documented in `BREAK_GLASS.md` (HARDEN.* deliverable).

The implementation must also obey AGENTS.md §5 / CVE-2025-29927: the admin auth check MUST happen at the Server Action / route-handler layer, not only at Next.js middleware. Middleware-only protection is bypassable via `x-middleware-subrequest` header spoofing per the March 2025 disclosure; the security boundary lives at the Server Action layer regardless of what middleware says.

This ADR does **not** decide:

- Better Auth's participant configuration (ADR-0004)
- `admin_events` table schema or content (SPEC.1 §16.4 + ADR-0005)
- Multi-admin readiness / backup admin (deferred per SPEC.1 §18; testnet-phase problem)
- Admin session-revoke endpoint (deferred per SPEC.1 §18)
- Pseudonym pool / signup-flow specifics (ADR-0011)
- CVE-2025-29927 mitigation library version pins (ADR-0003)
- The `BREAK_GLASS.md` runbook itself (HARDEN.* operational deliverable)
- Specific value of `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` (number-tuning pass per SPEC.1 §16.1)
- Specific rate-limit-store choice — Postgres table vs Upstash key (deferred to SCAFFOLD.3, with the constraint that the implementation MUST support the identical-401-response property required by F-AUTH-ADMIN)

## Decision Drivers

1. **Operator fit.** Single admin (HMH), single laptop, internal-facing surface, ~50-day live window, no real-money stakes. Auth method must match this operational reality, not a generic SaaS threat model.
2. **Vendor minimisation.** No third-party identity provider in the admin trust path. The trust path is hosting environment-variable store + operator's password manager — nothing else.
3. **Code minimisation.** ~20 LOC across login + validate + logout + schema. Smaller surface area for review, fewer dependencies to track for security advisories, easier to understand at SPEC.8 fresh-session review.
4. **Structural-separation preservation.** B5 (admin not a participant) enforced by data-model construction: no `users` row, two cookie systems, two session tables, validator at `/admin/*` ignores participant cookies. ADR-0010 must not introduce coupling that weakens this.
5. **CVE-2025-29927 defense-in-depth.** Middleware alone is bypassable. Real auth check happens at Server Action layer.
6. **Information-leak avoidance on the login form.** Identical 401 response — content and timing — on wrong-password and rate-limit-exceeded. No discrimination between the two by HTTP status, response body, or response time.
7. **Constant-time password comparison.** No timing-attack oracle on the password. Standard `crypto.timingSafeEqual` over equal-length byte buffers; full comparison runs on every request regardless of input shape.
8. **Recovery / break-glass discipline.** Routine rotation must work via env-var change + redeploy. Suspected-compromise rotation must have a documented procedure that forcibly invalidates attacker-held cookies (manual `DELETE FROM admin_sessions` before redeploy).

## Considered Options

1. **Hand-rolled static password** ← chosen
2. Better Auth admin instance (separate Better Auth config block, second cookie name, second session table)
3. Hand-rolled OAuth path (Google OAuth verify → email allowlist match → admin_sessions row + cookie)
4. Email-OTP via Resend (admin email, OTP delivery to inbox, OTP table or shared Better Auth `verifications` with admin discriminator)
5. WebAuthn / passkey via Touch ID (~50 LOC + `@simplewebauthn/server` library)

## Decision Outcome

**Chosen: Option 1 — hand-rolled static password.** Three primitives ratified.

### Primitive 1 — Auth method = static password

`/admin/login` renders a single password field and a Submit button. No email field. No third-party-OAuth button. The form posts to a Server Action at `src/server/auth/admin/login.ts`. The Server Action:

1. Applies the per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` (constant defined in SPEC.1 §16.1; specific value deferred to number-tuning pass; rate-limit-store choice deferred to SCAFFOLD.3 with the identical-response constraint named below).
2. Compares the submitted password against `process.env.ADMIN_PASSWORD` using **`crypto.timingSafeEqual`** over equal-length `Buffer` objects. To handle the equal-length precondition without leaking length information, both the submitted password and `ADMIN_PASSWORD` are first hashed via `crypto.createHash('sha256').update(value).digest()`, producing fixed-length 32-byte buffers; `timingSafeEqual` runs over those. The full comparison runs on every request regardless of input shape — no early-return paths that would create a timing oracle.
3. **Match:** runs `DELETE FROM admin_sessions; INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, NOW(), NOW())` in a single transaction at SERIALIZABLE isolation (per SPEC.2 §9 D2 ratification). The `session_id` is a 256-bit cryptographically random opaque token (UUIDv7 is **not** used here — admin sessions are not user-correlatable timeline events; an opaque random token is appropriate). Sets the `zugzwang_admin_session` cookie (attributes below) and redirects to `/admin`.
4. **No match (or rate-limit exceeded):** returns 401 `admin_login_invalid`. No row written to `admin_sessions`. Identical response body and identical response timing whether the cause was wrong password or rate-limit-exceeded — the comparison and the session-write paths run for both, with the result discarded on rate-limit-exceeded, so the timing profile matches.

### Primitive 2 — Two-layer auth check

**Layer 1 (UX, not security): Next.js middleware.**

`middleware.ts` at the project root checks for the presence of the `zugzwang_admin_session` cookie on `/admin/*` paths. If absent, redirects to `/admin/login`. Exempt path: `/admin/login` itself (so anonymous users can reach the login page). This layer is the **redirect UX** — it ensures unauthenticated users see the login page instead of a broken `/admin/*` route. It is NOT the security boundary. Per CVE-2025-29927, middleware-only protection is bypassable.

**Layer 2 (security boundary): Server Action validator.**

`src/server/auth/admin/validate.ts` exports a function that:

1. Reads the `zugzwang_admin_session` cookie from the incoming request.
2. Looks up the corresponding row in `admin_sessions` by `session_id`.
3. If no row exists: returns null (caller treats as anonymous → 401 / 403).
4. If row exists: updates `last_seen_at = NOW()` and returns the session struct.

**Every** `/admin/*` Server Action and route handler MUST call this validator at the top of its body and reject (401 / 403) if it returns null. This is the security boundary. Inline admin affordances on public pages (per SPEC.1 §15 — comment-removal icons, etc.) MUST also call the validator at the backend endpoint, regardless of what middleware allowed at the proxy layer.

The validator does **not** re-check `ADMIN_PASSWORD` per request. The password is checked once at login; the cookie's `session_id` is the bearer token thereafter. (This is a deliberate change from the prior OAuth-era F-AUTH-ADMIN, which re-checked the actor's email against `ADMIN_EMAIL` per request — a property lost with static-password auth and recovered via the manual-DELETE rotation procedure.)

### Primitive 3 — `admin_sessions` schema (three columns)

```sql
CREATE TABLE admin_sessions (
  session_id   TEXT PRIMARY KEY,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `session_id`: opaque cryptographically random token; the cookie value.
- `issued_at`: write-once at INSERT; never updated.
- `last_seen_at`: updated by the validator on every admin request; ADR-0005 Bucket C (mutable; no append-only trigger).

Schema definition lives in Drizzle at `src/db/schema/admin-auth.ts` per ADR-0008 per-domain split.

The prior `admin_email` column from SPEC.1 v1.2.0-draft is **dropped**. It existed as the OAuth-allowlist match target; static-password auth makes it purposeless. The operator's contact email at `foundation@zugzwangworld.com` lives in static spec text and frontend code, not in this table.

Single-row invariant: the `DELETE+INSERT` pattern in Primitive 1 step 3 maintains "single row at any moment" without a UNIQUE constraint, since each successful login wipes and replaces in one transaction. Concurrent login attempts under SERIALIZABLE isolation will serialise; one wins, the other retries (acceptable — admin login is not contested by definition, single user).

### Cookie attributes for `zugzwang_admin_session`

| Attribute | Value | Reason |
|---|---|---|
| `HttpOnly` | `true` | Prevents XSS theft. |
| `Secure` | `true` (in production) | TLS-only transport. |
| `SameSite` | `Lax` | Per SPEC.1 §13 preamble lock (line 607). Strict considered and rejected — security gain over Lax is small for a one-user admin path with `Path=/admin` already limiting attachment to admin routes. |
| `Path` | `/admin` | Cookie scope tightened — never attached to public-route requests. Strong defense against accidental cross-context use. |
| `Max-Age` | indefinite (server-side `Number.MAX_SAFE_INTEGER` seconds; browsers cap visible cookie lifetime at ~400 days, server-side row remains valid and cookie is silently re-issued on next request) | Per F-AUTH-5 indefinite-session policy. Manual logout is the only session-end path. |
| `Domain` | production domain only | No cross-subdomain attachment. |

The literal `Set-Cookie` shape lives at `src/server/auth/admin/login.ts` — single source of truth.

### Error-code discipline

| Trigger | Status code | Code | Body | Timing |
|---|---|---|---|---|
| Wrong password | 401 | `admin_login_invalid` | Generic "Invalid credentials" message | After full password comparison + rate-limit check |
| Rate-limit exceeded | 401 | `admin_login_invalid` | **Identical** to wrong-password body | After full password comparison + rate-limit check (comparison is run-and-discard so the timing profile matches) |
| DB transaction failure | 500 | `admin_session_persistence_failed` | Generic "Server error" message | — |

The first two (wrong-password and rate-limit) MUST be indistinguishable to the client by status code, response body content, and response timing. Information-leak avoidance is non-negotiable (Decision Driver 6).

### Discoverability bundle

- `public/robots.txt` includes `Disallow: /admin/`
- `src/app/admin/login/page.tsx` includes `<meta name="robots" content="noindex,nofollow">`
- No internal navigation entry, no link from any public surface (discipline rule, not technically enforced)

These together prevent search-engine indexing and accidental leakage. Not security boundaries — the password is the boundary — but operational hygiene.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Admin login Server Action (rate-limit check + password compare + DELETE+INSERT + cookie set) | `src/server/auth/admin/login.ts` |
| Admin session validator (called by every `/admin/*` Server Action / route handler) | `src/server/auth/admin/validate.ts` |
| Admin logout Server Action (delete row + clear cookie per F-AUTH-5) | `src/server/auth/admin/logout.ts` |
| `admin_sessions` table schema (Drizzle definition) | `src/db/schema/admin-auth.ts` |
| `/admin/*` middleware redirect-on-no-cookie (UX layer, NOT security boundary) | `middleware.ts` (Next.js root) |
| `robots.txt` Disallow `/admin/` entry | `public/robots.txt` |
| `<meta name="robots" content="noindex,nofollow">` on `/admin/login` | `src/app/admin/login/page.tsx` |
| Cookie attributes (literal `Set-Cookie` shape) | `src/server/auth/admin/login.ts` |

Future code MUST NOT scatter these concerns across other files. A SCAFFOLD.3 implementation that places the validator anywhere other than `src/server/auth/admin/validate.ts` triggers a SPEC.2 §A update.

## Consequences

### Positive

- **~20 LOC implementation.** Small enough to read in one sitting; small enough that SPEC.8 fresh-session review can verify it end-to-end.
- **Zero new dependencies.** No `googleapis`, no `arctic`, no `@simplewebauthn/*`, no Better Auth admin instance. Trust path is `process.env` + Postgres + the operator's password manager.
- **Trust path is auditable.** Every link in the chain is operator-controlled. No third-party identity provider can lock the admin out, no third-party identity provider can be compromised to bypass.
- **Constant-time comparison + identical 401 response** prevent the two main side-channel attacks (timing oracle, response-content discrimination) by construction.
- **Two-layer pattern matches AGENTS.md §5 / CVE-2025-29927 defense-in-depth.** Same pattern participant Server Actions use (per ADR-0004), applied to admin.
- **Schema simplification (4 → 3 columns).** Honest cleanup; the dropped `admin_email` column existed only for the OAuth allowlist match.
- **Recovery is trivial.** Routine rotation: change `ADMIN_PASSWORD` env var, redeploy. Suspected-compromise rotation: `DELETE FROM admin_sessions;` then change env var, then redeploy. Both procedures captured in `BREAK_GLASS.md`.
- **Cookie scoped to `/admin`.** Cannot leak to public requests. Stronger isolation than the participant `zugzwang_session` cookie (which is Path=/ because participants navigate everywhere).

### Negative

- **Rotation no longer auto-invalidates active cookies.** Mitigated by: documented `DELETE+INSERT`-on-login pattern for routine rotation and the manual `DELETE FROM admin_sessions` step for suspected-compromise rotation. Acceptable because: rotation is rare; manual step is named explicitly in F-AUTH-ADMIN backup-admin clause and `BREAK_GLASS.md`; alternative (env-var version counter or per-request password re-check) would add machinery for marginal benefit at experiment scale.
- **No 2FA.** Mitigated by: long random `ADMIN_PASSWORD`, `Path=/admin` cookie scope, indefinite-cookie property accepted per SPEC.1 §13 trade-off paragraph. Acceptable because: experiment phase, no real-money stakes, single user, internal-facing surface, ~50-day live window. Testnet phase reopens this question with a new ADR (likely passkey).
- **No CSRF protection beyond `SameSite=Lax`.** Mitigated by: Next.js Server Actions are POST-only with origin checking by default; `SameSite=Lax` blocks the relevant cross-origin POST vectors. Acceptable because: standard Next.js Server Action defaults already cover the threat model.
- **Password lives in env var (Vercel store) and operator's password manager.** Mitigated by: Vercel env-var store is encrypted at rest; never committed to repo (`.env` files gitignored, `.env.example` contains placeholder only); password manager is the second copy. Risk: if both are compromised simultaneously, attacker has admin access. Acceptable because: this is the irreducible trust root for any password-based auth.
- **No backup admin.** Single admin in v1 per `E4`. `BREAK_GLASS.md` sealed-envelope handoff is the redundancy story. Multi-admin readiness deferred to testnet phase per SPEC.1 §18.

### Neutral

- **`BREAK_GLASS.md` runbook is a HARDEN.* deliverable**, not produced by this ADR. Flagged for tracker addition: a HARDEN.* task to author the runbook covering (a) sealed-envelope `ADMIN_PASSWORD` handoff to backup recipient, (b) routine rotation procedure, (c) suspected-compromise rotation procedure including the manual `DELETE FROM admin_sessions` step.
- **Specific value of `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR`** is deferred to the number-tuning pass per SPEC.1 §16.1.
- **Rate-limit-store choice (Postgres table vs Upstash key)** is deferred to SCAFFOLD.3 with the constraint that the implementation MUST support the identical-401-response property (the rate-limit check must run after the same code path the wrong-password branch runs, so timing matches).
- **Tracker text correction flagged for application by HMH.** SPEC.11 description (line 581) and SCAFFOLD.3 description (line 592) both reference Google OAuth + ADMIN_EMAIL allowlist; both are stale. Replacements suggested in close-out log.

## Pros and Cons of the Options

### Option 1 — Hand-rolled static password (chosen)

**Pros**

- Minimal code (~20 LOC across four files).
- Zero new dependencies; reuses Postgres + Drizzle already in the stack.
- No third-party identity provider in trust path.
- Honest schema (three columns; no purposeless `admin_email`).
- Matches operational reality (single user, single device).
- Recovery is env-var rotation + redeploy.

**Cons**

- Rotation requires manual `DELETE FROM admin_sessions` for compromise scenarios (mitigated by `BREAK_GLASS.md`).
- No 2FA (acceptable for experiment phase per F-AUTH-ADMIN trade-off paragraph).

### Option 2 — Better Auth admin instance

**Pros**

- Reuses participant infrastructure (consistency with ADR-0004).
- OAuth state-CSRF, session refresh handled by library.

**Cons**

- Better Auth's `sessions` table expects `users.id` foreign key; admin has no `users` row (per F-AUTH-ADMIN structural-separation rule). FK shape is wrong.
- Workaround — running a second Better Auth instance with a separate config block — adds substantial config + cookie config surface for a single-user OAuth-only path.
- Library value-add (OAuth callback handling, OTP plugin, session refresh) is wasted on the single-user admin case.
- More dependency surface (Better Auth version pinning) without corresponding security benefit.
- Doesn't match the structural-separation framing in F-AUTH-ADMIN — admin path is *deliberately* not the participant path.

**Verdict:** Rejected. Coupling admin to participant library breaks the explicit structural-separation rule and adds dependency surface without corresponding security benefit. SPEC.2 §8 stub already names the admin path as "hand-rolled" — Option 2 contradicts that pre-decision.

### Option 3 — Hand-rolled OAuth (Google)

**Pros**

- Phishing-resistant via hardware key on Google account (recommended in prior SPEC.1 v1.2.0-draft).
- Standard pattern; well-understood by reviewers.
- Auto-invalidation on env-var rotation (the lost property in Option 1).

**Cons**

- Adds `googleapis` or `arctic` dependency to admin path.
- Requires Google account hygiene as ratified ops policy (hardware key, no SMS recovery, recovery email disabled).
- More LOC than static password (~50+).
- Relies on Google as identity provider (third party in trust path).
- Originally specified in SPEC.1 v1.2.0-draft; rediscussed and rejected in this chat.

**Verdict:** Rejected. Operator preference (per chat ratification) is no third-party identity provider for admin. Auto-invalidation property recovered via documented manual procedure in Option 1; manual procedure is acceptable at the rotation frequency expected in a single-admin, ~50-day experiment.

### Option 4 — Email-OTP via Resend (to operator's Proton inbox)

**Pros**

- Reuses Resend infrastructure already in SPEC.1 vendor stack for F-AUTH-2.
- No third-party identity provider; security boundary is email inbox + OTP single-use.
- Phishing-resistant against credential theft (no static password to steal).

**Cons**

- More moving parts: admin OTP table OR shared `verifications` table with admin discriminator flag, OTP TTL, OTP rate limit, two route handlers (request-otp + verify-otp), Resend dependency on admin path.
- Requires operator to switch to email inbox during login, then back to admin (mild friction every login).
- More LOC than static password.
- F-AUTH-2 path requires Cloudflare Turnstile; admin OTP would need to skip Turnstile (additional spec deviation) or include it (friction).

**Verdict:** Rejected. Operator's "no fuss — separate moderator, no over-security, no additional tools" framing eliminates the email round-trip in favor of password-manager paste. Both options are reasonable; static password is simpler and the email round-trip adds friction without raising the security bar (an attacker who has the Proton inbox has admin either way).

### Option 5 — WebAuthn / passkey via Touch ID

**Pros**

- Phishing-impossible (key bound to laptop's Secure Enclave + verifying domain; the cryptographic handshake cannot be relayed).
- No password to type or steal.
- Modern UX (fingerprint touch, no clipboard).

**Cons**

- Adds `@simplewebauthn/server` library (~50 LOC implementation).
- Recovery requires enrolling a new passkey from a new device (one DB row edit, but more procedure than env-var rotation).
- Loss of laptop = loss of access until new passkey enrolled.
- Mild over-engineering for experiment phase.

**Verdict:** Rejected. Reasonable upgrade for testnet phase; not justified at experiment phase given operator framing. Reopen as a new ADR if/when testnet phase reconsiders admin auth.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §13 (preamble) | Vendor stack lock | **Consumes** — admin path uses static password `ADMIN_PASSWORD` only; no third-party identity provider |
| SPEC.1 §13 F-AUTH-ADMIN | Auth flow body | **Consumes** — System steps, error codes, backup-admin clause all anchored in F-AUTH-ADMIN; ADR fills in the **how** |
| SPEC.1 §13 F-AUTH-5 | Logout flow | **Consumes** — admin logout deletes `admin_sessions` row, clears `zugzwang_admin_session` cookie |
| SPEC.1 §16.1 | Constants table | **Consumes** — `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` (specific value deferred to number-tuning pass) |
| SPEC.1 §16.4 | Audit log catalogue | **Consumes** — `admin_sessions` schema (three columns); `admin_events` writes are gated by the validator but `admin_events` schema itself is owned by ADR-0005 |
| SPEC.1 §17 | Acceptance test catalogue | **Consumes** — ten admin-auth test rows (six new in v1.3.0-draft, four retained from prior) |
| SPEC.1 §18 | Out-of-scope items | **Consumes** — multi-admin readiness, admin session-revoke endpoint, admin role flag all explicitly deferred or rejected |
| SPEC.2 §1.4 #5 | Auth library + callback chain delegation | **Consumes** — implementation specifics for the admin path |
| SPEC.2 §8 | Auth shape stub | **Consumes** — admin path is hand-rolled, separate session table, separate cookie name `zugzwang_admin_session` |
| SPEC.2 §9 | D2 ratified (SERIALIZABLE) | **Consumes** — `DELETE+INSERT` on login runs at SERIALIZABLE isolation |
| ADR-0003 | Next.js 16 + App Router | **Consumes** — Server Actions for login/validate/logout; `middleware.ts` at root for redirect UX layer |
| ADR-0004 | Better Auth (participant) | **Boundary reference** — admin path deliberately does NOT share Better Auth infrastructure; CVE-2025-29927 defense-in-depth requirement carries over |
| ADR-0005 | Postgres bucket classification | **Consumes** — `admin_sessions` is Bucket C (mutable: `last_seen_at` updates per request); `admin_events` is Bucket A (append-only, owned elsewhere) |
| ADR-0006 | Hosting topology | **Consumes** — Vercel env-var store as `ADMIN_PASSWORD` store; Supabase Postgres for `admin_sessions` |
| ADR-0008 | Drizzle ORM | **Consumes** — `admin_sessions` schema lives at `src/db/schema/admin-auth.ts` per per-domain split discipline |
| AGENTS.md §5 | Defense-in-depth | **Consumes** — admin auth check at Server Action layer, not only middleware (CVE-2025-29927) |
| Tracker | SCAFFOLD.3 (Auth wiring) | All depends on this ADR being `accepted` |
| Tracker | HARDEN.* (`BREAK_GLASS.md` runbook authoring) | New task flagged for tracker addition |

## More Information

- CVE-2025-29927 — Next.js middleware bypass via `x-middleware-subrequest` header spoofing (March 2025)
- Node.js documentation — `crypto.timingSafeEqual` (constant-time byte buffer comparison)
- AGENTS.md §5 — Defense-in-depth pattern for Server Actions
- SPEC.1 v1.3.0-draft §13 F-AUTH-ADMIN — Admin auth flow body (locked)
- SPEC.1 v1.3.0-draft §16.4 — `admin_sessions` row description (three-column schema)
- ADR-0004 — Better Auth (participant path; boundary reference for admin)
- ADR-0005 — Postgres event-sourced schema (bucket classification: `admin_sessions` is Bucket C)
- ADR-0008 — Drizzle ORM (per-domain schema split)
- `BREAK_GLASS.md` — operational runbook (HARDEN.* deliverable, not produced by this ADR)

---

*ADR-0010 ratifies hand-rolled static-password admin auth on the existing Postgres + Drizzle vendor stack — `ADMIN_PASSWORD` env var with `crypto.timingSafeEqual` constant-time comparison, three-column `admin_sessions` schema (`session_id, issued_at, last_seen_at`), transactional `DELETE+INSERT` on login to maintain the single-row-at-any-moment invariant, two-layer auth check (Next.js middleware redirect for UX + Server Action validator as security boundary per CVE-2025-29927), `zugzwang_admin_session` cookie with `HttpOnly + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age`, identical 401 `admin_login_invalid` response on wrong-password and rate-limit-exceeded (no information leak), and per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` per SPEC.1 §16.1. The decision body and the constraints minted in §"Decision Outcome" — the three primitives, the cookie attributes, the error-code discipline, and the single-source-of-truth file map — are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
