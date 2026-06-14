# ENGINE.16 — Conclusion-Freeze Enforcement (read-guard)

> Ratified plan. **Pure code-only deliverable** — no SPEC edit, no ADR, no migration. A fresh chat
> executes the code (this is the plan PR).

---

## Context

The 2026-11-05 23:59 UTC conclusion freeze (SPEC.1 §12.1, SPEC.2 §20) is the moment every
participant state-mutating endpoint must stop accepting writes. SPEC.2 §20.2 designs the gate as a DB
flag (`system_state.frozen_at IS NOT NULL`) read by a helper `isFrozen()` at handler-stack step 1.

**The gap (origin of ENGINE.16).** The ENGINE.15 execute audit logged
(`docs/logs/ENGINE.15.md:261-265`, verbatim):

> "**`system_state.frozen_at` write-freeze UNENFORCED** in the W-3/W-4 lifecycle/resolution write
> paths (never read before writing) — **pre-existing** (ENGINE.9/14 services), NOT fixable in
> ENGINE.15 (byte-frozen wrappers), **newly reachable by automation via the wired close-due cron**
> (close-only blast radius). A real gap against the §3 conclusion-freeze refusal contract.
> **Founder-prioritized to a dedicated ENGINE.10/HARDEN task.**"

P0 recon (2026-06-14) confirmed the gate is **100% greenfield**: no `isFrozen()`, no
`src/server/system/`, no `error_experiment_concluded` string anywhere in `src/`/`tests/`;
`system_state.frozen_at` is referenced only inside its own schema file (seeded `NULL`, never
read/written by app); the `→ Frozen` market edge exists in `transitions.ts` but has no writer.

ENGINE.16 builds the **read-guard only**: `isFrozen()` + its wiring onto the two **participant/system**
state-mutating surfaces that exist today, plus RED-first tests. The `frozen_at` flip writer (pg_cron /
manual) stays HARDEN.10.

---

## Status block — forks ruled + web gate

**Three forks — founder-ratified "A" (2026-06-14):**

| Fork | Ruling |
|---|---|
| **1. Gate scope** | **PARTICIPANT-ONLY** (§20.3 as-built) |
| **2. Mechanism** | **DB flag** — `isFrozen()` reads `system_state.frozen_at IS NOT NULL` (§20.2). NOT a clock comparison. |
| **3. Writer scope** | **READ-GUARD ONLY** — build `isFrozen()` + wiring + tests. pg_cron flip → HARDEN.10. |

**Web gate (2026-06-14): PASS** with two fixes + a rider drop, folded in below:
- **FIX-1** — DB-backed freeze tests + manual smoke reset must not trip the §6.3 once-only trigger
  (`timestamp→NULL` and `timestamp→timestamp` are both rejected). Reset via **TRUNCATE + reseed**.
- **FIX-2** — the close-due cron returns **HTTP 200 `{ status: "frozen" }`** when frozen (the §3.4 A-2
  clientless-scheduler contract), not 410. Participant bet endpoints keep 410.
- **RIDER-1 DROPPED** — no SPEC.2 rider. **Pure code-only deliverable** (no spec edit, no ADR, no migration).

**Gated surfaces (state-mutating, get `isFrozen()`):**
1. **Participant bet endpoints** `POST /api/bets/place` + `POST /api/bets/sell` — both route through the
   shared `runBetEndpoint` §3.1 stack (`src/server/bets/endpoint.ts`). Comments ride bets
   (reply-as-bet), so there is **no separate comment endpoint** to gate.
2. **`GET /api/cron/close-due-markets`** route — a state-mutating **system** endpoint (automated W-4
   `Open → Closed` writer), squarely inside §20.2's "every state-mutating endpoint."

**NOT gated (stay LIVE post-freeze per §20.3):** admin Server Actions (resolve / correct / void,
moderation, market create / open / close), all read paths, all auth (F-AUTH-*), and the future H2
erasure scrub. **No §20.3 amendment.**

