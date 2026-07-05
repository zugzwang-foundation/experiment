import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.16 §5.6 tests-first (charter rows (a) + (c)) — the §20.2 freeze gate on
// the participant bet endpoints. Both `/api/bets/place` and `/api/bets/sell`
// route through the SHARED `runBetEndpoint` §3.1 prefix (`src/server/bets/
// endpoint.ts`), so the gate is wired ONCE in that prefix and this file drives
// BOTH route handlers to prove the single gate covers both surfaces.
//
// MOCKED wire (mirrors `tests/server/bets/validation.test.ts`): `@/server/auth`
// (a valid participant session), origin-allowlist, rate-limit, idempotency, and
// moderation are all replaced — NO DB. The greenfield `@/server/system/is-frozen`
// is mocked via a FACTORY (`vi.mock(..., () => ({...}))`) so the module resolves
// to the mock rather than tripping a missing-file collection error; that keeps
// the RED on the ASSERTION (the endpoint does not yet call `isFrozen`, so the
// frozen arm returns a normal status + the spies WERE called → fail), never on
// collection.
//
// Spies asserted NOT-reached in the frozen arm (the gate is at handler-stack
// step 1.5, BEFORE idempotency lookup, BEFORE rate-limit, BEFORE the inner
// wrapper): idempotencyLookupOrReserve, checkRateLimit, runBetTransaction,
// precommitModerate.

const { mockGetSession, mockIsFrozen } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockIsFrozen: vi.fn(),
}));

const { mockIdempotencyLookup, mockCheckRateLimit } = vi.hoisted(() => ({
	mockIdempotencyLookup: vi.fn(),
	mockCheckRateLimit: vi.fn(),
}));

const { mockRunBetTransaction, mockPrecommit } = vi.hoisted(() => ({
	mockRunBetTransaction: vi.fn(),
	mockPrecommit: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
// Greenfield helper — FACTORY mock so the missing module resolves to the mock.
vi.mock("@/server/system/is-frozen", () => ({
	isFrozen: mockIsFrozen,
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: mockIdempotencyLookup,
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));
// The inner wrapper (step 7) — the bet write spine. A frozen request must never
// reach it; a not-frozen request DOES.
vi.mock("@/server/bets/transaction", () => ({
	runBetTransaction: mockRunBetTransaction,
}));
// `db` is only touched for the auth+ban user lookup (step 1); stub it so a
// frozen/not-frozen request both pass the ban gate without a DB.
vi.mock("@/db", () => ({
	db: {
		query: {
			users: {
				findFirst: vi.fn(async () => ({
					pseudonym: "freeze-user",
					tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
					bannedAt: null,
				})),
			},
		},
		// AUDIT-FIX-B3 A9 — the not-frozen pass-through arm reaches the durable
		// pre-check (db.select(bet_receipts)); a fresh key finds no receipt → [] → the
		// pre-check returns null and execution proceeds unchanged. The frozen arm
		// returns 410 BEFORE the miss arm, so it never touches this.
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => [] }) }),
		}),
	},
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.23",
		},
		body: JSON.stringify(body),
	});
}

async function errorBody(res: Response): Promise<{ code: string }> {
	const payload = await res.json();
	// §4.4 envelope: { ok:false, error:{ code, message, retry_after? } }.
	return payload.error ?? payload;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetSession.mockResolvedValue({ user: { id: "freeze-user-id" } });
	// Defaults for the not-frozen pass-through arm: idempotency miss, rate-limit
	// allowed, moderation pass, the inner wrapper succeeds.
	mockIdempotencyLookup.mockResolvedValue({
		kind: "miss",
		release: vi.fn(async () => {}),
	});
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		remaining: 99,
		reset: 0,
	});
	mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
	mockRunBetTransaction.mockResolvedValue({ betId: "bet-id-stub" });
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("ENGINE.16 (a) — frozen → bet endpoints return 410 (§20.2)", () => {
	beforeEach(() => {
		mockIsFrozen.mockResolvedValue(true);
	});

	it("bet-freeze::place-returns-410-experiment-concluded", async () => {
		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId: crypto.randomUUID(),
					side: "YES",
					stake: "10",
					body: "argument",
				},
				"freeze-place-key",
			),
		);

		expect(res.status).toBe(410);
		expect((await errorBody(res)).code).toBe("error_experiment_concluded");

		// The gate fires at step 1.5 — no idempotency reserved, no rate-limit
		// consumed, no moderation, no tx opened.
		expect(mockIdempotencyLookup).not.toHaveBeenCalled();
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
		expect(mockPrecommit).not.toHaveBeenCalled();
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});

	it("bet-freeze::sell-returns-410-experiment-concluded", async () => {
		const res = await sellPOST(
			req(
				"/api/bets/sell",
				{ marketId: crypto.randomUUID(), shares: "5" },
				"freeze-sell-key",
			),
		);

		expect(res.status).toBe(410);
		expect((await errorBody(res)).code).toBe("error_experiment_concluded");

		// Same shared-prefix gate covers sell — no work performed.
		expect(mockIdempotencyLookup).not.toHaveBeenCalled();
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});
});

describe("ENGINE.16 (c) — not-frozen → bet endpoints pass through (control)", () => {
	beforeEach(() => {
		mockIsFrozen.mockResolvedValue(false);
	});

	it("bet-freeze::place-passes-through-when-not-frozen", async () => {
		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId: crypto.randomUUID(),
					side: "YES",
					stake: "10",
					body: "argument",
				},
				"open-place-key",
			),
		);

		// Pass-through reaches the real prefix + inner wrapper → 200 (NOT 410).
		expect(res.status).toBe(200);
		expect(res.status).not.toBe(410);
		expect(mockIdempotencyLookup).toHaveBeenCalled();
		expect(mockCheckRateLimit).toHaveBeenCalled();
		expect(mockRunBetTransaction).toHaveBeenCalled();
	});

	it("bet-freeze::sell-passes-through-when-not-frozen", async () => {
		const res = await sellPOST(
			req(
				"/api/bets/sell",
				{ marketId: crypto.randomUUID(), shares: "5" },
				"open-sell-key",
			),
		);

		expect(res.status).toBe(200);
		expect(res.status).not.toBe(410);
		expect(mockIdempotencyLookup).toHaveBeenCalled();
		expect(mockRunBetTransaction).toHaveBeenCalled();
	});
});
