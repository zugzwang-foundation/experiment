# ENGINE.15 — HTTP / cron / admin wiring (plan)

> **Status:** Founder-ratified 2026-06-13 (rulings R-15.1..R-15.6 via "best recoms";
> S4 anchor battery PASS, all 13 anchors reconciled). Target file: `docs/plans/ENGINE.15.md`,
> merged via a Phase P docs-only PR off `docs/engine-15-plan`; plan-session log via
> `chore/engine-15-plan-log`.
>
> **Stratum:** ENGINE.15 = the HTTP / cron / admin wiring stratum (newly minted ID; no tracker
> row yet — known drift, the post-ENGINE.10 sweep mints it). **Errata standing:** where the
> ENGINE.9 / ENGINE.14 plans and logs say "ENGINE.10" in handoff / carry-forward / security
> registers, read **ENGINE.15**. The tracker's ENGINE.10 row ("Engine-phase exit — full-invariant
> stress test", deps E.8/9/12/13) is a different, later task; sequencing is
> ENGINE.15 → ENGINE.10 → tracker sweep.
>
> **Critical path:** auth + money-adjacent wiring. Execute runs the full gated ritual
> (S0–S7, RED-first, @code-reviewer → @security-auditor, five pre-PR gates) in a fresh CC
> session + fresh web chat. No ultracode.

---

## Context

