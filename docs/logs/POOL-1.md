# POOL-1 / POOL-2 — the connection ceiling: an incident that did not reproduce

**State: CLOSED as DIAGNOSED, NOT FIXED.** The remedy is PERF-1's — see §0 and
§6. `max` stays at **10**. Transaction mode stays parked; it needs an ADR when
PERF-1 lands.

Branch `fix/pool-connection-ceiling`. Docs-only. 2026-08-07 → 2026-08-08.

---

## 0 · The dashboard answers, and the four rulings

Both dashboard readings came back, and they close the questions §12 left open.

**`pool_size = 15` — CONFIRMED at the dashboard.** Compute size **Micro**; the
15 is that tier's default. **Max client connections 200, fixed** — so the 200 is
not the binding limit and never was. The binding limit is the tier default, and
it is the number the pooler names in its own error text (§2).

### ~~RULED · do NOT upsize compute~~ → ⛔ **PREMISE DISCHARGED 2026-08-10. DO NOT APPLY.**

> ~~Raising the tier raises the ceiling **without shortening a 35-second page**. That masks
> PERF-1 until production — where load is higher and the same defect surfaces at the worst
> possible moment. **Fix duration; the ceiling stops binding on its own.**~~

⚠ **STRUCK, not deleted.** The ruling was correct and it was **entirely instrumental to
PERF-1 being unfixed** — all three of its clauses name that premise: a 35-second page exists,
upsizing would mask it, and *"the ceiling stops binding on its own"* once duration is fixed.
**PERF-1 closed on 2026-08-10. The 35-second page does not exist** — 361.6 → 5.34 ms per
round trip, Discovery 35.07 → 0.692 s p50, staging-verified. §6 of this same file was struck
at that close-out; **this section was not, and it is the section a reader reaches first.**

**The prohibition therefore does not bind.** Compute sizing is now governed by **ADR-0038**,
which authorises tiers through Large and requires a **measured** number before XL. ⚠ **This
is a strike, not a licence:** ADR-0038's own decision 2 says nothing is bought before a load
run produces a number for it. The reason not to upsize blindly changed; the reason to measure
first did not.

### RULED · `max` stays at 10 — now for the correct reason

Not because 10 is tuned, and not because no safe value exists: because the
profile worst case is **5 concurrent against 15** (§5), and exhaustion is
**duration-driven**. **Lowering `max` shortens no request.** It would trade a
deadlock surface for nothing. The count was never the problem.

### RULED · transaction mode stays parked, and is now LESS urgent

It multiplexes, which would have addressed **churn** — and churn is falsified
(§4). It does not shorten a 35-second render, so it does not touch the mechanism
that actually exhausted the pool. ADR when PERF-1 lands.

### RULED · POOL-1 closes as DIAGNOSED, NOT FIXED

The remedy belongs to PERF-1. Nothing in `src/` changed here and nothing should
have.

---

## 1. What landed

Nothing in `src/`. This log and two `docs/parked.md` docket rows are the
deliverable.

---

## 2. The falsified premise — and a correction I owe the record

POOL-2 concluded from `pg_stat_activity` that "the pooler sustained 18
concurrent connections without error, which is above `pool_size = 15`", and
carried that forward as grounds to doubt the pool size. **That conclusion was
wrong, and the reasoning behind it was wrong.**

The Vercel runtime errors carry the pooler's own words:

> `(EMAXCONNSESSION) max clients reached in session mode — max clients are
> limited to pool_size: 15`

`pool_size: 15` is **current and confirmed**. The error is emitted by Supavisor
and names its own limit.

**Where the reasoning failed.** `pg_stat_activity` counts *Postgres backends*,
not *Supavisor client slots*. The 18 backends observed include Supavisor's
server-side connections, the sampler's own psql sessions, and the `pg_net`
worker — none of which consume a client slot in the pool the app dials.
Counting backends to infer pooler capacity conflates two different things, and
the number it produced happened to sit just above 15, which made a wrong
conclusion look like a finding. **The instrument was measuring the wrong side of
the pooler.**

The practical effect: POOL-2's §2 "either that figure is no longer current or it
was not the binding constraint" should be read as withdrawn. The figure is
current. What follows is built on the corrected premise.

---

## 3. The reconciled timeline

