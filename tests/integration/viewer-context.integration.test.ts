import { count, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { dharmaLedger, events, markets, pools, users } from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
// GREENFIELD VALUE IMPORT (the RED driver): `@/server/debate-view/
// viewer-context` lands with UI.A2 §9 slice 3 — until then this suite fails
// to resolve (the dharma-ledger.integration precedent).
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
import { accrueDailyCredit } from "@/server/dharma/accrual";
import { appendLedgerRow, readBalance } from "@/server/dharma/persist";
import { PositionSingleSideError } from "@/server/positions/errors";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// UI.A2 §9 slice 3 — `loadViewerMarketContext`, the composed viewer-session
// read (@docs/plans/UI-A2.md §3.3). DB-BACKED against local Postgres :54322.
//
// THE load-bearing scenario is the plan-§1 INV-2 "read-that-writes"
// narrative: a viewer context implemented by CALLING accrueDailyCredit (the
// tempting reuse) instead of previewing it would turn every page load by an
// unpaid-today user into a Daily-Credit mint WITHOUT a commented bet —
// attendance becoming issuance, the exact ADR-0018 rejected-Option-4 failure,
// a public read surface as a Dharma faucet. ::read-only-no-ledger-write pins
// row-count + cursor invariance across the read; the
// ::spendable-preview-parity pair pins the preview arithmetic to
// accrueDailyCredit's own paid/unpaid behavior (shared utcDayOf import) so
// the two can never drift apart silently (plan self-critique #4).
//
// Pinned DTO (plan §3.3, ratified OQ-3 — NO `staked` field):
//   { position: { side; quantity; currentValue } | null;
//     balance; spendableToday }
// `currentValue` basis is RULED (FI-2): computeSell(quantity).proceeds — the
// impact-inclusive sell-all EXECUTION value, NOT a mark-to-p1 spot mark.
// READ-ONLY BY LAW: no ledger append, no accrual write, no cursor write, no
// events row — ever.
//
// Money/share values are decimal STRINGS via CpmmDecimal — never JS floats
// (CLAUDE.md §2).

// The 7-field events metadata shape (schemas.ts eventMetadataSchema; the
// positions.integration META precedent) — consumed by the parity tests'
// REAL accrueDailyCredit call.
const META = {
	request_id: "test",
	flow_id: "test",
	user_id: null,
	actor_id: "test",
	idempotency_key: null,
	ip: "test",
	user_agent: "test",
};

const SEED_RESERVES = "100.000000000000000000";
const GRANT = "1000";
/** Held quantity in the exact 18-dp form NUMERIC(38,18) reads back. */
const HELD_QTY = "50.000000000000000000";

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Viewer-Context User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Viewer-Context Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedGrant(userId: string, amount: string): Promise<void> {
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount, entryType: "initial_grant" }),
	);
}

