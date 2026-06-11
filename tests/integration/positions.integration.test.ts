import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { events, markets, positions, users } from "@/db/schema";
import { computeBuy, seedPool } from "@/server/cpmm/calculate";
import { PositionSingleSideError } from "@/server/positions/errors";
import { upsertPositionDelta } from "@/server/positions/persist";
import { testClient, testDb } from "../db/_fixtures/db";

// ENGINE.11 §5.6 tests-first — position persistence + the nightly drift cron
// (D1/D2/D3). DB-BACKED: cannot RED locally (PROBE-P2 — local Postgres :54322
// DOWN; ECONNREFUSED is infra, not an assertion red). First true run is CI on
// the PR, post-migration (Migration A adds the CHECK + partial unique index;
// Migration B adds check_nightly_drift()). Written type-correct + behaviorally
// complete so CI goes GREEN once execute lands. The greenfield value import
// (`upsertPositionDelta`) keeps this from resolving until ENGINE.11 lands.
//
// All quantities are NUMERIC(38,18) → exact 18-dp canonical strings; no float
// ever crosses a boundary (CLAUDE.md §2). All drift checks are order-free
// (ADR-0016 Driver 7 — no reliance on UUID/created_at ordering).
//
// Forced-constraint + drift-function probes go through `testClient.unsafe`
// (raw postgres-js) so the storage layer / plpgsql function is the only thing
// under test (SPEC.2 §6.6 fixture-bypass posture). Drift events/ledger rows are
// seeded raw so exact (incl. corrupted) values can be forced.

const META = {
	request_id: "test",
	flow_id: "test",
	user_id: null,
	actor_id: "test",
	idempotency_key: null,
	ip: "test",
	user_agent: "test",
};

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Position User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Position Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

// Seed a bet.placed/bet.sold event row raw. D1 folds over payload->>'userId' /
// 'marketId' / 'side' / 'shares'|'sharesSold'; the aggregate columns are
// cosmetic (D1 keys on payload fields). aggregateType 'market', aggregateId =
// marketId by convention.
async function seedBetEvent(args: {
	eventType: "bet.placed" | "bet.sold";
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	shares: string; // for bet.placed: payload.shares; for bet.sold: payload.sharesSold
}): Promise<void> {
	const payload =
		args.eventType === "bet.placed"
			? {
					betId: crypto.randomUUID(),
					marketId: args.marketId,
					userId: args.userId,
					side: args.side,
					stake: args.shares,
					shares: args.shares,
					price: "0.5",
					commentId: crypto.randomUUID(),
					parentCommentId: null,
				}
			: {
					betId: crypto.randomUUID(),
					marketId: args.marketId,
					userId: args.userId,
					side: args.side,
					sharesSold: args.shares,
					proceeds: args.shares,
					price: "0.5",
				};
	await testDb.insert(events).values({
		eventType: args.eventType,
		aggregateType: "market",
		aggregateId: args.marketId,
		payload,
		payloadVersion: 1,
		metadata: META,
	});
}

// Seed a positions row raw (forces an exact stored quantity, incl. drifted).
async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO positions (user_id, market_id, side, quantity)
		 VALUES ($1, $2, $3, $4)`,
		[args.userId, args.marketId, args.side, args.quantity],
	);
}

// Seed a dharma_ledger row raw — forces exact balance_after (incl. corrupted).
// Keep seeded balance_after ≥ 0 (the dharma_ledger_balance_non_negative CHECK
// is in force and must not be tripped by the D2 fixtures).
async function seedLedgerRow(args: {
	userId: string;
	entryType: string;
	amount: string;
	balanceAfter: string;
}): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after)
		 VALUES ($1, $2, $3, $4)`,
		[args.userId, args.entryType, args.amount, args.balanceAfter],
	);
}

// Run the nightly drift function and read back the alarms it produced.
async function runDriftAndReadAlarms(
	alarmId: string,
): Promise<Array<{ alarm_id: string; payload: Record<string, unknown> }>> {
	await testClient.unsafe(`SELECT check_nightly_drift()`);
	const rows = await testClient.unsafe<
		Array<{ alarm_id: string; payload: Record<string, unknown> }>
	>(`SELECT alarm_id, payload FROM cron_alarms WHERE alarm_id = $1`, [alarmId]);
	return rows;
}

