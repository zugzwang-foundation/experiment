# Staging Provisioning Runbook — bring staging to full working parity

> **Prepared:** 2026-06-20, overnight, unattended (Claude Code prep run).
> **Audience:** operator (Hrishikesh) + web Claude at the morning gate.
> **Goal:** a clean participant flow on `https://staging.zugzwangworld.com` — sign in (Google **and** email-OTP), place an image bet, see blocked rows in `/admin/moderation/audit` — in ~20 minutes.
>
> **Nothing in this file has been executed.** No prod was touched, no PR merged, no infra mutated overnight. Every code change is in a reviewed (draft) PR; every infra/DNS/dashboard step below is for the operator to run.
>
> **Prepared PRs (both draft, do not merge — gate first):**
> - **PR #147** — `fix/auth-otp-gate-context` — email-OTP send fix (item #1). https://github.com/zugzwang-foundation/experiment/pull/147
> - **PR #148** — `feat/migrate-on-deploy-drift-guard` — prod migrate path + drift guard + this runbook (items #2/#4). https://github.com/zugzwang-foundation/experiment/pull/148
>
> **Legend:** 🧑 = HUMAN-ONLY (dashboard / DNS / billing) · ⌨️ = command-run · ✅ = verification.

---

## ⚠️ URGENT — do this first (time-boxed by an external deadline)

🧑 **Google Cloud free trial expires 2026-06-21 (tomorrow).** When it lapses, the Google OAuth client stops issuing tokens and **Google sign-in breaks on every environment** (prod + staging). Enable billing on the Google Cloud project behind the OAuth client (`GOOGLE_CLIENT_ID`) **today**. This is independent of all staging work below — do it even if you do nothing else.

---

## What was wrong, and the fix for each (summary)

| # | Gap | Root cause | Remedy | Type |
|---|---|---|---|---|
| 1 | Email-OTP send returns `200 {}`, no code ever sent | OTP gate before-hook returned bare `{}` → Better Auth short-circuits, real send endpoint never runs | Merge **PR #147** (`fix/auth-otp-gate-context`) | ⌨️ merge |
| 2 | Google/email signup fails `unable_to_create_user` | staging `identity_pool` is unseeded → `consumeIdentityPoolTuple` returns null → user-create hook throws | Seed staging pool (step 3) | ⌨️ |
| 3 | Email OTP won't deliver to real inboxes | `RESEND_FROM_EMAIL` is the `resend.dev` sandbox (only delivers to `zugzwangworld@proton.me`) | Verify a sending domain (DNS) + set Doppler `stg` (step 4) | 🧑 + ⌨️ |
| 4 | Google OAuth at risk | free trial expiry + new callback URL propagation | Billing (above) + confirm callback (step 2) | 🧑 |
| 5 | Prod was 11 migrations behind, silently | `vercel.json` runs `next build` only; no prod migrate path; `drizzle-kit migrate` 55P04s on the batch | Merge the **migrate/drift PR #148** (`feat/migrate-on-deploy-drift-guard`); use `db:migrate:prod` + `db:check-drift` going forward | ⌨️ merge |

Dependencies: **email-OTP signup needs BOTH #1 (send fix) AND step 3 (pool seed).** Google signup needs **step 3 (pool seed) + step 2 (billing/callback)** only.

---

## 0. Pre-flight (⌨️, ~2 min)

```bash
# Confirm Doppler configs are stg / prd (NOT staging/production — CLAUDE.md §5.13).
doppler configs                     # expect: prd, stg

# Confirm staging is at the migration head (the kickoff states migrate is done).
# Uses the NEW drift tool from the migrate/drift PR; resolves DATABASE_URL_STAGING.
doppler run --config stg -- pnpm db:check-drift     # expect: IN SYNC ✓ (17 entries, head 0016_mod_actions_reason)
```
> Note: the staging scripts' own comments say `--config staging` — that string is **stale**. The Doppler config is `stg` (confirmed). Use `stg`.
> If `db:check-drift` isn't available yet (PR not merged), use `doppler run --config stg -- pnpm smoke:staging` item 7 instead, or merge the migrate/drift PR first.

---

## 1. Merge the two PRs (⌨️, gate-approved)

Both are draft/unmerged, prepared overnight, awaiting this gate. Merge order:

1. **PR #147** — `fix(auth): email-OTP send no longer short-circuited by Turnstile before-hook (AUTH-OTP-GATE)`. Critical-path auth; full ritual ran (RED-first test, `@code-reviewer`, `@security-auditor`, self-audit, `just verify`, full suite). Mark ready → squash-merge.
2. **PR #148** — `feat(ops): prod migrate path (per-migration-tx) + schema-drift guard + staging runbook` (`feat/migrate-on-deploy-drift-guard`, ADR-0022). `@code-reviewer` clean; ops tooling + read-only health field. Squash-merge.

Independent of each other; #147 first only because it's the user-facing unblock.

---

## 2. Google OAuth (🧑 + ✅)

