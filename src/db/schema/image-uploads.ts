import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";

// SPEC.2 B.16. Bucket B with TWO-COLUMN ATOMIC partner: terminal_state and
// terminal_at flip together (NULL → set, once). 3.C's trigger
// enforce_image_uploads_terminal_atomic rejects partial transitions; the
// SCAFFOLD.15 extension to the trigger immutable list adds content_type +
// byte_size (so the full row identity beyond the two-column transition is
// id, user_id, r2_object_key, content_type, byte_size, created_at).
export const imageTerminalStateEnum = pgEnum("image_terminal_state", [
	"committed",
	"blocked",
	"orphan",
]);

export const imageUploads = pgTable(
	"image_uploads",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		r2ObjectKey: text("r2_object_key").notNull(),
		// SCAFFOLD.15 §3.2 — operational columns added by 0006.
		// CHECK (byte_size > 0 AND byte_size <= 8388608) lives in 0006 SQL;
		// Drizzle 0.45 pgTable doesn't surface CHECK natively, so the
		// constraint is migration-only.
		contentType: text("content_type").notNull(),
		byteSize: integer("byte_size").notNull(),
		terminalState: imageTerminalStateEnum("terminal_state"),
		terminalAt: timestamp("terminal_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("image_uploads_user_id_idx").on(table.userId),
		index("image_uploads_created_at_idx").on(table.createdAt),
		// image_uploads_terminal_state_idx dropped in 0006 (full-index over
		// a low-cardinality enum is wasted bytes); replaced by the partial
		// sweep index below, which is the only index the orphan-sweep cron
		// uses for candidate selection.
		index("image_uploads_orphan_sweep_idx")
			.on(table.createdAt)
			.where(sql`terminal_state IS NULL`),
	],
);

export const imageUploadsRelations = relations(imageUploads, ({ one }) => ({
	user: one(users, {
		fields: [imageUploads.userId],
		references: [users.id],
	}),
}));

export const insertImageUploadSchema = createInsertSchema(imageUploads);
export const selectImageUploadSchema = createSelectSchema(imageUploads);
