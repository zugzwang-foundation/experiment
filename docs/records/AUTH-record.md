# AUTH — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** sign-in (Google OAuth + email OTP), bot defence, sessions, the identity pool, onboarding and terms acceptance, and the separate admin authentication path.

## 1 · What this lane is

A participant reaches Zugzwang by signing in with Google or by asking for a six-digit code
by email. Either way, the first thing that happens on the far side is not a profile form:
the system hands them an identity from a pre-built pool — a colour, an animal, a number and
a matching picture — and that pseudonym is the only name anyone will ever see. There is no
display name to choose and no avatar to upload. They accept the terms, meet a seven-card
deck explaining what the place is, and are then a participant.

The admin does not go through any of this. The admin has **no row in `users` at all** — not
a row with a flag, not a row with a role. Authentication for the admin is a separate password
path with its own cookie scoped to `/admin`, and the reason it is built that way is that a
role column is a thing that can be set on the wrong row, whereas a table you are absent from
is not. That single decision is what makes "the admin cannot bet" a fact about the schema
rather than a check somebody has to remember to write.

## 2 · Feature table

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| Google OAuth sign-in | SHIPPED | `src/server/auth/index.ts`, `src/app/(auth)/sign-in/page.tsx` | SPEC.1 §13 · `F-AUTH-1` | 0004 | `tests/server/auth/google.test.ts`, `tests/server/auth/oauth-signin-event.test.ts` | — |
| Email OTP sign-in (Resend) | SHIPPED | `src/server/auth/email-otp.ts`, `src/app/(auth)/sign-in/otp/page.tsx` | SPEC.1 §13 · `F-AUTH-2` | 0004, 0033 | `tests/server/auth/otp.test.ts`, `tests/integration/email-otp-send.integration.test.ts` | — |
| OTP sender boot guard (non-sandbox in prod/staging) | SHIPPED | `src/server/auth/resend-from.ts` | — | 0033 | `tests/server/auth/email-otp-from-guard.test.ts` | `docs/parked.md` SCAFFOLD.12 §10.b |
| Cloudflare Turnstile | SHIPPED | `src/server/auth/index.ts:88-107` | SPEC.1 §13 | 0004 | `tests/server/auth/` | — |
| Session issue + 400-day cap | SHIPPED | `src/server/auth/index.ts:69 (SESSION_MAX_AGE_SEC)`, `:349` | SPEC.2 §8.2 | 0004 P1 | `tests/integration/onboarded-login-session.integration.test.ts` | — |
| Session issued on F-AUTH-4 Continue | SHIPPED | `src/server/auth/tos-accept.ts` | `F-AUTH-4` | 0004 | `tests/integration/auth-dbl-1-first-login-session.integration.test.ts` | — |
| Signed-out session read on `(public)` | SHIPPED | `src/app/(public)/_lib/session.ts` | — | 0034 | `tests/integration/viewer-context.integration.test.ts` | — |
| Session gate (deferred-session hook) | SHIPPED | `src/server/auth/session-gate.ts` | `F-AUTH-4` | 0004 | `tests/server/auth/session-gate.test.ts` | — |
| Sign-out | SHIPPED | `src/server/auth/logout.ts` | `F-AUTH-5` | — | `tests/server/auth/logout.test.ts`, `logout-event.test.ts` | — |
| **Identity pool — FIFO consume** | SHIPPED | `src/server/identity-pool/consume.ts:36` (`FOR UPDATE SKIP LOCKED`) | SPEC.1 §13 · `F-AUTH-3` | 0011, 0016 | ⚠ `tests/server/auth/pseudonym.test.ts` **mocks `@/db` entirely** and asserts the SQL *contains* `FOR UPDATE` / `SKIP LOCKED`; its two-different-rows assertion is scripted by the mock and is vacuous. **No real-Postgres test of concurrent pool consumption exists.** Event emission: `pseudonym-assigned-event.test.ts` | `docs/parked.md` — no FIFO tiebreak |
| Identity pool — seed | SHIPPED | `scripts/seed-identity-pool.ts` | — | 0011 | `tests/db/identity-pool/seed.test.ts` (drives `runSeed` against real Postgres) | **`F-2`** — 0 rows on prod |
| Identity pool — verify script | SHIPPED | `scripts/verify-identity-pool.ts` | — | 0011 | **none** — nothing in `tests/` imports it | |
| Identity pool — low-watermark alarm | SHIPPED | `drizzle/migrations/0007_pg_cron_jobs.sql` | — | 0011 | `tests/db/identity-pool/watermark.test.ts` | — |
| PFP URL derivation | SHIPPED | `src/server/identity-pool/pfp-url.ts` | SPEC.1 §13 | 0011 | `tests/unit/identity-pool/pfp-url.test.ts` | — |
| Pseudonym vocabulary + rotation | SHIPPED | `src/server/identity-pool/vocabulary.ts`, `rotation.ts` | SPEC.1 §13 | 0011 | `tests/unit/identity-pool/vocabulary.test.ts`, `rotation.test.ts` | — |
| Terms acceptance (versioned) | SHIPPED | `src/server/auth/tos-accept.ts`, `tos-versions.ts`, `public/legal/tos.txt` | SPEC.1 §13 · `F-AUTH-4` | — | `tests/server/auth/tos.test.ts`, `tos-accept-event.test.ts`, `tos-accept-grant.test.ts` | — |
| Initial Dharma grant, once per user, in the acceptance tx | SHIPPED | `src/server/auth/tos-accept.ts` | SPEC.1 §10.1 | 0018 | **primary** (the `FOR UPDATE` lock + tab-race no-op branch): `tests/server/auth/tos-accept-grant.test.ts` T2/T3 · **storage backstop**: `tests/invariants/I-GRANT-ONCE-001…spec.ts`, which inserts raw and imports no `src/server/auth/**` | — |
| Onboarding completion | SHIPPED | `src/server/onboarding/complete.ts`, `src/app/(auth)/onboarding/page.tsx` | `F-AUTH-4` | — | `tests/unit/onboarding/complete.test.ts`, `tests/server/auth/onboarding-page-wiring.test.ts` | — |
| Onboarding-ref signing | SHIPPED | `src/server/auth/onboarding-ref.ts` | `F-AUTH-4` | — | `tests/server/auth/onboarding-ref.test.ts` | — |
| **Onboarding deck — first-login gate** | SHIPPED | `src/server/onboarding/gate.ts`, `src/components/onboarding/OnboardingDeck.tsx`, cards at `cards.ts:67 (ONBOARDING_CARDS)` | SPEC.1 §21.9 | 0037 | `tests/unit/onboarding/gate.test.ts`, `cards.test.ts`, `copy-drift.test.ts`, `render/deck.test.tsx` | — |
| OAuth orphan fallback | SHIPPED | `src/server/auth/index.ts` | `F-AUTH-1` | — | `tests/integration/oauth-orphan-fallback.integration.test.ts` | — |
| OAuth signup pool deadlock fix | SHIPPED | `src/server/auth/index.ts` | — | 0043 | `tests/integration/oauth-signup-pool-deadlock.integration.test.ts` | — |
| Post-commit auth events | SHIPPED | `src/server/auth/post-commit-events.ts` | SPEC.2 §7 | 0005 | `tests/server/auth/post-commit-events-wiring.test.ts` | — |
| **Admin login (separate path)** | SHIPPED | `src/server/auth/admin/login.ts:219-224`, `validate.ts`, `logout.ts` | SPEC.1 §15 · `F-AUTH-ADMIN` | 0010 | `tests/server/auth/admin-login.test.ts`, `admin-login-result.test.ts`, `admin-login-event.test.ts`, `admin-logout-event.test.ts` | — |
| Preview-environment auth | **NOT BUILT** | — | — | — | none | `docs/parked.md` M1/M2 |
| User-to-user Dharma transfer | **NOT BUILT — refused by design** | — | SPEC.1 §5 | — | `tests/server/dharma/non-transferable.test.ts` | never |

