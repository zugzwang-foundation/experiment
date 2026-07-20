# UI-A5 — Profile — session log (execute)

**Stratum:** UI-A5 execute · **State:** complete → PR open, awaiting Gate C web diff-read + operator squash · **Date:** 2026-07-20

## What landed (files + PR#)

The whole §23 Profile vertical on branch `feat/ui-a5-profile` — **8 slices, 8 commits** (one PR, N-6; **PR #<PENDING — filled at gh pr create>**). Zero DDL / migration / schema / event-type changes (hard fence held); no §1 critical-path dir logic edited.

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

## Open questions → Gate C web diff-read (all in `claude-progress.md`, gitignored)
1. Closed-row domain = held-to-settlement (OQ-3 A reading; exited-then-settled → no row).
2. S5: simplified R2 graph node (crowd-split needs a Slice-4 DTO extension); `--graph-yes/no` used as emphasis not side poles; 2 web-owned overlay control-name copy gaps; MarketFilter labels by slug.
3. S6: F-PROF-3 prose vs the 2 ratified viewer deltas (chip + empty-CTA); removed comment still emits a graph node; scrub `startsWith("[")` heuristic; dedicated scrubbed-silhouette asset owed (brand ruling).
4. S7: canon §5 fixed-50px replica-footer-card anatomy vs the built table row-expansion; a banned owner still sees the Sell trigger (server 403s the wire).

## Next session starts at
Gate C web pre-merge diff-read on PR #<PENDING>; on approval, the operator squash-merges (CC does not merge). No further CC code work on A5 unless Gate C returns findings.

## Context to preserve
- Session model `claude-fable-5`; the 4 agent pins are `claude-opus-4-8` (unreachable in-session) → every Agent call carried `model: fable` (the §9 pin-law fallback); no subagent died at 0 tool_uses.
- Mode law (Q3) held: no ultracode, no Workflow fan-out, single-threaded, kickoff-named subagents only.
- Full local gate green on the complete branch: `ZUGZWANG_ENV=preview just verify` + `pnpm test:integration` (175) + `pnpm vitest run` (1772 passed / 2 skipped / 4 todo).
- `claude-progress.md` holds the Gate C surfacing set (never committed — gitignored local scratch).

## Time
UI-A5 execute — one session, 2026-07-20.
