# STAGING-PARITY Slice A — mutation audit

**Date:** 2026-08-06 (overnight, unattended)
**Branch:** `slice/staging-parity-a` · **PR:** #298 (OPEN — nothing merged)
**Baseline commit at start:** `1fc06e6`
**Purpose:** evidence for **Gate C** (items 3–6). Every control in Slice A was
mutated, one at a time, and the verdict recorded.

Every mutation in this audit ran against **LOCAL Postgres (:54322)**. The
staging database was read **once**, read-only, at STEP 0, and never written.

---

## Method

Per control, mechanically, one at a time — never batched, so a verdict names one
cause:

1. state the mutation
2. apply it to the source
3. run the **owning suite**
4. record **RED** (the suite failed → the control is live) or
   **GREEN** (the suite passed → **the control is blind**)
5. `git checkout --` the file
6. re-run the same suite and confirm **GREEN**

Between step 3 and step 5 the local guard catalog is repaired — a split-batch or
missing-enable mutation *commits* the disables, and an un-repaired catalog would
contaminate every later verdict.

**A control that stays GREEN under its mutation is a defect, not a curiosity.**
Each one below was fixed, and the mutation re-fired against the fix.

---

## STEP 0 · Ground

| Check | Result |
|---|---|
| PR #298 | OPEN, `MERGEABLE`, base `main`, head `slice/staging-parity-a` |
| Working tree | clean; local `HEAD` == `origin/slice/staging-parity-a` == `1fc06e6` |
| `git diff main...HEAD` | 19 files, +3197 / −7 — unchanged from the reviewed state |
| staging `bets` | **39** |
| staging `users` | **16** |
| staging `identity_pool` | **200** |
| staging `system_state` | **1 row**, `frozen_at` = **NULL** |
| staging `bucket_%` guards | **78 rows, 0 disabled** |
| staging `drizzle.__drizzle_migrations` | 25 |
| staging `session_replication_role` | `origin` |

Read through `doppler run --config stg` with
`PGOPTIONS=-c default_transaction_read_only=on`. **Staging is untouched.**

---

## STEP 1 · F1 — the unverified assumption

> `SET LOCAL` outside a transaction block emits a WARNING and no-ops. Nothing
> asserted that a multi-statement simple-query implicit transaction counts as a
> transaction block for that purpose.

### F1a · Is `lock_timeout` actually in effect?

**YES.** Measured against local Postgres 17, same batch SHAPE `runGuardedReset`
builds, reading `current_setting('lock_timeout')` from inside the same batch.

Verbatim:

| Case | `current_setting('lock_timeout')` | Server notice |
|---|---|---|
| `SET LOCAL lock_timeout = '15s';` **alone** (negative control) | `"0"` | `WARNING 25P01 · "SET LOCAL can only be used in transaction blocks"` (`xact.c:3691`, `CheckTransactionBlock`) |
| `SET LOCAL …;` + `SELECT current_setting(…)` — one batch | **`"15s"`** | *(none)* |
| `SET LOCAL …;` + `ALTER TABLE … DISABLE TRIGGER;` + `TRUNCATE … CASCADE;` + `SELECT current_setting(…)` + `ALTER TABLE … ENABLE TRIGGER;` — one batch | **`"15s"`** | *(none)* |
| next round-trip, after the batch | `"0"` | *(none)* |

The negative control is what makes the positive one mean anything: the same
statement, same connection, same session — only the batching differs, and the
value differs with it.

**Implicit-transaction proof.** `ALTER TABLE bets DISABLE TRIGGER
bucket_a_no_truncate;` followed by `SELECT 1/0;` in one batch aborts with
`division by zero`, and `tgenabled` reads `O` afterwards. The DDL rolled back.
ADR-0035 primitive 2's mechanism is real at the Postgres level.

### F1b · Is it the simple query protocol?

**YES**, established two ways, neither of them documentation:

- **Source.** `postgres@3.4.9` `src/index.js:119` — `unsafe(string, args = [],
  options = {})` sets `simple: 'simple' in options ? options.simple :
  args.length === 0`. `src/connection.js:189` — `q.options.simple ?
  b().Q().str(…)`, and `src/bytes.js:4` maps `Q` to the byte `'Q'.charCodeAt(0)`
  = the PostgreSQL **Query** frontend message. That is the simple query protocol
  by definition; the extended one is `P`/`B`/`E`.
