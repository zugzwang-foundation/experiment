# TIME-1 — relative post/reply timestamps on every card

**Base:** `origin/staging` @ `1fc741b` · **Branch:** `feat/time-1-relative-timestamps`
**Mode:** autonomous overnight (doctrine v1.0) · no operator gates
**PR target:** `staging` (NOT `main` — the CS1–CS14 / FEED-2 card anatomy this
task modifies merged to `staging` only; `main` is 34 commits behind and carries
no identity row to append to).

---

## 0 · The idea, in one paragraph

Every post and every reply should show how long ago it was written, the way any
social feed does. Three units, no compounding, no absolute date, no ticking
clock, no new data. The entire correctness surface is a pure function of two
integers, so it is fully testable with synthetic instants and never needs a real
row of any particular age.

---

## 1 · What measurement changed about the brief

| Brief said | Measured | Consequence |
|---|---|---|
| R7 lists **five** surfaces incl. **Bookmarks** | `src/app/(public)/bookmarks/` and `src/components/bookmarks/` **do not exist** — removed at `ff1c0f9` "chore(unwire-1): remove the bookmark module and the Profile Dharma graph" | Four surfaces, not five. Nothing is recreated. |
| R7 names "the reply page" as a surface | There is no reply route. Post-focus is `?post=<N>` on `m/[slug]`, resolved at `page.tsx:72-85` | It is served by `PostFocusHeader` + `ReplyCard`, **both already `ArgProfile`** — covered by the same edit as market detail. |
| "You MAY plumb `createdAt` … additively" | **Every** read model already carries it — `DebatePost`/`DebateReply` (all 4 variants), `HeroPost` (`hero.ts:117`), `ProfileArgumentItem` (all 4 variants) | **Zero read-model changes.** No DTO, no query, no server file is touched. |
| `docs/deploy-pipeline.md` | Path is `docs/runbooks/deploy-pipeline.md` | — |

---

## 2 · File map — every file this task touches, and why

**Read models / `src/server/**`: NONE.** No server file is edited, no query
changes, no DTO gains a field, no migration, no event type.

| # | File | New? | Why |
|---|---|---|---|
| 1 | `src/lib/relative-time.ts` | **new** | S1. The pure formatter `(nowMs, createdMs) → string`. No React, no DOM, no timezone. The entire correctness surface. |
| 2 | `src/components/ui/relative-time.tsx` | **new** | S2. The one `"use client"` leaf. Reads `Date.now()` at render, renders one plain text node. |
| 3 | `src/components/debate/ArgProfile.tsx` | edit | S2. Adds a required `createdAt` prop; mounts the leaf as the last child of the meta row, after the existing `Sep` divider. **Covers post card, focused post, reply card and both pop-ups at once.** |
| 4 | `src/components/debate/PostCard.tsx` | edit | S2. Passes `post.createdAt` (present branch only). |
| 5 | `src/components/debate/ReplyCard.tsx` | edit | S2. Passes `reply.createdAt` (present branch only). |
| 6 | `src/components/debate/PostFocusHeader.tsx` | edit | S2. Passes `post.createdAt` (present branch only). |
| 7 | `src/components/debate/dialogs.tsx` | edit | S2. Two mounts — post pop-up and reply pop-up. |
| 8 | `src/components/discovery/HeroPanels.tsx` | edit | S3. Hero post identity row, after the Đ figure, with a `HeadSeparator`. |
| 9 | `src/components/profile/ArgumentList.tsx` | edit | S3. `PresentHead` — after `Replies · N` (post) / after the stake block (reply), before the `ml-auto` download wrapper. Serves BOTH mounts (`:187` list card, `:603` replica card). |
| 10 | `tests/unit/relative-time.test.ts` | **new** | S1 guards G1–G4. *(Flat, not `tests/unit/lib/` as this row first said — `tests/unit/` already holds three flat single-subject unit files: `body-fingerprint`, `rate-limit-prefix`, `idempotency-release`. Corrected at the cascade, `@test-writer` L-1.)* |
| 11 | `tests/unit/design/relative-time-placement.test.tsx` | **new** | S4 guards G5–G6. |
| 12 | `AGENTS.md` | edit | §3's `components/ui/` line moves FOUR → FIVE project-authored primitives. Descriptive maintenance of a descriptive file; the canon entry is OWED, not authored (report §11). |

### The full plumb path, per surface, named hop by hop

**Market detail + reply page + both pop-ups** (no read-model hop — the field is
already on the union member each card receives):

