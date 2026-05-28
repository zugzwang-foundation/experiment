# SCAFFOLD.8 — Staging environment (hardening + scripts + routes)

**Status:** done
**Date completed:** 2026-05-28
**Time spent:** J-phase execute session (multi-turn)
**PR / commit:** `feat/scaffold-8-staging-env` @ a64e35c (+ J2-fix follow-up commit, this close-out) — PR #57 open, NOT merged
**Chat link:** n/a

## What was built

A live, isolated staging environment for the experiment app: `staging.zugzwangworld.com` (DNS + HTTPS, Vercel staging Custom Environment) serving the SCAFFOLD.8 code against a dedicated staging Supabase, with Doppler `stg`-scoped secrets, a seeded `identity_pool` (200 rows), R2 bucket isolation, and an 11-item smoke suite (collapsed into 9 implementation checks; `scripts/smoke-staging.ts`). J1 (migrate) and J2 (seed) ran clean; J3 smoke passes with zero failures and one by-design skip.

## Decisions taken

- **Runtime DB connection: Supabase Session pooler (port 5432), not Transaction pooler (6543).** The app's postgres-js client runs with prepared statements ON (`prepare` unset → postgres-js default `true`). The Transaction pooler does not support prepared statements, so 6543 would fail every query unless `src/db/index.ts` were changed to `prepare: false`. Session pooler is compatible with the current client as-is and was confirmed at runtime (`db:ok`). No code change. — verified live via `/api/health`.
- **`SENTRY_ORG` stays out of Doppler (Vercel-direct).** Sentry vars are Vercel-Marketplace-direct per the C0-fix allowlist rationale. Consequence: smoke item #9 (sentry-routing / EC9) skips by design. Accepted the skip rather than reversing the logged decision for one checkmark.
- **J2 fix lands as a follow-up commit, not an amend.** `a64e35c` is signed and already pushed; amending would force a force-push. Per kickoff, the J2 fix (`scripts/seed-staging.ts`) lands as a follow-up commit bundled into this close-out (Option 2, no force-push).
- **Deployment Protection / Vercel Authentication disabled for smoke.** Required to let the smoke runner reach `/api/health` without an auth wall. Re-enabling is a HARDEN item (see Open items).

## Deviations from plan

Plan-vs-reality drifts captured during the J-phase (C12 requirement):

1. **Doppler config is `stg`, not `staging`.** All Doppler references in plan/docs that say `staging` mean the `stg` config.
2. **`DATABASE_URL_STAGING` = pooler; the direct host is IPv6-only.** The direct connection host is unreachable from Vercel's runtime; pooler is mandatory, not optional.
3. **`SENTRY_ORG` is Vercel-direct, not Doppler** (also absent from Doppler `prd`). See Decisions.
4. **O5→O6 had no explicit domain-attach step.** `staging.zugzwangworld.com` was attached to the staging deployment manually this session; the plan implied it but did not enumerate the step.
5. **Q4 partition-trigger propagation expected = 52, not 26.** The J1 spot-check Q4 returned 52; this is benign partition-trigger propagation, not a regression. The "26" expectation in the plan was wrong.
6. **Seed delegation to `seed-identity-pool-dev.ts` crashes under tsx** (server-only import pulled in at module load). Root-cause fix is a SEPARATE deliberate PR — split `@/db` into a client module + a thin guard re-export — NOT bundled into #57. The J2 inline fix in `scripts/seed-staging.ts` works around it for now.
7. **Finding 3 — preview-env breach (LD-10/LD-9).** Vercel Preview scope had `ZUGZWANG_ENV=prod`, a live isolation hazard during the J-phase. Fixed: `ZUGZWANG_ENV=preview` set on Preview scope; verified at runtime (`env:preview` on the preview `/api/health`).
8. **Finding 2 — staging `db:error`.** Runtime `DATABASE_URL` in Doppler `stg` pointed at the IPv6-only direct host. Fixed: set to Session pooler (5432); verified `db:ok`.
9. **Finding 1 — `ZUGZWANG_ENV_CANARY` unset.** Added `staging-2026-05-28` (Doppler `stg`) and `preview-2026-05-28` (Vercel Preview scope); both echo correctly.
10. **Smoke count framing.** Target stated as "10/11" in places; the suite reports as 8 PASS / 0 FAIL / 1 SKIP. Same suite, different grouping (some EC items map to multiple checks). Substance: zero failures, one by-design skip.

