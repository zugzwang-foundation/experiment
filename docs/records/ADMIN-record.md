# ADMIN — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** the Admin Control Centre — market creation and media, pool seeding, the market lifecycle, moderation review and audit, resolution, and break-glass.

## 1 · What this lane is

One person operates Zugzwang, and the product is built so that operating it and playing it are
different things done by different entities. The admin creates markets, seeds their pools,
closes them when their deadline passes, resolves them, removes content that should not stand,
and bans authors who post it. The admin cannot bet, comment, hold a position or earn Dharma —
not because a check forbids it, but because **the admin has no row in `users` to do it from**.

Everything the admin does is reachable two ways. The **Hub** at `/admin` is the workplace: the
review feed, the audit search, the market list and the terminal actions. **Inline** affordances
appear on public pages when an authenticated admin is looking, and they do content-level
remediation only — remove this comment, ban this author. Both call the same endpoints and write
the same audit rows; the difference is only where the admin enters the action from.

## 2 · Feature table

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| Admin login (password, separate path) | SHIPPED | `src/server/auth/admin/login.ts`, `validate.ts`, `logout.ts` | `F-AUTH-ADMIN` | 0010 | `tests/server/auth/admin-login.test.ts`, `admin-login-result.test.ts` | — |
| Admin page guards | SHIPPED | `src/server/admin/page-guards.ts`, `wire.ts` | SPEC.1 §15 | 0010 | `tests/server/admin/page-guards.test.ts`, `admin-index-redirect.test.ts` | — |
| Hub `/admin` | SHIPPED | `src/app/(admin)/admin/page.tsx`, `_components/AdminTabs.tsx` | SPEC.1 §15.1 | — | `tests/server/admin/admin-index-redirect.test.ts` | — |
| **Create market** | SHIPPED | `src/server/admin/markets/create.ts`, `src/server/markets/create.ts`, `src/app/(admin)/admin/markets/new/` | SPEC.1 §15 · `F-ADMIN-1` | — | `tests/server/admin/markets.test.ts`, `create-market-form-utc-label.component.test.tsx` | — |
| **Seed pool** | SHIPPED | `src/server/admin/markets/seed.ts`, `src/server/markets/open.ts` | `F-ADMIN-2` | — | `tests/server/admin/pool-seed.test.ts` | — |
| Market list + overview | SHIPPED | `src/server/admin/markets/overview.ts`, `src/app/(admin)/admin/markets/page.tsx` | SPEC.1 §15.1 | — | `tests/server/admin/markets-needs-resolution.test.ts` — the only test importing `loadAdminMarketsOverview`, and it covers **only the needs-resolution count**. ⚠ **The list itself: none** | |
| Per-market admin page | SHIPPED | `src/app/(admin)/admin/markets/[marketId]/page.tsx` | SPEC.1 §15.1 | — | ⚠ **none.** Nothing mounts or asserts on the page. `tests/server/admin/terminal-actions.test.ts` covers `terminal-actions-logic.ts` (*"No IO, no DB, no React"*) and would pass with the page deleted | |
| Terminal actions (close / resolve / correct / void) | SHIPPED | `_components/TerminalActions.tsx`, `terminal-actions-logic.ts`; server `src/server/admin/markets/{close,resolve,correct,void}.ts` | SPEC.1 §14 · `F-ADMIN-3` | — | `tests/server/admin/terminal-actions{,-permanence}.component.test.tsx`, `resolution.test.ts` | — |
| Needs-resolution count | SHIPPED | `_components/NeedsResolutionCount.tsx`, `src/server/admin/markets/overview.ts` | SPEC.1 §15.1 | — | `tests/server/admin/markets-needs-resolution.test.ts` | — |
| Close-due sweep (cron) | SHIPPED | `src/server/markets/close.ts`, `src/app/api/cron/close-due-markets/route.ts` | SPEC.1 §14 | — | `tests/server/cron/` | — |
| **Market media — admin upload** | SHIPPED | `src/app/(admin)/admin/markets/media/sign/route.ts`, `src/server/markets/media.ts` | SPEC.1 §9 | **0026 → 0027** | `tests/server/admin/markets-media{,-sign,-sign-envelope,-sign-log-request}.test.ts` | — |
| Composer pick-from-pool | SHIPPED | `market_media` + `comments.market_media_id` | SPEC.1 §9 | 0026 | `tests/integration/market-media-selection.integration.test.ts` | — |
| **Moderation review feed** | SHIPPED | `src/server/admin/moderation/review-feed.ts`, `_components/ReviewFeed.tsx` | SPEC.1 §15 · `F-ADMIN-4` | 0021 | `tests/server/admin/moderation/review-feed-{completeness.integration,side-chip.component}.test.*` + `review-feed.component.test.tsx` | `docs/parked.md` UI-6 D1, D3 |
| Moderation action (remove / ban) | SHIPPED | `src/server/admin/moderation/act.ts` | `F-ADMIN-4` | 0020, 0021 | `tests/server/admin/moderation/act.test.ts` | no un-ban affordance — UI-6 D4 |
| **Audit log + search** | SHIPPED | `src/server/admin/moderation/{audit-feed,audit-view}.ts`, `src/app/(admin)/admin/moderation/audit/` | SPEC.1 §15 · `F-ADMIN-5` | — | `tests/server/admin/audit-search.test.ts`, `moderation/audit-{feed-leak,page-auth,view}.test.ts`, `audit-search-surface.component.test.tsx` | — |
| **Resolution trio** — settle / correct / void | SHIPPED | `src/server/resolution/{settle,correct,void,trigger,basis}.ts`, W-3 `transaction.ts` | SPEC.1 §11 · `F-RESOLVE-1..3` | 0039 | `tests/server/resolution/` (**7** files — `actor-assert`, `concurrency`, `correction`, `freeze-exemption`, `happy-path`, `pro-rata`, `void`), `tests/invariants/I-RESOLVE-ONCE-001…`, `tests/integration/resolution-conservation.integration.test.ts` | — |
| Admin actor belt | SHIPPED | `src/server/admin/actor.ts:30 (assertAdminActor)` | SPEC.2 §3.7 | — | `tests/server/resolution/actor-assert.test.ts` | — |
| Conclusion freeze | SHIPPED | `src/server/system/is-frozen.ts`, `system_state.frozen_at` | SPEC.1 §14 | — | `tests/server/system/` | freeze **banner** not built |
| Break-glass rotation | **DOCUMENTED, never exercised** | — | — | — | `docs/runbooks/BREAK_GLASS.md` (124 lines) | §3 "Future HARDEN.10 scope" |
| Admin `users` row / `role` column | **NOT BUILT — refused by design** | — | SPEC.1 §15 | 0010 | `src/db/schema/auth.ts:29-30` | never |
| Un-ban affordance | **NOT BUILT** | — | — | — | none | `docs/parked.md` UI-6 Gate C D4 (founder decision) |

