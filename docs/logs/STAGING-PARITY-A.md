# STAGING-PARITY Slice A — the guarded staging reset

> **Session:** 2026-08-05 → 2026-08-06 IST, overnight/unattended.
> **Branch:** `slice/staging-parity-a` · **Base:** `cd467f1` (post-ADR main).
> **State at close:** PR OPEN, **NOT merged**. Gate C (human diff-read) is owed.
> **The reset has NEVER been run against staging.** Local Postgres only.

---

## What landed

**PR #297 — the two ADRs** (docs-only, merged, squash SHA `cd467f19`).
Web-authored, committed verbatim (md5-verified against source; 182 and 180
lines; closing paragraphs intact). No renumbering — the ceiling was still 0034.

- `docs/adr/0035-guarded-staging-reset.md`
- `docs/adr/0036-vitest-context-operational-runners.md`

**PR #298 — Slice A** (open, unmerged). Three commits:

| SHA | What |
|---|---|
| `5301db7` | the implementation, tests-first |
| `193c9a1` | `@code-reviewer` findings, incl. two CRITICALs |
| `915aff7` | `@security-auditor` findings, incl. one HIGH |

Files:

- `vitest.staging.config.ts` — the opt-in operational-runner config.
- `vitest.config.ts` — `tests/staging/**` excluded, mirroring `tests/scale/**`.
- `tests/staging/_lib/guards.ts` — guard predicate + the four constants.
- `tests/staging/_lib/reset.ts` — mechanism, belt, G-3, G-4.
- `tests/staging/reset.staging.test.ts` — the operational runner.
- `tests/unit/staging/{reset-guard,guard-list-parity,runner-isolation,runner-gating}.test.ts`
- `tests/integration/staging-reset-mechanism.integration.test.ts`
- `package.json` — `staging:reset` + `staging:reset:exec`.
- `.env.example` — the fragment's real shape (see finding S-2).
- `AGENTS.md` — §3 tree, §9 inventory, new operational-runners bullet.

**Gates:** `just verify` green. Full suite **301 files / 2294 tests** green, no
regressions. The runner exits non-zero with no staging env.

A fourth commit, `1224bd4`, carries the pre-Gate-C amendments (rulings 2, 3, 5)
and touches `docs/adr/0035-guarded-staging-reset.md` besides the files above.

**A second overnight session (2026-08-06) added eight more commits** — F1, F2,
and the mutation sweep. See *Overnight mutation sweep* below and the full
evidence at **`docs/logs/STAGING-PARITY-A-mutation-audit.md`**, which is what
Gate C reads for items 3–6.

---

## Decisions made

**D-1 · The guard and the mechanism are separate functions.** `resolveStagingTarget`
is pure and refuses a localhost URL by construction, so the local-Postgres
integration test cannot go through it. Splitting them is what makes both
testable: the unit tests prove the guard refuses every wrong input, and the
integration test proves the disable → truncate → enable loop against a real
database. Nothing in the split weakens the guard.

**D-2 · `runGuardedReset` has no exclusion-bypass parameter.** The atomicity
test needs a failure injected *after* the DISABLEs execute. Rather than add a
test-only bypass flag — which a security auditor should flag, and would —
the test names `system_state`, whose `bucket_b_no_truncate` is never disabled
(primitive 4). Its still-live trigger raises at execution time. The refusal is
therefore the storage layer's, and it survives any caller.

**D-3 · The belt lives in the runner, not in the mechanism.** With the `finally`
inside `runGuardedReset`, the atomicity test would have proven the *belt*
worked, not that the transaction rolled back. Moving it one layer up lets the
test observe the rollback itself. ADR-0035 primitive 2's "retained as a belt
and explicitly demoted" is satisfied — it is in the runner's `finally`, and
commented as the weaker mechanism.

**D-4 · Q3's truncate set is reproduced verbatim; three tables outside it are
recorded, not added.** See finding O-1.

**D-5 · `@test-writer` was not invoked.** §5.11 routes it to "new business-logic
behavior"; Slice A is config plus tests, and the deliverable *is* the test tree,
so invoking an agent forbidden from editing `src/` to write tests for a test
file is circular. The kickoff's named sequence — `@code-reviewer` then
`@security-auditor` — was followed exactly and sequentially.
`@db-migration-reviewer` likewise does not attach: no `src/db/schema/` or
`drizzle/migrations/` file is touched (the migrations are only *read*, by the
parity assertion).

**D-6 · A fifth guard (G-5, intent / watch-mode refusal) was added.** Additive
to ADR-0035 primitive 6, never a relaxation of it. Rationale under finding S-4;
ratified and named G-5 by the ADR-0035 Addendum (2026-08-06).

---

## Surprises caught + fixed in-session

### Self-audit (§5.10)

Every item PASS. Truncate set is an **exact** match to Q3 — no creep, nothing
missed. `DISABLED_TRUNCATE_GUARDS` is 25 pairs, all `_no_truncate`,
`system_state` absent. No import of `tests/db/_fixtures/truncate.ts`, no `src/`
import in either direction. Guard failure exits non-zero.

**Mutation control, run twice.** Splitting the batch into three round-trips made
both atomicity assertions fail; demoting G-3 back into an `it()` made the
gating assertions fail. Both reverted. The tests have teeth.

