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
import { markets } from "./markets";

// SPEC.2 §8 line 933 + bundle: audit-domain file. All three are Bucket A.

export const modVerdictEnum = pgEnum("mod_verdict", [
	"pass",
	"track_a",
	"track_b",
]);

// DEBATE.7 / ADR-0021 §78 ∪ §84 — the reactive-moderation action reason. The
// three GATE auto-action reasons (track_a_autoban / track_b_blocked /
// sexual_minors_text_blocked) are written by `recordGateBlock` (the standalone-tx
// consequence writer). `content_removed` + `user_banned` are FORWARD-COMPAT for
// the reactive admin-dashboard stratum (added now so that stratum needs no
// further migration — DEBATE.7 builds NO handler for them).
export const modReasonEnum = pgEnum("mod_reason", [
	"track_a_autoban",
	"track_b_blocked",
	"sexual_minors_text_blocked",
	"content_removed",
	"user_banned",
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
		// DEBATE.7: gate-block rows have no comment to JOIN → the market the
		// blocked submit targeted, for F-ADMIN-5 market search + the dashboard
		// market filter. NULL for rows that carry a comment/bet target instead.
		targetMarketId: uuid("target_market_id").references(() => markets.id, {
			onDelete: "restrict",
		}),
		// DEBATE.7: the action reason — NOT NULL (gate auto-actions AND reactive
		// admin actions all carry one). The discriminant the reactive dashboard
		// filters on (e.g. sexual_minors_text_blocked → ban-review).
		reason: modReasonEnum("reason").notNull(),
		// The GATE outcome; relaxed to NULLABLE (DEBATE.7) — reactive admin-action
		// rows (content_removed / user_banned) have no gate verdict.
		verdict: modVerdictEnum("verdict"),
		categories: jsonb("categories").notNull(),
		// DEBATE.7: the rejected comment body for a gate-block (no comment row
		// exists for a blocked submit) — retained for the carve-out's reactive
		// ban-review (SPEC.1 §786); admin-only (STRIP-in-dataset). NULL otherwise.
		blockedText: text("blocked_text"),
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
		index("mod_actions_target_market_idx").on(table.targetMarketId),
		index("mod_actions_reason_idx").on(table.reason),
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
