# SCAFFOLD.8 — Staging environment brief

**Status:** Brief, ratified 2026-05-27
**Author:** Web Claude + Hrishikesh
**Predecessor:** SCAFFOLD-finish-mini-plan.md (Bundle 3, split into Bundle 3a + 3b per operator decision 2026-05-27)
**Successor:** SCAFFOLD.8 plan-mode review chat (CC drafts plan in /plan mode)
**Tracker entry:** SCAFFOLD.8 — Staging + preview-per-PR (staging.zugzwangworld.com + scoped env vars)

---

## §0 Scope + Exit Criteria

### In scope

**Supabase**
- Provision `zugzwang-staging` as a second Supabase project in the existing Pro org.
- Apply all current Drizzle migrations to staging DB.
- Seed staging DB with the ~200-row identity_pool dev-seed (per SCAFFOLD.3 spec).

**Doppler + Vercel (3-scope layout)**
- Create `staging` Doppler config (config-level scope inside the existing Doppler project).
- Verify `preview` Doppler config exists separately (or create it).
- Provision a Vercel **Custom Environment** named `staging` (1 free per project on Pro plan).
- Bind Doppler `staging` config → Vercel `staging` Custom Environment.
- Bind Doppler `preview` config → Vercel `preview` environment (for PR previews).
- Verify every Doppler→Vercel sync uses **Sensitive** env var type (not Encrypted).
- Populate `staging` Doppler config with staging-specific env vars per §1 LD-2 scope map.
- Populate `preview` Doppler config (separately) per §1 LD-2 scope map.

**DNS + branch**
- Add DNS CNAME `staging.zugzwangworld.com` → `cname.vercel-dns.com` at the registrar.
- Configure Vercel to alias `staging.zugzwangworld.com` to the `staging` Custom Environment, branch-tracked to the long-lived `staging` git branch.
- Create `staging` branch in the repo (first commit = current `main` HEAD).

**Cloudflare R2 (moved from out-of-scope; un-deferred per research)**
- Provision new R2 bucket `zugzwang-staging`.
- Create bucket-scoped API token (token can read/write only `zugzwang-staging`, NOT `zugzwang-prod`).
- Populate `staging` Doppler config with the staging R2 credentials.

**Sentry (moved from out-of-scope; un-deferred per research)**
- Provision new Sentry project `zugzwang-staging` (Developer plan free tier).
- Populate `staging` Doppler config with new staging Sentry DSN.
- Production Sentry project stays on `zugzwang-prod` (or current name).

**Upstash Redis**
- Continue using single Upstash database, shared between prod and staging.
- Adopt env-prefix discipline: every Redis key prefixed with `${ZUGZWANG_ENV}:` (e.g., `prod:ratelimit:user:abc`, `staging:ratelimit:user:abc`).
- Introduce `getRedisKey()` helper in the codebase that enforces this prefix.

**Better Auth**
- Generate fresh `BETTER_AUTH_SECRET` for staging (different from prod).
- Confirm host-only cookies (Better Auth default; do NOT enable `crossSubDomainCookies`).
- Pin Better Auth to exact version (no `^` in `package.json`) for duration of experiment.
- Configure `trustedOrigins` per scope: prod scope includes only prod origin; staging scope includes only staging origin.

**Scripts + smoke test**
- Add `pnpm db:migrate:staging` script (operator/CC trigger, reads `DATABASE_URL_STAGING`).
- Add `pnpm db:seed:staging` script.
- Write `pnpm smoke:staging` covering 10 smoke-test items (§5).
- Run smoke test against staging; record results in close-out log.
- Open a throwaway PR to verify preview-deploy reads from `preview` Doppler scope (NOT staging).

### Out of scope

