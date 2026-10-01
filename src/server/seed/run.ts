import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "@/db";
import { betReceipts, markets } from "@/db/schema";
import { buildBetMetadata } from "@/server/bets/endpoint";
import { toWireError } from "@/server/bets/errors";
import { place } from "@/server/bets/place";
import { isDurableIdempotencyConflict } from "@/server/bets/replay";
import { runBetTransaction } from "@/server/bets/transaction";
import { computeBodyFingerprint } from "@/server/idempotency/cache";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { isFrozen } from "@/server/system/is-frozen";
import { getRedisKey } from "@/server/upstash/keys";
import { acquireLock, releaseLock } from "@/server/upstash/lock";

import { assertSeedToolsEnabled } from "./gate";
import {
	findSeedParticipant,
	getOrCreateSeedParticipant,
	SEED_TOS_IP,
	SEED_TOS_USER_AGENT,
} from "./participants";
import {
	computeBatchId,
	planSeedBatch,
	SEED_REQUEST_ID_PREFIX,
	seedIdempotencyKey,
	seedParticipantEmail,
} from "./plan";
import type { RawSeedRow, SeedRow, SeedRowError, SeedRowResult } from "./types";
import { validateSeedRows } from "./validate";

// SEED-STAGING-1 — executes one chunk of a validated sheet.
//
// The caller sends the WHOLE batch on every call and this re-validates it
// against live market state every time: the browser holds the rows between
// chunks, and nothing the browser holds is trusted. Each row is one call into
// the shipped bet engine — `runBetTransaction(place)`, the W-1 SERIALIZABLE
// transaction the bet route uses — so INV-1/2/3 and every in-tx guard
// (opposite side held, self-reply, overdraft) are enforced by the same code
// that enforces them for real users. Nothing here inserts a row.
//
// Re-running is a skip, not a duplicate: each row's idempotency key is derived
// from the batch, and a key that already has a `bet_receipts` row is never
// placed again (I-IDEM-ONCE-001). The receipt also returns the row's
// commentId, which is how a reply in a later chunk finds its parent.

/** Longer than any chunk can run (the ALB idles out at 60 s), so a crashed
 * holder frees the lock on its own. */
const SEED_RUN_LOCK_TTL_SECONDS = 120;

type ReceiptResult = { commentId?: unknown; newPrice?: unknown };

/**
 * A receipt is read for ONE user: the key AND its owner must match. That is
 * ADR-0044's posture for `loadDurableReplay` (S-7 G2) — a key alone never
 * decides whose receipt is read. It matters twice here: a "skipped" verdict,
 * and the parent comment a reply is attached to.
 */
async function loadReceipt(
	idempotencyKey: string,
	userId: string,
): Promise<{ commentId: string; newPrice: string | null } | null> {
	const rows = await db
		.select({ result: betReceipts.result })
		.from(betReceipts)
		.where(
			and(
				eq(betReceipts.idempotencyKey, idempotencyKey),
				eq(betReceipts.userId, userId),
			),
		)
		.limit(1);
	const result = rows[0]?.result as ReceiptResult | undefined;
	if (!result || typeof result.commentId !== "string") return null;
	return {
		commentId: result.commentId,
		newPrice: typeof result.newPrice === "string" ? result.newPrice : null,
	};
}

/**
 * Every non-Draft market, not only Open ones. Whether a market is Open is the
 * engine's call per row (`assertMarketOpen` inside the W-1 transaction): a
 * market that closes between preview and run fails ITS rows and halts, while
 * the other markets carry on. Validating against Open-only here would instead
 * reject the whole batch for one market's state change.
 */
async function marketsBySlug(): Promise<
	Map<string, { id: string; status: string }>
> {
	const rows = await db
		.select({ id: markets.id, slug: markets.slug, status: markets.status })
		.from(markets)
		.where(ne(markets.status, "Draft"));
	return new Map(rows.map((r) => [r.slug, { id: r.id, status: r.status }]));
}

/**
 * A typed bet error keeps its code and fixed message. Anything else becomes a
 * fixed string and goes to Sentry — driver and constraint text never reaches
 * the browser (security audit, LOW).
 */
function describeError(err: unknown): string {
	const wire = toWireError(err);
	if (wire.body.error.code !== "error_internal") {
		return `${wire.body.error.code}: ${wire.body.error.message}`;
	}
	safeCaptureException(err, { tags: { kind: "seed_row_internal_error" } });
	return "internal error (reported); this market was halted";
}

