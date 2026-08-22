import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Which Supavisor pooler this runtime connects through. The mode is DECLARED,
// never inferred from which secrets happen to exist — that distinction is the
// whole point of this block, and it is worth stating why.
//
// The obvious shape is `DATABASE_URL_TXN ?? DATABASE_URL`. It is wrong: a
// MISSING secret then becomes indistinguishable from deliberate session-mode
// config, so staging would silently run session mode while every observation
// taken against it — "transaction mode is active", "the client ceiling rose",
// "SET LOCAL timeouts still apply" — was measuring the wrong pooler, with
// `/api/health` reporting `db: "ok"` throughout. A verification that passes
// when it is not looking is worth nothing, and presence-inference is exactly
// that failure one layer below the control meant to catch it.
//
// The other obvious shape is to swap the variable name outright. Also wrong,
// and in the direction that hurts most: this module is imported by effectively
// every server surface, `next build` collects page data by importing them, and
// the throw below is at module scope — so an unconditional read of a secret
// `prd` does not have fails the production BUILD. Prod keeps serving the old
// deployment (fail-closed, which is the one mercy), but every prod deploy is
// blocked until someone mints the secret. Compare `BETTER_AUTH_URL`, which
// fails the same way for the same reason.
//
// So: default `session`, which makes `prd` byte-identical to what it has always
// done and requires nothing to be minted there.
const mode = process.env.DB_POOLER_MODE ?? "session";

// ADR-0024 Patch P3 decision outcome #8: every environment stays on `:5432`
// EXCEPT staging. Production is not authorised for transaction mode by any
// record, and the flag reaching `prd` would mean a config mistake rather than a
// decision — so this refuses at boot instead of connecting somewhere nobody
// ratified. A guard that never fires in practice is exactly the guard that goes
// unnoticed when it regresses, which is why it is pinned by a test.
if (mode === "transaction" && process.env.ZUGZWANG_ENV === "prod") {
	throw new Error(
		`DB_POOLER_MODE=transaction is not authorised in prod (ADR-0024 P3 #8)`,
	);
}

// A missing secret is LOUD and names the variable it wanted, so it can never be
// read as "session mode was intended here".
const varName = mode === "transaction" ? "DATABASE_URL_TXN" : "DATABASE_URL";
const connectionString = process.env[varName];
if (!connectionString) {
	throw new Error(`${varName} is not set (DB_POOLER_MODE=${mode})`);
}

const client = postgres(connectionString, {
	// Pool ceiling PER INSTANCE — and a Vercel instance is per DEPLOYMENT, not
	// per environment.
	//
	// ⚠ This value is NOT derived from the tenant pool any more. Under the
	// `:6543` transaction pooler the two ceilings decouple — client connections
	// rise to 200 while backend connections stay at 15 — so the old "15 ÷ 4 means
	// three instances fit" arithmetic no longer describes what `4` is protecting
	// against, and a stale derivation is how the next person re-derives the wrong
	// number (ADR-0038 P1.2).
	//
	// What `4` actually bounds is what a SUSPENDED instance can STRAND. The
	// relaxation says a higher `max` is now permissible; it does not say which
	// value is correct, and ADR-0038 decision 2 forbids acting on that without
	// measurement. S-5 measures; then it moves.
	//
	// THIS is the load-bearing control, not the timeouts below. Measured on
	// staging: a connection sat idle 620 s with BOTH a 20 s idle_timeout and a
	// 600 s max_lifetime configured and verified live, because Vercel Fluid
	// SUSPENDS an instance between requests and a suspended instance runs no
	// timers. A timer cannot be relied on to hand a slot back; bounding what an
	// instance can take in the first place does not depend on one running.
	max: 4,
	// Defensive on the :5432 session pooler; forward-safe if a :6543
	// transaction pooler is ever introduced (ADR-0024 §Decision Outcome #8).
	prepare: false,
	// Return idle connections to the Supavisor pool. postgres.js defaults this
	// to `null`, which makes the idle timer a literal no-op (`timer()` short-
	// circuits on a falsy interval), so a connection this pool opened was never
	// closed until `max_lifetime` fired 30-60 min later. On the :5432 SESSION
	// pooler a checked-out server connection is held for the whole client
	// session, and the tenant ceiling is `pool_size: 15` — so "never closed"
	// means "never given back", and staging degraded to EMAXCONNSESSION a few
	// minutes after every redeploy.
	//
	// 20 s sits just above POLL_INTERVAL_MS_DEBATE_VIEW = 15000
	// (src/server/config/limits.ts:262), the only sub-minute cadence on the
	// participant surface, so an actively-polling viewer keeps its connection
	// warm instead of re-handshaking through Supavisor every tick. The pool is
	// FIFO (`open.shift()`): with N connections and interval T each is touched
	// every N×T, so at the 15 s cadence a full pool collapses back to the one
	// connection the poller keeps hot.
	//
	// ⚠ MEASURED LIMIT — this does NOT reclaim an abandoned instance's slots.
	// On Vercel Fluid the instance suspends and the timer stops with it: 620 s
	// idle was observed against this 20 s setting. Even awake instances ran it
	// ~3× slow (first release at ~59 s). Treat it as opportunistic release on a
	// live instance, NOT as the pool guarantee — `max` above is the guarantee.
	//
	// Returning an idle connection cannot break a running query: postgres.js
	// `end()` terminates only when nothing is in flight, and otherwise defers
	// until the query completes.
	idle_timeout: 20,
	// Bounds a CONTINUOUSLY BUSY connection — the only kind `idle_timeout`
	// never reaches — at 10 min, against a default of 30-60 min.
	//
	// ⚠ A fixed value retires connections in LOCKSTEP where the postgres.js
	// default randomises per connection (60 * (30 + random*30)), so this trades
	// a stagger for a potential reconnect herd. Accepted, and recorded here
	// rather than discovered later: a herd needs an instance live enough for
	// many timers to fire at once, and on Fluid the same suspension that
	// defeats `idle_timeout` also de-synchronises these. A literal is required
	// regardless — the postgres.js TS type is `max_lifetime: number | null`,
	// so the default's function form is not expressible.
	max_lifetime: 600,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
