import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.5 §5.6 tests-first (plan §7) — the RED drivers for the debate-view
// marker read-loader `listMarketComments` (F-DEBATE-2 / F-DEBATE-3). The loader
// lists a market's comments oldest-first and attaches each comment's
//   marker = computeMarker(comment.side_at_post_time, <that author's current
//            held side ∈ {YES, NO, null}>)
// returning a FLAT, oldest-first list of DebateComment DTOs that NEVER carries
// any author's raw held side or quantity.
//
// RED target: `@/server/debate-view/list-comments` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the loader.
//
// `computeMarker`'s truth table is already unit-tested
// (tests/unit/positions/compute.test.ts) — these tests target the LOADER (the
// wiring: oldest-first read + single batched held-sides read + exposure
// boundary), not the primitive.
//
// Invariants depended-on (this task WRITES NOTHING — it cannot violate a write
// invariant; the plan §1 fills the table on a read-task basis):
//   - Tests 1 & 2 prove the INV-3 dependency: the loader READS the frozen
//     `comments.side_at_post_time` badge and NEVER moves it; the marker is a
//     SEPARATE live overlay derived from the author's CURRENT held side. Badge
//     and marker are distinct DTO fields.
//   - Test 3 proves the INV-4 / freeze-by-construction dependency: resolution's
//     write-path (settleMarket → resolution_events + payout_events) never
//     touches `positions`, so a recomputed marker is frozen forever post-close.
//
// DB-backed (local Postgres :54322; DATABASE_URL defaulted by
// tests/_setup/env.ts). TRUNCATE in afterEach. Money/share/side values cross as
// decimal STRINGS / "YES"|"NO" (CLAUDE.md §2).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { comments, markets, pools, positions, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
// The RED import: greenfield loader under test. Value import → collection fails
// until `src/server/debate-view/list-comments.ts` lands.
import {
	type DebateComment,
	listMarketComments,
} from "@/server/debate-view/list-comments";
import { settleMarket } from "@/server/resolution/settle";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED = "100.000000000000000000";
const REASON = "Criterion met: documented evidence attached.";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-debate-view-settle",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function betMetadata(userId: string) {
	return {
		request_id: "test-debate-view-fixture",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(emailTag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Debate User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// Daily Credit already paid today → place()'s accrual is a pure read.
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: "1000", entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Debate Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

async function setStatus(marketId: string, status: string): Promise<void> {
	await testClient.unsafe(`UPDATE markets SET status = $1 WHERE id = $2`, [
		status,
		marketId,
	]);
}

/** Shipped-path buy: runBetTransaction + place (the real W-1 spine). */
async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	body: string;
	stake: string;
}): Promise<{ betId: string; commentId: string }> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: args.body,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: betMetadata(args.userId),
			}),
	);
	return { betId: result.betId, commentId: result.commentId };
}

/** Shipped-path comment-free sell: runBetTransaction + sell (the F-BET-3 spine). */
async function sellPosition(args: {
	userId: string;
	marketId: string;
	shares: string;
}): Promise<void> {
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
		sell(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			shares: args.shares,
			sellEventId: uuidv7(),
			syntheticBetId: uuidv7(),
			metadata: betMetadata(args.userId),
		}),
	);
}

/**
 * A counting Proxy over `testDb` that increments `count.selects` on every
 * `.select` property access and otherwise delegates straight to the real
 * client. The loader calls `client.select(...)`; this lets the test assert the
 * loader issues EXACTLY 2 selects (one comments read + one batched held-sides
 * read), regardless of author count — the no-N+1 guard.
 */
