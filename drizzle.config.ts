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
	// 0027_liquidity_injector_pg_cron.sql. Without this entry `db:check-drift`
	// reports a table Drizzle does not know about and CI reds on a table that is
	// exactly where it is meant to be. `liquidity_policy` IS declared
	// (src/db/schema/liquidity.ts) and is deliberately absent from this list.
	tablesFilter: ["!events", "!liquidity_heartbeat"],
	casing: "snake_case",
	strict: true,
	verbose: true,
});
