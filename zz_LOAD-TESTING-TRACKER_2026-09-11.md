# Zugzwang Load Testing — Master Tracker

**Covers:** 2026-09-01 → 2026-09-11 (11 days)
**Target:** `staging.zugzwangworld.com` (the practice copy — never production)
**Status:** Testing phase **complete**. Fix phase: **2 verified done, 2 written-but-unverified (not deployed), 2 blocked** on decisions/access you hold.

> ⚠️ **Read §6 Fix 1 before treating the sign-in page as solved.** Nothing in this fix phase has been deployed to staging — the whole branch sits unmerged at `load_testing_ultra`, and no fix has been re-measured against the live site.

---

## 1. At a glance

| Area | Status |
|---|---|
| **Load testing itself** | ✅ Complete — every page and every write path tested |
| **Money/Dharma correctness** | ✅ Perfect, zero errors found across the entire programme |
| **Fixes shipped** | ⚠️ 4 written & committed (`49f9e49`) — **none deployed to staging** |
| **Fixes blocked** | ⏸ 2 — one needs your decision, one needs infrastructure access |
| **Site launch-readiness** | ⚠️ Correct but capacity-limited — see §5 |

**The one-sentence summary:** the product's logic has never once produced a wrong answer, under any pressure tested; what limits the site is capacity and protective rate limits, not correctness.

---

## 2. Timeline — what happened, in order

### Phase 0 — Setup & recon (Sep 1–3)
- Audited existing load-test infrastructure; found no volume-fixture generator existed.
- Built the test rig (k6 on a remote DGX machine), harness, and bounds plan.
- ⚠️ **Incident (Sep 1–2):** a `staging:reset` was run and follow-up fixture generation failed, leaving staging half-populated. A standing "don't touch staging" rule was set at the time. That rule was subsequently and repeatedly lifted by direct instruction from Sep 4 onward, and staging was rebuilt and used deliberately for everything below.

### Phase 1 — First real load (Sep 3–6)
- First genuine load tests run against the live staging app.
- Image-post testing: bulk image posts attached to volume-fixture markets via the real upload chain.
- Batched image-post load tests; full load-test battery assembled.

### Phase 2 — Page-by-page campaign (Sep 7–8)
- **Sign-in page** escalating load: 200 → 3,000 req/s.
- **Homepage** escalating load: 1,000 → 5,000 concurrent.
- **Market pages**: dedicated test market built with 30 real image posts + 500 fresh participants; genuinely concurrent bet burst fired; Dharma independently re-verified from the database.
- Six deeper items executed: real HTTP bet endpoint, IP disambiguation, sell path, signup completion, profile pages, replies, concurrent image uploads.
- Master consolidated Excel report produced.

### Phase 3 — Prioritised fix list (Sep 9)
- All findings ranked by leverage into `zz_PRIORITY-FIX-LIST_2026-09-09.md` (P1 → P5).

### Phase 4 — Execution (Sep 9–11)
- Cache instrumentation built and shipped.
- Test rig's own ceiling measured for the first time — **found the rig was crippling its own results** (see §7).
- Per-market vs global write-limit question tested, then the conclusion **corrected** after a code audit.
- Concurrent image-upload ambiguity **resolved**.
- Photo-weight fix shipped (lazy-load); server-side resize investigated and declined with reasons.
- **Sign-in page collapse root-caused and fixed.**

---

## 3. Complete test inventory