export async function runSeedChunk(args: {
	rows: readonly RawSeedRow[];
	fromIndex: number;
	count: number;
	haltedMarkets: readonly string[];
}): Promise<{
	batchId: string;
	results: SeedRowResult[];
	nextIndex: number;
	done: boolean;
	haltedMarkets: string[];
	errors: SeedRowError[];
}> {
	assertSeedToolsEnabled();

	// The conclusion freeze (SPEC.1 §20.2, CLAUDE.md §3 "no bypass"). The bet
	// route refuses at `bets/endpoint.ts`'s freeze gate, and neither `place()`
	// nor `runBetTransaction` re-checks it, so a path that skips the route must
	// carry the check itself. A batch-level refusal, not a row failure: nothing
	// is wrong with the sheet.
	if (await isFrozen()) {
		return {
			batchId: "",
			results: [],
			nextIndex: args.fromIndex,
			done: false,
			haltedMarkets: [...args.haltedMarkets],
			errors: [
				{
					rowNumber: 0,
					message: "The experiment has concluded; seeding is closed.",
				},
			],
		};
	}

	const marketBySlug = await marketsBySlug();
	const halted = new Set(args.haltedMarkets);
	const { rows: valid, errors } = validateSeedRows(args.rows, {
		acceptedMarketSlugs: new Set(marketBySlug.keys()),
	});
	const batchId = computeBatchId(valid);
	if (errors.length > 0) {
		return {
			batchId,
			results: [],
			nextIndex: args.fromIndex,
			done: false,
			haltedMarkets: [...halted],
			errors,
		};
	}

	const ordered = planSeedBatch(valid).flatMap((g) => g.rows);
	const byNumber = new Map<number, SeedRow>(
		ordered.map((r) => [r.rowNumber, r]),
	);
	const commentIds = new Map<number, string>();
	const end = Math.min(ordered.length, args.fromIndex + args.count);
	const results: SeedRowResult[] = [];
	const requestId = `${SEED_REQUEST_ID_PREFIX}${batchId.slice(0, 16)}`;

	// A parent posted in an earlier chunk or run is found through ITS OWN
	// participant's receipt — never through the key alone.
	const resolveParent = async (parent: SeedRow): Promise<string | null> => {
		const cached = commentIds.get(parent.rowNumber);
		if (cached) return cached;
		const owner = await findSeedParticipant(
			seedParticipantEmail(batchId, parent),
		);
		if (!owner) return null;
		const receipt = await loadReceipt(
			seedIdempotencyKey(batchId, parent.rowNumber),
			owner.id,
		);
		return receipt?.commentId ?? null;
	};

	// One seeding chunk at a time, deployment-wide. Bets are already safe
	// under concurrency (the receipt unique turns a race into a skip), but
	// participants are not: two runs can both miss the same email, and the
	// loser's identity-pool tuple is spent with no user attached, because the
	// pool commits its own transaction (identity-pool/consume.ts). The lock is
	// per CHUNK, not per batch — a batch spans many requests, and a lock held
	// across them would outlive a closed browser tab. Fails CLOSED: if Redis
	// cannot answer, `acquireLock` throws and nothing runs.
	const lockKey = getRedisKey("seed", "run-lock");
	const lock = await acquireLock(lockKey, SEED_RUN_LOCK_TTL_SECONDS);
	if (!lock) {
		return {
			batchId,
			results: [],
			nextIndex: args.fromIndex,
			done: false,
			haltedMarkets: [...halted],
			errors: [
				{
					rowNumber: 0,
					message:
						"Another seeding run is in progress. Wait for it to finish, then upload again; rows already posted are skipped.",
				},
			],
		};
	}

	try {
		for (let i = args.fromIndex; i < end; i++) {
			const row = ordered[i];
			const base = {
				rowNumber: row.rowNumber,
				marketSlug: row.marketSlug,
				pseudonym: null,
				newPrice: null,
			};
			if (halted.has(row.marketSlug)) {
				results.push({
					...base,
					status: "halted",
					message: "an earlier row in this market failed",
				});
				continue;
			}
			const fail = (message: string) => {
				halted.add(row.marketSlug);
				results.push({ ...base, status: "failed", message });
			};

			const idempotencyKey = seedIdempotencyKey(batchId, row.rowNumber);
			const email = seedParticipantEmail(batchId, row);
			try {
				// 1. Already posted? Answered without creating anyone, and before
				// the market's state is consulted: a row posted in an earlier run
				// is "skipped" even if its market has closed since.
				// The freeze, re-checked per ROW: the route checks once per bet, so
				// once per chunk would leave a window of up to a chunk's worth of
				// bets after `frozen_at` is set (security audit, LOW).
				if (await isFrozen()) {
					fail("The experiment has concluded; seeding is closed.");
					continue;
				}
				const existing = await findSeedParticipant(email);
				const done = existing
					? await loadReceipt(idempotencyKey, existing.id)
					: null;
				if (existing && done) {
					commentIds.set(row.rowNumber, done.commentId);
					results.push({
						...base,
						status: "skipped",
						pseudonym: existing.pseudonym,
						newPrice: done.newPrice,
						message: "already posted",
					});
					continue;
				}

				// 2. Is the market still Open? Checked BEFORE a participant is
				// minted, so a row that cannot be posted never spends an
				// identity-pool tuple (a finite resource on staging). The engine
				// re-checks inside the W-1 transaction (`assertMarketOpen`); this
				// is the cheap early answer, not the guarantee.
				const market = marketBySlug.get(row.marketSlug);
				if (!market) {
					fail(`market "${row.marketSlug}" does not exist`);
					continue;
				}
				if (market.status !== "Open") {
					fail(`market "${row.marketSlug}" is ${market.status}, not Open`);
					continue;
				}
				const marketId = market.id;

				const participant = await getOrCreateSeedParticipant({
					email,
					batchId,
				});
				// The bet route refuses a banned user (`banned_user`, 403); a ban
				// applied through the moderation surface must hold here too, or a
				// re-upload would keep posting as someone an admin has removed.
				if (participant.banned) {
					fail(`participant ${participant.pseudonym} is banned`);
					continue;
				}
				let parentCommentId: string | null = null;
				if (row.replyToRow !== null) {
					const parent = byNumber.get(row.replyToRow);
					parentCommentId = parent ? await resolveParent(parent) : null;
					if (!parentCommentId) {
						fail(`reply_to row ${row.replyToRow} has not been posted`);
						continue;
					}
				}

				const flow = parentCommentId !== null ? "F-COMMENT-2" : "F-BET-1";
				const bodyFingerprint = await computeBodyFingerprint({
					marketId,
					side: row.side,
					stake: row.stake,
					body: row.body,
					parentCommentId,
				});
				// Minted once per row and closed over: the wrapper re-runs the
				// callback on a 40001/40P01 retry, and regenerating these per
				// attempt would defeat the events ON CONFLICT dedupe.
				const betEventId = uuidv7();
				const commentEventId = uuidv7();
				const creditEventId = uuidv7();
				const metadata = buildBetMetadata({
					requestId,
					flowId: flow,
					userId: participant.userId,
					idempotencyKey,
					ip: SEED_TOS_IP,
					userAgent: SEED_TOS_USER_AGENT,
				});
				try {
					const result = await runBetTransaction({ marketId, flow }, (ctx) =>
						place(ctx, {
							userId: participant.userId,
							marketId,
							side: row.side,
							stake: row.stake,
							body: row.body,
							parentCommentId,
							idempotencyKey,
							bodyFingerprint,
							betEventId,
							commentEventId,
							creditEventId,
							image: null,
							metadata,
						}),
					);
					commentIds.set(row.rowNumber, result.commentId);
					results.push({
						...base,
						status: "posted",
						pseudonym: participant.pseudonym,
						newPrice: result.newPrice,
						message: null,
					});
				} catch (err) {
					// Another run committed this exact row first: its receipt is
					// the answer, and this attempt rolled back whole.
					if (isDurableIdempotencyConflict(err)) {
						const receipt = await loadReceipt(
							idempotencyKey,
							participant.userId,
						);
						if (receipt) {
							commentIds.set(row.rowNumber, receipt.commentId);
							results.push({
								...base,
								status: "skipped",
								pseudonym: participant.pseudonym,
								newPrice: receipt.newPrice,
								message: "already posted",
							});
							continue;
						}
					}
					throw err;
				}
			} catch (err) {
				fail(describeError(err));
			}
		}
	} finally {
		await releaseLock(lockKey, lock.token);
	}

	return {
		batchId,
		results,
		nextIndex: end,
		done: end >= ordered.length,
		haltedMarkets: [...halted],
		errors: [],
	};
}
