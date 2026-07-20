# UI-A5 — Profile — Plan **v2** (RATIFIED · execution pending)

> **Status:** **RATIFIED** (operator-ratified 2026-07-20 · execution pending). Round-1 deltas N-1…N-10 folded; **OQ-1…9 dispositions in §16** (OQ-2 = B conditioned; OQ-9 = A; N-10 deviation ratified). Execution opens as a **fresh** chat from the committed plan.
> **Date:** 2026-07-20 (v1: 2026-07-19; ratified 2026-07-20)
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** Both classifications, stated per ruling: **UI-LANE §2 row A5 = Standard** (a read surface — no writes to auth/bets/ledger/moderation dirs); **the operator Q3 ruling elevates the ritual** — masking is moderation-adjacent and safety-critical per §23, so the viewer-dependent masking / own-visibility / sell-mount slices carry `@security-auditor` + a Gate C pre-merge web diff-read regardless of the Standard row class.
> **Plan PR / commit:** the F3 single-file plan commit on `docs/ui-a5-plan` (this file only; doc-class PR; operator taps on green — OQ-8 A).
> **Governing spec:** SPEC.1 **1.0.18** — **§23 Profile** (F-PROF-1/2/3) + **§10.8** (net-worth / Đb execution basis) + the 11 `profile::*` **§17** rows. Landed at PR #248 (`848e05a`). **No new tables, no new columns, no new event types, no migration, no DDL.**
> **Mode:** plan-mode; session `claude-fable-5` attested; zero `src/` writes, zero commits, zero DDL, zero subagents this chat. Ultracode containment per §8 (Q3, verbatim). Pin law per §9.

---

## Tracker context (UI-LANE §2 row A5, verbatim)

`| A5 | Profile | src/server/profile/ wholesale: positions-across-markets + current value · six tile aggregates · Dharma graph series · argument list · surface build | Standard | SPEC.1 profile · canon §8 row 3 |`

Dependency status at plan time: the named dependency ("SPEC.1 profile") is **DONE** — §23 landed at #248 and is the governing text. Canon §8 row 3 (`surface_profile_v1_0.html`) is committed. The W2.6 portable graph layer is **off-repo** (`~/code/zugzwang/graph-prototype/`) — an execute-prerequisite check, not a plan blocker (§10).

## Approach (one paragraph)

Build the §23 surface end-to-end as a read-time vertical: a pure SideEpisode/Đa engine shared by the staked basis and the graph's gap law; a `src/server/profile/` read model that composes existing primitives (`readBalance`, `computeSell`/pool state, `loadRemovedSet`, `computeMarker`, the §22 price-series replay) into one batched, DTO-mapped profile payload; the ported W2.6 chart components rendering that payload; and a `(public)/u/[pseudonym]` RSC assembling identity, six tiles, graph, positions table, argument list, and the owner-only Sell mount. Nothing writes; nothing is stored; every displayed current value derives from the single §10.8 Đb authority.

---

