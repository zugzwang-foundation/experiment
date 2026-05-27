# SCAFFOLD-finish Bundle 2 — execute-phase close-out

**Stratum:** SCAFFOLD.18 (SCAFFOLD.19 cancelled mid-chat)
**Branch:** `feat/scaffold-finish-bundle-2`
**State:** Execute paused; PR #54 in draft; escalated to plan-mode for Postgres-CI expansion.
**Date:** 2026-05-26

---

## What landed

PR #54 (DRAFT) — `feat(ci): add github actions ci workflow (SCAFFOLD.18)` on branch `feat/scaffold-finish-bundle-2`.

Commit `40db580`:

- `.github/workflows/ci.yml` — 45-line MVP YAML. `actions/checkout@v5`, `pnpm/action-setup@v4` omit-version pattern, `actions/setup-node@v4` with `cache: pnpm` + `node-version-file: .nvmrc`, single sequential job `ci`, concurrency cancellation, `timeout-minutes: 15`, `permissions: contents: read`, `biome --reporter=github`, `vitest run` no flags.
- `package.json` — added `"packageManager": "pnpm@10.33.2"` after Phase 0 surfaced the field was missing AND that the dev environment was running Corepack-resolved pnpm 11.0.9 against `mise.toml`'s `pnpm = "10"` and a `lockfileVersion: 9.0` lockfile.

CI run on PR #54: steps 1–3 PASS (install, biome, tsc). Step 4 (vitest) hit the 15-minute timeout. 13× `tests/db/triggers/*.spec.ts`, 2× `tests/db/identity-pool/*`, 3× `tests/server/**/*-event.test.ts` all DB-dependent. The four INV tests at `tests/invariants/I-*.spec.ts` never reached before kill. Root cause: runner has no Postgres; the locked-decision YAML didn't include service-container provisioning.

PR #54 converted to DRAFT via `gh pr ready 54 --undo`. No revert. The `ci.yml` shell + `packageManager` pin both pass audit and lock real decisions; the fix is to ADD a Postgres service container + migration-apply step + full vitest, not to undo what's there.

---

## Decisions made

1. **SCAFFOLD.19 (Supabase PITR) cancelled operator-side mid-chat** following pre-flight research that surfaced PITR costs ~$115/mo (~$170 over 45 days) and is excluded from Supabase's spend cap — contradicting the mini-plan's "Pro default, included at no extra cost" claim. Backup question deferred to HARDEN.9 scope expansion or a net-new task; tracker + mini-plan amendments deferred to v11 sweep. Bundle 2 reduced to SCAFFOLD.18 only.

2. **ADR-0006 file absence resolved as Bundle 1 pattern:** reference SPEC.2 §0.1 ADR-0006 entry; do not author `docs/adr/0006-hosting.md` in this PR. File backfill remains queued maintenance.

3. **pnpm version pin choice:** `packageManager: "pnpm@10.33.2"` over Corepack-resolved 11.0.9 and over inline-YAML pinning. Rationale: `mise.toml` is the repo-tracked anchor; Corepack's 11.0.9 is a default-latest fallback, not chosen policy. Lockfile is at `lockfileVersion: 9.0` (pnpm 9/10 default). CI on 10.33.2 will loud-fail the next time anyone commits a pnpm-11 lockfile — intended drift-visibility mechanism, not a bug.

4. **Bundle 2 escalated to plan-mode rather than narrowing vitest scope.** CC's recommended Option C (narrow now, follow-up later) was refused by web Claude: the failing test category includes the four hard-locked invariant tests per CLAUDE.md §2; excluding them from CI ships a gate that doesn't gate the only tests that matter for the thesis. Per CLAUDE.md §2 invariant-refusal discipline, this falls in the "refuse to weaken even for testing" category. Option A (add Postgres service + full vitest) is correct but exceeds CLAUDE.md §5.1 plan-mode threshold (>30 lines, multiple architectural decisions: migration-apply command, Redis provisioning, service container shape). Hence Option D — escalate to plan-mode with brief drafting in a separate chat.

5. **Critical-path reclassification:** the CI workflow function (gating INV tests) is critical-path even though the YAML location at `.github/workflows/` doesn't match CLAUDE.md §1 path globs. Original kickoff misclassified as non-critical-path. Reviewer-cascade subagents (`code-reviewer`, `security-auditor`) owed in the next execute pass when the Postgres+migration+vitest expansion lands.

---

## Open questions

1. **Six substance items for the plan-mode brief** (web Claude is drafting `docs/plans/SCAFFOLD.18-postgres-ci.md` in a separate chat):
   - **a.** Postgres service container shape (GH Actions `services:` block; `postgres:17` image; healthcheck wait).
   - **b.** Migration-apply command lock — almost certainly `pnpm drizzle-kit migrate` per ADR-0008 single-migration-set discipline (NOT `pnpm drizzle-kit push`, which is dev-iteration only and does NOT apply raw SQL migrations); brief confirms.
   - **c.** Redis provisioning — grep DB-layer invariant tests first; likely no Redis needed for trigger tests; integration tests already mock Upstash.
   - **d.** Env var management — `DATABASE_URL` synthesised against the service container; `REDIS_URL` only if (c) requires.
   - **e.** Timeout impact — full vitest may exceed the 15-min ceiling; brief decides whether to bump timeout or split test scopes.
   - **f.** Reviewer-cascade plan per the critical-path reclassification.

2. **Will `biome --reporter=github` produce clean annotations on a real failure?** CI step 2 passed clean this run so the reporter format wasn't stressed. Watch on next CI run; if ANSI escape sequences corrupt annotations (biome #9189), follow-up commit appends `--colors=off`.

---

## Next session starts at

Brief-drafting web Claude chat (web-solo). Authors `docs/plans/SCAFFOLD.18-postgres-ci.md` covering the six substance items above. The CC plan-mode kickoff comes out of THAT chat's close-out, not this one. Do NOT expect a paired CC kickoff from this session's hand-off.

---

## Context to preserve

- Branch `feat/scaffold-finish-bundle-2` carries `40db580`. Do NOT rebase, squash, or amend this commit; the plan-mode chat's execute output is expected to ADD commits on top.
- PR #54 is draft. Do NOT mark ready-for-review until the execute chat lands the Postgres expansion.
- **Five carry-forwards** captured (see web Claude's `chat_close_2026-05-26_SCAFFOLD-finish-bundle-2.md`):
  1. ADR-0006 file missing (Bundle 1 pattern).
  2. `mise.toml` major-only pnpm pin (literal-patch discipline drift).
  3. Corepack-shim PATH-race (PRECURSOR.4 candidate).
  4. `pnpm-lock.yaml` `lockfileVersion: 9.0` (drift-visibility mechanism).
  5. AGENTS.md §10 broader-CI-stack reconciliation (post-ADR sweep).
- Late-August preflight CI re-run advised before launch window per Node 20 runner removal on 2026-09-16.
- Operator-side branch protection (Settings → Branches → require `ci` check) deferred until PR #54 merges with the expanded vitest gate. Configuring it now would block all future PRs against a broken baseline.

---

## Time

CC execute: ~23m 52s for Phase 0 reads + repo-state grep + Phase 1 commit + PR open + CI fail diagnosis + draft conversion. No Phase 2 (no TODO markers surfaced). Phase 3 audit clean pre-PR (15/15 PASS). No Phase 4 close-out in-session — deferred to this wind-down per operator instruction.
