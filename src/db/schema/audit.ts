import { relations, sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";
import { bets } from "./bets";
import { comments } from "./comments";

// SPEC.2 §8 line 933 + bundle: audit-domain file. All three are Bucket A.

export const modVerdictEnum = pgEnum("mod_verdict", [
	"pass",
	"track_a",
	"track_b",
]);

// mod_actions. actor_id is text NOT NULL — 'admin-singleton' or 'system';
// NOT a users FK (admin has no users row per §8.7 pillar 1).
// categories is the OpenAI moderation response object (jsonb).
export const modActions = pgTable(
	"mod_actions",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		targetUserId: uuid("target_user_id").references(() => users.id, {
			onDelete: "restrict",
		}),
		targetCommentId: uuid("target_comment_id").references(() => comments.id, {
			onDelete: "restrict",
		}),
		targetBetId: uuid("target_bet_id").references(() => bets.id, {
			onDelete: "restrict",
		}),
		verdict: modVerdictEnum("verdict").notNull(),
		categories: jsonb("categories").notNull(),
		imageR2Key: text("image_r2_key"),
		actorId: text("actor_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("mod_actions_target_user_idx").on(table.targetUserId),
		index("mod_actions_target_comment_idx").on(table.targetCommentId),
		index("mod_actions_target_bet_idx").on(table.targetBetId),
		index("mod_actions_verdict_idx").on(table.verdict),
		index("mod_actions_created_at_idx").on(table.createdAt),
	],
);

// admin_events. No user_id FK (admin has no users row).
// metadata follows SPEC.2 §3.7 seven-field shape with
// actor_id='admin-singleton' and user_id=NULL.
export const adminEvents = pgTable(
	"admin_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		eventType: text("event_type").notNull(),
		payload: jsonb("payload").notNull(),
		metadata: jsonb("metadata").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("admin_events_event_type_idx").on(table.eventType),
		index("admin_events_created_at_idx").on(table.createdAt),
	],
);

// user_events. event_type open-extensible per SPEC.2 §7.1 line 686.
// metadata uses self-actor encoding (actor_id = user_id).
export const userEvents = pgTable(
	"user_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		eventType: text("event_type").notNull(),
		payload: jsonb("payload").notNull(),
		metadata: jsonb("metadata").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("user_events_user_id_idx").on(table.userId),
		index("user_events_event_type_idx").on(table.eventType),
		index("user_events_created_at_idx").on(table.createdAt),
	],
);

export const modActionsRelations = relations(modActions, ({ one }) => ({
	targetUser: one(users, {
		fields: [modActions.targetUserId],
		references: [users.id],
	}),
	targetComment: one(comments, {
		fields: [modActions.targetCommentId],
		references: [comments.id],
	}),
	targetBet: one(bets, {
		fields: [modActions.targetBetId],
		references: [bets.id],
	}),
}));

export const userEventsRelations = relations(userEvents, ({ one }) => ({
	user: one(users, {
		fields: [userEvents.userId],
		references: [users.id],
	}),
}));

export const insertModActionSchema = createInsertSchema(modActions);
export const selectModActionSchema = createSelectSchema(modActions);
export const insertAdminEventSchema = createInsertSchema(adminEvents);
export const selectAdminEventSchema = createSelectSchema(adminEvents);
export const insertUserEventSchema = createInsertSchema(userEvents);
export const selectUserEventSchema = createSelectSchema(userEvents);
