import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// S-7 · G2 — the cross-user idempotency demonstration (plan §2 / §5, D-1 · D-2 ·
// D-4 · D-5 · S7-20). TESTS-FIRST: D-1, D-2 and the S7-20 key-shape assertion
// are RED against `origin/main` and GREEN once Design B lands; D-4 and D-5 are
// POSITIVE CONTROLS and are green on both sides of the change — without them
// G2 could "pass" by simply breaking legitimate same-user replay.
//
// The defect, stated once. `idempotencyLookupOrReserve` keys the Redis cache at
// `getRedisKey("idem", key)` (cache.ts:95) and `loadDurableReplay` matches on
// `idempotency_key` alone (replay.ts:83) — NEITHER carries the user. The
// Idempotency-Key is client-supplied and the wire body of a sell carries no
// user-identifying field, so two participants selling the same shares in the
// same market produce a BYTE-IDENTICAL canonical body. Whoever presents an
// already-used key second is answered out of the first one's slot: they receive
// another participant's trade result (a disclosure), and their own request never
// executes (a silent pre-emption of the key they hold). Design B scopes both
// reads by userId; the two Postgres uniques stay untouched (fence 5.1), which is
// why the post-G2 cross-user outcome is a 409 at the route's 23505 catch rather
// than a second commit.
//
// WHY THIS FILE LIVES IN `tests/integration/` AND NOT `tests/scale/` (the plan's
// one open question on placement): these are correctness tests of the key
// NAMESPACE, not a contention battery. `vitest.config.ts` EXCLUDES
// `tests/scale/**` from the default run, from `test:invariants` and from
// `test:integration` — a G2 regression parked there would be invisible to every
// gate that actually runs on a PR. D-2 imports the scale harness's `collide`
// driver directly, which the harness's own docblock sanctions (it is a plain
// barrier-synchronised task runner with no scale-config coupling); importing the
// DRIVER is not the same as living in the excluded TREE.
//
// Harness: the REAL `@/server/idempotency/cache` runs over a file-local
// in-memory Redis (the `idempotency-cache.integration.test.ts` /
// `composer-place.integration.test.ts` mock-the-wrapper precedent, made
// stateful) — mocking the cache module itself, as the `*-replay-durable` tests
// do, would erase the very key-construction under test. Sessions resolve from an
// `x-test-user` request header so two identities can be in flight
// SIMULTANEOUSLY, which a `mockResolvedValue` swap between calls cannot express.
// Route-backed against local Postgres; decimal STRINGS throughout.

const {
	mockGetSession,
	mockCheckRateLimit,
	mockPrecommit,
	mockCaptureException,
	redisStore,
	seenIdemKeys,
	mockRedis,
	replayControl,
	realLoadDurableReplayCalls,
} = vi.hoisted(() => {
	// A stateful in-memory stand-in for the Upstash REST client: SET NX, GET,
	// DEL, and the two ownership-checked release Lua scripts (compare-and-DEL /
	// compare-and-SET). TTLs are accepted and ignored — no test advances a clock;
	// expiry is simulated explicitly by clearing the store.
	const store = new Map<string, string>();
	const seen: string[] = [];
	const record = (key: string): void => {
		if (key.includes(":idem:")) seen.push(key);
	};
	return {
		mockGetSession: vi.fn(),
		mockCheckRateLimit: vi.fn(),
		mockPrecommit: vi.fn(),
		mockCaptureException: vi.fn(),
		redisStore: store,
		seenIdemKeys: seen,
		mockRedis: {
			set: vi.fn(
				async (
					key: string,
					value: string,
					opts?: { nx?: boolean; ex?: number },
				) => {
					record(key);
					if (opts?.nx === true && store.has(key)) return null;
					store.set(key, value);
					return "OK";
				},
			),
			get: vi.fn(async (key: string) => {
				record(key);
				return store.get(key) ?? null;
			}),
			del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
			eval: vi.fn(async (script: string, keys: string[], argv: string[]) => {
				const key = keys[0] ?? "";
				const owner = argv[0] ?? "";
				if (store.get(key) !== owner) return 0;
				if (script.includes("DEL")) {
					store.delete(key);
					return 1;
				}
				store.set(key, argv[1] ?? "");
				return "OK";
			}),
		},
		// D-4 arm 3: suppress exactly ONE `loadDurableReplay` call (the endpoint's
		// step-3.5 pre-check) so execution reaches the transaction and the route's
		// post-tx 23505 catch is the arm that answers. `forceNextUnavailable`
		// (ADR-0044 HIGH-1 regression guard): force exactly ONE call to return
		// `{ kind: "unavailable" }` instead of running for real — used to prove the
		// post-tx catch rethrows an outage rather than reporting a false
		// key-reused 409. Both are one-shot and consumed in call order, so setting
		// both before one request suppresses the pre-check (call 1) and forces the
		// post-tx catch's own call (call 2) to report unavailable.
		replayControl: { suppressNextPrecheck: false, forceNextUnavailable: false },
		// DC-a boundary regression guard: every argument tuple the REAL
		// loadDurableReplay was actually invoked with (never populated by the
		// suppress/force one-shot overrides above, which short-circuit before
		// reaching it) — lets a test assert "the durable layer was never
		// consulted" for a cached-200 `hit`, not just "the response was right".
		realLoadDurableReplayCalls: [] as unknown[],
	};
});

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: mockCaptureException,
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
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));
vi.mock("@/server/bets/replay", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/server/bets/replay")>();
	return {
		...actual,
		loadDurableReplay: (
			...args: Parameters<typeof actual.loadDurableReplay>
		): ReturnType<typeof actual.loadDurableReplay> => {
			if (replayControl.suppressNextPrecheck) {
				replayControl.suppressNextPrecheck = false;
				return Promise.resolve(null);
			}
			if (replayControl.forceNextUnavailable) {
				replayControl.forceNextUnavailable = false;
				return Promise.resolve({ kind: "unavailable" });
			}
			realLoadDurableReplayCalls.push(args);
			return actual.loadDurableReplay(...args);
		},
	};
});

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	betReceipts,
	bets,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import { collide } from "../scale/_harness/collide";

