# AUDIT-FIX-B5 — session log (close-out)

**Stratum:** AUDIT-FIX-B5 — event-sourcing completeness (A13 + A30) · **State:** MERGED to `main` · **Date:** 2026-07-05
**Canonical SHA:** `01a9d0c63468d6aa062ffbf62642c007d4707947` (PR #205 squash on `main`)
**Plan:** `docs/plans/AUDIT-FIX-B5.md` (committed `a8927f9`, ratified) · **Reviewed fix tip:** `487bbc5` (tree-content proof `git diff 487bbc5 origin/main -- <B5 files>` = EMPTY → fused-CTE tree landed intact)

---

## What landed (files + PR#)

PR **#205** (squash `01a9d0c`). Three branch commits collapsed: `a8927f9` (plan) · `be758a4` (A13 + A30 original) · `487bbc5` (A30 fail-open fix). **No migration** — `events.event_type` is a `text` column and `aggregate_type` is a TS union; the additions are same-commit `EVENT_TYPES` + Zod-schema + union edits, never DDL.

- `src/server/events/schemas.ts` — new `moderation.blocked` EVENT_TYPE (23→**24**) + payload schema `{ userId, reason, banned, uploadId }`.
- `src/server/events/insert.ts` — `AggregateType` +`mod_action` (8→**9**; docstring `B.14`→`B.13` corrected); the A30 guard (fused-CTE, below); exported `comparePayloads`.
- `src/server/moderation/consequences.ts` — `recordGateBlock` emits `moderation.blocked` inside its tx on all three block branches.
- `docs/specs/SPEC.2.md` — five same-commit spec touches (below).
- Tests: `tests/server/moderation/moderation-blocked-event.test.ts` (+ `-atomicity`), `tests/server/events/insert.mismatch.test.ts`, inventory-pin updates in `insert.test.ts` + `markets-media.test.ts` (23→24).

### A13 — moderation gate-block now event-sourced
Closes SPEC.2 §3.7 (every state-mutating flow emits ≥1 `events` row in the same tx) + the §7.5 F-MOD-* write set for the gate-block path. One `moderation.blocked` per invocation, inside the existing `db.transaction`, on all three branches: `track_a_autoban`, `sexual_minors_text_blocked`, `track_b_blocked`.
- `aggregate_type = 'mod_action'`, `aggregate_id = mod_actions.id`.
- payload `{ userId, reason, banned (= outcome === 'track_a'), uploadId (image_uploads row id or null) }` — raw `imageR2Key` (embeds userId) + `categoryScores` (duplicates `mod_actions.categories`) deliberately excluded.
- metadata = **option (b) placeholder** (no signature change; the `logout.ts`/`tos-accept.ts` pattern): `user_id = actor_id = userId`, `request_id = ip = user_agent = "unknown"`, `idempotency_key = null`, `flow_id = F-MOD-1` (track_a) / `F-MOD-2` (both track_b). Distinct from `mod_actions.actor_id`, which stays `'system'`.

### A30 — silent divergent-payload drop, now guarded (fused-CTE)
The composite `ON CONFLICT (event_id, created_at) DO NOTHING` is **retained** (retry-idempotency, §7.3). The observability guard detects a same-`event_id`/different-payload reinsert and fires a fail-open `safeCaptureException` (tag `event_id_reuse_payload_mismatch`, `event_id` + differing key **names** only — never PII values). Same-`event_id`/same-payload retry dedups silently. Delivered via a **single-statement data-modifying CTE** (`WITH ins AS (INSERT … DO NOTHING RETURNING 1 AS inserted) SELECT (SELECT count(*) FROM ins)::int AS inserted_count, (SELECT payload FROM events WHERE …) AS existing_payload`); gate on `inserted_count === 0`; only the pure `comparePayloads` + capture run in a try/catch. `::int` on `count(*)` is load-bearing (postgres-js decodes bare `bigint` as a string).

### Spec touches (all same-commit)
- **§7.1** + **Appendix B.13** `aggregate_type` — `+ mod_action` (B.13 is the `events` classification; B.14 is `identity_pool` — the earlier code docstring's `B.14` ref was corrected).
- **§19.4.1** — `moderation.blocked` STRIP row (strips `payload.userId`; `reason`/`banned`/`uploadId` SHIP).
- **§10** step-5 — emit rider (the gate-block branch now writes an `events` row).
- **§17.2** alarm-2 — A30 sibling-capture tag-note; **re-tightened in the fix commit** to the fused-CTE wording (the two-statement re-SELECT wording is gone, replaced by "MUST NOT be reintroduced").

---

## Decisions made

- **A30 delivery = fused-CTE, not two-statement.** The ratified plan prescribed a two-statement re-SELECT; that was superseded at the web diff-read gate (see the load-bearing lesson). SPEC.2 §17.2 is canonical for the shipped design.
- **A13 metadata = option (b) placeholder** (writer takes no request-scoped metadata; `ip`/`ua` are STRIP_KEY at export regardless). Option (a) — threading real request metadata — was rejected as a signature change with no research value.
- **`categoryScores` omitted** from the `moderation.blocked` payload (duplicates the already-shipping `mod_actions.categories`).
- **No `db-migration-reviewer`** — no DDL.

## ⚠️ Load-bearing lesson of B5 — the A30 fail-open violation (a reviewer-cascade miss)

The **original two-statement re-SELECT** was a fail-open violation: `ON CONFLICT … DO NOTHING` is a *healthy no-op* (the caller's tx is NOT aborted), so the extra observability re-SELECT could abort an **otherwise-committable** caller transaction — e.g. `statement_timeout` (57014) under lock contention on the bets path, which is **outside** the ADR-0013 retry set `{40001, 40P01}` and would surface as a user-facing bet failure. The "obvious fix" (swallow the re-SELECT) was worse: swallowing a SERIALIZABLE `40001` yields a silent `COMMIT`-on-aborted-tx rollback → data loss the retry never sees.

**This passed the FIRST reviewer cascade** (`@code-reviewer` + `@security-auditor` both accepted the "SELECT outside the try so 40001 retries" rationale) and was **caught at the web diff-read gate** — a human review checkpoint AFTER the automated cascade. The **directed re-gate** (strictly-sequential cascade with an explicit fail-open scope) corrected it: fuse the read into the write so there is no separate post-write statement that can fail. **Takeaway:** an observability read placed inside a caller's transaction is fail-open ONLY if it cannot independently fail the transaction — fold it into the write statement, and always run the reviewer cascade *sequentially* with a directed scope when a helper is on a shared hot path. The concurrent first-cascade run also masked flakiness (three reviewer subagents' vitest saturating local Postgres → random "Hook timed out" failures).

## Surprises caught + fixed in-session

1. **Auth-test-mock fallout** — a `.length` read on `tx.execute` crashed 3 auth tests (`tos`/`logout`/`admin-login`) whose minimal `@/db` mocks return `undefined` from `execute`; fixed by fail-open access (later subsumed by the CTE's `rows?.[0]`). Caught by the full-suite gate, not targeted runs.
2. **`B.14 → B.13`** — the `insert.ts` `AggregateType` docstring cited the wrong appendix for the `events` classification; corrected.
3. **The A30 fail-open violation** (above) — the headline surprise, caught at the web gate.
4. **`existing_payload`-NULL-on-conflict is a defensive belt, not a live path** (`@test-writer`) — under the callers' fixed-snapshot isolation, `ON CONFLICT` against a row outside the snapshot raises `40001 → retry`, not a silent NULL; the code comment now says so.

## Open questions

- None blocking. Two recorded **non-blocking LOWs** (below).

## Non-blocking LOWs (recorded)

**(a) Plan-doc staleness.** `docs/plans/AUDIT-FIX-B5.md` still describes the superseded two-statement A30 design. **SPEC.2 §17.2 is canonical.** The plan is left as the point-in-time ratified record; this log documents the supersession — do not retro-edit the plan.

**(b) FUTURE-WORK GATE (PII).** The A30 capture logs payload key **names** (`differing_keys`). This is PII-safe **only** because all **24** current event payloads use fixed, code-defined field names. **Before any future `z.record()`-keyed (user-controlled-key) event payload lands, the key-name capture in `src/server/events/insert.ts` MUST be re-evaluated** — such keys would leak user data through the Sentry tag. This is an explicit gate on future event-type work; a one-line guard comment now sits at the capture site (this PR).

## Next session starts at

**A22** (the split-out task; not started). Scope from the B5 verify-live recon:
- **Live signup diverges from SPEC.2 §3.5.** The two-transaction F-AUTH-3 architecture (a `identity/assign.ts` SERIALIZABLE tx that consumes the pool + inserts the user + emits `user.pseudonym_assigned`) is **not built**: pool consumption is folded into Better Auth's `user.create.before` hook (`src/server/identity-pool/consume.ts`, its own tx, *before* the userId exists). The §3 SSOT names a non-existent `src/server/identity/assign.ts`; §3.7's CI-lint dir list names `identity` (built dir is `identity-pool`). **Web must reconcile §3.5 / §3-SSOT / §3.7 against the built path before any emit lands.**
- **Three §8.8 participant auth events are missing** (`user.oauth_signed_in`, `user.otp_signed_in`, `user.pseudonym_assigned`); `user.tos_accepted` + `user.signed_out` already emit. All three missing emits sit on **Better-Auth-owned mutations with no in-house in-tx after-hook** → each needs a **new §7.5.1 V3 carve-out** (post-commit micro-tx, the `logout.ts` precedent) — a **founder decision**. First verify whether Better Auth 1.6.11 exposes a same-tx `session.create.after`.
- **No migration** for A22 either — the three event types already exist in `EVENT_TYPES` and §19.4.1 already carries their STRIP rows.

## Context to preserve

- **PK drag-in owed (post-merge, this task's tail):** stage md5-verified canonical copies of `docs/specs/SPEC.2.md` + `docs/logs/AUDIT-FIX-B5.md` from `origin/main` into `~/Desktop/zz-pk-refresh-B5/` after this close-out PR merges.
- **A21 log PR #204** (`77943dc`) merged — the previously-parked A21 close-out log is now on `main`.
- Local Postgres `:54322` is the pre-PR critical-path gate; run `pnpm vitest run` directly (not `just`, which targets the cloud DB). Run reviewer subagents **sequentially** to avoid DB-saturation flakiness.

## Time

Single execute session on 2026-07-05: verify-live recon → plan → RED tests → A13 + A30 (two-statement) → cascade → PR #205 → web diff-read gate flagged the A30 fail-open → directed re-gate + fused-CTE fix → merge (`01a9d0c`) → this close-out.