- **Empirically.** Observed `options.simple === true` for a parameterless
  `unsafe()` and `false` with one parameter. And the server-side consequence:
  `SELECT 1 AS a; SELECT $1::int AS b;` with one parameter is refused with
  **`42601 · cannot insert multiple commands into a prepared statement`**, while
  the parameterless `SELECT 1 AS a; SELECT 2 AS b;` returns **two result sets**.
  Only the simple query protocol can carry multiple commands, so a batch that
  executes at all executed as a simple query.

**Verdict: both hold. No halt.**

### Assertions added (F1)

`buildResetBatch(tables)` was split out of `runGuardedReset`, which is now
`await client.unsafe(buildResetBatch(tables))`. All validation moved into the
builder, so nothing can construct an unvalidated batch.

That split exists for one reason: the integration suite now asserts against the
**real batch text** rather than a lookalike. A test that reassembles its own
batch proves nothing about the shipped one.

| Assertion | Location |
|---|---|
| parameterless `unsafe()` → `options.simple === true`; parameterised → `false` | `staging-reset-mechanism` |
| extended path refuses two commands (`42601`); simple path returns two result sets | `staging-reset-mechanism` |
| **negative control** — the same `SET LOCAL` alone leaves `lock_timeout` at `"0"` | `staging-reset-mechanism` |
| the real `buildResetBatch(TRUNCATE_SET)` binds `lock_timeout` to `LOCK_TIMEOUT` | `staging-reset-mechanism` |
| it reverts to `"0"` the moment the batch ends | `staging-reset-mechanism` |
| a DISABLE followed by an in-batch failure rolls the DDL back | `staging-reset-mechanism` |
| the batch is sent as exactly **one** `client.unsafe` round-trip | `runner-gating` |

---

## STEP 2 · F2 — the misleading message

`afterAll` runs even when `beforeAll` throws. It reported
`G-4 FAILED after the run` on both paths — and on a **destructive** artifact
that reads as *"staging was wiped, then verification failed"*, the worst news
this runner can deliver. The truth may be that a guard refused and **nothing
ran**. An operator reading it at 2am reaches for `BREAK_GLASS.md` for a database
nobody touched.

**Fix.** `batchCommitted` is set on the line after `runGuardedReset` **resolves**
— the only point at which the implicit transaction is known to have committed.
`afterAll`'s catch selects between two messages:

- committed → `G-4 FAILED AFTER THE DESTRUCTIVE BATCH COMMITTED. Staging WAS
  wiped and post-run verification did not pass — the database needs attention:`
- not committed → `G-4 failed, but THE DESTRUCTIVE BATCH NEVER RAN — the run was
  refused before it started, so this run did NOT wipe staging. What follows
  describes the database as it already was, not damage this run caused:`

Asserted by `runner-gating` — flag set after the reset call, both arms present in
the hook, and the non-destructive arm says so in words. Mutation-verified below.

---

## STEP 3 · The mutation sweep

Legend — **RED** = the control caught it. **GREEN** = the control was blind
(a defect; fixed, then re-fired).

### GROUP 1 · Atomicity — the assertion ADR-0035 rests on (Q-J)

| # | Mutation | Verdict | Owning suite | Defect found | Fix |
|---|---|---|---|---|---|
| **M1** | Split the single `client.unsafe()` batch into one round-trip per statement | **RED** (3 fail) | `staging-reset-mechanism`, `runner-gating` | — | — |
| **M2** | Remove the `TRUNCATE` from the batch, leaving disable+enable | **RED** (2 fail) — **but its own owning control stayed GREEN** | `staging-reset-mechanism` | `it("empties the truncate set …")` **seeded nothing**. Earlier cases in the file leave the database empty, so counting zero after a reset that never truncated still read as zero. A pre-state of zero makes a post-state of zero unfalsifiable — the control read as coverage while asserting nothing about the statement it is named for. | `seedTwoRows()` inserts one `identity_pool` and one `verifications` row (both dependency-free, two different buckets), asserts both non-empty, and only then resets and asserts zero. |
| **M2-refire** | as M2, against the fix | **RED** (3 fail, incl. `empties the truncate set …`) | `staging-reset-mechanism` | — | — |
| **M3** | Remove the trailing `ENABLE` statements | **RED** (10 fail) | `staging-reset-mechanism` | — | — |

**M1 detail — the one that mattered most.** ADR-0035's primary mechanism is that
the guards *cannot* be left off because they are never committed off. Split into
separate round-trips, the failing `TRUNCATE` no longer rolls the disables back,
and three assertions fire: both atomicity cases and the new one-round-trip shape
check. The proof is **not** decorative.