### `@code-reviewer` — two CRITICALs

**C-1 · The guards did not gate the destructive step.** G-3 and the pre-flight
were ordinary `it()` blocks. Vitest does not stop a file when a test fails and
no `bail` is set, so a G-3 refusal was followed immediately by the `it()` that
truncates: **the runner would REFUSE and then WIPE, in the same run**, reporting
only a red test. Fixed — G-1/G-2 at module scope (before a client exists), G-3
plus the pre-flight in `beforeAll` (a throwing `beforeAll` fails every test
*without executing any*), and the batch plus its G-4 verification in ONE `it()`.
The reviewer's diagnosis of why it survived — no test at any level asserted the
gating property — produced `runner-gating.test.ts`.

**C-2 · G-3 could never have succeeded against the real staging target.** It
matched the ref fragment against the connection **host**. Resolved by a
read-only probe of live staging rather than by guessing: the fragment is a bare
20-character project ref, and staging connects through the Supabase **session
pooler**, whose hostname carries no ref — it is in the **username**
(`postgres.<ref>`). So the host-only check would have thrown on **every**
legitimate run, and under C-1 the wipe would have proceeded anyway. Fixed to
match `user@host`, plus `current_database()`.

The same probe established the honest limit recorded at O-2.

Also fixed: G-4 accepted a *partial* deletion of `__drizzle_migrations` (the ADR
says "retains its row count"); three integration tests disabled a guard and
mutated without a transaction, leaving a window where a throw strands a guard
OFF locally; the parity test read a hard-coded three-file migration list, so a
future migration adding a protected relation would have left it green while the
guard list was incomplete; `EXPECTED_GUARD_CATALOG_ROWS = 78` was a bare pin and
is now derived from the parsed migrations plus the partition-clone term.

### `@security-auditor` — one HIGH

**S-1 · The whole guard contract was bypassable through the file that tests it.**
`staging-reset-mechanism.integration.test.ts` runs under the **default** config
— so `pnpm vitest run`, `pnpm test:integration`, CI and any subagent collect it
— and connects via `testClient`, which reads ambient `DATABASE_URL` with **no**
target assertion. It then performs the full 21-relation wipe unguarded. The
attack needs no attacker: through Slices B–D the operator lives in
`doppler run --config stg` shells where `DATABASE_URL` **is** staging, and
`tests/_setup/env.ts` only `??=`-defaults it. One
`doppler run --config stg -- pnpm vitest run` while debugging a staging runner
would have wiped staging with zero guards. Fixed — the suite refuses at module
scope unless `DATABASE_URL` is loopback. Verified by pointing it at the staging
pooler: it now refuses.

**S-2 · The fragment guard could be made vacuous, and `.env.example` was the
path to it.** Any non-empty fragment was accepted, so `postgres` would satisfy
both the G-1 URL match and the G-3 connection match for every Postgres DSN in
existence. `.env.example` documented the shape as `"<ref>.supabase.co"` — which
**cannot appear in a pooler DSN at all** — so an operator following the
committed example gets a refusal, and the natural remedy is to shorten the
fragment until it passes. Now requires 16+ lowercase alphanumerics;
`.env.example` corrected.

**S-3 · G-4 did not run on the failure path.** If `runGuardedReset` throws, the
belt's `finally` runs and the exception re-throws, so the in-`it` verification
never executed — and a split-batch regression only strands a guard OFF when it
fails mid-way, which is precisely the skipped case. G-4 now also runs in
`afterAll`.

**S-4 · No intent guard.** All four guards are *environmental* — they prove
where you are, never that you meant it. In a doppler `stg` shell a bare
`vitest --config vitest.staging.config.ts` is **watch mode**: wipe, then re-wipe
on every file save; and once Slice B adds runners under the same include glob, a
positional-less run sweeps the reset in with them. Added **G-5**, an
acknowledgement token that `pnpm staging:reset` sets and nothing else does.
Adding a refusal cannot cause data loss; omitting it can — so it was added
rather than deferred to a ruling, and it relaxes nothing.

**S-5 · ADR-0035 primitive 7 was a comment, not a control** — and
`tests/db/_fixtures/truncate.ts`'s guard list **includes** `system_state`'s
truncate guard. A Slice B/C/D runner reaching for `truncateTables()` for
teardown would disable the freeze sentinel's guard **on staging**, destroying
the active defense the whole exclusion design rests on. Now asserted for every
runner and every `_lib` module.

**S-6 · `session_replication_role`.** A `?options=-c session_replication_role=replica`
query parameter flows into the startup packet, and under `replica` **no trigger
fires** — including all four never-disabled guards — while G-4's catalog check
still reads a clean 78/all-enabled, because `tgenabled` is unchanged. That
combination would void the append-only contract while every check reported
green. ADR-0030:48 scopes this pattern as "owner-privilege only (no
`session_replication_role`)"; G-3 now asserts it.

Also fixed: the fragment constrained the *username*, not the destination, so a
localhost DSN carrying the staging ref as its user passed G-1/G-2/G-3 — G-3 now
requires a Supabase host; `runGuardedReset` built raw SQL from a caller-supplied
array with no identifier validation; the gating assertion covered one file by
name and now covers every runner.

