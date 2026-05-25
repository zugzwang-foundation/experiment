# SCAFFOLD.17 — post-merge close-out

> Short close-out log for the post-merge-prep chat that landed PR #50 on `main`, surfaced two HARDEN.* tracker entries to operator, and staged SCAFFOLD.16 context for the next plan-drafting chat. Six fields per CLAUDE.md §5.9.

---

## What landed

- **PR #50 merged to `main`** as merge commit `d5be518` (merge-commit strategy preserving the 7-commit audit chain web Claude reviewed). Operator merged before this chat opened; this chat performed the post-merge fast-forward + branch cleanup.
- **Branches deleted:**
  - Local `plan/scaffold-17` (was at `afdc1b3`).
  - Remote `feat/scaffold-17` + remote `plan/scaffold-17`.
  - Bonus: `git fetch --prune` cleared 9 stale remote-tracking refs from prior merged-and-deleted branches.
- **Tracker entries — SURFACED to operator (not minted in repo).** Tracker is operator-maintained external HTML in web Claude project knowledge per user-memory `project_tracker_external.md`. Local `~/Downloads/zugzwang_experiment_tracker_v10.html` (May 23) is a historical snapshot, NOT the live tracker. Two entry shapes provided in this log's "Context to preserve" section for operator paste.
- **SCAFFOLD.16 context staged** in this log (substance + extension points + open question + brief-wording-bug flag). No SCAFFOLD.16 planning artifacts created in this chat — that's the next session.
- **This file:** `docs/logs/SCAFFOLD.17-post-merge.md` (committed + pushed in a single `chore` commit on `main`).

---

## Decisions made

- **Tracker entries surfaced, not minted in repo.** Tracker file lives external per user-memory; per CLAUDE.md §5.4 (stay in scope) + the kickoff's explicit instruction ("If the tracker file is NOT in the repo … STOP and tell operator the tracker entries need to be added manually"), the two entry shapes are reproduced verbatim in this log for operator paste.
- **CF-11 NOT promoted to tracker task.** Per the kickoff: "CF-11 stays as a documented carry-forward in `docs/logs/SCAFFOLD.17.md` only. It is NOT promoted to a task because plan §C explicitly accepted the shape at N=50K. Revisit only if pool size grows. Do not mint." Honoured.
- **Merge strategy = merge-commit (not squash).** Preserves the 7-commit audit chain web Claude reviewed. The merge had already happened by the time `gh pr merge 50 --merge --delete-branch` ran (operator merged before this chat opened); the command surfaced "already merged" + fast-forwarded local `main` and deleted the feat branch. `plan/scaffold-17` survived gh's cleanup and was deleted manually (local `-D` + remote `--delete`).
- **No further code changes to SCAFFOLD.17 in this chat.** PR merged cleanly; CF-8/CF-9/CF-10/CF-12 are HARDEN.* scope per the SCAFFOLD.17 close-out log's third entry.

---

## Open questions

- **None.** All 4 kickoff tasks completed.

---

## Next session starts at

**SCAFFOLD.16 brief-drafting chat** — fresh web Claude chat with the standard SCAFFOLD-brief-drafting protocol. NOT opened in this session per the kickoff's explicit guard. Inputs to bring:

- `docs/logs/SCAFFOLD.15.md` line 130 (SCAFFOLD.16 substance: PhotoDNA + Safer parallel moderation; lowest priority in the dependency graph; no other strata block on it).
- `docs/logs/SCAFFOLD.15.md` line 112 (brief-wording-bug flag — SCAFFOLD.16 does NOT add the moderation client; SCAFFOLD.15 already shipped that. SCAFFOLD.16 ADDS PhotoDNA + Safer via `Promise.all` inside the existing `precommitModerate`. Web Claude brief should be revised at plan-mode opening).
- `docs/logs/SCAFFOLD.15.md` line 146 (open question for SCAFFOLD.16 plan-mode: AVIF support across CSAM hash vendors is undocumented; needs research).
- Existing extension points in code:
  - `src/server/moderation/precommit.ts:24` — `// SCAFFOLD.16 adds PhotoDNA + Safer in parallel via Promise.all`.
  - `src/server/moderation/precommit.ts:97` — `// future PhotoDNA addition might throw a raw error — the contract`.
  - `src/server/config/limits.ts:88` — `// SCAFFOLD.16 adds PhotoDNA / Safer in parallel`.
- ADR-0014 substance in `docs/specs/SPEC.2.md` §10 — PhotoDNA HTTP call shape spec: "Called in parallel with OpenAI on image-attached submits. Same 3-second-timeout / one-retry / fail-closed posture. A `csam_match` result short-circuits the verdict to Track A regardless of the OpenAI verdict. Exact wire shape owned by SCAFFOLD.16 (vendor onboarding)."
- SPEC.2 Appendix A row (line 2318): `src/server/moderation/photodna.ts` is named as the new file SCAFFOLD.16 ships.
- SPEC.1 §13 + §17 + Q3 (line 1236) for the CSAM-hash-onboarding deliverable + acceptance test `moderation::photodna-csam-match-shortcircuits-openai` (SPEC.1 line 1268 v1.6.0-draft entry).
- No existing `docs/plans/SCAFFOLD.16.md` — plan-drafting chat creates it.

After SCAFFOLD.16 merges, operator runs the SCAFFOLD.17 post-merge runbook (per SCAFFOLD.17 plan §6) when the external-dev pipeline B1 delivers the 50K `.webp` files + CSV manifest. SCAFFOLD.17 post-merge runbook is operator-side; does not block downstream strata.

---

## Context to preserve

