# STAGING-PARITY — Slices C + D session log

> **Task:** STAGING-PARITY Slices C + D — content, calibration, the remaining
> gates, and close. Combined because both risk probes returned YES at Slice B.
> **Date:** 2026-08-06 IST. **Branch:** `slice/staging-parity-cd`.
> **Governed by:** `docs/polish/POLISH-0_data-manifest.md` **v1.3** ·
> `docs/plans/STAGING-PARITY.md` + its Ratification Record · ADR-0035 ·
> ADR-0036 · `STAGING-PARITY_operating-plan_v1_0.md`.

**Headline.** Staging carries the complete manifest §2 fixture set, produced
entirely by the real engine. **All six gates are green from a cold rebuild,
twice with the final artifacts**, and the coverage list is **byte-identical**
across the two runs (md5 `2b6b0bc408acf425df16937ca270e7aa`) — a property gate 4
now ASSERTS rather than one I diffed by hand. Gates 4 and 5, G1.6, G1.7 and G6.3
replaced the last four scaffolds; each new control was proved to DETECT before
it was trusted.

---

## What landed

| Commit | Scope |
|---|---|
| `7219c4a` | Manifest **v1.3** (C1 gate-3 rename, C2 G1.6) + the `bet_receipts` derivability docket row in `docs/parked.md` |
| `c8ddf11` | `@code-reviewer` findings — 2 HIGH + 5 MEDIUM + 6 LOW, all fixed in-session |

