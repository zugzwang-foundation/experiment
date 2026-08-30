# S-4 · Read-path collapse — FINAL RECORD

**Stratum:** S-4 · **Phases A–F** · **Worked:** 2026-08-21 → 2026-08-24
**Branch:** `Ritam` → pushed to `company/Ritam`
**Commits:** `6b9b87d` (A–D) · `494ff41` (E–F)
**Diff vs `main`:** 39 files, +2,742 / −366

> **Status in one line:** all six phases are executed, committed and pushed. **S-4 is not
> formally closed** — the pack's own exit metric (§6.2) requires budget tests on five surfaces
> and two of five exist; the commits are unsigned and will be refused at merge; and Gate C plus
> the review cascade have not run. Full gap list in §7.

---

## 1 · The measured result

| Surface | Before (Phase A) | After | Change |
|---|---|---|---|
| `/m/[slug]` anonymous | 23–29 statements | **2** | ~12× |
| `/m/[slug]` signed-in | 23–29 statements | **10** | ~2.5× |
| `/m/[slug]` wall clock | cold 1.233 s | **warm 0.178 s** | **6.9×** |
| `/` Discovery | 97 statements (`1 + 12N`) | 12 cached + N live | — |
| `/` Discovery wall clock | cold 5.14 s | **warm 0.71 s** | **7.2×** |
| Poll tick (15 s, signed-in) | 23–29 statements | **10** | ~2.5× |

Statement counts are **exact**. Wall-clock figures were taken from a laptop over the public
internet to `ap-south-1`; PERF-1 measured the co-located round trip at 5.34 ms, so **treat every
timing as ~10–15× inflated and the counts as the load-bearing quantity.**

Correctness held throughout: prices byte-identical to 18 decimal places across cold and warm on
both surfaces, response sizes identical.

---

## 2 · What was built

### New files (4 source/test)

| File | Lines | Purpose |
|---|---|---|
| `src/server/debate-view/cached-view.ts` | 76 | `getCachedDebateView(market, reserves)` — the market page's shared block, `'use cache'` |
| `src/app/(public)/_lib/session.ts` | 46 | `getRequestSession` — React `cache()` session dedupe |
| `tests/server/debate-view/cached-view-contract.test.ts` | 306 | 17 tests — cache-boundary contract, incl. the viewer-data positive scan |
| `tests/server/debate-view/round-trip-budget.test.ts` | ~230 | `/m/[slug]` read budget, 3 pinned counts + 2 positive controls |

### Modified

- **`next.config.ts`** — `cacheComponents: true`, `agentRules: false`
- **`package.json` / lockfile** — Next.js **16.2.4 → 16.3.2**
- **13 route files** — `export const instant = false` (5 `(public)`, 7 `(admin)`, 1 `(auth)` layout)
- **10 route files** — `export const dynamic = "force-dynamic"` removed (0 remain repo-wide)
- **`src/server/discovery/list.ts`** — two additive cached readers; `listOpenMarkets` untouched
- **`src/app/(public)/page.tsx`** — split into cached half + live pricing half
- **`act.ts` / `open.ts` / `close.ts`** — `revalidateTag` wired
- **`m/[slug]/page.tsx`** — rewired to the cached block + deduped session
- **6 test files** — updated to match, each deliberately rather than loosened

### Untouched, verified by `git diff --name-only`

`src/server/auth/**` · `load-debate-view.ts` · `DebateView.tsx` · `hero.ts` · `listOpenMarkets`
· `drizzle/**` · `limits.ts` (so `POLL_INTERVAL_MS_DEBATE_VIEW` is unchanged at 15000)

---

## 3 · Phase by phase

### Phase A — Audit (read-only) ✅

Re-derived every count from source rather than trusting the pack's citations.

- **`RECON-1`, `RECON-2`, `HO-0`, `HO-OPS`, `SCALE-TRACKER` do not exist in this repo.** Cited
  throughout the pack — including as the tie-breakers on any conflict (§0). Nor does the pack's
  own claimed path `docs/scale/S4-WORK-PACK.md`.
- `/m/[slug]` re-derived at **23–29**, vs. the cited 22–24 — could not be reconciled against a
  document that is not there.
- Discovery's `1 + 12N` (97 at N=8) confirmed exact.
- **Found the `.md` export / ADR-0025 conflict before it shipped** — this shaped C and D.
- Upstash region is **dashboard-only**; H7 never cleared.

### Phase B — Migration unblock ✅

`cacheComponents` on, zero behaviour change intended and achieved.

