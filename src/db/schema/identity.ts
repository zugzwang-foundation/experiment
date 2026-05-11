import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// SPEC.2 §13 + ADR-0011 absorption: pre-seeded pool of 50K (colour, animal,
// number) tuples + paired pfp_filename slug. Consumed FIFO at F-AUTH-3 via
// SELECT ... FOR UPDATE SKIP LOCKED; tuple permanently retires per §12.7
// (never returned to pool). Bucket B — assigned_at is the whitelisted
// NULL → timestamp transition.
//
// number range 0–999 per SPEC.1 §13 + ADR-0011; SPEC.2 B.15's "1-9" is drift
// (PRECURSOR.5 backlog).
export const identityPool = pgTable(
	"identity_pool",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		colour: text("colour").notNull(),
		animal: text("animal").notNull(),
		number: smallint("number").notNull(),
		pseudonym: text("pseudonym").notNull().unique(),
		pfpFilename: text("pfp_filename").notNull(),
		assignedAt: timestamp("assigned_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("identity_pool_tuple_idx").on(
			table.colour,
			table.animal,
			table.number,
		),
		index("identity_pool_fifo_idx")
			.on(table.createdAt)
			.where(sql`${table.assignedAt} IS NULL`),
	],
);

export const insertIdentityPoolSchema = createInsertSchema(identityPool);
export const selectIdentityPoolSchema = createSelectSchema(identityPool);
