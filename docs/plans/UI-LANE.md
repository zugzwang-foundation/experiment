# Zugzwang — UI Lane Plan (UI.0)

> **Doc:** `docs/plans/UI-LANE.md`
> **Status:** v1.0 · authored at UI.0 (2026-07-16) · web-authored · operator-ratified · CC-committed
> **Ground:** UI.0 surface recon read from `main` @ `26d9f3e` · mockup corpus 1:1 vs design-canon §8 rows 1–15 · ceilings verified (ADR 0031 · migration head 0023 · EVENT_TYPES 24)
> **Governs:** order + ritual class of every UI-lane build. Per-surface plans are authored fresh in each surface's own plan-mode chat (CLAUDE.md §5.1) — this doc sequences; it does not design.
> **Precedence:** SPEC.1/SPEC.2 > ADRs > design-canon > this plan.

## 1 · Recon ground truths
- Participant shell built (ADR-0023, `(public)/layout.tsx`); header is a marked throwaway.
- `/m/[slug]` = DEBATE.4 read-only render (17 files, single client boundary `DebateView.tsx`); token-riding (PriceBar · badges · CommentImage · dialogs).
- Auth functional-unstyled: `/sign-in` · `/sign-in/otp` · `/onboarding` (Better Auth backend complete).
- `/` = coming-soon placeholder outside `(public)/` — Discovery displaces it.
- No Profile route. No Bookmarks anything (schema, endpoint, and spec all absent).
- Write path server-complete for place/sell EXCEPT: `BET_MAX_STAKE` unimplemented (SPEC.1 1.0.15 / F-BET-9 clamp), no quote/To-win read, viewer-session context not exposed to view models, no deep-link post param.

## 2 · Session A — gated core lane (order is binding; every slot builds vertically: component → read-model → wiring → states → integration test)

| # | Slot | Scope | Ritual class | Spec anchor |
|---|------|-------|--------------|-------------|
| A1 | Foundation | Branded global header + nav (W2.4-5-14 v0_2) replacing the throwaway · tokens verified on all real routes · shell polish · DEBATE.4 rebrand pass (stray-value sweep + branded-header integration) | Standard, web-gated (shared foundation) | ADR-0023 · canon §8 rows 2/8 · token contract v0.4 |
| A2 | Composer substrate (backend) | `BET_MAX_STAKE` clamp (config + place path; buy/add only — sell never clamped) · quote read for To-win + sell-proceeds preview · viewer-session context (held position + balance) into the market view model · deep-link post param on `/m/[slug]` | CRITICAL PATH (bet engine): plan-then-execute · writer/reviewer · Gate C · NEVER ultracode | SPEC.1 §7 (1.0.15, F-BET-9) · cpmm 2.1.0 · ADR-0031/0015/0018 |
| A3 | Composers UI | Market-detail Đ BET composer (buy/add) · Support/Counter reply composer · Sell module + clamp UX (W2.10) — wired to `/api/bets/place` + `/sell`; pre-commit moderation surfaces (ADR-0014); receipts (ADR-0031); floors (ADR-0018); copy per canon §6 (Đ BET) | CRITICAL PATH: full ritual incl. @security-auditor on moderation-adjacent surfaces · NEVER ultracode | canon §8 rows 9/10 · SPEC.1 §7 |
| A4 | Discovery ✅ · PR #244 · `3b2d07d` | `/` route (displaces placeholder) · list-open-markets read model · hero/top-posts selection · card DTO · ranking modes | Standard; ultracode allowed on reversible parts | SPEC.1 discovery · ADR-0017 · RANKING.md · canon §8 row 1 |
| A5 | Profile | `src/server/profile/` wholesale: positions-across-markets + current value · six tile aggregates · Dharma graph series · argument list · surface build | Standard | SPEC.1 profile · canon §8 row 3 |
| A6 | Bookmarks | ADR-BOOKMARKS first (storage: table vs `user_events` projection; web-authored beside the lane; next free ADR number verified via `ls docs/adr/` at mint) → migration → toggle write + list read → Profile bookmark mode | ADR gate; migration = DDL → gated plan→execute, NEVER ultracode; surface standard | new ADR · canon ruling 1 (semantics) |
| A7 | Auth skin | W2.1 auth-modal skin on the existing flows (page↔modal resolution in its plan chat) | CRITICAL-PATH CLASS (touches auth routes) — full ritual despite cosmetic scope | canon §8 row 5 · ADR-0004/0010 |
| A8 | MEDIA.2 | Market-media tab at the Market-Detail header (design-at-build; closes W2.9) | Standard | ADR-0026/0027/0028 |

**Order rationale.** Foundation unblocks everything including Session B. Backend-first verticality puts the composer substrate before the composer UIs; composers outrank Discovery because the write path is the load-bearing gap and the critical-path work. Discovery precedes Profile (launch funnel: land → browse → bet). Bookmarks follows Profile (needs its ADR + the Profile surface). Auth skin is cosmetic completeness; MEDIA.2 is display-only.

**Window note.** A1–A3 are targeted inside the Fable-5 window (through ~Jul 19 2026); A4 onward degrades gracefully to `claude-opus-4-8` post-window. Model pin reverts after the window. No gate flexes for the window.

## 3 · Foundation-stable criterion (Session B fork gate)
ALL of: A1 merged green on `main` · branded header live on `/m/[slug]` + the auth routes · DEBATE.4 rebrand merged · zero open PRs touching `(public)/layout.tsx` or header/nav components. Until then, Session B does not fork.

## 4 · Session B — leaf-row stream (operator-driven; web gates each PR; order free after the fork gate)
Landing · ToS/Privacy · AGPL footer · OG cards · Leaderboards · route protection · visitor counter · post-JPEG share card (W2.13) · debate-`.md` download affordance (export route exists per ADR-0025 — enable the ArgProfile affordance) · Radio — SPEC-FIRST: SPEC.1 §21.5 amendment + ADR before ANY build · Admin Centre — RULED LEAF at UI.0 (recon: admin consumes no shared branded components).
Class: ultracode default; any row adding DDL, auth, moderation, or bet-path code escalates to the gated ritual automatically.

## 5 · Beside the lane (not Session A/B work)
- O1 chat owns: onboarding deck (W2.2) · first-login journey · coach-mark first-entry guide (spec line + intro_seen migration; builds late, after its target surfaces). The lane does NOT build these.
- DESIGN.SPEC derives the final `design.md` — beside.
- Spec-lane queue (web-authored): Bookmarks ADR (before A6) · radio §21.5 amendment + ADR (before its Session B row).

## 6 · Parked / not-in-lane
- ~86 `[gone]` local branches — post-window hygiene sweep (zero-diff-then-`-D` pattern).
- W2.11 45-state ledger CSV — operator locate (non-blocking; the state-kit mockup + canon §8 row 11 carry the states).
- SPEC.2 bundle (§0 banner + MAINT.22/F4 + MAINT.15) — parked; one bump at the next SPEC.2-touching task.
- `stash@{0}` (EXTAUDIT-06 `.env.example` quad) — untouched; operator ruling pending.

## 7 · UI.0 rulings ledger
- Admin Centre = Session B leaf.
- Recon gate-deviation accepted: the `-d` predicate was structurally unmeetable in a squash-only repo; zero-diff-then-`-D` is the house branch-cleanup pattern from now on.
- Fable-5 window: CC + all 4 subagents pinned to Fable 5 for the window; revert to `claude-opus-4-8` after.
