# ADR-0042 — OAuth signup nested pool checkout: drop the adapter transaction

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-27 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | S-3 |
| **Frame document** | SPEC.2 §8.2 (Better Auth wiring) + ADR-0004 (auth flows / session deferral) + ADR-0038 decision 2 (pool ceiling is not moved without measurement) + ADR-0013 (W-1 SERIALIZABLE bet transaction — the unrelated transaction discipline this must not be confused with). Grounded on the S-3 step-4 reproduction run, 2026-08-27, recorded in `docs/logs/` and reproduced by `tests/integration/oauth-signup-pool-deadlock.integration.test.ts`. |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Google OAuth signup nested two connection checkouts inside one four-slot
connection pool, and nothing on either side ended the standoff.

`createOAuthUser` wraps its user-INSERT and account-INSERT in
`runWithTransaction` (`better-auth/dist/db/internal-adapter.mjs:57`, inside the
`createOAuthUser` entry at `:56`), which resolves to a real `db.transaction`
because `transaction: true` was set on the drizzle adapter. One pooled
connection is held for the duration of that transaction. Inside it,
`databaseHooks.user.create.before` calls `consumeIdentityPoolTuple(db)` against
the **module-level `db`** rather than the transaction handle, and
`src/server/identity-pool/consume.ts:28` opens **its own** `db.transaction` — a
**second** checkout from the **same** pool.

`src/db/index.ts:96` sets `max: 4`. Four concurrent OAuth signups each hold one
slot and each wait for a second slot that no one will release. postgres.js has
no acquire timeout.

**Four unauthenticated requests wedge an instance, and that instance then fails
every route it serves.** This is an availability defect, not a throughput one.

Email-OTP signup is unaffected: `createUser`
(`internal-adapter.mjs:75`) is a bare `createWithHooks` and opens no transaction
at any layer.

This ADR does **not** decide:

- The pool ceiling itself. `max: 4` is unchanged and stays unchanged (ADR-0038
  decision 2; S-5 measures).
- The session-deferral gate or the ToS re-attempt endpoint (ADR-0004).
- Stranded-tuple recovery policy — the stale-30d sweep (**SPEC.1 §13 F-AUTH-4**, "Stale unaccepted users").
- Reactive moderation, RLS, or anything under `supabase/` (ADR-0021, ADR-0019).
- Whether implicit OAuth account linking *should* be enabled. This ADR records
  that it is on by vendor default; it does not ratify enabling anything.

## Decision Drivers

1. **Availability under unauthenticated load.** The Google callback carries no
   rate limit of ours — Turnstile is matched to the email-OTP send path only,
   and `src/server/auth/index.ts` records the Google callback as *"explicitly
   excluded so a Cloudflare outage doesn't take both auth paths down."* The
   door is open by design.
2. **Nothing reaps the wedge.** Measured, not assumed (see Severity).
3. **The fix must not move the pool ceiling.** ADR-0038 decision 2 forbids
   acting on the "a higher `max` is permissible" relaxation without measurement.
4. **The blast radius must be traceable to one reachable behaviour**, because
   this is a critical-path auth surface (CLAUDE.md §1).
5. **The reproduction must exist before the fix.** V-2: a green concurrency test
   with no red before it is indistinguishable from a test that never applied
   concurrency.

## Considered Options

1. **Drop the adapter transaction (`transaction: false`)** ← chosen
2. Consume the identity-pool tuple in `mapProfileToUser` instead of the
   `create.before` hook (Candidate B)
3. Pass the transaction handle into `consumeIdentityPoolTuple`
4. Raise `max`

## Decision Outcome

**Chosen: Option 1 — set `transaction: false` on the drizzle adapter.**

One line, `src/server/auth/index.ts` — the `transaction` key of the `drizzleAdapter(db, {...})` call in the `betterAuth({...})` config (fenced by symbol, not line — see the note below):

```diff
-		transaction: true,
+		transaction: false,
```

⚠ **Why this is fenced by symbol, and why the example is this very commit.**
The first draft of this ADR cited the flag by line. **The same commit that
carries the fix invalidated that citation** — it adds explanatory comment lines
directly above the flag, which pushed it down the file, and a later trim of
those same comments moved it again. The draft said `:346`; by the end of the
commit it was `:342`; a subsequent one-line comment edit made it `:343`.

⇒ **A line number written in the same commit that moves the line was never
true for a single published state of the tree.** That is a sharper case than
ordinary drift: it did not go stale over time, it was stale on arrival. The
test docblock carried the same defect from the other direction, citing the
pre-fix `:335` that this commit invalidated.

