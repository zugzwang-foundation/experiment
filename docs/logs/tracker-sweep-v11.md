# tracker-sweep-v11 — SPEC.2 §23/§0 + SPEC.1 status reconciled to tracker v11 (→ 1.0.1)

**Status:** Closed 2026-06-03
**Feat branch:** `feat/tracker-sweep-spec-reconcile` (PR **#66**) — the spec edits
**Chore branch:** `chore/tracker-sweep-v11-log` (this PR) — plan mirror + this log
**Predecessor:** PRECURSOR.4 v1.0 lock (`docs/logs/PRECURSOR.4.md`, `main` at `b135d0d`)
**Unblocks:** MAINT.15 / MAINT.16 (doc carry-forwards, when sequenced); does not gate ENGINE.0 (the gate-released critical-path successor per PRECURSOR.4)

---

## What landed (CLAUDE.md §5.9 field 1)

Two PRs, mirroring the PRECURSOR.4 close pattern (edit PR + separate log PR).

**Feat PR #66 — `feat/tracker-sweep-spec-reconcile` (branched from `main` @ `b135d0d`)** — single signed commit `2d51426`, exactly two files:

| File | State | Notes |
|---|---|---|
| `docs/specs/SPEC.2.md` | Modified | §0 status blockquote + Version 1.0.0→1.0.1 + Gates `UI.*`→`VISUAL.*` +`TESTING.*`; §0.1 1.0.1 change-log row; §23.1 phase table rebuilt to v11; §23.1 intro + post-table paragraph; 12× §23.2 Direction-B rows; §23.3 rewritten (resolved + carry-forwards, incl. MAINT.16 row); §23.4 footer + SoT row |
| `docs/specs/SPEC.1.md` | Modified | §0 Version 1.0.0→1.0.1; §0 Status + Anchor-lock prose past-tensed to the completed lock; paired 1.0.1 change-log row (6-column format) |

**This chore PR — `chore/tracker-sweep-v11-log` (branched from `main` @ `b135d0d`)**:

| File | State | Notes |
|---|---|---|
| `docs/plans/tracker-sweep-v11.md` | Created | Ratified plan body, mirrored from `~/.claude/plans/` per CLAUDE.md §5.1 |
| `docs/logs/tracker-sweep-v11.md` | This file | Written before close per §5.9 |

**External (operator-applied to project-knowledge HTML, out of repo scope):** `tracker_v11.html` is the canonical census/status surface; this sweep reconciled the in-repo §23 *gating-relationship contract* to it. The HARDEN task-ID renumber semantics that §23.2 now states canonically (HARDEN.1–6; HARDEN.7/.10 phantom) are operator's to confirm against the tracker.

Test state: N/A — no `src/`, no test changes. Gate = `just verify` (typecheck ✓ · biome ✓ · build ✓ with `ZUGZWANG_ENV` set).

---

## Decisions made (CLAUDE.md §5.9 field 2)

### Plan-ratification resolutions (the doc-prose review surface — no subagent gate, per kickoff)

The plan flagged six deviations between the authored text and on-disk reality; operator ratification locked the fixes:

| FLAG | Topic | Resolution (ratified) |
|---|---|---|
| FLAG-1 | [1b] companion-line edit would duplicate "authored by their gating tasks" | Widened `old_str` to start at that clause; replacement reads clean |
| FLAG-2 | "17 ADRs … committed" vs 16 files on disk (`0012` in-flight) | Kept logical-slot count "17" (established framing); no annotation |
| FLAG-3 | [13] authored as SPEC.2's 4-column row; SPEC.1 change-log is 6-column | Re-cast to SPEC.1's `Date \| Version \| Section \| Change \| Rationale \| ADR` |
| FLAG-4 | [8] §13 row re-stated "at SCAFFOLD.2" inside a cell already opening with it | Dropped the redundancy |
| FLAG-5 | §23.1/§23.3 list F-MOD-3 (on disk); §13.3 omits it | Intentional residual until MAINT.15 — no action |
| FLAG-6 | External task-IDs unverifiable against repo | Applied as authored; operator spot-checks |

### Web-review scope call — HARDEN residual → MAINT.16

Execute kickoff fired only on the "re-home to MAINT.16" branch and added two anchors beyond the plan's [1]–[13]:
- **[14]** — a fifth §23.3 carry-forward row: the spec-wide v7 HARDEN task-ID renumber (~30 refs across §8.10/§10/§11/§12/§17–§21 + Appendix A) re-homed to **MAINT.16**, distinct from the §13.3 F-* truth-up (**MAINT.15**).
- **[15]** — the matching clause folded into the §0.1 1.0.1 change-log row's "Not changed:" list.

This sweep states the canonical v11 HARDEN mapping in §23.2 only; spec-wide propagation is deliberately deferred (MAINT.16) to keep this pass patch-level editorial.

### Other calls
- **No "Generated with Claude Code" footer** in the PR body — foundation single-author discipline; a footer can leak into the squash-merge body (AGENTS.md §10).
- **Two-PR close** (feat edits + chore log/plan) per kickoff + PRECURSOR.4 precedent; the log is kept out of the feat commit.

### Reviewer-call summary
| Call | Outcome |
|---|---|
| code-reviewer / db-migration-reviewer / security-auditor / test-writer | **NOT invoked** — doc-prose, non-critical-path; kickoff explicitly set "no subagent gate — plan ratification is the review" (CLAUDE.md §5.11 "when NOT to invoke") |

### Surprises caught + fixed in-session (CLAUDE.md §5.10 working as designed)

One SURPRISE surfaced at post-edit verification. Full chain preserved:

1. **Plan [9] renamed §23.3** from "Tracker description drift surfaced for SYNC.8" → "Tracker reconciliation — resolved items + carry-forwards".
2. **Grep-guard G5** (`grep -rn "drift surfaced for SYNC.8" docs/specs/`) was specified to return EMPTY, but returned a hit — the **§23.4 "Single source of truth" table** carried a row labelling §23.3's concern with its *old* title.
3. **Root cause:** the plan's [9]/[10] anchors did not cover the §23.4 SoT row that mirrors the §23.3 title; the rename orphaned it.
4. **Fix (in-scope):** retitled the SoT row to `| Tracker reconciliation — resolved items + carry-forwards | §23.3 |`. This is orphan cleanup of *my own* change (CLAUDE.md §5.3) and is exactly what the plan's G5 guard exists to force — not scope creep.
5. **Re-ran G5 → empty.** Recorded in the PR body and in the pre-PR audit below.

### Pre-PR self-audit (§5.10)
| Anchor | Result |
|---|---|
| [1]/[1b]/[2]/[3] §0 status, version, gates | PASS |
| [4]+[15] §0.1 1.0.1 row (MAINT.16 clause folded) | PASS |
| [5]/[6]/[7] §23.1 intro, phase table (10 rows), post-table paragraph | PASS |
| [8] §23.2 (12 rows; §23.2 still 22 section rows total — none lost) | PASS |
| [9]+[14] §23.3 rewrite (+ MAINT.16 carry-forward row) | PASS |
| [10] §23.4 footer ADR range 0003–0019 | PASS |
| §23.4 SoT-row retitle (in-session orphan fix) | PASS |
| [11]/[12]/[13] SPEC.1 version + status prose + 6-col change-log row | PASS |
| Grep guards (EMPTY + PRESENCE sets) | PASS after orphan fix |
| `git diff --stat` = exactly SPEC.1.md + SPEC.2.md | PASS |

Zero FAIL. One SURPRISE caught + fixed in-session.

---

## Open questions / non-blocking items (CLAUDE.md §5.9 field 3)

- **External `tracker_v11.html`** still needs the operator-side v11 phase-model + HARDEN-renumber reflected (the in-repo §23 contract is now aligned; the HTML census is operator-maintained).
- **Candidate AGENTS.md gotcha (raised, not absorbed — out of scope for a doc sweep):** local `next build` / `just verify` fails with `getRedisKey: invalid ZUGZWANG_ENV ("unknown")` unless `ZUGZWANG_ENV` ∈ `{prod, staging, preview}`. Confirmed env-only (green with `ZUGZWANG_ENV=preview`). Worth an AGENTS.md § "Gotchas" line in a future non-doc PR.

---

## Next session starts at (CLAUDE.md §5.9 field 4)

1. **Operator merges PR #66** (feat) + this chore PR (squash; branch protection).
2. **Critical-path successor: ENGINE.0** ("Extend `EVENT_TYPES` + `AggregateType`") — gate-released by the PRECURSOR.4 lock, unaffected by this sweep; full plan-mode-then-execute ritual (it is bet-engine substrate). Carry the F.2.1 downstream flag (OAuth/OTP payload `name`/`image` strip alignment to §19.4.1) per `docs/logs/PRECURSOR.4.md` L122.
3. **Doc follow-ons when sequenced:** MAINT.15 (§13.3 F-* prose↔table↔disk truth-up + F-MOD-3 / F-DATASET-1 / F-COMMENT-6/7/8.md), MAINT.16 (spec-wide HARDEN renumber). Engineering follow-ons: DEBATE.8/9 (schema vestigials).

---

## Context to preserve (CLAUDE.md §5.9 field 5)

- **Canonical SHA** = the squash-merge of PR #66 on `main` (branch SHA `2d51426` is ephemeral; quote the merge SHA after merge).
- **SPEC.2 §23 is now v11-aligned**: phase rows = FOUND, SPEC+PRECURSOR, SCAFFOLD, SYNC, ENGINE, DEBATE, VISUAL, TESTING, HARDEN, LAUNCH (LIVE + CONCLUDE relocated to the post-launch tracker — intentional, not lost).
- **Intentional residual:** §13.3 prose still says "37 active F-*" and omits F-MOD-3; §23.1/§23.3 list F-MOD-3 (matches disk). The prose↔table↔disk reconciliation is MAINT.15 — §23.1 and §13.3 *will* disagree on F-MOD-3 until then.
- **Carry-forward homes:** MAINT.15 (F-* count), MAINT.16 (HARDEN renumber), DEBATE.8/9 (`friendly_fire_events` / `comments.bet_id` NOT NULL / `stake_at_post_time`).
- **Local build gotcha:** set `ZUGZWANG_ENV=preview` (or `prod`/`staging`) before `next build` / `just verify`, else page-data collection for `/admin/login` fails on the env validation. Not a regression.

---

## Time (CLAUDE.md §5.9 field 6 — optional)

Same-day 2026-06-03: recon (read-only) → plan-mode → ratification → execute. Execute pass (branch + 16 anchors + verification + orphan fix + feat PR + chore PR): contiguous single session.

---

## CLAUDE.md / AGENTS.md / workflow / tracker amendments

Per CLAUDE.md §7 closing ritual:
- **CLAUDE.md** — no amendment (no invariant / critical-path / workflow change).
- **AGENTS.md** — no amendment in this PR; the `ZUGZWANG_ENV` local-build gotcha is *raised* as a future §"Gotchas" candidate (out of scope for a doc-prose sweep — see Open questions).
- **Workflow** — no amendment.
- **Tracker** — in-repo §23 contract reconciled (this PR's purpose); external `tracker_v11.html` is operator-applied.
- **No ADR** — pure editorial reconciliation, no architectural decision.

---

## Single source of truth — files touched

| File | PR | State |
|---|---|---|
| `docs/specs/SPEC.2.md` | #66 | Modified (§0 + §23) |
| `docs/specs/SPEC.1.md` | #66 | Modified (§0 status prose) |
| `docs/plans/tracker-sweep-v11.md` | this chore PR | Created (plan mirror) |
| `docs/logs/tracker-sweep-v11.md` | this chore PR | Created (this log) |
| `tracker_v11.html` | operator | External project-knowledge HTML |
