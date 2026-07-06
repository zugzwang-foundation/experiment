# AUDIT-FIX-A22 — signup/sign-in event completeness + §3.5 spec-vs-built reconciliation

**Branch:** `fix/audit-fix-a22` · **Critical path:** auth (full gated ritual) · **Migration:** NONE
(`events.event_type` is text; all three event types + payload schemas already in
`src/server/events/schemas.ts`; §19.4.1 STRIP rows already present at SPEC.2 L1987–1989).

**Ratified (operator, via web):** option (i) amend-spec-to-built · verify-then-emit fabrication
guard · isolation = describe-built + separate correctness follow-up · touch §16 · file both
follow-ups in `parked.md` at close-out.

## 1. Problem

SPEC.2 §8.8 names five participant auth events. Two emit (`user.tos_accepted` at
`tos-accept.ts:175` in-tx; `user.signed_out` at `logout.ts:75` via the §7.5.1 carve-out). Three
are declared in `EVENT_TYPES` with zero emit sites: `user.oauth_signed_in`, `user.otp_signed_in`,
`user.pseudonym_assigned`. Separately, SPEC.2 §3.5 describes a signup architecture that was never
built (a single SERIALIZABLE `identity/assign.ts` transaction consuming the pool + inserting the
user + emitting the event); the built path folds pool consumption into Better Auth's
`user.create.before` hook (`src/server/identity-pool/consume.ts`, own tx, before any userId
exists), with Better Auth owning the `users` insert.

**Verify-live mechanism finding (Better Auth 1.6.11, from shipped source):** `databaseHooks.
{session,user}.create.after` exist and receive the created row (userId available), but every
`create.after` is wrapped in `queueAfterTransactionHook` (`better-auth/dist/db/with-hooks.mjs:31-39`)
and drained only after the wrapping transaction/handler completes (`@better-auth/core`
`transaction.mjs:44,71`). **No in-tx after-hook seam exists** → all three emits are post-commit
carve-outs (§7.5.1 sub-case (b)). Caveat: pending hooks drain **even when the wrapped tx rolled
back** (`transaction.mjs:67-72`) → a naive emit could fabricate an events row for a row that never
committed. Hence the mandatory verify-then-emit guard.

## 2. Part A — SPEC.2 edits (web-authored, applied verbatim)

Eleven exact-string edits E1–E11 (full text in the kickoff; all OLD strings byte-verified unique
on live main 2026-07-06): §3.5 preamble (E1), hook-throw drift `{ data: false }`→
`ONBOARDING_REQUIRED` (E2), §3.5 F-AUTH-3 full rewrite to built + two pre-existing-observation
paragraphs (E3), §3.5 F-AUTH-4 SERIALIZABLE→default isolation (E4), §3.7 CI-lint dir
`identity`→`identity-pool` + carve-out false-positive clause (E5), §3-SSOT consumer locus (E6),
Appendix A file-map row (E7), §8.3 onboarding-loop (E8) + cancellation-safety (E9), §16 F-AUTH-4
evidence isolation (E10), §7.5.1 sub-case split (a)/(b) + fabrication guard (E11).

## 3. Part B — §0 bump

Live §0 is **1.0.15** (L3 Status blockquote, L14 Version field; table tail L65). New version
**1.0.16**, date 2026-07-06; changelog row appended at table tail (text in kickoff). Migration-head
text in the blockquote is NOT touched (0019-vs-0022 runbook drift is DP-lane).

## 4. Part C — code design

**New file `src/server/auth/post-commit-events.ts`** (server-only; §7.5.1 sub-case-(b) docstring):

- `emitSignedInEvent(session, ctx)` — wired at `databaseHooks.session.create.after`.
  Flow discriminator on `ctx?.path` (Better Auth passes the endpoint context as the hook's 2nd
  arg): `"/callback/:id"` or `startsWith("/callback/")` → `user.oauth_signed_in` (flow F-AUTH-1);
  `"/sign-in/email-otp"` → `user.otp_signed_in` (F-AUTH-2); anything else / null ctx →
  **skip + `console.error`** (never a mislabeled event type; benign-missing-entry class).
- `emitPseudonymAssignedEvent(user)` — wired at `databaseHooks.user.create.after`
  (the only seam where the created `users.id` exists) → `user.pseudonym_assigned` (F-AUTH-3).

