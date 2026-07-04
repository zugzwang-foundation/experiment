# ADR-0030 — TRUNCATE rejection on append-only tables

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-04 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | AUDIT-FIX-B2 |
| **Frame document** | AUDIT.1 master report finding A20; INV-A20 probe (2026-07-04); `docs/plans/AUDIT-FIX-B2.md` |
| **Supersedes** | — (extends the §6 append-only enforcement contract established under ADR-0005 / ADR-0008 + `0003_append_only_triggers.sql`) |
| **Superseded-by** | — |

**This ADR does not decide:** the ledger ordering contract (ADR-0029); the durable dedicated non-owner runtime role (parked, pre-Sep-15 target, `parked.md` OQ-2); the D2-C drift derivation (parked, OQ-3).

## Context and Problem Statement

The §6 append-only enforcement contract protects twelve tables (nine Bucket A, three Bucket B) with `BEFORE UPDATE` and `BEFORE DELETE` `RAISE EXCEPTION` triggers — the physical ground truth behind INV-2/INV-3/INV-4. The contract has a hole: **`TRUNCATE` fires no row-level triggers in Postgres.** A `TRUNCATE dharma_ledger` (or any protected table) empties it with no trigger trip and no DDL — directly falsifying SPEC.2 §6.5's claim that a table cannot be written/cleared "without an audit-visible schema change."

**INV-A20 probe (staging, read-only, 2026-07-04):** the application DB role (Doppler `stg` `DATABASE_URL`) is `postgres`, the **owner** of all twelve protected tables; `has_table_privilege(…, 'TRUNCATE') = t` on all twelve. Two consequences follow, and they are the honest headline of this ADR:

1. **`TRUNCATE` cannot be revoked from a table owner.** Owner privileges are implicit — grant surgery is a no-op while the app connects as owner. So "fix the grant" is not available; the operative mitigation is a trigger.
2. **The owner can `ALTER TABLE … DISABLE TRIGGER`.** A full-SQL actor connecting as owner can therefore disable any append-only trigger and then mutate or truncate at will. This means the *entire* §6 guard — not just the new TRUNCATE trigger — is, in production, a **defense-in-depth barrier** (against accidents, blast-radius, and unsophisticated injection), **not a hard boundary** against an owner-level attacker. SPEC.2 §6.5's framing ("service-role credentials cannot circumvent … caught by HARDEN.* migration-review CI lint") tacitly assumed a *restricted* runtime role; the runtime role is in fact the owner.

The durable fix is a dedicated **non-owner runtime role** (Supabase role + connection + Vercel-env re-plumbing), which closes the DISABLE-TRIGGER path entirely. That is infrastructure work separable from this code/DDL batch; it is parked with a **pre-Sep-15 target** (before real participant data accrues), because the append-only guarantee is a load-bearing thesis mechanism for the released dataset. This ADR lands the trigger belt now — worth landing regardless, since it stops the accidental / blast-radius / unsophisticated-injection cases the role split does not need to be in place to defend.

## Decision Drivers

- Close the `TRUNCATE` gap in the append-only contract at the storage layer.
- State the threat model honestly (owner-privilege reality, not an optimistic "cannot circumvent").
- Preserve test-suite compatibility (tests currently reset via `TRUNCATE`).
- Forward-safety: partition-adding migrations must not silently reopen the hole.

## Considered Options

- **(a)** `BEFORE TRUNCATE … FOR EACH STATEMENT` `RAISE EXCEPTION` triggers on all protected tables (and every `events` partition).
- **(b)** Revoke the `TRUNCATE` grant from the app role.
- **(c)** Rely on the non-owner runtime-role split alone.

## Decision Outcome

**Chosen: (a)**, with **(c)** parked as the durable follow-up. **(b) is disqualified** — a no-op against a table owner.

`0021_*.sql` (raw-SQL, `0003` style; journaled via `drizzle-kit generate --custom` — drizzle-kit does not see triggers, so no snapshot impact, and there is no `pg_cron` involved so the CI strip is unaffected). It adds:

