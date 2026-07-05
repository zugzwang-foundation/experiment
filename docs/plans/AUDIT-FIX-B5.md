# AUDIT-FIX-B5 — Event-sourcing completeness (A13 + A30)

**Scope:** A13 (moderation gate-block emits no `events` row) + A30 (`insertEvent`
silently drops a same-`event_id`/different-payload reinsert). **A22 is a separate
task — auth/identity/session code is OUT OF SCOPE here.**

**Branch:** `fix/audit-fix-b5` off `main`@`e3f0569`. Critical path (moderation) —
full gated ritual: failing-first tests → implement → `@test-writer` →
`@code-reviewer` → `@security-auditor`. No `db-migration-reviewer` (no DDL —
`event_type`/`aggregate_type` are `text`/TS-union edits). **NOT ultracode.**

**No migration.** `events.event_type` is a `text` column and `aggregate_type` is a
TS union (`src/server/events/insert.ts`); a new event type / aggregate type is a
same-commit `EVENT_TYPES` + Zod-schema + union edit, never `ALTER TYPE`/DDL.

---

## A13 — emit `moderation.blocked` on every gate-block branch

`src/server/moderation/consequences.ts::recordGateBlock` opens one `db.transaction`
that writes `mod_actions` (always) + `users.banned_at` (track_a) + `image_uploads →
blocked` (image flow) and calls `insertEvent` **zero times** — violating SPEC.2 §3.7
(every state-mutating flow emits ≥1 `events` row in the same tx) + §7.5 (F-MOD-*
write set = `mod_actions` + `events`).

**Design (ratified):**

- **`schemas.ts`** — add `"moderation.blocked"` to `EVENT_TYPES` (23→24) +
  `eventPayloadSchemas["moderation.blocked"] = z.object({ userId: uuid, reason:
  enum(track_a_autoban|track_b_blocked|sexual_minors_text_blocked), banned:
  z.boolean(), uploadId: z.string().uuid().nullable() })`. **OMIT `categoryScores`**
  (duplicates `mod_actions.categories`, which already ships).
- **`insert.ts`** — extend the `AggregateType` union with `"mod_action"` (8→9) +
  update the "8 values" docstring to 9.
- **`consequences.ts`** — inside the existing tx (~L82), after the `mod_actions …
  RETURNING id` (so `row.id` is always available), ONE `insertEvent(tx, {
  eventType: "moderation.blocked", aggregateType: "mod_action", aggregateId:
  row.id, payload: { userId, reason, banned: outcome === "track_a", uploadId:
  imageUploadId ?? null }, metadata })` on **all three** branches
  (`track_a_autoban`, `sexual_minors_text_blocked`, `track_b_blocked`). Emit
  `eventId` minted once at function entry (`uuidv7()`).
- **metadata — Option (b) placeholder pattern** (no signature change; mirrors
  `logout.ts`/`tos-accept.ts`): `user_id = actor_id = userId`; `request_id = ip =
  user_agent = "unknown"`; `idempotency_key = null`; `flow_id = "F-MOD-1"` for
  `track_a`, `"F-MOD-2"` for the two `track_b` branches (SPEC.1 §14 F-MOD-1/F-MOD-2).
  The automated gate is a participant-self-actor event (`actor_id = userId`), a
  distinct column from `mod_actions.actor_id` which stays `"system"`.
- **Do NOT** touch the dormant `image_upload.blocked` type or its §19.4.1 row.
- **Inventory-pin updates (23→24):** `tests/server/events/insert.test.ts` — the
  array at L624-654 (add `"moderation.blocked"`) **and** the `.toBe(23)` at L655 +
  the domain-breakdown comment; `tests/server/admin/markets-media.test.ts:320`
  `.toBe(23)` + its comment.

## A30 — observability guard on the composite ON CONFLICT

`src/server/events/insert.ts` L125-137 runs `INSERT … ON CONFLICT (event_id,
created_at) DO NOTHING` with no `RETURNING` — a same-`event_id`/different-payload
reinsert is silently dropped (§7.7 composite target is already correct; only the
silent-drop is the gap).

**Design (ratified):**

- Add `RETURNING event_id`. Happy path → 1 row → no extra work. Gate the rest on
  `rows.length === 0`.
- On 0 rows (conflict fired): SELECT the existing row's `payload` in the SAME tx
  (`WHERE event_id = … AND created_at = …`, both composite keys). **No row found**
  (conflicting row committed outside this SERIALIZABLE snapshot; ON CONFLICT dedupes
  at index level regardless of snapshot) → cannot-compare → **STAY SILENT**
  (fail-open), NOT a mismatch. **Row found** → deep-compare via `canonicalize`
  (default import, per `idempotency/cache.ts`; jsonb key-order is not preserved, so
  a raw string compare would false-mismatch).
- **Mismatch** → `safeCaptureException(new Error("event_id_reuse_payload_mismatch"),
  { tags: { kind: "event_id_reuse_payload_mismatch", event_id, differing_keys:
  "<comma-joined key NAMES>" } })` — key NAMES only, NEVER payload values (PII);
  fail-open, never alters control flow. **Match** → SILENT (the §7.3 same-id/
  same-payload retry-dedup must still succeed with no capture and no throw).
- Extract the pure decision as `comparePayloads(incoming, existing|null) →
  { mismatch, divergentKeys }` (exported) so all three arms unit-test deterministically.

---

## Failing-first tests

- **A13** (`tests/server/moderation/`): route-integration (real emit, test
  Postgres) — `track_a` (banned:true, uploadId set w/ image) · text-only
  `sexual_minors_text_blocked` (banned:false, uploadId:null) · `track_b_blocked`
  (banned:false); each asserts exactly one `moderation.blocked` row,
  `aggregate_type='mod_action'`, `aggregate_id === mod_actions.id`, payload +
  metadata (user_id=actor_id=userId, flow_id). **Atomicity** (separate file,
  `insertEvent` mocked to throw): the whole tx rolls back — no `mod_actions` row,
  no ban.
- **A30** (`tests/server/events/`): unit `comparePayloads` all three arms (differing
  → mismatch+keys · same/diff-key-order → silent · null → silent); DB-backed —
  same-id/different-payload reinsert fires the capture (assert tag + raw payload NOT
  in ctx) · same-id/same-payload retry dedups silently (no capture, no throw).

## Web-authored spec text (dropped in verbatim, SAME commit, authored by web)

§7.1 aggregate_type Notes (`, mod_action`) · Appendix **B.13** aggregate_type
(` / mod_action`) · §19.4.1 `moderation.blocked` STRIP row · §10 step-5 rider ·
§17.2 alarm-2 sibling-capture tag-note (`event_id_reuse_payload_mismatch`).

## Verify

`ZUGZWANG_ENV=preview just verify` + full-suite `pnpm vitest run` (critical path;
catches the EVENT_TYPES inventory pins). STOP AT PR — operator merges after web
reads the diff.