Framing to carry into execute:
- The **bet-endpoint gate** is the **uniform §20.2 contract + defense-in-depth** — the state machine
  already precludes post-freeze bets (no market is `Open` once every `resolution_deadline ≤` the
  freeze, per the §12.1 deadline ceiling), so the gate is a belt, not the load-bearing fix.
- The **cron gate** is **the real automated gap** the auditor flagged — the only path that writes
  market state without a human in the loop.

---

## Auditor-finding reconciliation

The ENGINE.15 finding named **W-3/W-4 (resolution + lifecycle) admin paths** as "never read before
writing." That scoping is **over-broad against SPEC.2 §20.3**, which deliberately leaves admin paths
**ungated** ("admin Server Actions do NOT call `isFrozen()`" — `SPEC.2:2026`; the conclusion-event
work — finalizing resolutions, last-mile moderation — must run post-freeze).

Reconciliation (founder ruling 1):
- The **admin** half of the finding is **by-design-ungated**, not a gap → **no action**.
- The **real gap** is two-fold: (a) `isFrozen()` is **greenfield**, and (b) the **`close-due-markets`
  cron is ungated** — the automated W-4 write surface newly wired in ENGINE.15.

ENGINE.16 fixes **exactly (a) + (b)** and the participant bet endpoints (the §20.2 uniform contract).
It does **not** gate the admin W-3/W-4 Server Actions.

---

## Freeze semantics (the contract ENGINE.16 encodes)

- **BLOCKED post-freeze**:
  - participant `POST /api/bets/place`, `POST /api/bets/sell` → **HTTP 410 `error_experiment_concluded`**
    (the §20.2 participant-client wire envelope), no transaction opened.
  - `close-due-markets` cron → **work skipped** (no lock acquired, `closeDueMarkets` not called);
    response is **HTTP 200 `{ status: "frozen" }`** (the §3.4 A-2 in-body-status convention — see Mechanism).
- **PERMITTED post-freeze** (unchanged): admin Server Actions (resolve / correct / void, moderation,
  create / open / close), all reads, all auth, future H2 erasure scrub.
- **Boundary = the FLAG, not a time operator.** The gate is `frozen_at IS NOT NULL` — a boolean DB
  state, flipped once by HARDEN.10's pg_cron at the instant. **There is no `>=`/`>` clock comparison
  in ENGINE.16.** D-14.e (injected-clock) is **MOOT** here — `isFrozen()` reads the DB; tests
  set/reset the flag. The temporal boundary lives entirely in the (deferred) flip writer.

---

## Mechanism + placement

### The helper — `src/server/system/is-frozen.ts` (NEW, per §20.4 `:2040` / Appendix-A `:2375`)

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemState } from "@/db/schema";

/**
 * The §20.2 conclusion-freeze gate. Reads the single-row `system_state`
 * sentinel ('system') and reports whether the freeze has fired (frozen_at
 * flipped NULL → timestamp; the flip is HARDEN.10's pg_cron job, not ours).
 *
 * A PLAIN, NON-LOCKING SELECT — never `.for(...)`. system_state MUST NOT enter
 * the W-1/W-3/W-4 lock order (markets → pools → positions → dharma_ledger →
 * events). Called at handler-stack step 1 (§3.1), adjacent to auth, BEFORE
 * idempotency, BEFORE any transaction opens.
 */
