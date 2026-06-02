# ADR-0016 — ID Schema (UUIDv7)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-08 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.17 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §5 (Data Model — Table Inventory), §17 (Identifiers shape), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The experiment's persistence layer per ADR-0005 names `events.event_id` as `UUID PRIMARY KEY (UUIDv7 per ADR-0016)` and SPEC.2 §17 names UUIDv7 (RFC 9562) as the primary-key type for every table in the §5 inventory. Neither document picks the implementation: who generates the UUIDv7, with what function, in what column-type-and-default expression, and how the Better Auth adapter (per ADR-0004) interacts with the schema-wide contract. SPEC.2 §1.4 #5 explicitly delegates "UUIDv7 implementation choice (Postgres-native vs userspace function) → ADR-0016 (SPEC.17)." This ADR resolves the implementation across six dimensions and locks the URL-exposure rule that consumes ADR-0011's pseudonym contract.

The decision must satisfy three load-bearing constraints. First, the substrate must work on Postgres 17 today on Supabase Pro (per ADR-0006), since neither Postgres 18 nor the `pg_uuidv7` C extension is available on Supabase as of 2026-05-08 — Supabase's latest platform release is `supabase/postgres:17.6.1.107-x-6-x86` (29 Apr 2026), the PG 18 GA target slipped from Q1 2026 to no committed date in Supabase discussion #42681, and `pg_uuidv7` has been an unactioned allowlist request since March 2024 (discussions #22015, #22584). Second, the schema must be uniform across the SPEC.2 §5 inventory — a per-table mix of UUIDv7 PKs and Better-Auth-default 32-char base62 strings would make every FK from `bets` / `comments` / `dharma_ledger` / `positions` / `friendly_fire_events` to `users.id` a heterogeneous-type relation and would break the dataset-export tooling assumption (per SPEC.1 §12.2) that every PK is a UUID. Third, the contract must be forward-compatible with the eventual PG 18 native `uuidv7()` function — when Supabase ships PG 18, the migration must be a function-replacement, not a schema-wide default-expression rewrite.

This ADR does **not** decide:

