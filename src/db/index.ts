import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
	// Pool ceiling PER INSTANCE — and a Vercel instance is per DEPLOYMENT, not
	// per environment. Against the 15-slot pool below, one instance is already
	// two thirds of it and two oversubscribe it. Left at 10 deliberately; the
	// right value is a founder ruling paired with the transaction-pooler move.
	max: 10,
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
	// participant surface. An actively-polling viewer therefore keeps its
	// connection warm and never re-handshakes, while an abandoned instance
	// releases everything ~20 s after its last query. The pool is FIFO
	// (`open.shift()`), so a burst of 10 collapses back to the one connection
	// the poller keeps touching. Returning an idle connection cannot break a
	// running query: postgres.js `end()` terminates only when nothing is in
	// flight, and otherwise defers until the query completes.
	idle_timeout: 20,
	// Bounds a CONTINUOUSLY BUSY connection — the only kind `idle_timeout`
	// never reaches — at 10 min, against a default of 30-60 min.
	//
	// ⚠ A fixed value retires connections in LOCKSTEP where the postgres.js
	// default randomises per connection (60 * (30 + random*30)), so this trades
	// a stagger for a potential reconnect herd. Accepted, and recorded here
	// rather than discovered later: `idle_timeout` retires nearly every
	// connection long before 10 min, leaving at most the handful a sustained
	// poller keeps hot. A literal is required regardless — the postgres.js TS
	// type is `max_lifetime: number | null`, so the default's function form is
	// not expressible.
	max_lifetime: 600,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