## 0. Ground (STEP 0 ran at the re-open kickoff, aligned; micro-check re-run at v1 — raw; unchanged for v2)

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `origin/main` (micro-check) | `848e05a` or the #249 squash atop it | **`78a4717`** = the #249 log-errand squash on `848e05a`; no other intervening commit (`git log 4ff2ba3..origin/main` = exactly #248, #249) | ✅ |
| PR #248 / #249 | merged | both `MERGED` (canonical `mergeCommit` reads); the SPEC-PROFILE log errand is **closed** | ✅ |
| SPEC.1 §0 / §23 | 1.0.18 / present | `1.0.18`; `## §23 Profile` at L1494 (after §22, before Appendix A) | ✅ |
| SPEC.2 §0 | 1.0.18 (byte-untouched by #248) | `1.0.18` | ✅ |
| Migration head | 0023 | `0023_positions_market_id_idx` | ✅ |
| ADR ceiling | 0031 (0032 unclaimed) | `0031-durable-bet-receipts…` | ✅ |
| EVENT_TYPES | 24 | 24 | ✅ |
| Recon anchors (`UI-A5-recon.md`) | re-verify lines the plan touches | **scope-proof:** `4ff2ba3..origin/main` touches only `docs/specs/SPEC.1.md` + `docs/logs/SPEC-PROFILE-amendment.md` → zero `src/` changes since the recon ground; every cited file:line byte-identical | ✅ |
| Agent pins | 4 × `claude-opus-4-8`/max | confirmed; session `claude-fable-5` → the §9 pin law governs execute | ✅ carried |
| RTL / jsdom render harness | present | A4 ground table (unchanged since — no src delta): `@testing-library/react` · `jsdom` · per-file `@vitest-environment jsdom` docblock pattern | ✅ |

**§23 is complete for build purposes** — route + edge semantics, read-time-only read model, six tile derivations, the Đa episode basis, graph semantics on the §10.8 basis, §3.6 ordering by reference, the masking law, the owner/visitor payload law, the sell-mount law, and F-PROF-1/2/3 with proposed acceptance paths. Nothing in §23 requires schema/DDL/event-type changes.

---

## 1. Recon — substrate map (cited from `UI-A5-recon.md`, anchors scope-proven; design reads marked ✚)

### 1a. Data substrate — BUILT
- `positions` (`src/db/schema/bets.ts:73–117`): `(user,market,side)` unique · `(user)` index · partial unique one-held-side · CHECK `quantity>=0`. **No cross-market batched read exists** — the profile read model adds one (a query over the existing `(user)` index — **no new index, no DDL**).
- `dharma_ledger` (`dharma.ts:44–103`): `seq` total order (ADR-0029); `readBalance` = latest `balance_after` (`src/server/dharma/persist.ts:29–39`). Issuance rows: `initial_grant` + `daily_allowance`.
- `bets` (buys only; `stake, share_quantity, price_at_bet, side, created_at`; indexed `(user,market)`); **sells write no bets row** — `bet.sold` events ride the **market** aggregate; `payload.userId` is filtered app-side (`sell.ts:24–45`; recon §8). `payout_events` (per-user index) = the settlement substrate.
- `comments` + the join law `bets.comment_id = comments.id` (`ranking-substrate.ts:36–39`); Support/Counter are read-time aggregates over reply-bets.
- `users.pseudonym` UNIQUE NOT NULL (`auth.ts:39`) — the URL key; `banned_at` (`auth.ts:50`) — the D8 label. **Scrub is data, not behavior**, to this surface: a scrubbed row already carries the placeholder pseudonym/PFP; the pre-scrub name no longer exists in `users.pseudonym` → 404 falls out naturally.

### 1b. Server primitives — reuse inventory
- `loadViewerMarketContext` (`viewer-context.ts:37–41`) — the FI-2 Đb basis (`computeSell(quantity).proceeds`) + the A5 inheritance law verbatim. Per-(user,market); the profile composes its own batched variant.
- `loadRemovedSet` (exported, `load-debate-view.ts:281`) — **the ONLY masking input**; `deriveTitleTeaser` (`:357`). Owner-aware composition needs **zero edits** to the enforcement point (recon §4/§7 of the digest; a Gate C input).
- `computeMarker` (`positions/compute.ts:70–78`) — pure; the profile input is **the profile user's** held side per market.
- `loadPriceSeries` (`src/server/discovery/price-series.ts:56–125`) — the §22 pool replay (seed → `bet.placed`/`bet.sold` → `computeBuy`/`computeSell`), downsampled. **§23 mandates reuse, not amendment** — mechanics per OQ-2 (endorsed B, conditioned).
- `loadRankingSubstrate` + `@/lib/ranking` — per-market; the profile argument list needs a per-user substrate (new read model) but **ordering is RANKING.md §3.6 by reference** (posts by attracted `D` desc → replies by own stake desc → posts above replies; viewer-independent; no interleave — already acceptance-covered at §17).
- `SellModule` (`SellModule.tsx:40–47`) — shipped, wired, integration-tested; props `{marketId, slug, position, onClose, onSuspended}`; "MOUNTS AT A5 (ratified OQ-2a)"; **sell never clamped**; its P/L readout now binds to the landed Đa line (defect discharged at #248).
- Session: `(public)/layout.tsx:23–26` pattern (pages re-read); **owner = `session.user.id === profileUser.id`** — zero auth-code change.

### 1c. Seams this build activates
- `PositionStrip.tsx:52` + `SlotHeader.tsx:133` — the W2.10-C click-throughs, "NON-INTERACTIVE until A5 (F-4)".
- `HeroPanels.tsx:117–118` — Discovery hero author `<span>` ("NON-linked v1, OQ-4 A") + `IdentityCluster.tsx:38ff` — header identity chip (`aria-disabled`, "Profile — coming soon"). **A4 follow-up #2.**

### 1d. Design authority (governing; §10.8 supersedes value-basis wording — spec wins) ✚
- **canon §2 Profile** (frozen v0.18 + lock-cycle): two bands — identity card + **six tiles** + graph slot; arena = **Positions** table (`Position · Argument · Staked · Current`; market + Open/Closed filters) + the **argument replica** (D5-synced card anatomy; reply replica keeps its "Replied to …" footer, 2-line clamp) hosting the Sell flow. Owner sees Sell; visitor sees Open; closed unsellable. Titles are the click targets.
- **canon §5 motion (Profile):** Sell slide — the replica footer is a **fixed 50px box**; on Sell it slides down (translateY 110% + fade) and the sell module replaces it over **.26s** — never reflows. Up/Down step the *visible filtered* rows. `:has()` banned → JS-toggled classes.
- **canon §6 copy:** tile labels · columns · `Sell`/`Open`/`Closed` · filters · the sell hint (canon-verbatim, already embedded in `SellModule`). All illustrative-dummy; final strings per §6/OQ-7.
- **W2.6 records** (profile close-out §3 + prototype record): fixed 0–10,000 cumulative Y (= `PROFILE_GRAPH_Y_MAX`), expanded default **Cumulative** + market filter, per-market **autoscale** (structural no-clip `niceMax ≥ max × 1.1`), **nodes = own posts+replies, expanded views only** (node = the locked R2-ring primitive: grey core = own stake, ring = crowd YES/NO split, **BLACK = YES-money on every node**), **flip/exit marker** (node-style circle, swap arrows) at single-market breaks, hard-gap SideEpisode law, free-Dharma line cumulative-only, **placeholder card → fullscreen overlay (state toggle, not a route)**, x-domain **Sep 15 → Nov 5 2026** endpoint labels only, no bucketing, no collision layout. **The records' "mark-to-market" / "shares × price" wording is superseded by §10.8 Đb.**
- **The portable graph layer is OFF-REPO** ✚: `~/code/zugzwang/graph-prototype/` — `chart/` (PostNode, ProfileChart, MarketPositionLine, NetWorthLine, FreeDharmaLine, ProfileNodes, FlipGlyph, MarketFilter, Axes, ChartFrame, geometry, scales, tokens) + `data/types.ts` (the contract). "A port is a real engineering task, NOT a folder copy"; the generator / App shell / overlay chrome must NOT be copied. **Execute-prerequisite check** (§10).
- **Visual reference:** `docs/design/mockups/surface_profile_v1_0.html` (built OUTPUT — reference only, never re-piped; canon §9).

### 1e. `cacheComponents` — still absent (`next.config.ts`) → the §7 S1 disposition.

---

## 2. The build — slices (tests-first; each independently green; all gated per §8)

Vertical, reuse-first. Every slice: **failing tests first (`@test-writer`) → implement → green → reviewer(s)**. No new tables / columns / event types / migration / DDL. Implementation constants land in `src/server/config/limits.ts` only: `PROFILE_SERIES_MAX_POINTS` (§7 S2, OQ-4). `PROFILE_GRAPH_Y_MAX` (10,000) is already a **spec** constant (§16.1 + Appendix B, landed at #248) — code mirrors it with a comment citing the spec row; **no new Appendix B constant is minted by this plan** (§7 S2).

| # | Slice | New/edited (under `src/server/profile/**`, `src/components/profile/**`, `src/app/(public)/u/**` unless noted) | Tests (first) | Reviewer |
|---|---|---|---|---|
| 1 | **SideEpisode + Đa math (pure)** — episode detection over an ordered per-(user,market,side) trade stream (buys from `bets`, sells from `bet.sold`); episode-scoped basis: Σ episode stakes reduced **pro-rata** on every partial sell; full exit closes the episode and zeroes the basis; re-entry opens fresh (§23 verbatim law). **Deterministic merge law (N-3):** merge key = `created_at` ascending across both sources; **cross-source same-timestamp tiebreak = buy before sell** (the only interleave that keeps the running quantity non-negative — the positions CHECK rejects the other order); within-source tiebreak = `id` (UUIDv7, time-ordered) | `profile/episodes.ts` (pure; one machinery, two consumers: Đa + graph gaps) | `tests/unit/profile/episodes.test.ts` — no-sell = Σ stakes · partial-sell pro-rata · full-exit-zeroes · re-entry-fresh-basis · multi-episode stream · **`same-timestamp-interleave` (N-3 fixture)**; `episodes.property.test.ts` (fast-check: basis ∈ [0, Σ episode stakes]; exit ⇒ 0; pro-rata commutation with the §10.3 identity) | `@code-reviewer` |
| 2 | **Profile read model core** — pseudonym resolve (current value; unknown → 404; banned/scrubbed as data) · the **first cross-market batched positions read** (`quantity>0` over the `(user)` index) + per-holding Đb (pool-state `computeSell`) + Đa (S1) · **Argument cell = the episode-opening argument (N-1a, §3)** · closed history (`bets` + `payout_events` + market state; row domain per OQ-3; **closed-row Staked/Current per OQ-9**) · six tile derivations (§23 formulas; Net P/L **lifetime** = net worth − Σ issuance) | `profile/{resolve,positions,tiles}.ts` + DTOs | `tests/server/profile/route.test.ts` — `pseudonym-resolves` · `unknown-404` · `scrubbed-placeholder-resolves` · **`pre-scrub-pseudonym-404` (N-9 named fixture)**; `tiles.test.ts` — `derivations` · `lifetime-net-pl`; `positions.test.ts` — `one-holding-one-value` · `staked-episode-basis-post-partial-sell` · **`argument-cell-episode-opener` (N-1a)** · **`closed-row-derivation` (N-1b, semantics per OQ-9)** | `@code-reviewer` |
| 3 | **Argument list + markers + masking** (safety-critical) — per-user substrate (comments + per-post Support/Counter aggregates) · §3.6 ordering by reference · `computeMarker` on the profile user's held side · `loadRemovedSet` masking (union variant, no-leak-by-construction; **zero edits to the enforcement point**) · §9 ordinal deep-links (a reply → its parent's) | `profile/arguments.ts` | `tests/server/profile/masking.test.ts` — `removed-stub-for-all-viewers-including-owner` · `removed-still-counted`; `markers.test.ts` — `profile-users-held-side`; `arguments.test.ts` — `ranking-3-6-order` · `deep-link-ordinals` | `@code-reviewer` → **`@security-auditor`** |
| 4 | **Graph series derivation** — free-Dharma line (pure ledger replay) · net-worth line (free(t) + Σ Đb(t)) · per-market value lines = `computeSell(shares(t)).proceeds` against replayed reserves (**true `shares(t)` across mid-episode buys** — W2.6 port item 1) · SideEpisode gaps (S1) · node coordinates (§23 node-y law) · x-domain Sep 15 → Nov 5 · downsample per §7 S2. **OQ-2 = B condition honoured:** the export is additive; Discovery semantics byte-preserved; the existing Discovery test suite runs untouched-green as the slice gate | `profile/graph-series.ts` + the additive export seam in `discovery/price-series.ts` (OQ-2 B) | `tests/server/profile/graph.test.ts` — `domain-endpoints` · `sideepisode-gap-law` · `free-dharma-equals-ledger-replay` · `networth-now-equals-wallet-plus-positions` (basis identity at t=now) · `includes-sells` · `mid-episode-buy-shares-t` · `downsample-bound`; **+ the existing `tests/server/discovery/price-series.test.ts` green, untouched** | `@code-reviewer` |
| 5 | **Graph components (the W2.6 port)** — port `chart/` + the `data/types.ts` contract (add `"use client"`, brand tokens `--graph-yes/-no`, R2 ring law, flip marker, `MarketFilter`, fixed-Y cumulative + per-market autoscale, placeholder card → fullscreen overlay state-toggle); **generator / App / GraphOverlay chrome stay behind** | `components/profile/graph/**` | `tests/unit/profile/render/graph.test.tsx` (jsdom) — placeholder 2-label axis · overlay open/close (X/ESC/backdrop) · cumulative default + filter · gap rendering · node-on-line placement · flip-marker-not-a-node · **`nodes-absent-in-placeholder` (N-4)** · **`free-dharma-absent-in-per-market-view` (N-4)** | `@code-reviewer` |
| 6 | **Page assembly + surface** — `(public)/u/[pseudonym]/page.tsx` (RSC, **uncached-dynamic v1** per §7 S1, `notFound()` on unknown) · identity block (PFP / pseudonym / `Banned` label / scrubbed silhouette) · six tiles · positions table (filters; Open/Closed by market state) · argument replica list · loading/empty/error states (canon §4.10, W2.11 kit) | `components/profile/{IdentityCard,ProfileTiles,PositionsTable,ArgumentList,states}.tsx` + the route | `tests/unit/profile/render/*.test.tsx` (jsdom) — band composition · banned label · scrubbed silhouette + zero-PII · removed-stub render (absence of body/title/image) · owner-vs-visitor body identical · states · **Arguments tile renders `N (P Posts \| R Replies)` (N-7)**; **+ the concrete edit (N-2): the existing `id::raw-uuid-not-in-participant-urls` route walk adds `/u/` to its inventory** | `@code-reviewer` → **`@security-auditor`** (own-visibility) |
| 7 | **Sell mount + W2.10-C activation** — owner-only `SellModule` in the replica footer (canon §5 slide, fixed 50px, .26s); sellable **iff** market `Open` ∧ `quantity>0`; the visitor payload **never** carries Sell; `PositionStrip`/`SlotHeader` activate → `/u/<own>` (target shape per OQ-5) | `components/profile/**` + `components/debate/{PositionStrip,SlotHeader}.tsx` (surgical link-wrapping only) | `tests/server/profile/owner.test.ts` — `visitor-payload-excludes-sell` · `sell-only-open-and-held`; render — footer-slide mount · closed/resolved rows render `Closed`, no Sell | `@code-reviewer` → **`@security-auditor`** (sell mount) |
| 8 | **Nav links (A4 follow-up #2)** — `HeroPanels` author span → `<Link href="/u/[pseudonym]">`; `IdentityCluster` chip → own-profile link | `components/discovery/HeroPanels.tsx` + `components/shell/IdentityCluster.tsx` (surgical) | render — links resolve; aria fixed; a removed hero post's author never renders (existing masking — assert no dead link) | `@code-reviewer` |

**Slice ordering rationale:** pure math (1) → data authority (2–4) → presentational port (5) → composition (6) → viewer-dependent affordances (7) → cross-surface links (8). Slices 3/6/7 are the Q3-named `@security-auditor` gates. Each slice ends green (`ZUGZWANG_ENV=preview just verify` + the relevant suites, §15). Acceptance names are the §17-registry verbatim set (§11).

---

## 3. Read-model design (§23 mechanisms — read-time only, no store, no DDL)

- **`resolveProfileUser(client, pseudonym)`** — `users` by **current** `pseudonym` (UNIQUE); returns identity + `banned_at` label + scrubbed rendering inputs; `null` → 404 (a retired pre-scrub pseudonym 404s — N-9 names the fixture). Raw UUIDs never accepted (D6; the §17 `id::raw-uuid-not-in-participant-urls` regex extends to `/u/` — N-2).
- **`loadProfilePositions(client, userId)`** — one batched read: open rows (`quantity>0`) + market rows (question/state/slug) + per-market pool state → **Đb** per holding (`computeSell`, the single FI-2 authority); **Đa** per holding via S1 episodes (`bets` + per-market `bet.sold` scans filtered by `payload.userId` app-side — bounded per market, recon §8); closed history per OQ-3/OQ-9. **Argument cell (N-1a):** each row carries the **current episode's OPENING argument** — the comment riding the episode-opening bet; a closed row carries the **final** episode's opener; a **reply** opener renders with its "Replied to …" context and clicks through to the **parent's** ordinal — discharging §23's "for reply-bets — the parent post reference" clause at row level. **Closed rows (OQ-9 rec):** Staked = the final episode's Đa at close; Current = net Σ `payout_events` for that (user, market) (`bet_payout` + `void_refund` + correction pairs netted); row P/L = Current − Staked. **Basis identity is structural:** the DTO carries ONE `currentValue` per open holding, consumed by the tile Σ, the table column, and graph-now — `one-holding-one-value` asserts equality end-to-end.
- **`loadProfileTiles`** — §23 formulas: `readBalance` (Wallet) · Σ Đb (Positions value) · lifetime Net P/L = net worth − Σ issuance ledger rows · argument counts (**removed counted**) · Σ `support_dharma`/`counter_dharma` over top-level posts (**removed posts' attracted Đ counted**).
- **`loadProfileArguments`** — the user's comments + reply-bet aggregates; §3.6 order by reference (consume `@/lib/ranking` primitives where they fit; the §3.6 comparator is profile-local); markers via `computeMarker`; masking via `loadRemovedSet` → a removed union variant carrying **no body/title/image fields** (leak = compile error — the `load-debate-view` pattern); deep-link ordinals (reply → parent's; removed target → the §9 silent fallback).
- **`loadProfileGraphSeries`** — the §23 derivation stack (Slice 4) with the §7 S2 cost bound + downsampling.
- **Owner detection** — `session.user.id === profileUser.id` at the RSC. Owner-only fields (sell-eligibility flags) exist **only** on the owner DTO; the visitor DTO type carries no sell affordance at all — F-PROF-3 is asserted at the DTO boundary, then at render.
- **Invariant posture:** read-surface — INV-1/2/4 untouched (no writes); INV-3 honoured by rendering `side_at_post_time` frozen; the Closed/frozen sell law honours resolution immutability; Đa is **display-basis only** (R-9.8 settlement attribution unchanged — §23 verbatim). No §1 critical-path directory is edited; `SellModule` + `/api/bets/sell` are consumed **as shipped** (zero wire changes). Any discovered need to edit a critical-path dir → STOP, surface (the full ritual would attach; not planned).

---

## 4. Component & wiring design

- **`IdentityCard`** — PFP + pseudonym; `Banned` label (visible to all); scrubbed → placeholder + silhouette, zero PII. **The mockup's headzone bookmark/download icons are omitted v1** — bookmark arrives at A6 (fence §14); the download icon is dead-visual (canon §10 item 2, stays cut). *(Ruled deviation recorded at §16 per N-10.)*
- **`ProfileTiles`** — six tiles, canon §6 labels, 3×2; values from `loadProfileTiles` (all Đ figures server-formatted strings — no float math client-side); the Arguments tile renders `N (P Posts | R Replies)` (N-7 assert).
- **`PositionsTable`** — columns `Position · Argument · Staked · Current`; market filter + Open/Closed filter (client state over the server DTO; OQ-5 may seed the market filter from `?market=`); Up/Down row stepping per canon §5; `Sell`/`Open`/`Closed` affordance cell (Slice 7 mounts Sell for the owner). **The Argument cell renders the episode-opening argument per §3 (N-1a)** — title as the click target (→ the post's ordinal; a reply opener → its parent's ordinal, with the "Replied to …" context line).
- **`ArgumentList` / `ArgumentCard`** — the D5-synced replica anatomy (side chip · title-as-click-target · stake → current · Support/Counter footer aggregates; reply replica carries the 2-line-clamped "Replied to …" footer). **Build-time reuse check (A4 F-6 pattern): adapt the existing debate-view card component if exportable before authoring a profile-local replica.** Removed items render the stub variant.
- **Graph** — `ProfileGraphCard` (placeholder net-worth line, whole card clickable) → `ProfileGraphOverlay` (fullscreen state toggle; X/ESC/backdrop close) hosting the ported `ProfileChart` + `MarketFilter` + lines/nodes/flip-marker primitives (Slice 5).
- **`SellMount`** — the fixed-50px replica-footer host wrapping the shipped `SellModule` (props from the positions DTO: `{marketId, slug, position, onClose, onSuspended}`); canon §5 slide motion; owner + `Open` ∧ held only.
- **Wiring** — `(public)/u/[pseudonym]/page.tsx` (RSC): `resolveProfileUser` → parallel read-model loads → DTOs down to the leaf components; owner flag from the session read; **uncached-dynamic v1** (§7 S1). `params` is a Promise (Next 16). Edited seams (Slices 7–8): `PositionStrip`, `SlotHeader`, `HeroPanels`, `IdentityCluster` — surgical link/mount wrapping only.

---

## 5. Surface-state coverage (render-tested via the jsdom harness — canon §4.10, W2.11 primitives)

| State | Render assertion |
|---|---|
| Visitor (anon & authed non-owner) | identical body; no Sell anywhere; visitor view chip |
| Owner | + Sell on eligible rows only; body otherwise identical (F-PROF-3) |
| Banned profile user | `Banned` label visible to all; history intact |
| Scrubbed profile user | placeholder pseudonym + silhouette; zero PII; history intact |
| Removed comments | stub for every viewer incl. owner; still counted in tiles; order intact |
| Zero positions / zero arguments | empty states (strings = OQ-7 batch; `data-testid` keyed) |
| Closed/Resolving/Resolved/Voided/Frozen holdings | `Closed` classification; unsellable; values per OQ-9 |
| Loading / error | skeleton + error state (W2.11 kit) |
| Graph: no activity | placeholder at the issuance baseline; empty expanded states |
| Graph: single market, mid-episode | gap law + node placement fixtures |

## 6. Copy inventory (canon §6 verbatim vs to-author)

**Usable verbatim (illustrative-dummy):** tile labels (`Wallet value · Positions value · Net profit / loss · Arguments · Total Support received · Total Counter received`) · columns `Position · Argument · Staked · Current` · `Sell`/`Open`/`Closed` · filters (`Select market ▾`, `Open`/`Closed`) · the sell hint (already embedded in `SellModule`) · the replica reply-footer format. **Reused existing string:** the removed-stub copy ships in the debate-view masking variant — same constant, not re-authored.
**Modified from the mockup (N-8):** the view chip — the demo **"V toggles" hotkey text is stripped** (a mockup demo affordance, not product copy); the final owner/visitor chip string rides the OQ-7 batch.
**Web-authored at execute (OQ-7; CC never invents — CLAUDE.md §3):** empty-state strings (no positions / no arguments / visitor variants) · error/loading microcopy beyond the W2.11 primitives · the view-chip strings (N-8) · any graph-overlay labels beyond the axis endpoints. Render tests key `data-testid`, never final strings.

## 7. Dispositions (the two issued seed notes — mandatory content)

**S1 — `/u/` inherits the A4 uncached-v1 interim (stated as a plan invariant, mirroring the A4 §7 disposition).** `cacheComponents` is absent from `next.config.ts`; no `'use cache'` exists anywhere in the repo. The profile page ships **UNCACHED / dynamic** — no flag flip, no per-scope caches. The read model is correct either way; caching is a freshness/cost optimization owned by the already-named **"cacheComponents foundational task"** (A4 OQ-1 C), which now covers **both** surfaces' retrofit (+ the A4 F-5 TTL consideration). Not silently assumed either way; OQ-1 asks web to confirm the posture (endorsed at round 1).

**S2 — graph replay cost bound + downsampling (named explicitly).** Cost per profile render ≈ **one Discovery price-series render per touched market** (recon §8: `price(t)` = the §22 pool replay per market; `shares(t)` = the user's `bets` rows + a per-market `bet.sold` aggregate scan filtered by `payload.userId` app-side — no payload index, bounded by per-market event volume) + one per-user ledger scan (free-Dharma line — `balance_after` is the running total, exact and cheap). Touched markets are discovered via `bets_user_market_idx`. **Downsampling holds the payload:** each served line is thinned server-side to ≤ **`PROFILE_SERIES_MAX_POINTS`** — a **new implementation constant** in `config/limits.ts` (~64, the A4 F-4 pattern), proposed instead of reusing `DISCOVERY_SERIES_MAX_POINTS` so the two surfaces stay separately tunable (OQ-4, endorsed). **Flagged, not minted: no new Appendix B / §16.1 constant** — `PROFILE_GRAPH_Y_MAX` already exists spec-side (landed at #248) and code mirrors it; if web prefers the series bound spec-side instead, that is a spec amendment web authors, not this plan.

## 8. Ultracode containment — the Q3 mode law (verbatim, binds every A5 CC leg incl. execute)

> "NO ultracode anywhere in A5. Whole vertical single-threaded/gated; no Workflow fan-out, no watchers, kickoff-named subagents only, regardless of the harness flag state. @security-auditor gates the viewer-dependent masking / own-visibility / sell-mount slices at execute. Gate C pre-merge web diff-read on the A5 execute PR."

Every slice (1–8) runs the gated plan→execute + named-reviewer cascade; no fan-out at any point. This chat held containment: zero Workflow calls, zero subagents, zero watchers, single sequential pass.

## 9. Cut point + the pin law (execute-kickoff carries)

**Pin law (ruled this lane, carried verbatim into the execute kickoff):** *"session model ≡ the four agent pins before any subagent call; explicit per-Agent-call model overrides are the named fallback."* Execute STEP 0 attests the session model and greps the four pins before Slice 1's `@test-writer` invocation; on divergence, the kickoff-mandated fallback (per-call `model` overrides) applies — a subagent invoked against an unreachable pin dies at 0 tool_uses (standing lesson).

**Cut point (N-6 — one branch, one PR).** The whole vertical lands as **ONE branch, ONE PR** — there is **no intermediate dark merge** (any such merge would be its own Gate C read; not planned). **Slice 6 (page assembly)** remains the designated *session* cut point: Slices 1–5 are self-contained data/presentational strata (each green on the branch; no route exposes them), 6–8 expose the surface and activate seams. If the execute session must split, the next session **resumes the same branch** with the ritual unchanged (same cascade, same gates, no gate flex); the single PR opens only when the vertical is complete and self-audited.

## 10. Reviewer cascade (§5.11) + the web gate

`@test-writer` (Phase-2 start, every slice; always passed `@docs/plans/UI-A5.md`) → implement → `@code-reviewer` (every `src/server/**` + `src/components/**` diff) → **`@security-auditor`** on Slices 3, 6, 7 (masking / own-visibility / sell mount — the Q3-named set). **No `@db-migration-reviewer`** (zero schema/migration). **Gate C:** a pre-merge web diff-read on the A5 execute PR before the operator squash-merges (Q3).
**Execute-prerequisite checks (execute STEP 0):** pin law (§9) · `~/code/zugzwang/graph-prototype/` exists with the §1d `chart/` + `data/types.ts` inventory (absent → STOP, operator locates) · **`loadRemovedSet` verified free of any internal market-scoped filter — cross-market composability (N-5)** · the OQ-7 copy batch present in the kickoff · silhouette asset for scrubbed PFP verified (absent → surface, don't invent).

## 11. Test plan — §17 registry mapping (names verbatim; §23's proposed paths confirmed)

| §17 row | Test path (this plan) |
|---|---|
| `profile::route-pseudonym-resolves` | `tests/server/profile/route.test.ts::pseudonym-resolves` |
| `profile::unknown-pseudonym-404` | `route.test.ts::unknown-404` (+ `::pre-scrub-pseudonym-404`, N-9) |
| `profile::scrubbed-pseudonym-resolves-placeholder` | `route.test.ts::scrubbed-placeholder-resolves` |
| `profile::tile-derivations` | `tiles.test.ts::derivations` (+ `::lifetime-net-pl`) |
| `profile::one-holding-one-value` | `positions.test.ts::one-holding-one-value` |
| `profile::staked-episode-basis-post-partial-sell` | `positions.test.ts::staked-episode-basis-post-partial-sell` |
| `profile::graph-domain-and-gap-law` | `graph.test.ts::domain-endpoints` + `::sideepisode-gap-law` |
| `profile::removed-masked-for-all-viewers-and-counted` | `masking.test.ts::removed-stub-for-all-viewers-including-owner` + `::removed-still-counted` |
| `profile::marker-uses-profile-users-held-side` | `markers.test.ts::profile-users-held-side` |
| `profile::visitor-payload-excludes-sell` | `owner.test.ts::visitor-payload-excludes-sell` |
| `profile::owner-sell-only-open-and-held` | `owner.test.ts::sell-only-open-and-held` |

Extras kept: the episodes unit + property suite (incl. `same-timestamp-interleave`, N-3) · `argument-cell-episode-opener` (N-1a) · `closed-row-derivation` (N-1b/OQ-9) · `ranking-3-6-order` · `deep-link-ordinals` · `free-dharma-equals-ledger-replay` · `networth-now-equals-wallet-plus-positions` · `includes-sells` · `mid-episode-buy-shares-t` · `downsample-bound` · `nodes-absent-in-placeholder` + `free-dharma-absent-in-per-market-view` (N-4) · the Arguments-tile format assert (N-7) · the §5 render matrix. **Concrete edits to existing suites (N-2, OQ-2 B condition):** the `id::raw-uuid-not-in-participant-urls` route walk adds `/u/` to its inventory; the existing Discovery price-series suite must pass **untouched**. Layers: unit (pure math, jsdom render) · server/DB-backed (read models, real Postgres :54322) — no Playwright (not installed). Fixtures reuse shipped prose — **no invented market content** (canon §3.8). Thesis-touching TDD drivers (§5.6): the read model, tiles, Đa episode math, graph basis.

## 12. Open questions — RESOLVED (operator-ratified 2026-07-20; dispositions folded in §16)

*OQ-2's ratification carries a condition: **B with Discovery semantics byte-preserved and its existing tests untouched-green** (folded into Slices 4/§11).*

| # | Question | Options | Recommendation | Disposition |
|---|---|---|---|---|
| OQ-1 | `cacheComponents` posture | confirm §7 S1 as stated | **Confirm §7 S1** — uncached-dynamic v1; the A4-named foundational follow-up owns both surfaces' retrofit | ratified |
| OQ-2 | §22 replay reuse mechanics | **A** — parallel walk · **B** — additive export of the stepwise reserve walk | **B** — one replay authority (A4 OQ-3-B precedent) | **ratified (conditioned)** — see §16 |
| OQ-3 | Closed-history row domain | **A** — open + terminally-settled only · **B** — every ever-touched market | **A** — §23 classifies by market state; an exited open market has nothing to value or settle | ratified |
| OQ-4 | Series downsample bound | **A** — reuse `DISCOVERY_SERIES_MAX_POINTS` · **B** — new `PROFILE_SERIES_MAX_POINTS` impl constant | **B** — separately tunable; impl constant, not spec (§7 S2) | ratified |
| OQ-5 | W2.10-C click-through target | **A** — plain `/u/<own>` · **B** — `/u/<own>?market=<slug>` preselect | **B** — preserves the clicked market's context | ratified |
| OQ-6 | Expanded-graph data delivery | **A** — ship with the RSC payload · **B** — fetch on first open | **A** for v1 — bounded (§7 S2); B is the load-test follow-up | ratified |
| OQ-7 | Copy batch | — | Web authors the §6 to-author list (now incl. the N-8 view-chip strings); arrives **in the execute kickoff**; `data-testid` keys | ratified |
| OQ-8 | Plan-commit branch | **A** — `docs/ui-a5-plan` F3 · **B** — fold into execute branch | **A** — the ratified plan lands alone | ratified |
| **OQ-9** | **Closed-row Staked/Current semantics (N-1b)** | **A (web rec)** — Staked = the final episode's Đa at close; Current = **net Σ `payout_events`** for that (user, market) (`bet_payout` + `void_refund` + correction pairs netted); row P/L = Current − Staked · **B** — closed rows show Staked only; Current = "—", P/L omitted | **A** — renders the settled outcome in the same two-column vocabulary; coupled to **OQ-3 A** (rows exist only where a settlement exists, so `payout_events` is always populated for a closed row) | **ratified A** |

## 13. Self-critique (ranked; findings kept per template — do not delete after addressing)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | `shares(t)` fidelity — the W2.6 prototype held shares constant per episode; a naive port ships wrong per-market value lines. | Named port item: Slice 4 computes true `shares(t)` from `bets` + `bet.sold`; explicit `mid-episode-buy-shares-t` fixture; §2/§11. |
| 2 | **high** | Sell affordance could leak into a visitor payload via a shared DTO shape. | Structural: the visitor DTO type carries no sell fields; asserted at the DTO boundary + render absence; `@security-auditor` on Slices 6/7. §3. |
| 3 | **high** | Removed-comment content could leak through the profile argument list (a second masking surface). | The union-variant pattern (no content fields on the removed variant — compile-level no-leak) + zero edits to the audited enforcement point; server + render assertions; `@security-auditor` on Slice 3. §3. |
| 4 | **medium** | Two replay implementations (Discovery + profile) could drift if OQ-2 = A. | OQ-2 = B endorsed (one exported walk) **with the byte-preservation condition**; the existing Discovery suite green-untouched is the slice gate. §2/§11/§12. |
| 5 | **medium** | Per-user `bet.sold` scans have no payload index — cost concern on hot profiles. | Honest bound stated (§7 S2, ~one Discovery render per touched market); bounded by per-market event volume; load-test sweep owns deeper analysis (W2.6 port item 6). |
| 6 | **medium** | One uncached RSC assembles tiles + table + arguments + all graph series — heavy first paint. | Bounded per §7 S2 + the placeholder→overlay render-tree deferral (most of the win, W2.6); OQ-6 keeps data-defer as the named follow-up; the cacheComponents task amortizes. |
| 7 | **medium** | Đa episode math is new money-adjacent arithmetic (display-only, but user-visible). | Pure module, TDD-first with property tests (Slice 1); CpmmDecimal-consistent decimal handling; display-basis-only stated (R-9.8 untouched). §2. |
| 8 | **medium** | The graph port could drag prototype scaffold (synthetic generator) into production. | Fence: only `chart/` + `data/types.ts` enter, rewired behind real queries; generator/App/GraphOverlay stay behind (W2.6 §4 verbatim); execute-prerequisite dir check. §10. |
| 9 | **medium** | Scrubbed-user rendering assumes a silhouette asset + placeholder PFP exist. | Scrub is data to this surface (fixtures simulate); asset existence is an execute STEP 0 verify — absent → surface, don't invent. §10. |
| 10 | **medium** | Cross-source timestamp ties (a buy and a sell in the same millisecond) could nondeterministically reorder the trade stream. | The N-3 merge law: `created_at` asc; cross-source tie → buy-before-sell (the only quantity-non-negative interleave); within-source tie → `id` (UUIDv7). `same-timestamp-interleave` fixture pins it. §2 Slice 1. |
| 11 | **low** | Marker freeze after resolution (F-DEBATE-3) might seem to need a snapshot. | Free: positions are immutable once a market leaves Open, so read-time `computeMarker` is inherently frozen (the spec's own reasoning). |
| 12 | **low** | `PROFILE_GRAPH_Y_MAX` value drift between spec and the mirroring TS constant. | Comment cites the §16.1 row; a pin test at build if cheap (tokens-test pattern). |
| 13 | **low** | Reply deep-links need the parent's ordinal (extra lookup). | Substrate carries `parent_comment_id`; ordinal derivation reuses the A2 mechanism; removed target → the §9 silent fallback. §3. |
| 14 | **low** | W2.10-C activation touches debate-view components. | Surgical link-wrapping only; no composer/slot logic edits; covered by render tests. §2 Slice 7. |
| 15 | **low** | Copy invention risk (empty states, view chip, overlay labels). | OQ-7 — web-authored batch at the execute kickoff (incl. the N-8 view-chip strings); `data-testid` keys. §6. |
| 16 | **low** | Session model ≠ agent pins at execute could kill the cascade silently. | The §9 pin law (ruled) + execute STEP 0 attestation; per-call overrides as named fallback. |

## 14. NOT doing (scope fence)

**A6 bookmarks** (the §23 forward sentence exists; **build nothing** — no bookmark mode, no icon wiring) · **Daily-Credit-history page** (parked; the §23 pointer only) · leaderboard (own surface; §10.8 vocabulary lands with it) · debate-view **card** author links (only the two named A4-follow-up seams + W2.10-C activate; card-head links = a named follow-up) · **Discovery test-id rename** (docketed: next Discovery `src` touch) · **§16.2 Track A row oddity** (MAINT) · `cacheComponents` flip (the foundational follow-up owns it) · spec edits (§23 is the authored anchor) · ranking-model edits (RANKING.md / ADR-0017 consumed as-is) · profile-card JPEG (stays cut) · dead download icon wiring (canon §10 item 2 — omitted v1) · **tracker v18** (A5 close / Session-B fork) · the **standing set** (`stash@{0}` · PR #146 · parked SPEC.2 bundle · `[gone]` sweep · AGENTS §9 drift) · commits beyond the ratified F3 plan commit (this chat) and the execute-leg PR flow.

## 15. Verification gate (per slice + pre-PR + pre-merge)

`ZUGZWANG_ENV=preview just verify` → `pnpm test:integration` → `pnpm vitest run` (full-suite floor) per slice — unpiped, exit codes captured; DB-backed suites against local Postgres :54322 (`pnpm vitest run` directly, not `just`) → §5.10 self-audit (item-by-item vs this plan) → the §10 reviewer cascade. **One branch, one PR (N-6):** the vertical accumulates on its single execute branch; a session split resumes the same branch; no intermediate dark merge (any such merge would be its own Gate C read — not planned). The PR opens only on a clean audit; **pre-merge: Gate C** web diff-read (Q3), then the operator squash-merges.

---

## 16. Ratification record (operator-ratified 2026-07-20)

All OQ-1…9 ratified by the operator on **2026-07-20**; applied exactly, no re-litigation.

**Rulings folded:**
- **OQ-1** — §7 S1 confirmed: `/u/` ships **uncached-dynamic v1**; the cacheComponents foundational task (A4 OQ-1 C) now covers the **Discovery + Profile** retrofits (+ the A4 F-5 TTL consideration).
- **OQ-2 = B (conditioned)** — additive export of the stepwise reserve walk from `discovery/price-series.ts`; **Discovery semantics byte-preserved; the existing Discovery test suite passes untouched-green** — the Slice 4 gate.
- **OQ-3 = A** — closed rows = terminally-settled participations only; a fully-exited, still-Open market carries no positions row (its record lives in the argument list + graph).
- **OQ-4 = B** — `PROFILE_SERIES_MAX_POINTS` implementation constant in `config/limits.ts` (~64, A4 F-4 pattern). **A spec-side series bound was DECLINED — the impl constant stands** (no new Appendix B / §16.1 row).
- **OQ-5 = B** — the W2.10-C click-throughs target `/u/<own>?market=<slug>` (positions market-filter preselect via searchParams).
- **OQ-6 = A** — all series ship with the RSC payload v1 (placeholder→overlay defers the render tree only); **B (data-defer on first overlay open) rides the load-test sweep** (W2.6 port item 6).
- **OQ-7** — the copy batch (empty states · the N-8 view-chip strings · overlay labels) is **web-authored and arrives in the execute kickoff**; render tests key `data-testid`, never final strings.
- **OQ-8 = A** — this F3 single-file plan commit on `docs/ui-a5-plan`; execute references `@docs/plans/UI-A5.md`.
- **OQ-9 = A** — closed-row **Staked = the final episode's Đa at close**; **Current = net Σ `payout_events`** for that (user, market) (`bet_payout` + `void_refund` + correction pairs netted); **row P/L = Current − Staked**. Coupled to OQ-3 A.

**Deviation record (ruled — N-10):** the identity-card headzone **bookmark/download icons are omitted** (the remove branch; canon §10 item 2): bookmark arrives at A6; the download icon stays cut. A ruled mockup deviation, not drift.

**Named follow-ups (out of A5):** (1) debate-view **card-head author links** (A5 activates only the two A4-follow-up seams + W2.10-C); (2) the **cacheComponents foundational task** — now covering the Discovery **and** Profile uncached-v1 interims (+ F-5); (3) **OQ-6 B expanded-graph data-defer** — measured at the load-test sweep; (4) spec-side series bound **declined** — `PROFILE_SERIES_MAX_POINTS` stands as an implementation constant.

**Carries into the execute kickoff:** the §8 Q3 mode law (verbatim) · the §9 pin law (verbatim) · the §10 execute-prerequisite checks · the OQ-7 copy batch.

---

*Plan **v2** — **RATIFIED 2026-07-20 (operator)**. Round-1 deltas N-1…N-10 + the OQ-1…9 dispositions folded (§16); drafted against `main` @ `78a4717` (SPEC.1 1.0.18 §23); shape per `docs/plans/_template.md` mirrored onto the ratified UI-A4.md architecture. The F3 single-file plan commit lands on `docs/ui-a5-plan`; the execute chat opens FRESH from the committed plan, carrying the §8 mode law + the §9 pin law verbatim.*
