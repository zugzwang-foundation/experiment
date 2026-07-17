import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A3 §5.6 tests-first, slice 4 — the sell-vertical wire flows (plan §7
// Integration row "sell full + partial via the conversion output (proceeds
// match `computeSell`)"; §9 slice 4; §3.2 sell conversion law; §1 rows
// I-NO-OVERSELL + SG-2 + FI-2 basis). THE point of this file: the sell
// module's OWN client modules drive the REAL /api/bets/sell route handler
// against the REAL local Postgres — the Đ→shares conversion
// (`sellSharesFor`), the greenfield wiring builder (`buildSellRequest` —
// DOES NOT EXIST yet on the EXISTING requests module: under vitest's ESM
// interop the missing NAMED export resolves to `undefined`, so ALL THREE
// scenarios FAIL NOW at the sell-request build step with
// `TypeError: buildSellRequest is not a function` — the verified RED; every
// harness stage BEFORE it (real place seeding, real viewer-context read,
// the conversion) already executes green — and the file GREENs when the
// export lands), the key lifecycle (`initialKeyState`/`reduceKey` +
// `keyOutcomeFor`), and the §4.4 envelope parser (`parseWireResponse`).
// Position seeding rides the REAL /api/bets/place route through the same
// client modules (the slice-2/3 pattern: composeWireBody →
// buildPlaceRequest → composerRequest); the position read is the REAL
// `loadViewerMarketContext` (server-only is shimmed in vitest) —
// `currentValue` is THE field the sell module's default binds to (Đb, the
// sell-all execution value: `computeSell(quantity).proceeds` — the FI-2
// ruled basis).
//
// The sell module itself is MOUNT-DEFERRED to A5 (ratified OQ-2a — the A2
// quote-route precedent): THESE TESTS ARE THE CONSUMER.
//
// PINNED PUBLIC-API CONTRACT (shared verbatim with
// tests/unit/composer/sell-request.test.ts — the implementer matches
// exactly):
//   export function buildSellRequest(args: {
//     body: { marketId: string; shares: string }; // decimal string, never a number
//     idempotencyKey: string;
//   }): { url: string; init: RequestInit };
//
// Scenarios → plan-§1 rows:
//   1. sell-full (the §6 sell-to-zero edge) → I-NO-OVERSELL (full exit:
//      shares = quantity BYTE-IDENTICAL — the full-exit law, zero
//      conversion arithmetic) + FI-2 basis (wire dharmaReturned
//      decimal-equal the pre-sell currentValue — Đb IS the sell-all
//      execution value: the same computeSell over the same reserves) +
//      F-BET-3 response shape + the strip's `NO ACTIVE POSITION` re-render
//      source (post-sell context position is NULL). STATED ROW DISPOSITION
//      (read from the engine, asserted below): the positions row REMAINS at
//      quantity 0 — `upsertPositionDelta` UPSERTs the new quantity
//      (sell-to-zero writes 0, never DELETEs a row); `getHeldPosition`'s
//      `quantity > 0` predicate is what nulls the context.
//   2. sell-partial → the plan-§7 NAMED assertion verbatim: the conversion
//      output DRIVES the wire (sharesSold decimal-equal `sellSharesFor`'s
//      result; 0 < shares < quantity on the partial path) and PROCEEDS
//      MATCH COMPUTESELL — the server oracle run over the PRE-SELL pool
//      reserves with the conversion's shares decimal-equals the wire
//      dharmaReturned; the remaining position quantity is the EXACT decimal
//      remainder (original − sharesSold).
//   3. SG-2 sell-never-clamped → the §1 grep-assertable row ("sell path has
//      no cap code at all"): the sell ROUTE source contains neither
//      `clampStakeToMax` nor `BET_MAX_STAKE`; plus the wire behavior — an
//      over-ask conversion (dharmaIn > currentValue) caps CLIENT-side at
//      the held quantity (`sellSharesFor`'s only bound) and the
//      full-quantity sell still 200s — never a cap rejection. NAMED CHOICE:
//      kept as its OWN scenario, not folded into 1 — scenario 1 keeps the
//      exact full-exit law (dharmaIn === currentValue) clean, and SG-2
//      stays a named, greppable test.
//
// Harness: mirrors tests/integration/composer-place.integration.test.ts
// EXACTLY — same mocks (session, origin, permissive rate-limit, always-miss
// idempotency so every request walks the DURABLE bet_receipts pre-check,
// mocked-OpenAI moderation base-pass — the PLACE seeding needs it; the sell
// route is comment-free and never calls the gate — over a permissive
// reservation-Redis mock, R2 sign-read stub), same fixtures + truncate
// pattern. Fixture prose reuses the existing corpus (plan §8): "durable
// replay argument", "Durable Replay Market".

const {
	mockGetSession,
	mockRelease,
	mockRedis,
	mockOpenAiModerate,
	mockSignRead,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockRelease: vi.fn(async (_response: unknown) => {}),
	// The REAL precommitModerate's reservation lifecycle: SET NX → "OK"
	// (always acquired), DEL in its finally. Permissive by design — the
	// reservation machine has its own suite (precommit-moderate).
	mockRedis: {
		set: vi.fn(async () => "OK"),
		get: vi.fn(async () => null),
		del: vi.fn(async () => 1),
		eval: vi.fn(async () => null),
	},
	mockOpenAiModerate: vi.fn(),
	// Text-only flows — never called; mocked so the real precommit's module
	// graph loads without R2 env (the precommit-moderate fixture pattern).
	mockSignRead: vi.fn(async () => "https://signed.example/unused"),
}));

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
// Body-sensitive fingerprint (JSON.stringify) + always-miss lookup — the
// Redis-lost simulation: every request walks the durable pre-check under
// its own key; distinct keys never collide.
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }));
vi.mock("@/server/moderation/openai", () => ({
	moderate: mockOpenAiModerate,
}));
vi.mock("@/server/storage/sign-read", () => ({ signRead: mockSignRead }));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	parseWireResponse,
	type WireOutcome,
} from "@/components/debate/composer/envelope";
import {
	initialKeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";
import { composeWireBody } from "@/components/debate/composer/payload";
import {
	buildPlaceRequest,
	buildSellRequest,
	type PlaceBody,
} from "@/components/debate/composer/requests";
import {
	ComposerDecimal,
	sellSharesFor,
} from "@/components/debate/composer/sell-convert";
import { keyOutcomeFor } from "@/components/debate/composer/state-map";
import { markets, pools, positions, users } from "@/db/schema";
import { BET_MIN_STAKE_POST } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";
const HARNESS_ORIGIN = "https://prd.example.com";

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Durable Replay User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Durable Replay Market",
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

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

// Scripted vendor verdict (the precommit-moderate `modResult` shape) — this
// suite runs moderation base-PASS throughout (only the place SEEDING passes
// the gate; the sell route never calls it). Block paths live in slice 2.
function passVerdict() {
	return {
		flagged: false,
		categories: { harassment: false },
		scores: { harassment: 0.01 },
	};
}

// EVERY request in this file is built by the composer's OWN wiring builders —
// never a hand-rolled fetch init. Harness-only headers (origin is
// mock-allowed; x-forwarded-for feeds the endpoint's ip identity) are merged
// AFTER the builder, so they can never mask a builder omission of the
// content-type / Idempotency-Key headers.
function composerRequest(body: PlaceBody, idempotencyKey: string): Request {
	const { url, init } = buildPlaceRequest({ body, idempotencyKey });
	expect(url).toBe("/api/bets/place");
	const headers = new Headers(init.headers);
	headers.set("origin", HARNESS_ORIGIN);
	headers.set("x-forwarded-for", "203.0.113.77");
	return new Request(`http://localhost${url}`, { ...init, headers });
}

// The sell twin — built by the GREENFIELD builder under test.
function sellComposerRequest(
	body: { marketId: string; shares: string },
	idempotencyKey: string,
): Request {
	const { url, init } = buildSellRequest({ body, idempotencyKey });
	expect(url).toBe("/api/bets/sell");
	const headers = new Headers(init.headers);
	headers.set("origin", HARNESS_ORIGIN);
	headers.set("x-forwarded-for", "203.0.113.77");
	return new Request(`http://localhost${url}`, { ...init, headers });
}

// Deterministic key mint (injected — never crypto.randomUUID here): the
// lifecycle assertions need EXACT key values per intent.
function mintSequence(prefix: string): () => string {
	let n = 0;
	return () => {
		n += 1;
		return `${prefix}-${n}`;
	};
}

function successData(outcome: WireOutcome): Record<string, unknown> {
	if (outcome.kind !== "success") {
		throw new Error(`expected success envelope, got ${outcome.kind}`);
	}
	if (typeof outcome.data !== "object" || outcome.data === null) {
		throw new Error("success data must be an object");
	}
	return outcome.data as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string") {
		throw new Error(`expected ${label} to be a string`);
	}
	return value;
}

