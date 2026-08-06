import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// THE VERIFICATION GATES — STAGING-PARITY Slice B
//
// docs/polish/POLISH-0_data-manifest.md §4 + the plan's Q5 and ACCEPTANCE
// CRITERIA. ADR-0036 primitive 1: an operational runner, not a test.
//
// Slice B ships gates 1, 2, 3 and 6. Gates 4 (coverage) and 5 (magnitudes) are
// scaffolded below as EXPLICIT skips naming their slice, so a green run can
// never be mistaken for a complete one.
//
// ── WHAT MAKES THESE NON-VACUOUS ────────────────────────────────────────────
// Gate 1 asserts event parity. It is only meaningful because the generator
// cannot write both halves — ADR-0036 primitive 4, enforced behaviourally by
// `_lib/write-guard.ts` and tripwired by
// `tests/unit/staging/generator-no-direct-writes.test.ts`. Without that, gate 1
// would pass BECAUSE the generator wrote the rows AND the events.
//
// Gate 2 calls the SHIPPED `checkMarketConservation` and does NOT re-derive the
// identity. That matters more than it looks: CPMM conservation is measured
// against pool CASH, not the reserve sum. A constant-product buy barely moves
// Y + N, so a reserve-sum delta is not the Dharma the pool absorbed. Re-deriving
// it in the gate is how that gets silently wrong.
//
// Invocation:  pnpm staging:gates                        (staging)
//              ZUGZWANG_STAGING_TARGET=local vitest run --config vitest.staging.config.ts \
//                tests/staging/gates.staging.test.ts     (local proving)
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

vi.mock("@/db", async () => {
	const { gatesDb } = await import("./_lib/read-client");
	return { db: gatesDb };
});
vi.mock("@/db/index", async () => {
	const { gatesDb } = await import("./_lib/read-client");
	return { db: gatesDb };
});

import {
	isDurableIdempotencyConflict,
	loadDurableReplay,
} from "@/server/bets/replay";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	checkCorrectedMarketConservation,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { FLOW_TAGS } from "@/server/dharma/tags";
import {
	assertGatesLiveConnection,
	closeGatesConnection,
	describeGatesTarget,
	gatesClient,
	gatesDb,
} from "./_lib/read-client";
import { resolveRunnerTarget } from "./_lib/target";