| # | Test | Load | Result |
|---|---|---|---|
| 1 | Sign-in page | 200 req/s | **>98% failure** — worst page found. Fix written, **not yet deployed or verified** — see §5 P2.1 |
| 2 | Sign-in page | up to 3,000 req/s | Same failure rate; never showed a "still working" level. Same fix, same unverified status |
| 3 | Homepage | 1,000 → 5,000 concurrent | ~8% success at 5,000. **Partly addressed in-branch** — 8 sequential DB round-trips per render collapsed to 1; see §6 Fix 5 |
| 4 | Market page load | Crowd arrival, 30 image posts | Degrades with photo count — but **the server side is already optimal**; measured, see §6 Fix 6 |
| 5 | **Concurrent bets + Dharma** | 500 simultaneous on one market | 140 succeeded; **every single Dharma calculation correct** |
| 6 | Real HTTP bet endpoint | Concurrent, real sessions | Works; throttled by rate limit |
| 7 | IP disambiguation | 200 distinct one-shot identities | 85% throttled; only first ~11 through |
| 8 | Sell (exit a position) | Concurrent | 11/17 (65%) succeeded past the limiter; **no sell-specific bug** |
| 9 | **Concurrent signup** | 150 simultaneous | **150/150 = 100%**, all starting grants correct — best result of the programme |
| 10 | Profile pages | Light (200/s) | **99.48%** — best content page |
| 11 | Profile pages | Heavy | 73.18% — still best-in-class at that load. **Optimised in-branch**: ~10 sequential DB reads → 3 waves; see §6 Fix 7 |
| 12 | Replies under load | 503 attempts | 18 succeeded, 485 hit the limiter; **no reply-specific bug** |
| 13 | Concurrent image uploads | 50 simultaneous | 7/50 → **19/50 after rig fix**; correctness exact every time |
| 14 | **Rig ceiling** (P4.1) | Static asset, no app involvement | Found rig self-limited; see §7 |
| 15 | **Two-market simultaneous burst** (P4.3) | 150 across 2 markets | 8 + 10 succeeded; conclusion later corrected |

---

## 4. What is confirmed solid — do not spend time here

- **Money math and Dharma accounting.** Checked independently against the database under the heaviest pressure tested (500 simultaneous bets, 150 simultaneous signups). **Zero mistakes, anywhere, across the entire programme.** Every debit exactly once, every amount exact, every resulting balance exact, total conservation exact.
- **Account signup under concurrency.** 100% success at 150 simultaneous. The standout result.
- **Profile pages.** Best-performing content page under load.
- **Sell and reply paths.** Both correct whenever they get past the shared rate limit. No path-specific bugs.
- **Write-contention safety.** `BetSerializationExhaustedError` is the database correctly refusing to risk wrong math under extreme contention — a working safety feature, not a bug.

---

## 5. Priority fix list — live status

| ID | Item | Status |
|---|---|---|
| **P1** | Database connection bottleneck (root cause) | ⏸ **Blocked** — needs infrastructure access you hold |
| **P2.1** | Sign-in page collapse | ⚠️ **Fix written, NOT deployed, NOT verified** — see §6 Fix 1 |
| **P2.2** | Write-limit tuning | ⏸ **Blocked** — needs your decision; premise corrected (see §7) |
| **P3.1** | Photo weight | ✅ **FIXED** (lazy-load); resize declined with reasons |
| **P3.2** | Homepage/market degradation | ⚠️ **Partly fixed in-branch** (round-trip batching, §6 Fix 5); the rest still waits on P1 |
| **P4.1** | Rig ceiling never measured | ✅ **DONE** — and it found a real problem |
| **P4.2** | No cache hit/miss visibility | ✅ **DONE** — instrumentation shipped |
| **P4.3** | Is the write-limit per-market? | ✅ **ANSWERED** — it's per-IP, not per-market (§7) |
| **P4.4** | Image-upload result untrustworthy | ✅ **RESOLVED** — was the rig, now proven |
| **P5** | 24-hour soak test | ⏸ Deliberately last — run only after P1 lands |

---

## 6. Code shipped (all committed in `49f9e49`, branch `load_testing_ultra`)

### Fix 1 — Sign-in page (P2.1) ⚠️ written, not deployed, not verified

