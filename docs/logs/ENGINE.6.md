# ENGINE.6 — plan-mode close-out

> Stratum plan-mode close-out per CLAUDE.md §5.9. Events helper +
> per-event-type Zod schemas + bulk migration of 7 accumulated
> `TODO(ENGINE.6)` stub sites. Execute chat opens against the plan
> committed here.

- **Task:** ENGINE.6 (plan-mode phase)
- **Closed:** 2026-05-25
- **Branch:** `plan/engine-6` (cut from `origin/main` at `8723fa5`)
- **Plan commit:** `dde3f7c` — `plan(engine-6): plan-mode draft + verdicts [ENGINE.6]`
- **PR:** TBD (execute chat opens against this plan; PR lands at execute close)
- **Plan:** `docs/plans/ENGINE.6.md` (committed `dde3f7c`)
- **Critical path:** YES (touches `src/server/auth/` per CLAUDE.md §1)
- **Authority chain followed:** CLAUDE.md §1–§8 + AGENTS.md §1–§11 + SPEC.2 §3.7 + §7.1–§7.7 + §8.8 + §17 + ADR-0005/0007/0008/0015/0016 (substance in SPEC.2 §0.1 per `project_adr_catalogue_framing` memory)

---

## What landed

1 file added on `plan/engine-6` at `dde3f7c`:

- **`docs/plans/ENGINE.6.md`** (489 lines) — ratified plan covering:
  - §A per-event-type Zod schemas (`src/server/events/schemas.ts`)
  - §B helper (`src/server/events/insert.ts`) with concrete TypeScript shape
  - §C `src/lib/errors.ts` extension (2 new DomainError subclasses)
  - §D.1–§D.6 per-site migration with concrete code shapes
  - §E SPEC.2 same-commit amendments (4 items)
  - §F tests (helper + migration-site, ~720 LOC total)
  - §G event_type addition contract (single-SoT enum hygiene)
  - File-touch inventory (~1100 LOC stratum)
  - Per-domain commit sequence (7 commits)
  - Verification posture (§5.10 audit + §5.11 reviewer calls)
  - Anticipated SURPRISES table (7 IDs)

Plus this close-out log (separate commit).

---

## Decisions made

### Q-verdicts ratified at plan-mode