**Verify-then-emit guard (both functions):** one `db.transaction` micro-tx:
`SELECT` the originating row by PK (`sessions.id` for sign-ins, `users.id` for pseudonym);
**absent → skip** (logged) — this is the fabrication guard against the drain-on-rollback caveat;
present → read the `users` row for payload fields (`google_id`/`email`/`pseudonym`/`pfp_filename`)
→ `insertEvent(tx, …)`. The SELECT runs on our own `db` client (never Better Auth's adapter), so
at default isolation it sees only committed state: committed row visible, rolled-back row absent.

**Payloads** (per `schemas.ts:149-162`): oauth `{userId, provider:"google", googleId}`; otp
`{userId, email}`; pseudonym `{userId, pseudonym, pfpFilename}`. Edge: oauth path with
`users.google_id` NULL (OTP-created user later account-linked to Google) → **skip + log** (schema
requires string; no fabricated value).

**Metadata** (7-field, §3.7): `request_id:"unknown"`, `flow_id` per above, `user_id = actor_id =
users.id` (self-actor §8.8), `idempotency_key:null`; sign-in emits take `ip`/`user_agent` from the
**verified sessions row** (Better Auth populates them; `?? "unknown"`), pseudonym emit uses
`"unknown"` (no request scope — S-C deferral, logout.ts precedent). `aggregate_type:"user"`,
`aggregate_id: userId`, `eventId` = fresh uuidv7 per invocation (logout precedent).

**Error posture:** unexpected errors (DB, zod) **propagate** — matches the `user.signed_out`
precedent, loud via Sentry, sign-in is retryable; the only silent-skip branches are the three
logged ones above (absent row / unclassifiable path / NULL googleId), all of the accepted
benign-missing-entry class. No swallowing of systematic failures.

**Wiring (`src/server/auth/index.ts`):** add `after:` beside the existing `before:` hooks. ADD
emits only — the deferral gate (`session.create.before`), pool consumption (`FOR UPDATE SKIP
LOCKED` + `assigned_at`), pseudonym injection, and isolation levels are all UNCHANGED. No backfill
of historical signups (append-only bar).

## 5. Test plan (failing-first, test-writer; real test Postgres per `logout-event.test.ts` pattern)

New files under `tests/server/auth/` (route `@/db` to `testDb`; fixtures insert `users`/`sessions`
rows via `testClient`; teardown `truncateTables`):

- `oauth-signin-event.test.ts` — happy path (fixture user w/ google_id + sessions row → call
  `emitSignedInEvent` with `ctx.path="/callback/:id"` → EXACTLY ONE `user.oauth_signed_in` row;
  payload `{userId, provider:"google", googleId}`; metadata self-actor F-AUTH-1); **fabrication
  guard** (no sessions row → ZERO events rows); google_id NULL → zero rows, no throw.
- `otp-signin-event.test.ts` — happy path (`ctx.path="/sign-in/email-otp"` → ONE
  `user.otp_signed_in`, payload `{userId, email}`, F-AUTH-2); **fabrication guard**; unknown path
  / null ctx → zero rows, no throw (no mislabeled type).
- `pseudonym-assigned-event.test.ts` — happy path (fixture user → call
  `emitPseudonymAssignedEvent` → ONE `user.pseudonym_assigned`, payload
  `{userId, pseudonym, pfpFilename}`, F-AUTH-3, metadata placeholders); **fabrication guard**
  (absent users row → zero rows).
- Wiring/seam (may live in the per-event files or a fourth file, `google.test.ts` introspection
  pattern): `auth.options.databaseHooks.session.create.after` === the sign-in emitter and
  `user.create.after` === the pseudonym emitter (the *post-commit* seam — the ordering guarantee
  is the seam position; Better Auth drains `create.after` post-commit by construction), and the
  existing `before` hooks remain wired (gate + pool consumption untouched).
- No-regression: existing `logout-event`, `tos-accept-event`, `session-gate`, `pseudonym`,
  `google`, `otp` suites stay green (full-suite run).

## 6. Ritual

Sequential cascade (B5 lesson — one DB-touching reviewer at a time): **test-writer** (RED first)
→ implement → **code-reviewer** → **security-auditor** (directed scope: carve-out orphan window =
accepted §7.5.1 tradeoff and nothing more; guard actually prevents fabrication at default
isolation; deferral gate + pool consumption unchanged; self-actor encoding; no PII beyond
§19.4.1-classified keys; admin separation intact; row-lock/isolation NOT altered — isolation
correctness is FILED, not resolved). No db-migration-reviewer (no DDL). Gates: full local suite
`pnpm vitest run` against :54322 + `ZUGZWANG_ENV=preview just verify` + §5.10 self-audit. Spec
edits land in the SAME commit as code. PR opens; CC STOPS at PR (operator merges after web reads
the diff).

**Close-out (post-merge, separate session):** log + file BOTH follow-ups in `parked.md`:
(a) pool-consume/user-insert non-atomicity (burned pseudonym on failed INSERT);
(b) default-vs-SERIALIZABLE isolation on the two auth transactions.
