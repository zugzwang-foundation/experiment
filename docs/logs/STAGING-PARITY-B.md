# STAGING-PARITY — Slice B session log

> **Task:** STAGING-PARITY Slice B — the engine-driven fixture generator, the
> verification gates, and the first real staging reset.
> **Date:** 2026-08-06 IST. **Branch:** `slice/staging-parity-b`.
> **Governed by:** `docs/polish/POLISH-0_data-manifest.md` v1.2 ·
> `docs/plans/STAGING-PARITY.md` + its Ratification Record · ADR-0035 · ADR-0036 ·
> `STAGING-PARITY_operating-plan_v1_0.md`.

**Headline.** Staging's fixture set is now produced entirely by the real engine.
The two numbers this task exists to zero — **37 orphaned bets** and **37
zero-share bets** — are both **0**. Gates 1, 2, 3 and 6 are green against the
live staging database.

---

## What landed

| Commit | Scope |
|---|---|
| `4665d62` | Manifest v1.2 (181 lines, integrity-verified) + ADR-0035 Addendum A.3 |
| `4095445` | `tests/staging/fixtures.ts` + `generate.staging.test.ts` + `_lib/{target,client,write-guard,captured-identities}.ts` |
| `4cbba51` | STEP 4 — the no-direct-writes assertion in both forms + `runner-target` + `write-guard` unit suites |
| `df6cf19` | STEP 5 — `gates.staging.test.ts`, `_lib/read-client.ts`, the two package scripts |
| `eb7cbb9` | STEP 9 — `seed-debate-view-staging.ts` deleted; `verify-ranking-staging.ts` write path stripped |
| *(this commit)* | `@code-reviewer` findings — 3 HIGH + 7 MEDIUM + 4 LOW, all fixed in-session |

**Zero `src/` changes. Zero migrations. Zero DDL.** Verified by
`git diff --name-only 4f9a5ce..HEAD -- src/ drizzle/ src/db/` returning empty.

---

## Decisions taken on your behalf

Class-1 under the operating plan — decided and recorded rather than halted on.

**1 · M9 is never minted; the market set is M1–M8 + M10–M16.**
The kickoff says 15 markets created / 14 opened; the plan's checklist has 14
total because it has **no M9** — that label is the Frozen market, permanently
unreachable per manifest §1.8/§3. Rather than fill the vacant slot (which would
reuse a label meaning "Frozen") or drop to the plan's 14, the fixture table runs
M1–M8 and M10–M16: fifteen markets, fourteen opened, M9 left deliberately
vacant with a comment saying why. Satisfies the kickoff's count and the plan's
convention at once. Ten Open markets at rest, against `DISCOVERY_GRID_SIZE + 1
= 9` required.

**2 · M4 carries no post.** The kickoff says one post per open market. Manifest
§2.1 defines M4 as "Open, brand new … zero posts" — it is the fixture for both
`EmptySideCTA` slots. The manifest outranks the kickoff (source-of-truth
precedence), so M4 is the single exception, asserted explicitly in the generator
rather than left implicit.

**3 · P-owner's M7 bet is 1000 Đ and runs FIRST.** Gate 5 is Slice C's, but M7
**terminates in this slice** — a magnitude not placed here can never be placed
later. `accrueDailyCredit` fires inside `place()`, so P-owner's first bet opens
at 1010 Đ and the 1000 Đ stake fits only while that credit is unspent. M7 is
seeded at 5000 so the YES settlement pays four digits. Result on staging:
P-owner rests at **1833.333333333333333333 Đ**.

**4 · The three captured identities map to P-owner, P-visitor-target and
P-empty.** All three carry the `users_email_idx` collision hazard. Index 0 (the
primary) takes P-owner. The other two take the roles an operator most wants to
sign in AS during inspection — one well-populated profile, one showing every
empty state.

