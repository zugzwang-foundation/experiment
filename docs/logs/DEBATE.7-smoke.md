# Close-out — DEBATE.7 / UI.6-A live moderation smoke on staging

**Date:** 2026-06-21
**Chat objective (headline):** Fix returning/onboarded-user login on staging — **ACHIEVED & VERIFIED**.
**Bonus objective:** Run the DEBATE.7 reactive-moderation smoke (benign → violence → NSFW) end-to-end on a live deploy — **PASS**.
**Governing model:** ADR-0021 (reactive moderation, no held queue) + ADR-0014 (gate architecture; §18 P1 A2 backstop). Runbook: `docs/runbooks/DEBATE.7-moderation-smoke.md`.
**Deployed build under test:** `3f82371` (PR #150) on staging — downstream of the DEBATE.7 canonical SHA `02f87ac` (PR #143) on `main`.
**Verification surface:** UI.6 slice A — the read-only admin moderation audit viewer at `/admin/moderation/audit`. (The runbook predates this viewer and assumed raw-DB verification; the viewer superseded that and made verification direct. See "Verification method" and the residual-check note below.)

---

## 1. Headline result

The full moderation matrix is demonstrated against live infrastructure:

| Case | Image | HTTP | Verdict | Account effect | Audit row | Image |
|---|---|---|---|---|---|---|
| **Permit** (Track C) | benign.jpeg | `200` `ok:true` | — | active, ~10 Đ spent | **none** (correct) | committed |
| **Block, no ban** (Track B) | violence.jpg | `400` `comment_track_b_blocked` | `track_b` | **active** at event time | **1 row** written | withheld |
| **Block + auto-ban** (Track A) | nsfw.jpg (legal adult) | `400` `comment_track_a_blocked` | `track_a` | **BANNED** | **1 row** written | withheld |

Every core mechanic fired: bet engine, CPMM price movement, mandatory comment, append-only ledger, the OpenAI multimodal moderation gate (both permit and block), classifier→track mapping (A2), auto-ban, the audit trail with model evidence, and harmful-image withholding. **DEBATE.7 / UI.6-A confirmed live.**

---

## 2. Part 1 — the auth fix that unblocked the session (PR #150)

Returning/onboarded-user Google sign-in was 500-ing on staging — the headline blocker.

**Root cause.** `session.expiresIn` was set to `ONE_HUNDRED_YEARS_SEC` and passed through to the session cookie's `maxAge`. better-call's cookie serializer **throws** when `maxAge` exceeds its hard ceiling of `34,560,000s` (400 days). The throw happened at *serialization* time (cookie write on an already-onboarded session), not at token creation — which is why fresh signups worked but returning users 500'd. The exact belief that produced the bug — "indefinite / silently re-issued session" — was the wrong mental model, and was corrected in the ADR.

**Fix.** Cap the session lifetime at the ceiling:
`SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 400 = 34,560,000` (== the cap; the serializer guard is a strict `>`). `disableSessionRefresh: true` retained.

**PR #150** — squash-merged to `main` as commit `3f82371`.

| File | Change |
|---|---|
| `src/server/auth/index.ts` | `ONE_HUNDRED_YEARS_SEC` → `SESSION_MAX_AGE_SEC` constant (lines 56, 216 on merged `3f82371`; the close-out's original "48, 208" was stale — corrected in Phase 2) |
| `docs/specs/SPEC.2.md` §8.2 | Reconciliation to the 400-day reality |
| `docs/adr/0004-better-auth.md` | Patch record **P1** (code-reviewer HIGH) — corrects the "indefinite/silently re-issued" rationale that caused the crash |
| `src/db/schema/auth.ts` | Comment |
| `tests/integration/onboarded-login-session.integration.test.ts` | New e2e RED→GREEN reproduction |

**Gate:** `@security-auditor` clean across all severities; INV-1..4 untouched; admin auth path separate; the change strictly *tightens* session lifetime. **967 vitest pass.** 24h soak waived (operator merge).

**Verified on staging:** fresh Incognito → returning Google sign-in as RedOtter002 → no 500, lands onboarded; `/api/auth/get-session` returns `expiresAt: 2027-07-25` (≈ 400 days out — confirms the cap is live).

---

## 3. Part 2 — staging provisioning staircase (each a distinct, deeper blocker)

Standing the smoke up surfaced a chain of staging-environment gaps. **This chain is the motivation for MAINT.20** (full staging-as-prod-replica). Resolved in order:

1. **Stale staging** — staging was serving an old SHA (`52ed64d`). Redeployed `3f82371` into the staging environment via Vercel. (Note: `/api/health` `canary` is a *static* marker `staging-2026-05-28` and does **not** track SHA — freshness was confirmed via the Vercel deployment SHA / build footer instead. Folded into MAINT.20.)
2. **Re-auth gate** — passed (see Part 1).
3. **Session-cookie capture** — captured `__Secure-zugzwang_session` (HttpOnly; read off the Network request, URL-encoded, trailing `%3D`). One-character transcription slip on first attempt → fixed by copying the value from the browser "Copy as cURL".
4. **macOS zsh paste/globbing** — multi-line pastes dropped commands; unquoted `*`/`#` glob-expanded. Worked around by running commands one line at a time and quoting patterns. (Later replaced by single-`&&`-chain commands to dodge the 60-second presign expiry — see §4.)
5. **R2 uploads env gap (the big one).** `/api/uploads/sign` 500'd: `R2 uploads env not configured: set R2_ENDPOINT_UPLOADS, R2_ACCESS_KEY_ID_UPLOADS, R2_SECRET_ACCESS_KEY_UPLOADS, R2_BUCKET_UPLOADS`. CC recon confirmed `resolveBucketEnv("uploads")` reads those four standalone vars; the bucket name is passed as the S3 `Bucket` field (virtual-hosted, `forcePathStyle:false`); the endpoint is account-level `https://<account_id>.r2.cloudflarestorage.com` (the `.env.example` mislabels it "bucket-scoped"). **Decision: Option A — point staging at the prod R2 uploads bucket** (temporary, for the smoke). Set in staging Doppler/Vercel: three cred values copied from prod + literal `R2_BUCKET_UPLOADS=zugzwang-uploads`. Redeployed → `/api/uploads/sign` returns `200` with a real presigned URL. **→ MAINT.17 (back this out; provision a dedicated staging bucket).**
6. **OpenAI moderation 429.** `/api/bets/place` returned `503 error_moderation_unavailable`; logs showed `api.openai.com/v1/moderations` → `429` → timeout, and the gate fails **closed** (ADR-0014) → 503. **Research (web-verified):** the moderation endpoint is free at all tiers and does not count toward usage limits; the `429` was the **Tier-0 (no-payment-method) free-account rate floor (~3 RPM)**, tripped by rapid test calls — *not* a quota/billing block. **Decision: add a payment method.** Done → OpenAI org `zuzgwang-world` / project `proj_KQrdSZXnKHJWz62WGWsCFX3b` is now **Usage Tier 1** ($5 pay-as-you-go credit balance; gpt-5.5 shows 500 RPM / 500k TPM; moderation still free). Direct key re-test → `200`. **→ MAINT.18 (verify prod project's moderation RPM before launch; auto-recharge consideration).**

---

## 4. Part 3 — the smoke, with evidence

**Market:** `smoke-test-1`, id `019ee10e-16a4-775d-90df-725f83df45f2` (Open; YES/NO reserves 1000/1000).
**Participant:** RedOtter002 (throwaway; auto-banned by Case 3, as designed).
**Command shape:** single `&&` chain per image (sign → R2 PUT → place bet) to stay inside the **60-second presign expiry** (`X-Amz-Expires=60`) — a gap between sign and upload would 403 the PUT. Fresh `Idempotency-Key` (`uuidgen`) per bet. Field is `imageUploadsId` (camelCase) carrying the `uploadId` from `/sign`; `stake` is the numeric string `"10"` (== the post floor; floor check runs before moderation).

### Case 1 — Benign → permitted (Track C)
- `UPLOAD_ID=019eeab9-01d5-729c-acec-cafb574bd846`, `PUT status: 200`
- Bet: `HTTP 200`
  ```json
  {"ok":true,"data":{"betId":"019eeab9-323c-786c-ad0d-93fcf7255a23",
   "commentId":"019eeab9-30c4-7a45-bd06-7d89e7cce9ba","side":"YES",
   "sharesBought":"19.900990099009900990","newPrice":"0.504975001237562497",
   "parentCommentId":null}}
  ```
- **Proves:** bet committed; CPMM moved price 0.5 → ~0.505; ~19.9 YES shares from 10 Đ (correct slippage); mandatory comment attached (`commentId`, top-level `parentCommentId:null`); moderation **ran and passed**. Audit viewer: **no row** (correct — permits are not logged).

### Case 2 — Graphic violence → Track B block, no ban
- `UPLOAD_ID=019eeabd-5f0e-727e-9803-ef6440a13134`, `PUT status: 200` (upload succeeds — moderation runs at *bet* time, not upload time; the image becomes an orphan reclaimed by the r2-orphan-sweep)
- Bet: `HTTP 400` — `{"ok":false,"error":{"code":"comment_track_b_blocked","message":"comment blocked by moderation (track B); revise and resubmit"}}`
- **Audit viewer row** (logged `2026-06-21 15:12:27.083Z`, matching the `400`):
  - `Track B · blocked`, `verdict: track_b`, **actor: `system`**
  - market `smoke-test-1`, author **RedOtter002 · active** (at event time)
  - top OpenAI category **`violence 0.514`** (also self-harm 0.096, illicit 0.017, self-harm/intent 0.009, violence/graphic 0.002, harassment/threatening 0.001)
  - **image withheld** ("blocked content is never rendered"); `smoke test comment` preserved under "Rejected content · admin-only"
- **Proves:** content blocked, **account not penalised** (Track B contract), no `betId`/no price move/no Dharma spent, block recorded with model evidence, harmful image not re-rendered.

### Case 3 — Legal adult NSFW → Track A block + auto-ban
- `UPLOAD_ID=019eeac2-26e9-7609-85f8-fdad0c65087f`, `PUT status: 200`
- Bet: `HTTP 400` — `{"ok":false,"error":{"code":"comment_track_a_blocked","message":"comment blocked by moderation (track A)"}}`
- **Audit viewer row** (logged `2026-06-21 15:17:40.820Z`):
  - `Track A · auto-ban`, `verdict: track_a`, **actor: `system`**
  - market `smoke-test-1`, author **RedOtter002 · BANNED 2026-06-21**
  - top OpenAI category **`sexual 0.969`** (also violence 0.023, harassment 0.006, illicit 0.005, self-harm 0.005, violence/graphic 0.002)
  - **image withheld**; `smoke test comment` preserved
- **Proves:** the A2 backstop maps adult `sexual` image → `track_a`; the account was **auto-banned by the gate** (the structural difference from Track B); block recorded; image not rendered; not published.

**Verification method.** Verified via the bet HTTP responses + the admin audit viewer (UI.6 slice A). The viewer renders the `mod_actions` row (verdict, actor, categories, author/ban status, withheld image, blocked text) and was a cleaner surface than the runbook's raw-DB checklist.

**Residual checks (optional, not blocking — the functional outcome is confirmed):**
- The runbook's literal persisted-state list also asks for `image_uploads.terminal_state` (`committed` for Case 1, `blocked` for Cases 2/3) and a direct `users.banned_at` read. The viewer confirms the ban (BANNED badge) and the block decisions; it does **not** directly show `image_uploads.terminal_state`. A one-shot DB read of the three `UPLOAD_ID`s would tick the runbook's last box if belt-and-suspenders is wanted.
- **CSAM seam negative check:** confirm in Sentry that **no** `csam_auto_report_pending` event fired for Case 3 — it must not, because adult `sexual` ≠ `sexual/minors` (the seam fires only on `sexual/minors`). This negative assertion was not checked this session.
- **Calibration (not wiring):** scores crossing into blocks (violence 0.514, sexual 0.969) confirm *wiring*, not *threshold calibration* — thresholds are untuned until HARDEN.5 per the runbook. `sexual 0.969` is unambiguous; the violence block is clearly correct but final tuning remains HARDEN.5's job.

---

## 5. Finding — audit-viewer author-status badge semantics (→ MAINT.19)

**Observation.** At 8:45 PM the Track B (violence) row showed author **active**. After the Case 3 Track A ban set `banned_at`, the 8:48 PM viewer showed **both** rows' authors as **BANNED**. Nothing re-blocked the violence row.

**Diagnosis.** The BANNED badge is a **read-time reflection of the author's *current* status** (a join to `users.banned_at` at render), **not** the status at the time of that block. The violence block did **not** ban RedOtter002 — the NSFW block did. The Track B contract held; only the display paints current status across all of that author's rows.

**Severity.** Display nuance, **not** a pipeline bug. The row *header* still correctly distinguishes the per-event action (`Track B · blocked` vs `Track A · auto-ban`), so the moderation outcome is faithful. Risk is a careless reader conflating the "Track B · blocked" header with the red BANNED badge and inferring "violence → ban" — wrong about Track B, and consequential on a moderation surface (e.g. reviewing an appeal).

**Recommendation.** Don't change the data — disambiguate the badge: either label it "account status (current)" or render the author's status *as of the block event*. **UI-lane, optional pre-launch, admin-only** (never participant-facing). Do **not** hold launch on it. Logged as a decision (MAINT.19), not absorbed silently.

---

## 6. Tracker updates (prescriptive — web-authored here; tracker is **PK-only / operator-maintained HTML**, confirmed in Phase 2, so the operator pastes these rows in — they are **not** committed to the repo)

All **five** are new (existing high-water mark is MAINT.16). MAINT.17–.20 came from this session; **MAINT.21 was surfaced by Claude Code during the Phase 2 doc-sweep** (pre-existing admin-path drift, unrelated to #150).

### MAINT.17 — Dedicated staging R2 + back out the prod-bucket pointer
*Trigger: before Sep 15; sub-item (b) is URGENT — before the next `main`→prod deploy.*
- **(a)** Provision a dedicated **staging** R2 uploads bucket; overwrite the four staging `R2_*_UPLOADS` keys with its values; redeploy; verify `/api/uploads/sign` → 200. (Backs out the temporary prod-bucket pointer set in §3.5.)
- **(b) PROD GAP — URGENT.** Prod Doppler is **missing** `R2_BUCKET_UPLOADS` and `R2_BUCKET_PFP` (`zugzwang-uploads` / `zugzwang-pfp`). Prod currently runs an older hardcoded path; on the **next `main` deploy** that reads these vars, prod `/api/uploads/sign` and the PFP path will **500** until they are set. One-liners: `doppler secrets set R2_BUCKET_UPLOADS="zugzwang-uploads" --config prd` and `doppler secrets set R2_BUCKET_PFP="zugzwang-pfp" --config prd`.
- **(c)** Fix `.env.example` mislabel — the endpoint is **account-level** (`https://<account_id>.r2.cloudflarestorage.com`), not "bucket-scoped".
- **(d) Cleanup** — delete the three smoke objects (especially the **NSFW** one) from the **prod** R2 uploads bucket after this smoke (they landed there because staging pointed at prod R2).

### MAINT.18 — Moderation throughput (verify-and-fund)
*Trigger: verify before Sep 15.*
- Confirmed: moderation is free at all tiers; the `429` was the **Tier-0 ~3 RPM** floor, not quota. Staging is now **Usage Tier 1** after adding a payment method.
- **Prod:** ensure the **prod** OpenAI project has a payment method → Tier 1+; on Settings → Limits, confirm the project's **moderation RPM** exceeds the estimated peak (~200 calls/min worst case for invite-scale) with margin. Moderation stays free.
- **Hardening question:** the gate fails **closed** at saturation (ADR-0014) — if the OpenAI account goes dark, betting halts platform-wide. Auto-recharge is currently **off**; for a launch-critical dependency, keep a non-zero balance or enable auto-recharge with a low threshold. Consider whether fail-closed-on-saturation is the right behaviour at scale vs. queue/retry.

### MAINT.19 — Audit-viewer author-status badge semantics (UI lane)
*Trigger: optional pre-launch.*
- Per §5: the BANNED badge reflects *current* author status, not status-at-event. Disambiguate (label "account status (current)" **or** render status-as-of-event). Admin-only; not participant-facing; do not hold launch.

### MAINT.20 — Stand up staging as a true production replica (NEW — operator-requested)
*Trigger: **after the DEBATE stratum closes AND all core code is complete**; before HARDEN/LAUNCH hardening. Owner: operator + CC.*

**Why.** This session is the evidence that improvising staging per-task is fragile: stale deploys, unset R2 vars, an unfunded OpenAI account, and a non-SHA-tracking health canary all blocked a routine smoke. Staging must be a faithful prod mirror so a launch rehearsal needs **zero** ad-hoc provisioning. **This item is the umbrella; MAINT.17 and MAINT.18 are line-items it must confirm GREEN.**

**Scope (parity audit + provisioning):**
- **Secrets / env parity.** Full diff of Doppler `stg` vs `prd`: every key present in `prd` present in `stg` with appropriate staging-scoped values. Eliminate all "borrowed from prod" pointers — in particular back out the R2 prod-bucket pointer (MAINT.17a).
- **Dedicated staging infra.** Own R2 buckets (uploads + pfp); own Supabase project (already separate); own Upstash Redis; own OpenAI project/key **funded to a matching tier** (MAINT.18); own Resend sender; own Turnstile keys; own Sentry + PostHog projects/environments.
- **Schema / migration parity.** Staging DB at the **same migration head** as prod; migration tooling present (ADR-0022 / PR #148).
- **Deploy discipline.** Staging tracks the same SHA as prod (or a defined ahead-of-prod branch). Kill the "stale staging serving old SHA" failure that opened this session. Make `/api/health` **track the SHA** (today it is a static marker `staging-2026-05-28` — freshness must be observable).
- **Data / seed parity.** Representative seed data; smoke market(s) provisioned by setup, not by hand.
- **Observability parity.** Sentry/PostHog staging environments wired; alerts (incl. `csam_auto_report_pending`) configured in staging too.
- **Cron / queue parity.** r2-orphan-sweep and any other crons running in staging.
- **Acceptance.** A re-run of **this exact** smoke (benign → violence → NSFW) passes on staging with **zero** ad-hoc provisioning. That is the proof the replica is faithful.

### MAINT.21 — Admin-cookie "indefinite Max-Age" SPEC↔code↔ADR reconciliation (surfaced in Phase 2)
*Trigger: errata pass; low priority; admin-only; before the HARDEN admin-auth review.*
- SPEC.1 §13 (≈ line 730) and ADR-0010 describe the admin cookie as having **"indefinite Max-Age."** The code (`src/server/auth/admin/login.ts:218`) sets **no `maxAge` and no `expires`** — a **host-only session cookie** (cleared on browser close), the opposite of indefinite. Three-way drift: SPEC + ADR say one thing, the code does another. Pre-existing; unrelated to #150 — this is the **admin-path cousin** of the participant-session cookie issue #150 fixed.
- **Decide the intended behaviour, then reconcile.** For a single admin, a host-only / session cookie (re-login on browser close) is defensible and arguably *more* secure — in which case correct SPEC.1 §13 + ADR-0010 to match the code (errata patch + ADR patch record). If persistent admin sessions were actually intended, change the code instead. Do **not** fix this inline in the #150 doc-sweep PR — it needs a deliberate call.

---

## 7. Doc sweep (carried from PR #150) — COMPLETED in Phase 2

Shipped by Claude Code in the close-out PR (commit `8e1df3d`, `just verify` green) per `maintenance.md` trigger #1:
- **SPEC.1 §13** — reconciled the participant-session "indefinite" claim at **four loci** (preamble definition, dataset-cleanliness trade-off, sessions-catalogue row, §18 out-of-scope) to "long-lived, cookie capped at `SESSION_MAX_AGE_SEC` = 34,560,000 s / 400 days, no idle timeout, no sliding refresh." Admin-cookie wording deliberately left untouched (separate mechanism → **MAINT.21**).
- **SPEC.2 §8.2** — appended one sentence: `getSession` rejects a session whose `expires_at` is in the past (read-time expiry enforcement), without restating #150's cap paragraph.
- **AGENTS.md (auth)** — added the `expiresIn` → cookie `maxAge` 400-day-ceiling gotcha (throws at *serialization*, not token creation).
- **AGENTS.md §6 (folded in during Phase 2)** — corrected the stale "Current head: 0015…" to the actual head **`0016_mod_actions_reason.sql`** (SURPRISE-2; a one-line currency fix folded into this PR because the file was already being edited — noted in the PR description).

---

## 8. Operator action checklist

- [x] **DONE (2026-06-21)** — set prod `R2_BUCKET_UPLOADS` and `R2_BUCKET_PFP` in Doppler `prd`; synced to Vercel **Production** (verified in the Vercel env panel). **MAINT.17b closed.**
- [ ] **DEFERRED → required before live traffic / Sep 15:** configure the Sentry `csam_auto_report_pending` alert to **page** (NCMEC filing is parked: `TODO(MOD-NCMEC-INTEGRATION)` / `docs/parked.md` LD-7). Deferred 2026-06-21 — not urgent today (no real traffic), but a **hard pre-launch gate**: it is the only signal of a legal CSAM follow-up obligation, and must not fire into an unconfigured project.
- [ ] Delete the three smoke objects (esp. NSFW) from the **prod** R2 uploads bucket (MAINT.17d).
- [ ] *(optional)* DB read of `image_uploads.terminal_state` for the three `UPLOAD_ID`s + direct `users.banned_at` read, to tick the runbook's literal persisted-state checklist (§4 residual).
- [ ] *(optional)* Confirm in Sentry that **no** `csam_auto_report_pending` fired for Case 3 (§4 residual).

---

## 9. Closing-ritual answer (per `maintenance.md`)

**Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this task?**
- **AGENTS.md — small fixes (done in PR):** the `expiresIn`→cookie-maxAge 400-day ceiling gotcha (§7), plus the §6 migration-head currency fix 0015 → `0016_mod_actions_reason.sql` (SURPRISE-2).
- **SPEC.1 / SPEC.2 — small fixes (done in PR):** the §7 doc-sweep items.
- **Tracker — meaningful update:** add MAINT.17, .18, .19, .20, **.21**. (Tracker is **PK-only / operator-maintained HTML** — confirmed in Phase 2 — so the rows are added by the operator, not committed to the repo.)
- **CLAUDE.md — candidate (defer to DEBATE phase-boundary audit):** a "staging = true prod replica" discipline note. DEBATE is still the active frontier (more strata to come), so the phase-boundary full audit (trigger #2) is **not** yet due; flag MAINT.20 as the place this principle gets operationalised.

---

*Session close. Both halves of the moderation gate — permit and block — plus the Track A/Track B split and the audit trail are confirmed live on staging at `3f82371`. Headline objective (returning-user login) achieved; bonus smoke passed.*
