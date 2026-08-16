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
	// per environment. Against the 15-slot Supavisor tenant pool, 15 ÷ 4 means
	// three concurrent instances fit; at the previous 10, TWO already wanted 20.
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