> **Status correction, 2026-09-12.** This entry previously read "biggest win / FIXED". Three things were wrong with that and are corrected here:
> 1. **It is not deployed.** Staging runs `6f34563`; this fix is on `load_testing_ultra` and has never shipped. Nobody has loaded the page with it active.
> 2. **It has never been re-measured under load.** The "fixed" claim rested on reasoning and unit tests, not on a repeat of the test that found the problem.
> 3. **It is probably not the sole cause.** Benchmarked directly (2026-09-12): the work this fix removes costs **1.367 ms per render** (`buildFieldScene` 1.349 ms; inner ring 0.015 ms; outer ring 0.004 ms). At 200 concurrent arrivals that is ~273 ms of blocking CPU in total — real, and worth removing, and plausibly 3–5× that on Vercel's slower per-core CPU — but it does not by itself account for a **98%** failure rate. One instance is CPU-saturated by this alone only around ~700 req/s. **P1 (the database connection bottleneck) is very likely still the dominant factor**, which is consistent with every other page failing the same way with no art layer involved.

**What the fix does:** the decorative background art layer (two rotating rings + ~460 static shapes) recalculated the position of every single shape **from scratch on every page request** — despite the layout never varying. Unlike every other page, whose cost is *waiting* on the database (which frees the server to serve others), this is *computation*, which the server can only do one at a time.

**Fix:** calculate once, reuse for every visitor.
- `src/components/art/warli/field-layer.tsx` — static field hoisted to a one-time constant
- `src/components/art/warli/ring.tsx` — ring geometry cache, keyed on the values the math actually depends on and **deliberately never on the ring's name**, so a name collision can't serve stale geometry
- `tests/unit/art/ring-memo.test.tsx` — new test proving exactly that

**Zero UI change** — output is byte-identical, animation still spins live in the browser. **Zero auth code touched.**

### Fix 2 — Cache visibility (P4.2)
- `src/server/observability/cache-metrics.ts` (new) — 4 fail-open counters
- Wired into 7 files (discovery, debate view, market open/close, moderation)
- `tests/unit/observability/cache-metrics.test.ts` — 7 tests

### Fix 3 — Image lazy-loading (P3.1)
- `MarketThumb.tsx`, `CommentImage.tsx` — off-screen images no longer fetched until scrolled near

### Fix 4 — Test rig unblocked (P4.1)
- DGX file-descriptor limit raised 1,024 → 65,536 (**2.7× throughput**)

### Fix 5 — Homepage round-trip batching (T-03 / P3.2) — added 2026-09-12

The homepage's live pricing read was issued **once per market, sequentially awaited**. With 8 open markets that is **8 database round-trips in series** before the page can render — and that read is deliberately never cached (it *is* the live price), so every visitor paid all 8, every time.

`getMarketPricingAndReservesBatch` reads every pool in one `IN (…)` query. Round-trip budget: **1 + 11N → 2 + 10N** (the per-market pricing term became a constant).

⚠️ **Deliberately a batch, not a `Promise.all`.** Parallelising the per-market read would have fixed the same latency while making the **open connection bottleneck worse** — 8 concurrent reads per visitor against a pool capped at 4 per instance, at exactly the moment P1 is the thing hurting. The batch takes one connection, once, and does strictly less total work than before.

Files: `src/server/debate-view/market-pricing.ts` (new batch fn), `src/app/(public)/page.tsx` (call site). Three guards updated to the new shape — the round-trip budget pin, the R3 cache-boundary scan, and the reserves-server-only scan. The property each protects is unchanged; only the shape they match moved.

**Not a claim that T-03 is solved.** This removes a real, measured cost that no longer scales with market count. Whether it moves the 8%-at-5,000 figure is unmeasured, and P1 is still the dominant factor.

### Fix 6 — Market page with many photos (T-04) — investigated 2026-09-12, **no change needed**

Investigated for an in-branch server fix. **There isn't one to make, and that is a measured result rather than a shrug.** Three things were checked:

**1. The read does not scale with post count.** The cached debate-view block costs **12 statements on a cold miss — flat**, whether the market carries 1 post or 30. There is no N+1 hiding here.

**2. Image URLs are already batched and parallel.** `mintImageUrls` takes one `IN (…)` query for every attachment, then mints URLs concurrently, degrading to no-image per object on failure rather than failing the page.

**3. The URL memo is doing essentially all of the work.** Measured on the real `signRead` path, 30 images:

| | Time |
|---|---|
| Cold (first render in a process) | **19.45 ms** |
| Warm (every subsequent render) | **0.04 ms** |
| Warm again (steady state) | 0.02 ms |