export async function isFrozen(): Promise<boolean> {
  const row = await db.query.systemState.findFirst({
    where: eq(systemState.id, "system"),
    columns: { frozenAt: true },
  });
  return row?.frozenAt != null;
}
```

- `systemState` is exported from the schema barrel (`src/db/schema/index.ts:11`), so `db.query.systemState` resolves.
- Non-locking by construction (`findFirst`, no `.for(...)`). Runs **outside** any `db.transaction(...)`,
  so it cannot pull `system_state` into a wrapper's lock order — confirmed against both
  `resolution/transaction.ts` and `markets/transaction.ts` (neither references `system_state`).

### Wiring 1 — `runBetEndpoint` (`src/server/bets/endpoint.ts`) → 410

Insertion point: **between the onboarding check (`:184`) and the Idempotency-Key validate (`:186`)** —
a new "step 1.5" right after auth+ban, before idempotency lookup, before body parse, before the
try/finally that holds rate-limit. Gating once in the shared prefix covers **both** `/place` and
`/sell` (and any future comment-bearing bet).

```ts
// 1.5 Freeze gate (§20.2) — adjacent to auth, before idempotency; no tx opens.
if (await isFrozen()) {
  return jsonResponse(
    requestId,
    410,
    envelope("error_experiment_concluded", "The experiment has concluded."),
  );
}
```
(+ one import line.) Returns the §4.4 envelope via the existing `envelope()`/`jsonResponse()` helpers;
no idempotency key reserved, no rate-limit consumed, no `inner`/wrapper invoked.

### Wiring 2 — `close-due-markets` route (`src/app/api/cron/close-due-markets/route.ts`) → 200 `{status:"frozen"}`

Insertion point: **after the Bearer-`CRON_SECRET` auth check (`:55`), before lock acquisition (`:57`)**.

```ts
// Freeze gate (§20.2) — the automated W-4 write surface. Post-freeze the sweep
// is skipped (no lock, no closeDueMarkets). HTTP 200 + in-body status per the
// §3.4 A-2 cron contract (clientless scheduler — the 410 client envelope is the
// participant contract, not this surface).
if (await isFrozen()) {
  return jsonResponse({ status: "frozen" }, { status: 200 });
}
```
(+ one import line.) Placed before the lock so a frozen run neither acquires the distributed lock nor
calls `closeDueMarkets`.

**Why the cron returns 200, not 410 (FIX-2).** §20.2's `410 error_experiment_concluded` is the
**participant-client** wire envelope. The cron is a **clientless scheduler job** following the §3.4 A-2
pattern (HTTP 200 + in-body status so Vercel alarms only on true crashes; route comment `:24-26`). A
410 would mark every post-freeze run "failed" in Vercel. So the cron returns `200 { status: "frozen" }`
— the gate still **skips all work**; only the response shape differs. The HARDEN.* lint target is
`isFrozen()` **presence**, which is satisfied identically. No spec/lint impact; bet endpoints keep 410.

---

## RED-first test charter (name the files)

Per §5.6 / §5.11, `@test-writer` writes these FAILING first (Phase-2 start), before any `src/` wiring.

| # | Scenario | File | DB? | Shape |
|---|---|---|---|---|
| helper | `frozen_at` NULL → `false`; set → `true`; non-locking | `tests/server/system/is-frozen.test.ts` (NEW) | **Yes** | commit `frozen_at` (NULL→ts, once), assert the real `isFrozen()` via `db`; reset = **TRUNCATE+reseed** (FIX-1) |
| (a) | frozen → `/api/bets/place` (+ `/sell`) returns **410** `error_experiment_concluded`; idempotency / rate-limit / `inner` NOT reached | `tests/server/bets/freeze.test.ts` (NEW) | No | mock `isFrozen→true` + mock auth/session (mirrors `validation.test.ts`'s `@/server/auth` mock) |
| (b) | frozen → cron returns **HTTP 200 `{status:"frozen"}`**; `closeDueMarkets` + `acquireLock` **NOT** called (work-skipped — NOT a 410) | `tests/server/cron/close-due-markets.test.ts` (EXTEND) | No (mock `isFrozen`) | adds to the ENGINE.15 wire-only file |
| (c) | not-frozen → bet + cron pass through normally (control for a/b) | same files as (a)/(b) | — | `isFrozen→false` arm |
| (d) | frozen DB → admin **resolve / correct / void STILL succeed** (regression guard against over-gating: fails if the W-3 path ever gates on freeze) | `tests/server/resolution/freeze-exemption.test.ts` (NEW) | **Yes** | commit `frozen_at`, run the existing resolution fixtures via the production `db`, assert success; reset = **TRUNCATE+reseed** incl. `system_state` |
| (e) | `isFrozen` is wired **only** on the two gated surfaces; absent from read/admin/auth/W-3/W-4 paths | `tests/server/system/is-frozen-surface.test.ts` (NEW) | No | source-grep structural guard (encodes the §20.3 read/admin-ungated contract) |

**FIX-1 — DB reset under the §6.3 once-only trigger.** The Bucket-B trigger on `system_state` rejects
**both** `frozen_at timestamp→NULL` (un-freeze) **and** `timestamp→timestamp` (re-fire) — `0003:172-173`,
`enforce_system_state_frozen_at`. So a DB-backed freeze test can never reset via `UPDATE … SET
frozen_at = NULL`. The triggers are **`BEFORE UPDATE` + `BEFORE DELETE` only** (`0003:197-198`); there
is **no `BEFORE TRUNCATE` trigger** anywhere in the migrations. Therefore the reset for the helper test
and (d) is:

```sql
TRUNCATE system_state;                                   -- bypasses the UPDATE/DELETE trigger
INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL);  -- restores the pre-freeze seed
```

in `afterEach` — the server-layer convention (`testClient.unsafe('TRUNCATE … CASCADE')`, per
`resolution/happy-path.test.ts:189-191`), extended to `system_state`. The intra-test freeze is a single
committed `NULL→timestamp` UPDATE (allowed once on the live row), visible cross-connection to the
production `db` that `isFrozen()` / the resolution wrapper use — so **no transaction-isolation gap and
no forbidden `timestamp→NULL`**. (The existing `system-state-append-only.spec.ts` uses per-test-tx
rollback `inRolledBackTx`; that is an equally valid alternative, but TRUNCATE+reseed keeps the new tests
on the production `db` connection the helper/resolution actually use.)

- (a)/(b)/(c) follow the **mocked wire** convention (`vi.mock` deps, no DB) — fast, deterministic, RED
  on the assertion not on collection.
- (d) has teeth: with `frozen_at` committed, if a future change adds `isFrozen()` to the W-3 path the
  resolution would refuse and (d) fails.

---

## File plan + diff budget (code-only)

| File | Action | ~LOC |
|---|---|---|
| `src/server/system/is-frozen.ts` | **NEW** — the helper | ~20 |
| `src/server/bets/endpoint.ts` | EDIT — step-1.5 gate (410) + 1 import | +7 |
| `src/app/api/cron/close-due-markets/route.ts` | EDIT — gate (200 `{status:"frozen"}`) after auth + 1 import | +6 |
| `tests/server/system/is-frozen.test.ts` | **NEW** | ~45 |
| `tests/server/bets/freeze.test.ts` | **NEW** | ~70 |
| `tests/server/cron/close-due-markets.test.ts` | EXTEND | +30 |
| `tests/server/resolution/freeze-exemption.test.ts` | **NEW** | ~65 |
| `tests/server/system/is-frozen-surface.test.ts` | **NEW** | ~25 |

**No** migration · **no** schema change · **no** new event type · **no** new ADR · **no** SPEC edit.

---

## Pinned by SPEC (do not deviate)

- **NO migration.** `system_state` table + singleton row (`id='system'`, seeded `NULL`) + Bucket-B
  trigger are **SCAFFOLD.2** (`0003`/`0004`). P0 confirmed the row exists. **Migration head stays
  `0015`. `@db-migration-reviewer` is IDLE** (execute verifies presence, writes nothing).
- **NO new event type.** A refusal is an HTTP error, not an event. **`EVENT_TYPES` stays 23.**
- **NO new ADR.** ENGINE.16 **implements** §20.2/§20.3/§20.4 as-written — not a novel pattern.
- **`error_experiment_concluded` is already spec'd** (SPEC.2 §15.4 `:1462/:1497/:1534`, the 38-code
  baseline, HTTP 410 `error_type: gone`). Used as a literal string. **`docs/specs/error-codes.md`
  does not exist** (forward deliverable per §15.4) — ENGINE.16 does **not** create it.

---

## Riders

**None.** RIDER-1 (a SPEC.2 §20.2/§20.4 gated-surface-inventory note) was **considered and dropped at
the web gate.** Rationale: §20.2 ("every state-mutating endpoint") + §20.3 (admin ungated) + §20.4
`:2044-2045` (read-paths / admin-paths-still-live posture) **already record the contract and the
exemption**; a concrete surface-list baked into the spec would go stale as surfaces land. So **no
SPEC.2 edit, no anchor battery** — ENGINE.16 is a pure code-only deliverable.

---

## Carry-forwards (→ HARDEN)

- **`frozen_at` flip writer** (Path A pg_cron `…_freeze_cron.sql` / Path B manual `psql`) → **HARDEN.10**
  (§20.4). ENGINE.16 builds the read-guard only.
- **CI-lint enforcing `isFrozen()` presence** on every state-mutating handler → **HARDEN.\*** (§20.4 `:2041`).
  Will also catch future participant comment Server Actions (`src/server/comments/`, greenfield) that
  must inherit the gate.
- **23:59:00 race** between the flip cron and the close-due cron → **HARDEN.10 + operational** (set
  market deadlines strictly before the instant; the `frozen_at` flip and the last close-due tick can
  interleave — the deadline-ceiling + the state machine make it benign, but document it).

---

## Out of scope

The `frozen_at` writer · the CI-lint · **admin-path gating** (§20.3 keeps them live) · post-freeze
read-only UX · the `error-codes.md` catalogue file · economic numbers · market content · the
vestigial `→ Frozen` market-status writer (no participant-facing effect; not part of the §20.2 gate).

---

## Verification (execute)

1. **RED first:** `pnpm vitest run tests/server/system/ tests/server/bets/freeze.test.ts tests/server/cron/close-due-markets.test.ts tests/server/resolution/freeze-exemption.test.ts` → all fail on assertions.
2. Implement helper + 2 wirings → same suite **GREEN**.
3. **Critical-path gate:** `pnpm test:invariants` + `pnpm test:integration` + **full** `pnpm vitest run`
   (the cross-suite floor — e.g. EVENT_TYPES inventory pin — stays 23). Needs **local Postgres**
   (`open -a Docker` + `supabase start`; pass the committed test `DATABASE_URL` inline for the
   DB-backed specs).
4. `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build).
5. **Manual smoke (local DB):** flip → `UPDATE system_state SET frozen_at = now() WHERE id='system'`
   → `POST /api/bets/place` returns **410 `error_experiment_concluded`** (no rows written); cron GET
   returns **200 `{status:"frozen"}`** (no sweep); an admin resolve still succeeds. **Reset (FIX-1):
   `TRUNCATE system_state; INSERT INTO system_state (id,frozen_at) VALUES ('system', NULL);`** —
   `SET frozen_at = NULL` is rejected by the once-only trigger; TRUNCATE bypasses it. (On a shared DB
   you won't truncate, use the `BREAK_GLASS.md` disable-trigger sequence instead; the throwaway local
   test DB uses TRUNCATE+reseed.)
6. **Pre-PR self-audit (§5.10)** item-by-item against this plan; then `@code-reviewer` (src/server/
   diff) → `@security-auditor` (critical-path: bet handler + freeze gate; confirm no §20.3 over-gating,
   no lock-order inclusion, fail-posture). `@db-migration-reviewer` **idle** (no migration).

**ADR-needed: NO** (spec-implementation of §20.2/§20.3/§20.4).
