import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema",
	out: "./drizzle/migrations",
	dbCredentials: {
		// biome-ignore lint/style/noNonNullAssertion: src/db/index.ts validates DATABASE_URL at runtime; drizzle-kit is a CLI tool that fails fast on missing env per ADR-0008 §6.
		url: process.env.DATABASE_URL!,
	},
	// events table is hand-written (PARTITION BY RANGE) per ADR-0005 §5.
	// Excluded from drizzle-kit auto-generation; ships in 0002_events_partitioning.sql.
	//
	// liquidity_heartbeat is OPERATIONAL, not a domain table — the
	// watermark_state / cron_alarms precedent from 0007, neither of which is
	// declared in Drizzle either. It is hand-written in
	// 0027_liquidity_injector_pg_cron.sql.
	//
	// ⚠ WHAT THIS ENTRY ACTUALLY GUARDS IS `drizzle-kit push`/`pull`, which is
	// the same reason `!events` is here. It does NOT guard `db:check-drift`:
	// that script issues two SELECTs against `drizzle.__drizzle_migrations` and
	// never introspects a table, so an undeclared table is invisible to it
	// either way. This comment claimed otherwise until it was measured
	// (`O-13` — a control named for a thing it cannot produce). The entry is
	// still right; the reason was not.
	//
	// `liquidity_policy` IS declared (src/db/schema/liquidity.ts) and is
	// deliberately absent from this list — verified, not assumed:
	// `drizzle-kit generate` against a clean tree reports no schema changes.
	tablesFilter: ["!events", "!liquidity_heartbeat"],
	casing: "snake_case",
	strict: true,
	verbose: true,
});
