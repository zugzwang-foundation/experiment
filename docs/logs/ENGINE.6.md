# ENGINE.6 — execute close-out

> Stratum close-out per CLAUDE.md §5.9. Events helper + per-event-type
> Zod schemas + 6-site emission migration + 4 same-commit SPEC.2
> amendments + 2 Checkpoint-4-absorption SPEC + runbook commits.
> Supersedes the plan-mode close-out at this same path (committed
> `5e13c1d`) — both are preserved in git history.

- **Task:** ENGINE.6 (execute phase)
- **Closed:** 2026-05-25
- **Branch:** `feat/engine-6-events-helper-zod-schemas` (cut from
  `plan/engine-6@5e13c1d`)
- **PR:** TBD — opened post this commit
- **Plan:** `docs/plans/ENGINE.6.md` (committed `dde3f7c` on
  `plan/engine-6`; ratified end-of-plan-mode)
- **Critical path:** YES (touched `src/server/auth/` per CLAUDE.md §1)
- **Authority chain followed:** CLAUDE.md §1–§8 + AGENTS.md §1–§11 +
  SPEC.2 §3.7 + §7 (§7.1–§7.7 + new §7.5.1) + §8.8 + §17 + §19.4 +
  new §19.4.1 + Appendix B.14 + ADR-0005/0007/0008/0014/0015/0016
  (substance in SPEC.2 §0.1 per `project_adr_catalogue_framing` memory)

---

## What landed

**16 commits since branch cut from `plan/engine-6@5e13c1d`** (14
execute-chat commits + the 2 plan-mode commits that came in via the
branch cut). This close-out log commit adds the 17th.

### New files (7)

- **`src/server/events/insert.ts`** (~150 LOC) — Option A single
  generic `insertEvent<T extends EventType>(tx, input)` helper +
  `EventInsertInput<T>` interface + new `AggregateType` literal union
  (8 values) per Checkpoint 4 absorption.
- **`src/server/events/schemas.ts`** (~135 LOC) — `EVENT_TYPES` const
  array of 11 canonical strings + per-event-type `eventPayloadSchemas`
  hand-rolled Zod map (`as const satisfies Record<EventType,
  ZodObject>`) + `eventMetadataSchema` 7-field set per SPEC.2 §3.7.
- **`tests/server/events/insert.test.ts`** (~500 LOC) — 17 driver
  tests including all-11-EVENT_TYPES coverage + tx atomicity +
  retry-with-same-eventId ON CONFLICT dedupe + multi-event
  composability + LD-1 inventory shape probe.
- **`tests/server/events/insert.guards.test.ts`** (~390 LOC) — 23
  guard tests: per-EVENT_TYPE Zod rejection (11) + non-UUIDv7 eventId
  (`InvalidEventIdError`) + 7-field metadata rejection + envelope
  shape + zero-rows-on-rejection.
- **`tests/server/events/insert.probe.test.ts`** (~310 LOC) — 7
  probe tests: UUIDv7-derived `createdAt` (V2) ×2 + composite-PK
  `ON CONFLICT` (V1) + partition routing (named + DEFAULT) +
  bound-tx-only signature + V4 metadata-passthrough (Checkpoint 1
  absorption).
- **`tests/server/storage/sign-upload-event.test.ts`**, **`sweep-
  orphans-event.test.ts`**, **`tests/server/auth/admin-login-event.
  test.ts`**, **`admin-logout-event.test.ts`**, **`logout-event.test.
  ts`**, **`tos-accept-event.test.ts`** — 34 migration-site tests
  across the 6 emit sites (plan §F `-event.test.ts` convention).
- **`docs/runbooks/BREAK_GLASS.md`** (~110 LOC stub) — pre-dataset-
  release admin rotation procedure + suspected-compromise rotation
  + HARDEN.10 scope marker. Resolves Checkpoint 4 security-auditor
  MEDIUM (admin cookie sessionId leak) at the operational layer.