## 3 · The decisions that shaped it

| Decision | Recorded in | What it changed |
|---|---|---|
| Admin auth is a static password, hand-rolled, two-layer | ADR-0010 | admin never enters Better Auth and never acquires a `users` row |
| Content removal decoupled from user ban | ADR-0020 | a body can be withdrawn without banning its author |
| Reactive moderation, no held queue | ADR-0021 (supersedes 0020's queue half) | the admin reviews **live** content; **no moderation action touches a position** |
| Market media, admin-set per market | ADR-0026 | the `market_media` table, the third R2 arm, the composer's pick-from-pool |
| **Admin market-media upload is NOT moderated** | **ADR-0027** (supersedes ADR-0026 §D4) | the admin upload path stopped calling the participant classifier |
| Per-argument lot accounting | ADR-0039 | void and settle read surviving basis |
| Resolutions are append-only | — | `resolution_events` + `payout_events`, INV-4 |

### 3.1 · The ADR-0026 / ADR-0027 supersession, resolved from the route

⛔ **ADR-0027 governs the admin market-media upload path today.** Its header carries
`**Supersedes** | ADR-0026 (partial — §D4 admin-upload moderation)`, **Status accepted**,
**Date 2026-06-30**, and its title is *"Admin Market-Media Direct Upload (No Moderation)"*.

Confirmed from the route's own code rather than from the ADR:

| Measurement | Result |
|---|---|
| `grep -nE "^import .*server/moderation" 'src/app/(admin)/admin/markets/media/sign/route.ts'` | **0** |
| **Positive control** — the same pattern on the participant path `src/app/api/bets/place/route.ts` | **2** — `:26 recordGateBlock`, `:27 precommitModerate` |

The route says so itself at `src/app/(admin)/admin/markets/media/sign/route.ts:22-27`:

> `// POST /admin/markets/media/sign — MEDIA.1 (OD-4 / ADR-0026 / ADR-0027).`
> `// … ADR-0027: market-media is operator-curated trusted content — written`
> `// directly, NOT moderated; this route does not import or touch`
> `// `src/server/moderation/**`.`

⚠ **A naïve `grep -c "server/moderation"` on that route returns 1, and the hit is the comment
saying it does not import moderation.** Matching import statements rather than the word is what
makes the zero a measurement — the same trap `V-17` names.

**Why the decision, in one line from ADR-0027:** the participant classifier exists to gate
untrusted user-generated content; the admin path has one trusted uploader and no untrusted
input, so running it there is *"ceremony against a threat that does not exist on this path"* —
and it would force an admin-context caller into `precommit.ts`, adding surface to a
safety-critical file for no safety gain. **Participant image and comment moderation is
unchanged and fully intact.**

⚠ **`CLAUDE.md` §7's decision log has not absorbed this.** Line 286 still records ADR-0026's
*"admin-context upload moderation"*, and `grep 'ADR-0027' CLAUDE.md` returns nothing. Recorded,
not fixed — `docs/STATE.md` §4 · `F-4`.

## 4 · Invariants and guards this lane carries

⛔ **Structural separation is a data-model fact.** `src/db/schema/auth.ts:29-30`:

> `// No `role` column. No `is_admin`. Per §8.7 pillar 1 (admin has no users`
> `// row; structural separation by data-model) — also CLAUDE.md §3.`

**The admin actor belt is the runtime half of that.** `src/server/admin/actor.ts:30 (assertAdminActor)`
`assertAdminActor` throws unless `actor_id === "admin-singleton"` **and** `user_id === null`.
Every lifecycle and resolution write passes through it — create, open, close, trigger, settle,
correct, void. Its docblock states the reason the identity is a singleton rather than a user:
*"the admin has no `users` row, structurally"*, and the close-due sweep emits under the same
identity because *"the deadline is the admin's committed market parameter; the clock executes
the admin's standing instruction."*

**The market state machine is a closed set of eight edges**, `src/server/markets/transitions.ts:35-41`:

```
Draft     → Open
Open      → Closed | Voided
Closed    → Resolving | Voided
Resolving → Resolved
Resolved  → Frozen
Voided    → Frozen
Frozen    → (absorbing)
```

Illegal transitions are **negative tests**, not runtime hopes. The one clock-guarded edge is
`Open → Closed` (`transitions.ts:75-78`): off-`Open` is `illegal_edge`, and
`now < deadline` is `deadline_not_reached` — the clock is an **argument**, so the transition
function stays pure and testable.

| Invariant | How this lane carries it |
|---|---|
| **INV-4** — resolutions append-only | `resolution_events` + `payout_events` immutable post-INSERT, at the storage layer. `tests/invariants/I-APPEND-ONLY-001…` |
| Terminate exactly once | partial unique index `resolution_events_terminal_market_uq`; a second terminal row is a `23505`. `correct` rows keep the chain open. `tests/invariants/I-RESOLVE-ONCE-001…` |
| Conservation at settlement | money is neither created nor destroyed. `tests/integration/resolution-conservation.integration.test.ts` |
| Admin actions are audited | `mod_actions` and `admin_events` are **Bucket A** — append-only at the storage layer. `tests/db/triggers/` |
| **No moderation action touches a position** | ADR-0021's central rule. Removing a body withdraws the argument, never the stake |

⚠ **Admin route handlers must live under `/admin/...`, never `/api/admin/...`.** The admin
session cookie is scoped `Path=/admin` (`src/server/auth/admin/login.ts:224`), so a handler
under `/api/admin/...` never receives it and 401s the real admin. MEDIA.1 relocated exactly
such a route for exactly this reason, after a `cookies()` mock had masked the failure in the
unit layer.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| SCAFFOLD.3 | #38 | `62cd299` | 2026-05-16 | admin two-layer middleware |
| SCAFFOLD.16 | #52 | `45b35e1` | 2026-05-26 | LD-3 Track A carve-out + the F-γ-thin §15 F-ADMIN-4 extension |
| ENGINE.9 | #114 | `af28566` | 2026-06-12 | the resolution trio + the F-ADMIN-3 trigger + the W-3 wrapper |
| ENGINE.14 | #118 | `a29ef7e` | 2026-06-12 | market lifecycle writes — W-4 + create/open/close + sweep + the admin actor guard |
| ENGINE.15 | #122 | `b8d4ee4` | 2026-06-13 | HTTP / cron / admin wiring — admin actions and pages, close-due cron, resolution actor belt |
| ADR-0020 spec | #140 | `dd698ea` | 2026-06-18 | content removal decoupled; the admin-dashboard IA |
| Moderation foundation | #143 | `02f87ac` | 2026-06-19 | reactive-moderation consequences + `mod_actions` |
| UI.6 / F-ADMIN-5 | #145 | `1a18fd5` | 2026-06-19 | the read-only moderation audit viewer |
| **MEDIA.1** | **#184** | `a08fc46` | 2026-06-30 | admin market-media creation (ADR-0026 / **0027**) |
| MEDIA.1 canon | #185 | `3f325be` | 2026-06-30 | the footprint into canon |
| MEDIA.1 close | #186 | `248e02f` | 2026-06-30 | close-out; ADR ceiling → 0027 |

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-4` | `CLAUDE.md` §7 still records ADR-0026's superseded admin-moderation clause; ADR-0027 is not mentioned |
| `docs/STATE.md` §4 · `F-2` | production holds **0 markets** — the admin has created none there |
| `docs/parked.md` — UI-6 Gate C D1 | the review-feed prior-flag count is blind to content removals |
| `docs/parked.md` — UI-6 Gate C D2 | the moderation image TTL is too short for a browsing surface |
| `docs/parked.md` — UI-6 Gate C D3 | review-feed `innerJoin(users)` — verified safe today, **armed on the next `review-feed.ts` touch** |
| `docs/parked.md` — UI-6 Gate C D4 | no un-ban affordance (founder decision) |
| `docs/parked.md` — AUDIT-FIX-B2 OQ-2 | app-as-owner role split — the only complete TRUNCATE fix, dated pre-launch |
| `docs/runbooks/BREAK_GLASS.md` §3 | future HARDEN.10 scope; the rotation has never been exercised |
| SPEC.1 §21.7 | the freeze **banner** is reserved and not built; the freeze **mechanism** is shipped |