**Both now fence by symbol** — the `transaction` key of the
`drizzleAdapter(db, {...})` call — and this paragraph deliberately quotes the
dead numbers rather than a live one, because a live one would restart the
cycle it exists to describe. O-8.

### ⛔ The real payload: `transaction: true` is a CAPABILITY, not a STATE

**This is the sentence this ADR exists to record, because misreading it put the
defect on the wrong door for five days.**

The flag does not "turn transactions on." It decides what `adapter.transaction`
*does when something calls it*, and changes nothing for any path that never
calls it. In source:

- `@better-auth/core/dist/db/adapter/factory.mjs:29` —
  `transaction: cfg.transaction ?? false`. The default is `false`.
- `factory.mjs:400-409` — `adapter.transaction` is lazily bound: when
  `config.transaction` is falsy it becomes `createAsIsTransaction(adapter)`, a
  **pass-through that runs the callback without opening anything**; when truthy
  it becomes the provided implementation.
- `@better-auth/drizzle-adapter/dist/index.mjs:465` — the provided
  implementation, and the whole mechanism in one line:

  ```js
  transaction: config.transaction ?? false ? (cb) => db.transaction((tx) => {
      return cb(createAdapterFactory({ config: { ...adapterOptions.config,
          transaction: false },
  ```

  A **real drizzle transaction on one pooled connection**.

⚠ **Note what that inner `transaction: false` is doing, and what it cannot do.**
Better Auth deliberately builds the inner adapter with the capability disabled,
so adapter operations *inside* a transaction cannot recursively open another
one. That guard is real — and it is powerless here, because
`consumeIdentityPoolTuple(db)` does not go through the adapter at all. It
reaches for the module-level `db` and opens a transaction the adapter never
sees. **The vendor guards the path through itself; a databaseHook that bypasses
it is outside that guard.**

Reading `transaction: true` and inferring "signup is transactional" is therefore
a category error in both directions: most paths are unaffected, and the one that
is affected is affected in a way the flag's name does not suggest.

### Blast radius, traced

Six sites reference the adapter transaction; four are definitions, re-exports,
or unreachable in this deployment. **Exactly one reachable behaviour changes** —
`createOAuthUser` stops wrapping its two INSERTs in one transaction.

- `internal-adapter.mjs:671` (`consumeVerificationValue`) — reached only by
  `magic-link` / `oidc-provider` / `mcp`, none enabled. Dead here.
- ⛔ `sign-up.mjs:141` (email + password) — **REACHED, but throws before any DB
  operation.** `signUpEmail: signUpEmail()` is registered **unconditionally**
  (`better-auth/dist/api/index.mjs:117`), so `POST /api/auth/sign-up/email` is a
  live route, and `runWithTransaction` at `:141` wraps the `emailAndPassword`
  guard at `:142` rather than sitting behind it. Under `transaction: true` every
  such unauthenticated request therefore opened a real Postgres transaction — a
  pool checkout — and immediately threw. Under `transaction: false`
  `createAsIsTransaction` opens nothing. **No DB write occurs either way.**
- `factory.mjs` `consumeOne` fallback — gated on the adapter lacking
  `consumeOne`; the drizzle adapter has one.
- The live email-OTP path is `atomicVerifyOTP`
  (`plugins/email-otp/routes.mjs:777-799`), **already fully non-transactional
  today** — named atomic and is not (finding `S3-2`, report only).

⚠ **DIVERGENCE FROM THE RATIFIED PLAN, recorded here deliberately.**
`docs/plans/S-3.md` at `6150f27` traces **four** unreachable sites. The step-7
cascade established **three**: `consumeVerificationValue` and the `consumeOne`
fallback are confirmed dead, but `sign-up.mjs:141` is reached-and-throws, not
dead. **The plan is NOT amended** — it is ratified, and a silent edit to a
ratified document is how a divergence stops being visible. The correction lives
here and goes to the founder at Gate C.

⇒ **Consequence: the pre-fix surface was slightly LARGER than either the plan or
the first draft of this ADR claimed.** An unauthenticated caller could take a
pool slot for the duration of a doomed sign-up request — a second lever on the
same four-slot pool. **The fix removes that lever, and never took credit for
doing so.** The direction is favourable, which is exactly why it was easy to
miss: nobody audits a trace for being too pessimistic.

**No test on `origin/main` asserts that a Better Auth adapter write is
transactional.**

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Better Auth adapter transaction capability | `src/server/auth/index.ts` |
| Identity-pool tuple allocation (own transaction) | `src/server/identity-pool/consume.ts` |
| Connection pool ceiling | `src/db/index.ts` |
| The permanent regression guard | `tests/integration/oauth-signup-pool-deadlock.integration.test.ts` |

