# POOL-1 / POOL-2 — connection ceiling: measure, fix, verify

**State: HALTED at STEP 1d (POOL-2 sequencing).** The incident does not
reproduce. No `max` change shipped — the number that would size it is measured,
but the failure it is meant to prevent could not be provoked, and a fix that
cannot be verified is not a fix.

Branch `fix/pool-connection-ceiling`. Time: 2026-08-07 → 2026-08-08.

---

## 1. What landed

Nothing in `src/`. This log is the deliverable. `src/db/index.ts` `max` stays
at **10**, unchanged and deliberately so (§4).

---

## 2. The reproduction — WILL NOT REPRODUCE

**Method.** An escalating-concurrency probe against
`https://staging.zugzwangworld.com`, sampling `pg_stat_activity` on the staging
database every 60 ms for the duration of each batch. Read-only throughout; no
writes, no regenerate, no production contact.

| Concurrency | Routes | Fail | TTFB min / p50 / max | Peak in-flight backends |
|---|---|---|---|---|
| 1 | `/u/[pseudonym]` | 0/1 | 6262 / 6262 / 6262 ms | 3 |
| 2 | 3× profile | 0/2 | 6291 / 11143 / 11143 ms | 3 |
| 4 | 3× profile | 0/4 | 6256 / 7367 / 9800 ms | 6 |
| 6 | 3× profile | 0/6 | 2872 / 6331 / 7401 ms | 12 |
| 8 | 3× profile | 0/8 | 1114 / 2919 / 7421 ms | 14 |
| 10 | 3× profile | 0/10 | 1011 / 1106 / 6283 ms | 14 |
| 12 | 3× profile | 0/12 | 671 / 1041 / 2707 ms | 9 |
| 16 | 3× profile + `/bookmarks` | 0/16 | 324 / 1043 / 2708 ms | 7 |
| 20 | 3× profile + `/bookmarks` | 0/20 | 274 / 1035 / 7407 ms | 11 |
| 25 | 3× profile + `/bookmarks` | 0/25 | 288 / 1035 / 1717 ms | 8 |
| 30 | 3× profile + `/bookmarks` | 0/30 | 269 / 1005 / 1405 ms | 10 |
| 1 | `/` (heaviest) | 0/1 | 35148 ms | 5 |
| 8 | `/` | 0/8 | 655 / 1117 / 35015 ms | 6 |
| 16 | `/` | 0/16 | 638 / 1205 / 37276 ms | 8 |

**~180 requests, five route mixes, concurrency 1 → 30. Zero 5xx. Zero
`EMAXCONNSESSION`.**

**Why it will not reproduce.** Total client backends **plateau at 18 and stop**
— the count grew 7 → 10 → 16 → 18 across escalation and never moved again, at
any concurrency. Postgres itself is nowhere near a limit: `max_connections` 60,
`superuser_reserved_connections` 3, 19 backends in use. The pooler sustained
**18 concurrent client connections without error**, which is materially above
the `pool_size = 15` the POOL-1 diagnosis rested on. Either that figure is no
longer current or it was not the binding constraint. **This is the finding that
invalidates the planned remedy**: the `max: 10 × 2 warm instances = 20 > 15`
arithmetic does not describe the system as it behaves today.

Load also made the system *faster*, not slower — p50 fell from 6.2 s at
concurrency 1 to ~1.0 s at concurrency 30 as Vercel warmed additional instances.
More instances means more pools, but also more spread; the ceiling never bound.

### 2.1 The authenticated probe — BLOCKED, and worked around

STEP 1a could not be completed. Exactly one live session exists on staging
(`RedFox000`, created 2026-08-07 17:29, expires 2027-09-11 — the walkthrough's
own session). Its token was read from `sessions`, and the cookie was signed with
**Better Auth's own** `createHMAC("SHA-256","base64urlnopad")` against
`BETTER_AUTH_SECRET` from Doppler `stg` (verified byte-identical to a Node
`createHmac(...).digest("base64url")`). `GET /api/auth/get-session` returns
`null` for every form tried — signed, unsigned, `zugzwang.session_token`,
`__Secure-` prefixed.

The most likely cause is **Doppler↔Vercel secret drift on
`BETTER_AUTH_SECRET`** — the same drift class already proven in this project,
where `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` live in Vercel
but are absent from Doppler `stg`. It cannot be confirmed from here: Vercel env
values are write-only once set. **If the secrets differ, every session cookie
issued by the deployment is unverifiable by anything holding the Doppler value —
worth a separate look, and it is a decision, not an edit.**

