# UI-A4 — Discovery — Plan **v2** (RATIFIED · execution pending)

> **Status:** Phase-1 plan **RATIFIED 2026-07-18** (operator-ratified; OQ-1…7 folded — see **§16 Ratification record**). Execution is **gated on the OQ-7 re-pin chore PR** (a separate parallel PR). Landed via the F3 single-file plan commit on `docs/ui-a4-plan`. Zero `src/`, zero DDL in the plan chat.
> **Governing spec:** SPEC.1 **§22 Discovery** (F-DISC-1, F-DISC-2) — landed on `main` @ `02bc424` (PR #242). **Doc-only surface: no new tables, no new event types, no migration, no DDL.**
> **Mode:** plan-mode; session model `claude-opus-4-8[1m]` (Fable-5 window closed); effort max; ultracode flag harness-ON but **RULED OUT for all of A4** (OQ-5 containment ruling, §16) — whole vertical single-threaded/gated, no Workflow fan-out, no watchers, kickoff-named subagents only, regardless of the harness flag.

---

## 0. Ground (verified this session — raw)

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `origin/main` | `02bc424` | `02bc424` (PR #242 squash) | ✅ |
| PR #242 `ci` | green | `ci SUCCESS`, `Vercel SUCCESS` (main-tip otherwise carries only scheduled *Env Audit*) | ✅ |
| Migration head | 0023 | `0023_positions_market_id_idx` | ✅ |
| ADR ceiling | 0031 (0032 unclaimed) | `0031-durable-bet-receipts…` | ✅ |
| EVENT_TYPES | 24 | 24 (image_upload 4 · user 5 · admin 2 · market 7 · bet 2 · comment 1 · dharma 2 · moderation 1) | ✅ |
| SPEC.1 §0 | 1.0.17 | `1.0.17` | ✅ |
| SPEC.2 §0 | 1.0.18 | `1.0.18` | ✅ |
| RTL / jsdom | present | `@testing-library/react` 16.3.2 · `jsdom` 29.1.1 · `vitest` ^3.0.0 | ✅ |
| Render harness | R-1..R-5 | `tests/unit/composer/render/` — 5 suites + `_harness.tsx`; per-file `// @vitest-environment jsdom` docblock | ✅ |
| §22 anchor | after §21, before Appendix A | SPEC.1 L1439–1476 (Appendix A at L1477) | ✅ (cited, no STOP) |

**§22 is doc-only and complete** — read model (SCL-4), price series (no store), featured-set selection (SCL-5), hero top-posts (reuses §9), sparse behaviour, cached-not-polled (with the `cacheComponents` prerequisite explicitly called out), route `/`, plus F-DISC-1 / F-DISC-2 with proposed acceptance paths. Nothing in §22 requires schema/DDL/event-type changes.

---

## 1. Recon — substrate map (file:line)

### 1a. Foundation — BUILT (no sequencing STOP)
- `src/app/(public)/layout.tsx:18` — server-component shell (ADR-0023); reads session server-side, renders `GlobalHeader` (UI.A1) with a `viewer = { pseudonym } | null` prop, wraps `children` in `<main>`. **Discovery inherits the header + shell by rendering inside `(public)/`.**
- `src/components/shell/GlobalHeader.tsx:34` — branded header; `IdentityCluster` renders **JOIN** (logged-out) / identity chip (logged-in). **The Đ balance chip is deferred (OQ-2 of A1)** — header shows avatar + pseudonym only. Corroborated by design-canon §4 ruling 4 + §6 ("nav identity = avatar + pseudonym"). ⇒ §22's "avatar + pseudonym + **balance chip**" is descriptive drift; **the balance chip is NOT an A4 build item** (§13 row 8).
- Design tokens (branded dark) applied (`globals.css` `@theme`, BRIDGE) — consumed via `bg-n0`, `--r`, `--imgr`, `--graph-yes/-no`, etc.

### 1b. Root-route displacement (a real structural touch)
- `/` is currently served by `src/app/page.tsx:1` — the May-10 **coming-soon placeholder**, *outside* the `(public)/` group. There is **no `(public)/page.tsx`**.
- A route group adds **no path segment**, so `src/app/page.tsx` and `(public)/page.tsx` both resolve to `/` → a duplicate-route conflict. **Displacement = delete `src/app/page.tsx` + create `(public)/page.tsx`** (so `/` renders inside the header-bearing `(public)` shell). Build-time verify: nested-layout composition (root `layout.tsx` → `(public)/layout.tsx`) renders one header, no double `<main>`.

### 1c. Reuse inventory — the read-model substrate already exists
- `src/server/debate-view/market-pricing.ts:24` — `getMarketPricing(client, marketId) → { yes, no } | null` (spot, pool-derived via the single CPMM `getPrices` authority). **→ YES/NO price bar.** Per-market.
- `src/server/debate-view/market-totals.ts:30` — `getMarketTotals(client, marketId) → { dharmaStaked, postCount, replyCount }` (Σ`bets.stake`; posts = `parent_comment_id IS NULL`; replies = NOT NULL; one round-trip; empty → `{ "0", 0, 0 }`). **→ exactly the `Đ staked · posts · replies` stat line.** Per-market.
- `src/server/debate-view/ranking-substrate.ts:64` — `loadRankingSubstrate(client, {marketId}) → PostSubstrate[]` (the four per-side aggregates + author stake + `created_at`, read-time, no projection table).
- `@/lib/ranking` — `buildTopList(substrate)` (the §9 **Top** order), `badgeFor`, `rankReplies`, `twoSlot`, types. **→ hero top-post-per-side ordering (§9 reused, not amended).**
- `src/server/debate-view/load-debate-view.ts:147` — **the SINGLE place removal-masking is enforced.** `content_removed` mod-actions → `{ removed: true }` union variant with **no body/title/image/author** (a leak is a compile error). `loadRemovedSet` (L277, **private**) is the masking primitive; `deriveTitleTeaser` (L349, private) derives card title/teaser; `mintImageUrls`/`signRead` mint presigned GETs for non-removed posts only.
- `src/server/markets/get-by-slug.ts:34` — `getMarketBySlug` (excludes Draft) — the single-market resolver; the Discovery **list** query is new (composes the above).

### 1d. Price sparkline series — **replay is feasible, no new store**
- **Sells write no `bets` row** (`src/server/bets/sell.ts:24,38` — "Writes NO comments and NO bets row"; a sale is an `events` `bet.sold` row with a synthetic `payload.betId`). ⇒ a `bets.price_at_bet` series **misses sells**; §22's "bet.placed **/ bet.sold** events" ⇒ the faithful source is the **`events` table**.
- `events` (`src/db/schema/events.ts:38`): `events_aggregate_idx` on `(aggregate_type, aggregate_id, created_at)` **indexes** the scan `WHERE aggregate_type='market' AND aggregate_id=? AND event_type IN ('bet.placed','bet.sold') ORDER BY created_at`.
- Event payloads carry `price = pEff` (**effective execution price**, side-denominated: `place.ts:193`, `sell.ts:105`) — **not** the post-trade pool **spot** `p1`, and **not** reserves.
- **Seed is recoverable:** `market.opened` payload carries `seedAmount` (`src/server/markets/open.ts:117`); pool seeds symmetric `y₀=n₀=seedAmount` (`open.ts:92`). ⇒ **replay:** seed → apply each `bet.placed`/`bet.sold` in `created_at` order via the pure `computeBuy`/`computeSell` → `getPrices` per step → exact **YES-spot** series. Final reserves **must equal** the live `pools` row (a free consistency check). Deterministic, pure, no store. Cost = O(bets) CPMM recompute per market per cache-miss (bounded; the R-2 cache amortizes it). See OQ-2.
- Two-line graph: design-language §3.2 — **NO = 1 − YES (always-complementary)**, so **one YES series suffices**; token lines `--graph-yes #737373` / `--graph-no #fafafa`.

### 1e. Card image — `is_default` `market_media` row (read path is new, infra exists)
- `src/db/schema/markets.ts:84` — `market_media { marketId, r2ObjectKey, isDefault, displayOrder }`, partial-unique `market_media_one_default_per_market_uq` (exactly-one default), `market_media_market_id_idx`. Bucket C.
- Card image read = `SELECT r2_object_key WHERE market_id=? AND is_default=true LIMIT 1` → sign a read URL. **Markets always carry media** (§15 F-ADMIN-1 service invariant, `src/server/markets/media.ts:47`) ⇒ a default row always exists.
- **`signRead` is hardcoded to `mintReadUrl("uploads", …)`** (`src/server/storage/sign-read.ts:20`) — but market-media lives in the **`market-media` bucket arm**, which **exists** (`src/server/storage/r2.ts:32,67` — `R2_*_MARKET_MEDIA`). ⇒ card image needs a thin `signReadMarketMedia(key, ttl) → mintReadUrl("market-media", key, ttl)` wrapper (new seam, **no new infra**).

### 1f. Header identity — built at A1; consumed as-is (§1a). No A4 header work.

### 1g. `cacheComponents` — **absent → disabled** (`next.config.ts`); no `'use cache'` anywhere in the repo (`/api/health` is explicitly uncached). Enabling it is an **app-wide global flip** (first-of-kind in this repo). Disposition = **OQ-1** (do NOT silently flip).

### 1h. Design authority (governing)
- **design-canon §2** — Discovery (locked v0.12): hero + 8 grid cards on **one shared carousel index** (hero market + both hero posts + grid ring + active dot in sync); card = image+title+stats+YES/NO bar; `--r:8px`; hero posts → Reply page, author pseuds → Profile.
- **design-canon §5 motion** — index 0–7; auto-advance **10s**; active dot **fills L→R over 10s** as a countdown, restarts on any change; `‹›`/arrows **advance immediately + reset** the timer; **straight 8-position wrap**.
- **design-canon §6 copy** — `‹`/`›` (aria Previous/Next market), `REPLIES · N`, `Đ N STAKED`, `SUPPORT`/`COUNTER`, `IMG`. **All illustrative dummy — final copy at branding (Depth-1 rule).**
- **design-language §3.2** — **locked card composition (Slot 1):** `image thumb + question · two-line sparkline · YES/NO split bar · Đ volume·posts·replies` (category chip/lifecycle/close-date **parked off** the card; **identical on Discovery and Profile**). **Hero:** three panels `top-YES post | market (image+question · two-line graph · price bar · Đ staked·posts·replies) | top-NO post` over a dot carousel.
- **design-language §4.10** — **loading/empty/error ship WITH the surface** (render-tested, not build-invented). **§4.7** — moderation invisible to public (Track-B hidden from anon/non-admin) → the F-DISC-2 masking.
- **Visual reference (committed):** `docs/design/mockups/surface_discovery_v1_0.html` (built OUTPUT, hand-maintained — read as reference, never fed back through the pipeline, canon §9).

### 1i. Execute-readiness — **subagent pins block the reviewer cascade** ⚠
- All four `.claude/agents/*.md` pin **`model: claude-fable-5`** / `effort: max`; the **session is `claude-opus-4-8`**. A frontmatter model unreachable in-session **dies at 0 tool_uses**. ⇒ **A4 execute's `@test-writer`/`@code-reviewer`/`@security-auditor` cascade will fail unless** the Fable window is open at execute OR the pins are reverted to `claude-opus-4-8` (the standing post-window revert obligation) OR the invocations pass a `model` override. **Prerequisite, surfaced as OQ-7** (a config change, out of this plan chat's scope).

---

## 2. The build — slices (tests-first; each independently green)

Vertical, reuse-first. Every slice: **failing tests first (@test-writer) → implement → green → reviewer**. No new tables / event types / migration / DDL. **Two implementation constants** added to `src/server/config/limits.ts` (both undefined today): `DISCOVERY_GRID_SIZE = 8` (design-canon §2) and `DISCOVERY_SERIES_MAX_POINTS = 64` (F-4 downsample bound — an implementation constant, NOT a spec constant). **Ultracode column dropped — OQ-5 rules the whole vertical single-threaded/gated** (§8, §16); every slice runs plan→execute + the kickoff-named cascade, no fan-out. Acceptance names are the §17-registry verbatim set (F-3).

| # | Slice | New/edited (all under `src/server/discovery/**`, `src/components/discovery/**`, `src/app/(public)/**` unless noted) | Tests (first) | Reviewer | Cut-pt |
|---|---|---|---|---|---|
| 1 | **Read-model: list + card aggregates** | `config/limits.ts` (+`DISCOVERY_GRID_SIZE`); `discovery/list.ts` (`listOpenMarkets`); `discovery/media.ts` (default-media row + `signReadMarketMedia`) | `tests/server/discovery/list.test.ts` — `open-markets-only`, `newest-first`, `capped-at-grid-size`, `sparse-no-placeholders`, `zero-markets-empty-state` | `@code-reviewer` | |
| 2 | **Price-series replay** (F-1 soft check · F-4 downsample) | `config/limits.ts` (+`DISCOVERY_SERIES_MAX_POINTS`); `discovery/price-series.ts` (`loadPriceSeries`) | `tests/server/discovery/price-series.test.ts` — `seed-only-flat-at-50pct`, `replay-matches-live-pool` (quiescent-fixture equality), `mismatch-logs-and-serves` (non-fatal), `includes-sells`, `monotone-created-at-order` | `@code-reviewer` | |
| 3 | **Hero top-post-per-side + Track-B masking** (safety-critical) | `discovery/hero.ts` (`selectHeroTopPosts`); **extract+export** `loadRemovedSet`, `deriveTitleTeaser` from `load-debate-view.ts` (surgical; reuse the SAME masking primitive — OQ-3 B) | `tests/server/discovery/hero.test.ts` — `hero-top-post-per-side-by-top-ranking`, `hero-masks-track-b-hidden-from-public`, `next-eligible-when-top-removed`, `side-empty-when-none-eligible`, `hero-single-market-static` | `@code-reviewer` → **`@security-auditor`** | |
| 4 | **Presentational components** | `components/discovery/{MarketCard,PriceSparkline,StatLine,HeroPanels}.tsx`; **reuse/adapt `src/components/debate/PriceBar.tsx`** for the YES/NO bar (F-6; `composer/ReplySplitBar.tsx` the sibling precedent) — no fresh `MarketBar` authored | `tests/unit/discovery/render/*.test.tsx` (jsdom) — card composition, sparkline shape, bar fill mapping | `@code-reviewer` | |
| 5 | **Carousel + grid + surface states** | `components/discovery/{DiscoveryCarousel(use client),DiscoveryGrid,EmptyState,LoadingSkeleton,ErrorState}.tsx` | `tests/unit/discovery/render/*.test.tsx` (jsdom, fake timers) — 10s auto-advance, dot L→R fill, arrows reset, 8-wrap, `hero-single-market-static`, sparse shrink no-placeholders, zero empty-state | `@code-reviewer` | |
| 6 | **Wiring + displacement** | `(public)/page.tsx` (RSC composes read-model → grid/hero/carousel), **served UNCACHED/dynamic v1** (OQ-1 A — no `'use cache'`); **delete `src/app/page.tsx`** | `tests/unit/discovery/render/page-states.test.tsx` (anon vs logged-in body; loading/error) + `tests/server/discovery/*` integration wiring | `@code-reviewer` → **`@security-auditor`** (masking path) | **★ CUT POINT** |

**All slices ❌ gated** (OQ-5 containment). **Slice ordering rationale:** read-model (1) → math (2) → masked hero (3) are the data authority; presentational (4) and carousel/states (5) consume those DTOs; wiring (6) composes the RSC and performs the displacement. Each slice ends green (`just verify` + the relevant suites). The kickoff's "component → read-model → wiring → states" ordering is honoured at the *vertical* level while respecting the hard data→UI dependency (a component can't render a DTO shape that doesn't exist). `hero-single-market-static` is the §17 name for F-DISC-2's "no-auto-advance."

---

## 3. Read-model design (§22 mechanisms — no store, no DDL)

**`listOpenMarkets(client) → CardModel[]`** (Slice 1)
- `SELECT … FROM markets WHERE status='Open' ORDER BY created_at DESC LIMIT DISCOVERY_GRID_SIZE`. Served by `markets_status_idx` + a bounded sort (few open markets pre-launch; **no new index** — that would be DDL, out of §22 scope; a `status,created_at` index is a future optimization if the open set grows).
- Per selected market compose: `getMarketPricing` (bar) · `getMarketTotals` (stat line) · default-media URL (§1e) · `loadPriceSeries` (§ Slice 2). **N+1 honesty:** ≤8 markets × (~5 reads + 1 presign + O(bets) replay). Bounded and acceptable **uncached** for v1 (OQ-1 rec A); **batching** the per-market aggregates into grouped queries (`market_id IN (…)`) is the build-time optimization (§13 row 6). Map to a DTO — never expose Drizzle rows (AGENTS.md §6).

**`loadPriceSeries(client, marketId) → { at: string; yes: string }[]`** (Slice 2)
- Read `market.opened.seedAmount` → reserves `{ yes, no } = { seed, seed }` → scan bet events in `created_at` order → recompute reserves via `computeBuy`/`computeSell` → `getPrices` per step. Prepend the seed point (`yes = 0.5`). NO = 1 − YES at render.
- **F-1 (soft consistency check):** compare final replayed reserves vs the live `pools` row; on mismatch, **WARN log/telemetry and ALWAYS serve the computed series — never throw/500.** A concurrent bet landing between the events scan and the pool read is a **legal race, not a logic bug.** Test `replay-matches-live-pool` asserts equality on **quiescent** fixtures; `mismatch-logs-and-serves` pins the non-fatal path.
- **F-4 (downsample):** the DTO ships a series **thinned server-side to ≤ `DISCOVERY_SERIES_MAX_POINTS` (~64)** points (an implementation bound, not a spec constant) — a bounded payload regardless of a market's bet count.

**`selectHeroTopPosts(client, marketId) → { yes: HeroPost | null; no: HeroPost | null }`** (Slice 3, safety-critical)
- `loadRankingSubstrate` → `buildTopList` (Top order) → for each side, the **first** post whose id is **not** in `loadRemovedSet` (the extracted masking primitive) → resolve author + `deriveTitleTeaser` + ordinal (for the deep-link, §4). `null` when no eligible post on a side. **Masking rides the SAME audited code path as F-DEBATE-1** (extract, do not re-implement) — the F-DISC-2 "safety-critical" requirement.

---

## 4. Component & wiring design

- **`MarketCard`** — the design-language §3.2 **locked** composition (image · question · `PriceSparkline` · `MarketBar` · `StatLine`); `--r:8px`, `--imgr:6px`; whole card is the link → `/m/[slug]`. Built to be **identical on Discovery and Profile** (§3.2) — pure presentational, DTO-driven.
- **`PriceSparkline`** — two complementary lines from one YES series; tokens `--graph-yes`/`--graph-no`; card = sparkline, hero = full-size (a `size` prop).
- **YES/NO bar** — the `YES n% — bar — NO m%` split bar (black fill = YES share). **Reuse/adapt `src/components/debate/PriceBar.tsx`** (F-6; `composer/ReplySplitBar.tsx` is the sibling precedent) — **no fresh `MarketBar` authored.**
- **`HeroPanels`** — three panels (top-YES | market | top-NO) per §3.2; consumes `selectHeroTopPosts` + the card model. Hero post → nav (OQ-4); author pseudonym → Profile (OQ-4).
- **`DiscoveryCarousel`** (`"use client"`) — the one client-motion piece: shared index 0..n−1 driving hero + grid ring + active dot; **10s auto-advance**, dot **L→R fill** countdown restarting on change, `‹›`/arrows **reset**, **8-wrap**; **single market ⇒ no auto-advance** (F-DISC-2). `:has()` is **banned** (canon §3.10) — JS-toggled classes. Pick/select is **view-only** (canon §12).
- **`DiscoveryGrid`** — the ≤8-card grid + the active ring; **sparse ⇒ shrink, no placeholders**.
- **States** — `LoadingSkeleton` (shadcn `skeleton`), `EmptyState` (zero markets — no hero/grid), `ErrorState`.
- **Wiring** `(public)/page.tsx` — RSC: `listOpenMarkets` + per-market `selectHeroTopPosts` (all ≤8 up-front — the carousel does **no re-fetch**, §22) → pass to `DiscoveryCarousel`/`DiscoveryGrid`/`HeroPanels`. **Delete `src/app/page.tsx`.**

---

## 5. Surface-state coverage (render-tested via the jsdom harness — §4.10, not manual smoke)

| State | Render assertion |
|---|---|
| Anonymous vs logged-in header identity | Inherited from `(public)/layout.tsx`; body identical. Page test asserts the body renders for both `viewer=null` and `viewer={pseudonym}` (header is A1's, out of A4 scope). |
| Loading | `LoadingSkeleton` renders card skeletons. |
| Error | `ErrorState` renders (read-model throw). |
| Moderation-masked hero posts | Track-B-hidden top post → next eligible surfaced (or side blank); the removed post's body/author **never** in the payload (Slice 3 server assertion + render assertion of absence). |
| `< DISCOVERY_GRID_SIZE` markets | Grid shrinks; carousel wraps over the available set; **no placeholder cards**. |
| Single market | Carousel static (**no auto-advance**); single dot. |
| Zero markets | `EmptyState` (no hero, no grid). |

---

## 6. Copy inventory (canon §6 vs to-author)

**In canon §6 (usable verbatim, illustrative-dummy):** `‹`/`›` (aria Previous/Next market), `REPLIES · N`, `Đ N STAKED`, `SUPPORT`/`COUNTER`, `IMG`, side/price grammar (`YES @ n%`, `Yes 👍 n%`, `YES n% … NO m%`, `Đ x → Đ y`), nav identity `avatar + pseudonym`.
**NOT in canon (must be web-authored at execute — CC never invents; CLAUDE.md §3):**
- The **zero-markets empty-state message** (canon-silent). Render tests assert a stable `data-testid`, not final copy. → **OQ-6**.
- Any error/loading microcopy beyond the primitives. → same batch.

---

## 7. `cacheComponents` disposition — RULED (OQ-1 = A + C)

**A (v1):** Discovery ships **UNCACHED / dynamic** — no `'use cache'`, no `cacheComponents` flip. The read-model is **correct either way**; the cache is a freshness/cost optimization, not a correctness requirement. **C (follow-up):** a named **"cacheComponents foundational task"** owns the global flip + per-route audit (cookie/`headers()` reads relocated outside cached scopes) + the Discovery `'use cache'` retrofit + the **F-5** consideration (presigned card-image URL TTL vs `cacheLife` — a cached page must not outlive its signed URLs). The **§22 "cached-per-load" freshness deviation is ruled INTERIM, not drift** (§16); the spec reconciliation is **erratum E-4**, queued web-side for a future micro-SYNC — **no spec edit in this task.**

---

## 8. Ultracode containment — RULED (OQ-5 = A)

**The containment ruling (operator-ratified 2026-07-18, verbatim in §16): NO ultracode anywhere in A4.** The whole vertical is single-threaded/gated — no Workflow fan-out, no watchers, kickoff-named subagents only, **regardless of the harness flag state.** Every slice (1–6) runs the gated plan→execute + named-reviewer cascade. Rationale on record: masking is safety-critical (§2/§3), the vertical is tightly coupled component↔DTO, and §5.11 forecloses fan-out on coupled server+UI+tests.

## 9. Cut point (post-window `claude-opus-4-8`)

**Slice 6 (wiring + displacement)** is the designated cut-point (A3/OQ-8 posture): if the Fable-5 window closes mid-execute, Slice 6 runs on `claude-opus-4-8/max` with the **ritual unchanged** (same reviewer cascade, same gates — no gate flex). (Given the session is *already* opus, the window appears closed now; the cut-point provision is effectively the default — see OQ-7.)

## 10. Reviewer cascade (§5.11) + the pre-merge web gate (F-2)

`@test-writer` (Phase-2 start, every slice) → implement → `@code-reviewer` (all `src/server/**` + `src/components/**` diffs) → **`@security-auditor`** on Slices 3 & 6 (the masking read-path — Track-B invisibility is the read side of moderation). **No `@db-migration-reviewer`** (zero schema/migration — doc-only §22). Every invocation passes `@docs/plans/UI-A4.md`.

**F-2 (MUST) — pre-merge web GATE C diff-read on the A4 execute PR.** Because A4 **edits `load-debate-view.ts`** (the moderation-masking enforcement point, OQ-3 B extraction), the A4 PR is **critical-path under gate discipline**: a web GATE C diff-read is required **before** the operator squash-merges. **Execute-prerequisite gate (OQ-7 = b):** A4 execute **does not start** until the separate agent re-pin chore PR is merged; execute **STEP 0 verifies** `grep "model:" .claude/agents/*.md` → all `claude-opus-4-8`.

## 11. Test plan (paths + invariants asserted)

- **Server read-model (real Postgres):** `tests/server/discovery/{list,price-series,hero}.test.ts` — the §22 acceptance matrix (§2 table), the **§17-registry verbatim names** (F-3). `hero.test.ts::hero-masks-track-b-hidden-from-public` is the **safety-critical** assertion (mirrors `I-…`-class moderation-invisibility; no INV-1..4 *new* invariant — this is a read surface). Extras kept: `next-eligible-when-top-removed`, `side-empty-when-none-eligible`, `seed-only-flat-at-50pct`, `replay-matches-live-pool`, `includes-sells`, `monotone-created-at-order`, `mismatch-logs-and-serves`.
- **Render (jsdom):** `tests/unit/discovery/render/*.test.tsx` + `_harness.tsx` (fixtures reuse shipped prose — **no invented market content**, the R-1..R-5 precedent).
- **Gate:** `ZUGZWANG_ENV=preview just verify` + `pnpm test:integration` + `pnpm vitest run` (full-suite floor) per slice; final pre-PR self-audit (§5.10).

## 12. Open questions — RESOLVED (operator-ratified 2026-07-18; §16)

- **OQ-1 — cacheComponents → A + C.** ~~B (flip now)~~ struck. Discovery uncached v1; the "cacheComponents foundational task" (with F-5) is the named follow-up (§16). §7.
- **OQ-2 — price fidelity → A + F-1.** ~~B (event-price sample)~~ struck. Full seed replay; final-vs-pool is a **soft** check (warn, always serve, never throw). §3.
- **OQ-3 — hero read-model → B.** ~~A (reuse full loadDebateView)~~ struck. Lean `selectHeroTopPosts` + **extract-and-export** `loadRemovedSet`/`deriveTitleTeaser` (never re-implemented); `@security-auditor` gates the extraction. §3, §10.
- **OQ-4 — nav targets → A.** ~~B (link to 404)~~, ~~C (plain link)~~ struck. Hero-post → `/m/[slug]?post=N` (built A2 deep-link; ordinal from the substrate); author pseudonym **non-linked v1**. **Web answer recorded:** `?post=N` is **NOT** the §9 Reply page — the postview is a later surface; **follow-up:** upgrade hero-post → postview + author → Profile when those surfaces land (§16 follow-ups).
- **OQ-5 — ultracode containment → A.** ~~B (eligible Slice 4)~~ struck. NO ultracode anywhere in A4 (verbatim, §16). §8.
- **OQ-6 — copy → web-authored.** The empty-state/error/loading string batch arrives in the **execute kickoff**; render tests key `data-testid`, never final strings. §6, §16.
- **OQ-7 — pins → b.** Reverted via a **separate micro-chore PR** (parallel, out of this chat); recorded as the **execute-prerequisite gate** (§10).

## 13. Self-critique (A3 pattern)

| # | Concern / assumption | Disposition |
|---|---|---|
| 1 | Displacing `/` deletes `src/app/page.tsx` — could break the root layout / pre-launch gate. | Confirmed the coming-soon is a scaffold; §22 mandates the swap. Build-time verify nested-layout composition (one header, no double `<main>`). Any pre-launch access gate is a **deploy** concern, not this build. |
| 2 | Is Discovery a §1 critical path? | **No** — it's a read surface (no writes to auth/bets/ledger/moderation dirs). But the **hero masking is the read side of moderation** → `@security-auditor` on Slices 3 & 6, gated ritual retained. |
| 3 | §22 says "avatar + pseudonym + **balance chip**"; header ships avatar+pseudonym (balance deferred). | Drift, not a build item — canon §4/§6 agree (no balance chip). A4 consumes the header as-is; noted for the header team. |
| 4 | Price series: `bets.price_at_bet` looked like a one-query source. | Rejected — **sells write no `bets` row**; the faithful source is the `events` replay from the `market.opened` seed (OQ-2 A). |
| 5 | `signRead` would serve the card image. | Rejected — it's hardcoded to `"uploads"`; market-media is a separate bucket arm → a thin `signReadMarketMedia` wrapper (arm exists; no new infra). |
| 6 | N+1: ≤8 markets × (~5 reads + presign + O(bets) replay) + all-8 heroes up-front (no re-fetch). | Honest cost. Bounded/acceptable uncached for v1; **batch** per-market aggregates into grouped queries at build; strengthens OQ-1's C follow-up (the R-2 cache amortizes exactly this). |
| 7 | Reusing `loadDebateView` for the hero over-fetches. | OQ-3 B — lean selector + **extract** the masking primitive (same audited path, no re-implementation). |
| 8 | Hero-post/author links target unbuilt routes. | OQ-4 A — hero-post deep-links into the built market view; author non-linked in v1. No dead links. |
| 9 | ~~`MarketBar` build-time reuse-check~~ **RESOLVED (F-6):** reuse/adapt `src/components/debate/PriceBar.tsx` (`composer/ReplySplitBar.tsx` sibling precedent) — no fresh component; the build-time check is struck. |
| 10 | Zero-bet open market edge. | Series = single seed point (flat 50%); bar 50/50; stat `Đ 0·0·0`; hero shows no top post either side (F-DISC-2 "none eligible"). Explicit test. |
| 11 | `cacheComponents` is tempting to just flip (§22 names it). | **Do not** — global blast radius. **RULED OQ-1 = A+C:** uncached v1; the foundational follow-up owns the flip. |
| 12 | Ultracode flag is ON; the harness nudges Workflow use. | Recon ran sequential (standing rule). **RULED OQ-5 = A:** NO ultracode anywhere in A4 (verbatim §16), regardless of the flag. |
| 13 | New `DISCOVERY_GRID_SIZE` — is it DDL/schema? | No — a TS global constant in `config/limits.ts` (undefined today); type-only, no migration. |
| 14 | Reviewer cascade could silently fail on the Fable pins. | **RULED OQ-7 = b:** separate re-pin chore PR; A4 execute gated on its merge (STEP 0 grep-verifies all `claude-opus-4-8`). |
| 15 | Copy invention risk (empty-state). | OQ-6 — web-authored batch; render tests key on `data-testid`, never final strings. |
| 16 | Editing `load-debate-view.ts` (masking enforcement point) makes the A4 PR critical-path. | **F-2:** a pre-merge web GATE C diff-read is required on the A4 execute PR before squash-merge (§10, §15). |
| 17 | An unbounded price series could bloat the Discovery payload. | **F-4:** downsample server-side to ≤ `DISCOVERY_SERIES_MAX_POINTS` (~64); bounded DTO. |

## 14. NOT doing (scope fence)

`src/` writes · commits (beyond the F3 plan commit) · DDL/migrations · new tables / event types · ranking-model edits (RANKING.md/ADR-0017 consumed as-is) · **SPEC edits** (§22 is the authored anchor; the E-1…E-4 errata are **web-owned**, queued for a future micro-SYNC) · flipping `next.config.ts`/`cacheComponents` (OQ-1 A — the foundational follow-up owns it) · **the agent re-pin** (OQ-7 — a separate chore PR) · header/balance-chip work (A1's) · Profile / postview route builds (their own tasks) · invented market or empty-state copy · A5 Sell mount · the standing set (stash · PR #146 · SPEC.2 bundle · `[gone]` sweep · AGENTS §9 drift) · tracker edits.

## 15. Verification gate (per slice + pre-PR + pre-merge)

`ZUGZWANG_ENV=preview just verify` → `pnpm test:integration` → `pnpm vitest run` (full-suite floor) → §5.10 self-audit (item-by-item vs this plan) → reviewer cascade (§10). PR opens only on a clean audit. **Pre-merge (F-2):** the A4 execute PR additionally requires a **web GATE C diff-read** (it touches the masking enforcement point) before the operator squash-merges.

---

## 16. Ratification record (operator-ratified 2026-07-18)

All OQ-1…7 ratified by the operator on **2026-07-18**; applied exactly, no re-litigation.

**Rulings folded:**
- **OQ-1 = A + C** — uncached v1 + the named "cacheComponents foundational task" (global flip · per-route audit · Discovery `'use cache'` retrofit · **F-5** presigned-URL-TTL-vs-`cacheLife`). §7.
- **OQ-2 = A + F-1** — full seed replay; **soft** final-vs-pool check (WARN + always serve, never throw; concurrent bets = legal race). §3.
- **OQ-3 = B** — lean `selectHeroTopPosts` + **extract/export** `loadRemovedSet` + `deriveTitleTeaser` (same primitive; `@security-auditor` gates). §3.
- **OQ-4 = A** — hero-post → `/m/[slug]?post=N` (A2 deep-link, ordinal from the substrate); author **non-linked v1**. Recorded: `?post=N` is **NOT** the §9 Reply page (postview is a later surface).
- **OQ-5 = A — THE CONTAINMENT RULING (verbatim):** *"NO ultracode anywhere in A4. Whole vertical single-threaded/gated; no Workflow fan-out, no watchers, kickoff-named subagents only, regardless of the harness flag state."* §8.
- **OQ-6** — copy is web-authored; the empty-state/error/loading string batch arrives in the **execute kickoff**; render tests key `data-testid`. §6.
- **OQ-7 = b** — pins reverted via a **separate micro-chore PR** (parallel); **execute-prerequisite gate:** A4 execute does not start until that PR is merged; execute STEP 0 grep-verifies all `claude-opus-4-8`. §10.
- **F-2** — pre-merge web **GATE C** diff-read on the A4 PR (it edits the masking enforcement point → critical-path). §10, §15.
- **F-3** — acceptance tests adopt the §17-registry names verbatim (kept extras listed §11). §2, §11.
- **F-4** — `loadPriceSeries` downsamples to `DISCOVERY_SERIES_MAX_POINTS` (~64; impl constant). §2, §3.
- **F-6** — reuse/adapt `src/components/debate/PriceBar.tsx` (no fresh `MarketBar`). §2, §4, §13-row-9.

**Deviation record (ruled INTERIM, not drift):** §22 specs Discovery "cached-per-load" (R-2 `'use cache'`); v1 ships uncached (OQ-1 A). Interim, correctness-neutral; the cache lands with the foundational follow-up.

**Errata queue (web-owned; next micro-SYNC — NO spec edit in this task):** E-1…E-3 reserved (web-side); **E-4** — the §22 freshness/`cacheComponents` reconciliation (records the uncached-v1 interim). CLAUDE.md §6 "Fable unavailable" reconciliation rides the OQ-7 re-pin chore, not this task.

**Named follow-ups (out of A4):** (1) cacheComponents foundational task (OQ-1 C + F-5); (2) upgrade hero-post → §9 postview + author → Profile when those surfaces land (OQ-4); (3) agent re-pin chore PR (OQ-7 b).

---

*Plan **v2** — RATIFIED 2026-07-18 (operator). Execution gated on the OQ-7 re-pin chore PR; the F3 single-file plan commit lands on `docs/ui-a4-plan`; the A4 execute PR requires the F-2 pre-merge web gate.*
