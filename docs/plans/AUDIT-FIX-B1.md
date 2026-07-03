# AUDIT-FIX-B1 — Observability batch (finish SCAFFOLD.5): A5, A6, A7, A17, A18-DSN

> **Fresh re-plan against `main` @ `f4416e7`** (A1 squash `4350406` + its log commit). Supersedes the prior-chat B1 plan whose line refs were pre-A1 stale. All capture-site targets below re-verified against the live tree this session. Ritual: gated plan→execute (critical-path-adjacent: `src/server/bets/` + `src/server/moderation/`), NOT ultracode. At execute this file is committed as `docs/plans/AUDIT-FIX-B1.md` before Phase 1 ends (§5.1).

## Context

AUDIT.1 found the observability layer half-landed: the bet handler converts every failure into a wire envelope so money-path 500s never reach Sentry (A5); OpenAI moderation terminal failure — which fails closed and halts all betting — alarms nowhere (A6); the `cron_alarms` queue that the nightly Dharma-drift check (the A2 money-mint tripwire) writes into has no drain consumer, so the one belt that would detect a ledger fork dead-ends in Postgres (A7); the SPEC.1 §16.3 `logRequest` structured request log emits from zero handlers (A17); and a missing Sentry DSN silently no-ops all three `Sentry.init` sites with no detector (A18-DSN). B1 lands the batch **additive-only**: no behavior change on any request path, fail-closed postures preserved, alarm strings byte-identical to spec/TODO text. The only intentional behavior change is the A18 boot-throw, itself gated on F2.

All 11 open questions are ruled and operator-ratified (gate memo `AUDIT-FIX-B1_plan-review_execute-gate.md`, 2026-07; tally 6 clean · 4 riders · 1 override). This plan implements the rulings — it does not re-open them.

**Exit:** PR open + tests green + reviewer cascade clean. **NOT merged** — operator merges after web diff review.

## Gate status (from the memo's three hard preconditions)

1. ✅ **A1 on main** — verified: `4350406` is HEAD~1; tree clean; no B1↔A1 file race remains.
2. ⏳ **F2 — `NEXT_PUBLIC_SENTRY_DSN` in BOTH Vercel scopes** (Production + Preview/staging) — operator dashboard check, still open. Gates which A18 variant ships (§A18 below); does **not** gate planning. Vercel-direct + on the env-audit `INTENTIONAL_MANUAL` exclusion, so no automated check exists.
3. ⏳ **F1 shape report** — first execute-chat step: quote the two canonical captures verbatim before implementing. Banked here from live source:
   - `src/server/bets/transaction.ts:142` — `captureMessage("bet_serialization_exhausted", { level: "error", tags: { sqlstate, flow: args.flow } })` → **title-matched container** (no err object).
   - `src/server/middleware/rate-limit.ts:166` — `captureException(err, { tags: { kind: "upstash_unavailable_rate_limit" } })` → **tag-matched container** (`kind`).
   Every new site conforms to this split: `captureException(err, { tags: { kind: NAME } })` where an err exists; `captureMessage(NAME, { level: "error", … })` only where there is none (drain per-row emits + `events_default_nonempty`).

## Re-verified tree facts (the kickoff's stale-ref audit)

