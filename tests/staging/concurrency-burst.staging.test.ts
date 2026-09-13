import { eq, like, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENT BET-PLACEMENT BURST + DHARMA CORRECTNESS VERIFICATION —
// operator ask (2026-09-08): "suppose at once there are a batch of users
// lets say 1000 users placing bet and also check in that moment proper
// deduction of dharma is happening for all properly or not, the calculations
// are going right or wrong."
//
// Fires all participants' bet placements GENUINELY CONCURRENTLY via
// Promise.all (not sequential, not batched) against the dedicated
// concurrency-test-market (built by concurrency-setup.staging.test.ts), each
// through the real W-1 SERIALIZABLE + full-jitter-retry bet transaction —
// exactly the mechanism that exists to make concurrent bet placement safe.
// After the burst, independently re-derives every correctness fact from the
// database directly (never trusts the in-memory results the burst itself
// returned) — per-user ledger entry, balance arithmetic, and total
// conservation across the whole batch.
//
// Real chain throughout, nothing mocked (ADR-0036 primitive 3). Read-only
// verification queries after the burst; the burst itself is the only write.
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_INTENT_ENV = "ZUGZWANG_STAGING_VOLUME_WRITE_ACK";
const VOLUME_INTENT_VALUE = "generate-staging-volume-fixture";

const MARKET_SLUG = "concurrency-test-market";
const EMAIL_PREFIX = "concurrency-test-";
const EMAIL_DOMAIN = "example.com";
const STAKE = "15";
const INITIAL_GRANT = "1000"; // matches INITIAL_USER_DHARMA — fresh users, no prior activity

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));
vi.mock("@/db", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});
vi.mock("@/db/index", async () => {
	const { guardedDb } = await import("./_lib/client");
	return { db: guardedDb };
});

import { dharmaLedger, markets, users } from "@/db/schema";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";

import {
	assertRunnerLiveConnection,
	closeRunnerConnection,
	describeRunnerTarget,
	readOnly,
} from "./_lib/client";
import { resolveRunnerTarget } from "./_lib/target";
import { SYNTHETIC_TOS_IP, SYNTHETIC_TOS_USER_AGENT } from "./fixtures";

const runnerTarget = resolveRunnerTarget(process.env, {
	requireWriteIntent: true,
});
if (!runnerTarget.ok) {
	throw new Error(
		`REFUSED — target guard did not pass.\n  ${runnerTarget.reason}`,
	);
}

const betMetadata = (userId: string, flowId: string) => ({
	request_id: "concurrency-burst",
	flow_id: flowId,
	user_id: userId,
	actor_id: userId,
	idempotency_key: null,
	ip: SYNTHETIC_TOS_IP,
	user_agent: SYNTHETIC_TOS_USER_AGENT,
});

beforeAll(async () => {
	await assertRunnerLiveConnection();
	if (process.env[VOLUME_INTENT_ENV] !== VOLUME_INTENT_VALUE) {
		throw new Error(
			`REFUSED — ${VOLUME_INTENT_ENV} is not set to the acknowledgement value.`,
		);
	}
	console.log(`[concurrency-burst] target ${describeRunnerTarget()}`);
});
afterAll(async () => {
	await closeRunnerConnection();
});