### 2.1 · The six flows, and the order a participant meets them

The flow specs are normative and are **pointed at, not summarised** — each is one file in
`docs/specs/flows/`.

| Flow | Title | Where it happens |
|---|---|---|
| `F-AUTH-1` | Google OAuth | `src/app/(auth)/sign-in/page.tsx` → `src/server/auth/index.ts` |
| `F-AUTH-2` | Email + OTP | `src/app/(auth)/sign-in/otp/page.tsx` → `src/server/auth/email-otp.ts` |
| `F-AUTH-3` | pseudonym assignment | `src/server/identity-pool/consume.ts`, inside the signup transaction |
| `F-AUTH-4` | ToS acceptance | `src/app/(auth)/onboarding/page.tsx` → `src/server/auth/tos-accept.ts` |
| `F-AUTH-5` | logout | `src/server/auth/logout.ts` |
| `F-AUTH-ADMIN` | admin login | `src/server/auth/admin/login.ts` — **a different path entirely** |

**In order, for a first-time participant:** sign in (1 or 2) → an identity is taken from the
pool and retired (3) → the terms screen, where pressing Continue both accepts the terms and
issues the session and pays the initial grant in one transaction (4) → the seven-card deck,
which cannot be dismissed on first login → the product. Signing out (5) is the only step that
is reversible; the identity is not, because a retired tuple never returns to the pool.

