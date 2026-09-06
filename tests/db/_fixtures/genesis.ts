import { v7 as uuidv7 } from "uuid";

import { events } from "@/db/schema";

import { testDb } from "./db";

/**
 * Attach the `market.opened` genesis event a fixture's directly-inserted pool
 * would otherwise be missing.
 *
 * ⛔ WHY EVERY RESOLUTION FIXTURE NEEDS THIS. A fixture that inserts a `pools`
 * row and sets `markets.status` by hand builds a state PRODUCTION CANNOT REACH:
 * `openMarket` is the only path to `Open`, and it emits this event inside the
 * same W-4 transaction, which is what `I-GENESIS-001` asserts. Before ADR-0047
 * the gap was invisible, because nothing downstream read the payload. It stopped
 * being invisible when `settleMarket` and `voidMarket` began reading the discard
 * terms from it: `requireMarketDiscards` fails closed on an absent row, so a
 * fixture without one now exercises the corruption path instead of the happy
 * one.
 *
 * The fix is to make the fixture faithful rather than to loosen the read. A
 * settlement that would throw in a test because the audit trail is incomplete is
 * telling the truth about the fixture.
 *
 * Writes the LEGACY symmetric payload by default, which is what a
 * `yesReserves = noReserves = seed` pool actually corresponds to — the fixtures
 * that want an asymmetric open pass the reserves explicitly.
 */
type GenesisOpen =
	/** Symmetric seed — the legacy payload arm. */
	| { seedAmount: string; reserves?: never }
	/** An ADR-0047 asymmetric open. */
	| { seedAmount?: never; reserves: AsymmetricOpen };

type AsymmetricOpen = {
	yes: string;
	no: string;
	openingPriceYes: string;
	backingMinted: string;
	discardedYes: string;
	discardedNo: string;
};

/**
 * ⚠ Inside a DECLARED partition. `events` is hand-partitioned BY RANGE from
 * 2026-05, so a 2026-01 default would route every fixture genesis row into
 * `events_default` — harmless in the test DB, and silently wrong anywhere that
 * observes partition routing.
 */
const DEFAULT_GENESIS_AT = new Date("2026-06-01T00:00:00.000Z");

export async function attachGenesisEvent(
	args: { marketId: string; createdAt?: Date } & GenesisOpen,
): Promise<void> {
	const payload =
		args.reserves === undefined
			? { marketId: args.marketId, seedAmount: args.seedAmount }
			: {
					marketId: args.marketId,
					yesReserves: args.reserves.yes,
					noReserves: args.reserves.no,
					openingPriceYes: args.reserves.openingPriceYes,
					backingMinted: args.reserves.backingMinted,
					discardedYes: args.reserves.discardedYes,
					discardedNo: args.reserves.discardedNo,
				};

	await testDb.insert(events).values({
		eventId: uuidv7(),
		eventType: "market.opened",
		aggregateType: "market",
		aggregateId: args.marketId,
		payload,
		payloadVersion: 1,
		metadata: {},
		createdAt: args.createdAt ?? DEFAULT_GENESIS_AT,
	});
}
