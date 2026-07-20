import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";
import { comments } from "./comments";

// ADR-0032 D-1 + SPEC.2 §5.1 (bookmarks domain, Bucket C). Private, mutable,
// deletable convenience state: a viewer's saved pointers at other authors'
// comments. Bucket C — MUTABLE: un-bookmark is a legitimate DELETE, so NO
// append-only trigger and NO TRUNCATE guard (contrast the Bucket-A tables;
// `bookmarks` is deliberately NOT in the TRUNCATE_GUARDS set — the guard count
// is unchanged). Carries `user_id` (the viewer) unlike `market_media`.
//
// INV surface: none. No `events` / `dharma_ledger` / `bets` / `comments` /
// `resolution` write rides a bookmark; EVENT_TYPES stays 24 (ADR-0032 Option 1
// is event-free). The write path is two idempotent Server Actions (add/remove);
// the read is a cross-author list rendered in the Profile surface's
// forced-visitor mode (§4 of the plan).
export const bookmarks = pgTable(
	"bookmarks",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		// The viewer who saved the bookmark. ON DELETE RESTRICT is safe: a
		// scrubbed `users` row persists under placeholder (H2 erasure keeps the
		// row), so the referent is never hard-deleted.
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		// The saved post/reply comment. ON DELETE RESTRICT is safe: `comments` is
		// Bucket A (append-only) — a comment row is never hard-deleted (content
		// removal is a masking flag, not a DELETE).
		commentId: uuid("comment_id")
			.notNull()
			.references(() => comments.id, { onDelete: "restrict" }),
		// Drives list order (ADR-0032 D-8): the /bookmarks read is
		// `ORDER BY created_at DESC` (recency), NOT the RANKING.md profile order.
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		// ADR-0032 D-1: a comment is bookmarked at most once per user — the
		// storage backstop behind the idempotent `ON CONFLICT DO NOTHING` write.
		// Its leading `user_id` column also serves the list scan.
		uniqueIndex("bookmarks_user_id_comment_id_uq").on(
			table.userId,
			table.commentId,
		),
		// The list read is a `WHERE user_id = $viewer` scan (FK-on-referencing-side
		// convention, per `market_media` / `image_uploads_user_id_idx`).
		index("bookmarks_user_id_idx").on(table.userId),
		// FK-on-referencing-side convention (AGENTS.md §6) for the SECOND FK.
		// `comment_id` is the trailing column of the composite unique, so it is
		// not covered by any single-column index otherwise — same shape/closure
		// as `positions_market_id_idx` (A31) and the `bets_comment_id_idx` /
		// `mod_actions_target_comment_idx` precedents (identical `comments`
		// referent, both indexed). Added at @db-migration-reviewer's FAIL on the
		// plan §3.1 / ADR-0032 D-1 under-specification (Slice 1 absorb).
		index("bookmarks_comment_id_idx").on(table.commentId),
	],
);

export const insertBookmarkSchema = createInsertSchema(bookmarks);
export const selectBookmarkSchema = createSelectSchema(bookmarks);