### 2.2 · Admin authentication is two layers, and only one of them is a boundary

| Layer | Where | What it is |
|---|---|---|
| **1 — UX only** | `proxy.ts:24-28` | `/admin/*` without the `zugzwang_admin_session` cookie redirects to `/admin/login`. `/admin/login` is excluded to avoid a loop. **Bypassable, and documented as such** |
| **2 — the security boundary** | `src/server/auth/admin/validate.ts:4-11` | called at the entry of **every** admin Server Action and Route Handler. Reads **only** `zugzwang_admin_session`; the participant cookie is never consulted, so a participant cookie present on an admin handler still returns `null` |

The file says why the split exists: *"Layer 1 (proxy.ts middleware redirect) is UX-only and
bypassable; this validator is the security boundary"* — written against CVE-2025-29927, the
Next.js middleware-bypass class. ⚠ **A reader who sees the middleware and stops there will
conclude the admin surface is middleware-protected. It is not; it is validator-protected, at
every entry point, individually.**

⚠ `proxy.ts` matches `/admin/*` **only**. The `(public)` route group is not middleware-gated,
which is why the onboarding deck's gate has to test authentication itself — `gate.ts` says so
in as many words: *"every surface there serves signed-out visitors, and the authenticated term
is load-bearing rather than an optimisation. Without it the deck renders to the anonymous
audience."*

### 2.3 · The identity pool, as built versus as specified

| | Value | Source |
|---|--:|---|
| Namespace as specified | **50,000** = 50 colours × 100 animals × 10 numbers | ADR-0011; ADR-0016:161 states it as fact |
| Rows on **staging** | **1,070** (**548** unassigned, 522 assigned — ⚠ live and drifting: it read 549/521 minutes earlier in this same generation) | `SELECT count(*) … FROM identity_pool` |
| Rows on **production** | **0** | same query, `--config prd` |

⚠ **ADR-0011 already contradicts its own headline** and is the honest source here: its patch
section records that the generation run *"covers **13 colours × 67 animals = 871 pairs**"*
(`ADR-0011:298`) and that *"Still owed: …
the 50,000-row production manifest"*. So the gap is known and written down; what was not
written down anywhere is the measured figure. **Staging can absorb ~548 further signups before
the pool is empty**, and that figure falls by one with every signup — it fell by one during
this generation. Production can absorb none, because it has none.

## 3 · The decisions that shaped it