function countingClient(count: { selects: number }): typeof testDb {
	return new Proxy(testDb, {
		get(target, prop, receiver) {
			if (prop === "select") {
				count.selects += 1;
			}
			const value = Reflect.get(target, prop, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}) as typeof testDb;
}

describe("DEBATE.5 F-DEBATE-2 / F-DEBATE-3 — debate-view marker read-loader", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("flipped-exited-from-current-position", async () => {
		// INV-3 (read-not-moved) + batch correctness + exposure boundary.
		//
		// DELIBERATE FIXTURE-BYPASS: comments are direct-seeded WITHOUT a paired
		// bet. The loader is a pure READ — it never inspects bets, and
		// `comments.bet_id` is nullable in v1. Bet ↔ comment atomicity (INV-1) is
		// owned/asserted by I-ATOMICITY-001 and is NOT re-litigated here.
		const marketId = await seedOpenMarketWithPool("flipped-exited-market");
		const authorA = await seedUser("flipexit-a"); // holds YES → none
		const authorB = await seedUser("flipexit-b"); // holds NO  → Flipped
		const authorC = await seedUser("flipexit-c"); // exited    → Exited

		// Three comments, all frozen YES, with controlled distinct createdAt so
		// oldest-first (A < B < C) is assertable.
		await testDb.insert(comments).values([
			{
				userId: authorA,
				marketId,
				body: "A argues YES",
				sideAtPostTime: "YES",
				parentCommentId: null,
				betId: null,
				createdAt: new Date("2026-09-15T00:00:01Z"),
			},
			{
				userId: authorB,
				marketId,
				body: "B argues YES",
				sideAtPostTime: "YES",
				parentCommentId: null,
				betId: null,
				createdAt: new Date("2026-09-15T00:00:02Z"),
			},
			{
				userId: authorC,
				marketId,
				body: "C argues YES",
				sideAtPostTime: "YES",
				parentCommentId: null,
				betId: null,
				createdAt: new Date("2026-09-15T00:00:03Z"),
			},
		]);

		// Current held positions: A still on YES (held === frozen → none); B
		// flipped to NO (held === opposite → Flipped); C exited (no quantity>0
		// row → Exited). Seed C with an explicit zero-quantity row to prove the
		// `quantity > 0` predicate excludes it (vs. simply having no row).
		await testDb.insert(positions).values([
			{
				userId: authorA,
				marketId,
				side: "YES",
				quantity: "150.000000000000000000",
			},
			{
				userId: authorB,
				marketId,
				side: "NO",
				quantity: "120.000000000000000000",
			},
			{
				userId: authorC,
				marketId,
				side: "YES",
				quantity: "0.000000000000000000",
			},
		]);

		const count = { selects: 0 };
		const result = await listMarketComments(countingClient(count), {
			marketId,
		});

		// (a) Three comments, OLDEST-FIRST, each with the correct marker.
		expect(result.length).toBe(3);
		expect(result.map((c) => c.body)).toEqual([
			"A argues YES",
			"B argues YES",
			"C argues YES",
		]);
		expect(result.map((c) => c.marker)).toEqual(["none", "Flipped", "Exited"]);
		// The frozen badge is unchanged for every author (INV-3 read-not-moved).
		for (const c of result) {
			expect(c.sideAtPostTime).toBe("YES");
		}

		// (b) Exposure-clean: the DTO carries NONE of the position-internal keys.
		const keys = Object.keys(result[0] as DebateComment);
		expect(keys).not.toContain("heldSide");
		expect(keys).not.toContain("quantity");
		expect(keys).not.toContain("side");
		// And carries exactly the DebateComment surface.
		expect(keys.sort()).toEqual(
			[
				"body",
				"createdAt",
				"id",
				"imageUploadsId",
				"marker",
				"parentCommentId",
				"sideAtPostTime",
				"userId",
			].sort(),
		);

		// (c) No N+1: exactly TWO selects total — one comments read, one batched
		// held-sides read — regardless of the 3 authors.
		expect(count.selects).toBe(2);
	});

	it("same-side-renders-no-marker", async () => {
		// INV-3 (frozen badge ≠ live marker). DELIBERATE FIXTURE-BYPASS as above.
		//
		// An author still holding the comment's side — model an F-BET-2 same-side
		// add-on by seeding a single positions row on the SAME side with a LARGER
		// quantity. Frozen badge stays "YES"; live marker is "none".
		const marketId = await seedOpenMarketWithPool("same-side-market");
		const author = await seedUser("sameside-a");

		await testDb.insert(comments).values({
			userId: author,
			marketId,
			body: "still on YES",
			sideAtPostTime: "YES",
			parentCommentId: null,
			betId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		// Same side, larger quantity (the F-BET-2 add-on shape).
		await testDb.insert(positions).values({
			userId: author,
			marketId,
			side: "YES",
			quantity: "275.000000000000000000",
		});

		const result = await listMarketComments(testDb, { marketId });

		expect(result.length).toBe(1);
		// The frozen badge and the live marker are DISTINCT fields: the badge is
		// the unchanged "YES", the marker is "none".
		expect(result[0]?.sideAtPostTime).toBe("YES");
		expect(result[0]?.marker).toBe("none");
	});

	it("frozen-at-resolution", async () => {
		// INV-4 / freeze-by-construction (Q1 RESOLVED — REAL spine + REAL
		// resolution, NO fallback). Build a CONSISTENT market via the real bet
		// spine, make an author non-trivial (Exited via a real sell-to-zero), then
		// drive the REAL resolution write-path and assert positions are
		// byte-identical pre/post AND the marker is unchanged.
		const marketId = await seedOpenMarketWithPool("frozen-resolve-market");
		const authorA = await seedUser("frozen-a");
		const authorB = await seedUser("frozen-b");

		// A real-place YES (A's comment frozen YES + position YES + bet).
		await placeBet({
			userId: authorA,
			marketId,
			side: "YES",
			body: "A argues YES",
			stake: "100",
		});
		// B real-place NO (keeps the market two-sided / consistent).
		await placeBet({
			userId: authorB,
			marketId,
			side: "NO",
			body: "B argues NO",
			stake: "50",
		});

		// A real-sells the full YES position to zero → A is EXITED (a non-trivial
		// marker; A's frozen "YES" badge is preserved by INV-3).
		const heldA = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.userId, authorA));
		const heldQtyA = heldA[0]?.quantity ?? "0";
		await sellPosition({ userId: authorA, marketId, shares: heldQtyA });

		// (i) Loader BEFORE resolution (market still Open): A Exited, B none.
		const beforeResolve = await listMarketComments(testDb, { marketId });
		const markerByUser = new Map(
			beforeResolve.map((c) => [c.userId, c.marker]),
		);
		expect(markerByUser.get(authorA)).toBe("Exited");
		expect(markerByUser.get(authorB)).toBe("none");

		// (ii) Snapshot ALL positions rows pre-settle.
		const positionsBefore = await testDb
			.select({
				id: positions.id,
				userId: positions.userId,
				side: positions.side,
				quantity: positions.quantity,
			})
			.from(positions)
			.where(eq(positions.marketId, marketId));

		// (iii) Drive the REAL resolution write-path. Market must be Resolving
		// before settle (settleMarket requires Resolving).
		await setStatus(marketId, "Resolving");
		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// (iv) Re-snapshot → byte-identical (resolution touched no position).
		const positionsAfter = await testDb
			.select({
				id: positions.id,
				userId: positions.userId,
				side: positions.side,
				quantity: positions.quantity,
			})
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionsAfter).toEqual(positionsBefore);

		// (v) Loader AGAIN (market now Resolved): A STILL Exited, B STILL none —
		// the marker is frozen by construction.
		const afterResolve = await listMarketComments(testDb, { marketId });
		const markerByUserAfter = new Map(
			afterResolve.map((c) => [c.userId, c.marker]),
		);
		expect(markerByUserAfter.get(authorA)).toBe("Exited");
		expect(markerByUserAfter.get(authorB)).toBe("none");
	});
});