Worked around by driving anonymous concurrency instead. That is a weaker probe
by exactly one connection (the session lookup, sequential — see §3), and the
ceiling did not bind even so.

---

## 3. The concurrent floor — MEASURED

**Method.** `pg_stat_activity` sampled at 60 ms while a single request was in
flight, counting `state = 'active'` client backends (`backend_type = 'client
backend'`, sampler's own pid excluded). Counting *total* backends is the wrong
instrument and was discarded: the postgres-js pool holds warm idle connections,
so total does not move when a request runs — only `state` flips.

| Route | Peak in-flight | Sustained (histogram) |
|---|---|---|
| `/u/[pseudonym]` (profile, anonymous) | **3** | 3 held ≈ 0.7–1.0 s, reproduced across two runs |
| `/` (discovery, anonymous) | **5** | 3–4 sustained across 456 samples; 5 at the tail |

**Itemised, signed-in worst case:**

**1.** Session lookup — `(public)/layout.tsx:67`, `auth.api.getSession`. One
connection, sequential, ahead of everything else. Does not raise the peak.
**2–3.** Header balance + header portfolio — `layout.tsx:71–76`, a
`Promise.all` of two independent reads. **+2 concurrent, and these are the two
an anonymous probe never issues** (`session?.user?.id` falsy → `[null, null]`,
zero statements).
**4.** Page data — measured above: 3 for a profile, 5 for discovery.

So the **measured anonymous floor is 5** (discovery) and the **signed-in worst
case is 7**, assuming RSC overlaps the layout's awaits with the page's — which
is the conservative assumption and the one to size against.

### 3.1 Does any path hold a connection while awaiting a second?

**No.** All three transaction wrappers — `bets/transaction.ts:117`,
`resolution/transaction.ts:128`, `markets/transaction.ts:105` — open
`db.transaction(...)` and thread the `tx` handle through every inner call
(`applyTxTimeouts(tx)`, `lockPool(tx, …)`, `lockMarket(tx, …)`,
`callback({ tx, … })`). A sweep of every module referencing `DbTransaction`
found no `db.select/insert/update/query/execute/transaction` inside a held
transaction — the only `db.` call sites are the three `db.transaction(` entry
points themselves. **No deadlock risk found, so the margin is not constrained by
one.**

---

## 4. What `max` became, and why — UNCHANGED at 10

Not changed. Two independent reasons:

**1. The gate in STEP 4 fires on the measured number.** Floor 7 (signed-in
worst case) + 2 margin = 9; 9 × 2 warm instances = **18 > 15**. On the stated
pool size, no safe value exists and the remedy is a pooler resize or transaction
mode — both decisions, neither an edit.

**2. The premise the gate rests on is contradicted by measurement.** The pooler
sustained 18 concurrent connections without error (§2). If the limit is not 15,
the arithmetic above is sizing against a number that is not real, and lowering
`max` from 10 to a smaller value would be a change with no demonstrated failure
to prevent and a real deadlock surface to introduce.

Reducing `max` below the measured floor of 7 — and 10 is already only 3 above it
— would make a request that needs a second connection queue behind itself. That
is strictly worse than the current behaviour, which is the exact failure STEP 2
exists to prevent.

**The binding open question is the pooler's actual `pool_size`.** That is a
dashboard read (Class-3) and it decides everything downstream.

---

## 5. Sentry — the three smoke defects (parked, all verified)

Established at POOL-1, unchanged here:

**1.** `/api/_smoke-error` **has never routed.** The `_` prefix makes
`src/app/api/_smoke-error/` a Next.js App Router *private folder*, excluded from
routing. Proof: `curl` returns Next's own `/404` (`x-matched-path: /404`), and
the build manifest `.next/server/app/api/` lists `auth bets cron health uploads
visits` — no `_smoke-error`.
**2.** The `sentry-routing` smoke item **has always skipped** —
`scripts/smoke-staging.ts:259` requires `SENTRY_ORG`, which is absent from
Doppler `stg` (it exists only in Vercel).
**3.** The script **asserts against a project that does not exist**. It queries
`zugzwang-prod`; the org `zugzwang-foundation` contains only `zugzwang-staging`
and `zugzwang-experiment`.

### 5.1 STEP 1c — NOT DETERMINED

The free Sentry test was contingent on reproducing a server-side 500. **No 500
was ever produced**, so there is nothing whose arrival could be checked. It is
neither ARRIVED nor DID NOT ARRIVE. `zugzwang-staging` still carries exactly one
issue in 24 h and in 14 d — the 2026-07-21 client-side capture. Recorded as
undetermined rather than forced into a bucket; STEP 5 was skipped accordingly,
per its own condition.

---

## 6. Transaction-mode viability — VIABLE, no blocker found

Read-only audit. Nothing changed.

| Surface | Finding | Survives transaction mode |
|---|---|---|
| `src/db/index.ts:18` | `prepare: false` already set, commented as forward-safe for a `:6543` transaction pooler (ADR-0024 §Decision Outcome #8) | ✅ |
| Advisory locks | none in `src/` | ✅ |
| LISTEN / NOTIFY | none in `src/` | ✅ |
| Session GUCs | every one is `SET LOCAL` — transaction-scoped by construction: `bets/transaction.ts:177,181`, `resolution/transaction.ts:191,195`, `markets/transaction.ts:165,169` | ✅ |
| `runBetTransaction` / `lockPool` / SERIALIZABLE retry | `SELECT … FOR NO KEY UPDATE` and the isolation level are all *inside* `db.transaction(...)`; a transaction-mode pooler pins one server connection for the transaction's life | ✅ |
| Idempotency layer | Redis-backed (Upstash), no Postgres session state | ✅ |

No session-scoped dependency found. The decision remains the founder's.

---

## 7. STEP 6 verdicts — NOT RUN

All five skipped. 6a requires a reproduction to move from fail to pass; there is
no failing state to move. Running 6b–6e would verify a change that was not made.

---

## 8. TTFB — recorded, not chased

Separate finding, per the kickoff.

- `/api/health`: 2.39 s cold, then **0.66 s** warm.
- `/u/[pseudonym]`: **6.2 s** cold and reproducible at concurrency 1.
- `/` (discovery): **35.1 s** at concurrency 1, reproducible across four
  independent single-request runs (35.09 / 35.33 / 35.15 / 37.28 s). Under
  concurrency the *same* route serves p50 ≈ 1.1 s with a 35 s tail — so the 35 s
  is a cold-path cost, not a per-request cost.

35 s is an order of magnitude worse than the 5.4 s the kickoff carried. The
page's own docblock names the likely cause: "Sequential per-market reads (the
bounded ≤8 × ~5-read cost the plan accepts uncached)" — up to ~40 sequential
round-trips, `force-dynamic`, no cache (`(public)/page.tsx:19,42–47`). Recorded
only. **Not chased, and it is not what this task was about.**

---

## 9. Decisions taken on your behalf

**1. Sampled `state = 'active'` rather than total backends.** Total is the
wrong instrument — the pool holds warm idle connections, so it does not move
during a request. Reported both; the histogram is included so the reading can be
re-derived.
**2. Substituted anonymous concurrency for the authenticated probe** when the
session cookie would not resolve, rather than halting at STEP 1a. It is weaker
by one sequential connection and the ceiling did not bind even so. The
authenticated probe remains genuinely un-run.
**3. Did not forge a session row on staging** to get around the cookie. It
would have been a write to a live database outside the STAGING-PARITY intent-
token contract, to manufacture a probe rather than to fix the incident.
**4. Did not change `max`,** including not applying `floor + 2`. The gate fires
on the measured number, and the premise behind the gate is contradicted by
measurement. Both point the same way: this is a decision, not an edit.
**5. Recorded STEP 1c as NOT DETERMINED** rather than resolving it to either
branch. No 500 was produced, so the test never ran.

---

## 10. Open questions

**1. What is the Supavisor `pool_size` actually set to?** Measurement shows 18
concurrent connections sustained without error. If it is not 15, the entire
POOL-1 remedy is sized against a number that is not real. Dashboard read,
Class-3, yours.
**2. Does `BETTER_AUTH_SECRET` match between Doppler `stg` and the Vercel
`staging` environment?** If not, every session cookie the deployment issues is
unverifiable against the Doppler value, and it would explain §2.1 exactly. Same
drift class as the three Sentry vars.
**3. Was the original `EMAXCONNSESSION` a cold-path artefact?** The 35 s
discovery render holds connections for the whole window. Two warm instances
during a signed-in walkthrough, each holding several for 35 s, is a far more
plausible exhaustion shape than steady-state traffic — and it would explain why
sustained concurrency at 30 cannot reproduce it.
**4. Is the server-side Sentry SDK delivering at all?** Still unanswered, and
still requires a deploy. Yours.

## 11. Next session starts at

Answer OQ 1 (pooler `pool_size`, dashboard). Everything downstream — whether a
safe `max` exists, whether transaction mode is needed, whether there is an
incident at all — is gated on that one number.