| Time (UTC, 2026-08-07) | Event |
|---|---|
| 17:18:06 | `dpl_8BzP4K3U7Mgk1AyaNmbDdoQX` created — `main` → production |
| 17:18:28 | `dpl_HkgAgKBJUThRgycEDieHnFKtLUbS` created — `staging` branch, the deployment that serves staging today |
| 17:28:58 | Better Auth OAuth `state_mismatch` (one event, `/api/auth/[...all]`) |
| **17:31:06 – 17:31:40** | **Burst 1.** `findSession` EMAXCONNSESSION ×11 + `APIError: Failed to get session` ×11. Routes: `/`, `/bookmarks`, `/u/[pseudonym]`, `/m/[slug]`, `/m/[slug].rsc` |
| 17:31:14 | Profile argument-substrate query begins failing, same signature |
| **19:03:58 – 19:05:03** | **Burst 2.** `users`-by-pseudonym EMAXCONNSESSION **×68**, `dharma_ledger` ×18, profile substrate continuing. Routes: `/u/[pseudonym]` only |

Both bursts carry `lastDeployment=dpl_HkgAgKBJUThRgycEDieHnFKtLUbS`. **No
deployment was created between 17:18:28 and the time of writing** — the next
entry in the deployment list is 2026-08-06.

---

## 4. STEP 1 — the deploy-churn hypothesis: **FALSIFIED**

**a. Instances in the 17:31:00–17:32:00 window.** Not enumerable from the tools
available — Vercel's runtime-log API exposes no per-instance identifier, so this
sub-question is recorded as unanswered rather than guessed. What *is* established
is the deployment state: the staging deployment was created at 17:18:28, roughly
**12.6 minutes before** burst 1 began, and was `READY` and serving by then.

**b. Correlation with a deployment event.** Burst 1 sits 12.6 min after a
deployment was created — close enough to be *consistent* with warming, not close
enough to be evidence for it. **Burst 2 is decisive against the hypothesis**: it
is 1 h 45 min after that deployment, with **no deploy in flight**, on a
deployment that was already hours old and is still live now. And burst 2 is the
*larger* event by six-fold — 68 events against 11.

**c. Other occurrences.** Yes: the signature appears at **two** distinct times
in retained logs, both on 2026-08-07, on the same deployment. Only the first is
anywhere near a deploy.

**Conclusion.** The mechanism is **not** instance churn. A larger burst occurred
in steady state, so the remedy does not lie in deploy sequencing. Both bursts
concentrate on `/u/[pseudonym]` — the authenticated, heaviest route — and burst
2 is exclusively that route. This is per-request slot-holding under
authenticated load, which is exactly what §6 describes.

### 4.1 The mechanism, observed

Runtime logs for 17:30–17:33 are retained and settle it. Two things they show:

**One deployment served all staging traffic in the window.** Every staging line
carries `dep=dpl_HkgAgKBJUThRgycEDieHnFKtLUbS`; no second staging deployment
appears at all. There was no old-drain / new-warm overlap *at the deployment
level* to churn. (One `main` deployment appears — `dpl_7oyjVmD7…` serving
`/api/cron/close-due-markets` at 17:32:28 — but that is the production target on
its own `DATABASE_URL` and consumes no staging slot.)

**The request pattern is the exhaustion.** Requests arrive in bursts of three to
four at *identical* timestamps, every few seconds, all `cache=MISS`:

```
17:31:53  GET /        17:31:54  GET /  + GET /u/RedFox000 ×2
17:32:06  GET / + GET /u/RedFox000 ×2 + GET /m/sp-m2-active
17:32:11  GET / + GET /u/RedFox000 ×2 + GET /m/sp-m2-active
17:32:14  GET / + GET /u/RedFox000 ×2 + GET /m/sp-m2-active
17:32:34  GET / + GET /u/RedFox000 + GET /m/sp-m4-new
```

That is multiple tabs open, plus `DebatePoll`'s 15-second `router.refresh()`,
each refresh re-executing the layout as well as the page.

**Now apply the durations.** A `/` render holds its slot for ~35 s (§6). The
loads at 17:31:53, 17:32:06, 17:32:11, 17:32:14 and 17:32:34 are therefore *all
still in flight simultaneously* — **five concurrent discovery renders holding
five slots**, against a pool of 15. Add the `/u/RedFox000` views at **5 slots
each** signed-in (§5) and the pool is gone. The burst window and the 35-second
hold are the same event seen from two angles.