**What the auditor verified as sound.** ADR-0035 primitive 2 was proven
empirically, not argued: the DISABLE genuinely executes mid-batch, and the guards
read `'O'` after a runtime abort, a dropped socket, **and** a
`pg_terminate_backend` fired mid-batch from a second session. Ambient
`PGHOST`/`PGUSER`/`.env.local` cannot satisfy the contract or redirect a
well-formed URL. `system_state` has zero inbound FKs, so `CASCADE` cannot reach
it. `runner-gating.test.ts` reads the runner with `readFileSync` rather than
importing it — an import would have registered its `describe`/`it` into the
importing suite and **executed the wipe**; that was the one collection-path
landmine and it is avoided.

---

## Rulings — dispositions (2026-08-06, pre-Gate-C)

Five rulings were returned on the findings below. All are applied or recorded
here; the PR was **not** merged.

| # | Ruling | Disposition |
|---|---|---|
| **1** | The three unratified tables (`admin_sessions`, `cron_alarms`, `watermark_state`) | **ANSWERED — see below.** All three stay outside the truncate set; `admin_sessions` **permanently**, the other two pending STAGING-PARITY-ENV. `TRUNCATE_SET` remains an exact reproduction of Q3's ratified list. No code behaviour changed. |
| **2** | `lock_timeout` | **APPLIED.** `SET LOCAL lock_timeout = '15s'` is now the first statement **inside** the single batch, ahead of the disable. |
| **3** | Production-ref liveness | **APPLIED.** Non-empty assertion at guard time + a unit test that feeds a synthetic production URL and asserts refusal. |
| **4** | The production ref published in a public repo | **DOCKET ROW, OWN TASK.** Not addressed in this PR. |
| **5** | ADR-0035 addendum for G-5 | **APPLIED.** Appended as `## Addendum — 2026-08-06`; primitives 1–7 untouched. |

### Ruling 1 · The three untruncated tables — answered

**`admin_sessions` — RULED PERMANENT. Not a deferral, and not to be revisited.**
Admin is not a participant and carries no FK dependency on `users`. The
asymmetry that makes it look like an oversight — participant `sessions` is
truncated, `admin_sessions` is not — **is the structural separation showing
through**, not a gap. CLAUDE.md §3 makes admin a separate auth path with no
`users` row; a reset that empties the participant surface has no business
touching the admin's live login, and doing so would log the operator out
mid-run. The constant's comment now reads *"RULED: PERMANENT"* for this entry
rather than *"flagged for a ruling"*, so a later reader does not re-open it.

**`cron_alarms` and `watermark_state` — LEAVE, revisit at STAGING-PARITY-ENV.**
Their consuming jobs (`/api/cron/alarms-drain`, the nightly drift job) do not
run on staging today, so the cost of leaving them is exactly zero: stale alarm
rows keyed to market ids that no longer exist, and a drift watermark for a
population that was deleted. Nothing reads either. When STAGING-PARITY-ENV
turns those jobs on, the question becomes live and should be re-asked then.

**⚠ The governance consequence, recorded now so STAGING-PARITY-ENV budgets for
it.** Adding a table to `TRUNCATE_SET` **widens a permitted set**. The
ADR-0035 Addendum's amendment rule reads: *"An addendum to an accepted ADR may
ADD a refusal condition. It may never remove one, widen a permitted set, or
change a mechanism. Those three require a superseding ADR."* Widening the
truncate set is squarely the second of those three. So if STAGING-PARITY-ENV
decides to truncate `cron_alarms` or `watermark_state`, it needs a
**SUPERSEDING ADR** — not an addendum, and not a quiet edit to the constant.
That is a full ADR cycle with a same-commit SPEC.2 update, and it must be
priced into that task rather than discovered inside it.

This is also the first live exercise of the amendment rule, and it cuts the
way the rule intends: G-5 could be added by addendum because it is a refusal;
widening the truncate set cannot, because it is a permission.

### Ruling 2 · `lock_timeout` — what it does and does not bound

`SET LOCAL lock_timeout = '15s'` bounds how long the batch will **wait for a
lock**, not how long it may **run**.

The batch takes `ACCESS EXCLUSIVE` on the truncate set and
`SHARE ROW EXCLUSIVE` on every guarded relation. Unbounded, a reset issued
while staging serves traffic queues behind whatever transaction holds the
conflicting lock — and because a pending lock request queues *ahead* of later
readers, it stalls the application behind it too. Bounded, the batch fails fast
with `55P03` and the whole thing rolls back under primitive 2. A self-inflicted
staging outage of unbounded duration becomes a retry.

`SET LOCAL` is **transaction-scoped**, so it reverts when the implicit
transaction ends and cannot leak into the pooled session. That is load-bearing
on the Supabase session pooler, where the connection is reused — a
session-scoped `SET` would silently apply to every later query on it. Asserted
both ways: a unit assertion that the statement is `SET LOCAL` and sits inside
the batch, and an integration assertion that `lock_timeout` reads the same
before and after a real run.

**`statement_timeout` was deliberately NOT added.** That would bound
*execution*, and a legitimate `TRUNCATE … CASCADE` over 21 relations has no
principled upper bound — capping it would abort correct work and turn a slow
reset into a failed one. Lock **wait** is the contended resource; execution is
not. An integration assertion pins its absence.

### Ruling 3 · Production-ref liveness — and where the single constant lives

