# F-DEBATE-4 — debate view poll

> **Status:** substance landed at F-DEBATE-4 (B3), per SPEC.2 §13.4 gating cadence.
> **Shape:** R — read flow, degenerate Invariants block per SPEC.2 §13.2.
> **Product contract:** SPEC.1 1.0.25 §9 F-DEBATE-4 (+ §9 F-DEBATE-5 for the price series). **Architecture:** SPEC.2 1.0.22 §4.3.

## Pre

- A participant or anonymous visitor has `/m/[slug]` open in a browser, rendered per **F-DEBATE-1** — `getMarketBySlug` resolved a non-`Draft` slug and `loadDebateView` composed with `loadViewerMarketContext` at the page RSC (ADR-0034 D-2).
- `market.status` is `Open`. Any other status means this flow does not run at all (System step 7).
- The route is dynamic per its explicit `export const dynamic = "force-dynamic"` segment config (SPEC.2 §4.3). Without it the route would be dynamic only as a side effect of `headers()`, and a poll against a static route would serve a frozen payload indefinitely.
- The client tree has hydrated: `DebateView` is mounted, and `DebatePoll` with it.
- No participant session is required — public read pages carry an optional session for write affordances only (SPEC.2 §4.1).

## System

1. `DebateView` mounts `<DebatePoll marketOpen={marketOpen} composerOpen={openSide !== null || openReply !== null} />` — a leaf that renders `null`. `marketOpen` is the already-derived `model.market.status === "Open"`; `composerOpen` is derived from host state that already exists. No prop is added to `BetComposer` and no field is added to any DTO.
2. Register a `visibilitychange` listener mirroring `document.hidden` into local state, adopting the current value at mount so a tab opened in the background is suspended from the start. Remove the listener on cleanup.
3. Derive `suspended = documentHidden || composerOpen`.
4. While **not** suspended and **not** stopped, open exactly one `setInterval` firing `router.refresh()` every `POLL_INTERVAL_MS_DEBATE_VIEW` (`src/server/config/limits.ts`; provisionally pinned at 15000 ms, tune deferred to HARDEN.6). Return `clearInterval` as the effect's cleanup.
5. `router.refresh()` re-invokes the **existing** `/m/[slug]` server read path — the route's layout and page both re-execute, `loadDebateView` re-runs its masking gate, `loadViewerMarketContext` re-runs beside it, and React reconciles the new payload into the mounted client tree. This is **not** a fetch against a Route Handler: SPEC.2 §4.3's catalogue is closed at eleven and this flow adds no twelfth (Invariants, below).
6. On becoming suspended, clear the interval and arm the resume flag. On resuming — the document becoming visible, or the last composer closing — fire one **immediate** `router.refresh()` and reopen the interval. The resume flag starts disarmed, so no refresh fires on the initial mount, where the server render is already fresh.
7. When `marketOpen` is false, latch `stopped` and return without opening an interval. Stopped, not paused: the latch means a later payload cannot restart the poll.

## Response

No response body — this flow issues no request of its own. Its observable output is a re-rendered `/m/[slug]` RSC payload replacing the mounted tree's props:

| Surface | Field(s) refreshed |
|---|---|
| Market header | `market.pricing`, `market.unitToWin`, `market.totals.{dharmaStaked,postCount,replyCount}`, `market.status` |
| Price chart (F-DEBATE-5) | `priceChart.series`, `priceChart.nodes` — or `null` when the non-fatal replay fails |
| Debate columns | `posts[]` in current Top order, each post's `aggregate`, `replies.{support,counter}`, and F-DEBATE-2 markers |
| Viewer strip | `viewer.position`, `viewer.balance`, `viewer.spendableToday`, `viewer.bookmarkedCommentIds`, `viewer.ownCommentIds` |

Client state survives the swap: the component does not remount, and typed composer text, controlled state, focus, caret/selection and scroll position are all preserved.

## Errors

