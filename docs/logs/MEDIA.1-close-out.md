# Close-out — MEDIA.1 (admin market-media creation)

**Stratum:** MEDIA.1 — close-out (post-merge). The admin market-media creation vertical, governed by ADR-0026 (data model) + ADR-0027 (no admin moderation).
**Canonical SHAs (squash-merge on `main`):**
- Code: **PR #184 → `a08fc46`** (impl `9ded789`; Phase-1 plan/spec commits `95c4280` → `adbe0da` → `92aada4` → `9e90c27` → execute log `ca19754` squashed in).
- Canon sweep: **PR #185 → `3f325be`**.

**Version provenance.** PR #184 (`a08fc46`) carried ADR-0027 + its same-commit riders SPEC.1 → 1.0.12 / SPEC.2 → 1.0.13 (moderation removal). PR #185 (`3f325be`) layered the MEDIA.1 footprint: SPEC.1 1.0.12 → 1.0.13, SPEC.2 1.0.13 → 1.0.14, + the AGENTS.md admin-route rule.

**State:** merged; both verified on `main`. Execute-session detail in `docs/logs/MEDIA.1.md`; this doc is the release/sequencing close-out.

## SHIPPED — the admin market-media creation vertical

- **Migration 0019** — `market_media` (Bucket C; `id`, `market_id` FK→`markets.id` ON DELETE RESTRICT + index, `r2_object_key`, `display_order`, `is_default`, `created_by` default `'admin-singleton'`, `created_at`) + `markets.media_video_url` (nullable text). Additive/expand; head `0018 → 0019`.
- **Admin signed-PUT route** `/admin/markets/media/sign` (`src/app/(admin)/admin/markets/media/sign/route.ts`) — admin-session-gated, forked from the participant sign route, DB-free, **server-generated `mediaId`**, per-IP capped (`adminMediaPutUrlPerIp`), no moderation import.
- **`createMarket` strict-insert-only** — required client-pre-generated UUIDv7 PK; plain INSERT, **no `onConflict`**; PK collision → `MarketIdConflictError` / `market_id_conflict` (typed, never a raw 500), never overwrites an existing market.
- **`createMarketAction` media handling** — zod shape for `marketId` / `media[]` / `mediaVideoUrl`; the §15 media invariant + video-URL validity are service-thrown (`media_required` / `default_media_required` / `video_url_invalid`), mapped in `toActionError`.
- **OD-2 `market.created` payload extension** — additive `media[]` (key + displayOrder + isDefault) + `mediaVideoUrl`; **EVENT_TYPES still 23**, no new `aggregate_type`.
- **OD-5 partial unique index** `market_media_one_default_per_market_uq` ON `market_media(market_id) WHERE is_default` — exactly-one-default-per-market storage backstop (service enforces; index is the belt).

## DECISIONS

- **ADR-0027** — admin market-media is **direct-upload, NOT moderated** (operator-curated trusted content; the participant UGC moderation pipeline gates untrusted content and is untouched). **Supersedes ADR-0026 §D4.**
- **OD-1..OD-5** — upload-before-create (OD-1); `market.created` payload extension, no new event type (OD-2); `comments.market_media_id` deferred to the composer-pick slice (OD-3); the admin signed-PUT route stood up forked from the participant one (OD-4); the exactly-one-default partial unique index (OD-5).
- **Q3 client-PK hardening** — accept the client-supplied PK but harden to strict-insert-only + UUIDv7 validation + the exact-shape R2 key guard. @security-auditor verified both facets: (a) DB — a duplicate `marketId` rejects and leaves the existing market unchanged; (b) R2 — server-generated `mediaId` + row-driven display means a PUT under an arbitrary `marketId` can at worst create a harmless unreferenced orphan, never overwrite or surface foreign media.
- **Mid-build moderation-removal pivot** — ADR-0027 reversed the prior admin-media moderation design; the plan was re-aligned at **`9e90c27`** (removed the admin-context moderation caller, the verdict-helper extraction, the moderation read-back, `media_moderation_blocked`, and the `mod_reason` enum addition). `src/server/moderation/**` and `src/db/schema/audit.ts` ended untouched.

## DEVIATIONS (from plan)

- **Route path `/api/admin/markets/media/sign` → `/admin/markets/media/sign`.** The `zugzwang_admin_session` cookie is `Path=/admin`, so a handler under `/api/admin/...` never receives it and would 401 the real admin (dead on arrival). **Caught by @security-auditor**; a `cookies()` mock had masked the failure in the unit layer. Relocated under the `(admin)/` route group (tight cookie path matched, cookie NOT broadened to `/`). The plan's `/api/admin/...` reference + the SPEC.2 §4.3 forward-note were corrected in the canon sweep (#185); the AGENTS.md admin-route-path rule codifies it for future admin routes.
- **ADR-0027 reversed the moderation design mid-flight** — the slice began under ADR-0026 §D4 (admin-context upload moderation); ADR-0027 removed it. Plan re-aligned before execute (`9e90c27`).