`PRODUCTION_PROJECT_REF` in `tests/staging/_lib/guards.ts` is **the only code
occurrence of the production ref in the repository** — verified by grep across
every `.ts`/`.tsx`/`.js`/`.json`/`.yml`. The other ten occurrences are **prose
in markdown/HTML documents** (ADR-0024, the deploy runbook, two handover decks,
an incident log, three plans, the STAGING-PARITY plan), not importable values.

So the guard did **not** introduce an 11th *copy of a constant*: there was no
existing constant to point at, and this one is now the single one. **It is left
where it is**, with its docblock stating that anything in code needing the
production ref must import it, so the refusal has exactly one place to be
corrected. A unit test asserts the ref appears exactly **once** in `guards.ts`,
so a pasted second copy — which would survive a rotation of the constant and
silently un-protect — fails immediately.

What is now enforced: `resolveStagingTarget` refuses if the constant is empty
or unset. That is the failure mode a careless edit produces — blanking the
string makes `url.includes("")` vacuously true, and the operator's natural fix
would be to delete the check, removing the only hard target discriminator.

**The unit test is the liveness check**, as directed: it feeds a synthetic
production connection URL — in both the session-pooler shape
(`postgres.<prodref>@…pooler.supabase.com`, which is what a `prd`-instead-of-`stg`
Doppler slip actually produces) and the direct-host shape — and asserts the
guard refuses each, including the case where every other setting is correct and
only the URL is production. **Honest limit, recorded rather than implied:** if
the ref is ever rotated and the constant is not updated with it, these tests
still pass against the synthetic value. At rotation time the test's own fixture
is the thing to re-check alongside the constant.

### Q-A · What the production-ref test proves — corrected framing

**The question:** does `reset-guard.test.ts` build its synthetic production URL
by interpolating `PRODUCTION_PROJECT_REF`, or by hardcoding the literal
separately? **Answer: it interpolates.** So the test is circular with respect to
the constant's *value* — it is satisfied by whatever the constant holds,
including a stale value left by a project restore.

**The earlier framing was an overstatement and is corrected.** Both the
`PRODUCTION_PROJECT_REF` docblock and the test's own describe block said the
test *IS* the liveness check. It is not. What it actually proves:

| | |
|---|---|
| **DOES prove** | the refusal PATH works — a production-shaped URL is refused in both the session-pooler and direct-host shapes, and refused even when every other setting is correct |
| **DOES prove** | the constant is not blanked, truncated or placeholder text — via a shape assertion, `/^[a-z0-9]{20}$/` |
| **DOES NOT prove** | that the constant still names the live production project. Rotation is undetectable this way |

**Hardcoding the literal a second time was considered and rejected** — it would
not detect rotation either (both copies would go stale together), and it would
cost the single-constant property the docblock depends on.

**Rotation is a PROCESS control, not a test.** The docket row is filed in
**`docs/parked.md`** — *"STAGING-PARITY Slice A — `PRODUCTION_PROJECT_REF`
liveness"* — alongside AUDIT-FIX-B2 OQ-2's parked role split, which is the same
family: both are the owner-privilege reality ADR-0035 builds on rather than
closes. `parked.md` is the tracking; this section is the reasoning, and they
cross-reference rather than duplicate.

*(It was first routed to this log instead. That was wrong, and the cause was a
stale header: `POLISH-register.md` still claimed **PK-primary … Not committed to
the repo**, which R1 had already inverted — the file IS committed and GitHub IS
canonical. The contradiction is struck at three sites and the superseded
quotation annotated; see the R1 header note below.)*

**And the name-based refusal is the SECOND net regardless.** G-1's *positive*
fragment match is the primary protection: the reset only proceeds when the URL
carries the **staging** ref, which does not depend on knowing production's name
at all. The production-ref check exists to make the wrong-target case *report
itself correctly* — "this is PRODUCTION" rather than "wrong fragment" — not to
be the thing that stops it. A stale production constant degrades the error
message, not the refusal.

### Finding · The POLISH register header contradicted itself (my defect)

`docs/polish/POLISH-register.md:3` asserted **both** *"PK-primary"* **and**
*"GitHub is canonical; PK is the mirror."* Those are opposites. "PK-primary" is
a status assertion that **R1 inverted** when the file was committed on
2026-08-05; it is not a descriptive claim and should have been struck then,
exactly as *"Not committed to the repo"* was.

**Consequence, and why it is worth recording rather than quietly fixing.** I
read that header, believed the repo copy was non-authoritative, and routed the
Q-A docket row into this session log instead of `docs/parked.md`. A stale status
line in a governance doc produced a real misfiling one day later. That is the
failure mode the "stale docs are worse than none" rule in CLAUDE.md §7 names.

**Struck at three sites**, all the same `PK-primary … GitHub is canonical`
contradiction:

| File | Line | Was |
|---|---|---|
| `docs/polish/POLISH-register.md` | 3 | `· **PK-primary**, web-authored from operator captures.` |
| `docs/polish/POLISH-0.md` | 3 | `· **PK-primary**, web-authored, operator-ratified.` |
| `docs/polish/POLISH-0.md` | 253 | `standalone, **PK-primary**, web-authored (P3).` |

Everything else on each line is kept, including `GitHub is canonical; PK is the
mirror`, which is the surviving true half.