```
comments.created_at  (timestamptz, NOT NULL — untouched)
  → src/server/debate-view/load-debate-view.ts:334,346,552,559  .toISOString()
  → DebatePost.createdAt / DebateReply.createdAt  (:65, :70, :109, :119)
  → src/app/(public)/m/[slug]/page.tsx:49  loadDebateView(...)
  → src/components/debate/DebateView.tsx     model.posts / .replies
  → PostCard(post) :48 | ReplyCard(reply) :24 | PostFocusHeader(post) | dialogs(post|reply)
  → ArgProfile createdAt=…            ← THE ONLY NEW HOP
  → <RelativeTime createdAt=… />      ← THE LEAF
```

**Discovery hero:**

```
comments.created_at
  → src/server/discovery/hero.ts:235 (select) → :401 .toISOString()
  → HeroPost.createdAt  (hero.ts:117)
  → src/app/(public)/page.tsx  → DiscoveryCarousel → HeroPanels
  → src/components/discovery/HeroPanels.tsx  HeroPostPanel(post)  :210
  → <RelativeTime createdAt={post.createdAt} />   ← THE ONLY NEW HOP
```

**Profile argument list:**

```
comments.created_at
  → src/server/profile/arguments.ts:272,284,295,306 → :434,:482,:518,:560
  → ProfileArgumentItem.createdAt  (:46, :57, :88, :115 — all four variants)
  → src/app/(public)/u/[pseudonym]/page.tsx  loadProfileArguments
  → src/components/profile/ArgumentList.tsx  → PresentHead(item)  :426
  → <RelativeTime createdAt={item.createdAt} />   ← THE ONLY NEW HOP
```

---

## 3 · Slices, ordered, each with its exit condition

| Slice | Ships | Exit condition |
|---|---|---|
| **S1** | `src/lib/relative-time.ts` + `tests/unit/lib/relative-time.test.ts` | G1–G4 green; each verified RED by reverting its fix; full suite green |
| **S2** | The leaf + `ArgProfile` + the four debate mount files | `tests/unit/design/` green (13 files / 71 tests); `tests/unit/debate/` green; full suite green |
| **S3** | `HeroPanels.tsx` + `ArgumentList.tsx` | `tests/unit/design/` green; `tests/unit/profile/` green; full suite green |
| **S4** | `tests/unit/design/relative-time-placement.test.tsx` (G5, G6) | Both verified RED by reverting; full suite green |
| **S5** | Reviewer cascade → fixes → re-review of each fix → PR | Cascade dispositions logged; PR open against `staging`, unmerged |

Commit boundaries may move; the ORDER does not.

---

## 4 · Ambiguities resolved in advance (the alternative, and why it lost)

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A1 | Which node is "the identity row" for G6's last-child assertion | The **inner meta `<div>`** that holds pseudonym · Sep · chip · marker · Đ · Sold · Replies | The outer `ArgProfile` row `<div>` | R4 says the timestamp "follows `REPLIES · 0`", and `Replies · N` lives in the inner div. The outer row's last child is the `ml-auto` download button — putting the timestamp after it would place it past the trailing edge control, which is not "follows REPLIES · 0". |
| A2 | The divider | Reuse the row's existing divider element — `Sep` in `ArgProfile`, `HeadSeparator` in `HeroPanels` / `ArgumentList` | Mint a new one; or no divider | R4 says read the existing divider and reuse it. All three surfaces already have one, and all three are the same `\|` at `text-n3`. |
| A3 | The muted token | **`text-n5`** | `text-muted-foreground`; `text-n4`; `text-n6`; no class at all | Measured in `globals.css`: `--muted-foreground: var(--color-n5)` (`:64`) and `--text-meta: var(--color-n5)` (`:189`). So `text-n5` **is** the token `ArgProfile`'s row already inherits, **is** what `ArgumentList`'s `Replies ·` label already declares (`:524`), and **is** the ratified meta rung — one token satisfying "reuse what those elements use" on every surface at once. It is an existing census token, so no colour value is introduced. |
| A4 | Size | The leaf declares **no** size; each row's own size is inherited. `ArgumentList` passes `text-xs` because that row's siblings declare it individually | Hard-code a size in the leaf | The three rows are `text-xs` (ArgProfile), `text-[9.5px]` (hero) and unset-with-`text-xs`-siblings (profile). A hard-coded size would be wrong on two of three. AGENTS.md §8's arbitrary-size trap applies: never state a size without its leading — so state neither and inherit. |
| A5 | Removed posts/replies | **No timestamp on any removed variant** | Render it (the `.md` export does) | On market detail the removed branches render **no identity row at all** (`PostCard.tsx:76-108`, `ReplyCard.tsx:43-50`, `PostFocusHeader` removed arm) — there is no row to append to, and inventing one would be a new feature. On Profile, `RemovedHead` (`:392`) is a deliberately different cluster. Uniform rule: **present cards carry it, removed stubs do not.** Also the security-conservative direction. |
| A6 | Hydration | Compute `Date.now()` at render inside the client leaf + `suppressHydrationWarning` on the text element | A one-shot `useEffect` re-read at mount; or serialize a server `nowMs` into the payload | All three routes are dynamic (`force-dynamic` ×2; the profile page reads `headers()` and its own docblock says "UNCACHED / dynamic v1"), so the SSR→hydration gap is seconds, not cache-age. A serialized server-now would go stale on any future caching; a mount effect is a second render per card for a sub-second correction. `suppressHydrationWarning` is React's documented escape hatch for exactly this and costs nothing. **No timer, no interval, no rAF, no subscription** — R6. |
| A7 | Where the leaf lives | `src/components/ui/relative-time.tsx` | `src/components/debate/RelativeTime.tsx` (the `badges.tsx` three-surface precedent); `src/lib/` | It is a cross-surface presentational primitive with no domain owner, and `src/components/**` is inside `no-raw-hex-view-layer`'s scan — `src/lib/` is not, so a view component there would escape the colour guard. Cost: AGENTS.md §3's "FOUR project-authored" `ui/` count moves to five, and the canon entry is OWED. |
| A8 | Narrow-viewport wrap | Accept the row's own existing wrap behaviour; add nothing | Force `whitespace-nowrap`/`shrink-0` on the leaf | `ArgProfile`'s meta row is `flex-wrap`, `ArgumentList`'s head is `flex-wrap` — both already wrap and the timestamp wraps with them. The hero row is `flex-nowrap overflow-hidden whitespace-nowrap` and will clip rather than wrap, which is that row's ratified behaviour for every element on it. Imposing a different rule for this one element would make it the exception. |

