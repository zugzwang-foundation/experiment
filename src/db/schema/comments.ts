import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { sideEnum } from "./_enums";
import { users } from "./auth";
import { bets } from "./bets";
import { imageUploads } from "./image-uploads";
import { markets } from "./markets";

export const ffDirectionEnum = pgEnum("ff_direction", ["up", "down"]);

// Bucket A. side_at_post_time is INV-3 (comments side-bound at post-time);
// 3.C's append-only trigger enforces immutability.
//
// stake_at_post_time is the ADR-0009 ranking-function input (absorbed into
// SPEC.2 §9 line 220) — used in the
// (parent_comment_id, side_at_post_time) aggregate.
//
// parent_comment_id is self-ref; bet_id is the comments↔bets circular pair
// (matching bets.comment_id NOT NULL — INV-1). Both use lambda form per
// plan §"Common patterns" #2.
//
// image_uploads_id keeps the plural-target → _id naming per SPEC.2 B.6 line
// 2480 (intentional; do not singularize).
export const comments = pgTable(
	"comments",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		parentCommentId: uuid("parent_comment_id").references(
			(): AnyPgColumn => comments.id,
			{ onDelete: "restrict" },
		),
		body: text("body").notNull(),
		imageUploadsId: uuid("image_uploads_id").references(() => imageUploads.id, {
			onDelete: "restrict",
		}),
		sideAtPostTime: sideEnum("side_at_post_time").notNull(),
		stakeAtPostTime: numeric("stake_at_post_time", {
			precision: 38,
			scale: 18,
		}).notNull(),
		betId: uuid("bet_id").references((): AnyPgColumn => bets.id, {
			onDelete: "restrict",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("comments_user_id_idx").on(table.userId),
		index("comments_market_id_idx").on(table.marketId),
		index("comments_parent_idx").on(table.parentCommentId),
		index("comments_market_created_idx").on(table.marketId, table.createdAt),
		index("comments_ranking_idx").on(
			table.parentCommentId,
			table.sideAtPostTime,
		),
		index("comments_image_uploads_idx").on(table.imageUploadsId),
	],
);

// Bucket B with TWO INDEPENDENT whitelisted transitions: frozen_at and
// cleared_at each flip NULL → timestamp once, NEITHER together. 3.C's
// trigger permits either column transitioning alone, rejects both
// transitioning in the same UPDATE, rejects re-firing, rejects other
// column changes.
//
// Ratified by SCAFFOLD.2 stratum 3.B (per session AskUserQuestion); SPEC.2
// §5.1 row 10 + Appendix B.8 amended same-commit.
export const friendlyFireEvents = pgTable(
	"friendly_fire_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		voterId: uuid("voter_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		commentId: uuid("comment_id")
			.notNull()
			.references(() => comments.id, { onDelete: "restrict" }),
		direction: ffDirectionEnum("direction").notNull(),
		clearedAt: timestamp("cleared_at", { withTimezone: true }),
		frozenAt: timestamp("frozen_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("friendly_fire_unique_idx").on(table.voterId, table.commentId),
		index("friendly_fire_ranking_idx").on(
			table.commentId,
			table.frozenAt,
			table.clearedAt,
		),
		index("friendly_fire_voter_idx").on(table.voterId),
	],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
	user: one(users, { fields: [comments.userId], references: [users.id] }),
	market: one(markets, {
		fields: [comments.marketId],
		references: [markets.id],
	}),
	parentComment: one(comments, {
		fields: [comments.parentCommentId],
		references: [comments.id],
		relationName: "comment_thread",
	}),
	childComments: many(comments, { relationName: "comment_thread" }),
	imageUpload: one(imageUploads, {
		fields: [comments.imageUploadsId],
		references: [imageUploads.id],
	}),
	bet: one(bets, { fields: [comments.betId], references: [bets.id] }),
	friendlyFireEvents: many(friendlyFireEvents),
}));

export const friendlyFireEventsRelations = relations(
	friendlyFireEvents,
	({ one }) => ({
		voter: one(users, {
			fields: [friendlyFireEvents.voterId],
			references: [users.id],
		}),
		comment: one(comments, {
			fields: [friendlyFireEvents.commentId],
			references: [comments.id],
		}),
	}),
);

export const insertCommentSchema = createInsertSchema(comments);
export const selectCommentSchema = createSelectSchema(comments);
export const insertFriendlyFireEventSchema =
	createInsertSchema(friendlyFireEvents);
export const selectFriendlyFireEventSchema =
	createSelectSchema(friendlyFireEvents);
