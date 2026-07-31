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

**Known behaviour, accepted and named (not a defect):** Top ordering is recomputed server-side on every tick, so a poll can **reorder the column a reader is mid-sentence in**. The swap is technically silent — no remount, no fallback frame, no scroll jump — but the content moves. Ruled accept-and-document at build rather than pinning order client-side, which would make a reader's view diverge from the ranking the thesis rests on. Named here so it is a known property in September rather than a participant discovery.

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
