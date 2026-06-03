# PRECURSOR.4 — Spec Lock Review Close-Out

**Task:** PRECURSOR.4 — promote SPEC.1 + SPEC.2 to v1.0 (spec lock-REVIEW, not a rewrite).
**Date:** 2026-06-03.
**Reviewer:** web Claude — fresh reviewer; specs authored by SYNC.7 (writer/reviewer separation preserved).
**Baseline:** `origin/main` @ `809179f` (SYNC.10 bundle, #62). PK == repo confirmed; tree clean.
**Outcome:** Review complete; v1.0 change-set assembled. **Exit met on CC apply + merge.**
**Absorbs:** MAINT.13 (same-commit version-bump + changelog discipline).

---

## Objective & exit

Verify SPEC.1 + SPEC.2 internal + cross-doc consistency post-SYNC.7, resolve the named carry-forward decisions, walk the §23 gating trace, then promote both specs to v1.0. Exit: SPEC.1 + SPEC.2 committed at v1.0 on `origin/main`; carry-forwards resolved and swept uniformly; §23 trace walked with no coverage gaps; ADR-0012 recorded as an accepted in-flight condition.

This was the hard gate before ENGINE code (`ENGINE.0` depends on it).

---

## Review walk — findings & resolutions

### A — Recon reconciliation
- **Currency clean:** HEAD = main = origin/main = `809179f`; tree clean. PK == repo (SPEC.1 v1.9.0-draft, SPEC.2 v0.4.0-draft on both).
- **Companion specs absent:** `error-codes.md`, `RANKING.md`, `cpmm.md`, `design.md`, `PSEUDONYM.md` not on disk → the 38-code catalogue lives only in SPEC.2 §15.4.
- **Vestigials confirmed** + two kickoff corrections: (1) the "stale ranking index" is `friendly_fire_ranking_idx` on `friendly_fire_events` (NOT on `stake_at_post_time`, which has no index); `comments_ranking_idx` on `(parent_comment_id, side_at_post_time)` is the LIVE index and must survive. (2) Three vestigials, not two — `comments.bet_id` nullable is the third (target NOT NULL). DEBATE.8/9 dispositions unchanged: DEBATE.9 drops the `friendly_fire_events` table + trigger + its three indexes; DEBATE.8 drops `stake_at_post_time` (no index to drop); **do not touch `comments_ranking_idx`.**

### B — Error catalogue (CF#7 / CF#1 / CF#3)
- **CF#7:** 38 codes confirmed (39th `error_*` token is `error_type`, the envelope field).
- **CF#1 — ratify the `error_` prefix.** The §15.4 catalogue is 100% prefixed; the bare forms in SPEC.1 + ADR-0013/0014 prose are the stale drift (this reversed the going-in lean toward bare). Sweep SPEC.1 prose to the prefix. **ADR-0013/0014 bodies left untouched (Option 1)** — historical records; the canonical catalogue is §15.4.
- **CF#3 — accept admin-flow code sparseness across all five F-ADMIN flows** (1/2/3/4/5 are all `<placeholder>` skeletons). Product-validation codes minted with their flow contracts, not retrofitted now.
- **error-codes.md (Option 2):** §15.4 is the canonical 38-code catalogue at v1.0; `error-codes.md` + its §15.5 CI lint become a named forward deliverable (ENGINE error-envelope work). Chosen over creating the file now (which would open a dual-source drift surface with no lint to reconcile it).

### C — Column sweep, count cluster, entry_type (CF#6 + C.1 + C.3)
- **CF#6 column sweep: PASSED.** 13 of 15 shipped tables exact-match Appendix B. `users` had a real coverage gap (4 unclassified columns — see F). `comments.stake_at_post_time` in source not in spec = the expected vestigial. `friendly_fire_events` correctly absent. The two known vestigials are the **only** spec-vs-code mismatches — exactly as the kickoff predicted.
- **Count cluster — §5.1's 22 is authoritative** (23 physical base tables − the `friendly_fire_events` vestigial removed-from-spec = 22; the recon's "23, undercounts by one" didn't net out the deliberately-removed FFE). Stale counts to fix: §5.3 / §5 single-source / §23 "nine domains" → **ten**; §6 "eight Bucket C" → **ten**; §19.3 header → **22 / 20 dataset-relevant / 15 ship / 5 don't**. §7 "thirteen synchronous targets" verified correct (FFE-excluded).
- **C.3 — `dharma_ledger` column is `entry_type`**, not `tag` (glossary ×3) or `source` (L158). Normalize SPEC.1 to `entry_type`. SPEC.2 already correct.
- **Incidental folded in:** SPEC.1 uses the stale enum value `bet_settle` (L158, L544); schema + SPEC.2 use `bet_payout`; SPEC.1 L158 also omits `uncollectable`. Orphaned (tagged for the dissolved PRECURSOR.5; SYNC.8 didn't absorb it). Folded into the v1.0 sweep (same dharma-ledger-vocabulary family).

### D — §23 bidirectional gating trace (CF#8)
- **Section coverage (Direction B): clean.** Every gating section (§0, §3–§23) has ≥1 consuming task. §1 (Purpose/Scope) and §2 (empty Blockers Register) correctly excluded as non-gating.
- **Material finding — §23 built against tracker v7, not v11.** Phase model omits SYNC + TESTING, includes removed LIVE + CONCLUDE, uses "UI" for "VISUAL"; task numbering drifted. Per "tracker is the sequencer, note drift once, never block": **fix the v7→v11 version string now; defer the Direction-A phase-model reconciliation to the tracker sweep** (already due post-SYNC), recorded as a labeled v1.0 deferred item. Direction-B section coverage is verified complete.
- Minor: `F-DATASET-1` referenced (§4.3/§13/§23.1/Appendix A) but not minted in `flows/` — folds into the existing §13.3 F-* count reconciliation.

### E — ADR-0017 Patch record (CF#5)
- In-place **Patch record P1** (CLAUDE.md §5.12 convention) reconciling three stale facets: (1) "display-only" friendly-fire ×3, (2) `friendly_fire_events`-as-read-source ×2, (3) the §23→§22 ADR-Index pointer (noted, not rewritten inline — uniform with ADR-0018/0019). **Load-bearing decision unchanged; not a supersession.** Status already `accepted`. First Patch record in the repo (section-only convention).

### F — License + §19 reconciliations (CF#2 + queued)
- **CF#2 — dataset license: CC-BY-4.0.** Rationale: thesis-propagation project with an academic audience; guaranteed attribution preserves lineage/credit at negligible friction; §19.1 framed the choice as citation-vs-friction (commercial protection moot). CC0 was the defensible alternative (purist commons); CC-BY chosen for credited propagation.
- **§19.3 header reconciled:** the stale "21 tables / 13 ship / 8 don't" → "22 total / 20 dataset-relevant (2 pg_cron operational tables excluded) / 15 ship / 5 don't." Table + summary were already correct.
- **PRIVACY FIX (the material §19 finding):** `users.name` + `users.image` (real name + Google avatar URL) were unclassified in both Appendix B and §19.4 → would have shipped → **real-name/avatar leak in the public dataset.** Resolution: STRIP both (unused PII — Zugzwang displays only the pseudonym). `email_verified` + `updated_at` → SHIP (non-PII).
- **Retraction:** the C.2 "(a) Appendix B 5 → 7 not-shipped" call was wrong. §19.3 deliberately excludes `watermark_state`/`cron_alarms` from the dataset inventory ("not part of the dataset inventory at all"); Appendix B correctly mirrors it. **Appendix B "5 not-shipped" stands — no change.**
- **Downstream flag (ENGINE.0, not a PRECURSOR.4 fix):** if the OAuth/OTP event payloads carry the Google `name`/`image`, §19.4.1 should strip those too (mirroring the column strip). Payload shapes are defined at ENGINE.0.

---

## v1.0 change manifest

All edits land in **one atomic v1.0 lock commit** (web-authored prescriptive, CC-committed; feature branch + PR + merge).

### SPEC.1
1. §0 metadata: version `1.9.0-draft` → `1.0.0`; date `2026-06-03`; + v1.0 changelog row.
2. §2 glossary (L56/57/59): `dharma_ledger.tag` → `dharma_ledger.entry_type` (×3).
3. §3 Dharma (L158): "carries a `source` tag" → "carries an `entry_type`"; enum value `bet_settle` → `bet_payout`; add `uncollectable` to the enum list.
4. §11 (L544): payout tag `bet_settle` → `bet_payout`.
5. §12.2 (L578–588): add license statement — "Released under **CC-BY-4.0**."
6. **Error-code prefix sweep:** bare → `error_`-prefixed across SPEC.1 flow contracts + error prose (e.g. §13 F-AUTH-* contracts: `oauth_callback_error`, `session_persistence_failed`, `turnstile_failed`, `otp_invalid`, `otp_expired`, `otp_rate_limited`, `email_delivery_failed`, `identity_pool_exhausted`; prose: `moderation_in_flight`, `moderation_unavailable`, `market_closed_at`, …). Guarded: only backtick-quoted exact matches of the 38 bare forms; verify `` `internal` `` / `` `validation` `` occurrences (if any) before replacing.

### SPEC.2
7. §0 metadata: version `v0.4.0-draft` → `1.0.0`; date `2026-06-03`; + v1.0 changelog row (records all CF resolutions + recorded conditions).
8. §5.3 (L516): "Nine domains" → "Ten domains."
9. §5 single-source (L548): "ten files across nine domains" → "ten domain files / ten files across ten domains."
10. §6 (L564): "The eight Bucket C tables" → "The ten Bucket C tables."
11. §19.3 header (L1803): reconcile to "twenty-two tables; twenty dataset-relevant (2 pg_cron operational tables excluded); fifteen ship; five do not (operational / privacy-sensitive)."
12. §19.1 (L1789): "Permissive (CC0 or CC-BY-4.0 — final pick locked at PRECURSOR.4…)" → resolve to **CC-BY-4.0**.
13. §19.7 manifest JSON (L1917): `"license": "<final license per §19.1>"` → `"license": "CC-BY-4.0"`.
14. §19 tracker row (L1945): "Final license selection (CC0 vs CC-BY-4.0)" → mark resolved (CC-BY-4.0).
15. §19.4 PII strip table: add `users.name` → STRIP, `users.image` → STRIP rows; update the "eight PII columns" count prose (+2; preserve Appendix B's existing `pfp_filename` "minus one" NULL_IF_ERASED nuance).
16. Appendix B B.1 (`users`): add 4 rows — `name` STRIP, `image` STRIP, `email_verified` SHIP, `updated_at` SHIP; update the Appendix B coverage-observation column count.
17. §23 intro (L2169): `zugzwang_experiment_tracker_v7.html` → `tracker_v11.html`.
18. §15: edit the §15 language so **§15.4 is the canonical 38-code catalogue at v1.0**; mark `error-codes.md` + the §15.5 CI lint as a named forward deliverable.

### ADR-0017
19. Insert the `## Patch record` section (P1) immediately after the metadata `---` (after L13), before `## Context and Problem Statement` (L15). (Full P1 text in the in-chat Part E delivery.)

### Optional / non-blocking
20. `dataset-release.md` (96-line stub): add the CC-BY-4.0 license when fleshed out — canonical license lives in SPEC.1 §12.2 + SPEC.2 §19.1; not blocking the lock.

---

## Recorded / deferred conditions (v1.0 locks with these open — honestly labeled)

- **ADR-0012 (design.md) in-flight** — v1.0 locks with it open (§22 carve-out already encoded). design.md acceptance later triggers a v1.0 → v1.1 bump **without re-opening this review.**
- **`error-codes.md` + §15.5 CI lint = forward deliverable** — assigned to the ENGINE error-envelope work; §15.4 is canonical until then.
- **§23 Direction-A phase-model reconciliation to tracker v11 = deferred** to the post-SYNC tracker sweep (Direction-B section coverage verified complete). Includes the §23.3-flagged drifts (their "SYNC.8" routing is moot) and the `F-DATASET-1` / §13.3 F-* count reconciliation.
- **Downstream (ENGINE.0):** verify §19.4.1 strips Google `name`/`image` from OAuth/OTP event payloads if present.

---

## PK update table (refresh after merge)

| File | State after v1.0 | Action | Reason |
|---|---|---|---|
| `SPEC_1.md` | v1.0.0 | **Verify** (re-sync from repo post-merge) | promoted + edits 1–6 applied |
| `SPEC_2.md` | v1.0.0 | **Verify** (re-sync post-merge) | promoted + edits 7–18 applied |
| `0017-ranking-modes-and-top-composite.md` | patched | **Verify** (re-sync) | Patch record P1 inserted |
| `dataset-release.md` | stub | **Keep** | license deferred to flesh-out; non-blocking |
| `tracker_v11.html` | unchanged this task | **Flag** | §23 phase-model reconciliation + the SYNC/TESTING/LIVE/CONCLUDE drift now due in a tracker sweep |
| `PRECURSOR.4.md` (this log) | new | **Add** (commit to `docs/logs/` + PK) | session record |

---

## Commit plan

1. **v1.0 lock commit** — feature branch (e.g. `docs/precursor-4-v1-lock`), all manifest edits, conventional message via `/tmp` file, PR, **operator merges** (branch protection). Squash-merge → force-delete the branch.
2. **Close-out log commit** — separate chore branch + PR committing `docs/logs/PRECURSOR.4.md`.
3. **Tracker sweep** — now due (SYNC arc closed; §23 reconciliation is a structural trigger). Separate task.

---

## Next task — ENGINE.0 (gate-released)

`ENGINE.0` ("Extend `EVENT_TYPES` + `AggregateType`" — the event vocabulary) is unblocked by this lock. It is **critical-path code** (bet-engine substrate) → full plan-mode-then-execute ritual: CC writes the plan in one chat from the locked specs; web reviews; operator ratifies; a fresh chat executes. Carry the F.2.1 downstream flag (OAuth/OTP payload `name`/`image` strip alignment to §19.4.1) into ENGINE.0's scope.
