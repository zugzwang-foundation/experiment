import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
	resolutionEvents,
	users,
} from "@/db/schema";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { getHeaderPortfolio } from "@/server/dharma/header-portfolio";
import { loadProfilePositions } from "@/server/profile/positions";
import { loadProfileTiles } from "@/server/profile/tiles";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * T3 (HEADER-PORTFOLIO §7) — THE FI-2 LOCK. DB-BACKED (local Postgres :54322).
 *
 * SPEC.1 §23 (`:1592`): "Current **is** Đb; one holding never shows two
 * different current values." The header Portfolio figure and the §23
 * Positions-value tile are THE SAME QUANTITY (§23 `:1596`), so the only
 * acceptable relation between them is byte-identity — not "close", not "rounds
 * the same". Plan §4.3 states the contract:
 *
 *     Σ over open rows of loadProfilePositions(db, {userId}).current
 *       === getHeaderPortfolio(db, userId)
 *
 * The Σ here is taken with `CpmmDecimal` and closed with `toFixed18` — the same
 * arithmetic the module uses — so what is compared is the DERIVATION, not the
 * formatting. Plan §4.3: "If T3 cannot be made to pass, the read is wrong — do
 * not weaken the test."
 *
 * The identity is achieved by SAME-SOURCE derivation (R3), not by extraction:
 * `positions.ts` is read-only in this task, and the new module mirrors its
 * statements 1 · 2 · 4. This is the treatment `UI-A6.md:169` established for
 * `bookmarks/figures.ts`, which shipped and held.
 *
 * THE FIXTURE IS DELIBERATELY NON-TRIVIAL, because a fixture where every market
 * contributes zero would make the equality hold by accident and prove nothing.
 * One user across four markets: an open YES holding, an open NO holding (a
 * side-swapped implementation must fail), an open holding built from two buys
 * with a PARTIAL SELL between them (a Σ-of-stakes implementation must fail), and
 * a SETTLED market whose only payout leg is ZERO-amount — so R5's zero-amount
 * edge and the settled-exclusion edge are the SAME row. Pool reserves are
 * ASYMMETRIC and differ per market, so an implementation that pairs a holding
 * with the wrong pool produces a different number rather than an accidentally
 * equal one.
 */

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

const CANONICAL_ZERO = toFixed18(new CpmmDecimal(0));

function lc(side: "YES" | "NO"): "yes" | "no" {
	return side === "YES" ? "yes" : "no";
}

// ───────────────────────── fixture helpers (positions.test.ts shapes) ─────────

async function seedUser(pseudonym: string, emailTag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${emailTag}`,
		email: `${emailTag}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(
	slug: string,
	status: "Open" | "Closed" | "Resolving" | "Resolved" | "Voided" | "Frozen",
	resolved?: { outcome: "YES" | "NO" },
): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status,
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		resolvedAt: resolved ? new Date("2026-10-15T00:00:00Z") : null,
		resolutionOutcome: resolved?.outcome ?? null,
	});
	return id;
}

async function seedPool(
	marketId: string,
	yes: string,
	no: string,
): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: null,
		body: args.body,
		sideAtPostTime: args.side,
		createdAt: args.createdAt,
	});
	return id;
}

/** INV-1: every bet rides a comment, so each bet gets its own seeded comment. */
async function seedBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	commentId: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(bets).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testDb.insert(positions).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		quantity: args.quantity,
	});
}

/** A `bet.sold` event on the market aggregate (payload.userId filtered app-side). */
async function seedSell(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	sharesSold: string;
	proceeds: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(events).values({
		eventId: uuidv7(),
		eventType: "bet.sold",
		aggregateType: "market",
		aggregateId: args.marketId,
		payload: {
			betId: uuidv7(),
			marketId: args.marketId,
			userId: args.userId,
			side: args.side,
			sharesSold: args.sharesSold,
			proceeds: args.proceeds,
			price: "0.500000000000000000",
		},
		payloadVersion: 1,
		metadata: {},
		createdAt: args.createdAt,
	});
}

