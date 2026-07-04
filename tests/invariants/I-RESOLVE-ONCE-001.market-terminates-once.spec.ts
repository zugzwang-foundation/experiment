import { afterEach, describe, expect, it } from "vitest";
import { markets } from "@/db/schema";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// I-RESOLVE-ONCE-001 canonical (MINTED by ENGINE.9, plan OQ-7): a market
// terminates exactly ONE way, ONCE — at most one `resolution_events` row with
// event_kind ∈ ('resolve','void') per market, EVER. Two mechanisms:
//   (i)  PRIMARY — the W-3 `markets` FOR NO KEY UPDATE lock + per-flow state
//        gate (`runResolutionTransaction`): a second settle/void serializes
//        behind the first, re-reads the terminal status, and fails the gate
//        cleanly (40001 retry → ResolutionStateError; exercised end-to-end by
//        tests/server/resolution/concurrency.test.ts).
//   (ii) STORAGE BACKSTOP — this spec: the partial UNIQUE index
//        `resolution_events_terminal_market_uq` ON resolution_events
//        (market_id) WHERE event_kind IN ('resolve','void') (migration 0014).
//        Belt-vs-bugs ONLY: it can fire only on a logic bug — loudly (23505),
//        never caught to "recover" (ENGINE.12 R3 / ENGINE.13 P2 loud-failure
//        policy); never a user-facing 23505.
//
// `correct` kinds are EXCLUDED from the index — the corrections chain stays
// structurally open (R-9.3: correction-of-a-correction is the safety valve).
//
// Fixture-bypass posture (SPEC.2 §6.6, the I-GRANT-ONCE-001 mirror): raw
// `testClient.unsafe` INSERTs go straight past the (greenfield) application
// layer so the INDEX is the only enforcement under test. NO src import — this
// spec RUNS today and REDs on the missing 0014 index (the duplicate terminal
// INSERT currently succeeds, so the `rejects` assertions fail).
//
// DB-BACKED: cannot RED locally with Postgres :54322 down (ECONNREFUSED is
// infra, not an assertion red).

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Resolve-Once Market",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

function insertResolutionRow(args: {
	marketId: string;
	eventKind: "resolve" | "correct" | "void";
	outcome: "YES" | "NO" | "VOID";
	correctsEventId?: string;
	reason?: string;
}): Promise<{ id: string }[]> {
	// Raw INSERT — bypasses the (greenfield) W-3 wrapper entirely. Satisfies
	// the 0014 CHECKs (kind↔outcome; corrects-link) so the spec stays green
	// post-migration except where it pins the terminal-once index.
	return testClient.unsafe(
		`INSERT INTO resolution_events (market_id, event_kind, outcome, corrects_event_id, reason)
		 VALUES ($1, $2::resolution_event_kind, $3::market_outcome, $4, $5)
		 RETURNING id`,
		[
			args.marketId,
			args.eventKind,
			args.outcome,
			args.correctsEventId ?? null,
			args.reason ?? "I-RESOLVE-ONCE fixture reason",
		],
	) as unknown as Promise<{ id: string }[]>;
}

describe("I-RESOLVE-ONCE-001: a market terminates exactly one way, once", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["resolution_events", "markets"]);
	});

	it("resolve-once::backstop-rejects-second-resolve-same-market", async () => {
		const marketId = await seedMarket("resolve-once-dup-resolve");

		// First terminal row — the legitimate resolve.
		await insertResolutionRow({
			marketId,
			eventKind: "resolve",
			outcome: "YES",
		});

		// Second `resolve` for the SAME market — the backstop index rejects
		// with unique_violation, loudly (belt-vs-bugs; unreachable through
		// the W-3 gate).
		await expect(
			insertResolutionRow({ marketId, eventKind: "resolve", outcome: "NO" }),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "resolution_events_terminal_market_uq",
		});
	});

	it("resolve-once::backstop-rejects-void-after-resolve", async () => {
		const marketId = await seedMarket("resolve-once-void-after");

		await insertResolutionRow({
			marketId,
			eventKind: "resolve",
			outcome: "YES",
		});

		// A `void` after a `resolve` is the OTHER terminal kind — the index
		// covers BOTH ("terminates exactly one way"): same 23505.
		await expect(
			insertResolutionRow({ marketId, eventKind: "void", outcome: "VOID" }),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "resolution_events_terminal_market_uq",
		});
	});

	it("resolve-once::correct-rows-keep-the-chain-open", async () => {
		// Negative space: `correct` kinds are NOT terminal — the partial WHERE
		// excludes them, so the corrections chain stays open after the one
		// terminal row. (Vacuously green pre-index — the load-bearing REDs
		// live in the rejection tests above; this guards the index's scope
		// once it lands. The I-GRANT-ONCE-001 scope-test mirror.)
		const marketId = await seedMarket("resolve-once-chain-open");

		const [resolveRow] = await insertResolutionRow({
			marketId,
			eventKind: "resolve",
			outcome: "YES",
		});
		const resolveId = resolveRow?.id ?? "";

		// correction-1 — accepted alongside the terminal row.
		const [correction1] = await insertResolutionRow({
			marketId,
			eventKind: "correct",
			outcome: "NO",
			correctsEventId: resolveId,
		});

		// correction-of-correction — the chain stays structurally open.
		await insertResolutionRow({
			marketId,
			eventKind: "correct",
			outcome: "YES",
			correctsEventId: correction1?.id ?? "",
		});

		const rows = await testClient.unsafe(
			`SELECT event_kind FROM resolution_events WHERE market_id = $1`,
			[marketId],
		);
		expect(rows.length).toBe(3);

		// And a DIFFERENT market's terminal row is unconstrained by this
		// market's — the index is per-market.
		const otherMarketId = await seedMarket("resolve-once-other-market");
		await insertResolutionRow({
			marketId: otherMarketId,
			eventKind: "void",
			outcome: "VOID",
		});
	});
});