### SCAFFOLD.17 operator-side post-merge runbook still pending B1 delivery

The seed + verify scripts ship on `main`; the operator runs them when the external-dev image pipeline (B1) delivers the 50K `.webp` files + manifest. NOT in any subsequent stratum scope; operator-tracked separately.

### Tracker entries to mint (HARDEN-TSCONFIG-1 + HARDEN-DOCS-SWEEP-1)

Operator pastes these into the live tracker HTML (web Claude project knowledge).

**Entry 1 — `HARDEN-TSCONFIG-1` (load-bearing):**

- **Title:** HARDEN-TSCONFIG-1 — align tsconfig.json with AGENTS.md §1 (noUncheckedIndexedAccess)
- **Phase:** HARDEN.* (post-SCAFFOLD.16, pre-launch)
- **Estimated effort:** 2-4 hours
- **Description:** AGENTS.md §1 declares `noUncheckedIndexedAccess: true` as a tsconfig invariant. Current tsconfig.json does NOT have this set. Pre-existing global drift identified by code-reviewer subagent during SCAFFOLD.17 execute audit (CF-9). Impact: type-safety gap across entire codebase. Forces `arr[i] as string` casts at array-access sites (e.g., `scripts/seed-identity-pool.ts:~85`). Real consequences if a bounds-check is omitted under an indexed-access call site. Scope: enable the flag in `tsconfig.json`; fix all resulting typecheck errors (expected: dozens to ~hundred sites; mostly small narrowing-helper additions or explicit-check refactors); verify `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` clean.
- **Dependencies:** independent; can land anytime in HARDEN.*.
- **Carry-forward source:** SCAFFOLD.17 CF-9 (`docs/logs/SCAFFOLD.17.md` third entry).

**Entry 2 — `HARDEN-DOCS-SWEEP-1` (bundled nits):**

- **Title:** HARDEN-DOCS-SWEEP-1 — bundle SCAFFOLD.17 documentation nits (CF-8 + CF-10 + CF-12)
- **Phase:** HARDEN.* (post-SCAFFOLD.16, pre-launch)
- **Estimated effort:** 30-60 minutes
- **Description:** Three single-line documentation nits identified during SCAFFOLD.17 execute audit; bundled for a single HARDEN.* sweep:
  - **CF-8:** Add one-line comments next to `as unknown as Array<...>` casts in `scripts/seed-identity-pool.ts` + `scripts/verify-identity-pool.ts` citing the repo-convention precedent (`scripts/seed-identity-pool-dev.ts:87`, `tests/db/identity-pool/seed.test.ts:86-88`, `watermark.test.ts:97-100`). Closes letter-of-AGENTS.md-§4 gap.
  - **CF-10:** Tighten the "Re-runs are safe" docstring in `scripts/seed-identity-pool.ts` to "Re-runs of the SAME manifest are safe" — `pseudonym` UNIQUE constraint would raise 23505 (caught at exit-2) for a pseudonym collision against a DIFFERENT manifest.
  - **CF-12:** Add one-line `cron_alarms` accumulation bound to the header comment in `drizzle/migrations/0007_pg_cron_jobs.sql`: "Transition-only emit caps at ~576 rows/day worst case (288 ticks/day × 2 transitions max); `bigserial` PK capacity 9e18; SCAFFOLD.5 drain handler clears `processed_at`."
- **Dependencies:** independent; can land in a single sub-1h PR.
- **Carry-forward sources:** SCAFFOLD.17 CF-8 + CF-10 + CF-12 (`docs/logs/SCAFFOLD.17.md` third entry).

### CF-11 stays unpromoted

CF-11 (verify-script's 20 sequential OFFSET queries) — plan §C explicitly accepted "20 short queries; acceptable at this N". Revisit only if pool size grows. NOT minted as tracker task.

### Ratified verdicts per web Claude review summary

- PR #50 merged with merge-commit strategy (preserves 7-commit audit chain).
- 3 db-migration-reviewer cosmetic SURPRISEs absorbed (SPEC.2 line-number +2 drift; pg_cron `pg_catalog` vs `extensions` schema variance; SQL tab indentation vs plan markdown rendering).
- 1 code-reviewer MEDIUM fixed in-session at commit `ac06b55` (ESM main-gate `pathToFileURL` idiom).
- 5 LOW findings: 4 promoted as CF-8 + CF-9 + CF-10 + CF-12; 1 absorbed (CF-11 unpromoted).
- 0 security-auditor CRITICAL / HIGH / MEDIUM; 1 LOW → CF-12.

### SCAFFOLD.16 brief-drafting kickoff inputs

Recorded in "Next session starts at" above. The next chat is a fresh web Claude chat using the standard SCAFFOLD-brief-drafting protocol — NOT a Claude Code chat. Operator pastes the staged inputs + the brief-drafting protocol to web Claude.

---

## Time

Post-merge-prep session: ~5-10 min wall-clock from kickoff to push. Breakdown:
- Task 1 (CI confirm + merge + branch cleanup): ~2 min (merge had already happened; mostly cleanup).
- Task 2 (tracker entry surfacing): ~1 min (entries reproduced verbatim from kickoff).
- Task 3 (SCAFFOLD.16 context staging): ~3 min (grep + log lookups).
- Task 4 (this log + commit + push): ~3 min.

Cogitation: minimal — all four tasks were prescriptive per the kickoff.

---

*End of SCAFFOLD.17 post-merge close-out. Operator next action: paste the two tracker entries into the live tracker HTML (web Claude project knowledge); open a fresh SCAFFOLD.16 brief-drafting chat against web Claude with the staged inputs.*