## PROCESS DEVIATIONS

- **24h soak on #184 skipped** (operator merged early). **Compensated** by a post-merge fresh-tab cold diff review (separate session, no shared context) — came back **CLEAN, no HIGH/MED**, with two positive hardenings noted (below).
- **Pre-merge final diff reviews on #184/#185 not performed** — operator merged ahead; #185 was docs-only (markdown; Biome skips, CI `ci` check trivially green).

## ACCEPTED RESIDUALS

- **(a) LOW — `market.created` required media fields.** The extended payload schema makes `media` (`.min(1)`) + `mediaVideoUrl` (`.nullable()`, present) **required**. A pre-MEDIA.1 `market.created` event would fail replay-validation **IF** a future tool ever replay-validates historical payloads. **Accepted** under the explicit assumption that **no releasable DB holds pre-MEDIA.1 `market.created` events** (live markets are created from launch 2026-09-15 via the now-required media path; the schema is write-time-only with a single emitter; old-shape rows exist only in pre-launch dev/staging scratch). **Make `.optional()` opportunistically** when `market.created` is next touched (MEDIA.2/3).
- **(b) Q2 — admin upload orphans.** Unsubmitted admin uploads may orphan: the `market-media` bucket has no orphan sweep (the same upload-before-DB-write property as the participant out-of-band path). **Near-moot** under the single-trusted-operator model (the create-form is the only admin upload path). Closing the gap (sweep / eager cleanup) is a separate future decision, not this slice.

## DEFERRED (NOT MEDIA.1)

- **MEDIA.2** — header carousel display + the outbound video-link button (`markets.media_video_url` stored here, rendered there).
- **MEDIA.3** — composer pick-from-pool: `comments.market_media_id` + the not-both-set CHECK + its migration + the F-COMMENT-3 pick UI.
- **`Draft → Open` media re-assertion** (F-ADMIN-2) — re-assert ≥1 image + exactly one default at the open commit; this slice enforces at create only.
- **R2 ops** — `R2_*_MARKET_MEDIA` Doppler creds (`stg`/`prd`) + `zugzwang-market-media` bucket provisioning (operator/ops, not a code task).

### PRE-EXISTING-DRIFT BACKLOG (separate sweep — explicitly NOT MEDIA.1)

- The phantom `POST /api/admin/uploads/sign` (F-ADMIN-4) references + the stale "moderation affordance" label (SPEC.2 §4.3 catalogue, §4.6, §12.10 SSOT, Appendix A, §4.1 file-map).
- The `rate-limit.ts` `writeBudgetPerMarket` / `writeBurstPerUser` instances ↔ SPEC.2 §11 drift (code retains the two write-budget/burst instances the §11 narrative says were removed under reply-as-bet; §11 table documents 5 of the 8 code instances).

## DEPLOY STATE

- **Migration 0019 is CI-proven and on `main`, but applied to NO live DB.** `origin/staging` is stale at `41311bc` (pre-ADR-0026), so `staging-migrate.yml` has not applied 0019 to staging; prod migrate is the **manual gated `scripts/migrate-prod.ts`** step (no auto-prod-migrate workflow; no evidence it has run). [Env DB state is not directly verifiable from here — `.env*` / `psql`-prod are out of bounds.]
- **Migrate-before-serve pending** — 0019 must be applied to prod **before** the MEDIA.1 code is promoted/served there.
- **Operator confirm before serving / before the next migration-bearing merge:** the Vercel `autoAssignCustomDomains` gate (the migrate-before-serve precondition per the D3 deploy topology).

## BONUS HARDENINGS (beyond plan)

- **Exact-regex foreign-prefix R2 key guard** in `createMarket` — every submitted media key must match `^m/<marketId>/<mediaId>.<ext>$` exactly (not `startsWith`), rejecting `..`-traversal foreign-prefix keys, so a `market_media` row can never point row-driven display at another market's / an arbitrary R2 object.
- **Isolated R2 credentials** for the third (`market-media`) bucket arm (`R2_*_MARKET_MEDIA`) — preserves the per-bucket compromise-isolation property rather than diluting into a shared "media bucket" abstraction.

## Time

2026-07-01 (close-out session). Execute: 2026-06-30 (`docs/logs/MEDIA.1.md`).