1. 🧑 **Billing** — enable billing on the Google Cloud project (see URGENT banner). Without it, OAuth dies 2026-06-21.
2. ✅ **Callback propagation** — you already added `https://staging.zugzwangworld.com/api/auth/callback/google` to the OAuth client's Authorized redirect URIs. Google changes usually propagate in minutes (can take longer). Confirm by attempting a Google sign-in (step 6) and watching for `redirect_uri_mismatch` — if you see it, wait and retry; the URI string must match byte-for-byte.

---

## 3. Seed the staging identity pool (⌨️, fixes `unable_to_create_user`)

The staging seed already exists — 200 deterministic `(colour, animal, number, pfp_filename)` tuples, idempotent (`ON CONFLICT DO NOTHING`), behind the `DATABASE_URL_STAGING` + `STAGING_PROJECT_REF_FRAGMENT` guard. **It does not require R2** (it inserts filename strings only).

```bash
doppler run --config stg -- pnpm db:seed:staging
# expect: "Done — 200 new rows, 0 already present" (re-runs: "0 new, 200 already present")
```

✅ Confirm (read-only):
```bash
doppler run --config stg -- pnpm smoke:staging   # item 8: "identity_pool seeded (~200 rows)"
```
> The pre-flight assumption (pool empty) is the conclusive code-based diagnosis of the `unable_to_create_user` symptom: the only way `databaseHooks.user.create.before` fails that way is `consumeIdentityPoolTuple` returning null on an empty pool. (Not live-verified overnight by design — no staging DB connection was made.)

### R2 PFP assets — NOT a signup blocker (note, not a step)

Signup succeeds with the seed alone. The 200 tuples reference filenames like `red-fox-000.webp`; until those webp files exist in the staging R2 **pfp** bucket (`R2_BUCKET_PFP=zugzwang-pfp`, key shape `v1/<pfp_filename>`), the UI falls back to `public/pfp-placeholder.svg`. **Do not generate assets to "unblock"** — PFP image display is a separate, non-blocking enhancement. (Prod uses the 50K-row `seed:identity-pool:prod <manifest>` + the 50K R2 set; staging's 200-tuple set is enough for the flow.)

---

## 4. Resend sending domain (🧑 DNS + ⌨️ Doppler) — for email-OTP delivery to real inboxes

Until this is done, email-OTP codes only reach `zugzwangworld@proton.me` (the `resend.dev` sandbox). Google sign-in does **not** depend on this.

### 4a. 🧑 Add + verify a sending domain in the Resend dashboard

Resend → **Domains → Add Domain** → enter the sending domain (recommend a subdomain, e.g. `send.staging.zugzwangworld.com`, so apex deliverability stays isolated). Resend then **displays the exact records to add** — the values (especially the DKIM public key and the SES region in the MX host) are **generated per-domain by Resend and cannot be pre-written here**. The record *shapes* are:

| Type | Name (host) | Value | Notes |
|---|---|---|---|
| MX | `send` (the sending subdomain) | `feedback-smtp.<region>.amazonses.com` (priority 10) | `<region>` is shown in the dashboard (e.g. `us-east-1`) |
| TXT (SPF) | `send` | `v=spf1 include:amazonses.com ~all` | |
| TXT (DKIM) | `resend._domainkey` (under the sending subdomain) | `p=<long-public-key>` | **value is dashboard-provided per-domain** |
| TXT (DMARC, recommended) | `_dmarc` | `v=DMARC1; p=none;` | optional but advised |

Add these at the DNS provider for `zugzwangworld.com` (🧑), then click **Verify** in Resend. Use the dashboard's exact records over this table if they differ — Resend is the source of truth.

### 4b. ⌨️ Point staging at the verified sender

```bash
doppler secrets set RESEND_FROM_EMAIL="Zugzwang <noreply@send.staging.zugzwangworld.com>" --config stg
# (match the verified domain from 4a)
```
Then redeploy staging (step 5) so the running deployment picks up the new value.

---

## 5. Deploy staging (⌨️ / 🧑)

After any Doppler `stg` change (step 4b), redeploy staging so the new env reaches the running deployment (the Doppler→Vercel sync updates env entries, but a redeploy is required to apply them — treat auto-redeploy as not firing).

```bash
# via the staging deploy mechanism in use (Vercel dashboard "Redeploy" on the staging deployment,
# or `vercel --prod`-equivalent for the staging project/alias).
```
> ⚠️ `BETTER_AUTH_URL` is validated at **build time** — it must be `https://staging.zugzwangworld.com` in Doppler `stg` **before** the build, or the build fails. Likewise `BETTER_AUTH_TRUSTED_ORIGINS` should include `https://staging.zugzwangworld.com`, and `ZUGZWANG_ENV=staging`. (See the env checklist in the appendix.)

---

## 6. Verification — the clean participant flow (✅)

Run after steps 1–5. Each must pass:

1. ✅ **Health** — `curl -s https://staging.zugzwangworld.com/api/health` → `db: "ok"`, `env: "staging"`, **`migrations: "ok"`** (the new drift field; "drift" here means code is ahead of schema — run migrations / redeploy).
2. ✅ **Google sign-in** — complete the Google OAuth flow → lands in onboarding (no `unable_to_create_user`, no `redirect_uri_mismatch`). Proves step 2 + step 3.
3. ✅ **Email-OTP sign-in** — request a code; a 6-digit code actually arrives (to a verified-domain inbox after step 4, or to `zugzwangworld@proton.me` if still on sandbox) and verifies. Proves PR #147 + step 3 + step 4.
4. ✅ **Image bet** — as a participant, place a bet with an image + comment on an Open market (admin creates one at `/admin/markets/new` if none exists). Requires staging `OPENAI_API_KEY` (moderation), R2 uploads bucket + creds, and Turnstile keys to be set (appendix).
5. ✅ **Moderation audit** — a bet whose comment/image trips moderation appears as a blocked row at `/admin/moderation/audit`.
6. ✅ (optional) full smoke — `doppler run --config stg -- pnpm smoke:staging` (DNS, health, env, migration parity, pool ~200, Sentry routing, R2 token scope).

---

## Appendix

### A. Staging env checklist (Doppler `stg` → synced to Vercel)

Needed for the full flow (verify presence with `pnpm vercel-env-audit` / `pnpm smoke:staging` — values are write-only post-set, confirm functionally):

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://staging.zugzwangworld.com` (**build-time**), `BETTER_AUTH_TRUSTED_ORIGINS` (include the staging origin)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (OTP gate fails **closed** without the secret — email-OTP send would 400)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (step 4)
- `DATABASE_URL_STAGING`, `STAGING_PROJECT_REF_FRAGMENT` (used by the seed/migrate guards)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate-limit + idempotency)
- `OPENAI_API_KEY` (moderation — needed for the bet flow)
- `R2_*` credentials + `R2_BUCKET_UPLOADS=zugzwang-uploads`, `R2_BUCKET_PFP=zugzwang-pfp`
- `ZUGZWANG_ENV=staging`, `ZUGZWANG_ENV_CANARY=staging-...`