**M3 detail.** The mutation commits 25 guards in the `off` state. Local repair
put them back before the revert re-run; the revert re-ran GREEN.


### GROUP 2 · The guard contract — one mutation per sub-check

Owning suite for G-1/G-2/G-5 is `tests/unit/staging/reset-guard.test.ts`; for
G-3/G-4 it is `tests/integration/staging-reset-mechanism.integration.test.ts`.

#### G-1 · target

| # | Mutation | Verdict | Defect / fix |
|---|---|---|---|
| G1-a | `if (!url)` neutered | **RED** (2) | see *the two "set but empty" cases* below |
| G1-b | `if (!fragment)` neutered | **RED** (1) | same |
| G1-c | `if (!url.includes(fragment))` neutered | **RED** (2) | — |
| G1-d | `if (url.includes(PRODUCTION_PROJECT_REF))` neutered | **RED** (6) | — |
| G1-e | `fragment.length < MIN_FRAGMENT_LENGTH` removed | **RED** (3) | — |
| G1-f | `/^[a-z0-9]+$/` removed | **GREEN — BLIND** | **the alphanumeric half of the shape check was asserted by nothing.** Every existing non-alphanumeric fixture (`<ref>.supabase.co`) is *absent from the URL*, so with the regex gone `url.includes(fragment)` refused it anyway and the case — which asserts only `ok === false` — still passed. To reach the regex a fragment must be long enough, non-alphanumeric, **and genuinely a substring of the DSN** — exactly what an operator produces by pasting part of the connection string. **Fix:** two cases, `postgres.<ref>` and `aws-1-ap-south-1.pooler.supabase.com`, each asserting a precondition that it IS in the URL and that the reason names `alphanumeric`. |
| G1-f-refire | as G1-f, against the fix | **RED** (2) | — |
| G1-g | `PRODUCTION_PROJECT_REF = ""` | **RED** (12) | — |
| G1-h | `PRODUCTION_PROJECT_REF` truncated to 13 chars | **RED** (1) | only the shape assertion catches it — expected, and already documented at Q-A: the refusal-path cases interpolate the constant, so they are satisfied by whatever it holds |
| G1-i | `env.DATABASE_URL_STAGING ?? env.DATABASE_URL` | **RED** (1) | — |

**The two "set but empty" cases.** `DATABASE_URL_STAGING: ""` and
`STAGING_PROJECT_REF_FRAGMENT: ""` each asserted `ok === false` and nothing more.
With their own refusal deleted, both still refuse — an empty URL reaches the
fragment check, an empty fragment reaches the length check — so a *true verdict
for the wrong reason* kept them green. Same silent-weakening shape Q-I closed
elsewhere. Both now pin `/is not set/`. (Their `undefined` siblings did go RED,
which is why G1-a/G1-b read RED overall.)

#### G-2 · environment · G-5 · intent

| # | Mutation | Verdict |
|---|---|---|
| G2-a | unset accepted | **RED** (1) |
| G2-b | `"prod"` accepted | **RED** (1) |
| G2-c | `"unknown"` accepted | **RED** (1) |
| G5-a | ack token unset accepted | **RED** (1) |
| G5-b | ack token wrong value accepted | **RED** (1) |

#### G-3 · live connection — **THE LARGEST GAP IN THE SLICE**

| # | Mutation | Verdict |
|---|---|---|
| G3-probe | `session_replication_role` refusal removed | **GREEN — BLIND (entire surface)** |

Deleting the refusal that @security-auditor added — the one covering the
`?options=-c session_replication_role=replica` escape hatch, under which **no
trigger fires at all** while G-4's catalog still reads a clean 78/all-enabled —
left **every staging suite green**. Nothing at any level called
`assertLiveConnection`.

Two things made it invisible:

1. `reset-guard.test.ts`'s header states that "G-3 (live connection) and G-4
   (post-run verification) need a socket and are exercised by
   `tests/integration/staging-reset-mechanism`". G-4 was. **G-3 was not.** The
   claim read as coverage.
2. `runner-gating` asserts that the *call* to `assertLiveConnection` appears in
   `beforeAll` ahead of the destructive `it()`. That is a statement about
   **lexical position**, not about what the function does. All five refusals —
   options unreadable, fragment absent from `user@host`, non-Supabase host,
   wrong `current_database()`, `session_replication_role` — shipped unasserted.

