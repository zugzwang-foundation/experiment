# ENGINE.0 — Event-type vocabulary expansion (forward-stratum payload schemas)

> **Status:** executing
> **Date:** 2026-06-03
> **Author:** Hrishikesh + Claude Code (execute tab)
> **Critical-path?** Borderline — `src/server/events/` is **not** in CLAUDE.md §1's enumerated critical paths, but the vocabulary registered here is consumed by every §1 module (`bets`/`comments`/`dharma`/`resolution`). The full ritual (tests-first via `@test-writer` → `@code-reviewer` → `@security-auditor`) is run per the execution kickoff.
> **Plan PR / commit:** this file commits before Phase 2 (CLAUDE.md §5.1).

> **Provenance note.** This plan was reconstructed from the reconciled *inline* content of the ENGINE.0 execution kickoff (payload shapes + amendments A1–A5, A6 retracted + the web event-name ruling + the verbatim `numericString` definition). The kickoff cited a committed plan at `.claude/plans/engine-0-cc-plan-mode-harmonic-fiddle.md`; that file exists nowhere readable by the execution chat (no `.claude/plans/` dir, absent from `git log --all` and `~/Downloads`). Per the web source-of-truth correction, the inline kickoff content is authoritative and the missing file is moot.

---

## Tracker context

`tracker_v11`: **ENGINE** lane = `ENGINE.0 + ENGINE.2–12 (ENGINE.1 → ENGINE.0)` (SPEC.2 §0 / tracker rows). ENGINE.0 is the event-vocabulary foundation: it registers the per-`event_type` payload Zod schemas that the forward strata emit. F-BET-1..10 (ENGINE.7–8), F-RESOLVE-1/2/3 + F-DEBATE-3 (ENGINE.9), and the Dharma issuance path (ENGINE.5) consume these schemas via `insertEvent`.

**Dependency status at plan time:** ENGINE.6 (the `insertEvent` helper + the canonical 11-string enum + `eventMetadataSchema`) is **landed** (`src/server/events/{insert,schemas}.ts` on disk). ENGINE.0 is purely additive on top of it. No other dependency.

## Approach (one paragraph)

Add 11 new `event_type` strings + their per-type payload Zod schemas to `src/server/events/schemas.ts`, plus one new exported `numericString` validator for the `NUMERIC(38,18)` money/share/price fields. This is a **type-only / shape-only** change: no business logic, no schema/migration, no edit to `insert.ts` (the helper already keys validation off `eventPayloadSchemas[eventType]`), and the existing 11 entries are untouched. The `as const satisfies Record<EventType, …>` clause makes the 11 additions tsc-enforced (a string without a matching schema fails the type-check). TDD: `@test-writer` first expands the round-trip driver + inventory floor to 22 (RED), then implementation turns it GREEN.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no — registration only | `bet.placed` + `comment.placed` shapes are *registered*; atomicity is the SERIALIZABLE bet transaction at ENGINE.7/8, not this payload schema. | n/a here (`tests/invariants/I-ATOMICITY-*` at ENGINE.7/8) |
| 2.2 Dharma non-transferable / no overdraft (INV-2) | partial — *exactness* only | All Dharma/money fields use `numericString` (exact base-10 string), **never `z.number()`** — preserving the CLAUDE.md §2 "no JS floats for balances" rule so amounts survive the Zod→jsonb boundary without double-precision drift. Conservation / no-overdraft is business logic deferred to ENGINE.5/8. | `tests/server/events/insert.test.ts` round-trip CASES assert the exact string survives jsonb (`row.payload` `toEqual` payload) |
| 2.3 Side frozen at comment-time (INV-3) | no — registration only | `comment.placed.side` is *registered*; immutability is `comments.side_at_post_time` + its trigger, not this schema. | n/a here (DEBATE.2) |
| 2.4 Resolutions append-only (INV-4) | no — registration only | `market.resolved/corrected/voided` + `payout.settled` shapes are *registered*; append-only is the `events`/`resolution_events`/`payout_events` Bucket-A triggers. **A6 retracted:** `correctsEventId`/`resolutionEventId` reference `resolution_events.id` per SPEC.2 §3.6 (ENGINE.9 wires the referent; the field stays `z.string().uuid()`). | n/a here (`tests/db/triggers/*` + ENGINE.9) |

No invariant is *enforced* by this task — it registers shapes the enforcing strata consume. The one substantive guarantee is INV-2 *exactness*: `numericString` (not `z.number()`) is the boundary that keeps balances/prices/shares exact.