| Decision | Recorded in | What it changed |
|---|---|---|
| Better Auth as the vendor, on a locked stack | ADR-0004 | the whole participant path; the drizzle adapter's `additionalFields` contract |
| Session `expiresIn` capped at 400 days | ADR-0004 Patch P1 · SPEC.2 §8.2 | a cookie-serialization throw on returning sign-in became a bounded value |
| Admin auth is a static password, hand-rolled, two-layer | ADR-0010 | admin never enters Better Auth; no `users` row exists for it |
| Pseudonym pool, pre-built and consumed FIFO | ADR-0011 | identity is assigned, never chosen; the namespace is a data problem, not a UI one |
| UUIDv7 ids; no raw UUID in a participant URL | ADR-0016 | `/u/[pseudonym]` rather than `/u/[uuid]` |
| Equal initial grant, paid inside the acceptance transaction | ADR-0018 | endowment is equal for everyone; differentiation is by play |
| OTP delivery boot guard + optimistic request semantics | ADR-0033 | a sandbox sender can never be live in prod or staging |
| The deck's seen-marker is a cookie, not a column | ADR-0037 | first-login gating costs no schema and no write |
| The OAuth signup pool checkout is not nested | ADR-0043 | four concurrent signups no longer deadlock a four-connection pool |

## 4 · Invariants and guards this lane carries

⛔ **The admin/participant separation is a DATA-MODEL fact, not a runtime check.**
`src/db/schema/auth.ts:29-30`, in the schema itself:

> `// No `role` column. No `is_admin`. Per §8.7 pillar 1 (admin has no users`
> `// row; structural separation by data-model) — also CLAUDE.md §3.`

⚠ **The naïve negative does not work here, and the working one is worth copying.**
`grep -n 'role\|is_admin\|isAdmin' src/db/schema/auth.ts` returns **one line — its own
explanatory comment at `:29`** (the `V-17` trap: a textual negative matching the sentence that
explains the absence). The reproducible form matches a **column declaration**:
`grep -nE '(role|is_admin|isAdmin)\s*:' src/db/schema/auth.ts` → **exit 1, no output**, against
the control `grep -nE '(pseudonym|email)\s*:'`, which returns the real declarations. **There is
no row an admin could bet from, no flag to flip, and no check to forget to write.**

The second half of the separation is the cookie. `src/server/auth/admin/login.ts:224` sets
`path: "/admin"`, and `logout.ts:66` deletes it at the same path. ⚠ **The consequence is a
routing rule, and it is the one this lane most often catches people on:** an admin route
handler placed under `/api/admin/...` never receives that cookie and 401s the real admin.
Admin handlers live under `src/app/(admin)/admin/...`.

| Invariant | How this lane carries it |
|---|---|
| **INV-2** — Dharma non-transferable, no overdraft | the initial grant is the only credit this lane writes, once per user, inside the acceptance transaction. `tests/invariants/I-GRANT-ONCE-001.initial-grant-once-per-user.spec.ts`; storage backstop is the unique partial index `dharma_ledger_initial_grant_user_uq` |
| Bucket B — one-shot `NULL → timestamp` | `identity_pool.assigned_at` transitions once and is then immutable; every other column change and every DELETE is rejected at the storage layer. `tests/db/triggers/` |
| Pool exhaustion | `FOR UPDATE SKIP LOCKED` (`consume.ts:36`) lets parallel signups take different rows rather than serialising on one. A retired tuple never returns to the pool. ⚠ **This is a claim about the shipped SQL, not a measured concurrency result** — the only test is a mocked substring assertion (see §2). `tests/integration/oauth-signup-pool-deadlock.integration.test.ts` exercises concurrent signup against real Postgres and is the nearest thing to a behavioural proof |

**Two vendor contracts that fail silently if forgotten**, both recorded here because each cost
a production-shaped bug:

1. **A custom `users` column must be declared in `user.additionalFields`** or Better Auth's
   drizzle adapter strips it before INSERT — the cause of the null-`pseudonym` `23502` signup
   failure. `src/server/auth/index.ts:352+`.
