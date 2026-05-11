# SCAFFOLD.2 stratum 3.B — Drizzle schemas (21 tables, 10 domains, 11 files)

## Context

SCAFFOLD.2 stratum 3.A (PR #22, merged at `97d3cdb`) landed the Drizzle/Vitest deps, `drizzle.config.ts` with `tablesFilter: ["!events"]`, `src/db/index.ts` with `import "server-only"`, the empty `src/db/schema/index.ts` placeholder, `.env.example`, and 40 `F-*.md` flow skeletons.

Stratum 3.B declares the 21 Postgres tables as Drizzle TypeScript schemas across 10 per-domain files plus the index re-exporter. Type inference must work for every table. drizzle-zod schemas are co-located. No migrations or triggers or tests in 3.B — those land in 3.C and 3.D.

After merge: `/clear`, then stratum 3.C generates `0001_initial_schema.sql` from these declarations + hand-writes `0002_events_partitioning.sql` + `0003_append_only_triggers.sql` + `0004_seed_system_state.sql`.

## Confirmed framing (per session AskUserQuestion)

1. **ADR substrate.** ADRs 0003–0016 don't exist as files in `docs/adr/`; their substance is absorbed in SPEC.1 + SPEC.2. **3.B cites SPEC.1 / SPEC.2 by section number, never `per ADR-N`.** No ADR files are authored in this stratum.
2. **`friendly_fire_events.cleared_at` ratification.** Lands as a same-commit edit to SPEC.2 — flip the "schema decided by SCAFFOLD.2 per ADR-0009" wording in **§5.1 row 10** and **Appendix B.8** to the concrete decision: `cleared_at` = nullable timestamp; second independent Bucket-B whitelisted transition (NULL → timestamp once), independent from `frozen_at`. Per the plan doc's deferred-decision text, this lands in 3.B, not 3.C.
3. **`system_state.id` text carve-out.** Schema declares `id text PRIMARY KEY` literal `'system'`. The carve-out comment in the schema file documents why. The plan doc defers the SPEC ratification text to 3.C; no SPEC edit in 3.B for this.
4. **CLAUDE.md §5.6 tests-before-implementation.** Dormant for 3.B. Type-check-only verification (`just verify` + `pnpm tsc --noEmit`) suffices because 3.B declares types, not business logic. Trigger tests land in 3.D.

## Better Auth 1.6.x verification findings (per user-requested verification)

Verified against [Better Auth Database concepts](https://better-auth.com/docs/concepts/database) + [Drizzle adapter docs](https://better-auth.com/docs/adapters/drizzle).

1. **Plural table names supported.** `drizzleAdapter(db, { usePlural: true })` automatically maps Better Auth's singular model names (`user`, `session`, `account`, `verification`) to plural Drizzle tables (`users`, `sessions`, `accounts`, `verifications`). Plan's plural naming is correct; no flip needed.

2. **`verifications` column shape confirmed.** Better Auth 1.6.x core verification table = `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`. Matches plan exactly. Email-OTP plugin uses the same core table (identifier patterned as `${type}-otp-${email}`, no plugin-specific columns added).

3. **`sessions` + `accounts` column shapes confirmed.** Match Better Auth 1.6.x core schemas:
   - sessions: `id`, `userId`, `token`, `expiresAt`, `ipAddress`, `userAgent`, `createdAt`, `updatedAt` ✓
   - accounts: `id`, `userId`, `accountId`, `providerId`, `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `idToken`, `password`, `createdAt`, `updatedAt` ✓

4. **`users` SPEC.2 B.1 gap identified.** Better Auth 1.6.x core users columns are 7: `id`, `name` (NOT NULL), `email` (NOT NULL), `emailVerified` (boolean, NOT NULL), `image` (NULL), `createdAt`, `updatedAt`. **SPEC.2 B.1 omits four** (`name`, `emailVerified`, `image`, `updatedAt`). Better Auth core code reads these directly — can't be skipped via `fields` rename. 3.B adds these 4 columns to the users schema (17 total cols) so SCAFFOLD.3's Better Auth wiring works. SPEC.2 B.1 flagged as drift for PRECURSOR.5 (alongside the `markets.status` 7-vs-3 and `identity_pool.number` 0-999-vs-1-9 drifts).

## Resolved contradictions (from in-session AskUserQuestion, all answers = my defaults)

1. **`markets.status` enum** — 7 states (`Draft / Open / Closed / Resolving / Resolved / Voided / Frozen`) per SPEC.1 §6.1 + plan doc §3.B. SPEC.2 B.2's 3-state listing flagged as drift for PRECURSOR.5.
2. **`dharma_ledger.entry_type` enum value** — `bet_payout` per SPEC.2 B.7 (consistent with `payout_events.payout_type='bet_payout'`). SPEC.1's `bet_settle` deprecated.
3. **`identity_pool.number` range** — smallint with range 0–999 per SPEC.1 §13 + ADR-0011 absorption. SPEC.2 B.15's `1-9` flagged as drift.
4. **`mod_actions` + `friendly_fire_events` columns** — SPEC.2 Appendix B minimal column sets (9 + 7 cols). SPEC.1's named adds derivable / captured by Bucket-A append-only + jsonb.

## Files

| Path | Action | Lines (rough) |
|---|---|---|
| `src/db/schema/auth.ts` | create | ~200 (5 tables) |
| `src/db/schema/markets.ts` | create | ~80 (2 tables) |
| `src/db/schema/bets.ts` | create | ~100 (2 tables + sideEnum) |
| `src/db/schema/comments.ts` | create | ~100 (2 tables + ffDirectionEnum) |
| `src/db/schema/dharma.ts` | create | ~50 (1 table + dharmaEntryTypeEnum) |
| `src/db/schema/events.ts` | create | ~120 (3 tables + resolutionEventKindEnum + payoutTypeEnum) |
| `src/db/schema/identity.ts` | create | ~40 (1 table) |
| `src/db/schema/image-uploads.ts` | create | ~40 (1 table + imageTerminalStateEnum) |
| `src/db/schema/audit.ts` | create | ~100 (3 tables + modVerdictEnum) |
| `src/db/schema/system.ts` | create | ~30 (1 table) |
| `src/db/schema/index.ts` | edit | replace `export {};` placeholder with 10 re-export lines |
| `docs/specs/SPEC.2.md` | edit | §5.1 row 10 + Appendix B.8 — `cleared_at` ratification (~2 lines changed) |

Total: 10 new files + 2 small edits. No tests, no migrations, no `src/server/` code, no `tests/invariants/` adds in 3.B.

---

# Review categories

## 1. Invariants touched (per CLAUDE.md §2 + SPEC.1 §5)

3.B is a schema-declaration stratum. The four hard-locked invariants are encoded across this stratum + 3.C (triggers) + the application layer (ENGINE.7+ transactions). 3.B contributes column shape, FK declaration, and Bucket classification; runtime enforcement comes later.

**INV-1 — Bet ↔ comment atomicity** (SPEC.1 §5 line 142; SPEC.2 §3.1; ADR-0013 absorption in SPEC.2 v0.1-outline line 39):
- 3.B contribution: `bets.comment_id` declared `uuid().notNull().references((): AnyPgColumn => comments.id)` — lambda form for circular import resolution. NOT NULL is the schema-level half of the INV-1 mechanism.
- NOT in 3.B: SERIALIZABLE transaction wrapper, canonical lock order `pools → positions → dharma_ledger → friendly_fire_events → events`, retry policy on 40001/40P01 — all ENGINE.7 per SPEC.2 §9 line 948.
- Verification gap until ENGINE.7: a malicious hand-rolled INSERT into `bets` without a paired `comments` INSERT in the same transaction fails at the FK constraint (good), but the atomicity guarantee is the transaction, not the constraint.

**INV-2 — Dharma non-transferable; no overdraft** (SPEC.1 §5 line 151; SPEC.2 §14):
- 3.B contribution: `dharma_ledger` declared as Bucket A append-only (no UPDATE / DELETE — trigger ships in 3.C). `balance_after numeric(38,18) NOT NULL` **with CHECK (balance_after >= 0)** — storage-layer INV-2 enforcement adopted in 3.B per user direction (the lone CHECK constraint in this stratum). **No `dharma_transfer` table — refused by design per CLAUDE.md §3.**
- NOT in 3.B: Bucket-A trigger (3.C), application-layer overdraft check (ENGINE.5/7), `I-NO-OVERDRAFT-001` canonical invariant test (not in 3.B; HARDEN scope per AGENTS.md §9).
- **Refusal trigger:** any "send Dharma" / user-↔-user transfer endpoint or table is `REFUSAL:` per CLAUDE.md §3.

**INV-3 — Comments side-bound at post-time** (SPEC.1 §5 line 164; SPEC.2 §6.6):
- 3.B contribution: `comments.side_at_post_time` declared `sideEnum NOT NULL`. The immutability enforcement is in 3.C's Bucket A append-only trigger. `comments.stake_at_post_time numeric(38,18) NOT NULL` declared per SPEC.2 v0.1-outline absorption line 36 (ADR-0009 ranking-function input).
- NOT in 3.B: per-row "side_at_post_time immutability" trigger (3.C), application-layer freeze-at-insert logic (ENGINE.7's comment-write transaction at `src/server/comments/write.ts`).

**INV-4 — Resolutions append-only** (SPEC.1 §5 line 179; SPEC.2 §6.6):
- 3.B contribution: `resolution_events` + `payout_events` declared as Bucket A tables. `resolution_events.corrects_event_id` self-ref FK (lambda form) enables correction-event linkage per F-RESOLVE-2 (SPEC.2 §3.6 line 204; SPEC.1 §11 line 553).
- NOT in 3.B: append-only triggers (3.C), F-RESOLVE-1/2/3 transaction handlers (RESOLVE.* tasks), `I-APPEND-ONLY-001` canonical integration test at `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` (3.D scope per plan doc).

## 2. Data model (canonical per SPEC.2 §5 + Appendix B)

Full per-table schemas under "Per-table schema" section below. Summary by domain file:

| File | Tables | Buckets |
|---|---|---|
| `auth.ts` | users, sessions, accounts, verifications, admin_sessions | 5×C |
| `markets.ts` | markets, pools | 2×C |
| `bets.ts` | bets, positions | A + C |
| `comments.ts` | comments, friendly_fire_events | A + B |
| `dharma.ts` | dharma_ledger | A |
| `events.ts` | events, resolution_events, payout_events | 3×A (events type-only) |
| `identity.ts` | identity_pool | B |
| `image-uploads.ts` | image_uploads | B |
| `audit.ts` | mod_actions, admin_events, user_events | 3×A |
| `system.ts` | system_state | B (carve-out) |

Bucket totals match SPEC.2 §5.2 line 494: 9 Bucket A + 4 Bucket B + 8 Bucket C = 21.

## 3. API surface

**N/A for 3.B.** No Server Actions, Route Handlers, request validators, or REST/RPC endpoints. The Drizzle types feed the API surface landing in ENGINE.7+ / DEBATE.* / RESOLVE.* / MOD.* / SCAFFOLD.3. `src/db/schema/index.ts` re-exports provide the import surface; `src/db/index.ts` (3.A) exposes `db`, `DbClient`, `DbTransaction`.

## 4. UI / flow

**N/A for 3.B.** No React components, no client-side state, no Next.js routes. The 40 F-*.md flow skeletons exist from 3.A; substance lands per SPEC.2 §13.4 gating cadence in later tasks. 3.B's schemas ground the type signatures of those future flows.

## 5. Failure modes (schema-declaration stratum)

1. **drizzle-kit fails to ingest schema files.** If `drizzle.config.ts` paths are wrong, drizzle-kit emits an empty 0001 migration. Detected at 3.C — `0001_initial_schema.sql` shows ~20 CREATE TABLE statements + indexes + FK constraints. If <20 tables, 3.B has a configuration bug.
2. **Circular FK lambda fails at runtime.** `bets.comment_id` → `comments.id` and `comments.bet_id` → `bets.id` both use lambda form. Wrong import order in `src/db/schema/index.ts` → Drizzle sees `undefined` FK targets → throws on first query. Verification: spot-check inference compiles + Drizzle runtime introspection (deferred to 3.C / 3.D).
3. **pgEnum name collision.** Two files declaring a pgEnum with the same Postgres type name → drizzle-kit emits duplicate `CREATE TYPE` → SQL error. Mitigation: each enum declared once, exported, imported elsewhere. Plan: `sideEnum` in bets.ts; comments.ts + positions imports.
4. **Better Auth column-name mismatch.** Better Auth defaults emit specific column names (`userId`, `expiresAt`, `accountId`, etc.). If my camelCase TS names diverge from Better Auth's expectations, SCAFFOLD.3's Better Auth config needs a `schema` override map. Per `casing: "snake_case"`, the TS↔DB mapping is automatic; risk is in the TS field names.
5. **drizzle-zod payload schema is loose.** `createInsertSchema(events)` types `payload jsonb` as `unknown` or `Record<string, unknown>`. ENGINE.6 layers per-event-type Zod schemas on top. Accepted; documented expectation.
6. **`events` tablesFilter mis-applied.** drizzle-kit emits DDL for `events` despite `tablesFilter: ["!events"]` → 3.C migration conflict. Verification: 3.C grep on `0001_initial_schema.sql` for `CREATE TABLE.*events` must return 0.
7. **`system_state.id` text PK trips Drizzle conventions.** drizzle-zod may handle text PK suboptimally; other tools assume UUID. Mitigation: explicit carve-out source comment; verify type inference works.
8. **relations() declarations missing or mis-named.** Downstream `db.query.users.findMany({ with: { comments: true } })` fails if `usersRelations` doesn't declare `comments: many(comments)`. 3.B should declare every plausible relation upfront; gaps surface in ENGINE.* tasks.
9. **Index naming convention exceeds 63-char Postgres identifier limit.** Compound indexes (`friendly_fire_ranking_idx`) approach but don't exceed. Future additions could trip the limit. Mitigation: short explicit names.
10. **Lambda FK `onDelete` behaviour.** Default Drizzle `onDelete: 'restrict'` is correct for bets↔comments circular pair. Wrong choice (`cascade`/`set null`) creates deletion paths that undermine append-only. Verification: review `onDelete` on every FK.

## 6. Edge cases

1. **`events.event_id` is the PK, NOT `id`.** Every other table uses `id`. drizzle-zod / relations() / any code defaulting to `<table>.id` must explicitly target `<table>.event_id` for events. Header comment in events.ts documents.
2. **`system_state.id` is text, not uuid.** Universal patterns filtering by uuid type skip system_state. Test code constructing FK references must not target this column.
3. **Two-column atomic transitions on image_uploads.** `terminal_state` + `terminal_at` flip together. Schema doesn't enforce; 3.C trigger does. Application must always set both together; setting one alone is 3.C trigger rejection.
4. **`friendly_fire_events` two-independent-transitions.** `frozen_at` and `cleared_at` independently flip NULL → timestamp. NEITHER together (3.C trigger). Vote-clear flips `cleared_at`; market-resolution-freeze flips `frozen_at`.
5. **`identity_pool.number` is smallint 0–999.** Slug uses three-digit zero-padded display (`RedFox001`, `BlueWolf472`). Schema stores integer; display layer pads. F-AUTH-3 must format consistently.
6. **`dharma_ledger.balance_after` is "balance after this row's amount applied".** Running total. Reads of "current balance" SELECT most recent row WHERE user_id = X. 3.B's CHECK constraint `balance_after >= 0` is per-row, not monotone-across-rows — a buggy INSERT could still write a non-monotonic sequence (e.g., balance_after goes 10 → 5 → 10 across consecutive credits). Application-layer math is responsible for the "balance_after = previous balance_after + amount" rule; the CHECK only blocks negative end-states.
7. **`users.pseudonym` UNIQUE creates a registration race window.** Two F-AUTH-3 flows computing same slug from identity_pool at same moment → second INSERT fails UNIQUE. F-AUTH-3 uses `SELECT ... FOR UPDATE SKIP LOCKED` to avoid; 3.B's UNIQUE is safety net.
8. **Better Auth's `accounts.password` declared `text NULL`.** Unused in v1 (no credentials auth). Future enable needs no migration.
9. **`sessions.expires_at` declared nullable.** Per §8.2 line 809 `disableSessionRefresh: true`, Better Auth never writes `expires_at`. NOT NULL would break Better Auth.
10. **`positions.updated_at` default `now()`.** Drizzle 0.45 generated columns don't auto-update on UPDATE. Application-layer SETs `updated_at = NOW()` in every UPDATE. (Trigger fix possible in 3.C but not in plan.)
11. **`comments.image_uploads_id` FK target name.** image_uploads.id is target. Plural-vs-singular naming (image_uploads is plural; FK is `image_uploads_id`) is intentional per SPEC.2 B.6 line 2480. Don't "fix" by singularizing.

## 7. Test plan / verification

**3.B has no runtime tests.** §5.6 tests-before-implementation is dormant for type-level declarations (confirmed via session AskUserQuestion). 3.D's trigger tests are the runtime-enforcement gate.

Pre-PR verification:
```bash
just verify         # typecheck + biome + build (DB-free); set in 3.A
pnpm tsc --noEmit   # explicit type-check pass
```

Spot-check inference (uncommitted scratch):
```typescript
import { users, bets, friendlyFireEvents } from '@/db/schema';
type U = typeof users.$inferSelect;            // includes pseudonym, banned_at, etc.
type Bi = typeof bets.$inferInsert;            // commentId NOT optional
type F = typeof friendlyFireEvents.$inferSelect; // both clearedAt + frozenAt present
```

Do **NOT** run `just test-db` (no migrations yet — 3.C ships migrations). Do **NOT** run `pnpm drizzle-kit generate` (3.C scope).

## 8. Out of scope

Per the plan doc out-of-scope list + SCAFFOLD.2 plan's refusal-grade items:

Deferred to other tasks:
- Server Actions, Route Handlers, request handlers → ENGINE.7+, DEBATE.2+
- Auth wiring (Better Auth instance config, session-deferral hook) → SCAFFOLD.3
- Bet transaction wrapper `src/server/bets/transaction.ts` → ENGINE.7
- Events insert helper `src/server/events/insert.ts` → ENGINE.6
- Per-event-type Zod schemas `src/server/events/schemas.ts` → ENGINE.6
- Pseudonym pool consumer `src/server/identity/assign.ts` → SCAFFOLD.3
- Decimal-arithmetic library (decimal.js / dnum / js-big-decimal) → ENGINE.5
- Identity-pool data load (50K rows) → SCAFFOLD.17
- R2 object storage wrappers → SCAFFOLD.15
- Sentry/PostHog/Vercel-logs imports → SCAFFOLD.5/6/7
- CI workflow file edits → SCAFFOLD.18
- pg_cron Path-A freeze job → HARDEN.10
- BREAK_GLASS.md, runbooks → HARDEN.10
- Migrations → 3.C
- Triggers → 3.C
- Trigger tests → 3.D
- INV-4 canonical integration test → 3.D
- CHECK constraints **except** `dharma_ledger.balance_after >= 0` (the one in-scope adoption per user direction — INV-2 storage-layer enforcement; all other CHECKs deferred to HARDEN.*)

Refusal-grade items (CLAUDE.md §3):
- `users.role` column or `is_admin` boolean — structural separation by data-model per SPEC.2 §8.7 pillar 1
- `dharma_transfer` table or any "send Dharma" path — INV-2 violation
- Market content (questions, criteria, deadlines) — Hrishikesh-only authorship
- K_eff in-product surface — post-hoc dataset only per §19
- HTTP inside DB transaction — N/A for 3.B (no handlers); flag for downstream

## Critical-path enumeration (per CLAUDE.md §1)

3.B touches critical path `src/db/schema/`. Other critical paths (drizzle/migrations/, supabase/migrations/, src/server/*) are NOT touched.

Critical-path-bound tables 3.B declares (downstream `src/server/<domain>/` consumers in ENGINE.* / RESOLVE.* / MOD.* / SCAFFOLD.3):
- `src/server/bets/`: bets (A), positions (C), pools (C, read)
- `src/server/comments/`: comments (A), friendly_fire_events (B)
- `src/server/dharma/`: dharma_ledger (A)
- `src/server/resolution/`: resolution_events (A), payout_events (A), pools (C, read), positions (C, read)
- `src/server/auth/`: users (C), sessions (C), accounts (C), verifications (C), admin_sessions (C)
- `src/server/identity/`: identity_pool (B)
- `src/server/moderation/`: mod_actions (A), image_uploads (B)

Triggers per CLAUDE.md §1 ("writer/reviewer ritual + invariant test gate + same-commit ADR scan"):
- **Writer/reviewer ritual:** in plan-then-execute mode (current). Plan in this file; review via web Claude; execute as Phase 2 in a separate tab.
- **Invariant test gate:** dormant in 3.B (type-check-only); fires at 3.D.
- **Same-commit ADR scan:** N/A per confirmed framing (no ADR files; SPEC.2 §5.1 + B.8 amendments substitute).

---

## Universal column conventions (per SPEC.2 §5.3, line 506)

```typescript
id: uuid('id').primaryKey().default(sql`uuidv7()`),
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
amount: numeric('amount', { precision: 38, scale: 18 }).notNull(),
frozenAt: timestamp('frozen_at', { withTimezone: true }), // Bucket B whitelisted
```

`drizzle.config.ts` already sets `casing: "snake_case"` (3.A) — TS identifiers stay camelCase; DB columns land snake_case automatically.

## Common patterns

1. **drizzle-zod co-location** — `createInsertSchema(table)` + `createSelectSchema(table)` per table. No per-column refinements in 3.B.
2. **Circular FK pairs use lambda form** with `AnyPgColumn` typed:
   ```typescript
   commentId: uuid('comment_id').notNull().references((): AnyPgColumn => comments.id, { onDelete: 'restrict' }),
   ```
   Required for `bets.comment_id ↔ comments.bet_id` (circular), `comments.parent_comment_id` (self-ref), `resolution_events.corrects_event_id` (self-ref).
3. **Indexes declared inline** via the second arg to `pgTable` returning an array. Every FK column gets an index (Postgres does NOT auto-index FK columns per AGENTS.md §6).
4. **`pgEnum` declared once per enum**:
   - `bets.ts` declares `sideEnum`; positions + comments import.
   - `markets.ts` declares `marketStatusEnum` + `marketOutcomeEnum`; resolution_events imports `marketOutcomeEnum`.
   - Per-file: `dharmaEntryTypeEnum`, `ffDirectionEnum`, `resolutionEventKindEnum`, `payoutTypeEnum`, `imageTerminalStateEnum`, `modVerdictEnum`.
   - `events.event_type` + `events.aggregate_type` + `admin_events.event_type` + `user_events.event_type` are **`text`** in schema (open-extensible per SPEC.2 §7.1 line 686).
5. **Relations API for typed query builder** — each table with cross-table FKs gets a `relations()` block in the same file.
6. **Better Auth UUIDv7 override is config-side**, not schema-side. Schema declares `id uuid` with `default(sql\`uuidv7()\`)`; SCAFFOLD.3's `src/server/auth/index.ts` sets `advanced.database.generateId: () => uuidv7()` per SPEC.2 §8.2 line 811.
7. **`events` table is type-only in 3.B.** `drizzle.config.ts` excludes via `tablesFilter: ["!events"]` (3.A). pgTable declaration is for type inference + drizzle-zod only; actual DDL ships in 3.C's `0002_events_partitioning.sql`.
8. **Minimal CHECK constraints in 3.B — exactly one.** `dharma_ledger.balance_after >= 0` ships as a column-level CHECK in 3.B for storage-layer INV-2 enforcement (adopted per user direction; INV-2 is too load-bearing to defer). All other CHECK constraints deferred to HARDEN.* scope; Bucket A/B append-only enforcement rides on 3.C's triggers.

## Per-table schema (data model — full detail)

### `auth.ts` — 5 tables, all Bucket C

**`users`** — 17 columns: SPEC.2 B.1's 13 + 4 Better Auth 1.6.x core (per verification finding #4 above):

| Column | Type | Null | Source | Notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | both | PK, UUIDv7 |
| `name` | text | NOT NULL | Better Auth core | Google OAuth profile name; SPEC.2 B.1 gap |
| `email` | text | NOT NULL | both | STRIP in dataset |
| `email_verified` | boolean | NOT NULL DEFAULT `false` | Better Auth core | OAuth `email_verified === true` gate per §8.2; SPEC.2 B.1 gap |
| `image` | text | NULL | Better Auth core | Google OAuth profile image URL (separate from `pfp_filename` slug); SPEC.2 B.1 gap |
| `pseudonym` | text | NOT NULL UNIQUE | SPEC.2 B.1 | colour-animal-number slug |
| `google_id` | text | NULL | SPEC.2 B.1 | STRIP in dataset |
| `pfp_filename` | text | NULL | SPEC.2 B.1 | H2-erasure null-s; Zugzwang PFP slug (separate from `image`) |
| `tos_accepted_at` | timestamptz | NULL | SPEC.2 B.1 | §8.3 session-gate input |
| `tos_version_hash` | text | NULL | SPEC.2 B.1 | acceptance evidence |
| `privacy_version_hash` | text | NULL | SPEC.2 B.1 | acceptance evidence |
| `tos_acceptance_ip` | text | NULL | SPEC.2 B.1 | STRIP in dataset |
| `tos_acceptance_user_agent` | text | NULL | SPEC.2 B.1 | STRIP in dataset |
| `last_allowance_accrued_at` | timestamptz | NULL | SPEC.2 B.1 | daily-allowance cursor |
| `banned_at` | timestamptz | NULL | SPEC.2 B.1 | Track A + Track B marker per §8.6 |
| `created_at` | timestamptz | NOT NULL | both | universal |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()` | Better Auth core | Application-managed; SPEC.2 B.1 gap |

Note that `email` flips to NOT NULL (was NULL in SPEC.2 B.1) to match Better Auth's contract. Better Auth populates `name` / `email` / `email_verified` / `image` from the Google OAuth profile at signup; Zugzwang populates `pseudonym` / `pfp_filename` at F-AUTH-3.

Indexes: `(pseudonym)` UNIQUE; partial `(google_id)` / `(banned_at)` WHERE NOT NULL; `(email)` (now NOT NULL, regular index).

No `role` column. No `is_admin`. Per §8.7 pillar 1.

**`sessions`** — Better Auth shape + UUIDv7 PK override (§8.2 line 811):
- `id` (uuid PK), `user_id` (uuid FK), `token` (text UNIQUE — Better Auth 32-char), `expires_at` (timestamptz NULL — `disableSessionRefresh` per §8.2 line 809), `ip_address` (text NULL), `user_agent` (text NULL), `created_at`, `updated_at`.
- Indexes: `(user_id)`; `(token)` UNIQUE.

**`accounts`** — Better Auth OAuth provider linkage (§8.2 + 3-A R1 line 487):
- `id`, `user_id` FK, `provider_id`, `account_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`.
- Indexes: `(user_id)`; `(provider_id, account_id)` UNIQUE.

**`verifications`** — Better Auth Email-OTP shape (§8.2 line 805):
- `id`, `identifier` (email), `value` (OTP), `expires_at`, `created_at`, `updated_at`.
- Indexes: `(identifier)`.

**`admin_sessions`** — 3 columns per §8.4 line 861:
- `session_id` (uuid PK — **not `id`**), `issued_at` (timestamptz NOT NULL), `last_seen_at` (timestamptz NOT NULL). No `created_at` — `issued_at` serves the role. No FK to `users` (per §8.7 pillar 5).

`usersRelations`: many sessions / accounts / comments / bets / positions / friendlyFireEvents (as voter) / dharmaLedger / payoutEvents / modActions (as target) / userEvents / imageUploads.

### `markets.ts` — 2 tables, Bucket C

**`markets`** — 10 columns per SPEC.2 B.2 line 2415; 7-state enum per SPEC.1 §6.1:
- `id`, `slug` UNIQUE, `title`, `description`, `status` (marketStatusEnum NOT NULL DEFAULT `'Draft'`), `resolution_deadline`, `resolved_at` NULL, `resolution_outcome` (marketOutcomeEnum NULL), `created_by` (text NOT NULL DEFAULT `'admin-singleton'`), `created_at`.
- Enums: `marketStatusEnum` = `Draft|Open|Closed|Resolving|Resolved|Voided|Frozen`; `marketOutcomeEnum` = `YES|NO|VOID`.
- Indexes: `(slug)` UNIQUE; `(status)`; `(resolution_deadline)`.

**`pools`** — 5 columns per B.3:
- `id`, `market_id` (uuid FK NOT NULL UNIQUE — 1:1), `yes_reserves` numeric(38,18), `no_reserves` numeric(38,18), `created_at`.
- Indexes: `(market_id)` UNIQUE.

### `bets.ts` — 2 tables (bets = A, positions = C)

**`bets`** — 10 columns per B.5:
- `id`, `user_id` FK, `market_id` FK, `side` (sideEnum), `stake` numeric(38,18), `share_quantity` numeric(38,18), `price_at_bet` numeric(38,18), `comment_id` (uuid NOT NULL **lambda FK** → comments.id — **INV-1**), `idempotency_key` NULL, `created_at`.
- Enum: `sideEnum` = `YES|NO`.
- Indexes: `(user_id)`, `(market_id)`, `(user_id, market_id)`, `(comment_id)`, `(created_at)`, partial `(idempotency_key)` WHERE NOT NULL UNIQUE.

**`positions`** — 7 columns per B.4:
- `id`, `user_id` FK, `market_id` FK, `side` (sideEnum), `quantity` numeric(38,18), `created_at`, `updated_at`.
- Indexes: `(user_id, market_id, side)` UNIQUE; `(user_id, market_id)`; `(user_id)`.

### `comments.ts` — 2 tables (comments = A, friendly_fire_events = B)

**`comments`** — 10 columns per B.6 + ADR-0009 absorption (SPEC.2 §9 line 220):
- `id`, `user_id` FK, `market_id` FK, `parent_comment_id` (uuid NULL **self-ref lambda**), `body` text NOT NULL, `image_uploads_id` (uuid NULL FK normal import), `side_at_post_time` (sideEnum NOT NULL — INV-3), `stake_at_post_time` numeric(38,18) NOT NULL — ADR-0009 ranking input, `bet_id` (uuid NULL **circular lambda** FK), `created_at`.
- Indexes: `(user_id)`, `(market_id)`, `(parent_comment_id)`, `(market_id, created_at)`, **`(parent_comment_id, side_at_post_time)` — ranking-function aggregation per ADR-0009 absorption**, `(image_uploads_id)`.

**`friendly_fire_events`** — 7 columns per B.8:
- `id`, `voter_id` FK, `comment_id` FK, `direction` (ffDirectionEnum), `cleared_at` (timestamptz NULL — **NEW Bucket-B whitelisted independent from frozen_at**), `frozen_at` (timestamptz NULL — Bucket-B whitelisted), `created_at`.
- Enum: `ffDirectionEnum` = `up|down`.
- UNIQUE `(voter_id, comment_id)`.
- Indexes: **`(comment_id, frozen_at, cleared_at)` — ranking-function aggregation**; `(voter_id)`.

Two independent whitelisted transitions on the same Bucket-B table, NEITHER transitioning together. 3.C's trigger function permits either column flipping NULL → timestamp alone, rejects both flipping in same UPDATE, rejects re-firing, rejects other column changes.

### `dharma.ts` — 1 table, Bucket A

**`dharma_ledger`** — 7 columns per B.7:
- `id`, `user_id` FK, `bet_id` (uuid NULL FK), `entry_type` (dharmaEntryTypeEnum), `amount` numeric(38,18) signed, `balance_after` numeric(38,18) NOT NULL **CHECK (balance_after >= 0)** — storage-layer INV-2 enforcement (the lone CHECK in 3.B per Common patterns #8), `created_at`.
- CHECK declaration via Drizzle v0.45+ `check()` helper in the second arg to `pgTable`:
  ```typescript
  import { check } from 'drizzle-orm/pg-core';
  // inside the indexes/constraints array:
  check('dharma_ledger_balance_non_negative', sql`${table.balanceAfter} >= 0`),
  ```
- Enum `dharmaEntryTypeEnum` (9 values):
  `bet_stake`, `bet_payout`, `daily_allowance`, `pool_seed`, `pool_unwind`, `correction_reverse`, `correction_apply`, `void_refund`, `uncollectable`.
- Indexes: `(user_id)`, `(user_id, created_at)`, partial `(bet_id)` WHERE NOT NULL.

### `events.ts` — 3 tables, all Bucket A

**`events`** — 8 columns per B.14 + §7.1 line 679 (**TYPE-ONLY in 3.B; DDL in 3.C**):
- `event_id` (uuid PK — **named `event_id` not `id`** per §7.1 line 685), `event_type` (text — open-extensible), `aggregate_type` (text — open-extensible), `aggregate_id` (uuid), `payload` (jsonb), `payload_version` (smallint), `metadata` (jsonb — 7-field per §3.7), `created_at` (canonical chronological-sort).
- Indexes declared in schema for type-doc only; actual `CREATE INDEX` ships in `0002_events_partitioning.sql`: `(aggregate_type, aggregate_id, created_at)`.
- No pgEnum on `event_type` or `aggregate_type` — application-level open-extensibility per §7.1 line 686.

**`resolution_events`** — 7 columns per B.10:
- `id`, `market_id` FK, `event_kind` (resolutionEventKindEnum), `outcome` (marketOutcomeEnum — reuse markets.ts enum), `corrects_event_id` (uuid NULL **self-ref lambda** FK), `reason` (text NULL), `created_at`.

**`payout_events`** — 8 columns per B.9:
- `id`, `bet_id` FK, `user_id` FK, `market_id` FK, `resolution_event_id` FK, `payout_type` (payoutTypeEnum), `amount` numeric(38,18), `created_at`.

Enums:
- `resolutionEventKindEnum` = `resolve|correct|void`
- `payoutTypeEnum` = `bet_payout|correction_reverse|correction_apply|void_refund`

Indexes: per FK column for each table.

### `identity.ts` — 1 table, Bucket B

**`identity_pool`** — 8 columns per B.15:
- `id` (uuid synthetic PK per §5.3 line 511), `colour` text NOT NULL, `animal` text NOT NULL, `number` smallint NOT NULL (range 0–999), `pseudonym` text NOT NULL UNIQUE, `pfp_filename` text NOT NULL, `assigned_at` (timestamptz NULL — Bucket-B whitelisted), `created_at`.
- UNIQUE `(colour, animal, number)`; UNIQUE `(pseudonym)`.
- Indexes: partial `(assigned_at IS NULL, created_at)` for FIFO `SELECT ... FOR UPDATE SKIP LOCKED` per ADR-0011 absorption + §3.5.

No relations (consumed inline at F-AUTH-3; pseudonym tuple copied into `users.pseudonym` + `users.pfp_filename` and permanently retired per §12.7).

### `image-uploads.ts` — 1 table, Bucket B

**`image_uploads`** — 6 columns per B.16:
- `id`, `user_id` FK, `r2_object_key` text, `terminal_state` (imageTerminalStateEnum NULL — **Bucket-B whitelisted, two-column atomic partner**), `terminal_at` (timestamptz NULL — **Bucket-B whitelisted, two-column atomic partner**), `created_at`.
- Enum `imageTerminalStateEnum` = `committed|blocked|orphan`.
- Indexes: `(user_id)`, `(terminal_state)`, `(created_at)`.

3.C's trigger `enforce_image_uploads_terminal_atomic` rejects partial transitions.

### `audit.ts` — 3 tables, all Bucket A

**`mod_actions`** — 9 columns per B.11:
- `id`, `target_user_id` NULL FK, `target_comment_id` NULL FK, `target_bet_id` NULL FK, `verdict` (modVerdictEnum — `pass|track_a|track_b`), `categories` (jsonb — OpenAI response object), `image_r2_key` NULL, `actor_id` text NOT NULL — `'admin-singleton'` or `'system'`, `created_at`.
- Indexes per FK + `(verdict)`, `(created_at)`.

**`admin_events`** — 5 columns per B.12:
- `id`, `event_type` (text — open-extensible), `payload` (jsonb), `metadata` (jsonb — 7-field; `actor_id='admin-singleton'`, `user_id=NULL`), `created_at`.
- Indexes: `(event_type)`, `(created_at)`.

**`user_events`** — 6 columns per B.13:
- `id`, `user_id` FK, `event_type` (text), `payload` (jsonb), `metadata` (jsonb — self-actor encoding), `created_at`.
- Indexes: `(user_id)`, `(event_type)`, `(created_at)`.

### `system.ts` — 1 table, Bucket B (carve-out)

**`system_state`** — 3 columns per §20.2 line 1909:
- `id` (text NOT NULL PK literal `'system'` — **CARVE-OUT from universal UUIDv7**), `frozen_at` (timestamptz NULL — Bucket-B whitelisted), `created_at`.
- Carve-out comment block in source documents why.

### `src/db/schema/index.ts` — replace placeholder

```typescript
export * from './auth';
export * from './markets';
export * from './bets';
export * from './comments';
export * from './dharma';
export * from './events';
export * from './identity';
export * from './image-uploads';
export * from './audit';
export * from './system';
```

## Same-commit SPEC.2 edits (the `cleared_at` ratification)

**Edit 1 — §5.1 row 10.** Current text ends "`cleared_at` schema decided by SCAFFOLD.2 per ADR-0009". Change to: "`cleared_at` nullable timestamptz, second independent Bucket-B whitelisted transition (NULL → timestamp once), independent from `frozen_at` (ratified by SCAFFOLD.2 stratum 3.B; per-table trigger function in 3.C permits either column transitioning alone, rejects both transitioning together)".

**Edit 2 — Appendix B.8 line 2508.** Current notes column ends "(schema decided by SCAFFOLD.2 per ADR-0009)". Change to: "(second independent Bucket-B whitelisted transition; SCAFFOLD.2 stratum 3.B ratified)".

Both edits ship in the same commit as the schema files.

## Commit message

```
feat(scaffold-2): b — drizzle schemas (21 tables, 10 domains, 11 files)

- 10 per-domain schema files at src/db/schema/<domain>.ts per SPEC.2 §5.1
- Universal PK: uuid().primaryKey().default(sql`uuidv7()`) per SPEC.2 §5.3
- 9 pgEnum types alongside their primary table
- events.event_type / aggregate_type left as text (open-extensible per §7.1)
- bets.comment_id NOT NULL FK to comments.id (INV-1) — lambda form
- friendly_fire_events: TWO independent Bucket-B whitelisted columns
  (frozen_at + cleared_at); 3.C trigger rejects both transitioning together
- drizzle-zod insert/select schemas co-located
- relations() per table for typed query builder per AGENTS.md §6
- src/db/schema/index.ts placeholder replaced with 10 domain re-exports
- system_state.id text 'system' carve-out documented in source

SPEC amendments (same commit, per SPEC.1+SPEC.2 source-of-truth framing):
- SPEC.2 §5.1 row 10: friendly_fire_events.cleared_at concrete ratification
- SPEC.2 Appendix B.8: cleared_at ratification mirror

Migrations + triggers + tests in subsequent strata 3.C / 3.D.

Refs: SCAFFOLD.2 plan doc; SPEC.2 §5, §6, §7, §8, §9, §10, §11, §12, §20,
Appendix B.1–B.16
```

(Multi-line via `/tmp/commit-msg.txt` per AGENTS.md §10.)

## Manual review gate

- [ ] 10 schema files exist; 21 tables across them
- [ ] Every PK declaration matches `uuid('id').primaryKey().default(sql\`uuidv7()\`)` (with `system_state.id` text carve-out documented)
- [ ] Every Bucket B table's whitelisted column(s) right: `friendly_fire_events.frozen_at` + `friendly_fire_events.cleared_at` (two independent); `identity_pool.assigned_at`; `image_uploads.terminal_state` + `image_uploads.terminal_at` (two-column atomic); `system_state.frozen_at`
- [ ] `bets.comment_id` NOT NULL FK to `comments.id` via lambda form (INV-1)
- [ ] SPEC.2 §5.1 row 10 + Appendix B.8 amendments in same commit
- [ ] No imports from `src/server/`, no Server Actions, no handler/migration/test files
- [ ] `just verify` green
- [ ] `pnpm tsc --noEmit` green

After merge: `/clear`. Move to 3.C.

---

## Self-critique findings

Risks, underspecifications, and disputed-corners web Claude review should challenge:

1. **Plan is denser on declarations than on rationale.** ~70% on per-table column lists, ~20% on patterns, ~10% on edge cases. If a column choice is wrong (missed nullability, FK direction inverted), the verbose-on-mechanics-thin-on-rationale shape makes the bug easy to miss. **Mitigation:** web Claude should walk each table's column list row-by-row against SPEC.2 Appendix B.*.

2. **drizzle-kit-emits-the-right-DDL is a 3.C runtime check, not a 3.B plan-time check.** 3.B declares schemas; 3.C's drizzle-kit-generate run is the test of whether declarations translate cleanly. Bugs that drizzle-kit silently accommodates (implicit cast on nullable FK; missing index on FK) only surface at migration time. **Mitigation:** 3.C's `0001_initial_schema.sql` review is high-stakes; web Claude could also gate 3.B on 3.C-friendliness of the patterns.

3. **Better Auth column-name guess.** Declared `sessions.expires_at`, `accounts.account_id`, etc. matching what Better Auth defaults emit (per my reading). Not verified against the bundled library docs. If Better Auth's actual column names differ, SCAFFOLD.3 needs column-name overrides in the `schema` config. **Mitigation:** 3.B-as-written declares the schema my reading suggests; SCAFFOLD.3 reconciles at wiring time. Better-Auth-experienced reviewer can sanity-check.

4. **Relations() declarations may have wrong relation names for non-standard FK column names.** `friendly_fire_events.voter_id` → users requires `relationName: 'voter'` in the relations() block. I noted this in passing but didn't fully spec every relations() pair. **Mitigation:** scope 3.B's relations() to "obvious" 1:N pairs; defer disambiguated relations to first-use in ENGINE.*.

5. **`pgEnum` strict-once-per-enum vs file-locality tension.** `sideEnum` lives in bets.ts; comments.ts imports it. Across 10 files + their relations, the import graph can get tangled. Alternative — put all shared enums in `src/db/schema/_enums.ts` — centralizes + reduces import-graph complexity. Trade-off: my approach matches "one table per file + co-located related decl"; alternative matches "shared concerns in shared files." Both defensible. Chose the former for self-contained schema files.

6. **CHECK constraint for INV-2 — on-scope-adopted (per user direction).** `dharma_ledger.balance_after >= 0` ships as a 1-line CHECK in 3.B; converts INV-2 from application-layer-only to storage-layer enforcement. Closes the window where a bug in ENGINE.5/7 could write a negative balance and the Bucket-A append-only trigger wouldn't catch it (the trigger only blocks UPDATE/DELETE, not negative-amount INSERT). The CHECK is the lone carve-out from "no CHECK constraints in 3.B"; all other CHECKs stay HARDEN.* scope. `I-NO-OVERDRAFT-001` invariant test (HARDEN scope) still adds an application-layer assertion as defence-in-depth.

7. **Drizzle 0.45 index-API uncertainty.** Second-arg-to-pgTable returning an array is current; older versions used object return. My plan assumes array. If installed drizzle-orm minor version is older, syntax differs. **Mitigation:** working off `^0.45.0` per 3.A `package.json`; array form documented as current. Risk low.

8. **`events.payload` and `events.metadata` jsonb columns typed loosely.** drizzle-zod generates `unknown` or `Record<string, unknown>`. ENGINE.6 narrows via per-event-type Zod schemas at `src/server/events/schemas.ts`. Until then, downstream consumers operate on weak types. **Mitigation:** structural; narrowing happens in ENGINE.6.

9. **`identity_pool` lifecycle interaction with `users.pseudonym`.** Pool consumption at F-AUTH-3 copies (colour, animal, number, pfp_filename) into users + marks `identity_pool.assigned_at`. Per §12.7, post-erasure tuple is permanently retired (NOT returned to pool). Application-layer logic; 3.B declares columns + whitelisted transition. A "return to pool" path would be trigger-rejected (column transition is NULL → timestamp; un-assigning would be timestamp → NULL, forbidden).

10. **"10 schema files + index.ts" violates AGENTS.md §6 "one table per file" literal reading.** auth.ts bundles 5 Better Auth tables; audit.ts bundles 3 audit tables. SPEC.2 §8 line 933 explicitly mandates "single auth-domain file spanning ADR-0004 + ADR-0010 ownerships." **Resolution:** SPEC.2 wins over AGENTS.md for this specific case (auth tables share Better Auth lifecycle; audit tables share `metadata.actor_id` discipline). Worth flagging because AGENTS.md is general guidance and the §8.933 carve-out is specific.

11. **No data seeding in 3.B.** 50K identity_pool rows ship in SCAFFOLD.17. Single `system_state` row ships in 3.C's `0004_seed_system_state.sql`. 3.B has no INSERT statements. If 3.D's tests need fixtures, they construct inline; no shared seed fixtures in 3.B scope.

12. **Plan doesn't specify Drizzle version-pin verification.** drizzle-orm `^0.45.0` + drizzle-kit `^0.30.0` per 3.A. If pnpm-lock.yaml resolved to a version that differs subtly in API, my syntax may break. **Mitigation:** verify pnpm-lock.yaml `version: "0.45.x"` and `"0.30.x"` (minor not bumped) before executing.

13. **`bets.comment_id` lambda FK with `onDelete: 'restrict'` is non-obvious for the entry-comment case.** F-BET-1 creates bet + comment atomically; if a later F-RESOLVE-3 (void) needs to delete the bet, the FK restriction would block. But voids don't delete bets — they write resolution_events with event_kind='void' + payout_events with payout_type='void_refund'. Bucket-A append-only forbids DELETE anyway. So `onDelete: 'restrict'` is correct but the reasoning is non-obvious.

14. **`comments.image_uploads_id` FK target table is named `image_uploads` (plural) but the FK column is `image_uploads_id`.** Per SPEC.2 B.6 line 2480. Slight oddity: the convention "FK column = singular table name + _id" doesn't apply here. Don't "fix" via singularize; SPEC.2 wins.

15. **Plan-mode file-location constraint.** This plan file is at `/Users/hrishikesh/.claude/plans/lucky-shimmying-muffin.md` (Claude-internal path). Per session conversation, the user wants this moved to `docs/plans/SCAFFOLD.2-3B.md` inside the repo and committed before Phase 2. Plan-mode rules prevent doing that move + commit from within plan mode. Proposed order: review → exit plan mode → copy contents to `docs/plans/SCAFFOLD.2-3B.md` → commit as `plan: SCAFFOLD.2 stratum 3.B — drizzle schemas` → end session. Phase 2 opens fresh tab.

16. **Better Auth `account` vs Drizzle `accounts` plural mismatch.** Better Auth defaults name tables `user`, `session`, `account`, `verification` (singular). SPEC.2 uses plural `users`, `sessions`, `accounts`, `verifications`. SCAFFOLD.3's Better Auth `schema` config maps singular keys to plural Drizzle tables. 3.B declares plural per SPEC.2; the mapping happens at wiring time.
