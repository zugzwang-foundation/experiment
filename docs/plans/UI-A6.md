# UI-A6 — Bookmarks — Plan **v2** (RATIFIED — operator, 2026-07-21)

| | |
|---|---|
| **Slot** | UI-lane Session A · A6 (Bookmarks) — the gated plan→execute slot |
| **Build spec** | ADR-0032 (`docs/adr/0032-bookmarks.md`, accepted 2026-07-20, merged #252) |
| **Ground** | `main` @ `51ba217`; recon re-verified at this HEAD 2026-07-21 (below) |
| **Gate class** | DDL (migration `0024`) **and** masking-adjacent cross-author read ⇒ **NEVER ultracode**; full gated cascade (§8) |
| **Predecessor** | UI-A5 Profile @ `c13e3e6` (#251) — its `src/server/profile/*` machinery is reused cross-author |
| **v2 delta** | OQ-1 ruled **Y (refined)** — vertical only, in-page remove, no adjacent-surface touch (§3.3/§11) · **Addition 1** FI-2 cross-surface figure identity (§4.5) · **Addition 2** the named add-path follow-on `BOOKMARK-ADD-WIRE` (§11) |

---

## 0 · Ground (STEP 0 recon — verify-don't-trust, read-only, ran 2026-07-21 at this HEAD)

| Check | Expected | Found | Verdict |
|---|---|---|---|
| HEAD | 51ba217+ | `51ba217` (ADR-0032, #252) | ✅ |
| ADR-0032 on disk | present, accepted | full build spec (26 KB) | ✅ |
| Migration head | 0023 | `0023_positions_market_id_idx` | ✅ → next free `0024` |
| EVENT_TYPES | 24 | 24 (Option 1 mints none) | ✅ |
| Bookmarks storage/action/route/read-model | none | none in `src/db`, `src/server`, `src/app`, `drizzle/` | ✅ greenfield |
| Wire target | disabled icon only | `src/components/debate/ArgProfile.tsx` (DEBATE.4 disabled icon, no handler) | ✅ |
| SPEC.2 §5.1/§5.2/§4.2/§19.3/§22/App.A/B | un-amended | zero `bookmark` mentions in SPEC.2 | ✅ — land at execute |
| SPEC.1 §23 + Forward(A6) | present | §23 L1494; Forward sentence L1525 | ✅ consumed, not re-decided |

**Reuse inventory (all verified this pass):**

- `src/server/profile/arguments.ts` — `buildPostItem` / `buildReplyItem` are **already pure** over per-item inputs `(post|reply, meta, marketById, ordinalById, [topLevelBodyById], heldByMarket, removedSet)`. **No fixed-`userId` closure.** The marker is computed from whatever `heldByMarket` map the caller passes — so cross-author reuse needs only an `export` (steer 1 condition (i) satisfied; no signature surgery). Union `ProfileArgumentItem` carries the compile-time masking boundary (removed variant → no title/teaser/body/marker).
- `src/server/profile/episodes.ts` — `computeEpisodes` + `mergeTradeStream` **exported**; `SideEpisode.stakedBasis` = **Đa**; `mergeTradeStream` owns the N-3 tie-break (`created_at` asc, cross-source tie = **buy-before-sell**).
- `src/server/profile/positions.ts` — the Đa/Đb derivation *pattern* (final-episode basis + `computeSell` / net-Σ-payout) **and its exact sourcing** (`userBets` from `bets`; sells from `events` `bet.sold`, `payload.sharesSold`/`payload.side`). Reused as **machinery**, sourcing **mirrored byte-for-byte** (§4.5) — not `loadProfilePositions({userId})` per item.
- `src/server/cpmm/calculate.ts` — `computeSell({reserves, side, shares}).proceeds` = **Đb** (open holdings).
- `src/server/positions/compute.ts` — `computeMarker({sideAtPostTime, heldSide})`: `null→Exited`, `===→none`, `else→Flipped`.
- `src/server/debate-view/resolve-authors.ts` — `resolveAuthors(client, userIds[]) → Map<id,{pseudonym, pfpUrl}>`, batched, reads only public `pseudonym`; **scrub is data** (bracketed `[scrubbed_user_N]` carries through) → zero PII, scrub-safe author heads.
- `src/server/debate-view/load-debate-view.ts` — `loadRemovedSet(client, ids[])` = the **single-sourced** masking gate (the reason `@security-auditor` gates this slot).
- `src/server/auth/session-gate.ts` — `createSessionGate(db)` = the auth gate for `/bookmarks`.

---

## 1 · Approach (one paragraph)

Bookmarks are private, mutable, deletable convenience state → a dedicated **Bucket-C** `bookmarks` table (migration `0024`), two idempotent **Server Actions** with an app-layer **others-only** guard, and a **cross-author list read** that renders each bookmarked *author's* Đa/Đb + marker in the Profile surface's **forced-visitor** mode, in bookmark-recency order. Zero invariant surface (no `dharma_ledger`/`events`/`bets`/`comments` write; EVENT_TYPES stays 24). The read is the substance: it reuses A5 machinery cross-author via a **pure-builder export** (single-sourced masking — no parallel path), computing figures at **per-`(author, market, side)`** granularity through a **fully batched** query set (no N+1), and it is held **byte-identical to the author's own Profile** by the FI-2 same-source mandate (§4.5). Every SPEC.2 registry amendment ADR-0032 minted rides the **execute** commit, same-commit with `0024`. A6 ships the self-contained vertical; the cross-surface **add-icon** wiring is the named follow-on `BOOKMARK-ADD-WIRE` (§11).

---

## 2 · The four steer resolutions (web verdict 2026-07-21, round 0 — baked in; round 1 APPROVED steers 1–4 + §4.1/§4.3/§4.4)

**Steer 1 — reuse via export (conditioned): DISCHARGED.** Builders verified pure (§0). Execute adds `export` to `buildPostItem`, `buildReplyItem`, and the `MarketMeta` type in `arguments.ts` — **no behavior change**, masking single-sourced through the unchanged union + `loadRemovedSet`. `@security-auditor` reviews the `arguments.ts` diff (§8). **No parallel builder ⇒ no divergence test needed.**

**Steer 2 — per-`(author,market,side)` granularity via a BATCHED read: adopted.** ~13 IN-list queries (§4.1) — **never** N per-item profile loads. **Cost bound:** viewer bookmark count × the authors' touched markets (§23 replay posture; no stored series).

**Steer 3 — Exited/settled edge (ARGUMENT-anchored, not position-anchored): pinned (§4.3).** The bookmark list renders **every** bookmarked comment (the comment is permanent, Bucket A) — it does **NOT** apply the Profile positions table's OQ-3 A held-to-settlement row-domain filter that omits exited-market rows. An exited author's card still renders (0/0 + Exited).

**Steer 4 — DTO (exposure boundary from the compile-time union): adopted (§4.4).** Present-variant = A5 present content variant **+** `authorPseudonym` + `staked`(Đa) + `current`(Đb) (marker already present). Removed-variant = A5 removed content variant **+** `authorPseudonym` **only**.

---

## 3 · The build — slices (tests-first per §5.6; each independently green under §9)

| # | Slice | Files (created at execute) | Gate |
|---|---|---|---|
| **1** | **Schema + migration** — `bookmarks` table, Bucket C | `src/db/schema/bookmarks.ts` (+ `index.ts` export) · `drizzle/migrations/0024_bookmarks.sql` | `@db-migration-reviewer` |
| **2** | **Write path** — two idempotent Server Actions + others-only guard | `src/server/bookmarks/add.ts` · `remove.ts` | `@code-reviewer` · `@security-auditor` |
| **3** | **Cross-author read model** — `loadBookmarks` (the substance) + FI-2 same-source (§4.5) + the `arguments.ts` export | `src/server/bookmarks/list.ts` (+ `figures.ts` helper) · `arguments.ts` (export edit) | `@code-reviewer` · **`@security-auditor`** |
| **4** | **Route + states + in-page remove** — `/bookmarks` (auth-gated, forced-visitor) | `src/app/(public)/bookmarks/{page,loading,error}.tsx` | `@code-reviewer` |
| **5** | **SPEC.2 same-commit amendments** (§6) | `docs/specs/SPEC.2.md` | Gate C |

Slice order: storage → write → read → surface → doc. Slices 2 & 3 are the `@security-auditor` gates. Each slice ends green (§9). **No adjacent-surface (`ArgProfile.tsx` / `loadDebateView` / profile loader) touch in A6** — that is `BOOKMARK-ADD-WIRE` (§11).

### 3.1 · Slice 1 — schema (ADR-0032 D-1, verbatim)

`src/db/schema/bookmarks.ts` (new domain file, domain-per-file per ADR-0008):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK `default sql\`uuidv7()\`` | ADR-0016 |
| `user_id` | `uuid` NOT NULL → `users.id` (`onDelete: "restrict"`) | the viewer who saved it |
| `comment_id` | `uuid` NOT NULL → `comments.id` (`onDelete: "restrict"`) | the saved post/reply |
| `created_at` | `timestamptz` NOT NULL `defaultNow()` | drives list order (D-8) |

- `UNIQUE (user_id, comment_id)` — a comment bookmarked at most once per user; the storage backstop behind the idempotent write.
- Index `bookmarks_user_id_idx` on `user_id` — the list read is a `WHERE user_id = $viewer` scan (FK-on-referencing-side convention, per `market_media`).
- **Bucket C (mutable): NO append-only trigger, NO TRUNCATE guard** (following `market_media`). Un-bookmark is a legitimate `DELETE`. **⚠ Interlock note:** because `bookmarks` is **Bucket C**, it is **NOT** added to the `TRUNCATE_GUARDS` set — the "disables N guards" teardown count is **unchanged** (contrast the Bucket-A interlock; deliberate, not a missed guard).
- `onDelete: "restrict"` safe: neither referent is ever hard-deleted (`comments` Bucket A; a scrubbed `users` row persists under placeholder).
- Migration generated via `just db-generate bookmarks`; **verify the emitted number is `0024`** at execute (head `0023`); standard `CREATE TABLE` + unique + index; **no** trigger DDL.

### 3.2 · Slice 2 — write path (ADR-0032 D-2 / D-3)

Server Actions (`"use server"`), zod-validated `commentId` (uuid), session via the established pattern (`src/server/auth/tos-accept.ts` parity):

- **`addBookmarkAction(commentId)`** — auth-gated (anonymous → standard auth error). Load the target comment's `user_id`; **not-found → not-found error**; **`session.user.id === comment.user_id` → forbidden (others-only, D-3)**; else `INSERT INTO bookmarks (user_id, comment_id) VALUES (…) ON CONFLICT (user_id, comment_id) DO NOTHING`. Idempotent (double-tap = no-op).
- **`removeBookmarkAction(commentId)`** — auth-gated. `DELETE FROM bookmarks WHERE user_id = $session AND comment_id = $target`. Idempotent (absent = successful no-op). **This is the /bookmarks in-page un-bookmark handler (§3.3).**

Deliberately **two actions, not a `toggle`** (D-2: two rapid taps could both read "absent" and net to bookmarked; the client always knows icon state and calls the correct action).

### 3.3 · Slice 4 — route + surface + in-page remove (ADR-0032 D-5 / D-6; OQ-1 = Y refined)

`/bookmarks` in the ADR-0023 `(public)/` shell, **auth-gated** (anonymous → sign-in via `createSessionGate`; there is no anonymous bookmark set). Renders the **session user's** saved items via `loadBookmarks({ viewerId: session.user.id })`, each card in **forced-visitor mode** (D-5): list retitled **"Bookmarks,"** chip **"Your bookmarks,"** **no Sell mount ever** (every item is someone else's content by D-3), headzone bookmark icon **active**. Reuse the A5 Profile argument-list **card component** in visitor mode (confirm the exact component at build).

- **In-page un-bookmark (fully in-vertical — no adjacent surface):** the active icon on a `/bookmarks` card calls `removeBookmarkAction(commentId)` → on success the item **drops** from the list (revalidate the route / optimistic removal). This is the only interactive write the surface owns; **add** is out of A6 (`BOOKMARK-ADD-WIRE`, §11).
- **States:** loading skeleton · **empty** ("no bookmarks yet") · error · populated (and post-remove → empty when the last item drops).
- `V` owner/visitor toggle disabled in bookmark mode (canon §5).

---

## 4 · Read-model design — `loadBookmarks({ viewerId })` (the substance)

Produces `BookmarkItem[]` in **`bookmarks.created_at` DESC** (recency) order — **NOT** RANKING.md §3.6 (that is the Profile argument list's order; `profileOrder` is **not** used here). Builders are called directly per item.

### 4.1 · Batched query set (steer 2 — all IN-list scoped; O(1) round-trips) — APPROVED round 1

| Q | Query | Yields |
|---|---|---|
| 1 | `SELECT comment_id, created_at FROM bookmarks WHERE user_id = $viewer ORDER BY created_at DESC` | ordered comment ids (indexed scan) |
| 2 | `comments WHERE id IN (Q1)` → `id, user_id (=author A), market_id, parent_comment_id, side_at_post_time (=S), body, created_at` | per-item substrate; distinct `A[]`, `M[]`, `(A,M)` tuples, post-ids vs reply-ids, parent-ids |
| 3 | post-aggregate query (the `arguments.ts` `postRows` shape) `WHERE p.id IN (bookmarked post ids)` | Support/Counter counts + Đharma + author's own post stake + `price_at_bet` → `PostSubstrate` |
| 4 | reply-stake query (the `arguments.ts` `replyRows` shape) `WHERE rc.id IN (bookmarked reply ids)` | reply's own bet stake + `price_at_bet` → `ReplySubstrate` |
| 5 | `markets WHERE id IN (M[])` | `slug, title, status` |
| 6 | `pools WHERE market_id IN (M[])` | reserves (Đb, open holdings) |
| 7 | `positions WHERE user_id IN (A[]) AND market_id IN (M[])` (filter to tuple set, `quantity > 0`) | `heldBy(A,M) = {side, quantity}` |
| 8 | `payout_events WHERE user_id IN (A[]) AND market_id IN (M[])` | `settledNet(A,M) = Σ amount` |
| 9 | `bets WHERE user_id IN (A[]) AND market_id IN (M[])` (group by `(A,M)`) | author episode-walk **buys** — **mirrors `positions.ts` `userBets` columns exactly** (§4.5) |
| 10 | `events WHERE aggregate_type='market' AND aggregate_id IN (M[]) AND event_type='bet.sold'` (parse payload, filter `payload.userId ∈ A[]`, group by `(A,M)`) | author episode-walk **sells** — **mirrors `positions.ts` `soldEvents` sell-source exactly** (§4.5); `payload.sharesSold`/`payload.side`/`eventId`/`createdAt` |
| 11 | `comments WHERE market_id IN (M[]) ORDER BY created_at, id` (top-level) | `ordinalById` + `topLevelBodyById` + parent bodies |
| 12 | `loadRemovedSet(client, [bookmarked ids + parent ids])` | masking set (single-sourced gate) |
| 13 | `resolveAuthors(client, A[])` | `authorPseudonym` per author (scrub-safe, zero PII) |

### 4.2 · Per-item assembly (in Q1 order)

For each bookmarked comment (author `A`, market `M`, frozen side `S`):
1. **kind** = `parent_comment_id IS NULL ? post : reply`.
2. Build `PostSubstrate` (Q3) or `ReplySubstrate` (Q4).
3. Call the **exported** `buildPostItem` / `buildReplyItem` with: a per-author single-entry held map `new Map([[M, heldBy(A,M)?.side]])` (the marker input — reflects **A's** held side, not the viewer's), `removedSet` (Q12), `marketById` (Q5), `ordinalById`/`topLevelBodyById` (Q11). → a `ProfileArgumentItem` (content + marker, masking-correct).
4. Compute `staked`/`current` (§4.3, sourced per §4.5).
5. Extend → `BookmarkItem` (§4.4): + `authorPseudonym` (Q13); present-variant + `staked` + `current`.

### 4.3 · The Đa/Đb + marker figure rule (steer 3 — the five cases pinned) — APPROVED round 1

Let `held = heldBy(A,M)` (A's current position in M, `quantity > 0`, or none). `marker = computeMarker({ sideAtPostTime: S, heldSide: held?.side ?? null })`.

**Đa/Đb** — computed **iff** `held` exists **AND** `held.side === S`; else **0/0**:
- Đa = final `SideEpisode.stakedBasis` from `computeEpisodes(mergeTradeStream(A's buys[M], A's sells[M]))` (the current S episode; sourced per §4.5).
- Đb = `settledNet(A,M)` exists ? net Σ payout : `computeSell(reserves(M), S, held.quantity).proceeds`.

| Author state on `(M, S)` | held | Đa | Đb | marker |
|---|---|---|---|---|
| holds S (open) | S | live basis | `computeSell` | none |
| fully exited S (open) | none | 0 | 0 | Exited |
| flipped to ¬S (open) | ¬S | 0 | 0 | Flipped |
| held S to settlement | S (persists, INV-4) | frozen basis | net Σ `payout_events` | none (frozen) |
| exited before resolution | none | 0 | 0 | Exited (frozen) |

**Why this is §23-correct:** Đa is the *current* SideEpisode's basis (§23), keyed to A; a holding on ¬S is "a different argument" → the S-anchored card shows 0/0; the marker is A's held-vs-frozen relation (`computeMarker`). Frozen-ness is automatic: a held-to-settlement position persists its row (INV-4), an exited one does not.

### 4.4 · DTO (steer 4 — exposure boundary inherited from the union) — APPROVED round 1

```ts
type BookmarkItem =
  | (Extract<ProfileArgumentItem, { removed: true }>  & { authorPseudonym: string })
  | (Extract<ProfileArgumentItem, { removed: false }> & { authorPseudonym: string; staked: string; current: string });
```

The `Extract` split makes a `staked`/`current`/`marker` leak onto a removed stub a **compile error** — masking enforced by the type, single-sourced through the A5 union. `staked`/`current` are canonical 18-dp strings (never floats — CLAUDE.md §2).

**Self-bookmark:** the read applies **no** viewer≠author filter — the D-3 write guard + UI hiding is the contract, and even a stray self-bookmark renders harmlessly in forced-visitor mode (never a Sell mount). Noted, not filtered.

### 4.5 · FI-2 cross-surface figure identity (REQUIRED ADDITION 1 — the real risk)

**Invariant:** for the same `(author A, market M, side S)`, `loadBookmarks`'s `staked`/`current`/`marker` for a **held-S** item MUST be **byte-identical** to `A`'s own Profile positions figures (SPEC.1 §23 FI-2: one holding, one value — *across surfaces*). Because `positions.ts` is `{userId}`-scoped, the bookmark read builds its **own** batched Q9/Q10 → a query-level drift surface. Two musts:

- **(a) Same-source derivation (build mandate + reviewer check).** Q9 buys and Q10 `bet.sold` sells feed `mergeTradeStream` (which owns the N-3 tie-break: `created_at` asc, cross-source tie = **buy-before-sell**) and `computeEpisodes` — the **identical** pure functions `positions.ts` uses. Q9's columns (`id, side, stake, share_quantity, comment_id, created_at`) and Q10's **sell-source** (`events` `bet.sold`, `payload.sharesSold`, `payload.side`, `eventId` as trade id, `createdAt` as `at`) must mirror `positions.ts` `userBets`/`soldEvents` **exactly**. **Do NOT invent a different sell-source** (e.g. a `bets`-derived sell). `@code-reviewer` diffs the two sourcings; **Gate C confirms** the sell-source parity.
- **(b) Identity test — `list.test.ts::bookmark-figures-match-author-profile`.** Seed an author holding S in M + a bookmarked comment on `(M,S)`; assert `loadBookmarks(viewer)`'s `staked`/`current`/`marker` for that item `===` `loadProfilePositions({ userId: author })`'s `staked`/`current` for `(M,S)` + `computeMarker` for that `(M,S)`. Locks FI-2 across surfaces; **also discharges self-critique #1** (multi-episode re-entry → E2 current basis == exactly what A's Profile shows).

*(Note for build: the shared pure walk functions are already exported from `episodes.ts`; the drift risk is purely in the SQL sourcing, which (a) pins and (b) locks. No `positions.ts` refactor is mandated — web ruled diff-and-test over extraction, §5.3 surgical.)*

---

## 5 · Inherited behaviours (ADR-0032 D-7 — asserted, not rebuilt)

- **Content removal** → removed stub (Q12 `loadRemovedSet`), viewer-independent; the bookmark row persists (comment persists, Bucket A).
- **Author scrub (H2)** → `resolveAuthors` returns the bracketed placeholder pseudonym; figures compute over persisted rows.
- **Frozen-at-resolution (INV-4)** → the settled branch of §4.3 (frozen Đb via net Σ payout, frozen marker).

---

## 6 · SPEC.2 same-commit amendments (ADR-0032 minted obligation — ride the `0024` execute commit)

STEP 0 at **execute** re-verifies each locus's **then-current** count on the live tree (verify-don't-trust); the numbers below are ADR-0032's target, reconciled against the tree at execute:

- **§5.1 Table Inventory** — new `bookmarks` row (Bucket C, new `bookmarks` domain, **carries `user_id`**); table total **22 → 23**; Bucket C **11 → 12**; protected set unchanged; domain count **10 → 11**.
- **§5.2** Bucket-C summary **11 → 12** (+ `bookmarks`).
- **§4.2 Server Actions catalogue** — two rows (`addBookmarkAction`, `removeBookmarkAction`) + F-BM mapping + invocation surfaces.
- **§19.3** — add `bookmarks` to excluded-entirely (`watermark_state`, `cron_alarms`, `bet_receipts` → **four**); update closing recap.
- **§22 ADR Index** — the ADR-0032 row (accepted, 2026-07-20); ADR count **+1**; upper bound `0003–0031` → `0003–0032`; heading / §22.5 SSOT counts reconciled at execute against the then-current index.
- **Appendix A** — file-map rows: `src/db/schema/bookmarks.ts` + `src/server/bookmarks/*` + `(public)/bookmarks/` route.
- **Appendix B** — new `bookmarks` treatment entry (excluded-entirely; cross-ref §19.3; no PII ships because nothing ships).
- **§0** — version bump + change-log row + gates-downstream ADR-range cite (`0003–0032`).

**SPEC.1 back-pressure: none** (§23 already delegates here). The §23 *Forward* "A6's own ADR" → "ADR-0032" precision edit rides the docketed §23 micro-amendment (UI.A5 Gate C docket 1) — **A6 does NOT touch §23**.

---

## 7 · Test plan — the F-BM registry (tests-first; `@test-writer` at Phase 2 start; ADR-0032 §Acceptance verbatim)

| Test | Scenarios | Asserts |
|---|---|---|
| `tests/server/bookmarks/write.test.ts` | `adds-once` · `add-idempotent-on-conflict` · `rejects-self-bookmark` · `remove-idempotent` · `rejects-anonymous` | F-BM-1; UNIQUE backstop; D-3 guard |
| `tests/server/bookmarks/list.test.ts` | `renders-authors-figures-not-viewers` · `recency-order` · `marker-on-authors-held-side` · **`bookmark-figures-match-author-profile`** (FI-2, §4.5b) · exited/flipped **0/0** edge (steer 3) | F-BM-2; §4.3 rule; viewer-independence; **cross-surface identity** |
| `tests/server/bookmarks/masking.test.ts` | `removed-stub` · `scrubbed-author-placeholder` · `no-sell-mount` | F-BM-3; §4.4 union; forced-visitor |

Write/list/masking exercise real rows (the `bookmarks` table + cross-author authors) → real-PG (integration-style); `@test-writer` places them per the ADR paths. **No divergence test** (single-sourced builder — §2 steer 1). The FI-2 identity test (§4.5b) is the load-bearing add.

---

## 8 · Reviewer cascade (§5.11 — web-corrected round 0) + web gate

**Execute cascade (NEVER ultracode):**
`@test-writer` (Phase 2 start — failing F-BM tests incl. the FI-2 identity test) → build → **`@db-migration-reviewer`** (Slice 1 migration + schema) → **`@code-reviewer`** (throughout `src/server/` + the `arguments.ts` export + **the §4.5a Q9/Q10-vs-`positions.ts` sell-source diff**) → **`@security-auditor`** (Slice 3 read model + masking + the `arguments.ts` export — the cross-author read's whole risk surface is leak/exposure) → **Gate C** (web diff-read before merge, incl. the FI-2 sell-source parity check §4.5a).

**Do NOT omit `@security-auditor`** — bookmarks is not a *named* critical path, but two properties pull the gate in: DDL (migration) **and** masking-adjacency on a cross-author surface.

---

## 9 · Verification gate (per slice + pre-PR + pre-merge)

- **Per slice:** `ZUGZWANG_ENV=preview just verify` + the relevant suite green.
- **Critical-path posture (migration + cross-author masking):** `pnpm test:invariants` + `pnpm test:integration` + `just test-db`, run **locally** against PG `:54322` (run `pnpm vitest run` directly so `DATABASE_URL` defaults to local; `docker ps` before any `supabase start`). Full-suite `pnpm vitest run` is the final pre-PR gate (catches cross-suite floors, e.g. the EVENT_TYPES inventory pin).
- **Pre-PR self-audit (§5.10):** schema (every column/type/nullability, FK, index, UNIQUE, Bucket C, `0024` number, no-trigger) · server (both actions vs D-2/D-3; `loadBookmarks` vs the §4.3 rule + viewer-independence + **§4.5a sell-source parity**) · migration (idempotency, no-trigger, singleton constraints) · SPEC.2 (each §6 locus grep-verified, counts reconciled to the then-current tree).
- **Pre-merge:** Gate C web diff-read (incl. FI-2 parity).

---

## 10 · NOT doing (scope fence)

- No ultracode / Workflow / subagent fan-out — gated migration slot.
- No new event type (Option 1 is event-free; EVENT_TYPES stays 24); no `events`/`dharma_ledger`/`bets`/`comments`/`resolution` write.
- No append-only trigger / TRUNCATE guard on `bookmarks` (Bucket C — deliberate; the guard count is unchanged).
- No SPEC.1 §23 text touch (the "ADR-0032" precision edit rides the docketed micro-amendment).
- No new masking/scrub/moderation mechanism — inherited (D-7).
- No `toggle` action (two explicit actions — D-2).
- No dataset-pipeline wiring — `bookmarks` is excluded entirely (recorded in SPEC.2 §19.3 only).
- **No adjacent-surface touch** — `ArgProfile.tsx`, `loadDebateView`, and the profile loader are **untouched** in A6. The add-icon wiring is `BOOKMARK-ADD-WIRE` (§11). A6's only interactive write is the in-page un-bookmark (§3.3).

---

## 11 · OQ-1 RESOLVED (Y refined) + the named add-path follow-on

**OQ-1 ruling (web round 1): Y (refined) — NOT X.** X-as-written is inconsistent: the bookmark icon (canon §3.11) lives on **both** debate-view cards **and** other-user Profile cards, so wiring only the debate view leaves the icon dead on `/u/[other]` — a half-state worse than either extreme. For a gated migration + masking slot, A6 ships the **self-contained vertical** (table · both actions · cross-author read · `/bookmarks` page with working **in-page un-bookmark** · F-BM battery) and keeps **all external add-icon wiring out**.

**`BOOKMARK-ADD-WIRE` (named follow-on — REQUIRED ADDITION 2).** The deferred add path is **one** named task that wires the add-icon **consistently on BOTH** surfaces in a single change:
- **debate view:** `ArgProfile` icon → `add`/`remove` actions + `loadDebateView` returns the viewer's bookmarked-comment set (additive `SELECT comment_id FROM bookmarks WHERE user_id=$viewer AND comment_id IN (rendered)` — **no masking-logic touch**);
- **other-user Profile (`/u/[other]`):** the profile loader returns the same viewer-bookmarked-set for its argument cards.

**Gates:** web-gated on its own; `@security-auditor` reviews the `loadDebateView` diff (additive viewer-bookmarked-set query, no masking change). **MANDATORY before `TESTING.0`** — the bookmark feature is not end-to-end usable (no add path) until it lands, so it is a hard pre-testing gate, **not** an optional backlog item. **Session placement is the operator's call at its kickoff;** this plan fixes only the pre-`TESTING.0` gate, not the slot.

*(No other open questions — D-1…D-8 are otherwise fully specified by ADR-0032 and the four steers.)*

---

## 12 · Self-critique (ranked; kept per template)

1. **Multi-episode same-side re-entry.** If A exited S (episode E1, the bookmarked comment) then re-entered S (E2, a *new* opener comment), §4.3 shows **E2's** current basis on the E1-comment's card (held.side===S). *Resolution:* §23-correct — Đa is the *current* SideEpisode's basis keyed to A; it matches exactly what A's own Profile positions table renders. **Now locked by the §4.5b FI-2 identity test** (E2 current basis == A's Profile figure).
2. **FI-2 cross-surface drift (the real risk — web-flagged).** The read's own Q9/Q10 could diverge from `positions.ts` sourcing. *Mitigated:* §4.5a same-source mandate (mirror `userBets`/`soldEvents`, reuse `mergeTradeStream`+`computeEpisodes`, don't invent a sell-source) + `@code-reviewer`/Gate C sell-source diff + §4.5b identity test.
3. **`arguments.ts` export widens the module surface.** Two pure builders exported — minimal, behavior-preserving. *Mitigated:* `@security-auditor` on the diff; the union masking is unchanged.
4. **Test placement (server vs integration dir).** The F-BM tests need real rows; the ADR names `tests/server/bookmarks/*`. `@test-writer` places them; if they need the live `bookmarks` table they may land integration-style — noted, not blocking.

---

## 13 · Ratification record

**Operator-ratified 2026-07-21** (web-reviewed rounds 0–1). v2 folds OQ-1 → Y (refined), §4.5 FI-2 cross-surface figure identity, and §11 `BOOKMARK-ADD-WIRE`. Committed as `plan: UI-A6 — Bookmarks (ratified)`; **merge SHA to fill post-merge** — PR #___ · mergeCommit `______`.

**Execute = a fresh chat** (`/clear` first) opening against `@docs/plans/UI-A6.md`: `/model opus` at STEP 0 (Fable-5 window closed Jul 19) · gated plan→execute · **NEVER ultracode** · `@db-migration-reviewer` + `@code-reviewer` + `@security-auditor` cascade · Gate C on the execute PR · the §6 SPEC.2 rows land same-commit with migration `0024`. This plan chat ends at the plan commit.