2. **`nextCookies()` must be the last entry in `plugins:`** — it is what lets an `auth.api.*`
   call made from a Server Action set a cookie the browser actually receives.

**Failure posture.** Turnstile verification logs `turnstile_unavailable` and does not admit on
a missing secret (`index.ts:94`, `:107`). OTP send is optimistic per ADR-0033: the response
does not disclose whether the address exists.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| SCAFFOLD.3 | #38 | `62cd299` | 2026-05-16 | auth wiring — 6 flows, session-deferral hook, admin two-layer middleware, dev seed |
| SCAFFOLD.17 | #50 | `d5be518` | 2026-05-25 | identity-pool seed + `pg_cron` low-watermark + verification |
| SCAFFOLD.8 | #57 | `92b7c47` | 2026-05-28 | staging environment (auth env wiring per scope) |
| FIX-AUTH-LOGIN | #150 | `3f82371` | 2026-06-20 | session `expiresIn` capped at the 400-day cookie ceiling (ADR-0004 P1) |
| O1-DECK | #355 | `e79555c` | 2026-08-18 | the deck — a first-login gate that cannot be dismissed, and a re-show that can |
| O1-DECK-R2 | #358 | `c58d64a` | 2026-08-19 | the deck's visual pass; the first card's ruled exception |
| **AUTH-DBL-1** | #366 | `e5e520c` | 2026-08-21 | the participant session is issued on F-AUTH-4 Continue |
| PFP-1 | #415 | `c49138d` | 2026-08-25 | PFP migration |
| SCALE S-3 | #431 | `2f3497d` | 2026-08-28 | Google OAuth signup connection deadlock (ADR-0043) |
| PFP-UI-1 | #421 | `545c5f8` | 2026-08-31 | the avatar becomes the shape the asset already is |

⛔ **AUTH-DBL-1 has no repository record.** No `docs/plans/AUTH-DBL*` and no `docs/logs/AUTH-DBL*`
exist — verified by `git ls-files docs/ | grep -i AUTH-DBL`, which returns nothing, against the
control `git ls-files docs/ | grep -i AUTH-OTP`, which returns **three** files (`docs/logs/AUTH-OTP-DELIVERY.md`, `docs/plans/AUTH-OTP-DELIVERY.md`, `docs/plans/AUTH-OTP-GATE.md`). **No repository
record — PR #366 merged the work; the lane has no session log.**

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-2` | `identity_pool` holds **0 rows on production**; 1,070 on staging, unassigned falling with each signup (see §2.3) |
| `docs/STATE.md` §4 · `F-7` | `BETTER_AUTH_TRUSTED_ORIGINS` is absent from Doppler `prd` — **config hygiene, not a security gap**: the baseURL origin is trusted unconditionally |
| `docs/STATE.md` §4 · `F-9` | ADR-0011 sizes the namespace at 50,000 and ADR-0016 states it as fact; the built pool is 1,070 |
| `docs/parked.md` — SCAFFOLD.12 §10.b | Resend domain verification + `RESEND_FROM_EMAIL` flip |
| `docs/parked.md` — SCAFFOLD.12 §10.c / §10.d | preview `BETTER_AUTH_URL`; preview-alias callback URI on the Google client |
| `docs/parked.md` — SCAFFOLD.3-FOLLOWUP-1 SURPRISE-1 | `X-Forwarded-For` leftmost-element trust chain |
| `docs/parked.md` — SCAFFOLD.3-FOLLOWUP-1 SURPRISE-2 | first-request CSRF gap on the three sign-in endpoints |
| `docs/parked.md` — AUDIT-FIX-A22 FU-1 / FU-2 | pool-consumption / user-insert non-atomicity; default-vs-SERIALIZABLE isolation on the two auth transactions |
| `docs/parked.md` — STAGING-PARITY Slice C/D | `identity_pool` FIFO consume has no tiebreak |
| `docs/parked.md` — M1 / M2 | preview-environment auth is deferred, not broken-by-accident |
