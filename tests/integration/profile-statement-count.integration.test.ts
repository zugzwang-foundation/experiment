import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import * as schema from "@/db/schema";
import { bets, comments, markets, pools, positions, users } from "@/db/schema";
import { loadProfileArguments } from "@/server/profile/arguments";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

import { testClient, testDb } from "../db/_fixtures/db";
import { seedLotForBet, seedLotSaleForBetId } from "../db/_fixtures/lots";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * POSREV-1 S1 — **THE STATEMENT-COUNT PIN.**
 *
 * RF-13 widens the positions row domain to admit fully-exited holdings so the
 * Closed tab is not permanently empty. The one way that change can go wrong is
 * by paying for the extra rows with extra round trips — an N+1 that only shows
 * up on a participant holding eight markets, which is nobody in the test suite
 * and everybody at conclusion.
 *
 * So the count is PINNED rather than reasoned about, and it is pinned at TWO
 * holding counts. One number alone cannot distinguish "fixed cost" from "cost
 * per market"; two can, and the assertion that M=1 and M=8 are EQUAL is the
 * whole point of measuring twice.
 *
 * ⚠ **MEASURED AT THE DRIVER, NOT AT THE CALL SITES.** postgres-js's `debug`
 * hook fires once per statement actually sent over the wire, so this counts SQL
 * rather than counting method calls that are believed to produce SQL. A read
 * hidden inside a helper, a lazy relation, or a driver-level retry all land in
 * the same total. Counting `db.select(...)` invocations would have measured the
 * shape of the code instead of the shape of the load.
 *
 * The counted surface is the RSC's read-model half — `resolveProfileUser`,
 * `loadProfilePositions`, `loadProfileArguments`, `loadProfileTiles`
 * (`u/[pseudonym]/page.tsx:50-65`). `auth.api.getSession` is deliberately
 * outside it: it is Better Auth's own session read, identical on every route,
 * and nothing in POSREV-1 can move it.
 */

const POOL = "100.000000000000000000";
const PRICE = "0.500000000000000000";

/**
 * The pin. MEASURED on `origin/main` @ 193d95a BEFORE the RF-13 widening, and
 * re-measured after it; the two must agree, which is the whole contract.
 * A change here is a DECISION — read `docs/plans/POSREV-1.md` §6 first.
 */
const PINNED_STATEMENTS = 21;

const TRUNCATE_LIST = [
	"events",
	"payout_events",
	"resolution_events",
	"mod_actions",
	"dharma_ledger",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

// A SECOND drizzle client, opened with the driver's `debug` hook so statements
// can be counted. `max: 1` for the same reason `_fixtures/db.ts` uses it — one
// connection means the count cannot be split across sessions.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL not set; tests cannot connect.");
}

let statements: string[] = [];
let counting = false;

const countedClient = postgres(connectionString, {
	max: 1,
	debug: (_conn, query) => {
		if (counting) {
			statements.push(query);
		}
	},
});
const countedDb = drizzle(countedClient, { schema });

afterAll(async () => {
	await countedClient.end({ timeout: 5 });
});

/** Drive the page's read-model half and return the statements it issued. */
async function countProfileLoad(pseudonym: string): Promise<string[]> {
	statements = [];
	counting = true;
	try {
		const user = await resolveProfileUser(countedDb, pseudonym);
		if (user === null) {
			throw new Error(`fixture user ${pseudonym} did not resolve`);
		}
		const [positionRows] = await Promise.all([
			loadProfilePositions(countedDb, { userId: user.id }),
			loadProfileArguments(countedDb, { userId: user.id }),
		]);
		await loadProfileTiles(countedDb, {
			userId: user.id,
			positions: positionRows,
		});
	} finally {
		counting = false;
	}
	// Transaction control and session setup are not read-model cost. Nothing in
	// this path opens a transaction today; the filter is here so that if one
	// ever does, the pin measures the READS rather than moving by two.
	return statements.filter(
		(s) => !/^\s*(begin|commit|rollback|set)\b/i.test(s),
	);
}

