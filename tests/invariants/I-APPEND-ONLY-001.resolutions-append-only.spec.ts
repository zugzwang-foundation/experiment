import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

import {
	bets,
	comments,
	markets,
	payoutEvents,
	resolutionEvents,
	users,
} from "@/db/schema";
import { createdAtFromUuidV7, testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// INV-4 canonical: storage-layer foundation for "Resolutions append-only".
//
// Per SPEC.2 §14.1 + §14.2's two-test-layer split, this file is the canonical
// INTEGRATION-LAYER test for INV-4. The TRIGGER-LAYER tests at
// tests/db/triggers/resolution-events-append-only.spec.ts +
// payout-events-append-only.spec.ts cover the same trigger at unit granularity.
//
// §14.1 names four INV-4 mechanisms:
//   (i)   W-3 SERIALIZABLE wrapper at src/server/resolution/settle.ts
//         — REQUIRES ENGINE.9; NOT IN 3-D SCOPE.
//   (ii)  Bucket-A append-only on resolution_events + payout_events
//         — VERIFIED in cases 1 + 2 below (and at unit-layer).
//   (iii) markets.status whitelisted Bucket-C transition during W-3
//         — REQUIRES ENGINE.9; NOT IN 3-D SCOPE.
//   (iv)  Admin-side auth construction parallel to §8.3
//         — REQUIRES SCAFFOLD.3 admin auth; NOT IN 3-D SCOPE.
//
// Case 3 adds §7.3 storage-idempotency primitive coverage (composite-PK
// ON CONFLICT replay safety) which backs mechanism (ii)'s exactly-once
// semantics in the event log.
//
// Per the @test-writer plan §4.14 implementation note: case 3 uses raw
// testClient.unsafe() with ON CONFLICT (event_id, created_at) DO NOTHING
// because the Drizzle schema declares event_id as a single-column PK
// (composite alignment is PRECURSOR.5 backlog). Event ID is generated via
// the npm `uuid` package's v7() so createdAtFromUuidV7 can extract the
// deterministic timestamp prefix.

describe("INV-4: resolutions append-only (storage-layer foundation)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"bets",
			"comments",
			"markets",
			"users",
		]);
	});

	it("INV-4 mechanism (ii): resolution_events UPDATE rejected at storage layer", async () => {
		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "inv4-market-1",
				title: "INV-4 Market 1",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [event] = await testDb
			.insert(resolutionEvents)
			.values({
				marketId: market?.id ?? "",
				eventKind: "resolve",
				outcome: "YES",
				reason: "initial",
			})
			.returning({ id: resolutionEvents.id });

		await expect(
			testClient.unsafe(
				`UPDATE resolution_events SET reason = 'changed' WHERE id = $1`,
				[event?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("INV-4 mechanism (ii): payout_events UPDATE rejected at storage layer", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "INV-4 User",
				email: "inv4-2@example.com",
				pseudonym: "inv4-user-2",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "inv4-market-2",
				title: "INV-4 Market 2",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "inv4",
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

	it("SPEC.2 §7.3 storage idempotency: ON CONFLICT (event_id, created_at) DO NOTHING is exactly-once on retry", async () => {
		// Generate event_id via the npm `uuid` package's v7 so the timestamp
		// prefix is real (crypto.randomUUID is v4 and would break
		// createdAtFromUuidV7).
		const eventId = uuidv7();
		const createdAt = createdAtFromUuidV7(eventId);
		const aggregateId = uuidv7();

		const insert1 = await testClient.unsafe(
			`INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, payload, payload_version, metadata, created_at)
			 VALUES ($1, 'test.replay', 'market', $2, '{}'::jsonb, 1, '{}'::jsonb, $3)
			 ON CONFLICT (event_id, created_at) DO NOTHING
			 RETURNING event_id`,
			[eventId, aggregateId, createdAt.toISOString()],
		);
		expect(insert1.count).toBe(1);

		// Replay with identical (event_id, created_at) — no-op via ON CONFLICT.
		const insert2 = await testClient.unsafe(
			`INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, payload, payload_version, metadata, created_at)
			 VALUES ($1, 'test.replay', 'market', $2, '{}'::jsonb, 1, '{}'::jsonb, $3)
			 ON CONFLICT (event_id, created_at) DO NOTHING
			 RETURNING event_id`,
			[eventId, aggregateId, createdAt.toISOString()],
		);
		expect(insert2.count).toBe(0);

		const counts = await testClient<{ count: bigint }[]>`
			SELECT count(*) AS count FROM events WHERE event_id = ${eventId}
		`;
		expect(Number(counts[0]?.count ?? 0)).toBe(1);
	});
});
