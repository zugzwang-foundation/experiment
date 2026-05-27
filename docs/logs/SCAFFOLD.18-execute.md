# SCAFFOLD.18 execute — session log

> **Companion log:** web Claude close-out at `/mnt/user-data/outputs/chat_close_2026-05-27_SCAFFOLD_18_execute_review.md` (web-Claude-side decision rationale + 5-category WONTFIX taxonomy). This file holds the Claude Code-side execute-chat audit trail; cross-reference rather than duplicate.

---

## Session metadata

| Field | Value |
|---|---|
| **Date** | 2026-05-27 |
| **Stratum** | SCAFFOLD.18 execute (Phase 2 → Phase 4) |
| **Predecessor session** | SCAFFOLD.18 plan-mode review (commit `ac8720f`, log `docs/logs/SCAFFOLD.18-plan-review.md`) |
| **Plan ratified by** | web Claude, 2026-05-27 (committed alongside YAML at commit `fed5df0`) |
| **Critical-path** | yes — reclassified per CLAUDE.md §1 (CI workflow's function is to gate the four hard-locked invariant tests; §1 path-globs don't match `.github/workflows/` but function does) |
| **Branch** | `feat/scaffold-finish-bundle-2` |
| **Pre-merge HEAD** | `146aac3` |
| **Merge commit (main)** | `e080dab` (squash) |
| **Merged at** | 2026-05-27T07:06:40Z |
| **Reviewer cascade** | code-reviewer + security-auditor (both PASS clean after WONTFIX triage) |
| **Total wall-clock CI gate active** | 1m 27s steady-state (`26491401628`) vs 25-min ceiling |

---

## What landed

**Files (5 substantive + 3 carried from precursor commits on branch):**

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Postgres 17 service container + DATABASE_URL env + `pnpm drizzle-kit migrate` step + timeout bump 15→25 + CI-only `sed` step surgically stripping 2 pg_cron-coupled statements from migration 0007 (Path B substrate) + comment-drift fix |
| `tests/db/identity-pool/watermark.test.ts` | Test 6 (cron-registration) gains runtime `pg_extension` probe + `ctx.skip()`; tests 1–5 (function logic) run unconditionally |
| `docs/specs/SPEC.2.md` §0.1 | Three erratum rows (v0.3.2-draft tag fix, v0.3.3-draft Path A→B pivot, v0.3.4-draft surgical-strip refinement) + metadata bumps |
| `docs/specs/SPEC.1.md` line 1274 | ADR-0016 absorption row tag cross-reference fix (`-x-6-x86` suffix removed) |
| `docs/plans/SCAFFOLD.18-postgres-ci.md` | New plan file committed alongside YAML (CLAUDE.md §5.1) |

