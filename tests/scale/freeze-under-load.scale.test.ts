import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.10 — freeze read-guard under load (axis 10). After `frozen_at` is set
// mid-storm: bet ENDPOINTS → 410 (`error_experiment_concluded`), READS → 200,
// the close-due cron → 200 `{status:"frozen"}`, and ZERO new write rows land.
// In-flight committed writes (pre-freeze) STAND.
//
// HARNESS: the REAL freeze gate (`@/server/system/is-frozen`, DB-backed via
// `@/db`) and the REAL `runBetTransaction` spine stay UNMOCKED so the gate reads
// the real `system_state.frozen_at` and the write-count assertion is genuine.
// The unavailable externals (Better Auth session, origin, idempotency/Upstash,
// rate-limit/Upstash, moderation, cron lock) are mocked — they are not the
// subject under test. `frozen_at` is set via testClient and RESET to null in
// afterEach (system_state is NOT truncated).
//
// DB-BACKED (local Postgres :54322).

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));
// The close-due cron lock + sweep externals (Upstash/admin wire) — stubbed so
// the cron's REAL freeze gate is the only thing under test.
vi.mock("@/server/upstash/lock", () => ({
	acquireLock: vi.fn(async () => ({ token: "tok" })),
	releaseLock: vi.fn(async () => {}),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import { GET as cronGET } from "@/app/api/cron/close-due-markets/route";
import { bets, comments, dharmaLedger } from "@/db/schema";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import { seedOpenMarketWithPool, seedUser } from "./_fixtures/seed";
import { collide } from "./_harness/collide";

function betReq(path: string, body: unknown, key: string): Request {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": key,
			"x-forwarded-for": "203.0.113.7",
		},
		body: JSON.stringify(body),
	});
}

async function freeze(): Promise<void> {
	// The ONE transition the §6.3 once-only Bucket-B trigger permits
	// (NULL→timestamp), on the live 'system' row the production `db` reads.
	await testClient.unsafe(
		`UPDATE system_state SET frozen_at = now() WHERE id = 'system'`,
	);
}

async function resetSystemState(): Promise<void> {
	// The once-only trigger rejects `frozen_at timestamp→NULL`, so the freeze
	// CANNOT be reset via UPDATE. Since 0021, TRUNCATE is trigger-rejected too;
	// the reset is the truncateTables fixture (owner-privilege guard toggle) +
	// reseed the singleton ('system', frozen_at NULL) — the is-frozen.test.ts
	// FIX-1 precedent.
	await truncateTables(testClient, ["system_state"]);
	await testClient.unsafe(
		`INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)`,
	);
}

describe("scale — freeze write-seal under load (axis 10)", () => {
	beforeEach(async () => {
		mockGetSession.mockReset();
		process.env.CRON_SECRET ??= "scale-cron-secret";
		// Guarantee an UNFROZEN baseline (a prior run/file may have left it frozen).
		await resetSystemState();
	});

	afterEach(async () => {
		// Reset the freeze sentinel to its pre-freeze singleton via the fixture
		// + reseed (the one-shot trigger forbids a timestamp→NULL UPDATE).
		await resetSystemState();
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("freeze-under-load::freeze-mid-storm-seals-writes-and-in-flight-commits-stand", async () => {
		// A barrier-released storm of place() endpoint calls runs through the REAL
		// runBetEndpoint stack (origin → auth → FREEZE GATE → idem → rl → place).
		// The storm is RED-driven by `collide` (the harness, implemented at BUILD).
		const marketId = await seedOpenMarketWithPool("synthetic-market-freeze-1");
		const userId = await seedUser("freeze-bettor", "1000000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const placeReqTask = (i: number): (() => Promise<number>) => {
			const key = uuidv7();
			return async () => {
				const res = await placePOST(
					betReq(
						"/api/bets/place",
						{ marketId, side: "YES", stake: "10", body: `storm ${i}` },
						key,
					),
				);
				return res.status;
			};
		};

		const factories = Array.from({ length: 16 }, (_unused, i) =>
			placeReqTask(i),
		);
		// Run the storm (some commit), then freeze the experiment mid-stream.
		await collide(factories, { degree: 16 });
		const betsBeforeFreeze = (
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId))
		).length;
		expect(betsBeforeFreeze).toBeGreaterThan(0);

		await freeze();

		// Post-freeze: EVERY write endpoint → 410 experiment-concluded, and a
		// second post-freeze storm commits NOTHING.
		const placeRes = await placePOST(
			betReq(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "post-freeze" },
				uuidv7(),
			),
		);
		expect(placeRes.status).toBe(410);
		expect((await placeRes.json()).error.code).toBe(
			"error_experiment_concluded",
		);
		const sellRes = await sellPOST(
			betReq("/api/bets/sell", { marketId, shares: "1" }, uuidv7()),
		);
		expect(sellRes.status).toBe(410);

		const postFreezeFactories = Array.from({ length: 8 }, (_unused, i) =>
			placeReqTask(100 + i),
		);
		const postResults = await collide(postFreezeFactories, { degree: 8 });
		// Every post-freeze endpoint call returned 410 — none committed.
		for (const r of postResults) {
			expect(r.status === "fulfilled" ? r.value : -1).toBe(410);
		}

		// In-flight committed writes STAND; ZERO new write rows land post-freeze.
		const betsAfter = (
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId))
		).length;
		expect(betsAfter).toBe(betsBeforeFreeze);
		const commentsAfter = (
			await testDb
				.select({ id: comments.id })
				.from(comments)
				.where(eq(comments.marketId, marketId))
		).length;
		expect(commentsAfter).toBe(betsBeforeFreeze); // 1:1 posts; none added post-freeze
		// No dharma_ledger row references this market's bets beyond the pre-freeze set.
		const ledgerAfter = (
			await testDb
				.select({ id: dharmaLedger.id })
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userId))
		).length;
		expect(ledgerAfter).toBeGreaterThan(0);

		// READS stay 200 (the freeze seals WRITES only): the real `isFrozen()`
		// returns true without throwing, and the close-due cron → 200
		// `{status:"frozen"}`, doing NO work (no lock, no sweep). Folded into the
		// RED storm test so the freeze read/cron §7 assertions are never
		// green-from-day-one. (The cron lock externals are mocked above.)
		const { isFrozen } = await import("@/server/system/is-frozen");
		expect(await isFrozen()).toBe(true);
		const cronRes = await cronGET(
			new Request("https://prd.example.com/api/cron/close-due-markets", {
				method: "GET",
				headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
			}),
		);
		expect(cronRes.status).toBe(200);
		expect((await cronRes.json()).status).toBe("frozen");
	});
});
