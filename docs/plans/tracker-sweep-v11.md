# Tracker Sweep — SPEC.2 + SPEC.1 §23/§0 Reconciliation (→ 1.0.1)

## Context

Post-SYNC tracker sweep. `main` is at `b135d0d` (clean, synced; PRs #63/#64/#65 merged).
This completes the **§23 Direction-A phase-model reconciliation** that the PRECURSOR.4 v1.0
lock review *explicitly deferred to this sweep* (SPEC.2 §0.1 1.0.0 row L50; PRECURSOR.4 log
L94/L107), plus **post-lock status-prose hygiene** on both specs. It is a **PATCH-level
editorial reconciliation** — **no v1.0 architecture substance is reopened**. Both specs bump
**1.0.0 → 1.0.1**, landed as **ONE commit** on a `feat/` branch → PR (operator merges).

The external `tracker_v11.html` is **out of scope** (operator-maintained; not in repo).

**Why now:** SPEC.2 §23.1's Direction-A phase table is still the v7-era model — it lists the
removed **LIVE** + **CONCLUDE** phases, omits **SYNC** + **TESTING**, and uses **UI** for the
**VISUAL** lane. §23.2/§23.3/§23.4 carry matching stale task-IDs and a moot "SYNC.8" routing.
The two specs' top status prose still reads "draft / promotes to Approved" though both locked at
v1.0.0 on 2026-06-03.

**Review model:** doc-prose edit — **no subagent gate**; *this plan's ratification is the review*
(per kickoff). A fresh chat executes after ratification.

---

## On-disk verification for [1] (companion specs + ADRs)

Verified directly:

| File | On disk? |
|---|---|
| `docs/specs/cpmm.md` | **ABSENT** |
| `docs/specs/RANKING.md` | **ABSENT** |
| `docs/specs/PSEUDONYM.md` | **ABSENT** |
| `docs/specs/design.md` | **ABSENT** |
| `docs/adr/0003 … 0019` | present **except `0012`** (the in-flight design.md ADR — not a file) |

→ All four companion specs are genuinely **pending/absent**, so the proposed
"(pending; see §1.4)" parenthetical **matches reality**. ✓

---

## ⚠️ FLAGS — where authored text differs from disk (NOT silently adapted)

**FLAG-1 — [1] companion-line edit would DUPLICATE a clause.** The current line reads
"…the four companion specs **are authored by their gating tasks and are** **not yet on disk** as
of this rewrite…". The authored `old_str` begins at "**not yet on disk**", so the result would be
"…are authored by their gating tasks and are **authored by their gating tasks** (pending; …)" —
"authored by their gating tasks" twice. **Proposed fix:** widen `old_str` to start at "authored by
their gating tasks and are **not yet on disk**…" so the replacement reads cleanly (see [1] below).
Confirm.

**FLAG-2 — [1]/[13] "17 ADRs … committed" vs 16 files on disk.** `0012` is in-flight (no file),
so strictly **16** ADR files exist in `0003–0019`. The authored text keeps the logical count
"17 ADRs … committed at SYNC.BACKFILL" (the established framing — §0 "Gates downstream" and
Appendix A L2401 both say "17"). Applying as authored (logical-slot count); flagging only so you
can decide whether to annotate "(0012 in-flight)". No blocker.

**FLAG-3 — [13] row format mismatch (will break the table if applied verbatim).** SPEC.1's
change-log is a **6-column** table: `| Date | Version | Section | Change | Rationale | ADR |`
(header L1280; 1.0.0 row L1294). The authored [13] row uses SPEC.2's **4-column** shape
(`| 1.0.1 | 2026-06-03 | HMH | … |`). **Proposed fix:** re-cast to SPEC.1's 6 columns (see [13]
below). Confirm wording.

**FLAG-4 — [8] §13 row: redundant "at SCAFFOLD.2".** The cell already opens "SCAFFOLD.2 (…";
the authored replacement phrase re-states "at SCAFFOLD.2", yielding nested parens + a repeated
"SCAFFOLD.2". **Proposed fix:** drop the redundant re-statement (see [8] §13 below). Confirm.