Plus 3 precursor commits on branch (not this session's substance; carried in PR diff): `40db580` (MVP ci.yml shell + `packageManager` pin), `db0bdd6` (Bundle 2 close-out log), `ac8720f` (plan-mode review log).

**Outcome:** PR #54 merged to main as `e080dab`. The four hard-locked invariants (INV-1 through INV-4) are now enforced at the CI gate via:
- 13 trigger tests at `tests/db/triggers/*-append-only.spec.ts`
- 1 INV-tagged test at `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts`
- 5 watermark function-logic tests at `tests/db/identity-pool/watermark.test.ts` (tests 1–5)
- 1 watermark cron-registration test skipped via runtime `pg_extension` probe (HARDEN-phase coverage via local `supabase start`)

Steady-state CI: 304/312 tests passing, 3 skipped (pre-existing), 5 todo, 1m 27s wall-clock.

---

## 4-CI-cycle audit trail

The execute chat ran 4 CI cycles before landing green. Each cycle surfaced a distinct failure mode that the plan §8 risks anticipated to varying degrees.

### Cycle 1 — `26476831221` (fed5df0)

- **Wall-clock:** 13s (fast-fail at `Initialize containers`)
- **Failure mode:** Docker pull returned `manifest unknown` for `supabase/postgres:17.6.1.107-x-6-x86`
- **Root cause:** SPEC-level bug — SPEC.2 §0.1 ADR-0016 row named a tag with a malformed `-x-6-x86` suffix that does not exist on Docker Hub (3,936 published `supabase/postgres` tags enumerated; suffix matches no real family — real arch suffixes are `_amd64`/`_arm64`; real build suffixes are `-multigres`/`-orioledb`/`-mg-1`). Provenance of `-x-6-x86` at original ratification (2026-05-08) not recoverable; most plausible read is fabricated/hallucinated string in the ADR-0016 absorption pass.
- **Propagation map (5 surfaces):** SPEC.2 §0.1 (source), SPEC.1 §20 (cross-reference), plan file (8 hits), plan-review log (3 hits), ci.yml (1 hit)
- **Decision:** Option α — surgical tag correction (`17.6.1.107-x-6-x86` → `17.6.1.107` manifest-list form). Same-commit SPEC.2 erratum row + SPEC.1 tag fix; plan + plan-review log left as historical artifacts. Web Claude greenlit.
- **Resolution amend:** `8919c17` (v0.3.2-draft erratum)

### Cycle 2 — `26477860192` (8919c17)

- **Wall-clock:** 25s (fast-fail at `Initialize containers` after successful pull)
- **Failure mode:** Container started but healthcheck went `unhealthy` after 2s. Container logs: `psql: error: ... FATAL: password authentication failed for user "supabase_admin"`
- **Root cause:** Plan §8 Risk 1 firing as predicted — `supabase/postgres` image is designed for Supabase CLI orchestration which provides a broader env-var ecosystem (including platform-role passwords for `anon`/`authenticated`/`service_role`/`supabase_admin`). Bare `docker run -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres` triggers a partial-bootstrap with `supabase_admin` password misalignment. Q2 (extensions-schema GRANT) was anticipated; this earlier-stage `supabase_admin` failure was NOT explicitly in the plan's Q catalogue but matched §8 Risk 1's general framing.
- **Decision:** Option B — pivot to Path B per plan §8 Risk 1's documented fallback. Vanilla `postgres:17` + CI-only exclusion of `0007_pg_cron_jobs.sql`. Web Claude greenlit; rejected Path A investigation as diminishing-returns (2 cycles deep with no green).
- **Implementation mechanism:** mechanism 1 (CI-step `rm` of 0007.sql + `jq` strip of `_journal.json` entry — both ephemeral CI-workdir only; source-control immutability preserved per ADR-0008 / AGENTS.md §6). Required journal-strip extension was surfaced pre-edit; sandbox-verified before amend (8 entries → 7 entries; `dialect`/`entries`/`version` top-level keys preserved).
- **Resolution amend:** `9c3a712` (v0.3.3-draft erratum)

### Cycle 3 — `26478587027` (9c3a712)

- **Wall-clock:** 1m 23s (failed at `Unit and integration tests` step)
- **Progress made:** vanilla `postgres:17` service container booted cleanly; `rm` + `jq` strip step succeeded; `drizzle-kit migrate` applied 7 migrations cleanly; vitest ran 312 tests.
- **Failure mode:** 6 tests failed in `tests/db/identity-pool/watermark.test.ts` with `PostgresError: relation "watermark_state" does not exist`. Tests pass count went 0→299; 6 failures concentrated in one file.
- **Root cause:** Path B over-broad. Migration 0007 is mixed-concern — only 2 of its 8 statements are Supabase-coupled (`CREATE EXTENSION pg_cron` line 16 + `SELECT cron.schedule(...)` lines 78-82); the remaining 6 are vanilla-portable (`watermark_state` table, `cron_alarms` table, `check_identity_pool_watermark()` function, seed row). Whole-file strip removed the watermark_state table that 5 tests depend on.
- **Decision:** Option α — refine Path B to surgical statement strip (preserve the 6 vanilla-portable statements; strip only the 2 Supabase-coupled). Plus test-level handling for test 6 (cron-registration assertion inherently needs pg_cron): runtime probe + `ctx.skip()`. Web Claude greenlit; rejected whole-file-strip + vitest --exclude (loses 5/6 test coverage).
- **Implementation mechanism deviation:** web Claude's draft used `let hasPgCron = false; beforeAll(...); it.skipIf(!hasPgCron)(...)`. CC deviated to `ctx.skip()` inside test body because vitest evaluates `it.skipIf(condition)` at **collection time** — before `beforeAll` runs — making the probe-then-skipIf pattern incompatible with runtime DB state. Deviation surfaced transparently in self-audit; web Claude ratified as correct call.
- **Sandbox verification:** `sed` strip on `/tmp/0007-test.sql` produced exactly 2 hunks removed (line 16 + lines 78-82); preserved-keyword grep returned 7 (≥4 required); removed-keyword grep returned 0 for both `CREATE EXTENSION pg_cron` and `cron.schedule`. Pre-amend `pnpm tsc --noEmit` confirmed ctx.skip destructure pattern type-safe.
- **Resolution amend:** `146aac3` (v0.3.4-draft erratum)

### Cycle 4 — `26491401628` (146aac3)

- **Wall-clock:** 1m 27s ✓
- **Status:** GREEN
- **Step-by-step:** all steps pass including new "Strip pg_cron statements from 0007" step + Apply database migrations + Unit and integration tests
- **Vitest results:** 47 passed | 3 skipped (50 test files); 304 passed | 3 skipped | 5 todo (312 tests)
- **Watermark file specifically:** `6 tests | 1 skipped` — tests 1-5 passing, test 6 skipped via ctx.skip (probe correctly returned false on vanilla postgres:17)
- **Delta vs Cycle 3:** +5 passing, +1 skipped, −6 failing (exactly the target — 5 watermark function tests now run, test 6 correctly skips)

---

## Phase 0 → Phase 4 flow

### Phase 0 — Read + verify (single turn)
- Read plan, ci.yml, CLAUDE.md, AGENTS.md, code-reviewer briefing, security-auditor briefing
- Verified working tree clean, HEAD at expected `ac8720f`, plan file untracked as expected
- No SURPRISEs; ready for Phase 1

### Phase 1 — YAML edits (single turn)
- Applied 3 ratified edits + 1 micro-edit for comment drift (timeout-rationale comment was actively wrong post-bump)
- Comment-drift surfaced as non-blocking observation; web Claude ratified as Option (b) in-commit fix
- Sandbox-verified by re-reading post-edit ci.yml; no scope creep

### Phase 2 — Self-audit (single turn)
- 6-row audit against plan §5.1–§5.5 + discipline items
- One SURPRISE: SPEC.2 metadata bump alongside the erratum row (3 sub-edits not explicitly in kickoff's "3 edits" framing but required by file-internal-consistency convention)
- Surfaced with both options (accept / revert); web Claude greenlit option (a) — file-internal-consistency bumps within ratified envelope are NOT scope creep

### Phase 3 — Commit + push + monitor (4 CI cycles, each one full Phase 3 sub-loop)
- Each cycle: commit (or amend) → push (or force-push-with-lease) → monitor CI → diagnose failure → surface to web Claude with decision options → implement greenlit fix → repeat
- Force-with-lease used for all amends after the initial push; never escalated to `--force`
- All pre-flight checks (`git fetch` to confirm remote SHA) ran before each amend
- Stale `/tmp/commit-msg.txt` cleanup discipline applied before every fresh commit-message write

### Phase 4 — Reviewer cascade + PR ready (single turn each)
- code-reviewer subagent: 0 CRITICAL, 0 HIGH, 1 MEDIUM (sed brittleness), 3 LOW (defensive return, header comment drift, plan-body Path A reference). All WONTFIX with rationale.
- security-auditor subagent: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW (action floating-major pins, sed brittleness duplicate). All WONTFIX with rationale.
- Auditor verdict (verbatim): *"The PR is safe to land."*
- Triage taxonomy locked at 5 categories: (a) structural invariant forecloses predicate, (b) defensive intent zero net cost, (c) edit expands kickoff-ratified envelope, (d) edit retro-modifies historical artifact, (e) defense-in-depth deferred by threat model
- `gh pr ready 54` invoked; PR moved to OPEN state
- PR title updated `gh pr edit 54 --title "feat(ci): expand CI with Postgres service + migration apply (SCAFFOLD.18)"` to match HEAD commit subject
- PR body updated via `gh pr edit 54 --body-file /tmp/pr-body.md` (with stale-file collision + recovery; see Process Learnings below)

---

## Reviewer cascade — load-bearing positive findings

Beyond "passed clean," both subagents surfaced affirmative verifications worth recording for project-knowledge / future-stratum reference:

| Finding | Source |
|---|---|
| Plan §1 claim "CI gates storage-layer foundation for all four invariants" holds against the actual diff | code-reviewer |
| Sandbox-verified `sed` strip produces exact intended output (independently re-run by reviewer) | code-reviewer |
| INV-1/INV-2/INV-3 unreachable via 0007-strip mechanism — sed hardcoded path cannot reach `0003_append_only_triggers.sql` | security-auditor |
| INV-4 confirmed via CI log evidence: `I-APPEND-ONLY-001` ran 3/3 passing at 04:49:11–04:49:12 UTC in run `26491401628` | security-auditor |
| GHA auto-redacts the `postgres:postgres@` substring in CI logs (verified: appears as `***localhost:5432/postgres`) | security-auditor |
| Fork-secret-exfiltration surface closed: `pull_request:` (not `pull_request_target:`) | security-auditor |
| GITHUB_TOKEN scope: `contents: read` only; no write/push/OIDC | security-auditor |
| Bash command injection not exploitable: static literal YAML, no `${{ }}` interpolation | security-auditor |
| Concurrency cancel-in-progress can't cross PRs — group is `workflow-ref` scoped, per-PR | security-auditor |
| Image supply-chain bounded — `postgres:17` runs in isolated GHA service-container network with no public exposure; blast radius limited to throwaway DB | security-auditor |

These validate the Bundle 2 critical-path-by-function reclassification.

---

## HARDEN-phase carry-forwards (8 items)

Carried forward to HARDEN-phase scope per web Claude close-out CF-3:

1. **pg_cron coverage for the 2 stripped statements + watermark test 6** — formalize local `supabase start` test surface to cover the `CREATE EXTENSION pg_cron` + `SELECT cron.schedule(...)` path that CI doesn't exercise
2. **Image-tag manifest-resolution lint at write-time** — pre-commit lint or CI gate that resolves named image tags + external-dependency version pins against published manifests before SPEC absorption (would have caught the `-x-6-x86` typo at write-time and prevented propagation across 5 surfaces)
3. **SHA pinning + Dependabot for GitHub Actions** — currently using floating-major pins (`actions/checkout@v5`, `pnpm/action-setup@v4`, `actions/setup-node@v4`); SHA pinning is the harder defense-in-depth posture, requires Dependabot to avoid stale-version lock-in
4. **Node 20 → Node 24 action migration** — GHA forces June 2, 2026; surfaced as informational annotation in CI runs
5. **Sed range-pattern brittleness** — HARDEN-phase swap for jq/Node SQL statement parser; current `/^);$/d` end-anchor would over-match if migration 0007 is later edited (foreclosed by AGENTS.md §6 append-only invariant in practice, but the pattern itself is brittle)
6. **Reusable Path-B-style CI-substrate-divergence template** — the GHA-service-container model assumes standard postgres env-var conventions; vendor images with broader env-var ecosystems are systematically incompatible. Generalize the surgical-strip pattern for future vendor-image gaps
7. **Vitest collection-time vs runtime skip semantics documentation** — `it.skipIf()` evaluates at collection time, before `beforeAll`; for runtime-conditional skip, use `ctx.skip()` inside test body. Document in a project-wide testing-conventions doc to avoid re-discovery
8. **Surgical-vs-whole-file CI patching pattern for mixed-concern migrations** — when a migration mixes vendor-coupled and vanilla-portable statements, the CI patching surface needs statement-level granularity, not file-level. Establish a project pattern for this

---

## Process learnings (5 items)

For absorption into AGENTS.md / CLAUDE.md / .claude/skills at PRECURSOR.5 sweep:

1. **`rm -f /tmp/<file>` hygiene rule extends beyond `/tmp/commit-msg.txt`** — applies to every shell-fed tmpfile (e.g., `/tmp/pr-body.md`, `/tmp/issue-body.md`). I missed this for `/tmp/pr-body.md` and a 12,505-byte stale file from a prior chat session (May 23, SCAFFOLD.3-FOLLOWUP-1 content) got applied to PR #54's body before recovery. Cost: one bad `gh pr edit` + one fix cycle. Rule: `rm -f /tmp/<file>` BEFORE every Write to tmp; the Write tool's "must Read existing file first" guard becomes a hint that stale content lurks.

2. **Web Claude paste-back discipline matters as much as plan-mode discipline** — a duplicate paste of the same kickoff mid-cascade (web Claude self-acknowledged) wasted ~10 seconds re-running Step 1 diagnostics. The CC response correctly read it as "state unchanged, no drift" and pointed back at the prior turn's draft. Pattern: when paste-back collides, re-confirm state with cheap idempotent commands rather than redo substantive work.

3. **Vitest skip semantics — `it.skipIf()` is collection-time, `ctx.skip()` is runtime** — surfaced when web Claude's draft skeleton used `let hasPgCron = false; beforeAll(...); it.skipIf(!hasPgCron)(...)`. That pattern can't work because vitest evaluates `it.skipIf(condition)` when the file is collected (before any `beforeAll` hook runs), so `hasPgCron` is always `false` at evaluation. The runtime-probe + conditional-skip pattern requires `ctx.skip()` inside the test body. Documented in carry-forward 7 above.

4. **Plan-mode mixed-concern-migration audit** — plan-mode review of migration 0007 didn't catch that it bundled pg_cron-coupled statements with vanilla-portable structures (watermark_state table, cron_alarms table, function, seed row). The "whole-file strip" assumption was over-broad and only surfaced in Cycle 3 vitest failures. Plan-mode should audit migration files for mixed-concern structure when CI-patching strategies are being chosen.

5. **Surgical-vs-whole-file CI patching pattern** — adjacent to learning 4 but more general. When CI needs to diverge from prod schema, the divergence surface should be at the statement level (not file level) when possible — preserves more test coverage and reduces CI-vs-prod drift. The 6-of-8-statement preservation in this PR is the worked example.

---

## Open questions

None. All in-session decision points resolved with web Claude greenlight. HARDEN-phase carry-forwards are forward-tasks (not open questions); process learnings are absorption candidates for PRECURSOR.5 (not open questions).

---

## Next session starts at

PRECURSOR.5 (CLAUDE.md / AGENTS.md / .claude/skills sweep) is the natural next pass; the 5 process learnings above are concrete absorption inputs. No immediate next-action queued for SCAFFOLD.18 itself — the CI gate is active and operator now wires up branch protection per plan §6 Step 7 (Settings → Branches → require `ci` check, post-merge of this PR).

---

## Context to preserve

- `feat/scaffold-finish-bundle-2` auto-deleted on merge per GitHub's setting; merge commit `e080dab` on main carries the squashed substance
- Local branch `feat/scaffold-finish-bundle-2` still exists with HEAD at `146aac3` at session-log-write time; will be cleaned up locally after this commit
- Web Claude close-out at `/mnt/user-data/outputs/chat_close_2026-05-27_SCAFFOLD_18_execute_review.md` holds the 5-category WONTFIX taxonomy + decision rationale that complements this log; cross-reference, don't duplicate
- Three CI failures preserved in the audit trail (`26476831221`, `26477860192`, `26478587027`) before the green run (`26491401628`); raw logs accessible via `gh run view <id> --log`

---

## Time

Session start: approximately 2026-05-27 ~01:00 UTC (Phase 0 reads)
PR merged: 2026-05-27 07:06:40 UTC
Total session wall-clock: ~6 hours including 4 CI cycles + reviewer cascade + PR body recovery
