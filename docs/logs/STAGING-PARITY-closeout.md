# STAGING-PARITY — close-out (D.5)

**Status: CLOSED.** Slices A, B, C+D shipped; D.4's walkthrough ran; this
records its outcome. Promotes `STAGING-PARITY-closeout-draft.md`, which was the
holding document for rulings made before the walkthrough reported.

**The headline.** The fixture set did what it was built to do, and then did
something it was not built to do: it surfaced two application defects that the
old staging could not have exposed. **6 of the 10 walkthrough routes failed.**
Neither failure is a fixture defect. See §6.

Merged: PR #298 (A), #300 (B), #301 (C+D), #302 (AGENTS drift). ADR-0035,
ADR-0036.

---

## 1 · The six gates — green from a cold rebuild, twice

| Gate | Verdict | Note |
|---|---|---|
| **1 · event parity** (G1.1–G1.6) | **GREEN** | G1.6 new at v1.3 C2; negative-control verified |
| **2 · conservation** (G2.1–G2.4) | **GREEN** | iterated over all 15 markets; caught NC-3 as a bonus |
| **3 · durable receipt integrity** (G3.1, G3.1b, G3.2) | **GREEN** | renamed at v1.3 C1 — it reads `bet_receipts`, not the event log |
| **4 · coverage** (G4.1–G4.3) | **GREEN** | 48 entries · 46 reachable each probed · 2 unreachable each naming a §3 reason |
| **5 · magnitudes** (G5.1–G5.7) | **GREEN** | six named carriers, two reassigned — §5 decisions 1–3 |
| **6 · zero-share** (G6.1–G6.3) | **GREEN** | G6.3 finally discriminating: a position at 0 while `bets` has none |

**Reproducibility, and why it is now an assertion rather than a hand-check.**
Two cold rebuilds produced `docs/polish/staging-coverage.json` **byte-identical**
— `diff` empty, md5 `2b6b0bc408acf425df16937ca270e7aa`, 188 lines. Because the
artifact is committed, gate 4 compares against it and **fails RED on drift**, so
constraint 3's re-runnability is verified on every rebuild instead of once by
hand. Demonstrated live during the review pass: probe changes drift-failed the
gate before the new artifact was committed.

**Counts on staging after the cold rebuild:**

```
users=10 markets=15 pools=14 bets=43 comments=43 positions=24
events=165 dharma_ledger=66 resolution_events=2 payout_events=3 bet_receipts=45
engine writes=760, zero attributed to tests/
```

**Zero `src/` changes. Zero migrations. Zero DDL** across the whole task —
verified by `git diff --name-only da021f9..HEAD -- src/ drizzle/` returning
empty.

---

## 2 · The fixture set

Fifteen markets **M1–M8 + M10–M16**, fourteen opened. **M9 is deliberately
vacant** — that label means the Frozen market, permanently unreachable per
manifest §1.8/§3, so the slot is left empty with a comment rather than reused.
Ten Open markets at rest, against `DISCOVERY_GRID_SIZE + 1 = 9` required. Ten
participants. The literal table (no RNG) is `tests/staging/fixtures.ts`; the
per-slice derivations are in `STAGING-PARITY-B.md` and `STAGING-PARITY-CD.md`.

Every row is written **by the real engine** — `createOAuthUser`,
`acceptTosAction`, `createMarket`, `openMarket`, `place`, `sell`, `closeMarket`,
`triggerResolution`, `settleMarket`, `voidMarket`, `moderateComment`,
`addBookmarkAction`, and the R2 image chain. The generator writes nothing itself,
which `tests/unit/staging/generator-no-direct-writes.test.ts` pins textually
against an import allowlist.

### 2.1 Data-blocked and unreachable — with the reason for each

