import { sql } from "drizzle-orm";
import {
	index,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// SPEC.1 §6.1: 7-state market lifecycle. SPEC.2 B.2's 3-state listing is
// drift (PRECURSOR.5 backlog).
export const marketStatusEnum = pgEnum("market_status", [
	"Draft",
	"Open",
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
]);

// SPEC.2 §6.1: resolution_events.outcome reuses this enum.
export const marketOutcomeEnum = pgEnum("market_outcome", [
	"YES",
	"NO",
	"VOID",
]);

export const markets = pgTable(
	"markets",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		slug: text("slug").notNull().unique(),
		title: text("title").notNull(),
		description: text("description"),
		status: marketStatusEnum("status").notNull().default("Draft"),
		resolutionDeadline: timestamp("resolution_deadline", {
			withTimezone: true,
		}).notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolutionOutcome: marketOutcomeEnum("resolution_outcome"),
		createdBy: text("created_by").notNull().default("admin-singleton"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("markets_status_idx").on(table.status),
		index("markets_resolution_deadline_idx").on(table.resolutionDeadline),
	],
);

// 1:1 with markets (UNIQUE FK). CPMM reserves per SPEC.2 §6.2.
export const pools = pgTable("pools", {
	id: uuid("id").primaryKey().default(sql`uuidv7()`),
	marketId: uuid("market_id")
		.notNull()
		.unique()
		.references(() => markets.id, { onDelete: "restrict" }),
	yesReserves: numeric("yes_reserves", { precision: 38, scale: 18 }).notNull(),
	noReserves: numeric("no_reserves", { precision: 38, scale: 18 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const insertMarketSchema = createInsertSchema(markets);
export const selectMarketSchema = createSelectSchema(markets);
export const insertPoolSchema = createInsertSchema(pools);
export const selectPoolSchema = createSelectSchema(pools);