## Severity — MEASURED, not predicted

Reproduced 2026-08-27 on a local Postgres 17.6, **session** pooler mode, against
unfixed code, at N = `db.$client.options.max` = 4:

| Observation | Value |
|---|---|
| Signups resolved | **0 of 4** |
| Signups hung | **4 of 4** |
| Backends `idle in transaction` | **4** |
| `wait_event_type` / `wait_event` | `Client` / **`ClientRead`** |
| **`last_query`** | **`"begin "` — and nothing after it** |
| `now() - xact_start` | ~**5.92 s** and climbing when sampled |
| Consecutive identical poll samples | **154** (of 156 taken; first 2 were pre-burst warm-up) |
| Intersection of pids across the window | **4 — equal to N** |
| What ended the standoff | **the test's own 20 s deadline race** |

⛔ **`last_query` is `begin` with nothing after it.** That is the mechanism
caught mid-act: each backend opened its transaction, the hook then asked the same
pool for a second connection, none was available, and the client never sent
another statement. The server waits on the client; the client waits on the pool;
the pool waits on the four transactions.

**Nothing server-side ended it.** Measured on the reproduction database:
`idle_in_transaction_session_timeout = 0`, `idle_session_timeout = 0`,
`statement_timeout = 0` — and `statement_timeout` never arms anyway on a backend
that is idle inside an open transaction, because it is running no statement.
`maxDuration` is unset repo-wide.

At N = 3 (one below `max`) the same instrument is clean: 3 of 3 resolve in
233–285 ms, no pid survives the window, intersection 0. **The boundary is
exactly `max`.**

### ⛔ The production threshold can be THREE, not four

Four is the **isolated-demonstration** number. A deployed instance serves every
other route, so **three** concurrent OAuth signups plus **one** ordinary request
holding the fourth slot wedges at three. Do not read "four concurrent signups"
as the production trigger.

### ⚠ Supavisor's cleanup behaviour is UNMEASURED

`SHOW` reports the Postgres backend, not the pooler in front of it (recon-2
H-3). What is established is that **Postgres reaps nothing** here. **Do not
generalise that into "nothing reaps it."** Whether Supavisor eventually
recycles a client connection in this state has no in-repo source and was not
measured.

Also still unmeasured: whether postgres-js's `idle_timeout: 20` /
`max_lifetime: 600` fire during a wedge (H-4), and Vercel's default function
duration for this project (H-5).

## Q-P1 — does the fallback self-heal an orphan? **YES.**

Candidate A trades user+account atomicity (below), so the question is whether a
`users` row left without an `accounts` row recovers on the next sign-in.

**Part 1 — the fallback is unconditional.**
`better-auth/dist/db/internal-adapter.mjs:440-460`, the `else` arm taken when
the `(providerId, accountId)` lookup returns nothing:

```js
else {
    const user = await (await getCurrentAdapter(adapter)).findOne({
        model: "user",
        where: [{ value: email.toLowerCase(), field: "email" }]
    });
    if (user) return { user, linkedAccount: null, accounts: … };
    else return null;
}
```

**No gate of any kind** — not on `accountLinking`, not on a flag.

**Part 2 — the caller links.** `oauth2/link-account.mjs:17-30`. `&&` binds
tighter than `||`, so the gate at `:22` is four disjuncts, all false here:

| # | Disjunct | Value | Why | Can it drift from our side? |
|---|---|---|---|---|
| 1 | `!isTrustedProvider && !userInfo.emailVerified` | false | google.mjs spreads `userMap` last, so `mapProfileToUser`'s `emailVerified: true` wins; `oauth_email_not_verified` throws otherwise | ⚠ **two levers, both absent today** — Google`s `email_verified` (a vendor constant) AND `account.accountLinking.trustedProviders`, which resolves to `[]`. Setting it to `["google"]` makes this disjunct false **regardless** of `email_verified`. Zero hits in our config, so the conclusion holds — but this is a config-dependent `no`, not a constant. |
| 2 | `requireLocalEmailVerified && !dbUser.user.emailVerified` | false | `undefined ?? true = true`, so it turns entirely on the **stored** `users.email_verified` | ⛔ **YES — the fragile one** |
| 3 | `accountLinking?.enabled === false` | false | `undefined === false` | no |
| 4 | `accountLinking?.disableImplicitLinking === true` | false | `undefined === true` | no |

⇒ `linkAccount()` runs ⇒ **the orphan self-heals on the next sign-in.**

