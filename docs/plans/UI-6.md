# UI-6 — Admin Control Centre — Plan (authored 2026-07-22; awaiting web ratification)

> **What this builds.** The two-tab Admin Control Centre ratified in SPEC.1 §15 (v1.0.19, `ZUGZWANG-SPEC-ADMIN-CENTRE_amendment_v1_0`, merged in #258): **Moderation** (default landing) + **Markets**. Moderation = a reactive chronological review feed of live content with **Remove / Ban** (F-ADMIN-4) + audit-log search (F-ADMIN-5). Markets = a thin list with a live needs-resolution count + freeze countdown and three terminal actions — **Close / Resolve / Void** (F-ADMIN-3 / F-RESOLVE-3).
>
> **This plan is executable by a session with ZERO context.** Every path, function, test, and acceptance criterion is explicit. Assume the executor has read nothing but this plan and the repo.
>
> **Ground:** `main` @ **`ac466c2`** (SPEC.1 1.0.19 merged). Recon below ran read-only at that HEAD.
>
> **Ritual:** critical-path build (moderation + resolution). Gated plan→execute + named-reviewer cascade. **NEVER ultracode** on F-ADMIN-3 / F-ADMIN-4. `ultrathink` first word of every execute prompt. `/model opus`, `/effort max`.

---

## 0 · Ground (STEP 0 recon — verify-don't-trust, read-only, ran 2026-07-22 @ `ac466c2`)

### 0.1 What is already BUILT (assert, do not rebuild)

| Surface | File | State |
|---|---|---|
| `resolveMarketAction(formData)` → `ActionResult<{resolutionEventId, winningSide, totalPaidOut, poolUnwindAmount}>` | `src/server/admin/markets/resolve.ts` | **built + tested.** Composed F-ADMIN-3+F-RESOLVE-1 (trigger→settle, Resolving-resume). Fields: `marketId` (uuid), `winningSide` (`"YES"|"NO"`), `reason` (min 1, max `RESOLUTION_REASON_MAX_CHARS`). Calls `requireAdminSession()`; revalidates `/admin/markets` + `/admin/markets/[marketId]`. |
| `voidMarketAction(formData)` → `ActionResult<{voidResolutionEventId, betsRefunded, poolUnwindAmount}>` | `src/server/admin/markets/void.ts` | **built + tested.** F-RESOLVE-3. Fields: `marketId` (uuid), `reason` (min 1, max `RESOLUTION_REASON_MAX_CHARS`). Live gate `expectedStatus ['Open','Closed']`. |
| `closeMarketAction(formData)` → `ActionResult<{status:"Closed"}>` | `src/server/admin/markets/close.ts` | **built + tested.** Manual `Open→Closed`. Field: `marketId` (uuid). Rejects pre-deadline (`deadline_not_reached`) + non-Open (`market_not_open`). |
| Admin session gate (per-action) `requireAdminSession()` / envelope helpers `adminSessionRequired()`, `validationError()`, `toActionError()`, `buildAdminMetadata()`, `ActionResult<T>` | `src/server/admin/wire.ts` | **built.** `ActionResult<T> = {ok:true;data:T} | {ok:false;error:{code;message;field_errors?}}` (SPEC.2 §4.4). Error codes: `illegal_edge`, `error_resolution_serialization_exhausted`, `market_not_open`, `market_not_draft`, `deadline_not_reached`, `validation_error`, `admin_session_required`, `correction_same_outcome`, `error_internal`. |
| Admin page gate `requireAdminPage()` (redirects to `/admin/login`) + `requireUuidParam()` | `src/server/admin/page-guards.ts` | **built.** Call at TOP of every admin page except login. **Never** an `(admin)` group layout — it would loop the in-group login page. |
| Markets list page (thin, unstyled, `force-dynamic`, `requireAdminPage`, reads `markets`, shows status counts + table + New-market link) | `src/app/(admin)/admin/markets/page.tsx` | **built** (ENGINE.15 S3). UI.6 extends it. |
| Market admin detail page | `src/app/(admin)/admin/markets/[marketId]/page.tsx` | **built.** UI.6 adds the terminal-action affordances here (Markets-tab-only surface). |
| F-ADMIN-5 audit loader `loadModerationAuditFeed({limit})` → blocked `mod_actions` rows (200 cap), view-model mapped, never raw R2 key | `src/server/admin/moderation/audit-feed.ts` + `audit-view.ts` | **built** (read-only; `audit-feed-leak` guard forbids URL-mint tokens in the file). **No search predicates yet.** |
| F-ADMIN-5 audit page (read-only, `force-dynamic`, `requireAdminPage`, REASON_META + category-score render) | `src/app/(admin)/admin/moderation/audit/page.tsx` | **built.** UI.6 adds search + nests it under the Moderation tab. |
| Precommit gate consequence writer `recordGateBlock()` (writes `mod_actions` + `users.banned_at` on track_a + `moderation.blocked` event; INV-2/3 safe) | `src/server/moderation/consequences.ts` | **built.** Gate-time only; `pass` opens the bet tx with **no** `mod_actions` row. |
| Removal masking `loadRemovedSet(client, ids[])` — the SINGLE masking gate, keyed ONLY on `mod_actions.reason='content_removed'` (`users.banned_at` never masks) | `src/server/debate-view/load-debate-view.ts` | **built.** The reactive-removal read-side already works; UI.6 supplies the write-side (`moderateComment`). |
| Freeze reader `isFrozen()` (global `system_state.frozen_at`; admin paths do NOT call it) | `src/server/system/is-frozen.ts` | **built.** Confirms §6.1: admin resolution/close/void are outside the freeze gate. |
| Transition graph (`Frozen` vestigial-unreachable; only `Resolved|Voided → Frozen`, never written) | `src/server/markets/transitions.ts` | **built.** No code writes `markets.status='Frozen'` (SPEC.1 §6.1, corrected). |

### 0.2 What is NOT built (UI.6 must build)

| Gap | Evidence | Slice |
|---|---|---|
| **`/admin` index route** (the `/admin`→`/admin/moderation` redirect) | no `src/app/(admin)/admin/page.tsx` on disk | S0 |
| **Two-tab nav** (Moderation \| Markets) | no `(admin)`/`(admin)/admin` layout; must be a per-page component | S0 |
| **Moderation-tab live review feed page** | only `/admin/moderation/audit/page.tsx` exists; no `/admin/moderation/page.tsx` | S3 |
| **Live-content review-feed READER** (every Track-C, non-`content_removed` comment, chronological) | grep found no `loadReviewFeed`/live-content reader; `loadModerationAuditFeed` reads **blocked** rows only | S3 |
| **Reactive Remove/Ban Server Action `moderateComment`** at `src/server/admin/moderation/act.ts` | `act.ts` absent; `moderateComment` absent from `src/`; `tests/server/admin/moderation/act.test.ts::f-admin-4::pass-verdict-removal` is **`it.skip`** (SCAFFOLD.16 written-failing, labelled "DEBATE.2-owned" — DEBATE.2 did not land it) | S3 |
| **Terminal-action UI + typed hard confirm** (Close/Resolve/Void wiring) | actions built; no admin UI wires them | S2 |
| **Live needs-resolution count + freeze countdown** on Markets tab | markets page shows raw status counts only | S1 |
| **F-ADMIN-5 search predicates** (date range, action type, market, user, pseudonym) | `loadModerationAuditFeed` takes only `{limit}` | S4 |

### 0.3 Tokens (globals.css — the styling surface)

Branded dark monochrome system in `src/app/globals.css` `@theme` + `:root`. Primitives: `--color-ground` (page), `--color-ink`, ramp `--color-n0…n7` (dark→bright), side poles `--color-yes` (`#181818`) / `--color-no` (`#fafafa`). shadcn semantic slots alias primitives (`--background`, `--card`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--border`, `--destructive`→n6-neutralized). Guarded by `tests/unit/design/tokens-monochrome.test.ts`. **UI.6 adds no tokens** — it consumes existing ones.

---

## 1 · Approach (one paragraph)

UI.6 assembles the Admin Control Centre almost entirely from parts that already exist. The three terminal market actions are **built and tested**, so F-ADMIN-3 is a UI-wiring slice plus a typed hard-confirm gate. The F-ADMIN-5 audit surface is built, so it needs search predicates and a home under the Moderation tab. The genuinely new engine work is **F-ADMIN-4**: a live-content review-feed reader that provably returns every live row, and the reactive **Remove/Ban** Server Action (`moderateComment`) that writes an append-only `mod_actions` row (`content_removed` / `user_banned`, verdict NULL) + sets `users.banned_at` on ban, touching **no** position and **no** ledger row (ADR-0021). Everything is admin-only, tokens-only, and structurally separate from the participant surface. The build is five slices; the two critical-path slices (F-ADMIN-3, F-ADMIN-4) run the full reviewer cascade, never ultracode, and **HARD STOP at the open PR** for founder merge.

---

## 2 · The build — slices (tests-first per §5.6; each independently green under §9)

| # | Slice | Files (created/edited at execute) | Mode | Reviewers |
|---|---|---|---|---|
| **S0** | `/admin` redirect + two-tab shell | `src/app/(admin)/admin/page.tsx` (new) · `src/app/(admin)/admin/_components/AdminTabs.tsx` (new, admin-internal chrome) | **[AUTONOMOUS]** | `@code-reviewer` |
| **S1** | Markets tab: list + live needs-resolution count + freeze countdown | `src/app/(admin)/admin/markets/page.tsx` (edit) · optional `_components/NeedsResolutionCount.tsx` | **[AUTONOMOUS]** | `@code-reviewer` |
| **S2** | Markets tab: **Close / Resolve / Void** UI + typed hard confirm | `src/app/(admin)/admin/markets/[marketId]/page.tsx` (edit) · `src/app/(admin)/admin/markets/_components/TerminalActions.tsx` (new, client) | **[AUTONOMOUS · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]** | `@code-reviewer` → `@security-auditor` |
| **S3** | Moderation tab: live review feed READER + **Remove/Ban** action + feed UI | `src/server/admin/moderation/review-feed.ts` (new) · `src/server/admin/moderation/act.ts` (new — `moderateComment`) · `src/app/(admin)/admin/moderation/page.tsx` (new) · `_components/ReviewFeed.tsx` (new, client action affordances) | **[AUTONOMOUS · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]** | `@code-reviewer` → `@security-auditor` |
| **S4** | Moderation tab: F-ADMIN-5 audit-log search | `src/server/admin/moderation/audit-feed.ts` (edit — add search predicates) · `src/app/(admin)/admin/moderation/audit/page.tsx` (edit — search form) | **[AUTONOMOUS]** | `@code-reviewer` |

**Slice order:** S0 → S1 → S2 → S3 → S4 (shell first so every later page mounts the tab nav; S2/S3 are the `@security-auditor` gates). **PR structure:** see §8 — the whole build rides ONE feature branch and ONE PR that **HARD STOPS at open** (interdependent shell; the founder ratifies the single final merge, per the kickoff).

---

### 2.S0 · Shell — `/admin` redirect + two tabs  [AUTONOMOUS]

- **`src/app/(admin)/admin/page.tsx`** (new): a Server Component that calls `requireAdminPage()` (unauth → `/admin/login`) then `redirect("/admin/moderation")` (`next/navigation`). Zero client JS.
- **`AdminTabs.tsx`** (new, admin-internal presentational component — **not** a participant product component; tokens-only): renders two links, **Moderation** (`/admin/moderation`) and **Markets** (`/admin/markets`), with the active tab derived from the current path. Rendered at the top of **both** the Moderation page and the Markets page. **NOT a route-group layout** — `page-guards.ts` warns an `(admin)` layout loops the in-group login page; each page imports and renders `<AdminTabs active=… />` itself.
- **Files touched:** the two above. No edit to `login/page.tsx`, `markets/new`, or media routes.
- **Tests FIRST:** `tests/server/admin/admin-index-redirect.test.ts` — (1) authed GET `/admin` → redirect to `/admin/moderation`; (2) unauthed → `/admin/login` (guard runs before redirect). Follow the `page-guards.test.ts` mock pattern (`validateAdminSession` + `cookies` mock; assert the `redirect()` target).
- **Acceptance:** `/admin` never renders content — it redirects; Moderation is the default landing; both tabs reachable; active-state correct; unauth bounces to login.

### 2.S1 · Markets tab — list + live needs-resolution count + freeze countdown  [AUTONOMOUS]

- **Edit `src/app/(admin)/admin/markets/page.tsx`:** keep `force-dynamic` + `requireAdminPage()`; mount `<AdminTabs active="markets" />`. Add:
  - **Needs-resolution count** = `COUNT(markets WHERE status='Closed')` (the §6.1 pre-freeze obligation is discharged against this). Render prominently.
  - **Freeze countdown** = `FREEZE_INSTANT_UTC − now`, becoming prominent near 2026-11-05. **Import the existing pinned constant** `FREEZE_INSTANT_UTC` (`2026-11-05T23:59:00Z`) from its module (`src/server/markets/create.ts` or `src/server/config/limits.ts`). **STOP-AND-ASK if it is not exported** — do not redefine the freeze instant (single source of truth).
  - Keep the thin status table; the list stays deliberately thin (the actions are the surface).
- **"Live" treatment:** `force-dynamic` server render = fresh-on-view. **See OQ-1** — do NOT mint a websocket. Optional: a client interval re-fetch (poll), if and only if OQ-1 rules it in.
- **Tests FIRST:** `tests/server/admin/markets-needs-resolution.test.ts` — needs-resolution count = number of `Closed` markets (0, 1, N); freeze-countdown value present and derived from `FREEZE_INSTANT_UTC`. Extend the existing `markets.test.ts` mock pattern.
- **Acceptance:** count equals the `Closed` cardinality exactly; countdown renders; tab nav present; no participant surface touched.

### 2.S2 · Markets tab — Close / Resolve / Void + typed hard confirm  [CRITICAL · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]

- **Wire the three BUILT actions** — do not reimplement. `closeMarketAction` / `resolveMarketAction` / `voidMarketAction` (§0.1). Post `FormData` with exactly their fields (`marketId`; Resolve adds `winningSide`+`reason`; Void adds `reason`). Surface `ActionResult` errors (`illegal_edge` → "not legal for the market's current state", `admin_session_required`, `validation_error` field errors, `error_resolution_serialization_exhausted` → "system busy, retry").
- **Surface = Markets tab only** (SPEC.1 §15 F-ADMIN-3 Surface): the affordances live on `src/app/(admin)/admin/markets/[marketId]/page.tsx` (admin detail). **No inline button on any participant/debate market page**, even when `state=Closed`.
- **`TerminalActions.tsx`** (new, `"use client"` — needed for the typed-confirm input state):
  - **Close** — single ordinary confirm (reversible in effect, no settlement). Pre: `status='Open'`.
  - **Resolve** — `winningSide` selector (YES/NO) + mandatory `reason` free-text + **hard confirm: the admin must type the exact market question** to arm submit. Pre: `status ∈ {Closed, Resolving}`.
  - **Void** — mandatory `reason` free-text + **hard confirm: type the exact market question** to arm submit. Pre: `status ∈ {Open, Closed}`.
  - Buttons render conditionally by the market's current `status` (matching each action's Pre).
- **Typed-confirm gate** (SPEC.1 §15 F-ADMIN-3 Confirmation, item 2): submit is disabled until the typed token **exactly** equals the market question (drawn from the market itself; case/whitespace-exact — the plan's default is trimmed exact-string equality; **OQ-2** if a looser match is wanted). Rationale restated: resolution is irreversible (`Resolved→Open` illegal, INV-4); across a Nov-5 sequence a one-click confirm degrades to muscle memory.
- **No dry-run preview** (SPEC.1 §15 F-ADMIN-3 — struck to optional/deferred). **No F-RESOLVE-2 correction surface** (not in v1).
- **Tests FIRST** (`tests/server/admin/…` + a component test if the harness supports it — else server-action-integration tests):
  - typed-confirm gate: Resolve/Void submit disabled until typed question matches; Close needs no typed match.
  - each affordance posts the correct FormData shape to the correct action (assert field set).
  - error surfacing: `illegal_edge`, `admin_session_required`, `validation_error` render as user-facing copy, never raw `.message`.
  - conditional render by status (Close only when Open; Resolve when Closed/Resolving; Void when Open/Closed).
- **Acceptance:** the three built actions are reachable **only** from the Markets tab; typed hard confirm arms Resolve/Void; Close is one-click; every error path shows typed copy; **`@security-auditor` raises no blocking finding**; PR opens and **HARD STOPS**.

### 2.S3 · Moderation tab — live review feed + Remove/Ban  [CRITICAL · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]

The only genuinely new engine work. Three parts:

**(a) `review-feed.ts` — the live-content reader.** `loadReviewFeed(options)` → chronological (by `created_at`, then `id`) list of **every live comment**: every `comments` row (a comment persists **only** if it passed the gate — Track A/B never insert one) **minus** the `content_removed` set. **No filter, no market filter, no ranking** (ADR-0021 + SPEC.1 §15 F-ADMIN-4, corrected). Reuse the masking source of truth: intersect against `mod_actions.reason='content_removed'` (same predicate `loadRemovedSet` uses). Each row: content (text + image URL), post-vs-reply (reply carries a collapsed parent snippet), market, side (`side_at_post_time`), author pseudonym, Dharma, prior-flag count, timestamp, state badge, and **category-score annotation where a `mod_actions` record is present** (see **OQ-3**). Map to a DTO — never expose Drizzle row types.
  - **"Every live row" is load-bearing** (kickoff STOP-AND-ASK). If completeness cannot be **proven** — e.g., a cap/pagination/filter would silently drop live rows — **STOP AND ASK**. If a cap is required for volume, it must be an explicit, newest-first window whose truncation is visible in the UI and asserted in a test, never a silent limit. Default: no cap in v1 (single-operator, 51-day window); confirm at OQ-4.
  - **Ban does NOT mask** (ADR-0021): a banned author's prior content stays visible; `banned_at` never enters the feed's live/removed predicate.

**(b) `act.ts` — `moderateComment`, the reactive Remove/Ban Server Action.** Turns the skipped `act.test.ts` green. Contract:
  - `requireAdminSession()` first (Layer-2, per-action; null → `adminSessionRequired()` with ZERO writes).
  - Input (zod): `commentId` (uuid), `action` ∈ {`remove`, `ban`, `remove_and_ban`} (decoupled — Remove and Ban are independent axes, ADR-0020 retained; **OQ-5** on the exact input encoding vs the SCAFFOLD.16 `act.test.ts` shape).
  - **Remove** → append a `mod_actions` row `{reason:'content_removed', verdict:null, targetCommentId, targetMarketId, categories:{} or the stored gate categories if available, actorId:'admin-singleton'}`. Comment hidden via the existing read-time masking (no `comments` mutation — Bucket-A append-only).
  - **Ban** → append a `mod_actions` row `{reason:'user_banned', verdict:null, targetUserId, …}` **and** set `users.banned_at` (only where `banned_at IS NULL`, the one-shot Bucket-B-style write on the mutable `users` row). **No position, no ledger, no bet touch** (INV-1/2/3 — ban removes voice, not balance).
  - Multi-write ⇒ `db.transaction(...)`. Any external (none expected) runs outside the tx.
  - Returns `ActionResult<…>`; revalidates `/admin/moderation`.
  - **NO new event type.** If the implementer concludes a `moderation.removed`/`moderation.banned` event is required, that is a **HARD STOP** (kickoff: no new event types) — see OQ-6.
- **(c) `/admin/moderation/page.tsx` (new) + `ReviewFeed.tsx` (client).** `force-dynamic`, `requireAdminPage()`, mount `<AdminTabs active="moderation" />`, render `loadReviewFeed()` rows with per-row **Remove / Ban** affordances (single, explicit, per-comment — **no bulk/multi-select**, one comment → one decision → one `mod_actions` row). Polled-on-view (no websocket). Category scores annotated where present.
- **Tests FIRST:**
  - **un-skip** `tests/server/admin/moderation/act.test.ts::f-admin-4::pass-verdict-removal` and drive `moderateComment`: Remove writes exactly one `content_removed` row, comment absent-from-public via masking, `users.banned_at` NOT set; Ban writes `user_banned` + sets `banned_at`; decoupled paths independent; **assert zero writes to `positions`/`bets`/`dharma_ledger`** (INV-2/3); admin-session gate rejects with zero writes.
  - `tests/server/admin/moderation/review-feed-completeness.test.ts` (integration, real PG): every live comment appears; a `content_removed` comment is absent; a banned author's non-removed comment still appears; ordering is chronological; **no market filter**.
  - reason-enum: `content_removed`/`user_banned` used (already in `modReasonEnum` — no migration).
- **Acceptance:** feed returns provably-every-live-row; Remove hides via masking with an audit row; Ban sets `banned_at` + audit row, positions ride; no ledger/position write; no new event type; no DDL; `@security-auditor` raises no blocking finding; PR opens and **HARD STOPS**.

### 2.S4 · Moderation tab — F-ADMIN-5 audit-log search  [AUTONOMOUS]

- **Edit `audit-feed.ts`:** add optional search predicates to `loadModerationAuditFeed` — **date range** (`createdAt` between), **action type** (`reason` in set), **market** (`targetMarketId`), **user** (`targetUserId`), **pseudonym** (join `users.pseudonym`). Preserve the leak guard (no R2 URL-mint tokens in this file). **OQ-7:** SPEC.1 §15 F-ADMIN-5 says search spans `admin_events` **and** `mod_actions`; the built loader reads `mod_actions` only — confirm whether `admin_events` search is in v1 scope or deferred.
- **Edit `audit/page.tsx`:** add a search form (`searchParams`-driven, Server-Component; keeps zero/minimal client JS) nested under `<AdminTabs active="moderation" />`; wire predicates through to the loader.
- **Tests FIRST:** `tests/server/admin/moderation/audit-search.test.ts` — filter by each predicate independently returns the expected subset; empty filters = current behaviour (most-recent-first, capped).
- **Acceptance:** each predicate narrows results correctly; no leak-guard regression; audit surface lives under the Moderation tab.

---

## 3 · ⚠️ MANDATORY — STOP AND ASK (the unattended run's only safety valve)

**The execute run is unattended. Halting is CHEAP and CORRECT; guessing is not.** STOP (write `claude-progress.md`, open no further work, surface, end the turn) on ANY of the following. This list is deliberately generous — when in doubt, it is on the list.

**Hard architectural triggers (always stop):**
1. **Any DDL or migration turns out to be needed** — a new column, index, enum value, table, or trigger. UI.6 is `NO DDL`. (Note: `content_removed`/`user_banned` already exist in `modReasonEnum`; if anything *else* is needed → STOP.)
2. **Any new event type turns out to be needed** — e.g., reactive Remove/Ban seems to require a `moderation.removed`/`moderation.banned` `events` row. UI.6 is `NO new event types`. STOP before extending `EVENT_TYPES`.
3. **Anything requires a shared *participant* product component** — a debate/card/composer/header component, or any import from a participant surface. Admin-internal chrome built fresh is fine; reaching into participant components is a STOP.
4. **Any need to touch** `(public)/layout.tsx`, the participant header/nav, ANY participant surface, `/admin/markets/new`, the F-ADMIN-1 / F-ADMIN-2 routes, or `src/app/(admin)/admin/markets/media/*`.

**Interface / behavioural triggers:**
5. **Any interface mismatch** between the plan's assumed `closeMarketAction` / `resolveMarketAction` / `voidMarketAction` signature (§0.1) and the real code at execute time (fields, return shape, error codes). Re-verify before wiring; on drift, STOP.
6. **Any moderation-feed read path that cannot be PROVEN to return every live row** (§2.S3a). If a cap/pagination/filter would silently drop live content, STOP. A visible, tested, explicit truncation is the only acceptable bound.
7. **Any ambiguity between the amended SPEC.1 and the code** that changes behaviour — including the OQs below if they turn out to bite. Do not pick a behaviour that could be wrong; STOP and surface the options.
8. **`moderateComment` needs to write anything to `positions`, `bets`, or `dharma_ledger`** — that violates ADR-0021 / INV-1/2/3. This must be structurally impossible; if the implementation seems to require it, STOP (it is a design error, not a task).
9. **The typed-confirm token cannot be sourced unambiguously from the market** (e.g., the market has no stable question string to type) → STOP (OQ-2).
10. **`FREEZE_INSTANT_UTC` is not exported / not found** where §2.S1 expects it → STOP; do not redefine the freeze instant.
11. **`@security-auditor` raises ANY blocking (CRITICAL/HIGH) finding** on S2 or S3 → fix in-session if in scope; if the fix needs out-of-scope change → STOP.
12. **Category-score annotation (OQ-3) turns out to require persisting gate categories on `pass`** — that is new write behaviour and probably a schema change → STOP.
13. **The reviewer cascade (`@security-auditor`) surfaces a SURPRISE out of scope** → `claude-progress.md` + STOP (do not absorb silently, §5.4).
14. **Any slice would exceed "wire the built action" into "rebuild settlement/CPMM/ledger math"** → STOP; the engine is out of UI.6 scope.

**On STOP:** write the finding to `claude-progress.md`, do not open/advance the PR past the stopping point, and end the turn. The next human decision is cheaper than a wrong unattended write to a critical path.

---

## 4 · Open questions / assumptions / spec-vs-code ambiguities (surface for web ratification)

- **OQ-1 — "live" needs-resolution counter.** SPEC.1 §15.2 calls it "the single deliberate websocket exception." **No websocket infra exists**, and the kickoff forbids minting a second one. **Assumption:** "live" = `force-dynamic` fresh-on-view server render (optionally a client interval poll), **not** a websocket. Confirm.
- **OQ-2 — typed-confirm token.** **Assumption:** the admin types the market **question** (`markets.title`), trimmed exact-string match, to arm Resolve/Void. Confirm the field and the match strictness (exact vs case-insensitive vs a shorter token like the slug).
- **OQ-3 — category scores on the LIVE feed.** SPEC.1 §15 F-ADMIN-4 says annotate scores "where present on the row's `mod_actions` record" from `mod_actions.categories`. **But passed (live) comments have NO `mod_actions` row** (`recordGateBlock` writes only for track_a/track_b; `pass` opens the bet tx with categories discarded — no `comments` moderation column). **Assumption (literal reading):** show scores only for the rare live row that also carries a `mod_actions` record; for ordinary passed content the annotation is simply absent. If the intent is scores on **all** live rows → that needs gate categories persisted on pass → **DDL/new-write → STOP** (OQ-3 = trigger #12).
- **OQ-4 — feed cap.** **Assumption:** no cap in v1 (single operator, bounded 51-day content volume) so "every live row" is literally satisfied. If a cap is desired, it must be explicit + visible + tested (never silent). Confirm.
- **OQ-5 — `moderateComment` input encoding.** The skipped `act.test.ts` (SCAFFOLD.16, "DEBATE.2-owned") pins a `moderateComment(input)` shape. **Execute must read that test first** and match its exact input/`mod_actions`-row contract (it is the tests-first driver). If the test's assumed row encoding conflicts with the current `mod_actions` schema → STOP (OQ-5 = trigger #7).
- **OQ-6 — does reactive Remove/Ban emit an `events` row?** `recordGateBlock` emits `moderation.blocked`. SPEC.1 §15 F-ADMIN-4 "Response" specifies only a `mod_actions` row + `banned_at` for reactive actions — **no events row named**. **Assumption:** reactive Remove/Ban writes `mod_actions` (+`banned_at`) and **no** `events` row (so no new event type). If an event is deemed required → STOP (trigger #2).
- **OQ-7 — F-ADMIN-5 `admin_events` search.** SPEC.1 §15 F-ADMIN-5 spans `admin_events` **and** `mod_actions`; the built loader is `mod_actions`-only. **Assumption:** v1 search covers `mod_actions` (extended with predicates); `admin_events` search is deferred unless ratified in. Confirm.
- **OQ-8 — PR granularity.** **Assumption:** one feature branch, one PR for all five slices (shared shell ⇒ interdependent), HARD STOP at open for the single founder merge. If separate autonomous-vs-critical PRs are wanted, confirm (the critical slices still HARD STOP).
- **Assumption A1 — admin-internal components are not "shared product components."** The kickoff bans "shared product components"; `AdminTabs`/`TerminalActions`/`ReviewFeed` are admin-only chrome built fresh, tokens-only. Reading this as permitted. If the intent is "zero new components at all" → STOP (that would make the tabs/feed unbuildable).
- **Ambiguity Am1 — brand-token freeze note.** The built audit page comments "brand tokens `--color-yes/no` stay frozen until DESIGN.7." The kickoff explicitly authorises YES/NO **pole** badges here. Following the kickoff (poles allowed for side badges); flag if DESIGN.7 freeze is meant to still bind.

---

## 5 · Inherited behaviours (asserted at execute, not rebuilt)

- The three terminal actions' correctness, retry/serialization handling, Resolving-resume, and INV-4 lock-in — **already tested** (`tests/server/admin/{resolution,pool-seed,markets}.test.ts`, `close-due-markets`). UI.6 asserts wiring, not settlement math.
- Removal masking (`loadRemovedSet`, `content_removed`-keyed) — the read side is built; UI.6 only supplies the write (`moderateComment`).
- Admin auth (Layer-2 `requireAdminSession`/`requireAdminPage`; the CVE-2025-29927 posture where proxy Layer-1 is UX-only) — every new endpoint and page re-validates a real `admin_sessions` row (SPEC.1 §15.1: inline affordance is UI convenience, never a privilege path).
- INV-2/3 in `recordGateBlock` (banned_at-only, no ledger) — the pattern `moderateComment` mirrors.

---

## 6 · SPEC.2 same-commit obligations (assess at execute)

New primitives may need same-commit SPEC.2 codification (per the middleware/same-commit doctrine): the `review-feed.ts` read model (SPEC.2 §4/§10 read-surface) and `moderateComment` (SPEC.2 §4 Server-Action inventory — the SCAFFOLD.16 test cites "SPEC.2 §4 line 371" as its target home). **If S3 lands `moderateComment`, land the paired SPEC.2 §4 row in the same commit.** No DDL ⇒ no SPEC.2 §5 schema change. Confirm scope at execute; if a SPEC.2 amendment is non-trivial/decision-bearing → treat as a doc gate (surface).

---

## 7 · Test plan (tests-first; `@test-writer` at Phase 2 start on S2/S3)

| Slice | Test file | Asserts |
|---|---|---|
| S0 | `tests/server/admin/admin-index-redirect.test.ts` | `/admin`→`/admin/moderation`; unauth→`/admin/login` |
| S1 | `tests/server/admin/markets-needs-resolution.test.ts` | needs-resolution = `Closed` count (0/1/N); freeze countdown from `FREEZE_INSTANT_UTC` |
| S2 | `tests/server/admin/terminal-actions.test.ts` (+ component test if supported) | typed-confirm gate arms Resolve/Void; Close one-click; correct FormData per action; typed error copy; conditional render by status |
| S3 | `tests/server/admin/moderation/act.test.ts` (un-skip + drive) | Remove→one `content_removed` row + masked; Ban→`user_banned` + `banned_at`; decoupled; **zero** positions/bets/ledger writes; admin gate zero-write reject |
| S3 | `tests/server/admin/moderation/review-feed-completeness.test.ts` (integration) | every live row returned; `content_removed` absent; banned author's content present; chronological; no market filter |
| S4 | `tests/server/admin/moderation/audit-search.test.ts` | each predicate narrows correctly; leak-guard intact |

Invariant-class assertions to re-affirm (not new invariants): INV-1/2/3 untouched by moderation; INV-4 lock-in on Resolve (inherited).

---

## 8 · Reviewer cascade (§5.11) + gates

`@test-writer` (Phase 2 start on S2 + S3 — failing tests first) → build slice → **`@code-reviewer`** (every slice touching `src/server/` or `src/app/(admin)/`) → **`@security-auditor`** (S2 + S3 — the critical-path gates: terminal actions carry INV-4/refund consequences; the moderation feed + Remove/Ban is the moderation critical path + a masking/leak/exposure surface + an admin-privilege boundary). `@db-migration-reviewer` is **not** invoked — **no DDL** (if a slice tries to add DDL, that's STOP trigger #1, not a reviewer call).

**Pass `@docs/plans/UI-6.md` to every subagent** (they start from zero context).

**HARD STOP AT OPEN PR:** the execute session runs `just verify` + the suites, opens ONE PR for UI.6, and **STOPS** — it does **not** self-merge. The founder ratifies the single final merge (kickoff). If `@security-auditor` blocks, fix in-scope or STOP (trigger #11).

---

## 9 · Verification gate (per slice + pre-PR)

- **Per slice:** `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build) + the slice's suite green. Critical-path slices (S2/S3) additionally `pnpm test:invariants` + `pnpm test:integration` (or `just test-db`), run **directly** (`pnpm vitest run …`) against local PG `:54322` so `DATABASE_URL` defaults local (never via `just`, which hits the cloud DB in `.env.local`).
- **Pre-PR (critical slices):** the §5.10 self-audit — schema (none expected; assert "no DDL"), every handler vs the plan's API surface, the INV assertions (S3: zero ledger/position writes; S2: INV-4 lock-in inherited). Full-suite `pnpm vitest run` as the final local gate (catches cross-suite floors, e.g. EVENT_TYPES inventory — which must remain **24**, unchanged).
- Do not claim done before green; do not pipe gate output to `tail` (swallows failures).

---

## 10 · NOT doing (scope fence)

- ❌ `(public)/layout.tsx`, participant header/nav, any participant surface.
- ❌ `/admin/markets/new`, F-ADMIN-1 / F-ADMIN-2 routes, `markets/media/*` (functional + unstyled; required September — must not be removed or restyled).
- ❌ Dry-run consequence preview (struck to optional/deferred, SPEC.1 §15 F-ADMIN-3).
- ❌ F-RESOLVE-2 correction surface (not in v1).
- ❌ Any DDL, migration, or new event type.
- ❌ Any Dharma/position/ledger write from moderation (ADR-0021).
- ❌ Bulk-action / multi-select moderation (one comment, one decision, one row).
- ❌ Market filter or ranking on the review feed (ADR-0021).
- ❌ A websocket (the needs-resolution "live" counter is fresh-on-view, OQ-1).
- ❌ Admin `users` row / any participant-shaped admin path (admin has no `users` row).
- ❌ Self-merging the UI.6 PR (HARD STOP at open; founder merges).

---

## 11 · Self-critique (ranked)

1. **F-ADMIN-4 is bigger than "wire a built action."** The Remove/Ban backend and the live-feed reader are both new critical-path code. *Mitigated:* schema supports it with no DDL (verified §0.2); the reader reuses the `content_removed` masking predicate; `act.test.ts` already pins the contract; `@security-auditor` mandatory; every risk has a STOP trigger.
2. **Category-scores ambiguity (OQ-3) could hide a DDL requirement.** *Mitigated:* the literal "where present" reading needs no writes; the alternative is an explicit STOP (trigger #12).
3. **"Every live row" is easy to get subtly wrong** (a stray join/filter drops rows). *Mitigated:* dedicated completeness integration test + STOP trigger #6; default no-cap.
4. **Typed-confirm UX vs D6 reversal** — a later founder ruling supersedes the ideation's "no ceremony." *Mitigated:* recorded in SPEC.1 §15/§20; plan follows the ratified spec.
5. **One-PR HARD-STOP vs autonomous sub-slices** — the autonomous slices don't individually merge. *Accepted:* shared shell makes them interdependent; OQ-8 lets the founder split if wanted.

---

## 12 · Execute preconditions (prompt 2, fresh session)

`/clear` → fresh chat against `@docs/plans/UI-6.md` → `/model opus`, `/effort max` → `ultrathink` first word. Gated plan→execute. **NEVER ultracode** on S2/S3. Reviewer cascade §8. `@docs/plans/UI-6.md` passed to every subagent. **HARD STOP at the open PR.** This plan chat ends at the plan commit (Stage 4); it does not execute and opens no code branch.
