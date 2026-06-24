# DEBATE.4 — Participant Debate View (read-only render) — PLAN

> **Status:** APPROVED (web Claude), rulings folded — ready for a FRESH execute chat.
> **Stratum:** DEBATE.4 · **Surface:** the single-market participant debate view, composed INTO the SHELL shell, replacing the `(public)/m/[slug]` placeholder.
> **Critical path** (CLAUDE.md §1: `src/server/comments/`-adjacent read-models + a public render + removal-masking). Full ritual incl. `@security-auditor` (REQUIRED).
> **Boundary:** READ-ONLY RENDER (C1). The mockup is write-integrated; the read/write boundary is load-bearing — see §3 / §10.
> **Execute branch:** `feat/debate-view-4` (this plan commits on its own `chore/` branch; execution is a separate PR, per the SHELL/UI.0 #160→#161 precedent).
>
> **Recon base:** `origin/main @ e067c16` (SHELL/UI.0, #161). Migration head `0018`. Read-models confirmed present: `loadRankingSubstrate`, `listMarketComments`, `ranking.ts` (`buildTopList`/`badgeFor`/`rankReplies`/`twoSlot`), `computeMarker`. Reply-substrate indexes (`comments_ranking_idx`, `bets_comment_id_idx`) exist → **no migration**.
> **Design authority:** `surface_d5_v1.0.html` (locked v1.0 mockup, operator-provided), `docs/design/design-language.md` (§1.3/§2.1 side binding, §3.1 primitives, §4 state-shape, §6 debate-view conventions), `DESIGN-spec-changes-consolidated.md` §1 (LOCKED column/relation axis — supersedes design-language §1.3/§6), `docs/specs/RANKING.md` §5.3 (Top-only, no selector, badges), ADR-0020/0021 (removal-masking), `docs/design/design-handoff.md` §4 (build brief).
> **Copy:** `DESIGN-copy-register-consolidated.md` — operator provides at execute (D12). The load-bearing aggregate copy (`Support (count) : Đ / Counter (count) : Đ`) is already settled (design-language §3.1 + kickoff).

---

## 1. Approved rulings (folded — these are now DECIDED, not open)

### ★ D1 — Market-view header: SHIP WITH PLACEHOLDERS
`markets` has only `title / description / status / resolutionDeadline` (+ `pools` reserves).
- **Backed → build:** question = `markets.title`; **resolution criterion = `markets.description`** (confirmed via `markets/create.ts` R-14.4: "resolution criterion → `description`"); status/lifecycle = `markets.status`; price-bar = `getPrices(pool reserves)`; attrs (Đ staked · posts · replies) = a new small aggregate query.
- **UNBACKED → explicit deferred placeholders** (SHELL placeholder discipline): **resolver cards**, **market media** (img/video), **price-graph history**.
- **Do NOT** add market-content columns; **do NOT** invent copy (§3 market-content-invention refusal).
- **Future-work notes (record only):** resolver cards + market media = a future **market-content schema slice + SPEC.1 amendment**; price-graph history = a future **ledger-replay read-model** (reconstructable from `bets.price_at_bet` / `bet.placed` events — no schema, not built here).

### ★ D7 — Author-bet enrichments: DEFER BOTH `@entry%` and `→now`
The argprofile / focus-header renders **frozen side badge + author stake `a`** (`PostSubstrate.authorStake`) only. **Omit the `@entry%` and `→ now` readout cleanly** — NOT a half-rendered placeholder. Consequence: the side chip shows just the SIDE (`YES`/`NO`), not `YES @ 27%`; the stake shows `Đ <a>`, not `Đ a → Đ now`.
- **Deferral notes (write-slice / follow-up):** `@entry%` needs the author's entry-bet `price_at_bet` (a cheap substrate LATERAL extension); `→now` needs a live position-valuation compute (no read-model; undefined for an Exited author).

### ★ D5 — Position marker placement: CONFIRMED
Monochrome marker chip **after the side badge, before the stake**. `Flipped` / `Exited` render a chip; **`none` → no chip** (default). Maps `DebateComment.marker` (`computeMarker`). Follow `design-language §4.2` if it later specifies exact placement (it currently does not beyond "no marker is the default").

### ★ D6 — Comment title/body: CONFIRMED read derivation
Against the **single `comments.body` column**: card-title = **first line, ≤125 chars** of `body`; teaser = **next paragraph**; pop-up = **full `body`**.
- **Flag (the one coupling point):** the title-source is the only place to revisit **if the write slice adds a `comments.title` column**. **Do NOT pre-empt the storage model** here.

### Sub-decisions (CONFIRMED)
- **§6 removed-comment masking:** MANDATORY — `body` / derived title / image **never serialize** to the client (discriminated-union view-model + server-side withholding). **ALSO withhold author identity** (pseudonym / PFP) on a removed comment. Structural **survives**: the column slot + frozen side badge + reply aggregate + the replies (thread intact). `users.bannedAt` does **NOT** mask — **only** `mod_actions.reason = 'content_removed'`.
- **§7 disabled-but-present:** write **triggers** render present-but-disabled (`aria-disabled`, no handlers); composer modules + slippage modal + auth-out gate are **not rendered**; the viewer's own colhead position → **"No active position" stub** (DEBATE.4 is a public, viewer-independent render).
- **Tests:** server-boundary masking tests are **sufficient** for the body-not-serialized guarantee — **do NOT add a DOM/RTL dependency**. Render-level checks ride the manual staging-walk. A DOM-test-util is a UI-lane-sweep decision, not this task.

---

## 2. Non-gated deviations — APPLIED (flagged for the record)

- **D2** — `design-language §6/§3.2/§5` "selectable modes" + "Debate mode selector" is **STALE**. Per `RANKING.md §5.3` + ADR-0017 P3: **Top-only, NO selector**; Most Debated / Highest Stakes / Contested are **BADGES**. Build no selector; render per-post `badgeFor`.
- **D3** — Column/relation axis: build from the **LOCKED `DESIGN-spec-changes-consolidated.md` §1**: columns are **fixed poles LEFT=YES / RIGHT=NO**; **Support/Counter is post-relative** (split-bar + composer), never a column label. Replies route to a column **by their own frozen side**; Support = reply side == post side. *(The repo's `design-language §1.3/§6` may still read "YES(Support)/NO(Counter)" — committing the v0.4-draft correction is **sweep doc-debt, not this task**.)*
- **D4** — `design-language §4.7` "Track-B admin-only inline / held-queue" is **STALE**. Per ADR-0021: no held queue; Track-A/B never persist; **`content_removed` is the ONLY render-time masking**.
- **D8** — PFP `pfpFilename → URL` is unbuilt (onboarding uses static `/pfp-placeholder.svg`). Use that placeholder; real PFP (R2 "pfp" bucket or static asset) deferred.
- **D9** — Comment image: mint a presigned GET via `signRead(r2ObjectKey, 3600)` (the seam already tags "DEBATE.4 render path, 3600s TTL"), **server-side**, one per image. Note the per-render minting cost.
- **D10** — The mockup's inline auth-out composer gate ("Sign in to bet") is superseded by W2.1-E (act-gate → picker at UI.2). Composer is OUT here → not built.
- **D11** — Data volume: **load-all** posts + replies server-side for v1 (bounded per market); client-side scrollers page through them. Revisit pagination if a market grows large.
- **D12** — Copy register absent at plan time (operator provides at execute). Aggregate footer = **`Support (count) : Đ / Counter (count) : Đ`** (all four from `loadRankingSubstrate`), per design-language §3.1 + kickoff — enriches the mockup's Đ-only footer.

---

## 3. Scope boundary (C1 — read-only render)

**IN (build):**
- Both header modes (market-view / post-view) + the `enterPost`/`exitPost` toggle (read).
- Two-column arena (LEFT=YES, RIGHT=NO) with post-scroller (pages posts one at a time) + reply-scroller (read pagers).
- Post cards: argprofile (avatar / pseudonym / **frozen side badge** / **marker** / author stake `a` / replies-count / disabled bookmark+download) + argument title + teaser + image + **read-time aggregate footer** + **lane badge**.
- Reply rows: two-slot default (top Support + top Counter, placed by side) + **expand to the full stake-sorted list** (reply-scroller).
- Post pop-up ("+" → full body, read) + image lightbox (read) + empty-side CTA.
- **Render-time removal-masking (the GATE — §6).**
- Lifecycle marker + read-only treatment for terminal markets (INV-4).

**OUT (deferred to the composer write-slice):** Buy/Sell (`pick`), Support/Counter **triggers** (`rbtn2`/`openReply`/`replyToPost`), composer **modules** (textareas / image-attach / amount / `Place Đ BET`), the slippage modal (F-BET-9), the auth-out gate, the viewer's own live position/To-win readout. Treatment per §7.

**Invariant-visual obligations (non-optional — design-language §4 / build-brief §4):** frozen YES/NO side badge on every post & reply (never changes); marker none/Flipped/Exited (none = default); **NO vote affordance anywhere** (no up/down, no friendly-fire; no comment-free affordance introduced); resolved/voided/frozen render read-only.

---

## 4. Component breakdown (mapped to SHELL components + tokens)

New dir `src/components/debate/`. The route file (RSC) fetches; one client boundary owns the toggle / scrollers / pop-up / lightbox.

| Component | Kind | shadcn / token mapping |
|---|---|---|
| `m/[slug]/page.tsx` | RSC | calls `loadDebateView` (§6); passes a client-safe view-model to `<DebateView>` |
| `DebateView` | client | owns `selectedPostId` (market↔post toggle = enterPost/exitPost); renders header + arena |
| `MarketHeader` | server | question=`title`, criterion=`description`, attrs, `PriceBar`; **resolver / media / price-graph = deferred placeholders (D1)** |
| `PostFocusHeader` | client | focused post: image / `ArgProfile` / title / teaser / `AggregateFooter` / market-thumbnail |
| `Arena` / `DebateColumn` | client | two columns; colhead = `PriceBar` tag + **disabled** Buy + "No active position" stub; hosts post-scroller (mkt-view) / reply-scroller (post-view) |
| `PostCard` / `ReplyCard` | server | shadcn **Card**; ink text; `--hairline` borders; `--imgr` radius |
| `ArgProfile` | server | **Avatar** (PFP placeholder) + pseudonym + `SideBadge` + `PositionMarker` + stake `a` + `Replies · N` + **disabled** cardacts |
| `SideBadge` | server | **Badge**; `--color-yes`(black)/`--color-no`(white); frozen `sideAtPostTime`; `aria-label` |
| `PositionMarker` | server | **Badge** (grey); `Flipped`/`Exited`; `none` → render nothing |
| `LaneBadge` | server | **Badge**; Most Debated / Highest Stakes / Contested via `badgeFor`; null → none |
| `AggregateFooter` | server | `Support (count):Đ / bar / Counter (count):Đ` (4 values) |
| `PriceBar` | server | Yes%/No% from `getPrices`; pole-coded |
| `RemovedPlaceholder` | server | "removed by moderator"; renders where content was withheld |
| `EmptySideCTA` | server | "Be the first to argue YES/NO" |
| `PostPopup` / `ImageLightbox` | client | read-only full body / enlarged image; focus-trap via shadcn Dialog; `aria-label` |
| `CommentImage` | server | `<img>` from presigned R2 URL; `--imgmax` cap |
| scroller buttons | client | **Button**; `aria-label` prev/next; **Skeleton** for loading |

Constraints honored: monochrome tokens only (OKLCH); desktop fixed-width; `:has()` banned → JS-toggled state classes (consolidated §8); no inline-style transliteration of the mockup; never import `src/server/**` into a client component (RSC fetches, props down).

---

## 5. Read-model wiring map (loader → component)

| Slot | Source |
|---|---|
| question / criterion / status | `getMarketBySlug` → `title` / `description` / `status` |
| price bar / price tag | **new** `getMarketPricing(marketId)` → pool reserves → `getPrices()` |
| attrs (Đ staked · posts · replies) | **new** `getMarketTotals(marketId)` (sum `bets.stake`, count posts, count replies) |
| post order + interleave | `loadRankingSubstrate` → `buildTopList` |
| per-post lane badge | `loadRankingSubstrate` → `badgeFor` |
| aggregate footer (4 values) | `loadRankingSubstrate` → `supportCount/counterCount/supportDharma/counterDharma` |
| author stake `a` | `loadRankingSubstrate` → `authorStake` |
| post/reply content + frozen side + marker | `listMarketComments` → `DebateComment` (`body`,`sideAtPostTime`,`marker`,`imageUploadsId`,`userId`) |
| reply order (two-slot + expand) | **new** `loadReplySubstrate` (§5a) → `rankReplies` → `twoSlot` / full lists |
| author pseudonym / PFP | **new** `resolveAuthors(userIds)` (batch `users.pseudonym`/`pfpFilename`); PFP → placeholder (D8) |
| comment image URL | `signRead(r2ObjectKey, 3600)` (server-side) |
| removed state + withholding | the masking aggregator `loadDebateView` (§6) |

**New read-models (all read-only, reuse existing indexes):** `loadReplySubstrate`, `resolveAuthors`, `getMarketPricing`, `getMarketTotals`, `loadDebateView` (the aggregator/gate).

### 5a. Reply-substrate query signature (NEW — none exists)

`src/server/debate-view/reply-substrate.ts`:

```ts
export async function loadReplySubstrate(
  client: DbClient | DbTransaction,
  args: { marketId: string },
): Promise<Map<string, ReplySubstrate[]>>  // keyed by parentCommentId
```

- One set-based query for the whole market (no N+1): `comments rc` WHERE `market_id = $1 AND parent_comment_id IS NOT NULL`, `JOIN LATERAL (SELECT b.stake FROM bets b WHERE b.comment_id = rc.id ORDER BY b.created_at, b.id LIMIT 1)` — mirrors `loadRankingSubstrate`'s LATERAL guard (reaches the reply-bet via the circular `bets.comment_id`, **never** `comments.bet_id`).
- Maps each row → `ReplySubstrate { id, side: side_at_post_time, stake, createdAt }`, grouped by `parent_comment_id`.
- Consumer: per post, `rankReplies(map.get(postId) ?? [], post.parentSide)` → `{support, counter}`; `twoSlot` for the default; full partitioned lists on expand. Replies placed into columns **by their own side** (D3): support → post.side column, counter → opposite column.
- Indexes: `comments_ranking_idx`, `bets_comment_id_idx` — **both exist; NO migration.** (If profiling later motivates the RANKING.md §11.3 covering index → **HALT + flag**, separate decision.)

---

## 6. Removal-masking derivation (the SAFETY-CRITICAL gate)

A new aggregator `src/server/debate-view/load-debate-view.ts` is the **single place masking is enforced** — satisfying "`listMarketComments` must not back a public surface until masking is attached" (SPEC.2 §5.4 / DEBATE.5/.7 gate).

1. **Removed-set query:** `SELECT DISTINCT target_comment_id FROM mod_actions WHERE reason = 'content_removed' AND target_comment_id IN (<market comment ids>)` (uses `mod_actions_reason_idx` / `mod_actions_target_comment_idx`) → `Set<removedCommentId>`.
2. **Assemble** `listMarketComments` + `loadRankingSubstrate` + `loadReplySubstrate` + `resolveAuthors`.
3. **Withhold server-side (before any DTO crosses to the client):** for every comment whose id ∈ removed-set, the view-model entry carries **`removed: true`** and **NO `body` / derived title / teaser, NO `imageUploadsId` / image URL, NO author pseudonym / PFP**. Dropped in the server layer — the client never receives them, so a removed comment's argument or author can never serialize into HTML/JSON (the hard requirement).
4. **Thread intact (ADR-0020 §61 / ADR-0021 §66):** rows are NOT excluded. A removed parent keeps its column slot (placeholder) + frozen side badge + reply aggregate, and **its replies still render** (other users' arguments). A removed reply renders its own placeholder, siblings intact.
5. **Type-level safety:** the masked view-model is a discriminated union — `{ removed: true; id; sideAtPostTime }` vs `{ removed: false; id; ...content }` — so a removed entry has **no `body`/author field at the type level** (a leak is a compile error; mirrors `list-comments.ts`'s held-side exposure boundary).
6. **Decoupling:** `users.bannedAt` does **NOT** mask — only `content_removed` does (ban removes voice, not past content — ADR-0021 §4). Track-A/B never persist → nothing to hide there.

---

## 7. Route composition + disabled-but-present treatment

- `(public)/m/[slug]/page.tsx` (RSC) replaces the SHELL placeholder: `await params` → `getMarketBySlug` → `notFound()` on null (Draft/unknown → 404, unchanged: OQ-2) → `loadDebateView` → render `<DebateView>` inside the existing `(public)/layout.tsx` shell. **Do NOT touch the placeholder header** (superseded at UI.13 — per the layout's own note; do not grow header chrome).
- **Public-read:** no middleware gate (`proxy.ts` matches `/admin/*` only); signed-out visitors render fully; reads server-mediated (ADR-0019).
- **Present-but-disabled (render for layout, not wired):** Buy/Sell, Support/Counter `rbtn2`, bookmark/download cardacts → `disabled` + `aria-disabled`, no handlers.
- **Not rendered (deferred copy):** composer `mod` overlays, slippage modal, auth-out gate.
- **Viewer position colhead** → static **"No active position"** stub (viewer/auth-dependent readout is OUT).
- **Wired (read affordances):** enterPost/exitPost, post-scroller / reply-scroller paging, "+" pop-up, image lightbox, two-slot expand.
- **INV-4 / read-only:** terminal markets (`Resolved`/`Voided`/`Frozen`/`Closed`) render a lifecycle marker and read as locked — satisfied by construction (no enabled writes).

---

## 8. Test list (`@test-writer` first, failing, against this plan)

**Server (Vitest — the body-not-serialized guarantee lives here):**
- `load-debate-view` masking — (a) removed comment's `body`/title/image/**author** absent from the returned view-model (type-level union + runtime assert); (b) thread intact (replies of a removed parent present); (c) placeholder flag set.
- Decoupling — a `bannedAt` author's non-removed comment is **not** masked.
- `loadReplySubstrate` (integration) — per-parent grouping; stake via reply-bet; no N+1; empty parent → empty.
- `getMarketPricing` / `getMarketTotals` (integration) — prices from reserves; correct aggregates.

**Pure model (reuse/extend existing `ranking.ts` / `compute.ts` suites):**
- Top order (`buildTopList`) + interleave; badges (`badgeFor`); two-slot + expand (`twoSlot`/`rankReplies`); markers (`computeMarker` none/Flipped/Exited); aggregate counts/Đ; reply ranking (stake-desc within side); **column routing** (reply → column by own side; Support = side == post.side).

**Render-level:** NO new DOM/RTL dependency (ruling). Visual invariants (no vote control present; write triggers disabled; terminal = read-only) are enforced by the view-model shape (no vote fields exist) + the manual staging-walk (§9).

---

## 9. Staging-verify checklist

Seed (existing staging-seed patterns) on a non-Draft market:
1. Posts + replies both sides → two-column render, Top order, per-post badge, two-slot, expand, aggregate (count:Đ).
2. **Seed a `content_removed` mod_actions row** → placeholder renders; **body + author absent from page source + network DTO** (view-source / devtools); replies under it still render.
3. Exited author (sold-to-zero) + Flipped author (holds opposite) → markers correct; `none` author → no chip.
4. Empty side → "Be the first to argue YES/NO".
5. Resolved / Voided / Frozen market → lifecycle marker + read-only (no enabled write affordances).
6. Draft slug → 404; signed-out (public) render works without auth.
7. Comment image → presigned URL renders within `--imgmax`; pop-up shows full body.

---

## 10. Execute-phase ritual

`@test-writer` (Phase 2 start — failing tests for the new server modules) → writer/reviewer → **pre-PR self-audit** (item-by-item vs this plan) → **`@security-auditor` (REQUIRED — public render + removal-masking body/author withholding)** → `@code-reviewer`. **`@db-migration-reviewer` NOT triggered** (no migration; reply-substrate reuses existing indexes); if an index proves needed under profiling → **HALT + flag**. Pass `@docs/plans/DEBATE.4.md` to every subagent. `just verify` (`ZUGZWANG_ENV=preview`) + `pnpm test:invariants` + `pnpm test:integration` + full `pnpm vitest run`, run locally against Postgres `:54322`, before PR.

---

## 11. Doc-debt (NOT this task — close-out / sweep)

- `design-language.md` §1.3/§6 (column axis) + §6/§3.2/§5 (mode selector) + §4.7 (held-queue) are stale vs the LOCKED `DESIGN-spec-changes-consolidated.md` §1, `RANKING.md §5.3`/ADR-0017 P3, and ADR-0021. The v0.4-draft correction is **sweep doc-debt**, recorded here; this task builds to the locked authorities, not the stale living guide.
- D1 future work: market-content schema slice + SPEC.1 amendment (resolver/media); ledger-replay price-graph read-model.
- D6 coupling: revisit title-source if the write slice adds `comments.title`.
- D7 follow-up: substrate LATERAL for `@entry%`; valuation compute for `→now`.

*Plan finalized at DEBATE.4 PLAN (web-approved, rulings folded). Recon base `origin/main @ e067c16`. Execution runs in a fresh chat from this committed plan.*