**This is the whole incident.** Not churn, not steady-state volume, not an
undersized `max`: a slow page holding slots long enough that ordinary
walkthrough navigation overlapped itself into the ceiling.

---

## 5. The concurrent floor — measured, and code-confirmed

**Method.** `pg_stat_activity` sampled at 60 ms while a single request was in
flight, counting `state = 'active'` client backends. Counting *total* backends is
the wrong instrument and was discarded: the postgres-js pool holds warm idle
connections, so total does not move during a request — only `state` flips.

**The profile measurement lands exactly on the code.** Measured peak in-flight
for an anonymous `/u/[pseudonym]` view: **3**, reproduced across two runs. The
page issues `Promise.all([loadProfilePositions, loadProfileArguments,
loadProfileGraphSeries])` at `src/app/(public)/u/[pseudonym]/page.tsx:63` —
three, concurrent, and nothing else concurrent anywhere in the request. The
measurement and the source agree without adjustment.

Itemised, signed-in worst case:

**1.** `resolveProfileUser` — `page.tsx:55`. One, sequential. Does not raise the peak.
**2–4.** The `Promise.all` at `page.tsx:63` — **3 concurrent**.
**5.** `loadProfileTiles` — `page.tsx:68`, sequential after the `Promise.all`.
**6.** `auth.api.getSession` — `page.tsx:73` and `(public)/layout.tsx:67`. Sequential.
**7–8.** Header balance + portfolio — `layout.tsx:71–76`, a `Promise.all` of two. **+2 concurrent, and these are the two an anonymous probe never issues** (`session?.user?.id` falsy → `[null, null]`, zero statements).

**Signed-in worst case = 5** (3 + 2), assuming RSC overlaps the layout's awaits
with the page's — the conservative reading.

**The discovery figure of 5 reported in POOL-2 is withdrawn as contaminated.**
`/` is strictly sequential in source (§6), so it holds **one** connection at a
time; the sampler was picking up unrelated baseline traffic. The corrected
reading for `/` is **1 slot, held for 35 seconds** — which is the finding that
matters.

**Does any path hold a connection while awaiting a second? No.** All three
transaction wrappers — `bets/transaction.ts:117`, `resolution/transaction.ts:128`,
`markets/transaction.ts:105` — thread the `tx` handle through every inner call.
A sweep of every module referencing `DbTransaction` found no
`db.select/insert/update/query/execute/transaction` inside a held transaction;
the only `db.` call sites are the three `db.transaction(` entry points. **No
deadlock risk, so nothing constrains the margin from below.**

**Why `max: 10` is right.** The floor is 5. Ten sits comfortably above it with
room for the sequential tail, and below it lies a deadlock surface for no
demonstrated benefit. **The count was never the problem** — 15 ÷ 5 is three
concurrent signed-in profile views, which is not a load anyone hit. The
*duration* each slot is held is the problem.

---

## 6. PERF-1 — the 35 seconds, and why it is the same defect

A request holding a connection for 35 s holds a **pool slot** for 35 s.
Exhaustion of 15 slots does not require concurrency when each request is that
slow — a handful of overlapping loads suffices. **Diagnosis only; no fix here.**

### 6a–6c · Discovery (`/`) — ~~41 sequential round-trips~~ **97**, doubly nested