ENGINE.9 (resolution trio + F-ADMIN-3 trigger, PR #114 → `af28566`) and ENGINE.14 (W-4
lifecycle writes + admin actor guard, PR #118 → `a29ef7e`; log PR #119 → `5a58883`) shipped the
full service layer for market lifecycle and resolution. Nothing invokes it: S2 recon confirmed
`grep -rn "@/server/markets|@/server/resolution|@/server/admin" src/app/` → NONE. The `(admin)`
route group holds only the login page; `api/cron/` holds only the r2-orphan-sweep A-2 precedent.
Greenfield is clean — no half-built wiring to dedupe.

ENGINE.15 wires the shipped services to the world: admin Server Actions + minimal admin pages
(SPEC.2 §4.1 family F5), the close-sweep Vercel Cron route (CF-1), the resolution-site
actor-assert retrofit (CF-6), form-boundary validation (SA-L-1, ENGINE.9 `reason` row,
CR-3/SA-I-3), the wire-error mapping for the wired flows (R-15.5), and the rider set that truths
SPEC.1/SPEC.2/AGENTS.md to the as-built surface.

Repo state at authoring: main @ `5a58883` · SPEC.1 + SPEC.2 at 1.0.4 · migration head 0015 ·
`EVENT_TYPES` 23. **No migration in this stratum** — @db-migration-reviewer idle at execute.

---

## §Rulings — founder-ratified payload (2026-06-13; binding)

Ruled via "best recoms" on the S3 Q-set — all six recommendations accepted as stated:

- **R-15.1 — Admin page scope: minimal functional pages only.** `/admin/markets` list +
  `/admin/markets/new` (create form) + `/admin/markets/<uuid>` detail carrying the
  state-appropriate forms (seed, close, resolve, correct, void). Unstyled, same pattern as the
  existing `/admin/login` page. SPEC.1 §15.2 hub dashboard widgets and the three-tab visual shell
  are **out** — DESIGN/UI lanes own visuals. UI.12 disposal: UI.12 owns *participant* route
  protection; admin guarding is already built (proxy.ts Layer 1 + `validateAdminSession`
  Layer 2) — no overlap, UI.12 untouched.
- **R-15.2 — Cron wiring lands complete.** This stratum ships `GET /api/cron/close-due-markets`
  (A-2 mirror: Bearer + distributed lock + in-body status) **and** the second `vercel.json` cron
  entry at per-minute-class placeholder cadence (`* * * * *`), plus the SPEC.2 rider amending
  "No other Vercel Cron jobs in v1" → two jobs. Numeric cadence tuning stays HARDEN.
- **R-15.3 — Composed resolve surface.** ONE `resolveMarketAction` (side + reason). Market
  `Closed` → trigger tx then settle tx, back-to-back (SPEC.2 §3.6, ENGINE.9 C-1). Market already
  `Resolving` → skip trigger, settle directly — the ratified stranded-`Resolving` recovery
  (ENGINE.9 plan §W-3a), encoded in the action, not in admin folklore. Partial failure (trigger
  committed, settle threw) → return the settle error verbatim **plus** explicit state ("Market is
  now Resolving — resubmit to complete settlement"); resubmission completes it. **No standalone
  trigger surface**; SPEC.2 §4.2's separate `triggerResolution` row gets a rider marking it
  absorbed.
- **R-15.4 — Manual close surface: in.** Close form on the market detail page; the service
  already rejects pre-deadline closes (`MarketDeadlineNotReachedError`), so no early-close risk.
  Recovery lever if cron lags.
- **R-15.5 — Envelope mapping scope: wired flows only.** Per-domain wire mapping mirroring
  `src/server/bets/errors.ts` → `toWireError`, with the mapping table pinned in this plan.
  `docs/specs/error-codes.md` (the full 38-code catalogue) stays a named forward deliverable. The
  `error_`-prefix harmonization sweep stays forward work (SPEC.2 1.0.0 lock note); this stratum
  uses SPEC.1 §15 literal names for the flows it wires.
- **R-15.6 — Drift disposal split.** Riders **in this stratum**: SPEC.2 §4.2/§4.3 catalogue
  truth-up (paths + export names to as-built, composed-action row, stale `origin-check.ts` /
  `ALLOWED_ORIGINS` residues); the cron-count rider; the SPEC.2 §0 blockquote version one-liner;
  AGENTS.md §3/§6/§9 rows; the admin-login result-discarded loose thread (one-line page-wrapper
  fix + test). Re-homed **to the post-ENGINE.10 sweep**: SPEC.1 §10.1 `pool_unwind` phrasing;
  SPEC.2 §17.2:1612 row-8-incomplete sentence; Appendix-B enum-as-text convention; the §3
  single-source closer W-4 mention.

### Settled-by-spec register (cited rails — no rulings needed)

1. **Rate-limit: None on admin flows** — SPEC.2 §4.6 "F-RESOLVE-1/2/3, F-ADMIN-1/2/3/4/5 → None
   — admin path". The cron mirror carries the documented RL/idem exemption from the A-2 precedent
   (`r2-orphan-sweep/route.ts:21-24`).
2. **No Idempotency-Key on admin surfaces** — SPEC.2 §11 + §4.4: the header is a
   bet-Route-Handler contract; Server Actions rely on natural-key uniqueness. Here the natural key
   is the state machine: double-submitted settle fails on `['Resolving']` expectedStatus;
   double-submitted create fails slug uniqueness; double-submitted seed fails `['Draft']`.
3. **All admin mutations are Server Actions** — §4.1 family F5 + §4.2 + §8.7: the admin cookie is
   `Path=/admin`, so only `/admin/*` surfaces receive it. `validateAdminSession` at every action
   entry (Layer 2, CVE-2025-29927 posture) — discharges **SA-I-1**.
4. **Event ids: server-minted only** (**SA-M-1**). The wire mints the four resolution `*EventId`s
   at action entry (closed over — ADR-0016 D1) and never exposes any id parameter on the wire.
   `createMarket`'s optional `eventId` is **not supplied** by the wire (the service mints at entry
   — same property, zero exposure). `openMarket`/`closeMarket` mint internally as-built —
   compliant shape, no change. There is no shared `src/server/events/*mint*` helper; the
   convention is the raw alias `import { v7 as uuidv7 } from "uuid"` (B-8) — the wire mirrors it.
5. **Clock injection at the wire** (**D-14.e**): wrappers pass `now: new Date()` to lifecycle
   calls. The resolution quartet is clockless as-built (pre-dates D-14.e) — accepted, no retrofit.

---

## Plan-level decisions (D-15.a–g — subordinate to the rulings; reviewable at S4 execute)

- **D-15.a — Wrapper layout.** Thin `"use server"` action modules in `src/server/admin/markets/`
  (the §4.2-named F5 home), one file per flow, each: (1) `requireAdminSession()` gate, (2)
  zod-validate `FormData` inline (ADR-0008 convention), (3) build metadata once at entry, (4)
  mint any event ids, (5) inject `now`, (6) call the service, (7) map result/error to the §4.4
  Server-Action return shape, (8) `revalidatePath`. Services keep their exact signatures; **no
  `"use server"` is ever added to a service module** (it would expose raw service signatures —
  including caller-minted event-id params — as public endpoints, violating SA-M-1).
- **D-15.a-naming — `Action` suffix (battery B-1).** The services already own the bare names
  (`createMarket`, `closeMarket`, `correctResolution`, `voidMarket` all exist in
  `src/server/{markets,resolution}/`). To avoid an export-name collision, the new wire actions
  take the `Action` suffix — `createMarketAction`, `seedPoolAction`, `closeMarketAction`,
  `resolveMarketAction`, `correctResolutionAction`, `voidMarketAction` — mirroring the existing
  repo convention `adminLoginAction` / `adminLogoutAction`. `seedPoolAction` calls the `openMarket`
  service (seed rides `Draft → Open`, R-14.1 — there is no standalone seed service).
- **D-15.b — Shared wire module** `src/server/admin/wire.ts` (sibling to the existing
  `src/server/admin/actor.ts`): `requireAdminSession()` (wraps `validateAdminSession` +
  `cookies()`), `buildAdminMetadata({ flowId, request? })`, `canonicalizeAmount18(input)`
  (CR-3/SA-I-3), and `toActionError(err, flow)` (the wire-error mapper). Typed codes only — never
  raw `.message` serialization (**SA-L-3**); messages are display templates from the mapping table.
  `buildAdminMetadata` MUST produce exactly the 7 keys of `eventMetadataSchema`
  (`src/server/events/schemas.ts:289-297` — `request_id, flow_id, user_id, actor_id,
  idempotency_key, ip, user_agent`), with `actor_id: 'admin-singleton'` and `user_id: null` (also
  satisfies `assertAdminActor`), `idempotency_key: null` (admin actions carry no Idempotency-Key
  header), and `ip`/`user_agent`/`request_id` derived from `next/headers` reusing the existing
  `getClientIp` that `adminLoginAction` already uses (B-12).
- **D-15.c — Composed-resolve branch mechanism.** The action calls `triggerResolution` first; the
  trigger tx itself is the atomic gate (no TOCTOU pre-read). On a thrown `ResolutionStateError`
  the action branches on `err.observed` (confirmed exposed, readonly instance field —
  `src/server/resolution/errors.ts:48-66`, B-7): `observed === 'Resolving'` → proceed to
  `settleMarket` (the recovery resume — not an error); any other observed value → map to
  `illegal_edge`. No class change or message-parse needed. **Lifecycle note:**
  `MarketLifecycleStateError` carries NO observed/expected fields (B-7) — but the lifecycle wire
  doesn't need them, because each action knows its own flow (a state error from `seedPoolAction`
  means "not Draft" → `market_not_draft`; from `closeMarketAction` means "not Open" →
  `market_not_open`). The mapping keys off the calling action's flow, not off error fields.
