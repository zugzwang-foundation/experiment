import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { sideEnum } from "./_enums";
import { users } from "./auth";
import { bets } from "./bets";
import { imageUploads } from "./image-uploads";
import { markets } from "./markets";

// Bucket A. side_at_post_time is INV-3 (comments side-bound at post-time);
// 3.C's append-only trigger enforces immutability.
//
// stake_at_post_time (the dead ADR-0009 ranking-function input) was dropped at
// DEBATE.8 (migration 0017) — the ADR-0017 model aggregates value from
// reply-bets at read time, so the frozen column is unneeded. comments_ranking_idx
// (parent_comment_id, side_at_post_time) SURVIVES — it serves that per-side
// aggregation (PRECURSOR.4 lock).
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
		index("comments_bet_id_idx").on(table.betId),
	],
);

// friendly_fire_events (+ the ff_direction enum) was dropped at DEBATE.9
// (migration 0018). ADR-0017's reply-as-bet model makes Support/Counter a
// read-time aggregate over reply-bets — there is no standalone friendly-fire
// up/down vote to store. SPEC.2 §5.5 records the removal; the comments↔bets
// circular pair is unaffected.

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
}));

export const insertCommentSchema = createInsertSchema(comments);
export const selectCommentSchema = createSelectSchema(comments);