The memo removes ~100% of the cost. For comparison, the sign-in art layer I *did* fix cost 1.367 ms — so the warm image path is ~30× cheaper than a thing already judged worth fixing. **Optimising this further would be optimising nothing.**

**What genuinely remains for photo-heavy pages, and it is not server CPU:**
- **Bandwidth** — full-resolution images on the wire. Partly addressed by lazy-loading (F-03); fully addressed only by the server-side resize **deliberately declined** (entangles with the ADR-0028 moderation byte-identity guarantee).
- **Cache-miss amplification** — the debate-view cache is keyed on `reserves`, so every bet busts it and an active market re-pays the 19.45 ms cold cost plus 12 statements far more often than it should. That is the `reserves`-key question, not a photo question.

This also retroactively confirms the caching audit's "KEEP — load-bearing" verdict on `read-url-memo.ts`, now with a number behind it instead of an argument.

### Fix 7 — Profile page read parallelisation (T-11) — added 2026-09-12

`loadProfilePositions` issued **~10 database reads strictly one after another**. Seven of them — payouts, markets, pools, the user's bets, sell events, market comments, and lot basis — depend only on `userId` and `marketIdList`, **both settled before any of them ran**, and none consumed another's result. They were sequential by habit, not by data dependency.

Regrouped into **three waves** using `Promise.all`:

| Wave | Reads |
|---|---|
| 1 | payouts · markets · pools |
| 2 | user's bets · sell events |
| 3 | market comments · lot basis |

Everything with a genuine dependency is untouched: `positionRows` still runs first (it produces `marketIdList`), the episode walk still follows the comment read, and `removedSet` still follows the masking candidates.

**Two properties deliberately preserved:**
- **Statement count is unchanged — still 7 `.from()` calls.** Same queries, same predicates; only the *waiting* is shared. Any statement-count budget guard reads exactly as before.
- **`Promise.all`, not start-and-await-individually.** If one read rejects the others are still awaited, so a failure can't leave a pending promise behind as an unhandled rejection. The function throws on a read failure exactly as it did before.

`lotBasis` also moved up from four statements further down — it never depended on the ordinal walk that used to precede it.

⚠️ **Verification gap, stated plainly:** typecheck, lint, production build and 304 DB-free profile tests all pass, but **the profile integration tests need a real Postgres and could not be run here.** This is money-adjacent read code (positions, payouts, lot basis), so those must run before merge. The risk is bounded by the statement count being unchanged, but "bounded" is not "verified."

### Operational scripts (reusable)
`concurrency-setup`, `concurrency-setup-market-b`, `concurrency-burst`, `concurrent-signup-burst`, `concurrent-image-upload-burst`, `mint-bet-sessions` — all under `tests/staging/`.

**Verification on every fix:** typecheck ✅ · lint ✅ · production build ✅ · full unit suite (3,534 passing) ✅ · zero regressions.

---

## 7. Corrections — things found wrong and put right

Recorded deliberately, because each one changes how earlier numbers should be read.

### 7.1 The test rig was crippling its own results
The remote test machine's session allowed only **1,024 simultaneous connections** (of 524,288 available). Every load test run through it — the whole programme — was invisibly capped on the *test* side, with no error shown. Raising it **tripled** throughput against a target doing zero app work.
**Implication:** numbers near the rig's own ceiling understate the site. Re-measure after P1.

### 7.2 A third ceiling exists that nobody was measuring
Past roughly **600–700 req/s from a single machine**, the hosting provider's own anti-abuse protection begins resetting connections. This is *correct behaviour* protecting the real site — but it means every "the site failed at N" figure was really measuring `min(app capacity, rig capacity, edge abuse protection)`, and nothing distinguished them until now.

### 7.3 The "per-market write limit" does not exist
**I reported this wrong, and corrected it.** A two-market simultaneous burst produced a roughly even split (8 vs 10 successes), which I reported as confirming a per-market limit. A subsequent code audit found **no market-scoped limiter anywhere in the codebase** — the only limiter on bets/replies/sells is `betPerIp`: **30 requests per minute, keyed purely by IP address**. Both bursts came from one machine = one IP, so an even split is exactly what chance predicts from a *single shared* budget. My test never distinguished the two hypotheses.

