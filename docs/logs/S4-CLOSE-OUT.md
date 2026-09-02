# S-4 · Read-path collapse — CLOSE-OUT

**Stratum:** S-4 · **Phases A–F** · **Closed:** 2026-08-24
**Branch:** `Ritam` · **Phases A–D:** committed `6b9b87d` · **Phase E:** uncommitted (3 files)

---

## 1 · What S-4 set out to do, and what landed

> Stop the page asking twelve questions whose answer is identical for every reader.

That landed. The mechanism is `'use cache'` on the viewer-independent block of both read
surfaces, keyed so that a hit is only possible when nothing that feeds it has moved.

| Phase | Outcome |
|---|---|
| **A** · Audit | Complete. Re-derived every count from source; found three cited documents that do not exist. |
| **B** · Migration unblock | Complete. `cacheComponents` on, Next 16.2.4 → **16.3.2**, 14 routes migrated. |
| **C** · Discovery cache | Complete. Cold **5.14 s → 0.71 s** warm (**7.2×**). |
| **D** · Market detail + session dedupe | Complete. Cold **1.233 s → 0.178 s** warm (**6.9×**). |
| **E** · Poll + budgets | **Partial** — warm-path note done, budget tests 2 of 5. See §3. |
| **F** · Close | This document. **Merge is the operator's** (§8 of the pack). |

### The measured result

| Path | Before (Phase A) | After | Change |
|---|---|---|---|
| `/m/[slug]` anonymous | 23–29 statements | **2** | ~12× |
| `/m/[slug]` signed-in | 23–29 statements | **10** | ~2.5× |
| `/` Discovery | 97 statements (`1 + 12N`) | 12 cached + N live | — |
| Poll tick (15 s, signed-in) | 23–29 | **10** | ~2.5× |

Statement counts are exact. Wall-clock figures were taken from a laptop over the public internet
to `ap-south-1`; PERF-1 measured the co-located round trip at 5.34 ms, so **treat every timing as
~10–15× inflated and the counts as the load-bearing quantity.**

---

## 2 · The two design rulings this stratum actually turned on

**Reserves-keying (Design B).** R3 says price and pool reserves are never cached. But price is
not one field — it is the visible bar *and* a valuation (`currentValue`, `computeSell`) buried
inside an otherwise entirely shareable object. Restructuring the function that produced it meant
editing content-masking logic whose 900-line test suite cannot run in this environment. So the
cache is **keyed on the live reserves themselves**: a hit is possible only when the pool provably
has not moved, and any bet changes the key. The value is **never stale**, but it is no longer
literally uncached.

⚠ **This is a disclosed departure from R3's wording, not compliance with it, and it is still
awaiting a ruling.** It now governs **two** surfaces.

