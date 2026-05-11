import { relations, sql } from "drizzle-orm";
import {
	index,
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
// enforce_image_uploads_terminal_atomic rejects partial transitions.
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
		terminalState: imageTerminalStateEnum("terminal_state"),
		terminalAt: timestamp("terminal_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("image_uploads_user_id_idx").on(table.userId),
		index("image_uploads_terminal_state_idx").on(table.terminalState),
		index("image_uploads_created_at_idx").on(table.createdAt),
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