---

## 5 · Guards, each named with the wrong answer it rejects

| ID | Assertion | Rejects |
|---|---|---|
| G1 | Buckets asserted **at** the edges: 0s, 59s, 60s, 3599s, 3600s, 86399s, 86400s, + a large multi-day value | an off-by-one at any bucket edge; a midpoint-only guard that catches none of them |
| G2 | No output contains two units | `1h 5m ago` |
| G3 | No output is `0m ago` / `0h ago` / `0d ago`, swept across every second of the first two hours + the day boundary | a zero unit at any boundary |
| G4 | Negative and zero deltas render `just now` | `-1m ago`, `in 2 minutes` |
| G5 | No absolute time reaches the DOM from this feature: no `title`, no `dateTime`, no `<time>`, no ISO substring, no calendar-formatted string — asserted on rendered output AND on the leaf's source | a `title="2026-08-24T…"` tooltip; `<time dateTime=…>`; the raw ISO leaking into text |
| G6 | The leaf is the **LAST child** of the identity row on the post card and on the reply card | a version mounted in the footer, under the body, or ahead of the existing tags |

Every guard is verified by reverting its fix and confirming it reds; the
assertion message each produces is recorded in the report.

---

## 6 · Baselines

| Ref | Measured before | Layer, and why that layer |
|---|---|---|
| B1 | `tests/unit/design/` — **13 files / 71 tests passed**, 1.55s | the whole folder, not the single monochrome file: the siblings are the ones a UI lane trips |
| B2 | full suite — **392 files passed / 1 skipped (393)**; **3563 passed / 1 skipped / 4 todo (3568)**; 162.64s; exit 0 | `pnpm vitest run` at the repo root against the live local Postgres `:54322` — the same runner CI uses, so the count is the one a reviewer can reproduce |
| B3 | client bundle — `"use client"` leaf count and `package.json` dependency count, before and after | source-level: the file that carries the directive is what decides whether a subtree is client, and `package.json` is where a dependency would appear. A `next build` size delta is reported separately if the build runs clean. |

---

## 7 · Reviewer-bearing slices

S1–S4 all land before the cascade. The cascade runs once over the whole diff,
in this order, all at effort max:

1. `@test-writer` — scope G1–G6. Failure mode: a guard that passes with the
   defect restored; a boundary guard asserting only interior values.
2. `@code-reviewer` — scope the RSC→client boundary and the shared card
   components. Failure mode: `"use client"` on a card rather than a leaf; a
   smuggled timer/interval; the formatter re-implemented per surface.
3. `@security-auditor` — scope how a CONTENT-REMOVED post or reply renders.
   Failure mode: the mount reaching into a path where a removed node's masked
   fields become reachable.

Any fix authored in response to a finding is re-reviewed by that same reviewer,
scoped to the fix (F-11).