- **Q1** (helper signature): **Option A** — single generic `insertEvent<T extends EventType>(tx, input)` with `satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>` map. Locked at SPEC.2 §7.7; ratified grounded in 11-string enum + TS `^5` `satisfies` support.
- **Q2** (error handling): Research brief §7 table is complete surface. Helper throws on Zod fail + non-UUIDv7 event_id; Postgres errors propagate (ON CONFLICT IS the retry primitive per LD-8).
- **Q3** (`schemas.ts` organization): Single-file at 11 entries (below brief's ≥20 split threshold).
- **Q4** (migration ordering): Per-domain commits (7-commit sequence) for git-blame ergonomics + per-site rollback affordance.

### Boundary verdicts (locked at brief §1)

- B1 (event QUERY helpers): NO — ADR-0005 file map names only `insert.ts` + `schemas.ts`.
- B2 (replay mechanism): NO — testnet-phase concern.
- B3 (new observability sinks): NO — ADR-0007 + SPEC.2 §17 own sinks.

### LD-1 canonical inventory (struck `r2_delete_failed`)

11-string canonical enum (4 image + 5 user + 2 admin) ratified. `image_upload.r2_delete_failed` from operator-substrate Layer 1 Finding 3 struck per WC ratification — deferred to SCAFFOLD.5 Sentry surface (observability signal, not state-transition event). 6 emit sites in ENGINE.6 + 5 schema-only registrations for future-stratum consumers (DEBATE.2 + future Better Auth hook stratum).

### Same-commit SPEC.2 amendments queued for execute (§E)

1. **§7 [STUB] body lift** — verify-then-amend at execute (brief claims STUB present; Phase 1 read showed full prose).
2. **§7 post-mutation observation carve-out** (new paragraph after §7.5) — names the logout.ts V3 carve-out where Better Auth `signOut` owns the originating mutation and emission lands in a separate post-commit tx with audit-trail-gap accepted.
3. **§8.8 admin.signed_out addition** — codifies the event_type that exists in code but is missing from §8.8 enum.
4. **§7.1 aggregate_type enum extension** — adds `admin_session` as the 7th canonical aggregate_type (after `market`, `bet`, `comment`, `user`, `dharma_account`, `system`).

### Variances from brief

- **Brief §2 §D inventory mismatch absorbed.** Brief said "5 image-upload + 6 auth-flow ≈ 11 stub sites". Repo grep at Phase 2 found 7 stub sites covering 6 distinct event_types. Authoritative reconciliation per SCAFFOLD.15 close-out line 144 (4 image_upload event_types named, 2 future-stratum) + SPEC.2 §8.8 (6 auth event_types named, 3 of those lack current emission sites). Corrected to **11-string canonical enum, 6 emit + 5 schema-only**.
- **SCAFFOLD.15 helper refactor absorbed (SURPRISE-A).** `signUploadAndInsert` currently does INSERT + `mintPutUrl` (HTTP) + TODO. Adding emission inside a tx would force HTTP-in-tx (CLAUDE.md §3 refusal). Plan §D.1 absorbs the refactor: helper takes `tx`, returns `{uploadId, key}`; route orchestrates `tx` + `mintPutUrl` separately. ~45 LOC absorbed in stratum scope per CLAUDE.md §7 cleanup absorption rule.
- **V3 (synchronous emission) carve-out for logout.ts.** Better Auth `signOut` owns the session deletion in its own tx; emission lands in a separate post-commit tx. Audit-trail gap on process-crash between mutation and emission accepted (session deletion is idempotent). Same-commit SPEC.2 §7 amendment names the carve-out.
- **S-F WC correction at Phase 4** — admin events use `admin_sessions.session_id` (UUIDv7 PK) as `aggregate_id`, not synthesized `ADMIN_SINGLETON_UUID`. Aggregate is the row being mutated, not the actor; admin-actor identity lives in `metadata.actor_id = 'admin-singleton'` (JSONB, no UUID constraint). `aggregate_type = 'admin_session'` becomes the 7th SPEC.2 §7.1 enum entry. Original plan had synthesized-UUID fallback; corrected at Phase 4 review.

---

## Surprises caught + fixed in-session

Per `feedback_audit_surprises` memory — full chain, not buried.

### Brief-time (carried into plan-mode; resolved in plan)

- **Brief count mismatch (5+6→4+5+2 = 11, 6 stubbed).** Surfaced at Phase 2 grep; reconciled against SCAFFOLD.15 close-out + SPEC.2 §8.8. WC ratified at Phase 2 close.
- **`r2_delete_failed` carry-forward strike.** WC ratified deferral to SCAFFOLD.5 (observability signal, not state event).

### Plan-time (new in this chat; resolved before commit)

- **SURPRISE-A (sign_requested double-stub).** Resolved in plan §D.1: helper refactor separates INSERT-in-tx from `mintPutUrl` HTTP call. Both stub sites collapse to one emission inside tx.
- **SURPRISE-B (universal no-tx-context at all 7 stub sites).** Resolved per-site in plan §D.1-§D.6 (move-into-existing-tx / wrap-in-new-tx / V3 carve-out / per-row micro-tx for cron).
- **Sweep-orphans sequencing inversion attempted by WC verdict.** Pushed back at Phase 3 close: WC's proposed (a) `deleteObject` → (b) tx{UPDATE+insertEvent} was the ordering that SCAFFOLD.15 security-auditor MEDIUM #1 explicitly rejected (re-opens TOCTOU window). Re-proposed and ratified: tx{UPDATE-CAS + insertEvent} → tx commits → THEN `deleteObject`. Locked in plan §D.6 with explicit ordering call-out.
- **SURPRISE-F (aggregate_id/actor_id conflation in original §D.3 + §E.4).** WC-caught at Phase 4 review. Plan originally had synthesized ADMIN_SINGLETON_UUID fallback; corrected to use `admin_sessions.session_id` (UUIDv7 PK) per S-F WC correction. SPEC.2 §7.1 amendment added `admin_session` as 7th aggregate_type.

### Carry-forward (deferred, surfaced for awareness)

- **S-C (metadata 7-field set not built at handler entries).** None of the 6 emit sites have request-context middleware populating the canonical 7-field set. Plan accepts `'unknown'` placeholders at emit; HARDEN.* sweep adds middleware to populate at handler entry. ENGINE.6 surfaces and defers — not a stratum scope expansion.
- **S-G (SPEC.2 §7 [STUB] marker).** Brief claims §7 is still [STUB]; Phase 1 read showed full §7.1-§7.7 prose. §E.1 is verify-then-amend at execute; non-blocking.

### Cleared

- **S-D (SPEC.2 §22.2 design-independence carve-out).** Cosmetic; verify at execute drafting.
- **S-E (TS `satisfies` support).** `package.json` has `"typescript": "^5"`; `satisfies` (TS 4.9+) compiles. Cleared at Phase 1.

---

## Open questions

None blocking. S-G (verify-at-execute §7 [STUB] marker) handled by §E.1 verify-then-amend. S-C deferred to HARDEN.* explicitly.

---

## Next session starts at

**ENGINE.6 execute chat** (new web Claude chat paired with new Claude Code session).

- CC cuts `feat/engine-6-events-helper` from `plan/engine-6` at `dde3f7c`.
- Phase 2 starts with **`test-writer` reviewer call** per CLAUDE.md §5.6 — failing tests first against the §F test plan (helper tests + 6 migration-site tests, ~720 LOC).
- Implementation follows per-domain commit sequence (7 commits per Q4 verdict) in plan §"Per-domain commit sequence".
- Same-commit SPEC.2 §E amendments land in the SPEC amendment commit.
- Pre-PR audit (§5.10) + `code-reviewer` + `security-auditor` reviewer calls (§5.11) before PR opens against `main`.
- Plan path for execute chat: `@docs/plans/ENGINE.6.md`.

---

## Context to preserve

- **Plan branch:** `plan/engine-6` (this commit `dde3f7c`). Execute branch `feat/engine-6-events-helper` cuts from here.
- **11-string canonical enum locked.** 6 emit + 5 schema-only registrations. `r2_delete_failed` NOT in enum (SCAFFOLD.5 owns).
- **TODO inventory** (7 grep hits, 6 distinct event_types) catalogued with file:line in plan §D's per-site walk:
  - `src/app/api/uploads/sign/route.ts:123` + `src/server/storage/sign-upload.ts:80` (same event, helper refactor collapses to one)
  - `src/server/storage/sweep-orphans.ts:127`
  - `src/server/auth/tos-accept.ts:128`
  - `src/server/auth/logout.ts:20`
  - `src/server/auth/admin/login.ts:180`
  - `src/server/auth/admin/logout.ts:30`
- **SCAFFOLD.15 helper refactor is non-optional** (SURPRISE-A). Skipping it leaves HTTP-in-tx risk for every future emit site to re-discover. ~45 LOC absorbed in ENGINE.6 stratum scope.
- **Sweep-orphans ordering is load-bearing.** Plan §D.6 locks UPDATE-CAS-in-tx → tx commits → THEN deleteObject. Preserves SCAFFOLD.15 security-auditor MEDIUM #1 fix. Inverting the order re-opens W-2/sweep TOCTOU.
- **Admin events:** `aggregate_type = 'admin_session'`, `aggregate_id = admin_sessions.session_id` (UUIDv7 PK; `cookie.value` at logout site already carries it; `RETURNING session_id` at login site). `metadata.actor_id = 'admin-singleton'` in JSONB per SPEC.2 §3.6. SPEC.2 §7.1 §E.4 amendment adds `admin_session` to aggregate_type enum.
- **Logout V3 carve-out:** capture `userId` via `getSession` BEFORE Better Auth's `signOut` (session is deleted, userId unrecoverable afterwards). `if (userId)` guard suppresses emission for no-session sign-out calls.
- **Cron emit site is V3 carve-out variant:** sweep-orphans cron has no handler-entry; `eventId` generated per-row inside the tx (not at handler entry per ADR-0016 D1). Per-row generation is the cron analog; V2 retry-safety holds since each tx is independent.
- **S-C deferred:** none of the 6 emit sites have the canonical 7-field metadata built at handler entry. Plan accepts `'unknown'` placeholders; HARDEN.* sweep adds request-context middleware. Each emit site's `'unknown'` count documented at audit (§5.10).
- **No new SCAFFOLD.5 / HARDEN.* dependencies introduced** — events helper is the standalone primitive; observability wiring (Sentry alarm 2 on DEFAULT-partition writes) is SCAFFOLD.5 scope; CI lint enforcing helper invocation is HARDEN.* scope.
- **No new ADR.** ENGINE.6 consumes accepted ADRs (0005, 0007, 0008, 0015, 0016); ADR file backfill remains queued maintenance per `project_adr_catalogue_framing` memory.

---

## Time

~5 hours plan-mode total across two days:

- 2026-05-24: brief-drafting (web Claude only; no CC pair); plan-mode chat opens evening — Phase 0 read of briefs (delayed pending brief drop) + Phase 1 §6 prereq verification + Phase 2 TODO inventory + WC ratification of 11-string + scope verdicts.
- 2026-05-25: Phase 3 plan drafting + Phase 4 audit + WC S-F correction (aggregate_id/actor_id conflation) + sweep-orphans ordering push-back + ExitPlanMode + commit.

---

## Tracker note

Tracker update is operator-side per `project_tracker_external` memory — CC notes plan-mode close here; tracker HTML lives in web-Claude project knowledge.

---

*Closed against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft (with 4 same-commit amendments queued for execute) + ADRs 0003–0016 (cited but not re-litigated). Authority chain: CLAUDE.md §1–§8 + AGENTS.md §1–§11.*