### B. New migration tooling (from the migrate/drift PR)

- `pnpm db:migrate:prod` (`scripts/migrate-prod.ts`) — applies each migration in its **own transaction** (sidesteps the 0009→0013 enum-add→use 55P04 that `drizzle-kit migrate`'s single-tx batch hits). Guarded by `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT`. **Prod release step:** after a prod promote, `doppler run --config prd -- pnpm db:migrate:prod` then `doppler run --config prd -- pnpm db:check-drift` (assert IN SYNC) before serving traffic. Per-migration-tx relies on Postgres 12+ (`ALTER TYPE ADD VALUE` in a tx); Supabase is PG17. Confirm prod has pg_cron available (0007/0011 run verbatim — prod isn't stripped like CI).
- `pnpm db:check-drift` (`scripts/check-migration-drift.ts`) — read-only journal-head vs DB-head assertion; resolves `DATABASE_URL_PROD`/`DATABASE_URL_STAGING`/`DATABASE_URL`. Exit 0 in sync / 1 on drift. Use as the post-promote gate and a CI step.
- `/api/health` now returns `migrations: "ok" | "drift" | "error"` — wire it to an uptime monitor to catch "code ahead of schema" before it 500s.
- **Before pointing `db:migrate:prod` at prod**, dry-run it against a throwaway Supabase project (or a prod snapshot restore) with the full 0000→0016 apply — the multi-pending apply path is sound by inspection (and unit-verified bookkeeping) but has no automated end-to-end test; the dry-run is the substitute. (See ADR-0022 + the migrate/drift PR's `@code-reviewer` notes.)

### C. Forward item surfaced overnight (NOT a blocker; for a separate task)

**`x-forwarded-for` is trusted verbatim, first element** (`ipFromCtx` in `src/server/auth/index.ts` and the same pattern across `bets/endpoint.ts`, `uploads/sign/route.ts`, `auth/admin/login.ts`, `admin/wire.ts`, `auth/tos-accept.ts`). If requests can reach the app bypassing the Vercel edge (which normalizes XFF), the per-IP rate-limit is defeatable by header rotation. Mitigation today = the platform-set XFF; the per-email OTP cap (5/hr, not IP-rotatable) is the non-rotatable flood bound. Re-confirm when flipping `RESEND_FROM_EMAIL` off the sandbox (step 4). Owner: a dedicated XFF/rate-limit hardening task — surfaced by the `@security-auditor` on PR #147, explicitly out of that PR's scope.

### D. Scripts whose comments say `--config staging` (stale)

`scripts/migrate-staging.ts`, `scripts/seed-staging.ts`, `scripts/smoke-staging.ts` all say `doppler run --config staging` in their headers. The Doppler config is **`stg`** (confirmed; CLAUDE.md §5.13). Use `stg`. Fixing those comments is a separate trivial chore (not done overnight — out of the prepared PRs' scope).
