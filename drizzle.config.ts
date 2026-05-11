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
	tablesFilter: ["!events"],
	casing: "snake_case",
	strict: true,
	verbose: true,
});
