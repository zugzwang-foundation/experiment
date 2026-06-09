import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 handler concurrency test #2 — `moderation-outside-transaction`
// (plan §"Test plan"; ADR-0014 / CLAUDE.md §3 — never run external HTTP inside a
// db.transaction). Assert precommitModerate RESOLVES before the bet transaction
// is ENTERED: moderation is step 6, the wrapper is step 7, and moderation runs
// OUTSIDE the tx so a stuck moderation hop never holds the SERIALIZABLE pool
// lock. Mechanism: a call-order recorder — each mock pushes a label into a
// shared array; assert the moderation-resolved index precedes the tx-open index.
//
// CI-RED (route-backed): the greenfield VALUE import of the place Route Handler
// keeps this unresolvable until ENGINE.8 lands. The wrapper is mocked here (we
// assert ORDER relative to it, not its DB writes), so this file does NOT need
// Postgres — it REDs at collection on the missing route import and GREENs once
// the route lands.
//
// Mocks (module boundary):
//   - `@sentry/nextjs`, `@/server/auth`, `@/server/middleware/origin-allowlist`,
//     `@/server/middleware/rate-limit`, `@/server/idempotency/cache` (miss)
//   - `@/server/moderation/precommit`  (records "moderation-resolved")
//   - `@/server/bets/transaction`      (records "tx-open")

const { mockGetSession, mockPrecommit, mockRunBetTransaction, order } =
	vi.hoisted(() => {
		const order: string[] = [];
		return {
			order,
			mockGetSession: vi.fn(),
			// Records the moment moderation RESOLVES (after a microtask, to model
			// the async HTTP hop). The order is captured at resolution, not call.
			mockPrecommit: vi.fn(async () => {
				await Promise.resolve();
				order.push("moderation-resolved");
				return { outcome: "pass", categories: [] };
			}),
			// Records the moment the transaction is ENTERED (the callback is the
			// real spine; here the stub records that the wrapper opened).
			mockRunBetTransaction: vi.fn(async () => {
				order.push("tx-open");
				return {
					betId: "0190b3a0-6666-7000-8000-000000000006",
					commentId: "0190b3a0-7777-7000-8000-000000000007",
					side: "YES",
					sharesBought: "9.090909090909090909",
					newPrice: "0.523809523809523810",
				};
			}),
		};
	});

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
	precommitModerate: mockPrecommit,
}));

vi.mock("@/server/bets/transaction", () => ({
	runBetTransaction: mockRunBetTransaction,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";

const USER_ID = "0190b3a0-8888-7000-8000-000000000008";
const MARKET_ID = "0190b3a0-9999-7000-8000-000000000009";

function placeRequest() {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": "mod-order-key",
			"x-forwarded-for": "203.0.113.11",
		},
		body: JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "10",
			body: "moderation-order argument",
		}),
	});
}

describe("ENGINE.8 handler — moderation runs outside the transaction", () => {
	beforeEach(() => {
		order.length = 0;
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("bet-place::moderation-resolves-before-transaction-opens", async () => {
		// ADR-0014: precommitModerate (HTTP to OpenAI) MUST complete BEFORE the
		// SERIALIZABLE bet transaction opens — no external HTTP inside the tx.
		const res = await placePOST(placeRequest());
		expect(res.status).toBe(200);

		// Both ran exactly once.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);
		expect(mockRunBetTransaction).toHaveBeenCalledTimes(1);

		// THE load-bearing assertion: moderation RESOLVED before the tx OPENED.
		const moderationIdx = order.indexOf("moderation-resolved");
		const txOpenIdx = order.indexOf("tx-open");
		expect(moderationIdx).toBeGreaterThanOrEqual(0);
		expect(txOpenIdx).toBeGreaterThanOrEqual(0);
		expect(moderationIdx).toBeLessThan(txOpenIdx);
		expect(order).toEqual(["moderation-resolved", "tx-open"]);
	});
});