| State | Status and reason |
|---|---|
| **Frozen market (M9)** | Permanently unreachable. Never minted; `frozen_at` still NULL |
| **X4 · audit-feed pagination** | Product gap. Needs a POLISH.8 ruling |
| **Empty Discovery** | Mutually exclusive with 10 Open markets. Inspect on a preview DB |
| **Turnstile states** | Unwired. Pending AUTH-TURNSTILE-WIRE |
| **Cron-driven transitions** | Driven by admin actions instead, as designed |
| **Graph x-domain** | Hard-pinned Sep 15 → Nov 5 2026. **Pre-recorded as PD-0-18** |
| **Real ToS / Privacy bodies** | Lorem-ipsum pending LEGAL.1 |

---

## 3 · V-1 … V-5

**Canonical text, pasted in at SYNC-1 (2026-08-08).** These were carried here
by number only, because the register lived in `STAGING-PARITY_operating-plan_v1_0.md`
— web-side, not on `main`. **D.4 (2026-08-07) ruled the renumber out of L-space
and the ruling landed as a routing sentence; the renumbering never executed.**
SYNC-1 executes it. **The canonical home of V-1…V-5 is now
`docs/polish/POLISH-0_data-manifest.md` §5**, on `main`; the text below is a
copy for this log's evidence table, and §5 wins on any divergence.

| ID | Canonical text | Evidence this task produced |
|---|---|---|
| **V-1** | A test that reassembles a lookalike proves nothing about the shipped one | — |
| **V-2** | A negative assertion needs a positive control — `not.toMatch` passes when its pattern matches nothing, and "matches nothing" is exactly what a rename or a reformat produces | — |
| **V-3** | Asserting that a call exists is not asserting what it does. Used by the founder at POOL-2 close as **the lookalike class**: a control that reports success while asserting nothing | Three independent defects in the Sentry routing smoke item, each alone sufficient to make it a lookalike — `docs/parked.md`, POOL-2 row |
| **V-4** | A source match is the weak form: it reads text ABOUT a file, and it false-alarms on correct code | — |
| **V-5** | Negative controls must SPAN failure classes, not accumulate within one | The V-5 block below — three magnitude-corruption controls, all green, none able to reach a scoping error |

**Routing — three registers, three namespaces.** **V-space** is the
*verification* lessons and lives in `docs/polish/POLISH-0_data-manifest.md` §5.
**L-space belongs to `docs/polish/POLISH-register-ADDITIONS.md`** — the
PRIMITIVES-1 Gate C reviewer LOWs — not here. **Task-scoped
`@security-auditor` LOWs are a third space** and must carry their task name
(`F-DEBATE-4 L-2`, `SA-L-1`), never a bare `L-n`. The one verification lesson
this task minted is **V-5** (below); it was carried as "L-8" until the
SYNC-1 renumber.

> **V-5 · Negative controls must SPAN failure classes, not accumulate within
> one.** Successor to V-1 and V-2. Three controls were run against the new
> gates and all three passed — but all three were **magnitude corruptions**, so
> the set was three samples of one failure class wearing three gate names, and
> none could have caught a scoping error. `@code-reviewer` found exactly that in
> four gate-4 probes (HIGH-1) *after* all three reported green. The controls
> were not weak individually; the **set** was, and its weakness was invisible
> from inside it.

---

## 4 · The walkthrough outcome — and the ruling

**6 of 10 routes failed.** Diagnosed, in `docs/logs/POOL-1.md`, as POOL-1 (the
connection ceiling) and PERF-1 (the 35-second discovery render) — which §6 of
that log establishes are **one defect seen from two angles**, not two.

**RULED: both are application defects that the fixture set SURFACED. Neither is
a fixture defect.**

**Why the ruling is not a courtesy.** The old staging could not have exposed
either one. A 35-second discovery page **requires eight markets with real
content to exist at all** — `listOpenMarkets` issues 1 + 3N queries and
`DiscoveryContent` a further 2N, so the cost is a function of how many markets
carry real pricing, totals, media, price series and hero posts. Against the
previous fixture state — 39 hand-inserted `bets` rows, 2 `bet.placed` events, 37
orphans, `share_quantity = '0'` on 37 of 39 — the page had nothing to iterate
and the profile surface threw before it could be timed. **The defect was always
there; nothing could reach it.**

