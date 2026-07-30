# BOOKMARK-ADD-WIRE — wire the bookmark add path on the debate view (+ severable Profile arm)

| | |
|---|---|
| **Task ID** | `BOOKMARK-ADD-WIRE` (informally "B1" — **not** `AUDIT-FIX-B1`, which is a different, landed task) |
| **Plan file** | `docs/plans/BOOKMARK-ADD-WIRE.md` (per ratified decision D6 — never `B1.md`) |
| **Ground** | Plan-authored against `origin/main` @ `9d289b3` (PR #271). **Execute re-grounded** on `origin/main` @ `b6495af` (PR #272, ADR-0034); `git merge-base --is-ancestor b6495af origin/main` exit 0 at STEP 0d. |
| **Status** | RATIFIED — web review complete; the corrections below are binding. Executing Slices 0, 1, 2, 3, 5. |
| **Gates** | Critical-path-adjacent (`src/server/**` diff) ⇒ full ritual: tests-first · `@code-reviewer` · `@security-auditor` on the additive query · §5.10 pre-PR self-audit · Gate C on the execute PR. **NEVER `ultracode`.** |
| **Blocking dependency** | ADR-0032 `accepted`; UI-A6 landed at `9423eef` (#254). Both satisfied. |
| **Blocks** | `TESTING.0` — ADR-0032/UI-A6 §11 makes this a **hard pre-testing gate**: the bookmark feature is not end-to-end usable without an add path. |

---

## Ratified corrections (relayed verbatim from the execute kickoff — binding; they override the body below)

> **C1.** ADR-0034 is ALREADY MERGED. Remove it from Slice 1's file list. Slice 1 ships code + tests only. Cite the ADR; author none. You mint no ADR in this run — next free is 0035 and you do not claim it.
>
> **C2.** SLICE 4 DOES NOT RUN TONIGHT. The Profile arm is gated on a design ruling that has not been made. Run Slices 0, 1, 2, 3, 5. Do not create any file under `src/components/profile/**` or `src/server/profile/**`. Do not extract the ArgumentList primitive. State in the PR body that Slice 4 is deferred pending the ruling.
>
> **C3.** Slice 3 renders the FULL cluster on reply cards — bookmark active, download `disabled` with the same aria-label as ArgProfile, matching ArgProfile byte-for-byte. Canon §6 names bookmark/download on the reply card. Bookmark-only guarantees a POLISH.3 defect row.
>
> **C4.** OQ-6 is IN: fix `UnbookmarkButton.tsx:36` to branch on the typed `{ ok }` result. It currently discards it, so a failed un-bookmark renders as success. One line, in Slice 2.
>
> **C5.** OQ-2/4/5 (rate limit, ban gate, freeze gate) are OUT. Add none of them. State in the PR body that B1 WIDENS a pre-existing gap — `removeBookmarkAction` already has a live production caller on `/bookmarks` — rather than creating one.
>
> **C6.** OQ-3: silent revert on failure. No toast. Invent no user-facing copy.
>
> **C7.** SPEC.2 amendments are SIX, not five (Slice 5).

Consequently: **OQ-1 stays open** (Slice 4 deferred), **OQ-2/4/5 are carried** (C5), **OQ-3 is settled as silent revert** (C6), **OQ-6 is IN** (C4), and the ADRs-needed section is discharged by the already-merged ADR-0034 (C1).

### STEP 0f re-verification on the live tree (execute)

| Plan §2 assumption | Live-tree result |
|---|---|
| Migration head `0024` | **CONFIRMED** — `drizzle/migrations/0024_bookmarks.sql` is head. |
| `EVENT_TYPES` is 24 | **CONFIRMED** — 24 entries. |
| `bookmarks_user_id_idx` / `bookmarks_user_id_comment_id_uq` | **CONFIRMED** (`src/db/schema/bookmarks.ts`); a third index `bookmarks_comment_id_idx` also exists. |
| `comments_user_id_idx` / `comments_market_id_idx`, no `(user_id, market_id)` composite | **CONFIRMED** (`src/db/schema/comments.ts:59-67`). No new index — §2's no-DDL guard holds. |
| A component-test harness exists? | **CORRECTED — one DOES exist.** `@testing-library/react` 16.3.2 + `jsdom` 29.1.1 are committed devDependencies, and 20+ `tests/**/*.test.tsx` files use them under a per-file `// @vitest-environment jsdom` docblock (e.g. `tests/unit/debate/render/price-chart.test.tsx`). Plan §7's "AGENTS.md §9 documents no component-test harness" premise and self-critique #3 ("UI behaviour has no automated coverage") are **factually wrong on disk**. Slices 2–3 therefore ship render tests; AGENTS.md §9 is stale on this point (recorded, not fixed here — out of scope). |
| Slices 1–3 reference `src/**/profile/**`? | **NO** — severability (self-critique #6) holds by build, not just by import-graph read. |

---

## Tracker context

UI-A6 (#254) shipped the complete bookmark vertical *except* the add path: the `bookmarks` table (migration `0024`), both idempotent Server Actions, the cross-author `loadBookmarks` read (13 batched queries), the `/bookmarks` surface, and the F-BM battery (17 tests, all green at ground). It deliberately kept **all external add-icon wiring out** (`docs/plans/UI-A6.md:242`, `:248`), naming this task as the follow-on.

Consequence at ground: **`addBookmarkAction` has zero production call sites.** It is fully built and fully tested code that nothing can reach. `removeBookmarkAction` has exactly one caller, `src/components/bookmarks/UnbookmarkButton.tsx:36`. B1 is the commit that makes the add path reachable.

### Spec-gate result (STEP 0, recorded)

- **No SPEC.1 / SPEC.2 / ADR clause binds where a viewer-scoped bookmark read lives.** `loadViewerMarketContext` and `viewer-context` have **zero** hits across `docs/specs/` and `docs/adr/`. SPEC.2 §4.2 governs write actions only and explicitly places read-only loaders *outside* its catalogue (`:415`, `:417`). This is therefore a **plan-level correction, not a SPEC-FIRST halt**.
- **SPEC.2 §11 enumerates named surfaces; it does not impose a general rule.** Step 4 is parameterised *"per the surface table"* (`:1203`) over six enumerated surfaces, and §11 already carves Server Actions out of the idempotency-header arm by name (`:1183`). `bookmarks` is **absent from the table — recorded as a deliberate carry.** Consequence-test that settles it: a general reading would retroactively put 14 of 16 catalogued Server Actions in violation, including every admin market-lifecycle action and `moderateComment`, all of which landed through the full gated ritual. See **OQ-2** for the reachability delta this task introduces.
- **SG-3 is not spec.** The `loadDebateView` viewer-independence constraint is defined at `docs/plans/UI-A2.md:64` under *"Binding scope guards (plan law)"* — a landed task's self-imposed scope guard, echoed into five `src/` comments. Zero hits in `docs/specs/` or `docs/adr/`. Its `SG-N` numbering is plan-local and overloaded (`docs/plans/UI-A3.md:66` defines a different SG-3). B1 nonetheless **preserves** the underlying property, for the stronger reason in D1.

---

## Approach (one paragraph)

Extend the existing, purpose-built viewer-scoped read (`loadViewerMarketContext`) with two additive, market-scoped, ID-only arrays — the viewer's bookmarked comment ids and the viewer's own comment ids in this market — and thread them down the already-existing `viewer` prop to the four card render paths, where a new client `BookmarkToggle` replaces today's permanently-disabled bookmark icon. `loadDebateView`'s signature and DTO are **untouched**. No migration, no schema change, no new event type, no masking-logic edit, no change to `add.ts`/`remove.ts`. The Profile arm is a separate, cleanly severable slice pending a design ruling.

---

## Ratified decisions (do not re-decide)

### D1 · The viewer-bookmarked read lives in `loadViewerMarketContext`, not `loadDebateView`

Home: `src/server/debate-view/viewer-context.ts`. **Market-scoped, not rendered-ID-scoped:**

```sql
SELECT b.comment_id FROM bookmarks b
  JOIN comments c ON c.id = b.comment_id
 WHERE b.user_id = $viewer AND c.market_id = $market
```

**REASON — this overrides the `docs/plans/UI-A6.md:251` forward note.** ADR-0025 binds the debate `.md` export to consume `loadDebateView(db, { market })` → `DebateViewModel` and to serialize **only** the masked variants, *reimplementing nothing* (`docs/adr/0025-debate-md-export.md:59-60`, `:86-87`; `docs/specs/debate-export.md:21`; `docs/specs/SPEC.2.md:2284`). Putting viewer state on that model puts private per-viewer state into a **public export's input type**, while ADR-0032 D-8 excludes `bookmarks` from the public dataset **entirely** (`docs/specs/SPEC.2.md:1942`, `:2898`). The export would not serialize it today, but the type would permit it, and "reimplement nothing / serialize only the masked variants" is exactly the discipline that keeps that guarantee cheap. `loadViewerMarketContext` already exists for precisely this class of data and is invoked *beside* `loadDebateView` in the page RSC.

Secondary benefit: it also preserves UI-A2's SG-3 without depending on SG-3 being binding, and it resolves the internal contradiction in UI-A6's own plan, where `:242` forbids touching `loadDebateView` and `:251` requires it.

### D4 · The same read returns `ownCommentIds` for own-argument icon suppression

Second additive array, same market scope, from the same transaction.

**Explicitly rejected — pseudonym comparison.** The only viewer identity currently reaching the client tree is `ownPseudonym` (`m/[slug]/page.tsx:81`), used solely for composer profile links. Comparing it against `post.author.pseudonym` fails on H2 scrub: a scrubbed author renders under a **placeholder** pseudonym (SPEC.1 §23), so a scrubbed viewer would collide with every scrubbed stranger and see their arguments treated as their own — silently suppressing a legitimate affordance, or worse, mis-attributing authorship.

**Explicitly rejected — adding an author id to the debate DTO.** The `DebateComment` intermediate is the sole `user_id` exposure path, and ADR-0025 requires the export never serialize it (`docs/specs/debate-export.md:21-23`). Adding an author id to `DebatePost`/`DebateReply` would place a user id in the export-bound type — the same failure mode D1 exists to prevent, one field down.

### S1 · Scope covers POSTS **and** REPLIES

Canon §3.11 governs all card renders; canon §6 names bookmark/download on the reply card; canon §4 ruling 1 says posts *and* replies. At ground, `ReplyCard.tsx` and `ReplyPreview.tsx` carry **no bookmark affordance at all** — not even a disabled one (verified: the only `Bookmark` import in `src/components/debate/**` is `ArgProfile.tsx:1`). `list.ts` and `BookmarkCard` already support `kind: "reply"`, test-locked by `bookmark-list::reply-kind-renders`. Wiring posts only would leave the read model half-reachable.

### D5 · Optimistic UI with revert-on-failure; invalidation is caller-owned

- **Do not edit `add.ts` or `remove.ts`.** No `revalidatePath`/`revalidateTag` added to either — invalidation stays caller-owned, per the `UnbookmarkButton` precedent.
- Callers **must** branch on the typed `{ ok }` result. Both actions **return** failures and never throw (`add.ts:23-28`, `remove.ts:18-20`).
- The debate view deliberately does **not** call `router.refresh()`. `UnbookmarkButton` needs a refresh because its item must *drop from a list*; here the arrays feed icon state only, so optimistic local state is sufficient and a refresh would re-run `loadDebateView`'s 13–14 sequential queries for an icon toggle.

### D3 · No shipped masking behaviour changes; propagate the stricter rule

Stated per read path in §5 below. The rule B1 propagates: **a removed argument never renders an ADD affordance on any newly-wired surface.** The `BookmarkCard` / `loadDebateView` removed-author asymmetry is a **named deliberate carry** (row C-1), not fixed here.

### D6 · Plan filename

`docs/plans/BOOKMARK-ADD-WIRE.md`.

---

## 1. Thesis invariants touched

**None.** ADR-0032's zero-invariant-surface property is preserved by construction, and B1 adds no write path — it only makes an existing, reviewed one reachable.

| Invariant | Effect | Why |
|---|---|---|
| INV-1 bet↔comment atomicity | **Untouched** | No `bets`/`comments` write. A bookmark creates no stake and no position; it is not a comment-free buy. |
| INV-2 Dharma non-transferable / no overdraft | **Untouched** | No `dharma_ledger` row. |
| INV-3 side frozen at post-time | **Preserved (read-only)** | The new reads select `comment_id` and `comments.id` only; `side_at_post_time` is never written. |
| INV-4 resolutions append-only | **Untouched** | No `resolution_events`/`payout_events` contact. |

`EVENT_TYPES` stays **24** — no event type is added (ADR-0032 Option 1 is event-free).

Refusal triggers (CLAUDE.md §3): none crossed. No Dharma transfer, no admin participation surface (admin has no `users` row; `bookmarks.user_id` is `NOT NULL` FK → `users.id`, so an admin identity is unrepresentable), no market/social content invented, no K_eff surface, no HTTP inside a DB transaction (the two new statements are SELECTs inside the existing read-only transaction).

## 2. Data model changes

**MIGRATION: NONE.** Stated explicitly per the kickoff. Migration head stays `0024_bookmarks.sql`. No new table, column, index, enum value, trigger, or constraint. No `src/db/schema/**` edit. No `drizzle/migrations/**` file.

Consequence: **`@db-migration-reviewer` is NOT invoked** — a reasoned waiver, not an omission (see §Reviewer cascade). If any slice develops a want for DDL — including an index to serve the D1 join — that is a **LOUD STOP** and an open question, never absorbed.

Index adequacy for the two new queries, from the schema (no `EXPLAIN` run, no DB touched this pass):
- **Q-A** drives on `bookmarks.user_id` (`bookmarks_user_id_idx`, or the leading column of `bookmarks_user_id_comment_id_uq`), then joins to `comments` by **primary key** (`c.id = b.comment_id`), applying `c.market_id` as a residual filter. `comments_market_id_idx` exists (`comments.ts:61`; `0001:286`) but is probably *not* the access path — `comments_pkey` is. The bounded side is the viewer's bookmark count, not the market's comment count.
- **Q-B** filters `comments` on `(user_id, market_id)`. No composite index exists; `comments_user_id_idx` and `comments_market_id_idx` both do (`comments.ts:60-61`). Bounded by one viewer's comments in one market. **No new index** — SG: no DDL.
- Execute chat re-verifies both index names on the live tree at STEP 0 (verify-don't-trust).

## 3. API surface

No new endpoint, no new Server Action, no new wire error code, no envelope change. The two existing actions are consumed **exactly as shipped**.

### The DTO extension (`src/server/debate-view/viewer-context.ts`)

```ts
export type ViewerMarketContext = {
	position: { side: "YES" | "NO"; quantity: string; currentValue: string } | null;
	balance: string;
	spendableToday: string;
	/** B1 — comment ids in THIS market the viewer has bookmarked. ID-ONLY, never content. */
	bookmarkedCommentIds: string[];
	/** B1 — comment ids in THIS market authored BY the viewer (own-argument suppression, D4). */
	ownCommentIds: string[];
};
```

**Arrays, not `Set`s — load-bearing.** A `Set` does not survive the RSC → client serialization boundary. The loader returns arrays; `DebateView` converts to `Set` once, client-side.

### The two queries, and exactly where they run

Both run **inside the existing** `client.transaction(async (tx) => { … })` in `loadViewerMarketContext` (`viewer-context.ts:87`) — SELECTs only, zero writes, default READ COMMITTED, display-grade reads. No new transaction and no new round-trip beyond the two statements. Statement count for that module goes **3–4 → 5–6**.

```ts
// Q-A — the viewer's bookmarked comment ids in this market (D1). Market-scoped,
// NOT rendered-ID-scoped: no dependency on what loadDebateView chose to render.
const bookmarkedRows = await tx
	.select({ commentId: bookmarks.commentId })
	.from(bookmarks)
	.innerJoin(comments, eq(comments.id, bookmarks.commentId))
	.where(and(eq(bookmarks.userId, args.userId), eq(comments.marketId, args.marketId)));

// Q-B — the viewer's OWN comment ids in this market (D4 own-suppression).
const ownRows = await tx
	.select({ id: comments.id })
	.from(comments)
	.where(and(eq(comments.userId, args.userId), eq(comments.marketId, args.marketId)));
```

Neither query reads `comments.body`, `side_at_post_time`, or any author column. **Neither may be used as a masking input** — masking remains keyed solely on `loadRemovedSet` inside `loadDebateView`.

`loadDebateView`'s signature and `DebateViewModel` are **unchanged by B1.** This is a hard scope guard; any diff line inside `load-debate-view.ts` is a defect by definition.

## 4. UI / user flow

### Prop threading path — named end to end

```
m/[slug]/page.tsx  ── ZERO EDITS ──▶ <DebateView viewer={viewer} … />        (:79, already threaded)
  │   (viewer is already computed at :46-52 and passed at :79; the extended DTO
  │    rides the SAME prop, and src/components/debate/types.ts:24 already
  │    re-exports ViewerMarketContext, so the client type updates for free)
  ▼
DebateView.tsx (client, :49)
  │   derives once:  const bm = viewer === null ? null
  │                    : { saved: new Set(viewer.bookmarkedCommentIds),
  │                        own:   new Set(viewer.ownCommentIds) };
  ├──▶ PostFocusHeader   (+1 prop)  ──▶ ArgProfile  (commentId={post.id}, bookmarks={bm})
  ├──▶ PostScroller      (+1 prop)  ──▶ PostCard    (+1 prop)
  │                                        ├──▶ ArgProfile   (commentId={post.id}, bookmarks={bm})
  │                                        └──▶ ReplyPreview (+1 prop) ──▶ ReplyCard (+1 prop)
  └──▶ ReplyScroller     (+1 prop)  ──▶ ReplyCard   (+1 prop)
```

- **`ArgProfile` needs `commentId` — it comes from `post.id`**, passed by its only two call sites, `PostCard.tsx:61-67` and `PostFocusHeader.tsx:65-71`. `id: string` exists on **both** `DebatePost` union variants (`load-debate-view.ts:88`, `:98`), so no DTO change is needed to obtain it.
- **`ReplyCard` gets its id from its own `reply.id`** — present on both `DebateReply` variants (`:64`, `:67`) — so it needs only the `bookmarks` prop, not a `commentId` prop.
- **`PostCard` and `PostFocusHeader` are already `"use client"`** (`:1` each), and `ArgProfile` is imported only by them, so it already ships in the client bundle. **No new client boundary is introduced.**
- **`DebateColumn.tsx` is UNTOUCHED** — the scrollers are constructed in `DebateView`'s scope and passed as `children`, so nothing threads through it.
- **`dialogs.tsx` (`PostPopup`) is UNTOUCHED** — it renders title/side/author/image/body with no icon cluster at ground (`:39-52`), so there is no affordance to wire. Named in §8.
- **Mechanism: prop-drilling, one object prop.** React context is **rejected**: `git grep createContext|useContext -- src` returns **nothing**, so context would introduce a new pattern; and `viewer` itself is already prop-drilled three levels (`DebateView` → `SlotHeader`/`PositionStrip`/`BetComposer`). Cost is 6 signature additions of a single prop, all mechanical.

### `showActions` — the explicit answer

**`showActions` does NOT become the conditional-hide hook, and no new prop replaces it.** It currently gates the *entire* cluster — bookmark **and** download (`ArgProfile.tsx:64-85`) — so using it for own-suppression would also remove the download trigger from the viewer's own arguments, an unrelated regression. Its semantics stay exactly as-is (default `true`, still passed by no call site). Own-suppression is a condition **inside** the bookmark branch, driven by the new `bookmarks` prop.

### Icon states — the full matrix on a newly-wired card

| Viewer state | Argument | Renders |
|---|---|---|
| Signed out (`bookmarks === null`) | any non-removed | **Today's disabled icon, unchanged** — `disabled` + `aria-disabled` + `aria-label="Bookmark — sign in to use"` |
| Signed in | **own** (`bm.own.has(id)`) | **Nothing** — no icon at all (canon: only someone else's is bookmarkable) |
| Signed in | other's, not saved | Active outline icon → `addBookmarkAction(commentId)` |
| Signed in | other's, saved (`bm.saved.has(id)`) | Active **filled** icon → `removeBookmarkAction(commentId)` (matches `UnbookmarkButton.tsx:41` `fill-current`) |
| any | **removed** | **No icon** — enforced structurally (see §5) |

The `download` trigger stays `disabled` in every cell. Out of scope (§8).

### The one new file

`src/components/bookmarks/BookmarkToggle.tsx` (client) — sits beside `UnbookmarkButton.tsx`. Owns optimistic local state seeded from the prop, `useTransition`, the add/remove branch, `{ ok }`-branching with revert on failure, and exports the shared `BookmarkAffordance` type consumed by `ArgProfile`/`ReplyCard`. One new file total.

## 5. Failure modes + removal-masking, stated per read path

### Masking, per read path (D3)

| Read path | Removed argument renders today | After B1 |
|---|---|---|
| `loadDebateView` → `PostCard` (market view) | Early return at `:39-56`: `SideBadge` + `RemovedPlaceholder` + aggregate + replies. **`ArgProfile` never constructed** — the removed union variant has no `author`/`marker`, so it *cannot* be. | **Unchanged. No add affordance** (structurally impossible, not a runtime check). |
| `loadDebateView` → `PostFocusHeader` (post view) | `:57-61`: `SideBadge` + `RemovedPlaceholder` only; no `ArgProfile`. | **Unchanged. No add affordance.** |
| `loadDebateView` → `ReplyCard` (both preview + scroller) | `:14-21`: `SideBadge` + `RemovedPlaceholder`. No icon exists anywhere on this card. | **Icon added to the NON-REMOVED branch ONLY** (`:22-36`). The removed branch gains nothing — this is the stricter rule propagated per D3. |
| `loadBookmarks` → `BookmarkCard` (`/bookmarks`) | `:27-39`: stub + `AuthorHead` + an **active** `UnbookmarkButton`, by design so a removed item stays un-bookmarkable. | **Unchanged — B1 does not touch this surface.** |
| `loadProfileArguments` → `ArgumentList` (`/u/[pseudonym]`) | `:43-52`: `SideChip` + stub. No icon anywhere. | **Unchanged unless S2 lands**; if it does, the removed row gains no icon (stricter rule). |

**Carry row C-1 — the removed-author asymmetry (named, deliberately NOT fixed here).** `loadDebateView` never resolves a removed comment's author (`:152-154`: *"a removed comment's pseudonym/PFP is never read"*), whereas `BookmarkItem`'s removed variant carries `authorPseudonym` and `BookmarkCard:33` renders it. The two surfaces disagree on whether a removed comment's author identity is disclosed. B1 touches neither behaviour. Recorded so a future reader does not mistake it for something B1 introduced; a fix belongs to its own task with a web ruling.

**ID-set safety.** The market-scoped Q-A set may contain ids of comments that are removed, or not rendered at all. Both are inert: it is an **ID-only** set that never gates content and never feeds masking, and no removed node renders an affordance to consult it. Per D1 it is deliberately market-scoped rather than rendered-ID-scoped, so it must not be assumed congruent with `model.posts`.

### Action failure modes

| Failure | Surfaced how | Handling |
|---|---|---|
| `{ ok: false, code: "unauthenticated" }` | Session expired between render and click | Revert optimistic state. Near-unreachable: signed-out viewers get the disabled icon and never call the action. |
| `{ ok: false, code: "self_bookmark_forbidden" }` | Own content | Unreachable through the UI (icon hidden by D4) — the action's app-layer guard remains the defense-in-depth belt. |
| `{ ok: false, code: "comment_not_found" }` | Malformed/absent id | Revert. Structurally unreachable: ids come from rendered DTOs. |
| Network/transport throw | The action rejects | The `useTransition` callback must not leave the icon in a lying state: revert in a `catch`. Note the actions themselves never throw *by contract*, but the RPC transport can. |
| Redis/rate-limit | n/a | No limiter on this surface (see OQ-2). |

**No toast.** `git grep sonner|toast -- src package.json` returns **nothing** — there is no toast infrastructure at ground. Failure handling is a silent revert. Inventing user-facing failure copy is out of bounds (see OQ-3).

## 6. Edge cases

1. **Removed argument** — no add affordance, per §5. Structural, not conditional.
2. **Own argument** — icon absent entirely (not disabled), via D4's `ownCommentIds`.
3. **Scrubbed (H2) author** — handled correctly *because* D4 uses ids, not pseudonyms; this is the case that kills pseudonym comparison.
4. **Signed-out viewer** — today's disabled "sign in to use" icon is preserved verbatim; no new sign-in prompt, no new copy.
5. **Double-tap / rapid toggle** — the client always knows icon state and calls the matching action; `ON CONFLICT DO NOTHING` and the unconditional scoped `DELETE` make both idempotent (ADR-0032 D-2's reason for two actions over a toggle).
6. **Same comment rendered twice** — a post can appear in both the market column and the focus header, and a reply in both `ReplyPreview` and `ReplyScroller`. Optimistic state is **per-`BookmarkToggle`-instance**, so two mounted instances of the same comment can disagree until the next server render. Accepted for v1; named in the self-critique (#2) with the cheap alternative recorded.
7. **Closed / Resolved / Voided market** — bookmarking still works. A bookmark is not a market action (ADR-0032: *"not a market action at all"* — no price move, no ledger row), and `add.ts` carries no state gate. Accepted.
8. **Banned viewer** — `add.ts` does not check `users.banned_at`. Verified: ban-on-write is enforced at exactly **one** site repo-wide, `bets/endpoint.ts:177`. See **OQ-4**.
9. **Post-freeze** — `add.ts` does not check `isFrozen()`. Verified: the freeze is enforced at exactly **two** sites repo-wide, `bets/endpoint.ts:197` and `cron/close-due-markets/route.ts:62`; no Server Action checks it. See **OQ-5**.
10. **Empty result** — both arrays empty is the common case; `new Set([])` is correct and the icons render unsaved.

## 7. Test plan

**Tests-first via `@test-writer` for Slice 1** (the server read is the new behaviour). `@test-writer` never edits `src/`.

**Slice 1 — extend `tests/integration/viewer-context.integration.test.ts`** (the existing vehicle, already the parity harness named at `viewer-context.ts:28`):

| Case | Asserts |
|---|---|
| `bookmarked-ids-scoped-to-market` | A bookmark on a comment in market M2 does **not** appear in M1's result |
| `bookmarked-ids-scoped-to-viewer` | Another user's bookmark of the same comment does not appear |
| `bookmarked-ids-includes-removed` | A bookmarked `content_removed` comment's id is still returned (ID-only), **and** no content/author field is present on the DTO |
| `own-comment-ids-scoped-to-market` | Own comments in M2 excluded from M1 |
| `own-comment-ids-excludes-others` | Another author's comment in M1 excluded |
| `empty-arrays-when-none` | Both arrays `[]`, not `null`/`undefined` |
| `existing-fields-unchanged` | `position`/`balance`/`spendableToday` byte-identical to pre-B1 behaviour (regression belt on the shared transaction) |

**Zero-diff belt on the masking spine:** the execute chat greps the diff to prove `src/server/debate-view/load-debate-view.ts` has **no changed lines**, and that `add.ts`/`remove.ts` are untouched. Mechanical, in the §5.10 self-audit.

**Slices 2–3 (UI) — a known coverage gap, named not hidden.** AGENTS.md §9 documents no component-test harness (Vitest only; no Playwright, no E2E). The execute chat verifies at STEP 0 whether a component-test dependency exists. **If none, UI behaviour is covered by manual review plus the Slice-1 server tests, and that limitation is stated explicitly in the PR** — it is not papered over. The existing F-BM-1 battery (6 write cases) already locks the action semantics the UI depends on, and all 17 bookmark tests are green at ground.

**Regression gate:** full `pnpm vitest run` (the whole-suite pre-PR gate) plus `ZUGZWANG_ENV=preview just verify`.

## 8. Out of scope

- **Any edit to `loadDebateView` / `load-debate-view.ts`.** Hard guard (D1).
- **Any edit to `add.ts` / `remove.ts`**, including adding `revalidate*` (D5).
- **Any DDL / migration / `src/db/schema` edit** (§2).
- **The `download` trigger** — stays disabled on every card. Wiring the ADR-0025 export button is a separate task.
- **`PostPopup` (`dialogs.tsx`)** — no cluster at ground; not in canon §3.11's card anatomy for this task.
- **The C-1 removed-author asymmetry** — named carry, not fixed (D3).
- **A rate limiter / freeze gate / ban gate on the bookmark actions** — OQ-2 / OQ-4 / OQ-5 raise them; B1 does not absorb them.
- **Retrofitting `UnbookmarkButton` to branch on `{ ok }`** — it currently ignores the result (`:36`). Named as OQ-6; a one-line fix, but on a surface B1 otherwise does not touch.
- **`ArgumentList` primitive extraction** — belongs to Slice 4 only, and per the kickoff is **not a dependency of any other slice**.
- **SPEC.1 text** — no back-pressure (ADR-0032 §D-2: §23 already delegates to the ADR; F-BM-1 acceptance already exists).
- **The SPEC.2 banner-vs-metadata version drift** beyond the single-line reconciliation named in §Amendments.

---

## Slices

Sequential; each ends green (`just verify` + the relevant suites). Slice order is read → posts → replies → (severable) profile → docs.

| Slice | Name | Files | Reviewer |
|---|---|---|---|
| **0** | Re-ground (no code) | none — verify ceilings, index names, migration head, SPEC.2 counts, component-test availability on the live tree | — |
| **1** | The server read | `src/server/debate-view/viewer-context.ts` · `tests/integration/viewer-context.integration.test.ts` · `docs/adr/0034-*.md` | `@test-writer` first → `@code-reviewer` → **`@security-auditor`** |
| **2** | Debate view — posts | `src/components/bookmarks/BookmarkToggle.tsx` (new) · `src/components/debate/ArgProfile.tsx` · `PostCard.tsx` · `PostFocusHeader.tsx` · `scrollers.tsx` (`PostScroller`) · `DebateView.tsx` | `@code-reviewer` |
| **3** | Debate view — replies | `src/components/debate/ReplyCard.tsx` · `ReplyPreview.tsx` · `scrollers.tsx` (`ReplyScroller`) · `DebateView.tsx` | `@code-reviewer` |
| **4** | **SEVERABLE** — Profile arm (S2) | `src/components/profile/ArgumentList.tsx` (+ extract a shared card primitive) · `src/server/profile/*` (viewer-bookmarked set for `/u/[other]`) · `src/app/(public)/u/[pseudonym]/page.tsx` | `@code-reviewer` → `@security-auditor` |
| **5** | Docs | `docs/specs/SPEC.2.md` amendments | — (rides the §5.10 audit) |

**Severability of Slice 4 is a structural property, not a promise.** Slices 1–3 reference nothing in `src/components/profile/**` or `src/server/profile/**`. Slice 1's DTO is market-scoped and consumed only by the debate view. If the S2 design ruling drops the Profile arm, Slice 4 is deleted and **no other slice changes by one line**. The `ArgumentList` primitive extraction lives *inside* Slice 4 and is a dependency of nothing.

## Reviewer cascade

Run **sequentially**, one reviewer touching the DB at a time (concurrent `pnpm vitest` against the shared local Postgres :54322 produces spurious hook timeouts). Each invocation passes `@docs/plans/BOOKMARK-ADD-WIRE.md` and a **directed, per-point scope** — a generic "review this diff" is what let AUDIT-FIX-B5's fail-open through.

| Reviewer | Slice | Directed scope |
|---|---|---|
| `@test-writer` | 1, at start | RED-first cases from §7 against the pinned DTO. Never edits `src/`. |
| `@code-reviewer` | 1, 2, 3, (4) | §2/§3 conformance; the two new SELECTs inside the existing read-only transaction; `{ ok }`-branching at every new call site; no `src/server/**` import into a client component. |
| **`@security-auditor`** | **1 (mandatory), 4 if it lands** | **Named by the kickoff and by UI-A6 §11.** Verify AND STATE, per point: (a) the additive query is ID-only and reads no content/author column; (b) it is **not** used as a masking input; (c) `load-debate-view.ts` has a zero-line diff; (d) the removed-argument matrix in §5 holds on every newly-wired path; (e) own-suppression cannot be defeated by a scrubbed pseudonym; (f) no viewer state reaches `DebateViewModel` and therefore the export. |
| `@db-migration-reviewer` | **NOT INVOKED** | **Reasoned waiver:** zero `src/db/schema/**` and zero `drizzle/migrations/**` diff (§2). Recorded here so the omission is visibly deliberate, per the ratified-reviewer-sequence rule. If any DDL appears, this waiver is void and the reviewer is added. |

## SPEC.2 amendments riding execute (same-commit)

Per the ADR-0026 / same-commit doctrine. The execute chat re-verifies each locus's then-current text before editing (verify-don't-trust).

1. **§4.2 `:412` — the `addBookmarkAction` invocation-surface cell.** Currently reads *"**No A6 surface** — the add-icon on the debate view (`ArgProfile`) + other-user Profile cards is the named follow-on **BOOKMARK-ADD-WIRE** (§11); the action + its F-BM-1 tests land at A6 so the wiring invents no logic"*. That statement becomes false the moment Slice 2 lands. Replace with the actual wired surfaces — the debate-view post cards (`ArgProfile` via `PostCard`/`PostFocusHeader`) and reply cards (`ReplyCard`) — with the Profile arm named only if Slice 4 lands.
2. **Fix the broken `(§11)` cite in the same edit.** Inside SPEC.2, `§11` resolves to `docs/specs/SPEC.2.md:1166 — §11 Rate-Limit & Idempotency Contract`. The intended referent is `docs/plans/UI-A6.md` §11. Rewrite as an explicit cross-document cite.
3. **Appendix A — add the missing `src/server/debate-view/viewer-context.ts` row**, describing the extended DTO. There is **no** Appendix A row for this module today (zero `viewer-context` hits in `docs/specs/`) — a pre-existing UI.A2 omission that B1 pays while it is extending that exact contract. Small, same-commit, defensible; flagged so it is not mistaken for scope creep.
4. **§0 — version bump `1.0.20 → 1.0.21` + a change-log row** (newest-LAST, matching the live shape).
5. **Banner `:3` reconciliation.** The banner reads `Status: 1.0.19` while §0 metadata reads `1.0.20` — pre-existing drift found at recon R1. Bumping metadata while leaving the banner two patches behind makes it worse, so the banner is corrected in the same edit. One line.

**SPEC.1: no amendment.** §23 delegates bookmarks entirely to ADR-0032, and F-BM-1's acceptance already exists.

## ADRs needed

**ADR-0034 — proposed, REQUIRED, rides the Slice-1 commit** (next free number confirmed at recon R1: highest file is `0033`; `0002` unused, `0012` reserved "in flight").

*Working title:* "Viewer-scoped debate reads live outside the export-bound view model."

*Why an ADR and not just a plan note:* it (a) overrides a ratified plan's forward note (`UI-A6.md:251`), (b) establishes a durable, generalisable rule — viewer state never enters `DebateViewModel`, because ADR-0025 binds the public export to that type and ADR-0032 D-8 excludes bookmarks from the dataset — and (c) gives the next task a citable reason instead of re-deriving the ADR-0025 chain. Per CLAUDE.md §5.12 it lands in the **same commit** as the code it describes.

**Minting an ADR is a decision the web gate should confirm** — flagged rather than assumed. If web rules it down, D1's reasoning is recorded in this plan instead and the SPEC.2 §4.2 edit carries a one-line note.

---

## Open questions (the plan accommodates every outcome; none is pre-decided)

**OQ-1 · S2 — does a per-card save toggle belong on Profile argument rows?** *Awaiting the design-lane ruling.* SPEC.2 §4.2 `:412` names "other-user Profile cards"; design-canon §2/§6 and W2.13-R2 describe Profile's bookmark icon as **headzone navigation** (i.e. a link to `/bookmarks`, not a per-row toggle). At ground `ArgumentList` has **no icon of any kind**, so §11's premise — that wiring only the debate view "leaves the icon dead on `/u/[other]`" — is factually wrong on disk. **Accommodated structurally:** Slice 4 is severable both ways; nothing else depends on it.

**OQ-2 · Rate-limit posture on a now-reachable unmetered write.** §11 enumerates six surfaces; `bookmarks` is absent (a deliberate carry, STEP 0a). But B1 converts `addBookmarkAction` from *zero call sites* to *reachable by every signed-in visitor on the busiest surface in the product*, with no limiter, no idempotency, and no per-user cap. Cost of abuse is bounded — `UNIQUE(user_id, comment_id)` caps rows at one per (viewer, comment), and the table is dataset-excluded — so this is a write-amplification/noise concern, not a correctness or ledger one. **Options for web:** (a) accept as carried, matching the other 13 unlimited Server Actions; (b) mint a `bookmarkPerIp` surface + constant (new SPEC.2 §11 row, new `limits.ts` constant — scope addition); (c) defer to HARDEN.6 with a docketed note. **Not pre-decided; no limiter slice is planned.**

**OQ-3 · Failure microcopy.** There is no toast infrastructure (`sonner` absent). Current plan: silent revert. If canon carries copy for a failed save, it is web-authored — CC does not invent user-facing copy.

**OQ-4 · May a banned user bookmark?** ADR-0021's posture is "ban removes voice, not balance/reads", and a bookmark is private convenience state rather than voice — which argues yes. But it *is* a write, and `add.ts` checks no ban (repo-wide, ban-on-write is enforced only at `bets/endpoint.ts:177`). Needs a one-line ruling; B1 does not add a gate either way.

**OQ-5 · May a bookmark be written after the conclusion freeze?** `system_state.frozen_at` makes the system read-only after 2026-11-05 23:59 UTC, and CLAUDE.md §3 lists conclusion-freeze tampering as a refusal trigger. `add.ts` checks no freeze; repo-wide, `isFrozen()` guards only `bets/endpoint.ts:197` and the close-due-markets cron. Bookmarks are dataset-excluded and carry no thesis signal, so the *spirit* may be satisfied — but "read-only after" is stated plainly and this is the operator's call, not CC's. **Raised, not absorbed.**

**OQ-6 · Retrofit `UnbookmarkButton` to branch on `{ ok }`?** It currently discards the result (`:36`) while D5 requires new callers to branch. One line, on a surface B1 otherwise does not touch. In or out?

---

## Self-critique (ranked)

**1.** **D1 overrides a ratified plan's forward note, so the plan must survive the argument, not just assert it.** UI-A6 §11 was web-reviewed and ratified; B1 contradicts its `loadDebateView` instruction. *Mitigation:* the override rests on a **higher-precedence** source (ADR-0025's binding of the export to `loadDebateView`'s DTO, plus ADR-0032 D-8's dataset exclusion) rather than on SG-3, whose bindingness is weak. The reason is recorded in D1, in ADR-0034, and in the §4.2 amendment, so it cannot be silently re-litigated. **Residual risk:** if web prefers the §11 placement, Slice 1 relocates and Slices 2–3 are unaffected (the prop path is identical) — the blast radius of being wrong here is one file.

**2.** **Per-instance optimistic state can disagree with itself** (edge case 6): the same comment mounted in two places (market column + focus header; `ReplyPreview` + `ReplyScroller`) can briefly show different icon states. *Cheap alternative recorded:* lift the optimistic set into `DebateView` so all instances read one source. *Why not now:* it converts a leaf-local `useState` into shared parent state threaded through the same six components, for a transient cosmetic divergence in a rare simultaneous-mount case. **Reversible, and named so a reviewer can overrule.**

**3.** **UI behaviour has no automated coverage** (§7). The riskiest new logic — own-suppression and the removed-argument matrix — is exactly the part no test harness can currently assert. *Mitigation:* the own/removed decisions are driven by server-computed ID sets that **are** integration-tested, the structural impossibility of `ArgProfile` on a removed node is a compile-time property, and `@security-auditor` is directed at points (d) and (e) specifically. **Named in the PR rather than smoothed over.**

**4.** **Six component signatures change for one prop.** Reviewers may read it as churn. *Defence:* prop-drilling matches the house pattern (`viewer` already drills three levels) and the codebase has **zero** context usage; introducing context here would be a new cross-cutting pattern for one feature. The alternative is recorded so the choice is visible.

**5.** **B1 makes an unmetered, unfrozen, unban-gated write reachable** (OQ-2/4/5). None is a §11 violation and none is introduced by B1, but B1 is the commit after which they matter. *Mitigation:* all three are raised as explicit rulings with options rather than absorbed — the failure mode to avoid is a silent inheritance that nobody ever revisits.

**6.** **Slice 4's severability is asserted from a read of the import graph, not proven by a build.** *Mitigation:* Slice 0 re-verifies on the live tree; if Slices 1–3 develop any `src/**/profile/**` reference, severability is void and the plan is re-cut before Slice 4 starts.

**7.** **The Appendix A row (amendment 3) pays a pre-existing UI.A2 omission**, which is technically adjacent work. *Defence:* B1 is extending that module's public contract in the same commit; documenting a contract you are changing is not scope creep. Flagged rather than buried; strikeable at web's discretion at zero cost to any slice.

---

## References

- **ADRs:** `docs/adr/0032-bookmarks.md` (the A6 build spec — D-1…D-8) · `docs/adr/0025-debate-md-export.md:59-60`, `:86-87` (the export binding that drives D1) · `docs/adr/0021-reactive-moderation-no-held-queue.md` (masking posture) · `docs/adr/0015-rate-limit-idempotency.md` (via SPEC.2 §11)
- **Specs:** `docs/specs/SPEC.2.md:392-419` (§4.2 catalogue) · `:1166-1217` (§11) · `:1942`, `:2898` (§19.3 dataset exclusion) · `:2456`, `:2504-2507`, `:2537` (Appendix A) · `docs/specs/debate-export.md:21-23` · `docs/specs/SPEC.1.md` §23
- **Plans:** `docs/plans/UI-A6.md:238-262` (§11 forward note — overridden by D1) · `docs/plans/UI-A2.md:60-70` (SG-1…SG-7, where SG-3 is defined)
- **Code at ground (`9d289b3`):** `src/server/debate-view/viewer-context.ts:32-49`, `:83-143` · `src/server/debate-view/load-debate-view.ts:150-172`, `:326-349` · `src/server/bookmarks/{add,remove,list}.ts` · `src/app/(public)/m/[slug]/page.tsx:38-83` · `src/components/debate/{ArgProfile,PostCard,PostFocusHeader,ReplyCard,ReplyPreview,DebateView,scrollers}.tsx` · `src/components/bookmarks/{UnbookmarkButton,BookmarkCard}.tsx` · `src/components/profile/ArgumentList.tsx` · `src/db/schema/{bookmarks,comments}.ts` · `drizzle/migrations/0024_bookmarks.sql`
- **Tests at ground:** `tests/server/bookmarks/{write,list,masking}.test.ts` — 17 cases, all green · `tests/integration/viewer-context.integration.test.ts` (the Slice-1 vehicle)

---

*Authored in plan-mode, read-only, from the primary tree (no repo write). Not committed. Awaiting web review before the execute chat is opened; execute is a fresh session (`/clear`) against `@docs/plans/BOOKMARK-ADD-WIRE.md`, `/model opus`, gated plan→execute, **never `ultracode`**.*