- The actual table inventory or per-table PK column names — owned by SCAFFOLD.2 + per-domain `src/db/schema/<domain>.ts`.
- Pseudonym format / pool design / FIFO consumption / asset pipeline — owned by ADR-0011 / `PSEUDONYM.md`.
- Idempotency-key format — owned by ADR-0015. Idempotency-keys are CLIENT-generated opaque strings matching `^[A-Za-z0-9_-]{1,255}$`, NOT server-allocated UUIDv7. The `Idempotency-Key` header value is explicitly out of scope of this ADR.
- The 2026-11-06 dataset-release column-by-column classification — owned by SPEC.2 Appendix B + ADR-0005's bucket classification.
- Postgres version upgrade path on Supabase — vendor-side decision; this ADR documents the contingency (when PG 18 lands, the userspace function is dropped and the native takes over) but does not commit to a date or trigger.
- `auth.users` schema (Supabase's own auth.users table). Out of scope — Better Auth ships its own `user` table and does not consume Supabase's `auth.users` (per ADR-0004 §1).
- Decimal-arithmetic library for Dharma balances — ADR-0008 / SCAFFOLD.2 / ENGINE.5.
- Type-generation cadence and migration-runner choice — ADR-0008.

## Decision Drivers

1. **Postgres 17 substrate is locked, with no PG 18 path on Supabase today.** ADR-0006 §"Persistence" ratified Supabase Pro on Postgres 17. As of 2026-05-08, Supabase has not shipped PG 18 to the platform (latest `supabase/postgres` tag is `17.6.1.107-x-6-x86`, 29 Apr 2026; the discussion #42681 Q1 2026 target has slipped without a new committed date). The `pg_uuidv7` C extension is not on Supabase's allowlist on any plan tier and three feature requests (#22015, #22584, #9500) have stood unactioned for over two years. The substrate decision must work today on PG 17 without an extension.

2. **Schema uniformity across the SPEC.2 §5 inventory.** Every primary key in the seventeen-table inventory must be the same type so that every FK is a homogeneous-type relation, the dataset-export pipeline (per SPEC.1 §12.2) can treat every PK identically, and Drizzle's type inference produces consistent `$inferSelect` / `$inferInsert` shapes. A per-table mix (UUIDv7 here, base62 string there) would multiply the FK-type matrix and complicate the public dataset's column shape — neither serves the experiment.

3. **Forward compatibility with PG 18's native `uuidv7()`.** When Supabase eventually ships PG 18, migration must be cheap. If the userspace function is named `uuidv7()` (matching the PG 18 built-in), migration is one statement (`DROP FUNCTION public.uuidv7()`) and the native takes over with zero schema churn. If the function is named anything else, every Drizzle `default(sql\`...\`)` expression has to be re-emitted and every migration row rewritten.

4. **ADR-0005 already named `events.event_id` as UUIDv7.** ADR-0005 §"Event Model (shape)" locked `event_id UUID PRIMARY KEY (UUIDv7 per ADR-0016)`. This ADR consumes that decision verbatim — no re-litigation of the events PK. The constraint shapes how this ADR describes the schema-wide contract.

5. **Better Auth controls insert paths for four of its own tables.** ADR-0004 ratified `better-auth` 1.6.x with the Drizzle adapter for `user`, `session`, `account`, `verification`. Better Auth defaults to a 32-character base62 random string (not a UUID) for these tables' primary keys, generated app-side via `crypto.getRandomValues`. To honour Driver 2 (schema uniformity), we must override Better Auth's `generateId` to emit UUIDv7 and change the column types accordingly. This is a load-bearing schema-wide override, not a per-table tweak.

6. **URL-exposure rule consumes ADR-0011's pseudonym contract.** ADR-0011 ratified that user-facing identity in URLs is a pseudonym (`<Colour><Animal>NNN`), not a raw UUID. This ADR locks the inverse: raw UUIDs MUST NOT appear in any URL exposed to participants. The rule is a property of the URL surface, not just the pseudonym surface, and belongs in this ADR because it constrains the PK contract.

7. **Per-backend monotonicity is a property, not a guarantee — and must not be relied on.** Both PG 18's native `uuidv7()` and any RFC-9562-compliant userspace implementation produce UUIDs that are strictly monotonic per backend process; neither produces UUIDs that are strictly monotonic across the connection pool. Supabase Pro fronts Postgres with Supavisor/PgBouncer in transaction-pooling mode (per ADR-0006), so two consecutive transactions from the same client may land on different backends. Application code MUST NOT assume `id(request N+1) > id(request N)` even within a session. This ADR makes the caveat explicit so SCAFFOLD.2 / ENGINE.* don't write code that depends on it.

8. **Solo-developer + Claude Code workflow ergonomics.** The schema-wide PK contract should be one helper file plus one default expression that every table copies. No bespoke per-table generation logic. No reliance on framework magic that's invisible in DDL (Drizzle's `$defaultFn` is invisible to drizzle-kit-emitted migrations). The contract should be readable from the migration set and from any single Drizzle table file.

## Considered Options

### D1 — UUIDv7 substrate

1. **Userspace PL/pgSQL function shipped in the Drizzle migration set, adapted from the kjmph gist** ← chosen
2. PG 18 native `uuidv7()` only (block on Supabase shipping PG 18)
3. `pg_uuidv7` C extension (Fabio Lima / `fboulnois`)
4. `gen_random_uuid()` (UUIDv4) for v1, migrate to UUIDv7 at testnet+

### D2 — Function name

1. **`uuidv7()` (no namespace prefix)** ← chosen
2. `zugzwang_uuidv7()` (project-namespaced)

### D3 — Default expression form

1. **DB-side via Drizzle's `default(sql\`uuidv7()\`)`** ← chosen
2. App-side via `$defaultFn(() => uuidv7())` from the npm `uuid` package
3. Both (DB default + app-side as belt-and-suspenders)

### D4 — Better Auth ID column type strategy

1. **Full override: UUIDv7 across all four Better Auth tables (`user`, `session`, `account`, `verification`)** ← chosen
2. Partial carve-out: UUIDv7 on `user` + `account` (FK-target tables); leave `session` + `verification` as Better Auth's TEXT default
3. Full carve-out: keep all four Better Auth tables on TEXT; every FK from app tables to `users.id` is TEXT

### D5 — `identity_pool` primary-key shape

1. **Synthetic UUIDv7 PK + `UNIQUE (colour, animal, number)` constraint** ← chosen
2. Composite natural-triple PK on `(colour, animal, number)`

### D6 — URL-exposure rule for raw UUIDs

1. **Forbidden on any URL exposed to participants; allowed on admin-only routes; allowed in the 2026-11-06 dataset release** ← chosen
2. Forbidden everywhere except the dataset release
3. No rule (raw UUIDs may appear anywhere)

## Decision Outcome

**Chosen across all six dimensions:**

- **D1** — Userspace PL/pgSQL function in the Drizzle migration set (the kjmph gist's pure-SQL variant, RFC-9562-compliant, MIT-spirit license per gist contributors).
- **D2** — Function named `public.uuidv7()` (no namespace prefix, matches PG 18's built-in name verbatim).
- **D3** — DB-side default expression: every Drizzle table declares `id: uuid("id").primaryKey().default(sql\`uuidv7()\`)`.
- **D4** — Full override of Better Auth's `generateId` to UUIDv7 across all four Better Auth tables; column types flipped from `TEXT` to `uuid`.
- **D5** — `identity_pool` gets a synthetic UUIDv7 `id` column as PK; the natural triple is enforced via `UNIQUE (colour, animal, number)`.
- **D6** — Raw UUIDs are forbidden on participant-facing URLs (pseudonyms only per ADR-0011); allowed on admin-only routes (per F-AUTH-ADMIN structural separation); allowed in the 2026-11-06 dataset release (per SPEC.1 §12.2).

### 1. The `uuidv7()` PL/pgSQL function

The function is shipped as a hand-written raw SQL migration at `drizzle/migrations/<NNNN>_uuidv7_function.sql`, adapted from the Kyle Hubert / Fabio Lima reference at `gist.github.com/kjmph/5bd772b2c2df145aa645b837da7eca74` (the pure-SQL variant — `dverite`'s benchmark in the gist comments shows the pure-SQL form is ~25% faster than the PL/pgSQL form). Supabase staff (`kiwicopple`) endorses this gist explicitly in discussion #9500 as "copy-paste-able UUID v7 and v8 SQL extension."

The function is created in the `public` schema as `public.uuidv7()` with `LANGUAGE sql`, marked `VOLATILE` (per RFC 9562 — successive calls within the same statement must produce distinct values; `STABLE` and `IMMUTABLE` would let the planner deduplicate calls across rows in a multi-row INSERT). It returns a `uuid` and uses `clock_timestamp()` (not `now()`, which is statement-stable) for the millisecond timestamp source.

The function carries a header comment naming RFC 9562, the source gist, the project's own license attribution ("Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later. Adapted from a community gist; original author Fabio Lima."), and a one-line operational note: "When Postgres 18 native `uuidv7()` becomes available on Supabase, drop this function with `DROP FUNCTION public.uuidv7()` and the built-in `pg_catalog.uuidv7()` takes over with no schema changes required."

The function is created in a single up-migration with a corresponding down-migration that `DROP FUNCTION IF EXISTS public.uuidv7()`. The migration runs before any table that uses the default expression — i.e., it is the lowest `<NNNN>` after the schema-bootstrap migrations and before SCAFFOLD.2's table-creation migrations.

### 2. Function-name choice and forward compatibility

Naming the function `public.uuidv7()` is the load-bearing forward-compatibility decision. PG 18's built-in is `pg_catalog.uuidv7()`. When Supabase ships PG 18, the migration to the native function is **one DDL statement**:

```sql
DROP FUNCTION IF EXISTS public.uuidv7();
```

After that statement, every existing `DEFAULT uuidv7()` clause in every table resolves to `pg_catalog.uuidv7()` via Postgres's normal name resolution. No `DEFAULT` expression rewrites. No drizzle-kit `pull` to capture the change. No per-table migrations. Zero schema churn.

The alternative — `public.zugzwang_uuidv7()` — would require a schema-wide migration at PG 18 cutover that updates every table's default expression. For seventeen tables, that's seventeen `ALTER TABLE … ALTER COLUMN id SET DEFAULT pg_catalog.uuidv7()` statements plus seventeen drizzle-kit emissions plus the corresponding Drizzle source rewrites. The decision-cost asymmetry is one-statement-now-or-seventeen-statements-later; the former wins.

### 3. Drizzle column-type and default-expression contract

Every primary-key column across the SPEC.2 §5 inventory is declared as:

```ts
import { sql } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";

id: uuid("id").primaryKey().default(sql`uuidv7()`),
```

The `default(sql\`uuidv7()\`)` form (D3) emits `DEFAULT uuidv7()` in the generated DDL, so raw-SQL inserts (the events insert helper at `src/server/events/insert.ts` per ADR-0005, future ETL scripts, manual `psql` writes during HARDEN.* operational runbooks) get a correct PK without app-layer participation. The alternative `$defaultFn(() => uuidv7())` is invisible to drizzle-kit-emitted DDL (per ADR-0008's column-types reference) and would force every direct-SQL write to either supply an `id` value or fail — wrong primitive for a schema-wide PK contract.

For app-layer code paths that need a UUIDv7 outside a database default (test fixtures, seed scripts, the Better Auth `generateId` callback per §4 below), the npm `uuid` package's `v7` export is the canonical source: `import { v7 as uuidv7 } from "uuid"`. The package is a single-file, MIT-licensed, well-maintained dependency; no per-project re-implementation.

### 4. Better Auth full override (D4)

Better Auth defaults to a 32-character random base62 string for all four of its tables (`user`, `session`, `account`, `verification`). The default is generated app-side via `crypto.getRandomValues` and passed in the INSERT statement, so the DB column type is `TEXT` in every Better Auth schema example and adapter test fixture.

This ADR overrides both halves of the default. The Drizzle schema for all four Better Auth tables declares `id` as `uuid("id").primaryKey().default(sql\`uuidv7()\`)` — same shape as every other PK in the inventory. The Better Auth config at `src/server/auth/index.ts` (the single source of truth per ADR-0004) sets:

```ts
import { v7 as uuidv7 } from "uuid";

advanced: {
  database: {
    generateId: () => uuidv7(),
  },
},
```

The callback returns a UUIDv7 string for every Better-Auth-driven insert across all four tables. Better Auth passes this string in the INSERT, so Postgres receives a valid `uuid`-typed value (the `text → uuid` cast Postgres performs on the wire is implicit and lossless for canonical-format UUID strings). The DB-side `DEFAULT uuidv7()` clause remains as a safety net for any direct-SQL insert into these tables (e.g., a test seed fixture that bypasses the Better Auth adapter).

The carve-out for Better Auth's hand-rolled session-generation logic (the 32-char base62 string) is **not** preserved — the entire point of D4 is schema uniformity, and Better Auth's `generateId` callback is the official supported customization point per `better-auth.com/docs/concepts/database` ("ID Generation"). A known footgun applies here: per Better Auth issues #2275 and #5081, returning `false` from `generateId` does NOT correctly disable generation across all versions ≥1.2.6; the override MUST always return a string. This ADR's `() => uuidv7()` always returns a string, so the footgun does not apply.

The `session.token` field — Better Auth's separate 32-char random session-cookie value — is **untouched** by this ADR. Token format is opaque to the schema-wide PK contract; only the row's `id` PK is affected.

The hand-rolled `admin_sessions` table (per ADR-0010, structurally separate from Better Auth's session system) gets the same default as every other table: `id: uuid("id").primaryKey().default(sql\`uuidv7()\`)`. No carve-out, no special treatment.

### 5. `identity_pool` synthetic UUIDv7 PK (D5)

`identity_pool` carries 50,000 rows representing every legal `(colour, animal, number)` tuple in the v1 namespace per ADR-0011. The natural key is the triple itself; one might argue for a composite PK on `(colour, animal, number)`. This ADR rejects that and chooses a synthetic UUIDv7 `id` PK with `UNIQUE (colour, animal, number)` enforcing the natural-triple uniqueness as a separate constraint. Schema-uniformity (Driver 2) is the load-bearing reason — every other table in the inventory has a UUIDv7 PK, and a single composite-PK exception would break the uniformity for one table.

The `assigned_at` column (NULL → timestamp transition per ADR-0005 Bucket B) and the FIFO-consumption discipline per ADR-0011 are unaffected. The `users.colour`, `users.animal`, `users.number` columns continue to mirror the assigned tuple (per SPEC.1 §13 F-AUTH-3); they do NOT need to carry a `users.identity_pool_id` FK, since the natural triple is sufficient and the pool consumption is a one-time write.

### 6. URL-exposure rule for raw UUIDs (D6)

The contract is three lines:

1. **Participant-facing routes — FORBIDDEN.** Pseudonyms (per ADR-0011) are the URL-exposed identifier on every user-routed page. Raw UUIDs MUST NOT appear in any URL that a participant can reach via the application's own navigation or via a shareable link. Concretely: `/u/RedFox001`, not `/u/0193abcd-...`; `/m/<market-slug>`, not `/m/<market-uuid>`; comment permalinks reference the comment's natural ordering or a server-rendered short ID, not the raw `comments.id`.

2. **Admin-only routes — ALLOWED.** Routes under `/admin/*` (gated by F-AUTH-ADMIN per ADR-0010) may expose raw UUIDs in URL paths and query strings. The threat model here is the admin operator using URL inspection to navigate the data model directly during moderation; pseudonymisation would be a usability tax for a single-operator surface and serves no privacy purpose (the admin already has full read access).

3. **2026-11-06 dataset release — ALLOWED.** The public dataset (per SPEC.1 §12.2) ships raw UUIDs as the join keys across `users`, `bets`, `comments`, `dharma_ledger`, `markets`, etc. The dataset is consumed by researchers and academics, not by participants navigating a UI; raw UUIDs are the correct join primitive for offline analysis. Pseudonyms also ship as a column, but are not the join key.

Mechanism: the rule is a property of the route handler, not the URL parser. SCAFFOLD.2's per-domain handler files (per ADR-0008 §4) MUST resolve participant-facing requests by pseudonym (or whatever surface-appropriate identifier the SPEC.1 flow names) and look up the row, never accept a raw UUID as a path parameter. Acceptance test `id::raw-uuid-not-in-participant-urls` (per §SPEC.1-§17 amendments below) checks this against every route file.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| `public.uuidv7()` PL/pgSQL function definition | `drizzle/migrations/<NNNN>_uuidv7_function.sql` |
| App-side UUIDv7 generation (test fixtures, seed scripts, Better Auth `generateId`) | `src/server/auth/index.ts` (Better Auth config) imports `v7 as uuidv7` from `"uuid"` (npm package); other call sites import directly from `"uuid"` |
| Better Auth `generateId` override + column-type override for the four Better Auth tables | `src/server/auth/index.ts` (config) + `src/db/schema/auth.ts` (table definitions per ADR-0008 §4) |
| URL-exposure-rule acceptance-test helper (regex-asserts no raw UUID appears in any participant-facing route) | `tests/server/identity/no-raw-uuid-in-urls.test.ts` |
| Per-table PK column declaration discipline (`uuid().primaryKey().default(sql\`uuidv7()\`)`) | Each `src/db/schema/<domain>.ts` file consumes the convention; no separate helper file (the convention is one line and copying it is cleaner than abstracting it) |

## Consequences

### Positive

- **Schema-uniform PKs across the SPEC.2 §5 inventory.** Every primary key is `uuid` typed with `DEFAULT uuidv7()`. Every FK is a homogeneous-type relation. The dataset-export tooling per SPEC.1 §12.2 treats every PK identically.
- **PG 18 migration is one DDL statement.** When Supabase ships PG 18, `DROP FUNCTION public.uuidv7()` is the entire migration. Zero default-expression rewrites. The future-cost of "userspace function on PG 17" is bounded at one statement.
- **App-layer ergonomics are minimal.** App code that needs a UUIDv7 imports `v7 as uuidv7` from `"uuid"`. Schema code declares `default(sql\`uuidv7()\`)`. There is no project-internal ID-generation helper to maintain.
- **DB-side default emits in DDL.** drizzle-kit-generated migrations carry the `DEFAULT uuidv7()` clause; raw-SQL writes (events insert helper per ADR-0005, ETL during HARDEN.*, manual `psql` during operations) get a correct PK without app participation.
- **Time-prefixed IDs give natural creation-order without an extra index.** UUIDv7's 48-bit timestamp prefix means `ORDER BY id` is equivalent to `ORDER BY created_at` to within milliseconds; SCAFFOLD.2 does not need a separate `created_at` B-tree index for the common "newest first" read path. (This is a property, not a load-bearing decision — the canonical sort column remains `created_at` to preserve clock-skew correctness across backends; see Driver 7.)
- **Forward-compatible function name (`uuidv7()`) gives the migration path zero ambiguity.** No per-call-site rewrites if and when Supabase ships PG 18.

### Negative

- **Per-backend monotonicity is NOT a cross-pool guarantee, and code MUST NOT rely on it (Driver 7).** PG 18's native `uuidv7()` and any RFC-9562-compliant userspace implementation produce strictly-monotonic UUIDs *per backend process only*. Supavisor in transaction-pooling mode (per ADR-0006) routes consecutive transactions from the same client across different backends. App code that assumes `id(N+1) > id(N)` is wrong. Mitigation: documented in this ADR, in SPEC.2 §17 absorption, and as the acceptance test `id::uuidv7-monotonic-within-millisecond` (which only verifies within-backend, not cross-backend, monotonicity). SCAFFOLD.2 / ENGINE.* MUST NOT write code that depends on cross-backend UUID ordering. Sort by `created_at` for any read path that needs cross-row chronological order.
- **Userspace function carries marginal generation cost vs PG 18 native.** PL/pgSQL UUIDv7 generation is ~3–5× slower than the PG 18 C built-in (microseconds per call vs sub-microsecond). At experiment scale (~50 days, peak ~100 inserts/sec across the entire stack per HARDEN.* projections), the overhead is invisible. Mitigation: not needed at v1 scale; PG 18 cutover removes it entirely.
- **Better Auth schema requires column-type overrides on four tables.** Better Auth's published Drizzle schemas use `id TEXT`; we override to `id UUID`. This adds one ADR-driven divergence from upstream's example schemas. Mitigated by: ADR-0004 already established that the schema is application-owned; this ADR adds four column-type overrides + one `generateId` config line. Concrete cost: ~5 LOC.
- **The kjmph gist's pure-SQL variant has no formal license file.** The gist has a `LICENSE.txt` and `CONTRIBUTORS.txt` (added in response to commenter requests), but the explicit SPDX identifier is not declared. Mitigated by: the function carries a header comment with the project's own copyright ("Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later. Adapted from a community gist; original author Fabio Lima."); the ~30 lines of SQL are de minimis copyrightable material; the gist is a cited reference, not a vendored dependency. Acceptable because: this is a single, well-trodden function for which substantially-similar implementations are widely available; legal risk is negligible at experiment scale.
- **`pg_uuidv7` C extension is NOT used, despite being the most-cited community choice.** Reason: not on Supabase's allowlist (Driver 1). When Supabase eventually ships PG 18, the native function is preferred over the extension regardless. The userspace-function-on-PG-17 → drop-function-on-PG-18 path makes the extension unnecessary at any phase.

### Neutral

- **The `events.event_id` PK is consumed verbatim from ADR-0005.** This ADR does not re-litigate; it confirms that the events table participates in the schema-wide contract on identical terms.
- **The `events.created_at` partitioning column (per ADR-0005) is distinct from the time-prefix encoded in `event_id`.** `created_at` is the canonical chronological column for cross-row ordering; `event_id`'s time prefix is an implementation detail of UUIDv7. Partition pruning is on `created_at`, not on the UUID prefix.
- **Idempotency-keys remain client-generated opaque strings (per ADR-0015).** No carve-out is documented in the schema-wide PK contract because idempotency-keys are not row primary keys — they live in the Redis key namespace (`idem:{key}`), not in any Postgres column. The carve-out is clarified in this ADR's "does not decide" list for completeness.
- **ULID is rejected at the option-comparison stage** — not on time-ordering grounds (ULID is also time-ordered) but on lack of a Postgres-native column type (every ULID would need a userspace PL/pgSQL function identical in scope to UUIDv7's *plus* a case-insensitive storage discipline) and on standardisation (UUIDv7 is RFC 9562, ULID is a community spec only).

## Pros and Cons of the Options

### D1 — UUIDv7 substrate

#### Option 1 — Userspace PL/pgSQL function in the migration set (chosen)

**Pros**

- Works on Postgres 17 today on Supabase, no dependency on the platform shipping a new feature or extension.
- Forward-compatible with PG 18 native via the function-name strategy in D2 — one-statement cutover.
- No vendor or extension dependency; the function lives entirely in the project's migration set.
- The kjmph gist is endorsed by Supabase staff in discussion #9500 as the recommended workaround.
- RFC-9562 compliant.
- Migration set is the existing single source of truth (per ADR-0008 §3); no new substrate.

**Cons**

- ~3–5× slower than PG 18 native; invisible at experiment scale.
- License-attribution discipline required (gist has no SPDX identifier); mitigated by the function header comment and de-minimis nature.
- Per-backend monotonicity property; documented in §Consequences.

#### Option 2 — PG 18 native `uuidv7()` only (block on Supabase)

**Pros**

- Single canonical implementation; no userspace code to maintain.
- Strictly monotonic per-backend with timestamp-as-counter fallback under clock regression.

**Cons**

- Supabase has not shipped PG 18 as of 2026-05-08; original Q1 2026 target slipped without a new committed date (discussion #42681).
- Blocking on Supabase's PG 18 timeline puts the entire experiment's launch at risk for a feature with negligible operational benefit at our scale.

**Verdict:** Rejected. The experiment cannot block on a vendor timeline outside our control.

#### Option 3 — `pg_uuidv7` C extension (Fabio Lima / fboulnois)

**Pros**

- Single-line install (`CREATE EXTENSION pg_uuidv7`) on platforms that include it.
- Native C implementation; performance parity with PG 18 built-in.

**Cons**

- Not on Supabase's allowlist on any plan tier; three open requests (#22015, #22584, #9500) unactioned for over two years.
- Cannot be installed via `pg_tle` (it ships as a C `.so`, requires superuser).
- Even if Supabase added it tomorrow, the PG 18 native function is the long-run target and the extension would be a transient dependency.

**Verdict:** Rejected. Not available on the target platform.

#### Option 4 — `gen_random_uuid()` (UUIDv4) for v1, migrate to UUIDv7 at testnet+

**Pros**

- Postgres core has `gen_random_uuid()` built-in since v13. Zero migration cost at v1.
- The project memory rule "no decisions optimising for continuity across phase boundary" arguably applies — Experiment is throwaway.

**Cons**

- UUIDv4 is random throughout; no time-prefix property. Loses the dataset-analysis ergonomics where chronological sort by ID is correct-to-the-millisecond.
- ADR-0005 already named `events.event_id` as UUIDv7. A v1 UUIDv4 default would either contradict ADR-0005 or require a special carve-out for `events`. Either is worse than just shipping UUIDv7 from day one.
- UUIDv7 implementation cost is ~30 lines of SQL plus one-line app-side import. Not an avoidable cost worth taking on for the dubious benefit of "less to do at v1."

**Verdict:** Rejected. ADR-0005 has already named UUIDv7; flipping the rest of the schema to v4 would be a same-commit ADR-0005 supersession with no offsetting benefit.

### D2 — Function name

#### Option 1 — `uuidv7()` (chosen)

**Pros**

- Matches PG 18's built-in name verbatim; cutover migration is one statement (`DROP FUNCTION public.uuidv7()`).
- Reads identically in Drizzle source whether running on PG 17 (userspace) or PG 18 (native).
- Zero rewrites at PG 18 cutover.

**Cons**

- A reader unfamiliar with the cutover path might mistake the userspace function for the native one. Mitigated by: function header comment naming the cutover plan.

#### Option 2 — `zugzwang_uuidv7()` (project-namespaced)

**Pros**

- Names the function as a project artifact; no risk of conflict with a built-in.
- Slightly clearer code-archaeology trail for someone reading the migration set in isolation.

**Cons**

- PG 18 cutover requires updating every `default(sql\`...\`)` in every Drizzle table file (~17 files for the §5 inventory) plus every drizzle-kit-emitted migration that carries the default expression.
- The "no risk of conflict with a built-in" pro is illusory: PG 18 will ship `uuidv7()` in `pg_catalog`, and Postgres's name-resolution prefers explicit-schema (`pg_catalog.uuidv7()`) and `search_path`-resolved names without conflict.

**Verdict:** Rejected. Migration cost at PG 18 cutover dwarfs the marginal readability gain.

### D3 — Default expression form

#### Option 1 — DB-side `default(sql\`uuidv7()\`)` (chosen)

**Pros**

- Emits `DEFAULT uuidv7()` in the generated DDL; raw-SQL inserts get a correct PK without app participation.
- Single source of truth: the migration set carries the contract.
- Drizzle's canonical `sql` template per ADR-0008 §6.2; same idiom as the events insert helper.

**Cons**

- The default fires only when the INSERT omits the `id` column. Better Auth's adapter passes `id` explicitly (with the `generateId` callback's value), so the DB default is dormant for those tables. Acceptable because: dormant is the correct posture; the default is a safety net, not the primary mechanism.

#### Option 2 — App-side `$defaultFn(() => uuidv7())`

**Pros**

- Drizzle generates the value in TypeScript; no DB function needed.
- Works identically on PG 17 and PG 18 with no migration cutover.

**Cons**

- Per Drizzle docs (`orm.drizzle.team/docs/column-types/pg`): "This value does not affect the drizzle-kit behavior, it is only used at runtime in drizzle-orm." The DDL has no `DEFAULT` clause; raw-SQL writes that omit `id` fail with `null value in column "id" violates not-null constraint`.
- Test fixtures, seed scripts, and ad-hoc `psql` debugging during HARDEN.* operations all become participants in the ID-generation contract. Surface-area expansion for no benefit.

**Verdict:** Rejected. Wrong primitive for a schema-wide PK contract.

#### Option 3 — Both (DB default + app-side)

**Pros**

- Belt-and-suspenders.

**Cons**

- Two sources of truth for the same contract. App-side wins on Drizzle inserts; DB default wins on raw-SQL inserts. The asymmetry is invisible to a reader.
- Better Auth full override (D4) already establishes app-side generation for four tables; combining that with `$defaultFn` on every other table makes the contract heterogeneous.

**Verdict:** Rejected. The Better Auth override is a special case driven by ADR-0004's library choice; the rest of the schema gets the simpler DB-side-only contract.

### D4 — Better Auth ID column type strategy

#### Option 1 — Full override across all four Better Auth tables (chosen)

**Pros**

- Schema-uniform across the SPEC.2 §5 inventory. Every PK is UUIDv7. Every FK is `uuid → uuid`.
- Dataset-export pipeline per SPEC.1 §12.2 treats every PK identically.
- The override is one config line (`generateId: () => uuidv7()`) plus four column-type overrides in `src/db/schema/auth.ts` (~5 LOC total).
- Better Auth's `generateId` callback is the official supported customization point.

**Cons**

- Adds one ADR-driven divergence from Better Auth's published example schemas. Mitigated by: ADR-0004 already established that the schema is application-owned.
- A future Better Auth major version may change the `generateId` signature or deprecate it. Mitigated by: the version pin per ADR-0004 §1 (1.6.x stable line) gives us pinning discipline; an upgrade triggers an ADR-0004 amendment.

#### Option 2 — Partial carve-out (UUIDv7 on `user` + `account`; TEXT on `session` + `verification`)

**Pros**

- `session` and `verification` are short-lived, ephemeral rows with no FKs from app tables; their PK type is invisible to the broader schema.
- Better Auth's default `session.id` (32-char base62) is observably ~2× shorter on the wire than a UUID's hex string; marginal storage win.

**Cons**

- The schema-uniformity property collapses on the boundary between "tables with FKs from app code" and "tables without." Maintaining the distinction is a per-developer cognitive tax.
- Two PK formats in one schema invite per-table inconsistency drift over time.
- Storage delta is in the kilobyte-per-thousand-rows range; not worth a schema-uniformity exception.

**Verdict:** Rejected. Schema uniformity is the load-bearing reason this ADR exists.

#### Option 3 — Full carve-out (all Better Auth tables stay TEXT)

**Pros**

- Zero divergence from Better Auth's example schemas.

**Cons**

- Every FK from app tables to `users.id` becomes a `uuid → text` heterogeneous-type relation. Drizzle's type inference still works, but the DDL is heterogeneous and the dataset-export tool has to special-case the user join.
- The bulk of the schema's referential surface points at `users.id`; this option contaminates the schema-wide contract for the most-referenced table.

**Verdict:** Rejected. Wrong direction; contradicts Driver 2.

### D5 — `identity_pool` PK shape

#### Option 1 — Synthetic UUIDv7 + UNIQUE(colour, animal, number) (chosen)

**Pros**

- Schema-uniform with the rest of the §5 inventory.
- Natural-triple uniqueness preserved via a separate constraint.
- A future schema change that adds an FK to `identity_pool` (none planned for v1, but the shape stays open) gets a one-column FK rather than a three-column composite FK.

**Cons**

- One extra column (`id uuid`) per row in a 50,000-row table. Storage overhead: 16 bytes × 50,000 = 800 kB. Negligible.

#### Option 2 — Composite natural-triple PK on `(colour, animal, number)`

**Pros**

- The natural key is the literal data; no synthetic abstraction.
- Saves the 16-byte synthetic column.

**Cons**

- Breaks schema uniformity for one table.
- A future single-column FK from any other table to `identity_pool` becomes a three-column composite FK.
- Drizzle's default type inference patterns assume single-column PKs; composite PKs are supported but require extra wiring.

**Verdict:** Rejected. The 800 kB storage cost is not worth a schema-uniformity exception.

### D6 — URL-exposure rule for raw UUIDs

#### Option 1 — Forbidden on participant routes; allowed on admin routes; allowed in dataset (chosen)

**Pros**

- Consumes ADR-0011's pseudonym-as-URL-identifier contract for participants.
- Preserves admin-operator ergonomics (raw UUIDs are convenient for direct data-model navigation during moderation per F-AUTH-ADMIN).
- Preserves dataset-research ergonomics (raw UUIDs are the correct join primitive for offline analysis).
- The rule is enforceable by a single regex-based acceptance test against route handler files.

**Cons**

- The rule is application-layer discipline, not a schema constraint; CI test enforcement is the ground truth, and a buggy test could let a violation through. Mitigated by: the test is a one-pattern grep against participant-facing route files, simple to maintain.

#### Option 2 — Forbidden everywhere except the dataset

**Pros**

- Stricter; no per-surface exception logic.

**Cons**

- Forces admin URLs to also use pseudonyms, which is hostile to admin operations (admin needs to navigate by `users.id` directly when investigating cross-pseudonym patterns; pseudonym-only URLs would require an extra lookup step on every admin navigation).
- F-AUTH-ADMIN's structural separation (per ADR-0010) is the boundary that makes admin URLs categorically different from participant URLs; conflating them is a category error.

**Verdict:** Rejected. Wrong by structural separation.

#### Option 3 — No rule

**Pros**

- Less to enforce.

**Cons**

- Pseudonyms become decorative rather than load-bearing for the participant trust model. ADR-0011's contract weakens silently.
- A comment author's `users.id` leaking into a comment-permalink URL would let any reader reverse-look-up the user across markets — which is exactly the property pseudonyms exist to suppress.

**Verdict:** Rejected. The rule is load-bearing for ADR-0011's trust model.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | "UUIDv7 implementation choice (Postgres-native vs userspace function) → ADR-0016 (SPEC.17)" | **Consumes** the delegation; closes the implementation-choice question |
| SPEC.2 §5 | Data Model — Table Inventory | **Mints** — every table in the seventeen-table inventory carries a `uuid` PK with `DEFAULT uuidv7()`; the `identity_pool` table additionally carries `UNIQUE (colour, animal, number)`; the four Better Auth tables (`user`, `session`, `account`, `verification`) carry the Better Auth `generateId` override |
| SPEC.2 §17 | Identifiers (shape) | **Mints** — substantive absorption of the stub by this ADR's §Decision Outcome content (function name, default expression, URL-exposure rule, per-backend monotonicity caveat) |
| SPEC.1 §12.2 | Public dataset release | **Consumes** — raw UUIDs ship as the join primitive in the 2026-11-06 dataset; the URL-exposure rule's third clause names this exception explicitly |
| SPEC.1 §17 | Acceptance tests | **Mints** five new test rows: `id::uuidv7-monotonic-within-millisecond`, `id::uuidv7-time-prefix-extractable`, `id::uuidv7-rfc9562-compliant`, `id::uuidv7-no-collision-under-load`, `id::raw-uuid-not-in-participant-urls` |
| ADR-0005 | `events.event_id UUID PRIMARY KEY (UUIDv7 per ADR-0016)` | **Consumes** verbatim — the events PK participates in the schema-wide contract on identical terms; partitioning column `events.created_at` is distinct from the time-prefix encoded in `event_id` and remains the canonical chronological-sort column |
| ADR-0006 | Postgres 17 on Supabase Pro | **Consumes** — substrate decision is bounded by the locked PG 17 platform; PG 18 cutover path is documented but not committed to a date |
| ADR-0008 | Drizzle ORM column-type and default-expression patterns | **Consumes** — `uuid().primaryKey().default(sql\`uuidv7()\`)` follows the `sql` template idiom established in ADR-0008 §6.2 |
| ADR-0011 | Pseudonym-as-URL-identifier contract | **Consumes** — pseudonyms are the participant-route identifier; this ADR locks the inverse rule (raw UUIDs forbidden on participant routes) |
| ADR-0004 | Better Auth library choice | **Consumes** — Better Auth's `generateId` callback is the customization point; this ADR overrides it; ADR-0004 is unchanged |
| ADR-0010 | F-AUTH-ADMIN structural separation | **Consumes** — admin routes are categorically distinct from participant routes; the URL-exposure rule allows raw UUIDs on admin routes for this reason |
| ADR-0015 | Idempotency-key format | **Consumes** — idempotency-keys are NOT server-allocated UUIDv7; this ADR's "does not decide" list documents the carve-out for completeness |
| Tracker | SCAFFOLD.2, every per-domain `src/db/schema/<domain>.ts` author, all downstream `ENGINE.*` / `DEBATE.*` tasks that consume the PK contract | All depend on this ADR being `accepted` |

## More Information

- RFC 9562 — *Universally Unique IDentifiers (UUIDs)*, May 2024 (obsoletes RFC 4122). UUIDv7 is defined in §5.7. <https://datatracker.ietf.org/doc/rfc9562/>
- Postgres 18.0 release notes (25 Sep 2025): native `uuidv7()` and `uuidv4()` functions added; `uuid_extract_timestamp()` extended for v7. <https://www.postgresql.org/docs/release/18.0/>
- Postgres 18 commit `78c5e141e` (Andrey Borodin) — adds the built-in `uuidv7()` with per-backend monotonicity via timestamp-as-counter fallback under clock regression.
- Brandur Leach, *Postgres UUIDv7 + per-backend monotonicity*: <https://brandur.org/fragments/uuid-v7-monotonicity> — authoritative on the per-backend-only monotonicity property and why application code must not depend on cross-backend ordering.
- Kyle Hubert (`kjmph`), *Postgres PL/pgSQL function for UUID v7*: <https://gist.github.com/kjmph/5bd772b2c2df145aa645b837da7eca74> — endorsed by Supabase staff in discussion #9500 as the recommended PL/pgSQL workaround.
- Fabio Lima, original UUIDv7 PL/pgSQL gist: <https://gist.github.com/fabiolimace/515a0440e3e40efeb234e12644a6a346> — upstream of both the kjmph variant and the `cem@uuidv7` `pg_tle` package.
- Supabase discussion #42681 — *Support postgres 18?*: <https://github.com/orgs/supabase/discussions/42681> — Supabase staff Q1 2026 target slipped without new committed date as of 2026-05-08.
- Supabase discussion #22015 — *Adding pg_uuidv7 to the PG Extension list?*: <https://github.com/orgs/supabase/discussions/22015> — open since March 2024, unactioned.
- Supabase discussion #9500 — *add pg_idkit support*: <https://github.com/orgs/supabase/discussions/9500> — Supabase staff endorsement of the kjmph PL/pgSQL function.
- Better Auth, *Database concepts*: <https://better-auth.com/docs/concepts/database> — `generateId` override hook documentation.
- Better Auth issue #2275 — `advanced.generateId: false` regression in versions ≥1.2.6: <https://github.com/better-auth/better-auth/issues/2275> — confirms the override must always return a string.
- Drizzle ORM, *PostgreSQL column types*: <https://orm.drizzle.team/docs/column-types/pg> — `uuid()` column type and `default(sql\`...\`)` default-expression pattern.
- npm `uuid` package, `v7` export: <https://www.npmjs.com/package/uuid> — MIT-licensed; canonical app-layer source.
- ADR-0005 §"Event Model (shape)" — `events.event_id UUIDv7 PK` (already locked).
- ADR-0006 §"Persistence" — Postgres 17 on Supabase Pro `ap-south-1`.
- ADR-0008 §6.2 — `sql` template idiom for column defaults.
- ADR-0011 — Pseudonym pool design and pseudonym-as-URL-identifier contract.
- ADR-0015 §"does not decide" — idempotency-key format carve-out.

---

*ADR-0016 ratifies the ID-schema contract for the Zugzwang experiment phase: UUIDv7 (RFC 9562) as the universal primary-key type across the SPEC.2 §5 inventory; userspace `public.uuidv7()` PL/pgSQL function shipped as a hand-written raw SQL migration in the Drizzle migration set (forward-compatible with PG 18's native `pg_catalog.uuidv7()` via one-statement function drop at cutover); Drizzle column declaration `uuid().primaryKey().default(sql\`uuidv7()\`)` schema-wide; full override of Better Auth's `generateId` to UUIDv7 across all four Better Auth tables; synthetic UUIDv7 PK + `UNIQUE (colour, animal, number)` for `identity_pool`; raw UUIDs forbidden on participant-facing URLs (pseudonyms only per ADR-0011), allowed on admin-only routes (per F-AUTH-ADMIN structural separation), allowed in the 2026-11-06 dataset release (per SPEC.1 §12.2); per-backend monotonicity property documented but not relied on across the Supavisor connection pool. The decision body and any constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
