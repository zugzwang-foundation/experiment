# SPEC.2 — Zugzwang Technical Architecture

> **Status:** 1.0.2 · v1.0 locked at PRECURSOR.4 (2026-06-03, fresh-session writer/reviewer review per CLAUDE.md); §23 + §0 reconciled to the tracker-v11 phase model and post-lock status-prose hygiene applied at the post-SYNC tracker sweep (1.0.1) · §0–§23 + Appendices A–B complete · ADR-0017/0018/0019 folded + ADR-0009 superseded-by-0017 · **reply-as-bet model** (every comment rides a bet; friendly-fire + `friendly_fire_events` + `stake_at_post_time` removed entirely; Support/Counter are read-time aggregates over reply-bets) consistent with SPEC.1 (v1.0.x) · K_eff dashboard struck per PRECURSOR.2-B D4 (no live in-product surface; K_eff(t) derived post-hoc from the 2026-11-06 public dataset per SPEC.1 G3 + §12.2)
> **Repo path:** `zugzwang-foundation/experiment/docs/specs/SPEC.2.md`
> **Companion files:** `SPEC.1.md` (product), `cpmm.md` (math), `RANKING.md` (ranking function), `PSEUDONYM.md` (pseudonym pool spec), `design.md` (visual system) — the four companion specs are authored by their gating tasks (pending; see §1.4); 17 ADRs at `docs/adr/0003–0019` committed at SYNC.BACKFILL

---

## §0 Document Metadata

| Field | Value |
|---|---|
| **Document** | SPEC.2 — Zugzwang Technical Architecture |
| **Version** | 1.0.2 |
| **Date** | 2026-06-10 |
| **Owner** | Hrishikesh Manoj Hundekari |
| **Phase** | Experiment phase only (2026-04-24 → 2026-11-08). Out of scope: testnet, mainnet, on-chain |
| **Lock gate** | PRECURSOR.4 (Fresh-session lock review, writer/reviewer split per CLAUDE.md) — promotes this doc from `v0.3-draft` → `v1.0` |
| **Gates downstream** | 17 ADRs (`ADR-0003` through `ADR-0019`; 0003–0016 = SPEC.3–7, SPEC.9–13, SPEC.14–17; ADR-0017 = SYNC.4; ADR-0018/0019 = SYNC.5) + all `SCAFFOLD.*`, `ENGINE.*`, `DEBATE.*`, `VISUAL.*`, `TESTING.*`, `HARDEN.*` tracker tasks |
| **Source-of-truth** | `zugzwang-foundation/experiment` repo. Project knowledge file is a snapshot, not the canonical copy. |
| **Versioning policy** | `v0.1-outline` → `v0.2-draft` (operational substance distributed across ADRs 0003–0008 + §0–§4 drafted + §9–§11 + §16 absorbed by ADRs 0013–0016) → `v0.3-draft` (operational tail §5–§8 + §12–§15 + §17–§23 + Appendices A–B drafted across PRECURSOR.3) → `v0.3.1`–`v0.3.4-draft` (SCAFFOLD.4 + SCAFFOLD.18 point absorptions) → `v0.4.0-draft` (SYNC.7 — ADR-0017/0018/0019 folded into §22; ADR-0009 superseded-by-0017; RLS posture recorded in §18.5; `cpmm.md` forward-reference; companion/ADR-count + PRECURSOR.5 drift folds; **full removal of `friendly_fire_events` + `stake_at_post_time` from the schema and every operational reference, reply-as-bet write-path rework, two-floor minimum-bet references, Daily Credit concept rename, Flipped/Exited marker** — bringing SPEC.2 into consistency with SPEC.1 v1.9.0-draft) → `v1.0` (locked by PRECURSOR.4 fresh-session review). Subsequent revisions bump minor. ADRs are immutable; SPEC.2 is mutable; supersession requires same-commit SPEC.2 update plus ADR `Superseded-by` link. |
| **Companion paper** | `zugzwang_btc_style_v4.pdf` — theory and Zugzwang Condition. SPEC.2 implements; the paper does not bind on engineering choices. |
| **License** | AGPL-3.0 (matches protocol license; see `LICENSE.md`) |

### §0.1 Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1-outline | 2026-05-04 | HMH | Outline locked. §0, §1, §2 drafted. Option B substance-distribution (frame here, substance in dependent ADRs) ratified. D2 actor-vs-SERIALIZABLE ratified to SERIALIZABLE; tracker bumped v4 → v5. 4 new ADR slots created (SPEC.14–17). |
| v0.1-outline | 2026-05-04 | HMH | ADR-0003 (SPEC.3) accepted; cross-references absorbed into §3, §4, §10, §16, §23 stubs. |
| v0.1-outline | 2026-05-05 | HMH | ADR-0004 (SPEC.4) accepted as **Better Auth + Drizzle adapter + database session strategy**. Cross-references absorbed: §8 stub rewritten to drop Auth.js v5 reference and adopt Better Auth + concrete cookie names (`zugzwang_session` participant, `zugzwang_admin_session` admin) + session-deferral hook contract; §23 ADR Index status flipped to `accepted` with date; §11 + §19 unaffected at outline level (substance back-pressure deferred to their drafting chats per ADR-0004 hand-off). |
| v0.1-outline | 2026-05-05 | HMH | ADR-0005 (SPEC.5) accepted as **Postgres + event-sourced schema, Pattern A** (events log + hand-maintained current state). Cross-references absorbed: §6 stub rewritten to name the trigger SQL file path (`drizzle/migrations/<NNNN>_append_only_triggers.sql`) and the per-table append-only-vs-mutable classification (Bucket A 9 tables / Bucket B 2 tables / Bucket C 7 tables / 1 deferred); §7 stub rewritten to point at the events table column shape, twelve pre-created monthly partitions + DEFAULT partition, and the synchronous-vs-asynchronous read-model classification rule (synchronous ⇔ originating flow's correctness depends on read-model state); §23 ADR Index status flipped to `accepted` with date. §5 inventory absorbs the Bucket classification at the next §5 drafting pass and drops `admin`, `otp_codes` (renamed `verifications`), `daily_allowance_events`, and `projections_state`; §14 invariant-mechanism table back-pressure (INV-2 ledger-row discipline + INV-4 trigger reference) deferred to §14 drafting pass; §18 observability tag set absorbs `events.metadata` columns + DEFAULT-partition Sentry alarm at next §18 drafting pass; §20 dataset-export pipeline absorbs `pg_dump`-over-view shape at next §20 drafting pass. |
| v0.1-outline | 2026-05-05 | HMH | ADR-0006 (SPEC.6) accepted as **Hosting Topology (Vercel + Supabase + Upstash + Cloudflare R2, Mumbai single-region, `pg_cron` + Vercel Cron hybrid)**. Cross-references absorbed: §4 stub rewritten at outline level to name the four-vendor Mumbai single-region topology (Vercel `bom1` + Supabase + Upstash `ap-south-1` + R2 `APAC`), the Cloudflare-DNS-only mode (no CDN-in-front-of-Vercel), the cron-engine-split (pg_cron primary + Vercel Cron HTTP-fanout carve-out), and the failure-mode profile reference; §22 stub rewritten to absorb the cron-schedule register substance — engine choice (pg_cron + Vercel Cron) + four-job v1 inventory (drift detection, partition-overrun monitoring, identity-pool low-watermark check on pg_cron; R2 orphan sweep on Vercel Cron) + Vercel-Cron-only-for-HTTP-fanout discipline; §12 stub minor clarification (R2 bucket-policy specifics are SCAFFOLD.15 territory, not ADR-0006); §23 ADR Index status flipped to `accepted` with date. ADR-0005 gating items closed: Postgres 17 ratified, Supabase ratified as DB provider, region `ap-south-1` ratified, PITR retention 7-day default / 14-day pre-authorized upgrade, pg_cron topology ratified. Two-tier traction-gated cost model ratified: $300/mo default ceiling, $500/mo upgrade tier pre-authorized (Supabase Medium compute + Upstash Pro fixed-instance + 14-day PITR add-on). Substantive §4 + §22 drafting deferred to their dedicated drafting chats per outline-level absorption pattern. |
| v0.1-outline | 2026-05-05 | HMH | ADR-0007 (SPEC.7) accepted as **Observability (Sentry + PostHog; Vercel runtime logs serve structured request logging)**. Two vendors not three — Axiom dropped from v1 in favor of Vercel runtime logs serving the SPEC.1 §16.3 H3 structured request log contract; custom-metrics dashboards defer to ad-hoc SQL against the Postgres events log. Cross-references absorbed: §18 stub rewritten substantively — vendor configuration (Sentry + PostHog), six-category Sentry alarm catalogue (append-only-trigger violation, DEFAULT-partition insert, 40001-retry exhaustion, OpenAI moderation upstream-failure rate, identity-pool low-watermark, per-vendor unavailability + cron job failure), PostHog `useFlag(name, defaultValue)` runtime contract with fail-open semantics, Vercel runtime logs as the structured-log surface, code-level redaction discipline ("no request body, no response body" enforced as code rule; CI lint flagged for `HARDEN.*`), session-replay-disabled-in-v1 lock, fail-open posture across the board; §22 stub absorbs alarm catalogue as input to per-alarm runbook entries `HARDEN.*` will produce; §23 ADR Index status flipped to `accepted` with date. Stale "projector lag" alarm in §18 stub dropped (no projectors in v1 per ADR-0005 Pattern A); stale "structured Axiom log line" phrasing replaced; "R2 orphan count" hook deferred (soft signal, not a Sentry alarm). $50/mo single-tier observability cost ceiling ratified, separate from ADR-0006's hosting tier. CLAUDE.md row 336 (Axiom) flagged for strike or rewrite. SCAFFOLD.7 (Axiom wired) flagged for tracker strike. Two new HARDEN.* tasks flagged for tracker addition (CI lint for log-redaction; external uptime monitor). |
| v0.1-outline | 2026-05-06 | HMH | ADR-0008 (SPEC.9) accepted as **Drizzle ORM + drizzle-kit + drizzle-zod**. Eight primitives ratified: Drizzle as the persistence-layer ORM with the client at `src/db/index.ts` (`import 'server-only'`); drizzle-kit as primary migration tooling with config at `drizzle.config.ts`; **single migration set, mixed origin** (drizzle-kit-generated `.sql` files and hand-written raw SQL files coexist in `drizzle/migrations/<NNNN>_<kebab-case>.sql`, ordered numerically — no separate "raw migrations" directory); per-domain schema split (`src/db/schema/<domain>.ts` + barrel `src/db/schema/index.ts`); drizzle-zod co-located in the same file as the table definition for table-row API-boundary validation only (NOT for `events.payload` JSONB content — that has per-event-type Zod at `src/server/events/schemas.ts` per ADR-0005); three usage disciplines (default to explicit joins with `relations()` reserved for nested-eager-load; events insert helper uses `sql\`...\`` template; hot-path raw queries use `sql<T>\`...\`` typed templates); type inference via `$inferSelect` / `$inferInsert` (no codegen step); NUMERIC(38,18) for Dharma balances at the DB layer (decimal-arithmetic library deferred to SCAFFOLD.2 / ENGINE.5). Cross-references absorbed (outline-level): §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §5 (per-domain schema split convention reference), §6 (single-migration-set discipline reference), §7 (drizzle-zod-vs-events-payload-Zod boundary reference), Appendix A (five new file-map rows: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema/index.ts`, `src/db/schema/<domain>.ts`, `drizzle/migrations/<NNNN>_<kebab-case>.sql`). Tracker corrections flagged for application: SPEC.9 description "(append-only events + projectors)" and SCAFFOLD.2 description "projector workers maintain read-model tables" both stale per ADR-0005 Pattern A — both for replacement with "same-transaction read-model writes." AGENTS.md / CLAUDE.md drift flagged for the dedicated AGENTS/CLAUDE update pass: `src/server/db/` → `src/db/`, `--name <kebab-case>` discipline addition to §6.2, query convention clarification per ADR-0008 discipline 6.1. |
| v0.1-outline | 2026-05-06 | HMH | ADR-0009 (SPEC.10) accepted as **Ranking function lock (`RANKING.md`)**. Function shape ratified: HN-style time-decay (`(age_hours + 2)^gravity`) over a log-scaled additive numerator. Five inputs locked: `stake_at_post_time` (Dharma-valued position size on the comment's side at the moment of post, frozen on the comment row at write-time), friendly-fire net score (`up − down`, computed over `friendly_fire_events` rows where `frozen_at IS NULL` and `cleared_at IS NULL`), opposite-side direct-reply count, same-side direct-reply count, comment age. Author Dharma at post time considered and rejected for v1 (45-day-window argument: log-scaled spread ≈ 0.7 across the population — dead weight; reintroducible at testnet phase via new ADR). Subtree reply count considered and rejected (reply-bombing attack-surface argument; direct-reply count only). Reddit-style filter tabs (Top / Controversial / Latest) considered and rejected (single universal function). Five tunable parameters (`w_stake`, `w_ff`, `w_reply_opp`, `w_reply_same`, `gravity`) deferred to the 2026-09-01 number-tuning pass; design-intent ordering `w_reply_opp > w_ff > w_reply_same > w_stake` ratified. Replies scored by the same function and rendered via two-slot rule (best opposite-side + best same-side; "show all replies" expansion ranked by score descending). Flat replies — `REPLY_DEPTH_MAX = 1` pinned. Tie-break: `comment_id` ascending (UUIDv7 natural creation-time order per ADR-0016). Frozen-at-resolution: function takes a `now` parameter; for resolved markets `now` = resolution timestamp. Cross-references absorbed (outline-level): §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §5 (Table Inventory) absorbs new frozen column `comments.stake_at_post_time NUMERIC(38,18) NOT NULL` written inside the bet+comment / comment / reply transaction — Bucket A append-only mutation discipline applies (the column is set on INSERT only; not subject to any whitelisted-transition update); §7 (Event Model) outline-level statement "Read-time-computed (no projection table): debate-view ranking" stands unchanged — ADR-0009 is consistent with this classification; §9 (Concurrency & Transactions) absorbs the rule that the comment-writing transaction (entry F-BET-1, direct F-COMMENT-1, reply F-COMMENT-2) must compute and persist `stake_at_post_time` inside the transaction — value derived from current position size (Dharma-valued) on the relevant side at write-time; Appendix A (Single-Source-of-Truth File Map) absorbs two new rows: `experiment/docs/specs/RANKING.md` (the function specification) and confirms the existing `src/lib/ranking.ts` row (the pure-TypeScript implementation module — no IO, no DB calls, importable from server + tests). Index requirements flagged for SCAFFOLD.2: `friendly_fire_events(comment_id, frozen_at, cleared_at)` for the up/down aggregation per debate-view render; `comments(parent_comment_id, side_at_post_time)` for the opposite-side / same-side reply-count aggregation per top-level comment. SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.1.0-draft → v1.2.0-draft (§9 ranking function preamble + replies paragraph + F-DEBATE-1 system + acceptance tests; §2 glossary; §8 F-COMMENT-2 system; §16.1 `REPLY_DEPTH_MAX` description; §17 acceptance-test catalogue; §18 out-of-scope; §19 Q13 closed; §20 change log; Appendix B `REPLY_DEPTH_MAX` pinned). Tracker (zugzwang_experiment_tracker_v5.html): SPEC.10 row complete; DEBATE.4 + DEBATE.8 dependencies on SPEC.10 satisfied. Cleared-row schema for `friendly_fire_events.cleared_at` remains a SCAFFOLD.2 deliverable per F-COMMENT-7 ("schema decides"); ADR-0009 consumes whichever shape SCAFFOLD.2 picks via the named filter discipline `frozen_at IS NULL AND cleared_at IS NULL`. |
| v0.1-outline | 2026-05-06 | HMH | ADR-0010 (SPEC.11) accepted as **Admin auth wiring (static password in env var, hand-rolled, two-layer middleware-plus-validator)**. Eight primitives ratified: hand-rolled admin auth path on the existing Postgres + Drizzle vendor stack (no Better Auth admin instance, no third-party identity provider in the admin trust path); `ADMIN_PASSWORD` env var as the auth secret with constant-time comparison via `crypto.timingSafeEqual`; `admin_sessions` schema simplified to three columns (`session_id, issued_at, last_seen_at`) — the prior `admin_email` column was dropped because static-password auth makes it purposeless; transactional `DELETE+INSERT` on every successful login to maintain the single-row-at-any-moment invariant; two-layer auth check (Next.js middleware at `/admin/*` for redirect UX, Server Action / route-handler validator at `src/server/auth/admin/validate.ts` as the security boundary per CVE-2025-29927 defense-in-depth, AGENTS.md §5); cookie attributes `HttpOnly + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age` on cookie name `zugzwang_admin_session`; identical 401 `admin_login_invalid` response on wrong-password and rate-limit-exceeded (no information leak); per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` per SPEC.1 §16.1. Cross-references absorbed (outline-level): §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §8 (Authentication & Sessions) stub remains accurate as-is — it already names the participant path as Better Auth (per ADR-0004) and the admin path as "hand-rolled `admin_sessions` table, cookie name `zugzwang_admin_session`, per ADR-0010"; the auth-method specifics (static password vs OAuth) were always delegated to ADR-0010 and the stub does not need amendment. Appendix A absorbs four new file-map rows on its drafting pass: `src/server/auth/admin/login.ts`, `src/server/auth/admin/validate.ts`, `src/server/auth/admin/logout.ts`, `src/db/schema/admin-auth.ts`. SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.2.0-draft → v1.3.0-draft (§13 preamble + F-AUTH-ADMIN body + §16.1 new constant + §16.4 `admin_sessions` row + §17 acceptance tests + §18 forgotten-password bullet + §19 Q18 closed + §20 change log + Appendix B). Tracker (zugzwang_experiment_tracker_v5.html) correction flagged for application: SPEC.11 description currently says "Lock NextAuth (or alternative per SPEC.4) configuration for /admin/login Google OAuth path with ADMIN_EMAIL env-var allowlist" — stale on two counts (NextAuth was never picked; ADR-0004 picked Better Auth, and ADR-0010 picked hand-rolled static password). Suggested replacement: "Lock admin auth wiring (hand-rolled static password per ADR-0010 on the locked SPEC.1 §13 vendor stack). Specifies admin_sessions table schema, admin session middleware shape, separation guarantees from participant session path, suspected-compromise rotation procedure. Per SPEC.1 §13 F-AUTH-ADMIN + Q18." HARDEN.* tracker addition flagged: `BREAK_GLASS.md` runbook authoring (sealed-envelope credentials handoff for backup-admin recipient + suspected-compromise rotation procedure including the manual `DELETE FROM admin_sessions` step). |
| v0.1-outline | 2026-05-07 | HMH | ADR-0011 (SPEC.12) accepted as **Pseudonym pool design (`PSEUDONYM.md`)**. Companion spec `PSEUDONYM.md` v1.0-draft shipped under AGPL-3.0 at `experiment/docs/specs/PSEUDONYM.md` — pairing pattern mirrors ADR-0009 + `RANKING.md`. Architectural primitives ratified: namespace 50 colours × 100 animals × 10 deterministically-selected number variants per pair = 50,000 with three-digit zero-padded numbers in the range 000–999; word lists ship as plain `.txt` files at `experiment/asset-pipeline/colours.txt` and `animals.txt` with PascalCase single-token entries and curation rules locked in `PSEUDONYM.md` §1; deterministic per-pair number selection via `hash(colour + ":" + animal + ":" + version_tag + ":" + model_checkpoint_hash)` over a deterministic PRNG (collision-free pool extension by widening per-pair count); same seed-derivation function applied at the Flux sampler level for bit-exact reproducible Flux outputs; ComfyUI workflow committed at `experiment/asset-pipeline/comfyui-workflow.json` with pinned model checkpoint hash + sampler params; number compositing is deterministic Pillow post-processing (no AI in compositing); R2 storage at `zugzwang-pfp/v1/<slug>` with explicit `Content-Type: image/webp` + `Cache-Control: public, max-age=31536000, immutable`; bucket-policy *requirements* minted by ADR-0011 (public-read on `v1/*`, no anonymous list, no anonymous write), specific JSON authored by SCAFFOLD.15; pre-flight 100-image gating run before production Flux job; cheap-doubling-via-numbers preferred for capacity-driven pool extension (10 → 20 numbers per pair = 100K, no new Flux work); aesthetic-override mechanism via `version_tag` bump scoped per-pair. DGX Spark only for v1; portability not committed. Three operational tunes deferred to SCAFFOLD.17 + UI/UX design pass — compositing font, contrast rule, locked Flux prompt + sampler params — tracked in `PSEUDONYM.md` §13 as v1.x.0-draft change-log targets, NOT SPEC.1 §19 open questions (operational/cosmetic, not architectural). Cross-references absorbed (outline-level): §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §5 (Table Inventory) — `identity_pool` row classification already locked by ADR-0005 (Bucket B, `assigned_at` whitelisted NULL→timestamp transition) + schema columns already locked by SPEC.1 §16.4; no new §5 absorption needed beyond the inventory-already-named status. Appendix A absorbs new file-map rows on its drafting pass: `experiment/docs/specs/PSEUDONYM.md`, `experiment/docs/adr/0011-pseudonym-pool-design.md`, `experiment/asset-pipeline/colours.txt`, `experiment/asset-pipeline/animals.txt`, `experiment/asset-pipeline/comfyui-workflow.json`, `experiment/asset-pipeline/composite_numbers.py`, `experiment/asset-pipeline/fonts/<font>.ttf` (when font lock lands). SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.3.0-draft → v1.4.0-draft (§0 version bump + §2 glossary Pseudonym entry three-digit examples + §13 F-AUTH-3 preamble/system-step-2/asset-pipeline subsection — including the contradiction-fix that resolves SPEC.1 v1.0.0-draft's two-vs-three-digit drift in favour of three-digit, all `ADR-PSEUDONYM` references replaced with `ADR-0011 / PSEUDONYM.md` + §17 three new acceptance-test rows under the `auth::pseudonym-` family + §19 Q15 closed + §20 change log). Tracker (zugzwang_experiment_tracker_v5.html): no SPEC.12 description correction needed — current entry accurately describes ADR-0011 scope. SCAFFOLD.17 (Identity-pool generation pipeline, 5d, P0, blocked by SPEC.12 + SCAFFOLD.2 + SCAFFOLD.15) is now unblocked from the SPEC.12 dependency. |
| v0.1-outline | 2026-05-07 | HMH | ADR-0013 (SPEC.14) accepted as **Concurrency & bet transaction (D2 implementation specifics)**. Six implementation primitives ratified: pool-row pessimistic lock via `SELECT … FOR NO KEY UPDATE` (refining the §9 stub `FOR UPDATE` wording — `FOR UPDATE` conflicts with `FOR KEY SHARE` per Postgres 17 §13.3.2 and would block every concurrent FK-validating INSERT against the pool, while `FOR NO KEY UPDATE` does not; verified against the Postgres 17 row-level lock conflict matrix); canonical lock order extended from the §2.2 RESOLVED block's four-table chain to five tables — `pools → positions → dharma_ledger → friendly_fire_events → events` — with `friendly_fire_events` placed between `dharma_ledger` and `events` to keep per-user writes co-located and `events` terminal per ADR-0005 convention; full-jitter retry on bases [50, 100, 200] ms (citing AWS Brooker 2015 *"Exponential Backoff And Jitter"* — full jitter wins over equal jitter; decorrelated jitter rejected as designed for unbounded retry loops with growing waits, bypassed when bases are pre-pinned); retry on both SQLSTATE 40001 (`serialization_failure`) AND 40P01 (`deadlock_detected`) with the same ladder (40P01 expected to be vanishing under canonical lock order; retry-and-tag preferable to crash); Sentry breadcrumb per retry attempt + custom event on terminal exhaustion firing alarm 3 per ADR-0007 §4 entry 3 (breadcrumbs are O(1) wire cost; alarms reserved for real escalations); idempotency-key cache lookup as the FIRST authenticated step in every bet handler — short-circuiting both moderation and transaction on completed-cache hit (Stripe contract — protects against non-deterministic OpenAI re-runs on completed-but-network-dropped bets and bounds OpenAI cost by unique requests, not retry count). Cross-references absorbed: §2.2 RESOLVED block's `resolves-in` line annotated with accepted/pending status for ADR-0013 / ADR-0014; §9 stub fully rewritten substantively (`FOR UPDATE` → `FOR NO KEY UPDATE`, lock-order chain extended with `friendly_fire_events`, retry SQLSTATE set extended with 40P01, jitter shape pinned as full jitter with the AWS citation, idempotency-first ordering mandated, observability shape — breadcrumb + alarm 3 — named, single-source-of-truth file path `src/server/bets/transaction.ts` named); §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §14 (Invariant Contract) absorbs the named INV-1 mechanism `src/server/bets/transaction.ts` at the §14 drafting pass — the wrapper opens the SERIALIZABLE transaction, acquires the pool-row lock, runs the lock-order chain, applies the retry policy, and appends events; §15 (Error Code Envelope Shape) is unchanged — ADR-0013 mints one new error code `bet_serialization_exhausted` (HTTP 503, `error_type: temporary_unavailable`, `Retry-After: 1`) for the `error-codes.md` codes-list when that file is drafted, distinct from F-BET-5 `market_closed_at` (HTTP 400) and F-BET-6 `in_flight_timeout` (HTTP 400). SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.4.0-draft → v1.5.0-draft (§0 version bump + §17 ten new `bets::concurrency-*` acceptance-test rows + §20 change log). Tracker (zugzwang_experiment_tracker_v5.html): no SPEC.14 description correction needed — current entry accurately describes ADR-0013 scope; ENGINE.7 (Bet transaction primitive) now unblocked from the SPEC.14 gating dependency and remains gated only on ENGINE.4 + ENGINE.5 + ENGINE.6. Future-consideration flags for ADR-0015: ADR-0013 §3 + Consequences notes the Postgres-native idempotency option (Brandur Leach's `INSERT … ON CONFLICT DO NOTHING` pattern at https://brandur.org/idempotency-keys) as a viable alternative to the Redis SETNX-with-pending-sentinel pattern named in the SPEC.16 kickoff brief; ADR-0013 §3 also flags HTTP 422 as explicitly NOT a valid choice for body-mismatch error responses (Stripe uses HTTP 400 with `code: idempotency_error`; Brandur and the IETF Idempotency-Key draft use HTTP 409 with `error_params_mismatch`); ADR-0015 picks. |
| v0.1-outline | 2026-05-07 | HMH | ADR-0014 (SPEC.15) accepted as **Pre-commit moderation flow**. Eight implementation primitives ratified: vendor selection (OpenAI `omni-moderation-latest`, snapshot-pinned `omni-moderation-2024-09-26`, for text and multimodal classification + PhotoDNA-or-equivalent for CSAM hash matching — no third image-classifier vendor in v1; the prior kickoff "Rekognition / Sightengine / Hive — decide or defer" framing resolved as **decide**, not defer, because omni-moderation-latest covers violence, self-harm, and sexual non-minors natively in a multimodal call and is free of charge per OpenAI Help Center as of May 2026); parameterised Server Action sequence consumed by F-BET-1 / F-COMMENT-1 / F-COMMENT-2 / F-COMMENT-3 — auth gate → idempotency cache lookup (per ADR-0013 §3) → Redis SETNX intent-reservation → `precommitModerate()` → branch on verdict (`pass` opens the caller-specific transaction; `track_a` / `track_b` writes `mod_actions` in a standalone short transaction and returns the F-MOD-* response without ever opening the bet/comment transaction); 10-second Redis intent-reservation key on `mod:reserve:{user_id}:{market_id}:{idempotency_key}` (the kickoff's 60-second value rejected as 10× over-sized against the ratified 5–10 second submit budget; collision returns 409 `moderation_in_flight` with `Retry-After: 2`; release in `finally`, TTL is the safety net); OpenAI HTTP call shape (3-second timeout per attempt, one retry on transient failure — network error / timeout / 5xx / 429, no retry on 4xx auth errors which fire `openai_moderation_auth_failure` instead, fail-closed on terminal failure with HTTP 503 `moderation_unavailable` and `Retry-After: 5`); PhotoDNA called in parallel with OpenAI on every image-attached submission with same timeout / retry / fail-closed posture, csam_match short-circuits the verdict to Track A, exact HTTP shape owned by SCAFFOLD.16; F-MOD-4 atomicity preserved structurally (the bet+comment transaction never opens on Track A / B verdict, so INV-1 holds trivially — no shared transaction is required between moderation and the bet wrapper, consistent with ADR-0013 §8 moderation-unaware-wrapper discipline); Sentry observability under ADR-0007 §4 alarm 4 with three event tags (`openai_moderation_upstream_failure`, `openai_moderation_auth_failure`, `photodna_upstream_failure`) plus per-attempt breadcrumbs mirroring ADR-0013 §5; Track A degrade mode named (HARDEN.5 trigger) — if sample-content testing surfaces unacceptably high false-positive rates, Track A degrades to flag-only with manual admin ban via F-ADMIN-4, with the legal-floor CSAM auto-report unaffected by the degrade; fail-closed posture on legal-floor grounds per SPEC.1 §16.5 (mirrors SPEC.2 §11's idempotency-fails-closed posture, NOT the rate-limit-fails-open posture). Cross-references absorbed: §10 stub fully rewritten substantively (vendor selection + Server Action sequence + Redis reservation key shape + OpenAI call shape + PhotoDNA parallel-call + verdict aggregation + F-MOD-4 atomicity mechanism + Track A degrade mode + fail-closed posture + single-source-of-truth file path `src/server/moderation/precommit.ts` named); §11 stub touched at outline level to name the moderation-fails-closed posture explicitly (mirrors idempotency, distinguishes from rate-limit which fails open); §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §15 (Error Code Envelope Shape) absorbs three new error codes minted by ADR-0014 — `moderation_in_flight` (HTTP 409, `error_type: conflict`, `Retry-After: 2`), `moderation_unavailable` (HTTP 503, `error_type: temporary_unavailable`, `Retry-After: 5`), and the existing `comment_track_a_blocked` / `comment_track_b_under_review` from SPEC.1 §8 — when `error-codes.md` is drafted; §18 (Observability Contract) absorbs the three Sentry event tags at the §18 drafting pass; Appendix A (Single-Source-of-Truth File Map) absorbs three new file-map rows on its drafting pass — `src/server/moderation/precommit.ts` (the `precommitModerate()` function and Server Action sequence), `src/server/moderation/openai.ts` (OpenAI HTTP client wrapper), `src/server/moderation/photodna.ts` (PhotoDNA HTTP client wrapper, called from precommit.ts; vendor onboarding owned by SCAFFOLD.16). SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.5.0-draft → v1.6.0-draft (§0 version bump + §17 six new `moderation::*` acceptance-test rows + §20 change log). Tracker (zugzwang_experiment_tracker_v5.html) correction flagged for application: SPEC.15 description currently ends with "Image moderation vendor (Rekognition / Sightengine / Hive) per separate decision" — stale because ADR-0014 resolved this as **decide, not defer**. Suggested replacement: "ADR 0014 — Pre-commit moderation flow (D7). OpenAI `omni-moderation-latest` (snapshot-pinned `omni-moderation-2024-09-26`) for text and multimodal classification, PhotoDNA-or-equivalent for CSAM hash matching, called BEFORE opening the bet handler transaction (per SPEC.14), guarded by a 10-second Redis SETNX intent-reservation key on `(user_id, market_id, idempotency_key)`. Prevents holding a Postgres transaction open across the OpenAI call. On reservation collision: return 409 `moderation_in_flight` with `Retry-After: 2`. On moderation pass: proceed to transaction. On Track A / Track B verdict: write `mod_actions` row in a standalone short transaction, return F-MOD response per SPEC.1 §14, bet+comment never persisted. One retry on transient upstream failure (3-second timeout per attempt); fail-closed on terminal failure (HTTP 503 `moderation_unavailable` with `Retry-After: 5`)." ENGINE.8 (bet flow API, dependency on SPEC.15) and SCAFFOLD.16 (PhotoDNA onboarding deliverable, dependency on SPEC.15 + SPEC.6) now unblocked from the SPEC.15 gating dependency. HARDEN.5 (sample-content testing) consumes ADR-0014's accuracy-first posture, the Track A degrade-mode trigger, and the threshold-tuning deliverable for SPEC.1 Appendix B. |
| v0.1-outline | 2026-05-08 | HMH | ADR-0016 (SPEC.17) accepted as **ID schema (UUIDv7)**. Six implementation primitives ratified across six dimensions. **D1 substrate:** userspace `public.uuidv7()` PL/pgSQL function shipped as a hand-written raw SQL migration in the Drizzle migration set at `drizzle/migrations/<NNNN>_uuidv7_function.sql`, adapted from the kjmph gist's pure-SQL variant (RFC 9562 compliant; endorsed by Supabase staff in discussion #9500 as the recommended PL/pgSQL workaround on Postgres 17). PG 18 native `uuidv7()` rejected as v1 substrate because Supabase has not shipped PG 18 as of 2026-05-08 (latest platform release `supabase/postgres:17.6.1.107-x-6-x86`, 29 Apr 2026; original Q1 2026 target slipped without new committed date per discussion #42681); `pg_uuidv7` C extension rejected because it is not on Supabase's allowlist on any plan tier (three open requests #22015, #22584, #9500 unactioned for over two years); `gen_random_uuid()` (UUIDv4) rejected because ADR-0005 already named `events.event_id` as UUIDv7 and a v4-elsewhere fork would either contradict ADR-0005 or require a special carve-out. **D2 function name:** `public.uuidv7()` — no namespace prefix, matches PG 18's built-in name verbatim. PG 18 cutover migration is one DDL statement (`DROP FUNCTION public.uuidv7()`); zero default-expression rewrites across the §5 inventory. The `zugzwang_uuidv7()` namespace alternative rejected as imposing seventeen `ALTER TABLE … SET DEFAULT` statements at PG 18 cutover for negligible readability gain. **D3 default expression:** DB-side `default(sql\`uuidv7()\`)` for every PK column in the §5 inventory. Emits `DEFAULT uuidv7()` in generated DDL; raw-SQL inserts (events insert helper per ADR-0005, ETL during HARDEN.* operations, manual `psql` writes) get a correct PK without app-layer participation. Drizzle's `$defaultFn(() => uuidv7())` rejected as invisible to drizzle-kit-emitted DDL (per Drizzle docs: "value does not affect the drizzle-kit behavior"). **D4 Better Auth full override:** all four Better Auth tables (`user`, `session`, `account`, `verification`) carry the schema-uniform `uuid` PK; Better Auth's default 32-character base62 random string format overridden via `advanced.database.generateId: () => uuidv7()` in `src/server/auth/index.ts` (single source of truth per ADR-0004); column types in `src/db/schema/auth.ts` flipped from `TEXT` to `uuid`. The `session.token` field (separate 32-char session-cookie value) is untouched. Hand-rolled `admin_sessions` table per ADR-0010 carries the same default as every other table (no carve-out). Partial carve-out (`user` + `account` UUIDv7, `session` + `verification` TEXT) and full carve-out (all four Better Auth tables stay TEXT) both rejected on schema-uniformity grounds. **D5 `identity_pool` PK shape:** synthetic UUIDv7 `id` PK + `UNIQUE (colour, animal, number)` enforcing natural-triple uniqueness as a separate constraint. Composite natural-triple PK rejected as breaking schema uniformity for one table at a 16-byte × 50K = 800 kB storage saving (negligible). **D6 URL-exposure rule:** raw UUIDs forbidden on participant-facing routes (pseudonyms per ADR-0011 are the URL-exposed identifier on every user-routed page); allowed on admin-only routes (per F-AUTH-ADMIN structural separation per ADR-0010); allowed in the 2026-11-06 dataset release (per SPEC.1 §12.2). Forbidden-everywhere-except-dataset rejected as hostile to admin operations; no-rule rejected as weakening ADR-0011's pseudonym trust model. Per-backend monotonicity caveat documented in ADR-0016 §Consequences/Negative as a constraint downstream code MUST NOT violate: PG 18's native `uuidv7()` and the userspace fallback both guarantee strict monotonicity per backend process only, NOT across the Supavisor pool (per ADR-0006 transaction-pooling mode); SCAFFOLD.2 / ENGINE.* MUST sort by `created_at` for any cross-row chronological ordering and MUST NOT assume `id(N+1) > id(N)`. Cross-references absorbed: §17 (Identifiers shape) stub fully rewritten substantively (substrate + function name + Drizzle column declaration + Better Auth full override + `identity_pool` shape + URL-exposure rule + per-backend monotonicity caveat + single-source-of-truth file map); §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §5 (Table Inventory) absorbs the universal `uuid().primaryKey().default(sql\`uuidv7()\`)` declaration discipline + the four Better Auth column-type overrides + `identity_pool` synthetic-PK + UNIQUE-natural-triple at the §5 drafting pass; §14 (Invariant Contract) is unaffected — ADR-0016 mints no new SPEC.1 invariant; §15 (Error Code Envelope Shape) is unaffected — ADR-0016 mints no new error codes (the URL-exposure rule is enforced as code discipline + acceptance test, not as a runtime error envelope); Appendix A (Single-Source-of-Truth File Map) absorbs four new file-map rows on its drafting pass — `drizzle/migrations/<NNNN>_uuidv7_function.sql` (PL/pgSQL function), `src/server/auth/index.ts` (Better Auth `generateId` override; row already covered by ADR-0004's deferred Appendix A absorption — extend that row's description to include the override), `src/db/schema/auth.ts` (Better Auth column-type overrides; row already covered by ADR-0008's deferred Appendix A absorption), `tests/server/identity/no-raw-uuid-in-urls.test.ts` (URL-exposure-rule acceptance-test helper). SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.7.0-draft → v1.8.0-draft (§0 version bump + §17 five new acceptance-test rows under the `id::*` family — `id::uuidv7-monotonic-within-millisecond`, `id::uuidv7-time-prefix-extractable`, `id::uuidv7-rfc9562-compliant`, `id::uuidv7-no-collision-under-load`, `id::raw-uuid-not-in-participant-urls` + §20 change log). Tracker (zugzwang_experiment_tracker_v5.html): no SPEC.17 description correction needed — current entry accurately describes ADR-0016 scope. Future-consideration flagged (does NOT block this absorption; tracked for a later cleanup pass): ADR-0015 §Decision Outcome ¶"Idempotency contract — header, key shape, storage" includes the non-normative client recommendation "UUIDv4 today; UUIDv7 once ADR-0016 lands and a client-side helper exists" — ADR-0016 is now accepted and the client-side helper (`import { v7 as uuidv7 } from "uuid"`) exists; the recommendation may be flipped to "UUIDv7 via the npm `uuid` package's `v7` export" on a later ADR-0015 errata-only update pass. ADR-0015's substrate decision is unaffected. SCAFFOLD.2 (Postgres + Drizzle + event-sourced schema) is the implementation task that consumes ADR-0016; every Drizzle table definition under `src/db/schema/` and the Better Auth schema overrides at `src/db/schema/auth.ts` consume the column-type and default-expression contract locked here. SPEC.17 is the last ADR before SPEC.8 fresh-session review. |
| v0.2-draft | 2026-05-08 | HMH | **PRECURSOR.2-B close-out — §3 + §4 substantively absorbed; §16 (K_eff Dashboard Data Flow Contract) struck and §17–§24 renumbered to §16–§23; D3 carve-out ratified for bet endpoints; Next.js minimum-version pin ≥ 16.2.5 added.** §3 (Data Flows) drafted at absorbed-section density: cross-cutting handler stack (seven-step contract: auth → idempotency-validate → cache-lookup → rate-limit → moderation → handler body → events-row); three write-flow patterns W-1 (bet) / W-2 (comment) / W-3 (resolution) each with named lock order and SST file path; three read-flow patterns R-1 (uncached server-rendered) / R-2 (`'use cache'` opt-in for market list + leaderboard public profile cards) / R-3 (authenticated reads); two async-flow patterns A-1 (pg_cron, three jobs in v1) / A-2 (Vercel Cron HTTP-fanout, single R2 orphan sweep carve-out); auth + signup data flow special case (session-deferral hook + identity_pool consumption transaction + ToS acceptance transaction); resolution data flow special case (admin-actor batch settlement, `metadata.user_id IS NULL` + `actor_id = 'admin-singleton'` shape); events-row contract per ADR-0005 Pattern A. §4 (API Surface) drafted at absorbed-section density: surface principle (Server Actions default per ADR-0003 §Primitive 4; bet endpoints F-BET-1/2/3 carved out to Route Handlers because Server Actions cannot read custom HTTP headers from the client per Q1 research — May 2026 Next.js 16.2.x docs + Discussion #74255); six surface families F1–F6; sixteen Server Actions catalogue with file paths + invocation surfaces + SPEC.1 F-* mapping; nine Route Handlers catalogue with method + path + auth + idempotency-key column; request/response envelope (JSON `{ok: true, data}` / `{ok: false, error}` for Route Handlers, discriminated union with `field_errors` for Server Actions); auth contract per surface (cookie-name discipline, CVE-2025-29927 defense-in-depth at handler boundary); rate-limit class per surface (cross-references §11's per-surface table, defers numeric values to HARDEN.6); versioning + URL discipline (no `/api/v1/*` prefix in v1 — codebase archives 2026-11-08; raw UUIDs forbidden on participant routes per ADR-0016). **K_eff Dashboard sweep** — per Hrishikesh's "strike entirely" call (PRECURSOR.2-B chat 2026-05-08): SPEC.2 §16 (K_eff Dashboard Data Flow Contract) struck entirely; §17–§24 renumbered down to §16–§23 (so §17 Identifiers becomes §16, §18 Observability becomes §17, §19 Sybil & Security becomes §18, §20 Public Dataset Export becomes §19, §21 Conclusion-Event Freeze becomes §20, §22 Operational Runbook Pointers becomes §21, §23 ADR Index becomes §22, §24 Tracker Task Gating Map becomes §23); §5 stub line "plus the materialised view `k_eff_dashboard`" struck from the table inventory; §7 stub line "Asynchronous targets: only `k_eff_dashboard` materialised view (refreshed `CONCURRENTLY` by `pg_cron` per ADR-0007)" replaced with "Asynchronous targets: none in v1 — every state-mutating data flow updates its read-models synchronously inside the originating transaction"; §20 (was §21) Conclusion-Event Freeze body line "the K_eff dashboard remains live" replaced with "all read endpoints remain live (per SPEC.1 §12.1's read-only mode contract)". Internal cross-references updated: §17 (Identifiers absorbed body) self-references "SPEC.2 §17" updated to "SPEC.2 §16" in two places; §3.3 + §3.4 prose internal cross-refs to §22 (cron schedule register) updated to §21. **D3 carve-out ratified.** Per the kickoff D3 + Q1 research findings (Vercel/Next.js Discussion #74255 maintainer answer "there is no way to set a custom header for a server action in the client" — unchanged through Next.js 16.2.6 docs as of May 7, 2026): bet endpoints F-BET-1 / F-BET-2 / F-BET-3 implemented as Route Handlers (`POST /api/bets/place`, `POST /api/bets/sell`) because the `Idempotency-Key` HTTP header surface is the request-level contract per ADR-0015 and Server Actions cannot natively expose this surface to clients. F-AUTH-ADMIN stays a Server Action behind `/admin/login` per ADR-0010 (no HTTP-header-shaped contract surface to honor). Trade-offs absorbed: bet Route Handlers lose Server Actions' built-in CSRF defense → file `src/server/bets/origin-check.ts` minted as the explicit Origin allowlist enforcer, allowlist read from `ALLOWED_ORIGINS` env var. **Next.js minimum-version pin.** Per the Q2 research findings (multiple security-relevant patches landed in 16.2.x): Next.js MUST be pinned at ≥ 16.2.5 in `package.json` to bring in the `maxPostponedStateSize` DoS patch (CVE-2026-27979), the streaming-fetch-hang fix, and the `http-proxy` CVE patch (CVE-2026-29057). Named in §3.3 build-version pin paragraph; ADR-0003's framework version pin lives in `package.json` (the section reference is the operational floor). One API-shape delta absorbed: `revalidateTag(tag)` (single argument) is deprecated in Next.js 16.x; supported signature is the two-argument form `revalidateTag(tag, 'max')` (SWR-style invalidation) or `revalidateTag(tag, { expire: 0 })` (immediate invalidation). **Negative-space directives named explicitly:** `'use cache: remote'` (Redis-backed handler — irrelevant on Vercel single-region per ADR-0006) and `'use cache: private'` (per-user browser-memory cache — provides no shared-cache benefit for our workload) explicitly NOT used in v1; surfacing pre-empts the next architect question and makes the negative-space decision auditable. **ADR-0003 same-commit patches** (bundled with this v0.2-draft per Hrishikesh's ratification): ADR-0003 §6 Primitive 6 description "The K_eff dashboard, market list, and public profile surfaces use this opt-in" → "The market list and public profile surfaces use this opt-in" (named twice — primitive description + Positive Consequences); ADR-0003 Flow & invariant constraints absorbed table row pointing at SPEC.2 §16 K_eff dashboard struck and replaced with row pointing at SPEC.2 §3.3 Pattern R-2. Tracker (zugzwang_experiment_tracker_v6.html): PRECURSOR.2-B row marked Done; PRECURSOR.3 unblocked. SPEC.1 back-pressure: none — SPEC.1 v1.8.0 anchor untouched. Forward path: PRECURSOR.3 (operational tail: §5–§8, §12–§15, §17–§23, appendices) → PRECURSOR.4 (fresh-session lock review, promotes both SPEC.1 + SPEC.2 to v1.0) → PRECURSOR.5 (CLAUDE.md + AGENTS.md sweep against locked v1.0 specs). |
| v0.1-outline | 2026-05-07 | HMH | ADR-0015 (SPEC.16) accepted as **Rate-limit & idempotency contract**. Seven implementation primitives ratified across seven dimensions. **D1 substrate:** Redis SETNX-with-pending-sentinel on Upstash with two-tier TTL — 30-second pending sentinel sized for ADR-0014's 10-second moderation reservation worst case + ADR-0013's bet-transaction worst case (~600ms upper) + slack; 24-hour outer TTL for completed-response replay matching Stripe's published contract. Postgres-native option (Brandur Leach's `INSERT … ON CONFLICT DO NOTHING` pattern at https://brandur.org/idempotency-keys, which ADR-0013 §3 + Consequences had flagged as a viable alternative) considered and rejected for v1, flagged as future-consideration for testnet+ when Dharma becomes a real economic asset and durability concerns shift. **D2 body-mismatch HTTP status code:** HTTP 409 with `error_idempotency_key_reused` per RFC 9110 §15.5.10 + Brandur Leach + IETF httpapi WG `draft-ietf-httpapi-idempotency-key-header-07` (Jena, Dalal, Oct 2025; expired Apr 2026 with revision in flight at https://github.com/ietf-wg-httpapi/idempotency). Stripe's HTTP 400 with `code: idempotency_error` rejected as semantically wrong — body is valid; the conflict is with prior request state. HTTP 422 already excluded by ADR-0013 §3. **D3 in-flight collision response:** HTTP 409 with `error_idempotency_in_flight + Retry-After: 2` mirroring §10 / ADR-0014's moderation-reservation-collision shape verbatim — asymmetric retry-afters across two structurally-similar primitives in the same handler would just confuse client implementations. **D4 idempotency-key scoping:** global (Brandur + IETF) — key matched on the key value alone, regardless of HTTP method or path. Stripe's per-endpoint `(method, path, key)` discriminator rejected as redundant given the body-fingerprint check (D5) and as defeating the point of one-key-per-logical-operation. **D5 body-fingerprint discipline:** SHA-256 of canonical-JSON full request body per RFC 8785 — JSON Canonicalization Scheme (sorted keys, no insignificant whitespace, UTF-8), hex-encoded. Per-endpoint subset-of-meaningful-fields rejected as a maintenance footgun (a new field added later silently widens the equivalence class); no-fingerprint rejected as defeating the purpose of idempotency replay. **D6 rate-limit window algorithm:** sliding-window via `@upstash/ratelimit` v2.0.8's `Ratelimit.slidingWindow(maxRequests, durationLiteral)` for every surface — window duration matches the SPEC.1 §16.1 constant's named window. Fixed-window rejected for edge-of-window doubling at boundaries; token-bucket rejected as wrong semantics for anti-abuse caps (these aren't productive bursts where token-bucket's refill semantics shine). The `dynamicLimits` flag added to `@upstash/ratelimit` in Jan 2026 noted as future-consideration but not adopted in v1. **D7 new Appendix B constants:** mint both `BET_ATTEMPTS_PER_IP_PER_MIN` (per-IP anti-abuse burst on bet `place`/`sell` — SPEC.1 §16.1 explicitly exempts bets from the per-day per-market productive cap by design but the anti-abuse cap is a separate concern; without this, a single compromised account hammers the bet endpoint at network speed) and `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` (per-IP anti-abuse burst on R2 signed-PUT URL mint — the URL-mint endpoint can be hit independently of comment posting and needs its own anti-abuse cap), values deferred to HARDEN.6 per the project-wide number-tuning rule. Single-key-encoding-both-states pattern ratified: one Redis key per idempotency-key encodes both the pending sentinel (with body fingerprint) and the completed payload (`{ status, body, body_fingerprint }`); atomic transition pending → completed is `SET` without `NX`, Redis-guaranteed atomic. Five-step in-handler call sequence ratified for every state-mutating endpoint: auth gate → idempotency-key validation → idempotency cache lookup → rate-limit check → handler body (pre-commit moderation step is bet-flow-specific; cache write under outer TTL is universal). Three failure-mode postures ratified across three concerns: rate-limit fails OPEN on Upstash unreachable (admit request + Sentry alarm 6 emit tagged `upstash_unavailable_rate_limit`); idempotency fails CLOSED on Upstash unreachable (HTTP 503 `error_idempotency_unavailable + Retry-After: 5` + alarm 6 emit tagged `upstash_unavailable_idempotency`); pre-commit moderation fails CLOSED per §10 / ADR-0014 on legal-floor grounds. Cached error responses include 429s — a request that hits rate-limit is cached under its idempotency-key; subsequent retries with the same key return the cached 429, NOT a fresh execution (matches Stripe + IETF). No server-side retry on state-mutating endpoints — single Upstash failure surfaces directly to the client; client owns retry policy. Cross-references absorbed: §9 (Concurrency & Transactions) idempotency-cache forward-reference paragraph tightened — substance moved to §11, leaving §9 with a one-paragraph pointer naming the substrate, scoping, fingerprint, two-tier TTL, body-mismatch envelope, and in-flight-collision envelope; §11 (Rate-Limit & Idempotency Contract) stub fully rewritten substantively — per-surface rate-limit table (7 rows, 5 existing + 2 new), idempotency contract (header + key shape + storage), single-key-encoding-both-states pattern, five-step in-handler call sequence, failure-mode contract (three concerns / three postures), cached-error-responses-include-429s rule, no-server-side-retry rule, distinction from §10's moderation reservation (disjoint key spaces on shared substrate), single-source-of-truth file map; §23 ADR Index status flipped to `accepted` with date. Substantive stub absorption deferred to dedicated drafting chats: §15 (Error Code Envelope Shape) is unchanged at envelope-level — ADR-0015 mints six new error codes for the `error-codes.md` codes-list when that file is drafted: `error_idempotency_key_required` (HTTP 400, `error_type: validation_error`), `error_idempotency_key_invalid` (HTTP 400, `error_type: validation_error`), `error_idempotency_key_reused` (HTTP 409, `error_type: conflict`), `error_idempotency_in_flight` (HTTP 409, `error_type: conflict`, `Retry-After: 2`), `error_idempotency_unavailable` (HTTP 503, `error_type: temporary_unavailable`, `Retry-After: 5`), `error_rate_limit_exceeded` (HTTP 429, `error_type: rate_limited`, `Retry-After: <derived from Ratelimit.limit().reset>`); §18 (Observability Contract) absorbs two new Sentry event tags under ADR-0007 §4 alarm 6 at the §18 drafting pass — `upstash_unavailable_rate_limit` and `upstash_unavailable_idempotency`; Appendix A (Single-Source-of-Truth File Map) absorbs three new file-map rows on its drafting pass — `src/server/middleware/rate-limit.ts` (rate-limit middleware), `src/server/idempotency/cache.ts` (idempotency cache helper), `src/server/idempotency/types.ts` (constants and error-envelope codes); the two new Appendix B constants land in `src/server/config/limits.ts` alongside the existing five §16.1 constants per SCAFFOLD.4. **Errata correction in this commit:** §2.2 RESOLVED block reference to a "60-second Redis intent-reservation key" corrected to "10-second" — ADR-0014 §3 explicitly rejected the original 60-second value as 10× over-sized against the ratified 5–10 second submit budget and ratified 10 seconds; this RESOLVED block was written before ADR-0014 made that correction and was missed in the ADR-0014 absorption pass. SPEC.1 back-pressure absorbed in same commit: SPEC.1 v1.6.0-draft → v1.7.0-draft (§0 version bump + §16.1 two new constants `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` + §17 twelve new acceptance-test rows covering idempotency cache states (cache hit, cache miss, body mismatch, in-flight collision, pending TTL, completed TTL, cached error envelopes), fail-closed-on-Upstash-unreachable, fail-open-on-Upstash-unreachable, two new rate-limit surfaces (bet-IP, image-put-IP), OTP per-IP burst (filling existing gap) + §20 change log + Appendix B two new TBD entries). Tracker (zugzwang_experiment_tracker_v5.html) corrections flagged for application: SPEC.16 description currently says "Stripe-style idempotency keys via Redis hash with 24-hour TTL using SETNX-with-pending-sentinel pattern" — substrate-level accurate but predates ADR-0015's specific decisions on global scoping, RFC 8785 fingerprint discipline, and HTTP 409 (not 400) for body-mismatch. Suggested replacement: "ADR 0015 — Rate-limit & idempotency (D8). Per-surface sliding-window rate limits via `@upstash/ratelimit` (auth, bet, comment, image-upload, plus two new anti-abuse surfaces for bet and image-PUT-URL). Stripe-style idempotency keys with global scoping, RFC 8785 canonical-JSON full-body SHA-256 fingerprint, two-tier TTL (30-second pending sentinel + 24-hour completed-response replay), HTTP 409 with `error_idempotency_key_reused` for body-mismatch, HTTP 409 with `error_idempotency_in_flight + Retry-After: 2` for in-flight collision (mirrors moderation-reservation-collision shape from ADR-0014). Failure modes: fail-OPEN for rate-limit (Upstash unreachable → allow + alarm 6); fail-CLOSED for idempotency (Upstash unreachable → 503 `error_idempotency_unavailable + Retry-After: 5` + alarm 6). Two new Appendix B constants minted: `BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`. Per SPEC.1 §16 operational floor." Additional tracker erratum (deferred to a separate cleanup pass; does NOT block this absorption): ADR-0006 §3 line 89 references "pre-commit moderation 60-second intent-reservation key (per ADR-0014)" — stale 60-second figure for the same reason as the §2.2 fix in this commit; flagged for application as an ADR-0006 errata-only update on a later cleanup pass (does NOT require re-ADR; ADR-0006's substrate decision is unaffected). SCAFFOLD.4 (Upstash Redis rate limits + job queue + idempotency), ENGINE.7 (bet transaction primitive), ENGINE.8 (bet flow API), DEBATE.2 (comment schema + post / reply / image API), DEBATE.6 (friendly-fire vote / clear / freeze) all unblocked from the SPEC.16 gating dependency. |
| v0.3.1-draft | 2026-05-15 | HMH | **SCAFFOLD.4 absorption — §11 prose tightening (Q4 ratification).** §11 ¶"Single-key-encoding-both-states pattern" gains one new sentence after the pending-sentinel paragraph: a body-fingerprint mismatch against a still-pending sentinel returns the in-flight collision shape (HTTP 409 `error_idempotency_in_flight + Retry-After: 2`), NOT the completed-mismatch shape (`error_idempotency_key_reused`). Surfacing two different errors mid-flight would confuse client retry policy, and the still-pending request may yet complete with a body that matches the eventual retry. Per Q4 resolution at SCAFFOLD.4 plan review (Web Claude sign-off 2026-05-15) — disambiguation only, not an ADR-0015 erratum (D2/D3 already ratified the in-flight + body-mismatch shapes, §11 just under-specified their intersection). §22.1 ADR-0015 row status unchanged (`accepted 2026-05-07`). SCAFFOLD.4 source PR (substrate implementation: `src/server/{config,idempotency,middleware,upstash}/`) lands on the same branch with this absorption. |
| v0.3-draft | 2026-05-09 | HMH | **PRECURSOR.3 close — six-cluster operational-tail absorption (3-A through 3-F).** §5 + §6 + §7 v0.3-draft body absorbed at 3-A (R1–R4 ratified: `accounts` as fourth Better Auth table; seven-field `events.metadata` set per §3.7 canonical lock; SPEC.1-side stale `daily_allowance_events` references deferred to PRECURSOR.4). §8 + §12 v0.3-draft body absorbed at 3-B (§8-R1–R4 + §12-R1–R5 ratified; **§12-R1 Option B**: `image_uploads` joins Bucket B with two-column atomic transition `terminal_state` + `terminal_at`). §13 + §14 + §15 v0.3-draft body authored at 3-C (40-flow F-* gating-task inventory across 7 prefix families; six-field flow-contract template with read-flow degenerate-Invariants variant; four-row INV mechanism table with two-test-layer split unit-vs-integration; six-field error envelope with closed 9-value `error_type` + 3-value `retry_semantics` enums; rate-limit code drift to `error_rate_limit_exceeded` flagged for PRECURSOR.4; tracker-description drift on DEBATE.4 / SCAFFOLD.3 / SCAFFOLD.13 / SCAFFOLD.4 flagged for PRECURSOR.5). §17 + §18 v0.3-draft body authored at 3-D (R1–R5 + A1–A5 + B1–B5 ratified; six-alarm catalogue with master table + alarm-6 sub-table at 5 sub-IDs `6a`–`6e`; PostHog `useFlag(name, defaultValue): boolean` runtime contract with safe-`defaultValue` per-call-site discipline; fail-open posture symmetric across observability surfaces; six-property admin/participant structural-separation-by-data-model construction; **cross-reference repointing patches at §3.7 / §7 / §10 / §11 from "ADR-0007 §4 alarm N" to "§17 alarm N" applied this commit**). §19 + §20 + §21 v0.3-draft body authored at 3-E (A1–A8 + drafting-time ratifications; **A1 strikes "2026-11-08" → "2026-11-05 23:59 UTC"** as the conclusion-freeze instant in §20 substance prose; export-time JOIN pseudonymization with strip-not-hash PII policy; 16-tables-shipped / 5-not-shipped dataset bucket policy per (a) reconciliation correcting 3-E baseline; **§20-1 ratifies `system_state` Bucket B membership** with `frozen_at` NULL → timestamp transition + middleware-mediated freeze + reversibility-none enforced via §6 trigger discipline; **A8 shifts §15 catalogue baseline 37 → 38 codes** with new `error_experiment_concluded` HTTP 410 `error_type: gone` row; 20-slot runbook inventory across 10 per-alarm + 5 vendor + 5 procedural). 3-F close-out cluster (this commit): full-file rewrite at v0.3-draft consolidating all six sub-chats; Appendix A mechanical extraction from per-section file maps; Appendix B per-table per-column dataset classification authoring; §22 ADR Index status flips with **ADR-0012 in-flight carve-out** (SPEC.2 v1.0 locks with ADR-0012 in flight; design.md acceptance triggers minor-version bump v1.0 → v1.1 in same commit; SCAFFOLD.* parallel-execution clearance for 12 of 19 design-independent tasks); §23 tracker-task gating map bidirectional trace; **§0 stale-field reconciliation** (Lock gate "SPEC.8 → PRECURSOR.4"; Versioning policy progression corrected to v0.1-outline → v0.2-draft → v0.3-draft → v1.0, no v1.0-draft intermediate); **Bucket B count consolidation** across 3-B + 3-E ratifications (Bucket B = 4 tables: `friendly_fire_events`, `identity_pool`, `image_uploads`, `system_state`; 13 protected tables total; §6 test floor extends from 28 to 33+ cases); **§19.3 dataset inventory count corrected from 13 + 4 to 16 + 5** per row-by-row §5.1 reconciliation; **§9 alarm-3 cite mechanically aligned to §17 catalogue** per 3-D R2 pattern (extension applied for internal consistency with §10 + §11 repoints); **§4.4 idempotency code references aligned** to ADR-0015 / §11 canonical prefixed forms. D5 same-commit ADR consumer-surface patches: NONE. PRECURSOR.4 carry-forwards: SPEC.1-side rate-limit code drift rename; error-code prefix split deliberation (bare vs `error_` prefix); admin-only flow error-code completeness deliberation; SPEC.1-side stale `daily_allowance_events` references in §2 glossary + §16.4 + tracker CONCLUDE.2; §15 catalogue cross-reference invariant mechanical check at 38 codes; ADR-0007 stale K_eff residue strike. PRECURSOR.5 carry-forwards: tracker-description drift; ADR-0013 / ADR-0014 / ADR-0015 alarm-cite consumer-surface tidy from "ADR-0007 §4 alarm N" to "SPEC.2 §17 alarm N". |
| v0.3.2-draft | 2026-05-27 | HMH | **SCAFFOLD.18 execute — §0.1 ADR-0016 row erratum.** Original tag `supabase/postgres:17.6.1.107-x-6-x86` named in the 2026-05-08 ADR-0016 absorption row did not resolve on Docker Hub — first SCAFFOLD.18 execute CI run (run id 26476831221) returned `manifest unknown` during `docker pull` at the GHA service-container init step; subsequent enumeration showed 3,936 published `supabase/postgres` tags, suffix `-x-6-x86` matches no real tag family (real arch suffixes are `_amd64` / `_arm64`; real build suffixes are `-multigres` / `-orioledb` / `-mg-1`; real one-off build is `-indata574-1`). Corrected to manifest-list form `supabase/postgres:17.6.1.107` (29 Apr 2026 release, plain tag — per-arch resolution at pull time). ADR-0016 substance unaffected: the tag was a parenthetical citation of "latest Supabase platform release" inside the rejection-rationale for PG 18 native `uuidv7()` substrate, not a load-bearing decision input — D1–D6 ratifications (UUIDv7 substrate, function name, default expression, Better Auth full override, `identity_pool` PK shape, URL-exposure rule) all unchanged. Propagation trail at original ratification: SPEC.2 §0.1 (source — the 2026-05-08 row above), SPEC.1 §20 v1.8.0-draft change-log row (cross-reference — corrected same-commit), `docs/plans/SCAFFOLD.18-postgres-ci.md` (8 hits, historical artifact untouched), `docs/logs/SCAFFOLD.18-plan-review.md` (3 hits, historical artifact untouched), `.github/workflows/ci.yml` (1 hit, corrected same-commit). Provenance of the `-x-6-x86` suffix at original ratification not recoverable from the SPEC.2 / SPEC.1 / ADR-0016 surfaces; treating as malformed/fabricated string in the ADR-0016 absorption pass. HARDEN-phase identifier-verification carry-forward flagged: pre-commit lint or CI gate that resolves named image tags + external-dependency version pins against published manifests before SPEC absorption would have caught this typo at write-time and prevented propagation across five surfaces. See `docs/logs/SCAFFOLD.18-execute.md` for full propagation-trail audit. |
| v0.3.3-draft | 2026-05-27 | HMH | **SCAFFOLD.18 execute — Path A → Path B pivot (continuation of v0.3.2-draft erratum).** After the tag-fix amend at v0.3.2-draft, CI run 26477860192 against the corrected `supabase/postgres:17.6.1.107` image surfaced the second-stage failure mode anticipated by plan §8 Risk 1: image pulls and container starts, but the Supabase entrypoint's role-bootstrap scripts fail with `psql: FATAL: password authentication failed for user "supabase_admin"` — the image is designed for Supabase CLI orchestration (`supabase start`) which provides a broader env-var ecosystem including platform-role passwords; bare `docker run -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres` triggers a partial-bootstrap with `supabase_admin` role password misalignment. Plan §8 Risk 1 documented this exact failure mode as anticipated, with Path B (vanilla `postgres:17` + CI-only exclusion of `0007_pg_cron_jobs.sql`) as the documented fallback. CI now runs against `postgres:17` (Docker Hub official manifest-list, GHA-service-container-native, no Supabase-CLI coupling). The 0007 migration is excluded at a CI step before `drizzle-kit migrate` via `rm` of the `.sql` file plus `jq` strip of the corresponding `_journal.json` manifest entry — both edits operate against the ephemeral CI-runner workdir only; committed source-control files remain immutable per ADR-0008 / AGENTS.md §6 file-level append-only invariant. Sandbox-verified pre-amend: jq filter takes 8 entries → 7 entries, top-level keys `dialect`/`entries`/`version` preserved verbatim. ADR-0016 D1–D6 substance still unaffected: Supabase's prod platform offering remains `supabase/postgres:17.6.1.107` per SPEC.1 §20 v1.8.0-draft cross-reference (the CI substrate divergence does not change the PG 18 rejection rationale that was the load-bearing point of that citation). Propagation trail at pivot: `.github/workflows/ci.yml` image swap (line 35 `supabase/postgres:17.6.1.107` → `postgres:17`) + new "Exclude pg_cron migration" step inserted before `drizzle-kit migrate`; SPEC.1 §20 line 1274 not re-touched (its claim about Supabase's prod offering remains accurate). HARDEN-phase carry-forwards flagged: (a) formalize local `supabase start` test surface for the 0007 migration (currently exercised manually per `docs/plans/SCAFFOLD.17.md` line 223 verification note); (b) image-tag manifest-resolution lint at write-time (carry-forward already flagged in v0.3.2-draft erratum row above); (c) reusable Path-B-style CI-substrate-divergence template for future vendor-image-vs-CI-runner compatibility gaps (the GHA-service-container model assumes standard postgres env-var conventions; vendor images with broader env-var ecosystems are systematically incompatible). Two CI runs preserved in the audit trail: 26476831221 (manifest-unknown on the malformed `-x-6-x86` suffix), 26477860192 (supabase_admin bootstrap auth failure on corrected tag). See `docs/logs/SCAFFOLD.18-execute.md` for full pivot rationale + both CI run logs. |
| v0.3.4-draft | 2026-05-27 | HMH | **SCAFFOLD.18 execute — surgical statement strip refinement (continuation of v0.3.3-draft pivot).** Path B initial implementation (whole-file strip of `0007_pg_cron_jobs.sql` via `rm` + `jq` journal-strip per v0.3.3-draft row above) surfaced a second-order knock-on in CI run 26478587027: 6 tests in `tests/db/identity-pool/watermark.test.ts` failed with `PostgresError: relation "watermark_state" does not exist`. Root cause: migration 0007 is mixed-concern — only 2 of its 8 statements are Supabase-coupled (line 16 `CREATE EXTENSION pg_cron WITH SCHEMA extensions;` + lines 78-82 `SELECT cron.schedule(...)`); the remaining 6 statements are vanilla-portable (the `watermark_state` and `cron_alarms` tables, the `check_identity_pool_watermark()` PL/pgSQL function, and the seed row in `watermark_state`). Whole-file strip was over-broad. Refined to a surgical statement strip via `sed -i -e '/^CREATE EXTENSION IF NOT EXISTS pg_cron/d' -e '/^SELECT cron\.schedule(/,/^);$/d' drizzle/migrations/0007_pg_cron_jobs.sql` in the CI step, replacing the prior `rm` + `jq` mechanism (the `_journal.json` no longer needs stripping because the migration file still applies, just with the 2 pg_cron-coupled statements removed). Sandbox-verified pre-amend: sed strips exactly the 2 targeted statements (1 single-line + 1 multi-line range); preserved-keyword grep returns 7 matches across `watermark_state` (3) / `cron_alarms` (3) / `check_identity_pool_watermark` (1); removed-keyword grep returns 0 for both `CREATE EXTENSION pg_cron` and `cron.schedule`. Test-level skip: test 6 (`registers the 'identity-pool-watermark' cron job exactly once`) in `tests/db/identity-pool/watermark.test.ts` gains a runtime `pg_extension` probe via `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` and calls `ctx.skip()` when pg_cron is absent. The `it.skipIf()` declarative form in the original sketch was deferred in favour of `ctx.skip()` inside the test body because vitest evaluates `it.skipIf(condition)` at collection time (before `beforeAll` runs), making it incompatible with a runtime DB probe — `ctx.skip()` runs at test execution time and observes the post-probe value. Tests 1-5 remain unconditional; they test the watermark function logic, not pg_cron itself. Net coverage: 5/6 watermark tests run in CI (function-logic assertions); test 6 (cron-registration assertion) skipped in CI with self-documenting reason, runs against real Supabase via local `supabase start`. HARDEN-phase carry-forwards refined: (a) formalize local `supabase start` test surface for the 2 stripped statements + test 6 (was already on the list); (b) image-tag manifest-resolution lint at write-time (carry-forward from v0.3.2-draft erratum row); (c) reusable Path-B-style CI-substrate-divergence template (from v0.3.3-draft erratum row); (d) NEW — surgical-vs-whole-file CI patching pattern for mixed-concern migrations (this row's contribution); (e) NEW — vitest collection-time vs runtime skip semantics documentation (this row's contribution). Three CI runs preserved in the audit trail: 26476831221 (manifest-unknown), 26477860192 (supabase_admin bootstrap), 26478587027 (watermark_state-missing knock-on). See `docs/logs/SCAFFOLD.18-execute.md` for full refinement rationale + the three CI run logs. |
| v0.4.0-draft | 2026-06-01 | HMH | **SYNC.7 — SPEC.2 rebuild: ADR-0017/0018/0019 fold + ADR-0009 supersession + RLS posture + drift reconciliation.** (1) §22 ADR Index: added ADR-0017 (ranking modes & "Top" composite — supersedes ADR-0009), ADR-0018 (Dharma issuance + asymmetric two-floor minimum bet), ADR-0019 (RLS out of scope); flipped ADR-0009 status `accepted` → `superseded` (by ADR-0017); index 14 → 17 rows (15 accepted + 1 superseded + 1 in-flight); §22.4 property 3 reworded — the prior "no minting ADR-0017 while ADR-0012 in flight" clause conflated in-flight with gap and is superseded (0017/0018/0019 minted under SYNC.4/SYNC.5; numbering stays dense, 0012 is a filled in-flight slot); §22.3 Direction-B example repointed 0009 → 0017. (2) **§22/§23 numbering reconciliation:** ADR-0017/0018/0019 + SYNC.5 + the SYNC.7 kickoff cite "§23 ADR Index," but the ADR Index has been **§22** since the PRECURSOR.2-B K_eff-dashboard strike renumbered §23 → §22 (2026-05-08 row above); the ADRs carry the stale pre-strike number — SPEC.2 §22 is canonical, edits applied there. (3) §18.5 (new) records the RLS posture per ADR-0019 — server-only Architecture 2, build skipped, decision recorded, tripwire (any client-direct DB path makes RLS mandatory before it ships), testnet revisit; prior §18.5 (Single source of truth) → §18.6; §6.5 cross-references it. (4) §1.4 #2 enriched with the `cpmm.md` authoring forward-reference (purpose, Manifold lift-and-attribute lineage MIT → AGPL, invariants, impl home, status — full authoring deferred to the cpmm.md chat per SYNC.7 scope). (5) Drift folds: "14 ADRs / 0003–0016" → "17 ADRs / 0003–0019" across §0 + §1; §23.3 + §23.4 PRECURSOR.5 → SYNC.8 (PRECURSOR.5 dissolved into SYNC.8 per tracker v11); Appendix A + B "PRECURSOR.5 column-name/file-map sweep" → PRECURSOR.4 (the lock-review verification, distinct from the CLAUDE/AGENTS rebuild). (6) **Full removal of friendly-fire + `stake_at_post_time` (replaces the earlier annotate-not-rewrite pass).** Per SPEC.1 v1.9.0-draft + ADR-0017 (sharpened SYNC.7): the standalone friendly-fire vote is gone entirely. `friendly_fire_events` (table + Bucket-B trigger + the F-COMMENT-6/7/8 `castFriendlyFire`/`clearFriendlyFire` Server Actions) and `comments.stake_at_post_time` are **struck from the schema and from every operational reference** — §5.1 (inventory: row dropped, renumbered; counts 23→22 tables / Bucket B 4→3 / protected 13→12), §5.2, §5.4 (rewritten to the four read-time per-side reply-bet aggregates), §5.5 (audit-trace bullet added), §6.3, §7.4/§7.5, §9 lock-order (`pools → positions → dharma_ledger → events`; `friendly_fire_events` removed), §11 (comment+friendly-fire budget removed), §13.3, §18.2/§18.4, §19.3/§19.5, Appendix A (file-map rows removed) + Appendix B (B.6 column dropped, B.8 deleted + renumbered). (7) **Reply-as-bet write-path rework.** Per SPEC.1 v1.9.0-draft §7/§8 + ADR-0017/0018: every comment rides a bet (post-bet = top-level, post floor; reply-bet = `parent_comment_id`, reply floor 50); the only comment-free write is the sell (F-BET-3). The old W-2 "comment, no pool lock" pattern is **retired** — comment/reply writes are bets that take the pool-row lock and run the §9 W-1 chain. Folded: §3.1 (moderation-skip set = sells only), §3.2 (W-2 retired into the bet flow; pattern table repointed), §9 (chain covers comment-bearing bets), §10 (moderation runs on every comment-bearing bet), §11 (posts/replies use the bet anti-abuse posture; **open question recorded** — whether reply-bets carry a per-market productive cap distinct from top-level bets, deferred to §11 + the number-tuning pass per SPEC.1 §8), §13.3 (F-COMMENT-1/2/3 reclassified as bet-flows; F-COMMENT-6/7/8 rows removed; 40→37 F-* files), §14 (INV-1 binds **every** bet; `comments.bet_id` NOT NULL; INV-3 mechanism moved off the retired W-2 onto the bet transaction). Per-flow `F-*.md` contract files stay deferred to their gating ENGINE.*/DEBATE.* tasks per §13.4. (8) **Two-floor minimum bet, Daily Credit, marker.** `BET_MIN_STAKE_POST` (ranged) + `BET_MIN_STAKE_REPLY` (50 pinned) referenced as bet write-path checks (constants SPEC.1 §16.1-owned per ADR-0018); "Daily Allowance" → **Daily Credit** as the concept/rule (accrual now conditional — paid only on a UTC day with a commented bet, use-or-lose) — **DB identifiers retained** per SPEC.1 §10.4 (`dharma_ledger` source tag stays `daily_allowance`; cursor stays `users.last_allowance_accrued_at`; the `daily_allowance_events` dropped-table note in §5.5 stands); three-state marker → **Flipped/Exited** ("In" dropped). NOT changed: ADR substance (0017/0018/0019 unmodified — note ADR-0017's body still says friendly-fire "stays display-only," now contradicted by both specs; a later in-place ADR-0017 patch reconciles it, flagged §5.5 + §23.3); CLAUDE.md/AGENTS.md (SYNC.8); no v1.0 promotion (PRECURSOR.4). New-ADR status recorded `accepted` (2026-06-01, founder ratification); ADR file headers flip `proposed` → `accepted` at SYNC.BACKFILL. |
| 1.0.0 | 2026-06-03 | HMH | **PRECURSOR.4 v1.0 lock.** Promotes SPEC.2 v0.4.0-draft → 1.0.0 (paired with SPEC.1 → 1.0.0). **§0** version → 1.0.0, date → 2026-06-03. **§5.1/§5.3/§5/§23** schema census reconciled — "nine domains" → "ten domains" (four sites); §5 single-source row → "ten domain files". **§6** "eight Bucket C tables" → "ten" (9 Bucket A + 3 Bucket B + 10 Bucket C = 22). **§19.3** header reconciled to the 22-table model: twenty dataset-relevant (the two pg_cron operational tables `watermark_state` + `cron_alarms` excluded entirely); fifteen ship / five do not (table + post-table summary already correct). **§19.1 / §19.7 / §19 deferred-items row** dataset licence resolved → **CC-BY-4.0** (paired with SPEC.1 §12.2). **§19.4 + Appendix B.1** PII inventory extended — `users.name` + `users.image` added as STRIP (eight → ten PII columns; STRIP count 7 → 9); Appendix B.1 also adds `email_verified` (SHIP) + `updated_at` (SHIP) to match the built `users` schema; `pfp_filename` NULL_IF_ERASED nuance preserved. **§15** §15.4 named the canonical 38-code catalogue at v1.0; `docs/specs/error-codes.md` + the §15.5 cross-reference CI lint marked forward deliverables (ENGINE error-envelope / HARDEN-phase), not v1.0 files; 38-code baseline unchanged. **§23** tracker filename `zugzwang_experiment_tracker_v7.html` → `tracker_v11.html`. **Recorded conditions:** ADR-0012 remains in-flight (§22.2); admin-flow product-validation error codes remain unenumerated (F-ADMIN-* Errors blocks are placeholders — §15.4 deferred item, accepted as in-scope-but-unenumerated); the `error_`-prefix sweep across ADR prose + the error-codes.md catalogue file is forward (ENGINE) work; the built schema retains vestigial `friendly_fire_events` / `comments.stake_at_post_time` / nullable `comments.bet_id` pending DEBATE.8/9; §23 Direction-A phase-model reconciliation to tracker v11 deferred to the tracker sweep, Direction-B section coverage verified complete in this review; §15.4's 38-code baseline is the cross-cutting + folded-ADR set, and nine participant-flow product-validation codes referenced in SPEC.1 flow contracts (`insufficient_dharma`, `below_post_floor`, `opposite_side_held`, `position_not_held`, `comment_too_long`, `comment_track_a_blocked`, `comment_track_b_under_review`, `market_resolving`, `banned_user`) are accepted as in-scope-but-unenumerated (parallel to admin-flow codes), aggregated into `error-codes.md` (forward), with §15.4 carrying a scoping note to this effect. |
| 1.0.1 | 2026-06-03 | HMH | **Post-SYNC tracker sweep — §23 + §0 reconciled to tracker v11; post-lock status-prose hygiene.** No v1.0 substance reopened (patch-level editorial reconciliation completing the §23 Direction-A item the PRECURSOR.4 lock explicitly deferred to this sweep). **§23.1 Direction A** phase table rebuilt to the v11 phase model: added **SYNC** + **TESTING** rows; removed **LIVE** + **CONCLUDE** (relocated to the separate post-launch tracker per SYNC.6 — not lost); **UI → VISUAL** (DESIGN ∥ ENGINE + UI ∥ DEBATE lanes); ENGINE/DEBATE task-ID lists corrected (ENGINE.1→0; DEBATE.6 removed, DEBATE.9 added); HARDEN row corrected to HARDEN.1–6; task column rendered as ID-ranges and the running total re-pointed to the tracker (the census owner per §23.4); hard F-* file counts removed from the phase rows and re-pointed to §13.3. **§23.2 Direction B** stale task refs reconciled to v11 — `SCAFFOLD.4` (moderation→Upstash), `SCAFFOLD.5` (Upstash→Sentry), `SCAFFOLD.6` (conflated→PostHog/flags), `SCAFFOLD.18` (manifest→CI); `HARDEN.6/7/10` → the real HARDEN.1–6 set + TESTING; `CONCLUDE.*`/`LIVE.*` consumers re-pointed to build-phase tasks with post-launch build noted out-of-tracker; the "40 F-*" de-numbered to §13.3. **§23.3** the four 3-C tracker-description drifts (DEBATE.4 / SCAFFOLD.3 / SCAFFOLD.13 / SCAFFOLD.4) struck (already current in the v11 tracker); the moot "SYNC.8" routing removed; the ADR-0017-body row marked **resolved by the P1 patch (#65)**; DEBATE.6 marked removed; the friendly-fire physical-drop + `comments.bet_id`/`stake_at_post_time` retained as DEBATE.8/9-sequenced carry-forwards; the **§13.3 F-* count reconciliation re-homed to MAINT.15**. **§23.4** footer "ADRs consumed … 0003–0016" → 0003–0019. **§0** "Gates downstream" `UI.*` → `VISUAL.*`, `TESTING.*` added; top status blockquote version + stale prose reconciled to the locked state. **Not changed:** §13.3 itself (count re-homed to MAINT.15; its existing drift-note left in place); all v1.0-locked architecture substance; the spec-wide HARDEN task-ID renumber (v7 HARDEN.5/6/7/10 refs in §8.10/§10/§11/§12/§17–§21 + Appendix A) is re-homed to MAINT.16 — §23.2 states the canonical v11 mapping, propagation deferred; the external `tracker_v11.html`. Paired SPEC.1 → 1.0.1 (status-prose hygiene only). |
| 1.0.2 | 2026-06-10 | HMH | **§19.4.1 catch-up STRIP rows for engine event types — reconciliation sweep 2026-06.** Three rows appended to the §19.4.1 table for the ENGINE.8-emitted event types (`bet.placed`, `bet.sold`, `comment.placed`) — each STRIPs `payload.userId` (PSEUDO defense-in-depth, same rationale as the existing `user.signed_out` / `dharma.credited` rows); all research keys SHIP. Rows grounded against the built payload schemas (`src/server/events/schemas.ts`): `bet.sold`'s research key is `sharesSold` (the actual payload key; not `shares`); `comment.placed`'s payload carries `bodyLength`, not `body` — the comment body + `side_at_post_time` ship via the `comments` table per Appendix B.13, not via the event payload (rationale text corrected accordingly from the web-authored rider). `dharma.credited` row pre-existing (ENGINE.12) — unchanged. The six `market.*` types carry no PII-class payload keys; their rows are deferred to the emit-site stratum (ENGINE.9 / market-lifecycle) per the §19.4.1 same-commit amendment rule. No other §19.4.1 edits. **§0** version → 1.0.2, date → 2026-06-10. |

---

## §1 Purpose, Scope, and Non-Goals

### §1.1 Purpose

SPEC.2 is the **technical architecture frame** for the Zugzwang experiment-phase build. It defines the *shapes, slots, contracts, conventions, and invariant mechanisms* that downstream technical decisions and code must conform to.

SPEC.2 is **not** the substance-bearing technical document. Specific table DDL, library configs, error-code lists, cookie names, retry parameters, and migration filenames live in the **17 dependent ADRs** (`ADR-0003` to `ADR-0019`). SPEC.2 names *that there is an authentication system, that it has two parallel session paths, and that the cookie naming rule is X*; ADR-0004 (auth library) and ADR-0010 (admin auth wiring) supply the actual library, callback chain, and cookie names.

This split is the **Option B distribution**: SPEC.2 is the load-bearing frame; the ADRs are the load-bearing substance. Together, they form the complete coding contract that downstream tracker tasks (`SCAFFOLD.*`, `ENGINE.*`, `DEBATE.*`, `UI.*`, `HARDEN.*`) implement against.

### §1.2 Audience and primary reader

The primary reader of SPEC.2 + ADRs is **Claude Code** generating the experiment codebase under the writer/reviewer ritual. The secondary readers are Hrishikesh (product owner / sole engineer) and the PRECURSOR.4 fresh-session reviewer instance. SPEC.2 MUST therefore optimise for *agent experience* — scannable structure, RFC-2119 keyword discipline, named source-of-truth files, named test paths for every invariant — over narrative readability.

### §1.3 Scope (what SPEC.2 covers)

SPEC.2 owns, as a **frame document**:

- The deployment topology shape (§4 System Context).
- The complete table inventory and append-only/mutable classification (§5).
- The append-only enforcement contract and its single source-of-truth mechanism (§6).
- The events table shape and synchronous-vs-asynchronous projector classification rule (§7).
- The shape of the two parallel authentication systems (§8).
- The concurrency contract for the bet flow — SERIALIZABLE + `SELECT FOR UPDATE` + lock order + retry shape (§9, D2 ratified).
- The pre-commit moderation pattern — moderation outside the transaction, Redis intent-reservation guard (§10).
- The rate-limit and idempotency-key contract (§11).
- The file-storage contract — R2 signed PUT URLs, key pattern, orphan sweep (§12).
- The six-field flow-contract template that every `F-*` flow file MUST conform to (§13).
- The invariant contract — every SPEC.1 `INV-N` MUST have a SPEC.2-named technical mechanism and a named test file path (§14).
- The error envelope shape (Plaid-style: `error_code` × `error_type` × `http_status` × `retry_semantics`) (§15).
- The identifier contract — UUIDv7 across all primary keys; pseudonyms in URLs are a separate column (§16).
- The observability contract — every server route MUST emit named fields to Sentry and PostHog per ADR-0007 (§17).
- The sybil and security model (§18).
- The public-dataset export pipeline contract for the 2026-11-06 release (§19).
- The conclusion-event freeze contract (§20).
- The operational runbook *slots* — cron schedule, deployment, rollback, dataset release (§21, substance lives in `HARDEN.*` task outputs).
- The open-blockers register (§2 + §21 mirror).
- The ADR index (§22).
- The tracker-task gating map — which SPEC.2 section unblocks which tracker task and which `F-*` flow (§23). This makes the PRECURSOR.4 review objective.

### §1.4 Non-goals (what SPEC.2 explicitly does NOT cover)

SPEC.2 MUST NOT contain:

1. **Product behavior.** That is `SPEC.1.md` v1.0-draft. SPEC.2 references `SPEC.1 §N` for every flow it shapes; it never restates product rules.
2. **CPMM math.** That is `cpmm.md`. SPEC.2 names that the bet handler computes "CPMM share-payout per `cpmm.md`"; it does not duplicate the math.
   - **`cpmm.md` authoring forward-reference (SYNC.7).** `cpmm.md` is named as a companion but is **not yet on disk**; it is authored in its own focused chat (full authoring deferred per SYNC.7 scope, which delivered this brief in its place). The brief: **Purpose** — the CPMM math spec for the single-market-maker, fee-less, constant-product maker. **Lineage + license** — lifts Manifold's CPMM implementation (historically `common/src/calculate-cpmm.ts` + `cpmm.ts` in `manifold-markets/manifold`), rewritten for our invariants; the upstream is MIT-licensed and the lift MUST **preserve the MIT notice under our AGPL-3.0-or-later** (MIT → AGPL is permitted; attribution is mandatory). **Invariants** — Dharma conservation; `NUMERIC(38,18)` precision (per ADR-0008); fee-less single-MM (no fee term in the share/probability math); frozen-at-resolution consistency (ties to INV-4 — a resolved market's CPMM state is immutable and auditor-reproducible). **Scope boundary** — math owned in `cpmm.md`; SPEC.2 names *that* the handler calls it and does not duplicate the formula (this non-goal). **Implementation home** — `src/server/cpmm/` (greenfield, per ENGINE.2). **Status** — full authoring + a multi-source Manifold-source/license research pass are the first task of the `cpmm.md` chat (the lead technical-research item); the companion-files line and Appendix B.3 (`pools` reserves) already reference it.
3. **Ranking math.** That is `RANKING.md` (locked by **ADR-0017**, which supersedes ADR-0009). SPEC.2 names that the debate view orders comments by the ranking model; it does not duplicate the formula. (The superseded ADR-0009 single-function model is retired — see §5.4 + the §22 index.)
4. **Visual / brand system.** That is `design.md` (locked by ADR-0012 / SPEC.13). SPEC.2 references the design system but does not specify colors, typography, or component variants.
5. **Substance-level decisions delegated to dependent ADRs.** Specifically:
   - Next.js version / App Router config → ADR-0003 (SPEC.3)
   - Auth library + callback chain → ADR-0004 (SPEC.4) + ADR-0010 (SPEC.11)
   - Postgres + event-sourcing DDL + position materialisation + append-only trigger SQL → ADR-0005 (SPEC.5)
   - Hosting topology + cron schedules + R2 bucket policy → ADR-0006 (SPEC.6)
   - Observability vendor-specific configs → ADR-0007 (SPEC.7)
   - ORM choice + migration tooling → ADR-0008 (SPEC.9)
   - Pseudonym pool word lists + asset pipeline → ADR-0011 (SPEC.12)
   - Bet transaction retry policy + jitter formula + idempotency-key shape → ADR-0013 (SPEC.14) + ADR-0015 (SPEC.16)
   - OpenAI moderation + Redis reservation key shape → ADR-0014 (SPEC.15)
   - UUIDv7 implementation choice (Postgres native vs userspace) → ADR-0016 (SPEC.17)
6. **Testnet, mainnet, on-chain, smart contracts, token bridging, validator design.** Out of scope for the entire experiment phase per `CLAUDE.md` golden rule "no decisions optimising for continuity across phase boundary."
7. **Marketing copy, launch strategy, partner outreach, ETHGlobal / Devcon logistics, legal counsel selection.** Not engineering scope.
8. **Number tuning.** Specific values for daily allowance, comment length cap, per-market rate limits, etc., are deferred to the SPEC.1 number-tuning pass (per memory). SPEC.2 names *that there is a daily allowance accrual job*; SPEC.1 Appendix B holds the concrete number when it lands.
9. **Version pins of any kind** (Postgres minor version, Drizzle patch version, etc.). Pins live in `package.json` and `drizzle.config.ts`. SPEC.2 names "Postgres," not "Postgres 17.4."

### §1.5 What "perfect" means for SPEC.2

A "perfect" SPEC.2 + ADR bundle has the following properties, jointly verified by PRECURSOR.4:

1. **Coverage.** Every flow named in SPEC.1 (`F-*`) has a technical contract in `docs/specs/flows/F-*.md`. Every invariant in SPEC.1 §5 (`INV-1` through `INV-4`) has a named technical mechanism in SPEC.2 §14 + a named test file path. Every constant slot in SPEC.1 Appendix B has an owning ADR or section. Every error case in any `F-*` flow maps to a stable error code in `docs/specs/error-codes.md`.
2. **No drift.** Every claim "X is the single source of truth for concern Y" in SPEC.2 has a corresponding `docs/specs/...` or `src/server/...` file path; the file exists; CI greps SPEC.2 for these claims and fails if any path is missing.
3. **No ambiguity.** Every architectural decision is either ratified in SPEC.2 / a dependent ADR, or carried as an explicit `BLOCKER:` in §2. There is no third state.
4. **No re-entry.** Substance is named in exactly one place. A reader looking for the bet retry policy reads ADR-0013 (SPEC.14); SPEC.2 §9 references it but does not duplicate the value. SPEC.2 changes do not silently invalidate ADR substance, and ADR changes that affect SPEC.2 carry a same-commit SPEC.2 update.

---

## §2 Architectural Blockers Register

This section is the live register of all unratified architectural decisions blocking SPEC.2 from `v1.0-draft` → `v1.0` lock.

**Format:** Each blocker is a fenced block with the fields below. Claude Code MUST refuse to generate code in any flow whose blocker is unresolved (per `CLAUDE.md` golden rule).

```
BLOCKER: <short-name>
  affects:        <SPEC.2 sections + flow files + tracker tasks>
  decision-needed: <one sentence stating the open question>
  options:        <bulleted list of considered options>
  unblock-criterion: <what must be true to close this blocker>
  owner:          <decision-maker name>
  resolves-in:    <ADR file path where the decision will land>
  opened:         <YYYY-MM-DD>
```

### §2.1 Open blockers

**None as of 2026-05-05.**

The current SPEC.2 outline contains zero open architectural blockers. All ten architectural decisions surfaced by the SPEC.2 research brief (D1–D10) have been ratified or have an ADR home assigned per the hybrid slot map (see §22 ADR Index, §23 Tracker Task Gating Map).

### §2.2 Resolved blockers (historical record)

Closed blockers remain in this register as historical context. They MUST NOT be silently deleted; closure is recorded with a `RESOLVED:` block linking to the ratifying ADR. This preserves the audit trail that PRECURSOR.4 review depends on.

```
RESOLVED: D2 — Single-writer actor vs Postgres SELECT FOR UPDATE
  affected:           §9 (Concurrency & Transactions), §7 (Event Model — sync vs async projector classification),
                      §14 (Invariant Contract — lock order), ENGINE.7, ENGINE.8 (bet flow API)
  ratified-as:        Drop in-memory actor. Bet handler runs as Postgres SERIALIZABLE transaction with
                      SELECT FOR UPDATE on the pool row. Lock order: pools → positions → dharma_ledger → events.
                      Retry on SQLSTATE 40001 up to 3× with 50/100/200 ms jittered backoff. OpenAI moderation
                      moves OUTSIDE the transaction, guarded by a 10-second Redis intent-reservation key.
  resolves-in:        ADR-0013 (SPEC.14, concurrency, accepted 2026-05-07) +
                      ADR-0014 (SPEC.15, pre-commit moderation, pending)
  ratified-by:        Hrishikesh
  ratified-on:        2026-05-04
  reasoning-summary:  Manifold (the only direct functional analog) runs the bet path on a stateless write
                      API at higher volume than Zugzwang's 5k peak target. Operating an in-memory actor
                      runtime adds a second deployment surface (Fly.io / Railway) for operational cost that
                      is unnecessary at this scale. SERIALIZABLE + SELECT FOR UPDATE provides equivalent
                      correctness guarantees inside the existing Postgres deployment.
  fallback:           If post-launch measurement shows sustained hot-market write contention or function-
                      timeout pressure from OpenAI moderation latency, the documented fallback is a single
                      Fly.io worker that owns the bet handler. ADR-0013 must record this fallback explicitly
                      so it remains visible after acceptance.
```

### §2.3 Adding a new blocker

A new blocker is opened when:

1. A SPEC.2 section needs a value that isn't yet ratified, OR
2. A dependent ADR exposes a question SPEC.2 cannot answer alone, OR
3. PRECURSOR.4 review surfaces an inconsistency requiring a fresh decision.

The opener writes the `BLOCKER:` block, commits SPEC.2, and creates the ADR file referenced in `resolves-in` with status `provisional`. Code generation in affected flows pauses until ratification. On ratification, the `BLOCKER:` block is rewritten as `RESOLVED:` and moved to §2.2; the ADR status flips to `accepted`.

### §2.4 Why §2 is at the top of the doc

`BLOCKER:` markers buried mid-document are easy to skip during the PRECURSOR.4 fresh-session review and trivial for Claude Code to elide under context-window pressure. Placing the register at §2 — immediately after Purpose — guarantees the register sits in the first 200 lines of any context window the document is loaded into. Per `CLAUDE.md`, this is one of three "non-negotiable scan zones" alongside §1 Purpose and §3 Reading Guide.

---

## §3 Data Flows

§3 owns the *architectural data-movement shape* of every state-mutating and read flow in the experiment-phase build — which tables get written or read, in what transaction shape, in what lock order, against what events-log row, with what synchronous vs asynchronous read-model semantics. SPEC.1 §7–§15 owns the *product-level* per-`F-*` flow contracts (Pre / System / Response / Errors / Invariants / Acceptance); §13 (Flow Contract Template) owns the *file-level* per-flow contract files at `docs/specs/flows/F-*.md`; this §3 sits between them at the architectural-pattern layer. The discipline is strict: §3 names the patterns and the four architecturally-distinct flows that don't reduce to a pattern (bet, comment, resolution, signup); it does NOT enumerate every `F-*` flow individually. A reader who needs the per-flow Pre/System/Response goes to SPEC.1 + the flow file; a reader who needs the architectural shape stays here.

Three write-flow patterns, three read-flow patterns, two async-flow patterns, one events-row contract, one cross-cutting handler stack. Every state-mutating endpoint reduces to one of the write patterns plus the handler stack; every read endpoint reduces to one of the read patterns; every cron job reduces to one of the async patterns; every state-mutation transaction emits at least one events-row.

### §3.1 Cross-cutting handler stack

Every state-mutating endpoint — Server Action or Route Handler, participant or admin — runs through the same seven-step contract. The contract is enforced by handler-shape discipline (CI-lint flagged for HARDEN.*); no helper macro abstracts it because the seven steps interleave with handler-specific logic at known points (rate-limit returns 429s; moderation routes Track A/B; the transaction wrapper retries on 40001/40P01).

```
1. Auth gate                  — per ADR-0004 (participant) / ADR-0010 (admin)
2. Idempotency-key validation — per §11 / ADR-0015 (header for Route Handlers; arg for Server Actions)
3. Idempotency cache lookup   — per §11 / ADR-0015 (Redis SETNX + body-fingerprint match)
4. Rate-limit check           — per §11 / ADR-0015 (per-surface sliding window on Upstash)
5. Pre-commit moderation      — per §10 / ADR-0014 (every comment-bearing bet; the comment-free sell skips)
6. Handler body / transaction — per §3.2 write-flow patterns (W-1 bet/comment · W-3 resolution)
7. Events-row + response cache — per §3.7 + §11 (events.insert inside the txn; cache write outside)
```

Steps 1–4 and 7 are universal across every state-mutating endpoint; step 5 runs on every comment-bearing bet (under the v1.9.0 reply-as-bet model every post and reply carries mandatory commentary — F-BET-1, F-BET-2, F-COMMENT-1/2/3) and is skipped only by the comment-free sell F-BET-3 and the admin resolution flow per §10; step 6 takes one of the two participant/admin write-flow shapes named in §3.2 (the old comment-only shape is retired — see §3.2). The stack is the absorption surface for the three already-absorbed sections — §9 owns step 6's bet wrapper, §10 owns step 5, §11 owns steps 2–4 + step 7's cache write — §3.1 is the cross-reference that names the stack as a whole.

**Failure-mode posture across the stack**: rate-limit fails open (step 4); idempotency fails closed (step 3); pre-commit moderation fails closed (step 5); the bet transaction wrapper retries up to 3× on 40001/40P01 (step 6 for bet flow). **Two-step ordering invariant**: idempotency cache lookup MUST run BEFORE rate-limit (step 3 before step 4) so that a retry of a previously rate-limited request returns the cached 429, not a fresh rate-limit decision. This ordering is locked by §11 / ADR-0015 and is not relitigable in §3.

### §3.2 Write-flow patterns

Every state-mutating handler reduces to one of two transaction shapes (a participant bet/comment flow and an admin resolution flow; the v1.8.x comment-only shape is retired under reply-as-bet — see W-1). The shape name appears in the per-flow contract file under `docs/specs/flows/F-*.md` as `Transaction shape:` so a reader knows which §3.2 pattern applies without re-deriving it.

**Pattern W-1 — Bet flow (SERIALIZABLE + pool-row pessimistic lock).** Used by **every bet**: F-BET-1 (entry post-bet), F-BET-2 (subsequent post-bet), F-BET-3 (sell), and — because under the v1.9.0 reply-as-bet model every comment rides a bet — F-COMMENT-1 (additional post-bet), F-COMMENT-2 (reply-bet), F-COMMENT-3 (image-attached bet+comment). One Postgres transaction at SERIALIZABLE isolation; pool row locked via `SELECT … FOR NO KEY UPDATE`; canonical lock order `pools → positions → dharma_ledger → events`; full-jitter retry on bases `[50, 100, 200]` ms on SQLSTATE 40001 / 40P01. A comment-bearing bet additionally inserts the `comments` row and the `bets` row inside the same transaction (INV-1 atomic bet+comment, `bets.comment_id` + `comments.bet_id` both NOT NULL); the comment-free sell (F-BET-3) inserts no comment. The bet transaction wrapper at `src/server/bets/transaction.ts` (per §9 / ADR-0013) is the single source of truth; every bet handler invokes it.

**Pattern W-2 — Retired (reply-as-bet).** The v1.8.x "comment flow" — a standalone `comments` insert with no pool lock, used when a comment was *not* a bet — **no longer exists** in v1.9.0. Every comment now rides a bet (post-bet or reply-bet per SPEC.1 §7/§8 + ADR-0017/0018), so comment and reply writes run the W-1 bet transaction (taking the pool-row lock, moving CPMM reserves, freezing `side_at_post_time` inside the transaction). There is no comment-without-bet path; the only comment-free write is the sell (F-BET-3, still W-1). `src/server/comments/place.ts` is consequently folded into the bet write path (Appendix A).

**Pattern W-3 — Resolution flow (admin-actor batch settlement, INV-4 append-only).** Used by F-RESOLVE-1 (resolve), F-RESOLVE-2 (correction), F-RESOLVE-3 (void). One Postgres transaction at SERIALIZABLE isolation; lock order `markets → bets → payout_events → resolution_events → dharma_ledger → events`. The transaction fans out across all bets in the market in a single atomic write — typically tens to thousands of rows depending on market activity — and emits one `resolution_events` row plus one `payout_events` row per bet plus one `dharma_ledger` row per non-zero settlement plus a single terminal `events` row of `event_type = 'market.resolved' | 'market.corrected' | 'market.voided'`. The actor identity is structurally distinct: `events.metadata.user_id IS NULL` and `events.metadata.actor_id = 'admin-singleton'` (per ADR-0010 + SPEC.1 §10.1) — the admin has no `users` row, so the participant-side actor field is genuinely null, not a synthetic placeholder.

| Pattern | Used by | Lock order | Moderation | Single source of truth |
|---|---|---|---|---|
| W-1 | F-BET-1, F-BET-2, F-BET-3, F-COMMENT-1, F-COMMENT-2, F-COMMENT-3 | `pools → positions → dharma_ledger → events` (comment + bet rows inserted in-txn for comment-bearing bets) | Every comment-bearing bet (text + image per §10); the comment-free sell F-BET-3 skips | `src/server/bets/transaction.ts` |
| ~~W-2~~ | **Retired** — no comment-without-bet path under reply-as-bet; comment/reply writes run W-1 | — | — | folded into `src/server/bets/transaction.ts` |
| W-3 | F-RESOLVE-1, F-RESOLVE-2, F-RESOLVE-3 | `markets → bets → payout_events → resolution_events → dharma_ledger → events` | None (admin actor) | `src/server/resolution/settle.ts` |

Both remaining patterns (W-1, W-3) share SERIALIZABLE isolation and the 3-attempt full-jitter retry shape from ADR-0013 (parameterised by the per-flow callback). They differ in lock-order spine and actor identity. ENGINE.7 / ENGINE.10 / ENGINE.13 implement.

### §3.3 Read-flow patterns

Every read endpoint reduces to one of three shapes. The shape determines whether the page is server-rendered fresh on every request, served from a Next.js cache, or rendered authenticated against per-user state.

**Pattern R-1 — Uncached server-rendered.** Default for Next.js 16 + App Router under `cacheComponents: true` (per ADR-0003 §6). Used by debate view, market detail, public profile pages — anywhere stake-backed correctness or audit-trail freshness is load-bearing. No `'use cache'` directive in the component tree; data fetched per request from Postgres. Acceptable cost: every page render hits the database; SPEC.1 §16.3's H3 structured request log captures every fetch via Vercel runtime logs (per ADR-0007). The bet-flow read paths (positions, pending bets, debate-view ordering, current YES/NO price) MUST live here per §1.4 #5 and ADR-0003 §6.

**Pattern R-2 — `'use cache'` opt-in (Cache Components).** Used by the market list (`/markets`) and the public profile cards rendered on the leaderboard (`/leaderboard`) — both surfaces are unauthenticated, slow-changing, and tolerate stale-while-revalidate semantics on the order of minutes. The component or function declares `'use cache'` at its top; `cacheLife({ stale, revalidate, expire })` from `next/cache` sets the lifetime in seconds; the cached scope MUST NOT call `cookies()`, `headers()`, or read `searchParams` (Next.js 16.2.x raises a hard error per the May 2026 docs at `/docs/messages/next-request-in-use-cache`). Per-user values that drive the cached output are extracted by the caller (outside the cache scope) and passed in as arguments — this is how the leaderboard renders without per-user state contamination.

```ts
// src/app/(public)/markets/page.tsx (illustrative shape only)
async function getMarketList() {
  'use cache'
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 })  // seconds
  return await db.select().from(markets).where(/* ... */)
}
```

Three operational rules consumed from the May 2026 Next.js 16.2.x docs: (i) `expire > revalidate` is enforced at build time — violation is a build error; (ii) `revalidateTag(tag, 'max')` is the supported two-argument signature for SWR-style invalidation, and `revalidateTag(tag, { expire: 0 })` is the immediate-invalidation form — the single-argument `revalidateTag(tag)` is deprecated in 16.x; (iii) the market-list and leaderboard cadences are deferred to §21 (cron schedule register) — §3.3 names only the pattern, not the specific revalidate / expire values.

**Pattern R-3 — Authenticated reads (uncached, gated).** Used by own-bet-history, own Daily Credit accrual history, own-profile-edit, admin-only views. Auth gate runs at the page boundary (per ADR-0004 / ADR-0010); data fetched per request; never cached because cache scopes can't read cookies. Admin views additionally validate `admin_sessions` independently at the page-level Server Component per CVE-2025-29927 defense-in-depth (per ADR-0010 + AGENTS.md §5).

| Pattern | Used by | Caching | Auth |
|---|---|---|---|
| R-1 | Debate view, market detail, public profile, leaderboard table rows | None (uncached, per-request fresh) | Public; participant session optional for write affordances |
| R-2 | Market list, leaderboard public profile cards | `'use cache'` + `cacheLife({ stale, revalidate, expire })` | Public only — cached scopes cannot read cookies |
| R-3 | Own-bet-history, own Daily Credit, own-profile-edit, admin views | None | Required (participant or admin per surface) |

**Two negative-space directives explicitly NOT used in v1**: `'use cache: remote'` (Redis-backed handler for self-hosted multi-replica cache coherence — irrelevant on Vercel single-region per ADR-0006); `'use cache: private'` (per-user browser-memory cache — would let cached scopes read `cookies()`, but stores results client-side only and re-executes on every server render, providing no shared-cache benefit for our workload). Surfacing both as not-chosen pre-empts the next architect question and makes the negative-space decision auditable.

**Build-version pin.** Next.js MUST be pinned at ≥ 16.2.5 in `package.json` to bring in the `maxPostponedStateSize` DoS patch (CVE-2026-27979), the streaming-fetch-hang fix, and the `http-proxy` CVE patch. ADR-0003's framework version pin lives in `package.json`; this section's reference is the operational floor.

### §3.4 Async-flow patterns

Two engines per ADR-0006. Most scheduled work runs inside Postgres via `pg_cron`; a single carve-out runs as a Vercel Cron HTTP-fanout because it operates against R2 (outside Postgres).

**Pattern A-1 — `pg_cron`-driven (Postgres-internal cadence).** Three jobs in v1: (i) `events`-table partition-overrun monitor (alarms on any DEFAULT-partition insert per ADR-0005); (ii) `identity_pool` low-watermark check (5%-of-pool threshold — alarm 5 per ADR-0007); (iii) `markets`-state drift detection (asserts no `Open` markets past `resolution_deadline` and no `Resolved` markets without a corresponding `resolution_events` row). All three run inside the Supabase Postgres instance; no HTTP fanout; no Vercel function invocation. Failure surfaces via `cron.job_run_details` (Sentry alarm 6 per ADR-0007 §4 entry 6).

**Pattern A-2 — Vercel Cron HTTP-fanout (the single carve-out).** One job in v1: R2 orphan sweep — deletes uploaded image objects whose corresponding `image_uploads` row is more than N hours old without a referencing `comments.image_url`. Cadence `0 */6 * * *` per SCAFFOLD.15 Q7 ratification (every 6 hours; Vercel Pro tier required for sub-daily cadences). Trigger surface: `GET /api/cron/r2-orphan-sweep` Route Handler under Bearer-auth via `Authorization: Bearer ${CRON_SECRET}` header (Vercel Cron contract supports GET only). Carved out because the operation reaches into R2 — Postgres can't do that natively. No other Vercel Cron jobs in v1.

The cron-engine split is itself a §3-level data-flow decision: every async background process is either (a) a Postgres-internal job that mutates Postgres state, or (b) an HTTP-fanout job that mutates state outside Postgres. Adding a third engine (a worker daemon, Inngest, BullMQ) is a future-architecture decision — explicitly out of scope for v1 per ADR-0006.

### §3.5 Auth + signup data flow (special case)

The signup sequence is architecturally distinct from every other flow because it threads through three tables in two transactions with a session-deferral hook in the middle, and because the first transaction's outcome conditionally suppresses session-cookie issuance based on a downstream-table predicate. Worth its own sub-section because no other flow in the codebase has this shape.

**Sequence.** F-AUTH-1 (Google OAuth callback) or F-AUTH-2 (Email + OTP) returns a verified identity. Better Auth's `databaseHooks.session.create.before` hook (per ADR-0004) intercepts before any session row is written. The hook checks: does a `users` row exist for this identity, and does it satisfy `users.pseudonym IS NOT NULL AND users.tos_accepted_at IS NOT NULL`? If yes, the session-create proceeds and the participant cookie issues. Otherwise the hook returns `{ data: false }`, suppressing the session-create, and the auth flow routes to F-AUTH-3 (pseudonym assignment) or F-AUTH-4 (ToS gate) before retrying.

**F-AUTH-3 transaction (pseudonym + PFP consumption).** One Postgres transaction at SERIALIZABLE isolation; lock order `identity_pool → users → events`. `SELECT … FOR UPDATE SKIP LOCKED` on the FIFO-oldest unassigned `(colour, animal, number)` tuple from `identity_pool`; `UPDATE identity_pool SET assigned_at = now()` (the single whitelisted Bucket-B transition per ADR-0005); `INSERT INTO users` with `pseudonym`, `pfp_filename`, and the three component columns; `INSERT INTO events` with `event_type = 'user.pseudonym_assigned'`. If the pool is exhausted, return HTTP 503 `identity_pool_exhausted` with no state changes — the operational alarm at 5% remaining (pattern A-1, alarm 5) is the lead-time signal.

**F-AUTH-4 transaction (ToS acceptance evidence).** One Postgres transaction at SERIALIZABLE isolation; lock order `users → events`. `UPDATE users SET tos_accepted_at = now(), tos_version_hash = $1, privacy_version_hash = $2, tos_acceptance_ip = $3, tos_acceptance_user_agent = $4` (Bucket-C mutable table per ADR-0005 — no append-only trigger on `users`); `INSERT INTO events` with `event_type = 'user.tos_accepted'` carrying both version hashes and the acceptance evidence in `payload`. After commit, the next request's session-deferral hook re-evaluates and the participant cookie issues.

The signup sequence is the only flow where the session cookie's issuance is conditionally suppressed by a downstream-table predicate. This shape is locked by ADR-0004 (the hook contract) + ADR-0011 (the pseudonym pool) + ADR-0005 (the `identity_pool` Bucket-B classification). F-AUTH-ADMIN follows a parallel but disjoint path per ADR-0010 — admin has no `users` row, no pseudonym, no ToS gate; the admin-session cookie issues directly on password match via a transactional `DELETE+INSERT` on `admin_sessions`.

### §3.6 Resolution data flow (special case)

Resolution is architecturally distinct from per-row write flows because it fans out atomically across all bets in a market in one transaction. Worth its own sub-section because the scale and the actor identity differ from the W-1 bet flow in ways that downstream code (export pipeline, dataset schema, observability tagging) consumes.

**Fan-out shape.** F-RESOLVE-1 reads every `bets` row for the market (typically tens to thousands), settles each per the CPMM award rule (`+S × (1 − p) / p` for the winning side; `−S` for the losing side per SPEC.1 §10.3), writes one `payout_events` row per bet, writes one `dharma_ledger` row per non-zero settlement, computes the residual pool balance, records the `pool_unwind` as an `events` row (`metadata.actor_id = 'admin-singleton'`) — **not** a `dharma_ledger` row (R-2; the ledger is user-only), transitions `markets.status` to `Resolved`, locks the comment set (per SPEC.1 §6.2), and emits a single terminal `events` row of `event_type = 'market.resolved'`. All in one Postgres transaction at SERIALIZABLE isolation. INV-4 holds because every row written is in an append-only Bucket-A table (`bets`, `payout_events`, `dharma_ledger`, `resolution_events`, `events`) plus the one whitelisted Bucket-C update on `markets.status`.

**Actor identity.** The admin is structurally outside the participant identity system per ADR-0010. The events row's `metadata.user_id` is genuinely `NULL` (not a synthetic placeholder); `metadata.actor_id = 'admin-singleton'` is the structural marker. The dataset-export pipeline at §19 / Appendix B treats `metadata.actor_id = 'admin-singleton'` as the signal for admin-actor events, which never get pseudonymised because there is no pseudonym to map.

**F-RESOLVE-2 (correction) and F-RESOLVE-3 (void) follow the same fan-out shape**, with two differences: F-RESOLVE-2 writes paired `correction_reverse` + `correction_apply` `payout_events` rows per affected bet (floored at zero per SPEC.1 §10.7) and references the prior `resolution_events.id` via `corrects_event_id`; F-RESOLVE-3 writes `void_refund` `dharma_ledger` rows reversing every bet's stake and emits `event_type = 'market.voided'` with the admin's free-text reason in the payload. INV-4 is preserved in both: corrections are new rows, never updates of prior rows.

Single source of truth: `src/server/resolution/settle.ts` (F-RESOLVE-1), `src/server/resolution/correct.ts` (F-RESOLVE-2), `src/server/resolution/void.ts` (F-RESOLVE-3). All three invoke a shared `resolutionTransaction()` wrapper that applies the SERIALIZABLE + retry policy from §9 / ADR-0013 — same retry shape as the bet wrapper, parameterised by the per-flow callback.

### §3.7 Events-row contract (per-write discipline)

Every state-mutating data flow MUST emit at least one `events` row in the same transaction (Pattern A per ADR-0005). The events log is the canonical audit ledger; current-state tables are co-maintained inside the same transaction for read access; the public dataset release on 2026-11-06 is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per SPEC.1 §12.2 + §19). Per SPEC.1 G3, the dataset is the *only* surface from which `K_eff(t)` is derived — post-hoc, out-of-band, against the released archive — so the events log's completeness and the metadata field set below are the architectural mechanism by which G3 is satisfied.

**Canonical `events.metadata` field set** (per §17 observability tag set):

| Field | Type | Source | Notes |
|---|---|---|---|
| `request_id` | text | `proxy.ts` middleware | Generated per request; correlates events to Vercel runtime log lines |
| `flow_id` | text | handler-injected | One of `F-BET-1`, `F-COMMENT-2`, `F-RESOLVE-1`, etc. — name lookup from SPEC.1 |
| `user_id` | uuid \| null | session | Participant `users.id`, or `NULL` for admin actors and unauthenticated paths |
| `actor_id` | text | handler-injected | `'admin-singleton'` for admin actors; otherwise echoes `user_id` as text |
| `idempotency_key` | text \| null | request header / arg | Carried by every bet endpoint, including comment-bearing bets (post-bets and reply-bets) per §11 / ADR-0015 |
| `ip` | text | `proxy.ts` | Client IP; included in dataset release per SPEC.1 §16.3 |
| `user_agent` | text | `proxy.ts` | Client UA; included in dataset release per SPEC.1 §16.3 |

**Events insertion helper.** `src/server/events/insert.ts` exposes a single `insertEvent(tx, eventInput)` function that runs `INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING` against the bound transaction (composite key per §7.1 + §7.3 partition-constraint reconciliation). The `event_id` is generated client-side via UUIDv7 (per ADR-0016) at handler-entry — used as the storage-layer dedupe primitive per ADR-0005 §5; `created_at` is derived deterministically from the UUIDv7 millisecond prefix. The `payload` is Zod-validated against the per-`event_type` schema at `src/server/events/schemas.ts` before insertion; schema mismatches are runtime errors, not silent inserts.

**CI lint enforcement (HARDEN.\* task).** Every state-mutating handler — defined as any file under `src/server/{bets,comments,dharma,resolution,auth,identity,moderation}/` that opens a `db.transaction(...)` — MUST contain at least one `insertEvent(...)` call inside the transaction body. The lint rule scans for the pattern and fails the build on a missing call. Acceptable false-positive (rare): a transaction that legitimately reads but does not write — these mark the handler with a `// no-event` comment, audited at code review.

### §3 Single source of truth

`src/server/events/insert.ts` owns the events insertion helper. `src/server/events/schemas.ts` owns the per-`event_type` Zod schema map. `src/server/bets/transaction.ts` owns the W-1 wrapper (per §9 / ADR-0013) — the single write path for every bet, including comment-bearing post-bets and reply-bets (the v1.8.x standalone `src/server/comments/place.ts` comment-only entry point is retired under reply-as-bet; comment/reply construction now sits inside the bet transaction). `src/server/resolution/settle.ts` owns the W-3 fan-out. `src/server/auth/index.ts` owns the Better Auth instance and the F-AUTH session-deferral hook (per ADR-0004). `src/server/identity/assign.ts` owns the pseudonym pool consumer (per ADR-0011). `proxy.ts` (formerly `middleware.ts`) at the repo root owns `request_id`, `ip`, `user_agent` injection into the request scope. The full file map is absorbed into Appendix A on its drafting pass.

ADRs consumed by §3: ADR-0003 (framework + runtime), ADR-0004 (Better Auth + session-deferral hook), ADR-0005 (Pattern A + Bucket A/B/C + events table shape), ADR-0006 (cron engine split), ADR-0007 (observability tag set), ADR-0010 (admin actor identity), ADR-0011 (identity pool consumption), ADR-0013 (W-1 concurrency model), ADR-0014 (pre-commit moderation), ADR-0015 (rate-limit + idempotency), ADR-0016 (UUIDv7 PK + URL-exposure rule), ADR-0017 (reply-as-bet model + read-time per-side reply-bet aggregates), ADR-0018 (two-floor minimum-bet write-path check). §3 names how these compose; the ADRs hold the canonical substance.

---

## §4 API Surface

§4 owns the *HTTP / RPC surface inventory* for the experiment-phase build — every endpoint that crosses a process boundary, with its method (or Server Action signature), path, runtime, auth class, idempotency requirement, rate-limit class, and the SPEC.1 `F-*` flow it implements. SPEC.1 §7–§15 owns the per-`F-*` product behaviour; §15 (Error Code Envelope Shape) owns the codes catalogue at `docs/specs/error-codes.md`; this §4 sits between them at the *surface inventory* layer. The discipline is strict: §4 names what endpoint exists, where it lives, and how clients invoke it; it does NOT mint error codes (deferred to §15), it does NOT pick URL slug formats (deferred to ADR-0016 / §16), and it does NOT specify per-action input schemas (deferred to ADR-0008 + the per-flow contract files at §13).

**Surface principle.** Server Actions are the default mutation contract per ADR-0003 §Primitive 4 — typed, zod-validated, transactional, idempotency-aware via natural-key uniqueness. Route Handlers carve out three categories: (i) external-facing endpoints (OAuth callbacks, R2 signed-PUT URL mint, Vercel Cron HTTP-fanout target, Better Auth's mounted routes); (ii) **bet endpoints F-BET-1 / F-BET-2 / F-BET-3** (the D3 carve-out — per ADR-0015 the `Idempotency-Key` HTTP header is the request-level contract surface, and per the May 2026 Next.js 16.2.x evidence Server Actions cannot natively read custom HTTP headers from the client — Discussion #74255 and the absence of a header-passing API on the `serverActions` config page); (iii) public-read JSON endpoints (`/api/health`, `/api/dataset/manifest`). F-AUTH-ADMIN stays a Server Action behind the `/admin/login` page route per ADR-0010 + D3 — admin auth has no HTTP-header-shaped contract surface that a Route Handler would honor better.

The carve-out for bet endpoints is the load-bearing decision in §4. Two trade-offs accepted: (i) bet endpoints lose Server Actions' built-in CSRF defense (origin↔host check), so each bet Route Handler MUST implement an explicit Origin allowlist check at handler entry (file: `src/server/bets/origin-check.ts`); (ii) `revalidateTag()` and `updateTag()` semantics from inside Server Actions are not available — bet handlers call `revalidateTag(tag, 'max')` directly from the Route Handler body, which is supported per the Next.js 16.2.x docs.

### §4.1 Routing taxonomy

Six surface families. Every endpoint in §4.2 / §4.3 belongs to exactly one.

| Family | Runtime | Purpose | Auth class |
|---|---|---|---|
| **F1.** Public read pages | Server Components | Debate view, market detail, public profile, leaderboard, market list | None (participant session optional for write affordances) |
| **F2.** Auth pages + actions | Server Actions + page routes | F-AUTH-2 (OTP submit), F-AUTH-3 (pseudonym), F-AUTH-4 (ToS), F-AUTH-5 (logout), F-AUTH-ADMIN (admin login), F-AUTH-1 OAuth flow | Mixed — pre-auth for sign-in surfaces; participant for logout; admin for `/admin/login` |
| **F3.** Participant-write Server Actions | Server Actions | F-COMMENT-1/2/3/6/7, F-AUTH-3/4/5, profile-edit, daily-allowance accrual trigger | Participant session required |
| **F4.** Bet Route Handlers (D3 carve-out) | Route Handlers, Node.js runtime | F-BET-1, F-BET-2, F-BET-3 — only flows requiring `Idempotency-Key` header surface | Participant session required |
| **F5.** Admin endpoints | Server Actions + Route Handlers | F-RESOLVE-1/2/3, F-ADMIN-1/2/3/4/5; image upload signed-PUT URL mint for admin moderation actions | Admin session required (validated at handler boundary, not just middleware — CVE-2025-29927 defense-in-depth) |
| **F6.** Internal / external integrations | Route Handlers | OAuth callback (Better Auth mounted routes), R2 signed-PUT URL mint (participant image upload), Vercel Cron target, public health, dataset manifest | Mixed — public for health/manifest; pre-auth for OAuth callback; CRON_SECRET Bearer for cron; participant for upload sign |

The taxonomy is a §4-internal organising aid. The per-endpoint catalogue rows in §4.2 / §4.3 reference family by code (F1–F6) so a reader can scan by family.

**Cross-cutting Origin-allowlist middleware (per ADR-0003 §D3 CSRF defense).** Every state-mutating Route Handler validates the `Origin` request header at handler entry against an allowlist derived from the `BETTER_AUTH_URL` env var (with http→https variant for production). Mismatched-Origin requests return HTTP 403 `error_origin_rejected` with no state changes. Missing-Origin requests (typical server-to-server callers without a browser context) are admitted — the threat model is browser-originated CSRF, which always presents an `Origin` header. Single source of truth: `src/server/middleware/origin-allowlist.ts` (bootstrapped at SCAFFOLD.15 alongside `POST /api/uploads/sign`; future bet and admin handlers reuse the same helper). The Vercel Cron Route Handler `GET /api/cron/r2-orphan-sweep` is **exempt** — Vercel-internal cron fires from a server-to-server context without an `Origin` header, and bearer-auth via `CRON_SECRET` pre-empts CSRF threats on that surface. This middleware is the cross-cutting CSRF defense that compensates for Server Actions' built-in origin check being absent on Route Handlers; per-endpoint Origin-check helpers (e.g., `src/server/bets/origin-check.ts` named in §4.3) are deprecated in favour of the cross-cutting helper as bet endpoints land.

### §4.2 Server Actions catalogue

Fourteen Server Actions in v1. Every row's file path is the single source of truth for that action's implementation. Under the v1.9.0 reply-as-bet model the three comment-composer actions (`placeDirectComment`, `placeReply`, `placeImageComment`) are **comment-bearing bets** — each opens the §9 W-1 bet transaction (moving CPMM reserves, inserting the paired `bets` + `comments` rows atomically per INV-1), not a standalone comment write.

| Action | Family | File path | Invocation surface | SPEC.1 F-* |
|---|---|---|---|---|
| `submitOtp(input)` | F2 | `src/server/auth/otp/submit.ts` | `<form action={submitOtp}>` on `/auth/otp` | F-AUTH-2 |
| `acceptPseudonymAndTos(input)` | F2 | `src/server/auth/tos/accept.ts` | `<form action={accept}>` on `/auth/welcome` (combined F-AUTH-3 + F-AUTH-4 — single user-facing screen, single transaction at the action boundary) | F-AUTH-3 + F-AUTH-4 |
| `logout()` | F2 | `src/server/auth/logout.ts` | Header user menu | F-AUTH-5 |
| `adminLogin(input)` | F2 | `src/server/auth/admin/login.ts` | `<form action={adminLogin}>` on `/admin/login` | F-AUTH-ADMIN |
| `placeDirectComment(input)` | F3 | `src/server/comments/place.ts` | `<form action={placeDirectComment}>` on debate view | F-COMMENT-1 |
| `placeReply(input)` | F3 | `src/server/comments/reply.ts` | Inline reply composer in debate view | F-COMMENT-2 |
| `placeImageComment(input)` | F3 | `src/server/comments/place-image.ts` | `<form action={placeImageComment}>` after R2 upload completes | F-COMMENT-3 |
| `resolveMarket(input)` | F5 | `src/server/resolution/settle.ts` | `/admin/markets/<id>/resolve` form | F-RESOLVE-1 |
| `correctResolution(input)` | F5 | `src/server/resolution/correct.ts` | `/admin/markets/<id>/correct` form | F-RESOLVE-2 |
| `voidMarket(input)` | F5 | `src/server/resolution/void.ts` | `/admin/markets/<id>/void` form | F-RESOLVE-3 |
| `createMarket(input)` | F5 | `src/server/admin/markets/create.ts` | `/admin/markets/new` form | F-ADMIN-1 |
| `seedPool(input)` | F5 | `src/server/admin/markets/seed.ts` | `/admin/markets/<id>/seed` form | F-ADMIN-2 |
| `triggerResolution(input)` | F5 | `src/server/admin/markets/trigger-resolution.ts` | `/admin/markets/<id>` action | F-ADMIN-3 |
| `moderateComment(input)` | F5 | `src/server/admin/moderation/act.ts` | Approve / Block / Remove pass-verdict buttons on hub queue + inline market view (per SCAFFOLD.16 F-γ-thin) | F-ADMIN-4 |

Audit-log search (F-ADMIN-5) is a read-only query against `admin_events` and `mod_actions` — implemented as a Server Component page at `/admin/moderation/audit`, not a Server Action. Listed here for completeness; it has no write surface.

Every Server Action returns a typed result object discriminated by `ok: true | false`. The shape is locked at §4.4. Per-action zod input schemas are declared inline in each action file via `drizzle-zod`-derived row schemas (table-row inputs) or hand-rolled zod (non-row args) per ADR-0008.

### §4.3 Route Handlers catalogue

Nine Route Handlers in v1. All run on the Node.js runtime per ADR-0003 §Primitive 7 (no `runtime = 'edge'` exports under `src/server/{bets,comments,dharma,resolution}/` or anywhere downstream).

| Method + path | Family | File path | Auth | Idempotency-Key | SPEC.1 F-* |
|---|---|---|---|---|---|
| `POST /api/bets/place` | F4 | `src/app/api/bets/place/route.ts` | Participant | **Required** | F-BET-1, F-BET-2 |
| `POST /api/bets/sell` | F4 | `src/app/api/bets/sell/route.ts` | Participant | **Required** | F-BET-3 |
| `POST /api/uploads/sign` | F6 | `src/app/api/uploads/sign/route.ts` | Participant | Optional | F-COMMENT-3 prep |
| `POST /api/admin/uploads/sign` | F5 | `src/app/api/admin/uploads/sign/route.ts` | Admin | Optional | F-ADMIN-4 image affordance prep |
| `GET/POST /api/auth/[...all]` | F6 | (Better Auth mounted) `src/app/api/auth/[...all]/route.ts` | Pre-auth | N/A | F-AUTH-1 OAuth callback, OTP request, session validation |
| `GET /api/cron/r2-orphan-sweep` | F6 | `src/app/api/cron/r2-orphan-sweep/route.ts` | Bearer `CRON_SECRET` | N/A | A-2 cron pattern (Vercel Cron contract supports GET only) |
| `GET /api/health` | F6 | `src/app/api/health/route.ts` | None | N/A | Liveness probe |
| `GET /api/dataset/manifest` | F6 | `src/app/api/dataset/manifest/route.ts` | None (post-2026-11-06) | N/A | SPEC.1 §12.2 dataset metadata |

**Server-Sent Events / WebSocket: explicitly absent.** Debate view polls per SPEC.1 §9 F-DEBATE-4 — `POLL_INTERVAL_MS_DEBATE_VIEW` deferred to HARDEN.6 number-tuning. SSE / WS deferred to testnet phase per ADR-0006.

**Bet endpoint Origin defense.** Both `/api/bets/place` and `/api/bets/sell` MUST validate the `Origin` header at handler entry against an allowlist read from `ALLOWED_ORIGINS` env var (default: production domain + `*.zugzwangworld.com` preview deploys). Mismatch returns HTTP 403 `origin_not_allowed` with no state changes. This compensates for the loss of Server Actions' built-in origin check; file `src/server/bets/origin-check.ts` is the single source of truth.

### §4.4 Request / response envelope

**Route Handler envelope.** JSON over HTTPS. Success: `{ ok: true, data: <flow-specific-shape> }`. Error: `{ ok: false, error: { code: <stable-string>, message: <display-template>, retry_after?: <seconds> } }`. The `code` field references `docs/specs/error-codes.md` per §15; `message` is the display template (interpolated client-side); `retry_after` is present iff the HTTP status is 429 / 503. HTTP status carries equal weight to `ok` — clients SHOULD branch on status, then on `ok`.

**Server Action return shape.** Discriminated union `{ ok: true; data: T } | { ok: false; error: { code: string; message: string; field_errors?: Record<string, string[]> } }`. The `field_errors` shape is the React 19.2 `useActionState` contract for surfacing per-field validation errors (e.g., "comment too long," "stake exceeds balance"). Server Actions don't return HTTP status to user code — the framework wraps the action call in its own protocol; per-action error class is encoded in `error.code`.

**`Idempotency-Key` header (bet endpoints only).** Format `^[A-Za-z0-9_-]{1,255}$` per ADR-0015. Server returns HTTP 400 `error_idempotency_key_required` if the header is missing on a bet endpoint, HTTP 400 `error_idempotency_key_invalid` if the format is wrong. Body fingerprint: SHA-256 of canonical-JSON (RFC 8785) request body, hex-encoded — used per ADR-0015 to detect body mismatch on key reuse (HTTP 409 `error_idempotency_key_reused`). Server Actions do NOT carry an `Idempotency-Key` header; they rely on natural-key uniqueness — for comment-bearing bets (posts + replies), the dedup key is `(user_id, market_id, body_hash, posted_at_minute)`.

**`request_id` echo.** Every Route Handler response carries an `X-Request-Id` response header echoing the `proxy.ts`-generated request ID. Clients SHOULD log this for support correlation. Server Actions don't expose this header (the framework owns the response shape) — `request_id` flows into the `events.metadata` row instead, so server-side correlation is preserved.

### §4.5 Auth contract per surface

**Participant session.** Cookie name `zugzwang_session`, HTTP-only + Secure + SameSite=Lax, indefinite Max-Age per ADR-0004. Issued on F-AUTH-1 / F-AUTH-2 success after the session-deferral hook clears (per §3.5). Validated at every Server Action boundary (per ADR-0004) and every participant Route Handler entry (per ADR-0003). Logout (F-AUTH-5) deletes the server-side `sessions` row and clears the cookie.

**Admin session.** Cookie name `zugzwang_admin_session`, HTTP-only + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age per ADR-0010. Issued on F-AUTH-ADMIN success via the transactional `DELETE+INSERT` on `admin_sessions`. Validated independently at every admin Server Action and admin Route Handler boundary (NOT only at middleware) — per CVE-2025-29927 defense-in-depth, AGENTS.md §5, ADR-0010. Cookie names MUST differ from the participant cookie; the two session systems are structurally disjoint.

**Cookie discipline summary.** No surface ever validates one cookie type when checking the other. A user holding both cookies in the same browser (hypothetical — `B5` forbids the admin from also being a participant) presents two distinct sessions to two distinct subsystems. Logout endpoints are per-cookie-type; logging out of one does not log out of the other.

**Public surfaces.** F1 read pages and the F6 public-read JSON endpoints (`/api/health`, `/api/dataset/manifest`) explicitly skip the auth gate. Cached scopes (R-2 pattern) cannot read cookies anyway, so the absence of the gate is structurally enforced for those surfaces.

### §4.6 Rate-limit class per surface

Every endpoint in §4.2 / §4.3 is bound to a rate-limit class from §11's per-surface table (per ADR-0015). Numeric values defer to HARDEN.6.

| Surface family / endpoint | Rate-limit class |
|---|---|
| OTP request (F-AUTH-2 first step, served by Better Auth's `/api/auth/[...all]`) | `otp-email` (per email, 1h) + `otp-ip` (per IP burst, 1m) |
| `/admin/login` POST (F-AUTH-ADMIN) | `admin-login-ip` (per IP, 1h) |
| `placeDirectComment`, `placeReply`, `placeImageComment` (comment-bearing bets) | `bet-ip` (per IP, 1m) — the bet anti-abuse posture (posts/replies are bets, per SPEC.1 §8). Whether reply-bets additionally carry a per-market productive cap is **deferred to §11 + the number-tuning pass** |
| `POST /api/bets/place`, `POST /api/bets/sell` | `bet-ip` (per IP, 1m) |
| `POST /api/uploads/sign` | `image-put-ip` (per IP, 1m) |
| `POST /api/admin/uploads/sign` | None — admin path |
| F-RESOLVE-1/2/3, F-ADMIN-1/2/3/4/5 | None — admin path |
| F1 public read pages, `/api/health`, `/api/dataset/manifest` | None — read-only |
| Vercel Cron target | None — Bearer-auth pre-empts abuse |

Under reply-as-bet there is **no standalone comment or vote rate-limit budget** (the v1.8.x `write-budget` + `write-burst` per-market comment pair is removed; friendly-fire is gone). Posts and replies are bets, so their anti-abuse posture is the bet posture — the per-IP burst cap (`bet-ip`, `BET_ATTEMPTS_PER_IP_PER_MIN`). Bet endpoints use a per-IP identifier because the threat model is credential-stuffed bot traffic across many compromised accounts; per-user limits only fire after a successful login and are the wrong defense surface. Whether reply-bets warrant an additional per-market productive cap (distinct from top-level bets, which are exempt by design) is an open question deferred to §11 + HARDEN.6.

### §4.7 Versioning + URL discipline

**No `/api/v1/*` prefix in v1.** The codebase archives 2026-11-08 per ADR-0001 (experiment-phase scope ceiling). Cross-version compatibility is a non-goal; mobile or service-to-service clients are not in v1 scope; the one external integration (the public dataset) is served as static files post-2026-11-06 from the GitHub release at `zugzwang-foundation/experiment` plus a long-lived static URL — not through this API surface. The `/api/dataset/manifest` endpoint is a thin pointer to those static assets, not a serving layer.

**URL-exposure rule (per ADR-0016 §16 / SPEC.2 §16).** Participant-facing routes use pseudonyms and market slugs only — `/u/RedFox001`, `/m/<market-slug>`, `/markets/<slug>/comment/<short-id>`. Raw UUIDs are FORBIDDEN on participant routes. Admin routes under `/admin/*` MAY use raw UUIDs for operator ergonomics — `/admin/markets/<uuid>`, `/admin/users/<uuid>`. The 2026-11-06 dataset release uses raw UUIDs as join keys per SPEC.1 §12.2. The acceptance test `id::raw-uuid-not-in-participant-urls` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter (per SPEC.2 §16).

**Slug generation** is SCAFFOLD.* territory — §4 names that slugs exist on participant routes; the slug-generation algorithm (kebab-case from market title + collision suffix?) is a future implementation decision, not an architectural one.

### §4 Single source of truth

`src/server/bets/origin-check.ts` owns the bet-handler Origin allowlist. `src/app/api/bets/{place,sell}/route.ts` owns the bet Route Handlers. `src/server/auth/admin/{login,validate,logout}.ts` owns the admin auth endpoints. `src/server/auth/index.ts` owns the Better Auth instance + the F-AUTH-1/2 mounted routes. `src/app/api/uploads/sign/route.ts` and `src/app/api/admin/uploads/sign/route.ts` own the signed-PUT URL mints. `src/app/api/cron/r2-orphan-sweep/route.ts` owns the single Vercel Cron target. The full file map is absorbed into Appendix A on its drafting pass.

ADRs consumed by §4: ADR-0003 (Server Actions vs Route Handlers default + runtime pinning), ADR-0004 (Better Auth mounted routes + participant session shape), ADR-0006 (cron-engine carve-out), ADR-0007 (request_id observability tag), ADR-0010 (admin auth wiring + cookie discipline + CVE-2025-29927 defense-in-depth), ADR-0015 (Idempotency-Key header surface + rate-limit class table), ADR-0016 (URL-exposure rule + UUID forbiddance on participant routes). §4 names the surface inventory; the ADRs hold the canonical substance.

---

## §5 Data Model — Table Inventory

§5 owns the *complete table inventory* for the experiment-phase build — every Postgres table the v1 codebase reads or writes, with append-only-vs-mutable classification per ADR-0005's Bucket A / B / C scheme, the per-domain schema home per ADR-0008 §4, and the load-bearing ADR(s) that mint the table's substance. SPEC.2 §5 is the single inventory; per-table DDL substance lives in ADR-0005 (table shape + classification rationale) + ADR-0008 (Drizzle declaration + migration discipline) + ADR-0016 (universal UUIDv7 PK). A reader who needs the column-by-column DDL goes to the schema file at `src/db/schema/<domain>.ts`; a reader who needs the inventory shape stays here.

Twenty-two tables in v1 across ten domains. Nine strictly append-only (Bucket A); three append-only with one whitelisted column transition (Bucket B); ten mutable with no append-only trigger (Bucket C). Total protected by §6's append-only enforcement contract: twelve.

### §5.1 Inventory table

Sorted by bucket. Within each bucket, ordered by §3 lock-order spine where applicable, then by FK-dependency order.

**Bucket A — strictly append-only (BEFORE UPDATE + BEFORE DELETE both `RAISE EXCEPTION`)**

| # | Table | Domain | Owner ADRs | Notes |
|---|---|---|---|---|
| 1 | `events` | `events` | ADR-0005 + ADR-0007 + ADR-0016 | Canonical events log per §3.7 + §7; monthly partitioned with twelve pre-created partitions + DEFAULT; composite PK `(event_id, created_at)` per §7.1 partition-constraint reconciliation; storage idempotency via `INSERT ... ON CONFLICT (event_id, created_at) DO NOTHING` |
| 2 | `dharma_ledger` | `dharma` | ADR-0005 | Append-only Dharma balance ledger; every balance change flows here; INV-2 (no-overdraft) enforced via §6 + ledger discipline |
| 3 | `bets` | `bets` | ADR-0005 + ADR-0013 | Per-bet record; locked second in §9 W-1 lock-order chain; INV-1 atomic with comment write |
| 4 | `comments` | `comments` | ADR-0005 + ADR-0017 (supersedes ADR-0009) | Per-comment record; INV-3 (side-bound at post time via `side_at_post_time`). Under reply-as-bet every comment rides a bet (INV-1): `bet_id` NOT NULL (FK to `bets`, 1:1 with the comment-bearing bet); `parent_comment_id` NULL = top-level **post-bet** comment, non-NULL = **reply-bet** comment (reply floor 50 per ADR-0018). No `stake_at_post_time` column — the superseded ADR-0009 ranking model used it; ADR-0017's multi-mode model reads per-side reply-bet aggregates at render time (§5.4) and needs no frozen post-level stake column |
| 5 | `resolution_events` | `events` | ADR-0005 | One row per F-RESOLVE-1/2/3 admin fan-out; INV-4 append-only resolutions; corrections reference prior `resolution_events.id` via `corrects_event_id` |
| 6 | `payout_events` | `events` | ADR-0005 | One row per bet settlement during W-3 fan-out; corrections write paired `correction_reverse` + `correction_apply` rows per §3.6 |
| 7 | `mod_actions` | `audit` | ADR-0014 | Moderation audit trail; pre-commit verdict + image-upload linkage via `image_r2_key` per §10 |
| 8 | `admin_events` | `audit` | ADR-0010 | Admin-action audit trail; admin-actor encoding `metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'` per §3.6 + §8.8 |
| 9 | `user_events` | `audit` | ADR-0005 | User lifecycle audit trail (ToS acceptance, pseudonym assignment). Daily Credit accrual is NOT here — its complete write set is `events` (`dharma.credited`) + `dharma_ledger` + the `users.last_allowance_accrued_at` cursor per §5.5 (ENGINE.12 R2) |

**Bucket B — append-only with one whitelisted column transition**

| # | Table | Domain | Owner ADRs | Whitelisted transition | Notes |
|---|---|---|---|---|---|
| 10 | `identity_pool` | `identity` | ADR-0005 + ADR-0011 | `assigned_at` NULL → timestamp | 50,000-row pseudonym pool; consumed via `SELECT ... FOR UPDATE SKIP LOCKED` in F-AUTH-3 per §3.5; synthetic UUIDv7 PK + `UNIQUE (colour, animal, number)` per ADR-0016 D5 |
| 11 | `image_uploads` | `image-uploads` | ADR-0006 + ADR-0014 + 3-B §12-R1 | `terminal_state` + `terminal_at` set together once | Image upload lifecycle; two-column atomic transition (committed / orphan / blocked); orphan sweep per §3.5 Pattern A-2 + §12.6 |
| 12 | `system_state` | `system` | 3-E §20-1 | `frozen_at` NULL → timestamp | Single-row keyed by `id = 'system'`; conclusion-event freeze trigger per §20.2; reversibility-none enforced at DB level |

**Bucket C — mutable, no append-only trigger**

| # | Table | Domain | Owner ADRs | Notes |
|---|---|---|---|---|
| 13 | `users` | `auth` | ADR-0004 + ADR-0011 | Better Auth user row + `pseudonym` + ToS evidence (`tos_accepted_at`, `tos_version_hash`, `privacy_version_hash`, `tos_acceptance_ip`, `tos_acceptance_user_agent`); `last_allowance_accrued_at` carries the **Daily Credit** accrual cursor (DB identifier retained per SPEC.1 §10.4); PII-stripped at H2 erasure |
| 14 | `sessions` | `auth` | ADR-0004 | Better Auth participant session; cookie name `zugzwang_session`; manual-logout-deletes-row per F-AUTH-5 |
| 15 | `accounts` | `auth` | ADR-0004 | Better Auth OAuth provider linkage (per 3-A R1 — fourth Better Auth table) |
| 16 | `verifications` | `auth` | ADR-0004 | Better Auth Email-OTP storage; single-use enforced by plugin; TTL-bounded; replaces dropped `otp_codes` |
| 17 | `admin_sessions` | `auth` | ADR-0010 | Hand-rolled three-column schema (`session_id`, `issued_at`, `last_seen_at`); single-row-at-any-moment via transactional `DELETE+INSERT`; cookie name `zugzwang_admin_session` |
| 18 | `markets` | `markets` | ADR-0005 | Market metadata + status; whitelisted Bucket-C `markets.status` update during W-3 (`Open` → `Resolved \| Voided`) per §3.6 |
| 19 | `pools` | `markets` | ADR-0005 + ADR-0013 | CPMM pool reserves; locked first in §9 W-1 chain via `SELECT ... FOR NO KEY UPDATE` |
| 20 | `positions` | `bets` | ADR-0005 + ADR-0013 | Per-user-per-market position cache; updated synchronously inside the W-1 bet transaction per §3.7; gates no-stake-no-voice eligibility (INV-3) and feeds W-3 settlement. No ranking role — ADR-0017's model reads per-side reply-bet aggregates at render time (§5.4), not a frozen position derivation |
| 21 | `watermark_state` | `system` | ADR-0006 + ADR-0007 | Single-row-per-metric state-machine table backing pg_cron alarm transition detection (alarm 5 per ADR-0007 §4). Ships in `drizzle/migrations/0007_pg_cron_jobs.sql`. Schema: `(metric text PK, state text CHECK IN ('above','below'), since timestamptz)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (CHECK enum). |
| 22 | `cron_alarms` | `system` | ADR-0006 + ADR-0007 | Queue table for pg_cron-emitted alarms. SCAFFOLD.17 ships the INSERT side; SCAFFOLD.5 ships the drain-and-emit side. Schema: `(id bigserial PK, alarm_id text NOT NULL, payload jsonb NOT NULL, emitted_at timestamptz, processed_at timestamptz NULL)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (PK + NOT NULL). |

### §5.2 Bucket-classification summary

The bucket classification is the load-bearing operational distinction: it determines which §6 trigger fires on which row, what the §6 test contract verifies, and what the public-dataset-export pipeline at §19 ships vs scrubs.

| Bucket | Count | Trigger pattern | Tables |
|---|---|---|---|
| **A** — strictly append-only | 9 | `BEFORE UPDATE` + `BEFORE DELETE` both `RAISE EXCEPTION` | `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events` |
| **B** — whitelisted transition | 3 | Per-table function comparing OLD/NEW row images, permitting only the named whitelisted column-set transition once | `identity_pool`, `image_uploads`, `system_state` |
| **C** — mutable | 10 | No append-only trigger (constraint-driven validation only) | `users`, `markets`, `pools`, `positions`, `sessions`, `accounts`, `verifications`, `admin_sessions`, `watermark_state`, `cron_alarms` |

Total protected (Bucket A + Bucket B): **twelve tables**. The §6 test contract floor (previously sized at 33+ cases for a thirteen-table protected set) reduces with the removal of `friendly_fire_events` — its Bucket-B trigger cases (the two-independent-column `frozen_at` / `cleared_at` transition tests) drop with the table. The floor is re-baselined for the twelve-table protected set per the per-table baseline ratified at 3-A.

### §5.3 Universal column conventions

**UUIDv7 primary keys.** Every PK in §5.1 is `uuid` declared as `id: uuid("id").primaryKey().default(sql\`uuidv7()\`)` per ADR-0016 D1–D4. This applies uniformly across the inventory: participant tables, audit tables, the four Better Auth tables (which override Better Auth's default 32-char base62 string per ADR-0016 D4 + ADR-0004 `advanced.database.generateId`), the hand-rolled `admin_sessions`, and the synthetic-PK tables (`identity_pool` carries a UUIDv7 `id` PK plus a separate `UNIQUE (colour, animal, number)` constraint per ADR-0016 D5). The `session.token` field on Better Auth's `session` table is **untouched** by this convention — that's the cookie-payload random string, not a row PK.

**Per-domain schema-file split.** Tables are grouped into domain files at `src/db/schema/<domain>.ts` per ADR-0008 §4 with a barrel re-export at `src/db/schema/index.ts`. Ten domains in v1: `auth`, `markets`, `bets`, `comments`, `dharma`, `events`, `identity`, `image-uploads`, `audit`, `system`. The `auth` domain spans two ADR ownerships (ADR-0004 for the four Better Auth tables; ADR-0010 for `admin_sessions`); both groups share the same schema file because they share the auth surface conceptually.

**`created_at` + cross-row ordering.** All tables carry `created_at TIMESTAMPTZ DEFAULT now()`. Per ADR-0016's monotonicity caveat, `created_at` is the canonical chronological-sort column for cross-row ordering — UUIDv7's time prefix is per-backend monotonic only and MUST NOT be assumed monotonic across the Supavisor connection pool.

### §5.4 Read-models that are not tables

Two architecturally-significant read-models compute at read time rather than persist as tables:

- **Debate-view ranking + per-side reply aggregates.** Per **ADR-0017** (which supersedes ADR-0009) + `RANKING.md`, post/reply ordering is a **multi-mode model** — a multi-lane "Top" default (traction / stake / split lanes, ratio-to-#2 over an activity floor, graceful degradation) plus single-axis filter modes (Most Debated, Highest Stakes, Contested, Newest; Surging deferred to v1.x), with replies ranked **stake-descending within side** at `REPLY_DEPTH_MAX = 1` (earlier-wins tie-break). The substrate is **four per-side signals computed at render time by aggregating a post's reply-bets** — no friendly-fire vote, no stored vote table:
  - `support_count` — number of reply-bets on the post's own side;
  - `counter_count` — number of reply-bets on the opposing side;
  - `support_dharma` — total Dharma staked across support-side reply-bets (`SUM(bets.stake)`);
  - `counter_dharma` — total Dharma staked across counter-side reply-bets.

  These derive entirely from existing columns (`bets.stake`, `bets.side` / `comments.side_at_post_time`, `comments.parent_comment_id`) via SQL aggregation per render. The "Support / Counter" counts a post displays are these read-time aggregates, **not** a friendly-fire vote tally. The model is **read-time-computed**: **no projection table, no `ranking_snapshots`, no materialised view, no cached score column** — pure TypeScript at `src/lib/ranking.ts` (tunables in `src/lib/ranking.config.ts`), computed per render, with `now` frozen to the resolution timestamp for resolved markets (INV-4). Lane ratios, the activity floor, and the gravity term are owned by `RANKING.md` and pinned at the 2026-09-01 number-tuning pass; the reply floor (`BET_MIN_STAKE_REPLY` = 50, ADR-0018) is the parameter-level lever on ADR-0017's conceded reply-level `C > n`. Lane-aggregation index requirements are a SCAFFOLD.2 deliverable. `RANKING.md` itself is rewritten at DEBATE.8 (it still reflects the old ADR-0009 single-scalar function until then).
- **K_eff(t) trajectory.** Per SPEC.1 G3 + §12.2 + §19.5, `K_eff(t)` is derived **post-hoc, out-of-band, against the 2026-11-06 public dataset only**. No live in-product surface, no materialised view, no cron job. The PRECURSOR.2-B D4 lock prohibits any in-product K_eff component in v1.

### §5.5 Removed from prior outline (audit trace)

Six tables that appeared in earlier outlines but are absent from the v1 inventory. Retained here as audit trace so a reviewer comparing v0.1-outline / v0.2-draft (and the v0.3-draft "as-built" inventory) against the current model sees the resolution path:

- **`admin`** — no admin user row exists. F-AUTH-ADMIN structural separation per ADR-0010 + §8.7 puts admin entirely outside the participant graph; auth is via `ADMIN_PASSWORD` env var against `admin_sessions` only. The "admin" actor is encoded at events-row write time (`metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'`) per §3.6 + §8.8.
- **`otp_codes`** — renamed to `verifications` per ADR-0004 (Better Auth's Email-OTP plugin owns the table name).
- **`daily_allowance_events`** — collapsed into `events` (event-type `dharma.credited`, aggregate `dharma_account` — the built ENGINE.0 name, kept per the ENGINE.12 R1 founder ruling; this entry previously said `user.daily_allowance_accrued`) + `dharma_ledger` (the credit row) + `users.last_allowance_accrued_at` (the idempotency cursor) per ADR-0005. No separate domain table needed; no `user_events` row either (ENGINE.12 R2 — this three-part collapse is the complete write set).
- **`projections_state`** — no async projector cursor needed in v1. ADR-0005 Pattern A maintains read-models synchronously inside the originating transaction; there is no out-of-band projector to track.
- **`k_eff_dashboard`** — struck per PRECURSOR.2-B D4 (2026-05-08). The K_eff dashboard product surface was removed entirely; the only K_eff trajectory derivation is the post-hoc one against the 2026-11-06 public dataset (per §5.4 + §19.5).
- **`friendly_fire_events`** — removed entirely per **ADR-0017** (reply-as-bet model, sharpened SYNC.7) + SPEC.1 v1.9.0-draft. The standalone friendly-fire up/down vote is gone — there is no vote affordance and no table. The "Support / Counter" signal a post displays is now read-time aggregated over its reply-bets (§5.4), not a stored vote. This table was present in the v0.3-draft "as-built" inventory (and in the SCAFFOLD.2 build) with a two-column Bucket-B trigger and F-COMMENT-6/7/8 Server Actions; all of it — table, trigger, `castFriendlyFire`/`clearFriendlyFire` — is struck from the architecture. (The physical migration dropping the built table + the F-COMMENT-6/7/8 retirement are forward engineering work tracked on the tracker; see §23.3.) **Note:** ADR-0017's own body text still says friendly-fire "stays display-only"; that wording is stale and contradicted by both specs — reconciled by a later in-place ADR-0017 patch (flagged §23.3), not in this pass per the "don't flip ADR status" scope.

### §5 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Per-domain table declarations | `src/db/schema/<domain>.ts` (ten domain files) |
| Barrel re-export of all schemas | `src/db/schema/index.ts` |
| Drizzle config (migration set + schema barrel pointer) | `drizzle.config.ts` |
| Append-only trigger SQL (Bucket A + Bucket B per-table functions) | `drizzle/migrations/<NNNN>_append_only_triggers.sql` |
| UUIDv7 PL/pgSQL function | `drizzle/migrations/<NNNN>_uuidv7_function.sql` |
| Events monthly partitioning DDL | `drizzle/migrations/<NNNN>_events_partitioning.sql` |
| Drizzle DB client (`server-only` import) | `src/db/index.ts` |

ADRs consumed by §5: ADR-0004 (the four Better Auth tables + cookie / session / verification / account schemas), ADR-0005 (Bucket A/B/C classification + per-domain split discipline + events table shape + dropped-tables collapse rationale), ADR-0006 (R2 bucket inventory feeding `image_uploads` lifecycle), ADR-0008 (Drizzle ORM + per-domain schema-file convention), ADR-0010 (`admin_sessions` hand-rolled three-column schema), ADR-0011 (`identity_pool` 50K-row pseudonym pool), ADR-0013 (`pools` / `positions` lock-order participation in the W-1 bet chain), ADR-0014 (`mod_actions` + `image_uploads` moderation linkage via `image_r2_key`), ADR-0016 (universal UUIDv7 PK + `identity_pool` synthetic-PK pattern), ADR-0017 (reply-as-bet model — `comments.parent_comment_id` post/reply split, `comments.bet_id` 1:1 binding, the four per-side reply-bet aggregates read at render time; supersedes ADR-0009 and retires `stake_at_post_time` + `friendly_fire_events`), ADR-0018 (two-floor minimum-bet write-path check). 3-B §12-R1 ratification (`image_uploads` Bucket B classification with two-column atomic transition) and 3-E §20-1 ratification (`system_state` Bucket B classification with `frozen_at` NULL → timestamp transition) are absorbed in this commit.

---

## §6 Append-Only Enforcement Contract

§6 owns the *physical-enforcement contract* by which Bucket A and Bucket B tables in the §5.1 inventory cannot be silently mutated outside the permitted patterns. The mechanism is Postgres triggers — `BEFORE UPDATE` and `BEFORE DELETE` triggers that `RAISE EXCEPTION` on disallowed mutations — installed via a single hand-written raw SQL migration in the Drizzle migration set per ADR-0005 §3 + ADR-0008 §3. The triggers are the ground truth; handler-layer checks are advisory; service-role credentials cannot circumvent them without an audit-visible schema change. The contract is what makes INV-2 (no-Dharma-overdraft via append-only `dharma_ledger`), INV-3 (comments side-bound at post time via append-only `comments`), and INV-4 (append-only resolutions via append-only `resolution_events` + `payout_events`) enforceable at the database layer rather than only at the application layer.

Twelve protected tables in v1: nine Bucket A (strictly append-only) + three Bucket B (append-only with one whitelisted column-set transition). The ten Bucket C tables in §5.1 carry no append-only triggers; their integrity rides on FK constraints, UNIQUE constraints, NOT NULL constraints, and CHECK constraints declared in their `src/db/schema/<domain>.ts` files via Drizzle DDL.

### §6.1 The five-clause contract

The contract is five clauses, each load-bearing:

1. **Every Bucket A table carries `BEFORE UPDATE` + `BEFORE DELETE` triggers, both `RAISE EXCEPTION` unconditionally.** No row in a Bucket A table can be modified after insert, ever, by any code path.
2. **Every Bucket B table carries a `BEFORE UPDATE` trigger that calls a per-table function comparing OLD and NEW row images, permitting only the named whitelisted column-set transition, and a `BEFORE DELETE` trigger that `RAISE EXCEPTION` unconditionally.** The per-table function rejects any UPDATE that touches a non-whitelisted column, any UPDATE that re-fires the whitelisted transition (e.g., `frozen_at` already non-NULL), and any UPDATE that changes whitelisted columns to disallowed values.
3. **Bucket C tables carry no append-only triggers.** Their mutability is the design intent (cookies issue and revoke, market status transitions, position caches update, ToS acceptance evidence stamps, etc.).
4. **The trigger SQL ships in a single migration file.** Single source of truth: `drizzle/migrations/<NNNN>_append_only_triggers.sql`. Adding a new protected table is a same-commit edit to this file plus a new §5.1 row plus a new §6 test case — no scattering across multiple migrations.
5. **The triggers are the ground truth; handler-layer checks are advisory only.** The §3.1 handler stack does not pre-validate that an UPDATE would be permitted; it issues the SQL and lets Postgres enforce. A failed trigger surfaces as a SQLSTATE error in the handler — converted to an HTTP 500 `internal_error` envelope per §15 (the trigger fired because handler logic was wrong; user-displayed messages omit the trigger detail; full error rides into Sentry alarm 1 per §6.7).

### §6.2 Bucket A trigger pattern

Identical shape across all nine Bucket A tables. Two triggers per table:

```sql
CREATE OR REPLACE FUNCTION enforce_bucket_a_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: UPDATE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: DELETE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Applied to each of the 9 Bucket A tables:
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();
-- ... and same for dharma_ledger, bets, comments, resolution_events,
-- payout_events, mod_actions, admin_events, user_events.
```

Two functions, eighteen trigger declarations (nine tables × two triggers). The functions are shared because the message text is parameterised by `TG_TABLE_*` variables — no per-table function needed.

### §6.3 Bucket B trigger pattern

Per-table function comparing OLD and NEW row images. Three protected tables, each with its specific whitelisted transition.

**`identity_pool.assigned_at` NULL → timestamp** (per ADR-0011). Single whitelisted column shape — NULL-to-non-NULL transition once via `OLD IS NOT NULL AND NEW IS DISTINCT FROM OLD`, all other columns unchanged. Permits no-op UPDATEs (3-rule uniform across all Bucket B per SCAFFOLD.2 stratum 3.C ratification — see closing paragraph of this section).

**`image_uploads.terminal_state` + `image_uploads.terminal_at` set together atomically** (per 3-B §12-R1). Two-column atomic transition: the trigger function rejects any UPDATE where one column transitions but the other does not, OR where either column is already non-NULL in OLD (re-firing), OR where any non-whitelisted column changes. Permitted: a single UPDATE that moves both columns from NULL to non-NULL together. This is the only Bucket B table with a multi-column transition shape; the per-table function carries an explicit conjunction.

```sql
CREATE OR REPLACE FUNCTION enforce_image_uploads_terminal_atomic()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on terminal_state (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_state IS NOT NULL AND NEW.terminal_state IS DISTINCT FROM OLD.terminal_state THEN
    RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)';
  END IF;
  -- One-shot on terminal_at (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at THEN
    RAISE EXCEPTION 'image_uploads: terminal_at is one-shot (immutable once set)';
  END IF;
  -- Reject partial transition (XOR; one column NULL while other set)
  IF (NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL) THEN
    RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together';
  END IF;
  -- Reject any non-whitelisted column change (immutable list extended at
  -- SCAFFOLD.15 to include content_type + byte_size per 0006 migration)
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
     OR NEW.content_type IS DISTINCT FROM OLD.content_type
     OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The immutable list for `image_uploads` is `id`, `user_id`, `r2_object_key`, `content_type`, `byte_size`, `created_at`. The two-column atomic transition (`terminal_state` + `terminal_at`) is the only permitted UPDATE; the trigger function lives in `drizzle/migrations/0003_append_only_triggers.sql` with the `content_type` + `byte_size` extension re-created via `CREATE OR REPLACE` in `drizzle/migrations/0006_image_uploads_extension.sql` per SCAFFOLD.15.

**`system_state.frozen_at` NULL → timestamp** (per 3-E §20-1). Single whitelisted column shape — same per-column DISTINCT-FROM one-shot semantics as `identity_pool`. The conclusion-event freeze trigger flips this column once at 2026-11-05 23:59 UTC; the trigger ensures it can never flip back. Recovery from an erroneous freeze requires `BREAK_GLASS.md` direct-database surgery via `ALTER TABLE ... DISABLE TRIGGER` followed by manual UPDATE — this breaks the experiment deliverable per SPEC.1 §12.4 and is acceptable only as catastrophic-failure recovery.

All three Bucket B trigger functions use the 3-rule (DISTINCT-FROM) pattern uniformly per SCAFFOLD.2 stratum 3.C ratification — permit no-op UPDATEs (the trigger enforces non-mutation, not action), reject re-fires on whitelisted columns via DISTINCT-FROM, reject partial transitions on multi-column-atomic Bucket B (image_uploads only), reject any non-whitelisted column change. Asymmetry across Bucket B trigger functions would be a permanent cognitive tax.

Total Bucket B trigger declarations: three per-table functions + six trigger statements (three tables × two triggers — one BEFORE UPDATE calling the per-table function, one BEFORE DELETE that `RAISE EXCEPTION` unconditionally).

### §6.4 Application-layer relationship

The handler stack (per §3.1) does NOT pre-validate that an UPDATE would be permitted by the trigger. Handlers issue the SQL and let Postgres enforce; a failed trigger surfaces as a SQLSTATE error in the handler.

This is deliberate. Pre-validation in the handler would either (i) duplicate the trigger logic in TypeScript, creating two sources of truth that drift, or (ii) issue a `SELECT` to read the row's current state before the UPDATE, doubling the database round-trip cost. Neither is justified when the trigger is correctly enforcing.

The error path is well-defined: a trigger `RAISE EXCEPTION` returns a Postgres error; Drizzle propagates it to the handler as a `DatabaseError`; the handler converts to an HTTP 500 `internal_error` envelope per §15. The user-displayed message is generic ("Something went wrong, please try again"); the full trigger message rides into Sentry alarm 1 per §6.7. Trigger errors are operationally unexpected — they fire only on application bugs that violate the contract — so a 500 is the correct response class.

### §6.5 Service-role credentials cannot circumvent

Postgres triggers fire for all roles by default. Service-role credentials (Supabase's `service_role` key, which bypasses RLS) do NOT bypass triggers. (RLS itself is out of scope for the experiment per §18.5 / ADR-0019 — the database is server-only, so RLS would back-stop the trusted server rather than gate an exposed surface; the append-only triggers, by contrast, are load-bearing and apply to every role.) The only way to write to a Bucket A table without firing the trigger is to issue `ALTER TABLE <name> DISABLE TRIGGER <trigger>;` first — which is a schema change visible in any audit log and which would be caught by HARDEN.* migration-review CI lint.

This means a future "I just need to fix this one row" production hotfix is structurally a deliberate, audit-visible event — not an accidental footgun. The `BREAK_GLASS.md` runbook (per ADR-0010 + §21) documents the procedure for the catastrophic-failure case.

### §6.6 Test contract floor

Test contract floor at SPEC.2 v1.0 lock: a per-table minimum across the **twelve protected tables**. The floor was 38+ for thirteen tables (33+ at 3-A, bumped to 38+ at SCAFFOLD.15 for the five `image_uploads` 0006 extension cases); it **re-baselines below 38** with the removal of `friendly_fire_events` — its Bucket-B trigger cases drop with the table (the two-independent-column `frozen_at` / `cleared_at` transitions, their re-fire rejections, the both-columns-at-once rejection, and DELETE rejection). The floor is sized at the per-table baseline ratified at 3-A: each Bucket A table requires at least UPDATE-rejected + DELETE-rejected coverage; each Bucket B table requires whitelisted-transition-accepted + non-whitelisted-column-rejected + re-firing-rejected + DELETE-rejected coverage; `image_uploads` additionally requires partial-transition-rejected coverage for both column orderings AND content_type / byte_size immutability + CHECK-bound coverage per SCAFFOLD.15 0006. The exact case count is set at SCAFFOLD.2 implementation time against the twelve-table protected set.

Test path naming: `tests/db/triggers/<table>-append-only.spec.ts`, one file per protected table. SCAFFOLD.2 implements the full suite as a same-commit deliverable with the trigger SQL migration. Test fixtures bypass any application-layer protection (going straight to the Drizzle client) so the trigger is the only enforcement under test.

### §6.7 Observability hook

Every trigger `RAISE EXCEPTION` event fires Sentry alarm 1 (Append-only-trigger violation) per §17 alarm catalogue. The Sentry payload carries the SQL error message (which includes the table, the OLD/NEW row diff for Bucket B, and the violating handler's request_id from `events.metadata`), the originating flow_id, and the user_id (or `'admin-singleton'` for admin actors). Threshold tuning is HARDEN.*-owned per §17.7; the alarm fires on any single occurrence — a trigger trip is operationally unexpected and warrants investigation.

Per §17.5's fail-open posture for observability, a Sentry outage does not affect the trigger enforcement; the trigger still fires, the handler still returns 500, only the alarm is silently dropped. The DB-level enforcement is independent of the observability surface.

### §6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Trigger SQL (all bucket A + bucket B trigger functions + trigger declarations) | `drizzle/migrations/<NNNN>_append_only_triggers.sql` |
| Per-table append-only test suites | `tests/db/triggers/<table>-append-only.spec.ts` (twelve files) |
| Sentry alarm 1 catalogue row | §17.2 master table |
| `BREAK_GLASS.md` admin-bypass procedure (catastrophic-failure recovery only) | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per §21.3 + ADR-0010) |
| Bucket classification of each table | §5.1 inventory + §5.2 summary |

ADRs consumed by §6: ADR-0005 (Bucket A/B/C classification + ground-truth-trigger discipline + same-migration-file convention), ADR-0008 (Drizzle migration set + raw-SQL migrations alongside drizzle-kit-generated `.sql` files), ADR-0010 (`BREAK_GLASS.md` procedure flag), ADR-0014 (`mod_actions` Bucket A — moderation audit-trail integrity rides on this). 3-B §12-R1 (`image_uploads` Bucket B with two-column atomic transition) and 3-E §20-1 (`system_state` Bucket B with `frozen_at` NULL → timestamp) absorbed in this commit; cross-reference renumber from "ADR-0007 catalogue entry #1" to "§17 alarm 1" applied per 3-D R2.

---

## §7 Event Model

§7 owns the *events table shape and read-model classification rule* for the experiment-phase build. The events log is the canonical audit ledger per ADR-0005's Pattern A — every state-mutating data flow emits at least one events row in the same transaction (per §3.7), and the public-dataset release on 2026-11-06 is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per §19). Per SPEC.1 G3, the dataset is the *only* surface from which K_eff(t) is derived — post-hoc, against the released archive — so the events log's column completeness is the architectural mechanism by which G3 is satisfied.

§7 names the eight-column shape, the partitioning strategy, the storage-layer idempotency primitive (distinct from §11's API-boundary idempotency surface), the synchronous-vs-asynchronous read-model classification rule (per ADR-0005), the per-event-type Zod schema boundary (per ADR-0008), and the events insertion helper. The seven-field `events.metadata` set lives at §3.7 and is canonical there per 3-A R2 — §7 references the set via §3.7 rather than restating it.

### §7.1 Events table column shape

Eight columns per ADR-0005 §5:

| Column | Type | Notes |
|---|---|---|
| `event_id` | `uuid` NOT NULL (composite PK with `created_at` per §7.2 partition constraint) | UUIDv7 per ADR-0016 D1; client-side-generated at handler entry; storage-layer dedupe primitive (see §7.3) |
| `event_type` | `text` NOT NULL | Discriminator; closed enum at the application layer; one Zod schema per value at `src/server/events/schemas.ts` |
| `aggregate_type` | `text` NOT NULL | Domain object the event concerns (`market`, `bet`, `comment`, `user`, `dharma_account`, `system`, `admin_session`, `image_upload`) |
| `aggregate_id` | `uuid` NOT NULL | The primary key of the aggregate row this event belongs to |
| `payload` | `jsonb` NOT NULL | Per-event-type body; Zod-validated at insertion per §7.6 |
| `payload_version` | `smallint` NOT NULL | Migration cursor for payload-shape evolution within a stable `event_type` |
| `metadata` | `jsonb` NOT NULL | The seven-field set per §3.7 (`request_id`, `flow_id`, `user_id`, `actor_id`, `idempotency_key`, `ip`, `user_agent`) — the §17 observability tag set |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | Canonical chronological-sort column per ADR-0016 monotonicity caveat |

Drizzle declaration lives in `src/db/schema/events.ts` per ADR-0008 §4. The full DDL substance is owned by ADR-0005; §7.1 is the at-a-glance shape.

Postgres requires the partition column be part of any PK/UNIQUE constraint on a partitioned table. Per §7.2's `PARTITION BY RANGE (created_at)`, the storage-layer PRIMARY KEY is composite `(event_id, created_at)`. `event_id` remains the storage-idempotency dedupe primitive; `created_at` is supplied deterministically by the `insertEvent` helper per §7.3 (extracted from the UUIDv7 millisecond prefix so retries that reuse the same `event_id` also reuse the same `created_at`). This composite-PK shape is locked at SCAFFOLD.2 stratum 3.C apply-time; SPEC.2 v0.3-draft's earlier "PRIMARY KEY (event_id)" assertion in §7.1 + §7.3 is reconciled here.

### §7.2 Partitioning

`RANGE` partitioning on `created_at` per ADR-0005 §5. Twelve pre-created monthly partitions cover the full experiment window plus tail: `events_2026_05` through `events_2027_04`. Plus a DEFAULT partition that catches any row whose `created_at` falls outside the named partitions — an operational error condition by design.

**Sentry alarm on DEFAULT-partition writes** per §17 alarm 2. Any single insert into the DEFAULT partition fires the alarm; thresholds tune at HARDEN.* per §17.7. The DEFAULT partition exists as a backstop — without it, an out-of-range `created_at` would fail the insert with a partition routing error and break the originating transaction. With it, the insert succeeds and the operational alarm catches the misconfiguration.

Partition creation SQL ships as a hand-written raw migration: `drizzle/migrations/<NNNN>_events_partitioning.sql`. Adding a partition (e.g., extending past 2027-04) is a same-commit migration plus an updated DEFAULT partition rule; provisional file path under SCAFFOLD.2 per 3-A R4.

### §7.3 Storage-layer idempotency vs API-boundary idempotency

Two structurally distinct idempotency surfaces. Both consume the request's `idempotency_key` value but operate at different layers and on disjoint storage substrates.

**Storage-layer idempotency.** `(event_id, created_at)` is the composite primary key (per §7.1's partition-constraint note); insert uses `INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING`. Re-inserting an event with the same `(event_id, created_at)` pair (e.g., a transaction retry that re-runs the events.insert) is a no-op — exactly-once event-row creation guaranteed by the composite PK constraint. The `event_id` is generated client-side via UUIDv7 at handler entry (per ADR-0016) and reused across retries within the same logical request. The `insertEvent` helper at `src/server/events/insert.ts` (ENGINE.6) supplies `created_at` deterministically from UUIDv7's millisecond prefix (the first 48 bits of the UUID, big-endian unix-ms) so retries that reuse the same `event_id` also reuse the same `created_at` — storage idempotency stands across retries.

**API-boundary idempotency.** §11 / ADR-0015's `Idempotency-Key` HTTP header (Route Handlers) and Server Action argument surface, with cache lookup against Upstash Redis on `idem:{key}` keys, body-fingerprint match, and 24-hour completed-response replay. Sits at handler entry, before any database work.

The two are orthogonal: a request that survives the API-boundary idempotency cache MAY still be retried at the database layer (e.g., the bet transaction wrapper retrying on SQLSTATE 40001 per ADR-0013); the storage-layer idempotency on `(event_id, created_at)` ensures the events row writes exactly once even across those retries. A reader who needs the API-boundary contract goes to §11; a reader who needs the storage-layer contract stays here.

### §7.4 Synchronous vs asynchronous read-model classification rule

Per ADR-0005's read-model rule: a read-model updates synchronously inside the originating transaction iff the originating flow's correctness depends on the updated read-model state; asynchronously otherwise. Pattern A maintenance (synchronous current-state writes alongside the events row in the same transaction) is the v1 default for everything that satisfies the correctness condition.

**Synchronous targets — thirteen tables plus the events row itself:**

`pools`, `positions`, `bets`, `comments`, `dharma_ledger`, `payout_events`, `resolution_events`, `markets`, `mod_actions`, `admin_events`, `user_events`, `users`, `identity_pool` — each updated inside the originating transaction whenever an events-row write affects it. Plus the `events` row itself, which is the canonical write that the synchronous current-state writes ride alongside.

**Asynchronous targets — none in v1.**

Every state-mutating data flow updates its read-models synchronously inside the originating transaction. The K_eff dashboard async target named in earlier outlines is struck per PRECURSOR.2-B D4 (2026-05-08); there is no `k_eff_dashboard` materialised view, no async refresh, no `pg_cron` `REFRESH MATERIALIZED VIEW CONCURRENTLY` job. K_eff(t) is derived post-hoc from the 2026-11-06 public dataset only (per §5.4 + §19.5). No other async read-model surfaces in v1.

**Read-time-computed (no projection table at all):** the debate-view ranking. Per **ADR-0017** + `RANKING.md`, the multi-mode model (Top + filter modes; replies stake-descending within side) runs against live `comments` + `bets` rows on every debate-view render, aggregating each post's reply-bets into the four per-side signals (`support_count`, `counter_count`, `support_dharma`, `counter_dharma`) per §5.4. No `friendly_fire_events`, no materialised view, no cached score column on `comments`, no `ranking_snapshots`. Lane-aggregation index requirements are flagged for SCAFFOLD.2.

### §7.5 Sync-target write composition

When a state-mutating transaction touches more than one synchronous target, all writes happen in the same transaction in the §3 lock-order spine of the originating flow:

- **W-1 (bet flow)** writes `pools` + `positions` + `dharma_ledger` + `events` per §3.2 (lock-order chain), and for a **comment-bearing bet** (every post-bet and reply-bet) additionally inserts the `bets` + `comments` rows in the same transaction (INV-1 atomic bet+comment). The comment-free sell omits the comment row. The lock-order chain is four tables (`pools → positions → dharma_ledger → events`); `bets` and `comments` are Bucket-A appends within it.
- **W-2** — retired under reply-as-bet (no comment-without-bet path); comment and reply writes run W-1. The v1.8.x `positions → comments → events` comment-only chain no longer exists.
- **W-3 (resolution flow)** writes `markets` + `bets` + `payout_events` + `resolution_events` + `dharma_ledger` + `events` per §3.6 — six write tables across the per-bet fan-out.
- **F-AUTH-3 + F-AUTH-4** signup writes per §3.5 hit `identity_pool` + `users` + `events` (F-AUTH-3) and `users` + `events` (F-AUTH-4).
- **F-MOD-* moderation actions** write `mod_actions` + (optionally) `comments`, `bets`, `users` (Track A side effects) + `events`.

The events row is always terminal in the lock-order chain per ADR-0005 convention. The CI-lint rule named in §3.7 (every state-mutating handler MUST contain at least one `insertEvent(...)` call inside its `db.transaction(...)` body) enforces the discipline at the codebase level.

### §7.5.1 V3 carve-out for `user.signed_out`

V3 (synchronous emission in the originating transaction) holds across all in-house mutation paths. One carve-out: when an upstream library (Better Auth `signOut`) owns the originating mutation and does not expose an after-hook for events emission, the events row may be emitted in a separate post-commit transaction. Audit-trail gap between the mutation and the emission (process-crash window) is accepted iff the upstream mutation is idempotent.

`user.signed_out` emits post-Better-Auth-mutation in a new transaction. Atomicity guarantee weaker than other event_types: a process crash between Better Auth's `signOut` and our `insertEvent` call leaves a session-deleted-with-no-event-row state. The orphan is undetectable. Operational tradeoff accepted because (a) session deletion is itself idempotent — the user can log in again — and (b) the audit-trail gap for a single crashed logout has no consequence beyond a missing log entry.

Currently applied only at `src/server/auth/logout.ts`. Adding another V3 carve-out is a same-commit amendment to this subsection plus a corresponding code-level justification in the relevant handler docstring.

### §7.6 drizzle-zod vs hand-written per-event-type Zod boundary

Per ADR-0008 §6.2, Drizzle's drizzle-zod helper auto-derives row-shape schemas from table definitions and serves API-boundary input validation for `users`, `markets`, `comments`, `bets`, etc. — *not* `events.payload`. The events payload is a typed union over all event types in the experiment, and its shape is per-event-type rather than per-table; drizzle-zod cannot auto-derive it.

The per-event-type Zod schemas live at `src/server/events/schemas.ts` as a hand-written `Map<EventType, ZodSchema>`. Every `event_type` value in the closed enum has exactly one schema entry. The events insertion helper at §7.7 looks up the schema by `event_type` and validates `payload` before issuing the INSERT; a payload that fails validation is a runtime error, not a silent insert.

This is the only place in the codebase where Drizzle's typegen and the runtime validator are deliberately separated. Every other DB row uses drizzle-zod throughout.

### §7.7 Events insertion helper

`src/server/events/insert.ts` exposes a single function:

```ts
async function insertEvent(tx: Transaction, eventInput: EventInput): Promise<void>
```

Three locked properties per ADR-0008 §6.2:

1. **Bound-transaction-only.** The function takes a `Transaction` (not the top-level `db` client) and runs INSERT against it. Calling `insertEvent(db, ...)` is a TypeScript compile error. This guarantees the events write is inside the originating transaction by construction.
2. **Zod-validates payload.** The function looks up the per-event-type schema (per §7.6), validates `eventInput.payload`, and throws on mismatch before issuing SQL. Validation runs synchronously and adds microsecond-scale overhead; mismatches are application bugs, not data hazards.
3. **`sql\`...\`` template.** The actual INSERT uses Drizzle's `sql\`INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING\`` template per the events-insert pattern locked in ADR-0008 §6.2. Hand-written SQL beats query-builder composition here because the storage-idempotency `ON CONFLICT (event_id, created_at) DO NOTHING` clause (composite per §7.1 partition-constraint reconciliation) is the load-bearing primitive — a Drizzle-builder version would obscure it.

The `event_id` is supplied by the caller (handler entry generates it via `uuidv7()` from the npm `uuid` package per ADR-0016). The helper does not generate UUIDs internally — keeps the call site authoritative for retry-correlation.

### §7 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Events table schema declaration | `src/db/schema/events.ts` |
| Events monthly partitioning DDL | `drizzle/migrations/<NNNN>_events_partitioning.sql` |
| Per-event-type Zod schema map | `src/server/events/schemas.ts` |
| Events insertion helper | `src/server/events/insert.ts` |
| Events-emit CI lint rule | HARDEN.* (per §3.7's CI-lint enforcement clause) |
| Sentry alarm 2 catalogue row (DEFAULT-partition writes) | §17.2 master table |

ADRs consumed by §7: ADR-0005 (Pattern A + events table column shape + monthly partitioning + storage-layer idempotency on `event_id` + synchronous read-model rule), ADR-0008 (drizzle-zod-vs-events-payload-Zod boundary + `sql\`...\``-template events insert + per-domain schema-file split + raw-SQL migration discipline), ADR-0016 (UUIDv7 PK on `event_id` + monotonicity caveat). 3-A R2 absorbs the seven-field metadata alignment to §3.7 canonical lock; PRECURSOR.2-B D4 absorbs the K_eff async-target strike. Cross-reference renumber from "ADR-0007 §4 alarm 2" to "§17 alarm 2" applied per 3-D R2.

---

## §8 Authentication & Sessions

§8 owns the *authentication and session contract* for the experiment-phase build — two structurally separate session systems running in parallel on the same Next.js + Postgres + Drizzle stack, with cookie names + session tables + auth methods + identity FKs structurally disjoint, and with the load-bearing session-deferral hook that gates participant cookie issuance on pseudonym + ToS acceptance. SPEC.1 §13 owns the per-flow product behaviour for F-AUTH-1 / F-AUTH-2 / F-AUTH-3 / F-AUTH-4 / F-AUTH-5 / F-AUTH-ADMIN; ADR-0004 owns Better Auth participant-path substance; ADR-0010 owns hand-rolled admin-path substance; ADR-0011 owns pseudonym pool consumption at F-AUTH-3; ADR-0016 D6 owns the URL-exposure rule on auth surfaces. §8 sits above all of them at the contract layer, naming what is structurally enforced vs what is library-mediated.

### §8.1 Two parallel session systems

Eight contract dimensions. Every row is a structural disjointness invariant — a participant credential cannot authenticate any admin surface and an admin credential cannot authenticate any participant surface, by data-model construction (not by runtime check).

| Dimension | Participant | Admin |
|---|---|---|
| Library | Better Auth + Drizzle adapter | Hand-rolled |
| Session table | `sessions` (Bucket C, mutable) | `admin_sessions` (Bucket C, mutable) |
| Cookie name | `zugzwang_session` | `zugzwang_admin_session` |
| Cookie path | `/` (default) | `/admin` |
| Strategy | Database session (server-side row, server-side validation) | Database session (server-side row, server-side validation) |
| Identity FK | `sessions.userId` → `users.id` | `admin_sessions.session_id` PK only — NO FK to `users` |
| Session row id | UUIDv7 + Better Auth-issued `session.token` 32-char random | UUIDv7 PK only |
| Auth method | F-AUTH-1 (Google OAuth) or F-AUTH-2 (Email + OTP) | F-AUTH-ADMIN (`ADMIN_PASSWORD` env var via `crypto.timingSafeEqual`) |
| Session end | F-AUTH-5 logout deletes `sessions` row + clears cookie | Manual logout deletes `admin_sessions` row + clears cookie; suspected-compromise rotation per `BREAK_GLASS.md` |

The seven-pillar structural-separation rule (§8.7) compresses these dimensions into the load-bearing invariants downstream code must honor.

### §8.2 Better Auth wiring

Participant authentication runs on Better Auth pinned at version 1.6.x in `package.json`. The instance is the single source of truth at `src/server/auth/index.ts`; mounted route handlers at `src/app/api/auth/[...all]/route.ts` per ADR-0004.

**Provider configuration.** `socialProviders.google` carries Google OAuth scopes `openid email profile`; the F-AUTH-1 callback enforces `email_verified === true` per ADR-0004 §1 — accounts where the Google identity has not verified email are rejected at signup with `oauth_email_not_verified`. The Email-OTP plugin from `better-auth/plugins` is wired with a `sendVerificationOTP` callback to Resend; OTPs are 6-digit numeric (plugin default), persisted in the `verifications` table through the Drizzle adapter, single-use enforced by the plugin, TTL deferred to HARDEN.6 number-tuning.

**Cloudflare Turnstile.** Wired via `hooks.before` middleware on the `/email-otp/send-verification-otp` Better Auth path per ADR-0004 §4 + §18.2. The hook calls Cloudflare's siteverify endpoint with the client-submitted Turnstile token; failure rejects the OTP request with `turnstile_failed` (HTTP 400) and never invokes Resend. Turnstile fail-mode is **fail-closed** per §18.2 (legal-floor consent surface; mirrors §10 / §11 idempotency / moderation fail-closed posture, asymmetric to §17.5 observability fail-open).

**Indefinite cookie lifetime.** Per SPEC.1 §13 the participant session has no time-based expiry; only manual logout (F-AUTH-5) or admin ban invalidates. Better Auth's session-expiry default is overridden via large `expiresIn` (effectively-never sentinel) plus `disableSessionRefresh: true` to suppress sliding-window refresh. The cookie carries no `Max-Age` ceiling; the `sessions` row carries no `expiresAt` column — server-side validation simply checks "row exists" without time math.

**UUIDv7 override across all four Better Auth tables.** Better Auth's default 32-character base62 random `id` format is overridden via `advanced.database.generateId: () => uuidv7()` in `src/server/auth/index.ts`. The Drizzle schemas at `src/db/schema/auth.ts` declare `id` as `uuid` with the standard `default(sql\`uuidv7()\`)` clause. Applies to all four Better Auth tables: `users`, `sessions`, `accounts`, `verifications` (per 3-A R1 — `accounts` is the fourth Better Auth table, in the §5.1 inventory at row 16). The `session.token` field — Better Auth's separate 32-char random session-cookie value used as the cookie payload — is **untouched** by this contract; only the row's `id` PK is affected.

### §8.3 Session-deferral hook

The load-bearing construction-layer protection of INV-3 (comments side-bound at post time) and INV-4 (append-only resolutions). Server-side `sessions`-row creation MUST be gated on pseudonym assignment AND ToS acceptance — the participant cookie cannot issue before both `users.pseudonym IS NOT NULL` AND `users.tos_accepted_at IS NOT NULL`.

The mechanism is `databaseHooks.session.create.before` in the Better Auth config per ADR-0004:

```ts
databaseHooks: {
  session: {
    create: {
      before: async (session) => {
        const u = await db.query.users.findFirst({
          where: eq(users.id, session.userId),
          columns: { pseudonym: true, tosAcceptedAt: true },
        });
        if (!u?.pseudonym || !u?.tosAcceptedAt) {
          throw new APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" });
        }
        return { data: session };
      },
    },
  },
},
```

**Full-onboarding-loop semantics** per §3.5. F-AUTH-1 / F-AUTH-2 callback completes; the hook intercepts before the session row is written; the hook reads `users.pseudonym` and `users.tos_accepted_at` for the `session.userId`. If either is NULL, the hook throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` — the user record and OAuth-account row are preserved on rejection; no `sessions` row is written and no cookie is issued. The auth flow routes to F-AUTH-3 (pseudonym assignment via `identity_pool` consumption in same transaction as the `users` row write) or F-AUTH-4 (ToS acceptance evidence write to mutable `users` columns) before the session-create re-attempts and succeeds.

**Cancellation safety.** F-AUTH-3 transaction completes the `identity_pool.assigned_at` whitelisted Bucket-B transition and writes the `users` row with pseudonym set, tos_accepted_at NULL. If the user cancels at the F-AUTH-4 ToS step, the next sign-in attempt re-evaluates the hook against current column state — pseudonym is non-NULL, tos_accepted_at is still NULL, so the hook routes back to F-AUTH-4 only. Pseudonym is NOT re-consumed (no double pool consumption); the hook is idempotent with respect to retried sign-ins.

The hook is the construction-layer protection of B5 (admin not a participant), INV-3, and INV-4 because no participant cookie can grant authority to write to `bets` or `comments` tables before pseudonym + ToS are both set; a participant who tried to comment before completing onboarding has no session and is rejected at the auth gate (handler stack step 1 per §3.1), not at the comment-flow business logic.

### §8.4 Admin auth path

Hand-rolled per ADR-0010. Four-step Server Action sequence at `src/server/auth/admin/login.ts` (SCAFFOLD.3 Q1 amendment: Turnstile dropped per SPEC.1 §13 line 609 — "No CAPTCHA on F-AUTH-ADMIN (per-IP rate limit … is the brute-force guard for a single-user admin path)". Per-IP rate limit + identical-401 + transactional replace + indefinite cookie remain sufficient brute-force protection for a single-user admin path):

1. **HMAC-SHA256 digest comparison** via `crypto.timingSafeEqual` over equal-length 32-byte buffers. `createHmac(BETTER_AUTH_SECRET).update(input).digest()` on both submitted and env values so the comparison never throws `RangeError` on different-length inputs (which would itself leak password length).
2. **Run-and-discard timing parity** — on password mismatch, the action still issues a dummy database round-trip + a constant-time delay before returning. This prevents an information-leak side-channel where wrong-password responses are systematically faster than rate-limit-exceeded responses.
3. **Transactional `DELETE FROM admin_sessions; INSERT INTO admin_sessions (...) RETURNING session_id;`** in a single Postgres transaction. Maintains the single-row-at-any-moment invariant without a UNIQUE constraint — no concurrent admin login can produce two rows because the DELETE precedes the INSERT in the same transaction; wraparound is impossible.
4. **Issue cookie** with name `zugzwang_admin_session`, attributes `HttpOnly + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age` per ADR-0010 + §8.5.

**Two-layer middleware-plus-validator pattern.** Admin trust is checked at TWO places per CVE-2025-29927 defense-in-depth + AGENTS.md §5:

- **Layer 1 (UX, bypassable).** Next.js middleware at `proxy.ts` redirects unauthenticated `/admin/*` requests to `/admin/login`. Layer 1 exists only for the redirect UX; it MUST NOT be the security boundary because middleware is bypassable in some deployment configurations (CVE-2025-29927 documented the bypass class).
- **Layer 2 (security boundary, non-bypassable).** Every admin Server Action and admin Route Handler validates `admin_sessions` independently at handler entry via `src/server/auth/admin/validate.ts`. A request that bypasses middleware reaches the handler and is rejected at Layer 2; a request that passes middleware but mutates an `admin_sessions` row mid-request is re-validated at the handler boundary.

**Identical-401 information-leak avoidance.** Both wrong-password (step 2) and rate-limit-exceeded responses return HTTP 401 with `error_code: admin_login_invalid` — no distinct codes, no distinguishable response time, no Retry-After header. This forecloses an enumeration attack that could probe whether `ADMIN_PASSWORD` is the failing predicate vs the rate limit. Per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` per SPEC.1 §16.1 caps brute-force attempts.

**Three-column `admin_sessions` schema** per ADR-0010: `session_id UUID PK`, `issued_at TIMESTAMPTZ NOT NULL`, `last_seen_at TIMESTAMPTZ NOT NULL`. The prior `admin_email` column was dropped because static-password auth makes per-admin identity vacuous — there is no "which admin signed in" distinction, only "the admin signed in." `admin_sessions` is **Bucket C** (mutable; `last_seen_at` updates on each request); the immutable audit trail of admin actions lives in `admin_events` (Bucket A) per §5.1 row 8.

### §8.5 Cookie attribute table

Side-by-side per surface. All cookies are session cookies in the security sense (validated server-side every request); the "indefinite" lifetime refers to the absence of client-side expiry.

| Attribute | `zugzwang_session` (participant) | `zugzwang_admin_session` (admin) |
|---|---|---|
| `HttpOnly` | true | true |
| `Secure` | true | true |
| `SameSite` | `Lax` | `Lax` |
| `Path` | `/` (default) | `/admin` |
| `Max-Age` | indefinite (no client-side ceiling) | indefinite (no client-side ceiling) |
| `Domain` | not set (host-only) | not set (host-only) |
| Cookie value | Better Auth-issued `session.token` (32-char random) | UUIDv7 `session_id` |

The cookie naming asymmetry is the data-model construction backing B5: a single browser cannot present both cookies simultaneously *to the same path scope* — `/admin` requests carry only the admin cookie path-matched; non-`/admin` requests carry only the participant cookie path-matched. `/admin/*` Server Actions and Route Handlers therefore see only the admin cookie at the auth gate.

### §8.6 F-AUTH-5 logout

**Two endpoints, no cross-type logout.** F-AUTH-5 logout is per-cookie-type:

- **Participant logout.** Server Action `logout()` at `src/server/auth/logout.ts` calls `auth.api.signOut({ headers })` (Better Auth) which deletes the server-side `sessions` row and clears the `zugzwang_session` cookie. Returns the user to the public homepage.
- **Admin logout.** Server Action at `src/server/auth/admin/logout.ts` deletes the `admin_sessions` row (transactional `DELETE`; not paired with an INSERT this time) and clears the `zugzwang_admin_session` cookie. Returns to `/admin/login`.

A user holding both cookies (hypothetical — B5 forbids the admin from also being a participant; the case exists only during admin-rotation testing) presents two distinct sessions to two distinct subsystems. Logging out of one does NOT log out of the other; the two sessions are independent.

**Ban is request-time enforcement, not logout.** A banned participant's `sessions` row is NOT deleted at the moment of ban; the ban is enforced at the next request via `users.banned_at IS NOT NULL` check at the Server Action / Route Handler entry. This is deliberate — pre-ban audit trail is preserved, and the ban-enforcement check rides on the same `auth.api.getSession` call that already runs at every handler entry. Track A automatic ban (per ADR-0014 + SPEC.1 §14 F-MOD-1) and Track B admin manual ban (per F-ADMIN-4) both write `users.banned_at`; neither deletes `sessions` rows.

### §8.7 Structural-separation rule (seven pillars)

The seven invariants by which admin authority and participant authority are structurally non-overlapping at the data-model layer. This is the load-bearing security control in v1 per §18.4 — sybil resistance via *construction*, not via runtime check.

1. **`users` table carries no `role` column.** Admin is not a privileged user account; admin is structurally outside the `users` graph. There is no row in `users` with `role = 'admin'`.
2. **Admin has no `users` row.** The admin actor is encoded at events-row write time (`metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'` per §3.6 + §8.8) — there is no participant identity to map.
3. **Two distinct cookie names.** `zugzwang_session` and `zugzwang_admin_session` are non-overlapping on path scope (`/` vs `/admin`); no surface ever validates one cookie type when checking the other.
4. **Two distinct session tables.** `sessions` (participant, Better Auth-managed) and `admin_sessions` (admin, hand-rolled) share no FK relationship and no read path.
5. **`admin_sessions` has no FK to `users`.** Even at the schema level, admin sessions cannot reference participant identities; the orphaned-table-by-design property is enforced by absence of FK.
6. **Cross-cookie-type access is never authorized.** Admin Server Actions and admin Route Handlers validate `admin_sessions` only; participant Server Actions and participant Route Handlers validate `sessions` only. A request holding only the participant cookie that targets an admin Server Action is rejected with `admin_session_required` at handler entry; the reverse is rejected with `participant_session_required`.
7. **Inline admin affordances on public pages call the admin validator at the backend endpoint.** When admin-only UI elements appear inline on a page also viewed by participants (e.g., a "Resolve" button on a market detail page that the market creator sees), the *frontend rendering* may conditionally show the affordance based on a public flag, but the *backend Server Action* the affordance invokes ALWAYS validates `admin_sessions` independently — never relies on the rendering decision having been correct.

The seven pillars are the construction-layer protection of B5. §18.4 promotes this rule to a six-property summary in §18 prose; §8.7 carries the full enumeration here for the auth contract reader.

### §8.8 Events-row writes for auth flows

Auth-flow events emit to specific audit tables per SPEC.1 §16.4 lock. The encoding distinguishes participant-actor flows from admin-actor flows at the events-metadata level:

All auth-flow event_types route to the unified `events` table per ADR-0005 §4 + §7. The legacy `user_events` + `admin_events` Drizzle tables in `src/db/schema/audit.ts` are retained for future stratum use (mod-action audit subdivision per F-MOD-*, dedicated admin audit search per F-ADMIN-5) but are NOT written by ENGINE.6's auth-flow emit sites. Participant vs admin distinction is preserved entirely at the metadata level (`metadata.user_id` + `metadata.actor_id`) per §3.6 — the unified-table choice doesn't dilute the actor encoding.

**Participant auth flows (F-AUTH-1, F-AUTH-2, F-AUTH-3, F-AUTH-4, F-AUTH-5).** Events rows emit to `events` (Bucket A) with `metadata.user_id = users.id` and `metadata.actor_id = users.id` (self-actor). Event types: `user.oauth_signed_in`, `user.otp_signed_in`, `user.pseudonym_assigned`, `user.tos_accepted`, `user.signed_out`. The actor IS the user; the metadata encoding makes participant rows filterable at dataset-export time.

**Admin auth flow (F-AUTH-ADMIN + F-AUTH-5-ADMIN).** Events row emits to `events` (Bucket A) with `metadata.user_id = NULL` and `metadata.actor_id = 'admin-singleton'`. Event types: `admin.signed_in`, `admin.signed_out`. Both carry `aggregate_type = 'admin_session'` with `aggregate_id = admin_sessions.session_id` (the row created at login, deleted at logout — captured via `RETURNING session_id` at login and via the cookie value at logout). The metadata encoding signals to downstream consumers (dataset-export pipeline at §19, audit search at F-ADMIN-5, observability tag set at §17) that the row is admin-actor — there is no pseudonym to map for the public dataset; admin rows pass through without pseudonymization per §3.6.

**The session tables themselves are NOT append-only.** `sessions` and `admin_sessions` are Bucket C — they update (`last_seen_at`) and delete (logout) routinely. Only the auth-flow *outcomes* are events; the session-row lifecycle is mutable state.

### §8.9 URL-exposure rule on auth surfaces

Per ADR-0016 D6 + §16. Auth-surface routes follow the participant-vs-admin URL-exposure asymmetry:

- **Participant routes use pseudonym slugs.** `/profile/<pseudonym>` (not `/profile/<users.id>`). Comment permalinks reference natural ordering or server-rendered short IDs (not raw `comments.id`). The acceptance test `id::raw-uuid-not-in-participant-urls` at `tests/server/identity/no-raw-uuid-in-urls.test.ts` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter.
- **Admin routes MAY carry raw UUIDs.** `/admin/users/<user_id>`, `/admin/markets/<market_id>` — operator ergonomics during moderation outweigh the URL-aesthetic concern, and admin surfaces are never indexed or shared. Raw UUIDs in admin URLs are explicitly permitted.
- **Dataset release uses raw UUIDs.** The 2026-11-06 public-dataset release carries raw `users.id`, `markets.id`, `comments.id` as join keys per SPEC.1 §12.2 — raw UUIDs are the correct join primitive for offline analysis. Pseudonymization happens at export-time JOIN per §19.3.

The asymmetry is enforced at the route-handler-file level, not the URL parser. SCAFFOLD.* implements `tests/server/identity/no-raw-uuid-in-urls.test.ts` at the implementation pass.

### §8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Better Auth instance + plugins + databaseHooks + cookie config | `src/server/auth/index.ts` |
| Resend `sendVerificationOTP` callback body | `src/server/auth/email-otp.ts` |
| Session-deferral hook (pseudonym + ToS gate) | `src/server/auth/session-gate.ts` (re-exported into `index.ts`) |
| Better Auth catch-all route handlers | `src/app/api/auth/[...all]/route.ts` |
| Better Auth + plugin version pins | `package.json` |
| Drizzle schema for `users`, `sessions`, `accounts`, `verifications`, `admin_sessions` | `src/db/schema/auth.ts` (per ADR-0008 §4 — single auth-domain file spanning ADR-0004 + ADR-0010 ownerships) |
| Admin login Server Action | `src/server/auth/admin/login.ts` |
| Admin logout Server Action | `src/server/auth/admin/logout.ts` |
| Admin session validator (Layer 2 security boundary) | `src/server/auth/admin/validate.ts` |
| Participant logout Server Action | `src/server/auth/logout.ts` |
| Middleware (Layer 1 redirect UX, NOT security boundary) | `proxy.ts` (formerly `middleware.ts`) at repo root |
| Acceptance test for raw-UUID-not-in-participant-URLs | `tests/server/identity/no-raw-uuid-in-urls.test.ts` |
| `BREAK_GLASS.md` admin-rotation procedure (suspected-compromise + scheduled rotation) | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per §21.3 + ADR-0010) |

ADRs consumed by §8: ADR-0004 (Better Auth library + Drizzle adapter + database session strategy + session-deferral hook + Email-OTP plugin + Cloudflare Turnstile via `hooks.before` + cookie naming + UUIDv7 generateId override), ADR-0010 (hand-rolled admin auth + static-password timing-safe comparison + transactional DELETE+INSERT + two-layer defense-in-depth per CVE-2025-29927 + identical-401 information-leak avoidance + three-column `admin_sessions` schema + `BREAK_GLASS.md` rotation), ADR-0011 (pseudonym pool consumption at F-AUTH-3 transaction within `identity_pool` Bucket-B `assigned_at` whitelisted transition), ADR-0014 (auth gate as first step of every state-mutating handler — handler-stack step 1 per §3.1), ADR-0016 D4 (UUIDv7 column-type override across all four Better Auth tables) + D6 (URL-exposure rule on participant vs admin vs dataset routes). 3-A R1 absorbs `accounts` as fourth Better Auth table in §5.1; 3-A R2 + §3.7 provides canonical seven-field `events.metadata` set consumed by §8.8 auth-flow writes.

---

## §9 Concurrency & Transactions (D2 ratified by ADR-0013)

The bet handler runs as a single Postgres SERIALIZABLE transaction. The pool row is locked pessimistically via `SELECT … FOR NO KEY UPDATE` — NOT `FOR UPDATE`. The distinction is operationally significant: `FOR UPDATE` conflicts with `FOR KEY SHARE` (the lock taken implicitly by Postgres on a parent row when a child INSERT validates its FK), which would block every concurrent `INSERT INTO positions / bets / comments` against the same market for the duration of every in-flight bet. `FOR NO KEY UPDATE` does not. The bet handler never modifies `pools.id` or any FK-target column, so the weaker lock is correct. Verified against the Postgres 17 row-level lock conflict matrix (https://www.postgresql.org/docs/17/explicit-locking.html, §13.3.2, Table 13.3).

**Canonical lock order**, applied uniformly across every bet — F-BET-1 / F-BET-2 / F-BET-3 / F-COMMENT-1 / F-COMMENT-2 / F-COMMENT-3 — never reordered, only subset-skipped:

```
pools → positions → dharma_ledger → events
```

`events` is terminal in the chain per ADR-0005's read-model classification convention, with all per-user writes (`positions`, `dharma_ledger`) co-located ahead of it. For a **comment-bearing bet** (every post-bet and reply-bet under reply-as-bet), the `bets` and `comments` rows are Bucket-A appends inserted **within** this transaction (INV-1 atomic bet+comment) — they are not additional lock points (no `SELECT … FOR …` is taken on them), so they do not change the lock-order spine. The comment-free sell (F-BET-3) omits the `comments` insert.

**Retry policy**: full jitter on bases [50, 100, 200] ms, 3-retry budget, retry on SQLSTATE 40001 (`serialization_failure`) AND 40P01 (`deadlock_detected`). Wait formula `wait_ms = floor(random_uniform(0, base_ms[n]))` per Marc Brooker, *"Exponential Backoff And Jitter"*, AWS Architecture Blog, 4 Mar 2015 (https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/). Application errors (validation, slippage, FK violations not caused by 40P01) are NOT retried.

**Observability**: Sentry `addBreadcrumb` per retry attempt (O(1) wire cost, rides alongside any subsequent Sentry event in the same scope); Sentry `captureMessage` only on terminal exhaustion firing alarm 3 (per §17 alarm 3) tagged `bet_serialization_exhausted` with the SQLSTATE and the originating flow (F-BET-1 / F-BET-2 / F-BET-3).

**Idempotency-key cache lookup is the FIRST authenticated step in every bet handler** — before pre-commit moderation, before the SERIALIZABLE transaction opens, before the pool lock is acquired. Cache hit (completed entry) returns the cached `(status, body)` and exits the handler; no OpenAI call, no Postgres transaction. This protects against non-deterministic OpenAI moderation re-runs on completed-but-network-dropped bets and bounds OpenAI cost by unique requests, not retry count. Storage substrate, key envelope, body-hash discipline, lock-vs-result TTL split, and error-envelope shapes for in-flight and body-mismatch cases are ratified in ADR-0015 (SPEC.16) and substantively absorbed at §11 — Redis SETNX-with-pending-sentinel substrate, global key scoping, RFC 8785 canonical-JSON full-body SHA-256 fingerprint, 30-second pending TTL + 24-hour completed-response TTL, HTTP 409 with `error_idempotency_key_reused` for body-mismatch, HTTP 409 with `error_idempotency_in_flight + Retry-After: 2` for in-flight collision (mirrors §10's moderation-reservation-collision shape verbatim).

**OpenAI moderation runs entirely OUTSIDE this transaction** (per §10 + ADR-0014). The bet transaction wrapper is moderation-unaware; under reply-as-bet every comment-bearing bet (F-BET-1, F-BET-2, F-COMMENT-1/2/3) invokes moderation before calling the wrapper, and the comment-free sell F-BET-3 skips it. Holding a Postgres transaction open across the 200–2000 ms moderation HTTP call is a `REFUSAL:`.

**Retry exhaustion response shape**: HTTP 503 with `error_code: bet_serialization_exhausted`, `error_type: temporary_unavailable`, `Retry-After: 1`. Distinct from F-BET-5 (HTTP 400 `market_closed_at`) and F-BET-6 (HTTP 400 `in_flight_timeout`). Lands in `docs/specs/error-codes.md` when that file is drafted (SPEC.2 §15 owns the envelope shape; the codes list lives in `error-codes.md`).

**Single source of truth**: the bet transaction wrapper at `src/server/bets/transaction.ts` exposes a single helper that opens the SERIALIZABLE transaction, acquires the pool-row lock via Drizzle's `.for('no key update')` (per ADR-0008), runs the per-flow callback containing the lock-order chain, applies the retry policy (`BACKOFF_BASES_MS`, `RETRYABLE_SQLSTATES` co-located with the wrapper as decision parameters of ADR-0013, NOT tunables), and emits the alarm-3 custom event on terminal exhaustion. ENGINE.7 implements (Ultrathink mandatory).

---

## §10 Pre-Commit Moderation Contract

> **[Substantively absorbed from ADR-0014 (SPEC.15) on 2026-05-07.]**

Pre-commit moderation runs on every comment-bearing bet. Under the v1.9.0 reply-as-bet model every post and reply carries mandatory commentary, so the moderated set is F-BET-1 (entry post-bet, atomic with the bet, governed by INV-1 and F-MOD-4), F-BET-2 (subsequent post-bet), F-COMMENT-1 (additional post-bet), F-COMMENT-2 (reply-bet), and F-COMMENT-3 (image-attached bet) — the comment-free sell (F-BET-3) is the only bet that skips moderation. The flow is parameterised by caller and exposed as a single function `precommitModerate()` in `src/server/moderation/precommit.ts`. ADR-0014 is the source of truth for substance; SPEC.2 §10 names the load-bearing contract.

**Vendor selection.** OpenAI `omni-moderation-latest` (snapshot-pinned `omni-moderation-2024-09-26`) for text and multimodal classification — the SOLE moderation vendor for the experiment phase. **No second image-classifier vendor in experiment phase** — `omni-moderation-latest` covers the violence (including `violence/graphic`), self-harm (including `self-harm/intent` and `self-harm/instructions`), and `sexual` (non-minors) image categories natively, and is free of charge per OpenAI Help Center as of May 2026. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, and `sexual/minors` categories accept text inputs only per OpenAI's `omni-moderation-2024-09-26` capability table. The 6 non-CSAM text-only categories form an accepted v1 image-input gap (omni-moderation-2024-09-26 limitation, not a Zugzwang design choice); operational mitigation via SPEC.1 §15 F-ADMIN-4 extended scope (per SCAFFOLD.16 F-γ-thin: admin inline removal of pass-verdict comments); empirical measurement via HARDEN.5 sample-content testing. `sexual/minors` is also text-only but is routed per the SCAFFOLD.16 LD-3 carve-out (text-only → Track B admin review; `imageR2Key`-present escalation → Track A), not as an accepted v1 gap. `weapons` is not an OpenAI moderation category; weapon-policy content moderation relies on F-ADMIN-4 end-to-end. **Second-vendor (PhotoDNA / Safer / Hive) optionality deferred per SCAFFOLD.16 LD-1 → `docs/parked.md`.**

**Track A image-presence carve-out (SCAFFOLD.16 LD-3).** Text-only `sexual/minors === true` flags route to Track B (admin review) rather than Track A (auto-ban). Image-attached `sexual/minors === true` flags route to Track A. Rationale: text-classifier false-positive risk for the CSAM-adjacent category is elevated by news/fiction/educational content vectors; admin-review mitigation aligns with industry practice (Bluesky, Roblox, Reddit). At the model level, `sexual/minors` is text-only on `omni-moderation-2024-09-26` per OpenAI docs (image input returns score 0 for this category); the carve-out is therefore aligned with classifier capability, not just policy. Post-experiment hardening recommendations (R-1 predicate strengthening, R-2 verdict-shape expansion, R-3 retry-policy expansion) deferred per `docs/parked.md` "SCAFFOLD.16 §research — R-1/R-2/R-3 hardening".

**Server Action sequence (mandatory order).**

1. **Auth gate** at the Server Action boundary (per ADR-0004 / SPEC.4).
2. **Idempotency cache lookup** as the first authenticated work (per ADR-0013 §3). On hit, return cached `(status, body)` verbatim; no moderation, no transaction.
3. **Redis SETNX intent reservation** on `mod:reserve:{user_id}:{market_id}:{idempotency_key}` with a 10-second TTL. On collision, return HTTP 409 `moderation_in_flight` with `Retry-After: 2`. Release in `finally`; the TTL is the safety net.
4. **Call `precommitModerate(input)`.** Returns `{ outcome: 'pass' | 'track_a' | 'track_b'; categories?: string[] }`.
5. **Branch on verdict:**
   - **`pass`** — open the §9 W-1 bet transaction (per ADR-0013). For a comment-bearing bet (F-BET-1, F-BET-2, F-COMMENT-1/2/3) this inserts the paired `bets` + `comments` rows atomically inside that transaction; there is no separate comment-only transaction under reply-as-bet.
   - **`track_a` / `track_b`** — write a `mod_actions` row in a standalone short transaction; return the SPEC.1 §14 F-MOD-* response. The bet/comment transaction **never opens**.

**No Postgres transaction is held across an HTTP call (`REFUSAL:` per CLAUDE.md golden rules + SPEC.2 §9 + ADR-0013 §8).** OpenAI HTTP calls happen in steps 3–4, fully outside any database transaction. The bet wrapper from ADR-0013 stays moderation-unaware.

**OpenAI HTTP call shape.** `POST https://api.openai.com/v1/moderations` with model `omni-moderation-2024-09-26`. Multimodal input array on image-attached submits (text + image_url with a 60-second signed R2 read URL). 3-second timeout per attempt. **One retry** on transient failure (network error / timeout / 5xx / 429). **No retry** on 4xx auth errors (401 / 403) — these fire `openai_moderation_auth_failure` (separate Sentry event under §17 alarm 4) and fail closed.

**Failure mode: fail-closed.** On terminal failure of the OpenAI call (after retry), the handler emits a Sentry custom event (`openai_moderation_upstream_failure` per §17 alarm 4 — see §17.2 master table row 4 for the full alarm catalogue entry), releases the Redis reservation, writes no `mod_actions` row, writes no bet/comment row, and returns HTTP 503 `moderation_unavailable` with `Retry-After: 5`. This mirrors the idempotency-fails-closed posture in §11; it does **not** mirror the rate-limit-fails-open posture, because a moderation outage that fails open is a legal-floor breach for CSAM-adjacent categories per SPEC.1 §16.5 (NCMEC auto-report mechanism deferred to post-experiment per SCAFFOLD.16 LD-7; the legal-floor framing remains via SPEC.1 §16.5's CSAM detection + reporting compliance bullet).

**F-MOD-4 atomicity (entry case).** Preserved structurally: on Track A or Track B verdict, the bet+comment transaction never opens, so INV-1 holds trivially because there is no partial state to roll back. ADR-0014 §7 names this discipline; SPEC.2 §14 (Invariant Contract) absorbs it at the §14 drafting pass.

**Track A degrade mode (HARDEN.5 trigger).** SPEC.1 §14 F-MOD-1 (auto-ban on Track A) and §14 preamble both label the auto-ban as `provisional` pending Aug 15–31 sample-content testing. If HARDEN.5 surfaces unacceptably high false-positive rates, Track A degrades to **flag-only mode**: content blocked, `mod_actions` written, user **not** banned, admin reviews queue and bans manually via SPEC.1 §15 F-ADMIN-4. The degrade decision is owned by HARDEN.5 and ratified via a follow-up ADR or HARDEN.5 close-out memo at that time.

**Single source of truth.** `src/server/moderation/precommit.ts` owns the function, the verdict shape, the OpenAI call orchestration, the Redis reservation lifecycle, the Sentry emission, and the constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`, `RESERVATION_KEY_PREFIX`, `RESERVATION_TTL_SECONDS`). The OpenAI-specific HTTP wrapper lives in `src/server/moderation/openai.ts`. The full file map is absorbed into Appendix A on its drafting pass.

ADR-0014 holds the full decision body, eight ratified primitives, seven considered options with verdicts, and the closing italic summary. SPEC.2 §10 is the cross-reference; ADR-0014 is the canonical text.

---

## §11 Rate-Limit & Idempotency Contract

> **[Substantively absorbed from ADR-0015 (SPEC.16) on 2026-05-07.]**

Every state-mutating endpoint runs through a five-step shared contract: auth gate → idempotency-key validation → idempotency cache lookup → rate-limit check → handler body. Two helper modules carry the contract: `src/server/middleware/rate-limit.ts` (rate-limit middleware) and `src/server/idempotency/cache.ts` (idempotency cache helper). Both run on Upstash Redis (per ADR-0006 §3); their failure modes are deliberately asymmetric (per ADR-0006 §"Failure-mode profile"). ADR-0015 is the source of truth for substance; SPEC.2 §11 names the load-bearing contract.

**Per-surface rate-limit table.** Each row is a sliding-window `Ratelimit` instance configured via `Ratelimit.slidingWindow(maxRequests, windowDuration)` from `@upstash/ratelimit` v2.0.8 against a per-identifier Redis key:

| Surface | Identifier | Window | Constant |
|---|---|---|---|
| OTP request (per email) | `otp-email:{email}` | 1h | `OTP_REQUESTS_PER_EMAIL_PER_HOUR` |
| OTP request (per-IP burst) | `otp-ip:{ip}` | 1m | `OTP_REQUESTS_PER_IP_BURST_PER_MIN` |
| Admin login (per-IP) | `admin-login-ip:{ip}` | 1h | `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` |
| Bet `place` / `sell` **and comment-bearing bets** (posts/replies) per-IP anti-abuse burst | `bet-ip:{ip}` | 1m | `BET_ATTEMPTS_PER_IP_PER_MIN` *(new — minted by ADR-0015)* |
| R2 signed-PUT URL mint per-IP | `image-put-ip:{ip}` | 1m | `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` *(new — minted by ADR-0015)* |

Under the v1.9.0 reply-as-bet model there is **no standalone comment or vote rate-limit budget** — the v1.8.x `write-budget` (per-market 24h) + `write-burst` (per-user 1m) pair is removed, and friendly-fire is gone entirely. Posts and replies are bets, so their anti-abuse posture is the bet posture: the per-IP burst cap (`bet-ip`, `BET_ATTEMPTS_PER_IP_PER_MIN`). Bet placement and image-PUT-URL surfaces use **per-IP** identifiers because the threat model is credential-stuffed bot traffic across many compromised accounts; per-user limits only fire after a successful login and are the wrong defense surface. **Open question (deferred):** whether reply-bets warrant an *additional* per-market productive cap distinct from top-level bets (which are exempt from a per-market productive cap by design) — to bound reply-flooding within a single market — is left to the HARDEN.6 number-tuning pass per SPEC.1 §8; if adopted it would mint a new per-market reply-bet constant, otherwise the per-IP cap is the sole control. Numeric values for every constant are deferred to HARDEN.6 per the project-wide deferral rule.

**Idempotency contract — header, key shape, storage.** Header: `Idempotency-Key: <opaque-string>` matching `^[A-Za-z0-9_-]{1,255}$`. Server validates format and rejects malformed with HTTP 400 `error_idempotency_key_invalid`. Required on the bet Route Handlers (`place`, `sell`); the comment-bearing-bet **Server Actions** (`placeDirectComment`, `placeReply`, `placeImageComment`) carry no `Idempotency-Key` header — the Server Action protocol owns the request shape (§4.4) — and instead rely on natural-key uniqueness `(user_id, market_id, body_hash, posted_at_minute)`, which protects against duplicate-write hazards; **exempt** on file-storage PUT-URL mint (`POST /api/uploads/sign`) per SCAFFOLD.15 Q2 ratification — orphan-sweep handles duplicate-mint cleanup within `ORPHAN_WINDOW_MINUTES` per §12.6 (double-mint risk accepted; cleanup cost is one stale R2 object pruned within ≤2h). Scoping: **global** — matched on the key value alone, regardless of HTTP method or path; cross-endpoint reuse with mismatched body triggers the body-fingerprint mismatch path. Body fingerprint: SHA-256 of canonical-JSON-serialised request body (RFC 8785 — sorted keys, no insignificant whitespace, UTF-8), hex-encoded. Storage substrate: Redis SETNX-with-pending-sentinel on Upstash, two-tier TTL — 30-second pending sentinel for in-flight requests (sized for §10 / ADR-0014's 10-second moderation reservation worst case + §9 / ADR-0013's bet-transaction worst case ~600ms upper + slack); 24-hour completed-response cache replay (matches Stripe's published contract).

**Single-key-encoding-both-states pattern.** One Redis key per idempotency-key encodes both lifecycle states. On cache miss, the handler executes `SET idem:{key} <pending-sentinel> NX EX 30`; the `NX` flag means "only set if key does not exist." If `NX` returns `0`, another in-flight request holds the sentinel and we return HTTP 409 `error_idempotency_in_flight` with `Retry-After: 2`. The pending-sentinel value is the constant string `"PENDING"` plus the body fingerprint (so the in-flight collision check can already detect body mismatch on a still-pending key). A body-fingerprint mismatch against a still-pending sentinel returns the in-flight collision shape (HTTP 409 `error_idempotency_in_flight + Retry-After: 2`), NOT the completed-mismatch shape (`error_idempotency_key_reused`) — surfacing two different errors mid-flight would confuse client retry policy, and the still-pending request may yet complete with a body that matches the eventual retry. On handler completion (success or terminal error), the handler executes `SET idem:{key} <completed-payload> EX 86400` where `<completed-payload>` is JSON-encoded `{ status, body, body_fingerprint }`. The atomic transition pending → completed is just a `SET` without `NX`, which Redis guarantees as atomic.

**In-handler call sequence (consumed by every state-mutating endpoint).**

1. **Auth gate** at the Server Action / route-handler boundary (per ADR-0004 / SPEC.4).
2. **Idempotency-key validation.** Reject missing required header with HTTP 400 `error_idempotency_key_required`; reject malformed with HTTP 400 `error_idempotency_key_invalid`.
3. **Idempotency cache lookup** via `idempotencyLookupOrReserve(key, bodyFingerprint)`. Branch on the tagged-union result: `hit` returns the cached response verbatim; `pending` returns HTTP 409 `error_idempotency_in_flight + Retry-After: 2`; `mismatch` returns HTTP 409 `error_idempotency_key_reused`; `unavailable` returns HTTP 503 `error_idempotency_unavailable + Retry-After: 5`; `miss` returns a `release` callback the handler MUST call in `finally` to either write the completed response (success / terminal error) or `DEL` the pending sentinel (handler crash).
4. **Rate-limit check** (per the surface table). On rate-limit-exceeded, write the HTTP 429 response into the idempotency cache (so subsequent retries with the same key return the cached 429), then return HTTP 429 `error_rate_limit_exceeded` with `Retry-After: <seconds>` derived from `Ratelimit.limit().reset`.
5. **Pre-commit moderation** (per §10 / ADR-0014 — every comment-bearing bet; the comment-free sell skips).
6. **Bet transaction wrapper** (per §9 / ADR-0013) or other handler body.
7. **Cache the completed response** under the 24h outer TTL via the `release` callback from step 3.

Steps 1–4 and step 7 are universal for every state-mutating endpoint; steps 5–6 are bet-flow-specific.

**Failure-mode contract: three concerns, three postures.** **Rate-limit fails OPEN on Upstash unreachable** — middleware catches the error, emits a Sentry event tagged `upstash_unavailable_rate_limit` (per §17 alarm 6a), and admits the request. Brief abuse windows are accepted as the cost of not user-blocking on a vendor outage. **Idempotency fails CLOSED on Upstash unreachable** — cache helper catches the error, emits a Sentry event tagged `upstash_unavailable_idempotency` (per §17 alarm 6b), and returns HTTP 503 `error_idempotency_unavailable + Retry-After: 5` without executing the handler. The bet+comment is never persisted; the user retries. **Pre-commit moderation also fails CLOSED** (per §10 / ADR-0014) on legal-floor grounds — SPEC.1 §16.5 CSAM detection + reporting compliance cannot be bypassed by a fail-open moderation outage (NCMEC auto-report mechanism deferred to post-experiment per SCAFFOLD.16 LD-7; the legal-floor framing remains via SPEC.1 §16.5's CSAM detection + reporting compliance bullet). The asymmetry across the three concerns is deliberate per ADR-0006 §"Failure-mode profile": open / closed / closed.

**Cached error responses include 429s.** A request that hits the rate-limit (HTTP 429) is cached under its idempotency-key; subsequent retries with the same key return the cached 429, NOT a fresh execution — the rate-limit was a deterministic property of the original request, and a client retrying after rate-limit recovery should generate a fresh idempotency-key. This matches Stripe and the IETF Idempotency-Key draft.

**No server-side retry on state-mutating endpoints.** A single Upstash failure surfaces directly to the client. The client owns retry policy.

**Distinction from §10's moderation reservation.** The 10-second Redis intent-reservation key (per §10 / ADR-0014) on `mod:reserve:{user_id}:{market_id}:{idempotency_key}` is structurally distinct from the idempotency cache key (per this section) on `idem:{key}`. The reservation guards the in-flight window between cache miss and cache write and holds for 10 seconds; the idempotency cache replays completed responses for 24 hours. Both consume the same `Idempotency-Key` header from the client request but on disjoint Redis key spaces. The reservation never sees the cached response; the cache never sees the reservation state. Both fail closed; both emit §17 alarm 6 on Upstash unreachable (sub-IDs 6a + 6b respectively per §17.2 alarm-6 sub-table).

**Single source of truth.** `src/server/middleware/rate-limit.ts` owns the per-surface `Ratelimit` instances, the fail-open posture, the alarm-6 emission, and the identifier-extraction helpers. `src/server/idempotency/cache.ts` owns the `idempotencyLookupOrReserve` helper, the body-fingerprint computation, the fail-closed posture, and the alarm-6 emission. `src/server/idempotency/types.ts` owns the constants (`Idempotency-Key` header name, validation regex, `PENDING_TTL_SECONDS = 30`, `COMPLETED_TTL_SECONDS = 86400`) and the error-envelope codes. The two new Appendix B constants (`BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`) live alongside the other §16.1 rate-limit constants in `src/server/config/limits.ts` per SCAFFOLD.4 (the v1.8.x comment-budget constants `RATE_LIMIT_PER_MARKET_PER_DAY` + `RATE_LIMIT_BURST_PER_MIN` are removed under reply-as-bet; the §16.1 constant set is SPEC.1-owned per ADR-0018). The full file map is absorbed into Appendix A on its drafting pass.

ADR-0015 holds the full decision body, seven dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §11 is the cross-reference; ADR-0015 is the canonical text.

---

## §12 File Storage Contract

§12 owns the *file-storage contract* for the experiment-phase build — Cloudflare R2 as the object-store vendor with two structurally distinct buckets, server-mediated signed-PUT URLs as the upload primitive, the F-COMMENT-3 image-attached-comment six-step orchestration that integrates with §10 pre-commit moderation + §11 idempotency + §3.5 orphan sweep, and the deferred-from-§5 `image_uploads` Bucket-B classification with two-column atomic transition. ADR-0006 owns vendor selection + jurisdiction + bucket inventory + failure-mode profile; ADR-0014 owns the multimodal moderation HTTP call shape including the signed-READ TTL; ADR-0015 owns the per-IP rate-limit class on the PUT-URL mint endpoint; ADR-0011 owns the static-bucket asset-pipeline source-of-truth for identity-pool PFPs. §12 sits above all of them at the contract layer, naming the two-bucket lifecycle distinction and the F-COMMENT-3 orchestration sequence. Operational specifics (CORS policy, signed URL TTL value, bucket-policy JSON, object-key literal pattern) are SCAFFOLD.15 territory per §12.9.

### §12.1 Two-bucket lifecycle pattern

Cloudflare R2, jurisdiction `APAC` (Mumbai region per ADR-0006 §4). Two buckets in v1, structurally distinct lifecycle patterns:

| Dimension | `zugzwang-uploads` (dynamic) | `zugzwang-pfp` (static) |
|---|---|---|
| Purpose | Image-attached comment uploads via F-COMMENT-3 | 50,000 pre-baked pseudonym profile pictures per ADR-0011 |
| Lifecycle | Per-upload signed-PUT mint, moderation-gated commit, orphan sweep eligible | Pre-baked once before launch by asset pipeline, no runtime mints |
| Read access | Private; signed-read URLs minted per moderation call (60s TTL) and per render (TTL deferred to SCAFFOLD.15) | Public-read on `v1/*`; long-lived public CDN URL composed at frontend render time |
| Object metadata | `x-amz-meta-user-id`, `x-amz-meta-image-uploads-id` for orphan-sweep correlation only | `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable` |
| Orphan-sweep applicability | YES — Vercel Cron carve-out per §3.5 Pattern A-2 + §12.6 | NO — static bucket, no rows to reconcile |
| Bucket-policy detail owner | SCAFFOLD.15 | ADR-0011 + asset pipeline |

The two buckets share the same R2 jurisdiction but no other operational shape. A reader looking at upload-flow code goes to `zugzwang-uploads`; a reader looking at pseudonym-rendering code goes to `zugzwang-pfp`. They are referenced by name across the codebase and do not generalise into a "media bucket" abstraction.

### §12.2 Image-attached comment flow (F-COMMENT-3)

Six-step orchestration consuming §10 + §11 + §12 jointly. The R2 object exists from step 3 onward regardless of moderation outcome; the DB-side `image_uploads` row tracks commit vs orphan vs blocked.

1. **Client requests PUT URL.** `POST /api/uploads/sign` per §4.3. Body declares the intended `Content-Type` and content-length range. The handler runs §11 steps 1–4 (auth, idempotency-validate, idempotency-lookup, rate-limit on `image-put-ip:{ip}`).
2. **Server mints UUIDv7 + R2 object key + signed PUT URL + `image_uploads` row.** Inside one Postgres transaction (Bucket-B insert): generate `image_uploads.id` UUIDv7 per ADR-0016 D1; build the structurally-required object key (per-user-namespaced, UUID-derived, file-extension-preserved — the literal pattern is SCAFFOLD.15 territory per §12-R2); request a presigned PUT URL from R2 scoped to that exact key + Content-Type + Content-Length-Range; INSERT `image_uploads` with `terminal_state = NULL`, `terminal_at = NULL`, `r2_object_key`, `user_id`, `created_at = now()`. Return the signed PUT URL + the `image_uploads.id` to the client.
3. **Client PUTs file bytes to R2 directly.** The signed URL bypasses the Vercel function per K3 (server doesn't proxy bytes — keeps function memory and CPU off the upload path). R2 stores the object; the user-metadata headers `x-amz-meta-user-id` + `x-amz-meta-image-uploads-id` ride along for orphan-sweep correlation only (§12-R3 — moderation linkage is DB-side, not R2-metadata-side).
4. **Client posts comment with `image_uploads_id`.** `placeImageComment(input)` Server Action per §4.2. Input carries the comment body + the `image_uploads_id` returned at step 2.
5. **Server runs full §11 handler stack including §10 multimodal moderation.** The moderation step calls `precommitModerate()` with a multimodal input array (text + image_url with a 60-second signed R2 read URL minted at §12.4); OpenAI omni-moderation-2024-09-26 per ADR-0014 §10.
6. **Branch on verdict:**
   - **`pass`** — open the §9 W-1 bet transaction per §3.2 (placeImageComment is a comment-bearing bet under reply-as-bet): lock-order `pools → positions → dharma_ledger → events`; insert the paired `bets` + `comments` rows (the comment carries the `image_uploads_id` foreign key; INV-1 atomic bet+comment per §14.1); UPDATE `image_uploads` SET `terminal_state = 'committed'`, `terminal_at = now()` (the whitelisted Bucket-B two-column atomic transition per §12-R1); insert `events` row.
   - **`track_a` / `track_b`** — write `mod_actions` row carrying `image_r2_key` linkage in a standalone short transaction; UPDATE `image_uploads` SET `terminal_state = 'blocked'`, `terminal_at = now()`. The bet+comment transaction never opens.

The R2 object exists from step 3 onward regardless of step-6 outcome. On the `track_a` / `track_b` branch the R2 object is preserved for the admin moderation queue's review surface — admins viewing the queue see what the user attempted to upload before clicking "ban" or "warn." The orphan sweep at §12.6 reconciles the case where step 4 never fires (client uploads to R2 then never submits the comment Server Action — handler-stack-step-4-or-later crash, network drop after step 3, deliberate abandonment).

### §12.3 Signed-PUT URL mint endpoint

Server-mediated. Endpoint: `POST /api/uploads/sign` per §4.3 (F6 family — internal/external integrations). The client does NOT compute the signed URL; the server signs against its R2 credentials and returns the URL to the client.

**Per-IP rate limit.** `image-put-ip:{ip}` 1m sliding window per §11's per-surface rate-limit table + ADR-0015. The threat model is credential-stuffed bot traffic minting throwaway PUT URLs to fill the bucket; per-user limits don't fire until a successful login and are the wrong defense surface.

**Scoped per upload.** The signed URL is bound to (i) the exact R2 object key minted at §12.2 step 2, (ii) the declared `Content-Type`, (iii) a `Content-Length-Range` constraint. A client that PUTs a different content type or oversized body to the URL is rejected by R2 directly — the server doesn't need to validate at step 4. R2 does not enforce `Content-Length-Range` at signing time per its S3-compat contract; the byte-size cap is enforced post-PUT via `HeadObject` + R2 native lifecycle rule (90-day prefix `u/` expire per SCAFFOLD.15 operator substrate, bumped from 30d to span the experiment's 51-day live window + archive headroom — see SCAFFOLD.15 SURPRISE-7) as the backstop layer.

**TTL.** 60 seconds per SCAFFOLD.15 Q2 ratification — long enough for `pick file → review → submit` (~30s typical), short enough to bound exfiltrated-URL exposure. Constant lives at `src/server/config/limits.ts` `PUT_URL_TTL_SECONDS`.

### §12.4 Signed-READ URL for OpenAI multimodal moderation

Separate from the PUT URL. 60-second TTL per ADR-0014 §"Image URL format". Generated at `precommitModerate()` entry inside §10's Server Action sequence — the URL is constructed from the R2 client wrapper (`src/server/storage/r2.ts`), passed to OpenAI's `omni-moderation-2024-09-26` as the `image_url` field in the multimodal input array, and discarded after the API call returns.

The TTL is deliberately tight: a 60-second signed-read URL exfiltrated mid-moderation is useless 60 seconds later. The OpenAI call completes within the §10 3-second-timeout budget plus retries; 60 seconds is generous safety margin.

This is structurally distinct from any committed-comment rendering TTL — the rendering TTL is SCAFFOLD.15's call and applies to the read-side URL clients receive when viewing committed image-attached comments. The §12.4 60-second URL is for OpenAI only and never flows to a client browser.

### §12.5 `image_uploads` Bucket classification — Option B ratified

The deferred §5 row 20 ratification ask from 3-A is closed at 3-B. Two viable patterns were considered:

**Option A (rejected) — Bucket C with hard delete.** `image_uploads` mutable; UPDATE on commit, hard DELETE on orphan-sweep. Rejected on three grounds: (i) audit-trail integrity for admin investigations into rejected-upload patterns is lost (the `track_a` / `track_b` `terminal_state` row vanishes when its R2 object is swept); (ii) inconsistency with the §16.4 audit-log philosophy, which mirrors `mod_actions` append-only discipline; (iii) H2-scrub correctness — hard-deleting `image_uploads` rows that reference users whose H2 erasure has fired creates a surface where erased-user evidence partially survives in `mod_actions.image_r2_key` without the corresponding `image_uploads` provenance.

**Option B (ratified) — Bucket B append-only with two-column atomic transition.** `image_uploads.terminal_state` + `image_uploads.terminal_at` set together once via a single UPDATE; the §6.3 trigger function rejects partial transitions, re-firing, and any non-whitelisted column changes. The three terminal states are `'committed'` (step 6 pass branch), `'blocked'` (step 6 track_a/track_b branch), `'orphan'` (orphan-sweep branch — see §12.6). Audit trail preserved; H2 erasure scrubs `r2_object_key` to NULL and PII columns, but the row itself remains as evidence; consistent with §6's broader Bucket-B discipline.

The §6.3 per-table trigger function for `image_uploads` is the only Bucket-B trigger in v1 with a multi-column transition shape. The trigger SQL is at `drizzle/migrations/<NNNN>_append_only_triggers.sql`; SCAFFOLD.2 implements alongside the other twelve protected-table trigger entries.

### §12.6 Orphan sweep

Restated from §3.5 Pattern A-2 for the §12 reader. The single Vercel Cron HTTP-fanout job in v1 per ADR-0006:

- **Endpoint:** `GET /api/cron/r2-orphan-sweep` Route Handler at `src/app/api/cron/r2-orphan-sweep/route.ts` (Vercel Cron contract supports GET only — see SCAFFOLD.15 SURPRISE-1).
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` header; Vercel Cron is the only legitimate caller. Constant-time compare per `crypto.timingSafeEqual`.
- **Cadence:** `0 */6 * * *` per SCAFFOLD.15 Q7 ratification (every 6 hours; Vercel Pro tier required for sub-daily cadences).
- **Logic:** Query `image_uploads` rows where `terminal_state IS NULL` AND `created_at < now() - ORPHAN_WINDOW_MINUTES`; for each row, DELETE the R2 object via the R2 client; UPDATE the row SET `terminal_state = 'orphan'`, `terminal_at = now()` (the whitelisted Bucket-B transition). The cron sweep is the **Layer 2** early-orphan reconciliation surface — it sweeps `terminal_state IS NULL` rows only. Bucket-B `'blocked'` rows are deleted from R2 by the **Layer 1** R2 native lifecycle rule (90-day prefix `u/` expire — bumped from 30d at SCAFFOLD.15 per SURPRISE-7); their DB rows stay in terminal `'blocked'` state for audit. The two layers are deliberately asymmetric — Layer 2 is precision (Vercel Cron deterministic cadence), Layer 1 is safety net (R2-native, 24-hour-fuzzy).
- **Failure mode:** Operational-only per ADR-0006 §"Failure-mode profile". A failed sweep does not affect any user-facing flow; storage cost grows (bounded by Layer 1 lifecycle); Sentry alarm 6e per §17.2 alarm-6 sub-table fires on Vercel Cron handler 5xx. Circuit breaker at 5 consecutive R2 failures aborts the sweep cleanly with `{status: 'r2_unavailable'}` HTTP 200 (NOT 5xx — Vercel cron should not treat a universal R2 outage as a cron failure; the next 6-hour fire retries).
- **Reconciliation invariant:** `image_uploads` rows with `terminal_state IS NULL` represent in-flight uploads (the user is still completing the F-COMMENT-3 client orchestration). Rows with `terminal_state = 'committed'` have a corresponding `comments.image_uploads_id` FK; rows with `'blocked'` have a `mod_actions.image_r2_key` linkage; rows with `'orphan'` have neither and the R2 object is deleted.

### §12.7 Identity-pool PFP bucket (`zugzwang-pfp`) static lifecycle

Per ADR-0011 + the asset pipeline at `experiment/asset-pipeline/`. 50,000 pseudonym profile pictures uploaded once before launch:

- **Pre-launch upload.** The asset pipeline (Flux sampler + Pillow compositor + ComfyUI workflow) generates 50,000 PNG-then-WebP-converted images locally on the DGX Spark, uploads each to `zugzwang-pfp/v1/<slug>` where `<slug>` is the deterministic `<colour>-<animal>-<number>` per ADR-0011 §1.
- **Object metadata.** `Content-Type: image/webp` + `Cache-Control: public, max-age=31536000, immutable`. The 1-year max-age + immutable flag tells Cloudflare's edge to cache aggressively forever; the `v1/` prefix is the version sentinel — a future re-bake bumps to `v2/` and the asset pipeline re-uploads.
- **Public-read on `v1/*`.** Bucket policy allows anonymous GET on `v1/*` only; no anonymous list, no anonymous write per ADR-0011 §"R2 storage" requirements (specific JSON owned by SCAFFOLD.15).
- **F-AUTH-3 does NOT mint signed PUT URLs into this bucket.** PFP selection happens via `identity_pool` Bucket-B `assigned_at` whitelisted transition (per §3.5 + ADR-0011) and writes `users.pfp_filename` to the slug. The frontend composes the public CDN URL at render time via a deterministic `${R2_PFP_BASE_URL}/v1/${pfp_filename}` template.
- **`R2_PFP_BASE_URL` substrate (experiment phase).** SCAFFOLD.15 sets `R2_PFP_BASE_URL` to the R2 public dev URL on `zugzwang-pfp` (e.g. `https://pub-<account-hash>.r2.dev`). The originally-planned custom domain `cdn.zugzwangworld.com` bind is **deferred to post-experiment** per SCAFFOLD.15 SURPRISE-8 — `zugzwangworld.com` DNS is hosted at Namecheap (not Cloudflare), and the partial-CNAME / nameserver-migration paths both carry unacceptable cost (Cloudflare Business plan ≥$200/mo) or risk (founder email continuity on `zugzwangworld@proton.me`) at experiment scale. Architectural impact: PFP reads have **no edge cache** during the experiment phase — every PFP fetch hits R2 directly (~50–100ms latency; R2 Class B Operations cost ≤$2 over the experiment window, well within the free tier). The custom-domain bind + DNS migration is a post-experiment tracker entry (testnet-phase scope).
- **H2 erasure** scrubs `users.pfp_filename` to NULL and PII columns, but does NOT delete the R2 object. The freed pseudonym tuple in `identity_pool` remains permanently retired (the `identity_pool.assigned_at` Bucket-B transition is one-shot per ADR-0011) — the R2 object becomes unreferenced but is preserved for any future audit need.

### §12.8 Failure-mode profile (R2 outage)

Restated from ADR-0006 §"Failure-mode profile" for the §12 reader. The blast radius of an R2 outage is partial degradation, not full-stop:

- **F-COMMENT-3 fails.** Step 1 (PUT URL mint) returns HTTP 503 from the R2 SDK; handler emits Sentry alarm 6c (R2-unreachable per §17.2 alarm-6 sub-table) and returns `error_storage_unavailable` to the client.
- **F-COMMENT-1, F-COMMENT-2, F-COMMENT-3 text-only succeed.** Comments without image attachments do not touch R2; only F-COMMENT-3 with an `image_uploads_id` is affected.
- **Existing edge-cached committed images render until cache expiry.** Cloudflare's edge caches successful GETs against `zugzwang-uploads` (read-side TTL per SCAFFOLD.15) and `zugzwang-pfp` (1-year immutable per §12.7); cached PFPs render indefinitely; cached committed-comment images render until their TTL elapses.
- **New signups blocked at F-AUTH-3 PFP-render step.** F-AUTH-3 does not touch R2 directly (no signed-PUT mint), but the welcome screen must render the user's freshly-assigned PFP — and the PFP image-fetch is a frontend GET against `zugzwang-pfp`. R2 outage breaks this fetch; no graceful degradation (the screen requires the PFP image — no fallback element). The signup completes successfully at the database layer; only the rendering of the welcome screen fails until R2 recovers.

### §12.9 SCAFFOLD.15 deferral boundary

Fourteen-row partition of concerns. §12 owns the structural and flow-contract surface; SCAFFOLD.15 owns operational and vendor-API substance; HARDEN.6 owns numeric values; HARDEN.* owns runbook content.

| Concern | Owner |
|---|---|
| R2 vendor selection (`Cloudflare R2`) | ADR-0006 |
| R2 jurisdiction (`APAC`) | ADR-0006 |
| Bucket inventory (`zugzwang-uploads` + `zugzwang-pfp`) | ADR-0006 + §12.1 |
| Two-bucket lifecycle pattern (dynamic vs static) | §12.1 |
| F-COMMENT-3 six-step orchestration | §12.2 |
| `image_uploads` Bucket-B classification (Option B) | §12.5 + §6.3 |
| Per-IP rate-limit class on PUT-URL mint | §11 + ADR-0015 |
| Multimodal signed-READ TTL (60s) | §12.4 + ADR-0014 |
| Object-key literal pattern — `u/{user_id}/{image_uploads_id}.{ext}` where `ext ∈ {jpg, png, webp, gif, avif}` lowercase canonical per MIME (locked at SCAFFOLD.15 Q9) | SCAFFOLD.15 ✓ |
| CORS policy on `zugzwang-uploads` | SCAFFOLD.15 |
| Bucket-policy JSON (anonymous-read `v1/*` rules, etc.) | SCAFFOLD.15 |
| Read-side signed URL TTL for committed images | SCAFFOLD.15 |
| PUT URL TTL value | SCAFFOLD.15 |
| Orphan window value (`<orphan_window>`) | HARDEN.6 |
| Cron cadence (literal cron syntax) | §21 + HARDEN.* |
| Vendor on-call procedure (`docs/runbooks/r2-unreachable.md`) | §21 + HARDEN.10 |

### §12.10 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| `POST /api/uploads/sign` Route Handler | `src/app/api/uploads/sign/route.ts` |
| `POST /api/admin/uploads/sign` Route Handler (admin moderation affordance) | `src/app/api/admin/uploads/sign/route.ts` |
| Server logic for sign-URL mint + `image_uploads` insert | `src/server/storage/sign-upload.ts` |
| Signed-READ URL helper (consumed by §10 moderation) | `src/server/storage/sign-read.ts` |
| Drizzle schema for `image_uploads` | `src/db/schema/image-uploads.ts` |
| R2 client wrapper (S3-compatible SDK + R2 endpoint config) | `src/server/storage/r2.ts` |
| Vercel Cron orphan-sweep Route Handler | `src/app/api/cron/r2-orphan-sweep/route.ts` |
| Vercel Cron job entry | `vercel.json` (`crons[]` array) |
| Identity-pool asset pipeline (Flux + Pillow + ComfyUI) | `experiment/asset-pipeline/` (per ADR-0011) |
| Frontend PFP URL composer | `src/lib/pfp-url.ts` |
| `image_uploads` append-only trigger function | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6.3) |

ADRs consumed by §12: ADR-0006 §4 (R2 vendor + jurisdiction `APAC` + two-bucket inventory + failure-mode profile), ADR-0014 §"Image URL format" + multimodal moderation HTTP call shape (§12.4 60-second signed-READ TTL), ADR-0015 §1 (image-PUT-URL surface rate-limit class `image-put-ip` per §11), ADR-0011 (identity-pool PFP static-bucket asset-pipeline source-of-truth + bucket-policy requirements). 3-B §12-R1 ratifies the Option B Bucket-B classification with two-column atomic transition; §12.5 + §6.3 absorb. 3-B §12-R2 confirms SCAFFOLD.15 ownership of literal object-key pattern. 3-B §12-R3 corrects-and-replaces R2 user-metadata framing — moderation linkage is DB-side (`mod_actions.image_r2_key`); R2 metadata is for orphan-sweep correlation only.

---

## §13 Flow Contract Template (six-field block)

§13 owns the *file-level per-flow contract template* for the experiment-phase build — the mandatory shape every `docs/specs/flows/F-*.md` file MUST conform to, the inventory of 37 F-* flow files across 7 prefix families, the cross-reference invariants every Errors and Acceptance block MUST satisfy, and the drafting cadence (per-file deferred to gating implementation task). SPEC.1 §7–§15 owns the *product-level* per-flow Pre / System / Response / Errors / Invariants / Acceptance substance; §3 owns the *architectural-pattern* layer (W-/R-/A- shapes that every flow reduces to); this §13 sits at the *file-level* template layer, naming the structure each per-flow file uses without authoring the per-file contracts themselves. A reader who needs a specific flow's contract goes to `docs/specs/flows/F-*.md`; a reader who needs the template shape stays here.

Three load-bearing constraints minted in §13 and consumed by every F-* file: (1) the six-field block is mandatory with one degenerate variant for read flows (§13.2); (2) every error_code in any Errors block MUST exist in `docs/specs/error-codes.md` (§13.1's cross-reference invariant, CI-lint at HARDEN-phase); (3) every name in any Acceptance block MUST appear verbatim in SPEC.1 §17 (§13.5's bidirectional trace).

### §13.1 The six-field block

Every per-flow file MUST contain exactly these six fields in this order:

**Pre** — preconditions the flow assumes hold before the System steps execute. Cross-references SPEC.1 §-numbers + ADR clauses + handler-stack steps that establish the precondition. Examples: "User holds participant session per §8.1," "Market status is `Open` per §3.6," "Idempotency-Key cache hit returns at handler step 3 per §11.3."

**System** — numbered imperative steps the handler executes. References §3.2 W-* / §3.3 R-* / §3.4 A-* pattern names where applicable. Each step is one verb-led action ("Acquire pool-row lock via `SELECT … FOR NO KEY UPDATE`," "Insert paired `bets` + `comments` rows inside the W-1 transaction per §3.2," "Insert `events` row with `event_type = 'comment.placed'` per §7.7"). Steps reference single-source-of-truth file paths from each consumed §; never restate logic.

**Response** — success-path response shape with exact field names. JSON shape for Route Handlers; discriminated-union shape for Server Actions per §4.4. Schema lives in the corresponding source-of-truth file (e.g., `src/server/bets/place.ts` exports the response type via `$inferSelect` per ADR-0008); §13's Response block names the field set, not the runtime validator.

**Errors** — table mapping every precondition violation and every system-step failure mode to a stable error_code from `docs/specs/error-codes.md`. **Cross-reference invariant: every error_code listed here MUST exist in the codes catalogue.** A flow file that cites an undefined code fails the HARDEN-phase CI lint. The Errors block is exhaustive — undocumented error paths are a contract violation, not a graceful-degradation surface.

**Invariants** — post-conditions that hold after the flow completes successfully. Each invariant cross-references its §14 row + the test file path that asserts it. Examples: "INV-1 (atomic bet+comment per §14.1) — verified by `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts`," "Bucket-A append-only on `bets` per §6.2 — verified by `tests/db/triggers/bets-append-only.spec.ts`."

**Acceptance** — named integration tests from SPEC.1 §17's catalogue that verify end-to-end behaviour. **Cross-reference invariant: every name listed here MUST appear verbatim in SPEC.1 §17.** A flow file that cites a non-existent acceptance test fails the HARDEN-phase CI lint. Acceptance names are read-only references; new tests are minted in SPEC.1 §17, not in flow files.

The six-field structure is mandatory. A flow file missing any of the six is a contract violation.

### §13.2 Read-flow shape — degenerate Invariants block

Four flows are pure reads with no state mutation: **F-DEBATE-1** (debate view render), **F-DEBATE-2** (market detail render), **F-DEBATE-4** (debate view poll), **F-ADMIN-5** (audit-log search). These flows write nothing — no `events` row, no current-state row, no `mod_actions` row.

Read flows carry the same six-field block, but the Invariants block is **degenerate** — it contains the literal text:

> *No state mutation; INV-1 / INV-2 / INV-3 / INV-4 do not apply. Read-time correctness rides on §3.3 R-* pattern semantics.*

The Invariants field is NOT omitted (the template is mandatory), but its content is the standardised degenerate text above. The Acceptance block is NOT degenerate — read flows still carry named acceptance tests verifying cache-bypass behaviour, render-correctness, sort-order-correctness.

The four read flows are the only flows with the degenerate variant. Every other F-* (write or async) carries a substantive Invariants block.

### §13.3 The F-* file inventory

Thirty-seven per-flow contract files in v1 across seven prefix families. Each file lives at `docs/specs/flows/F-<family>-<n>.md` (provisional path under SCAFFOLD.2 per 3-A R4 — D5 patch discipline if SCAFFOLD.2 ratifies different).

| F-* ID | SPEC.1 § | Shape (Write / Read) | Gating tracker task |
|---|---|---|---|
| F-BET-1 (entry — bet + atomic comment) | §7 | W (W-1 per §3.2) | ENGINE.8 |
| F-BET-2 (subsequent buy) | §7 | W (W-1) | ENGINE.8 |
| F-BET-3 (sell) | §7 | W (W-1) | ENGINE.8 |
| F-BET-4 (bet detail render) | §7 | R | ENGINE.8 |
| F-BET-5 (market closed at) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-6 (in-flight timeout) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-7 (failed payment / Dharma underflow) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-9 (post-resolution view) | §7 | R | ENGINE.8 |
| F-BET-10 (cross-market summary) | §7 | R | ENGINE.8 |
| F-COMMENT-1 (additional post-bet + comment) | §8 | W (W-1 — comment-bearing post-bet per §3.2) | DEBATE.2 |
| F-COMMENT-2 (reply-bet + comment) | §8 | W (W-1 — comment-bearing reply-bet per §3.2) | DEBATE.2 |
| F-COMMENT-3 (image-attached bet + comment) | §8 | W (W-1 — image-attached comment-bearing bet per §3.2) | DEBATE.2 + SCAFFOLD.15 |
| F-COMMENT-4 (comment edit — STRUCK from v1 per SPEC.1 §8) | §8 | — | (none — struck) |
| F-COMMENT-5 (comment delete — STRUCK from v1 per SPEC.1 §8) | §8 | — | (none — struck) |
| F-DEBATE-1 (debate view render) | §9 | R (degenerate Invariants per §13.2) | DEBATE.4 |
| F-DEBATE-2 (market detail render) | §9 | R (degenerate Invariants per §13.2) | DEBATE.5 |
| F-DEBATE-3 (post-resolution lock state) | §9 | W (W-3 read-side) | ENGINE.9 |
| F-DEBATE-4 (debate view poll) | §9 | R (degenerate Invariants per §13.2) | DEBATE.4 |
| F-RESOLVE-1 (resolve) | §10 | W (W-3) | ENGINE.9 |
| F-RESOLVE-2 (correction) | §10 | W (W-3 correction variant) | ENGINE.9 |
| F-RESOLVE-3 (void) | §10 | W (W-3 void variant) | ENGINE.9 |
| F-AUTH-1 (Google OAuth) | §13 | W (signup sequence per §3.5) | SCAFFOLD.3 |
| F-AUTH-2 (Email + OTP) | §13 | W (signup sequence per §3.5) | SCAFFOLD.3 |
| F-AUTH-3 (pseudonym assignment) | §13 | W (per §3.5) | SCAFFOLD.3 |
| F-AUTH-4 (ToS acceptance) | §13 | W (per §3.5) | SCAFFOLD.3 |
| F-AUTH-ADMIN (admin login) | §13 | W (per §3.5 disjoint admin path) | SCAFFOLD.3 |
| F-AUTH-5 (logout) | §13 | W (per §8.6) | SCAFFOLD.3 |
| F-MOD-1 (auto-ban on Track A) | §14 | W (Track A side-effect) | DEBATE.7 |
| F-MOD-2 (Track A flag-only mode degrade) | §14 | W | DEBATE.7 |
| F-MOD-4 (atomic bet+comment under moderation) | §14 | W (W-1 + §10) | DEBATE.7 |
| F-MOD-5 (manual moderation queue review) | §14 | R | DEBATE.7 |
| F-ADMIN-1 (create market) | §15 | W (admin actor per §3.6) | UI.6 |
| F-ADMIN-2 (seed pool) | §15 | W | UI.6 |
| F-ADMIN-3 (trigger resolution) | §15 | W (per ADR-0010) | UI.6 |
| F-ADMIN-4 (moderation action) | §15 | W (per F-MOD-* dispatch) | UI.6 |
| F-ADMIN-5 (audit-log search) | §15 | R (degenerate Invariants per §13.2) | UI.6 |

**F-BET-8 was deleted** per SPEC.1 change-log 2026-05-03 — "structurally impossible under F-AUTH-ADMIN" (no participant identity exists for the admin actor that F-BET-8 would have needed). Inventory carries 9 F-BET-* IDs (1, 2, 3, 4, 5, 6, 7, 9, 10), not 10.

**F-COMMENT-4 + F-COMMENT-5 are struck** per SPEC.1 §8 — comment edit and comment delete are not v1 features (the append-only `comments` discipline per §6.2 forecloses both at the database layer). **F-COMMENT-6 / F-COMMENT-7 / F-COMMENT-8 (friendly-fire up/down/clear) are removed entirely** under the v1.9.0 reply-as-bet model (ADR-0017): there is no standalone friendly-fire vote, so there are no friendly-fire flows. Inventory carries 3 active F-COMMENT-* IDs (1, 2, 3 — all comment-bearing bets) plus the two struck rows (4, 5) retained as audit trace.

**Total: 37 active F-* files** across 7 prefix families: F-BET-* (9), F-COMMENT-* (3 active + 2 struck audit-trace), F-DEBATE-* (4), F-RESOLVE-* (3), F-AUTH-* (6), F-MOD-* (5), F-ADMIN-* (5). *(Drift note: the family breakdown and the "37" total carry a pre-existing internal inconsistency vs the literal active-row count in the table above — F-MOD-3 absent, F-BET-8 deleted — predating this fold; flagged for reconciliation at the §13 redraft / next tracker sweep, see §23.3. This pass changed only the F-COMMENT family, 6 active → 3 active.)*

Multi-task gates use `+`: F-COMMENT-3 = DEBATE.2 + SCAFFOLD.15 (image upload integration spans both DEBATE.2's Server Action wiring and SCAFFOLD.15's R2 bucket policy authoring).

### §13.4 Drafting cadence — per-file deferred to gating implementation task

Per-flow contract files are NOT drafted at SPEC.2 v1.0 lock. The 37 F-*.md files are minted incrementally in the same commit as the gating implementation task: ENGINE.8's commit lands the 9 F-BET-*.md files; DEBATE.2's commit lands F-COMMENT-1/2/3.md; and so on per the §13.3 gating column.

The cadence is deliberate: each flow's Pre / System / Response / Errors / Invariants / Acceptance block authored against the actual implementation, not pre-implementation guesswork. The implementation task's pull request lands the F-*.md file alongside the production code; the six-field block reflects what the code actually does. This forecloses the drift class where flow files describe an aspirational behaviour the implementation never delivers.

**Exception: skeleton files at SCAFFOLD.2.** SCAFFOLD.2 mints empty F-*.md files (file path + heading + the six section markers, no substance) for all 37 flows so that downstream task-tracking has consistent file-path destinations from the start. Substance fills in per the gating-task cadence above. The empty-skeleton commit also lands `docs/specs/flows/README.md` naming the §13 contract as the authority.

### §13.5 §17 acceptance-test alignment + §23 bidirectional trace

**§17 alignment.** Every name in any Acceptance block MUST appear verbatim in SPEC.1 §17's acceptance-test catalogue. The CI lint at HARDEN-phase walks every F-*.md file's Acceptance block and asserts the names exist in §17's catalogue; a name in a flow file that's not in §17 is a build error.

The opposite direction is also asserted: every row in SPEC.1 §17's catalogue SHOULD appear in at least one F-*.md file's Acceptance block. The asymmetric SHOULD vs MUST is deliberate — a §17 test that no flow currently cites is acceptable as a "broader integration" test (e.g., cross-market correctness suites), but it's flagged at HARDEN-phase for review.

**§23 bidirectional trace.** SPEC.2 §23 (Tracker Task Gating Map) consumes §13.3's gating column to build the tracker-task → F-* → SPEC.2-section trace. The trace runs both directions: every tracker task → which F-* files it gates → which SPEC.2 sections feed it; and every SPEC.2 section → which F-* files consume it → which tracker tasks unblock when the section locks. §23 is the load-bearing PRECURSOR.4 review surface — coverage gaps surface there before they land as blocked tasks.

### §13.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| The six-field block contract | §13.1 |
| Read-flow degenerate Invariants variant | §13.2 |
| F-* file inventory + gating-task table | §13.3 |
| Per-flow Pre / System / Response / Errors / Invariants / Acceptance content | `docs/specs/flows/F-*.md` (37 files; per gating task cadence) |
| Empty-skeleton-flow-files mint | SCAFFOLD.2 + `docs/specs/flows/README.md` |
| Error-code catalogue (consumed by every Errors block) | `docs/specs/error-codes.md` (per §15) |
| Acceptance-test catalogue (consumed by every Acceptance block) | SPEC.1 §17 |
| Cross-reference CI lint (Errors → catalogue + Acceptance → §17) | HARDEN.* |
| Bidirectional gating trace | §23 (Tracker Task Gating Map) |

ADRs consumed by §13: ADR-0003 (Server Actions vs Route Handlers cadence informs Response shape per §4.4), ADR-0004 (F-AUTH-1/2 mounted route handlers), ADR-0005 (W-1 / W-3 transaction shapes referenced by System blocks; the v1.8.x W-2 comment-only shape is retired), ADR-0008 (drizzle-zod typed-row response shapes), ADR-0010 (admin-actor encoding cited by F-RESOLVE-* + F-ADMIN-* System blocks), ADR-0011 (`identity_pool` consumption cited by F-AUTH-3 System block), ADR-0013 (bet transaction wrapper cited by F-BET-* + F-COMMENT-* System blocks), ADR-0014 (pre-commit moderation cited by every comment-bearing-bet System block — F-BET-1/F-BET-2 + F-COMMENT-1/2/3), ADR-0015 (Idempotency-Key header + rate-limit class cited by F-* Pre blocks), ADR-0016 (URL-exposure rule cited by F-* with raw-UUID-vs-pseudonym surfaces), ADR-0017 (reply-as-bet model + per-side reply-bet aggregates cited by F-COMMENT-1/2/3 + F-DEBATE-1/4 System blocks; supersedes ADR-0009), ADR-0018 (two-floor minimum-bet write-path check cited by F-BET-* + F-COMMENT-* Pre blocks). The 37-file inventory + gating-task table is the canonical SCAFFOLD.2 deliverable target.

---

## §14 Invariant Contract

§14 owns the *cross-cutting invariant enforcement contract* for the experiment-phase build — the four named invariants (INV-1, INV-2, INV-3, INV-4) that the system MUST preserve, the construction-layer mechanism that physically enforces each one (Postgres trigger, transaction shape, application gate, schema constraint), and the canonical test path that asserts each invariant holds end-to-end. SPEC.1 §11 owns the *product-level* invariant statements — what each invariant *means* in plain language and why it's load-bearing for thesis correctness. §6 owns the *append-only enforcement contract* (the trigger plumbing). §3 owns the *transaction shapes* (W-1 bet/comment · W-3 resolution; the v1.8.x W-2 comment-only shape is retired under reply-as-bet). §8 owns the *auth-layer construction* (session-deferral hook). §13 owns the *flow-file Invariants block discipline* (every flow file's Invariants block cross-references its §14 row). This §14 sits at the *invariant → mechanism → test* mapping layer, naming how each invariant is enforced and where to find the proof.

The four invariants are not pruned, renumbered, or deferred. INV-1 (atomic bet+comment), INV-2 (no Dharma overdraft), INV-3 (comments side-bound at post time), INV-4 (append-only resolutions) are the canonical four; new invariants would mint via ADR + same-commit SPEC.1 + SPEC.2 update, never silently. The mechanism column is normative; the test column is the verification surface.

### §14.1 The four invariants

| ID | Statement | Mechanism (construction layer) | Canonical integration test |
|---|---|---|---|
| **INV-1** | Atomic bet+comment: a comment-bearing bet and its mandatory commentary commit together or both abort together. Every post and reply is a bet+comment pair — no comment without a stake exists at all (the comment-free **sell** is the only bet that carries no comment). | (i) §3.2 W-1 lock-order chain runs the `bets` + `comments` inserts inside one Postgres SERIALIZABLE transaction at `src/server/bets/transaction.ts` per ADR-0013 — applies to every comment-bearing bet (entry, subsequent, additional post, reply, image); (ii) the structural 1:1 binding is enforced by `comments.bet_id` NOT NULL + `bets.comment_id` NOT NULL (a comment-bearing bet cannot persist half its pair); (iii) §10 pre-commit moderation runs OUTSIDE the transaction so a Track A / Track B verdict means the transaction never opens; (iv) §6.2 Bucket-A trigger on `bets` + `comments` rejects any UPDATE / DELETE that could orphan one without the other. | `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` |
| **INV-2** | No Dharma overdraft: a participant's `dharma_ledger`-derived balance never goes negative; every bet is escrow-funded against the participant's available balance at write time. | (i) §3.2 W-1 dharma-ledger insert sits inside the SERIALIZABLE transaction with pool-row pessimistic lock per ADR-0013; (ii) `dharma_ledger` is Bucket-A append-only per §6.2 — rows are insert-only; the canonical balance is the latest row's `balance_after` (running total), and `SUM(amount)` equals it **excluding `uncollectable`** rows (the forgiveness record where `balance_after = previous_balance`, `amount ≤ 0`); (iii) handler-level pre-flight check at `src/server/bets/place.ts` rejects bets where `available_balance < stake` BEFORE opening the transaction (advisory layer); (iv) the trigger from (ii) is the ground truth — a bug bypassing the handler check fails at the database layer. | `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` |
| **INV-3** | Comments side-bound at post time: every comment is structurally tied to the side (YES / NO) the participant held at the moment of posting; flipping sides later does NOT retroactively re-attribute prior comments. | (i) §8.3 session-deferral hook construction-layer protection — a participant cannot hold a session cookie before pseudonym + ToS exist, foreclosing pre-pseudonym writes; (ii) under reply-as-bet every comment rides a bet, which is itself a YES/NO stake — `comments.side_at_post_time` is populated from the side of that bet INSIDE the W-1 bet transaction (`src/server/bets/transaction.ts`), so the comment's side is the bet's side by construction, not a separate read that could drift; (iii) `comments` is Bucket-A append-only per §6.2 — once written, the side column cannot mutate; (iv) the §3.2 W-1 lock order `pools → positions → dharma_ledger → events` runs the position update and the comment insert in the same SERIALIZABLE transaction, so a concurrent flip cannot race the side binding. | `tests/invariants/I-SIDE-BIND-001.comment-side-frozen.spec.ts` |
| **INV-4** | Append-only resolutions: a market's resolution is recorded as one row in `resolution_events` (Bucket A) plus one row per affected bet in `payout_events` (Bucket A); corrections and voids are NEW rows referencing prior `resolution_events.id` via `corrects_event_id`, never updates of prior rows. | (i) §3.2 W-3 fan-out runs in one Postgres SERIALIZABLE transaction per `src/server/resolution/settle.ts` (and `correct.ts` / `void.ts`) per ADR-0013; (ii) `resolution_events` + `payout_events` are Bucket-A append-only per §6.2 — corrections cannot UPDATE prior rows; (iii) `markets.status` whitelisted Bucket-C transition (`Open` → `Resolved \| Voided`) per §3.6 is the only mutation on `markets` permitted at resolution; (iv) the §8.3 session-deferral hook protection is irrelevant for INV-4 (admin actor doesn't carry a session cookie of the participant type), but the parallel admin-side construction (§8.4 admin authentication path) is the equivalent — admin auth is required before any `resolve` / `correct` / `void` Server Action executes. | `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` |

The four-row mapping is exhaustive at v1. No fifth invariant currently anticipated; new invariants land via ADR + dual-spec same-commit update.

### §14.2 Two-test-layer split

The invariants are verified at two distinct test layers. Both layers are MUST; neither alone is sufficient.

**Unit-test layer.** Per-mechanism granular tests at `tests/db/triggers/<table>-append-only.spec.ts` (the §6.6 twelve-file suite covering Bucket-A + Bucket-B trigger discipline) and per-handler logic tests at `tests/server/<domain>/<handler>.spec.ts`. These verify that each mechanism in the §14.1 table fires correctly in isolation — the trigger rejects the bad UPDATE, the handler computes `side_at_post_time` correctly under the read lock, the `dharma_ledger` debit equals the bet stake exactly. Unit tests are fast, run on every PR, and are the first line of regression defense.

**Integration-test layer.** End-to-end tests at `tests/invariants/I-<INV>-NNN.<descriptive-slug>.spec.ts` per the §14.1 canonical-test column. These verify that the invariant holds across the full handler stack under realistic conditions — a real PostgreSQL test container, a real bet handler with real moderation mocks, real session cookies, real concurrent transactions where applicable. Integration tests are slow (test-container spin-up + per-test transaction setup), gated to nightly + pre-merge-to-main runs, and are the verification of record for invariant correctness.

The two-layer split is deliberate: a passing unit test demonstrates that *one* mechanism works as designed; a passing integration test demonstrates that *all* mechanisms compose correctly to enforce the invariant. INV-2 is the load-bearing example — the trigger (Bucket-A append-only on `dharma_ledger`) and the handler check (`available_balance < stake`) and the transaction wrapper (SERIALIZABLE + pool-row lock) all need to compose; a unit test for any one of them passes while the composition could still leak. The integration test runs concurrent bets against a single user with insufficient balance and asserts the user's final balance is non-negative across all observed outcomes.

**File-naming convention.** Integration tests at `tests/invariants/I-<INV-NAME>-NNN.<descriptive-slug>.spec.ts` where:
- `<INV-NAME>` is the canonical invariant slug: `ATOMICITY` (INV-1), `NO-OVERDRAFT` (INV-2), `SIDE-BIND` (INV-3), `APPEND-ONLY` (INV-4).
- `NNN` is a 3-digit zero-padded counter starting at 001 per invariant — multiple integration tests per invariant are expected as edge cases surface during HARDEN.* phases (concurrent posting, cross-market interaction, admin-actor edge cases).
- `<descriptive-slug>` is a short kebab-case description of the test scenario.

The four files named in the §14.1 canonical-test column are the seed integration tests; each is `001` of its respective invariant series. Subsequent edge-case tests increment the counter (`I-NO-OVERDRAFT-002.concurrent-bets-single-user.spec.ts`, etc.) as HARDEN.* uncovers new attack surfaces.

### §14.3 Cross-reference contract

Every flow file's Invariants block at `docs/specs/flows/F-*.md` MUST cross-reference its applicable §14 rows + the canonical test path. Per §13.1 + §13.6 the cross-reference invariant is HARDEN-phase CI-lint enforced — a flow file that cites an invariant ID not in §14.1 is a build error; a flow file that omits an applicable invariant from its block (where applicability is determined by §3.2 W-pattern membership) is a code-review flag, not a build error.

The four read flows from §13.2 (F-DEBATE-1, F-DEBATE-2, F-DEBATE-4, F-ADMIN-5) carry the standardised degenerate-Invariants text per §13.2 — they do NOT cross-reference §14 rows because no state mutation occurs.

§23's bidirectional trace consumes §14.1's canonical-test column to verify every invariant has an integration-test surface; an invariant without a canonical test is a §23 coverage gap.

### §14.4 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Four invariants × mechanism × canonical-test mapping | §14.1 |
| Two-test-layer split + file-naming convention | §14.2 |
| INV-1 W-1 transaction wrapper | `src/server/bets/transaction.ts` (per §9 + ADR-0013) |
| INV-2 handler pre-flight balance check | `src/server/bets/place.ts` |
| INV-3 `side_at_post_time` population | within the W-1 bet transaction at `src/server/bets/transaction.ts` (comment-bearing bet construction; the v1.8.x `src/server/comments/place.ts` is folded into the bet path) |
| INV-4 W-3 resolution wrapper | `src/server/resolution/settle.ts` (per §3.6) |
| INV-3 + INV-4 auth-layer construction | `src/server/auth/session-gate.ts` (per §8.3 session-deferral hook) |
| Bucket-A trigger SQL covering `bets`, `comments`, `dharma_ledger`, `resolution_events`, `payout_events` | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6 + ADR-0005) |
| Per-mechanism unit-test suite | `tests/db/triggers/<table>-append-only.spec.ts` + `tests/server/<domain>/<handler>.spec.ts` |
| Canonical integration tests per invariant | `tests/invariants/I-<INV>-001.<slug>.spec.ts` (four files; ENGINE.7 / DEBATE.2 / ENGINE.9 / SCAFFOLD.2 land per implementation cadence) |
| §13 flow-file Invariants block discipline | §13.1 + §13.6 |
| Bidirectional gating trace | §23 |

ADRs consumed by §14: ADR-0004 (Better Auth session-deferral hook backing INV-3), ADR-0005 (Bucket-A append-only classification backing INV-1 / INV-3 / INV-4), ADR-0008 (Drizzle migration set + per-domain schema-file split), ADR-0010 (admin auth construction backing INV-4 admin-actor surface), ADR-0013 (W-1 SERIALIZABLE transaction backing INV-1 / INV-2), ADR-0014 (pre-commit moderation outside the transaction backing INV-1 — moderation never opens partial state), ADR-0017 (reply-as-bet model backing INV-1's every-comment-is-a-bet pairing and INV-3's side-from-bet binding). 3-C absorbs the §8.3 session-deferral-hook auth-layer mechanism into INV-3's mechanism column alongside the existing Postgres-trigger mechanism; 3-A R3 confirms INV-1 / INV-2 / INV-3 / INV-4 set is canonical and not pruned.

---

## §15 Error Code Envelope Shape

§15 owns the *error-envelope contract* for the experiment-phase build — the six-field envelope shape every error response carries (HTTP layer for Route Handlers + discriminated-union layer for Server Actions per §4.4), the closed nine-value `error_type` enum that classifies every code, the three-value `retry_semantics` enum that signals client retry behaviour, the catalogue file at `docs/specs/error-codes.md` that mints every named code, and the cross-reference invariant that ties Errors blocks in flow files (§13) to catalogue rows. SPEC.1 §13 + §16.4 own the *per-flow* error-code references in product behaviour; ADR-0013 / ADR-0014 / ADR-0015 / ADR-0010 own the *operational* codes minted in their respective decisions; this §15 sits at the *envelope contract layer*, naming the shape every error code conforms to without enumerating the codes themselves (the catalogue does that).

The discipline is strict: §15 names the envelope, the enums, the catalogue file, and the cross-reference invariant; it does NOT enumerate codes (the catalogue file does), it does NOT pick HTTP status mappings per code (each code's catalogue row does), and it does NOT decide retry policy per code (the catalogue row's `retry_semantics` field does).

### §15.1 The six-field envelope

Every error response carries exactly six fields:

| Field | Type | Notes |
|---|---|---|
| `code` | `string` (snake_case) | Stable identifier from the catalogue at `docs/specs/error-codes.md`. Never includes HTTP status, version, or trailing identifiers — bare snake_case names. The prefix discipline (bare vs `error_`) is locked at PRECURSOR.4 per §15.6 carry-forward. |
| `message` | `string` | Display template, interpolated client-side. May contain `{placeholder}` substitution points populated from `field_errors` or contextual handler data. NEVER carries dynamic user-input or PII — templates are static at build time. |
| `error_type` | enum (closed 9-value, §15.2) | Classification axis: which response category does this code belong to (validation / auth / not_found / conflict / rate_limited / unavailable / gone / internal / forbidden). |
| `retry_semantics` | enum (closed 3-value, §15.3) | Client retry hint: `retry_safe` / `retry_after` / `do_not_retry`. |
| `retry_after` | `number` (seconds) \| `null` | Present iff `retry_semantics === "retry_after"`. NULL otherwise. Mirrors HTTP `Retry-After` header on Route Handler responses. |
| `field_errors` | `Record<string, string[]>` \| `null` | Server Action surfaces only — per-field validation error payload for the React 19.2 `useActionState` contract. NULL on Route Handler responses. |

The six-field envelope is mandatory. A response missing any field — including null-valued `retry_after` and `field_errors` where applicable — is a contract violation.

**Route Handler envelope** wraps the six fields in the `ok: false` discriminator per §4.4: `{ ok: false, error: { code, message, error_type, retry_semantics, retry_after, field_errors } }`. **Server Action return shape** wraps the same six in the `{ ok: false, error: ... }` discriminated-union form with `field_errors` populated.

### §15.2 `error_type` enum (closed 9-value)

Nine canonical error types. Every code in the catalogue MUST belong to exactly one. The enum is closed — adding a tenth requires an ADR + same-commit catalogue migration.

| `error_type` | HTTP status family | Semantic |
|---|---|---|
| `validation` | 400 | Client request malformed or fails business-rule validation (e.g., `error_idempotency_key_invalid`, `error_market_closed_at`). |
| `auth` | 401 | Authentication missing or invalid (e.g., `error_session_required`, `error_admin_login_invalid`). |
| `forbidden` | 403 | Authentication present but operation not authorized (e.g., `error_origin_not_allowed`, `error_admin_session_required` on participant Server Actions). |
| `not_found` | 404 | Resource does not exist or is not visible to the requester (e.g., `error_market_not_found`, `error_user_not_found`). |
| `conflict` | 409 | State conflict resolvable by client retry with different parameters (e.g., `error_idempotency_key_reused`, `error_idempotency_in_flight`). |
| `rate_limited` | 429 | Per-surface rate limit exceeded (e.g., `error_rate_limit_exceeded`). |
| `gone` | 410 | Resource permanently unavailable (e.g., `error_otp_expired`, `error_tos_version_changed`, `error_experiment_concluded`). |
| `unavailable` | 503 | Upstream vendor or transient resource exhaustion (e.g., `error_moderation_unavailable`, `error_idempotency_unavailable`, `error_bet_serialization_exhausted`). |
| `internal` | 500 | Server-side bug or precondition violation (e.g., `error_internal`, trigger-fired-from-bug paths per §6.4). |

The mapping HTTP status ↔ `error_type` is normative for Route Handler responses; Server Action returns carry only the `error_type` field (no HTTP status to user code per §4.4).

**Client branching guidance.** Clients SHOULD branch on `error_type` first (categorical handling: show validation field hints on `validation`, redirect to login on `auth`, surface upstream-degraded banner on `unavailable`, etc.), then on `code` for code-specific UX (the exact copy + recovery affordance varies per code within a type).

### §15.3 `retry_semantics` enum (closed 3-value)

Three canonical retry modes. Every code in the catalogue MUST carry exactly one.

| `retry_semantics` | Semantic |
|---|---|
| `retry_safe` | Client MAY retry the request immediately with the same parameters and expect success on transient-cause resolution (e.g., a network blip during a `validation`-type response — extremely rare; most `retry_safe` codes are `unavailable`-type with brief recovery windows). |
| `retry_after` | Client MUST wait at least `retry_after` seconds before retrying. Codes: `error_rate_limit_exceeded`, `error_idempotency_in_flight`, `error_idempotency_unavailable`, `error_moderation_unavailable`, `error_bet_serialization_exhausted`. |
| `do_not_retry` | Client MUST NOT retry the same request. Either the request is permanently invalid (most `validation` + `auth` + `forbidden` + `gone` codes), or retrying would corrupt state (most `conflict` codes — fix the parameters first), or retrying would cost a quota tick without changing the outcome (most `not_found` codes). |

The asymmetry between `retry_safe` (rare) and `do_not_retry` (default for most codes) is deliberate: SPEC.1 §13 + §16.4's product behaviour favours explicit user action on most error paths over silent client retry, on the principle that the user benefits from seeing the error and choosing whether to proceed (rather than the client silently retrying and the user not learning what went wrong).

### §15.4 The catalogue baseline — 38 codes at SPEC.2 v1.0 lock

**§15.4 is the canonical 38-code catalogue at v1.0 lock** — the source-breakdown table below is the authoritative enumeration. The standalone catalogue file `docs/specs/error-codes.md` is a **named forward deliverable** (ENGINE error-envelope work), not a v1.0 artifact: it is materialized from this table when the error-envelope module lands, and the §15.5 cross-reference CI lint that checks it is a HARDEN-phase deliverable. **Baseline: 38 codes**, verified at PRECURSOR.4. This catalogue is the v1.0 baseline of cross-cutting and folded-ADR codes; additional per-flow product-validation codes defined in the flow contracts (the participant flows and the admin flows) are aggregated into the complete `error-codes.md` catalogue (forward deliverable), which the §15.5 lint verifies. Codes mint from the following sources — every code in the catalogue MUST originate from one:

| Source | Count | Examples |
|---|---|---|
| **SPEC.1 §13** (auth-flow business validation) | 11 | `error_oauth_callback_error`, `error_turnstile_failed`, `error_otp_invalid`, `error_otp_expired`, `error_otp_rate_limited`, `error_email_delivery_failed`, `error_tos_acceptance_required`, `error_tos_version_changed`, `error_admin_login_invalid`, `error_admin_session_persistence_failed`, `error_session_persistence_failed` |
| **SPEC.1 §16.4** (audit-log + reactive-removal codes) | 4 | `error_session_required`, `error_admin_session_required`, `error_user_not_found`, `error_market_not_found` |
| **ADR-0013** (bet concurrency model) | 4 | `error_bet_serialization_exhausted`, `error_market_closed_at`, `error_in_flight_timeout`, `error_internal` (catch-all for trigger-fired-from-bug paths per §6.4) |
| **ADR-0014** (pre-commit moderation) | 4 | `error_moderation_unavailable`, `error_moderation_in_flight`, `error_moderation_track_a`, `error_moderation_track_b` |
| **ADR-0015** (rate-limit + idempotency) | 6 | `error_idempotency_key_required`, `error_idempotency_key_invalid`, `error_idempotency_key_reused`, `error_idempotency_in_flight`, `error_idempotency_unavailable`, `error_rate_limit_exceeded` |
| **ADR-0010** (admin auth) | 1 | `error_origin_not_allowed` (bet-endpoint Origin defense per §4.3 — minted alongside admin contract though not exclusive to admin path) |
| **SPEC.2 §3.5** (signup sequence) | 4 | `error_identity_pool_exhausted`, `error_pseudonym_assignment_failed`, `error_storage_unavailable` (R2-outage path per §12.8), `error_image_upload_invalid` |
| **SPEC.2 §10** (moderation in-flight collision distinct from idempotency) | 1 | `error_image_moderation_failed` (multimodal-API-specific failure distinct from `error_moderation_unavailable`) |
| **SPEC.2 §17** (observability surface — alarm-1 trigger-violation surfacing) | 2 | `error_validation` (catch-all for handler-level Zod validation failures), `error_payload_too_large` (per ADR-0006 R2 PUT body-size violations) |
| **SPEC.2 §20** (conclusion-event freeze) | 1 | `error_experiment_concluded` (HTTP 410 `error_type: gone`, `retry_semantics: do_not_retry` — fired by middleware on any state-mutating endpoint after 2026-11-05 23:59 UTC per §20.2) |
| **Total** | **38** | |

**Codes NOT yet in catalogue, deferred to PRECURSOR.4.** Two known gaps surfaced during 3-C absorption:

- The bare-vs-`error_`-prefix split deliberation: SPEC.1 + ADR-0013 + ADR-0014's prose currently uses bare snake_case names (e.g., `bet_serialization_exhausted`); ADR-0015's prose uses prefixed names (e.g., `error_idempotency_key_required`). PRECURSOR.4 ratifies one convention and applies a uniform sweep across SPEC.1 + ADRs + catalogue.
- Admin-only flow error-code completeness — F-ADMIN-1 / F-ADMIN-2 / F-ADMIN-3's product-validation error codes (e.g., "market title too long," "pool seed amount invalid") are not yet enumerated in §13.4-style tracker-task gates, and the catalogue's admin-flow coverage is sparse. PRECURSOR.4 reviews and either adds rows or accepts the sparseness as in-scope-but-unenumerated.

**§4.4 cross-reference invariant**: §4.4's three idempotency-code references (`error_idempotency_key_required`, `error_idempotency_key_invalid`, `error_idempotency_key_reused`) are mechanically aligned to the prefixed forms ADR-0015 mints; the bare-form references in v0.2-draft were stale and have been corrected at v0.3-draft (per §0.1 row's silent reconciliation).

### §15.5 Cross-reference invariant (HARDEN-phase CI lint)

Two-direction invariant between flow files and catalogue:

**Direction A: Flow file → catalogue.** Every error_code in any per-flow `docs/specs/flows/F-*.md` file's Errors block MUST exist in `docs/specs/error-codes.md`. The CI lint walks every F-*.md file and asserts each cited code has a catalogue row; a flow file that cites an undefined code is a build error.

**Direction B: Catalogue → flow file.** Every code in `docs/specs/error-codes.md` SHOULD appear in at least one F-*.md file's Errors block (or be marked `internal_only: true` in the catalogue row for codes minted purely from infrastructure failure paths — e.g., `error_internal`, trigger-violation surfacing). A catalogue row not cited by any flow AND not marked `internal_only` is flagged at HARDEN-phase for review (not a build error — sometimes the gap is legitimate, e.g., a code that only fires under operational disaster conditions).

**Catalogue row shape.** Each row carries: `code`, `error_type`, `retry_semantics`, `retry_after_default` (NULL for non-retry-after codes), `http_status` (for Route Handler responses), `description`, `internal_only` flag, source citation (which §/ADR mints the code). The catalogue shape is a versioned markdown table; SCAFFOLD.* implements alongside the F-*.md skeleton mint.

**Catalogue row count cross-reference.** §15.4's 38-code baseline is the canonical count at SPEC.2 v1.0 lock. PRECURSOR.4 verifies the catalogue file has exactly 38 rows (modulo any codes that PRECURSOR.4 adds via the deferred items). A drift between §15.4's count and the catalogue file's row count is a PRECURSOR.4 review fail.

### §15.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Six-field envelope shape | §15.1 |
| Closed 9-value `error_type` enum | §15.2 |
| Closed 3-value `retry_semantics` enum | §15.3 |
| Canonical 38-code catalogue at v1.0 lock | **§15.4 source-breakdown table** (`docs/specs/error-codes.md` is the forward materialization — ENGINE error-envelope work) |
| Per-flow Errors blocks | `docs/specs/flows/F-*.md` (per §13) |
| Bare-vs-`error_`-prefix decision | PRECURSOR.4 carry-forward (per §0.1 row) |
| Admin-only flow code completeness | PRECURSOR.4 carry-forward (per §0.1 row) |
| Cross-reference CI lint (Direction A + Direction B) | HARDEN.* |
| Server Action `field_errors` runtime | React 19.2 `useActionState` per §4.4 |
| Route Handler `Retry-After` HTTP header sourcing | Mirror `error.retry_after` field per §15.1 |

ADRs consumed by §15: ADR-0010 (admin auth code mint), ADR-0013 (bet concurrency code mint), ADR-0014 (pre-commit moderation code mint), ADR-0015 (rate-limit + idempotency code mint). 3-C absorbs the six-field envelope shape + 9-value error_type enum + 3-value retry_semantics enum as new authoring; 3-E A8 ratifies the 38-code baseline (shifted from 37) with new `error_experiment_concluded` row + new "SPEC.2 §20: 1 code" source-breakdown row.

---

## §16 Identifiers (shape)

> **[Substantively absorbed from ADR-0016 (SPEC.17) on 2026-05-08.]**

UUIDv7 (RFC 9562) is the universal primary-key type across the SPEC.2 §5 table inventory. Substrate, function name, default-expression form, Better Auth column-type strategy, `identity_pool` PK shape, and the URL-exposure rule are ratified in ADR-0016. SPEC.2 §16 names the load-bearing contract.

**Substrate.** Userspace `public.uuidv7()` PL/pgSQL function shipped as a hand-written raw SQL migration in the Drizzle migration set at `drizzle/migrations/<NNNN>_uuidv7_function.sql`, adapted from the kjmph gist's pure-SQL variant (RFC 9562 compliant; endorsed by Supabase staff in discussion #9500 as the recommended workaround on Postgres 17). Postgres 18's native `pg_catalog.uuidv7()` is the long-run target; cutover when Supabase ships PG 18 is a single DDL statement (`DROP FUNCTION public.uuidv7()`) with zero schema-wide rewrites — the function-name choice is the load-bearing forward-compatibility decision. The `pg_uuidv7` C extension is not used (not on Supabase's allowlist as of 2026-05-08; three open requests since March 2024 unactioned per ADR-0016 §Drivers).

**Drizzle column declaration.** Every primary-key column in the §5 inventory is declared as:

```ts
import { sql } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";

id: uuid("id").primaryKey().default(sql`uuidv7()`),
```

The DB-side default expression emits `DEFAULT uuidv7()` in the generated DDL, so raw-SQL inserts (the events insert helper at `src/server/events/insert.ts` per ADR-0005, ETL during `HARDEN.*` operational runbooks, manual `psql` writes) get a correct PK without app-layer participation. App-layer code paths that need a UUIDv7 outside a database default (test fixtures, seed scripts, the Better Auth `generateId` callback) import `v7 as uuidv7` from the npm `uuid` package.

**Better Auth full override.** All four Better Auth tables (`user`, `session`, `account`, `verification`) carry the schema-uniform `uuid` PK — Better Auth's default 32-character base62 random string format is overridden via:

```ts
advanced: {
  database: {
    generateId: () => uuidv7(),
  },
},
```

in `src/server/auth/index.ts` (the single source of truth for the Better Auth instance per ADR-0004). The Drizzle schemas at `src/db/schema/auth.ts` declare `id` as `uuid` with the standard `default(sql\`uuidv7()\`)` clause. The `session.token` field — Better Auth's separate 32-char random session-cookie value used as the cookie payload — is **untouched** by this contract; only the row's `id` PK is affected. The hand-rolled `admin_sessions` table per ADR-0010 carries the same default as every other table (no carve-out, no special treatment).

**`identity_pool` PK shape.** Synthetic UUIDv7 `id` PK + `UNIQUE (colour, animal, number)` enforcing natural-triple uniqueness as a separate constraint. Schema uniformity wins over the natural-key compactness; the 16-byte × 50K-row = 800 kB synthetic-column overhead is negligible.

**URL-exposure rule.** Raw UUIDs are forbidden on participant-facing routes — pseudonyms (per ADR-0011) are the URL-exposed identifier on every user-routed page. Concretely: `/u/RedFox001` (not `/u/0193abcd-...`); `/m/<market-slug>` (not `/m/<market-uuid>`); comment permalinks reference the comment's natural ordering or a server-rendered short ID (not the raw `comments.id`). Raw UUIDs are **allowed** on admin-only routes under `/admin/*` (gated by F-AUTH-ADMIN per ADR-0010 — admin-operator ergonomics during moderation), and **allowed** in the 2026-11-06 dataset release (per SPEC.1 §12.2 — raw UUIDs are the correct join primitive for offline analysis). The rule is enforced at the route-handler level, not the URL parser; the acceptance test `id::raw-uuid-not-in-participant-urls` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter.

**Per-backend monotonicity caveat.** Both PG 18's native `uuidv7()` and the userspace fallback produce UUIDs that are strictly monotonic per backend process only; **neither produces UUIDs that are strictly monotonic across the Supavisor connection pool** (per ADR-0006 transaction-pooling mode). Application code MUST NOT assume `id(request N+1) > id(request N)` even within a session. The canonical chronological-sort column for cross-row ordering is `created_at`; UUIDv7's time prefix is an implementation detail that informs single-row creation timestamp recovery (via `uuid_extract_timestamp()` per RFC 9562 §6.2), not cross-row ordering. SCAFFOLD.2 / ENGINE.* / DEBATE.* MUST sort by `created_at` (or by an explicit ranking-function score per ADR-0009) for any read path that needs cross-row chronological order. The acceptance test `id::uuidv7-monotonic-within-millisecond` verifies within-backend monotonicity only; cross-backend ordering is explicitly NOT tested.

**Single source of truth.** `drizzle/migrations/<NNNN>_uuidv7_function.sql` owns the PL/pgSQL function definition. `src/server/auth/index.ts` owns the Better Auth `generateId` override. `src/db/schema/auth.ts` owns the four Better Auth column-type overrides (`id` flipped from `text` to `uuid`). `tests/server/identity/no-raw-uuid-in-urls.test.ts` owns the URL-exposure-rule acceptance-test helper. App-layer UUIDv7 generation imports `v7 as uuidv7` from the npm `uuid` package directly at the call site (no project-internal helper module — the convention is one import line and abstracting it would just add indirection). The full file map is absorbed into Appendix A on its drafting pass.

ADR-0016 holds the full decision body, six dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §16 is the cross-reference; ADR-0016 is the canonical text.

---

## §17 Observability Contract

§17 owns the *observability contract* for the experiment-phase build — the two-vendor stack (Sentry for errors + PostHog for analytics + feature flags), the Vercel runtime logs as the third surface for structured request logging, the consolidated alarm catalogue spanning every alarm fired across the codebase, the PostHog `useFlag()` runtime contract with safe-`defaultValue` per-call-site discipline, the fail-open posture symmetric across all three observability surfaces, the no-body-logging discipline at the request log surface, and the cost ceiling. ADR-0007 owns the *vendor decision substance* — Sentry vs alternatives, PostHog vs alternatives, why Vercel runtime logs vs a third request-log vendor; this §17 sits at the *observability contract layer*, naming the alarm catalogue, the runtime contracts, and the cross-cutting failure-mode posture.

The discipline is strict: §17 names the six-row master alarm catalogue + five-row alarm-6 sub-table + `useFlag()` contract + fail-open posture; it does NOT decide threshold values per alarm (HARDEN.* number-tuning territory per §17.7), it does NOT enumerate v1 feature-flag inventory (SCAFFOLD.6 territory), and it does NOT design uptime monitoring of the hosting providers themselves (HARDEN.* territory — Sentry cannot observe its own host going down).

### §17.1 Vendor stack

Three observability surfaces, all with fail-open semantics per §17.5:

| Surface | Vendor | Purpose | Cost tier |
|---|---|---|---|
| **Errors + alarms** | Sentry | Server-side and client-side error capture, custom-event-fired alarms, source-map-resolved stack traces tagged with Vercel deploy releases | Free tier (5K events/month) — well within experiment scale |
| **Analytics + feature flags** | PostHog | Product analytics on participant funnel, leaderboard surfacing, feature-flag evaluation via `useFlag()` runtime contract per §17.4 | Free tier (1M events/month) — well within experiment scale |
| **Structured request log** | Vercel runtime logs | Per-request structured log entries (timestamp, user_id-or-anon, route, status_code, IP, user_agent, latency_ms — NO request body, NO response body per §17.6) | Bundled with Vercel hosting (no separate billing) |

The two-vendor-plus-Vercel split is deliberate. A third vendor for structured request logging (Datadog, Logflare, Axiom) would add monthly cost without unique value at experiment scale; Vercel's bundled runtime logs handle the H3 structured-request-log requirement from SPEC.1 §16.3. Sentry session-replay is **disabled in v1** per ADR-0007 — privacy concerns + cost amplification + redundancy with the events log + Vercel runtime log + Postgres audit trail outweigh debugging benefit.

**Sentry deploy hook.** Vercel deploys fire a webhook to Sentry tagging the deploy SHA as a Sentry release; source maps upload alongside. Stack traces in Sentry events resolve to TypeScript source positions automatically. The webhook URL lives in Vercel project settings under `SENTRY_DEPLOY_HOOK_URL`; same lifecycle as `SENTRY_AUTH_TOKEN` per ADR-0007.

### §17.2 Master alarm catalogue (six rows + alarm-6 sub-table)

The alarm catalogue consolidates every Sentry alarm fired across the codebase. Six master rows; alarm 6 has a five-row sub-table per §17.3 because vendor-unavailability alarms have distinct sub-IDs per vendor that downstream code (per §11, per §10, per §17.6) cites directly.

| # | Alarm name | Trigger | Cited from |
|---|---|---|---|
| **1** | Append-only-trigger violation | Postgres `RAISE EXCEPTION` from BEFORE UPDATE / BEFORE DELETE on any of the 13 protected tables per §6 | §6.7, ADR-0005, ADR-0008, ADR-0014 |
| **2** | DEFAULT-partition insert (events table) | Insert into `events_default` partition (any insert with `created_at` outside the 12 named monthly partitions per §7.2) — fired by `pg_cron` meta-query per §3.4 Pattern A-1 | §7.2, ADR-0005 |
| **3** | 40001-retry exhaustion (bet transaction wrapper) | Bet wrapper at `src/server/bets/transaction.ts` exhausts 3 retries on SQLSTATE 40001 / 40P01 per ADR-0013 + §9 | §9, ADR-0013 |
| **4** | OpenAI moderation upstream failure rate | Moderation upstream-failure custom event volume threshold per ADR-0014 + §10 (incl. `openai_moderation_auth_failure` for 4xx auth-error sub-class — failed-closed without retry) | §10, ADR-0014 |
| **5** | Identity-pool low-watermark | `identity_pool` row count drops below 5% of initial 50,000 — fired by `pg_cron` meta-query per §3.4 Pattern A-1 | §3.5, SPEC.1 §15.2, ADR-0011 |
| **6** | Per-vendor unavailability + cron job failure | Five sub-IDs per §17.3 — Upstash rate-limit, Upstash idempotency, R2, pg_cron job-run failures, Vercel Cron R2-orphan-sweep handler 5xx | §10, §11, §12, §17.6 |

Alarm rows 1-5 are consumed by single citation surfaces; alarm 6's sub-IDs are consumed across multiple citation surfaces (§10 cites 6c, §11 cites 6a + 6b, §12 cites 6c + 6e, §17.6 cites 6d), warranting the structuring elaboration.

### §17.3 Alarm-6 sub-table

Five sub-IDs. Each fires a distinct Sentry custom event with a distinct tag for downstream alarm-tuning at HARDEN.*. The sub-IDs are stable identifiers consumed across §10 / §11 / §12 prose at v0.3-draft:

| Sub-ID | Vendor | Trigger | Sentry tag |
|---|---|---|---|
| **6a** | Upstash (rate-limit) | Rate-limit middleware catches Upstash error per §11 fail-mode contract; admits the request (fail-open posture) | `upstash_unavailable_rate_limit` |
| **6b** | Upstash (idempotency) | Idempotency cache helper catches Upstash error per §11 fail-mode contract; rejects the request with HTTP 503 (fail-closed posture) | `upstash_unavailable_idempotency` |
| **6c** | R2 (object storage) | R2 client wrapper at `src/server/storage/r2.ts` catches R2 outage per §12.8 — fires on signed-PUT mint failure, signed-READ mint failure, orphan-sweep DELETE failure | `r2_unavailable` |
| **6d** | `pg_cron` job-run failures | `pg_cron` meta-query over `cron.job_run_details` per §3.4 Pattern A-1 catches any job's terminal failure (events partition monitor, `identity_pool` low-watermark check, `markets`-state drift detection) | `pg_cron_job_failure` |
| **6e** | Vercel Cron R2-orphan-sweep handler 5xx | Vercel Cron HTTP-fanout target at `src/app/api/cron/r2-orphan-sweep/route.ts` returns non-2xx; Vercel surfaces in cron run history | `vercel_cron_handler_5xx` |

Per-sub-ID threshold tuning is HARDEN.* territory per §17.7; v0.3-draft locks the sub-ID identifiers and the consumer-surface citations.

### §17.4 PostHog `useFlag()` runtime contract

Feature-flag evaluation runs through a single `useFlag()` runtime contract at `src/server/flags/use-flag.ts` (renamed from initial drafts; the path is the single source of truth per ADR-0007). The contract is:

```ts
function useFlag(name: string, defaultValue: boolean): boolean
```

Three locked properties:

1. **Local-evaluation only.** PostHog's local-evaluation mode runs in-process against the cached feature-flag config (refreshed on a periodic SDK-managed interval); no network round-trip on the call path. This bounds latency at zero and forecloses the case where a slow PostHog response stalls a request handler.
2. **Safe `defaultValue` per call site.** Every call site MUST pass a `defaultValue` that is operationally safe for the surface — typically `false` for "feature OFF" so the call site fails closed to the pre-feature behaviour. The discipline is per-call-site, not enforced at the function boundary; HARDEN.* code review catches `defaultValue` choices that would surface a half-baked feature on PostHog outage.
3. **Returns `defaultValue` on outage.** PostHog SDK errors (network failure, JSON parse error, config corruption) cause `useFlag()` to return `defaultValue`. No exceptions propagate. This is the fail-open posture for the flag surface — outage degrades to pre-flag behaviour, never to error.

The contract is consumed across the codebase: A/B tests on UI affordances, per-cohort experimental features (e.g., the Track A degrade mode flag from §10 + ADR-0014), per-environment debug surfaces. The v1 feature-flag inventory itself is SCAFFOLD.6 territory; §17 names only the runtime contract.

### §17.5 Fail-open posture (symmetric across observability surfaces)

All three observability surfaces fail open. Per ADR-0007 + §17.4:

- **Sentry.** SDK errors silently dropped; reports never propagate exceptions back to the request handler. A Sentry outage means errors that would normally page someone are lost — the user-facing flow continues to work (just unalarmed).
- **PostHog.** `useFlag()` returns `defaultValue` on outage per §17.4. Analytics events buffered locally and dropped on prolonged outage; never block the request path.
- **Vercel runtime logs.** Log-line emission is fire-and-forget at the runtime level; UI degradation does not affect log emission. Even total Vercel runtime-log UI outage means logs are written and queryable later.

The symmetric fail-open posture is asymmetric to §10 (pre-commit moderation fails closed) and §11 (idempotency fails closed). Observability does NOT cross the legal-floor or correctness boundaries that moderation and idempotency cross — observability dropping events degrades visibility, not data integrity.

### §17.6 Structured request log + no-body-logging discipline

Per SPEC.1 §16.3 H3 — structured request log served by Vercel runtime logs with the field set:

```
timestamp · user_id-or-anon · route · status_code · IP · user_agent · latency_ms · request_id
```

**No request body, no response body.** This is a code-level discipline. Route handlers MUST NOT call `console.log(req.body)`, `console.log(await req.json())`, `console.log(response)`, or any equivalent that emits body content to the runtime log. The discipline is enforced at HARDEN.* CI lint (per §17.7's deferred items list) — a regex check over the codebase flagging body-emitting log calls before merge to `main`.

The rationale: request body and response body carry user content (comments, OTP codes, image upload metadata, ToS acceptance evidence) that must not surface in operational logs. Vercel runtime logs are accessible to Vercel staff during support escalation; the no-body-logging discipline is a privacy-and-confidentiality control.

The `request_id` field (per §3.7's seven-field events.metadata set) is the canonical correlation key between Vercel runtime logs and the events log. A support-escalation walkthrough flows: read Sentry alert → extract `request_id` from the Sentry tag → query Vercel runtime logs by `request_id` → query events log by `metadata.request_id` for the in-database trace. Three observability surfaces, one correlation key.

`pg_cron` failures don't surface in the per-request log — they surface in `cron.job_run_details` and fire alarm 6d per §17.3. This is correct: cron jobs aren't request-scoped, so they don't carry a `request_id`; their observability runs on a separate channel.

### §17.7 HARDEN.* deferral list

Operational specifics deferred from §17:

- **Specific alarm thresholds.** All six master alarms + five sub-IDs carry threshold values deferred to HARDEN.* number-tuning + alarm-tuning passes. v1.0 lock names the alarm identifiers and trigger conditions; the literal "fire after N events in M minutes" tuning is HARDEN.* territory.
- **CI lint for body-redaction logging.** §17.6's no-body-logging discipline is HARDEN.* CI-lint enforced. v1.0 lock names the discipline; the lint regex is HARDEN.* implementation.
- **External uptime monitoring of hosting providers.** Sentry cannot observe Sentry's own host going down; PostHog cannot observe PostHog's. An external uptime ping (e.g., a third-party uptime service polling production endpoints from outside the Vercel/Supabase stack) is HARDEN.* territory. v1.0 ships without it.
- **v1 feature-flag inventory.** The set of named flags consumed across the codebase is SCAFFOLD.6 territory. §17 names only the `useFlag()` runtime contract.

### §17.8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Sentry SDK initialization (server + client) | `src/server/observability/sentry.server.ts` + `src/lib/observability/sentry.client.ts` |
| PostHog SDK initialization | `src/server/observability/posthog.server.ts` |
| `useFlag()` runtime contract | `src/server/flags/use-flag.ts` |
| Master alarm catalogue + alarm-6 sub-table | §17.2 + §17.3 |
| Sentry deploy-release tagging via Vercel webhook | Vercel project settings + `SENTRY_DEPLOY_HOOK_URL` env var |
| Vercel runtime log access (operational, not file-based) | Vercel dashboard + `vercel logs` CLI |
| `pg_cron` job-run-details meta-query for alarm 6d | `drizzle/migrations/<NNNN>_pg_cron_job_failure_alarm.sql` |
| Cost ceiling | $50/mo single-tier across both vendors per ADR-0007 |
| HARDEN.* CI lint for body-redaction logging | HARDEN.* (per §17.7) |
| Threshold tuning for all alarms | HARDEN.* (per §17.7) |

ADR-0007 holds the full decision body, dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §17 is the cross-reference and the alarm catalogue source. ADRs consumed by §17: ADR-0005 (Bucket-A trigger violations backing alarm 1; events DEFAULT-partition backing alarm 2), ADR-0006 (R2 outage backing alarm 6c; pg_cron architecture backing alarm 6d; Vercel Cron carve-out backing alarm 6e), ADR-0007 (Sentry + PostHog vendor selection + Vercel runtime log substrate + cost ceiling), ADR-0011 (`identity_pool` low-watermark backing alarm 5), ADR-0013 (40001-retry exhaustion backing alarm 3), ADR-0014 (OpenAI moderation upstream failure backing alarm 4), ADR-0015 (Upstash unavailability backing alarm 6a + 6b).

---

## §18 Sybil & Security Model

§18 owns the *threat model and sybil-defense contract* for the experiment-phase build — the set of attacks the v1 codebase explicitly defends against, the set of attacks deliberately out of scope (deferred to testnet phase or accepted as residual risk for the experiment's research-grade deployment), the layered sybil-defense surface across five distinct mechanisms (Cloudflare Turnstile + Google Identity Services + OTP rate-limit pair + per-IP anti-abuse caps + §8.7 structural-separation rule), the admin/participant six-property structural-separation-by-data-model construction backing B5, and the ToS acceptance enforcement at the legal-floor surface. SPEC.1 §16.1 owns the *product-level* rate-limit constants; SPEC.1 §16.5 owns the *legal-floor* constraints (CSAM detection + reporting compliance, ToS evidence retention; NCMEC CyberTipline auto-report mechanism deferred to post-experiment per SCAFFOLD.16 LD-7); §8 owns the *auth contract* including the seven-pillar structural-separation rule; ADR-0004 owns the Cloudflare Turnstile vendor wiring; ADR-0010 owns the static-password admin auth; ADR-0014 owns the pre-commit moderation legal-floor coupling. §18 sits at the *threat model and defense layering* surface, naming what defends against what without re-mintage of substance the consumed sources already own.

The discipline is strict: §18 names the threat model + the defense-mechanism inventory + the structural-separation construction; it does NOT decide rate-limit numeric values (HARDEN.6 territory), it does NOT pick Turnstile site-key configuration (ADR-0004 owns), and it does NOT design admin-key rotation procedure (ADR-0010 + `BREAK_GLASS.md` own). v1 is a research-grade experiment with sole-MM operation, soulbound-Dharma-only consequences, and a hard 2026-11-05 23:59 UTC write-freeze; the threat model is calibrated to that scope.

### §18.1 Threat model

Six classes of threat. Three in-scope (defended); three out-of-scope (deferred or residual-accepted).

| # | Threat class | In/out of scope | Rationale |
|---|---|---|---|
| **1** | **Account creation abuse** (bot-driven sybil; mass auto-account creation to inflate pseudonym pool consumption or accumulate Dharma allowance) | **In scope** | Two-vendor anti-bot defense (Turnstile + Google Identity Services) + OTP rate-limit pair gates F-AUTH-2; pseudonym pool consumption is constrained per §3.5 + ADR-0011 (50K-row pool with 5% low-watermark alarm). |
| **2** | **Per-surface request abuse** (credential-stuffed traffic against bet endpoints, image-PUT-URL mint endpoints, OTP send endpoints, admin login endpoint) | **In scope** | Per-IP and per-identifier sliding-window rate limits across seven §11 surfaces per ADR-0015 + SPEC.1 §16.1; `bet-ip` 1m + `image-put-ip` 1m + `admin-login-ip` 1h are the load-bearing per-IP caps. |
| **3** | **Admin compromise** (stolen `ADMIN_PASSWORD`, leaked admin cookie, admin-account takeover) | **In scope** | Static-password auth via `crypto.timingSafeEqual` + transactional `DELETE+INSERT` single-row-at-any-moment + two-layer middleware-plus-validator per CVE-2025-29927 + identical-401 information-leak avoidance + `BREAK_GLASS.md` rotation procedure per ADR-0010 + §8.4. The single-admin assumption per SPEC.1 §15 + E4 is structural. |
| **4** | **Coordinated-stake attacks** (one party operating multiple legitimate accounts to manipulate market price or inflate a post's Support/Counter via coordinated reply-bets) | **Out of scope** | Defense surface deferred to testnet phase (proof-of-personhood gating, on-chain identity binding). v1 sole-MM operation + soulbound-Dharma-only consequences + research-grade scope make the residual risk acceptable; the 2026-11-06 dataset release exposes coordinated-stake patterns post-hoc for research analysis. |
| **5** | **Insider threat** (admin-actor acting in bad faith — manipulating market resolution, suppressing comments, exfiltrating PII) | **Out of scope (residual-accepted)** | Single-admin assumption per E4; admin actions are append-only-audited via `admin_events` (Bucket A per §6.2) + `mod_actions` (Bucket A per §6.2) + INV-4 append-only resolutions. Detection runs post-hoc on the 2026-11-06 dataset; prevention via single-admin trust assumption. Multi-admin or admin-key-rotation-on-compromise is post-experiment scope. |
| **6** | **Network-layer / infrastructure attacks** (DDoS, BGP hijack, certificate-authority compromise, Vercel/Supabase/R2 supply-chain) | **Out of scope (vendor-mitigated)** | Vercel + Cloudflare + Supabase carry their own DDoS + WAF + cert-rotation defenses; v1 codebase does not re-implement at the application layer. Out-of-scope is acceptance of the vendor mitigation surface, not absence of defense. |

The threat model is calibrated to the experiment's research-grade deployment. Threats 4 + 5 + 6 are deliberately out-of-scope at v1; testnet phase and beyond redraw the model under proof-of-personhood + multi-admin + economic-stake conditions.

### §18.2 Sybil-defense layered surface

Five distinct mechanisms compose to defend against threats 1 + 2. Each has its own surface, its own failure mode, and its own consumer-section in this spec.

| # | Mechanism | Surface | Failure mode | Source |
|---|---|---|---|---|
| **(a)** | Cloudflare Turnstile | F-AUTH-2 OTP issuance via `hooks.before` middleware on the Better Auth `/email-otp/send-verification-otp` path | **Fail-closed** — siteverify failure rejects OTP request with HTTP 400 `error_turnstile_failed`; never invokes Resend. Legal-floor consent surface symmetric to §10 / §11 idempotency / moderation. | §8.2 + ADR-0004 |
| **(b)** | Google Identity Services abuse signals | F-AUTH-1 OAuth callback with `email_verified === true` enforcement | **Fail-closed at the predicate** — accounts where Google has not verified email are rejected with `error_oauth_email_not_verified`; the OAuth provider's own anti-bot signals (account age, behavior-pattern flags) ride upstream. | §8.2 + ADR-0004 |
| **(c)** | OTP rate-limit pair | F-AUTH-2 OTP send endpoint | **Fail-open per §17.5** — Upstash outage admits the request; Sentry alarm 6a fires per §11. Two parallel `Ratelimit.limit()` calls (`otp-email:{email}` 1h + `otp-ip:{ip}` 1m); both must succeed. | §11 + ADR-0015 + SPEC.1 §16.1 |
| **(d)** | Per-IP anti-abuse caps | Bet-flow + image-PUT-URL mint surfaces | **Fail-open per §17.5** — `bet-ip:{ip}` 1m + `image-put-ip:{ip}` 1m sliding windows. New constants minted by ADR-0015 (`BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`); numeric values deferred to HARDEN.6. | §11 + ADR-0015 |
| **(e)** | §8.7 seven-pillar structural-separation rule | Admin / participant universe boundary | **Construction-layer, no failure mode** — admin is structurally outside the participant graph (no `users.role` column, no admin `users` row, two distinct cookie names + paths + tables, no FK between `admin_sessions` and `users`, never-cross-cookie-validation, inline-admin-affordances-validate-at-backend). Backs B5 via data-model construction. | §8.7 |

The layering is asymmetric: (a)+(b) defend account-creation per threat 1; (c) defends OTP abuse specifically; (d) defends per-surface request abuse per threat 2; (e) is the structural-separation construction backing admin / participant disjointness per threat 3 + §18.4. No mechanism is load-bearing alone — defense-in-depth means a single mechanism's bypass does not cascade to total compromise.

### §18.3 ToS acceptance enforcement (legal-floor surface)

Per SPEC.1 §16.5 + ADR-0004's session-deferral hook (§8.3). ToS acceptance is enforced server-side, not client-side. The construction-layer protection:

- **Session-cookie cannot issue before ToS acceptance.** §8.3's `databaseHooks.session.create.before` hook reads `users.tos_accepted_at` for the `session.userId` and throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` if NULL. No participant cookie reaches the client until F-AUTH-4 has written acceptance evidence.
- **Acceptance evidence is mandatory and persistent.** F-AUTH-4 writes `users.tos_accepted_at` (timestamp), `users.tos_version_hash`, `users.privacy_version_hash`, `users.tos_acceptance_ip`, `users.tos_acceptance_user_agent` in one Postgres SERIALIZABLE transaction per §3.5. The `users` row is Bucket C (mutable) per §5.1 row 14, but the four ToS-evidence columns are write-once-then-immutable by application convention (no UPDATE path mutates them; H2 erasure null-s them per §19.4 along with PII columns).
- **ToS version change forces re-acceptance.** A change to the canonical ToS document MUST mint a new `tos_version_hash` and the next `databaseHooks.session.create.before` evaluation against an existing session compares stored hash to current hash; a mismatch routes back to F-AUTH-4 with `error_tos_version_changed` (HTTP 410 `error_type: gone`). Version-change cadence is procedural, not v1-tooling — the canonical ToS document lives outside the codebase.
- **Privacy policy parallel.** `privacy_version_hash` follows the same shape; a privacy-policy change forces re-acceptance via the same hook path.

The 2026-11-05 23:59 UTC write-freeze (per §20) preserves ToS evidence in `users` rows for the dataset release — `tos_acceptance_ip` and `tos_acceptance_user_agent` are PII-stripped at H2 export per §19.4, but the `tos_accepted_at` timestamp + version hashes are preserved as research-relevant metadata.

### §18.4 Admin / participant six-property structural separation

The §8.7 seven-pillar rule promotes to a six-property summary in §18 prose. The promotion is intentional — §8.7's seven pillars are the per-pillar enumeration each load-bearing on auth-contract correctness; §18.4 is the higher-order assertion that admin and participant universes are structurally non-overlapping at the data-model layer, which is the construction-layer protection of B5 and the defense surface for threat 3.

Six properties:

1. **No shared identity row.** Admin has no `users` row; participant identities cannot be admin. Verified by §5.1 row 14 (`users` schema carries no `role` column).
2. **No shared session table.** `sessions` (Better Auth-managed, FK to `users.id`) and `admin_sessions` (hand-rolled, no FK) are structurally disjoint.
3. **No shared cookie name.** `zugzwang_session` and `zugzwang_admin_session` are non-overlapping; per §8.5 the path scopes (`/` vs `/admin`) make a single browser unable to present both to the same path.
4. **No shared validator.** Participant Server Actions and Route Handlers validate `sessions` only; admin equivalents validate `admin_sessions` only. Cross-cookie-type access is rejected at handler entry per §8.7 pillar 6.
5. **No shared events surface.** Participant auth flows write to `user_events`; admin auth flows write to `admin_events` (per §8.8). Encoding: `metadata.user_id = NULL` + `metadata.actor_id = 'admin-singleton'` for admin-actor events; `metadata.user_id = users.id` + `metadata.actor_id = users.id` (self-actor) for participant events.
6. **No shared FK in audit tables.** `admin_events` and `mod_actions` reference admin-actor rows by string identifier `'admin-singleton'` (a sentinel value), not by FK. The participant audit surface (`user_events`) references `users.id` via FK. Cross-table joins between admin and participant audit surfaces are structurally impossible.

The six-property promotion makes the construction backing B5 visible in one place. A reviewer auditing the sybil-defense surface against threat 3 (admin compromise → cascading participant compromise) sees the six structural firewalls between universes and the absence of any shared surface.

### §18.5 Data-access architecture: server-only (RLS out of scope)

Per **ADR-0019**. Row-Level Security (RLS) is **deliberately out of scope** for the experiment phase, because the database is **server-only** (Architecture 2):

- **The access topology.** Every read and write goes through the Next.js server — mutations via Server Actions (the locked mutation contract per ADR-0003) + the bet/admin Route Handlers (§4.3), reads via server route handlers / server components (§3.1, §3.3) — using a single trusted (service-role) database credential. No browser, client component, or third party ever holds a database connection. Authorization lives entirely in the server's Server Action / handler layer (Better Auth-backed per ADR-0004 + §8). This holds under the public-read / auth-gated-act posture: logged-out reads are still served *by the server* from the trusted connection, not by a client-direct query.
- **Why RLS is not load-bearing here.** RLS enforces row rules inside Postgres against whatever credential connects. In a server-only topology, RLS would police Zugzwang's *own trusted server* — which has already authorized the request — making it a redundant backstop, not a control on an exposed surface. **Build skipped; decision recorded.** (§6.5 notes the related fact that the Supabase `service_role` key bypasses RLS but does **not** bypass the append-only triggers; those Postgres-level controls per §6 + ADR-0005, plus balance `CHECK`s and NOT-NULL FKs, are independent of this RLS decision and remain in force.)
- **Tripwire (a durable invariant, not a one-time call).** This posture is valid **only** while the database stays server-only. The day any client-direct database path is introduced — a Supabase/anon client in a browser component, a public PostgREST/data endpoint, any user-scoped DB credential reaching an untrusted client — **RLS becomes mandatory before that path ships.** Any PR introducing a client-side data-access path MUST trigger this clause; flagged for the engine/handler review checklist.
- **Accepted tension.** With no RLS, the server's authorization code is the *only* lock — there is no database-level safety net if a Server Action omits an ownership/eligibility check. This is an accepted trade for the experiment and a direct argument for the writer/reviewer discipline on the engine handlers (§13 + CLAUDE.md).
- **Revisit at testnet** (real value, onchain escrow, higher stakes, likely different access topology).
- **D4 note.** The SYNC recon flagged a `supabase/migrations/` directory referenced but absent. Per ADR-0019 this needs no RLS scaffolding for this phase; if the directory is later needed for non-RLS migrations that is a separate housekeeping item, **not a security gap** (and out of SPEC.2's scope to create).

### §18.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Threat model in/out-of-scope inventory | §18.1 |
| Five-mechanism layered sybil defense | §18.2 |
| ToS acceptance enforcement at session-deferral hook | `src/server/auth/session-gate.ts` (per §8.3) |
| ToS acceptance evidence write at F-AUTH-4 | `src/server/auth/tos/accept.ts` (per §4.2) |
| Cloudflare Turnstile siteverify wiring | `src/server/auth/turnstile.ts` (per ADR-0004 + §8.2) |
| Six-property structural-separation enumeration | §18.4 |
| Data-access architecture / RLS posture + tripwire | §18.5 (per ADR-0019) |
| Per-IP rate-limit constants | `src/server/config/limits.ts` (per §11 + SPEC.1 §16.1) |
| `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` numeric values | HARDEN.6 (per §11.6) |
| `BREAK_GLASS.md` admin-key rotation runbook | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per §21.3 + ADR-0010) |
| Admin-actor encoding to `admin_events` | §8.8 + §3.6 |
| Append-only trigger SQL backing audit-trail integrity | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6 + ADR-0005) |

ADRs consumed by §18: ADR-0004 (Better Auth + Cloudflare Turnstile via `hooks.before` + Google Identity Services configuration + session-deferral hook), ADR-0010 (admin auth path + static-password timing-safe comparison + two-layer middleware-plus-validator per CVE-2025-29927 + `BREAK_GLASS.md` rotation), ADR-0014 (pre-commit moderation legal-floor coupling for CSAM detection + reporting compliance per SPEC.1 §16.5 — NCMEC auto-report mechanism deferred to post-experiment per SCAFFOLD.16 LD-7; out-of-scope at the threat-model layer; in-scope at the §10 / §17 alarm surface), ADR-0015 (rate-limit + idempotency contract backing per-surface caps; new `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` constants minted by ADR-0015 §1), **ADR-0019** (RLS out of scope — server-only Architecture 2 + tripwire, recorded at §18.5). 3-D R1–R5 + A1–A5 + B1–B5 ratifications absorbed.

---

## §19 Public Dataset Export

§19 owns the *public-dataset release contract* for the experiment-phase build — the 2026-11-06 GitHub release artifact at `zugzwang-foundation/experiment` that ships the canonical research dataset; the 13-tables-shipped / 4-not-shipped policy that determines what enters the public archive vs what is operationally-only; the PII strip-not-hash treatment that drops the ten PII columns rather than pseudo-anonymizing them; the export-time JOIN pseudonymization that maps `users.id` to pseudonym slugs at build time so cross-table joins in the released archive work via pseudonym keys; the K_eff(t) trajectory as the *only* K_eff derivation surface in v1 per SPEC.1 G3; and the `/api/dataset/manifest` endpoint contract per §4.3. SPEC.1 §12.2 owns the *product-level* dataset commitment (the public release happens, ships under a permissive license, supports replication); §3.7 + §7 own the *event-row contract* that the dataset structurally is `pg_dump` over; this §19 sits at the *export pipeline + privacy + access* layer, naming what gets shipped, how it's pseudonymized, and where readers find it.

The discipline is strict: §19 names the table inventory + per-column treatment + the export-time JOIN mechanism + the K_eff derivation surface; it does NOT pick file format (Parquet vs CSV vs SQL dump — that's §19.6 deferred to HARDEN.* per the SCAFFOLD.* cadence-aligned implementation), it does NOT decide the manifest JSON schema's exact field set (deferred to HARDEN.* alongside the manifest endpoint implementation), and it does NOT design researcher-tooling integration (out of scope; researchers use whatever they want against the static archive).

### §19.1 Release boundary + GitHub artifact

**Release date.** 2026-11-06 — first calendar day of Devcon 8 at JIO World Center, Mumbai. The release lands as a GitHub release artifact at `zugzwang-foundation/experiment` (the codebase repo; release artifacts attach to the same repo per GitHub convention); the long-lived static URL is the GitHub-served release-asset URL plus a permanent redirect from a `zugzwangworld.com/dataset` short-link (operational; not v1 ENGINE territory).

**Source-of-truth state.** The release artifact is built from a Postgres state snapshot taken immediately after the 2026-11-05 23:59 UTC write-freeze fires (per §20). The artifact contains rows that existed at the freeze instant; rows from any post-freeze writes (which §20.2 forecloses anyway) would be absent. The build pipeline runs once; subsequent re-builds for bug-fixes against the same source state are acceptable (e.g., a privacy-redaction bug discovered post-release triggers a v2 of the artifact). The build pipeline does NOT run continuously during the experiment — there is no streaming or near-real-time dataset surface in v1.

**Format.** Tabular (per-table CSVs or per-table Parquet — final pick deferred to HARDEN.*) compressed into a single tarball per release. The manifest JSON file (per §19.7) names the tarball's checksum, the included file inventory, the schema-version cursor, and the per-table row counts.

**License.** CC-BY-4.0 — locked at PRECURSOR.4 alongside SPEC.1 §12.2 license language. The dataset is research-grade public-good output; the soulbound-Dharma score makes it not commercially-replicable as the live experiment, so the license question is about academic citation requirements + zero-friction usage, not commercial use protection.

### §19.2 Dataset architecture

The dataset is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per SPEC.1 §12.2). Two architectural properties make this work:

**Events log + current-state tables together carry the full state.** Per §3.7 + §7, every state-mutating data flow emits at least one events-row in the same transaction as the current-state write; the events log is the canonical audit ledger; current-state tables are co-maintained inside the same transaction for read access. Replaying the events log against an empty database reproduces the current-state tables exactly — this is the property the dataset relies on, and the property §6's append-only enforcement contract structurally guarantees.

**The dataset preserves both the events log and the current-state tables.** A consumer can either (i) read the current-state tables directly for "what's the final state" questions, or (ii) reconstruct any historical instant by replaying events against an empty database and snapshotting at the target timestamp. The redundancy is deliberate — most researchers will use the current-state tables; researchers studying time-series K_eff(t) trajectories use the events log.

The build pipeline runs `pg_dump` against a freeze-snapshot Postgres replica (Supabase point-in-time recovery to the freeze instant), then post-processes per §19.4 (PII strip) and §19.5 (export-time JOIN pseudonymization), then packages into the tarball. The replica is short-lived (built for the export run, dropped after); the pipeline is one-shot.

### §19.3 Tables shipped vs not shipped

Per §5.1, twenty-two tables in v1; twenty are dataset-relevant (the two pg_cron operational tables `watermark_state` + `cron_alarms` are excluded from the dataset inventory entirely). **Of those twenty: fifteen ship; five do not (operational / privacy-sensitive).**

| # | Table | Bucket | Shipped? | Rationale |
|---|---|---|---|---|
| 1 | `events` | A | YES | Canonical audit log; foundational for K_eff(t) reconstruction |
| 2 | `dharma_ledger` | A | YES | Per-transaction Dharma flow; foundational for participant correctness analysis |
| 3 | `bets` | A | YES | Per-bet record |
| 4 | `comments` | A | YES | Per-comment record |
| 5 | `resolution_events` | A | YES | Per-market-resolution audit row |
| 6 | `payout_events` | A | YES | Per-bet settlement |
| 7 | `mod_actions` | A | YES | Moderation audit trail (admin actions on participant content; admin-actor encoded as `'admin-singleton'`) |
| 8 | `admin_events` | A | YES | Admin-action audit trail |
| 9 | `user_events` | A | YES | User lifecycle audit trail (ToS acceptance evidence, pseudonym assignment, daily-allowance accrual) |
| 10 | `identity_pool` | B | YES | Pseudonym pool (post-experiment all 50K rows are revealed; the pool is research-relevant) |
| 11 | `image_uploads` | B | YES | Image upload lifecycle (terminal-state audit; `r2_object_key` excluded per §19.4) |
| 12 | `markets` | C | YES | Market metadata |
| 13 | `pools` | C | YES | CPMM pool reserves at freeze |
| 14 | `positions` | C | YES | Per-user-per-market position cache (final positions at freeze) |
| 15 | `users` | C | **YES with PII strip per §19.4** | Pseudonym + ToS metadata + bet/comment join keys; ten PII columns dropped |
| 16 | `system_state` | B | NO | Operational singleton; the freeze itself is observable from the events log without the row |
| 17 | `sessions` | C | NO | Operational; per ADR-0016 D6 + SPEC.1 §16.4 — privacy-sensitive (cookie tokens, last-seen timestamps) |
| 18 | `accounts` | C | NO | Provider-side identity proof (Google OAuth account linkage); no thesis-relevant signal; PII-adjacent |
| 19 | `verifications` | C | NO | Transient OTP rows (TTL-bounded; nothing persists past the OTP send window anyway) |
| 20 | `admin_sessions` | C | NO | Operational; admin-side privacy-sensitive |

**Shipped: 15 tables; not shipped: 5.** Shipped = the 9 Bucket-A audit tables (`events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`) + 2 Bucket-B (`identity_pool`, `image_uploads`) + 3 current-state-context Bucket-C (`markets`, `pools`, `positions`) + `users` (PII-stripped per §19.4). Not shipped = `system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions` (operational / privacy-sensitive). The two pg_cron operational tables (`watermark_state`, `cron_alarms`) are not part of the dataset inventory at all.

The earlier "13 shipped + 4 not shipped" 3-E baseline was an undercount (it omitted `markets` / `pools` / `positions` from the explicit enumeration); the v0.3-draft body corrected it to 16 + 5, and this SYNC.7 pass drops `friendly_fire_events` (removed entirely per ADR-0017 — the reply-as-bet model has no friendly-fire table) bringing the shipped count to **15 + 5**. PRECURSOR.4 verifies the count alongside §15.4's 38-code baseline.

### §19.4 PII strip-not-hash policy

Per ADR-0016 D6 + 3-E A1: the ten PII columns are **dropped** (set to NULL or removed from the released schema) rather than pseudo-anonymized via hash. Strip-not-hash is the chosen treatment because:

(a) **Hash collisions across columns expose patterns.** A `hash(email)` column would let an attacker who knows a target email confirm membership in the dataset; strip-not-hash forecloses confirmation attacks entirely.

(b) **Rainbow-table attacks against weak inputs.** Email, IP, and user-agent are weak-entropy inputs; even SHA-256 hashed columns are reversible against pre-computed rainbow tables. Strip wins.

(c) **Research signal from PII columns is zero.** Email, IP, and user-agent carry no thesis-relevant signal; researchers studying market behavior + commentary correctness do not need them. The hash form would be tolerated only if the signal warranted; it doesn't, so strip is strictly better.

**The ten PII columns dropped at export:**

| Column | Source table | Treatment |
|---|---|---|
| `email` | `users` | Removed from released schema (column does not appear in dataset) |
| `google_id` | `users` | Removed |
| `name` | `users` | Removed (Google display name) |
| `image` | `users` | Removed (Google avatar URL) |
| `tos_acceptance_ip` | `users` | Removed |
| `tos_acceptance_user_agent` | `users` | Removed |
| `pfp_filename` (subset — only when null-ed by H2 erasure) | `users` | Released as-is; H2-erased rows release as NULL |
| `r2_object_key` | `image_uploads` | Removed |
| `metadata.ip` | All audit tables (`user_events`, `admin_events`, `mod_actions`, `events`) | Removed at the JSONB-key level (subset of the seven-field metadata set per §3.7) |
| `metadata.user_agent` | All audit tables | Removed at the JSONB-key level |

The remaining five `metadata` fields (`request_id`, `flow_id`, `user_id`, `actor_id`, `idempotency_key`) ship in the released audit tables. The `idempotency_key` field is included because it's client-generated and carries no PII (clients send opaque random strings); the field's research value is moderate (debugging duplicate-write patterns).

**H2 erasure interaction.** Per SPEC.1 §16.6 + §12.7, H2 erasure scrubs `users` PII columns + null-s `pfp_filename` while preserving the `users` row (audit-trail integrity per Bucket-C convention). At dataset-export time, H2-erased rows ship in the same shape as not-erased rows — both have NULL email, NULL google_id, etc. The dataset consumer cannot distinguish "user erased pre-freeze" from "user never had data": this is the privacy-by-design property; not a bug.

### §19.4.1 Per-payload-key STRIP rules for `events.payload`

The `events.payload` JSONB column SHIPs verbatim per §19.3 row 1 + Appendix B.13, but the per-event-type payload shapes carry PII or sensitive substrate identifiers in some keys. The export pipeline applies per-event-type STRIP rules at the JSONB-key level (analogous to `metadata.ip` / `metadata.user_agent` STRIP_KEY per §19.4 table above).

Audit trails are exhaustive at the runtime emission layer by design (INV-4 + ADR-0005 sync-target rule); export-time strip handles the privacy boundary. Two separate concerns, two separate layers. Runtime emission MUST NOT pre-strip — full payload fidelity is required for in-database forensics + admin replay.

| event_type | STRIP_KEY targets | Rationale |
|---|---|---|
| `user.tos_accepted` | `payload.ip`, `payload.user_agent` | PII per §19.4 row 3-4; redundant with `users.tos_acceptance_ip` + `users.tos_acceptance_user_agent` (already STRIP) |
| `user.oauth_signed_in` | `payload.googleId` | PII per §19.4 row 2 (mirrors `users.google_id` STRIP) |
| `user.otp_signed_in` | `payload.email` | PII per §19.4 row 1 (mirrors `users.email` STRIP) |
| `user.pseudonym_assigned` | `payload.userId` | Defense-in-depth — `aggregate_id` already PSEUDO per §19.5; explicit payload strip prevents re-identification via cross-join |
| `user.signed_out` | `payload.userId` | Same rationale as above |
| `image_upload.sign_requested` | `payload.userId`, `payload.key` | `userId` PSEUDO defense-in-depth; R2 key embeds userId per SCAFFOLD.15 §Q9 (`u/<userId>/<uploadId>.<ext>`) |
| `image_upload.committed` | `payload.userId`, `payload.key` | Same rationale (DEBATE.2 future emit site) |
| `image_upload.blocked` | `payload.userId`, `payload.key` | Same rationale (DEBATE.2 future emit site) |
| `image_upload.orphaned` | `payload.key` | R2 key strip; `uploadId` is the row id (SHIP — not PII) |
| `admin.signed_in` | `payload.sessionId`, `payload.ip` | Cookie value + admin IP defense-in-depth (mitigation layer beyond `BREAK_GLASS.md` rotation pre-freeze) |
| `admin.signed_out` | `payload.sessionId` | Cookie value defense-in-depth |
| `dharma.credited` | `payload.userId` | PSEUDO defense-in-depth — `aggregate_id` carries the user id; same rationale as `user.signed_out` (ENGINE.12 emit site) |
| `bet.placed` | `payload.userId` | Defense-in-depth — actor identity ships via `metadata.user_id` (PSEUDO per §19.5); explicit payload strip prevents re-identification via cross-join. Research keys (stake, side, price, market/comment ids) SHIP — K_eff(t) derivation core per §19.6 (ENGINE.8 emit site) |
| `bet.sold` | `payload.userId` | Same rationale; sell-leg research keys (`sharesSold`, `proceeds`, `price`) SHIP (ENGINE.8 emit site) |
| `comment.placed` | `payload.userId` | Same rationale; payload research keys (`side`, `bodyLength`, market/bet/comment ids, `uploadId`) SHIP — the comment `body` + `side_at_post_time` are not payload keys; they SHIP via the `comments` table per Appendix B.13, commentary being the dataset's thesis-core signal (ENGINE.8 emit site) |

**Adding a new event_type or modifying a payload shape** is a same-commit amendment to this table plus the schema declaration at `src/server/events/schemas.ts` plus the per-site emit call. The export pipeline reads this table to derive its per-payload-key strip lambdas (implementation deferred to HARDEN.* / DATASET.* stratum; runtime emission codifies the strip-key contract at the spec layer NOW so future emit sites cannot accidentally bypass).

### §19.5 Export-time JOIN pseudonymization

**Cross-table joins in the released archive use pseudonym slugs as join keys, not raw `users.id` UUIDs.** The build pipeline performs export-time JOINs that rewrite every FK reference from `users.id` (UUIDv7) to the corresponding `users.pseudonym` (the colour-animal-number slug per ADR-0011 + §3.5):

- `bets.user_id` (UUIDv7) → `bets.user_pseudonym` (string)
- `comments.user_id` → `comments.user_pseudonym`
- `dharma_ledger.user_id` → `dharma_ledger.user_pseudonym`
- `mod_actions.user_id` (target user) → `mod_actions.user_pseudonym`
- `events.metadata.user_id` (within JSONB) → `events.metadata.user_pseudonym`
- `image_uploads.user_id` → `image_uploads.user_pseudonym`

Per ADR-0016 D6, the live Postgres database uses raw UUIDs as join keys (correct for transactional workloads); the dataset uses pseudonym slugs (correct for offline analysis where readability matters and UUIDs add no value). The `users.id` raw UUID is preserved in the released `users` table as a join key for researchers who want to verify cross-table integrity, but downstream tables reference pseudonyms.

**Admin-actor rows preserve the `'admin-singleton'` sentinel.** Rows where `metadata.actor_id = 'admin-singleton'` ship with the sentinel intact (no pseudonymization applies — admin has no `users` row, no pseudonym to map). Researchers analyzing admin-actor patterns filter on the literal sentinel string.

### §19.6 K_eff(t) trajectory — derived from this dataset only

Per SPEC.1 G3 + §5.4 + PRECURSOR.2-B D4: K_eff(t) is **not** a live in-product surface. It is **derived post-hoc, out-of-band, against the 2026-11-06 dataset release**. There is no `k_eff_dashboard` materialized view in v1, no async refresh, no in-product K_eff component.

The derivation runs externally (researchers' own tooling against the released archive). The events log is the canonical input — every state mutation emits an events row, and the K_eff formula `K_eff(t) = K_0 · n(t) · σ(t)` is computable per-instant by replaying events through some `t`. The dataset release ships the events log + audit tables that supply `n(t)` (number of informed participants) and `σ(t)` (signal coherence — TBD by the researcher's own derivation choice).

The `users` and `bets` tables alone are insufficient — K_eff(t) depends on the *trajectory* of participation + commentary + stake-weighted information aggregation, which only the events log reconstructs. This is why the events log ships per §19.3 row 1 even though many researchers may default to the current-state tables.

### §19.7 Manifest endpoint contract

Per §4.3 row 8: `GET /api/dataset/manifest`. Public read (no auth). Active **post-2026-11-06 only** — pre-release the endpoint returns HTTP 503 `error_dataset_not_yet_released`; post-release it returns the manifest JSON.

**Manifest JSON shape (preliminary; final schema deferred to HARDEN.*):**

```json
{
  "schema_version": "1.0",
  "release_date": "2026-11-06",
  "tarball_url": "https://github.com/zugzwang-foundation/experiment/releases/download/dataset-v1/zugzwang-experiment-2026-11-06.tar.gz",
  "tarball_sha256": "<hex>",
  "tarball_size_bytes": 0,
  "license": "CC-BY-4.0",
  "tables": [
    {
      "name": "events",
      "row_count": 0,
      "column_set": ["event_id", "event_type", "aggregate_type", "aggregate_id", "payload", "payload_version", "metadata", "created_at"],
      "metadata_fields_included": ["request_id", "flow_id", "user_id", "actor_id", "idempotency_key"],
      "metadata_fields_excluded": ["ip", "user_agent"]
    }
  ],
  "pseudonymization": "export-time JOIN; users.id → users.pseudonym for downstream FKs"
}
```

The endpoint is a thin static-file pointer; it does not serve the tarball itself (GitHub release assets serve directly). The endpoint exists to make programmatic discovery possible (researcher tooling can fetch the manifest to verify checksums + schema version + table inventory before downloading the tarball).

### §19.8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Release date + GitHub artifact location | §19.1 + SPEC.1 §12.2 |
| Build pipeline (one-shot Postgres point-in-time recovery + pg_dump + post-process + tarball) | HARDEN.10 (per §21.3 + ADR-0006) |
| Tables-shipped vs not-shipped policy | §19.3 |
| PII strip-not-hash policy + ten PII columns dropped | §19.4 |
| Export-time JOIN pseudonymization | §19.5 |
| K_eff(t) derivation surface (post-hoc, against this dataset only) | §19.6 + SPEC.1 G3 |
| `/api/dataset/manifest` Route Handler | `src/app/api/dataset/manifest/route.ts` (per §4.3 + §13 — F-DATASET-1 minted alongside; gating SCAFFOLD.18) |
| Manifest JSON schema | §19.7 (preliminary; final at HARDEN.*) |
| Final license selection (CC0 vs CC-BY-4.0) | ✅ Resolved at PRECURSOR.4 → **CC-BY-4.0** |

ADRs consumed by §19: ADR-0005 (events log + Pattern A backing dataset architecture), ADR-0006 (Supabase point-in-time recovery for freeze-snapshot replica), ADR-0011 (pseudonym slug formation backing export-time JOIN), ADR-0016 (raw UUIDs in live database vs pseudonym slugs in dataset, per D6). 3-E A1 absorbs strip-not-hash treatment; 3-E §19.3 source-row reconciliation (3-E baseline of "13 shipped" was an undercount; v0.3-draft corrects to 16 shipped + 5 not shipped per §19.3 inventory). PRECURSOR.2-B D4 absorbs K_eff(t) derivation as the only surface in v1 — no live in-product K_eff component.

---

## §20 Conclusion-Event Freeze

§20 owns the *write-freeze contract* for the experiment-phase build — the single moment at 2026-11-05 23:59 UTC when every state-mutating endpoint switches from accepting writes to rejecting them with HTTP 410 `error_experiment_concluded`, the `system_state` row + middleware mechanism that enforces the freeze, the asymmetric authentication-still-live posture (read paths remain operational; signup-and-login still functions; only state-mutation gates close), and the structural reversibility-none enforcement at the database layer via §6 Bucket-B trigger discipline. SPEC.1 §12 owns the *product-level* commitment that the experiment concludes; SPEC.1 §12.4 owns the *catastrophic-failure recovery* (BREAK_GLASS.md surgery as the only path to thaw the freeze, accepted as breaking the experiment deliverable); ADR-0010 owns the *operational rotation* surface for the admin path that survives the freeze. This §20 sits at the *freeze enforcement contract* layer, naming the row + the mechanism + the wire envelope + the structural reversibility floor.

The discipline is strict: §20 names the freeze instant + the trigger row + the middleware mechanism + the wire envelope + the reversibility-none property; it does NOT design the post-freeze read-only UX (out of scope for v1; the experiment ends, the product page degrades to "concluded" gracefully — UI.* territory), it does NOT decide cron-based vs manual-trigger freeze (the §20.2 mechanism is dual-path; HARDEN.* picks the operational primary), and it does NOT specify the post-2026-11-06 dataset publishing pipeline (§19 owns).

### §20.1 Freeze instant

**2026-11-05 23:59 UTC.** Single timestamp; single source of truth. The instant is exactly one minute before midnight UTC at the boundary between November 5 and November 6, chosen to give the build pipeline (per §19.1) a stable snapshot for the 2026-11-06 dataset release.

The instant is locked at SPEC.2 v1.0 — moving it forward or back requires an ADR + same-commit SPEC.1 + SPEC.2 + tracker update. Calendar drift between the SPEC.1 §12 timeline ("the experiment concludes November 5") and the §20.1 specific second is reconciled here: SPEC.1 names the calendar boundary; §20.1 names the specific UTC second.

The instant is **distinct from** the experiment-phase upper boundary at 2026-11-08 (the codebase archive boundary per ADR-0001 + §0.1). The two-day window between freeze (Nov 5 23:59 UTC) and codebase archive (Nov 8) covers the Devcon 8 conclusion day (Nov 6) + ETHGlobal Mumbai showcase tail (Nov 6-8). During this window the codebase remains live but state-frozen — read paths render, auth still works, no writes succeed. ETHGlobal Mumbai showcase visitors can browse the experiment in its terminal state.

### §20.2 Mechanism — `system_state.frozen_at` + middleware

**Trigger row.** A single-row table `system_state` keyed by `id = 'system'` (literal string sentinel; no UUIDv7 for this row because there's exactly one row and no FK references). The Bucket-B classification per §5.1 row 13 + 3-E §20-1 ratification specifies the whitelisted transition: `frozen_at` NULL → timestamp, set together with no other column changes. The §6.3 trigger function rejects re-firing (NULL → timestamp once, never timestamp → timestamp) and rejects un-freezing (timestamp → NULL forbidden) and rejects DELETE.

**Initialization.** Migration mints the row at SCAFFOLD.2 deploy: `INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL);`. The row exists from day-1 of the experiment with `frozen_at = NULL`; the freeze is the single UPDATE that flips the column.

**Two trigger paths (HARDEN.* picks primary; both ratified at v1.0 lock):**

- **Path A — `pg_cron` scheduled.** A `pg_cron` job runs at 2026-11-05 23:59:00 UTC and executes `UPDATE system_state SET frozen_at = '2026-11-05 23:59:00+00:00' WHERE id = 'system' AND frozen_at IS NULL;`. The trigger function from §6.3 enforces the once-only transition; the WHERE clause is belt-and-braces so a re-firing would be a no-op anyway.
- **Path B — Manual SQL.** An admin connects to Supabase via `psql` at the freeze instant and executes the same UPDATE manually. Required-skill: someone with Supabase admin credentials online at 23:59 UTC; deferred to HARDEN.10 runbook.

The dual-path is deliberate. Path A's failure mode (cron job didn't run, e.g., Supabase maintenance window collision) requires Path B as backstop. HARDEN.* picks Path A as primary with Path B as runbook-documented fallback; v1.0 lock names both as ratified mechanisms.

**Middleware mechanism.** Every state-mutating endpoint (Server Action, Route Handler) checks `system_state.frozen_at IS NOT NULL` at handler-stack step 1 (per §3.1) — adjacent to the auth gate, before the idempotency cache lookup. If `frozen_at IS NOT NULL` the handler returns HTTP 410 `error_experiment_concluded` (per §15.4) without opening any transaction or invoking any business logic. The check is a single SELECT against the single-row `system_state` table; the row is heavily cached (per Postgres's small-table buffer-pool retention).

The middleware is not a Next.js middleware (per §3.1's note on `proxy.ts`'s narrow responsibility — the freeze check needs to know the handler class, which middleware can't see). Instead it's a helper function `await isFrozen()` invoked at the top of every handler-stack-step-1 sequence; CI lint at HARDEN.* enforces presence on every state-mutating handler. The asymmetric posture: read paths do NOT call `isFrozen()` (they remain available indefinitely post-freeze); only state-mutating paths gate.

**Wire envelope.** HTTP 410 (Gone) per §15.4. `error_code: error_experiment_concluded`. `error_type: gone`. `retry_semantics: do_not_retry`. `retry_after: null`. Display message template: "The experiment concluded on November 5, 2026. The market is permanently closed. The public dataset is at <link>." (Final copy locked at HARDEN.*; the message-template field per §15.1 is the copy surface.)

### §20.3 Reversibility-none + auth-still-live + admin-mutation-still-live

**Reversibility is none.** The §6.3 trigger function on `system_state.frozen_at` rejects timestamp → NULL transitions (§5.1 row 13 + §6.3 spec). The only path to thaw the freeze is direct database surgery via `BREAK_GLASS.md`'s `ALTER TABLE system_state DISABLE TRIGGER ... ; UPDATE ...; ALTER TABLE ... ENABLE TRIGGER ... ;` sequence — which breaks the experiment deliverable per SPEC.1 §12.4 and is acceptable only as catastrophic-failure recovery. A reviewer of the post-experiment dataset can verify the freeze instant exactly because the trigger forecloses any post-write of `frozen_at`.

**Authentication remains live.** Per SPEC.1 §12.1 the read-only mode preserves user login. F-AUTH-1 (Google OAuth) + F-AUTH-2 (Email + OTP) + F-AUTH-3 (pseudonym assignment) + F-AUTH-4 (ToS acceptance) + F-AUTH-5 (logout) all continue to operate post-freeze. The session-deferral hook from §8.3 continues to enforce the pseudonym + ToS gate; new signups that complete the four-step onboarding land valid `users` rows + `sessions` rows post-freeze. The auth surface is **not state-frozen** — only bet/comment/vote/resolution surfaces are.

The reasoning: the dataset is published Nov 6; researchers reading the dataset want to see their friends' pseudonyms; reading requires login; new signups during the Devcon 8 + ETHGlobal Mumbai window add users to `users` (Bucket C) + `identity_pool` (Bucket B with `assigned_at` whitelisted transition) + `sessions` (Bucket C) without affecting the frozen state of bets/comments/resolutions. The post-freeze new signup adds an `events.user.pseudonym_assigned` row and an `events.user.tos_accepted` row; both are observable in the audit trail; neither violates the freeze.

**Admin-side mutations remain live for the conclusion-event work.** F-ADMIN-3 (trigger resolution) + F-ADMIN-4 (moderation action) + F-ADMIN-5 (audit-log search) + F-RESOLVE-1 (resolve) + F-RESOLVE-2 (correction) + F-RESOLVE-3 (void) all continue to operate post-freeze. The admin path is structurally outside the freeze gate — admin Server Actions do NOT call `isFrozen()`. The admin can finalize resolutions, run audit exports, perform last-mile moderation cleanup post-freeze without contradicting the freeze. The admin-side audit trail (`admin_events` Bucket A) is append-only per §6.2; post-freeze admin actions append to the trail, do not retroactively alter prior rows, and the dataset release reflects the admin actions taken between freeze and Nov 6 dataset-build time.

The asymmetric live-vs-frozen posture across the three actor classes — participant (frozen), authenticated-user-but-read-only (live), admin (live) — is deliberate. Per §3.6 + §8.4 admin is structurally separate from participant; admin's post-freeze write authority is the conclusion-event work. The dataset built at 2026-11-06 reflects admin actions taken in the freeze-to-build-time window; researchers see admin resolutions in `resolution_events` regardless of when they fired.

### §20.4 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Freeze instant (2026-11-05 23:59 UTC) | §20.1 |
| `system_state` Drizzle schema | `src/db/schema/system.ts` |
| `system_state` Bucket-B trigger function | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6.3) |
| `system_state` row mint at deploy | `drizzle/migrations/<NNNN>_seed_system_state.sql` (provisional path under SCAFFOLD.2) |
| `pg_cron` Path-A scheduled freeze job | `drizzle/migrations/<NNNN>_freeze_cron.sql` (HARDEN.10 territory) |
| Path-B manual `psql` runbook | `docs/runbooks/conclusion-event-freeze.md` (HARDEN.10-owned per §21.3) |
| `isFrozen()` middleware helper | `src/server/system/is-frozen.ts` |
| CI lint enforcing `isFrozen()` presence on state-mutating handlers | HARDEN.* (per §17.7's deferred items list pattern) |
| `error_experiment_concluded` catalogue row | `docs/specs/error-codes.md` (per §15.4) |
| Read-paths-still-live posture | §3.3 R-1 / R-2 / R-3 (none of these patterns calls `isFrozen()`) |
| Auth-paths-still-live posture | §8 (none of F-AUTH-* calls `isFrozen()`) |
| Admin-paths-still-live posture | §3.6 + §8.4 (none of F-RESOLVE-* / F-ADMIN-* calls `isFrozen()`) |
| Catastrophic-failure thaw procedure | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per §21.3 + ADR-0010) |

ADRs consumed by §20: ADR-0005 (Bucket-B append-only-with-whitelisted-transition discipline backing `system_state.frozen_at`), ADR-0006 (Supabase + `pg_cron` substrate for Path A scheduled freeze), ADR-0010 (admin auth path remaining live post-freeze + `BREAK_GLASS.md` thaw procedure scope). 3-E A1 absorbs the 2026-11-05 23:59 UTC instant correction (replaces v0.2-stub's incorrect "2026-11-08" reference); 3-E §20-1 absorbs `system_state.frozen_at` Bucket B classification with NULL → timestamp transition; 3-E A8 mints the `error_experiment_concluded` HTTP 410 `error_type: gone` row in §15.4's 38-code baseline.

---

## §21 Operational Runbook Pointers

§21 owns the *runbook inventory contract* for the experiment-phase build — the twenty named runbook slots that operational responses to alarms, vendor incidents, and procedural events must populate, the per-slot file path under `docs/runbooks/`, the gating relationship to §17's alarm catalogue + §18's threat model + §20's freeze mechanism, and the deferral boundary between v1.0 lock (slot inventory locked) and HARDEN.10 implementation (substance authored). SPEC.1 §16.5 owns the *legal-floor* operational obligations (CSAM detection + reporting compliance, ToS evidence retention; NCMEC CyberTipline auto-report mechanism deferred to post-experiment per SCAFFOLD.16 LD-7) that some runbooks consume; ADR-0010 owns the *admin-rotation* procedural surface that `BREAK_GLASS.md` documents; this §21 sits at the *runbook inventory + per-slot pointer* layer, naming what runbook exists where without authoring substance.

The discipline is strict: §21 names the slot inventory + the file paths + the gating relationships; it does NOT author per-runbook procedural substance (HARDEN.10 territory), it does NOT pick on-call rotation cadence (out of scope for v1; the experiment runs sole-MM per E4 — there is no on-call rotation, only Hrishikesh at the keyboard), and it does NOT design post-incident review process (HARDEN.10's procedural runbook owns; v0.3-draft names the slot only).

The twenty slots are the v1.0 lock surface. Adding a runbook slot post-lock requires an ADR + same-commit SPEC.2 update; HARDEN.10 may freely author substance into existing slots without re-opening §21.

### §21.1 Per-alarm runbooks (10 slots)

One runbook per §17 master alarm row 1–5 + alarm-6 sub-IDs 6a–6e. Each runbook documents: the alarm's trigger condition, the operator's first-action diagnostic steps, the escalation path (Hrishikesh-only at v1, but the slot is structured for a future multi-operator rotation), the recovery procedure, and the post-recovery audit-write expectations.

| Slot | Runbook file | Backed alarm | Notes |
|---|---|---|---|
| 1 | `docs/runbooks/alarm-1-append-only-trigger-violation.md` | §17 alarm 1 (Postgres `RAISE EXCEPTION` from BEFORE UPDATE / BEFORE DELETE) | Trigger violation = handler bug per §6.4; runbook catalogues the diagnostic steps to identify the violating handler from the Sentry tag set |
| 2 | `docs/runbooks/alarm-2-default-partition-insert.md` | §17 alarm 2 (events table DEFAULT-partition write) | DEFAULT-partition write = configuration error; runbook covers the partition-set extension procedure (SQL migration + Drizzle config update) |
| 3 | `docs/runbooks/alarm-3-bet-serialization-exhausted.md` | §17 alarm 3 (40001-retry exhaustion in bet wrapper) | Retry exhaustion = high contention on the pool row; runbook covers diagnosis (check `pools` row contention, check `events` partition health) + acceptable-behavior thresholds (occasional exhaustion under load is expected; sustained exhaustion is a `pools` lock-tuning issue) |
| 4 | `docs/runbooks/alarm-4-openai-moderation-upstream-failure.md` | §17 alarm 4 (OpenAI moderation upstream failure) | Upstream failure = OpenAI outage or quota exhaustion; runbook covers fail-closed posture confirmation (no comments leaked through), Track A degrade-mode flag flip per ADR-0014 §"Track A degrade mode" |
| 5 | `docs/runbooks/alarm-5-identity-pool-low-watermark.md` | §17 alarm 5 (`identity_pool` 5%-of-pool threshold) | Pool low-watermark = signup-rate-exceeds-projection; runbook covers the asset-pipeline re-bake procedure (per ADR-0011) and the SQL migration to mint a `v2/` PFP set |
| 6a | `docs/runbooks/alarm-6a-upstash-rate-limit.md` | §17 alarm 6a (Upstash rate-limit middleware fail-open) | Upstash outage on rate-limit surface; runbook covers the fail-open posture confirmation (requests admitted, brief abuse window accepted) and Upstash status-page check |
| 6b | `docs/runbooks/alarm-6b-upstash-idempotency.md` | §17 alarm 6b (Upstash idempotency cache fail-closed) | Upstash outage on idempotency surface; runbook covers the fail-closed posture (HTTP 503 to clients, user retry pattern) and recovery confirmation |
| 6c | `docs/runbooks/alarm-6c-r2-unavailable.md` | §17 alarm 6c (R2 outage) | R2 outage; runbook covers the partial-degradation posture (text-only comments work, F-COMMENT-3 fails, edge-cached images render until cache expiry) per §12.8 |
| 6d | `docs/runbooks/alarm-6d-pg-cron-job-failure.md` | §17 alarm 6d (`pg_cron` job-run terminal failure) | `pg_cron` job failure surfaced via `cron.job_run_details` meta-query; runbook covers the per-job (events partition monitor, `identity_pool` low-watermark, `markets`-state drift) diagnostic steps |
| 6e | `docs/runbooks/alarm-6e-vercel-cron-handler-5xx.md` | §17 alarm 6e (Vercel Cron R2-orphan-sweep handler 5xx) | Vercel Cron handler failure on the R2-orphan-sweep route; runbook covers manual-sweep procedure if Vercel Cron job fails sustainedly + R2 storage-cost spike threshold check |

### §21.2 Per-vendor incident runbooks (5 slots)

One runbook per externally-dependent vendor in the v1 stack. Each runbook documents: the vendor's status-page URL, the v1 codebase's known degradation envelope under that vendor's outage (cross-referencing §17.5 fail-open / §10 fail-closed / §11 fail-closed / §12.8 partial-degradation postures), and the operator's user-facing-communication template (banner copy, status-page update text).

| Slot | Runbook file | Vendor | Failure-mode posture |
|---|---|---|---|
| 1 | `docs/runbooks/vendor-supabase.md` | Supabase | Postgres + Supavisor pooler + storage backups all on Supabase; full outage = full experiment outage (no graceful degradation possible — Postgres is the source of truth for every read and write); SPEC.1 §16.4's audit log is structurally on Supabase |
| 2 | `docs/runbooks/vendor-vercel.md` | Vercel | Hosting + Edge runtime + Cron + runtime logs; Vercel-only outage = full read/write surface unreachable; mitigation: status-page update + queue-and-replay user expectations (no work to replay — sole-MM model means no participant-side retry-on-recovery is meaningful) |
| 3 | `docs/runbooks/vendor-cloudflare-r2.md` | Cloudflare R2 | R2 outage per §12.8 — partial degradation; F-COMMENT-3 fails, F-COMMENT-1/2 text-only succeed, edge-cached images render until cache expiry, new signups blocked at F-AUTH-3 PFP-render step |
| 4 | `docs/runbooks/vendor-resend.md` | Resend | Email-OTP delivery vendor; F-AUTH-2 OTP send fails on Resend outage; F-AUTH-1 (Google OAuth) continues to operate as the alternate signup path |
| 5 | `docs/runbooks/vendor-openai.md` | OpenAI | Pre-commit moderation upstream per ADR-0014; OpenAI outage = full state-mutation halt on bet/comment surfaces (fail-closed posture per §10); Track A degrade-mode flag flip per ADR-0014 is the operator-controlled mitigation |

The five slots cover the v1 critical-path vendors. Cloudflare Turnstile is implicitly covered under `vendor-cloudflare-r2.md` (Cloudflare-side outages are commonly correlated across products); Upstash is covered under §21.1 alarm-6a + 6b runbooks (Upstash outage = alarm fires; the runbook covers the alarm response which is the vendor response). Anthropic / Claude Code is operator-side tooling; not v1 vendor.

### §21.3 Procedural runbooks (5 slots)

Operational runbooks that are NOT alarm-fired and NOT vendor-incident-fired. Each documents a deliberate procedure with a clear trigger event.

| Slot | Runbook file | Trigger | Notes |
|---|---|---|---|
| 1 | `docs/runbooks/BREAK_GLASS.md` | Suspected admin-credential compromise OR scheduled admin-key rotation OR catastrophic-failure thaw of `system_state.frozen_at` | Owner: ADR-0010 + §8.4 + §20.3. Documents (i) sealed-envelope `ADMIN_PASSWORD` handoff procedure, (ii) routine rotation procedure (env var update + manual `DELETE FROM admin_sessions`), (iii) suspected-compromise rotation (same procedure + Cloudflare-level IP-block on prior admin source), (iv) `ALTER TABLE system_state DISABLE TRIGGER ... ; UPDATE ... ; ENABLE TRIGGER ...` thaw procedure (catastrophic-failure-only — breaks the experiment deliverable per SPEC.1 §12.4). |
| 2 | `docs/runbooks/conclusion-event-freeze.md` | 2026-11-05 23:59 UTC freeze instant | Owner: §20.2 Path-B manual fallback. Documents the manual `psql` UPDATE procedure if Path-A `pg_cron` job fails or is missed. Operator: someone with Supabase admin credentials online at 23:59 UTC; expected to be Hrishikesh at the keyboard. |
| 3 | `docs/runbooks/dataset-build-pipeline.md` | 2026-11-06 dataset release window | Owner: §19.1 + §19.2. Documents the Postgres point-in-time recovery + `pg_dump` + post-process (PII strip per §19.4 + export-time JOIN pseudonymization per §19.5) + tarball + GitHub release attach + manifest endpoint flip-from-503 procedure. Approximately one hour of operator work; the build pipeline is not automated in v1 |
| 4 | `docs/runbooks/r2-orphan-sweep-manual.md` | Sustained §21.1 alarm-6e firing OR R2 storage-cost spike | Owner: §12.6 + §12.8. Documents the manual orphan-sweep procedure if Vercel Cron sustainedly fails: direct R2-API DELETE against non-terminal `image_uploads` rows older than `<orphan_window>`, paired with the same Bucket-B trigger UPDATE per §6.3 |
| 5 | `docs/runbooks/post-incident-review-template.md` | After any §21.1 or §21.2 alarm firing that exceeded HARDEN.* alarm-tuning thresholds | Owner: HARDEN.10. Documents the post-incident review template — what was the trigger, what was the response, what was the recovery time, what should we change. v1 is sole-MM so the review is self-review (Hrishikesh writes against the template); the slot exists to give post-experiment review a structured form |

### §21.4 Single source of truth + HARDEN.10 deferral

| Concern | Source-of-truth file |
|---|---|
| Runbook slot inventory (twenty slots: 10 alarm + 5 vendor + 5 procedural) | §21.1 + §21.2 + §21.3 |
| Per-slot file path | per-slot rows above |
| Per-slot substance authoring | HARDEN.10 |
| Alarm catalogue (consumed by §21.1) | §17.2 + §17.3 |
| Threat model + sybil-defense surfaces (consumed by §21.1 + §21.2) | §18 |
| Freeze mechanism (consumed by §21.3 slot 2) | §20 |
| Dataset build pipeline (consumed by §21.3 slot 3) | §19 |
| `BREAK_GLASS.md` substance | ADR-0010 + §8.4 + §20.3 (operator's authoritative cross-reference at HARDEN.10 implementation) |
| Post-incident-review template substance | HARDEN.10 (per §21.3 slot 5) |
| On-call rotation cadence | Out of scope for v1 (sole-MM per E4) |

ADRs consumed by §21: ADR-0006 (vendor-incident runbook framing for Vercel + Cloudflare R2 + Supabase + Resend), ADR-0007 (alarm catalogue providing the §21.1 slot definitions), ADR-0010 (admin auth + `BREAK_GLASS.md` ownership for §21.3 slot 1), ADR-0011 (asset-pipeline re-bake for §21.1 alarm-5 runbook), ADR-0013 (bet wrapper retry exhaustion semantics for §21.1 alarm-3 runbook), ADR-0014 (pre-commit moderation + Track A degrade-mode flag for §21.1 alarm-4 runbook + §21.2 vendor-openai runbook), ADR-0015 (Upstash rate-limit + idempotency fail-mode postures for §21.1 alarm-6a + 6b runbooks). 3-E §21 absorption ratifies the twenty-slot inventory; HARDEN.10 owns substance.

---

## §22 ADR Index

§22 owns the *consolidated index of architectural decision records* for the experiment-phase build — the 17 ADRs at `docs/adr/0003-…md` through `docs/adr/0019-…md`, their accepted / superseded / in-flight status, the task → ADR-NNNN mapping that gates each ADR, and the cross-reference invariant that every ADR reference in SPEC.2 resolves to an existing ADR file. This §22 sits at the *index layer* — the ADRs themselves are immutable substance per ADR convention; this section catalogues their status and exposes the gating map without restating their decisions.

The inventory is **17 ADRs** (was 14 at v0.3-draft; ADR-0017/0018/0019 folded at SYNC.7). Two earlier-numbered slots (ADR-0001 + ADR-0002 — brand architecture and experiment/protocol repo split, originally minted under FOUND.7 + FOUND.8 in earlier outline drafts) were never authored as ADR files; the numbering jumps from "no ADR file" to ADR-0003. The ADR file numbering is the canonical inventory; the FOUND.7 + FOUND.8 substance lives in TRADEMARK.md + the repo structure itself, not in the ADR registry.

Of the 17 ADRs, **15 are accepted** (ADR-0003 through ADR-0008, ADR-0010 through ADR-0011, ADR-0013 through ADR-0019), **1 is superseded** (ADR-0009, by ADR-0017), and **1 is in flight** (ADR-0012). Per the §22.2 in-flight carve-out, SPEC.2 v1.0 locks with ADR-0012 in flight; design.md finalization triggers a same-commit SPEC.1 + SPEC.2 minor-version bump (v1.0 → v1.1) without re-opening PRECURSOR.4. SCAFFOLD.* tasks that do not consume design.md proceed in parallel during ADR-0012's in-flight window.

### §22.1 The 17-row index

Sorted by ADR number. Each row is one ADR file; the file at `docs/adr/<NNNN>-<slug>.md` is the canonical substance.

| ADR | SPEC.x | File | Title | Status | Accepted |
|---|---|---|---|---|---|
| **0003** | SPEC.3 | `0003-nextjs-16-app-router.md` | Next.js 16 + App Router | accepted | 2026-05-04 |
| **0004** | SPEC.4 | `0004-better-auth.md` | Better Auth on locked vendor stack | accepted | 2026-05-05 |
| **0005** | SPEC.5 | `0005-postgres-event-sourcing.md` | Postgres + event sourcing (Pattern A; Bucket A/B/C; events table shape; partitioning) | accepted | 2026-05-05 |
| **0006** | SPEC.6 | `0006-hosting.md` | Hosting topology (Vercel + Supabase + Upstash + Cloudflare R2, Mumbai single-region, `pg_cron` + Vercel Cron hybrid) | accepted | 2026-05-05 |
| **0007** | SPEC.7 | `0007-observability.md` | Observability (Sentry + PostHog; Vercel runtime logs serve structured request logging) | accepted | 2026-05-05 |
| **0008** | SPEC.9 | `0008-drizzle-orm.md` | ORM choice (Drizzle + drizzle-kit + drizzle-zod; per-domain schema-file split; raw-SQL migration discipline) | accepted | 2026-05-06 |
| **0009** | SPEC.10 | `0009-ranking-function.md` | Ranking function lock (single-function HN model) — **superseded by ADR-0017** (multi-mode ranking; reply-as-bet; `stake_at_post_time` + friendly-fire retired) | superseded | 2026-05-06 |
| **0010** | SPEC.11 | `0010-admin-auth.md` | Admin auth wiring (static password env var; hand-rolled DELETE+INSERT; two-layer middleware-plus-validator per CVE-2025-29927; `BREAK_GLASS.md` rotation) | accepted | 2026-05-06 |
| **0011** | SPEC.12 | `0011-pseudonym-pool-design.md` | Pseudonym pool design (PSEUDONYM.md; 50K-row pre-baked pool; static `zugzwang-pfp` bucket; FIFO consumption with `SELECT ... FOR UPDATE SKIP LOCKED`) | accepted | 2026-05-07 |
| **0012** | SPEC.13 | *(file pending)* | Design system lock (design.md) | **in flight** | — |
| **0013** | SPEC.14 | `0013-concurrency-bet-transaction.md` | Concurrency + bet transaction (SERIALIZABLE + `FOR NO KEY UPDATE` pool lock; canonical lock order; full-jitter retry on 40001/40P01) | accepted | 2026-05-07 |
| **0014** | SPEC.15 | `0014-pre-commit-moderation-flow.md` | Pre-commit moderation flow (omni-moderation + PhotoDNA; fail-closed posture; F-MOD-4 atomicity; Track A degrade mode flag) | accepted | 2026-05-07 |
| **0015** | SPEC.16 | `0015-rate-limit-idempotency.md` | Rate-limit + idempotency (Upstash Redis sliding windows; SETNX-with-pending-sentinel; Stripe-style key envelope; asymmetric fail-open/closed posture) | accepted | 2026-05-07 |
| **0016** | SPEC.17 | `0016-id-schema-uuidv7.md` | ID schema (UUIDv7 universal PK; PG 17 userspace fallback + PG 18 cutover path; URL-exposure rule per D6) | accepted | 2026-05-08 |
| **0017** | SYNC.4 | `0017-ranking-modes-and-top-composite.md` | Ranking modes & the "Top" composite (RANKING.md) — **supersedes ADR-0009**; multi-lane Top default + single-axis filter modes + reply stake-order at depth-1 | accepted | 2026-06-01 |
| **0018** | SYNC.5 | `0018-dharma-issuance-and-bet-floors.md` | Dharma issuance, daily credit & asymmetric two-floor minimum bet (reply floor 50 > post floor; equal grant; flat daily credit) | accepted | 2026-06-01 |
| **0019** | SYNC.5 | `0019-rls-out-of-scope-experiment.md` | RLS out of scope for the experiment (server-only Architecture 2; build skipped, decision recorded; tripwire; testnet revisit) | accepted | 2026-06-01 |

The **task → ADR-NNNN mapping** is canonical: ADR-0003 through ADR-0016 were each minted under a corresponding SPEC.x tracker task (SPEC.3 minted ADR-0003, SPEC.4 minted ADR-0004, etc.). Per memory + tracker conventions: SPEC.8 is renamed to **PRECURSOR.4** (the fresh-session lock review) and does not have an ADR; the SPEC.8 numbering slot is intentionally skipped in the SPEC.x sequence — ADR-0008 is SPEC.9 (ORM), not SPEC.8. **ADR-0017/0018/0019 break the SPEC.x pattern**: they were minted under SYNC tasks (ADR-0017 under SYNC.4; ADR-0018/0019 under SYNC.5), not SPEC.x tasks — the "SPEC.x" column carries the SYNC task for these three. The ADR-NNNN numbering remains dense (no gaps).

### §22.2 ADR-0012 in-flight carve-out

ADR-0012 (Design system lock — design.md) is the only ADR in flight at SPEC.2 v1.0 lock. The in-flight window covers the design.md authoring + ADR-0012 minute-of-decision flow; substantive work is outside the v1.0 lock review.

**Three properties of the carve-out:**

1. **SPEC.2 v1.0 locks with ADR-0012 in flight.** PRECURSOR.4's lock review accepts the in-flight status as a recorded condition; not a blocker. The §22.1 row carries `in flight` + blank acceptance date faithfully; the §0.1 change-log row at v1.0 lock names ADR-0012 explicitly as the single in-flight exception.
2. **Design.md acceptance triggers a minor-version bump.** Once ADR-0012 accepts, SPEC.1 + SPEC.2 update in the same commit as the ADR file mint (per ADR convention from §0). The version bump is **v1.0 → v1.1** (or whatever minor cadence is current at acceptance time); no fresh-session PRECURSOR.4 review re-opens. The cadence is the regular minor-version-bump path locked in §0.
3. **SCAFFOLD.\* parallel-execution clearance.** SCAFFOLD.* tasks that do NOT consume design.md substance proceed in parallel during ADR-0012's in-flight window. SCAFFOLD.* tasks that consume design.md (UI.* surfaces, participant-facing pages, leaderboard rendering, debate-view styling) gate on ADR-0012 acceptance per §23's bidirectional trace. The split is operational, not architectural — the codebase scaffolds without design.md, then the design system layers on once ADR-0012 lands.

The carve-out is not a precedent. Future in-flight ADRs at v1.0 lock require the same explicit treatment in §22 + the §0.1 change-log row. The default at lock review is "all consumed ADRs accepted"; ADR-0012 is the named exception with named compensating cadence.

### §22.3 Cross-reference invariant

Every `ADR-NNNN` reference anywhere in SPEC.2 (prose body, tables, single-source-of-truth maps, deferral lists) MUST resolve to an existing ADR file at `docs/adr/<NNNN>-<slug>.md` — except ADR-0012 references during its in-flight window, which resolve to "ADR-0012 (in flight per §22.2)" as a sentinel.

**Direction A: SPEC.2 → ADR.** Every `ADR-NNNN` citation in SPEC.2 resolves to (i) an accepted ADR file, or (ii) the ADR-0012 in-flight sentinel. The CI lint at HARDEN-phase walks SPEC.2 prose + tables + every section's "ADRs consumed by §N" footer and asserts each reference resolves; an unresolved reference is a build error.

**Direction B: ADR → SPEC.2.** Every accepted ADR SHOULD be cited in at least one SPEC.2 section. The asymmetric SHOULD vs MUST is deliberate — an ADR that no SPEC.2 section currently cites is acceptable as a "standalone substance" ADR (e.g., **ADR-0017's** RANKING.md content is consumed at compute-time by the ranking function, not via direct SPEC.2 prose citation; ADR-0009 is superseded by ADR-0017 and retained only for lineage). HARDEN-phase flags but does not fail.

The CI lint is HARDEN.* territory; v1.0 lock names the invariant.

### §22.4 ADR conventions (per ADR convention from §0)

Three properties locked at the ADR file shape:

1. **Immutable substance.** ADRs are immutable once accepted; superseding requires a new ADR with a `Superseded-by` link to the new file. SPEC.2 sections may consume an ADR without ratifying — substance changes ride the ADR mint cadence.
2. **Same-commit SPEC.2 update.** ADR acceptance + the same-commit SPEC.2 update at the relevant section is the canonical bundle. Per §0's lock-gate framing — PRECURSOR.4 reviews the bundle, not the ADR alone.
3. **Numbering is dense + gapless.** No ADR slot is reserved; numbering increments by 1 with each new ADR file mint. An **in-flight slot counts as filled, not as a gap** — ADR-0012 (design.md) remains in flight while higher-numbered ADRs (0013–0019) are accepted, and the sequence stays gapless because 0012 is a real, numbered slot awaiting ratification rather than a skipped number. *(Earlier wording here prohibited minting ADR-0017 while ADR-0012 was in flight; that conflated "in-flight" with "gap" and is superseded — ADR-0017/0018/0019 were minted under SYNC.4/SYNC.5 and the numbering remains dense.)*

### §22.5 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Per-ADR substance | `docs/adr/<NNNN>-<slug>.md` (17 files; 15 accepted + 1 superseded + 1 in flight; files committed at SYNC.BACKFILL) |
| ADR file template | `docs/adr/_template.md` |
| Index + status flips | §22.1 (this section) |
| In-flight carve-out | §22.2 (this section) |
| Cross-reference invariant | §22.3 (HARDEN.* CI lint) |
| ADR-NNNN reference resolver (HARDEN-phase) | HARDEN.* |
| Tracker task gating map | §23 |
| Minor-version bump cadence on ADR acceptance | §0 + §0.1 |

---

## §23 Tracker Task Gating Map

§23 owns the *bidirectional gating trace* between tracker tasks and SPEC.2 sections + ADRs + F-* flow files for the experiment-phase build — Direction A maps each tracker phase to the SPEC.2 sections + ADRs + F-* files that gate its tasks; Direction B maps each SPEC.2 section to the tracker tasks that unblock when the section locks. The trace is the load-bearing PRECURSOR.4 review surface — coverage gaps surface here before they land as blocked downstream tasks. SPEC.1 owns the *product-level* tracker cadence; the tracker HTML at `tracker_v11.html` is the *operational* Kanban surface; this §23 sits at the *gating-relationship contract* layer, naming what blocks what and what unblocks what.

The discipline is strict: §23 names the gating relationships at phase grain (Direction A) and section grain (Direction B); it does NOT enumerate every task's status (the tracker HTML owns), it does NOT decide implementation priority within a phase (the tracker's per-phase ordering owns), and it does NOT track day-to-day progress (the tracker's status field owns).

The §23 trace has **two cross-section commitments**:

1. **PRECURSOR.4 lock-review surface.** PRECURSOR.4's review walks every SPEC.2 section's "feeds" column in Direction B and verifies every cited tracker task is properly gated; coverage gaps (a section that no task consumes; a task that no section feeds) surface as review findings.
2. **ADR-0012 in-flight gate (per §22.2).** Tasks consuming design.md substance gate on ADR-0012 acceptance; tasks not consuming design.md proceed in parallel during the in-flight window. The §23.1 phase tables surface the design-dependency split per phase.

### §23.1 Direction A — Phase to SPEC.2 sections + ADRs + F-* files

Tracker organized in the build-to-launch phases (per the tracker's grouping). Each phase row names the SPEC.2 sections + ADRs + F-* files its tasks consume. The "design.md gate" column flags whether ADR-0012 acceptance gates any task in the phase.

| Phase | Tasks | SPEC.2 sections consumed | ADRs consumed | F-* files gated | Design.md gate |
|---|---|---|---|---|---|
| **FOUND** | FOUND.1–8 | §0 | none | none | No |
| **SPEC + PRECURSOR** | SPEC.1–2 + SPEC.3–7 + SPEC.9–17 + PRECURSOR.1–4 (SPEC.8 → PRECURSOR.4; PRECURSOR.5 dissolved into SYNC.8) | §0–§23 (this phase authors them) | ADR-0003–0016 (minted here; 0017/0018/0019 minted under SYNC — §22.1) | none | No (PRECURSOR.4 lock review accepts ADR-0012 in-flight per §22.2) |
| **SCAFFOLD** | SCAFFOLD.1–19 | §0–§23 (consumes locked v1.0 substance) | ADR-0003 + 0005 + 0006 + 0008 + 0011 + 0016; ADR-0012 for design-dependent slots only | F-* skeleton mint at SCAFFOLD.2 (set per §13.3); F-AUTH-* substance at SCAFFOLD.3; F-MOD bundle at SCAFFOLD.16; image-upload pipeline at SCAFFOLD.15; flag system at SCAFFOLD.6 | Partial — design-independent SCAFFOLD tasks proceed in parallel; UI-shaping slots gate on ADR-0012 |
| **SYNC** (doc/repo reconciliation; closed pre-lock) | SYNC.0–10 (incl. SYNC.3.5 / SYNC.8.5 / SYNC.BACKFILL) | §0–§23 (the SYNC.7 rebuild re-authored SPEC.1/SPEC.2; reconciles, does not gate new substance) | mints ADR-0017 (SYNC.4) + ADR-0018/0019 (SYNC.5); ADR-0009 superseded | none | No |
| **ENGINE** | ENGINE.0 + ENGINE.2–12 (ENGINE.1 → ENGINE.0) | §3 + §6 + §7 + §9 + §11 + §14 + §15 | ADR-0005 + 0008 + 0013 + 0014 + 0015 + 0016 | F-BET-1/2/3/4/5/6/7/9/10 at ENGINE.7–8; F-RESOLVE-1/2/3 + F-DEBATE-3 at ENGINE.9 | No |
| **DEBATE** | DEBATE.1–5 + DEBATE.7–9 (DEBATE.6 removed — friendly-fire vote retired under reply-as-bet; see §23.3) | §3 + §8 + §9 + §10 + §11 + §13 + §14 + §15 | ADR-0004 + 0014 + 0015 + 0017 + 0018 | F-COMMENT-1/2/3 at DEBATE.2; F-DEBATE-1/4 at DEBATE.4; F-DEBATE-2 at DEBATE.5; F-MOD-1/2/3/4/5 at DEBATE.7; DEBATE.9 drops vestigial `friendly_fire_events` | Yes — DEBATE.4/5 consume design.md |
| **VISUAL** (DESIGN ∥ ENGINE · UI ∥ DEBATE) | DESIGN.1–8 + UI.1–8/10–18 (UI.9 absent) | §4 + §13 + §17 + §18 | ADR-0003 + 0004 + 0010 + ADR-0012 (DESIGN.8 derives ADR-0012) | F-AUTH-* user-facing pages; F-ADMIN-1/2/3/4/5 at UI.6; debate-view + market-detail UIs | Yes (load-bearing) — UI sub-lane consumes design.md; DESIGN sub-lane authors it |
| **TESTING** (∥ HARDEN; against live staging) | TESTING.1–17 | §3 + §6 + §9 + §13 + §14 + §17 | ADR-0013 + 0015 (+ 0005/0008 for journey/integration tests) | exercises the F-* Acceptance blocks via E2E/integration specs (set per §13.3) | Partial — UI-surface E2E (TESTING.4/5) gates on the design-consuming UI; engine/concurrency/integration tests are design-independent |
| **HARDEN** (experiment-grade; lightweight; ∥ TESTING) | HARDEN.1–6 | §9 + §10 + §11 + §17 + §18 (the §19/§20/§21 dataset/freeze/runbook consumers moved to the post-launch tracker) | ADR-0007 + 0010 + 0014 + 0015 | F-* Acceptance-block cross-reference CI lint (HARDEN-phase; set per §13.3) | No / Partial — HARDEN.1–6 are design-independent |
| **LAUNCH** (terminal) | LAUNCH.1–8 | §0 + §17 + §19 + §20 + §22 | ADR-0003 + 0006 | dataset manifest endpoint (F-DATASET-1 status re-homed to MAINT.15) | No |

DEBATE and VISUAL are the design-gated phases (TESTING is partially gated, on the design-consuming UI surfaces); all other phases are design-independent or only partially / non-blocking. Per-phase task census and the running total are the tracker's to own (`tracker_v11.html`, §23.4) — §23.1 names the gating *relationships*, not the count. **LIVE (experiment window) and CONCLUDE (freeze + dataset + Devcon) are not phases of this build-to-launch tracker — they continue in a separate post-launch tracker per SYNC.6; their absence here is intentional, not lost.**

The **SCAFFOLD-phase parallel-execution clearance** (per §22.2 third property) is the operational unblock: SCAFFOLD.1 + SCAFFOLD.2 + SCAFFOLD.3 + SCAFFOLD.4 + SCAFFOLD.5 + SCAFFOLD.6 + SCAFFOLD.13 + SCAFFOLD.15 + SCAFFOLD.16 + SCAFFOLD.17 + SCAFFOLD.18 + SCAFFOLD.19 (12 of 19 SCAFFOLD tasks) are design-independent and proceed in parallel during ADR-0012's in-flight window. The remaining 7 SCAFFOLD tasks (UI-shaping work) gate on ADR-0012.

### §23.2 Direction B — SPEC.2 section to consuming tracker tasks

Each SPEC.2 section row names which tracker tasks unblock when the section reaches v1.0 lock — i.e., the tasks whose deliverables consume the section's substance and cannot proceed until the section is locked. PRECURSOR.4's lock review walks this column to verify coverage.

| Section | Title | Unblocks (key tasks) |
|---|---|---|
| **§0** | Document metadata + change log | All downstream tasks (provides versioning policy + lock-gate framing for change-log audit trail) |
| **§3** | Data flows | ENGINE.7 (bet wrapper), ENGINE.8 (bet handlers), ENGINE.9 (resolution), DEBATE.2 (comment-bearing-bet write), SCAFFOLD.3 (auth flows) |
| **§4** | API surface | UI.* (Server Actions consumed by every UI page); SCAFFOLD.2 (Route Handler skeleton mint) |
| **§5** | Data model — table inventory | SCAFFOLD.2 (Drizzle schemas across ten domains); HARDEN.* CI lint for table inventory drift |
| **§6** | Append-only enforcement | SCAFFOLD.2 (trigger SQL migration); TESTING.* (append-only test-floor coverage) |
| **§7** | Event model | ENGINE.7/ENGINE.8/ENGINE.9 (events insert at every state mutation); SCAFFOLD.2 (events partitioning DDL); HARDEN.* (events-emit CI lint) |
| **§8** | Authentication & sessions | SCAFFOLD.3 (Better Auth wiring); UI.* (auth-gated pages); ENGINE.* (auth gate on every state-mutating endpoint) |
| **§9** | Concurrency & transactions | ENGINE.7 (bet transaction wrapper); TESTING.15 (concurrency/race tests) + ENGINE.10 (full-invariant stress test) |
| **§10** | Pre-commit moderation | SCAFFOLD.16 (moderation vendor onboarding); DEBATE.7 (F-MOD-* wiring); HARDEN.5 (moderation-threshold tuning, part of the number-tuning pass) |
| **§11** | Rate-limit + idempotency | SCAFFOLD.4 (Upstash rate-limit + idempotency wiring); ENGINE.* + DEBATE.* (handler stack); HARDEN.3 (threshold verification) + HARDEN.5 (numeric tuning) |
| **§12** | File storage | SCAFFOLD.15 (R2 + signed URLs + orphan sweep); VISUAL/UI.* (image-upload affordances); HARDEN.4 (R2-orphan operational check, part of the ops checklist) |
| **§13** | Flow contract template | SCAFFOLD.2 (skeleton mint of the F-* flow set, count per §13.3); every gating implementation task (per §13.4 cadence) |
| **§14** | Invariant contract | ENGINE.7 + DEBATE.2 + ENGINE.9 + SCAFFOLD.2 (canonical integration tests); HARDEN.* (per-mechanism unit tests + cross-reference CI lint) |
| **§15** | Error code envelope | All gating implementation tasks (every Errors block consumes catalogue); HARDEN.* (cross-reference CI lint) |
| **§16** | URL slug + identity schema | SCAFFOLD.2 (UUIDv7 function migration); SCAFFOLD.* (Better Auth column-type override); HARDEN.* (raw-UUID-not-in-participant-URLs acceptance test) |
| **§17** | Observability | SCAFFOLD.5 + SCAFFOLD.6 + SCAFFOLD.7 (Sentry / PostHog+flags / structured logging); HARDEN.4 (observability ops checklist); the full per-alarm runbook set is post-launch (separate tracker) |
| **§18** | Sybil & security | SCAFFOLD.3 (Turnstile wiring); HARDEN.1 (sybil spot-check); HARDEN.4 (`BREAK_GLASS` note + secrets/CSRF hygiene, ops checklist) |
| **§19** | Public dataset export | dataset manifest endpoint (F-DATASET-1; mint-or-strike re-homed to MAINT.15); the dataset build + release is post-launch (separate tracker) |
| **§20** | Conclusion-event freeze | SCAFFOLD.2 (`system_state` schema + freeze trigger SQL); the freeze itself + freeze runbook are post-launch (separate tracker) |
| **§21** | Operational runbook pointers | HARDEN.4 (experiment-grade ops checklist + break-glass note); the full operational runbook set is post-launch (separate tracker) |
| **§22** | ADR index | All gating implementation tasks (every section's "ADRs consumed by §N" footer cross-references this index); PRECURSOR.4 lock review |
| **§23** | Tracker task gating map | PRECURSOR.4 lock review (the §23 trace IS the review surface); subsequent re-verification at each tracker sweep / gate change |

**Coverage observation:** every SPEC.2 section has at least one consuming tracker task. The strongest fan-out sections are §0 (consumed by all phases via versioning), §13 (consumed by every gating implementation task per per-flow cadence), §15 (consumed by every gating implementation task per Errors-block contract), and §22 (consumed by every section's ADR-cite footer). The narrowest fan-out is §22.2's in-flight carve-out — consumed by PRECURSOR.4 + the design.md ADR mint cadence only.

### §23.3 Tracker reconciliation — resolved items + carry-forwards

The PRECURSOR.4 lock review and this tracker sweep close the §23.3 drifts the SYNC.7 fold surfaced. Routing that pointed at "SYNC.8" is moot (SYNC closed before the lock).

**Resolved.**
- The four 3-C tracker-description drifts (DEBATE.4, SCAFFOLD.3, SCAFFOLD.13, SCAFFOLD.4) — the v11 tracker rebuild (SYNC.6) already carries descriptions consistent with current SPEC.1 + SPEC.2 substance.
- DEBATE.6 — removed from the v11 tracker (its friendly-fire scope was retired under reply-as-bet); DEBATE.9 (drop vestigial `friendly_fire_events`) stands in its place.
- ADR-0017 body text ("friendly-fire stays display-only") — reconciled by the in-place P1 patch record (PR #65, PRECURSOR.4 lock review).

**Carry-forwards (specs-ahead-of-code; tracker-sequenced engineering, not this pass).** The v1.0 schema still carries artifacts the specs now omit; the drops are sequenced work:

| Item | Drop / change | Tracker home |
|---|---|---|
| `friendly_fire_events` table + Bucket-B trigger + `castFriendlyFire`/`clearFriendlyFire` Server Actions | forward migration drops table + trigger; delete the two Server Actions | DEBATE.9 |
| `comments.bet_id` nullable → NOT NULL; standalone comment-without-bet path → bet-borne | schema migration (after cutover) + comment-write-path rework | DEBATE.2 / DEBATE.8 |
| `comments.stake_at_post_time` | forward column-drop migration | DEBATE.8 |
| §13.3 F-* inventory reconciliation — prose↔table↔disk (40 on disk / "37" prose / 36 table), `F-MOD-3` in/out, `F-DATASET-1` mint-or-strike, delete `F-COMMENT-6/7/8.md` | doc + flow-file truth-up, sequenced with DEBATE.9's friendly-fire teardown | MAINT.15 |
| Spec-wide HARDEN task-ID renumber — ~30 refs across §8.10, §10, §11, §12, §17, §18, §19, §20, §21 + Appendix A still use the v7 HARDEN numbering (HARDEN.7/.10 are phantom in v11; "number-tuning" is HARDEN.5 not .6; runbook ownership is the post-launch tracker + HARDEN.4 experiment-grade subset). §23.2 above states the canonical v11 mapping; the rest of the spec lags. | propagate the §23.2 mapping spec-wide + resolve §21's "20-slot runbook inventory is the v1.0 lock surface" framing against the post-launch relocation | MAINT.16 |

### §23.4 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Phase-bucketed Direction A trace | §23.1 (this section) |
| Per-section Direction B trace | §23.2 (this section) |
| Tracker reconciliation — resolved items + carry-forwards | §23.3 |
| Per-task status (not_started / in_progress / blocked / done) | `tracker_v11.html` (canonical per SYNC.6; v10 deleted) |
| Per-task ordering within phase | tracker HTML (`tracker_v11.html`) |
| Per-flow contract files (consumed by Direction A's "F-* files gated" column) | `docs/specs/flows/F-*.md` (per §13) |
| Per-section "ADRs consumed by §N" footers (consumed by Direction A's "ADRs consumed" column) | each SPEC.2 section's closing footer |
| ADR-0012 in-flight carve-out (referenced by Direction A's "design.md gate" column) | §22.2 |
| PRECURSOR.4 lock-review walking discipline | §0 + §22.4 + this section |

ADRs consumed by §23: ADR-0001 + ADR-0002 (out of inventory per §22.1 — no ADR file; substance lives in TRADEMARK.md + repo structure); ADR-0003 through ADR-0019 in their phase-distributed gating relationships per §23.1 (ADR-0017/0018 consumed by the DEBATE row; 0017/0018/0019 minted under SYNC).

---

## Appendix A — Single-Source-of-Truth File Map (consolidated)

Mechanical aggregation of every "Single source of truth" footer across §3 through §21. Sorted alphabetically by file path. Each row names every section that cites the file as a single source of truth. This appendix is the **consolidated index** that downstream tooling (HARDEN.* CI lint walking the file map; per-file ownership audit during code review; the migration set's manifest cross-reference) consumes — every minted file should have at least one SoT row here, and every row should resolve to either an existing file or a HARDEN.*-territory deferred file.

The discipline: this appendix is **mechanically derived** from per-section footers and is canonical at this v0.3-draft snapshot. A file added to or removed from any per-section footer at PRECURSOR.4 lock updates this appendix in the same commit. Drift between per-section footers and Appendix A is a build error per HARDEN.* CI lint.

Files are grouped into seven categories for readability: **A.1** Drizzle schema files; **A.2** Drizzle migration files; **A.3** Server-domain logic; **A.4** Route Handlers + Server Actions; **A.5** Configuration + middleware; **A.6** Test surfaces; **A.7** Documentation + runbooks.

### A.1 Drizzle schema files (per-domain split, `src/db/schema/`)

| File | Purpose | SoT cited by |
|---|---|---|
| `src/db/schema/index.ts` | Barrel re-export of all per-domain schemas | §5.5 |
| `src/db/schema/auth.ts` | Better Auth four-table schemas (`users`, `sessions`, `accounts`, `verifications`) + hand-rolled `admin_sessions` (per ADR-0008 §4 — single auth-domain file spanning ADR-0004 + ADR-0010) | §5.5, §8.10, §16 |
| `src/db/schema/markets.ts` | `markets`, `pools` schemas | §5.5 |
| `src/db/schema/bets.ts` | `bets`, `positions` schemas | §5.5 |
| `src/db/schema/comments.ts` | `comments` schema (reply-as-bet: `bet_id` NOT NULL 1:1 with the comment-bearing bet, `parent_comment_id` post/reply discriminator, `side_at_post_time`; no `stake_at_post_time`, no `friendly_fire_events`) | §5.1, §5.5 |
| `src/db/schema/dharma.ts` | `dharma_ledger` schema | §5.5 |
| `src/db/schema/events.ts` | `events`, `resolution_events`, `payout_events` schemas | §5.5, §7.8 |
| `src/db/schema/identity.ts` | `identity_pool` schema (per ADR-0011 + ADR-0016 D5 synthetic UUIDv7 PK + UNIQUE constraint) | §5.5 |
| `src/db/schema/image-uploads.ts` | `image_uploads` schema (Bucket B per §12.5 + ADR-0014) | §5.5, §12.10 |
| `src/db/schema/audit.ts` | `mod_actions`, `admin_events`, `user_events` schemas | §5.5 |
| `src/db/schema/system.ts` | `system_state` schema (single-row sentinel per §20.2) | §5.5, §20.4 |

### A.2 Drizzle migration files (`drizzle/migrations/`, `drizzle.config.ts`)

| File | Purpose | SoT cited by |
|---|---|---|
| `drizzle.config.ts` | Drizzle migration set + schema barrel pointer | §5.5 |
| `drizzle/migrations/<NNNN>_uuidv7_function.sql` | PL/pgSQL `public.uuidv7()` function (PG 17 fallback per ADR-0016) | §5.5, §16 |
| `drizzle/migrations/<NNNN>_append_only_triggers.sql` | Bucket-A + Bucket-B per-table trigger functions + trigger declarations (12 protected tables) | §5.5, §6.7, §12.10, §14.4, §18.5, §20.4 |
| `drizzle/migrations/<NNNN>_events_partitioning.sql` | Events table monthly RANGE partition DDL + DEFAULT partition | §5.5, §7.8 |
| `drizzle/migrations/<NNNN>_seed_system_state.sql` | `system_state` row mint at deploy (`INSERT ('system', NULL)`) per §20.2 — provisional path under SCAFFOLD.2 | §20.4 |
| `drizzle/migrations/<NNNN>_freeze_cron.sql` | Path-A `pg_cron` scheduled freeze job at 2026-11-05 23:59:00 UTC (HARDEN.10 territory) | §20.4 |
| `drizzle/migrations/<NNNN>_pg_cron_job_failure_alarm.sql` | `pg_cron` `job_run_details` meta-query for §17 alarm 6d | §17.8 |

### A.3 Server-domain logic (`src/server/`)

| File | Purpose | SoT cited by |
|---|---|---|
| `src/server/auth/index.ts` | Better Auth instance + plugins + databaseHooks + cookie config + UUIDv7 generateId override | §3.7, §8.10, §16 |
| `src/server/auth/email-otp.ts` | Resend `sendVerificationOTP` callback body | §8.10 |
| `src/server/auth/session-gate.ts` | Session-deferral hook (pseudonym + ToS gate per §8.3) — re-exported into `index.ts` | §8.10, §14.4, §18.5 |
| `src/server/auth/turnstile.ts` | Cloudflare Turnstile siteverify wiring per ADR-0004 + §8.2 | §18.5 |
| `src/server/auth/admin/login.ts` | Admin login Server Action (5-step sequence per §8.4) | §8.10 |
| `src/server/auth/admin/logout.ts` | Admin logout Server Action | §8.10 |
| `src/server/auth/admin/validate.ts` | Admin session validator (Layer 2 security boundary per CVE-2025-29927) | §8.10 |
| `src/server/auth/logout.ts` | Participant logout Server Action | §8.10 |
| `src/server/auth/tos/accept.ts` | F-AUTH-3 + F-AUTH-4 transactional sequence (pseudonym assignment + ToS acceptance evidence write) | §4.2, §18.5 |
| `src/server/auth/otp/submit.ts` | F-AUTH-2 OTP submit Server Action | §4.2 |
| `src/server/bets/transaction.ts` | W-1 SERIALIZABLE transaction wrapper (bet handler per ADR-0013 + §9) | §3.7, §9, §14.4 |
| `src/server/bets/place.ts` | Bet place handler (INV-2 pre-flight balance check) | §14.4 |
| `src/server/bets/origin-check.ts` | Bet-handler Origin allowlist (D3 carve-out CSRF defense per §4.3) | §4 |
| `src/server/comments/place.ts` | `placeDirectComment` (F-COMMENT-1) — comment-bearing post-bet Server Action; opens the §9 W-1 bet transaction (`src/server/bets/transaction.ts`), inserting the paired `bets` + `comments` rows; INV-3 `side_at_post_time` bound from the bet's side inside that transaction | §3.7, §4.2, §14.4 |
| `src/server/comments/reply.ts` | `placeReply` (F-COMMENT-2) — comment-bearing reply-bet Server Action (W-1; `parent_comment_id` set, reply floor 50 per ADR-0018) | §4.2 |
| `src/server/comments/place-image.ts` | `placeImageComment` (F-COMMENT-3) — image-attached comment-bearing bet Server Action (W-1) | §4.2 |
| `src/server/resolution/settle.ts` | W-3 resolution fan-out wrapper (F-RESOLVE-1 settle) | §3.7, §14.4 |
| `src/server/resolution/correct.ts` | F-RESOLVE-2 correction Server Action | §4.2 |
| `src/server/resolution/void.ts` | F-RESOLVE-3 void Server Action | §4.2 |
| `src/server/admin/markets/create.ts` | F-ADMIN-1 create market Server Action | §4.2 |
| `src/server/admin/markets/seed.ts` | F-ADMIN-2 seed pool Server Action | §4.2 |
| `src/server/admin/markets/trigger-resolution.ts` | F-ADMIN-3 trigger resolution Server Action | §4.2 |
| `src/server/admin/moderation/act.ts` | F-ADMIN-4 moderation action Server Action | §4.2 |
| `src/server/events/insert.ts` | Events insertion helper `insertEvent(tx, eventInput)` (bound-transaction-only; Zod-validates payload) | §3.7, §7.8, §16 |
| `src/server/events/schemas.ts` | Per-event-type Zod schema map (hand-written, not drizzle-zod) | §7.8 |
| `src/server/identity/assign.ts` | Pseudonym pool consumer (F-AUTH-3 transaction with `SELECT ... FOR UPDATE SKIP LOCKED`) | §3.7 |
| `src/server/moderation/precommit.ts` | `precommitModerate()` orchestration (OpenAI omni-moderation + Redis intent reservation) | §10 |
| `src/server/moderation/openai.ts` | OpenAI moderation HTTP wrapper | §10 |
| `src/server/middleware/rate-limit.ts` | Per-surface `Ratelimit` instances + fail-open posture + alarm-6a emission | §11 |
| `src/server/idempotency/cache.ts` | `idempotencyLookupOrReserve` helper + body-fingerprint computation + fail-closed posture + alarm-6b emission | §11 |
| `src/server/idempotency/types.ts` | Constants (`Idempotency-Key` header name, validation regex, `PENDING_TTL_SECONDS = 30`, `COMPLETED_TTL_SECONDS = 86400`) + error-envelope codes | §11 |
| `src/server/storage/r2.ts` | R2 client wrapper (S3-compatible SDK + R2 endpoint config) | §12.10 |
| `src/server/storage/sign-upload.ts` | Server logic for sign-URL mint + `image_uploads` insert | §12.10 |
| `src/server/storage/sign-read.ts` | Signed-READ URL helper (consumed by §10 moderation) | §12.10 |
| `src/server/system/is-frozen.ts` | `isFrozen()` middleware helper (handler-stack step 1 freeze gate per §20.2) | §20.4 |
| `src/server/flags/use-flag.ts` | PostHog `useFlag()` runtime contract (local-evaluation, fail-open per §17.4) | §17.8 |
| `src/server/observability/sentry.server.ts` | Sentry SDK initialization (server-side) | §17.8 |
| `src/server/observability/posthog.server.ts` | PostHog SDK initialization | §17.8 |
| `src/server/config/limits.ts` | Per-IP rate-limit constants (`BET_ATTEMPTS_PER_IP_PER_MIN`, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`, etc.) | §11, §18.5 |

### A.4 Route Handlers + Server Action mounts (`src/app/`)

| File | Purpose | SoT cited by |
|---|---|---|
| `src/app/api/auth/[...all]/route.ts` | Better Auth catch-all route handlers (F-AUTH-1 OAuth callback + F-AUTH-2 OTP request paths) | §4, §8.10 |
| `src/app/api/bets/place/route.ts` | F-BET-1 + F-BET-2 bet place Route Handler (D3 carve-out per §4.3) | §4 |
| `src/app/api/bets/sell/route.ts` | F-BET-3 bet sell Route Handler | §4 |
| `src/app/api/uploads/sign/route.ts` | Participant signed-PUT URL mint Route Handler (per §12.3) | §4, §12.10 |
| `src/app/api/admin/uploads/sign/route.ts` | Admin signed-PUT URL mint Route Handler (F-ADMIN-4 image affordance) | §12.10 |
| `src/app/api/cron/r2-orphan-sweep/route.ts` | Vercel Cron orphan-sweep target (Bearer `CRON_SECRET`) — A-2 cron pattern | §4, §12.10 |
| `src/app/api/health/route.ts` | Liveness probe | §4 |
| `src/app/api/dataset/manifest/route.ts` | F-DATASET-1 manifest endpoint (post-2026-11-06; HTTP 503 pre-release per §19.7) | §4, §19.8 |

### A.5 Configuration + cross-cutting middleware

| File | Purpose | SoT cited by |
|---|---|---|
| `proxy.ts` (formerly `middleware.ts`, repo root) | `request_id`, `ip`, `user_agent` injection + admin-redirect Layer 1 (UX, NOT security boundary) | §3.7, §8.10 |
| `package.json` | Better Auth + plugin version pins; Next.js ≥ 16.2.5 floor (per §3.3) | §8.10 |
| `vercel.json` | Vercel Cron job entry (`crons[]` array — single A-2 carve-out for R2 orphan sweep) | §12.10 |
| `src/lib/ranking.ts` | Comment-ordering function (per ADR-0009 + RANKING.md inputs) | §5.4 |
| `src/lib/pfp-url.ts` | Frontend PFP URL composer (`${R2_PFP_BASE_URL}/v1/${pfp_filename}`) | §12.10 |

### A.6 Test surfaces

| File pattern | Purpose | SoT cited by |
|---|---|---|
| `tests/db/triggers/<table>-append-only.spec.ts` | Per-table append-only trigger discipline (13 files for 13 protected tables, 33+ cases per §6.6) | §6.7, §14.4 |
| `tests/server/<domain>/<handler>.spec.ts` | Per-handler unit tests (handler-stack step coverage, transaction-shape correctness) | §14.4 |
| `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` | INV-1 canonical integration test | §14.1, §14.4 |
| `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` | INV-2 canonical integration test | §14.1, §14.4 |
| `tests/invariants/I-SIDE-BIND-001.comment-side-frozen.spec.ts` | INV-3 canonical integration test | §14.1, §14.4 |
| `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` | INV-4 canonical integration test | §14.1, §14.4 |
| `tests/server/identity/no-raw-uuid-in-urls.test.ts` | URL-exposure-rule acceptance test (per ADR-0016 D6 + §16) | §8.10, §16 |

### A.7 Documentation + runbooks (`docs/`)

| File | Purpose | SoT cited by |
|---|---|---|
| `docs/specs/SPEC.1.md` | Product spec (canonical anchor v1.8.0 → v1.0 at PRECURSOR.4) | §0 |
| `docs/specs/SPEC.2.md` | Technical architecture (this document) | §0 |
| `docs/specs/cpmm.md` | CPMM math companion | §0 |
| `docs/specs/RANKING.md` | Ranking function lock companion (per ADR-0009) | §5.4, §7.4 |
| `docs/specs/PSEUDONYM.md` | Pseudonym pool spec companion (per ADR-0011) | §3.5 |
| `docs/specs/design.md` | Design system companion (per ADR-0012 — in flight) | §22.1 |
| `docs/specs/error-codes.md` | Error code catalogue (38 rows at v1.0 lock per §15.4) | §13.6, §15.6 |
| `docs/specs/flows/F-*.md` | 40 per-flow contract files (skeleton at SCAFFOLD.2; substance per gating cadence per §13.4) | §13.6 |
| `docs/specs/flows/README.md` | Names §13 contract as authority | §13.6 |
| `docs/adr/0003-...md` through `0019-...md` | 17 ADR files (15 accepted + 1 superseded + 1 in flight per §22.1; committed at SYNC.BACKFILL) | §22.5 |
| `docs/adr/_template.md` | ADR file template | §22.5 |
| `docs/runbooks/BREAK_GLASS.md` | Admin-rotation + catastrophic-thaw runbook (HARDEN.10) | §6.7, §8.10, §18.5, §20.4, §21.3 |
| `docs/runbooks/conclusion-event-freeze.md` | Path-B manual freeze runbook (HARDEN.10) | §20.4, §21.3 |
| `docs/runbooks/dataset-build-pipeline.md` | 2026-11-06 dataset-build runbook (HARDEN.10) | §19.8, §21.3 |
| `docs/runbooks/r2-orphan-sweep-manual.md` | Manual R2 orphan-sweep fallback runbook (HARDEN.10) | §21.3 |
| `docs/runbooks/post-incident-review-template.md` | Post-incident self-review template (HARDEN.10) | §21.3 |
| `docs/runbooks/alarm-1-append-only-trigger-violation.md` | §17 alarm 1 runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-2-default-partition-insert.md` | §17 alarm 2 runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-3-bet-serialization-exhausted.md` | §17 alarm 3 runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-4-openai-moderation-upstream-failure.md` | §17 alarm 4 runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-5-identity-pool-low-watermark.md` | §17 alarm 5 runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-6a-upstash-rate-limit.md` | §17 alarm 6a runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-6b-upstash-idempotency.md` | §17 alarm 6b runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-6c-r2-unavailable.md` | §17 alarm 6c runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-6d-pg-cron-job-failure.md` | §17 alarm 6d runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/alarm-6e-vercel-cron-handler-5xx.md` | §17 alarm 6e runbook (HARDEN.10) | §21.1 |
| `docs/runbooks/vendor-supabase.md` | Supabase incident runbook (HARDEN.10) | §21.2 |
| `docs/runbooks/vendor-vercel.md` | Vercel incident runbook (HARDEN.10) | §21.2 |
| `docs/runbooks/vendor-cloudflare-r2.md` | Cloudflare R2 incident runbook (HARDEN.10) | §21.2 |
| `docs/runbooks/vendor-resend.md` | Resend incident runbook (HARDEN.10) | §21.2 |
| `docs/runbooks/vendor-openai.md` | OpenAI incident runbook (HARDEN.10) | §21.2 |
| `LICENSE.md` | AGPL-3.0-or-later license (per §0 + ADR convention) | §0 |
| `experiment/asset-pipeline/` | Identity-pool asset pipeline (Flux + Pillow + ComfyUI per ADR-0011) | §12.10 |

### A.8 External substrate (env vars + Vercel project settings)

| Surface | Purpose | SoT cited by |
|---|---|---|
| `ADMIN_PASSWORD` env var | Static admin password (per ADR-0010 + §8.4) | §8.10 |
| `CRON_SECRET` env var | Vercel Cron Bearer auth (per ADR-0006 + §3.4 A-2) | §3.7 |
| `ALLOWED_ORIGINS` env var | Bet-handler Origin allowlist (per §4.3) | §4 |
| `SENTRY_AUTH_TOKEN` env var | Sentry source-map upload auth (per ADR-0007) | §17.8 |
| `SENTRY_DEPLOY_HOOK_URL` env var | Vercel deploy hook → Sentry release tagging | §17.8 |
| `R2_PFP_BASE_URL` env var | Public CDN base URL for `zugzwang-pfp` static bucket | §12.10 |
| Vercel runtime logs | Structured per-request log (per SPEC.1 §16.3 H3 + §17.6) | §17.8 |

### A.9 Cross-section file-ownership concentrations

The most-cited files (4+ section citations) are the load-bearing infrastructure surfaces:

- **`drizzle/migrations/<NNNN>_append_only_triggers.sql`** — cited by §5.5 + §6.7 + §12.10 + §14.4 + §18.5 + §20.4 (six citations). The single migration that physically enforces every Bucket-A and Bucket-B append-only contract; the foundational integrity surface.
- **`docs/runbooks/BREAK_GLASS.md`** — cited by §6.7 + §8.10 + §18.5 + §20.4 + §21.3 (five citations). Single runbook covering admin rotation + catastrophic-thaw + freeze recovery.
- **`src/server/auth/index.ts`** — cited by §3.7 + §8.10 + §16 (three citations). Better Auth instance + UUIDv7 generateId override + session-deferral hook re-export.
- **`src/db/schema/auth.ts`** — cited by §5.5 + §8.10 + §16 (three citations). Five auth tables (`users`, `sessions`, `accounts`, `verifications`, `admin_sessions`) in a single domain file.
- **`src/server/events/insert.ts`** — cited by §3.7 + §7.8 + §16 (three citations). Events insertion helper.
- **`src/server/auth/session-gate.ts`** — cited by §8.10 + §14.4 + §18.5 (three citations). Session-deferral hook backing INV-3 + INV-4 + ToS-acceptance enforcement.
- **`docs/specs/error-codes.md`** — cited by §13.6 + §15.6 (two citations).
- **`tests/server/identity/no-raw-uuid-in-urls.test.ts`** — cited by §8.10 + §16 (two citations).

The concentration pattern reflects the design discipline: the most cross-cited surfaces are the **invariant-bearing primitives** (the trigger SQL, the events helper, the session-deferral hook, the BREAK_GLASS runbook). Surfaces with single-section citations are mostly per-Server-Action handler files and per-runbook documents — appropriately narrow.

---

## Appendix B — Per-Table Per-Column Dataset Classification

Per-column treatment for the 15 tables shipped in the 2026-11-06 public dataset release per §19.3. Each table's columns are classified into one of five treatments:

- **`SHIP`** — column ships verbatim from the Postgres source.
- **`PSEUDO`** — column carries `users.id` raw UUIDv7 in source; rewritten at export time to `users.pseudonym` slug per §19.5.
- **`STRIP`** — column dropped from released schema entirely (PII per §19.4).
- **`STRIP_KEY`** — JSONB sub-key dropped from a `metadata` or `payload` column (PII per §19.4).
- **`NULL_IF_ERASED`** — column ships verbatim except for rows where H2 erasure has fired; H2-erased rows release as NULL (per §19.4 + SPEC.1 §16.6).

The 5 not-shipped tables (`system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions`) have no per-column treatment because they don't ship; the rationale per §19.3 is operational + privacy-sensitive.

The discipline: this appendix is **derived** from §19.4 + §19.5 + §5.1. PRECURSOR.4 lock review walks every column row, verifies the treatment is consistent with the policy, and runs the column-name correctness sweep against the implemented Drizzle schemas at `src/db/schema/<domain>.ts` — any column in source that is not enumerated here is a coverage gap; any column enumerated here that does not exist in source is a drift fix. (This sweep was previously assigned to PRECURSOR.5; it is a verify-against-source check that belongs with the PRECURSOR.4 lock review, not the SYNC.8 CLAUDE/AGENTS rebuild.)

### B.1 `users` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Raw UUIDv7 preserved as join key for cross-table integrity verification per §19.5 |
| `pseudonym` | text | SHIP | The colour-animal-number slug; load-bearing as the dataset's user-identification key |
| `email` | text | STRIP | PII per §19.4 — column removed from released schema |
| `google_id` | text | STRIP | PII per §19.4 — column removed |
| `name` | text | STRIP | PII per §19.4 — Google display name; column removed |
| `image` | text | STRIP | PII per §19.4 — Google avatar URL; column removed |
| `email_verified` | boolean | SHIP | Email-verification flag; no PII, research-relevant for auth-completion analysis |
| `pfp_filename` | text | NULL_IF_ERASED | Slug for `zugzwang-pfp/v1/<slug>` per §12.7; H2 erasure null-s; otherwise ships |
| `tos_accepted_at` | timestamptz | SHIP | Research-relevant (ToS evidence timestamp) |
| `tos_version_hash` | text | SHIP | Research-relevant (which ToS version was accepted) |
| `privacy_version_hash` | text | SHIP | Research-relevant (which privacy policy version was accepted) |
| `tos_acceptance_ip` | text | STRIP | PII per §19.4 — column removed |
| `tos_acceptance_user_agent` | text | STRIP | PII per §19.4 — column removed |
| `last_allowance_accrued_at` | timestamptz | SHIP | Daily-allowance idempotency cursor; research-relevant for allowance-flow analysis |
| `banned_at` | timestamptz \| null | SHIP | Track A automatic ban + Track B admin manual ban evidence per §8.6 |
| `created_at` | timestamptz | SHIP | Canonical chronological-sort column |
| `updated_at` | timestamptz | SHIP | Better Auth row-update timestamp; research-relevant for account-mutation analysis |

### B.2 `markets` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Market PK; join key for `bets`, `comments`, `pools`, `positions`, `resolution_events`, `payout_events` |
| `slug` | text | SHIP | Participant-facing URL slug (per §16) |
| `title` | text | SHIP | Market question (e.g., "Will event X happen by Nov 5?") |
| `description` | text | SHIP | Market context |
| `status` | text | SHIP | `Open` / `Resolved` / `Voided` (whitelisted Bucket-C transition per §3.6) |
| `resolution_deadline` | timestamptz | SHIP | When the market is scheduled to resolve |
| `resolved_at` | timestamptz \| null | SHIP | Actual resolution timestamp; NULL until F-RESOLVE-1 fires |
| `resolution_outcome` | text \| null | SHIP | `YES` / `NO` / `VOID`; NULL until F-RESOLVE-1 fires |
| `created_by` | text | SHIP | `'admin-singleton'` sentinel per §3.6 (admin-actor created markets) |
| `created_at` | timestamptz | SHIP | |

Inferred-but-unconfirmed: exact column list pending SCAFFOLD.2 implementation. Above derived from §3.6 + ADR-0010 admin-actor encoding + SPEC.1 §10 product behavior. PRECURSOR.4 column-name correctness sweep verifies against `src/db/schema/markets.ts`.

### B.3 `pools` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Pool PK; one row per market (1:1 with `markets.id`) |
| `market_id` | uuid | SHIP | FK to `markets.id` |
| `yes_reserves` | numeric(38,18) | SHIP | CPMM YES-side reserves at freeze instant |
| `no_reserves` | numeric(38,18) | SHIP | CPMM NO-side reserves at freeze instant |
| `created_at` | timestamptz | SHIP | |

Inferred from CPMM math substrate per `cpmm.md`; PRECURSOR.4 verifies precision + column names.

### B.4 `positions` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Position PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `side` | text | SHIP | `YES` / `NO` |
| `quantity` | numeric(38,18) | SHIP | Per-user-per-market position cache |
| `created_at` | timestamptz | SHIP | |
| `updated_at` | timestamptz | SHIP | Last update inside W-1 transaction |

### B.5 `bets` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Bet PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `side` | text | SHIP | `YES` / `NO` |
| `stake` | numeric(38,18) | SHIP | Dharma staked |
| `share_quantity` | numeric(38,18) | SHIP | Shares received from CPMM |
| `price_at_bet` | numeric(38,18) | SHIP | Implied probability at bet time |
| `comment_id` | uuid | SHIP | FK to `comments.id` (INV-1 atomic bet+comment binding) |
| `idempotency_key` | text \| null | SHIP | Client-generated opaque string; carries no PII |
| `created_at` | timestamptz | SHIP | |

### B.6 `comments` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Comment PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `parent_comment_id` | uuid \| null | SHIP | NULL = top-level **post-bet** comment; non-NULL = **reply-bet** comment (F-COMMENT-2; FK to parent `comments.id`; `REPLY_DEPTH_MAX = 1`) |
| `body` | text | SHIP | Comment text content (post-moderation; only `pass`-verdict comments exist in this table per §10) |
| `image_uploads_id` | uuid \| null | SHIP | FK to `image_uploads.id` for F-COMMENT-3; NULL for text-only comments |
| `side_at_post_time` | text | SHIP | INV-3 binding: `YES` / `NO` frozen at insert — the side of the bet this comment rides (§14.1). The render-time ranking aggregates (§5.4) read this across reply-bets; there is no `stake_at_post_time` column |
| `bet_id` | uuid | SHIP | **NOT NULL** — FK to `bets.id`, 1:1 with the comment-bearing bet (INV-1). Every comment rides a bet (post-bet or reply-bet); the only comment-free bet is the sell |
| `created_at` | timestamptz | SHIP | |

### B.7 `dharma_ledger` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Ledger row PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `bet_id` | uuid \| null | SHIP | FK to `bets.id` for stake / payout / refund / correction rows; NULL for `daily_allowance` / `initial_grant` rows |
| `entry_type` | `dharma_entry_type` (pgEnum) | SHIP | `bet_stake` / `bet_payout` / `daily_allowance` / `pool_seed` / `pool_unwind` / `correction_reverse` / `correction_apply` / `void_refund` / `uncollectable` / `initial_grant` (built as a pgEnum, not `text`; `pool_seed`/`pool_unwind` dormant in v1, R-2) |
| `amount` | numeric(38,18) | SHIP | Signed; positive = credit, negative = debit |
| `balance_after` | numeric(38,18) | SHIP | Running balance; INV-2 (no overdraft) verifiable from this column |
| `created_at` | timestamptz | SHIP | |

Inferred from §3.7 + INV-2 mechanism per §14.1; PRECURSOR.4 verifies entry-type enum against actual implementation.

### B.8 `payout_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Payout row PK |
| `bet_id` | uuid | SHIP | FK to `bets.id` |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `resolution_event_id` | uuid | SHIP | FK to `resolution_events.id`; identifies which resolution this payout belongs to |
| `payout_type` | text | SHIP | `bet_payout` / `correction_reverse` / `correction_apply` / `void_refund` |
| `amount` | numeric(38,18) | SHIP | Dharma paid out |
| `created_at` | timestamptz | SHIP | |

### B.9 `resolution_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Resolution event PK |
| `market_id` | uuid | SHIP | FK to `markets.id` |
| `event_kind` | text | SHIP | `resolve` / `correct` / `void` |
| `outcome` | text | SHIP | `YES` / `NO` / `VOID` |
| `corrects_event_id` | uuid \| null | SHIP | FK to prior `resolution_events.id` for F-RESOLVE-2; NULL for initial resolutions |
| `reason` | text \| null | SHIP | Admin free-text reason; NULL for F-RESOLVE-1; populated for F-RESOLVE-2 + F-RESOLVE-3 |
| `created_at` | timestamptz | SHIP | |

### B.10 `mod_actions` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Moderation action PK |
| `target_user_id` | uuid \| null | PSEUDO | The user being moderated; rewritten to `target_user_pseudonym`; NULL for admin-action-on-content paths |
| `target_comment_id` | uuid \| null | SHIP | FK to `comments.id` for F-COMMENT-* moderations; NULL for F-BET-* moderations |
| `target_bet_id` | uuid \| null | SHIP | FK to `bets.id` for F-BET-1 entry-comment moderations; NULL otherwise |
| `verdict` | text | SHIP | `pass` / `track_a` / `track_b` |
| `categories` | jsonb | SHIP | OpenAI moderation category scores at decision time |
| `image_r2_key` | text \| null | STRIP | Operational; per §19.4 — column removed from released schema |
| `actor_id` | text | SHIP | `'admin-singleton'` for Track B; `'system'` for Track A automatic |
| `created_at` | timestamptz | SHIP | |

### B.11 `admin_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Admin event PK |
| `event_type` | text | SHIP | `admin.signed_in` / `admin.market_resolved` / `admin.market_corrected` / `admin.market_voided` / `admin.moderation_acted` / etc. |
| `payload` | jsonb | SHIP | Per-event-type payload |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | Correlation key |
| `metadata.flow_id` | text | SHIP_KEY | F-* identifier |
| `metadata.user_id` | uuid \| null | SHIP_KEY | NULL for admin actor |
| `metadata.actor_id` | text | SHIP_KEY | `'admin-singleton'` |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | |

### B.12 `user_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | User event PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `event_type` | text | SHIP | `user.oauth_signed_in` / `user.otp_signed_in` / `user.pseudonym_assigned` / `user.tos_accepted` / `user.signed_out` (Daily Credit accrual rides `events` as `dharma.credited` per §5.5 — ENGINE.12 R1/R2; no `user_events` row) |
| `payload` | jsonb | SHIP (with per-event-type variations) | E.g., `user.tos_accepted` carries version hashes; `user.pseudonym_assigned` carries the pseudonym slug |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | |
| `metadata.flow_id` | text | SHIP_KEY | |
| `metadata.user_id` | uuid | SHIP_KEY → PSEUDO | Self-actor; rewritten to `user_pseudonym` |
| `metadata.actor_id` | uuid | SHIP_KEY → PSEUDO | Self-actor (echoes user_id); rewritten to `actor_pseudonym` |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | |

### B.13 `events` (Bucket A — canonical audit log)

The events table is the most heavily-consumed surface for K_eff(t) trajectory derivation per §19.6 + §7.

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `event_id` | uuid | SHIP | Storage-layer dedupe primitive per §7.3 |
| `event_type` | text | SHIP | Closed enum at application layer; one Zod schema per value at `src/server/events/schemas.ts` |
| `aggregate_type` | text | SHIP | `market` / `bet` / `comment` / `user` / `dharma_account` / `system` / `admin_session` / `image_upload` |
| `aggregate_id` | uuid | SHIP_OR_PSEUDO | Per-aggregate-type: `users` aggregate_id rewrites to pseudonym; other aggregate types preserve raw UUID. `admin_session` aggregate_id (the admin cookie value) SHIPs raw — defense-in-depth covered by `BREAK_GLASS.md` rotation + payload STRIP rules per §19.4.1 |
| `payload` | jsonb | SHIP with per-event-type STRIP_KEY rules per §19.4.1 | `bet.placed` carries stake / side / price; `comment.placed` carries body / side_at_post_time; etc. Per-event-type PII keys (`ip`, `user_agent`, `email`, `googleId`, `userId`, `key`, `sessionId`) STRIP at export per §19.4.1 table |
| `payload_version` | smallint | SHIP | Migration cursor |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | |
| `metadata.flow_id` | text | SHIP_KEY | |
| `metadata.user_id` | uuid \| null | SHIP_KEY → PSEUDO (when not NULL) | NULL for admin-actor events; PSEUDO otherwise |
| `metadata.actor_id` | text | SHIP_KEY (sentinel) or PSEUDO | `'admin-singleton'` sentinel preserved literally; participant-actor values rewrite to pseudonym |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | Canonical chronological-sort column |

### B.14 `identity_pool` (Bucket B)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Synthetic UUIDv7 PK per ADR-0016 D5 |
| `colour` | text | SHIP | One of the canonical colour set per ADR-0011 |
| `animal` | text | SHIP | One of the canonical animal set per ADR-0011 |
| `number` | smallint | SHIP | 0-999 per ADR-0011 |
| `pseudonym` | text | SHIP | Materialised PascalCase concatenation `<Colour><Animal><NNN>` (e.g. `RedFox001`) per shipped `src/server/identity-pool/consume.ts:51`. NOT hyphen-kebab — that shape applies to `pfp_filename` only. |
| `pfp_filename` | text | SHIP | Slug for `zugzwang-pfp/v1/<slug>` (deterministic per ADR-0011) |
| `assigned_at` | timestamptz \| null | SHIP | Bucket-B whitelisted transition; NULL for unassigned tuples; populated at F-AUTH-3 |
| `created_at` | timestamptz | SHIP | |

Post-experiment, all 50K rows ship with `assigned_at` populated only for tuples consumed during the experiment; unassigned tuples ship with NULL.

### B.15 `image_uploads` (Bucket B)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Image upload PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `r2_object_key` | text | STRIP | Operational; per §19.4 — column removed |
| `terminal_state` | text \| null | SHIP | `committed` / `blocked` / `orphan`; NULL for in-flight at freeze (rare per §12.6) |
| `terminal_at` | timestamptz \| null | SHIP | Bucket-B whitelisted transition partner; matches `terminal_state` non-NULL |
| `created_at` | timestamptz | SHIP | |

### B.17 Closing notes

**Tables not shipped (5):** `system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions` per §19.3. Per-column treatment is undefined because the tables don't ship. Rationale per §19.3 row-by-row.

**JSONB sub-key handling.** The `metadata` column on `events` / `admin_events` / `user_events` / `mod_actions` is a JSONB structured column where the seven-field set per §3.7 is consistent. The `STRIP_KEY` treatment removes specific JSONB keys from the released JSONB value while preserving the column structure — implementations use `jsonb_set(metadata, '{ip}', null)` then `metadata - 'ip'` (or equivalent jsonb-key removal) at export time.

**`actor_id` sentinel handling.** The `'admin-singleton'` literal string in `metadata.actor_id` is preserved verbatim across all audit tables — it's not a UUID to pseudonymize; it's a sentinel value the export pipeline must recognize per §3.6.

**H2 erasure interaction.** Per §19.4 + SPEC.1 §16.6, H2 erasure scrubs `users` PII columns + null-s `pfp_filename`. At dataset-export time, H2-erased rows ship in the same shape as not-erased rows — both have NULL email, NULL google_id, etc. The dataset consumer cannot distinguish "user erased pre-freeze" from "user never had data."

**Coverage observation.** The 15 tables × ~10 columns each = ~150 column-level decisions. Of these:
- ~118 are SHIP (audit-trail integrity preserved)
- ~14 are PSEUDO (every `user_id` / `target_user_id` FK gets rewritten)
- 9 are STRIP / STRIP_KEY (the ten PII columns/keys per §19.4 minus one — `pfp_filename` is NULL_IF_ERASED instead of STRIP because it survives non-erasure)
- 1 is NULL_IF_ERASED (`users.pfp_filename`)
- ~12 are SHIP-with-policy-aware-treatment (e.g., `events.aggregate_id` resolves PSEUDO or SHIP per `aggregate_type`)

The asymmetric distribution reflects the privacy-by-design property: the dataset is **mostly preserved** (audit trail intact, K_eff(t) reconstructible from events log) with **narrow PII redaction** (only the ten columns/keys named in §19.4 actually leave the dataset).
