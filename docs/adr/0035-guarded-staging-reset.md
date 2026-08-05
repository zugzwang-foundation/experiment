# ADR-0035 — Guarded Staging Reset via Owner-Privilege Trigger Disablement

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | STAGING-PARITY Slice A (reset). Gates Slices B–D, POLISH.1–.8, and SP-2. |
| **Frame document** | SPEC.2 §6 (append-only buckets); SPEC.1 INV-2, INV-4; `docs/plans/STAGING-PARITY.md` Q3 + Ratification Record §5 W-B; `docs/polish/POLISH-0_data-manifest.md` §1.9; ADR-0030 (TRUNCATE rejection); ADR-0024 (deploy pipeline / drift guard); SPEC.2 ADR Index |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Staging's fixture data is not thin — it is counterfeit. 37 of 39 `bets` rows were written by two scripts that raw-`INSERT`ed against `users`, `markets`, `pools`, `comments`, `bets`, `positions` and `mod_actions` without ever calling the engine. Those rows carry `share_quantity = 0`, no `bet.placed` event, no ledger row and no position — a purchase that produced no goods, which the CPMM cannot generate. A third corruption class exists alongside them: one market sits at `status = 'Resolved'` with zero `resolution_events` and zero `payout_events`, its status hand-set. `episodes.ts:168` correctly refuses to render a profile holding such a row, so 13 of 16 users return "Couldn't load this profile."

Repair is not available. Bucket A is append-only by database enforcement — `BEFORE UPDATE` and `BEFORE DELETE` row triggers `RAISE EXCEPTION` on nine base tables plus `bet_receipts`, and `0021_truncate_guards.sql` added statement-level triggers closing the `TRUNCATE` route on every protected relation and each of the thirteen `events_*` partitions individually. **There is no `UPDATE` that fixes a bad row and no `DELETE` that removes one.** That is the property that makes the ledger credible, and it is working exactly as designed.

The only route through is owner privilege. The connection's role owns all thirty-eight public tables, so `ALTER TABLE … DISABLE TRIGGER` is available to it. A precedent already exists at `tests/db/_fixtures/truncate.ts` — but it is deliberately test-only and says so in its own header: *never import this from `src/**`; production must not gain an escape hatch.*

So the decision is not "how do we wipe staging." It is whether a **committed operational artifact whose job is to switch off the enforcement layer behind two invariants** may exist at all, and if so under what contract. This is the highest-risk artifact in STAGING-PARITY and the only one that earns a `@security-auditor` pass on its own merits.

This ADR does **not** decide:

- The execution vehicle for the reset or the generator — ADR-0036.
- `CHECK (share_quantity > 0)` on `bets` — its own task and its own ADR, sequenced **after** STAGING-PARITY so the migration meets zero violating rows (register row SP-2).
- What the regenerated fixture set contains — `docs/polish/POLISH-0_data-manifest.md` §2.
- Whether the regenerated data is correct — the six gates in `docs/plans/STAGING-PARITY.md`.
- The external cron scheduler for staging — STAGING-PARITY-ENV.
- Anything about production. Production reset is not deferred, not scoped, not designed. It does not exist.

## Decision Drivers

1. **Repair is structurally unavailable.** Append-only means the counterfeit rows can only be removed wholesale, never corrected in place.
2. **Staging is a shared dependency of eight surfaces.** Every POLISH task ends at "verify on staging"; on 2026-08-05 alone, invalid fixture data obscured three separate questions in one afternoon. Without a trustworthy environment, eight surfaces merge unverified.
3. **This artifact's job is to disable the enforcement that makes the ledger credible.** It cannot be reviewed as ordinary tooling.
4. **The irreversibility is asymmetric.** A failed staging run costs an afternoon. A wrong-target run costs the experiment. The guard contract must be sized against the second, not the first.
5. **Ninety-day lifetime.** Everything dies 2026-11-05. Build the minimum that works and stop; no fixtures framework, no reusable abstraction.
6. **The existing precedent is deliberately test-only**, and promoting its pattern is therefore a decision rather than a convenience.
7. **The guards' source of truth is the migrations**, not any hand-maintained list. A reset carrying an independently-authored guard list will silently drift the moment a migration adds a table.

## Considered Options

1. **Owner-privilege `DISABLE TRIGGER` → `TRUNCATE … CASCADE` → `ENABLE`, issued as a single implicit transaction, behind a four-part guard contract, committed under `tests/staging/`** ← chosen
2. Drop and rebuild the schema from migrations `0000` → head
3. Additive generation — leave the counterfeit rows, generate valid data alongside
4. Import `tests/db/_fixtures/truncate.ts` directly and reuse `truncateTables()`
5. Manual, uncommitted DBA operation performed by the operator when needed

## Decision Outcome

