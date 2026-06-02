# SYNC.4 — Drift ledger + ranking ADR

> **Stage:** SYNC.4 — ADRs & Rulings. **Status:** partially closed — ranking ADR delivered; inherited rulings carried to SYNC.5.
> **Mode:** Web Claude + operator. No Claude Code, no repo writes.
> **Primary deliverable:** `0017-ranking-modes-and-top-composite.md` (successor ranking ADR, `proposed`).
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.4 close-out (six fields per CLAUDE.md §5.9).

---

## What landed

- **ADR-0017 delivered (`proposed`)** — successor ranking ADR; **supersedes ADR-0009**.
- **Item 02 (reply-as-bet) settled into ADR-0017:** a reply *is* a bet (stake + side); replies side-partitioned; reply ranking stake-only; two-slot Support/Counter debate render; `REPLY_DEPTH_MAX = 1` reaffirmed.
- The four inherited open rulings + the RLS ruling + TYPE-1 ledger-inputs **did not** close — carried to SYNC.5.

**ADR-0017 in one screen (shape only; all numbers → the 2026-09-01 tuning pass):**

- **The reframe (load-bearing):** no approval axis — Support and Counter are both contributions, so the Wilson / up-down / "best" family is dead on arrival; contestation is *signal, not noise* (the inverse of Hacker News). Mandatory commentary is the thesis mechanism, so **the ranking carries no anti-capital logic** — surfacing a heavily-staked post exposes its falsifiable argument to scrutiny; visibility is where debate happens, not a prize capital captures. **All lanes are equal, including stake.**
- **Default = "Top"** — a fixed multi-lane composite (not an average). A post qualifies by dominating any one lane by a relative margin over the second-place post in that lane (ratio-to-#2 above a small activity floor). Lanes: traction-dominance, stake-dominance, dominance-split — all equal. Graceful degradation (closest-to-landslide) so Top never renders empty.
- **Filter modes (opt-in):** Most Debated (`n`), Highest Stakes (`D`), Contested (`n^b`), Newest. **Surging deferred to v1.x.** No "Best" (no ground truth pre-resolution).
- **Reply ranking (depth = 1):** stake-descending within side, earlier-wins tie-break. Recorded + accepted tension: reply ranking is pure C-axis (the only signal a flat reply emits); free-vote and stake-backed alternatives were considered and rejected for experiment scope.
- **Fixed default, not shuffled.** Four per-side base signals (`support_count`, `counter_count`, `support_dharma`, `counter_dharma`) + age; footer shows two side-pairs, author stake at header.
- **Friendly-fire removed from ranking** (display-only at this point) → forces a SPEC.1 §9 same-commit rewrite at SYNC.7.

## Decisions made

| # | Call | Reversible? |
|---|------|-------------|
| 1 | Numbered **ADR-0017** (next free after 0003–0016). | ↺ trivial renumber. |
| 2 | Status **`proposed`** (flips to `accepted` on founder sign-off). | ↺ ratify. |
| 3 | **No new frozen column** on `comments` — values aggregate from `bets` (`stake` + `side`) at read-time. | ⚠ sanity-check against live `bets` shape. |
| 4 | **Friendly-fire removed from ranking** entirely → SPEC.1 §9 rewrite pending SYNC.7. | ↺ keep-as-input is an explicit reversal if wanted. |

## Open questions

Carried to SYNC.5: the four inherited open rulings; the RLS ruling (refinement-01) + any TYPE-1 ledger-inputs; and — flagged load-bearing — the **sybil / Dharma-issuance** question ("Most Debated" and the whole `n` half of K·n>C are gameable until first-Dharma acquisition is ruled). Decision: **resolve when Dharma issuance is defined**, not before; it is a ruling, not a ranking decision (correctly absent from ADR-0017).

## Next session starts at

**SYNC.5 — rulings** (issuance gate first, then the inherited rulings + RLS).

## Context to preserve

Downstream consequences of ADR-0017 (SYNC.7 prose, not earlier): SPEC.1 §9 rewrite (drop friendly-fire-as-input, introduce the mode set + Top lanes + four per-side signals + reply-stake-order); §16.1 `REPLY_DEPTH_MAX = 1` unchanged; §17/§18 new ranking test rows + out-of-scope entries; SPEC.2 §23 + change-log (ADR-0017 entry; ADR-0009 → superseded); DEBATE.4 / DEBATE.8 / SCAFFOLD.2 (render, RANKING.md, lane-aggregation indexes). Tuning-pass (2026-09-01): `k_lane` / `floor_lane` per lane, gravity `c` / `g`, Surging window; plus the stale-blowout edge — whether the dominance margin needs its own decay term so an old dead lopsided post can't resurface.

## Time

Single web + operator analytical session; no stopwatch recorded.
