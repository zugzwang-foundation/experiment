# UI-A4 — Discovery — EXECUTE session log (overnight autonomous run, kickoff v2)

> Session: 2026-07-18 overnight · single-threaded (OQ-5 containment, §16 verbatim — no ultracode, no Workflow, no watchers) · kickoff v2 (re-issue after the v1 STEP 0 park).
> Law: `docs/plans/UI-A4.md` @ origin/main `212d468` — MD5 `20452a42da074a8f7dac5ed2e199b85d` (238 lines).

---

## STEP 0 — HARD GATES (raw)

### Gate 1 — origin/main tip — ✅ PASS

```
$ git fetch origin && git log --oneline -3 origin/main
212d468 docs(plans): UI-A4 Discovery plan v2 — RATIFIED (OQ-1..7 folded) (#243)
02bc424 docs(specs): SPEC.1 §22 Discovery amendment + SPEC.2 R-2 route repoint (#242)
4cd0d5b chore(ui): suspended-modal X-close strip — enforce W2.11/CD-A single-OK anatomy (#241)
$ git rev-parse origin/main
212d4687145e88a3374a9e9d314c11f96f569163
```

Tip is exactly `212d468` (PR #243). ✅

### Gate 2 — MODEL COHERENCE (amended gate; replaces the opus grep) — ✅ PASS

```
$ git grep -n "^model:" origin/main -- .claude/agents/
origin/main:.claude/agents/code-reviewer.md:5:model: claude-fable-5
origin/main:.claude/agents/db-migration-reviewer.md:5:model: claude-fable-5
origin/main:.claude/agents/security-auditor.md:5:model: claude-fable-5
origin/main:.claude/agents/test-writer.md:5:model: claude-fable-5
```

All four pins IDENTICAL (`claude-fable-5`) AND identical to this session's own running model (`claude-fable-5`). Coherent. ✅
`.claude/**` untouched tonight (NEVER item).

### Gate 3 — CI green on 212d468 — ✅ PASS

```
$ gh pr view 243 --json state,mergeCommit,statusCheckRollup
{"ci":[{"conclusion":"SUCCESS","status":"COMPLETED"}],
 "mergeCommit":"212d4687145e88a3374a9e9d314c11f96f569163","state":"MERGED"}
```

The required `ci` check on PR #243 (whose squash IS the tip) is SUCCESS. ✅

### Gate 4 — plan read + MD5 — ✅ PASS

```
$ git show origin/main:docs/plans/UI-A4.md | md5
20452a42da074a8f7dac5ed2e199b85d
$ git show origin/main:docs/plans/UI-A4.md | wc -l
     238
```

MD5 matches the kickoff pin exactly; 238 lines; read in full. Law echo below. ✅

### Gate 5 — ceilings — ✅ PASS

```
migration head:        drizzle/migrations/0023_positions_market_id_idx.sql
ADR ceiling:           docs/adr/0031-durable-bet-receipts-and-terminal-error-mapping.md (0032 unclaimed)
EVENT_TYPES const:     24 (awk over the EVENT_TYPES = [ … ] as const block)
SPEC.1 §0:             1.0.17   · grep -cE '^## §22 Discovery' docs/specs/SPEC.1.md → 1
SPEC.2 §0:             1.0.18
```

### Gate 6 — branch — ✅

Plan names no execute branch (the F3 plan commit branch `docs/ui-a4-plan` is the plan lane, not execute). Kickoff default applies:

```
$ git rev-parse --verify feat/ui-a4-discovery   → fatal (name free, local)
$ git ls-remote origin feat/ui-a4-discovery     → empty (name free, remote)
$ git checkout -b feat/ui-a4-discovery origin/main
feat/ui-a4-discovery @ 212d4687145e88a3374a9e9d314c11f96f569163
```

### Gate 7 — log — ✅

Plan names no log path. Kickoff default: **`docs/logs/UI-A4.md`** (this file), first entry = this STEP 0 block + the gate-amendment deviation line.

### DEVIATION (kickoff amendment (c), operator-ruled 2026-07-18 — recorded per instruction)

> **STEP 0 gate amendment:** the plan's §10/§16 OQ-7=b execute-prerequisite ("A4 execute does not start until the re-pin chore PR is merged; STEP 0 grep-verifies all `claude-opus-4-8`") is REPLACED by the MODEL-COHERENCE gate (all four pins identical to each other AND to the session's running model), and the OQ-7 re-pin chore is RE-SEQUENCED to after this run. Ruled by the operator in the v2 kickoff; nothing else re-opened. Session runs `claude-fable-5` with all four agent pins `claude-fable-5` — coherent under the amended gate.

---

## LAW ECHO (from docs/plans/UI-A4.md @ 212d468 — verbatim)

### Slice table (§2)