**A fourth site is a QUOTATION and was annotated, not edited.**
`docs/polish/POLISH-register-ADDITIONS.md:4` quotes the old header verbatim
(*"PK-primary … Not committed to the repo"*) as the stated reason those rows
were delivered additively. Editing inside the quote would misrepresent what was
quoted, so the quotation is preserved and a superseded-notice appended beneath
it, naming this misfiling as the concrete harm so it is not used to route a row
away from the repo again.

`docs/polish/POLISH-0_data-manifest.md` carries no such claim.

### Finding · `safeHost` could not identify the target it logged

`describeTarget` returned `new URL(url).host`, which on the session pooler is
`aws-1-ap-south-1.pooler.supabase.com:5432` — **the same string for every
Supabase project in the region, staging and production alike**, because the
project ref lives in the USERNAME and `new URL()` drops it. The run log could
therefore not tell a reader which database had just been wiped, which is the
one question a destructive run's log exists to answer.

Fixed: the log line now carries **host plus the validated fragment**
(`… target aws-1-ap-south-1.pooler.supabase.com:5432 · ref=<staging-ref> …`).
The fragment is safe to print — it is known-good by that point (G-1 matched it,
G-3 matched it against the live connection), it is a project ref rather than a
credential, and it is already committed in ten documents. **The password and
the raw URL are never logged**, and `safeHost` still strips both.

### Ruling 5 · The addendum, and the G-0 → G-5 rename

`docs/adr/0035-guarded-staging-reset.md` gains `## Addendum — 2026-08-06`,
placed after `## More Information` and **before** the closing italic line.
Append-only, verified: `git diff origin/main` on that file shows **zero
deletions**; 182 → 208 lines. Primitives 1–7 are byte-identical.

It carries (a) G-5, the watch-mode refusal — what it does, why it exists, and
that it is additive to primitive 6's four guards — and (b) the amendment rule
verbatim: *"An addendum to an accepted ADR may ADD a refusal condition. It may
never remove one, widen a permitted set, or change a mechanism. Those three
require a superseding ADR."*

**Naming reconciled.** The guard shipped in the Slice A code as **G-0**; the
ruling names it **G-5**. The code, the runner's header block and the log now
all say **G-5**, so the ADR and the implementation agree. Label only — no
behaviour, ordering or evaluation change. Flagged rather than done silently.

---

### Q-I · Source-matching assertions — audit, and an inherited constraint for Slice B

**The pattern that keeps recurring.** `runner-gating.test.ts` matched a call
site with a literal `indexOf("verifyPostReset(client")`. A formatter wrapped
the arguments across lines; the literal stopped matching; the search skipped
forward and asserted about **the wrong call site** — green throughout. That is
the second test in this task to pass while blind to what it named, and the
first to assert about the wrong thing rather than nothing.

**Every source-matching assertion in the PR, audited.** Five shared or
approached the defect and are fixed; the rest are sound and why is stated.

| Assertion | Matches on | Failure mode | Disposition |
|---|---|---|---|
| `runner-gating` · `resetAt` needle | literal `runGuardedReset(client` | With `resetAt === -1`, `find(o => o > -1)` returns the FIRST call site and `source.slice(-1, x)` is near-empty — the `not.toMatch` then passes having examined nothing | **FIXED** — `expect(resetAt).toBeGreaterThan(-1)` at both use sites |
| `runner-gating` · no-truncate-fixture-import (runners) | `/_fixtures\/truncate/`, `/\btruncateTables\b/` | Pure negatives. A path alias or a fixture rename makes both match nothing and the test reports green **while the forbidden import is present** | **FIXED** — positive control asserts both patterns fire on a known-bad sample first |
| `runner-gating` · same, for `_lib` | `/import[\s\S]*?_fixtures\/truncate/` | Same, plus a `readdirSync` loop that asserts nothing if the directory is empty | **FIXED** — positive control + non-empty assertion |
| `runner-gating` · `not.toMatch(/statement_timeout/)` | pure negative | Passes if `mechanism` is an empty read, or if the setting arrives via an interpolated constant | **FIXED** — positive control, plus `expect(mechanism).toMatch(/runGuardedReset/)` to prove the file was actually read |
| `runner-gating` · `not.toMatch(/SET lock_timeout/)` | pure negative | Same class | **FIXED** — positive control |
| `runner-isolation` · include-pattern loop | `for (…of include) expect(p).not.toMatch(/staging/)` | A `for` over an **empty** array asserts nothing and reports green — so a renamed or removed `include` key passes | **FIXED** — `expect(include.length).toBeGreaterThan(0)` |
| `runner-isolation` · staging config `exclude` | `(stagingTest.exclude ?? [])` | `?? []` makes absence and emptiness indistinguishable | **FIXED** — shape asserted explicitly |
| `guard-list-parity` · `parseDroppedTables` | `/DROP TABLE\s+"?(\w+)"?/` | Captured the literal `IF` from `DROP TABLE IF EXISTS "x"`, and only the first name of `DROP TABLE a, b`. Fails **loudly** (the table stays in `LIVE_TRIGGERS`), but for the wrong reason, sending the reader after the wrong thing | **FIXED** — handles `IF EXISTS`, comma lists, schema qualifiers; seven positive-control cases |
| `guard-list-parity` · `parseCreateTriggers` | `/CREATE TRIGGER\s+(\S+)\s+BEFORE\s+\w+\s+ON\s+"?(\w+)"?/` | Matching nothing would empty `LIVE_TRIGGERS` and make every downstream comparison vacuous | **SOUND, control added** — the six-families assertion already fails on an empty parse; a direct shape test now pins the parser too. (`CREATE OR REPLACE TRIGGER` remains unmatched — O-8, fails closed) |
| `runner-gating` · `finally … client.end(` / `reEnableGuards(` | bounded `[\s\S]{0,200}` / `{0,400}` windows | Growth past the window fails **loudly** | **SOUND** |
| `runner-gating` · `verifyOffsets` | whitespace-tolerant regex | — | **SOUND** (this was the fix) |
| `reset-guard` · ref-appears-once | `guardSource.split(REF).length - 1` | String split, no regex; cannot mis-anchor | **SOUND** |
| `reset-guard` · every `result.reason` match | the predicate's **return value**, not source text | Behavioural, not source-matching | **SOUND — not in this class** |
| `runner-isolation` · config `include`/`exclude` reads | the **resolved config object** | Behavioural | **SOUND — not in this class** |

