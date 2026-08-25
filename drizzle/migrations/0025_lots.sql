-- LOTS-1 · ADR-0039 D-1 — per-argument lot accounting.
--
-- ONE lot per `bets` row, 1:1 (R1: lot = bet = argument), enforced by
-- `lots_bet_id_uq`. Because `bets.comment_id` is NOT NULL (INV-1), the chain
-- lot ⊂ bet ⊂ comment is closed by FK + UNIQUE — a lot cannot exist without an
-- argument, as a storage fact rather than a convention.
--
-- BUCKET C (mutable), on the `positions` precedent: `surviving_shares` /
-- `surviving_basis` are reduced by every sell reaching the lot. Therefore:
--   * NO 0003 append-only row triggers, and
--   * NO 0021 statement-level TRUNCATE guard, and
--   * `lots` is deliberately NOT added to TRUNCATE_GUARDS in
--     `tests/db/_fixtures/truncate.ts` — a teardown's `TRUNCATE bets CASCADE`
--     reaches `lots` through the FK and MUST succeed.
-- The append-only property this table needs is DIRECTIONAL (R9: a lot never
-- grows; Sold is permanent), and that is a CHECK, not a trigger.
--
-- NO BACK-FILL (R8), and this is a property of the migration rather than a
-- convention around it: the statements below create an empty table and INSERT
-- nothing. A back-fill would need per-argument attribution for positions built
-- before lots existed, and that information was never recorded. Verified at
-- authoring time WITHOUT touching production: the live window opens
-- 2026-09-15 (CLAUDE.md §1) and the prod alias still serves a 2026-07-02 build
-- (AGENTS.md:139), so no participant has ever placed a bet.
--
-- THE HALT CONDITION IS SCOPED TO BETS PLACED AFTER THIS MIGRATION, and the
-- scope is the whole point of it. "Any `bets` row with no matching `lots` row"
-- is satisfied by every pre-existing bet the instant this file applies —
-- staging tripped it on contact — because R8 is precisely the decision NOT to
-- give those rows a lot. A halt that fires on the state the migration was
-- designed to create is not a halt; it is noise that teaches the operator to
-- ignore the alarm, and it would have gone off on the one environment anybody
-- was watching.
--
-- What is actually alarming is a bet minted by code that was supposed to mint
-- a lot with it and did not. So: a `bets` row whose `created_at` is at or after
-- the moment this migration applied in that environment — readable per-database
-- from `drizzle.__drizzle_migrations.created_at` for `folderMillis`
-- 1787261127286 — and which has no matching `lots` row, is a HALT condition.
-- Never a back-fill trigger: back-filling would invent the per-argument
-- attribution R8 exists to say was never recorded. Bets older than that instant
-- are expected to have no lot, and always will.
--
-- MINTS the invariant-class rule R2, tested by `I-LOT-SUM-001`:
--   Σ lots.surviving_shares == positions.quantity, per (user_id, market_id, side)
-- The CHECKs below are its storage backstop: they bound every summand from
-- both ends, so the aggregate cannot drift by a single row going out of range.
--
-- Purely ADDITIVE — no ALTER on any live table, no column drop, no data
-- movement — so it satisfies ADR-0024's expand/contract rule trivially and is
-- safe under migrate-before-serve: code that predates it ignores a table it
-- does not know about.
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"original_shares" numeric(38, 18) NOT NULL,
	"original_basis" numeric(38, 18) NOT NULL,
	"surviving_shares" numeric(38, 18) NOT NULL,
	"surviving_basis" numeric(38, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lots_original_shares_positive" CHECK ("lots"."original_shares" > 0),
	CONSTRAINT "lots_original_basis_positive" CHECK ("lots"."original_basis" > 0),
	CONSTRAINT "lots_surviving_shares_non_negative" CHECK ("lots"."surviving_shares" >= 0),
	CONSTRAINT "lots_surviving_basis_non_negative" CHECK ("lots"."surviving_basis" >= 0),
	CONSTRAINT "lots_surviving_shares_monotone" CHECK ("lots"."surviving_shares" <= "lots"."original_shares"),
	CONSTRAINT "lots_surviving_basis_monotone" CHECK ("lots"."surviving_basis" <= "lots"."original_basis"),
	CONSTRAINT "lots_sold_zeroes_basis" CHECK ("lots"."surviving_shares" > 0 OR "lots"."surviving_basis" = 0)
);
--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lots_bet_id_uq" ON "lots" USING btree ("bet_id");--> statement-breakpoint
CREATE INDEX "lots_user_market_side_idx" ON "lots" USING btree ("user_id","market_id","side");--> statement-breakpoint
CREATE INDEX "lots_surviving_idx" ON "lots" USING btree ("user_id","market_id","side") WHERE "lots"."surviving_shares" > 0;--> statement-breakpoint
CREATE INDEX "lots_market_id_idx" ON "lots" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "lots_user_id_idx" ON "lots" USING btree ("user_id");

-- ============================================================================
-- DOWN  (recorded, NOT applied — see below)
-- ============================================================================
--
--   DROP TABLE IF EXISTS "lots";
--
-- That single statement is the complete reversal, and it is complete precisely
-- because this migration is additive: it creates one table and touches nothing
-- else, so dropping that table restores the prior schema exactly. The three
-- FKs, five indexes and seven CHECKs all live on `lots` and go with it; no
-- other table gained a column, a constraint or a trigger here, so none needs
-- unwinding.
--
-- It reads as eight only if you count `lots_bet_id_uq` twice. That UNIQUE is
-- already one of the five indexes; ADR-0039's constraint table lists it
-- alongside the seven CHECKs because the table is about what constrains the
-- row, not about what kind of object does the constraining. The ADR was
-- corrected at s1→s2 and this sentence was not, which is the whole lesson:
-- a count restated in a second place is a count that goes stale in one of them.
--
-- WHY IT IS A COMMENT AND NOT AN ARTIFACT. This repo's migrations are
-- forward-only and append-only (AGENTS.md §6: never edit a committed
-- migration; write a new one), and `drizzle-kit` has no down-migration
-- runner wired here. Shipping an executable down file would create a path
-- nothing runs and nothing tests — and an untested reversal is more dangerous
-- than none, because it invites someone to trust it in the one situation where
-- they cannot afford to be wrong. Reversal in practice is a NEW forward
-- migration carrying the statement above.
--
-- This block exists so that whoever writes that migration does not have to
-- re-derive the statement, or re-establish that it is sufficient, under the
-- time pressure that would be the reason they are reading it.
