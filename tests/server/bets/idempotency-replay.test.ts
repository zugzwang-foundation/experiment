import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 handler concurrency test #1 — `idempotency-replay-skips-moderation-
// and-txn` (plan §"Test plan" + §"The handler stack" steps 3→5/7 short-circuit;
// ADR-0015 §11). Two IDENTICAL requests (same Idempotency-Key header + same
// body):
//   - First  → idem MISS → runs moderation + the bet transaction → 200 + writes,
//     then release(completedResponse) promotes the sentinel to the cached body.
//   - Second → idem HIT → returns the CACHED completed response VERBATIM,
//     WITHOUT re-running moderation or the transaction (the §3.1 step-3 lookup
//     short-circuits before step 6/7).
// Assert: precommitModerate AND runBetTransaction are each invoked EXACTLY ONCE
// across BOTH requests; the second response status + body equal the cached one.
//
// CI-RED (route-backed): the greenfield VALUE import of the place Route Handler
// (`@/app/api/bets/place/route`) keeps this unresolvable until ENGINE.8 lands.
// We mock the idempotency cache + moderation + transaction wrapper at the module
// boundary (the runBetTransaction call-count is the load-bearing assertion, so
// it IS mocked here — distinct from the DB-backed flow tests). The route's
// auth+ban step reads the `users` table, so this runs against CI Postgres: the
// unseeded USER_ID returns no row → not banned → the call-count assertions hold.
// Locally it is CI-RED (collection-fails first on the missing route import),
// GREEN on CI once the route lands. The idem cache is a stateful single-key mock mirroring
// the SPEC.2 §11 single-key-encoding-both-states machine.
//
// Mocks (module boundary):
//   - `@sentry/nextjs`                        (wrapper breadcrumbs)
//   - `@/server/auth`                         (getSession → seeded participant)
//   - `@/server/middleware/origin-allowlist`  (checkOrigin → true)
//   - `@/server/middleware/rate-limit`        (checkRateLimit → allowed)
//   - `@/server/idempotency/cache`            (STATEFUL miss-then-hit machine)
//   - `@/server/moderation/precommit`         (precommitModerate → pass; COUNTED)
//   - `@/server/bets/transaction`             (runBetTransaction → stub; COUNTED)

const {
	mockGetSession,
	mockPrecommit,
	mockRunBetTransaction,
	idemStore,
	mockLookupOrReserve,
} = vi.hoisted(() => {
	const store = new Map<
		string,
		{ status: number; body: unknown; bodyFingerprint: string }
	>();
	return {
		mockGetSession: vi.fn(),
		mockPrecommit: vi.fn(),
		mockRunBetTransaction: vi.fn(),
		idemStore: store,
		// Single-key-encoding-both-states machine (SPEC.2 §11): first call for a
		// key → miss (caller MUST call release(response) to populate the store);
		// subsequent calls with the same fingerprint → hit (replay).
		mockLookupOrReserve: vi.fn(async (key: string, fingerprint: string) => {
			const existing = store.get(key);
			if (existing && existing.bodyFingerprint === fingerprint) {
				return { kind: "hit", cachedResponse: existing };
			}
			return {
				kind: "miss",
				release: async (
					response: {
						status: number;
						body: unknown;
						bodyFingerprint: string;
					} | null,
				) => {
					if (response === null) {
						store.delete(key);
						return;
					}
					store.set(key, response);
				},
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
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: mockLookupOrReserve,
}));

vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

vi.mock("@/server/bets/transaction", () => ({
	runBetTransaction: mockRunBetTransaction,
}));

import { eq } from "drizzle-orm";

import { POST as placePOST } from "@/app/api/bets/place/route";
import { dharmaLedger, users } from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const USER_ID = "0190b3a0-2222-7000-8000-000000000002";
const MARKET_ID = "0190b3a0-3333-7000-8000-000000000003";

function placeRequest(idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.9",
		},
		body: JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "10",
			body: "replay-test argument",
		}),
	});
}