---

## 2. Data model changes

**None — type-only.** No table, column, index, FK, enum, constraint, partition, or migration. The change is confined to `src/server/events/schemas.ts` (TS + Zod). **HARD STOP honored:** no new `dharma_entry_type` (the signup-grant tag is punted to ENGINE.5); the `events` table, `payout_type`/`dharma_entry_type` pgEnums, and all migrations are untouched. If implementing any shape "strictly needs" a schema/migration change, STOP and surface — it is a scope breach.

## 3. API surface

**No HTTP endpoints / Server Actions / route handlers.** The "surface" is three exported symbols in `schemas.ts`, consumed by `insertEvent` and future emit sites (ENGINE.5/7/8/9):

1. **`numericString`** (new export) — placed top of `schemas.ts`, after imports / before `EVENT_TYPES`:
   ```ts
   export const numericString = z
     .string()
     .regex(/^-?\d{1,20}(?:\.\d{1,18})?$/, "must be a NUMERIC(38,18) decimal string");
   ```
   Single **signed** validator: `≤20` integer digits (precision−scale = 38−18) + `≤18` fractional ⇒ `≤38` significant digits; canonical form (leading integer digit required → `"0.5"` not `".5"`); plain decimal only (no exponent, no leading `+`). Reused on every money/share/price/delta field. Per-field positivity/sign (`stake > 0`, `payout ≥ 0`) is **business logic, deferred to ENGINE.5/8**; `dharmaDelta` is explicitly signed.

2. **`EVENT_TYPES`** — expanded 11 → **22** (existing 11 untouched; +11 below, grouped by domain).

3. **`eventPayloadSchemas`** — +11 entries; the `as const satisfies Record<EventType, z.ZodObject<z.ZodRawShape>>` clause forces 1:1 string↔schema coverage at tsc time.

**The 11 new event types (SPEC.2 v1.0 canonical names) + payload shapes.** `uuid = z.string().uuid()`; `side = z.enum(["YES","NO"])` (mirrors the `side` pgEnum, `src/db/schema/_enums.ts`); `payoutType = z.enum(["bet_payout","correction_reverse","correction_apply","void_refund"])` (mirrors the `payout_type` pgEnum, `src/db/schema/events.ts:91`, verbatim). `aggregate_type` column noted per type (free union in `insert.ts`; not constrained by the payload schema).

| `event_type` | `aggregate_type` | Payload |
|---|---|---|
| `market.created` | `market` | `{ marketId: uuid, resolutionDeadline: z.string().datetime({ offset: true }), seedAmount: numericString }` — **A1:** no `initialYesReserves`/`initialNoReserves`; keep `seedAmount` |
| `market.opened` | `market` | `{ marketId: uuid }` |
| `market.closed` | `market` | `{ marketId: uuid }` — **A2:** `{ marketId }` only (no `finalPrice`) |
| `market.resolved` | `market` | `{ marketId: uuid, winningSide: side, resolutionNote: z.string().min(1) }` — renamed from kickoff `resolution.resolved` |
| `market.corrected` | `market` | `{ marketId: uuid, correctsEventId: uuid, correctedWinningSide: side, resolutionNote: z.string().min(1) }` — renamed from `resolution.corrected`; `correctsEventId` → `resolution_events.id` (A6 retracted) |
| `market.voided` | `market` | `{ marketId: uuid, voidReason: z.string().min(1) }` — renamed from `resolution.voided` |
| `bet.placed` | `bet` | `{ betId: uuid, marketId: uuid, userId: uuid, side: side, stake: numericString, shares: numericString, price: numericString, commentId: uuid, parentCommentId: uuid.nullable() }` |
| `bet.sold` | `bet` | `{ betId: uuid, marketId: uuid, userId: uuid, side: side, sharesSold: numericString, proceeds: numericString, price: numericString }` |
| `comment.placed` | `comment` | `{ commentId: uuid, betId: uuid, userId: uuid, marketId: uuid, side: side, parentCommentId: uuid.nullable(), bodyLength: z.number().int().nonnegative(), uploadId: uuid.nullable() }` — renamed from kickoff `comment.posted`; **A3:** `userId` (not `authorId`); **A4:** `uploadId` (not `imageUploadId`) |
| `dharma.credited` | `dharma_account` | `{ userId: uuid, amount: numericString, creditedForDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "UTC date YYYY-MM-DD") }` — **A5:** regex date, not `z.string().date()` |
| `payout.settled` | `bet` | `{ betId: uuid, marketId: uuid, userId: uuid, resolutionEventId: uuid, payoutType: payoutType, dharmaDelta: numericString }` — `resolutionEventId` → `resolution_events.id` (A6 retracted) |