**The version discovery:** the plan rested on `instant = false`, which **does not exist in Next
16.2.4** — silently ignored, not an error, which is why the first attempt failed incoherently.
Traced with `--debug-prerender` instead of patching blind. Real blast radius was **14 routes
across 3 route groups**, not the 10 scoped. All work was **fully reverted** so the version bump
could be proven in isolation before rebuilding on it.

**Also caught:** Next 16.3.x auto-appends to `AGENTS.md` on every dev/build. That file is
hand-governed (CLAUDE.md §7) — disabled via `agentRules: false` before it left a footprint.

**Disclosed regression:** `redirect()` under `cacheComponents` no longer yields a clean HTTP 307
(streams first, falls back to `<meta refresh>`). Browsers land correctly; non-JS clients see ~1 s.
Affects `/bookmarks`, `/admin`. **Still open** — closes with a Suspense hoist.

### Phase C — Discovery cache ✅

Two additive cached readers; `listOpenMarkets` and `hero.ts` untouched.

**Design B, the mid-execution pivot.** The plan called for restructuring `selectHeroTopPosts` —
which has a 900-line DB-backed suite marked **SAFETY-CRITICAL** (it is the content-masking
logic), unrunnable here. Design B instead **keys the cache on `reserves`**, read live and passed
in: a hit is possible only when the pool provably has not moved.

### Phase D — Market detail + session dedupe ✅

Same pattern applied to the main surface, plus the session dedupe at the `(public)` call sites.

**Zero diff in `src/server/auth/**`** — the S-3 collision the pack called "the most likely
failure in the whole programme" did not happen.

### Phase E — Poll + budgets ⚠️ partial

Warm-path note delivered; budget tests **2 of 5**.

**Reframed the question it was asked.** "What does the 100th viewer cost?" assumes viewers drive
cost. They do not — the cache is per-instance, so cold misses scale with **instance count**:
5% overhead at 10 instances, 19% at 50.

**Found a duplicate by measuring, not reading:** `balance` and `cursor` are read **twice** per
signed-in render — once for the header, once for the composer. Fixing it takes 10 → 8 statements.
**Declined**: needs either an edit inside `src/server/dharma/**` (critical path, outside fence —
H1) or crossing `viewer-context`'s transaction boundary, where statement order is a documented
*correctness* constraint.

### Phase F — Close ✅ (document) / ❌ (merge)

Close-out written, ending with the required cross-stratum findings. **Merge is the operator's**
per pack §8 and has not happened.

---

## 4 · The two design rulings this turned on

**Reserves-keying (Design B).** R3 says price and pool reserves are never cached. But price is
not one field — it is the visible bar *and* a valuation (`currentValue`, via `computeSell`)
buried inside an otherwise entirely shareable object. The cache is keyed on the **live reserves
themselves**, so a hit is possible only when the pool has not moved. The value is **never
stale** — but it is no longer literally uncached.

⚠ **A disclosed departure from R3's wording, not compliance with it. Still unruled, and two
surfaces are built on it.**

**The wrapper boundary.** `loadDebateView` backs both the market page and the `.md` export, which
**ADR-0025 forbids caching**. A directive on the shared function would have handed the export a
cache it is contractually not allowed to have — no build error, no type error. Hence separate
wrapper files; a test asserts the loader itself stays clean.

---

## 5 · Verification achieved

| Check | Result |
|---|---|
| Typecheck | clean |
| Biome | clean, exit 0 (5 pre-existing warnings, **none** in touched files) |
| `next build` | green, 26/26 routes |
| Runnable tests | **528 passing across 52 files** |
| Live cold/warm | measured on both surfaces, prices identical across both |
| `src/server/auth/**` | zero diff, verified |
| DB-backed suites | **could not run** — confirmed via `git stash` that the 11 failures are **identical on unmodified `HEAD`**, i.e. environmental |

---

## 6 · Errors found in my own earlier phases

Recorded because each was real, and each was caught by measurement rather than review:

1. **Phase B's `/m/[slug]` verification measured a 404.** The smoke test hit `/m/<uuid>`, but
   lookup is by **slug**. Grepping for "market" matched *"Back to markets"* in the error body,
   which I read as content. Corrected in Phase D; **that number is void.**
2. **Phase C left two tests red.** `page-states.test.tsx` mocked pre-Phase-C function names.
   Cause: I ran only the tests I had just written, not the suites **covering the file I changed**.
3. **Phase D's contract tests were initially self-defeating** — all four negative assertions
   false-positived on text in their own docblocks. Fixed with a comment stripper **plus two
   positive controls**; the tempting wrong fix was deleting the documentation that tripped them.

---

## 7 · What is NOT done