| # | Slice | New/edited (all under `src/server/discovery/**`, `src/components/discovery/**`, `src/app/(public)/**` unless noted) | Tests (first) | Reviewer | Cut-pt |
|---|---|---|---|---|---|
| 1 | **Read-model: list + card aggregates** | `config/limits.ts` (+`DISCOVERY_GRID_SIZE`); `discovery/list.ts` (`listOpenMarkets`); `discovery/media.ts` (default-media row + `signReadMarketMedia`) | `tests/server/discovery/list.test.ts` — `open-markets-only`, `newest-first`, `capped-at-grid-size`, `sparse-no-placeholders`, `zero-markets-empty-state` | `@code-reviewer` | |
| 2 | **Price-series replay** (F-1 soft check · F-4 downsample) | `config/limits.ts` (+`DISCOVERY_SERIES_MAX_POINTS`); `discovery/price-series.ts` (`loadPriceSeries`) | `tests/server/discovery/price-series.test.ts` — `seed-only-flat-at-50pct`, `replay-matches-live-pool` (quiescent-fixture equality), `mismatch-logs-and-serves` (non-fatal), `includes-sells`, `monotone-created-at-order` | `@code-reviewer` | |
| 3 | **Hero top-post-per-side + Track-B masking** (safety-critical) | `discovery/hero.ts` (`selectHeroTopPosts`); **extract+export** `loadRemovedSet`, `deriveTitleTeaser` from `load-debate-view.ts` (surgical; reuse the SAME masking primitive — OQ-3 B) | `tests/server/discovery/hero.test.ts` — `hero-top-post-per-side-by-top-ranking`, `hero-masks-track-b-hidden-from-public`, `next-eligible-when-top-removed`, `side-empty-when-none-eligible`, `hero-single-market-static` | `@code-reviewer` → **`@security-auditor`** | |
| 4 | **Presentational components** | `components/discovery/{MarketCard,PriceSparkline,StatLine,HeroPanels}.tsx`; **reuse/adapt `src/components/debate/PriceBar.tsx`** for the YES/NO bar (F-6; `composer/ReplySplitBar.tsx` the sibling precedent) — no fresh `MarketBar` authored | `tests/unit/discovery/render/*.test.tsx` (jsdom) — card composition, sparkline shape, bar fill mapping | `@code-reviewer` | |
| 5 | **Carousel + grid + surface states** | `components/discovery/{DiscoveryCarousel(use client),DiscoveryGrid,EmptyState,LoadingSkeleton,ErrorState}.tsx` | `tests/unit/discovery/render/*.test.tsx` (jsdom, fake timers) — 10s auto-advance, dot L→R fill, arrows reset, 8-wrap, `hero-single-market-static`, sparse shrink no-placeholders, zero empty-state | `@code-reviewer` | |
| 6 | **Wiring + displacement** | `(public)/page.tsx` (RSC composes read-model → grid/hero/carousel), **served UNCACHED/dynamic v1** (OQ-1 A — no `'use cache'`); **delete `src/app/page.tsx`** | `tests/unit/discovery/render/page-states.test.tsx` (anon vs logged-in body; loading/error) + `tests/server/discovery/*` integration wiring | `@code-reviewer` → **`@security-auditor`** (masking path) | **★ CUT POINT** |

### Branch / log

- Branch: `feat/ui-a4-discovery` off origin/main (kickoff default — plan names none).
- Log: `docs/logs/UI-A4.md` (kickoff default — plan names none).

### Pre-PR self-audit checklist (plan §15 + §5.10)

> `ZUGZWANG_ENV=preview just verify` → `pnpm test:integration` → `pnpm vitest run` (full-suite floor) → §5.10 self-audit (item-by-item vs this plan) → reviewer cascade (§10). PR opens only on a clean audit. **Pre-merge (F-2):** the A4 execute PR additionally requires a **web GATE C diff-read** (it touches the masking enforcement point) before the operator squash-merges.

### Reviewer cascade (plan §10)

> `@test-writer` (Phase-2 start, every slice) → implement → `@code-reviewer` (all `src/server/**` + `src/components/**` diffs) → **`@security-auditor`** on Slices 3 & 6 (the masking read-path). **No `@db-migration-reviewer`** (zero schema/migration). Every invocation passes `@docs/plans/UI-A4.md`.

---

## Slice log (appended per slice)

### Slice 1 — Read-model: list + card aggregates — ✅ commit `2ac5d71`

- **Files touched:** `src/server/config/limits.ts` (+`DISCOVERY_GRID_SIZE = 8`), `src/server/discovery/list.ts` (new), `src/server/discovery/media.ts` (new), `tests/server/discovery/list.test.ts` (new). Exactly the plan's slice-1 file list.
- **RED proof:** suite failed at COLLECTION — `Error: Cannot find package '@/server/discovery/list' imported from tests/server/discovery/list.test.ts` (raw output in session; `DISCOVERY_GRID_SIZE` also absent from limits.ts at authoring time).
- **GREEN:** slice suite 5/5 passed; `ZUGZWANG_ENV=preview just verify` → "All checks passed."; **full suite 227 files passed | 3 skipped (230), 1650 tests passed | 2 skipped | 5 todo** (132s).
- **Subagent verdicts:**
  - `@test-writer` (RED author): wrote the 5 §17-registry tests verbatim; surfaced the §22-prose vs §17-registry name drift (`fewer-than-grid-size-no-placeholders` vs `sparse-no-placeholders`) — registry wins per plan F-3; queued for the web-owned errata.
  - `@code-reviewer`: **"clean PASS"** — 0 CRITICAL / 0 HIGH / 0 MEDIUM; 3 LOW (presign-throw arm unexercised → **folded in-session** (`mockRejectedValueOnce` inside `sparse-no-placeholders`, suite re-green 5/5); the F-3-adjudicated spec-internal name drift, no action; log entry pending, done here).
