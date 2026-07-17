# UI.A2 — Composer substrate (backend): BET_MAX_STAKE clamp · quote reads · viewer-session context · deep-link post param

> **Status:** reviewed — Round 3 final web review PASSED 2026-07-17; executing flips at Phase 2 · v2 arc: all 5 interview OQs ratified + web fold-ins FI-1..FI-5 processed, FI-3 resolved at Round 3 (web withdrew; live append-newest-last shape ratified)
> **Date:** 2026-07-17
> **Author:** Hrishikesh + Claude Code (Phase 1 tab, Fable 5)
> **Critical-path?** **YES — bet engine** (`src/server/bets/` + `src/server/config/` on the place path) per UI-LANE §2 A2. Full ritual: plan-then-execute · writer/reviewer (test-writer REDs first) · Gate C (web pre-merge diff-read: PR → web reads the actual diff → operator squash-merges) · §5.10 pre-PR self-audit · `@code-reviewer` AND `@security-auditor` (sequential, directed scope) · **NEVER ultracode**. Per-invariant failure-mode narratives carried in §1 (no A1-style waiver).
> **Plan PR / commit:** branch `docs/ui-a2-plan`; PR number + squash SHA recorded in `docs/logs/UI-A2.md` at merge (F3: only this file staged)

---

## Tracker context

UI-LANE.md §2 row A2 (BINDING scope, verbatim):

> | A2 | Composer substrate (backend) | `BET_MAX_STAKE` clamp (config + place path; buy/add only — sell never clamped) · quote read for To-win + sell-proceeds preview · viewer-session context (held position + balance) into the market view model · deep-link post param on `/m/[slug]` | CRITICAL PATH (bet engine): plan-then-execute · writer/reviewer · Gate C · NEVER ultracode | SPEC.1 §7 (1.0.15, F-BET-9) · cpmm 2.1.0 · ADR-0031/0015/0018 |

The UI-LANE §1 recon gap this row closes (verbatim): *"Write path server-complete for place/sell EXCEPT: `BET_MAX_STAKE` unimplemented (SPEC.1 1.0.15 / F-BET-9 clamp), no quote/To-win read, viewer-session context not exposed to view models, no deep-link post param."*

Window note (UI-LANE §2): A1–A3 targeted inside the Fable-5 window (through ~Jul 19 2026); **no gate flexes for the window**.

Dependency status at plan time (ground = `main` @ `6447280`, == origin/main, tree clean; ADR ceiling verified **0031** via `ls docs/adr/`; migration head verified **0023**):