// ── THE TARGET GUARD, AT MODULE SCOPE, AHEAD OF EVERY it() ──────────────────
// The same structural rule Slice A's `runner-gating.test.ts` holds every
// present and future runner to. `_lib/read-client.ts` resolves the same pure
// predicate at its own module scope and is what actually runs first; this call
// puts the refusal in the file an operator reads.
const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: false,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — the staging gates target guard did not pass.\n  ${runnerTarget.reason}\n\n` +
			"Run it as: pnpm staging:gates",
	);
}

const FLOW_SET = new Set<DharmaEntryType>(FLOW_TAGS);

async function scalar(sqlText: string): Promise<number> {
	const rows = await gatesClient.unsafe<{ n: number }[]>(sqlText);
	return rows[0]?.n ?? -1;
}

beforeAll(async () => {
	// G-3 — assert the live socket before reading a single gate. A gate run that
	// silently verified the WRONG database would report four greens for a
	// fixture set nobody built.
	await assertGatesLiveConnection();

	const [row] = await gatesClient<{ n: number }[]>`
		SELECT count(*)::int AS n FROM markets
	`;
	console.log(
		`[staging:gates] target ${describeGatesTarget()} · markets=${row?.n ?? 0}`,
	);
});

afterAll(async () => {
	await closeGatesConnection();
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE 1 · EVENT PARITY ACROSS ALL STATE-MUTATING FLOWS
//
// Broadened at manifest v1.2 (B2) from the single `bets ↔ bet.placed` query.
// That query was one instance of a wider corruption class: staging carried a
// market at status = 'Resolved' with ZERO resolution_events and ZERO
// payout_events, hand-set — which v1.1's gate would have passed.
// ═══════════════════════════════════════════════════════════════════════════

describe("gate 1 · event parity", () => {
	it("G1.1 · every bets row has a bet.placed event", async () => {
		expect(
			await scalar(`
				SELECT count(*)::int AS n FROM bets b
				WHERE NOT EXISTS (
					SELECT 1 FROM events e
					WHERE e.aggregate_id = b.id AND e.event_type = 'bet.placed'
				)`),
		).toBe(0);
	});

	it("G1.2 · every comments row has a comment.placed event", async () => {
		expect(
			await scalar(`
				SELECT count(*)::int AS n FROM comments c
				WHERE NOT EXISTS (
					SELECT 1 FROM events e
					WHERE e.aggregate_id = c.id AND e.event_type = 'comment.placed'
				)`),
		).toBe(0);
		// Carrier: zero comments satisfies the count above perfectly.
		expect(
			await scalar(`SELECT count(*)::int AS n FROM comments`),
		).toBeGreaterThan(0);
	});

	it("G1.3 · every bets row carries a comment_id (INV-1)", async () => {
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM bets WHERE comment_id IS NULL`,
			),
		).toBe(0);
	});

	it("G1.4 · every non-Draft market has its lifecycle events", async () => {
		// market.opened for anything past Draft, plus the state's own event.
		expect(
			await scalar(`
				SELECT count(*)::int AS n FROM markets m
				WHERE m.status <> 'Draft'
				  AND NOT EXISTS (
					SELECT 1 FROM events e
					WHERE e.aggregate_id = m.id AND e.event_type = 'market.opened'
				)`),
		).toBe(0);

		// Carrier: a run in which every lifecycle call silently no-oped would
		// leave every market at Draft and satisfy both loops with nothing.
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM markets WHERE status <> 'Draft'`,
			),
		).toBeGreaterThan(0);

		for (const [status, eventType] of [
			["Closed", "market.closed"],
			["Resolving", "market.resolving"],
			["Resolved", "market.resolved"],
			["Voided", "market.voided"],
		] as const) {
			// Per-status carrier: each of these four states must actually be
			// occupied, or its NOT EXISTS check counts zero rows and passes blind.
			expect({
				status,
				present:
					(await scalar(
						`SELECT count(*)::int AS n FROM markets WHERE status = '${status}'`,
					)) > 0,
			}).toEqual({ status, present: true });
			// A Resolved market passed through Closed and Resolving, so its
			// terminal event is the one that discriminates; the intermediate ones
			// are asserted for the markets that STOP there.
			expect({
				status,
				missing: await scalar(`
					SELECT count(*)::int AS n FROM markets m
					WHERE m.status = '${status}'
					  AND NOT EXISTS (
						SELECT 1 FROM events e
						WHERE e.aggregate_id = m.id AND e.event_type = '${eventType}'
					)`),
			}).toEqual({ status, missing: 0 });
		}
	});

	it("G1.5 · every Resolved or Voided market has >= 1 resolution_events row", async () => {
		// THE THIRD CORRUPTION CLASS — the one v1.1's gate would have passed.
		// Non-vacuous only because Slice B drives the terminals: with no Resolved
		// or Voided market in the set, this counts zero rows and passes having
		// examined nothing. The carrier assertion below is what forbids that.
		expect(
			await scalar(`
				SELECT count(*)::int AS n FROM markets m
				WHERE m.status IN ('Resolved','Voided')
				  AND NOT EXISTS (
					SELECT 1 FROM resolution_events r WHERE r.market_id = m.id
				)`),
		).toBe(0);

		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM markets WHERE status IN ('Resolved','Voided')`,
			),
		).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE 2 · CONSERVATION — ITERATED OVER EVERY MARKET, NEVER SAMPLED
// ═══════════════════════════════════════════════════════════════════════════

/** A market's bet-tied FLOW rows, plus sell proceeds attributed via bet.sold. */
async function gatherMarketFlows(
	marketId: string,
): Promise<{ amount: string; entryType: DharmaEntryType }[]> {
	const betTied = await gatesClient<
		{ amount: string; entry_type: DharmaEntryType }[]
	>`
		SELECT dl.amount, dl.entry_type
		FROM dharma_ledger dl
		JOIN bets b ON b.id = dl.bet_id
		WHERE b.market_id = ${marketId}
	`;
	// Sells write a bet_id-NULL positive `bet_stake` row; the per-market
	// attribution rides the `bet.sold` event payload (scale-harness Amendment D).
	const sold = await gatesClient<{ proceeds: string }[]>`
		SELECT (payload->>'proceeds') AS proceeds
		FROM events
		WHERE event_type = 'bet.sold' AND aggregate_id = ${marketId}
	`;
	return [
		...betTied
			.filter((r) => FLOW_SET.has(r.entry_type))
			.map((r) => ({ amount: r.amount, entryType: r.entry_type })),
		...sold.map((s) => ({
			amount: s.proceeds,
			entryType: "bet_stake" as DharmaEntryType,
		})),
	];
}

