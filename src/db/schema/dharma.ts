import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	numeric,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./auth";
import { bets } from "./bets";

// SPEC.2 B.7. 10 entry types: 9 per ADR-0008 absorption + initial_grant
// (R-1, ENGINE.5). bet_payout per SPEC.2 B.7 (SPEC.1's bet_settle is
// deprecated, flagged for PRECURSOR.5).
export const dharmaEntryTypeEnum = pgEnum("dharma_entry_type", [
	"bet_stake",
	"bet_payout",
	"daily_allowance",
	"pool_seed",
	"pool_unwind",
	"correction_reverse",
	"correction_apply",
	"void_refund",
	"uncollectable",
	"initial_grant",
]);

// Bucket A (strictly append-only — 3.C trigger). The CHECK on balance_after
// is the lone storage-layer CHECK in 3.B: INV-2 storage-layer enforcement
// (no overdraft). All other CHECK constraints deferred to HARDEN.*.
//
// balance_after is "balance after this row's amount applied" (running
// total). Reads of current balance SELECT the most recent row WHERE user_id.
// The CHECK is per-row, not monotone across rows — the
// previous-plus-amount = balance_after invariant is application-layer math.
//
// No `dharma_transfer` table by design (CLAUDE.md §3 — refusal trigger).
export const dharmaLedger = pgTable(
	"dharma_ledger",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		betId: uuid("bet_id").references(() => bets.id, { onDelete: "restrict" }),
		entryType: dharmaEntryTypeEnum("entry_type").notNull(),
		amount: numeric("amount", { precision: 38, scale: 18 }).notNull(),
		balanceAfter: numeric("balance_after", {
			precision: 38,
			scale: 18,
		}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("dharma_ledger_user_id_idx").on(table.userId),
		index("dharma_ledger_user_created_idx").on(table.userId, table.createdAt),
		index("dharma_ledger_bet_id_idx")
			.on(table.betId)
			.where(sql`${table.betId} IS NOT NULL`),
		// I-DAILY-ONCE-001 storage backstop (ENGINE.12, plan R3): at most ONE
		// daily_allowance row per user per UTC day. The PRIMARY mechanism is the
		// SSI cursor conflict on users.last_allowance_accrued_at inside the W-1
		// SERIALIZABLE tx; this index can only fire on a future logic bug — it
		// fails loudly (23505) rather than ever double-paying. Both expression
		// steps are IMMUTABLE (timezone('UTC', timestamptz) → timestamp;
		// timestamp::date), verified at migration apply.
		uniqueIndex("dharma_ledger_daily_allowance_day_uq")
			.on(table.userId, sql`((timezone('UTC', ${table.createdAt}))::date)`)
			.where(sql`${table.entryType} = 'daily_allowance'`),
		check(
			"dharma_ledger_balance_non_negative",
			sql`${table.balanceAfter} >= 0`,
		),
	],
);

export const dharmaLedgerRelations = relations(dharmaLedger, ({ one }) => ({
	user: one(users, {
		fields: [dharmaLedger.userId],
		references: [users.id],
	}),
	bet: one(bets, {
		fields: [dharmaLedger.betId],
		references: [bets.id],
	}),
}));

export const insertDharmaLedgerSchema = createInsertSchema(dharmaLedger);
export const selectDharmaLedgerSchema = createSelectSchema(dharmaLedger);