The same holds for the ceiling. Exhaustion is duration-driven (§5 of
`POOL-1.md`), and duration required content. A fixture set that produced a fast,
empty app would have passed the walkthrough and shipped the defect to production
— where load is higher and the walkthrough is real users.

**This is the fixture set's most valuable output, and it arrived as a failure.**

---

## 5 · Class-1 decisions across A, B and C+D

Each was made without a ruling, is reversible, and is recorded with what it
changed and how it was proven. Full text in the slice logs; this is the register.

### Slice A

**1 · `watch: false` on `vitest.staging.config.ts`.** ADR-0035 Addendum A.1
defended the watch-mode hazard with an env var; decided to settle it in the
config instead, because **an env-var defence decays by use** — an operator
running dozens of cycles exports the token once to stop retyping it, and watch
mode returns. A config key does not decay. Mutation-verified: remove → RED (1);
restore → GREEN.

**2 · A behavioural assertion on what `runGuardedReset` SENDS.** Nothing
asserted it — only a source match. Added a `Proxy` spy over `testClient`
recording every `unsafe()` payload, asserting one round-trip and a payload equal
to `buildResetBatch(TRUNCATE_SET)` character for character. Mutation-verified
three ways, including **QK-c**, where correct code reformatted across lines made
the source match fire a **false alarm** while the spy stayed green.

**3 · The overnight-sweep calls** — four blind-control fixes, two absent G-4
sub-checks, and the QI-5c comment correction, which was deliberately **not**
turned into a test because the mutation proved the claimed defect does not
exist. Recorded in the mutation audit.

### Slice B

**4 · M9 is never minted.** M1–M8 + M10–M16 satisfies the kickoff's count and
the plan's convention at once, rather than reusing a label meaning "Frozen".

**5 · M4 carries no post.** Manifest §2.1 defines M4 as zero-posts (the
`EmptySideCTA` fixture) against a kickoff saying one post per open market —
**manifest outranks kickoff** by source-of-truth precedence. Asserted explicitly.

**6 · P-owner's M7 bet is 1000 Đ and runs FIRST.** A magnitude not placed here
can never be placed later, because M7 terminates in this slice.
`accrueDailyCredit` fires inside `place()`, so the 1000 Đ stake fits only while
the opening credit is unspent.

**7 · The three captured identities map to P-owner, P-visitor-target,
P-empty** — all three carry the `users_email_idx` collision hazard; the roles an
operator most wants to sign in as.

**8 · Lifecycle terminals folded into Slice B**, close instant derived from the
fixture table. `now` is an **argument** by design (D-14.e); every `created_at`
derives from a freshly minted UUIDv7. **This is not backdating** — P-10 intact.

**9 · Market media rows are shape-valid but back no R2 object.**

### Slices C + D

**10 · Gate 5's G5.5 carrier was counterfactual in the plan, and is
reassigned.** The plan named P-owner's M7 position "marked to market";
`getHeaderPortfolio` **excludes** any market with a `payout_events` row for the
viewer, and M7 settles in this run, so that carrier contributes **exactly zero**.
Reassigned to the OPEN M2 YES holding funded by the M7 payout — which is why the
table has an `after-settlement` phase. (The plan's "marked to market" is itself
contrary to SPEC.1 §10.8.)

**11 · G5.6 is unreachable with a lone winning stake; the fix is the entry
price, not the seed.** A CPMM buy of `S` at a fair price yields under `2S`
shares, so the gain is under `S` — seed 5000 → 833.33; seed 100000 → 990.10; the
ceiling is approached, never crossed. M7 gains a 900 Đ NO post placed **first**,
moving YES to ~0.47 so 1000 Đ buys 2126.89 shares. **netPL = 1125.03.** An
opposing bet arriving before yours is the ordinary case.

**12 · G5.2's carrier is P-exited, at 1009.999999999999999999** — a fee-less
CPMM round trip on a market carrying no other bet. Exact by construction.