describe("concurrent bet-placement burst + Dharma correctness verification", () => {
	it("fires all participants' bets concurrently, then independently re-derives correctness from the DB", async () => {
		const [market] = await readOnly
			.select({ id: markets.id })
			.from(markets)
			.where(eq(markets.slug, MARKET_SLUG));
		if (!market)
			throw new Error(
				`market ${MARKET_SLUG} not found — run the setup script first`,
			);

		const participants = await readOnly
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(like(users.email, `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`));
		if (participants.length === 0) {
			throw new Error(
				"no concurrency-test-* participants found — run the setup script first",
			);
		}
		console.log(
			`[concurrency-burst] participants: ${participants.length} · market: ${market.id}`,
		);

		// ── THE BURST — genuinely concurrent, Promise.all, no batching ──
		const burstStart = Date.now();
		const results = await Promise.allSettled(
			participants.map(async (p) => {
				const t0 = Date.now();
				assertStakeFloor({ parentCommentId: null, stake: STAKE });
				const result = await runBetTransaction(
					{ marketId: market.id, flow: "F-BET-1" },
					(ctx) =>
						place(ctx, {
							userId: p.id,
							marketId: market.id,
							side: "YES",
							stake: STAKE,
							body: `Concurrency burst — ${p.email} placing a real bet as part of a genuinely concurrent batch.`,
							parentCommentId: null,
							idempotencyKey: uuidv7(),
							bodyFingerprint: uuidv7(),
							betEventId: uuidv7(),
							commentEventId: uuidv7(),
							creditEventId: uuidv7(),
							image: null,
							metadata: betMetadata(p.id, "F-BET-1"),
						}),
				);
				return {
					userId: p.id,
					ms: Date.now() - t0,
					commentId: result.commentId,
				};
			}),
		);
		const burstDurationMs = Date.now() - burstStart;

		const succeeded = results.filter(
			(
				r,
			): r is PromiseFulfilledResult<{
				userId: string;
				ms: number;
				commentId: string;
			}> => r.status === "fulfilled",
		);
		const failed = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		const failuresByType = new Map<string, number>();
		for (const f of failed) {
			const name =
				f.reason instanceof Error ? f.reason.constructor.name : "Unknown";
			failuresByType.set(name, (failuresByType.get(name) ?? 0) + 1);
		}
		const latencies = succeeded.map((r) => r.value.ms).sort((a, b) => a - b);
		const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
		const p90 = latencies[Math.floor(latencies.length * 0.9)] ?? 0;
		const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

		console.log(
			`[concurrency-burst] BURST DONE in ${burstDurationMs}ms · ${succeeded.length}/${participants.length} succeeded · ${failed.length} failed`,
		);
		console.log(
			`[concurrency-burst] per-bet latency: min=${latencies[0] ?? 0}ms p50=${p50}ms p90=${p90}ms p99=${p99}ms max=${latencies[latencies.length - 1] ?? 0}ms`,
		);
		console.log(
			`[concurrency-burst] failure types: ${JSON.stringify(Object.fromEntries(failuresByType))}`,
		);

		// ── VERIFICATION — independently re-derived from the DB, not from
		// the burst's own in-memory results. ──────────────────────────
		const succeededUserIds = succeeded.map((r) => r.value.userId);

		// 1. Every succeeded user has EXACTLY ONE bet_stake ledger entry on this batch.
		const ledgerRows =
			succeededUserIds.length === 0
				? []
				: await readOnly
						.select({
							userId: dharmaLedger.userId,
							amount: dharmaLedger.amount,
							balanceAfter: dharmaLedger.balanceAfter,
							entryType: dharmaLedger.entryType,
						})
						.from(dharmaLedger)
						.where(
							sql`${dharmaLedger.userId} IN ${succeededUserIds} AND ${dharmaLedger.entryType} = 'bet_stake'`,
						);

		const ledgerByUser = new Map<string, typeof ledgerRows>();
		for (const row of ledgerRows) {
			const arr = ledgerByUser.get(row.userId) ?? [];
			arr.push(row);
			ledgerByUser.set(row.userId, arr);
		}

		let usersWithExactlyOneDebit = 0;
		let usersWithWrongDebitCount = 0;
		let usersWithCorrectAmount = 0;
		let usersWithWrongAmount = 0;
		let usersWithCorrectBalanceAfter = 0;
		let usersWithWrongBalanceAfter = 0;
		const mismatches: string[] = [];

		for (const userId of succeededUserIds) {
			const rows = ledgerByUser.get(userId) ?? [];
			if (rows.length === 1) {
				usersWithExactlyOneDebit++;
			} else {
				usersWithWrongDebitCount++;
				mismatches.push(
					`${userId}: expected 1 bet_stake ledger row, found ${rows.length}`,
				);
				continue;
			}
			const row = rows[0];
			if (!row) continue;
			// amount is the DELTA — a stake debit is negative STAKE.
			const expectedAmount = `-${STAKE}`;
			if (
				row.amount === expectedAmount ||
				Number(row.amount) === -Number(STAKE)
			) {
				usersWithCorrectAmount++;
			} else {
				usersWithWrongAmount++;
				mismatches.push(
					`${userId}: expected amount ${expectedAmount}, found ${row.amount}`,
				);
			}
			const expectedBalanceAfter = Number(INITIAL_GRANT) - Number(STAKE);
			if (Number(row.balanceAfter) === expectedBalanceAfter) {
				usersWithCorrectBalanceAfter++;
			} else {
				usersWithWrongBalanceAfter++;
				mismatches.push(
					`${userId}: expected balanceAfter ${expectedBalanceAfter}, found ${row.balanceAfter}`,
				);
			}
		}

		// 2. Conservation — sum of all debits across the batch equals
		// succeeded_count * STAKE, exactly.
		const totalDebited = ledgerRows.reduce(
			(sum, r) => sum + Math.abs(Number(r.amount)),
			0,
		);
		const expectedTotalDebited = succeeded.length * Number(STAKE);
		const conservationHolds = totalDebited === expectedTotalDebited;

		console.log(
			`[concurrency-burst] VERIFICATION — exactly-one-debit: ${usersWithExactlyOneDebit}/${succeeded.length} · correct amount: ${usersWithCorrectAmount}/${succeeded.length} · correct balanceAfter: ${usersWithCorrectBalanceAfter}/${succeeded.length}`,
		);
		console.log(
			`[concurrency-burst] CONSERVATION — total debited: ${totalDebited} · expected: ${expectedTotalDebited} · holds: ${conservationHolds}`,
		);
		if (mismatches.length > 0) {
			console.log(
				`[concurrency-burst] MISMATCHES (${mismatches.length}): ${JSON.stringify(mismatches.slice(0, 20))}`,
			);
		}
		console.log(
			`[concurrency-burst] SUMMARY_JSON ${JSON.stringify({
				participants: participants.length,
				burstDurationMs,
				succeeded: succeeded.length,
				failed: failed.length,
				failuresByType: Object.fromEntries(failuresByType),
				latencyMs: {
					p50,
					p90,
					p99,
					min: latencies[0] ?? 0,
					max: latencies[latencies.length - 1] ?? 0,
				},
				usersWithExactlyOneDebit,
				usersWithWrongDebitCount,
				usersWithCorrectAmount,
				usersWithWrongAmount,
				usersWithCorrectBalanceAfter,
				usersWithWrongBalanceAfter,
				totalDebited,
				expectedTotalDebited,
				conservationHolds,
			})}`,
		);

		// Assertions — the real correctness claim of this run.
		expect(
			usersWithWrongDebitCount,
			"no user should have the wrong ledger-row count",
		).toBe(0);
		expect(
			usersWithWrongAmount,
			"no user should have the wrong debit amount",
		).toBe(0);
		expect(
			usersWithWrongBalanceAfter,
			"no user should have the wrong post-debit balance",
		).toBe(0);
		expect(
			conservationHolds,
			"total debited must exactly equal succeeded_count * STAKE",
		).toBe(true);
	}, 1_800_000);
});
