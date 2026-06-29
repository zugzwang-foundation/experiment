# EXPORT.1 — Debate `.md` Export (route + gap-fill reads + header link + tests)

> **Status:** executing
> **Date:** 2026-06-29
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** no — but **critical-path-ADJACENT** (it serializes the moderation/masking read path). By ruling it runs the **full ritual + `@security-auditor`** (the masking gate). DDL reviewer expected **N/A** (no migration).
> **Plan PR / commit:** n/a (drafted; committed at the top of the execute chain)

---

## Tracker context

Working ID **EXPORT.1** (operator regularizes the tracker row; ADR-0025 §Tracker note: "Tracker IDs to be regularized by the operator"). The spec lane (ADR-0025 + `docs/specs/debate-export.md` + `public/zugzwang.md` + the SPEC.1 §21.3 amendment) landed at PR #179; this is the **build** lane ADR-0025 §10 explicitly defers ("route + button + the three gap-fill reads … built as their own task with the full plan→execute ritual + `@security-auditor`").

**Declared dependencies, verified done-state @ `d728293` (main):**

| Dependency | State @ d728293 | Evidence |
|---|---|---|
| ADR-0025 (serving model, masking, format) | **accepted** | `docs/adr/0025-debate-md-export.md` |
| `docs/specs/debate-export.md` (field-by-field contract) | **present** (draft, ratified by ADR-0025) | §1–§12 + Appendix A |
| `public/zugzwang.md` (context asset, v1.0) | **present** (8386 B) | served statically at `/zugzwang.md` |
| DEBATE.4 read-model `loadDebateView` | **built** | `src/server/debate-view/load-debate-view.ts` → `DebateViewModel` |
| `/m/[slug]` debate view (real, not placeholder) | **built** | `m/[slug]/page.tsx` → `<DebateView>` (two-column YES/NO, ranking order, markers) |
| `MarketHeader.tsx` (button home) | **built** | `:60` — `<h1>{market.title}</h1>` + `LifecycleBadge` |
| Gap-fill columns (`bets.price_at_bet`, `markets.resolution_outcome`/`resolved_at`, `resolution_events.reason`, `bets/comments.user_id`) | **all present in schema; NO migration** | recon STEP 3 |
| `outputFileTracingIncludes` precedent | **present** | `next.config.ts:39-41` (`/api/health`) |
| Mumbai Metro Line 3 conformance fixture | **condensed snippet present** (Appendix A); **full byte-exact fixture must be delivered** | see Self-critique #1 — execute-chain precondition |