/** `poolUnwindAmount` recorded on a terminal market event (R-9.5e). */
async function poolUnwind(
	marketId: string,
	eventType: "market.resolved" | "market.voided",
): Promise<string> {
	const rows = await gatesClient<{ unwind: string | null }[]>`
		SELECT (payload->>'poolUnwindAmount') AS unwind
		FROM events
		WHERE event_type = ${eventType} AND aggregate_id = ${marketId}
	`;
	return rows[0]?.unwind ?? "0";
}

describe("gate 2 · conservation", () => {
	it("G2.1 · checkMarketConservation passes for EVERY market", async () => {
		const markets = await gatesClient<{ id: string; status: string }[]>`
			SELECT id, status FROM markets ORDER BY slug
		`;
		// A market with no bets conserves trivially, so an EMPTY market list would
		// pass this gate having proved nothing (manifest §4 gate 2).
		expect(markets.length).toBeGreaterThan(0);

		const failures: unknown[] = [];
		// @code-reviewer, Slice B: `markets.length > 0` proves markets EXIST, not
		// that any was CHECKED. Draft markets `continue` below, and a market with
		// no bets conserves trivially (injection 0, flows []). All 15 could be
		// skipped or empty and this gate would report green. Count the markets
		// that reached the checker with actual Dharma flowing.
		let checkedWithFlows = 0;
		for (const market of markets) {
			// The per-market SEED, read from the market.opened payload rather than
			// a single constant — the fixture table uses different seeds per market
			// (M7 is deliberately generous so its settlement pays four digits).
			const openedRows = await gatesClient<{ seed: string | null }[]>`
				SELECT (payload->>'seedAmount') AS seed
				FROM events
				WHERE event_type = 'market.opened' AND aggregate_id = ${market.id}
			`;
			const seedRaw = openedRows[0]?.seed;
			if (seedRaw == null) {
				// Draft: never opened, no pool, no bets. Nothing to conserve, and
				// asserting an identity over an absent pool would be noise.
				continue;
			}
			const seed = new CpmmDecimal(seedRaw);
			const flows = await gatherMarketFlows(market.id);

			let injection: string;
			if (market.status === "Resolved") {
				injection = seed
					.minus(await poolUnwind(market.id, "market.resolved"))
					.toFixed(18);
			} else if (market.status === "Voided") {
				injection = seed
					.minus(await poolUnwind(market.id, "market.voided"))
					.toFixed(18);
			} else {
				// Open / Closed / Resolving — the pool's CASH backing is
				// Y + Σ(YES positions), NOT the reserve sum: a constant-product buy
				// barely moves Y + N, so the reserve-sum delta is not the Dharma the
				// pool absorbed. injection = seed − cash.
				const poolRows = await gatesClient<{ yes: string }[]>`
					SELECT yes_reserves AS yes FROM pools WHERE market_id = ${market.id}
				`;
				const yesPositions = await gatesClient<{ total: string }[]>`
					SELECT COALESCE(SUM(quantity), 0)::text AS total
					FROM positions WHERE market_id = ${market.id} AND side = 'YES'
				`;
				const cash = new CpmmDecimal(poolRows[0]?.yes ?? "0").plus(
					yesPositions[0]?.total ?? "0",
				);
				injection = seed.minus(cash).toFixed(18);
			}

			// The SHIPPED checker. The identity is not restated here.
			//
			// A market carrying a `correct` resolution row needs the CORRECTION
			// variant (identity (ii)); the plain (★) would fail on it. Zero are
			// expected in Slice B — no correction path is driven — but the branch
			// exists so a corrected market is checked rather than silently
			// mis-checked, and it branches on `resolution_events.event_kind` the way
			// the ratified scale harness does (@code-reviewer, G2.2).
			const correctionRows = await gatesClient<{ kind: string }[]>`
				SELECT event_kind AS kind FROM resolution_events
				WHERE market_id = ${market.id} AND event_kind = 'correct'
			`;
			let result: ReturnType<typeof checkMarketConservation>;
			if (correctionRows.length > 0) {
				const legs = await gatesClient<{ type: string; amount: string }[]>`
					SELECT payout_type AS type, amount FROM payout_events
					WHERE market_id = ${market.id}
				`;
				const sumOf = (type: string) =>
					legs
						.filter((l) => l.type === type)
						.reduce(
							(acc, l) => acc.plus(new CpmmDecimal(l.amount).abs()),
							new CpmmDecimal(0),
						)
						.toFixed(18);
				const uncollectable = await gatesClient<{ total: string }[]>`
					SELECT COALESCE(SUM(ABS(amount)), 0)::text AS total
					FROM dharma_ledger WHERE entry_type = 'uncollectable'
				`;
				result = checkCorrectedMarketConservation({
					ledgerFlows: flows,
					netAdminPoolInjection: injection,
					reverseRecordedTotal: sumOf("correction_reverse"),
					applyRecordedTotal: sumOf("correction_apply"),
					uncollectableTotal: uncollectable[0]?.total ?? "0",
				});
			} else {
				result = checkMarketConservation({
					ledgerFlows: flows,
					netAdminPoolInjection: injection,
				});
			}
			if (flows.length > 0) checkedWithFlows += 1;
			if (!result.ok) failures.push({ marketId: market.id, ...result });
		}
		expect(failures).toEqual([]);
		// THE REAL CARRIER: at least one market was checked with Dharma actually
		// flowing through it. Without this the gate is satisfiable by a database
		// containing nothing but empty markets.
		expect(checkedWithFlows).toBeGreaterThan(0);
	});

	it("G2.3 · no ledger row has a negative balance (INV-2)", async () => {
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM dharma_ledger WHERE balance_after < 0`,
			),
		).toBe(0);
		// Carrier: an empty ledger has no negative rows either.
		expect(
			await scalar(`SELECT count(*)::int AS n FROM dharma_ledger`),
		).toBeGreaterThan(0);
	});

	it("G2.4 · every user's latest balance equals the running sum by seq", async () => {
		// The ledger's own chain, walked in the total order ADR-0029 minted.
		expect(
			await scalar(`
				WITH walked AS (
					SELECT user_id,
					       balance_after,
					       SUM(amount) OVER (PARTITION BY user_id ORDER BY seq
					                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
					FROM dharma_ledger
				)
				SELECT count(*)::int AS n FROM walked WHERE balance_after <> running`),
		).toBe(0);
		// Carrier: the window function over an empty ledger returns no rows.
		expect(
			await scalar(`SELECT count(*)::int AS n FROM dharma_ledger`),
		).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE 3 · DURABLE REPLAY
//
// ⚠ A CORRECTION TO THE MANIFEST'S WORDING, recorded rather than papered over.
// Manifest §4 gate 3 and plan G3.1 describe `loadDurableReplay` as reproducing
// "current state from the event log". The SHIPPED function does not read
// `events` at all — it reads the durable `bet_receipts` row for an idempotency
// key and reports replay / mismatch / absent (ADR-0031). This gate asserts what
// the function actually does. The gap is a documentation defect in the
// manifest, not a missing capability, and it is logged for Slice C.
// ═══════════════════════════════════════════════════════════════════════════

describe("gate 3 · durable replay", () => {
	it("G3.1 · every generated bet's receipt replays its committed result", async () => {
		const receipts = await gatesClient<
			{ idempotency_key: string; body_fingerprint: string }[]
		>`
			SELECT idempotency_key, body_fingerprint FROM bet_receipts
		`;
		// Non-empty: a loop over zero receipts asserts nothing.
		expect(receipts.length).toBeGreaterThan(0);

		const failures: string[] = [];
		for (const receipt of receipts) {
			const replay = await loadDurableReplay(gatesDb, {
				idempotencyKey: receipt.idempotency_key,
				bodyFingerprint: receipt.body_fingerprint,
			});
			if (replay?.kind !== "replay") {
				failures.push(`${receipt.idempotency_key}: ${replay?.kind ?? "null"}`);
			}
		}
		expect(failures).toEqual([]);
	});

	it("G3.1b · a wrong fingerprint is reported as a mismatch, not a replay", async () => {
		// POSITIVE CONTROL for the assertion above: it passes when every lookup
		// returns "replay", which is also what a function that ignored its
		// fingerprint argument would produce.
		const [receipt] = await gatesClient<{ idempotency_key: string }[]>`
			SELECT idempotency_key FROM bet_receipts LIMIT 1
		`;
		expect(receipt).toBeDefined();
		const replay = await loadDurableReplay(gatesDb, {
			idempotencyKey: receipt?.idempotency_key ?? "",
			bodyFingerprint: "a-fingerprint-that-was-never-written",
		});
		expect(replay?.kind).toBe("mismatch");
	});

	it("G3.2 · reports no durable idempotency conflicts across the set", async () => {
		// Every receipt key is unique — the storage backstop is
		// `bet_receipts_idempotency_key_uq` (I-IDEM-ONCE-001).
		expect(
			await scalar(`
				SELECT count(*)::int AS n FROM (
					SELECT idempotency_key FROM bet_receipts
					GROUP BY idempotency_key HAVING count(*) > 1
				) dupes`),
		).toBe(0);

		// And the conflict PREDICATE itself still recognises the two durable
		// uniques — asserted, not assumed, since G3.2 is otherwise a negative.
		expect(
			isDurableIdempotencyConflict({
				code: "23505",
				constraint_name: "bet_receipts_idempotency_key_uq",
			}),
		).toBe(true);
		expect(
			isDurableIdempotencyConflict({
				code: "23505",
				constraint_name: "some_other_constraint",
			}),
		).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GATES 4 AND 5 · SLICE C / SLICE D
// ═══════════════════════════════════════════════════════════════════════════

describe("gate 4 · coverage", () => {
	it.skip("G4.1-G4.3 · staging-coverage.json — SLICE C", () => {
		// Needs the full §2 fixture set: replies, the C1–C11 content shapes on M2,
		// bookmarks, moderation, and the flip/exit sequences. Slice B produces
		// participants, markets, one post per active market and the four
		// lifecycle terminals — a coverage list emitted now would be a partial
		// list presented as a complete one.
	});
});

describe("gate 5 · magnitudes", () => {
	it.skip("G5.1-G5.7 · four-digit Đ per surface class — SLICE C", () => {
		// Slice B places the one carrier it MUST: P-owner's 1000 Đ YES post on M7,
		// which settles to a four-digit realised P/L. M7 terminates in this slice,
		// so that magnitude was placeable only here. The remaining criteria —
		// header Portfolio, discovery staked totals, composer amounts — depend on
		// fixtures Slice C adds, and W-D's carrier correction (G5.1 -> P-empty at
		// exactly 1000; G5.2 -> a participant that actually bets) lands with them.
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE 6 · ZERO-SHARE
// ═══════════════════════════════════════════════════════════════════════════

describe("gate 6 · zero-share", () => {
	it("G6.1 · no bets row has share_quantity = 0", async () => {
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM bets WHERE share_quantity = 0`,
			),
		).toBe(0);
		// Non-vacuous: an empty bets table satisfies the count above perfectly.
		expect(await scalar(`SELECT count(*)::int AS n FROM bets`)).toBeGreaterThan(
			0,
		);
	});

	it("G6.2 · no position has a negative quantity (I-NO-OVERSELL-001)", async () => {
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM positions WHERE quantity < 0`,
			),
		).toBe(0);
		// Carrier: an empty positions table has no negative rows either.
		expect(
			await scalar(`SELECT count(*)::int AS n FROM positions`),
		).toBeGreaterThan(0);
	});

	it.skip("G6.3 · re-assert G6.1 AFTER the P-exited full sell — SLICE C", () => {
		// SP-2's future CHECK constrains `bets`, not `positions`: a fully-exited
		// position legitimately reaches quantity = 0 (Bucket C, mutable) and must
		// not be confused with a counterfeit `bets.share_quantity = 0` row.
		//
		// Slice B drives NO sells, so the distinction has nothing to discriminate
		// yet — re-running G6.1's query here would assert exactly what G6.1
		// already asserts and read as coverage that does not exist
		// (@code-reviewer, Slice B). It becomes real when Slice C adds P-exited's
		// sell-to-zero and P-flipped's sell-all sequences.
	});
});