describe("ENGINE.8 handler — idempotency replay", () => {
	beforeEach(() => {
		idemStore.clear();
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
		// The wrapper stub returns the place result the route serializes into its
		// 200 body. Shape mirrors plan §"happy-path-entry": { betId, commentId,
		// side, sharesBought, newPrice }.
		mockRunBetTransaction.mockResolvedValue({
			betId: "0190b3a0-4444-7000-8000-000000000004",
			commentId: "0190b3a0-5555-7000-8000-000000000005",
			side: "YES",
			sharesBought: "9.090909090909090909",
			newPrice: "0.523809523809523810",
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("bet-place::replay-returns-cached-without-rerunning-moderation-or-txn", async () => {
		// First request: idem MISS → moderation + tx run → 200 + writes cached.
		const first = await placePOST(placeRequest("replay-key-1"));
		expect(first.status).toBe(200);
		const firstBody = await first.clone().json();

		// Exactly one moderation + one transaction on the first (miss) pass.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);
		expect(mockRunBetTransaction).toHaveBeenCalledTimes(1);

		// Second request: IDENTICAL key + body → idem HIT → replay the cached
		// response WITHOUT re-running moderation or the transaction.
		const second = await placePOST(placeRequest("replay-key-1"));
		expect(second.status).toBe(200);
		const secondBody = await second.clone().json();

		// THE load-bearing assertion: NEITHER moderation NOR the transaction ran a
		// second time (the step-3 lookup short-circuited before step 6/7). Counts
		// stay at 1 across BOTH requests.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);
		expect(mockRunBetTransaction).toHaveBeenCalledTimes(1);

		// The replayed response equals the cached completed response (same status +
		// same body), per ADR-0015 §11 verbatim replay.
		expect(second.status).toBe(first.status);
		expect(secondBody).toEqual(firstBody);
	});

	// ENGINE.12 T7 — the replay arm can never double-pay the Daily Credit: the
	// step-3 idem HIT short-circuits BEFORE the handler tail where the accrual
	// seam lives (P1: `creditEventId` is minted at handler entry on the MISS
	// arm only; a replay never re-enters the handler). With the tx wrapper
	// mocked, the load-bearing proof is the call count; the DB snapshots pin
	// that the REPLAY itself changed nothing (ledger row count + cursor).
	describe("ENGINE.12 — replay never re-pays the Daily Credit", () => {
		afterEach(async () => {
			await truncateTables(testClient, ["dharma_ledger", "users"]);
		});

		it("bet-place::replay-leaves-ledger-and-cursor-untouched [T7]", async () => {
			// Seed a REAL user so the gate-1 read + the DB snapshots are genuine.
			const [seeded] = await testDb
				.insert(users)
				.values({
					name: "Replay-Credit User",
					email: "replay-credit@example.com",
					pseudonym: "replay-credit",
					tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
				})
				.returning({ id: users.id });
			const userId = seeded?.id ?? "";
			mockGetSession.mockResolvedValue({ user: { id: userId } });

			const readSnapshot = async () => {
				const ledgerRows = await testDb
					.select({ id: dharmaLedger.id })
					.from(dharmaLedger)
					.where(eq(dharmaLedger.userId, userId));
				const userRows = await testDb
					.select({ lastAllowanceAccruedAt: users.lastAllowanceAccruedAt })
					.from(users)
					.where(eq(users.id, userId));
				return {
					ledgerCount: ledgerRows.length,
					cursor: userRows[0]?.lastAllowanceAccruedAt ?? null,
				};
			};

			// First request: idem MISS → the handler tail runs (tx mocked here).
			const first = await placePOST(placeRequest("replay-credit-key"));
			expect(first.status).toBe(200);
			const firstBody = await first.clone().json();
			expect(mockRunBetTransaction).toHaveBeenCalledTimes(1);
			const afterFirst = await readSnapshot();

			// Second, IDENTICAL request: idem HIT → cached response verbatim,
			// handler tail (and thus the accrual seam) NEVER re-runs.
			const second = await placePOST(placeRequest("replay-credit-key"));
			expect(second.status).toBe(200);
			expect(await second.clone().json()).toEqual(firstBody);
			expect(mockRunBetTransaction).toHaveBeenCalledTimes(1);

			// The replay changed NOTHING: ledger row count and the accrual
			// cursor are identical to the post-first-request snapshot.
			const afterReplay = await readSnapshot();
			expect(afterReplay.ledgerCount).toBe(afterFirst.ledgerCount);
			expect(afterReplay.cursor?.getTime() ?? null).toBe(
				afterFirst.cursor?.getTime() ?? null,
			);
		});
	});
});