No dependency is blocking except the **full golden fixture + the exact pinned context-block bytes** (Self-critique #1 — a precondition the execute chain must satisfy before writing the byte-exact test, not a code blocker).

## Approach (one paragraph)

Add a read-only `GET /m/[slug]/export` Route Handler (the codebase's **first** `text/markdown` + `Content-Disposition` handler) that resolves the market by slug (reusing `getMarketBySlug` → `notFound()`), loads the **already-masked** `DebateViewModel` via the existing `loadDebateView`, gathers three migration-free gap-fills (per-node `price_at_bet` folded into the read-model's earliest-bet `LATERAL`s so it is **compiler-bound to the non-removed variant**; resolution final-state + `participants` + **total stake** via a small **export-only, identity-free** market-scoped read), reads `public/zugzwang.md` from disk at runtime (bundled via `outputFileTracingIncludes`), and hands all of it to a **pure** serializer that emits the five-block `.md` per `docs/specs/debate-export.md`. A plain `<a download>` link is added beside the question `h1` in `MarketHeader.tsx`. The masking property is **inherited, never reimplemented**, and is verified by a unit test (removed→placeholder) plus an integration test that drives the real read-model with an **injected `mod_actions content_removed` row** and greps the output for any `user_id`/UUID leak.

---

## 1. Thesis invariants touched

This is a **read-only** feature — it opens no write path, no transaction, no engine/ledger/`n` contact (ADR-0025 §Decision-Driver 4).

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | **no** | No writes. (Relied on as a *read* guarantee — see §6: a non-removed node always has an entry bet, so `price_at_bet` is never null.) | n/a |
| 2.2 Dharma non-transferable | **no** | No `dharma_ledger` write; no transfer surface. | n/a |
| 2.3 Side frozen at comment-time | **no** | Reads `sideAtPostTime`; never writes it. | n/a |
| 2.4 Resolutions append-only | **no** | Reads `markets.resolution_outcome/resolved_at` + chain-tip `resolution_events.reason`; never writes. | n/a |
| **MASKING / identity-non-leak** (ADR-0025 §2; `debate-export.md` §10 — the load-bearing property) | **yes (the safety property)** | Serialize **only** the masked `DebatePost`/`DebateReply` variants from `loadDebateView`; **never** the `DebateComment` intermediate (sole `user_id` path). Removed node → 7e placeholder (only `rank`, frozen side, removed-status line, `createdAt`). Per-node entry price added **only to the non-removed variant** so the compiler forbids it on a removed placeholder. No raw UUIDs emitted (posts are rank-labelled, authors pseudonymous). Masking inherited, reimplemented nowhere. | **Unit:** `serialize.test.ts` removed-post case (no body/title/teaser/author/stake/entry-price/aggregate/image; surviving replies serialized; totals still include the suppressed stake). **Totals completeness:** with a removed node, `total_stake_dharma` == visible-stake sum **+** the removed node's stake **and** `participants` includes the removed author (asserted at both layers). **Integration:** `debate-export.integration.test.ts` — drives real `loadDebateView` with an injected `content_removed` row; **leak grep asserts zero `user_id`/UUID/email matches** anywhere in the output. |

**Critical-path failure modes (the masking row, by §1 ruling):**

- *If the leak-grep / masked-variant assertion is missing:* a refactor that serializes from the `DebateComment` intermediate (which carries raw `user_id`) ships every commenter's `user_id` (a UUID) into a **public, unauthenticated, downloadable** file — a permanent deanonymization of every participant in the debate.
- *If the removed-node assertion is missing:* the 7e serializer regresses to emitting `body`/`author`/`stake` for a `removed: true` node — moderator-removed content is **exfiltrated via the export** even though the UI masks it, defeating ADR-0021/0020 reactive removal. (Today nothing is removable in prod because the removal *writer* isn't built — so this MUST be tested via the **injected fixture**, not left "safe by absence.")

---

## 2. Data model changes

**None — read-only feature; no migration.** The three gap-fills project **existing** columns:

- `bets.price_at_bet` `numeric(38,18) NOT NULL` (exists) — surfaced by adding it to the **existing earliest-bet `LATERAL`** in `src/server/debate-view/ranking-substrate.ts` (posts) and `src/server/debate-view/reply-substrate.ts` (replies), reaching the bet via `bets.comment_id = comment.id` (**never** `comments.bet_id`).
- `markets.resolution_outcome` / `markets.resolved_at` (exist) — read from the `markets` row (already the projected final state).
- chain-tip `resolution_events.reason` `text NOT NULL` (exists) — read from the terminal resolution event.
- `participants` = `COUNT(DISTINCT user_id)` over the market's `bets` (exists).

> **STOP-gate:** if execution discovers any of these requires a schema/column change or a migration, **halt and surface** — the scope forbids a migration. (Recon confirmed all columns present @ d728293, so none is expected.)

**`@db-migration-reviewer` is expected N/A** (no `src/db/schema/` or `drizzle/migrations/` change). Confirm N/A in the execute chain rather than skipping silently.

## 3. API surface

**New:** `GET /m/[slug]/export` — Route Handler at `src/app/(public)/m/[slug]/export/route.ts`.

- **Method + path:** `GET /m/<slug>/export`. Route group `(public)` (parens → no URL segment); coexists with `m/[slug]/page.tsx` (the route handler is a deeper segment `export/`, so no page-vs-route collision). Runtime: **Node** (default per ADR-0003; fs read needs Node, not edge).
- **Request body:** none (GET; `params: Promise<{ slug: string }>` per Next 16).
- **Response:** `text/markdown; charset=utf-8`; header **`Content-Disposition: attachment; filename="<slug>.md"`**; body = the serialized `.md`. Established as the first non-JSON handler via `new Response(body, { headers: { … } })` (contrast `health/route.ts` → `Response.json`).
- **Auth:** **public, signed-out OK** — identical posture to the debate view page (`proxy.ts` matches `/admin/*` only; reads are server-mediated, ADR-0019).
- **Cache:** **none** (SPEC.2 §3.3 **R-1**, uncached/per-request fresh; ADR-0025 §1 — a cache is a window in which just-removed content could keep serving). The handler sets **`Cache-Control: no-store`** and stays dynamic (it reads the DB + fs per request).
- **Rate-limit class:** **none** — mirrors the public debate-view read, which carries no per-route limiter today (see Open Q2). If a later HARDEN.* adds a public-read bucket, the export joins it then.

**Server modules (new, under a new `src/server/debate-export/`):**

- `serialize.ts` — **pure** `serializeDebateExport({ model, meta, context, exportedAt }): string`. No IO, no clock, no DB. Deterministic given its inputs (the basis of the golden test). **Totals contract:** `total_stake_dharma` and `participants` are read from `meta` **verbatim**; `posts` = the post-array length and `replies` = Σ over posts of `support.length + counter.length` (the masked model keeps removed nodes in its arrays as placeholders, so the lengths already include them; **never** count `twoSlot`, a render subset). The serializer **MUST NEVER sum the masked nodes for the stake total** (guards a future node-sum refactor that would drop removed stake and fail §10.5). **Label contract:** posts/replies are referenced by positional labels — `chronological_index_posts` emits `post-{rank}` (never raw `posts.id`, ADR-0016 §6); reply numbering is a continuous `{post}.{n}` sequence, **support group first then counter** (the fixture's `1.1 → 1.3` jump pins it).
- `market-meta.ts` — `server-only` `loadExportMarketMeta(client, marketId): Promise<ExportMarketMeta>` → `{ outcome, resolvedAt, resolutionReason, participants, totalStakeDharma }`. Identity-free, export-only (see §"Gap-fill placement decision"). `participants = COUNT(DISTINCT user_id)` and `totalStakeDharma = SUM(stake)` are computed in **one** market-scoped query over the market's `bets`; **both include removed-node rows** (the `bets` exist; only the `comment` is masked — §10.5). Confirmed: the fixture's `total_stake_dharma` 3,225 = visible-stake sum 2,945 **+** the removed Post-4 stake 280.
- `context.ts` — `server-only` `readContextBlock(): Promise<string>` reading `public/zugzwang.md` via `node:fs/promises` (`readFile(join(process.cwd(), "public", "zugzwang.md"), "utf8")`). Mirrors the `/api/health` runtime-fs precedent.

**`next.config.ts`:** add one `outputFileTracingIncludes` key for the export route → `["./public/zugzwang.md"]` (precedent key `"/api/health"` → `["./drizzle/migrations/**/*"]`). Candidate key `"/m/[slug]/export"` (Open Q6).

**Gap-fill placement decision (stated + defended):**
- **Per-node entry price → extends the read-model variants** (`PostSubstrate`/`ReplySubstrate` in `src/lib/ranking.ts`, then the **non-removed** `DebatePost`/`DebateReply` in `load-debate-view.ts`). *Why in the shared model:* it is per-node and must be **compiler-bound to the non-removed variant** so it can never appear on a removed placeholder; deriving it outside the masked model would require re-mapping node→bet and re-applying the removed-set — i.e. **reimplementing part of the masking join**, which the safety line forbids.
- **Resolution final-state + `participants` + `total_stake_dharma` → a separate export-only `market-meta.ts` read** (NOT folded into `DebateViewModel`). *Why separate:* (a) export-only — folding them into the shared header forces the live debate-view page/`MarketHeader.tsx` to carry fields they don't render (violates §5.3 surgical); (b) identity-free + market-level — no masking concern; (c) **`participants` AND `total_stake_dharma` MUST be raw aggregates over `bets` (`COUNT(DISTINCT user_id)` / `SUM(stake)`), not derived from the masked posts** — a removed node is masked OUT of the view-model (no author, no stake on the node) yet §10.5 requires its author *and its stake* still count, so neither can be summed from the masked nodes. (`totals.dharmaStaked` does exist on `DebateMarketHeader`, but the export deliberately uses the explicit market-meta `SUM(stake)` to make the §10.5 guarantee self-evident and to decouple from `getMarketTotals`' internals.) **`posts`/`replies` come from the masked model's ARRAY LENGTHS** (removed nodes remain as placeholders in the arrays, so the lengths already include them) — they no longer depend on a `totals` object, and the count is guaranteed to equal the number of rendered nodes. *Reuse note:* check `src/server/resolution/` for an existing terminal/chain-tip reason reader before hand-rolling the reason query (Open Q5).

## 4. UI / user flow

- **Component:** add a plain anchor in `src/components/debate/MarketHeader.tsx`, beside the question `h1` + `LifecycleBadge` (`:56-62`): `<a download href={\`/m/${market.slug}/export\`} aria-label="Download this debate as Markdown">…</a>`. `market.slug` is already on `DebateMarketHeader` (via `MarketSummary`).
- **No `"use client"` boundary, no fetch/blob** — it's a native browser download from an `href`; `MarketHeader` stays a server component.
- **Signed-out behaviour:** works — the route is public; the link renders for everyone.
- **Accessibility:** `aria-label` on the (likely icon) link (AGENTS.md §8 icon-only rule); pair icon with text/`aria-label`.
- **Design handoff:** none (a single affordance in an existing header; monochrome v1 tokens already minted). Keep it minimal — do not restyle the header.

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| `public/zugzwang.md` fs-read miss (bundle gap — file absent from the route's Lambda) | `readFile` throws → 500 → Sentry; the integration test + the `outputFileTracingIncludes` entry prevent it; a startup/test assertion that the file exists & is non-empty | **Fail the request (500)** — never serve a context-less export (the context block is load-bearing for neutrality + format conformance). Fix = ensure the tracing-include key + redeploy. |
| Unknown / `Draft` slug | `getMarketBySlug` returns `null` | `notFound()` (404) — inherited, identical to the page. |
| Market with no pool (null prices) | `pricing === null` from `loadDebateView` | Serializer emits `yes_price: null` / `no_price: null` and an in-body "not yet priced" line (spec §4: "null if no pool"). Edge case in §6. |
| Concurrent moderation during render | n/a (by design) | **On-demand + `no-store`** → every request re-runs `loadDebateView`, which re-reads the `content_removed` set at render time → always current masking, **no stale window** (this is *why* R-1/no-cache is safety-relevant, ADR-0025 §1). |
| Very large debate (response size / memory) | response size | v1 is **load-all** (D11; per-market volume bounded for a ~45-day experiment). No streaming in v1 — **accepted limitation** (note in §8). |
| Migration applied but code not deployed (or vice versa) | n/a | No migration; not applicable. |

## 6. Edge cases

- **Zero-post market:** `posts: []` → front matter `posts: 0`, `chronological_index_posts: []`; Summary states "no arguments yet"; empty debate body. No crash on empty arrays.
- **Open vs resolved vs voided:** open → `outcome: null`, no `resolved_at`/`resolution_reason` lines, "Current price"; resolved/voided → `outcome` + `resolved_at` + `resolution_reason` present, "Final price".
- **Removed POST with surviving replies:** 7e placeholder + its replies serialized normally (§10.3).
- **Reply whose PARENT is removed:** reply serializes; "**Replies to:** Post {n} **(removed)**" (§7d).
- **Post with no replies:** no reply section under it.
- **Null `resolution_outcome`:** `outcome: null` (open market).
- **Entry price never null on a non-removed node:** INV-1 (every comment rides a bet) + `price_at_bet NOT NULL` ⇒ the earliest-bet `LATERAL` always returns a non-null price for any non-removed node ⇒ **the non-removed variant's `entryPrice` is always present** (no null-handling on non-removed nodes). The removed variant has no `entryPrice` field at all.
- **Đ grouping for large stakes:** string-based comma grouping (no `Number()` on the value) — safe for `NUMERIC(38,18)` magnitudes.
- **Price decimal precision:** pinned by the delivered golden fixture (Open Q3).
- **Totals exceed visible stakes (correct, not a bug):** `total_stake_dharma` legitimately exceeds the sum of visibly-attributed node stakes when a node is removed — the removed node's stake is in the total but shown on no node (§10.5). Likewise `participants` can exceed the count of visibly-attributed authors. The fixture proves it: 3,225 total vs 2,945 visible (+280 removed Post-4).
- **Top-ranked post on a side is removed (Summary, Block 3a):** the single highest-ranked argument per side can't be quoted if that post is removed → fall through to the next non-removed post on that side (or state the leading argument on that side was removed). The Mumbai-Metro fixture's top YES and top NO are both non-removed, so **the golden does not exercise this** — it needs its own unit case.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| **Unit** (`tests/unit/debate-export/`) | **`serialize.test.ts`** — **byte-exact** Mumbai Metro golden (injected fixed `exportedAt` + pinned `zugzwang.md` context block); the expected `.md` committed as a fixture. **Masking unit** — removed post → 7e placeholder; assert **none** of body/title/teaser/author/stake/entry-price/aggregate/image appear; surviving replies serialized; feed a model whose `meta.totalStakeDharma` **exceeds the visible node-stake sum** and assert the serializer emits the `meta` value **verbatim** (never a node-sum), and `participants` includes the suppressed author. **Text-only** — `imageUrl`/`pfpUrl` never appear. **Front matter** — all keys/types, `chronological_index_posts` ordering (createdAt asc), `ordering`/`timestamps` constants. **Formatter units** — Đ grouping (`"3225"→"3,225"`), price 0–1 (2 dp via `CpmmDecimal`), `formatPercent` reuse for in-body %. | MASKING (removed→placeholder; totals still include suppressed stake) |
| **Integration** (`tests/integration/debate-export.integration.test.ts`, Vitest + test Postgres) | Route end-to-end through the **real** `loadDebateView` + `loadExportMarketMeta` against a seeded debate that **includes an injected `mod_actions` `content_removed` row** → masking path exercised through the real read-model. **Leak grep:** assert the output contains **no `user_id` / no UUID (regex) / no email** anywhere (the output legitimately emits **no** UUIDs — posts use positional `post-{rank}` labels, authors are pseudonyms — so any UUID match is a real leak). **Gap-fills correct:** entry price from `price_at_bet`; `participants` = `COUNT(DISTINCT user_id)` (incl. the removed author); **`total_stake_dharma` == Σ(visible node stakes) + the injected removed node's stake** (the removed stake is in the total, on no node — §10.5); resolution state on a **resolved-market** seed (`outcome`/`resolved_at`/`resolution_reason`). **Headers:** `Content-Type: text/markdown; charset=utf-8`; `Content-Disposition: attachment; filename="<slug>.md"`; **`Cache-Control: no-store`**. | MASKING (real-read-model leak grep; injected-fixture removal) |
| **E2E** (Playwright) | **Skipped — justified.** No E2E runner is installed (AGENTS.md §9). The `<a download>` is a plain anchor with **no JS** (native browser behaviour), and the route is fully covered by the integration test. A one-line **manual smoke** (click link → file downloads) at execute time suffices. | — |

**Critical-path masking coverage (confirmed):** the MASKING property has **multiple** assertions — unit (removed→placeholder) + integration (real read-model masked path + leak grep). The §1 "every touched invariant has ≥1 assertion" rule is satisfied with margin.

**Tests-first (§5.6):** `@test-writer` writes the failing unit + integration tests at Phase-2 start (serializer is thesis-touching: it is the identity-non-leak boundary). The golden fixture + pinned context bytes must be in hand first (Self-critique #1).

## 8. Out of scope

- **No write/mutation** — read-only; no transaction, no ledger/engine/`n` contact.
- **No migration** — three gap-fills project existing columns (STOP-gate if one needs DDL).
- **No cache** — uncached per R-1; no TTL, no pre-generation, no baked files.
- **No inlined `zugzwang.md`** — read from `public/zugzwang.md` at runtime; single source, also served at `/zugzwang.md`. Do **not** self-fetch `/zugzwang.md`.
- **No reimplemented masking** — inherited from `loadDebateView` only.
- **No change to the live debate-view UI's Đ rendering** — the new comma-grouping formatter is **export-only**; `format.ts::formatDharma` and the on-screen `Đ3225` rendering stay untouched (surgical, §5.3).
- **No rate limiter added** — mirrors the public read's none (Open Q2).
- **Share-card** (§21.2 / W2.13); **price-over-time trajectory** (per-node entry price **only**, ADR-0025 §7); **image export** (text-only); **platform-authored domain glossary** (user-written terms, LLM world-knowledge); the **removal WRITER** (tested via injected fixture only — not built here); the operator's downstream **NotebookLM/ElevenLabs report** (operator-owned, out of product scope).

---

## Open questions

The four kickoff decisions are **DECIDED** (recorded, not reopened):
- **Route** = `GET /m/[slug]/export` → `text/markdown` + `Content-Disposition: attachment; filename="<slug>.md"` at `src/app/(public)/m/[slug]/export/route.ts`, uncached (R-1). ✅
- **Context** = read `public/zugzwang.md` from disk at runtime + `outputFileTracingIncludes`; single source; no inline, no self-fetch. ✅
- **Button** = plain `<a download href="/m/<slug>/export">` in `MarketHeader.tsx`; no client boundary; works signed-out. ✅
- **Golden test** = commit the Mumbai Metro byte-exact `.md`; pin `exported_at` (injected fixed clock) + the `zugzwang.md` context block. ✅

**New questions surfaced:**

- **Q1 — Đ thousands-separated formatter location.**
  - **Candidate:** **None exists** (`format.ts::formatDharma` trims trailing zeros only; the live view renders `Đ3225`). Define an **export-only** `formatDharmaGrouped(value: string): string` in `src/server/debate-export/serialize.ts` doing **string-based** comma grouping on the integer part (no `Number()`/float — CLAUDE.md §2), leaving the live UI untouched.
  - **Resolve with:** this plan (§3/§8) — settled; confirm at web review.
- **Q2 — Route rate-limit bucket.**
  - **Candidate:** **None** — mirror the public debate-view read (no middleware gate, no per-route limiter). Revisit only if a HARDEN.* public-read bucket lands.
  - **Resolve with:** operator confirmation at ratification; mirror the page for now.
- **Q3 — Price decimal precision (`yes_price`/`no_price`, per-node `entry price`).**
  - **Candidate:** Pinned by the **reconciled, signed-off golden fixture** (Self-critique #1; Appendix A shows 2 dp, e.g. `0.54`, `0.47`). Serializer rounds via `CpmmDecimal(value).toFixed(N)` (display-only; exact decimal, no float) with `N` taken from the fixture (likely 2).
  - **Resolve with:** before Phase 2 — read `N` off the reconciled byte-exact fixture once web delivers it.
- **Q4 — Market-level gap-fill placement.**
  - **Candidate (DECIDED here):** separate export-only `market-meta.ts` for resolution + `participants` (identity-free; `participants` must be a raw `COUNT`); per-node entry price extends the read-model variants (masking-variant binding).
  - **Resolve with:** this plan §3 — settled.
- **Q5 — Chain-tip resolution-reason reader + integration seeding factory.**
  - **Candidate:** reuse any existing terminal/chain-tip reason reader in `src/server/resolution/` if present (else a small market-scoped read using the terminal-once index + `corrects_event_id`); for seeding, reuse `tests/db/_fixtures` helpers, adding an export-scoped multi-post seed builder if they can't express a 6-post/10-reply debate + a `content_removed` row + a resolved variant.
  - **Resolve with:** Phase 2 / `@test-writer` kickoff.
- **Q6 — Exact `outputFileTracingIncludes` key for the dynamic export route.**
  - **Candidate:** `"/m/[slug]/export"` (route-group parens stripped; mirrors the `"/api/health"` precedent).
  - **Resolve with:** verify at build that `zugzwang.md` is present in the route's traced bundle (same mechanism the `/api/health` drift check relies on).

## ADRs needed

**None.** ADR-0025 covers all the decisions (serving model, masking inheritance, format, gap-fills, classification). The route path/handler was **explicitly deferred to this build** (ADR-0025 §10 + §"does not decide"). At execute time this lands as a **same-commit doc edit** (CLAUDE.md §5.12 — in-place, not a new ADR):
- **SPEC.2 §4 (API Surface):** add the `GET /m/[slug]/export` row (ADR-0025 framed it as "lands in SPEC.2 §4 at build time").
- **SPEC.2 §22 / §0:** the export route is build substance, not a new ADR; if the §22 inventory/change-log needs a build-time note, it is a doc edit, **not** a new ADR.
- `docs/specs/debate-export.md` Status flips `draft → ratified`/promoted at commit (it says "promotes on commit").

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | The **byte-exact golden** depends on the full Mumbai Metro worked example, which **exists** (web-authored, Section B of the export template+worked-example doc) — so it is *not missing* — but is a **sign-off-pending draft** that (a) **disagrees with the final `docs/specs/debate-export.md` on Author status:** the worked example glosses `flipped (has since moved…)`, while the formal schema §7c/§9 + Appendix A use the **bare** word `flipped`; and (b) shows the context block as a **one-line placeholder**, so it is not byte-complete standalone. | **Reconcile + sign-off precondition (no fabrication).** The byte-exact golden is the worked example **reconciled to `debate-export.md`** (bare author-status words; final-schema formatting), web-delivered and **operator-signed-off** — web is producing it now. The byte-exact *expected file* is constructed by **splicing `public/zugzwang.md` verbatim** into the context-block slot (the worked example is not byte-complete standalone). The **unit golden** compares serializer output against this constructed expected; the **integration** test covers the masking/leak/headers path against a seeded DB and is **NOT byte-exact** (seeded pseudonyms/timestamps differ from the hand-authored fixture — keep this split). Execute-chain precondition: the **reconciled, signed-off fixture must be in hand and committed at a test path** before `@test-writer` authors the golden. |
| 2 | medium | Price-decimal precision is shown only by example, not pinned in prose. | Open Q3 — resolved by the delivered golden fixture; serializer routes through `CpmmDecimal.toFixed(N)`. |
| 3 | medium | Touching the shared read-model (`ranking-substrate`, `reply-substrate`, `ranking.ts` types, `load-debate-view`) for `price_at_bet` risks a regression in the **live** debate view that consumes the same model. | The change is **additive** (new field on the non-removed variant; new `LATERAL` column) and surgical; existing view components ignore the new field. `@code-reviewer` + `@security-auditor` + the existing debate-view tests + `pnpm vitest run` (full suite) gate it. Compiler enforces the removed variant gains no `entryPrice`. |
| 4 | medium | `participants` could wrongly be derived from the masked posts (which omit removed authors), undercounting per §10.5. | Decided as a **raw `COUNT(DISTINCT user_id)` over `bets`** in `market-meta.ts` (§3) — never from the view-model. Asserted in the integration test (count includes the removed author). |
| 5 | low | YAML front matter sits **above** a context block that itself contains `---` horizontal rules; a lax YAML reader could over-read. | The front matter is the single leading `---\n…\n---` block; `zugzwang.md`'s `---` rules fall **after** the closing fence (body, not front matter). Layout matches Appendix A. Note for the serializer; covered by the byte-exact golden. |
| 6 | low | Leak-grep could false-pass if pseudonyms or bodies happened to contain UUID-shaped text. | Pseudonyms are adjective+animal+number (e.g. `CrimsonHawk207`) — no UUID shape; bodies are participant prose. The UUID-regex + email-regex asserts **zero** matches; the output legitimately emits **no** UUIDs (rank-labelled posts, pseudonymous authors), making the assertion strong and simple. |
| 7 | low | `Content-Disposition` filename uses the slug — quoting/encoding risk. | Slugs are kebab-case URL-safe (ADR-0016); `filename="<slug>.md"` needs no escaping. Asserted in the integration header test. |

*No high/medium finding is left unresolved: #1 is a stated execute-chain precondition (STOP-if-absent), #2–#4 are resolved in the plan body, #5–#7 are low and covered by tests. Checked: invariant coverage (masking has multiple assertions), scope discipline (no migration/cache/inline/reimplemented-masking; live UI untouched), test assertions (leak grep + byte-exact golden + injected-fixture removal), edge-case enumeration (zero-post, removed-with-replies, parent-removed, no-pool, never-null entry price).*

---

## References

- `CLAUDE.md` — the contract this plan respects (§1 critical-path-adjacent ruling; §2 masking/decimal; §3 refusals; §5 ritual)
- `AGENTS.md` — stack patterns (§3 tree, §5 route handlers, §6 read-model/`LATERAL`, §9 testing)
- `docs/adr/0025-debate-md-export.md` — the ratifying ADR (serving model, masking, format, gap-fills, build-deferral)
- `docs/specs/debate-export.md` — the field-by-field serialization contract (§4 front matter, §7 nodes, §10 masking, §11 gap-fills, §12 + Appendix A conformance)
- `public/zugzwang.md` — the v1.0 context asset (read verbatim; not rebuilt)
- `src/server/debate-view/load-debate-view.ts` · `ranking-substrate.ts` · `reply-substrate.ts` · `src/lib/ranking.ts` — the read-model the export reuses + extends
- `src/server/markets/get-by-slug.ts` — `getMarketBySlug` / `MarketSummary` (reused for resolve + `notFound`)
- `src/components/debate/MarketHeader.tsx` · `format.ts` — button home + the Đ/percent formatters
- `src/app/api/health/route.ts` · `next.config.ts` — route-handler + `outputFileTracingIncludes` precedents
- Tracker entry: **EXPORT.1** (operator regularizes)

---

### Execute-chain reminder (after ratification)

Fresh chat: ratified plan committed at top → `@test-writer` (failing unit + integration; **needs the full golden fixture first** — Self-critique #1) → writer (read-model `price_at_bet` + `market-meta.ts` + `serialize.ts` + `context.ts` + route + `MarketHeader` link + `next.config` tracing key + the same-commit SPEC.2 §4 doc edit) → `@code-reviewer` → `@db-migration-reviewer` (**expect N/A — confirm no migration**) → `@security-auditor` (**masking gate**) → pre-PR §5.10 self-audit → squash-merge PR. `just verify` + `pnpm vitest run` (full suite — local Postgres :54322) before PR.