- a new shared `enforce_bucket_a_no_truncate()` — bare `RAISE EXCEPTION` at the **statement** level. It is a *new* function, not a reuse: the Bucket-A `no_update`/`no_delete` functions are `FOR EACH ROW`, and the Bucket-B per-table functions compare `OLD`/`NEW` — neither is statement-safe. A Bucket-B analog is added the same way.
- **25 `BEFORE TRUNCATE … FOR EACH STATEMENT` triggers**: the 8 non-partitioned Bucket-A tables + the `events` **parent and all 13 partitions** + the 3 Bucket-B tables. The partition coverage is load-bearing: in PG17 statement-level triggers **do not clone to partitions** (verified empirically via `tgparentid`), and a direct `TRUNCATE <partition>` skips the parent's trigger — so each partition carries its own.

**Test-teardown posture.** Integration/server teardowns currently `TRUNCATE` protected tables (they must, since `DELETE` is trigger-rejected). The guard breaks them. Resolution: a **test-only** `truncateTables()` fixture that, for protected tables, wraps `ALTER TABLE … DISABLE TRIGGER <truncate-guard>` → `TRUNCATE` → re-enable within one implicit transaction — **owner-privilege only** (no `session_replication_role`, no production escape-hatch GUC). The `security-auditor` verified this helper is unreachable from any `src/` production path; it exists solely in the test tree. (This helper *demonstrates* the owner-can-disable reality above — which is precisely why the durable fix is the role split, not a stronger trigger.)

**§6.5 reconciliation.** The rider updates §6.5 to state that the runtime role is currently the table owner, so the DISABLE-TRIGGER bypass is runtime-reachable and the guard is defense-in-depth (accidents/blast-radius/unsophisticated injection), with the non-owner role split as the parked durable closure.

**Forward obligation.** Any future migration that adds an `events` partition (or a new protected table) MUST add the matching `BEFORE TRUNCATE … FOR EACH STATEMENT` trigger in the same migration. Recorded here and in the SPEC.2 §6 rider.

## Single-source file map

| File | Role |
|---|---|
| `drizzle/migrations/0021_*.sql` | `enforce_bucket_a_no_truncate()` (+ Bucket-B analog) + 25 statement-level TRUNCATE-reject triggers |
| `tests/db/_fixtures/*` | test-only `truncateTables()` (disable → truncate → re-enable; owner-privilege; no prod escape hatch) |
| `tests/db/triggers/truncate-rejected.spec.ts` | TRUNCATE rejected on all 12 + `events` parent + a direct partition; positive control on the fixture |

## Consequences

**Positive.** The accidental / blast-radius / unsophisticated-injection `TRUNCATE` cases are closed at the storage layer; SPEC.2 §6.5 now reflects the true threat model; the over-privileged-role finding is surfaced and tracked rather than latent.

**Negative.** Not a hard boundary until the runtime-role split lands (parked, pre-Sep-15). A test-only disable-trigger fixture exists (bounded to the test tree; auditor-verified). 25 triggers to maintain, with a standing forward obligation on partition-adding migrations.

**Neutral.** No `src/` behavior change; drizzle snapshot unaffected (triggers are invisible to drizzle-kit); no CI-strip interaction.

## Pros and Cons of the Options

**(a) statement-level TRUNCATE triggers.** *Pros:* privilege-independent (a firing trigger aborts the statement pre-truncation regardless of role); immediate; closes the common cases. *Cons:* owner can still `DISABLE TRIGGER`; per-partition maintenance. **Verdict: chosen (the immediate belt).**

**(b) revoke the grant.** *Cons:* structurally a no-op against an owner. **Verdict: disqualified.**

**(c) non-owner runtime role.** *Pros:* the only option that fully closes the DISABLE-TRIGGER path. *Cons:* Supabase/Vercel infra re-plumbing, out of this batch's scope. **Verdict: parked, pre-Sep-15 target.**

*The triggers raise the bar against every unsophisticated path to an empty ledger; the honest remaining gap — an owner disabling its own guard — is closed only by not connecting as the owner, which is the parked role split.*