**The self-heal depends on TWO email-verification conditions, not one.** Disjunct
1 requires the **incoming Google** email be verified; disjunct 2 requires the
**stored local** email be verified. Both must hold. Disjunct 1 is a vendor
constant against an absent config. Disjunct 2 is ours:
`src/db/schema/auth.ts:37` declares `emailVerified` `.notNull().default(false)`
— **the column default is the lockout value**, and a row that lands `false`
fails disjunct 2 forever without erroring.

> a future change to `mapProfileToUser` that stopped forcing
> `emailVerified: true` would silently reopen the lockout.

Disjunct 2 is covered by
`tests/integration/oauth-orphan-fallback.integration.test.ts`, which builds a
genuine orphan through the real create-path and asserts both that the fallback
finds it and that its stored `emailVerified` is `true`. **Disjuncts 1, 3 and 4
are recorded here rather than tested** — they are vendor constants read against
an absent config and cannot drift from our side; building scaffolding to observe
a constant buys nothing.

⚠ **That test exercises the fallback and disjunct 2 only. It does not exercise
the linking step**, which needs OAuth state, cookies and a token exchange.

### ⛔ First record: implicit OAuth account linking is ON by vendor default

`grep` over `src/server/auth/index.ts` for `account:` / `accountLinking` /
`trustedProviders` / `disableImplicitLinking` / `requireLocalEmailVerified`
returns **zero hits**, so `c.context.options.account` is `undefined` and
`link-account.mjs:22` permits implicit linking.

**This ADR is the first record of that property.** It arrived by *not
configuring* something, no ADR ever ratified it, and Candidate A now depends on
it. As configured it is not a takeover vector — the gate in its place requires
**both** the incoming Google email and the stored local email verified — but it
is an auth-surface property that should be a decision rather than a default.
Nothing is enabled by this ADR; the surface is not widened.

## Consequences

### Positive

- Four concurrent OAuth signups no longer wedge an instance; the instance no
  longer fails every unrelated route it serves.
- The fix is one line on a critical path, with a permanent regression guard that
  has been observed both red and green.
- No configuration is added and no auth surface is widened.
- `max: 4` is untouched, so ADR-0038 decision 2 is respected.

### Negative

- ⛔ **OAuth create loses user+account atomicity.** A failure between the
  user-INSERT and the account-INSERT now leaves a `users` row with no `accounts`
  row. *Acceptable because:* Q-P1 establishes the orphan self-heals on the next
  sign-in via the ungated email fallback, and the window is two adjacent INSERTs
  on one connection with no external call between them. **Recorded even though
  the answer went our way** — the trade is real and is not omitted for being
  convenient.
- **Tuple stranding is unchanged, and PRE-DATES this ADR.**
  `consumeIdentityPoolTuple` commits on its own connection independently of any
  outer transaction (`consume.ts:28`), so a later failure has always been able
  to strand a tuple. Candidate A widens the orphan class from *"tuple only"* to
  *"tuple + users row"*; it does not introduce stranding. Recovery remains the
  stale-30d sweep.
- The email-OTP path had no adapter transaction to begin with, so this ADR gives
  the two signup paths the same (non-transactional) shape — which is a
  simplification, but it also means neither path has adapter-level atomicity and
  no test asserts one.

### Neutral

- **`consume.ts`'s transaction survives the fix byte for byte**, and must: it is
  what makes the `SELECT … FOR UPDATE SKIP LOCKED` + `UPDATE assigned_at`
  allocation atomic. Between those statements there is a client round-trip, and
  for that round-trip the backend legitimately sits `idle in transaction`.
  ⇒ **The post-fix assertion is PERSISTENCE, not PRESENCE.** An assertion of
  "zero backends idle in transaction" would fail a correct fix at the exit
  criterion. The guard therefore intersects pid sets across a window: pre-fix the
  same pids appear in every sample, post-fix they churn.
- ⚠ **the `Stranded-tuple semantic` block (`consume.ts:18-23`)'s own comment is WRONG** and is the first thing a
  reader will find when they ask why a transaction is still there. It states
  that Better Auth's OAuth flow does not wrap user-create in a transaction —
  which is exactly the premise under which nesting a second checkout looks free.
  Finding **`S3-8`**: report, do not fix.
- **Pooler mode measured: SESSION.** Deployed staging runs transaction mode.
  **The wedge is mode-independent**: `max: 4` is one unconditional literal
  (`src/db/index.ts:96`), there is exactly one `postgres()` client and one
  `drizzle()` wrapper, and `DB_POOLER_MODE` selects a **connection string
  only**. The demonstration records the host it actually resolved, so the mode
  is observed rather than assumed.