const SEED_RESERVES = "1000.000000000000000000";

// S7-20: a FIXED user id + a FIXED key so the expected Redis key can be written
// as a hardcoded literal rather than recomputed from the builder under test.
const LITERAL_USER_ID = "01920000-0000-7000-8000-0000000000a1";
const LITERAL_IDEM_KEY = "s7-literal-shape-key";

function betReq(path: string, body: unknown, key: string, userId: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": key,
			"x-forwarded-for": "203.0.113.77",
			// Read by the session mock — the only way two identities can be in
			// flight at once (D-2).
			"x-test-user": userId,
			"user-agent": "vitest-s7",
		},
		body: JSON.stringify(body),
	});
}

const sellReq = (body: unknown, key: string, userId: string) =>
	betReq("/api/bets/sell", body, key, userId);
const placeReq = (body: unknown, key: string, userId: string) =>
	betReq("/api/bets/place", body, key, userId);

async function seedUser(tag: string, id?: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			...(id === undefined ? {} : { id }),
			name: "S7 User",
			email: `s7-${tag}@example.com`,
			pseudonym: `s7-${tag}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// Suppress the lazy Daily Credit so the ledger is the grant alone.
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "5000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "S7 Cross-User Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

/** Give `userId` a YES position so a later sell has something to unwind. */
async function seedPositionViaPlace(
	userId: string,
	marketId: string,
	key: string,
): Promise<void> {
	const res = await placePOST(
		placeReq(
			{ marketId, side: "YES", stake: "50", body: `entry for ${key}` },
			key,
			userId,
		),
	);
	if (res.status !== 200) {
		throw new Error(
			`seedPositionViaPlace: expected 200, got ${res.status} — ${await res.text()}`,
		);
	}
}

function readReceipts(idempotencyKey: string) {
	return testDb
		.select({
			id: betReceipts.id,
			idempotencyKey: betReceipts.idempotencyKey,
			bodyFingerprint: betReceipts.bodyFingerprint,
			userId: betReceipts.userId,
			marketId: betReceipts.marketId,
			flow: betReceipts.flow,
			result: betReceipts.result,
			createdAt: betReceipts.createdAt,
		})
		.from(betReceipts)
		.where(eq(betReceipts.idempotencyKey, idempotencyKey));
}

async function readPosition(
	userId: string,
	marketId: string,
): Promise<string | null> {
	const rows = await testDb
		.select({ quantity: positions.quantity })
		.from(positions)
		.where(and(eq(positions.userId, userId), eq(positions.marketId, marketId)));
	return rows[0]?.quantity ?? null;
}

async function readPool(
	marketId: string,
): Promise<{ yesReserves: string; noReserves: string } | undefined> {
	const rows = await testDb
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId));
	return rows[0];
}

/**
 * The cached completed response held under `key`, found WITHOUT constructing the
 * Redis key — so the helper reads the same on both sides of G2 (`{env}:idem:{K}`
 * today, `{env}:idem:{U}:{K}` after). Only the S7-20 test asserts the shape.
 *
 * `forUserId`, when given, additionally requires the matched key to carry that
 * user's segment. Omit it only when at most one user's slot for `key` can exist
 * in the store at all (true pre-G2, and true post-G2 whenever a case involves a
 * single user). D-1/D-2 involve TWO users sharing one logical key, so "any entry
 * ending in `:{key}`" stops meaning "this user's entry" the moment G2 lands —
 * post-G2, A's own legitimate cached 200 also ends in `:{SHARED_KEY}`, and a
 * caller asking "is B's slot empty" must not be answered by finding A's.
 */
function cachedResponseFor(
	key: string,
	forUserId?: string,
): { status: number; body: unknown } | null {
	for (const [redisKey, value] of redisStore) {
		if (!redisKey.includes(":idem:") || !redisKey.endsWith(`:${key}`)) continue;
		if (forUserId !== undefined && !redisKey.includes(`:${forUserId}:`)) {
			continue;
		}
		if (value.startsWith("PENDING:")) continue;
		return JSON.parse(value) as { status: number; body: unknown };
	}
	return null;
}

interface WireBody {
	ok: boolean;
	data?: Record<string, string>;
	error?: { code: string; message: string; retry_after?: number };
}

describe("S-7 G2 — cross-user idempotency scoping", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		redisStore.clear();
		seenIdemKeys.length = 0;
		realLoadDurableReplayCalls.length = 0;
		replayControl.suppressNextPrecheck = false;
		replayControl.forceNextUnavailable = false;
		mockGetSession.mockImplementation(async (args: { headers: Headers }) => {
			const id = args.headers.get("x-test-user");
			return id === null ? null : { user: { id } };
		});
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 99,
			reset: 0,
		});
		mockPrecommit.mockResolvedValue({
			outcome: "pass",
			categories: [],
			categoryScores: {},
		});
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
			"bet_receipts",
		]);
	});

	// ── D-1 · sequential cross-user, matching fingerprint ────────────────────
	it("cross-user-idempotency::sequential-same-key-does-not-replay-another-users-result", async () => {
		const userA = await seedUser("d1-a");
		const userB = await seedUser("d1-b");
		const marketId = await seedOpenMarketWithPool("s7-d1-market");
		await seedPositionViaPlace(userA, marketId, "d1-a-entry");
		await seedPositionViaPlace(userB, marketId, "d1-b-entry");

		const SHARED_KEY = "d1-shared-key";
		// The honest worst case: the sell wire is `{marketId, shares}` — no comment
		// text, no user field. Two participants unwinding the same size in the same
		// market submit a byte-identical canonical body, so the fingerprint MATCHES
		// and the `mismatch` arm never fires. Nothing about this is contrived.
		const identicalBody = { marketId, shares: "5" };

		const first = await sellPOST(sellReq(identicalBody, SHARED_KEY, userA));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;
		expect(firstBody.ok).toBe(true);

		// Snapshot everything A owns, so "unchanged" is checked against rows and not
		// against a response.
		const receiptAfterA = await readReceipts(SHARED_KEY);
		expect(receiptAfterA).toHaveLength(1);
		expect(receiptAfterA[0]?.userId).toBe(userA);
		const positionAAfterSell = await readPosition(userA, marketId);
		const positionBBeforeAttempt = await readPosition(userB, marketId);
		const poolAfterA = await readPool(marketId);

		// ── BEFORE-CAPTURE (pre-G2, the behaviour this test exists to end) ──
		// The Redis slot is `{env}:idem:{SHARED_KEY}` with no user segment, and it
		// now holds A's completed 200 under A's fingerprint. B's fingerprint is
		// IDENTICAL, so `idempotencyLookupOrReserve` returns `kind: "hit"` and
		// `endpoint.ts`'s `case "hit"` returns A's payload verbatim — before the
		// durable receipt is ever consulted. Today B receives A's `sharesSold`,
		// `dharmaReturned` and `newPrice` as though they were B's own, and B's sell
		// silently does not happen.
		const second = await sellPOST(sellReq(identicalBody, SHARED_KEY, userB));
		const secondBody = (await second.json()) as WireBody;

		// This is the leak, asserted first so a RED run prints A's payload sitting
		// in B's response.
		expect(secondBody).not.toEqual(firstBody);

		// ── AFTER G2 ──
		// B's cache slot is disjoint (`{env}:idem:{B}:{K}` → miss) and the durable
		// pre-check is user-scoped (no receipt for (K, B) → null), so B executes and
		// the receipt insert trips the still-global `bet_receipts_idempotency_key_uq`
		// (fence 5.1 — the uniques are untouched). The route catch then finds no
		// receipt of B's OWN and returns the plan §2 step-3 outcome.
		expect(second.status).toBe(409);
		expect(secondBody.ok).toBe(false);
		expect(secondBody.error?.code).toBe("error_idempotency_key_reused");

		// …and NEVER caches it: caching a 409 under B's key would poison B's own
		// rightful use of that key for the next 24h. Scoped to B's OWN slot — A's
		// legitimate cached 200 also ends in `:${SHARED_KEY}` and must not be what
		// answers this check.
		expect(cachedResponseFor(SHARED_KEY, userB)).toBeNull();

		// A's committed row is untouched, bit for bit — checked on the ROW, not on
		// the response.
		expect(await readReceipts(SHARED_KEY)).toEqual(receiptAfterA);
		expect(await readPosition(userA, marketId)).toBe(positionAAfterSell);
		expect(await readPool(marketId)).toEqual(poolAfterA);
		// B's rolled-back attempt left no trace either.
		expect(await readPosition(userB, marketId)).toBe(positionBBeforeAttempt);
	});

	// ── D-2 · concurrent cross-user, same key ────────────────────────────────
	it("cross-user-idempotency::concurrent-same-key-namespaces-are-disjoint", async () => {
		const userA = await seedUser("d2-a");
		const userB = await seedUser("d2-b");
		const marketId = await seedOpenMarketWithPool("s7-d2-market");
		await seedPositionViaPlace(userA, marketId, "d2-a-entry");
		await seedPositionViaPlace(userB, marketId, "d2-b-entry");

		const SHARED_KEY = "d2-shared-key";
		const identicalBody = { marketId, shares: "5" };

		// ── BEFORE-CAPTURE (pre-G2) ──
		// TIMING-DEPENDENT, and both outcomes are wrong in different ways. The two
		// requests contend for ONE Redis slot: whoever loses the SET NX either (a)
		// sees the pending sentinel and gets 409 `error_idempotency_in_flight` —
		// told to retry a request that was never theirs to retry — or (b) arrives
		// after the winner promoted the slot and reads the winner's completed 200,
		// which is the D-1 disclosure at concurrent timing. Which one fires depends
		// on interleaving, so neither can be asserted alone; the assertions below
		// exclude BOTH, and are therefore red under either schedule.
		const results = await collide(
			[
				() => sellPOST(sellReq(identicalBody, SHARED_KEY, userA)),
				() => sellPOST(sellReq(identicalBody, SHARED_KEY, userB)),
			],
			{ degree: 2, label: "s7-cross-user-same-key" },
		);
		expect(results).toHaveLength(2);
		const settled = results.map((r) => {
			if (r.status !== "fulfilled") {
				throw new Error(`collide task rejected: ${String(r.reason)}`);
			}
			return r.value;
		});
		const bodies = (await Promise.all(
			settled.map((r) => r.json()),
		)) as WireBody[];

		// ── AFTER G2 ──
		// The slots are disjoint at segment 2, so the Redis collision class cannot
		// occur BETWEEN THESE TWO PARTICIPANTS at all. Each request is answered on
		// its OWN merits: its own 200, or the route-catch 409 once the still-global
		// receipt unique refuses the second commit. Nothing else is admissible here.
		//
		// ⚠ `error_idempotency_in_flight` is not being banned as an outcome — it
		// remains exactly right when ONE user double-submits one key concurrently,
		// which is the sentinel doing its job. What this test forbids is a SECOND
		// participant ever seeing it, because that answer is only reachable by
		// reading a slot that was never theirs.
		for (const [i, res] of settled.entries()) {
			expect([200, 409]).toContain(res.status);
			if (res.status === 409) {
				expect(bodies[i]?.error?.code).toBe("error_idempotency_key_reused");
			}
		}
		expect(settled.filter((r) => r.status === 200)).toHaveLength(1);
		// No participant is handed another participant's payload.
		expect(bodies[0]).not.toEqual(bodies[1]);

		// The namespace claim itself, stated on the keys that were actually touched:
		// both user-scoped slots exist, and the unqualified slot is never addressed.
		expect(seenIdemKeys).toContain(`prod:idem:${userA}:${SHARED_KEY}`);
		expect(seenIdemKeys).toContain(`prod:idem:${userB}:${SHARED_KEY}`);
		expect(seenIdemKeys).not.toContain(`prod:idem:${SHARED_KEY}`);

		// Exactly one commit under the key, and it belongs to whoever got the 200.
		const receipts = await readReceipts(SHARED_KEY);
		expect(receipts).toHaveLength(1);
		const winnerIdx = settled.findIndex((r) => r.status === 200);
		expect(receipts[0]?.userId).toBe(winnerIdx === 0 ? userA : userB);
	});

	// ── S7-20 · the key shape, asserted as a literal ─────────────────────────
	it("cross-user-idempotency::redis-key-is-env-idem-user-key", async () => {
		// The nine existing shape assertions in
		// `tests/integration/idempotency-cache.integration.test.ts` all compute the
		// expected value by CALLING `getRedisKey` — the builder under test — so a
		// join-order or segment-order regression agrees with itself and passes. This
		// one hardcodes the string. `ZUGZWANG_ENV` is pinned to the suite default.
		expect(process.env.ZUGZWANG_ENV).toBe("prod");
		await seedUser("d20", LITERAL_USER_ID);
		const marketId = await seedOpenMarketWithPool("s7-d20-market");

		// Any request that reaches step 3 builds the key; a 400 is the cheapest one
		// (the idempotency lookup precedes body validation and the transaction).
		const res = await sellPOST(
			sellReq({ marketId, shares: "5" }, LITERAL_IDEM_KEY, LITERAL_USER_ID),
		);
		expect(res.status).toBe(400);

		expect(seenIdemKeys).toContain(
			"prod:idem:01920000-0000-7000-8000-0000000000a1:s7-literal-shape-key",
		);
		// The superseded unqualified shape…
		expect(seenIdemKeys).not.toContain("prod:idem:s7-literal-shape-key");
		// …and the reversed join, which a computed-expectation assertion cannot see.
		expect(seenIdemKeys).not.toContain(
			"prod:idem:s7-literal-shape-key:01920000-0000-7000-8000-0000000000a1",
		);
	});

	// ── D-4 · positive control: same-user replay, forced on each of three arms ──
	//
	// Three arms answer a replay and they are reached under different conditions:
	// the Redis `hit` (endpoint.ts `case "hit"`), the durable pre-check
	// (endpoint.ts step 3.5), and the route's post-tx 23505 catch. G2 edits the
	// key of the first and the WHERE of the second, and adds a third outcome to
	// the third — so each is forced individually. None of these may change.

	it("cross-user-idempotency::same-user-replay-redis-hit-arm", async () => {
		const userId = await seedUser("d4a");
		const marketId = await seedOpenMarketWithPool("s7-d4a-market");
		await seedPositionViaPlace(userId, marketId, "d4a-entry");
		const KEY = "d4a-key";
		const body = { marketId, shares: "5" };

		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;

		// ARM FORCED: the completed payload is resident in the cache, so the lookup
		// short-circuits at `case "hit"` before the durable read and before the tx.
		const cached = cachedResponseFor(KEY);
		expect(cached?.status).toBe(200);
		const poolAfterFirst = await readPool(marketId);
		const positionAfterFirst = await readPosition(userId, marketId);

		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(firstBody);

		// Byte-for-byte AND side-effect-free: one commit, untouched money.
		expect(await readReceipts(KEY)).toHaveLength(1);
		expect(await readPool(marketId)).toEqual(poolAfterFirst);
		expect(await readPosition(userId, marketId)).toBe(positionAfterFirst);
	});

	it("cross-user-idempotency::same-user-replay-durable-precheck-arm", async () => {
		const userId = await seedUser("d4b");
		const marketId = await seedOpenMarketWithPool("s7-d4b-market");
		await seedPositionViaPlace(userId, marketId, "d4b-entry");
		const KEY = "d4b-key";
		const body = { marketId, shares: "5" };

		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;
		const poolAfterFirst = await readPool(marketId);
		const positionAfterFirst = await readPosition(userId, marketId);

		// ARM FORCED: clear the cache — the Redis-lost / TTL-expired window. With an
		// empty store the `hit` arm is unreachable, so only the durable receipt can
		// answer.
		redisStore.clear();
		expect(redisStore.size).toBe(0);

		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(firstBody);

		expect(await readReceipts(KEY)).toHaveLength(1);
		expect(await readPool(marketId)).toEqual(poolAfterFirst);
		expect(await readPosition(userId, marketId)).toBe(positionAfterFirst);
	});

	it("cross-user-idempotency::same-user-replay-post-tx-23505-arm", async () => {
		const userId = await seedUser("d4c");
		const marketId = await seedOpenMarketWithPool("s7-d4c-market");
		await seedPositionViaPlace(userId, marketId, "d4c-entry");
		const KEY = "d4c-key";
		const body = { marketId, shares: "5" };

		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;
		const poolAfterFirst = await readPool(marketId);
		const positionAfterFirst = await readPosition(userId, marketId);

		// ARM FORCED: cache cleared AND the step-3.5 pre-check suppressed for
		// exactly one call, so execution enters the transaction, the receipt insert
		// trips `bet_receipts_idempotency_key_uq`, the tx rolls back, and the route's
		// catch is the only thing left to answer. Suppression targets the pre-check
		// alone — the catch's own `loadDurableReplay` call runs for real.
		redisStore.clear();
		replayControl.suppressNextPrecheck = true;

		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(firstBody);
		expect(replayControl.suppressNextPrecheck).toBe(false); // it was consumed

		// The rolled-back attempt left nothing behind: no double proceeds.
		expect(await readReceipts(KEY)).toHaveLength(1);
		expect(await readPool(marketId)).toEqual(poolAfterFirst);
		expect(await readPosition(userId, marketId)).toBe(positionAfterFirst);
	});

	// ── D-5 · positive control: terminal errors still replay for their OWN user ──
	//
	// Rescoped per plan §2 to guard G2. Terminal 4xx and 429 are CACHED per
	// SPEC.2 §11; a user-scoping change that quietly stopped caching them, or
	// wrote them under a key nothing reads back, would let the G2 tests above
	// pass vacuously. Both cases are constructed so that a RE-EXECUTION would
	// visibly differ from a replay. (DC-a — the durable consult on a cached
	// non-2xx `hit`, below in this file — is a separate control on a different
	// property: that a stale cached rejection does not outrank an EARLIER,
	// different request's receipt. Reinstated at ADR-0044; see that ADR's DC
	// section, not "no longer exists" as an earlier draft of this comment said.)

	it("cross-user-idempotency::terminal-4xx-still-replays-for-same-user", async () => {
		const userId = await seedUser("d5a");
		const marketId = await seedOpenMarketWithPool("s7-d5a-market");
		const KEY = "d5a-key";
		const body = { marketId, shares: "5" };

		// No position yet → 400 `position_not_held`, cached under the key.
		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(400);
		const firstBody = (await first.json()) as WireBody;
		expect(firstBody.error?.code).toBe("position_not_held");
		expect(cachedResponseFor(KEY)?.status).toBe(400);

		// Change the world underneath the key: the user now HOLDS a position, so a
		// re-execution of the identical body would succeed with a 200. Only a real
		// cache replay can still answer 400.
		await seedPositionViaPlace(userId, marketId, "d5a-entry");
		const positionBefore = await readPosition(userId, marketId);

		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(400);
		expect(await second.json()).toEqual(firstBody);

		// Nothing executed: the position is intact and no receipt was written.
		expect(await readPosition(userId, marketId)).toBe(positionBefore);
		expect(await readReceipts(KEY)).toHaveLength(0);
	});

	it("cross-user-idempotency::cached-429-still-replays-for-same-user", async () => {
		const userId = await seedUser("d5b");
		const marketId = await seedOpenMarketWithPool("s7-d5b-market");
		await seedPositionViaPlace(userId, marketId, "d5b-entry");
		const KEY = "d5b-key";
		const body = { marketId, shares: "5" };

		// Throttle the first attempt only. 429 IS a first-class cache entry
		// (SPEC.2 §11 ¶"Cached error responses include 429s").
		mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 7 });
		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(429);
		const firstBody = (await first.json()) as WireBody;
		expect(firstBody.error?.code).toBe("error_rate_limit_exceeded");
		expect(firstBody.error?.retry_after).toBe(7);
		expect(cachedResponseFor(KEY)?.status).toBe(429);
		const rateLimitCallsAfterFirst = mockCheckRateLimit.mock.calls.length;

		// The limiter would now ALLOW — so a 429 on the replay can only have come
		// from the cache, never from a recomputation.
		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(429);
		expect(await second.json()).toEqual(firstBody);
		// The `hit` arm returns at step 3, so step 4 is never reached a second time.
		expect(mockCheckRateLimit.mock.calls.length).toBe(rateLimitCallsAfterFirst);
		expect(await readReceipts(KEY)).toHaveLength(0);
		// And the throttled request never opened a transaction.
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows).toHaveLength(1); // the seeding entry only
	});

	// ── ADR-0044 HIGH-1 regression guard ─────────────────────────────────────
	//
	// The 23505-catch arm's `replay === null` case must mean ONLY "this key
	// belongs to someone else" — never "the durable check itself failed to
	// run". Collapsing the two would report a transient DB hiccup as a false
	// "you may not replay this key" (409, refresh_then_edit on the client —
	// `src/components/debate/composer/idempotency.ts`), abandoning a key that
	// may belong to a bet that already committed, instead of the correct
	// uncached 500 (`error_internal`, classified TRANSIENT client-side —
	// `state-map.ts`) that holds the key for a legitimate retry.

	it("cross-user-idempotency::durable-precheck-outage-on-post-tx-catch-is-uncached-500-not-409", async () => {
		const userId = await seedUser("outage");
		const marketId = await seedOpenMarketWithPool("s7-outage-market");
		await seedPositionViaPlace(userId, marketId, "outage-entry");
		const KEY = "outage-key";
		const body = { marketId, shares: "5" };

		// A real committed sell under KEY, so a second attempt genuinely 23505s
		// on `bet_receipts_idempotency_key_uq` (the sell path's only durable
		// dedupe) rather than needing a contrived conflict.
		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);

		// Force the SAME sequence D-4 arm 3 uses to reach the post-tx catch
		// (clear the cache, suppress the pre-check) — but this time also force
		// the catch's OWN `loadDurableReplay` call to report `unavailable`
		// instead of running for real, simulating a transient failure at the
		// exact moment the durable check would otherwise have found A's own
		// receipt and replayed cleanly.
		redisStore.clear();
		replayControl.suppressNextPrecheck = true;
		replayControl.forceNextUnavailable = true;

		const second = await sellPOST(sellReq(body, KEY, userId));

		// NOT 409 — the defect this guard exists to catch.
		expect(second.status).toBe(500);
		const secondBody = (await second.json()) as WireBody;
		expect(secondBody.error?.code).toBe("error_internal");
		expect(replayControl.forceNextUnavailable).toBe(false); // consumed

		// Uncached: a retry must be free to try the durable check again once
		// the outage clears, not be handed a poisoned refusal for 24h.
		expect(cachedResponseFor(KEY, userId)).toBeNull();
		// No cross-user alarm — this was never a cross-user collision.
		expect(mockCaptureException).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "durable_idempotency_cross_user_collision",
				}),
			}),
		);
		// Untouched: the rollback left A's original commit exactly as it was.
		expect(await readReceipts(KEY)).toHaveLength(1);
	});

	// ── ADR-0044 HIGH-2 / MEDIUM-2 — the cross-user null case, on `place` ────
	//
	// D-1 exercises the sell path's only durable dedupe
	// (`bet_receipts_idempotency_key_uq`). `place` 23505s on a DIFFERENT,
	// EARLIER constraint (`bets_idempotency_key_idx`, replay.ts's own
	// docblock: "fires first in the place callback") — an untested branch
	// before this guard. Also proves the alarm HIGH-2 requires actually fires.

	it("cross-user-idempotency::place-cross-user-23505-alarms-and-refuses", async () => {
		const userA = await seedUser("placex-a");
		const userB = await seedUser("placex-b");
		const marketId = await seedOpenMarketWithPool("s7-placex-market");
		const SHARED_KEY = "placex-shared-key";
		const identicalBody = {
			marketId,
			side: "YES",
			stake: "50",
			body: "identical argument",
		};

		const first = await placePOST(placeReq(identicalBody, SHARED_KEY, userA));
		expect(first.status).toBe(200);

		// B's own Redis slot and durable pre-check are both genuinely empty (B
		// has never touched this key) — B proceeds into the transaction, where
		// the INSERT into `bets` collides with A's row on
		// `bets_idempotency_key_idx` before the receipt insert is ever reached.
		const second = await placePOST(placeReq(identicalBody, SHARED_KEY, userB));

		expect(second.status).toBe(409);
		const secondBody = (await second.json()) as WireBody;
		expect(secondBody.error?.code).toBe("error_idempotency_key_reused");
		expect(cachedResponseFor(SHARED_KEY, userB)).toBeNull();

		// The alarm HIGH-2 requires: this is the one condition ADR-0044 exists
		// to handle, and must never be silent.
		expect(mockCaptureException).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "durable_idempotency_cross_user_collision",
				}),
			}),
		);

		// A's commit is untouched; B's rolled-back attempt left nothing.
		expect(await readReceipts(SHARED_KEY)).toHaveLength(1);
		expect(
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId)),
		).toHaveLength(1);
	});

	// ── ADR-0044 DC-a reinstatement (security-audit MEDIUM) ──────────────────
	//
	// R-D proved no SINGLE request's own error paths can coexist with that same
	// request's commit. It did not cover the CROSS-request bridge: request 1
	// commits and writes a receipt; Redis later loses that entry; request 2
	// (same user, same key) gets a "miss", its OWN step-3.5 pre-check is blind
	// at that exact moment (`unavailable`, degrading to normal execution as
	// designed) and terminates in a genuinely-cached pre-tx rejection (here, a
	// 429) — leaving a cached non-2xx beside request 1's real receipt under the
	// same key. A THIRD request must not be answered the stale rejection
	// verbatim: `case "hit"` now consults the receipt before trusting a cached
	// non-2xx (the reinstated DC-a) and returns request 1's original result.

	it("cross-user-idempotency::case-hit-consults-receipt-before-trusting-a-stale-cached-rejection", async () => {
		const userId = await seedUser("dca");
		const marketId = await seedOpenMarketWithPool("s7-dca-market");
		await seedPositionViaPlace(userId, marketId, "dca-entry");
		const KEY = "dca-key";
		const body = { marketId, shares: "5" };

		// Request 1: a real committed sell. Receipt written; Redis holds the
		// completed 200 under (userId, KEY).
		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;
		const poolAfterFirst = await readPool(marketId);
		const positionAfterFirst = await readPosition(userId, marketId);

		// Simulate Redis losing that entry (eviction, not a full outage — a full
		// Upstash outage fails idempotencyLookupOrReserve CLOSED to 503 upstream
		// of this, per ADR-0015) AND the step-3.5 pre-check being blind on the
		// very next request — the two-failure alignment DC-a exists for.
		redisStore.clear();
		replayControl.forceNextUnavailable = true;
		mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 3 });

		// Request 2: miss (cache lost) -> pre-check blind (forced) -> falls
		// through to normal execution -> rate-limited. A genuinely-cached 429,
		// with request 1's receipt sitting unconsulted beside it under KEY.
		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(429);
		expect(replayControl.forceNextUnavailable).toBe(false); // consumed
		expect(cachedResponseFor(KEY, userId)?.status).toBe(429);

		// Request 3: an ordinary retry, no forcing. Pre-G2-plus-R-D reasoning
		// alone would answer this from `case "hit"` with the stale 429 verbatim,
		// for up to 24h, despite the ledger showing the sell already committed.
		const third = await sellPOST(sellReq(body, KEY, userId));
		expect(third.status).toBe(200);
		expect(await third.json()).toEqual(firstBody);

		// DC-a REPLAYS from the existing receipt — it does not execute anything.
		// Still exactly one commit, and money/position are exactly where request
		// 1 left them (not merely "a receipt exists somewhere", which a second
		// execution racing to a different outcome could also satisfy).
		expect(await readReceipts(KEY)).toHaveLength(1);
		expect(await readPool(marketId)).toEqual(poolAfterFirst);
		expect(await readPosition(userId, marketId)).toBe(positionAfterFirst);

		// ADR-0044 records DC-a as deliberately NOT repromoting the cache (no
		// ownership-checked write path exists off the `hit` arm — see the ADR's
		// Pros/Cons). Pinned here rather than only asserted in prose: the stale
		// 429 is still exactly what's cached after request 3 recovered around it.
		expect(cachedResponseFor(KEY, userId)?.status).toBe(429);
	});

	// ── DC-a boundary: a cached 200 never triggers the durable consult ───────
	//
	// Code-review LOW: `!== 200` (not `>= 300`, itself an earlier code-review
	// MEDIUM fix) is the gate on DC-a. A mutation widening it to also fire on a
	// cached 200 — an extra DB read on the single most common replay path —
	// would pass every other test in this file (D-4's redis-hit-arm test
	// doesn't count calls, and a receipt legitimately exists there too). This
	// pins the negative directly: zero real `loadDurableReplay` invocations
	// while replaying a cached 200.

	it("cross-user-idempotency::case-hit-does-not-consult-the-receipt-for-a-cached-200", async () => {
		const userId = await seedUser("dcaboundary");
		const marketId = await seedOpenMarketWithPool("s7-dcaboundary-market");
		await seedPositionViaPlace(userId, marketId, "dcaboundary-entry");
		const KEY = "dcaboundary-key";
		const body = { marketId, shares: "5" };

		const first = await sellPOST(sellReq(body, KEY, userId));
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as WireBody;
		expect(cachedResponseFor(KEY, userId)?.status).toBe(200);

		realLoadDurableReplayCalls.length = 0;
		const second = await sellPOST(sellReq(body, KEY, userId));
		expect(second.status).toBe(200);
		expect(await second.json()).toEqual(firstBody);

		// The real function was never reached — `case "hit"` returned the cached
		// 200 directly, exactly as it did before DC-a existed.
		expect(realLoadDurableReplayCalls).toHaveLength(0);
	});
});
