# ADR-0060 — Production readiness on AWS: bounded heap, keep-alive, readiness gate, write-pause, timeout wire code

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-25 |
| **Deciders** | Hrishikesh (operator), Claude Code |
| **Tracker task** | AWS-MIGRATION-3 |
| **Frame document** | SPEC.2 §4 (deployment), §9 (bet concurrency), §15.4 (wire-code catalogue, 2.2.2), §17 (observability) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0013 — the answer given for a `statement_timeout` (SQLSTATE 57014) inside the bet transaction moves from `error_internal` (500) to `error_bet_timeout` (503 + Retry-After); the retry classification itself is unchanged |
| **Amended-by** | — |

---

## Context and Problem Statement

The staging load test (`docs/aws-migration/08-STAGING-LOAD-TEST-RESULTS.md`) measured, on the old
staging shape, four things that are decisions rather than tuning: the Node process reached its
default V8 heap ceiling after ~1,500 bets and spent ~0.9 vCPU in garbage collection at zero load
until an operator restarted it; the ALB re-used sockets Node had already closed (a 0.1–0.5 %
`HTTPCode_ELB_5XX` floor on every level); a `statement_timeout` under pool-row contention surfaced
as `500 error_internal` five times with nothing in logs or Sentry; and a task two and a half
minutes old collapsed under twelve concurrent users because it joined the load balancer cold.
Separately, the production cutover needs a way to stop writes to the source database for the
final sync, and the application had no such switch.

This ADR records what was decided about each and why the shape is what it is. It is applied to
staging first (`docs/plans/AWS-MIGRATION-3.md`); production carries the same values.

This ADR does **not** decide:
- Where the database lives or how it is migrated (ADR-0059).
- How many tasks run. One task with a hard maximum of one stands (ADR-0051: the `cacheComponents`
  cache is per process and a moderation `updateTag` reaches one task) until a fleet-wide cache
  invalidation is decided in its own ADR.
- Cache keying or the shared block store (ADR-0051).
- The trusted client-IP source behind the ALB (open; `06-STAGING-DEPLOYMENT.md` §10.2 S-1).
- CDK bootstrap execution-role scope (open; §10.2 H-3).

## Decision Drivers

1. A failure that needs an operator at 3 a.m. is worse than a slower steady state — the GC storm
   did not recover on its own; a bounded heap either fits or is killed and restarted by ECS.
2. Every control must fail closed on the next change nobody remembered: a route allowlist, a
   method-derived "write", an env value read at synth time without a guard, each failed exactly
   that way during review.
3. The idempotency law (ADR-0031/0044): a client retry under the same key must replay the durable
   receipt, never execute twice — so a rolled-back timeout must be an uncached 503 the client
   treats as transient, not a 500 it treats as terminal.
4. A task must not receive traffic it cannot yet serve, but a page that cannot render must never
   leave a service with zero healthy targets.
5. Nothing production-shaped is decided from an estimate; each number here is measured (§3 of the
   results document) or derived from a measured limit.

## Considered Options

1. **Bounded heap + keep-alive + readiness path + request-level write-pause + typed timeout code** ← chosen
2. Raise the container memory only, leave Node's default heap — rejected: the default is a fraction
   of the container and the storm recurs at a higher number.
3. Warm the task from the deploy pipeline instead of in-process — rejected: the ALB, not the
   pipeline, decides when a task gets traffic; a readiness path is what the ALB can consult.
4. Write-pause inside each handler — rejected: Server Actions and the OAuth callback are writes that
   no handler list would have named; the request proxy sees all of them.
5. Retry 57014 inside the bet transaction budget — rejected: a lock wait that spent its full second
   spends the next one the same way; the client's retry (durable replay) is the right place to wait.

## Decision

1. **Heap.** `NODE_OPTIONS=--max-old-space-size=<nodeMaxOldSpaceMiB>` on the app container, at or
   below ~70 % of `memoryMiB` (2048 of 3072), with `memoryReservationMiB` raised to match so ECS
   places on what the process will use. Consequence: two tasks no longer fit on one `t3.medium`;
   a rolling deploy needs the ASG at two instances (`maxInstances 2`, managed scaling).
2. **Keep-alive.** `KEEP_ALIVE_TIMEOUT=65000` (Next's standalone server reads it) with a preload
   (`scripts/docker/server-timeouts.cjs`) that sets `headersTimeout` 5 s above it; the ALB idle
   timeout stays 60 s. The preload is a no-op without the variable and clamps an oversized value.
3. **Timeout wire code.** A `statement_timeout` abort (57014) inside `runBetTransaction` is thrown as
   `BetStatementTimeoutError` → `503 error_bet_timeout`, `Retry-After: 2`, not retried server-side,
   uncached (≥500), registered as transient in the composer state map, and reported to Sentry as
   `bet_statement_timeout`.
4. **Readiness.** `/api/ready` is the target-group health check (grace 180 s); it answers 503 until
   the process has fetched, through its own port, `/`, every Open market and one profile — draining
   each body and counting a non-2xx or a timeout as `failed`. It answers 200 once it has *tried*,
   with counts only; the deploy workflow additionally requires `failed == 0`. `/api/health` stays
   the container check and the deploy canary.
5. **Write-pause.** `ZUGZWANG_WRITES_PAUSED=paused` (exact value) makes `proxy.ts` answer every write
   with `503 error_writes_paused` + `Retry-After` before any reservation: any request with a
   `Next-Action` header, any non-read method under the write prefixes, every method under
   `/api/auth/` except `get-session`/`ok`, and the cron GETs. The matcher is a catch-all that
   excludes only static assets. Reads, `/api/health` and `/api/ready` are untouched; `/api/health`
   reports `writesPaused`. The flag is a task-environment value carried through the deploy
   workflow from the GitHub environment (never a secret).
6. **Repeatable deployment.** `deploy-aws.yml` refuses to synth without the environment's
   certificate ARN and alert address; `Zugzwang-Deploy` (GitHub OIDC provider + one deploy role per
   environment, trust pinned to `repo:<owner/repo>:environment:<name>`) exists only under
   `-c deployStack=true` and imports an existing provider when given one.

## Consequences

- Positive: the GC-storm class is bounded by configuration; the 502 floor has a mechanical cause
  removed; a timeout is honest on the wire and safe for the idempotency law; a cold task never
  takes traffic; the cutover has a write freeze that fails closed on unlisted routes.
- Negative / accepted: while paused, admin login, moderation and the cron rules also answer 503
  (the `FailedInvocations` alarms will trip for the window); one unrenderable market blocks that
  environment's workflow deploys until fixed; browser navigations during a pause see a JSON
  envelope.
- Open, recorded in `06-STAGING-DEPLOYMENT.md` §10.2: bootstrap execution-role scope (H-3),
  trusted client IP behind the ALB (S-1), action pinning (S-2).

## Verification

`tests/unit/{bets/statement-timeout-error,config/writes-paused,middleware/proxy-writes-paused,
docker/server-timeouts,scripts/migrate-prod-applier,infra/environment-config}.test.ts`,
`tests/server/{bets/statement-timeout,health/ready}.test.ts`, `tests/unit/composer/state-map.test.ts`
(transient family), `tests/server/health/region.test.ts` (health contract incl. `writesPaused`);
the staging `cdk diff` and the write-pause rehearsal in the plan's rollout.
