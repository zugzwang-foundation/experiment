# SHELL-COMPLETE — build plan

> **r3** — folds RECON-4 (SPEC.1's live footer commitment · BALANCE's spec-level corroboration · the Q6 label settled from the live repo). Supersedes r2 and r1; neither was committed.

| | |
|---|---|
| **Status** | Authored (web) · **awaiting operator ratification** · execute from a fresh chat off the committed file |
| **Ritual class** | Gated plan → ratify → fresh-chat execute → **Gate C before merge**. `@code-reviewer` required. **No `@security-auditor`** — not a CLAUDE.md §1 critical path (auth · bet engine · ledger · commentary/moderation); the one server read added is a display-grade read of an existing indexed row, no write, no engine contact |
| **Items** | **B4** AGPL source link · **B8** freeze banner · **B10** not-found + global-error · **BALANCE** signed-in Đ cluster |
| **PR** | One. Four slices, independently green |
| **Hard gate** | **Slice 4 (B8) does not execute until the SPEC.1 §21.7 rider is merged.** Slices 1–3 are unblocked |
| **Plan branch** | `chore/shell-complete-plan` · **only this file staged** (F3 staging law) |

---

## §0 · Scope guards

These are the fences. A violation is a plan deviation to surface, not absorb.

| # | Guard |
|---|---|
| **SG1** | **No field is added to any read model.** `DebateViewModel`, `ViewerMarketContext`, `MarketSummary`, `ProfileTiles` are untouched. |
| **SG2** | **Exactly one new file under `src/server/**`** — `src/server/dharma/header-balance.ts`. **Zero edits to any existing file under `src/server/**`.** Named explicitly: `persist.ts`, `tiles.ts`, `viewer-context.ts`, `is-frozen.ts`, `config/limits.ts` are read-only to this task. |
| **SG3** | **Zero DDL.** No migration, no schema change, no new event type. Migration head stays `0024_bookmarks.sql`. |
| **SG4** | **Zero edits to `src/components/debate/**`.** In particular `composer/copy.ts` is imported and never modified — it is a Gate-C-ratified verbatim copy surface. |
| **SG5** | **No new dependency.** `package.json` and the lockfile stay clean. |
| **SG6** | **No spec or ADR edit in this PR.** The §21.7 rider is its own ratified task with its own commit. |
| **SG7** | **The footer content fence — allow-list, not a count.** Permitted: the repo URL · the SPDX licence identifier · the copyright line · **the whitepaper link** (SPEC.1 §21.6 tail — a live commitment, see Q1b). **Forbidden absolutely:** ToS links, Privacy links, legal prose, cookie notices, navigation. Those are `LEGAL.1` / `UI.10` and admitting any one of them voids the B4 gate ruling. Mechanically enforced by test T3. |
| **SG8** | **§21.1 anti-conflation (HARD).** The header's hairline divider (`GlobalHeader.tsx:52`) is the register boundary. Every engine-derived figure stays **left** of it; `VisitorCounter` remains the sole element to its right. Mechanically enforced by test T4. |
| **SG9** | **Every one of the 7 new files opens with `// SPDX-License-Identifier: AGPL-3.0-or-later`.** ADR-0001:60–61 binds files "going forward"; these are going-forward files. Verified at Gate C — seven first lines, trivially visible in the diff. |

---

## §1 · Ground (verified 2026-08-01, RECON 1–4)

