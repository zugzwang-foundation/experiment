# FIX-AUTH-SIGNUP — Google (and email-OTP) signup `unable_to_create_user`

> **Diagnostic + fix plan.** Root cause proven by source inspection; fix designed. The fix itself (code + test) is a **separate execute chat** after web + operator review. Critical-path (`src/server/auth/`) — full ritual applies in that chat.
> **Provisional TASK-ID** `FIX-AUTH-SIGNUP` (operator/tracker may reassign — Open decision #2).

---

## Context

Google signup on staging fails with client error `unable_to_create_user`; `users`/`accounts`/`sessions` are all empty (signup has **never** succeeded). The original framing held the exact Postgres cause as *unknown* (Better Auth logs `e.message`, not `e.cause`) and called for live instrumentation on staging to capture it.

**That instrumentation is unnecessary.** The cause is provable by source inspection of the installed `better-auth@1.6.11`, and the surfaced error *code itself* discriminates it from the competing hypothesis. No throwaway diagnostic branch or staging redeploy is needed. The permanent end-to-end test (written RED-first) is the live confirmation **and** closes the coverage gap that let this ship.

---

## Root cause (proven) — Postgres `23502` NOT-NULL violation on `users.pseudonym`

Better Auth's drizzle adapter **strips every field not declared in its user model** before the INSERT. The model = 6 core fields **plus `user.additionalFields`** — and `additionalFields` is **not declared** in `src/server/auth/index.ts`. So the `pseudonym` / `pfpFilename` the `user.create.before` hook injects (and the `googleId` from `mapProfileToUser`) are silently dropped. `pseudonym` is `NOT NULL` with no default → the INSERT throws.

Expected verbatim error (the RED test prints it; PG code `23502`):

```
null value in column "pseudonym" of relation "users" violates not-null constraint
```

### Evidence chain (all read-only, source-level)

1. **Hook injects pseudonym** — `with-hooks.mjs:18–21`: a `create.before` returning `{ data }` is merged `actualData = { ...actualData, ...result.data }`. Our hook (`src/server/auth/index.ts:275–281`) returns `{ data: { ...user, pseudonym, pfpFilename } }`. ✓ in `actualData`.
2. **Adapter then runs `transformInput`** — `with-hooks.mjs:25–29`: `adapter.create({ data: actualData })`.
3. **`transformInput` copies only *model* fields** — `factory.mjs:108–109`: `for (const field in fields) { let value = data[field]; … }`. Iterates the model's fields, reads `actualData[field]`; any key not in the model is never read, never inserted. (No `input` check here.)
4. **User model has no `pseudonym`** — `get-tables.mjs:130–172`: user `fields` = `{ name, email, emailVerified, image, createdAt, updatedAt, ...options.user?.additionalFields }`. `additionalFields` absent → `pseudonym`/`pfpFilename`/`googleId` are not model fields → dropped.
5. **`pseudonym` is `NOT NULL`, no default** — `drizzle/migrations/0001_initial_schema.sql:79` + `src/db/schema/auth.ts:39` (`text("pseudonym").notNull().unique()`). It is the *only* NOT-NULL-without-default user column Better Auth fails to supply (`name`/`email`/`emailVerified`/`created_at`/`updated_at`/`id` are provided or defaulted) ⇒ `23502`.
6. **Raw throw rolls back the whole create** — `internal-adapter.mjs:56–73`: `createOAuthUser` wraps user + account inserts in one `runWithTransaction`; a thrown user INSERT empties both. `link-account.mjs:106–118` catches, logs `e`, returns `"unable to create user"`.

### Why the surfaced code *is* the proof — and why "re-seed the pool" is wrong

The earlier hypothesis (and `docs/runbooks/staging-provisioning.md` item #2) blamed an **unseeded `identity_pool`** → `consumeIdentityPoolTuple` returns `null` → hook throws `APIError("SERVICE_UNAVAILABLE", "identity_pool_exhausted")`. **That is a different, earlier failure, not this bug:**

- `link-account.mjs:108–112` — an `APIError` throw returns `{ error: e.message }`, i.e. the client would see **`identity_pool_exhausted`**. The client actually sees **`unable_to_create_user`** — the `113–117` branch, reached **only for a non-APIError throw** (a raw Drizzle/Postgres error). The error code is the discriminator.
- The **2 stranded tuples (RedFox000 / RedWolf001)** confirm the pool *is* seeded and *is* being consumed: `consumeIdentityPoolTuple` committed `assigned_at` in its own transaction (`consume.ts:26–53`), then the user INSERT rolled back in Better Auth's separate transaction. An empty pool would strand nothing.

Re-seeding would not fix it; the failure is downstream of a successful tuple consumption.

---

## The fix (minimal, code-only — no schema/migration change)

Declare the three custom user columns in `user.additionalFields` so Better Auth's model includes them and `transformInput` writes the hook-injected values.

**File changed: `src/server/auth/index.ts`** (one block inside `betterAuth({…})`, sibling to `session`/`advanced`/`socialProviders`):

```ts
user: {
  additionalFields: {
    // Keys are the Drizzle table-property names so getFieldName resolves them
    // to columns pseudonym / pfp_filename / google_id. input:false makes
    // parseInputData REJECT any client-supplied value (anti-spoofing); the
    // databaseHook-injected value still flows through transformInput.
    pseudonym:   { type: "string", required: false, input: false },
    pfpFilename: { type: "string", required: false, input: false },
    googleId:    { type: "string", required: false, input: false }, // see Open decision #1
  },
},
```

- **`input: false`** is security-load-bearing. Without it a client could set their own `pseudonym` in the signup body and bypass the curated `identity_pool`. `parseInputData` (`schema.mjs:40–51`) throws `"<key> is not allowed to be set"` for any client-supplied `input:false` field; hook-injected data never passes through `parseInputData`, so it is unaffected — exactly the posture we want.
- **`required: false`** — value comes from the server-side hook, never the request.
- **`type: "string"`** — all three columns are `text`.

`pfpFilename` and `googleId` are nullable, so they don't *block* the INSERT — but they are *also* being silently dropped today (every user would have `pfp_filename` / `google_id` NULL). Declaring `pfpFilename` is needed for users to get their PFP. `googleId` is Open decision #1.

**Rejected alternatives:** (a) a DB `DEFAULT`/trigger to generate `pseudonym` — breaks the curated FIFO `identity_pool` identity model; (b) making `pseudonym` nullable + back-filling — weakens a deliberate NOT-NULL + UNIQUE identity invariant and is a sensitive-table schema change.

**No migration. No schema change.** ⇒ no `@db-migration-reviewer`, no append-only ritual.

---

## End-to-end test (the standing requirement — closes the coverage gap)

The gap that let this *and* the OTP bug ship: **every** existing auth test mocks at the library boundary (`google.test.ts`/`otp.test.ts`/`session-gate.test.ts` assert the hook *returns* `{ data: { pseudonym } }`, never that Better Auth *persists* it). No test drives the real create-path against a real DB. The fix is **not done** without one.

**New: `tests/integration/signup-create-path.integration.test.ts`** (real test Postgres) — written **first**, RED before the fix, by `@test-writer`.

Design:
- Use the **real `auth`** export (no adapter/hook mocking) against the integration test Postgres (existing pattern: `tests/db/_fixtures/db.ts` + `tests/_setup/env.ts` already supplies the env defaults `auth` validates at import). If a thin harness is needed to reach the context, add `tests/_setup/auth-harness.ts` exposing `await auth.$context`.
- **Seed** ≥1 `identity_pool` tuple, then drive the create-path via `ctx.internalAdapter.createOAuthUser(profilePayload, accountData)` — runs the real `createWithHooks` → `before` hook (consumes a real tuple) → `adapter.create` → `transformInput` → real INSERT. The exact bug surface.
- **Assertions (real rows):**
  1. `createOAuthUser` resolves without throwing. *(RED on unfixed code: Postgres `23502`.)*
  2. `users` row exists; `pseudonym` equals the seeded tuple's pseudonym (non-null, round-trips); `pfp_filename` equals the tuple's `pfpFilename` (locks the silent-drop).
  3. `accounts` row exists: `user_id` = new user, `provider_id` = `google`, `account_id` = the Google `sub`.
  4. The consumed `identity_pool` tuple now has `assigned_at` set.
  5. *(Security)* A client signup attempt that includes `pseudonym` in the body is rejected with `"pseudonym is not allowed to be set"` — proves `input:false` blocks spoofing.
- **email-OTP parity:** add (or extend to) an OTP verify-path case via `auth.api`, mocking only Resend + Turnstile + rate-limit, asserting the same `users`+`accounts`+pool-consumed outcome — both paths share the one `create.before` hook.

RED→GREEN is the live confirmation of the diagnosis (assertion 1 throws the exact `23502` on unfixed code).

---

## Execution sequence (separate execute chat, on Fable 5)

1. Continue on branch `fix/auth-signup-additionalfields` (this plan + session log already committed here off `origin/main`). NOTE: branch from `origin/main` (`bdb4e71…`) — local `main` was stale (`1a18fd5…`) at diagnosis time.
2. `@test-writer` → the integration test above (RED). Run it; capture the verbatim `23502` line.
3. Implement the `additionalFields` block in `src/server/auth/index.ts`. Re-run → GREEN.
4. `ZUGZWANG_ENV=preview just verify` → `pnpm test:integration` + `pnpm test:invariants` (+ full `pnpm vitest run`).
5. Pre-PR self-audit (§5.10), then `@code-reviewer`, then `@security-auditor` (verify no client can supply `pseudonym`/`pfpFilename`/`googleId`; confirm `input:false` on each).
6. PR to `main` (squash, signed). After merge: deploy to staging; operator completes a real Google **and** email-OTP signup (runbook step #2) as the acceptance gate.
- *Caveat:* if the execute session runs on Opus rather than Fable 5, pass `model:"opus"` when spawning the four tracked subagents (their `claude-fable-5` pin dies instantly under Opus).

---

## Open decisions (for web review)

1. **`users.google_id` disposition (SURPRISE).** `google_id` has been silently dropped for every signup (same bug); the Google `sub` already lives in `accounts.account_id`. Either (a) include `googleId` in `additionalFields` to populate it going forward, or (b) treat the column as dead/redundant and drop it in a later schema task. Recommendation: include it now (one line, no migration) and revisit the column's necessity separately.
2. **TASK-ID / tracker placement** — production-auth bugfix, no existing tracker row. Confirm canonical TASK-ID + whether it needs a tracker stratum.

---

## Diagnostic disposition & cleanup

- **No temp instrumentation was written and none should ship.** The source-level proof + error-code discriminator made a staging instrument-and-redeploy unnecessary; the RED integration test is the superior (permanent, local) confirmation. *Fallback only:* if the local harness can't be stood up, a one-line unwrap of `e.cause` (or Better Auth `logger: { level: "debug" }`) around `createOAuthUser` on a throwaway branch prints the same `23502` on staging — clearly marked TEMP, never merged.
- **Stranded tuples RedFox000 / RedWolf001** — leave for the 30-day stale sweep (`consume.ts:16–21`). No action.

---

## Confidence & residual risk

Proven by source inspection of `better-auth@1.6.11` + the surfaced-error discriminator (not a guess). Residual risk is low and fully retired by RED→GREEN: if assertion #1 throws anything other than `23502 / pseudonym`, that is a SURPRISE to surface before implementing — low probability.