async function seedResolution(args: {
	marketId: string;
	kind: "resolve" | "correct" | "void";
	outcome: "YES" | "NO" | "VOID";
	reason: string;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(resolutionEvents).values({
		id,
		marketId: args.marketId,
		eventKind: args.kind,
		outcome: args.outcome,
		correctsEventId: null,
		reason: args.reason,
	});
	return id;
}

async function seedPayout(args: {
	betId: string;
	userId: string;
	marketId: string;
	resolutionEventId: string;
	payoutType: "bet_payout" | "void_refund";
	amount: string;
}): Promise<void> {
	await testDb.insert(payoutEvents).values({
		betId: args.betId,
		userId: args.userId,
		marketId: args.marketId,
		resolutionEventId: args.resolutionEventId,
		payoutType: args.payoutType,
		amount: args.amount,
	});
}

async function seedGrant(userId: string, amount: string): Promise<void> {
	await testDb.insert(dharmaLedger).values({
		userId,
		entryType: "initial_grant",
		amount,
		balanceAfter: amount,
	});
}

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

// ───────────────────────── the fixture ─────────────────────────

const POOL_A = { yes: dp18("120"), no: dp18("80") };
const POOL_B = { yes: dp18("90"), no: dp18("150") };
const POOL_C = { yes: dp18("200"), no: dp18("50") };
const POOL_D = { yes: dp18("70"), no: dp18("130") };

const HELD_A = { side: "YES" as const, quantity: dp18("30") };
const HELD_B = { side: "NO" as const, quantity: dp18("40") };
/** 25 bought − 10 sold + 30 bought = 45 net. */
const HELD_C = { side: "YES" as const, quantity: dp18("45") };
const HELD_D = { side: "YES" as const, quantity: dp18("20") };

type Fixture = {
	userId: string;
	marketIds: Record<"A" | "B" | "C" | "D", string>;
};

/**
 * One user, four markets. Every bet carries its own comment (INV-1), every
 * market carries a pool, and market D is settled with a single ZERO-amount
 * payout leg while its `positions` row survives at quantity > 0 — settlement
 * never zeroes a position (R5; `settle.ts` never touches `positions`).
 */
async function seedRichPortfolio(): Promise<Fixture> {
	const userId = await seedUser("fi2-lock-user", "fi2-lock");
	await seedGrant(userId, dp18("1000"));

	// ── Market A — Open, a straightforward YES holding.
	const mA = await seedMarket("m-fi2-a", "Open");
	await seedPool(mA, POOL_A.yes, POOL_A.no);
	const cA = await seedComment({
		userId,
		marketId: mA,
		body: "Market A opening argument for the YES side",
		side: "YES",
		createdAt: new Date("2026-09-20T10:00:00Z"),
	});
	await seedBet({
		userId,
		marketId: mA,
		side: "YES",
		stake: dp18("50"),
		shares: HELD_A.quantity,
		commentId: cA,
		createdAt: new Date("2026-09-20T10:00:00Z"),
	});
	await seedPosition({ userId, marketId: mA, ...HELD_A });

	// ── Market B — Open, a NO holding. The other side MUST be exercised: a
	// side-swapped `computeSell` reads the wrong reserve and fails here only.
	const mB = await seedMarket("m-fi2-b", "Open");
	await seedPool(mB, POOL_B.yes, POOL_B.no);
	const cB = await seedComment({
		userId,
		marketId: mB,
		body: "Market B opening argument for the NO side",
		side: "NO",
		createdAt: new Date("2026-09-20T11:00:00Z"),
	});
	await seedBet({
		userId,
		marketId: mB,
		side: "NO",
		stake: dp18("60"),
		shares: HELD_B.quantity,
		commentId: cB,
		createdAt: new Date("2026-09-20T11:00:00Z"),
	});
	await seedPosition({ userId, marketId: mB, ...HELD_B });

	// ── Market C — Open, TWO buys with a PARTIAL SELL between them. The live
	// quantity (45) is not the Σ of the buys (55) and not the Σ of the stakes
	// (95), so an implementation that reconstructs value from `bets` rather than
	// from `positions.quantity` diverges here.
	const mC = await seedMarket("m-fi2-c", "Open");
	await seedPool(mC, POOL_C.yes, POOL_C.no);
	const cC1 = await seedComment({
		userId,
		marketId: mC,
		body: "Market C first argument, later added to",
		side: "YES",
		createdAt: new Date("2026-09-21T09:00:00Z"),
	});
	await seedBet({
		userId,
		marketId: mC,
		side: "YES",
		stake: dp18("40"),
		shares: dp18("25"),
		commentId: cC1,
		createdAt: new Date("2026-09-21T09:00:00Z"),
	});
	await seedSell({
		userId,
		marketId: mC,
		side: "YES",
		sharesSold: dp18("10"),
		proceeds: dp18("5"),
		createdAt: new Date("2026-09-21T10:00:00Z"),
	});
	const cC2 = await seedComment({
		userId,
		marketId: mC,
		body: "Market C second argument, adding to the same side",
		side: "YES",
		createdAt: new Date("2026-09-21T11:00:00Z"),
	});
	await seedBet({
		userId,
		marketId: mC,
		side: "YES",
		stake: dp18("55"),
		shares: dp18("30"),
		commentId: cC2,
		createdAt: new Date("2026-09-21T11:00:00Z"),
	});
	await seedPosition({ userId, marketId: mC, ...HELD_C });

	// ── Market D — SETTLED, held to settlement. One resolution row, one payout
	// leg, amount ZERO. The position row survives at 20 shares.
	const mD = await seedMarket("m-fi2-d", "Resolved", { outcome: "YES" });
	await seedPool(mD, POOL_D.yes, POOL_D.no);
	const cD = await seedComment({
		userId,
		marketId: mD,
		body: "Market D opening argument, held to settlement",
		side: "YES",
		createdAt: new Date("2026-09-22T10:00:00Z"),
	});
	const betD = await seedBet({
		userId,
		marketId: mD,
		side: "YES",
		stake: dp18("30"),
		shares: HELD_D.quantity,
		commentId: cD,
		createdAt: new Date("2026-09-22T10:00:00Z"),
	});
	await seedPosition({ userId, marketId: mD, ...HELD_D });
	const resolutionId = await seedResolution({
		marketId: mD,
		kind: "resolve",
		outcome: "YES",
		reason: "Criterion met.",
	});
	await seedPayout({
		betId: betD,
		userId,
		marketId: mD,
		resolutionEventId: resolutionId,
		payoutType: "bet_payout",
		// R5's sharp edge: a ZERO-amount leg is a real settlement record
		// (`settle.ts:126–137`). Row EXISTENCE marks the market settled.
		amount: CANONICAL_ZERO,
	});

	return { userId, marketIds: { A: mA, B: mB, C: mC, D: mD } };
}

/** Đb for one holding, through the SHIPPED `computeSell` — the single R1 authority. */
function db(
	reserves: { yes: string; no: string },
	side: "YES" | "NO",
	shares: string,
): InstanceType<typeof CpmmDecimal> {
	return new CpmmDecimal(
		computeSell({ reserves, side: lc(side), shares }).proceeds,
	);
}

describe("T3 — the FI-2 lock (plan §4.3)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("equals-the-sum-of-open-loadProfilePositions-current-byte-for-byte", async () => {
		const { userId } = await seedRichPortfolio();

		const rows = await loadProfilePositions(testDb, { userId });
		// Fixture sanity: four held markets, exactly one of them settled. Without
		// this the equality below could hold over an empty or degenerate row set.
		expect(rows.length).toBe(4);
		expect(rows.filter((r) => r.settled).length).toBe(1);
		expect(rows.filter((r) => !r.settled).length).toBe(3);
		expect(rows.filter((r) => r.side === "NO").length).toBe(1);

		// THE CONTRACT. Σ with CpmmDecimal, closed with toFixed18 — the same
		// arithmetic the module uses, so this compares the DERIVATION.
		const expected = toFixed18(
			rows
				.filter((r) => !r.settled)
				.reduce((acc, r) => acc.plus(r.current), new CpmmDecimal(0)),
		);

		expect(await getHeaderPortfolio(testDb, userId)).toBe(expected);

		// The same number, spelled out from the fixture through the shipped
		// `computeSell` — so a bug that corrupted BOTH sides identically (e.g. a
		// shared helper drifting) still fails.
		const spelledOut = toFixed18(
			db(POOL_A, HELD_A.side, HELD_A.quantity)
				.plus(db(POOL_B, HELD_B.side, HELD_B.quantity))
				.plus(db(POOL_C, HELD_C.side, HELD_C.quantity)),
		);
		expect(expected).toBe(spelledOut);
		// Non-degenerate: the figure is a real, non-zero value.
		expect(expected).not.toBe(CANONICAL_ZERO);
	});

	it("excludes-the-settled-market-so-market-D-changes-the-answer", async () => {
		// Prove the settled-exclusion is load-bearing rather than a no-op on this
		// fixture. The naive implementation — ignore `payout_events`, `computeSell`
		// every held row — produces a strictly different string.
		//
		// Note this cannot be expressed as "Σ over ALL loadProfilePositions rows":
		// a SETTLED row's `current` is the net Σ payout (zero here by construction),
		// so that sum coincides with the open sum. The header module has no
		// settled branch at all, so the wrong-implementation shape to exclude is
		// `computeSell` against the resolved pool.
		const { userId } = await seedRichPortfolio();

		const openOnly = await getHeaderPortfolio(testDb, userId);
		const settledInclusive = toFixed18(
			new CpmmDecimal(openOnly ?? CANONICAL_ZERO).plus(
				db(POOL_D, HELD_D.side, HELD_D.quantity),
			),
		);

		expect(settledInclusive).not.toBe(openOnly);
		expect(openOnly).not.toBeNull();
	});

	it("matches-the-§23-positions-value-tile-byte-for-byte", async () => {
		// SPEC.1 §23 `:1596` — "Positions value — Σ Đb over open holdings" IS the
		// quantity Portfolio renders. `loadProfileTiles` already closes its Σ with
		// `toFixed18` (`tiles.ts:137`), so this is a free second identity pin on
		// exactly the same shape.
		const { userId } = await seedRichPortfolio();

		const rows = await loadProfilePositions(testDb, { userId });
		const tiles = await loadProfileTiles(testDb, { userId, positions: rows });

		expect(await getHeaderPortfolio(testDb, userId)).toBe(tiles.positionsValue);
	});

	it("returns-canonical-zero-when-every-held-market-is-settled", async () => {
		// R9 + R5 together: held positions exist, every one of them is settled, so
		// the open Σ is empty. That is a FACT (Đ 0), not an absence (`null`).
		const userId = await seedUser("fi2-all-settled", "fi2-all-settled");
		await seedGrant(userId, dp18("500"));

		const marketId = await seedMarket("m-fi2-all-settled", "Resolved", {
			outcome: "YES",
		});
		await seedPool(marketId, POOL_A.yes, POOL_A.no);
		const commentId = await seedComment({
			userId,
			marketId,
			body: "Held to settlement, nothing open remains",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		const betId = await seedBet({
			userId,
			marketId,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("30"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedPosition({
			userId,
			marketId,
			side: "YES",
			quantity: dp18("30"),
		});
		const resolutionId = await seedResolution({
			marketId,
			kind: "resolve",
			outcome: "YES",
			reason: "Criterion met.",
		});
		await seedPayout({
			betId,
			userId,
			marketId,
			resolutionEventId: resolutionId,
			payoutType: "bet_payout",
			amount: dp18("75"),
		});

		const rows = await loadProfilePositions(testDb, { userId });
		expect(rows.length).toBe(1);
		expect(rows[0]?.settled).toBe(true);

		expect(await getHeaderPortfolio(testDb, userId)).toBe(CANONICAL_ZERO);
	});

	it("returns-canonical-zero-not-null-for-a-user-with-no-positions-rows", async () => {
		// The empty path, against a real DB: one statement, zero rows, and a
		// renderable figure. `null` here would hide the whole cluster, which is
		// Balance's gate, not Portfolio's (R9).
		const userId = await seedUser("fi2-no-positions", "fi2-no-positions");
		await seedGrant(userId, dp18("500"));

		expect(await loadProfilePositions(testDb, { userId })).toEqual([]);
		expect(await getHeaderPortfolio(testDb, userId)).toBe(CANONICAL_ZERO);
	});
});