async function seedUser(pseudonym: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${pseudonym}`,
		email: `${pseudonym}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

/**
 * One market the user has a position row in: market + pool + comment + bet
 * (+ its lot) + position.
 *
 * ⚠⚠ `exited: true` SEEDS THE RF-13 ROW — position at zero, lot fully sold — and
 * without at least one of those the pin measures the domain as it was BEFORE the
 * widening. Every fixture here originally held a positive quantity, so the
 * widened predicate admitted exactly the rows the old one did and the plan's §6
 * contract ("the widening lengthens the `IN` lists and adds no statement") was
 * never exercised. Caught by @code-reviewer HIGH-2.
 */
async function seedHeldMarket(args: {
	userId: string;
	slug: string;
	stake: string;
	shares: string;
	exited?: boolean;
}): Promise<string> {
	const marketId = uuidv7();
	await testDb.insert(markets).values({
		id: marketId,
		slug: args.slug,
		title: `Market ${args.slug}`,
		status: "Open",
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
	});
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: POOL, noReserves: POOL });
	const commentId = uuidv7();
	await testDb.insert(comments).values({
		id: commentId,
		userId: args.userId,
		marketId,
		parentCommentId: null,
		body: `An argument about ${args.slug}. It has a title line.\n\nAnd a body.`,
		sideAtPostTime: "YES",
		createdAt: new Date("2026-08-01T00:00:00Z"),
	});
	const betId = uuidv7();
	await testDb.insert(bets).values({
		id: betId,
		userId: args.userId,
		marketId,
		side: "YES",
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: PRICE,
		commentId,
		createdAt: new Date("2026-08-01T00:00:00Z"),
	});
	await seedLotForBet(testDb, {
		betId,
		userId: args.userId,
		marketId,
		side: "YES",
		shares: args.shares,
		stake: args.stake,
	});
	if (args.exited === true) {
		// The lot is sold out and the position sits at zero — the shape RF-13
		// admits and the old `quantity > 0` predicate dropped. Routed through the
		// shipped pure core so the fixture reduces the lot by the same rule the
		// engine does.
		await seedLotSaleForBetId(testDb, {
			betId,
			sharesToSell: args.shares,
		});
	}
	await testDb.insert(positions).values({
		userId: args.userId,
		marketId,
		side: "YES",
		quantity: args.exited === true ? dp18("0") : args.shares,
	});
	return marketId;
}

describe("profile page load — statement count is FLAT in markets held", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
	});

	it("counts a non-empty statement set (the harness is alive)", async () => {
		const userId = await seedUser("countalive");
		await seedHeldMarket({
			userId,
			slug: "count-alive-1",
			stake: dp18("50"),
			shares: dp18("80"),
		});
		const issued = await countProfileLoad("countalive");
		// The POSITIVE CONTROL for every negative claim below: if the debug hook
		// were mis-wired the count would be 0 and every equality below would hold
		// vacuously at 0 === 0.
		expect(issued.length).toBeGreaterThan(5);
	});

	it("issues the SAME number of statements at M=1 and M=8", async () => {
		const one = await seedUser("countone");
		await seedHeldMarket({
			userId: one,
			slug: "count-one-1",
			stake: dp18("50"),
			shares: dp18("80"),
		});
		const atOne = await countProfileLoad("countone");

		const eight = await seedUser("counteight");
		for (let i = 0; i < 8; i++) {
			await seedHeldMarket({
				userId: eight,
				slug: `count-eight-${i}`,
				stake: dp18("50"),
				shares: dp18("80"),
				// ⚠ TWO OF THE EIGHT ARE FULLY EXITED — the rows RF-13 admits and the
				// old domain dropped. They are what makes this an M=8 measurement of
				// the WIDENED predicate rather than of the one it replaced.
				exited: i >= 6,
			});
		}
		const atEight = await countProfileLoad("counteight");

		// ⛔ THE ASSERTION THAT MATTERS. A per-market read makes atEight ≈ atOne + 7
		// (or worse); a batched read makes them identical. The failure message
		// carries both counts because "expected 9 to be 16" is not a diagnosis.
		expect({ M1: atOne.length, M8: atEight.length }).toEqual({
			M1: atOne.length,
			M8: atOne.length,
		});
	});

	it("holds the pinned count — 8 markets, one statement set", async () => {
		const userId = await seedUser("countpin");
		for (let i = 0; i < 8; i++) {
			await seedHeldMarket({
				userId,
				slug: `count-pin-${i}`,
				stake: dp18("50"),
				shares: dp18("80"),
				exited: i >= 6,
			});
		}
		const issued = await countProfileLoad("countpin");
		// PINNED. This number is the POSREV-1 contract: RF-13's domain widening
		// lengthens the `IN (…)` lists and adds no statement. A change here is a
		// DECISION — read the plan's §6 before moving it.
		//
		// The failing message carries the statements themselves, because a bare
		// "expected 24 to be 21" names the symptom and hides which three reads
		// arrived — and the whole value of this pin is telling you WHICH.
		expect({ count: issued.length, statements: issued }).toEqual({
			count: PINNED_STATEMENTS,
			statements: issued,
		});
	});
});
