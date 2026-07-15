# API-SURFACE.md — every live route, with auth posture

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6` · **Derived from:** `find src/app` at the
pin (23 route/page/layout files) + SPEC.2 §4 / §15 + ADR-0031. Route groups `(public)`,
`(auth)`, `(admin)` do not appear in URLs.

---

## Public (no auth)

| Route | Method | Purpose · auth posture |
|---|---|---|
| `/` | page | "Coming soon" landing (build SHA + timestamp in footer). Public. |
| `/m/[slug]` | page | Market detail scaffold (server-component shell, ADR-0023); resolves via `getMarketBySlug`, Draft excluded. Public read. |
| `/m/[slug]/export` | GET | Debate `.md` export (ADR-0025); text-only, version-pinned `zugzwang.md` context block prepended; masking inherited from `loadDebateView` (removed content never exported). Public read. |
| `/api/health` | GET | Status + per-hash migration-drift field (ADR-0022/0024) — the deploy gate. Public; no session, no origin allowlist. |
| `/api/_smoke-error` | GET | Deliberate-throw Sentry wiring smoke. Public; observability-only. |

## Participant auth (Better Auth)

| Route | Method | Purpose · auth posture |
|---|---|---|
| `/api/auth/[...all]` | GET+POST | The mounted Better Auth surface: Google OAuth, email-OTP (+ Turnstile), session, sign-out. Public entry by nature; rate-limit classes `otp-email`/`otp-ip` (SPEC.2 §4.6). |
| `/sign-in`, `/sign-in/otp` | pages | Sign-in UI (OAuth button; OTP flow). Public. |
| `/onboarding` | page | Post-signup gate: pseudonym reveal + ToS acceptance (F-AUTH-3/4). Requires the deferred-session onboarding path. |

## Participant API (session-gated writes)

| Route | Method | Purpose · auth posture |
|---|---|---|
| `/api/bets/place` | POST | W-1 entry: bet + comment, atomic (INV-1). Pipeline: origin allowlist → session → rate limit (`bet-ip`) → **`Idempotency-Key` required** → durable-receipt pre-check → moderation (outside the tx, fail-closed) → SERIALIZABLE tx. |
| `/api/bets/sell` | POST | F-BET-3 in-stream exit (the only comment-free action). Same pipeline as place; oversell pre-check `insufficient_shares` (ADR-0031). |
| `/api/uploads/sign` | POST | R2 signed-PUT mint for comment images. Session + onboarding-complete gate; rate class `image-put-ip`; MIME/byte caps per `CONSTANTS.md`. |

## Admin (cookie `zugzwang_admin_session`, `Path=/admin` — structurally separate)

Admin route handlers live under `/admin/...`, **never** `/api/admin/...` — the cookie path
makes an `/api/admin/` handler unreachable for a real admin (AGENTS.md §5). Admin mutations
(create/open/seed/close/resolve/correct/void, Remove/Ban) ride **Server Actions inside
these pages** (SPEC.2 §4.2), each independently validated via the admin session +
`assertAdminActor` (CVE-2025-29927 defense-in-depth). Admin has **no `users` row** (CLAUDE.md §3).

| Route | Method | Purpose · auth posture |
|---|---|---|
| `/admin/login` | page | Static-password login (ADR-0010); per-IP rate class `admin-login-ip`. |
| `/admin/markets` | page | Market list + lifecycle operations (ENGINE.15 wire actions). Admin session. |
| `/admin/markets/new` | page | Market creation form (F-ADMIN-1; content is operator-authored). Admin session. |
| `/admin/markets/[marketId]` | page | Per-market ops: open+seed, close, resolve/correct/void (raw UUID allowed on admin routes per ADR-0016). Admin session. |
| `/admin/markets/media/sign` | POST | R2 signed-PUT mint for the admin market-media pool (MEDIA.1; bucket arm `market-media`). Origin allowlist → **admin session** → `admin-media-put-ip` rate cap. |
| `/admin/moderation/audit` | page | Reactive moderation review feed + audit search (ADR-0021, F-ADMIN-4/5). Admin session. |

## Cron (Vercel Cron → Bearer `${CRON_SECRET}`, constant-time compare)

| Route | Method | Purpose |
|---|---|---|
| `/api/cron/close-due-markets` | GET | Per-minute sweep: `Open` → `Closed` at deadline (W-4; distributed lock, TTL 55 s). |
| `/api/cron/r2-orphan-sweep` | GET | Deletes uncommitted uploads older than the 120-min window (circuit breaker at 5 consecutive R2 failures). |
| `/api/cron/alarms-drain` | GET | Drains `cron_alarms` → Sentry with flush-before-stamp delivery guarantee (AUDIT-FIX-B1). |

## The wire envelope (SPEC.2 §4.4 / §15)

- **Route Handlers:** success `{ ok: true, data }`; error `{ ok: false, error: { code,
  message, error_type, retry_semantics, retry_after, field_errors } }` — the six-field
  envelope is mandatory (nulls explicit). Branch on HTTP status, then `ok`. Every response
  echoes `X-Request-Id`.
- **Server Actions:** same discriminated union; `field_errors` feeds React 19
  `useActionState`; no HTTP status reaches user code.
- **`error_type`** is a closed 9-value enum (validation 400 · auth 401 · forbidden 403 ·
  not_found 404 · conflict 409 · rate_limited 429 · gone 410 · unavailable 503 ·
  internal 500). **`retry_semantics`** is closed 3-value (`retry_safe` / `retry_after` /
  `do_not_retry`); `retry_after` seconds present iff semantics say so.
- **Catalogue:** 39 codes, enumerated in SPEC.2 §15.4 (the standalone `error-codes.md`
  file is a named forward deliverable — don't chase it). Notable: bare-vs-`error_` prefix
  drift is a known PRECURSOR.4 sweep item, not a finding.

## Terminal error mapping on the bet path (ADR-0031 — read before probing idempotency)

- A committed bet/sell MUST reach the client: the **`bet_receipts`** row (last write in
  the W-1 tx, UNIQUE on `idempotency_key`) answers any replay with the original 200; a
  racing duplicate 23505s, rolls back whole, and returns the stored result. Backstopped
  by `I-IDEM-ONCE-001`.
- Replay order: Redis idempotency cache → durable receipt pre-check (**before**
  moderation — a committed comment-bearing bet is never re-moderated into a rejection) →
  execute.
- User-reachable terminal cases never yield an *uncached* 500. Bug-class errors
  (unknown 23505, CAS failure, 57014…) deliberately stay loud uncached-500
  `error_internal` + Sentry. `error_position_conflict` = 503, `retry_after: 1` (the
  single-side write-race loser). Known honest boundary: a **depleting-sell replay** under
  the compound double-fault returns a clean 404/400 instead of the original 200 —
  fidelity degradation, not a double-proceed (ADR-0031 records it).

---

*EXTAUDIT-06 kit · file 6 of 7.*
