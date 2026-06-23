import { afterEach, describe, expect, it } from "vitest";

import {
	bets,
	comments,
	markets,
	payoutEvents,
	resolutionEvents,
	users,
} from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — payout_events. Per SPEC.2 §6.2 + 0003 lines 52-53.
// Storage-layer mechanism (ii) of INV-4 at the per-table layer.
//
// FK chain: users → markets → comments → bets → resolution_events → payout_events.

describe("payout_events — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE payout_events, bets, comments, resolution_events, markets, users CASCADE`,
		);
	});

	it("rejects UPDATE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "po-test-1@example.com",
				pseudonym: "blue-fox-po-1",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-po-1",
				title: "Test Market po 1",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "test",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });

		const [bet] = await testDb
			.insert(bets)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				side: "YES",
				stake: "1",
				shareQuantity: "1",
				priceAtBet: "0.5",
				commentId: comment?.id ?? "",
			})
			.returning({ id: bets.id });

		const [resEvent] = await testDb
			.insert(resolutionEvents)
			.values({
				marketId: market?.id ?? "",
				eventKind: "resolve",
				outcome: "YES",
				reason: "initial",
			})
			.returning({ id: resolutionEvents.id });

		const [payout] = await testDb
			.insert(payoutEvents)
			.values({
				betId: bet?.id ?? "",
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				resolutionEventId: resEvent?.id ?? "",
				payoutType: "bet_payout",
				amount: "1",
			})
			.returning({ id: payoutEvents.id });

		await expect(
			testClient.unsafe(`UPDATE payout_events SET amount = 999 WHERE id = $1`, [
				payout?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "po-test-2@example.com",
				pseudonym: "blue-fox-po-2",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-po-2",
				title: "Test Market po 2",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "test",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });

		const [bet] = await testDb
			.insert(bets)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				side: "YES",
				stake: "1",
				shareQuantity: "1",
				priceAtBet: "0.5",
				commentId: comment?.id ?? "",
			})
			.returning({ id: bets.id });

		const [resEvent] = await testDb
			.insert(resolutionEvents)
			.values({
				marketId: market?.id ?? "",
				eventKind: "resolve",
				outcome: "YES",
				reason: "initial",
			})
			.returning({ id: resolutionEvents.id });

		const [payout] = await testDb
			.insert(payoutEvents)
			.values({
				betId: bet?.id ?? "",
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				resolutionEventId: resEvent?.id ?? "",
				payoutType: "bet_payout",
				amount: "1",
			})
			.returning({ id: payoutEvents.id });

		await expect(
			testClient.unsafe(`DELETE FROM payout_events WHERE id = $1`, [
				payout?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
