# SYNC.7 — SPEC.1 rebuild (v1.8.0 → v1.9.0-draft)

> **Stage:** SYNC.7, SPEC.1 half (the SPEC.2 half is `SYNC.7-spec2-fold`). **Status:** CLOSED.
> **Mode:** Web Claude solo doc-authoring. Claude Code ON HOLD — no repo writes.
> **Deliverable:** full `SPEC_1.md` v1.9.0-draft (1421 lines), single file, not a diff.
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.7 (SPEC.1) close-out (six fields per CLAUDE.md §5.9).

---

## What landed

The three new ADRs and the six confirmed TYPE-2 surfaces folded onto the v1.8.0 anchor; drift D11 resolved; full updated SPEC.1 delivered with a §-level change-log row. **Not promoted to v1.0** — that is PRECURSOR.4 (fresh-session reviewer, gated on SPEC.2 also being folded).

What was folded:

- **ADR-0017 (ranking) → §9 rewritten.** Top multi-lane dominance default (traction `n` / stake `D` / split `lop = 1−b` lanes; lead #2 past ratio `k_lane` + activity floor `floor_lane`; graceful-degradation = closest-to-landslide). Modes: Most Debated (`n`), Highest Stakes (`D`), Contested (`n^b`), Newest; **Surging deferred to v1.x**; no "Best". Fixed-not-shuffled; HN-gravity decay on accumulating modes. Author stake `a` = cold-start seed + tiebreaker, not a mode. Reply ranking = stake-descending within side, earlier-wins (UUIDv7/ADR-0016), two-slot render. No anti-capital logic. Math owned by `RANKING.md`, read-time-computed, no `ranking_snapshots`. Supersedes ADR-0009.
- **ADR-0018 (economy) → §10.** Equal initial grant (~1,000 ranged); **Daily Credit** (flat, non-escalating, paid only on a UTC day with a commented bet, use-or-lose); two asymmetric floors — post `BET_MIN_STAKE_POST` (~10–25) + reply `BET_MIN_STAKE_REPLY` = **50 pinned**; over-issuance as central risk (§10.2); optional in-window sink reserved, mechanism deferred (§10.10).
- **ADR-0019 (RLS out of scope) → §16.3** server-only posture (inherits SPEC.2 §18.5).
- **Reply-as-bet** (the load-bearing structural change): INV-1 generalised to bind **every** bet (post + reply). Post = top-level bet+comment (post floor); reply = bet+comment with `parent_comment_id` (reply floor 50). Sell (F-BET-3) stays comment-free. §7 + §8 reworked.
- **Friendly-fire removed entirely** — no vote affordance, no `friendly_fire_events`; F-COMMENT-6/7/8 retired; Support/Counter are read-time aggregates over reply-bets.
- **Marker → Flipped / Exited** only; same-side default renders no marker; "In" dropped.
- **Daily Allowance → Daily Credit** rename throughout; **`stake_at_post_time` dropped**; **D11** (§0 date 2026-06-01, 1.8.0 → 1.9.0-draft).
- **Six TYPE-2 features → new §21 Ancillary Product Surfaces:** visitor counter (21.1), download-post-JPEG (21.2), download-debate-`.md` (21.3), historical-debate showcase (21.4), radio/music widget (21.5), feature-guide page (21.6). All read-only/render-only, zero engine/ledger/`n` contact, with editorial + lawyer flags carried from the SYNC.3.5 refinement logs.

Sections touched: §0, §2, §3, §5, §6, §7, §8, §9, §10, §12.2, §13, §14, §16.1/.3/.4, §17 (~24 new test rows; friendly-fire rows removed), §18, §19, §21 (new), Appendix B.

## Decisions made

1. **§21 placement — zero renumber.** Appended after §20 Change Log (before appendices) to avoid renumbering §0–§20, which would corrupt point-in-time §-citations in historical change-log rows + forward refs to §18/§19. *Open to reconsider: renumber into a mid-document slot if preferred.*
2. **Refinement-05 "links" left unfolded** — "open-link attachments" is a TYPE-2 in the SYNC.3.5 index but is not among the confirmed six and the tracker omits it too (likely deferred alongside the rejected PDFs — both user-submitted moderation surfaces). Say the word to fold it in.

## Open questions

- ADRs 0017/0018/0019 are `proposed`; SPEC.1 folds them as if accepted — flip at a SYNC close / PRECURSOR.4.
- **ADR-0017's own text is stale** (still says friendly-fire "stays display-only", now contradicted) → needs a later in-place patch.
- **`RANKING.md` rewrite** — §9 names it as the math home for the Top composite + lanes + modes + reply stake-within-side, but the file still reflects the old ADR-0009 single scalar; rewrite is a separate task.
- Number-tuning pass (2026-09-01): equal grant, Daily Credit, post floor, Top lane ratios/floors/gravity. Pinned, not deferred: reply floor (50), `REPLY_DEPTH_MAX` (1).

## Next session starts at

**SYNC.7 — SPEC.2 fold** (the matching architecture-spec rewrite).

## Context to preserve

Validation greps confirmed clean: no live `friendly` / `friendly_fire_events` / `stake_at_post_time` / `DAILY_ALLOWANCE_DHARMA` / bare `BET_MIN_STAKE` / named-`In` outside intentional removal notes; §0–§21 ascend cleanly into the appendices; SPEC.2 cited at **§22** (not §23) in all new content; no orphaned F-COMMENT-6/7/8; no stray `↑N↓M` live display. Standing mid-July lawyer flags added by §21: named-paraphrase + citation for the historical showcase (21.4); YouTube embed ToS for the radio widget if commercial (21.5); ToS for operator re-use of user commentary in the off-platform daily report (21.3). The SPEC.1 `.md` commit rides SYNC.9/10 — not committed this chat (CC on hold).

## Time

Single web doc-authoring session; no stopwatch recorded.