describe("ENGINE.11 positions persistence + nightly drift", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE positions, events, dharma_ledger, cron_alarms, markets, users CASCADE`,
		);
	});

	it("positions-upsert::conflict-accumulates-single-row", async () => {
		// Two upserts for the same (user,market,side) → the second UPDATES on the
		// positions_user_market_side_idx conflict; quantity accumulates, one row.
		const userId = await seedUser("upsert-acc", "upsert-acc");
		const marketId = await seedMarket("upsert-acc-market");

		const first = await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "80",
			}),
		);
		expect(first.quantity).toBe("80.000000000000000000");

		const second = await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "40",
			}),
		);
		expect(second.quantity).toBe("120.000000000000000000");

		const rows = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(rows.length).toBe(1);
		expect(rows[0]?.quantity).toBe("120.000000000000000000");
	});

	it("positions-upsert::updated-at-bumps-on-update", async () => {
		// updated_at is app-managed (Drizzle 0.45 won't auto-bump). now() is
		// tx-frozen WITHIN a tx, so the two upserts run in SEPARATE txns to let
		// the clock advance between them.
		const userId = await seedUser("upsert-ts", "upsert-ts");
		const marketId = await seedMarket("upsert-ts-market");

		await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "10",
			}),
		);
		const [afterInsert] = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);

		await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "5",
			}),
		);
		const [afterUpdate] = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);

		expect(afterUpdate?.quantity).toBe("15.000000000000000000");
		// updated_at strictly advanced past the insert's updated_at.
		expect(afterUpdate?.updatedAt.getTime()).toBeGreaterThan(
			afterInsert?.updatedAt.getTime() ?? 0,
		);
		// created_at is unchanged by the UPDATE.
		expect(afterUpdate?.createdAt.getTime()).toBe(
			afterInsert?.createdAt.getTime(),
		);
	});

	it("positions-storage::CHECK-fires-23514-on-forced-negative", async () => {
		// The storage CHECK positions_quantity_non_negative is the ground-truth
		// floor (Migration A). A raw forced-negative insert is rejected by it.
		const userId = await seedUser("check-neg", "check-neg");
		const marketId = await seedMarket("check-neg-market");

		await expect(
			testClient.unsafe(
				`INSERT INTO positions (user_id, market_id, side, quantity)
				 VALUES ($1, $2, 'YES', '-1')`,
				[userId, marketId],
			),
		).rejects.toMatchObject({
			code: "23514",
			constraint_name: "positions_quantity_non_negative",
		});
	});

	it("positions-storage::partial-unique-fires-23505-on-second-held-side", async () => {
		// The partial unique index positions_one_held_side_idx (Migration A)
		// permits at most one quantity>0 row per (user,market). A second held
		// side is rejected — the structural single-side enforcement.
		const userId = await seedUser("dual-side", "dual-side");
		const marketId = await seedMarket("dual-side-market");

		await seedPosition({ userId, marketId, side: "YES", quantity: "10" });
		await expect(
			seedPosition({ userId, marketId, side: "NO", quantity: "10" }),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "positions_one_held_side_idx",
		});
	});

	it("positions-upsert::flip-order-23505-translates-to-PositionSingleSideError", async () => {
		// The path NO existing test exercised: a flip-order violation THROUGH the
		// single gate (not raw SQL). User holds YES; upsertPositionDelta for the
		// opposite side inserts a 2nd quantity>0 row → positions_one_held_side_idx
		// 23505 → caught and translated to PositionSingleSideError. RED on the old
		// top-level-only error read (Drizzle wraps the SQLSTATE on `.cause`); green
		// once isSingleSideViolation unwraps `.cause`.
		const userId = await seedUser("flip-xlate", "flip-xlate");
		const marketId = await seedMarket("flip-xlate-market");

		await seedPosition({ userId, marketId, side: "YES", quantity: "10" });

		await expect(
			testDb.transaction((tx) =>
				upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "NO",
					shareDelta: "10",
				}),
			),
		).rejects.toBeInstanceOf(PositionSingleSideError);
	});

	// ── D1: positions vs events-canonical replay ──────────────────────────────

	it("drift-D1::clean-pass-no-alarm", async () => {
		// Worked example (plan §D1): placed(YES,80), placed(YES,40), sold(YES,30)
		// ⇒ expected = 80 + 40 − 30 = 90. Stored quantity 90 → zero drift alarms.
		const userId = await seedUser("d1-clean", "d1-clean");
		const marketId = await seedMarket("d1-clean-market");

		await seedBetEvent({
			eventType: "bet.placed",
			userId,
			marketId,
			side: "YES",
			shares: "80",
		});
		await seedBetEvent({
			eventType: "bet.placed",
			userId,
			marketId,
			side: "YES",
			shares: "40",
		});
		await seedBetEvent({
			eventType: "bet.sold",
			userId,
			marketId,
			side: "YES",
			shares: "30",
		});
		await seedPosition({ userId, marketId, side: "YES", quantity: "90" });

		const alarms = await runDriftAndReadAlarms("position_drift");
		expect(alarms.length).toBe(0);
	});

	it("drift-D1::seeded-drift-both-directions-fires", async () => {
		// Same events (expected = 90) for two (user,market,side) rows; one stored
		// 95 (discrepancy +5, stored exceeds replay), one stored 85 (discrepancy
		// −5, stored below replay). Each fires a position_drift alarm carrying
		// expected/actual/discrepancy.
		const overUser = await seedUser("d1-over", "d1-over");
		const overMarket = await seedMarket("d1-over-market");
		const underUser = await seedUser("d1-under", "d1-under");
		const underMarket = await seedMarket("d1-under-market");

		for (const { userId, marketId } of [
			{ userId: overUser, marketId: overMarket },
			{ userId: underUser, marketId: underMarket },
		]) {
			await seedBetEvent({
				eventType: "bet.placed",
				userId,
				marketId,
				side: "YES",
				shares: "80",
			});
			await seedBetEvent({
				eventType: "bet.placed",
				userId,
				marketId,
				side: "YES",
				shares: "40",
			});
			await seedBetEvent({
				eventType: "bet.sold",
				userId,
				marketId,
				side: "YES",
				shares: "30",
			});
		}
		// Stored quantities drift from the replayed 90 in both directions.
		await seedPosition({
			userId: overUser,
			marketId: overMarket,
			side: "YES",
			quantity: "95",
		});
		await seedPosition({
			userId: underUser,
			marketId: underMarket,
			side: "YES",
			quantity: "85",
		});

		const alarms = await runDriftAndReadAlarms("position_drift");
		expect(alarms.length).toBe(2);

		const byUser = new Map(
			alarms.map((a) => [a.payload.user_id as string, a.payload]),
		);
		// discrepancy = actual − expected; positive ⇒ stored exceeds replay.
		expect(byUser.get(overUser)?.discrepancy).toBe("5.000000000000000000");
		expect(byUser.get(overUser)?.expected).toBe("90.000000000000000000");
		expect(byUser.get(overUser)?.actual).toBe("95.000000000000000000");
		expect(byUser.get(underUser)?.discrepancy).toBe("-5.000000000000000000");
		expect(byUser.get(underUser)?.expected).toBe("90.000000000000000000");
		expect(byUser.get(underUser)?.actual).toBe("85.000000000000000000");
	});

	it("drift-D1::cpmm-sourced-clean-and-INV-C4-cross-assert", async () => {
		// The genuinely-independent oracle (plan §D1 Derivation B honest note):
		// fold events whose `shares` is an ACTUAL computeBuy output, then
		// cross-assert INV-C4 (the per-side position quantity == the cpmm-derived
		// share holding). cpmm side is LOWERCASE "yes"/"no"; events/positions side
		// is UPPERCASE — translate at the boundary.
		const userId = await seedUser("d1-cpmm", "d1-cpmm");
		const marketId = await seedMarket("d1-cpmm-market");

		const reserves = seedPool("100");
		const buy = computeBuy({ reserves, side: "yes", stake: "50" });
		// buy.shares is the cpmm-derived holding (exact 18-dp).

		await seedBetEvent({
			eventType: "bet.placed",
			userId,
			marketId,
			side: "YES", // translated from cpmm "yes"
			shares: buy.shares,
		});
		await seedPosition({
			userId,
			marketId,
			side: "YES",
			quantity: buy.shares,
		});

		// D1: positions (buy.shares) == replay (Σ placed.shares) → clean.
		const alarms = await runDriftAndReadAlarms("position_drift");
		expect(alarms.length).toBe(0);

		// INV-C4 cross-assert: the stored position quantity equals the cpmm
		// solvency-shape holding the pool math produced.
		const [row] = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(row?.quantity).toBe(buy.shares);
	});

	// ── D2: per-user dharma chain integrity (D2-A SUM + D2-B edge-link) ────────

	it("drift-D2::clean-chain-no-alarm", async () => {
		// Worked example (plan §D2 clean): initial_grant +1000→1000,
		// bet_stake −10→990, bet_stake −50→940, bet_payout +25→965,
		// uncollectable −20→965 (uncollectable carve-out: balance_after =
		// previous). Both D2-A and D2-B pass → zero dharma_chain_drift alarms.
		const userId = await seedUser("d2-clean", "d2-clean");

		await seedLedgerRow({
			userId,
			entryType: "initial_grant",
			amount: "1000",
			balanceAfter: "1000",
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_stake",
			amount: "-10",
			balanceAfter: "990",
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_stake",
			amount: "-50",
			balanceAfter: "940",
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_payout",
			amount: "25",
			balanceAfter: "965",
		});
		await seedLedgerRow({
			userId,
			entryType: "uncollectable",
			amount: "-20",
			balanceAfter: "965",
		});

		const alarms = await runDriftAndReadAlarms("dharma_chain_drift");
		expect(alarms.length).toBe(0);
	});

	it("drift-D2::chain-break-fires-both-D2-A-and-D2-B", async () => {
		// Corrupt the −50 row's balance_after 940→945 (plan §D2 seeded drift (a)).
		// D2-B(i): implied_prev = 945 − (−50) = 995, absent from the chain → fires.
		// D2-A: no clean net=+1 sink / Σ ≠ latest → fires. Both alarm
		// independently (the payload names which: derivation D2-A vs D2-B).
		const userId = await seedUser("d2-break", "d2-break");

		await seedLedgerRow({
			userId,
			entryType: "initial_grant",
			amount: "1000",
			balanceAfter: "1000",
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_stake",
			amount: "-10",
			balanceAfter: "990",
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_stake",
			amount: "-50",
			balanceAfter: "945", // CORRUPTED: should be 940
		});
		await seedLedgerRow({
			userId,
			entryType: "bet_payout",
			amount: "25",
			balanceAfter: "965",
		});
		await seedLedgerRow({
			userId,
			entryType: "uncollectable",
			amount: "-20",
			balanceAfter: "965",
		});

		const alarms = await runDriftAndReadAlarms("dharma_chain_drift");
		const derivations = new Set(
			alarms.map((a) => a.payload.derivation as string),
		);
		expect(derivations.has("D2-A")).toBe(true);
		expect(derivations.has("D2-B")).toBe(true);
		// Every alarm is for this user.
		for (const a of alarms) {
			expect(a.payload.user_id).toBe(userId);
		}
	});

	it("drift-D2::duplicated-genesis-fires-both-D2-A-and-D2-B", async () => {
		// Add a SECOND initial_grant +500→500 (implied_prev = 0) — plan §D2
		// seeded drift (b). D2-B(ii): two implied_prev=0 genesis rows → fires (the
		// A1 fix — a duplicated genesis slips past the broken-link clause alone).
		// D2-A: two net=+1 sinks (965, 500), Σ = 1465 matches no candidate → fires.
		const userId = await seedUser("d2-dup", "d2-dup");

		// ENGINE.13 (0013): the partial unique index normally makes a second
		// initial_grant row per user impossible — so to EXERCISE the D2-B
		// duplicated-genesis belt we must SIMULATE the index being absent (a
		// bad/mis-applied migration), the drift-D3 pattern below. Drop it,
		// seed the duplicated genesis, run drift, then RESTORE the index
		// exactly as migration 0013 defines it (leave the schema as the
		// migration left it).
		await testClient.unsafe(`DROP INDEX dharma_ledger_initial_grant_user_uq`);
		try {
			await seedLedgerRow({
				userId,
				entryType: "initial_grant",
				amount: "1000",
				balanceAfter: "1000",
			});
			await seedLedgerRow({
				userId,
				entryType: "bet_stake",
				amount: "-10",
				balanceAfter: "990",
			});
			await seedLedgerRow({
				userId,
				entryType: "bet_stake",
				amount: "-50",
				balanceAfter: "940",
			});
			await seedLedgerRow({
				userId,
				entryType: "bet_payout",
				amount: "25",
				balanceAfter: "965",
			});
			await seedLedgerRow({
				userId,
				entryType: "uncollectable",
				amount: "-20",
				balanceAfter: "965",
			});
			// The duplicated genesis (second implied_prev = 0 row).
			await seedLedgerRow({
				userId,
				entryType: "initial_grant",
				amount: "500",
				balanceAfter: "500",
			});

			const alarms = await runDriftAndReadAlarms("dharma_chain_drift");
			const derivations = new Set(
				alarms.map((a) => a.payload.derivation as string),
			);
			expect(derivations.has("D2-A")).toBe(true);
			expect(derivations.has("D2-B")).toBe(true);
			for (const a of alarms) {
				expect(a.payload.user_id).toBe(userId);
			}
		} finally {
			// Clear the illegal rows BEFORE re-creating the unique index, then
			// restore the index byte-faithful to 0013.
			await testClient.unsafe(`TRUNCATE dharma_ledger CASCADE`);
			await testClient.unsafe(
				`CREATE UNIQUE INDEX "dharma_ledger_initial_grant_user_uq" ON "dharma_ledger" USING btree ("user_id") WHERE "dharma_ledger"."entry_type" = 'initial_grant'`,
			);
		}
	});

	// ── D3: single-side belt (defense-in-depth) ───────────────────────────────

	it("drift-D3::double-held-fires-when-index-absent", async () => {
		// The partial unique index normally makes two quantity>0 rows per
		// (user,market) impossible — so to EXERCISE the D3 belt we must SIMULATE
		// the index being absent (a bad/mis-applied migration). Drop it, insert
		// two held rows (YES+NO), run drift, assert single_side_violation, then
		// RESTORE the index exactly as the migration defines it (leave the schema
		// as the migration left it).
		const userId = await seedUser("d3-dual", "d3-dual");
		const marketId = await seedMarket("d3-dual-market");

		await testClient.unsafe(`DROP INDEX positions_one_held_side_idx`);
		try {
			await seedPosition({ userId, marketId, side: "YES", quantity: "10" });
			await seedPosition({ userId, marketId, side: "NO", quantity: "10" });

			const alarms = await runDriftAndReadAlarms("single_side_violation");
			expect(alarms.length).toBe(1);
			expect(alarms[0]?.payload.user_id).toBe(userId);
			expect(alarms[0]?.payload.market_id).toBe(marketId);
		} finally {
			// Clear the illegal rows BEFORE re-creating the unique index, then
			// restore the index to the migration-defined shape.
			await testClient.unsafe(`TRUNCATE positions CASCADE`);
			await testClient.unsafe(
				`CREATE UNIQUE INDEX positions_one_held_side_idx
				 ON positions (user_id, market_id) WHERE quantity > 0`,
			);
		}
	});

	// ── empty-system: correct-when-empty (dormant-but-correct) ────────────────

	it("drift-empty::no-positions-no-events-zero-alarms", async () => {
		// With no positions and no bet events, check_nightly_drift() inserts ZERO
		// cron_alarms. The cron is dormant-but-correct until ENGINE.7/8 produce
		// events + positions.
		await testClient.unsafe(`SELECT check_nightly_drift()`);
		const rows = await testClient.unsafe<Array<{ count: string }>>(
			`SELECT count(*)::text AS count FROM cron_alarms
			 WHERE alarm_id IN ('position_drift','dharma_chain_drift','single_side_violation')`,
		);
		expect(rows[0]?.count).toBe("0");
	});
});
