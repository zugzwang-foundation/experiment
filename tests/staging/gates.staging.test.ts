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

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	isDurableIdempotencyConflict,
	loadDurableReplay,
} from "@/server/bets/replay";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	checkCorrectedMarketConservation,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import { getHeaderBalance } from "@/server/dharma/header-balance";
import { getHeaderPortfolio } from "@/server/dharma/header-portfolio";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { FLOW_TAGS } from "@/server/dharma/tags";
import { loadProfilePositions } from "@/server/profile/positions";
import { loadProfileTiles } from "@/server/profile/tiles";
import {
	buildCoverage,
	coverageSourceCounts,
	expectedCoverageIds,
	STAGING_ORIGIN,
	UNREACHABLE_REASONS,
} from "./_lib/coverage";
import {
	assertGatesLiveConnection,
	closeGatesConnection,
	describeGatesTarget,
	gatesClient,
	gatesDb,
} from "./_lib/read-client";
import { resolveRunnerTarget } from "./_lib/target";

/**
 * The gate-4 deliverable. Committed, because POLISH.1–.8 read it as the
 * standing reference and an artifact that only exists on the machine that
 * generated it is not a reference.
 */
const COVERAGE_PATH = fileURLToPath(
	new URL("../../docs/polish/staging-coverage.json", import.meta.url),
);

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

	// ── G1.6 · CONTENT PARITY — manifest v1.3 (C2) ──────────────────────────
	//
	// G1.1 proves a `bet.placed` EXISTS for every `bets` row. It does not prove
	// the two AGREE. Co-existence is not agreement: a generator that wrote a row
	// and an event describing a different bet would satisfy G1.1 completely, and
	// so would an engine change that stopped threading a field into its payload.
	//
	// This is the amendment that keeps correcting gate 3's wording (C1) from
	// silently SHRINKING the exit bar — the wider property gate 3 was believed to
	// cover, that state derives from the log, lives here now.
	//
	// Compared as NUMERIC, not as text: both sides are NUMERIC(38,18) but the
	// payload round-trips through JSON, and a text compare would fail on a
	// trailing-zero difference that is not a defect.
	it("G1.6 · every bet.placed payload AGREES with its bets row", async () => {
		expect(
			await scalar(`
				SELECT count(*)::int AS n
				FROM bets b
				JOIN events e
				  ON e.aggregate_id = b.id AND e.event_type = 'bet.placed'
				WHERE (e.payload->>'side')            IS DISTINCT FROM b.side::text
				   OR (e.payload->>'stake')::numeric  IS DISTINCT FROM b.stake
				   OR (e.payload->>'shares')::numeric IS DISTINCT FROM b.share_quantity
				   OR (e.payload->>'price')::numeric  IS DISTINCT FROM b.price_at_bet
				   OR (e.payload->>'marketId')::uuid  IS DISTINCT FROM b.market_id
				   OR (e.payload->>'userId')::uuid    IS DISTINCT FROM b.user_id`),
		).toBe(0);

		// THE CARRIER, and it is doing more work than the usual non-empty check:
		// the JOIN above yields nothing when no bet has an event, so a database
		// with the G1.1 corruption would pass G1.6 vacuously. Count the PAIRS
		// actually compared, and require every bet to be one of them.
		const pairs = await scalar(`
			SELECT count(*)::int AS n
			FROM bets b
			JOIN events e
			  ON e.aggregate_id = b.id AND e.event_type = 'bet.placed'`);
		const betRows = await scalar(`SELECT count(*)::int AS n FROM bets`);
		expect(betRows).toBeGreaterThan(0);
		expect(pairs).toBe(betRows);
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
// GATE 4 · COVERAGE — one entry per §2 row, every URL backed by a real row
//
// The list is the deliverable; the PROBES are what make it a verification. A
// coverage list is judged by what it contains, so its failure mode is a missing
// row nobody notices — which is why `expectedCoverageIds()` enumerates the §2
// rows INDEPENDENTLY of the builder rather than being derived from it.
// ═══════════════════════════════════════════════════════════════════════════

describe("gate 4 · coverage", () => {
	it("G4.1-G4.3 · emits staging-coverage.json, every entry verified", async () => {
		// Roles resolve to pool-assigned pseudonyms, which are the ENGINE's — so
		// the URLs can only be built at run time, against the generated rows.
		const userRows = await gatesClient<{ name: string; pseudonym: string }[]>`
			SELECT name, pseudonym FROM users
		`;
		const byName = new Map(userRows.map((u) => [u.name, u.pseudonym]));
		const pseudonymOf = (displayName: string): string => {
			const p = byName.get(displayName);
			if (!p) {
				throw new Error(
					`coverage: no user named ${JSON.stringify(displayName)} — the fixture set is incomplete`,
				);
			}
			return p;
		};

		const entries = buildCoverage(pseudonymOf);

		// ── G4.1 · ONE ENTRY PER §2 ROW ──────────────────────────────────────
		const expected = expectedCoverageIds();
		const got = entries.map((e) => e.id);
		expect(new Set(got).size).toBe(got.length); // no duplicates
		expect(got.slice().sort()).toEqual(expected.slice().sort());

		// ── G4.2 · EVERY REACHABLE ENTRY HAS A URL, AND THE ROW EXISTS ───────
		const reachable = entries.filter((e) => e.status === "reachable");
		expect(reachable.length).toBeGreaterThan(0);
		const missing: string[] = [];
		for (const entry of reachable) {
			if (!entry.url || !entry.probe) {
				missing.push(`${entry.id}: reachable but carries no url/probe`);
				continue;
			}
			// Absolute, so it can be pasted into a browser without assembly.
			if (!entry.url.startsWith(STAGING_ORIGIN)) {
				missing.push(`${entry.id}: url is not an absolute staging URL`);
				continue;
			}
			const rows = await gatesClient.unsafe<{ n: number }[]>(entry.probe);
			// A HAVING-shaped probe returns zero ROWS when it fails, which is a
			// different failure from returning n = 0. Both are "not found".
			const n = rows[0]?.n ?? 0;
			if (n <= 0) missing.push(`${entry.id}: probe found no row`);
		}
		expect(missing).toEqual([]);

		// ── G4.3 · UNREACHABLE ENTRIES NAME A §3 REASON, AND NO URL ──────────
		const unreachable = entries.filter((e) => e.status === "unreachable");
		// Non-vacuous: manifest §3 has entries, so a list with none is wrong.
		expect(unreachable.length).toBeGreaterThan(0);
		for (const entry of unreachable) {
			expect({
				id: entry.id,
				url: entry.url,
				reasonInManifest: UNREACHABLE_REASONS.includes(entry.reason ?? ""),
			}).toEqual({ id: entry.id, url: null, reasonInManifest: true });
		}
		// And every §3 reason is USED — a reason nobody claims means a state was
		// silently dropped from the list rather than recorded as unreachable.
		for (const reason of UNREACHABLE_REASONS) {
			expect({
				reason: reason.slice(0, 40),
				claimed: unreachable.some((e) => e.reason === reason),
			}).toEqual({ reason: reason.slice(0, 40), claimed: true });
		}

		// ── THE DELIVERABLE ──────────────────────────────────────────────────
		const payload = {
			generatedFor: describeGatesTarget(),
			origin: STAGING_ORIGIN,
			sourceCounts: coverageSourceCounts(),
			entries,
		};
		writeFileSync(COVERAGE_PATH, `${JSON.stringify(payload, null, "\t")}\n`);
		console.log(
			`[staging:gates] coverage → ${COVERAGE_PATH} · ${entries.length} entries (${reachable.length} reachable, ${unreachable.length} unreachable)`,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GATE 5 · MAGNITUDES — at least one four-digit Đ per surface class
//
// ⚠ THIS GATE EXISTS BECAUSE A PASSING SUITE WAS STRUCTURALLY BLIND.
// `tile-identity.test.ts` had six tests, a dedicated describe for
// `displayNetProfitLoss`, and EVERY assertion sub-thousand — it stayed green
// with the comma-grouping wrapper deleted. Staging's fixtures repeated that one
// layer up: `max(stake)` was 300 and `four_digit_stakes` was 0.
//
// ── WHAT "AGAINST THE GENERATED DATA" MEANS HERE (manifest §4, G5.7) ────────
// Two shapes, and the distinction is deliberate:
//
//   AGGREGATE criteria (G5.1, G5.3, G5.4) run as RAW SQL over the generated
//     rows. There is nothing to derive — a balance is a column, a staked total
//     is a SUM.
//
//   DERIVED criteria (G5.2, G5.5, G5.6) call the SHIPPED READER against the
//     live database. Đb is `computeSell(quantity).proceeds` — impact-inclusive
//     (SPEC.1 §10.8 rejects mark-to-market outright), and `netProfitLoss` is
//     `wallet + Σ Đb(open) − Σ issuance`. Restating either in SQL would be a
//     SECOND IMPLEMENTATION of the identity, which is precisely the error gate
//     2's header warns about ("do NOT re-derive the identity in the test").
//
// Neither shape is a hand-built object, which is what G5.7 forbids. The
// prohibition is on assertions over fabricated inputs, not on calling the
// shipped code — calling it is STRONGER, because it is the code the operator
// will be looking at.
//
// EVERY CRITERION NAMES ITS CARRIER, so it cannot pass by accident on some
// other row.
// ═══════════════════════════════════════════════════════════════════════════

const FOUR_DIGITS = new CpmmDecimal("1000");

/** Resolve a fixture role to its user id, via the display name. */
async function userIdOf(displayName: string): Promise<string> {
	const [row] = await gatesClient<{ id: string }[]>`
		SELECT id FROM users WHERE name = ${displayName}
	`;
	if (!row) {
		throw new Error(`gate 5: no user named ${JSON.stringify(displayName)}`);
	}
	return row.id;
}

describe("gate 5 · magnitudes", () => {
	it("G5.1 · Header Balance — carrier P-empty, at EXACTLY 1000", async () => {
		// ⚠ manifest §0 B7 / Ratification Record W-D. The plan originally put
		// P-empty at 1010; `accrueDailyCredit` fires INSIDE `place()`, so a role
		// defined by never betting never accrues. Exactly 1000 — asserted as an
		// equality, not a threshold, because the whole point of this carrier is
		// that it does not move.
		const id = await userIdOf("Staging Fixture Empty");
		const [row] = await gatesClient<{ balance: string }[]>`
			SELECT balance_after AS balance FROM dharma_ledger
			WHERE user_id = ${id} ORDER BY seq DESC LIMIT 1
		`;
		const balance = row?.balance ?? "0";
		console.log(`[gate5] G5.1 header balance (P-empty) = ${balance}`);
		expect(new CpmmDecimal(balance).equals(FOUR_DIGITS)).toBe(true);
	});

	it("G5.2 · Composer amounts — carrier P-exited, a role that ACTUALLY BETS", async () => {
		// W-D's second correction. G5.2 must be a participant that BETS, because
		// the composer's spendable figure is what a bettor sees. P-exited buys 30 Đ
		// on M12 and sells the position out in full; M12 carries no other bet, so
		// the fee-less CPMM round trip returns the stake and it rests at ~1010.
		//
		// The SHIPPED reader, not a SQL restatement: `getHeaderBalance` pins a
		// BALANCE-FIRST / CURSOR-SECOND statement order as a correctness
		// constraint, and a re-derivation here would not carry it.
		const id = await userIdOf("Staging Fixture Exited");
		const spendable = await getHeaderBalance(gatesDb, id);
		console.log(`[gate5] G5.2 composer spendable (P-exited) = ${spendable}`);
		expect(spendable).not.toBeNull();
		expect(
			new CpmmDecimal(spendable as string).greaterThanOrEqualTo(FOUR_DIGITS),
		).toBe(true);
	});

	it("G5.3 · Positions table — carrier P-owner's 1000 Đ M7 holding", async () => {
		const id = await userIdOf("Staging Fixture Owner");
		const [row] = await gatesClient<{ staked: string }[]>`
			SELECT COALESCE(SUM(b.stake), 0)::text AS staked
			FROM bets b
			JOIN markets m ON m.id = b.market_id
			WHERE b.user_id = ${id} AND m.slug = 'sp-m7-resolved'
		`;
		const staked = row?.staked ?? "0";
		console.log(`[gate5] G5.3 positions staked (P-owner / M7) = ${staked}`);
		expect(new CpmmDecimal(staked).greaterThanOrEqualTo(FOUR_DIGITS)).toBe(
			true,
		);
	});

	it("G5.4 · Discovery staked totals — carrier M2", async () => {
		const [row] = await gatesClient<{ staked: string; slug: string }[]>`
			SELECT m.slug, COALESCE(SUM(b.stake), 0)::text AS staked
			FROM markets m JOIN bets b ON b.market_id = m.id
			WHERE m.slug = 'sp-m2-active'
			GROUP BY m.slug
		`;
		const staked = row?.staked ?? "0";
		console.log(`[gate5] G5.4 discovery staked total (M2) = ${staked}`);
		expect(row?.slug).toBe("sp-m2-active");
		expect(new CpmmDecimal(staked).greaterThanOrEqualTo(FOUR_DIGITS)).toBe(
			true,
		);
	});

	it("G5.5 · Header Portfolio — carrier P-owner's OPEN M2 YES holding", async () => {
		// ⚠ THE PLAN'S CARRIER FOR THIS CRITERION WAS COUNTERFACTUAL, and it is
		// the same class of error W-D caught on G5.1/G5.2. The plan named
		// "P-owner's M7 YES position, bought at 1000 Đ" — but `getHeaderPortfolio`
		// EXCLUDES any market carrying a `payout_events` row for the viewer
		// (`header-portfolio.ts:49–60`), because a settled position's value has
		// already landed in the ledger and counting it again would double-count it
		// against Balance. M7 settles in this very run, so that carrier contributes
		// exactly zero.
		//
		// The correction: P-owner's OPEN M2 YES holding, funded by the M7 payout —
		// which is why the fixture table has an `after-settlement` phase at all.
		const id = await userIdOf("Staging Fixture Owner");
		const portfolio = await getHeaderPortfolio(gatesDb, id);
		console.log(`[gate5] G5.5 header portfolio (P-owner) = ${portfolio}`);
		// `null` is FAILURE, never emptiness — the reader's own contract.
		expect(portfolio).not.toBeNull();
		expect(
			new CpmmDecimal(portfolio as string).greaterThanOrEqualTo(FOUR_DIGITS),
		).toBe(true);
	});

	it("G5.6 · Profile §23 tiles — a four-digit net P/L", async () => {
		// The tile is `netProfitLoss` = (wallet + Σ Đb over OPEN holdings) − Σ
		// issuance. FOUR-DIGIT MEANS |value| >= 1000: the criterion exists to
		// exercise `displayNetProfitLoss`'s comma grouping, and a grouped negative
		// exercises it exactly as a grouped positive does — arguably better, since
		// the sign arm is the one a positive-only fixture leaves untested.
		const id = await userIdOf("Staging Fixture Owner");
		const positions = await loadProfilePositions(gatesDb, { userId: id });
		const tiles = await loadProfileTiles(gatesDb, { userId: id, positions });
		console.log(
			`[gate5] G5.6 profile tiles (P-owner) netPL=${tiles.netProfitLoss} wallet=${tiles.walletValue} positions=${tiles.positionsValue}`,
		);
		expect(
			new CpmmDecimal(tiles.netProfitLoss)
				.abs()
				.greaterThanOrEqualTo(FOUR_DIGITS),
		).toBe(true);
	});

	it("G5.7 · the assertion set ran against GENERATED DATA, not built objects", async () => {
		// The meta-criterion, made checkable rather than left as prose (which is
		// what got missed last time). Every criterion above reads the live
		// database — through `gatesClient` or through a shipped reader handed
		// `gatesDb`. Nothing above constructs an input.
		//
		// The observable proof: the database this gate is pointed at carries the
		// four-digit magnitudes at all. Before STAGING-PARITY, `max(stake)` on
		// staging was 300 and `four_digit_stakes` was 0 — this gate could not have
		// passed against fabricated inputs, because there were none to fabricate
		// from.
		const [row] = await gatesClient<
			{ max_stake: string; four_digit: number }[]
		>`
			SELECT COALESCE(MAX(stake), 0)::text AS max_stake,
			       count(*) FILTER (WHERE stake >= 1000)::int AS four_digit
			FROM bets
		`;
		console.log(
			`[gate5] G5.7 live bets: max_stake=${row?.max_stake} four_digit_stakes=${row?.four_digit}`,
		);
		expect(row?.four_digit ?? 0).toBeGreaterThan(0);
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

	it("G6.3 · a fully-exited POSITION reaches zero; no bets row ever does", async () => {
		// SP-2's future CHECK constrains `bets`, not `positions`. Slice B could
		// not run this — it drove no sells, so re-running G6.1's query here would
		// have asserted exactly what G6.1 asserts and read as coverage that did
		// not exist (@code-reviewer, Slice B). Slice C's two sell sequences give
		// it something to discriminate.

		// THE DISCRIMINATOR, and it must be non-zero or this gate is G6.1 again:
		// at least one `positions` row sits at exactly zero, legitimately.
		const exitedPositions = await scalar(
			`SELECT count(*)::int AS n FROM positions WHERE quantity = 0`,
		);
		expect(exitedPositions).toBeGreaterThan(0);

		// And with those rows present, `bets` still carries no zero-share row.
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM bets WHERE share_quantity = 0`,
			),
		).toBe(0);

		// A sell writes NO bets row at all (`bets.comment_id` NOT NULL forbids a
		// comment-free bet) — it reports through `bet.sold`. Asserted, because
		// "the sells produced no zero-share bets" is trivially true if the sells
		// never ran, and this is what proves they did.
		expect(
			await scalar(
				`SELECT count(*)::int AS n FROM events WHERE event_type = 'bet.sold'`,
			),
		).toBeGreaterThan(0);
	});
});