- **D-15.d — Post-mutation revalidation.** Every successful mutation calls
  `revalidatePath('/admin/markets')` and `revalidatePath('/admin/markets/[marketId]', 'page')` so
  the unstyled pages never show stale state to the operator.
- **D-15.e — Pages are Server Components, zero client JS.** Direct Drizzle reads (read-only) for
  list + detail; forms bind actions directly. Action results surface via
  `redirect('/admin/markets/<id>?ok=<code>')` / `?error=<code>` and the page renders the message —
  the same minimal pattern the login-page fix (R-15.6) adopts. `useActionState` and client
  components are deliberately out (DESIGN-lane territory).
- **D-15.f — Form-bound constants** minted in `src/server/config/limits.ts` (UPPER_SNAKE_CASE
  convention, B-11; none exist yet — confirmed ABSENT): `MARKET_TITLE_MAX_CHARS`,
  `MARKET_DESCRIPTION_MAX_CHARS`, `RESOLUTION_REASON_MAX_CHARS`, `CLOSE_SWEEP_LOCK_TTL_SECONDS`.
  The three max-char values are safety bounds owned by the number-tuning pass (names pinned now);
  the lock TTL is provisional 55s (under the 1-minute cadence), HARDEN-tunable. They get an
  Appendix B registry row in the SPEC.1 rider (R-15-G) alongside the existing `COMMENT_MAX_LENGTH`
  + the §16.1 anti-abuse constants. Services today validate presence only (`trim() !== ""`, no
  ceiling) — SA-L-1 requires the ceiling at the form boundary, which the wire enforces.