| Check | Value |
|---|---|
| `origin/main` | `4d79e80` (#280) |
| `origin/staging` | `4d79e80` — **level** (fast-forwarded this session; `/api/health` canary matches, `migrations: ok`) |
| Migration head | `drizzle/migrations/0024_bookmarks.sql` → next free `0025` |
| ADR ceiling | `0034` → next free **`0035`** |
| SPEC.1 | **1.0.25** (2026-07-31) |
| Layouts | three: `app/layout.tsx` · `(public)/layout.tsx` · `(auth)/layout.tsx`. **No `(admin)` layout at any depth** |
| `not-found` / `global-error` | absent repo-wide (`find src -iname` → empty, both) |
| Footer | **none built.** `src/components/shell/` is 8 files, all header-side. **But SPEC.1 commits to one** — see §2 B4 |
| Profile Wallet tile label | **`Wallet value`** (`ProfileTiles.tsx:25`) — not `Balance`. Settles the Q6 label |

**`notFound()` inventory — 8 calls across 7 sites:**

| Category | Calls | Sites |
|---|---|---|
| Participant pages | **3** | `u/[pseudonym]/page.tsx:52,56` · `m/[slug]/page.tsx:46` |
| Route handlers | **3** | `m/[slug]/quote/route.ts:95,104` · `m/[slug]/export/route.ts:39` |
| Admin | **2** | `admin/markets/[marketId]/page.tsx:33` · `server/admin/page-guards.ts:32` |

**Known doc drift, noted once, not this task's to fix:** AGENTS.md §6 states migration head `0023` (actual `0024`); CLAUDE.md cites SPEC.1 `1.0.15` (actual `1.0.25`); the deploy runbook's `vercel --scope` value is wrong — the real team slug is `zugzwang-worlds-projects`; SPEC.1 §21's preamble still claims §21 sits "at the document tail," which §22 Discovery has made false *(folded into the §21.7 rider, not here)*.

**SPDX scope.** ADR-0001:60–61 reads *"Source files going forward carry the SPDX header … no retroactive sweep on existing files."* Zero SPDX tags in `src/` is therefore **not a violation** for existing files — a sweep is **optional cleanup, docketed, not debt.** **But the clause binds this plan's 7 new files** — see SG9.

---

## §2 · Gate basis — why each item may be built

| Item | Basis | Verdict |
|---|---|---|
| **B4** | **ADR-0001** (tier-1, accepted) — the licence is what requires the affordance. **Plus SPEC.1's live footer commitment** (line 1349 and the §21.6 tail at line 1541: *the whitepaper link remains in the footer*; retained explicitly through the §21.6 descope per the 1.0.10 change-log row). **The footer is a specified-but-unbuilt surface, not a new mint** | **Clears** as a source *link*. A compliance *offer* (asserting a §13 posture) remains `LEGAL.1`'s and is not built |
| **B8** | **None.** SPEC.1 §21 is a closed list of six subsections, none of them a banner. SPEC.2 §20 explicitly disclaims the post-freeze UX as "UI.* territory." W2.11 P4 is tier-2 design | **HALTS** → **SPEC.1 §21.7 rider required before slice 4.** The rider is small: the *copy is already ratified and shipped* (`composer/copy.ts:126–129`, wired `endpoint.ts:201` → `state-map.ts:50` → `p6_concluded`). The rider gives that copy a second, visitor-reachable **home**; it does not design new copy |
| **B10** | **ADR-0023** — "Unknown or `Draft` slug → `notFound()`" is ratified and shipped; only the presentation is stock. Plus design-language §4.10 | **Clears**, content-fenced. W2.11's P1–P6 kit contains no 404 primitive, so this is presentation of ratified behaviour, not new product surface. **If it grows content — search, suggestions, a report link, any copy asserting product behaviour — it becomes a feature and halts** |
| **BALANCE** | **UI.A1 OQ-2 DEFER** — "Đ Portfolio/Balance = A2/A3." A2/A3 were composer tasks; A4 explicitly disclaimed it; `IdentityCluster.tsx:13–15` documents its own missing half. **Corroborated at spec level:** SPEC.1 §22 describes the signed-in nav-identity widget as carrying a balance chip | **Clears.** *Precision matters here:* `UI-A4-plan.md` §1a assessed that same §22 line and ruled it **descriptive drift, not an A4 build mandate**. So building it now **discharges a description A4 deliberately deferred — it does not reveal an A4 violation.** The operative authority remains OQ-2; §22 corroborates |

---

## §3 · Ratified decisions

### Q1 — Footer placement · **mint the specified footer**

`SiteFooter` mounts in `(public)/layout.tsx` and `(auth)/layout.tsx`, after `</main>`. Not the header (the W2.4/.5/.14 close-out already flags left-zone density at 1440). Not RULES (does not exist, O1-owned). Content per **SG7**.

**The wrapper needs one class.** `<main className="flex-1">` is already correct and is **not** touched. The wrapper `<div className="flex min-h-full flex-col">` gains **`flex-1`**: `body` has `min-h-full` but `height: auto`, and the wrapper is a flex item at the default `flex: 0 1 auto`, so on a short page it sizes to content and the footer floats mid-viewport. This is reasoned from the CSS, not observed — the shell has never had a footer. **Verify in a browser on `/sign-in` (the shortest page) at execute; it is one class either way.**

### Q1b — The whitepaper link · **in the allow-list, conditional on a target**

SPEC.1 states in two places that the whitepaper link **remains in the footer**, and the 1.0.10 change-log row records it as explicitly retained when §21.6 was descoped. This plan mints the product's first footer. Building it and omitting SPEC.1's one named element would leave the new surface out of compliance the moment it ships — and SPEC outranks a kickoff fence.

**Ruling:** the whitepaper link is **permitted** by SG7 and **ships if a public URL exists**.

- **URL supplied at slice 2** → render it. Label `Whitepaper`.
- **No URL** → **omit and record** in the session log as a named deviation with a tracker row. An omission on the record is acceptable; an unrecorded one is not.

This is not scope creep — it is the difference between minting a compliant footer and minting one that immediately needs a second PR.

> **Flagged once, outside this task:** if the whitepaper has no public home by 2026-09-15, the footer link is the smallest part of the problem. It is the theory artifact for a public experiment whose terminal deliverable is a Nov 6 dataset release at Devcon. Its own row, not this one's.

### Q2 — `not-found.tsx` · **both, differently**

| File | Treatment | Catches |
|---|---|---|
| `src/app/(public)/not-found.tsx` | **Branded.** Inherits `GlobalHeader` + `SiteFooter` from the group layout | the **3** participant page throws |
| `src/app/not-found.tsx` | **Neutral.** **No `GlobalHeader`.** Token-styled, wordmark as plain text, link home | the **2** admin throws, and anything unrouted |

Not a preference — **ADR-0023's Option-2 verdict rejected root-mounted participant chrome precisely because root is shared with `(admin)`**, and recon confirms `(admin)` has no layout at any depth. Root stays neutral.

**Out of scope, named so it isn't read later as an oversight:** the **3** Route Handler `notFound()` calls (`quote/route.ts:95,104`, `export/route.ts:39`) render no layout; `notFound()` there returns a bare 404 response. Not a page concern.

### Q3 — `global-error.tsx` · **root only, self-contained**

It replaces the root layout, so it inherits nothing — including fonts. Next requires it to be `"use client"`.

**The font trap.** `globals.css:154` is `--font-sans: var(--font-geist-sans)`, and `--font-geist-sans` is **not defined in CSS anywhere** — it is injected at runtime by `geistSans.variable` on `<html>` at `layout.tsx:29`. Omit that className and the page renders correctly *coloured* (`:root` supplies ground + ink) but in **Times New Roman**. That is exactly the failure that reads as "the error page isn't ours."

**Must therefore:**
- re-instantiate `Geist` + `Geist_Mono` from `next/font/google` and apply `${geistSans.variable} ${geistMono.variable} h-full antialiased` to `<html>`;
- `<body className="min-h-full flex flex-col">`;
- **`import "./globals.css"` explicitly.** Whether Next 16.2.4 serves the root layout's CSS chunk to `global-error` is not verifiable from source. The explicit import is one line and makes the question moot.
- **import nothing server-bound and nothing that can throw.** It is the last-resort boundary; anything it imports that fails defeats it.

The two existing route boundaries (`bookmarks/error.tsx`, `u/[pseudonym]/error.tsx`) are **untouched**.

### Q4 — Freeze banner trigger · **server-evaluated constant**

**`FreezeBanner` is a server component that compares `Date.now()` to `FREEZE_INSTANT_UTC`. It performs no database read.**

`isFrozen()` (`src/server/system/is-frozen.ts:14`) imports `server-only` and issues a `db.query`; mounting it in both layouts would add a **third layout-level DB read on all seven routes, permanently, to evaluate a boolean that is `false` for the entire pre-launch and live window and flips exactly once.** Wrong trade for an informational chrome strip. `GlobalHeader.tsx:1,37` already establishes the constant-in-a-server-component pattern; `FreezeBanner` reuses it.

**The scheduled-vs-actual gap is accepted and named.** SPEC.2 §20.2 makes the flip dual-path (`pg_cron` Path A, manual `psql` Path B as backstop *because Path A can fail*). A constant-driven banner announces conclusion at 23:59:00 whether or not writes have actually stopped. **Recorded in the rider:** the banner is informational; `endpoint.ts` remains authoritative for write rejection, and its 410 envelope is what a participant attempting to bet actually receives.

**Accepted limitation:** the banner appears on the next server render. An idle tab shows it on next navigation. The header countdown ticking to zero is the live signal at the instant. *(It may also appear automatically on `/m/[slug]` depending on the F-DEBATE-4 poll's refresh mechanism — verify at execute, do not assume.)*

### Q4b — Copy reuse · **import, never duplicate**

`FreezeBanner` imports `STATE_COPY.frozen` from `@/components/debate/composer/copy` and renders `.lead` + `.body`. `copy.ts` carries no `"use client"` directive, and its two-module closure (`@/server/config/limits` — a pure constants leaf with no `server-only`; `../format` — self-documented "Pure; client-safe") is server-safe. As a **server component**, the strings arrive as rendered markup and nothing enters the browser bundle.

**Why server matters beyond convenience:** `package.json` has no `sideEffects` field, and `format.ts:19` executes `Decimal.clone({ precision: 50 })` at module top level. A `"use client"` banner importing `copy.ts` would likely pull `decimal.js` into the shell chunk, which loads on all seven routes including `(auth)`. The server-component shape sidesteps the question entirely.

**No extraction from `copy.ts` is performed** (SG4).

### Q5 — Banner scope + dismissibility

**Scope:** `(public)` + `(auth)` layouts — the 7 participant routes. **Not admin.** **Dismissibility: none** — W2.11 P4 is a "persistent chrome strip, non-blocking," and a terminal state that can be dismissed implies it might stop being true. **Placement:** first child of the layout wrapper, above `<GlobalHeader/>`, clear of the header grid and §21.1 geometry.

### Q6 — The Đ cluster · **spendable-today, labelled `Balance`**

**The value is `computeSpendableToday`, not the raw ledger balance.**

`loadProfileTiles` returns raw `balance_after` (`tiles.ts:48–58`); `computeSpendableToday` returns balance + `DAILY_CREDIT_DHARMA` on an unclaimed day (`viewer-context.ts:85–89`, `limits.ts:130`). `users.last_allowance_accrued_at` is nullable with no default, so a fresh fixture is always unpaid and the two differ by exactly Đ 10.

**Spendable is the correct number, and the harm forces the choice.** With the Đ 50 reply floor, a participant holding Đ 45 raw who has not yet bet today can spend Đ 55 — they are **not** dead-ended. A raw-balance header would tell them they are. A header that *understates* capacity causes inaction, which is precisely the floor-above-balance dead-end W2.11 carried forward. Raw balance also creates the worse inversion: the composer accepts a bet larger than the header implies.

**This is not a divergence from the design lock — it is the lock.** The W2.4/.5/.14 close-out defines the cluster as *"**Portfolio** (open-position value) + **Balance** (spendable)."* `Balance` is the label; *spendable* is its ratified gloss.

**Label: `Balance`. Settled, no conditional.** The profile tile reads **`Wallet value`** (`ProfileTiles.tsx:25`), so there is no verbal collision. The locked copy register stands unchanged.

**Accepted cross-surface property — stated, not discovered.** The profile `Wallet value` tile renders the raw ledger balance (`ProfileTiles.tsx:26`); the header renders spendable-today. **The same user at the same instant sees Đ N on their profile and Đ N+10 in the header on any unclaimed day.** Both are true; they measure different things — ledger state versus committable capacity, the same relation as a bank balance versus available credit. The distinct labels carry the distinction. **No reconciliation is attempted here**, and no explanatory affordance is added (Đ-info doorways are a ratified UI.A1 omission).

**The Portfolio slot renders nothing** — no placeholder, no dash. A `Portfolio —` with no value is worse than absence.

**Scope: `(public)` only.** `(auth)` does not fetch or render it — `/sign-in` and `/sign-in/otp` are signed-out by definition, and a mid-signup `/onboarding` user may have no `dharma_ledger` row. Skipping it there also avoids a read on every OTP page load. `header-balance.ts` returns `null` when no ledger row exists; `BalanceCluster` renders nothing on `null`.

**Read method — replicate the select, not a transaction.** `readBalance` (`persist.ts:49`, aliasing `readLatestBalance` at `:28`) takes `DbTransaction` deliberately — `persist.ts:53` notes it is a "compile-error to pass top-level `db`," guarding read-then-append atomicity. Two options existed:

1. wrap in `client.transaction(...)` — zero duplication, but spends a `BEGIN`/`COMMIT` on every request of every layout-bearing route to read one indexed row;
2. replicate the six-line select, the **exact `tiles.ts:48–53` shape**, whose own comment (`tiles.ts:46–47`) states the rationale: *"`readBalance` authority, replicated to stay a pure non-transactional read here."*

**Take (2).** The invariant ADR-0029 protects is the `ORDER BY seq DESC LIMIT 1` total order, not function identity, and the codebase has already ruled this exact duplication acceptable for exactly this case. **Do not widen `readBalance` to `DbClient`** — that erodes the `persist.ts:53` compile-time guard for every caller. Mitigated by **T5a**, which pins the sub-read — the only layer where ADR-0029 drift can appear.

**Two statements, not one.** `computeSpendableToday` (`viewer-context.ts:80`) is a standalone pure function taking `{ balance, cursor, now }` — not coupled to market scope — and imports cleanly; it is a **shared import, never copied**. It needs `users.lastAllowanceAccruedAt` and the **DB clock**, fetched in one select per `viewer-context.ts:118–124`. **The `.mapWith(users.lastAllowanceAccruedAt)` on the `now()` fragment is load-bearing** — `viewer-context.ts:97–98` flags it; a bare `sql` fragment has no runtime `Date` decoder. Copy the `.mapWith()`.

### Q6b — The header seam · **a separate prop**

**`HeaderViewer` is not widened.** `GlobalHeader` gains an independent `spendable: string | null` prop.

Three reasons: the Đ cluster is a **sibling** of `IdentityCluster`, not a child (per Q6c); `HeaderViewer` is `IdentityCluster`'s own exported type and should not carry data that component doesn't render; and it removes any chance of confusion with the collision below.

> ⚠ **Name collision — do not edit the wrong file.** `(public)/m/[slug]/page.tsx:90` passes `viewer={viewer}`, but that is **`ViewerMarketContext`** (`DebateView.tsx:66`), an unrelated type carrying position + balance + spendableToday + bookmark ids. **It is not `HeaderViewer` and must not be touched.** A grep for `viewer=` returns three hits; only the two in the layouts are in scope.

**Accepted, not discovered:** on `/m/[slug]` the balance is read **twice per request** — once in the layout, once inside `loadViewerMarketContext` in the page. `m/[slug]/page.tsx:53` already documents the cause ("layouts cannot pass data to pages"). Both are single-row indexed lookups. Not optimised here.

### Q6c — Placement · **left of the divider, before the identity chip**

Current right zone: `IdentityCluster` → hairline divider (`GlobalHeader.tsx:52`) → `VisitorCounter`. That divider is **not decoration** — it is the register boundary. `VisitorCounter.tsx:10–11` states the counter "reads nothing from the ledger / engine"; `:22` calls the muted register and eye glyph "load-bearing anti-conflation, not styling."

The spendable figure is **ledger-derived**. Placing it right of the divider would put a real Đ figure and a vanity page-hit count in the same visual bucket — precisely the conflation §21.1 forbids, and the failure would be **silent**.

**Insert between `GlobalHeader.tsx:51` and `:52`.** Final order: `[BalanceCluster] [IdentityCluster] │ [VisitorCounter]`.

Cluster-before-chip matches the locked mockup — the W2.4/.5/.14 close-out fixes the signed-in right zone as `Đ + Portfolio + Balance` cluster · identity · ‖ · visitors — and preserves the existing ink→muted gradient. **The divider must stay exactly where it is in DOM order;** an element appended carelessly after `IdentityCluster` lands on the wrong side and is invisible to every existing test. **T4 exists for this.**

---

## §4 · File-by-file

### New — 7 files · every one opens with the SPDX header (SG9)

| Path | Kind | Contents |
|---|---|---|
| `src/components/shell/SiteFooter.tsx` | server | Repo URL · `AGPL-3.0-or-later` · `© The Zugzwang Authors` · whitepaper link per Q1b. Muted register, hairline top border, header band vocabulary. **SG7 allow-list.** |
| `src/components/shell/FreezeBanner.tsx` | server | Compares `Date.now()` to `FREEZE_INSTANT_UTC` (imported from `@/server/markets/create`, the `GlobalHeader:1` pattern). Before → `null`. After → `STATE_COPY.frozen.lead` + `.body`. **No DB read.** `role="status"`. |
| `src/components/shell/BalanceCluster.tsx` | server | `Đ` glyph + `Balance` label + value, tabular figures. Renders `null` when `spendable === null`. |
| `src/server/dharma/header-balance.ts` | server | **One export.** `(client: DbClient, userId: string) => Promise<string \| null>`. Two statements: the `tiles.ts:48–53` ledger select; the `viewer-context.ts:118–124` users+`now()` select **with `.mapWith()`**. Composes via imported `computeSpendableToday`. Returns `null` on no ledger row. |
| `src/app/(public)/not-found.tsx` | server | Branded 404. Inherits header + footer. Copy per §5. |
| `src/app/not-found.tsx` | server | Neutral 404. **No `GlobalHeader`.** Wordmark as plain text, link home. |
| `src/app/global-error.tsx` | **client** | Own `<html>`/`<body>`, re-instantiated fonts, explicit `import "./globals.css"`. No server import. `reset()` affordance. |

### Edited — 3 files

| Path | Edit |
|---|---|
| `src/app/(public)/layout.tsx` | `flex-1` on the wrapper `<div>` (`:29`) · `<FreezeBanner/>` between `:29` and `:30` · `<SiteFooter/>` between `:31` and `:32` · `await getHeaderBalance(...)` when `session` is non-null · `spendable` passed to `<GlobalHeader/>` |
| `src/app/(auth)/layout.tsx` | `flex-1` on the wrapper (`:33`) · `<FreezeBanner/>` between `:33` and `:34` · `<SiteFooter/>` between `:42` and `:43`. **No balance fetch, no `spendable` prop.** |
| `src/components/shell/GlobalHeader.tsx` | Accept `spendable: string \| null` · render `<BalanceCluster/>` **between `:51` and `:52`** |

### Explicitly untouched

`IdentityCluster.tsx` (`HeaderViewer` unchanged) · `VisitorCounter.tsx` · the divider at `GlobalHeader.tsx:52` · `<main>` classNames in both layouts · `composer/copy.ts` · `profile/tiles.ts` · `profile/ProfileTiles.tsx` · `dharma/persist.ts` · `debate-view/viewer-context.ts` · `system/is-frozen.ts` · `config/limits.ts` · `bookmarks/error.tsx` · `u/[pseudonym]/error.tsx` · `m/[slug]/page.tsx` · `src/app/layout.tsx`.

---

## §5 · Copy — web-authored, no invention at execute

| Surface | String |
|---|---|
| Footer — source | `Source: github.com/zugzwang-foundation/experiment` |
| Footer — licence | `AGPL-3.0-or-later` |
| Footer — copyright | `© 2026 The Zugzwang Authors` |
| Footer — whitepaper | `Whitepaper` → **operator-supplied URL**. Per Q1b: no URL → omit and record |
| Freeze banner | **Imported, never written.** `STATE_COPY.frozen.lead` + `STATE_COPY.frozen.body` |
| `(public)` 404 — head | `Not found.` |
| `(public)` 404 — body | `This page doesn't exist, or the market isn't public yet.` |
| `(public)` 404 — action | `Back to markets` → `/` |
| Root 404 — head | `Not found.` |
| Root 404 — action | `Go to Zugzwang` → `/` |
| `global-error` — head | `Something broke.` |
| `global-error` — body | `An unexpected error stopped the page from loading.` |
| `global-error` — action | `Try again` (calls `reset()`) |
| Đ cluster label | `Balance` (value rendered `Đ N`) |

**No copy beyond this table.** Anything else is invention and halts (B10's content fence).

---

## §6 · Slices

Each independently green. Slice order is load-bearing: **S2 changes the wrapper class that S4 mounts against.**

| # | Slice | Contents | Gate |
|---|---|---|---|
| **S1** | **B10** | `(public)/not-found.tsx` · `app/not-found.tsx` · `app/global-error.tsx` + T1, T2 | none |
| **S2** | **B4** | `SiteFooter.tsx` · both layout mounts · wrapper `flex-1` + T3 + the browser bottom-stick check on `/sign-in`. **Whitepaper URL or a recorded omission** (Q1b) | none |
| **S3** | **BALANCE** | `header-balance.ts` · `BalanceCluster.tsx` · `GlobalHeader` prop · `(public)` layout wiring + T4, T5a, T5b, T6 | none |
| **S4** | **B8** | `FreezeBanner.tsx` · both layout mounts + T7 | ⛔ **BLOCKS on SPEC.1 §21.7 rider merged.** Verify on the live repo at slice start — do not take it on trust |

**If the rider has not landed when S1–S3 are green: ship S1–S3, open the PR, and carry S4 to a follow-up.** Do not stall three merged-ready slices on one spec commit.

---

## §7 · Tests

| # | Test | Asserts |
|---|---|---|
| **T1** | `not-found` render | `(public)` variant renders header **and** footer; **root variant renders no `GlobalHeader`** — the ADR-0023 Option-2 regression guard |
| **T2** | `global-error` render | Renders own `<html>`/`<body>`; **`<html>` className contains both font variables**; imports nothing from `src/server/**` |
| **T3** | **Footer allow-list (SG7)** | Renders the repo URL + SPDX id + copyright; **asserts zero occurrences of `terms`, `privacy`, `policy`, `tos`** in the rendered output. The whitepaper link is permitted and not asserted either way (Q1b makes it conditional) |
| **T4** | **§21.1 DOM order (SG8)** | In the header right zone: `BalanceCluster` precedes the divider; `VisitorCounter` follows it. Catches the invisible regression |
| **T5a** | **Ledger sub-read parity** | The **raw ledger read inside `header-balance.ts`** equals `loadProfileTiles`'s wallet value for the same fixture user. Pins the *duplicated select* — the only layer where ADR-0029 drift can appear |
| **T5b** | **Composition** | `getHeaderBalance` equals `computeSpendableToday(raw, cursor, now)` across three cases: **null cursor** · **cursor on a prior UTC day** (both → raw + `DAILY_CREDIT_DHARMA`) · **cursor today** (→ raw). `computeSpendableToday` is imported, never re-implemented |
| **T6** | Null path | A user with zero `dharma_ledger` rows → `null` → `BalanceCluster` renders nothing |
| **T7** | Freeze banner | Renders `null` before the instant; after, renders **exactly** `STATE_COPY.frozen.lead`/`.body` — **imported in the test, no string literals** |
| **T8** | *(manual)* Footer bottom-stick | Browser check on `/sign-in`. Named because it cannot be asserted in jsdom |

Existing suites pass **untouched** — no test moved, no snapshot rebaselined. `tokens-monochrome.test.ts` and the no-raw-hex guard stay green.

---

## §8 · Not doing

**Portfolio** (forked → `HEADER-PORTFOLIO`: N+1 reads, `loadProfilePositions` spine, FI-2 basis law) · the SPDX sweep over existing files (**optional** per ADR-0001's no-retroactive-sweep clause; docketed, not debt) · a formal §13 compliance offer (`LEGAL.1`) · ToS/Privacy links (`UI.10`, blocked on `LEGAL.1`) · publishing the whitepaper (own row; this plan only links it if a URL exists) · route-handler 404 bodies · reconciling the profile `Wallet value` tile against the header figure · `(admin)` chrome of any kind · the radio (SPEC-blocked) · Social / Research / RULES (ratified omissions) · responsive anything (G1 — desktop only, 1440) · `cacheComponents` (off; not flipped here) · the `getSession`-twice-per-request duplication (pre-existing, documented at `m/[slug]/page.tsx:53`) · the SPEC.1 §21 "document tail" correction (rides the §21.7 rider) · POLISH.1 inspection · O1 · `MOD-REPORT-PATH` · A11Y.0 · STAGING-PARITY · any spec or ADR edit.

---

## §9 · Risks

| # | Sev | Risk | Mitigation |
|---|---|---|---|
| 1 | **med** | The wrapper `flex-1` is reasoned from CSS, never observed — the shell has never had a footer. A floating footer is an obvious visual defect | **T8**, a browser check on the shortest page. One class either way |
| 2 | **med** | `global-error` renders in the browser default serif if the font className is dropped — correctly coloured, wrong typeface, reads as "not ours" | **T2** asserts both font variables on `<html>`; explicit `globals.css` import removes the build-graph dependency |
| 3 | **med** | Đ cluster lands right of the divider → silent §21.1 conflation, invisible to every existing test | **T4**, and the divider's DOM position is a named untouchable |
| 4 | **med** | The duplicated ledger select drifts from the ADR-0029 total order | **T5a** pins it against `tiles.ts` |
| 5 | **med** | A participant reads Đ N on their profile and Đ N+10 in the header at the same instant | Accepted and stated in Q6 as a cross-surface property; the distinct labels (`Wallet value` / `Balance`) carry the distinction |
| 6 | **low** | The footer ships without the whitepaper link and the omission is never noticed, leaving a specified surface non-compliant | Q1b makes it a **recorded** deviation with a tracker row, never a silent one |
| 7 | **low** | The `now()` fragment without `.mapWith()` has no runtime `Date` decoder — a known trap flagged at `viewer-context.ts:97–98` | Copy the `.mapWith()` verbatim; **T5b**'s cursor cases exercise it |
| 8 | **low** | A grep for `viewer=` catches `m/[slug]/page.tsx:90`, a different type with the same prop name | Pinned in Q6b; only the two layout hits are in scope |
| 9 | **low** | Slice 4 executes against an unmerged rider | S4's gate is verified **on the live repo** at slice start, not from this plan |
| 10 | **low** | Banner announces conclusion before the actual freeze flip if `pg_cron` Path A fails | Accepted, recorded in the rider. `endpoint.ts` stays authoritative |

---

## §10 · Ratification

| Field | Value |
|---|---|
| Q1–Q6 | Operator-ratified 2026-08-01; revised against RECON 2 (Q4 / Q6b / Q6c), RECON 3 (Q6 semantic, T5 split, `notFound()` counts, SPDX scope), **RECON 4 (Q1b whitepaper link, BALANCE spec corroboration, Q6 label settled)** |
| Gate rulings | B4 as source link · B8 halts pending rider · B10 clears content-fenced · spendable in, Portfolio forks |
| Execute | **A different fresh chat**, working from this committed file |
| Reviewer | `@code-reviewer` · **Gate C web diff-read before merge** |
