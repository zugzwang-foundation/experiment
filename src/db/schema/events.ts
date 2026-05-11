import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";
import { bets } from "./bets";
import { marketOutcomeEnum, markets } from "./markets";

// Bucket A. event_id (NOT 'id') per SPEC.2 §7.1 line 685 — drizzle-zod /
// relations() / any code defaulting to `<table>.id` must explicitly target
// `events.event_id`.
//
// TYPE-ONLY IN 3.B: drizzle.config.ts excludes via `tablesFilter:
// ["!events"]` (3.A). The pgTable declaration is for type inference +
// drizzle-zod only; actual DDL ships in 3.C's 0002_events_partitioning.sql
// (CREATE TABLE ... PARTITION BY RANGE) per SPEC.2 §7 + ADR-0005.
//
// event_type + aggregate_type are text (no pgEnum) per SPEC.2 §7.1 line 686
// — application-level open-extensibility. Per-event-type Zod schemas land
// in ENGINE.6 at src/server/events/schemas.ts.
//
// metadata is the 7-field block per SPEC.2 §3.7: request_id, flow_id,
// user_id, actor_id, idempotency_key, ip, user_agent. drizzle-zod will
// type as Record<string, unknown>; narrowing happens at ENGINE.6.
export const events = pgTable(
	"events",
	{
		eventId: uuid("event_id").primaryKey().default(sql`uuidv7()`),
		eventType: text("event_type").notNull(),
		aggregateType: text("aggregate_type").notNull(),
		aggregateId: uuid("aggregate_id").notNull(),
		payload: jsonb("payload").notNull(),
		payloadVersion: smallint("payload_version").notNull(),
		metadata: jsonb("metadata").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("events_aggregate_idx").on(
			table.aggregateType,
			table.aggregateId,
			table.createdAt,
		),
	],
);

export const resolutionEventKindEnum = pgEnum("resolution_event_kind", [
	"resolve",
	"correct",
	"void",
]);

// Bucket A. corrects_event_id is self-ref lambda — enables correction-event
// linkage per F-RESOLVE-2 (SPEC.2 §3.6 line 204; SPEC.1 §11 line 553).
export const resolutionEvents = pgTable(
	"resolution_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		eventKind: resolutionEventKindEnum("event_kind").notNull(),
		outcome: marketOutcomeEnum("outcome").notNull(),
		correctsEventId: uuid("corrects_event_id").references(
			(): AnyPgColumn => resolutionEvents.id,
			{ onDelete: "restrict" },
		),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("resolution_events_market_idx").on(table.marketId),
		index("resolution_events_corrects_idx").on(table.correctsEventId),
	],
);

export const payoutTypeEnum = pgEnum("payout_type", [
	"bet_payout",
	"correction_reverse",
	"correction_apply",
	"void_refund",
]);

// Bucket A.
export const payoutEvents = pgTable(
	"payout_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		betId: uuid("bet_id")
			.notNull()
			.references(() => bets.id, { onDelete: "restrict" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		resolutionEventId: uuid("resolution_event_id")
			.notNull()
			.references(() => resolutionEvents.id, { onDelete: "restrict" }),
		payoutType: payoutTypeEnum("payout_type").notNull(),
		amount: numeric("amount", { precision: 38, scale: 18 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("payout_events_bet_idx").on(table.betId),
		index("payout_events_user_idx").on(table.userId),
		index("payout_events_market_idx").on(table.marketId),
		index("payout_events_resolution_idx").on(table.resolutionEventId),
	],
);

export const resolutionEventsRelations = relations(
	resolutionEvents,
	({ one, many }) => ({
		market: one(markets, {
			fields: [resolutionEvents.marketId],
			references: [markets.id],
		}),
		correctsEvent: one(resolutionEvents, {
			fields: [resolutionEvents.correctsEventId],
			references: [resolutionEvents.id],
			relationName: "resolution_corrections",
		}),
		correctedBy: many(resolutionEvents, {
			relationName: "resolution_corrections",
		}),
		payoutEvents: many(payoutEvents),
	}),
);

export const payoutEventsRelations = relations(payoutEvents, ({ one }) => ({
	bet: one(bets, { fields: [payoutEvents.betId], references: [bets.id] }),
	user: one(users, { fields: [payoutEvents.userId], references: [users.id] }),
	market: one(markets, {
		fields: [payoutEvents.marketId],
		references: [markets.id],
	}),
	resolutionEvent: one(resolutionEvents, {
		fields: [payoutEvents.resolutionEventId],
		references: [resolutionEvents.id],
	}),
}));

export const insertEventSchema = createInsertSchema(events);
export const selectEventSchema = createSelectSchema(events);
export const insertResolutionEventSchema = createInsertSchema(resolutionEvents);
export const selectResolutionEventSchema = createSelectSchema(resolutionEvents);
export const insertPayoutEventSchema = createInsertSchema(payoutEvents);
export const selectPayoutEventSchema = createSelectSchema(payoutEvents);