- **A1 Foundation** — merged (#232 `096f9aa`) + close-out log landed (#233 `6447280`). Branded shell live; DebateView is the single client boundary.
- **SPEC.1 1.0.15** — F-BET-9 slippage warning RETIRED; §7 preamble carries the clamp rider ("Buy/add stake is clamped to `BET_MAX_STAKE` (§16.1); sell is never clamped"); §16.1 carries the `BET_MAX_STAKE` row — semantics pinned, **value TBD at number-tuning (~2026-09-01)**. The 1.0.15 changelog: "Doc-only; no code (buy composer unbuilt)" — **A2 is the code arriving under a spec already current**.
- **cpmm.md 2.1.0** — §6.1 impact := |p1 − p0| · §6.3 preview semantics (read-only, ADVISORY; authoritative recompute inside W-1 under the pool lock; no slippage-tolerance abort by design) · §6.4 preview consumable `{ side, S | s, shares_or_proceeds, p0, p1, p_eff, impact }` with "the caller applies the per-bet stake cap (SPEC.1 §16.1) before `computeBuy`, so on a clamped buy these figures reflect the clamped stake" · §13 module API (built: `src/server/cpmm/calculate.ts` — `computeBuy`/`computeSell`/`getPrices`, lowercase `Side`, decimal strings) · 2.1.0 changelog: "**the cap constant itself deliberately lives only in SPEC.1: app-layer guard, the pure functions stay pure**".
- **ADR-0031** — durable `bet_receipts` + terminal error-mapping contract; the place-route replay order (Redis lookup → durable pre-check → rate-limit → moderation → tx with receipt LAST) is live in `src/server/bets/endpoint.ts` + `place/route.ts`.
- **ADR-0015** — §3.1 in-handler sequence, rate-limit surface table (bet endpoints: `bet-ip` per-IP), fail-open rate-limit / fail-closed idempotency; envelope helpers for non-bet routes at `src/server/middleware/envelope.ts` (B7b A29).
- **ADR-0018** — two floors built: `BET_MIN_STAKE_POST`/`BET_MIN_STAKE_REPLY` in `src/server/config/limits.ts` (decimal strings, PLACEHOLDER JSDoc discipline), enforced by `assertStakeFloor` (`src/server/bets/floors.ts`) at the route validation layer — the residence + enforcement precedent `BET_MAX_STAKE` follows.
- **ADR-0019** — Architecture 2: every read server-mediated; tripwire (no client-direct DB path) untouched by this plan.
- **ADR-0016 D6** — raw UUIDs FORBIDDEN on participant-facing URLs incl. shareable links; "comment permalinks reference the comment's natural ordering or a server-rendered short ID, not the raw `comments.id`" — binds the deep-link param (OQ-4).
- **DEBATE.4 view model** — `loadDebateView` (`src/server/debate-view/load-debate-view.ts`) is deliberately **viewer-independent** ("no session param — DEBATE.4 is a public render, C1") and is the removal-masking gate (ADR-0020/0021). `/m/[slug]/page.tsx` composes it; `/m/[slug]/export` is the GET-route sibling precedent.
- **Positions/Dharma reads** — `getHeldPosition` (`src/server/positions/read.ts`, accepts top-level `db`), `readBalance` (`src/server/dharma/persist.ts` re-export of the seq-ordered latest read), `accrueDailyCredit` + `utcDayOf` (`src/server/dharma/accrual.ts`; the place path pays the day's credit BEFORE the F-BET-4 balance check).
- **Values-log §6 build ruling 1** (CONSUMER context only — render is A3): the reply-view position strip — `TO WIN Đ1 → Đx` left (BOTH columns, always — market context) · price cluster centre · `YOUR POSITION Đa → Đb` / `NO ACTIVE POSITION` right · **no Đ BET / Sell buttons on the debate surface** · held-side readout click → Profile (W2.10-C). A2 ships the reads this strip consumes.
- **Settled law — citation correction (FI-1):** W2.10 Option A = design-canon §4 **rulings 2+3** (Option A operator-ratified 2026-06-27; the DC rulings folded/closed 2026-07-02), committed as SPEC.1 1.0.15 / cpmm.md 2.1.0 law at PR #225 (squash `1006030`, verified live) — the §6.4 bundle IS the ruled consumable; A3 only chooses what to render. W2.7 = design-canon §4 **ruling 1** (ratified 2026-07-02, DC.1) — it governs whose figures show on bookmark rows (the bookmarked author's), NOT staked-basis computation. **The one genuinely open economics semantic is the `Đa` staked-basis definition** — founder-owned, ruling owed before A3 renders Đa (Ratification record OQ-3 + Open questions).
- **Not available, by design:** composer UIs + strip render — A3; Profile (where Sell lives) — A5; share affordances (post-JPEG, export button) — Session B.

## Ratification record (round 2, operator-relayed 2026-07-17 — interview answers + web fold-ins; verification greps run live at `6447280` BEFORE folding)

| Item | Ruling |
|---|---|
| OQ-1 | **(b) RATIFIED** — `BET_MAX_STAKE = "10000"` in `src/server/config/limits.ts`, JSDoc PLACEHOLDER → number-tuning (~2026-09-01, HARDEN.5). The coherence test pins value > `BET_MIN_STAKE_REPLY` (`"50"`, verified live at `limits.ts:107`). Economically inert by design; the mechanism's A2 consumer is the test suite. |
| OQ-2 | **(a) RATIFIED** — the full cpmm 2.1.0 §6.4 bundle as drafted (§3.2). Rationale corrected per FI-1: the bundle IS the ruled consumable; A3 only chooses what to render. **Wire shape closed here.** |
| OQ-3 | **(a) DEFERRED + (b) as drafted** — DTO ships `{position:{side,quantity,currentValue}\|null, balance, spendableToday}`, NO `staked` field. The Đa staked-basis (nominal vs net-of-partial-sells, and on what basis — `positions` carries no basis column) is an un-pinned economics semantic: **founder ruling OWED BEFORE A3 renders Đa**; lands as a SPEC.1 line when ruled; the strip degrades to Đb-only until then. Recorded in Open questions as deferred-with-owner (founder), consumed at the A3 plan chat. `spendableToday` keeps the parity integration test binding preview == accrual (shared `utcDayOf` import + cross-file comment). |
| OQ-4 | **(a) RATIFIED, NO ADR** — per-market top-level post ordinal `?post=N`, consuming ADR-0016 D6's named mechanism (recorded in this plan + the PR body; D6 wording grep-verified). Append-only ⇒ ordinals permanent; masked/removed targets keep their slot and fall back gracefully. |
| OQ-5 | **(a) session-gated** quote route (signed-in composer only; strip figures ride the page's own read models — the critique-#1 split holds) · **(b) as drafted** — no rate-limit constant minted, non-Draft advisory math, PLUS a recorded forward-pointer: **HARDEN.2 may bucket this route** into the per-surface rate-limit table later · **(c) IN** — `ordinal` on `DebatePost` (both union variants, additive — SG-3; variants grep-verified at `load-debate-view.ts:84/:92`) + `history.replaceState` on enter/exit; the masking-file touch is additive-only; Gate C reads the diff; `@security-auditor` runs at execute. |
| FI-1 | **Folded — citations to settled law** (corroborated live: design-canon §4 = "The DC rulings (operator-ratified 2026-07-02 · folded, closed)"; W2.7 → ruling 1, W2.10 → rulings 2+3 with Option A ratified 06-27; `git rev-parse 1006030` EXISTS = PR #225 `docs(specs): F-BET-9 reconciliation`). Every "PENDING W2.10/W2.7" framing replaced; OQ-3's open core re-scoped to the Đa-basis gap. |
| FI-2 | **Folded — `currentValue` basis RULED:** Đb = `computeSell(quantity).proceeds`, the impact-inclusive execution value matching §6.3 preview semantics (what a seller actually receives); recorded as a CHOICE (the rejected alternative: mark-to-p1 — a spot-price mark rather than execution proceeds). Inheritance law added (§3.3 + §8 + References): A5 Profile's "Current" column + "Positions value" tile INHERIT this basis — one holding never shows two different current values across surfaces. |
| FI-3 | **HELD — NOT folded (live-repo contradiction; the kickoff's own do-not-silently-reconcile law).** FI-3 asserts SPEC.1 "§0" changelog rows are PREPENDED newest-first, citing the live 1.0.15 row. Live grep at `6447280`: the change log is **§20** (line 1326; §0 = metadata bullets, no table) and runs **OLDEST→NEWEST** — first data row `1.0.0-draft` (line 1330), **final data row = `1.0.15` (line 1357)**; cpmm.md §15 carries the same appended shape (1.0.0 → 2.0.0 → 2.1.0, read live this session). Round-1's "appended newest-LAST" was deliberate, not paste-mangling. Plan text stays pinned to the live-verified shape; **web rules at Round 3.** **RESOLVED Round 3: web WITHDREW FI-3 — live shape (append newest-last) ratified as law; the amendment sheet's "prepend" wording was the sheet's error, reconciled correctly at #225.** |
| FI-4 | **Folded — rider authorship restored to doctrine:** the `?post=` SPEC.1 rider is prescriptive → **WEB-AUTHORED**. At the execute commit point CC PAUSES and requests the rider text from web, applies it VERBATIM in the SAME commit as the governing code (execution BLOCKS until relayed — the A1 ADR-0023-rider pattern); Gate C reads the diff. All "CC-drafted, web-gated" phrasing replaced (§9 slice 5 + ADRs needed). |
| FI-5 | **Folded — §8 addition:** reply-level deep-link addressing (the future W2.13 share-card consumer) = a later additive param on the same D6 ordinal mechanism; explicitly NOT A2. |
| S-1 | **Standing:** critique-#2 web override **DECLINED** — the silent buy/add clamp for direct-API clients IS SPEC.1 §16.1 as ruled; no response-contract amendment. Self-critique row 2 stands as the record. |
| S-2 | **Standing:** critique-#3 **accepted as designed** — the tests are the A2 consumer; the DTO is spec-pinned. |

## Approach (one paragraph)

Four narrow verticals, all substrate, zero composer render. (1) `BET_MAX_STAKE` lands as a decimal-string constant in `src/server/config/limits.ts` (the §16.1 residence precedent) with a `clampStakeToMax` sibling to `assertStakeFloor`, applied at ONE point — the place route's step-5d validation layer, clamp-then-floor, before moderation and the W-1 tx — so `place()`, `transaction.ts`, `sell.ts`, and the sell route take **zero edits** and the clamped stake is uniformly the stake for the balance check, CPMM computation, `bets.stake`, ledger debit, events payload, and receipt. (2) The quote read splits by consumer: the strip's always-on market-context numbers ride the existing view model (one pool read in `market-pricing.ts` now also yields `unitToWin` = `computeBuy(stake:"1")` per side; the viewer's sell-all `currentValue` rides the viewer context), while the composer's interactive preview is a new session-gated `GET /m/[slug]/quote` route returning the cpmm.md §6.4 bundle with the §16.1 clamp surfaced (`clamped`, effective stake) — advisory per §6.3, read-only, no new rate-limit surface. (3) Viewer-session context is a NEW composed read `loadViewerMarketContext` (position + `currentValue` + balance + read-only `spendableToday` accrual preview) invoked by the page RSC beside `loadDebateView` — the masking gate keeps its viewer-independence untouched — and lands as a typed, serialized `viewer` prop on `DebateView` (consumed at A3). (4) The deep-link post param `?post=<N>` uses the per-market post **ordinal** (ADR-0016 D6's "natural ordering"; raw UUIDs stay out of URLs), resolved server-side to a comment id and seeding DebateView's existing `selectedPostId` state; invalid/absent/removed targets fall back silently to the market view. No DDL (head stays 0023), no new dependencies, no globals.css edits, no new wire error codes.

---

## 0. Binding scope guards (plan law)

- **SG-1 — bet-path surgical minimum.** The bet-engine diff is exactly: `src/server/config/limits.ts` (+1 constant), `src/server/bets/floors.ts` (+1 function), `src/app/api/bets/place/route.ts` (step 5d, ~4 lines). **Zero edits** to `place.ts`, `sell.ts`, `transaction.ts`, `endpoint.ts`, `replay.ts`, `errors.ts`, the sell route, `idempotency/**`, `moderation/**`. Any want beyond this → STOP, surface.
- **SG-2 — sell is NEVER clamped.** No clamp code on any sell surface (route, `sell.ts`, quote sell-kind). SPEC.1 §7/§16.1 verbatim. A sell-side clamp appearing anywhere in the diff is a defect by definition.
- **SG-3 — the masking gate stays viewer-independent.** `loadDebateView`'s removal-masking and its no-session contract are untouched; viewer context is a SEPARATE read composed at the page. The only `load-debate-view.ts` edits are additive DTO fields (`unitToWin` on the header via `market-pricing.ts`; the ratified `ordinal` on `DebatePost` — OQ-5c IN) — no masking-logic line moves.
- **SG-4 — no DDL.** Head stays `0023`. Any path wanting a table/column/index (incl. a clamp-config table, a `comments.public_id`, or an ordinal index) = **LOUD STOP** + surface as an open question. `positions` carries no cost-basis column — that stays true (OQ-3's `staked` field, if ever ruled in, derives from `bets` rows at read time; it does NOT mint schema).
- **SG-5 — the cap constant never enters `src/server/cpmm/`.** cpmm.md 2.1.0: app-layer guard; the pure functions stay pure. `computeBuy`/`computeSell`/`getPrices` are consumed, never edited.
- **SG-6 — no composer/render work (A3).** No strip, no composer, no removal of the C1 disabled triggers, no price-pill/thumb grammar, no copy changes. `DebateView.tsx` edits are limited to: the `viewer` prop landing (unconsumed), `initialPostId` state seeding, and the ratified `replaceState` URL sync (OQ-5c IN). `globals.css` + token pin untouched.
- **SG-7 — no new dependencies; no new wire error codes** (the reused 401 session code + `error_invalid_request_body` + 404 cover the quote route; the clamp rejects nothing).

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | **yes** — the place path is edited (route validation layer) | The clamp is a pre-tx, single-point stake transformation at the route boundary; the W-1 SERIALIZABLE tx (`place()` spine) is byte-untouched, so bet+comment atomicity is exactly ENGINE.7/8 + B3's | existing `I-ATOMICITY-001` (untouched, must stay green) + NEW `tests/server/bets/clamp.test.ts::clamped-execution-is-uniform` (see narrative below) |
| 2.2 Dharma non-transferable / no overdraft (INV-2) | **yes** — a balance read is newly exposed to the view layer; the clamp reduces max per-bet spend | Viewer context is **read-only by law** (no ledger append, no accrual write — `spendableToday` is arithmetic over the cursor); no transfer surface exists or is created; the in-tx post-credit balance check + `CHECK (balance_after >= 0)` backstop are untouched | NEW `tests/integration/viewer-context.integration.test.ts::read-only-no-ledger-write` + existing `tests/server/dharma/non-transferable.test.ts` (untouched) + `I-NO-OVERDRAFT-001` (untouched) |
| 2.3 Side frozen at comment-time (INV-3) | **yes — read-only** | Deep-link resolution and viewer-position reads never write comments; `side_at_post_time` is read, never re-keyed; markers stay read-time-computed | existing `I-SIDE-BIND-001` (untouched) + NEW resolver test asserting resolution is a pure read (no comment writes in the A2 diff — grep-verifiable) |
| 2.4 Resolutions append-only (INV-4) | no | No resolution surface is read or written | existing `I-APPEND-ONLY-001` untouched |
| I-IDEM-ONCE (invariant-class) | **yes** — the place path is edited | Body fingerprint stays computed at handler entry over the RAW submitted body (before the clamp); replay/receipt semantics unchanged; the receipt stores the result of the CLAMPED execution — replay returns it verbatim | existing `I-IDEM-ONCE-001` + `place-replay-durable` (untouched) + NEW clamp-replay case in `clamp.test.ts` |
| I-NO-OVERSELL / I-SINGLE-SIDE (invariant-class) | read-only | Sell path untouched (SG-2); reads go through `getHeldPosition` (asserts ≤1 held row) | existing specs untouched + NEW `clamp.test.ts::sell-never-clamped` |

**Per-invariant failure-mode narratives (critical-path law, §5.7 — what ships broken if the assertion is missing or wrong):**

- **INV-1 / conservation (the uniform-clamp narrative).** The corruption scenario is a **non-uniform clamp**: if the clamped stake fed the CPMM computation but the SUBMITTED stake fed the ledger debit (or `bets.stake`, or the balance check) — e.g. a future refactor clamps inside `place()` after the ledger call, or clamps only the `computeBuy` argument — then a Đ10,000 submission against a Đ1,000 cap debits 10,000 from the user while the pool receives 1,000: Đ9,000 evaporates from user↔pool conservation (cpmm INV-C1), silently, per bet. The design forecloses it structurally (ONE clamp point at the route; `place()` receives ONE stake and uses it everywhere), and `clamp.test.ts::clamped-execution-is-uniform` pins it end-to-end: place an over-max bet against a seeded pool and assert `bets.stake == |dharma_ledger.amount| == pool Đ-inflow (Δ(y+n)/2 ≡ stake) == BET_MAX_STAKE == the stake the response's sharesBought implies`. If this test is omitted and the wrong-shaped refactor lands, the money leak ships undetected until the Nov-6 dataset audit.
- **INV-2 (the read-that-writes narrative).** The corruption scenario: `loadViewerMarketContext` implemented by CALLING `accrueDailyCredit` (the tempting reuse) instead of previewing it — every page load by an unpaid-today user would then mint Đ10 of Daily Credit **without a commented bet**, violating ADR-0018's "paid only on placing a commented bet" (attendance becoming issuance — the exact rejected Option-4 failure) and turning a public read surface into a Dharma faucet. `viewer-context.integration.test.ts::read-only-no-ledger-write` pins row-count invariance across the read (ledger + events + users cursor all unchanged); `::spendable-preview-parity` pins the preview arithmetic to `accrueDailyCredit`'s own paid/unpaid behavior (shared `utcDayOf`) so the two can't drift apart silently.
- **INV-3 (the frozen-side narrative).** The corruption scenario is indirect: a deep-link resolver or viewer read that re-derived "the post's side" from the author's CURRENT position (instead of `side_at_post_time`) would render a flipped author's argument under the wrong pole. Everything side-shaped in A2 reads the frozen column via the existing view model; the resolver returns ids only. `I-SIDE-BIND-001` (storage) + the untouched marker tests carry it; the A2 diff adds no comment-side derivation.
- **INV-4.** Untouched surface; no narrative beyond the standing suite.
- **I-IDEM-ONCE (the fingerprint-order narrative).** The corruption scenario: computing the body fingerprint AFTER clamping (i.e. over a normalized body) would make two DIFFERENT over-max submissions under one key fingerprint-identical — the second would replay the first's receipt as a 200 instead of 409ing, silently swallowing a distinct intent. The fingerprint call sits in `endpoint.ts` (untouched, handler entry, raw body); the clamp lives downstream in the route's step 5d. The existing replay suite + a clamp-replay case (same key + same over-max body → original 200; same key + different over-max body → 409) pin it.

## 2. Data model changes

None — read paths + one route-layer constant. **Head stays `0023`** (verified on disk at plan time). No new tables, columns, indexes, enums, or triggers. The deep-link ordinal derives at read time from the existing `comments` rows (append-only ⇒ ordinals are stable); if execution finds the per-market top-level ordinal query wanting a new index, that is a SURFACE-don't-absorb event (SG-4) — expected not to fire at experiment volumes (the debate view already loads all of a market's comments per render, D11).

## 3. API surface

**3.1 `POST /api/bets/place` — modified (clamp), wire shape unchanged.**

Step 5d in `src/app/api/bets/place/route.ts` becomes clamp-then-floor:

```ts
// 5d. BET_MAX_STAKE clamp (SPEC.1 §16.1 / F-BET-9, buy/add only) THEN the
// stake floor on the CLAMPED value — so a misconfigured max < floor rejects
// loudly (below_*_floor) instead of executing below floor.
const effectiveStake = clampStakeToMax(stake);
assertStakeFloor({ parentCommentId, stake: effectiveStake });
```

…and `place()` receives `stake: effectiveStake`. Semantics (SPEC.1 §16.1, binding): stake **strictly above** `BET_MAX_STAKE` is clamped to it before the CPMM computation; `stake ≤ max` passes through **byte-identical** (no re-quantization — conforming clients see zero behavior change). Clamp ≠ reject: no new error code, no wire-shape change; `PlaceResult` unchanged; the executed (clamped) stake is what `bets.stake`, the ledger debit, the events payload, and the receipt record. The submitted-but-clamped intent is deliberately unrecorded (equivalent to having submitted the max) — the pre-submit surface for clamping is the preview (§16.1: "the clamped result is surfaced in the non-blocking preview"), and the A3 composer additionally clamps input client-side (W2.10 clamp UX, that row's scope). Applies to posts AND replies (a reply is a buy). Sell route: untouched (SG-2).

New in `src/server/bets/floors.ts`: `clampStakeToMax(stake: string): string` — exact `CpmmDecimal` compare, returns the original string when `≤ BET_MAX_STAKE`, else the constant. New in `src/server/config/limits.ts`: `BET_MAX_STAKE = "10000"` (**ratified OQ-1** — 10× the initial grant, economically inert by design, the mechanism's A2 consumer is the test suite; decimal string; PLACEHOLDER JSDoc naming SPEC.1 §16.1 + number-tuning ~2026-09-01, HARDEN.5, as the value owner).

**3.2 `GET /m/[slug]/quote` — NEW route** (`src/app/(public)/m/[slug]/quote/route.ts`, the `/m/[slug]/export` sibling shape: slug-resolved, `force-dynamic`, `Cache-Control: no-store`).

- **Auth:** session required (**ratified**, OQ-5a) — the quote is act-surface substrate (its only consumer is the signed-in composer), not public content. 401 envelope on no session — REUSE the existing session-required envelope code (exact string verified at execute against the established session-gated surfaces; minting a new code violates SG-7).
- **Query (zod):** `side` ∈ `YES|NO`; exactly one of `stake` (buy quote) / `shares` (sell quote), each a `numericString` > 0. Violation → 400 `error_invalid_request_body`.
- **Resolution:** `getMarketBySlug` (Draft-excluded) → 404 `notFound()` on unknown slug; pool row read → the §6.4 computation. No market-state gate (**ratified**, OQ-5b): the preview is advisory pure math (cpmm §6.3); the write path is the enforcement layer; the A3 composer doesn't render actionable UI on non-Open markets.
- **Response** `{ ok: true, data: QuoteDTO }` via the shared `middleware/envelope.ts` helpers (B7b A29 pattern; `X-Request-Id` echo-or-mint):

```ts
type QuoteDTO =
  | { kind: "buy";  side: "YES" | "NO";
      stake: string;            // the EFFECTIVE stake — clamped when submitted > BET_MAX_STAKE
      clamped: boolean;         // §16.1: "the clamped result is surfaced in the non-blocking preview"
      shares: string;           // computeBuy — To-win: payout if side wins = shares × Đ1
      p0: string; pEff: string; p1: string; impact: string }   // cpmm §6.4 bundle
  | { kind: "sell"; side: "YES" | "NO";
      shares: string;           // as submitted — SELL NEVER CLAMPED (SG-2)
      proceeds: string;         // computeSell — the sell-proceeds basis: then-current reserves (§6.3)
      p0: string; pEff: string; p1: string; impact: string };
```

The buy kind applies `clampStakeToMax` before `computeBuy` (cpmm §6.4: "the caller applies the per-bet stake cap … before `computeBuy`, so on a clamped buy these figures reflect the clamped stake"). The sell kind computes for ANY s > 0 with **zero position coupling** — deliberately: `computeSell` is pure math over public reserves; the composer bounds input by the viewer context's held quantity; the execute path (`insufficient_shares` + I-NO-OVERSELL) is the enforcement. Advisory per §6.3: figures may differ at execution — recorded fact, not a defect; no slippage-tolerance abort exists by design. No rate limit (**ratified**, OQ-5b — the read posture of the page/export routes; one indexed pool read + pure decimal math per hit); **recorded forward-pointer (OQ-5b rider): HARDEN.2 may bucket this route into the per-surface rate-limit table later — nothing is minted now.** Reserves are NOT echoed in the DTO (quotes are derivable outputs; the raw pool pair stays server-side). **Wire shape CLOSED (ratified OQ-2 / FI-1):** the §6.4 bundle IS the ruled consumable — W2.10 Option A is settled law (design-canon §4 rulings 2+3, Option A ratified 2026-06-27; committed as SPEC.1 1.0.15 / cpmm 2.1.0 at PR #225, squash `1006030`); A3 only chooses what to render.

**3.3 Viewer-session context — a composed server read, NOT an endpoint** (ADR-0019 Architecture 2).

New `src/server/debate-view/viewer-context.ts`:

```ts
loadViewerMarketContext(client, { userId, marketId }): Promise<ViewerMarketContext>
type ViewerMarketContext = {
  position: { side: "YES" | "NO"; quantity: string;
              currentValue: string /* computeSell(reserves, side, quantity).proceeds — sell-all NOW */ } | null;
  balance: string;          // readBalance — latest ledger balance_after (seq-ordered, ADR-0029)
  spendableToday: string;   // balance + (unpaid-today ? DAILY_CREDIT_DHARMA : 0) — READ-ONLY preview
};                          // field set RATIFIED (OQ-3); `staked` (Đa) absent — founder basis-ruling owed pre-A3
```

Reads only: `getHeldPosition` (asserts single-side), the pool row (for `currentValue`; `null` position ⇒ no pool read needed beyond the header's), `readBalance`, and the `users.last_allowance_accrued_at` cursor vs `utcDayOf(now)` (imported from `accrual.ts` — parity-tested, never re-derived). **Read-only by law** (§1 INV-2 narrative): no ledger append, no accrual write, no cursor write. `spendableToday` exists because the place path pays the day's credit BEFORE the F-BET-4 check (`place.ts` R4) — a composer gating affordability on raw `balance` would wrongly block a stake the endpoint accepts.

**`currentValue` basis — RULED (FI-2):** Đb = `computeSell(quantity).proceeds` — the impact-inclusive execution value, matching §6.3 preview semantics (what a seller actually receives). Recorded as a CHOICE, not a mechanical inevitability: the rejected alternative was **mark-to-p1** (a spot-price mark rather than what a sale would actually return). **Inheritance law:** A5 Profile's "Current" column and "Positions value" tile INHERIT this basis — one holding never shows two different current values across surfaces.

`/m/[slug]/page.tsx` composes it: `auth.api.getSession({ headers })` (the established layout pattern; pages re-read — accepted) → session ? `loadViewerMarketContext(db, …)` : `null` → `<DebateView model={…} viewer={…} …/>`. The prop is typed (via `components/debate/types.ts` `import type` re-export), serialized, and **render-unconsumed at A2** — the A3 strip is its consumer (lane verticality: read-model + wiring now, render next slot).

**3.4 Deep-link post param — page `searchParams`, no endpoint.**

`?post=<N>` where N = the market's 1-based **post ordinal**: rank by `(created_at, id)` ascending over the market's TOP-LEVEL comments (`parent_comment_id IS NULL`), removed posts INCLUDED in the domain (append-only ⇒ every post's ordinal is permanent; a later removal never renumbers). ADR-0016 D6's "natural ordering" option — no raw UUID touches the URL (**ratified OQ-4, NO ADR** — the D6-consumption record rides this plan + the PR body).

New `src/server/debate-view/resolve-post-param.ts`: `resolvePostParam(client, { marketId, post: string }): Promise<string | null>` — validates `/^[1-9][0-9]{0,4}$/`, resolves via one ordered indexed query (`ORDER BY created_at, id OFFSET n−1 LIMIT 1` over the market's top-level comments), returns the comment id or `null`. Page: `const { post } = await searchParams` → resolve → pass `initialPostId` (only when the resolved post exists in the model AND is `removed: false` — a removed or unresolvable target falls back to the market view, silently). `DebateView`: `useState<string | null>(initialPostId ?? null)` seeds the existing `selectedPostId` — prop-derived initial render, hydration-safe (server and client agree). Zero-supplied/invalid branch (explicit): absent, malformed, `0`, negative, out-of-range, reply-targeting, or removed-targeting values of `post` ALL render the plain market view — the param can never 404 or throw.

Outbound sync (**ratified IN**, OQ-5c): `DebatePost` gains a server-derived `ordinal: number` (both union variants — additive; SG-3), and `DebateView`'s enter/exit handlers mirror focus into the URL via `history.replaceState` (`?post=N` on enter, param dropped on exit) — this is what makes deep links MINTABLE (copy the address bar in post view) rather than write-only substrate. The masking-file touch is additive-only (SG-3); Gate C reads the diff; `@security-auditor` runs at execute.

## 4. UI / user flow

No visual changes. States (kickoff-mandated enumeration):

- **Signed-out** `/m/[slug]`: identical render to today; `viewer` prop `null`; quote route 401s (unconsumed until A3).
- **Signed-in, no position**: `viewer.position = null` (A3 renders `NO ACTIVE POSITION`); `balance`/`spendableToday` populated.
- **Signed-in, held position**: `viewer.position = { side, quantity, currentValue }`; banned users still receive it (ban removes voice, not reads — ADR-0021 posture; the write path holds the 403).
- **`?post=` valid + present post**: page renders directly in post-focus view (server-seeded state; no flash).
- **`?post=` invalid / out-of-range / removed / reply-targeting / absent**: plain market view (the explicit zero-branch — never an error surface).
- **Market non-Open**: everything above unchanged (reads are state-agnostic; C1 read-only posture holds — no composer exists yet).

## 5. Failure modes

- **Non-uniform clamp (the INV-1 narrative)** — foreclosed structurally + pinned by `clamped-execution-is-uniform`; detect: the test + Gate C diff-read; recover: the clamp is 4 lines at one site.
- **Broken cap config (`BET_MAX_STAKE` < a floor)** — clamp-then-floor order makes every affected bet reject loudly (`below_*_floor`) instead of executing below floor; the config-coherence unit test (`BET_MAX_STAKE > BET_MIN_STAKE_REPLY > BET_MIN_STAKE_POST > 0`, exact decimal compare) makes the bad config unshippable through CI at all.
- **Viewer-context read accidentally writing (the INV-2 narrative)** — pinned by row-count-invariance + parity tests; detect: integration suite; recover: the module is new + isolated.
- **Quote/preview vs execution drift** — by design (cpmm §6.3 advisory; the W-1 recompute under the pool lock is authoritative); not a defect; A3's composer copy owns user-facing framing. No mitigation is built (no tolerance-abort exists in v1, recorded).
- **Pool row absent on a non-Draft market** — structurally not expected (markets seed at open, ENGINE.14); quote route degrades to 404-equivalent envelope; `unitToWin`/`pricing` already share the defensive-null path (`getMarketPricing` precedent).
- **Session read failure in the page** — same posture as the shell layouts (Better Auth returns null on absent/invalid session; no new throw surface).
- **Upstash outage** — irrelevant to A2's reads (pure Postgres + math; no Redis on any new path); the place path's existing fail-open/fail-closed posture (ADR-0015) is untouched.
- **Deep-link race: target removed between mint and click** — resolver still resolves the id; the page's `removed: false` gate falls back to market view; thread integrity + masking unaffected.
- **Concurrent posts vs ordinal stability** — append-only + `(created_at, id)` total order ⇒ an ordinal, once minted, never re-points; new posts only extend the domain.
- **Stale `.next/types` validator on the new `quote` route** (memory: EXPORT.1) — `just clean` before pushing any branch lacking the route.

## 6. Edge cases

- `stake == BET_MAX_STAKE` exactly → NOT clamped (`>` strictly); `clamped: false`; byte-identical passthrough.
- `stake > max`, `balance < max` → clamp first, then in-tx F-BET-4 reports `required = <clamped stake>` (the amount execution actually needs) — consistent.
- `stake > max` on a REPLY → clamped, then the reply floor asserts on the clamped value (a reply is a buy).
- Same idempotency key, same over-max body, replayed → original 200 from the receipt (the CLAMPED execution's result). Same key, DIFFERENT over-max body → 409 `error_idempotency_key_reused` (fingerprint is over the raw submitted body).
- Quote `stake = "0.000000000000000001"` (dust) → valid math (positivity holds); floors don't apply to previews (the preview is not a bet).
- Quote sell `shares` exceeding the viewer's holdings → computed anyway (pure math; bounds are the composer's + execute path's job — named, deliberate).
- Quote on a Closed/Resolved market → computed (advisory — ratified OQ-5b).
- `unitToWin` on a fresh symmetric pool (100,100): `computeBuy(stake:"1").shares = 1.990099009900990099` — the E1-adjacent vector the unit test pins.
- Viewer with unpaid daily credit: `spendableToday = balance + DAILY_CREDIT_DHARMA`; paid-today: `spendableToday == balance`. UTC day boundary: `utcDayOf` (shared import) decides — parity test covers both sides of midnight.
- Viewer holding a position in a Voided/Resolved market: position renders as read (settlement/refund already flowed through the ledger at resolution; `currentValue` computes against frozen reserves — display semantics are A3's, the number is mechanical).
- `?post=1` on a zero-post market → out-of-range → market view. `?post=` targeting a reply's position → unreachable by construction (domain = top-level only) → market view.

## 7. Test plan

Tests-first (§5.6): `@test-writer` writes the REDs at Phase 2 start against this section. Local gates run against Postgres :54322 directly (`pnpm vitest run`, never via `just` — memory law).

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/unit/bets/`) | EXTEND `floors.test.ts` (or NEW `clamp.test.ts`): `clampStakeToMax` — below/at/above max (exact-string passthrough ≤ max; boundary inclusive), decimal-string discipline; **config-coherence pin** `BET_MAX_STAKE > BET_MIN_STAKE_REPLY > BET_MIN_STAKE_POST > 0` (ratified values: `"10000"` > `"50"` > `"10"`) | INV-1 (order guard), broken-config unshippable |
| Unit (`tests/unit/`, quote math) | Quote DTO computation vs the cpmm fixed vectors (E4: (150,50) buy YES S=10 → shares 35, pEff 2/7, p1 12/37, impact 0.074324…; sell round-trip E3): buy kind clamps (`stake > max` → figures reflect max, `clamped: true`), sell kind NEVER clamps; `unitToWin` vector (100,100 → 1.990099009900990099) | §6.4 conformance; SG-2 |
| Unit (`tests/unit/`, resolver + preview) | `resolvePostParam` validation matrix (absent/`abc`/`0`/`-1`/`1e9`/valid/out-of-range → null-or-id); `spendableToday` arithmetic paid/unpaid vs `utcDayOf` | zero-branch law |
| Integration (`tests/server/bets/` + PG) | NEW `clamp.test.ts`: **clamped-execution-is-uniform** (over-max place → `bets.stake` == ledger |amount| == pool Đ-inflow == `BET_MAX_STAKE`; response `sharesBought` == `computeBuy(max)`); **sell-never-clamped** (accumulate > max via multiple buys, sell-to-zero in ONE call succeeds); clamp-replay (same/different body per §6); at-max boundary no-op | INV-1, INV-2, I-IDEM-ONCE, I-NO-OVERSELL |
| Integration (`tests/integration/` + PG) | NEW `viewer-context.integration.test.ts`: shape (position/null, balance, spendableToday); **read-only-no-ledger-write** (row counts invariant across the read); **spendable-preview-parity** (preview == what `accrueDailyCredit` would do, paid + unpaid days); single-side assert inherited. NEW `market-quote.integration.test.ts`: 401 signed-out; 404 unknown/Draft slug; happy buy/sell against a seeded pool; **advisory-no-writes** (zero new rows in bets/ledger/events/receipts); param-validation 400s. NEW resolver integration: ordinal stability under appended posts; removed post keeps its ordinal; reply excluded | INV-2 narrative, INV-3 read-only, D6 |
| Existing suites | `I-*` invariant specs, `tokens-monochrome`, `no-raw-hex-view-layer`, bets replay/oversell/floors, debate-export, market-by-slug — ALL untouched and green (full `pnpm vitest run` is the pre-PR whole-suite gate) | the standing lattice |
| E2E | none — Playwright not installed (AGENTS §9); the lane-law integration step = the suites above + a manual smoke (`?post=` happy + fallback paths, quote route via curl with a session cookie, signed-in page render) | — |

Every §1 "touched" invariant has at least one assertion above (template law). Scale battery: not triggered (no concurrency-shape change; the clamp is pre-tx).

## 8. Out of scope (Phase 2 may not absorb any of these)

- **A3 (Composers UI):** the strip render, `TO WIN`/`YOUR POSITION` display, composer forms, clamp UX, wiring to `/api/bets/place`/`sell`, moderation surfaces, receipts UX, removal of the C1 disabled triggers (values-log §6 ruling 1's render half), price-pill/thumb grammar, slot-header geometry.
- **`Đa` (staked basis)** — the one open economics semantic: founder ruling OWED before A3 renders Đa (Ratification record OQ-3); lands as a SPEC.1 line when ruled; the strip degrades to Đb-only until then. **Slippage/impact render** — an A3 display choice over the closed §6.4 wire (W2.10 Option A is settled law — FI-1).
- **Session B rows** (fork gate governs separately): share affordances (post-JPEG card, export button), Landing, ToS, leaderboards, route protection, Radio (SPEC-FIRST), Admin Centre.
- **Reply-level deep-link addressing** (the future W2.13 share-card consumer) — a later additive param on the same D6 ordinal mechanism; explicitly NOT A2 (FI-5).
- **Profile (A5)** — the held-side readout's click-through target (W2.10-C) needs no A2 work; A5's "Current" column + "Positions value" tile INHERIT the FI-2 `currentValue` basis (one holding, one current value across surfaces).
- **Polling** (F-DEBATE-4 `POLL_INTERVAL_MS_DEBATE_VIEW`) — not in the row; quote/strip freshness at A2 is per-request.
- **Rate-limit constants / §16.1 additions** — no new limiter surface (OQ-5b); HARDEN.5 owns values.
- **SPEC.2 bundle** (§0 banner + MAINT.22/F4 + MAINT.15) — stays parked; the new modules' SPEC.2 §3 tree entries ride the next SYNC sweep (A1 closing-ritual precedent), NOT this task.
- **`stash@{0}`** (EXTAUDIT-06 `.env.example` R2 quad) — untouched; operator ruling pending. **PR #146** — untouched (flagged at A1 close-out; web's call). **The moderation-test Biome import** — untouched.
- **Migrations/DDL** — none (SG-4). **Token contract v0.4 / `globals.css`** — untouched. **CLAUDE.md/AGENTS.md** — no per-task edits (drift rides the SYNC sweep).

## 9. Build order (lane law: component → read-model → wiring → states → integration test; commit-sized slices, each independently green: `ZUGZWANG_ENV=preview just verify` + targeted suites)

1. **Clamp (critical-path slice, tests-first):** `@test-writer` REDs (clamp unit + config-coherence + integration matrix) → `BET_MAX_STAKE` in `limits.ts` (`"10000"` — ratified OQ-1) → `clampStakeToMax` in `floors.ts` → place-route 5d (clamp-then-floor) → GREEN. Zero other bet-path files (SG-1).
2. **Quote substrate:** REDs (DTO math vs vectors, clamp surface, param matrix, advisory-no-writes) → `market-pricing.ts` extension (`unitToWin`, one pool read) + `DebateMarketHeader.unitToWin` → `(public)/m/[slug]/quote/route.ts` (envelope helpers, session gate — ratified OQ-5a) → GREEN.
3. **Viewer context:** REDs (read-only law, parity, shape) → `viewer-context.ts` → page session read + `viewer` prop landing on `DebateView` (types.ts re-export) → GREEN.
4. **Deep-link:** REDs (resolver matrix, ordinal stability) → `resolve-post-param.ts` → page `searchParams` + `initialPostId` seeding + the ratified `ordinal` field + `replaceState` sync (OQ-5c IN) → GREEN.
5. **Spec rider + close:** SPEC.1 §9 F-DEBATE-1 one-line `?post=` rider — **prescriptive spec text → WEB-AUTHORED (FI-4)**: at this commit point CC PAUSES and requests the rider text from web, applies it VERBATIM in the SAME commit as the governing code (execution BLOCKS until the text is relayed — the A1 ADR-0023-rider pattern); Gate C reads the diff; its §20 changelog row is appended newest-LAST per the live table shape (FI-3 resolved — web withdrew; live shape law) + grep-verify the 1.0.15 clamp text needs NO edit (expected no-op) → full battery: `ZUGZWANG_ENV=preview just verify` · full `pnpm vitest run` against :54322 (whole-suite gate) · `pnpm test:invariants` + `pnpm test:integration` · `just clean` before push (new-route validator trap) → **§5.10 pre-PR self-audit** (item-by-item vs this plan: SG-1..7, §1 narratives→assertions, §3 surfaces, §7 matrix) → **sequential directed reviewer cascade**: `@code-reviewer` (the four verticals + scope guards, per-point verify-AND-STATE) → `@security-auditor` (clamp boundary + uniform-execution, quote probe surface + session gate, viewer-context authz/read-only law, INV-1/2 gaps) — one reviewer touching the DB at a time; `@db-migration-reviewer` NOT invoked (zero schema/migration diff — deliberate, kickoff-consistent) → PR (multi-line message via `/tmp/commit-msg.txt`, no Co-authored-by) → **Gate C: web reads the actual diff PRE-merge** → operator squash-merges → post-merge tree-content proof (diff reviewed-SHA vs origin/main EMPTY + clamp-line grep on main).

Branch `feat/ui-a2-composer-substrate` (name-free check before `checkout -b`; assert `--show-current` after). Post-ratification plan commit: branch `docs/ui-a2-plan`, staging ONLY `docs/plans/UI-A2.md` (F3); `docs/logs/UI-A2.md` stays untracked; execution opens in a FRESH tab from the committed plan (§5.8).

---

## Open questions

None blocking Phase 2 — all 5 interview OQs are answered and folded (see the Ratification record; the round-1 interview text is superseded by that record). Residuals (tracked; none gates Phase 2 start):

- **Đa staked-basis — DEFERRED WITH OWNER (founder; ratified OQ-3a).** Nominal-total vs net-of-partial-sells (and on what basis — `positions` carries no basis column, so any definition derives from `bets` rows at read time) is an un-pinned economics semantic. Ruling owed BEFORE A3 renders Đa; lands as a SPEC.1 line when ruled; the strip degrades to Đb-only until then. Consumed at the A3 plan chat.
- **FI-3 changelog direction — RESOLVED (Round 3).** Web WITHDREW FI-3 — live shape (append newest-last) ratified as law; the amendment sheet's "prepend" wording was the sheet's error, reconciled correctly at #225. Held record (round 2, preserved as history): live grep at `6447280` — SPEC.1's change log is **§20** (line 1326; §0 is metadata bullets, no table), appended newest-LAST (first data row `1.0.0-draft` @1330; final data row `1.0.15` @1357), matching cpmm.md §15's shape; not folded per the do-not-silently-reconcile law. The execute-phase rider row APPENDS newest-last.
- **Rider text (FI-4).** Web-authored at the execute commit point; execution BLOCKS at §9 slice 5 until the text is relayed (the A1 ADR-0023-rider pattern).
- Standing, untouched: `stash@{0}` ruling · PR #146 · the moderation-test Biome import · SPEC.2 bundle (parked).

## ADRs needed

**None — ratified.** The clamp consumes SPEC.1 1.0.15 (whose changelog explicitly ruled "No new ADR: the decision is canonical in design-canon §4 ruling 2"); the quote/viewer reads consume ADR-0019 + cpmm.md §6; the deep-link consumes ADR-0016 D6's named mechanism (**ratified OQ-4: NO ADR** — the D6-consumption record rides this plan + the PR body; next-free **0032** stays unclaimed). OQ-1's ratified answer is the constant, not a table — the DDL/ADR path stays foreclosed.

**Same-commit spec amendments owed at execute:** SPEC.1 §9 F-DEBATE-1 one-line `?post=` rider — **WEB-AUTHORED (FI-4)**: CC pauses at the commit point, requests the text, applies it verbatim in the same commit as the governing code; Gate C reads the diff. Its §20 changelog row follows the LIVE table shape — appended newest-LAST (grep-verified at `6447280`: §20 header line 1326, rows run `1.0.0-draft` @1330 → `1.0.15` @1357 as the final data row; **FI-3 resolved — web withdrew; live shape law**). Grep-verify (expected no-op): SPEC.1 §7/§16.1 clamp text is already current at 1.0.15. cpmm.md: no change (2.1.0 current). AGENTS.md §3 tree drift (three new modules + route) rides the next SYNC sweep, not this task.

---

## Self-critique (after Phase 1 self-review — append-only)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high | "Quote read" could have been over-built as one endpoint serving both the strip and the composer, coupling a public always-on render to a session surface | split by consumer (§3.2/§3.3): strip data rides the view model (unitToWin, currentValue — zero new public endpoint), the interactive route serves only the signed-in composer; recorded so execution doesn't re-merge them |
| 2 | high | The server clamp silently executes a different amount than submitted for direct-API clients (no response field says "clamped") | this IS the spec (§16.1 clamp-not-reject; preview is the surfacing layer; A3 adds client-side clamp UX); response-shape change would amend the F-BET response contract — deliberately not done; surfaced here for web override (an override to reject-shape would itself need a SPEC.1 amendment) |
| 3 | high | The quote route has NO consumer until A3 (dead-surface risk if A3 re-scopes) | accepted by design — the lane ordered substrate-first verticality; the tests are the consumer at A2; the DTO is spec-pinned (§6.4) so A3 cannot bend it |
| 4 | medium | `spendableToday` duplicates the accrual gate read-only (drift risk vs `accrual.ts`) | shared `utcDayOf` import + a parity integration test locking preview == accrual behavior; a comment in `viewer-context.ts` binds the two files |
| 5 | medium | The viewer prop lands render-unconsumed at A2 (looks like dead code) | deliberate lane verticality (read-model + wiring at A2, render at A3); the typed prop + serialization through the RSC boundary is itself the deliverable being proven; named in §3.3/§8 |
| 6 | medium | `BET_MAX_STAKE` ships against a founder-unsupplied placeholder; a too-low accidental value would clamp real bets | OQ-1 owns the number; the zero-branch default (10000) is deliberately inert; the config-coherence test forecloses the max<floor catastrophe; JSDoc PLACEHOLDER discipline marks intent |
| 7 | medium | Clamp-then-floor changes floor evaluation from the submitted to the clamped stake — under a coherent config the outcomes are identical for every input, but the order is load-bearing only under broken config | rationale recorded (§3.1: broken config must reject loudly, never execute below floor); the coherence unit test makes the broken config unshippable anyway — belt and suspenders |
| 8 | low | Ordinal deep-links are positional and enumerable (`?post=1..N` walks the debate) | all posts are public content already (public-read posture); enumeration reveals nothing masking withholds (removed targets fall back); accepted |
| 9 | low | The quote route is unrate-limited and pool depth is invertible from two quote samples | reserves are not secret (prices are public; the full dataset releases Nov 6; Manifold-lineage markets expose liquidity openly); posture matches the heavier export route; OQ-5b offers the tightening |
| 10 | low | `getSession` now runs in both the layout and the page (duplicate read per request) | the established Next.js pattern (layouts cannot pass data to pages); same posture the A1 shell recorded; accepted |
| 11 | low | Adding `ordinal` to `DebatePost` (OQ-5c) touches `load-debate-view.ts` — the masking file | additive field on BOTH union variants, no masking-logic line moves (SG-3); strikeable via OQ-5c at zero cost |
| 12 | medium | **FI-3 contradicts the live repo (round-2 verification):** the fold-in asserts SPEC.1 "§0" changelog rows are PREPENDED newest-first, citing the live 1.0.15 row — but at `6447280` the change log is **§20** (line 1326; §0 = metadata bullets, no table) and runs OLDEST→NEWEST: first data row `1.0.0-draft` @1330, **final data row = `1.0.15` @1357**; cpmm.md §15 carries the same appended shape (1.0.0 → 2.0.0 → 2.1.0). Round-1's "appended newest-LAST" was deliberate, not paste-mangling | **HELD, not folded** (the kickoff's own do-not-silently-reconcile law): plan text stays pinned to the live-verified shape with line evidence; the contradiction is recorded in the Ratification record + Open questions + headlined in the round-2 relay for the Round-3 ruling. **Round 3: web withdrew FI-3; live append-newest-last shape ratified.** |
| 13 | low | Round-1's kickoff framed W2.10/W2.7 as "PENDING founder rulings," so OQ-2/OQ-3 were partly aimed at settled law (W2.10 Option A = design-canon §4 rulings 2+3 → SPEC.1 1.0.15 / cpmm 2.1.0 at PR #225 `1006030`; W2.7 = ruling 1 — bookmark-row figure ownership) | FI-1 citations folded, corroborated live this round (design-canon §4 header + W2.7/W2.10 resolution rows; `git rev-parse 1006030` EXISTS = PR #225); the genuinely open core re-scoped to the Đa staked-basis (founder-owned, owed pre-A3) |

---

## References

- `CLAUDE.md` (§1 critical paths · §2 invariants + money law · §3 refusals · §5.6/5.7/5.10/5.11 ritual) + `AGENTS.md` (§5 route patterns · §6 DB/tx law · §9 tests · §11 boundaries)
- `docs/plans/UI-LANE.md` §1 (the gap) · §2 A2 (binding scope + ritual class + window note)
- `docs/plans/UI-A1.md` §4.2 (Đ-cluster deferral: "the data is verbatim A2 scope") · §4.4 (named NOT-sweep items pinned to A2/A3) · §8 · `docs/logs/UI-A1.md` (close-out ground + owed follow-ups)
- SPEC.1 1.0.15 — §7 preamble + F-BET-9 tombstone (clamp semantics; buy/add only; sell never) · §16.1 `BET_MAX_STAKE` row (value TBD → number-tuning ~2026-09-01) · §9 F-DEBATE-1 (the rider's home) · §16.2
- `docs/specs/cpmm.md` 2.1.0 — §3.3 prices · §4/§5 (computeBuy/computeSell, worked vectors E1–E5) · §6.1/6.3/6.4 (impact; advisory preview; the consumable + caller-side cap) · §10 (rounding) · §13 (module API; the cap stays out of the pure module)
- ADR-0031 (durable receipts + terminal error mapping — the place-route stack this plan inserts into) · ADR-0015 (§3.1 sequence, envelope, fail postures) · ADR-0018 (floors + issuance; the "paid only on a commented bet" law the INV-2 narrative guards) · ADR-0019 (server-mediated reads + tripwire) · ADR-0016 D6 (URL rule) · ADR-0020/0021 (masking posture, untouched)
- `docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` §6 ruling 1 (the consumer strip — render NOT A2 scope)
- `docs/design/design-canon.md` §4 — the DC rulings (operator-ratified 2026-07-02): ruling 1 = W2.7 bookmark Staked/Current (whose figures show — the bookmarked author's) · rulings 2+3 = W2.10 Option A (sell module + cap clamp; Option A ratified 2026-06-27) → committed as SPEC.1 1.0.15 / cpmm 2.1.0 at PR #225 (squash `1006030`, verified live) — FI-1
- FI-2 inheritance law (§3.3): A5 Profile "Current" column + "Positions value" tile inherit the `currentValue` basis — one holding, one current value across surfaces
- Code ground: `src/server/bets/{endpoint,place,sell,floors,errors,replay}.ts` · `src/app/api/bets/{place,sell}/route.ts` · `src/server/config/limits.ts` · `src/server/cpmm/calculate.ts` · `src/server/debate-view/{load-debate-view,market-pricing}.ts` · `src/server/positions/read.ts` · `src/server/dharma/{persist,accrual}.ts` · `src/app/(public)/m/[slug]/{page.tsx,export/route.ts}` · `src/components/debate/{DebateView.tsx,types.ts}` · `src/server/middleware/envelope.ts`
- Tracker: UI-LANE §2 A2 (tracker_v17 is web-side; the lane plan is the in-repo sequencer)

---

*Plan follows `docs/plans/_template.md`. Authored in the A2 plan-mode session (2026-07-17, round 1), Fable 5 window live; **v2 (round 2, same day): all 5 interview OQs ratified + web fold-ins FI-1..FI-5 processed — FI-3 HELD on a live-repo contradiction (Ratification record); verification greps run live before folding; self-critique rows 12–13 appended, rows 1–11 preserved verbatim.** **v2+r3: FI-3 resolved (web withdrew), session-code reuse edit, header flips; final web review PASSED.** Commits only after final web review + operator ratification. At the plan commit, ONLY this file is staged (F3); `docs/logs/UI-A2.md` stays untracked. Execution opens in a fresh tab from the committed plan (§5.8).*