**Fix — eight cases.** Localhost is the right fixture for three of them: the real
client dials `postgres@localhost`, which is precisely what G-3 exists to refuse,
so they need no double at all. The two that require a Supabase-shaped host to be
reached run through a `Proxy` that overrides **only** `options` and forwards
every query to the real local server — so `current_database()` and
`session_replication_role` are the **server's** answers, not a fixture's. The
wrong-database case connects to the local cluster's second database
(`_supabase`); the replica case sets the GUC on a **dedicated** client and then
asserts the shared session never moved.

| # | Mutation | Verdict |
|---|---|---|
| G3-a | driver options unreadable → accepted | **RED** (1) |
| G3-b | fragment absent from `user@host` → accepted | **RED** (1) |
| G3-c | non-Supabase host → accepted | **RED** (2) |
| G3-d | wrong `current_database()` → accepted | **RED** (1) |
| G3-e | `session_replication_role = replica` → accepted | **RED** (1) |

#### G-4 · post-run verification

| # | Mutation | Verdict | Defect / fix |
|---|---|---|---|
| G4-a | guard-disabled check neutered | **RED** (1) | — |
| G4-b | `systemState.length !== 1` neutered | **GREEN — BLIND** | The case asserted `rejects.toThrow(/system_state/i)`. Delete the row-count branch and the `else if` becomes the only branch, so `systemState[0]?.frozen_at` is `undefined`, `undefined !== null` is true, and **G-4 reports the freeze sentinel as FROZEN when it is ABSENT**. One state needs a re-seed; the other is unrecoverable. `/system_state/i` matched both. **Fix:** assert `/system_state must hold exactly 1 row, saw 0/`, and that it does *not* report `frozen_at is not NULL`. |
| G4-b-refire | as G4-b, against the fix | **RED** (1) | — |
| G4-c | `frozen_at !== null` check neutered | **RED** (1) | **no test existed.** `verifyPostReset` checked it; nothing exercised it. The freeze is a one-shot Bucket-B transition, so a staging database that acquires one is read-only **forever** and can never be reset again — G-4 is the only thing between that and a green run report. **Fix:** a case that sets `frozen_at` inside `BEGIN`/`ROLLBACK` on the pinned client. **LOCAL ONLY — never written to staging or production.** |
| G4-d1 | ledger-emptied check neutered | **RED** (1) | — |
| G4-d2 | ledger-retention check neutered | **RED** (1) | — |
| G4-e | catalog-count check neutered | **RED** (1) | **no test existed.** ADR-0030's forward obligation moves this number whenever a protected relation or `events` partition is added; without a negative case the constant could stop matching reality with nothing noticing until an operator was already pointed at the live database. **Fix:** create an extra `bucket_%` trigger inside `BEGIN`/`ROLLBACK` — adding is reversible where dropping one would leave a window with the database unguarded — and assert the count refusal fires while every guard is still enabled, so only the count arm can be what refuses. |

### GROUP 3 · The structural prohibitions

| # | Mutation | Verdict | Owning suite | Defect / fix |
|---|---|---|---|---|
| M-a | add `bucket_a_no_update` to `DISABLED_TRUNCATE_GUARDS` | **RED** (3) | `guard-list-parity` | — |
| M-b | add `system_state` to `TRUNCATE_SET` | **RED** (13) | `staging-reset-mechanism` | — |
| M-c | pass an injection string to `runGuardedReset`'s `tables` | **RED** (9) | `staging-reset-mechanism` | **`assertSafeIdentifiers` had NO test.** Its own comment calls it "the single path by which a `_no_update`/`_no_delete` guard could be left off" (@security-auditor) — the one primitive-3 prohibition enforced in code rather than by the storage layer — and nothing exercised it. It is load-bearing precisely *because* of the atomicity everything else relies on: a payload appending its own `ALTER TABLE … DISABLE TRIGGER bucket_a_no_update` would make the whole batch **succeed**, and therefore **commit**. **Fix:** ten cases including that exact payload, plus a positive control so the negatives cannot pass by matching nothing. |
| M-d | remove `tests/staging/**` from `vitest.config.ts` | **RED** (2) | `runner-isolation` | — |
| M-e | `EXPECTED_GUARD_CATALOG_ROWS` 78 → 77 | **RED** (8) | `guard-list-parity`, `staging-reset-mechanism` | — |
| M-f1 | rewrite the `beforeAll` guard block as an `it()` | **RED** (7) | `runner-gating` | — |
| M-f2 | downgrade the module-scope refusal from `throw` to `console.error` | **GREEN — BLIND** | `runner-gating` | see below |
| M-f2-refire | as M-f2, against the fix | **RED** (2) | `runner-gating` | — |

