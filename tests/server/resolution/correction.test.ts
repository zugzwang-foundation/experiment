import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	comments,
	dharmaLedger,
	events,
	markets,
	payoutEvents,
	pools,
	resolutionEvents,
	users,
} from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { correctResolution } from "@/server/resolution/correct";
import {
	CorrectionOutcomeError,
	ResolutionStateError,
} from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (S4, plan §Test plan) — `clawback-floors-at-zero`
// + the correction suite (F-RESOLVE-2, W-3c). Greenfield value imports from
// `@/server/resolution/{correct,settle,errors}` RED at collection until
// ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// Fixture (seed-100 economy, verified against cpmm/calculate.ts exactly):
//   Market M:  R buys YES 100 → 150 sh ( 50, 200)
//              L buys NO   50 → 150 sh (100, 100)
//              P buys YES 100 → 150 sh ( 50, 200)
//   Settle YES: R +150 → 1050; P +150 → 150 (P's grant is only 100); L 0.
//   Market M2 (Open): P buys YES 110 → P balance 40 (the spend-down that
//   makes the floor BITE — a real, product-legal post-resolve spend).
//   Correct M YES→NO (the documented reverse+uncollectable pair, C-4):
//     R: B=1050, R_u=150 → ONE correction_reverse −150 → 900. No remainder.
//     P: B=40,   R_u=150 → reverse −min(150,40) = −40 → balance EXACTLY 0;
//        ONE uncollectable −110, balance_after = previous = 0 (model A);
//        anchor betId = P's earliest affected M bet (C-4).
//     L: R_u=0 → no reverse row; apply basis NO: +150 → 1100.
//   payout_events: TWO legs per bet, zero legs included (C-7) — 6 rows.
//   P's post-correction ledger IS the I2 fixture-(a) parked-at-zero shape
//   (D-1): grant +100 ba100 · stake −100 ba0 · payout +150 ba150 · stake −110
//   ba40 · reverse −40 ba0 · uncollectable −110 ba0.
//
// The recorded-vs-recomputed divergence is induced SYNTHETICALLY (out-of-band
// positions-row tweak after resolve — plan M-2/F-3): a REAL sell between
// resolve and correct is product-impossible (the W-1 coarse gate rejects all
// non-Open trades), so the synthetic tweak is what makes the assertion
// discriminating.

const SEED = "100.000000000000000000";
const RESOLVE_REASON = "Criterion met: original resolve evidence.";
const CORRECT_REASON = "Corrected after review: criterion misread.";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-resolution-correct",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string) {
	return {
		request_id: "test-correction-fixture",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(emailTag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Correction User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(), // suppress the Daily Credit
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Correction Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): Promise<string> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `correction argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId),
			}),
	);
	return result.betId;
}

async function setResolving(marketId: string): Promise<void> {
	await testClient.unsafe(
		`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
		[marketId],
	);
}

/** Market M resolved YES + P spent down to 40 on M2 — correction-ready. */
async function seedCorrectionScenario(slug: string): Promise<{
	marketId: string;
	userR: string;
	userP: string;
	userL: string;
	betR: string;
	betP: string;
	betL: string;
	resolveEventId: string;
}> {
	const userR = await seedUser(`correct-r-${slug}`, "1000");
	const userP = await seedUser(`correct-p-${slug}`, "100");
	const userL = await seedUser(`correct-l-${slug}`, "1000");
	const marketId = await seedOpenMarketWithPool(`correct-${slug}`);
	const betR = await placeBet({
		userId: userR,
		marketId,
		side: "YES",
		stake: "100",
	});
	const betL = await placeBet({
		userId: userL,
		marketId,
		side: "NO",
		stake: "50",
	});
	const betP = await placeBet({
		userId: userP,
		marketId,
		side: "YES",
		stake: "100",
	});
	await setResolving(marketId);
	const settled = await settleMarket({
		marketId,
		winningSide: "YES",
		reason: RESOLVE_REASON,
		settleEventId: uuidv7(),
		metadata: adminMetadata("F-RESOLVE-1"),
	});
	// P spends the phantom winnings down to 40 on a SECOND, still-Open market.
	const market2 = await seedOpenMarketWithPool(`correct-${slug}-m2`);
	await placeBet({
		userId: userP,
		marketId: market2,
		side: "YES",
		stake: "110",
	});
	return {
		marketId,
		userR,
		userP,
		userL,
		betR,
		betP,
		betL,
		resolveEventId: settled.resolutionEventId,
	};
}