**Chosen: Option 1 — guarded owner-privilege trigger disablement, committed under `tests/staging/`.**

Seven primitives are ratified together. Each is load-bearing; none may be relaxed without a superseding ADR.

**1 · The pattern is permitted, narrowly.** A committed artifact may disable append-only enforcement, subject to every constraint below. It lives under `tests/staging/`, is never imported from `src/**`, and is never reachable from any product code path. `tests/db/_fixtures/truncate.ts` keeps its test-only header unchanged and is **not** imported by the reset — see primitive 7.

**2 · Atomicity is the primary mechanism; `finally` is a belt.** The disable → truncate → enable sequence is issued as **one parameterless `client.unsafe()` round-trip**, which under the simple-query protocol is one implicit transaction. `ALTER TABLE … DISABLE TRIGGER` is transactional DDL in Postgres, so any abort — a failed `TRUNCATE`, a killed process, a dropped socket, an OOM — rolls the disable back with it. **The guards cannot be left off, because they are never committed off.**

This is a **correction to `POLISH-0_data-manifest.md` §1.9**, which prescribed a `try/finally` re-enable as the primary guarantee. `finally` does not run on `SIGKILL`, on a lost connection, or on OOM — precisely the failures that matter. The `finally` is retained as a belt and explicitly demoted. The manifest is amended to match at v1.2.

**3 · Only the `_no_truncate` guards are ever disabled.** `bucket_a_no_update`, `bucket_a_no_delete`, `bucket_b_no_delete` and `bucket_b_update_check` are **never** disabled, under any circumstance, for any duration. The reset removes rows wholesale; it never acquires the ability to edit one.

**4 · The exclusion set — two tables are never truncated.**

- **`drizzle.__drizzle_migrations`.** It sits in the `drizzle` schema, appears in no guard list, and is not FK-reachable from `public`, so `CASCADE` cannot reach it. Truncating it would make `drizzle-kit migrate` believe zero migrations are applied and attempt to re-run `0000` onward against a populated schema; `/api/health` would report drift. It is data the database cannot regenerate.
- **`system_state`.** This exclusion is counter-intuitive and is stated at length for that reason. `system_state` **does** appear in `TRUNCATE_GUARDS`, so the obvious source of truth actively invites truncating it. Its singleton row is seeded by migration `0004`, which drizzle believes is applied and will never re-run; `db:seed:staging` seeds only `identity_pool`. And `isFrozen()` reads `row?.frozenAt != null`, so **a missing row fails open silently** — the freeze sentinel would simply cease to exist with nothing reporting it. It is excluded, and its guards are never disabled.

**5 · `identity_pool` is truncated and immediately re-seeded.** `assigned_at` is a one-way Bucket-B transition, so tuples consumed by users the reset deletes are permanently stranded — roughly ten to twelve per run, walking toward `identity_pool_exhausted` over the weeks POLISH runs. Re-seeding is idempotent and costs one command. The consequence of the alternative is worse than the cost: pseudonyms would drift upward every run, breaking the coverage URL list on every regeneration and destroying reproducibility.

**6 · The guard contract — four guards, three of them hardened beyond the plan's Q3.**

| Guard | Requirement |
|---|---|
| **G-1 · Target** | `DATABASE_URL_STAGING` must be set **and** contain `STAGING_PROJECT_REF_FRAGMENT`, and must not contain the production ref. **Fail closed on absence:** if either variable is unset, refuse. **Never fall back to `DATABASE_URL`** — the reset must not be able to inherit a connection string from ambient environment |
| **G-2 · Environment** | `ZUGZWANG_ENV` must **equal** `"staging"`. A positive match, not a negation — an unset or unknown value refuses |
| **G-3 · Live connection** | Assert positively against the socket about to be used: `current_database()` and the ref fragment, read from the connection, not from config. **A config can say staging while the connection says otherwise** |
| **G-4 · Post-run verification** | After the batch, a catalog query over `pg_trigger` must return the full guard set with `tgenabled = 'O'` on every row. Any deviation prints the offending `(table, trigger, tgenabled)` rows and exits non-zero. Additionally: `system_state`'s singleton row must exist with `frozen_at IS NULL`, and `drizzle.__drizzle_migrations` must retain its row count. Failure of either exits non-zero |

G-4 is verification, not assumption. It is what notices if a future edit splits the single batch into separate round-trips and turns primitive 2's guarantee off.

**7 · The reset re-implements rather than imports, and its guard list is asserted against the migrations.** Reusing `truncateTables()` would couple an operational staging artifact to a local-test fixture whose requirements differ — the test fixture may wipe everything and re-migrate, whereas the reset must preserve `system_state` and `__drizzle_migrations`. Two artifacts, two requirement sets. The drift risk this creates is closed not by sharing code but by naming the real source of truth: **a unit test asserts the reset's guard-list constant matches `drizzle/migrations/0003`, `0021` and `0022` exactly.** The migrations are the authority; neither the reset nor the fixture is.