**FLAG-5 — intentional residual (no action, awareness only).** The new §23.1 table [6] + §23.3
carry-forward [9] both list **F-MOD-1/2/3/4/5** (consistent with disk — `F-MOD-3.md` exists),
while §13.3's table still omits F-MOD-3 and its prose says "F-MOD-3 absent". You are re-homing the
§13.3 prose↔table↔disk reconciliation to **MAINT.15**, so §23.1 and §13.3 will *intentionally*
disagree on F-MOD-3 until MAINT.15 runs. Expected, not a defect.

**FLAG-6 — unverifiable external task-IDs (apply as authored; operator spot-checks).** These IDs
come from the external tracker and cannot be checked against the repo: `SYNC.*`, `TESTING.1–17`
(incl. `TESTING.15`), `ENGINE.0`/`ENGINE.10`, `DEBATE.9`, `DESIGN.1–8`, `UI.1–8/10–18`,
`SCAFFOLD.7`, `HARDEN.1–6`, `MAINT.15`, `LAUNCH.1–8`, "post-launch tracker". Per kickoff, applied
verbatim. (Note `SCAFFOLD.7` was historically flagged "Axiom — strike" in ADR-0007's change-log;
its reuse for "structured logging" in [8] §17 is operator's call.)

All other anchors matched the authored "expected current" **exactly** — confirmed below.

---

## FILE 1 — `docs/specs/SPEC.2.md`

### [1] Top status blockquote — line 3 (full-line replace)
**old_str** (verbatim L3):
```
> **Status:** v0.4.0-draft · last absorption 2026-06-01 · §0–§23 + Appendices A–B all drafted at v0.3-draft body level · ADR-0017/0018/0019 folded + ADR-0009 superseded-by-0017 (SYNC.7) · **reply-as-bet model adopted** (every comment rides a bet; friendly-fire + `friendly_fire_events` + `stake_at_post_time` removed entirely; Support/Counter are read-time aggregates over reply-bets) consistent with SPEC.1 v1.9.0-draft · K_eff dashboard struck per PRECURSOR.2-B D4 (no live in-product surface; K_eff(t) derived post-hoc from 2026-11-06 public dataset per SPEC.1 G3 + §12.2)
```
**new_str:**
```
> **Status:** 1.0.1 · v1.0 locked at PRECURSOR.4 (2026-06-03, fresh-session writer/reviewer review per CLAUDE.md); §23 + §0 reconciled to the tracker-v11 phase model and post-lock status-prose hygiene applied at the post-SYNC tracker sweep (1.0.1) · §0–§23 + Appendices A–B complete · ADR-0017/0018/0019 folded + ADR-0009 superseded-by-0017 · **reply-as-bet model** (every comment rides a bet; friendly-fire + `friendly_fire_events` + `stake_at_post_time` removed entirely; Support/Counter are read-time aggregates over reply-bets) consistent with SPEC.1 (v1.0.x) · K_eff dashboard struck per PRECURSOR.2-B D4 (no live in-product surface; K_eff(t) derived post-hoc from the 2026-11-06 public dataset per SPEC.1 G3 + §12.2)
```

### [1b] Companion-files line — line 5 (sub-string replace, **per FLAG-1**)
**old_str** (widened to avoid duplication):
```
authored by their gating tasks and are **not yet on disk** as of this rewrite (see §1.4); 17 ADRs (`docs/adr/0003–0019`), ADR files committed at SYNC.BACKFILL (only `0001` on disk today)
```
**new_str:**
```
authored by their gating tasks (pending; see §1.4); 17 ADRs at `docs/adr/0003–0019` committed at SYNC.BACKFILL
```

### [2] §0 metadata — Version cell (L14)
**old_str:** `| **Version** | 1.0.0 |`
**new_str:** `| **Version** | 1.0.1 |`
(Date row stays `| **Date** | 2026-06-03 |`.)

### [3] §0 "Gates downstream" row — surgical (L19)
Exact current cell (for your screenshot confirm):
> `17 ADRs (`ADR-0003` through `ADR-0019`; 0003–0016 = SPEC.3–7, SPEC.9–13, SPEC.14–17; ADR-0017 = SYNC.4; ADR-0018/0019 = SYNC.5) + all `SCAFFOLD.*`, `ENGINE.*`, `DEBATE.*`, `UI.*`, `HARDEN.*` tracker tasks`

**old_str:** `` `DEBATE.*`, `UI.*`, `HARDEN.*` tracker tasks ``
**new_str:** `` `DEBATE.*`, `VISUAL.*`, `TESTING.*`, `HARDEN.*` tracker tasks ``
(unique to this row; leaves the ADR-range clause untouched.)

### [4] §0.1 change log — append new row after the 1.0.0 row (L50)
Insertion anchor = end of L50 (unique tail "…scoping note to this effect. |"), before the blank
line + `---`. Append exactly one new line:
```
| 1.0.1 | 2026-06-03 | HMH | **Post-SYNC tracker sweep — §23 + §0 reconciled to tracker v11; post-lock status-prose hygiene.** No v1.0 substance reopened (patch-level editorial reconciliation completing the §23 Direction-A item the PRECURSOR.4 lock explicitly deferred to this sweep). **§23.1 Direction A** phase table rebuilt to the v11 phase model: added **SYNC** + **TESTING** rows; removed **LIVE** + **CONCLUDE** (relocated to the separate post-launch tracker per SYNC.6 — not lost); **UI → VISUAL** (DESIGN ∥ ENGINE + UI ∥ DEBATE lanes); ENGINE/DEBATE task-ID lists corrected (ENGINE.1→0; DEBATE.6 removed, DEBATE.9 added); HARDEN row corrected to HARDEN.1–6; task column rendered as ID-ranges and the running total re-pointed to the tracker (the census owner per §23.4); hard F-* file counts removed from the phase rows and re-pointed to §13.3. **§23.2 Direction B** stale task refs reconciled to v11 — `SCAFFOLD.4` (moderation→Upstash), `SCAFFOLD.5` (Upstash→Sentry), `SCAFFOLD.6` (conflated→PostHog/flags), `SCAFFOLD.18` (manifest→CI); `HARDEN.6/7/10` → the real HARDEN.1–6 set + TESTING; `CONCLUDE.*`/`LIVE.*` consumers re-pointed to build-phase tasks with post-launch build noted out-of-tracker; the "40 F-*" de-numbered to §13.3. **§23.3** the four 3-C tracker-description drifts (DEBATE.4 / SCAFFOLD.3 / SCAFFOLD.13 / SCAFFOLD.4) struck (already current in the v11 tracker); the moot "SYNC.8" routing removed; the ADR-0017-body row marked **resolved by the P1 patch (#65)**; DEBATE.6 marked removed; the friendly-fire physical-drop + `comments.bet_id`/`stake_at_post_time` retained as DEBATE.8/9-sequenced carry-forwards; the **§13.3 F-* count reconciliation re-homed to MAINT.15**. **§23.4** footer "ADRs consumed … 0003–0016" → 0003–0019. **§0** "Gates downstream" `UI.*` → `VISUAL.*`, `TESTING.*` added; top status blockquote version + stale prose reconciled to the locked state. **Not changed:** §13.3 itself (count re-homed to MAINT.15; its existing drift-note left in place); all v1.0-locked architecture substance; the external `tracker_v11.html`. Paired SPEC.1 → 1.0.1 (status-prose hygiene only). |
```

### [5] §23.1 intro — first sentence only (L2183)
**old_str:** `Tracker organized in eleven phases (per the tracker HTML's grouping).`
**new_str:** `Tracker organized in the build-to-launch phases (per the tracker's grouping).`
(Leave the rest of L2183 — "Each phase row names…ADR-0012 acceptance gates any task in the phase." — unchanged.)

### [6] §23.1 phase table — replace the whole table (header L2185 → CONCLUDE row L2196)
Replace lines **2185–2196 inclusive** (the `| Phase | Tasks (count) | … |` header + its 10 v7 rows,
incl. LIVE + CONCLUDE) with this table (header column "Tasks (count)" → "Tasks"):
```
| Phase | Tasks | SPEC.2 sections consumed | ADRs consumed | F-* files gated | Design.md gate |
|---|---|---|---|---|---|
| **FOUND** | FOUND.1–8 | §0 | none | none | No |
| **SPEC + PRECURSOR** | SPEC.1–2 + SPEC.3–7 + SPEC.9–17 + PRECURSOR.1–4 (SPEC.8 → PRECURSOR.4; PRECURSOR.5 dissolved into SYNC.8) | §0–§23 (this phase authors them) | ADR-0003–0016 (minted here; 0017/0018/0019 minted under SYNC — §22.1) | none | No (PRECURSOR.4 lock review accepts ADR-0012 in-flight per §22.2) |
| **SCAFFOLD** | SCAFFOLD.1–19 | §0–§23 (consumes locked v1.0 substance) | ADR-0003 + 0005 + 0006 + 0008 + 0011 + 0016; ADR-0012 for design-dependent slots only | F-* skeleton mint at SCAFFOLD.2 (set per §13.3); F-AUTH-* substance at SCAFFOLD.3; F-MOD bundle at SCAFFOLD.16; image-upload pipeline at SCAFFOLD.15; flag system at SCAFFOLD.6 | Partial — design-independent SCAFFOLD tasks proceed in parallel; UI-shaping slots gate on ADR-0012 |
| **SYNC** (doc/repo reconciliation; closed pre-lock) | SYNC.0–10 (incl. SYNC.3.5 / SYNC.8.5 / SYNC.BACKFILL) | §0–§23 (the SYNC.7 rebuild re-authored SPEC.1/SPEC.2; reconciles, does not gate new substance) | mints ADR-0017 (SYNC.4) + ADR-0018/0019 (SYNC.5); ADR-0009 superseded | none | No |
| **ENGINE** | ENGINE.0 + ENGINE.2–12 (ENGINE.1 → ENGINE.0) | §3 + §6 + §7 + §9 + §11 + §14 + §15 | ADR-0005 + 0008 + 0013 + 0014 + 0015 + 0016 | F-BET-1/2/3/4/5/6/7/9/10 at ENGINE.7–8; F-RESOLVE-1/2/3 + F-DEBATE-3 at ENGINE.9 | No |
| **DEBATE** | DEBATE.1–5 + DEBATE.7–9 (DEBATE.6 removed — friendly-fire vote retired under reply-as-bet; see §23.3) | §3 + §8 + §9 + §10 + §11 + §13 + §14 + §15 | ADR-0004 + 0014 + 0015 + 0017 + 0018 | F-COMMENT-1/2/3 at DEBATE.2; F-DEBATE-1/4 at DEBATE.4; F-DEBATE-2 at DEBATE.5; F-MOD-1/2/3/4/5 at DEBATE.7; DEBATE.9 drops vestigial `friendly_fire_events` | Yes — DEBATE.4/5 consume design.md |
| **VISUAL** (DESIGN ∥ ENGINE · UI ∥ DEBATE) | DESIGN.1–8 + UI.1–8/10–18 (UI.9 absent) | §4 + §13 + §17 + §18 | ADR-0003 + 0004 + 0010 + ADR-0012 (DESIGN.8 derives ADR-0012) | F-AUTH-* user-facing pages; F-ADMIN-1/2/3/4/5 at UI.6; debate-view + market-detail UIs | Yes (load-bearing) — UI sub-lane consumes design.md; DESIGN sub-lane authors it |
| **TESTING** (∥ HARDEN; against live staging) | TESTING.1–17 | §3 + §6 + §9 + §13 + §14 + §17 | ADR-0013 + 0015 (+ 0005/0008 for journey/integration tests) | exercises the F-* Acceptance blocks via E2E/integration specs (set per §13.3) | Partial — UI-surface E2E (TESTING.4/5) gates on the design-consuming UI; engine/concurrency/integration tests are design-independent |
| **HARDEN** (experiment-grade; lightweight; ∥ TESTING) | HARDEN.1–6 | §9 + §10 + §11 + §17 + §18 (the §19/§20/§21 dataset/freeze/runbook consumers moved to the post-launch tracker) | ADR-0007 + 0010 + 0014 + 0015 | F-* Acceptance-block cross-reference CI lint (HARDEN-phase; set per §13.3) | No / Partial — HARDEN.1–6 are design-independent |
| **LAUNCH** (terminal) | LAUNCH.1–8 | §0 + §17 + §19 + §20 + §22 | ADR-0003 + 0006 | dataset manifest endpoint (F-DATASET-1 status re-homed to MAINT.15) | No |
```

### [7] §23.1 post-table paragraph — replace (L2198)
**old_str:**
```
The phase column counts **104 tasks total** (sum of "Tasks (count)" column). The two phase entries with explicit "design.md gate: Yes" or "Yes (load-bearing)" are **DEBATE** and **UI**; they collectively cover the user-facing surface that consumes the design system. All other phases are design-independent or have only partial / non-blocking dependence.
```
**new_str:**
```
DEBATE and VISUAL are the design-gated phases (TESTING is partially gated, on the design-consuming UI surfaces); all other phases are design-independent or only partially / non-blocking. Per-phase task census and the running total are the tracker's to own (`tracker_v11.html`, §23.4) — §23.1 names the gating *relationships*, not the count. **LIVE (experiment window) and CONCLUDE (freeze + dataset + Devcon) are not phases of this build-to-launch tracker — they continue in a separate post-launch tracker per SYNC.6; their absence here is intentional, not lost.**
```
**LEAVE UNCHANGED** the next paragraph (L2200, the SCAFFOLD-phase parallel-execution clearance /
"12 of 19").

### [8] §23.2 Direction-B — 12 full-row replacements (leave all other rows as-is)
Each verified against disk; replace the full row line:

- **§6** (L2212)
  old: `| **§6** | Append-only enforcement | SCAFFOLD.2 (trigger SQL migration); HARDEN.6 (append-only test floor, twelve-table protected set) |`
  new: `| **§6** | Append-only enforcement | SCAFFOLD.2 (trigger SQL migration); TESTING.* (append-only test-floor coverage) |`
- **§9** (L2215)
  old: `| **§9** | Concurrency & transactions | ENGINE.7 (bet transaction wrapper); HARDEN.6 (concurrency stress tests) |`
  new: `| **§9** | Concurrency & transactions | ENGINE.7 (bet transaction wrapper); TESTING.15 (concurrency/race tests) + ENGINE.10 (full-invariant stress test) |`
- **§10** (L2216)
  old: `| **§10** | Pre-commit moderation | SCAFFOLD.4 (moderation pipeline); DEBATE.7 (F-MOD-* implementation); HARDEN.5 (Track A degrade evaluation) |`
  new: `| **§10** | Pre-commit moderation | SCAFFOLD.16 (moderation vendor onboarding); DEBATE.7 (F-MOD-* wiring); HARDEN.5 (moderation-threshold tuning, part of the number-tuning pass) |`
- **§11** (L2217)
  old: `| **§11** | Rate-limit + idempotency | SCAFFOLD.5 (Upstash wiring); ENGINE.* + DEBATE.* (handler stack step 2-4); HARDEN.6 (numeric value tuning) |`
  new: `| **§11** | Rate-limit + idempotency | SCAFFOLD.4 (Upstash rate-limit + idempotency wiring); ENGINE.* + DEBATE.* (handler stack); HARDEN.3 (threshold verification) + HARDEN.5 (numeric tuning) |`
- **§12** (L2218)
  old: `| **§12** | File storage | SCAFFOLD.15 (R2 + signed URLs + orphan sweep); UI.* (image-upload affordances); HARDEN.10 (R2-orphan-sweep manual runbook) |`
  new: `| **§12** | File storage | SCAFFOLD.15 (R2 + signed URLs + orphan sweep); VISUAL/UI.* (image-upload affordances); HARDEN.4 (R2-orphan operational check, part of the ops checklist) |`
- **§13** (L2219) — **per FLAG-4, redundant "at SCAFFOLD.2" dropped**
  old: `| **§13** | Flow contract template | SCAFFOLD.2 (skeleton mint of 40 F-* files); every gating implementation task (per §13.4 cadence) |`
  new: `| **§13** | Flow contract template | SCAFFOLD.2 (skeleton mint of the F-* flow set, count per §13.3); every gating implementation task (per §13.4 cadence) |`
- **§17** (L2223)
  old: `| **§17** | Observability | SCAFFOLD.6 (Sentry + PostHog + flag system wiring); HARDEN.7 (alarm threshold tuning); HARDEN.10 (per-alarm runbooks) |`
  new: `| **§17** | Observability | SCAFFOLD.5 + SCAFFOLD.6 + SCAFFOLD.7 (Sentry / PostHog+flags / structured logging); HARDEN.4 (observability ops checklist); the full per-alarm runbook set is post-launch (separate tracker) |`
- **§18** (L2224)
  old: `| **§18** | Sybil & security | SCAFFOLD.3 (Turnstile wiring); HARDEN.* (no-body-logging CI lint); HARDEN.10 (`BREAK_GLASS.md`) |`
  new: `| **§18** | Sybil & security | SCAFFOLD.3 (Turnstile wiring); HARDEN.1 (sybil spot-check); HARDEN.4 (`BREAK_GLASS` note + secrets/CSRF hygiene, ops checklist) |`
- **§19** (L2225)
  old: `| **§19** | Public dataset export | SCAFFOLD.18 (manifest endpoint); HARDEN.10 (dataset-build pipeline runbook); CONCLUDE.* (the actual build) |`
  new: `| **§19** | Public dataset export | dataset manifest endpoint (F-DATASET-1; mint-or-strike re-homed to MAINT.15); the dataset build + release is post-launch (separate tracker) |`
- **§20** (L2226)
  old: `| **§20** | Conclusion-event freeze | SCAFFOLD.2 (`system_state` schema + trigger SQL); HARDEN.10 (Path-A `pg_cron` job + Path-B manual runbook); CONCLUDE.1 (the freeze itself) |`
  new: `| **§20** | Conclusion-event freeze | SCAFFOLD.2 (`system_state` schema + freeze trigger SQL); the freeze itself + freeze runbook are post-launch (separate tracker) |`
- **§21** (L2227)
  old: `| **§21** | Operational runbook pointers | HARDEN.10 (substance authoring of all 20 runbook slots) |`
  new: `| **§21** | Operational runbook pointers | HARDEN.4 (experiment-grade ops checklist + break-glass note); the full operational runbook set is post-launch (separate tracker) |`
- **§23** (L2229)
  old: `| **§23** | Tracker task gating map | PRECURSOR.4 lock review (the §23 trace IS the review surface); HARDEN.* (re-verification at each gate change) |`
  new: `| **§23** | Tracker task gating map | PRECURSOR.4 lock review (the §23 trace IS the review surface); subsequent re-verification at each tracker sweep / gate change |`

### [9] §23.3 — replace whole subsection (heading L2233 → just before `### §23.4` L2255)
Replace **lines 2233–2253 inclusive** (heading + intro para + table 1 + the "SYNC.7 reply-as-bet
fold" para + table 2) with:
```
### §23.3 Tracker reconciliation — resolved items + carry-forwards

The PRECURSOR.4 lock review and this tracker sweep close the §23.3 drifts the SYNC.7 fold surfaced. Routing that pointed at "SYNC.8" is moot (SYNC closed before the lock).

**Resolved.**
- The four 3-C tracker-description drifts (DEBATE.4, SCAFFOLD.3, SCAFFOLD.13, SCAFFOLD.4) — the v11 tracker rebuild (SYNC.6) already carries descriptions consistent with current SPEC.1 + SPEC.2 substance.
- DEBATE.6 — removed from the v11 tracker (its friendly-fire scope was retired under reply-as-bet); DEBATE.9 (drop vestigial `friendly_fire_events`) stands in its place.
- ADR-0017 body text ("friendly-fire stays display-only") — reconciled by the in-place P1 patch record (PR #65, PRECURSOR.4 lock review).

**Carry-forwards (specs-ahead-of-code; tracker-sequenced engineering, not this pass).** The v1.0 schema still carries artifacts the specs now omit; the drops are sequenced work:

| Item | Drop / change | Tracker home |
|---|---|---|
| `friendly_fire_events` table + Bucket-B trigger + `castFriendlyFire`/`clearFriendlyFire` Server Actions | forward migration drops table + trigger; delete the two Server Actions | DEBATE.9 |
| `comments.bet_id` nullable → NOT NULL; standalone comment-without-bet path → bet-borne | schema migration (after cutover) + comment-write-path rework | DEBATE.2 / DEBATE.8 |
| `comments.stake_at_post_time` | forward column-drop migration | DEBATE.8 |
| §13.3 F-* inventory reconciliation — prose↔table↔disk (40 on disk / "37" prose / 36 table), `F-MOD-3` in/out, `F-DATASET-1` mint-or-strike, delete `F-COMMENT-6/7/8.md` | doc + flow-file truth-up, sequenced with DEBATE.9's friendly-fire teardown | MAINT.15 |
```

### [10] §23.4 — closing "ADRs consumed by §23" sentence (L2269)
**old_str:** `ADR-0003 through ADR-0016 in their phase-distributed gating relationships per §23.1.`
**new_str:** `ADR-0003 through ADR-0019 in their phase-distributed gating relationships per §23.1 (ADR-0017/0018 consumed by the DEBATE row; 0017/0018/0019 minted under SYNC).`
(Leaves the "ADR-0001 + ADR-0002 (out of inventory per §22.1 …)" prefix untouched.)

---

## FILE 2 — `docs/specs/SPEC.1.md` (status-prose hygiene only; no substance)

### [11] §0 Version (L15)
**old_str:** `- **Version:** 1.0.0 (semver; bump major on invariant changes)`
**new_str:** `- **Version:** 1.0.1 (semver; bump major on invariant changes)`
(Last-updated stays `- **Last updated:** 2026-06-03`.)

### [12] §0 status prose — two minimal edits

**Status line (L18):**
old: `- **Status:** Working draft — folds ADR-0017 (ranking model, supersedes ADR-0009), ADR-0018 (Dharma issuance + two-floor minimum bet), and ADR-0019 (RLS out of scope) on top of the v1.8.0 anchor. Promotes to Approved on v1.0.0 lock at PRECURSOR.4 (fresh-session writer/reviewer review, NOT the SYNC.7 author, per CLAUDE.md).`
new: `- **Status:** Approved — locked at v1.0.0 by PRECURSOR.4 (fresh-session writer/reviewer review, NOT the SYNC.7 author, per CLAUDE.md; completed 2026-06-03); subsequent revisions bump patch/minor. Folds ADR-0017 (ranking model, supersedes ADR-0009), ADR-0018 (Dharma issuance + two-floor minimum bet), and ADR-0019 (RLS out of scope) on top of the v1.8.0 anchor.`

**Anchor lock line (L23):**
old: `- **Anchor lock:** v1.8.0 was locked as canonical anchor on 2026-05-08 in PRECURSOR.2. This v1.9.0-draft is the SYNC.7 rewrite that folds ADR-0017 / ADR-0018 / ADR-0019 and resolves drift signal D11 (stale last-updated date). Supersedes prior working copies. Promotes to `v1.0` at PRECURSOR.4 fresh-session lock review (paired with the SPEC.2 v1.0 promotion).`
new: `- **Anchor lock:** v1.8.0 was locked as canonical anchor on 2026-05-08 in PRECURSOR.2. The v1.9.0-draft SYNC.7 rewrite folded ADR-0017 / ADR-0018 / ADR-0019 and resolved drift signal D11 (stale last-updated date), superseding prior working copies. Promoted to `v1.0` at PRECURSOR.4 fresh-session lock review on 2026-06-03 (paired with the SPEC.2 v1.0 promotion).`

Touch nothing else in §0.

### [13] §0.1 change log — append after the 1.0.0 row (L1294), **re-cast to SPEC.1's 6 columns (per FLAG-3)**
SPEC.1 columns = `| Date | Version | Section | Change | Rationale | ADR |`. Insertion anchor = end of
L1294 (unique tail "…align error-code references to the §15.4 38-code catalogue. | — |"), before the
blank line + `---` + `## §21`. Append exactly one new line:
```
| 2026-06-03 | 1.0.1 | §0 | **Post-lock status-prose hygiene (paired with SPEC.2 → 1.0.1).** No v1.0 substance reopened. §0 version → 1.0.1; status prose reconciled to the locked state ("Working draft … promotes to Approved at PRECURSOR.4" → Approved/locked, PRECURSOR.4 completed 2026-06-03; the "v1.9.0-draft … promotes to v1.0" anchor-lock note past-tensed). | SPEC.1 carries no tracker-gating / phase-model content, so the SPEC.2 §23 tracker-v11 reconciliation requires no SPEC.1 change beyond this editorial hygiene. | — |
```
(If you prefer the authored 4-column wording verbatim instead, say so — but it will break the table render.)

---

## Verification (post-edit, before PR)

This is doc-only; the gate is structural integrity, not the test suites.

1. **Grep guards (must return EMPTY):**
   - `grep -nE "v0\.4\.0-draft" docs/specs/SPEC.2.md` — status blockquote no longer draft.
   - `grep -n "eleven phases" docs/specs/SPEC.2.md` — intro reworded.
   - `grep -nE "^\| \*\*LIVE\*\*|^\| \*\*CONCLUDE\*\*" docs/specs/SPEC.2.md` — phases removed from §23.1.
   - `grep -n "104 tasks total" docs/specs/SPEC.2.md` — old census paragraph gone.
   - `grep -n "drift surfaced for SYNC.8" docs/specs/SPEC.2.md` — old §23.3 heading gone.
   - `grep -n "through ADR-0016 in their phase" docs/specs/SPEC.2.md` — §23.4 footer updated.
   - `grep -n "Working draft" docs/specs/SPEC.1.md` — SPEC.1 status reworded.
2. **Grep presence (must return a hit):**
   - `grep -n "| **VISUAL**" docs/specs/SPEC.2.md` and `"| **TESTING**"` and `"| **SYNC**"` — new phase rows present.
   - `grep -n "§23.3 Tracker reconciliation — resolved items" docs/specs/SPEC.2.md` — new §23.3 heading.
   - `grep -n "^| 1.0.1 |" docs/specs/SPEC.2.md` and `grep -n "| 2026-06-03 | 1.0.1 |" docs/specs/SPEC.1.md` — change-log rows landed in each spec's own column order.
   - `grep -cE "^\| \*\*Version\*\* \| 1\.0\.1 \|" docs/specs/SPEC.2.md` = 1.
3. **Table-render sanity:** open both §0.1 tables + §23.1/§23.2/§23.3 tables in a Markdown
   previewer (or `grep -c '^|' ` column-count spot check) — confirm no row has the wrong pipe count
   (esp. the SPEC.1 6-column append).
4. **`just verify`** — typecheck → biome → build. (No code touched; expected clean. Biome may
   format-touch the `.md`; if so, re-stage. Not a critical-path PR → no `pnpm test:*`.)
5. **Diff scope check:** `git diff --stat` shows exactly two files (`SPEC.1.md`, `SPEC.2.md`),
   no third file, no migration, no `src/`.

## Execution notes
- **One commit**, `feat/` branch (e.g. `feat/tracker-sweep-spec-reconcile`), PR, **operator merges**
  (branch protection; squash). Conventional message via `/tmp/commit-msg.txt`
  (e.g. `docs(spec): tracker sweep — SPEC.2 §23/§0 + SPEC.1 status reconciled to v11 (1.0.1)`).
  No `Co-authored-by` trailer.
- **No ADR** (CLAUDE.md §5.12): no architectural decision changes — pure editorial reconciliation.
- **No subagent gate** (doc-prose; per kickoff). **Plan-mode session log** at
  `docs/logs/<TASK-ID>.md` per CLAUDE.md §5.9 before `/clear`.
- **Not in scope / deferred (do not touch this pass):** the external `tracker_v11.html`; §13.3
  prose↔table↔disk reconciliation + `F-MOD-3`/`F-DATASET-1`/`F-COMMENT-6/7/8.md` truth-up
  (→ MAINT.15); the schema vestigials (→ DEBATE.8/9).
```