> ### ⛔ STRUCK AT PERF-1 CLOSE-OUT (2026-08-10) — two numbers in this table were wrong
>
> Left visible rather than rewritten, because the reasoning built on them ran
> through three documents and a reader needs to see which step failed.
>
> **1. "41 round-trips" counts function CALLS, not SQL statements. The true count
> is 97.** `loadPriceSeries` issues **4** statements (`price-series.ts:58, 90, 110,
> 178`) and `selectHeroTopPosts` **5** (`hero.ts:73, 78, 96, 106, 115`), so row 2's
> second loop is **9N, not 2N**. Total = 1 + 3N + 9N = **1 + 24 + 72 = 97** at
> `DISCOVERY_GRID_SIZE = 8`.
>
> **2. "warm p50 ≈ 1.1 s" — THERE IS NO WARM REGIME.** Re-probed at PERF-1: seven
> runs, six after the first, **spread 0.29 s around a flat 35 s floor**, gaps to
> 150 s, **no decay**. The route had exactly one regime. The 1.1 s was almost
> certainly **TTFB**: the Suspense boundary flushes the shell and `LoadingSkeleton`
> immediately, so any time-to-first-byte measure reads ~1 s on a 35 s request
> (measured TTFB at PERF-1: 0.28–2.15 s against 35 s totals). POOL-1 records no
> cache header for the probe, so HIT-vs-MISS cannot be settled from this log — but
> `/` is `force-dynamic` and 17/17 PERF-1 requests were MISS, so a cache HIT is
> close to impossible. **The metric, not the cache state, is the artifact.**
>
> **Row 8 is therefore void in both halves.** There was no unexplained cold cost:
> at the corrected count and the measured cross-region latency (**361.6 ms/trip**,
> functions in `iad1` against a Mumbai DB), the round-trips account for the whole
> 35 s. **Cause: ADR-0006 ratified `bom1` and it was never applied.** Fixed at
> PERF-1 — **5.34 ms/trip**, Discovery **0.584 s p50**. See `docs/parked.md`
> PERF-1 and the ADR-0006 patch record.
>
> **The lesson for reading tables like this one:** row 8 was correct arithmetic on
> two wrong inputs, and it *reported itself as an open question* rather than a
> conclusion — which is why it survived review three times. A derived row is only
> as good as the rows it cites.

| # | Finding | Evidence |
|---|---|---|
| 1 | `listOpenMarkets` issues **1 + 3N** queries: one market list, then `getMarketPricing`, `getMarketTotals`, `getDefaultMarketMediaUrl` **sequentially per market** | `src/server/discovery/list.ts:48–63` |
| 2 | `DiscoveryContent` then runs a **second** sequential loop over the same cards: `loadPriceSeries` + `selectHeroTopPosts` — **2N** more | `src/app/(public)/page.tsx:59–65` |
| 3 | ~~Total at `DISCOVERY_GRID_SIZE = 8`: **1 + 24 + 16 = 41 sequential round-trips**~~ → **STRUCK: 1 + 24 + 72 = 97.** Zero parallelism anywhere (that half stands) | both loops above |
| 4 | Genuinely sequential: **only #1's first query** (the market list supplies the ids). Everything after it is per-market and **independent** — sequential only because nobody parallelised it. The source says so itself: "grouped-query batching is the OQ-1 C follow-up's optimization" | `list.ts:40–43` docblock |
| 5 | The two loops are **separately** unnecessary: the second loop re-iterates cards the first already produced, so `loadPriceSeries` / `selectHeroTopPosts` could ride the first pass or a single batched pass | `page.tsx:59–65` |
| 6 | `force-dynamic` costs the **entire** ~~41~~ **97**-round-trip composition on every request, uncached. It is required only in the narrow sense that the page reads no dynamic API and would otherwise static-prerender at build — the docblock says exactly this. It is **not** required for correctness; it is standing in for a cache policy that was deferred | `page.tsx:19` + docblock `:12–18` |
| 7 | Measured: **35.1 s** at concurrency 1, four independent runs (35.09 / 35.33 / 35.15 / 37.28 s). ~~Under concurrency the same route serves **p50 ≈ 1.1 s** with a 35 s tail~~ → **STRUCK: no warm regime exists** (PERF-1, seven runs, flat 35 s floor, no decay). The 1.1 s was almost certainly **TTFB**, not total | POOL-2 probe |
| 8 | ~~Implied per-round-trip: **~857 ms cold, ~27 ms warm** … a large one-time cold cost sits underneath~~ → **VOID IN BOTH HALVES.** Correct arithmetic on two wrong inputs (see the banner above). Actual: **361.6 ms/trip**, cross-region — functions in `iad1` against a Mumbai DB. **There was no unexplained cold cost.** Fixed at PERF-1 → **5.34 ms/trip** | derived from #3 and #7, both struck |

### 6d · Profile (`/u/[pseudonym]`) — 6.2 s warm, already partly parallel

| # | Finding | Evidence |
|---|---|---|
| 9 | The three heavy loaders **are** parallelised — `Promise.all` of positions / arguments / graph | `page.tsx:63` |
| 10 | `loadProfilePositions` is nonetheless **8 sequential statements** internally, with no loop-issued queries | `positions.ts:139, 163, 178, 189, 200, 221, 254, 306` |
| 11 | Four more sequential awaits bracket the `Promise.all`: `resolveProfileUser`, `loadProfileTiles`, `getSession`, `searchParams` | `page.tsx:55, 68, 73, 83` |
| 12 | So the profile is the **good** shape and still takes 6.2 s: the parallelism is at the wrong granularity — three concurrent chains, each internally serial | #9 + #10 |
| 13 | Both bursts concentrate here, and burst 2 is **exclusively** here. This is the route that exhausted the pool | §3 |

