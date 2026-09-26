# AWS-MIGRATION-3 — production-readiness changes, implemented on STAGING

**Status:** approved 2026-09-25 (operator), staging-only implementation; `cdk deploy` of the staging
Compute stack gated on a shown `cdk diff`; no commit/push; nothing production is deployed, created,
migrated or re-pointed. Production **config files** may change (values only).

**Source of the requirements:** `docs/aws-migration/08-STAGING-LOAD-TEST-RESULTS.md` §3–§5 (measured on
the OLD staging shape — `t3.small`, 0.5-vCPU share, 1 GiB, ~560 MB default heap). ⚠ Those numbers are
NOT a baseline for the resized staging; any load run after this change is a separate,
production-sized confirmation test owned by the load tester.

## Decisions carried (not re-opened here)
- One task, hard max one (`desiredCount 1`, `maxCapacity 1`) in staging and production — the per-process
  `cacheComponents` cache and one-task `updateTag` make a second task a masking-correctness defect
  (ADR-0051, `production.ts` docblock). No shared cache handler in this lane.
- RDS untouched (never the bottleneck).

## Items and files
| # | Item | Files |
|---|---|---|
| 1 | Node heap bound | `infra/config/types.ts`, `staging.ts`, `production.ts`, `infra/lib/compute-stack.ts` |
| 2 | Keep-alive > ALB idle | same config + `scripts/docker/server-timeouts.cjs` (new), `Dockerfile` runner stage |
| 3 | SQLSTATE 57014 → 503 `error_bet_timeout` | `src/server/bets/errors.ts`, `src/server/bets/transaction.ts` |
| 4 | `/api/ready` warm-up gate | `src/app/api/ready/route.ts` (new), `src/server/health/ready.ts` (new), compute-stack target-group health path + grace period |
| 5 | Write-pause | `src/server/config/writes-paused.ts` (new), `proxy.ts`, config/task env passthrough |
| 6 | Prod migrate applier + workflow | `scripts/migrate-prod.ts`, `.github/workflows/deploy-aws.yml`, `infra/lib/deploy-stack.ts` (new, synth-only), `infra/bin/zugzwang.ts` |
| 7 | Staging resize | `infra/config/staging.ts` |
| 8 | Record | `docs/aws-migration/06-STAGING-DEPLOYMENT.md` §10 |

## Values
| | staging (new) | production (values only) |
|---|---|---|
| host | `t3.medium` | `t3.medium` |
| task cpu / mem / reservation | 1024 / 3072 / 2048 | 1024 / 3072 / **2048** (was 1024) |
| `NODE_OPTIONS` | `--max-old-space-size=2048` | same |
| `KEEP_ALIVE_TIMEOUT` | 65000 ms (headers = +5000 via preload) | same |
| ALB idle | 60 s (unchanged) | same |
| TG health path / grace | `/api/ready` / 180 s | same |
| desired / max tasks | 1 / 1 | 1 / 1 |
| write-pause | `ZUGZWANG_WRITES_PAUSED=paused` (exact), `…_RETRY_AFTER` default 300 | same, unset |

## Test plan (tests first — §5.6)

⚠ **Executed as regression guards, not TDD drivers.** The implementation landed while `@test-writer` was still writing, so no file was red-first; each was written from this plan and proven non-vacuous by an inverted-assertion control (6/6 fail) — the `_probe-*` posture AGENTS.md §9 already records for `I-IDEM-NOMASK-001`.
- `tests/unit/bets/errors.test.ts` — `BetStatementTimeoutError` → 503, code `error_bet_timeout`, `Retry-After` 2.
- `tests/server/bets/statement-timeout.test.ts` — a driver error with `code: "57014"` is NOT retried, is thrown as the typed error, and `captureMessage` is called once; `40001` still retries.
- `tests/unit/config/writes-paused.test.ts` — exact-value gate; boolean-shaped values are NOT paused; retry-after default/parse.
- `tests/unit/middleware/proxy-writes-paused.test.ts` — method × path matrix (bets/uploads/visits/auth/cron/admin POST → 503 with headers; GET reads, `/api/health`, `/api/ready`, static → pass; `Next-Action` header → 503; admin redirect still works when unpaused).
- `tests/server/health/ready.test.ts` — 503 before warm, 200 after, once-per-process memo, a failed/timed-out fetch counts as done, market list read.
- `tests/unit/docker/server-timeouts.test.ts` — preload sets `headersTimeout = keepAliveTimeout + 5000`; no-op without env.
- `tests/unit/scripts/migrate-prod-applier.test.ts` — source scan: `migrate-prod.ts` delegates to `applyMigrationsPerTransaction` and keeps both guards.
- `infra/test/compute-config.test.ts` — synthesized template carries `NODE_OPTIONS`, `KEEP_ALIVE_TIMEOUT`, ready path, grace period; `maxCapacity` 1 → no scaling target.

## Rollout (staging)
1. tests → `just verify` (ZUGZWANG_ENV=preview) → `cdk synth`.
2. `cdk diff Zugzwang-staging-Compute` → **STOP for approval**.
3. Build/push staging image by hand; `cdk deploy` (approved); verify `/api/ready`, `/api/health` canary, one bet, cron, idle 502 = 0 over 1 h; write-pause rehearsal (flag on → 503 → off).

## Risks
The deploy gate is stricter than the readiness contract: `/api/ready` stays 200 with failures (never drains
the target group), but `deploy-aws.yml` refuses to finish unless `failed == 0` — one unrenderable market
blocks that environment's deploys until fixed (deliberate). `memoryReservationMiB 2048` means two tasks no
longer fit on one `t3.medium`: each rolling deploy needs the ASG at 2 instances first (`maxInstances 2`,
managed scaling on); `maxInstances 1` would deadlock a deploy. Staging EC2 replacement (rolling); 57014 mapping is area 1 (status/code only, both reviewers); proxy widening is inert unless the exact value is set; readiness is timeout-bounded; Docker CMD change is runner-only; deploy stack is synth-only until approved.