- **D-15.g — Cron route contract.** `GET /api/cron/close-due-markets`: Bearer `CRON_SECRET`
  constant-time compare → distributed lock `getRedisKey("cron-lock","close-due-markets")` with TTL
  `CLOSE_SWEEP_LOCK_TTL_SECONDS` → `closeDueMarkets({ now: new Date(), metadata })` → in-body
  status with HTTP 200 for expected outcomes (`{status:"ok", closed, skipped}` /
  `{status:"locked"}` / `{status:"error"}` + Sentry capture), 401 bad bearer, 500 missing secret,
  503 lock-acquire throw — the A-2 mirror, including the documented RL/idem exemption comment.
  Metadata: `flow_id` `W-4-CLOSE`, `request_id` minted, `ip`/`user_agent` from the request headers
  (Vercel cron's own), `actor_id 'admin-singleton'`, `user_id null` (D-14.d standing).

---

## §Flows (per-action wire contract)

All six actions share the D-15.a step sequence. Per-flow specifics (every wire action lives in
`src/server/admin/markets/`, exports suffixed `Action`):

| Wire action — file | Flow id | Service call | Form fields (zod, inline) | Success data |
|---|---|---|---|---|
| `createMarketAction` — `create.ts` | F-ADMIN-1 | `createMarket` (markets/create.ts) — **no `eventId` supplied** | `slug`, `title` (≤TITLE_MAX), `description` (≤DESC_MAX), `resolutionDeadline` (datetime-local → Date) | `{ marketId, slug }` → redirect to detail |
| `seedPoolAction` — `seed.ts` | F-ADMIN-2 | `openMarket` | `marketId` (uuid), `seedAmount` (string → `canonicalizeAmount18`) | `{ poolId, seedAmount }` |
| `closeMarketAction` — `close.ts` | W-4-CLOSE (manual) | `closeMarket` | `marketId` (uuid) | `{ status: "Closed" }` |
| `resolveMarketAction` — `resolve.ts` | F-ADMIN-3 + F-RESOLVE-1 (composed) | `triggerResolution` → `settleMarket` (D-15.c) | `marketId`, `winningSide` (`YES\|NO`), `reason` (non-empty trim, ≤REASON_MAX) | `{ resolutionEventId, winningSide, totalPaidOut, poolUnwindAmount }` |
| `correctResolutionAction` — `correct.ts` | F-RESOLVE-2 | `correctResolution` | `marketId`, `correctedSide` (`YES\|NO`), `reason` (≤REASON_MAX) | `{ correctionEventId, betsAffected, uncollectableTotal }` |
| `voidMarketAction` — `void.ts` | F-RESOLVE-3 | `voidMarket` | `marketId`, `reason` (≤REASON_MAX) | `{ voidResolutionEventId, betsRefunded, poolUnwindAmount }` |

Event-id minting at the wire (B-8 — resolution ids are caller-supplied params, so the wire
imports `{ v7 as uuidv7 } from "uuid"` and pre-mints once at action entry, closed over for
retry-purity): `resolve.ts` mints `triggerEventId` + `settleEventId` (on the Resolving-resume
branch the `triggerEventId` goes unused — acceptable, ids are cheap and never wire-exposed);
`correct.ts` mints `correctEventId`; `void.ts` mints `voidEventId`. The markets quartet mints
internally; `createMarketAction` does not pass `eventId`, so the service mints.

**Pages** (`src/app/(admin)/admin/markets/`): `page.tsx` — table of all markets (slug, title,
status, deadline) + per-status counts, link to `new/` and per-row detail; `new/page.tsx` — create
form; `[marketId]/page.tsx` — full market record + the state-appropriate forms: seed (status
`Draft`), close (status `Open`), resolve (status `Closed` **or** `Resolving` — the resume
affordance, labeled "complete settlement" when `Resolving`), correct (status `Resolved`), void
(status `Open` or `Closed`). Forms for non-applicable states are not rendered; the service + state
machine remain the real gate (SPEC.1 §15.1 server-side enforcement posture).

---

## §Wire-error mapping (R-15.5 — wired flows only)

Return shape per SPEC.2 §4.4 Server Actions:
`{ ok: true, data } | { ok: false, error: { code, message, field_errors? } }`. Zod failures →
`code: "validation_error"` + `field_errors` per field. Typed codes only (SA-L-3). Server Actions
carry no HTTP status; the cron route does (D-15.g).

**Battery B-6 finding (load-bearing):** the `markets/errors.ts` classes (all 10) carry **no**
static wire metadata — plain `extends Error` with `this.name` only; the file header states "Wire
mapping is ENGINE.10's" (i.e. this stratum mints it). `resolution/errors.ts`:
`ResolutionSerializationExhaustedError` self-describes (`static httpStatus = 503`,
`retryAfterSeconds = 1`, `code = "error_resolution_serialization_exhausted"`); `ResolutionStateError`
and `CorrectionOutcomeError` carry no statics. So `toActionError` **supplies** the code for every
class except the two `*SerializationExhausted` ones, which it reads off the class.

| Service error | code | Notes |
|---|---|---|
| `MarketSlugInvalidError` / `MarketSlugTakenError` | `slug_invalid` / `slug_taken` | SPEC.1 §15 F-ADMIN-1 names |
| `MarketContentRequiredError` | `content_required` | |
| `MarketDeadlineInPastError` / `MarketDeadlineCeilingError` | `deadline_in_past` / `deadline_ceiling` | |
| `MarketSeedInvalidError` | `seed_invalid` | includes >18-dp wire rejections (pre-service) |
| `MarketLifecycleStateError` | `market_not_draft` (seed) / `market_not_open` (close) | per-flow mapping keyed off the calling action's flow — error carries no observed field (B-7) |
| `MarketDeadlineNotReachedError` | `deadline_not_reached` | manual close before deadline |
| `LifecycleSerializationExhaustedError` | `lifecycle_serialization_exhausted` | retryable; message says "try again" |
| `ResolutionStateError` | `illegal_edge` | except the D-15.c Resolving-resume branch, which is not an error |
| `CorrectionOutcomeError` | `correction_same_outcome` | R-9.3/OQ-3 surface |
| `ResolutionSerializationExhaustedError` | `error_resolution_serialization_exhausted` (read off class) | retryable, 503-semantic |
| `AdminActorError` | `admin_actor` | belt firing = wire bug; Sentry-captured |
| missing/invalid admin session | `admin_session_required` | newly enumerated F5 code |
| unknown | `error_internal` | Sentry capture; never `.message` passthrough |

**Partial-failure surface (R-15.3, money-adjacent):** on the composed path, trigger committed +
settle threw → the error message template for any settle-side failure appends the fixed clause
*"Market is now Resolving — resubmit to complete settlement."* The detail page independently shows
status `Resolving` with the resume-labeled form (D-15.e), so the recovery path is visible even if
the message is lost. Resubmission enters the D-15.c `observed === 'Resolving'` branch and settles.

---

## §State×Action matrix (worked example — hand-verified)

Expected envelope per current `markets.status` (rows) × action (columns). `ok` = success;
otherwise the code returned. Gate sources (recon §6): seed `['Draft']`, manual close `['Open']` +
deadline-reached, trigger `['Closed']`, settle `['Resolving']`, correct `['Resolved']`, void
`['Open','Closed']`.

| status \ action | seed | close (manual) | resolve (composed) | correct | void |
|---|---|---|---|---|---|
| Draft | **ok** → Open | `market_not_open` | `illegal_edge` | `illegal_edge` | `illegal_edge` |
| Open | `market_not_draft` | **ok**¹ → Closed | `illegal_edge` | `illegal_edge` | **ok** → Voided |
| Closed | `market_not_draft` | `market_not_open` | **ok** (2 tx) → Resolved | `illegal_edge` | **ok** → Voided |
| Resolving | `market_not_draft` | `market_not_open` | **ok** (settle only — resume) → Resolved | `illegal_edge` | `illegal_edge` (R-9.3) |
| Resolved | `market_not_draft` | `market_not_open` | `illegal_edge`² | **ok** → Resolved (new resolution_events row) | `illegal_edge` (R-9.3 — "all shall be resolved") |
| Voided | `market_not_draft` | `market_not_open` | `illegal_edge` | `illegal_edge` | `illegal_edge` |

¹ deadline-reached also required; else `deadline_not_reached`. ² the natural-key dedupe story for
a double-submitted resolve: the second submission fails here, cleanly.

**`canonicalizeAmount18` worked rows (CR-3/SA-I-3 — hand-verified):**

| input | output |
|---|---|
| `"100"` | `"100.000000000000000000"` |
| `"0.5"` | `"0.500000000000000000"` |
| `"01.50"` | `"1.500000000000000000"` |
| `"1.234567890123456789"` (18 dp) | unchanged |
| `"1.2345678901234567891"` (19 dp) | reject → `seed_invalid` (no rounding — money never rounds at the wire) |
| `"-5"`, `"0"`, `""`, `"1e3"`, `"1."` | reject → `seed_invalid` |

Canonical form: leading zeros stripped to one integer digit minimum, exactly 18 fractional
digits, `^[0-9]+\.[0-9]{18}$`, value > 0. Preserves the dataset string-identity property for any
input form; the canonical string is what `openMarket` receives and what the `market.opened`
payload records.

---

## §Actor retrofit (CF-6 — declared carve-out, C-3 doctrine)

`src/server/resolution/{trigger,settle,correct,void}.ts` each gain
`assertAdminActor(args.metadata)` at function entry + the import — mirroring the ENGINE.14
lifecycle pattern (SPEC.2 §3.8 "assert at service entry"). **Budget: ≤ 4 lines per file, 16 lines
total, zero other edits to ENGINE.9 files.** `src/server/resolution/transaction.ts` (W-3) is
byte-untouched. The belt is defense-in-depth behind the wrapper's correct metadata construction;
a firing belt is a wire bug (maps to `admin_actor`, Sentry-captured). This discharges the
`actor.ts:25-28` documented retrofit ("ENGINE.10 imports this same guard" — read ENGINE.15).

---

## §Test plan charter (RED-first; DB-backed unless noted)

Battery B-9 reconciliation: `tests/server/admin/` already holds the SPEC-acceptance-named files
`markets.test.ts`, `pool-seed.test.ts`, `resolution.test.ts`, `moderation/act.test.ts` (the
service-level acceptance tests from ENGINE.9/14). The wire-action surface (session gate, FormData
validation, envelope mapping, composed path) is a new concern. Default: **extend the existing
SPEC-named files** with `describe('<action> wire surface')` blocks; the genuinely-new cron +
actor-retrofit files are minted fresh. Execute confirms populated-vs-stub at S0 and extends or
fills accordingly.

1. **`tests/server/admin/resolution.test.ts`** (extend) — `resolveMarketAction` composed path:
   (a) Closed → ok, two events (`market.resolving` + `market.resolved`), status walk
   Closed→Resolving→Resolved, payout/ledger counts reusing ENGINE.9 fixtures at small scale; (b)
   **Resolving → ok, settle-only resume** (the partial-failure recovery proof — fixture enters
   Resolving via a direct `triggerResolution` call, then the action completes it); (c) Resolved →
   `illegal_edge` (double-submit dedupe); (d) no standalone trigger export anywhere under
   `src/server/admin/` (grep-style assertion); (e) session gate: no admin cookie →
   `admin_session_required`, zero writes. Plus `correctResolutionAction` (incl.
   `correction_same_outcome`) and `voidMarketAction` happy/illegal-edge rows.
2. **`tests/server/admin/markets.test.ts`** + **`tests/server/admin/pool-seed.test.ts`** (extend)
   — `createMarketAction` / `closeMarketAction` / `seedPoolAction` happy paths + per-flow
   validation rejections: title/description/reason max-length (SA-L-1 + ENGINE.9 `reason` row),
   the `canonicalizeAmount18` table above (every row), `deadline_not_reached` on early manual
   close, `market_not_draft` on double-seed. Asserts the `market.opened` payload carries the
   canonical 18-dp string.
3. **`tests/server/resolution/actor-assert.test.ts`** (NEW — sits next to the other resolution
   service tests) — each of the four resolution services throws `AdminActorError` on
   participant-shaped metadata (`actor_id` ≠ admin-singleton / `user_id` ≠ null); the
   wrapper-built metadata passes.
4. **`tests/server/cron/close-due-markets.test.ts`** (NEW — **mints a new convention**, see B-9
   flag below) — 401 bad bearer; 500 missing secret; 200 `{status:"locked"}` under held lock; 200
   `{status:"ok", closed:n}` with a past-deadline fixture (verifies `market.closed` event +
   status); sweep-throw → 200 `{status:"error"}` + Sentry capture (mirrors the orphan-sweep
   service-test posture).
5. **Login-result fix test** (R-15.6) — extend the existing admin-login test under
   `tests/server/auth/`: failed admin login surfaces `admin_login_invalid` on the page (redirect-param
   render), result no longer discarded.

**B-9 cron-route flag (carried loudly):** there is **no** route-handler test anywhere in the repo
— the r2-orphan-sweep *route* ships untested; only its `sweepOrphans` *service* is covered
(`tests/integration/orphan-sweep.integration.test.ts` + `tests/server/storage/`). Test 4 above
therefore mints a new `tests/server/cron/` convention rather than copying one. **Justification:**
`close-due-markets` is auth-bearing wire on a money-adjacent path (Bearer gate + lock + status
shape); "the precedent skipped it" is not a reason to skip it again. The `closeDueMarkets` service
is already ENGINE.14-tested, so test 4 covers only the new wire logic. (Founder-ratified to keep —
the alternative, service-only coverage matching orphan-sweep, was the rejected option.)

**Deliberately not tested, with rationale:** forcing a *mid-composed* settle crash
deterministically would require a failure-injection seam in `settleMarket`; we refuse the seam
(services byte-frozen beyond the 16-line belt). The Resolving-resume test (1b) exercises the
identical recovery semantics — the same code path the partial failure lands in.

Gate battery at execute re-runs the standing pre-PR five + the marked-test inventory by mechanism
(`only|skip|skipIf|todo|ctx.skip` — L-E14.1, delta-vs-BASE).

---

## §File plan + diff budget

**NEW (code):** `src/server/admin/wire.ts` ·
`src/server/admin/markets/{create,seed,close,resolve,correct,void}.ts` ·
`src/app/api/cron/close-due-markets/route.ts` ·
`src/app/(admin)/admin/markets/{page.tsx,new/page.tsx,[marketId]/page.tsx}`.
**NEW (tests):** `tests/server/resolution/actor-assert.test.ts` ·
`tests/server/cron/close-due-markets.test.ts`.
**EDITS (declared, exhaustive):** the 16-line resolution belt (§Actor retrofit) ·
`src/server/config/limits.ts` (+4 constants) · `vercel.json` (+1 cron entry) ·
`src/app/(admin)/admin/login/page.tsx` (result surfacing, ≤ 12 lines) ·
`tests/server/admin/{markets,pool-seed,resolution}.test.ts` + the `tests/server/auth/` admin-login
test (extend) · `docs/specs/SPEC.1.md` + `docs/specs/SPEC.2.md` + `AGENTS.md` (riders) ·
`docs/plans/ENGINE.15.md` (this plan) · `docs/logs/ENGINE.15.md` (at execute close).

**Diff budget:** ≈ 2,000 lines added (code + tests + docs) · ≤ 200 lines modified outside NEW
files, of which ≤ 16 in `src/server/resolution/` non-test code. Breach → halt, founder gate.
**Branch:** `feat/engine-15-wiring`. **No migration.**

---

## §Riders (same-commit at execute; before-text anchors grep-verified at S4 battery — B-1..B-5,B-10)

**SPEC.2 → 1.0.5** (+ change-log row; §0 version + blockquote fix folded):
- **R-15-A — §4.2 catalogue truth-up** (anchor SPEC.2:383-388): action export names → `*Action`;
  paths → as-built `src/server/admin/markets/*` (note `createMarket`/`seedPool` rows already
  pointed at `src/server/admin/markets/` — correct path, names updated; `resolveMarket`/
  `correctResolution`/`voidMarket` repath from `src/server/resolution/*` to the wire files);
  `resolveMarket` row marked composed (F-ADMIN-3 + F-RESOLVE-1) and the standalone
  `triggerResolution` row (SPEC.2:388, path `…/trigger-resolution.ts`) **struck** with a pointer
  to the composed action; `closeMarket` manual row added; invocation surfaces → the R-15.1 pages.
- **R-15-B — §4.3/§4-closer origin cleanup** (anchors SPEC.2:412 + :462): the §4.3 "Bet endpoint
  Origin defense" paragraph (`ALLOWED_ORIGINS`, `src/server/bets/origin-check.ts`) and the §4
  single-source closer line → the cross-cutting `src/server/middleware/origin-allowlist.ts` /
  `BETTER_AUTH_URL`-derived allowlist already canonical at §4.1:368 (which already documents the
  deprecation — these two are the stale residues). `origin-check.ts` does not exist on disk.
- **R-15-C — cron count** (anchor **SPEC.2:279, §3.4 Pattern A-2 — NOT §17.3**; battery B-3
  retarget): "No other Vercel Cron jobs in v1." → two jobs; names `GET /api/cron/close-due-markets`,
  per-minute class, tuning HARDEN. Also reconcile the §12.6:1168 restatement ("The single Vercel
  Cron HTTP-fanout job in v1 per ADR-0006"). The close-lag bound (R-14.3) is cross-referenced.
  ⚠️ The original kickoff said §17.3 — that is the Alarm-6 sub-table and contains no such
  sentence; an edit aimed there would touch the wrong section.
- **R-15-D — §0** (anchors SPEC.2:3 + :14): blockquote status string `1.0.3` → current version
  (live-confirmed at execute); version table → 1.0.5.

**SPEC.1 → 1.0.5** (+ change-log row):
- **R-15-E — §15 F-ADMIN-3 + §11 F-RESOLVE-1/2/3 Errors lines** (anchors: F-ADMIN-3 has NO Errors
  line, SPEC.1:881-887; F-RESOLVE-1 ABSENT :543; F-RESOLVE-2 = "None — append-only by
  construction" :556; F-RESOLVE-3 ABSENT :560): enumerate the wired codes from the mapping table.
  F-ADMIN-3 gains a composed-surface sentence (one admin gesture, trigger → settle, Resolving-
  resume recovery). **F-RESOLVE-2's "Errors: None" is corrected** (battery B-5) — the correction
  flow surfaces `CorrectionOutcomeError` → `correction_same_outcome` (you cannot correct a market
  to the side it already resolved to), so "None by construction" is incomplete. Pins the
  in-scope-but-unenumerated admin codes for exactly the wired flows (1.0.0 lock note honored — the
  full catalogue file stays forward).
- **R-15-G — Appendix B constant registry** (new): register `MARKET_TITLE_MAX_CHARS`,
  `MARKET_DESCRIPTION_MAX_CHARS`, `RESOLUTION_REASON_MAX_CHARS` as deferred-value constants
  alongside the existing entries (parallel to `BET_ATTEMPTS_PER_IP_PER_MIN` etc.). Values owned by
  the number-tuning pass.

**AGENTS.md** (descriptive — CC-authored at execute, web-reviewed; anchors B-10):
- **R-15-F — §3** route rows (anchor AGENTS.md:70 + prose :134 — both omit `bets/place`,
  `bets/sell`): add the cron route + admin pages + the missing bets rows (recon #7). **§6**
  bets-greenfield sentence (anchor :174 "the `bets/` handler is greenfield") truthed — the handler
  shipped. **§9** tests-tree rows (anchor :207-213; admin row :212 lists only `resolution.test.ts`,
  omits `markets.test.ts` + `pool-seed.test.ts`): add `tests/server/{cron}/`, the admin action
  blocks, and the omitted existing rows.

---

## Carry-forwards consumed / minted

**Consumed here:** CF-1 (cron wiring — R-15.2) · CF-6 + ENGINE.9 actor-assert handoff (§Actor
retrofit) · SA-I-1 (session gate every action) · SA-M-1 code half (server-mint-only; no
caller-supplied id wire-exposed → insertion-verify trigger never fires) · SA-L-1 + ENGINE.9
`reason` row (max-lengths) · SA-L-3 (typed codes) · CR-3/SA-I-3 (18-dp canonicalization) ·
AGENTS.md §9 rows · the composed F-ADMIN-3 endpoint (ENGINE.9 §3.6 handoff).

**Minted for later strata:**
1. Cron cadence + lock-TTL numeric tuning, plus close-lag (R-14.3) measurement → **HARDEN**.
2. Hub dashboard widgets (SPEC.1 §15.2), tabs shell, visual pass → **DESIGN/UI lanes**.
3. `docs/specs/error-codes.md` full catalogue + `error_`-prefix sweep → forward (post-wiring docs
   stratum / sweep decides owner).
4. Production conservation-gathering scoping (ENGINE.9 log carry-forward) → **ENGINE.10 / HARDEN**
   (unchanged owner).
5. R-15.6 sweep list: SPEC.1 §10.1 phrasing · SPEC.2 §17.2:1612 · Appendix-B enum-as-text · §3
   closer W-4 → **post-ENGINE.10 tracker sweep**.
6. Stale local/remote branch housekeeping (S1 register) → sweep, one line.
7. A route-handler test convention now exists (`tests/server/cron/`); the untested r2-orphan-sweep
   *route* could be backfilled to match → **HARDEN/sweep**, one line.

---

## Out of scope (stated so execute does not drift)

ENGINE.10 stress test · F-ADMIN-4/5 (moderation queue, audit search) and
`/api/admin/uploads/sign` · participant-facing surfaces & UI.12 · hub dashboard/tabs · any
styling/design tokens · `error-codes.md` · the `error_`-prefix sweep · economic number pinning ·
cron cadence tuning · migrations · any edit to W-1/W-3/W-4, `transitions.ts`, dharma modules,
events insert/schemas, Better Auth config, moderation pipeline, the bets endpoint stack
(read-only mirror only) · SSE/WS (absent by spec §4.3) · market content authoring.

## Open questions

None blocking. The S4 battery resolved B-6 (as-built error codes — mapping supplies all but the
two `*SerializationExhausted`) and B-7 (`ResolutionStateError` exposes `observed` — D-15.c branches
without a pre-read). No open items carry into execute.

## Execute ritual (full, no narrowing)

Fresh CC session + fresh web chat off this merged plan. `ultrathink`, gated-xhigh. S0 sync → S1
RED tests (@test-writer per charter) → S2 wire implementation to green → S3 pages + cron → S4
riders (docs same-commit) + self-audit incl. anchor re-grep → S5 reviewers (@code-reviewer →
@security-auditor, full branch; @db-migration-reviewer idle — no migration) → S6 §5.10 self-audit
+ five pre-PR gates + marked-test delta (L-E14.1) → S7 squash PR (`feat/engine-15-wiring`) +
session-log PR (`chore/engine-15-log`) + END-ON-MAIN + PK staging `~/Desktop/zz-pk-refresh-ENGINE.15/`
+ final report. Commit identity `Zugzwang/world <zugzwangworld@proton.me>`, `-F /tmp/engine15-*`
messages, zsh paste-cap discipline. Worked examples above hand-verified by web at the
corresponding gates.

## ADRs needed

None. ADR-0003/0010/0013/0015/0016 cover every decision; D-15.a–g are plan-level.

## References

SPEC.1 §11, §15 (1.0.4) · SPEC.2 §3.4, §3.6, §3.7, §3.8, §4.1–§4.7, §8.7, §11, §12.6 (1.0.4) ·
ADR-0003 · ADR-0010 · ADR-0013 · ADR-0015 · ADR-0016 · docs/plans/ENGINE.9.md §Rulings + §W-3a ·
docs/logs/ENGINE.9.md (security handoffs) · docs/plans/ENGINE.14.md (template + D-14.d/e) ·
docs/logs/ENGINE.14.md (CF register, SA/CR handoffs, L-E14.1/2) ·
src/app/api/cron/r2-orphan-sweep/route.ts (A-2 precedent) · src/server/bets/endpoint.ts +
errors.ts (wire convention mirrored) · src/server/events/schemas.ts:289-297 (eventMetadataSchema).
