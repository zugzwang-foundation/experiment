# SCAFFOLD.8 — Staging environment plan

> **Status:** Plan draft, ready for web Claude review (round 1).
> **Brief:** `/Users/hrishikesh/Downloads/SCAFFOLD.8-staging.md` (not yet committed to repo; commit to `docs/plans/SCAFFOLD.8-staging.md` ships in execute-chat first commit).
> **Final plan path:** `docs/plans/SCAFFOLD.8-staging-plan.md` (committed at ExitPlanMode).
> **Predecessor session:** SCAFFOLD.18 execute (PR #54 merged `e080dab` 2026-05-27 07:06 UTC). Close-out log on unmerged branch `chore/scaffold-18-execute-log @ 74c72c3` — lands as standalone chore PR before SCAFFOLD.8 execute begins.
> **Successor session:** SCAFFOLD.8 execute (web Claude + CC pair).

---

## Context

SCAFFOLD.8 stands up a staging environment: a parallel always-on substrate (Supabase + Vercel + Doppler + R2 + Sentry) at `staging.zugzwangworld.com` that the operator uses for UI iteration, design trials, integration testing, and (Bundle 3b) k6 load testing — without touching prod. The plan also lands three pieces of hardening that arrived via research-pass and are load-bearing for prod safety even before staging exists: (a) `getRedisKey()` env-prefix discipline so the shared Upstash instance can't cross-contaminate prod/staging rate-limit + idempotency + lock state, (b) Better Auth `trustedOrigins` per-environment with separate `BETTER_AUTH_SECRET` per scope, (c) Sentry split-project posture (separate `zugzwang-staging` Sentry project, not env-tag on shared project — Sentry has a documented issue-regression bug with cross-env tags). Twelve exit criteria; ten-item smoke test; reviewer cascade on the two hardening PRs.

---

## §0 Brief acknowledgment

This plan consumes the brief verbatim as canonical input. Eight sections acknowledged:

| Brief § | Substance | Plan section that consumes |
|---|---|---|
| §0 Scope + exit criteria | In/out scope; 12 ECs; non-criterion; critical-path classification | §3 (step plan respects scope boundaries); §7 (verification confirms 12 ECs) |
| §1 Locked Decisions (LD-1 through LD-11) | 11 LDs ratified | §2 (each LD enforced in the step plan); §4 (code shapes derive from LDs) |
| §2 Open Questions (OQ-1 through OQ-12) | 12 OQs + boundary verdicts | §1 (per-OQ verdict table with overrides + new OQ-13/14/15) |
| §3 Input contract sources | Tier 1–5 reads | (Implicit — CC reads ADRs + SPECs already loaded via CLAUDE.md context) |
| §4 Risk register | 8 risks + mitigations + detection | §5 (each risk acknowledged with planned implementation point) |
| §5 Test plan | Smoke (Layer 1) + unit (Layer 2) + EC (Layer 3) | §4 (code shapes for smoke + unit tests); §7 (verification) |
| §6 Step sequence | 8 O + 13 C + 3 J steps with phase ordering | §3 (step plan; one row per brief step + 3 added rows for new OQ-13/14/15 resolutions) |
| §7 Self-critique | 5 hole categories | §6 (self-critique extends brief's, with plan-time additions from pre-flight) |
| §8 Brief provenance | Authorship, inputs, ratifications, contingencies | (Acknowledged here — contingency trigger #3 fires, see §1 below) |

---

## §1 OQ verdicts + plan-time SURPRISEs

### §1.1 Brief §2 OQ-1 through OQ-12 verdicts

All 12 brief boundary verdicts ACCEPTED (no overrides). Pre-flight verification per OQ:

| OQ | Brief verdict | Plan accepts? | Pre-flight verification |
|---|---|---|---|
| OQ-1 | Default Custom-Env sync available; fall back to 2-scope if not | **ACCEPT** | Operator-only at O3a — pre-flight cannot verify Doppler dashboard state |
| OQ-2 | YES — preview gets full auth env vars | **ACCEPT** | Confirmed: `src/server/auth/index.ts` is the load-bearing init; `src/lib/auth-client.ts` + 6 OAuth callback flows in repo. Auth IS exercised on every deploy that serves the app shell. |
| OQ-3 | Extend `/api/health` if exists, else create same-shape route | **ACCEPT — create net-new** | Pre-flight: `/api/health` **does not exist**. `src/app/api/` has `auth/`, `cron/`, `uploads/` only. C6 creates `src/app/api/health/route.ts` from scratch with the brief-specified shape. |
| OQ-4 | Guarded `scripts/migrate-staging.ts` with assert | **ACCEPT** | Existing `scripts/` directory pattern: `tsx scripts/<name>.ts` wired in `package.json` `scripts:` block. Three existing scripts: `seed-identity-pool-dev.ts`, `seed-identity-pool.ts`, `verify-identity-pool.ts`. |
| OQ-5 | Explicit `ZUGZWANG_ENV` per Doppler config; init-time check | **ACCEPT — `instrumentation.ts` is the host** | Pre-flight: `src/lib/env.ts` **does not exist**; `instrumentation.ts` does, with a `register()` hook that Next.js calls once per runtime startup. C2 adds the validation inside `register()` before Sentry dispatch. No net-new file needed. |
| OQ-6 | Per-bucket R2 token (Option A) | **ACCEPT with caveat — see SURPRISE-1** | Pre-flight: repo has TWO R2 buckets (`zugzwang-uploads` + `zugzwang-pfp`), not the single `zugzwang-prod` the brief LD-2 table assumes. See §1.2 SURPRISE-1 + new OQ-13. |
| OQ-7 | Pin to current lockfile version | **ACCEPT — already done** | Pre-flight: `package.json` already has `"better-auth": "1.6.11"` (literal pin, no caret). Per my memory pin `feedback_vendor_dep_literal_pins.md`. C5 substep (a) becomes verify-only. |
| OQ-8 | `staging` + `preview` config names | **ACCEPT** | Confirmed via SCAFFOLD.13-B reads — Doppler `prd` config exists with that exact name; staging/preview match Vercel terminology. |
| OQ-9 | `ZUGZWANG_ENV_CANARY` per-config differs | **ACCEPT** | Plan adds explicit canary values: `prod-2026-05-27`, `staging-2026-05-27`, `preview-2026-05-27` (operator regenerates date at execute time). |
| OQ-10 | No branch protection on `staging` | **ACCEPT** | Per brief rationale (fast iteration > PR overhead for throwaway env). |
| OQ-11 | Pre-flight Vercel env-var audit; all must be Doppler-sourced | **ACCEPT** | Plan adds `pnpm vercel-env-audit` script design (§4.6) per Risk 2 mitigation. |
| OQ-12 | YES — keep `environment: process.env.ZUGZWANG_ENV` in Sentry SDK init | **ACCEPT** | Pre-flight: 3 Sentry init files (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) currently do NOT pass `environment`. C-step (folded into C5/C6 — see §3) adds the `environment` field to all 3. |

### §1.2 Plan-time SURPRISEs (brief §8 Contingency trigger #3)

Pre-flight surfaced 9 places where reality differs from brief assumption. Each surfaced + classified.

| # | Surface | Brief assumption | Reality | Classification | Plan action |
|---|---|---|---|---|---|
| 1 | **R2 buckets** | Single `zugzwang-prod` bucket per LD-2 env-var table | TWO buckets per `.env.example` + `docs/parked.md` SCAFFOLD.15 references: `zugzwang-uploads` (dynamic signed-PUT) + `zugzwang-pfp` (static pre-baked PFPs). Env vars are `R2_ACCESS_KEY_ID_UPLOADS` / `R2_SECRET_ACCESS_KEY_UPLOADS` (separate per bucket); also `R2_ACCOUNT_ID`, `R2_ENDPOINT_*`, `R2_PUBLIC_URL_PFP`. | **New OQ-13** (see §1.3) | Operator decides scope at plan-time |
| 2 | **Better Auth version pin** | Currently caret-ranged `^X.Y.Z`; change to exact | Already exact `1.6.11` per literal-pin discipline (memory `feedback_vendor_dep_literal_pins.md`). | In-flight reconciliation | C5 substep (a) becomes verify-only — read `pnpm-lock.yaml`, confirm matches, no edit |
| 3 | **Sentry DSN env var name** | `SENTRY_DSN` per LD-2 table | All 3 Sentry init files read `NEXT_PUBLIC_SENTRY_DSN` (client-exposed because it's needed in `instrumentation-client.ts` for the browser SDK) | In-flight reconciliation | Authoritative env-var inventory uses `NEXT_PUBLIC_SENTRY_DSN`; brief table simplification is harmless |
| 4 | **PostHog env var names** | `POSTHOG_KEY` per LD-2 table | `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` (client-exposed) | In-flight reconciliation | Authoritative inventory uses prefixed names |
| 5 | **Turnstile env var names** | `TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY` per LD-2 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (site key client-exposed) | In-flight reconciliation | Authoritative inventory uses prefixed name for site key |
| 6 | **Missing env vars in LD-2 table** | Table covers ~12 vars | Repo has additional env reads: `CRON_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL`, `RESEND_FROM_EMAIL`, `R2_ACCOUNT_ID`, `R2_ENDPOINT_UPLOADS`/`R2_ENDPOINT_PFP` (per per-bucket scheme), `R2_PUBLIC_URL_PFP`, `DATABASE_URL_STAGING` (new, for migration script) | Per brief LD-2 line 168 ("Plan-mode CC produces authoritative complete list against current repo state") — this is the brief's *expected* completion path | C-step C0 (new, see §3) catalogs all env reads via grep + produces authoritative table; operator populates Doppler per table |
| 7 | **Better Auth `trustedOrigins`** | LD-11(c) says "set `trustedOrigins` per scope" | Current `src/server/auth/index.ts` has NO `trustedOrigins` field in `betterAuth({...})` config | Net-new code addition | C5 substep (b) adds `trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map(s => s.trim())` to betterAuth config |
| 8 | **Google OAuth staging redirect URI** | Brief doesn't address Google OAuth client redirect URIs for staging | `docs/parked.md` SCAFFOLD.3-FOLLOWUP-1 §10 documents that preview OAuth NEVER worked because Google redirects to apex. Staging.zugzwangworld.com will hit the same issue unless `https://staging.zugzwangworld.com/api/auth/callback/google` is added to Google OAuth client's authorized redirect URIs. | **New OQ-14** (see §1.3) | Operator decides at plan-time |
| 9 | **Vercel cron firing on staging** | Brief doesn't address `vercel.json` cron behavior across environments | `vercel.json` has `"crons": [{"path": "/api/cron/r2-orphan-sweep", "schedule": "0 */6 * * *"}]`. Vercel applies crons to Production env by default. For Custom Environments, cron behavior on a non-production Custom Env requires explicit verification — Vercel docs say crons can be set per-env via vercel.json or dashboard. **Implication**: staging R2 bucket needs its own orphan sweep, OR we explicitly skip cron on staging. | **New OQ-15** (see §1.3) | Operator decides at plan-time |
| 10 | **R2 bucket names hardcoded** (surfaced at web Claude review round 1 — grep for env-var-driven bucket resolution per Item 3 (b) inventory) | LD-2 + `.env.example` imply env-var-driven bucket names | `src/server/storage/r2.ts:54,69` hardcodes `"zugzwang-uploads"` and `"zugzwang-pfp"` as string literals inside `resolveBucketEnv()`. Staging cannot use staging-specific buckets without code refactor. Per OQ-13 locked verdict (2 staging buckets), code refactor is required to land OQ-13. | Net-new code addition (small) | **New C4b step** (see §3) — refactor `resolveBucketEnv()` to read `process.env.R2_BUCKET_UPLOADS` + `process.env.R2_BUCKET_PFP`; add to `.env.example` with current hardcoded names as defaults to preserve prod behavior. |

### §1.3 New OQ-13 / OQ-14 / OQ-15 (per brief §8 Contingency trigger #3)

Each carries a boundary verdict per brief discipline; operator overrides at plan-mode kickoff if needed.

**OQ-13 — R2 staging scope: 2 buckets vs. 1 bucket + share pfp** *(status: RATIFIED — web Claude review round 1, 2026-05-27)*

- **Question:** Brief LD-2 assumes single `zugzwang-staging` R2 bucket. Repo has 2 prod buckets (`zugzwang-uploads` + `zugzwang-pfp`). Provision 2 staging buckets, or only `zugzwang-uploads-staging` and share the read-only pfp bucket between prod and staging?
- **Why it matters:** Shared pfp bucket = simpler setup + cost savings + staging UI can render real PFPs without re-uploading. But: staging code writing PFPs to a shared bucket could affect prod. Per LD-10 spirit (env-scoped isolation), shared pfp = mild posture violation.
- **Resolution:** Web Claude ratified Option A (2 buckets, 2 bucket-scoped tokens) at review round 1.
- **Locked verdict:** **Option A** — provision **2 staging buckets** (`zugzwang-uploads-staging` + `zugzwang-pfp-staging`). Two staging tokens: `zugzwang-uploads-staging-rw`, `zugzwang-pfp-staging-rw`. Each bucket-scoped per OQ-6. Rationale: matches brief's isolation discipline; staging UI work may want to re-bake PFPs without affecting prod. Marginal cost: R2 free tier covers <10GB; staging adds <100MB across both buckets.
- **Sub-step impact:** O5b expands to 2 bucket creates + 2 token creates instead of 1 each. Env vars added to staging Doppler config split by inheritance:

  | Var | Status | Staging value |
  |---|---|---|
  | `R2_ACCOUNT_ID` | shared with prod | identical (single CF account) |
  | `R2_ENDPOINT_UPLOADS` | shared with prod | identical (`https://<account_id>.r2.cloudflarestorage.com`) |
  | `R2_ENDPOINT_PFP` | shared with prod | identical (same URL — R2 routes by bucket via S3 path/Host, not endpoint) |
  | `R2_BUCKET_UPLOADS` | staging-specific | `zugzwang-uploads-staging` |
  | `R2_BUCKET_PFP` | staging-specific | `zugzwang-pfp-staging` |
  | `R2_ACCESS_KEY_ID_UPLOADS` + `R2_SECRET_ACCESS_KEY_UPLOADS` | staging-specific | bucket-scoped staging token |
  | `R2_ACCESS_KEY_ID_PFP` + `R2_SECRET_ACCESS_KEY_PFP` | staging-specific | bucket-scoped staging token |
  | `R2_PUBLIC_URL_PFP` | staging-specific | new `pub-<hash>.r2.dev` minted per staging pfp bucket |

  **Citation:** `.env.example` SCAFFOLD.15 commentary (line ~57–60) reads "R2_ENDPOINT_* is the bucket-scoped S3-compat endpoint: `https://<account_id>.r2.cloudflarestorage.com` (R2 routes by bucket via Host header; the same endpoint serves both buckets...)." Staging extends the same logic — same CF account = same endpoint URL. (If this needs external confirmation at execute time, developers.cloudflare.com/r2 S3-compat docs are the authoritative source.)

  **Bucket-scoped tokens are the only delta from prod credentials.** All other staging-specific R2 deltas are bucket-name strings, not infrastructure.
- **Verification at C8a:** test BOTH staging tokens against BOTH prod buckets (4 HEAD requests, all must return 403).

**OQ-14 — Google OAuth client redirect URI for staging** *(status: RATIFIED — operator at plan-mode kickoff 2026-05-27)*

- **Question:** Should `https://staging.zugzwangworld.com/api/auth/callback/google` be added to the Google OAuth client's authorized redirect URIs as part of SCAFFOLD.8?
- **Why it matters:** OAuth on staging is broken by default until this is done. Brief LD-2 boundary verdict on OQ-2 says preview gets full auth env vars (implying auth must work). Staging is a Custom Env (not Preview alias) so the parked.md M1 (BETTER_AUTH_URL flip) doesn't directly apply — staging has its OWN durable URL — but Google's OAuth client still needs to allow it.
- **Why brief missed it:** Brief LD-2's BETTER_AUTH_TRUSTED_ORIGINS column doesn't cross-reference Google's authorized redirect URIs (which live in Google Cloud Console, not Better Auth config). Brief §7 self-critique flags "no pre-flight check that the experimental repo state matches my assumptions" — this is a parked-state cross-reference miss.
- **Resolution mechanism:** Operator decides at plan-mode kickoff.
- **Boundary verdict (default):** **YES — add staging redirect URI as a new operator step O3b** (between O3a and O4). Operator action: Google Cloud Console → OAuth client → Authorized redirect URIs → add `https://staging.zugzwangworld.com/api/auth/callback/google`. ~5 min. Same Google OAuth client serves prod + staging (separate clients would be over-engineering for a 7-week experiment).
- **Sub-step impact:** O3b added (operator); no CC code change. Smoke test item #11 (new — see §4 below) verifies staging signup-with-Google flow works (or item folds into manual verification per brief §5 "Tests NOT added in SCAFFOLD.8").
- **Notes:** Preview alias OAuth remains broken per `docs/parked.md` M1/M2 — out of SCAFFOLD.8 scope. Preview signups would use Email-OTP only.

**OQ-15 — Vercel cron behavior on staging Custom Environment** *(status: RATIFIED — operator at plan-mode kickoff 2026-05-27)*

- **Question:** `vercel.json` has a 6-hourly cron for `/api/cron/r2-orphan-sweep`. Does this cron fire on the staging Custom Environment, on prod only, or on both? If it fires on staging, what bucket does it sweep (staging or prod)?
- **Why it matters:** Staging cron firing against staging R2 bucket = correct isolation (each env sweeps its own orphans). Staging cron firing against prod R2 bucket = unsafe (staging deploy could delete prod objects). Staging cron NOT firing = staging R2 bucket accumulates orphans over time (mild — staging is throwaway).
- **Why brief missed it:** Brief §3 Tier 1 listed ADR-0006 (Hosting) as a constraint but didn't enumerate the cron surface. SCAFFOLD.15 carry-forwards into staging weren't reviewed.
- **Resolution mechanism:** Operator decides at plan-mode kickoff. Vercel docs (per knowledge update 2026-02-27) say crons are set per-env via vercel.json `crons` field; per-env cron-disable is via dashboard. Plan assumes Vercel applies vercel.json crons to all environments where the deploy is live (including Custom Envs) unless explicitly excluded.
- **Boundary verdict (default):** **Option A — cron fires on staging, sweeps staging bucket.** Mechanism: r2-orphan-sweep route uses the staging R2 token (from staging Doppler config) which is bucket-scoped to staging → sweeps staging bucket only by construction. No code change needed; isolation is enforced by token scope (per OQ-13) AND env-driven bucket name (per C4b — see §1.2 SURPRISE-10). Net effect: staging keeps its own bucket clean; prod cron untouched.
- **Cross-validation (web Claude review round 1):** Cron route's resolution path traced in plan mode — `src/app/api/cron/r2-orphan-sweep/route.ts` imports `deleteObject` from `@/server/storage/r2`, calls `sweepOrphans({deleteObject, ...})`, which calls `deleteObject("uploads", key)`. `deleteObject` in r2.ts routes through `getClient()` → `resolveBucketEnv()`. After C4b refactor, staging env's `process.env.R2_BUCKET_UPLOADS=zugzwang-uploads-staging` flows through this chain. Cron route does NOT hardcode bucket names; OQ-15's "by construction" verdict holds.
- **Sub-step impact:** None — relies on existing route code + Doppler scoping. Smoke test item #12 (optional): verify staging cron fires within 6h of staging deploy by checking Sentry breadcrumb count for `kind: "orphan_sweep_handler_failure"` tag (should be 0 if cron is healthy). Brief defers this kind of check to "verify next time you touch staging" — accept the deferral.

### §1.4 Brief §7 self-critique holes — plan resolution

Brief §7 raised 5 hole categories. Plan addresses each:

| Hole | Brief flag | Plan action |
|---|---|---|
| Doppler Custom Env sync undertested | OQ-1 mitigates; treat O3a as a true gate | O3a step body explicit: "If Custom Env sync target NOT visible → STOP. Surface to chat. Brief amendment to LD-2 fallback required." Plan-mode CC pre-stages the 2-scope LD-2-fallback text (§8 in plan body) for fast brief amendment if Risk 1 fires. |
| PostHog environment-split deferred without evidence | Deferred to Stage 2 | Plan inherits the deferral; staging PostHog events tag `environment=staging` against shared project per LD-2. No additional CC work. |
| Vercel Custom Env + `VERCEL_ENV` behavior unverified | OQ-5 picks explicit `ZUGZWANG_ENV` | C2 init-time check fail-fast on missing/invalid `ZUGZWANG_ENV` — code path doesn't read `VERCEL_ENV`. Risk acknowledged: if a third-party SDK (Sentry / PostHog) reads `VERCEL_ENV` internally, behavior on Custom Env is unverified. Mitigation: OQ-12 keeps explicit `environment` field on Sentry SDK init; PostHog has no environment-routing in v1. |
| Migration rollback on staging failure not specified | Brief: drop+re-provision staging | Plan adds a one-line note to `scripts/migrate-staging.ts` error path: "Migration failed mid-run. Investigate failed migration; fix forward; re-run. If unrecoverable: drop staging schema and re-run." Matches brief §7. |
| No automated Doppler sync rollback | Per-sync checkpointing in O5 | Plan adds explicit sub-checkpoints to O5: after each of 3 syncs, verify Sensitive toggle ON + sync status green BEFORE proceeding to next sync. |
| `getRedisKey` linter rule deferred | Brief: HARDEN-phase | Plan: agree; SCAFFOLD.8 ships catalog + unit tests; lint rule is a HARDEN-phase carry-forward. |
| Brief authored before research-pass | Process learning | Plan inherits process learning for SCAFFOLD.9 brief drafting. |
| No pre-flight check that repo state matches brief assumptions | Plan-mode CC adds it | ✅ DONE — §1.2 surfaced 9 SURPRISEs. |

---

## §2 Locked Decisions consumed (brief §1 LD-1 through LD-11)

Plan respects all 11 LDs verbatim. Quick acknowledgment:

| LD | Title | Consumed at |
|---|---|---|
| LD-1 | Staging DB substrate (separate Supabase Pro project) | O1 + LD-2 env-var map |
| LD-2 | Doppler 3-scope + Vercel Custom Env (with fallback to 2-scope) | O3a + O4 + O5 + §1.3 OQ-13 |
| LD-3 | DNS + Vercel alias topology | O5 + O6 + O7 |
| LD-4 | Migration parity + ~200-row identity_pool dev-seed | C7 + J1 + C8 + J2 |
| LD-5 | 10-item smoke test (item #10 = journal parity) | C9 + J3 |
| LD-6 | 8 O + 13 C + 3 J split (+3 new from OQ-13/14/15 if accepted) | §3 step plan |
| LD-7 | Critical-path: NOT critical-path-by-function; security-auditor recommended on C3+C4 + C9 | §5 reviewer cascade plan |
| LD-8 | SCAFFOLD.9 split out (Bundle 3b) | Out of scope — confirmed in this plan |
| LD-9 | Sentry split-project (`zugzwang-prod` + `zugzwang-staging`) | O5a + §4.1 |
| LD-10 | Upstash key-prefix discipline via `getRedisKey()` helper | C3 + C4 + §4.2 |
| LD-11 | Better Auth: separate secret per scope + host-only cookies + version pin + `trustedOrigins` | C5 + §4.4 |

---

## §3 Step plan (matches brief §6 with additions)

### §3.A Authoritative env-var inventory (executed at plan-time per brief LD-2 line 168)

Source: `grep -rh "process\.env\." src/ + repo-root configs | grep -oE "process\.env\.[A-Z_0-9]+" | sort -u`. Cross-referenced with `.env.example`. Grouped by scope; operator populates Doppler at O4 per per-env value column.

#### Per-env (19 vars — different value in each Doppler config)

| Var | Read by | Prod source | Staging value |
|---|---|---|---|
| `ZUGZWANG_ENV` (NEW) | `instrumentation.ts` (C2), `src/server/upstash/keys.ts` (C3) | n/a (NEW — `prd` gets `prod` in same PR) | `staging` (preview: `preview`) |
| `ZUGZWANG_ENV_CANARY` (NEW) | `src/app/api/health/route.ts` (C6) | n/a (NEW) | `staging-2026-05-27` (preview: `preview-2026-05-27`) |
| `DATABASE_URL` | `src/db/*` (postgres client) + `drizzle.config.ts` | Doppler `prd` pooled URL | new pooled URL from O2 (preview: SAME as staging — preview shares staging DB per LD-2) |
| `BETTER_AUTH_SECRET` | `src/server/auth/index.ts:32` | Doppler `prd` (UNCHANGED per Risk 7) | NEW (`openssl rand -base64 32`); preview: separate NEW |
| `BETTER_AUTH_URL` | `src/server/auth/index.ts:35` | Doppler `prd` | `https://staging.zugzwangworld.com` (preview: unset — Vercel auto-injects via request origin) |
| `BETTER_AUTH_TRUSTED_ORIGINS` (NEW) | `src/server/auth/index.ts` (C5) | n/a (NEW; `prd`=`https://zugzwangworld.com`) | `https://staging.zugzwangworld.com` (preview: **empty / unset** per Path C resolved at web Claude review round 1 — preview auth deferred per `docs/parked.md` M1/M2; wildcard `*.vercel.app` rejected on attack-surface + Better Auth issue #3154 reliability grounds) |
| `RESEND_API_KEY` | `src/server/auth/email-otp.ts` | Doppler `prd` | NEW Resend sandbox key (preview: same as staging) |
| `NEXT_PUBLIC_SENTRY_DSN` | `instrumentation-client.ts:11`, `sentry.{server,edge}.config.ts:13` | Doppler `prd` (or Marketplace) | NEW DSN from O5a (preview: same — staging Sentry catches preview errors per LD-2) |
| `SENTRY_PROJECT` | `next.config.ts:30` (build-time) | Marketplace | `zugzwang-staging` per LD-9 (preview: same) |
| `R2_BUCKET_UPLOADS` (NEW per SURPRISE-10) | `src/server/storage/r2.ts` (C4b refactor) | n/a (currently hardcoded `"zugzwang-uploads"`) | `zugzwang-uploads-staging` (preview: same) |
| `R2_BUCKET_PFP` (NEW per SURPRISE-10) | `src/server/storage/r2.ts` (C4b refactor) | n/a (currently hardcoded `"zugzwang-pfp"`) | `zugzwang-pfp-staging` (preview: same) |
| `R2_ACCESS_KEY_ID_UPLOADS` | `src/server/storage/r2.ts:43` | Doppler `prd` | NEW staging uploads token from O5b (preview: same) |
| `R2_SECRET_ACCESS_KEY_UPLOADS` | `src/server/storage/r2.ts:44` | Doppler `prd` | NEW (pair with above) |
| `R2_ACCESS_KEY_ID_PFP` | `src/server/storage/r2.ts:61` | Doppler `prd` | NEW staging pfp token from O5b |
| `R2_SECRET_ACCESS_KEY_PFP` | `src/server/storage/r2.ts:62` | Doppler `prd` | NEW |
| `R2_PUBLIC_URL_PFP` | (future frontend per `.env.example` comment; not yet in src/ reads) | Doppler `prd` | NEW staging `pub-<hash>.r2.dev` from O5b |
| `CRON_SECRET` | `src/app/api/cron/r2-orphan-sweep/route.ts:54` | Doppler `prd` | NEW (`openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | `src/server/auth/admin/login.ts` (transitive) | Doppler `prd` | NEW (`openssl rand -hex 32`); preview: same as staging |
| `OPENAI_API_KEY` | `src/server/moderation/openai.ts` (transitive via OpenAI SDK) | Doppler `prd` | NEW staging key OR shared (operator decision; staging spend is low — Risk: shared key means staging moderation calls count toward prod quota) |

#### Shared with prod (13 vars — verbatim copy from `prd` config to `staging` and `preview`)

| Var | Read by | Prod source | Staging value |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | `src/server/auth/index.ts:38` | Doppler `prd` | shared (single OAuth client; staging redirect URI added at O3b per OQ-14) |
| `GOOGLE_CLIENT_SECRET` | `src/server/auth/index.ts:38` | Doppler `prd` | shared |
| `RESEND_FROM_EMAIL` | `src/server/auth/email-otp.ts` | Doppler `prd` (`onboarding@resend.dev`) | shared |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | (future widget — TODO at `src/app/(auth)/sign-in/page.tsx:103`) | Doppler `prd` | shared (Turnstile test-mode key `1x00000000000000000000AA` — always passes) |
| `TURNSTILE_SECRET_KEY` | `src/server/auth/index.ts:70` | Doppler `prd` | shared (Turnstile test-mode secret `1x0000000000000000000000000000000AA`) |
| `UPSTASH_REDIS_REST_URL` | `Redis.fromEnv` at `src/server/upstash/redis.ts:27` (implicit) | Doppler `prd` | shared (single Upstash DB per LD-10; isolation enforced by `getRedisKey()` prefix) |
| `UPSTASH_REDIS_REST_TOKEN` | same (implicit) | Doppler `prd` | shared |
| `NEXT_PUBLIC_POSTHOG_KEY` | `instrumentation-client.ts:22` | Doppler `prd` | shared (PostHog env-split deferred per §0; events tag `environment=staging`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `instrumentation-client.ts:25` | Doppler `prd` | shared |
| `R2_ACCOUNT_ID` | (not in src/ reads; in `.env.example` for documentation) | Doppler `prd` | shared (single CF account) |
| `R2_ENDPOINT_UPLOADS` | `src/server/storage/r2.ts:42` | Doppler `prd` | shared (account-scoped per OQ-13) |
| `R2_ENDPOINT_PFP` | `src/server/storage/r2.ts:60` | Doppler `prd` | shared |
| `SENTRY_ORG` | `next.config.ts:29` | Marketplace | shared (single Sentry org) |

#### Staging-only (3 vars — only set in staging Doppler config)

| Var | Read by | Staging value |
|---|---|---|
| `DATABASE_URL_STAGING` (NEW) | `scripts/migrate-staging.ts` (C7), `scripts/seed-staging.ts` (C8) | duplicates `DATABASE_URL` on staging config; script reads the `_STAGING` suffix to disambiguate from prod-leak risk |
| `STAGING_PROJECT_REF_FRAGMENT` (NEW) | `scripts/migrate-staging.ts` (C7 guard) | substring of staging Supabase project ref (e.g., `xyz123abc.supabase.co`) — guards against staging script applying migrations to prod URL |
| `SENTRY_API_TOKEN` (NEW per smoke item #9) | `scripts/smoke-staging.ts` (C9 only) | Sentry **Auth Token** (NOT a DSN) from Sentry org Settings → Auth Tokens, scope `event:read` org-wide. Smoke runner queries BOTH zugzwang-staging + zugzwang-prod Sentry projects to verify routing (per EC9). Token never read by deployed app — local smoke runner only. |

#### Platform / build-time (6 vars — NOT Doppler-managed; surfaced for completeness)

| Var | Read by | Source | Note |
|---|---|---|---|
| `BUILD_GIT_SHA` | `src/app/page.tsx:10` | `next.config.ts:6–12` (`git rev-parse --short HEAD`) | derived at build; same value per deploy |
| `BUILD_TIMESTAMP` | `src/app/page.tsx:11` | `next.config.ts:5` (`new Date().toISOString()`) | derived at build |
| `CI` | `next.config.ts:33` (Sentry silent flag) | GHA-injected at workflow time | infra, not app config |
| `NEXT_RUNTIME` | `instrumentation.ts:9,12` + `sentry.*.config.ts` | Next.js-injected at runtime (`"nodejs"` \| `"edge"`) | platform |
| `VERCEL_GIT_COMMIT_SHA` | (referenced in `sentry.server.config.ts:5` comment about Marketplace auto-tagging) | Vercel-auto-injected per deploy | platform |
| `R2_PROBE_LIVE` | `tests/server/storage/_probe-r2-roundtrip.test.ts` | local dev only (set ad-hoc in `.env.local`) | tests-only |

#### Aspirational per brief LD-2 (4 vars — NOT in current src/ reads; verify with operator before excluding from Doppler)

| Var | Brief LD-2 listing | Current src/ status | Recommendation |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | listed (`https://zugzwangworld.com` etc.) | NOT in src/ reads | Include in Doppler for forward-compat (OG tags / share links likely future-need); zero-cost. |
| `NEXT_PUBLIC_SUPABASE_URL` | listed | NOT in src/ reads (project uses Drizzle direct postgres, not Supabase JS client) | Omit unless operator adds Supabase client-side later. |
| `SUPABASE_SERVICE_ROLE_KEY` | listed | NOT in src/ reads (project uses Postgres user direct) | Omit. |
| `SUPABASE_ANON_KEY` | listed | NOT in src/ reads | Omit. |

**Counts:** 19 per-env + 13 shared + 3 staging-only = **35 Doppler-managed vars** for the `staging` config (33 for `preview` — `STAGING_PROJECT_REF_FRAGMENT` + `SENTRY_API_TOKEN` are staging-only, `ZUGZWANG_ENV_CANARY` differs by env, `BETTER_AUTH_URL` unset on preview). 6 platform/build-time + 4 aspirational surfaced for completeness.

---

### §3.B Migration audit for staging apply (executed at plan-time per SCAFFOLD.18 carry-forward #4)

Per SCAFFOLD.18 plan §8 Risk 1 firing + close-out carry-forward #4 (plan-mode mixed-concern-migration audit), plan-mode CC audits all pending Drizzle migrations BEFORE the plan locks. The audit feeds J1's spot-check step.

**Migration inventory (8 files, 759 lines total; provenance verified against `drizzle/migrations/meta/_journal.json`):**

| # | Tag | Lines | Concern classification | Critical-path tables touched | Stratum | Date |
|---|---|---|---|---|---|---|
| 0000 | `0000_uuidv7_function` | 34 | **schema-only** (defines `public.uuidv7()` PL/SQL function) | none | SCAFFOLD.2 stratum 3.A | 2026-05-12 |
| 0001 | `0001_initial_schema` | 308 | **schema-only** (9 enum types + 21 tables + FKs + indexes; auth + domain) | **ALL 5 §1 critical-path: bets, comments, dharma_ledger, resolution_events, payout_events** + identity_pool, image_uploads, system_state | SCAFFOLD.2 stratum 3.B | 2026-05-12 |
| 0002 | `0002_events_partitioning` | 56 | **schema-only** (hand-written `events` partitioned table + 12 monthly partitions [2026-05 → 2027-04] + DEFAULT partition + aggregate-lookup index) | events ledger (transitive — all critical-path mutations land here) | SCAFFOLD.2 stratum 3.C | 2026-05-12 |
| 0003 | `0003_append_only_triggers` | 198 | **schema-only** (6 trigger functions: 2 Bucket A shared + 4 Bucket B per-table; 26 trigger declarations) — **storage-layer ground truth for INV-1 / INV-2 / INV-3 / INV-4** | **ALL 5 §1 critical-path** (Bucket A) + identity_pool, image_uploads, system_state, friendly_fire_events (Bucket B) | SCAFFOLD.2 stratum 3.C | 2026-05-12 |
| 0004 | `0004_seed_system_state` | 15 | **seed-only** (single idempotent `INSERT ... ON CONFLICT DO NOTHING` into `system_state`) | system_state (Bucket B) | SCAFFOLD.2 stratum 3.C | 2026-05-12 |
| 0005 | `0005_auth_schema_corrections` | 2 | **schema-only** (DROP+recreate `users_email_idx` as UNIQUE; ALTER `sessions.expires_at` SET NOT NULL) | users (Bucket C — mutable) | SCAFFOLD.3 | 2026-05-16 |
| 0006 | `0006_image_uploads_extension` | 64 | **MIXED — schema + trigger function rewrite** (ALTER TABLE adds `content_type` + `byte_size`; DROP+recreate orphan-sweep index; CREATE OR REPLACE trigger function `enforce_image_uploads_terminal_atomic` to extend immutable-column list) — **INTENTIONAL bundling per SPEC.2 §6.3 amendment-in-commit discipline** | image_uploads (Bucket B) | SCAFFOLD.15 | 2026-05-24 |
| 0007 | `0007_pg_cron_jobs` | 82 | **MIXED — extension + schema + seed + cron schedule** (`CREATE EXTENSION pg_cron WITH SCHEMA extensions`; 2 tables: `watermark_state`, `cron_alarms`; 1 function: `check_identity_pool_watermark`; 1 idempotent seed row; `SELECT cron.schedule('identity-pool-watermark', '*/5 * * * *', ...)`) — **INTENTIONAL bundling; vendor-coupled to Supabase Postgres** | identity_pool (read-only by watermark function); creates `watermark_state` + `cron_alarms` | SCAFFOLD.17 | 2026-05-25 |

**SCAFFOLD.18 PR #54 (merged 2026-05-27, commit `e080dab`) added 0 new migrations.** The PR's diff was `.github/workflows/ci.yml` + Postgres service container provisioning + CI-only `sed` strip of 0007 lines 16 + 78–82 (per SCAFFOLD.18 execute log). No new SQL committed to `drizzle/migrations/`.

#### Mixed-concern review

| # | Status | Verdict |
|---|---|---|
| 0006 | MIXED but INTENTIONAL | ACCEPTED. Trigger function rewrite MUST land in the same commit as column-set change per SPEC.2 §6.3 amendment-in-commit discipline (immutable-column list inside the trigger function references the new `content_type` + `byte_size` columns). Decoupling would violate the discipline. |
| 0007 | MIXED but INTENTIONAL | ACCEPTED. pg_cron extension + watermark function + cron schedule must bootstrap together per SCAFFOLD.17 plan §5; partial application would leave the alarm pipeline incoherent. |

**No accidental stapling.** Both MIXED migrations are intentional bundles.

#### Staging-apply risk flags (descending)

1. **HIGH (single concern) — 0007 pg_cron + extensions schema permission.** The CI Path B (vanilla `postgres:17` + surgical `sed` strip per SCAFFOLD.18) does NOT apply to staging. Staging Supabase Pro sees the **FULL 0007 migration** including `CREATE EXTENSION pg_cron WITH SCHEMA extensions`. Per **SCAFFOLD.18 close-out carry-forward #8 (Q2 observe-posture)**, if the staging Supabase `extensions` schema is owned by a non-`postgres` role, the CREATE EXTENSION may hit `permission denied`. Mitigation: J1 spot-check #1 verifies extension installed; if denied, operator runs `GRANT ALL ON SCHEMA extensions TO postgres;` as a manual recovery step then re-runs J1. Expected likelihood: low — staging Supabase Pro natively supports pg_cron per ADR-0006 + SCAFFOLD.17 plan §5.1. **No plan amendment needed** unless permission denied actually surfaces at J1 execute time.
2. **MEDIUM — 0003 append-only triggers.** Storage-layer enforcement of all four hard-locked invariants (INV-1 / INV-2 / INV-3 / INV-4 per CLAUDE.md §2). If any of 26 triggers fail to install on staging, the four invariants become application-only. J1 spot-check #2 catches this.
3. **MEDIUM — 0001 initial schema.** Foundational — if any of 21 tables fail to create on staging, downstream migrations cascade-fail. J1 spot-check #3 catches the headline counts; full trigger tests (the 13 trigger spec files) re-run on staging via the seed flow during J2.
4. **LOW — 0006 image_uploads extension.** Bundled intentionally; only fires if image_uploads has existing rows (per file comment: "this migration assumes image_uploads is empty in prd"). Staging starts empty, so the constraint holds. J1 spot-check #4 verifies column adds.
5. **LOW — 0002 events partitioning.** 13 partitions to create; partition-of-partitioned-parent trigger propagation per 0003 also depends on these existing. J1 spot-check #5 verifies partition count.

#### J1 spot-check queries (5 highest-risk migrations)

Run via `doppler run --config staging -- psql "$DATABASE_URL_STAGING" -c "<query>"` (or via Drizzle raw SQL from the spot-check step's harness):

| Migration | Query | Expected |
|---|---|---|
| 0007 | `SELECT extname FROM pg_extension WHERE extname = 'pg_cron'` | 1 row |
| 0007 | `SELECT proname FROM pg_proc WHERE proname = 'check_identity_pool_watermark'` | 1 row |
| 0007 | `SELECT jobname, schedule FROM cron.job WHERE jobname = 'identity-pool-watermark'` | 1 row, schedule `*/5 * * * *` |
| 0003 | `SELECT count(*) FROM pg_trigger WHERE tgname IN ('bucket_a_no_update', 'bucket_a_no_delete', 'bucket_b_update_check', 'bucket_b_no_delete')` | 26 (18 Bucket A + 8 Bucket B) |
| 0001 | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN ('bets','comments','dharma_ledger','resolution_events','payout_events')` | 5 |
| 0001 | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'` | ≥21 (+ events parent + 12 partitions + auth tables ≈ 35+) |
| 0006 | `SELECT count(*) FROM information_schema.columns WHERE table_name = 'image_uploads' AND column_name IN ('content_type', 'byte_size')` | 2 |
| 0002 | `SELECT count(*) FROM pg_class WHERE relkind = 'r' AND relname LIKE 'events_%'` | 13 (12 monthly + 1 DEFAULT) |

These queries are fast (<100ms each) and run from CC's J1 step harness inline.

#### 0007 idempotency verification (web Claude review round 1)

Web Claude flagged: 0007 MIXED migration is structurally risky if partial-apply happens. Verified at plan time that 0007 uses idempotent syntax for 5 of 6 statements:

| Statement | Syntax | Idempotent on re-apply? |
|---|---|---|
| `CREATE EXTENSION ... pg_cron` (line 16) | `IF NOT EXISTS` | YES |
| `CREATE TABLE watermark_state` (line 19) | `IF NOT EXISTS` | YES |
| `CREATE TABLE cron_alarms` (line 26) | `IF NOT EXISTS` | YES |
| `CREATE FUNCTION check_identity_pool_watermark` (line 35) | `OR REPLACE` | YES |
| `INSERT INTO watermark_state` (line 73) | `ON CONFLICT (metric) DO NOTHING` | YES |
| `SELECT cron.schedule(...)` (line 78) | no idempotency wrapper | **version-dependent** (pg_cron ≥1.6 upserts on duplicate jobname; older errors) |

**pg_cron version note (web Claude review round 1, 2026-05-27):** Supabase upgraded pg_cron 1.4.2 → 1.6.2 in March 2024 (`supabase/postgres` PR #900); Supabase Pro debugging docs (last edited 2026-04-08) recommend Postgres ≥15.6.1.122 for pg_cron 1.6.4+. New Supabase Pro projects provisioned today — including the `zugzwang-staging` project minted at O1 — ship pg_cron ≥1.6.2, which crosses the upsert-on-duplicate-jobname threshold. **The cron.schedule non-idempotency concern is therefore documented for completeness but unlikely to fire on a freshly-provisioned staging project.** The recovery path below remains as a documented-but-unlikely-to-fire safety net.

**Recovery for partial-apply scenarios:**
- If the cron.schedule statement errors on re-run (pg_cron <1.6 with existing `identity-pool-watermark` job): run `SELECT cron.unschedule('identity-pool-watermark');` then re-apply 0007.
- If CREATE EXTENSION succeeds but cron.schedule fails (pg_cron permission gap or stale job collision): rest of the migration is already committed; manual cleanup limited to the cron job.
- The GRANT recovery (`GRANT ALL ON SCHEMA extensions TO postgres;`) per SCAFFOLD.18 close-out CF-8 covers the CREATE EXTENSION permission-denied case before the rest of the migration runs.

**HARDEN-phase carry-forward (NEW per web Claude review round 1):**

The 0007 MIXED migration pattern (extension install + schema + seed + cron schedule in one transaction) is structurally risky if partial-apply happens. Recovery requires operator intervention with version-dependent steps. Per AGENTS.md migration discipline ("Append-only at the file level; destructive operations need a deprecation path; schema-only migrations recommended"), going forward:

- **Recommendation:** New migrations after SCAFFOLD.8 ship as schema-only. Vendor-coupled bootstrap (extensions, cron jobs, vendor-specific functions) ships in a separate same-commit migration explicitly tagged in the plan (e.g., `NNNN_<thing>_bootstrap.sql` paired with `NNNN_<thing>_schema.sql`).
- **Retroactive carry-forward:** A HARDEN-phase task to retroactively split 0007 into three migrations (`0007a_pg_cron_extension.sql` + `0007b_watermark_schema.sql` + `0007c_watermark_cron_schedule.sql`) becomes warranted if SCAFFOLD.8's staging-apply or any future re-apply scenario surfaces partial-apply pain. Track in `docs/parked.md` until a concrete trigger fires.
- **No SCAFFOLD.8 plan amendment needed** — 0007's existing idempotency syntax covers 5/6 statements; the one non-idempotent statement has a documented recovery path; the MIXED pattern is intentional bundling per SCAFFOLD.17 plan, not accidental stapling.

---



Total: **9 operator steps** (O1–O8 + O3a + O3.5 + O3b new from OQ-14), **14 CC steps** (C0 new from SURPRISE-6 + C1–C13 + C8a), **3 joint steps** (J1–J3). Step IDs match brief §6 verbatim; additions explicitly tagged "(NEW)".

Format: `[OWNER] Step — description (est time, dep)`.

### Phase 1 — Provisioning + Doppler/Vercel wiring (~1.5h + ~5 min for O3b)

```
[OPERATOR] O1 — Provision zugzwang-staging Supabase project
  (~5 min; no dep; abort if provisioning fails twice → Supabase support)

[OPERATOR] O2 — Copy staging credentials (DATABASE_URL pooled+direct, service role key, anon key, project URL)
  (~2 min; dep O1; password manager only)

[OPERATOR] O3 — Audit existing Vercel env vars (per Risk 2 / OQ-11)
  (~10 min; no dep; identifies non-Doppler-sourced vars for delete/migrate)

[OPERATOR] O3.5 — Run pnpm vercel-env-audit (NEW per §4.6 script — runs the audit programmatically)
  (~2 min; dep CC writes vercel-env-audit.ts script at C0; can run before C0 manually)

[OPERATOR] O3a — Validate Doppler Custom Env sync availability (per Risk 1 / OQ-1)
  (~5 min; no dep; STOP + brief amendment if Custom Env target absent)

[OPERATOR] O3b — Add staging redirect URI to Google OAuth client (NEW per OQ-14)
  (~5 min; no dep; Google Cloud Console → OAuth client → Authorized redirect URIs → add
   `https://staging.zugzwangworld.com/api/auth/callback/google`)

[OPERATOR] O4 — Create staging + preview Doppler configs + populate env vars per §3.A inventory
  (~15 min; dep O2 (creds) + O3 (clean Vercel))
  Populates per §3.A inventory table:
    — 19 per-env vars (new values from O1/O2/O5a/O5b + generated secrets)
    — 13 shared vars (copy verbatim from Doppler `prd`)
    — 2 staging-only vars (DATABASE_URL_STAGING, STAGING_PROJECT_REF_FRAGMENT) — staging config only
  Net 34 vars on staging config; 33 vars on preview config (no STAGING_PROJECT_REF_FRAGMENT;
   ZUGZWANG_ENV=preview; ZUGZWANG_ENV_CANARY=preview-${date}; separate BETTER_AUTH_SECRET;
   BETTER_AUTH_URL unset).
  Sentry DSN + R2 staging-specific values are placeholders until O5a/O5b complete.
  Aspirational vars per brief LD-2 (NEXT_PUBLIC_SITE_URL, SUPABASE_*): operator decides
   include vs. omit per §3.A "Aspirational" section recommendations.

[OPERATOR] O5 — Provision Vercel staging Custom Env + wire 3 Doppler syncs
  (~15 min; dep O3a + O4)
  Sub-checkpoints: after each sync (prod, staging, preview), verify Sensitive toggle ON +
   sync status green BEFORE proceeding to next. Screenshots in PR description for all 3.

[OPERATOR] O5a — Create zugzwang-staging Sentry project + Auth Token + populate Doppler
  (~10 min; dep O4)
  (i) Sentry dashboard → New project → JS/Next.js platform → name `zugzwang-staging`.
      Copy DSN → paste into staging + preview Doppler configs as NEXT_PUBLIC_SENTRY_DSN.
  (ii) Sentry org → Settings → Auth Tokens → Create New Token. Scopes: `event:read`
       (org-wide; covers both zugzwang-prod + zugzwang-staging projects). Name:
       `smoke-runner-event-read`. Copy token → paste into staging Doppler config ONLY
       as SENTRY_API_TOKEN (smoke runner reads this; preview config does NOT need it).
       Required by smoke item #9 + EC9 (verifies staging Sentry HAS test error AND
       prod Sentry does NOT — needs read access to both projects).

[OPERATOR] O5b — Create 2 staging R2 buckets + 2 bucket-scoped tokens (per OQ-13)
  (~10 min; dep O4)
  Buckets: zugzwang-uploads-staging + zugzwang-pfp-staging.
  Tokens: zugzwang-uploads-staging-rw (scoped to uploads bucket only),
   zugzwang-pfp-staging-rw (scoped to pfp bucket only).
  Populate Doppler staging + preview configs:
    — SHARED with prod (copy verbatim from prod config):
        R2_ACCOUNT_ID, R2_ENDPOINT_UPLOADS, R2_ENDPOINT_PFP
        (R2 endpoints are account-scoped `https://<account_id>.r2.cloudflarestorage.com`,
         not bucket-scoped — same CF account = same endpoint URL per .env.example SCAFFOLD.15
         commentary; bucket name passes in the S3 API request, not the endpoint hostname)
    — STAGING-specific (new values from this step):
        R2_BUCKET_UPLOADS=zugzwang-uploads-staging
        R2_BUCKET_PFP=zugzwang-pfp-staging
        R2_ACCESS_KEY_ID_UPLOADS + R2_SECRET_ACCESS_KEY_UPLOADS (staging uploads token)
        R2_ACCESS_KEY_ID_PFP + R2_SECRET_ACCESS_KEY_PFP (staging pfp token)
        R2_PUBLIC_URL_PFP (new pub-<hash>.r2.dev minted per staging pfp bucket)
```

### Phase 2 — Code changes + DB setup (~2h)

```
[CC] C0 (NEW per §1.2 SURPRISE-6) — Write vercel-env-audit script
  (~45 min; no dep on operator)
  Output: scripts/vercel-env-audit.ts (~50–100 LOC).
  Wire as `pnpm vercel-env-audit` in package.json. Script shape per §4.6.
  (Authoritative env-var inventory already produced at plan-time in §3.A above; C0 at execute
   time validates the inventory is still current via re-run of the grep + .env.example diff,
   then writes the audit script. Time bumped from ~30 → ~45 min per web Claude review round 1
   to account for Vercel CLI output-format probing + diff logic.)

[CC] C1 — Create staging git branch
  (~2 min; no dep; `git checkout main && git pull && git checkout -b staging && git push -u origin staging`)
  No branch protection per OQ-10.

[CC] C2 — Add ZUGZWANG_ENV init-time validation in instrumentation.ts
  (~15 min; dep C1)
  Extends existing instrumentation.ts register() to throw if ZUGZWANG_ENV missing or not in
   ["prod","staging","preview"]. Surface text references OQ-5 + LD-2 boundary verdict.

[CC] C3 — Create getRedisKey() helper (per LD-10)
  (~20 min; dep C2)
  New file: src/server/upstash/keys.ts. Helper implementation per §4.2.
  Unit test at tests/unit/upstash-keys.test.ts (5 cases per §4.5 Test 1).

[CC] C4 — Refactor 10 Redis call sites to use getRedisKey() (per Risk 6 / §4.3)
  (~30 min; dep C3)
  Refactor catalog:
    - rate-limit.ts: 7 Ratelimit prefix literals → getRedisKey("ratelimit", <surface>)
    - cache.ts: `idem:${key}` → getRedisKey("idem", key)
    - precommit.ts: RESERVATION_KEY_PREFIX literal → getRedisKey("mod-reserve", userId, marketId, idempotencyKey)
    - r2-orphan-sweep route.ts: "cron-lock:r2-orphan-sweep" → getRedisKey("cron-lock", "r2-orphan-sweep")
  Unit test at tests/unit/rate-limit-prefix.test.ts (1 case per §4.5 Test 2).

[CC] C4b (NEW per §1.2 SURPRISE-10) — Refactor src/server/storage/r2.ts to env-var-driven bucket names
  (~10 min; dep C4 — sequenced with C4 for review-cascade scope; could parallelize if needed)
  Current state: bucket names hardcoded as string literals at lines 54 (`"zugzwang-uploads"`) +
   69 (`"zugzwang-pfp"`) inside `resolveBucketEnv()` in `src/server/storage/r2.ts`. Staging
   cannot use staging-specific buckets per OQ-13 without code change.
  Refactor:
    — Read `process.env.R2_BUCKET_UPLOADS` (uploads branch) + `process.env.R2_BUCKET_PFP` (pfp branch)
       in resolveBucketEnv().
    — Add to each branch's missing-env check: existing error message gets extended with
       `R2_BUCKET_UPLOADS` / `R2_BUCKET_PFP` so the resolveBucketEnv() failure mode covers all
       required vars per bucket.
  .env.example update: add `R2_BUCKET_UPLOADS=zugzwang-uploads` + `R2_BUCKET_PFP=zugzwang-pfp`
   in the SCAFFOLD.15 R2 section so local dev / `Doppler prd` baseline matches the current
   hardcoded names. No behavior change in prod (same bucket names, just via env now).
  No new unit test — bucket-name resolution is exercised via existing integration tests
   (sweep-orphans.test.ts, sign-upload.test.ts, etc.). C8a / smoke item #11 verifies staging
   tokens don't cross prod buckets.

  **Scope scan (web Claude review round 1, executed in plan mode):**
  Three checks ran to verify C4b's scope is comprehensive:
    (a) Bucket-literal grep across `src/ scripts/ drizzle/ tests/`: 5 hits total. Only 2 are
        bucket-resolution sites (r2.ts:54,69 — C4b's targets). 1 additional executable site
        in `tests/server/storage/_probe-aws-sdk-presigned-put.test.ts:37,66,82,85` (4 lines)
        — classified as TEST-FIXTURE PLACEHOLDER. Probe uses stub endpoint + fake credentials,
        does NOT route through resolveBucketEnv(); the literal is opaque to test logic. Not
        in C4b scope. (Optional HARDEN-phase rename to neutral name like `"_test-probe-bucket"`
        for clarity — deferred.) Remaining 3 hits are comments only.
    (b) Cron route inspection: `src/app/api/cron/r2-orphan-sweep/route.ts` calls `sweepOrphans`
        which calls `deleteObject("uploads", key)` which routes through `getClient` →
        `resolveBucketEnv()`. Cron path inherits C4b refactor automatically. OQ-15's "cron
        sweeps staging bucket by construction" verdict cross-validated.
    (c) Parallel R2 client setups: `new S3Client(...)` instantiated exactly once across src/
        (r2.ts:81). No dev-mode markers in storage layer. Single resolution path.

  Scope confirmed: 2 sites in r2.ts; no expansion needed.

[CC] C5 — Pin Better Auth + add trustedOrigins (per LD-11 + SURPRISE-2 + SURPRISE-7)
  (~10 min; dep C2)
  (a) Verify package.json `"better-auth": "1.6.11"` matches pnpm-lock.yaml; no edit needed.
  (b) Edit src/server/auth/index.ts: add `trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map(s => s.trim())` to betterAuth() config.
  (c) Confirm `useSecureCookies: true` (already set via cookie attributes); no `crossSubDomainCookies` (default off).

[CC] C6 — Create /api/health route + /api/_smoke-error route + add Sentry environment tag (per OQ-3 + OQ-12 + smoke item #9)
  (~25 min; dep C2)
  (a) Create src/app/api/health/route.ts per §4.1 shape. Node runtime per ADR-0003.
  (b) Edit 3 Sentry init files (instrumentation-client.ts, sentry.server.config.ts, sentry.edge.config.ts) to add `environment: process.env.ZUGZWANG_ENV` to Sentry.init() call.
  (c) Create src/app/api/_smoke-error/route.ts (env-gated; returns 404 on prod, throws labeled error on non-prod) per §4.8 shape. Required by smoke item #9 / EC9.

[CC] C7 — Create scripts/migrate-staging.ts (guarded; per OQ-4)
  (~20 min; dep C1)
  Per §4.3 shape. Wire as `pnpm db:migrate:staging`. Same guard pattern applies to C8.

[CC] C8 — Create scripts/seed-staging.ts (guarded)
  (~15 min; dep C7)
  Reuses SCAFFOLD.3 seed logic against DATABASE_URL_STAGING. Wire as `pnpm db:seed:staging`.

[CC] C8a — R2 staging-token scope verification script (per Risk 5 / OQ-13)
  (~20 min; dep O5b → C8a tests against the tokens)
  Per OQ-13 default: tests BOTH staging tokens (uploads + pfp) against BOTH prod buckets (4 HEAD requests, all expect 403).
  Wire as `pnpm verify:r2-scope` (standalone command). Smoke item #11 shells out to it via
   `execSync`. Script is independently runnable for token-rotation / audit scenarios
   outside smoke (conceptual separation: security posture verification ≠ deploy verification).

[CC] C9 — Create scripts/smoke-staging.ts (10 items per LD-5)
  (~45 min; dep C6 + C8a)
  Per §4.4 shape. Wire as `pnpm smoke:staging`.
  60-second sleep + retry on items 1–3 (DNS/HTTPS/cold-start tolerance per brief §5).
```

### Phase 3 — DB seeding + deploy + smoke + close (~1h)

```
[JOINT] J1 — Apply migrations to staging DB + spot-check
  (~10 min; dep O4 + C7)
  CC runs `doppler run --config staging -- pnpm db:migrate:staging`.
  Verify guard message ("Running migrations against staging: <project ref>") prints
   correctly; verify all 8 migrations apply without error (journal count expected: 8).
  Then run the 8 spot-check queries from §3.B against staging DB to verify post-state of
   the 5 highest-risk migrations (0001 schema + 0002 partitions + 0003 triggers + 0006 image
   columns + 0007 pg_cron). All expected values must match per §3.B table.
  If 0007 pg_cron CREATE EXTENSION returns "permission denied for schema extensions",
   recovery: `psql "$DATABASE_URL_STAGING" -c "GRANT ALL ON SCHEMA extensions TO postgres;"`
   then re-run pnpm db:migrate:staging (per SCAFFOLD.18 close-out CF-8 Q2 observe-posture).
  Abort: any migration fails on staging that succeeded on prod → halt; schema drift exists;
   investigate before continuing. Any spot-check returns unexpected value → halt; flag to
   operator for diagnosis before proceeding to J2.

[JOINT] J2 — Seed staging identity pool
  (~3 min; dep J1)
  CC runs `doppler run --config staging -- pnpm db:seed:staging`.

[OPERATOR] O6 — DNS CNAME at registrar
  (~3 min + 1–10 min propagation; dep O5)
  Add `staging.zugzwangworld.com CNAME cname.vercel-dns.com`.

[OPERATOR] O7 — Push staging branch to trigger first deploy
  (~5 min; dep C1 + O5 + O6)
  CC: `git push origin staging`. Vercel auto-deploys to staging Custom Env.

[OPERATOR] O8 — Open throwaway PR for smoke item #6
  (~5 min; dep O5)
  Trivial branch + comment change. Copy preview URL. Pass to CC for smoke item #6.
  Close PR (do NOT merge) after smoke passes.

[JOINT] J3 — Run smoke test
  (~5 min; dep O7 + O8 + J2 + C8a)
  CC runs `doppler run --config staging -- pnpm smoke:staging`.
  Items 1–5, 7–10 automatic; item 6 needs operator-provided PREVIEW_URL env var.
  Items 11 (R2 token scope) + 12 (cron staging behavior, optional) per §4.4.

[CC] C10 — Commit + open PR (branch feat/scaffold-8-staging-env) + reviewer cascade
  (~30 min including review wait; dep J3)
  Branch: feat/scaffold-8-staging-env (mints from main).
  Commits: see §5 commit plan.
  PR description includes: smoke pass log, 3 Sensitive-toggle screenshots (O5),
   2 R2 token scope screenshots (O5b), Sentry project screenshot (O5a),
   reviewer cascade verdicts (per §5).
  Reviewer cascade per LD-7: security-auditor on C3+C4 sub-diff AND C9 sub-diff.

[CC] C11 — Close O8 throwaway PR + delete throwaway branch
  (~2 min; dep C10)

[CC] C12 — Write docs/logs/SCAFFOLD.8.md close-out log
  (~25 min; dep C10)
  Includes: 12 ECs PASS evidence; risks fired (or not) per §4; HARDEN-phase carry-forwards:
    - GitHub Action for migration automation (per LD-4 Stage 2 deferral)
    - Weekly pg_dump --schema-only diff drift check
    - PostHog environment split (per §0 deferral)
    - Lint rule preventing raw Redis key construction (per Risk 6)
    - BETTER_AUTH_SECRET_FINGERPRINT env-var check (per §7 Risk 7 hole flag)
    - **0007 retroactive 3-way split + schema-only migration discipline going forward**
      (per §3.B HARDEN-phase carry-forward — fires if SCAFFOLD.8 staging-apply or future
      re-apply hits partial-apply pain; track in docs/parked.md until concrete trigger fires)
    - **Probe-test bucket-name placeholder rename to neutral string**
      (per C4b scope-scan analysis — optional clarity improvement)
    - **Preview-deploy auth + trustedOrigins config** (deferred per `docs/parked.md` M1/M2;
      if preview auth becomes load-bearing later, use Better Auth's dynamic
      `trustedOrigins: async (request) => [...]` form with an org-specific URL regex
      (matching the project's owned Vercel team/project pattern); do NOT use the
      `https://*.vercel.app` wildcard due to Better Auth issue #3154 protocol-wildcard
      reliability uncertainty + attack-surface concern)
   Bundle 3 split note (SCAFFOLD.8 = Bundle 3a; SCAFFOLD.9 = Bundle 3b).
   R2 reclassification note (per brief §3 Tier 5).

[CC] C13 — Commit close-out log
  (~3 min; dep C12)
```

### Ordering summary

```
Phase 1 (operator-heavy, partial parallel):
  O1 ─┬─ O2 ─┐
  O3 ─┘     ├
  O3.5 ─────┤
  O3a ──────┤
  O3b (NEW) ┤
            ├─ O4 ─┬─ O5 ─┬─ O5a
                  │      └─ O5b
                  │
                  (continues to Phase 2)

Phase 2 (CC-heavy, mostly serial):
  C0 (NEW) → C1 → C2 ─┬─ C3 → C4 → C4b (NEW)
                      ├─ C5
                      ├─ C6
                      └─ C7 → C8 → C8a → C9

Phase 3:
  J1 → J2
  O6 (parallel with J1/J2)
  O7 → O8 → J3 → C10 → C11 → C12 → C13
```

### Step delta vs. brief §6

| | Brief | This plan | Delta reason |
|---|---|---|---|
| Operator steps | 8 (O1–O8 + O3a + O3.5) | **11** (+ O3b new, but O3a + O3.5 already in brief — actual count: 8 + 3 sub-steps) | OQ-14 adds O3b |
| CC steps | 13 (C1–C13 + C8a) | **15** (+ C0 + C4b) | SURPRISE-6 (C0 — vercel-env-audit script); SURPRISE-10 (C4b — R2 bucket-name env-var refactor) |
| Joint steps | 3 (J1–J3) | 3 (unchanged) | — |

### Critical-path discipline reminder

Per LD-7 + operator answer at kickoff (2026-05-27): security-auditor reviewer cascade YES on:
- **C3+C4** (Redis helper + refactor) — shared-instance isolation discipline that protects prod from staging
- **C9** (smoke test, includes Doppler-sync verification) — credential handling + breach-surface mitigation

Per CLAUDE.md §5.11: fresh-context `general-purpose` Agent invocation with `.claude/agents/security-auditor.md` baked into prompt, plus plan path (this file), plus tool-scope constraints (Read, Grep, Glob, Bash only).

---

## §4 Authoritative deliverable shapes

### §4.1 `/api/health` route (C6 per OQ-3 boundary verdict)

**Path:** `src/app/api/health/route.ts` (net-new — `/api/health` does not currently exist)
**Runtime:** Node (per ADR-0003 — no `export const runtime = 'edge'`)
**Auth:** Public (no session gate, no Origin allowlist)
**Cache:** None (per AGENTS.md §5 — uncached by default; no `'use cache'` directive)

```typescript
import { sql } from "drizzle-orm";
import { db } from "@/db";

// GET /api/health — smoke-test target per SCAFFOLD.8 OQ-3 boundary verdict
// + LD-5 smoke item #4/#5 + LD-2 ZUGZWANG_ENV_CANARY routing surface.
//
// Hard constraint per OQ-3: this route reads ONLY the two named env vars;
// NO process.env enumeration; NO leak of DATABASE_URL, BETTER_AUTH_SECRET,
// SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, TURNSTILE_SECRET_KEY,
// UPSTASH_REDIS_REST_URL token, or any R2_* credentials.
//
// Production-safety: route exists on all three environments (prod returns
// "prod" canary — leaks nothing because the canary is the env name itself).

export async function GET(): Promise<Response> {
	let dbStatus: "ok" | "error" = "ok";
	try {
		await db.execute(sql`SELECT 1`);
	} catch {
		dbStatus = "error";
	}
	return Response.json({
		status: "ok",
		env: process.env.ZUGZWANG_ENV ?? null,
		canary: process.env.ZUGZWANG_ENV_CANARY ?? null,
		db: dbStatus,
	});
}
```

**Surface tested:**
- Smoke item #3 (App loads — GET `/` returns 200; orthogonal to health route).
- Smoke item #4 (Staging DB connects — `db: "ok"`).
- Smoke item #5 (DB + scope canary — `env: "staging"` + `canary: "staging-${DATE}"`).
- Smoke item #6 (PR preview reads `preview` — preview URL returns `env: "preview"`).

### §4.2 `getRedisKey()` helper (C3 per LD-10)

**Path:** `src/server/upstash/keys.ts` (net-new, adjacent to existing `redis.ts` + `lock.ts`)

```typescript
// Environment-scoped Redis key construction per SCAFFOLD.8 LD-10.
// Single source of truth for Redis key prefixes across rate-limit,
// idempotency, moderation reservation, and lock surfaces. Throws on
// missing or invalid ZUGZWANG_ENV — the C2 init-time check at
// instrumentation.ts is the first line of defense; this helper is the
// second (any code path that builds a Redis key passes through here).
//
// The leftmost segment of every Redis key on the shared Upstash instance
// is the environment name. prod ratelimit otp-email user identifier
// becomes "prod:ratelimit:otp-email:user@example.com"; staging becomes
// "staging:ratelimit:otp-email:user@example.com". No cross-env access.

const VALID_ENVS = ["prod", "staging", "preview"] as const;
type ZugzwangEnv = (typeof VALID_ENVS)[number];

export function getRedisKey(...parts: string[]): string {
	const env = process.env.ZUGZWANG_ENV;
	if (!env || !VALID_ENVS.includes(env as ZugzwangEnv)) {
		throw new Error(
			`getRedisKey: invalid ZUGZWANG_ENV ("${env}"); expected one of ${VALID_ENVS.join(", ")}`,
		);
	}
	return [env, ...parts].join(":");
}
```

**Usage examples (refactored at C4):**

```typescript
// rate-limit.ts (7 instances; one shown):
export const otpRequestPerEmail = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_EMAIL_PER_HOUR, "1 h"),
	prefix: getRedisKey("ratelimit", "otp-email"),
	analytics: false,
});

// idempotency/cache.ts (1 site):
const redisKey = getRedisKey("idem", key);

// moderation/precommit.ts (1 site; RESERVATION_KEY_PREFIX renamed to RESERVATION_KEY_BASE = "mod-reserve"):
const reservationKey = getRedisKey(RESERVATION_KEY_BASE, userId, marketId, idempotencyKey);

// cron/r2-orphan-sweep/route.ts (1 site):
const lockKey = getRedisKey("cron-lock", "r2-orphan-sweep");
```

**Catalog (C4 refactor scope — 10 sites across 5 files):**

| # | File | Line | Current key construction | After C4 |
|---|---|---|---|---|
| 1 | `src/server/middleware/rate-limit.ts` | 43 | `prefix: "otp-email"` | `prefix: getRedisKey("ratelimit", "otp-email")` |
| 2 | `src/server/middleware/rate-limit.ts` | 50 | `prefix: "otp-ip"` | `prefix: getRedisKey("ratelimit", "otp-ip")` |
| 3 | `src/server/middleware/rate-limit.ts` | 57 | `prefix: "admin-login-ip"` | `prefix: getRedisKey("ratelimit", "admin-login-ip")` |
| 4 | `src/server/middleware/rate-limit.ts` | 63 | `prefix: "write-budget"` | `prefix: getRedisKey("ratelimit", "write-budget")` |
| 5 | `src/server/middleware/rate-limit.ts` | 70 | `prefix: "write-burst"` | `prefix: getRedisKey("ratelimit", "write-burst")` |
| 6 | `src/server/middleware/rate-limit.ts` | 77 | `prefix: "bet-ip"` | `prefix: getRedisKey("ratelimit", "bet-ip")` |
| 7 | `src/server/middleware/rate-limit.ts` | 87 | `prefix: "image-put-ip"` | `prefix: getRedisKey("ratelimit", "image-put-ip")` |
| 8 | `src/server/idempotency/cache.ts` | 71 | ``redisKey = `idem:${key}`;`` | `redisKey = getRedisKey("idem", key)` |
| 9 | `src/server/moderation/precommit.ts` | 62 | ``reservationKey = `${RESERVATION_KEY_PREFIX}${userId}:...`;`` | Rename `RESERVATION_KEY_PREFIX` → `RESERVATION_KEY_BASE = "mod-reserve"` in `limits.ts`; `reservationKey = getRedisKey(RESERVATION_KEY_BASE, userId, marketId, idempotencyKey)` |
| 10 | `src/app/api/cron/r2-orphan-sweep/route.ts` | 67 | `lockKey = "cron-lock:r2-orphan-sweep"` | `lockKey = getRedisKey("cron-lock", "r2-orphan-sweep")` |

**Key shape after C4 (full key including identifier):**

| Surface | Pre-C4 (prod-only — broken on staging) | Post-C4 (prod scope) | Post-C4 (staging scope) |
|---|---|---|---|
| Rate-limit OTP email | `otp-email:user@example.com` | `prod:ratelimit:otp-email:user@example.com` | `staging:ratelimit:otp-email:user@example.com` |
| Idempotency | `idem:abc123` | `prod:idem:abc123` | `staging:idem:abc123` |
| Moderation reserve | `mod:reserve:user1:market1:key1` | `prod:mod-reserve:user1:market1:key1` | `staging:mod-reserve:user1:market1:key1` |
| Cron lock | `cron-lock:r2-orphan-sweep` | `prod:cron-lock:r2-orphan-sweep` | `staging:cron-lock:r2-orphan-sweep` |

**Module-load ordering — verified safe in plan mode (web Claude review round 1):**

The `@upstash/ratelimit` `Ratelimit` constructor evaluates `prefix:` at module-load time (each instance is `export const ... = new Ratelimit({...})`). `getRedisKey()` throws on invalid `ZUGZWANG_ENV`. So Ratelimit module-load must happen AFTER `register()` validates env.

**Next.js 16 guarantee — verbatim from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` line 18:**

> "The file exports a `register` function that is called once when a new Next.js server instance is initiated, **and must complete before the server is ready to handle requests**."

Therefore: server boot → instrumentation.ts loads → `register()` runs C2 init-time check → returns → server ready → first request loads route handler → route handler transitively loads `rate-limit.ts` → 7 Ratelimit instances construct → `getRedisKey()` succeeds (env already validated). No race.

**Consumer scan (web Claude review round 1, executed in plan mode):**

```
grep -rn "otpRequestPerEmail|otpRequestPerIpBurst|adminLoginPerIp|writeBudgetPerMarket|
         writeBurstPerUser|betPerIp|imagePutUrlPerIp" src/ tests/
```

Results:

- **src/** — ZERO direct consumers of named exports. All call sites use `checkRateLimit(surface: string, identifier: string)` (the public API):
  - `src/server/auth/index.ts:137,147` (otp send hook)
  - `src/server/auth/admin/login.ts:140` (admin login gate)
  - `src/app/api/uploads/sign/route.ts:103` (signed-PUT URL handler)
- **tests/** — 1 file consumes named exports for `.toBeDefined()` smoke assertions:
  - `tests/integration/rate-limit.integration.test.ts:98–108` imports all 7; lines 438–443 assert each `toBeDefined()`. Existence-only test — preserved by leaving the named exports in place.
- **rate-limit.ts itself** — exports + `SURFACE_INSTANCES` lookup table at lines 106–112.

**Verdict: drop-in `getRedisKey()` swap at the 7 `prefix:` literals. No lazy-init refactor needed.** Brief's framing holds.

**Refactor shape (C4 — 7 sites in rate-limit.ts):**

```typescript
// rate-limit.ts — drop-in swap at each of 7 prefix literals
export const otpRequestPerEmail = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_EMAIL_PER_HOUR, "1 h"),
	prefix: getRedisKey("ratelimit", "otp-email"),  // was: prefix: "otp-email"
	analytics: false,
});
// ... same pattern for 6 other surfaces
```

Module-load order safety inherits from the Next.js `register()` ordering guarantee above. If Next.js ever changes that guarantee in a future major version, the lazy-init fallback is documented as a HARDEN-phase carry-forward (not implemented now).

### §4.3 `scripts/migrate-staging.ts` + `scripts/seed-staging.ts` (C7 + C8 per OQ-4)

**Path:** `scripts/migrate-staging.ts`, `scripts/seed-staging.ts`
**Wired as:** `pnpm db:migrate:staging`, `pnpm db:seed:staging` in package.json scripts block

**`scripts/migrate-staging.ts` shape:**

```typescript
import { execa } from "execa"; // verify execa in deps; else use node:child_process
import { drizzleConfig } from "../drizzle.config";

const STAGING_PROJECT_REF_FRAGMENT = process.env.STAGING_PROJECT_REF_FRAGMENT;
const dbUrl = process.env.DATABASE_URL_STAGING;

if (!dbUrl) {
	console.error("[migrate-staging] DATABASE_URL_STAGING is not set. Run with: doppler run --config staging -- pnpm db:migrate:staging");
	process.exit(1);
}
if (!STAGING_PROJECT_REF_FRAGMENT) {
	console.error("[migrate-staging] STAGING_PROJECT_REF_FRAGMENT not set; cannot verify URL is staging");
	process.exit(1);
}
if (!dbUrl.includes(STAGING_PROJECT_REF_FRAGMENT)) {
	console.error(`[migrate-staging] DATABASE_URL_STAGING does not contain expected fragment "${STAGING_PROJECT_REF_FRAGMENT}"; refusing to run`);
	console.error(`[migrate-staging] Saw URL host: ${new URL(dbUrl).host}`);
	process.exit(1);
}

console.log(`[migrate-staging] Target: ${new URL(dbUrl).host}`);
console.log(`[migrate-staging] Applying migrations via drizzle-kit migrate...`);

process.env.DATABASE_URL = dbUrl;
const result = await execa("pnpm", ["drizzle-kit", "migrate"], {
	stdio: "inherit",
	env: { ...process.env, DATABASE_URL: dbUrl },
});

if (result.exitCode !== 0) {
	console.error("[migrate-staging] Migration failed mid-run. Investigate failed migration; fix forward; re-run. If unrecoverable: drop staging schema + re-run.");
	process.exit(result.exitCode ?? 1);
}
console.log("[migrate-staging] Done.");
```

(Note: simpler shape without `execa` available — use `node:child_process` `spawn` and pipe stdio.)

**Guard semantics:**
- Reads `DATABASE_URL_STAGING` (NOT `DATABASE_URL` — separation prevents env-confusion accidents).
- Reads `STAGING_PROJECT_REF_FRAGMENT` (set in staging Doppler config; a substring of the staging Supabase project ref like `abcd1234.supabase.co`).
- Refuses to run if either env var missing OR fragment not present in URL.
- Prints intended target host BEFORE applying.

**`scripts/seed-staging.ts` shape:** identical guard pattern, calls into the seed logic from `scripts/seed-identity-pool-dev.ts` (the SCAFFOLD.3 dev-seed produces ~200 rows per LD-4). Re-uses the function not the script entry-point — refactor at C8 if needed.

### §4.4 `scripts/smoke-staging.ts` (C9 per LD-5)

**Path:** `scripts/smoke-staging.ts`
**Wired as:** `pnpm smoke:staging`
**Runtime:** Node (tsx)
**Invocation:** `doppler run --config staging -- pnpm smoke:staging` (operator-side, locally)

Smoke test structure (10 items per LD-5 + 1–2 from §1.3 OQ-13/15):

```typescript
import { execSync } from "node:child_process";

type SmokeResult = { item: string; pass: boolean; detail: string };
const results: SmokeResult[] = [];

const STAGING_URL = "https://staging.zugzwangworld.com";
const PREVIEW_URL = process.env.PREVIEW_URL; // operator passes via env

async function check(item: string, fn: () => Promise<string>): Promise<void> {
	try {
		const detail = await fn();
		console.log(`[PASS] ${item}: ${detail}`);
		results.push({ item, pass: true, detail });
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		console.error(`[FAIL] ${item}: ${detail}`);
		results.push({ item, pass: false, detail });
	}
}

// Item 1 — DNS resolves
await check("dns", async () => {
	const out = execSync(`dig +short staging.zugzwangworld.com`).toString().trim();
	if (!out) throw new Error("NXDOMAIN — DNS not propagated");
	return out;
});

// Item 2 — HTTPS works (TLS valid)
await check("https", async () => {
	const r = await fetch(STAGING_URL, { method: "HEAD" });
	if (!r.ok && r.status !== 401) throw new Error(`status ${r.status}`);
	// 401 acceptable if Deployment Protection is on
	return `status ${r.status}`;
});

// Item 3 — App loads (GET /)
// Items 4 + 5 — Health route returns env + canary + db status
await check("health-staging", async () => {
	const r = await fetch(`${STAGING_URL}/api/health`);
	const body = await r.json() as { env: string; canary: string; db: string };
	if (body.env !== "staging") throw new Error(`env=${body.env}, expected "staging"`);
	if (!body.canary?.startsWith("staging-")) throw new Error(`canary=${body.canary}`);
	if (body.db !== "ok") throw new Error(`db=${body.db}`);
	return `env=${body.env}, canary=${body.canary}, db=${body.db}`;
});

// Item 6 — Preview URL returns preview canary
if (PREVIEW_URL) {
	await check("health-preview", async () => {
		const r = await fetch(`${PREVIEW_URL}/api/health`);
		const body = await r.json() as { env: string; canary: string };
		if (body.env !== "preview") throw new Error(`env=${body.env}`);
		return `env=${body.env}, canary=${body.canary}`;
	});
} else {
	console.warn("[SKIP] health-preview: PREVIEW_URL not set");
}

// Items 7 + 10 — Migrations applied + journal parity
await check("migrations-applied", async () => {
	const expected = countMigrationFiles(); // helper that reads drizzle/migrations/*.sql on staging branch
	const actual = await queryStagingDb(`SELECT COUNT(*)::int FROM drizzle._drizzle_migrations`);
	if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
	return `${actual} migrations`;
});

// Item 8 — Identity pool seeded
await check("identity-pool-seeded", async () => {
	const count = await queryStagingDb(`SELECT COUNT(*)::int FROM identity_pool`);
	if (count < 100 || count > 300) throw new Error(`count=${count}, expected ~200`);
	return `${count} pool rows`;
});

// Item 9 — Sentry routing (triggers /api/_smoke-error against staging URL; verifies error
// appears in zugzwang-staging Sentry project AND does NOT appear in zugzwang-prod Sentry
// project — cross-check via Sentry API for both projects per EC9).
//
// Requires SENTRY_API_TOKEN env var in smoke runner (operator pastes in staging Doppler
// config per §3.A; org-wide read scope `event:read`). Token is NOT a Sentry DSN — DSN is
// for ingestion only; this is the API ingest/read token from Sentry org Settings → Auth Tokens.
await check("sentry-routing", async () => {
	const apiToken = process.env.SENTRY_API_TOKEN;
	if (!apiToken) throw new Error("SENTRY_API_TOKEN not set in smoke env");
	// Trigger the labeled error from /api/_smoke-error on staging.
	const triggerStart = Date.now();
	await fetch(`${STAGING_URL}/api/_smoke-error`).catch(() => {/* expected throw */});
	// Allow ~30s for Sentry ingestion + indexing.
	await new Promise((r) => setTimeout(r, 30_000));
	// Query staging Sentry project for events since triggerStart.
	const stagingEvents = await fetchSentryEvents("zugzwang-staging", apiToken, triggerStart);
	const matchInStaging = stagingEvents.some((e) => e.message?.includes("[smoke-error]"));
	if (!matchInStaging) throw new Error("error did NOT appear in zugzwang-staging Sentry project");
	// Query prod Sentry project for the SAME timestamp window — must not match.
	const prodEvents = await fetchSentryEvents("zugzwang-prod", apiToken, triggerStart);
	const matchInProd = prodEvents.some((e) => e.message?.includes("[smoke-error]"));
	if (matchInProd) throw new Error("error LEAKED to zugzwang-prod Sentry project (DSN mis-routing)");
	return "staging Sentry HAS event; prod Sentry does NOT";
});

// fetchSentryEvents helper (impl in smoke-staging.ts):
// queries `GET /api/0/projects/<org>/<project>/events/?statsPeriod=1m` against
// sentry.io with Authorization: Bearer ${apiToken}. Returns array of event objects.

// Item 11 (NEW per OQ-13) — R2 token scope verification (calls pnpm verify:r2-scope under the hood)
await check("r2-scope", async () => {
	execSync("pnpm verify:r2-scope", { stdio: "inherit" });
	return "all 4 cross-bucket attempts returned 403";
});

const fails = results.filter((r) => !r.pass);
if (fails.length > 0) {
	console.error(`\n[FAIL] ${fails.length} of ${results.length} items failed`);
	process.exit(1);
}
console.log(`\n[PASS] All ${results.length} items passed`);
```

### §4.5 Unit test shapes (C3 + C4 per brief §5 Layer 2)

**Repo testing convention (verified at plan-time per web Claude review round 1):**

The repo has a two-layer defense pattern for tests that transitively import IO modules (Upstash Redis, Sentry, Better Auth, Postgres). Test 1 + Test 2 shapes below follow the convention verbatim.

1. **Layer 1 — vitest `setupFiles` env-defaults** at `tests/_setup/env.ts` (wired via `vitest.config.ts:setupFiles: ["./tests/_setup/env.ts"]`). Pre-sets non-empty placeholder values for 11 env vars (including `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, etc.) BEFORE any test module loads. Conditional assignment (`??=`) preserves real `.env.local` or per-test overrides. The setupFiles' own comment explains: *"tests just need non-empty values so module-load env validation in src/server/auth/index.ts + src/server/upstash/redis.ts doesn't throw before vi.mock replaces the IO surfaces."*
2. **Layer 2 — `vi.mock` at module boundary** replaces the actual IO surfaces. Five existing test files mock `@/server/upstash/redis` at the boundary (`tests/unit/body-fingerprint.test.ts:8`, `tests/integration/upstash-lock.integration.test.ts:34`, `tests/integration/idempotency-cache.integration.test.ts:52`, `tests/integration/rate-limit.integration.test.ts:67`, `tests/integration/precommit-moderate.integration.test.ts:36`). Sibling pattern for `@sentry/nextjs` + `@upstash/ratelimit`.
3. **Runtime-conditional skip uses `ctx.skip()`** inside test body — per SCAFFOLD.18 process learning #3 (`it.skipIf()` evaluates at collection time, before `beforeAll`/runtime env probes; `ctx.skip()` is the runtime equivalent). Confirmed precedent at `tests/db/identity-pool/watermark.test.ts:239`. Not applicable to Tests 1 + 2 below — both fully mocked, no real DB/Redis touch — but documented here for consistency.

**Test 1: `tests/unit/upstash-keys.test.ts`** (5 cases)

Convention status: pure function test; `getRedisKey()` reads only `process.env.ZUGZWANG_ENV`. No transitive IO import. No `vi.mock` needed beyond env manipulation in `beforeEach`/`afterEach`.

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getRedisKey } from "@/server/upstash/keys";

describe("getRedisKey", () => {
	let originalEnv: string | undefined;
	beforeEach(() => { originalEnv = process.env.ZUGZWANG_ENV; });
	afterEach(() => { process.env.ZUGZWANG_ENV = originalEnv; });

	it("prefixes with prod", () => {
		process.env.ZUGZWANG_ENV = "prod";
		expect(getRedisKey("ratelimit", "otp-email")).toBe("prod:ratelimit:otp-email");
	});
	it("prefixes with staging", () => {
		process.env.ZUGZWANG_ENV = "staging";
		expect(getRedisKey("ratelimit", "otp-email")).toBe("staging:ratelimit:otp-email");
	});
	it("prefixes with preview", () => {
		process.env.ZUGZWANG_ENV = "preview";
		expect(getRedisKey("ratelimit", "otp-email")).toBe("preview:ratelimit:otp-email");
	});
	it("throws on missing env", () => {
		delete process.env.ZUGZWANG_ENV;
		expect(() => getRedisKey("foo")).toThrow(/invalid ZUGZWANG_ENV/);
	});
	it("throws on invalid env", () => {
		process.env.ZUGZWANG_ENV = "dev";
		expect(() => getRedisKey("foo")).toThrow(/invalid ZUGZWANG_ENV/);
	});
});
```

**Test 2: `tests/unit/rate-limit-prefix.test.ts`** (1 case — verifies all 7 Ratelimit instances are constructed with env-prefixed prefix at module-load)

Convention status: follows the existing 3-mock pattern from `tests/integration/rate-limit.integration.test.ts` (lines 42 / 67 / 82). All 3 module boundaries — `@upstash/ratelimit`, `@/server/upstash/redis`, `@sentry/nextjs` — get vi.mock'd. The setupFiles env-defaults would handle the `Redis.fromEnv()` throw on their own (Layer 1 of the convention), but mocking at the module boundary (Layer 2) matches repo convention + future-proofs against env-default changes.

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock @upstash/ratelimit — capture all ctor calls to inspect their prefixes.
vi.mock("@upstash/ratelimit", () => {
	const ctors: Array<{ prefix: string }> = [];
	const RatelimitMock = vi.fn((opts) => { ctors.push(opts); return { limit: vi.fn() }; });
	(RatelimitMock as any).slidingWindow = vi.fn(() => "sliding-window-mock");
	return { Ratelimit: RatelimitMock, __ctors: ctors };
});

// Mock @/server/upstash/redis — prevents Redis.fromEnv() module-load throw
// (defense-in-depth alongside setupFiles env-defaults per repo convention).
// `redis: {}` is an empty placeholder; rate-limit.ts only passes this to
// `new Ratelimit({ redis, ... })`, and the Ratelimit ctor is mocked above
// so the redis object is never dereferenced.
vi.mock("@/server/upstash/redis", () => ({
	redis: {},
}));

// Mock @sentry/nextjs — rate-limit.ts imports captureException at line 1;
// avoid any Sentry-init side effects in the test process.
vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

describe("Ratelimit prefixes", () => {
	it("constructs all 7 surfaces with env-prefixed prefix at module-load", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		// Dynamic import triggers module-load → 7 Ratelimit ctors fire with their prefixes.
		await import("@/server/middleware/rate-limit");
		const mocked = await import("@upstash/ratelimit");
		const ctors = (mocked as any).__ctors as Array<{ prefix: string }>;
		expect(ctors).toHaveLength(7);
		for (const c of ctors) {
			expect(c.prefix).toMatch(/^prod:ratelimit:/);
		}
	});
});
```

(Test asserts all 7 surfaces carry the env prefix; covers Risk 6 at the rate-limit surface. The 3 non-Ratelimit Redis sites — idempotency / moderation / cron-lock — are exercised by their own integration tests + the C8a/C9 smoke flow.)

### §4.6 `scripts/vercel-env-audit.ts` (C0 — NEW per SURPRISE-6 / Risk 2 mitigation)

**Path:** `scripts/vercel-env-audit.ts`
**Wired as:** `pnpm vercel-env-audit`
**Operator usage:** runs ONCE at O3.5 (before O5 syncs). Reads Vercel project env-var list via Vercel CLI; prints which are Doppler-managed vs. manual.

```typescript
import { execSync } from "node:child_process";

// Vercel CLI: `vercel env ls --json` returns array of { key, value, target, gitBranch, ... }
// "Synced from Doppler" appears as a label/metadata; the exact JSON field is
// likely `source` or similar — verify at execute time with `vercel env ls --help`.
//
// Per user memory feedback_vercel_env_writeonly: vercel env ls returns metadata
// only (values are write-only post-set). This script is metadata-only; safe.

const PROJECT = "zugzwang"; // operator may pass via env
const ENVS = ["production", "preview"]; // Custom Env "staging" added once provisioned

interface VercelEnvVar {
	key: string;
	target: string[];
	gitBranch?: string;
	source?: string; // "doppler" | undefined (manual)
}

console.log("# Vercel env-var audit\n");
for (const env of ENVS) {
	const raw = execSync(`vercel env ls --environment ${env} --project ${PROJECT}`, { encoding: "utf8" });
	// Parse output — Vercel CLI's table format is not stable JSON; use --json if supported,
	// else regex over the table (verify at execute time).
	const vars = parseVercelTable(raw);
	const manual = vars.filter((v) => !isDopplerSourced(v));
	const synced = vars.filter((v) => isDopplerSourced(v));
	console.log(`## ${env}`);
	console.log(`Total: ${vars.length} | Doppler-synced: ${synced.length} | Manual: ${manual.length}\n`);
	if (manual.length > 0) {
		console.log("Manual env vars (DECIDE: delete or migrate to Doppler):");
		for (const v of manual) console.log(`  - ${v.key} [${v.target.join(", ")}]`);
	}
	console.log();
}
```

**Operator workflow:**
1. `pnpm vercel-env-audit` — generates report.
2. For each manual var listed: decide delete (obsolete) vs. migrate (load-bearing → paste into Doppler).
3. Re-run `pnpm vercel-env-audit` — all manual list lengths must be 0 before O5.

### §4.7 Better Auth `trustedOrigins` addition (C5 per LD-11 + SURPRISE-7)

**Path:** `src/server/auth/index.ts` (edit existing)

**Edit:** add `trustedOrigins` key to `betterAuth({...})` config block:

```typescript
export const auth = betterAuth({
	database: drizzleAdapter(db, { /* ... */ }),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
		?.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		?? [],
	// ... rest unchanged
});
```

**Env-var values:**
- Prod Doppler `BETTER_AUTH_TRUSTED_ORIGINS`: `https://zugzwangworld.com`
- Staging Doppler `BETTER_AUTH_TRUSTED_ORIGINS`: `https://staging.zugzwangworld.com`
- Preview Doppler `BETTER_AUTH_TRUSTED_ORIGINS`: **empty (unset)**. Preview-deploy auth relies on `baseURL` matching alone (Better Auth default behavior). Preview auth is known-broken per `docs/parked.md` M1/M2 (Google OAuth redirects to apex, not preview alias) and OUTSIDE SCAFFOLD.8 scope. Configuring wildcard `trustedOrigins` (e.g., `https://*.vercel.app`) for non-functional preview auth would be over-engineering AND would introduce attack surface — any deployment on the Vercel platform could craft a matching origin, violating LD-11's isolation spirit. Better Auth issue #3154 (June 2025) reported protocol-specific wildcards not enforcing protocol matching in v1.2.10 (status unclear in our pinned 1.6.11 — issue closed/locked after 7 days, weak signal); mid-experiment wildcard regression debugging is exactly the failure mode SCAFFOLD.8 should avoid. **Path C resolved at web Claude review round 1 (2026-05-27).**

### §4.8 `/api/_smoke-error` route (C6 sub-step c per smoke item #9 / EC9)

**Path:** `src/app/api/_smoke-error/route.ts` (net-new)
**Runtime:** Node (per ADR-0003 — Server Components default; no `export const runtime = 'edge'`)
**Auth:** Public (GET; smoke runner hits with plain fetch from local)
**Gating:** env-conditional — returns 404 on `prod`, throws labeled error on `staging` / `preview`

```typescript
// src/app/api/_smoke-error/route.ts
// Gated test-error route for smoke verification of Sentry routing per
// SCAFFOLD.8 EC9 + LD-5 smoke item #9.
//
// Returns 404 on prod (identical to a non-existent route — leaks nothing
// about the route's existence to a prod scanner). Throws a labeled error
// on staging/preview that smoke item #9 queries the Sentry API to verify
// landed in zugzwang-staging Sentry project AND did NOT land in
// zugzwang-prod Sentry project.
//
// Error label embeds env + millisecond timestamp so each smoke run produces
// a Sentry fingerprint distinct from prior runs — avoids issue-regression
// noise on the staging Sentry project (per LD-9 issue-grouping rationale).

export async function GET(): Promise<Response> {
	if (process.env.ZUGZWANG_ENV === "prod") {
		return new Response("Not Found", { status: 404 });
	}
	const label = `smoke-error-${process.env.ZUGZWANG_ENV}-${Date.now()}`;
	throw new Error(`[smoke-error] ${label}`);
}
```

**Surface tested:** smoke item #9 (Sentry routing); EC9 ("staging Sentry receives test error; prod Sentry does NOT").

**Security posture:**
- Returns 404 on prod — observationally indistinguishable from any other non-existent route (no information leak about route's existence).
- Labeled error contains ONLY `process.env.ZUGZWANG_ENV` + `Date.now()` — no DATABASE_URL fragment, no token material, no PII.
- Public access acceptable because the error path is throw-only; no DB / Redis / R2 mutation.
- security-auditor reviewer per §6.2 specifically verifies these properties.

### §4.9 Sentry environment tag addition (C6 sub-step b per OQ-12 + SURPRISE-3)

Edit 3 files; each adds one line:

```typescript
// instrumentation-client.ts (line 10–15 block):
Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.ZUGZWANG_ENV, // NEW per OQ-12
	tracesSampleRate: 1.0,
	sendDefaultPii: false,
	debug: false,
});

// sentry.server.config.ts: same one-line addition
// sentry.edge.config.ts: same one-line addition
```

---

## §5 Risk register acknowledgment (brief §4)

8 risks; plan acknowledges each with the implementation point that mitigates it. No novel mitigations needed — brief mitigations are correct.

| # | Risk | Sev × Lik | Plan implementation point |
|---|---|---|---|
| 1 | Doppler Custom Env sync unavailable | High × Possible | O3a step body — STOP + brief amendment if sync target absent; pre-staged 2-scope fallback text in §8 (this plan). |
| 2 | Manual Vercel env vars collide with Doppler sync | High × Likely | O3.5 pre-flight (runs C0's `pnpm vercel-env-audit`); operator deletes/migrates before O5. |
| 3 | Doppler→Vercel sync created with Encrypted (not Sensitive) | Critical × Possible | O5 sub-checkpoints — verify Sensitive toggle ON BEFORE confirming each sync; 3 screenshots in PR description. EC10 verifies at smoke. |
| 4 | Staging migration drift (convention skipped) | Medium × Likely | C9 smoke item #10 (journal parity); convention codified in C12 close-out + carry-forward (HARDEN-phase GitHub Action). |
| 5 | R2 staging token over-scoped | Critical × Possible | OQ-13 → C8a tests BOTH staging tokens against BOTH prod buckets (4 HEAD requests expect 403). |
| 6 | `getRedisKey()` not applied at all sites | Medium × Possible | §4.2 catalog enumerates 10 sites; C4 refactors all; Test 2 catches construction-time regression. HARDEN-phase carry-forward: lint rule. |
| 7 | Prod Better Auth secret accidentally rotated | Critical × Unlikely | LD-11 explicit "UNCHANGED" wording; O4 step body warns operator. No code-level guard (defer to HARDEN-phase per brief §7). |
| 8 | Supabase org-pooled egress exhausted | Medium × Possible | Out-of-scope for SCAFFOLD.8 (SCAFFOLD.9 consumer); LD-1 + close-out carry-forward. |

---

## §6 Reviewer cascade plan (CLAUDE.md §5.11 + LD-7)

Per operator answer at kickoff (2026-05-27): **YES — both C3/C4 and C9.**

### §6.1 Security-auditor on C3+C4 (Redis helper + refactor)

**When:** AFTER pre-PR self-audit passes on C3+C4 diff, BEFORE `gh pr ready 54` (or equivalent).
**Invocation:** fresh-context `general-purpose` Agent call (Claude Code runtime does not expose `security-auditor` as a direct subagent — per CLAUDE.md §5.11 + §6, role briefings live at `.claude/agents/<role>.md`).

**Prompt template (per CLAUDE.md §5.11 three required elements):**

```
You are a security-auditor reviewer. Load the role briefing at
`.claude/agents/security-auditor.md` and follow it verbatim.

Plan path: @docs/plans/SCAFFOLD.8-staging-plan.md (this file)

Scope: review the C3+C4 sub-diff (new file src/server/upstash/keys.ts + 10
refactored Redis call sites across 5 files per plan §4.2 catalog). Focus
on shared-instance isolation: can any code path on staging or preview
construct a Redis key that collides with or accesses prod keys? Are
there any call sites outside the catalog that still build raw keys?

Tool scope: Read, Grep, Glob, Bash only — do NOT Edit or Write.

Output: findings ranked CRITICAL / HIGH / MEDIUM / LOW with file:line
references per the security-auditor briefing's output format.
```

### §6.2 Security-auditor on C9 (smoke test + Doppler verification)

**When:** AFTER C3+C4 review passes; AFTER pre-PR self-audit on C9 diff.

**Prompt template:**

```
You are a security-auditor reviewer. Load `.claude/agents/security-auditor.md`
and follow it verbatim.

Plan path: @docs/plans/SCAFFOLD.8-staging-plan.md

Scope: review the C9 sub-diff (scripts/smoke-staging.ts + scripts/vercel-env-audit.ts +
the /api/health route at src/app/api/health/route.ts + the /api/_smoke-error route at
src/app/api/_smoke-error/route.ts + the Doppler-Sensitive verification mechanics).
Focus on:
  (a) Does the health route leak any secret beyond ZUGZWANG_ENV + ZUGZWANG_ENV_CANARY?
  (b) Does the smoke test handle credentials correctly (no leak to stdout/PR body)?
  (c) Does vercel-env-audit script handle the env-var list safely (no value leak)?
  (d) Doppler sync verification: is the smoke test asserting the right thing?
  (e) Does the /api/_smoke-error route correctly return 404 on prod (no information leak
      about route existence to a prod scanner)?
  (f) Does the labeled error not leak any secret beyond its own label
      (ZUGZWANG_ENV + Date.now() — no DATABASE_URL fragment, no token material, no PII)?
  (g) Does smoke item #9 query BOTH Sentry projects (staging YES + prod NO) per EC9? Is
      the Sentry API token handled with appropriate scope (read-only) and not logged?

Tool scope: Read, Grep, Glob, Bash only — do NOT Edit or Write.

Output: findings ranked CRITICAL / HIGH / MEDIUM / LOW with file:line references.
```

### §6.3 Handling reviewer findings

Per CLAUDE.md §5.11:
- FAIL findings within scope → fix in-session before PR ready.
- SURPRISE findings outside scope → write to `claude-progress.md` + STOP (no silent scope expansion).
- WONTFIX rationale (if any) follows the SCAFFOLD.18 5-category triage taxonomy (a/b/c/d/e per SCAFFOLD.18 execute log).

---

## §7 Verification (end-to-end exit criteria)

Plan ratifies brief §0 exit criteria. Each EC has a verification mechanism + a step ID + a verifiable artifact in the close-out log (C12).

| EC | Brief text (verbatim) | Verification | Artifact in C12 |
|---|---|---|---|
| EC1 | `staging.zugzwangworld.com` resolves to a Vercel deployment serving the app | Smoke item #1 (dig CNAME) + item #2 (curl HTTPS) + item #3 (GET /) | smoke output lines |
| EC2 | Reads from staging Supabase | Smoke item #4 (GET /api/health → db: "ok") + canary row test (manually insert into staging DB; verify in app) | smoke + manual canary SQL + screenshot |
| EC3 | Reads from `staging` Doppler config | Smoke item #5 (canary "staging-${date}") | smoke output |
| EC4 | PR preview reads `preview` config | Smoke item #6 (preview URL canary "preview-${date}") | smoke + preview URL screenshot |
| EC5 | All Drizzle migrations applied to staging | Smoke item #7 (journal count matches expected) | SQL output |
| EC6 | Identity pool ~200 rows on staging | Smoke item #8 (count >= 100, <= 300) | SQL output |
| EC7 | `pnpm smoke:staging` passes all 10 items | Smoke test pass log | full smoke output |
| EC8 | Staging R2 isolated from prod (token cannot read prod bucket) | C8a / smoke item #11 (4 HEAD requests expect 403) | C8a output |
| EC9 | Staging Sentry receives test error; prod Sentry does NOT | Smoke item #9 (Sentry API query for both projects) | Sentry API responses |
| EC10 | Every Doppler→Vercel sync is Sensitive | O5 sub-checkpoint screenshots (3) + `vercel env pull` spot-check at smoke | screenshots + pull output |
| EC11 | PR merged to main with scripts + smoke + helper + auth changes + DATABASE_URL_STAGING | C10 PR merge | PR URL |
| EC12 | Close-out log committed | C13 commit | (this log, self-referential) |

### §7.1 Local test discipline before C10 (PR open)

Per AGENTS.md §2 daily commands: before C10 opens PR:

```bash
just check    # full pre-PR gate (tsc + biome + vitest + build)
              # if just unavailable: pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run
pnpm test:invariants    # gates the four hard-locked invariants (CLAUDE.md §2)
```

The four INV-tagged tests + 13 trigger tests (per SCAFFOLD.18 close-out reclassification) MUST pass. CI re-runs these on PR.

---

## §8 Pre-staged LD-2 fallback (per brief §8 Contingency trigger #1)

If O3a surfaces that Doppler Custom Env sync target is NOT in the dropdown, brief amendment per Risk 1 / OQ-1 fallback clause activates. Plan pre-stages the 2-scope LD-2 replacement text so the amendment is fast:

**LD-2 fallback (2-scope):**

| Doppler config | Synced to Vercel env | Serves |
|---|---|---|
| `prod` | Production | zugzwangworld.com |
| `staging` | Preview env (Vercel) | staging.zugzwangworld.com AND PR preview URLs (shared scope) |

**Implications:**
- No Vercel Custom Environment created at O5. Staging.zugzwangworld.com attached to Vercel Preview environment (which is plan-gated to a git branch — `staging`).
- Preview URLs (PR-generated) inherit same Doppler config as staging. Loss: cannot differentiate `preview` vs. `staging` canary; smoke item #6 collapses into item #5.
- Cost: $0 (no Custom Env charge); cleanliness regression (mental model less explicit).

If Risk 1 fires, brief amendment lands in execute first commit alongside §0/§1 LD-2/LD-3 inline edits + smoke item #6 deletion. Operator + web Claude greenlight required.

---

## §9 SCAFFOLD.18 execute log landing (per operator answer at kickoff)

Operator chose: "Land as standalone chore PR now."

**Sequence:**

1. **Before SCAFFOLD.8 execute begins:** open chore PR from existing local+remote branch `chore/scaffold-18-execute-log` (HEAD `74c72c3`) against `main`. PR title: `chore(scaffold-18): log session — SCAFFOLD.18 execute close-out`. PR body: brief reference to the log content + 8 HARDEN-phase carry-forwards + 5 process learnings.
2. Merge via squash (project convention from recent PRs).
3. SCAFFOLD.8 execute chat opens FROM main with that log committed → SCAFFOLD.8 inherits process learnings cleanly.

**Estimated wall-clock:** ~5 min (CC session; no review needed, log is documentation-only).

**Hand-off boundary:** this chat closes after ExitPlanMode with the SCAFFOLD.8 plan committed. The chore PR for SCAFFOLD.18 log happens in the same CC session as plan-mode close (post-ExitPlanMode, pre-SCAFFOLD.8-execute) OR as the first action of the SCAFFOLD.8 execute chat. Operator picks.

---

## §10 Self-critique (what could go wrong with THIS plan)

Per plan-mode discipline + kickoff §6.13.

1. **~~`@upstash/ratelimit` lazy-init refactor may break existing consumers.~~** RESOLVED at web Claude review round 1 (2026-05-27). Consumer scan executed in plan mode: 0 src/ consumers of named exports; 1 test file uses them for `.toBeDefined()` existence assertions. Lazy-init refactor reverted to brief's drop-in framing per Outcome A below.

2. **~~C2 `instrumentation.ts` validation timing.~~** RESOLVED at web Claude review round 1 (2026-05-27). Next.js 16 docs explicitly guarantee `register()` "must complete before the server is ready to handle requests" (verbatim from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` line 18). Therefore module-load of rate-limit.ts (route-handler-transitive) is guaranteed to happen AFTER `register()` completes. Drop-in `getRedisKey()` at module-load is safe. If Next.js drops this guarantee in a future major version, lazy-init fallback is documented as a HARDEN-phase carry-forward.

3. **C7 / C8 / C9 scripts assume `execa` or equivalent.** If `execa` isn't a dep, plan falls back to `node:child_process` `spawn`. Either way, scripts are ~50-100 LOC each — small surface. Risk: low.

4. **Vercel CLI output format for `vercel env-audit`.** Plan §4.6 assumes `vercel env ls --json` or table parseable. At execute time CC verifies the actual CLI version + output format; if neither stable JSON nor parseable table, script falls back to manual operator inspection at O3.

5. **R2 dual-bucket scope (OQ-13) doubles operator work at O5b.** ~10 min instead of ~5 min. Real cost is the verification step — 4 HEAD requests instead of 1. Plan accepts; matches brief's isolation discipline.

6. **Google OAuth client redirect URI (OQ-14) adds an operator step that's NOT in the brief.** Risk: operator forgets at execute time → staging Google OAuth flow fails → smoke item or manual verification flags it. Mitigation: O3b is in the operator step list explicitly.

7. **Vercel cron staging firing (OQ-15) accepts a default without explicit verification.** Plan's boundary verdict says staging cron sweeps staging bucket by token-scope construction. If Vercel actually applies vercel.json crons only to production (and skips Custom Envs by default), staging cron doesn't fire → staging bucket accumulates orphans. Risk: low (staging is throwaway; orphan accumulation over 7 weeks is small). Verification: at execute time, check Vercel dashboard → Cron Jobs tab for staging Custom Env after O7.

8. **`pnpm db:migrate:staging` reads `STAGING_PROJECT_REF_FRAGMENT` from env.** Plan §4.3 introduced this env var as a guard substring. The fragment value is operator-known (subset of staging Supabase project ref). Must be added to staging Doppler config + documented in `.env.example`. Sub-step: O4 includes `STAGING_PROJECT_REF_FRAGMENT=<staging-ref-fragment>` in env-var population.

9. **Reviewer cascade prompt templates (§6.1–§6.2) assume `.claude/agents/security-auditor.md` exists.** Per CLAUDE.md §6, briefings live at `.claude/agents/<role>.md`. If the file doesn't exist or has stale content, the prompt won't have the role-specific guidance. Mitigation: verify at C10-time that the briefing file exists and is current; if not, surface to operator BEFORE invoking reviewer call.

10. **Plan doesn't address `BETTER_AUTH_URL` value per scope explicitly in code.** `src/server/auth/index.ts` line 36 reads `process.env.BETTER_AUTH_URL` (throws if missing). Brief LD-2 table doesn't enumerate `BETTER_AUTH_URL` — but it's load-bearing. Plan adds to authoritative inventory at C0: `BETTER_AUTH_URL=https://staging.zugzwangworld.com` (staging), `=https://zugzwangworld.com` (prod), unset on preview (Vercel auto-injects per-preview URL → Better Auth uses request origin).

11. **PR splitting strategy at C10.** Plan describes one PR (`feat/scaffold-8-staging-env`) with the full diff. Alternative: split into 3 PRs (a — instrumentation + getRedisKey + refactor; b — Better Auth + Sentry env tag + /api/health; c — scripts + smoke). Splitting buys cleaner reviewer cascade but adds operator overhead. Plan: stay single-PR; security-auditor reviews the C3+C4 sub-diff and C9 sub-diff via path-scoped review prompts (per §6.1, §6.2). If review surfaces ambiguity, split at execute time.

12. **Time estimate inherits brief's optimism warning.** Brief §6 says "Hold loosely; SCAFFOLD.18 precedent showed brief estimates run optimistic when novel risks lurk." Plan inherits: ~3–4h CC execute time + ~75 min operator dashboard time + ~30 min reviewer cascade × 2. If Risk 1 (Doppler Custom Env unavailable) fires, +30 min for brief amendment + plan revision.

---

## §11 Critical files (paths the execute chat will touch)

For Phase 2 execute reference. Net-new vs. edited.

**Net-new (11 files):**
- `src/server/upstash/keys.ts`
- `src/app/api/health/route.ts`
- `src/app/api/_smoke-error/route.ts` (env-gated; per §4.8 / smoke item #9)
- `scripts/migrate-staging.ts`
- `scripts/seed-staging.ts`
- `scripts/smoke-staging.ts`
- `scripts/verify-r2-scope.ts` — standalone verification script; invoked from smoke item #11 via `execSync` but independently runnable for token-rotation / audit scenarios outside smoke
- `scripts/vercel-env-audit.ts`
- `tests/unit/upstash-keys.test.ts`
- `tests/unit/rate-limit-prefix.test.ts`
- `docs/logs/SCAFFOLD.8.md` (close-out)

**Edited (8 files):**
- `instrumentation.ts` — C2 init-time ZUGZWANG_ENV validation
- `instrumentation-client.ts` — C6 Sentry `environment` field
- `sentry.server.config.ts` — C6 Sentry `environment` field
- `sentry.edge.config.ts` — C6 Sentry `environment` field
- `src/server/auth/index.ts` — C5 `trustedOrigins` addition
- `src/server/upstash/lock.ts` — (no edit; consumer at cron route is the surface)
- `src/server/middleware/rate-limit.ts` — C4 drop-in `getRedisKey()` swap at 7 `prefix:` literals (no lazy-init refactor per web Claude review round 1)
- `src/server/idempotency/cache.ts` — C4 getRedisKey
- `src/server/moderation/precommit.ts` — C4 getRedisKey
- `src/server/config/limits.ts` — C4 `RESERVATION_KEY_PREFIX` rename → `RESERVATION_KEY_BASE`
- `src/app/api/cron/r2-orphan-sweep/route.ts` — C4 lock key via getRedisKey
- `src/server/storage/r2.ts` — **C4b** R2 bucket-name env-var refactor (replace hardcoded `"zugzwang-uploads"` + `"zugzwang-pfp"` literals at lines 54,69 with `process.env.R2_BUCKET_UPLOADS` + `process.env.R2_BUCKET_PFP`; extend missing-env throw messages) per SURPRISE-10
- `package.json` — add 4 new scripts (`db:migrate:staging`, `db:seed:staging`, `smoke:staging`, `vercel-env-audit`, `verify:r2-scope`)
- `.env.example` — add `ZUGZWANG_ENV`, `ZUGZWANG_ENV_CANARY`, `DATABASE_URL_STAGING`, `STAGING_PROJECT_REF_FRAGMENT`, `BETTER_AUTH_TRUSTED_ORIGINS`, `R2_BUCKET_UPLOADS=zugzwang-uploads`, `R2_BUCKET_PFP=zugzwang-pfp` (the R2 bucket-name vars carry current hardcoded defaults to preserve prod behavior post-C4b refactor)

**Existing utilities reused (no edit):**
- `src/server/upstash/redis.ts` — singleton client (`Redis.fromEnv`)
- `src/server/upstash/lock.ts` — `acquireLock` / `releaseLock` (consumer pattern unchanged)
- `scripts/seed-identity-pool-dev.ts` — C8 refactors seed-staging.ts to import the seed function

---

## §12 References

- **Brief:** `docs/plans/SCAFFOLD.8-staging.md` (currently at `/Users/hrishikesh/Downloads/`; committed to repo path in execute first commit per brief §8.Brief-delivery-artifact note)
- **SCAFFOLD.18 execute close-out:** `docs/logs/SCAFFOLD.18-execute.md` (on unmerged branch `chore/scaffold-18-execute-log @ 74c72c3`)
- **Predecessor plan:** `docs/plans/SCAFFOLD.18-postgres-ci.md`
- **Mini-plan:** `docs/plans/SCAFFOLD-finish-mini-plan.md` §Bundle 3
- **Parked OAuth state:** `docs/parked.md` §SCAFFOLD.3-FOLLOWUP-1 §10 (M1/M2 fix paths)
- **ADRs consumed per brief §3 Tier 2:** ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0011, ADR-0013, ADR-0014, ADR-0015, ADR-0016
- **SPEC.1 + SPEC.2** as canonical architecture; SPEC.2 §0.1 for ADR change-log
- **CLAUDE.md** §1 critical-path, §5.11 reviewer-call, §6 review roles
- **AGENTS.md** §2 daily commands, §3 project structure, §7 handler stack

---

## §13 Hand-off note for execute chat

When this plan is ratified + committed:
1. Operator opens new CC chat with execute kickoff (web Claude drafts kickoff prompt per close-out workflow).
2. Execute chat's Phase 0: confirm reads (this plan, brief, ADRs); verify working tree clean.
3. Phase 1: O1 + O2 (Supabase provisioning + creds) in parallel with C0 (env-var audit + script) + C1 (staging branch).
4. Phases 2/3 per §3 step plan.
5. PR open + reviewer cascade per §6.
6. Close-out log + commit per C12/C13.

**Estimated execute wall-clock:** ~3–4h CC + ~75 min operator. Reviewer cascade adds ~30 min (if clean) or up to ~60 min (if findings).