**M-b detail.** Both halves of the prohibition were confirmed: the shipped-set
assertion (`names no excluded table…`) fails, **and** the still-live storage
guard aborts the batch — twelve further cases fail because `runGuardedReset`
now raises against `system_state`'s never-disabled `bucket_b_no_truncate`. The
"active defense" the exclusion design depends on is real.

**M-f1 — the overnight critical — passes.** Rewriting a guard as an `it()` block
is the exact CRITICAL @code-reviewer found at Slice A, and `runner-gating` (the
file minted in response) detects its own regression: seven assertions fire.

**M-f2 — the variant that did NOT.** Downgrading the *module-scope target
refusal* from `throw` to `console.error` left `runner-gating` entirely green. The
message stays exactly where it was; only the construct that stops the run
changes. Three things let it through:

- `throws on a failed target guard before constructing a client` checked the
  refusal message's **position** relative to `postgres(target.url` — not that it
  is a `throw`;
- the every-runner `refuses by throwing` check matched `/throw new Error/`
  anywhere in the preamble, satisfied by the **`beforeAll`** throws;
- `no guard is written as a failable it()` does the same preamble match.

At runtime the runner would then build a client from an `undefined` URL and let
postgres-js resolve a target out of ambient environment.

`tsc` **does** catch it — `StagingTarget` is a discriminated union, so `target.url`
stops narrowing and three `TS2339`s fire — which is a genuine second net, and
recorded here as one. But the typecheck is a different gate, and `runner-gating`
is the file whose entire job is the gating property; `pnpm vitest run` alone
would not have noticed. **Fix:** the reset's own case binds the message to a
`throw new Error(` within 60 characters, and the every-runner loop now requires
the throw to follow the target guard's `.ok` check rather than appearing
anywhere in the preamble — generic across the generator/gate runners Slices B–D
will add under the same config.

### GROUP 4 · The Q-I survivors

Each Q-I fix re-verified by reintroducing the defect it was written to catch.

| # | Mutation | Verdict | Owning suite |
|---|---|---|---|
| QI-1 | wrap the `runGuardedReset(client, …)` call across lines so the needle misses | **RED** (3) | `runner-gating` |
| QI-2a | `_fixtures/truncate` positive control's pattern goes stale (runner arm) | **RED** (1) | `runner-gating` |
| QI-2b | same, `_lib` arm | **RED** (1) | `runner-gating` |
| QI-3a | `statement_timeout` positive control's pattern goes stale | **RED** (1) | `runner-gating` |
| QI-3b | the `mechanism` read points at the wrong file | **RED** (4) | `runner-gating` |
| QI-3c | `lock_timeout` positive control's pattern goes stale | **RED** (1) | `runner-gating` |
| QI-4a | `include` removed from `vitest.config.ts` | **RED** (1) | `runner-isolation` |
| QI-4b | staging config's `exclude` is a bare string, not an array | **RED** (1) | `runner-isolation` |
| QI-5a | `parseDroppedTables` loses `IF EXISTS` handling | **RED** (1) | `guard-list-parity` |
| QI-5b | `parseDroppedTables` loses comma-list handling | **RED** (1) | `guard-list-parity` |
| QI-5c | `parseDroppedTables` strips quotes AFTER the qualifier | **GREEN** | `guard-list-parity` |
| QI-5d | `parseCreateTriggers` matches nothing | **RED** (8) | `guard-list-parity` |

**QI-5c is NOT a coverage gap — the comment was wrong.** It claimed the other
order "leaves `\"a` from `\"public\".\"a\"`, because the inner quotes are not
anchored". It does not: `/^.*\./` is **greedy**, so it consumes through the last
dot, quotes included. Checked across eight `DROP TABLE` shapes — **zero differ**.
The swap is not a defect, so no assertion could or should have caught it.
Recording it as missing coverage would have been the wrong call. The comment is
corrected instead: a comment describing a bug that is not there sends the next
reader after the wrong thing, which is the exact failure Q-I exists to prevent.
What is genuinely load-bearing there is the `/^\w+$/` filter, and the comment
now says so.

### GROUP 5 · What cannot be mutation-verified

Named rather than left silently unproven. A mutation sweep can only show that an
assertion detects a defect; it cannot manufacture an assertion for something no
test could observe.

