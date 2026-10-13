import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// CARVE-OUT from universal UUIDv7 PK convention per SPEC.2 §20.2.
//
// system_state is a singleton with PK literal 'system'. The text id encodes
// the row's well-known identity; other tables use uuid() PKs. frozen_at is
// the Bucket-B whitelisted column (NULL → timestamp once) for the conclusion
// freeze. ⚠ DORMANT per D-55: no scheduled writer exists — this comment used
// to name a "2026-11-05 23:59 UTC" freeze, and nothing was ever built to set
// it. The experiment ends when its markets close, so the column stays NULL
// unless someone sets it by hand; once set it is never unset (CLAUDE.md §3 —
// refusal trigger; recovery is BREAK_GLASS.md-only). Single-row seed ships in
// 3.C (0004_seed_system_state.sql).
export const systemState = pgTable("system_state", {
	id: text("id").primaryKey(),
	frozenAt: timestamp("frozen_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const insertSystemStateSchema = createInsertSchema(systemState);
export const selectSystemStateSchema = createSelectSchema(systemState);
