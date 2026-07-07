# Session log — SYNC-SWEEP (spec/doc reconciliation sweep: 7 tasks, 4 targets + 2 strays)

**State: CLOSED — PR #218 squash-merged to `main` @ `681e0b1` (2026-07-07 13:22 UTC).** Merged tree verified ≡ reviewed tree (`git diff 5f318e3 origin/main` empty); guard greps on main confirmed (SPEC.2 `1.0.17` ×4; parked.md PAID tombstone at :290); remote branch auto-deleted, local deleted after the zero-diff gate.

## 1. What landed (files + PR#)

PR #218 (branch `docs/sync-sweep` off `2d1c62d`; squash `681e0b1`): 6 files, +35/−53. Doc-only.

- `docs/specs/SPEC.2.md` → **1.0.17**: §0 cites → 29 ADRs @ `0003–0031` (status/companion/gates-downstream) + status-line migration head `0023` + SPEC.1 cross-cite `1.0.14` · one comprehensive §0.1 row covering A1 #197 / B1 #199 / B2 #201 / B3 #202 / B7-A26 #209 / B7a #211 / B8 #216 (PR# + squash SHA each) · §19.3 enumerates `market_media` (21 dataset-relevant; 16 ship + 5 not; ships in full per B.16) + excluded-recap names `bet_receipts` · §22: rows ADR-0029/0030/0031, heading "26-row" → "30-row", inventory **30 ADRs** (29 files + 0012 in-flight; 27 accepted + 2 superseded + 1 in-flight), range → `0003–0031`, §22.5 SSOT updated, ADR-0015 row annotated with its two in-place Patch records (B3, B7a).
- `docs/specs/SPEC.1.md` → **1.0.14**: §20 row (A1 §16.5 swap-window note · B3 §7 F-BET-3 oversell rider · B7a F-BET-1 C.length rider · B8 §16.3 H3 admin-null; B1/B2 touched SPEC.2 only) · §7 F-BET-1 **Errors** row gains `400 comment_requires_bet` (pre-existing enumeration drift; thrown since DEBATE.1).
- `CLAUDE.md` + `AGENTS.md`: footer ADR range → `0003–0031`; CLAUDE.md §1 source-of-truth cite → `0003–0031`; spec-version cites → SPEC.1 1.0.14 / SPEC.2 1.0.17 (ruling 3); footer attribution re-stamped BC.2 → "the SYNC sweep (Jul 7, 2026)".
- `docs/runbooks/deploy-pipeline.md`: §0 migrations head `0019` → `0023` · §4 seed-staging "⏳ OPEN" note closed as ✅ RESOLVED (see Decisions — stray 5 was already paid).
- `docs/parked.md`: SYNC-sweep entry → **PAID tombstone** (PR #218 stamped; forbids double-payment).

Deliverable shipped: `~/Desktop/SYNC-SWEEP-pr218.diff` (241 lines; md5 `ec25f489ed66f067be548e6004af21bb`, verified vs fresh regen).

## 2. Decisions made

- **First pass STOPPED on the version premise** (per the kickoff's own STOP condition): kickoff expected SPEC.2 at 1.0.14, the parked entry said "currently v1.0.15", the live file read **1.0.16** — AUDIT-FIX-A22 (#207, `b15a7f5`, 2026-07-06) had bumped §0 in its own PR. Web re-issued with corrected bases (SPEC.2 1.0.16; A22's row stays) and **patch-class** bumps 1.0.13→1.0.14 / 1.0.16→1.0.17 (the original "MINOR-class" withdrawn).
- **ADR arithmetic ratified**: one census — 29 real ADR files (`0001`, `0003–0011`, `0013–0031`; `0002` never authored; `0012` = design.md lock, a filled **in-flight** slot per §22.4 property 3, no file) — surfaced through two conventions: §0 range convention (0001 out) → **29 @ 0003–0031**; §22 convention (0001 in) → **30**. The parked entry's 29-vs-30 "quirk" was two conventions, not a contradiction.
- **Ruling 3** extended target 4 to every SPEC.1/SPEC.2 version cite in CLAUDE.md + AGENTS.md (cite values only).
- **Three disclosed riders** accepted at the web gate read: (i) §0 status-line same-sentence epoch coherence — migration head `0019→0023` + SPEC.1 cross-cite moved with the ratified ADR-line edit, re-anchored "(current at the 1.0.17 SYNC sweep, 2026-07-07)"; (ii) footer attribution re-stamped (BC.2 never stamped 1.0.14/1.0.17 — keeping its name would fabricate history); (iii) §19.3 closing recap completed to name all three excluded-entirely tables.
- **Stray 5 was already paid**: zero `--config staging` matches under `scripts/` — fixed pre-sweep at `b724094` (2026-06-28, post-D6 pipeline reconciliation). The runbook §4 OPEN note (whose premise no longer held) was closed citing that SHA; no code change shipped.
- Verified, no action: the parked entry's "Appendix B.15 +2 rows" cite is correct (B.15 = `image_uploads`, carries B8's `content_type`/`byte_size` SHIP rows; `market_media` is B.16).