**The general rule this produces, and it is the one to carry forward: a
negative source assertion needs a positive control.** `not.toMatch` passes when
the pattern matches nothing, and "matches nothing" is exactly what a rename, a
path-alias change, or a reformat produces. Every negative in this PR now proves
its matcher fires on a known-bad sample before concluding the real source is
clean.

**⚠ INHERITED CONSTRAINT FOR SLICE B — do not repeat this pattern.**
ADR-0036 primitive 4 requires a source-level assertion that the generator
writes no rows directly (`no INSERT INTO`, no `.insert(` against the eleven
named tables). Ratification Record §5 W-G is explicit that this assertion is
what keeps gate 1 non-vacuous: *"A verification satisfiable by the thing it
verifies is not a verification."*

That assertion is **a pure negative over source text** — structurally the same
shape as the two defects above, and load-bearing in a way neither of those was.
If it matches nothing, gate 1 silently becomes vacuous and the whole
engine-driven-generation guarantee evaporates while every check reports green.
So Slice B's version **must** carry, at minimum:

1. a **positive control** per pattern — each must be proven to fire on a
   known-bad sample (`INSERT INTO bets …`, `db.insert(bets)`, `tx.insert(events)`);
2. a **non-empty file-set assertion** — the glob must be proven to have found
   files, so an empty sweep cannot read as "clean";
3. **whitespace and formatting tolerance** — regex, never `indexOf` on a
   literal call shape;
4. a **mutation control at authoring time** — add a real direct insert, watch
   the assertion go red, revert. The same discipline that proved the atomicity
   test and the gating test in this slice.

Written here rather than only in the Slice B plan because Slice B is a
different session, and this is the lesson that session will not otherwise have.

---

## Open questions / findings for a ruling

**O-1 · Three public tables are in neither the truncate set nor the
exclusions.** — **RULED, ruling 1: recorded, not applied.** `admin_sessions`, `cron_alarms`, `watermark_state`. Q3's ratified
set is reproduced verbatim and is silent on them, so they are **recorded** in
`NOT_TRUNCATED_UNRATIFIED` with the reasoning and flagged here rather than
added — widening a ratified set is a ruling, not an implementation detail.
*Candidate answer:* leave them. They hold operational state, not fixture data;
`admin_sessions` holds the operator's live login (truncating it logs them out
mid-run); and all three carry **zero** inbound FKs, so `CASCADE` cannot reach
them either. Cost of leaving them: stale alarm rows keyed to market ids that no
longer exist, and a drift watermark for a deleted population — both consumed by
jobs that do not run on staging today. A new test now accounts for **every**
public base table across the three lists, so a future table cannot be silently
forgotten. **RULED 2026-08-06 — see *Ruling 1* above: `admin_sessions`
permanent, the other two revisited at STAGING-PARITY-ENV, and widening the set
needs a superseding ADR rather than an addendum.**

**O-2 · G-3 is not an independent oracle, and cannot be.** The pooler exposes no
project-discriminating server-side fact — `current_database()` and
`current_user` both read `postgres` on every Supabase project, staging and
production alike (verified). So G-3 asserts what the driver actually dialled
plus a live round-trip, not "this is staging". The real target discriminators
are G-1's fragment match and the hard production-ref refusal. Stated at the
function rather than papered over. **No action believed needed; recorded so it
is not mistaken for a stronger guarantee than it is.**

**O-3 · The production-ref refusal has no liveness check.** — **RESOLVED, ruling 3.**
`PRODUCTION_PROJECT_REF` is a hard-coded literal. A Supabase project restore or
migration mints a **new** ref, at which point the literal silently stops
protecting and the fragment becomes the only barrier. A deny-list of one, never
re-verified, guarding an irreversible operation. **Disposition:** a non-empty
assertion at guard time plus synthetic-production-URL refusal tests now ship —
see *Ruling 3* above for what that does and does not prove. **Still open as a
future hardening:** asserting the ref in `env-audit.yml` against the live
project list, or deriving it from Doppler `prd` rather than hard-coding.

