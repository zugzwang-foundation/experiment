# DATA-MODEL.md — 22 tables, 10 schema files, 3 buckets

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6` · **Derived from:** `src/db/schema/*` +
SPEC.2 §5 + `drizzle/migrations/`.

**Census:** 22 Drizzle-declared tables across 10 domain files (`src/db/schema/` also holds
`_enums.ts` and the `index.ts` barrel, which declare no tables). SPEC.2 §5.1 counts **24**:
the extra two — `watermark_state` and `cron_alarms` — are pg_cron operational machinery
created by **raw SQL in migration `0007_pg_cron_jobs.sql`**, deliberately outside Drizzle
(`drizzle.config.ts` also excludes the partitioned `events` table via
`tablesFilter: ["!events"]`). Migration head at this pin: `0023`.

---

## The tables, by schema file

Bucket letter in brackets: **[A]** strictly append-only · **[B]** append-only with one
whitelisted transition · **[C]** mutable.

| File | Tables (one line each) |
|---|---|
| `auth.ts` | `users` [C] — Better Auth user + pseudonym + ToS evidence + the `last_allowance_accrued_at` Daily-Credit cursor · `sessions` [C] — participant session (`zugzwang_session`) · `accounts` [C] — OAuth linkage · `verifications` [C] — email-OTP storage · `admin_sessions` [C] — hand-rolled 3-column admin session (`zugzwang_admin_session`, ADR-0010) |
| `markets.ts` | `markets` [C] — market metadata + status (whitelisted status transitions via W-4) · `pools` [C] — CPMM reserves, locked first in the W-1 chain · `market_media` [C] — admin-set per-market media pool, **no `user_id`** (ADR-0026) |
| `bets.ts` | `bets` [A] — per-bet record, `comment_id` **NOT NULL** (INV-1's built half) · `positions` [C] — per-user-per-market holding, updated inside W-1 · `bet_receipts` [A] — durable idempotency receipts, UNIQUE on `idempotency_key` (ADR-0031) |
| `comments.ts` | `comments` [A] — argued commentary; `side_at_post_time` frozen (INV-3); `bet_id` nullable **by design** (below) |
| `dharma.ts` | `dharma_ledger` [A] — every Dharma delta; `CHECK (balance_after >= 0)` (INV-2); total order via `seq` (ADR-0029) |
| `events.ts` | `events` [A] — the event-sourced spine, hand-partitioned monthly (raw SQL `0002`), composite PK `(event_id, created_at)` · `resolution_events` [A] — one row per resolve/correct/void (INV-4) · `payout_events` [A] — per-bet settlement fan-out (INV-4) |
| `audit.ts` | `mod_actions` [A] — moderation audit trail · `admin_events` [A] — admin-action audit · `user_events` [A] — user lifecycle audit (ToS, pseudonym) |
| `identity.ts` | `identity_pool` [B] — 50,000 pseudonym+PFP tuples; transition `assigned_at NULL → timestamp` once |
| `image-uploads.ts` | `image_uploads` [B] — upload lifecycle; `terminal_state` + `terminal_at` set **together, once** |
| `system.ts` | `system_state` [B] — single row `id='system'`; `frozen_at NULL → timestamp` once (the conclusion freeze) |

## The append-only bucket map

| Bucket | Count | Tables | Enforcement (storage layer) |
|---|---|---|---|
| **A** | 10 | `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts` | Row-level `BEFORE UPDATE`/`BEFORE DELETE` → `RAISE EXCEPTION`: `drizzle/migrations/0003_append_only_triggers.sql`. Statement-level `BEFORE TRUNCATE` (ADR-0030): `0021_*.sql`. `bet_receipts` ships **all three** guards in `0022_*.sql`, reusing the shared functions (never unguarded). |
| **B** | 3 | `identity_pool`, `image_uploads`, `system_state` | Per-table trigger comparing OLD/NEW images; permits only the named one-shot transition; DELETE + TRUNCATE rejected (`0003` + `0021`). |
| **C** | 9 | `users`, `sessions`, `accounts`, `verifications`, `admin_sessions`, `markets`, `pools`, `positions`, `market_media` | No append-only trigger — constraint-driven validation only. (+ the 2 raw-SQL pg_cron tables `watermark_state`, `cron_alarms`, also mutable.) |

Test backstops: `tests/db/triggers/` (13 per-table append-only specs + `truncate-rejected.spec`)
and `tests/invariants/` (repo scheme INV-1..4 by name — see the numbering-trap warning in
`00_START-HERE-PROJECT.md`).

## The two deliberate asymmetries (do not "fix", do not file)

**1 · `comments.bet_id` is nullable BY DESIGN — `bets.comment_id` is NOT NULL.**
The circular `comments ↔ bets` pair can only set one FK direction at write time: the W-1
SERIALIZABLE transaction inserts the comment first (its bet doesn't exist yet), then the
bet carrying `comment_id NOT NULL` — and Bucket-A append-only forbids ever back-filling
`comments.bet_id`. INV-1 (no comment without a bet, no bet without a comment) is enforced
by `bets.comment_id NOT NULL` **plus W-1 atomicity** (`I-ATOMICITY-001`), not by
`comments.bet_id`, which stays NULL by construction and is relied on by nothing. This is
**not** a pending NOT-NULL migration (ADR-0017 reconciliation, DEBATE.8).

**2 · There is no Dharma transfer table — soulbound is structural.**
INV-2's non-transferability is not a permission check: the schema simply has **no
user-to-user transfer surface**. Every Dharma movement is an append-only `dharma_ledger`
row minted by a system flow (grant, daily credit, stake, payout, refund, correction), and
`CHECK (balance_after >= 0)` forecloses overdraft. If you find yourself looking for the
transfer endpoint to attack — there isn't one, and a PR adding one is the repo's own
refusal trigger (CLAUDE.md §3).

## One build-deferral to know (so you don't flag it)

SPEC.2 §5.1's `comments` row describes a ratified target with `market_media_id` (+ a
not-both-set CHECK vs `image_uploads_id`). That column is **not in DDL at head `0023`** —
it ships with the composer-pick stratum (AUDIT.1 D2 deferral, noted in the spec row
itself). Spec-vs-DDL diff here is known, not drift.

---

*EXTAUDIT-06 kit · file 5 of 7.*
