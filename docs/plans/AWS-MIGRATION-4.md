# AWS-MIGRATION-4 — production readiness A–J: deploy path, IAM boundary, client-IP fail-closed

**Status:** PROPOSED — awaiting operator approval (CLAUDE.md §5.1: confirmed in CC, then web-Claude
sign-off). HIGH-5 of the 2026-09-26 review: this plan is written **after** the code, by operator
ruling ("do not waive HIGH-5"); it is the contract the working tree is audited against, and nothing is
committed until it is approved. No commit/push; nothing is deployed; no AWS, GitHub, Doppler,
Cloudflare or Vercel change is made by this lane — every such step below is an operator action behind
its own approval.

**Base:** `main` = `0973588` (PR #575: AWS-MIGRATION-3 + S-1, squash). The working tree is exactly
this lane (`git diff origin/main`).
**Record:** `docs/aws-migration/09-PRODUCTION-READINESS.md` (§A–§Q) — the verified facts, procedures,
cutover sequence and pre-cutover checklist. This plan does not restate them; it fixes scope, files,
tests, gates and rollout.

**Critical path touched (CLAUDE.md §1):** areas **1** (bet placement — `betPerIp`) and **4**
(authentication — `adminLoginPerIp`, OTP limit, Better Auth IP) through
`src/server/middleware/client-ip.ts`. Full ritual applies: plan (this) · invariant gate · ADR
(ADR-0061 patched in place, same commit) · pre-PR self-audit §5.10 · `@code-reviewer` then
`@security-auditor`. Everything else is infra/CI/docs (ordinary work), reviewed in the same round.

## Source of the requirements
- ADR-0060 open items and 06 §10.2 (H-3 bootstrap scope, S-1 residue, S-2 action pinning).
- ADR-0061 F1–F6, A2/A6, R1.
- Measured 2026-09-26 (09 "Verified facts"): DNS is **grey-cloud** (neither hostname proxied); the
  account is on the **FREE plan**; no OIDC provider or deploy role exists; bootstrap exec role is
  AdministratorAccess; RDS is private; Vercel production runs `4457354` (no built proxy).

## Decisions carried (not re-opened here)
- One task, hard max one, in both environments (ADR-0051; 06 §10).
- DNS stays **DNS-only** through cutover; orange-cloud requires ADR-0061 F1 first.
- Moderation, invariants, schema, migrations: untouched. **No DDL, no `drizzle/` change.**
- Staging keeps bootstrap qualifier `hnb659fds` (re-pointing a running environment is out of scope).

## Decisions made in this lane (each needs the approval of this plan)
| # | Decision | Why |
|---|---|---|
| D-1 | `CF-Connecting-IP` is believed only when `ZZ_CF_ORIGIN_SECRET` is set **and** presented (fail-closed) | grey-cloud: any Cloudflare-range peer reaching the ALB is a third party choosing its own key (ADR-0061 R1) |
| D-2 | Production gets its own CDK bootstrap qualifier `zzprod` | H-3: staging credentials must not assume production's bootstrap roles |
| D-3 | Migrations run as a one-off **in-VPC ECS task**, fixed family `zugzwang-<env>-migrate`, stable `<env>-migrate` tag + digest check | RDS is private; no DSN through GitHub; migrate-before-serve preserved |
| D-4 | The migrate container receives **only** its two migration secrets | a RunTask override would otherwise exfiltrate all 32 runtime secrets |
| D-5 | Task roles get **explicit names** `zugzwang-<env>-task(-execution)`; PassRole names them exactly | generated names hit the 64-char IAM ceiling; production's would be truncated (measured) |
| D-6 | The deploy workflow requires a `writes: open\|paused` input that must agree with `ZZ_<ENV>_WRITES_PAUSED`; `verify` asserts `writesPaused`; `!cancelled()` gates deploy | the pause is synth-time and failed open on any misspelling |
| D-7 | Production deploys refuse from any ref but `main` (visible failing `guard` job); binding control is the GitHub environment policy + OIDC `sub` customization (operator) | the workflow file is read from the dispatched ref |
| D-8 | WAF: `count` by default in production; staging only with `ZZ_STAGING_WAF=count` | a managed rule set never run against this app can silently 403 a participant's argument |
| D-9 | ALB XFF `append` + `drop_invalid_header_fields` pinned in CDK | ADR-0061 A2/F3 |
| D-10 | Verify gate pins requests to the environment's own ALB (`curl --resolve`) | before cutover `zugzwangworld.com` is Vercel |
| D-11 | All GitHub Actions pinned to commit SHAs | 06 §10.2 S-2 |
| D-12 | `build.env` excluded from git and the Docker build context | it is the full `prd` config |

## Items and files
| # | Item | Files |
|---|---|---|
| 1 | Client-IP fail-closed (D-1) | `src/server/middleware/client-ip.ts`, `tests/unit/middleware/client-ip.test.ts`, `tests/server/middleware/logging.test.ts`, `docs/adr/0061-trusted-client-ip-behind-cloudflare-and-alb.md` |
| 2 | ALB pin (D-9) | `infra/lib/compute-stack.ts`, `tests/unit/infra/alb-client-ip.test.ts` (new) |
| 3 | Bootstrap qualifier (D-2) | `infra/config/{types,staging,production}.ts`, `infra/bin/zugzwang.ts`, `infra/lib/deploy-stack.ts` |
| 4 | In-VPC migrations + least-privilege (D-3, D-4, D-5) | `infra/lib/compute-stack.ts`, `infra/lib/security-stack.ts`, `infra/lib/deploy-stack.ts`, `infra/config/types.ts` (`taskRoleNames`), `.github/workflows/deploy-aws.yml` |
| 5 | Workflow gates (D-6, D-7, D-10) | `.github/workflows/deploy-aws.yml` |
| 6 | WAF mode (D-8) | `infra/config/{types,staging,production}.ts`, `infra/lib/compute-stack.ts` |
| 7 | Action pinning (D-11) | `.github/workflows/{ci,deploy-aws,env-audit,staging-migrate}.yml` (+ scope note in `staging-migrate.yml`) |
| 8 | Secret hygiene (D-12) | `.gitignore`, `.dockerignore` |
| 9 | Guards for 3–6 | `tests/unit/infra/production-readiness.test.ts` (new) |
| 10 | Record | `docs/aws-migration/09-PRODUCTION-READINESS.md` (new), this plan |

**Out of scope (recorded in 09, separate tasks):** F6 global admin cap (needs a ruling); A6 measurement
(staging deploy); `prod-secret.cjs` / production restore runner (production-credential tooling, its own
review); SPEC.2 §3.7 F4 correction; runtime (SSM) write-pause; proxy dot-path matcher; rate-limit
fail-open on Redis loss (M7); Cloudflare-peer detector (M4).

## Invariant gate (§5.7)
No INV-1..4 surface is touched: the only `src/` change is the IP derivation, which writes nothing and
opens no new `null` path (ADR-0061 M-1 unchanged). Confirmed independently by both reviewers.
`pnpm test:invariants` / `test:integration` need a local Postgres (absent on this machine) — CI runs
them on the PR and is the gate for them.

## Test plan (§5.6)

⚠ **Executed as regression guards, not TDD drivers** — the code was written before this plan, so no
file could be red-first. Each guard's proof is a **mutation check** (rule reverted → red → restored),
the `_probe-*` posture AGENTS.md §9 records.
| Guard | Asserts | Mutation proof |
|---|---|---|
| `client-ip.test.ts` WARP row + FAILS-CLOSED row | unset secret → edge address, forged header never returned | revert to "trust when unset" → 2 red |
| `client-ip.test.ts` "missing / malformed" block (now under the zone secret) | `?? peer` fallback for a missing/invalid header | delete `?? peer` → 8 red |
| `logging.test.ts` | log `ip` takes `CF-Connecting-IP` only from our zone | — (consumer update) |
| `alb-client-ip.test.ts` | ALB props carry `APPEND` + drop-invalid (source scan) | flip to PRESERVE / delete → red (reviewer-verified) |
| `production-readiness.test.ts` | qualifiers per environment; deploy ARNs built from the loop's qualifier; `taskRoleNames` ≤ 64 and used for creation + PassRole; migrate container has no `...secrets`; WAF defaults | hard-code `hnb659fds` in deploy-stack → red; invert WAF ternary → red |

Plus: `tsc` (app + `infra`); `biome check .`; `cdk synth` of all 12 environment stacks **and**
`Zugzwang-Deploy` (`-c deployStack=true`) with the synthesized properties read back; every workflow
`run:` block through `bash -n`; YAML parse; zero unpinned `uses:`.

## Review record (2026-09-26, both run against the working tree)
- `@code-reviewer`: 0 CRITICAL, 5 HIGH, 10 MEDIUM, 8 LOW.
- `@security-auditor`: 0 CRITICAL, 4 HIGH, 7 MEDIUM, 9 LOW.
- ⚠ §5.11 deviation: neither reviewer was handed this plan (it did not exist); both reviewed against 09
  + ADR-0061. The code-reviewer's HIGH-5 is this plan.
- Disposition: every HIGH is fixed in code/tests, or written into the governing 09 section as an
  operator action or blocker; each MEDIUM/LOW is fixed, documented, or listed as out of scope above.

## Rollout
**Phase R0 — this lane (no external change).**
1. Operator approves this plan (CC) → web-Claude sign-off.
2. Pre-PR self-audit (§5.10) against the Items table, item by item — PASS / FAIL / SURPRISE.
3. New branch from `origin/main` (the old `feat/aws-migration` was squash-merged); one commit with this
   plan, 09 and the code; push; PR; CI green (it runs invariants + integration). **STOP** for merge
   approval.

**Phase R1 — staging deploy path (each step behind its own approval; staging-only effect).**
4. `cdk deploy Zugzwang-Deploy -c deployStack=true` (creates the OIDC provider + roles) — **account IAM
   change**; show the template first. Customize the repository OIDC `sub` to carry `ref` before any
   production role is trusted (09 §C).
5. GitHub `staging` environment: `AWS_DEPLOY_ROLE_ARN`, `DOPPLER_TOKEN` (stg), `ZZ_STAGING_CERT_ARN`,
   `ZZ_ALERT_EMAIL`.
6. Show `cdk diff Zugzwang-staging-*` → **STOP**. Expected: migrate task definition replaced, both task
   roles replaced (explicit names), ALB attributes added, new outputs.
7. Dispatch 1: `staging, skip_migrations: true, writes: open`. Dispatch 2: `staging, writes: open`.
   Verify: canary, `/api/ready failed:0`, `writesPaused:false`, one bet, cron firing, 0 ELB 5xx.
8. A6 measurement and the WAF count rehearsal (`ZZ_STAGING_WAF=count`) — each its own approval.

**Phase R2 — production** is NOT in this plan's authority. It follows 09 §K and starts only on an
explicit operator approval of the production deployment, after every §P row is ✅.

## Risks
- **Staging task-role replacement (D-5)** on the next staging deploy: new role → new task-definition
  revision → one rolling update (`minHealthyPercent 100`, proven on staging 06 §10.5). Reversible by
  redeploying the previous commit.
- **First run is two dispatches** (D-3): the migrate job needs outputs only the new Compute stack has;
  dispatch 1 on a *new* environment fails `verify` by design (unmigrated DB).
- **Migrate task as ad-hoc engine runner is retired** (D-4) — the 06 §10.6 void method needs a
  different task definition next time.
- **Fail-closed IP (D-1)** changes nothing for honest users today (grey-cloud: WARP users send no
  `CF-Connecting-IP`); if the zone is orange-clouded without F1, per-IP limits collapse to per-edge
  (security M4) — documented as a prerequisite, with a detector as follow-up.
- **A6 unmeasured** — the one known path by which a client might still choose its key on AWS
  (security H1). LAUNCH BLOCKER in 09 §A/§P; not a blocker for staging.
- **FREE plan** — credits ≈ one month of production; account closure is an outage by design. Blocks
  Phase R2, not this lane.