**This also explains an older mystery:** an earlier test gave each simulated user a fake distinct IP header and still saw ~85% throttled, which was read as "must be a shared limiter." The real reason is that the host correctly ignores client-supplied IP headers — it was the per-IP limiter the whole time.

**Consequence for P2.2:** there is no "how many simultaneous bettors per market" threshold to tune. The real question is narrower — *is 30 writes/minute per IP right?* — and the only genuine risk is shared IPs (office networks, mobile carrier NAT) where several real people share one address.

### 7.4 A compression pipeline already existed
Before proposing server-side image resizing, I found the app **already** downscales every uploaded image to 1,600px and re-encodes at 0.8 quality, in the browser. The "photos are 4× heavier than text" finding needs re-reading against that. Server-side resize was **declined** — it would entangle with the moderation safety guarantee (which relies on "the image screened is byte-identical to the image served") for an uncertain gain.

### 7.5 A self-caught false alarm
During Dharma verification, all 140 users showed a balance 10 higher than expected — which looked like the site handing out free points. It wasn't: the daily allowance lands in the same transaction as the first bet, and **my checking script's math was wrong**. Investigated rather than reported, fixed the script, re-verified all 140 by hand. Reported openly as my bug, not a site bug.

---

## 8. Remaining work

**P2.2 — needs your decision.** Roughly how many legitimate users might share one IP address for your audience (offices, mobile carriers)? That number determines whether 30 writes/min per IP should rise.

**P1 — needs access.** Visibility into either the app's own connection pool or the hosting platform's pooling layer. Highest-leverage item on the list; most other symptoms trace back to it.

**Then:** P3.2 re-measurement, and P5 (24-hour soak) last.

---

## 9. Report index

| File (in `~/Downloads/`) | Date |
|---|---|
| `zz_LOAD-TESTING-STATUS_20260901T1916.md` | Sep 1 |
| `zz_LOAD-TESTING-FINAL-REPORT_20260902T1802.md` | Sep 2 |
| `zz_LOAD-TESTING-COMPLETE-REPORT_20260904T1019.md` | Sep 4 |
| `zz_LOAD-TESTING-HANDOVER-FULL_20260904T1053.md` | Sep 4 |
| `zz_IMAGE-POST-LOAD-TEST-BATCHES_report_2026-09-06T1055.md` | Sep 6 |
| `zz_FULL-LOAD-TEST-BATTERY_report_2026-09-06T2210.md` | Sep 6 |
| `zz_LOAD-TESTING-SUMMARY_2026-09-07.pdf` | Sep 7 |
| `zz_SIGNIN-LOAD-TEST-TRACKER_2026-09-08.xlsx` | Sep 8 |
| `zz_HOMEPAGE-LOAD-TEST-TRACKER_2026-09-08.xlsx` | Sep 8 |
| `zz_MARKET-CONCURRENCY-TEST_2026-09-08.xlsx` | Sep 8 |
| `zz_MARKET-BETTING-VALIDATION-TABULAR_2026-09-08.xlsx` | Sep 8 |
| `zz_REAL-HTTP-BET-ENDPOINT-TABULAR_2026-09-08.xlsx` | Sep 8 |
| `zz_REMAINING-SIX-ITEMS-TABULAR_2026-09-08.xlsx` | Sep 8 |
| `zz_MASTER-LOAD-TEST-REPORT_2026-09-08.xlsx` | Sep 8 |
| `zz_PRIORITY-FIX-LIST_2026-09-09.md` | Sep 9 |
| `zz_LOAD-TESTING-TOOLING-FIXES_2026-09-10.md` | Sep 10 |
| **`zz_LOAD-TESTING-TRACKER_2026-09-11.md`** (this file, in repo root) | Sep 11 |

---

*Maintained by Claude Code. Last updated 2026-09-11.*
