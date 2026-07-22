# UI-6 — Admin Control Centre — Plan (RATIFIED — web Claude, 2026-07-22, with corrections A1–A4 + the S3-contract ruling R1–R5 folded in)

> **What this builds.** The two-tab Admin Control Centre ratified in SPEC.1 §15 (v1.0.19, `ZUGZWANG-SPEC-ADMIN-CENTRE_amendment_v1_0`, merged in #258): **Moderation** (default landing) + **Markets**. Moderation = a reactive chronological review feed of live content with **Remove / Ban** (F-ADMIN-4) + audit-log search (F-ADMIN-5). Markets = a thin list with a live needs-resolution count + freeze countdown and three terminal actions — **Close / Resolve / Void** (F-ADMIN-3 / F-RESOLVE-3).
>
> **⚠️ UI.6 does NOT complete F-ADMIN-4.** It delivers the Track-C live-content review feed + reactive Remove/Ban only. Three F-ADMIN-4 pieces are **deferred to DEBATE.7** (docketed, not forgotten — §2.S3 A2): Track-A auto-actioned informational rows; the LD-3 text-only `sexual/minors` carve-out ban-review surface (**child-safety relevant**); and the inline Remove/Ban affordance on the participant debate view (participant-surface, fenced by the kickoff). CSAM is **never** re-rendered anywhere; Track-A rows are absent from v1 by design.
>
> **This plan is executable by a session with ZERO context.** Every path, function, test, and acceptance criterion is explicit. Assume the executor has read nothing but this plan and the repo.
>
> **Ground:** `main` @ **`ac466c2`** (SPEC.1 1.0.19 merged; plan committed at `26866af`; A1–A4 folded at `f8a4d43` / #260). Recon below ran read-only at that HEAD. **The S3-contract ruling R1–R5 (web Claude, 2026-07-22) is folded here** — its factual claims (`runCorrect` + close/resolve/void forms already wired on `[marketId]/page.tsx`; the `act.test.ts` superseded shape; the `correctResolutionAction` contract; `mod_actions` columns incl. `categories` **NOT NULL** + `verdict` nullable) were re-verified read-only at `f8a4d43`.
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
| `correctResolutionAction(formData)` → `ActionResult<{correctionEventId, betsAffected, uncollectableTotal}>` (F-RESOLVE-2, **in scope via R4**) | `src/server/admin/markets/correct.ts` | **built + tested.** Appends a `corrects_event_id` correction row (INV-4: corrections are NEW rows, never an un-resolve). Fields: `marketId` (uuid), `correctedSide` (`"YES"|"NO"`), `reason` (min 1, max `RESOLUTION_REASON_MAX_CHARS`). Errors: `correction_same_outcome` (same-as-tip no-op), `illegal_edge` (non-Resolved). The only repair path for a wrong resolution. |
| Admin session gate (per-action) `requireAdminSession()` / envelope helpers `adminSessionRequired()`, `validationError()`, `toActionError()`, `buildAdminMetadata()`, `ActionResult<T>` | `src/server/admin/wire.ts` | **built.** `ActionResult<T> = {ok:true;data:T} | {ok:false;error:{code;message;field_errors?}}` (SPEC.2 §4.4). Error codes: `illegal_edge`, `error_resolution_serialization_exhausted`, `market_not_open`, `market_not_draft`, `deadline_not_reached`, `validation_error`, `admin_session_required`, `correction_same_outcome`, `error_internal`. |
| Admin page gate `requireAdminPage()` (redirects to `/admin/login`) + `requireUuidParam()` | `src/server/admin/page-guards.ts` | **built.** Call at TOP of every admin page except login. **Never** an `(admin)` group layout — it would loop the in-group login page. |
| Markets list page (thin, unstyled, `force-dynamic`, `requireAdminPage`, reads `markets`, shows status counts + table + New-market link) | `src/app/(admin)/admin/markets/page.tsx` | **built** (ENGINE.15 S3). UI.6 extends it. |
| Market admin detail page — **already wires** close / resolve / void / **correct** / seed as plain-HTML forms (inline `"use server"` wrappers → the built wire actions; result surfaced via `?ok=` / `?error=<code>` redirect params; **ZERO client JS**) | `src/app/(admin)/admin/markets/[marketId]/page.tsx` | **built (ENGINE.15 S3).** UI.6 does NOT re-wire the actions (R5). It adds (a) the typed-confirm **client** gate over Resolve / Void / **Correct** (R4/R5), (b) typed error copy for the raw `?error=<code>` surface (R5), (c) `<AdminTabs active="markets" />` framing. `runCorrect` (F-RESOLVE-2) **STAYS** (R4). Seed (Draft, F-ADMIN-2) is out of scope — untouched. |
| F-ADMIN-5 audit loader `loadModerationAuditFeed({limit})` → blocked `mod_actions` rows (200 cap), view-model mapped, never raw R2 key | `src/server/admin/moderation/audit-feed.ts` + `audit-view.ts` | **built** (read-only; `audit-feed-leak` guard forbids URL-mint tokens in the file). **No search predicates yet; reads `mod_actions` only.** |
| F-ADMIN-5 audit page (read-only, `force-dynamic`, `requireAdminPage`, REASON_META + category-score render) | `src/app/(admin)/admin/moderation/audit/page.tsx` | **built.** UI.6 adds search + nests it under the Moderation tab. |
| Precommit gate consequence writer `recordGateBlock()` (writes `mod_actions` + `users.banned_at` on track_a + `moderation.blocked` event; INV-2/3 safe) | `src/server/moderation/consequences.ts` | **built.** Gate-time only; `pass` opens the bet tx with **no** `mod_actions` row (so passed/live comments carry **no** stored OpenAI categories — see A4/OQ-3). |
| Removal masking `loadRemovedSet(client, ids[])` — the SINGLE masking gate, keyed ONLY on `mod_actions.reason='content_removed'` (`users.banned_at` never masks) | `src/server/debate-view/load-debate-view.ts` | **built.** The reactive-removal read-side already works; UI.6 supplies the write-side (`moderateComment`). |
| Signed-read image URL `signRead(key, ttlSeconds)` → `mintReadUrl("uploads", key, ttl)`; moderation TTL const `READ_URL_TTL_SECONDS_MODERATION` (60s) | `src/server/storage/sign-read.ts` + `src/server/storage/r2.ts` | **built.** The A1 image-mint seam for the feed (server-side, short-TTL, no raw key). |
| Freeze reader `isFrozen()` (global `system_state.frozen_at`; admin paths do NOT call it) | `src/server/system/is-frozen.ts` | **built.** Confirms §6.1: admin resolution/close/void are outside the freeze gate. |
| Transition graph (`Frozen` vestigial-unreachable; only `Resolved|Voided → Frozen`, never written) | `src/server/markets/transitions.ts` | **built.** No code writes `markets.status='Frozen'` (SPEC.1 §6.1, corrected). |
| `FREEZE_INSTANT_UTC = 2026-11-05T23:59:00Z` (pinned module constant, the deadline ceiling) | `src/server/markets/create.ts` (verify exact export at execute — STOP if not exported, §3 #10) | **built.** Import — never redefine. |

### 0.2 What is NOT built (UI.6 must build)

| Gap | Evidence | Slice |
|---|---|---|
| **`/admin` index route** (the `/admin`→`/admin/moderation` redirect) | no `src/app/(admin)/admin/page.tsx` on disk | S0 |
| **Two-tab nav** (Moderation \| Markets) | no `(admin)`/`(admin)/admin` layout; must be a per-page component | S0 |
| **Moderation-tab live review feed page** | only `/admin/moderation/audit/page.tsx` exists; no `/admin/moderation/page.tsx` | S3 |
| **Live-content review-feed READER** (every Track-C, non-`content_removed` comment, chronological) | grep found no `loadReviewFeed`/live-content reader; `loadModerationAuditFeed` reads **blocked** rows only | S3 |
| **Reactive Remove/Ban Server Action `moderateComment`** at `src/server/admin/moderation/act.ts` | `act.ts` absent; `moderateComment` absent from `src/`; `tests/server/admin/moderation/act.test.ts::f-admin-4::pass-verdict-removal` is **`it.skip`** and encodes a **SUPERSEDED** model (`approve`/`block`/`remove_pass_verdict` vocab; asserts `UPDATE comments SET hidden_at`) — **must be REWRITTEN, not un-skipped** (R1: ADR-0021 held-queue-removed + ADR-0020 decoupled supersede it; the scaffold sits below the ADRs in precedence) | S3 |
| **Typed hard-confirm gate + typed error copy** over the built Close/Resolve/Void/**Correct** forms | forms **already wired** as plain HTML (ENGINE.15 S3) with raw `?error=<code>` surfaces + no typed gate; UI.6 adds the client gate + typed copy + AdminTabs (R4/R5) — S2 is largely pre-built | S2 |
| **Live needs-resolution count + freeze countdown** on Markets tab | markets page shows raw status counts only | S1 |
| **F-ADMIN-5 search predicates over BOTH `admin_events` AND `mod_actions`** (date range, action type, market, user, pseudonym) | `loadModerationAuditFeed` takes only `{limit}`, reads `mod_actions` only | S4 |

### 0.3 Tokens (globals.css — the styling surface)

Branded dark monochrome system in `src/app/globals.css` `@theme` + `:root`. Primitives: `--color-ground` (page), `--color-ink`, ramp `--color-n0…n7` (dark→bright), side poles `--color-yes` (`#181818`) / `--color-no` (`#fafafa`). shadcn semantic slots alias primitives (`--background`, `--card`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--border`, `--destructive`→n6-neutralized). Guarded by `tests/unit/design/tokens-monochrome.test.ts`. **UI.6 adds no tokens** — it consumes existing ones. YES/NO **pole** badges are permitted here (web-ratified — the DESIGN.7 brand-token freeze does not bind side-pole badges).

---

## 1 · Approach (one paragraph)

UI.6 assembles the Admin Control Centre almost entirely from parts that already exist. The three terminal market actions are **built and tested**, so F-ADMIN-3 is a UI-wiring slice plus a typed hard-confirm gate. The F-ADMIN-5 audit surface is built, so it needs search predicates (now over **both** `admin_events` and `mod_actions`, A3) and a home under the Moderation tab. The genuinely new engine work is **F-ADMIN-4 (partial)**: a live-content review-feed reader that provably returns every live row (Track-C only), renders images via a short-TTL admin-gated signed URL, and the reactive **Remove/Ban** Server Action (`moderateComment`) that writes an append-only `mod_actions` row (`content_removed` / `user_banned`, verdict NULL) + sets `users.banned_at` on ban, touching **no** position and **no** ledger row (ADR-0021). Everything is admin-only, tokens-only, and structurally separate from the participant surface. The build is five slices; the two critical-path slices (F-ADMIN-3, F-ADMIN-4) run the full reviewer cascade, never ultracode, and the whole build **HARD STOPs at the open PR** for founder merge.

---

## 2 · The build — slices (tests-first per §5.6; each independently green under §9)

| # | Slice | Files (created/edited at execute) | Mode | Reviewers |
|---|---|---|---|---|
| **S0** | `/admin` redirect + two-tab shell | `src/app/(admin)/admin/page.tsx` (new) · `src/app/(admin)/admin/_components/AdminTabs.tsx` (new, admin-internal chrome) | **[AUTONOMOUS]** | `@code-reviewer` |
| **S1** | Markets tab: list + live needs-resolution count + freeze countdown | `src/app/(admin)/admin/markets/page.tsx` (edit) · optional `_components/NeedsResolutionCount.tsx` (client, 60s poll) | **[AUTONOMOUS]** | `@code-reviewer` |
| **S2** | Markets tab: **Close / Resolve / Void** UI + typed hard confirm | `src/app/(admin)/admin/markets/[marketId]/page.tsx` (edit) · `src/app/(admin)/admin/markets/_components/TerminalActions.tsx` (new, client) | **[AUTONOMOUS · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]** | `@code-reviewer` → `@security-auditor` |
| **S3** | Moderation tab: live review feed READER (+image mint) + **Remove/Ban** action + feed UI | `src/server/admin/moderation/review-feed.ts` (new) · `src/server/admin/moderation/act.ts` (new — `moderateComment`) · `src/app/(admin)/admin/moderation/page.tsx` (new) · `_components/ReviewFeed.tsx` (new, client action affordances) | **[AUTONOMOUS · NEVER ULTRACODE · @security-auditor MANDATORY (incl. the image-URL mint path) · HARD STOP AT OPEN PR]** | `@code-reviewer` → `@security-auditor` |
| **S4** | Moderation tab: F-ADMIN-5 audit-log search (over `admin_events` + `mod_actions`) | `src/server/admin/moderation/audit-feed.ts` (edit — add search predicates + `admin_events`) · `src/app/(admin)/admin/moderation/audit/page.tsx` (edit — search form) | **[AUTONOMOUS]** | `@code-reviewer` |

**Slice order:** S0 → S1 → S2 → S3 → S4 (shell first so every later page mounts the tab nav; S2/S3 are the `@security-auditor` gates). **PR structure:** ONE feature branch, ONE PR for all five slices (shared shell ⇒ interdependent), **HARD STOP at open** for the single founder merge (web-ratified, A4).

---

### 2.S0 · Shell — `/admin` redirect + two tabs  [AUTONOMOUS]

- **`src/app/(admin)/admin/page.tsx`** (new): a Server Component that calls `requireAdminPage()` (unauth → `/admin/login`) then `redirect("/admin/moderation")` (`next/navigation`). Zero client JS.
- **`AdminTabs.tsx`** (new, admin-internal presentational component — **permitted** (web-ratified): the "no shared components" ban is on shared **participant** product components; admin-only chrome built fresh, tokens-only, is fine): renders two links, **Moderation** (`/admin/moderation`) and **Markets** (`/admin/markets`), active tab from the current path. Rendered at the top of **both** the Moderation page and the Markets page. **NOT a route-group layout** — `page-guards.ts` warns an `(admin)` layout loops the in-group login page; each page imports and renders `<AdminTabs active=… />` itself.
- **Files touched:** the two above. No edit to `login/page.tsx`, `markets/new`, or media routes.
- **Tests FIRST:** `tests/server/admin/admin-index-redirect.test.ts` — (1) authed GET `/admin` → redirect to `/admin/moderation`; (2) unauthed → `/admin/login` (guard runs before redirect). Follow the `page-guards.test.ts` mock pattern.
- **Acceptance:** `/admin` never renders content — it redirects; Moderation is the default landing; both tabs reachable; active-state correct; unauth bounces to login.

### 2.S1 · Markets tab — list + live needs-resolution count + freeze countdown  [AUTONOMOUS]

- **Edit `src/app/(admin)/admin/markets/page.tsx`:** keep `force-dynamic` + `requireAdminPage()`; mount `<AdminTabs active="markets" />`. Add:
  - **Needs-resolution count** = `COUNT(markets WHERE status='Closed')` (the §6.1 pre-freeze obligation is discharged against this). Render prominently.
  - **Freeze countdown** = `FREEZE_INSTANT_UTC − now`, prominent near 2026-11-05. **Import the existing pinned constant** `FREEZE_INSTANT_UTC` (`2026-11-05T23:59:00Z`). **STOP-AND-ASK if it is not exported** — never redefine the freeze instant (§3 #10).
  - Keep the thin status table (the actions are the surface).
- **"Live" treatment (web-ratified, A4/OQ-1): NO websocket.** `force-dynamic` server render (fresh-on-view) + a **60-second client interval re-fetch** for the needs-resolution count + countdown (a small client component, e.g. `NeedsResolutionCount.tsx`, that re-reads via a route/`router.refresh()` on a 60s timer). No second websocket exception is minted.
- **Tests FIRST:** `tests/server/admin/markets-needs-resolution.test.ts` — needs-resolution count = number of `Closed` markets (0, 1, N); freeze-countdown derived from `FREEZE_INSTANT_UTC`. Extend the existing `markets.test.ts` mock pattern.
- **Acceptance:** count equals the `Closed` cardinality exactly; countdown renders + refreshes on the 60s interval; tab nav present; no participant surface touched.

### 2.S2 · Markets tab — typed hard confirm + typed error copy over the built Close / Resolve / Void / Correct forms  [CRITICAL · NEVER ULTRACODE · @security-auditor MANDATORY · HARD STOP AT OPEN PR]

**S2 is largely PRE-BUILT (R5, verified read-only at `f8a4d43`).** `src/app/(admin)/admin/markets/[marketId]/page.tsx` (ENGINE.15 S3) already renders plain-HTML forms wiring the four built wire actions via inline `"use server"` wrappers (`runClose` / `runResolve` / `runVoid` / `runCorrect`), each conditional on `status`, each surfacing the result via a `?ok=` / `?error=<code>` redirect param. **Do NOT re-wire the actions and do NOT reimplement settlement/CPMM/ledger math** (STOP trigger #14). S2 reduces to three additions: **(1)** a typed-confirm **client** gate, **(2)** typed error copy replacing the raw `?error=<code>` surface, **(3)** the `<AdminTabs active="markets" />` framing.

- **VERIFY-DON'T-ASSUME (R5).** Before touching anything, re-confirm the built forms post the exact field sets and that the wire actions' signatures are unchanged (§0.1). On ANY drift → STOP (trigger #5). Confirmed shapes at `f8a4d43`: Close `{marketId}`; Resolve `{marketId, winningSide, reason}`; Void `{marketId, reason}`; **Correct `{marketId, correctedSide, reason}`**.
- **Surface = Markets tab only** (SPEC.1 §15 F-ADMIN-3 Surface): affordances stay on `[marketId]/page.tsx` (admin detail). **No inline button on any participant/debate market page**, even when `state=Closed`.
- **`TerminalActions.tsx`** (new, `"use client"` — the typed-confirm input state) wraps the state-appropriate forms; the page keeps its conditional-by-`status` render:
  - **Close** — single ordinary confirm (reversible in effect, no settlement). Pre: `status='Open'`. **No typed gate.**
  - **Resolve** — `winningSide` selector (YES/NO) + mandatory `reason` + **hard confirm: type the market question** to arm submit. Pre: `status ∈ {Closed, Resolving}`.
  - **Void** — mandatory `reason` + **hard confirm: type the market question** to arm submit. Pre: `status ∈ {Open, Closed}`.
  - **Correct (F-RESOLVE-2, R4)** — `correctedSide` selector (YES/NO) + mandatory `reason` + **hard confirm: type the market question** to arm submit. Pre: `status='Resolved'`. **`runCorrect` STAYS** — it is the only repair path for a wrong resolution (INV-4, no un-resolve) and, because it appends to an append-only lineage, **must not carry less friction than the resolution it repairs** (R4, deliberate web-ruled scope addition).
  - Forms render conditionally by the market's current `status` (matching each Pre).
- **NO parallel ungated path may survive (R5).** The gated client component REPLACES the plain-HTML Resolve / Void / Correct submit paths — after S2 there is exactly one gated submit path per action. Close stays one-click; **Seed (Draft, F-ADMIN-2) is out of scope — left untouched** (do not wrap or restyle it).
- **Typed-confirm gate (web-ratified, A4/OQ-2):** submit disabled until the typed token equals the market **question** (`markets.title`) under **trimmed, CASE-INSENSITIVE** comparison. Rationale: resolution/correction are irreversible against an append-only lineage (`Resolved→Open` illegal, INV-4); across a Nov-5 sequence a one-click confirm degrades to muscle memory (SPEC.1 §15 F-ADMIN-3, supersedes ideation D6).
- **Typed error copy (R5):** the four actions' `ActionResult` error codes render as user-facing copy, never a raw code or `.message` — `illegal_edge` → "not legal for the market's current state", `admin_session_required` → re-auth prompt, `validation_error` → field errors, `error_resolution_serialization_exhausted` → "system busy, retry", `correction_same_outcome` → "correction must change the outcome". (The page currently prints the bare `?error=<code>`; that raw surface is replaced.)
- **No dry-run preview** (struck to optional/deferred).
- **Tests FIRST** (`tests/server/admin/terminal-actions.test.ts` + a component test if the harness supports it):
  - typed-confirm gate: Resolve / Void / **Correct** submit disabled until the typed question matches (case-insensitive, trimmed); Close needs no typed match.
  - each affordance posts the correct FormData shape to the correct action (incl. Correct `{marketId, correctedSide, reason}`).
  - error surfacing: `illegal_edge`, `admin_session_required`, `validation_error`, `correction_same_outcome` render as user-facing copy, never raw code/`.message`.
  - conditional render by status (Close only when Open; Resolve when Closed/Resolving; Void when Open/Closed; **Correct when Resolved**).
- **Acceptance:** the four built actions reachable **only** from the Markets tab; typed hard confirm (case-insensitive) arms Resolve / Void / Correct; Close one-click; no ungated submit path survives; every error path shows typed copy; Seed untouched; **`@security-auditor` raises no blocking finding**; PR HARD STOPS.

### 2.S3 · Moderation tab — live review feed + Remove/Ban  [CRITICAL · NEVER ULTRACODE · @security-auditor MANDATORY (incl. image-URL mint) · HARD STOP AT OPEN PR]

The genuinely new engine work. **This slice partially delivers F-ADMIN-4 — see the scope boundary below.**

**(a) `review-feed.ts` — the live-content reader.** `loadReviewFeed(options)` → chronological (by `created_at`, then `id`) list of **live comments ONLY**: every `comments` row (a comment persists **only** if it passed the gate — Track A/B never insert one) **minus** the `content_removed` set. **No filter, no market filter, no ranking** (ADR-0021 + SPEC.1 §15 F-ADMIN-4, corrected). Reuse the masking source of truth: intersect against `mod_actions.reason='content_removed'` (the predicate `loadRemovedSet` uses). Each row: content (text + image — see IMAGE below), post-vs-reply (reply carries a collapsed parent snippet), market, side (`side_at_post_time`), author pseudonym, Dharma, prior-flag count, timestamp, state badge, and category-score annotation **only where a `mod_actions` record is present** (web-ratified A4/OQ-3 — ordinary live rows carry none; a `pass` writes no `mod_actions` row so its OpenAI categories are discarded). Map to a DTO — never expose Drizzle row types.

- **IMAGE RENDERING (A1 — F-ADMIN-4's entire false-negative coverage role; ADR-0021 image-category gap; this is a required capability, not optional).** The feed MUST render each live comment's image. Mint an **admin-viewable image URL server-side** from the comment's R2 key via the existing **`signRead(key, ttlSeconds)`** (`src/server/storage/sign-read.ts`) with a **short moderation-grade TTL** (`READ_URL_TTL_SECONDS_MODERATION` = 60s). The R2 key comes from the comment's `image_uploads` row. Rules, all enforced + reviewed:
  - short-TTL signed URL, minted **server-side**, **admin-session-gated** (the page/reader runs under `requireAdminPage()`/`requireAdminSession()`);
  - **NEVER** a raw R2 key in the DTO/DOM; **NEVER** a participant-path mint (`/api/uploads/sign` is participant-session-bound); **NEVER** a durable/long-TTL URL.
  - **`@security-auditor` reviews the image-URL mint path as a NAMED review item** (§8).
  - **STOP trigger:** if minting an admin-viewable URL requires new infra, a new bucket policy, or ANY change to the existing leak-guard posture → **STOP AND ASK** (§3 #15).

- **FEED SCOPE — explicit boundary (A2). `loadReviewFeed` returns Track-C live content ONLY.** The following are **DEFERRED to DEBATE.7**, recorded here and in the PR body as named docketed gaps (deferred, not forgotten). **UI.6 does not complete F-ADMIN-4.**
  1. **Track-A auto-actioned informational rows — DEFERRED to DEBATE.7.** Absent from v1 by design. **CSAM is never re-rendered anywhere.**
  2. **LD-3 text-only `sexual/minors` carve-out ban-review surface — DEFERRED to DEBATE.7** (which SPEC.1 §15 F-ADMIN-4 Acceptance already names as owner). **CHILD-SAFETY RELEVANT** — this is the one blocked-not-published item type that surfaces for a ban decision; it is explicitly out of UI.6 and owned by DEBATE.7.
  3. **F-ADMIN-4 inline surface (Remove/Ban on the participant debate view) — DEFERRED.** Touches a participant surface, fenced by the kickoff (§10).

- **"Every live row" is load-bearing** (§3 #6). The feed must provably return every live (Track-C, non-`content_removed`) row. **Cap (web-ratified A4/OQ-4): 200 newest-first, with a VISIBLE truncation indicator and a "load older" control** (pagination is NOT a filter — it never silently drops rows; the operator can always reach older rows). **The 200 cap is asserted in a test.** Ban does **not** mask (ADR-0021): a banned author's prior non-removed content stays visible.

**(b) `act.ts` — `moderateComment`, the reactive Remove/Ban Server Action.** **`act.test.ts` is a SUPERSEDED SCAFFOLD.16 scaffold — REWRITE it, do NOT match it (R1).** It encodes an `approve`/`block`/`remove_pass_verdict` + `UPDATE comments SET hidden_at` model that ADR-0021 (held queue removed) and ADR-0020 (Remove/Ban decoupled) superseded; the scaffold sits BELOW the ADRs in precedence. Rewrite it to the `content_removed`-masking model — **no `comments.hidden_at`, no `UPDATE comments`, no approve/block vocabulary.** Contract (R2):
  - **`moderateComment({ commentId, action })`**, `action: 'remove' | 'ban'`. **NO `remove_and_ban`** — a combined verb recouples the two independent axes (ADR-0020) and invents unspecified partial-failure branches. Two explicit decisions, two audit rows; the buttons may render adjacent in the UI but each posts one action.
  - `requireAdminSession()` first (Layer-2, per-action; null → `adminSessionRequired()` with ZERO writes).
  - Input (zod): `commentId` (uuid) + `action` (`z.enum(['remove','ban'])`), decoupled (independent axes, ADR-0020). If the built `mod_actions` schema conflicts with this contract → STOP (§3 #7). (Verified at `f8a4d43`: `verdict` is nullable; `categories` is **NOT NULL** — a reactive row supplies an empty `{}` jsonb since a passed comment's gate categories were discarded, D-3/OQ-3; `actor_id` is text NOT NULL = `'admin-singleton'`. No DDL needed.)
  - **Remove** → append **exactly one** `mod_actions` row `{reason:'content_removed', verdict:null, targetCommentId, targetMarketId, categories:{}, actorId:'admin-singleton'}`. Comment hidden via the existing read-time masking (`loadRemovedSet`, `content_removed`-keyed) — **ZERO writes to `comments`** (Bucket-A append-only).
  - **Ban** → append a `mod_actions` row `{reason:'user_banned', verdict:null, targetUserId, …}` **and** set `users.banned_at` **only where `banned_at IS NULL`**. **No position, no ledger, no bet, no `comments` touch** (INV-1/2/3 — ban removes voice, not balance; a banned author's prior content STAYS VISIBLE).
  - Remove and Ban are **independently invocable — neither implies the other** (ADR-0020).
  - Multi-write ⇒ `db.transaction(...)`. **NO events row, NO new event type** (web-ratified A4/OQ-6 + R3 — `EVENT_TYPES` stays **24**, `events` untouched). If an event seems required → STOP (§3 #2).
  - Returns `ActionResult<…>`; revalidates `/admin/moderation`.
- **(c) `/admin/moderation/page.tsx` (new) + `ReviewFeed.tsx` (client).** `force-dynamic`, `requireAdminPage()`, mount `<AdminTabs active="moderation" />`, render `loadReviewFeed()` rows with per-row **Remove / Ban** affordances (single, explicit, per-comment — **no bulk/multi-select**). Polled-on-view (no websocket). Category scores annotated where present. Images via the A1 signed URL.
- **Tests FIRST:**
  - **REWRITE** `tests/server/admin/moderation/act.test.ts` (R1/R3 — drop the superseded `approve`/`block`/`remove_pass_verdict` + `UPDATE comments` scaffold; write these assertions BEFORE `moderateComment` exists — they must fail first). The test SPECIFIES the contract, not the implementation. **Mandatory assertions (R3):** Remove → **exactly one** `mod_actions` row, `reason='content_removed'`, `verdict=null`; Remove → **ZERO writes to `comments`** (table untouched); removed comment masked read-side via the existing `loadRemovedSet` path; Ban → `reason='user_banned'` row + `users.banned_at` set (only where NULL); Ban → author's prior content **STAYS VISIBLE**; Remove and Ban **independently invocable, neither implying the other**; **ZERO writes to `positions`, `bets`, `dharma_ledger`** (INV-1/2/3); admin-session gate rejects with **ZERO writes**; **`events` untouched, `EVENT_TYPES` stays 24**.
  - `tests/server/admin/moderation/review-feed-completeness.test.ts` (integration, real PG): every live row returned; a `content_removed` comment absent; a banned author's non-removed comment present; chronological; **no market filter**; **the 200 cap + truncation indicator asserted**.
  - image-mint: the DTO carries a short-TTL signed URL, never a raw key (a unit assertion on the reader's output shape).
- **Acceptance:** feed returns provably-every-live-row (Track-C) up to the visible 200 cap; images render via short-TTL admin-gated signed URL, no raw key; Remove hides via masking + audit row; Ban sets `banned_at` + audit row, positions ride; no ledger/position write; no new event type; no DDL; `@security-auditor` (incl. image-mint) raises no blocking finding; PR HARD STOPS.

### 2.S4 · Moderation tab — F-ADMIN-5 audit-log search  [AUTONOMOUS]

- **Overruled OQ-7 (web-ratified A3): search spans `admin_events` AND `mod_actions`** (SPEC.1 §15 F-ADMIN-5), both tables, the **same five predicates**: **date range**, **action type**, **market**, **user**, **pseudonym**. Extend `loadModerationAuditFeed` (or add a sibling loader) to union the two sources into one result list; preserve the leak guard (no R2 URL-mint tokens in `audit-feed.ts`). **STOP-AND-ASK if the two tables cannot be sanely unioned into one result list** (§3 #16).
- **Edit `audit/page.tsx`:** add a `searchParams`-driven search form (Server-Component, minimal client JS) nested under `<AdminTabs active="moderation" />`; wire the five predicates through.
- **Tests FIRST — use the spec's canonical path (A3):** `tests/server/admin/audit-search.test.ts::query-by-date-action-market-user` (NOT `moderation/audit-search.test.ts`). Filter by each predicate independently over both tables returns the expected subset; empty filters = current behaviour (most-recent-first, capped).
- **Acceptance:** each of the five predicates narrows results across both `admin_events` and `mod_actions`; no leak-guard regression; audit surface lives under the Moderation tab.

---

## 3 · ⚠️ MANDATORY — STOP AND ASK (the unattended run's only safety valve)

**The execute run is unattended. Halting is CHEAP and CORRECT; guessing is not.** STOP (write `claude-progress.md`, advance nothing further, surface, end the turn) on ANY of the following. Deliberately generous — when in doubt, it is on the list.

**Hard architectural triggers (always stop):**
1. **Any DDL or migration turns out to be needed** — new column, index, enum value, table, or trigger. UI.6 is `NO DDL`. (`content_removed`/`user_banned` already exist in `modReasonEnum`; anything *else* → STOP.)
2. **Any new event type turns out to be needed** — e.g., reactive Remove/Ban seems to require a `moderation.removed`/`moderation.banned` `events` row. `EVENT_TYPES` stays **24**. STOP before extending it.
3. **Anything requires a shared *participant* product component** — a debate/card/composer/header component, or any import from a participant surface. Admin-internal chrome built fresh is fine; reaching into participant components is a STOP.
4. **Any need to touch** `(public)/layout.tsx`, the participant header/nav, ANY participant surface, `/admin/markets/new`, the F-ADMIN-1 / F-ADMIN-2 routes, or `src/app/(admin)/admin/markets/media/*`.
5. **Any interface mismatch** between the plan's assumed `closeMarketAction` / `resolveMarketAction` / `voidMarketAction` signature (§0.1) and the real code at execute time. Re-verify before wiring; on drift, STOP.
6. **Any moderation-feed read path that cannot be PROVEN to return every live row** (§2.S3a). The 200 cap is an explicit, visible, tested newest-first window with a "load older" control — never a silent limit or filter. If completeness can't be proven, STOP.
7. **Any ambiguity between the amended SPEC.1 and the code** that changes behaviour — including `act.test.ts`'s assumed contract vs the current `mod_actions` schema (§2.S3b). Do not pick a behaviour that could be wrong; STOP and surface options.
8. **`moderateComment` needs to write anything to `positions`, `bets`, or `dharma_ledger`** — violates ADR-0021 / INV-1/2/3. Must be structurally impossible; if it seems required, STOP.
9. **The typed-confirm token cannot be sourced unambiguously from the market** (no stable question string to type) → STOP.
10. **`FREEZE_INSTANT_UTC` is not exported / not found** where §2.S1 expects it → STOP; do not redefine the freeze instant.
11. **`@security-auditor` raises ANY blocking (CRITICAL/HIGH) finding** on S2 or S3 → fix in-session if in scope; if the fix needs out-of-scope change → STOP.
12. **Category-score annotation turns out to require persisting gate categories on `pass`** — new write behaviour + probably a schema change → STOP.
13. **The reviewer cascade surfaces a SURPRISE out of scope** → `claude-progress.md` + STOP (§5.4).
14. **Any slice would exceed "wire the built action" into "rebuild settlement/CPMM/ledger math"** → STOP.
15. **(A1) Minting an admin-viewable image URL requires new infra, a new bucket policy, or ANY change to the existing leak-guard posture** → STOP AND ASK. (The expectation is a plain `signRead(key, shortTtl)` reuse; anything more is a STOP.)
16. **(A3) `admin_events` and `mod_actions` cannot be sanely unioned into one F-ADMIN-5 result list** (irreconcilable shapes/keys) → STOP AND ASK.

**On STOP:** write the finding to `claude-progress.md`, do not open/advance the PR past the stopping point, and end the turn.

---

## 4 · Web-ratified decisions (2026-07-22 — the former open questions, now settled; folded into §2 above)

- **D-1 (OQ-1) — "live" counter:** no websocket; `force-dynamic` + a **60-second client interval** re-fetch (§2.S1).
- **D-2 (OQ-2) — typed-confirm token:** the market **question** (`markets.title`), **trimmed, case-insensitive** (§2.S2).
- **D-3 (OQ-3) — category scores on the live feed:** render **only where a `mod_actions` record is present**; ordinary live rows carry none (a `pass` discards its OpenAI categories). **Same-commit SPEC.1 §15 F-ADMIN-4 rider rides the UI.6 PR** — striking the false claim that scores are "already in `mod_actions.categories`" for feed rows, and naming the real dependency (gate categories discarded on pass; full annotation would need persistence = DDL = out of scope, docketed). **Web Claude supplies the exact rider text — the executor REQUESTS it at the commit point per the same-commit doctrine and does NOT draft spec prose itself** (§6).
- **D-4 (OQ-4) — feed cap:** 200 newest-first + **visible truncation indicator** + **"load older" control**; the cap is asserted in a test. Pagination is not a filter (§2.S3a).
- **D-5 (OQ-5) — SUPERSEDED by the S3-contract ruling R1/R2/R3 (2026-07-22).** `act.test.ts` is NOT the driver — it is a superseded SCAFFOLD.16 scaffold (ADR-0021 + ADR-0020) to be **REWRITTEN**, not matched (R1). Contract: **`moderateComment({ commentId, action })`, `action: 'remove' | 'ban'`; NO `remove_and_ban`** (R2). The rewritten test SPECIFIES the R3 contract (§2.S3b, §2.S3 Tests). This resolves the prior D-5↔§2.S3b contradiction (match-the-test vs no-`comments`-mutation) in favour of §2.S3b.
- **D-6 (OQ-6) — reactive Remove/Ban events row:** none. `EVENT_TYPES` stays **24** (§2.S3b).
- **D-7 (OQ-7 OVERRULED) — F-ADMIN-5 scope:** search spans **`admin_events` AND `mod_actions`**, five predicates, canonical test path `tests/server/admin/audit-search.test.ts::query-by-date-action-market-user` (§2.S4).
- **D-8 (OQ-8) — PR granularity:** one branch, one PR, HARD STOP at open (§2 table).
- **D-9 (A1) — admin-internal components permitted:** the "no shared components" ban is on shared **participant** product components; `AdminTabs`/`TerminalActions`/`ReviewFeed`/`NeedsResolutionCount` are admin-only chrome, tokens-only (§2.S0).
- **D-10 (Am1) — YES/NO pole badges permitted:** the DESIGN.7 brand-token freeze does not bind side-pole badges here (§0.3).

**S3-contract ruling — R1–R5 (web Claude, 2026-07-22, folded into §2):**

- **R1/R2/R3** — the `act.test.ts` REWRITE (superseded SCAFFOLD.16 scaffold, below the ADRs in precedence) + the `moderateComment({ commentId, action })` contract (`action: 'remove' | 'ban'`, **no `remove_and_ban`**) + the mandatory test assertions (§2.S3b, §2.S3 Tests; supersedes D-5 above).
- **R4** — `runCorrect` (F-RESOLVE-2) on `[marketId]/page.tsx` **STAYS** (the only repair path for a wrong resolution, INV-4) and **inherits the typed hard confirm** — it appends to an append-only lineage and must not carry less friction than the resolution it repairs. Deliberate web-ruled scope addition (§2.S2; reverses the former "No F-RESOLVE-2 correction surface" fence).
- **R5** — S2 is largely pre-built: **verify (don't assume)** the built close/resolve/void/correct forms post the exact field sets and surface `ActionResult` errors as typed copy; the typed confirm gates THOSE forms and **no parallel ungated path may survive** (§2.S2).

---

## 5 · Inherited behaviours (asserted at execute, not rebuilt)

- The three terminal actions' correctness, retry/serialization handling, Resolving-resume, and INV-4 lock-in — **already tested** (`tests/server/admin/{resolution,pool-seed,markets}.test.ts`, `close-due-markets`). UI.6 asserts wiring, not settlement math.
- Removal masking (`loadRemovedSet`, `content_removed`-keyed) — read side built; UI.6 supplies the write (`moderateComment`).
- Admin auth (Layer-2 `requireAdminSession`/`requireAdminPage`; proxy Layer-1 UX-only, CVE-2025-29927 posture) — every new endpoint and page re-validates a real `admin_sessions` row (SPEC.1 §15.1: inline affordance is UI convenience, never a privilege path).
- INV-2/3 in `recordGateBlock` (banned_at-only, no ledger) — the pattern `moderateComment` mirrors.
- `signRead` short-TTL signed-read (the SCAFFOLD.15 seam) — reused for the feed image mint (A1), not re-derived.

---

## 6 · SPEC.2 / SPEC.1 same-commit obligations (assess at execute)

- **SPEC.1 §15 F-ADMIN-4 rider (D-3/OQ-3) — REQUIRED same-commit in the UI.6 PR.** At the S3 commit point, **REQUEST the exact rider text from web Claude** (it strikes the "already in `mod_actions.categories`" claim for feed rows + names the discard-on-pass dependency). **Do NOT draft spec prose yourself** — if the rider text is not in hand at commit, that is a same-commit-doctrine STOP (request it, hold the PR).
- **SPEC.2 §4 Server-Action inventory** — `moderateComment` (the SCAFFOLD.16 test cites "SPEC.2 §4 line 371" as its target home) + the `review-feed.ts` read model (SPEC.2 §4/§10). If S3 lands `moderateComment`, land the paired SPEC.2 §4 row in the same commit. **No DDL ⇒ no SPEC.2 §5 schema change.** If a SPEC.2 amendment is non-trivial/decision-bearing → treat as a doc gate (surface).

---

## 7 · Test plan (tests-first; `@test-writer` at Phase 2 start on S2/S3)

| Slice | Test file | Asserts |
|---|---|---|
| S0 | `tests/server/admin/admin-index-redirect.test.ts` | `/admin`→`/admin/moderation`; unauth→`/admin/login` |
| S1 | `tests/server/admin/markets-needs-resolution.test.ts` | needs-resolution = `Closed` count (0/1/N); freeze countdown from `FREEZE_INSTANT_UTC` |
| S2 | `tests/server/admin/terminal-actions.test.ts` (+ component test if supported) | typed-confirm gate (case-insensitive, trimmed) arms Resolve / Void / **Correct**; Close one-click; correct FormData per action (incl. Correct `{marketId, correctedSide, reason}`); typed error copy (incl. `correction_same_outcome`); conditional render by status; **no ungated submit path survives** |
| S3 | `tests/server/admin/moderation/act.test.ts` (**REWRITE** + drive, R1/R3) | Remove→**exactly one** `content_removed` row (`verdict=null`) + masked + **ZERO `comments` writes**; Ban→`user_banned` + `banned_at` (only where NULL) + prior content stays visible; Remove/Ban independently invocable; **zero** positions/bets/ledger writes; admin gate zero-write reject; `events` untouched / `EVENT_TYPES`=24 |
| S3 | `tests/server/admin/moderation/review-feed-completeness.test.ts` (integration) | every live row returned; `content_removed` absent; banned author's content present; chronological; no market filter; **200-cap + truncation asserted**; DTO carries short-TTL signed URL, never a raw key |
| S4 | `tests/server/admin/audit-search.test.ts::query-by-date-action-market-user` (canonical spec path, A3) | each of five predicates narrows across **both** `admin_events` + `mod_actions`; leak-guard intact |

Invariant-class assertions re-affirmed (not new invariants): INV-1/2/3 untouched by moderation; INV-4 lock-in on Resolve (inherited); `EVENT_TYPES` stays 24.

---

## 8 · Reviewer cascade (§5.11) + gates

`@test-writer` (Phase 2 start on S2 + S3 — failing tests first) → build slice → **`@code-reviewer`** (every slice touching `src/server/` or `src/app/(admin)/`) → **`@security-auditor`** (S2 + S3 — the critical-path gates). **On S3, `@security-auditor` MUST specifically review (named items): (i) the image-URL mint path (A1 — short-TTL, admin-gated, no raw key/participant-path/durable URL), and (ii) the admin-privilege boundary (every reader/action re-validates a real `admin_sessions` row).** `@db-migration-reviewer` is **not** invoked — **no DDL** (a slice trying to add DDL is STOP trigger #1, not a reviewer call).

**Pass `@docs/plans/UI-6.md` to every subagent** (they start from zero context).

**HARD STOP AT OPEN PR:** the execute session runs the §9 gate, opens ONE PR for UI.6, and **STOPS** — it does **not** self-merge. The founder ratifies the single final merge. If `@security-auditor` blocks, fix in-scope or STOP (#11).

---

## 9 · Verification gate — the SIX results recorded in the PR body

Run per slice + pre-PR; record these **six** in the PR body:
1. `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build) — PASS.
2. `pnpm test:invariants` — PASS.
3. `pnpm test:integration` — PASS (incl. `review-feed-completeness`).
4. Full-suite `pnpm vitest run` — PASS (incl. the **REWRITTEN** `act.test.ts` + all new tests).
5. `EVENT_TYPES` count = **24** (no new event type) — grep-verified.
6. **No DDL / no migration:** `git diff main -- drizzle/migrations src/db/schema` is EMPTY.

Run critical-path suites **directly** (`pnpm vitest run …`) against local PG `:54322` so `DATABASE_URL` defaults local (never via `just`, which hits the cloud DB in `.env.local`). Do not pipe gate output to `tail`. Pre-PR: the §5.10 self-audit (assert "no DDL"; every handler vs the plan's API surface; the INV assertions — S3 zero ledger/position writes, S2 INV-4 lock-in inherited).

---

## 10 · NOT doing (scope fence)

- ❌ `(public)/layout.tsx`, participant header/nav, any participant surface.
- ❌ `/admin/markets/new`, F-ADMIN-1 / F-ADMIN-2 routes, `markets/media/*` (functional + unstyled; required September — not removed or restyled).
- ❌ Dry-run consequence preview (struck to optional/deferred).
- ~~F-RESOLVE-2 correction surface (not in v1)~~ — **REVERSED by R4:** `runCorrect` is RETAINED and gets the typed hard confirm (§2.S2). Not rebuilt — the built `correctResolutionAction` + the existing form stay; S2 only adds the typed gate.
- ❌ Any DDL, migration, or new event type.
- ❌ Any Dharma/position/ledger write from moderation (ADR-0021).
- ❌ Bulk-action / multi-select moderation (one comment, one decision, one row).
- ❌ Market filter or ranking on the review feed (ADR-0021).
- ❌ A websocket (the needs-resolution "live" counter is `force-dynamic` + 60s poll, D-1).
- ❌ Admin `users` row / any participant-shaped admin path (admin has no `users` row).
- ❌ **The three DEBATE.7-deferred F-ADMIN-4 pieces** (Track-A rows; the LD-3 child-safety carve-out ban-review surface; the inline participant-view Remove/Ban). **UI.6 does not complete F-ADMIN-4.**
- ❌ Self-merging the UI.6 PR (HARD STOP at open; founder merges).

---

## 11 · Self-critique (ranked)

1. **F-ADMIN-4 is bigger than "wire a built action" — and UI.6 only partially delivers it.** The Remove/Ban backend, the live-feed reader, and the image mint are new critical-path code; Track-A / carve-out / inline are explicitly deferred (A2). *Mitigated:* schema supports the built part with no DDL (§0.2); the reader reuses the `content_removed` masking predicate + `signRead`; the **rewritten** `act.test.ts` SPECIFIES the R2/R3 contract (not the impl); `@security-auditor` mandatory incl. the image path; every risk has a STOP trigger; deferrals are named + docketed to DEBATE.7 in plan + PR.
2. **Image-URL mint is a leak surface.** *Mitigated:* short-TTL `signRead` reuse only, admin-gated, no raw key; named `@security-auditor` item; STOP trigger #15 on any infra/policy/leak-guard change.
3. **"Every live row" is easy to get subtly wrong.** *Mitigated:* completeness integration test + the visible, tested 200-cap-with-load-older + STOP trigger #6.
4. **F-ADMIN-5 two-table union (A3) could be awkward.** *Mitigated:* canonical test path pins behaviour; STOP trigger #16 if the union is unsane.
5. **Typed-confirm case-insensitivity** is a deliberate UX softening of the hard confirm. *Accepted:* web-ratified (D-2); the friction is the typed-question requirement itself.

---

## 12 · Execute preconditions (prompt 2 Stage B, fresh session)

`/clear` → fresh chat against `@docs/plans/UI-6.md` (amended) → `/model opus`, `/effort max` → `ultrathink` first word. Gated plan→execute. **NEVER ultracode** on S2/S3. Reviewer cascade §8 (S3 image-mint a named `@security-auditor` item). `@docs/plans/UI-6.md` passed to every subagent. **HARD STOP at the open PR.** PR body records: the six §9 verification results, the **`act.test.ts` rewrite + why (ADR-0021/0020 supersession, R1)**, the **dropped `remove_and_ban` (R2)**, the **`runCorrect` typed-confirm addition (R4)**, the three named DEBATE.7 gaps (§2.S3 A2), "UI.6 does not complete F-ADMIN-4," and the same-commit SPEC.1 §15 F-ADMIN-4 rider (D-3/§6).