**13 · M2's `seedAmount` raised 500 → 5000.** Forced, not chosen: against a 500
seed a four-digit Đb cannot be represented at all.

**14 · The fixture table gains three PHASES**, because two writes are illegal
before an earlier step commits — `after-flip` (`sell` must unwind before `place`
or `OppositeSideHeldError`) and `after-settlement` (the funding Dharma does not
exist before M7 settles). The generator asserts each phase non-empty.

**15 · The import allowlist is widened twice, both operator-ruled** — the C7
storage chain and gate 5's four shipped readers.

---

## 6 · Pre-recorded superseded rows

Two rows are pre-recorded `superseded` so POLISH.5 does not spend a founder
review-hour re-deriving known-correct behaviour:

- **PD-0-17** — header Balance and the composer differ by `DAILY_CREDIT_DHARMA`
  on an unclaimed day. Cites the SHELL-COMPLETE close-out.
- **PD-0-18** — the profile graph renders empty for all generated data. **The
  domain, not missing rows** — §23 hard-pins Sep 15 → Nov 5 2026.

---

## 7 · What POLISH.1–.8 inherits

**1 · The coverage URL list.** `docs/polish/staging-coverage.json` — 48
entries, 46 reachable each with its SQL probe, 2 unreachable each naming a §3
reason. **This is the artifact eight POLISH surfaces navigate from.** It is
committed and gate 4 fails RED on drift, so it stays true or the rebuild says so.

**2 · The local proving loop's setup cost** — two things Slice B's loop did not
need:

- **R2 credentials**, because C7 performs a real presigned `PUT`. A local run
  without them fails at the image step, not at the database.
- **a loopback `DATABASE_URL` override**, because `doppler run --config stg`
  points `DATABASE_URL` at *staging*, and local mode refuses a non-loopback host
  (fail-closed, correctly).

```
doppler run --project zugzwang-experiment --config stg -- env \
  DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres \
  ZUGZWANG_STAGING_TARGET=local \
  ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures \
  pnpm vitest run --config vitest.staging.config.ts tests/staging/<runner>
```

⚠ It also needs a **serially seeded** local `identity_pool` for pseudonyms to
match staging — see the `docs/parked.md` row on the missing FIFO tiebreak.
`pnpm seed:identity-pool:dev` does **not** work (it imports the `@/db` →
`server-only` chain and throws under `tsx`); the 200 tuples have to be inserted
one statement at a time.

**3 · Gate 5's carrier pinning.** Six named carriers, two of them reassigned
(§5 decisions 10–12). **A POLISH task that changes a magnitude on M2, M7 or
P-exited breaks gate 5**, and the reason will not be obvious from the diff — the
carriers are load-bearing fixture choices, not incidental values. The reassigned
two are the dangerous ones, because the plan's original text still names the
counterfactual carrier.

**4 · Two accepted deviations, both recorded rather than silently carried.**
Gate 5's SQL/shipped-reader split (reading through the shipped reader proves the
*surface renders the figure*, which is what the gate is for) and
`staging-coverage.json` being committed against plan Q4 (whose rationale —
UUIDv7 ids and timestamps — does not apply, because the artifact carries
neither).

---

## 8 · Handoff

**POLISH.1 is next, with PERF-1 sequenced above it.**

PERF-1 is a **go-live blocker** (docketed in `docs/parked.md`, 38 days out) and
it sits above POLISH.1 because POLISH inspects surfaces through a browser: a
35-second discovery render makes visual inspection of the front page impractical
and makes any timing observation meaningless. Fixing duration also stops the
connection ceiling binding, so POOL-1 needs no separate remedy — it closes as
**DIAGNOSED, NOT FIXED**, and the fix is PERF-1's.

Also open and not blocking: the transaction-mode ADR (parked, less urgent now
that churn is falsified), the `BETTER_AUTH_SECRET` drift check (**must precede
DP.2's prod promote**), and the three Sentry smoke defects.
