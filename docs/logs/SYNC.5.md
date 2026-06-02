# SYNC.5 — Rulings (issuance + RLS)

> **Stage:** SYNC.5 — Rulings. **Status:** CLOSED — all five rulings resolved; two delivered as `proposed` ADRs.
> **Mode:** Web Claude + operator. No Claude Code, no repo writes.
> **Primary deliverables:** `0018-dharma-issuance-and-bet-floors.md` (`proposed`), `0019-rls-out-of-scope-experiment.md` (`proposed`), `dharma-distribution-ruling.html` (founder brief).
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.5 close-out (six fields per CLAUDE.md §5.9).

---

## What landed

| Ruling | Disposition | Where it landed |
|---|---|---|
| **Dharma issuance / distribution** (the gate) | DECIDED | **ADR-0018** — asymmetric minimum-bet floors (reply 50 pinned, post low/ranged); equal ~1,000 grant; flat ~10 daily credit on a commented bet; optional in-window sink (principle only); ~10k/1k/100 draft rejected. |
| **RLS** (tracker open #1 / D4) | DECIDED | **ADR-0019** — out of scope for experiment (server-only / Architecture 2); build skipped, decision recorded; tripwire + testnet revisit. |
| `.claude/` hooks/skills (open #2 / D6) | routed | resolve-in-place at **SYNC.8**. |
| README (open #3 / D9) | routed | deferred (stub stands; rewrite outside the SYNC arc). |
| Stale branches (open #4 / D10) | routed | next coding phase. |

**ADR-0018 — the reframe:** the experiment has a *faucet* (grant + daily credit) but **no loss-sink** (markets don't resolve in-window), so over-issuance — not scarcity — is the central risk, and Dharma is dual-use (reputation *and* stake) so debasement corrupts both signals at once. The non-obvious core: "post expensive, reply cheap" is backwards — a reply *is* a bet ranked stake-descending at depth-1, and ADR-0017 already conceded reply ranking is pure C-axis ("C > n inside a K·n>C system"). The reply minimum bet is the only parameter-level lever on that conceded tension; a higher reply floor compresses the stake range and softens C > n ⇒ **reply floor > post floor**. Pinned: reply floor = **50**. Ranged → tuning pass: grant ~1,000 (equal), daily credit ~10 (flat, on a commented bet), post floor ~10–25. Design-intent ratio ~1,000 : 10 : 10 : 50.

**ADR-0019 — basis:** Architecture 2 (server-only DB) — untrusted clients never connect to Postgres, so RLS would back-stop the trusted server rather than gate an exposed surface. Tripwire: any client-direct DB path (Supabase client in a browser component, public data endpoint, user-scoped DB credential reaching a client) makes RLS mandatory before that path ships. Revisit at testnet. Resolves D4.

## Decisions made

| # | Call | Reversible? |
|---|------|-------------|
| 1 | Numbered **ADR-0018** (issuance) + **ADR-0019** (RLS). | ↺ trivial renumber. |
| 2 | Both status **`proposed`** (flip to `accepted` on sign-off). | ↺ ratify. |
| 3 | Reply floor **pinned at 50**; post floor left **ranged** (only the reply number was pinned). | ↺ tuning pass may adjust both. |
| 4 | Optional in-window sink ruled as **principle only**; mechanism deferred. | ↺ SYNC.7 or future ADR decides mechanism. |

## Open questions

Number-tuning pass (2026-09-01): ratify/adjust grant, daily credit, post floor; re-examine reply floor = 50; decide sink mechanism vs faucet-tightening fallback; set median-free-balance monitoring threshold.

## Next session starts at

**SYNC.6 — tracker v11** (now unblocked).

## Context to preserve

Backfill scope grew to **0003–0019** (was 0003–0016; +0017 in SYNC.4, +0018/0019 here). Downstream (SYNC.7 + backfill, not earlier): SPEC.1 economy rewrite folds ADR-0018; SPEC.2 records the RLS posture + tripwire and adds 0018/0019 to the §23 index. Thesis floor held — the ~10k/1k/100 draft was rejected *because* its login-funds-bets ratio breached the influence reading (presence is not stake); ADR-0017's ranking model was not reopened (the reply floor is a parameter, not a function change).

## Time

Single web + operator ruling session; no stopwatch recorded.