**5 · Lifecycle terminals folded into Slice B** (as the kickoff directed), and
the close instant is derived from the fixture table. `closeMarket` refuses until
the deadline is reached and `createMarket` refuses a deadline not after `now`,
so terminal markets carry a one-minute `deadlineOffsetMs` and are closed at
`now + offset + 1ms`. `now` is an **argument** to both by design (D-14.e); no
stored timestamp is affected, since every `created_at` derives from a freshly
minted UUIDv7. **This is not backdating** — P-10 is intact.

**6 · Market media rows are shape-valid but back no R2 object.** `createMarket`
REQUIRES ≥1 media image with exactly one default and an exact
`m/<marketId>/<mediaId>.<ext>` key; it validates the SHAPE and never HeadObjects
R2. There is no engine-driven way to create a market without one. The rows point
at objects that do not exist yet. Slice C owns the upload — and STEP 8b proves
it is possible.

**7 · A SECOND target resolver, not a widened one.** `resolveStagingTarget` (the
reset's) admits exactly one target and is written to admit nothing else;
teaching it about localhost would weaken the one artifact whose whole job is
refusing every target but one. `resolveRunnerTarget` is separate, has two modes
and no default, and **reuses** `PRODUCTION_PROJECT_REF` /
`MIN_FRAGMENT_LENGTH` / `isAllowedStagingHost`, so the production refusal still
has exactly one place to be corrected.

**8 · The write-intent token is required for the generator, not the gates.**
Gates only read. Demanding a destructive-intent token for a read-only run trains
the operator to export it into their shell — the exact decay ADR-0035 Addendum
A.1 describes.

**9 · `runner-gating.test.ts` generalised, not relaxed.** Slice A's per-runner
block hard-coded `resolveStagingTarget` and correctly went RED on the new
runners — it was written to ("Generic across the generator/gate runners Slices
B–D add"). The predicate is now a **closed two-name set**, both pure, both
fail-closed, both with their own exhaustive unit suite, plus a positive AND
negative control for the matcher itself. A runner gating on anything not named
still fails. Adding a third name is a decision, not an edit.

**10 · `max: 10`, not `max: 1`, on the runner's pool.** Forced, not chosen — see
Surprises.

---

## STEP 6 · the runner's first ever execution, VERBATIM

Slice A's Gate C ruling: *"the staging runner has never been executed and cannot
be, locally"* — G-3 requires a Supabase host, so the guard that makes it safe
makes it unexercisable outside staging. Every assertion about it was
source-structural. This is the first run.

### Pre-state (read-only, `default_transaction_read_only=on`)

```
bets=39 users=16 accounts=3 markets=5 comments=39 events=42 positions=13
dharma_ledger=8 identity_pool=200 pool_assigned=6
orphan_bets=37 zero_share_bets=37
guards_total=78 guards_disabled=0
migrations=25 system_state_rows=1 frozen_at_null=true replication=origin
```

### `pnpm staging:reset` — full output, verbatim

```
> experiment@0.1.0 staging:reset /Users/hrishikesh/code/zugzwang/experiment
> doppler run --project zugzwang-experiment --config stg -- pnpm run staging:reset:exec


> experiment@0.1.0 staging:reset:exec /Users/hrishikesh/code/zugzwang/experiment
> ZUGZWANG_STAGING_RESET_ACK=wipe-staging-i-mean-it vitest run --config vitest.staging.config.ts tests/staging/reset.staging.test.ts && pnpm run db:seed:staging


 RUN  v3.2.4 /Users/hrishikesh/code/zugzwang/experiment

stdout | tests/staging/reset.staging.test.ts
[staging:reset] target aws-1-ap-south-1.pooler.supabase.com:5432 · ref=rwfdoqzsghqhhdapxafg · db=postgres · user=postgres · guards=78 all enabled · migrations=25

stdout | tests/staging/reset.staging.test.ts > guarded staging reset > truncates the fixture surface in one transaction, then verifies (G-4)
[staging:reset] done. identity_pool is EMPTY — re-seed before generating:
  doppler run --project zugzwang-experiment --config stg -- pnpm db:seed:staging

 ✓ tests/staging/reset.staging.test.ts (1 test) 481ms
   ✓ guarded staging reset > truncates the fixture surface in one transaction, then verifies (G-4)  337ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  16:46:40
   Duration  634ms (transform 26ms, setup 6ms, collect 25ms, tests 481ms, environment 0ms, prepare 33ms)


> experiment@0.1.0 db:seed:staging /Users/hrishikesh/code/zugzwang/experiment
> tsx scripts/seed-staging.ts

[seed-staging] Target: aws-1-ap-south-1.pooler.supabase.com:5432
[seed-staging] Seeding identity_pool (200 deterministic tuples)...
[seed-staging] Done — 200 new rows, 0 already present
```

Exit code **0**.

### What this proved, and what it did NOT

**PROVEN at runtime for the first time:**

- **G-1 / G-2 module-scope guards** — the PASS path. They permitted a
  legitimate run rather than refusing it.
- **G-3 `assertLiveConnection`** — ran against the real session pooler and
  passed. The log line `db=postgres · user=postgres` is its output, and the
  `session_replication_role = origin` check (the @security-auditor addition that
  would otherwise let every trigger silently not fire while the catalog still
  read clean) passed live.
- **The `user@host` fragment match** — the pooler carries the ref in the
  USERNAME, and a host-only check would have refused every legitimate run. It
  matched: `ref=rwfdoqzsghqhhdapxafg`.
- **The pre-flight catalog read** — `guards=78 all enabled`, read live.
- **The migration baseline capture** — `migrations=25`, so G-4 got the strong
  retention check rather than the `NO_MIGRATION_BASELINE` degrade.
- **The destructive batch** — one `client.unsafe()` round-trip, committed.
- **G-4 post-run verification** — passed, in the same `it` as the batch.
- **The closing re-seed instruction** — rendered exactly as authored.
- **The `&&`-chained `db:seed:staging`** — fired: *200 new rows, 0 already
  present*.

**STILL UNPROVEN, stated rather than implied.** Every one of these is a REFUSAL
path, and a clean run does not exercise a refusal:

- the pre-flight "guards are already disabled" refusal;
- the pre-flight catalog-count refusal;
- the `TRUNCATE_EXCLUSIONS` ∩ `TRUNCATE_SET` refusal;
- the belt's `.catch()` logging path (the belt succeeded silently);
- **the F2 message arm — NEITHER arm fired.** The kickoff asks which one did;
  the honest answer is neither. Both live in `afterAll`'s `catch`, which is
  reached only when `verifyPostReset` throws. G-4 passed, so the catch never
  ran and no F2 string was rendered. The branch's presence remains asserted by
  `runner-gating.test.ts`; the string an operator would actually see is still
  unobserved.

### Post-state

| Criterion | Expected | Actual |
|---|---|---|
| R.1 · `bucket_%` catalog | 78 rows, all `tgenabled='O'` | **78 / 0 disabled** ✓ |
| R.2 · `__drizzle_migrations` | 25 | **25** ✓ |
| R.3 · `system_state` | 1 row, `frozen_at IS NULL` | **1 row, NULL** ✓ |
| R.4 · `identity_pool` after re-seed | 200 | **200** (0 assigned) ✓ |
| Truncate set | all zero | bets/users/accounts/markets/comments/events/positions/dharma_ledger/pools/bookmarks/image_uploads all **0** ✓ |
| `NOT_TRUNCATED_UNRATIFIED` survives | untouched | `admin_sessions=1 cron_alarms=420 watermark_state=1` ✓ |

The last row matters: ruling 1 declared `admin_sessions` **permanently** outside
the truncate set (admin is not a participant), and `cron_alarms` /
`watermark_state` deferred to STAGING-PARITY-ENV. All three survived, so the
exclusion is behaviour and not just a comment.

---

## STEP 4 · the mutation verdict

A real `await mutationDb.insert(bets).values({})` was injected into the
generator's DAG body.

| Control | Injected | Reverted |
|---|---|---|
| Source tripwire (`generator-no-direct-writes.test.ts`) | **RED** — `generate.staging.test.ts · no .insert(bets)` failed | **GREEN** — 227/227 |
| Behavioural guard (`write-guard.ts`), real run vs local Postgres | **RED** — run aborted at the attempt: `DIRECT WRITE REFUSED — insert on bets issued from …/tests/staging/generate.staging.test.ts` | **GREEN** — 436 engine writes, zero attributed to `tests/` |

**Verdict: PASS.** Both controls detect the defect and both go clean on revert.

### The other three manifest §5 requirements

- **Positive control per pattern** — 22 synthetic violations, one per (table,
  pattern). Plus `guardOffset`'s own positive+negative control in
  `runner-gating.test.ts`.
- **Non-empty file-set assertion** — the collected file list, every file body,
  and the forbidden-table list are each asserted non-empty. Mirrored at runtime:
  the generator asserts its write log is non-empty before concluding no write
  came from `tests/`.
- **Whitespace tolerance** — `\s*` at every point a formatter can break, plus
  two explicit reformat cases (`.insert(\n\t\tbets,\n\t)` and `INSERT   INTO`).

### Beyond the four: a behavioural control, because a source match is the weak form

The prompt asked for the behavioural assertion where one is available. Three
layers ship:

1. **Structural** — `_lib/client.ts` hands the generator no write-capable
   handle. No raw `postgres` client, and `readOnly` exposes `select` alone, so
   `INSERT INTO` has nothing to travel on.
2. **Behavioural** — `_lib/write-guard.ts` proxies the drizzle handle *and* the
   `tx` handed to every transaction callback, attributes each write to its
   immediate stack frame, and THROWS when that frame is under `tests/`. It fails
   closed on an unparseable stack.
3. **Source match** — the CI-cheap tripwire.

---

## STEP 7 · generate + gate against real staging

`pnpm staging:generate` — 12.06 s, exit 0. `pnpm staging:gates` — 2.23 s,
exit 0.

```
users=10 accounts=10 markets=15 pools=14 bets=13 comments=13 positions=13
events=101 dharma_ledger=34 resolution_events=2 payout_events=2 bet_receipts=13
orphan_bets=0   zero_share_bets=0
pool_assigned=10  guards_disabled=0  migrations=25  frozen_at_null=true
```

| Gate | Verdict |
|---|---|
| **1 · event parity** (G1.1–G1.5) | **GREEN** |
| **2 · conservation** (G2.1, G2.2, G2.3, G2.4) | **GREEN** — `checkMarketConservation` iterated over all 15 markets |
| **3 · durable replay** (G3.1, G3.1b, G3.2) | **GREEN** |
| **6 · zero-share** (G6.1, G6.2) | **GREEN** |
| 4 · coverage · 5 · magnitudes · G6.3 | explicitly skipped, each naming Slice C |

Final counts after the review fixes: **13 passed, 3 skipped**. (The first run
read 14/2; G6.3 became a skip when it was found to be a verbatim duplicate of
G6.1 — see the review section.)

Markets, all in their fixture states:
`sp-m1-draft=Draft · sp-m2-active=Open · sp-m3-light=Open · sp-m4-new=Open ·
sp-m5-closed=Closed · sp-m6-resolving=Resolving · sp-m7-resolved=Resolved ·
sp-m8-voided=Voided · sp-m10..m16-fill=Open`

Pseudonyms, FIFO from the re-seeded pool — **identical to the local proving
run**, which is Q4's reproducibility claim demonstrated rather than asserted:
`RedFox000 RedWolf001 RedOtter002 RedBadger003 RedLynx004 RedHare005 RedOwl006
RedHawk007 RedStoat008 RedPine009`.

### The gates are not merely green — negative control

A counterfeit `bets` row was INSERTed directly against local Postgres (no
`bet.placed` event, `share_quantity = 0`), reproducing exactly the corruption
staging carried. **G1.1, G6.1 and G6.3 all went RED.** After a reset and an
engine-driven regeneration, green again.

Because a count over an empty table is also zero, every count-equals-zero gate
carries a carrier assertion. ⚠ **When first written, five did not** — the claim
that they all did was wrong, and `@code-reviewer` caught it. G1.2, G1.4 (plus a
per-status carrier), G2.3, G2.4 and G6.2 gained theirs before the PR, and gate
2's carrier was replaced outright: `markets > 0` proved markets *existed*, not
that any was *checked*, so it now counts markets that reached
`checkMarketConservation` with non-empty flows.

---

## STEP 8 · the two risk probes

### 8a · the ranking instrument — **YES**

The surviving read-only half of `verify-ranking-staging.ts` runs against a
generated market:

```
[schema] comments.stake_at_post_time dropped : yes ✓
[schema] comments_ranking_idx survives        : yes ✓

[market] sp-m2-active — Staging fixture M2 — placeholder heavily-active question (Open)

[aggregates] 1 post(s) — the four per-side signals:
  019fd6ca side=YES  support=0/Đ0  counter=0/Đ0  a=Đ10.000000000000000000

[Top order + latest interleave + lane-dominance badge]
  1. 019fd6ca side=YES  badge=—

✓ ranking verification complete: 1 post(s)' four aggregates computed live, Top order produced, 0 badge(s) fired.
```

**Unblocks:** Slice C's **C3 calibration becomes measurement, not guesswork.**
The lane floors (`n ≥ 5`, `D ≥ 200`, `n^b ≥ 3`, `kLane = 3`) are all flagged
*"pre-tuning placeholder — pins 2026-09-01"*, and Slice C can now tune fixture
stakes against printed output instead of reasoning about the thresholds.

Zero badges here is the **correct** result for Slice B's data: M2 currently has
one post and no replies, so nothing can clear a lane. The instrument distinguishes
"nothing dominated" from "no posts to rank" — an empty substrate is reported as
`NO top-level posts — nothing to rank` rather than as a pass.

### 8b · the R2 probe — **YES, C7 is NOT data-blocked**

```
[r2probe] key=u/…/slice-b-r2-probe.png bytes=70
[r2probe] PRESIGN: OK (zugzwang-uploads.….r2.cloudflarestorage.com)
[r2probe] PUT: HTTP 200 OK
[r2probe] VERIFY: byteSize=70 etag="2cd8bde463f5d82aae0f0cec061d6b8f"
```

The full chain works on staging: `mintPutUrl` presigns with `If-None-Match: "*"`
(the AUDIT-FIX-A1 write-once arming), a real `PUT` returns 200, and
`verifyUploadedObject`'s HeadObject returns the true byte size and the forensic
ETag.

**The parked `smoke:staging` r2-scope failure does not block this.** That item
asserts the staging tokens CANNOT reach the *production* buckets — a
cross-scope isolation question. It is orthogonal to whether the staging token
can write its own bucket, which it demonstrably can.

**Unblocks:** C7 (a post with an attached image), and therefore POLISH.3's image
criteria — the `--imgmax` in-card clip and the whole-render pop-up. Slice C
builds it; nothing needs to be recorded as data-blocked.

The probe left one 70-byte orphan object in the staging uploads bucket. That is
W-E's already-accepted leak (`image_uploads` is truncated, the objects are not,
and the orphan-sweep cron does not fire on staging). No work.

---

## Data-blocked / unreachable, unchanged from manifest §3

| State | Status after Slice B |
|---|---|
| **Frozen market (M9)** | Permanently unreachable. Never minted. `frozen_at` remains NULL on staging; no write path exists or was added |
| **X4 · audit-feed pagination** | Product gap, not a data gap. Needs a POLISH.8 ruling |
| **Empty Discovery** | Mutually exclusive with 10 Open markets. Inspect on a preview DB |
| **Turnstile states** | Unwired; `createOAuthUser`/`acceptTosAction` contain no Turnstile call, so it never ran. Pending AUTH-TURNSTILE-WIRE |
| **Cron-driven transitions** | Crons do not auto-fire on staging. Every transition was driven by an admin function instead — as designed |
| **Graph x-domain** | Hard-pinned Sep 15 → Nov 5 2026. **Everything generated today falls OUTSIDE it**, so the profile graph will still render empty. Remedy is GRAPH-WINDOW-OVERRIDE |
| **Real ToS / Privacy bodies** | Lorem-ipsum pending LEGAL.1 |

⚠ **The graph row is the one to expect a false defect report on.** Staging now
has event-backed data, which removes one of the two causes of the empty profile
graph — but the fixed Sep 15 – Nov 5 domain remains, and August points are
filtered before reaching the chart. An inspector will see an empty graph and
file it; it is not a regression, and it is not fixed by this slice.

---

## Surprises caught + fixed in-session

**1 · `max: 1` deadlocks the generator, silently and forever.**
The first local run hung with no output. Postgres showed a connection `idle in
transaction` on a bare `begin`. Better Auth's `createOAuthUser` wraps its
user + account inserts in `runWithTransaction`, reserving a connection; the
`user.create.before` hook inside it calls `consumeIdentityPoolTuple`, which
opens a **second** transaction (`consume.ts:26`). On a one-connection pool the
inner transaction waits on a connection the outer one holds. No timeout fires,
because nothing is executing. Isolated by probe — the consume path alone is
fine, `createOAuthUser` hangs. `max: 10` matches `src/db/index.ts` and clears
it; recorded in the code as a correctness requirement, not a tuning choice.

**2 · The write guard silently PERMITTED the write it exists to refuse.**
Its self-skip was a substring — `line.includes("write-guard")` — and the new
unit test is named `write-guard.test.ts`, so the marker matched the *test's* own
frames. The loop skipped past the real caller and landed on `@vitest/runner`'s
frame, which is under `node_modules/` and therefore allowed. Caught on the unit
test's first run, by the positive control existing at all. A substring
self-marker is a guess about what else might be named similarly, and the first
file named similarly was the guard's own test. Now an exact path-prefix match
derived from `import.meta.url`.

**3 · The tripwire's first run flagged the guard's positive control — correctly.**
The control must ATTEMPT a direct write to prove the refusal fires, and an
attempted direct write is textually indistinguishable from the defect. That is
manifest §5's *"a source match false-alarms on correct code"*, encountered live
rather than quoted. Resolved by moving the control into a unit test — where it
needs no database and covers more — **not** by exempting the runner, which would
have blunted the tripwire for every future file.

**4 · `runner-gating.test.ts` went RED on the new runners, as designed.**
Slice A wrote it to cover "the generator/gate runners Slices B–D add". Its
hard-coded predicate name was the only thing that needed to move, and it moved
to a closed set with its own controls rather than to a wildcard.

**5 · A dangling reference created by the deletion.** An integration-test comment
cited `seed-debate-view-staging.ts:263-282` as the canary that caught a masking
defect. Re-worded to keep the history and stop pointing at a deleted file.

---

## `@code-reviewer` — findings and what was done

Verdict: **no CRITICAL**. No invariant weakened, no refusal trigger crossed, no
`src/` change, `_lib/guards.ts` byte-identical to `main`. **Every HIGH and
MEDIUM was fixed in-session before the PR opened**, per §5.11.

### HIGH · all three were real gaps in the load-bearing assertion

**H1 — primitive 4 was bypassable through an `src/` write helper.** Caller
attribution allows any `/src/` frame, and `src/` contains thin helpers that
perform a write on the caller's behalf: `insertEvent(tx, …)` runs
`tx.execute(sql\`INSERT INTO events …\`)`, `appendLedgerRow(tx, …)` runs
`tx.insert(dharmaLedger)`. The generator legitimately holds a `tx`, so
`insertEvent(tx, { eventType: "bet.placed", … })` would have passed **all three
controls** — sanctioned handle, `src/` frame, and text containing neither
forbidden pattern. **Exactly the W-G circularity.** The shipped generator never
did it, but Slice C adds ~10 more call sites to the same file.
**Fixed:** an **import allowlist** — the runners may import from `@/server/**`
only the entrypoints Ratification Record §7 ratifies. Adding a name is a
decision, not an edit. `@/server/events/insert` and `@/server/dharma/persist`
are pinned as *not* ratified, as the allowlist's own positive control.

**H2 — the structural claim was false: `guardedDb.$client` handed out the raw
`postgres` client.** `_lib/client.ts` asserted "the generator has no handle a
direct `INSERT INTO` could travel on"; drizzle 0.45 exposes `db.$client`, and
the proxy's fall-through returned it. `db._.session.execute(…)` and
`db.with(cte).insert(bets)` were the same shape.
**Fixed:** `$client`, `_` and `session` now throw `DirectWriteForbiddenError`;
`with` routes through caller attribution and its returned builder is proxied.
The header's claim is now true rather than aspirational.

**H3 — neither write-capable runner had a G-3 analogue.** The reset asserts
against the **live socket** (`assertLiveConnection`) precisely because W-B item 2
says a config can say staging while the connection says otherwise. The generator
— which writes ~440 rows — did only string matching on the env var.
**Fixed:** both runners now call **the reset's own `assertLiveConnection`** in
`beforeAll` (staging mode), so the three cannot drift and a hardening of G-3
reaches all of them; and `resolveRunnerTarget`'s staging branch gained the
`isAllowedStagingHost` config-level belt it already applied in local mode.

### MEDIUM · all fixed

- **Gate 2's carrier did not cover the vacuity mode it named.** `markets > 0`
  proves markets exist, not that any was *checked* — Drafts `continue`, and an
  empty market conserves trivially. Now counts markets that reached the checker
  **with non-empty flows** and asserts that count > 0.
- **G2.2 was silently absent** (the plan requires
  `checkCorrectedMarketConservation` to run "anyway"). Now branches on
  `resolution_events.event_kind` the way the ratified scale harness does, so a
  `correct` row gets identity (ii) instead of being mis-checked with (★).
- **Five count-equals-zero gates had no carrier** (G1.2, G1.4 including
  per-status, G2.3, G2.4, G6.2) — the log's claim that each one had a carrier
  was **wrong**. Added.
- **`runner-gating.test.ts`'s M-f2 window had been widened 120 → 200 with no
  reason given.** The real gap is 8 characters. Reverted to 120, with the
  reason recorded.
- **The closed predicate set did not pin `requireWriteIntent`** — a future
  write-capable runner gating with the read-only variant would have passed every
  assertion while skipping the G-5 analogue. The generator is now pinned to
  `true` explicitly.
- **The `@sentry/nextjs` stub silenced fail-open channels.** `insertEvent`
  continues past an ON-CONFLICT payload divergence via `safeCaptureException`,
  and `runBetTransaction` reports retry exhaustion via `captureMessage`; with
  both stubbed and never read back, a run that tripped either looked green. Now
  **asserted** post-run — the mock is evidence, not silence.
- **The production refusal was not actually first**, contrary to `target.ts`'s
  own comment: mode and intent were checked ahead of it, so a prod URL with an
  unset ack token reported "the acknowledgement value is not set". Hoisted above
  both, and it now checks `DATABASE_URL` and `DATABASE_URL_STAGING` together —
  the refusal must not depend on getting the mode right.

### LOW · fixed or recorded

- **`events` never appeared in `forbiddenTableWrites()`.** Every event row is
  written through `tx.execute`, and `tableNameOf` returned a blanket
  `"(raw-sql)"` — so the highest-value table was invisible to the log while a
  comment claimed otherwise. The table is now parsed out of the SQL text.
- **G6.3 was a verbatim duplicate of G6.1.** Slice B drives no sells, so the
  bets-vs-positions distinction has nothing to discriminate yet. Converted to an
  `it.skip` naming Slice C, like gates 4 and 5.
- **`String(err)` on a JSON parse failure echoes surrounding file content** —
  the one path in `captured-identities.ts` that could print a real address into
  a log. Now reports the error *name* only.
- **`.insert(schema.bets)` and import aliases defeat the source patterns.**
  Inherent to a source match; recorded in the docblock so a later reader does
  not over-trust the tripwire. The behavioural guard catches all three forms.
- **Provenance, confirmed for the record:** manifest v1.2 was relayed, not
  CC-authored — copied from the operator's delivered file and verified by line
  count (181), closing-line prefix, and `md5` against the source. ADR-0035
  Addendum A.3 is the kickoff's verbatim text, appended after A.2 with primitives
  1–7, A.1 and A.2 untouched (the diff is purely additive).
- **Three captured identities rather than the plan's one** is operator-directed:
  the kickoff states "two other Google-linked accounts carrying the same hazard
  — use all three."

### Re-verified after the fixes

Local: 419 unit tests, generator 8/8, gates 13 passed + 3 skipped.
**Then the full cycle re-run against real staging with the final artifacts** —
`pnpm staging:reset` → `pnpm staging:generate` → `pnpm staging:gates`, all exit
0, `orphan_bets=0 zero_share_bets=0`, guards 78/0 disabled, migrations 25,
`frozen_at` NULL, P-owner 1833.33 Đ, P-empty exactly 1000 Đ.

## Open questions

1. **Manifest §4 gate 3's wording is wrong about the mechanism.** It (and plan
   G3.1) describe `loadDurableReplay` as reproducing *"current state from the
   event log"*. The shipped function does not read `events` at all — it reads the
   durable `bet_receipts` row for an idempotency key and reports
   replay / mismatch / absent (ADR-0031). The gate asserts what the function
   actually does. **A documentation defect in the manifest, not a missing
   capability.** Needs a one-line v1.3 correction, or an explicit ruling that
   gate 3 means something broader and a second assertion is owed.