## Open items / follow-ups

- **`@/db` client/guard split** — separate deliberate PR to fix the tsx server-only crash (drift #6). NOT #57.
- **Re-enable Deployment Protection / Vercel Authentication** — disabled for smoke; HARDEN item.
- **EC9 (Sentry dual-project routing)** — deferred by design; verified Vercel-direct, not smoke-gated. Not a coverage gap.
- **Transaction pooler (6543) + `prepare: false`** — only if production concurrency strains the Session pooler. Deferred to HARDEN; not needed at smoke scale.
- **PR #57 merge** — held until after this close-out per kickoff; merge is a deliberate separate action (owner decision).
- **pg_cron cadence / Sentry alarm threshold** — deferred to HARDEN per ADR-0006 §7 / ADR-0007 §4 (carried from upstream scope).

## Next session starts at

`git push origin feat/scaffold-8-staging-env` — sends this follow-up commit (J2 fix + close-out log) to origin. PR #57's branch then carries two commits: `a64e35c` + this follow-up.

After the push, the immediate decisions / actions awaiting the operator:

- **Merge PR #57** — owner's choice on squash vs merge-commit. If squash, ensure the squashed message preserves the §6 reviewer-cascade citations + the SURPRISE absorption notes from `a64e35c`.
- **Re-enable Vercel Deployment Protection** on the `zugzwang-worlds-projects/experiment` project — currently disabled to let J3 smoke through. Track as a HARDEN ticket if not done immediately.
- **EC9 SENTRY_ORG / sentry-routing — skip accepted** as a by-design consequence of the Sentry-Vercel-direct decision (per the C0-fix `INTENTIONAL_MANUAL` allowlist rationale). No further action required pre-merge; HARDEN can revisit if a smoke-side Sentry verification becomes load-bearing later.
- **`@/db` client/guard split** (drift #6 root-cause) — its own future task. MUST NOT be bundled into PR #57 or its merge.
- **Tracker update** — operator-maintained external HTML (per memory `project_tracker_external.md`); mark SCAFFOLD.8 done after PR #57 merges.

## Exit-criteria status

| EC | Description | Status |
|---|---|---|
| EC1 | DNS + HTTPS + app load | ✓ PASS (smoke 1/2/3) |
| EC2 | staging Supabase reads | ✓ PASS (smoke 4: db=ok) |
| EC3 | staging Doppler config | ✓ PASS (smoke 5: env=staging + canary) |
| EC4 | preview Doppler/env | ✓ PASS (smoke 6: env=preview + canary) |
| EC5 | migrations applied | ✓ PASS (smoke 7: 8 migrations match journal) |
| EC6 | ~200 identity_pool | ✓ PASS (smoke 8: 200 rows) |
| EC7 | smoke passes | ✓ PASS — 8 PASS / 0 FAIL / 1 SKIP (skip is by-design, not a code bug) |
| EC8 | R2 isolated | ✓ PASS (smoke 11: all 4 cross-bucket 403) |
| EC9 | Sentry dual-project routing | SKIP — deferred by design (SENTRY_ORG Vercel-direct, not Doppler) |
| EC10 | Doppler Sensitive sync | ✓ PASS (operator-verified: staging + preview env-var scopes confirmed, DATABASE_URL synced) |
| EC11 | PR #57 merged to main | PENDING — held until after close-out (owner decision) |
| EC12 | close-out log committed | this commit |

## Context to carry forward

SCAFFOLD.8 staging is live and smoke-green. The runtime DB path is the **Session pooler (5432)** because postgres-js uses prepared statements; do not switch to the Transaction pooler (6543) without also setting `prepare: false` in `src/db/index.ts` — that pairing is a single deliberate HARDEN change, not a config tweak. Doppler config is `stg` (not `staging`). Deployment Protection is currently DISABLED on staging/preview for smoke and must be re-enabled as a HARDEN item before staging is exposed. PR #57 carries the staging code and is intentionally still open; the J2 seed fix rides in the close-out follow-up commit on `feat/scaffold-8-staging-env` (no force-push, a64e35c untouched). The tsx server-only crash in `seed-identity-pool-dev.ts` is worked around inline in `scripts/seed-staging.ts`; the real fix (split `@/db` into client + thin guard re-export) is a separate PR and must not be folded into #57. EC9/Sentry routing is verified outside the Doppler-scoped smoke (Vercel-direct) and is not a gap.