**1 · Rotation of `PRODUCTION_PROJECT_REF`** *(named in the brief)*. The
refusal-path cases INTERPOLATE the constant, so they are satisfied by whatever it
holds — a stale value included. Blanking, truncation and placeholder text **are**
caught (G1-g RED on 12 cases, G1-h RED on the shape assertion); rotation is not.
A second copy of the literal would not detect it either and would cost the
single-constant property. **Owner: the runbook docket row** "Supabase project
restore or ref change → update `PRODUCTION_PROJECT_REF` and re-verify the guard".
And this is the SECOND net regardless: G-1's positive fragment match is primary
and is not name-based.

**2 · That `STAGING_PROJECT_REF_FRAGMENT` names STAGING.** The guard proves the
URL contains *the configured fragment*. Nothing in code can prove the configured
value is staging's ref rather than some third project's. Same class as 1, same
owner.

**3 · G-3 is not an independent oracle.** Already stated in its docblock and
restated here because the new G-3 tests could be mis-read as closing it: the
session pooler exposes **no project-discriminating server-side fact** —
`current_database()` and `current_user` read `postgres` on every Supabase
project, staging and production alike. G-3 asserts things about the connection
the driver opened. The sweep proves each of its five refusals fires; it cannot
add a discriminator the pooler does not offer.

**4 · The belt on SIGKILL / OOM / a dropped socket.** `reEnableGuards` sits in a
`finally`, which does not run on any of them — that is *why* ADR-0035 demotes it.
Proving it would mean killing a process mid-transaction, which is a statement
about the runtime rather than about this code. The property that actually matters
— the DISABLE is never committed, so those failures cannot strand a guard off —
is proven three times over by server-side aborts (M1, M2, M3).

**5 · The staging runner has never been RUN, and cannot be.** Executing
`tests/staging/reset.staging.test.ts` wipes the live staging database. Every
assertion about it is therefore **source-structural** — `runner-gating` reads the
file. Mutation testing verifies its SHAPE, never its BEHAVIOUR. Specifically
unproven at runtime:

- the pre-flight "guards are already disabled" refusal
- the pre-flight catalog-count refusal
- the `TRUNCATE_EXCLUSIONS` ∩ `TRUNCATE_SET` refusal
- the belt's `.catch()` logging path
- the **F2** message selection as rendered on a real refusal (the branch's
  presence is asserted; the string an operator would actually see is not)
- the closing re-seed instruction

**"runner-gating is green" must not be read as "the runner has been run."** This
gap is inherent to a destructive artifact and is the reason ADR-0036 exists.

**6 · That Vitest HONOURS `vitest.staging.config.ts`'s include.** `runner-isolation`
reads the resolved config object; whether Vitest obeys it is Vitest's behaviour,
and finding out means running the destructive artifact. The **exclusion** half is
empirically demonstrated — every `vitest run` in this session, including the
full-suite run at STEP 5, collected zero staging runners — but the inclusion half
is not.

**7 · `pnpm staging:reset`'s `&&`-chained `db:seed:staging`,** and the
`doppler run --config stg` wrapper that supplies the secrets. Both are external
to the test surface and exercisable only by a real run.

**8 · Whether `15s` is the RIGHT lock timeout.** The sweep proves the value
binds; whether it is long enough for a legitimate lock wait and short enough to
avoid a self-inflicted staging outage is a judgement, not a property. A
lock-contention test *could* prove the bound fires, at ~15s of wall-clock on
every integration run — deliberately not added, and recorded here instead so the
cost/benefit is visible rather than implied.

**9 · A new `events` partition added WITHOUT its statement-level guard.** The
narrow live gap in ADR-0030's forward obligation. `guard-list-parity` derives its
expectation from the same migration SQL, so a migration that is *itself* wrong
has both sides move together and agree. `EXPECTED_GUARD_CATALOG_ROWS` moves with
it. And the "accounts for every public base table" query explicitly excludes
`events\_%`, so the partition is invisible there too. A reset would then truncate
it *because* it is unguarded, and nothing would report the omission. **Process
control, not a test** — the obligation belongs to whoever writes the partition
migration. (A NON-partition protected table added without triggers **is** caught,
by that same accounting query — verified: it fails when a table appears in none
of the three lists.)

**10 · The unratified survivors' "cost is zero today"** (`cron_alarms`,
`watermark_state`). A ruling about what staging currently runs, revisited at
STAGING-PARITY-ENV. Not a property any assertion can hold.