`router.refresh()` returns `void` and exposes no failure callback, so this flow raises no error code of its own and consumes none from `docs/specs/error-codes.md`.

| Failure | Surface | Handling |
|---|---|---|
| A poll's server render throws | Arrives as **HTTP 200** with a poisoned RSC payload; Next replaces the whole client subtree with its built-in error page. Undetectable client-side. | Not recoverable by defensive code. Mitigated structurally: polling suspends while any composer is open, keeping the reader's unsaved argument out of the blast radius. `/m/[slug]` carrying its own `error.tsx` is **docketed to POLISH.3** — it would brand the failure, not save the composer. |
| `deriveMarketPriceChart` rejects | `priceChart` becomes `null` (the one non-fatal read in `loadDebateView`) and the header renders no chart; Sentry WARN. | Inherited unchanged from F-DEBATE-5. Under polling this can make the chart appear and vanish mid-session — recorded, not fixed here (**POLISH.3**). |
| Overlapping ticks | A slow render is overtaken by the next tick. | Not an error: concurrent `router.refresh()` calls coalesce into one applied payload. No in-flight guard, no request queue. |
| Network unavailable | The refresh does not apply; the previously painted tree stays. | Self-healing on the next tick. |

## Invariants

*No state mutation; INV-1 / INV-2 / INV-3 / INV-4 do not apply. Read-time correctness rides on §3.3 R-* pattern semantics.*

Two read-side properties this flow must not weaken, recorded because the mechanism was chosen to preserve them:

- **Removal-masking is not forked.** Masking is keyed solely on `loadRemovedSet` inside `loadDebateView` (ADR-0021; ADR-0034 D-4). Because the poll re-invokes that same loader rather than a dedicated read endpoint, there is exactly one masking implementation and no second place for it to diverge. Guarded structurally by `tests/server/debate-view/poll-contract.test.ts`.
- **`loadDebateView` stays viewer-independent.** Its signature `(client, { market })` is unchanged and no viewer-scoped field enters `DebateViewModel` (ADR-0034 D-1) — the property ADR-0025 binds the public `.md` export to. Zero-line diff on the loader in this build.

**Known behaviour, accepted and named (not defects).** Four, recorded so they are known properties in September rather than participant discoveries:

1. **The pager can silently swap the argument a reader is reading.** Each pole column is a **one-card pager keyed by array position** — `PostScroller` holds `useState(0)` and renders `posts[clamped]` (`src/components/debate/scrollers.tsx:79-84`); `ReplyScroller` is the same shape. Top order is recomputed server-side on every tick, and `index` survives the poll (the element sits at a stable tree position, so it does not remount). A reader on card 3 of 7 is therefore, 15 s later, reading **a different argument occupying the whole column**, with the `3 / 7` label unchanged. This is stronger than "a list reorders": there is no list and no scroll, so there is no visual cue at all. Ruled accept-and-document at build rather than pinning order client-side, which would make a reader's view diverge from the ranking the thesis rests on. The behavioural fix — hold the pager position as a comment id and derive the index — is **docketed to POLISH.3**.
2. **The pager counter is an existing live region.** `src/components/debate/scrollers.tsx:41` carries `aria-live="polite"` on `{index + 1} / {total}`. The poll makes `total` change without user action, so a screen-reader user now hears spontaneous position announcements on ranking churn — and per (1) the announced position refers to a different argument. No `aria-live` was *added* by this flow; the treatment of the existing one is **docketed to POLISH.3**.
3. **The post pop-up and image lightbox are frozen snapshots.** `DebateView` holds `popupPost` as a `PresentPost` **object** and `lightboxUrl` as a URL string, neither re-derived from the new payload — unlike `selectedPost`, which re-derives via `posts.find(...)` and therefore re-masks correctly. An open pop-up keeps rendering pre-poll content, including a post removed between ticks, until the reader closes it. Not a masking bypass — the content was legitimately delivered before removal and no new reader can obtain it — but it is a removal-staleness window the poll opens without user action. **Docketed to POLISH.3** (the fix is `popupPostId` + `posts.find`).
4. **A successful bet costs two RSC renders, not one.** `BetComposer` calls `router.refresh()` then `onClose()`; `onClose` clears the composer, which un-suspends the poll, which fires the immediate resume refresh. They coalesce into one applied payload, so this is load, not correctness — but the per-tick cost recorded in SPEC.1 §16.1 is understated by a factor of two on the bet path. Relatedly, `BetComposer`'s `p3_protective_landing` branch refreshes **while the composer is still open**, so the blast-radius argument behind the suspension rule is a strong default rather than an absolute. And the resume-refresh is unthrottled and reader-triggerable: every composer close mints one immediate full RSC render, with no debounce and (deliberately) no in-flight guard, reachable by a signed-out visitor too since `AuthGateSlot` also sets `openSide`. Bounded by being roughly equivalent to holding F5, which was always available — recorded because it is a new *user-driven* server-render trigger on a surface whose per-tick cost the spec goes out of its way to quantify.