- Vendor paths cited here resolve through the pnpm virtual store
  (`node_modules/.pnpm/@better-auth+core@1.6.11_…/`), not
  `node_modules/@better-auth/` — a direct lookup there returns nothing and is
  not evidence of absence.

## Pros and Cons of the Options

### Option 1 — `transaction: false` (chosen)

**Pros**

- Removes the outer checkout entirely; the nesting cannot recur by arithmetic.
- One line; blast radius traced to exactly one reachable behaviour.
- Restores the vendor default (`factory.mjs:29`), so the deployment stops
  depending on a non-default whose name misdescribes its effect.

**Cons**

- Loses user+account atomicity for OAuth create (mitigated above).

### Option 2 — consume the tuple in `mapProfileToUser` (Candidate B)

**Pros**

- Moves the second checkout outside the transaction without touching the flag,
  preserving user+account atomicity.

**Cons**

- ⛔ `mapProfileToUser` fires on **every** callback, not only on create. Without
  a mandatory existence guard, a user logging in daily for 51 days burns 51
  tuples out of a finite pool.
- The guard is then load-bearing and easy to regress, and its failure is silent
  until the pool is exhausted.

**Verdict:** Rejected as the primary fix; recorded as the fallback if Option 1's
atomicity loss ever proves unacceptable.

### Option 3 — pass the transaction handle into `consumeIdentityPoolTuple`

**Pros**

- Keeps one connection and preserves atomicity.

**Cons**

- The hook receives no transaction handle; Better Auth's `create.before`
  signature passes the user record, not the adapter's `tx`. Obtaining one means
  depending on vendor-internal context plumbing.
- It would also fold tuple allocation into the outer transaction's fate, so a
  later rollback un-allocates a tuple — a behaviour change to identity
  assignment that no ADR ratifies.

**Verdict:** Rejected. Requires vendor-internal coupling to fix a defect that a
supported configuration flag removes outright.

### Option 4 — raise `max`

**Pros**

- Would postpone the symptom.

**Cons**

- ⛔ **Disqualified by ADR-0038 decision 2**, which forbids acting on the "a
  higher `max` is permissible" relaxation without measurement. S-5 measures.
- It does not fix anything: the deadlock fires at exactly `max` concurrent
  signups **whatever `max` is**. Raising it moves the threshold and keeps the
  defect. That property is why the regression guard derives N from the shipped
  `max` rather than hard-coding 4.

**Verdict:** Rejected on both counts — forbidden, and not a fix.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §8.2 | Better Auth wiring | **shapes** — the drizzle adapter runs with `transaction: false`; OAuth create is not adapter-transactional |
| ADR-0004 | auth flows / session deferral | **consumes** — unchanged; the session gate is not redefined by this ADR |
| ADR-0038 decision 2 | pool ceiling | **consumes** — `max` is not moved; S-5 owns that measurement |
| SPEC.1 §5 INV-1…INV-4 | the four hard-locked invariants | **none touched** — no Dharma, bet, comment, side-binding or resolution behaviour changes |
| SPEC.1 §13 F-AUTH-4 | stale-30d sweep | **consumes** — remains the recovery path for stranded tuples, which pre-date this ADR |
| ADR-0017 | reply-as-bet | untouched |
| Tracker | S-3 | Depends on this ADR being `accepted` |

## More Information

- `better-auth@1.6.11` — `dist/db/internal-adapter.mjs` (`:56`/`:57`
  `createOAuthUser` + `runWithTransaction`; `:75` `createUser`; `:440-460` the
  email fallback), `dist/oauth2/link-account.mjs:17-30` (the four disjuncts).
- `@better-auth/core@1.6.11` — `dist/db/adapter/factory.mjs:29` (the `false`
  default), `:400-409` (lazy `adapter.transaction` binding).
- `@better-auth/drizzle-adapter@1.6.11` — `dist/index.mjs:465` (the real
  `db.transaction`, and the inner `transaction: false` guard).
- Reproduction: `tests/integration/oauth-signup-pool-deadlock.integration.test.ts`.
- Characterisation: `tests/integration/oauth-orphan-fallback.integration.test.ts`.
- `docs/plans/S-3.md` — the ratified plan, constraints C-1 … C-4.

---

*ADR-0042 ratifies dropping the Better Auth drizzle adapter's transaction
capability so that OAuth signup no longer nests a second pool checkout inside
its own transaction. The decision body and the constraints minted in §Decision
Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2
update per the SPEC.2 §0 versioning policy.*