⚠ **PROVENANCE OF MANIFEST v1.3 — relayed, NOT CC-authored** (`@code-reviewer`,
HIGH-2). The manifest header reads *"web-authored"*, and Ratification Record §8
lists manifest amendments as web-owned. v1.3's C2 **mints G1.6**, which commit
`d9c718e` then implements — so if CC had authored that text, the gate would have
authorised its own acceptance bar, a circularity of exactly the family this task
exists to remove. It did not: **all three edits are the Slice C/D kickoff's
verbatim text**, applied in place under its own instruction ("This is a web
ruling"), as is the `docs/parked.md` docket row. Verified the way Slice B
verified v1.2 — by marker-grep on the distinctive phrases (*"Seventh instance of
a document describing a control…"*, *"Correcting C1 alone would silently shrink
the exit bar"*, *"NOT event-log state reconstruction"*, *"Existence is G1.1;
agreement is G1.6"*, *"fully derivable from `events` + `pools`"*, each present
exactly once), plus line count **188** and `md5 ab1c65a4`. CC wrote no
amendment text and no acceptance criterion.
| `d9c718e` | The §2 fixture set: §2.3 C1–C11, §2.4 Q1–Q5 + B1–B2, §2.5 X1–X3, the gate-5 carriers · gates 4 and 5 · G1.6 · G6.3 · `_lib/coverage.ts` · `tests/unit/staging/fixture-table.test.ts` · `pnpm staging:rebuild` |
| *(this commit)* | The coverage list captured into `POLISH-register.md`, PD-0-17/PD-0-18 pre-recorded as `superseded`, and `docs/polish/staging-coverage.json` |

**Zero `src/` changes. Zero migrations. Zero DDL.** Verified by
`git diff --name-only da021f9..HEAD -- src/ drizzle/` returning empty.

**Counts on staging after the cold rebuild:**

```
users=10 markets=15 pools=14 bets=43 comments=43 positions=24
events=165 dharma_ledger=66 resolution_events=2 payout_events=3 bet_receipts=45
engine writes=760, zero attributed to tests/
```

---

## Decisions taken on your behalf

Class-1 under the operating plan — decided and recorded rather than halted on.

**1 · Gate 5's G5.5 carrier was counterfactual in the plan, and is reassigned.**
The plan and the kickoff both name *"P-owner's M7 YES position, marked to
market"*. `getHeaderPortfolio` **EXCLUDES** any market carrying a
`payout_events` row for the viewer (`header-portfolio.ts:49–60`) — a settled
position's value has already landed in the ledger, so counting it again would
double-count it against Balance. M7 settles in this very run, so that carrier
contributes **exactly zero**. This is the same class of error W-D caught on
G5.1/G5.2, one criterion further down. The carrier is now P-owner's **OPEN M2
YES holding**, funded by the M7 payout — which is why the fixture table has an
`after-settlement` phase at all. (The kickoff's phrase "marked to market" is
itself contrary to SPEC.1 §10.8, which rejects mark-to-market as a display
basis; Đb is `computeSell(quantity).proceeds`, impact-inclusive.)

**2 · G5.6 is unreachable with a lone winning stake, and the fix is the entry
price, not the seed.** The §23 tile is `netProfitLoss` = *(wallet + Σ Đb over
OPEN holdings) − Σ issuance* — **lifetime**, not per-market realised. A CPMM buy
of `S` at a fair price yields strictly under `2S` shares, so the gain is
strictly under `S`; with `S = 1000` the tile can never reach four digits no
matter how generous the seed. Measured: seed 5000 → 833.33 gain; seed 100000 →
990.10. The ceiling is approached, never crossed. So M7 gains a **900 Đ NO post
placed FIRST** (`M7-P1`, P-crowd-1), moving YES to ~0.47 so P-owner's 1000 Đ
buys 2126.89 shares instead of 1833.33. **Result: netPL = 1125.03.** Nothing
about this is contrived for the gate — an opposing bet arriving before yours is
the ordinary case, and the only one in which a winning position is worth
anything.

**3 · G5.2's carrier is P-exited, at 1009.999999999999999999.** The kickoff asks
for *"a participant that ACTUALLY BETS (1010 on day one)"*. P-exited buys 30 Đ on
M12 and sells the position out in full; **M12 carries no other bet**, so the
fee-less CPMM round trip returns the stake and it rests one unit-in-the-18th-place
under 1010. Exact by construction, not by luck.

**4 · M2's `seedAmount` is raised 500 → 5000.** Forced, not chosen. M2 carries
~3420 Đ of flow once §2.3 lands; against a 500 seed the price impact is so large
that a four-digit Đb **cannot be represented at all**, and G5.5 would be
unsatisfiable for a reason that is a fixture choice rather than a product fact.
5000 keeps prices in a sane band while still moving them enough for C11.

**5 · The fixture table gains three PHASES, because two writes are illegal
before an earlier step commits.** `after-flip` — P-flipped's NO post; `sell` must
unwind the entire YES holding first or `place` raises `OppositeSideHeldError`.
`after-settlement` — P-owner's 1500 Đ reply; the Dharma funding it does not
EXIST before M7 settles. These are not "later posts"; they are posts that cannot
legally exist yet. The generator asserts each phase is non-empty, so a phase that
silently loses its rows is not a green run.

**6 · The import allowlist is widened twice, both operator-ruled.** The C7 chain
(`storage/sign-upload`, `storage/verify-object`, `storage/r2`) is named verbatim
in the kickoff, and STEP 8b resolved the OQ-1 that had it flagged. Gate 5's four
shipped readers (`dharma/header-balance`, `dharma/header-portfolio`,
`profile/positions`, `profile/tiles`) are all read-only. `@/server/events/insert`
and `@/server/dharma/persist` remain pinned as **not** ratified — the allowlist's
own positive control.

**7 · Gate 5 splits SQL from shipped-reader, deliberately.** Manifest §4 forbids
"unit assertions over hand-built objects". The aggregate criteria (G5.1, G5.3,
G5.4) are raw SQL — a balance is a column, a staked total is a SUM. The derived
criteria (G5.2, G5.5, G5.6) **call the shipped reader against the live
database**, because restating Đb or `netProfitLoss` in SQL would be a second
implementation of the identity being verified — exactly the error gate 2's own
header warns about. Neither shape fabricates an input, which is what the
prohibition is actually about.

**8 · M3 gains a second post and two replies.** It was one post with zero
replies, which renders no badge **because there is nothing to rank**. The
manifest calls M3 "Open, lightly active" and asks it to prove *graceful
degradation* — that needs real activity that still clears no floor. Two posts,
one reply each, every lane value below its floor. Confirmed by the instrument:
`0 badge(s) fired` over a non-empty substrate.

**9 · Slice B's `banned: null` participant assertion is narrowed, not dropped.**
It asserted no participant is banned — correct then, false now that §2.5 X3 bans
one on purpose. It now asserts **only the intended role** is banned. "Nobody is
banned" and "only the right one is" are different claims; the second is the one
worth holding.

**10 · `pnpm staging:rebuild` is three `doppler run` invocations, not one.**
Composing it as `staging:reset && staging:generate && staging:gates` keeps each
runner's own guard contract intact — including the write-intent token the gates
deliberately do **not** require (ADR-0035 Addendum A.1's decay argument).

**11 · One pre-existing unused import removed** (`DirectWriteForbiddenError`,
`generate.staging.test.ts`). It landed unused at Slice B and fired a Biome
warning on every commit touching a file this PR substantially rewrites.

---

## STEP 3 · the C.2 lane calibration record — **ONE pass**

The kickoff's halt bound was three passes. It took one, because the calibration
was **derived from the model before any database was touched** rather than
tuned against output.

**The entanglement that makes this non-obvious.** `BET_MIN_STAKE_REPLY` is 50 and
`floorLane.n` is 5, so **a post clearing the traction floor AUTOMATICALLY clears
the stake floor** (5 × 50 = 250 > 200). The three carriers therefore cannot be
"the biggest of each" — they have to be held apart:

| Post | n | D | n^b | Resolves as |
|---|---|---|---|---|
| M2-P2 | **5** | 280 | 1.495 | **SOLE** clearer of `n ≥ 5` → SENTINEL → **Most Debated** |
| M2-P3 | 3 | **2500** | 1.732 | D-ratio 2500/280 = **8.93** ≥ `kLane` 3 → **Highest Stakes** |
| M2-P4 | 4 | 215 | **4** | **SOLE** clearer of `n^b ≥ 3` → SENTINEL → **Contested** |
| ×9 others | ≤2 | ≤100 | ≤2 | below every floor → **no badge** |

M2-P4 is held at **4** replies — one under the traction floor — precisely so
M2-P2 is the sole traction clearer. M2-P2 is held one-sided at **4:1** so its
`n^b` stays at 1.495, under the contestation floor. Neither is decoration.

**What was measured, and with what.**

**1.** `tests/unit/staging/fixture-table.test.ts` runs the **shipped pure
`badgeFor`** over a substrate built from the fixture table. Green on the first
run. This is the control the instrument cannot be: it proves *the table implies
the badges*, database-free, in CI.

**2.** `scripts/verify-ranking-staging.ts sp-m2-active` against **real staging
rows after the rebuild** — the instrument STEP 8a preserved. Verbatim:

```
[aggregates] 12 post(s) — the four per-side signals:
  … side=YES  support=4/Đ230  counter=1/Đ50   a=Đ40
  … side=NO   support=2/Đ1000 counter=1/Đ1500 a=Đ35
  … side=YES  support=2/Đ110  counter=2/Đ105  a=Đ30

[Top order + latest interleave + lane-dominance badge]
  1. … side=YES  badge=Most Debated
  2. … side=NO   badge=Highest Stakes
  3. … side=YES  badge=Contested
  4.–12. badge=—

✓ 12 post(s)' four aggregates computed live, Top order produced, 3 badge(s) fired.
```

**3.** `verify-ranking-staging.ts sp-m3-light` — the ceiling constraint:
`2 post(s) … 0 badge(s) fired`, over a substrate with real replies.

`ranking.config.ts` was **not touched**. Those constants are ratified and pin at
2026-09-01; the fixture table moved instead, which is the correct direction.

---

## STEP 4d · negative controls — every new gate proved it DETECTS

Run against local Postgres holding a byte-identical generated set. A gate that
has only ever passed is unproven.

| # | Defect injected | Verdict | On revert |
|---|---|---|---|
| **NC-1** | one `bet.placed` payload's `stake` set to a wrong value | **G1.6 RED — and G1.6 ALONE.** G1.1 stayed green | **GREEN** |
| **NC-2** | `sp-m5-closed` flipped to `status = 'Open'` | **Gate 4 RED**, naming the row: `M5: probe found no row`. G1.4's per-status carrier also fired | **GREEN** |
| **NC-3** | P-owner's M2 `positions.quantity` shrunk to 1 | **G5.5 RED** (1508.49 → 0.57) and **G5.6 RED** (1125.03 → −382.89). Gate 2's conservation check also fired | **GREEN** |

⚠ **NC-1 is the one that matters most.** It is the empirical justification for
manifest v1.3 C2: a corrupted payload that co-exists with its row satisfies
G1.1 completely. Correcting gate 3's wording (C1) without adding G1.6 would have
silently shrunk the exit bar, and NC-1 is the measurement that says so rather
than the argument.

All three reverted cleanly to **23/23 green** with figures identical to 18
decimal places.

---

## The six gates — verdicts from the cold rebuild

| Gate | Verdict | Note |
|---|---|---|
| **1 · event parity** (G1.1–G1.6) | **GREEN** | G1.6 new at v1.3 C2; negative-control verified |
| **2 · conservation** (G2.1–G2.4) | **GREEN** | iterated over all 15 markets; caught NC-3 as a bonus |
| **3 · durable receipt integrity** (G3.1, G3.1b, G3.2) | **GREEN** | renamed at v1.3 C1 — it reads `bet_receipts`, not the event log |
| **4 · coverage** (G4.1–G4.3) | **GREEN** | 48 entries · 46 reachable each probed · 2 unreachable each naming a §3 reason |
| **5 · magnitudes** (G5.1–G5.7) | **GREEN** | six named carriers, two of them reassigned — see decisions 1–3 |
| **6 · zero-share** (G6.1–G6.3) | **GREEN** | G6.3 finally discriminating: a position at 0 while `bets` has none |

**Gate 5's figures, verbatim, and identical across every run (local proving, the
first staging rebuild, and the cold rebuild):**

```
G5.1 header balance   (P-empty)  = 1000.000000000000000000   ← EXACTLY 1000
G5.2 composer spendable (P-exited) = 1009.999999999999999999
G5.3 positions staked (P-owner/M7) = 1000.000000000000000000
G5.4 discovery staked total (M2)   = 3420.000000000000000000
G5.5 header portfolio (P-owner)    = 1508.488877872174201787
G5.6 profile tiles netPL (P-owner) = 1125.026094700653166188
G5.7 live bets: max_stake=1500, four_digit_stakes=2
```

---

## STEP 5 · D.3 — the cold rebuild, and reproducibility

**Four** full `pnpm staging:rebuild` runs in total — two before the reviewer
pass and two after it, each pair a cold reset → re-seed → generate → gates. The
pair that counts is the **final** one, run against the artifacts that actually
ship. **Reproducibility confirmed, three ways:**

- **The coverage list is byte-identical** — `diff` empty, same md5
  `2b6b0bc408acf425df16937ca270e7aa`, 493 lines. ⚠ This is no longer a claim I
  verified by hand: gate 4 now compares the emitted list against the committed
  one and **fails RED on drift**, so the final rebuild's green IS the assertion.
  (Demonstrated live in the intervening run: the reviewer fixes changed the probe
  SQL, and the rebuild drift-failed with *"every id and URL is UNCHANGED — the
  difference is in probe SQL"* before the new artifact was committed.)
- **Pseudonyms identical** and unchanged from Slice B — `RedFox000` P-owner ·
  `RedWolf001` P-visitor-target · `RedOtter002` P-empty · `RedBadger003`
  P-flipped · `RedLynx004` P-exited · `RedHare005` P-removed · `RedOwl006`
  P-banned · `RedHawk007`/`RedStoat008`/`RedPine009` P-crowd. The reset truncates
  and re-seeds `identity_pool`, restoring the FIFO consume order.
- **Every row count and every gate-5 figure identical to 18 decimal places.**

**The coverage list lives in two places:**

- `docs/polish/staging-coverage.json` — machine-readable, emitted per run by
  gate 4, carrying the SQL probe behind every row. **48 entries.**
- `docs/polish/POLISH-register.md` → *"Staging fixture coverage — the standing
  reference"* — the human table, one line per §2 row with the URL and what to
  look at.

---

## Data-blocked / unreachable — unchanged from manifest §3

| State | Status |
|---|---|
| **Frozen market (M9)** | Permanently unreachable. Never minted; `frozen_at` still NULL |
| **X4 · audit-feed pagination** | Product gap. Needs a POLISH.8 ruling |
| **Empty Discovery** | Mutually exclusive with 10 Open markets. Inspect on a preview DB |
| **Turnstile states** | Unwired. Pending AUTH-TURNSTILE-WIRE |
| **Cron-driven transitions** | Driven by admin actions instead, as designed |
| **Graph x-domain** | Hard-pinned Sep 15 → Nov 5 2026. **Pre-recorded as PD-0-18** |
| **Real ToS / Privacy bodies** | Lorem-ipsum pending LEGAL.1 |

**Pre-recorded so POLISH.5 does not spend a founder review-hour on them
(STEP 5c):** `PD-0-17` (header Balance vs composer differ by
`DAILY_CREDIT_DHARMA` on an unclaimed day — cites the SHELL-COMPLETE close-out)
and `PD-0-18` (the profile graph renders empty for all generated data — the
domain, not missing rows). Both `superseded`.

---

## Surprises caught + fixed in-session

**1 · The plan's G5.5 carrier could never have worked.** Found by reading
`header-portfolio.ts` before writing the gate, not by watching it fail. A gate
written to the plan's letter would have asserted a four-digit figure against a
holding the reader excludes by construction — and the *only* way it could have
passed is if the exclusion were broken. Decision 1.

**2 · G5.6 is bounded by arithmetic, not by the seed.** The plan's remedy
("M7 opened with a deliberately generous `seedAmount`; `openMarket` has no
ceiling") cannot work: shares from a stake `S` at a fair price are under `2S`, so
the gain is under `S`, and raising the seed only approaches the ceiling. Measured
at two seeds before concluding. Decision 2.

**3 · Slice B's participant assertion was already false against Slice C's data.**
Caught on the first local proving run, which is where a fixture-set change is
supposed to surface it. Decision 9.

**4 · The C7 image chain works end to end on the first attempt** —
`signUploadAndInsert` → presign with `If-None-Match: "*"` → real `PUT` →
`verifyUploadedObject` HeadObject → `place({ image })`, with the
`image_uploads` row reaching `terminal_state = 'committed'` and a positive
verified byte size. STEP 8b's probe was accurate.

**5 · Gate 2 and G1.4 caught NC-2 and NC-3 alongside their intended gates.**
Not designed for; recorded because independent detection of the same corruption
is the property that makes the gate set worth more than its parts.

---

## `@code-reviewer` — findings and what was done

Verdict: **no CRITICAL**. No invariant weakened, no refusal trigger crossed, no
`src/` change, no migration. **Every HIGH and MEDIUM was fixed in-session before
the PR opened**, per §5.11. `@security-auditor` was waived at kickoff ("no
enforcement disabled, no engine code") — honoured, not skipped.

The reviewer independently re-derived two of my claims from source and both
held: `getHeaderPortfolio`'s settled-market exclusion (`:116-125` builds
`settledMarkets`, `:142-144` `continue`s on it), and the CPMM bound
`shares = S·(1 + seed/(seed+S)) < 2S`. It also reproduced M2's 3420 total and
the 2126.89 → 1125 chain from the fixture literals alone.

### HIGH · both real

**H1 — four gate-4 probes were not targeted at the subject whose URL they
certify.** Q1's URL is `/u/RedWolf001` but its probe asked *"does anyone hold an
open position"* — satisfied by P-owner, by any crowd member, by anyone. Q2, Q3
and B1 had the same shape; Q4, Q5 and B2 were correctly scoped, which made the
four look like omissions rather than a design choice. **This is the Slice B
gate-2 carrier defect one layer up** ("proves markets EXISTED, not that any was
CHECKED"), and gate 4 is the artifact eight POLISH surfaces navigate from — a
green gate could hand an inspector a URL that renders an empty profile.
**Fixed:** all four scoped by pseudonym; B1 additionally checks BOTH arms it
claims (a post AND a reply, by the acting viewer, on another's content).
⚠ Worth recording: **none of my three negative controls would have caught this**
— they were all magnitude corruptions, and these probes fail only when a
specific user's row is missing while another's survives.

**H2 — manifest v1.3's provenance was not recorded.** Covered above in *What
landed*. A logging gap, not a substantive one, but the reviewer was right that
"most likely relayed" is not a verification.

### MEDIUM · all five fixed

- **`expectedCoverageIds()` was independent for C/Q/B/X but NOT for markets and
  participants** — it mapped the same arrays `buildCoverage` iterates, so a
  deleted market or participant vanished from both sides and gate 4 reported
  full coverage. Deleting M1 (Draft) left all six gates green. Every id is now a
  literal; the manifest is their source, exactly as the docblock already argued
  for the other sections.
- **G5.3 asserted a proxy.** It summed `bets.stake`; the §23 "Staked" column is
  **Đa — the final SideEpisode's `stakedBasis`**, episode-scoped and reduced by
  partial sells. They coincided only because P-owner has one M7 trade and no
  sell — right by accident, the same class as the G5.5 carrier error. Now reads
  `loadProfilePositions`.
- **G5.7 did not check what G5.7 says.** It asserted a fact about the DATABASE
  (a four-digit stake exists), so rewriting G5.1–G5.6 as fabricated-object
  assertions would have left it green — manifest §5's own *"asserting that a call
  exists is not asserting what it does"*, landing on the one criterion whose job
  is to prevent structural blindness. Now a source tripwire over the gate-5
  block with a positive AND negative control; the live-data half survives as
  **G5.7b** under its true name.
- **Every event carried `flow_id = "F-BET-1"`, replies and sells included.** The
  wire sets it per operation (`place/route.ts:173`, `sell/route.ts:43`).
  Persisted metadata the product would never write, in the task that exists
  because staging carried data the product could not have produced. Now mirrors
  the two route files by reference, and **new gate G1.7** asserts it with a
  carrier per arm so it cannot regress silently.
- **The gates runner overwrote a tracked file unconditionally.** The documented
  local proving loop runs that same file, so a local run rewrote the committed
  staging artifact with `"generatedFor": "local · 127.0.0.1:54322"` and local
  pseudonyms. Now staging-mode only — **and it compares against the committed
  file and fails RED on drift**, which converts the hand-verified "byte-identical
  across two cold rebuilds" into an assertion that runs on every rebuild.

### LOW · six fixed, four recorded

Fixed: G5.6's sign pinned (`.abs() >= 1000` alone stayed green on a four-digit
LOSS, and NC-3 landed at −382.89 — inside that window, so the control never
exercised it) · G5.1/G5.2's labels were crossed, and both figures are now
asserted and named · pseudonyms and slugs shape-checked before interpolation ·
G1.6 gained the `betId` and comment-event pairings · X1/X2 and C3/C5 no longer
share non-discriminating probes · the R2 PUT gained a timeout · the register
footer count.

Recorded, not fixed: the allowlist is module-granular (`storage/r2` grants
`deleteObject` too — inherent to a module allowlist, and R2 is not the DB) ·
`bodyFingerprint` is synthetic (plan §6: the generator is not a replay test) ·
a terminal market briefly carries a future `resolution_deadline` after a rebuild
(self-heals within a minute, nothing persisted falsely).

### Two bugs in my own fixes, caught by the local proving run

**`both` is a reserved word in Postgres** (`trim(both …)`), so B1's new subquery
alias was a syntax error. And **the G5.7 tripwire's block boundary ran past gate
5 into gate 6**, whose bodies reach the database through the `scalar()` helper
and therefore carry no literal handle — three false positives on the assertion's
very first run. The tripwire caught its own author, which is the argument for
having written it.

---

## Deviations recorded, not absorbed

**Plan Q4 says the coverage list is "emitted as a build artifact per run, **not**
committed as a fixed file".** `docs/polish/staging-coverage.json` IS committed.
Surfaced rather than buried, with the reason: Q4's stated rationale is that
"UUIDv7 primary keys and all timestamps" are non-deterministic — and **the
emitted artifact contains neither**. It carries ids, slugs, pseudonyms, probe
SQL and prose, all of which are stable by construction, which is why two cold
rebuilds produced it byte-for-byte. Committing it is what lets gate 4 fail RED
on drift instead of merely reporting a number, and the plan's own DELIVERABLES
§7 asks for it to become "the standing reference". If web prefers Q4's letter,
the fix is one line (gitignore it and drop the comparison) and the register
table survives either way.

**Manifest §4 gate 5's "executed as SQL" is implemented as a split** — see
decision 7. The reviewer examined this specifically and did not ask for it to be
reversed, on the grounds that restating Đb or `netProfitLoss` in SQL would
satisfy gate 5's letter by violating gate 2's *"do not re-derive the identity"*.
Recorded because it is an interpretation of a ratified document, and unlike the
gate-3 correction it was **not** routed into a manifest amendment.

---

## Open questions

1. **`identity_pool` FIFO has no tiebreak.** `consume.ts:26–32` orders by
   `created_at ASC` alone. The staging seed inserts serially so timestamps are
   distinct and the order is total — but a seed that inserted the 200 tuples in
   ONE statement would give every row the same `now()` and leave the consume
   order to heap order. Not a defect today (the shipped seed is serial, and it
   was verified: 200 rows, 200 distinct `created_at`); recorded because Q4's
   pseudonym-stability claim rests on it.
2. **The F2 message arm has still never rendered** (carried from Slice B).
   Observing it means causing a G-4 failure on a real reset. Still not worth
   manufacturing.
3. **`bet_receipts` derivability is unverified** — now a docket row in
   `docs/parked.md`, owned by DATASET RELEASE, not by STAGING-PARITY.

---

## Next session starts at

**D.4 — the operator walkthrough.** It is the operator's, not CC's. The URL list
is in the report and in `POLISH-register.md`; the exact next action:

> Sign in to `https://staging.zugzwangworld.com` as **RedFox000** (P-owner) and
> walk the eight URLs in the report's order, starting at `/m/sp-m2-active`.
> File nothing that matches **PD-0-17** or **PD-0-18** — both are pre-recorded
> as `superseded`.

Then **D.5 close-out**, and POLISH.1 onward.

## Context to preserve

- **`pnpm staging:rebuild` now exists** — reset → seed → generate → gates, three
  `doppler run` invocations so each runner keeps its own guard contract.
- **The captured-identity file is machine-local** at
  `~/.claude/zz-p-owner-identity.json`, not in the repo, loaded fail-closed
  before any row is written. A rebuild on a machine without it refuses rather
  than fabricating a Google `sub`.
- **The local proving loop** now needs **R2 credentials as well as a local
  database**, because C7 does a real `PUT`:
  `doppler run --project zugzwang-experiment --config stg -- env
  DATABASE_URL=<loopback> ZUGZWANG_STAGING_TARGET=local
  ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures vitest run --config
  vitest.staging.config.ts tests/staging/<runner>`. The loopback override is
  required — doppler `stg` sets `DATABASE_URL` to staging, and local mode
  refuses a non-loopback host (fail-closed, correctly).
- **The local `identity_pool` must be seeded serially** for pseudonyms to match
  staging — see open question 1.
- **Gate-5 carriers, and the figures a fixture change must not move:** P-empty
  exactly 1000 · P-exited ~1010 · P-owner M7 staked 1000 · M2 total 3420 ·
  P-owner portfolio 1508.49 · P-owner netPL 1125.03.
- **The three lane carriers are calibrated, not incidental** — M2-P4 sits at 4
  replies and M2-P2 at 4:1 *on purpose*. `fixture-table.test.ts` fails RED if
  either moves.

## Time

One session, 2026-08-06 IST. STEP 0 through STEP 6 in a single pass.