**The wrapper boundary.** `loadDebateView` backs both the market page and the `.md` export, which
**ADR-0025 forbids caching** ("a cache is a window in which just-removed content could keep
serving"). A directive on the shared function would have handed the export a cache it is
contractually not allowed to have — with no build error and no type error to catch it. Hence
separate wrapper files: the page goes through them, the export does not, and a test asserts the
loader itself stays clean.

---

## 3 · What did NOT land

| # | Item | Why |
|---|---|---|
| 1 | **No PR, nothing merged** | No push access from this environment; merge is the operator's per pack §8. |
| 2 | **Budget tests: 2 of 5 surfaces** | Discovery (pre-existing) + `/m/[slug]` (new). `/u/[pseudonym]`, `/bookmarks`, `/m/[slug]/export` not written — without local Postgres a budget test's exact-equality numbers would be *inferred*, in a guard whose entire value is that its number was *measured*. |
| 3 | **`revalidateTag` never observed firing** | Tag strings pinned on both ends, ban correctly excluded, cache profiles present — but no live fire. Needs admin auth, or a fabricated `content_removed` row in `mod_actions` (Bucket-A **append-only**, shared staging) that could never be removed. Declined. |
| 4 | **No Suspense split of viewer/price** | Both are props to `DebateView`, a single 744-line `"use client"` component that four `*-height-chain` tests read as source. They are **outside** the cached block; they are not **streamed** separately. |
| 5 | **The tick still replays the layout** | All three routes closed: no twelfth endpoint (SPEC.2 §4.3 / ADR-0034 / `poll-contract.test.ts` pins the `route.ts` inventory), `use cache: private` off-limits, header restructure blocked by #4. |
| 6 | **DB-backed suites never ran** | No local Postgres. Verified via `git stash` that the 11 `load-debate-view.integration` failures are **identical on unmodified HEAD** — environmental, not regression. |
| 7 | **No review cascade** | `@code-reviewer` / `@security-auditor` not run. Pack §8 requires both, and on C/D the security pass must separately state that no viewer-scoped data enters a cached segment — the scan exists (`cached-view-contract.test.ts`), the auditor has not run. |

### Verification that *was* achieved

Typecheck clean · Biome clean · `next build` green (26/26 routes) · **528 tests passing across 52
runnable files** · live cold/warm measurement on both surfaces with prices byte-identical across
cold and warm.

### Errors found in my own earlier phases

1. **Phase B's `/m/[slug]` verification measured a 404.** The smoke test hit `/m/<uuid>`, but
   lookup is by **slug**. Grepping for "market" matched *"Back to markets"* in the error body.
   Corrected in Phase D; that number is void.
2. **Phase C left two tests red.** `page-states.test.tsx` mocked pre-Phase-C function names.
   Cause: I ran only the tests I had just written, not the suites **covering the file I changed**.
3. **Phase D's contract tests were initially self-defeating** — all four negative assertions
   false-positived on text in their own docblocks. Fixed with a comment stripper **plus two
   positive controls**; the tempting wrong fix was deleting the documentation that tripped them.

---

## 4 · Open rulings

| # | Ruling needed | Blocks |
|---|---|---|
| 1 | **Design B / R3** — is "provably never stale via reserves-keying" acceptable, or must the boundary be literal? | Any further caching; two surfaces already built on it |
| 2 | **Latency register Row 13** (`.md` export) — the register says cache it, **ADR-0025 forbids it** | A direct doc-vs-ADR conflict; needs arbitration, not code |
| 3 | **Latency register Row 2** (Dharma graph) — measured at exactly `4 + 3M`; verdict is `CACHE or REMOVE` | A product call, not an engineering one |
| 4 | **Fence exceptions** — Phase B's `(admin)`/`(auth)` route edits and Phase C's `admin/moderation/act.ts` | Both need explicit PR-body sign-off |

---

## 5 · Findings affecting other strata

> Per pack §5 Phase F: *"A finding that reshapes another stratum is worth more than this task's
> own output."* These are ordered by how much they change the receiving stratum's work.

### → S-8 (compute tier / remote cache) — **S-4 is the delta, and the delta reframes the question**

**"What does the 100th concurrent viewer cost?" is the wrong unit.** `'use cache'` with no cache
handler is **per-instance and in-memory**. Cold misses therefore scale with **instance count**,
not viewer count:

```
total statements ≈ (instances × 14) + ((viewers − instances) × 2)     [anonymous]
```

| Concurrent viewers | Instances | Statements | Cold-miss overhead |
|---|---|---|---|
| 1,000 | 10 | 2,120 | **5%** |
| 1,000 | 50 | 2,600 | **19%** |

⇒ **A remote/shared cache only starts paying once instance count makes that overhead exceed the
network hop it adds to every hit.** At 10 instances it plainly does not. The crossover is a
measurement, not an opinion — which is what R5 already said, now with the arithmetic attached.

⚠ **Clear H7 before costing the option at all.** The Upstash primary write region is
**dashboard-only and still unverified** (Phase A T6 — never cleared). If it is not co-located
with `bom1`, a remote cache adds a cross-region hop to every read: precisely the PERF-1 failure
shape (functions in Virginia, database in Mumbai, Discovery at 35 s).

⚠ The cache is also **discarded on every deploy**. A deploy during the live window puts every
instance cold simultaneously.

### → S-5 (load rig sizing)

1. **Measure instance count under load.** It is the governing variable for everything above and
   nothing in the repo can tell you it.
2. **Model the signed-in / anonymous mix.** They differ **5×** (10 vs 2 statements). A rig that
   models only one will size the tier wrong in whichever direction it chose.
3. **Re-run the counts from `bom1`.** The statement counts should be *identical*; the timings
   should fall ~10–15×. If they do not, something other than the read path is wrong.
4. The pinned budget tests give you the cold-path baseline for free —
   `tests/server/{discovery,debate-view}/round-trip-budget.test.ts`.

### → S-3 (auth) — **Lane R's premise has partly changed**

The pack states *"Session cache, any layer: none — no `secondaryStorage`, no `cookieCache`, no
`React.cache`."* **The last clause is no longer true.** Phase D added request-scoped dedupe at
`src/app/(public)/_lib/session.ts`, wired into all four `(public)` RSC call sites.

- **`src/server/auth/**` has ZERO diff** — verified by `git diff --name-only`. The fence held.
- Lane R's cross-request cache remains valuable and **complementary**: mine collapses two reads
  within one render, Lane R's would collapse reads across requests.
- ⚠ **R1(e) — the ban/logout question — gets sharper, not softer.** Request-scoped dedupe cannot
  outlive a ban: the request ends, the memo dies. **A cross-request cache can.** So the defect
  Lane R was told to answer before wiring anything is now the *only* place that risk exists in
  the system. Answer it against the installed package, not the docs.

### → S-1 (connection pooler) — **still open; S-4 changed its arithmetic, not its necessity**

Confirmed by measurement, not memory: still `:5432` **session mode**, `max: 4` per instance,
15-slot tenant ceiling.

The pack's §1.2 arithmetic — *"~0.3 s per render ⇒ ~750 concurrent tabs before saturation"* —
was computed against the pre-S-4 read path. **An anonymous render is now 2 statements instead of
23–29**, so per-tab slot occupancy has dropped materially and that ceiling should be recomputed
before it is used to justify anything.

⛔ **This does not make S-1 optional.** Caching does nothing for write paths, signup, or a
cold-cache burst after deploy — and the 2026-08-07 and 2026-08-16 exhaustion events were
*ordinary staging walkthroughs*, not load. S-1 raises the ceiling; S-4 lowered the load. Both.

### → S-6 (edge rate limiting, hard-dated 5 Sep)

**`/m/[slug]` still carries no rate limit** — `proxy.ts` matches `/admin/:path*` only (verified).
The F-DEBATE-4 auditor's summary still holds exactly: visibility suspension *"reduces only the
honest-user load; it reduces the attack surface by exactly zero."*

Two S-4-specific additions:

- **Cache-busting is bounded, and that is good news.** The cache key is `(market, reserves)` —
  derived server-side from the slug lookup and the pool row. A client **cannot** vary it by query
  parameter; `?post=N` never enters the cached function. So an attacker cannot force arbitrary
  misses. The worst case is cycling all Open market slugs — bounded by `DISCOVERY_GRID_SIZE`.
- **A cheap path is still a path.** Caching lowered the per-request cost, which lowers the honest
  baseline *and* the attacker's cost symmetrically. It changes the slope, not the need.

### → HARDEN.6 / the number-tuning pass (~1 Sep)

`POLL_INTERVAL_MS_DEBATE_VIEW` is **unchanged at 15000** — `limits.ts` has zero diff, as ruled.

⚠ **But its docblock is now stale in a second, newer way.** `limits.ts:250` still reads *"twelve
to fourteen sequential database round-trips per open tab"*. The pack already flagged that as
stale-and-undercounting (real figure was 22–24). **It is now stale in the opposite direction** —
the real figure is 10 signed-in, 2 anonymous. The same claim is duplicated at
`docs/logs/F-DEBATE-4.md:171,177,213`.

⛔ **Not corrected here: `src/server/config/` is outside S-4's fence.** Flagged for its owner. A
tuning pass that sizes against `ticks × tabs × round-trips` will read that comment and use a
number that has been wrong twice, in both directions.

### → Whoever maintains the work pack

**`RECON-1`, `RECON-2`, `HO-0`, `HO-OPS` and `SCALE-TRACKER` do not exist in this repository.**
`grep -rl` across the whole tree finds them named only inside unrelated files, never as
documents. Nor does the pack's own claimed path `docs/scale/S4-WORK-PACK.md`.

This matters twice over: RECON-2 is cited as the authority for the 22–24 baseline (my
re-derivation landed at 23–29 and could not be reconciled against a document that is not there),
and pack §0 makes `HO-0`/`HO-OPS`/`SCALE-TRACKER` the tie-breakers on any conflict — a rule that
cannot be applied to documents nobody can open.

---

## 6 · Where to pick this up

1. **Get the Design B / R3 ruling** (§4.1) — everything downstream of it is already built on an
   answer nobody has given.
2. **Stand up local Postgres** — unblocks the three missing budget tests, the DB suites, and
   every future phase's verification.
3. **Push, PR, review cascade** — flag both fence exceptions and the unsigned-commit issue
   (branch protection requires SSH-signed; `6b9b87d` is unsigned and will be refused at merge).
4. **Row 3 of the latency register** (header portfolio) — highest-leverage remaining cache work,
   no prerequisite, contained.

---

**Findings affecting other strata:** **six, all listed in §5** — S-8 (the remote-cache question
is reframed around instance count, and H7 is still uncleared), S-5 (instance count is the number
to measure; model the 5× signed-in/anonymous split), S-3 (Lane R's "no `React.cache`" premise is
now false, and the ban-vs-cached-session defect is now uniquely Lane R's to own), S-1 (still
open; its saturation arithmetic needs recomputing against the new per-render cost, but it remains
necessary), S-6 (still unprotected; cache-busting is bounded by design, which is a real
constraint in our favour), and HARDEN.6 (the `limits.ts` round-trip comment has now been wrong in
both directions and sits outside this stratum's fence).