- **SCAFFOLD.9 (load harness).** Split to Bundle 3b per operator decision 2026-05-27. Owned by future chats with load-model precursor.
- **PostHog environment split.** Deferred to a Stage-2 follow-up after Bundle 3b closes. Reason: PostHog's multi-environments-within-project feature has uncertain plan-eligibility; resolving requires logging into PostHog Cloud and verifying. Out-of-scope for SCAFFOLD.8; staging PostHog events tagged `environment=staging` against the existing project for now.
- **Migration automation (GitHub Action on merge to staging).** Stage-2 follow-up. SCAFFOLD.8 ships the manual `pnpm db:migrate:staging` script + smoke-test parity check (item #10 in §5) to mitigate forgotten-migration risk. Automating the merge step is a one-hour cleanup task best done in a HARDEN.* phase.
- **Weekly `pg_dump --schema-only | diff` drift check.** Stage-2 follow-up. SCAFFOLD.8's smoke-test item #10 catches journal-level drift; the deeper schema-diff is a HARDEN.* addition.
- **Staging PITR.** Deferred. PITR is a paid per-project add-on; staging data is throwaway. Revisited only if staging starts holding load-test results we want to recover.
- **Schema-per-PR-preview isolation.** Deferred. PR previews share staging DB via the `preview` Doppler scope; collision risk accepted given low concurrent PR volume. Escape hatch (Supabase Branching) available if pain materializes.
- **AGENTS.md / CLAUDE.md updates documenting staging env conventions.** Deferred per ratified "single dedicated pass after all ADRs complete" discipline. Note added to deferred-updates queue.
- **Production deploy changes.** This task does not touch prod Doppler config, prod Supabase project, prod DNS, prod Vercel config, prod Sentry project, prod R2 bucket, or any prod credential. If any step in plan-mode touches prod, plan-mode CC stops and surfaces it as a scope violation.

### Exit criteria (all must pass)

1. `staging.zugzwangworld.com` resolves to a Vercel deployment serving the app.
2. The deployment reads from staging Supabase project (verified: canary row inserted into staging DB appears in staging app; same row does NOT appear in prod app).
3. The deployment reads from `staging` Doppler config via the `staging` Custom Environment (verified: env-var canary like `ZUGZWANG_ENV_CANARY=staging-${date}` returned from a debug route).
4. PR preview deploys read from `preview` Doppler config (NOT staging) — verified via throwaway PR.
5. All Drizzle migrations have applied to staging DB; `drizzle._drizzle_migrations` count on staging matches the count of migration files on `staging` branch.
6. Identity pool dev-seed has been applied to staging (`SELECT count(*) FROM identity_pool` returns ~200 on staging).
7. `pnpm smoke:staging` passes all 10 items (§5).
8. Staging R2 bucket isolated from prod (verified: staging-scoped API token cannot list or read `zugzwang-prod` bucket).
9. Staging Sentry project receives a test error from staging deploy; prod Sentry project does NOT receive that error.
10. Every Doppler→Vercel sync uses Sensitive env var type (verified: spot-check at least one staging-only secret via `vercel env pull` or equivalent).
11. PR merged to `main` with the new scripts, smoke test, `getRedisKey()` helper, pinned Better Auth version, and any code changes for `DATABASE_URL_STAGING` handling.
12. Close-out log committed at `docs/logs/SCAFFOLD.8.md`.

### Non-criterion

- **No production cutover required.** `zugzwangworld.com` continues serving as today. SCAFFOLD.8 ships a parallel environment + isolation hardening, not a migration.

### Critical-path classification

**Not critical-path-by-function** per CLAUDE.md §1. Task touches DNS, Doppler config, Vercel config, R2 config, Sentry config, new scripts in `scripts/`, a Redis key helper, a Better Auth version pin, and new env var handling. No moderation/auth/bet production logic modified.

**Reviewer-cascade subagents:** OPTIONAL by default; security-auditor RECOMMENDED for the `getRedisKey()` helper PR and the Doppler-sync verification step (because these touch shared-instance isolation discipline that protects prod). Operator decides at plan-mode kickoff.

---

## §1 Locked Decisions (LDs)

Ratified at brief-time after research-pass 2026-05-27. Plan-mode CC consumes as constraints, does not re-litigate.

### LD-1 — Staging DB substrate: separate Supabase project in existing Pro org

**Decision:** Provision new Supabase project `zugzwang-staging` inside the existing Pro organization. Not a free-tier project in a separate free org. Not shared prod DB with separate schema.

**Rationale:**
- Operator intends frequent use (UI iteration, integration trials, design work) — wants always-on, no 7-day pause.
- Pro-tier compute on staging enables honest higher-tier load tests in SCAFFOLD.9 without per-test infrastructure churn.
- Separate project guarantees connection-pool, disk I/O, RLS, and backup isolation from prod. Shared-DB-with-separate-schema was rejected on these grounds.

**Cost impact:** +$10/month minimum compute ($0.01344/hr Micro instance per Supabase docs). Total Supabase spend $25 → $35/month. Within ADR-0006 cost ceiling (≤$300/month at peak). No ADR amendment required.

**Add-ons NOT enabled on staging:** PITR, IPv4, Custom Domain (Vercel-served), Log Drains, Advanced MFA.

**Risk surfaced (carry to §4):** Supabase Pro quotas (250 GB egress, disk capacity) are org-pooled across both projects, not per-project. SCAFFOLD.9 load tests against staging share the same egress allowance as prod traffic. Unlikely to bite in a 7-week text-heavy experiment, but monitor egress on the Supabase usage dashboard during high-load days.

### LD-2 — Doppler config / Vercel environment structure: THREE configs, with `staging` mapped to a Pro Custom Environment

**Decision (REVISED from initial 2-scope design after research found Vercel Pro Custom Environments + Doppler Custom Env sync support):**

Three Doppler configs in the existing Doppler project:

| Doppler config | Synced to Vercel env | Serves |
|---|---|---|
| `prod` | Production | zugzwangworld.com |
| `staging` | Custom Environment named `staging` | staging.zugzwangworld.com |
| `preview` | Preview | all PR preview URLs (*.vercel.app) |

**Vercel Custom Environment provisioning:**
- Vercel Pro plan: 1 free Custom Environment per project (per Vercel docs revision 2026-02-27).
- Create Custom Environment named `staging` in the Vercel project settings.
- Branch tracking: bound to the `staging` git branch.
- Custom domain: `staging.zugzwangworld.com` attached to this Custom Environment.

**Doppler→Vercel sync requirements (load-bearing for breach risk surface):**
- Every sync MUST use Sensitive env var type (Doppler default for new syncs; per docs.doppler.com/docs/vercel).
- For any pre-existing sync using Encrypted type, DELETE and recreate with "Delete all secrets in Vercel" box ticked (per Doppler advisory 2026-04-21 following Vercel OAuth incident).
- Vercel env vars created via Doppler integration CANNOT be flipped to Sensitive post-hoc (Vercel API limitation, confirmed 2026-04-20). Must be Sensitive at sync creation time.
- No manual Vercel env vars — every env var created via Doppler. Prevents sync-collision errors (per Doppler support article 12963214278427).
- No cross-config secret references (e.g., `${prod.DATABASE_URL}` from staging config). Disabled at Doppler config level.

**Initial env var map (plan-mode CC validates against repo for completeness):**

| Variable | `prod` value | `staging` value | `preview` value |
|---|---|---|---|
| `ZUGZWANG_ENV` | `prod` | `staging` | `preview` |
| `ZUGZWANG_ENV_CANARY` | `prod-${date}` | `staging-${date}` | `preview-${date}` |
| `DATABASE_URL` | prod Supabase pooled URL | staging Supabase pooled URL | staging Supabase pooled URL (same as staging — PR previews share staging DB) |
| `DATABASE_URL_UNPOOLED` (if used) | prod direct URL | staging direct URL | staging direct URL |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service key | staging service key | staging service key |
| `SUPABASE_ANON_KEY` (if surfaced) | prod anon | staging anon | staging anon |
| `NEXT_PUBLIC_SITE_URL` | `https://zugzwangworld.com` | `https://staging.zugzwangworld.com` | Vercel-generated preview URL (handled by Vercel automatically) |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | staging project URL | staging project URL |
| `BETTER_AUTH_SECRET` | prod secret (existing) | new random staging secret | new random preview secret (or share staging) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | prod origin only | staging origin only | wildcard `*.vercel.app` if auth needed on PR previews; else empty |
| `RESEND_API_KEY` | prod Resend key | staging Resend sandbox key | staging Resend sandbox key |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | prod Turnstile | Turnstile test-mode key (always passes) | Turnstile test-mode key |
| `UPSTASH_REDIS_REST_URL` + token | shared (single Upstash DB) | shared (single Upstash DB) | shared (single Upstash DB) |
| `SENTRY_DSN` | prod Sentry project DSN | new `zugzwang-staging` Sentry project DSN | staging Sentry DSN (preview errors land in staging project) |
| `POSTHOG_KEY` | prod PostHog | shared prod PostHog with `environment=staging` event property (PostHog split deferred) | shared prod PostHog with `environment=preview` event property |
| `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` | prod R2 token | new staging R2 token (bucket-scoped to `zugzwang-staging`) | staging R2 token |
| `R2_BUCKET` | `zugzwang-prod` | `zugzwang-staging` | `zugzwang-staging` |
| `ADMIN_EMAIL` | operator email | operator email | operator email |

Plan-mode CC produces authoritative complete list against current repo state.

**Rationale for 3-config design (vs. earlier 2-scope plan):**
- Vercel Pro plan includes 1 free Custom Environment per project — no incremental cost.
- Decouples staging.zugzwangworld.com from PR-preview secret bundle. Staging can have its own Resend sandbox key, Turnstile test key, etc., distinct from PR-preview values.
- Cleaner mental model: `staging` is durable, `preview` is ephemeral. Future SCAFFOLD.9 load tests target `staging` Custom Environment specifically, not "whatever URL the latest PR preview happens to be."
- Doppler Custom Environment sync supported since March 2025 (Doppler forum confirmation; not yet in main docs, but verified working).

**Fallback condition (revert to 2-scope):**
If Doppler dashboard does not expose Custom Environment sync flow (the feature is in forum/community posts but not formally documented), revert to original 2-scope design (`prod` + `staging`, with `staging` serving both the Custom URL and PR previews). Operator validates this at O1 step (first Doppler dashboard login).

### LD-3 — DNS + Vercel alias topology

**Decision (REVISED from "served from Vercel Preview env" to "served from Vercel Custom Environment"):**

`staging.zugzwangworld.com` is a long-lived alias served from the Vercel `staging` Custom Environment, bound to the long-lived `staging` git branch.

**Setup:**
- DNS record at registrar: `CNAME staging.zugzwangworld.com → cname.vercel-dns.com` (unchanged from original plan).
- Vercel: create `staging` Custom Environment, attach `staging.zugzwangworld.com` as its domain, configure branch tracking for `staging` branch.
- Repo: create long-lived `staging` branch (first commit = current `main` HEAD).

**Branch promotion workflow (operator):**
- To promote a tested change to staging: `git checkout staging && git merge <feature-branch> && git push`.
- `staging.zugzwangworld.com` updates on push (Vercel auto-deploys `staging` branch into Custom Environment).

**Deployment Protection posture:**
- `staging` Custom Environment: Standard Deployment Protection ON (free on Vercel Pro). Prevents Googlebot indexing and random visitors from interacting with staging.
- `preview` environment (PR previews): Standard Deployment Protection ON (default for Pro).
- `production` environment: Deployment Protection OFF (zugzwangworld.com must be publicly accessible).
- Advanced Deployment Protection ($150/mo per Vercel docs) NOT enabled.

**Rationale:**
- Named, durable URL > fishing for ephemeral preview URLs when running smoke tests, UI review, or SCAFFOLD.9 load tests.
- Custom Environment binding (vs. Preview env binding) means staging secrets, custom domain, and branch tracking are first-class properties of the env, not workarounds.
- Standard Deployment Protection on staging means search engines won't index staging.zugzwangworld.com (preventing duplicate-content issues against prod) and casual visitors hitting the URL see Vercel's gate (which is fine — staging is for testing, not for the public).

### LD-4 — Migration + seeding posture for staging

**Decision (unchanged from initial draft):**

Staging gets full migration parity with prod + the ~200-row identity_pool dev-seed only.

**What gets applied:**
- All Drizzle migrations currently in `drizzle/migrations/` (count validated at SCAFFOLD.8 execute time).
- The ~200-row identity_pool dev-seed (per SCAFFOLD.3 spec).

**What does NOT get applied:**
- The 50K real identity_pool (SCAFFOLD.17). Staging uses dev-seed only.
- Production data (events, markets, bets, etc.). Staging starts empty beyond seed.
- Synthetic load-test data (deferred to SCAFFOLD.9).

**Migration application mechanism:**
- New script: `pnpm db:migrate:staging` (reads `DATABASE_URL_STAGING`, runs `drizzle-kit migrate`).
- Operator runs once after Supabase project provisioned.
- Future migrations: convention-based — every PR that ships a migration runs `pnpm db:migrate:staging` at merge to `staging` branch.

**Drift detection (research-driven addition):**
- Smoke-test item #10 (per LD-5) does journal-count parity check (`SELECT COUNT(*) FROM drizzle._drizzle_migrations` on staging vs. count of migration files on `staging` branch).
- Catches the dominant LD-4 failure mode (operator forgets to run staging migration).
- Deeper drift detection (`pg_dump --schema-only | diff`) deferred to HARDEN.* phase.

**Disallowed:** Schema changes via Supabase dashboard SQL editor on staging or prod. Drizzle migrations only. Codified in §0 in-scope work (added to AGENTS.md in eventual single-pass update).

### LD-5 — Smoke test scope: 10 items

**Decision (REVISED — 9 items → 10 items after research surfaced schema-journal parity check):**

`pnpm smoke:staging` covers 10 items. Item #11 (Sentry routing) folded into exit criterion #9. Item #12 (Doppler Sensitive verification) folded into exit criterion #10.

**Smoke test (`pnpm smoke:staging`):**

1. **DNS resolves:** `dig staging.zugzwangworld.com` returns Vercel CNAME, no NXDOMAIN.
2. **HTTPS works:** `curl -I https://staging.zugzwangworld.com` returns 2xx, valid TLS cert.
3. **App loads:** GET `/` returns non-error HTML (status 200, contains expected marker like app shell HTML).
4. **Staging DB connection works:** GET a route that touches DB (e.g., `/api/health` or markets list — plan-mode CC selects based on current route inventory) returns non-error.
5. **DB + scope isolation canary:** A debug route returns the value of `ZUGZWANG_ENV_CANARY`. Staging app returns `staging-${date}`. Same route on prod returns `prod-${date}`. (Collapses prior items 5 + 6 into single canary check.)
6. **PR preview deploys read from `preview` config (NOT staging):** throwaway PR opened, preview URL's debug route returns `preview-${date}`.
7. **Migrations applied to staging:** `drizzle._drizzle_migrations` table on staging has expected row count.
8. **Identity pool seeded:** `SELECT count(*) FROM identity_pool` returns ~200 on staging.
9. **Sentry routing:** test error thrown from staging deploy lands in `zugzwang-staging` Sentry project; same error timestamp/fingerprint NOT present in prod Sentry project.
10. **Schema-journal parity (NEW per research):** `SELECT COUNT(*) FROM drizzle._drizzle_migrations` on staging matches the count of migration files currently on the `staging` git branch. Catches forgotten-migration drift.

**Deferred from smoke test to "verify next time you touch staging" (Stage 2 follow-up):**
- PostHog routing (deferred until PostHog environment split is done in a follow-up chat).
- Deeper schema drift check (`pg_dump --schema-only | diff`) — HARDEN.* phase.
- R2 bucket isolation already verified at exit criterion #8 + tested implicitly by app behavior (staging app reads/writes from `zugzwang-staging` bucket only).

### LD-6 — Operator vs CC work split (EXPANDED for new in-scope work)

**Decision:** Eight operator-only steps (O1–O8), thirteen CC-only steps (C1–C13), three joint/sequenced steps (J1–J3). Full table in §6 step sequence.

**Plan-mode CC requirement:** Every step in the plan tagged `[OPERATOR]` or `[CC]` with explicit dependency on prior step completion. No step assumes prior step happened without verification.

**Net change from initial draft:**
- +0 operator steps (R2 bucket creation + Sentry project creation are operator-side, but fold into the existing O1–O8 sequence as O3a, O5a — not new step numbers, just sub-steps).
- +5 CC steps (Redis prefix helper, Better Auth version pin + secret separation, R2 SDK config update, Sentry SDK config update for staging DSN, Doppler Sensitive verification step in smoke test).
- 3 joint/sequenced steps unchanged.

### LD-7 — Critical-path classification: NOT critical-path-by-function

**Decision (REVISED — security-auditor recommended for two specific PRs):**

**Reviewer-cascade subagents:**
- Default: OPTIONAL.
- RECOMMENDED on the `getRedisKey()` helper PR (touches shared-instance isolation discipline that protects prod from staging interference).
- RECOMMENDED on the Doppler-sync Sensitive-verification step (touches credential handling and confirms breach-surface mitigation).
- OPTIONAL on all other CC steps in this brief.

**Operator decides at plan-mode kickoff** whether to invoke security-auditor on the relevant PRs.

### LD-8 — Bundle 3 split: SCAFFOLD.9 is NOT in this brief

**Decision (unchanged):**

SCAFFOLD.9 (k6 load harness) scoped to Bundle 3b, owned by future chats:
1. Load-model chat (web-solo, ~30 min) — drafts expected-load doc.
2. SCAFFOLD.9 brief-drafting chat (web-solo).
3. SCAFFOLD.9 plan-mode review (web + CC).
4. SCAFFOLD.9 execute (web + CC).

**Tracker implication:** Bundle 3 closure splits into Bundle 3a (SCAFFOLD.8) and Bundle 3b (SCAFFOLD.9). v11 tracker sweep trigger ("3 bundles closed since v10") still fires; counts as 4 closures since v10 not 3, sweep posture unchanged.

**Mini-plan amendment:** One-line note in SCAFFOLD.8 close-out log recording the split. No formal mini-plan revision document.

### LD-9 — Sentry split-project posture (NEW per research)

**Decision:** Separate Sentry projects (`zugzwang-prod` + `zugzwang-staging`), not shared project with environment tag.

**Rationale:**
- Sentry has documented issue-grouping bug where environment tags cause issues to "regress" when crossing environments (Sentry help center article 27079704782363, surfaced by research). Default issue grouping is by stack trace only; environment tag is metadata outside the grouping algorithm.
- Workaround in shared-project setup: extend issue grouping to include environment, which is more work and more error-prone than just splitting projects.
- Sentry Developer (free) plan covers 5K errors/month across all projects in the org. Splitting prod and staging fits within free tier.

**Cost impact:** $0. Free tier covers both projects.

**Setup (operator-side):**
- Create new Sentry project `zugzwang-staging` in existing Sentry org. ~5 min.
- Copy new DSN.
- Paste into `staging` and `preview` Doppler configs as `SENTRY_DSN`.

**Setup (CC-side):**
- No code change needed if Sentry SDK reads `SENTRY_DSN` from env (which is conventional). Plan-mode CC verifies current Sentry SDK init reads from env.

### LD-10 — Upstash Redis key-prefix discipline (NEW per research)

**Decision:** Continue using single Upstash Redis database, shared between prod and staging. Enforce environment-scoped key prefixes via a `getRedisKey()` helper.

**Rationale:**
- Upstash's `@upstash/ratelimit` library ships with first-class `prefix` option specifically for shared-instance scenarios.
- Splitting to a 2nd Upstash DB is the "future" escape hatch if quota or contention forces it — not needed for SCAFFOLD.8.
- Single DB simplifies dev/local setup.
- Free tier: 500K commands/month per Upstash org (per upstash.com/blog/redis-new-pricing, March 2025). PAYG: $0.20/100K additional commands.

**Implementation (CC-side):**
- New file: `src/server/redis/keys.ts` (or equivalent path; plan-mode CC selects based on current structure).
- Helper signature:
  ```typescript
  export function getRedisKey(...parts: string[]): string {
    const env = process.env.ZUGZWANG_ENV;
    if (!env || !["prod", "staging", "preview"].includes(env)) {
      throw new Error(`Invalid ZUGZWANG_ENV: ${env}`);
    }
    return [env, ...parts].join(":");
  }
  ```
- Refactor existing Redis key usage to call `getRedisKey()`. Plan-mode CC catalogs current Redis usage sites.
- For `@upstash/ratelimit` usage: pass `prefix: getRedisKey("ratelimit")` to Ratelimit constructor.

**Verification:** unit test asserting prefix presence on a known key path.

**Disallowed:** any raw Redis key construction that bypasses `getRedisKey()`. Codified in AGENTS.md eventually (deferred to single-pass update).

### LD-11 — Better Auth hardening (NEW per research)

**Decision (three parts):**

**(a) Separate `BETTER_AUTH_SECRET` per Doppler config.**
- Prod scope: existing secret (UNCHANGED).
- Staging scope: new random secret generated at SCAFFOLD.8 execute time (operator generates via `openssl rand -base64 32` or equivalent, pastes into Doppler).
- Preview scope: new random secret (separate from staging).
- Rationale: a stolen staging session cookie is unusable on prod and vice versa. Defense in depth even with host-only cookies.

**(b) Host-only cookies (Better Auth default — confirm, do NOT change).**
- Better Auth defaults to host-only cookies (per better-auth.com/docs/reference/security).
- Different subdomains (zugzwangworld.com vs. staging.zugzwangworld.com) get independent sessions automatically.
- Do NOT enable `crossSubDomainCookies`.
- `useSecureCookies: true` in all environments.

**(c) Pin Better Auth to exact version in `package.json`.**
- Currently: `"better-auth": "^X.Y.Z"` (caret range allows minor updates).
- Change to: `"better-auth": "X.Y.Z"` (exact).
- Rationale: research found a regression in Better Auth 1.3.18 that broke cross-subdomain cookies between versions. We're not using cross-subdomain, so unaffected — but pinning the version eliminates future regression risk during the 7-week experiment window.
- Renovate/Dependabot updates Better Auth pinned version intentionally via PR review, not automatically.

**`trustedOrigins` per scope:**
- `prod`: only `https://zugzwangworld.com`.
- `staging`: only `https://staging.zugzwangworld.com`.
- `preview`: wildcard `*.vercel.app` only if auth must work on PR previews; plan-mode CC verifies whether PR previews need to exercise auth (likely yes, for smoke test #6).

---

## §2 Open Questions (OQs) + Boundary Verdicts

Items plan-mode CC must resolve during /plan drafting. Each OQ has a boundary verdict: a default answer if plan-mode CC cannot resolve within the chat. Operator can override at plan-mode kickoff.

### OQ-1 — Doppler Custom Environment sync availability

**Question:** Is Doppler's "sync to Vercel Custom Environment" flow actually exposed in the operator's current Doppler dashboard? Research found a March 2025 forum confirmation but the formal docs.doppler.com/docs/vercel page does not document it as of 2026-05-27.

**Why it matters:** LD-2's 3-scope design depends on this sync flow existing. If absent, we fall back to LD-2's fallback clause (2-scope: `prod` + `staging`, where staging serves both Custom URL and PR previews).

**Resolution mechanism:** Operator validates at step O3 (first Doppler dashboard login). Specifically: when creating the new `staging` Doppler config and configuring its Vercel sync, the sync target dropdown should include "Custom Environment: staging" as an option (after the Vercel Custom Environment is provisioned at step O5).

**Boundary verdict:** If the Custom Environment sync target does NOT appear in Doppler's dropdown, revert to 2-scope LD-2 fallback. Update §0 in-scope language and LD-2 table inline (CC modifies brief at execute time, plan-mode notes the contingency). Critical decision — flag to operator immediately, do not silently fall back.

### OQ-2 — Does PR-preview auth need to work?

**Question:** Do PR preview deploys need to exercise Better Auth (signup, login, session)? Or are PR previews always anonymous-only (UI review, no auth flows)?

**Why it matters:** Determines whether `preview` Doppler config needs:
- A populated `BETTER_AUTH_SECRET` (yes if auth exercised; share with staging or generate separate).
- `BETTER_AUTH_TRUSTED_ORIGINS` with wildcard `*.vercel.app` (yes if auth exercised).
- Resend sandbox API key (yes if signup OTP flow exercised).
- Turnstile test-mode keys (yes if signup CAPTCHA exercised).

If PR previews never exercise auth, the `preview` Doppler config can be a minimal subset of `staging` (just enough to serve unauthenticated pages).

**Resolution mechanism:** Plan-mode CC inspects current route handlers + middleware to determine if any page accessible on a fresh deploy requires auth. If yes, `preview` needs full auth env vars. If no, `preview` can be auth-disabled.

**Boundary verdict:** Default to YES — `preview` gets full auth env vars (shared with `staging`). Reasoning: future PRs may add auth-touching changes that need exercise on preview before merge. Cost of "always populate preview auth env vars" is ~0 (just copy from staging at sync time). Cost of "previews fail mysteriously when a PR touches auth" is operator confusion. Lean conservative.

### OQ-3 — Smoke-test debug route: new or existing?

**Question:** Smoke-test items #5 (canary) and #6 (PR preview env check) require a route that returns `ZUGZWANG_ENV_CANARY`. Does this route already exist (e.g., `/api/health`)? Or do we add a new route specifically for the smoke test?

**Why it matters:** A new debug route is a new code surface. Plan-mode CC needs to decide:
- Path (`/api/health`, `/api/_internal/env`, `/api/smoke`).
- Authentication (public — needed for smoke test; or protected by a shared secret header).
- What it exposes (only `ZUGZWANG_ENV_CANARY` and `ZUGZWANG_ENV`; NOT `DATABASE_URL` or secrets).
- Production-safety (should this route exist on prod, or only on staging/preview?).

**Resolution mechanism:** Plan-mode CC inspects current route inventory for an existing `/api/health` or equivalent. If exists, extend it. If not, add minimal new route.

**Boundary verdict:** If `/api/health` exists, extend it to return `{ status: "ok", env: process.env.ZUGZWANG_ENV, canary: process.env.ZUGZWANG_ENV_CANARY }`. Public route. Exists on all three environments including prod (returning `prod` canary is fine — it leaks no secret). If `/api/health` does not exist, create it at exactly this shape.

**Hard constraint:** route MUST NOT expose any value from `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL` token, or any `R2_*` credentials. Plan-mode CC writes the route handler to read ONLY the two canary vars by name; no `process.env` enumeration.

### OQ-4 — Migration script: pnpm script vs. dedicated CLI command

**Question:** Should `pnpm db:migrate:staging` be:
- (a) A `package.json` script entry that wraps `DATABASE_URL=$DATABASE_URL_STAGING drizzle-kit migrate`?
- (b) A dedicated `scripts/migrate-staging.ts` that explicitly loads `DATABASE_URL_STAGING` from env, validates it's a staging URL (not prod), then invokes drizzle-kit programmatically?

**Why it matters:** Option (a) is shorter but exposes a footgun — if operator runs `pnpm db:migrate:staging` with `DATABASE_URL_STAGING` accidentally pointing to prod (Doppler config swap mistake), migration runs against prod. Option (b) adds a guard.

**Resolution mechanism:** Plan-mode CC writes script per boundary verdict.

**Boundary verdict:** Option (b). Script must:
1. Read `DATABASE_URL_STAGING` from env (NOT `DATABASE_URL`).
2. Assert URL contains a staging-identifying substring (e.g., the staging Supabase project ref, which differs from prod's project ref).
3. Print "Running migrations against staging: <project ref>" to stdout BEFORE applying.
4. Refuse to run if env mismatch detected.

Same shape for `pnpm db:seed:staging`.

### OQ-5 — `ZUGZWANG_ENV` value: where does the code read it?

**Question:** LD-10 (Redis prefix) and LD-11 (Better Auth) both read `process.env.ZUGZWANG_ENV` at runtime. Where is this set? Three options:
- (a) Each Doppler config sets `ZUGZWANG_ENV=prod|staging|preview` explicitly (per LD-2 table — current plan).
- (b) Code infers from `process.env.VERCEL_ENV` (Vercel injects `production`, `preview`, or `development` automatically).
- (c) Hybrid: code reads `ZUGZWANG_ENV` if set, falls back to `VERCEL_ENV` mapping.

**Why it matters:** Option (a) requires us to set the var in 3 places. Option (b) leverages Vercel's existing injection. Option (c) is most resilient.

**Resolution mechanism:** Plan-mode CC chooses based on boundary verdict + verifies Vercel actually injects `VERCEL_ENV` on Custom Environments (this is documented for Production + Preview; Custom Environment behavior may differ).

**Boundary verdict:** Option (a). Explicit `ZUGZWANG_ENV` set in each Doppler config. Reasoning:
- Explicit > implicit; debugging is easier when env value comes from one named source.
- `VERCEL_ENV` for Custom Environments may or may not return `"staging"` — Vercel docs don't yet fully document this; risk of Vercel returning `"preview"` for the Custom Environment instead of `"staging"`.
- LD-10's `getRedisKey()` helper throws on invalid `ZUGZWANG_ENV`; explicit Doppler config ensures it's always set correctly.

**Production-safety:** if `ZUGZWANG_ENV` is missing or invalid on a deploy, app should fail-fast at startup (not silently default to "prod"). Plan-mode CC adds an init-time check.

### OQ-6 — R2 bucket-scoped API token: per-bucket or per-environment?

**Question:** Cloudflare R2 supports bucket-scoped API tokens. Two designs:
- (a) One token per bucket: `zugzwang-prod` token reads/writes only `zugzwang-prod`; `zugzwang-staging` token reads/writes only `zugzwang-staging`.
- (b) One token per environment, with multi-bucket scope: prod env token can read/write prod bucket only; staging env token can read/write staging bucket only.

In practice (a) and (b) are functionally identical for a 2-bucket setup. The question is naming + ergonomics.

**Boundary verdict:** Option (a). Token names: `zugzwang-prod-rw` and `zugzwang-staging-rw`. Stored as `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` in each Doppler config. Plan-mode CC verifies token scope at creation time.

**Hard constraint:** the `zugzwang-staging-rw` token MUST NOT be able to list, read, or write `zugzwang-prod` bucket. Smoke test (item: implicit in exit criterion #8) verifies this by attempting an unauthorized read against prod bucket with staging token; expect 403.

### OQ-7 — Existing Better Auth version on `main`: what is it?

**Question:** LD-11 says pin Better Auth to exact version. What version is currently in `package.json`?

**Why it matters:** If currently caret-ranged (e.g., `^1.4.2`), plan-mode CC needs to:
- Check what version is actually installed in lockfile.
- Pin to that exact version in `package.json`.
- Verify no concurrent renovate/dependabot PR open that would override the pin.

**Resolution mechanism:** Plan-mode CC reads `package.json` + `pnpm-lock.yaml`.

**Boundary verdict:** Pin to whatever version is currently in `pnpm-lock.yaml`. Do NOT upgrade as part of SCAFFOLD.8. Future Better Auth upgrades are intentional PRs, not side effects of staging setup.

### OQ-8 — Doppler config naming: `staging`/`preview` or something else?

**Question:** Are `staging` and `preview` the right Doppler config names? Doppler conventions in some projects use `stg`, `stage`, `dev`, etc.

**Boundary verdict:** Use `staging` and `preview` as written. Reasoning: matches Vercel's terminology exactly, reduces cognitive load when operator switches between Doppler and Vercel dashboards.

**Doppler config path will be:** `zugzwang/prod`, `zugzwang/staging`, `zugzwang/preview` (where `zugzwang` is the existing Doppler project). Confirmed at step O3.

### OQ-9 — What does "PR preview reads from `preview` (not staging)" actually test?

**Question:** Smoke-test item #6 says "throwaway PR opened, preview URL's debug route returns `preview-${date}`." But:
- If `preview` Doppler config is empty or sync isn't configured at first run, the preview URL might 500 (because no DATABASE_URL).
- If `preview` config is populated identically to `staging` (per OQ-2 default), the canary differs only by the `ZUGZWANG_ENV_CANARY` value — meaning the test relies on that one var being different.

**Boundary verdict:** `ZUGZWANG_ENV_CANARY` is a per-config var with a hardcoded different value (e.g., `staging-2026-05-27` vs. `preview-2026-05-27`). This is the load-bearing var for smoke-test item #6. Plan-mode CC ensures both configs populate this var with distinguishable values.

**Operator note:** If smoke-test #6 ever returns the staging canary on a preview URL, it means Doppler→Vercel sync routed the wrong config to the preview env. Indicates LD-2 setup error, not code bug.

### OQ-10 — Should the `staging` git branch be protected?

**Question:** GitHub branch protection rules — should `staging` branch require PR review like `main`?

**Why it matters:** If `staging` is protected, operator can't push directly to it; every staging deploy requires a PR. Adds friction but matches `main` discipline.

**Boundary verdict:** NO branch protection on `staging` for now. Reasoning:
- Operator needs to push to `staging` rapidly during UI iteration / design trials.
- Staging is throwaway; broken staging is not customer-affecting.
- Branch protection adds PR overhead inconsistent with "use staging as a fast iteration loop."
- Revisit in HARDEN.* phase if staging starts holding load-test results we don't want overwritten.

`main` branch protection (PRs required, no direct push) remains unchanged.

### OQ-11 — Are there any env vars currently set in Vercel manually (not via Doppler)?

**Question:** Doppler sync requires that no env vars exist in Vercel that weren't created by Doppler. Per Doppler support article 12963214278427, manual + Doppler vars collide and the sync errors out.

**Why it matters:** If the current Vercel project has env vars set manually (left over from initial bootstrap before Doppler integration), the 3-scope sync will fail at step O5.

**Resolution mechanism:** Operator checks Vercel project settings → Environment Variables before configuring new syncs. Plan-mode CC adds an explicit O3.5 step: "Operator audits existing Vercel env vars; any non-Doppler-sourced var is documented and either deleted or migrated to Doppler."

**Boundary verdict:** All env vars must be Doppler-sourced before SCAFFOLD.8 syncs. Operator deletes any manual env vars before creating new syncs. Plan-mode CC flags this as a pre-flight gate.

### OQ-12 — Sentry SDK environment tag: still set or not?

**Question:** Even with separate Sentry projects per LD-9, Sentry SDK init typically passes an `environment` field to the SDK. Should we still pass `environment: process.env.ZUGZWANG_ENV` even though prod and staging are separate projects?

**Why it matters:** Defense in depth — if a misconfigured deploy ever sends to the wrong DSN, the `environment` tag on the event still distinguishes it. Cost: ~0. Benefit: extra signal.

**Boundary verdict:** YES. Keep `environment: process.env.ZUGZWANG_ENV` in Sentry SDK init. Belt-and-suspenders against DSN mis-routing.

### Summary table

| OQ | Question | Boundary verdict | Resolved by |
|---|---|---|---|
| OQ-1 | Doppler Custom Env sync available? | Default YES, fallback to 2-scope if absent | Operator at O3 |
| OQ-2 | PR-preview auth needed? | YES (full auth envs in preview) | Plan-mode CC route audit |
| OQ-3 | Debug route: new or existing? | Extend `/api/health` or create same-shape route | Plan-mode CC route inventory |
| OQ-4 | Migration script: simple or guarded? | Guarded (`scripts/migrate-staging.ts` with assert) | Plan-mode CC |
| OQ-5 | `ZUGZWANG_ENV` source? | Explicit per Doppler config | Plan-mode CC |
| OQ-6 | R2 token scope? | Per-bucket | Operator at O5a |
| OQ-7 | Current Better Auth version? | Pin to current lockfile version | Plan-mode CC reads package.json |
| OQ-8 | Doppler config naming? | `staging` + `preview` | Confirmed |
| OQ-9 | What does smoke-test #6 actually test? | `ZUGZWANG_ENV_CANARY` differs per config | Plan-mode CC ensures Doppler populates |
| OQ-10 | Branch protection on `staging`? | NO | Confirmed |
| OQ-11 | Manual Vercel env vars to clean up? | Pre-flight audit by operator | Operator at O3.5 |
| OQ-12 | Sentry SDK environment tag? | YES, keep it | Plan-mode CC |

---

## §3 Input Contract Sources

Authoritative inputs plan-mode CC reads before drafting the plan. Reads in this order; downstream sources are interpreted in light of upstream.

### Tier 1 — Locked architecture (cannot conflict with)

**SPEC.1.md**
- §"Scope + thesis invariants" — confirms experiment-phase scope discipline (no testnet/mainnet concerns leak into SCAFFOLD.8).
- §"Stack lock" — confirms Next.js 16, Supabase, Doppler, Vercel, Drizzle, Better Auth, R2, Upstash, Sentry, PostHog as the stack SCAFFOLD.8 operates on.

**SPEC.2.md** (running ADR log)
- Most recent entry: ADR-0016 close-out (whatever it is at SCAFFOLD.8 execute time).
- Plan-mode CC checks SPEC.2 for any ADRs ratified between this brief (2026-05-27) and execute time that touch staging, env-var handling, or infra. If found, surface and reconcile.

### Tier 2 — ADRs SCAFFOLD.8 consumes as constraints

**ADR-0003 — Next.js 16 App Router**
- Constrains where the debug route (per OQ-3) lives: `src/app/api/health/route.ts` (App Router convention), Node runtime (per ADR-0003 §"Runtime").
- Confirms Server Actions as mutation contract — irrelevant for SCAFFOLD.8 (no mutations), but plan-mode CC respects it for any code touched.

**ADR-0004 — Better Auth**
- Locks Better Auth as the auth library. LD-11's "pin to exact version" applies to whatever version ADR-0004 ratified.
- Confirms email-OTP plugin with Resend transport — relevant to OQ-2 (PR-preview auth needs Resend sandbox key).
- Database session strategy — confirms staging sessions land in staging DB (not shared session store).

**ADR-0005 — Postgres event sourcing**
- Confirms SERIALIZABLE transaction requirement on bet/comment paths — irrelevant to SCAFFOLD.8 directly but plan-mode CC respects the Node runtime requirement (SCAFFOLD.8 touches no Server Actions, but the debug route at OQ-3 must declare Node runtime).

**ADR-0006 — Hosting (Vercel + Supabase + Cloudflare R2 + Upstash)**
- Authoritative on cost ceiling: ≤$300/month at peak. LD-1's +$10/month and all other SCAFFOLD.8 spending validated against this.
- Authoritative on the 5,000-concurrent ceiling SCAFFOLD.8/.9 sizes infrastructure against.
- Confirms Cloudflare R2 as object storage (relevant to LD-2 R2 isolation work).
- Confirms Upstash as rate-limit + idempotency substrate (relevant to LD-10).

**ADR-0007 — Observability**
- Confirms Sentry + PostHog as the observability stack.
- LD-9's split-project decision is a refinement on ADR-0007, not a contradiction. Plan-mode CC verifies ADR-0007 doesn't explicitly mandate shared-project pattern (it doesn't — research-pass confirmed ADR-0007 is silent on environment-split posture).

**ADR-0008 — Drizzle ORM**
- Confirms `drizzle-kit migrate` as the migration runner.
- Confirms `drizzle._drizzle_migrations` table as the journal (relevant to LD-5 item #10 and OQ-7 boundary verdict).
- Confirms migration file location (likely `drizzle/migrations/` — plan-mode CC verifies exact path against current repo state).

**ADR-0009 — Ranking function lock**
- Irrelevant to SCAFFOLD.8 directly. Listed for completeness; plan-mode CC does NOT need to read.

**ADR-0010 — Admin auth wiring**
- Confirms admin auth flow. SCAFFOLD.8 staging may or may not include an admin login path; plan-mode CC verifies admin-route existence at OQ-3 inventory step.

**ADR-0011 — Pseudonym pool design**
- Confirms identity_pool ~200-row dev-seed (LD-4's seed scope).
- Confirms 50K real-pool is SCAFFOLD.17 scope, NOT applied to staging.

**ADR-0013 — Concurrency bet transaction**
- Irrelevant to SCAFFOLD.8 directly. Listed because plan-mode CC must NOT modify any code touched by ADR-0013 (bet path) during SCAFFOLD.8.

**ADR-0014 — Pre-commit moderation flow**
- Irrelevant to SCAFFOLD.8 directly. Same caveat as ADR-0013 — moderation code untouched.

**ADR-0015 — Rate-limit + idempotency**
- Confirms `@upstash/ratelimit` library + Upstash Redis as substrate.
- Confirms idempotency keys also on Upstash.
- LD-10's `getRedisKey()` helper applies to both rate-limit keys AND idempotency keys. Plan-mode CC verifies both call sites are refactored.

**ADR-0016 — ID schema UUIDv7**
- Confirms UUIDv7 for all primary keys including any debug-route response shapes (if relevant).
- Irrelevant to SCAFFOLD.8 directly otherwise.

### Tier 3 — Living docs (interpret in light of)

**CLAUDE.md (repo root)**
- §1 critical-path classification: SCAFFOLD.8 is NOT critical-path-by-function per LD-7. Plan-mode CC validates this classification against §1 globs (paths touched).
- §5 PR self-audit discipline: SCAFFOLD.8 PRs run pre-PR self-audit on the `getRedisKey()` helper PR and the Doppler-sync verification step.
- §10 shell-fed tmpfile hygiene: any `/tmp/*` file plan-mode CC writes for commits, PR bodies, or shell-buffer bypass gets `rm -f`'d after use.
- §11 subagent invocation: security-auditor RECOMMENDED on Redis helper + Doppler verification PRs per LD-7.

**AGENTS.md (repo root)**
- §"Drizzle migration patterns" (if exists) — plan-mode CC respects existing patterns.
- §"Vitest skip semantics" (per SCAFFOLD.18 close-out CF) — relevant if any unit tests added need runtime-vs-collection-time skip discipline.
- AGENTS.md edits stay deferred per ratified "single dedicated pass after all ADRs complete" rule. SCAFFOLD.8 does NOT modify AGENTS.md.

**zugzwang_experiment_tracker_v10.html**
- SCAFFOLD.8 + SCAFFOLD.9 task descriptions confirmed against this brief's scope.
- SCAFFOLD.3 task description for identity_pool dev-seed reference (LD-4).
- SCAFFOLD.17 task description for 50K real-pool deferral (LD-4).
- Plan-mode CC does NOT modify tracker — tracker hygiene deferred to v11 sweep chat post-Bundle-3.

### Tier 4 — External documentation (read at execute time, not brief-time)

Plan-mode CC will cite these but does NOT need to read them at plan-mode time. Execute chat references as needed.

- **Doppler ↔ Vercel sync docs:** docs.doppler.com/docs/vercel (Custom Environment sync may not yet be documented here; fallback per OQ-1 boundary verdict).
- **Vercel Custom Environments docs:** vercel.com/docs/deployments/environments (revised 2026-02-27 per research-pass).
- **Vercel Deployment Protection docs:** vercel.com/docs/deployment-protection.
- **Supabase billing docs:** supabase.com/docs/guides/platform/billing-on-supabase (for org-pooled quota reference).
- **Supabase Drizzle integration docs:** for any Supabase-specific Drizzle gotchas (e.g., RLS bypass with service role key).
- **Cloudflare R2 bucket-scoped tokens:** developers.cloudflare.com/r2 (for token creation flow at O5a).
- **`@upstash/ratelimit` README:** github.com/upstash/ratelimit-js (for `prefix` option usage in LD-10).
- **Better Auth security docs:** better-auth.com/docs/reference/security (for host-only cookies + `trustedOrigins` per LD-11).
- **Sentry environment tag docs:** docs.sentry.io/platforms/javascript/configuration/environments (for OQ-12 verification).

### Tier 5 — Predecessor close-outs (context only)

**chat_close_2026-05-26_SCAFFOLD-finish-bundle-2.md** — Bundle 2 execute close-out. Confirms SCAFFOLD.5/.6/.7 (observability) shipped. CF-3 (Corepack PATH race) noted as PRECURSOR.4 candidate; not blocking SCAFFOLD.8.

**chat_close_2026-05-27_SCAFFOLD_18_plan_mode_review.md** — SCAFFOLD.18 plan-mode close-out. Plan-mode discipline reference.

**chat_close_2026-05-27_SCAFFOLD_18_execute_review.md** — SCAFFOLD.18 execute close-out. Carries forward 8 HARDEN-phase items + AGENTS.md doc deferrals. None blocking SCAFFOLD.8. CF-3 (R2 sharing risk previously noted as low-priority) RECLASSIFIED by SCAFFOLD.8 research-pass to high-priority and absorbed into LD-2 in-scope work.

### What plan-mode CC does NOT consume

- **SPEC.1 §"Debate view rules"** — irrelevant to SCAFFOLD.8.
- **RANKING.md** — irrelevant.
- **PSEUDONYM.md** — irrelevant beyond the dev-seed reference already captured in LD-4.
- **MKT-*-spec.md files** — irrelevant. Marketing/launch markets are content scope, not infra.
- **Any testnet/mainnet documents** — out of experiment scope per CLAUDE.md.
- **Canonical paper (zugzwang_btc_style_v4)** — irrelevant.

### Provenance note

This §3 was authored at brief-time 2026-05-27 based on the ADR set ratified through ADR-0016. If any ADR between ADR-0016 and SCAFFOLD.8 execute time changes the inputs above, plan-mode CC reconciles and notes the drift in plan-mode close-out.

---

## §4 Risk Register

Risks identified at brief-time 2026-05-27. Each has: severity (Sev), likelihood (Lik), mitigation baked into the plan, and detection mechanism if it fires anyway.

Severity scale: **Critical** (corrupts prod or blocks experiment launch), **High** (multi-day rework), **Medium** (hours of cleanup), **Low** (minor friction).
Likelihood scale: **Likely** (>50% over experiment window), **Possible** (10–50%), **Unlikely** (<10%).

### Risk 1 — Doppler Custom Environment sync not exposed in dashboard

**Sev:** High • **Lik:** Possible

**What fires:** At step O3, operator opens Doppler dashboard to create the `staging` config + Vercel sync. The sync target dropdown does NOT include "Custom Environment: staging" as an option. LD-2's 3-scope design becomes unimplementable.

**Why this risk exists:** Research found only a March 2025 forum confirmation of this feature; docs.doppler.com/docs/vercel does NOT formally document Custom Environment sync as of brief-time. Feature may be plan-gated, region-gated, or rolled out unevenly.

**Mitigation (in plan):**
- LD-2 fallback clause activates: revert to 2-scope (`prod` + `staging`, where `staging` serves both Custom URL and PR previews).
- OQ-1 boundary verdict: operator flags to chat immediately upon detection at O3. CC pauses execute and modifies brief inline.

**Detection:** First operator login at O3. Cannot proceed past O3 without resolving.

**Cost if fires:** ~30 min of brief amendment + ~$0 additional infrastructure cost (2-scope works, just less clean). No deadline impact.

### Risk 2 — Manual Vercel env vars collide with Doppler sync

**Sev:** High • **Lik:** Likely

**What fires:** At step O5, operator configures Doppler→Vercel sync. Sync errors out because Vercel project has existing env vars from initial bootstrap (likely candidates: `NODE_ENV` overrides, OAuth client IDs, anything `NEXT_PUBLIC_*`, leftover test secrets). Per Doppler support article 12963214278427, the sync refuses to overwrite manually-set vars.

**Why this risk exists:** Repo has been live since Apr 24 build start. Some env vars almost certainly entered Vercel manually during early bootstrap before full Doppler integration. Standard footgun for any team migrating to Doppler mid-project.

**Mitigation (in plan):**
- OQ-11 pre-flight gate: step O3.5 — "Operator audits existing Vercel env vars; any non-Doppler-sourced var is documented and either deleted or migrated to Doppler."
- Plan-mode CC writes a script `pnpm vercel-env-audit` that fetches the Vercel env var list via Vercel CLI and prints which are Doppler-managed (suffix `Synced from Doppler` in Vercel) vs. manually-set.

**Detection:** Pre-flight audit at O3.5 OR sync error at O5.

**Cost if fires:** ~15–30 min to audit, document, and clean up. Documented vars need backfilling into Doppler if they're load-bearing.

### Risk 3 — Doppler→Vercel sync created with Encrypted (not Sensitive) env vars

**Sev:** Critical • **Lik:** Possible

**What fires:** Operator creates new Doppler→Vercel sync. Sync defaults to Encrypted instead of Sensitive (this should NOT happen — Doppler defaults to Sensitive for new syncs as of 2024 — but the operator UI may have a misconfigured per-config default, or the operator may click the wrong toggle). Per Vercel community 2026-04-20: Encrypted vars cannot be flipped to Sensitive post-hoc via API. Per Trend Micro 2026-04 analysis of April 2026 Vercel OAuth breach: non-Sensitive vars were readable in compromised team scopes.

**Why this risk exists:** Vercel OAuth supply-chain attack surface is real and recent. Catastrophic if staging credentials leak to attacker — staging Supabase service role key gives full DB access.

**Mitigation (in plan):**
- LD-2 explicit requirement: "Every Doppler→Vercel sync MUST use Sensitive env var type."
- Smoke-test exit criterion #10: verify at least one staging-only secret via `vercel env pull` shows Sensitive.
- Plan-mode CC adds a step: at O5 (sync creation), operator screenshots the Sensitive toggle state BEFORE confirming sync. Screenshot lives in PR description.
- If detected post-creation: delete sync, recreate with Sensitive (per LD-2 advisory note).

**Detection:** Smoke test exit criterion #10. If sync was Encrypted but smoke test passed (because we verified the wrong var), undetected until next security review.

**Cost if fires:**
- If caught at smoke test: ~30 min to delete + recreate syncs.
- If undetected and breach occurs: catastrophic. Mitigation strategy ASSUMES we catch this at smoke test.

### Risk 4 — Convention-based staging migration skipped on a PR, drift goes undetected

**Sev:** Medium • **Lik:** Likely (over 7-week window)

**What fires:** A PR introduces a Drizzle migration, merges to `main`, but operator/CC forgets to run `pnpm db:migrate:staging`. Staging schema lags prod. Next PR that touches the same area sees test failures on staging that don't reproduce on prod (because staging's schema is older). Days of confusion.

**Why this risk exists:** LD-4 is convention-based, not automated. Research-pass identified this as the dominant failure mode of convention-based regimes.

**Mitigation (in plan):**
- Smoke-test item #10 (schema-journal parity check) catches drift the next time `pnpm smoke:staging` runs.
- OQ-4 boundary verdict: `pnpm db:migrate:staging` is a guarded script that prints expected vs. actual journal count after running. Operator sees confirmation.
- §0 documents convention explicitly: "every PR with migrations runs `pnpm db:migrate:staging` at merge to `staging` branch."
- Out-of-scope (Stage 2 follow-up): GitHub Action that runs staging migration on merge. Removes the human step entirely.

**Detection:** Smoke-test item #10 OR mysterious staging failures during UI iteration.

**Cost if fires:** ~10 min to catch up missed migrations. Risk is repeated drift over the experiment window if Stage 2 GitHub Action isn't done.

### Risk 5 — R2 bucket-scoped API token misconfigured, staging token has prod-bucket access

**Sev:** Critical • **Lik:** Possible

**What fires:** At step O5a, operator creates Cloudflare R2 API token intended to scope to `zugzwang-staging` bucket only. Operator selects "Object Read & Write" permission but forgets to restrict bucket scope (Cloudflare UI defaults to all-account or all-buckets in some flows). Token ends up with read/write access to BOTH staging and prod buckets. Staging code can now delete or overwrite prod objects.

**Why this risk exists:** R2 token-scoping UI is a known footgun. Cloudflare community thread on R2 token scoping documents multiple instances of operators creating broader-scoped tokens than intended.

**Mitigation (in plan):**
- OQ-6 hard constraint: "the `zugzwang-staging-rw` token MUST NOT be able to list, read, or write `zugzwang-prod` bucket."
- Plan-mode CC adds explicit verification step C8a (or similar number): script that uses the staging token to attempt a `HEAD` request against `zugzwang-prod` bucket; expect 403. If 200, token is over-scoped — operator regenerates with correct scope.
- Exit criterion #8 codifies this verification.

**Detection:** C8a verification step. If skipped, undetected until staging code accidentally hits prod bucket.

**Cost if fires:**
- If caught at verification: ~10 min to regenerate token with correct scope.
- If undetected: ranges from minor (staging logs leak to prod bucket, easy cleanup) to severe (staging integration test calls `R2.deleteObject()` against prod key by accident, prod object loss).

### Risk 6 — `getRedisKey()` helper not applied at all call sites, prod and staging share rate-limit state

**Sev:** Medium • **Lik:** Possible

**What fires:** Plan-mode CC adds the `getRedisKey()` helper but misses one or more existing Redis call sites in the codebase. Those call sites continue using unprefixed keys. Result: prod and staging share rate-limit counter for that specific code path. Staging traffic (and especially SCAFFOLD.9 load tests) burns prod's rate-limit budget.

**Why this risk exists:** Codebase has been growing since Apr 24. Redis usage may be scattered across multiple files. Easy to miss a call site during refactor.

**Mitigation (in plan):**
- Plan-mode CC catalogs ALL Redis call sites BEFORE writing the helper. Plan includes a grep pattern (`grep -r "redis\." src/` or equivalent) and the catalog is in the plan as an artifact.
- Linter rule (deferred to HARDEN.* phase, NOT in SCAFFOLD.8 scope) eventually prevents raw key construction. For SCAFFOLD.8: rely on PR self-audit + security-auditor subagent (per LD-7) reviewing the Redis helper PR.
- Unit test: instantiates a `@upstash/ratelimit` mock and asserts the `prefix` option contains the env name. Catches regression at PR time.

**Detection:** Code review + unit test at PR time. SCAFFOLD.9 load test surfaces it post-merge if missed.

**Cost if fires:** ~30 min to find missed call site + write refactor + re-test.

### Risk 7 — Better Auth `BETTER_AUTH_SECRET` rotation breaks existing prod sessions

**Sev:** Critical • **Lik:** Unlikely (but possible if LD-11 is misread)

**What fires:** LD-11 says "Generate fresh `BETTER_AUTH_SECRET` for staging (different from prod)." If operator or plan-mode CC misreads this as "rotate the prod secret too," all existing prod sessions invalidate. Every prod user is logged out simultaneously.

**Why this risk exists:** Secret rotation is a footgun when one config is intended to stay unchanged. LD-11 is explicit ("staging" only), but execute-time reading errors happen.

**Mitigation (in plan):**
- LD-11 explicitly says: "Prod scope: existing secret (UNCHANGED)." Wording in §1 and §0 emphasizes "unchanged" verbatim.
- Plan-mode CC adds a guard: any step that touches `BETTER_AUTH_SECRET` in the `prod` Doppler config must be flagged as a scope violation. Plan-mode CC must NOT propose rotating prod secret.
- Operator-side: when O4 populates Doppler `staging` config, operator confirms they're editing `staging` config NOT `prod` config (Doppler UI shows config name clearly).

**Detection:** If fires, immediately detectable (every prod user gets logged out, error reports in Sentry within minutes).

**Cost if fires:** Sessions cannot be restored. All users must log back in. Reputational, not data-loss. ~minutes-to-hours of user friction. NO permanent data loss.

### Risk 8 — Supabase org-pooled egress quota exhausted by SCAFFOLD.9 load tests

**Sev:** Medium • **Lik:** Possible (only during SCAFFOLD.9 runs)

**What fires:** SCAFFOLD.9 load test runs aggressive read traffic against staging during the same billing month as a prod traffic spike. Combined egress exceeds 250 GB Pro-tier quota. Overage billed at $0.09/GB.

**Why this risk exists:** Supabase Pro quotas (250 GB egress) are pooled across org's projects per Supabase billing FAQ. Both prod and staging projects share this quota.

**Mitigation (in plan):**
- Not blocking for SCAFFOLD.8 (SCAFFOLD.9 is the consumer of staging compute).
- LD-1 risk-surfaced explicitly: §1 ratification includes "monitor egress on Supabase usage dashboard during high-load days."
- Carries forward to SCAFFOLD.9 brief: load harness should not run during prod high-traffic windows.

**Detection:** Supabase usage dashboard. Operator checks weekly during experiment.

**Cost if fires:** Variable overage charge. At 100 GB overage (extreme case): $9. Unlikely to materially impact ADR-0006 cost ceiling.

### Summary table

| # | Risk | Sev | Lik | Mitigation phase | Detection |
|---|---|---|---|---|---|
| 1 | Doppler Custom Env sync not exposed | High | Possible | OQ-1 fallback to 2-scope | O3 operator check |
| 2 | Manual Vercel env var collision | High | Likely | O3.5 pre-flight audit | O5 sync error |
| 3 | Doppler→Vercel sync Encrypted (not Sensitive) | Critical | Possible | LD-2 explicit + smoke #10 | Smoke test |
| 4 | Staging migration skipped on PR, drift | Medium | Likely | Smoke #10 journal parity | Smoke test |
| 5 | R2 token over-scoped | Critical | Possible | OQ-6 + C8a verification | C8a test |
| 6 | `getRedisKey()` not applied at all sites | Medium | Possible | Plan-mode catalog + unit test | PR review + SCAFFOLD.9 |
| 7 | Prod Better Auth secret accidentally rotated | Critical | Unlikely | LD-11 explicit "unchanged" | Sentry post-deploy |
| 8 | Supabase org-pooled egress exhausted | Medium | Possible | SCAFFOLD.9 timing discipline | Usage dashboard |

### What's NOT in the risk register (deliberately)

- **Vercel platform outage during SCAFFOLD.8 execute.** Acts of vendor; out of our control. Not a SCAFFOLD.8-specific risk.
- **Supabase staging project provisioning fails.** Possible but ~0% from history; if fires, retry or contact Supabase support. Not worth a risk entry.
- **DNS propagation delay.** Routine; <1 hour typical. Plan-mode CC includes a "wait for DNS" step at O6 that polls `dig` until CNAME resolves. Not a risk, just a step.
- **SCAFFOLD.9 risks.** Out of SCAFFOLD.8 scope per LD-8. Owned by SCAFFOLD.9 brief.
- **PostHog environment split breaking analytics.** PostHog split deferred to Stage 2 per §0. Risk owned by that future chat, not SCAFFOLD.8.

---

## §5 Test Plan

What gets tested, where the tests live, how they run, what passes/fails. Three test layers: smoke test (operational), unit tests (code correctness), and exit-criteria verification (one-shot at execute close).

### Layer 1 — Smoke test (operational)

**Artifact:** `scripts/smoke-staging.ts` (TypeScript, run via `tsx` or equivalent).
**Invocation:** `pnpm smoke:staging`.
**Environment:** runs locally with `DATABASE_URL_STAGING` + `R2_*_STAGING` + Sentry/canary env vars sourced from `staging` Doppler config (operator runs `doppler run --config staging -- pnpm smoke:staging`).
**Runtime:** ~30–60 seconds (network-bound on DNS, HTTPS, Vercel cold-start).
**Output:** structured stdout per item — `[PASS] item-name` or `[FAIL] item-name: <reason>`. Non-zero exit code on any failure.

**10 items (per LD-5):**

| # | Item | Mechanism | Expected |
|---|---|---|---|
| 1 | DNS resolves | `dig staging.zugzwangworld.com +short` | Returns Vercel CNAME, no NXDOMAIN |
| 2 | HTTPS works | `curl -sI https://staging.zugzwangworld.com` | 2xx status, valid TLS cert |
| 3 | App loads | GET `/` | 200, body contains expected app shell marker |
| 4 | Staging DB connects | GET `/api/health` (per OQ-3) | 200, JSON includes `db: "ok"` |
| 5 | DB + scope isolation canary | GET `/api/health` | JSON `env: "staging"`, `canary: "staging-${DATE}"` |
| 6 | PR preview reads `preview` config | GET `<preview-url>/api/health` (preview URL supplied by operator after throwaway PR) | JSON `env: "preview"`, `canary: "preview-${DATE}"` |
| 7 | Migrations applied | Direct SQL: `SELECT COUNT(*) FROM drizzle._drizzle_migrations` on staging | Matches expected migration count from repo |
| 8 | Identity pool seeded | Direct SQL: `SELECT COUNT(*) FROM identity_pool` on staging | ~200 |
| 9 | Sentry routing | Trigger known error from staging deploy; query Sentry API for the error event in `zugzwang-staging` project | Event present in staging Sentry; NOT present in prod Sentry |
| 10 | Schema-journal parity | Same as #7, plus assert count equals number of migration `.sql` files in `drizzle/migrations/` on `staging` branch | Counts match |

**Failure semantics:**
- Any item failing → exit code 1, descriptive stderr line.
- All items must pass for SCAFFOLD.8 to close.
- Operator re-runs `pnpm smoke:staging` after any fix.

**Failure escalation map (which exit criterion fails when smoke item fails):**

| Smoke item fails | Exit criterion affected | What to investigate first |
|---|---|---|
| #1 | EC1 | DNS registrar config (operator-side) |
| #2 | EC1, EC2 | Vercel domain attachment (operator-side) |
| #3 | EC1 | Vercel deploy status, build logs |
| #4 | EC2 | `DATABASE_URL_STAGING` in `staging` Doppler config |
| #5 | EC2, EC3 | Doppler→Vercel sync routing (which scope is wired to which env) |
| #6 | EC4 | `preview` Doppler config existence + sync wiring |
| #7 | EC5 | `pnpm db:migrate:staging` was not run or partially failed |
| #8 | EC6 | `pnpm db:seed:staging` was not run |
| #9 | EC9 | `SENTRY_DSN` in `staging` Doppler config points to wrong project |
| #10 | EC5, EC11 | Migration drift — convention skipped |

### Layer 2 — Unit tests (code correctness)

**Two new unit test files.** Existing test infrastructure assumed (Vitest per recent SCAFFOLD work; plan-mode CC verifies).

**Test 1: `getRedisKey()` helper enforces env prefix.**
- File: `src/server/redis/keys.test.ts` (path matches helper location per LD-10).
- Cases:
  - `getRedisKey("ratelimit", "user", "abc")` with `ZUGZWANG_ENV=prod` returns `"prod:ratelimit:user:abc"`.
  - Same call with `ZUGZWANG_ENV=staging` returns `"staging:ratelimit:user:abc"`.
  - Same call with `ZUGZWANG_ENV=preview` returns `"preview:ratelimit:user:abc"`.
  - With `ZUGZWANG_ENV` missing throws.
  - With `ZUGZWANG_ENV="dev"` or other invalid value throws.
- Mitigates Risk 6 (helper not applied at all sites — at minimum the helper itself is verified correct).

**Test 2: `@upstash/ratelimit` constructor receives env-prefixed `prefix` option.**
- File: `src/server/redis/ratelimit.test.ts` (or wherever Ratelimit instances are created).
- Mocks `@upstash/ratelimit` Ratelimit class, asserts constructor `prefix` argument starts with current `ZUGZWANG_ENV` value.
- Mitigates Risk 6 directly — catches regression where a Ratelimit instance is created with hardcoded prefix.

**Tests NOT added in SCAFFOLD.8 (deferred):**
- Better Auth secret separation test (would require mocking Better Auth init; defer to Better Auth-touching PR in future).
- R2 bucket isolation test (covered by smoke test step C8a's HEAD-403 check, no unit test needed).
- Doppler Sensitive verification test (operator-side verification; no code path to unit-test).

### Layer 3 — Exit-criteria verification (one-shot at execute close)

**Artifact:** Exit-criteria checklist in close-out log `docs/logs/SCAFFOLD.8.md`.

**Each of the 12 exit criteria (per §0) recorded as PASS/FAIL with evidence:**
- EC1–EC4, EC7, EC9, EC10: smoke test output cited.
- EC5, EC6: direct DB query output cited (SQL + result row count).
- EC8: R2 token verification output cited (HEAD request + 403 response).
- EC11: PR URL + merge confirmation cited.
- EC12: this very log committed (self-referential — last item).

**Discipline:** No exit criterion marked PASS without verifiable evidence in the close-out. "I think it worked" is not evidence. CC commits to writing the close-out before declaring SCAFFOLD.8 done.

### What's NOT tested

- **Better Auth multi-environment session isolation.** No automated test — relies on Better Auth's host-only cookie default (per LD-11) being correct. Manual verification: log in on staging, confirm prod session cookie is not sent.
- **Cloudflare Turnstile test-mode keys actually work.** Trust Cloudflare's docs. No automated test.
- **Resend sandbox key actually sends to test domain.** Trust Resend's docs. Manual verification at first signup flow on staging.
- **Performance under load.** Out of SCAFFOLD.8 scope; owned by SCAFFOLD.9.
- **End-to-end user flows (signup → bet → comment) on staging.** Out of SCAFFOLD.8 scope. SCAFFOLD.8 verifies infrastructure; behavior testing is owned by ENGINE.* + DEBATE.* phases.

### Test ordering in execute

```
1. CC: write smoke test script (`scripts/smoke-staging.ts`)
2. CC: write unit tests (Test 1 + Test 2)
3. CC: run unit tests locally → must pass
4. Operator: run prerequisites (migrations + seed via J1/J2)
5. Operator + CC: deploy to staging
6. CC: run `pnpm smoke:staging` → must pass items 1–5, 7, 8
7. Operator: open throwaway PR
8. CC: run smoke test item 6 against preview URL
9. CC: trigger Sentry test error → verify item 9
10. CC: confirm item 10 (journal parity) post-J1
11. CC: record all exit criteria PASS in close-out
```

---

## §6 Step Sequence

Phased execution. 8 operator-only steps (O*), 13 CC-only steps (C*), 3 joint/sequenced steps (J*). Total ~3 phases over ~3–4 chat hours wall-clock + ~45 min operator time spread across dashboards.

Format: `[OWNER] Step-N — description (est time, dependencies, abort condition)`

### Phase 1 — Provisioning + Doppler/Vercel wiring (~1.5h total)

**[OPERATOR] O1 — Provision `zugzwang-staging` Supabase project**
- Log into Supabase dashboard.
- Inside existing Pro org, click "New project."
- Name: `zugzwang-staging`. Region: same as prod (verify operator memory or Supabase docs for prod region).
- Set strong DB password; store in password manager (NOT in Doppler — it's separately stored, only the resulting `DATABASE_URL` goes to Doppler).
- Wait for project provisioning (~2 min).
- Time: ~5 min.
- Dependency: none.
- Abort: if provisioning errors, retry once; if second failure, contact Supabase support. Do not proceed to O2.

**[OPERATOR] O2 — Copy staging credentials**
- From `zugzwang-staging` project settings, copy: `DATABASE_URL` (pooled), `DATABASE_URL` (direct/unpooled if used), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, project URL.
- Store temporarily in password manager (NOT in any committed file, not in chat).
- Time: ~2 min.
- Dependency: O1.
- Abort: if any value not visible in dashboard, refresh Supabase page; if still missing, regenerate service role key.

**[OPERATOR] O3 — Audit existing Vercel env vars (pre-flight per Risk 2 mitigation)**
- Log into Vercel dashboard → zugzwang project → Settings → Environment Variables.
- Identify every env var NOT marked "Synced from Doppler."
- Document each: name, value (redacted), which Vercel env it's set on (Production/Preview/Development).
- Decide per var: delete (if obsolete), or migrate to Doppler (if load-bearing) before proceeding.
- Time: ~10 min.
- Dependency: none (can run in parallel with O1/O2).
- Abort: if any var is critical and operator unsure whether to delete, pause and surface to CC/chat for guidance.

**[OPERATOR] O3a — Validate Doppler Custom Environment sync availability (per Risk 1 / OQ-1)**
- Open Doppler dashboard → zugzwang project → Integrations → Vercel.
- Click "Add sync" or equivalent.
- In sync-target dropdown: confirm "Custom Environment: staging" appears as an option (it may show as a generic Custom Environment slot before O5 creates the named env in Vercel).
- IF custom environment sync target NOT visible: STOP. Surface to chat. Brief amendment to LD-2 fallback (2-scope) required before proceeding.
- IF visible: cancel the sync creation (don't save yet) and proceed.
- Time: ~5 min.
- Dependency: none.
- Abort: per "STOP" above.

**[OPERATOR] O4 — Create Doppler configs**
- In Doppler zugzwang project, create new config: `staging`.
- Create second new config: `preview`.
- Verify existing `prod` config remains unchanged.
- Populate `staging` config with values per LD-2 env var table:
  - Staging Supabase credentials (from O2 password manager).
  - Generate new `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), paste into staging.
  - `ZUGZWANG_ENV=staging`.
  - `ZUGZWANG_ENV_CANARY=staging-2026-05-27` (date stamp at brief-time; can be regenerated per smoke run).
  - `NEXT_PUBLIC_SITE_URL=https://staging.zugzwangworld.com`.
  - Resend sandbox API key (operator creates new sandbox key on Resend dashboard, or uses existing if known).
  - Turnstile test-mode keys (public test values from Cloudflare Turnstile docs).
  - Sentry DSN placeholder (filled in at O5a).
  - R2 placeholder (filled in at O5b).
  - Upstash REST URL + token: SAME as prod (shared instance per LD-10).
- Populate `preview` config: same as `staging` EXCEPT `ZUGZWANG_ENV=preview`, `ZUGZWANG_ENV_CANARY=preview-2026-05-27`, separate `BETTER_AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL` left unset (Vercel auto-injects per-preview URL).
- Time: ~15 min.
- Dependency: O2 (need staging Supabase creds), O3 (Vercel env vars cleaned).
- Abort: if any required value missing, do NOT use prod value as fallback — surface to chat and resolve before continuing.

**[OPERATOR] O5 — Provision Vercel Custom Environment and wire Doppler syncs**
- In Vercel dashboard → zugzwang project → Settings → Environments → Add Custom Environment.
- Name: `staging`. Type: Custom Environment.
- Configure branch tracking: bind to `staging` git branch (branch doesn't exist yet — created at O8 — Vercel allows binding to a not-yet-existent branch).
- Enable Standard Deployment Protection on `staging` Custom Environment (per LD-3).
- Enable Standard Deployment Protection on `preview` environment (likely already on; verify).
- In Doppler dashboard → Integrations → Vercel:
  - Create sync: `prod` config → Vercel `production`. **Verify Sensitive toggle ON.**
  - Create sync: `staging` config → Vercel `staging` Custom Environment. **Verify Sensitive toggle ON.**
  - Create sync: `preview` config → Vercel `preview` environment. **Verify Sensitive toggle ON.**
- Operator screenshots each sync's Sensitive toggle BEFORE confirming sync (per Risk 3 mitigation).
- Wait ~30 sec for first sync propagation.
- Time: ~15 min.
- Dependency: O3a (Custom Env sync confirmed available), O4 (Doppler configs exist).
- Abort: if Sensitive toggle is off on any sync, delete sync and recreate with Sensitive ON. If Vercel rejects sync due to existing manual env vars (Risk 2 firing despite O3 audit), return to O3 and clean up.

**[OPERATOR] O5a — Create staging Sentry project + populate Doppler**
- Log into Sentry dashboard.
- Create new project in existing org: `zugzwang-staging`. Platform: same as prod project (likely `javascript-nextjs`).
- Copy new DSN.
- Paste DSN into `staging` Doppler config as `SENTRY_DSN` (overwriting placeholder from O4).
- ALSO paste into `preview` Doppler config (preview errors land in staging Sentry per LD-2 env var table).
- Time: ~5 min.
- Dependency: O4 (Doppler `staging` and `preview` configs exist).
- Abort: if Sentry org has hit Developer plan project quota (3 projects), upgrade plan or remove unused project.

**[OPERATOR] O5b — Create staging R2 bucket + bucket-scoped API token**
- Log into Cloudflare dashboard → R2.
- Create new bucket: `zugzwang-staging`. Same region/jurisdiction as prod bucket.
- Navigate to API tokens → Create API token.
- Token name: `zugzwang-staging-rw`.
- Permissions: "Object Read & Write."
- **Specify Bucket: `zugzwang-staging` ONLY.** Do NOT select "All buckets" or leave unscoped.
- Generate token. Copy Access Key ID + Secret Access Key.
- Paste into `staging` Doppler config: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=zugzwang-staging`.
- Same values into `preview` config.
- Time: ~5 min.
- Dependency: O4 (Doppler configs exist).
- Abort: if bucket-scoping option not visible in Cloudflare UI, check current Cloudflare API token creation flow docs; do NOT create unscoped token as workaround.

### Phase 2 — Code changes + DB setup (~2h total)

**[CC] C1 — Create `staging` git branch**
- `git checkout main && git pull && git checkout -b staging && git push -u origin staging`.
- Branch protection NOT enabled (per OQ-10).
- Time: ~2 min.
- Dependency: none.
- Abort: if branch already exists, verify it matches `main` HEAD; do NOT force-push.

**[CC] C2 — Add `ZUGZWANG_ENV` init-time validation**
- Add startup check (Next.js custom server or instrumentation hook): if `process.env.ZUGZWANG_ENV` is missing or not in `["prod", "staging", "preview"]`, throw and refuse to serve.
- Location: plan-mode CC selects best path (likely `instrumentation.ts` or `src/lib/env.ts`).
- Per OQ-5 boundary verdict.
- Time: ~15 min including writing test.
- Dependency: C1 (working on `staging` branch).

**[CC] C3 — Create `getRedisKey()` helper**
- New file: `src/server/redis/keys.ts` (or plan-mode-selected path).
- Implements LD-10 spec: throws on invalid `ZUGZWANG_ENV`, joins parts with `:`.
- Add unit test per §5 Layer 2 Test 1.
- Time: ~20 min.
- Dependency: C2.

**[CC] C4 — Catalog all Redis call sites + refactor to use `getRedisKey()`**
- Per Risk 6 mitigation: grep all Redis usage (`grep -rn "redis\." src/` + `grep -rn "@upstash" src/`).
- Produce catalog as comment in plan (or as a checklist in the PR description).
- Refactor each call site to use `getRedisKey()`.
- For `@upstash/ratelimit` Ratelimit constructors: pass `prefix: getRedisKey("ratelimit")` (or appropriate prefix path).
- Add unit test per §5 Layer 2 Test 2.
- Time: ~30 min (variable on call site count).
- Dependency: C3.

**[CC] C5 — Pin Better Auth to exact version + update `trustedOrigins`**
- Read current `pnpm-lock.yaml` for installed Better Auth version.
- Change `package.json` from caret-range to exact: `"better-auth": "X.Y.Z"`.
- Update Better Auth init (likely `src/lib/auth.ts`) to read `trustedOrigins` from env: `process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")`.
- Confirm `useSecureCookies: true`, no `crossSubDomainCookies`.
- Per LD-11.
- Time: ~15 min.
- Dependency: C2.

**[CC] C6 — Create `/api/health` route (or extend existing)**
- Per OQ-3 boundary verdict: route returns `{ status: "ok", env: process.env.ZUGZWANG_ENV, canary: process.env.ZUGZWANG_ENV_CANARY, db: "ok" }` (db status from a `SELECT 1` ping).
- Hard constraint: route reads ONLY the 2 named env vars, NOT `process.env` enumeration.
- Public route, no auth required.
- Node runtime (per ADR-0003).
- Time: ~15 min.
- Dependency: C2.

**[CC] C7 — Create `scripts/migrate-staging.ts` (guarded migration script)**
- Per OQ-4 boundary verdict: reads `DATABASE_URL_STAGING`, asserts URL contains staging Supabase project ref, prints intended target before applying.
- Refuses to run if env mismatch.
- Wire as `pnpm db:migrate:staging` in `package.json`.
- Time: ~20 min.
- Dependency: C1.

**[CC] C8 — Create `scripts/seed-staging.ts`**
- Same guard pattern as C7.
- Seeds ~200-row identity_pool dev-seed (reuses SCAFFOLD.3's seed logic against `DATABASE_URL_STAGING`).
- Wire as `pnpm db:seed:staging`.
- Time: ~15 min.
- Dependency: C7.

**[CC] C8a — R2 staging-token scope verification script**
- Script that uses staging R2 credentials to attempt `HEAD` request against `zugzwang-prod` bucket.
- Expect 403 (forbidden). If 200 or any non-403, FAIL with explicit "staging token over-scoped" message.
- Per Risk 5 mitigation.
- Wire as part of `pnpm smoke:staging` OR as standalone `pnpm verify:r2-scope` invoked from smoke.
- Time: ~15 min.
- Dependency: O5b (R2 token exists in Doppler).

**[CC] C9 — Create `scripts/smoke-staging.ts`**
- Implements §5 Layer 1 smoke test, 10 items.
- Reads `staging` Doppler config via `doppler run --config staging`.
- Wire as `pnpm smoke:staging`.
- Add 60-second sleep + retry on items 1–3 (DNS/HTTPS/cold-start tolerance per §5 flag 7).
- Time: ~45 min.
- Dependency: C6 (`/api/health` exists), C8a (R2 verification script exists).

### Phase 3 — DB seeding + smoke + close (~1h total)

**[JOINT] J1 — Apply migrations to staging DB**
- CC runs `doppler run --config staging -- pnpm db:migrate:staging`.
- Verifies guard message printed correctly ("Running migrations against staging: <project ref>").
- Verifies all migrations apply without error.
- Time: ~5 min.
- Dependency: O4 (`DATABASE_URL_STAGING` in Doppler), C7 (script exists).
- Abort: if any migration fails on staging that succeeded on prod, halt — schema drift exists; investigate before continuing.

**[JOINT] J2 — Seed staging identity pool**
- CC runs `doppler run --config staging -- pnpm db:seed:staging`.
- Time: ~3 min.
- Dependency: J1.

**[OPERATOR] O6 — DNS record at registrar**
- Log into DNS registrar for `zugzwangworld.com`.
- Add CNAME: `staging` → `cname.vercel-dns.com`.
- Save and wait for propagation (~1–10 min typical; up to 1 hour worst case).
- Time: ~3 min + propagation wait.
- Dependency: O5 (Vercel Custom Environment exists with domain attached).
- Abort: if CNAME conflicts with existing record, document conflict and resolve before proceeding.

**[OPERATOR] O7 — Push `staging` branch to trigger first deploy**
- Operator (or CC if delegated) runs `git push origin staging`.
- Vercel auto-deploys to `staging` Custom Environment.
- Wait for deploy completion (~2–5 min).
- Time: ~5 min including wait.
- Dependency: C1 (branch exists), O5 (Vercel Custom Env exists), O6 (DNS).

**[OPERATOR] O8 — Open throwaway PR for smoke item #6**
- Create trivial branch from main (e.g., `chore/smoke-test-preview-deploy`).
- Make trivial change (e.g., add comment to README).
- Open PR. Vercel auto-deploys to preview environment.
- Copy preview URL.
- Pass preview URL to CC for smoke item #6 invocation.
- Do NOT merge this PR; close it after smoke test passes.
- Time: ~5 min.
- Dependency: O5 (preview env wired to `preview` Doppler config).

**[JOINT] J3 — Run smoke test**
- CC runs `doppler run --config staging -- pnpm smoke:staging`.
- Items 1–5, 7–10 run automatically.
- For item 6: CC passes operator-provided preview URL as env var (e.g., `PREVIEW_URL=<url> pnpm smoke:staging`).
- For item 9 (Sentry): script intentionally triggers a known error via a `/api/_smoke-error` endpoint (plan-mode CC may need to add this endpoint at C6; if so, ensure it's only callable from staging, not prod).
- All 10 items must PASS.
- Time: ~5 min.
- Dependency: O7, O8, J2.
- Abort: any FAIL → consult §5 failure escalation map, fix, re-run.

**[CC] C10 — Commit + open PR + merge**
- Branch: `feat/scaffold-8-staging-env` (plan-mode CC selects).
- Commit message follows AGENTS.md commit convention.
- PR description includes: smoke test pass log, screenshots of Doppler Sensitive toggles (from O5), R2 token scope screenshot (from O5b).
- Request review per LD-7 (security-auditor RECOMMENDED on C3/C4 Redis helper + C9 smoke including Doppler verification — operator decides at plan-mode kickoff).
- Merge after review.
- Time: ~20 min including review wait.
- Dependency: J3.

**[CC] C11 — Close `staging` Custom Env throwaway PR (O8 cleanup)**
- Close PR from O8 without merging.
- Delete the throwaway branch.
- Time: ~2 min.
- Dependency: C10.

**[CC] C12 — Write `docs/logs/SCAFFOLD.8.md` close-out log**
- Per project log convention. Includes:
  - All 12 exit criteria with PASS evidence.
  - Risks fired (or not): noted with reference to §4.
  - Carry-forwards: any HARDEN-phase items surfaced (GitHub Action for migration automation, weekly pg_dump drift check, PostHog environment split, lint rule against raw Redis keys).
  - Bundle 3 split note: SCAFFOLD.8 ships as Bundle 3a; SCAFFOLD.9 owned by Bundle 3b.
  - R2 reclassification note (per §3 Tier 5 flag).
- Time: ~20 min.
- Dependency: C10.

**[CC] C13 — Commit close-out log**
- Commit `docs/logs/SCAFFOLD.8.md` to `main` (or via PR if branch protection requires).
- Push.
- Time: ~3 min.
- Dependency: C12.

### Ordering summary

```
Phase 1 (parallel-where-possible):
  O1 ─┬─ O2 ─┐
  O3 ─┘     ├─ O4 ─┬─ O5 ─┬─ O5a
  O3a ──────┘     │      └─ O5b
                  │
                  (continues to Phase 2)

Phase 2 (mostly serial on CC side):
  C1 → C2 ─┬─ C3 → C4
           ├─ C5
           ├─ C6
           └─ C7 → C8 → C8a → C9

Phase 3 (deploy + verify):
  J1 → J2
  O6 (DNS) — can run in parallel with J1/J2
  O7 → O8 → J3 → C10 → C11 → C12 → C13
```

### Critical-path discipline reminder

Per LD-7, security-auditor subagent recommended on:
- C3 + C4 (Redis helper + refactor)
- C9 (smoke test, includes Doppler verification)

Plan-mode CC tags these PRs (or sub-PRs if C10 splits) for reviewer cascade per CLAUDE.md §11.

### Estimated total time

- Operator wall-clock: ~75 min spread across 3–4 dashboard sessions (~25 min in Phase 1, ~10 min in Phase 3).
- CC wall-clock: ~2.5–3 hours of execute time (single chat session if context budget allows; two chats if it doesn't).
- DNS propagation wait: 1–10 min typical.
- PR review: ~20 min if no subagent flags issues; up to ~60 min if security-auditor surfaces findings.

**Plan-mode CC will refine this estimate based on actual call-site counts at C4 and route inventory at C6. Hold loosely — SCAFFOLD.18 precedent showed brief estimates run optimistic when novel risks lurk.**

---

## §7 Self-Critique

Preemptive holes plan-mode CC should be aware of. Brief-time author (web Claude) flagging what could be wrong despite ratification.

### Holes in research

**Doppler Custom Environment sync availability is undertested.**
The 3-scope LD-2 design rests on a March 2025 Doppler forum post. The formal docs.doppler.com/docs/vercel page does NOT document this feature as of brief-time. There is a non-trivial chance (~20–30% subjective) that the feature is plan-gated, region-gated, or rolled out unevenly. Risk 1 and OQ-1 mitigate detection, but the entire brief's §1 LD-2 structure changes if Custom Env sync is unavailable. Plan-mode CC should treat O3a as a true gate, not a checkbox.

**PostHog environment-split decision deferred without evidence-gathering.**
§0 defers PostHog environment split to Stage 2 because the multi-environments-within-project feature has "uncertain plan-eligibility." This is a soft defer — we don't actually know if PostHog Cloud serves the feature on operator's current plan. Brief authored without operator logging into PostHog to check. If the feature IS available and free, deferring it costs nothing; if it isn't, the deferral is a small ongoing risk (environment-tagged events sharing a single project, with attendant signal-to-noise tradeoff). Plan-mode CC should NOT escalate, but operator should resolve in next maintenance window.

**Vercel Custom Environment + `VERCEL_ENV` injection behavior unverified.**
OQ-5 boundary verdict picks "explicit `ZUGZWANG_ENV` per Doppler config" partly because we don't know what `VERCEL_ENV` returns on a Custom Environment. Vercel docs are silent on this as of brief-time. If `VERCEL_ENV` returns `"preview"` or `"production"` on a Custom Environment instead of `"staging"`, downstream code reading `VERCEL_ENV` (Vercel's auto-injected vars, third-party libs) may misbehave. SCAFFOLD.8 doesn't have code paths that depend on `VERCEL_ENV` (we read `ZUGZWANG_ENV` instead), but third-party libraries (Sentry SDK auto-init, PostHog auto-init) may. Plan-mode CC verifies third-party env-detection at C6 (when configuring Sentry SDK env tag per OQ-12).

### Holes in scope

**SCAFFOLD.8 doesn't ship a way to deploy a hotfix to prod from a non-`main` branch.**
If a critical prod bug appears during the experiment that requires bypassing `staging` for speed, SCAFFOLD.8 doesn't define that escape hatch. Operator would have to merge directly to `main` (already supported, branch-protected via PR review). Not actually a hole — it's just not documented. Plan-mode CC need not address; flagging for completeness.

**Staging cookie name collision under shared apex domain.**
Both prod and staging cookies live under `*.zugzwangworld.com`. Better Auth's host-only default means `zugzwangworld.com` cookies don't go to `staging.zugzwangworld.com` and vice versa — they're separate hosts. But: if a user has logged into BOTH on the same browser, they have two separate cookies, both named (likely) `better-auth.session`. Browsers handle this correctly (host-isolation), but operator confusion is possible ("why am I logged in here but not there?"). Not a bug, but worth noting in close-out for operator awareness.

**Migration rollback on staging failure not specified.**
If `pnpm db:migrate:staging` fails partway through, the staging DB is in a partially-migrated state. SCAFFOLD.8 has no rollback mechanism — the operator has to either fix the migration and re-run, or destroy and re-provision staging. Acceptable because (a) staging data is throwaway, (b) Drizzle migrations are typically idempotent in the additive case. Worth a one-line note in `migrate-staging.ts`'s error path: "Migration failed mid-run. To recover: investigate failed migration, fix forward, re-run. If unrecoverable: drop staging schema and re-run."

**No automated rollback for the Doppler→Vercel sync if it fails partway.**
If O5 fails after creating sync 1 (prod) but before creating sync 2 (staging), the project is in an inconsistent state. Operator-side recovery: delete the partial sync via Doppler UI, retry O5. Not a hole in the brief, but plan-mode CC should add a step-completion checkpoint after each of the three syncs.

### Holes in mitigation

**§4 Risk 4 mitigation (migration drift) is detection-only, not prevention.**
Smoke-test item #10 catches drift the next time `pnpm smoke:staging` runs. But there's no mechanism for the smoke test to run automatically — it's operator-triggered. If operator runs smoke test infrequently (once a week, say), drift can persist undetected for days. The real prevention is the GitHub Action deferred to Stage 2. SCAFFOLD.8's mitigation is "operator runs smoke regularly," which is the same convention-based discipline LD-4 already relied on. Flag: this is the brief's weakest mitigation. Plan-mode CC may want to add a calendar reminder or a step in CC's chat-close ritual.

**§4 Risk 6 mitigation (`getRedisKey` not applied at all sites) relies on grep + reviewer.**
A lint rule would be the proper prevention; we deferred it. The grep-catalog at C4 is one-shot — if a future PR adds a new Redis call site with raw key construction, no automation catches it. Security-auditor subagent in LD-7 helps but isn't run on every PR. Flag: Risk 6 will recur if HARDEN-phase lint rule doesn't land before another Redis-touching PR ships.

**§4 Risk 7 mitigation (prod auth secret accidentally rotated) is wording-only.**
"LD-11 says UNCHANGED" is the entire mitigation. No code-level guard, no automation. If operator misreads and rotates prod secret, no system catches it before the deploy. Risk severity is Critical and likelihood is Unlikely, so this is acceptable — but the asymmetry is worth naming. A future hardening pass could add: a `BETTER_AUTH_SECRET_FINGERPRINT` env var that the deploy checks against a known prod value, refusing to start if mismatched. Out of SCAFFOLD.8 scope.

### Holes in process

**Brief was authored before research-pass.**
§0 and §1 v1 were locked, then re-opened and amended after research-pass. v2 was ratified ("Option A"). This is healthy but indicates I should have run research earlier — ideally as a brief-drafting precursor, not mid-brief. Process learning for SCAFFOLD.9 + later briefs: when a substantive technical decision exists at brief-time (e.g., staging substrate, vendor isolation strategy), research-pass BEFORE drafting §1, not after. Saves one round of re-ratification.

**No pre-flight check that the experimental repo state matches my assumptions.**
Brief assumes: Vitest as test framework, App Router with `src/app/api/` route convention, Drizzle migrations in `drizzle/migrations/`, Sentry SDK reads `SENTRY_DSN` from env, PostHog SDK reads `POSTHOG_KEY` from env, `package.json` has `pnpm` scripts. All highly likely to be true but unverified by me. Plan-mode CC's first action should be a sanity pass against current `src/` structure + `package.json` + relevant ADRs. If any assumption is wrong, plan-mode CC surfaces and reconciles.

**Brief estimates assume Claude Code as primary implementation agent at "claude-opus-4-7" + max effort + ultrathink.**
Per CLAUDE.md and operator-established working pattern. If a different model or effort level is used, time estimates and step granularity may be wrong.

### Holes I might be unaware of

The single largest risk to brief quality is "things I don't know I don't know." Plan-mode CC's first ~10 minutes should be a critical read of the brief looking specifically for:
- Steps that assume a tool, file, or convention exists which doesn't.
- Risks not in §4 that the codebase or ADRs surface.
- Ordering dependencies I missed (e.g., a CC step depending on an operator step that's not yet been done).
- Env vars referenced but not in LD-2's table.

If plan-mode CC finds any such hole, surface as a §2-equivalent open question in the plan-mode close-out and resolve in execute prep.

### Confidence assessment

| Section | Confidence |
|---|---|
| §0 Scope + Exit Criteria | High — exit criteria are testable, scope boundaries are explicit. |
| §1 LD-1 Supabase 2nd project | High — research-ratified, cost-known. |
| §1 LD-2 Doppler 3-scope | Medium — depends on OQ-1 outcome. Fallback covered. |
| §1 LD-3 DNS + Custom Env | Medium — depends on LD-2. |
| §1 LD-4 Migration parity | High — straightforward, well-precedented. |
| §1 LD-5 Smoke test | High — 10 items are concrete and testable. |
| §1 LD-6 Work split | High — clear ownership. |
| §1 LD-7 Critical-path classification | High — aligned with CLAUDE.md. |
| §1 LD-8 Bundle 3 split | High — operator-ratified. |
| §1 LD-9 Sentry split | High — research-backed, low-cost. |
| §1 LD-10 Redis prefix | Medium — depends on call-site count, lint rule deferral. |
| §1 LD-11 Better Auth hardening | High — defensive, low-risk. |
| §2 Open Questions | Medium-High — 12 OQs cover surfaces I identified; unknown OQs may exist. |
| §3 Input contract | High — ADR references are mechanical. |
| §4 Risk register | Medium — 8 risks named; unknown risks may exist (see §7 final subsection). |
| §5 Test plan | High — small surface, well-defined. |
| §6 Step sequence | Medium — depends on accuracy of operator-side dashboard flows (Doppler, Vercel, Cloudflare, Sentry, Supabase). Three of those flows have changed in the last 12 months. |
| §7 Self-critique | (this section) |

---

## §8 Brief Provenance

What was consumed at brief-time, what was ratified, what remains contingent.

### Authorship

**Brief author:** web Claude (claude-opus-4-7), 2026-05-27.
**Co-author / operator:** Hrishikesh.
**Workflow:** brief-drafting (web-solo) chat. One section per reply pattern. All §0–§7 sections ratified across multiple turns with explicit operator confirmation per section.
**Workflow precedent:** SCAFFOLD.17 + SCAFFOLD.18 brief-drafting close-outs.

### Inputs consumed

**Tier 1 — Predecessor close-outs (read in full):**
- `chat_close_2026-05-26_SCAFFOLD-finish-bundle-2.md` — Bundle 2 execute close-out.
- `chat_close_2026-05-27_SCAFFOLD_18_plan_mode_review.md` — SCAFFOLD.18 plan-mode review close-out.
- `chat_close_2026-05-27_SCAFFOLD_18_execute_review.md` — SCAFFOLD.18 execute review close-out.

**Tier 2 — Living docs (consulted for substance, not re-read in full):**
- `SCAFFOLD-finish-mini-plan.md` §Bundle 3 — task definitions, exit criteria, time estimate.
- `zugzwang_experiment_tracker_v10.html` — task IDs SCAFFOLD.8 + SCAFFOLD.9 + their tracker descriptions.
- `CLAUDE.md` — §1 critical-path classification, §5 PR self-audit discipline, §11 subagent invocation.
- `AGENTS.md` — referenced for commit conventions and Drizzle/Vitest patterns.

**Tier 3 — ADRs (consulted at brief-time, references locked in §3):**
- ADR-0003 (Next.js 16 App Router), ADR-0004 (Better Auth), ADR-0005 (Postgres event sourcing), ADR-0006 (Hosting), ADR-0007 (Observability), ADR-0008 (Drizzle ORM), ADR-0010 (Admin auth wiring), ADR-0011 (Pseudonym pool), ADR-0013 (Concurrency bet transaction), ADR-0014 (Pre-commit moderation), ADR-0015 (Rate-limit + idempotency), ADR-0016 (ID schema UUIDv7).

**Tier 4 — Research-pass (launched mid-brief, after §0/§1 v1 lock, before §0/§1 v2 ratification):**
- Research task launched 2026-05-27 with 12 research questions covering all locked decisions + deferred risks.
- Output: comprehensive RATIFY/AMEND/SURFACE-RISK report.
- Sources cited: Vercel docs, Doppler docs + community forums, Supabase billing FAQ + branching docs, Better Auth security docs, Sentry help center, PostHog docs + LinkedIn announcement, Cloudflare R2 community threads, Upstash ratelimit library, Drizzle ORM docs + Storyie case study, Trend Micro analysis of April 2026 Vercel OAuth incident, Neon staging-database article, SchemaSmith drift guide.
- Key amendments triggered: LD-2 (2-scope → 3-scope), LD-3 (Preview env → Custom Environment), LD-5 (9 items → 10 items), new LD-9 (Sentry split), new LD-10 (Redis prefix), new LD-11 (Better Auth hardening), R2 un-deferred from out-of-scope.

### Ratifications

**Pre-brief decisions (resolved during initial scope-framing, before §0 drafting):**
1. Bundle 3 split into 3a (SCAFFOLD.8) and 3b (SCAFFOLD.9) — operator decision 2026-05-27.
2. Staging DB substrate — separate Supabase project in existing Pro org (Path A: +$10/mo always-on compute).
3. Doppler scope structure — initially 2-scope (`prod` + `staging`); amended post-research to 3-scope.
4. Smoke test tier cutoff — Tier 1 + Tier 2 items (1–9 initially; amended to 10 post-research).
5. Operator vs CC work split — 8 operator + 8 CC + 3 joint (expanded to 8 operator + 13 CC + 3 joint post-research).

**Section ratifications (in order):**
- §0 v1 ratified 2026-05-27.
- §1 v1 ratified 2026-05-27 (8 LDs).
- Research-pass launched and completed 2026-05-27.
- §0 v2 + §1 v2 ratified 2026-05-27 (11 LDs).
- §2 ratified 2026-05-27 (12 OQs with boundary verdicts).
- §3 ratified 2026-05-27.
- §4 ratified 2026-05-27 (8 risks).
- §5 ratified 2026-05-27.
- §6 ratified 2026-05-27.
- §7 + §8 ratified 2026-05-27 (this delivery).

### Decisions deferred from this brief (not ratified, owned by future chats)

- **SCAFFOLD.9 load-model authoring + brief.** Owned by Bundle 3b chats.
- **PostHog environment split.** Stage 2 maintenance window.
- **GitHub Action for staging migration automation.** HARDEN-phase or Stage 2.
- **Weekly `pg_dump --schema-only | diff` drift detection.** HARDEN-phase.
- **Lint rule preventing raw Redis key construction.** HARDEN-phase.
- **`BETTER_AUTH_SECRET_FINGERPRINT` env-var fingerprint check.** HARDEN-phase (per §7 Risk 7 hole flag).
- **AGENTS.md / CLAUDE.md updates documenting staging env conventions.** Single-pass after all ADRs complete (existing ratified discipline).
- **v11 tracker sweep.** Post-Bundle-3b chat.
- **R2 reclassification note from SCAFFOLD.18 close-out CF-3.** Recorded in §3 Tier 5; carries to SCAFFOLD.8 close-out at C12.

### Carry-forwards from predecessor chats absorbed into this brief

- **From SCAFFOLD.18 execute close-out (CFs):**
  - CF-3 (R2 sharing risk reclassified) — absorbed into LD-2 + §0 in-scope work + Risk 5.
  - Other 7 HARDEN-phase items + 2 AGENTS.md doc deferrals — NOT absorbed (out of SCAFFOLD.8 scope, remain HARDEN candidates).
- **From SCAFFOLD.18 process learnings:**
  - `rm -f /tmp/<file>` hygiene — applies to plan-mode CC if any tmpfile shell-buffer-bypass is used at execute time. Not absorbed into brief (operational, not architectural).
  - Web Claude paste-back discipline — not applicable to brief-drafting; applies to next chat (plan-mode review).
  - Vitest skip semantics — applies to unit test authoring at C3/C4; plan-mode CC respects.
  - Plan-mode mixed-concern-migration audit — applies to J1 at execute time; not a brief-time concern.
  - Brief-time scope estimates run optimistic when novel risks lurk — informed §6's "hold loosely" caveats.

### Contingencies (brief amendment triggers)

If any of the following fires during execute, brief amendment is required BEFORE proceeding:

1. **OQ-1 / Risk 1 fires:** Doppler Custom Env sync unavailable. LD-2 reverts to 2-scope. §0 + §1 LD-2/LD-3 amended inline.
2. **ADR ratified between brief-time and execute-time that touches staging, env-var handling, or vendor isolation.** Per §3 Tier 1 provenance note.
3. **Plan-mode CC discovers an unstated assumption in the brief is false** (e.g., Vitest is not the test framework, Drizzle migrations are in a non-standard path). Brief amended; corresponding OQ added to §2.

### Brief delivery artifact

- File: `docs/plans/SCAFFOLD.8-staging.md`.
- Delivered via `/mnt/user-data/outputs/` per file-delivery convention.
- Source of truth: this delivery. PDF render NOT generated (per project knowledge convention: `.md` source is single source of truth).

### Next chat: plan-mode CC review

**Chat type:** plan-mode review (web Claude + Claude Code pair).
**Owner:** Hrishikesh + web Claude (review) + CC (plan author).
**Kickoff prompt:** authored at close-out ritual step 4 of THIS chat. Will reference this brief by full path.
**Expected duration:** ~45–60 min (CC drafts plan in `/plan` mode, web Claude reviews, operator ratifies).
**Exit criterion:** `docs/plans/SCAFFOLD.8-staging.md` plan committed to repo, CC ready to proceed to execute.

### Provenance signature

Brief authored, sections ratified one-per-reply, research-pass mid-stream, §0/§1 amended once, all 8 sections delivered. No silent decisions. All OQ boundary verdicts have escape hatches. All risks have detection mechanisms. No reproductions from external sources beyond authorized citations.

**Brief locked at delivery 2026-05-27.**