/**
 * Position seeding rides the REAL place route through the SAME client
 * modules (the slice-2/3 pattern): composeWireBody → buildPlaceRequest →
 * composerRequest → placePOST. Deterministic literal key per seed intent;
 * the session is set to the seeding user (and stays set — the same user
 * sells afterward). Stake is the caller's derived decimal string.
 */
async function placePostBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	key: string;
}): Promise<void> {
	mockGetSession.mockResolvedValue({ user: { id: args.userId } });
	const res = await placePOST(
		composerRequest(
			{
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: composeWireBody({
					title: "durable replay argument",
					extended: "",
				}),
			},
			args.key,
		),
	);
	expect(res.status).toBe(200);
}

/** Stake comfortably above the post floor — 4× as a DERIVED decimal string. */
function stakeAboveFloor(): string {
	return new ComposerDecimal(BET_MIN_STAKE_POST).times("4").toString();
}

async function positionRow(userId: string, marketId: string) {
	return testDb
		.select({ quantity: positions.quantity })
		.from(positions)
		.where(and(eq(positions.userId, userId), eq(positions.marketId, marketId)));
}

describe("UI.A3 slice 4 — sell client modules drive POST /api/bets/sell", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOpenAiModerate.mockResolvedValue(passVerdict());
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
			"mod_actions",
		]);
	});

	it("composer-sell::full-exit-sells-to-zero-dharma-returned-equals-current-value [I-NO-OVERSELL · FI-2 basis]", async () => {
		const userId = await seedUser("ui-a3-sell-full", "ui-a3-sell-full");
		const marketId = await seedOpenMarketWithPool("ui-a3-sell-full-market");
		await seedDharmaGrant(userId);
		await placePostBet({
			userId,
			marketId,
			side: "YES",
			stake: stakeAboveFloor(),
			key: "ui-a3-sell-full-place-1",
		});

		// The REAL viewer-context read — the FI-2 basis: currentValue IS
		// computeSell(quantity).proceeds over the live reserves (Đb, the
		// sell-all EXECUTION value the sell module's default binds to).
		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });
		if (ctx.position === null) {
			throw new Error("expected a held position after the seeding place");
		}
		expect(ctx.position.side).toBe("YES");
		const { quantity, currentValue } = ctx.position;

		// The full-exit law: dharmaIn decimal-equal currentValue (the module's
		// default binding) → shares = quantity BYTE-IDENTICAL — zero
		// arithmetic, zero rounding drift on the sell-to-zero path.
		const shares = sellSharesFor({
			quantity,
			currentValue,
			dharmaIn: currentValue,
		});
		expect(shares).toBe(quantity);

		// A sell is its OWN intent — fresh key lifecycle; the request is built
		// by the greenfield sell builder.
		const mint = mintSequence("ui-a3-sell-full");
		let key = initialKeyState(mint);
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		expect(key.inFlight).toBe(true);
		const res = await sellPOST(
			sellComposerRequest({ marketId, shares }, key.key),
		);
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "success" }) },
			mint,
		);
		expect(key).toEqual({
			key: "ui-a3-sell-full-1",
			inFlight: false,
			pending: "none",
		});

		// F-BET-3 response contract: { sharesSold, dharmaReturned, newPrice }
		// — the money figures as decimal STRINGS.
		const sharesSold = requireString(data.sharesSold, "sharesSold");
		const dharmaReturned = requireString(data.dharmaReturned, "dharmaReturned");
		expect(typeof data.newPrice).toBe("string");
		// Full exit: sharesSold decimal-equal the held quantity.
		expect(new ComposerDecimal(sharesSold).eq(quantity)).toBe(true);
		// Đb IS the sell-all execution value: the executed dharmaReturned
		// decimal-equals the PRE-SELL currentValue — the same computeSell over
		// the same reserves (FI-2; nothing else touched the pool in between).
		expect(new ComposerDecimal(dharmaReturned).eq(currentValue)).toBe(true);

		// Post-sell context: position is NULL — the strip's `NO ACTIVE
		// POSITION` re-render source.
		const after = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(after.position).toBeNull();

		// STATED (read from the engine): the positions row REMAINS at quantity
		// 0 — `upsertPositionDelta` UPSERTs the new quantity (sell-to-zero
		// writes 0, never DELETEs a row); `getHeldPosition`'s `quantity > 0`
		// predicate is what nulls the context above. Assert the zero-quantity
		// row, present and exactly one.
		const rows = await positionRow(userId, marketId);
		expect(rows.length).toBe(1);
		expect(new ComposerDecimal(rows[0]?.quantity ?? "-1").eq("0")).toBe(true);
	});

	it("composer-sell::partial-sell-conversion-output-drives-wire-proceeds-match-compute-sell [plan §7 · I-NO-OVERSELL]", async () => {
		const userId = await seedUser("ui-a3-sell-part", "ui-a3-sell-part");
		const marketId = await seedOpenMarketWithPool("ui-a3-sell-part-market");
		await seedDharmaGrant(userId);
		// NO side this time — the partial path exercises the held-side → cpmm
		// lowercase-side translation on the sell spine too.
		await placePostBet({
			userId,
			marketId,
			side: "NO",
			stake: stakeAboveFloor(),
			key: "ui-a3-sell-part-place-1",
		});

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });
		if (ctx.position === null) {
			throw new Error("expected a held position after the seeding place");
		}
		expect(ctx.position.side).toBe("NO");
		const { quantity, currentValue } = ctx.position;

		// dharmaIn = HALF the position's execution value — exact decimal
		// halving via ComposerDecimal (× "0.5", emitted at 18 dp; exact
		// strings, never a JS float).
		const dharmaIn = new ComposerDecimal(currentValue).times("0.5").toFixed(18);
		const shares = sellSharesFor({ quantity, currentValue, dharmaIn });
		// The partial path: 0 < shares < quantity.
		expect(new ComposerDecimal(shares).gt("0")).toBe(true);
		expect(new ComposerDecimal(shares).lt(quantity)).toBe(true);

		// The PRE-SELL pool reserves — the computeSell oracle's input, read
		// BEFORE the sell executes.
		const poolRows = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		const pool = poolRows[0];
		if (pool === undefined) {
			throw new Error("expected a pool row for the seeded market");
		}

		const mint = mintSequence("ui-a3-sell-part");
		let key = initialKeyState(mint);
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const res = await sellPOST(
			sellComposerRequest({ marketId, shares }, key.key),
		);
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));
		key = reduceKey(
			key,
			{ type: "OUTCOME", outcome: keyOutcomeFor({ kind: "success" }) },
			mint,
		);
		expect(key).toEqual({
			key: "ui-a3-sell-part-1",
			inFlight: false,
			pending: "none",
		});

		const sharesSold = requireString(data.sharesSold, "sharesSold");
		const dharmaReturned = requireString(data.dharmaReturned, "dharmaReturned");
		// The conversion output DROVE the wire: sharesSold decimal-equal
		// sellSharesFor's result.
		expect(new ComposerDecimal(sharesSold).eq(shares)).toBe(true);

		// The plan-§7 NAMED assertion: PROCEEDS MATCH COMPUTESELL — the server
		// oracle over the PRE-SELL reserves with the conversion's shares (held
		// side NO → cpmm side "no") decimal-equals the wire dharmaReturned.
		const oracle = computeSell({
			reserves: { yes: pool.yesReserves, no: pool.noReserves },
			side: "no",
			shares,
		});
		expect(new ComposerDecimal(dharmaReturned).eq(oracle.proceeds)).toBe(true);

		// The remaining position is the EXACT decimal remainder
		// (original − sharesSold) — ≤18-dp subtraction is exact.
		const rows = await positionRow(userId, marketId);
		expect(rows.length).toBe(1);
		const remaining = new ComposerDecimal(quantity).minus(sharesSold);
		expect(new ComposerDecimal(rows[0]?.quantity ?? "-1").eq(remaining)).toBe(
			true,
		);
	});

	it("composer-sell::sell-never-clamped-route-source-grep-and-over-ask-caps-client-side [SG-2]", async () => {
		// (a) The §1 grep-assertable row VERBATIM ("sell path has no cap code
		// at all"): the sell ROUTE source carries neither the clamp helper nor
		// the cap constant — W2.10 rulings 2+3 / SPEC.1 §7/§16.1 (a seller is
		// never blocked from exiting risk; the buy-only clamp lives in the
		// place route's step 5d).
		const routeSource = readFileSync(
			join(process.cwd(), "src/app/api/bets/sell/route.ts"),
			"utf8",
		);
		expect(routeSource).not.toContain("clampStakeToMax");
		expect(routeSource).not.toContain("BET_MAX_STAKE");

		// (b) The wire behavior: an over-ask conversion (dharmaIn >
		// currentValue) caps CLIENT-side at the held quantity —
		// sellSharesFor's quantity ceiling is the ONLY bound on the sell path
		// — and the full-quantity sell still 200s: never a cap rejection.
		const userId = await seedUser("ui-a3-sell-sg2", "ui-a3-sell-sg2");
		const marketId = await seedOpenMarketWithPool("ui-a3-sell-sg2-market");
		await seedDharmaGrant(userId);
		await placePostBet({
			userId,
			marketId,
			side: "YES",
			stake: stakeAboveFloor(),
			key: "ui-a3-sell-sg2-place-1",
		});

		const ctx = await loadViewerMarketContext(testDb, { userId, marketId });
		if (ctx.position === null) {
			throw new Error("expected a held position after the seeding place");
		}
		const { quantity, currentValue } = ctx.position;

		// Over-ask: DOUBLE the execution value, exact-decimal derived.
		const overAsk = new ComposerDecimal(currentValue).times("2").toFixed(18);
		const shares = sellSharesFor({
			quantity,
			currentValue,
			dharmaIn: overAsk,
		});
		// Capped at the held quantity, byte-identical (the cap arm returns the
		// quantity string untouched) — I-NO-OVERSELL's client bound.
		expect(shares).toBe(quantity);

		const mint = mintSequence("ui-a3-sell-sg2");
		let key = initialKeyState(mint);
		key = reduceKey(key, { type: "SUBMIT" }, mint);
		const res = await sellPOST(
			sellComposerRequest({ marketId, shares }, key.key),
		);
		// The full-quantity sell EXECUTES — no cap code anywhere on the path.
		expect(res.status).toBe(200);
		const data = successData(await parseWireResponse(res));
		expect(
			new ComposerDecimal(requireString(data.sharesSold, "sharesSold")).eq(
				quantity,
			),
		).toBe(true);

		// Over-ask sold to zero — same disposition as scenario 1.
		const after = await loadViewerMarketContext(testDb, { userId, marketId });
		expect(after.position).toBeNull();
	});
});
