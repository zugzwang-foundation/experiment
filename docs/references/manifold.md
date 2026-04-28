# Manifold reference

A read-only reference fork of [manifoldmarkets/manifold][upstream], a
production CPMM prediction market in TypeScript. This document maps
Zugzwang tasks to relevant Manifold source paths so the work starts
from a known starting point instead of a blank file tree.

[upstream]: https://github.com/manifoldmarkets/manifold

- **Fork:** [zugzwang-foundation/manifold-reference][fork]
- **Pinned tag:** [`ref-2026-04-28-found5`][tag]
- **Pinned commit:** `d5b55cf9472ec05f545e6c1a817d88005b8dbf2b`
- **Pinned date:** 2026-04-28

[fork]: https://github.com/zugzwang-foundation/manifold-reference
[tag]: https://github.com/zugzwang-foundation/manifold-reference/releases/tag/ref-2026-04-28-found5

## How to use this document

Open this file before starting any task in the per-task index below.
The point is to know what to read in the reference fork *before* you
start designing or coding. Update the file when a task discovers a
path worth citing that isn't here yet.

## Naming in the reference codebase

The reference codebase uses different names for some concepts. When
reading source, note:

- A "Contract" is a market.
- "Mana" is its in-app currency (transferable, with loan and
  redemption mechanics).
- The architecture is Postgres-on-Supabase (migrated from Firestore;
  most paths under `backend/supabase/` and `common/src/supabase/`).

## Watch-outs when porting

Three places where a direct port would not match what we're building.
Read these before lifting code from the corresponding files.

1. **Bet and comment writes are not atomic.** The reference notes
   this in `common/src/comment.ts` line 8: comments are written
   after the bet, not in the same transaction. Our `place-bet` flow
   commits both in a single Postgres transaction.

2. **Comments do not record an at-post-time side or stake.** The
   schema in `common/src/comment.ts` has no field for the author's
   market position at the moment of posting. Our schema needs
   `side_at_post_time` and `stake_at_post_time` columns.

3. **Database writes use mutable tables.** The schema under
   `backend/supabase/` is a traditional write-in-place design. Our
   schema is event-sourced — append-only events plus projector
   workers. Read the reference schema for column shapes and
   indexes; do not mirror the mutability pattern.

## Per-task index

For each task that benefits from the reference, the relevant paths
are listed below. Paths are anchored to the pinned tag.

### SCAFFOLD.2 — Postgres + Drizzle setup

| What to read | Path |
|---|---|
| Production Supabase schema | `backend/supabase/seed.sql`, `backend/supabase/local-dev/` |
| Typed schema layer | `common/src/supabase/` |
| Operational scripts | `backend/scripts/supabase/` |

Read for table shapes, indexes, and naming conventions.

### SPEC.5 — Postgres + event sourcing ADR

| What to read | Path |
|---|---|
| Reference schema (whole tree) | `backend/supabase/` |
| Migration history | `backend/supabase/migrations/` |

The ADR's job is to articulate the rationale for event-sourcing.
Reading the reference's mutable-table approach helps name the
specific tradeoffs.

### ENGINE.2 — CPMM TypeScript module

| What to read | Path |
|---|---|
| CPMM math | `common/src/calculate-cpmm.ts` (866 lines) |
| CPMM tests | `common/src/calculate-cpmm.test.ts` (194 lines) |
| Numeric helpers | `common/src/util/math.ts` (52 lines) |
| Adjacent CPMM files | `common/src/calculate-cpmm-arbitrage.ts`, `common/src/calculate-fixed-payouts.ts`, `common/src/fees.ts`, `common/src/liquidity-provision.ts`, `common/src/bet.ts` |

`calculate-cpmm.ts` exports `CpmmState`, `getCpmmProbability`, and
the buy/sell calculation functions.

### ENGINE.4 — Market state machine

| What to read | Path |
|---|---|
| Market type definition | `common/src/contract.ts` (609 lines) |

Read for the type shape, status transitions, and field mutability
rules.

### ENGINE.5 — Dharma double-entry ledger

The reference has no directly applicable code; its currency model is
different in kind.

### ENGINE.7 — Single-writer actor per market

The reference uses queue-based concurrency, not in-memory
single-writer actors. No directly applicable code.

### ENGINE.8 — Order processing API

| What to read | Path |
|---|---|
| Bet placement | `backend/api/src/place-bet.ts` (672 lines) |
| Bet construction helpers | `common/src/new-bet.ts` |
| Bet type | `common/src/bet.ts` |

See watch-out #1 above before porting the transaction structure.

### ENGINE.9 — Admin resolution flow

| What to read | Path |
|---|---|
| Resolution endpoint | `backend/api/src/resolve-market.ts` (177 lines) |
| Resolution logic | `backend/shared/src/resolve-market-helpers.ts` |

### DEBATE.1–3 — Commentary

| What to read | Path |
|---|---|
| Comment type | `common/src/comment.ts` (88 lines) |
| Comment creation handler | `backend/api/src/on-create-comment-on-contract.ts` (514 lines) |

See watch-outs #1 and #2 above before porting the schema or creation
flow.

## Local clone (when grep is needed)

```bash
git clone --branch ref-2026-04-28-found5 \
  --depth 1 \
  git@github.com:zugzwang-foundation/manifold-reference.git \
  ~/code/zugzwang/references/manifold
```

Clone to `~/code/` or `~/Developer/`, not `~/Desktop/` (iCloud
sync interferes).

For browsing only, GitHub's web UI is sufficient. Press `t` on any
repo page to open the file finder.

## Refresh policy

The pinned tag is immutable. To re-read the reference at a later
date, add a new tag — do not move the existing one:

```bash
git tag ref-YYYY-MM-DD-<reason>
git push origin ref-YYYY-MM-DD-<reason>
```

Add a row to this document under the affected task's section noting
which paths were re-read against which tag.
