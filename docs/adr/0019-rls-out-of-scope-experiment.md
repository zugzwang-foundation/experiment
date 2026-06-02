# ADR-0019 — Row-Level Security Out of Scope for the Experiment (Server-Only Data Access)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-01 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SYNC.5 (RLS ruling — open item #1 / drift signal D4) |
| **Frame document** | SPEC.2 (architecture / data access); SPEC.2 §23 (ADR Index); refinement-01 (public-read posture, interacts) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The SYNC recon (SYNC.2/SYNC.3) found **Row-Level Security (RLS) absent everywhere** in the experiment codebase, and flagged it (drift signal D4; open ruling #1) as needing an explicit decision: *is the absence intentional for the experiment phase, or a gap?* A related drift note (D4) observed that a `supabase/migrations/` directory is referenced but does not exist — the place RLS policies would conventionally live.

RLS is a Postgres feature that enforces row-visibility and row-mutation rules **inside the database itself**, so that the rule is applied regardless of which application code issued the query. Its security value is conditional on **who connects to the database**:

- **Architecture 1 — client-direct DB access.** Untrusted clients (browsers, third parties) connect to Postgres holding their *own* credential (the classic Supabase pattern: browser → Supabase client with a user JWT → Postgres). Here the database is directly reachable by user-controlled credentials, and **RLS is the only control standing between a user and other users' rows.** Absent RLS, any user can read/write any row. RLS is load-bearing; its absence is a hole.
- **Architecture 2 — server-mediated DB access.** Only the application's own trusted server connects to Postgres, using a single trusted (service-role) credential the user never sees. Clients talk only to the server; the server authorizes the request and then queries the database on the user's behalf. **The database is never exposed to a user credential.** Here RLS would enforce rules against the application's own trusted server — which has already performed authorization — making it a redundant backstop, not a load-bearing control. Its absence is a deliberate posture, not a hole.

**Zugzwang's experiment is Architecture 2 (confirmed).** Every read and write goes through the Next.js server: mutations via Server Actions (the locked mutation contract), reads via server route handlers / server components, all using a single trusted database credential. No browser, client component, or third party ever holds a database connection. Authorization lives entirely in the server's Server Action / handler layer (Better Auth-backed). This is consistent with the recon snapshot: all DB access in `src/server/`, a service-role access pattern, Server Actions as the mutation contract.

**Interaction with the public-read posture (refinement-01).** The experiment is public-read / auth-gated-act (Polymarket posture): logged-out visitors can read all market/debate surfaces; authentication is required only to *act*. This does **not** change the architecture verdict — logged-out reads are still served *by the server* from the trusted connection, not by a client-direct DB query. Public-read and server-only access are compatible; refinement-01 explicitly handed this interaction to be resolved with mutual awareness, and it is: public reads go through the same server-mediated path, so RLS remains non-load-bearing.

This ADR does **not** decide:
- The server-layer authorization rules themselves (which Server Action checks which ownership/eligibility condition) — that is SPEC.2 / the engine handlers, not RLS.
- The testnet/mainnet data-access architecture — RLS is explicitly flagged for reconsideration there (real value, onchain escrow, higher stakes, and a likely different access topology).
- Any other Postgres-level hardening (e.g. column grants, `CHECK` constraints, append-only triggers) — those are decided in their own ADRs/specs (ADR-0005 triggers, INV-1/2/3) and are **unaffected**; this ADR is narrowly about RLS.

## Decision Drivers

1. **RLS only defends a database that untrusted clients can reach.** In Architecture 2 the database is server-only; RLS would police the application's own trusted server *after* it has authorized the request. The control does not sit on the exposed surface.
2. **The exposed surface is the server's authorization layer, and that is where defensive effort belongs.** For a 7-week experiment with a fixed launch date, effort spent adding RLS hardens a wall users cannot reach, while the wall that *is* reachable (Server Action authorization) is the one that actually gates access. Scope flexes, time is locked — prioritize the load-bearing surface.
3. **A correct decision today can become a vulnerability tomorrow if undocumented.** The genuine risk is not the current architecture — it is a *future* change (someone adds a Supabase client to a browser component, or a public data endpoint) that silently drops the system into Architecture 1 while RLS is off. An unrecorded "no RLS" is indistinguishable from an oversight and re-creates the exact drift this SYNC exercise exists to kill.
4. **Experiment phase is disposable; testnet is not.** Nothing carries past Nov 8. The testnet phase (onchain, real value) warrants its own RLS reconsideration rather than inheriting this posture by default.

## Considered Options

1. **Add RLS before launch** (treat the absence as a gap).
2. **RLS out of scope for the experiment, with the decision recorded and a tripwire** (build skipped, decision documented). ← chosen
3. **Skip RLS and record nothing** (do not build, do not document).

## Decision Outcome

**Chosen: Option 2 — RLS is deliberately out of scope for the experiment; the build is skipped and the decision is recorded with a tripwire and a testnet revisit.**

**The ruling:**

> RLS is deliberately out of scope for the experiment phase. The database is server-only (Architecture 2): every read and write goes through the Next.js server's Server Action / handler layer using a single trusted credential; no client, browser component, or third party holds a database connection. RLS would enforce row rules against Zugzwang's own trusted server, behind a wall untrusted clients cannot reach — a redundant backstop for this phase, not a load-bearing control. **Build skipped; decision recorded.**
>
> **Tripwire:** this posture is valid *only* while the database stays server-only. The day any client-direct database path is introduced — a Supabase/anon client in a browser component, a public PostgREST/data endpoint, any user-scoped DB credential reaching an untrusted client — **RLS becomes mandatory before that path ships.**
>
> **Revisit at testnet** (real value, onchain escrow, higher stakes, likely different access topology).

**Why not Option 1 (add RLS now):** Hardens a non-exposed surface at real cost (policy DDL per table, the absent `supabase/migrations/` scaffolding, testing that policies don't break the server's own service-role access) during a locked launch window, for a backstop behind a wall users cannot reach. Effort is better spent on the server authorization layer, which is the actually-exposed control. **Rejected for the experiment.**

**Why not Option 3 (skip silently):** Building nothing is correct; recording nothing is not. An undocumented absence cannot be distinguished from an oversight by a future reader (human or Claude Code), and without the tripwire a later client-direct path silently becomes an Architecture-1 hole where every user can read every row. The recorded ruling is what makes that future mistake *catchable* rather than invisible — it is the cheap half of the decision and the half that prevents drift. **Rejected.**

## Consequences

### Positive
- No RLS build cost in the launch window; effort concentrates on the load-bearing server authorization layer.
- The D4 drift signal is resolved into an explicit, documented decision rather than an ambiguous gap — the SYNC goal.
- The tripwire converts a point-in-time correct decision into a durable invariant that survives future code changes.

### Negative / accepted tensions
- **The server's authorization code is the *only* lock.** There is no database-level safety net: if a Server Action omits an ownership/eligibility check, the database will return the wrong rows, because it trusts the server completely. In Architecture 1, RLS would catch such a bug; in Architecture 2, nothing does. This is an accepted trade for the experiment, and a direct argument for rigorous review discipline on the engine handlers (the writer/reviewer ritual already covers the critical-path engine work).
- **The posture is conditional and must be actively held.** The tripwire is only effective if it is checked — any PR that introduces a client-side data-access path must trigger the RLS-becomes-mandatory clause. Flagged for the engine/handler review checklist.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SYNC recon (D4) | "RLS absent everywhere"; `supabase/migrations/` referenced but absent | **Resolves.** The absence is ruled *intentional* for the experiment under Architecture 2. The missing `supabase/migrations/` directory needs no RLS scaffolding for this phase; if it is needed for non-RLS migrations that is a separate D4 [FIX] item, not a security gap. |
| refinement-01 | Public-read / auth-gated-act posture | **Consumes with mutual awareness** (as refinement-01 required). Public logged-out reads are served by the server from the trusted connection, not by client-direct DB queries; public-read and server-only access are compatible. The RLS verdict is unchanged by the public-read posture. |
| Server Actions mutation contract | Locked stack decision | Consumes: the server-mediated access pattern *is* Architecture 2. This ADR records the security consequence of that pre-existing architectural choice rather than introducing it. |
| ADR-0005 (append-only triggers) / INV-1/2/3 | DB-level integrity | **Unaffected.** Append-only triggers, balance `CHECK`s, and NOT-NULL FKs are independent Postgres-level controls and remain in force; this ADR is narrowly about RLS, not all DB-level hardening. |
| Better Auth | Auth boundary (ADR-0004) | Consumes: authentication/authorization at the server layer is the load-bearing control the RLS decision relies on. |
| SPEC.2 (architecture / data access) | Architecture section | **Mints** (SYNC.7/8): a recorded RLS posture + tripwire in the data-access architecture section. |
| SPEC.2 §23 (ADR Index) | ADR index | **Mints** an ADR-0019 entry (same SYNC.7/8 commit). |
| Tracker | SYNC.5 (this ADR), SYNC.7/8 (SPEC.2 architecture + §23), ADR backfill (commit this file) | Resolves open ruling #1 and drift signal D4. |

## More Information

- SPEC.2 — architecture / data-access surface; **mints** the recorded RLS posture and tripwire in SYNC.7/8.
- `SYNC.3.5-refinement-01-access-and-visitor-count.md` — the public-read posture this ADR is resolved with mutual awareness of.
- SYNC_TRACKER.md — open ruling #1, drift signal D4.
- SYNC.5 chat record (2026-06-01) — the Architecture-1-vs-2 analysis (the bank-vault framing), the confirmation of Architecture 2, and the build-skip / record-decision reasoning.

---

*ADR-0019 records that Row-Level Security is deliberately out of scope for the Zugzwang experiment phase because the database is server-only (Architecture 2): untrusted clients never connect to Postgres, so RLS would back-stop the application's own trusted server rather than gate an exposed surface. The build is skipped and the decision is recorded with a tripwire — the day any client-direct database path is introduced, RLS becomes mandatory before that path ships — and a flag to reconsider RLS at testnet. This resolves SYNC open ruling #1 and drift signal D4. Other Postgres-level controls (append-only triggers, balance checks, NOT-NULL FKs) are unaffected.*