**Lifetime.** Staging only. Dies with the experiment on 2026-11-05. Never reachable from `src/**`. No production analogue is designed, deferred, or implied.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The guarded staging reset | `tests/staging/reset.staging.test.ts` |
| What the guard set contains | `drizzle/migrations/0003_*.sql`, `0021_truncate_guards.sql`, `0022_bet_receipts.sql` — the reset's constant is **asserted equal** to these, never authored independently |
| The test-only local truncate fixture | `tests/db/_fixtures/truncate.ts` — unchanged, still test-only, **not imported by the reset** |
| Staging target credentials | Doppler config `stg` — `DATABASE_URL_STAGING`, `STAGING_PROJECT_REF_FRAGMENT` |

## Consequences

### Positive

- The counterfeit rows can be removed at all, which no other option achieves.
- The append-only property is suspended for exactly one transaction, for exactly one operation class, on exactly one environment — a far narrower opening than a schema rebuild or a relaxed runtime role.
- Rollback is a property of Postgres rather than of the script's control flow, so it holds under process death.
- The guard-list-versus-migrations assertion means a new protected table cannot be silently missed by the reset.
- The `system_state` exclusion converts a silent fail-open into a checked post-condition.
- One command, re-runnable, so recovery from a bad staging state is a procedure rather than a diagnosis.

### Negative

- A committed artifact now exists whose function is to disable invariant enforcement. *Mitigated by:* the four guards, the `tests/staging/` location, the never-from-`src/**` rule, the `@security-auditor` pass, and this ADR.
- Two truncate implementations coexist. *Mitigated by:* the migrations being the named source of truth, with the reset's list asserted against them — the drift is checkable rather than trusted.
- Every reset destroys P-owner's OAuth linkage; without a capture-before-reset step the operator's next staging sign-in fails on a `users_email_idx` collision. *Mitigated by:* the capture step is mandatory and precedes the first reset.
- Every rebuild orphans R2 objects behind the truncated `image_uploads` rows, and the orphan-sweep cron does not fire on staging. *Acceptable because:* volume is trivial across a ninety-day asset; recorded rather than solved.
- Truncating `identity_pool` means pseudonym-to-role mapping depends on seed insertion order remaining deterministic. *Mitigated by:* the seed builds its rows in a fixed loop, and reproducibility is asserted by the coverage gate.

### Neutral

- ADR-0030 is **not** superseded. Its owner-privilege escape is acknowledged in `0021` itself; this ADR ratifies a guarded use of an escape that document already names, and mints no new privilege. *The exact wording of ADR-0030 must be verified at commit time — if it forbids rather than merely notes the escape, this ADR requires a `Supersedes` link and a same-commit SPEC.2 update.*
- The reset does not touch Supabase-managed schemas (`auth`, `storage`, `vault`, `extensions`) or the two live `pg_cron` schedules.

## Pros and Cons of the Options

### Option 1 — Guarded owner-privilege disablement (chosen)

**Pros** — the only option that removes the counterfeit rows without rebuilding the schema; rollback is enforced by Postgres, not by script discipline; the opening is bounded to one transaction and one operation class; the guard list is checkable against migrations.

**Cons** — creates a committed artifact that disables enforcement; requires the full critical-path ritual; a second truncate implementation.

### Option 2 — Drop and rebuild the schema from migrations

**Pros** — no trigger disablement at all; guarantees a schema matching head.

**Cons** — `drizzle.__drizzle_migrations` would still claim twenty-five migrations applied against an empty schema unless separately cleared, and clearing it is its own hazard; the two `pg_cron` schedules are declared with no `IF NOT EXISTS` and no un-schedule, so a rebuild relies on same-jobname replace; Supabase-managed schemas complicate a clean drop; far larger blast radius for the same outcome.

**Verdict:** Rejected. More destructive and less predictable than the narrow option, with two recovery hazards the narrow option does not have.

### Option 3 — Additive generation, no wipe

**Pros** — zero disablement; trivially safe.

**Cons** — the 37 counterfeit rows survive, so gate 6 cannot pass and SP-2's future `CHECK` constraint could never be applied; twelve raw-inserted users would persist; the `Resolved`-with-no-`resolution_events` market would remain a lie the product reports as settled.

**Verdict:** Rejected. Fails the task's purpose outright.

### Option 4 — Import and reuse `tests/db/_fixtures/truncate.ts`

**Pros** — one implementation, no drift between them.

**Cons** — couples an operational staging artifact to a local-test fixture with different requirements; the fixture has no notion of the `system_state` or `__drizzle_migrations` exclusions; a future change made for local-test reasons would silently change staging behaviour; and the fixture's own header exists to keep it out of exactly this kind of promotion.