2. **Market media rows point at no R2 object** (decision 6). STEP 8b proves the
   upload path works, so this is a Slice C build item rather than a blocker —
   but until it lands, market images will 404 in POLISH.3.
3. **The F2 message arm has still never rendered** (STEP 6). Observing it means
   causing a G-4 failure on a real reset, which is not worth manufacturing.

---

## Next session starts at

**Slice C, on a fresh prompt.** Exact next action:

> Extend `tests/staging/fixtures.ts` with the §2.3 content shapes on M2 —
> twelve posts (`LATEST_INTERLEAVE_INTERVAL + 2`), two-sided replies, C5's
> many-replies post, C6's zero-reply post, C8's truncating post — then run
> `doppler run --project zugzwang-experiment --config stg -- pnpm tsx
> scripts/verify-ranking-staging.ts sp-m2-active` and **calibrate the C3 lane
> stakes against its printed aggregates** until Most Debated, Highest Stakes and
> Contested each have exactly one dominant post and the majority carry none.

Then, in order: the flip/exit sequences (P-flipped, P-exited), bookmarks (B1/B2),
moderation (X1–X3, ban AFTER content exists), C7's image attachment (8b proved it
works), and gates 4 and 5 — replacing the two `it.skip` scaffolds. W-D's carrier
correction lands with gate 5: **G5.1 → P-empty at exactly 1000; G5.2 → a
participant that actually bets.**

## Context to preserve

- **`pnpm staging:rebuild` does not exist yet.** The plan names it as
  reset → seed → generate → gates. Slice B ships the first three as separate
  scripts; the composite is Slice D's.
- **The captured-identity file is machine-local** at
  `~/.claude/zz-p-owner-identity.json`, is **not** in the repo, and is loaded
  fail-closed before any row is written. Three real Google identities. A
  regeneration on a machine without it refuses rather than fabricating a `sub`.
- **The local proving loop** is `ZUGZWANG_STAGING_TARGET=local
  ZUGZWANG_STAGING_WRITE_ACK=… vitest run --config vitest.staging.config.ts
  tests/staging/<runner>`. It needs a clean local DB with a seeded
  `identity_pool`; the reset runner cannot do this (G-3 requires a Supabase
  host, by design).
- **P-owner rests at 1833.33 Đ** and P-empty at exactly 1000. Those two figures
  are gate-5 carriers; a Slice C fixture change that moves them needs to know it.
- The staging uploads bucket holds one 70-byte probe orphan (W-E, accepted).

## Time

One session, 2026-08-06 IST. STEP 0 through STEP 10 in a single pass.