- `bets/errors.ts` — `toWireError` fallthrough `500 error_internal` is now at **:357** (was ~331 pre-A1). Grep-verified: `error_internal` in the bet wire path exists **only** as this fallthrough; the one commented feeder (`place.ts:241`, event-payload validation) is a deliberate bug-surface, not an expected condition (ruling #2's reviewer check pre-answered; @code-reviewer re-verifies).
- `bets/endpoint.ts` — the shared catch is at **:307–323**; it serves BOTH `/api/bets/place` and `/api/bets/sell`, so one capture covers both routes.
- **A1's `verify-object.ts` routes through the r2.ts wrapper** — its only R2 call is `headObject()` (`verify-object.ts:39`), whose catch (`r2.ts:188–196`) throws `StorageObjectMissingError`/`StorageUnavailableError` itself. The kickoff's open question is answered: capture at the wrapper **covers** the A1 R2-down path; B1 needs no separate catch in verify-object.
- `moderation/openai.ts:109–113` — the `TODO(SCAFFOLD.5)` console.error auth arm survives A1 untouched; tag string `openai_moderation_auth_failure` must stay byte-identical.
- `precommit.ts` — re-wraps everything as `ModerationUnavailableError` but mints no vendor failure of its own that isn't already captured at source: its `signRead` arm (:114) surfaces R2-down, captured by A5's wrapper capture. Ruling #4 (vendor-boundary only, no precommit capture) leaves **no gap**.
- `cron_alarms` (raw DDL in `0007_pg_cron_jobs.sql:26–32`): `id bigserial PK · alarm_id text · payload jsonb · emitted_at · processed_at NULL`. Bucket C, no append-only trigger, **not in the drizzle schema** (hand-written migration). Live writer-side alarm_ids: `identity_pool_low_watermark` (0007), `position_drift`, `dharma_chain_drift`, `single_side_violation` (0011/0015). Default partition name: `events_default` (`0002:51`).
- `logRequest` (`middleware/logging.ts:36`) — 7 fields locked, **zero callers** (grep-verified). Its header contract: origin-blocked / rate-limited / auth-failed rejections DO NOT log ("never reached the handler body").
- `instrumentation.ts:17–31` — `register()` already boot-throws on invalid `ZUGZWANG_ENV`; the DSN assert slots directly after it. All three `Sentry.init` sites read `NEXT_PUBLIC_SENTRY_DSN`.
- `vercel.json` — two crons today (`r2-orphan-sweep` 0 */6, `close-due-markets` * *). No DP.1 edit present at HEAD; re-check at execute (DP wins on collision, ruling #11).
- Cron-route pattern (`close-due-markets/route.ts`): constant-time `CRON_SECRET` Bearer auth → Redis lock (`getRedisKey("cron-lock", …)` + `acquireLock`) → work in try/finally release → in-body status with HTTP 200 (crash → `captureException` kind `<name>_handler_failure` + `{status:"error"}`). `r2-orphan-sweep` has **no freeze gate** → ops-hygiene crons don't gate on freeze; the drain follows.

## Changes

### 0 · `safeCapture` helper (ruling #8) — new `src/server/observability/safe-capture.ts`

One auditable module enforcing capture fail-open (§17.5). Two thin wrappers mirroring the two F1 containers, each `try/catch`-wrapped, returning `boolean` (true = the SDK call did not throw):

- `safeCaptureException(err: unknown, ctx: { tags: { kind: string } & Record<string, string> }): boolean`
- `safeCaptureMessage(name: string, ctx?: { level?; tags?; extra? }): boolean`

The boolean exists for the drain (emit-then-stamp needs per-row success); fire-and-forget sites ignore it. **Existing bare capture sites stay untouched** (ruling #8). `import "server-only"`.

### A5 · Money-path 500s + `r2_unavailable` (rulings #1, #2, #3)

1. **`src/server/bets/endpoint.ts`** — in the catch (:307), after `const wire = toWireError(err)`:
   `if (wire.body.error.code === "error_internal") safeCaptureException(err, { tags: { kind: "bet_handler_internal_error" } })`.
   Original `err` object → the caught append-only RAISE message survives verbatim (ruling #1). Only the 500 branch — the 503s (`bet_serialization_exhausted`, moderation, storage) are captured at their own sources (ruling #2). Covers place + sell.
2. **`src/server/storage/r2.ts`** — `safeCaptureException(err, { tags: { kind: "r2_unavailable" } })` immediately before each of the **four** `throw new StorageUnavailableError(err)` sites (`mintPutUrl:140`, `mintReadUrl:161`, `headObject:195`, `deleteObject:213`). **Not** on the 404 → `StorageObjectMissingError` arm (:192) — a client-error product condition, not vendor-down. §17.3 6c canonical home; capture-at-source means the sign routes, precommit's `signRead`, verify-object, and the orphan sweep are all covered with **no second string**. Dual-capture on sweep failure (`r2_unavailable` + existing `orphan_sweep_handler_failure`) is ruled-accepted (#3).

### A6 · OpenAI vendor-boundary captures (ruling #4)

**`src/server/moderation/openai.ts`** — three edits, all at the vendor boundary, none in precommit:
1. Auth arm (:109–113): replace `console.error("openai_moderation_auth_failure", err)` + TODO with `safeCaptureException(err, { tags: { kind: "openai_moderation_auth_failure" } })`. Tag byte-identical to §17.2 row 4. Throw preserved.
2. Non-transient arm (:115–117): `safeCaptureException(err, { tags: { kind: "openai_moderation_upstream_failure" } })` before the throw. (Also catches the `openai_moderation_empty_results` anomaly, which lands here as non-transient.)
3. Retries-exhausted arm (:121): same capture with `lastErr` before the throw.
F1 note: the audit's fix-direction said `captureMessage` for the terminal arm, but an err object exists at all three sites → tag-matched `captureException` per the F1 convention (the ruled shape). Fail-closed `ModerationUnavailableError` flow unchanged; transient-then-success retries capture nothing.

### A7 · `cron_alarms` drain (rulings #5, #10-OVERRIDE, #11)

1. **New `src/server/observability/drain-cron-alarms.ts`** — `drainCronAlarms()`, **emit-then-stamp (at-least-once), no open tx across the Sentry hop** (the OQ-10 override + its guardrail):
   - `SELECT id, alarm_id, payload, emitted_at FROM cron_alarms WHERE processed_at IS NULL ORDER BY id LIMIT ${ALARMS_DRAIN_BATCH_SIZE}` — plain `db.execute<T>(sql\`…\`)` (raw-SQL precedent `sweep-orphans.ts:109`; the table is deliberately NOT added to the drizzle schema — hand-written 0007 DDL, adding a pgTable would make the next `drizzle-kit generate` emit a duplicate CREATE).
   - Per row: `ok = safeCaptureMessage(row.alarm_id, { level: "error", tags: { alarm_id: row.alarm_id }, extra: { payload: row.payload, emitted_at: row.emitted_at, cron_alarm_id: row.id } })` — title = alarm_id (title-matched container; Sentry fingerprint-dedups re-emits, which is what makes at-least-once "no-spam").
   - `UPDATE cron_alarms SET processed_at = now() WHERE id IN (…)` — **only** ids whose emit returned true; single statement after all emits. Crash between emit and stamp → next tick re-emits (accepted).
   - **`events_default` fold (ruling #5, deliberate scope inclusion):** `SELECT count(*) FROM events_default`; if > 0 → `safeCaptureMessage("events_default_nonempty", { level: "error", extra: { count } })`. No new pg_cron migration. Re-emits each 5-min tick while non-empty (fingerprint-dedup) — flagged as OQ-c below.
   - Returns `{ selected, emitted, stamped, defaultPartitionCount }` for the route body + tests.
2. **New `src/app/api/cron/alarms-drain/route.ts`** — mirrors `close-due-markets/route.ts` verbatim minus the freeze gate (ops-hygiene precedent: `r2-orphan-sweep` has none; the drain writes only `processed_at`, no §20.2 surface — OQ-b): constant-time `CRON_SECRET` auth → `acquireLock(getRedisKey("cron-lock", "alarms-drain"), ALARMS_DRAIN_LOCK_TTL_SECONDS)` (the Redis lock IS the serialization the override assumes) → drain → in-body status HTTP 200; crash arm → `safeCaptureException(err, { tags: { kind: "alarms_drain_handler_failure" } })` + `{status:"error"}` (naming precedent: `close_due_markets_handler_failure` / `orphan_sweep_handler_failure`, neither a §17.2 master row — OQ-d).
3. **`src/server/config/limits.ts`** — `ALARMS_DRAIN_LOCK_TTL_SECONDS = 240` (< the 300s cadence; mirrors CLOSE_SWEEP 55 < 60), `ALARMS_DRAIN_BATCH_SIZE = 200` (leftovers drain next tick — bounded, not silent: count returned in the route body).
4. **`vercel.json`** — add `{ "path": "/api/cron/alarms-drain", "schedule": "*/5 * * * *" }` (ruling #11). Re-verify no DP.1 collision at execute; DP wins.

### A17 · Wire `logRequest` (rulings #6, #7)

Wiring surface per the audit fix-direction: `runBetEndpoint` + the two sign routes. Honors logging.ts's locked contract — only responses produced by the **handler body** (step 5 onward) log; origin/auth/ban/onboarding/freeze/idem-key/idem-lookup/rate-limit rejections do not:
1. **`bets/endpoint.ts`** — `startedAt = Date.now()` at entry; `let logStatus: number | null = null`, set at the `inner` result (:301–306) and the catch's wire (:308–315), **not** at the 429 arm; in the existing `finally`, `if (logStatus !== null) logRequest({ request, status: logStatus, userId, startedAt })`. Covers both bet routes' 200/4xx/500 handler-body outcomes.
2. **`api/uploads/sign/route.ts`** — log at the step-5+ returns (body-parse 400s, envelope 400s, 503, 200) with `userId = session.user.id`; the final `throw err` re-throw (:192) stays unlogged (crash path → Next `onRequestError` → Sentry).
3. **`(admin)/admin/markets/media/sign/route.ts`** — same pattern from its step-4 body-validate onward, `userId: null` (admin has no `users` row — refusal trigger §3 forbids inventing one).
The 7-field shape is untouched (ruling #6: §16.3(7)⇄§17.6(8, +`request_id`) reconciliation → **B8, tracked G2** — not this batch).

### A18-DSN · Boot-time DSN presence (ruling #9)

**`instrumentation.ts`** — in `register()`, directly after the `ZUGZWANG_ENV` validation (same boot-fails-the-deploy rationale, LD-2 comment style):
- **Primary (ships iff F2 confirms DSN in both scopes):** `if ((env === "prod" || env === "staging") && !process.env.NEXT_PUBLIC_SENTRY_DSN) throw` — staging stays inside the throw scope so a missing DSN blows up at rehearsal, not prod.
- **Fallback (only if staging can't be guaranteed):** throw for `prod` only; `staging` → loud `console.error("sentry_dsn_missing …")` warn.
`preview` never throws (local `ZUGZWANG_ENV=preview just verify` unaffected). Client init stays no-op-if-absent (a client-side throw would break browsers; the server boot-throw catches absence at deploy time first). Which variant ships is pinned by the operator's F2 answer at the execute gate — both are drafted, the diff is two lines.

Out of B1 (deploy/CI batch, per kickoff "A18-DSN" scoping): the `R2_*_MARKET_MEDIA` `REQUIRED_KEYS` + `verify-r2-scope` 3-token matrix.

### Same-commit doc riders (web-authored, CC-committed)

`docs/specs/SPEC.2.md` §17.2: (a) add `bet_handler_internal_error` (source `bets/endpoint.ts` caught-500 arm; tag-matched container); (b) alarm-2: add `events_default_nonempty` (title-matched) + correct transport wording "pg_cron meta-query" → **drain-side**. Exact row text is **web-authored at commit** — CC pauses, requests it, and does not draft it (relay rule: web-owned verbatim text absent → STOP and re-request). No ADR (0028 stays A1's). No migration.

## Tests (test-writer first, failing, never edits src/)

New, following the on-disk conventions (`tests/server/cron/close-due-markets.test.ts` is the route anchor):
- `tests/unit/observability/safe-capture.test.ts` — SDK throw → returns false, never propagates; success → true; container shapes.
- `tests/server/cron/alarms-drain.test.ts` — 401 bad/missing secret; `{status:"locked"}` when lock held; happy drain body; crash → `alarms_drain_handler_failure` + `{status:"error"}` HTTP 200; lock released in finally.
- `tests/integration/alarms-drain.integration.test.ts` — real PG, mocked `@sentry/nextjs`: fixture rows → all emitted+stamped; **one emit fails → that row NOT stamped, others stamped** (the at-least-once heart); re-run re-emits the unstamped row; `events_default` row → `events_default_nonempty`; empty queue no-op. TRUNCATE hygiene per `positions.integration` precedent.
- `tests/server/bets/` (extend) — inner throws plain Error → 500 envelope byte-unchanged **and** one `bet_handler_internal_error` capture; negatives: BetProductError 400 / serialization-exhausted 503 / StorageUnavailable 503 → **zero** endpoint captures.
- `tests/server/storage/` (extend) — wrapper throw sites capture `r2_unavailable` then throw; headObject 404 → StorageObjectMissingError, no capture.
- `tests/server/moderation/` (extend) — auth error → auth tag + no console.error; exhausted transients → one upstream tag; success-after-retry → zero captures; ModerationUnavailableError flow byte-unchanged.
- A17 — logRequest fires once with correct status for handler-body outcomes; **not** for prefix rejections (origin/auth/429/idem); 7-field shape asserted.
- `tests/server/observability/instrumentation-register.test.ts` — prod+no-DSN throws; preview+no-DSN passes; staging per shipped variant.

## Verification

1. `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build).
2. Critical-path gates **locally** (W-RULE-1): `pnpm vitest run` — full suite, direct (not `just`), local PG :54322 already up; proves zero behavior change (every pre-existing test green unchanged).
3. In-session pre-PR self-audit (§5.10) against this plan item-by-item, including: byte-identical strings grep (`bet_serialization_exhausted`, `openai_moderation_auth_failure`, `upstash_unavailable_*`, envelope codes), no-capture-in-tx check (all new captures sit outside `db.transaction` scopes), riders present.
4. Cascade: `@test-writer` (Phase-2 start) → implement → self-audit → `@code-reviewer` (incl. the ruled `error_internal`-reuse verification) → `@security-auditor` (zero behavior change + fail-closed preserved: bet endpoint, moderation, admin sign). `@db-migration-reviewer` N/A (no DDL — `cron_alarms` stays out of the drizzle schema). All subagents get `@docs/plans/AUDIT-FIX-B1.md`.
5. STOP at PR. Session log `docs/logs/AUDIT-FIX-B1.md` before close.

## Open questions for web review (decisions ride the relay, not in-CLI)

- **OQ-a (F2):** DSN in both scopes? → picks A18 primary vs fallback. Sole EXECUTE blocker among these.
- **OQ-b (freeze gate):** drain route ships **without** a freeze gate (precedent: r2-orphan-sweep; observability isn't a §20.2 surface; post-freeze drift alarms should still drain). Confirm.
- **OQ-c (re-emit cadence):** `events_default_nonempty` re-fires each 5-min tick while non-empty, relying on fingerprint dedup — recommended over a `watermark_state`-style transition row (which would add DB state/scope). Confirm.
- **OQ-d (rider scope nits, web's call at rider-authoring time):** ① pin `openai_moderation_upstream_failure` + its container into §17.2 row 4 (the row currently names only the auth sub-class); ② optionally add A1's verify HeadObject to 6c's trigger enumeration; ③ `alarms_drain_handler_failure` — document beside the other two handler-failure tags or leave as code-level precedent (neither existing one has a §17.2 row).

## NOT doing

No DDL/migration (drizzle untouched; cron_alarms undeclared by design). No auth/bet-engine/ledger/moderation-verdict **logic** — only additive observability on their error arms; every wire envelope, status, retry-after, and fail-closed posture byte-identical. No B8 field reconciliation. No 6d writer (pg_cron job-failure meta-query — the generic drain will carry it whenever a writer lands). No A24/A25 fixes (separate findings). No DP.2. No touching existing bare capture sites. No merge.

---

## Execute-gate resolution (appended at EXECUTE, 2026-07-03)

- **F1 ✅** — both canonical captures re-quoted verbatim from the live tree at execute; they match the banked quotes above exactly (`transaction.ts:142` title-matched `captureMessage`; `rate-limit.ts:166` tag-matched `captureException` with `kind`). Every new B1 site conforms to the split.
- **F2 ✅ — A18 PRIMARY ships.** `vercel env ls` (name/scope metadata, values untouched): `NEXT_PUBLIC_SENTRY_DSN` present in `Production, Preview` (38d) **and** the custom `staging` environment (36d). Both throw-scope environments are covered, so staging stays inside the boot-throw. Operator veto point: the PR diff (the variant delta is two lines in `instrumentation.ts`).
- **Confirm #2 (A17 admin sign log) ✅ clean** — `logRequest`'s locked signature already types `userId: string | null`; `user_id: null` is an in-contract value, and the `route` field (`/admin/markets/media/sign`) unambiguously marks the row as the admin surface in the dataset — no ambiguity with anonymous participants (no participant route logs a null user: both wired participant surfaces log post-auth). No `logging.ts` edit; the admin route stays in scope per ruling #7.
- **Confirm #3 (vercel.json) ✅** — live file carries only `r2-orphan-sweep` + `close-due-markets`; no DP.1 edit present, no collision with the `alarms-drain` addition.
- Session-model deviation: executed on **Fable 5 + ultracode** by explicit operator override (2026-07-03, after a precondition STOP); the named-reviewer cascade and gated sequencing were retained unchanged — ultracode used only for read-only verification fan-out, never the write path.
