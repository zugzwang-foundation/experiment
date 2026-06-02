# SYNC.7 — SPEC.2 fold (reply-as-bet + friendly-fire removal)

> **Stage:** SYNC.7, SPEC.2 half — rewrite `SPEC.2` into consistency with SPEC.1 v1.9.0-draft + ADR-0017/0018/0019. **Status:** CLOSED.
> **Mode:** Web Claude solo doc-authoring. Claude Code ON HOLD — no repo writes.
> **Deliverable:** full `SPEC_2.md` (stays v0.4.0-draft; §0.1 change-log row 49 rewritten), single file, not a diff.
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.7 (SPEC.2 fold) close-out (six fields per CLAUDE.md §5.9).

---

## What landed

Full updated `SPEC_2.md`, internally consistent with SPEC.1 v1.9.0-draft + ADR-0017/0018/0019, with a §0.1 change-log row. Grep-clean: no live `friendly_fire_events` / `stake_at_post_time` / `W-2` / `F-COMMENT-6/7/8` / `castFriendlyFire` / `clearFriendlyFire` (only historical change-log rows + intentional removal/audit notes remain).

**Headline counts after fold:** 22 tables · Bucket B 3 · protected 12 · 14 Server Actions · 37 F-* files · 15 dataset tables.

The fold, by area:

- **Friendly-fire removed entirely** (was a standalone up/down vote): `friendly_fire_events` table + its Bucket-B trigger + `castFriendlyFire`/`clearFriendlyFire` Server Actions struck from schema and every operational reference; Support/Counter is now a read-time aggregate over reply-bets. Sites: §5.1 (row deleted + renumber; 23→22 tables, Bucket B 4→3, protected 13→12), §5.2, §5.4 (rewritten), §5.5 (audit bullet), §6.3 (trigger deleted; 4→3 fns / 8→6 triggers), §6.6 (floor re-baselined below 38), §7.4/.5, §9 (lock-order), §11, §13.3, §18.2/.4, §19 (dataset row + count 16→15), §22 (verify), §23, Appendix A, Appendix B (B.8 deleted + B.9–B.16 renumbered to B.8–B.15).
- **Reply-as-bet write-path rework** (every comment rides a bet): W-2 ("comment, no pool lock") retired; comment/reply writes run the §9 W-1 bet transaction; only comment-free write is the sell (F-BET-3). `comments.bet_id` → NOT NULL (1:1 with the comment-bearing bet, INV-1); `parent_comment_id` NULL = post-bet, non-NULL = reply-bet (reply floor 50); `stake_at_post_time` dropped. Sites: §3.1/.2/.7, §4.2/.4/.6, §9, §10, §11, §12.2, §13 (F-COMMENT-1/2/3 reclassified bet-flows; 40→37), §14 (INV-1 + INV-3 mechanisms), Appendix A + B.
- **Ranking → ADR-0017** (supersedes 0009): four per-side reply-bet aggregates (`support_count`, `counter_count`, `support_dharma`, `counter_dharma`) computed at render time. No projection table / `ranking_snapshots` / matview / live K_eff surface. `RANKING.md` stale until DEBATE.8.
- **Other folds:** Daily Allowance → Daily Credit (concept/rule only; DB identifiers `daily_allowance` / `last_allowance_accrued_at` retained per SPEC.1 §10.4); two floors `BET_MIN_STAKE_POST` / `BET_MIN_STAKE_REPLY` referenced as write-path checks (constants SPEC.1 §16.1-owned); §11 records the deferred open question (reply-bet per-market productive cap → HARDEN.6) + rate-limit posture (`bet-ip`, per-IP).

## Decisions made

1. **§13.3 F-* count → 37.** Kept the expected "40→37" delta; the table's literal active-row count is lower (pre-existing F-MOD-3 / F-BET-8 gaps, unrelated to this fold). Wrote 37 and added a §23.3 drift row to reconcile prose-vs-table at the §13 redraft.
2. **§19.3 / B.17 cleanup** — removed a pre-existing "Wait — let me recount" meta-narrative sitting in shipped prose while editing those lines.
3. **ADR-0017 body left stale on purpose** — still says friendly-fire "stays display-only"; out of scope to flip ADR text/status here; flagged §5.5 + §23.3 for an in-place patch + SYNC.BACKFILL.

## Open questions

Still trailing (tracked, non-blocking — specs are now the forward target): ADR-0017 body text ("display-only", in-place patch pending); ADR statuses 0017/0018/0019 still `proposed` (index shows `accepted`; flip at SYNC.BACKFILL); `RANKING.md` (old ADR-0009 scalar → DEBATE.8); `cpmm.md` unwritten (own chat; brief in SPEC.2 §1.4); built SCAFFOLD.2 schema behind specs (still has `friendly_fire_events`, nullable `comments.bet_id`, `stake_at_post_time`, comment-without-bet paths) — physical migrations + write-path rework are forward engineering (SPEC.2 §23.3).

## Next session starts at

**SYNC.8 — CLAUDE.md + AGENTS.md rebuild.**

## Context to preserve

In sync after this pass: SPEC.1 v1.9.0-draft ↔ SPEC.2 ↔ ADR-0017/0018/0019. `CLAUDE.md` / `AGENTS.md` rebuild → SYNC.8; `tracker_v11.html` commit → SYNC.10; ADR commits 0003–0019 → SYNC.BACKFILL (only 0001 on disk). The `SPEC.2.md` commit rides SYNC.9 / SYNC.10; ADR-status flips ride SYNC.BACKFILL. CC was on hold — no `docs/logs/` entry, no branch/PR this chat.

## Time

Single web doc-authoring session; no stopwatch recorded.