**Verdict:** Rejected. The drift it prevents is better prevented by asserting against the migrations, which are the actual authority.

### Option 5 — Manual uncommitted operation

**Pros** — nothing committed; nothing to review.

**Cons** — unreviewable, unrepeatable, unguarded; no target check, no post-run verification, no record of what ran. Manifest §1.3 requires reproducibility across the weeks POLISH runs.

**Verdict:** Rejected. Strictly the most dangerous option, and it only looks safe because nothing is written down.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §6 | Bucket A / Bucket B append-only | **shapes** — ratifies a staging-only, single-transaction suspension of the `_no_truncate` guards **only**; `_no_update` and `_no_delete` are never disabled |
| SPEC.1 INV-4 | Resolutions append-only | **shapes** — `resolution_events` and `payout_events` are truncated on staging; their update and delete guards remain enabled throughout |
| SPEC.1 INV-2 | Dharma non-transferable, no overdraft | **consumes** — `dharma_ledger` is truncated wholesale; conservation is re-established after regeneration by gate 2, not preserved across the reset |
| ADR-0030 | TRUNCATE rejection | **shapes** — does not supersede; ratifies a guarded use of the owner-privilege escape `0021` already names. Verify at commit |
| ADR-0024 | Deploy pipeline, per-hash drift guard | **consumes** — `__drizzle_migrations` excluded so `/api/health`'s migrations field stays `ok` after every reset |
| ADR-0011 | Identity pool | **shapes** — `identity_pool` truncated and re-seeded, so `assigned_at` consumption does not accumulate across runs |
| Register | SP-1, SP-2, SP-3 | **consumes** — SP-3 stands: `episodes.ts:168` is correct and is not weakened. This ADR removes the rows it refuses; it does not soften the refusal |
| Tracker | STAGING-PARITY Slices A–D → POLISH.1–.8 → SP-2 | All depend on this ADR being `accepted` |

## More Information

- `docs/plans/STAGING-PARITY.md` — Q3 (reset design), S4 (investigation record), Ratification Record §5 W-B (guard hardening), §5 W-A (the §1.9 correction).
- `docs/polish/POLISH-0_data-manifest.md` §1.9 — the constraint this ADR corrects.
- `tests/db/_fixtures/truncate.ts` — the pattern's origin, and the header that made this a decision.

## Addendum — 2026-08-06

*Appended at STAGING-PARITY Slice A, pre-Gate-C. Primitives 1–7 above are unaltered.*

### A.1 · G-5 — the watch-mode refusal

**Added to the guard contract. Additive to primitive 6's four guards; it relaxes none of them.**

`pnpm staging:reset` sets an acknowledgement token, `ZUGZWANG_STAGING_RESET_ACK`, and nothing else in the repo sets it. The target guard refuses unless it is present and exactly equal to the expected value. It is evaluated at module scope alongside G-1 and G-2, so a failure throws during collection and no client is ever constructed.

**Why it exists.** G-1 through G-4 are all *environmental*: each proves **where** the connection goes, and none proves the operator **meant** to run a destructive wipe at that moment. That gap is not theoretical, because of how this artifact will actually be used. Through Slices B–D the operator lives inside `doppler run --project zugzwang-experiment --config stg -- …` shells, where every environmental guard is already satisfied by construction. In that shell:

- **`vitest --config vitest.staging.config.ts`** — without `run` — is **watch mode**. It wipes staging once, and then **re-wipes on every subsequent file save**, silently, for as long as the process lives.
- **`vitest run --config vitest.staging.config.ts`** with no positional filter matches the config's whole include glob. Today that is only the reset; once Slice B adds generator and gate runners under the same glob, a positional-less run sweeps the reset in alongside them.
- **`pnpm staging:reset:exec`** skips the Doppler wrapper and inherits the ambient shell.

Each of those is a plausible keystroke, not an attack. G-5 is the one guard that asks *"did you mean this run?"*, and it is the only guard a correct-environment invocation cannot satisfy by accident.

**Cost of the alternative.** Adding a refusal cannot destroy data; omitting one can. G-5 was therefore added rather than deferred, and it is recorded here rather than left as an undocumented fifth check.

**Scope.** Staging only, as with everything in this ADR. It is a refusal condition, not a mechanism: it changes nothing about the batch, the exclusion set, or which guards are disabled.

### A.2 · The amendment rule

> An addendum to an accepted ADR may ADD a refusal condition. It may never remove one, widen a permitted set, or change a mechanism. Those three require a superseding ADR.

---

*ADR-0035 ratifies a narrowly-guarded, staging-only, single-transaction suspension of the `_no_truncate` append-only guards, so counterfeit fixture data can be removed and regenerated by the real engine. The decision body and the constraints minted in primitives 1–7 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
