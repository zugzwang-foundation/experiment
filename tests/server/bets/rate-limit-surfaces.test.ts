import { beforeEach, describe, expect, it, vi } from "vitest";

// ADR-0054 — the bet write cap is counted against the ACCOUNT (`betPerUser`),
// with the per-IP cap (`betPerIp`) demoted to a looser abuse backstop behind it.
// Both are consulted at handler-stack step 4, concurrently, and EITHER refusing
// must produce the same 429.
//
// ⛔ WHY THIS FILE EXISTS, because the surface-level tests in
// `tests/integration/rate-limit.integration.test.ts` look like they cover this
// and do not. They exercise `checkRateLimit` in ISOLATION — that each surface
// throttles, that the prefixes are disjoint. **Nothing asserted that the bet
// endpoint consults both, or that it acts on either answer.** That gap was
// found by a mutation pass, not by reading: replacing the endpoint's combined
// decision with `const rl = rlUser` — which deletes the entire per-IP backstop,
// leaving it computed and thrown away — left every test in the repository
// green. A guard that cannot fail on the defect it is written for is not a
// guard, so the cases below are shaped by the mutants they must kill:
//
//   `const rl = rlUser`          → killed by `ip-cap-alone-refuses`
//   `const rl = rlIp`            → killed by `user-cap-alone-refuses`
//   either `checkRateLimit` call deleted → killed by `consults-both-surfaces`
//   the two identifiers swapped  → killed by `consults-both-surfaces`
//
// Mock wire mirrors `tests/server/bets/freeze.test.ts`: auth, origin, rate
// limit, idempotency, moderation and the inner transaction are all replaced —
// no DB. `checkRateLimit` dispatches on its SURFACE argument so each arm can
// script the two answers independently, which a single blanket mock cannot do
// and which is precisely why the old coverage missed this.

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
vi.mock("@/server/system/is-frozen", () => ({ isFrozen: mockIsFrozen }));
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
vi.mock("@/server/bets/transaction", () => ({
	runBetTransaction: mockRunBetTransaction,
}));
vi.mock("@/db", () => ({
	db: {
		query: {
			users: {
				findFirst: vi.fn(async () => ({
					pseudonym: "rate-limit-user",
					tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
					bannedAt: null,
				})),
			},
		},
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => [] }) }),
		}),
	},
}));

import { POST as placePOST } from "@/app/api/bets/place/route";

const USER_ID = "rate-limit-user-id";
const CLIENT_IP = "203.0.113.77";

const ALLOWED = { allowed: true, remaining: 99, reset: 0 } as const;
const REFUSED = { allowed: false, retryAfter: 42 } as const;

/**
 * Script the two surfaces independently. Anything not named is ALLOWED, so a
 * test that forgets to script a surface fails open rather than silently
 * refusing for the wrong reason.
 */
function scriptLimits(answers: {
	betPerUser?: typeof ALLOWED | typeof REFUSED;
	betPerIp?: typeof ALLOWED | typeof REFUSED;
}) {
	mockCheckRateLimit.mockImplementation(async (surface: string) => {
		if (surface === "betPerUser") return answers.betPerUser ?? ALLOWED;
		if (surface === "betPerIp") return answers.betPerIp ?? ALLOWED;
		return ALLOWED;
	});
}

function req(idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": CLIENT_IP,
		},
		body: JSON.stringify({
			marketId: crypto.randomUUID(),
			side: "YES",
			stake: "10",
			body: "argument",
		}),
	});
}

async function errorBody(res: Response): Promise<{ code: string }> {
	const payload = await res.json();
	return payload.error ?? payload;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockIsFrozen.mockResolvedValue(false);
	mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
	mockIdempotencyLookup.mockResolvedValue({
		kind: "miss",
		release: vi.fn(async () => {}),
	});
	mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
	mockRunBetTransaction.mockResolvedValue({ betId: "bet-id-stub" });
	scriptLimits({});
});

describe("ADR-0054 — the bet endpoint consults both rate-limit surfaces", () => {
	it("bet-rate-limit::consults-both-surfaces", async () => {
		// Both surfaces must be asked, each with its OWN identifier. The account
		// is keyed on `users.id` and never the pseudonym; the backstop on the IP.
		await placePOST(req("both-surfaces-key"));

		expect(mockCheckRateLimit).toHaveBeenCalledWith("betPerUser", USER_ID);
		expect(mockCheckRateLimit).toHaveBeenCalledWith("betPerIp", CLIENT_IP);
		expect(mockCheckRateLimit).toHaveBeenCalledTimes(2);
	});

	it("bet-rate-limit::both-allowed-proceeds-to-the-transaction", async () => {
		// The control. Without it, every assertion below is satisfiable by an
		// endpoint that simply 429s everything.
		scriptLimits({ betPerUser: ALLOWED, betPerIp: ALLOWED });

		const res = await placePOST(req("both-allowed-key"));

		expect(res.status).not.toBe(429);
		expect(mockRunBetTransaction).toHaveBeenCalled();
	});

	it("bet-rate-limit::user-cap-alone-refuses", async () => {
		// The fairness cap fires while the backstop is happy — the common case,
		// one participant writing too fast from an otherwise quiet address.
		// ⛔ Kills the mutant `const rl = rlIp`.
		scriptLimits({ betPerUser: REFUSED, betPerIp: ALLOWED });

		const res = await placePOST(req("user-refused-key"));

		expect(res.status).toBe(429);
		expect((await errorBody(res)).code).toBe("error_rate_limit_exceeded");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});

	it("bet-rate-limit::ip-cap-alone-refuses", async () => {
		// The backstop fires while this account is within its own budget — a
		// machine working across accounts. ⛔ THIS IS THE ONE THAT WAS MISSING:
		// it kills `const rl = rlUser`, the mutant under which the entire per-IP
		// backstop is computed and discarded and every other test stays green.
		scriptLimits({ betPerUser: ALLOWED, betPerIp: REFUSED });

		const res = await placePOST(req("ip-refused-key"));

		expect(res.status).toBe(429);
		expect((await errorBody(res)).code).toBe("error_rate_limit_exceeded");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});

	it("bet-rate-limit::both-refused-still-one-envelope", async () => {
		// Indistinguishable on the wire by design: a 429 that said WHICH cap it
		// tripped would tell a caller which one to tune around.
		scriptLimits({ betPerUser: REFUSED, betPerIp: REFUSED });

		const res = await placePOST(req("both-refused-key"));

		expect(res.status).toBe(429);
		expect((await errorBody(res)).code).toBe("error_rate_limit_exceeded");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});
});