5. **A removed image stays fetchable for up to an hour, and the poll makes that the guaranteed case.** `mintImageUrls` mints a presigned R2 GET with `READ_URL_TTL_SECONDS = 3600` on every read. Masking is instantly correct on the next payload — a removed comment's URL is never minted again — but a URL already minted is a **bearer credential R2 cannot revoke**, valid for up to an hour from anywhere, unauthenticated. Before the poll a reader had to be lucky enough to have loaded within the hour; with it, any viewer with a tab open holds a credential minted at most 15 s before the removal. Not a masking bypass — the render is correct — but the credential outlives the render, and image-category false negatives are the one class ADR-0021 leaves to reactive removal alone. **Docketed to POLISH.3**: shorten the render-side TTL toward the poll interval, or serve image reads through a proxy that re-checks `removedSet`.
6. **After the global conclusion freeze the poll does not stop.** `closeDueMarkets` returns early once `system_state.frozen_at` is set, so markets `Open` at the freeze instant stay `Open`; the stop rule keys on `market.status` alone (deliberately — RULING D), so every open tab keeps polling immutable data forever. Not a freeze bypass — the poll is read-only and touches no write path — but the stop rule does not fire at the one moment its value is highest. **Docketed to POLISH.3.**

## Acceptance

Every name below appears verbatim in SPEC.1 §17 (SPEC.2 §13.5).

| §17 row | File |
|---|---|
| `debate-view::poll-interval` | `tests/unit/debate/render/poll.test.tsx` |
| `debate-view::poll-suspends-while-hidden-or-composer-open` | `tests/unit/debate/render/poll.test.tsx` |
| `debate-view::poll-refreshes-price-chart` | `tests/unit/debate/render/poll.test.tsx` |
| `debate-view::poll-preserves-removal-masking` | `tests/server/debate-view/poll-contract.test.ts` |
| `debate-view::poll-stops-when-market-leaves-open` | `tests/server/debate-view/poll-contract.test.ts` |

File placement follows the behaviour under test, per SPEC.1 1.0.25 §9: the interval, suspension and chart-refresh rules are client-render behaviours (jsdom + `@testing-library/react`, fake timers; visibility proven by stubbing `document.hidden` and dispatching `visibilitychange`, never in a browser). The masking and stop rules are read-path/structural source-grep guards. The stop rule's *client effect* — the interval cleared and never restarted — is additionally exercised in the client-render file as a supporting case under its own name.

`debate-view::poll-preserves-removal-masking` is a **structural** guard, and deliberately so: the poll re-invokes the same read, so this build adds no masking code for a behavioural test to cover. It asserts that exactly one debate read path exists and that the poll rides it. Masking *behaviour* is owned by `tests/server/debate-view/load-debate-view.integration.test.ts`, extended at this build with a repeated-invocation case proving masking is byte-identical across the reads a poll produces.