- **Deviations:** none. (Interpretation note, not a deviation: plan §3's "per selected market compose … loadPriceSeries" completes at the page RSC in Slice 6 — Slice 2's file list does not include `list.ts`, so the series stays a separate export composed at wiring, per the per-slice file-containment law.)

### Slice 2 — Price-series replay (F-1 soft check · F-4 downsample) — ✅ commit `efe469a`

- **Files touched:** `src/server/config/limits.ts` (+`DISCOVERY_SERIES_MAX_POINTS = 64`), `src/server/discovery/price-series.ts` (new), `tests/server/discovery/price-series.test.ts` (new). Exactly the plan's slice-2 file list.
- **RED proof:** collection failure — `Error: Cannot find package '@/server/discovery/price-series' imported from tests/server/discovery/price-series.test.ts`.
- **GREEN:** slice suite 5/5; `ZUGZWANG_ENV=preview just verify` → "All checks passed."; **full suite 228 files passed | 3 skipped (231), 1655 passed | 2 skipped | 5 todo** (after remediation, below).
- **Subagent verdicts:**
  - `@test-writer` (RED author): five plan-§2-row-2 names verbatim; all expected values derived in-test via the pure CPMM functions; F-4 bound + first/last-keep + subset-not-interpolation folded into `monotone-created-at-order`.
  - `@code-reviewer` round 1: **NOT a pass — 1 HIGH (merge-blocking), 1 MEDIUM, 2 LOW.**
    - **HIGH (verbatim summary):** "The replay query never sees a single real buy … the live emitter writes `bet.placed` under the **bet** aggregate (place.ts:184-185: `aggregateType: "bet"`, `aggregateId: bet.id`); only `bet.sold` (sell.ts:96-97) and `market.opened` (open.ts:115-116) ride the market aggregate … every buy is missing from the walk … a guaranteed `discovery_price_series_drift` Sentry flood from launch. Plan-conflict surfacing: code matches the plan; the plan (§1d WHERE-shape) is wrong. Fix shape that stays inside A4's fence: resolve the market's bet ids via `bets_market_id_idx`, then `events WHERE aggregate_type='bet' AND aggregate_id IN (betIds) AND event_type='bet.placed'` … Blocks merge."
    - **REMEDIATION (in-session, inside the slice fence — §5.11 FAIL-in-scope→fix-before-PR; tripwire 2 NOT tripped: no file-list exit, no NEVER item, no pre-existing-test change):** emitter aggregate shapes verified against the tree first-hand (place.ts:184 / sell.ts:96 / open.ts:115); replay repointed to the two-branch union (market-aggregate `bet.sold` OR bet-aggregate `bet.placed` over the market's bet ids), ordered DB-side `created_at ASC, event_id ASC`; tests re-fixtured to the LIVE emitter shapes (real comment+bets row per buy, BET-aggregate events; sells events-only market-aggregate) — the fixtures are now the regression pin on the emitter↔replay contract. Slice suite re-GREEN 5/5; full gates re-run green.
    - **MEDIUM (recorded for the morning web review — NOT code-fixed; a plan/spec-level follow-up ruling):** `events.created_at` is UUIDv7-derived and minted pre-transaction with W-1 retry reusing the same eventId — under pool contention a bet can commit after a later-minted bet while carrying an earlier `created_at`; CPMM buys don't commute, so a misordered replay yields permanently different finals → the F-1 drift warn becomes PERMANENT for that market (not the ruled transient "legal race"). Availability preserved (always-serve). Options for web: accept + dedupe the warn (once-per-market), or reconcile ordering. The ruled order (created_at, OQ-2=A) was implemented faithfully.
    - **LOW ×2:** `downsample` unguarded for max<2 (unreachable at the pinned 64 — left as-is, simplicity-first); corrupt-payload zod parse throws loud (ruled acceptable posture — F-1's never-throw is scoped to reserve drift, not store corruption; Slice 6 decides page-level error containment).
  - `@code-reviewer` round 2 (re-verify of the remediation): **"CONFIRMED-PASS on the remediated Slice 2 diff … The HIGH is fully resolved with the emitter↔replay contract now both honored in the query and regression-pinned in the fixtures … No CRITICAL, no HIGH, no MEDIUM code findings remain; the recorded MEDIUM is a plan/spec-level follow-up owned by the morning web review."** Round-2 verification detail: (a) completeness — the W-1 tx writes bets row + bet.placed atomically, so the bets-id resolution captures every committed buy; a buy landing between the betIds read and the events scan is the transient legal-race class OQ-2 already covers; (b) union branches mutually exclusive on both discriminating columns — no dedup needed; BitmapOr index plan, µs-exact DB-side ordering; (c) fixtures genuinely pin the contract (a reverted market-aggregate-only scan hard-FAILs `replay-matches-live-pool`). Two NEW LOWs (noted, non-blocking): IN-list bind-param ceiling ~65k bets/market (unreachable at experiment scale; a line for the R-2 follow-up), and an optional two-market interleaved-bets isolation fixture (cross-market containment currently verified by review, not test — candidate fold-in at Slice 6 integration wiring).
- **Deviations:** **one** — plan §1d's replay WHERE-shape ("aggregate_type='market' … event_type IN ('bet.placed','bet.sold')") conflicts with the live emitter contract; remediated per the reviewer's in-fence fix shape; the plan-text correction is queued for the web-owned errata (no plan edit tonight — docs/plans/** is a NEVER item).

### Slice 3 — Hero top-post-per-side + Track-B masking (safety-critical) — ✅ commit `bf0543c`

- **Files touched:** `src/server/debate-view/load-debate-view.ts` (OQ-3 B extraction ONLY: `export` on `loadRemovedSet` + `deriveTitleTeaser`, consumer JSDoc, biome re-wrap — 13 insertions / 2 deletions, zero behavior change), `src/server/discovery/hero.ts` (new), `tests/server/discovery/hero.test.ts` (new). Exactly the plan's slice-3 file list.
- **RED proof:** collection failure — `Error: Cannot find package '@/server/discovery/hero' imported from tests/server/discovery/hero.test.ts`.
- **GREEN:** slice suite 5/5; debate-view suites 22/22 (extraction behavior-neutral); `ZUGZWANG_ENV=preview just verify` PASS; full suite 229 files passed | 3 skipped (232), 1660 passed | 2 skipped | 5 todo. (Final counts re-confirmed after the review fold-in, below.)
- **⚑ INTERPRETATION FLAG for the morning web gate (F-2 GATE C):** `selectHeroTopPosts` ranks via the pure **`topOrder`**, NOT `buildTopList` as the plan §3 sketch literally names. Reasoning: SPEC.1 §22 F-DISC-2's normative sentence pins "the highest-ranked post on each side under the **§9 Top** order"; `buildTopList` = topOrder + the ADR-0017 P2 latest-interleave (display cadence, `latestInterleaveInterval = 10`), and at ≥11 posts a first-per-side scan over `buildTopList` can surface the recency-injected newest post instead of the side's true top pick. The plan's own §1c/§3 gloss `buildTopList` as "(the §9 Top order)" — spec-over-plan-sketch precedence applied. `@code-reviewer` verdict on this call, verbatim: *"the deviation is CORRECT, and I'll say it explicitly: `buildTopList` was NOT required by plan-as-law … SPEC.1 §22's normative sentence … is `topOrder` verbatim."* Also noted by the reviewer: §22's parenthetical ("the latest-interleave … does not affect the hero") is imprecise in the general case — queued for the web-owned errata (E-batch).
- **Subagent verdicts:**
  - `@test-writer` (RED author): five names verbatim (3 §17-registry rows + 2 plan-kept extras); dominance fixtures clear the real DEFAULT_RANKING_CONFIG floors; never-echo `JSON.stringify` sweep with the marker planted in title line AND teaser; ban-arm targets the VISIBLE post's comment (a reason-blind masker fails); ordinal-permanence pins.
  - `@code-reviewer`: **"no merge-blocking findings"** — 0 CRITICAL / 0 HIGH / 1 MEDIUM / 3 LOW. Verbatim on the six asks: extraction "13 insertions / 2 deletions … Nothing else"; masking "a removed post's body, pseudonym, and PFP are never read, so the DTO cannot carry them"; ordinal congruence "identical domain … identical ORDER BY … both Postgres-side"; NEVER items "Moderation is strengthened in reach, not weakened — same primitive, new surface, applied pre-read." **MEDIUM folded in-session:** no fixture discriminated topOrder from buildTopList (all fixtures < interleave interval) — an 11+-post discriminating scenario added inside `hero-top-post-per-side-by-top-ranking` (10 tiebreak-dominant NO posts + a stronger-but-older YES + a weakest-newest YES; in-test premise pins prove `topOrder` first-YES ≠ `buildTopList` first-YES, then assert the hero follows topOrder) — suite re-green 5/5. **LOW ×3:** log entry must land pre-commit (done — this entry); the §22 parenthetical imprecision (web errata); `src/components/debate/composer/payload.ts:17` "UNEXPORTED" doc drift now stale (outside every slice fence — web errata queue).
  - `@security-auditor` (MANDATORY, slice 3), verdict verbatim: **"PASS. No exploitable finding at any severity. The extraction is visibility-only and weakens nothing; `selectHeroTopPosts` enforces F-DISC-2 through the same audited primitive as F-DEBATE-1, in the correct order (mask before read), fail-closed, viewer-independent. Two LOWs (test-sweep hardening — cheap, can fold in-slice or ride Slice 6; a pre-flagged stale doc comment already in the errata queue) and one forward hazard for the Slice-6 audit (catch-granularity around the masking read). Slice 3 is clear to commit."** Attack surfaces probed (auditor's list): extraction diff character-identity; DTO leak paths (none — mask-before-read, picked-only body/author selects); reason-key completeness (`content_removed` is the ONLY live-comment hiding mechanism by construction — gate-blocked content never reaches `comments`); side channels (ordinal ≤ the debate view's existing tombstone exposure; removed-INCLUDED domain REQUIRED for deep-link congruence); resolveAuthors pick-scoped; fail-closed (no try/catch anywhere in the masking path); TOCTOU (admin-initiated ms window, F-DEBATE-4-congruent); viewer-independence (masks unconditionally — a superset of the requirement); INV-1..4 + refusal sweep clean.
    - **LOW folded in-session:** never-echo sweep hardened — the removed post's comment UUID + distinctive stake added to both sweeps, and the surviving pick's `authorStake` pinned; suite re-green 5/5.
    - **⚠ FORWARD HAZARD carried to Slice 6 (auditor's words):** "the catch must sit at whole-surface granularity (render ErrorState), never a per-panel/per-call catch that defaults `removedSet` to empty — that shape would flip masking to fail-open. The Slice-6 mandatory audit should grep the page RSC for exactly this pattern."
- **Deviations:** the ⚑ interpretation flag above (topOrder over buildTopList — reviewer-endorsed, spec-grounded, surfaced for the morning gate). Nothing else.

### Slice 4 — Presentational components — ✅ commit `9d28114`

- **Files touched:** `src/components/discovery/{PriceSparkline,StatLine,MarketCard,HeroPanels}.tsx` (all new), `tests/unit/discovery/render/{price-sparkline,market-card,hero-panels}.test.tsx` (new, 12 tests). Exactly the plan's slice-4 file list; `PriceBar` consumed via import with ZERO edits (F-6 — reuse needed no adapt).
- **RED proof:** all 3 render files failed at COLLECTION — `Error: Failed to resolve import "@/components/discovery/PriceSparkline" …` (same for MarketCard/HeroPanels; `src/components/discovery/` did not exist).
- **GREEN:** render suites 12/12; `ZUGZWANG_ENV=preview just verify` exit 0; **full suite 232 files passed | 3 skipped (235), 1672 passed | 2 skipped | 5 todo, exit 0.** (One mid-slice biome format failure on the three new components was caught by the unpiped re-run — earlier `| tail` pipes had masked a `just verify` non-zero exit; fixed via `biome check --write`, all gates re-run green with explicit exit codes.)
- **Build notes:** OQ-6 bound — `HERO_SIDE_EMPTY` exported const, byte-exact "No YES posts yet"/"No NO posts yet" (identical whatever the empty reason — never hints hidden content); image alt = the market question (dynamic); canon-§6 "IMG" placeholder on the null-image arm; sparkline is display-geometry only (mirror-about-midline, y_yes+y_no=40 — pinned in-test); author pseudonym NON-linked, deep-link `/m/[slug]?post=N` (OQ-4 A).
- **Subagent verdicts:**
  - `@test-writer` (RED author): 12 tests across 3 files; copy asserted via the imported `HERO_SIDE_EMPTY`; fixture prose traced to shipped scaffolds (composer `_harness.tsx` + the discovery server suites + mockup illustrative numbers — no invented market content).
  - `@code-reviewer`: **"PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 3 LOW)"** — all nine directed checks hold (F-6 grep-verified no fresh bar; type-only server imports erased — Slice 5's client carousel can import safely; the only `Number()` on a price is SVG y-placement; anchors exactly the two ruled links; HERO_SIDE_EMPTY byte-exact; a11y carried by PriceBar's role="img" + literal side text; HeroPanels is props-in only — a fetch is impossible by construction; NEVER items clean; tests independently re-run green + tsc exit 0). **LOW ×3:** log entry pre-commit (this entry); a total-anchor-count hardening for HeroPanels renders (candidate fold-in at Slice 5/6 — carried forward); `Đ 14260` vs the mockup's illustrative `Đ 14,260` (no thousands grouping v1 — deliberate, formatDharma reuse; branding-pass note only).
- **Deviations:** none.

### Slice 5 — Carousel + grid + surface states — ✅ commit `b48dcdd`

- **Files touched:** `src/components/discovery/{DiscoveryCarousel,DiscoveryGrid,EmptyState,LoadingSkeleton,ErrorState}.tsx` (all new; only the carousel carries `"use client"`), `tests/unit/discovery/render/{carousel,surface-states}.test.tsx` (new, 10 tests). Exactly the plan's slice-5 file list.
- **RED proof:** both files failed at COLLECTION — `Error: Failed to resolve import "@/components/discovery/DiscoveryCarousel" …` / `"@/components/discovery/EmptyState" …`.
- **GREEN:** discovery render suites 22/22 (5 files); biome exit 0; `ZUGZWANG_ENV=preview just verify` exit 0; **full suite 234 files passed | 3 skipped (237), 1682 passed | 2 skipped | 5 todo, exit 0** (post-remediation final run).
- **Full-suite flake note (documented per the reviewer's ask):** one intermediate full run failed 2 tests in `tests/server/bets/clamp.test.ts` (pre-existing suite, untouched tonight): an `afterEach` `truncateTables` hook timeout (10s) and the FK fallout of that aborted teardown in the following test. Isolated re-run 7/7 green; the subsequent clean full run green (234 files / 1682 tests, exit 0). Matches the documented local-PG contention flake pattern (sequential-cascade memory note); no code implication.
- **Build notes:** timer = per-index `setTimeout` re-armed on any index change (`active` is a REAL effect dependency after a biome `useExhaustiveDependencies` finding was resolved by making the countdown read the current index directly — no suppression); OQ-6 copy bound as exported consts (`EMPTY_COPY`, `LOADING_COPY` "Loading markets…" U+2026-exact, `ERROR_COPY` with action "Reload"); DotFill is transition-based (no new @keyframes — globals.css out of fence), duration bound to `ADVANCE_MS` (reviewer LOW fold).
- **Subagent verdicts:**
  - `@test-writer` (RED author): 10 tests; canon-§5 boundary pins (9,999/+1ms), three wrap pins, single-market-static client half (30s no-advance, no arrows), dot-fill-on-active-only + the `:has(` tree ban walk, the folded Slice-4 anchor census (5 anchors = 3 cards + 2 hero deep-links), OQ-6 copy via imported consts. Five contract resolutions flagged (hero-title scoping via `within`, SVG-safe `getAttribute("class")`, behavioral no-timer assert, `imageUrl: null` fixtures, anchor census derivation) — all sound.
  - `@code-reviewer`: **1 HIGH, 0 MEDIUM, 4 LOW.** HIGH (verbatim core): *"The active grid ring is state-only; no visual ring exists … zero style consumers of `data-active` … the card ring — one of the four synced surfaces in canon §2's locked law — renders nothing."* **Remediated in-session inside the slice fence:** the ring visual now lives in `DiscoveryGrid` (plan §4 assigns "the ≤8-card grid + the active ring" to the grid — no file-list deviation): an active-only wrapper (`data-testid="grid-ring"`) carrying `[outline:2px_solid_var(--border-strong)]`; `expectActive` extended to pin exactly-one active ring WITH an outline class (and its absence on inactive wrappers); suites re-green 22/22. LOW folds: DotFill `transitionDuration` bound to `ADVANCE_MS` (desync hardening — done); the Slice-5 log entry pre-commit (this entry); canon keyboard Left/Right binding not in the ratified plan (tracker note); WCAG 2.2.2 auto-rotation pause consideration (design-level, tracker note — canon specifies none).
- **Deviations:** none.

### Slice 6 — Wiring + displacement (★ CUT POINT) — ✅ commit `7754f70`

- **Files touched:** `src/app/(public)/page.tsx` (NEW — the Discovery front page), **DELETED `src/app/page.tsx`** (the coming-soon placeholder — the exact kickoff displacement), `tests/unit/discovery/render/page-states.test.tsx` (new, 6 tests), `tests/server/discovery/page-wiring.test.ts` (new, 3 tests — the first real-`@/db` integration precedent, deliberate: the page's OWN composition against local PG). Exactly the plan's slice-6 file list.
- **RED proof:** both suites failed at COLLECTION — `Error: Failed to resolve import "@/app/(public)/page" …`.
- **GREEN:** slice suites 9/9; biome exit 0; `ZUGZWANG_ENV=preview just verify` exit 0 (after `just clean` — the stale `.next/types/validator.ts` referenced the deleted route, the documented gotcha; resolved by clean, not code); **build route table shows `ƒ /` (dynamic)** — the displacement + OQ-1 A pin; `pnpm test:integration` **27 files / 175 tests exit 0**; **full suite 236 files passed | 3 skipped (239), 1691 passed | 2 skipped | 5 todo, exit 0.**
- **Build notes:** `export const dynamic = "force-dynamic"` (OQ-1 A — the page reads no dynamic API; without it Next would static-prerender, the opposite of the ruling); sync shell = bare `<Suspense fallback={<LoadingSkeleton/>}><DiscoveryContent/></Suspense>` (the loading boundary scoped IN-page — a route-group `loading.tsx` would blanket `/m/[slug]`, out of fence and wrong-copy); `DiscoveryContent` = ONE whole-surface try/catch (the Slice-3 auditor's catch-granularity law) → ErrorState on ANY read-model throw, EmptyState on zero, else DiscoveryCarousel with all ≤8 markets' data up-front (§22 no-refetch); viewer-independent body (zero-arg, no session read).
- **Subagent verdicts:**
  - `@test-writer` (RED author): 9 tests incl. the loading/`dynamic` introspection pins, the masking-read-throw whole-surface pin, the two-market interleaved-bets isolation fold (the Slice-2 carried LOW), and the whole-page never-echo sweep (marker/pseudonym/UUID/stake over the serialized carousel props; fixture stakes collision-audited — 67-on-304, since the hero-suite's 60-on-300 would substring-false-fail against `"360.…"`). Six flags, none silent.
  - `@code-reviewer`: **"PASS — no merge-blocking findings."** All nine directed checks hold (displacement complete — no sibling `/` page, one header, one `<main>`; force-dynamic + zero `'use cache'`; the single catch discards the partial `views` unconditionally; exactly-once-per-market loader pins; viewer-independence compile-level; sequential bounded reads). **LOW ×4 (tracker/log notes, no code change):** `BUILD_GIT_SHA`/`BUILD_TIMESTAMP` env injection in next.config.ts now consumerless (follow-up cleanup — next.config is a NEVER item tonight); the bare catch would swallow Next control-flow errors IF `redirect()`/`notFound()` were ever added inside the try (latent only — nothing in the try can throw them); the inert Reload button residual (must appear in this log — it does, below); the log-commit-before-PR sequencing (§5.9 — done below).
  - `@security-auditor` (MANDATORY, slice 6 + the branch-level closing pass), verdict verbatim: **"PASS — no merge-blocking findings at any severity. The Slice-3 forward hazard is discharged: the catch sits at whole-surface granularity, fail-closed, with the one narrower catch (media presign) verified incapable of touching the masking path. Branch-wide, masking has a single implementation riding the audited F-DEBATE-1 primitive, the surface is viewer-independent and uncached, and INV-1..4 are untouched by construction (zero writes). Clear to commit Slice 6 and open the DRAFT PR, with the F-2 web GATE C diff-read as the final pre-merge gate."** Catch census: exactly two catches on the whole surface — the page's whole-surface one, and the Slice-1 media presign catch cleared as incapable of touching masking (no DB/masking read beneath it). Displacement mildly security-positive (removes the public `BUILD_GIT_SHA`/`BUILD_TIMESTAMP` disclosure). **LOW ×2 for the OQ-1 C follow-up's ledger:** public `/` compute amplification (the F-4 bound caps payload, not replay compute — the ratified OQ-1 A trade; the cache follow-up is the mitigation owner) + the ~65k-bind-param series cliff (fail-closed if ever reached); plus a test-hardening nit (sweep `el.props` not `el.props.markets` — shape-proofing). **F-2 GATE C focus (auditor's direction):** independently re-confirm the `load-debate-view.ts` hunk is keyword+comment-only — that file is why F-2 exists.
- **Deviations:** ~~one residual — the ErrorState Reload button renders INERT v1~~ **DISCHARGED by the R4 post-run web ruling (2026-07-18) — see the R4 amendment entry below.**

---

## PRE-PR SELF-AUDIT (§5.10 / plan §15 — item-by-item vs the plan)

| # | Plan item | Verdict |
|---|---|---|
| 1 | `DISCOVERY_GRID_SIZE = 8` + `DISCOVERY_SERIES_MAX_POINTS = 64` in `config/limits.ts`, JSDoc-pinned | **PASS** (grep-verified; test-pinned at 8/64) |
| 2 | `listOpenMarkets` — Open-only · created_at DESC · LIMIT 8 · capital-neutral · DTO (pricing/totals/imageUrl, defensive nulls) | **PASS** (5 §17-registry tests verbatim) |
| 3 | `media.ts` — market-media bucket arm, never the "uploads"-hardcoded `signRead`; presign failure degrades | **PASS** (mock-boundary pinned) |
| 4 | `loadPriceSeries` — events replay from the `market.opened` seed across bet.placed/bet.sold (sells included, no bets-row shortcut); F-1 SOFT warn+always-serve; F-4 ≤64 subset downsample first/last kept | **PASS** with **SURPRISE S1** (plan §1d WHERE-shape vs the live emitter aggregate contract — remediated in-fence, reviewer CONFIRMED-PASS; plan erratum queued web-side) |
| 5 | `selectHeroTopPosts` — §9 Top per side; `loadRemovedSet`/`deriveTitleTeaser` EXTRACTED-AND-EXPORTED (never re-implemented); next-eligible; null sides; ordinal congruent with `resolvePostParam` | **PASS** with the **⚑ topOrder interpretation** (spec-normative; reviewer-endorsed; discriminating fixture pinned; for the F-2 gate) |
| 6 | Components — locked §3.2 card; `PriceBar` reused ZERO-edit (F-6, no fresh MarketBar); sparkline complement geometry; `HERO_SIDE_EMPTY` OQ-6 verbatim; author NON-linked; `/m/[slug]?post=N` deep-link (OQ-4 A) | **PASS** |
| 7 | Carousel — 10s auto-advance · reset-on-any-change · straight 8-wrap · single-market static · dot L→R fill · `:has()` ban · view-only · no re-fetch | **PASS** with **SURPRISE S2** (active ring was state-only — remediated: the grid owns the ring visual per plan §4; pinned in `expectActive`) |
| 8 | States — EmptyState/LoadingSkeleton/ErrorState, OQ-6 copy byte-exact as exported consts | **PASS** (U+2026 hex-verified by the reviewer) |
| 9 | Wiring — `(public)/page.tsx` RSC · force-dynamic (OQ-1 A, `ƒ /` in the route table) · whole-surface fail-closed catch · all-up-front composition · **delete `src/app/page.tsx`** | **PASS** |
| 10 | NEVER items — zero migration/DDL/event-type/schema/dep/next.config/.claude/specs/ADRs/plans; masking never weakened; no pre-existing test's semantics altered | **PASS** (auditor: zero writes branch-wide; the `load-debate-view.ts` hunk is keyword+comment-only) |
| 11 | Invariant assertions — INV-1..4 untouched (pure read surface); fixtures honor the INV-1 direction (`bets.comment_id` populated, `comments.bet_id` NULL) | **PASS** |
| 12 | Reviewer cascade — @test-writer every slice · @code-reviewer every slice · @security-auditor slices 3 & 6 · no @db-migration-reviewer (no schema) · every invocation passed `@docs/plans/UI-A4.md` | **PASS** (verdicts verbatim above; 2 remediation loops, both re-confirmed) |
| 13 | Gates — per-slice `ZUGZWANG_ENV=preview just verify` + suites; final `pnpm test:integration` (27/175) + full `pnpm vitest run` (236 files / 1691) all exit 0 | **PASS** |

**SURPRISES: 2** (S1 emitter-aggregate, S2 ring visual) — both caught by the cascade, remediated in-session inside the fence, and re-verified. **Audit clean → PR opens (DRAFT; F-2 web GATE C before merge).**

---

## POST-RUN AMENDMENTS (web rulings, 2026-07-18) — R4 commit stamped below

Rulings received: **R1** topOrder RATIFIED (spec-normative; discriminating fixture stands) · **R2** plan §1d = record-only (docs/plans untouched; this log carries it) · **R3** drift-warn permanence → HARDEN carry, no code tonight · **R4** Reload fix NOW (executed below).

### R4 — ErrorState action made LIVE (tests-first, in-fence)

- **Files touched:** `src/components/discovery/ErrorState.tsx` (the whole 40-line file becomes the tiny `"use client"` leaf — the ruling's "becomes" arm; no new file, no `error.tsx`, no fence exit; button `onClick={() => window.location.reload()}`; the dead optional `onReload` prop removed — zero consumers; `ERROR_COPY` byte-identical), `tests/unit/discovery/render/surface-states.test.tsx` (the `render::error-state-copy-and-reload` pin re-pointed at the live behavior), + a reviewer-directed COMMENT-ONLY fold in `src/app/(public)/page.tsx` (the catch comment still documented the pre-R4 inert state — false documentation heading into GATE C; behavior untouched).
- **RED proof:** the extended test failed against the committed inert button (no reload observable on click). Seam evolution, documented honestly: the first spy attempt (`Location.prototype.reload`) failed — jsdom probing showed BOTH `window.location` and `.reload` are [LegacyUnforgeable] (own, non-configurable — no spy can attach); the final pin observes the REAL `window.location.reload()` end-to-end via jsdom's "Not implemented: navigation" virtual-console emission to `console.error` (0 attempts pre-click, exactly 1 post-click — an inert button stays at 0; the reviewer source-verified the whole vitest→jsdom forwarding chain and empirically confirmed the discrimination + one-emission-per-call).
- **GREEN:** surface-states 3/3; discovery render + wiring suites 7 files / 31 tests; biome exit 0; `ZUGZWANG_ENV=preview just verify` exit 0; **full suite 236 files passed | 3 skipped (239), 1691 passed | 2 skipped | 5 todo, exit 0.**
- **Subagent verdict:** `@code-reviewer`: **"PASS with one MEDIUM (stale page.tsx:67-69 comment — surface to the invoking session for a scope call) and one informational LOW."** The MEDIUM folded in-session (the comment correction above); the LOW is the jsdom-message-text coupling (verified against jsdom 29's actual emission; failure direction is loud `0 !== 1`, never a silent pass — tracker note against future jsdom majors). Boundary verified sound (server page → client leaf; zero imports in the file; the only non-test importer is the page); prop removal grep-clean; copy byte-identical.
- **Deviations:** none (the comment fold is the MEDIUM's own remediation, reviewer-surfaced).

### GATE C condition — §17 naming amendment (web-ruled 2026-07-18)

- The 8 registry `it()` strings renamed to the FULL verbatim §17 tokens — `discovery::` prefixed (5 in `list.test.ts`, 3 in `hero.test.ts`); the plan-kept extras and all `wiring::`/`render::` names stay bare; the two file-header naming comments adjusted to state the token shape. Nothing else moved. Suite re-green; commit stamped in git.