## 4. UI / user flow

None — backend-only (server-side schema registry).

## 5. Failure modes

- **Malformed money string** → `numericString` rejects → `insertEvent` throws `InvalidEventPayloadError` (existing `error_internal` envelope, caller-bug surface). Detected at emit-site dev/test time; no DB I/O. Recovery: fix the caller.
- **String↔schema desync** (add an `EVENT_TYPES` entry without a matching `eventPayloadSchemas` entry, or vice-versa) → `tsc --noEmit` fails on the `satisfies` clause. Detected at compile (the gate). This is the enum-hygiene guard working as designed.
- **Wrong payload shape registered** (a field a future emit site can't satisfy) → caught by the round-trip CASES (a valid synthetic payload must parse + round-trip) + tsc on the emit site (ENGINE.5/7/8/9). No runtime hazard at ENGINE.0 (nothing emits yet).
- **No new failure modes at runtime** — nothing in ENGINE.0 emits these types; this is registration only.

## 6. Edge cases

- `numericString`: max integer digits (20), max fractional (18), negative (`-1.5`), zero (`0`), leading-zero integer (`007` → **rejected** by `\d{1,20}` allowing it; note: regex *permits* leading zeros — Postgres normalizes on store), exponent (`1e5` → rejected), leading `+` (rejected), bare `.5` / `5.` (rejected), empty (rejected).
- `bodyLength: z.number().int().nonnegative()` — `0` is valid (image-only comment with empty body is conceivable; positivity is business logic, not shape).
- `parentCommentId: null` (top-level post-bet) vs `uuid` (reply-bet) — both valid.
- `uploadId: null` (no image) vs `uuid` (image-attached) — both valid.
- `creditedForDate`: `"2026-09-15"` valid; `"2026-9-5"` / `"2026-09-15T00:00:00Z"` rejected (strict `YYYY-MM-DD`).

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit-ish regression guard (`tests/server/events/insert.test.ts::canonical-event-types-inventory-shape`) | Inventory floor: `EVENT_TYPES` = the **22**-member set (existing 11 + new 11, canonical names), length 22, `image_upload.r2_delete_failed` still excluded. | — (vocabulary lock) |
| Integration — real Postgres (`tests/server/events/insert.test.ts` driver CASES) | **+11 new CASES** (existing 11 unchanged): for each new `event_type`, build a valid payload (synthetic `uuidv7()` ids, `numericString` values, `side`/`payoutType` enum values) → `insertEvent` inside a tx → assert all 8 columns land, `row.payload` `toEqual` the payload (exact string round-trip). Existing atomicity/rollback/retry/payload-version tests unchanged. | INV-2 *exactness* (money string survives jsonb round-trip byte-for-byte) |

`@test-writer` owns the test changes (forbidden from `src/`). RED before implementation, GREEN after. No new invariant `I-*` spec at ENGINE.0 (the enforcing assertions land with their modules per CLAUDE.md §2 note).

## 8. Out of scope

- **All business logic** — CPMM math, Dharma accounting, payout/bet/resolution flow, conservation, per-field positivity/sign. Deferred to ENGINE.5/7/8/9.
- **Emit sites** — nothing calls `insertEvent` with these new types at ENGINE.0; wiring is ENGINE.5 (`dharma.credited`), ENGINE.7/8 (`market.*` lifecycle, `bet.*`, `comment.placed`), ENGINE.9 (`market.resolved/corrected/voided`, `payout.settled` + the `resolution_events.id` referent for `correctsEventId`/`resolutionEventId`).
- **Schema / migration / new `dharma_entry_type`** — the signup-grant tag is ENGINE.5; no DDL here.
- **The existing 11 strings/schemas + `eventMetadataSchema`** — untouched.
- **`dharma.granted`; moderation / conclusion-freeze / system event types** — not added.
- **A6's `events.event_id` steer** — retracted; the referent is `resolution_events.id` per SPEC.2 §3.6.

---

## Open questions

None at plan time. Both prior blockers were ruled by web:
- **Event-type names** → conform to SPEC.2 v1.0 canonical (`market.resolved/corrected/voided`, `comment.placed`); the kickoff's `resolution.*`/`comment.posted` were a web-side error; **no SPEC.2 amendment** (spec is correct as written; conforming also keeps the §19.4.1 export PII-STRIP table matching).
- **`numericString`** → the signed validator above (verbatim from the web ruling).

## ADRs needed

None. This implements the existing SPEC.2 §7.6 per-`event_type` Zod boundary + ADR-0008 §6.2 (drizzle-zod-vs-hand-written split). The name reconciliation is "conform to canonical spec, no amendment" — not an architectural decision.

---

## Execution gates & checks (kickoff §5/§6/§7)

**Zero-edit proof (§5).** After implementation, `git diff --stat` (vs `main`) must show **only**:
- `src/server/events/schemas.ts`
- `tests/server/events/insert.test.ts`
- `docs/plans/ENGINE.0.md` (this file, separate Phase-1 commit) + `docs/logs/ENGINE.0.md` (close-out, separate commit)

`insert.ts`, `events.ts` (schema), `dharma.ts`, and `drizzle/migrations/*` MUST be unchanged. Confirmed by `git diff --stat`.

**Gates (§6).** `just verify` (typecheck → biome → build) + the real-Postgres round-trip (`just test-db` / `pnpm test:integration`): 22 driver CASES + inventory floor green.

**Pre-PR self-audit (§7)** — item-by-item PASS/FAIL/SURPRISE before `gh pr create`:
1. All 11 new `EVENT_TYPES` strings = the SPEC.2 canonical names (no `resolution.*`, no `comment.posted`).
2. All 11 payload schemas match the §3 table exactly (field names, `numericString` on every money/share/price/delta, `side`/`payoutType` enum values verbatim, `.nullable()` only on `parentCommentId`/`uploadId`, `z.string().min(1)` on free-text, A5 regex on `creditedForDate`).
3. `numericString` exported, placed before `EVENT_TYPES`, regex verbatim.
4. `as const satisfies Record<EventType, …>` intact; tsc green (string↔schema 1:1).
5. Existing 11 strings/schemas + `eventMetadataSchema` byte-unchanged.
6. No `z.number()` on a money field; no `z.any()`; no business logic; no schema/migration touched.
7. `git diff --stat` = only the two code/test files (+ plan/log commits).

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | `numericString` regex permits leading zeros (`007`, `00.5`) and `-0` — not strictly canonical. | Accepted as known limitation: the web-ruled definition is verbatim and the char-class bound is the load-bearing property; Postgres normalizes on store and exact-string round-trip is still asserted. Tightening canonicality is a business-logic/serializer concern deferred to ENGINE.5/8. Noted, not changed (the validator is ruled verbatim). |
| 2 | low | `aggregate_type` is not constrained per `event_type` by the payload schema, so a CASES row could pair e.g. `market.created` with `aggregate_type: "bet"` and still pass. | Out of scope — `AggregateType` is a free 8-value union validated in `insert.ts`, not per-type. The CASES use the sensible mapping (§3 table) for realism; no schema-level coupling is in scope at ENGINE.0. |
| 3 | low | `payout.settled` is a *per-bet* shape, but SPEC.2 §3.6 says resolution emits "a single terminal `events` row" (payouts live in the `payout_events` table). | Registration only — ENGINE.0 does not emit; whether `payout.settled` becomes a per-bet `events` row or stays table-only is an ENGINE.9 wiring decision. The shape is registered per the kickoff; no emit-site commitment is made here. Flagged for ENGINE.9. |

Checked: invariants coverage, scope discipline, test assertions, edge-case enumeration, zero-edit proof, name-reconciliation against SPEC.2 v1.0.

---

## References

- `CLAUDE.md` §1 (source-of-truth precedence; critical paths), §2 (INV-1/2/3/4; money-as-string), §3 (refusal triggers), §5.6 (tests-first) — the contract this plan respects
- `AGENTS.md` §4 (string-literal unions; no `z.number()` for money), §6 (events `text` enum; enum-hygiene), §9 (test layout) — stack patterns
- `docs/specs/SPEC.2.md` §3.6 (resolution event names `market.resolved/corrected/voided`), §7.1/§7.6/§7.7 (events column shape, per-`event_type` Zod boundary, insert helper), §13.1 (`comment.placed`), §19.4.1 (export PII-STRIP table keyed on canonical names)
- `docs/plans/ENGINE.6.md` — the predecessor (insert helper + canonical 11-string enum + metadata schema)
- ADR-0005 (event-sourcing), ADR-0008 §6.2 (drizzle-zod vs hand-written boundary), ADR-0016 (UUIDv7)
- Tracker entry: `tracker_v11` ENGINE lane, ENGINE.0
