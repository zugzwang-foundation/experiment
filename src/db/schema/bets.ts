import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { sideEnum } from "./_enums";
import { users } from "./auth";
import { comments } from "./comments";
import { markets } from "./markets";

// sideEnum (bets.side + positions.side + comments.side_at_post_time) lives in
// _enums.ts to break the bets↔comments runtime eval cycle — 3.B erratum
// absorbed by 3.C per docs/plans/SCAFFOLD.2-3C.md §"3.B erratum absorbed".

// Bucket A. comment_id NOT NULL FK to comments.id — the schema-level half
// of INV-1 (bet ↔ comment atomicity). Lambda form per the circular pair
// with comments.bet_id. onDelete: 'restrict' is correct: Bucket-A
// append-only forbids DELETE anyway, but the constraint guards the
// circular pair.
//
// idempotency_key is RFC 8785 canonical-JSON SHA-256 fingerprint per
// ADR-0015. Partial unique index — only constrains non-null keys.
export const bets = pgTable(
	"bets",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		side: sideEnum("side").notNull(),
		stake: numeric("stake", { precision: 38, scale: 18 }).notNull(),
		shareQuantity: numeric("share_quantity", {
			precision: 38,
			scale: 18,
		}).notNull(),
		priceAtBet: numeric("price_at_bet", { precision: 38, scale: 18 }).notNull(),
		commentId: uuid("comment_id")
			.notNull()
			.references((): AnyPgColumn => comments.id, { onDelete: "restrict" }),
		idempotencyKey: text("idempotency_key"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("bets_user_id_idx").on(table.userId),
		index("bets_market_id_idx").on(table.marketId),
		index("bets_user_market_idx").on(table.userId, table.marketId),
		index("bets_comment_id_idx").on(table.commentId),
		index("bets_created_at_idx").on(table.createdAt),
		uniqueIndex("bets_idempotency_key_idx")
			.on(table.idempotencyKey)
			.where(sql`${table.idempotencyKey} IS NOT NULL`),
	],
);

// Bucket C (mutable). Per-user-per-market-per-side share position. updated_at
// is application-managed on every UPDATE (Drizzle 0.45 generated columns
// don't auto-update on UPDATE).
export const positions = pgTable(
	"positions",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		side: sideEnum("side").notNull(),
		quantity: numeric("quantity", { precision: 38, scale: 18 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("positions_user_market_side_idx").on(
			table.userId,
			table.marketId,
			table.side,
		),
		index("positions_user_market_idx").on(table.userId, table.marketId),
		index("positions_user_id_idx").on(table.userId),
		// ENGINE.11 R-5: structural single-side — at most one HELD (quantity>0)
		// row per (user,market). Partial unique index (bets_idempotency_key_idx
		// precedent). The built positions_user_market_side_idx still permits both
		// sides; this closes the SPEC.1 §7-preamble gap.
		uniqueIndex("positions_one_held_side_idx")
			.on(table.userId, table.marketId)
			.where(sql`${table.quantity} > 0`),
		// ENGINE.11 R-3: oversell storage floor — the application mirror is
		// applyPositionDelta's PositionOversellError (dharma_ledger_balance_non_negative
		// precedent; INV-class integrity, mints I-NO-OVERSELL-001).
		check("positions_quantity_non_negative", sql`${table.quantity} >= 0`),
	],
);

export const betsRelations = relations(bets, ({ one }) => ({
	user: one(users, { fields: [bets.userId], references: [users.id] }),
	market: one(markets, { fields: [bets.marketId], references: [markets.id] }),
	comment: one(comments, {
		fields: [bets.commentId],
		references: [comments.id],
	}),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
	user: one(users, { fields: [positions.userId], references: [users.id] }),
	market: one(markets, {
		fields: [positions.marketId],
		references: [markets.id],
	}),
}));

export const insertBetSchema = createInsertSchema(bets);
export const selectBetSchema = createSelectSchema(bets);
export const insertPositionSchema = createInsertSchema(positions);
export const selectPositionSchema = createSelectSchema(positions);
