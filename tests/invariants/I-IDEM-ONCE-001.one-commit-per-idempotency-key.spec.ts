import { afterEach, describe, expect, it } from "vitest";
import { markets, users } from "@/db/schema";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// I-IDEM-ONCE-001 (MINTED by AUDIT-FIX-B3, plan OD-2 — the I-DAILY-ONCE-001 /
// I-GRANT-ONCE-001 invariant-class precedent): at most ONE committed money
// mutation per idempotency key. Two mechanisms:
//   (i)  ROUTE LAYER — the durable `bet_receipts` pre-check + the 23505 catch in
//        place()/sell() answer any replay with the ORIGINAL result (exercised
//        end-to-end by tests/server/bets/{place,sell}-replay-durable.test.ts).
//   (ii) STORAGE BACKSTOP — this spec: the UNIQUE index
//        `bet_receipts_idempotency_key_uq` ON bet_receipts (idempotency_key)
//        (migration 0022). Its 23505 aborts the whole SERIALIZABLE bet tx
//        (rollback = no double proceeds) — it fails LOUDLY rather than ever
//        double-committing (the ENGINE.12 R3 mirror: never catch 23505 to
//        "recover" silently; the route reads the receipt and replays instead).
//
// ⚠ THE TWO MECHANISMS ARE SCOPED DIFFERENTLY, AND SINCE S-7 (G2) DELIBERATELY
// SO. Mechanism (i) — the Redis cache key and the durable REPLAY READ — is
// scoped PER USER: the key is client-supplied, and a sell body carries no
// user-identifying field, so an unscoped read answers one participant out of
// another's slot (S-7 D-1; tests/integration/cross-user-idempotency.integration
// .test.ts). Mechanism (ii), asserted below, stays GLOBALLY unique across all
// users, all flows and all markets — S-7 fence 5.1 leaves both Postgres uniques
// untouched, and the per-user-composite alternative (Design A) is recorded in
// ADR-0044 as the testnet successor, not this stratum's change.
//
// That asymmetry is load-bearing rather than an oversight: it is exactly what
// makes the post-G2 cross-user outcome a clean 409 `error_idempotency_key_reused`
// at the route's 23505 catch. The second participant is no longer answered from
// the first one's cache (the read is scoped), so they reach the transaction — and
// the still-global unique below is what stops them committing under a key that is
// already spent. Narrow the index and that refusal disappears.
//
// Fixture-bypass posture (SPEC.2 §6.6, the I-GRANT-ONCE-001 mirror): raw
// `testClient.unsafe` INSERTs go straight past the application layer so the INDEX
// is the only enforcement under test. The `betReceipts` drizzle table lands in the
// same 0022 edit, so the spec bypasses it.
//
// COLLECTION-RED until 0022: `bet_receipts` does not exist yet, so the seed INSERT
// and truncateTables teardown fail — correct RED until the executor applies the
// migration + the unique index.

async function seedUserAndMarket(
	tag: string,
): Promise<{ userId: string; marketId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Idem-Once User",
			email: `${tag}@example.com`,
			pseudonym: `idem-once-${tag}`,
		})
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: `idem-once-market-${tag}`,
			title: "Idem-Once Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return { userId: user?.id ?? "", marketId: market?.id ?? "" };
}

function insertReceipt(
	userId: string,
	marketId: string,
	idempotencyKey: string,
	flow: "place" | "sell",
) {
	return testClient.unsafe(
		`INSERT INTO bet_receipts
		   (idempotency_key, body_fingerprint, user_id, market_id, flow, result)
		 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)`,
		[idempotencyKey, "fp-idem-once", userId, marketId, flow],
	);
}

describe("I-IDEM-ONCE-001: at most one commit per idempotency key", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["bet_receipts", "markets", "users"]);
	});

	it("one-commit-per-idempotency-key::backstop-rejects-duplicate-key", async () => {
		const { userId, marketId } = await seedUserAndMarket("dup");

		// First receipt — the genuine commit.
		await insertReceipt(userId, marketId, "shared-key", "place");

		// A second row under the SAME idempotency_key (a race loser / Redis-lost
		// retry that reached the tx) → the backstop index rejects with 23505. Even
		// a DIFFERENT flow collides: the index is on `idempotency_key` ALONE, so
		// nothing about the row — not the flow, not the market, and (see the next
		// test) not the user — narrows it.
		await expect(
			insertReceipt(userId, marketId, "shared-key", "sell"),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "bet_receipts_idempotency_key_uq",
		});
	});

	it("one-commit-per-idempotency-key::backstop-rejects-duplicate-key-across-users", async () => {
		// S-7 · the user axis, pinned so the header's scoping note above is
		// falsifiable rather than prose. The route-layer REPLAY READ is per-user
		// after G2; this storage backstop is NOT, and must not become so here —
		// narrowing it to (user_id, idempotency_key) is Design A, deferred to
		// testnet in ADR-0044. Two DIFFERENT users under one key still collide.
		const alice = await seedUserAndMarket("alice");
		const bob = await seedUserAndMarket("bob");

		await insertReceipt(
			alice.userId,
			alice.marketId,
			"cross-user-key",
			"place",
		);

		// Different user, different market, different flow — the key alone decides.
		await expect(
			insertReceipt(bob.userId, bob.marketId, "cross-user-key", "sell"),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "bet_receipts_idempotency_key_uq",
		});

		// Exactly one commit survives under the key, and it is the first one.
		const rows = await testClient.unsafe<Array<{ user_id: string }>>(
			`SELECT user_id FROM bet_receipts WHERE idempotency_key = $1`,
			["cross-user-key"],
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.user_id).toBe(alice.userId);
	});

	it("one-commit-per-idempotency-key::distinct-keys-are-unconstrained", async () => {
		// Negative space: the backstop must not be over-broad — distinct keys (even
		// same user + market) each commit their own receipt. (Vacuously green
		// pre-index; the load-bearing RED is the rejection test above.)
		const { userId, marketId } = await seedUserAndMarket("distinct");

		await insertReceipt(userId, marketId, "key-a", "place");
		await insertReceipt(userId, marketId, "key-b", "sell");

		const rows = await testClient.unsafe<Array<{ idempotency_key: string }>>(
			`SELECT idempotency_key FROM bet_receipts WHERE user_id = $1`,
			[userId],
		);
		expect(rows.length).toBe(2);
	});
});