- **`docs/runbooks/dataset-release.md`** (~80 LOC stub) — 11-step
  2026-11-06 release checklist anchored on the new SPEC.2 §19.4.1
  STRIP rules + spot-check templates for verifying payload PII strip
  at export.

### Modified files (10)

- **`src/lib/errors.ts`** (+~40 LOC) — `InvalidEventPayloadError` +
  `InvalidEventIdError` added to the discriminated `DomainError`
  registry. `DomainErrorKind` union extended (9 → 11).
  `toEnvelope()` overridden to return `{ error: 'error_internal' }`
  for both (programming-error surface). `ErrorEnvelope` interface
  exported.
- **`src/server/storage/sign-upload.ts`** (~+25 LOC) — SURPRISE-A
  absorption: `tx` required, `eventId` + `metadata` threaded,
  returns `{uploadId, key}` only, emits `image_upload.sign_requested`
  inside the helper-bound tx, `mintPutUrl` removed from helper.
- **`src/app/api/uploads/sign/route.ts`** (~+20 LOC) — orchestrates
  `db.transaction(...)` + post-tx `mintPutUrl` per CLAUDE.md §3 (no
  HTTP-in-tx).
- **`src/server/storage/sweep-orphans.ts`** (~+45 LOC) — per-row
  micro-tx wraps UPDATE-CAS + insertEvent. `deleteObject` runs AFTER
  tx commits (SCAFFOLD.15 MEDIUM #1 ordering preserved). `eventId`
  per-row, hoisted ABOVE the `db.transaction(...)` call at Checkpoint
  3 stylistic recommendation for symmetry with other 5 emit sites.
- **`src/server/auth/tos-accept.ts`** (~+25 LOC) — emission inside
  existing SERIALIZABLE tx, atomic with the `UPDATE users` acceptance
  evidence. Tab-race + checkbox-unchecked + onboarding-ref-missing
  branches skip emission as test contract requires.
- **`src/server/auth/logout.ts`** (~+50 LOC) — V3 carve-out:
  `getSession` BEFORE `signOut` (userId unrecoverable afterwards) +
  post-commit micro-tx via `db.transaction(...)` per the V3 carve-out
  amendment landing at SPEC.2 §7.5.1. The ONLY post-commit emission
  site across all 6 sites.
- **`src/server/auth/admin/login.ts`** (~+46 LOC) — S-F load-bearing:
  `attemptAdminSessionReplace(eventId, metadata, ip)` signature gains
  3 params. Inside the SERIALIZABLE retry tx, after the
  `INSERT-RETURNING session_id` captures `sessionId`, calls
  `insertEvent` with `aggregate_type = 'admin_session'`, `aggregate_id
  = sessionId`. `metadata.user_id = null` + `metadata.actor_id =
  'admin-singleton'`. **NOT** `ADMIN_SINGLETON_UUID`.
- **`src/server/auth/admin/logout.ts`** (~+40 LOC) — DELETE wrapped
  in `db.transaction`, insertEvent inside tx. `aggregate_id =
  cookie.value` (the `admin_sessions.session_id` UUIDv7 PK stored at
  login). `cookieStore.delete` OUTSIDE tx (response-shaping).
- **`docs/specs/SPEC.2.md`** (~+50 LOC total across 4 commits)
  amended in 7 places across §7.1, §7.5.1 (NEW subsection), §8.8,
  §19.4.1 (NEW subsection), B.14 — see "SPEC.2 same-commit
  amendments" below.
- **`package.json` + `pnpm-lock.yaml`** — `zod 3.25.76` added as
  direct dep (was transitive via drizzle-zod; vitest module
  resolver doesn't surface transitives). Literal patch pin per
  `feedback_vendor_dep_literal_pins` memory.

### Existing tests re-baselined (3)

- `tests/integration/sign-upload.integration.test.ts` — full rewrite
  for the SURPRISE-A new `signUploadAndInsert(tx, args)` shape.
- `tests/integration/orphan-sweep.integration.test.ts` — afterEach
  TRUNCATE extends to `events` table (additive only).
- `tests/server/auth/logout.test.ts` — additive `mockAuthApiGetSession`
  for forward-compat with the V3 carve-out impl (existing 6 tests
  remain GREEN).

### Test state at PR-open

- **288 tests pass** + 1 skipped (R2-roundtrip probe, default-OFF) +
  5 todo (pre-existing TBD markers; not introduced by ENGINE.6) + 0
  failed. 44 test files.
- `pnpm tsc --noEmit`: clean (0 errors).
- `pnpm biome check tests/`: clean (0 warnings).
- `pnpm vitest run`: 19.6s.
- `pnpm build`: not run per AGENTS.md §2 (CI handles on PR merge).

---

## Decisions made

### Q-verdicts ratified at plan-mode (held at execute)

- **Q1** Option A single generic helper (held). `EventInsertInput<T>`
  + `satisfies Record<EventType, ZodObject>` map. Verified ergonomic
  at 6 emit sites; no Option B/C pressure surfaced.
- **Q2** Helper error handling per research brief §7 table (held).
  Zod fail → `InvalidEventPayloadError`; non-UUIDv7 → `InvalidEventIdError`;
  Postgres errors propagate.
- **Q3** Single `schemas.ts` file at 11 EVENT_TYPES (held).
- **Q4** Per-domain commits (held). Final commit sequence: 6
  per-site commits + helper + tests + amendments + cleanup +
  Checkpoint absorptions.

### Same-commit SPEC.2 amendments

| § | Commit | Amendment |
|---|---|---|
| §7 [STUB] lift (§E.1) | `b85dab5` | **NO-OP** — grep at execute showed zero `[STUB]` markers in SPEC.2; brief's S-G STUB claim was stale at brief-drafting. Non-blocking. |
| §7.5.1 V3 carve-out (§E.2) | `b85dab5` | NEW subsection. Verbatim plan §E.2 paragraph + contract note: adding another V3 carve-out requires same-commit amendment + handler docstring. |
| §8.8 `admin.signed_out` (§E.3) | `b85dab5` → `350fe7b` | First commit added `admin.signed_out` + aggregate encoding; second commit reframed the routing prose (unified `events` table per ADR-0005 §4, retain `user_events` + `admin_events` Drizzle tables for future use). |
| §7.1 `admin_session` (§E.4) | `b85dab5` → `350fe7b` | First commit added `admin_session` (S-F correction). Second commit added `image_upload` (SURPRISE-5 — see below). §7.1 now lists 8 aggregate_type values. |
| §19.4.1 per-payload-key STRIP rules (Checkpoint 4) | `350fe7b` | NEW subsection. Per-event-type STRIP rules for all 11 event_types per security-auditor CRITICAL absorption. Fix locus is the export-pipeline spec, NOT runtime emission. |
| B.14 `events.payload` STRIP_KEY note | `350fe7b` | Updated to reference §19.4.1. `aggregate_id` row note extended for `admin_session` defense-in-depth via `BREAK_GLASS.md` rotation. |

### Variances from plan

- **Sweep-orphans eventId hoist** (`a93de7f`). Plan §D.6 placed
  `eventId = uuidv7()` INSIDE the per-row tx callback. Hoisted to
  the for-loop body BEFORE `db.transaction(...)` for symmetry with
  the other 5 emit sites (sign-upload route, tos-accept, admin/login,
  admin/logout, logout — all generate `eventId` before opening their
  respective tx). Behaviorally equivalent: cron has no retry surface
  so V6's ON-CONFLICT-dedupe property doesn't apply, and each per-row
  tx is independent. Operator ratified at Checkpoint 3.
- **§7.1 enum extension scope expanded 7 → 8** (`350fe7b`). Plan §E.4
  added `admin_session`. Checkpoint 4's AggregateType literal-union
  narrowing forced explicit enumeration and surfaced `image_upload`
  as the missing 8th value — runtime code at §D.1 (sign-upload) +
  §D.6 (sweep-orphans) was already emitting with this aggregate_type
  but spec hadn't caught up. Same-commit absorption at `350fe7b`.
- **`AggregateType` literal union narrowing** (`cc4d9e5` + test
  fixture follow-up at `5032073`). Checkpoint 4 defense-in-depth.
  `EventInsertInput.aggregateType` narrowed from `string` to a
  closed 8-value union. Test-fixture `Case`/`BadCase` types updated
  to import + use `AggregateType`.
- **zod 3.25.76 added as direct dep** (`b5c0a96`). zod was a
  transitive dep via drizzle-zod 0.7.1 (zod ^3.24.1 peer); vitest's
  module resolver doesn't surface transitives. Literal patch pin
  per project memory. Implicit plan §B authorization (Zod usage is
  intrinsic to the helper contract).
- **test-fixture probe-createdAt-uses-uuidv7-not-now fix** (`b5c0a96`).
  Test-writer wrote `pastMs = Date.UTC(2026, 5, 1)` which was only
  ~7 days from current execution date (2026-05-25); assertion
  required > 30 days. Reset to `Date.now() - 365 days` for robust
  CI execution across any date.

### Same-commit absorption rule (CLAUDE.md §7)

- **SURPRISE-A** (SCAFFOLD.15 helper refactor) absorbed at §D.1
  (commit `34ebc19`).
- **Checkpoint 4 CRITICAL** (dataset-export PII leak via
  `events.payload`) absorbed at the spec layer (§19.4.1 + B.14 +
  BREAK_GLASS + dataset-release runbook). NOT at runtime emission
  code — operator's framing correction: audit trails remain
  exhaustive at runtime (INV-4 + ADR-0005 sync-target rule); export
  pipeline strips selectively.
- **Checkpoint 5 lint cleanup** (14 ENGINE.6-introduced
  `noNonNullAssertion` warnings + 1 unused import) absorbed at
  `825c293` per-line `// biome-ignore` directives.

---

## Surprises caught + fixed in-session

Per `feedback_audit_surprises` memory — full chain, not buried.

### Carry-forward from plan-mode (resolved at execute or earlier)

- **SURPRISE-A** (sign_requested double-stub) — plan §D.1 resolution
  applied at `34ebc19`. ~45 LOC absorbed.
- **SURPRISE-B** (universal no-tx-context at all 7 stub sites) —
  per-site resolutions per §D.1–§D.6.
- **S-F** (aggregate_id/actor_id conflation for admin events) —
  applied at `b27096a` (admin/login) + `3df0b8d` (admin/logout).
  Zero `ADMIN_SINGLETON_UUID` functional references (only 1 negation
  comment at `admin/login.ts:99`).
- **S-G** (SPEC.2 §7 [STUB] marker) — grep at execute confirmed no
  STUB present. §E.1 amendment NO-OP. Non-blocking.

### New at execute time

- **SURPRISE-T1 / T2 / T3 / T4 / T6** (test-writer Phase 2 advisory
  surfaces) — all benign; documented in plan-log + Checkpoint 1
  ratification. Trivially-passing negative-path tests become
  discriminating post-impl; additive forward-compat mock rebases.
- **SURPRISE-T5** (load-bearing for §D.3) — `attemptAdminSessionReplace`
  confirmed at test-writer Phase 2 as **two separable statements**
  (`tx.execute(DELETE)` then `tx.execute(INSERT-RETURNING)`), NOT a
  single CTE. The kickoff's S-F RETURNING-vs-CTE risk cleared
  preemptively. §D.3 threading was mechanical.
- **SURPRISE-Postgres-Date** (Phase 3 helper) — Date binding via
  `${createdAt}` trips `ERR_INVALID_ARG_TYPE` in postgres-js
  extended-protocol mode. Fixed at `b5c0a96` via
  `${createdAt.toISOString()}::timestamptz` explicit cast.
- **SURPRISE-zod-transitive** (Phase 3 helper) — zod is a transitive
  dep via drizzle-zod but vitest's module resolver doesn't surface
  transitives. Added as direct dep with literal patch pin at
  `b5c0a96`.
- **SURPRISE-Checkpoint-4-CRITICAL** (security-auditor) — dataset-
  export PII leak via `events.payload`. Operator framing correction:
  fix locus is export-pipeline spec, not runtime emission. Absorbed
  at `350fe7b` (§19.4.1 + B.14) + `cc4d9e5` (runbooks + AggregateType).
- **SURPRISE-5** (§7.1 enum extension scope drift) — plan-mode
  review §3 S-F correction added `admin_session` to §7.1 but did
  not also flag `image_upload` as a parallel new aggregate_type
  needed there. Caught at Checkpoint 4 via the AggregateType
  literal-union narrowing (forcing explicit enumeration). Same-
  commit absorption at `350fe7b`.

### Cleared at Phase 7 audit

- **Phase 7 Biome-warning dismissal** initially claimed 14
  `noNonNullAssertion` warnings were "pre-existing pattern across
  many test files." Checkpoint 5 grep verification showed zero
  pre-existing occurrences; all 14 were ENGINE.6-introduced. Fix
  absorbed at `825c293`.

---

## (A) Terminology + process corrections (six items)

Logged across Checkpoints 1-5 for future-stratum methodology.

1. **Plan-mode review chat-close §5 sweep-orphans sequence-direction**
   (caught Checkpoint 1). Chat-close described `delete-then-tx`
   ordering while claiming SCAFFOLD.15 preservation; plan §D.6 +
   shipped SCAFFOLD.15 code at `src/server/storage/sweep-orphans.ts`
   actually implement `UPDATE-CAS-then-delete`. The chat-close's
   ordering language was inverted. Plan + code are authoritative.

2. **Plan-mode review chat-close §3 admin_sessions.id "Postgres-
   native default" phrasing** (caught Checkpoint 2). SCAFFOLD.3 code
   uses JS-side `uuidv7()` template interpolation in the INSERT
   VALUES clause (`${uuidv7()}` from the `uuid` npm package),
   NOT Postgres-side `uuidv7()` SQL function call. Functionally
   equivalent UUIDv7; terminology precision matters for retry-safety
   mental models.

3. **Kickoff "ON CONFLICT dedupes on SERIALIZABLE retry" framing**
   (caught Checkpoint 2). Wrong threat surface. The 40001 path is
   **tx atomicity** (prior attempt's INSERT + insertEvent both roll
   back together; nothing to dedupe). ON CONFLICT protects a
   **different threat**: handler-level re-entry after a committed
   prior row (e.g., framework retry, client double-fire). Per-handler
   `eventId` stable; per-attempt `session_id` distinct.

4. **V6 framing precision** (caught Checkpoint 3). Cron-loop
   `eventId` placement (before vs inside tx callback) is stylistic;
   both satisfy V2 retry-safety since each per-row tx is independent.
   Sweep-orphans hoist commit `a93de7f` matches the 5-other-emit-
   sites convention.

5. **§7.1 enum extension scope drift** (caught Checkpoint 4).
   Plan-mode review §3 S-F correction added `admin_session` to
   SPEC.2 §7.1 but did NOT also flag `image_upload` as a parallel
   new aggregate_type needing §7.1 inclusion, even though §D.1 +
   §D.6 emit with that value. Process improvement: future strata
   introducing emit sites with new aggregate_types should
   enumerate ALL new values in the same-commit §7.1 amendment
   scope, not just the immediately load-bearing one.

6. **Verify-don't-trust applies to lint warnings too** (caught
   Checkpoint 5). Phase 7 self-audit initially dismissed 14
   `noNonNullAssertion` warnings as "pre-existing pattern across
   many test files." Grep verification at Checkpoint 5 showed zero
   pre-existing occurrences; all 14 were ENGINE.6-introduced. Future
   self-audits should grep-verify any "pre-existing pattern"
   dismissal claim before accepting it as boilerplate-absorption.

## (B) Discipline data point — reviewer-subagent ROI

The Checkpoint 4 security-auditor CRITICAL was the kind of
multi-month-impact bug not catchable by test suite + self-audit
alone. The leak would have only manifested at the 2026-11-06 public
dataset release; by then the payload shapes would have been baked
into the live database for ~5 months and the released archive would
be permanent. ~45 minutes of reviewer + same-commit absorption work
prevented a permanent dataset PII regression spanning every
participant's signup IP / user-agent + raw `users.id` UUID + R2 key
embedding userId. Justifies the reviewer-subagent cost line-item.

The code-reviewer's verdict ("merge-ready") on the runtime emission
surface complemented this — independent confirmation that the
helper-level + per-site code passes the 7 V-points + Drizzle/SQL
contracts + transaction-handle threading + admin/participant
structural separation. Two reviewers catching disjoint concerns.

## (C) LOC variance — tests came in at ~3000 LOC vs plan §F budget of ~720

Plan §F estimated ~720 LOC tests (350 helper + 370 migration-site).
Actual landed: ~3000 LOC across 9 new + 3 rebased test files. **~4x
over budget.**

Variance drivers:
- All-11-EVENT_TYPES driver coverage (per the discriminated-union
  exhaustiveness, not per-emit-site coverage).
- Per-field metadata rejection guards (7 separate tests, not 1
  composite "missing field" test).
- Per-payload-field Zod rejection guards (11 tests, one per
  event_type).
- Full integration rebaseline of sign-upload (not delta-edit) because
  the function signature changed shape.
- SQL probe tests for partition routing + ON CONFLICT shape.

Future stratum sizing: **budget 3-4× naive LOC estimate when a
helper has discriminated-union payload validation across N event
types.** The per-event-type test surface scales roughly linearly with
N, plus a constant per-field metadata probe surface.

## (D) Variances from plan summary

Two formally tracked:

1. **Sweep-orphans eventId hoist** (`a93de7f`) — for symmetry with
   other 5 emit sites; behaviorally equivalent; ratified Checkpoint 3.
2. **§7.1 enum extended 7 → 8** to add `image_upload` — Checkpoint 4
   absorption; the runtime code was already emitting with that
   value before the spec caught up.

Plus the absorbed-during-execution surfaces (zod direct-dep, test-
fixture date fix, Date-binding workaround, V3 carve-out applied) all
align with plan or are spec-extensions documented in this log.

---

## Open questions

None blocking.

Deferred to HARDEN.* / DATASET.* / SCAFFOLD.5 per code-reviewer LOWs
+ security-auditor MEDIUMs + SURPRISEs:

- **HARDEN.* request-context middleware** — populate `metadata.request_id`
  + `metadata.ip` + `metadata.user_agent` at handler entry for the 6
  emit sites currently passing `'unknown'` placeholders (S-C deferral).
- **HARDEN.* `flow_id` closed-enum narrowing** — per security-auditor
  MEDIUM 3; `flow_id` is currently `z.string()` accepting any value;
  narrow to the SPEC.1 §13 F-* catalogue.
- **DATASET.* / HARDEN.* export-pipeline implementation** — per-
  payload-key strip lambdas reading SPEC.2 §19.4.1 table.
- **HARDEN.10 BREAK_GLASS authoring** — replace ENGINE.6 stub with
  full procedure per ADR-0010 + SPEC.2 §21.3.
- **SCAFFOLD.5 Sentry wiring** — replace `console.error('orphan_sweep_per_row_failure', ...)`
  + `console.error('openai_moderation_auth_failure', ...)` with
  Sentry `captureException` + tags.
- **Future stratum addition of `user_events` + `admin_events` writes**
  — if any future site needs the subdivision per §8.8 prior prose;
  ENGINE.6 codifies unified `events` table per ADR-0005 §4 as the
  default for new emit sites.

---

## Next session starts at

**Choose next stratum from tracker.** ENGINE.6 unblocks:

- **DEBATE.2 (placeImageComment Server Action)** — consumes
  `image_upload.committed` + `image_upload.blocked` schema-only
  registrations + adds those emit sites at the W-2 commit path.
- **Better Auth hook stratum (TBD task ID)** — adds emit sites for
  `user.oauth_signed_in`, `user.otp_signed_in`,
  `user.pseudonym_assigned` schema-only registrations.
- **HARDEN.* request-context middleware** — populate the S-C
  placeholders at handler entry across the 6 emit sites.

Per tracker authority (`project_tracker_external` memory): operator-
side decision on next stratum.

---

## Context to preserve

- **The 7 V-points are concretely verified in this PR at file:line.**
  Future strata that touch `src/server/events/` or add emit sites
  should re-verify against the audit checklist in this log.
- **AggregateType literal union (8 values)** is the type-level
  defense against future-stratum drift. Adding a new
  aggregate_type is now a one-line edit in `src/server/events/insert.ts`
  + same-commit SPEC.2 §7.1 + B.14 amendment.
- **§19.4.1 per-payload-key STRIP rules** are the dataset-release
  privacy contract for `events.payload`. Future strata adding event
  types MUST extend §19.4.1 in the same commit. The `BREAK_GLASS.md`
  + `dataset-release.md` runbooks are the operator-side companion.
- **Sweep-orphans ordering (UPDATE-CAS-then-delete)** is load-bearing
  per SCAFFOLD.15 MEDIUM #1 + plan §D.6. Inverting it reopens the
  W-2/sweep TOCTOU window. The shipped sweep-orphans.ts file header
  documents the ordering rationale; do NOT invert.
- **V3 carve-out is the ONLY post-commit emission site** (logout.ts).
  Adding another carve-out requires same-commit SPEC.2 §7.5.1
  amendment + handler docstring per the contract added at `b85dab5`.
- **No `ADMIN_SINGLETON_UUID` constant in the codebase.** Admin
  aggregate_id uses `admin_sessions.session_id` (UUIDv7 PK); admin
  actor identity carries in `metadata.actor_id = 'admin-singleton'`
  (JSONB string per SPEC.2 §3.6). The single grep hit at
  `admin/login.ts:99` is a negation comment, deliberately preserved
  per Checkpoint 2 operator ratification.
- **Reviewer-subagent calls are worth the cost.** Checkpoint 4
  security-auditor caught a dataset-export PII leak that would have
  been permanent post-2026-11-06. ~45 min of reviewer + absorption
  work. Apply the discipline at every critical-path stratum.

---

## Time

~7-8 hours execute across one continuous session 2026-05-25:

- Phase 1 (branch setup + §6 prereqs): ~15 min
- Phase 2 (test-writer reviewer call): ~30 min subagent + ~15 min
  Checkpoint 1 ratification + V4 probe addition
- Phase 3 (helper + schemas + errors): ~45 min including the
  Date-binding + zod-transitive-dep fixes
- Phase 4 (6 emit sites across 4.1–4.6): ~60 min + Checkpoint 2
  + Checkpoint 3 ratification cycles
- Phase 5 (SPEC.2 same-commit amendments §E.1–§E.4): ~20 min
- Phase 6 (2 reviewer subagent calls in parallel + Checkpoint 4
  absorption — 4 SPEC + 2 runbook + 1 code-narrowing): ~90 min
- Phase 7 (pre-PR self-audit + Checkpoint 5 absorption): ~30 min
- Phase 8 (this log + PR open): ~30 min

Reviewer-subagent calls (Checkpoint 4) were the single most valuable
~45-minute spend in the session — see (B) above.

---

## Tracker note

Tracker update is operator-side per `project_tracker_external`
memory — CC notes execute close-out here; tracker HTML lives in
web-Claude project knowledge. Operator marks ENGINE.6 status as
`done` on merge.

---

*Closed against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft amended same-PR
(§7.5.1 V3 carve-out + §7.1 + §8.8 + §19.4.1 + Appendix B.14) +
ADRs 0003–0016 (cited but not re-litigated). Authority chain:
CLAUDE.md §1–§8 + AGENTS.md §1–§11.*