// Raw position seed (fixture-bypass, the I-SINGLE-SIDE-001 pattern) — forces
// exact stored rows without the app layer.
async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO positions (user_id, market_id, side, quantity)
		 VALUES ($1, $2, $3, $4)`,
		[args.userId, args.marketId, args.side, args.quantity],
	);
}

async function ledgerCount(userId: string): Promise<number> {
	const [row] = await testDb
		.select({ n: count() })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
	return row?.n ?? -1;
}

async function eventsCount(): Promise<number> {
	const [row] = await testDb.select({ n: count() }).from(events);
	return row?.n ?? -1;
}

async function readCursor(userId: string): Promise<Date | null> {
	const rows = await testDb
		.select({ lastAllowanceAccruedAt: users.lastAllowanceAccruedAt })
		.from(users)
		.where(eq(users.id, userId));
	return rows[0]?.lastAllowanceAccruedAt ?? null;
}

/**
 * The parity vehicle: ACTUALLY accrue (what the preview only previews) — a
 * real `accrueDailyCredit` inside a testDb.transaction, `previousBalance`
 * read via `readBalance` in the SAME tx (the accrual.ts caller contract),
 * `creditEventId` a freshly minted UUIDv7 (insertEvent hard-requires v7).
 */
async function runRealAccrual(userId: string) {
	return testDb.transaction(async (tx) => {
		const previousBalance = await readBalance(tx, userId);
		return accrueDailyCredit(tx, {
			userId,
			previousBalance,
			creditEventId: uuidv7(),
			metadata: META,
		});
	});
}

describe("UI.A2 viewer-session context — loadViewerMarketContext (read-only by law)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"positions",
			"pools",
			"markets",
			"users",
		]);
	});

	it("viewer-context::shape-no-position", async () => {
		// Seeded user (initial_grant ledger row), Open market + pool, NO
		// position → { position: null, balance: grant, spendableToday: grant +
		// credit } (a fresh user's cursor is NULL — unpaid).
		const userId = await seedUser("vc-shape-null", "vc-shape-null");
		const marketId = await seedOpenMarketWithPool("vc-shape-null-market");
		await seedGrant(userId, GRANT);

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });

		expect(ctx.position).toBeNull();
		// balance: readBalance — the latest ledger balance_after, 18-dp.
		expect(ctx.balance).toBe(new CpmmDecimal(GRANT).toFixed(18));
		// spendableToday: unpaid → grant + DAILY_CREDIT_DHARMA (live constant).
		expect(ctx.spendableToday).toBe(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);
	});

	it("viewer-context::shape-held-position", async () => {
		// Held YES position + seeded pool → the FI-2 basis pin: currentValue ==
		// computeSell(reserves, "yes", quantity).proceeds EXACTLY — the
		// impact-inclusive sell-all execution value. cpmm Side is lowercase;
		// positions side is uppercase — the module owns the translation.
		const userId = await seedUser("vc-shape-held", "vc-shape-held");
		const marketId = await seedOpenMarketWithPool("vc-shape-held-market");
		await seedGrant(userId, GRANT);
		await seedPosition({ userId, marketId, side: "YES", quantity: HELD_QTY });

		const sell = computeSell({
			reserves: { yes: SEED_RESERVES, no: SEED_RESERVES },
			side: "yes",
			shares: HELD_QTY,
		});

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });

		expect(ctx.position).toEqual({
			side: "YES",
			quantity: HELD_QTY,
			currentValue: sell.proceeds,
		});

		// The rejected alternative (mark-to-p1 spot mark, FI-2) genuinely
		// DIVERGES at these values — the pin above is meaningful, not vacuous:
		// a mark-to-p1 implementation fails the toEqual.
		const markToP1 = new CpmmDecimal(HELD_QTY).times(sell.p1).toFixed(18);
		expect(sell.proceeds).not.toBe(markToP1);
		expect(ctx.position?.currentValue).not.toBe(markToP1);
	});

	it("viewer-context::read-only-no-ledger-write", async () => {
		// THE INV-2 narrative (plan §1): the UNPAID user is the tempting-accrual
		// case. The read must PREVIEW the credit while writing NOTHING — no
		// ledger append, no events row, no cursor write. A held position is
		// seeded so the FULLEST read path runs (position + pool + balance +
		// cursor) and none of it may write.
		const userId = await seedUser("vc-readonly", "vc-readonly");
		const marketId = await seedOpenMarketWithPool("vc-readonly-market");
		await seedGrant(userId, GRANT);
		await seedPosition({ userId, marketId, side: "YES", quantity: HELD_QTY });

		// Snapshot BEFORE: exactly the seed grant; cursor NULL (unpaid).
		const ledgerBefore = await ledgerCount(userId);
		const eventsBefore = await eventsCount();
		expect(ledgerBefore).toBe(1); // the initial_grant row only
		expect(await readCursor(userId)).toBeNull();

		const first = await loadViewerMarketContext(testDb, { userId, marketId });

		// The preview DID preview the credit …
		expect(first.balance).toBe(new CpmmDecimal(GRANT).toFixed(18));
		expect(first.spendableToday).toBe(
			new CpmmDecimal(first.balance).plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);

		// … and NOTHING moved: ledger count, events count, cursor all unchanged.
		expect(await ledgerCount(userId)).toBe(ledgerBefore);
		expect(await eventsCount()).toBe(eventsBefore);
		expect(await readCursor(userId)).toBeNull();

		// A second consecutive call returns IDENTICAL figures (no state moved) —
		// and still writes nothing.
		const second = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(second).toEqual(first);
		expect(await ledgerCount(userId)).toBe(ledgerBefore);
		expect(await eventsCount()).toBe(eventsBefore);
		expect(await readCursor(userId)).toBeNull();
	});

	it("viewer-context::spendable-preview-parity-unpaid", async () => {
		// The preview and the REAL accrual can't drift: both flow through the
		// SHARED utcDayOf (plan self-critique #4). Preview first, then actually
		// run accrueDailyCredit — its returned balanceAfter must equal the
		// earlier preview EXACTLY. (Day-flip-safe: a NULL cursor is unpaid on
		// ANY day, so the pair holds even across a midnight straddle.)
		const userId = await seedUser("vc-parity-unpaid", "vc-parity-unpaid");
		const marketId = await seedOpenMarketWithPool("vc-parity-unpaid-market");
		await seedGrant(userId, GRANT);

		const preview = (
			await loadViewerMarketContext(testDb, { userId, marketId })
		).spendableToday;

		const accrued = await runRealAccrual(userId);
		expect(accrued.credited).toBe(true);
		expect(accrued.balanceAfter).toBe(preview);
	});

	it("viewer-context::spendable-preview-parity-paid", async () => {
		// Immediately after a real accrual the user is PAID for the UTC day: a
		// fresh read reports balance == the accrued balanceAfter and
		// spendableToday == balance — the credit is never double-counted.
		const userId = await seedUser("vc-parity-paid", "vc-parity-paid");
		const marketId = await seedOpenMarketWithPool("vc-parity-paid-market");
		await seedGrant(userId, GRANT);

		const accrued = await runRealAccrual(userId);
		expect(accrued.credited).toBe(true);

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(ctx.balance).toBe(accrued.balanceAfter);
		expect(ctx.spendableToday).toBe(ctx.balance);
	});

	it("viewer-context::single-side-assert-inherited", async () => {
		// getHeldPosition's ≤1-held assert must SURFACE through the composed
		// read. The partial unique index positions_one_held_side_idx normally
		// makes a second held row impossible (23505 — I-SINGLE-SIDE-001 pins
		// that), so to exercise the inherited throw we SIMULATE the index being
		// absent (a bad/mis-applied migration) — the positions.integration
		// drift-D3 pattern: drop, seed both sides raw, assert, then RESTORE the
		// index byte-faithful to the migration-defined shape.
		const userId = await seedUser("vc-dual-side", "vc-dual-side");
		const marketId = await seedOpenMarketWithPool("vc-dual-side-market");
		await seedGrant(userId, GRANT);

		await testClient.unsafe(`DROP INDEX positions_one_held_side_idx`);
		try {
			await seedPosition({ userId, marketId, side: "YES", quantity: "10" });
			await seedPosition({ userId, marketId, side: "NO", quantity: "10" });

			await expect(
				loadViewerMarketContext(testDb, { userId, marketId }),
			).rejects.toBeInstanceOf(PositionSingleSideError);
		} finally {
			// Clear the illegal rows BEFORE re-creating the unique index, then
			// restore the index to the migration-defined shape.
			await testClient.unsafe(`TRUNCATE positions CASCADE`);
			await testClient.unsafe(
				`CREATE UNIQUE INDEX positions_one_held_side_idx
				 ON positions (user_id, market_id) WHERE quantity > 0`,
			);
		}
	});
});
