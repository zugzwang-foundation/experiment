import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	numeric,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { sideEnum } from "./_enums";
import { users } from "./auth";
import { bets } from "./bets";
import { markets } from "./markets";

// ADR-0039 D-1 (per-argument lot accounting). ONE lot per `bets` row, 1:1 —
// R1's "lot = bet = argument", enforced by `lots_bet_id_uq` rather than by
// convention. Because every bet rides exactly one comment (INV-1,
// `bets.comment_id` NOT NULL), a lot cannot exist without an argument: the
// chain lot ⊂ bet ⊂ comment is closed by FK + UNIQUE, so R1 is a storage fact.
//
// Bucket C — MUTABLE, on the `positions` precedent and for the same reason:
// `surviving_shares` / `surviving_basis` are reduced by every sell that reaches
// this lot. So NO 0003 append-only trigger and NO 0021 TRUNCATE guard, and
// `lots` is deliberately NOT added to `tests/db/_fixtures/truncate.ts`'s
// TRUNCATE_GUARDS — a teardown's `TRUNCATE bets CASCADE` reaches `lots` through
// the FK and must succeed. The append-only property this table DOES need is
// TWO-part, and the two parts are enforced in different places: R9's DIRECTION
// (a lot never grows) is APPLICATION-enforced, because the CHECKs below bound
// RANGE and not direction; R9's PERMANENCE (Sold is a state, not a removal) is
// STORAGE-enforced, by `0026`'s row-level `lots_no_delete` BEFORE DELETE
// trigger. Corrected at MERGE-1: this sentence read "and that is a CHECK, not a
// trigger", which is wrong on both halves — see the CHECK block below and
// ADR-0039 D-1.
//
// INV surface (ADR-0039 §Invariant impact): INV-1 reinforced (above); INV-2
// untouched — `surviving_basis` is a COST RECORD, never a spendable balance,
// and no code path reads it as one; INV-3 untouched — no lot path reads or
// writes `comments.side_at_post_time`; INV-4 untouched — per-lot settlement
// attribution (D-6) is read-time derivation over rows that already exist and
// appends no `payout_events` row.
//
// MINTS one invariant-class rule (R2), the reason this table is safe to add at
// all: **Σ surviving lot shares == positions.quantity, per (user, market,
// side)**. Its test is `I-LOT-SUM-001`; its storage backstop is the per-lot
// bounding CHECKs below, which bound every summand from both ends.
export const lots = pgTable(
	"lots",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		// R1's 1:1. UNIQUE below. ON DELETE RESTRICT is belt-and-braces: `bets` is
		// Bucket A, so a bet row is never deleted anyway.
		betId: uuid("bet_id")
			.notNull()
			.references(() => bets.id, { onDelete: "restrict" }),
		// user_id / market_id / side are DENORMALIZED from the bet rather than
		// reached through a join, because R2's invariant is stated per
		// (user, market, side) and has to be checkable by ONE indexed aggregate
		// read. They are immutable after mint and are never the authority — `bets`
		// is. A drift between them and the bet is unrepresentable in practice
		// (both are written from the same RETURNING row inside the same W-1 tx).
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		marketId: uuid("market_id")
			.notNull()
			.references(() => markets.id, { onDelete: "restrict" }),
		side: sideEnum("side").notNull(),
		// `bets.share_quantity` at mint. NEVER mutates — the denominator of the
		// D-6 settlement attribution and of the R6 "reduced figure" percentage.
		originalShares: numeric("original_shares", {
			precision: 38,
			scale: 18,
		}).notNull(),
		// `bets.stake` at mint. NEVER mutates. The frozen historical stake also
		// survives independently in Bucket-A `bets.stake`; this is the lot's own
		// copy so a lot can be read without joining back.
		originalBasis: numeric("original_basis", {
			precision: 38,
			scale: 18,
		}).notNull(),
		// MUTABLE, monotone non-increasing (R9). The R2 summand.
		survivingShares: numeric("surviving_shares", {
			precision: 38,
			scale: 18,
		}).notNull(),
		// MUTABLE, monotone non-increasing (R9). Σ over surviving lots IS Đa
		// (D-4) — this column replaces `episodes.ts`'s walk as the basis
		// authority.
		survivingBasis: numeric("surviving_basis", {
			precision: 38,
			scale: 18,
		}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		// Application-managed on every UPDATE (Drizzle 0.45 does not auto-bump on
		// UPDATE — the `positions.updated_at` precedent).
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		// R1 in storage: one lot per bet, exactly. This is also what makes the
		// D-5 ranking join (`lots ON lots.bet_id = rb.id`) an index lookup rather
		// than a scan.
		uniqueIndex("lots_bet_id_uq").on(table.betId),
		// The R2 aggregate read AND the per-holding decomposition read.
		index("lots_user_market_side_idx").on(
			table.userId,
			table.marketId,
			table.side,
		),
		// The HOT read: only SURVIVING lots are rendered or sellable, and a
		// long-lived market accumulates Sold lots that every such read would
		// otherwise skip over. Partial index on the
		// `positions_one_held_side_idx` / `bets_idempotency_key_idx` precedent.
		index("lots_surviving_idx")
			.on(table.userId, table.marketId, table.side)
			.where(sql`${table.survivingShares} > 0`),
		// FK-on-referencing-side convention (AGENTS.md §6; the A31
		// `positions_market_id_idx` precedent). `market_id` is not the leading
		// column of any index above, so it is uncovered otherwise.
		index("lots_market_id_idx").on(table.marketId),
		// As above for `user_id` — it IS the leading column of
		// lots_user_market_side_idx, so this is the convention's belt rather than
		// a new access path (`bets_user_id_idx` precedent, same shape).
		index("lots_user_id_idx").on(table.userId),
		// A lot with no shares or no basis is not a lot. The ADR-0018 bet floors
		// already guarantee both at mint; these reject a corrupted writer.
		check("lots_original_shares_positive", sql`${table.originalShares} > 0`),
		check("lots_original_basis_positive", sql`${table.originalBasis} > 0`),
		// R2's floor, mirroring `positions_quantity_non_negative`: a summand of a
		// non-negative aggregate cannot itself go negative.
		check(
			"lots_surviving_shares_non_negative",
			sql`${table.survivingShares} >= 0`,
		),
		check(
			"lots_surviving_basis_non_negative",
			sql`${table.survivingBasis} >= 0`,
		),
		// R9's RANGE bound — and ONLY that. `surviving <= original` says a lot is
		// never larger than it was minted. It does NOT say a lot never GROWS: an
		// UPDATE raising `surviving_shares` from 5 back to 20 against an original
		// of 20 satisfies both CHECKs, and nothing at the storage layer refuses
		// it. So R9's MONOTONICITY is APPLICATION-enforced — `sellFromLot` is the
		// only function that computes a new surviving value, and
		// `planLotSale`/`applyLotSale` the only path that writes one — while R9's
		// PERMANENCE is storage-enforced by `0026`'s `lots_no_delete`. The
		// UPDATE-monotonicity trigger that would move the first half into storage
		// too is DOCKETED, not built (ADR-0039 D-1).
		//
		// ⚠ Corrected at MERGE-1. This comment claimed the comparison against the
		// immutable originals was "strictly stronger than comparing against the
		// previous value (which storage cannot see)". Both halves were false, and
		// backwards: `new <= old` IMPLIES `new <= original` and the converse does
		// not, so the dismissed comparison is the stronger one; and storage sees
		// the previous value whenever a trigger is asked to look — `0003`'s
		// Bucket-B functions compare OLD/NEW row images routinely, which is the
		// entire mechanism of the whitelisted-transition pattern.
		check(
			"lots_surviving_shares_monotone",
			sql`${table.survivingShares} <= ${table.originalShares}`,
		),
		check(
			"lots_surviving_basis_monotone",
			sql`${table.survivingBasis} <= ${table.originalBasis}`,
		),
		// R6/R10 — a fully-sold lot carries NO basis, so `Sold` is exact on either
		// column.
		//
		// ⚠ DELIBERATELY ONE-DIRECTIONAL. The converse (`surviving_basis = 0 →
		// surviving_shares = 0`) is NOT enforced, because 18-dp half-even
		// quantization of a pro-rata reduction can in principle round a basis to
		// zero while dust shares remain. That state is unreachable over real data
		// — it needs a basis-to-shares ratio below 1e-18, i.e. an execution price
		// below 1e-18, and CPMM prices live in (0,1) with stakes floored by
		// ADR-0018 — but it is arithmetic, not law, so it is not asserted as a
		// constraint. The canonical Sold predicate is therefore
		// `surviving_shares = 0`; the two columns zero TOGETHER BY LAW on a full
		// lot sale (`sellFromLot` sets both to canonical zero rather than dividing
		// to it — the `computeEpisodes` full-exit precedent).
		check(
			"lots_sold_zeroes_basis",
			sql`${table.survivingShares} > 0 OR ${table.survivingBasis} = 0`,
		),
	],
);

export const lotsRelations = relations(lots, ({ one }) => ({
	bet: one(bets, { fields: [lots.betId], references: [bets.id] }),
	user: one(users, { fields: [lots.userId], references: [users.id] }),
	market: one(markets, { fields: [lots.marketId], references: [markets.id] }),
}));

export const insertLotSchema = createInsertSchema(lots);
export const selectLotSchema = createSelectSchema(lots);
