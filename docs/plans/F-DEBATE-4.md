# F-DEBATE-4 (B3) — Polled-on-view refresh

> **Status:** executing
> **Date:** 2026-08-01
> **Author:** Hrishikesh + Claude Code (single-session PLAN + EXECUTE, unattended overnight run)
> **Critical-path?** no — see CLAUDE.md §1. No `src/server/` business logic, no schema, no migration, no auth/bet/ledger/moderation surface. `@security-auditor` still runs (RULING H) because removal-masking sits in the blast radius.
> **Plan PR / commit:** first commit on `feat/f-debate-4`, cut from `origin/main` @ `54b0b2a`.

---

## Tracker context

Tracker row **B3 — F-DEBATE-4 (polled-on-view refresh)**, successor to B1 (`BOOKMARK-ADD-WIRE`, PR #273) in the B-lane. The tracker HTML is operator-maintained and lives outside this repo (web-Claude project knowledge), so the row is not quoted verbatim here; the governing text is SPEC.1 §9 F-DEBATE-4 + the ratified rulings relayed at execute.

**Declared dependencies, at plan time:**

| Dependency | Status |
|---|---|
| DEBATE.4 render (`/m/[slug]`, `loadDebateView`, `DebateView`) | landed — `src/app/(public)/m/[slug]/page.tsx`, `src/components/debate/DebateView.tsx` |
| UI.A3 composer (`openSide` / `openReply` host state) | landed — `DebateView.tsx:88`, `:91` |
| UI.19 / F-DEBATE-5 price chart | landed — `model.priceChart` → `MarketHeader` → `MarketPriceChartHost` |
| ADR-0034 (viewer-scoped reads outside the export-bound VM) | accepted 2026-07-30 |
| ADR-0021 (reactive moderation, `content_removed` masking) | accepted |
| SPEC.1 §16.1 `POLL_INTERVAL_MS_DEBATE_VIEW` | **was `TBD`** — the flow was literally unbuildable. This build lands a provisional pin of 15000 via the same-commit rider. |

**Read-only recon** ran as a separate session and its report is at `~/Desktop/zz-recon-F-DEBATE-4/RECON.md` (F1–F16 below cite it). No dependency is missing; the only blocker was the unvalued constant, closed by the rider.

## Approach (one paragraph)

Mount one new client leaf — `DebatePoll`, which renders `null` — from `DebateView`, holding a single `setInterval` that calls `router.refresh()` at `POLL_INTERVAL_MS_DEBATE_VIEW`. That re-invokes the *existing* `/m/[slug]` server read path (`loadDebateView` composed with `loadViewerMarketContext` at the page RSC), so removal-masking, viewer-scoping, ranking, markers and the F-DEBATE-5 price series all ride one payload with **zero** new read code and a zero-line diff on `loadDebateView` (ADR-0034 D-1). The poll suspends while the document is hidden or any composer is open, resumes with an immediate refresh, and stops permanently once the market leaves `Open`. Everything else in the diff is the constant, an explicit `force-dynamic` on the route, the spec riders, the flow file, and tests.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no | Read-only feature. No write path, no transaction, no `bets`/`comments` row. The poll issues an RSC render, never a mutation. | — (existing `tests/invariants/I-ATOMICITY-001.*` unaffected) |
| 2.2 Dharma non-transferable / no overdraft (INV-2) | no | No `dharma_ledger` contact of any kind. | — |
| 2.3 Side frozen at post-time (INV-3) | no | `side_at_post_time` is read through the unchanged `loadDebateView`; a poll re-reads the same frozen value. Chart node sides likewise ride the unchanged read. | — |
| 2.4 Resolutions append-only (INV-4) | no | No `resolution_events` / `payout_events` contact. The **stop rule** is INV-4-*adjacent*: a market that has left `Open` is frozen, and the poll stops rather than re-reading a frozen surface four times a minute. | `debate-view::poll-stops-when-market-leaves-open` |

Not a critical-path task per CLAUDE.md §1 — no invariant is "touched", so the failure-mode paragraph does not apply. The safety-critical property this build *does* sit beside is **removal-masking** (ADR-0021 + ADR-0034 D-4), which is not an INV but is treated with the same seriousness: §7 carries a structural guard for it and `@security-auditor` re-gates it.

---

## 2. Data model changes

**None** — read-only feature. No table, column, index, FK, constraint, enum value, migration, event type or DDL. Migration head stays `0024_bookmarks.sql`; `EVENT_TYPES` stays at 24.

## 3. API surface

**None.** This is the load-bearing structural constraint of the whole task, not an incidental fact:

- **No new Route Handler.** SPEC.2 §4.3's catalogue is closed at eleven and F-DEBATE-4 adds no twelfth. A dedicated read endpoint would fork removal-masking — keyed *solely* on `loadRemovedSet` inside `loadDebateView` (ADR-0021; ADR-0034 D-4) — into a second implementation, and two masking implementations are two places for masking to diverge.
- **No new Server Action.** The refresh is `router.refresh()`, a framework RSC re-render, not an app-authored endpoint.
- **No change to `loadDebateView`'s signature** — `(client: DebateViewReader, args: { market: MarketSummary })` stays exactly as it is (ADR-0034 D-1). Zero-line diff, proved at §7.
- **No change to `DebateViewModel`, `DebatePost` or `DebateReply`.** The one field the poll needs — `market.status` — is already on the model via `DebateMarketHeader = MarketSummary & {…}` and is already consumed on the client at `DebateView.tsx:103` (recon F7).

One **segment-config** addition, which is not an API surface but belongs here for completeness: `export const dynamic = "force-dynamic";` on `src/app/(public)/m/[slug]/page.tsx` (RULING F).

## 4. UI / user flow

Pages affected: `/m/[slug]` only.

**New component — `src/components/debate/DebatePoll.tsx`** (`"use client"`, returns `null`).

```
props: { marketOpen: boolean; composerOpen: boolean }
```

- Effect 1 — a `visibilitychange` listener mirroring `document.hidden` into local state, adopting the current value at mount, removing the listener on cleanup. This is the **first** visibility handling in the repo (recon F12).
- Effect 2 — the poll. Owns exactly one `setInterval(() => router.refresh(), POLL_INTERVAL_MS_DEBATE_VIEW)` and returns `clearInterval`, following the `NeedsResolutionCount` precedent (recon R3 proved this yields the correct **net** fire rate under StrictMode double-mount: effect ×2, cleanup ×1, net one live interval).

**Mount site — `DebateView.tsx`**, one import plus one element:

```tsx
<DebatePoll
    marketOpen={marketOpen}
    composerOpen={openSide !== null || openReply !== null}
/>
```

`marketOpen` already exists at `DebateView.tsx:103`; `openSide` / `openReply` already exist at `:88` / `:91`. **No new state, no new prop on `BetComposer`, no composer change at all** (recon F9; HALT 7).

**What the participant sees.** Nothing new renders. On a live `Open` market the page's content refreshes every 15 s: new posts and reply-bets appear, markers and Top ordering update, the price bar and the F-DEBATE-5 chart advance. Recon proved the swap is visually silent — no remount, no Suspense fallback frame (0/153 even with a deliberately injected 400 ms boundary), and scroll, focus, caret/selection and both controlled and uncontrolled input text all survive (F2, F11).

## 5. Failure modes

| # | Failure mode | Detection | Recovery |
|---|---|---|---|
| **1** | **A poll's server render throws.** The entire client tree is unmounted and replaced by Next's built-in error page; an unsaved argument is destroyed. The failure arrives as **HTTP 200 with a poisoned payload**, and `router.refresh()` returns `void` with no error hook — it cannot be detected or backed off (recon F3). | Sentry captures the render exception server-side. There is no client-side detection. | **This is the entire justification for RULING C.** The only lever is: do not poll while a composer is open. Docketed, not built here: `/m/[slug]` has no `error.tsx` (see §8). |
| **2** | **Load.** The refresh re-executes the route's **layout as well as its page**, so `auth.api.getSession()` fires twice per tick; a tick costs 12–14 sequential DB round-trips per open tab, at 4 ticks/min, with nothing throttling per tab (recon F4). | Supabase session-pooler saturation; `/api/health` latency. | Visibility suspension is the larger lever and is built. The interval itself is a one-line HARDEN.6 tune by construction (RULING B). |
| **3** | **Overlapping ticks.** A slow render can be overtaken by the next tick. | — | **Not a correctness bug**: `router.refresh()` calls coalesce (6 rapid calls → 1 applied payload, recon F16). No in-flight guard, no request queue — deliberately (RULING A). |
| **4** | **A composer left open indefinitely freezes the surface's data.** | User-visible staleness. | Accepted. RULING C is ratified as composer-**open**, not composer-dirty, and carries no missed-tick cap. The reader's intent to compose is the gate. |
| **5** | **The chart vanishes mid-session.** `priceChart` is the one non-fatal read in `loadDebateView`; on failure it becomes `null` and `MarketHeader` renders nothing. Under 4×/min polling a flaky reserve replay makes the chart appear and disappear with no explanation. | Sentry WARN (`safeCaptureMessage`) already emitted by `load-debate-view.ts`. | **Docketed, not fixed here** (§8). |
| **6** | **Route accidentally becomes static.** `/m/[slug]` is currently dynamic only as a side effect of `page.tsx` calling `headers()` for the session. Remove that call and the poll serves a frozen payload forever. | Silent — this is precisely why it is worth closing. | Closed by RULING F: an explicit `export const dynamic = "force-dynamic"`. |

## 6. Edge cases

1. **Initial mount.** No refresh fires — the server render is already fresh. The resume-refresh is armed **only** by a genuine suspend→resume transition. *(The named trap in RULING C; §7 tests it explicitly.)*
2. **StrictMode double-mount (dev).** Effect runs twice, cleanup once; net one live interval, same fire rate as prod. The `wasSuspended` latch is untouched on the unsuspended path, so the double-mount cannot mint a spurious resume-refresh.
3. **Mounted while already hidden.** Effect 1 adopts `document.hidden` at mount → suspended immediately, no interval. Becoming visible later *is* a genuine suspend→resume, so the immediate refresh is correct there.
4. **Both suspenders active.** Hidden **and** a composer open: clearing only one keeps the poll suspended; the resume-refresh fires once, when the last suspender clears.
5. **Composer opens mid-interval.** The pending interval is cleared by the effect's cleanup; no tick fires while the composer is open.
6. **Market leaves `Open` on a poll's payload.** `marketOpen` flips false → the interval is cleared and a `stopped` latch is set, so the poll never restarts even if a later payload were to claim `Open` again. "Stopped, not paused" is encoded structurally rather than resting on the market state machine.
7. **Non-`Open` at first paint** (`Closed` / `Resolving` / `Resolved` / `Voided` / `Frozen` / `Draft`): the poll never starts. `Draft` cannot reach this route at all (`getMarketBySlug` excludes it), but the predicate is `status === "Open"`, so every non-`Open` state is covered by construction.
8. **Signed-out viewer.** `viewer` is `null`; the poll is identical. Reads are public (ADR-0019), and `loadViewerMarketContext` is simply not called.
9. **Global conclusion freeze.** The poll carries **no** notion of it — deliberately (RULING D). `system_state.frozen_at` reaches no client component, and `FREEZE_INSTANT_UTC` is a compile-time literal; comparing it against an untrusted client clock is a guess about a database state flip, not a signal.
10. **Expanded chart overlay open during a poll.** Its open/closed state is client-local (`MarketPriceChartHost`) and survives the refresh; the line updates underneath the reader. Accepted — the chart riding the poll is SPEC.1 F-DEBATE-5's stated requirement.

## 7. Test plan

Harness reality (recon F13, and **AGENTS.md §9's inventory is stale on this point** — see §8): component tests run on jsdom + `@testing-library/react` behind a per-file `// @vitest-environment jsdom` docblock. **There is no `jest-dom`** — `toBeInTheDocument()` and friends are unavailable; plain DOM assertions only.

File placement follows the behaviour under test, per the SPEC.1 1.0.25 Acceptance bullet, and is recorded in `docs/specs/flows/F-DEBATE-4.md`.

| Layer | File | Scenarios | §17 rows proved |
|---|---|---|---|
| Client-render (jsdom, fake timers) | `tests/unit/debate/render/poll.test.tsx` | cadence read from the constant; no refresh on initial mount; suspension by `document.hidden` (stubbed + `visibilitychange` dispatched — recon F14: *never* attempt this in a browser); suspension by composer-open driven through `DebateView`'s own `openSide`/`openReply`; immediate resume-refresh; both-suspenders; stop-and-never-restart; StrictMode net rate; poll→refresh→**chart shows the new series** | `debate-view::poll-interval`, `debate-view::poll-suspends-while-hidden-or-composer-open`, `debate-view::poll-refreshes-price-chart` |
| Read-path / structural (source-grep, no DB) | `tests/server/debate-view/poll-contract.test.ts` | the poll refreshes via `router.refresh()` and never `fetch(`/`useSWR`/`useQuery`; the `route.ts` inventory under `m/[slug]` is exactly `quote/` + `export/`; `loadDebateView`'s signature is unchanged (ADR-0034 D-1); masking stays single-sourced on `loadRemovedSet` and the poll is never a masking input (D-4); the stop signal is `market.status` alone and the poll carries **no** `frozenAt` / `FREEZE_INSTANT_UTC` / `isFrozen` (RULING D) | `debate-view::poll-preserves-removal-masking`, `debate-view::poll-stops-when-market-leaves-open` |
| Integration (real Postgres) — **extend, do not duplicate** | `tests/server/debate-view/load-debate-view.integration.test.ts` | one added case in the existing `DEBATE.4 §6 — removal-masking gate` block: masking is **stable across repeated invocation** (the shape a poll produces) | supports `debate-view::poll-preserves-removal-masking` |

**Honesty about the masking row (RULING E).** Because the mechanism re-invokes the same read, there is *no new masking code to test*. That row is therefore a **structural guard**, and the test file's docblock says so plainly: it proves that no second read path exists and that masking stays single-sourced, and it does **not** re-prove masking behaviour (which the DEBATE.4 suite already owns). It is built so that a future "lighter" poll path — a `fetch` against a new endpoint — turns it RED.

**RED-first.** All five rows are proved RED against `origin/main` @ `54b0b2a` before any implementation lands, with the failure output captured verbatim in `docs/logs/F-DEBATE-4.md`. On a combined PLAN+EXECUTE session that captured output is what substitutes for writer/reviewer independence.

**Regression floor.** The full suite must still be green: baseline measured on this tree at `54b0b2a` = **284 files passed / 1 skipped · 2059 passed / 1 skipped / 4 todo · exit 0**.

## 8. Out of scope

- **No `error.tsx` for `/m/[slug]`** — docketed as a **POLISH.3** input. It would not save the composer (a segment boundary still replaces the subtree); it would replace Next's raw error page with something branded. Ruled a separate task; this build is what makes it urgent.
- **No fix for Top re-ordering under a reader** — a poll can reorder the column a reader is mid-sentence in, because Top is recomputed server-side every tick. Ruled accept-and-document; **named in the flow file** so it is not discovered by a participant in September.
- **No fix for the `priceChart` non-fatal read** — under 4×/min polling a flaky reserve replay makes the chart appear and vanish with no explanation. Recorded, not fixed. **POLISH.3** input.
- **No `BetComposer` change.** Suspension is keyed on composer-**open**, derived from state `DebateView` already holds. No `onDirtyChange` prop, no dirty predicate, no text-length key.
- **No in-flight guard / request queue** (refreshes coalesce — recon F16).
- **No `aria-live` on the polled region** — it would make a screen reader announce the whole debate view every 15 s. The a11y treatment of a polled debate surface is a design question, not an inheritance from the admin precedent.
- **No SSE / WebSockets** (SPEC.2 §4.3, ADR-0006 — testnet phase).
- **No poll on any other surface.** `/u/[pseudonym]`, `/bookmarks` and Discovery are untouched; Discovery is explicitly cached-not-polled (SPEC.1 §22).
- **No HARDEN.6 number tuning.** 15000 is a provisional pin; the tune stays deferred and is a one-line change by construction.
- **No `FLOWS-BACKFILL`.** Exactly one flow file — `F-DEBATE-4.md` — gains substance. The other 36 skeletons stay skeletons.

---

## Open questions

**None at plan time.** Every decision this build could have needed was ratified in advance (RULINGS A–H) or is a documented judgement call recorded under `## Unratified choices` in `docs/logs/F-DEBATE-4.md`. Per the relay model, open decisions flow web → operator → CC; this session is explicitly unattended and non-gating, so a judgement call is recorded rather than asked.

## ADRs needed

**None.** Every architectural question this task raises was already decided:

- Where the refresh mechanism lives, and why it is not an endpoint → SPEC.1 §9 F-DEBATE-4 + SPEC.2 §4.3 (both amended same-commit by the riders).
- Why viewer state cannot enter the payload → ADR-0034 D-1.
- Why masking stays single-sourced → ADR-0021 + ADR-0034 D-4.
- Why no SSE/WS → ADR-0006.

The riders are *amendments applying existing rulings to a surface*, exactly as SPEC.1 1.0.22 (§9 price chart) was. Minting an ADR-0035 here would be stacking a record on top of decisions that already resolve the question.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The masking acceptance row cannot fail for the right reason — there is no new masking code, so a passing test proves nothing about masking. | Accepted and **stated in the test docblock** rather than papered over. Built as a structural guard that a future lighter poll path turns RED (§7, RULING E). |
| 2 | medium | A client component importing `@/server/config/limits` looks like an AGENTS.md §11 "never import from `src/server/**` into a client component" violation. | Not a violation: `limits.ts` is a zero-import pure-data module with **no** `server-only`, and the house precedent is explicit — `gating.ts:14` / `payload.ts:11` document it, and `BetComposer.tsx` + `ImageAttach.tsx` (both `"use client"`) already import it. Same pattern, same justification. |
| 3 | medium | "Stops permanently" could be read as satisfied by the market state machine never returning to `Open`, making a latch unnecessary. | A `stopped` latch is built anyway (§6 edge 6). Three lines, directly encodes the ratified word *permanently*, and removes a cross-module assumption from a client component. Tested. |
| 4 | low | Two suspension sources with different mechanics (a prop vs a DOM event) invite an ordering bug. | Collapsed to one derived `suspended` boolean feeding a single effect; `document.hidden` is mirrored into state by its own listener effect. The both-suspenders case is an explicit test (§6 edge 4). |
| 5 | low | The rider's Acceptance bullet classifies the **stop** rule as a read-path test, but the stop *effect* is client-side. | Honoured by splitting honestly: the read-path file pins the stop signal's **provenance** (`market.status` is the sole input; no freeze signal anywhere in the poll), and the client-render file carries the behavioural stop case as a supporting assertion. Each §17 name appears once. Recorded as an Unratified choice. |
| 6 | low | Introducing the repo's first `visibilitychange` handler sets a pattern with no precedent to inherit. | Kept minimal and local to `DebatePoll` — one listener, mirrored to state, removed on cleanup. No shared hook is minted; a second consumer can extract one. |
| 7 | low | Adding a case to a landed DEBATE.4 integration file touches work outside this task. | It is the §5.7-mandated *extend rather than duplicate*, one `it()` in an existing `describe`, no fixture change. |

---

## References

- `CLAUDE.md` §2 / §3 / §5 / §6 — the contract this plan respects
- `AGENTS.md` §5 / §8 / §9 / §11 — Next.js, Tailwind, testing and boundary patterns
- `docs/specs/SPEC.1.md` §9 F-DEBATE-4 + F-DEBATE-5, §16.1, §17, §20, Appendix B — amended same-commit to 1.0.25
- `docs/specs/SPEC.2.md` §0, §0.1, §4.3, §13.1–§13.5 — amended same-commit to 1.0.22
- `docs/specs/flows/F-DEBATE-4.md` — the six-field flow contract, landed in this PR per SPEC.2 §13.4
- ADR-0034 (D-1 · D-2 · D-4) · ADR-0021 · ADR-0025 · ADR-0006
- `~/Desktop/zz-recon-F-DEBATE-4/RECON.md` — the read-only recon this plan is built against (F1–F16)
- `docs/plans/PCT-ROUND.md` + `docs/logs/PCT-ROUND.md` — the immediately preceding debate-surface build
- Tracker entry: **B3** (operator-maintained, external)