describe("ENGINE.9 F-RESOLVE-2 — correctResolution (W-3c)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("resolution-correction::clawback-floors-at-zero", async () => {
		const s = await seedCorrectionScenario("floor");

		const result = await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// R-9.6 visibility: the floored loss is surfaced in the response.
		expect(new CpmmDecimal(result.uncollectableTotal).equals("110")).toBe(true);
		expect(result.betsAffected).toBe(3);
		expect(result.correctionEventId).toBeDefined();

		// RICH user R — full reversal: ONE correction_reverse row, −150 → 900.
		const ledgerR = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userR),
					eq(dharmaLedger.entryType, "correction_reverse"),
				),
			);
		expect(ledgerR.length).toBe(1);
		expect(ledgerR[0]?.amount).toBe("-150.000000000000000000");
		expect(ledgerR[0]?.balanceAfter).toBe("900.000000000000000000");
		const uncollectableR = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userR),
					eq(dharmaLedger.entryType, "uncollectable"),
				),
			);
		expect(uncollectableR.length).toBe(0);

		// POOR user P — floored: reverse −min(R,B) = −40 lands balance at
		// EXACTLY zero (INV-2: a per-bet reverse chain would walk negative);
		// then the model-A uncollectable pair rides AFTER it, chained.
		const reverseP = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userP),
					eq(dharmaLedger.entryType, "correction_reverse"),
				),
			);
		expect(reverseP.length).toBe(1);
		expect(reverseP[0]?.amount).toBe("-40.000000000000000000");
		expect(reverseP[0]?.balanceAfter).toBe("0.000000000000000000");
		// Anchor betId = P's earliest affected bet in THIS market (C-4 — a
		// NULL anchor would be invisible to per-market conservation).
		expect(reverseP[0]?.betId).toBe(s.betP);

		// The model-A uncollectable: amount = −(R−B) ≤ 0, balance_after =
		// previous (the post-reverse 0) — BOTH fields pinned (A9: the shipped
		// ledger guard is the only defense).
		const uncollectableP = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userP),
					eq(dharmaLedger.entryType, "uncollectable"),
				),
			);
		expect(uncollectableP.length).toBe(1);
		expect(uncollectableP[0]?.amount).toBe("-110.000000000000000000");
		expect(uncollectableP[0]?.balanceAfter).toBe("0.000000000000000000");
		expect(uncollectableP[0]?.betId).toBe(s.betP);

		// L — the newly-winning side: ONE correction_apply +150 → 1100.
		const applyL = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userL),
					eq(dharmaLedger.entryType, "correction_apply"),
				),
			);
		expect(applyL.length).toBe(1);
		expect(applyL[0]?.amount).toBe("150.000000000000000000");
		expect(applyL[0]?.balanceAfter).toBe("1100.000000000000000000");
		expect(applyL[0]?.betId).toBe(s.betL);
	});

	it("resolution-correction::two-payout-legs-per-bet-zero-legs-included", async () => {
		const s = await seedCorrectionScenario("legs");

		const result = await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// C-7: TWO payout_events rows per bet — 3 bets ⇒ 6 rows; reverse legs
		// carry −recorded (NEVER the floored ledger value); apply legs carry
		// the corrected-side basis; zero legs are real rows.
		const legs = await testDb
			.select({
				betId: payoutEvents.betId,
				payoutType: payoutEvents.payoutType,
				amount: payoutEvents.amount,
				resolutionEventId: payoutEvents.resolutionEventId,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.resolutionEventId, result.correctionEventId));
		expect(legs.length).toBe(6);

		const leg = (
			betId: string,
			type: "correction_reverse" | "correction_apply",
		) => legs.find((l) => l.betId === betId && l.payoutType === type)?.amount;

		// P's reverse leg is the RECORDED −150 even though only 40 was
		// collectable — the ledger floors, the record never does.
		expect(leg(s.betR, "correction_reverse")).toBe("-150.000000000000000000");
		expect(leg(s.betP, "correction_reverse")).toBe("-150.000000000000000000");
		expect(leg(s.betL, "correction_reverse")).toBe("0.000000000000000000");
		expect(leg(s.betR, "correction_apply")).toBe("0.000000000000000000");
		expect(leg(s.betP, "correction_apply")).toBe("0.000000000000000000");
		expect(leg(s.betL, "correction_apply")).toBe("150.000000000000000000");
	});

	it("resolution-correction::reverses-recorded-not-recomputed", async () => {
		// SYNTHETIC divergence (plan M-2/F-3): after resolve, tweak the
		// positions row out-of-band. A recomputation from positions would
		// reverse 90; the recorded payout_events rows say 150. Recorded wins.
		const userR2 = await seedUser("correct-recorded", "1000");
		const marketId = await seedOpenMarketWithPool("correct-recorded-m");
		const betR2 = await placeBet({
			userId: userR2,
			marketId,
			side: "YES",
			stake: "100",
		});
		await setResolving(marketId);
		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: RESOLVE_REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		// Out-of-band tweak (positions is Bucket C — mutable): 150 → 90.
		await testClient.unsafe(
			`UPDATE positions SET quantity = '90' WHERE user_id = $1 AND market_id = $2`,
			[userR2, marketId],
		);

		const result = await correctResolution({
			marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		const reverseLegs = await testDb
			.select({ amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(
				and(
					eq(payoutEvents.resolutionEventId, result.correctionEventId),
					eq(payoutEvents.betId, betR2),
					eq(payoutEvents.payoutType, "correction_reverse"),
				),
			);
		expect(reverseLegs.length).toBe(1);
		expect(reverseLegs[0]?.amount).toBe("-150.000000000000000000");

		// And the ledger clawback is the recorded 150 (R2 can afford it):
		// 1000 − 100 + 150 = 1050 → −150 → 900.
		const ledgerReverse = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userR2),
					eq(dharmaLedger.entryType, "correction_reverse"),
				),
			);
		expect(ledgerReverse[0]?.amount).toBe("-150.000000000000000000");
		expect(ledgerReverse[0]?.balanceAfter).toBe("900.000000000000000000");
	});

	it("resolution-correction::void-outcome-rejected", async () => {
		// R-9.3: "all shall be resolved" — a correction can NEVER flip a
		// market to VOID. The runtime guard is the assertion target (a JS
		// caller can bypass the TS union — the cast simulates that boundary).
		const s = await seedCorrectionScenario("void-rej");

		const caught = await correctResolution({
			marketId: s.marketId,
			correctedSide: "VOID" as unknown as "YES" | "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(CorrectionOutcomeError);

		// No correction row appended.
		const rows = await testDb
			.select({ id: resolutionEvents.id })
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, s.marketId));
		expect(rows.length).toBe(1);
	});

	it("resolution-correction::same-as-tip-outcome-rejected", async () => {
		// OQ-3 (RATIFIED): the corrected outcome must DIFFER from the chain
		// tip's — a same-side "correction" is a no-op masquerading as one.
		const s = await seedCorrectionScenario("same-tip");

		const caught = await correctResolution({
			marketId: s.marketId,
			correctedSide: "YES",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(CorrectionOutcomeError);

		const rows = await testDb
			.select({ id: resolutionEvents.id })
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, s.marketId));
		expect(rows.length).toBe(1);
	});

	it("resolution-correction::rejected-off-resolved", async () => {
		// The W-3c gate: correction is only legal on a Resolved market.
		const marketId = await seedOpenMarketWithPool("correct-not-resolved");

		const caught = await correctResolution({
			marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(ResolutionStateError);
	});

	it("resolution-correction::correction-of-correction-chains", async () => {
		const s = await seedCorrectionScenario("chain");

		const first = await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});
		const second = await correctResolution({
			marketId: s.marketId,
			correctedSide: "YES",
			reason: "Corrected back: the original call stood.",
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// Chain-tip discovery walked to correction-1, not the resolve:
		// correction-2 reverses correction-1's RECORDED apply legs (L's +150),
		// and its corrects_event_id links correction-1.
		const rows = await testDb
			.select({
				id: resolutionEvents.id,
				eventKind: resolutionEvents.eventKind,
				outcome: resolutionEvents.outcome,
				correctsEventId: resolutionEvents.correctsEventId,
			})
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, s.marketId));
		expect(rows.length).toBe(3);
		const correction1 = rows.find((r) => r.id === first.correctionEventId);
		const correction2 = rows.find((r) => r.id === second.correctionEventId);
		expect(correction1?.correctsEventId).toBe(s.resolveEventId);
		expect(correction2?.correctsEventId).toBe(first.correctionEventId);
		expect(correction2?.outcome).toBe("YES");

		// L's apply is clawed back in full (B = 1100 ≥ 150): −150 → 950.
		const reverseL = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, s.userL),
					eq(dharmaLedger.entryType, "correction_reverse"),
				),
			);
		expect(reverseL.length).toBe(1);
		expect(reverseL[0]?.amount).toBe("-150.000000000000000000");
		expect(reverseL[0]?.balanceAfter).toBe("950.000000000000000000");

		// The YES side is re-applied per the basis: R 900 + 150 = 1050;
		// P (parked at 0) 0 + 150 = 150.
		const applyRows = await testDb
			.select({
				userId: dharmaLedger.userId,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "correction_apply"));
		const applyByUser = new Map(
			applyRows
				.filter((r) => r.userId === s.userR || r.userId === s.userP)
				.map((r) => [r.userId, r.balanceAfter]),
		);
		expect(applyByUser.get(s.userR)).toBe("1050.000000000000000000");
		expect(applyByUser.get(s.userP)).toBe("150.000000000000000000");

		// The read-model projection follows the chain tip (OQ-2).
		const [marketRow] = await testDb
			.select({ resolutionOutcome: markets.resolutionOutcome })
			.from(markets)
			.where(eq(markets.id, s.marketId));
		expect(marketRow?.resolutionOutcome).toBe("YES");
	});

	it("resolution-correction::status-resolved-at-unchanged-outcome-projected", async () => {
		const s = await seedCorrectionScenario("project");

		const [before] = await testDb
			.select({
				status: markets.status,
				resolvedAt: markets.resolvedAt,
			})
			.from(markets)
			.where(eq(markets.id, s.marketId));
		const commentsBefore = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				body: comments.body,
			})
			.from(comments)
			.where(eq(comments.marketId, s.marketId));

		await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// OQ-2: resolution_outcome projects the chain tip; status +
		// resolved_at are UNTOUCHED (so the emergent comment lock holds —
		// comments stay locked through correction, R-9.6).
		const [after] = await testDb
			.select({
				status: markets.status,
				resolvedAt: markets.resolvedAt,
				resolutionOutcome: markets.resolutionOutcome,
			})
			.from(markets)
			.where(eq(markets.id, s.marketId));
		expect(after?.status).toBe("Resolved");
		expect(after?.resolvedAt?.getTime()).toBe(before?.resolvedAt?.getTime());
		expect(after?.resolutionOutcome).toBe("NO");

		const commentsAfter = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				body: comments.body,
			})
			.from(comments)
			.where(eq(comments.marketId, s.marketId));
		expect(commentsAfter).toEqual(commentsBefore);

		// Terminal emit: ONE market.corrected, registered payload shape.
		const corrected = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "market.corrected"));
		expect(corrected.length).toBe(1);
		const payload = corrected[0]?.payload as Record<string, unknown>;
		expect(payload.marketId).toBe(s.marketId);
		expect(payload.correctsEventId).toBe(s.resolveEventId);
		expect(payload.correctedWinningSide).toBe("NO");
		expect(payload.resolutionNote).toBe(CORRECT_REASON);
	});

	it("resolution-correction::prior-resolution-rows-byte-identical", async () => {
		// INV-4: corrections are NEW rows — the resolve row and its
		// payout_events rows are never UPDATEd (storage triggers are the
		// backstop; this asserts the application layer never tries).
		const s = await seedCorrectionScenario("append-only");

		const resolveRowBefore = await testDb
			.select()
			.from(resolutionEvents)
			.where(eq(resolutionEvents.id, s.resolveEventId));
		const payoutRowsBefore = await testDb
			.select()
			.from(payoutEvents)
			.where(eq(payoutEvents.resolutionEventId, s.resolveEventId));

		await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		const resolveRowAfter = await testDb
			.select()
			.from(resolutionEvents)
			.where(eq(resolutionEvents.id, s.resolveEventId));
		const payoutRowsAfter = await testDb
			.select()
			.from(payoutEvents)
			.where(eq(payoutEvents.resolutionEventId, s.resolveEventId));
		expect(resolveRowAfter).toEqual(resolveRowBefore);
		expect(payoutRowsAfter).toEqual(payoutRowsBefore);
	});

	it("resolution-correction::floored-user-ledger-is-the-parked-at-zero-shape", async () => {
		// D-1: P's post-correction ledger state IS the I2 fixture-(a) history
		// (the corrected-with-floored-user shape the 0015 drift fix must stop
		// false-alarming). Pinned as a (entry_type, amount, balance_after)
		// multiset — order-free, like the drift checks themselves.
		const s = await seedCorrectionScenario("parked");

		await correctResolution({
			marketId: s.marketId,
			correctedSide: "NO",
			reason: CORRECT_REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		const rows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, s.userP));
		const shape = rows
			.map((r) => `${r.entryType}|${r.amount}|${r.balanceAfter}`)
			.sort();
		expect(shape).toEqual(
			[
				"initial_grant|100.000000000000000000|100.000000000000000000",
				"bet_stake|-100.000000000000000000|0.000000000000000000",
				"bet_payout|150.000000000000000000|150.000000000000000000",
				"bet_stake|-110.000000000000000000|40.000000000000000000",
				"correction_reverse|-40.000000000000000000|0.000000000000000000",
				"uncollectable|-110.000000000000000000|0.000000000000000000",
			].sort(),
		);
	});
});
