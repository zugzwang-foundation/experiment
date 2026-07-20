# UI-A5 — Profile — session log (execute)

**Stratum:** UI-A5 execute · **State:** complete → **Gate C APPROVED (2026-07-20)** + one fix-up commit; awaiting operator squash · **Date:** 2026-07-20

## What landed (files + PR#)

The whole §23 Profile vertical on branch `feat/ui-a5-profile` — **8 slices, 8 commits** (one PR, N-6; **PR #251**). Zero DDL / migration / schema / event-type changes (hard fence held); no §1 critical-path dir logic edited.

- **S1** `1982a68` — `src/server/profile/episodes.ts` (SideEpisode + Đa pure math; N-3 merge law) + unit/property tests.
- **S2** `41ca78a` — `src/server/profile/{resolve,positions,tiles}.ts` (read-model core; Đb/Đa; OQ-9 A closed rows; N-1a) + DB-backed tests.
- **S3** `8486bc6` — `src/server/profile/arguments.ts` (argument list §3.6, markers, `loadRemovedSet` masking; safety-critical) + tests.
- **S4** `ca71c1f` — `src/server/profile/graph-series.ts` + `discovery/price-series.ts` additive `replayReserveSeries` (OQ-2 B) + `config/limits.ts` (`PROFILE_SERIES_MAX_POINTS`, `PROFILE_GRAPH_Y_MAX` mirror) + tests.
- **S5** `122b6f0` — `src/components/profile/graph/**` + `copy.ts` (the W2.6 port; no d3) + jsdom tests.
- **S6** `538b597` — `src/app/(public)/u/[pseudonym]/{page,loading,error}.tsx` + `components/profile/{IdentityCard,ProfileTiles,PositionsTable,ArgumentList,states}.tsx`; N-2 route-walk flip + N-7 + surface tests.
- **S7** `c2b70cd` — `src/server/profile/owner-view.ts` (F-PROF-3 DTO boundary) + PositionsTable Sell mount + W2.10-C activation (`SlotHeader`/`PositionStrip`/`DebateView` + the debate page) + tests.
- **S8** `83f46f4` — `HeroPanels` author link + `IdentityCluster` chip link (A4 follow-up #2) + tests.

*(Canonical SHA = the squash-merge SHA on `main` after Gate C + operator tap; branch SHAs above are ephemeral.)*

## Decisions made
- OQ dispositions consumed from the committed plan §16 (no re-litigation): OQ-2 B (additive reserve-walk export, Discovery byte-preserved), OQ-3 A (closed rows = held-to-settlement), OQ-4 B (`PROFILE_SERIES_MAX_POINTS`), OQ-5 B (`?market=` preselect, now consumed), OQ-9 A (closed Staked/Current).
- Ported the W2.6 chart layer WITHOUT adding d3 (lightweight linear scales + polyline strings, the PriceSparkline precedent) — kept the "no new dependency" fence.
- Owner-only Sell is a DTO-boundary discriminated union (`buildPositionsPayload`) — the visitor arm structurally has no `sellEligible`; render + session-scoped wire are the two further backstops.
- Reviewer-driven fixes absorbed in-session per slice (see each commit body); no fix deferred.

## Gate C — APPROVED (2026-07-20), rulings 1–10 ratified; one fix-up commit
Fix-up (Slice-5/copy/log scope only): (1) OQ-7 a11y strings `graph.aria.filterMarket = "Filter by market"` (MarketFilter `<select>`) + `graph.aria.overlay = "Dharma graph"` (overlay dialog, both modes); (2) ruling 3 — each per-market SideEpisode segment strokes by its own side (`--graph-yes`/`--graph-no`, cumulative mapping unchanged) + a jsdom assertion; (3) this log's PR# fill. All other v1 accepts + dockets recorded web-side; the `claude-progress.md` surfacing set is consumed by the close-out chat post-merge (untouched here).

Dockets that RODE Gate C as v1 accepts (not fixed in this branch): the simplified R2 graph node (crowd-split DTO extension), the closed-row held-to-settlement domain (OQ-3 A), the F-PROF-3 chip + empty-CTA viewer deltas, the removed-comment graph node, the scrub `startsWith("[")` heuristic, the scrubbed-silhouette asset (brand ruling), the canon §5 card-footer-vs-table-row-expansion anatomy, the banned-owner Sell trigger (server 403), MarketFilter labels by slug.

## Next session starts at
Gate C web pre-merge diff-read on PR #251 (approved 2026-07-20, one fix-up commit); on approval, the operator squash-merges (CC does not merge). No further CC code work on A5 unless Gate C returns findings.

## Context to preserve
- Session model `claude-fable-5`; the 4 agent pins are `claude-opus-4-8` (unreachable in-session) → every Agent call carried `model: fable` (the §9 pin-law fallback); no subagent died at 0 tool_uses.
- Mode law (Q3) held: no ultracode, no Workflow fan-out, single-threaded, kickoff-named subagents only.
- Full local gate green on the complete branch: `ZUGZWANG_ENV=preview just verify` + `pnpm test:integration` (175) + `pnpm vitest run` (1772 passed / 2 skipped / 4 todo).
- `claude-progress.md` holds the Gate C surfacing set (never committed — gitignored local scratch).

## Time
UI-A5 execute — one session, 2026-07-20.
