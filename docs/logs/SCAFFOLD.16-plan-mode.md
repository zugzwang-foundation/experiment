# SCAFFOLD.16 — plan-mode close-out

> Plan-mode CC chat 2026-05-25 (read inputs + ack) → 2026-05-26
> (Phase 1 Q-verdicts + Phase 2 /plan opening greps + plan-body
> drafting + commits + push). Branch `plan/scaffold-16` cut from
> `origin/main` HEAD `6a6b04b` (post-SCAFFOLD.17-post-merge-log
> chore PR #51 merge).
>
> Six fields per CLAUDE.md §5.9.

---

## What landed

- **`docs/plans/SCAFFOLD.16.md`** (750 LOC) — plan-mode draft. Commit
  `7869f28` on branch `plan/scaffold-16`. Structure: §A–§I body
  + SCAFFOLD.17.md scaffolding precedent (§0 metadata header +
  §1 LDs + §3 SURPRISES + §A-§I substance) + plan_template.md framing
  (Status/Date/Author header + Tracker context + Approach + Open
  questions + ADRs needed + Self-critique + References).
- **`docs/logs/SCAFFOLD.16-plan-mode.md`** (this file). Commit
  `<this commit>` on branch `plan/scaffold-16`.
- **No PR yet.** Plan branch pushed for operator review + web Claude
  plan-review chat OR direct hand-off to execute-chat kickoff.

## Decisions made

### Q-verdicts (Q1–Q6 all ratified at /plan opening 2026-05-26)

- **Q1 — Verdict-mapping shape:** Option A (explicit gate; ternary inside existing if). ~1 LOC change at `precommit.ts:114`.
- **Q2 — Test shape:** Option β (rename + add). Reframed from brief's "single vs pair vs triple" framing after Phase-1 surfaced the brief-error (the existing `precommit-moderate::track-a-csam-mapping` test does NOT use `imageR2Key` despite brief §1.1 item 4 parenthetical asserting it does). Rename existing test → `precommit-moderate::track-a-csam-mapping-with-image`; add new `precommit-moderate::text-only-sexual-minors-routes-track-b`. Test count stays at 13.
- **Q3 — `docs/parked.md` row structure:** separate rows, 4 entries (count corrected from brief's 3 to kickoff's 4 — kickoff post-dates brief and adds R-1/R-2/R-3 deferral as 4th entry).
- **Q4 — SPEC.2 §17.2 row 4 cleanup:** minimal — strike `photodna_upstream_failure` in SPEC.2 §10 fail-closed paragraph (not §17.2 row 4 prose; row 4 only names `openai_moderation_auth_failure`).
- **Q5 — SPEC.1 §17 amendment scope:** minimal — 1 row struck (per LD-10 Position B, not soft-defer marker) + 1 new row added. Mixed family (`moderation::*` + `precommit-moderate::*`) intended interim per CF-3.
- **Q6 — Branch hygiene:** cut `plan/scaffold-16` off `origin/main` HEAD `6a6b04b`.

### Carve-outs / amendments

- **LD-10 REOPENED 2026-05-26.** Original brief-time Position A (keep `photodna.ts` row in SPEC.2 §10 file map, marked deferred). Operator-directed change to Position B (complete removal) for ALL PhotoDNA references in SPEC.1 + SPEC.2. Rationale: experiment-phase scope discipline; `docs/parked.md` Row 1 is sole record of optionality. CF-5 closed by this change.
- **§F amendment scope expanded** from brief §4's 5 locations to 9 locations. Three new SPEC amendment targets surfaced by /plan opening greps + 1 NCMEC operational-reference strike + 1 explicit no-op (SPEC.2 §17.2 row 4 enumerated for amendment-scope-discipline traceability per ENGINE.6 process improvement #5):
  1. SPEC.1 §16.5 bullet 5 (rewrite — Position B + experiment-phase carve-out)
  2. SPEC.1 §17 (strike + add)
  3. SPEC.1 §20-Appendix moderation-category table (csam row strike + sexual/minors row rewrite)
  4. SPEC.2 §10 prose (multi-paragraph surgical strikes + LD-3 carve-out paragraph add)
  5. SPEC.2 §10 Track A degrade paragraph NCMEC sentence (γ-strike — 6th find)
  6. SPEC.2 §12.2 line 1112 (strike "+ PhotoDNA run in parallel")
  7. SPEC.2 §17.2 row 4 (no-op; enumerated for traceability)
  8. SPEC.2 §22.2 line 2175 (strike "cron infrastructure at SCAFFOLD.16" stale framing)
  9. SPEC.2 Appendix A file map (precommit.ts row description strike + photodna.ts row strike)
- **NCMEC default-strike-on-encounter** is ceiling-exempt per operator (same root cause as 6th find). NCMEC inventory grep explicitly skipped per operator instruction. Additional NCMEC operational references encountered during execute-phase §F application get default-struck per Position B.
- **Hard ceiling at 6 SURPRISES held.** No non-NCMEC, non-PhotoDNA brief-drift items surfaced during plan-body drafting.

### CF-status changes vs brief §7

- **CF-1, CF-2, CF-3, CF-4** — open / forward-flagged (per brief).
- **CF-5** — CLOSED by LD-10 Position B. Original framing ("photodna.ts file row preservation in SPEC.2 §10 file map") is moot; file row STRUCK from SPEC.2 Appendix A + §10 prose. Future second-vendor stratum re-adds SPEC framing from scratch.
- **CF-6** — CLOSED. Chore PR #51 (`chore: SCAFFOLD.17 post-merge log + tracker entries`) merged to main 2026-05-26 at `6a6b04b`. SCAFFOLD.16 work proceeds against `main` HEAD `6a6b04b`. Local `chore/scaffold-17-post-merge-log` branch (still at `ff9c679`) superseded; operator can delete at leisure.

## Open questions

None at plan time. All Q1–Q6 ratified; all 6 SURPRISES absorbed with explicit operator ratification. Plan body locks the scope.

## Next session starts at

**Web Claude plan-review chat OR direct execute-chat kickoff drafting (operator's call).**

- **If web Claude plan-review chat:** operator hands plan + close-out log + briefs to a sibling web Claude chat for plan review. Web Claude review either ratifies plan as-is (proceed to execute) or surfaces flags for plan amendment commit (commit-2 on `plan/scaffold-16`).
- **If direct execute-chat kickoff drafting:** operator (or web Claude plan-review chat) drafts the execute-chat kickoff prompt. Execute-chat is a separate Claude Code session that:
  1. Reads this plan + the two briefs + CC repo inspection report.
  2. Invokes test-writer subagent at Phase 2 START per CLAUDE.md §5.11 (writes the 1 new test + applies the rename + modifies the renamed test BEFORE implementation edit lands).
  3. Applies Edit 1–3 in `src/server/moderation/precommit.ts` + `src/server/config/limits.ts` per plan §E.
  4. Applies all 9 SPEC amendments per plan §F + default-strikes any NCMEC operational refs encountered.
  5. Adds 4 `docs/parked.md` rows per plan §G.
  6. Runs pre-PR self-audit per CLAUDE.md §5.10 against plan §A-§F inventory.
  7. Invokes code-reviewer + security-auditor subagents per CLAUDE.md §5.11.
  8. `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` clean.
  9. Opens PR against `main`.
  10. Writes execute-phase close-out log at `docs/logs/SCAFFOLD.16.md`.

Plan-mode CC does NOT draft the execute-chat kickoff per kickoff scope ("EXECUTE-CHAT KICKOFF DRAFTING — NOT IN THIS CHAT").

## Context to preserve

Items that wouldn't be derivable from the plan body alone:

- **Brief is frozen at v1** (MD5 `4698d41100695ffa58040de001063823`). Three identical copies in `~/Downloads/` (`.md`, ` (1).md`, ` (2).md`). Future updates would invalidate plan §1 LD reproductions; treat brief as immutable.
- **SCAFFOLD.17 post-merge-log chore branch (`chore/scaffold-17-post-merge-log`) is local-stale.** Local branch still at `ff9c679` (the local commit); origin/main at `6a6b04b` (the squash-merge of #51 containing the same content). Operator may delete local chore branch at leisure. Not a SCAFFOLD.16 dependency.
- **CC repo inspection report at `/tmp/scaffold-16-repo-inspection.md`** (2,292 lines, written 2026-05-25 by previous inspection-only CC chat). Authoritative source for brief drafting; ground-truthed shipped-state at the time. Execute-chat should re-grep against current repo state at its `/plan` opening per CLAUDE.md §5.7 verify-before-claiming-done discipline.
- **ADR-0014 file does NOT exist on disk.** Only `docs/adr/0001-license-choice.md` is in `docs/adr/`. ADR-0014 substance lives in SPEC.2 §0.1 line 38-40 + SPEC.2 §10 lines 999-1033. Per user-memory `project_adr_catalogue_framing`: this is queued maintenance, not aspirational. Execute-chat should not propose creating ADR files for SCAFFOLD.16.
- **`mod_actions` table is shipped but has no callers.** `src/db/schema/audit.ts` defines the Bucket-A append-only table; relations wired in `src/db/schema/auth.ts:177`. SCAFFOLD.16 does NOT touch this table (B4: caller-side per LD-5). Future caller strata (DEBATE.2 etc.) wire INSERT-on-Track-A.
- **Test-naming convention drift is intentional interim** per LD-8 + operator pre-Phase-1 ack. Post-SCAFFOLD.16 SPEC.1 §17 carries 10 `moderation::*` rows + 1 new `precommit-moderate::*` row = 11 total moderation-domain rows in mixed family. CF-3 captures the full-sweep deferral.
- **Position B applies to NCMEC default-strike too.** Per operator ratification 2026-05-26: any additional NCMEC operational references encountered during §F drafting (or execute-phase application) get default-struck per same root cause. NCMEC inventory grep explicitly skipped at plan time; execute-phase auditors should treat additional encountered NCMEC refs as in-scope strikes, not new SURPRISES requiring escalation.
- **Hard ceiling at 6 SURPRISES holds for execute-phase too.** Non-NCMEC, non-PhotoDNA brief-drift items surfaced during execute-phase plan application trigger STOP-and-surface per CLAUDE.md §5 + SCAFFOLD.3-FOLLOWUP-1 lesson 3.1. Execute-chat should not silently absorb new finds.
- **`@docs/plans/SCAFFOLD.16.md` is the plan path** for all subagent invocations during execute-phase (test-writer at Phase 2 start; code-reviewer + security-auditor post-implementation).
- **DEBATE.2 is the downstream consumer** of `precommitModerate` return shape (LD-4 unchanged shape). When DEBATE.2 lands, the F-COMMENT-3 caller wires `mod_actions` INSERT + `users.banned_at` UPDATE per LD-5 + LD-6 caller-side discipline.
- **Sequencing authority for SCAFFOLD.16** is operator + brief, NOT retroactively-attributed SCAFFOLD.15 close-out content. Per SCAFFOLD.17.md §3 SURPRISE-3 precedent: `docs/logs/SCAFFOLD.15.md` contains no §11.1 section despite brief citations to that path; this is brief-level operator decision, not logged authority. Same applies to SCAFFOLD.16 sequencing.

## Time

- 2026-05-25 ~22:00 IST: Phase-0 input ack chat (read 8 inputs + confirm).
- 2026-05-26 ~10:30 IST: Phase-1 Q-verdict ratification (Q2 separate sub-part, then bundle of Q1/Q3/Q4/Q5/Q6).
- 2026-05-26 ~11:00 IST: Phase-2 /plan opening greps + 4 SURPRISES surfaced + LD-10 reopen + operator scope correction Position B.
- 2026-05-26 ~11:30 IST: 6th-find (SPEC.2 §10 NCMEC sentence) + ceiling-honor + γ-strike resolution + NCMEC default-strike scope.
- 2026-05-26 ~11:45 IST: Branch creation + plan-body drafting + commit `7869f28` + close-out log + push.

Total elapsed plan-mode chat time: ~14 hours wall-clock, ~3-4 hours operator-engaged.
