import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// SPEC.1 §6.1: 7-state market lifecycle.
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
		// ADR-0026: outbound YouTube explainer URL (opens in a new tab; not
		// embedded/self-hosted). Set at create (MEDIA.1), editable pre-live per
		// the Bucket-C whitelist; NULL when unset. The §9 display slice renders it.
		mediaVideoUrl: text("media_video_url"),
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

// ADR-0026 #1 + SPEC.2 Appendix B.16: the admin-set per-market media pool
// (carousel images + display_order + one is_default). Bucket C — MUTABLE
// (whitelisted curation of display_order / is_default pre-live); NO append-only
// trigger. Structurally separate from `image_uploads`: NO `user_id` — admin is
// not a participant (F-AUTH-ADMIN), and admin media never enters the
// participant-owned `u/<userId>/` read-scope. `r2_object_key` lives in the
// `m/<marketId>/` namespace of the third R2 bucket arm (§12.1). ADR-0027: this
// is operator-curated trusted content, written directly (no moderation).
export const marketMedia = pgTable(
	"market_media",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		r2ObjectKey: text("r2_object_key").notNull(),
		displayOrder: integer("display_order").notNull(),
		isDefault: boolean("is_default").notNull(),
		createdBy: text("created_by").notNull().default("admin-singleton"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("market_media_market_id_idx").on(table.marketId),
		// OD-5: exactly-one-default-per-market storage backstop. The service
		// enforces exactly one at create (rejects 0 / ≥2); this partial unique
		// index rejects a second `is_default = true` row for the same market
		// (23505).
		uniqueIndex("market_media_one_default_per_market_uq")
			.on(table.marketId)
			.where(sql`${table.isDefault}`),
	],
);

export const insertMarketSchema = createInsertSchema(markets);
export const selectMarketSchema = createSelectSchema(markets);
export const insertPoolSchema = createInsertSchema(pools);
export const selectPoolSchema = createSelectSchema(pools);
export const insertMarketMediaSchema = createInsertSchema(marketMedia);
export const selectMarketMediaSchema = createSelectSchema(marketMedia);