**O-4 · SURPRISE, pre-existing, out of scope.** — **RULED, ruling 4: docket row, own task.** The production project ref is
committed in **10 files** of this **public** repo — ADR-0024, the deploy
runbook, two handover decks, an incident log, three plans, and now `guards.ts`.
That discloses the production DB hostname, the pooler username, and the project
API origin for a project whose runtime role is the table **owner** (ADR-0030).
The staging ref is likewise in 8 files. **This PR adds no new disclosure** — the
ref was already on `main` — so it is not a reason to block. Deserves its own
docket row; the sharper question is whether the anon/PostgREST surface is
reachable, given ADR-0019 puts RLS out of scope.

**O-5 · The batch sets no `lock_timeout`.** — **RESOLVED, ruling 2 (applied).** It takes `ACCESS EXCLUSIVE` on 21
relations. A reset that blocks behind live staging traffic holds write-blocking
locks on every append-only table indefinitely, and can deadlock an in-flight bet
transaction. Safe (the abort rolls back) but a self-inflicted staging outage of
unbounded duration. **Disposition:** ruled and applied — `SET LOCAL lock_timeout
= '15s'` is now the first statement inside the batch. See *Ruling 2* above for
why lock WAIT is bounded and execution deliberately is not.

**O-6 · `pnpm staging:rebuild` will seed twice.** Plan §3 defines it as
`staging:reset && db:seed:staging && …`, and `staging:reset` now chains the seed
itself (primitive 5's "immediately re-seeded"). Harmless — the seeder is
idempotent via `ON CONFLICT DO NOTHING` — but recorded so Slice D does not
rediscover it.

**O-7 · Residual re-seed gap.** If the batch commits and then G-4 fails, the
`&&` chain does not fire and `identity_pool` is left empty. At that point a
guard is left disabled, which is an emergency requiring intervention, not a
re-seed — so this is documented in the runner's output rather than automated.

**O-8 · The migration parser models only `CREATE TRIGGER` / `DROP TABLE`.** A
future `DROP TRIGGER` or `CREATE OR REPLACE TRIGGER` is invisible to it. Fails
closed (the derived catalog-row assertion breaks loudly, and the live pre-flight
is a second net). Naming it, not a defect.

---

## The 0f P-owner capture

**CAPTURED.** Written to `~/.claude/zz-p-owner-identity.json`, outside the repo,
mode `0600`, never committed and never printed. Working tree verified clean.

- 8 top-level keys; `email`, `accountId`, `providerId`, `pseudonym`, `userId`
  all non-empty. Provider `google`.
- **Finding:** staging carries **three** Google-linked accounts, not one —
  `RedOtter002` (banned, the P-owner) plus `RedBadger003` and `RedLynx004`. The
  same `users_email_idx` collision hazard applies to all three, so all three are
  captured, the other two under `otherGoogleAccounts`. The kickoff scoped 0f to
  the P-owner; this is a strictly protective, read-only widening in the same
  out-of-repo file.
- **Not blocking for Slice B.**

---

## Context to preserve

- **Staging was contacted read-only, twice, and never written.** The 0f capture
  and the G-3 shape probe. No `TRUNCATE`, `DELETE`, `DISABLE TRIGGER` or DDL
  ever reached it. `system_state.frozen_at` was never written, read-only or
  otherwise.
- **`STAGING_PROJECT_REF_FRAGMENT` is a bare 20-character ref**, present in the
  pooler DSN's **username** and absent from its host. Any future guard that
  matches it against a hostname will refuse every legitimate run.
- **ADR-0030 disposition, verified at commit time** per ADR-0035's own
  instruction: 0030 **notes** the owner-privilege `DISABLE TRIGGER` escape
  (`0030:22`, `:48`, `:78`) rather than forbidding it. No `Supersedes` link and
  no same-commit SPEC.2 update were owed.
- **Vitest does not stop a file when a test fails.** Any future guard in a
  runner must be a `throw` at module scope or in `beforeAll`, never an `it()`.
  This is the C-1 lesson and it generalises to every Slice B–D runner.
- Local Postgres :54322 was already up and migrated; the guard catalog reads
  exactly **78** rows there, matching the plan's live staging observation.

---

## Overnight mutation sweep (2026-08-06) — F1, F2, and 52 mutations

Second unattended session on the same branch. PR #298 stayed **OPEN**; nothing
merged; Slice B was not opened. Full evidence, one row per control:
**`docs/logs/STAGING-PARITY-A-mutation-audit.md`**.

**F1 — the unverified assumption, now measured.** `SET LOCAL` outside a
transaction block emits `WARNING 25P01` and **no-ops**, and nothing asserted that
a multi-statement simple-query implicit transaction counts as a transaction block
for that purpose. Both halves hold. Issued **alone**, the statement warns and
`current_setting('lock_timeout')` reads `"0"`; issued as the first statement of
the real batch it reads **`"15s"`** with no notice, and reverts to `"0"` on the
next round-trip. The protocol is simple query — `postgres@3.4.9` sets
`simple: args.length === 0` and emits the `'Q'` frontend message, and empirically
the extended path refuses two commands (`42601`) where the parameterless one
returns two result sets. Pinned by assertions built on the **real** batch, via a
`buildResetBatch` split, so a driver bump fails loud.

**F2 — the misleading message.** `afterAll` runs even when `beforeAll` throws,
and reported "G-4 FAILED after the run" either way — which on a destructive
artifact reads as *staging was wiped, then verification failed* when in fact
nothing ran. A `batchCommitted` flag, set only where the batch is known to have
committed, now selects between two messages; the non-destructive one says the run
never started.

**The sweep: 52 mutations · 47 RED · 5 GREEN.** Every revert re-ran green. The
five that stayed green:

| Blind control | What it missed | Disposition |
|---|---|---|
| `it("empties the truncate set…")` | seeded nothing, so counting zero after a reset that never truncated still read as zero | seeds two rows first; re-fired RED |
| **G-3 entirely** | `assertLiveConnection` was called by nothing. Five refusals — including the `session_replication_role=replica` escape hatch that voids every trigger while the catalog still reads 78/enabled — shipped unasserted. `reset-guard`'s header *claimed* the integration suite exercised it; it did not | eight cases added; all five sub-checks re-fired RED |
| `assertSafeIdentifiers` | no test at all — the one primitive-3 prohibition enforced in code rather than by the storage layer | ten cases; re-fired RED on nine |
| the module-scope target refusal | downgrading `throw` → `console.error` left `runner-gating` green; the assertions checked the message's POSITION, not the construct. `tsc` catches it, the test suite did not | the refusal is now bound to `throw new Error(`; re-fired RED |
| `parseDroppedTables` quote-strip order | **not a coverage gap** — the comment claimed a defect that does not exist (`/^.*\./` is greedy and eats the quote). Checked across eight shapes: zero differ | comment corrected |

Two further G-4 sub-checks were checked by `verifyPostReset` and tested by
nothing — `system_state.frozen_at` set, and the guard catalog off by one. Both
now have cases; both re-fired RED. And `G4-b` passed for the **wrong reason**:
`/system_state/i` matched the *frozen* message when the row was *absent*, two
unrelated operational states.

**GROUP 5** names ten controls no mutation can prove. The one that matters most
for reading this slice: **the staging runner has never been run and cannot be**,
so every assertion about it is source-structural. *"`runner-gating` is green"
is not "the runner has been run."*

**Staging was contacted once, read-only, at STEP 0** — 39 bets, 16 users, 200
identity_pool, `system_state` 1 row with `frozen_at NULL`, 78 guards 0 disabled,
25 migrations, `session_replication_role = origin`. Read under
`PGOPTIONS=-c default_transaction_read_only=on`. Nothing was written.

### RULED (Gate C, 2026-08-06) — the runner is unexercisable outside staging, and that is accepted

**The staging runner has never been executed and cannot be, locally.** G-3
requires a Supabase host — `isAllowedStagingHost` refuses loopback and every
non-`.supabase.com`/`.supabase.co` target — so **the guard that makes the runner
safe is the guard that makes it unexercisable outside staging.** That is not a
defect in the guard; it is the guard working. There is no local rehearsal, and
there was never going to be one.

**Accepted as a named risk, not mitigated.** Its first execution is **Slice B's
opening act**, against a disposable environment already scheduled for
destruction. Weakening G-3 to permit a local rehearsal would trade a real guard
for a rehearsal — the guard protects every future run; the rehearsal would
protect one.

**What Slice B must therefore do.** Treat the first reset as **the runner's
first run** — not as a re-run of something already proven — and **read its
output** rather than assuming it. Everything asserted about the runner today is
source-structural (`tests/unit/staging/runner-gating.test.ts` reads the file);
"`runner-gating` is green" is **not** "the runner has been run". Specifically
unproven until that first execution: the pre-flight guards-already-disabled
refusal, the pre-flight catalog-count refusal, the
`TRUNCATE_EXCLUSIONS` ∩ `TRUNCATE_SET` refusal, the belt's `.catch()` path, the
**F2** message as actually rendered on a real refusal, and the closing re-seed
instruction. Full list at *GROUP 5 · item 5* of the mutation audit.

No code change. Recorded here because Slice B is a different session and this is
the premise it must not inherit wrongly.

---

## Next session starts at

**Slice B — the skeleton.** Gate C on PR #298 (human diff-read) is owed first,
and the rulings at O-1 and O-5 are wanted before the first real staging run.
Gate C now reads the mutation audit alongside items 3–6; the item 3–6 diff
chunks are staged at `~/Desktop/zz-gatec/` (21 files, ≤120 lines each).

Exact next action, once #298 merges: **run the reset against staging for the
first time** — `pnpm staging:reset` — and confirm the four guards pass, the 37
counterfeit `bets` rows are gone, `system_state` survives with `frozen_at NULL`,
`__drizzle_migrations` retains 25 rows, and `identity_pool` is re-seeded to 200.
Then `fixtures.ts` + participant creation ×10.

Slice B is also owed: manifest **v1.2** (web-authored, gates Slice B), and the
W-C synthetic-literal rule for `tos_acceptance_ip` / `tos_acceptance_user_agent`.

---

## Time

~4.5 h wall-clock, unattended. Roughly: 0.7 h STEP 0 (ground, ADR verification,
the 0f capture, the ADR PR through merge); 1.3 h the build, tests-first;
0.4 h the §5.10 self-audit and two mutation controls; 1.6 h the two reviewer
passes, run sequentially, and their fixes; 0.5 h the log and PR.