### 6e · Estimate if the sequential reads were batched

| Route | Today | If batched / parallelised |
|---|---|---|
| `/` discovery | **1 slot × ~35 s** cold, ~~41~~ **97** round-trips | ~2–3 slots × well under 1 s. Peak connections *rise*; slot-seconds fall by more than an order of magnitude |
| `/u/[pseudonym]` | 3 slots × ~6.2 s ≈ 19 slot-seconds | ~3–5 slots × ~1 s ≈ 4 slot-seconds |

**The trade is the point, and it is favourable.** Batching *raises* peak
concurrent connections per request and *collapses* how long each is held. Against
a 15-slot pooler, slot-**seconds** is the quantity that exhausts, not peak count:
one discovery load holding a single slot for 35 s costs the pool more than five
loads holding five slots for one second. **This is why PERF-1 and the pool
incident are the same defect, and why raising or lowering `max` addresses
neither.**

---

## 7. Transaction-mode viability — VIABLE, no blocker found

Read-only audit; nothing changed. Recorded, not built — it needs an ADR.

| Surface | Finding | Survives transaction mode |
|---|---|---|
| `src/db/index.ts:18` | `prepare: false` already set, commented as forward-safe for a `:6543` transaction pooler (ADR-0024 §Decision Outcome #8) | ✅ |
| Advisory locks | none in `src/` | ✅ |
| LISTEN / NOTIFY | none in `src/` | ✅ |
| Session GUCs | every one is `SET LOCAL` — transaction-scoped by construction: `bets/transaction.ts:177,181`, `resolution/transaction.ts:191,195`, `markets/transaction.ts:165,169` | ✅ |
| `runBetTransaction` / `lockPool` / SERIALIZABLE retry | `SELECT … FOR NO KEY UPDATE` and the isolation level are all *inside* `db.transaction(...)`; a transaction-mode pooler pins one server connection for the transaction's life | ✅ |
| Idempotency layer | Redis-backed (Upstash), no Postgres session state | ✅ |

No session-scoped dependency found.

---

## 8. The reproduction — will not reproduce, and now we know why

~180 requests, five route mixes, concurrency 1 → 30, anonymous. Zero 5xx, zero
`EMAXCONNSESSION`. Full per-level TTFB table was in the POOL-2 draft; the
finding that survives is the explanation:

**1.** The probe was **anonymous**, so it never issued the layout's
`Promise.all` — 2 of the 5 concurrent connections a real signed-in view holds,
and precisely the ones failing in burst 1 (`findSession`, then the header reads).
**2.** ~~The probe hit routes **warm**, where discovery costs ~1.1 s instead of
35 s~~ — **STRUCK (PERF-1): there is no warm regime**; the 1.1 s was TTFB, not total. The point that survives is that the probe never reproduced the slot-holding — so it never reproduced the slot-holding that is the actual mechanism.
**3.** Escalating concurrency made Vercel **scale out**, spreading load across
more instances rather than concentrating it on few — the opposite of the
incident's shape.

The probe was therefore not a null result about the ceiling; it was a
measurement of a different regime.

### 8.1 The authenticated probe — blocked, and why it was not forced

Exactly one live session exists on staging (`RedFox000`, created 2026-08-07
17:29 — the walkthrough's own; note it is **two minutes before burst 1**). Its
token was read from `sessions` and signed with Better Auth's own
`createHMAC("SHA-256","base64urlnopad")`, verified byte-identical to a Node
`createHmac(...).digest("base64url")`. `GET /api/auth/get-session` returns
`null` for every cookie form tried — signed, unsigned,
`zugzwang.session_token`, `__Secure-` prefixed. Most likely
`BETTER_AUTH_SECRET` drift between Doppler `stg` and Vercel; docketed, and it
cannot be settled from a CC session because Vercel values are write-only.

---

## 9. Sentry — parked, three verified defects

**1.** `/api/_smoke-error` **has never routed** — the `_` prefix makes it a
Next.js App Router *private folder*. `curl` returns Next's own `/404`
(`x-matched-path: /404`); the build manifest `.next/server/app/api/` lists
`auth bets cron health uploads visits`.
**2.** The `sentry-routing` item **has always skipped** —
`scripts/smoke-staging.ts:259` requires `SENTRY_ORG`, absent from Doppler `stg`.
**3.** It asserts against **`zugzwang-prod`, which does not exist** — the org
`zugzwang-foundation` holds only `zugzwang-staging` and `zugzwang-experiment`.

Each alone is sufficient to make the control a lookalike. Docketed as one row
in `docs/parked.md`.

### 9.1 STEP 1c — NOT DETERMINED

The free Sentry test was contingent on reproducing a server-side 500. No 500 was
produced, so nothing's arrival could be checked. It is neither ARRIVED nor DID
NOT ARRIVE. `zugzwang-staging` still carries exactly one issue in 24 h and in
14 d — the 2026-07-21 client-side capture. **Note what §3 adds**: dozens of
genuine server-side EMAXCONNSESSION 500s occurred on 2026-08-07 and appear in
Vercel's runtime errors with full stacks, while Sentry recorded none of them.
That is stronger evidence than POOL-1 had that the server SDK is not delivering
— but it is still not proof, and the deploy that would settle it is the
founder's call.

---

## 10. Incidental finding, unrelated to the pool

`ProfileTradeStreamError: non-positive shares on buy` — 17 events across three
distinct bet ids, 2026-07-30 → 2026-08-04, route `/u/[pseudonym]`, on two
earlier deployments. Not connection-related and not investigated here. Flagged
because it surfaced in the same error listing and nothing else is tracking it.

---

## 11. Decisions taken on your behalf

**1. Corrected POOL-2's own conclusion rather than carrying it forward.** The
"18 > 15" inference was wrong: `pg_stat_activity` counts Postgres backends, not
Supavisor client slots. §2 records the correction and what the wrong instrument
was.
**2. Sampled `state = 'active'` rather than total backends.** Total does not
move during a request — the pool holds warm idle connections.
**3. Withdrew the discovery floor of 5 as contaminated.** The source is strictly
sequential, so the honest figure is 1 slot held 35 s. The measurement that
*survives* is the profile's 3, which lands exactly on `page.tsx:63`.
**4. Substituted anonymous concurrency for the authenticated probe** when the
cookie would not resolve, rather than halting. §8 records why that changed the
regime under test, which is the reason it did not reproduce.
**5. Declined to forge a session row on staging** to manufacture the
authenticated probe. It would have been a write to a live database, outside the
STAGING-PARITY intent-token contract, to make a probe work rather than to fix
the incident. The authenticated probe remains genuinely un-run, and that is the
honest state.
**6. Recorded STEP 1c as NOT DETERMINED** rather than resolving it to either
branch.
**7. Recorded STEP 1a (instance enumeration) as unanswered** rather than
inferring instance counts from request timing.

---

## 12. Open questions

~~**1. What is the large one-time cold cost on `/`?** 41 sequential round-trips
explain the warm 1.1 s, not the cold 35 s (§6a #8). PERF-1 should not begin by
assuming batching alone fixes it.~~

**1. ANSWERED AND STRUCK (PERF-1, 2026-08-10): there was no large one-time cold
cost, and the question was unanswerable as posed** — it rested on two wrong
numbers (41 trips, and a "warm 1.1 s" regime that does not exist; see §6a). At
the true count of **97** and the measured **361.6 ms** cross-region round-trip,
the trips account for the entire 35 s. **Cause: ADR-0006 ratified Vercel region
`bom1` on 2026-05-05 and it was never applied — functions ran in `iad1`,
~12,000 km from a Mumbai database.** Fixed by applying it: **5.34 ms/trip**,
Discovery **35.07 → 0.584 s p50**, Profile **6.2 → 0.189 s p50**. The warning
not to assume batching was right for the wrong reason — batching was never the
fix, but not because a cold cost hid beneath it.
**2. Does `BETTER_AUTH_SECRET` match across Doppler `stg` and Vercel
`staging`?** Docketed. **Must be settled before DP.2's prod promote** — the
same sync path carries every production secret.
**3. Is the server-side Sentry SDK delivering at all?** §9.1. Requires a deploy.
Founder's call.

## 13. Next session starts at

PERF-1, from §6's findings table — the fix is a separate, ratified task. The
transaction-mode ADR and the D.5 ruling are the founder's and come first.