| # | Gap | Severity |
|---|---|---|
| 1 | **Both commits are UNSIGNED** (`%G?` = `N`). Branch protection requires SSH-signed — **the merge will be refused.** The new ed25519 key fixed *authentication*; *signing* is separate (`user.signingkey` + `gpg.format=ssh` + `commit.gpgsign`). | **Hard blocker** |
| 2 | **Budget tests 2 of 5** — pack §6.2 exit metric #1 requires all five. Missing: `/u/[pseudonym]`, `/bookmarks`, `/m/[slug]/export`. Not written because without a database their numbers would be *inferred* in a guard whose only value is that its number was *measured*. | **Blocks formal close** |
| 3 | **No PR, no CI, no review cascade.** Pack §8 requires `@code-reviewer` **and** `@security-auditor`; on C/D the security pass must *separately state* no viewer-scoped data enters a cached segment. Gate C (RP-3) is marked non-optional. | **Blocks merge** |
| 4 | **Design B / R3 ruling outstanding** — two surfaces built on it. | **Blocks confidence** |
| 5 | `revalidateTag` never observed firing — needs admin auth, or a fabricated row in `mod_actions` (Bucket-A append-only, shared staging) that could never be removed. Declined. | Medium |
| 6 | No Suspense split of viewer/price — blocked by `DebateView` being one 744-line client component. `instant = false` stays; the Phase B redirect regression stays open. | Medium |
| 7 | DB-backed suites never ran (environmental). | Medium |
| 8 | Two fence exceptions need explicit PR-body sign-off: Phase B's `(admin)`/`(auth)` edits, Phase C's `act.ts`. | Low |

---

## 8 · Findings affecting other strata

Full detail in `docs/logs/S4-CLOSE-OUT.md` §5. Summary:

- **S-8** — the remote-cache question is reframed: cold misses scale with **instance count**, not
  viewers (5% at 10 instances, 19% at 50). The crossover is a measurement. ⚠ **Clear H7 first** —
  the Upstash region is still unverified; if not co-located with `bom1`, a remote cache
  reintroduces the exact PERF-1 failure shape.
- **S-5** — measure **instance count under load**; model the **5×** signed-in/anonymous split;
  re-run counts from `bom1` (counts should be identical, timings should fall ~10–15×).
- **S-3** — Lane R's stated premise *"no `React.cache`"* is **now false**. ⚠ And the
  ban-vs-cached-session defect is now **uniquely Lane R's**: a request-scoped memo cannot outlive
  a ban; a cross-request cache can.
- **S-1** — still open (`:5432` session mode, `max: 4`). Its §1.2 saturation arithmetic was
  computed against a read path that no longer exists and **needs recomputing** — but S-1 remains
  necessary (caching does nothing for writes, signup, or a post-deploy cold start).
- **S-6** — `/m/[slug]` still unprotected (`proxy.ts` matches `/admin/*` only). One consolation:
  the cache key is derived server-side, so **a client cannot vary it** and force misses at will.
- **HARDEN.6** — `limits.ts:250` still says "twelve to fourteen round-trips". That was already
  stale-and-undercounting (real: 22–24); it is **now stale in the opposite direction** (real: 10
  signed-in, 2 anonymous). Outside S-4's fence — flagged for its owner.

---

## 9 · Document index

| File | Contents |
|---|---|
| `docs/logs/S4-FINAL-RECORD.md` | This document |
| `docs/logs/S4-CLOSE-OUT.md` | Phase F close-out + full cross-stratum findings |
| `docs/logs/S4-SESSION-SUMMARY.md` | Phases A–D narrative + latency-register cross-reference |
| `docs/logs/S4-PHASE-B.md` | Migration unblock detail |
| `docs/logs/S4-PHASE-C.md` | Discovery cache detail |
| `docs/logs/S4-PHASE-D.md` | Market detail + session dedupe detail |
| `docs/logs/S4-PHASE-E.md` | Poll + budgets detail |
| `docs/logs/S4-PHASE-E-warm-path.md` | **Warm-path characterisation for S-5/S-8** |
| `~/Downloads/zz_S4-AUDIT_phaseA_2026-08-21T1626.md` | Phase A audit (328 lines) |

---

## 10 · Pick-up order

1. **Fix commit signing** — the hard blocker; everything queues behind a merge that currently
   cannot happen.
2. **Get the Design B / R3 ruling** — two surfaces already built on the answer.
3. **Stand up local Postgres** — unblocks the three missing budget tests *and* the DB suites, and
   closes the pack's exit metric.
4. **Open the PR, run the cascade** — flag both fence exceptions in the body.