## 3. Open questions

- **AGENTS.md §6 EVENT_TYPES prose is stale**: says "23 values" with a 7-family breakdown; live count is **24** — `moderation.blocked` landed at AUDIT-FIX-B5 (#205) and the breakdown needs "+ 1 `moderation.*`". Surfaced here, deliberately not fixed (out of this log lane's scope); a one-line fix for the next descriptive sweep or a directed rider.
- SPEC.2 §0 status line still opens "backend-complete as of the BC sweep (2026-07-01)" with the two moving numbers now re-anchored to the 1.0.17 sweep — coherent, but a future sweep may want to restructure the sentence around a single epoch.

## 4. Next session starts at

Operator relays the §6 ceilings block below to web; **web authors tracker v16 directly off it** (per the close-out kickoff). No repo action pending from this task. Unrelated queued item unchanged: ENGINE.15/16 tracker rows + ID-order errata ride the post-ENGINE.10 tracker sweep.

## 5. Context to preserve

- **Census vs. conventions**: any future ADR mint (0032) moves §0 to "30 ADRs at `0003–0032`", §22 to "31 ADRs" and a 31-row heading — 0012 stays in-flight until design.md accepts (its acceptance triggers the §22.2 minor-bump cadence, not this sweep pattern).
- Future §0 bumps start from **1.0.14 / 1.0.17**; the parked tombstone forbids re-paying the swept debt.
- Deliberately untouched: historical §0.1/§20 change-log rows (old counts are point-in-time correct); §22.4's historical 0013–0019 wording; `cpmm.md` (B8 bumped it to 2.0.0 in-PR — no sweep debt existed).
- The sweep pattern that worked: verify-live before executing (caught the 1.0.16 premise), one comprehensive changelog row per spec rather than per-task rows, and disclosed riders for same-sentence coherence rather than silent scope creep.

## 6. Post-sweep ceilings (v16 baseline — each value live-verified at origin/main `681e0b1`, 2026-07-07)

- SPEC.1: **1.0.14** (`docs/specs/SPEC.1.md` §0)
- SPEC.2: **1.0.17** (`docs/specs/SPEC.2.md` §0)
- cpmm.md: **2.0.0** (`docs/specs/cpmm.md` §0; bumped in-PR at B8 #216)
- ADR ceiling: **ADR-0031** · census **29 real files** (0001 + 0003–0011 + 0013–0031; 0002 never authored; 0012 in-flight, no file) · §0 convention **"29 ADRs at `0003–0031`"** · §22 convention **30 ADRs** (29 files + ADR-0012 in-flight; 27 accepted + 2 superseded + 1 in-flight)
- Migration head: **0023** (`drizzle/migrations/0023_positions_market_id_idx.sql`)
- EVENT_TYPES: **24** (`src/server/events/schemas.ts`: 4 `image_upload.*` + 5 `user.*` + 2 `admin.*` + 7 `market.*` + 2 `bet.*` + 1 `comment.*` + 2 `dharma.*` + 1 `moderation.*` — AGENTS.md §6 says 23, stale; see §3)
- Schema: **24 tables** in the SPEC.2 §5.1 inventory = **22 drizzle-declared** across 10 domain files (12 files in `src/db/schema/` incl. `_enums.ts` + the `index.ts` barrel) + **2 pg_cron migration-only** (`watermark_state`, `cron_alarms` — no drizzle declaration; `events` is declared but drizzle-kit-excluded via `tablesFilter`)
- origin/main head: **`681e0b1`** (= the PR #218 squash; nothing merged after, verified at log time)

## 7. Time

2026-07-07, one task across three phases: verify-live pass (STOP fired on the SPEC.2 version premise; full report relayed) → re-issued execute (six items + ruling 3, PR #218) → post-merge close-out (this log). ≈2.5 h wall including the web round-trip.
